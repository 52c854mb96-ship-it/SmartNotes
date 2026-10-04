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
 * Enkel modell av en glødelampe (12 V, 24 W): R = R₀(1 + a·P^b), der P = U·I er effekten i glødetråden.
 * Tråden avgir energien mest som stråling, så temperaturen øker omtrent som P^(1/4), og resistansen i wolfram
 * øker litt raskere enn temperaturen. Med b = 0,35 gir modellen I ≈ 2,0 A · (U/12 V)^0,55, slik målinger på
 * ekte glødelamper viser, og R = R₀ når tråden er kald.
 */
const LAMP_R0 = 0.6;
const LAMP_B = 0.35;
export const LAMP = {
  /** Resistans når glødetråden er kald (Ω). */
  R0: LAMP_R0,
  /** Eksponenten i R = R₀(1 + a·P^b). */
  b: LAMP_B,
  /** Valgt slik at R = 6,0 Ω (2,0 A) ved 12 V og 24 W: a = (6,0 Ω/R₀ − 1)/24^b. */
  a: (6 / LAMP_R0 - 1) / 24 ** LAMP_B,
  /** Temperaturkoeffisienten til wolfram (1/K). */
  alpha: 4.5e-3,
  /** Romtemperatur (°C). */
  T0: 20,
  /** Merkespenning og -effekt. */
  Unom: 12,
  Pnom: 24,
};

/** Resistansen til lampa ved spenningen U: løser U = I·R₀(1 + a·(U·I)^b) for I (halveringsmetoden) og gir R = U/I. */
export function lampResistance(U: number, lamp = LAMP): number {
  if (!(U > 0)) return lamp.R0;
  // Strømmen ligger mellom 0 og U/R₀ (R er aldri mindre enn R₀), og spenningsfallet I·R(I) øker med I.
  let lo = 0;
  let hi = U / lamp.R0;
  for (let k = 0; k < 60; k++) {
    const I = (lo + hi) / 2;
    const R = lamp.R0 * (1 + lamp.a * (U * I) ** lamp.b);
    if (I * R < U) lo = I;
    else hi = I;
  }
  return U / ((lo + hi) / 2);
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

/**
 * Omtrentlig farge (sRGB 0–255) på et glødende legeme med temperaturen T (K), slik øyet ser den.
 * Tilpasset kurve (Tanner Helland) som stemmer godt mellom 1000 K og 40 000 K.
 */
export function blackbodyRgb(T: number): [number, number, number] {
  const t = Math.min(40000, Math.max(1000, T)) / 100;
  const clamp = (v: number) => Math.round(Math.min(255, Math.max(0, v)));
  const r = t <= 66 ? 255 : 329.698727446 * (t - 60) ** -0.1332047592;
  const g = t <= 66 ? 99.4708025861 * Math.log(t) - 161.1195681661 : 288.1221695283 * (t - 60) ** -0.0755148492;
  const b = t >= 66 ? 255 : t <= 19 ? 0 : 138.5177312231 * Math.log(t - 10) - 305.0447927307;
  return [clamp(r), clamp(g), clamp(b)];
}

/** Hvor tydelig en glødetråd lyser (0–1): usynlig under ca. 800 °C, full styrke ved ca. 2 000 °C. */
export function glowStrength(tempC: number): number {
  return Math.min(1, Math.max(0, (tempC - 800) / 1200));
}
