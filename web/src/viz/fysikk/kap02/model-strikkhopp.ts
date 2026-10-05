/**
 * Strikkhopp fra en bro (2E, 2F): ren fysikk uten React, så den kan testes for seg.
 *
 * Modell: hopperen er et punkt i enden av strikken og slipper seg fra ro der strikken er festet. Strikken drar bare
 * når den er strukket, med S = k · Δx (Hookes lov), der Δx = s − L₀ er forlengelsen. Vi ser bort fra luftmotstand,
 * massen til strikken og energitap i strikken.
 *
 * Internt regnes strekningen s og farten nedover (positiv nedover, fra festet på brua). Utad er h, v og a positive
 * oppover, så stigningstallet i h-grafen er v og stigningstallet i v-grafen er a.
 *
 * Bevegelsen har to faser:
 * - fritt fall (s ≤ L₀): s = ½gt², farten nedover er gt;
 * - strikken er strukket (s > L₀): Newtons 2. lov gir m · s″ = mg − k(s − L₀). Med u = s − s₀ (s₀ = L₀ + mg/k er
 *   likevektspunktet) blir u″ = −(k/m) · u, med løsningen u = A · sin(ωτ − α), der ω = √(k/m) og τ er tiden siden
 *   strikken ble stram.
 * Uten energitap er bevegelsen periodisk: hopperen kommer helt opp til brua igjen og faller på nytt.
 */
import { G_EARTH } from '../../kit/format';

/** Høyden fra festet på brua ned til vannet (m). */
export const BRIDGE_HEIGHT = 80;
/** Fra festet ved anklene til toppen av hodet når hopperen henger med hodet ned (m), til avstanden til vannet. */
export const BODY_LENGTH = 1.7;

/** Glidebryterne: masse, strikklengde og stivhet. */
export const BUNGEE_RANGES = {
  m: { min: 40, max: 120, step: 1, start: 70 },
  L0: { min: 10, max: 25, step: 1, start: 20 },
  k: { min: 80, max: 250, step: 5, start: 120 },
} as const;

export interface BungeeParams {
  /** Massen til hopperen (kg). */
  m: number;
  /** Lengden på strikken uten strekk (m). */
  L0: number;
  /** Stivheten til strikken (N/m). */
  k: number;
}

export type BungeePhase = 'fritt-fall-ned' | 'strukket-ned' | 'strukket-opp' | 'fritt-fall-opp';

export interface BungeeState {
  t: number;
  /** Hvor langt under festet hopperen er (m). */
  s: number;
  /** Høyde over vannet (m). */
  h: number;
  /** Fart (m/s), positiv oppover. */
  v: number;
  /** Akselerasjon (m/s²), positiv oppover. */
  a: number;
  /** Forlengelsen av strikken Δx = s − L₀ (m), 0 når strikken er slakk. */
  dx: number;
  /** Strikkraften S = k · Δx (N), oppover. */
  S: number;
  /** Tyngden G = mg (N), nedover. */
  G: number;
  /** Kraftsummen ΣF = S − G (N), positiv oppover. */
  sumF: number;
  phase: BungeePhase;
}

export interface BungeeKeyPoints {
  /** Tyngden G = mg (N). */
  G: number;
  /** Forlengelsen i likevektspunktet, der S = G: Δx₀ = mg/k (m). */
  dEq: number;
  /** Vinkelfrekvensen ω = √(k/m) (1/s) i strekkfasen. */
  omega: number;
  /** Når strikken strammes (s) og farten da (m/s, nedover): t = √(2L₀/g), v = √(2gL₀). */
  tTaut: number;
  vTaut: number;
  /** Likevektspunktet s₀ = L₀ + mg/k (m under festet). Her er ΣF = 0 og farten størst. */
  sEq: number;
  /** Når farten er størst (s) og den største farten (m/s): v = √(2gL₀ + g · mg/k). */
  tVmax: number;
  vMax: number;
  /** Det laveste punktet (m under festet) og når hopperen er der (s). */
  sMax: number;
  tBottom: number;
  /** Den største forlengelsen Δx = s_maks − L₀ (m). */
  dxMax: number;
  /** Den største strikkraften (N) og akselerasjonen (m/s², oppover) i det laveste punktet. */
  SMax: number;
  aMax: number;
  /** Laveste punkt over vannet (m), og avstanden fra hodet til vannet der (m). */
  hMin: number;
  headClearance: number;
  /** Når strikken blir slakk igjen på vei opp (s). Visualiseringen viser bevegelsen fra 0 til hit. */
  tEnd: number;
  /** Perioden for hele bevegelsen uten energitap (s): opp til brua igjen. */
  period: number;
  /** Amplituden A i strekkfasen (m): s_maks = s₀ + A. */
  amp: number;
}

/** Nøkkeltallene for hoppet, regnet ut eksakt (se toppen av fila). */
export function bungeeKeyPoints({ m, L0, k }: BungeeParams, g = G_EARTH): BungeeKeyPoints {
  const G = m * g;
  const dEq = G / k;
  const omega = Math.sqrt(k / m);
  const tTaut = Math.sqrt((2 * L0) / g);
  const vTaut = Math.sqrt(2 * g * L0);
  // u(τ) = −dEq · cos ωτ + (vTaut/ω) · sin ωτ = A · sin(ωτ − α)
  const amp = Math.hypot(dEq, vTaut / omega);
  const alpha = Math.atan2(dEq, vTaut / omega);
  const sEq = L0 + dEq;
  const sMax = sEq + amp;
  const tVmax = tTaut + alpha / omega;
  const tBottom = tTaut + (Math.PI / 2 + alpha) / omega;
  const tEnd = tTaut + (Math.PI + 2 * alpha) / omega;
  const dxMax = sMax - L0;
  return {
    G,
    dEq,
    omega,
    tTaut,
    vTaut,
    sEq,
    tVmax,
    vMax: amp * omega,
    sMax,
    tBottom,
    dxMax,
    SMax: k * dxMax,
    aMax: omega * omega * amp,
    hMin: BRIDGE_HEIGHT - sMax,
    headClearance: BRIDGE_HEIGHT - sMax - BODY_LENGTH,
    tEnd,
    period: tEnd + tTaut,
    amp,
  };
}

/** Tilstanden ved tiden t (eksakt løsning; periodisk uten energitap). */
export function bungeeState(p: BungeeParams, t: number, key: BungeeKeyPoints = bungeeKeyPoints(p), g = G_EARTH): BungeeState {
  const { m, L0, k } = p;
  const G = key.G;
  const T = key.period;
  const tt = T > 0 && Number.isFinite(t) ? ((t % T) + T) % T : 0;
  let s: number;
  let wDown: number;
  let phase: BungeePhase;
  if (tt <= key.tTaut) {
    s = 0.5 * g * tt * tt;
    wDown = g * tt;
    phase = 'fritt-fall-ned';
  } else if (tt <= key.tEnd) {
    const tau = tt - key.tTaut;
    const th = key.omega * tau - Math.atan2(key.dEq, key.vTaut / key.omega);
    s = key.sEq + key.amp * Math.sin(th);
    wDown = key.amp * key.omega * Math.cos(th);
    phase = tt <= key.tBottom ? 'strukket-ned' : 'strukket-opp';
  } else {
    // Fritt fall oppover fra s = L₀ med farten vTaut oppover, til toppen ved t = T.
    const tau = tt - key.tEnd;
    s = L0 - key.vTaut * tau + 0.5 * g * tau * tau;
    wDown = -key.vTaut + g * tau;
    phase = 'fritt-fall-opp';
  }
  const dx = Math.max(0, s - L0);
  const S = k * dx;
  const sumF = S - G;
  return { t, s, h: BRIDGE_HEIGHT - s, v: -wDown, a: sumF / m, dx, S, G, sumF, phase };
}

/**
 * Bevegelsen regnet ut i små tidssteg (2F), med Euler–Cromer: a = (S − G)/m, v_ny = v + a · Δt, s_ny = s + v_ny · Δt.
 * Gir punktene [t, s, v, a] (positiv nedover for s, oppover for v og a, som i bungeeState). Brukes i testene for å
 * vise at den eksakte løsningen stemmer med Newtons 2. lov.
 */
export function simulateBungee(p: BungeeParams, dt: number, tEnd: number, g = G_EARTH): [number, number, number, number][] {
  const { m, L0, k } = p;
  const out: [number, number, number, number][] = [];
  let s = 0;
  let wDown = 0;
  const n = Math.round(tEnd / dt);
  const accDown = (sv: number) => g - (k * Math.max(0, sv - L0)) / m;
  out.push([0, s, -wDown, -accDown(s)]);
  for (let i = 1; i <= n; i++) {
    wDown += accDown(s) * dt;
    s += wDown * dt;
    out.push([i * dt, s, -wDown, -accDown(s)]);
  }
  return out;
}

/** Øyeblikkene eleven kan hoppe til. */
export type BungeeMoment = 'stram' | 'vmaks' | 'bunn';

export function momentTime(key: BungeeKeyPoints, moment: BungeeMoment): number {
  return moment === 'stram' ? key.tTaut : moment === 'vmaks' ? key.tVmax : key.tBottom;
}

/** Hvor mange ganger tyngdeakselerasjonen: 27,7 m/s² → 2,8 «g». */
export function inG(a: number, g = G_EARTH): number {
  return a / g;
}
