/**
 * Geometri og skalaer for scenen i «Gassmodell» (ren regning uten React, testes i gassmodell-scene.test.ts).
 *
 * Scenen: en loddrett glassylinder med stempel står på en kokeplate på labbenken. Stempelstanga er låst i en klemme
 * på et stativ, så volumet holder seg der eleven setter det. Et manometer på stativet måler trykket, og et digitalt
 * termometer med føler gjennom bunnplata måler temperaturen. Alt er tegnet i én skala, PX_PER_M piksler per meter.
 */
import { GAS_N, PISTON_AREA, gasPressure } from './model';

/** Glidebryterne: temperatur i kelvin og volum i liter. */
export const T_MAX = 600;
export const V_MIN = 1.0;
export const V_MAX = 3.0;
/** Utgangspunktet: romtemperatur og et volum som gir omtrent lufttrykket. */
export const T_REF = 293;
export const V_REF = 2.4;

/** Piksler per meter i scenen (10 px per cm). */
export const PX_PER_M = 1000;
/** Piksler per newton for kraften fra gassen på stempelet (samme skala for alle tilstander). */
export const PX_PER_N = 0.026;

/** Ekte mål i meter. */
export const MAAL = {
  /** Tykkelsen på glassveggen. */
  glass: 0.004,
  /** Bunnplata i stål: radius og tykkelse. */
  flensR: 0.09,
  flensT: 0.012,
  /** Stempelet: tykkelse. */
  stempelT: 0.024,
  /** Stempelstanga: diameter. */
  stang: 0.012,
  /** Kokeplata: bredde (plata selv er 0,62 · bredden). */
  kokeplate: 0.32,
  /** Manometeret: radius på skiva. */
  manometerR: 0.05,
} as const;

/** Innvendig radius (m) for en sylinder med tverrsnittsareal A (m²): A = πr². */
export function boreRadius(A: number = PISTON_AREA): number {
  return A > 0 ? Math.sqrt(A / Math.PI) : 0;
}

/** Høyden (m) av gassen i sylinderen: V = A · h. V i liter. */
export function gasColumnHeight(V: number, A: number = PISTON_AREA): number {
  return A > 0 ? (V * 1e-3) / A : 0;
}

/** Kraften (N) fra gassen på stempelet: F = p · A. */
export function pistonForce(p: number, A: number = PISTON_AREA): number {
  return Math.max(0, p) * A;
}

/** Hvor mye kokeplata gløder (0–1): av ved romtemperatur og under, fullt ved T_MAX. */
export function plateEffect(T: number): number {
  return clamp01((T - T_REF) / (T_MAX - T_REF));
}

/** Hvor mye rim det er på glasset (0–1): ingenting over 0 °C, fullt ved ca. 120 K. */
export function frostAmount(T: number): number {
  return clamp01((273 - T) / 150);
}

/** Fargen på gassen: −1 = kald (blå), 0 = romtemperatur, 1 = varm (oransje). */
export function gasWarmth(T: number): number {
  if (T >= T_REF) return plateEffect(T);
  return -clamp01((T_REF - T) / T_REF);
}

/** Manometeret: skala fra 0 til MANOMETER_MAX kPa over 270°. */
export const MANOMETER_MAX = 600;

/** Vinkelen til viseren (grader med klokka fra rett opp): −135° ved 0 kPa og +135° ved fullt utslag. */
export function gaugeAngle(pKPa: number): number {
  const v = Math.min(MANOMETER_MAX * 1.02, Math.max(0, Number.isFinite(pKPa) ? pKPa : 0));
  return -135 + (270 * v) / MANOMETER_MAX;
}

export interface SceneLayout {
  narrow: boolean;
  viewBox: string;
  /** Kantene av utsnittet. */
  left: number;
  right: number;
  top: number;
  bottom: number;
  /** Benkeplata (der kokeplata, stativet og termometeret står). */
  benchY: number;
  /** Midtlinja i sylinderen. */
  cx: number;
  /** Stativstanga. */
  poleX: number;
  /** Det digitale termometeret (midt på bunnen). */
  thermoX: number;
}

const W = 800;
const BENCH_Y = 446;
const H = 488;
const CX = 392;

/**
 * Utsnittet: hele benken på PC. På mobil et smalere utsnitt rundt sylinderen og stativet, og termometeret flyttes
 * fram foran stativfoten, så gjenstandene blir større på skjermen.
 */
export function sceneLayout(narrow: boolean): SceneLayout {
  if (!narrow) {
    return { narrow, viewBox: `0 0 ${W} ${H}`, left: 0, right: W, top: 0, bottom: H, benchY: BENCH_Y, cx: CX, poleX: 672, thermoX: 128 };
  }
  const left = CX - 214;
  const right = CX + 342;
  return { narrow, viewBox: `${left} 0 ${right - left} ${H}`, left, right, top: 0, bottom: H, benchY: BENCH_Y, cx: CX, poleX: 672, thermoX: 626 };
}

export interface CylinderGeometry {
  /** Innvendig radius og ytre radius (glasset) i px. */
  r: number;
  rOuter: number;
  /** Bunnplata: radius og overkant (der gassen begynner). */
  flensR: number;
  flensTop: number;
  /** Midten av kokeplata (overflaten) og bredden på kokeplata. */
  plateTop: number;
  plateW: number;
  /** Undersiden av stempelet (toppen av gassen) og oversiden av stempelet. */
  gasTop: number;
  pistonTop: number;
  /** Høyden av gass-søylen i px. */
  gasH: number;
  /** Overkanten av glasset (fast, litt over stempelet ved største volum). */
  rimY: number;
  /** Klemmen på stativet (fast) og toppen av stempelstanga. */
  clampY: number;
  rodTop: number;
  /** Ellipseforholdet for sirkler sett litt ovenfra (samme som kokeplata). */
  ellipse: number;
}

/** Ellipseforholdet ry/rx for de runde flatene (kokeplata i scene-kit-et har ca. 0,15). */
export const ELLIPSE = 0.15;

/** Hvor alt i sylinderen er for volumet V (liter). */
export function cylinderAt(layout: SceneLayout, V: number): CylinderGeometry {
  const P = PX_PER_M;
  const r = boreRadius() * P;
  const plateW = MAAL.kokeplate * P;
  const plateTop = layout.benchY - 0.304 * plateW;
  const flensTop = plateTop - MAAL.flensT * P;
  const hOf = (v: number) => gasColumnHeight(v) * P;
  const gasH = hOf(Math.min(V_MAX, Math.max(V_MIN, V)));
  const gasTop = flensTop - gasH;
  const pistonTop = gasTop - MAAL.stempelT * P;
  const topAtMax = flensTop - hOf(V_MAX) - MAAL.stempelT * P;
  const rimY = topAtMax - 8;
  const clampY = rimY - 20;
  // Stanga er så lang at den når 14 px over klemmen når stempelet er lengst nede.
  const rodLen = flensTop - hOf(V_MIN) - MAAL.stempelT * P - clampY + 14;
  return {
    r,
    rOuter: r + MAAL.glass * P,
    flensR: MAAL.flensR * P,
    flensTop,
    plateTop,
    plateW,
    gasTop,
    pistonTop,
    gasH,
    rimY,
    clampY,
    rodTop: pistonTop - rodLen,
    ellipse: ELLIPSE,
  };
}

/** Kraften fra gassen og pilene: lengden (px) for trykket p (Pa). */
export function forceArrowLength(p: number): number {
  return pistonForce(p) * PX_PER_N;
}

/** Største kraft som kan vises (T = T_MAX) for et volum, til å sjekke at pila får plass. */
export function maxForceAt(V: number): number {
  return pistonForce(gasPressure(GAS_N, T_MAX, V * 1e-3));
}

/**
 * Hvor langt den fremre buen av en sirkel i sylinderen (bunnen, undersiden av stempelet) ligger under midtlinja
 * i høyden x: r · e · √(1 − ((x − cx)/r)²). Null ved veggene, størst midt foran.
 */
export function frontArcDepth(g: CylinderGeometry, cx: number, x: number): number {
  const d = (x - cx) / g.r;
  return g.r * g.ellipse * Math.sqrt(Math.max(0, 1 - d * d));
}

/**
 * Partiklene: simuleringen regner i en boks der «u» går mot stempelet. Her er u oppover (fra bunnen mot stempelet)
 * og w bortover (fra venstre vegg). Partiklene tegnes i den fremre halvdelen av sylinderen, så de følger buene
 * foran: de havner aldri bak stempelet, og støtene skjer der underkanten av stempelet synes.
 */
export function particlePoint(g: CylinderGeometry, cx: number, pr: number, u: number, w: number): { x: number; y: number } {
  const inner = Math.max(0, g.r - pr);
  const span = Math.max(0, g.gasH - 2 * pr);
  const x = cx - inner + w * 2 * inner;
  return { x, y: g.flensTop - pr - u * span + frontArcDepth(g, cx, x) };
}

function clamp01(v: number): number {
  return Math.min(1, Math.max(0, Number.isFinite(v) ? v : 0));
}
