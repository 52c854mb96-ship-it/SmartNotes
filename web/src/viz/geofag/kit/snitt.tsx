/**
 * Snitt gjennom berggrunnen, i tre former:
 *   - `Snittblokk`: blokkdiagram med overflaten oppå i svakt perspektiv (terreng, vann, hav, fjord eller isdekke),
 *     snittet foran og lagene videre på sideflaten. Lagene gis som funksjoner av x eller polygoner, og forkastninger og
 *     erosjonsflater (diskordanser) virker på lagene i riktig rekkefølge, som i relativ datering.
 *   - `Lagpakke`: lagrekke med eldste lag nederst, pil «yngre», dybdeakse og etiketter i egen kolonne (under figuren på
 *     smal skjerm).
 *   - `Borekjerne`: stående sylinder med lys og skygge, lagene fra en Lagpakke-liste, valgfrie varv og prøvemerker.
 *
 * Alle lag har mønstrene fra monstre.tsx (`MonsterId`), så de ser ut som på geologiske kart og i PDF-malen «Atlas».
 */
import { createContext, useContext, type ReactNode } from 'react';
import { useTextScale } from '../../kit/controls';
import { VIZ } from '../../kit/colors';
import { fmt } from '../../kit/format';
import { niceTicks } from '../../kit/svg';
import { Txt } from '../../kit/txt';
import { ContactShadow, LinearGradient, RadialGradient, alpha, mix, sceneRandom, shade, tint, useSvgId } from '../../kit/scene/core';
import { SCENE } from '../../kit/scene/palette';
import { GEO } from './colors';
import { useGeoScale, useGeoStroke } from './felles';
import { LagMonstre, MONSTER_NAVN, lagFyll, useLagMonstre } from './monstre';
import type { MonsterId } from './typer';

/* =====================================================================================================================
 * Felles typer og små hjelpere
 * ================================================================================================================== */

/** Et punkt [x, y] i snittets koordinater (y nedover, som i SVG). */
export type SnittPunkt = readonly [number, number];

/** En flate i snittet: et tall (vannrett flate i den høyden) eller y som funksjon av x. */
export type SnittKurve = number | ((x: number) => number);

type Fn = (x: number) => number;

const BIG = 1e4;
const r2 = (v: number) => Math.round(v * 100) / 100;
const fin = (v: number, alt = 0) => (Number.isFinite(v) ? v : alt);
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
/** Omtrentlig bredde på en tekst i figurens enheter (Txt: 17 · size · f). */
const tekstBredde = (s: string, size: number, f: number) => s.length * 0.58 * 17 * size * f;

function tilFn(k: SnittKurve | undefined): Fn | null {
  if (k === undefined || k === null) return null;
  if (typeof k === 'number') {
    if (!Number.isFinite(k)) return null;
    return () => k;
  }
  return (x) => fin(k(x));
}

function linspace(a: number, b: number, n: number): number[] {
  const m = Math.max(1, Math.round(n));
  return Array.from({ length: m + 1 }, (_, i) => a + ((b - a) * i) / m);
}

function sti(punkter: readonly SnittPunkt[], lukket = false): string {
  if (punkter.length === 0) return '';
  return punkter.map(([x, y], i) => `${i ? 'L' : 'M'}${r2(x)} ${r2(y)}`).join('') + (lukket ? 'Z' : '');
}

function iPolygon(p: readonly SnittPunkt[], x: number, y: number): boolean {
  let inne = false;
  for (let i = 0, j = p.length - 1; i < p.length; j = i++) {
    const [xi, yi] = p[i]!;
    const [xj, yj] = p[j]!;
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inne = !inne;
  }
  return inne;
}

/**
 * Plasserer etiketter langs en akse uten at de overlapper: hver etikett vil stå med midten i `onsket[i]` og er `hoyder[i]`
 * høy. Gir midtpunktene i samme rekkefølge, innenfor [min, max] så langt det går. Ugyldige tall behandles som min.
 */
export function snittFordelEtiketter(onsket: readonly number[], hoyder: readonly number[], min: number, max: number): number[] {
  const n = onsket.length;
  const lo = fin(min);
  const hi = Math.max(lo, fin(max, lo));
  const h = (i: number) => Math.max(0, fin(hoyder[i] ?? 0));
  const orden = Array.from({ length: n }, (_, i) => i).sort((a, b) => fin(onsket[a]!, lo) - fin(onsket[b]!, lo));
  const c = new Array<number>(n).fill(lo);
  let forrige = -Infinity;
  let forrigeH = 0;
  for (const i of orden) {
    const minste = Number.isFinite(forrige) ? forrige + (forrigeH + h(i)) / 2 : lo + h(i) / 2;
    c[i] = Math.max(fin(onsket[i]!, lo), minste, lo + h(i) / 2);
    forrige = c[i]!;
    forrigeH = h(i);
  }
  // Skyv tilbake opp der de går ut nederst (men ikke over toppen)
  let neste = Infinity;
  let nesteH = 0;
  for (let k = orden.length - 1; k >= 0; k--) {
    const i = orden[k]!;
    const storste = Number.isFinite(neste) ? neste - (nesteH + h(i)) / 2 : hi - h(i) / 2;
    c[i] = Math.max(lo + h(i) / 2, Math.min(c[i]!, storste, hi - h(i) / 2));
    neste = c[i]!;
    nesteH = h(i);
  }
  return c;
}

/* =====================================================================================================================
 * Etiketter i egen kolonne
 * ================================================================================================================== */

/** Én etikett i `SnittEtiketter`: punktet den peker på og teksten. */
export interface SnittEtikett {
  /** Punktet etiketten peker på (figurens koordinater, eller snittets inne i Snittblokk). */
  x: number;
  y: number;
  tekst: string;
  /** Andre linje i mindre, dempet skrift (alder, prosess, fossiler …). */
  undertekst?: string;
  /** Uthevet (fet skrift). */
  uthevet?: boolean;
  /** Nedtonet. */
  dim?: boolean;
}

/** Props til `SnittEtiketter`. */
export interface SnittEtiketterProps {
  /** X der teksten starter (`anchor` 'start') eller slutter ('end'). */
  x: number;
  etiketter: readonly SnittEtikett[];
  /** Øverste og nederste y etikettene kan stå på. */
  topp: number;
  bunn: number;
  /** 'start' (standard): kolonnen står til høyre for punktene. 'end': til venstre. */
  anchor?: 'start' | 'end';
  /** Relativ tekststørrelse (standard 0,8). */
  size?: number;
  /** Prikk i punktet etiketten peker på (standard på). */
  prikk?: boolean;
}

/**
 * Etiketter i en egen kolonne ved siden av et snitt, med tynne streker til det de peker på, som i lærebøkene. Etikettene
 * flyttes så de ikke overlapper (også når teksten vokser på mobil). Ankerpunktet er (x, y) i hver etikett; kolonnen
 * står ved `x` i propsene.
 *   <SnittEtiketter x={640} topp={20} bunn={300} etiketter={[{ x: 500, y: 120, tekst: 'Sandstein' }]} />
 */
export function SnittEtiketter({ x, etiketter, topp, bunn, anchor = 'start', size = 0.8, prikk = true }: SnittEtiketterProps) {
  const f = useTextScale();
  const s = useGeoStroke();
  const k = useGeoScale();
  const fs = 17 * size * f;
  const synlige = etiketter.filter((e) => Number.isFinite(e.x) && Number.isFinite(e.y) && e.tekst);
  const hoyder = synlige.map((e) => fs * 1.12 + (e.undertekst ? fs * 0.86 : 0) + 4);
  const c = snittFordelEtiketter(
    synlige.map((e) => e.y),
    hoyder,
    topp,
    bunn,
  );
  const dir = anchor === 'start' ? 1 : -1;
  return (
    <g>
      {synlige.map((e, i) => {
        const midt = c[i]!;
        const h = hoyder[i]! - 4;
        const linje1 = midt - h / 2 + fs * 0.8;
        const strekY = e.undertekst ? linje1 - fs * 0.33 : midt;
        return (
          <g key={`${e.tekst}-${i}`} opacity={e.dim ? 0.45 : undefined}>
            <polyline
              points={`${r2(e.x)},${r2(e.y)} ${r2(x - dir * 12)},${r2(strekY)} ${r2(x - dir * 4)},${r2(strekY)}`}
              fill="none"
              stroke={VIZ.muted}
              strokeWidth={1.1 * s}
              strokeLinejoin="round"
            />
            {prikk && <circle cx={e.x} cy={e.y} r={2.4 * k} fill={VIZ.ink} stroke={VIZ.surface} strokeWidth={1} />}
            <Txt x={x} y={linje1} anchor={anchor} size={size} weight={e.uthevet ? 700 : 560}>
              {e.tekst}
            </Txt>
            {e.undertekst && (
              <Txt x={x} y={linje1 + fs * 0.92} anchor={anchor} size={size * 0.82} weight={500} muted>
                {e.undertekst}
              </Txt>
            )}
          </g>
        );
      })}
    </g>
  );
}

/* =====================================================================================================================
 * Snittblokk: geologien (rene funksjoner)
 * ================================================================================================================== */

/** Ett lag i en Snittblokk. Lista gis med det eldste laget først (avsatt eller dannet først), det yngste sist. */
export interface SnittLag {
  /** Mønsteret: bergart, sediment eller løsmasse. */
  type: MonsterId;
  /** Toppen av laget (et bånd): y som tall eller funksjon av x. Se `lagflate` for skrå, foldede og kuppelformede lag. */
  topp?: SnittKurve;
  /**
   * Bunnen av laget. Standard: toppen av forrige bånd i lista (laget under), eller langt under snittet for det første
   * laget. Gi den når laget ligger over en erosjonsflate (`erosjon`) eller kiler ut.
   */
  bunn?: SnittKurve;
  /** Laget som polygon i stedet for bånd: intrusjon, linse, saltdiapir, malmkropp. [[x, y], …] i snittets koordinater. */
  punkter?: readonly SnittPunkt[];
  /**
   * Bunnen er en erosjonsflate (diskordans): alt eldre som lå over flaten, er fjernet før laget ble avsatt. Flaten
   * tegnes som en kraftig linje.
   */
  erosjon?: boolean;
  /** Teksten i etiketten (standard mønsterets navn, f.eks. «Sandstein»). */
  navn?: string;
  /** Andre linje i etiketten (alder, kildebergart, reservoar …). */
  undertekst?: string;
  /** Ton ned laget. */
  dim?: boolean;
  /** Uthev laget (kraftig kontur og fet etikett). */
  uthevet?: boolean;
}

/** En forkastning i en Snittblokk. Den forskyver alle lagene som var dannet da den skjedde (se `lag`). */
export interface SnittForkastning {
  /** Et punkt på forkastningsplanet: x, og y (standard 0, toppen av snittet). */
  x: number;
  y?: number;
  /** Fallvinkelen i grader (5–90, standard 60). */
  fall?: number;
  /** Siden planet heller mot. Hengblokka ligger på den siden. Standard 'hoyre'. */
  heller?: 'hoyre' | 'venstre';
  /**
   * Forskyvning langs planet i snittets enheter: positiv = hengblokka glir ned (normalforkastning, strekk), negativ =
   * opp (reversforkastning, sammenpressing).
   */
  sprang: number;
  /** Hvor mange lag (fra det eldste) forkastningen skjærer. Yngre lag ligger urørt over. Standard alle. */
  lag?: number;
  /** Halvpiler langs planet som viser bevegelsen på hver side. Standard på. */
  piler?: boolean;
}

interface Forkastning {
  x0: number;
  y0: number;
  dir: 1 | -1;
  cot: number;
  vx: number;
  vy: number;
  antall: number;
  piler: boolean;
  fall: number;
  sprang: number;
}

type Hendelse = { k: 'lag'; i: number } | { k: 'erosjon'; i: number } | { k: 'forkastning'; j: number };

/** Geologien i en Snittblokk som rene funksjoner (fra `snittGeologi`). */
export interface SnittGeologi {
  /** Indeksen i `lag` til laget i punktet (snittets koordinater), eller −1 der det ikke er bergart (luft, erodert bort). */
  lagVed: (x: number, y: number) => number;
  /** Toppen og bunnen av hvert bånd slik de brukes (null for polygoner og ugyldige lag). */
  topp: readonly (Fn | null)[];
  bunn: readonly (Fn | null)[];
  /** Polygonene (null for bånd). */
  polygoner: readonly (readonly SnittPunkt[] | null)[];
  /** Forskyvningen langs hver forkastning (vx, vy) og om et punkt ligger i hengblokka (i forkastningens egen ramme). */
  forkastninger: readonly { vx: number; vy: number; hengblokk: (x: number, y: number) => boolean }[];
  /** Den største vannrette forskyvningen (sum av |vx|), til marg rundt lagene. */
  margin: number;
}

/** Hendelsene i tidsrekkefølge: lag, erosjonsflater og forkastninger. */
function hendelser(lag: readonly SnittLag[], fk: readonly Forkastning[], bunnFinnes: readonly boolean[]): Hendelse[] {
  const n = lag.length;
  const out: Hendelse[] = [];
  for (let i = 0; i < n; i++) {
    fk.forEach((f, j) => {
      if (f.antall === i) out.push({ k: 'forkastning', j });
    });
    if (lag[i]!.erosjon && bunnFinnes[i]) out.push({ k: 'erosjon', i });
    out.push({ k: 'lag', i });
  }
  fk.forEach((f, j) => {
    if (f.antall >= n) out.push({ k: 'forkastning', j });
  });
  return out;
}

function lagForkastninger(liste: readonly SnittForkastning[], n: number): Forkastning[] {
  return liste.map((f) => {
    const fall = clamp(fin(f.fall ?? 60, 60), 5, 90);
    const rad = (fall * Math.PI) / 180;
    const dir: 1 | -1 = f.heller === 'venstre' ? -1 : 1;
    const s = fin(f.sprang);
    const antall = f.lag === undefined || !Number.isFinite(f.lag) ? n : clamp(Math.round(f.lag), 0, n);
    return {
      x0: fin(f.x),
      y0: fin(f.y ?? 0),
      dir,
      cot: fall >= 89.99 ? 0 : 1 / Math.tan(rad),
      vx: r2(s * dir * Math.cos(rad)),
      vy: r2(s * Math.sin(rad)),
      antall,
      piler: f.piler !== false,
      fall,
      sprang: s,
    };
  });
}

const iHengblokk = (f: Forkastning, x: number, y: number) => f.dir * (x - (f.x0 + f.dir * (y - f.y0) * f.cot)) > 0;

/**
 * Geologien i en Snittblokk som rene funksjoner: hvilket lag som er i et punkt etter at alle lag, erosjonsflater og
 * forkastninger er tatt med i riktig rekkefølge. Lagene gis med det eldste først (som i `Snittblokk`), og `h` er bunnen
 * av snittet. Nyttig i kapitlene, f.eks. «hvilket lag treffer borehullet på 120 m dyp?».
 *   const geo = snittGeologi(lag, [{ x: 300, sprang: 40 }], 300);
 *   geo.lagVed(400, 150)   // indeksen i lag, eller −1
 */
export function snittGeologi(lag: readonly SnittLag[], forkastninger: readonly SnittForkastning[] = [], h = 300): SnittGeologi {
  const n = lag.length;
  const topp: (Fn | null)[] = [];
  const bunn: (Fn | null)[] = [];
  const polygoner: (readonly SnittPunkt[] | null)[] = [];
  let forrigeTopp: Fn = () => fin(h, 300) + BIG;
  for (let i = 0; i < n; i++) {
    const l = lag[i]!;
    const p = l.punkter ? l.punkter.filter(([x, y]) => Number.isFinite(x) && Number.isFinite(y)) : null;
    if (p && p.length >= 3) {
      polygoner.push(p);
      topp.push(null);
      bunn.push(null);
      continue;
    }
    const t = tilFn(l.topp);
    polygoner.push(null);
    if (!t) {
      topp.push(null);
      bunn.push(null);
      continue;
    }
    const b = tilFn(l.bunn) ?? forrigeTopp;
    topp.push(t);
    bunn.push(b);
    forrigeTopp = t;
  }
  const fk = lagForkastninger(forkastninger, n);
  const hend = hendelser(lag, fk, bunn.map((b) => b !== null));
  const lagVed = (x: number, y: number): number => {
    if (!Number.isFinite(x) || !Number.isFinite(y)) return -1;
    let px = x;
    let py = y;
    for (let e = hend.length - 1; e >= 0; e--) {
      const ev = hend[e]!;
      if (ev.k === 'lag') {
        const p = polygoner[ev.i];
        if (p) {
          if (iPolygon(p, px, py)) return ev.i;
          continue;
        }
        const t = topp[ev.i];
        const b = bunn[ev.i];
        if (t && b) {
          const bb = b(px);
          if (py >= Math.min(t(px), bb) && py <= bb) return ev.i;
        }
      } else if (ev.k === 'erosjon') {
        const b = bunn[ev.i];
        if (b && py < b(px)) return -1;
      } else {
        const f = fk[ev.j]!;
        if (iHengblokk(f, px, py)) {
          px -= f.vx;
          py -= f.vy;
        }
      }
    }
    return -1;
  };
  return {
    lagVed,
    topp,
    bunn,
    polygoner,
    forkastninger: fk.map((f) => ({ vx: f.vx, vy: f.vy, hengblokk: (x: number, y: number) => iHengblokk(f, x, y) })),
    margin: 24 + fk.reduce((s, f) => s + Math.abs(f.vx), 0),
  };
}

/** Valg til `lagflate`. Alle mål i snittets enheter. */
export interface LagflateValg {
  /** Fallvinkel i grader: positiv = laget heller ned mot høyre. */
  fall?: number;
  /** Fold: amplitude (positiv = antiklinal med toppen i `midt`, negativ = synklinal) og bølgelengde. */
  amplitude?: number;
  bolgelengde?: number;
  /** X der folden har toppen (eller bunnen), og der fallet regnes fra. Standard 0. */
  midt?: number;
  /** Kuppel (saltkuppel, felle): hevning `hoyde` med bredde `bredde` (standardavvik) rundt `midt`. */
  kuppel?: { hoyde: number; bredde: number };
}

/**
 * En lagflate som funksjon av x til `topp` og `bunn` i SnittLag: vannrett i høyden `y0`, skrå (`fall`), foldet
 * (`amplitude`, `bolgelengde`) eller med en kuppel. Gi alle lagene samme valg og ulik `y0`, så blir de parallelle.
 *   const fold = { amplitude: 40, bolgelengde: 520, midt: 300 };
 *   lag = [{ type: 'sandstein', topp: lagflate(200, fold) }, { type: 'leirskifer', topp: lagflate(150, fold) }]
 */
export function lagflate(y0: number, valg: LagflateValg = {}): Fn {
  const y = fin(y0);
  const midt = fin(valg.midt ?? 0);
  const fall = Math.tan((clamp(fin(valg.fall ?? 0), -85, 85) * Math.PI) / 180);
  const a = fin(valg.amplitude ?? 0);
  const L = fin(valg.bolgelengde ?? 400);
  const kh = fin(valg.kuppel?.hoyde ?? 0);
  const kb = fin(valg.kuppel?.bredde ?? 0);
  return (x) => {
    const d = fin(x) - midt;
    let v = y + fall * d;
    if (a !== 0 && L > 0) v -= a * Math.cos((2 * Math.PI * d) / L);
    if (kh !== 0 && kb > 0) v -= kh * Math.exp(-((d / kb) ** 2) / 2);
    return v;
  };
}

/** Perspektivet i en Snittblokk: hvor langt bakkanten er forskjøvet (dx mot høyre, dy oppover) for en blokk. */
export function snittblokkPerspektiv(dybde?: number, vinkel?: number): { dx: number; dy: number } {
  const D = Math.max(0, fin(dybde ?? 70, 70));
  const a = (clamp(fin(vinkel ?? 34, 34), 0, 80) * Math.PI) / 180;
  return { dx: r2(D * Math.cos(a)), dy: r2(D * Math.sin(a)) };
}

/* =====================================================================================================================
 * Snittblokk: komponenten
 * ================================================================================================================== */

/** Det som dekker overflaten på toppen av blokka der det ikke er vann eller is. 'kart' viser berggrunnen som et geologisk kart. */
export type SnittMark = 'gress' | 'jord' | 'fjell' | 'sno' | 'kart';

/** En vannflate i snittet: vannet fyller det som ligger lavere enn `niva` mellom `fra` og `til`. */
export interface SnittVann {
  /** Vannflaten (y i snittets koordinater). */
  niva: number;
  /** X-området (standard hele blokka). */
  fra?: number;
  til?: number;
  /** 'vann' (innsjø, elv: ferskvann), 'hav' eller 'fjord' (sjøvann, mørkere). Standard 'vann'. */
  type?: 'vann' | 'hav' | 'fjord';
}

/** Is over bakken: en bre eller et isdekke med toppen `topp` (der toppen ligger over bakken). */
export interface SnittIs {
  topp: SnittKurve;
  fra?: number;
  til?: number;
}

/** Props til `Snittblokk`. */
export interface SnittblokkProps {
  /** Øverste venstre hjørne av snittet foran (snittets origo) i figurens koordinater. Standard (0, 0). */
  x?: number;
  y?: number;
  /** Bredden og bunnen av snittet foran (snittets koordinater går fra 0 til w og ned til h). */
  w: number;
  h: number;
  /** Lagene, eldste først. Bånd (`topp`/`bunn`) eller polygoner (`punkter`). */
  lag: readonly SnittLag[];
  /** Forkastninger som forskyver lagene (normal eller revers), i tidsrekkefølge. */
  forkastninger?: readonly SnittForkastning[];
  /**
   * Terrenget (y som tall eller funksjon av x). Standard: toppen av berggrunnen, så forkastninger gir en skrent og
   * folder et kupert landskap. Gi den når overflaten er erodert flat eller er en dal; da må det øverste laget gå opp
   * til den.
   */
  overflate?: SnittKurve;
  /** Hva som dekker bakken: 'gress' (standard), 'jord', 'fjell', 'sno' eller 'kart' (berggrunnskart), eller en funksjon av (x, y). */
  mark?: SnittMark | ((x: number, y: number) => SnittMark);
  /** Vann, hav eller fjord over bakken (én eller flere). */
  vann?: SnittVann | readonly SnittVann[];
  /** Isdekke eller bre over bakken. */
  is?: SnittIs;
  /** Hvor langt blokka går innover (lengden på bakkanten i figurens enheter). Standard ca. 0,14 · w (høyst 110). 0 gir bare snittet. */
  dybde?: number;
  /** Vinkelen på bakkanten (grader over vannrett). Standard 34. */
  vinkel?: number;
  /** Myk skygge under blokka. Standard på. */
  skygge?: boolean;
  /** Etiketter med lagnavnene i en kolonne til høyre for blokka (sett av ca. 140–200 enheter, mer på mobil). */
  etiketter?: boolean;
  /** Ton ned hele blokka. */
  dim?: boolean;
  /** Tegnes i snittets koordinater og klippes til berggrunnen i snittet: ganger, magmakammer, olje og gass, borehull. */
  children?: ReactNode;
  /** Tegnes oppå alt i snittets koordinater, uten klipping: piler, bokstaver, mål. */
  over?: ReactNode;
}

/** Det `useSnittblokk` gir til barna i en Snittblokk. */
export interface SnittblokkInfo {
  /** Id-en til mønstrene i blokka (til `<LagFlate monstre>` og `lagFyll(type, id)`). */
  monstre: string;
  w: number;
  h: number;
  /** Forskyvningen av bakkanten. */
  dx: number;
  dy: number;
  /** Bakken (y) ved x, i snittets koordinater. */
  overflate: Fn;
  /** Geologien (hvilket lag som er hvor). */
  geologi: SnittGeologi;
}

const SnittCtx = createContext<SnittblokkInfo | null>(null);

/** Informasjon om Snittblokka et barn er tegnet i (mønster-id, mål, overflate og geologi), eller null utenfor en Snittblokk. */
export function useSnittblokk(): SnittblokkInfo | null {
  return useContext(SnittCtx);
}

type Flate = { slag: 'mark'; mark: SnittMark; lag: number } | { slag: 'vann'; i: number } | { slag: 'is' };

function flateNokkel(fl: Flate): string {
  if (fl.slag === 'mark') return fl.mark === 'kart' ? `k${fl.lag}` : `m${fl.mark}`;
  if (fl.slag === 'vann') return `v${fl.i}`;
  return 'is';
}

interface Lop {
  fl: Flate;
  /** Punktene langs forkanten av toppflaten (snittets koordinater). */
  p: SnittPunkt[];
  /** Hellingstrinn −3 … 3 (positiv = belyst skråning). */
  q: number;
}

/** Fargen på toppflaten for et merke og et hellingstrinn. */
function markFarge(mark: SnittMark, q: number): string {
  const base =
    mark === 'gress' ? SCENE.grass : mark === 'jord' ? SCENE.soil : mark === 'sno' ? SCENE.snow : mark === 'fjell' ? SCENE.stone : SCENE.stone;
  if (q > 0) return tint(base, 0.07 * q);
  if (q < 0) return mark === 'sno' ? mix(base, SCENE.snowShade, 0.25 * -q) : shade(base, 0.065 * -q);
  return base;
}

/**
 * Blokkdiagram av berggrunnen: snittet foran, overflaten oppå i svakt perspektiv (gress, jord, fjell, snø eller et
 * geologisk kart, med vann, hav, fjord eller isdekke) og lagene videre på sideflaten til høyre, med lys ovenfra og myk
 * skygge. Lagene gis med det eldste først, som bånd (`topp`, `bunn`) eller polygoner; forkastninger og erosjonsflater
 * virker på lagene som var dannet da, så figuren følger prinsippene for relativ datering.
 *
 * Ankerpunkt: (x, y) er øverste venstre hjørne av snittet foran. Et punkt (sx, sy) i snittet står i (x + sx, y + sy) i
 * figuren; bakkanten er forskjøvet (dx, −dy) fra `snittblokkPerspektiv(dybde, vinkel)`. Barna tegnes i snittets
 * koordinater og klippes til berggrunnen (bruk `useSnittblokk()` for mønster-id og overflate), `over` tegnes oppå uten
 * klipping. Med `etiketter` står lagnavnene i en kolonne til høyre for blokka, fra x + w + dx + 18.
 *   <Snittblokk x={20} y={60} w={560} h={260} lag={[
 *     { type: 'gneis', topp: 200 },
 *     { type: 'sandstein', topp: lagflate(120, { fall: 8 }), erosjon: true, bunn: 200 },
 *     { type: 'leirskifer', topp: 60 },
 *   ]} forkastninger={[{ x: 330, sprang: 30 }]} vann={{ niva: 70, fra: 380 }} etiketter>
 *     <SnittGang fra={[140, 270]} til={[190, 0]} />
 *   </Snittblokk>
 */
export function Snittblokk({
  x = 0,
  y = 0,
  w: wInn,
  h: hInn,
  lag,
  forkastninger = [],
  overflate,
  mark = 'gress',
  vann,
  is,
  dybde,
  vinkel,
  skygge = true,
  etiketter = false,
  dim,
  children,
  over,
}: SnittblokkProps) {
  const monstre = useLagMonstre('snitt');
  const uid = useSvgId('snittblokk');
  const s = useGeoStroke();
  const k = useGeoScale();
  const w = Math.max(10, fin(wInn, 400));
  const h = Math.max(10, fin(hInn, 240));
  const { dx, dy } = snittblokkPerspektiv(dybde ?? Math.min(110, 0.14 * w), vinkel);
  const D = Math.hypot(dx, dy);
  const geo = snittGeologi(lag, forkastninger, h);
  const fk = lagForkastninger(forkastninger, lag.length);
  const M = geo.margin;

  /* ---------- Bakken: gitt overflate eller toppen av berggrunnen ---------- */
  const xsBakke = linspace(0, w, Math.min(240, Math.ceil(w / 4)));
  const gittBakke = tilFn(overflate);
  let bakkeY: number[];
  if (gittBakke) bakkeY = xsBakke.map((sx) => gittBakke(sx));
  else {
    const start = toppStart(geo, w, h);
    bakkeY = xsBakke.map((sx) => bergTopp(geo, sx, start, h));
  }
  const bakke: Fn = (sx) => interp(xsBakke, bakkeY, sx);

  /* ---------- Vann og is ---------- */
  const vannListe = (vann === undefined ? [] : Array.isArray(vann) ? (vann as readonly SnittVann[]) : [vann as SnittVann]).filter((v) =>
    Number.isFinite(v.niva),
  );
  const isTopp = is ? tilFn(is.topp) : null;
  const isFra = fin(is?.fra ?? -BIG, -BIG);
  const isTil = fin(is?.til ?? BIG, BIG);
  const isTykk = (sx: number) => (isTopp && sx >= isFra && sx <= isTil ? bakke(sx) - isTopp(sx) : 0);
  const vannVed = (sx: number): number => {
    for (let i = 0; i < vannListe.length; i++) {
      const v = vannListe[i]!;
      if (sx >= fin(v.fra ?? -BIG, -BIG) && sx <= fin(v.til ?? BIG, BIG) && bakke(sx) > v.niva) return i;
    }
    return -1;
  };
  const markVed = (sx: number, sy: number): SnittMark => (typeof mark === 'function' ? mark(sx, sy) : mark);
  const flateVed = (sx: number): Flate => {
    if (isTykk(sx) > 0.3) return { slag: 'is' };
    const vi = vannVed(sx);
    if (vi >= 0) return { slag: 'vann', i: vi };
    const g = bakke(sx);
    const m = markVed(sx, g);
    return { slag: 'mark', mark: m, lag: m === 'kart' ? geo.lagVed(sx, g + 1.5) : -1 };
  };
  /** Den øverste flaten (bakke, vann eller is) ved x. */
  const toppVed = (sx: number): number => {
    let t = bakke(sx);
    const vi = vannVed(sx);
    if (vi >= 0) t = Math.min(t, vannListe[vi]!.niva);
    if (isTopp && isTykk(sx) > 0) t = Math.min(t, isTopp(sx));
    return t;
  };

  /* ---------- Toppflaten som løp av like flater, med grenser funnet nøyaktig ---------- */
  const grenser: number[] = [0];
  let forrigeN = flateNokkel(flateVed(0));
  for (let i = 1; i < xsBakke.length; i++) {
    const sx = xsBakke[i]!;
    const n = flateNokkel(flateVed(sx));
    if (n !== forrigeN) {
      let a = xsBakke[i - 1]!;
      let b = sx;
      for (let it = 0; it < 14; it++) {
        const m = (a + b) / 2;
        if (flateNokkel(flateVed(m)) === forrigeN) a = m;
        else b = m;
      }
      grenser.push((a + b) / 2);
      forrigeN = n;
    }
  }
  grenser.push(w);
  const lop: Lop[] = [];
  for (let g = 0; g < grenser.length - 1; g++) {
    const a = grenser[g]!;
    const b = grenser[g + 1]!;
    if (!(b > a)) continue;
    const fl = flateVed((a + b) / 2);
    const xs = [a, ...xsBakke.filter((sx) => sx > a + 0.05 && sx < b - 0.05), b];
    const p: SnittPunkt[] = xs.map((sx) => [sx, toppVed(sx)]);
    if (fl.slag === 'vann') {
      lop.push({ fl, p, q: 0 });
      continue;
    }
    // Del opp etter helling (lys fra venstre): stigende mot høyre er belyst
    let start = 0;
    let qForrige = hellingTrinn(p[0]!, p[1] ?? p[0]!);
    for (let i = 1; i < p.length - 1; i++) {
      const q = hellingTrinn(p[i]!, p[i + 1]!);
      if (q !== qForrige) {
        lop.push({ fl, p: p.slice(start, i + 1), q: qForrige });
        start = i;
        qForrige = q;
      }
    }
    lop.push({ fl, p: p.slice(start), q: qForrige });
  }
  const toppLinje: SnittPunkt[] = linspace(0, w, Math.min(300, Math.ceil(w / 3))).map((sx) => [sx, toppVed(sx)]);
  for (const gx of grenser) toppLinje.push([gx, toppVed(gx)]);
  toppLinje.sort((a, b) => a[0] - b[0]);
  const t0 = toppVed(0);
  const tw = toppVed(w);
  const harPerspektiv = D > 0.5 && dy > 0.5;
  // Mønsteret på toppflaten (kart) legges flatt med en skjæring: (a, b) → (a + kx · b, ky · b)
  const kx = harPerspektiv ? dx / D : 0;
  const ky = harPerspektiv ? -dy / D : 1;
  const inv = ([X, Y]: SnittPunkt): SnittPunkt => [X - (kx * Y) / ky, Y / ky];

  /* ---------- Sideflaten ved x = w ---------- */
  type Felt = { y0: number; y1: number; slag: 'lag'; i: number } | { y0: number; y1: number; slag: 'vann'; i: number } | { y0: number; y1: number; slag: 'is' };
  const side: Felt[] = [];
  const gw = bakke(w);
  if (isTopp && isTykk(w) > 0) side.push({ y0: isTopp(w), y1: gw, slag: 'is' });
  else {
    const vi = vannVed(w);
    if (vi >= 0) side.push({ y0: vannListe[vi]!.niva, y1: gw, slag: 'vann', i: vi });
  }
  side.push(...bergFelt(geo, w, gw, h));
  // Bergfeltene for etikettene (der laget når sideflaten)
  const ankre = etiketter ? etikettAnkre(geo, lag, side, w, h, bakke, dx, dy) : [];

  /* ---------- Klipping og fyll ---------- */
  const bergSti = sti([...xsBakke.map((sx, i): SnittPunkt => [sx, bakkeY[i]!]), [w, h], [0, h]], true);
  const frontSti = sti([...toppLinje, [w, h], [0, h]], true);
  const defs: ReactNode[] = [];
  const innhold = byggGeologi(geo, lag, fk, { uid, monstre: monstre.id, w, h, M, s, k, defs });

  const lysId = `${uid}-lys`;
  const sideLysId = `${uid}-sidelys`;
  const kontur = monstre.kontur;
  const info: SnittblokkInfo = { monstre: monstre.id, w, h, dx, dy, overflate: bakke, geologi: geo };

  return (
    <SnittCtx.Provider value={info}>
      <g transform={`translate(${r2(fin(x))} ${r2(fin(y))})`} opacity={dim ? 0.4 : undefined}>
        <LagMonstre id={monstre.id} />
        <defs>
          <clipPath id={`${uid}-berg`}>
            <path d={bergSti} />
          </clipPath>
          {defs}
        </defs>
        <LinearGradient
          id={lysId}
          x2={0.3}
          y2={1}
          stops={[
            [0, SCENE.highlight, 0.42],
            [0.4, SCENE.highlight, 0],
            [1, SCENE.shadow, 0.55],
          ]}
        />
        <LinearGradient
          id={sideLysId}
          x2={1}
          y2={0}
          stops={[
            [0, SCENE.shadow, 0.75],
            [1, SCENE.shadow, 1],
          ]}
        />
        {skygge && <ContactShadow cx={(w + dx) / 2} cy={h - dy / 2 + 3} rx={(w + dx) / 2 + 8} ry={Math.max(6, dy / 2 + 7)} opacity={0.75} />}

        {/* ---------- Toppflaten (fra venstre mot høyre, så det nærmeste dekker det bakerste) ---------- */}
        {harPerspektiv &&
          lop.map((l, i) => {
            const bak = [...l.p].reverse().map(([px, py]): SnittPunkt => [px + dx, py - dy]);
            const poly = [...l.p, ...bak];
            const d = sti(poly, true);
            // Bakkanten tegnes med løpet, så nærmere løp (lenger til høyre) dekker det som er skjult
            const kant = (
              <path
                d={sti(i === 0 ? [[0, l.p[0]![1]], ...bak.slice().reverse()] : bak.slice().reverse())}
                fill="none"
                stroke={SCENE.outline}
                strokeWidth={1.2 * s}
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            );
            if (l.fl.slag === 'mark' && l.fl.mark === 'kart') {
              const lagType = lag[l.fl.lag]?.type;
              const fyll = lagType ? lagFyll(lagType, monstre.id).fill : SCENE.stone;
              return (
                <g key={`t${i}`}>
                  <g transform={`matrix(1 0 ${r2(kx)} ${r2(ky)} 0 0)`}>
                    <path d={sti(poly.map(inv), true)} fill={fyll} stroke={fyll} strokeWidth={0.8} strokeLinejoin="round" />
                  </g>
                  <path d={d} fill={l.q > 0 ? SCENE.highlight : SCENE.shadow} opacity={l.q > 0 ? 0.25 + 0.1 * l.q : 0.1 * -l.q} />
                  {kant}
                </g>
              );
            }
            const fyll =
              l.fl.slag === 'vann'
                ? vannListe[l.fl.i]?.type === 'hav' || vannListe[l.fl.i]?.type === 'fjord'
                  ? mix(SCENE.water, SCENE.waterLight, 0.25)
                  : mix(SCENE.water, SCENE.waterLight, 0.55)
                : l.fl.slag === 'is'
                  ? markFarge('sno', l.q)
                  : markFarge(l.fl.mark, l.q);
            return (
              <g key={`t${i}`}>
                <path d={d} fill={fyll} stroke={fyll} strokeWidth={0.8} strokeLinejoin="round" />
                {kant}
              </g>
            );
          })}
        {/* Lysstriper på vannflatene og spor av forkastninger på toppen */}
        {harPerspektiv &&
          lop
            .filter((l) => l.fl.slag === 'vann')
            .map((l, i) => {
              const a = l.p[0]!;
              const b = l.p[l.p.length - 1]!;
              const bred = b[0] - a[0];
              if (bred < 30) return null;
              return (
                <g key={`vl${i}`} stroke={SCENE.highlight} strokeLinecap="round" fill="none">
                  {[0.3, 0.62].map((t, j) => (
                    <line
                      key={j}
                      x1={r2(a[0] + t * dx + bred * (0.12 + 0.1 * j))}
                      y1={r2(a[1] - t * dy)}
                      x2={r2(b[0] + t * dx - bred * (0.18 + 0.08 * j))}
                      y2={r2(a[1] - t * dy)}
                      strokeWidth={1.4 * s}
                      opacity={0.9 - 0.3 * j}
                    />
                  ))}
                </g>
              );
            })}
        {harPerspektiv && forkastningsspor(fk, lag.length, toppVed, w).map((tx, i) => (
          <line
            key={`fs${i}`}
            x1={r2(tx)}
            y1={r2(toppVed(tx))}
            x2={r2(tx + dx)}
            y2={r2(toppVed(tx) - dy)}
            stroke={VIZ.ink}
            strokeWidth={2.2 * s}
            strokeLinecap="round"
            opacity={0.85}
          />
        ))}

        {/* ---------- Sideflaten (i skygge), med mønstrene lagt langs flaten ---------- */}
        {harPerspektiv && (
          <g>
            <g transform={`matrix(${r2(dx / D)} ${r2(-dy / D)} 0 1 ${r2(w)} 0)`}>
              {side.map((f, i) => {
                const fyll =
                  f.slag === 'lag'
                    ? lagFyll(lag[f.i]!.type, monstre.id).fill
                    : f.slag === 'vann'
                      ? vannListe[f.i]?.type === 'vann'
                        ? SCENE.water
                        : SCENE.waterDeep
                      : GEO.bre.fill;
                return (
                  <rect key={i} x={0} y={r2(f.y0)} width={r2(D)} height={r2(Math.max(0, f.y1 - f.y0))} fill={fyll} stroke={fyll} strokeWidth={0.6} />
                );
              })}
              <rect x={0} y={r2(tw)} width={r2(D)} height={r2(Math.max(0, h - tw))} fill={`url(#${sideLysId})`} />
              {side.slice(1).map((f, i) => (
                <line
                  key={`g${i}`}
                  x1={0}
                  x2={r2(D)}
                  y1={r2(f.y0)}
                  y2={r2(f.y0)}
                  stroke={f.slag === 'lag' ? GEO.bergart[lag[f.i]!.type].line : GEO.bre.line}
                  strokeWidth={kontur * 0.9}
                />
              ))}
            </g>
          </g>
        )}

        {/* ---------- Snittet foran: vann, is, berggrunn ---------- */}
        {vannListe.map((v, i) => {
          const a = clamp(fin(v.fra ?? 0), 0, w);
          const b = clamp(fin(v.til ?? w), 0, w);
          if (!(b > a) || v.niva >= h) return null;
          const gid = `${uid}-v${i}`;
          const hav = v.type === 'hav' || v.type === 'fjord';
          return (
            <g key={`v${i}`}>
              <LinearGradient
                id={gid}
                stops={
                  hav
                    ? [
                        [0, SCENE.water],
                        [0.5, SCENE.waterDeep],
                        [1, shade(SCENE.waterDeep, 0.35)],
                      ]
                    : [
                        [0, SCENE.waterLight],
                        [0.6, SCENE.water],
                        [1, SCENE.waterDeep],
                      ]
                }
              />
              <rect x={r2(a)} y={r2(v.niva)} width={r2(b - a)} height={r2(h - v.niva)} fill={`url(#${gid})`} />
              <line x1={r2(a)} x2={r2(b)} y1={r2(v.niva)} y2={r2(v.niva)} stroke={SCENE.waterLight} strokeWidth={1.6 * s} />
            </g>
          );
        })}
        {isTopp && <IsSnitt uid={uid} xs={xsBakke} bakke={bakke} isTopp={isTopp} tykk={isTykk} s={s} />}
        <path d={bergSti} fill={mix(SCENE.stone, SCENE.stoneDark, 0.5)} />
        <g clipPath={`url(#${uid}-berg)`}>{innhold}</g>
        <path d={frontSti} fill={`url(#${lysId})`} />
        <g clipPath={`url(#${uid}-berg)`}>{children}</g>

        {/* ---------- Kantene ---------- */}
        <Markkant toppLinje={toppLinje} flateVed={flateVed} s={s} />
        <g fill="none" stroke={SCENE.outline} strokeWidth={1.2 * s} strokeLinejoin="round" strokeLinecap="round">
          <path d={`M0 ${r2(t0)}L0 ${r2(h)}L${r2(w)} ${r2(h)}L${r2(w)} ${r2(tw)}`} />
          {harPerspektiv && <path d={`M${r2(w)} ${r2(tw)}l${r2(dx)} ${r2(-dy)}V${r2(h - dy)}L${r2(w)} ${r2(h)}`} />}
          <path d={sti(toppLinje)} strokeWidth={0.9 * s} opacity={0.7} />
        </g>
        {over}
        {etiketter && ankre.length > 0 && (
          <SnittEtiketter
            x={w + dx + 18}
            topp={Math.min(...toppLinje.map((p) => p[1])) - dy}
            bunn={h}
            etiketter={ankre}
          />
        )}
      </g>
    </SnittCtx.Provider>
  );
}

function hellingTrinn(a: SnittPunkt, b: SnittPunkt): number {
  const ddx = b[0] - a[0];
  if (!(Math.abs(ddx) > 1e-6)) return 0;
  const v = Math.atan((b[1] - a[1]) / ddx); // positiv = faller mot høyre (vender bort fra lyset)
  return clamp(Math.round((-v / (Math.PI / 4)) * 3), -3, 3);
}

function interp(xs: readonly number[], ys: readonly number[], x: number): number {
  const n = xs.length;
  if (n === 0) return 0;
  if (!(x > xs[0]!)) return ys[0]!;
  if (!(x < xs[n - 1]!)) return ys[n - 1]!;
  let lo = 0;
  let hi = n - 1;
  while (hi - lo > 1) {
    const m = (lo + hi) >> 1;
    if (xs[m]! <= x) lo = m;
    else hi = m;
  }
  const t = (x - xs[lo]!) / (xs[hi]! - xs[lo]! || 1);
  return ys[lo]! + t * (ys[hi]! - ys[lo]!);
}

/** Der skanningen etter toppen av berggrunnen starter (over alle lag, også etter forkastninger). */
function toppStart(geo: SnittGeologi, w: number, h: number): number {
  let min = 0;
  for (let i = 0; i < geo.topp.length; i++) {
    const t = geo.topp[i];
    if (t) for (const sx of linspace(-geo.margin, w + geo.margin, 24)) min = Math.min(min, t(sx));
    const p = geo.polygoner[i];
    if (p) for (const [, py] of p) min = Math.min(min, py);
  }
  const loft = geo.forkastninger.reduce((sum, f) => sum + Math.abs(f.vy), 0);
  return Math.max(-4 * h, min - loft - 4);
}

/**
 * Toppen av berggrunnen ved x: det laveste punktet med luft over sammenhengende bergart, søkt nedenfra (grovt, så
 * halvering). Et overheng (reversforkastning) blir da erodert bort i stedet for å gi et hull under bakken. Gir y1 når
 * det ikke er bergart i bunnen.
 */
function bergTopp(geo: SnittGeologi, x: number, y0: number, y1: number): number {
  const steg = 3;
  const bunn = y1 - 0.01;
  if (geo.lagVed(x, bunn) < 0) return y1;
  let forrige = bunn;
  for (let yy = bunn - steg; yy >= y0 - steg; yy -= steg) {
    if (geo.lagVed(x, yy) < 0) {
      let a = yy;
      let b = forrige;
      for (let i = 0; i < 12; i++) {
        const m = (a + b) / 2;
        if (geo.lagVed(x, m) < 0) a = m;
        else b = m;
      }
      return b;
    }
    forrige = yy;
  }
  return y0;
}

/** Lagene langs en loddrett linje ved x fra y0 til y1, som sammenhengende felt med nøyaktige grenser. */
function bergFelt(geo: SnittGeologi, x: number, y0: number, y1: number): { y0: number; y1: number; slag: 'lag'; i: number }[] {
  const out: { y0: number; y1: number; slag: 'lag'; i: number }[] = [];
  if (!(y1 > y0)) return out;
  const steg = 2;
  let start = y0;
  let cur = geo.lagVed(x, y0 + 0.01);
  for (let yy = y0 + steg; yy < y1 + steg; yy += steg) {
    const yc = Math.min(yy, y1 - 0.01);
    const n = geo.lagVed(x, yc);
    if (n !== cur) {
      let a = yy - steg;
      let b = yc;
      for (let i = 0; i < 12; i++) {
        const m = (a + b) / 2;
        if (geo.lagVed(x, m) === cur) a = m;
        else b = m;
      }
      if (cur >= 0) out.push({ y0: start, y1: b, slag: 'lag', i: cur });
      start = b;
      cur = n;
    }
    if (yc >= y1 - 0.01) break;
  }
  if (cur >= 0) out.push({ y0: start, y1, slag: 'lag', i: cur });
  return out;
}

/** Ankerpunkter for etikettene: på sideflaten der laget når den, ellers der laget er tykkest i snittet foran. */
function etikettAnkre(
  geo: SnittGeologi,
  lag: readonly SnittLag[],
  side: readonly { y0: number; y1: number; slag: string; i?: number }[],
  w: number,
  h: number,
  bakke: Fn,
  dx: number,
  dy: number,
): SnittEtikett[] {
  const out: SnittEtikett[] = [];
  lag.forEach((l, i) => {
    const tekst = l.navn ?? MONSTER_NAVN[l.type];
    const etikett = { tekst, undertekst: l.undertekst, uthevet: l.uthevet, dim: l.dim };
    // Det tykkeste feltet på sideflaten
    let best: { y0: number; y1: number } | null = null;
    for (const f of side) if (f.slag === 'lag' && f.i === i && (!best || f.y1 - f.y0 > best.y1 - best.y0)) best = f;
    if (best && best.y1 - best.y0 >= 5 && dx > 4) {
      const t = 0.55;
      out.push({ ...etikett, x: w + t * dx, y: (best.y0 + best.y1) / 2 - t * dy });
      return;
    }
    // Ellers: lengste loddrette strekning i snittet foran, helst til høyre
    let ankre: { x: number; y: number; len: number } | null = null;
    for (const fx of [0.92, 0.8, 0.68, 0.56, 0.44, 0.32, 0.2, 0.08]) {
      const sx = fx * w;
      for (const f of bergFelt(geo, sx, bakke(sx), h)) {
        if (f.i !== i) continue;
        const len = f.y1 - f.y0;
        if (!ankre || len > ankre.len * 1.25) ankre = { x: sx, y: (f.y0 + f.y1) / 2, len };
      }
    }
    if (ankre && ankre.len >= 3) out.push({ ...etikett, x: ankre.x, y: ankre.y });
  });
  return out;
}

/** Der forkastningene (de siste hendelsene) skjærer overflaten, til sporene på toppflaten. */
function forkastningsspor(fk: readonly Forkastning[], n: number, toppVed: Fn, w: number): number[] {
  const out: number[] = [];
  fk.forEach((f) => {
    if (f.antall < n) return;
    const xs = linspace(0, w, 160);
    for (let i = 1; i < xs.length; i++) {
      const a = xs[i - 1]!;
      const b = xs[i]!;
      if (iHengblokk(f, a, toppVed(a) + 0.5) !== iHengblokk(f, b, toppVed(b) + 0.5)) {
        out.push((a + b) / 2);
        break;
      }
    }
  });
  return out;
}

interface ByggValg {
  uid: string;
  monstre: string;
  w: number;
  h: number;
  M: number;
  s: number;
  k: number;
  defs: ReactNode[];
}

/** Lagene, erosjonsflatene og forkastningene som SVG i tidsrekkefølge (klippestiene legges i `defs`). */
function byggGeologi(geo: SnittGeologi, lag: readonly SnittLag[], fk: readonly Forkastning[], v: ByggValg): ReactNode {
  const { uid, monstre, w, h, M, s, k, defs } = v;
  const xs = linspace(-M, w + M, Math.min(220, Math.ceil((w + 2 * M) / 5)));
  const kontur = Math.round(1.3 * s * 100) / 100;
  let innhold: ReactNode[] = [];
  const hend = hendelser(
    lag,
    fk,
    geo.bunn.map((b) => b !== null),
  );
  hend.forEach((ev, e) => {
    if (ev.k === 'lag') {
      const l = lag[ev.i]!;
      const fyll = lagFyll(l.type, monstre);
      const p = geo.polygoner[ev.i];
      const t = geo.topp[ev.i];
      const b = geo.bunn[ev.i];
      let d = '';
      if (p) d = sti(p, true);
      else if (t && b) {
        const topp = xs.map((sx): SnittPunkt => [sx, Math.min(t(sx), b(sx))]);
        const bunn = [...xs].reverse().map((sx): SnittPunkt => [sx, b(sx)]);
        d = sti([...topp, ...bunn], true);
      }
      if (!d) return;
      innhold.push(
        <g key={`l${e}`} opacity={l.dim ? 0.35 : undefined}>
          <path d={d} fill={fyll.fill} stroke={l.uthevet ? VIZ.ink : fyll.stroke} strokeWidth={l.uthevet ? 2.6 * s : kontur} strokeLinejoin="round" />
          {l.erosjon && b && <path d={sti(xs.map((sx): SnittPunkt => [sx, b(sx)]))} fill="none" stroke={VIZ.ink} strokeWidth={2.4 * s} strokeLinejoin="round" opacity={0.8} />}
        </g>,
      );
    } else if (ev.k === 'erosjon') {
      const b = geo.bunn[ev.i];
      if (!b) return;
      const id = `${uid}-e${e}`;
      defs.push(
        <clipPath key={id} id={id}>
          <path d={sti([...xs.map((sx): SnittPunkt => [sx, b(sx)]), [w + M, BIG], [-M, BIG]], true)} />
        </clipPath>,
      );
      innhold = [
        <g key={`e${e}`} clipPath={`url(#${id})`}>
          {innhold}
        </g>,
      ];
    } else {
      const f = fk[ev.j]!;
      const xPlan = (yy: number) => f.x0 + f.dir * (yy - f.y0) * f.cot;
      const A: SnittPunkt = [xPlan(-BIG), -BIG];
      const B: SnittPunkt = [xPlan(BIG), BIG];
      const ut = 4 * BIG * (1 + f.cot);
      const heng = sti([A, B, [B[0] + f.dir * ut, B[1]], [A[0] + f.dir * ut, A[1]]], true);
      const ligg = sti([A, B, [B[0] - f.dir * ut, B[1]], [A[0] - f.dir * ut, A[1]]], true);
      const idH = `${uid}-fh${e}`;
      const idL = `${uid}-fl${e}`;
      defs.push(
        <clipPath key={idH} id={idH}>
          <path d={heng} />
        </clipPath>,
        <clipPath key={idL} id={idL}>
          <path d={ligg} />
        </clipPath>,
      );
      innhold = [
        <g key={`f${e}`}>
          <g clipPath={`url(#${idL})`}>{innhold}</g>
          <g clipPath={`url(#${idH})`}>
            <g transform={`translate(${r2(f.vx)} ${r2(f.vy)})`}>{innhold}</g>
          </g>
          <line x1={r2(xPlan(-h))} y1={-h} x2={r2(xPlan(2 * h))} y2={2 * h} stroke={VIZ.ink} strokeWidth={2.4 * s} strokeLinecap="round" />
          {f.piler && f.sprang !== 0 && <Halvpiler f={f} h={h} s={s} k={k} />}
        </g>,
      ];
    }
  });
  return innhold;
}

/** Halvpiler på hver side av forkastningsplanet som viser hvordan blokkene har beveget seg. */
function Halvpiler({ f, h, s, k }: { f: Forkastning; h: number; s: number; k: number }) {
  const rad = (f.fall * Math.PI) / 180;
  const ux = f.dir * Math.cos(rad);
  const uy = Math.sin(rad);
  const nx = f.dir * Math.sin(rad);
  const ny = -Math.cos(rad);
  const ym = f.y0 + 0.62 * (h - f.y0);
  const px = f.x0 + f.dir * (ym - f.y0) * f.cot;
  const L = 22 * k;
  const off = 8 * k;
  const pil = (side: 1 | -1) => {
    const retning = Math.sign(f.sprang) * side; // hengblokka (+1) i bevegelsesretningen
    const cx = px + side * nx * off;
    const cy = ym + side * ny * off;
    const ax = cx - (retning * ux * L) / 2;
    const ay = cy - (retning * uy * L) / 2;
    const bx = cx + (retning * ux * L) / 2;
    const by = cy + (retning * uy * L) / 2;
    // Mothake på siden bort fra planet
    const hx = bx - retning * ux * 7 * k + side * nx * 5 * k;
    const hy = by - retning * uy * 7 * k + side * ny * 5 * k;
    return `M${r2(ax)} ${r2(ay)}L${r2(bx)} ${r2(by)}L${r2(hx)} ${r2(hy)}`;
  };
  return (
    <g fill="none" strokeLinecap="round" strokeLinejoin="round">
      <path d={`${pil(1)}${pil(-1)}`} stroke={VIZ.surface} strokeWidth={4.2 * s} opacity={0.85} />
      <path d={`${pil(1)}${pil(-1)}`} stroke={VIZ.ink} strokeWidth={1.8 * s} />
    </g>
  );
}

/** Isen i snittet foran: lys blå is med svake lag parallelt med bunnen. */
function IsSnitt({ uid, xs, bakke, isTopp, tykk, s }: { uid: string; xs: readonly number[]; bakke: Fn; isTopp: Fn; tykk: Fn; s: number }) {
  // Sammenhengende strekninger med is, med kantene funnet ved interpolasjon
  const biter: SnittPunkt[][] = [];
  let cur: number[] | null = null;
  for (let i = 0; i < xs.length; i++) {
    const sx = xs[i]!;
    const t = tykk(sx);
    if (t > 0) {
      if (!cur) {
        cur = [];
        const forrige = xs[i - 1];
        if (forrige !== undefined) {
          const tf = tykk(forrige);
          cur.push(forrige + ((sx - forrige) * -tf) / (t - tf || 1));
        }
      }
      cur.push(sx);
    } else if (cur) {
      const forrige = xs[i - 1]!;
      const tf = tykk(forrige);
      cur.push(forrige + ((sx - forrige) * tf) / (tf - t || 1));
      biter.push(cur.map((v): SnittPunkt => [v, 0]));
      cur = null;
    }
  }
  if (cur) biter.push(cur.map((v): SnittPunkt => [v, 0]));
  const gid = `${uid}-is`;
  return (
    <g>
      <LinearGradient
        id={gid}
        stops={[
          [0, tint(GEO.bre.fill, 0.15)],
          [0.6, GEO.bre.fill],
          [1, shade(GEO.bre.fill, 0.12)],
        ]}
      />
      {biter.map((b, i) => {
        const bx = b.map((p) => p[0]);
        const topp = bx.map((sx): SnittPunkt => [sx, Math.min(isTopp(sx), bakke(sx))]);
        const bunn = [...bx].reverse().map((sx): SnittPunkt => [sx, bakke(sx)]);
        const band = (t: number) => sti(bx.map((sx): SnittPunkt => [sx, bakke(sx) - t * Math.max(0, tykk(sx))]));
        return (
          <g key={i}>
            <path d={sti([...topp, ...bunn], true)} fill={`url(#${gid})`} stroke={GEO.bre.line} strokeWidth={1.3 * s} strokeLinejoin="round" />
            <path d={`${band(0.3)}${band(0.6)}`} fill="none" stroke={GEO.bre.line} strokeWidth={0.9 * s} opacity={0.45} />
          </g>
        );
      })}
    </g>
  );
}

/** Gress-, jord- eller snøkanten langs forkanten av toppflaten. */
function Markkant({ toppLinje, flateVed, s }: { toppLinje: readonly SnittPunkt[]; flateVed: (x: number) => Flate; s: number }) {
  const biter: { mark: SnittMark; p: SnittPunkt[] }[] = [];
  for (let i = 0; i < toppLinje.length - 1; i++) {
    const a = toppLinje[i]!;
    const b = toppLinje[i + 1]!;
    const fl = flateVed((a[0] + b[0]) / 2);
    const m: SnittMark | null = fl.slag === 'mark' ? fl.mark : fl.slag === 'is' ? 'sno' : null;
    if (!m || m === 'kart' || m === 'fjell') continue;
    const siste = biter[biter.length - 1];
    if (siste && siste.mark === m && siste.p[siste.p.length - 1] === a) siste.p.push(b);
    else biter.push({ mark: m, p: [a, b] });
  }
  return (
    <g fill="none" strokeLinecap="round" strokeLinejoin="round">
      {biter.map((b, i) => (
        <path
          key={i}
          d={sti(b.p)}
          stroke={b.mark === 'gress' ? SCENE.grassDark : b.mark === 'sno' ? SCENE.snow : SCENE.soilDark}
          strokeWidth={(b.mark === 'sno' ? 3.6 : 3.2) * s}
        />
      ))}
    </g>
  );
}

/* =====================================================================================================================
 * Barn i Snittblokka: gang og magmakammer
 * ================================================================================================================== */

/** Props til `SnittGang`. */
export interface SnittGangProps {
  /** Endepunktene til midtlinja (snittets koordinater). Gangen går fra `fra` til `til`. */
  fra: SnittPunkt;
  til: SnittPunkt;
  /** Bredden (standard 12). */
  bredde?: number;
  /** Bergarten (standard 'diabas'). */
  type?: MonsterId;
  /** Fortsatt smeltet: tegnes som magma i stedet for bergart. */
  smelte?: boolean;
  /** Frø til de ujevne kantene. */
  seed?: number;
  dim?: boolean;
}

/**
 * Gang (loddrett eller skrå) eller lagergang (vannrett) som skjærer gjennom lagene i en Snittblokk: et bånd med litt
 * ujevne kanter og avkjølt rand (mørkere kant), fylt med bergartsmønsteret eller som smeltet magma. Tegnes som barn av
 * Snittblokk (snittets koordinater, klippes til berggrunnen); utenfor en Snittblokk tegner den sine egne mønstre.
 *   <SnittGang fra={[180, 300]} til={[230, 0]} bredde={14} />      // gang til overflaten
 *   <SnittGang fra={[60, 160]} til={[420, 150]} type="gabbro" />   // lagergang
 */
export function SnittGang({ fra, til, bredde = 12, type = 'diabas', smelte, seed = 3, dim }: SnittGangProps) {
  const ctx = useSnittblokk();
  const egne = useLagMonstre('gang');
  const s = useGeoStroke();
  const gid = useSvgId('gangmagma');
  const [x1, y1] = fra;
  const [x2, y2] = til;
  const L = Math.hypot(x2 - x1, y2 - y1);
  const b = Math.max(1, fin(bredde, 12));
  if (!(L > 0) || !Number.isFinite(L)) return null;
  const ux = (x2 - x1) / L;
  const uy = (y2 - y1) / L;
  const nx = -uy;
  const ny = ux;
  const rnd = sceneRandom(seed);
  const n = Math.max(4, Math.round(L / 18));
  const venstre: SnittPunkt[] = [];
  const hoyre: SnittPunkt[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const cx = x1 + (x2 - x1) * t;
    const cy = y1 + (y2 - y1) * t;
    const a = (b / 2) * (1 + 0.16 * (rnd() - 0.5));
    const c = (b / 2) * (1 + 0.16 * (rnd() - 0.5));
    venstre.push([cx + nx * a, cy + ny * a]);
    hoyre.push([cx - nx * c, cy - ny * c]);
  }
  const d = sti([...venstre, ...hoyre.reverse()], true);
  const id = ctx?.monstre ?? egne.id;
  const fyll = lagFyll(type, id);
  return (
    <g opacity={dim ? 0.38 : undefined}>
      {!ctx && <LagMonstre id={egne.id} bare={[type]} />}
      {smelte && (
        <LinearGradient
          id={gid}
          x1={0.5 - nx / 2}
          y1={0.5 - ny / 2}
          x2={0.5 + nx / 2}
          y2={0.5 + ny / 2}
          stops={[
            [0, GEO.magma.fill],
            [0.5, mix(GEO.magma.fill, GEO.lava.fill, 0.5)],
            [1, GEO.magma.fill],
          ]}
        />
      )}
      <path d={d} fill={smelte ? `url(#${gid})` : fyll.fill} />
      <path d={d} fill="none" stroke={smelte ? GEO.magma.line : shade(fyll.stroke, 0.25)} strokeWidth={1.9 * s} strokeLinejoin="round" />
    </g>
  );
}

/** Props til `SnittMagmakammer`. */
export interface SnittMagmakammerProps {
  /** Midten og halvaksene (snittets koordinater). */
  x: number;
  y: number;
  rx: number;
  ry: number;
  /** Tilførselskanal ned til bunnen av snittet (fra mantelen). Standard på. */
  tilforsel?: boolean;
  /** Kanal opp til overflaten ved denne x-en (vulkan eller sprekk), eller ingen. */
  kanal?: number;
  /** Størknet til en dypbergart (pluton): bergartsmønsteret i stedet for glødende magma ('granitt' når true). */
  stivnet?: boolean | MonsterId;
  /** Frø til den ujevne formen. */
  seed?: number;
  dim?: boolean;
}

/**
 * Magmakammer i en Snittblokk: en ujevn, glødende linse (varmest i midten) med tilførselskanal nedenfra og valgfri kanal
 * opp til overflaten, eller en størknet pluton med bergartsmønster (`stivnet`). Ingen filtre: gløden er en radiell
 * toning. Ankerpunkt: (x, y) er midten av kammeret, i snittets koordinater.
 *   <SnittMagmakammer x={300} y={230} rx={90} ry={34} kanal={330} />
 *   <SnittMagmakammer x={300} y={230} rx={90} ry={40} stivnet="granitt" tilforsel={false} />
 */
export function SnittMagmakammer({ x, y, rx, ry, tilforsel = true, kanal, stivnet, seed = 5, dim }: SnittMagmakammerProps) {
  const ctx = useSnittblokk();
  const egne = useLagMonstre('kammer');
  const s = useGeoStroke();
  const gid = useSvgId('kammer');
  const kid = useSvgId('kanal');
  if (![x, y, rx, ry].every(Number.isFinite) || !(rx > 0) || !(ry > 0)) return null;
  const rnd = sceneRandom(seed);
  const n = 12;
  const pts: SnittPunkt[] = Array.from({ length: n }, (_, i) => {
    const a = (2 * Math.PI * i) / n;
    const r = 1 + 0.14 * (rnd() - 0.5) + (Math.sin(a) > 0 ? 0.06 : -0.04);
    return [x + rx * r * Math.cos(a), y + ry * r * Math.sin(a) * (Math.sin(a) < 0 ? 0.85 : 1.05)];
  });
  const d = glattLukket(pts);
  const bunnY = ctx ? ctx.h + 10 : y + ry * 3;
  const kb = Math.max(4, Math.min(rx, ry) * 0.38);
  const type: MonsterId | null = stivnet ? (stivnet === true ? 'granitt' : stivnet) : null;
  const id = ctx?.monstre ?? egne.id;
  const kanalTopp = kanal !== undefined && Number.isFinite(kanal) ? (ctx ? ctx.overflate(kanal) - 4 : y - ry * 3) : null;
  const kanaler = [
    tilforsel ? `M${r2(x - kb * 0.55)} ${r2(y + ry * 0.6)}C${r2(x - kb * 0.5)} ${r2((y + bunnY) / 2)} ${r2(x - kb * 0.9)} ${r2(bunnY - 20)} ${r2(x - kb)} ${r2(bunnY)}L${r2(x + kb)} ${r2(bunnY)}C${r2(x + kb * 0.8)} ${r2(bunnY - 20)} ${r2(x + kb * 0.5)} ${r2((y + bunnY) / 2)} ${r2(x + kb * 0.55)} ${r2(y + ry * 0.6)}Z` : '',
    kanalTopp !== null && kanal !== undefined
      ? `M${r2(x + (kanal - x) * 0.15 - kb * 0.4)} ${r2(y - ry * 0.6)}C${r2(x + (kanal - x) * 0.4 - kb * 0.4)} ${r2(y - ry * 1.4)} ${r2(kanal - kb * 0.35)} ${r2((y + kanalTopp) / 2)} ${r2(kanal - kb * 0.3)} ${r2(kanalTopp)}L${r2(kanal + kb * 0.3)} ${r2(kanalTopp)}C${r2(kanal + kb * 0.35)} ${r2((y + kanalTopp) / 2)} ${r2(x + (kanal - x) * 0.4 + kb * 0.4)} ${r2(y - ry * 1.4)} ${r2(x + (kanal - x) * 0.15 + kb * 0.4)} ${r2(y - ry * 0.6)}Z`
      : '',
  ].join('');
  const fyll = type ? lagFyll(type, id) : null;
  return (
    <g opacity={dim ? 0.38 : undefined}>
      {!ctx && type && <LagMonstre id={egne.id} bare={[type]} />}
      <RadialGradient
        id={gid}
        fx={0.45}
        fy={0.4}
        stops={[
          [0, mix(GEO.magma.fill, GEO.lava.fill, 0.75)],
          [0.45, mix(GEO.magma.fill, GEO.lava.fill, 0.3)],
          [1, GEO.magma.fill],
        ]}
      />
      <LinearGradient
        id={kid}
        x2={1}
        y2={0}
        stops={[
          [0, GEO.magma.fill],
          [0.5, mix(GEO.magma.fill, GEO.lava.fill, 0.35)],
          [1, GEO.magma.fill],
        ]}
      />
      {kanaler && (
        <path
          d={kanaler}
          fill={fyll ? fyll.fill : `url(#${kid})`}
          stroke={fyll ? shade(fyll.stroke, 0.2) : GEO.magma.line}
          strokeWidth={1.4 * s}
          strokeLinejoin="round"
        />
      )}
      <path d={d} fill={fyll ? fyll.fill : `url(#${gid})`} />
      {!fyll && <path d={d} fill="none" stroke={alpha(GEO.lava.fill, 0.5)} strokeWidth={3 * s} transform={`translate(${r2(x * 0.06)} ${r2(y * 0.08)}) scale(0.94 0.92)`} />}
      <path d={d} fill="none" stroke={fyll ? shade(fyll.stroke, 0.2) : GEO.magma.line} strokeWidth={1.8 * s} strokeLinejoin="round" />
    </g>
  );
}

/** Glatt lukket kurve gjennom punktene (Catmull–Rom som kubiske Bézier-kurver). */
function glattLukket(p: readonly SnittPunkt[]): string {
  const n = p.length;
  if (n < 3) return sti(p, true);
  let d = `M${r2(p[0]![0])} ${r2(p[0]![1])}`;
  for (let i = 0; i < n; i++) {
    const p0 = p[(i - 1 + n) % n]!;
    const p1 = p[i]!;
    const p2 = p[(i + 1) % n]!;
    const p3 = p[(i + 2) % n]!;
    const c1x = p1[0] + (p2[0] - p0[0]) / 6;
    const c1y = p1[1] + (p2[1] - p0[1]) / 6;
    const c2x = p2[0] - (p3[0] - p1[0]) / 6;
    const c2y = p2[1] - (p3[1] - p1[1]) / 6;
    d += `C${r2(c1x)} ${r2(c1y)} ${r2(c2x)} ${r2(c2y)} ${r2(p2[0])} ${r2(p2[1])}`;
  }
  return `${d}Z`;
}

/* =====================================================================================================================
 * Lagpakke
 * ================================================================================================================== */

/** Ett lag i en Lagpakke eller Borekjerne. Lista gis med det eldste (nederste) laget først. */
export interface LagpakkeLag {
  type: MonsterId;
  /** Tykkelsen i `enhet` (m som standard). Lag med tykkelse 0 eller ugyldig tykkelse hoppes over. */
  tykkelse: number;
  /** Navnet i etiketten (standard mønsterets navn). */
  navn?: string;
  /** Andre linje i etiketten: alder, fossiler, prosess (dempet). */
  tekst?: string;
  /** Kort nøkkel i kolonnen når etikettene står under (standard 1, 2, 3 … ovenfra). */
  kort?: string;
  /** Antall varv (årlige par av lyst sommerlag og mørkt vinterlag), bare i Borekjerne. */
  varv?: number;
  /** Bunnen er en erosjonsflate (diskordans): tegnes som en bølget, kraftig linje. */
  erosjon?: boolean;
  dim?: boolean;
  uthevet?: boolean;
}

/** Ett synlig lag i en lagpakke med dybden til toppen og bunnen (fra toppen av pakka, i samme enhet som tykkelsen). */
export interface LagpakkeIntervall {
  /** Indeksen i lista (0 = eldst). */
  indeks: number;
  topp: number;
  bunn: number;
  tykkelse: number;
}

/**
 * Dybden til toppen og bunnen av hvert lag, regnet fra toppen av pakka (det yngste laget har toppen i 0). Gir lagene
 * ovenfra og ned (yngste først) og den samlede tykkelsen. Lag med tykkelse 0 eller ugyldig tykkelse er med i rekkefølgen,
 * men ikke i lista.
 */
export function lagpakkeDybder(lag: readonly LagpakkeLag[]): { intervaller: LagpakkeIntervall[]; total: number } {
  const t = lag.map((l) => (Number.isFinite(l.tykkelse) && l.tykkelse > 0 ? l.tykkelse : 0));
  const intervaller: LagpakkeIntervall[] = [];
  let d = 0;
  for (let i = lag.length - 1; i >= 0; i--) {
    const ti = t[i]!;
    if (ti > 0) intervaller.push({ indeks: i, topp: d, bunn: d + ti, tykkelse: ti });
    d += ti;
  }
  return { intervaller, total: d };
}

/** Hvor bred hver bergart er i en lagpakke med kornstørrelsesprofil (andel av kolonnen), som i en sedimentologisk logg. */
const KORN_BREDDE: Partial<Record<MonsterId, number>> = {
  leire: 0.42,
  kvikkleire: 0.42,
  leirskifer: 0.42,
  kull: 0.42,
  torv: 0.42,
  siltstein: 0.56,
  aske: 0.56,
  sand: 0.7,
  sandstein: 0.7,
  kalkstein: 0.7,
  breelv: 0.78,
  grus: 0.86,
  konglomerat: 0.86,
  morene: 0.86,
  ur: 1,
};
const KORN_MERKER: readonly [number, string][] = [
  [0.42, 'le'],
  [0.56, 'si'],
  [0.7, 'sa'],
  [0.86, 'gr'],
];
const kornBredde = (type: MonsterId) => KORN_BREDDE[type] ?? 1;

/** Valg til `lagpakkeOppsett` (de samme som propsene til `Lagpakke`). */
export interface LagpakkeOppsettValg {
  bredde: number;
  hoyde: number;
  lag: readonly LagpakkeLag[];
  kolonne?: number;
  dybdeakse?: boolean;
  yngre?: boolean;
  etiketter?: 'auto' | 'hoyre' | 'under' | 'ingen';
  profil?: 'rett' | 'korn';
  enhet?: string;
  akseTittel?: string;
}

/** Oppsettet til en Lagpakke (alle mål relativt til øverste venstre hjørne). */
export interface LagpakkeOppsett {
  /** Der etikettene står: i en kolonne til høyre, i en forklaring under, eller ingen. */
  plassering: 'hoyre' | 'under' | 'ingen';
  /** Hele høyden komponenten bruker, med akse og forklaring. Bruk den til viewBox-en. */
  hoyde: number;
  /** Kolonnen med lagene. */
  kolonneX: number;
  kolonneY: number;
  kolonneBredde: number;
  kolonneHoyde: number;
  /** Dybdeaksen (x for aksestreken) og pila «yngre» (x for pila), eller null. */
  aksX: number | null;
  pilX: number | null;
  /** X der etikettene (eller nøklene) begynner. */
  etikettX: number;
  /** Forklaringen under figuren når etikettene står der. */
  forklaring: { y: number; kolonner: number; kolonneBredde: number; radHoyde: number; rader: number } | null;
  /** Px per enhet i kolonnen, merkene på dybdeaksen og antall desimaler i dem. */
  skala: number;
  merker: number[];
  desimaler: number;
}

/**
 * Oppsettet til en Lagpakke for tekstskaleringen `f` (fra `useContainerTextScale`): hvor kolonnen, aksen og etikettene
 * står, og hvor høy komponenten blir. Etikettene står til høyre når de får plass (`etiketter: 'auto'`), ellers i en
 * forklaring under kolonnen med nøkler (1, 2, 3 … ovenfra). Bruk `hoyde` til viewBox-en:
 *   const opp = lagpakkeOppsett({ bredde: 360, hoyde: 260, lag }, f);
 *   <Figure viewBox={`0 0 400 ${opp.hoyde + 20}`}>…<Lagpakke x={20} y={10} bredde={360} hoyde={260} lag={lag} /></Figure>
 */
export function lagpakkeOppsett(v: LagpakkeOppsettValg, fInn = 1): LagpakkeOppsett {
  const f = Number.isFinite(fInn) ? Math.max(1, fInn) : 1;
  const k = Math.max(1, 0.85 * f);
  const bredde = Math.max(40, fin(v.bredde, 300));
  const hoyde = Math.max(20, fin(v.hoyde, 240));
  const { intervaller, total } = lagpakkeDybder(v.lag);
  const akse = v.dybdeakse !== false && total > 0;
  const pil = v.yngre !== false;
  const merkerRa = total > 0 ? niceTicks(0, total, hoyde > 180 ? 5 : 3).filter((m) => m >= 0 && m <= total * (1 + 1e-9)) : [];
  const steg = merkerRa.length > 1 ? merkerRa[1]! - merkerRa[0]! : total;
  const desimaler = steg >= 1 || !(steg > 0) ? 0 : Math.min(3, Math.ceil(-Math.log10(steg) - 1e-9));
  const AKSE = 0.72;
  const ETIKETT = 0.8;
  const pilB = pil ? 17 * 0.74 * f + 14 : 0;
  const aksB = akse ? Math.max(...merkerRa.map((m) => tekstBredde(fmt(m, desimaler), AKSE, f)), tekstBredde('0', AKSE, f)) + 14 : 0;
  const venstre = pilB + aksB + (akse || pil ? 6 : 0);
  const navn = intervaller.map(({ indeks }) => v.lag[indeks]!);
  const etikettB = Math.max(
    0,
    ...navn.map((l) => Math.max(tekstBredde(l.navn ?? MONSTER_NAVN[l.type], ETIKETT, f), l.tekst ? tekstBredde(l.tekst, ETIKETT * 0.82, f) : 0)),
  );
  const onsket = v.etiketter ?? 'auto';
  const kolHoyre = fin(v.kolonne ?? clamp(0.3 * bredde, 56, 170), 100);
  const plassering: LagpakkeOppsett['plassering'] =
    onsket === 'auto' ? (venstre + kolHoyre + 30 + etikettB <= bredde ? 'hoyre' : 'under') : onsket;
  const kolonneBredde = Math.max(
    16,
    plassering === 'under' ? fin(v.kolonne ?? clamp(0.42 * bredde, 56, 220), 100) : plassering === 'ingen' ? fin(v.kolonne ?? clamp(0.5 * bredde, 56, 200), 100) : kolHoyre,
  );
  const toppMarg = akse ? 17 * AKSE * f + 12 : 10;
  const bunnMarg = v.profil === 'korn' ? 17 * 0.66 * f + 14 : akse ? 17 * AKSE * f * 0.45 + 4 : 6;
  const kolonneX = venstre;
  const kolonneY = toppMarg;
  const etikettX = kolonneX + kolonneBredde + (plassering === 'under' ? 14 : 28);
  let forklaring: LagpakkeOppsett['forklaring'] = null;
  let total_h = toppMarg + hoyde + bunnMarg;
  if (plassering === 'under' && intervaller.length > 0) {
    const r = 8.5 * k;
    const radHoyde = Math.max(17 * ETIKETT * f, 2 * r) + 8 + (navn.some((l) => l.tekst) ? 17 * ETIKETT * 0.82 * f : 0);
    const itemB = 2 * r + 8 + 24 * k + 8 + etikettB + 18;
    const kolonner = clamp(Math.floor(bredde / itemB), 1, 3);
    const rader = Math.ceil(intervaller.length / kolonner);
    forklaring = { y: total_h + 8, kolonner, kolonneBredde: bredde / kolonner, radHoyde, rader };
    total_h = forklaring.y + rader * radHoyde;
  }
  return {
    plassering,
    hoyde: Math.round(total_h),
    kolonneX,
    kolonneY,
    kolonneBredde,
    kolonneHoyde: hoyde,
    aksX: akse ? kolonneX - 6 : null,
    pilX: pil ? pilB * 0.62 : null,
    etikettX,
    forklaring,
    skala: total > 0 ? hoyde / total : 0,
    merker: akse ? merkerRa : [],
    desimaler,
  };
}

/** Props til `Lagpakke`. */
export interface LagpakkeProps {
  /** Øverste venstre hjørne av området komponenten bruker. */
  x: number;
  y: number;
  /** Bredden komponenten har til rådighet (pil, akse, kolonne og etiketter). */
  bredde: number;
  /** Høyden på kolonnen med lagene. Hele høyden (med akse og forklaring) gir `lagpakkeOppsett(…).hoyde`. */
  hoyde: number;
  /** Lagene, eldste (nederste) først. */
  lag: readonly LagpakkeLag[];
  /** Enheten for tykkelsen (standard 'm'). */
  enhet?: string;
  /** Tittel over dybdeaksen (standard «Dyp (m)»). */
  akseTittel?: string;
  /** Bredden på kolonnen (standard ca. 0,3 · bredde). */
  kolonne?: number;
  /** Dybdeakse til venstre for kolonnen (standard på). */
  dybdeakse?: boolean;
  /** Pila «yngre» lengst til venstre (standard på). */
  yngre?: boolean;
  /** Etikettene: 'auto' (standard: til høyre når de får plass, ellers under), 'hoyre', 'under' eller 'ingen'. */
  etiketter?: 'auto' | 'hoyre' | 'under' | 'ingen';
  /** 'korn' gir bredden etter kornstørrelsen (leire smalest, grus bredest), som i en sedimentologisk logg. Standard 'rett'. */
  profil?: 'rett' | 'korn';
  /** Gress på toppen av pakka. */
  gress?: boolean;
}

/**
 * Lagrekke med det eldste laget nederst, som i PDF-malen «Atlas»: en kolonne med mønstrene (lys fra venstre), pil
 * «yngre» lengst til venstre, dybdeakse og etiketter midt for hvert lag i en egen kolonne til høyre. Når etikettene ikke
 * får plass (smal skjerm), står de i en forklaring under kolonnen, med nøkler (1, 2, 3 … ovenfra) ved lagene. Lagene er
 * i målestokk; en erosjonsflate tegnes som en bølget linje.
 *
 * Ankerpunkt: (x, y) er øverste venstre hjørne av området. `lagpakkeOppsett` gir hele høyden til viewBox-en.
 *   <Lagpakke x={20} y={10} bredde={360} hoyde={240} lag={[
 *     { type: 'gneis', tykkelse: 8, navn: 'Grunnfjell' },
 *     { type: 'sandstein', tykkelse: 12, erosjon: true },
 *     { type: 'leirskifer', tykkelse: 6, tekst: 'Fossiler av trilobitter' },
 *   ]} />
 */
export function Lagpakke({
  x,
  y,
  bredde,
  hoyde,
  lag,
  enhet = 'm',
  akseTittel,
  kolonne,
  dybdeakse,
  yngre,
  etiketter,
  profil = 'rett',
  gress,
}: LagpakkeProps) {
  const f = useTextScale();
  const k = useGeoScale();
  const s = useGeoStroke();
  const monstre = useLagMonstre('lagpakke');
  const lysId = useSvgId('pakkelys');
  const opp = lagpakkeOppsett({ bredde, hoyde, lag, kolonne, dybdeakse, yngre, etiketter, profil, enhet, akseTittel }, f);
  const { intervaller } = lagpakkeDybder(lag);
  if (intervaller.length === 0) return null;
  const { kolonneX: cx, kolonneY: cy, kolonneBredde: cw, skala } = opp;
  const bredd = (i: number) => (profil === 'korn' ? cw * kornBredde(lag[i]!.type) : cw);
  const yAv = (d: number) => cy + d * skala;
  const amp = 2.6 * k;
  const bolge = 16 * k;
  /** Grensen mellom to lag ved dybden d (rett, eller bølget når laget over har erosjonsflate i bunnen). */
  const grense = (d: number, x0: number, x1: number, erosjon: boolean, retur = false): string => {
    const yy = yAv(d);
    if (!erosjon) return retur ? `L${r2(x0)} ${r2(yy)}` : `L${r2(x1)} ${r2(yy)}`;
    const xs = linspace(retur ? x1 : x0, retur ? x0 : x1, Math.max(8, Math.round((x1 - x0) / 1.5)));
    return xs.map((xx) => `L${r2(xx)} ${r2(yy + amp * Math.sin(((xx - cx) / bolge) * 2 * Math.PI))}`).join('');
  };
  const baand = intervaller.map((iv, j) => {
    const l = lag[iv.indeks]!;
    const b = bredd(iv.indeks);
    // Erosjonsflate i toppen: laget over (yngre) har erosjon i bunnen
    const over = j > 0 ? lag[intervaller[j - 1]!.indeks]! : null;
    const toppEro = !!over?.erosjon;
    const yTopp = yAv(iv.topp);
    const d =
      `M${r2(cx)} ${r2(yTopp)}` +
      grense(iv.topp, cx, cx + b, toppEro) +
      `L${r2(cx + b)} ${r2(yAv(iv.bunn))}` +
      grense(iv.bunn, cx, cx + b, !!l.erosjon, true) +
      'Z';
    return { iv, l, d, b, midt: (yAv(iv.topp) + yAv(iv.bunn)) / 2 };
  });
  const toppY = yAv(0);
  const bunnY = yAv(intervaller[intervaller.length - 1]!.bunn);
  const fs = 17 * 0.8 * f;
  const nokkel = (j: number) => baand[j]!.l.kort ?? String(j + 1);
  const tittel = akseTittel ?? `Dyp (${enhet})`;
  return (
    <g transform={`translate(${r2(fin(x))} ${r2(fin(y))})`}>
      <LagMonstre id={monstre.id} skala={0.85} />
      <LinearGradient
        id={lysId}
        x2={1}
        y2={0}
        stops={[
          [0, SCENE.highlight, 0.5],
          [0.3, SCENE.highlight, 0],
          [0.7, SCENE.shadow, 0],
          [1, SCENE.shadow, 0.5],
        ]}
      />
      {baand.map(({ iv, l, d }) => {
        const fyll = lagFyll(l.type, monstre.id);
        return (
          <g key={iv.indeks} opacity={l.dim ? 0.35 : undefined}>
            <path d={d} fill={fyll.fill} />
            <path d={d} fill={`url(#${lysId})`} />
            <path d={d} fill="none" stroke={fyll.stroke} strokeWidth={monstre.kontur} strokeLinejoin="round" />
          </g>
        );
      })}
      {/* Erosjonsflatene og utheving oppå */}
      {baand.map(({ iv, l, b }) =>
        l.erosjon ? (
          <path
            key={`e${iv.indeks}`}
            d={`M${r2(cx)} ${r2(yAv(iv.bunn))}${grense(iv.bunn, cx, cx + Math.max(b, cw * 0.3), true)}`}
            fill="none"
            stroke={VIZ.ink}
            strokeWidth={2.2 * s}
            opacity={0.8}
          />
        ) : null,
      )}
      {baand.map(({ iv, l, d }) => (l.uthevet ? <path key={`u${iv.indeks}`} d={d} fill="none" stroke={VIZ.ink} strokeWidth={2.6 * s} strokeLinejoin="round" /> : null))}
      {gress && <path d={`M${r2(cx)} ${r2(toppY)}h${r2(baand[0]!.b)}`} stroke={SCENE.grassDark} strokeWidth={4 * s} strokeLinecap="round" />}

      {/* Dybdeakse */}
      {opp.aksX !== null && (
        <g>
          <line x1={opp.aksX} x2={opp.aksX} y1={toppY} y2={bunnY} stroke={VIZ.muted} strokeWidth={1.2 * s} />
          {opp.merker.map((m) => (
            <g key={m}>
              <line x1={opp.aksX! - 5} x2={opp.aksX!} y1={r2(yAv(m))} y2={r2(yAv(m))} stroke={VIZ.muted} strokeWidth={1.2 * s} />
              <Txt x={opp.aksX! - 8} y={r2(yAv(m) + 17 * 0.72 * f * 0.35)} anchor="end" size={0.72} weight={500} muted>
                {fmt(m, opp.desimaler)}
              </Txt>
            </g>
          ))}
          <Txt x={opp.aksX + 2} y={r2(toppY - 9)} anchor={opp.pilX !== null ? 'middle' : 'end'} size={0.72} weight={560} muted>
            {tittel}
          </Txt>
        </g>
      )}
      {/* Pila «yngre» */}
      {opp.pilX !== null && (
        <g>
          <path
            d={`M${r2(opp.pilX)} ${r2(bunnY - 2)}V${r2(toppY + 4)}M${r2(opp.pilX - 5 * k)} ${r2(toppY + 12 * k)}L${r2(opp.pilX)} ${r2(toppY + 2)}L${r2(opp.pilX + 5 * k)} ${r2(toppY + 12 * k)}`}
            fill="none"
            stroke={VIZ.ink}
            strokeWidth={1.6 * s}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <g transform={`translate(${r2(opp.pilX - 6)} ${r2((toppY + bunnY) / 2)}) rotate(-90)`}>
            <Txt x={0} y={0} size={0.74} weight={560}>
              yngre
            </Txt>
          </g>
        </g>
      )}
      {/* Kornstørrelsesmerker under kolonnen */}
      {profil === 'korn' && (
        <g>
          <line x1={cx} x2={cx + cw} y1={r2(bunnY + 4)} y2={r2(bunnY + 4)} stroke={VIZ.muted} strokeWidth={1.1 * s} />
          {KORN_MERKER.map(([t, navn]) => (
            <g key={navn}>
              <line x1={r2(cx + t * cw)} x2={r2(cx + t * cw)} y1={r2(bunnY + 4)} y2={r2(bunnY + 9)} stroke={VIZ.muted} strokeWidth={1.1 * s} />
              <Txt x={r2(cx + t * cw)} y={r2(bunnY + 10 + 17 * 0.66 * f)} size={0.66} weight={560} muted>
                {navn}
              </Txt>
            </g>
          ))}
        </g>
      )}
      {/* Etiketter til høyre */}
      {opp.plassering === 'hoyre' && (
        <SnittEtiketter
          x={opp.etikettX}
          topp={cy - 4}
          bunn={opp.hoyde}
          prikk={false}
          etiketter={baand.map(({ l, b, midt }) => ({
            x: cx + b + 2,
            y: midt,
            tekst: l.navn ?? MONSTER_NAVN[l.type],
            undertekst: l.tekst,
            uthevet: l.uthevet,
            dim: l.dim,
          }))}
        />
      )}
      {/* Nøkler ved lagene og forklaring under */}
      {opp.plassering === 'under' && opp.forklaring && (
        <Nokler
          baand={baand.map(({ l, b, midt }, j) => ({ x: cx + b, y: midt, tekst: nokkel(j), dim: l.dim, uthevet: l.uthevet }))}
          x={opp.etikettX}
          topp={cy}
          bunn={bunnY}
          k={k}
          s={s}
        />
      )}
      {opp.plassering === 'under' &&
        opp.forklaring &&
        baand.map(({ l }, j) => {
          const fk = opp.forklaring!;
          const kol = j % fk.kolonner;
          const rad = Math.floor(j / fk.kolonner);
          const fx = kol * fk.kolonneBredde;
          const fy = fk.y + rad * fk.radHoyde;
          const r = 8.5 * k;
          const sw = 24 * k;
          const fyll = lagFyll(l.type, monstre.id);
          return (
            <g key={`f${j}`} opacity={l.dim ? 0.45 : undefined}>
              <circle cx={r2(fx + r)} cy={r2(fy + r)} r={r2(r)} fill={VIZ.surface} stroke={VIZ.ink} strokeWidth={1.2 * s} />
              <Txt x={r2(fx + r)} y={r2(fy + r + fs * 0.32)} size={0.7} weight={700} halo={false}>
                {nokkel(j)}
              </Txt>
              <rect x={r2(fx + 2 * r + 7)} y={r2(fy + r - 7 * k)} width={r2(sw)} height={r2(14 * k)} rx={2} fill={fyll.fill} stroke={fyll.stroke} strokeWidth={monstre.kontur} />
              <Txt x={r2(fx + 2 * r + 14 + sw)} y={r2(fy + r + fs * 0.34)} anchor="start" size={0.8} weight={l.uthevet ? 700 : 560}>
                {l.navn ?? MONSTER_NAVN[l.type]}
              </Txt>
              {l.tekst && (
                <Txt x={r2(fx + 2 * r + 14 + sw)} y={r2(fy + r + fs * 1.3)} anchor="start" size={0.66} weight={500} muted>
                  {l.tekst}
                </Txt>
              )}
            </g>
          );
        })}
    </g>
  );
}

/** Små runde nøkler ved lagene (når etikettene står i forklaringen under). */
function Nokler({
  baand,
  x,
  topp,
  bunn,
  k,
  s,
}: {
  baand: { x: number; y: number; tekst: string; dim?: boolean; uthevet?: boolean }[];
  x: number;
  topp: number;
  bunn: number;
  k: number;
  s: number;
}) {
  const f = useTextScale();
  const r = 8.5 * k;
  const c = snittFordelEtiketter(
    baand.map((b) => b.y),
    baand.map(() => 2 * r + 3),
    topp,
    bunn,
  );
  return (
    <g>
      {baand.map((b, i) => (
        <g key={i} opacity={b.dim ? 0.45 : undefined}>
          <line x1={r2(b.x + 1)} y1={r2(b.y)} x2={r2(x + r - r * 0.9)} y2={r2(c[i]!)} stroke={VIZ.muted} strokeWidth={1.1 * s} />
          <circle cx={r2(x + r)} cy={r2(c[i]!)} r={r2(r)} fill={VIZ.surface} stroke={VIZ.ink} strokeWidth={(b.uthevet ? 2 : 1.2) * s} />
          <Txt x={r2(x + r)} y={r2(c[i]! + 17 * 0.7 * f * 0.36)} size={0.7} weight={700} halo={false}>
            {b.tekst}
          </Txt>
        </g>
      ))}
    </g>
  );
}

/* =====================================================================================================================
 * Borekjerne
 * ================================================================================================================== */

/** Et prøvemerke på en borekjerne. */
export interface BorekjerneProve {
  /** Dybden fra toppen av kjernen, i samme enhet som tykkelsene. */
  dybde: number;
  /** Navnet på prøven («Prøve A»). */
  navn?: string;
  /** Andre linje (resultatet, f.eks. «9 800 år»). */
  tekst?: string;
}

/** Props til `Borekjerne`. */
export interface BorekjerneProps {
  /** Midten av kjernen (x) og toppen (y, midt i den øverste endeflaten). */
  x: number;
  y: number;
  /** Diameteren. */
  bredde: number;
  /** Lengden på kjernen. Standard: tykkelsene · `pxPerEnhet`, eller 240. */
  hoyde?: number;
  /** Fast målestokk (px per enhet) i stedet for `hoyde`. */
  pxPerEnhet?: number;
  /** Lagene, eldste (nederste) først, som i Lagpakke. `varv` gir årlige lag. */
  lag: readonly LagpakkeLag[];
  /** Prøvemerker med etikett til høyre. */
  prover?: readonly BorekjerneProve[];
  /** Lagnavnene i en kolonne til høyre (sammen med prøvene). */
  etiketter?: boolean;
  /** Dybdeakse til venstre. */
  dybdeakse?: boolean;
  /** Enheten på dybdeaksen (standard 'm'). */
  enhet?: string;
  /** Antall brudd i kjernen (kjerner brekker i biter). Standard 0. */
  brudd?: number;
  /** Frø til bruddene. */
  seed?: number;
  dim?: boolean;
}

/**
 * Borekjerne: en stående sylinder med lys fra venstre og myk skygge, lagene fra en Lagpakke-liste (eldste nederst) som
 * bånd rundt kjernen, valgfrie varv (årlige par av lyst sommerlag og mørkt vinterlag), prøvemerker med etikett, brudd og
 * dybdeakse. Ankerpunkt: (x, y) er midten av den øverste endeflaten; kjernen går ned til y + hoyde, og etikettene står
 * fra x + bredde/2 + 22.
 *   <Borekjerne x={120} y={30} bredde={46} hoyde={260} lag={[
 *     { type: 'morene', tykkelse: 2 },
 *     { type: 'leire', tykkelse: 3, varv: 24 },
 *     { type: 'torv', tykkelse: 1 },
 *   ]} prover={[{ dybde: 1.2, navn: 'Prøve A', tekst: '9 800 år' }]} dybdeakse />
 */
export function Borekjerne({
  x,
  y,
  bredde,
  hoyde,
  pxPerEnhet,
  lag,
  prover = [],
  etiketter,
  dybdeakse,
  enhet = 'm',
  brudd = 0,
  seed = 2,
  dim,
}: BorekjerneProps) {
  const f = useTextScale();
  const k = useGeoScale();
  const s = useGeoStroke();
  const monstre = useLagMonstre('kjerne');
  const lysId = useSvgId('kjernelys');
  const toppId = useSvgId('kjernetopp');
  const { intervaller, total } = lagpakkeDybder(lag);
  if (intervaller.length === 0 || !(total > 0) || ![x, y, bredde].every(Number.isFinite)) return null;
  const r = Math.max(4, bredde / 2);
  const ry = r * 0.28;
  const H = hoyde !== undefined && Number.isFinite(hoyde) && hoyde > 0 ? hoyde : pxPerEnhet !== undefined && pxPerEnhet > 0 ? total * pxPerEnhet : 240;
  const skala = H / total;
  const yAv = (d: number) => y + d * skala;
  const xl = x - r;
  const xr = x + r;
  /** Bånd mellom to dybder (forkanten er den nedre halvdelen av en ellipse). */
  const baand = (y0: number, y1: number) =>
    `M${r2(xl)} ${r2(y0)}A${r2(r)} ${r2(ry)} 0 0 0 ${r2(xr)} ${r2(y0)}L${r2(xr)} ${r2(y1)}A${r2(r)} ${r2(ry)} 0 0 1 ${r2(xl)} ${r2(y1)}Z`;
  const bue = (yy: number) => `M${r2(xl)} ${r2(yy)}A${r2(r)} ${r2(ry)} 0 0 0 ${r2(xr)} ${r2(yy)}`;
  const kropp = baand(y, y + H);
  const toppLag = lag[intervaller[0]!.indeks]!;
  const rnd = sceneRandom(seed);
  const nBrudd = Math.max(0, Math.min(12, Math.round(fin(brudd))));
  const bruddY = Array.from({ length: nBrudd }, (_, i) => y + (H * (i + 0.35 + 0.3 * rnd())) / (nBrudd + 0.2));
  const merker = dybdeakse ? niceTicks(0, total, H > 200 ? 5 : 3).filter((m) => m >= 0 && m <= total * (1 + 1e-9)) : [];
  const steg = merker.length > 1 ? merker[1]! - merker[0]! : total;
  const des = steg >= 1 ? 0 : Math.min(3, Math.ceil(-Math.log10(steg) - 1e-9));
  const fs = 17 * 0.8 * f;
  const ankre: SnittEtikett[] = [
    ...(etiketter
      ? intervaller.map((iv) => {
          const l = lag[iv.indeks]!;
          return { x: xr + 3, y: (yAv(iv.topp) + yAv(iv.bunn)) / 2 + ry * 0.6, tekst: l.navn ?? MONSTER_NAVN[l.type], undertekst: l.tekst, dim: l.dim, uthevet: l.uthevet };
        })
      : []),
    ...prover
      .filter((p) => Number.isFinite(p.dybde) && p.dybde >= 0 && p.dybde <= total)
      .map((p) => ({ x: xr + 3, y: yAv(p.dybde) + ry, tekst: p.navn ?? 'Prøve', undertekst: p.tekst, uthevet: true })),
  ];
  return (
    <g opacity={dim ? 0.4 : undefined}>
      <LagMonstre id={monstre.id} skala={0.7} />
      <LinearGradient
        id={lysId}
        x2={1}
        y2={0}
        stops={[
          [0, SCENE.shadow, 0.35],
          [0.22, SCENE.highlight, 0.55],
          [0.42, SCENE.highlight, 0.1],
          [0.75, SCENE.shadow, 0.35],
          [1, SCENE.shadow, 0.85],
        ]}
      />
      <LinearGradient
        id={toppId}
        x2={1}
        y2={1}
        stops={[
          [0, SCENE.highlight, 0.6],
          [1, SCENE.highlight, 0.15],
        ]}
      />
      <ContactShadow cx={x + r * 0.25} cy={y + H + ry * 0.3} rx={r * 1.5} ry={ry * 1.4} />
      {intervaller.map((iv) => {
        const l = lag[iv.indeks]!;
        const fyll = lagFyll(l.type, monstre.id);
        const y0 = yAv(iv.topp);
        const y1 = yAv(iv.bunn);
        const n = l.varv !== undefined && Number.isFinite(l.varv) ? Math.max(0, Math.min(400, Math.round(l.varv))) : 0;
        return (
          <g key={iv.indeks} opacity={l.dim ? 0.35 : undefined}>
            <path d={baand(y0, y1)} fill={n > 0 ? tint(GEO.bergart[l.type].fill, 0.25) : fyll.fill} />
            {n > 0 && (
              <path
                d={varvGrenser(n, y0, y1, seed + iv.indeks)
                  .map(([a, b]) => baand(a, b))
                  .join('')}
                fill={shade(GEO.bergart[l.type].line, 0.1)}
                opacity={0.7}
              />
            )}
          </g>
        );
      })}
      <path d={kropp} fill={`url(#${lysId})`} />
      {/* Grenser mellom lagene */}
      {intervaller.slice(1).map((iv) => (
        <path
          key={`g${iv.indeks}`}
          d={bue(yAv(iv.topp))}
          fill="none"
          stroke={lag[iv.indeks + 1]?.erosjon ? VIZ.ink : GEO.bergart[lag[iv.indeks]!.type].line}
          strokeWidth={(lag[iv.indeks + 1]?.erosjon ? 2 : 1.1) * s}
          opacity={0.9}
        />
      ))}
      {/* Brudd */}
      {bruddY.map((by, i) => {
        const xs = linspace(xl, xr, 9);
        const d = xs
          .map((xx, j) => {
            const t = (xx - x) / r;
            const yy = by + ry * Math.sqrt(Math.max(0, 1 - t * t)) + (j % 2 ? 2.2 : -1.6) * k;
            return `${j ? 'L' : 'M'}${r2(xx)} ${r2(yy)}`;
          })
          .join('');
        return (
          <g key={`b${i}`}>
            <path d={d} fill="none" stroke={SCENE.highlight} strokeWidth={2.2 * s} transform="translate(0 1.2)" />
            <path d={d} fill="none" stroke={SCENE.outline} strokeWidth={1.2 * s} />
          </g>
        );
      })}
      {/* Prøvemerker: stiplet ring og et lite hull der prøven er tatt */}
      {prover
        .filter((p) => Number.isFinite(p.dybde) && p.dybde >= 0 && p.dybde <= total)
        .map((p, i) => {
          const yy = yAv(p.dybde);
          return (
            <g key={`p${i}`}>
              <path d={bue(yy)} fill="none" stroke={VIZ.ink} strokeWidth={1.6 * s} strokeDasharray={`${r2(4 * k)} ${r2(3 * k)}`} />
              <ellipse cx={r2(x - r * 0.25)} cy={r2(yy + ry * 0.95)} rx={r2(Math.min(r * 0.18, 5 * k))} ry={r2(Math.min(r * 0.12, 3.4 * k))} fill={SCENE.outline} />
            </g>
          );
        })}
      {/* Omriss og toppflaten */}
      <path d={`M${r2(xl)} ${r2(y)}L${r2(xl)} ${r2(y + H)}A${r2(r)} ${r2(ry)} 0 0 0 ${r2(xr)} ${r2(y + H)}L${r2(xr)} ${r2(y)}`} fill="none" stroke={SCENE.outline} strokeWidth={1.3 * s} />
      <ellipse cx={x} cy={y} rx={r} ry={ry} fill={toppLag.varv ? tint(GEO.bergart[toppLag.type].fill, 0.25) : lagFyll(toppLag.type, monstre.id).fill} />
      <ellipse cx={x} cy={y} rx={r} ry={ry} fill={`url(#${toppId})`} stroke={SCENE.outline} strokeWidth={1.3 * s} />
      {dybdeakse && (
        <g>
          <line x1={r2(xl - 8)} x2={r2(xl - 8)} y1={y} y2={r2(y + H)} stroke={VIZ.muted} strokeWidth={1.2 * s} />
          {merker.map((m) => (
            <g key={m}>
              <line x1={r2(xl - 13)} x2={r2(xl - 8)} y1={r2(yAv(m))} y2={r2(yAv(m))} stroke={VIZ.muted} strokeWidth={1.2 * s} />
              <Txt x={r2(xl - 16)} y={r2(yAv(m) + 17 * 0.72 * f * 0.35)} anchor="end" size={0.72} weight={500} muted>
                {fmt(m, des)}
              </Txt>
            </g>
          ))}
          <Txt x={r2(xl - 8)} y={r2(y - ry - 8)} anchor="middle" size={0.72} weight={560} muted>
            {enhet}
          </Txt>
        </g>
      )}
      {ankre.length > 0 && <SnittEtiketter x={xr + 22} topp={y - ry - fs} bunn={y + H + ry + fs * 0.4} etiketter={ankre} />}
    </g>
  );
}

/**
 * Vinterlagene i n varv mellom y0 og y1: tykkelsen på hvert varv varierer litt (kalde og varme somre), og vinterlaget er
 * den mørke tredjedelen nederst i varvet. Gir [topp, bunn] for hvert vinterlag.
 */
function varvGrenser(n: number, y0: number, y1: number, seed: number): [number, number][] {
  const rnd = sceneRandom(seed * 7 + 11);
  const vekt = Array.from({ length: n }, () => 0.6 + 0.8 * rnd());
  const sum = vekt.reduce((a, b) => a + b, 0);
  const out: [number, number][] = [];
  let y = y0;
  for (const v of vekt) {
    const t = ((y1 - y0) * v) / sum;
    out.push([y + t * 0.64, y + t]);
    y += t;
  }
  return out;
}
