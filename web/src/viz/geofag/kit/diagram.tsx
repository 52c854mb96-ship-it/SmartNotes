/**
 * Diagrammer for geofag: `LogPlot` (logaritmiske og lineære akser med valgfri høyreakse), `Klimadiagram` (nedbør som
 * søyler og temperatur som kurve, som malen i PDF-ene), `GeoTidslinje` (geologisk tid med periodebånd, zoom og
 * hendelser) og `Zoomtrakt`, pluss små hjelpere for tekstbredde, linjebryting og flagg over en akse (`flaggEtiketter`). Samme stil som `Plot` i det felles kit-et (rutenett,
 * akseverdier og aksetitler med klassene i viz.css), så diagrammene ser like ut i alle fagene.
 */
import type { CSSProperties, ReactNode } from 'react';
import { useTextScale } from '../../kit/controls';
import { VIZ } from '../../kit/colors';
import { Txt } from '../../kit/txt';
import { fmt } from '../../kit/format';
import { linePath, niceTicks, scaleLinear } from '../../kit/svg';
import { alpha, shade, useSvgId } from '../../kit/scene/core';
import { GEO, tidFarge, type GeoPaint } from './colors';
import { LagMonstre, lagFyll, useLagMonstre } from './monstre';
import type { MonsterId } from './typer';
import { geoHoyde, useGeoScale, useGeoStroke } from './felles';
import { fmtTall, logEtikett, logTicks, scaleLog, scaleLogInvert, type LogEtikettValg } from './akser';
import { PREKAMBRIUM, fmtAlder, intervaller, JORDAS_ALDER, type TidsIntervall, type TidsNiva } from './geotid';

/* ================================================================================================ Tekst */

/**
 * Omtrentlig bredde av en tekst i figurens enheter når skriftstørrelsen er `px` (til å plassere etiketter uten å måle i
 * nettleseren). Litt romslig for halvfet skrift. Ugyldig størrelse gir 0.
 *   tekstBredde('Kambrium', 17 * 0.8 * f)
 */
export function tekstBredde(tekst: string, px: number): number {
  if (!Number.isFinite(px) || px <= 0) return 0;
  let em = 0;
  for (const c of tekst) {
    if (c >= '0' && c <= '9') em += 0.57;
    else if (c === ' ' || c === ' ' || c === ' ') em += 0.27;
    else if (',.:;!|\'’'.includes(c)) em += 0.27;
    else if ('ilIjft()[]'.includes(c)) em += 0.33;
    else if ('mwMWæÆ'.includes(c)) em += 0.86;
    else if ('⁰¹²³⁴⁵⁶⁷⁸⁹⁻'.includes(c)) em += 0.38;
    else if (c === '·') em += 0.3;
    else if (c === '−' || c === '–' || c === '-') em += 0.6;
    else if (c.toUpperCase() === c && c.toLowerCase() !== c) em += 0.68;
    else em += 0.56;
  }
  return em * px;
}

/**
 * Deler en tekst i linjer som er høyst `maksBredde` brede (ved mellomrom), med høyst `maksLinjer` linjer. Et ord som
 * er lengre enn linja, står alene på linja. Brukes til lange etiketter i smale kolonner.
 *   brytTekst('Masseutdøing ved slutten av ordovicium', 160, 13) → ['Masseutdøing ved', 'slutten av ordovicium']
 */
export function brytTekst(tekst: string, maksBredde: number, px: number, maksLinjer = 3): string[] {
  const ord = tekst.split(/\s+/).filter(Boolean);
  const linjer: string[] = [];
  let linje = '';
  for (const o of ord) {
    const forsok = linje ? `${linje} ${o}` : o;
    // Siste tillatte linje tar resten av teksten
    if (linje && tekstBredde(forsok, px) > maksBredde && linjer.length < maksLinjer - 1) {
      linjer.push(linje);
      linje = o;
    } else linje = forsok;
  }
  if (linje) linjer.push(linje);
  return linjer;
}

/**
 * Deler en liste i høyst `kolonner` kolonner i samme rekkefølge (nedover, så bortover), så den høyeste kolonnen blir så
 * lav som mulig. Gir indeksene i hver kolonne.
 */
function fordelIKolonner(hoyder: readonly number[], kolonner: number): number[][] {
  const n = hoyder.length;
  const pakk = (maks: number) => {
    const ut: number[][] = [[]];
    let h = 0;
    for (let i = 0; i < n; i++) {
      const hi = hoyder[i]!;
      if (h + hi > maks + 1e-9 && ut[ut.length - 1]!.length > 0) {
        ut.push([]);
        h = 0;
      }
      ut[ut.length - 1]!.push(i);
      h += hi;
    }
    return ut;
  };
  let lo = Math.max(0, ...hoyder);
  let hi = hoyder.reduce((s, v) => s + v, 0);
  for (let r = 0; r < 40 && hi - lo > 0.5; r++) {
    const mid = (lo + hi) / 2;
    if (pakk(mid).length <= kolonner) hi = mid;
    else lo = mid;
  }
  return pakk(hi);
}

/** En tekst som skal stå som flagg over en vannrett akse: strekens plass og tekstens bredde (figurens enheter). */
export interface FlaggInn {
  pos: number;
  bredde: number;
}

/**
 * Plassen til ett flagg: `x` er venstre kant av teksten (tegn den med `textAnchor="start"`), `start` sier om teksten står
 * til høyre for streken, `rad` er raden (0 = nærmest aksen) og [a, b] spennet som tekst og strek tar langs aksen. En
 * tekst som ikke får plass på noen av sidene, står over streken, flyttet inn mellom p0 og p1.
 */
export interface FlaggUt {
  x: number;
  start: boolean;
  rad: number;
  a: number;
  b: number;
}

/**
 * Plasserer tekster som flagg over en vannrett akse (hendelser på en tidslinje, ankomster i et seismogram): hver tekst
 * står i en rad over aksen med en loddrett strek ned til sin plass, og ingen strek går gjennom en tekst eller to tekster
 * oppå hverandre. Tekstene står til høyre for streken når de får plass innenfor [p0, p1], ellers til venstre. Gir antall
 * rader som trengs, eller null når tekstene sperrer hverandre (bruk da nummererte merker, som `GeoTidslinje` gjør).
 */
export function flaggEtiketter(inn: readonly FlaggInn[], p0: number, p1: number, gap = 8): { flagg: FlaggUt[]; rader: number } | null {
  const n = inn.length;
  if (n === 0) return { flagg: [], rader: 0 };
  if (!inn.every((e) => Number.isFinite(e.pos) && Number.isFinite(e.bredde))) return null;
  const kanStart = inn.map((e) => e.pos + 5 + e.bredde <= p1 + 6);
  const kanSlutt = inn.map((e) => e.pos - 5 - e.bredde >= p0 - 6);
  const start = inn.map((e, i) => kanStart[i]! || (!kanSlutt[i]! && e.pos - p0 <= p1 - e.pos));
  // Venstre kant av teksten: til høyre eller venstre for streken, eller over den og flyttet inn når ingen side passer
  const tekstX = (i: number) => {
    const e = inn[i]!;
    if (kanStart[i] || kanSlutt[i]) return start[i] ? e.pos + 5 : e.pos - 5 - e.bredde;
    return Math.max(p0, Math.min(e.pos - e.bredde / 2, p1 - e.bredde));
  };
  const spenn = (i: number): [number, number] => {
    const e = inn[i]!;
    const x = tekstX(i);
    return [Math.min(x, e.pos) - 3, Math.max(x + e.bredde, e.pos) + 3];
  };
  // j sperrer i: streken til i går gjennom teksten til j, så i må stå lavere enn j
  const sperrer = (j: number, i: number) => {
    if (i === j) return false;
    const [a, b] = spenn(j);
    return inn[i]!.pos >= a - 3 && inn[i]!.pos <= b + 3;
  };
  // To tekster som sperrer hverandre: snu den ene hvis den får plass på den andre siden
  for (let runde = 0; runde < n; runde++) {
    let endret = false;
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        if (!sperrer(i, j) || !sperrer(j, i)) continue;
        const [v, h] = inn[i]!.pos <= inn[j]!.pos ? [i, j] : [j, i];
        if (start[v] && kanSlutt[v]) start[v] = false;
        else if (!start[h] && kanStart[h]) start[h] = true;
        else continue;
        endret = true;
      }
    }
    if (!endret) break;
  }
  const rad = new Array<number>(n).fill(0);
  for (let runde = 0; runde < 4 * n + 8; runde++) {
    let endret = false;
    for (let j = 0; j < n; j++) {
      for (let i = 0; i < n; i++) {
        if (sperrer(j, i) && rad[j]! <= rad[i]!) {
          rad[j] = rad[i]! + 1;
          endret = true;
        }
      }
    }
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        if (rad[i] !== rad[j]) continue;
        const [a1, b1] = spenn(i);
        const [a2, b2] = spenn(j);
        if (a1 < b2 + gap && a2 < b1 + gap) {
          // Begge tekstene til høyre for streken: løft den venstre (trapp opp mot venstre), ellers den høyre
          const [v, h] = inn[i]!.pos <= inn[j]!.pos ? [i, j] : [j, i];
          rad[start[v] && start[h] ? v : h]! += 1;
          endret = true;
        }
      }
    }
    if (Math.max(...rad) > n) return null;
    if (!endret) break;
  }
  return {
    flagg: inn.map((e, i) => ({ x: tekstX(i), start: tekstX(i) >= e.pos, rad: rad[i]!, a: spenn(i)[0], b: spenn(i)[1] })),
    rader: Math.max(...rad) + 1,
  };
}

/** Ett flagg i `Flagg`: punktet streken går ned til, teksten og fargen. */
export interface FlaggPunkt {
  /** Punktet flagget peker på (figurens koordinater): et hus, en brønn, en kilde. */
  x: number;
  y: number;
  tekst: string;
  /** Farge på tekst, strek og prikk (standard `VIZ.ink`). */
  farge?: string;
}

/** Props til `Flagg`. */
export interface FlaggProps {
  flagg: readonly FlaggPunkt[];
  /** Grunnlinjen for den nederste raden med tekst (y); flere rader står over den. */
  basis: number;
  /** Området tekstene kan stå innenfor (x fra og til). */
  x0: number;
  x1: number;
  /** Relativ tekststørrelse (standard 0,8). */
  size?: number;
}

/**
 * Tekster som flagg over et landskap eller en blokk: hver tekst står i en rad over `basis` med en tynn loddrett strek
 * ned til punktet sitt (med glorie, så streken synes på alle flater), uten at streker går gjennom tekster eller tekster
 * overlapper (`flaggEtiketter`). Hver rad er 17 · size · f + 7 · f høy, så sett av plass over `basis` til radene. Blir
 * det for trangt, tegnes bare prikkene (gi da færre flagg eller mer bredde). Ankerpunkt: (x, y) i hvert flagg.
 *   <Flagg basis={40} x0={10} x1={790} flagg={[{ x: hus.x, y: hus.y, tekst: 'Bolig' }, { x: b.x, y: b.y, tekst: 'Brønn', farge: GEO.grunnvann.line }]} />
 */
export function Flagg({ flagg, basis, x0, x1, size = 0.8 }: FlaggProps) {
  const f = useTextScale();
  const ss = useGeoStroke();
  const k = useGeoScale();
  const fs = 17 * size * f;
  const synlige = flagg.filter((fl) => Number.isFinite(fl.x) && Number.isFinite(fl.y) && fl.tekst);
  if (synlige.length === 0 || !Number.isFinite(basis)) return null;
  const plass = flaggEtiketter(
    synlige.map((fl) => ({ pos: fl.x, bredde: tekstBredde(fl.tekst, fs) + 4 })),
    Number.isFinite(x0) ? x0 : 0,
    Number.isFinite(x1) ? x1 : 800,
    10 * f,
  );
  const radH = fs + 7 * f;
  return (
    <g>
      {synlige.map((fl, i) => {
        const farge = fl.farge ?? VIZ.ink;
        const pl = plass?.flagg[i];
        const ty = pl ? basis - pl.rad * radH : null;
        return (
          <g key={`${fl.tekst}-${i}`}>
            {ty !== null && (
              <>
                <line x1={fl.x} x2={fl.x} y1={ty - fs * 0.35} y2={fl.y} stroke={VIZ.surface} strokeWidth={3.2 * ss} opacity={0.7} strokeLinecap="round" />
                <line x1={fl.x} x2={fl.x} y1={ty - fs * 0.35} y2={fl.y} stroke={alpha(farge, 0.8)} strokeWidth={1.3 * ss} strokeLinecap="round" />
              </>
            )}
            <circle cx={fl.x} cy={fl.y} r={2.6 * k} fill={farge} stroke={VIZ.surface} strokeWidth={1.1 * ss} />
            {ty !== null && pl && (
              <Txt x={pl.x + 2} y={ty} anchor="start" size={size} weight={650} color={farge}>
                {fl.tekst}
              </Txt>
            )}
          </g>
        );
      })}
    </g>
  );
}

/* ================================================================================================ Fargeforklaring */

/** Én rute i `FlateForklaring`. */
export interface FlateForklaringPunkt {
  label: ReactNode;
  /** En flate (`GeoPaint`, med kanten i `line`) eller en farge (streng). */
  farge: GeoPaint | string;
  /**
   * 'flate' (standard): rute med fyll og kant. 'linje': strek (stiplet med `stiplet`). 'stjerne': jordskjelv. 'prikk':
   * en fylt sirkel (korn, isotoper, brønner). 'monster': ruta fylt med mønsteret `monster` (bergart eller løsmasse).
   */
  form?: 'flate' | 'linje' | 'stjerne' | 'prikk' | 'monster';
  /** Mønsteret når `form` er 'monster'. */
  monster?: MonsterId;
  stiplet?: boolean;
}

/** Femtakket stjerne (som jordskjelvsymbolet i Plategrense). */
function stjerne(x: number, y: number, R: number): string {
  const p: string[] = [];
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const r = i % 2 === 0 ? R : R * 0.45;
    p.push(`${i ? 'L' : 'M'}${(x + r * Math.cos(a)).toFixed(2)} ${(y + r * Math.sin(a)).toFixed(2)}`);
  }
  return `${p.join('')}Z`;
}

/** Ruta med mønster i en forklaring (egen liten SVG med egne mønster-id-er). */
function MonsterRute({ type, line }: { type: MonsterId; line: string }) {
  const m = useLagMonstre('forklaring');
  return (
    <svg aria-hidden width={22} height={14} viewBox="0 0 22 14" style={{ overflow: 'visible', flex: 'none' }}>
      <LagMonstre id={m.id} bare={[type]} />
      <rect x={0.5} y={0.5} width={21} height={13} rx={2.5} fill={lagFyll(type, m.id).fill} stroke={line} strokeWidth={1} />
    </svg>
  );
}

/**
 * Fargeforklaring under en figur, som `Legend` i det felles kit-et (samme stil, HTML under figuren), men med ruter for
 * flater: fyll og en tydelig kant (`GeoPaint.line`, eller `VIZ.muted` for en ren farge), så også mørke flater synes i
 * mørkt tema (høydelag, omvendt polaritet, mettet sone). Kan også vise mønstre (bergarter og løsmasser), stjerner
 * (jordskjelv), prikker og streker. Bruk den i `VizLayout`s forklaring under figuren, ikke inne i SVG-en.
 *   <FlateForklaring items={[{ label: 'Normal polaritet', farge: GEO.polaritet.normal }, { label: 'Omvendt', farge: GEO.polaritet.omvendt }]} />
 *   <FlateForklaring items={GEO.hoydelag.map((c, i) => ({ label: `${i * 200}–${(i + 1) * 200} m`, farge: c }))} />
 *   <FlateForklaring items={[{ label: 'Sand', farge: GEO.bergart.sand, form: 'monster', monster: 'sand' }]} />
 */
export function FlateForklaring({ items }: { items: readonly FlateForklaringPunkt[] }) {
  return (
    <ul className="viz-legend" role="list">
      {items.map((it, i) => {
        const fill = typeof it.farge === 'string' ? it.farge : it.farge.fill;
        const line = typeof it.farge === 'string' ? VIZ.muted : it.farge.line;
        const form = it.form ?? 'flate';
        return (
          <li key={i}>
            {form === 'flate' ? (
              <span aria-hidden style={{ display: 'inline-block', flex: 'none', width: 20, height: 13, borderRadius: 3, background: fill, border: `1.5px solid ${line}` }} />
            ) : form === 'monster' && it.monster ? (
              <MonsterRute type={it.monster} line={line} />
            ) : form === 'stjerne' ? (
              <svg aria-hidden width={18} height={18} viewBox="-9 -9 18 18" style={{ overflow: 'visible', flex: 'none' }}>
                <path d={stjerne(0, 0.6, 7.5)} fill={fill} stroke={VIZ.ink} strokeWidth={0.9} strokeLinejoin="round" />
              </svg>
            ) : form === 'prikk' ? (
              <svg aria-hidden width={14} height={14} viewBox="-7 -7 14 14" style={{ flex: 'none' }}>
                <circle r={5} fill={fill} stroke={typeof it.farge === 'string' ? VIZ.surface : line} strokeWidth={1.2} />
              </svg>
            ) : (
              <span className={`viz-legend-swatch${it.stiplet ? ' is-dashed' : ''}`} style={{ '--c': fill } as CSSProperties} aria-hidden />
            )}
            {it.label}
          </li>
        );
      })}
    </ul>
  );
}

/* ================================================================================================ LogPlot */

/** Én akse i `LogPlot`. */
export interface LogAkse {
  /** Den ene enden av aksen (venstre eller nederst, med mindre `reverse`). Må være > 0 på en logaritmisk akse. */
  min: number;
  /** Den andre enden av aksen (høyre eller øverst). */
  max: number;
  /** Aksetittel med enhet i parentes, f.eks. «Kornstørrelse (mm)». */
  label?: ReactNode;
  /** Logaritmisk akse (tierpotenser med like stor avstand). Standard lineær. */
  log?: boolean;
  /** Faste hovedverdier med etikett og rutenettlinje. Standard: hele tierpotenser (log) eller «pene» tall (lineær), tynnet ut så etikettene ikke overlapper. */
  ticks?: readonly number[];
  /** Hjelpelinjer uten etikett: `true` (standard på log-akser: 2, 3 … 9 ganger tierpotensene), `false` eller egne verdier. */
  minor?: boolean | readonly number[];
  /** Desimaler på etikettene på en lineær akse. Standard: så mange som akseverdiene trenger. */
  decimals?: number;
  /** Egen etikett for en verdi (f.eks. månedsnavn eller «1 mill. år»). */
  format?: (v: number) => string;
  /** Hvordan en log-akse skriver tallene: `'auto'` (standard: 0,01 … 10 000, ellers 10⁻⁵), `'potens'` eller `'desimal'`. */
  form?: LogEtikettValg['form'];
  /** Snu aksen: `max` til venstre (eller nederst). */
  reverse?: boolean;
  /** Farge på akseverdiene og tittelen (f.eks. lik kurven som hører til en høyreakse). */
  color?: string;
  /** Rutenettlinjer for denne aksen. Standard: på for x og y, av for høyreaksen y2. */
  grid?: boolean;
}

/** Skalaene og plotteområdet som barna i `LogPlot` får. */
export interface LogPlotSkalaer {
  /** x-verdi → SVG-x. */
  sx: (v: number) => number;
  /** y-verdi (venstre akse) → SVG-y. */
  sy: (v: number) => number;
  /** y-verdi på høyreaksen → SVG-y (samme som `sy` når det ikke er noen høyreakse). */
  sy2: (v: number) => number;
  /** SVG-x → x-verdi (til dra-punkter). */
  ix: (px: number) => number;
  /** SVG-y → y-verdi. */
  iy: (px: number) => number;
  /** SVG-y → verdi på høyreaksen. */
  iy2: (px: number) => number;
  /** Plotteområdet: venstre, høyre, nederst (y0) og øverst (y1). */
  x0: number;
  x1: number;
  y0: number;
  y1: number;
  /** `url(#…)` til en clipPath for plotteområdet, til enkeltelementer som skal klippes. */
  clip: string;
}

/** Props til `LogPlot`: aksene, størrelsen, hjørnet `at` og barna (en funksjon av skalaene). */
export interface LogPlotProps {
  x: LogAkse;
  y: LogAkse;
  /** Valgfri høyreakse med egen skala (f.eks. nedbør i et klimadiagram). Barna får `sy2`. */
  y2?: LogAkse;
  width: number;
  height: number;
  /** Øvre venstre hjørne i figuren (standard [0, 0]). */
  at?: readonly [number, number];
  /** Marger rundt plotteområdet. Standard: nok plass til akseverdiene og titlene, og mer på mobil. */
  margin?: Partial<{ top: number; right: number; bottom: number; left: number }>;
  /** Rutenett (standard på). */
  grid?: boolean;
  /** Klipp barna til plotteområdet (standard av; `clip` i barna kan brukes på enkeltelementer). */
  clip?: boolean;
  /** Tydelig linje ved y = 0 på en lineær y-akse som går gjennom 0 (f.eks. 0 °C). */
  zeroLine?: boolean;
  children?: (s: LogPlotSkalaer) => ReactNode;
}

const harTittel = (a: LogAkse | undefined) => a !== undefined && a.label !== undefined && a.label !== null && a.label !== '';

/** Desimalene akseverdiene trenger (høyst 4): [0, 0,5, 1] → 1. */
function desimalerFor(verdier: readonly number[]): number {
  let d = 0;
  for (const v of verdier) {
    let k = 0;
    while (k < 4 && Math.abs(Math.round(v * 10 ** k) - v * 10 ** k) > 1e-6 * Math.max(1, Math.abs(v) * 10 ** k)) k++;
    d = Math.max(d, k);
  }
  return d;
}

interface Skala {
  s: (v: number) => number;
  inv: (px: number) => number;
}

function lagSkala(a: LogAkse, r0: number, r1: number): Skala {
  const lo = Math.min(a.min, a.max);
  const hi = Math.max(a.min, a.max);
  const range: [number, number] = a.reverse ? [r1, r0] : [r0, r1];
  if (a.log) return { s: scaleLog([lo, hi], range), inv: scaleLogInvert([lo, hi], range) };
  if (!Number.isFinite(lo) || !Number.isFinite(hi)) {
    const midt = (r0 + r1) / 2;
    return { s: () => midt, inv: () => 0 };
  }
  const s = scaleLinear([lo, hi], range);
  const inv = range[0] === range[1] ? () => lo : scaleLinear(range, [lo, hi]);
  return { s: (v) => (Number.isFinite(v) ? s(v) : range[0]), inv };
}

interface Merker {
  major: number[];
  minor: number[];
  tekst: string[];
}

/** Om en log-akse fra lo til hi bør skrive alle tallene som tierpotenser (når noen av dem ville blitt det). */
function potensAkse(lo: number, hi: number): boolean {
  return logTicks(lo, hi, 1000).major.some((v) => {
    const k = Math.floor(Math.log10(v) + 1e-9);
    return k < -3 || k > 4;
  });
}

/** Akseverdier og etiketter for en akse med lengden `lengde` (px), tynnet ut så etikettene får plass. */
function akseMerker(a: LogAkse, lengde: number, langs: 'x' | 'y', tickPx: number): Merker {
  const lo = Math.min(a.min, a.max);
  const hi = Math.max(a.min, a.max);
  const eps = 1e-9 * Math.max(1, Math.abs(lo), Math.abs(hi));
  const gyldig = a.log ? Number.isFinite(lo) && Number.isFinite(hi) && lo > 0 && hi > lo : Number.isFinite(lo) && Number.isFinite(hi);
  if (!gyldig) return { major: [], minor: [], tekst: [] };
  const inne = (v: number) => Number.isFinite(v) && v >= lo - eps && v <= hi + eps && (!a.log || v > 0);
  // Én form på hele log-aksen: tierpotenser overalt hvis noen av tallene ville blitt det
  const form = a.log && (a.form ?? 'auto') === 'auto' && potensAkse(lo, hi) ? 'potens' : a.form;
  const etikett = (v: number, d: number) => (a.format ? a.format(v) : a.log ? logEtikett(v, { form }) : fmtTall(v, d));
  const plass = (verdier: readonly number[]) => {
    if (langs === 'y') return tickPx * 1.6;
    const d = a.decimals ?? desimalerFor(verdier);
    return Math.max(tickPx, ...verdier.map((v) => tekstBredde(etikett(v, d), tickPx))) + tickPx * 1.1;
  };
  let major: number[];
  let minor: number[] = Array.isArray(a.minor) ? (a.minor as number[]).filter(inne) : [];
  // Hjelpelinjer på log-aksen: 2–9 når det er god plass per tierpotens, bare 2 og 5 når det er trangt, ellers ingen
  const tynnMinor = (liste: readonly number[]) => {
    const perTier = lengde / Math.max(1e-9, Math.log10(hi / lo));
    if (perTier >= 60) return [...liste];
    if (perTier < 28) return [];
    return liste.filter((v) => {
      const m = Math.round(v / 10 ** Math.floor(Math.log10(v) + 1e-9));
      return m === 2 || m === 5;
    });
  };
  if (a.ticks) {
    major = a.ticks.filter(inne);
    if (a.log && a.minor !== false && !Array.isArray(a.minor)) {
      const alle = logTicks(lo, hi, 10_000);
      minor = tynnMinor([...alle.major, ...alle.minor].filter((v) => !major.some((m) => Math.abs(m - v) <= 1e-9 * v)));
    }
  } else if (a.log) {
    let t = logTicks(lo, hi, 12);
    const kap = Math.max(2, Math.floor(lengde / plass(t.major)) + 1);
    if (t.major.length > kap) t = logTicks(lo, hi, kap);
    major = t.major;
    if (a.minor !== false && !Array.isArray(a.minor)) minor = tynnMinor(t.minor);
  } else {
    let antall = langs === 'x' ? 6 : 5;
    major = niceTicks(lo, hi, antall);
    for (let i = 0; i < 5 && antall > 2; i++) {
      if ((major.length - 1) * plass(major) <= lengde) break;
      antall = Math.max(2, Math.floor(antall * 0.65));
      major = niceTicks(lo, hi, antall);
    }
  }
  const d = a.decimals ?? desimalerFor(major);
  return { major, minor, tekst: major.map((v) => etikett(v, d)) };
}

/** Indeksene til etikettene som får plass uten å overlappe (grådig fra starten av aksen). */
function synligeEtiketter(pos: readonly number[], bredder: readonly number[], gap: number): Set<number> {
  const rekke = pos.map((p, i) => ({ p, i })).sort((a, b) => a.p - b.p);
  const vis = new Set<number>();
  let slutt = -Infinity;
  for (const { p, i } of rekke) {
    const b = bredder[i] ?? 0;
    if (p - b / 2 >= slutt + gap) {
      vis.add(i);
      slutt = p + b / 2;
    }
  }
  return vis;
}

/**
 * Plott med logaritmisk x-akse, y-akse eller begge, og en valgfri ekstra høyreakse (`y2`). Øvre venstre hjørne er `at`
 * (standard [0, 0]), og plotteområdet ligger innenfor margene. Samme stil som `Plot` i det felles kit-et: rutenett,
 * akseverdier og aksetitler som vokser på mobil. Tierpotenser skrives på norsk («0,01», «1000»,
 * «10 000», «10⁻⁵»), og log-aksene får svake hjelpelinjer ved 2, 3 … 9. Etikettene tynnes ut så de ikke overlapper, og
 * margene tilpasses de bredeste tallene. Barna får skalaene:
 *   <LogPlot x={{ min: 0.001, max: 1000, log: true, label: 'Kornstørrelse (mm)' }}
 *            y={{ min: 0.001, max: 10, log: true, label: 'Fart (m/s)' }} width={800} height={geoHoyde(f, 420)}>
 *     {({ sx, sy }) => <path d={linePath(punkter, sx, sy)} … />}
 *   </LogPlot>
 * Brukes av Hjulström-diagrammet, vulkaner (VEI), Kornkurve, sikteanalyse og flomfrekvens, og (med lineære akser) av
 * `Klimadiagram`. Verdier ≤ 0 på en log-akse legges på kanten, aldri NaN.
 */
export function LogPlot({ x, y, y2, width, height, at, margin, grid = true, clip = false, zeroLine = false, children }: LogPlotProps) {
  const f = useTextScale();
  const id = useSvgId('logplot');
  const tickPx = 15 * f;
  const titlePx = 15.6 * f;
  const top = margin?.top ?? 20 * f;
  const bottom = margin?.bottom ?? (harTittel(x) ? 22 * f + 10 + titlePx * 1.1 : 22 * f + 12);
  const yLen = Math.max(10, height - top - bottom);
  const ym = akseMerker(y, yLen, 'y', tickPx);
  const y2m = y2 ? akseMerker(y2, yLen, 'y', tickPx) : null;
  const bredest = (m: Merker | null) => (m ? Math.max(0, ...m.tekst.map((t) => tekstBredde(t, tickPx))) : 0);
  const left = margin?.left ?? (harTittel(y) ? titlePx * 1.25 + 14 : 8) + bredest(ym) + 10;
  const xLenAnslag = width - left - (margin?.right ?? (y2 ? 60 * f : 24 * f));
  const xm = akseMerker(x, Math.max(10, xLenAnslag), 'x', tickPx);
  const xEnde = xm.tekst.length ? tekstBredde(xm.tekst[x.reverse ? 0 : xm.tekst.length - 1]!, tickPx) : 0;
  const right = margin?.right ?? (y2 ? 10 + bredest(y2m) + (harTittel(y2) ? titlePx * 1.25 + 14 : 8) : Math.max(24 * f, xEnde / 2 + 6));

  const x0 = left;
  const x1 = Math.max(x0 + 10, width - right);
  const y0 = Math.max(top + 10, height - bottom);
  const y1 = top;
  const SX = lagSkala(x, x0, x1);
  const SY = lagSkala(y, y0, y1);
  const SY2 = y2 ? lagSkala(y2, y0, y1) : SY;

  const xPos = xm.major.map(SX.s);
  const xVis = synligeEtiketter(
    xPos,
    xm.tekst.map((t) => tekstBredde(t, tickPx)),
    tickPx * 0.6,
  );
  const yVis = synligeEtiketter(
    ym.major.map(SY.s),
    ym.major.map(() => tickPx * 1.05),
    tickPx * 0.25,
  );
  const y2Vis = y2m
    ? synligeEtiketter(
        y2m.major.map(SY2.s),
        y2m.major.map(() => tickPx * 1.05),
        tickPx * 0.25,
      )
    : new Set<number>();
  const gridX = grid && x.grid !== false;
  const gridY = grid && y.grid !== false;
  const gridY2 = grid && y2?.grid === true;
  const ylo = Math.min(y.min, y.max);
  const yhi = Math.max(y.min, y.max);
  const nullY = zeroLine && !y.log && ylo < 0 && yhi > 0 ? SY.s(0) : null;
  const tittelX = (x0 + x1) / 2;
  const tittelY = (y0 + y1) / 2;
  const fargeStil = (c: string | undefined) => (c ? { fill: c } : undefined);

  const skalaer: LogPlotSkalaer = {
    sx: SX.s,
    sy: SY.s,
    sy2: SY2.s,
    ix: SX.inv,
    iy: SY.inv,
    iy2: SY2.inv,
    x0,
    x1,
    y0,
    y1,
    clip: `url(#${id})`,
  };
  return (
    <g className="viz-plot" transform={at ? `translate(${at[0]} ${at[1]})` : undefined}>
      <defs>
        <clipPath id={id}>
          <rect x={x0} y={y1} width={x1 - x0} height={y0 - y1} />
        </clipPath>
      </defs>
      {gridX &&
        xm.minor.map((v) => <line key={`mx${v}`} x1={SX.s(v)} x2={SX.s(v)} y1={y0} y2={y1} className="viz-gridline" opacity={0.45} />)}
      {gridY &&
        ym.minor.map((v) => <line key={`my${v}`} x1={x0} x2={x1} y1={SY.s(v)} y2={SY.s(v)} className="viz-gridline" opacity={0.45} />)}
      {gridY2 &&
        y2m?.minor.map((v) => <line key={`my2${v}`} x1={x0} x2={x1} y1={SY2.s(v)} y2={SY2.s(v)} className="viz-gridline" opacity={0.45} />)}
      {gridX && xm.major.map((v) => <line key={`gx${v}`} x1={SX.s(v)} x2={SX.s(v)} y1={y0} y2={y1} className="viz-gridline" />)}
      {gridY && ym.major.map((v) => <line key={`gy${v}`} x1={x0} x2={x1} y1={SY.s(v)} y2={SY.s(v)} className="viz-gridline" />)}
      {gridY2 && y2m?.major.map((v) => <line key={`gy2${v}`} x1={x0} x2={x1} y1={SY2.s(v)} y2={SY2.s(v)} className="viz-gridline" />)}
      {nullY !== null && <line x1={x0} x2={x1} y1={nullY} y2={nullY} className="viz-axis" />}
      <line x1={x0} x2={x1} y1={y0} y2={y0} className="viz-axis" />
      <line x1={x0} x2={x0} y1={y0} y2={y1} className="viz-axis" />
      {y2 && <line x1={x1} x2={x1} y1={y0} y2={y1} className="viz-axis" />}
      {xm.major.map((v, i) =>
        xVis.has(i) ? (
          <text key={`tx${v}`} x={xPos[i]} y={y0 + 22 * f} textAnchor="middle" className="viz-tick" style={fargeStil(x.color)}>
            {xm.tekst[i]}
          </text>
        ) : null,
      )}
      {ym.major.map((v, i) =>
        yVis.has(i) ? (
          <text key={`ty${v}`} x={x0 - 10} y={SY.s(v) + 5 * f} textAnchor="end" className="viz-tick" style={fargeStil(y.color)}>
            {ym.tekst[i]}
          </text>
        ) : null,
      )}
      {y2m?.major.map((v, i) =>
        y2Vis.has(i) ? (
          <text key={`ty2${v}`} x={x1 + 10} y={SY2.s(v) + 5 * f} textAnchor="start" className="viz-tick" style={fargeStil(y2?.color)}>
            {y2m.tekst[i]}
          </text>
        ) : null,
      )}
      {harTittel(x) && (
        <text x={tittelX} y={y0 + 22 * f + 6 + titlePx * 0.9} textAnchor="middle" className="viz-axis-label" style={fargeStil(x.color)}>
          {x.label}
        </text>
      )}
      {harTittel(y) && (
        <text
          x={4 + titlePx * 0.8}
          y={tittelY}
          textAnchor="middle"
          className="viz-axis-label"
          transform={`rotate(-90 ${4 + titlePx * 0.8} ${tittelY})`}
          style={fargeStil(y.color)}
        >
          {y.label}
        </text>
      )}
      {y2 && harTittel(y2) && (
        <text
          x={width - 4 - titlePx * 0.22}
          y={tittelY}
          textAnchor="middle"
          className="viz-axis-label"
          transform={`rotate(-90 ${width - 4 - titlePx * 0.22} ${tittelY})`}
          style={fargeStil(y2.color)}
        >
          {y2.label}
        </text>
      )}
      {children && (clip ? <g clipPath={`url(#${id})`}>{children(skalaer)}</g> : children(skalaer))}
    </g>
  );
}

/* ================================================================================================ Klimadiagram */

/** Forbokstavene i månedene, januar til desember (som i PDF-malen). */
export const KLIMA_MAANEDER: readonly string[] = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];

/** Aksene i et klimadiagram: resultatet av `klimaAkser`. */
export interface KlimaAkser {
  /** Temperaturaksen (venstre) i °C. */
  tMin: number;
  tMaks: number;
  tSteg: number;
  /** Nedbøraksen (høyre) i mm, fra 0. */
  nMaks: number;
  nSteg: number;
  /** Antall intervaller (likt på begge aksene, så rutenettet passer til begge). */
  intervaller: number;
}

const NEDBOR_STEG = [5, 10, 20, 25, 50, 100, 200, 250, 500, 1000];

/**
 * Aksene til et klimadiagram: temperaturen fra minst −10 til 20 °C (utvidet i steg på 5 eller 10 °C), og nedbøren fra
 * 0 med et pent steg, slik at begge aksene har like mange intervaller og deler rutenett. Ugyldige tall hoppes over.
 *
 * @param temperatur Månedsmiddeltemperatur i °C (12 verdier).
 * @param nedbor Månedsnedbør i mm (12 verdier).
 * @param temperaturOmrade Fast temperaturområde [min, maks].
 * @param nedborMaks Fast øvre grense for nedbøraksen.
 */
export function klimaAkser(
  temperatur: readonly number[],
  nedbor: readonly number[],
  temperaturOmrade?: readonly [number, number],
  nedborMaks?: number,
): KlimaAkser {
  const T = temperatur.filter(Number.isFinite);
  const P = nedbor.filter((p) => Number.isFinite(p) && p >= 0);
  let lo = temperaturOmrade?.[0];
  let hi = temperaturOmrade?.[1];
  const fast = lo !== undefined && hi !== undefined && Number.isFinite(lo) && Number.isFinite(hi) && hi > lo;
  if (!fast) {
    lo = Math.min(-10, T.length ? Math.min(...T) : 0);
    hi = Math.max(20, T.length ? Math.max(...T) : 0);
  }
  let steg = hi! - lo! > 40 ? 10 : 5;
  if (!fast) {
    lo = Math.floor(lo! / steg) * steg;
    hi = Math.ceil(hi! / steg) * steg;
  } else {
    const n = (hi! - lo!) / steg;
    if (Math.abs(n - Math.round(n)) > 1e-9) steg = (hi! - lo!) / Math.max(1, Math.round((hi! - lo!) / steg));
  }
  const intervaller = Math.max(1, Math.round((hi! - lo!) / steg));
  let nSteg: number;
  if (nedborMaks !== undefined && Number.isFinite(nedborMaks) && nedborMaks > 0) nSteg = nedborMaks / intervaller;
  else {
    const behov = (P.length ? Math.max(...P) : 0) * 1.06;
    nSteg = NEDBOR_STEG.find((s) => s * intervaller >= behov) ?? Math.ceil(behov / intervaller / 1000) * 1000;
  }
  return { tMin: lo!, tMaks: hi!, tSteg: steg, nMaks: nSteg * intervaller, nSteg, intervaller };
}

/** Props til `Klimadiagram`: tolv måneder med temperatur og nedbør, størrelse og valg. */
export interface KlimadiagramProps {
  /** Månedsmiddeltemperatur i °C, januar til desember (12 verdier; ugyldige tall hoppes over). */
  temperatur: readonly number[];
  /** Månedsnedbør i mm, januar til desember. */
  nedbor: readonly number[];
  /** Bredde i figurens enheter (standard 800). */
  width?: number;
  /** Høyde (standard 320 + 260 · (f − 1), som `geoHoyde(f, 320)`; bruk samme høyde i viewBox-en). */
  height?: number;
  /** Øvre venstre hjørne (standard [0, 0]). */
  at?: readonly [number, number];
  /** Fast temperaturområde [min, maks] i °C (standard: minst −10 til 20). */
  temperaturOmrade?: readonly [number, number];
  /** Fast øvre grense for nedbøraksen i mm. */
  nedborMaks?: number;
  /** Stiplet linje ved 0 °C (frostmånedene ligger under). */
  nullLinje?: boolean;
  /** Blå søyler og rød kurve i stedet for grå søyler og mørk kurve (som PDF-malen gjør når eleven har farget). */
  farget?: boolean;
  /**
   * Uthev én måned (0 = januar): kolonnen tones, og et skilt over diagrammet viser temperaturen og nedbøren. Med `null`
   * holdes plassen til skiltet av uten at noe er markert, så diagrammet ikke hopper når eleven velger og fjerner en måned.
   */
  markert?: number | null;
  /** Månedsnavnene på x-aksen (standard J, F, M …). */
  maaneder?: readonly string[];
  /** Navnet på stasjonen øverst til venstre, f.eks. «Bergen (12 m o.h.)». */
  sted?: string;
  /** Skriv årsmiddeltemperatur og årsnedbør øverst til høyre. */
  visSnitt?: boolean;
  /** Ekstra tegning oppå, med skalaene (temperatur: `sy`, nedbør: `sy2`, måned 1–12: `sx`). */
  children?: (s: LogPlotSkalaer) => ReactNode;
}

/**
 * Klimadiagram som i PDF-malen «Atlas»: nedbøren som grå søyler mot høyre akse og temperaturen som mørk kurve med
 * punkter mot venstre akse, én verdi per måned. Øvre venstre hjørne er `at` (standard [0, 0]). Aksene deler rutenett (like mange intervaller, `klimaAkser`), og
 * temperaturen går fra minst −10 til 20 °C. Valgfritt: 0 °C-linje, farget utgave, uthevet måned og stasjonsnavn med
 * årsmiddel og årsnedbør. Bygd på `LogPlot` med lineære akser. Høyden bør være `geoHoyde(f, 320)` (høyere på mobil):
 *   const [ref, f] = useContainerTextScale<HTMLDivElement>();
 *   <div ref={ref}><Figure viewBox={`0 0 800 ${geoHoyde(f, 320)}`} label="Klimadiagram for Bergen">
 *     <Klimadiagram temperatur={T} nedbor={P} sted="Bergen" visSnitt nullLinje />
 *   </Figure></div>
 */
export function Klimadiagram({
  temperatur,
  nedbor,
  width = 800,
  height,
  at,
  temperaturOmrade,
  nedborMaks,
  nullLinje = false,
  farget = false,
  markert,
  maaneder = KLIMA_MAANEDER,
  sted,
  visSnitt = false,
  children,
}: KlimadiagramProps) {
  const f = useTextScale();
  const k = useGeoScale();
  const ss = useGeoStroke();
  const H = height ?? geoHoyde(f, 320);
  const A = klimaAkser(temperatur, nedbor, temperaturOmrade, nedborMaks);
  const tTicks = Array.from({ length: A.intervaller + 1 }, (_, i) => A.tMin + i * A.tSteg);
  const nTicks = Array.from({ length: A.intervaller + 1 }, (_, i) => i * A.nSteg);
  const kurveFarge = farget ? GEO.fare[3]! : VIZ.ink;
  const soyleKant = farget ? GEO.nedbor : VIZ.muted;
  const soyleFyll = farget ? alpha(GEO.nedbor, 0.42) : alpha(VIZ.muted, 0.3);
  const T = temperatur.slice(0, 12);
  const P = nedbor.slice(0, 12);
  const gyldigeT = T.filter(Number.isFinite);
  const middel = gyldigeT.length ? gyldigeT.reduce((s, v) => s + v, 0) / gyldigeT.length : NaN;
  const sum = P.filter((p) => Number.isFinite(p) && p >= 0).reduce((s, v) => s + v, 0);
  const snittTekst = `Årsmiddel ${fmt(middel, 1)} °C · årsnedbør ${fmtTall(sum, 0)} mm`;
  const toLinjer = sted !== undefined && visSnitt && f > 1.25;
  const harMarkert = markert !== null && markert !== undefined && Number.isFinite(markert) && markert >= -0.5 && markert < 11.5;
  const sm = harMarkert ? Math.round(markert) : 0;
  // Raden for skiltet over den markerte måneden holdes av når propen er gitt (også null), så diagrammet ikke hopper
  const skiltPx = 17 * 0.8 * f;
  const skiltH = skiltPx * 1.55;
  const skiltRad = markert !== undefined ? skiltH + 12 : 0;
  const stedRad = sted !== undefined || visSnitt ? (toLinjer ? 46 * f : 26 * f) : 0;
  const topp = 20 * f + stedRad + skiltRad - (skiltRad > 0 && stedRad > 0 ? 4 * f : 0);
  const nedborTekst = farget ? shade(GEO.nedbor, 0.08) : VIZ.muted;
  return (
    <LogPlot
      at={at}
      width={width}
      height={H}
      margin={{ top: topp }}
      x={{ min: 0.5, max: 12.5, ticks: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], format: (v) => maaneder[Math.round(v) - 1] ?? '', grid: false }}
      y={{ min: A.tMin, max: A.tMaks, ticks: tTicks, label: 'Temperatur (°C)', decimals: 0, color: farget ? kurveFarge : undefined }}
      y2={{ min: 0, max: A.nMaks, ticks: nTicks, label: 'Nedbør (mm)', color: farget ? GEO.nedbor : undefined }}
    >
      {(s) => {
        const { sx, sy, sy2, x0, x1, y0, y1 } = s;
        const dx = sx(2) - sx(1);
        const bw = dx * 0.62;
        const punkter: [number, number][] = T.map((t, i) => [i + 1, t]);
        const mT = harMarkert ? T[sm] : undefined;
        const mP = harMarkert ? P[sm] : undefined;
        // Skiltet over den markerte kolonnen: temperaturen i kurvefargen og nedbøren i søylefargen
        const mx = sx(sm + 1);
        const tDel = mT !== undefined && Number.isFinite(mT) ? `${fmt(mT, 1)} °C` : '– °C';
        const pDel = mP !== undefined && Number.isFinite(mP) && mP >= 0 ? `${fmtTall(mP, 0)} mm` : '– mm';
        const skiltW = tekstBredde(`${tDel} · ${pDel}`, skiltPx) + 22 * f;
        const skiltX = Math.min(x1 - skiltW / 2, Math.max(x0 + skiltW / 2, mx));
        const skiltY = y1 - 8 - skiltH / 2;
        const sstedY = y1 - skiltRad + (skiltRad > 0 && stedRad > 0 ? 4 * f : 0);
        return (
          <g>
            {harMarkert && (
              <g>
                <rect x={mx - dx / 2} y={y1} width={dx} height={y0 - y1} fill={alpha(VIZ.ink, 0.08)} />
                <polygon
                  points={`${mx - 6 * ss},${skiltY + skiltH / 2 - 1} ${mx + 6 * ss},${skiltY + skiltH / 2 - 1} ${mx},${y1 + 1}`}
                  fill={VIZ.surface}
                  stroke={alpha(VIZ.ink, 0.35)}
                  strokeWidth={1 * ss}
                  strokeLinejoin="round"
                />
                <rect
                  x={skiltX - skiltW / 2}
                  y={skiltY - skiltH / 2}
                  width={skiltW}
                  height={skiltH}
                  rx={skiltH * 0.32}
                  fill={VIZ.surface}
                  stroke={alpha(VIZ.ink, 0.35)}
                  strokeWidth={1 * ss}
                />
                <rect x={mx - 6 * ss + 1.2 * ss} y={skiltY + skiltH / 2 - 2.2 * ss} width={12 * ss - 2.4 * ss} height={2.6 * ss} fill={VIZ.surface} />
                <Txt x={skiltX} y={skiltY + skiltPx * 0.34} size={0.8} weight={700} halo={false}>
                  <tspan style={{ fill: kurveFarge }}>{tDel}</tspan>
                  <tspan style={{ fill: VIZ.muted }}>{' · '}</tspan>
                  <tspan style={{ fill: nedborTekst }}>{pDel}</tspan>
                </Txt>
              </g>
            )}
            {P.map((p, i) =>
              Number.isFinite(p) && p > 0 ? (
                <rect
                  key={`p${i}`}
                  x={sx(i + 1) - bw / 2}
                  y={Math.min(sy2(p), y0)}
                  width={bw}
                  height={Math.max(0, y0 - sy2(p))}
                  fill={harMarkert && i === sm ? alpha(soyleKant, farget ? 0.7 : 0.55) : soyleFyll}
                  stroke={soyleKant}
                  strokeWidth={(harMarkert && i === sm ? 1.8 : 1.2) * ss}
                />
              ) : null,
            )}
            {nullLinje && A.tMin < 0 && A.tMaks > 0 && (
              <g>
                <line x1={x0} x2={x1} y1={sy(0)} y2={sy(0)} stroke={kurveFarge} strokeWidth={1.6 * ss} strokeDasharray="7 5" opacity={0.75} />
                <Txt x={x0 + 8} y={sy(0) - 6} anchor="start" size={0.68} muted>
                  0 °C
                </Txt>
              </g>
            )}
            <path d={linePath(punkter, sx, sy)} fill="none" stroke={VIZ.surface} strokeWidth={5.5 * ss} strokeLinejoin="round" strokeLinecap="round" />
            <path d={linePath(punkter, sx, sy)} fill="none" stroke={kurveFarge} strokeWidth={2.6 * ss} strokeLinejoin="round" strokeLinecap="round" />
            {T.map((t, i) =>
              Number.isFinite(t) ? (
                <circle
                  key={`t${i}`}
                  cx={sx(i + 1)}
                  cy={sy(t)}
                  r={(harMarkert && i === sm ? 6 : 4.2) * k}
                  fill={kurveFarge}
                  stroke={VIZ.surface}
                  strokeWidth={(harMarkert && i === sm ? 2 : 1.5) * ss}
                />
              ) : null,
            )}
            {sted !== undefined && (
              <Txt x={x0} y={sstedY - (toLinjer ? 34 * f : 12 * f)} anchor="start" size={0.95} weight={700}>
                {sted}
              </Txt>
            )}
            {visSnitt && (
              <Txt x={toLinjer || sted === undefined ? x0 : x1} y={sstedY - 12 * f} anchor={toLinjer || sted === undefined ? 'start' : 'end'} size={0.78} muted>
                {snittTekst}
              </Txt>
            )}
            {children?.(s)}
          </g>
        );
      }}
    </LogPlot>
  );
}

/* ================================================================================================ GeoTidslinje */

/** En hendelse på tidslinja (som `GeoHendelse` i geotid.ts, så `GEO_HENDELSER` kan brukes direkte). */
export interface TidsHendelse {
  /** Alder i millioner år (starten når hendelsen varte lenge). */
  alder: number;
  /** Slutten i millioner år for hendelser som varte lenge (tegnes som en strek langs båndene). */
  slutt?: number;
  /** Kort tekst. */
  tekst: string;
  /** Farge på merket (standard VIZ.ink). */
  farge?: string;
}

/** Enheten på tidsaksen i `GeoTidslinje`: millioner år, tusen år, år eller valgt etter zoomen (`'auto'`). */
export type Tidsenhet = 'auto' | 'millioner' | 'tusen' | 'år';

/** Props til `GeoTidslinje` (og `tidslinjeGeometri`): boksen, retningen, zoomen, nivåene og hendelsene. */
export interface GeoTidslinjeProps {
  /** Øvre venstre hjørne av boksen tidslinja tegnes i. */
  x?: number;
  y?: number;
  /** Boksens bredde og høyde. Vannrett går tidsaksen over hele bredden (eldst til venstre), loddrett over hele høyden (eldst nederst). */
  width: number;
  height: number;
  /** `'vannrett'` (standard) eller `'loddrett'` (som ICS-kartet, best på mobil og med mange hendelser). */
  retning?: 'vannrett' | 'loddrett';
  /** Eldste alder som vises, i millioner år (standard jordas alder, 4567). Sammen med `til` er dette zoomen. */
  fra?: number;
  /** Yngste alder som vises, i millioner år (standard 0 = i dag; på en log-akse brukes 0,0001 = 100 år når den er 0). */
  til?: number;
  /** `'lineaer'` (standard) eller `'log'` (de siste millioner årene får like mye plass som milliardene før). */
  skala?: 'lineaer' | 'log';
  /** Enheten på aksen: `'auto'` (standard: millioner år, tusen år eller år etter zoomen; «1 mill. år» osv. på log-akse). */
  enhet?: Tidsenhet;
  /** Hvilke nivåer som vises som bånd, i rekkefølge ovenfra (vannrett) eller fra venstre (loddrett). Standard eon, era og periode. */
  niva?: readonly TidsNiva[];
  /** Ett felles bånd «Prekambrium» over alle radene før kambrium (som i mange lærebøker). */
  samlePrekambrium?: boolean;
  /** Tykkelsen på hvert bånd i px (standard: vannrett 30 · f med hendelser, ellers fyller båndene boksen). */
  baand?: number;
  /** Tidsakse med tall og tittel (standard på). */
  akse?: boolean;
  /** Egen aksetittel (standard «millioner år siden» osv.); tom streng fjerner den. */
  aksetittel?: string;
  /**
   * Hendelser med merke og tekst (f.eks. `GEO_HENDELSER`). Vannrett står tekstene som flagg over båndene; er det for
   * trangt, blir merkene nummerert (eldst først) med en nummerert liste over. Loddrett står tekstene til høyre.
   */
  hendelser?: readonly TidsHendelse[];
  /** En markør (f.eks. fra en glidebryter) ved denne alderen, med alderen som skilt. */
  markor?: number | null;
  /** Egen tekst på markøren (standard: `fmtAlder(alder, { siden: true })`). */
  markorTekst?: string;
  /** Uthev intervallet med denne id-en (f.eks. `periodeVed(alder)?.id`). */
  markert?: string | null;
  /** Ramme rundt et utsnitt (til en zoomet tidslinje under; se `Zoomtrakt`). */
  utsnitt?: { fra: number; til: number } | null;
  /** Klikk på et bånd (en ekstra vei; HTML-kontroller er hovedveien). */
  onVelg?: (id: string) => void;
  /** Ekstra tegning med geometrien (skala langs aksen og båndenes plass). */
  children?: (g: TidslinjeGeometri) => ReactNode;
}

/** Geometrien til en tidslinje: resultatet av `tidslinjeGeometri`, og det barna i `GeoTidslinje` får. */
export interface TidslinjeGeometri {
  retning: 'vannrett' | 'loddrett';
  /** Alder (millioner år) → posisjon langs tidsaksen (x vannrett, y loddrett). */
  s: (alder: number) => number;
  /** Posisjon langs aksen → alder (til dra-punkter). */
  inv: (px: number) => number;
  /** Domenet som faktisk vises (millioner år), fra eldst til yngst. */
  fra: number;
  til: number;
  skala: 'lineaer' | 'log';
  /** Tidsaksen fra p0 (eldst) til p1 (yngst), langs aksen. */
  p0: number;
  p1: number;
  /** Båndene på tvers av aksen fra q0 til q1 (vannrett: y øverst og nederst; loddrett: x venstre og høyre). */
  q0: number;
  q1: number;
  /** Hver rad (vannrett) eller kolonne (loddrett) med nivå og plass på tvers. */
  rader: { niva: TidsNiva; q0: number; q1: number }[];
  /** Plassen til hendelsestekstene på tvers av aksen (tom når det ikke er hendelser). */
  hendelser: { q0: number; q1: number };
  /** Akseverdiene: alder og etikett. */
  merker: { alder: number; tekst: string }[];
  /** Hjelpelinjer uten tall (alder). */
  smaaMerker: number[];
  /** Aksetittelen. */
  tittel: string;
  /** Linja tidsaksen tegnes langs (y vannrett, x loddrett). */
  akseLinje: number;
}

const ENHET_FAKTOR: Record<Exclude<Tidsenhet, 'auto'>, number> = { millioner: 1, tusen: 1000, år: 1e6 };
const ENHET_TITTEL: Record<Exclude<Tidsenhet, 'auto'>, string> = { millioner: 'millioner år siden', tusen: 'tusen år siden', år: 'år siden' };

/**
 * Regner ut plassen til alt i en `GeoTidslinje` (samme regler som komponenten): skalaen langs tidsaksen, radene eller
 * kolonnene med bånd, plassen til hendelsene og akseverdiene. Bruk den når du tegner noe som skal treffe tidslinja fra
 * utsiden, f.eks. en `Zoomtrakt` mellom to tidslinjer. `f` er tekstskaleringen (`useTextScale()`).
 */
export function tidslinjeGeometri(p: GeoTidslinjeProps, fInn = 1): TidslinjeGeometri {
  // Ugyldig eller for liten tekstskalering behandles som 1 (som i geoHoyde), så geometrien aldri får NaN
  const f = Number.isFinite(fInn) ? Math.max(1, fInn) : 1;
  const retning = p.retning ?? 'vannrett';
  const x = Number.isFinite(p.x) ? p.x! : 0;
  const y = Number.isFinite(p.y) ? p.y! : 0;
  const W = Number.isFinite(p.width) ? Math.max(1, p.width) : 1;
  const H = Number.isFinite(p.height) ? Math.max(1, p.height) : 1;
  const skala = p.skala ?? 'lineaer';
  let fra = Number.isFinite(p.fra) && p.fra! > 0 ? Math.min(p.fra!, JORDAS_ALDER) : JORDAS_ALDER;
  let til = Number.isFinite(p.til) && p.til! >= 0 ? p.til! : 0;
  if (til >= fra) til = 0;
  if (skala === 'log' && til <= 0) til = Math.min(1e-4, fra / 100);
  const niva = p.niva ?? ['eon', 'era', 'periode'];
  const n = Math.max(1, niva.length);
  const akse = p.akse !== false;
  const harHendelser = (p.hendelser?.length ?? 0) > 0 || (p.markor !== null && p.markor !== undefined && Number.isFinite(p.markor) && p.markorTekst !== '');
  const tickPx = 15 * f;
  const titlePx = 15.6 * f;

  // Enhet og tittel
  let enhet = p.enhet ?? 'auto';
  if (enhet === 'auto' && skala === 'lineaer') enhet = fra >= 2 ? 'millioner' : fra >= 0.002 ? 'tusen' : 'år';
  const c = enhet === 'auto' ? 1 : ENHET_FAKTOR[enhet];
  const tittel = p.aksetittel ?? (enhet === 'auto' ? 'tid før nå (logaritmisk akse)' : ENHET_TITTEL[enhet]);

  const lengde = retning === 'vannrett' ? W : H;
  const spec: LogAkse = {
    min: til * c,
    max: fra * c,
    log: skala === 'log',
    format: enhet === 'auto' ? (v) => fmtAlder(v, { kort: true }) : undefined,
  };
  const m = akseMerker(spec, lengde, retning === 'vannrett' ? 'x' : 'y', tickPx);
  const merker = m.major.map((v, i) => ({ alder: v / c, tekst: m.tekst[i] ?? '' }));
  const smaaMerker = m.minor.map((v) => v / c);

  const p0 = retning === 'vannrett' ? x : y + H;
  const p1 = retning === 'vannrett' ? x + W : y;
  // Eldst ved p0, yngst ved p1
  const s = skala === 'log' ? scaleLog([fra, til], [p0, p1]) : scaleLinear([fra, til], [p0, p1]);
  const inv = skala === 'log' ? scaleLogInvert([fra, til], [p0, p1]) : p0 === p1 ? () => fra : scaleLinear([p0, p1], [fra, til]);

  let q0: number;
  let q1: number;
  let hq0: number;
  let hq1: number;
  let akseLinje: number;
  const tittelPlass = tittel ? titlePx * 1.3 : 0;
  if (retning === 'vannrett') {
    const akseH = akse ? 22 * f + 8 + tittelPlass : 0;
    const radH = p.baand ?? (harHendelser ? 30 * f : Math.max(18 * f, (H - akseH) / n));
    q1 = y + H - akseH;
    q0 = q1 - radH * n;
    hq0 = y;
    hq1 = harHendelser ? q0 - 6 : y;
    akseLinje = q1;
  } else {
    const bredest = Math.max(0, ...merker.map((mk) => tekstBredde(mk.tekst, tickPx)));
    const akseW = akse ? bredest + 14 + tittelPlass : 0;
    const kolW = p.baand ?? (harHendelser ? Math.min(118 * f, ((W - akseW) * 0.5) / n) : (W - akseW) / n);
    q0 = x + akseW;
    q1 = q0 + kolW * n;
    hq0 = harHendelser ? q1 + 26 * f : q1;
    hq1 = harHendelser ? x + W : q1;
    akseLinje = q0;
  }
  const radStr = (q1 - q0) / n;
  const rader = niva.map((nv, i) => ({ niva: nv, q0: q0 + i * radStr, q1: q0 + (i + 1) * radStr }));
  return { retning, s, inv, fra, til, skala, p0, p1, q0, q1, rader, hendelser: { q0: hq0, q1: hq1 }, merker, smaaMerker, tittel, akseLinje };
}

interface Rekt {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Intervallene i en rad (på ett nivå), uten prekambrium når den samles i ett bånd. */
function radIntervaller(niva: TidsNiva, samle: boolean): TidsIntervall[] {
  const liste = intervaller(niva);
  return samle ? liste.filter((i) => i.start <= PREKAMBRIUM.slutt + 1e-9) : liste;
}

/**
 * Tidslinje for geologisk tid: periodebånd i ICS-fargene fra `GEOLOGISK_TID` (eoner, eraer, perioder og epoker),
 * tidsakse i millioner år, tusen år eller år, lineær eller logaritmisk, og hendelsesmerker med tekst. Vannrett (eldst
 * til venstre) eller loddrett (eldst nederst, som ICS-kartet). `fra` og `til` zoomer inn, og navnene i båndene velges
 * etter plassen (fullt navn, kort navn eller ingenting). Hendelsene står som flagg over båndene uten at streker og
 * tekster krysser hverandre (`flaggEtiketter`); når det blir for trangt, blir de nummererte merker med en liste over.
 * Boksen er (x, y, width, height); tidsaksen går over hele bredden (vannrett) eller høyden (loddrett), så la det være
 * litt luft rundt for tallene i endene. Mange hendelser på smal skjerm: bruk `retning="loddrett"` eller mer høyde.
 *   <GeoTidslinje x={20} y={10} width={760} height={260} hendelser={GEO_HENDELSER} markor={alder} markert={periodeVed(alder)?.id} />
 *   <GeoTidslinje … retning="loddrett" fra={66} niva={['periode', 'epoke']} />
 * `tidslinjeGeometri` gir den samme plasseringen utenfor komponenten.
 */
export function GeoTidslinje(props: GeoTidslinjeProps) {
  const f = useTextScale();
  const k = useGeoScale();
  const ss = useGeoStroke();
  const g = tidslinjeGeometri(props, f);
  const { retning, s, fra, til, q0, q1 } = g;
  const vannrett = retning === 'vannrett';
  const samle = props.samlePrekambrium === true;
  const navnPx = 17 * 0.74 * f;
  const hendelsePx = 17 * 0.74 * f;
  const tickPx = 15 * f;
  const titlePx = 15.6 * f;
  const lo = Math.min(g.p0, g.p1);
  const hi = Math.max(g.p0, g.p1);
  const klem = (v: number) => Math.min(hi, Math.max(lo, v));
  const iDomenet = (alder: number) => alder <= fra + 1e-9 && alder >= til - 1e-9;

  /** Et bånd fra a til b langs aksen og fra c til d på tvers, som rektangel i SVG. */
  const rekt = (a: number, b: number, c: number, d: number): Rekt =>
    vannrett ? { x: Math.min(a, b), y: c, width: Math.abs(b - a), height: d - c } : { x: c, y: Math.min(a, b), width: d - c, height: Math.abs(b - a) };

  const baandEl: ReactNode[] = [];
  const navnEl: ReactNode[] = [];
  const markert: { r: Rekt | null } = { r: null };
  const tegnBaand = (iv: TidsIntervall, c: number, d: number, nokkel: string) => {
    if (iv.start <= til || iv.slutt >= fra) return;
    const a = s(Math.min(iv.start, fra));
    const b = s(Math.max(iv.slutt, til));
    if (Math.abs(b - a) < 0.6) return;
    const r = rekt(a, b, c, d);
    const tittel = `${iv.etikett}: ${fmtAlder(iv.start)}–${iv.slutt === 0 ? 'i dag' : fmtAlder(iv.slutt)}${iv.slutt === 0 ? '' : ' siden'}`;
    const velg = props.onVelg;
    baandEl.push(
      <rect
        key={nokkel}
        {...r}
        fill={tidFarge(iv.id)}
        stroke={VIZ.surface}
        strokeWidth={1.2 * ss}
        style={velg ? { cursor: 'pointer' } : undefined}
        onClick={velg ? () => velg(iv.id) : undefined}
      >
        <title>{tittel}</title>
      </rect>,
    );
    if (props.markert === iv.id) markert.r = r;
    // Navnet: helt, kort eller ingenting, etter plassen
    const fs = vannrett ? Math.min(navnPx, r.height * 0.62) : navnPx;
    const passer = (t: string) => tekstBredde(t, fs) + 6 <= r.width && fs * 1.05 <= r.height;
    const tekst = passer(iv.etikett) ? iv.etikett : passer(iv.kort) ? iv.kort : null;
    if (tekst && fs >= navnPx * 0.55) {
      navnEl.push(
        <text
          key={`n${nokkel}`}
          x={r.x + r.width / 2}
          y={r.y + r.height / 2 + fs * 0.36}
          textAnchor="middle"
          stroke={tidFarge(iv.id)}
          strokeWidth={3.2 * ss}
          strokeLinejoin="round"
          paintOrder="stroke"
          style={{ fontSize: fs, fontWeight: props.markert === iv.id ? 750 : 600, fill: VIZ.ink, pointerEvents: 'none' }}
        >
          {tekst}
        </text>,
      );
    }
  };
  for (const rad of g.rader) {
    for (const iv of radIntervaller(rad.niva, samle)) tegnBaand(iv, rad.q0, rad.q1, `${rad.niva}-${iv.id}`);
  }
  if (samle) tegnBaand(PREKAMBRIUM, q0, q1, 'prekambrium');

  // Hendelser og markøren: tekstene plasseres så ingen streker går gjennom en tekst og ingen tekster overlapper
  interface Etikett {
    pos: number;
    tekst: string;
    farge: string;
    ende: number | null;
    markor: boolean;
  }
  const etiketter: Etikett[] = [];
  const mk = props.markor;
  const harMarkor = mk !== null && mk !== undefined && Number.isFinite(mk) && iDomenet(Math.max(mk, til));
  const markorPos = harMarkor ? s(Math.max(mk!, til)) : null;
  const markorTekst = harMarkor ? (props.markorTekst ?? fmtAlder(Math.max(0, mk!), { siden: true })) : '';
  if (markorPos !== null && markorTekst) etiketter.push({ pos: markorPos, tekst: markorTekst, farge: VIZ.ink, ende: null, markor: true });
  for (const h of props.hendelser ?? []) {
    if (!Number.isFinite(h.alder) || !iDomenet(h.alder)) continue;
    const ende = h.slutt !== undefined && Number.isFinite(h.slutt) ? s(Math.max(til, Math.min(fra, h.slutt))) : null;
    etiketter.push({ pos: s(h.alder), tekst: h.tekst, farge: h.farge ?? VIZ.ink, ende, markor: false });
  }
  const hendelseEl: ReactNode[] = [];
  // Strekene som går over båndene tegnes under navnene i båndene (som har glorie), så navnene kan leses
  const linjeEl: ReactNode[] = [];
  const pxFor = (e: Etikett) => (e.markor ? 17 * 0.8 * f : hendelsePx);
  if (etiketter.length > 0 && vannrett) {
    const radH = hendelsePx * 1.32 + 3;
    // Radene står fra like over båndene og oppover; den øverste teksten skal holde seg inne i boksen
    const maksRader = Math.max(1, Math.floor((q0 - 8 - hendelsePx * 0.8 - g.hendelser.q0) / radH) + 1);
    const plan = flaggEtiketter(
      etiketter.map((e) => ({ pos: e.pos, bredde: tekstBredde(e.tekst, pxFor(e)) + 4 })),
      g.p0,
      g.p1,
    );
    if (plan && plan.rader <= maksRader) {
      etiketter.forEach((e, i) => {
        const fl = plan.flagg[i]!;
        const px = pxFor(e);
        const ty = q0 - 8 - fl.rad * radH;
        // Står teksten over streken, slutter streken like under teksten; ellers går den opp langs siden av teksten
        const over = e.pos > fl.x - 2 && e.pos < fl.x + tekstBredde(e.tekst, px) + 6;
        linjeEl.push(
          <line key={`hl${i}`} x1={e.pos} x2={e.pos} y1={e.markor ? q0 - 6 : q1} y2={over ? ty + px * 0.3 : ty - px * 0.3} stroke={e.farge} strokeWidth={(e.markor ? 1.4 : 1.2) * ss} opacity={e.markor ? 1 : 0.75} />,
        );
        hendelseEl.push(
          <g key={`h${i}`}>
            {e.ende !== null && <line x1={e.pos} x2={e.ende} y1={q0 - 3 * ss} y2={q0 - 3 * ss} stroke={e.farge} strokeWidth={4.5 * ss} strokeLinecap="round" />}
            {!e.markor && <circle cx={e.pos} cy={q0} r={3.4 * k} fill={e.farge} stroke={VIZ.surface} strokeWidth={1.3 * ss} />}
            <Txt x={fl.x} y={ty} anchor="start" size={e.markor ? 0.8 : 0.74} weight={e.markor ? 750 : 560}>
              {e.tekst}
            </Txt>
          </g>,
        );
      });
    } else {
      // For trangt til flagg: nummererte merker på båndene og en nummerert liste øverst (eldst først)
      const hend = etiketter.filter((e) => !e.markor).sort((e1, e2) => e1.pos - e2.pos);
      const markorE = etiketter.find((e) => e.markor);
      const rb = 8.2 * f;
      const sisteX: number[] = [];
      const nivaa = hend.map((e) => {
        let l = 0;
        while (sisteX[l] !== undefined && e.pos - sisteX[l]! < 2 * rb + 2) l++;
        sisteX[l] = e.pos;
        return l;
      });
      const merkeY = (l: number) => q0 - rb - 4 - l * (2 * rb + 3);
      const toppMerker = q0 - 4 - (Math.max(-1, ...nivaa) + 1) * (2 * rb + 3);
      let listeBunn = toppMerker - 6;
      if (markorE) {
        const px = pxFor(markorE);
        const w = tekstBredde(markorE.tekst, px) + 4;
        const fl = flaggEtiketter([{ pos: markorE.pos, bredde: w }], g.p0, g.p1)?.flagg[0];
        const tx = fl?.x ?? markorE.pos + 5;
        const over = markorE.pos > tx - 2 && markorE.pos < tx + w + 2;
        const ty = toppMerker - 6;
        hendelseEl.push(
          <g key="markor">
            <line x1={markorE.pos} x2={markorE.pos} y1={q0 - 6} y2={over ? ty + px * 0.3 : ty - px * 0.3} stroke={VIZ.ink} strokeWidth={1.4 * ss} />
            <Txt x={tx} y={ty} anchor="start" size={0.8} weight={750}>
              {markorE.tekst}
            </Txt>
          </g>,
        );
        listeBunn = ty - px - 6;
      }
      hend.forEach((e, i) => {
        const cy = merkeY(nivaa[i]!);
        linjeEl.push(<line key={`ml${i}`} x1={e.pos} x2={e.pos} y1={q1} y2={cy} stroke={e.farge} strokeWidth={1.2 * ss} opacity={0.75} />);
        hendelseEl.push(
          <g key={`m${i}`}>
            {e.ende !== null && <line x1={e.pos} x2={e.ende} y1={q0 - 3 * ss} y2={q0 - 3 * ss} stroke={e.farge} strokeWidth={4.5 * ss} strokeLinecap="round" />}
            <circle cx={e.pos} cy={cy} r={rb} fill={e.farge} stroke={VIZ.surface} strokeWidth={1.4 * ss} />
            <text x={e.pos} y={cy + rb * 0.4} textAnchor="middle" style={{ fontSize: rb * 1.15, fontWeight: 750, fill: VIZ.surface }}>
              {i + 1}
            </text>
          </g>,
        );
      });
      // Listen: så få kolonner som mulig uten at noen tekst går inn i neste kolonne (lange tekster brytes), og mindre
      // skrift før listen går utenfor boksen
      const topp = g.hendelser.q0 + 6;
      const hoyde = Math.max(0, listeBunn - topp);
      const bredde = g.p1 - g.p0;
      interface Liste {
        kol: number;
        skala: number;
        linjer: string[][];
        kolonner: number[][];
        h: number;
      }
      let valgt: Liste | null = null;
      let lavest: Liste | null = null;
      finn: for (const skala of [1, 0.9, 0.8]) {
        const px = hendelsePx * skala;
        for (let kol = 1; kol <= 4; kol++) {
          const maksB = bredde / kol - 2 * rb - 16;
          if (maksB < 50) break;
          const linjer = hend.map((e) => brytTekst(e.tekst, maksB, px, 4));
          if (linjer.some((ln) => ln.some((l) => tekstBredde(l, px) > maksB + 1))) continue;
          const hoyder = linjer.map((ln) => ln.length * px * 1.2 + 4);
          const kolonner = fordelIKolonner(hoyder, kol);
          const h = Math.max(...kolonner.map((ix) => ix.reduce((sum, i) => sum + hoyder[i]!, 0)));
          const liste: Liste = { kol, skala, linjer, kolonner, h };
          if (!lavest || h < lavest.h) lavest = liste;
          if (h <= hoyde) {
            valgt = liste;
            break finn;
          }
        }
      }
      // Listen står like over merkene, så den hører sammen med tidslinja; får den ikke plass, går den ut over boksen
      // oppover (gi tidslinja mer høyde)
      const liste = valgt ?? lavest;
      if (liste) {
        const px = hendelsePx * liste.skala;
        const lh = px * 1.2;
        const kb = bredde / liste.kol;
        const start = listeBunn - liste.h;
        liste.kolonner.forEach((ix, c) => {
          let y = start + px * 0.95;
          for (const i of ix) {
            const e = hend[i]!;
            const lx = g.p0 + c * kb;
            const ln = liste.linjer[i]!;
            hendelseEl.push(
              <g key={`l${i}`}>
                <circle cx={lx + rb} cy={y - px * 0.36} r={rb * 0.92} fill={e.farge} />
                <text x={lx + rb} y={y - px * 0.36 + rb * 0.38} textAnchor="middle" style={{ fontSize: rb * 1.05, fontWeight: 750, fill: VIZ.surface }}>
                  {i + 1}
                </text>
                <Txt x={lx + 2 * rb + 7} y={y} anchor="start" size={0.74 * liste.skala} weight={560}>
                  {ln.map((l, j) => (
                    <tspan key={j} x={lx + 2 * rb + 7} dy={j === 0 ? 0 : lh}>
                      {l}
                    </tspan>
                  ))}
                </Txt>
              </g>,
            );
            y += ln.length * lh + 4;
          }
        });
      }
    }
  } else if (etiketter.length > 0) {
    const lx = g.hendelser.q0;
    const maksB = Math.max(40, g.hendelser.q1 - lx - 4);
    const linjeH = hendelsePx * 1.18;
    const items = [...etiketter]
      .sort((e1, e2) => e1.pos - e2.pos)
      .map((e) => {
        const linjer = brytTekst(e.tekst, maksB, pxFor(e), 3);
        return { e, linjer, hoyde: Math.max(1, linjer.length) * linjeH };
      });
    // Fra toppen (yngst) og ned, uten overlapp; så skyves de opp igjen hvis de går ut nederst.
    const topp = Math.min(g.p0, g.p1) + hendelsePx * 0.9;
    const bunn = Math.max(g.p0, g.p1);
    let forrige = topp - 4;
    const ys = items.map((it) => {
      const ly = Math.max(it.e.pos + hendelsePx * 0.35 - (it.hoyde - linjeH) / 2, forrige + 4);
      forrige = ly + it.hoyde;
      return ly;
    });
    let grense = bunn;
    for (let i = items.length - 1; i >= 0; i--) {
      const it = items[i]!;
      const maks = grense - it.hoyde + linjeH * 0.75;
      ys[i] = Math.max(topp, Math.min(ys[i]!, maks));
      grense = ys[i]! - linjeH * 0.75 - 4;
    }
    items.forEach((it, i) => {
      const ly = ys[i]!;
      const e = it.e;
      const midtTekst = ly - hendelsePx * 0.35 + ((it.linjer.length - 1) * linjeH) / 2;
      if (!e.markor) linjeEl.push(<line key={`hl${i}`} x1={q0} x2={q1} y1={e.pos} y2={e.pos} stroke={e.farge} strokeWidth={1.2 * ss} opacity={0.75} />);
      hendelseEl.push(
        <g key={`h${i}`}>
          {e.ende !== null && <line x1={q1 + 3 * ss} x2={q1 + 3 * ss} y1={e.pos} y2={e.ende} stroke={e.farge} strokeWidth={4.5 * ss} strokeLinecap="round" />}
          <polyline
            points={`${e.markor ? q1 + 6 : q1},${e.pos} ${lx - 14 * f},${midtTekst} ${lx - 5},${midtTekst}`}
            fill="none"
            stroke={e.markor ? VIZ.ink : VIZ.muted}
            strokeWidth={(e.markor ? 1.4 : 1.1) * ss}
          />
          {!e.markor && <circle cx={q1} cy={e.pos} r={3.4 * k} fill={e.farge} stroke={VIZ.surface} strokeWidth={1.3 * ss} />}
          <Txt x={lx} y={ly} anchor="start" size={e.markor ? 0.8 : 0.74} weight={e.markor ? 750 : 560}>
            {it.linjer.map((l, j) => (
              <tspan key={j} x={lx} dy={j === 0 ? 0 : linjeH}>
                {l}
              </tspan>
            ))}
          </Txt>
        </g>,
      );
    });
  }

  // Tidsaksen
  const akseEl: ReactNode[] = [];
  if (props.akse !== false) {
    const L = g.akseLinje;
    if (vannrett) {
      const pos = g.merker.map((m) => s(m.alder));
      const vis = synligeEtiketter(
        pos,
        g.merker.map((m) => tekstBredde(m.tekst, tickPx)),
        tickPx * 0.6,
      );
      akseEl.push(<line key="akse" x1={g.p0} x2={g.p1} y1={L} y2={L} className="viz-axis" />);
      g.smaaMerker.forEach((a) => akseEl.push(<line key={`sm${a}`} x1={s(a)} x2={s(a)} y1={L} y2={L + 4} className="viz-axis" />));
      g.merker.forEach((m, i) => {
        akseEl.push(<line key={`m${m.alder}`} x1={pos[i]} x2={pos[i]} y1={L} y2={L + 7} className="viz-axis" />);
        if (vis.has(i)) {
          const p = pos[i]!;
          const w = tekstBredde(m.tekst, tickPx);
          const anker = p - w / 2 < g.p0 - 2 ? 'start' : p + w / 2 > g.p1 + 2 ? 'end' : 'middle';
          akseEl.push(
            <text key={`t${m.alder}`} x={p} y={L + 22 * f} textAnchor={anker} className="viz-tick">
              {m.tekst}
            </text>,
          );
        }
      });
      if (g.tittel)
        akseEl.push(
          <text key="tittel" x={(g.p0 + g.p1) / 2} y={L + 22 * f + 4 + titlePx} textAnchor="middle" className="viz-axis-label">
            {g.tittel}
          </text>,
        );
    } else {
      const pos = g.merker.map((m) => s(m.alder));
      const vis = synligeEtiketter(
        pos,
        g.merker.map(() => tickPx * 1.05),
        tickPx * 0.25,
      );
      akseEl.push(<line key="akse" x1={L} x2={L} y1={g.p0} y2={g.p1} className="viz-axis" />);
      g.smaaMerker.forEach((a) => akseEl.push(<line key={`sm${a}`} x1={L - 4} x2={L} y1={s(a)} y2={s(a)} className="viz-axis" />));
      g.merker.forEach((m, i) => {
        akseEl.push(<line key={`m${m.alder}`} x1={L - 7} x2={L} y1={pos[i]} y2={pos[i]} className="viz-axis" />);
        if (vis.has(i)) {
          const p = pos[i]!;
          const dy = p - tickPx * 0.5 < lo - 2 ? tickPx * 0.8 : p + tickPx * 0.5 > hi + 2 ? -2 : 5 * f;
          akseEl.push(
            <text key={`t${m.alder}`} x={L - 10} y={p + dy} textAnchor="end" className="viz-tick">
              {m.tekst}
            </text>,
          );
        }
      });
      const tx = (props.x ?? 0) + 4 + titlePx * 0.8;
      if (g.tittel)
        akseEl.push(
          <text key="tittel" x={tx} y={(g.p0 + g.p1) / 2} textAnchor="middle" className="viz-axis-label" transform={`rotate(-90 ${tx} ${(g.p0 + g.p1) / 2})`}>
            {g.tittel}
          </text>,
        );
    }
  }

  // Utsnitt og markør
  let utsnittEl: ReactNode = null;
  const u = props.utsnitt;
  if (u && Number.isFinite(u.fra) && Number.isFinite(u.til)) {
    const a = klem(s(Math.min(Math.max(u.fra, u.til), fra)));
    const b = klem(s(Math.max(Math.min(u.fra, u.til), til)));
    const r = rekt(a, b, q0 - 4, q1 + 4);
    utsnittEl = <rect {...r} rx={4} fill={alpha(VIZ.ink, 0.06)} stroke={VIZ.ink} strokeWidth={2.2 * ss} />;
  }
  // Markøren: streken under navnene i båndene, hodet oppå alt
  const markorLinje: ReactNode =
    markorPos === null ? null : vannrett ? (
      <g>
        <line x1={markorPos} x2={markorPos} y1={q0 - 6} y2={q1 + 6} stroke={VIZ.surface} strokeWidth={5 * ss} strokeLinecap="round" />
        <line x1={markorPos} x2={markorPos} y1={q0 - 6} y2={q1 + 6} stroke={VIZ.ink} strokeWidth={2.4 * ss} strokeLinecap="round" />
      </g>
    ) : (
      <g>
        <line x1={q0 + 1} x2={q1 + 6} y1={markorPos} y2={markorPos} stroke={VIZ.surface} strokeWidth={5 * ss} strokeLinecap="round" />
        <line x1={q0 + 1} x2={q1 + 6} y1={markorPos} y2={markorPos} stroke={VIZ.ink} strokeWidth={2.4 * ss} strokeLinecap="round" />
      </g>
    );
  const markorHode: ReactNode =
    markorPos === null ? null : (
      <circle cx={vannrett ? markorPos : q1 + 6} cy={vannrett ? q0 - 6 : markorPos} r={3.6 * k} fill={VIZ.ink} stroke={VIZ.surface} strokeWidth={1.4 * ss} />
    );

  const ramme = (rad: { q0: number; q1: number }, i: number) => {
    const r = rekt(s(fra), s(til), rad.q0, rad.q1);
    return <rect key={`ramme${i}`} {...r} fill="none" stroke={VIZ.muted} strokeWidth={1 * ss} opacity={0.6} />;
  };
  return (
    <g>
      {g.rader.map((rad, i) => {
        const r = rekt(s(fra), s(til), rad.q0, rad.q1);
        return <rect key={`bak${i}`} {...r} fill={alpha(VIZ.muted, 0.08)} />;
      })}
      {baandEl}
      {g.rader.map(ramme)}
      {markert.r && <rect {...markert.r} fill="none" stroke={VIZ.ink} strokeWidth={2.4 * ss} />}
      {linjeEl}
      {markorLinje}
      {navnEl}
      {utsnittEl}
      {akseEl}
      {hendelseEl}
      {markorHode}
      {props.children?.(g)}
    </g>
  );
}

/**
 * Trakt mellom et utsnitt på én tidslinje (eller akse) og hele bredden av en zoomet tidslinje under, som i
 * lærebokfigurer der den siste delen av tiden forstørres. `fra` er de to endene av utsnittet, `til` de to endene på
 * den zoomede tidslinja (punktene [x, y] i figuren, f.eks. fra `tidslinjeGeometri`).
 */
export function Zoomtrakt({ fra, til }: { fra: readonly [readonly [number, number], readonly [number, number]]; til: readonly [readonly [number, number], readonly [number, number]] }) {
  const ss = useGeoStroke();
  const [a, b] = fra;
  const [c, d] = til;
  if (![a, b, c, d].every((p) => Number.isFinite(p[0]) && Number.isFinite(p[1]))) return null;
  return (
    <g>
      <polygon points={`${a[0]},${a[1]} ${b[0]},${b[1]} ${d[0]},${d[1]} ${c[0]},${c[1]}`} fill={alpha(VIZ.ink, 0.05)} />
      <line x1={a[0]} y1={a[1]} x2={c[0]} y2={c[1]} stroke={VIZ.muted} strokeWidth={1.3 * ss} strokeDasharray="5 4" />
      <line x1={b[0]} y1={b[1]} x2={d[0]} y2={d[1]} stroke={VIZ.muted} strokeWidth={1.3 * ss} strokeDasharray="5 4" />
    </g>
  );
}
