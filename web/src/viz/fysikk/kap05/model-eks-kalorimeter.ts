/**
 * Eksempeloppgaven «Hvilket metall er det?» (k5-eks-kalorimeter, 5C–5D).
 *
 * En metallbit har ligget lenge i kokende vann (T_m = 100,0 °C) og senkes raskt ned i vann i et isolert beger
 * (kalorimeter). Termometeret stopper på likevektstemperaturen T_s. Med energibevaring og Q = cmΔT finner vi den
 * spesifikke varmekapasiteten til metallet og sammenligner med tabellverdier:
 *
 *   Vannet mottar:               Q_v = c_v · m_v · (T_s − T_v)
 *   Uten varmetap:               c_m · m_m · (T_m − T_s) = Q_v      ⇒ c_m = Q_v / (m_m · (T_m − T_s))
 *   Likevekt med tabellverdien:  T = (c m_m T_m + c_v m_v T_v) / (c m_m + c_v m_v)
 *   Energi som gikk tapt:        Q_tap = c · m_m · (T_m − T_s) − Q_v,  andel = Q_tap / Q_m = 1 − c_m / c
 *
 * Tallsettene er laget så den målte varmekapasiteten er 5–7 % lavere enn tabellverdien, slik den blir i et ekte
 * forsøk der litt energi går til isoporen, lokket og lufta. Varmekapasiteten til selve kalorimeteret og
 * termometeret ser vi bort fra.
 */

/** Spesifikk varmekapasitet for vann (J/(kg·K)), som i resten av kapittelet. */
export const C_WATER = 4180;
/** Tettheten til vann (kg/m³), til vannstanden i figuren. */
export const RHO_WATER = 1000;

export type MetalKey = 'aluminium' | 'titan' | 'jern' | 'kobber' | 'solv' | 'bly';

export interface MetalEntry {
  id: MetalKey;
  /** Navnet i tabellen (bokmål, stor forbokstav). */
  name: string;
  /** Spesifikk varmekapasitet ved romtemperatur (J/(kg·K)), avrundet som i en tabell. */
  c: number;
  /** Tetthet (kg/m³), bare for å tegne biten i riktig størrelse. */
  rho: number;
}

/**
 * Tabellen i oppgaven, sortert etter c (størst først). Verdiene er avrundede tabellverdier ved romtemperatur
 * (aluminium 897, titan 523, jern 449, kobber 385, sølv 235, bly 129 J/(kg·K)); kobber er 390 som ellers i kapittelet.
 */
export const METAL_TABLE: MetalEntry[] = [
  { id: 'aluminium', name: 'Aluminium', c: 900, rho: 2700 },
  { id: 'titan', name: 'Titan', c: 520, rho: 4510 },
  { id: 'jern', name: 'Jern', c: 450, rho: 7870 },
  { id: 'kobber', name: 'Kobber', c: 390, rho: 8960 },
  { id: 'solv', name: 'Sølv', c: 240, rho: 10490 },
  { id: 'bly', name: 'Bly', c: 130, rho: 11340 },
];

export function metalEntry(id: MetalKey): MetalEntry {
  return METAL_TABLE.find((e) => e.id === id) ?? METAL_TABLE[0]!;
}

export interface CalorimeterTask {
  /** Metallet biten faktisk er laget av (bare til figuren og testene; eleven skal finne det). */
  metal: MetalKey;
  /** Massen til metallbiten (kg). */
  mMetal: number;
  /** Massen til vannet i kalorimeteret (kg). */
  mWater: number;
  /** Temperaturen til vannet før biten senkes ned (°C). */
  TWater: number;
  /** Temperaturen til metallbiten (°C): kokende vann ved vanlig lufttrykk. */
  TMetal: number;
  /** Likevektstemperaturen termometeret viser til slutt (°C), med én desimal som på et termometer. */
  TEnd: number;
}

/**
 * Tre tallsett: aluminium, jern og bly. Vannet dekker biten i kalorimeteret (se `calorimeterFill`), og den målte
 * varmekapasiteten havner 5–7 % under tabellverdien. I tallsett 2 ligger kobber (390) nesten like nær som jern
 * (450); varmetapet i d) avgjør at det er jern.
 */
export const CALORIMETER_TASKS: CalorimeterTask[] = [
  { metal: 'aluminium', mMetal: 0.25, mWater: 0.4, TWater: 18, TMetal: 100, TEnd: 27.2 },
  { metal: 'jern', mMetal: 0.5, mWater: 0.45, TWater: 16, TMetal: 100, TEnd: 24.6 },
  { metal: 'bly', mMetal: 1.2, mWater: 0.4, TWater: 15, TMetal: 100, TEnd: 21.8 },
];

export interface TableMatch {
  entry: MetalEntry;
  /** Relativt avvik mellom målt og tabellverdi: (c_målt − c) / c. Negativt når målingen er lavest. */
  dev: number;
}

export interface CalorimeterSolution {
  /** Temperaturøkningen til vannet, T_s − T_v (K). */
  dTWater: number;
  /** Temperaturfallet til metallet, T_m − T_s (K). */
  dTMetal: number;
  /** Varmekapasiteten til vannet c_v · m_v (J/K). */
  CWater: number;
  /** Energien vannet mottok, Q_v = c_v m_v ΔT_v (J). */
  Qw: number;
  /** Den målte spesifikke varmekapasiteten til metallet (J/(kg·K)), uten varmetap. */
  c: number;
  /** c avrundet til to gjeldende siffer, til «Vis at»-teksten (f.eks. 840). */
  cRounded: number;
  /** Alle metallene i tabellen med avviket, sortert etter |avvik| (nærmest først). */
  ranking: TableMatch[];
  /** Det nærmeste metallet i tabellen. */
  best: TableMatch;
  /** Det nest nærmeste metallet (til sammenligning i c). */
  runnerUp: TableMatch;
  /**
   * Metallet i tabellen med nærmeste c-verdi under målingen, når det ligger innenfor 15 % (ellers null). Varmetapet
   * gjør målingen for lav, så et slikt metall er mindre sannsynlig enn det over (drøftes i d).
   */
  closeBelow: TableMatch | null;
  /** Tabellverdien for det nærmeste metallet (J/(kg·K)). */
  cTable: number;
  /** Varmekapasiteten til metallbiten med tabellverdien, c · m_m (J/K). */
  CMetal: number;
  /** Likevektstemperaturen uten varmetap med tabellverdien (°C). */
  TIdeal: number;
  /** Energien metallet avgir (og vannet mottar) uten varmetap: c · m_m · (T_m − T) (J). */
  QIdeal: number;
  /** Energien metallbiten avga fra 100 °C ned til den målte T_s, med tabellverdien: c · m_m · (T_m − T_s) (J). */
  QMetal: number;
  /** Energien som ikke havnet i vannet, Q_m − Q_v (J). */
  QLoss: number;
  /** Andelen av energien fra metallet som gikk tapt, Q_tap / Q_m = 1 − c_målt / c (0–1). */
  lossFrac: number;
}

/** Avrunder til `n` gjeldende siffer: 843,2 → 840 (n = 2), 120,97 → 120. */
export function roundSig(v: number, n: number): number {
  if (!Number.isFinite(v) || v === 0) return v;
  const p = 10 ** (n - Math.ceil(Math.log10(Math.abs(v))));
  return Math.round(v * p) / p;
}

/** Likevektstemperaturen når to legemer utveksler energi uten tap: T = (C₁T₁ + C₂T₂) / (C₁ + C₂). */
export function equilibriumTemp(C1: number, T1: number, C2: number, T2: number): number {
  const sum = C1 + C2;
  if (!(sum > 0)) return Number.NaN;
  return (C1 * T1 + C2 * T2) / sum;
}

/** Løser hele oppgaven for ett tallsett. Alle tall i teksten, utregningen og figuren kommer herfra. */
export function solveCalorimeterTask(task: CalorimeterTask, table: MetalEntry[] = METAL_TABLE): CalorimeterSolution {
  const { mMetal, mWater, TWater, TMetal, TEnd } = task;
  const dTWater = TEnd - TWater;
  const dTMetal = TMetal - TEnd;
  const CWater = C_WATER * mWater;
  const Qw = CWater * dTWater;
  const c = mMetal > 0 && dTMetal > 0 ? Qw / (mMetal * dTMetal) : Number.NaN;

  const ranking = table
    .map((entry) => ({ entry, dev: (c - entry.c) / entry.c }))
    .sort((a, b) => Math.abs(a.dev) - Math.abs(b.dev));
  const best = ranking[0]!;
  const runnerUp = ranking[1] ?? best;
  const below = table.filter((e) => e.c < c).sort((a, b) => b.c - a.c)[0];
  const closeBelow =
    below && below.id !== best.entry.id && (c - below.c) / below.c < 0.15 ? { entry: below, dev: (c - below.c) / below.c } : null;

  const cTable = best.entry.c;
  const CMetal = cTable * mMetal;
  const TIdeal = equilibriumTemp(CMetal, TMetal, CWater, TWater);
  const QIdeal = CMetal * (TMetal - TIdeal);
  const QMetal = CMetal * dTMetal;
  const QLoss = QMetal - Qw;
  const lossFrac = QMetal > 0 ? QLoss / QMetal : Number.NaN;

  return {
    dTWater,
    dTMetal,
    CWater,
    Qw,
    c,
    cRounded: roundSig(c, 2),
    ranking,
    best,
    runnerUp,
    closeBelow,
    cTable,
    CMetal,
    TIdeal,
    QIdeal,
    QMetal,
    QLoss,
    lossFrac,
  };
}

/* ---------- Geometri til figuren (cm), testet så vannet dekker biten ---------- */

/** Kalorimeteret: innvendig radius og høyde, og tykkelsen på isoporen i veggen, bunnen og lokket (cm). */
export const CALORIMETER = { innerR: 5.5, innerH: 10, wall: 2, base: 2, lid: 2 };
/** Metallbiten er en sylinder som er litt lavere enn den er bred: h = 0,75 · d. */
export const BLOCK_ASPECT = 0.75;

/** Diameter og høyde (cm) på en sylinder med massen m (kg) og tettheten rho (kg/m³), med h = BLOCK_ASPECT · d. */
export function blockSize(m: number, rho: number): { d: number; h: number; V: number } {
  const V = m > 0 && rho > 0 ? (m / rho) * 1e6 : 0;
  const d = Math.cbrt((4 * V) / (Math.PI * BLOCK_ASPECT));
  return { d, h: BLOCK_ASPECT * d, V };
}

/** Vannstanden (cm) i kalorimeteret med biten i, og høyden på biten (cm). */
export function calorimeterFill(task: CalorimeterTask): { level: number; block: { d: number; h: number } } {
  const block = blockSize(task.mMetal, metalEntry(task.metal).rho);
  const area = Math.PI * CALORIMETER.innerR ** 2;
  const Vw = (task.mWater / RHO_WATER) * 1e6;
  return { level: (Vw + block.V) / area, block };
}
