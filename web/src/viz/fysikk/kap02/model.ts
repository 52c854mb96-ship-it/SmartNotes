/** Ren fysikk for kapittel 2 (ingen React), så den kan testes for seg. */
import { G_EARTH } from '../../kit/format';

/* ---------- 2C Statisk friksjon og glidefriksjon ---------- */

export interface FrictionInput {
  /** Dytt (N). */
  F: number;
  /** Masse (kg). */
  m: number;
  /** Statisk friksjonstall. */
  muS: number;
  /** Glidefriksjonstall (≤ muS). */
  muK: number;
  /** Om klossen allerede glir (glidefriksjonen holder den i gang til F ≤ μk·N). */
  wasMoving?: boolean;
}

export interface FrictionResult {
  /** Normalkraft N = mg. */
  N: number;
  /** Største statiske friksjon μs·N. */
  Rmax: number;
  /** Glidefriksjon μk·N. */
  Rk: number;
  moving: boolean;
  /** Friksjonskraften som faktisk virker. */
  R: number;
  /** Akselerasjon (m/s²). */
  a: number;
}

export function friction({ F, m, muS, muK, wasMoving = false }: FrictionInput): FrictionResult {
  const N = m * G_EARTH;
  const Rmax = muS * N;
  const Rk = Math.min(muK, muS) * N;
  const moving = wasMoving ? F > Rk : F > Rmax;
  const R = moving ? Rk : F;
  const a = moving ? (F - Rk) / m : 0;
  return { N, Rmax, Rk, moving, R, a };
}

export type FrictionFloor = 'tregulv' | 'betong' | 'is';

/**
 * Typiske friksjonstall for en trekasse på tre gulv, avrundet til nærmeste 0,05. Tabellverdiene varierer mye med
 * overflaten (tørr, våt, slitt), så dette er omtrentlige verdier.
 */
export const FRICTION_FLOORS: Record<FrictionFloor, { muS: number; muK: number }> = {
  tregulv: { muS: 0.5, muK: 0.3 },
  betong: { muS: 0.6, muK: 0.45 },
  is: { muS: 0.1, muK: 0.05 },
};

/**
 * Dyttet (N) som velges når eleven bytter til is: nok til at kassen glir for alle massene (μs·N ≤ 39 N), men
 * mindre enn det en person klarer på blank is uten å skli (se pushLimit).
 */
export const ICE_PUSH = 40;

/**
 * Antall desimaler kreftene vises med i friksjonsvisualiseringen: én desimal under 100 N, ellers hele newton.
 * Samme regel for F, R, μs·N og μk·N overalt, så R = F alltid ser likt ut når kassen står i ro.
 */
export function forceDecimals(v: number): number {
  return Math.abs(v) < 99.95 ? 1 : 0;
}

/** Kraften rundet slik den vises (se forceDecimals). Dyttet under avspillingen rundes slik før det regnes videre. */
export function roundForce(v: number): number {
  if (!Number.isFinite(v)) return 0;
  const k = 10 ** forceDecimals(v);
  return Math.round(v * k) / k;
}

/** Massen til personen som dytter kassen (kg). */
export const PERSON_MASS = 70;

/**
 * Det hardeste en person kan dytte vannrett før skoene sklir: kassen dytter like hardt tilbake (Newtons 3. lov), og
 * bare den statiske friksjonen under skoene holder personen igjen, så F ≤ μs · m · g. På blank is (μs ≈ 0,10) er
 * det ca. 69 N for en person på 70 kg.
 */
export function pushLimit(muShoe: number, mPerson = PERSON_MASS): number {
  if (!(muShoe > 0) || !(mPerson > 0)) return 0;
  return muShoe * mPerson * G_EARTH;
}

/** Et dytt som øker jevnt fra null: F = rate · t opp til Fend, og er konstant etter det. */
export interface PushRamp {
  /** Hvor fort dyttet øker (N/s). */
  rate: number;
  /** Største dytt (N). */
  Fend: number;
}

/**
 * Rampen i visualiseringen: dyttet når μs·N etter `tBreak` sekunder og øker videre til 1,5 · μs·N, men aldri over
 * `Fmax`. Er μs·N større enn Fmax, øker dyttet til Fmax på samme tid, og kassen står i ro.
 */
export function pushRampFor({ m, muS }: { m: number; muS: number }, Fmax: number, tBreak = 3): PushRamp {
  const Rmax = muS * m * G_EARTH;
  const target = Rmax > 0 ? Math.min(Rmax, Fmax) : Fmax;
  return { rate: target / tBreak, Fend: Math.min(Fmax, 1.5 * Rmax) };
}

export interface PushState {
  /** Dyttet ved tiden t (N). */
  F: number;
  moving: boolean;
  /** Friksjonen (N): R = F så lenge kassen står i ro, R = μk·N når den glir. */
  R: number;
  /** Akselerasjon (m/s²). */
  a: number;
  /** Fart (m/s). */
  v: number;
  /** Hvor langt kassen har glidd (m). */
  s: number;
  /** Når kassen begynner å gli (s), eller Infinity hvis dyttet aldri blir større enn μs·N. */
  tBreak: number;
}

/**
 * Kassen dyttes med et dytt som øker jevnt fra null (se PushRamp). Den står i ro til F > μs·N, det vil si fram til
 * tb = μs·N / rate. Etter det er friksjonen μk·N og a = (F − μk·N)/m. Fordi F øker lineært, er farten og strekningen
 * eksakte polynomer i t (ingen numerisk integrasjon):
 *   m·v = rate·(t² − tb²)/2 − μk·N·(t − tb)
 *   m·s = rate·((t³ − tb³)/6 − tb²·(t − tb)/2) − μk·N·(t − tb)²/2
 * Når dyttet har nådd Fend, er akselerasjonen konstant.
 */
export function pushRamp({ m, muS, muK }: { m: number; muS: number; muK: number }, { rate, Fend }: PushRamp, t: number): PushState {
  const N = m * G_EARTH;
  const Rmax = muS * N;
  const Rk = Math.min(muK, muS) * N;
  const tt = Math.max(0, Number.isFinite(t) ? t : 0);
  const F = rate > 0 ? Math.min(Fend, rate * tt) : 0;
  const tb = rate > 0 && Fend > Rmax ? Rmax / rate : Infinity;
  if (!(tt > tb)) return { F, moving: false, R: F, a: 0, v: 0, s: 0, tBreak: tb };
  const te = Fend / rate;
  const t1 = Math.min(tt, te);
  const d1 = t1 - tb;
  let v = ((rate * (t1 * t1 - tb * tb)) / 2 - Rk * d1) / m;
  let s = (rate * ((t1 ** 3 - tb ** 3) / 6 - (tb * tb * d1) / 2) - (Rk * d1 * d1) / 2) / m;
  if (tt > te) {
    const aEnd = (Fend - Rk) / m;
    const d2 = tt - te;
    s += v * d2 + 0.5 * aEnd * d2 * d2;
    v += aEnd * d2;
  }
  return { F, moving: true, R: Rk, a: (F - Rk) / m, v, s, tBreak: tb };
}

/**
 * Når avspillingen skal stoppe: når kassen har glidd `sMax` meter (så den ikke går ut av figuren), ellers ved `tMax`.
 * Strekningen øker hele tiden etter at kassen har begynt å gli, så tiden finnes med halvering.
 */
export function pushRampEnd(input: { m: number; muS: number; muK: number }, ramp: PushRamp, sMax: number, tMax: number): number {
  if (!(pushRamp(input, ramp, tMax).s > sMax)) return tMax;
  let lo = 0;
  let hi = tMax;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    if (pushRamp(input, ramp, mid).s < sMax) lo = mid;
    else hi = mid;
  }
  return hi;
}

/* ---------- 2D Newtons tredje lov: bok på bord ---------- */

export const EARTH_MASS = 5.97e24;

export interface BookResult {
  /** Tyngden til boka (jorda på boka) = kraften fra boka på jorda, G′. */
  G: number;
  /** Normalkraften fra bordet på boka = kraften fra boka på bordet, N′. */
  N: number;
  /** Dyttet fra hånda på boka = kraften fra boka på hånda, F′. */
  F: number;
  /** Kraftsummen på boka med positiv retning opp: N − G − F (null, for boka ligger i ro). */
  net: number;
  /** Akselerasjonen G′ alene ville gitt jorda (m/s²): a = G′/M. */
  earthAccel: number;
}

/** Boka ligger i ro. Hånda dytter eventuelt nedover med `push` (N), så N = G + push (Newtons 1. lov). */
export function bookOnTable(m: number, push = 0): BookResult {
  const G = m * G_EARTH;
  const F = Math.max(0, push);
  const N = G + F;
  return { G, N, F, net: N - G - F, earthAccel: G / EARTH_MASS };
}

/**
 * En lærebok i figuren: sidene er 26 cm × 19 cm, og papiret har tettheten 850 kg/m³ (bestrøket papir og perm), så
 * en bok på 1,5 kg blir ca. 3,6 cm tykk.
 */
export const TEXTBOOK = { length: 0.26, width: 0.19, density: 850 };

/** Tykkelsen (m) til en lærebok med massen m (kg): t = m / (ρ · A), der A er arealet av en side. */
export function bookThickness(m: number): number {
  if (!(m > 0)) return 0;
  return m / (TEXTBOOK.density * TEXTBOOK.length * TEXTBOOK.width);
}

/* ---------- 2E Koblede klosser på glatt underlag ---------- */

export interface CoupledResult {
  /** Felles akselerasjon (m/s²). */
  a: number;
  /** Snordraget S (N). */
  S: number;
  /** Kraftsum på A og B hver for seg (N). */
  netA: number;
  netB: number;
}

/** A og B er bundet sammen med en snor, og F drar i B. Ingen friksjon. */
export function coupled(mA: number, mB: number, F: number): CoupledResult {
  const a = F / (mA + mB);
  const S = mA * a;
  return { a, S, netA: S, netB: F - S };
}

/* ---------- 2A/2C/2E Kloss på skråplan ---------- */

const RAD = Math.PI / 180;

export interface InclineInput {
  /** Vinkelen α mellom skråplanet og det vannrette, i grader. */
  alphaDeg: number;
  /** Masse (kg). */
  m: number;
  /** Statisk friksjonstall. */
  muS: number;
  /** Glidefriksjonstall (brukes bare når klossen glir, og aldri større enn μs). */
  muK: number;
}

export interface InclineResult {
  /** Tyngden G = mg. */
  G: number;
  /** Komponenten av G langs planet (nedover): G∥ = G·sin α. */
  Gpar: number;
  /** Komponenten av G vinkelrett inn mot planet: G⊥ = G·cos α. */
  Gperp: number;
  /** Normalkraften. Ingen akselerasjon vinkelrett på planet, så N = G⊥. */
  N: number;
  /** Største statiske friksjon μs·N. */
  Rmax: number;
  /** Glidefriksjon μk·N. */
  Rk: number;
  /** Om klossen glir når den slippes i ro. */
  moving: boolean;
  /** Friksjonen som faktisk virker (oppover langs planet). */
  R: number;
  /** Akselerasjon nedover langs planet (m/s²). */
  a: number;
}

/** Klossen slippes i ro på skråplanet. Den blir liggende så lenge G∥ ≤ μs·N, det vil si tan α ≤ μs. */
export function incline({ alphaDeg, m, muS, muK }: InclineInput): InclineResult {
  const al = alphaDeg * RAD;
  const G = m * G_EARTH;
  const Gpar = G * Math.sin(al);
  const Gperp = G * Math.cos(al);
  const N = Gperp;
  const Rmax = muS * N;
  const Rk = Math.min(muK, muS) * N;
  // Liten toleranse så α = 45° og μs = 1 regnes som «akkurat på grensen» (ligger i ro).
  const moving = Gpar > Rmax + 1e-9 * G;
  const R = moving ? Rk : Gpar;
  const a = moving ? (Gpar - Rk) / m : 0;
  return { G, Gpar, Gperp, N, Rmax, Rk, moving, R, a };
}

/** Grensevinkelen (grader) der klossen så vidt ligger i ro: tan α = μ. */
export function criticalAngleDeg(mu: number): number {
  return Math.atan(mu) / RAD;
}

/* ---------- 2E Heis: tilsynelatende vekt ---------- */

export type LiftTrip = 'opp' | 'ned' | 'fritt-fall';
export type LiftPhaseKind = 'ro' | 'akselererer' | 'konstant' | 'bremser' | 'fritt-fall' | 'nodbrems';

export interface LiftPhase {
  kind: LiftPhaseKind;
  t0: number;
  t1: number;
  /** Akselerasjon i fasen (m/s²), positiv oppover. */
  a: number;
}

/** Lengden på heisturen (s). */
export const LIFT_T_END = 10;

/**
 * Fasene i en heistur. Opp og ned: i ro, øker farten i 2 s, konstant fart i 4 s, bremser i 2 s, i ro.
 * Fritt fall: kabelen ryker etter 1 s, heisen faller fritt i 2 s, og nødbremsen stopper den med a = g oppover.
 */
export function liftPhases(trip: LiftTrip, a0: number): LiftPhase[] {
  if (trip === 'fritt-fall')
    return [
      { kind: 'ro', t0: 0, t1: 1, a: 0 },
      { kind: 'fritt-fall', t0: 1, t1: 3, a: -G_EARTH },
      { kind: 'nodbrems', t0: 3, t1: 5, a: G_EARTH },
      { kind: 'ro', t0: 5, t1: LIFT_T_END, a: 0 },
    ];
  const dir = trip === 'opp' ? 1 : -1;
  return [
    { kind: 'ro', t0: 0, t1: 1, a: 0 },
    { kind: 'akselererer', t0: 1, t1: 3, a: dir * a0 },
    { kind: 'konstant', t0: 3, t1: 7, a: 0 },
    { kind: 'bremser', t0: 7, t1: 9, a: -dir * a0 },
    { kind: 'ro', t0: 9, t1: LIFT_T_END, a: 0 },
  ];
}

export interface LiftState {
  phase: LiftPhase;
  /** Akselerasjon (m/s²), positiv oppover. */
  a: number;
  /** Fart (m/s), positiv oppover. */
  v: number;
  /** Forflytning fra start (m), positiv oppover. */
  y: number;
}

/** Tilstanden ved tiden t, regnet ut fase for fase (konstant akselerasjon i hver fase). */
export function liftState(phases: LiftPhase[], t: number): LiftState {
  let v = 0;
  let y = 0;
  const last = phases[phases.length - 1];
  if (!last) return { phase: { kind: 'ro', t0: 0, t1: 0, a: 0 }, a: 0, v: 0, y: 0 };
  for (const p of phases) {
    const inside = t < p.t1 || p === last;
    const dt = Math.min(Math.max(t - p.t0, 0), p.t1 - p.t0);
    y += v * dt + 0.5 * p.a * dt * dt;
    v += p.a * dt;
    if (inside) return { phase: p, a: p.a, v, y };
  }
  return { phase: last, a: last.a, v, y };
}

/** Det vekta måler: normalkraften N = m(g + a), med a positiv oppover. Vekta kan ikke trekke, så N ≥ 0. */
export function scaleForce(m: number, a: number): number {
  return Math.max(0, m * (G_EARTH + a));
}

/* ---------- 2C/2F Fall med luftmotstand L = kv² ---------- */

/** Fallskjermhopperen i k2-luftmotstand: glidebryterne (masse og luftmotstandstall), hopphøyden og hvor lenge vi følger fallet. */
export const DRAG_RANGES = {
  m: { min: 40, max: 120, start: 80 },
  k: { min: 0.12, max: 1, start: 0.25 },
  /** Høyden over bakken der hopperen forlater flyet (m). */
  jumpHeight: 4000,
  /** Lengden på fallet vi følger (s), godt før skjermen må løses ut. */
  tEnd: 20,
} as const;

/** Terminalfarten der L = G: k·v² = mg ⇒ v = √(mg/k). */
export function terminalVelocity(m: number, k: number): number {
  return k > 0 ? Math.sqrt((m * G_EARTH) / k) : Infinity;
}

export interface FallState {
  /** Fart nedover (m/s). */
  v: number;
  /** Akselerasjon nedover (m/s²). */
  a: number;
  /** Fallhøyde så langt (m). */
  s: number;
  /** Luftmotstand (N). */
  L: number;
}

/**
 * Fall fra ro med luftmotstand L = kv² (k i kg/m). Eksakt løsning av m·a = mg − kv²:
 * v = v_T·tanh(gt/v_T), s = (v_T²/g)·ln cosh(gt/v_T). Uten luftmotstand (k = 0): v = gt.
 */
export function dragFall(m: number, k: number, t: number): FallState {
  if (!(k > 0)) return { v: G_EARTH * t, a: G_EARTH, s: 0.5 * G_EARTH * t * t, L: 0 };
  const vT = terminalVelocity(m, k);
  const x = (G_EARTH * t) / vT;
  const v = vT * Math.tanh(x);
  // ln cosh x = x + ln(1 + e^(−2x)) − ln 2, som ikke flyter over for store x
  const lnCosh = x + Math.log1p(Math.exp(-2 * x)) - Math.LN2;
  const L = k * v * v;
  return { v, a: (m * G_EARTH - L) / m, s: ((vT * vT) / G_EARTH) * lnCosh, L };
}

/**
 * Tiden fra utspranget til farten er en andel `frac` (0–1) av terminalfarten: v = v_T·tanh(gt/v_T) gir
 * t = (v_T/g)·artanh(frac). Terminalfarten nås aldri helt (frac ≥ 1 gir uendelig), og uten luftmotstand heller ikke.
 */
export function dragTimeToFraction(m: number, k: number, frac: number): number {
  if (!(frac > 0)) return 0;
  if (frac >= 1 || !(k > 0)) return Infinity;
  return (terminalVelocity(m, k) / G_EARTH) * Math.atanh(frac);
}

/**
 * Eulers metode slik den brukes i 2F: a = g − (k/m)·v², v_ny = v + a·Δt, t_ny = t + Δt.
 * Gir punktene [t, v] fra t = 0 til tEnd.
 */
export function eulerFall(m: number, k: number, dt: number, tEnd: number): [number, number][] {
  const pts: [number, number][] = [[0, 0]];
  let v = 0;
  const n = Math.round(tEnd / dt);
  for (let i = 1; i <= n; i++) {
    const a = G_EARTH - (k / m) * v * v;
    v += a * dt;
    pts.push([i * dt, v]);
  }
  return pts;
}

/* ---------- Eksempeloppgave (2C, 2E): kasse som sklir ned en rampe ---------- */

/** Tallene i oppgaven: en kasse sklir ned en rampe fra lasteplanet på en flyttebil. */
export interface RampTask {
  /** Masse (kg). */
  m: number;
  /** Vinkelen mellom rampa og bakken (grader). */
  alphaDeg: number;
  /** Glidefriksjonstall. */
  muK: number;
  /** Statisk friksjonstall (til deloppgave d). */
  muS: number;
  /** Lengden på rampa (m). */
  L: number;
}

/** Tallsettene i oppgaven. Det første er standard. Alle har tan α > μs, så kassen begynner å gli av seg selv. */
export const RAMP_TASKS: RampTask[] = [
  { m: 25, alphaDeg: 25, muK: 0.3, muS: 0.45, L: 3.0 },
  { m: 40, alphaDeg: 30, muK: 0.35, muS: 0.5, L: 2.5 },
  { m: 15, alphaDeg: 28, muK: 0.25, muS: 0.4, L: 3.5 },
];

export interface RampSolution {
  G: number;
  /** Komponenten av G langs rampa (nedover). */
  Gpar: number;
  /** Komponenten av G vinkelrett inn mot rampa. */
  Gperp: number;
  /** Normalkraften (= G⊥, ingen akselerasjon vinkelrett på rampa). */
  N: number;
  /** Glidefriksjonen μk·N (oppover langs rampa). */
  R: number;
  /** Kraftsummen langs rampa. */
  sumF: number;
  /** Akselerasjonen nedover rampa (m/s²). */
  a: number;
  /** Farten nederst (m/s), fra v² = 2as. */
  v: number;
  /** Tiden ned rampa (s). */
  t: number;
  /** Den minste vinkelen der kassen begynner å gli av seg selv (grader), tan α = μs. */
  critDeg: number;
  /** Kreftene når rampa har grensevinkelen α_g (deloppgave d). */
  limit: RampLimit;
}

/**
 * Kassen i ro på en rampe med grensevinkelen α_g (tan α_g = μs): den statiske friksjonen er så stor den kan bli,
 * μs·N, og akkurat like stor som G∥. Brattere enn dette, og kassen begynner å gli.
 */
export interface RampLimit {
  /** Grensevinkelen α_g (grader). */
  alphaDeg: number;
  Gpar: number;
  Gperp: number;
  /** Normalkraften (= G⊥). */
  N: number;
  /** Den største statiske friksjonen μs·N (oppover langs rampa), lik G∥ på grensen. */
  Rmax: number;
}

/** Hele løsningen med uavrundede tall. Visningen runder av; utregningene bruker alltid disse verdiene. */
export function solveRampTask({ m, alphaDeg, muK, muS, L }: RampTask, g = G_EARTH): RampSolution {
  const al = alphaDeg * RAD;
  const G = m * g;
  const Gpar = G * Math.sin(al);
  const Gperp = G * Math.cos(al);
  const N = Gperp;
  const R = muK * N;
  const sumF = Gpar - R;
  const a = sumF / m;
  const v = a > 0 ? Math.sqrt(2 * a * L) : 0;
  const t = a > 0 ? v / a : Infinity;
  const critDeg = criticalAngleDeg(muS);
  const alg = critDeg * RAD;
  const Nlim = G * Math.cos(alg);
  const limit: RampLimit = { alphaDeg: critDeg, Gpar: G * Math.sin(alg), Gperp: Nlim, N: Nlim, Rmax: muS * Nlim };
  return { G, Gpar, Gperp, N, R, sumF, a, v, t, critDeg, limit };
}
