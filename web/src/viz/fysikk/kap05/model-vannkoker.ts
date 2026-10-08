/**
 * Vannkoker og kasserolle på kokeplate (5C, 5D): energien vannet trenger, Q = c·m·ΔT, kommer fra den elektriske
 * energien E = P·t. Bare en del av den, virkningsgraden η, havner i vannet; resten er varmetap til kjøkkenet.
 *   η · P · t = c · m · ΔT  ⇒  t = c · m · ΔT / (η · P)
 * Virkningsgraden er konstant i modellen (temperaturen stiger da like mye hvert sekund, og grafen blir en rett linje).
 */

/** Spesifikk varmekapasitet for vann, J/(kg·K) (samme som MATERIALS.vann i model.ts). */
export const C_WATER = 4180;
/** Massetettheten til vann, kg/L (1 L vann har massen 1,00 kg). */
export const WATER_DENSITY = 1.0;
/** Kokepunktet til vann ved normalt lufttrykk (°C). */
export const BOILING_POINT = 100;
/** 1 kWh = 1000 W · 3600 s. */
export const J_PER_KWH = 3.6e6;

/** Typisk virkningsgrad for en vannkoker: varmeelementet ligger i bunnen, inne i vannet. */
export const KETTLE_ETA = 0.85;
/** Kasserolle på en kokeplate i støpejern uten lokk: plata og kasserollen må varmes, og mye stråler ut til lufta. */
export const POT_ETA = 0.5;
/** Samme kasserolle med lokk: mindre varm damp og luft slipper ut. */
export const POT_LID_ETA = 0.6;

export type HeaterId = 'vannkoker' | 'kasserolle';

export interface Heater {
  id: HeaterId;
  /** Navnet i figuren og forklaringen (stor forbokstav). */
  name: string;
  /** Virkningsgraden η (0–1): andelen av den elektriske energien som går til vannet. */
  eta: number;
}

/** Kasserollen på kokeplata, med eller uten lokk. */
export function potHeater(lid: boolean): Heater {
  return { id: 'kasserolle', name: 'Kasserolle på kokeplate', eta: lid ? POT_LID_ETA : POT_ETA };
}

export const KETTLE: Heater = { id: 'vannkoker', name: 'Vannkoker', eta: KETTLE_ETA };

/** Massen (kg) av V liter vann. */
export function waterMass(liters: number): number {
  return Math.max(0, liters) * WATER_DENSITY;
}

/** Varmen (J) vannet må få for å gå fra T0 til kokepunktet: Q = c·m·ΔT. 0 hvis vannet allerede koker. */
export function heatToBoil(m: number, T0: number): number {
  return C_WATER * Math.max(0, m) * Math.max(0, BOILING_POINT - T0);
}

/** Tiden (s) fra start til vannet koker: t = c·m·ΔT / (η·P). Uendelig uten effekt eller virkningsgrad. */
export function boilTime(P: number, eta: number, m: number, T0: number): number {
  if (!(P > 0) || !(eta > 0)) return Infinity;
  return heatToBoil(m, T0) / (eta * P);
}

export interface HeatState {
  /** Temperaturen i vannet (°C). */
  T: number;
  /** Elektrisk energi tilført så langt, E = P·t (J). Står stille når apparatet er slått av. */
  E: number;
  /** Varme til vannet så langt, Q = η·E = c·m·(T − T0) (J). */
  Q: number;
  /** Varmetap til kjøkkenet så langt, E − Q (J). */
  loss: number;
  /** Vannet har nådd kokepunktet, og apparatet er slått av. */
  done: boolean;
}

/**
 * Tilstanden etter tiden t (s). Apparatet går med effekten P til vannet koker; da slår vannkokeren seg av (og vi
 * skrur av kokeplata). Etterpå står vannet på 100 °C i modellen (det kjøles bare sakte de første minuttene).
 */
export function heatState(P: number, eta: number, m: number, T0: number, t: number): HeatState {
  const tb = boilTime(P, eta, m, T0);
  const on = Math.min(Math.max(0, Number.isFinite(t) ? t : 0), tb);
  const E = Number.isFinite(on) ? Math.max(0, P) * on : 0;
  const Q = Math.max(0, eta) * E;
  const C = C_WATER * m;
  const done = t >= tb;
  const T = done ? Math.max(T0, BOILING_POINT) : C > 0 ? T0 + Q / C : T0;
  return { T: Math.min(T, Math.max(T0, BOILING_POINT)), E, Q, loss: E - Q, done };
}

export interface BoilRun {
  heater: Heater;
  /** Tiden til vannet koker (s). */
  t: number;
  /** Elektrisk energi brukt til vannet koker, E = P·t (J). */
  E: number;
  /** Varme til vannet, Q = c·m·ΔT (J). */
  Q: number;
  /** Varmetap, E − Q (J). */
  loss: number;
  /** Tapt effekt (W): (1 − η)·P. Varmen som strømmer ut i kjøkkenet hvert sekund. */
  lossPower: number;
  /** Nyttig effekt (W): η·P, varmen som går inn i vannet hvert sekund. */
  usefulPower: number;
  /** Hvor fort temperaturen stiger (K/s): η·P / (c·m). */
  rate: number;
}

export interface BoilInput {
  /** Effekt (W). */
  P: number;
  /** Vannmengde (L). */
  liters: number;
  /** Starttemperatur (°C). */
  T0: number;
}

/** Hele oppkokingen for ett apparat. */
export function boilRun(input: BoilInput, heater: Heater): BoilRun {
  const m = waterMass(input.liters);
  const Q = heatToBoil(m, input.T0);
  const t = boilTime(input.P, heater.eta, m, input.T0);
  const E = input.P * t;
  return {
    heater,
    t,
    E,
    Q,
    loss: E - Q,
    lossPower: (1 - heater.eta) * input.P,
    usefulPower: heater.eta * input.P,
    rate: m > 0 ? (heater.eta * input.P) / (C_WATER * m) : 0,
  };
}

/** Den ideelle tiden uten varmetap (η = 1): t = c·m·ΔT / P. */
export function idealBoilTime(input: BoilInput): number {
  return boilTime(input.P, 1, waterMass(input.liters), input.T0);
}

/** Energi i kilowattimer. */
export function toKWh(joule: number): number {
  return joule / J_PER_KWH;
}

/** Hele minutter og resten i sekunder (avrundet til hele sekunder), f.eks. 221 s → 3 min 41 s. */
export function minSec(seconds: number): { min: number; s: number } {
  const total = Math.max(0, Math.round(seconds));
  return { min: Math.floor(total / 60), s: total % 60 };
}

/**
 * Slutten på tidsaksen og avspillingen: litt etter at det siste apparatet har kokt, rundet opp til en «pen» verdi,
 * så aksen får fine tall og vi ser at temperaturen står på 100 °C etterpå.
 */
export function timeAxisEnd(lastBoil: number): number {
  const v = Math.max(1, lastBoil * 1.08);
  const mag = 10 ** Math.floor(Math.log10(v));
  for (const c of [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10]) if (c * mag >= v - 1e-9) return c * mag;
  return 10 * mag;
}
