/**
 * Prosessen og geometrien i «Termofysikkens første lov» (ren regning uten React, testes i forstelov-prosess.test.ts).
 *
 * Scenen: 1,0 mol luft i en stor, loddrett glassylinder med stempel på labbenken. Før prosessen har lufta
 * romtemperatur (293 K) og samme trykk som lufta rundt (101,3 kPa), så volumet er V₀ = nRT₀/p₀ ≈ 24 L.
 * Under sylinderen står en kokeplate (varme inn, Q > 0), en isblokk (varme ut, Q < 0) eller en isoporplate (Q = 0).
 * Eleven velger arbeidet W på gassen og varmen Q. Første lov gir ΔU = W + Q, og ΔT = ΔU / C (model.ts).
 *
 * Hvor stempelet ender, avhenger av hvordan prosessen skjer (veien), ikke bare av W og Q. Her antar vi at arbeidet
 * og varmen tilføres jevnt og samtidig: etter andelen s (0–1) av prosessen har gassen fått arbeidet s · W og
 * varmen s · Q. Med dW = −p dV, p = nRT/V og T(s) = T₀ + s · ΔU / C blir
 *   ln(V/V₀) = −(W / nR) · ∫₀ˢ ds′ / T(s′) = −(s · W / (nR · T₀)) · ln(1 + x) / x,   x = s · ΔU / (C · T₀).
 * Spesialtilfeller: W = 0 gir fast volum, Q = 0 gir adiabatisk prosess (T · V^0,4 er konstant for luft, C = 5/2 · nR),
 * og ΔU = 0 gir isoterm prosess (V = V₀ · e^(−W/(nRT₀))).
 */
import { AIR_HEAT_CAPACITY, AIR_MOL, R_GAS, firstLaw, temperatureAfter } from './model';

/** Starttilstanden: romtemperatur og lufttrykket. */
export const T_START = 293;
export const P_START = 101.3e3;
/** Startvolumet (m³): V₀ = nRT₀ / p₀ ≈ 0,0240 m³ = 24,0 L. */
export const V_START = (AIR_MOL * R_GAS * T_START) / P_START;
/** Glidebryterne for W og Q går fra −ENERGY_MAX til ENERGY_MAX (J). */
export const ENERGY_MAX = 1000;
export const ENERGY_STEP = 50;

export interface ProcessState {
  /** Andelen av prosessen (0–1). */
  s: number;
  /** Arbeid på gassen og tilført varme så langt (J). */
  W: number;
  Q: number;
  /** Endring i indre energi så langt (J). */
  dU: number;
  /** Temperatur (K), volum (m³) og trykk (Pa). */
  T: number;
  V: number;
  p: number;
}

/** ln(1 + x) / x, med rekkeutvikling nær x = 0 (grenseverdien er 1). */
export function logRatio(x: number): number {
  const v = Math.max(-0.999, x);
  if (Math.abs(v) < 1e-6) return 1 - v / 2 + (v * v) / 3;
  return Math.log1p(v) / v;
}

/**
 * Tilstanden etter andelen `s` av prosessen der gassen til sammen får arbeidet W og varmen Q (J), tilført jevnt
 * og samtidig (se toppen av fila). `C` er varmekapasiteten til gassen (J/K).
 */
export function processState(W: number, Q: number, s = 1, C = AIR_HEAT_CAPACITY): ProcessState {
  const k = clamp01(s);
  const dU = k * firstLaw(W, Q);
  const T = temperatureAfter(T_START, dU, C);
  const nR = AIR_MOL * R_GAS;
  const x = dU / (C * T_START);
  const V = V_START * Math.exp(-((k * W) / (nR * T_START)) * logRatio(x));
  return { s: k, W: k * W, Q: k * Q, dU, T, V, p: (nR * T) / V };
}

/** Minste og største volum (m³) for alle verdiene glidebryterne kan gi (sylinderen må ha plass til begge). */
export function volumeExtremes(): { min: number; max: number } {
  let min = Infinity;
  let max = -Infinity;
  for (let W = -ENERGY_MAX; W <= ENERGY_MAX; W += ENERGY_STEP) {
    for (let Q = -ENERGY_MAX; Q <= ENERGY_MAX; Q += ENERGY_STEP) {
      const { V } = processState(W, Q, 1);
      if (V < min) min = V;
      if (V > max) max = V;
    }
  }
  return { min, max };
}

const EXTREMES = volumeExtremes();
export const V_MIN = EXTREMES.min;
export const V_MAX = EXTREMES.max;

/* ------------------------------------------------------------------ Det sylinderen står på */

/** Smeltepunktet til is og temperaturen til tørris (fast CO₂ som sublimerer), i kelvin. */
export const ICE_T = 273.15;
export const DRY_ICE_T = 194.65;

export type Support = 'kokeplate' | 'is' | 'torris' | 'isopor';

/**
 * Hva sylinderen står på: en kokeplate når gassen får varme (Q > 0), isopor når Q = 0, og ellers noe som er
 * kaldere enn gassen gjennom hele prosessen, så varmen faktisk går fra gassen og ut: en isblokk (0 °C) når gassen
 * holder seg over 2 °C, ellers tørris (−78,5 °C). Temperaturen endrer seg jevnt, så den laveste er T₀ eller T etter.
 */
export function supportFor(W: number, Q: number): Support {
  if (Q > 0) return 'kokeplate';
  if (Q === 0) return 'isopor';
  const coldest = Math.min(T_START, processState(W, Q, 1).T);
  return coldest > ICE_T + 2 ? 'is' : 'torris';
}

/** Temperaturen (K) til det som tar imot varmen når Q < 0 (isblokka eller tørrisen). */
export function sinkTemperature(support: Support): number {
  return support === 'torris' ? DRY_ICE_T : ICE_T;
}

/* ------------------------------------------------------------------ Scenen */

/** Piksler per meter i scenen (5 px per cm). */
export const PX_PER_M = 500;
/** Piksler per joule for energipilene W og Q (samme skala for begge). */
export const PX_PER_J = 0.1;

/** Ekte mål i meter. */
export const MAAL = {
  /** Innvendig radius i sylinderen og tykkelsen på glasset. */
  boreR: 0.18,
  glass: 0.006,
  /** Bunnplata i stål: radius og tykkelse. */
  flensR: 0.205,
  flensT: 0.02,
  /** Stempelet: tykkelse. Stempelstanga: diameter og lengde over stempelet. */
  stempelT: 0.03,
  stang: 0.022,
  stangL: 0.21,
  /** Kokeplata (bredde); isblokka og isoporplata er like høye, så sylinderen står like høyt på alle tre. */
  kokeplate: 0.5,
} as const;

/** Tverrsnittsarealet (m²) innvendig i sylinderen: A = πr². */
export const BORE_AREA = Math.PI * MAAL.boreR ** 2;

/** Høyden (m) av gass-søylen for volumet V (m³): V = A · h. */
export function gasColumnHeight(V: number): number {
  return Math.max(0, V) / BORE_AREA;
}

/** Ellipseforholdet ry/rx for de runde flatene (som kokeplata i scene-kit-et). */
export const ELLIPSE = 0.15;

export interface SceneLayout {
  narrow: boolean;
  viewBox: string;
  left: number;
  right: number;
  top: number;
  bottom: number;
  /** Benkeplata. */
  benchY: number;
  /** Midtlinja i sylinderen. */
  cx: number;
  /** Det digitale termometeret (midt på bunnen). */
  thermoX: number;
}

const SCENE_W = 800;
const SCENE_H = 500;
const BENCH_Y = 440;
const CX = 340;

/**
 * Utsnittet: hele benken på PC. På mobil et smalere utsnitt rundt termometeret, sylinderen og etikettene til
 * høyre, så gjenstandene blir større på skjermen.
 */
export function sceneLayout(narrow: boolean): SceneLayout {
  if (!narrow) {
    return { narrow, viewBox: `0 0 ${SCENE_W} ${SCENE_H}`, left: 0, right: SCENE_W, top: 0, bottom: SCENE_H, benchY: BENCH_Y, cx: CX, thermoX: 122 };
  }
  const left = CX - 222;
  const right = CX + 240;
  const top = 14;
  return { narrow, viewBox: `${left} ${top} ${right - left} ${SCENE_H - top}`, left, right, top, bottom: SCENE_H, benchY: BENCH_Y, cx: CX, thermoX: CX - 174 };
}

export interface CylinderGeometry {
  /** Innvendig og ytre radius (glasset) i px. */
  r: number;
  rOuter: number;
  /** Bunnplata: radius og overkant (der gassen begynner). */
  flensR: number;
  flensTop: number;
  /** Oversiden av kokeplata, isblokka eller isoporplata, og bredden på kokeplata. */
  supportTop: number;
  supportW: number;
  /** Undersiden av stempelet (toppen av gassen), oversiden av stempelet og høyden av gassen (px). */
  gasTop: number;
  pistonTop: number;
  gasH: number;
  /** Overkanten av glasset (fast, litt over stempelet ved største volum). */
  rimY: number;
  /** Toppen av stempelstanga (knotten). */
  rodTop: number;
  ellipse: number;
}

/** Hvor alt i sylinderen er for volumet V (m³). */
export function cylinderAt(layout: SceneLayout, V: number): CylinderGeometry {
  const P = PX_PER_M;
  const supportW = MAAL.kokeplate * P;
  const supportTop = layout.benchY - 0.304 * supportW;
  const flensTop = supportTop - MAAL.flensT * P;
  const hOf = (v: number) => gasColumnHeight(v) * P;
  const gasH = hOf(Math.min(V_MAX, Math.max(V_MIN, V)));
  const gasTop = flensTop - gasH;
  const pistonTop = gasTop - MAAL.stempelT * P;
  const topAtMax = flensTop - hOf(V_MAX) - MAAL.stempelT * P;
  const r = MAAL.boreR * P;
  return {
    r,
    rOuter: r + MAAL.glass * P,
    flensR: MAAL.flensR * P,
    flensTop,
    supportTop,
    supportW,
    gasTop,
    pistonTop,
    gasH,
    rimY: topAtMax - 10,
    rodTop: pistonTop - MAAL.stangL * P,
    ellipse: ELLIPSE,
  };
}

/** Lengden (px) av energipila for energien E (J). */
export function energyArrowLength(E: number): number {
  return Math.abs(Number.isFinite(E) ? E : 0) * PX_PER_J;
}

/**
 * Hvor langt den fremre buen av en sirkel i sylinderen (bunnen, undersiden av stempelet) ligger under midtlinja
 * i høyden x: r · e · √(1 − ((x − cx)/r)²).
 */
export function frontArcDepth(g: CylinderGeometry, cx: number, x: number): number {
  const d = (x - cx) / g.r;
  return g.r * g.ellipse * Math.sqrt(Math.max(0, 1 - d * d));
}

/**
 * Partiklene: simuleringen regner i en boks der «u» går mot stempelet. Her er u oppover (fra bunnen mot stempelet)
 * og w bortover. Partiklene følger buene foran, så de aldri havner bak stempelet eller under bunnen.
 */
export function particlePoint(g: CylinderGeometry, cx: number, pr: number, u: number, w: number): { x: number; y: number } {
  const inner = Math.max(0, g.r - pr);
  const span = Math.max(0, g.gasH - 2 * pr);
  const x = cx - inner + clamp01(w) * 2 * inner;
  return { x, y: g.flensTop - pr - clamp01(u) * span + frontArcDepth(g, cx, x) };
}

/** Fargen på gassen: −1 = kald (blå), 0 = romtemperatur, 1 = varm (oransje). Fullt utslag ved ±90 K. */
export function gasWarmth(T: number): number {
  const d = (T - T_START) / 90;
  return Math.max(-1, Math.min(1, Number.isFinite(d) ? d : 0));
}

/** Hvor mye rim det er på glasset (0–1): ingenting over 0 °C, mer jo kaldere gassen er. */
export function frostAmount(T: number): number {
  return clamp01((273 - T) / 150);
}

/** Hvor mye kokeplata gløder (0–1): bare når den gir varme, mer jo mer varme. */
export function plateEffect(Q: number): number {
  return Q > 0 ? clamp01(0.25 + (0.75 * Q) / ENERGY_MAX) : 0;
}

/**
 * Flytter etiketter (midten i høyden) så de holder minst `gap` fra hverandre, i samme rekkefølge, og innenfor
 * `lo`–`hi` når det er plass. Brukes til etikettene for W, ΔU og Q til høyre for sylinderen.
 */
export function spreadLabels(ys: number[], gap: number, lo = -Infinity, hi = Infinity): number[] {
  const out = ys.map((y) => Math.min(hi, Math.max(lo, y)));
  for (let i = 1; i < out.length; i++) out[i] = Math.max(out[i]!, out[i - 1]! + gap);
  const over = out.length > 0 ? out[out.length - 1]! - hi : 0;
  if (over > 0) {
    for (let i = out.length - 1; i >= 0; i--) {
      const limit = i === out.length - 1 ? hi : out[i + 1]! - gap;
      out[i] = Math.min(out[i]!, limit);
    }
  }
  return out;
}

/* ------------------------------------------------------------------ Energidiagrammet */

/** Halve bredden av aksen i energidiagrammet (J): det minste 500-tallet som rommer alle søylene (minst 500). */
export function diagramRange(W: number, Q: number): number {
  const m = Math.max(Math.abs(W), Math.abs(Q), Math.abs(W + Q));
  return Math.max(500, 500 * Math.ceil(m / 500 - 1e-9));
}

function clamp01(v: number): number {
  return Math.min(1, Math.max(0, Number.isFinite(v) ? v : 0));
}
