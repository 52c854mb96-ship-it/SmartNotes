/**
 * Landskap formet av is og vann, i snitt og ovenfra:
 *   - `Isbre`: «dalbre» (blokk med lengdesnitt gjennom breen: firn, sprekker, likevektslinje, front, endemorene,
 *     sidemorene og bresjø), «innlandsis» (isdekke med valgfri isostasi: skorpa trykkes ned) og «havis» (flak som flyter
 *     med omtrent 90 % under vann, valgfritt isfjell til sammenligning).
 *   - `Elveleie`: «lengde» (fra fjell til delta, med korn på bunnen), «tverr» (tverrsnitt med vannstand, flomlinjer,
 *     flomslette og målepunkter) og «ovenfra» (meandre eller rett kanal). Vannet er klart, grumsete eller en slamstrøm.
 *   - `Fjellside`, `Bekk` og `Demning`: kopiert fra fysikk/kap03/vannkraft-deler.tsx (FjellSnitt, Bekk, Demning) med nye
 *     navn og geofagfarger, så hjulstrom og drikkevann kan bruke dem uten å importere på tvers av fagene.
 *
 * Blokkene (dalbre, innlandsis, havis, elveleie «lengde» og «tverr») følger Snittblokk: (x, y) er øverste venstre hjørne
 * av snittet foran, w og h er snittet, og blokka stikker dx til høyre og dy opp (`snittblokkPerspektiv`). Geometrien
 * (`isbreGeometri`, `elveleieGeometri`) gir ankerpunkter til piler og etiketter og rammen rundt alt som tegnes.
 */
import { memo, type ReactNode } from 'react';
import { useTextScale } from '../../kit/controls';
import { VIZ } from '../../kit/colors';
import { fmt } from '../../kit/format';
import { niceTicks } from '../../kit/svg';
import { Txt } from '../../kit/txt';
import { Terreng } from '../../kit/scene/bakgrunn';
import { ContactShadow, LinearGradient, RadialGradient, alpha, mix, sceneRandom, shade, tint, useSvgId } from '../../kit/scene/core';
import { SCENE } from '../../kit/scene/palette';
import { GEO } from './colors';
import { useGeoScale, useGeoStroke } from './felles';
import { TETTHETER } from './jorda';
import { glattSti } from './kotekart';
import { LagFlate, LagMonstre, useLagMonstre } from './monstre';
import { kolonneEtiketter, snittblokkPerspektiv, type SnittEtikett, type SnittPunkt } from './snitt';
import { MONSTER_IDS, type MonsterId } from './typer';
import { Stromlinjer, type StromLinje } from './vann';

/* =====================================================================================================================
 * Små hjelpere
 * ================================================================================================================== */

type Fn = (x: number) => number;

const r1 = (v: number) => Math.round(v * 10) / 10;
const r2 = (v: number) => Math.round(v * 100) / 100;
const fin = (v: number | undefined, alt = 0) => (v !== undefined && Number.isFinite(v) ? v : alt);
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
const clamp01 = (v: number) => clamp(v, 0, 1);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
/** Myk overgang fra 0 (x ≤ a) til 1 (x ≥ b). */
function smooth(a: number, b: number, x: number): number {
  if (!(b > a)) return x >= b ? 1 : 0;
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
}

/** Sti gjennom punktene med rette stykker (lukket med Z når `lukket`). */
function sti(punkter: readonly SnittPunkt[], lukket = false): string {
  let d = '';
  for (const [x, y] of punkter) {
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
    d += `${d ? 'L' : 'M'}${r2(x)} ${r2(y)}`;
  }
  return d && lukket ? `${d}Z` : d;
}

function linspace(a: number, b: number, n: number): number[] {
  const m = Math.max(1, Math.round(n));
  return Array.from({ length: m + 1 }, (_, i) => a + ((b - a) * i) / m);
}

/** Sorterte, unike prøvepunkter: et jevnt rutenett pluss spesielle punkter (fronten, kanten av en sjø …). */
function provepunkter(a: number, b: number, n: number, ekstra: readonly number[] = []): number[] {
  const alle = [...linspace(a, b, n), ...ekstra.filter((v) => Number.isFinite(v) && v >= a && v <= b)].sort((p, q) => p - q);
  const ut: number[] = [];
  for (const v of alle) if (ut.length === 0 || v - ut[ut.length - 1]! > 1e-6) ut.push(v);
  return ut;
}

/** Lineær interpolasjon i en tabell (xs stigende). Utenfor tabellen brukes endeverdiene. */
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

/**
 * Monoton kubisk interpolasjon (Fritsch og Carlson) gjennom kontrollpunktene: myk kurve uten oversving, så et
 * dalprofil eller en ryggline får form av punktene og ikke bølger mellom dem.
 */
function pchip(pts: readonly (readonly [number, number])[]): Fn {
  const n = pts.length;
  if (n === 0) return () => 0;
  if (n === 1) return () => pts[0]![1];
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  const hs: number[] = [];
  const ds: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    const hh = xs[i + 1]! - xs[i]! || 1e-9;
    hs.push(hh);
    ds.push((ys[i + 1]! - ys[i]!) / hh);
  }
  const m: number[] = new Array<number>(n).fill(0);
  m[0] = ds[0]!;
  m[n - 1] = ds[n - 2]!;
  for (let i = 1; i < n - 1; i++) {
    const a = ds[i - 1]!;
    const b = ds[i]!;
    if (a * b <= 0) m[i] = 0;
    else {
      const w1 = 2 * hs[i]! + hs[i - 1]!;
      const w2 = hs[i]! + 2 * hs[i - 1]!;
      m[i] = (w1 + w2) / (w1 / a + w2 / b);
    }
  }
  return (xInn) => {
    const x = clamp(fin(xInn, xs[0]!), xs[0]!, xs[n - 1]!);
    let i = 0;
    while (i < n - 2 && x > xs[i + 1]!) i++;
    const hh = hs[i]!;
    const t = (x - xs[i]!) / hh;
    const t2 = t * t;
    const t3 = t2 * t;
    return (
      (2 * t3 - 3 * t2 + 1) * ys[i]! + (t3 - 2 * t2 + t) * hh * m[i]! + (-2 * t3 + 3 * t2) * ys[i + 1]! + (t3 - t2) * hh * m[i + 1]!
    );
  };
}

/** Glatter en liste med verdier (glidende [1, 2, 1]-snitt `runder` ganger), endene står fast. */
function glattVerdier(v: readonly number[], runder: number): number[] {
  let a = [...v];
  for (let r = 0; r < runder; r++) a = a.map((q, i) => (i === 0 || i === a.length - 1 ? q : (a[i - 1]! + 2 * q + a[i + 1]!) / 4));
  return a;
}

/** Hellingstrinn −3 … 3 for en flate i perspektiv (lys fra venstre): stigende mot høyre er belyst. */
function hellingTrinn(a: SnittPunkt, b: SnittPunkt): number {
  const ddx = b[0] - a[0];
  if (!(Math.abs(ddx) > 1e-6)) return 0;
  const v = Math.atan((b[1] - a[1]) / ddx);
  return clamp(Math.round((-v / (Math.PI / 4)) * 3), -3, 3);
}

/** Omtrentlig bredde på en tekst i figurens enheter (Txt: 17 · size · f). */
const tekstBredde = (s: string, size: number, f: number) => s.length * 0.58 * 17 * size * f;

/**
 * Etiketter i en kolonne ved siden av en blokk, som SnittEtiketter, men rekkefølgen velges så strekene krysser
 * hverandre minst mulig (kolonneEtiketter): langs en bre eller en elv er det ofte rekkefølgen etter x, ellers etter y.
 * Etikettene flyttes så de ikke overlapper, også når teksten vokser på mobil.
 */
function Etikettkolonne({
  x,
  etiketter,
  topp,
  bunn,
  orden = 'y',
}: {
  x: number;
  etiketter: readonly SnittEtikett[];
  topp: number;
  bunn: number;
  orden?: 'x' | 'y';
}) {
  const f = useTextScale();
  const s = useGeoStroke();
  const k = useGeoScale();
  const size = 0.8;
  const fs = 17 * size * f;
  const synlige = etiketter.filter((e) => Number.isFinite(e.x) && Number.isFinite(e.y) && e.tekst);
  if (synlige.length === 0) return null;
  const hoyder = synlige.map((e) => fs * 1.12 + (e.undertekst ? fs * 0.86 : 0) + 4);
  // Streken treffer første linje: midten av den, målt fra midten av etiketten
  const strek = synlige.map((e, i) => (e.undertekst ? -(hoyder[i]! - 4) / 2 + fs * 0.8 - fs * 0.33 : 0));
  const c = kolonneEtiketter(
    synlige.map((e, i) => ({ x: e.x, y: e.y, hoyde: hoyder[i]!, strek: strek[i]! })),
    x,
    topp,
    bunn,
    orden,
  );
  return (
    <g>
      {synlige.map((e, i) => {
        const midt = c[i]!;
        const hh = hoyder[i]! - 4;
        const linje1 = midt - hh / 2 + fs * 0.8;
        const strekY = midt + strek[i]!;
        return (
          <g key={`${e.tekst}-${i}`} opacity={e.dim ? 0.45 : undefined}>
            <polyline
              points={`${r2(e.x)},${r2(e.y)} ${r2(x - 12)},${r2(strekY)} ${r2(x - 4)},${r2(strekY)}`}
              fill="none"
              stroke={VIZ.muted}
              strokeWidth={1.1 * s}
              strokeLinejoin="round"
            />
            <circle cx={r2(e.x)} cy={r2(e.y)} r={r2(2.4 * k)} fill={VIZ.ink} stroke={VIZ.surface} strokeWidth={1} />
            <Txt x={x} y={linje1} anchor="start" size={size} weight={e.uthevet ? 700 : 560}>
              {e.tekst}
            </Txt>
            {e.undertekst && (
              <Txt x={x} y={linje1 + fs * 0.92} anchor="start" size={size * 0.82} weight={500} muted>
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
 * Toppflaten i perspektiv (felles for blokkene)
 * ================================================================================================================== */

/** Et løp av toppflaten: én type flate med samme helning, langs forkanten fra venstre mot høyre. */
interface Lop<T extends string> {
  type: T;
  /** Punktene langs forkanten (snittets koordinater). */
  p: SnittPunkt[];
  /** Hellingstrinn −3 … 3 (positiv = belyst). */
  q: number;
}

/**
 * Deler forkanten av toppflaten i løp med samme type og helning. Grensene mellom typene finnes nøyaktig med halvering,
 * så overgangene (fronten av breen, kanten av en sjø) blir skarpe.
 */
function delILop<T extends string>(xs: readonly number[], topp: Fn, typeVed: (x: number) => T, medHelning = true): Lop<T>[] {
  if (xs.length < 2) return [];
  const grenser: number[] = [xs[0]!];
  let forrige = typeVed(xs[0]!);
  for (let i = 1; i < xs.length; i++) {
    const t = typeVed(xs[i]!);
    if (t !== forrige) {
      let a = xs[i - 1]!;
      let b = xs[i]!;
      for (let it = 0; it < 16; it++) {
        const m = (a + b) / 2;
        if (typeVed(m) === forrige) a = m;
        else b = m;
      }
      grenser.push((a + b) / 2);
      forrige = t;
    }
  }
  grenser.push(xs[xs.length - 1]!);
  const ut: Lop<T>[] = [];
  for (let g = 0; g < grenser.length - 1; g++) {
    const a = grenser[g]!;
    const b = grenser[g + 1]!;
    if (!(b > a)) continue;
    const type = typeVed((a + b) / 2);
    const inne = xs.filter((x) => x > a + 0.05 && x < b - 0.05);
    const p: SnittPunkt[] = [a, ...inne, b].map((x) => [x, topp(x)]);
    if (!medHelning || p.length < 3) {
      ut.push({ type, p, q: medHelning ? hellingTrinn(p[0]!, p[p.length - 1]!) : 0 });
      continue;
    }
    let start = 0;
    let qf = hellingTrinn(p[0]!, p[1]!);
    for (let i = 1; i < p.length - 1; i++) {
      const q = hellingTrinn(p[i]!, p[i + 1]!);
      if (q !== qf) {
        ut.push({ type, p: p.slice(start, i + 1), q: qf });
        start = i;
        qf = q;
      }
    }
    ut.push({ type, p: p.slice(start), q: qf });
  }
  return ut;
}

/** Polygonet for et løp av toppflaten: forkanten og bakkanten (forskjøvet dx, −dy). */
function lopPolygon(p: readonly SnittPunkt[], dx: number, dy: number, q0 = 0, q1 = 1): SnittPunkt[] {
  const foran = p.map(([x, y]): SnittPunkt => [x + q0 * dx, y - q0 * dy]);
  const bak = [...p].reverse().map(([x, y]): SnittPunkt => [x + q1 * dx, y - q1 * dy]);
  return [...foran, ...bak];
}

/** Fargen på en flate med lys fra venstre: belyste skråninger litt lysere, skyggesider litt mørkere. */
function lysFarge(base: string, q: number, skygge: string = SCENE.shadow): string {
  if (q > 0) return tint(base, 0.07 * q);
  if (q < 0) return mix(base, skygge, 0.08 * -q);
  return base;
}

/** Toppflaten tegnet løp for løp fra venstre mot høyre, så det som ligger nærmest dekker det som er bak. */
function Toppflate<T extends string>({
  lop,
  dx,
  dy,
  farge,
  pynt,
}: {
  lop: readonly Lop<T>[];
  dx: number;
  dy: number;
  farge: (type: T, q: number) => string;
  /** Detaljer på et løp (tegnes rett etter løpet, før løpene til høyre). */
  pynt?: (l: Lop<T>, i: number) => ReactNode;
}) {
  const s = useGeoStroke();
  return (
    <g>
      {lop.map((l, i) => {
        const poly = lopPolygon(l.p, dx, dy);
        const fyll = farge(l.type, l.q);
        const bak = l.p.map(([x, y]): SnittPunkt => [x + dx, y - dy]);
        const forste = l.p[0]!;
        return (
          <g key={i}>
            <path d={sti(poly, true)} fill={fyll} stroke={fyll} strokeWidth={0.8} strokeLinejoin="round" />
            {pynt?.(l, i)}
            <path
              d={sti(i === 0 ? [[forste[0], forste[1]], [forste[0] + dx, forste[1] - dy], ...bak] : bak)}
              fill="none"
              stroke={SCENE.outline}
              strokeWidth={1.1 * s}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          </g>
        );
      })}
    </g>
  );
}

/** Lys ovenfra og skygge nederst på snittet foran (samme toning som i Snittblokk). */
function SnittLys({ d, id }: { d: string; id: string }) {
  return (
    <>
      <LinearGradient
        id={id}
        x2={0.3}
        y2={1}
        stops={[
          [0, SCENE.highlight, 0.4],
          [0.4, SCENE.highlight, 0],
          [1, SCENE.shadow, 0.5],
        ]}
      />
      <path d={d} fill={`url(#${id})`} />
    </>
  );
}

/** Ett felt på sideflaten: fra y0 til y1, med fyll (mønster eller farge) og en grense øverst. */
interface SideFelt {
  y0: number;
  y1: number;
  fyll: string;
  kant?: string;
}

/** Sideflaten til høyre i blokka (i skygge), med feltene lagt langs flaten som i Snittblokk. */
function Sideflate({ x, felt, dx, dy, bunn, id }: { x: number; felt: readonly SideFelt[]; dx: number; dy: number; bunn: number; id: string }) {
  const s = useGeoStroke();
  const D = Math.hypot(dx, dy);
  if (!(D > 0.5) || felt.length === 0) return null;
  const topp = Math.min(...felt.map((f) => f.y0));
  return (
    <g>
      <LinearGradient
        id={id}
        x2={1}
        y2={0}
        stops={[
          [0, SCENE.shadow, 0.7],
          [1, SCENE.shadow, 0.95],
        ]}
      />
      <g transform={`matrix(${r2(dx / D)} ${r2(-dy / D)} 0 1 ${r2(x)} 0)`}>
        {felt.map((f, i) =>
          f.y1 > f.y0 ? <rect key={i} x={0} y={r2(f.y0)} width={r2(D)} height={r2(f.y1 - f.y0)} fill={f.fyll} stroke={f.fyll} strokeWidth={0.5} /> : null,
        )}
        <rect x={0} y={r2(topp)} width={r2(D)} height={r2(Math.max(0, bunn - topp))} fill={`url(#${id})`} />
        {felt.slice(1).map((f, i) =>
          f.kant ? <line key={i} x1={0} x2={r2(D)} y1={r2(f.y0)} y2={r2(f.y0)} stroke={f.kant} strokeWidth={1.1 * s} /> : null,
        )}
      </g>
      <path d={`M${r2(x)} ${r2(topp)}l${r2(dx)} ${r2(-dy)}V${r2(bunn - dy)}L${r2(x)} ${r2(bunn)}`} fill="none" stroke={SCENE.outline} strokeWidth={1.2 * s} strokeLinejoin="round" />
    </g>
  );
}

/* =====================================================================================================================
 * Vannet: klart, grumsete eller slamstrøm
 * ================================================================================================================== */

/** Hvor mye slam vannet fører: 'klar' (lite), 'grumsete' (mye finstoff i suspensjon) eller 'slamstrom' (tett strøm av slam og stein). */
export type VannKlarhet = 'klar' | 'grumsete' | 'slamstrom';

/** Navnene på vanntypene til knapper og forklaringer (bokmål, stor forbokstav bare først). */
export const VANN_KLARHET_NAVN: Readonly<Record<VannKlarhet, string>> = {
  klar: 'Klart vann',
  grumsete: 'Grumsete vann',
  slamstrom: 'Slamstrøm',
};

interface VannFarger {
  /** Overflaten og det øverste vannet. */
  lys: string;
  midt: string;
  dyp: string;
  /** Toppflaten i perspektiv. */
  flate: string;
  /** Lyse striper og krusninger. */
  glans: string;
}

/** Fargene på vannet etter hvor mye slam det fører. `melk` gir brevann (melkeaktig av finmalt berg). */
function vannFarger(klarhet: VannKlarhet, melk = 0): VannFarger {
  if (klarhet === 'slamstrom') {
    const slam = mix(SCENE.soil, GEO.bergart.sand.line, 0.3);
    return {
      lys: mix(slam, SCENE.waterLight, 0.15),
      midt: slam,
      dyp: mix(SCENE.soilDark, slam, 0.35),
      flate: mix(slam, SCENE.highlight, 0.12),
      glans: mix(slam, SCENE.highlight, 0.45),
    };
  }
  const t = klarhet === 'grumsete' ? 0.5 : 0;
  const slam = mix(SCENE.soil, GEO.bergart.sand.fill, 0.35);
  const b = (c: string) => mix(melk > 0 ? mix(c, GEO.bre.fill, melk) : c, slam, t);
  return {
    lys: b(SCENE.waterLight),
    midt: b(SCENE.water),
    dyp: b(SCENE.waterDeep),
    flate: b(mix(SCENE.water, SCENE.waterLight, 0.5)),
    glans: mix(b(SCENE.waterLight), SCENE.highlight, 0.45),
  };
}

/* =====================================================================================================================
 * Fjellside, Bekk og Demning (kopiert fra fysikk/kap03/vannkraft-deler.tsx)
 * ================================================================================================================== */

/** Y på en polylinje ved x (endeverdiene utenfor). */
function polylinjeY(p: readonly SnittPunkt[], x: number): number {
  if (p.length === 0) return 0;
  if (x <= p[0]![0]) return p[0]![1];
  for (let i = 1; i < p.length; i++) {
    const [ax, ay] = p[i - 1]!;
    const [bx, by] = p[i]!;
    if (x <= bx) return bx > ax ? ay + ((by - ay) * (x - ax)) / (bx - ax) : by;
  }
  return p[p.length - 1]![1];
}

function polylinjeLengder(p: readonly SnittPunkt[]): number[] {
  const ut = [0];
  for (let i = 1; i < p.length; i++) ut.push(ut[i - 1]! + Math.hypot(p[i]![0] - p[i - 1]![0], p[i]![1] - p[i - 1]![1]));
  return ut;
}

function punktLangs(p: readonly SnittPunkt[], d: number): { x: number; y: number; dx: number; dy: number } {
  const L = polylinjeLengder(p);
  const total = L[L.length - 1] ?? 0;
  const s = clamp(d, 0, total);
  for (let i = 1; i < p.length; i++) {
    if (s <= L[i]! || i === p.length - 1) {
      const [ax, ay] = p[i - 1]!;
      const [bx, by] = p[i]!;
      const seg = L[i]! - L[i - 1]!;
      const t = seg > 0 ? (s - L[i - 1]!) / seg : 0;
      const len = seg > 0 ? seg : 1;
      return { x: ax + (bx - ax) * t, y: ay + (by - ay) * t, dx: (bx - ax) / len, dy: (by - ay) / len };
    }
  }
  const q = p[0] ?? [0, 0];
  return { x: q[0], y: q[1], dx: 1, dy: 0 };
}

/** Terrengprofilen flyttet `d` ned (laget under overflaten), med en svak bølge. */
function forskyvNed(p: readonly SnittPunkt[], d: number, bolge = 0, seed = 1): SnittPunkt[] {
  const rnd = sceneRandom(seed);
  const fase = rnd() * 6;
  return p.map(([x, y]) => [x, y + d + (bolge ? Math.sin(x / 37 + fase) * bolge : 0)]);
}

/** Props til `Fjellside`. */
export interface FjellsideProps {
  /** Overflaten fra venstre mot høyre, [x, y] i figurens enheter (samme punkter som til scene-kit-ets Terreng). */
  terreng: readonly SnittPunkt[];
  /** Det høyeste punktet i fjellet (y), der toningen starter. Standard: det høyeste punktet i terrenget. */
  topp?: number;
  /** Bunnen av snittet (y). */
  bunn: number;
  /** Skala på lagene og sprekkene (1 = standard; gang gjerne med useGeoScale på mobil). */
  k?: number;
  seed?: number;
  /**
   * Tegn Terreng (scene-kit-et) med denne overflaten først: 'gress', 'sno', 'jord' eller 'grus'. Standard ingen: da
   * tegner du Terreng selv rett før Fjellside, som i fysikk.
   */
  mark?: 'gress' | 'sno' | 'jord' | 'grus';
  /** Berggrunnen med geofagmønsteret (f.eks. 'gneis' eller 'granitt') i stedet for naturlig grå stein med lag og sprekker. */
  berggrunn?: MonsterId;
  /** Løsmasser mellom jorda og berget (f.eks. morene i en skråning): mønsteret og tykkelsen i figurens enheter. */
  losmasse?: { type: MonsterId; tykkelse: number };
  dim?: boolean;
}

/**
 * Fjellside i snitt under et terreng: jord, valgfrie løsmasser (morene i en skråning) og fast fjell med lag og sprekker
 * (eller berggrunnen med geofagmønsteret, `berggrunn`), klippet til terrenget. Ankerpunkt: punktene i `terreng` er i
 * figurens koordinater, og snittet går ned til `bunn`; tegnes rett etter scene-kit-ets Terreng, eller med `mark`, som
 * tegner Terreng selv.
 *
 * Høyt oppe er fjellet lysere (bart fjell), lenger ned mørkere. Kopiert fra fysikkens FjellSnitt (vannkraftverket).
 *   <Fjellside terreng={profil} bunn={320} mark="gress" losmasse={{ type: 'morene', tykkelse: 14 }} />
 */
export const Fjellside = memo(function Fjellside({ terreng, topp, bunn, k = 1, seed = 7, mark, berggrunn, losmasse, dim }: FjellsideProps) {
  const ss = useGeoStroke();
  const id = useSvgId('geo-fjell');
  const monstre = useLagMonstre('fjellside');
  const p = terreng.filter((q) => Number.isFinite(q[0]) && Number.isFinite(q[1]));
  if (p.length < 2 || !Number.isFinite(bunn)) return null;
  const forste = p[0]!;
  const siste = p[p.length - 1]!;
  const toppY = Number.isFinite(topp) ? (topp as number) : Math.min(...p.map((q) => q[1]));
  const lukk = (q: readonly SnittPunkt[]) => `${sti(q)}L${r1(siste[0])} ${r1(bunn + 30)}L${r1(forste[0])} ${r1(bunn + 30)}Z`;
  const jordD = 5 * k;
  const lmT = losmasse && Number.isFinite(losmasse.tykkelse) ? Math.max(0, losmasse.tykkelse) : 0;
  const jord = forskyvNed(p, jordD);
  const lm = lmT > 0 ? forskyvNed(p, jordD + 1, 0.8 * k, seed + 3) : null;
  const berg = forskyvNed(p, jordD + 6.5 * k + lmT, 1.5 * k, seed);
  const lag = [30, 62, 100, 146, 200, 262].map((d, i) => sti(forskyvNed(p, d * k + lmT, 4 * k, seed + i)));
  const rnd = sceneRandom(seed + 50);
  const sprekker: string[] = [];
  for (let i = 0; i < 26; i++) {
    const x = forste[0] + rnd() * (siste[0] - forste[0]);
    const yTop = polylinjeY(p, x) + lmT + (16 + rnd() * 120) * k;
    const lengde = (8 + rnd() * 16) * k;
    const skjev = (rnd() - 0.5) * 6;
    if (yTop > bunn) continue;
    sprekker.push(`M${r1(x)} ${r1(yTop)}l${r1(skjev)} ${r1(lengde)}`);
  }
  const bergFyll = berggrunn ? monstre.fyll(berggrunn).fill : `url(#${id}r)`;
  return (
    <g aria-hidden opacity={dim ? 0.4 : undefined}>
      {mark && <Terreng points={p.map((q): [number, number] => [q[0], q[1]])} bottom={bunn} type={mark} seed={seed} />}
      {(berggrunn || losmasse) && <LagMonstre id={monstre.id} bare={[...(berggrunn ? [berggrunn] : []), ...(losmasse ? [losmasse.type] : [])]} />}
      <defs>
        <clipPath id={`${id}c`}>
          <path d={lukk(p)} />
        </clipPath>
      </defs>
      <LinearGradient
        id={`${id}r`}
        userSpace
        x1={0}
        y1={toppY}
        x2={0}
        y2={bunn}
        stops={[
          [0, mix(SCENE.stone, SCENE.skyBottom, 0.38)],
          [0.45, mix(SCENE.stone, SCENE.skyBottom, 0.15)],
          [1, mix(mix(SCENE.stone, SCENE.stoneDark, 0.35), SCENE.mountainShade, 0.25)],
        ]}
      />
      <LinearGradient
        id={`${id}l`}
        userSpace
        x1={0}
        y1={toppY}
        x2={0}
        y2={bunn}
        stops={[
          [0, SCENE.highlight, 0.3],
          [0.5, SCENE.highlight, 0],
          [1, SCENE.shadow, 0.35],
        ]}
      />
      <g clipPath={`url(#${id}c)`}>
        <path d={lukk(jord)} fill={mix(SCENE.soil, SCENE.grassDark, 0.25)} />
        {lm && losmasse && <path d={lukk(lm)} fill={monstre.fyll(losmasse.type).fill} stroke={GEO.bergart[losmasse.type].line} strokeWidth={0.9 * ss} />}
        <path d={lukk(berg)} fill={bergFyll} />
        {berggrunn && <path d={lukk(berg)} fill={`url(#${id}l)`} />}
        <path d={sti(berg)} fill="none" stroke={berggrunn ? GEO.bergart[berggrunn].line : shade(SCENE.soil, 0.25)} strokeWidth={1 * ss} opacity={berggrunn ? 0.9 : 0.6} />
        {!berggrunn && (
          <>
            <path
              d={lag.join('')}
              fill="none"
              stroke={shade(SCENE.stoneDark, 0.15)}
              strokeWidth={0.8 * ss}
              strokeDasharray={`${r1(54 * k)} ${r1(16 * k)} ${r1(26 * k)} ${r1(22 * k)}`}
              opacity={0.35}
            />
            <path d={sprekker.join('')} fill="none" stroke={shade(SCENE.stoneDark, 0.15)} strokeWidth={0.7 * ss} opacity={0.4} strokeLinecap="round" />
          </>
        )}
      </g>
    </g>
  );
});

/** Høyden på vannet i bekken over bunnen (figurens enheter) langs bekken: jevn, men tynnere helt nederst. */
function bekkDybde(s: number, k: number, dybde: number): number {
  return (s < 0.85 ? dybde : dybde - 0.65 * dybde * ((s - 0.85) / 0.15)) * k;
}

/** Props til `Bekk`. */
export interface BekkProps {
  /** Bekkeleiet fra øverst til nederst, [x, y] i figurens enheter. */
  leie: readonly SnittPunkt[];
  /** Tid i sekunder: krusningene renner nedover. */
  t?: number;
  /** Skala på vannet og steinene (1 = standard). */
  k?: number;
  /** Vanndybden i figurens enheter (standard 4). */
  dybde?: number;
  /** Klart vann (standard), grumsete eller slamstrøm. */
  klarhet?: VannKlarhet;
  seed?: number;
  dim?: boolean;
}

/**
 * Bekk i snitt: et tynt lag vann oppå bekkeleiet med lys overflate, krusninger som renner nedover (med `t`) og runde
 * steiner; klart, grumsete eller slamstrøm. Ankerpunkt: punktene i `leie` er i figurens koordinater, fra der bekken
 * starter til der den ender. Tegnes etter terrenget og Fjellside.
 *   <Bekk leie={[[40, 120], [180, 170], [300, 200]]} t={clock.t} />
 */
export const Bekk = memo(function Bekk({ leie, t = 0, k = 1, dybde = 4, klarhet = 'klar', seed = 3, dim }: BekkProps) {
  const ss = useGeoStroke();
  const id = useSvgId('geo-bekk');
  const p = leie.filter((q) => Number.isFinite(q[0]) && Number.isFinite(q[1]));
  if (p.length < 2) return null;
  const L = polylinjeLengder(p);
  const total = L[L.length - 1] || 1;
  const dyp = Math.max(0.5, fin(dybde, 4));
  const vf = vannFarger(klarhet);
  const topp: SnittPunkt[] = p.map(([x, y], i) => [x, y - bekkDybde((L[i] ?? 0) / total, k, dyp)]);
  const bunnP = p.map(([x, y]): SnittPunkt => [x, y + 1.2]).reverse();
  const vann = sti([...topp, ...bunnP], true);
  const rnd = sceneRandom(seed);
  const steiner = [0.14, 0.46, 0.76].map((f, i) => {
    const a = punktLangs(p, f * total);
    const r = (i === 1 ? 8.5 : 6.2 + rnd() * 1.6) * k * (dyp / 4) ** 0.5;
    return { x: a.x + (rnd() - 0.5) * 6, y: a.y + 1, r };
  });
  const dash = 7 * k;
  const periode = 19 * k;
  const offset = -((fin(t) * 22) % periode);
  return (
    <g aria-hidden opacity={dim ? 0.4 : undefined}>
      <LinearGradient
        id={`${id}s`}
        x2={0.6}
        y2={1}
        stops={[
          [0, tint(SCENE.stone, 0.22)],
          [0.55, SCENE.stone],
          [1, shade(SCENE.stoneDark, 0.2)],
        ]}
      />
      <LinearGradient
        id={`${id}v`}
        stops={[
          [0, vf.lys],
          [0.45, vf.midt],
          [1, vf.dyp],
        ]}
      />
      {steiner.map((st, i) => (
        <path
          key={i}
          d={`M${r1(st.x - st.r)} ${r1(st.y)}C${r1(st.x - st.r)} ${r1(st.y - st.r * 1.25)} ${r1(st.x + st.r * 0.9)} ${r1(st.y - st.r * 1.35)} ${r1(st.x + st.r)} ${r1(st.y)}Z`}
          fill={`url(#${id}s)`}
          stroke={SCENE.outline}
          strokeWidth={0.7 * ss}
          strokeLinejoin="round"
        />
      ))}
      <path d={vann} fill={`url(#${id}v)`} opacity={klarhet === 'klar' ? 0.92 : 0.97} />
      <path d={sti(topp)} fill="none" stroke={vf.glans} strokeWidth={1.1 * ss} strokeLinecap="round" opacity={0.9} />
      <path
        d={sti(topp.map(([x, y]): SnittPunkt => [x, y + 1.6 * k]))}
        fill="none"
        stroke={vf.glans}
        strokeWidth={0.9 * ss}
        strokeLinecap="round"
        strokeDasharray={`${r1(dash)} ${r1(periode - dash)}`}
        strokeDashoffset={r1(offset)}
        opacity={0.8}
      />
      {steiner.map((st, i) => (
        <path
          key={i}
          d={`M${r1(st.x + st.r * 0.7)} ${r1(st.y - bekkDybde(0.5, k, dyp) + 0.6)}q${r1(st.r * 0.6)} ${r1(-1.2 * k)} ${r1(st.r * 1.3)} 0`}
          fill="none"
          stroke={vf.glans}
          strokeWidth={0.8 * ss}
          strokeLinecap="round"
          opacity={0.85}
        />
      ))}
    </g>
  );
});

/** Props til `Demning`. */
export interface DemningProps {
  /** Foten av den loddrette siden mot magasinet: x og bunnen (y). */
  x: number;
  y: number;
  /** Høyden fra foten til kronen (figurens enheter). */
  hoyde: number;
  /** Bredden på kronen (standard 0,14 · høyden, minst 4). */
  krone?: number;
  /** Hvor mye den nedstrøms siden heller: vannrett lengde per høyde (standard 0,75). */
  helning?: number;
  /** Magasinet til høyre (den loddrette siden vender mot høyre). Standard: magasinet til venstre. */
  flip?: boolean;
  /** Rekkverk på kronen (standard på). Uten rekkverk blir den en lav terskel, som i et bekkeinntak. */
  rekkverk?: boolean;
  dim?: boolean;
}

/** Målene på en demning (`demningMaal`): kronen, foten nedstrøms og omrisset. */
export interface DemningMaal {
  /** Kronen: midten og y. */
  krone: { x: number; y: number; bredde: number };
  /** Foten av den skrå siden nedstrøms. */
  fot: { x: number; y: number };
  /** Den loddrette siden mot magasinet (x). */
  vegg: number;
  /** Omrisset, til klipping og vannet i magasinet. */
  omriss: SnittPunkt[];
}

/**
 * Målene på en demning (samme geometri som `Demning` tegner): kronen, foten nedstrøms og omrisset. Gir null for
 * ugyldige tall eller høyde ≤ 0.
 */
export function demningMaal({ x, y, hoyde, krone, helning, flip }: Pick<DemningProps, 'x' | 'y' | 'hoyde' | 'krone' | 'helning' | 'flip'>): DemningMaal | null {
  if (![x, y, hoyde].every(Number.isFinite) || !(hoyde > 0)) return null;
  const H = hoyde;
  const kb = Math.max(4, fin(krone, 0.14 * H));
  const fa = Math.max(0, fin(helning, 0.75));
  const sgn = flip ? -1 : 1;
  const kroneY = y - H;
  const fotX = x + sgn * (kb + fa * H);
  const omriss: SnittPunkt[] = [
    [x - sgn * 2, y + 3],
    [x - sgn * 1, kroneY + 2],
    [x, kroneY],
    [x + sgn * kb, kroneY],
    [fotX, y],
    [fotX + sgn * 4, y + 3],
  ];
  return { krone: { x: x + (sgn * kb) / 2, y: kroneY, bredde: kb }, fot: { x: fotX, y }, vegg: x, omriss };
}

/**
 * Betongdemning i snitt: loddrett side mot magasinet, skrå side nedstrøms, rekkverk på kronen og støpeskjøter; uten
 * `rekkverk` en lav terskel. Ankerpunkt: (x, y) er foten av den loddrette siden mot magasinet (`flip` snur den);
 * `demningMaal` gir kronen og foten nedstrøms. Tegnes etter vannet i magasinet.
 *   <Demning x={420} y={260} hoyde={70} />
 */
export const Demning = memo(function Demning({ x, y, hoyde, krone, helning, flip, rekkverk = true, dim }: DemningProps) {
  const ss = useGeoStroke();
  const id = useSvgId('geo-dam');
  const m = demningMaal({ x, y, hoyde, krone, helning, flip });
  if (!m) return null;
  const sgn = flip ? -1 : 1;
  const H = hoyde;
  const kb = m.krone.bredde;
  const kroneY = m.krone.y;
  const fa = Math.max(0, fin(helning, 0.75));
  const betong = SCENE.concrete;
  const skjoter: string[] = [];
  for (let yy = kroneY + 8; yy < y - 3; yy += 8) {
    const xr = x + sgn * (kb + fa * (yy - kroneY));
    skjoter.push(`M${r1(x + sgn)} ${r1(yy)}L${r1(xr - sgn)} ${r1(yy)}`);
  }
  const railH = 5;
  const stolper: string[] = [];
  const steg = Math.max(3, (kb - 3) / 2);
  for (let px = 1.5; px <= kb - 1; px += steg) stolper.push(`M${r1(x + sgn * px)} ${r1(kroneY)}V${r1(kroneY - railH)}`);
  const kx0 = Math.min(x, x + sgn * kb);
  const kx1 = Math.max(x, x + sgn * kb);
  return (
    <g aria-hidden opacity={dim ? 0.4 : undefined}>
      <LinearGradient
        id={`${id}a`}
        x2={1}
        y2={0}
        stops={
          flip
            ? [
                [0, shade(betong, 0.22)],
                [0.6, betong],
                [1, tint(betong, 0.18)],
              ]
            : [
                [0, tint(betong, 0.18)],
                [0.4, betong],
                [1, shade(betong, 0.22)],
              ]
        }
      />
      <LinearGradient
        id={`${id}b`}
        stops={[
          [0, SCENE.shadow, 0],
          [0.7, SCENE.shadow, 0.12],
          [1, SCENE.shadow, 0.3],
        ]}
      />
      <path d={sti(m.omriss, true)} fill={`url(#${id}a)`} />
      <path d={sti(m.omriss, true)} fill={`url(#${id}b)`} />
      <path d={skjoter.join('')} stroke={shade(betong, 0.3)} strokeWidth={0.7 * ss} opacity={0.55} />
      <path
        d={`M${r1(x + sgn * (kb + fa * H * 0.25))} ${r1(kroneY + H * 0.25)}l${r1(sgn * fa * H * 0.5)} ${r1(H * 0.5)}`}
        stroke={shade(betong, 0.35)}
        strokeWidth={2.4 * ss}
        opacity={0.25}
        strokeLinecap="round"
      />
      <path d={sti(m.omriss, true)} fill="none" stroke={SCENE.outline} strokeWidth={0.9 * ss} strokeLinejoin="round" />
      <path d={`M${r1(kx0)} ${r1(kroneY + 0.8)}H${r1(kx1)}`} stroke={tint(betong, 0.5)} strokeWidth={1.4 * ss} />
      {rekkverk && <path d={stolper.join('')} stroke={SCENE.metalDark} strokeWidth={0.9 * ss} />}
      {rekkverk && <path d={`M${r1(kx0)} ${r1(kroneY - railH)}H${r1(kx1)}`} stroke={SCENE.metalDark} strokeWidth={1.1 * ss} strokeLinecap="round" />}
    </g>
  );
});

/* =====================================================================================================================
 * Isbre: typer
 * ================================================================================================================== */

/** Hva slags is: en bre i en dal, et isdekke over et helt landområde eller havis som flyter på havet. */
export type IsbreType = 'dalbre' | 'innlandsis' | 'havis';

/** Navnene på istypene til knapper og forklaringer. */
export const ISBRE_NAVN: Readonly<Record<IsbreType, string>> = {
  dalbre: 'Dalbre',
  innlandsis: 'Innlandsis',
  havis: 'Havis',
};

/** Navn på ankerpunktene i `IsbreGeometri.ankere` (ikke alle finnes for alle typene). */
export type IsbreAnkerNavn =
  | 'firn'
  | 'breis'
  | 'likevektslinje'
  | 'sprekker'
  | 'randkloft'
  | 'sidemorene'
  | 'bunnmorene'
  | 'endemorene'
  | 'bresjo'
  | 'breelv'
  | 'front'
  | 'akkumulasjon'
  | 'ablasjon'
  | 'berggrunn'
  | 'innlandsis'
  | 'isskille'
  | 'jordskorpe'
  | 'mantel'
  | 'hav'
  | 'nedsynking'
  | 'kyst'
  | 'havis'
  | 'sno'
  | 'raak'
  | 'skrugard'
  | 'isfjell'
  | 'smeltedam'
  | 'sjovann';

/** Props til `Isbre`. Propsene for én type virker ikke på de andre (se hver prop). */
export interface IsbreProps {
  /** 'dalbre' (standard), 'innlandsis' eller 'havis'. */
  type?: IsbreType;
  /** Øverste venstre hjørne av snittet foran (som i Snittblokk). Blokka stikker dx til høyre og dy opp. */
  x?: number;
  y?: number;
  /** Bredden og høyden på snittet foran. */
  w: number;
  h: number;
  /** Dybden på blokka (perspektivet; 0 gir et flatt snitt). Standard ca. 0,11 · w (høyst 90). */
  dybde?: number;
  /** Vinkelen på perspektivet i grader (standard 34). */
  vinkel?: number;
  /**
   * Istykkelsen i meter. Dalbre: den største tykkelsen når fronten står i 0,62 (standard 320 m; en lengre bre blir
   * tykkere). Innlandsis: tykkelsen midt på isdekket (standard 2500 m; 0 gir ingen is). Havis: tykkelsen på flakene
   * (standard 2 m, høyst 6 m).
   */
  tykkelse?: number;

  /* ---------- Dalbre ---------- */
  /** Dalbre: høyden (m o.h.) på toppen av botnveggen (snittets øverste punkt) og på dalbunnen ved høyre kant. Standard 2000 og 200. */
  hoyder?: { topp: number; bunn: number };
  /** Dalbre: likevektslinja i m o.h. (standard 1100). Over den er breen dekket av snø og firn, under den er det bar is. */
  likevektslinje?: number;
  /** Dalbre: hvor langt ned i dalen fronten når, som andel 0–1 av snittet (standard 0,62). `likevektsFront` gir fronten i likevekt. */
  front?: number;
  /**
   * Dalbre: endemorener. `true` (standard) gir én rett foran fronten, et tall eller en liste gir morener på de stedene
   * (andel 0–1, f.eks. der fronten stod før). Morener som fronten har passert, tegnes ikke.
   */
  endemorene?: boolean | number | readonly number[];
  /** Dalbre: sidemorene langs breen (og høyere oppe i dalsiden der breen var større). Standard på. */
  sidemorene?: boolean;
  /** Dalbre: bresjø bak den innerste endemorenen når det er plass (standard på). */
  bresjo?: boolean;
  /** Dalbre: bresprekker der breen er bratt (isfall) og nær fronten, og randkløft øverst. Standard på. */
  sprekker?: boolean;
  /** Dalbre: firn og snø over likevektslinja (standard på). */
  firn?: boolean;
  /** Dalbre: breelv og breelvavsetning (sandur) nedenfor morenene (standard på). */
  breelv?: boolean;
  /** Dalbre: klammer over breen med akkumulasjonsområdet og ablasjonsområdet (standard av). Trenger ca. 30 enheter over fjellveggen. */
  soner?: boolean;
  /** Dalbre: fjellsiden bak breen med snø over likevektslinja og skog nederst (standard på). */
  fjellvegg?: boolean;

  /* ---------- Innlandsis ---------- */
  /** Innlandsis: tykkelsen som fyller høyden på figuren (standard 3000 m). Hold den fast når tykkelsen endres. */
  maksTykkelse?: number;
  /** Innlandsis: midten av isdekket (isskillet) som andel 0–1 av snittet (standard 0,42). */
  senter?: number;
  /** Innlandsis: halve bredden av isdekket som andel av snittet. Standard etter tykkelsen (et tykt isdekke er bredere). */
  utbredelse?: number;
  /** Innlandsis: vis jordskorpa og mantelen under (ikke i målestokk), så nedsynkingen synes. Standard av. */
  isostasi?: boolean;
  /**
   * Innlandsis: hvor mye jordskorpa er trykt ned (m) der isen er tykkest. 'likevekt' gir isostatisk likevekt for isen som
   * ligger der nå (ρ_is/ρ_mantel · tykkelse); et tall brukes også når isen er borte (landet er fortsatt nede).
   * Standard 'likevekt' med `isostasi`, ellers 0.
   */
  nedsynking?: number | 'likevekt';
  /** Innlandsis: havnivået i meter i forhold til i dag (standard 0). */
  havniva?: number;
  /** Innlandsis: havet ved høyre kant (standard på). */
  hav?: boolean;

  /* ---------- Havis ---------- */
  /** Havis: hvor stor andel av havflaten som er dekket av is, 0–1 (standard 0,8). */
  dekning?: number;
  /** Havis: et isfjell (breis som har kalvet) til sammenligning, `true` eller plasseringen 0–1 (standard av). */
  isfjell?: boolean | number;
  /** Havis: smeltedammer på flakene (standard av). */
  smeltedammer?: boolean;

  /* ---------- Felles ---------- */
  /** Berggrunnen under isen (mønster, standard 'gneis'). */
  berggrunn?: MonsterId;
  /** Strømlinjer i isen (VIZ.velocity): ned i akkumulasjonsområdet og opp i ablasjonsområdet. Standard av. */
  strom?: boolean;
  /** Tid i sekunder: strømlinjene beveger seg. */
  t?: number;
  /** Frø for steiner, flak og sprekker. */
  seed?: number;
  /** Navn i en kolonne til høyre for blokka, fra x + w + dx + 18 (sett av ca. 150–200 enheter, mer på mobil). */
  etiketter?: boolean;
  /** Myk skygge under blokka (standard på). */
  skygge?: boolean;
  dim?: boolean;
  /** Tegnes oppå i figurens koordinater, med geometrien (ankerpunkter til piler og etiketter). */
  children?: (g: IsbreGeometri) => ReactNode;
}

/** Geometrien til en `Isbre` i figurens koordinater (fra `isbreGeometri`). */
export interface IsbreGeometri {
  type: IsbreType;
  /** Snittet foran og perspektivet (som i propsene). */
  x: number;
  y: number;
  w: number;
  h: number;
  dx: number;
  dy: number;
  /** Rammen rundt alt som tegnes (blokka, fjellveggen og sonene), uten etikettkolonnen. Bruk den til viewBox. */
  ramme: { x: number; y: number; w: number; h: number };
  /** y i figuren for en høyde: m o.h. for dalbre og innlandsis, meter over havflaten for havis. */
  yForHoyde: (z: number) => number;
  /** Den omvendte: høyden for en y i figuren. */
  hoydeForY: (y: number) => number;
  /** x i figuren for en andel 0–1 av snittet (0 = venstre kant). */
  xForAndel: (u: number) => number;
  /** Bakken under isen og vannet (berg, morene eller sediment) ved x. Havis: bunnen av snittet. */
  bakke: (x: number) => number;
  /** Toppen av isen ved x, eller null der det ikke er is (havis: toppen av flaket i snittet). */
  isTopp: (x: number) => number | null;
  /** Den øverste flaten ved x: is, vann eller bakke. */
  overflate: (x: number) => number;
  /** Istykkelsen i meter ved x (0 der det ikke er is). */
  isTykkelse: (x: number) => number;
  /** Dalbre: der likevektslinja krysser breoverflaten i snittet, med høyden (m o.h.). Ellers null. */
  likevektslinje: { x: number; y: number; hoyde: number } | null;
  /** Dalbre: andelen av breen (langs dalen) som ligger over likevektslinja (AAR). Null uten bre. */
  akkumulasjonsandel: number | null;
  /** Dalbre og innlandsis: fronten (der isen slutter) i snittet. Innlandsis: fronten mot høyre. */
  front: { x: number; y: number } | null;
  /** Innlandsis: hvor mye jordskorpa er trykt ned (m) ved x. Ellers 0. */
  nedsynking: (x: number) => number;
  /** Innlandsis: der havet begynner (x), dalbre: der bresjøen begynner. Null når det ikke er vann. */
  kyst: number | null;
  /** Ankerpunkter til etiketter og piler (i snittet eller på toppflaten). */
  ankere: Partial<Record<IsbreAnkerNavn, { x: number; y: number }>>;
}

/* =====================================================================================================================
 * Dalbre: modellen (rene funksjoner av andelen u = 0–1 langs dalen og den relative høyden r = 0–1)
 * ================================================================================================================== */

/** Standardverdiene for en dalbre. */
export const DALBRE_STANDARD = { topp: 2000, bunn: 200, likevektslinje: 1100, front: 0.62, tykkelse: 320 } as const;

/**
 * Dalbunnen i lengdesnitt (u langs dalen, r relativ høyde): botnveggen, botnen med en svak overfordypning, et trinn
 * (isfall), dalbunnen med et basseng der en bresjø kan bli liggende, og dalen videre ut. Formet etter typiske norske
 * botn- og dalbreer, ikke et bestemt sted.
 */
const DALBUNN: readonly (readonly [number, number])[] = [
  [0, 1],
  [0.02, 0.95],
  [0.045, 0.81],
  [0.07, 0.67],
  [0.095, 0.6],
  [0.13, 0.575],
  [0.17, 0.578],
  [0.2, 0.592],
  [0.228, 0.56],
  [0.262, 0.47],
  [0.3, 0.405],
  [0.35, 0.365],
  [0.45, 0.32],
  [0.55, 0.27],
  [0.62, 0.232],
  [0.68, 0.208],
  [0.735, 0.2],
  [0.79, 0.205],
  [0.84, 0.172],
  [0.9, 0.11],
  [0.95, 0.07],
  [1, 0.04],
];

/**
 * Toppene på dalsiden bak breen: (u, høyde over dalbunnen, halv bredde), relativ høyde. Dalsiden følger dalbunnen
 * (ikke breen), så den står stille når fronten flytter seg.
 */
const DALTOPPER: readonly (readonly [number, number, number])[] = [
  [0.05, 0.15, 0.06],
  [0.17, 0.11, 0.07],
  [0.3, 0.13, 0.08],
  [0.45, 0.1, 0.08],
  [0.6, 0.11, 0.09],
  [0.76, 0.09, 0.09],
  [0.9, 0.08, 0.08],
];

/** Ryggen på dalsiden over dalbunnen (relativ høyde): en grunnhøyde pluss spisse topper. */
function dalRygg(u: number): number {
  let t = 0;
  for (const [c, hh, b] of DALTOPPER) t = Math.max(t, hh * Math.max(0, 1 - Math.abs(u - c) / b) ** 1.15);
  return 0.15 + t;
}

/** Der breen starter på botnveggen (andel av snittet). */
const DAL_HODE = 0.035;
/** Fronten tykkelsen gjelder for. */
const DAL_REF = 0.62;

interface Morene {
  u: number;
  bredde: number;
  hoyde: number;
}

interface Bresjo {
  uA: number;
  uB: number;
  /** Vannflaten (relativ høyde). */
  rL: number;
  /** Sjøen ligger inntil brefronten (kalvende front). */
  kontakt: boolean;
}

interface DalbreModell {
  zTopp: number;
  zBunn: number;
  rE: number;
  berg: Fn;
  till: Fn;
  morene: Fn;
  sandur: Fn;
  terr: Fn;
  u0: number;
  uf: number;
  harIs: boolean;
  /** Istykkelsen (relativ høyde), 0 utenfor breen. */
  H: Fn;
  /** Breoverflaten (terreng + is). */
  flate: Fn;
  firn: Fn;
  uE: number | null;
  aar: number | null;
  morener: Morene[];
  /** Der breelvavsetningen begynner (utenfor den ytterste morenen). */
  ytterst: number;
  sjo: Bresjo | null;
  sprekker: number[];
  /** Breen slik den var da den nådde den ytterste morenen (til sidemorenen høyere oppe i dalsiden). */
  maks: { front: number; H: Fn } | null;
  breelv: boolean;
}

function moreneProfil(m: readonly Morene[]): Fn {
  return (u) => {
    let s = 0;
    for (const q of m) {
      let t = (u - q.u) / q.bredde;
      if (t > 0) t *= 1.3; // brattere på utsiden
      if (Math.abs(t) < 1) s += q.hoyde * (1 - t * t) ** 1.6;
    }
    return s;
  };
}

/** Istykkelsen langs breen: kvadratrot-profil (plastisk is) fra botnveggen til fronten, med glattet overflate. */
function dalbreIs(terr: Fn, u0: number, uf: number, Hmax: number, sjo: Bresjo | null): Fn {
  if (!(uf > u0 + 0.01) || !(Hmax > 0)) return () => 0;
  const L = uf - u0;
  const us = provepunkter(u0, uf, 170);
  const raa = us.map((u) => Hmax * Math.sqrt(clamp01((uf - u) / L)) * smooth(u0, u0 + 0.07, u));
  const flate = glattVerdier(
    us.map((u, i) => terr(u) + raa[i]!),
    4,
  );
  let Hs = us.map((u, i) => Math.max(0, flate[i]! - terr(u)));
  if (sjo?.kontakt) {
    // Kalvende front: isen står som en vegg over vannet
    Hs = Hs.map((v, i) => {
      const u = us[i]!;
      if (u < uf - 0.05) return v;
      const vann = sjo.rL - terr(u);
      return vann > 0 ? Math.max(v, vann + 0.016) : v;
    });
  }
  return (u) => (u < u0 || u > uf ? 0 : interp(us, Hs, u));
}

function finnBresjo(terr: Fn, nedre: number, m1: Morene, km: number): Bresjo | null {
  let rc = -Infinity;
  for (const u of linspace(m1.u - m1.bredde, m1.u + m1.bredde, 40)) rc = Math.max(rc, terr(u));
  const rL = rc - 0.007 * km;
  const steg = 0.0006;
  let uB = m1.u;
  while (uB > nedre && terr(uB) >= rL) uB -= steg;
  if (uB <= nedre) return null;
  let uA = uB;
  while (uA > nedre && terr(uA) < rL) uA -= steg;
  const kontakt = uA <= nedre;
  if (kontakt) uA = nedre;
  if (uB - uA < 0.008) return null;
  return { uA, uB, rL, kontakt };
}

function finnLikevekt(flate: Fn, u0: number, uf: number, rE: number): number {
  if (!(flate(u0) > rE)) return u0;
  const us = provepunkter(u0, uf, 320);
  for (let i = 1; i < us.length; i++) {
    if (flate(us[i]!) <= rE) {
      let a = us[i - 1]!;
      let b = us[i]!;
      for (let it = 0; it < 24; it++) {
        const m = (a + b) / 2;
        if (flate(m) > rE) a = m;
        else b = m;
      }
      return (a + b) / 2;
    }
  }
  return uf;
}

function finnSprekker(flate: Fn, u0: number, uf: number, kalvende: boolean, seed: number): number[] {
  const rnd = sceneRandom(seed + 17);
  const ut: number[] = [];
  const d = 0.004;
  let u = u0 + 0.06;
  while (u < uf - 0.075) {
    const helning = -(flate(u + d) - flate(u - d)) / (2 * d);
    if (helning > 1.25) {
      ut.push(u + (rnd() - 0.5) * 0.003);
      u += 0.0115;
    } else u += 0.004;
  }
  if (!kalvende) for (let v = uf - 0.062; v < uf - 0.016; v += 0.0165) ut.push(v + (rnd() - 0.5) * 0.003);
  return ut;
}

type DalbreValg = Pick<
  IsbreProps,
  'hoyder' | 'likevektslinje' | 'front' | 'tykkelse' | 'endemorene' | 'bresjo' | 'sprekker' | 'firn' | 'breelv' | 'seed'
>;

function dalbreModell(p: DalbreValg, k = 1): DalbreModell {
  let zTopp = fin(p.hoyder?.topp, DALBRE_STANDARD.topp);
  let zBunn = fin(p.hoyder?.bunn, DALBRE_STANDARD.bunn);
  if (!(zTopp > zBunn + 1)) {
    zTopp = DALBRE_STANDARD.topp;
    zBunn = DALBRE_STANDARD.bunn;
  }
  const span = zTopp - zBunn;
  const rE = (fin(p.likevektslinje, DALBRE_STANDARD.likevektslinje) - zBunn) / span;
  const km = clamp(fin(k, 1), 1, 1.7) ** 0.6;
  const berg = pchip(DALBUNN);
  const u0 = DAL_HODE;
  const uf = clamp(fin(p.front, DALBRE_STANDARD.front), u0, 1);
  const Hrel = Math.max(0, fin(p.tykkelse, DALBRE_STANDARD.tykkelse)) / span;
  const harIs = uf > u0 + 0.02 && Hrel > 0;

  const mB = 0.03 * km;
  const mH = 0.058 * km;
  const onsket: number[] =
    p.endemorene === false
      ? []
      : p.endemorene === undefined || p.endemorene === true
        ? harIs
          ? [uf + mB * 0.9]
          : []
        : typeof p.endemorene === 'number'
          ? [p.endemorene]
          : [...p.endemorene];
  const morener: Morene[] = onsket
    .filter((u) => Number.isFinite(u) && u > (harIs ? uf + 0.3 * mB : 0.3) && u < 1 - mB)
    .sort((a, b) => a - b)
    .map((u) => ({ u, bredde: mB, hoyde: mH }));
  const ytterst = Math.max(harIs ? uf + 0.035 : 0.33, ...morener.map((m) => m.u + m.bredde / 1.3));
  const tillT = 0.02 * km;
  const till: Fn = (u) => tillT * smooth(0.27, 0.33, u) * (1 - smooth(ytterst - 0.005, ytterst + 0.025, u));
  const morene = moreneProfil(morener);
  const breelv = p.breelv !== false;
  const sandurT = breelv ? 0.034 * km : 0;
  const sandur: Fn = (u) => sandurT * smooth(ytterst - 0.01, ytterst + 0.06, u) * (0.75 + 0.25 * smooth(ytterst, 1, u));
  const terr: Fn = (u) => berg(u) + till(u) + morene(u) + sandur(u);
  // En bresjø trenger plass mellom fronten og den innerste morenen (en bre som skyver på morenen, har ingen sjø foran seg)
  const m1 = morener[0];
  const sjo = p.bresjo !== false && m1 && (!harIs || m1.u - uf > 1.6 * mB) ? finnBresjo(terr, harIs ? uf : 0.3, m1, km) : null;

  const Hmax = Hrel * Math.sqrt(Math.max(0, uf - u0) / (DAL_REF - u0));
  const H = harIs ? dalbreIs(terr, u0, uf, Hmax, sjo) : () => 0;
  const flate: Fn = (u) => terr(u) + H(u);
  const uE = harIs ? finnLikevekt(flate, u0, uf, rE) : null;
  const aar = harIs && uE !== null ? clamp01((uE - u0) / (uf - u0)) : null;
  const medFirn = p.firn !== false;
  const firn: Fn = (u) =>
    medFirn && harIs && uE !== null && u >= u0 && u <= uE ? Math.min(0.045 * km, 0.6 * H(u), Math.max(0, flate(u) - rE) * 0.45) : 0;
  const ytre = morener[morener.length - 1];
  let maks: DalbreModell['maks'] = null;
  if (harIs && ytre && ytre.u > uf + 0.03) {
    const mf = ytre.u - 0.5 * ytre.bredde;
    maks = { front: mf, H: dalbreIs(terr, u0, mf, Hrel * Math.sqrt((mf - u0) / (DAL_REF - u0)), null) };
  }
  const sprekker = harIs && p.sprekker !== false ? finnSprekker(flate, u0, uf, !!sjo?.kontakt, fin(p.seed, 1)) : [];
  return { zTopp, zBunn, rE, berg, till, morene, sandur, terr, u0, uf, harIs, H, flate, firn, uE, aar, morener, ytterst, sjo, sprekker, maks, breelv };
}

/**
 * Hvor langt ned i dalen fronten til en dalbre står i likevekt med en gitt likevektslinje (m o.h.), etter regelen om at
 * omtrent 60 % av breen ligger over likevektslinja (AAR ≈ 0,6). Gir fronten som andel 0–1 av snittet i `Isbre`
 * (samme dal og samme høyder), 1 når breen fyller hele dalen, og null når likevektslinja ligger så høyt at det ikke blir
 * noen bre. Tommelfingerregelen er omtrentlig; den forteller hvilken vei fronten flytter seg, ikke hvor fort.
 *   const front = likevektsFront(ela) ?? 0;   <Isbre likevektslinje={ela} front={front} />
 */
export function likevektsFront(
  likevektslinje: number,
  valg: { hoyder?: { topp: number; bunn: number }; tykkelse?: number; akkumulasjonsandel?: number } = {},
): number | null {
  if (!Number.isFinite(likevektslinje)) return null;
  const mal = clamp(fin(valg.akkumulasjonsandel, 0.6), 0.05, 0.95);
  const aarVed = (uf: number) =>
    dalbreModell({ front: uf, likevektslinje, hoyder: valg.hoyder, tykkelse: valg.tykkelse, endemorene: false, bresjo: false, sprekker: false, breelv: false }).aar;
  let lo = DAL_HODE + 0.05;
  let hi = 1;
  const aLo = aarVed(lo);
  if (aLo === null || aLo < mal) return null;
  const aHi = aarVed(hi);
  if (aHi !== null && aHi >= mal) return 1;
  for (let i = 0; i < 32; i++) {
    const m = (lo + hi) / 2;
    const a = aarVed(m);
    if (a !== null && a >= mal) lo = m;
    else hi = m;
  }
  return (lo + hi) / 2;
}

/* =====================================================================================================================
 * Innlandsis og havis: modellene
 * ================================================================================================================== */

/** Landet under innlandsisen før det ble trykt ned (m o.h.): en fjellkjede, lavland og kysten mot høyre. */
function innlandLand(u: number): number {
  return (
    140 +
    540 * Math.exp(-(((u - 0.24) / 0.11) ** 2)) +
    240 * Math.exp(-(((u - 0.52) / 0.15) ** 2)) +
    45 * Math.sin(37 * u + 1) +
    25 * Math.sin(83 * u + 2) -
    640 * smooth(0.72, 0.93, u)
  );
}

/** Vialov-profilen for et isdekke: H = Hc · (1 − (|d|/L)^(4/3))^(3/8). */
function vialov(Hc: number, c: number, L: number): Fn {
  return (u) => {
    const d = Math.abs(u - c) / L;
    return d < 1 && Hc > 0 ? Hc * (1 - d ** (4 / 3)) ** (3 / 8) : 0;
  };
}

/** Glatter en funksjon med en gaussisk kjerne (bøyning av skorpa: nedsynkingen er bredere og mykere enn isen). */
function glattFn(g: Fn, sigma: number): Fn {
  const us = linspace(-0.3, 1.3, 240);
  const vs = us.map(g);
  const steg = us[1]! - us[0]!;
  const n = Math.ceil((3 * sigma) / steg);
  const vekt = Array.from({ length: 2 * n + 1 }, (_, i) => Math.exp(-0.5 * (((i - n) * steg) / sigma) ** 2));
  const sum = vekt.reduce((a, b) => a + b, 0);
  const ut = vs.map((_, i) => {
    let s = 0;
    for (let j = -n; j <= n; j++) s += (vs[clamp(i + j, 0, vs.length - 1)] ?? 0) * vekt[j + n]!;
    return s / sum;
  });
  return (u) => interp(us, ut, u);
}

interface InnlandsisModell {
  maks: number;
  Hc: number;
  c: number;
  L: number;
  /** Istykkelsen (m). */
  H: Fn;
  /** Nedsynkingen (m). */
  n: Fn;
  /** Bunnen under isen (m o.h.). */
  bunn: Fn;
  hav: number;
  harHav: boolean;
  /** Der havet begynner (andel), eller null. */
  uK: number | null;
  isostasi: boolean;
}

type InnlandsisValg = Pick<IsbreProps, 'tykkelse' | 'maksTykkelse' | 'senter' | 'utbredelse' | 'isostasi' | 'nedsynking' | 'havniva' | 'hav'>;

function innlandsisModell(p: InnlandsisValg): InnlandsisModell {
  const maks = Math.max(100, fin(p.maksTykkelse, 3000));
  const Hc = clamp(fin(p.tykkelse, 2500), 0, maks * 1.2);
  const c = clamp(fin(p.senter, 0.42), -0.2, 1.2);
  const Lstd = (h: number) => clamp(0.4 * (h / 2500) ** 1.2, 0.02, 0.75);
  const L = p.utbredelse !== undefined && Number.isFinite(p.utbredelse) ? clamp(p.utbredelse, 0.02, 1.2) : Lstd(Hc);
  const raa = vialov(Hc, c, L);
  const isostasi = !!p.isostasi;
  const modus = p.nedsynking ?? (isostasi ? 'likevekt' : 0);
  const forhold = TETTHETER.is / TETTHETER.mantel;
  let n: Fn = () => 0;
  if (modus === 'likevekt') {
    if (Hc > 0) {
      const g = glattFn(raa, 0.05);
      n = (u) => forhold * g(u);
    }
  } else if (Number.isFinite(modus) && modus > 0) {
    const Href = Hc > 0 ? Hc : 0.8 * maks;
    const form = glattFn(Hc > 0 ? raa : vialov(Href, c, Lstd(Href)), 0.05);
    const topp = Math.max(1e-6, ...linspace(-0.2, 1.2, 140).map(form));
    n = (u) => (modus * form(u)) / topp;
  }
  const hav = fin(p.havniva, 0);
  const harHav = p.hav !== false;
  const bunn: Fn = (u) => innlandLand(u) - n(u);
  // Kalvende front der isen når ut i havet: isen står som en vegg over vannet
  const H: Fn = (u) => {
    let v = raa(u);
    if (v > 0 && harHav && bunn(u) < hav) {
      const dKant = L - Math.abs(u - c);
      if (dKant < 0.025) v = Math.max(v, hav - bunn(u) + 60);
    }
    return v;
  };
  let uK: number | null = null;
  if (harHav && bunn(1) < hav && H(1) <= 0) {
    let u = 1;
    while (u > 0 && bunn(u - 0.002) < hav && H(u - 0.002) <= 0) u -= 0.002;
    uK = u;
  }
  return { maks, Hc, c, L, H, n, bunn, hav, harHav, uK, isostasi };
}

/** Ett isflak i havis: fra a til b (andel av snittet), mellom q0 og q1 i dybden bakover, med tykkelse og eventuell skrugard. */
interface Flak {
  a: number;
  b: number;
  q0: number;
  q1: number;
  /** Tykkelse i meter. */
  t: number;
  rygg: { u: number; bredde: number } | null;
  /** Små forskyvninger av hjørnene (kantete flak). */
  j: [number, number, number, number];
}

interface HavisModell {
  tykkelse: number;
  dekning: number;
  rader: Flak[][];
  isfjell: { u: number; bredde: number } | null;
}

/** Deler en rad i flak og råker slik at flakene dekker andelen `dekning`. */
function flakRad(seed: number, dekning: number, tykkelse: number, q0: number, q1: number, unnta: [number, number] | null): Flak[] {
  if (!(dekning > 0.005)) return [];
  const rnd = sceneRandom(seed);
  const hel = dekning >= 0.985;
  const n = hel ? 1 : Math.max(1, Math.round(2 + 4 * dekning));
  const wf = Array.from({ length: n }, () => 0.6 + 0.8 * rnd());
  const wg = Array.from({ length: n + 1 }, () => 0.3 + 1.4 * rnd());
  const sf = wf.reduce((a, b) => a + b, 0);
  const sg = wg.reduce((a, b) => a + b, 0);
  const ut: Flak[] = [];
  let u = hel ? 0 : ((1 - dekning) * wg[0]!) / sg;
  for (let i = 0; i < n; i++) {
    const bredde = hel ? 1 : (dekning * wf[i]!) / sf;
    const a = u;
    const b = u + bredde;
    u = b + (hel ? 0 : ((1 - dekning) * wg[i + 1]!) / sg);
    const t = tykkelse * (0.85 + 0.3 * rnd());
    const rygg = bredde > 0.11 && rnd() < 0.65 ? { u: a + bredde * (0.3 + 0.4 * rnd()), bredde: 0.028 + 0.012 * rnd() } : null;
    const j: [number, number, number, number] = [rnd() - 0.5, rnd() - 0.5, rnd() - 0.5, rnd() - 0.5];
    if (unnta && b > unnta[0] && a < unnta[1]) {
      if (a < unnta[0] - 0.02) ut.push({ a, b: unnta[0], q0, q1, t, rygg: rygg && rygg.u < unnta[0] - 0.02 ? rygg : null, j });
      if (b > unnta[1] + 0.02) ut.push({ a: unnta[1], b, q0, q1, t, rygg: rygg && rygg.u > unnta[1] + 0.02 ? rygg : null, j });
      continue;
    }
    ut.push({ a, b, q0, q1, t, rygg, j });
  }
  return ut;
}

type HavisValg = Pick<IsbreProps, 'tykkelse' | 'dekning' | 'isfjell' | 'seed'>;

function havisModell(p: HavisValg): HavisModell {
  const tykkelse = clamp(fin(p.tykkelse, 2), 0, 6);
  const dekning = clamp01(fin(p.dekning, 0.8));
  const isfjell =
    p.isfjell === true || (typeof p.isfjell === 'number' && Number.isFinite(p.isfjell))
      ? { u: clamp(typeof p.isfjell === 'number' ? p.isfjell : 0.76, 0.12, 0.88), bredde: 0.14 }
      : null;
  const seed = fin(p.seed, 1);
  const unnta: [number, number] | null = isfjell ? [isfjell.u - isfjell.bredde * 0.85, isfjell.u + isfjell.bredde * 0.85] : null;
  const rader = [0, 1, 2].map((r) => flakRad(seed * 31 + r * 7, dekning, tykkelse, r / 3, (r + 1) / 3, r === 0 ? unnta : null));
  return { tykkelse, dekning, rader, isfjell };
}

/** Andelen av et isflak som ligger over vannflaten (fribord): 1 − ρ_is/ρ_sjøvann, omtrent 0,1. */
const FRIBORD = 1 - TETTHETER.is / TETTHETER.sjovann;

/* =====================================================================================================================
 * Isbre: oppsettet (lokale koordinater i snittet) og geometrien
 * ================================================================================================================== */

const geoK = (f: number) => Math.max(1, 0.85 * (Number.isFinite(f) ? f : 1));

interface Felles {
  w: number;
  h: number;
  dx: number;
  dy: number;
  k: number;
  f: number;
}

interface DalbreOppsett extends Felles {
  type: 'dalbre';
  m: DalbreModell;
  Y0: number;
  yR: Fn;
  xU: Fn;
  /** Den øverste flaten (relativ høyde): is, sjø eller terreng. */
  topR: Fn;
  /** Ryggen på fjellsiden bak (relativ høyde). */
  rJag: Fn;
  veggTopp: number;
  soner: { y: number; tekstY: number } | null;
  rammeTopp: number;
}

interface InnlandsisOppsett extends Felles {
  type: 'innlandsis';
  m: InnlandsisModell;
  yZ: Fn;
  xU: Fn;
  /** Mohoflaten (lokal y), med isostasi. */
  moho: Fn;
  rammeTopp: number;
}

interface HavisOppsett extends Felles {
  type: 'havis';
  m: HavisModell;
  /** Piksler per meter istykkelse. */
  mPx: number;
  xU: Fn;
  /** Isfjellet i lokale koordinater (over og under vann). */
  fjell: { x: number; bredde: number; hoyde: number; kjol: number } | null;
  rammeTopp: number;
}

type IsbreOppsett = DalbreOppsett | InnlandsisOppsett | HavisOppsett;

function isbreOppsett(p: IsbreProps, f: number): IsbreOppsett | null {
  const w = fin(p.w);
  const h = fin(p.h);
  if (!(w > 10) || !(h > 10)) return null;
  const type: IsbreType = p.type === 'innlandsis' || p.type === 'havis' ? p.type : 'dalbre';
  const ff = Number.isFinite(f) && f > 0 ? f : 1;
  const k = geoK(ff);
  const { dx, dy } = snittblokkPerspektiv(p.dybde ?? (type === 'dalbre' ? Math.min(90, 0.11 * w) : Math.min(64, 0.085 * w)), p.vinkel);
  const xU = (u: number) => u * w;
  if (type === 'dalbre') {
    const m = dalbreModell(p, k);
    const Y0 = 0.86 * h;
    const yR = (r: number) => (1 - r) * Y0;
    const topR = (u: number) => {
      const t = m.flate(u);
      return m.sjo && u > m.sjo.uA && u < m.sjo.uB ? Math.max(t, m.sjo.rL) : t;
    };
    const rJag = (u: number) => {
      const tr = topR(u) + 0.004;
      const jag = 0.008 * (0.6 * Math.sin(u * 97 + 1.3) + 0.4 * Math.sin(u * 211 + 0.4));
      const rygg = Math.max(m.berg(u) + dalRygg(u) + jag, tr + 0.05);
      return lerp(tr, rygg, smooth(0, 0.035, u) * (1 - smooth(0.94, 1, u)));
    };
    let veggTopp = yR(topR(0)) - dy;
    if (p.fjellvegg !== false) for (const u of linspace(0, 1, 160)) veggTopp = Math.min(veggTopp, yR(rJag(u)) - dy);
    const fs = 17 * 0.8 * ff;
    const soner = p.soner && m.harIs && m.uE !== null ? { y: veggTopp - 12, tekstY: veggTopp - 18 } : null;
    return { type, w, h, dx, dy, k, f: ff, m, Y0, yR, xU, topR, rJag, veggTopp, soner, rammeTopp: soner ? soner.tekstY - fs - 2 : veggTopp - 2 };
  }
  if (type === 'innlandsis') {
    const m = innlandsisModell(p);
    const ySea0 = m.isostasi ? 0.46 * h : 0.64 * h;
    const mPx = ((m.isostasi ? 0.36 : 0.58) * h) / m.maks;
    const yZ = (z: number) => ySea0 - z * mPx;
    const moho = (u: number) => ySea0 + 0.24 * h + m.n(u) * mPx;
    let topp = Infinity;
    for (const u of linspace(0, 1, 120)) topp = Math.min(topp, yZ(m.bunn(u) + m.H(u)), yZ(m.hav));
    return { type, w, h, dx, dy, k, f: ff, m, yZ, xU, moho, rammeTopp: topp - dy - 2 };
  }
  const m = havisModell(p);
  // Piksler per meter: etter høyden, men aldri så mye at flakene blir høye klosser i en smal figur (mobil)
  const mPx = Math.min(0.07 * h, 0.02 * w);
  const fjell = m.isfjell ? { x: m.isfjell.u * w, bredde: m.isfjell.bredde * w, hoyde: 0.24 * h, kjol: Math.min(0.82 * h, 0.24 * h * 3.3) } : null;
  let topp = -m.tykkelse * mPx * (FRIBORD + 0.06) - dy;
  for (const rad of m.rader) for (const fl of rad) if (fl.rygg) topp = Math.min(topp, -fl.t * mPx * (FRIBORD + 0.4) - fl.q1 * dy);
  if (fjell) topp = Math.min(topp, -fjell.hoyde - 0.6 * dy);
  return { type, w, h, dx, dy, k, f: ff, m, mPx, xU, fjell, rammeTopp: topp - 2 };
}

/** Flaket i den fremste raden ved andelen u, eller null (råk). */
function flakVed(m: HavisModell, u: number): Flak | null {
  for (const fl of m.rader[0] ?? []) if (u >= fl.a && u <= fl.b) return fl;
  return null;
}

/**
 * Geometrien til en `Isbre` i figurens koordinater: rammen rundt alt som tegnes (til viewBox), høyder og andeler som
 * x og y, bakken, istoppen og overflaten ved x, likevektslinja og akkumulasjonsandelen (dalbre), nedsynkingen og kysten
 * (innlandsis) og ankerpunkter til etiketter og piler. `f` er tekstskaleringen (som `useTextScale`); den samme
 * geometrien får barna i `<Isbre>`. Gir null for ugyldige mål.
 *   const g = isbreGeometri({ type: 'dalbre', x: 20, y: 90, w: 600, h: 260, likevektslinje: ela, front }, f);
 */
export function isbreGeometri(p: IsbreProps, f = 1): IsbreGeometri | null {
  const o = isbreOppsett(p, f);
  if (!o) return null;
  return byggIsbreGeometri(p, o);
}

function byggIsbreGeometri(p: IsbreProps, o: IsbreOppsett): IsbreGeometri {
  const x = fin(p.x);
  const y = fin(p.y);
  const { w, h, dx, dy } = o;
  const uFra = (X: number) => clamp01((fin(X) - x) / w);
  const pt = (lx: number, ly: number) => ({ x: x + lx, y: y + ly });
  const ramme = { x, y: y + o.rammeTopp, w: w + dx, h: h - o.rammeTopp + 6 };
  const felles = { type: o.type, x, y, w, h, dx, dy, ramme, xForAndel: (u: number) => x + fin(u) * w };
  if (o.type === 'dalbre') {
    const { m, yR, xU, topR } = o;
    const span = m.zTopp - m.zBunn;
    const ankere: IsbreGeometri['ankere'] = {};
    const uE = m.uE;
    const ekteE = uE !== null && m.aar !== null && m.aar > 0.001 && m.aar < 0.999;
    if (m.harIs) {
      const uMid = lerp(uE ?? m.u0, m.uf, 0.45);
      ankere.breis = pt(xU(uMid), yR(m.terr(uMid) + 0.5 * m.H(uMid)));
      ankere.front = pt(xU(m.uf), yR(m.terr(m.uf) + 0.5 * m.H(m.uf - 0.008)));
      if (uE !== null && uE > m.u0 + 0.05) {
        const uF = (m.u0 + 0.04 + uE) / 2;
        if (m.firn(uF) > 0) ankere.firn = pt(xU(uF), yR(m.flate(uF) - m.firn(uF) / 2));
        ankere.akkumulasjon = pt(xU((m.u0 + uE) / 2) + 0.5 * dx, yR(m.flate((m.u0 + uE) / 2)) - 0.5 * dy);
      }
      if (uE !== null && uE < m.uf - 0.03) ankere.ablasjon = pt(xU((uE + m.uf) / 2) + 0.5 * dx, yR(m.flate((uE + m.uf) / 2)) - 0.5 * dy);
      if (ekteE && uE !== null) ankere.likevektslinje = pt(xU(uE) + 0.5 * dx, yR(m.flate(uE)) - 0.5 * dy);
      if (p.sprekker !== false) ankere.randkloft = pt(xU(m.u0 + 0.014), yR(m.flate(m.u0 + 0.014)) + 3);
      if (p.sidemorene !== false) {
        const us = lerp(uE ?? m.u0 + 0.2, m.uf, 0.7);
        ankere.sidemorene = pt(xU(us) + 0.9 * dx, yR(m.flate(us)) - 0.9 * dy - 2);
      }
      // Sprekken som står lengst fra de andre ankerne, så to prikker ikke havner oppå hverandre (firn og isfall)
      const andre = [ankere.firn, ankere.likevektslinje, ankere.breis, ankere.front, ankere.sidemorene].filter((q) => q !== undefined);
      let uc: number | undefined;
      let lengst = -1;
      for (const u of m.sprekker) {
        const q = pt(xU(u), yR(m.flate(u)) + 2);
        const d = andre.length ? Math.min(...andre.map((a) => Math.hypot(a.x - q.x, a.y - q.y))) : 0;
        if (d > lengst + 1e-6) {
          lengst = d;
          uc = u;
        }
      }
      if (uc !== undefined) ankere.sprekker = pt(xU(uc), yR(m.flate(uc)) + 2);
    }
    const uB = m.harIs ? lerp(0.36, m.uf, 0.55) : 0.5;
    if (m.till(uB) > 0) ankere.bunnmorene = pt(xU(uB), yR(m.berg(uB) + m.till(uB) / 2));
    const m1 = m.morener[0];
    if (m1) ankere.endemorene = pt(xU(m1.u), yR(m.terr(m1.u)) + 4);
    if (m.sjo) ankere.bresjo = pt(xU((m.sjo.uA + m.sjo.uB) / 2), yR(m.sjo.rL) + 4);
    if (m.breelv) {
      const ub = (m.ytterst + 1) / 2;
      if (m.sandur(ub) > 0) ankere.breelv = pt(xU(ub), yR(m.terr(ub) - m.sandur(ub) / 2));
    }
    ankere.berggrunn = pt(xU(0.55), (yR(m.berg(0.55)) + h) / 2);
    return {
      ...felles,
      yForHoyde: (z) => y + yR((fin(z) - m.zBunn) / span),
      hoydeForY: (Y) => m.zBunn + (1 - (fin(Y) - y) / o.Y0) * span,
      bakke: (X) => y + yR(m.terr(uFra(X))),
      isTopp: (X) => {
        const u = uFra(X);
        return m.H(u) > 1e-5 ? y + yR(m.flate(u)) : null;
      },
      overflate: (X) => y + yR(topR(uFra(X))),
      isTykkelse: (X) => m.H(uFra(X)) * span,
      likevektslinje: ekteE && uE !== null ? { x: x + xU(uE), y: y + yR(m.rE), hoyde: m.zBunn + m.rE * span } : null,
      akkumulasjonsandel: m.aar,
      front: m.harIs ? ankere.front ?? null : null,
      nedsynking: () => 0,
      kyst: m.sjo ? x + xU(m.sjo.uA) : null,
      ankere,
    };
  }
  if (o.type === 'innlandsis') {
    const { m, yZ, xU, moho } = o;
    const ankere: IsbreGeometri['ankere'] = {};
    const uR = m.c + m.L;
    if (m.Hc > 0) {
      const ui = clamp(m.c + 0.35 * m.L, 0.02, 0.98);
      ankere.innlandsis = pt(xU(ui), yZ(m.bunn(ui) + 0.5 * m.H(ui)));
      const uc = clamp(m.c, 0, 1);
      ankere.isskille = pt(xU(uc) + 0.5 * dx, yZ(m.bunn(uc) + m.H(uc)) - 0.5 * dy);
    }
    const un = clamp(m.c, 0.05, 0.95);
    if (m.n(un) > 1) ankere.nedsynking = pt(xU(un), yZ(m.bunn(un)));
    const uj = m.uK !== null ? clamp(m.uK - 0.06, 0.05, 0.95) : 0.9;
    ankere[m.isostasi ? 'jordskorpe' : 'berggrunn'] = pt(xU(uj), m.isostasi ? (yZ(m.bunn(uj)) + moho(uj)) / 2 : (yZ(m.bunn(uj)) + h) / 2);
    if (m.isostasi) ankere.mantel = pt(xU(0.5), (moho(0.5) + h) / 2);
    if (m.uK !== null) {
      const uh = (m.uK + 1) / 2;
      ankere.hav = pt(xU(uh), (yZ(m.hav) + yZ(m.bunn(uh))) / 2);
      ankere.kyst = pt(xU(m.uK), yZ(m.hav));
    }
    if (m.Hc > 0 && uR < 1) ankere.front = pt(xU(uR), yZ(m.bunn(uR) + Math.min(m.H(uR - 0.004), 400)));
    return {
      ...felles,
      yForHoyde: (z) => y + yZ(fin(z)),
      hoydeForY: (Y) => (yZ(0) - (fin(Y) - y)) / (yZ(0) - yZ(1)),
      bakke: (X) => y + yZ(m.bunn(uFra(X))),
      isTopp: (X) => {
        const u = uFra(X);
        return m.H(u) > 0 ? y + yZ(m.bunn(u) + m.H(u)) : null;
      },
      overflate: (X) => {
        const u = uFra(X);
        if (m.H(u) > 0) return y + yZ(m.bunn(u) + m.H(u));
        return y + yZ(m.uK !== null && u >= m.uK ? m.hav : m.bunn(u));
      },
      isTykkelse: (X) => m.H(uFra(X)),
      likevektslinje: null,
      akkumulasjonsandel: null,
      front: m.Hc > 0 && uR < 1 ? ankere.front ?? null : null,
      nedsynking: (X) => m.n(uFra(X)),
      kyst: m.uK !== null ? x + xU(m.uK) : null,
      ankere,
    };
  }
  const { m, mPx, xU, fjell } = o;
  const ankere: IsbreGeometri['ankere'] = {};
  const rad0 = m.rader[0] ?? [];
  const storst = [...rad0].sort((a, b) => b.b - b.a - (a.b - a.a))[0];
  if (storst) {
    const um = (storst.a + storst.b) / 2;
    ankere.havis = pt(xU(um), storst.t * mPx * (0.5 - FRIBORD));
    ankere.sno = pt(xU(um) + 0.4 * dx, -storst.t * mPx * FRIBORD - 0.4 * dy - 1);
    if (storst.rygg) ankere.skrugard = pt(xU(storst.rygg.u), -storst.t * mPx * (FRIBORD + 0.3));
    ankere.smeltedam = pt(xU(lerp(storst.a, storst.b, 0.3)) + 0.5 * dx, -storst.t * mPx * FRIBORD - 0.5 * dy);
  }
  for (let i = 0; i <= rad0.length; i++) {
    const a = i === 0 ? 0 : rad0[i - 1]!.b;
    const b = i === rad0.length ? 1 : rad0[i]!.a;
    if (b - a > 0.02 && a > 0.01 && b < 0.99) {
      ankere.raak = pt(xU((a + b) / 2), 2);
      break;
    }
  }
  if (fjell) ankere.isfjell = pt(fjell.x, -fjell.hoyde * 0.45);
  ankere.sjovann = pt(xU(0.5), 0.72 * h);
  const flakTopp = (u: number) => {
    const fl = flakVed(m, u);
    return fl ? -fl.t * mPx * FRIBORD : null;
  };
  return {
    ...felles,
    yForHoyde: (z) => y - fin(z) * mPx,
    hoydeForY: (Y) => -(fin(Y) - y) / mPx,
    bakke: () => y + h,
    isTopp: (X) => {
      const t = flakTopp(uFra(X));
      return t === null ? null : y + t;
    },
    overflate: (X) => y + (flakTopp(uFra(X)) ?? 0),
    isTykkelse: (X) => flakVed(m, uFra(X))?.t ?? 0,
    likevektslinje: null,
    akkumulasjonsandel: null,
    front: null,
    nedsynking: () => 0,
    kyst: null,
    ankere,
  };
}

/* =====================================================================================================================
 * Isbre: tegningen
 * ================================================================================================================== */

const sirkel = (cx: number, cy: number, r: number) =>
  `M${r2(cx - r)} ${r2(cy)}a${r2(r)} ${r2(r)} 0 1 0 ${r2(2 * r)} 0a${r2(r)} ${r2(r)} 0 1 0 ${r2(-2 * r)} 0`;

/** En morenerygg langs en linje (sidemorene): grå-brun vold med lys topp, mørk fot og små steiner. */
function MoreneRygg({ punkter, bredde, seed = 1 }: { punkter: readonly SnittPunkt[]; bredde: number; seed?: number }) {
  const s = useGeoStroke();
  if (punkter.length < 2) return null;
  const d = glattSti(punkter);
  const c = GEO.bergart.morene;
  const base = mix(c.fill, SCENE.stone, 0.3);
  const rnd = sceneRandom(seed);
  const L = polylinjeLengder(punkter);
  const total = L[L.length - 1] ?? 0;
  let steiner = '';
  for (let a = 2; a < total - 1; a += 3.5 + rnd() * 4) {
    const q = punktLangs(punkter, a);
    steiner += sirkel(q.x + (rnd() - 0.5) * bredde * 0.6, q.y + (rnd() - 0.5) * bredde * 0.5, (0.45 + rnd() * 0.45) * bredde * 0.32);
  }
  return (
    <g>
      <path d={d} fill="none" stroke={SCENE.outline} strokeWidth={bredde + 1.4 * s} strokeLinecap="round" strokeLinejoin="round" opacity={0.5} />
      <path d={d} fill="none" stroke={base} strokeWidth={bredde} strokeLinecap="round" strokeLinejoin="round" />
      <path d={d} transform={`translate(0 ${r2(-bredde * 0.2)})`} fill="none" stroke={tint(base, 0.32)} strokeWidth={bredde * 0.32} strokeLinecap="round" />
      <path d={steiner} fill={c.line} opacity={0.55} />
    </g>
  );
}

type DalFlate = 'sno' | 'is' | 'berg' | 'bergSno' | 'vann' | 'morene' | 'sandur' | 'gress';

/** Fargen på isen i snitt: blålig i begge temaer, lysere øverst og mørkere mot bunnen. */
function isFarger() {
  const midt = mix(GEO.bre.fill, SCENE.water, 0.38);
  return { topp: tint(midt, 0.22), midt, bunn: shade(midt, 0.2) };
}

/** Teksten på en sone som får plass i bredden (lang, kort eller ingen forkortelse). */
function soneTekst(lang: string, kort: string, bredde: number, f: number): string {
  return tekstBredde(lang, 0.8, f) <= bredde - 8 ? lang : kort;
}

/**
 * Klammer over en sone: vannrett strek med knekk ned i endene og teksten over. Får teksten ikke plass over klammeren,
 * står den ut fra den ene enden (`anker`), så to klammer som møtes ikke får tekst oppå hverandre.
 */
function Klammer({ x0, x1, y, tekst, anker, min }: { x0: number; x1: number; y: number; tekst: string; anker: 'start' | 'end'; min: number }) {
  const s = useGeoStroke();
  const f = useTextScale();
  if (!(x1 - x0 > 6)) return null;
  const b = tekstBredde(tekst, 0.8, f);
  const passer = b <= x1 - x0 - 6;
  // Teksten ut fra enden som vender bort fra naboen, men ikke ut av figuren til venstre. Luften mot grensen vokser med
  // teksten, så to klammer som møtes ikke får tekstene kant i kant på mobil.
  const luft = 0.45 * 17 * 0.8 * f;
  let tx = passer ? (x0 + x1) / 2 : anker === 'end' ? x1 - luft : x0 + luft;
  let a: 'start' | 'middle' | 'end' = passer ? 'middle' : anker;
  if (!passer && anker === 'end' && tx - b < min) {
    tx = Math.max(min, x0);
    a = 'start';
  }
  return (
    <g>
      <path d={`M${r2(x0 + 1)} ${r2(y + 6)}V${r2(y)}H${r2(x1 - 1)}V${r2(y + 6)}`} fill="none" stroke={VIZ.ink} strokeWidth={1.3 * s} strokeLinejoin="round" />
      <Txt x={tx} y={y - 5} size={0.8} weight={650} anchor={a}>
        {tekst}
      </Txt>
    </g>
  );
}

function DalbreTegning({ p, o, x, y }: { p: IsbreProps; o: DalbreOppsett; x: number; y: number }) {
  const s = useGeoStroke();
  const kk = useGeoScale();
  const f = useTextScale();
  const uid = useSvgId('dalbre');
  const monstre = useLagMonstre('dalbre');
  const { m, w, h, dx, dy, yR, xU, topR } = o;
  const berggrunn: MonsterId = p.berggrunn ?? 'gneis';
  const seed = fin(p.seed, 1);
  const ekstra = [
    m.u0,
    m.uf,
    Math.min(1, m.uf + 1e-4),
    m.ytterst,
    ...(m.uE !== null ? [m.uE] : []),
    ...(m.sjo ? [m.sjo.uA, m.sjo.uA + 1e-4, m.sjo.uB] : []),
    ...m.morener.flatMap((q) => [q.u - q.bredde, q.u - q.bredde / 2, q.u, q.u + q.bredde / 2.6, q.u + q.bredde / 1.3]),
  ];
  const us = provepunkter(0, 1, 320, ekstra);
  const xs = us.map(xU);
  const topp = (lx: number) => yR(topR(lx / w));
  const harIs = m.harIs;
  const iU = (u: number) => harIs && u >= m.u0 && u <= m.uf && m.H(u) > 1e-5;
  const vannSjo = vannFarger('klar', 0.35);
  const vannElv = vannFarger('klar', 0.5);
  const isF = isFarger();
  const ekteE = m.uE !== null && m.aar !== null && m.aar > 0.001 && m.aar < 0.999;
  const fjellvegg = p.fjellvegg !== false;
  const sidemorene = p.sidemorene !== false;

  /* ---------- Toppflaten ---------- */
  const typeVed = (lx: number): DalFlate => {
    const u = lx / w;
    if (iU(u)) return m.uE !== null && u < m.uE ? 'sno' : 'is';
    if (m.sjo && u > m.sjo.uA && u < m.sjo.uB) return 'vann';
    if (u < 0.3) return m.terr(u) > m.rE ? 'bergSno' : 'berg';
    if (u <= m.ytterst + 0.01) return 'morene';
    return m.breelv ? 'sandur' : 'gress';
  };
  const lop = delILop(xs, topp, typeVed);
  const isFlate = mix(GEO.bre.fill, GEO.bre.line, 0.18);
  const farge = (t: DalFlate, q: number): string => {
    switch (t) {
      case 'sno':
        return q < 0 ? mix(SCENE.snow, SCENE.snowShade, 0.22 * -q) : SCENE.snow;
      case 'is':
        return lysFarge(isFlate, q);
      case 'berg':
        return lysFarge(mix(SCENE.stone, SCENE.stoneDark, 0.15), q);
      case 'bergSno':
        return q < 0 ? mix(mix(SCENE.snow, SCENE.stone, 0.3), SCENE.snowShade, 0.2 * -q) : mix(SCENE.snow, SCENE.stone, 0.3);
      case 'vann':
        return vannSjo.flate;
      case 'morene':
        return lysFarge(mix(GEO.bergart.morene.fill, SCENE.stone, 0.35), q);
      case 'sandur':
        return lysFarge(mix(GEO.bergart.breelv.fill, SCENE.gravel, 0.45), q);
      default:
        return lysFarge(SCENE.grass, q);
    }
  };

  // Bresprekker på toppflaten: to korte, svakt buede sprekker på tvers av breen ved hver posisjon
  const rnd = sceneRandom(seed + 5);
  const sprekkBiter = m.sprekker.flatMap((uc) => {
    const a = 0.06 + rnd() * 0.12;
    const b = a + 0.22 + rnd() * 0.18;
    const c = b + 0.08 + rnd() * 0.08;
    const d = Math.min(0.94, c + 0.2 + rnd() * 0.2);
    return [
      { uc, q0: a, q1: b },
      { uc, q0: c, q1: d },
    ];
  });
  const sprekkSti = (uc: number, q0: number, q1: number) => {
    const yy = yR(m.flate(uc));
    const x0 = xU(uc) + q0 * dx;
    const x1 = xU(uc) + q1 * dx;
    const y0 = yy - q0 * dy;
    const y1 = yy - q1 * dy;
    return `M${r2(x0)} ${r2(y0)}Q${r2((x0 + x1) / 2 + 3 * kk)} ${r2((y0 + y1) / 2 + 0.6)} ${r2(x1)} ${r2(y1)}`;
  };
  const pynt = (l: Lop<DalFlate>) => {
    const xa = l.p[0]![0];
    const xb = l.p[l.p.length - 1]![0];
    if (l.type === 'is' || l.type === 'sno') {
      const her = sprekkBiter.filter((b) => xU(b.uc) >= xa && xU(b.uc) <= xb);
      if (her.length === 0) return null;
      const d = her.map((b) => sprekkSti(b.uc, b.q0, b.q1)).join('');
      return (
        <g fill="none" strokeLinecap="round">
          <path d={d} stroke={shade(GEO.bre.fill, 0.5)} strokeWidth={2 * s * Math.sqrt(kk)} />
          <path d={d} transform="translate(0.8 -1)" stroke={tint(SCENE.snow, 0.2)} strokeWidth={0.7 * s} opacity={0.8} />
        </g>
      );
    }
    if (l.type === 'vann') {
      const bred = xb - xa;
      if (bred < 20) return null;
      const yy = l.p[0]![1];
      return (
        <g stroke={vannSjo.glans} strokeLinecap="round" fill="none">
          {[0.35, 0.68].map((q, j) => (
            <line key={j} x1={r2(xa + q * dx + bred * 0.15)} y1={r2(yy - q * dy)} x2={r2(xb + q * dx - bred * 0.25)} y2={r2(yy - q * dy)} strokeWidth={1.2 * s} opacity={0.8 - 0.25 * j} />
          ))}
          {m.sjo?.kontakt &&
            [0.22, 0.55, 0.8].map((q, j) => {
              const bx = xa + bred * (0.15 + 0.22 * j) + q * dx;
              const by = yy - q * dy;
              const r = (2.2 + j) * kk;
              return <path key={`i${j}`} d={`M${r2(bx - r)} ${r2(by)}l${r2(r * 0.4)} ${r2(-r * 0.7)}h${r2(r * 1.1)}l${r2(r * 0.5)} ${r2(r * 0.7)}Z`} fill={SCENE.snow} stroke={GEO.bre.line} strokeWidth={0.7 * s} />;
            })}
        </g>
      );
    }
    if (l.type === 'morene' || l.type === 'sandur') {
      const r2nd = sceneRandom(Math.round(xa * 13) + seed);
      let d = '';
      const tett = l.type === 'morene' ? 0.08 : 0.035;
      const n = Math.round((xb - xa) * tett);
      for (let i = 0; i < n; i++) {
        const lx = xa + (xb - xa) * r2nd();
        const q = 0.05 + 0.9 * r2nd();
        d += sirkel(lx + q * dx, topp(lx) - q * dy, (0.5 + r2nd() * 0.7) * kk);
      }
      return d ? <path d={d} fill={GEO.bergart.morene.line} opacity={0.45} /> : null;
    }
    return null;
  };

  /* ---------- Fjellsiden bak ---------- */
  const vu = linspace(0, 1, 220);
  const bakkant = (u: number) => yR(topR(u)) - dy;
  const veggRygg = vu.map((u): SnittPunkt => [xU(u) + dx, yR(o.rJag(u)) - dy]);
  const veggBunn = vu.map((u): SnittPunkt => [xU(u) + dx, bakkant(u)]);
  const veggPoly = [...veggRygg, ...[...veggBunn].reverse()];
  const veggMaks = Math.max(...veggBunn.map((q) => q[1]));
  const snoY = (u: number) =>
    yR(m.rE) - dy + o.Y0 * (0.05 * Math.max(0, Math.sin(u * 61 + 0.7)) ** 6 + 0.022 * Math.max(0, Math.sin(u * 23 + 2.1)) ** 4);
  const snoPoly: SnittPunkt[] = [[dx, o.veggTopp - 10], [w + dx, o.veggTopp - 10], ...[...vu].reverse().map((u): SnittPunkt => [xU(u) + dx, snoY(u)])];
  // Skyggesidene: fra hver topp i ryggen ned mot høyre (lyset kommer fra venstre)
  const ryggR = vu.map((u) => m.berg(u) + dalRygg(u));
  const topper: number[] = [];
  const daler: number[] = [];
  for (let j = 1; j < vu.length - 1; j++) {
    if (ryggR[j]! > ryggR[j - 1]! && ryggR[j]! >= ryggR[j + 1]!) topper.push(j);
    if (ryggR[j]! < ryggR[j - 1]! && ryggR[j]! <= ryggR[j + 1]!) daler.push(j);
  }
  const fasetter = topper.map((jt) => {
    const jv = daler.find((j) => j > jt) ?? vu.length - 1;
    const [xp, yp] = veggRygg[jt]!;
    const [xv, yv] = veggRygg[jv]!;
    const bp = bakkant(vu[jt]!);
    const bv = bakkant(vu[jv]!);
    return [
      ...veggRygg.slice(jt, jv + 1),
      [xv + 0.12 * (xv - xp), yv + 0.5 * (bv - yv)] as SnittPunkt,
      [xp + 0.32 * (xv - xp), yp + 0.7 * (bp - yp)] as SnittPunkt,
    ];
  });
  // Skar (renner) ned fra skardene i ryggen
  const skar = daler.map((jv) => {
    const [xv, yv] = veggRygg[jv]!;
    const bv = bakkant(vu[jv]!);
    return `M${r2(xv)} ${r2(yv + 2)}Q${r2(xv + 4)} ${r2(yv + 0.3 * (bv - yv))} ${r2(xv + 2)} ${r2(yv + 0.62 * (bv - yv))}`;
  });
  // Skog nederst i dalsiden, men ikke der breen lå da den var størst (der er det nylig bart)
  const rT = m.rE - 0.17;
  const skogUs = linspace(0, 1, Math.max(60, Math.round(w / (4 * kk))));
  const skogBunn = (u: number) => {
    let b = bakkant(u);
    if (m.maks && u <= m.maks.front + 0.01) b = Math.min(b, yR(m.terr(u) + m.maks.H(u)) - dy - 3 * kk);
    else if (harIs && u <= m.uf) b = Math.min(b, bakkant(u) - 2 * kk);
    return b;
  };
  const skogBiter: SnittPunkt[][] = [];
  let bit: { topp: SnittPunkt[]; bunn: SnittPunkt[] } | null = null;
  const lukkBit = () => {
    if (bit && bit.topp.length > 2) skogBiter.push([...bit.topp, ...[...bit.bunn].reverse()]);
    bit = null;
  };
  skogUs.forEach((u, j) => {
    const yb = skogBunn(u);
    const yt = Math.max(yR(rT) - dy, yb - 13 * kk) + (j % 2 ? 1.6 : -2.6) * kk;
    if (yb - yt > 3 && u > 0.02 && u < 0.985) {
      bit ??= { topp: [], bunn: [] };
      bit.topp.push([xU(u) + dx, yt]);
      bit.bunn.push([xU(u) + dx, yb]);
    } else lukkBit();
  });
  lukkBit();
  // Sidemorener: langs breen nå, og høyere oppe i dalsiden der breen var størst
  const mb = 4.2 * kk;
  const sideNa: SnittPunkt[] =
    sidemorene && harIs
      ? provepunkter(m.uE ?? m.u0 + 0.2, m.uf - 0.006, 70).map((u): SnittPunkt => [xU(u) + 0.9 * dx, yR(m.flate(u)) - 0.9 * dy - 1.2])
      : [];
  const sideGammel: SnittPunkt[] =
    sidemorene && fjellvegg && m.maks
      ? provepunkter(Math.max(m.uE ?? m.u0 + 0.2, m.uf - 0.06), m.maks.front, 70)
          .map((u): [number, number, number] => [xU(u) + dx, yR(m.terr(u) + m.maks!.H(u)) - dy - 1, bakkant(u)])
          .filter((q) => q[2] - q[1] > 2.5)
          .map((q): SnittPunkt => [q[0], q[1]])
      : [];

  /* ---------- Breelva på toppflaten ---------- */
  const elvBiter: [number, number][] = [];
  if (m.breelv && harIs) {
    const slutt1 = m.sjo ? m.sjo.uA : 1;
    if (slutt1 - m.uf > 0.012) elvBiter.push([m.uf + 0.002, slutt1]);
    if (m.sjo && 1 - m.sjo.uB > 0.012) elvBiter.push([m.sjo.uB, 1]);
  } else if (m.breelv && m.sjo && 1 - m.sjo.uB > 0.012) elvBiter.push([m.sjo.uB, 1]);
  const elvQ = (u: number, gren: number) => {
    const q = 0.48 + 0.16 * Math.sin((u - m.uf) * 55 + seed);
    return clamp(q + gren * 0.13 * Math.sin(u * 38 + 1) * smooth(m.ytterst, m.ytterst + 0.05, u), 0.08, 0.92);
  };
  const elvStier = elvBiter.flatMap(([a, b]) =>
    [0, 1].map((gren) =>
      glattSti(
        provepunkter(a, b, Math.max(8, Math.round((b - a) * 120))).map((u): SnittPunkt => {
          const q = elvQ(u, gren);
          return [xU(u) + q * dx, topp(xU(u)) - q * dy];
        }),
      ),
    ),
  );

  /* ---------- Snittet foran ---------- */
  const bergTopp = us.map((u): SnittPunkt => [xU(u), yR(m.berg(u))]);
  const tmR = (u: number) => m.berg(u) + m.till(u) + m.morene(u);
  const lagBiter = (tykk: Fn, toppR: Fn, bunnR: Fn): SnittPunkt[][] => {
    const ut: SnittPunkt[][] = [];
    let cur: number[] = [];
    for (const u of us) {
      if (tykk(u) > 1e-4) cur.push(u);
      else if (cur.length) {
        cur.push(u);
        ut.push([...cur.map((v): SnittPunkt => [xU(v), yR(toppR(v))]), ...[...cur].reverse().map((v): SnittPunkt => [xU(v), yR(bunnR(v))])]);
        cur = [];
      }
    }
    if (cur.length > 1) ut.push([...cur.map((v): SnittPunkt => [xU(v), yR(toppR(v))]), ...[...cur].reverse().map((v): SnittPunkt => [xU(v), yR(bunnR(v))])]);
    return ut;
  };
  const tillBiter = lagBiter((u) => m.till(u) + m.morene(u), tmR, m.berg);
  const sandurBiter = lagBiter(m.sandur, m.terr, tmR);
  const isUs = harIs ? us.filter((u) => u >= m.u0 && u <= m.uf) : [];
  const isPoly: SnittPunkt[] = [...isUs.map((u): SnittPunkt => [xU(u), yR(m.flate(u))]), ...[...isUs].reverse().map((u): SnittPunkt => [xU(u), yR(m.terr(u))])];
  const isMinY = isUs.length ? Math.min(...isUs.map((u) => yR(m.flate(u)))) : 0;
  const isMaxY = isUs.length ? Math.max(...isUs.map((u) => yR(m.terr(u)))) : 1;
  const isBaand = harIs
    ? [0.3, 0.58, 0.8].map((dl) =>
        sti(isUs.filter((u) => m.H(u) * o.Y0 > 6).map((u): SnittPunkt => [xU(u), yR(m.terr(u) + (1 - dl) * m.H(u))])),
      )
    : [];
  const rDebris = sceneRandom(seed + 9);
  let debris = '';
  for (const u of isUs) {
    if (m.H(u) * o.Y0 < 5 || rDebris() < 0.45) continue;
    debris += sirkel(xU(u) + (rDebris() - 0.5) * 2, yR(m.terr(u) + m.H(u) * (0.03 + 0.1 * rDebris())), (0.5 + 0.5 * rDebris()) * kk);
  }
  const firnUs = harIs && m.uE !== null ? isUs.filter((u) => u <= m.uE! && m.firn(u) > 0) : [];
  const firnPoly: SnittPunkt[] =
    firnUs.length > 2
      ? [...firnUs.map((u): SnittPunkt => [xU(u), yR(m.flate(u))]), ...[...firnUs].reverse().map((u): SnittPunkt => [xU(u), yR(m.flate(u) - m.firn(u))])]
      : [];
  const firnLag = firnUs.length > 2 ? [0.35, 0.68].map((a) => sti(firnUs.map((u): SnittPunkt => [xU(u), yR(m.flate(u) - a * m.firn(u))]))) : [];
  const hakk = (uc: number, dybde: number, bredde: number) => {
    const xc = xU(uc);
    const y0 = topp(xc - bredde);
    const y1 = topp(xc + bredde);
    const yb = yR(m.flate(uc)) + dybde;
    return `M${r2(xc - bredde)} ${r2(y0 - 0.5)}L${r2(xc + 0.3)} ${r2(yb)}L${r2(xc + bredde)} ${r2(y1 - 0.5)}Z`;
  };
  const sprekkHakk = m.sprekker.map((uc) => hakk(uc, Math.min(0.022 * o.Y0 * kk, 0.45 * m.H(uc) * o.Y0), 2.2 * kk)).join('');
  const randkloft = harIs && p.sprekker !== false && m.H(m.u0 + 0.014) * o.Y0 > 4 ? hakk(m.u0 + 0.014, 0.55 * m.H(m.u0 + 0.014) * o.Y0, 1.6 * kk) : '';
  const sjoPoly: SnittPunkt[] = m.sjo
    ? (() => {
        const su = us.filter((u) => u >= m.sjo!.uA && u <= m.sjo!.uB);
        return [[xU(m.sjo!.uA), yR(m.sjo!.rL)], [xU(m.sjo!.uB), yR(m.sjo!.rL)], ...[...su].reverse().map((u): SnittPunkt => [xU(u), yR(m.terr(u))])];
      })()
    : [];
  const toppLinje = us.map((u): SnittPunkt => [xU(u), yR(topR(u))]);
  const frontSti = sti([...toppLinje, [w, h], [0, h]], true);
  const t0 = toppLinje[0]![1];
  const tw = toppLinje[toppLinje.length - 1]![1];

  /* ---------- Sideflaten ved høyre kant ---------- */
  const sideFelt: SideFelt[] = [];
  const H1 = m.H(1);
  const yT1 = yR(m.terr(1));
  if (H1 > 1e-5) sideFelt.push({ y0: yR(m.flate(1)), y1: yT1, fyll: isF.midt });
  else if (m.sjo && m.sjo.uB >= 0.999) sideFelt.push({ y0: yR(m.sjo.rL), y1: yT1, fyll: vannSjo.dyp });
  if (m.sandur(1) > 1e-4) sideFelt.push({ y0: yT1, y1: yR(tmR(1)), fyll: monstre.fyll('breelv').fill, kant: GEO.bergart.breelv.line });
  if (m.till(1) + m.morene(1) > 1e-4) sideFelt.push({ y0: yR(tmR(1)), y1: yR(m.berg(1)), fyll: monstre.fyll('morene').fill, kant: GEO.bergart.morene.line });
  sideFelt.push({ y0: yR(m.berg(1)), y1: h, fyll: monstre.fyll(berggrunn).fill, kant: GEO.bergart[berggrunn].line });

  /* ---------- Strømlinjer i isen ---------- */
  const stromLinjer: StromLinje[] = [];
  if (p.strom && harIs && m.uE !== null) {
    const a0 = m.u0 + 0.035;
    const a1 = m.uE;
    const b0 = m.uE;
    const b1 = m.uf - 0.02;
    const par: [number, number, number][] = [
      [0.12, 0.9, 0.8],
      [0.45, 0.62, 0.55],
      [0.78, 0.32, 0.3],
    ];
    if (a1 - a0 > 0.03 && b1 - b0 > 0.03)
      for (const [fa, fb, dmax] of par) {
        const ua = lerp(a0, a1, fa);
        const ub = lerp(b0, b1, fb);
        const punkter = linspace(0, 1, 14).map((t): SnittPunkt => {
          const u = lerp(ua, ub, t);
          const dl = 0.07 + (dmax - 0.07) * Math.sin(Math.PI * t) ** 0.8;
          return [xU(u), yR(m.flate(u) - dl * m.H(u))];
        });
        stromLinjer.push({ punkter });
      }
  }

  /* ---------- Sonene over breen ---------- */
  const sone = o.soner && m.uE !== null && harIs ? o.soner : null;
  const xa = xU(m.u0) + 0.5 * dx;
  const xe = m.uE !== null ? xU(m.uE) + 0.5 * dx : xa;
  const xf = xU(m.uf) + 0.5 * dx;
  // Når akkumulasjonsteksten må stå til venstre for klammeren men ikke får plass, står ablasjonsklammeren en rad høyere
  const akkTekst = soneTekst('Akkumulasjonsområde', 'Akkumulasjon', xe - xa, f);
  const akkTekstForBred = tekstBredde(akkTekst, 0.8, f) > xe - xa - 6 && xe - 0.45 * 17 * 0.8 * f - tekstBredde(akkTekst, 0.8, f) < -x + 4;

  return (
    <g transform={`translate(${r2(x)} ${r2(y)})`}>
      <LagMonstre id={monstre.id} bare={DALBRE_MONSTRE.get(berggrunn)} />
      <defs>
        <clipPath id={`${uid}-vegg`}>
          <path d={sti(veggPoly, true)} />
        </clipPath>
      </defs>
      {p.skygge !== false && <ContactShadow cx={(w + dx) / 2} cy={h - dy / 2 + 3} rx={(w + dx) / 2 + 8} ry={Math.max(6, dy / 2 + 7)} opacity={0.7} />}

      {/* ---------- Fjellsiden bak breen ---------- */}
      {fjellvegg && (
        <g>
          <LinearGradient
            id={`${uid}-fjell`}
            userSpace
            x1={0}
            y1={o.veggTopp}
            x2={0}
            y2={veggMaks}
            stops={[
              [0, mix(SCENE.stone, SCENE.skyBottom, 0.4)],
              [0.55, mix(SCENE.stone, SCENE.skyBottom, 0.18)],
              [1, mix(mix(SCENE.stone, SCENE.stoneDark, 0.35), SCENE.mountainShade, 0.3)],
            ]}
          />
          <LinearGradient
            id={`${uid}-skog`}
            stops={[
              [0, mix(SCENE.foliage, SCENE.skyBottom, 0.12)],
              [1, SCENE.foliageDark],
            ]}
          />
          <path d={sti(veggPoly, true)} fill={`url(#${uid}-fjell)`} />
          <g clipPath={`url(#${uid}-vegg)`}>
            <path d={sti(snoPoly, true)} fill={SCENE.snowcap} opacity={0.88} />
            <path d={fasetter.map((q) => sti(q, true)).join('')} fill={SCENE.mountainShade} opacity={0.32} />
            <path d={skar.join('')} fill="none" stroke={shade(SCENE.mountainShade, 0.1)} strokeWidth={1.2 * s} opacity={0.45} strokeLinecap="round" />
            {skogBiter.length > 0 && <path d={skogBiter.map((q) => sti(q, true)).join('')} fill={`url(#${uid}-skog)`} />}
            <line x1={dx} x2={w + dx} y1={r2(yR(m.rE) - dy)} y2={r2(yR(m.rE) - dy)} stroke={VIZ.ink} strokeWidth={1.1 * s} strokeDasharray="7 6" opacity={0.4} />
          </g>
          <path d={sti(veggRygg)} fill="none" stroke={SCENE.outline} strokeWidth={0.9 * s} strokeLinejoin="round" opacity={0.6} />
          {sideGammel.length > 2 && <MoreneRygg punkter={sideGammel} bredde={mb} seed={seed + 2} />}
        </g>
      )}

      {/* ---------- Toppflaten ---------- */}
      {dy > 0.5 && <Toppflate lop={lop} dx={dx} dy={dy} farge={farge} pynt={pynt} />}
      {dy > 0.5 && elvStier.length > 0 && (
        <g fill="none" strokeLinecap="round" strokeLinejoin="round">
          <path d={elvStier.join('')} stroke={vannElv.midt} strokeWidth={2.6 * s} />
          <path d={elvStier.join('')} stroke={vannElv.glans} strokeWidth={0.9 * s} opacity={0.8} />
        </g>
      )}
      {dy > 0.5 && sideNa.length > 2 && <MoreneRygg punkter={sideNa} bredde={mb} seed={seed + 3} />}
      {dy > 0.5 && ekteE && m.uE !== null && (
        <path
          d={`M${r2(xU(m.uE))} ${r2(yR(m.flate(m.uE)))}l${r2(dx)} ${r2(-dy)}`}
          stroke={VIZ.ink}
          strokeWidth={1.7 * s}
          strokeDasharray="6 4"
          strokeLinecap="round"
        />
      )}

      {/* ---------- Sideflaten ---------- */}
      <Sideflate x={w} felt={sideFelt} dx={dx} dy={dy} bunn={h} id={`${uid}-side`} />

      {/* ---------- Snittet foran ---------- */}
      <LagFlate points={[...bergTopp, [w, h], [0, h]]} type={berggrunn} monstre={monstre.id} lys={false} />
      {tillBiter.map((q, i) => (
        <LagFlate key={`t${i}`} points={q} type="morene" monstre={monstre.id} lys={false} />
      ))}
      {sandurBiter.map((q, i) => (
        <LagFlate key={`s${i}`} points={q} type="breelv" monstre={monstre.id} lys={false} />
      ))}
      {sjoPoly.length > 2 && (
        <g>
          <LinearGradient
            id={`${uid}-sjo`}
            stops={[
              [0, vannSjo.lys],
              [0.55, vannSjo.midt],
              [1, vannSjo.dyp],
            ]}
          />
          <path d={sti(sjoPoly, true)} fill={`url(#${uid}-sjo)`} />
          <line x1={r2(sjoPoly[0]![0])} x2={r2(sjoPoly[1]![0])} y1={r2(sjoPoly[0]![1])} y2={r2(sjoPoly[0]![1])} stroke={vannSjo.glans} strokeWidth={1.4 * s} />
        </g>
      )}
      {isPoly.length > 4 && (
        <g>
          <LinearGradient
            id={`${uid}-is`}
            userSpace
            x1={0}
            y1={isMinY}
            x2={0}
            y2={isMaxY}
            stops={[
              [0, isF.topp],
              [0.5, isF.midt],
              [1, isF.bunn],
            ]}
          />
          <path d={sti(isPoly, true)} fill={`url(#${uid}-is)`} />
          <path d={isBaand.join('')} fill="none" stroke={GEO.bre.line} strokeWidth={0.8 * s} opacity={0.4} />
          <path d={debris} fill={GEO.bergart.morene.line} opacity={0.55} />
          {firnPoly.length > 4 && (
            <g>
              <path d={sti(firnPoly, true)} fill={GEO.firn.fill} />
              <path d={firnLag.join('')} fill="none" stroke={GEO.firn.line} strokeWidth={0.7 * s} opacity={0.6} />
              <path d={sti(firnUs.map((u): SnittPunkt => [xU(u), yR(m.flate(u) - m.firn(u))]))} fill="none" stroke={GEO.firn.line} strokeWidth={0.9 * s} />
            </g>
          )}
          <path d={sprekkHakk + randkloft} fill={shade(GEO.bre.fill, 0.55)} stroke={shade(GEO.bre.fill, 0.65)} strokeWidth={0.5 * s} strokeLinejoin="round" />
          <path d={sti(isPoly, true)} fill="none" stroke={GEO.bre.line} strokeWidth={1.2 * s} strokeLinejoin="round" />
        </g>
      )}
      <SnittLys d={frontSti} id={`${uid}-lys`} />
      {stromLinjer.length > 0 && <Stromlinjer linjer={stromLinjer} stil="linje" farge={VIZ.velocity} t={p.t} fart={18} />}

      {/* ---------- Kantene ---------- */}
      <g fill="none" stroke={SCENE.outline} strokeWidth={1.2 * s} strokeLinejoin="round" strokeLinecap="round">
        <path d={`M0 ${r2(t0)}L0 ${r2(h)}L${r2(w)} ${r2(h)}L${r2(w)} ${r2(tw)}`} />
        <path d={sti(toppLinje)} strokeWidth={0.9 * s} opacity={0.7} />
      </g>

      {/* ---------- Sonene ---------- */}
      {sone && m.uE !== null && (
        <g>
          {xe - xa > 10 && <Klammer x0={xa} x1={xe} y={sone.y} tekst={soneTekst('Akkumulasjonsområde', 'Akkumulasjon', xe - xa, f)} anker="end" min={-x + 4} />}
          {xf - xe > 10 && <Klammer x0={xe} x1={xf} y={sone.y - (akkTekstForBred ? 17 * 0.8 * f * 1.15 : 0)} tekst={soneTekst('Ablasjonsområde', 'Ablasjon', xf - xe, f)} anker="start" min={-x + 4} />}
          {ekteE && (
            <line x1={r2(xe)} x2={r2(xe)} y1={r2(sone.y + 6)} y2={r2(yR(m.flate(m.uE)) - 0.5 * dy)} stroke={VIZ.ink} strokeWidth={1.1 * s} strokeDasharray="3 4" opacity={0.7} />
          )}
        </g>
      )}
    </g>
  );
}

/** Mønstrene en dalbre trenger (berggrunnen, morene og breelvavsetning), som faste lister. */
const DALBRE_MONSTRE = new Map<MonsterId, readonly MonsterId[]>(
  MONSTER_IDS.map((id): [MonsterId, readonly MonsterId[]] => [id, id === 'morene' || id === 'breelv' ? ['morene', 'breelv'] : [id, 'morene', 'breelv']]),
);

type InnFlate = 'is' | 'hav' | 'morene' | 'land';

function InnlandsisTegning({ p, o, x, y }: { p: IsbreProps; o: InnlandsisOppsett; x: number; y: number }) {
  const s = useGeoStroke();
  const uid = useSvgId('innlandsis');
  const monstre = useLagMonstre('innlandsis');
  const { m, w, h, dx, dy, yZ, xU, moho } = o;
  const berggrunn: MonsterId = p.berggrunn ?? 'gneis';
  const skorpe: MonsterId = 'granitt';
  const uL = m.c - m.L;
  const uR = m.c + m.L;
  const ekstra = [uL - 1e-4, uL, uR, uR + 1e-4, ...(m.uK !== null ? [m.uK - 1e-4, m.uK] : [])];
  const us = provepunkter(0, 1, 300, ekstra);
  const harIs = (u: number) => m.H(u) > 0;
  const toppZ = (u: number) => (harIs(u) ? m.bunn(u) + m.H(u) : m.uK !== null && u >= m.uK ? m.hav : m.bunn(u));
  const topp = (lx: number) => yZ(toppZ(lx / w));
  const vf = vannFarger('klar');
  const isF = isFarger();
  const typeVed = (lx: number): InnFlate => {
    const u = lx / w;
    if (harIs(u)) return 'is';
    if (m.uK !== null && u >= m.uK) return 'hav';
    if (m.Hc > 0 && Math.min(Math.abs(u - uL), Math.abs(u - uR)) < 0.05) return 'morene';
    return 'land';
  };
  const lop = delILop(us.map(xU), topp, typeVed);
  const farge = (t: InnFlate, q: number): string => {
    if (t === 'is') return q < 0 ? mix(SCENE.snow, SCENE.snowShade, 0.22 * -q) : SCENE.snow;
    if (t === 'hav') return vf.flate;
    if (t === 'morene') return lysFarge(mix(GEO.bergart.morene.fill, SCENE.stone, 0.35), q);
    return lysFarge(mix(SCENE.grass, SCENE.soil, 0.25), q);
  };
  const pynt = (l: Lop<InnFlate>) => {
    if (l.type === 'is') {
      // Svake linjer langs isflaten (som høydekurver i snøen), så kuppelformen synes
      const d = [0.3, 0.62].map((q) => sti(l.p.map(([px, py]): SnittPunkt => [px + q * dx, py - q * dy]))).join('');
      return <path d={d} fill="none" stroke={SCENE.snowShade} strokeWidth={1 * s} opacity={0.7} />;
    }
    if (l.type !== 'hav') return null;
    const xa = l.p[0]![0];
    const xb = l.p[l.p.length - 1]![0];
    if (xb - xa < 20) return null;
    const yy = l.p[0]![1];
    return (
      <g stroke={vf.glans} strokeLinecap="round">
        {[0.32, 0.66].map((q, j) => (
          <line key={j} x1={r2(xa + q * dx + (xb - xa) * 0.15)} y1={r2(yy - q * dy)} x2={r2(xb + q * dx - (xb - xa) * 0.2)} y2={r2(yy - q * dy)} strokeWidth={1.2 * s} opacity={0.8 - 0.25 * j} />
        ))}
      </g>
    );
  };

  /* ---------- Snittet ---------- */
  const bunnLinje = us.map((u): SnittPunkt => [xU(u), yZ(m.bunn(u))]);
  const mohoLinje = us.map((u): SnittPunkt => [xU(u), moho(u)]);
  const isBiter: number[][] = [];
  let cur: number[] = [];
  for (const u of us) {
    if (harIs(u)) cur.push(u);
    else if (cur.length) {
      isBiter.push(cur);
      cur = [];
    }
  }
  if (cur.length) isBiter.push(cur);
  const isPolyer = isBiter
    .filter((b) => b.length > 1)
    .map((b) => [...b.map((u): SnittPunkt => [xU(u), yZ(m.bunn(u) + m.H(u))]), ...[...b].reverse().map((u): SnittPunkt => [xU(u), yZ(m.bunn(u))])]);
  const isMinY = Math.min(...us.map((u) => yZ(toppZ(u))));
  const isMaxY = Math.max(...us.map((u) => yZ(m.bunn(u))));
  const lagLinjer = isBiter.flatMap((b) =>
    [0.25, 0.5, 0.75].map((dl) => sti(b.filter((u) => m.H(u) * (yZ(0) - yZ(1)) > 6).map((u): SnittPunkt => [xU(u), yZ(m.bunn(u) + (1 - dl) * m.H(u))]))),
  );
  const havUs = m.uK !== null ? us.filter((u) => u >= m.uK!) : [];
  const havPoly: SnittPunkt[] =
    havUs.length > 1 ? [[xU(havUs[0]!), yZ(m.hav)], [w, yZ(m.hav)], ...[...havUs].reverse().map((u): SnittPunkt => [xU(u), yZ(m.bunn(u))])] : [];
  const toppLinje = us.map((u): SnittPunkt => [xU(u), yZ(toppZ(u))]);
  const frontSti = sti([...toppLinje, [w, h], [0, h]], true);

  /* ---------- Sideflaten ---------- */
  const sideFelt: SideFelt[] = [];
  const yb1 = yZ(m.bunn(1));
  if (harIs(1)) sideFelt.push({ y0: yZ(m.bunn(1) + m.H(1)), y1: yb1, fyll: isF.midt });
  else if (m.uK !== null) sideFelt.push({ y0: yZ(m.hav), y1: yb1, fyll: vf.dyp });
  if (m.isostasi) {
    sideFelt.push({ y0: yb1, y1: moho(1), fyll: monstre.fyll(skorpe).fill, kant: GEO.bergart[skorpe].line });
    sideFelt.push({ y0: moho(1), y1: h, fyll: GEO.mantel.fill, kant: GEO.mantel.line });
  } else sideFelt.push({ y0: yb1, y1: h, fyll: monstre.fyll(berggrunn).fill, kant: GEO.bergart[berggrunn].line });

  /* ---------- Strømlinjer ---------- */
  const stromLinjer: StromLinje[] = [];
  if (p.strom && m.Hc > 0) {
    for (const side of [-1, 1])
      for (const [d0, d1, dmax] of [
        [0.08, 0.9, 0.82],
        [0.36, 0.97, 0.45],
      ] as const) {
        const punkter = linspace(0, 1, 14)
          .map((t): [number, number] => {
            const u = m.c + side * lerp(d0, d1, t) * m.L;
            const dl = 0.07 + (dmax - 0.07) * Math.sin(Math.PI * t) ** 0.8;
            return [u, dl];
          })
          .filter(([u]) => u >= 0.005 && u <= 0.995 && harIs(u))
          .map(([u, dl]): SnittPunkt => [xU(u), yZ(m.bunn(u) + (1 - dl) * m.H(u))]);
        if (punkter.length > 3) stromLinjer.push({ punkter });
      }
  }
  const t0 = toppLinje[0]![1];
  const tw = toppLinje[toppLinje.length - 1]![1];
  return (
    <g transform={`translate(${r2(x)} ${r2(y)})`}>
      <LagMonstre id={monstre.id} bare={m.isostasi ? INNLAND_MONSTRE_ISOSTASI : DALBRE_MONSTRE.get(berggrunn)} />
      {p.skygge !== false && <ContactShadow cx={(w + dx) / 2} cy={h - dy / 2 + 3} rx={(w + dx) / 2 + 8} ry={Math.max(6, dy / 2 + 7)} opacity={0.7} />}
      {dy > 0.5 && <Toppflate lop={lop} dx={dx} dy={dy} farge={farge} pynt={pynt} />}
      <Sideflate x={w} felt={sideFelt} dx={dx} dy={dy} bunn={h} id={`${uid}-side`} />
      {m.isostasi ? (
        <g>
          <LinearGradient
            id={`${uid}-mantel`}
            userSpace
            x1={0}
            y1={Math.min(...mohoLinje.map((q) => q[1]))}
            x2={0}
            y2={h}
            stops={[
              [0, tint(GEO.mantel.fill, 0.08)],
              [1, shade(GEO.mantel.fill, 0.12)],
            ]}
          />
          <path d={sti([...mohoLinje, [w, h], [0, h]], true)} fill={`url(#${uid}-mantel)`} />
          <LagFlate points={[...bunnLinje, ...[...mohoLinje].reverse()]} type={skorpe} monstre={monstre.id} lys={false} utenKontur />
          <path d={sti(mohoLinje)} fill="none" stroke={GEO.mantel.line} strokeWidth={1.4 * s} />
        </g>
      ) : (
        <LagFlate points={[...bunnLinje, [w, h], [0, h]]} type={berggrunn} monstre={monstre.id} lys={false} />
      )}
      {havPoly.length > 2 && (
        <g>
          <LinearGradient
            id={`${uid}-hav`}
            stops={[
              [0, vf.midt],
              [0.6, vf.dyp],
              [1, shade(vf.dyp, 0.3)],
            ]}
          />
          <path d={sti(havPoly, true)} fill={`url(#${uid}-hav)`} />
          <line x1={r2(havPoly[0]![0])} x2={w} y1={r2(yZ(m.hav))} y2={r2(yZ(m.hav))} stroke={vf.glans} strokeWidth={1.4 * s} />
        </g>
      )}
      {isPolyer.length > 0 && (
        <g>
          <LinearGradient
            id={`${uid}-is`}
            userSpace
            x1={0}
            y1={isMinY}
            x2={0}
            y2={isMaxY}
            stops={[
              [0, isF.topp],
              [0.55, isF.midt],
              [1, isF.bunn],
            ]}
          />
          {isPolyer.map((q, i) => (
            <path key={i} d={sti(q, true)} fill={`url(#${uid}-is)`} />
          ))}
          <path d={lagLinjer.join('')} fill="none" stroke={GEO.bre.line} strokeWidth={0.8 * s} opacity={0.4} />
          {isPolyer.map((q, i) => (
            <path key={`k${i}`} d={sti(q, true)} fill="none" stroke={GEO.bre.line} strokeWidth={1.2 * s} strokeLinejoin="round" />
          ))}
        </g>
      )}
      <SnittLys d={frontSti} id={`${uid}-lys`} />
      {stromLinjer.length > 0 && <Stromlinjer linjer={stromLinjer} stil="linje" farge={VIZ.velocity} t={p.t} fart={18} />}
      <g fill="none" stroke={SCENE.outline} strokeWidth={1.2 * s} strokeLinejoin="round" strokeLinecap="round">
        <path d={`M0 ${r2(t0)}L0 ${r2(h)}L${r2(w)} ${r2(h)}L${r2(w)} ${r2(tw)}`} />
        <path d={sti(toppLinje)} strokeWidth={0.9 * s} opacity={0.7} />
      </g>
    </g>
  );
}

const INNLAND_MONSTRE_ISOSTASI: readonly MonsterId[] = ['granitt'];

function HavisTegning({ p, o, x, y }: { p: IsbreProps; o: HavisOppsett; x: number; y: number }) {
  const s = useGeoStroke();
  const kk = useGeoScale();
  const uid = useSvgId('havis');
  const { m, w, h, dx, dy, mPx, xU, fjell } = o;
  const vf = vannFarger('klar');
  const fb = (fl: Flak) => fl.t * mPx * FRIBORD;
  const under = (fl: Flak) => fl.t * mPx * (1 - FRIBORD);
  const snoT = (fl: Flak) => Math.max(1.2 * kk, fl.t * mPx * 0.05);
  const isFarge = GEO.havis.fill;
  const snoFarge = SCENE.snow;
  const dam = mix(SCENE.water, SCENE.waterLight, 0.55);
  // (u, q, løft) → figurens koordinater på toppflaten
  const P = (u: number, q: number, loft: number): SnittPunkt => [xU(u) + q * dx, -loft - q * dy];

  /** Omrisset av et flak ovenfra (u, q), med kantete hjørner. Den fremste raden har rett forkant (snittet). */
  const flakOmriss = (fl: Flak, rad: number): [number, number][] => {
    const ja = fl.j[0] * 0.012;
    const jb = fl.j[1] * 0.012;
    const qa = rad === 0 ? 0 : fl.q0 + 0.03 + Math.abs(fl.j[2]) * 0.03;
    const qb = fl.q1 - 0.03 - Math.abs(fl.j[3]) * 0.03;
    const kutt = Math.min(0.012, (fl.b - fl.a) * 0.2);
    return [
      [fl.a + (rad === 0 ? 0 : kutt) + ja, qa],
      [fl.b - (rad === 0 ? 0 : kutt) + jb, qa],
      [fl.b + jb * 0.5, qa + (qb - qa) * 0.35],
      [fl.b - kutt + jb, qb],
      [fl.a + kutt + ja * 0.5, qb],
      [fl.a + ja, qa + (qb - qa) * 0.6],
    ];
  };

  const radTegning = (rad: number) =>
    (m.rader[rad] ?? []).map((fl, i) => {
      const om = flakOmriss(fl, rad);
      const loft = fb(fl);
      const toppP = om.map(([u, q]) => P(u, q, loft));
      // Sideflatene som synes: forkanten (mot oss) og venstre kant
      const forkant = rad === 0 ? null : [P(om[0]![0], om[0]![1], loft), P(om[1]![0], om[1]![1], loft), P(om[1]![0], om[1]![1], 0), P(om[0]![0], om[0]![1], 0)];
      const venstre = [P(om[5]![0], om[5]![1], loft), P(om[0]![0], om[0]![1], loft), P(om[0]![0], om[0]![1], 0), P(om[5]![0], om[5]![1], 0)];
      const rnd = sceneRandom(rad * 100 + i + fin(p.seed, 1));
      const dammer =
        p.smeltedammer && fl.b - fl.a > 0.05
          ? [0, 1].map(() => {
              const u = lerp(fl.a, fl.b, 0.2 + 0.6 * rnd());
              const q = lerp(fl.q0 + (rad === 0 ? 0.08 : 0.1), fl.q1 - 0.1, rnd());
              const [cx, cy] = P(u, q, loft);
              return { cx, cy, rx: (4 + 6 * rnd()) * kk, ry: (1.6 + 1.6 * rnd()) * kk };
            })
          : [];
      const rygg = fl.rygg
        ? (() => {
            const hs = fl.t * mPx * 0.32;
            const qs = linspace(rad === 0 ? 0 : fl.q0 + 0.05, fl.q1 - 0.05, 8);
            const ryggTopp = qs.map((q, j): SnittPunkt => P(fl.rygg!.u + (j % 2 ? 0.003 : -0.003), q, loft + hs * (0.75 + 0.25 * Math.sin(j * 2.3 + i))));
            const fot1 = [...qs].reverse().map((q): SnittPunkt => P(fl.rygg!.u + fl.rygg!.bredde / 2, q, loft));
            const fot0 = qs.map((q): SnittPunkt => P(fl.rygg!.u - fl.rygg!.bredde / 2, q, loft));
            return { lys: [...fot0, ...[...ryggTopp].reverse()], skygge: [...ryggTopp, ...fot1] };
          })()
        : null;
      return (
        <g key={`${rad}-${i}`}>
          {forkant && <path d={sti(forkant, true)} fill={shade(isFarge, 0.12)} stroke={GEO.havis.line} strokeWidth={0.6 * s} strokeLinejoin="round" />}
          <path d={sti(venstre, true)} fill={tint(isFarge, 0.1)} stroke={GEO.havis.line} strokeWidth={0.6 * s} strokeLinejoin="round" />
          <path d={sti(toppP, true)} fill={snoFarge} stroke={GEO.havis.line} strokeWidth={0.8 * s} strokeLinejoin="round" />
          {dammer.map((d, j) => (
            <ellipse key={j} cx={r2(d.cx)} cy={r2(d.cy)} rx={r2(d.rx)} ry={r2(d.ry)} fill={dam} stroke={GEO.havis.line} strokeWidth={0.5 * s} />
          ))}
          {rygg && (
            <g strokeLinejoin="round">
              <path d={sti(rygg.lys, true)} fill={snoFarge} stroke={GEO.havis.line} strokeWidth={0.6 * s} />
              <path d={sti(rygg.skygge, true)} fill={mix(snoFarge, SCENE.snowShade, 0.6)} stroke={GEO.havis.line} strokeWidth={0.6 * s} />
            </g>
          )}
        </g>
      );
    });

  /* ---------- Flakene i snitt (den fremste raden) ---------- */
  const flakSnitt = (m.rader[0] ?? []).map((fl, i) => {
    const xa = xU(fl.a);
    const xb = xU(fl.b);
    const top = -fb(fl);
    const bunn = under(fl);
    const rr = Math.min(2.5, (bunn - top) * 0.25, (xb - xa) * 0.2);
    const kropp = `M${r2(xa)} ${r2(top + rr)}Q${r2(xa)} ${r2(top)} ${r2(xa + rr)} ${r2(top)}H${r2(xb - rr)}Q${r2(xb)} ${r2(top)} ${r2(xb)} ${r2(top + rr)}V${r2(bunn - rr)}Q${r2(xb)} ${r2(bunn)} ${r2(xb - rr * 1.5)} ${r2(bunn)}H${r2(xa + rr * 1.5)}Q${r2(xa)} ${r2(bunn)} ${r2(xa)} ${r2(bunn - rr)}Z`;
    let seil = '';
    let kjol = '';
    let blokker = '';
    if (fl.rygg) {
      const xr = xU(fl.rygg.u);
      const bs = (fl.rygg.bredde * w) / 2;
      const hs = fl.t * mPx * 0.35;
      const hk = fl.t * mPx * 1.6;
      const bk = Math.max(2.4 * bs, 1.3 * hk);
      seil = `M${r2(xr - bs)} ${r2(top + 0.5)}L${r2(xr - bs * 0.55)} ${r2(top - hs * 0.55)}L${r2(xr - bs * 0.2)} ${r2(top - hs * 0.8)}L${r2(xr + bs * 0.1)} ${r2(top - hs)}L${r2(xr + bs * 0.45)} ${r2(top - hs * 0.6)}L${r2(xr + bs)} ${r2(top + 0.5)}Z`;
      const kp: SnittPunkt[] = [
        [xr - bk, bunn - 0.5],
        [xr - bk * 0.82, bunn + hk * 0.28],
        [xr - bk * 0.62, bunn + hk * 0.42],
        [xr - bk * 0.45, bunn + hk * 0.7],
        [xr - bk * 0.18, bunn + hk * 0.86],
        [xr + bk * 0.05, bunn + hk],
        [xr + bk * 0.3, bunn + hk * 0.8],
        [xr + bk * 0.52, bunn + hk * 0.62],
        [xr + bk * 0.7, bunn + hk * 0.36],
        [xr + bk * 0.9, bunn + hk * 0.2],
        [xr + bk, bunn - 0.5],
      ];
      kjol = sti(kp, true);
      // Isblokker i kjølen (skrugarden er brukne flak som er skjøvet ned): små skrå firkanter, klippet til kjølen
      const rb = sceneRandom(i * 13 + fin(p.seed, 1) * 7 + 3);
      const nb = Math.max(4, Math.min(12, Math.round(bk / 8)));
      for (let j = 0; j < nb; j++) {
        const bx = xr + (rb() - 0.5) * 1.5 * bk;
        const by = bunn + (0.06 + 0.7 * rb()) * hk;
        const bl = (0.2 + 0.18 * rb()) * hk;
        const bh = bl * (0.4 + 0.3 * rb());
        const v = (rb() - 0.5) * 1.4;
        const c = Math.cos(v);
        const sn = Math.sin(v);
        const hj = [
          [-bl / 2, -bh / 2],
          [bl / 2, -bh / 2],
          [bl / 2, bh / 2],
          [-bl / 2, bh / 2],
        ].map(([a, b]): SnittPunkt => [bx + a! * c - b! * sn, by + a! * sn + b! * c]);
        blokker += sti(hj, true);
      }
    }
    return { i, xa, xb, top, bunn, kropp, seil, kjol, blokker, sno: snoT(fl) };
  });
  // Lysstriper ned i vannet under råkene
  const raaker: [number, number][] = [];
  const rad0 = m.rader[0] ?? [];
  for (let i = 0; i <= rad0.length; i++) {
    const a = i === 0 ? 0 : rad0[i - 1]!.b;
    const b = i === rad0.length ? 1 : rad0[i]!.a;
    if (b - a > 0.01) raaker.push([a, b]);
  }
  const lysStriper = raaker.map(([a, b]) => {
    const xa = xU(a);
    const xb = xU(b);
    const lengde = h * 0.75;
    return `M${r2(xa)} 0L${r2(xb)} 0L${r2(xb + lengde * 0.25)} ${r2(lengde)}L${r2(xa + lengde * 0.25)} ${r2(lengde)}Z`;
  });

  /* ---------- Isfjellet ---------- */
  const fjellTegning = fjell
    ? (() => {
        const { x: xi, bredde: bw, hoyde: hh, kjol } = fjell;
        const over: SnittPunkt[] = [
          [xi - bw / 2, 0],
          [xi - bw * 0.46, -hh * 0.5],
          [xi - bw * 0.32, -hh * 0.62],
          [xi - bw * 0.22, -hh * 0.98],
          [xi - bw * 0.02, -hh],
          [xi + bw * 0.12, -hh * 0.78],
          [xi + bw * 0.3, -hh * 0.72],
          [xi + bw * 0.44, -hh * 0.4],
          [xi + bw / 2, 0],
        ];
        const underP: SnittPunkt[] = [
          [xi - bw * 0.5, -0.5],
          [xi - bw * 0.72, kjol * 0.1],
          [xi - bw * 0.95, kjol * 0.3],
          [xi - bw * 0.88, kjol * 0.52],
          [xi - bw * 0.62, kjol * 0.66],
          [xi - bw * 0.5, kjol * 0.86],
          [xi - bw * 0.12, kjol],
          [xi + bw * 0.3, kjol * 0.9],
          [xi + bw * 0.62, kjol * 0.72],
          [xi + bw * 0.98, kjol * 0.46],
          [xi + bw * 0.9, kjol * 0.2],
          [xi + bw * 0.62, kjol * 0.06],
          [xi + bw * 0.5, -0.5],
        ];
        // Skyggesiden: fra toppen ned mot høyre fot (lyset kommer fra venstre)
        const skygge: SnittPunkt[] = [over[4]!, over[5]!, over[6]!, over[7]!, over[8]!, [xi + bw * 0.18, 0]];
        return { over, underP, skygge };
      })()
    : null;

  const sideFelt: SideFelt[] = [];
  const sisteFlak = rad0[rad0.length - 1];
  if (sisteFlak && sisteFlak.b >= 0.999) sideFelt.push({ y0: -fb(sisteFlak), y1: under(sisteFlak), fyll: isFarge, kant: GEO.havis.line });
  sideFelt.push({ y0: sisteFlak && sisteFlak.b >= 0.999 ? under(sisteFlak) : 0, y1: h, fyll: vf.dyp });
  const forsteFlak = rad0[0];
  const t0 = forsteFlak && forsteFlak.a <= 0.001 ? -fb(forsteFlak) : 0;
  return (
    <g transform={`translate(${r2(x)} ${r2(y)})`}>
      {/* ---------- Havflaten og flakene ovenfra ---------- */}
      {dy > 0.5 && (
        <g>
          <path d={sti([[0, 0], [w, 0], [w + dx, -dy], [dx, -dy]], true)} fill={vf.flate} />
          <g stroke={vf.glans} strokeLinecap="round" opacity={0.8}>
            {[0.25, 0.55, 0.82].map((q, j) => (
              <line key={j} x1={r2(w * (0.08 + 0.1 * j) + q * dx)} x2={r2(w * (0.55 + 0.12 * j) + q * dx)} y1={r2(-q * dy)} y2={r2(-q * dy)} strokeWidth={1.1 * s} />
            ))}
          </g>
          {radTegning(2)}
          {radTegning(1)}
          {radTegning(0)}
          <path d={`M${r2(w)} 0l${r2(dx)} ${r2(-dy)}M0 0l${r2(dx)} ${r2(-dy)}H${r2(w + dx)}`} fill="none" stroke={SCENE.outline} strokeWidth={1.1 * s} opacity={0.7} />
        </g>
      )}
      <Sideflate x={w} felt={sideFelt} dx={dx} dy={dy} bunn={h} id={`${uid}-side`} />

      {/* ---------- Sjøvannet i snitt ---------- */}
      <LinearGradient
        id={`${uid}-vann`}
        stops={[
          [0, vf.lys],
          [0.35, vf.midt],
          [1, shade(vf.dyp, 0.3)],
        ]}
      />
      <LinearGradient
        id={`${uid}-lysstripe`}
        stops={[
          [0, SCENE.highlight, 0.35],
          [1, SCENE.highlight, 0],
        ]}
      />
      <LinearGradient
        id={`${uid}-flak`}
        stops={[
          // Fribordet (ca. 10 %) er lyst; under vannlinja ser vi isen gjennom vannet
          [0, tint(isFarge, 0.2)],
          [FRIBORD, isFarge],
          [FRIBORD + 0.03, mix(isFarge, SCENE.water, 0.26)],
          [1, mix(isFarge, SCENE.water, 0.48)],
        ]}
      />
      <LinearGradient
        id={`${uid}-kjol`}
        stops={[
          [0, mix(isFarge, SCENE.water, 0.3)],
          [1, mix(isFarge, SCENE.waterDeep, 0.55)],
        ]}
      />
      <rect x={0} y={0} width={r2(w)} height={r2(h)} fill={`url(#${uid}-vann)`} />
      <path d={lysStriper.join('')} fill={`url(#${uid}-lysstripe)`} />
      {fjellTegning && (
        <g strokeLinejoin="round">
          <LinearGradient
            id={`${uid}-fjell`}
            stops={[
              [0, mix(GEO.bre.fill, SCENE.water, 0.15)],
              [1, mix(GEO.bre.fill, SCENE.waterDeep, 0.45)],
            ]}
          />
          <path d={glattSti(fjellTegning.underP, true)} fill={`url(#${uid}-fjell)`} stroke={GEO.bre.line} strokeWidth={1 * s} />
          <path d={glattSti(fjellTegning.underP, true)} fill={vf.midt} opacity={0.3} />
          <path d={sti(fjellTegning.over, true)} fill={tint(GEO.bre.fill, 0.18)} />
          <path d={sti(fjellTegning.skygge, true)} fill={mix(GEO.bre.fill, SCENE.water, 0.35)} />
          <path d={sti(fjellTegning.over, true)} fill="none" stroke={GEO.bre.line} strokeWidth={1.1 * s} />
          <path d={`M${r2(fjell!.x - fjell!.bredde * 0.3)} ${r2(-fjell!.hoyde * 0.3)}l${r2(fjell!.bredde * 0.15)} ${r2(-fjell!.hoyde * 0.25)}`} stroke={GEO.bre.line} strokeWidth={0.7 * s} opacity={0.6} fill="none" />
        </g>
      )}
      {flakSnitt.map((fl) => (
        <g key={fl.i} strokeLinejoin="round">
          {fl.kjol && (
            <g>
              <defs>
                <clipPath id={`${uid}-kjol-${fl.i}`}>
                  <path d={fl.kjol} />
                </clipPath>
              </defs>
              <path d={fl.kjol} fill={`url(#${uid}-kjol)`} />
              <path d={fl.blokker} clipPath={`url(#${uid}-kjol-${fl.i})`} fill={mix(isFarge, SCENE.water, 0.18)} stroke={GEO.havis.line} strokeWidth={0.5 * s} opacity={0.55} />
              <path d={fl.kjol} fill="none" stroke={GEO.havis.line} strokeWidth={0.8 * s} />
            </g>
          )}
          <path d={fl.kropp} fill={`url(#${uid}-flak)`} stroke={GEO.havis.line} strokeWidth={1 * s} />
          {fl.bunn - fl.top > 12 && (
            <path
              d={[0.42, 0.7].map((a) => `M${r2(fl.xa + 3)} ${r2(fl.top + a * (fl.bunn - fl.top))}H${r2(fl.xb - 3)}`).join('')}
              stroke={GEO.havis.line}
              strokeWidth={0.7 * s}
              strokeDasharray="10 6"
              opacity={0.35}
            />
          )}
          {fl.seil && <path d={fl.seil} fill={snoFarge} stroke={GEO.havis.line} strokeWidth={0.8 * s} />}
          <rect x={r2(fl.xa + 0.5)} y={r2(fl.top)} width={r2(Math.max(0, fl.xb - fl.xa - 1))} height={r2(fl.sno)} fill={snoFarge} />
          <line x1={r2(fl.xa)} x2={r2(fl.xb)} y1={0} y2={0} stroke={vf.glans} strokeWidth={0.8 * s} strokeDasharray="3 3" opacity={0.7} />
        </g>
      ))}
      {raaker.map(([a, b], i) => (
        <line key={i} x1={r2(xU(a))} x2={r2(xU(b))} y1={0} y2={0} stroke={vf.glans} strokeWidth={1.4 * s} />
      ))}
      <SnittLys d={`M0 0H${r2(w)}V${r2(h)}H0Z`} id={`${uid}-lys`} />
      <path d={`M0 ${r2(t0)}V${r2(h)}H${r2(w)}V0`} fill="none" stroke={SCENE.outline} strokeWidth={1.2 * s} strokeLinejoin="round" />
    </g>
  );
}

/** Etikettene til en Isbre (navnene i kolonnen til høyre). */
function isbreEtiketter(p: IsbreProps, g: IsbreGeometri): SnittEtikett[] {
  const a = g.ankere;
  const ut: SnittEtikett[] = [];
  const legg = (navn: IsbreAnkerNavn, tekst: string, undertekst?: string) => {
    const q = a[navn];
    if (q) ut.push({ x: q.x, y: q.y, tekst, undertekst });
  };
  if (g.type === 'dalbre') {
    legg('firn', 'Firn og snø');
    legg('likevektslinje', 'Likevektslinje');
    legg('sprekker', 'Bresprekker');
    legg('breis', 'Breis');
    if (p.sidemorene !== false) legg('sidemorene', 'Sidemorene');
    legg('bunnmorene', 'Bunnmorene');
    legg('bresjo', 'Bresjø');
    legg('endemorene', 'Endemorene');
    legg('breelv', 'Breelvavsetning');
  } else if (g.type === 'innlandsis') {
    legg('innlandsis', 'Innlandsis');
    if (a.jordskorpe) legg('jordskorpe', 'Jordskorpa');
    else legg('berggrunn', 'Berggrunn');
    legg('mantel', 'Mantelen', 'ikke i målestokk');
    legg('hav', 'Havet');
  } else {
    legg('sno', 'Snø på isen');
    legg('skrugard', 'Skrugard');
    legg('havis', 'Havis', 'omtrent 90 % under vann');
    legg('raak', 'Råk');
    legg('isfjell', 'Isfjell', 'breis fra land');
    legg('sjovann', 'Sjøvann');
  }
  return ut;
}

/**
 * Is i landskapet som blokkdiagram i Snittblokk-stil: en dalbre i lengdesnitt (firn, sprekker, likevektslinje, front,
 * morener og bresjø), en innlandsis (med valgfri isostasi) eller havis (flak og isfjell). Ankerpunkt: (x, y) er øverste
 * venstre hjørne av snittet foran; blokka stikker dx til høyre og dy opp (fjellsiden bak en dalbre enda høyere), og
 * `isbreGeometri(props, f).ramme` gir hele rammen til viewBox. Havis: y er havflaten.
 *
 *   - 'dalbre': lengdesnitt fra botnen til fronten med fjellsiden bak. Over likevektslinja (prop, m o.h.) ligger snø og
 *     firn, under den bar is; bresprekker der breen er bratt og nær fronten, randkløft øverst, sidemorene langs breen og
 *     høyere oppe der breen var størst, endemorener, bresjø og breelv med sandur. Fronten er en prop (`likevektsFront`
 *     gir fronten i likevekt), og `strom` viser at isen beveger seg ned i akkumulasjonsområdet og opp i
 *     ablasjonsområdet. `soner` gir klammer for de to områdene.
 *   - 'innlandsis': isdekke (tykkelse som prop) over et land med fjell og kyst. Med `isostasi` vises jordskorpa og
 *     mantelen (ikke i målestokk), og skorpa er trykt ned, også etter at isen er borte (`nedsynking`).
 *   - 'havis': flak på havet med omtrent 90 % under vann, snø, skrugarder (med kjøl av brukne flak), råker og valgfrie
 *     smeltedammer, og et isfjell (breis) til sammenligning. Isfjellet er ikke i samme målestokk som flakene. h er hvor
 *     dypt havet i snittet går; flakene står øverst og blir ikke tykkere enn 0,02 · w per meter, så på mobil trengs bare
 *     litt mer høyde til etikettene (f.eks. 170 + 110 · (f − 1)), ikke geoHoyde.
 * Etikettene står i en kolonne fra x + w + dx + 18. Barna får geometrien (ankerpunkter til piler og etiketter).
 *   <Isbre x={20} y={110} w={600} h={250} likevektslinje={ela} front={likevektsFront(ela) ?? 0} soner etiketter />
 *   <Isbre type="innlandsis" x={20} y={60} w={600} h={300} tykkelse={tykk} isostasi nedsynking={ned} />
 *   <Isbre type="havis" x={20} y={80} w={560} h={180} dekning={0.6} isfjell />
 */
export function Isbre(props: IsbreProps) {
  const f = useTextScale();
  const o = isbreOppsett(props, f);
  if (!o) return null;
  const g = byggIsbreGeometri(props, o);
  const x = fin(props.x);
  const y = fin(props.y);
  const etiketter = props.etiketter ? isbreEtiketter(props, g) : [];
  return (
    <g opacity={props.dim ? 0.4 : undefined}>
      {o.type === 'dalbre' ? (
        <DalbreTegning p={props} o={o} x={x} y={y} />
      ) : o.type === 'innlandsis' ? (
        <InnlandsisTegning p={props} o={o} x={x} y={y} />
      ) : (
        <HavisTegning p={props} o={o} x={x} y={y} />
      )}
      {etiketter.length > 0 && (
        <Etikettkolonne x={x + o.w + o.dx + 18} topp={g.ramme.y + 6} bunn={y + o.h} etiketter={etiketter} orden={o.type === 'dalbre' ? 'x' : 'y'} />
      )}
      {props.children?.(g)}
    </g>
  );
}

/* =====================================================================================================================
 * Elveleie: typer og rene hjelpere for tverrsnittet
 * ================================================================================================================== */

/** Hvordan elva vises: 'lengde' (lengdeprofil fra fjell til delta), 'tverr' (tverrsnitt) eller 'ovenfra' (kart). */
export type ElveleieVisning = 'lengde' | 'tverr' | 'ovenfra';

/** Navnene på visningene til knapper. */
export const ELVELEIE_NAVN: Readonly<Record<ElveleieVisning, string>> = {
  lengde: 'Lengdeprofil',
  tverr: 'Tverrsnitt',
  ovenfra: 'Ovenfra',
};

/** Et tverrsnittsprofil: punkter [avstand over elva i m, høyde i m o.h.] fra venstre bredd mot høyre. */
export type Tverrprofil = readonly (readonly [number, number])[];

/**
 * Standardprofilet i `Elveleie visning="tverr"`: 130 m bredt, med flomslette til venstre (en lav voll ved løpet),
 * elveløpet med det dypeste punktet nær 62 m og en terrasse til høyre. Høyder i m over det dypeste punktet.
 */
export const TVERRPROFIL_STANDARD: Tverrprofil = [
  [0, 6.4],
  [10, 6.0],
  [22, 4.9],
  [34, 4.6],
  [40, 4.9],
  [44, 3.6],
  [48, 1.6],
  [55, 0.45],
  [62, 0],
  [70, 0.55],
  [76, 2.1],
  [80, 3.7],
  [86, 4.05],
  [100, 3.85],
  [112, 4.2],
  [118, 6.0],
  [124, 7.3],
  [130, 7.5],
];

/** En flomlinje i tverrsnittet: vannstanden ved en flom med et navn («200-årsflom») og eventuelt en egen farge. */
export interface Flomlinje {
  /** Vannstanden i m o.h. (samme høyder som profilet). */
  niva: number;
  navn?: string;
  farge?: string;
}

/** Et målepunkt (målevertikal) i tverrsnittet: hvor (m fra venstre), og målt fart i m/s. */
export interface Malepunkt {
  x: number;
  /** Middelfarten i vertikalen (m/s). Vises som ⊗ (strømmen går inn i bildet) med verdien over vannflaten. */
  fart?: number;
  navn?: string;
}

/** En forbygning (flomvoll av stein) på bredden: midten av kronen (m), høyden over terrenget og bredden på kronen (m). */
export interface Forbygning {
  x: number;
  hoyde: number;
  /** Bredden på kronen i m (standard 2). Sidene heller 1 : 1,5. */
  bredde?: number;
}

function profilPunkter(profil: Tverrprofil | undefined): [number, number][] {
  const p = (profil ?? TVERRPROFIL_STANDARD)
    .filter((q) => Number.isFinite(q[0]) && Number.isFinite(q[1]))
    .map((q): [number, number] => [q[0], q[1]])
    .sort((a, b) => a[0] - b[0]);
  return p.length >= 2 ? p : TVERRPROFIL_STANDARD.map((q): [number, number] => [q[0], q[1]]);
}

/** Høyden i profilet ved x (lineært mellom punktene, endeverdiene utenfor). */
function profilZ(p: readonly (readonly [number, number])[], x: number): number {
  return interp(
    p.map((q) => q[0]),
    p.map((q) => q[1]),
    x,
  );
}

/** Profilet med forbygningene lagt oppå (kronen flat, sidene 1 : 1,5). */
function medForbygning(p: readonly (readonly [number, number])[], forbygning: readonly Forbygning[] | undefined): [number, number][] {
  const liste = (forbygning ?? []).filter((f) => Number.isFinite(f.x) && Number.isFinite(f.hoyde) && f.hoyde > 0);
  if (liste.length === 0) return p.map((q): [number, number] => [q[0], q[1]]);
  const xs = new Set<number>(p.map((q) => q[0]));
  for (const f of liste) {
    const b = Math.max(0.2, fin(f.bredde, 2));
    const fot = b / 2 + 1.5 * f.hoyde;
    for (const v of [f.x - fot, f.x - b / 2, f.x + b / 2, f.x + fot]) xs.add(v);
  }
  const x0 = p[0]![0];
  const x1 = p[p.length - 1]![0];
  return [...xs]
    .filter((v) => v >= x0 && v <= x1)
    .sort((a, b) => a - b)
    .map((x): [number, number] => {
      let z = profilZ(p, x);
      for (const f of liste) {
        const b = Math.max(0.2, fin(f.bredde, 2));
        const topp = profilZ(p, f.x) + f.hoyde;
        const d = Math.abs(x - f.x);
        const vz = d <= b / 2 ? topp : topp - (d - b / 2) / 1.5;
        z = Math.max(z, vz);
      }
      return [x, z];
    });
}

/**
 * Den våte delen av et tverrsnitt ved en vannstand: fra det dypeste punktet og ut til begge sider så langt terrenget
 * ligger under vannstanden (et lavt område bak en voll som ikke henger sammen med elva, blir ikke regnet med). Gir
 * [venstre, høyre] i m, eller null når vannstanden er under det dypeste punktet eller tallene er ugyldige.
 */
function vaatOmrade(p: readonly (readonly [number, number])[], niva: number): [number, number] | null {
  if (!Number.isFinite(niva) || p.length < 2) return null;
  let iMin = 0;
  for (let i = 1; i < p.length; i++) if (p[i]![1] < p[iMin]![1]) iMin = i;
  if (!(p[iMin]![1] < niva)) return null;
  const kryss = (a: readonly [number, number], b: readonly [number, number]) => a[0] + ((niva - a[1]) * (b[0] - a[0])) / (b[1] - a[1] || 1e-9);
  let venstre = p[0]![0];
  for (let i = iMin; i > 0; i--) {
    if (p[i - 1]![1] >= niva) {
      venstre = kryss(p[i]!, p[i - 1]!);
      break;
    }
  }
  let hoyre = p[p.length - 1]![0];
  for (let i = iMin; i < p.length - 1; i++) {
    if (p[i + 1]![1] >= niva) {
      hoyre = kryss(p[i]!, p[i + 1]!);
      break;
    }
  }
  return [venstre, hoyre];
}

/** ∫ (nivå − z) dx fra a til b, der profilet ligger under nivået (eksakt for et stykkevis lineært profil). */
function dybdeIntegral(p: readonly (readonly [number, number])[], niva: number, a: number, b: number): number {
  if (!(b > a)) return 0;
  const xs = [a, ...p.map((q) => q[0]).filter((x) => x > a && x < b), b];
  let sum = 0;
  for (let i = 0; i < xs.length - 1; i++) {
    const x0 = xs[i]!;
    const x1 = xs[i + 1]!;
    const d0 = niva - profilZ(p, x0);
    const d1 = niva - profilZ(p, x1);
    if (d0 >= 0 && d1 >= 0) sum += ((d0 + d1) / 2) * (x1 - x0);
    else if (d0 > 0 || d1 > 0) {
      const t = d0 / (d0 - d1);
      sum += d0 > 0 ? (d0 / 2) * t * (x1 - x0) : (d1 / 2) * (1 - t) * (x1 - x0);
    }
  }
  return sum;
}

/**
 * Tverrsnittsarealet av vannet (m²) i et elveprofil ved en vannstand (m o.h.): bare den delen som henger sammen med det
 * dypeste punktet. Null når vannstanden ligger under bunnen eller tallene er ugyldige.
 *   tverrsnittAreal(TVERRPROFIL_STANDARD, 3) // m²
 */
export function tverrsnittAreal(profil: Tverrprofil, niva: number): number | null {
  const p = profilPunkter(profil);
  const o = vaatOmrade(p, niva);
  return o ? dybdeIntegral(p, niva, o[0], o[1]) : null;
}

/** Bredden på vannflaten (m) i et elveprofil ved en vannstand. Null når vannstanden ligger under bunnen. */
export function tverrsnittBredde(profil: Tverrprofil, niva: number): number | null {
  const o = vaatOmrade(profilPunkter(profil), niva);
  return o ? o[1] - o[0] : null;
}

/** Én del (panel) i midtseksjonsmetoden: fra–til (m), dybden i vertikalen, arealet og vannføringen gjennom delen. */
export interface TverrsnittDel {
  /** Vertikalens plass (m) og navn. */
  x: number;
  navn?: string;
  fra: number;
  til: number;
  /** Vanndybden i vertikalen (m). */
  dybde: number;
  /** Arealet av delen (m²). */
  areal: number;
  /** Farten (m/s), eller null når den ikke er målt. */
  fart: number | null;
  /** Vannføringen gjennom delen, fart · areal (m³/s), eller null uten fart. */
  vannforing: number | null;
}

/**
 * Deler tverrsnittet i paneler rundt målevertikalene (midtseksjonsmetoden): hver vertikal står for vannet fra midt mellom
 * forrige vertikal til midt mellom neste, og de ytterste panelene går ut til breddene. Vannføringen er summen av
 * fart · areal. Vertikaler utenfor vannet hoppes over. Gir null når vannstanden er under bunnen eller ingen vertikal står
 * i vannet; `vannforing` er null når en av vertikalene mangler fart.
 *   const q = tverrsnittPaneler(profil, 3.2, [{ x: 52, fart: 0.6 }, { x: 62, fart: 1.1 }, { x: 70, fart: 0.7 }]);
 */
export function tverrsnittPaneler(
  profil: Tverrprofil,
  niva: number,
  malepunkter: readonly Malepunkt[],
): { deler: TverrsnittDel[]; areal: number; vannforing: number | null } | null {
  const p = profilPunkter(profil);
  const o = vaatOmrade(p, niva);
  if (!o) return null;
  const vert = malepunkter.filter((m) => Number.isFinite(m.x) && m.x > o[0] && m.x < o[1]).sort((a, b) => a.x - b.x);
  if (vert.length === 0) return null;
  const deler: TverrsnittDel[] = vert.map((m, i) => {
    const fra = i === 0 ? o[0] : (vert[i - 1]!.x + m.x) / 2;
    const til = i === vert.length - 1 ? o[1] : (m.x + vert[i + 1]!.x) / 2;
    const areal = dybdeIntegral(p, niva, fra, til);
    const fart = m.fart !== undefined && Number.isFinite(m.fart) ? m.fart : null;
    return { x: m.x, navn: m.navn, fra, til, dybde: Math.max(0, niva - profilZ(p, m.x)), areal, fart, vannforing: fart === null ? null : fart * areal };
  });
  const areal = deler.reduce((s, d) => s + d.areal, 0);
  const vannforing = deler.every((d) => d.vannforing !== null) ? deler.reduce((s, d) => s + (d.vannforing ?? 0), 0) : null;
  return { deler, areal, vannforing };
}

/* =====================================================================================================================
 * Elveleie: props og geometri
 * ================================================================================================================== */

/** Navn på ankerpunktene i `ElveleieGeometri.ankere` (ikke alle finnes i alle visningene). */
export type ElveleieAnkerNavn =
  | 'stein'
  | 'grus'
  | 'sand'
  | 'elveavsetning'
  | 'delta'
  | 'leire'
  | 'berggrunn'
  | 'hav'
  | 'munning'
  | 'magasin'
  | 'demning'
  | 'elvelop'
  | 'flomslette'
  | 'terrasse'
  | 'vannflate'
  | 'forbygning'
  | 'yttersving'
  | 'innersving'
  | 'kroksjo';

/** Props til `Elveleie`. Propsene for én visning virker ikke på de andre (se hver prop). */
export interface ElveleieProps {
  /** 'lengde' (standard), 'tverr' eller 'ovenfra'. */
  visning?: ElveleieVisning;
  /**
   * Lengde og tverr: øverste venstre hjørne av snittet foran (som i Snittblokk); blokka stikker dx til høyre og dy opp.
   * Ovenfra: øverste venstre hjørne av kartet.
   */
  x?: number;
  y?: number;
  w: number;
  h: number;
  /** Dybden på blokka (perspektivet; 0 gir et flatt snitt). Standard ca. 0,09 · w (høyst 70). */
  dybde?: number;
  vinkel?: number;
  /** Klart vann (standard), grumsete (mye slam) eller slamstrøm. */
  klarhet?: VannKlarhet;
  /** Tid i sekunder: vannet og strømlinjene beveger seg. */
  t?: number;
  seed?: number;
  /** Navn i en kolonne til høyre (fra x + w + dx + 18). */
  etiketter?: boolean;
  /** Lengde og tverr: myk skygge under blokka (standard på). */
  skygge?: boolean;
  dim?: boolean;
  /** Tegnes oppå i figurens koordinater, med geometrien. */
  children?: (g: ElveleieGeometri) => ReactNode;

  /* ---------- Lengde ---------- */
  /** Lengde: vannføringen 0–1 (standard 0,5), som gjør vannet dypere. */
  vannforing?: number;
  /** Lengde: steiner, grus og sand på bunnen, grovest øverst (standard på). */
  korn?: boolean;
  /** Lengde: hvor elva munner ut i havet, som andel 0–1 (standard 0,76). Deltaet bygger seg ut foran munningen. */
  munning?: number;
  /** Lengde: klammer over elva, 'prosess' (erosjon, transport, avsetning; standard når `true`) eller 'lop' (øvre, midtre og nedre løp). */
  soner?: boolean | 'prosess' | 'lop';
  /** Lengde: en demning ved andelen `u` med høyden `hoyde` (figurens enheter, standard 0,14 · h). Magasinet fanger slammet. */
  demning?: { u: number; hoyde?: number };
  /** Lengde: dalsiden bak elva (standard på). */
  fjellvegg?: boolean;
  /** Lengde: berggrunnen (standard 'gneis'). */
  berggrunn?: MonsterId;

  /* ---------- Tverr ---------- */
  /** Tverr: profilet [m fra venstre, m o.h.] (standard `TVERRPROFIL_STANDARD`). */
  profil?: Tverrprofil;
  /** Tverr: vannstanden i m o.h. (standard 3,2: elva går nesten bredfull). Over flomsletta blir det flom. */
  vannstand?: number;
  /** Tverr: stiplede flomlinjer med navn («200-årsflom»). */
  flomlinjer?: readonly Flomlinje[];
  /** Tverr: målevertikaler med fart (midtseksjonsmetoden, `tverrsnittPaneler`). */
  malepunkter?: readonly Malepunkt[];
  /** Tverr: panelene rundt målevertikalene skravert annenhver gang (standard på når det er målepunkter). */
  paneler?: boolean;
  /** Tverr: forbygninger (flomvoller av stein) på breddene. */
  forbygning?: readonly Forbygning[];
  /** Tverr: akser med høyde (m o.h.) og avstand (m). Trenger ca. 40 enheter til venstre og 40 under. */
  akser?: boolean;
  /** Tverr: overhøyde (hvor mye høydene er strukket). Standard: så profilet fyller høyden. */
  overhoyde?: number;

  /* ---------- Ovenfra ---------- */
  /** Ovenfra: 'meandre' (standard) eller 'rett' (kanalisert elv med forbygning). */
  form?: 'meandre' | 'rett';
  /** Ovenfra: hvor mye elva slynger seg, 0–1 (standard 0,7). */
  slyngning?: number;
  /** Ovenfra: antall svinger (bølgelengder) over kartet (standard 2). */
  svinger?: number;
  /** Ovenfra: en kroksjø (avsnørt meander) på flomsletta (standard av). */
  kroksjo?: boolean;
  /** Ovenfra: bredden på elveløpet i figurens enheter (standard 0,08 · h). */
  bredde?: number;
  /** Ovenfra og lengde: strømlinjer i vannet (VIZ.velocity). Ovenfra går strømmen nærmest yttersvingene. Standard av. */
  strom?: boolean;
  /** Ovenfra: merker for erosjon i yttersvingen og avsetning i innersvingen (standard av). */
  prosesser?: boolean;
}

/** Geometrien til et `Elveleie` i figurens koordinater (fra `elveleieGeometri`). */
export interface ElveleieGeometri {
  visning: ElveleieVisning;
  x: number;
  y: number;
  w: number;
  h: number;
  dx: number;
  dy: number;
  /** Rammen rundt alt som tegnes (blokka, dalsiden, sonene og aksene), uten etikettkolonnen. */
  ramme: { x: number; y: number; w: number; h: number };
  /** Lengde: x for en andel 0–1 langs elva. Tverr: x for en avstand i m. Ovenfra: x for en andel av kartbredden. */
  xFor: (v: number) => number;
  /** Tverr: y for en høyde i m o.h. Lengde: havflaten for alle verdier. Ovenfra: y for en andel av karthøyden. */
  yFor: (v: number) => number;
  /** Lengde og tverr: bunnen (elvebunnen, terrenget eller havbunnen) ved x i figuren. */
  bunn: (x: number) => number;
  /** Lengde og tverr: vannflaten ved x, eller null der det ikke er vann. */
  vannflate: (x: number) => number | null;
  /** Lengde: havflaten (y). Tverr: vannstanden (y). */
  havniva: number;
  /** Ovenfra: midtlinja i elva fra venstre mot høyre (figurens koordinater). Ellers tom. */
  midtlinje: SnittPunkt[];
  /** Tverr: overhøyden (hvor mye høydene er strukket i forhold til avstandene). Ellers 1. */
  overhoyde: number;
  ankere: Partial<Record<ElveleieAnkerNavn, { x: number; y: number }>>;
}

/* =====================================================================================================================
 * Elveleie: oppsettet (lokale koordinater)
 * ================================================================================================================== */

interface LengdeOppsett extends Felles {
  visning: 'lengde';
  uM: number;
  uL: number;
  uT: number;
  ySea: number;
  /** Vanndybden (lokale enheter) ved u. */
  dyb: Fn;
  /** Bunnen (elvebunn, kanal på deltaet eller havbunn) ved u. */
  yB: Fn;
  /** Vannflaten ved u (elva, magasinet eller havet). */
  yW: Fn;
  /** Vannflaten uten magasinet (dalsiden følger denne, så den ikke får et trinn ved demningen). */
  yW0: Fn;
  /** Høyden på bredden over vannflaten ved u. */
  bh: Fn;
  /** Toppen av berggrunnen ved u (under elveavsetningene og deltaet). */
  berg: Fn;
  /** Deltaet og bunnlaget under havet: avsetningene går fra havbunnen ned til denne. */
  magasin: { uA: number; ud: number; yL: number; hd: number; fotY: number; sed: Fn } | null;
  /** Dalsiden: høyden over bredden ved u (0 der det ikke er dalside). */
  vegg: Fn;
  veggTopp: number;
  soner: { y: number; type: 'prosess' | 'lop' } | null;
  rammeTopp: number;
}

interface TverrOppsett extends Felles {
  visning: 'tverr';
  /** Profilet med forbygningene (m). */
  p: [number, number][];
  /** Profilet uten forbygningene. */
  p0: [number, number][];
  xM: Fn;
  yH: Fn;
  mFraX: Fn;
  hFraY: Fn;
  niva: number;
  omrade: [number, number] | null;
  overhoyde: number;
  /** Målevertikalene med tekst og rad (tekstene står i rader over vannflaten). */
  maal: { i: number; xx: number; ytop: number; ybunn: number; ym: number; tekst: string; b: number; rad: number }[];
  rammeTopp: number;
  rammeBunn: number;
  rammeVenstre: number;
}

interface OvenfraOppsett extends Felles {
  visning: 'ovenfra';
  midt: SnittPunkt[];
  /** Normalen (enhetsvektor mot venstre bredd sett i strømretningen) i hvert punkt. */
  normal: SnittPunkt[];
  /** Krumningen (fortegn: positiv = svinger mot venstre). */
  kurv: number[];
  kMaks: number;
  bc: number;
  /** Toppene i svingene: indeks og hvilken side som er innersving (+1 = venstre). */
  svinger: { i: number; inn: 1 | -1 }[];
  kroksjo: { cx: number; cy: number; rx: number; ry: number; vend: 1 | -1 } | null;
  amplitude: number;
  /** Svingen der erosjon og avsetning merkes: den med mest plass utenfor yttersvingen, nær midten av kartet. */
  merke: { i: number; inn: 1 | -1 } | null;
}

type ElveleieOppsett = LengdeOppsett | TverrOppsett | OvenfraOppsett;

function lengdeOppsett(p: ElveleieProps, w: number, h: number, dx: number, dy: number, k: number, f: number): LengdeOppsett {
  const hs = h / 280;
  const uM = clamp(fin(p.munning, 0.76), 0.3, 0.95);
  const uL = Math.min(0.995, uM + 0.06);
  const uT = Math.min(1, uL + 0.08);
  const yTop = 0.1 * h;
  const ySea = 0.6 * h;
  const vf = clamp01(fin(p.vannforing, 0.5));
  const dyb: Fn = (u) => (3 + 11 * clamp01(u / uM) ** 0.8) * hs * (0.55 + 0.9 * vf) * Math.sqrt(k);
  const dM = dyb(uM);
  const yElv: Fn = (u) => yTop + (ySea + dM - yTop) * (1 - (1 - clamp01(u / uM)) ** 1.9);
  const havbunn: Fn = (u) => ySea + 0.65 * dM + (0.2 * h - 0.65 * dM) * smooth(uL, uT, u) + 0.05 * h * smooth(uT, 1, u);
  const yB0: Fn = (u) => (u <= uM ? yElv(u) : u <= uL ? ySea + dM * (1 - 0.35 * smooth(uM, uL, u)) : havbunn(u));
  // Magasinet bak en demning: vannflaten litt under kronen, oppover dalen til bunnen når den
  let magasin: LengdeOppsett['magasin'] = null;
  if (p.demning && Number.isFinite(p.demning.u)) {
    const ud = clamp(p.demning.u, 0.08, uM - 0.04);
    const hd = Math.max(8, fin(p.demning.hoyde, 0.14 * h));
    const fotY = yElv(ud);
    const yL = fotY - hd + 3 * hs;
    let a = 0;
    let b = ud;
    if (yElv(0) < yL) {
      for (let i = 0; i < 40; i++) {
        const m = (a + b) / 2;
        if (yElv(m) < yL) a = m;
        else b = m;
      }
      const uA = (a + b) / 2;
      const L = ud - uA;
      const sed: Fn = (u) => {
        if (u < uA || u > ud) return yElv(u);
        const dyp = yElv(u) - yL;
        const inn = yL + 2 * hs + dyp * 0.9 * smooth(uA + 0.25 * L, uA + 0.5 * L, u);
        const gulv = yElv(u) - 0.14 * dyp;
        return Math.max(yL + 1.5 * hs, Math.min(inn, gulv));
      };
      magasin = { uA, ud, yL, hd, fotY, sed };
    }
  }
  const yB: Fn = (u) => yB0(u);
  const yW0: Fn = (u) => (u <= uM ? yElv(u) - dyb(u) : ySea);
  const yW: Fn = (u) => (magasin && u >= magasin.uA && u <= magasin.ud ? magasin.yL : yW0(u));
  const bh: Fn = (u) => (u <= uM ? (6 + 10 * (1 - u / uM)) * hs : 2 * hs * (1 - smooth(uL - 0.01, uL, u)));
  const alluvium: Fn = (u) => 0.09 * h * smooth(0.28, uM, u);
  const gammel: Fn = (u) => ySea + dM + 0.09 * h + 0.2 * h * smooth(uM, 1, u);
  const berg: Fn = (u) => (u <= uM ? yElv(u) + alluvium(u) : Math.max(gammel(u), yB0(u) + 0.01 * h));
  const fjellvegg = p.fjellvegg !== false;
  const vegg: Fn = (u) => {
    if (!fjellvegg || u > uL) return 0;
    let topper = 0;
    for (const [c, hh, b] of [
      [0.05, 0.06, 0.05],
      [0.15, 0.045, 0.06],
      [0.27, 0.04, 0.07],
      [0.41, 0.028, 0.07],
    ] as const)
      topper = Math.max(topper, hh * Math.max(0, 1 - Math.abs(u - c) / b) ** 1.15);
    const base = 0.15 * (1 - clamp01(u / uM)) ** 1.3 + 0.03 + topper * (1 - smooth(0.4, 0.6, u));
    return h * base * (1 - smooth(uM, uL, u)) * smooth(0, 0.02, u);
  };
  let veggTopp = Infinity;
  for (const u of linspace(0, 1, 160)) veggTopp = Math.min(veggTopp, yW0(u) - bh(u) - dy - vegg(u));
  const fs = 17 * 0.8 * f;
  const sType: 'prosess' | 'lop' | null = p.soner === 'lop' ? 'lop' : p.soner ? 'prosess' : null;
  const soner = sType ? { y: veggTopp - 12, type: sType } : null;
  return { visning: 'lengde', w, h, dx, dy, k, f, uM, uL, uT, ySea, dyb, yB, yW, yW0, bh, berg, magasin, vegg, veggTopp, soner, rammeTopp: soner ? soner.y - 5 - fs - 2 : veggTopp - 2 };
}

function tverrOppsett(p: ElveleieProps, w: number, h: number, dx: number, dy: number, k: number, f: number): TverrOppsett {
  const p0 = profilPunkter(p.profil);
  const pp = medForbygning(p0, p.forbygning);
  const x0 = pp[0]![0];
  const x1 = pp[pp.length - 1]![0];
  const zs = pp.map((q) => q[1]);
  const zMin = Math.min(...zs);
  const niva = fin(p.vannstand, zMin + 0.42 * (Math.max(...zs) - zMin));
  const nivaer = [niva, ...(p.flomlinjer ?? []).map((l) => l.niva).filter(Number.isFinite)];
  const zMax = Math.max(...zs, ...nivaer);
  const R = Math.max(0.1, zMax - zMin);
  const kx = w / Math.max(1e-6, x1 - x0);
  const auto = (0.6 * h) / R;
  const ky = p.overhoyde !== undefined && Number.isFinite(p.overhoyde) && p.overhoyde > 0 ? Math.min(kx * p.overhoyde, (0.74 * h) / R) : auto;
  const yTopp = 0.16 * h;
  const xM = (m: number) => (m - x0) * kx;
  const yH = (z: number) => yTopp + (zMax - z) * ky;
  const fs = 17 * 0.8 * f;
  const omrade = vaatOmrade(pp, niva);
  const maal = (p.malepunkter ?? [])
    .filter((m) => Number.isFinite(m.x) && !!omrade && m.x > omrade[0] && m.x < omrade[1])
    .sort((a, b) => a.x - b.x)
    .map((m, i, alle) => {
      const xx = xM(m.x);
      const ytop = yH(niva);
      const ybunn = yH(profilZ(pp, m.x));
      const fart = m.fart !== undefined && Number.isFinite(m.fart) ? fmt(m.fart, 2) : null;
      // Enheten bare på den siste verdien, så tallene får plass
      const tekst = [m.navn, fart ? `${fart}${i === alle.length - 1 ? ' m/s' : ''}` : null].filter(Boolean).join(': ');
      return { i, xx, ytop, ybunn, ym: ytop + 0.6 * (ybunn - ytop), tekst, b: tekstBredde(tekst, 0.72, f), rad: 0 };
    });
  // Tekstene i rader over vannflaten, så de ikke overlapper
  const rader: [number, number][][] = [];
  for (const m of maal) {
    if (!m.tekst) continue;
    const a = m.xx - m.b / 2 - 3;
    const b = m.xx + m.b / 2 + 3;
    let r = 0;
    while (rader[r]?.some(([p0, p1]) => a < p1 && b > p0)) r++;
    (rader[r] ??= []).push([a, b]);
    m.rad = r;
  }
  const maalTopp = maal.length ? Math.min(...maal.map((m) => m.ytop - 6 - m.rad * fs * 1.1 - fs)) : Infinity;
  return {
    visning: 'tverr',
    w,
    h,
    dx,
    dy,
    k,
    f,
    p: pp,
    p0,
    xM,
    yH,
    mFraX: (X) => x0 + X / kx,
    hFraY: (Y) => zMax - (Y - yTopp) / ky,
    niva,
    omrade,
    overhoyde: ky / kx,
    maal,
    rammeTopp: Math.min(-dy, yH(zMax) - fs * 1.3, maalTopp) - 2,
    rammeBunn: h + (p.akser ? 14 + 2 * fs : 6),
    rammeVenstre: p.akser ? -(12 + tekstBredde('10 m', 0.8, f) + fs * 1.2) : 0,
  };
}

function ovenfraOppsett(p: ElveleieProps, w: number, h: number, k: number, f: number): OvenfraOppsett {
  const rett = p.form === 'rett';
  const bc = Math.max(4, fin(p.bredde, 0.08 * h * Math.min(1.3, k ** 0.3)));
  const theta = rett ? 0.07 : clamp01(fin(p.slyngning, 0.7)) * 1.7;
  const N = 420;
  const lag = (n: number) => {
    const pts: [number, number][] = [[0, 0]];
    let xx = 0;
    let yy = 0;
    for (let i = 1; i <= N; i++) {
      const s = (i - 0.5) / N;
      const th = theta * Math.sin(2 * Math.PI * n * s + (rett ? 0.6 : 0));
      xx += Math.cos(th) / N;
      yy += Math.sin(th) / N;
      pts.push([xx, yy]);
    }
    const spenn = pts[N]![0] - pts[0]![0] || 1;
    const skala = (w * 1.1) / spenn;
    const midtY = pts.reduce((sum, q) => sum + q[1], 0) / pts.length;
    return pts.map(([a, b]): SnittPunkt => [-0.05 * w + a * skala, h / 2 + (b - midtY) * skala]);
  };
  let n = Math.max(0.5, fin(p.svinger, 2));
  let midt = lag(n);
  const plass = 0.5 * h - bc - 0.07 * h;
  for (let i = 0; i < 24; i++) {
    const A = Math.max(...midt.map((q) => Math.abs(q[1] - h / 2)));
    if (A <= plass || rett) break;
    n += 0.25;
    midt = lag(n);
  }
  const normal: SnittPunkt[] = midt.map((_, i) => {
    const a = midt[Math.max(0, i - 1)]!;
    const b = midt[Math.min(midt.length - 1, i + 1)]!;
    const tx = b[0] - a[0];
    const ty = b[1] - a[1];
    const l = Math.hypot(tx, ty) || 1;
    return [ty / l, -tx / l];
  });
  const vinkel = midt.map((_, i) => {
    const a = midt[Math.max(0, i - 1)]!;
    const b = midt[Math.min(midt.length - 1, i + 1)]!;
    return Math.atan2(b[1] - a[1], b[0] - a[0]);
  });
  const kurvRaa = vinkel.map((_, i) => {
    const a = vinkel[Math.max(0, i - 1)]!;
    const b = vinkel[Math.min(vinkel.length - 1, i + 1)]!;
    let d = b - a;
    while (d > Math.PI) d -= 2 * Math.PI;
    while (d < -Math.PI) d += 2 * Math.PI;
    return -d;
  });
  const kurv = glattVerdier(kurvRaa, 6);
  const kMaks = Math.max(1e-6, ...kurv.map(Math.abs));
  const svinger: OvenfraOppsett['svinger'] = [];
  if (!rett)
    for (let i = 2; i < kurv.length - 2; i++) {
      const a = Math.abs(kurv[i]!);
      if (a > 0.5 * kMaks && a >= Math.abs(kurv[i - 1]!) && a >= Math.abs(kurv[i + 1]!)) {
        const mx = midt[i]![0];
        if (mx > 0.04 * w && mx < 0.96 * w) svinger.push({ i, inn: kurv[i]! > 0 ? 1 : -1 });
      }
    }
  const A = Math.max(...midt.map((q) => Math.abs(q[1] - h / 2)));
  let kroksjo: OvenfraOppsett['kroksjo'] = null;
  if (p.kroksjo) {
    // Den største ledige plassen på flomsletta (lengst fra elva og kanten)
    let best: { x: number; y: number; d: number; ny: number } | null = null;
    for (let gx = 0.12; gx <= 0.88; gx += 0.025)
      for (let gy = 0.1; gy <= 0.9; gy += 0.025) {
        const px = gx * w;
        const py = gy * h;
        let d = Infinity;
        let ny = 0;
        for (let j = 0; j < midt.length; j += 3) {
          const dd = Math.hypot(midt[j]![0] - px, (midt[j]![1] - py) * 1.6);
          if (dd < d) {
            d = dd;
            ny = midt[j]![1];
          }
        }
        const plassen = Math.min(d - bc, 1.5 * Math.min(px, w - px), 1.6 * Math.min(py, h - py));
        if (!best || plassen > best.d) best = { x: px, y: py, d: plassen, ny };
      }
    if (best && best.d > 0.06 * w) {
      const rx = Math.min(0.09 * w, 0.62 * best.d);
      const ry = Math.min(0.58 * rx, 0.36 * best.d);
      kroksjo = { cx: best.x, cy: best.y, rx, ry, vend: best.ny > best.y ? 1 : -1 };
    }
  }
  const fs = 17 * 0.78 * f;
  const plassUte = (sv: { i: number; inn: 1 | -1 }) => (normal[sv.i]![1] * -sv.inn < 0 ? midt[sv.i]![1] : h - midt[sv.i]![1]);
  const poeng = (sv: { i: number; inn: 1 | -1 }) => Math.min(plassUte(sv), bc + 30 * k + 2 * fs) - 0.15 * Math.abs(midt[sv.i]![0] - w / 2);
  const merke = svinger.length ? svinger.reduce((a, b) => (poeng(b) > poeng(a) ? b : a)) : null;
  return { visning: 'ovenfra', w, h, dx: 0, dy: 0, k, f, midt, normal, kurv, kMaks, bc, svinger, kroksjo, amplitude: A, merke };
}

function elveleieOppsett(p: ElveleieProps, f: number): ElveleieOppsett | null {
  const w = fin(p.w);
  const h = fin(p.h);
  if (!(w > 10) || !(h > 10)) return null;
  const ff = Number.isFinite(f) && f > 0 ? f : 1;
  const k = geoK(ff);
  const visning: ElveleieVisning = p.visning === 'tverr' || p.visning === 'ovenfra' ? p.visning : 'lengde';
  if (visning === 'ovenfra') return ovenfraOppsett(p, w, h, k, ff);
  const { dx, dy } = snittblokkPerspektiv(p.dybde ?? Math.min(70, 0.09 * w), p.vinkel);
  return visning === 'tverr' ? tverrOppsett(p, w, h, dx, dy, k, ff) : lengdeOppsett(p, w, h, dx, dy, k, ff);
}

/**
 * Geometrien til et `Elveleie` i figurens koordinater: rammen rundt alt som tegnes (til viewBox), x for en andel langs
 * elva (lengde), en avstand i m (tverr) eller en andel av kartet (ovenfra), bunnen og vannflaten ved x, overhøyden i
 * tverrsnittet, midtlinja ovenfra og ankerpunkter til etiketter og piler. `f` er tekstskaleringen; barna i `<Elveleie>`
 * får den samme geometrien. Gir null for ugyldige mål.
 */
export function elveleieGeometri(p: ElveleieProps, f = 1): ElveleieGeometri | null {
  const o = elveleieOppsett(p, f);
  return o ? byggElveleieGeometri(p, o) : null;
}

function byggElveleieGeometri(p: ElveleieProps, o: ElveleieOppsett): ElveleieGeometri {
  const x = fin(p.x);
  const y = fin(p.y);
  const { w, h, dx, dy } = o;
  const pt = (lx: number, ly: number) => ({ x: x + lx, y: y + ly });
  if (o.visning === 'lengde') {
    const uFra = (X: number) => clamp01((fin(X) - x) / w);
    const ankere: ElveleieGeometri['ankere'] = {};
    const paBunn = (u: number) => pt(u * w, o.yB(u) - 2);
    ankere.stein = paBunn(0.12 * o.uM);
    ankere.grus = paBunn(0.42 * o.uM);
    ankere.sand = paBunn(0.85 * o.uM);
    const ua = 0.7 * o.uM;
    ankere.elveavsetning = pt(ua * w, (o.yB(ua) + o.berg(ua)) / 2);
    ankere.delta = pt(((o.uL + o.uT) / 2) * w, (o.yB((o.uL + o.uT) / 2) + o.berg((o.uL + o.uT) / 2)) / 2 - 2);
    const ul = (o.uT + 1) / 2;
    ankere.leire = pt(ul * w, (o.yB(ul) + o.berg(ul)) / 2);
    ankere.berggrunn = pt(0.35 * w, (o.berg(0.35) + h) / 2);
    ankere.hav = pt(((o.uL + 1) / 2) * w, (o.ySea + o.yB((o.uL + 1) / 2)) / 2 + 6);
    ankere.munning = pt(o.uM * w, o.ySea);
    if (o.magasin) {
      const um = (o.magasin.uA + o.magasin.ud) / 2;
      ankere.magasin = pt(um * w, o.magasin.yL + 5);
      ankere.demning = pt(o.magasin.ud * w + 4, o.magasin.fotY - o.magasin.hd * 0.5);
    }
    return {
      visning: 'lengde',
      x,
      y,
      w,
      h,
      dx,
      dy,
      ramme: { x, y: y + o.rammeTopp, w: w + dx, h: h - o.rammeTopp + 6 },
      xFor: (u) => x + fin(u) * w,
      yFor: () => y + o.ySea,
      bunn: (X) => y + o.yB(uFra(X)),
      vannflate: (X) => y + o.yW(uFra(X)),
      havniva: y + o.ySea,
      midtlinje: [],
      overhoyde: 1,
      ankere,
    };
  }
  if (o.visning === 'tverr') {
    const ankere: ElveleieGeometri['ankere'] = {};
    const pp = o.p;
    let iMin = 0;
    for (let i = 1; i < pp.length; i++) if (pp[i]![1] < pp[iMin]![1]) iMin = i;
    const xBunn = pp[iMin]![0];
    ankere.elvelop = pt(o.xM(xBunn), (o.yH(o.niva) + o.yH(pp[iMin]![1])) / 2);
    ankere.vannflate = pt(o.xM(o.omrade ? (o.omrade[0] + o.omrade[1]) / 2 + (o.omrade[1] - o.omrade[0]) * 0.2 : xBunn), o.yH(o.niva));
    // Flomsletta: det laveste flate stykket utenfor løpet (det bredeste stykket mellom løpet og kanten)
    const x0 = pp[0]![0];
    const x1 = pp[pp.length - 1]![0];
    const venstre = o.omrade ? (x0 + o.omrade[0]) / 2 : x0 + 0.2 * (x1 - x0);
    const hoyre = o.omrade ? (o.omrade[1] + x1) / 2 : x0 + 0.8 * (x1 - x0);
    const vSide = o.omrade && o.omrade[0] - x0 > x1 - o.omrade[1] ? venstre : hoyre;
    ankere.flomslette = pt(o.xM(vSide), o.yH(profilZ(pp, vSide)) + 3);
    ankere.terrasse = pt(o.xM(x1 - 0.03 * (x1 - x0)), o.yH(profilZ(pp, x1 - 0.03 * (x1 - x0))) + 3);
    ankere.grus = pt(o.xM(xBunn), (o.yH(pp[iMin]![1]) + h) / 2);
    const fb = (p.forbygning ?? []).find((q) => Number.isFinite(q.x) && q.hoyde > 0);
    if (fb) ankere.forbygning = pt(o.xM(fb.x), o.yH(profilZ(pp, fb.x)) + 4);
    return {
      visning: 'tverr',
      x,
      y,
      w,
      h,
      dx,
      dy,
      ramme: { x: x + o.rammeVenstre, y: y + o.rammeTopp, w: w + dx - o.rammeVenstre, h: o.rammeBunn - o.rammeTopp },
      xFor: (m) => x + o.xM(fin(m)),
      yFor: (z) => y + o.yH(fin(z)),
      bunn: (X) => y + o.yH(profilZ(pp, o.mFraX(fin(X) - x))),
      vannflate: (X) => {
        const m = o.mFraX(fin(X) - x);
        return o.omrade && m >= o.omrade[0] && m <= o.omrade[1] ? y + o.yH(o.niva) : null;
      },
      havniva: y + o.yH(o.niva),
      midtlinje: [],
      overhoyde: o.overhoyde,
      ankere,
    };
  }
  const ankere: ElveleieGeometri['ankere'] = {};
  const midtI = o.merke;
  if (midtI) {
    const [mx, my] = o.midt[midtI.i]!;
    const [nx, ny] = o.normal[midtI.i]!;
    const ut = -midtI.inn;
    ankere.yttersving = pt(mx + nx * ut * (o.bc / 2 + 2), my + ny * ut * (o.bc / 2 + 2));
    ankere.innersving = pt(mx - nx * ut * (o.bc * 0.45), my - ny * ut * (o.bc * 0.45));
  }
  const im = Math.round(o.midt.length * 0.3);
  const [ex, ey] = o.midt[im]!;
  ankere.elvelop = pt(ex, ey);
  if (o.kroksjo) ankere.kroksjo = pt(o.kroksjo.cx + 0.95 * o.kroksjo.rx, o.kroksjo.cy);
  ankere.flomslette = pt(0.18 * w, o.amplitude + o.bc + 0.06 * h < 0.4 * h ? h / 2 + o.amplitude + o.bc + 0.06 * h : 0.92 * h);
  return {
    visning: 'ovenfra',
    x,
    y,
    w,
    h,
    dx: 0,
    dy: 0,
    ramme: { x, y, w, h },
    xFor: (u) => x + fin(u) * w,
    yFor: (v) => y + fin(v) * h,
    bunn: () => y + h,
    vannflate: () => null,
    havniva: y + h / 2,
    midtlinje: o.midt.map(([a, b]): SnittPunkt => [x + a, y + b]),
    overhoyde: 1,
    ankere,
  };
}

/* =====================================================================================================================
 * Elveleie: tegningen
 * ================================================================================================================== */

/**
 * Dalsiden bak en blokk (lengdeprofil): fjell med lys fra venstre (skyggesider fra hver topp), snø over `snoY` og et
 * smalt belte med skog nederst. `rygg` og `bunn` har samme x-er. Barna tegnes klippet til dalsiden.
 */
function Dalside({
  rygg,
  bunn,
  snoY,
  skog,
  uid,
  children,
}: {
  rygg: readonly SnittPunkt[];
  bunn: readonly SnittPunkt[];
  snoY: number | null;
  /** Skogbeltet ved punkt i: [topp, bunn] eller null. */
  skog: (i: number) => [number, number] | null;
  uid: string;
  children?: ReactNode;
}) {
  const s = useGeoStroke();
  const kk = useGeoScale();
  if (rygg.length < 3) return null;
  const poly = [...rygg, ...[...bunn].reverse()];
  const topp = Math.min(...rygg.map((q) => q[1]));
  const maks = Math.max(...bunn.map((q) => q[1]));
  const ry = rygg.map((q) => q[1]);
  const topper: number[] = [];
  const daler: number[] = [];
  // Topper og skar med tydelig høydeforskjell (minst 4 enheter innen ±8 punkter), så små ujevnheter ikke gir striper
  const n8 = (j: number) => ry.slice(Math.max(0, j - 8), Math.min(ry.length, j + 9));
  for (let j = 1; j < ry.length - 1; j++) {
    const nabo = n8(j);
    if (ry[j]! <= Math.min(...nabo) && Math.max(...nabo) - ry[j]! > 4) topper.push(j);
    if (ry[j]! >= Math.max(...nabo) && ry[j]! - Math.min(...nabo) > 4) daler.push(j);
  }
  const fasetter = topper.map((jt) => {
    const jv = daler.find((j) => j > jt) ?? ry.length - 1;
    const [xp, yp] = rygg[jt]!;
    const [xv, yv] = rygg[jv]!;
    const bp = bunn[jt]![1];
    const bv = bunn[jv]![1];
    return sti([...rygg.slice(jt, jv + 1), [xv + 0.12 * (xv - xp), yv + 0.5 * (bv - yv)], [xp + 0.32 * (xv - xp), yp + 0.7 * (bp - yp)]], true);
  });
  const tunge = (xx: number) => 7 * kk * (Math.max(0, Math.sin(xx / 13 + 0.4)) ** 6 + 0.6 * Math.max(0, Math.sin(xx / 29 + 2.1)) ** 4);
  const snoPoly: SnittPunkt[] =
    snoY === null ? [] : [[rygg[0]![0], topp - 10], [rygg[rygg.length - 1]![0], topp - 10], ...[...rygg].reverse().map((q): SnittPunkt => [q[0], snoY + tunge(q[0])])];
  const skogBiter: string[] = [];
  let cur: { t: SnittPunkt[]; b: SnittPunkt[] } | null = null;
  const lukk = () => {
    if (cur && cur.t.length > 2) skogBiter.push(sti([...cur.t, ...[...cur.b].reverse()], true));
    cur = null;
  };
  for (let i = 0; i < bunn.length; i++) {
    const sk = skog(i);
    if (sk && sk[1] - sk[0] > 3) {
      cur ??= { t: [], b: [] };
      cur.t.push([bunn[i]![0], sk[0] + (i % 2 ? 1.6 : -2.6) * kk]);
      cur.b.push([bunn[i]![0], sk[1]]);
    } else lukk();
  }
  lukk();
  return (
    <g>
      <defs>
        <clipPath id={`${uid}-dalside`}>
          <path d={sti(poly, true)} />
        </clipPath>
      </defs>
      <LinearGradient
        id={`${uid}-dalfjell`}
        userSpace
        x1={0}
        y1={topp}
        x2={0}
        y2={maks}
        stops={[
          [0, mix(SCENE.stone, SCENE.skyBottom, 0.4)],
          [0.55, mix(SCENE.stone, SCENE.skyBottom, 0.18)],
          [1, mix(mix(SCENE.stone, SCENE.stoneDark, 0.35), SCENE.mountainShade, 0.3)],
        ]}
      />
      <LinearGradient
        id={`${uid}-dalskog`}
        stops={[
          [0, mix(SCENE.foliage, SCENE.skyBottom, 0.12)],
          [1, SCENE.foliageDark],
        ]}
      />
      <path d={sti(poly, true)} fill={`url(#${uid}-dalfjell)`} />
      <g clipPath={`url(#${uid}-dalside)`}>
        {snoPoly.length > 3 && <path d={sti(snoPoly, true)} fill={SCENE.snowcap} opacity={0.88} />}
        <path d={fasetter.join('')} fill={SCENE.mountainShade} opacity={0.32} />
        {skogBiter.length > 0 && <path d={skogBiter.join('')} fill={`url(#${uid}-dalskog)`} />}
        {children}
      </g>
      <path d={sti(rygg)} fill="none" stroke={SCENE.outline} strokeWidth={0.9 * s} strokeLinejoin="round" opacity={0.6} />
    </g>
  );
}

/** Klammene over et lengdeprofil: (fra, til, tekst, kort tekst, farge) i figurens enheter. */
function Soneklammer({ soner, y, min }: { soner: readonly { x0: number; x1: number; tekst: string; kort: string; farge?: string }[]; y: number; min: number }) {
  const s = useGeoStroke();
  const f = useTextScale();
  return (
    <g>
      {soner.map((z, i) => {
        if (!(z.x1 - z.x0 > 6)) return null;
        const tekst = soneTekst(z.tekst, z.kort, z.x1 - z.x0, f);
        const b = tekstBredde(tekst, 0.8, f);
        const passer = b <= z.x1 - z.x0 - 6;
        // Annenhver rad når teksten er bredere enn klammeren
        const rad = passer ? 0 : i % 2;
        const yy = y - rad * 17 * 0.8 * f * 1.15;
        const tx = clamp((z.x0 + z.x1) / 2, min + b / 2, Infinity);
        return (
          <g key={i}>
            <path d={`M${r2(z.x0 + 1)} ${r2(y + 6)}V${r2(y)}H${r2(z.x1 - 1)}V${r2(y + 6)}`} fill="none" stroke={z.farge ?? VIZ.ink} strokeWidth={1.4 * s} strokeLinejoin="round" />
            <Txt x={tx} y={yy - 5} size={0.8} weight={650} color={z.farge}>
              {tekst}
            </Txt>
          </g>
        );
      })}
    </g>
  );
}

/** Korn på en elvebunn: avrundede steiner med lys fra øvre venstre (to fargetoner for variasjon). */
function KornRad({ korn, uid }: { korn: readonly { x: number; y: number; rx: number; ry: number; tone: number }[]; uid: string }) {
  const s = useGeoStroke();
  if (korn.length === 0) return null;
  const toner = [SCENE.stone, mix(SCENE.stone, GEO.bergart.sandstein.fill, 0.45), mix(SCENE.stone, SCENE.stoneDark, 0.45)];
  return (
    <g>
      {toner.map((c, i) => (
        <RadialGradient key={i} id={`${uid}-korn${i}`} cx={0.38} cy={0.32} r={0.75} stops={[[0, tint(c, 0.35)], [0.55, c], [1, shade(c, 0.32)]]} />
      ))}
      {korn.map((q, i) => (
        <ellipse
          key={i}
          cx={r2(q.x)}
          cy={r2(q.y)}
          rx={r2(q.rx)}
          ry={r2(q.ry)}
          fill={`url(#${uid}-korn${q.tone % toner.length})`}
          stroke={q.rx > 2.2 ? SCENE.outline : 'none'}
          strokeWidth={0.55 * s}
        />
      ))}
    </g>
  );
}

type BankFlate = 'fjell' | 'skog' | 'gress' | 'delta';

function LengdeTegning({ p, o, x, y }: { p: ElveleieProps; o: LengdeOppsett; x: number; y: number }) {
  const s = useGeoStroke();
  const kk = useGeoScale();
  const uid = useSvgId('elv-lengde');
  const monstre = useLagMonstre('elv');
  const { w, h, dx, dy, uM, uL, uT, ySea, magasin: mag } = o;
  const klarhet = p.klarhet ?? 'klar';
  const vf = vannFarger(klarhet);
  const vfNed = mag && klarhet === 'grumsete' ? vannFarger('klar') : vf;
  const hav = vannFarger('klar');
  const berggrunn: MonsterId = p.berggrunn ?? 'gneis';
  const seed = fin(p.seed, 1);
  const xU = (u: number) => u * w;
  const iMag = (u: number) => !!mag && u >= mag.uA && u <= mag.ud;
  const ekstra = [uM, uL, uT, 0.55, ...(mag ? [mag.uA, mag.uA + 1e-4, mag.ud, mag.ud + 1e-4, mag.uA + 0.5 * (mag.ud - mag.uA)] : [])];
  const us = provepunkter(0, 1, 320, ekstra);
  const qR = 0.34;
  const bankY = (u: number) => o.yW(u) - (iMag(u) ? 0 : o.bh(u));
  const tt = fin(p.t);

  /* ---------- Dalsiden ---------- */
  const vu = provepunkter(0, uL, 160, mag ? [mag.uA, mag.ud] : []);
  const veggBunn = vu.map((u): SnittPunkt => [xU(u) + dx, bankY(u) - dy]);
  const veggRygg = vu.map((u, i): SnittPunkt => [
    xU(u) + dx,
    Math.min(veggBunn[i]![1] - 2, o.yW0(u) - o.bh(u) - dy - o.vegg(u) * (1 + 0.05 * Math.sin(u * 83 + seed) * Math.sin(u * 23 + 1))),
  ]);
  const snoY = Math.min(...veggRygg.map((q) => q[1])) + 0.07 * h;
  const skog = (i: number): [number, number] | null => {
    const u = vu[i]!;
    if (u < 0.12 || u > uM) return null;
    const b = veggBunn[i]![1];
    const t = Math.max(veggRygg[i]![1] + 4, b - 12 * kk);
    return [t, b];
  };

  /* ---------- Toppflaten ---------- */
  const bankType = (lx: number): BankFlate => {
    const u = lx / w;
    return u < 0.2 ? 'fjell' : u < 0.48 ? 'skog' : u <= uM ? 'gress' : 'delta';
  };
  const bankUs = us.filter((u) => u <= uL);
  const bankBiter: number[][] = [];
  {
    let cur: number[] = [];
    for (const u of bankUs) {
      if (!iMag(u)) cur.push(u);
      else if (cur.length) {
        bankBiter.push(cur);
        cur = [];
      }
    }
    if (cur.length) bankBiter.push(cur);
  }
  const bankLop = bankBiter.flatMap((b) => delILop(b.map(xU), (lx) => bankY(lx / w), bankType));
  const bankFarge = (t: BankFlate, q: number) =>
    t === 'fjell'
      ? lysFarge(mix(SCENE.stone, SCENE.stoneDark, 0.1), q)
      : t === 'skog'
        ? lysFarge(mix(SCENE.foliage, SCENE.grass, 0.35), q)
        : t === 'gress'
          ? lysFarge(SCENE.grass, q)
          : lysFarge(mix(SCENE.grass, GEO.bergart.sand.fill, 0.4), q);
  const bankFlater = bankLop.map((l) => ({ d: sti(lopPolygon(l.p, dx, dy, qR, 1), true), fyll: bankFarge(l.type, l.q) }));
  const bankKant = bankBiter.map((b) =>
    sti([...b.map((u): SnittPunkt => [xU(u) + qR * dx, o.yW(u) - qR * dy]), ...[...b].reverse().map((u): SnittPunkt => [xU(u) + qR * dx, bankY(u) - qR * dy])], true),
  );
  const vannBiter = bankBiter.map((b) => sti([...b.map((u): SnittPunkt => [xU(u), o.yW(u)]), ...[...b].reverse().map((u): SnittPunkt => [xU(u) + qR * dx, o.yW(u) - qR * dy])], true));
  const bakkant = bankBiter.map((b) => sti(b.map((u): SnittPunkt => [xU(u) + dx, bankY(u) - dy])));
  const magBand = mag
    ? sti(
        [
          ...us.filter((u) => u >= mag.uA && u <= mag.ud).map((u): SnittPunkt => [xU(u), mag.yL]),
          [xU(mag.ud) + dx, mag.yL - dy],
          [xU(mag.uA) + dx, mag.yL - dy],
        ],
        true,
      )
    : '';
  const havBand = sti([[xU(uL), ySea], [w, ySea], [w + dx, ySea - dy], [xU(uL) + dx, ySea - dy]], true);
  const slam = klarhet !== 'klar';
  const slamFarge = klarhet === 'slamstrom' ? mix(SCENE.soil, hav.flate, 0.15) : mix(SCENE.soil, hav.flate, 0.3);
  const plumeBand = slam
    ? glattSti(
        [
          [xU(uL) + 0.05 * dx, ySea - 0.05 * dy],
          [xU(uL + 0.06), ySea - 0.02 * dy],
          [xU(uL + 0.16), ySea - 0.08 * dy],
          [xU(uL + 0.2) + 0.5 * dx, ySea - 0.5 * dy],
          [xU(uL + 0.13) + 0.9 * dx, ySea - 0.9 * dy],
          [xU(uL + 0.04) + 0.62 * dx, ySea - 0.62 * dy],
          [xU(uL) + 0.45 * dx, ySea - 0.45 * dy],
        ],
        true,
      )
    : '';
  // Strømmen på vannflaten: lyse streker som renner nedover elva
  const stromBand = bankBiter.map((b) =>
    [0.16, 0.34].map((q) => sti(b.filter((u) => u <= uM).map((u): SnittPunkt => [xU(u) + q * dx, o.yW(u) - q * dy]))).join(''),
  );

  /* ---------- Snittet ---------- */
  const lagBit = (a: number, b: number, topp: Fn, bunn: Fn): SnittPunkt[] => {
    const ui = us.filter((u) => u >= a && u <= b);
    return [...ui.map((u): SnittPunkt => [xU(u), topp(u)]), ...[...ui].reverse().map((u): SnittPunkt => [xU(u), bunn(u)])];
  };
  const elvBunn = (u: number) => (mag && iMag(u) ? mag.sed(u) : o.yB(u));
  const grusBit = lagBit(0.28, 0.55, o.yB, o.berg);
  const sandBit = lagBit(0.55, uM, o.yB, o.berg);
  const deltaBit = lagBit(uM, uT, o.yB, o.berg);
  const leireBit = lagBit(uT, 1, o.yB, o.berg);
  const magSand = mag ? lagBit(mag.uA, mag.uA + 0.5 * (mag.ud - mag.uA), mag.sed, o.yB) : [];
  const magLeire = mag ? lagBit(mag.uA + 0.5 * (mag.ud - mag.uA), mag.ud, mag.sed, o.yB) : [];
  const elvVann = bankBiter.map((b) => {
    const ui = b.filter((u) => u <= uL);
    return sti([...ui.map((u): SnittPunkt => [xU(u), o.yW(u)]), ...[...ui].reverse().map((u): SnittPunkt => [xU(u), elvBunn(u)])], true);
  });
  const magVann = mag ? sti(lagBit(mag.uA, mag.ud, () => mag.yL, mag.sed), true) : '';
  const havVann = sti(lagBit(uL, 1, () => ySea, o.yB), true);
  // Skråsjikt i deltaet: linjer parallelle med deltafronten
  const f0: SnittPunkt = [xU(uL), o.yB(uL)];
  const f1: SnittPunkt = [xU(uT), o.yB(uT)];
  const skraa = [0.35, 0.7, 1.05, 1.4, 1.75].map((i) => `M${r2(f0[0] - i * 0.025 * w)} ${r2(f0[1])}L${r2(f1[0] - i * 0.025 * w)} ${r2(f1[1])}`).join('');
  // Korn på bunnen: grovest øverst
  const rnd = sceneRandom(seed + 31);
  const korn: { x: number; y: number; rx: number; ry: number; tone: number }[] = [];
  if (p.korn !== false) {
    let u = 0.01;
    const hs = h / 280;
    while (u < uM - 0.01) {
      const rel = u / uM;
      const d = Math.min((1.1 + 6 * (1 - rel) ** 1.6) * kk * Math.sqrt(hs), 1.5 * o.dyb(u) + 1.5);
      if (!iMag(u) && !(mag && u > mag.ud && u < mag.ud + 0.012)) {
        const rx = d * (0.85 + 0.3 * rnd());
        const ry = rx * (0.62 + 0.18 * rnd());
        // Kornene ligger delvis nede i bunnen
        korn.push({ x: xU(u) + (rnd() - 0.5) * d, y: o.yB(u) - ry * 0.25, rx, ry, tone: Math.floor(rnd() * 3) });
      }
      u += (d * (1.5 + 0.6 * rnd())) / w;
    }
  }
  // Slam i vannet (grumsete) og stein i strømmen (slamstrøm)
  let partikler = '';
  if (slam) {
    const r = sceneRandom(seed + 77);
    for (const b of bankBiter)
      for (const u of b) {
        if (u > uL || r() > (klarhet === 'slamstrom' ? 0.9 : 0.55 * (0.3 + u))) continue;
        const top = o.yW(u);
        const bunn = elvBunn(u);
        if (bunn - top < 2) continue;
        partikler += sirkel(xU(u) + (r() - 0.5) * 3, top + (bunn - top) * (0.15 + 0.7 * r()), (0.45 + 0.35 * r()) * kk);
      }
  }
  const slamSteiner: { x: number; y: number; rx: number; ry: number; tone: number }[] = [];
  if (klarhet === 'slamstrom') {
    const r = sceneRandom(seed + 91);
    for (let u = 0.03; u < uM * 0.85; u += 0.045 + 0.03 * r()) {
      if (iMag(u)) continue;
      const top = o.yW(u);
      const bunn = o.yB(u);
      const d = (2.5 + 3.5 * r()) * kk * (1 - (u / uM) * 0.6);
      slamSteiner.push({ x: xU(u), y: top + (bunn - top) * (0.3 + 0.4 * r()), rx: d, ry: d * 0.75, tone: 2 });
    }
  }
  const havSlam = slam ? sti([[xU(uL), ySea], [xU(uL + 0.2), ySea], [xU(uL + 0.12), ySea + 0.025 * h], [xU(uL), ySea + 0.045 * h]], true) : '';
  const stromSnitt = bankBiter.map((b) => sti(b.filter((u) => u <= uM).map((u): SnittPunkt => [xU(u), o.yW(u) + Math.max(1, 0.35 * o.dyb(u))]))).join('');
  const toppLinje = us.map((u): SnittPunkt => [xU(u), o.yW(u)]);
  const frontSti = sti([...toppLinje, [w, h], [0, h]], true);
  const sideFelt: SideFelt[] = [
    { y0: ySea, y1: o.yB(1), fyll: hav.dyp },
    { y0: o.yB(1), y1: o.berg(1), fyll: monstre.fyll('leire').fill, kant: GEO.bergart.leire.line },
    { y0: o.berg(1), y1: h, fyll: monstre.fyll(berggrunn).fill, kant: GEO.bergart[berggrunn].line },
  ];

  /* ---------- Sonene ---------- */
  const sone = o.soner;
  const soneListe =
    sone?.type === 'lop'
      ? [
          { x0: 0, x1: 0.33 * uM, tekst: 'Øvre løp', kort: 'Øvre' },
          { x0: 0.33 * uM, x1: 0.75 * uM, tekst: 'Midtre løp', kort: 'Midtre' },
          { x0: 0.75 * uM, x1: uM, tekst: 'Nedre løp', kort: 'Nedre' },
          { x0: uM, x1: 1, tekst: 'Delta', kort: 'Delta' },
        ]
      : [
          { x0: 0, x1: 0.3 * uM, tekst: 'Erosjon', kort: 'Erosjon', farge: GEO.erosjon },
          { x0: 0.3 * uM, x1: 0.72 * uM, tekst: 'Transport', kort: 'Transport' },
          { x0: 0.72 * uM, x1: 1, tekst: 'Avsetning', kort: 'Avsetning', farge: GEO.avsetning },
        ];
  const flyttKlammer = soneListe.map((z) => ({ ...z, x0: xU(z.x0) + 0.5 * dx, x1: xU(z.x1) + 0.5 * dx }));

  return (
    <g transform={`translate(${r2(x)} ${r2(y)})`}>
      <LagMonstre id={monstre.id} bare={ELV_MONSTRE.get(berggrunn)} />
      {p.skygge !== false && <ContactShadow cx={(w + dx) / 2} cy={h - dy / 2 + 3} rx={(w + dx) / 2 + 8} ry={Math.max(6, dy / 2 + 7)} opacity={0.7} />}
      {p.fjellvegg !== false && (
        <Dalside rygg={veggRygg} bunn={veggBunn} snoY={snoY} skog={skog} uid={uid} />
      )}
      {dy > 0.5 && (
        <g>
          {bankFlater.map((b, i) => (
            <path key={i} d={b.d} fill={b.fyll} stroke={b.fyll} strokeWidth={0.8} strokeLinejoin="round" />
          ))}
          <path d={bankKant.join('')} fill={mix(SCENE.soil, SCENE.stone, 0.35)} stroke={shade(SCENE.soil, 0.2)} strokeWidth={0.5 * s} />
          <path d={vannBiter.join('')} fill={vf.flate} />
          <path d={stromBand.join('')} fill="none" stroke={vf.glans} strokeWidth={1 * s} strokeDasharray="7 11" strokeDashoffset={r2(-((tt * 30) % 18))} strokeLinecap="round" opacity={0.85} />
          {magBand && <path d={magBand} fill={vf.flate} />}
          <path d={havBand} fill={hav.flate} />
          <g stroke={hav.glans} strokeLinecap="round" opacity={0.8}>
            {[0.3, 0.65].map((q, j) => (
              <line key={j} x1={r2(xU(uL + 0.04) + q * dx)} x2={r2(w - 0.04 * w + q * dx)} y1={r2(ySea - q * dy)} y2={r2(ySea - q * dy)} strokeWidth={1.1 * s} />
            ))}
          </g>
          {plumeBand && <path d={plumeBand} fill={slamFarge} opacity={0.7} />}
          <path d={bakkant.join('')} fill="none" stroke={SCENE.outline} strokeWidth={1 * s} strokeLinejoin="round" opacity={0.8} />
          <path d={`M${r2(xU(uL) + dx)} ${r2(ySea - dy)}H${r2(w + dx)}`} stroke={SCENE.outline} strokeWidth={1 * s} />
          {mag && (
            <path
              d={sti(
                [
                  [xU(mag.ud), mag.fotY - mag.hd],
                  [xU(mag.ud) + Math.max(4, 0.14 * mag.hd), mag.fotY - mag.hd],
                  [xU(mag.ud) + Math.max(4, 0.14 * mag.hd) + dx, mag.fotY - mag.hd - dy],
                  [xU(mag.ud) + dx, mag.fotY - mag.hd - dy],
                ],
                true,
              )}
              fill={tint(SCENE.concrete, 0.25)}
              stroke={SCENE.outline}
              strokeWidth={0.8 * s}
            />
          )}
        </g>
      )}
      <Sideflate x={w} felt={sideFelt} dx={dx} dy={dy} bunn={h} id={`${uid}-side`} />

      {/* ---------- Snittet foran ---------- */}
      <LagFlate points={[...us.map((u): SnittPunkt => [xU(u), o.berg(u)]), [w, h], [0, h]]} type={berggrunn} monstre={monstre.id} lys={false} />
      <LagFlate points={grusBit} type="grus" monstre={monstre.id} lys={false} />
      <LagFlate points={sandBit} type="sand" monstre={monstre.id} lys={false} />
      <defs>
        <clipPath id={`${uid}-delta`}>
          <path d={sti(deltaBit, true)} />
        </clipPath>
      </defs>
      <LagFlate points={deltaBit} type="sand" monstre={monstre.id} lys={false} />
      <path d={skraa} clipPath={`url(#${uid}-delta)`} fill="none" stroke={GEO.bergart.sand.line} strokeWidth={0.9 * s} opacity={0.7} />
      <LagFlate points={leireBit} type="leire" monstre={monstre.id} lys={false} />
      {magSand.length > 2 && <LagFlate points={magSand} type="sand" monstre={monstre.id} lys={false} />}
      {magLeire.length > 2 && <LagFlate points={magLeire} type="leire" monstre={monstre.id} lys={false} />}
      <LinearGradient
        id={`${uid}-elv`}
        stops={[
          [0, vf.lys],
          [0.5, vf.midt],
          [1, vf.dyp],
        ]}
      />
      <LinearGradient
        id={`${uid}-elvned`}
        stops={[
          [0, vfNed.lys],
          [0.5, vfNed.midt],
          [1, vfNed.dyp],
        ]}
      />
      <LinearGradient
        id={`${uid}-hav`}
        userSpace
        x1={0}
        y1={ySea}
        x2={0}
        y2={o.yB(1)}
        stops={[
          [0, hav.midt],
          [0.6, hav.dyp],
          [1, shade(hav.dyp, 0.3)],
        ]}
      />
      {elvVann.map((d, i) => (
        <path key={i} d={d} fill={`url(#${uid}-${mag && bankBiter[i]![0]! >= mag.ud ? 'elvned' : 'elv'})`} />
      ))}
      {magVann && <path d={magVann} fill={`url(#${uid}-elv)`} />}
      <path d={havVann} fill={`url(#${uid}-hav)`} />
      {havSlam && <path d={havSlam} fill={slamFarge} opacity={0.65} />}
      <KornRad korn={korn} uid={uid} />
      {partikler && <path d={partikler} fill={mix(SCENE.soilDark, SCENE.soil, 0.4)} opacity={0.7} />}
      <KornRad korn={slamSteiner} uid={`${uid}-slam`} />
      <path d={stromSnitt} fill="none" stroke={vf.glans} strokeWidth={1.2 * s} strokeDasharray="6 12" strokeDashoffset={r2(-((tt * 30) % 18))} strokeLinecap="round" opacity={0.85} />
      <path d={sti(toppLinje.filter((q) => q[0] <= xU(uM)))} fill="none" stroke={vf.glans} strokeWidth={1.2 * s} opacity={0.9} />
      <line x1={r2(xU(uL))} x2={w} y1={r2(ySea)} y2={r2(ySea)} stroke={hav.glans} strokeWidth={1.4 * s} />
      {mag && <Demning x={xU(mag.ud)} y={mag.fotY} hoyde={mag.hd} rekkverk />}
      <SnittLys d={frontSti} id={`${uid}-lys`} />
      <g fill="none" stroke={SCENE.outline} strokeWidth={1.2 * s} strokeLinejoin="round" strokeLinecap="round">
        <path d={`M0 ${r2(o.yW(0))}L0 ${r2(h)}L${r2(w)} ${r2(h)}L${r2(w)} ${r2(ySea)}`} />
      </g>
      {sone && <Soneklammer soner={flyttKlammer} y={sone.y} min={-x + 4} />}
    </g>
  );
}

/** Mønstrene et lengdeprofil trenger, som faste lister per berggrunn. */
const ELV_MONSTRE = new Map<MonsterId, readonly MonsterId[]>(
  MONSTER_IDS.map((id): [MonsterId, readonly MonsterId[]] => [id, [...new Set<MonsterId>([id, 'grus', 'sand', 'leire', 'ur'])]]),
);

type TverrFlate = 'vann' | 'gress' | 'bredd' | 'voll';

/** Fargene på flomlinjene når de ikke har egen farge: blått i tre toner som synes i begge temaer. */
const FLOM_FARGER = [GEO.avrenning, GEO.nedbor, mix(GEO.nedbor, VIZ.ink, 0.45)];
const FLOM_STREK = ['9 5', '5 4', '2.5 3.5'];

function TverrTegning({ p, o, x, y }: { p: ElveleieProps; o: TverrOppsett; x: number; y: number }) {
  const s = useGeoStroke();
  const kk = useGeoScale();
  const f = useTextScale();
  const uid = useSvgId('elv-tverr');
  const monstre = useLagMonstre('elvtverr');
  const { w, h, dx, dy, xM, yH, niva, omrade } = o;
  const pp = o.p;
  const klarhet = p.klarhet ?? 'klar';
  const vf = vannFarger(klarhet);
  const x0m = pp[0]![0];
  const x1m = pp[pp.length - 1]![0];
  const z = (m: number) => profilZ(pp, m);
  const z0 = (m: number) => profilZ(o.p0, m);
  const ekstraM = [...pp.map((q) => q[0]), ...(omrade ? [omrade[0], omrade[1]] : [])];
  const ms = provepunkter(x0m, x1m, 240, ekstraM);
  const vaat = (m: number) => !!omrade && m > omrade[0] && m < omrade[1];
  const toppY = (lx: number) => {
    const m = o.mFraX(lx);
    return vaat(m) ? yH(niva) : yH(z(m));
  };
  const typeVed = (lx: number): TverrFlate => {
    const m = o.mFraX(lx);
    if (vaat(m)) return 'vann';
    if (z(m) - z0(m) > 0.05) return 'voll';
    if (z(m) < niva + 0.6) return 'bredd';
    return 'gress';
  };
  const lop = delILop(ms.map(xM), toppY, typeVed);
  const farge = (t: TverrFlate, q: number) =>
    t === 'vann'
      ? vf.flate
      : t === 'voll'
        ? lysFarge(mix(SCENE.stone, GEO.bergart.ur.fill, 0.4), q)
        : t === 'bredd'
          ? lysFarge(mix(GEO.bergart.grus.fill, SCENE.gravel, 0.5), q)
          : lysFarge(SCENE.grass, q);
  const tt = fin(p.t);
  const pynt = (l: Lop<TverrFlate>) => {
    if (l.type !== 'vann') return null;
    const xa = l.p[0]![0];
    const xb = l.p[l.p.length - 1]![0];
    const yy = l.p[0]![1];
    return (
      <g stroke={vf.glans} strokeLinecap="round" fill="none">
        {[0.3, 0.62].map((q, j) => (
          <line
            key={j}
            x1={r2(xa + q * dx + (xb - xa) * 0.1)}
            x2={r2(xb + q * dx - (xb - xa) * 0.1)}
            y1={r2(yy - q * dy)}
            y2={r2(yy - q * dy)}
            strokeWidth={1.1 * s}
            strokeDasharray="10 14"
            strokeDashoffset={r2((tt * 20) % 24)}
            opacity={0.85 - 0.25 * j}
          />
        ))}
      </g>
    );
  };

  /* ---------- Snittet ---------- */
  const bakke = ms.map((m): SnittPunkt => [xM(m), yH(z(m))]);
  const matjord = 0.35;
  const tørrBiter: number[][] = [];
  {
    let cur: number[] = [];
    for (const m of ms) {
      if (!vaat(m) && z(m) - z0(m) < 0.05) cur.push(m);
      else if (cur.length) {
        tørrBiter.push(cur);
        cur = [];
      }
    }
    if (cur.length) tørrBiter.push(cur);
  }
  const matjordD = tørrBiter
    .filter((b) => b.length > 1)
    .map((b) => sti([...b.map((m): SnittPunkt => [xM(m), yH(z(m))]), ...[...b].reverse().map((m): SnittPunkt => [xM(m), yH(z(m) - matjord)])], true))
    .join('');
  const voller = (p.forbygning ?? [])
    .filter((fb) => Number.isFinite(fb.x) && fb.hoyde > 0)
    .map((fb) => {
      const b = Math.max(0.2, fin(fb.bredde, 2));
      const fot = b / 2 + 1.5 * fb.hoyde;
      const mi = ms.filter((m) => m >= fb.x - fot && m <= fb.x + fot);
      return [...mi.map((m): SnittPunkt => [xM(m), yH(z(m))]), ...[...mi].reverse().map((m): SnittPunkt => [xM(m), yH(z0(m))])];
    })
    .filter((q) => q.length > 2);
  const vannPoly: SnittPunkt[] = omrade
    ? [[xM(omrade[0]), yH(niva)], [xM(omrade[1]), yH(niva)], ...ms.filter((m) => vaat(m)).reverse().map((m): SnittPunkt => [xM(m), yH(z(m))])]
    : [];
  const panelData = p.malepunkter?.length ? tverrsnittPaneler(pp, niva, p.malepunkter) : null;
  const paneler =
    panelData && p.paneler !== false
      ? panelData.deler.map((d) => {
          const mi = ms.filter((m) => m > d.fra && m < d.til);
          return sti([[xM(d.fra), yH(niva)], [xM(d.til), yH(niva)], [xM(d.til), yH(z(d.til))], ...[...mi].reverse().map((m): SnittPunkt => [xM(m), yH(z(m))]), [xM(d.fra), yH(z(d.fra))]], true);
        })
      : [];
  const frontTopp = ms.map((m): SnittPunkt => [xM(m), vaat(m) ? yH(niva) : yH(z(m))]);
  const frontSti = sti([...frontTopp, [w, h], [0, h]], true);
  const sideFelt: SideFelt[] = [];
  if (omrade && omrade[1] >= x1m - 1e-6) sideFelt.push({ y0: yH(niva), y1: yH(z(x1m)), fyll: vf.dyp });
  sideFelt.push({ y0: yH(z(x1m)), y1: h, fyll: monstre.fyll('grus').fill, kant: GEO.bergart.grus.line });

  /* ---------- Flomlinjer og målepunkter ---------- */
  const fs = 17 * 0.8 * f;
  const flom = (p.flomlinjer ?? [])
    .filter((l) => Number.isFinite(l.niva))
    .map((l, i) => {
      const om = vaatOmrade(pp, l.niva);
      const a = om ? xM(om[0]) : 0;
      const b = om ? xM(om[1]) : w;
      const yy = yH(l.niva);
      const tekst = l.navn ?? '';
      const tb = tekstBredde(tekst, 0.72, f);
      // Teksten til høyre for linja når den får plass i blokka, ellers til venstre, ellers over linja
      const hoyre = b + 6 + tb <= w + dx;
      const venstre = a - 6 - tb >= 0;
      return { i, a, b, yy, tekst, farge: l.farge ?? FLOM_FARGER[i % FLOM_FARGER.length]!, strek: FLOM_STREK[i % FLOM_STREK.length]!, tx: hoyre ? b + 6 : venstre ? a - 6 : (a + b) / 2, anker: (hoyre ? 'start' : venstre ? 'end' : 'middle') as 'start' | 'end' | 'middle', over: !hoyre && !venstre };
    });
  const maal = o.maal;
  const r = 4.6 * kk;

  /* ---------- Aksene ---------- */
  const akser = !!p.akser;
  const zLav = o.hFraY(h);
  const zHoy = o.hFraY(Math.min(yH(niva), ...pp.map((q) => yH(q[1]))) - 4);
  const zTicks = akser ? niceTicks(zLav, zHoy, 5).filter((v) => yH(v) <= h + 0.5 && yH(v) >= yH(zHoy) - 0.5) : [];
  const xTicks = akser ? niceTicks(x0m, x1m, 6).filter((v) => v >= x0m - 1e-6 && v <= x1m + 1e-6) : [];
  const dec = (ts: number[]) => (ts.length > 1 && Math.abs(ts[1]! - ts[0]!) < 1 ? 1 : 0);

  return (
    <g transform={`translate(${r2(x)} ${r2(y)})`}>
      <LagMonstre id={monstre.id} bare={TVERR_MONSTRE} />
      {p.skygge !== false && <ContactShadow cx={(w + dx) / 2} cy={h - dy / 2 + 3} rx={(w + dx) / 2 + 8} ry={Math.max(6, dy / 2 + 7)} opacity={0.7} />}
      {dy > 0.5 && <Toppflate lop={lop} dx={dx} dy={dy} farge={farge} pynt={pynt} />}
      <Sideflate x={w} felt={sideFelt} dx={dx} dy={dy} bunn={h} id={`${uid}-side`} />
      <LagFlate points={[...bakke, [w, h], [0, h]]} type="grus" monstre={monstre.id} lys={false} />
      {matjordD && <path d={matjordD} fill={mix(SCENE.soil, SCENE.soilDark, 0.3)} opacity={0.85} />}
      {voller.map((q, i) => (
        <LagFlate key={i} points={q} type="ur" monstre={monstre.id} lys={false} />
      ))}
      {paneler.map((d, i) => (
        <path key={`p${i}`} d={d} fill={alpha(VIZ.velocity, i % 2 ? 0.07 : 0.16)} />
      ))}
      {vannPoly.length > 2 && (
        <g>
          <LinearGradient
            id={`${uid}-vann`}
            userSpace
            x1={0}
            y1={yH(niva)}
            x2={0}
            y2={Math.max(...vannPoly.map((q) => q[1]))}
            stops={[
              [0, vf.lys],
              [0.5, vf.midt],
              [1, vf.dyp],
            ]}
          />
          <path d={sti(vannPoly, true)} fill={`url(#${uid}-vann)`} opacity={paneler.length ? 0.85 : 1} />
          {paneler.length > 0 && <path d={paneler.join('')} fill="none" stroke={alpha(VIZ.velocity, 0.6)} strokeWidth={0.8 * s} />}
          <line x1={r2(vannPoly[0]![0])} x2={r2(vannPoly[1]![0])} y1={r2(yH(niva))} y2={r2(yH(niva))} stroke={vf.glans} strokeWidth={1.5 * s} />
        </g>
      )}
      <SnittLys d={frontSti} id={`${uid}-lys`} />
      <path d={sti(bakke)} fill="none" stroke={SCENE.outline} strokeWidth={0.9 * s} opacity={0.7} />
      <path d={`M0 ${r2(frontTopp[0]![1])}V${r2(h)}H${r2(w)}V${r2(frontTopp[frontTopp.length - 1]![1])}`} fill="none" stroke={SCENE.outline} strokeWidth={1.2 * s} strokeLinejoin="round" />

      {/* ---------- Målevertikaler ---------- */}
      {maal.map((m) => (
        <g key={m.i}>
          <line x1={r2(m.xx)} x2={r2(m.xx)} y1={r2(m.tekst ? m.ytop - 4 - m.rad * fs * 1.1 : m.ytop - 2)} y2={r2(m.ybunn)} stroke={VIZ.ink} strokeWidth={1 * s} strokeDasharray="3 3" opacity={0.75} />
          <circle cx={r2(m.xx)} cy={r2(m.ym)} r={r2(r)} fill={VIZ.surface} stroke={VIZ.velocity} strokeWidth={1.5 * s} />
          <path d={`M${r2(m.xx - r * 0.62)} ${r2(m.ym - r * 0.62)}L${r2(m.xx + r * 0.62)} ${r2(m.ym + r * 0.62)}M${r2(m.xx - r * 0.62)} ${r2(m.ym + r * 0.62)}L${r2(m.xx + r * 0.62)} ${r2(m.ym - r * 0.62)}`} stroke={VIZ.velocity} strokeWidth={1.4 * s} />
          {m.tekst && (
            <Txt x={m.xx} y={m.ytop - 6 - m.rad * fs * 1.1} size={0.72} weight={650} color={VIZ.velocity}>
              {m.tekst}
            </Txt>
          )}
        </g>
      ))}

      {/* ---------- Flomlinjer ---------- */}
      {flom.map((l) => (
        <g key={l.i}>
          <line x1={r2(l.a - 4)} x2={r2(l.b + 4)} y1={r2(l.yy)} y2={r2(l.yy)} stroke={l.farge} strokeWidth={1.6 * s} strokeDasharray={l.strek} strokeLinecap="round" />
          {l.tekst && (
            <Txt x={l.tx} y={l.over ? l.yy - 5 : l.yy + fs * 0.32} anchor={l.anker} size={0.72} weight={600} color={l.farge}>
              {l.tekst}
            </Txt>
          )}
        </g>
      ))}

      {/* ---------- Aksene ---------- */}
      {akser && (
        <g>
          <line x1={-8} x2={-8} y1={r2(yH(zHoy))} y2={h} stroke={VIZ.muted} strokeWidth={1 * s} />
          {zTicks.map((v) => (
            <g key={`z${v}`}>
              <line x1={-12} x2={-8} y1={r2(yH(v))} y2={r2(yH(v))} stroke={VIZ.muted} strokeWidth={1 * s} />
              <Txt x={-14} y={yH(v) + fs * 0.33} anchor="end" size={0.72} muted>
                {`${fmt(v, dec(zTicks))} m`}
              </Txt>
            </g>
          ))}
          <line x1={0} x2={w} y1={h + 8} y2={h + 8} stroke={VIZ.muted} strokeWidth={1 * s} />
          {xTicks.map((v) => (
            <g key={`x${v}`}>
              <line x1={r2(xM(v))} x2={r2(xM(v))} y1={h + 8} y2={h + 12} stroke={VIZ.muted} strokeWidth={1 * s} />
              <Txt x={xM(v)} y={h + 12 + fs} size={0.72} muted>
                {fmt(v, dec(xTicks))}
              </Txt>
            </g>
          ))}
          <Txt x={w} y={h + 14 + 2 * fs} anchor="end" size={0.72} muted>
            Avstand (m)
          </Txt>
        </g>
      )}
      {o.overhoyde > 1.5 && (
        <Txt x={8} y={h - 8} anchor="start" size={0.7} weight={600}>
          {`Overhøyde ${fmt(o.overhoyde, o.overhoyde < 10 ? 1 : 0)} ganger`}
        </Txt>
      )}
    </g>
  );
}

const TVERR_MONSTRE: readonly MonsterId[] = ['grus', 'ur'];

function OvenfraTegning({ p, o, x, y }: { p: ElveleieProps; o: OvenfraOppsett; x: number; y: number }) {
  const s = useGeoStroke();
  const kk = useGeoScale();
  const f = useTextScale();
  const uid = useSvgId('elv-kart');
  const { w, h, midt, normal, kurv, kMaks, bc } = o;
  const rett = p.form === 'rett';
  const klarhet = p.klarhet ?? 'klar';
  const vf = vannFarger(klarhet);
  const seed = fin(p.seed, 1);
  const tt = fin(p.t);
  const off = (i: number, d: number): SnittPunkt => [midt[i]![0] + normal[i]![0] * d, midt[i]![1] + normal[i]![1] * d];
  const venstre = midt.map((_, i) => off(i, bc / 2));
  const hoyre = midt.map((_, i) => off(i, -bc / 2));
  const kanal = glattSti([...venstre, ...[...hoyre].reverse()], true);
  // Det dype løpet (talveg) nærmest yttersvingen
  const talveg = midt.map((_, i) => off(i, -0.24 * bc * clamp(kurv[i]! / kMaks, -1, 1)));
  // Sandbanker (mellombanker) i innersvingene og bueformede rygger (gamle banker) på flomsletta innenfor
  const banker: string[] = [];
  const rygger: string[] = [];
  const skjaer: string[] = [];
  for (const sv of o.svinger) {
    const bredde = Math.round(midt.length * 0.07);
    const fra = Math.max(0, sv.i - bredde);
    const til = Math.min(midt.length - 1, sv.i + bredde);
    const ytre: SnittPunkt[] = [];
    const indre: SnittPunkt[] = [];
    for (let i = fra; i <= til; i++) {
      const t = 1 - Math.abs(i - sv.i) / bredde;
      const wb = 0.62 * bc * Math.sin((Math.PI * t) / 2) ** 1.4;
      indre.push(off(i, sv.inn * (bc / 2 - 0.85 * wb)));
      ytre.push(off(i, sv.inn * (bc / 2 + 0.25 * wb)));
    }
    banker.push(glattSti([...indre, ...[...ytre].reverse()], true));
    // Krumningsradien i toppen av svingen: bare rygger som får plass innenfor den
    const ds = Math.hypot(midt[Math.min(midt.length - 1, sv.i + 1)]![0] - midt[sv.i]![0], midt[Math.min(midt.length - 1, sv.i + 1)]![1] - midt[sv.i]![1]);
    const R = (2 * ds) / Math.max(1e-6, Math.abs(kurv[sv.i]!));
    for (const k2 of [1, 2, 3]) {
      if (bc / 2 + k2 * 0.5 * bc > 0.7 * R) break;
      const pts: SnittPunkt[] = [];
      for (let i = fra + k2 * 2; i <= til - k2 * 2; i++) pts.push(off(i, sv.inn * (bc / 2 + k2 * 0.5 * bc)));
      if (pts.length > 2) rygger.push(glattSti(pts));
    }
    const ut = -sv.inn;
    const kant: SnittPunkt[] = [];
    for (let i = Math.max(0, sv.i - Math.round(bredde * 0.8)); i <= Math.min(midt.length - 1, sv.i + Math.round(bredde * 0.8)); i++) kant.push(off(i, ut * (bc / 2 + 0.6)));
    skjaer.push(glattSti(kant));
  }
  // Trær på flomsletta, ikke i elva eller kroksjøen
  const rnd = sceneRandom(seed + 3);
  const traer: { x: number; y: number; r: number }[] = [];
  const nTre = Math.round((w * h) / 2600);
  for (let i = 0; i < nTre * 3 && traer.length < nTre; i++) {
    const tx = rnd() * w;
    const ty = rnd() * h;
    let dmin = Infinity;
    for (let j = 0; j < midt.length; j += 3) dmin = Math.min(dmin, Math.hypot(midt[j]![0] - tx, midt[j]![1] - ty));
    if (dmin < bc * 1.1 + 6 * kk) continue;
    const kr = o.kroksjo;
    if (kr && Math.hypot((tx - kr.cx) / (kr.rx + bc), (ty - kr.cy) / (kr.ry + bc)) < 1.2) continue;
    traer.push({ x: tx, y: ty, r: (3.6 + 2.6 * rnd()) * kk });
  }
  // Kroksjøen: en avsnørt sving, som en hestesko
  const kr = o.kroksjo;
  const krSti = kr
    ? (() => {
        const ytreP: SnittPunkt[] = [];
        const indreP: SnittPunkt[] = [];
        const tb = 0.36 * bc;
        for (const t of linspace(0.25 * Math.PI, 1.75 * Math.PI, 40)) {
          const a = kr.vend === 1 ? t + Math.PI / 2 : t - Math.PI / 2;
          ytreP.push([kr.cx + Math.cos(a) * (kr.rx + tb), kr.cy + Math.sin(a) * (kr.ry + tb)]);
          indreP.push([kr.cx + Math.cos(a) * (kr.rx - tb), kr.cy + Math.sin(a) * (kr.ry - tb)]);
        }
        return glattSti([...ytreP, ...[...indreP].reverse()], true);
      })()
    : '';
  // Gamle løp (en rettet elv): spor etter svingene den hadde før
  const gamle = rett
    ? glattSti(
        linspace(0, 1, 80).map((t): SnittPunkt => [-0.04 * w + 1.08 * w * t, h / 2 + 0.24 * h * Math.sin(2 * Math.PI * 2.2 * t + 0.4) * Math.min(1, 1.3 * Math.sin(Math.PI * t))]),
      )
    : '';
  const plastring = rett ? [venstre, hoyre].map((b) => glattSti(b)) : [];
  const stromLinjer: StromLinje[] = p.strom ? [{ punkter: talveg.filter((_, i) => i % 6 === 0) }] : [];
  // Erosjon og avsetning i svingen nærmest midten
  const fs = 17 * 0.78 * f;
  const midtSv = o.merke;
  const iKartet = ([px, py]: SnittPunkt): SnittPunkt => [clamp(px, 0.06 * w + fs * 2, 0.94 * w - fs * 2), clamp(py, fs, h - 0.5 * fs)];
  const prosess = p.prosesser && midtSv
    ? (() => {
        const ut = -midtSv.inn;
        const pe = off(midtSv.i, ut * (bc / 2 + 1));
        const te = iKartet(off(midtSv.i, ut * (bc / 2 + 10 * kk + fs * 0.9)));
        const pa = off(midtSv.i, midtSv.inn * (bc * 0.15));
        const ta = iKartet(off(midtSv.i, midtSv.inn * (bc / 2 + 12 * kk + fs * 0.9)));
        return { pe, te, pa, ta };
      })()
    : null;
  return (
    <g transform={`translate(${r2(x)} ${r2(y)})`}>
      <defs>
        <clipPath id={`${uid}-ramme`}>
          <rect x={0} y={0} width={r2(w)} height={r2(h)} rx={6} />
        </clipPath>
      </defs>
      <LinearGradient
        id={`${uid}-mark`}
        x2={1}
        y2={1}
        stops={[
          [0, tint(SCENE.grass, 0.1)],
          [1, mix(SCENE.grass, SCENE.grassDark, 0.5)],
        ]}
      />
      <RadialGradient id={`${uid}-tre`} cx={0.4} cy={0.36} r={0.7} stops={[[0, tint(SCENE.foliage, 0.25)], [0.6, SCENE.foliage], [1, SCENE.foliageDark]]} />
      <LinearGradient
        id={`${uid}-banke`}
        stops={[
          [0, tint(GEO.bergart.sand.fill, 0.15)],
          [1, mix(GEO.bergart.sand.fill, SCENE.gravel, 0.35)],
        ]}
      />
      <g clipPath={`url(#${uid}-ramme)`}>
        <rect x={0} y={0} width={r2(w)} height={r2(h)} fill={`url(#${uid}-mark)`} />
        {gamle && <path d={gamle} fill="none" stroke={mix(SCENE.grass, SCENE.water, 0.18)} strokeWidth={r2(bc * 0.9)} strokeLinecap="round" opacity={0.7} />}
        <path d={rygger.join('')} fill="none" stroke={mix(SCENE.grass, GEO.bergart.sand.fill, 0.35)} strokeWidth={1.6 * s} opacity={0.75} />
        {krSti && (
          <g>
            <path d={krSti} fill="none" stroke={mix(SCENE.grassDark, SCENE.soil, 0.25)} strokeWidth={r2(0.35 * bc)} strokeLinejoin="round" opacity={0.7} />
            <path d={krSti} fill={mix(vannFarger('klar').midt, SCENE.grassDark, 0.2)} stroke={shade(SCENE.water, 0.2)} strokeWidth={0.7 * s} />
          </g>
        )}
        <g>
          {traer.map((t, i) => (
            <ellipse key={`s${i}`} cx={r2(t.x + t.r * 0.45)} cy={r2(t.y + t.r * 0.5)} rx={r2(t.r)} ry={r2(t.r * 0.8)} fill={SCENE.shadow} opacity={0.35} />
          ))}
          {traer.map((t, i) => (
            <circle key={i} cx={r2(t.x)} cy={r2(t.y)} r={r2(t.r)} fill={`url(#${uid}-tre)`} stroke={shade(SCENE.foliageDark, 0.2)} strokeWidth={0.5 * s} />
          ))}
        </g>
        <path d={kanal} fill={vf.midt} />
        <path d={glattSti(talveg)} fill="none" stroke={vf.dyp} strokeWidth={r2(0.4 * bc)} strokeLinecap="round" opacity={0.55} />
        <path
          d={glattSti(midt.map((_, i) => off(i, 0.18 * bc * clamp(kurv[i]! / kMaks, -1, 1))))}
          fill="none"
          stroke={vf.glans}
          strokeWidth={1 * s}
          strokeDasharray="12 18"
          strokeDashoffset={r2(-((tt * 26) % 30))}
          strokeLinecap="round"
          opacity={0.8}
        />
        {banker.length > 0 && <path d={banker.join('')} fill={`url(#${uid}-banke)`} stroke={shade(GEO.bergart.sand.fill, 0.25)} strokeWidth={0.6 * s} />}
        <path d={skjaer.join('')} fill="none" stroke={shade(SCENE.soil, 0.15)} strokeWidth={2.4 * s} strokeLinecap="round" />
        {plastring.map((d, i) => (
          <g key={i}>
            <path d={d} fill="none" stroke={SCENE.stoneDark} strokeWidth={3.4 * s} />
            <path d={d} fill="none" stroke={SCENE.stone} strokeWidth={2.4 * s} strokeDasharray="2.5 2" />
          </g>
        ))}
        <path d={kanal} fill="none" stroke={shade(SCENE.grassDark, 0.2)} strokeWidth={0.8 * s} />
        {stromLinjer.length > 0 && <Stromlinjer linjer={stromLinjer} stil="linje" farge={VIZ.velocity} t={p.t} fart={30} />}
      </g>
      <rect x={0} y={0} width={r2(w)} height={r2(h)} rx={6} fill="none" stroke={SCENE.outline} strokeWidth={1.1 * s} />
      {prosess && (
        <g>
          <circle cx={r2(prosess.pe[0])} cy={r2(prosess.pe[1])} r={r2(2.6 * kk)} fill={GEO.erosjon} stroke={VIZ.surface} strokeWidth={1} />
          <Txt x={prosess.te[0]} y={prosess.te[1] + fs * 0.35} size={0.78} weight={700} color={GEO.erosjon}>
            Erosjon
          </Txt>
          <circle cx={r2(prosess.pa[0])} cy={r2(prosess.pa[1])} r={r2(2.6 * kk)} fill={GEO.avsetning} stroke={VIZ.surface} strokeWidth={1} />
          <Txt x={prosess.ta[0]} y={prosess.ta[1] + fs * 0.35} size={0.78} weight={700} color={GEO.avsetning}>
            Avsetning
          </Txt>
        </g>
      )}
    </g>
  );
}

/** Etikettene til et Elveleie (navnene i kolonnen til høyre). */
function elveleieEtiketter(g: ElveleieGeometri): SnittEtikett[] {
  const a = g.ankere;
  const ut: SnittEtikett[] = [];
  const legg = (navn: ElveleieAnkerNavn, tekst: string, undertekst?: string) => {
    const q = a[navn];
    if (q) ut.push({ x: q.x, y: q.y, tekst, undertekst });
  };
  if (g.visning === 'lengde') {
    legg('stein', 'Stein og blokk');
    legg('grus', 'Grus');
    legg('magasin', 'Magasin');
    legg('demning', 'Demning');
    legg('elveavsetning', 'Elveavsetning');
    legg('sand', 'Sand');
    legg('delta', 'Delta');
    legg('hav', 'Havet');
    legg('leire', 'Leire');
  } else if (g.visning === 'tverr') {
    legg('vannflate', 'Vannstand');
    legg('elvelop', 'Elveløp');
    legg('flomslette', 'Flomslette');
    legg('terrasse', 'Terrasse');
    legg('forbygning', 'Forbygning');
    legg('grus', 'Grus og sand');
  } else {
    legg('yttersving', 'Yttersving', 'erosjon');
    legg('innersving', 'Innersving', 'avsetning');
    legg('kroksjo', 'Kroksjø');
    legg('elvelop', 'Elveløp');
    legg('flomslette', 'Flomslette');
  }
  return ut;
}

/**
 * En elv i tre visninger: lengdeprofil fra fjell til delta ('lengde'), tverrsnitt med vannstand, flomlinjer og
 * målevertikaler ('tverr') eller kart ovenfra med meandre eller rett kanal ('ovenfra'); vannet er klart, grumsete eller en
 * slamstrøm. Ankerpunkt: (x, y) er øverste venstre hjørne av snittet foran (lengde og tverr, som i Snittblokk; blokka
 * stikker dx til høyre og dy opp) eller av kartet (ovenfra); `elveleieGeometri(props, f).ramme` gir rammen til viewBox.
 *
 *   - 'lengde': blokkdiagram langs elva med vannflaten og breddene i perspektiv og dalsiden bak. Elva er bratt og grunn
 *     øverst og slak nederst; kornene på bunnen er grovest øverst og finest ved munningen, elveavsetningene blir tykkere
 *     nedover, og deltaet har skråsjikt med leire utenfor. Med `demning` fanger magasinet slammet (sand ved innløpet,
 *     leire på bunnen), og grumsete vann blir klart nedenfor. `soner` gir klammer for erosjon, transport og avsetning
 *     (eller øvre, midtre og nedre løp).
 *   - 'tverr': tverrsnitt med vannstand, stiplede flomlinjer med navn, flomslette, forbygninger og målevertikaler med fart
 *     (⊗ = strømmen går inn i bildet) og paneler (midtseksjonsmetoden, `tverrsnittPaneler`). Høydene strekkes så profilet
 *     fyller figuren («Overhøyde 6 ganger»), og `akser` gir høyde og avstand.
 *   - 'ovenfra': kart over en meandrerende elv (eller en rett, forbygd kanal) på en flomslette med trær: dypålen nær
 *     yttersvingene, sandbanker i innersvingene, erosjonskant i yttersvingene, valgfri kroksjø og strømlinjer.
 * Etikettene står i en kolonne fra x + w + dx + 18. Barna får geometrien.
 *   <Elveleie x={20} y={110} w={600} h={240} klarhet={klarhet} soner etiketter />
 *   <Elveleie visning="tverr" x={60} y={60} w={560} h={220} vannstand={niva} flomlinjer={[{ niva: 5.4, navn: '200-årsflom' }]} />
 *   <Elveleie visning="ovenfra" x={20} y={20} w={600} h={300} slyngning={0.8} kroksjo prosesser />
 */
export function Elveleie(props: ElveleieProps) {
  const f = useTextScale();
  const o = elveleieOppsett(props, f);
  if (!o) return null;
  const g = byggElveleieGeometri(props, o);
  const x = fin(props.x);
  const y = fin(props.y);
  const etiketter = props.etiketter ? elveleieEtiketter(g) : [];
  return (
    <g opacity={props.dim ? 0.4 : undefined}>
      {o.visning === 'lengde' ? (
        <LengdeTegning p={props} o={o} x={x} y={y} />
      ) : o.visning === 'tverr' ? (
        <TverrTegning p={props} o={o} x={x} y={y} />
      ) : (
        <OvenfraTegning p={props} o={o} x={x} y={y} />
      )}
      {etiketter.length > 0 && (
        <Etikettkolonne
          x={x + o.w + o.dx + 18}
          topp={g.ramme.y + 6}
          bunn={y + o.h}
          etiketter={etiketter}
          orden={o.visning === 'lengde' ? 'x' : 'y'}
        />
      )}
      {props.children?.(g)}
    </g>
  );
}
