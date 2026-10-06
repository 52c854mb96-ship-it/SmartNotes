/**
 * Eksempeloppgaven «Bil i bytrafikk: les av en v-t-graf» (k1-eks-vt-graf, 1B–1D).
 *
 * En bil står i ro ved stopplinja i et lyskryss. Når lyset blir grønt (t = 0), akselererer den jevnt opp til farten
 * v_maks (del 1, fra 0 til t₁), kjører med konstant fart (del 2, fra t₁ til t₂) og bremser jevnt til den står stille
 * ved stopplinja i neste lyskryss (del 3, fra t₂ til t₃). v-t-grafen er da et trapes.
 *
 *   Akselerasjonen er stigningstallet:   a₁ = v_maks / t₁,   a₂ = 0,   a₃ = −v_maks / (t₃ − t₂)
 *   Strekningen er arealet under grafen: s₁ = ½ · t₁ · v_maks,   s₂ = (t₂ − t₁) · v_maks,   s₃ = ½ · (t₃ − t₂) · v_maks
 *   Gjennomsnittsfarten:                 v̄ = s / t₃
 *   Posisjonen (s-t-grafen):             s = ½a₁t² i del 1, s₁ + v_maks(t − t₁) i del 2 og
 *                                        s₁ + s₂ + v_maks·τ + ½a₃τ² i del 3 (τ = t − t₂)
 *
 * Bilen regnes som et punkt (fronten): den starter med fronten på den første stopplinja og stopper med fronten på den
 * neste, så avstanden mellom stopplinjene er hele strekningen s.
 */
import { fmt } from '../../kit/format';

export interface CityTripTask {
  /** Fartsgrensen i gata (km/h). */
  limitKmh: number;
  /** Den høyeste farten, som bilen holder i del 2 (m/s). Et helt tall, så den kan leses av rutenettet. */
  vMax: number;
  /** Når akselerasjonen slutter (s). */
  t1: number;
  /** Når bremsingen begynner (s). */
  t2: number;
  /** Når bilen står stille ved neste stopplinje (s). */
  t3: number;
}

/**
 * Tre tallsett. Hjørnene i grafen ligger på hele sekunder og hele m/s, så de kan leses av rutenettet.
 * Akselerasjonene (1,5–2,0 m/s²) og bremsingene (−2,0 til −3,0 m/s²) er vanlige i bytrafikk. I tallsett 2 kjører
 * bilen 54 km/h i 50-sonen, så svaret på a) er ikke alltid «ja».
 */
export const CITY_TRIP_TASKS: CityTripTask[] = [
  { limitKmh: 50, vMax: 12, t1: 6, t2: 26, t3: 30 },
  { limitKmh: 50, vMax: 15, t1: 10, t2: 33, t3: 39 },
  { limitKmh: 30, vMax: 8, t1: 5, t2: 20, t3: 24 },
];

export const KMH_PER_MS = 3.6;

/**
 * Tall med `n` gjeldende siffer og desimalkomma, som i svarene: 6 → «6,0», 26 → «26», 11,92 → «12» (n = 2),
 * 11,92 → «11,9» og 6,5 → «6,50» (n = 3). Null skrives «0».
 */
export function fmtSig(v: number, n = 2): string {
  if (!Number.isFinite(v)) return fmt(v, 0);
  if (v === 0) return '0';
  const d = Math.max(0, n - 1 - Math.floor(Math.log10(Math.abs(v)) + 1e-9));
  return fmt(v, d);
}

/** Antall desimaler fmtSig bruker for v med n gjeldende siffer. */
function sigDecimals(v: number, n: number): number {
  if (!Number.isFinite(v) || v === 0) return 0;
  return Math.max(0, n - 1 - Math.floor(Math.log10(Math.abs(v)) + 1e-9));
}

/**
 * Tallene i tipset i d): «Med v_maks hele veien ville turen tatt s / v_maks = 19,5 s, altså 4,5 s mindre enn 24 s.»
 * Tiden står med tre gjeldende siffer (så 19,5 s ikke blir «20 s»), og forskjellen regnes fra tiden slik den står,
 * med like mange desimaler, så tallene alltid stemmer med hverandre: 24 − 19,5 = 4,5.
 */
export function allMaxTimeText(task: Pick<CityTripTask, 't3'>, tAllMax: number): { t3: string; tAll: string; saved: string } {
  const d = sigDecimals(tAllMax, 3);
  const shown = Number(tAllMax.toFixed(d));
  return { t3: fmtSig(task.t3), tAll: fmt(shown, d), saved: fmt(task.t3 - shown, d) };
}

export type PhaseNo = 1 | 2 | 3;

export interface TripPhase {
  n: PhaseNo;
  /** Start- og sluttid (s) og varigheten Δt. */
  from: number;
  to: number;
  dt: number;
  /** Farten i starten og slutten av delen (m/s) og endringen Δv = v − v₀. */
  v0: number;
  v1: number;
  dv: number;
  /** Akselerasjonen a = Δv / Δt (m/s²), stigningstallet til grafen. */
  a: number;
  /** Strekningen i delen (m), arealet under grafen. */
  s: number;
  /** Posisjonen i starten av delen (m). */
  start: number;
  /** Gjennomsnittsfarten i delen (m/s): ½(v₀ + v) når akselerasjonen er konstant. */
  vAvg: number;
}

export interface CityTripSolution {
  phases: [TripPhase, TripPhase, TripPhase];
  /** Den høyeste farten i km/h. */
  vMaxKmh: number;
  /** Om bilen holder fartsgrensen (v_maks ≤ fartsgrensen). */
  withinLimit: boolean;
  /** Hvor mye bilen kjører for fort (km/h), 0 når den holder fartsgrensen. */
  overLimitKmh: number;
  /** Hele strekningen (m): avstanden mellom stopplinjene. */
  s: number;
  /** Hele tiden (s). */
  T: number;
  /** Gjennomsnittsfarten for hele turen (m/s og km/h). */
  vAvg: number;
  vAvgKmh: number;
  /** Strekningen bilen ville kjørt med v_maks hele tiden (m): rektangelet v_maks · t₃. */
  sAllMax: number;
  /** Det som mangler på sAllMax (m): de to trekantene over grafen i del 1 og 3. */
  sMissing: number;
  /** Tiden turen ville tatt med v_maks hele veien (s). */
  tAllMax: number;
  /** Feilsvaret «gjennomsnittet av snittfartene i de tre delene» (m/s), som ikke tar hensyn til at delene varer ulikt. */
  meanOfPhaseSpeeds: number;
}

function phase(n: PhaseNo, from: number, to: number, v0: number, v1: number, start: number): TripPhase {
  const dt = to - from;
  const dv = v1 - v0;
  const a = dt > 0 ? dv / dt : 0;
  const s = 0.5 * (v0 + v1) * dt;
  return { n, from, to, dt, v0, v1, dv, a, s, start, vAvg: dt > 0 ? s / dt : v0 };
}

/** Løser hele oppgaven for ett tallsett. Alle tall i teksten, utregningen og figurene kommer herfra. */
export function solveCityTrip(task: CityTripTask): CityTripSolution {
  const { vMax, t1, t2, t3, limitKmh } = task;
  const p1 = phase(1, 0, t1, 0, vMax, 0);
  const p2 = phase(2, t1, t2, vMax, vMax, p1.s);
  const p3 = phase(3, t2, t3, vMax, 0, p1.s + p2.s);
  const s = p1.s + p2.s + p3.s;
  const T = t3;
  const vAvg = T > 0 ? s / T : 0;
  const vMaxKmh = vMax * KMH_PER_MS;
  const sAllMax = vMax * T;
  return {
    phases: [p1, p2, p3],
    vMaxKmh,
    withinLimit: vMaxKmh <= limitKmh + 1e-9,
    overLimitKmh: Math.max(0, vMaxKmh - limitKmh),
    s,
    T,
    vAvg,
    vAvgKmh: vAvg * KMH_PER_MS,
    sAllMax,
    sMissing: sAllMax - s,
    tAllMax: vMax > 0 ? s / vMax : 0,
    meanOfPhaseSpeeds: (p1.vAvg + p2.vAvg + p3.vAvg) / 3,
  };
}

/** Del nummer `n` (1, 2 eller 3) av løsningen. */
export function phaseOf(sol: CityTripSolution, n: PhaseNo): TripPhase {
  return n === 1 ? sol.phases[0] : n === 2 ? sol.phases[1] : sol.phases[2];
}

/** Hvilken del av turen tiden t er i: 1, 2 eller 3, og 0 før start eller etter at bilen har stoppet. */
export function phaseAt({ t1, t2, t3 }: CityTripTask, t: number): 0 | PhaseNo {
  if (!(t >= 0) || t >= t3) return 0;
  return t < t1 ? 1 : t < t2 ? 2 : 3;
}

/** Farten ved tiden t (m/s). */
export function velocityAt(task: CityTripTask, t: number): number {
  const { vMax, t1, t2, t3 } = task;
  if (!(t > 0) || t >= t3) return 0;
  if (t < t1) return (vMax * t) / t1;
  if (t <= t2) return vMax;
  return (vMax * (t3 - t)) / (t3 - t2);
}

/** Akselerasjonen ved tiden t (m/s²). I et knekkpunkt gjelder delen som begynner der. */
export function accelerationAt(task: CityTripTask, t: number): number {
  const { vMax, t1, t2, t3 } = task;
  const n = phaseAt(task, t);
  return n === 1 ? vMax / t1 : n === 3 ? -vMax / (t3 - t2) : 0;
}

/** Posisjonen ved tiden t (m), regnet fra den første stopplinja. */
export function positionAt(task: CityTripTask, t: number): number {
  const { vMax, t1, t2, t3 } = task;
  const tt = Math.min(t3, Math.max(0, t));
  const a1 = vMax / t1;
  const s1 = 0.5 * vMax * t1;
  if (tt <= t1) return 0.5 * a1 * tt * tt;
  if (tt <= t2) return s1 + vMax * (tt - t1);
  const a3 = -vMax / (t3 - t2);
  const tau = tt - t2;
  return s1 + vMax * (t2 - t1) + vMax * tau + 0.5 * a3 * tau * tau;
}

/** Posisjonen hvert `dt` sekund fra 0 til bilen står stille (som et bilde tatt hvert sekund). */
export function strobePositions(task: CityTripTask, dt = 1): { t: number; s: number }[] {
  const out: { t: number; s: number }[] = [];
  const n = Math.floor(task.t3 / dt + 1e-9);
  for (let i = 0; i <= n; i++) out.push({ t: i * dt, s: positionAt(task, i * dt) });
  return out;
}

/* ---------- Aksene i grafene ---------- */

export interface TripAxes {
  /** Tidsaksen: største verdi, tallene og avstanden mellom de tynne rutelinjene (s). */
  tMax: number;
  tTicks: number[];
  tMinor: number;
  /** Fartsaksen (m/s). */
  vTop: number;
  vTicks: number[];
  vMinor: number;
  /** Posisjonsaksen i s-t-grafen (m), med minst 15 % luft over sluttposisjonen til etiketten. */
  sTop: number;
  sTicks: number[];
}

const range = (step: number, max: number) => Array.from({ length: Math.round(max / step) + 1 }, (_, i) => i * step);
const divides = (step: number, v: number) => Math.abs(v / step - Math.round(v / step)) < 1e-9;

/**
 * Aksene til v-t- og s-t-grafen. Rutenettet er så fint at alle hjørnene i v-t-grafen ligger på en rutelinje, og
 * v_maks står på en tallverdi, så eleven kan lese av grafen slik man gjør på en prøve.
 */
export function tripAxes(task: CityTripTask, s: number): TripAxes {
  const { vMax, t1, t2, t3 } = task;
  const tMinor = [5, 2, 1].find((d) => [t1, t2, t3].every((t) => divides(d, t))) ?? 1;
  const tLabel = tMinor === 5 ? 10 : tMinor === 2 ? 4 : 5;
  const tMax = Math.ceil((t3 + 0.5) / tLabel) * tLabel;
  const vMinor = 1;
  const vLabel = [2, 3, 5].find((d) => divides(d, vMax)) ?? 1;
  const vTop = Math.ceil((vMax + 1) / vLabel) * vLabel;
  const sStep = [25, 50, 100, 200, 500].find((d) => Math.ceil((s * 1.15) / d) <= 7) ?? 1000;
  const sTop = Math.ceil((s * 1.15) / sStep) * sStep;
  return {
    tMax,
    tTicks: range(tLabel, tMax),
    tMinor,
    vTop,
    vTicks: range(vLabel, vTop),
    vMinor,
    sTop,
    sTicks: range(sStep, sTop),
  };
}
