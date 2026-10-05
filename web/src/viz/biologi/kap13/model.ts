/**
 * Kapittel 13 Formering (Bi 1): ren biologi uten React, testet i model.test.ts.
 *
 * 1. Kjønnet og ukjønnet formering: to bestander av samme art i et miljø som endrer seg (KM6, KM2).
 * 2. Menstruasjonssyklusen: skjematiske hormonkurver, follikkel, gulelegeme og livmorslimhinne (KM4, KM3).
 * 3. Planters formering: data for trinnene, kromosomtall og kloner (KM3).
 */
import { seededRandom } from '../kit';

/* ====================================================================== */
/* 1. Kjønnet og ukjønnet formering                                         */
/* ====================================================================== */

/*
 * Modell (generasjon for generasjon, deterministisk):
 * - Hvert individ har en arvelig egenskap: temperaturen det er best tilpasset (°C), delt i klasser på 0,5 °C.
 * - Overlevelsen er w = e^(−(z − T)² / 2σ²): størst når individets optimum z er lik temperaturen T i miljøet.
 * - Ukjønnet formering: alle individene er hunner og får avkom alene (4 per individ), og avkommet er kloner av mora.
 *   Mutasjoner som endrer egenskapen, er så sjeldne at de ikke er med i modellen.
 * - Kjønnet formering: bare hunnene får avkom, så det blir halvparten så mange avkom per individ (2, «den doble prisen
 *   for kjønnet formering»). Avkommet får gjennomsnittet av foreldrene pluss tilfeldig variasjon fra meiose og
 *   befruktning (den infinitesimale modellen i kvantitativ genetikk): uten seleksjon holder variansen seg på V₀.
 * - Tetthetsregulering (Beverton–Holt): N′ = λN / (1 + N/M), der λ = R · W̄ er avkom per individ og M er satt slik at
 *   en godt tilpasset bestand ligger på bæreevnen K. En dårlig tilpasset bestand (lavere λ) blir mindre, og den dør ut
 *   når λ < 1.
 * - Bestanden er utdødd når den er under ett individ (ukjønnet) eller under to (kjønnet, trenger et par). Klasser med
 *   under et halvt individ fjernes (en endelig bestand har ikke uendelig lange haler i fordelingen).
 * Tallene er valgt for å vise prinsippet (ikke en bestemt art). Forenklet: ingen konkurranse mellom bestandene, én
 * egenskap, og miljøet endrer seg bare én gang.
 */

export const TRAIT_MIN = 6;
export const TRAIT_MAX = 30;
export const TRAIT_STEP = 0.5;
export const TRAIT_CLASSES = Math.round((TRAIT_MAX - TRAIT_MIN) / TRAIT_STEP) + 1;
/** Temperaturen i miljøet ved start (°C), og optimum for klonen og gjennomsnittet i den kjønnede bestanden. */
export const START_TEMP = 15;
/** Toleranse σ (°C): hvor raskt overlevelsen faller når temperaturen er feil. */
export const TOLERANCE = 2.5;
/** Genetisk varians V₀ (°C²) i den kjønnede bestanden uten seleksjon (standardavvik 1,2 °C). */
export const SEX_VARIANCE = 1.44;
/** Klasser med færre individer enn dette fjernes. */
export const MIN_CLASS = 0.5;
/** Bæreevnen K (individer) for hver bestand. */
export const CAPACITY = 1000;
export const START_N = 20;
/** Avkom per individ med full overlevelse: ukjønnet (alle får avkom) og kjønnet (bare hunnene, halvparten). */
export const OFFSPRING_ASEX = 4;
export const OFFSPRING_SEX = 2;
/** Generasjonen da miljøet begynner å endre seg, og hvor lenge en gradvis endring varer. */
export const CHANGE_START = 25;
export const GRADUAL_GENERATIONS = 20;
export const GENERATIONS = 80;

export type ChangeKind = 'bra' | 'gradvis';
export type Reproduction = 'ukjonnet' | 'kjonnet';

export const traitValue = (i: number): number => TRAIT_MIN + i * TRAIT_STEP;
export const traitIndex = (z: number): number => Math.round((z - TRAIT_MIN) / TRAIT_STEP);

const smooth = (u: number) => {
  const x = Math.min(1, Math.max(0, u));
  return x * x * (3 - 2 * x);
};

/** Temperaturen i miljøet i generasjon `gen` når den stiger med `dT` °C, brått eller gradvis. */
export function environmentAt(gen: number, dT: number, kind: ChangeKind): number {
  if (gen < CHANGE_START) return START_TEMP;
  if (kind === 'bra') return START_TEMP + dT;
  return START_TEMP + dT * Math.min(1, (gen - CHANGE_START) / GRADUAL_GENERATIONS);
}

/** Sannsynligheten for å overleve til voksen alder for et individ med optimum z i temperaturen T. */
export function survival(z: number, T: number): number {
  return Math.exp(-((z - T) ** 2) / (2 * TOLERANCE ** 2));
}

/** Diskret normalfordeling over klassene med middelverdi `mean` og varians `variance` (summen er 1). */
export function discreteNormal(mean: number, variance: number): number[] {
  const p = Array.from({ length: TRAIT_CLASSES }, (_, i) => Math.exp(-((traitValue(i) - mean) ** 2) / (2 * variance)));
  const s = p.reduce((a, b) => a + b, 0);
  return p.map((v) => v / s);
}

/** Segregasjonsvariasjonen (meiose og befruktning) som en symmetrisk kjerne på klassene. */
const SEG_KERNEL: number[] = (() => {
  // Midtforelder-klassene deler halve klasser i to, det gir variansen TRAIT_STEP²/8 i tillegg; trekk den fra
  const v = SEX_VARIANCE / 2 - TRAIT_STEP ** 2 / 8;
  const m = Math.ceil((4 * Math.sqrt(v)) / TRAIT_STEP);
  const k = Array.from({ length: 2 * m + 1 }, (_, i) => Math.exp(-(((i - m) * TRAIT_STEP) ** 2) / (2 * v)));
  const s = k.reduce((a, b) => a + b, 0);
  return k.map((x) => x / s);
})();

/**
 * Avkommets fordeling ved kjønnet formering når foreldrene trekkes tilfeldig fra fordelingen `p` (summen 1):
 * gjennomsnittet av to foreldre (midtforelder) pluss segregasjonsvariasjon. Summen av svaret er 1 (minus det lille som
 * havner utenfor skalaen).
 */
export function sexualOffspring(input: readonly number[]): number[] {
  const n = input.length;
  const total = input.reduce((a, b) => a + b, 0);
  if (!(total > 0)) return new Array<number>(n).fill(0);
  const p = input.map((v) => v / total);
  const mid = new Array<number>(n).fill(0);
  for (let i = 0; i < n; i++) {
    const pi = p[i]!;
    if (pi === 0) continue;
    for (let j = 0; j < n; j++) {
      const w = pi * p[j]!;
      if (w === 0) continue;
      const s = i + j;
      if (s % 2 === 0) mid[s / 2]! += w;
      else {
        mid[(s - 1) / 2]! += w / 2;
        mid[(s + 1) / 2]! += w / 2;
      }
    }
  }
  const m = (SEG_KERNEL.length - 1) / 2;
  const out = new Array<number>(n).fill(0);
  for (let i = 0; i < n; i++) {
    const v = mid[i]!;
    if (v === 0) continue;
    for (let d = -m; d <= m; d++) {
      const j = i + d;
      if (j >= 0 && j < n) out[j]! += v * SEG_KERNEL[d + m]!;
    }
  }
  return out;
}

/** Ukjønnet formering: avkommet er kloner, så fordelingen er den samme som hos foreldrene som overlevde. */
export function asexualOffspring(p: readonly number[]): number[] {
  return [...p];
}

/** Middelverdi og standardavvik for en fordeling over klassene (vekter `n`). */
export function traitStats(n: readonly number[]): { mean: number; sd: number } {
  const N = n.reduce((a, b) => a + b, 0);
  if (!(N > 0)) return { mean: Number.NaN, sd: Number.NaN };
  let m = 0;
  n.forEach((v, i) => (m += v * traitValue(i)));
  m /= N;
  let v2 = 0;
  n.forEach((v, i) => (v2 += v * (traitValue(i) - m) ** 2));
  return { mean: m, sd: Math.sqrt(v2 / N) };
}

/**
 * Avkom per individ λ i en bestand som er perfekt tilpasset (gjennomsnittet er lik temperaturen): ukjønnet R, kjønnet
 * R · √(σ² / (σ² + V₀)) fordi variasjonen gjør at noen alltid er litt dårligere tilpasset.
 */
export function wellAdaptedLambda(mode: Reproduction): number {
  return mode === 'ukjonnet' ? OFFSPRING_ASEX : OFFSPRING_SEX * Math.sqrt(TOLERANCE ** 2 / (TOLERANCE ** 2 + SEX_VARIANCE));
}

/**
 * Ny bestandsstørrelse med Beverton–Holt-regulering N′ = λN / (1 + N/M) når hvert individ i snitt gir λ voksne avkom.
 * M = K / (λ_maks − 1), så en godt tilpasset bestand (λ = λ_maks) nærmer seg bæreevnen K.
 */
export function regulate(N: number, lambda: number, lambdaMax: number, K = CAPACITY): number {
  if (!(N > 0) || !(lambda > 0)) return 0;
  const M = K / Math.max(1e-9, lambdaMax - 1);
  return (lambda * N) / (1 + N / M);
}

export interface PopulationState {
  /** Antall individer i hver klasse. */
  n: number[];
  N: number;
  /** Gjennomsnittlig temperaturoptimum (NaN når bestanden er utdødd) og standardavvik. */
  mean: number;
  sd: number;
  /** Gjennomsnittlig overlevelse W̄ i miljøet denne generasjonen. */
  wbar: number;
  /** Avkom per individ som blir voksne: λ = R · W̄. */
  lambda: number;
}

export interface ReproductionRun {
  /** Temperaturen i hver generasjon 0 … GENERATIONS. */
  temp: number[];
  asex: PopulationState[];
  sex: PopulationState[];
}

function makeState(n: number[], T: number, R: number): PopulationState {
  const N = n.reduce((a, b) => a + b, 0);
  const { mean, sd } = traitStats(n);
  let s = 0;
  n.forEach((v, i) => (s += v * survival(traitValue(i), T)));
  const wbar = N > 0 ? s / N : 0;
  return { n, N, mean, sd, wbar, lambda: R * wbar };
}

/** Kjører begge bestandene i GENERATIONS generasjoner fra START_N individer. */
export function simulateReproduction(dT: number, kind: ChangeKind, generations = GENERATIONS): ReproductionRun {
  const temp: number[] = [];
  const asex: PopulationState[] = [];
  const sex: PopulationState[] = [];
  let nA = new Array<number>(TRAIT_CLASSES).fill(0);
  nA[traitIndex(START_TEMP)] = START_N;
  let nS = discreteNormal(START_TEMP, SEX_VARIANCE).map((p) => p * START_N);
  for (let g = 0; g <= generations; g++) {
    const T = environmentAt(g, dT, kind);
    temp.push(T);
    const a = makeState(nA, T, OFFSPRING_ASEX);
    const s = makeState(nS, T, OFFSPRING_SEX);
    asex.push(a);
    sex.push(s);
    nA = nextGeneration(a, T, 'ukjonnet');
    nS = nextGeneration(s, T, 'kjonnet');
  }
  return { temp, asex, sex };
}

function nextGeneration(st: PopulationState, T: number, mode: Reproduction): number[] {
  const empty = () => new Array<number>(TRAIT_CLASSES).fill(0);
  if (!(st.N > 0)) return empty();
  // Seleksjon: de som overlever til de får avkom
  const survivors = st.n.map((v, i) => v * survival(traitValue(i), T));
  const S = survivors.reduce((a, b) => a + b, 0);
  if (!(S > 0)) return empty();
  const p = survivors.map((v) => v / S);
  const offspring = mode === 'ukjonnet' ? asexualOffspring(p) : sexualOffspring(p);
  // Bestanden kan ikke bli større enn bæreevnen (selv om seleksjonen et øyeblikk har gjort variasjonen mindre)
  const N1 = Math.min(CAPACITY, regulate(st.N, st.lambda, wellAdaptedLambda(mode)));
  const minimum = mode === 'ukjonnet' ? 1 : 2;
  if (!(N1 >= minimum)) return empty();
  const total = offspring.reduce((a, b) => a + b, 0);
  if (!(total > 0)) return empty();
  // Fjern klasser med under et halvt individ og fordel de andre så summen fortsatt er N′
  const counts = offspring.map((v) => (v / total) * N1);
  const kept = counts.map((v) => (v >= MIN_CLASS ? v : 0));
  const keptSum = kept.reduce((a, b) => a + b, 0);
  if (!(keptSum > 0)) {
    // Svært liten bestand: alle havner i den vanligste klassen
    const best = counts.indexOf(Math.max(...counts));
    return counts.map((_, i) => (i === best ? N1 : 0));
  }
  return kept.map((v) => (v / keptSum) * N1);
}

/** Første generasjon bestanden er minst `share` av bæreevnen (null hvis aldri). */
export function generationsToCapacity(states: readonly PopulationState[], share = 0.95): number | null {
  const i = states.findIndex((s) => s.N >= share * CAPACITY);
  return i < 0 ? null : i;
}

/** Første generasjon bestanden er utdødd (null hvis den lever hele tida). */
export function extinctionGeneration(states: readonly PopulationState[]): number | null {
  const i = states.findIndex((s, k) => k > 0 && !(s.N > 0));
  return i < 0 ? null : i;
}

/** Laveste bestand etter at miljøet begynte å endre seg. */
export function minimumAfterChange(states: readonly PopulationState[]): number {
  return Math.min(...states.slice(CHANGE_START).map((s) => s.N));
}

/** Verdien z der en andel `u` (0–1) av bestanden har lavere optimum (kvantil). NaN for en tom bestand. */
export function traitQuantile(n: readonly number[], u: number): number {
  const N = n.reduce((a, b) => a + b, 0);
  if (!(N > 0)) return Number.NaN;
  const target = Math.min(1, Math.max(0, u)) * N;
  let acc = 0;
  for (let i = 0; i < n.length; i++) {
    const v = n[i]!;
    if (acc + v >= target && v > 0) {
      // Jevnt fordelt innenfor klassen (bredde TRAIT_STEP)
      const within = (target - acc) / v;
      return traitValue(i) + (within - 0.5) * TRAIT_STEP;
    }
    acc += v;
  }
  return traitValue(n.length - 1);
}

/** Faste «individer» i figuren: rang u (0–1), plass i høyden y (0–1) og en liten forskyvning sidelengs. */
export interface Specimen {
  u: number;
  y: number;
  jitter: number;
}

export function specimens(count: number, seed: number): Specimen[] {
  const rnd = seededRandom(seed);
  // Jevnt spredte ranger (én i hver bit av fordelingen) …
  const list = Array.from({ length: count }, (_, i) => ({ u: (i + rnd()) / count, y: rnd(), jitter: rnd() * 2 - 1 }));
  // … i tilfeldig rekkefølge, så de første som vises når bestanden er liten, er spredt over hele fordelingen
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [list[i], list[j]] = [list[j]!, list[i]!];
  }
  return list;
}

/* ====================================================================== */
/* 2. Menstruasjonssyklusen                                                 */
/* ====================================================================== */

/*
 * Skjematiske kurver (relative nivåer 0–1) slik lærebøkene tegner dem, ikke målte verdier: dag 1 er første
 * menstruasjonsdag, syklusen er 28 dager, og eggløsningen skjer dag 14. Kurvene er summer av glatte topper (Gauss-kurver)
 * som gjentas hver 28. dag. Livmorslimhinnen er ca. 2 mm etter menstruasjonen og 10–14 mm i gulelegemefasen
 * (typiske ultralydverdier). Kilder for formen: lærebokfigurer (Bi 1, Bios 1) og Store medisinske leksikon.
 */

export type CycleScenario = 'vanlig' | 'graviditet' | 'p-piller';
export const CYCLE_DAYS = 28;
export const OVULATION_DAY = 14;
/** Siste dag på tidsaksen: graviditeten følges til dag 42 (seks uker etter siste menstruasjon). */
export const lastDay = (s: CycleScenario): number => (s === 'graviditet' ? 42 : CYCLE_DAYS);
/** Dager med aktive piller i en kombinasjonspille (21 + 7 pillefrie dager). */
export const PILL_DAYS = 21;
export const FERTILIZATION_DAY = 15;
export const IMPLANTATION_DAY = 21;

/** Gauss-topp som gjentas hver 28. dag. */
function peak(t: number, mu: number, s: number): number {
  let v = 0;
  for (const k of [-1, 0, 1]) v += Math.exp(-((t - mu - k * CYCLE_DAYS) ** 2) / (2 * s * s));
  return v;
}

/** Dagen i en vanlig syklus (1 ≤ t < 29) for en hvilken som helst dag. */
const inCycle = (t: number) => ((((t - 1) % CYCLE_DAYS) + CYCLE_DAYS) % CYCLE_DAYS) + 1;

export interface Hormones {
  /** Follikkelstimulerende hormon fra hypofysen. */
  fsh: number;
  /** Luteiniserende hormon fra hypofysen. */
  lh: number;
  /** Østrogen fra follikkelen (og senere gulelegemet). */
  ostrogen: number;
  /** Progesteron fra gulelegemet. */
  progesteron: number;
  /** hCG fra embryoet (senere morkaken). 0 uten graviditet. */
  hcg: number;
  /** Syntetisk østrogen og gestagen fra p-pillen. 0 uten p-piller. */
  pille: number;
}

function normalHormones(day: number): Hormones {
  const t = inCycle(day);
  return {
    fsh: 0.16 + 0.24 * peak(t, 2.5, 3.5) + 0.34 * peak(t, 13.4, 0.9),
    lh: 0.12 + 0.88 * peak(t, 13.4, 0.8),
    ostrogen: 0.15 + 0.8 * peak(t, 12.5, 2.4) + 0.38 * peak(t, 21.5, 3),
    progesteron: 0.04 + 0.92 * peak(t, 21.5, 3.2),
    hcg: 0,
    pille: 0,
  };
}

/** hCG stiger etter innfestingen (dobles omtrent annenhver dag) og flater ut. */
export function hcgLevel(day: number): number {
  if (day < IMPLANTATION_DAY) return 0;
  return 1 / (1 + Math.exp(-(day - 33) / 2));
}

/** Hormonnivåene (relative, skjematiske) på dag `day` (1 ≤ day ≤ lastDay). */
export function hormonesAt(day: number, s: CycleScenario): Hormones {
  if (s === 'vanlig') return normalHormones(day);
  if (s === 'graviditet') {
    if (day <= 21.5) return { ...normalHormones(day), hcg: hcgLevel(day) };
    const at = normalHormones(21.5);
    const late = normalHormones(Math.min(day, 22));
    const u = smooth((day - 21.5) / 20);
    return {
      // Negativ tilbakekobling fra progesteron og østrogen holder FSH og LH lave
      fsh: late.fsh,
      lh: late.lh,
      ostrogen: at.ostrogen + 0.3 * u,
      progesteron: at.progesteron + 0.1 * u,
      hcg: hcgLevel(day),
      pille: 0,
    };
  }
  // Kombinasjonspille: 21 dager med piller, så 7 pillefrie dager
  const t = inCycle(day);
  const free = smooth((t - (PILL_DAYS + 1)) / 6);
  const onPill = t < PILL_DAYS + 1;
  return {
    fsh: 0.12 + 0.1 * free,
    lh: 0.07 + 0.06 * free,
    ostrogen: 0.22 + 0.08 * free,
    progesteron: 0.04,
    hcg: 0,
    pille: onPill ? 0.7 : 0,
  };
}

/** Tykkelsen på livmorslimhinnen (mm). */
export function endometrium(day: number, s: CycleScenario): number {
  if (s === 'p-piller') {
    const t = inCycle(day);
    if (t < PILL_DAYS + 1) return 2 + 2.5 * smooth((t - 1) / PILL_DAYS);
    if (t < 23.5) return 4.5;
    return 4.5 - 2.5 * smooth((t - 23.5) / 4);
  }
  if (s === 'graviditet' && day >= 23) return 12 + 2 * smooth((day - 23) / 19);
  const t = inCycle(day);
  if (t < 5) return 11 - 9 * smooth((t - 1) / 4);
  if (t < 14) return 2 + 7 * smooth((t - 5) / 9);
  if (t < 23) return 9 + 3 * smooth((t - 14) / 9);
  return 12 - smooth((t - 23) / 5);
}

/** Blødning: menstruasjon (dag 1–5) eller bortfallsblødning i den pillefrie uka. */
export function bleeding(day: number, s: CycleScenario): boolean {
  if (s === 'p-piller') {
    const t = inCycle(day);
    return t >= 23.5 && t < 27.5;
  }
  if (s === 'graviditet') return day < 6;
  return inCycle(day) < 6;
}

export type OvaryStage = 'follikkel' | 'eggløsning' | 'gulelegeme' | 'tilbakedannes' | 'hvilende';

/** Det som skjer i eggstokken: follikkel som vokser, eggløsning, gulelegeme som lever eller går til grunne. */
export function ovaryAt(day: number, s: CycleScenario): { stage: OvaryStage; size: number } {
  if (s === 'p-piller') {
    const t = inCycle(day);
    // Små follikler som ikke modnes; de vokser litt i den pillefrie uka
    return { stage: 'hvilende', size: 4 + 3 * smooth((t - (PILL_DAYS + 1)) / 7) };
  }
  const t = s === 'graviditet' ? day : inCycle(day);
  if (t < OVULATION_DAY - 0.5) return { stage: 'follikkel', size: 4 + 18 * ((Math.max(1, t) - 1) / 13) ** 1.6 };
  if (t < OVULATION_DAY + 0.5) return { stage: 'eggløsning', size: 22 };
  if (s === 'graviditet') return { stage: 'gulelegeme', size: 12 + 9 * smooth((t - 14.5) / 6) };
  if (t < 24) return { stage: 'gulelegeme', size: 12 + 8 * smooth((t - 14.5) / 6) };
  return { stage: 'tilbakedannes', size: 20 - 12 * smooth((t - 24) / 4.5) };
}

export type CyclePhase = 'menstruasjon' | 'follikkelfase' | 'eggløsning' | 'gulelegemefase' | 'graviditet' | 'pille' | 'pillefri';

export const PHASE_NAMES: Record<CyclePhase, string> = {
  menstruasjon: 'Menstruasjon',
  follikkelfase: 'Follikkelfase',
  eggløsning: 'Eggløsning',
  gulelegemefase: 'Gulelegemefase',
  graviditet: 'Graviditet',
  pille: 'Aktive piller',
  pillefri: 'Pillefri uke',
};

export function phaseAt(day: number, s: CycleScenario): CyclePhase {
  if (s === 'p-piller') return inCycle(day) < PILL_DAYS + 1 ? 'pille' : 'pillefri';
  const t = s === 'graviditet' ? day : inCycle(day);
  if (t < 6) return 'menstruasjon';
  if (t < OVULATION_DAY - 0.5) return 'follikkelfase';
  if (t < OVULATION_DAY + 0.5) return 'eggløsning';
  if (s === 'graviditet' && t >= IMPLANTATION_DAY) return 'graviditet';
  return 'gulelegemefase';
}

/** Fasene som felter langs tidsaksen: [fra, til, fase]. */
export function phaseBands(s: CycleScenario): [number, number, CyclePhase][] {
  if (s === 'p-piller')
    return [
      [1, PILL_DAYS + 1, 'pille'],
      [PILL_DAYS + 1, CYCLE_DAYS + 1, 'pillefri'],
    ];
  const bands: [number, number, CyclePhase][] = [
    [1, 6, 'menstruasjon'],
    [6, OVULATION_DAY - 0.5, 'follikkelfase'],
    [OVULATION_DAY - 0.5, OVULATION_DAY + 0.5, 'eggløsning'],
  ];
  if (s === 'graviditet') bands.push([OVULATION_DAY + 0.5, IMPLANTATION_DAY, 'gulelegemefase'], [IMPLANTATION_DAY, 43, 'graviditet']);
  else bands.push([OVULATION_DAY + 0.5, CYCLE_DAYS + 1, 'gulelegemefase']);
  return bands;
}

/**
 * Hvilken tilbakekobling som styrer hypofysen nå:
 * - `negativ`: østrogen (og senere progesteron) hemmer utskillingen av FSH og LH
 * - `positiv`: mye østrogen over flere døgn får hypofysen til å skille ut mye LH (LH-toppen)
 * - `svekkes`: gulelegemet går til grunne, progesteronet faller og FSH kan stige igjen
 * - `hcg`: hCG fra embryoet holder gulelegemet i live, og høyt progesteron hemmer FSH og LH
 * - `pille`: syntetiske hormoner fra p-pillen hemmer FSH og LH
 */
export type Feedback = 'negativ-ostrogen' | 'positiv' | 'negativ-progesteron' | 'svekkes' | 'hcg' | 'pille';

export function feedbackAt(day: number, s: CycleScenario): Feedback {
  if (s === 'p-piller') return inCycle(day) < PILL_DAYS + 1 ? 'pille' : 'svekkes';
  const t = s === 'graviditet' ? day : inCycle(day);
  if (t < 11.5) return 'negativ-ostrogen';
  if (t < OVULATION_DAY) return 'positiv';
  if (s === 'graviditet' && t >= IMPLANTATION_DAY) return 'hcg';
  if (t < 25) return 'negativ-progesteron';
  return 'svekkes';
}

/** Dagen med høyest verdi av en hormonkurve (prøver hver tiendedels dag). */
export function peakDay(key: keyof Hormones, s: CycleScenario, from = 1, to = lastDay(s)): number {
  let best = from;
  let bestV = -Infinity;
  for (let d = from; d <= to + 1e-9; d += 0.1) {
    const v = hormonesAt(d, s)[key];
    if (v > bestV) {
      bestV = v;
      best = d;
    }
  }
  return best;
}

/* ====================================================================== */
/* 3. Planters formering                                                    */
/* ====================================================================== */

/*
 * Blomsterplanter (dekkfrøede planter). Kromosomtall som i lærebøkene: morplanta og kimen er diploide (2n), pollenkorn,
 * sædceller, eggcelle og polkjerner er haploide (n), og frøhviten er triploid (3n) etter den doble befruktningen.
 * Frøskallet og fruktveggen er morplantas vev (2n). Vegetativ formering gir kloner: alle genene er like morplantas.
 */

export type SexualStep = 'blomsten' | 'pollinering' | 'pollenslange' | 'befruktning' | 'fro-og-frukt';
export type VegetativeStep = 'utlopere' | 'knoller';

export const SEXUAL_STEPS: { id: SexualStep; title: string }[] = [
  { id: 'blomsten', title: 'Blomsten' },
  { id: 'pollinering', title: 'Pollinering' },
  { id: 'pollenslange', title: 'Pollenslangen' },
  { id: 'befruktning', title: 'Dobbel befruktning' },
  { id: 'fro-og-frukt', title: 'Frø og frukt' },
];

export const VEGETATIVE_STEPS: { id: VegetativeStep; title: string }[] = [
  { id: 'utlopere', title: 'Utløpere (jordbær)' },
  { id: 'knoller', title: 'Knoller (potet)' },
];

/** Kromosomsett (n = 1, 2n = 2, 3n = 3) i delene av planta. */
export const PLOIDY = {
  morplante: 2,
  pollenkorn: 1,
  saedcelle: 1,
  eggcelle: 1,
  polkjerne: 1,
  zygote: 2,
  kim: 2,
  frohvite: 3,
  froskall: 2,
  fruktvegg: 2,
  klon: 2,
} as const;

export type PlantPart = keyof typeof PLOIDY;

/** Kromosomsettene når cellekjerner smelter sammen (befruktning): summen av settene. */
export function fuse(...parts: PlantPart[]): number {
  return parts.reduce((a, p) => a + PLOIDY[p], 0);
}

/** Tekst for antall kromosomsett: 1 → «n», 2 → «2n», 3 → «3n». */
export function ploidyText(sets: number): string {
  return sets === 1 ? 'n' : `${sets}n`;
}

/** Andel av genene avkommet har felles med morplanta: kloner 100 %, frø fra krysspollinering 50 %. */
export function sharedWithMother(kind: 'klon' | 'fro'): number {
  return kind === 'klon' ? 1 : 0.5;
}
