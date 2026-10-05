/**
 * Forvaltning av naturressurser (Bi 1 kapittel 4, KM1, KM10, KM11): ren modell uten React, testet i model.test.ts.
 *
 * 1. Bærekraftig høsting: logistisk vekst med fast kvote eller fast andel (kit/modeller.ts), med en føre-var-regel
 *    (fiskestopp) som i forvaltningen av norsk vårgytende sild etter kollapsen rundt 1970.
 * 2. Fangst–gjenfangst: Lincoln–Petersen-estimatet N ≈ M · C / R i en dam med fisk plassert med fast frø, den
 *    hypergeometriske fordelingen av R og hva som skjer når forutsetningene ikke holder.
 * 3. Klima og utbredelse: en arts klimasone langs en temperaturgradient (høyde over havet eller breddegrad) og hvor
 *    mye areal som er igjen når klimaet blir varmere.
 */
import { harvestRate, logisticRate, msy, niceTicks, proportionalEquilibrium, quotaEquilibria, rk4Step, seededRandom, type Harvest } from '../kit';

/* ====================================================================== */
/* 1. Bærekraftig høsting                                                   */
/* ====================================================================== */

/**
 * Eksempelet i visualiseringen er norsk vårgytende sild, forenklet og bare kvalitativt riktig:
 * - Gytebestanden var på over 10 millioner tonn på 1950-tallet. Med ny teknikk (kraftblokk, ringnot og ekkolodd) økte
 *   fangstene til nesten 2 millioner tonn i året midt på 1960-tallet, og bestanden kollapset rundt 1970 (ICES).
 * - Etter nesten fiskestopp fra 1970-tallet og streng regulering bygde bestanden seg sakte opp igjen og var stor
 *   igjen på 1990- og 2000-tallet.
 * r = 0,5 per år og K = 12 millioner tonn gir MSY = rK/4 = 1,5 millioner tonn per år, så en kvote på 2 millioner tonn
 * er mer enn bestanden tåler. Tallene er valgt for å vise mekanismen, ikke som en bestandsberegning.
 */
export const SILD = { r: 0.5, K: 12 } as const;

/** Hvor lenge vi følger bestanden (år). */
export const HARVEST_YEARS = 40;
/** Tidssteg i simuleringen (år). */
const HARVEST_DT = 0.05;
/** Føre-var-regel: fiskestopp når bestanden er under 20 % av K … */
export const STOP_BELOW = 0.2;
/** … og fisket åpner igjen først når bestanden er over halvparten av K. */
export const REOPEN_ABOVE = 0.5;
/** Bestanden regnes som kollapset under 5 % av K (kommersielt utfisket). */
export const COLLAPSE_BELOW = 0.05;

export type HarvestMode = 'kvote' | 'andel';

export interface HarvestParams {
  /** Vekstrate r (per år). */
  r: number;
  /** Bæreevne K (millioner tonn). */
  K: number;
  mode: HarvestMode;
  /** Fast kvote H (millioner tonn per år). */
  H: number;
  /** Fast andel h av bestanden per år (0–1). */
  h: number;
  /** Føre-var-regel: fiskestopp under STOP_BELOW · K til bestanden er over REOPEN_ABOVE · K igjen. */
  moratorium: boolean;
  /** Bestanden når fisket starter (standard K, en urørt bestand). */
  N0?: number;
  years?: number;
}

export interface HarvestRun {
  t: number[];
  /** Bestanden (millioner tonn). */
  N: number[];
  /** Fangst per år akkurat da (millioner tonn per år). */
  catchRate: number[];
  /** Samlet fangst fram til t (millioner tonn). */
  cumulative: number[];
  /** Fiskestopp akkurat da. */
  closed: boolean[];
  /** Første tidspunkt bestanden var under COLLAPSE_BELOW · K, ellers null. */
  collapseTime: number | null;
}

/** Høstingen som kit-ets modeller forstår. */
export function toHarvest(p: Pick<HarvestParams, 'mode' | 'H' | 'h'>): Harvest {
  return p.mode === 'kvote' ? { kind: 'kvote', H: p.H } : { kind: 'andel', h: p.h };
}

/**
 * Logistisk vekst med høsting, dN/dt = rN(1 − N/K) − fangst, løst med RK4 og fast steg. Fiskestoppen sjekkes ved
 * starten av hvert steg (som et vedtak for neste periode), så modellen er deterministisk og kan testes.
 */
export function simulateHarvest(p: HarvestParams): HarvestRun {
  const years = p.years ?? HARVEST_YEARS;
  const n = Math.round(years / HARVEST_DT);
  const dt = years / n;
  const harvest = toHarvest(p);
  const t: number[] = [];
  const N: number[] = [];
  const catchRate: number[] = [];
  const cumulative: number[] = [];
  const closedArr: boolean[] = [];
  let cur = Math.max(0, p.N0 ?? p.K);
  let closed = false;
  let total = 0;
  let collapseTime: number | null = null;
  for (let i = 0; i <= n; i++) {
    const ti = i * dt;
    if (p.moratorium) {
      if (!closed && cur < STOP_BELOW * p.K) closed = true;
      else if (closed && cur >= REOPEN_ABOVE * p.K) closed = false;
    }
    const rate = closed ? 0 : harvestRate(cur, harvest);
    t.push(ti);
    N.push(cur);
    catchRate.push(rate);
    closedArr.push(closed);
    cumulative.push(total);
    if (collapseTime === null && cur < COLLAPSE_BELOW * p.K) collapseTime = ti;
    if (i === n) break;
    const before = cur;
    const derivs = (_t: number, [x]: readonly number[]) => {
      const v = Math.max(0, x!);
      return [v <= 0 ? 0 : logisticRate(v, p.r, p.K) - (closed ? 0 : harvestRate(v, harvest))];
    };
    cur = Math.max(0, rk4Step(derivs, ti, [cur], dt)[0]!);
    // Fangsten i steget: det bestanden mistet utover veksten (trapes for veksten), aldri mer enn det som fantes
    const growth = ((logisticRate(before, p.r, p.K) + logisticRate(cur, p.r, p.K)) / 2) * dt;
    const caught = closed ? 0 : Math.min(before + Math.max(0, growth), Math.max(0, before + growth - cur));
    total += caught;
  }
  return { t, N, catchRate, cumulative, closed: closedArr, collapseTime };
}

/** Verdien i en kjøring ved tiden t (nærmeste steg). */
export function runAt<T>(run: HarvestRun, arr: readonly T[], t: number): T {
  const last = run.t.length - 1;
  const span = run.t[last]! - run.t[0]!;
  const i = span > 0 ? Math.min(last, Math.max(0, Math.round((t / span) * last))) : 0;
  return arr[i]!;
}

export type HarvestOutcome = 'urort' | 'baerekraftig' | 'msy' | 'kollaps' | 'fiskestopp';

export interface HarvestAnalysis {
  outcome: HarvestOutcome;
  /** Maksimalt bærekraftig utbytte rK/4 (millioner tonn per år) ved N = K/2. */
  msy: number;
  /** Stabil likevekt (bestanden den går mot), eller 0 når den går mot null. */
  equilibrium: number;
  /** Fangsten per år i likevekt (0 når bestanden kollapser). */
  equilibriumYield: number;
  /** Ustabil likevekt med fast kvote (under den kollapser bestanden), ellers null. */
  unstable: number | null;
  /** Høstingen er større enn det bestanden tåler på lang sikt (kvote > MSY eller andel ≥ r). */
  overMsy: boolean;
  /** Fast andel høyere enn r/2: bærekraftig, men mindre bestand og mindre fangst enn ved MSY. */
  overfished: boolean;
}

/** Hvordan det går på lang sikt med denne høstingen, ut fra likevektene (ikke simuleringen). */
export function analyseHarvest(p: HarvestParams): HarvestAnalysis {
  const m = msy(p.r, p.K);
  const tol = 1e-6 * Math.max(1, m.yield);
  if (p.mode === 'kvote') {
    const eq = quotaEquilibria(p.r, p.K, p.H);
    if (p.H <= 0) return { outcome: 'urort', msy: m.yield, equilibrium: p.K, equilibriumYield: 0, unstable: null, overMsy: false, overfished: false };
    if (Math.abs(p.H - m.yield) <= Math.max(tol, 0.005 * m.yield))
      return { outcome: 'msy', msy: m.yield, equilibrium: m.N, equilibriumYield: p.H, unstable: m.N, overMsy: false, overfished: false };
    if (eq.length === 2)
      return {
        outcome: 'baerekraftig',
        msy: m.yield,
        equilibrium: eq[1]!,
        equilibriumYield: p.H,
        unstable: eq[0]!,
        overMsy: false,
        overfished: false,
      };
    return {
      outcome: p.moratorium ? 'fiskestopp' : 'kollaps',
      msy: m.yield,
      equilibrium: 0,
      equilibriumYield: 0,
      unstable: null,
      overMsy: true,
      overfished: true,
    };
  }
  if (p.h <= 0) return { outcome: 'urort', msy: m.yield, equilibrium: p.K, equilibriumYield: 0, unstable: null, overMsy: false, overfished: false };
  const eq = proportionalEquilibrium(p.r, p.K, p.h);
  if (p.h >= p.r)
    return {
      outcome: p.moratorium ? 'fiskestopp' : 'kollaps',
      msy: m.yield,
      equilibrium: 0,
      equilibriumYield: 0,
      unstable: null,
      overMsy: true,
      overfished: true,
    };
  const atMsy = Math.abs(p.h - m.rate) <= 0.01 * p.r;
  return {
    outcome: atMsy ? 'msy' : 'baerekraftig',
    msy: m.yield,
    equilibrium: eq.N,
    equilibriumYield: eq.yield,
    unstable: null,
    overMsy: false,
    overfished: !atMsy && p.h > m.rate,
  };
}

/* ====================================================================== */
/* 2. Fangst–gjenfangst                                                     */
/* ====================================================================== */

/**
 * Lincoln–Petersen: andelen merkede i gjenfangsten (R/C) antas å være lik andelen merkede i hele bestanden (M/N), så
 * N ≈ M · C / R. Ingen gjenfangede merkede (R = 0) gir ikke noe estimat (null).
 */
export function lincolnPetersen(M: number, C: number, R: number): number | null {
  return R > 0 ? (M * C) / R : null;
}

/** Chapmans korrigerte estimat (N + 1)…: (M + 1)(C + 1)/(R + 1) − 1. Nesten forventningsrett, og virker også når R = 0. */
export function chapman(M: number, C: number, R: number): number {
  return ((M + 1) * (C + 1)) / (R + 1) - 1;
}

/** Forventet antall merkede i gjenfangsten når alle forutsetningene holder: C · M/N. */
export function expectedRecaptures(N: number, M: number, C: number): number {
  return N > 0 ? (C * M) / N : 0;
}

const logFactCache: number[] = [0];
function logFactorial(n: number): number {
  for (let i = logFactCache.length; i <= n; i++) logFactCache.push(logFactCache[i - 1]! + Math.log(i));
  return logFactCache[n]!;
}
function logChoose(n: number, k: number): number {
  if (k < 0 || k > n) return Number.NEGATIVE_INFINITY;
  return logFactorial(n) - logFactorial(k) - logFactorial(n - k);
}

/**
 * Sannsynligheten for å få akkurat r merkede når C fisk fanges tilfeldig fra N, der M er merket (hypergeometrisk
 * fordeling): C(M, r) · C(N − M, C − r) / C(N, C).
 */
export function hypergeometric(N: number, M: number, C: number, r: number): number {
  if (!(N > 0) || M > N || C > N || r < 0) return 0;
  const lp = logChoose(M, r) + logChoose(N - M, C - r) - logChoose(N, C);
  return Number.isFinite(lp) ? Math.exp(lp) : 0;
}

export type McScenario = 'ideell' | 'ikkeBlandet' | 'merkeTap' | 'fellelyst';

/**
 * Forutsetningene for metoden, og hva som skjer når én av dem ikke holder:
 * - ikkeBlandet: de merkede har ikke spredt seg i dammen, så de blir sjeldnere fanget (vekt 0,3) → R for liten.
 * - merkeTap: 40 % av merkene har falt av før gjenfangsten → R for liten.
 * - fellelyst: merkede fisk har lært at fella har mat og går dobbelt så lett i den (vekt 2) → R for stor.
 */
export const SCENARIOS: Record<McScenario, { label: string; weight: number; retention: number }> = {
  ideell: { label: 'Ingen feilkilder', weight: 1, retention: 1 },
  ikkeBlandet: { label: 'Dårlig blanding', weight: 0.3, retention: 1 },
  merkeTap: { label: 'Merker faller av', weight: 1, retention: 0.6 },
  fellelyst: { label: 'Merkede fanges lettere', weight: 2, retention: 1 },
};

/**
 * Fordelingen av R (antall merkede i gjenfangsten) over mange forsøk: eksakt hypergeometrisk når forutsetningene
 * holder, binomisk tynnet når merker faller av, og ellers simulert (6000 forsøk med fast frø) med vektet trekning
 * uten tilbakelegging. Indeks r i lista er P(R = r).
 */
export function recaptureDistribution(N: number, M: number, C: number, scenario: McScenario = 'ideell'): number[] {
  const maxR = Math.min(M, C);
  const hyp = Array.from({ length: maxR + 1 }, (_, r) => hypergeometric(N, M, C, r));
  const s = SCENARIOS[scenario];
  if (s.weight === 1 && s.retention === 1) return hyp;
  if (s.weight === 1) {
    // Hver merket fisk i fangsten har fortsatt merket med sannsynlighet q
    const q = s.retention;
    const out = new Array<number>(maxR + 1).fill(0);
    hyp.forEach((p, r) => {
      for (let k = 0; k <= r; k++) out[k]! += p * Math.exp(logChoose(r, k)) * q ** k * (1 - q) ** (r - k);
    });
    return out;
  }
  const trials = 6000;
  const out = new Array<number>(maxR + 1).fill(0);
  const rnd = seededRandom(9001 + N * 7 + M * 131 + C * 17);
  for (let i = 0; i < trials; i++) {
    let m = M;
    let u = N - M;
    let r = 0;
    for (let j = 0; j < C && m + u > 0; j++) {
      const pm = (s.weight * m) / (s.weight * m + u);
      if (rnd() < pm) {
        m--;
        r++;
      } else u--;
    }
    out[r]! += 1 / trials;
  }
  return out;
}

export interface EstimateSummary {
  /** P(R = 0): ingen merkede i gjenfangsten, ikke noe estimat. */
  pNone: number;
  /** Gjennomsnittet av estimatene (forsøk med R ≥ 1). */
  mean: number;
  /** 2,5- og 97,5-persentilen av estimatene (forsøk med R ≥ 1). */
  low: number;
  high: number;
  /** Mest sannsynlige R. */
  modeR: number;
}

/** Spredningen i estimatet M·C/R ut fra fordelingen av R. */
export function summarizeEstimates(dist: readonly number[], M: number, C: number): EstimateSummary {
  const pNone = dist[0] ?? 0;
  const rest = 1 - pNone;
  let mean = 0;
  let modeR = 0;
  dist.forEach((p, r) => {
    if (r > 0 && rest > 0) mean += (p / rest) * ((M * C) / r);
    if (p > (dist[modeR] ?? 0)) modeR = r;
  });
  // Estimatet avtar med r, så de høye estimatene kommer fra små r
  const quantile = (q: number) => {
    let acc = 0;
    for (let r = 1; r < dist.length; r++) {
      acc += (dist[r] ?? 0) / (rest || 1);
      if (acc >= q) return (M * C) / r;
    }
    return (M * C) / Math.max(1, dist.length - 1);
  };
  // low: 2,5 % av estimatene er lavere (de største r), high: 2,5 % er høyere (de minste r)
  const high = quantile(0.025);
  let acc = 0;
  let low = high;
  for (let r = dist.length - 1; r >= 1; r--) {
    acc += (dist[r] ?? 0) / (rest || 1);
    if (acc >= 0.025) {
      low = (M * C) / r;
      break;
    }
  }
  return { pNone, mean, low, high, modeR };
}

/** En fisk i dammen: posisjon i enhetssirkelen (u, v ∈ [−1, 1]) og retning (svømmer mot høyre eller venstre). */
export interface PondFish {
  u: number;
  v: number;
  right: boolean;
}

/**
 * Plasserer n fisk tilfeldig (fast frø) i en sirkelrund dam med radius 1, med litt avstand mellom dem så de ikke
 * ligger oppå hverandre.
 */
export function pondLayout(n: number, seed: number): PondFish[] {
  const rnd = seededRandom(seed);
  const out: PondFish[] = [];
  // Tilfeldig sekvensiell plassering: avstanden kan ikke være mye over 0,8 · √(π/n) før det blir fullt
  const minD = 0.8 * Math.sqrt(Math.PI / Math.max(1, n));
  for (let i = 0; i < n; i++) {
    let best: PondFish | null = null;
    let bestD = -1;
    for (let tries = 0; tries < 40; tries++) {
      const a = rnd() * Math.PI * 2;
      const s = Math.sqrt(rnd()) * 0.93;
      const c = { u: s * Math.cos(a), v: s * Math.sin(a), right: rnd() < 0.5 };
      let d = Number.POSITIVE_INFINITY;
      for (const q of out) d = Math.min(d, Math.hypot((c.u - q.u) * 1.3, c.v - q.v));
      if (d >= minD) {
        best = c;
        break;
      }
      if (d > bestD) {
        bestD = d;
        best = c;
      }
    }
    out.push(best!);
  }
  return out;
}

export interface McTrialParams {
  /** Antall fisk i dammen (fasit). */
  N: number;
  /** Antall som fanges og merkes i første fangst. */
  M: number;
  /** Antall som fanges i gjenfangsten. */
  C: number;
  seed: number;
  scenario: McScenario;
}

export interface McTrial {
  /** Posisjonene ved første fangst. */
  before: PondFish[];
  /** Posisjonene etter at de merkede er satt ut igjen. */
  after: PondFish[];
  /** Posisjonene i gjenfangsten (med fellelyst har noen merkede svømt inn i garnet). */
  atCatch: PondFish[];
  /** Fisk (indekser) som ble fanget og merket i første fangst. */
  marked: Set<number>;
  /** Merkede fisk som har mistet merket før gjenfangsten. */
  lostTag: Set<number>;
  /** Fisk som ble fanget i gjenfangsten. */
  caught: Set<number>;
  /** Merkede (med merke) i gjenfangsten. */
  R: number;
  /** Lincoln–Petersen-estimatet, eller null når R = 0. */
  estimate: number | null;
  /** Midtpunktet og radien til garnet i første fangst og i gjenfangsten (enhetssirkelen). */
  net1: { u: number; v: number; r: number };
  net2: { u: number; v: number; r: number };
}

/**
 * Ett forsøk i dammen. Første fangst tar de M fiskene nærmest garnet (til venstre i dammen). Deretter settes de ut
 * igjen: når forutsetningene holder, blander de seg tilfeldig med resten; ellers blir de i nærheten av der de ble
 * fanget. Gjenfangsten tar de C fiskene nærmest et garn et annet sted, der fellelyst gir merkede fisk dobbel
 * «rekkevidde». Fisk er nummerert 0 … N − 1 og beholder nummeret sitt.
 */
export function markRecaptureTrial({ N, M, C, seed, scenario }: McTrialParams): McTrial {
  const n = Math.max(1, Math.round(N));
  const m = Math.min(n, Math.max(0, Math.round(M)));
  const c = Math.min(n, Math.max(0, Math.round(C)));
  const rnd = seededRandom(seed * 7919 + 17);
  const before = pondLayout(n, seed * 31 + 5);
  const net1 = { u: -0.45 + (rnd() - 0.5) * 0.2, v: (rnd() - 0.5) * 0.5, r: 0 };
  const byDist1 = before.map((p, i) => ({ i, d: Math.hypot(p.u - net1.u, p.v - net1.v) })).sort((a, b) => a.d - b.d);
  const marked = new Set(byDist1.slice(0, m).map((x) => x.i));
  net1.r = (byDist1[Math.max(0, m - 1)]?.d ?? 0) + 0.07;

  // Utsetting: blandet (nye, tilfeldige plasser for alle) eller ikke blandet (de merkede blir i nærheten)
  const mixed = pondLayout(n, seed * 31 + 6);
  const order = mixed.map((_, i) => i);
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [order[i], order[j]] = [order[j]!, order[i]!];
  }
  const after: PondFish[] = before.map((p, i) => {
    if (scenario === 'ikkeBlandet') {
      // Ingen blanding: alle fisk (også de merkede) svømmer bare litt rundt der de var
      const a = rnd() * Math.PI * 2;
      const s = 0.1 * Math.sqrt(rnd());
      const u = p.u + s * Math.cos(a);
      const v = p.v + s * Math.sin(a);
      const len = Math.hypot(u, v);
      return len > 0.93 ? { u: (u / len) * 0.93, v: (v / len) * 0.93, right: rnd() < 0.5 } : { u, v, right: rnd() < 0.5 };
    }
    return mixed[order[i]!]!;
  });

  const lostTag = new Set<number>();
  if (scenario === 'merkeTap') for (const i of marked) if (rnd() < 1 - SCENARIOS.merkeTap.retention) lostTag.add(i);

  const net2 = { u: 0.35 + (rnd() - 0.5) * 0.2, v: (rnd() - 0.5) * 0.4, r: 0 };
  const w = (i: number) => (scenario === 'fellelyst' && marked.has(i) ? SCENARIOS.fellelyst.weight : 1);
  const byDist2 = after.map((p, i) => ({ i, d: Math.hypot(p.u - net2.u, p.v - net2.v), dw: Math.hypot(p.u - net2.u, p.v - net2.v) / w(i) }));
  byDist2.sort((a, b) => a.dw - b.dw);
  const caughtList = byDist2.slice(0, c);
  const caught = new Set(caughtList.map((x) => x.i));
  net2.r = Math.max(0.12, ...caughtList.filter((x) => w(x.i) === 1).map((x) => x.d)) + 0.07;
  // Fellelyst: merkede fisk som ble fanget lenger unna, har svømt inn i garnet
  const atCatch = after.map((p, i) => {
    const d = Math.hypot(p.u - net2.u, p.v - net2.v);
    if (!caught.has(i) || d <= net2.r - 0.04) return p;
    const a = rnd() * Math.PI * 2;
    const s = (net2.r - 0.07) * Math.sqrt(rnd());
    return { u: net2.u + s * Math.cos(a), v: net2.v + s * Math.sin(a), right: p.right };
  });
  let R = 0;
  for (const i of caught) if (marked.has(i) && !lostTag.has(i)) R++;
  return { before, after, atCatch, marked, lostTag, caught, R, estimate: lincolnPetersen(m, c, R), net1, net2 };
}

/* ====================================================================== */
/* 3. Klima og utbredelse                                                   */
/* ====================================================================== */

/**
 * Temperaturen faller ca. 0,6 °C per 100 m oppover (fuktig luft, vanlig lærebokverdi) og ca. 0,55 °C per breddegrad
 * nordover langs kysten om sommeren (julitemperatur, normaler fra Meteorologisk institutt: Oslo ca. 16 °C, Tromsø ca.
 * 11–12 °C, Longyearbyen ca. 6–7 °C). Klimasonene her er julitemperatur, som styrer bl.a. skoggrensen (ca. 10 °C).
 */
export const LAPSE_RATE = 0.006;
/** Julitemperatur ved havnivå i Sør-Norge (innlandet, forenklet). Gir skoggrense ved ca. 1100 m, som i Jotunheimen. */
export const T_SEA_JULY = 16;
/** Julitemperatur ved Lindesnes (58° N) og fall per breddegrad nordover. */
export const T_LAT0 = 17;
export const LAT0 = 58;
export const LAT_GRADIENT = 0.55;
/** Én breddegrad er ca. 111 km. */
export const KM_PER_DEGREE = 111;

export type SpeciesId = 'issoleie' | 'fjellrev' | 'fjellbjork' | 'rodrev';

export interface Species {
  id: SpeciesId;
  name: string;
  latin: string;
  /** Tålt julitemperatur (°C): nedre og øvre grense for der arten klarer seg (forenklet toleranseområde). */
  Tmin: number;
  Tmax: number;
  kind: 'plante' | 'pattedyr' | 'tre';
}

/**
 * Forenklede toleranseområder (julitemperatur) som gir omtrent riktige høydegrenser i Sør-Norge med 0,6 °C per 100 m:
 * - Issoleie: høyalpin, den karplanten som vokser høyest i Norge (over 2300 m i Jotunheimen) → ca. 1600–2300 m.
 * - Fjellrev: lav- og mellomalpin sone over skoggrensen; i varmere områder taper den konkurransen mot rødreven.
 * - Fjellbjørk: danner skoggrensen (julitemperatur ca. 10 °C) → ca. 500–1100 m.
 * - Rødrev: fra lavlandet og opp i lavalpin sone.
 * Den øvre grensen for fjellartene skyldes mest konkurranse fra arter som tåler varmen bedre, ikke selve varmen.
 */
export const SPECIES: readonly Species[] = [
  { id: 'issoleie', name: 'Issoleie', latin: 'Ranunculus glacialis', Tmin: 2, Tmax: 6.5, kind: 'plante' },
  { id: 'fjellrev', name: 'Fjellrev', latin: 'Vulpes lagopus', Tmin: 4.5, Tmax: 9.5, kind: 'pattedyr' },
  { id: 'fjellbjork', name: 'Fjellbjørk', latin: 'Betula pubescens', Tmin: 9.5, Tmax: 13, kind: 'tre' },
  { id: 'rodrev', name: 'Rødrev', latin: 'Vulpes vulpes', Tmin: 7, Tmax: 20, kind: 'pattedyr' },
];

/** Julitemperatur i høyden h (m) med oppvarming dT. */
export function tempAtAltitude(h: number, dT = 0): number {
  return T_SEA_JULY + dT - LAPSE_RATE * h;
}

/** Høyden (m) der julitemperaturen er T, med oppvarming dT. */
export function altitudeOfTemp(T: number, dT = 0): number {
  return (T_SEA_JULY + dT - T) / LAPSE_RATE;
}

/** Julitemperatur på breddegraden lat (° N) i lavlandet, med oppvarming dT. */
export function tempAtLatitude(lat: number, dT = 0): number {
  return T_LAT0 + dT - LAT_GRADIENT * (lat - LAT0);
}

export function latitudeOfTemp(T: number, dT = 0): number {
  return LAT0 + (T_LAT0 + dT - T) / LAT_GRADIENT;
}

export interface Band {
  /** Nedre og øvre grense (høyde i m eller breddegrad), eller null når det ikke finnes noe passende sted. */
  from: number;
  to: number;
}

/**
 * Høydebeltet der julitemperaturen er mellom Tmin og Tmax, avgrenset av havnivået og fjelltoppen. null når hele
 * beltet ligger over toppen (arten har ingen steder å gå).
 */
export function altitudeBand(Tmin: number, Tmax: number, dT: number, peak: number): Band | null {
  const from = Math.max(0, altitudeOfTemp(Tmax, dT));
  const to = Math.min(peak, altitudeOfTemp(Tmin, dT));
  return to > from ? { from, to } : null;
}

/** Hvor mye beltet flytter seg oppover per grad oppvarming (m/°C): 1/0,006 ≈ 167 m. */
export function shiftPerDegreeAltitude(): number {
  return 1 / LAPSE_RATE;
}

/** Hvor mye klimasonen flytter seg nordover per grad oppvarming (km/°C): 111/0,55 ≈ 200 km. */
export function shiftPerDegreeLatitude(): number {
  return KM_PER_DEGREE / LAT_GRADIENT;
}

/**
 * Arealet av et høydebelte på et kjegleformet fjell med toppen i høyden H, som andel av hele fjellet (sett ovenfra):
 * arealet over høyden h er proporsjonalt med (H − h)², så beltet [a, b] har ((H − a)² − (H − b)²)/H².
 */
export function coneBandArea(band: Band | null, peak: number): number {
  if (!band || !(peak > 0)) return 0;
  const a = Math.min(peak, Math.max(0, band.from));
  const b = Math.min(peak, Math.max(0, band.to));
  if (b <= a) return 0;
  return ((peak - a) ** 2 - (peak - b) ** 2) / peak ** 2;
}

/** Land langs aksen nordover (° N): fastlandet til Nordkapp, Bjørnøya og Svalbard. Resten er hav. */
export const LAND: readonly { name: string; from: number; to: number }[] = [
  { name: 'Fastlandet', from: 58, to: 71.2 },
  { name: 'Bjørnøya', from: 74.35, to: 74.52 },
  { name: 'Svalbard', from: 76.45, to: 80.85 },
];
/** Aksen nordover i figuren. */
export const LAT_MIN = 58;
export const LAT_MAX = 82;

/** Breddegradsbeltet med passende julitemperatur langs aksen (uten å ta hensyn til land og hav). */
export function latitudeBand(Tmin: number, Tmax: number, dT: number): Band | null {
  const from = Math.max(LAT_MIN, latitudeOfTemp(Tmax, dT));
  const to = Math.min(LAT_MAX, latitudeOfTemp(Tmin, dT));
  return to > from ? { from, to } : null;
}

/** Delene av beltet som ligger på land. */
export function landSegments(band: Band | null): Band[] {
  if (!band) return [];
  const out: Band[] = [];
  for (const l of LAND) {
    const from = Math.max(band.from, l.from);
    const to = Math.min(band.to, l.to);
    if (to > from) out.push({ from, to });
  }
  return out;
}

/** Hvor mange breddegrader med land som har passende klima. */
export function landLength(band: Band | null): number {
  return landSegments(band).reduce((s, b) => s + (b.to - b.from), 0);
}

export type RangeMode = 'hoyde' | 'nord';

export interface RangeResult {
  /** Klimasonen i dag og med oppvarming (høyde i m eller breddegrad). */
  today: Band | null;
  future: Band | null;
  /** Areal (høyde: andel av fjellet; nord: breddegrader med land) i dag og med oppvarming. */
  areaToday: number;
  areaFuture: number;
  /** Arealet med oppvarming som andel av arealet i dag (null når arten ikke har noe areal i dag). */
  remaining: number | null;
  /** Arten har ingen steder å gå: sonen ligger over toppen eller nord for alt land. */
  gone: boolean;
  /** Den øvre (eller nordligste) grensen har nådd toppen (eller enden av landet): ingen steder høyere å gå. */
  squeezed: boolean;
}

/** Klimasonen og arealet for en art i dag og med oppvarming dT. `peak` er fjelltoppen (bare for høyde). */
export function speciesRange(sp: Pick<Species, 'Tmin' | 'Tmax'>, dT: number, mode: RangeMode, peak: number): RangeResult {
  if (mode === 'hoyde') {
    const today = altitudeBand(sp.Tmin, sp.Tmax, 0, peak);
    const future = altitudeBand(sp.Tmin, sp.Tmax, dT, peak);
    const areaToday = coneBandArea(today, peak);
    const areaFuture = coneBandArea(future, peak);
    return {
      today,
      future,
      areaToday,
      areaFuture,
      remaining: areaToday > 0 ? areaFuture / areaToday : null,
      gone: areaToday > 0 && !future,
      squeezed: !!future && altitudeOfTemp(sp.Tmin, dT) >= peak,
    };
  }
  const today = latitudeBand(sp.Tmin, sp.Tmax, 0);
  const future = latitudeBand(sp.Tmin, sp.Tmax, dT);
  const areaToday = landLength(today);
  const areaFuture = landLength(future);
  const lastLand = LAND[LAND.length - 1]!.to;
  return {
    today,
    future,
    areaToday,
    areaFuture,
    remaining: areaToday > 0 ? areaFuture / areaToday : null,
    gone: areaToday > 0 && areaFuture <= 0,
    squeezed: areaFuture > 0 && latitudeOfTemp(sp.Tmin, dT) >= lastLand,
  };
}

/* ---------- Akser ---------- */

/** Pene akseverdier fra 0 som alltid når minst opp til `max` (kit-ets niceTicks kan stoppe under). */
export function niceAxis(max: number, count = 4): { max: number; ticks: number[] } {
  const top = max > 0 && Number.isFinite(max) ? max : 1;
  const ticks = niceTicks(0, top, count);
  const step = ticks.length > 1 ? ticks[1]! - ticks[0]! : top;
  while (ticks[ticks.length - 1]! < top - 1e-9) ticks.push(Math.round((ticks[ticks.length - 1]! + step) / step) * step);
  return { max: ticks[ticks.length - 1]!, ticks };
}
