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

/* ====================================================================== */
/* Immunforsvaret: primær og sekundær immunrespons (KM7, KM8)              */
/* ====================================================================== */

/*
 * Skjematisk modell av antistoffnivået etter at kroppen møter et antigen, slik lærebøkene tegner det:
 * - Primærrespons (første møte): antistoffer kan måles etter ca. 5–7 døgn og er høyest etter ca. to uker; så faller
 *   nivået, men det blir igjen litt (langlivede plasmaceller og hukommelsesceller).
 * - Sekundærrespons (nytt møte, hukommelsesceller): starter etter 1–2 døgn, blir ca. 10 ganger høyere og varer lenger.
 * Antistoffnivået er relativt (1 = toppen i primærresponsen). Smittestoffet i kroppen (relativ mengde, 1 = mest mulig)
 * vokser logistisk og fjernes av immunforsvaret: dP/dt = rP(1 − P) − k · A(t) · P, løst med RK4. Over 20 % av
 * maksimum regnes som syk. Tallene er typiske lærebokverdier og viser prinsippet; de er ikke målinger for én sykdom.
 */

export interface ResponseSpec {
  /** Døgn før antistoffene begynner å stige. */
  lag: number;
  /** Døgn fra stigningen begynner til toppen. */
  rise: number;
  /** Høyeste nivå (relativt). */
  peak: number;
  /** Halveringstid (døgn) for nivået etter toppen. */
  halfLife: number;
  /** Andelen av toppen som blir igjen lenge. */
  plateau: number;
}

export const PRIMARY_RESPONSE: ResponseSpec = { lag: 5, rise: 9, peak: 1, halfLife: 12, plateau: 0.1 };
/** Første møte er en vaksine: litt svakere respons, men hukommelsesceller blir dannet. */
export const VACCINE_RESPONSE: ResponseSpec = { lag: 5, rise: 9, peak: 0.7, halfLife: 12, plateau: 0.1 };
export const SECONDARY_RESPONSE: ResponseSpec = { lag: 1.5, rise: 4.5, peak: 10, halfLife: 30, plateau: 0.3 };
/** Vekstrate for smittestoffet (per døgn): doblingstid ca. 10 timer. */
export const PATHOGEN_GROWTH = 1.6;
/** Hvor effektivt antistoffer og immunceller fjerner smittestoffet (per døgn per enhet antistoff). */
export const CLEARANCE = 6;
/** Smittestoff ved smitte (relativt). */
export const INOCULUM = 1e-3;
/** Over denne mengden smittestoff blir du syk. */
export const SICK_LEVEL = 0.2;
/** Tidsaksen (døgn). */
export const IMMUNE_DAYS = 200;

/** Antistoffnivået fra én respons `dt` døgn etter møtet med antigenet. */
export function responseAt(spec: ResponseSpec, dt: number): number {
  if (dt <= spec.lag) return 0;
  const x = dt - spec.lag;
  if (x <= spec.rise) {
    const u = x / spec.rise;
    return spec.peak * u * u * (3 - 2 * u);
  }
  return spec.peak * (spec.plateau + (1 - spec.plateau) * 0.5 ** ((x - spec.rise) / spec.halfLife));
}

export type FirstExposure = 'sykdom' | 'vaksine';

export interface ImmuneScenario {
  first: FirstExposure;
  /** Dagen for det andre møtet med smittestoffet. */
  second: number;
  /** Om hukommelsescellene virker (false: tenkt tilfelle uten hukommelsesceller). */
  memory: boolean;
}

/**
 * Spesifikasjonene for de to responsene i scenarioet. Uten hukommelse (tenkt tilfelle) blir det heller ikke igjen noe
 * antistoff etter første respons, og det andre møtet gir en ny primærrespons.
 */
export function responses(s: ImmuneScenario): [ResponseSpec, ResponseSpec] {
  const first = s.first === 'vaksine' ? VACCINE_RESPONSE : PRIMARY_RESPONSE;
  if (!s.memory) return [{ ...first, plateau: 0 }, { ...PRIMARY_RESPONSE, plateau: 0 }];
  return [first, SECONDARY_RESPONSE];
}

/** Antistoffnivået på dag t (summen av første og andre respons). */
export function antibodiesAt(s: ImmuneScenario, t: number): number {
  const [a, b] = responses(s);
  return responseAt(a, t) + responseAt(b, t - s.second);
}

export interface ImmuneRun {
  t: number[];
  antibodies: number[];
  /** Smittestoff (eller vaksineantigen) i kroppen. */
  pathogen: number[];
  /** Døgn syk etter første og andre møte. */
  sickDays: [number, number];
  /** Toppen i antistoffnivået etter første og andre møte (nivå og dag etter møtet). */
  peaks: [{ level: number; day: number }, { level: number; day: number }];
}

/** Smittestoffet i kroppen etter ett møte, fra dag `from` til `to`, med antistoffnivået gitt av scenarioet. */
function pathogenCourse(s: ImmuneScenario, from: number, to: number, vaccine: boolean, dt: number): number[] {
  const out: number[] = [];
  let P = vaccine ? 0.12 : INOCULUM;
  const f = (t: number, p: number) => (vaccine ? -0.35 * p : PATHOGEN_GROWTH * p * (1 - p)) - CLEARANCE * antibodiesAt(s, t) * p;
  for (let t = from; t <= to + 1e-9; t += dt) {
    out.push(P);
    // RK4-steg
    const k1 = f(t, P);
    const k2 = f(t + dt / 2, P + (dt / 2) * k1);
    const k3 = f(t + dt / 2, P + (dt / 2) * k2);
    const k4 = f(t + dt, P + dt * k3);
    P = Math.max(0, P + (dt / 6) * (k1 + 2 * k2 + 2 * k3 + k4));
    if (P < 1e-7) P = 0;
  }
  return out;
}

export function immuneRun(s: ImmuneScenario, dt = 0.1): ImmuneRun {
  const n = Math.round(IMMUNE_DAYS / dt);
  const t = Array.from({ length: n + 1 }, (_, i) => i * dt);
  const antibodies = t.map((x) => antibodiesAt(s, x));
  const first = pathogenCourse(s, 0, IMMUNE_DAYS, s.first === 'vaksine', dt);
  const iSecond = Math.round(s.second / dt);
  const second = pathogenCourse(s, s.second, IMMUNE_DAYS, false, dt);
  const pathogen = t.map((_, i) => (first[i] ?? 0) + (i >= iSecond ? (second[i - iSecond] ?? 0) : 0));
  const sick = (arr: number[]) => arr.filter((p) => p >= SICK_LEVEL).length * dt;
  const peakAfter = (from: number, to: number) => {
    let best = { level: 0, day: 0 };
    t.forEach((x, i) => {
      if (x >= from && x < to && antibodies[i]! > best.level) best = { level: antibodies[i]!, day: x - from };
    });
    return best;
  };
  return {
    t,
    antibodies,
    pathogen,
    sickDays: [s.first === 'vaksine' ? 0 : sick(first.slice(0, iSecond)), sick(second)],
    peaks: [peakAfter(0, s.second), peakAfter(s.second, IMMUNE_DAYS + 1)],
  };
}

/**
 * Hvilken del av immunforsvaret som er mest i sving `dt` døgn etter et møte med antigenet:
 * uspesifikt forsvar (fagocytter) først, så aktivering av T-hjelpeceller, så B-celler/plasmaceller med antistoffer og
 * drepe-T-celler, og til slutt hukommelsesceller.
 */
export type DefenseStage = 'ingen' | 'uspesifikt' | 'aktivering' | 'effekt' | 'hukommelse';

export function stageAfter(spec: ResponseSpec, dt: number): DefenseStage {
  if (dt < 0) return 'ingen';
  if (dt < Math.min(2, spec.lag * 0.4)) return 'uspesifikt';
  if (dt < spec.lag) return 'aktivering';
  if (dt < spec.lag + spec.rise + 4) return 'effekt';
  return 'hukommelse';
}

export function defenseStage(s: ImmuneScenario, t: number): DefenseStage {
  const [a, b] = responses(s);
  return t >= s.second ? stageAfter(b, t - s.second) : stageAfter(a, t);
}

/* ====================================================================== */
/* Antibiotikaresistens (KM9)                                              */
/* ====================================================================== */

/*
 * Følsomme (S) og resistente (R) bakterier i en infeksjon (eller i normalfloraen), per døgn:
 *   dS/dt = r_S · S · (1 − N/K) − a(t) · k_S · S − m(N) · S
 *   dR/dt = r_R · R · (1 − N/K) − a(t) · k_R · R − m(N) · R
 * N = S + R, a(t) = 1 de dagene antibiotikaen tas. De resistente tåler mye mer antibiotika (drepes langsommere) og vokser
 * litt saktere uten antibiotika (resistens koster). Immunforsvaret m(N) = i / (1 + N/N_i) rydder bort små
 * bakteriebestander, men blir overkjørt av store. I normalfloraen (tarmen) tolererer kroppen bakteriene (m = 0), og
 * antibiotikaen virker svakere der. Under ett individ settes antallet til 0. Tallene er valgt for å vise prinsippet
 * (Levin og Handel, mfl.); de er ikke målinger for et bestemt antibiotikum.
 */

export type CourseKind = 'hele' | 'avbrutt' | 'unodvendig';

export const RES_K = 1e10;
export const INFECTION_N0 = 1e9;
/** Andelen resistente ved start: 1 av 100 000. */
export const RES_F0 = 1e-5;
export const R_SENSITIVE = 3;
export const R_RESISTANT = 2.7;
export const KILL_SENSITIVE = 6.5;
export const KILL_RESISTANT = 3;
/** Svakere virkning på normalfloraen i tarmen. */
export const FLORA_KILL_SENSITIVE = 3.3;
export const FLORA_KILL_RESISTANT = 2;
export const IMMUNE_KILL = 4;
export const IMMUNE_HALF = 1e4;
/** Døgn per kur (behandling + tiden etterpå) og døgn med antibiotika. */
export const COURSE_PERIOD = 14;
export const COURSE_DAYS: Record<CourseKind, number> = { hele: 7, avbrutt: 3, unodvendig: 7 };

export interface ResistanceRun {
  kind: CourseKind;
  courses: number;
  t: number[];
  S: number[];
  R: number[];
  /** Andelen resistente ved starten av hver kur (NaN når det ikke er noen bakterier). */
  shareAtStart: number[];
  /** Om infeksjonen er borte ved slutten av hver kurperiode. */
  clearedAfter: boolean[];
  /** Dager med antibiotika: [fra, til] for hver kur. */
  doses: [number, number][];
}

/** Antibiotika på dag t? */
export function onAntibiotic(kind: CourseKind, t: number, courses: number): boolean {
  const k = Math.floor(t / COURSE_PERIOD);
  if (k >= courses) return false;
  return t - k * COURSE_PERIOD < COURSE_DAYS[kind];
}

export function simulateResistance(kind: CourseKind, courses: number, dt = 0.02): ResistanceRun {
  const flora = kind === 'unodvendig';
  const kS = flora ? FLORA_KILL_SENSITIVE : KILL_SENSITIVE;
  const kR = flora ? FLORA_KILL_RESISTANT : KILL_RESISTANT;
  const immune = (N: number) => (flora ? 0 : IMMUNE_KILL / (1 + N / IMMUNE_HALF));
  const deriv = (t: number, S: number, R: number): [number, number] => {
    const N = S + R;
    const a = onAntibiotic(kind, t, courses) ? 1 : 0;
    const m = immune(N);
    const g = 1 - N / RES_K;
    return [R_SENSITIVE * S * g - a * kS * S - m * S, R_RESISTANT * R * g - a * kR * R - m * R];
  };
  const start = (): [number, number] => {
    const N0 = flora ? RES_K : INFECTION_N0;
    return [N0 * (1 - RES_F0), N0 * RES_F0];
  };
  const tEnd = courses * COURSE_PERIOD;
  const n = Math.round(tEnd / dt);
  const t: number[] = [];
  const Sa: number[] = [];
  const Ra: number[] = [];
  const shareAtStart: number[] = [];
  const clearedAfter: boolean[] = [];
  let [S, R] = start();
  for (let i = 0; i <= n; i++) {
    const time = i * dt;
    const k = Math.round(time / COURSE_PERIOD);
    if (Math.abs(time - k * COURSE_PERIOD) < dt / 2) {
      // Slutten av forrige kurperiode: er infeksjonen borte?
      if (k > 0) clearedAfter.push(!flora && S + R < 1);
      if (k < courses) {
        // Ny kur. Etter hele kuren er infeksjonen borte, og en ny infeksjon kommer fra omgivelsene (samme andel resistente).
        if (k > 0 && kind === 'hele') [S, R] = start();
        shareAtStart.push(S + R > 0 ? R / (S + R) : Number.NaN);
      }
    }
    t.push(time);
    Sa.push(S);
    Ra.push(R);
    if (i === n) break;
    // RK4
    const [a1, b1] = deriv(time, S, R);
    const [a2, b2] = deriv(time + dt / 2, S + (dt / 2) * a1, R + (dt / 2) * b1);
    const [a3, b3] = deriv(time + dt / 2, S + (dt / 2) * a2, R + (dt / 2) * b2);
    const [a4, b4] = deriv(time + dt, S + dt * a3, R + dt * b3);
    S = S + (dt / 6) * (a1 + 2 * a2 + 2 * a3 + a4);
    R = R + (dt / 6) * (b1 + 2 * b2 + 2 * b3 + b4);
    if (S < 1) S = 0;
    if (R < 1) R = 0;
  }
  const doses: [number, number][] = Array.from({ length: courses }, (_, k) => [k * COURSE_PERIOD, k * COURSE_PERIOD + COURSE_DAYS[kind]]);
  return { kind, courses, t, S: Sa, R: Ra, shareAtStart, clearedAfter, doses };
}

/** Tilstanden på dag `day` (nærmeste tidssteg). */
export function resistanceAt(run: ResistanceRun, day: number): { S: number; R: number; share: number } {
  const dt = run.t[1]! - run.t[0]!;
  const i = Math.min(run.t.length - 1, Math.max(0, Math.round(day / dt)));
  const S = run.S[i]!;
  const R = run.R[i]!;
  return { S, R, share: S + R > 0 ? R / (S + R) : Number.NaN };
}

/**
 * Et utvalg på `slots` bakterier til figuren (log-skala, så en milliard ikke drukner en million): antall som vises er
 * log10(N) / log10(K) av plassene, og andelen resistente blant dem er den faktiske andelen, men minst én resistent vises
 * når det finnes resistente.
 */
export function sampleCounts(S: number, R: number, slots: number): { shown: number; resistant: number } {
  const N = S + R;
  if (!(N >= 1)) return { shown: 0, resistant: 0 };
  const shown = Math.max(1, Math.round((Math.log10(N) / Math.log10(RES_K)) * slots));
  const raw = Math.round((R / N) * shown);
  const resistant = R >= 1 ? Math.max(1, raw) : 0;
  return { shown, resistant: Math.min(shown, resistant) };
}

/** Faste plasser for bakteriene i utvalget (samme hver gang). */
export function samplePositions(slots: number, seed = 21): { x: number; y: number; a: number }[] {
  const rnd = seededRandom(seed);
  return Array.from({ length: slots }, () => ({ x: rnd(), y: rnd(), a: rnd() * 180 }));
}
