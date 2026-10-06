/**
 * Ren fysikk for «Kloss på skråplan» (2A, 2C, 2E) i tillegg til `incline` og `criticalAngleDeg` i model.ts:
 * klossene eleven kan velge (materiale, friksjonstall mot en treplanke og størrelse ut fra massen), og forsøket der
 * planken løftes jevnt til klossen begynner å gli.
 */
import { G_EARTH } from '../../kit/format';
import { criticalAngleDeg } from './model';

const RAD = Math.PI / 180;

/* ---------- Klossene ---------- */

export type BlockMaterial = 'tre' | 'metall' | 'gummi' | 'is';

export interface BlockMaterialData {
  /** Statisk friksjonstall mot en tørr, høvlet treplanke. */
  muS: number;
  /** Glidefriksjonstall mot den samme planken (≤ μs). */
  muK: number;
  /** Massetetthet (kg/m³), så størrelsen på klossen kan regnes ut fra massen. */
  density: number;
}

/**
 * Typiske verdier for en kloss på en treplanke, avrundet til nærmeste 0,05. Tabellverdiene varierer mye med
 * overflaten (tørr, våt, slitt), så dette er omtrentlige verdier. Metallklossen er av aluminium, gummiklossen av
 * massiv gummi, og isklossen er litt våt i overflaten (som is nesten alltid er i et rom).
 */
export const BLOCK_MATERIALS: Record<BlockMaterial, BlockMaterialData> = {
  tre: { muS: 0.5, muK: 0.3, density: 600 },
  metall: { muS: 0.35, muK: 0.25, density: 2700 },
  gummi: { muS: 0.8, muK: 0.6, density: 1200 },
  is: { muS: 0.1, muK: 0.05, density: 917 },
};

/** Forholdet mellom lengden og høyden til klossen sett fra siden. Dybden (inn i bildet) er like stor som høyden. */
export const BLOCK_ASPECT = 1.5;

/**
 * Størrelsen (m) på en kloss med massen m (kg): V = m/ρ og V = l · h · h med l = 1,5 · h, så h = ∛(V/1,5).
 * En trekloss på 4 kg blir ca. 25 cm × 16 cm, en aluminiumskloss på 4 kg ca. 15 cm × 10 cm.
 */
export function blockSize(m: number, material: BlockMaterial): { length: number; height: number } {
  const rho = BLOCK_MATERIALS[material].density;
  if (!(m > 0) || !(rho > 0)) return { length: 0, height: 0 };
  const height = Math.cbrt(m / rho / BLOCK_ASPECT);
  return { length: BLOCK_ASPECT * height, height };
}

/* ---------- Forsøket: planken løftes jevnt til klossen glir ---------- */

export interface TiltInput {
  m: number;
  muS: number;
  /** Glidefriksjonstall (brukes aldri større enn μs). */
  muK: number;
}

export interface TiltRun {
  /** Hvor fort planken løftes (grader per sekund). */
  omegaDeg: number;
  /** Hvor mye brattere planken rekker å bli etter at klossen har begynt å gli, før du stopper (grader). */
  reactionDeg: number;
  /** Planken løftes aldri brattere enn dette (grader). */
  alphaMaxDeg: number;
}

/** Forsøket i visualiseringen: 6° i sekundet, og du stopper 1° etter at klossen begynner å gli (ca. 0,17 s). */
export const TILT_RUN: TiltRun = { omegaDeg: 6, reactionDeg: 1, alphaMaxDeg: 60 };

export interface TiltState {
  /** Vinkelen til planken (grader). */
  alphaDeg: number;
  moving: boolean;
  /** Normalkraften N = mg · cos α. */
  N: number;
  /** Friksjonen oppover langs planken: R = G∥ i ro, R = μk·N når klossen glir. */
  R: number;
  /** Akselerasjon nedover langs planken (m/s²). */
  a: number;
  /** Fart nedover langs planken (m/s). */
  v: number;
  /** Hvor langt klossen har glidd (m). */
  s: number;
  /** Når klossen begynner å gli (s), eller Infinity hvis den aldri gjør det. */
  tSlip: number;
  /** Når du slutter å løfte (s). */
  tHold: number;
  /** Vinkelen du stopper på (grader). */
  holdDeg: number;
}

/** Tidspunktene i forsøket: når klossen glir, når du stopper, og vinkelen du stopper på. */
export function tiltTimes({ muS }: Pick<TiltInput, 'muS'>, run: TiltRun): { slips: boolean; tSlip: number; tHold: number; holdDeg: number } {
  const w = run.omegaDeg;
  const max = Math.max(0, run.alphaMaxDeg);
  const crit = criticalAngleDeg(Math.max(0, muS));
  if (!(w > 0)) return { slips: false, tSlip: Infinity, tHold: Infinity, holdDeg: 0 };
  // Klossen glir først når tan α > μs (som i incline), så den glir aldri hvis grensevinkelen er den største vinkelen.
  const slips = crit < max - 1e-9;
  if (!slips) return { slips, tSlip: Infinity, tHold: max / w, holdDeg: max };
  const holdDeg = Math.min(max, crit + Math.max(0, run.reactionDeg));
  return { slips, tSlip: crit / w, tHold: holdDeg / w, holdDeg };
}

/**
 * Tilstanden ved tiden t. Planken løftes fra 0° med fast vinkelfart ω. Klossen ligger i ro (R = G∥) til tan α = μs,
 * og begynner å gli. Du slutter å løfte når planken har blitt `reactionDeg` brattere, og etter det er vinkelen fast,
 * så akselerasjonen er konstant: a = g(sin α − μk cos α).
 *
 * Mens planken fortsatt løftes (fra tSlip til tHold), er α = ωt, og a = g(sin ωt − μk cos ωt). Det gir eksakte
 * uttrykk (t₁ = tSlip):
 *   v = (g/ω)[cos ωt₁ − cos ωt − μk(sin ωt − sin ωt₁)]
 *   s = (g/ω)[(cos ωt₁ + μk sin ωt₁)(t − t₁) − (sin ωt − sin ωt₁)/ω + μk(cos ωt − cos ωt₁)/ω]
 * Vi ser bort fra at planken dreier seg under klossen i dette korte tidsrommet (en brøkdel av et sekund ved 6°/s).
 */
export function tiltState({ m, muS, muK }: TiltInput, run: TiltRun, t: number): TiltState {
  const G = m * G_EARTH;
  const mu = Math.max(0, Math.min(muK, muS));
  const tt = Math.max(0, Number.isFinite(t) ? t : 0);
  const { slips, tSlip, tHold, holdDeg } = tiltTimes({ muS }, run);
  const w = run.omegaDeg > 0 ? run.omegaDeg : 0;
  const alphaDeg = Math.min(w * tt, slips ? holdDeg : Math.max(0, run.alphaMaxDeg));
  const al = alphaDeg * RAD;
  const N = G * Math.cos(al);
  const base = { alphaDeg, N, tSlip, tHold, holdDeg };
  if (!(tt > tSlip)) return { ...base, moving: false, R: G * Math.sin(al), a: 0, v: 0, s: 0 };

  const g = G_EARTH;
  const wr = w * RAD;
  const a1 = tSlip * wr;
  /** Fart og strekning mens planken fortsatt løftes (tSlip < τ ≤ tHold). */
  const lifting = (tau: number) => {
    const b = tau * wr;
    const v = (g / wr) * (Math.cos(a1) - Math.cos(b) - mu * (Math.sin(b) - Math.sin(a1)));
    const s = (g / wr) * ((Math.cos(a1) + mu * Math.sin(a1)) * (tau - tSlip) - (Math.sin(b) - Math.sin(a1)) / wr + (mu * (Math.cos(b) - Math.cos(a1))) / wr);
    return { v: Math.max(0, v), s: Math.max(0, s) };
  };
  const a = g * (Math.sin(al) - mu * Math.cos(al));
  if (tt <= tHold) return { ...base, moving: true, R: mu * N, a, ...lifting(tt) };
  const h = lifting(tHold);
  const dt = tt - tHold;
  return { ...base, moving: true, R: mu * N, a, v: h.v + a * dt, s: h.s + h.v * dt + 0.5 * a * dt * dt };
}

/**
 * Når avspillingen skal stoppe: når klossen har glidd `sMax` meter (før den treffer stoppeklossen), ellers ved
 * `tMax`. Strekningen øker hele tiden etter at klossen har begynt å gli, så tiden finnes med halvering.
 */
export function tiltEnd(input: TiltInput, run: TiltRun, sMax: number, tMax: number): number {
  if (!(tiltState(input, run, tMax).s > sMax)) return tMax;
  let lo = 0;
  let hi = tMax;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    if (tiltState(input, run, mid).s < sMax) lo = mid;
    else hi = mid;
  }
  return hi;
}
