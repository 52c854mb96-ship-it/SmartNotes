/**
 * Ren fysikk for eksempeloppgaven «Aktivitet og halveringstid i medisin» (kapittel 8, 8A–8B): les av halveringstiden
 * på en graf, regn ut aktiviteten etter en tid med A = A₀ · (1/2)^(t/T½), finn tiden til aktiviteten har sunket til
 * en gitt andel (med logaritmer og kontroll på grafen), og sammenlign andelen som er igjen med et tenkt stoff med mye
 * lengre halveringstid.
 *
 * Egen modell (bruker ikke model.ts). Halveringstidene er tabellverdier avrundet som i boka (Tc-99m 6,0 h, I-131
 * 8,0 døgn, F-18 110 min). Situasjonene og tallene er laget for appen.
 */

export type TimeUnit = 'min' | 'h' | 'døgn';

/** Hvor mange timer én enhet er. */
export const HOURS_PER: Record<TimeUnit, number> = { min: 1 / 60, h: 1, døgn: 24 };

/** Gjør om en tid fra én enhet til en annen. */
export function convertTime(value: number, from: TimeUnit, to: TimeUnit): number {
  return (value * HOURS_PER[from]) / HOURS_PER[to];
}

/** Radioaktiv halvering: aktiviteten etter tida t, A = A₀ · (1/2)^(t/T½). t og T½ i samme enhet. */
export function activity(A0: number, t: number, T: number): number {
  if (!(T > 0) || !Number.isFinite(t)) return Number.NaN;
  return A0 * 0.5 ** (t / T);
}

/** Andelen som er igjen etter tida t: (1/2)^(t/T½). */
export function fractionLeft(t: number, T: number): number {
  return activity(1, t, T);
}

/**
 * Tida det tar før andelen p er igjen: (1/2)^(t/T½) = p gir t = T½ · lg p / lg 0,5.
 * p ≥ 1 gir 0, p ≤ 0 gir uendelig (aktiviteten blir aldri helt null).
 */
export function timeToFraction(p: number, T: number): number {
  if (Number.isNaN(p) || !(T > 0)) return Number.NaN;
  if (p >= 1) return 0;
  if (p <= 0) return Number.POSITIVE_INFINITY;
  return (T * Math.log10(p)) / Math.log10(0.5);
}

/** Tallet avrundet til n gjeldende siffer. */
export function sig(v: number, n: number): number {
  if (!Number.isFinite(v) || v === 0) return v;
  return Number(v.toPrecision(n));
}

/** Avrund til nærmeste multiplum av `step` (avlesning på en graf med rutenett). */
export function roundTo(v: number, step: number): number {
  return Math.round(v / step) * step;
}

/* ---------- Tidspunkter i teksten ---------- */

/** Klokkeslett fra timer etter midnatt: 7,5 → «07.30», 34,0 → «10.00» (neste dag). */
export function clockText(hours: number): string {
  const total = Math.round((((hours % 24) + 24) % 24) * 60);
  const h = Math.floor(total / 60) % 24;
  const m = total % 60;
  return `${String(h).padStart(2, '0')}.${String(m).padStart(2, '0')}`;
}

export const WEEKDAYS = ['mandag', 'tirsdag', 'onsdag', 'torsdag', 'fredag', 'lørdag', 'søndag'] as const;

/** Ukedagen `days` døgn etter dag nummer `start` (0 = mandag). */
export function weekdayAfter(start: number, days: number): string {
  const i = (((start + Math.round(days)) % 7) + 7) % 7;
  return WEEKDAYS[i] ?? 'mandag';
}

/** Minutter som timer og minutter: 75 → «1 h 15 min», 45 → «45 min», 120 → «2 h». */
export function hourMinText(minutes: number): string {
  const total = Math.round(minutes);
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h} h`;
  return `${h} h ${m} min`;
}

/* ---------- Oppgavene ---------- */

/** Hvordan tida fra målingen til pasienten får stoffet står i teksten. */
export type StartTime =
  | { kind: 'klokke'; start: number } // klokkeslett (timer etter midnatt)
  | { kind: 'dag'; start: number } // ukedag (0 = mandag)
  | { kind: 'varighet' }; // en varighet («transporten tar 1 h 15 min»)

export interface ActivityTask {
  id: 'tc' | 'jod' | 'fluor';
  /** Navnet i teksten: «technetium-99m». */
  name: string;
  /** Kort navn: «Tc-99m». */
  short: string;
  /** Kjernesymbolet: nukleontall, «m» for metastabil og grunnstoffsymbolet. */
  nuclide: { A: number; meta: boolean; symbol: string };
  /** Halveringstida (i `unit`). */
  T: number;
  unit: TimeUnit;
  /** Desimaler for tider i `unit` i teksten (6,0 h, 8,0 døgn, 110 min). */
  dec: number;
  /** Aktiviteten ved målingen (MBq). */
  A0: number;
  /** Tida fra målingen til pasienten får stoffet (i `unit`). */
  tB: number;
  when: StartTime;
  /** Andelen i deloppgave c (0,10 = 10 %). */
  p: number;
  /** Tida etter innsprøytingen i deloppgave d (i `unit`), og den samme tida slik den står i teksten. */
  tD: number;
  tDText: { value: number; unit: TimeUnit | 'uker'; dec: number; words?: string };
  /** Halveringstida til det tenkte stoffet i deloppgave d (i `unit`), og slik den står i teksten. */
  TLong: number;
  TLongText: { value: number; unit: TimeUnit; dec: number };
  /** Grafen: tidsaksen og aktivitetsaksen (store og små ruter) og hvor nøyaktig vi leser av tida. */
  graph: { xMax: number; xStep: number; xMinor: number; yMax: number; yStep: number; yMinor: number; read: number };
  /** Gjeldende siffer i svaret på c. */
  sigC: number;
}

export const ACTIVITY_TASKS: readonly ActivityTask[] = [
  {
    id: 'tc',
    name: 'technetium-99m',
    short: 'Tc-99m',
    nuclide: { A: 99, meta: true, symbol: 'Tc' },
    T: 6.0,
    unit: 'h',
    dec: 1,
    A0: 800,
    tB: 2.5,
    when: { kind: 'klokke', start: 7.5 },
    p: 0.1,
    tD: 24,
    tDText: { value: 1, unit: 'døgn', dec: 0, words: 'ett døgn' },
    TLong: 144,
    TLongText: { value: 6.0, unit: 'døgn', dec: 1 },
    graph: { xMax: 30, xStep: 6, xMinor: 1, yMax: 800, yStep: 200, yMinor: 50, read: 0.5 },
    sigC: 2,
  },
  {
    id: 'jod',
    name: 'jod-131',
    short: 'I-131',
    nuclide: { A: 131, meta: false, symbol: 'I' },
    T: 8.0,
    unit: 'døgn',
    dec: 1,
    A0: 700,
    tB: 3.0,
    when: { kind: 'dag', start: 0 },
    p: 0.05,
    tD: 28,
    tDText: { value: 4, unit: 'uker', dec: 0, words: 'fire uker' },
    TLong: 80,
    TLongText: { value: 80, unit: 'døgn', dec: 0 },
    graph: { xMax: 40, xStep: 8, xMinor: 1, yMax: 700, yStep: 100, yMinor: 50, read: 0.5 },
    sigC: 2,
  },
  {
    id: 'fluor',
    name: 'fluor-18',
    short: 'F-18',
    nuclide: { A: 18, meta: false, symbol: 'F' },
    T: 110,
    unit: 'min',
    dec: 0,
    A0: 500,
    tB: 75,
    when: { kind: 'varighet' },
    p: 0.1,
    tD: 480,
    tDText: { value: 8.0, unit: 'h', dec: 1 },
    TLong: 1440,
    TLongText: { value: 1.0, unit: 'døgn', dec: 1 },
    graph: { xMax: 600, xStep: 100, xMinor: 20, yMax: 500, yStep: 100, yMinor: 25, read: 10 },
    sigC: 3,
  },
];

/* ---------- Løsningen ---------- */

export interface ActivitySolution {
  /** a) Avlesningene på grafen: start, én og to halveringstider. */
  halvings: { t: number; A: number }[];
  /** b) Antall halveringstider fram til innsprøytingen, faktoren (1/2)^n og aktiviteten da. */
  nB: number;
  factorB: number;
  Ab: number;
  /** Andelen som er borte før pasienten får stoffet (1 − faktoren). */
  lostB: number;
  /** Den vanlige feilen: å trekke fra en jevn andel av den første halveringen, A₀ − (A₀/2) · n. */
  linearWrong: number;
  /** c) lg p, lg 0,5, antall halveringstider n = lg p / lg 0,5 og tida t = n · T½ (fra innsprøytingen). */
  lgP: number;
  lgHalf: number;
  nC: number;
  tC: number;
  /** Aktiviteten vi leter etter (p · Ab), tidspunktet på grafen (fra målingen) og avlesningen. */
  Ac: number;
  tCross: number;
  tRead: number;
  /** Avlest tid minus tida før innsprøytingen. */
  tReadDiff: number;
  /** Overslaget: c ligger mellom k og k + 1 halveringstider. */
  between: { k: number; fracHigh: number; fracLow: number; t1: number; t2: number };
  /** d) Andelen igjen etter tD for stoffet og for det tenkte stoffet, aktivitetene og forholdet mellom halveringstidene. */
  nD: number;
  fD: number;
  AD: number;
  nDLong: number;
  fDLong: number;
  ADLong: number;
  ratio: number;
}

export function solveActivityTask(task: ActivityTask): ActivitySolution {
  const { A0, T, tB, p, tD, TLong } = task;
  const halvings = [0, 1, 2].map((k) => ({ t: k * T, A: activity(A0, k * T, T) }));

  const nB = tB / T;
  const factorB = fractionLeft(tB, T);
  const Ab = A0 * factorB;

  const lgP = Math.log10(p);
  const lgHalf = Math.log10(0.5);
  const nC = lgP / lgHalf;
  const tC = timeToFraction(p, T);
  const tCross = tB + tC;
  const tRead = roundTo(tCross, task.graph.read);
  const k = Math.floor(nC);

  const nD = tD / T;
  const fD = fractionLeft(tD, T);
  const nDLong = tD / TLong;
  const fDLong = fractionLeft(tD, TLong);

  return {
    halvings,
    nB,
    factorB,
    Ab,
    lostB: 1 - factorB,
    linearWrong: A0 - (A0 / 2) * nB,
    lgP,
    lgHalf,
    nC,
    tC,
    Ac: p * Ab,
    tCross,
    tRead,
    tReadDiff: tRead - tB,
    between: { k, fracHigh: 0.5 ** k, fracLow: 0.5 ** (k + 1), t1: k * T, t2: (k + 1) * T },
    nD,
    fD,
    AD: Ab * fD,
    nDLong,
    fDLong,
    ADLong: Ab * fDLong,
    ratio: TLong / T,
  };
}

/** Tidspunktene i teksten: når målingen er gjort og når pasienten får stoffet (eller hvor lang tid det tar imellom). */
export function startTexts(task: ActivityTask): { measured: string; given: string; diff: string } {
  const w = task.when;
  if (w.kind === 'klokke') {
    return {
      measured: `klokka ${clockText(w.start)}`,
      given: `klokka ${clockText(w.start + convertTime(task.tB, task.unit, 'h'))}`,
      diff: hourMinText(convertTime(task.tB, task.unit, 'min')),
    };
  }
  if (w.kind === 'dag') {
    const measured = WEEKDAYS[w.start] ?? 'mandag';
    const given = weekdayAfter(w.start, convertTime(task.tB, task.unit, 'døgn'));
    return { measured, given, diff: `fra ${measured} til ${given}` };
  }
  return { measured: 'ved utsending', given: 'når den kommer fram', diff: hourMinText(convertTime(task.tB, task.unit, 'min')) };
}

/**
 * Kurven A(t) som punkter (tid i `unit`, MBq) fra t0 til t1, med halvering T. Brukes i grafen.
 * `start` er aktiviteten ved t0.
 */
export function decayCurve(start: number, t0: number, t1: number, T: number, n = 160): [number, number][] {
  const pts: [number, number][] = [];
  if (!(t1 > t0)) return pts;
  for (let i = 0; i <= n; i++) {
    const t = t0 + ((t1 - t0) * i) / n;
    pts.push([t, activity(start, t - t0, T)]);
  }
  return pts;
}
