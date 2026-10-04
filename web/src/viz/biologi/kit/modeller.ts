/**
 * Populasjons- og smittemodeller for biologivisualiseringene: ren matematikk uten React, testet i modeller.test.ts.
 *
 * Differensiallikningene løses med Runge–Kutta (RK4) med fast tidssteg, så resultatet er det samme hver gang
 * (tester og skjermbilder). Tid er i den enheten du velger (døgn, timer, år); ratene må ha samme enhet.
 *
 *   const sol = solveOde(logisticDerivs(0.5, 1000), [10], { tMax: 30, dt: 0.1 });
 *   const N = valueAt(sol, 12.3)[0];
 */

/* ---------- RK4 ---------- */

/** Høyresiden i et likningssystem y′ = f(t, y). Returnerer de deriverte i samme rekkefølge som y. */
export type Derivs = (t: number, y: readonly number[]) => number[];

/** Løsning med fast tidssteg: `y[i]` er tilstanden ved `t[i]`. */
export interface OdeSolution {
  t: number[];
  y: number[][];
}

export interface SolveOptions {
  /** Sluttid (starttid er `t0`, standard 0). */
  tMax: number;
  /** Ønsket tidssteg. Justeres litt ned så siste punkt havner nøyaktig på tMax. */
  dt: number;
  t0?: number;
  /** Sett negative verdier til 0 etter hvert steg (populasjoner kan ikke bli negative). */
  nonNegative?: boolean;
  /** Høyeste antall steg (vern mot svært små dt). Standard 100 000. */
  maxSteps?: number;
}

/** Ett RK4-steg fra (t, y) med steglengde h. */
export function rk4Step(f: Derivs, t: number, y: readonly number[], h: number): number[] {
  const k1 = f(t, y);
  const y2 = y.map((v, i) => v + (h / 2) * k1[i]!);
  const k2 = f(t + h / 2, y2);
  const y3 = y.map((v, i) => v + (h / 2) * k2[i]!);
  const k3 = f(t + h / 2, y3);
  const y4 = y.map((v, i) => v + h * k3[i]!);
  const k4 = f(t + h, y4);
  return y.map((v, i) => v + (h / 6) * (k1[i]! + 2 * k2[i]! + 2 * k3[i]! + k4[i]!));
}

/** Løser y′ = f(t, y) fra t0 til tMax med RK4 og fast steg. */
export function solveOde(f: Derivs, y0: readonly number[], { tMax, dt, t0 = 0, nonNegative = false, maxSteps = 100_000 }: SolveOptions): OdeSolution {
  const span = tMax - t0;
  const n = span > 0 && dt > 0 ? Math.min(maxSteps, Math.max(1, Math.ceil(span / dt - 1e-9))) : 0;
  const h = n > 0 ? span / n : 0;
  const t: number[] = [t0];
  const y: number[][] = [[...y0]];
  let cur = [...y0];
  for (let i = 1; i <= n; i++) {
    cur = rk4Step(f, t0 + (i - 1) * h, cur, h);
    if (nonNegative) cur = cur.map((v) => (v < 0 ? 0 : v));
    t.push(t0 + i * h);
    y.push(cur);
  }
  return { t, y };
}

/** Tilstanden ved tiden t (lineær interpolasjon mellom stegene; holdes inne i tidsrommet). */
export function valueAt(sol: OdeSolution, t: number): number[] {
  const { t: ts, y } = sol;
  const n = ts.length;
  if (n === 0) return [];
  const t0 = ts[0]!;
  const t1 = ts[n - 1]!;
  if (!(t > t0) || n === 1) return [...y[0]!];
  if (t >= t1) return [...y[n - 1]!];
  const h = (t1 - t0) / (n - 1);
  const i = Math.min(n - 2, Math.floor((t - t0) / h));
  const u = (t - ts[i]!) / h;
  const a = y[i]!;
  const b = y[i + 1]!;
  return a.map((v, j) => v + (b[j]! - v) * u);
}

/** Én komponent av løsningen som liste, f.eks. `column(sol, 0)` for N. */
export function column(sol: OdeSolution, j: number): number[] {
  return sol.y.map((row) => row[j] ?? Number.NaN);
}

/** Punkter [t, y_j] til `linePath` i kit-et. */
export function points(sol: OdeSolution, j: number, scale = 1): [number, number][] {
  return sol.t.map((t, i) => [t, (sol.y[i]![j] ?? Number.NaN) * scale]);
}

/* ---------- Eksponentiell og logistisk vekst ---------- */

/** Eksponentiell vekst dN/dt = rN, analytisk: N = N₀ · e^(rt). */
export function exponential(N0: number, r: number, t: number): number {
  return N0 * Math.exp(r * t);
}

export const exponentialDerivs =
  (r: number): Derivs =>
  (_t, [N]) => [r * N!];

/** Doblingstid for eksponentiell vekst med vekstrate r: ln 2 / r. */
export function doublingTime(r: number): number {
  return r > 0 ? Math.LN2 / r : Number.POSITIVE_INFINITY;
}

/** Logistisk vekst dN/dt = rN(1 − N/K), analytisk: N = K / (1 + ((K − N₀)/N₀) · e^(−rt)). */
export function logistic(N0: number, r: number, K: number, t: number): number {
  if (N0 <= 0) return 0;
  return K / (1 + ((K - N0) / N0) * Math.exp(-r * t));
}

/** Tilveksten i logistisk vekst ved bestanden N: rN(1 − N/K). Størst ved N = K/2. */
export function logisticRate(N: number, r: number, K: number): number {
  return r * N * (1 - N / K);
}

export const logisticDerivs =
  (r: number, K: number): Derivs =>
  (_t, [N]) => [logisticRate(N!, r, K)];

/* ---------- Høsting (fangst, fiske, jakt) ---------- */

/**
 * Høsting fra en bestand med logistisk vekst:
 * - `kvote`: fast mengde H per tidsenhet (uansett hvor stor bestanden er), dN/dt = rN(1 − N/K) − H
 * - `andel`: fast andel h av bestanden per tidsenhet, dN/dt = rN(1 − N/K) − hN
 */
export type Harvest = { kind: 'ingen' } | { kind: 'kvote'; H: number } | { kind: 'andel'; h: number };

/** Hvor mye som faktisk høstes per tidsenhet ved bestanden N (ingenting når bestanden er borte). */
export function harvestRate(N: number, harvest: Harvest): number {
  if (N <= 0) return 0;
  if (harvest.kind === 'kvote') return Math.max(0, harvest.H);
  if (harvest.kind === 'andel') return Math.max(0, harvest.h) * N;
  return 0;
}

export const harvestDerivs =
  (r: number, K: number, harvest: Harvest): Derivs =>
  (_t, [N]) => {
    const n = N!;
    if (n <= 0) return [0];
    return [logisticRate(n, r, K) - harvestRate(n, harvest)];
  };

/** Logistisk vekst med høsting fra N₀ (bestanden kan ikke bli negativ). Kolonne 0 er N. */
export function solveHarvest(N0: number, r: number, K: number, harvest: Harvest, opts: SolveOptions): OdeSolution {
  return solveOde(harvestDerivs(r, K, harvest), [N0], { ...opts, nonNegative: true });
}

/**
 * Maksimalt bærekraftig utbytte (MSY): tilveksten rN(1 − N/K) er størst ved N = K/2, og da er den rK/4.
 * Med fast andel oppnås det med h = r/2.
 */
export function msy(r: number, K: number): { N: number; yield: number; rate: number } {
  return { N: K / 2, yield: (r * K) / 4, rate: r / 2 };
}

/**
 * Likevektene med fast kvote H: N = K/2 · (1 ± √(1 − 4H/(rK))). Den nederste er ustabil (under den dør bestanden ut),
 * den øverste stabil. Tom liste når H > rK/4: da går bestanden alltid mot null.
 */
export function quotaEquilibria(r: number, K: number, H: number): number[] {
  const disc = 1 - (4 * H) / (r * K);
  if (!(r > 0 && K > 0) || disc < 0) return [];
  if (H <= 0) return [0, K];
  const s = Math.sqrt(disc);
  return s === 0 ? [K / 2] : [(K / 2) * (1 - s), (K / 2) * (1 + s)];
}

/** Stabil likevekt med fast andel h: N* = K(1 − h/r), og utbyttet blir hN*. Bestanden dør ut når h ≥ r. */
export function proportionalEquilibrium(r: number, K: number, h: number): { N: number; yield: number } {
  const N = h < r ? K * (1 - h / r) : 0;
  return { N, yield: h * N };
}

/* ---------- Rovdyr og byttedyr (Lotka–Volterra) ---------- */

/**
 * dB/dt = aB − bBR (byttedyr), dR/dt = dBR − cR (rovdyr).
 * a: byttedyrenes vekstrate uten rovdyr, b: hvor effektivt rovdyrene fanger, c: rovdyrenes dødsrate uten mat,
 * d: hvor godt fangst blir til nye rovdyr.
 */
export interface LotkaVolterraParams {
  a: number;
  b: number;
  c: number;
  d: number;
}

/** Tilstanden er [byttedyr, rovdyr]. */
export const lotkaVolterraDerivs =
  ({ a, b, c, d }: LotkaVolterraParams): Derivs =>
  (_t, [B, R]) => [a * B! - b * B! * R!, d * B! * R! - c * R!];

export function solveLotkaVolterra(p: LotkaVolterraParams, prey0: number, predators0: number, opts: SolveOptions): OdeSolution {
  return solveOde(lotkaVolterraDerivs(p), [prey0, predators0], { ...opts, nonNegative: true });
}

/** Likevektspunktet (B*, R*) = (c/d, a/b), som bestandene svinger rundt. */
export function lotkaVolterraEquilibrium({ a, b, c, d }: LotkaVolterraParams): { prey: number; predators: number } {
  return { prey: c / d, predators: a / b };
}

/** Bevart størrelse V = dB − c·ln B + bR − a·ln R. Konstant langs en løsning (lukkede baner). */
export function lotkaVolterraInvariant({ a, b, c, d }: LotkaVolterraParams, prey: number, predators: number): number {
  return d * prey - c * Math.log(prey) + b * predators - a * Math.log(predators);
}

/* ---------- Smitte: SIR-modellen med vaksinasjon ---------- */

export interface SirParams {
  /** Basisreproduksjonstallet R₀: hvor mange en smittet smitter i en befolkning der alle er mottakelige. */
  R0: number;
  /** Hvor lenge en smittet er smittsom i gjennomsnitt (D = 1/γ), i tidsenheten du bruker (f.eks. døgn). */
  D: number;
  /** Andel smittet ved start (standard 0,001). */
  I0?: number;
  /** Vaksinasjonsdekning p (andel vaksinert, 0–1). Standard 0. */
  p?: number;
  /** Vaksinens effekt e (andel av de vaksinerte som blir immune, 0–1). Standard 1. */
  e?: number;
}

/** Andeler av befolkningen over tid: S + I + R + V = 1. */
export interface SirSeries {
  t: number[];
  /** Mottakelige (kan bli smittet). */
  S: number[];
  /** Smittet og smittsomme. */
  I: number[];
  /** Immune etter å ha vært syke (eller døde). */
  R: number[];
  /** Immune etter vaksine (konstant). */
  V: number;
  sol: OdeSolution;
}

/** dS/dt = −βSI, dI/dt = βSI − γI, dR/dt = γI (andeler, N = 1). Tilstanden er [S, I, R]. */
export const sirDerivs =
  (beta: number, gamma: number): Derivs =>
  (_t, [S, I]) => {
    const inf = beta * S! * I!;
    const rec = gamma * I!;
    return [-inf, inf - rec, rec];
  };

/** Startverdiene: V = p·e er immune, I₀ er smittet, resten mottakelige. */
export function sirStart({ I0 = 0.001, p = 0, e = 1 }: Pick<SirParams, 'I0' | 'p' | 'e'>): { S: number; I: number; R: number; V: number } {
  const V = clamp01(p) * clamp01(e);
  const I = Math.min(clamp01(I0), 1 - V);
  return { S: Math.max(0, 1 - V - I), I, R: 0, V };
}

export function solveSir(params: SirParams, opts: SolveOptions): SirSeries {
  const gamma = 1 / params.D;
  const beta = params.R0 * gamma;
  const s = sirStart(params);
  const sol = solveOde(sirDerivs(beta, gamma), [s.S, s.I, s.R], { ...opts, nonNegative: true });
  return { t: sol.t, S: column(sol, 0), I: column(sol, 1), R: column(sol, 2), V: s.V, sol };
}

/** Flokkimmunitetsgrensen p_c = 1 − 1/R₀ (andelen som må være immune). 0 når R₀ ≤ 1. */
export function herdImmunityThreshold(R0: number): number {
  return R0 > 1 ? 1 - 1 / R0 : 0;
}

/** Vaksinasjonsdekningen som trengs med en vaksine med effekt e: p_c / e. Kan bli over 1 (umulig å nå). */
export function requiredCoverage(R0: number, e = 1): number {
  const pc = herdImmunityThreshold(R0);
  return pc === 0 ? 0 : e > 0 ? pc / e : Number.POSITIVE_INFINITY;
}

/** Det effektive reproduksjonstallet R = R₀ · S (S = andel mottakelige). Smitten øker bare når R > 1. */
export function effectiveR(R0: number, S: number): number {
  return R0 * S;
}

/**
 * Sluttstørrelsen: andelen av hele befolkningen som blir smittet i løpet av epidemien når den starter med svært få
 * smittede og andelen s₀ mottakelige. Løser ln(s₀/s∞) = R₀ · (s₀ − s∞) og gir s₀ − s∞ (0 når R₀ · s₀ ≤ 1).
 */
export function finalSize(R0: number, s0 = 1): number {
  if (!(s0 > 0) || !(R0 * s0 > 1)) return 0;
  // Roten ligger mellom 0 og 1/R₀ (< s₀). f er positiv nær 0 og negativ i 1/R₀.
  const f = (s: number) => Math.log(s0 / s) - R0 * (s0 - s);
  let lo = Number.MIN_VALUE;
  let hi = 1 / R0;
  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2;
    if (f(mid) > 0) lo = mid;
    else hi = mid;
  }
  return s0 - (lo + hi) / 2;
}

/** Toppen av epidemien og hvor mange som ble smittet til sammen (andeler av befolkningen). */
export function sirStats(s: SirSeries): { peak: number; peakTime: number; totalInfected: number } {
  let peak = -1;
  let peakTime = 0;
  s.I.forEach((v, i) => {
    if (v > peak) {
      peak = v;
      peakTime = s.t[i]!;
    }
  });
  const last = s.I.length - 1;
  // Alle som har vært smittet: de som er smittet nå + de som er blitt friske
  const totalInfected = last >= 0 ? s.I[last]! + s.R[last]! : 0;
  return { peak: Math.max(0, peak), peakTime, totalInfected };
}

/* ---------- Bakterievekst ---------- */

export type GrowthPhase = 'lag' | 'log' | 'stasjonaer' | 'dod';

/** Navnene på vekstfasene slik lærebøkene skriver dem. */
export const GROWTH_PHASE_NAMES: Record<GrowthPhase, string> = {
  lag: 'lagfase',
  log: 'eksponentiell fase',
  stasjonaer: 'stasjonær fase',
  dod: 'dødsfase',
};

export interface BacterialGrowthParams {
  /** Antall bakterier ved start. */
  N0: number;
  /** Lengden av lagfasen (bakteriene tilpasser seg, deler seg ikke ennå). */
  lag: number;
  /** Generasjonstida g: tida det tar for bestanden å dobles i den eksponentielle fasen. */
  g: number;
  /** Det største antallet næringen og plassen gir rom for. */
  Nmax: number;
  /** Hvor lenge den stasjonære fasen varer (like mange deler seg som dør). */
  stationary: number;
  /** Halveringstida i dødsfasen. */
  deathHalfLife: number;
}

/** Når fasene slutter: lagfasen ved `lag`, den eksponentielle ved `log`, den stasjonære ved `stationary`. */
export function growthPhaseEnds(p: BacterialGrowthParams): { lag: number; log: number; stationary: number } {
  const lag = Math.max(0, p.lag);
  const log = lag + (p.Nmax > p.N0 && p.g > 0 ? p.g * Math.log2(p.Nmax / p.N0) : 0);
  return { lag, log, stationary: log + Math.max(0, p.stationary) };
}

/**
 * Antall bakterier ved tiden t, stykkevis: konstant i lagfasen, N₀ · 2^((t − lag)/g) i den eksponentielle fasen,
 * Nmax i den stasjonære fasen og Nmax · (1/2)^((t − t_d)/T½) i dødsfasen.
 */
export function bacterialGrowth(p: BacterialGrowthParams, t: number): number {
  const e = growthPhaseEnds(p);
  if (t <= e.lag) return p.N0;
  if (t <= e.log) return Math.min(p.Nmax, p.N0 * 2 ** ((t - e.lag) / p.g));
  if (t <= e.stationary) return Math.max(p.N0, p.Nmax);
  return Math.max(p.N0, p.Nmax) * 0.5 ** ((t - e.stationary) / p.deathHalfLife);
}

export function growthPhase(p: BacterialGrowthParams, t: number): GrowthPhase {
  const e = growthPhaseEnds(p);
  if (t < e.lag) return 'lag';
  if (t < e.log) return 'log';
  if (t < e.stationary) return 'stasjonaer';
  return 'dod';
}

/* ---------- Generasjonstid ---------- */

/** Antall etter tida t med generasjonstid g: N = N₀ · 2^(t/g). */
export function countAfter(N0: number, t: number, g: number): number {
  return N0 * 2 ** (t / g);
}

/** Antall generasjoner (delinger) på tida t: t/g. */
export function generations(t: number, g: number): number {
  return t / g;
}

/** Generasjonstida når bestanden har vokst fra N₀ til N på tida t: g = t / log₂(N/N₀). */
export function generationTime(N0: number, N: number, t: number): number {
  return t / Math.log2(N / N0);
}

/** Tida det tar å vokse fra N₀ til N med generasjonstid g: t = g · log₂(N/N₀). */
export function timeToReach(N0: number, N: number, g: number): number {
  return g * Math.log2(N / N0);
}

/** Vekstraten r i N = N₀ · e^(rt) som svarer til generasjonstida g: r = ln 2 / g. */
export function rateFromGenerationTime(g: number): number {
  return Math.LN2 / g;
}

function clamp01(v: number): number {
  return Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0;
}
