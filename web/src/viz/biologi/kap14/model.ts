/**
 * Kapittel 14 Mikrobielle og virale sykdommer (Bi 1, KM7): ren biologi uten React, testet i model.test.ts.
 *
 * 1. Bakterievekst: vekstkurve med lagfase, eksponentiell fase, stasjonær fase og dødsfase (kit-ets bacterialGrowth),
 *    generasjonstid som avhenger av temperaturen, og matsikkerhet.
 * 2. Smittespredning: R₀ = kontakter per dag · smittesannsynlighet per kontakt · dager smittsom, tiltak og SIR-modellen.
 * 3. Virusformering: trinnene i formeringen av en bakteriofag og et kappekledd virus, sammenlignet med todeling.
 */
import {
  bacterialGrowth,
  effectiveR,
  growthPhase,
  growthPhaseEnds,
  seededRandom,
  sirStats,
  solveSir,
  type BacterialGrowthParams,
  type GrowthPhase,
  type SirSeries,
} from '../kit';

/* ====================================================================== */
/* 1. Bakterievekst                                                         */
/* ====================================================================== */

/*
 * Temperaturen: Ratkowskys modell √μ = b · (T − T_min) · (1 − e^(c · (T − T_maks))) (Ratkowsky mfl. 1983) for en
 * typisk matforgiftningsbakterie som trives i kroppstemperatur (f.eks. salmonella eller E. coli): ingen vekst under ca.
 * 5 °C eller over ca. 46 °C, raskest ved 37–38 °C. b er valgt så generasjonstida er 20 minutter ved 37 °C, slik
 * lærebøkene oppgir for E. coli under gode forhold. Det gir ca. 1 t 20 min ved 20 °C og ca. 12 timer ved 10 °C.
 * Lagfasen er satt til tre generasjonstider, og den stasjonære fasen og dødsfasen er like lange ved alle temperaturer
 * (forenkling). Antall er per gram mat; næringen gir plass til ca. 10⁹ bakterier per gram.
 */
export const T_MIN = 5;
export const T_MAX = 46;
const RATKOWSKY_C = 0.3;
/** Generasjonstid ved 37 °C (timer): 20 minutter. */
export const G_37 = 20 / 60;
/** Største antall per gram (stasjonær fase). */
export const N_MAX = 1e9;
/** Grensen der maten regnes som farlig å spise (per gram). */
export const DANGER = 1e6;
/** Tidsrommet i grafen (timer). */
export const GROWTH_HOURS = 48;
export const LAG_GENERATIONS = 3;
export const STATIONARY_HOURS = 8;
export const DEATH_HALF_LIFE = 4;

const sqrtRate = (T: number) => (T > T_MIN && T < T_MAX ? (T - T_MIN) * (1 - Math.exp(RATKOWSKY_C * (T - T_MAX))) : 0);

/** Generasjonstida (timer) ved temperaturen T. Uendelig når bakteriene ikke deler seg (for kaldt eller for varmt). */
export function generationTimeAt(T: number): number {
  const s = sqrtRate(T);
  if (!(s > 0)) return Number.POSITIVE_INFINITY;
  return G_37 * (sqrtRate(37) / s) ** 2;
}

/** Om bakteriene deler seg i det hele tatt ved temperaturen T. */
export const grows = (T: number): boolean => Number.isFinite(generationTimeAt(T));

/** Parametrene til kit-ets vekstkurve ved temperaturen T (bare når bakteriene vokser). */
export function growthParamsAt(T: number, N0: number): BacterialGrowthParams | null {
  const g = generationTimeAt(T);
  if (!Number.isFinite(g)) return null;
  return { N0, lag: LAG_GENERATIONS * g, g, Nmax: N_MAX, stationary: STATIONARY_HOURS, deathHalfLife: DEATH_HALF_LIFE };
}

/** Antall bakterier per gram etter t timer ved temperaturen T. */
export function countAt(T: number, N0: number, t: number): number {
  const p = growthParamsAt(T, N0);
  return p ? bacterialGrowth(p, t) : N0;
}

export type Phase = GrowthPhase | 'ingen';

/** Vekstfasen etter t timer ('ingen' når det er for kaldt eller for varmt til å dele seg). */
export function phaseAt(T: number, N0: number, t: number): Phase {
  const p = growthParamsAt(T, N0);
  return p ? growthPhase(p, t) : 'ingen';
}

/** Når fasene slutter (null når bakteriene ikke vokser). */
export function phaseEndsAt(T: number, N0: number): { lag: number; log: number; stationary: number } | null {
  const p = growthParamsAt(T, N0);
  return p ? growthPhaseEnds(p) : null;
}

/** Timer før antallet når `target` per gram (null hvis aldri). */
export function timeToCount(T: number, N0: number, target: number): number | null {
  if (N0 >= target) return 0;
  const p = growthParamsAt(T, N0);
  if (!p || target > N_MAX) return null;
  return p.lag + p.g * Math.log2(target / N0);
}

/** Antall generasjoner (delinger) bakteriene har gått gjennom etter t timer. */
export function generationsAfter(T: number, N0: number, t: number): number {
  const p = growthParamsAt(T, N0);
  if (!p) return 0;
  const e = growthPhaseEnds(p);
  return Math.max(0, Math.min(t, e.log) - e.lag) / p.g;
}

/* ====================================================================== */
/* 2. Smittespredning                                                      */
/* ====================================================================== */

/*
 * R₀ = c · p · D (kontakter per dag · sannsynligheten for smitte per kontakt · dager smittsom), som i lærebøkene.
 * Tiltakene er forenklede og illustrerende (studiene spriker):
 * - håndvask: 20 % lavere smitterisiko per kontakt (metaanalyser finner 15–20 % færre luftveisinfeksjoner)
 * - munnbind: 30 % lavere smitterisiko per kontakt
 * - isolasjon: den syke får symptomer etter 2 døgn og holder seg hjemme resten av tiden med 75 % færre kontakter
 * SIR-modellen fra kit-et: alle møter alle like ofte, og den som har vært syk, er immun resten av tiden.
 */
export interface SpreadParams {
  /** Kontakter per dag c. */
  contacts: number;
  /** Sannsynlighet for smitte per kontakt p (0–1). */
  p: number;
  /** Dager smittsom D. */
  days: number;
}

export interface Measures {
  handvask: boolean;
  munnbind: boolean;
  isolasjon: boolean;
}

export const NO_MEASURES: Measures = { handvask: false, munnbind: false, isolasjon: false };
export const HANDWASH_FACTOR = 0.8;
export const MASK_FACTOR = 0.7;
/** Døgn med smitte før symptomene kommer (og isolasjonen begynner). */
export const SYMPTOM_DAY = 2;
export const ISOLATION_FACTOR = 0.25;
/** Innbyggere i byen. */
export const TOWN = 10_000;
/** Andelen av de smittede som trenger sykehus, og sykehusplassene: helsevesenet klarer 1 000 smittet samtidig. */
export const HOSPITAL_SHARE = 0.05;
export const HOSPITAL_BEDS = 50;
export const CARE_CAPACITY = HOSPITAL_BEDS / HOSPITAL_SHARE;

/** Basisreproduksjonstallet uten tiltak: R₀ = c · p · D. */
export function basicR0({ contacts, p, days }: SpreadParams): number {
  return contacts * p * days;
}

/** Smitterisikoen per kontakt med tiltakene. */
export function effectiveP(p: number, m: Measures): number {
  return p * (m.handvask ? HANDWASH_FACTOR : 1) * (m.munnbind ? MASK_FACTOR : 1);
}

/** «Kontaktdøgn» i løpet av sykdommen: dager smittsom, med færre kontakter etter at isolasjonen begynner. */
export function contactDays(days: number, m: Measures): number {
  if (!m.isolasjon) return days;
  return Math.min(days, SYMPTOM_DAY) + Math.max(0, days - SYMPTOM_DAY) * ISOLATION_FACTOR;
}

/** Reproduksjonstallet med tiltak: R = c · p_tiltak · kontaktdøgn. */
export function reproductionNumber(s: SpreadParams, m: Measures): number {
  return s.contacts * effectiveP(s.p, m) * contactDays(s.days, m);
}

export const NICE_DAYS = [30, 60, 90, 120, 180, 240, 365] as const;

export interface Outbreak {
  R: number;
  series: SirSeries;
  tMax: number;
  /** Flest smittet samtidig (antall) og dagen det skjer. */
  peak: number;
  peakDay: number;
  /** Smittet til sammen (antall). */
  total: number;
  /** Dager med flere smittet enn helsevesenet klarer. */
  daysOverCapacity: number;
}

/** Siste dag med mer enn en halv smittet person etter toppen (når utbruddet er over). */
function endDay(s: SirSeries): number {
  const { peakTime } = sirStats(s);
  for (let i = 0; i < s.t.length; i++) if (s.t[i]! > peakTime && s.I[i]! * TOWN < 0.5) return s.t[i]!;
  return s.t[s.t.length - 1] ?? 0;
}

/** Utbruddet i byen med én smittet ved start. */
export function outbreak(R: number, days: number, tMaxFixed?: number): Outbreak {
  const params = { R0: R, D: days, I0: 1 / TOWN };
  const long = solveSir(params, { tMax: 365, dt: 0.25 });
  const tMax = tMaxFixed ?? (NICE_DAYS.find((d) => d >= endDay(long)) ?? 365);
  const series = tMax === 365 ? long : solveSir(params, { tMax, dt: 0.25 });
  const st = sirStats(series);
  const dt = series.t[1]! - series.t[0]!;
  const over = series.I.filter((v) => v * TOWN > CARE_CAPACITY).length * dt;
  const last = series.I.length - 1;
  return {
    R,
    series,
    tMax,
    peak: st.peak * TOWN,
    peakDay: st.peakTime,
    total: (series.I[last]! + series.R[last]!) * TOWN,
    daysOverCapacity: over,
  };
}

/** Det effektive reproduksjonstallet R · S når andelen S fortsatt kan smittes. */
export const currentR = (R: number, S: number): number => effectiveR(R, S);

export type ContactKind = 'smittet' | 'ikke-smittet' | 'unngått';

export interface ContactCell {
  day: number;
  index: number;
  kind: ContactKind;
}

/**
 * Alle kontaktene én smittet person har i løpet av sykdommen (dag × kontakter per dag). Hver kontakt har et fast,
 * tilfeldig tall (frø), og den blir smittet når tallet er under smitterisikoen; isolasjon fjerner tre av fire
 * kontakter etter at symptomene kommer. Antall smittede er i snitt lik R.
 */
export function contactGrid(s: SpreadParams, m: Measures, seed = 7): ContactCell[] {
  const rnd = seededRandom(seed);
  const pe = effectiveP(s.p, m);
  const cells: ContactCell[] = [];
  const D = Math.round(s.days);
  const c = Math.round(s.contacts);
  for (let day = 0; day < D; day++)
    for (let index = 0; index < c; index++) {
      const u = rnd();
      const keep = rnd();
      const isolated = m.isolasjon && day >= SYMPTOM_DAY && keep >= ISOLATION_FACTOR;
      cells.push({ day, index, kind: isolated ? 'unngått' : u < pe ? 'smittet' : 'ikke-smittet' });
    }
  return cells;
}

/* ====================================================================== */
/* 3. Virusformering                                                        */
/* ====================================================================== */

/*
 * Tidslinjer (typiske lærebokverdier):
 * - Bakteriofag T4 i E. coli ved 37 °C (lytisk syklus): ca. 25 minutter fra feste til frigjøring, ca. 100 nye fager
 *   per bakterie.
 * - Kappekledd virus, f.eks. influensavirus i en celle i luftveiene: ca. 8 timer fra feste til de første nye virusene
 *   knoppes av; hver celle lager hundrevis til tusenvis av nye viruspartikler (her 1 000).
 * - Bakterie (E. coli) som deler seg ved todeling: ca. 20 minutter under gode forhold, 2 nye celler.
 */
export type Agent = 'bakteriofag' | 'kappekledd' | 'bakterie';

export interface StepSpan {
  id: string;
  name: string;
  start: number;
  end: number;
}

export interface Cycle {
  agent: Agent;
  /** Varighet i tidsenheten `unit`. */
  duration: number;
  unit: 'min' | 'timer';
  steps: StepSpan[];
  /** Nye virus (eller celler) etter én runde. */
  offspring: number;
  /** Kan formere seg uten en vertscelle. */
  independent: boolean;
}

export const CYCLES: Record<Agent, Cycle> = {
  bakteriofag: {
    agent: 'bakteriofag',
    duration: 25,
    unit: 'min',
    offspring: 100,
    independent: false,
    steps: [
      { id: 'feste', name: 'Feste', start: 0, end: 2 },
      { id: 'inntrengning', name: 'Inntrengning', start: 2, end: 4 },
      { id: 'kopiering', name: 'Kopiering', start: 4, end: 14 },
      { id: 'montering', name: 'Montering', start: 14, end: 22 },
      { id: 'frigjoring', name: 'Frigjøring', start: 22, end: 25 },
    ],
  },
  kappekledd: {
    agent: 'kappekledd',
    duration: 8,
    unit: 'timer',
    offspring: 1000,
    independent: false,
    steps: [
      { id: 'feste', name: 'Feste', start: 0, end: 0.5 },
      { id: 'inntrengning', name: 'Inntrengning', start: 0.5, end: 1.5 },
      { id: 'kopiering', name: 'Kopiering', start: 1.5, end: 5 },
      { id: 'montering', name: 'Montering', start: 5, end: 7 },
      { id: 'frigjoring', name: 'Frigjøring', start: 7, end: 8 },
    ],
  },
  bakterie: {
    agent: 'bakterie',
    duration: 20,
    unit: 'min',
    offspring: 2,
    independent: true,
    steps: [
      { id: 'vekst', name: 'Vekst', start: 0, end: 4 },
      { id: 'dna', name: 'DNA kopieres', start: 4, end: 12 },
      { id: 'skilles', name: 'Kopiene skilles', start: 12, end: 15 },
      { id: 'skillevegg', name: 'Skillevegg', start: 15, end: 19 },
      { id: 'deling', name: 'To celler', start: 19, end: 20 },
    ],
  },
};

/** Trinnet (indeks 0–4) ved tiden t, og hvor langt i trinnet (0–1). */
export function stepAt(agent: Agent, t: number): { index: number; u: number } {
  const c = CYCLES[agent];
  const tt = Math.min(c.duration, Math.max(0, t));
  for (let i = 0; i < c.steps.length; i++) {
    const s = c.steps[i]!;
    if (tt < s.end || i === c.steps.length - 1) return { index: i, u: Math.min(1, Math.max(0, (tt - s.start) / (s.end - s.start))) };
  }
  return { index: c.steps.length - 1, u: 1 };
}

/** Antall etter n runder når det alltid finnes nok vertsceller (virus) eller næring (bakterier). */
export function afterRounds(agent: Agent, rounds: number): number {
  return CYCLES[agent].offspring ** rounds;
}

/** Antall hele runder på tida `minutes` minutter. */
export function roundsIn(agent: Agent, minutes: number): number {
  const c = CYCLES[agent];
  const len = c.unit === 'min' ? c.duration : c.duration * 60;
  return Math.floor(minutes / len + 1e-9);
}

/**
 * Hva antibiotika kan angripe: bakterier har cellevegg (peptidoglykan, penicillin), egne ribosomer (tetrasyklin) og
 * eget stoffskifte. Virus har ingen av delene; de bruker vertscellens ribosomer og stoffskifte.
 */
export const ANTIBIOTIC_TARGETS: Record<Agent, string[]> = {
  bakterie: ['cellevegg', 'ribosomer', 'DNA-kopiering'],
  bakteriofag: [],
  kappekledd: [],
};

export function antibioticWorks(agent: Agent): boolean {
  return ANTIBIOTIC_TARGETS[agent].length > 0;
}
