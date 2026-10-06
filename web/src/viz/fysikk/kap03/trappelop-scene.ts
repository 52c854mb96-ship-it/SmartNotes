/**
 * Geometrien i scenen «Arbeid og effekt i trappa» (ren matematikk uten React, så den kan testes): trinnene i
 * steintrappa, hvor løperen er, og hvor langt «kameraet» må følge med når trappa er for høy til å få plass.
 *
 * Verden måles i meter med origo nederst ved første trinn, x mot høyre (opp trappa) og y opp. Figuren tegnes med én
 * fast skala S (px/m) i hver utforming, så løperen, trinnene og høyden alltid står i riktig forhold til hverandre.
 */

const DEG = 180 / Math.PI;

/** Et trinn i en steintrapp: ca. 19 cm opp og 26 cm inn (litt brattere enn en trapp innendørs). */
export const STEP_RISE = 0.19;
export const STEP_RUN = 0.26;
/** Høyden til løperen (m). */
export const RUNNER_HEIGHT = 1.75;
/**
 * Lengden på én gangsyklus (to skritt) som andel av høyden, som i scene-kit-et (gange 0,8). I trappa tar løperen
 * to trinn per skritt, og det passer med gangsyklusen: 0,7 m per skritt langs trappa er to trinn.
 */
export const GAIT_CYCLE = 0.8;

export interface StairGeom {
  /** Høyden (m). */
  h: number;
  /** Antall trinn. */
  n: number;
  /** Høyden og dybden på hvert trinn (m). Høyden er justert litt så trinnene går opp i h. */
  rise: number;
  run: number;
  /** Vannrett lengde på trappa (m). */
  L: number;
  /** Lengden langs trappa (m). */
  slope: number;
  /** Stigningsvinkelen (grader). */
  angle: number;
}

export function stairGeometry(h: number): StairGeom {
  const hh = Number.isFinite(h) && h > 0 ? h : STEP_RISE;
  const n = Math.max(1, Math.round(hh / STEP_RISE));
  const rise = hh / n;
  const run = STEP_RUN;
  const L = n * run;
  return { h: hh, n, rise, run, L, slope: Math.hypot(L, hh), angle: Math.atan2(rise, run) * DEG };
}

/** Utformingen av figuren: størrelse (viewBox) og plassen trappa kan bruke når kameraet står nederst. */
export interface StairLayout {
  W: number;
  H: number;
  /** Foten av trappa (første trinn) i figuren når kameraet står nederst. */
  xs: number;
  yBot: number;
  /** Toppen av trappa skal ikke komme høyere enn dette (plass til stoppeklokka) … */
  yTopMin: number;
  /** … eller lenger til høyre enn dette (plass til toppen med varden). */
  xTopMax: number;
  /** Minste og største skala (px/m). Under den minste følger kameraet løperen i stedet for å zoome ut mer. */
  Smin: number;
  Smax: number;
  /** Hvor høyt løperen står i figuren (andel av høyden fra yBot til yTopMin) når kameraet følger med. */
  follow: number;
}

export const LAYOUT_WIDE: StairLayout = { W: 800, H: 430, xs: 196, yBot: 392, yTopMin: 88, xTopMax: 642, Smin: 22, Smax: 50, follow: 0.4 };
export const LAYOUT_NARROW: StairLayout = { W: 560, H: 540, xs: 62, yBot: 500, yTopMin: 168, xTopMax: 476, Smin: 24, Smax: 58, follow: 0.4 };

/** Skalaen og kameraet for en trapp i en utforming. */
export interface StairView {
  /** Skala (px/m), den samme for alt i scenen. */
  S: number;
  /** Den største forflytningen kameraet trenger (m opp langs trappa): 0 når hele trappa får plass. */
  cMax: number;
  /** Hvor høyt over foten av trappa løperen står i figuren når kameraet følger med (m). */
  follow: number;
}

/**
 * Skalaen velges så hele trappa får plass (zoomer ut når h øker), men aldri mindre enn Smin, så løperen ikke blir
 * for liten. Får trappa likevel ikke plass, følger kameraet løperen langs trappa (c m opp og c / tan(vinkel) m bortover).
 */
export function stairView(g: StairGeom, lay: StairLayout): StairView {
  const availH = lay.yBot - lay.yTopMin;
  const availW = lay.xTopMax - lay.xs;
  const S = clamp(Math.min(availH / g.h, availW / g.L), lay.Smin, lay.Smax);
  const tan = g.rise / g.run;
  const cMax = Math.max(0, g.h - availH / S, (g.L - availW / S) * tan);
  return { S, cMax: cMax < 1e-9 ? 0 : cMax, follow: (lay.follow * availH) / S };
}

/** Hvor mange meter kameraet er flyttet opp langs trappa når løperen har løftet seg `climbed` m. */
export function cameraLift(v: StairView, climbed: number): number {
  if (v.cMax <= 0) return 0;
  return clamp(climbed - v.follow, 0, v.cMax);
}

/** Fra verden (m) til figuren (px) når kameraet er flyttet c m opp langs trappa. */
export function toScreen(g: StairGeom, lay: StairLayout, S: number, c: number, x: number, y: number): { x: number; y: number } {
  const cx = c * (g.run / g.rise);
  return { x: lay.xs + (x - cx) * S, y: lay.yBot - (y - c) * S };
}

/** Lengden på tyngdepila (px per N): G for 60 kg er halvparten så lang som løperen er høy. */
export function forceScale(S: number): number {
  return (0.5 * RUNNER_HEIGHT * S) / (60 * 9.81);
}

export type RunnerPhase = 'start' | 'climb' | 'top';

export interface RunnerPlace {
  /** Ankerpunktet til personen (m): midt mellom føttene, under hofta mens løperen er i trappa. */
  x: number;
  y: number;
  phase: RunnerPhase;
  /** Fasen i gangsyklusen (0–1), så føttene ikke glir langs trappa. */
  fase: number;
}

/** Hvor høyt over linja gjennom de indre hjørnene føttene treffer trinnene (andel av trinnhøyden). */
export const FOOT_LIFT = 0.55;

/**
 * Hvor løperen er når andelen u av trappa er løpt: står klar nederst (u = 0), er på vei opp, eller står på toppen
 * (u = 1). Underveis følger ankerpunktet trappa jevnt, så høyden over bakken er u · h (pluss litt, så føttene
 * treffer midt på trinnene).
 */
export function runnerPlace(g: StairGeom, u: number): RunnerPlace {
  if (!(u > 0)) return { x: -0.55, y: 0, phase: 'start', fase: 0 };
  if (u >= 1) return { x: g.L + 0.75, y: g.h, phase: 'top', fase: 0 };
  const along = u * g.slope;
  return { x: u * g.L, y: u * g.h + FOOT_LIFT * g.rise, phase: 'climb', fase: mod(along / (GAIT_CYCLE * RUNNER_HEIGHT), 1) };
}

/**
 * Armene når løperen løper (ikke går): skulder og albue for armen med fasen x, som i løpesyklusen i scene-kit-et,
 * så armene svinger i takt med beina (den nære armen fram når det fjerne beinet er fram).
 */
export function runningArm(x: number): { skulder: number; albue: number } {
  const c = Math.cos(2 * Math.PI * (x - 0.86));
  return { skulder: 8 - 36 * c, albue: 86 + 12 * Math.max(0, -c) };
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

function mod(a: number, b: number): number {
  return ((a % b) + b) % b;
}
