/**
 * Tautrekking og Newtons 3. lov (2B–2E), ren fysikk uten React.
 *
 * To lag drar i hver sin ende av et lett tau. Lag A står til venstre og drar mot venstre, lag B til høyre.
 * Positiv retning er mot høyre (mot lag B) i alt som har fortegn.
 *
 * Kreftene langs bakken:
 * - Tauet drar lag A mot høyre med S og lag B mot venstre med S. Tauet er så lett at kraftsummen på det er null,
 *   så kraften fra lag A på tauet er like stor som kraften fra lag B på tauet (begge er S etter Newtons 3. lov).
 * - Bakken holder igjen med friksjonen R_A (mot venstre) på lag A og R_B (mot høyre) på lag B. Så lenge føttene står
 *   fast, er friksjonen statisk og kan bli høyst R_maks = μs · N = μs · m · g. Når føttene glir, er den μk · m · g.
 *
 * Forløpet (modell):
 * 1. Lagene drar hardere og hardere: S = rate · t. Ingen flytter seg, så R_A = R_B = S og kraftsummen på hvert lag er
 *    null (Newtons 1. lov). Raten er valgt slik at laget med dårligst feste glipper etter `tRise` sekunder.
 * 2. Når S når den minste av de to største friksjonene, glipper det laget (taperen, L). Føttene glir, og friksjonen
 *    faller til glidefriksjonen R_L = μk · m_L · g. Vinnerlaget (W) står støtt (går bakover uten å gli) og presser
 *    stadig hardere mot bakken, R_W = rate · t, men aldri mer enn sin største friksjon μs · m_W · g.
 *    Hele systemet akselererer mot vinneren: a = (R_W − R_L)/(m_A + m_B) (Newtons 2. lov for hele systemet), og
 *    snordraget er S = R_L + m_L · a (2. lov for taperlaget alene).
 * 3. Avspillingen slutter når taperlaget er dratt `sEnd` meter (over midtstreken).
 * Er festet nøyaktig like godt (μs · m like stort), glipper ingen: S stiger til den felles grensen og står der.
 */
import { G_EARTH } from '../../kit/format';

/** Hva lagene står på (og har på beina). */
export type Feste = 'gress' | 'tregulv' | 'is';

export const FESTER: Feste[] = ['gress', 'tregulv', 'is'];

/** Navn til knapper (stor forbokstav bare først). */
export const FESTE_NAVN: Record<Feste, string> = {
  gress: 'Gress',
  tregulv: 'Tregulv',
  is: 'Is',
};

/** Til løpende tekst: «lag A står … ». */
export const FESTE_TEKST: Record<Feste, string> = {
  gress: 'i joggesko på gress',
  tregulv: 'i glatte sko på et tregulv',
  is: 'i vanlige sko på blank is',
};

/**
 * Typiske friksjonstall mellom fottøyet og underlaget, avrundet. Verdiene varierer mye (vått gress, ulike såler,
 * våt eller kald is), så dette er omtrentlige verdier.
 */
export const FESTE_MU: Record<Feste, { muS: number; muK: number }> = {
  gress: { muS: 0.6, muK: 0.45 },
  tregulv: { muS: 0.25, muK: 0.2 },
  is: { muS: 0.1, muK: 0.05 },
};

/** Ett lag: samlet masse (kg) og friksjonstallene mellom føttene og bakken. */
export interface Lag {
  m: number;
  muS: number;
  /** Glidefriksjonstallet (brukes som min(μk, μs)). */
  muK: number;
}

export function lagFor(m: number, feste: Feste): Lag {
  return { m, ...FESTE_MU[feste] };
}

export type Side = 'A' | 'B';

export interface TugPlan {
  /** Normalkraften fra bakken på hvert lag, N = mg (N). */
  NA: number;
  NB: number;
  /** Største statiske friksjon μs · N (N). */
  RmaxA: number;
  RmaxB: number;
  /** Glidefriksjon μk · N (N). */
  RkA: number;
  RkB: number;
  /** Laget med best feste (størst μs · m · g), eller null når festet er like godt. */
  winner: Side | null;
  loser: Side | null;
  /** Hvor fort draget øker (N/s). */
  rate: number;
  /** Når taperlaget begynner å gli (s), eller Infinity ved uavgjort. */
  tSlip: number;
  /** Når vinnerlaget presser så hardt det kan (s), eller Infinity ved uavgjort. */
  tFull: number;
  /** Hvor langt taperlaget dras før det er over streken (m). */
  sEnd: number;
  /** Når avspillingen slutter (s). */
  tEnd: number;
}

export interface TugOptions {
  /** Tiden fram til taperlaget glipper (s). Standard 2,5 s. */
  tRise?: number;
  /** Hvor langt taperlaget dras før det er over streken (m). Standard 1,0 m. */
  sEnd?: number;
  /** Hvor lenge avspillingen står på etter at draget har nådd grensen ved uavgjort (s). Standard 2 s. */
  tHold?: number;
}

const pos = (v: number) => (Number.isFinite(v) && v > 0 ? v : 0);

function limits(L: Lag) {
  const m = pos(L.m);
  const muS = pos(L.muS);
  const muK = Math.min(pos(L.muK), muS);
  const N = m * G_EARTH;
  return { m, N, Rmax: muS * N, Rk: muK * N };
}

/** Bevegelsen etter at taperlaget har glippet: Δt = t − tSlip. Fart og strekning er mot vinneren (positive). */
function slideMotion(plan: Pick<TugPlan, 'rate' | 'tSlip' | 'tFull'>, RL: number, RmaxW: number, M: number, t: number) {
  const { rate, tSlip, tFull } = plan;
  const t1 = Math.min(t, tFull);
  const d1 = Math.max(0, t1 - tSlip);
  // R_W = rate · t: a = (rate · t − R_L)/M øker lineært, så v og s er polynomer i t (eksakt, ingen numerikk).
  let v = ((rate * (t1 * t1 - tSlip * tSlip)) / 2 - RL * d1) / M;
  let s = (rate * ((t1 ** 3 - tSlip ** 3) / 6 - (tSlip * tSlip * d1) / 2) - (RL * d1 * d1) / 2) / M;
  if (t > tFull) {
    const aFull = (RmaxW - RL) / M;
    const d2 = t - tFull;
    s += v * d2 + 0.5 * aFull * d2 * d2;
    v += aFull * d2;
  }
  return { v: Math.max(0, v), s: Math.max(0, s) };
}

/** Planen for hele dragkampen: grensene, hvem som vinner, og når ting skjer. */
export function tugPlan(A: Lag, B: Lag, opts: TugOptions = {}): TugPlan {
  const tRise = opts.tRise ?? 2.5;
  const sEnd = opts.sEnd ?? 1.0;
  const tHold = opts.tHold ?? 2;
  const a = limits(A);
  const b = limits(B);
  const base = { NA: a.N, NB: b.N, RmaxA: a.Rmax, RmaxB: b.Rmax, RkA: a.Rk, RkB: b.Rk, sEnd };
  const scale = Math.max(a.Rmax, b.Rmax);
  const tie = !(scale > 0) || Math.abs(a.Rmax - b.Rmax) <= 1e-9 * scale;
  if (tie) {
    const rate = scale / tRise;
    return { ...base, winner: null, loser: null, rate, tSlip: Infinity, tFull: Infinity, tEnd: tRise + tHold };
  }
  const winner: Side = a.Rmax > b.Rmax ? 'A' : 'B';
  const loser: Side = winner === 'A' ? 'B' : 'A';
  const W = winner === 'A' ? a : b;
  const L = winner === 'A' ? b : a;
  const rate = L.Rmax / tRise;
  const tSlip = tRise;
  const tFull = W.Rmax / rate;
  const M = a.m + b.m;
  const partial = { rate, tSlip, tFull };
  // Strekningen øker hele tiden etter at taperen har glippet (a > 0), så slutten finnes med halvering.
  let hi = tSlip + 1;
  for (let i = 0; i < 60 && slideMotion(partial, L.Rk, W.Rmax, M, hi).s < sEnd; i++) hi = tSlip + (hi - tSlip) * 2;
  let lo = tSlip;
  for (let i = 0; i < 80; i++) {
    const mid = (lo + hi) / 2;
    if (slideMotion(partial, L.Rk, W.Rmax, M, mid).s < sEnd) lo = mid;
    else hi = mid;
  }
  return { ...base, winner, loser, rate, tSlip, tFull, tEnd: hi };
}

export type TugPhase = 'klar' | 'drar' | 'glir' | 'ferdig' | 'uavgjort';

export interface TugState {
  phase: TugPhase;
  /** Tiden (s), klemt til [0, tEnd]. */
  t: number;
  /** Snordraget: kraften fra tauet på hvert lag, og fra hvert lag på tauet (N). */
  S: number;
  /** Friksjonen fra bakken på lag A (mot venstre) og på lag B (mot høyre), som størrelser (N). */
  RA: number;
  RB: number;
  /** Om føttene til laget glir. */
  slidingA: boolean;
  slidingB: boolean;
  /** Kraftsum med fortegn (positiv mot høyre): på lag A, på lag B og på hele systemet (N). */
  netA: number;
  netB: number;
  netSystem: number;
  /** Akselerasjon, fart og forflytning for hele systemet, med fortegn (positiv mot høyre). */
  a: number;
  v: number;
  x: number;
}

/** Tilstanden ved tiden t. */
export function tugState(A: Lag, B: Lag, plan: TugPlan, tIn: number): TugState {
  const t = Math.min(Math.max(0, Number.isFinite(tIn) ? tIn : 0), plan.tEnd);
  const a0 = limits(A);
  const b0 = limits(B);
  const M = a0.m + b0.m;
  const still = (S: number, phase: TugPhase): TugState => ({
    phase,
    t,
    S,
    RA: S,
    RB: S,
    slidingA: false,
    slidingB: false,
    netA: 0,
    netB: 0,
    netSystem: 0,
    a: 0,
    v: 0,
    x: 0,
  });
  if (!(t > 0)) return still(0, 'klar');
  if (plan.winner === null || plan.loser === null) {
    const lim = Math.min(plan.RmaxA, plan.RmaxB);
    const S = Math.min(plan.rate * t, lim);
    return still(S, S >= lim * (1 - 1e-12) && lim > 0 ? 'uavgjort' : 'drar');
  }
  if (t <= plan.tSlip) return still(plan.rate * t, 'drar');

  const winnerIsA = plan.winner === 'A';
  const W = winnerIsA ? a0 : b0;
  const L = winnerIsA ? b0 : a0;
  const RL = L.Rk;
  const RW = Math.min(plan.rate * t, W.Rmax);
  const aMag = M > 0 ? (RW - RL) / M : 0;
  const S = RL + L.m * aMag;
  const { v, s } = slideMotion(plan, RL, W.Rmax, M, t);
  // Systemet beveger seg mot vinneren: mot venstre når lag A vinner.
  const dir = winnerIsA ? -1 : 1;
  const RA = winnerIsA ? RW : RL;
  const RB = winnerIsA ? RL : RW;
  return {
    phase: t >= plan.tEnd - 1e-9 ? 'ferdig' : 'glir',
    t,
    S,
    RA,
    RB,
    slidingA: !winnerIsA,
    slidingB: winnerIsA,
    netA: S - RA,
    netB: RB - S,
    netSystem: RB - RA,
    a: dir * aMag,
    v: dir * v,
    x: dir * s,
  };
}

/**
 * De største verdiene under hele dragkampen (N), så figuren kan velge én kraftskala der alle pilene får plass:
 * snordraget S, den største friksjonen på ett lag R, og den største summen R_A + R_B.
 * Alle er størst enten like før taperen glipper (S = R_A = R_B = R_maks for taperen) eller helt på slutten
 * (R_W og S øker hele tiden mens taperen glir, og R_L er konstant).
 */
export function tugPeaks(A: Lag, B: Lag, plan: TugPlan): { S: number; R: number; Rsum: number } {
  const lim = Math.min(plan.RmaxA, plan.RmaxB);
  if (plan.winner === null) return { S: lim, R: lim, Rsum: 2 * lim };
  const end = tugState(A, B, plan, plan.tEnd);
  return { S: Math.max(lim, end.S), R: Math.max(lim, end.RA, end.RB), Rsum: Math.max(2 * lim, end.RA + end.RB) };
}

/**
 * Hvor mye en person som drar i et vannrett tau, må lene seg bakover for ikke å tippe forover (grader fra loddrett).
 * Om fotsålen: S · h_hender = G · d, der d er hvor langt tyngdepunktet er bak føttene, så tan θ ≈ (S/G) · (h_hender/h_tp).
 * Hendene er omtrent like høyt som tyngdepunktet når man lener seg, så θ ≈ arctan(S/G). Siden S ≤ μs · G, kan man på is
 * nesten ikke lene seg (θ ≤ arctan 0,1 ≈ 6°), mens man på gress kan lene seg ca. 30°.
 */
export function leanAngle(S: number, G: number): number {
  if (!(G > 0) || !(S > 0)) return 0;
  return (Math.atan(S / G) * 180) / Math.PI;
}
