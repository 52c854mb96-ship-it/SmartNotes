/**
 * Modellen til «Dekktrykk om vinteren» (5A Trykk, 5B Temperatur). Et bildekk fylles i en varm garasje og står så
 * ute i kulda. Volumet i dekket og mengden luft er (nesten) uendret, så det absolutte trykket er proporsjonalt med
 * temperaturen i kelvin: p/T = konstant, p₂ = p₁ · T₂/T₁. Måleren på bensinstasjonen viser manometertrykket
 * p_m = p − p₀, altså hvor mye større trykket i dekket er enn lufttrykket utenfor.
 *
 * Trykk er i bar (1 bar = 100 kPa = 10⁵ Pa), som på dekktrykkmålere. Temperatur t i °C og T i kelvin.
 */

/** T = t + 273,15. */
export const KELVIN = 273.15;
/** Normalt lufttrykk ved havnivå, 101,3 kPa, i bar. */
export const P0_BAR = 1.013;
export const KPA_PER_BAR = 100;

/** Glidebryterne og de faste tallene i visualiseringen. */
export const DEKK = {
  /** Manometertrykket dekket fylles til i garasjen (bar). Personbiler: ca. 2,2–2,8 bar. */
  fill: { min: 1.8, max: 3.5, step: 0.1, start: 2.5 },
  /** Temperaturen i garasjen (°C). */
  garage: { min: 10, max: 30, step: 1, start: 20 },
  /** Temperaturen ute (°C). Over garasjetemperaturen stiger trykket i stedet. */
  outside: { min: -30, max: 30, step: 1, start: -15 },
  /** Hvor lenge bilen har stått ute (timer). Starter ferdig avkjølt, så svaret synes med en gang. */
  hours: { min: 0, max: 5, step: 0.05, start: 5 },
  /**
   * Tidskonstanten for avkjølingen av lufta i dekket (timer). En enkel modell: felgen og gummien har stor
   * varmekapasitet, så lufta i et parkert dekk bruker et par timer på å få utetemperaturen.
   */
  tau: 0.8,
  /** Tiden det tar å rygge ut av garasjen og parkere (timer), bare for animasjonen. */
  drive: 0.08,
  /** Skalaen på dekktrykkmåleren (bar). */
  gaugeMax: 4,
} as const;

/** Fra celsius til kelvin. */
export function toKelvin(tC: number): number {
  return tC + KELVIN;
}

/** Absolutt trykk fra manometertrykket: p = p_m + p₀. */
export function absolutePressure(gauge: number, p0: number = P0_BAR): number {
  return gauge + p0;
}

/** Manometertrykket fra det absolutte trykket: p_m = p − p₀. */
export function gaugePressure(absolute: number, p0: number = P0_BAR): number {
  return absolute - p0;
}

/**
 * Trykket etter en temperaturendring ved fast volum og fast stoffmengde (isokor prosess): p₂ = p₁ · T₂/T₁.
 * p₁ må være absolutt trykk og T₁, T₂ i kelvin. Gir NaN for T₁ ≤ 0 eller T₂ < 0.
 */
export function isochoricPressure(p1: number, T1: number, T2: number): number {
  if (!(T1 > 0) || !(T2 >= 0)) return Number.NaN;
  return (p1 * T2) / T1;
}

/**
 * Temperaturen til lufta i dekket (°C) etter `hours` timer ute: den nærmer seg utetemperaturen eksponentielt,
 * t ≈ t_ute + (t_garasje − t_ute) · e^(−tid/τ). Enkel modell av avkjølingen (ikke pensum, bare for animasjonen).
 * Kurven er justert litt (under 0,2 %) så den treffer utetemperaturen nøyaktig ved `end` timer, og står der etterpå.
 */
export function tyreAirTemperature(
  tGarage: number,
  tOutside: number,
  hours: number,
  tau: number = DEKK.tau,
  end: number = DEKK.hours.max,
): number {
  if (!(hours > 0)) return tGarage;
  if (hours >= end) return tOutside;
  const tail = Math.exp(-end / tau);
  const left = (Math.exp(-hours / tau) - tail) / (1 - tail);
  return tOutside + (tGarage - tOutside) * left;
}

/** Hvor langt bilen har kommet ut av garasjen (0 = inne, 1 = parkert ute), myk start og stopp. */
export function driveProgress(hours: number, drive: number = DEKK.drive): number {
  if (!(hours > 0)) return 0;
  if (hours >= drive) return 1;
  const u = hours / drive;
  return u * u * (3 - 2 * u);
}

export interface TyreState {
  /** Temperaturen i garasjen og i lufta i dekket nå (°C). */
  t1: number;
  t2: number;
  /** De samme i kelvin. */
  T1: number;
  T2: number;
  /** Manometertrykket og det absolutte trykket da dekket ble fylt (bar). */
  pm1: number;
  p1: number;
  /** Det absolutte trykket og manometertrykket nå (bar). */
  p2: number;
  pm2: number;
  /** Hvor mye trykket har falt (bar): p₁ − p₂ = p_m1 − p_m2 (negativt når det har steget). */
  drop: number;
  /** Fallet som andel av det absolutte trykket, (T₁ − T₂)/T₁. */
  dropShareAbsolute: number;
  /** Fallet som andel av det måleren viste, (p_m1 − p_m2)/p_m1. Større enn andelen av det absolutte trykket. */
  dropShareGauge: number;
  /** Hvor mye trykket endrer seg per grad (bar/K): p₁/T₁. */
  perKelvin: number;
}

/** Hele regnestykket: dekket fylles til `pm1` bar ved `t1` °C, og lufta i dekket får `t2` °C. */
export function solveTyre(pm1: number, t1: number, t2: number, p0: number = P0_BAR): TyreState {
  const T1 = toKelvin(t1);
  const T2 = toKelvin(t2);
  const p1 = absolutePressure(pm1, p0);
  const p2 = isochoricPressure(p1, T1, T2);
  const pm2 = gaugePressure(p2, p0);
  const drop = p1 - p2;
  return {
    t1,
    t2,
    T1,
    T2,
    pm1,
    p1,
    p2,
    pm2,
    drop,
    dropShareAbsolute: drop / p1,
    dropShareGauge: pm1 > 0 ? drop / pm1 : Number.NaN,
    perKelvin: p1 / T1,
  };
}

/** Regnemåtene eleven kan velge: den riktige og to vanlige feil. */
export type TyreMethod = 'riktig' | 'celsius' | 'manometer';

export interface TyrePrediction {
  method: TyreMethod;
  /** Det utregningen sier det absolutte trykket og manometertrykket blir (bar). */
  p2: number;
  pm2: number;
  /** Fallet utregningen sier måleren får (bar), p_m1 − p_m2. */
  drop: number;
  /** Hvor langt unna det måleren faktisk viser (bar), positivt når utregningen gir for høyt trykk. */
  error: number;
  /** Utregningen gir et absolutt trykk under null (eller deler på null): umulig. */
  impossible: boolean;
}

/**
 * Hva hver regnemåte forutsier:
 *  - riktig: absolutt trykk og kelvin, p₂ = p₁ · T₂/T₁.
 *  - celsius: absolutt trykk, men celsius, p₂ = p₁ · t₂/t₁ (feil: celsius har nullpunkt ved frysepunktet til vann).
 *  - manometer: kelvin, men manometertrykket, p_m2 = p_m1 · T₂/T₁ (feil: lufta utenfor er ikke med i forholdet).
 */
export function predictTyre(method: TyreMethod, pm1: number, t1: number, t2: number, p0: number = P0_BAR): TyrePrediction {
  const truth = solveTyre(pm1, t1, t2, p0);
  let p2: number;
  let pm2: number;
  if (method === 'celsius') {
    p2 = t1 === 0 ? Number.NaN : (truth.p1 * t2) / t1;
    pm2 = gaugePressure(p2, p0);
  } else if (method === 'manometer') {
    pm2 = (pm1 * truth.T2) / truth.T1;
    p2 = absolutePressure(pm2, p0);
  } else {
    p2 = truth.p2;
    pm2 = truth.pm2;
  }
  return {
    method,
    p2,
    pm2,
    drop: pm1 - pm2,
    error: pm2 - truth.pm2,
    impossible: !Number.isFinite(p2) || p2 < 0,
  };
}

/** Linjene i grafen: absolutt trykk og manometertrykk (bar) som funksjon av temperaturen t (°C) i dekket. */
export function absoluteAt(state: Pick<TyreState, 'p1' | 'T1'>, tC: number): number {
  return (state.p1 * toKelvin(tC)) / state.T1;
}

/** Den feilaktige «celsius-linja»: p = p₁ · t/t₁, gjennom (0 °C, 0). */
export function celsiusLineAt(state: Pick<TyreState, 'p1' | 't1'>, tC: number): number {
  return state.t1 === 0 ? Number.NaN : (state.p1 * tC) / state.t1;
}

/** Den feilaktige «manometerlinja»: p_m = p_m1 · T/T₁, gjennom (−273,15 °C, 0). */
export function gaugeLineWrongAt(state: Pick<TyreState, 'pm1' | 'T1'>, tC: number): number {
  return (state.pm1 * toKelvin(tC)) / state.T1;
}

/** Temperaturen (°C) der måleren ville vist 0: det absolutte trykket er da like stort som lufttrykket utenfor. */
export function zeroGaugeTemperature(state: Pick<TyreState, 'p1' | 'T1'>, p0: number = P0_BAR): number {
  return (state.T1 * p0) / state.p1 - KELVIN;
}
