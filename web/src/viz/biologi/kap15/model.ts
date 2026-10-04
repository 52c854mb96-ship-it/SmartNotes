/**
 * Flokkimmunitet (Bi 1 kapittel 15, KM7 og KM8): SIR-modellen med vaksinasjon fra biologi-kit-et, og en befolkning
 * på 400 individer som viser den samme epidemien som enkeltpersoner. Ren modell uten React.
 */
import {
  effectiveR,
  finalSize,
  herdImmunityThreshold,
  requiredCoverage,
  seededRandom,
  sirStart,
  sirStats,
  solveSir,
  valueAt,
  type SirSeries,
} from '../kit';

/** Hvor lenge en smittet er smittsom i gjennomsnitt (døgn). Forenklet: den samme for alle sykdommene. */
export const INFECTIOUS_DAYS = 7;
/** Antall individer i rutenettet. */
export const POPULATION = 400;
/** Én smittet i rutenettet ved start. */
export const I0 = 1 / POPULATION;

export interface Disease {
  id: 'influensa' | 'covid' | 'meslinger';
  /** Navn i forhåndsvalget. */
  name: string;
  /** Kort navn til etiketter i grafen. */
  short: string;
  /** Typisk basisreproduksjonstall (lærebokverdier; de varierer mellom kilder og samfunn). */
  R0: number;
}

export const DISEASES: readonly Disease[] = [
  { id: 'influensa', name: 'Sesonginfluensa', short: 'influensa', R0: 1.5 },
  { id: 'covid', name: 'Covid-19 (opprinnelig variant)', short: 'covid-19', R0: 3 },
  { id: 'meslinger', name: 'Meslinger', short: 'meslinger', R0: 15 },
];

export interface EpidemicParams {
  R0: number;
  /** Vaksinasjonsdekning (0–1). */
  p: number;
  /** Vaksinens effekt (0–1): andelen av de vaksinerte som blir immune. */
  e: number;
}

export interface Epidemic {
  series: SirSeries;
  /** Tidsrommet som vises (døgn), valgt så epidemien er over. */
  tMax: number;
  /** Høyeste andel smittet samtidig, og når. */
  peak: number;
  peakTime: number;
  /** Andel av hele befolkningen som har vært smittet når tidsrommet er slutt. */
  totalInfected: number;
  /** Flokkimmunitetsgrensen p_c = 1 − 1/R₀ (andel som må være immune). */
  pc: number;
  /** Vaksinasjonsdekningen som trengs med denne vaksineeffekten: p_c / e (kan være over 1). */
  required: number;
  /** Det effektive reproduksjonstallet ved start med vaksinasjon: R₀ · (1 − p · e). */
  Re0: number;
  /** Andel av de uvaksinerte som blir smittet. */
  attackUnvaccinated: number;
  /** Flokkimmunitet: R ≤ 1 fra start, så smitten dør ut. */
  herd: boolean;
}

/** Pene lengder på tidsaksen (døgn). */
export const NICE_DAYS = [30, 60, 90, 120, 180, 240, 365, 540, 730] as const;

/** Tidspunktet da epidemien regnes som over: andelen smittet er under 2 % av toppen (og under I₀/5). */
export function endOfEpidemic(s: SirSeries): number {
  const { peak, peakTime } = sirStats(s);
  // Ingen kan smittes (alle er immune): ingenting å vente på
  if (!(peak > 0)) return 0;
  const limit = Math.min(peak * 0.02, I0 / 5);
  for (let i = 0; i < s.t.length; i++) if (s.t[i]! > peakTime && s.I[i]! < limit) return s.t[i]!;
  return s.t[s.t.length - 1] ?? 0;
}

export function niceDays(t: number): number {
  return NICE_DAYS.find((d) => d >= t) ?? NICE_DAYS[NICE_DAYS.length - 1]!;
}

export function epidemic({ R0, p, e }: EpidemicParams): Epidemic {
  const params = { R0, D: INFECTIOUS_DAYS, I0, p, e };
  const long = solveSir(params, { tMax: 730, dt: 0.25 });
  const tMax = niceDays(endOfEpidemic(long));
  const series = tMax === 730 ? long : solveSir(params, { tMax, dt: 0.25 });
  const st = sirStats(series);
  const start = sirStart(params);
  const last = series.S.length - 1;
  const Send = series.S[last] ?? start.S;
  // Bare vaksinasjonen (de få som er smittet ved start, regnes ikke med), som i formelen p_c = 1 − 1/R₀
  const Re0 = effectiveR(R0, 1 - start.V);
  return {
    series,
    tMax,
    peak: st.peak,
    peakTime: st.peakTime,
    totalInfected: st.totalInfected,
    pc: herdImmunityThreshold(R0),
    required: requiredCoverage(R0, e),
    Re0,
    // Alle mottakelige har samme risiko, så andelen som slipper unna er S(slutt)/S(0)
    attackUnvaccinated: start.S > 0 ? 1 - Send / start.S : 0,
    herd: Re0 <= 1,
  };
}

/** Andel som blir smittet hvis epidemien får gå helt ut (sluttstørrelsen), for sammenligning. */
export function expectedFinalSize({ R0, p, e }: EpidemicParams): number {
  return finalSize(R0, sirStart({ I0: 0, p, e }).S);
}

/* ---------- Individene i rutenettet ---------- */

export interface Person {
  /** Plass i rutenettet. */
  index: number;
  vaccinated: boolean;
  /** Vaksinert og immun (vaksinen virket). */
  immune: boolean;
  /** Rekkefølgen personen blir smittet i blant dem som ikke er immune (0 = først). −1 for immune. */
  order: number;
}

export type PersonState = 'S' | 'I' | 'R' | 'V';

function shuffled(n: number, seed: number): number[] {
  const rnd = seededRandom(seed);
  const a = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

/**
 * Hvem som er vaksinert, hvem vaksinen virker på, og i hvilken rekkefølge de andre blir smittet (alltid likt for samme
 * frø). Alle som ikke er immune har samme risiko, som i SIR-modellen, så rekkefølgen er tilfeldig.
 */
export function people({ p, e }: Pick<EpidemicParams, 'p' | 'e'>, n = POPULATION, seed = 11): Person[] {
  const vaccOrder = shuffled(n, seed);
  const nVacc = Math.round(Math.min(1, Math.max(0, p)) * n);
  const nImmune = Math.round(Math.min(1, Math.max(0, e)) * nVacc);
  const list: Person[] = Array.from({ length: n }, (_, index) => ({ index, vaccinated: false, immune: false, order: -1 }));
  vaccOrder.slice(0, nVacc).forEach((idx, k) => {
    list[idx]!.vaccinated = true;
    list[idx]!.immune = k < nImmune;
  });
  const open = shuffled(n, seed + 1).filter((idx) => !list[idx]!.immune);
  open.forEach((idx, k) => (list[idx]!.order = k));
  return list;
}

/** Hvor mange som har vært smittet og hvor mange som er friske igjen ved tiden t (antall individer). */
export function countsAt(series: SirSeries, t: number, n = POPULATION): { ever: number; recovered: number } {
  const [, I = 0, R = 0] = valueAt(series.sol, t);
  const recovered = Math.round(R * n);
  // Minst én smittet ved start, så rutenettet viser hvor epidemien begynner
  const ever = Math.max(recovered, Math.round((I + R) * n), t <= 0 ? 1 : 0);
  return { ever, recovered };
}

/** Tilstanden til hver person: de første `ever` i smitterekkefølgen har vært smittet, og de første `recovered` av dem er friske. */
export function personStates(list: readonly Person[], ever: number, recovered: number): PersonState[] {
  return list.map((pp) => {
    if (pp.immune) return 'V';
    if (pp.order < recovered) return 'R';
    if (pp.order < ever) return 'I';
    return 'S';
  });
}
