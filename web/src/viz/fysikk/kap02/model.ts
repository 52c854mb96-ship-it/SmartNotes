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

/* ---------- 2D Newtons tredje lov: bok på bord ---------- */

export const EARTH_MASS = 5.97e24;

export interface BookResult {
  /** Tyngden til boka (jorda på boka) = kraften fra boka på jorda. */
  G: number;
  /** Normalkraften fra bordet på boka = kraften fra boka på bordet. */
  N: number;
  /** Akselerasjonen jorda får av G′ (m/s²). */
  earthAccel: number;
}

/** Boka ligger i ro. Hånda dytter eventuelt nedover med `push` (N), så N = G + push. */
export function bookOnTable(m: number, push = 0): BookResult {
  const G = m * G_EARTH;
  return { G, N: G + push, earthAccel: G / EARTH_MASS };
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
  return { G, Gpar, Gperp, N, R, sumF, a, v, t, critDeg: criticalAngleDeg(muS) };
}
