/** Ren fysikk for kapittel 10 Elektrisitet (ingen React), så den kan testes for seg. */

/** Elementærladningen (C). */
export const E_CHARGE = 1.6e-19;
/** Tettheten av frie elektroner i kobber (per m³). */
export const N_COPPER = 8.5e28;
/** Spenningen i stikkontakten i Norge (V). */
export const MAINS_U = 230;
/** 1 kWh i joule. */
export const KWH = 3.6e6;

/* ---------- 10A Elektrisk strøm ---------- */

/** Ladning som passerer på tiden t: Q = I·t. */
export const chargeFrom = (I: number, t: number): number => I * t;

/** Strøm I = Q/t (NaN når t = 0). */
export const currentFrom = (Q: number, t: number): number => (t > 0 ? Q / t : Number.NaN);

/** Antall elektroner som passerer per sekund: I/e. */
export const electronsPerSecond = (I: number): number => I / E_CHARGE;

/** Driftsfarten v = I/(n·e·A) (m/s), A i mm². */
export function driftSpeed(I: number, areaMm2: number, n = N_COPPER): number {
  return I / (n * E_CHARGE * areaMm2 * 1e-6);
}

/** Enkel tallgenerator med fast frø (mulberry32), så animasjonen ser lik ut hver gang. */
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface Carrier {
  /** Startposisjon langs ledningen (0–length). */
  u0: number;
  /** Plassering på tvers (0–1). */
  v: number;
  /** Fase og frekvens for den tilfeldige varmebevegelsen. */
  phase: number;
  freq: number;
}

/** Frie elektroner fordelt jevnt (rutenett med tilfeldig forskyvning) i en stripe på length × count/length. */
export function makeCarriers(count: number, length: number, seed = 7): Carrier[] {
  const rnd = seededRandom(seed);
  const out: Carrier[] = [];
  for (let k = 0; k < count; k++) {
    out.push({ u0: ((k + rnd()) / count) * length, v: rnd(), phase: rnd() * Math.PI * 2, freq: 2 + rnd() * 3 });
  }
  return out;
}

/** Posisjonen langs ledningen når alle har flyttet seg `shift` mot lavere u (periodisk, 0–length). */
export function carrierPosition(u0: number, shift: number, length: number): number {
  return (((u0 - shift) % length) + length) % length;
}

/**
 * Hvor mange ladningsbærere som har passert et tverrsnitt ved u = plane når alle har flyttet seg
 * `shift` (≥ 0) mot lavere u. Ledningen er periodisk, så de som går ut på den ene siden, kommer inn på den andre.
 */
export function crossings(u0s: number[], plane: number, length: number, shift: number): number {
  let n = 0;
  for (const u0 of u0s) {
    const d = (((u0 - plane) % length) + length) % length;
    if (shift >= d) n += Math.floor((shift - d) / length) + 1;
  }
  return n;
}

/* ---------- 10B Ohms lov og resistivitet ---------- */

/** Ohms lov: I = U/R. */
export const ohmCurrent = (U: number, R: number): number => (R > 0 ? U / R : Number.NaN);

/**
 * Enkel modell av en glødelampe (12 V, 24 W): R = R₀(1 + c·P). Temperaturen i glødetråden øker omtrent
 * proporsjonalt med effekten P = U·I, og resistansen øker med temperaturen.
 */
export const LAMP = {
  /** Resistans når glødetråden er kald (Ω). */
  R0: 0.6,
  /** Hvor mye R øker per watt (1/W). Gir R = 6,0 Ω ved 12 V. */
  c: 0.375,
  /** Temperaturkoeffisienten til wolfram (1/K). */
  alpha: 4.5e-3,
  /** Romtemperatur (°C). */
  T0: 20,
  /** Merkespenning og -effekt. */
  Unom: 12,
  Pnom: 24,
};

/** Resistansen til lampa ved spenningen U: løsningen av U = I·R₀(1 + c·U·I) gir R = R₀/2 · (1 + √(1 + 4cU²/R₀)). */
export function lampResistance(U: number, lamp = LAMP): number {
  return (lamp.R0 / 2) * (1 + Math.sqrt(1 + (4 * lamp.c * U * U) / lamp.R0));
}

export const lampCurrent = (U: number, lamp = LAMP): number => U / lampResistance(U, lamp);

/** Temperaturen i glødetråden (°C) fra R = R₀(1 + αΔT). */
export function lampTemperature(U: number, lamp = LAMP): number {
  return lamp.T0 + (lampResistance(U, lamp) / lamp.R0 - 1) / lamp.alpha;
}

export interface Material {
  id: string;
  name: string;
  /** Resistivitet ved 20 °C (Ω·m). */
  rho: number;
  use: string;
}

export const MATERIALS: Material[] = [
  { id: 'kobber', name: 'Kobber', rho: 1.7e-8, use: 'brukes i ledninger fordi resistiviteten er så lav' },
  { id: 'aluminium', name: 'Aluminium', rho: 2.7e-8, use: 'brukes i kraftlinjer fordi det er lett og billig' },
  { id: 'wolfram', name: 'Wolfram', rho: 5.6e-8, use: 'brukes i glødetråder fordi det tåler over 3 000 °C' },
  { id: 'jern', name: 'Jern', rho: 9.7e-8, use: 'leder dårligere enn kobber og brukes sjelden i ledninger' },
  { id: 'konstantan', name: 'Konstantan', rho: 4.9e-7, use: 'brukes i motstander fordi resistansen nesten ikke endres med temperaturen' },
  { id: 'nikrom', name: 'Nikrom', rho: 1.1e-6, use: 'brukes i varmeelementer, f.eks. i brødristere og panelovner' },
];

/** R = ρ·L/A, med L i meter og A i mm². */
export function resistance(rho: number, L: number, areaMm2: number): number {
  return (rho * L) / (areaMm2 * 1e-6);
}

/* ---------- 10C Seriekobling og parallellkobling ---------- */

export interface Circuit {
  /** Total resistans (Ω). */
  Rtot: number;
  /** Strømmen fra batteriet (A). */
  I: number;
  /** Spenningen over hver motstand (V). */
  U: number[];
  /** Strømmen gjennom hver motstand (A). */
  Ik: number[];
  /** Effekten i hver motstand (W). */
  P: number[];
}

/** Motstander i serie over en ideell spenningskilde U: R = R₁ + R₂ + …, samme strøm gjennom alle. */
export function seriesCircuit(Rs: number[], U: number): Circuit {
  const Rtot = Rs.reduce((s, r) => s + r, 0);
  const I = U / Rtot;
  const Uk = Rs.map((r) => r * I);
  return { Rtot, I, U: Uk, Ik: Rs.map(() => I), P: Rs.map((r) => r * I * I) };
}

/** Motstander i parallell: 1/R = 1/R₁ + 1/R₂ + …, samme spenning over alle. */
export function parallelCircuit(Rs: number[], U: number): Circuit {
  const Rtot = 1 / Rs.reduce((s, r) => s + 1 / r, 0);
  const Ik = Rs.map((r) => U / r);
  return { Rtot, I: U / Rtot, U: Rs.map(() => U), Ik, P: Rs.map((r) => (U * U) / r) };
}

/* ---------- 10D Elektrisk energi og effekt ---------- */

export interface Appliance {
  id: string;
  name: string;
  /** Effekt (W). */
  P: number;
  /** Typisk bruk (timer per døgn). */
  hours: number;
}

export const APPLIANCES: Appliance[] = [
  { id: 'led', name: 'LED-pære', P: 8, hours: 5 },
  { id: 'lader', name: 'Mobillader', P: 15, hours: 2 },
  { id: 'tv', name: 'TV', P: 100, hours: 4 },
  { id: 'pc', name: 'Spill-PC', P: 400, hours: 3 },
  { id: 'vannkoker', name: 'Vannkoker', P: 2000, hours: 0.25 },
  { id: 'panelovn', name: 'Panelovn', P: 1000, hours: 10 },
  { id: 'bereder', name: 'Varmtvannsbereder', P: 2000, hours: 4 },
  { id: 'elbil', name: 'Elbillader', P: 7400, hours: 1.5 },
];

/** Strøm fra P = U·I (A). */
export const currentFromPower = (P: number, U = MAINS_U): number => P / U;

/** Resistans fra P = U²/R (Ω). */
export const resistanceFromPower = (P: number, U = MAINS_U): number => (U * U) / P;

/** Energi W = P·t i kWh, med P i watt og t i timer. */
export const energyKWh = (P: number, hours: number): number => (P / 1000) * hours;

/** Antall dager i en måned i utregningene. */
export const DAYS_PER_MONTH = 30;

/** Energi per måned (kWh) og kostnad (kr) når apparatet går `hours` timer hvert døgn. */
export function monthly(P: number, hours: number, price: number): { kWh: number; cost: number } {
  const kWh = energyKWh(P, hours) * DAYS_PER_MONTH;
  return { kWh, cost: kWh * price };
}
