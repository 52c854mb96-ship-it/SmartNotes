/**
 * 2E Koblede legemer, som en bil som trekker en tilhenger (k2-koblede-klosser).
 *
 * Fysikken er den samme som for to klosser bundet sammen med en snor (`coupled` i model.ts): hengeren (A) henger
 * etter bilen (B), og drivkraften F fra veien virker bare på bilen. Vi ser bort fra luftmotstand og rullemotstand.
 * Hele vogntoget: F = (m_H + m_B) · a. Hengeren alene: S = m_H · a. Bilen alene: F − S = m_B · a.
 * Her ligger det som er spesielt for scenen: tallområdene, lasten på hengeren, kreftene på det valgte systemet og
 * bevegelsen når vogntoget starter fra ro.
 */
import { coupled, type CoupledResult } from './model';

/** Tallområdene til glidebryterne: masse (kg) og drivkraft (N). */
export const TOW_RANGES = {
  /** Tilhenger med last: tom henger (200 kg) til tre fulle storsekker med ved (1 100 kg). */
  mH: { min: 200, max: 1100, step: 50, start: 800 },
  /** Bil med fører: en liten bybil til en stor SUV. */
  mB: { min: 800, max: 2500, step: 50, start: 1400 },
  /** Drivkraften fra veien på drivhjulene. */
  F: { min: 0, max: 5000, step: 100, start: 3300 },
} as const;

/**
 * Tilhengeren: en tom, enakslet henger på 200 kg med plass til tre storsekker med løs, kløyvd bjørkeved
 * (1 000 liter løs ved veier ca. 300 kg).
 */
export const TRAILER = { empty: 200, bagMass: 300, bags: 3 } as const;

export interface TrailerLoad {
  /** Massen til lasten (kg). */
  load: number;
  /** Hvor fulle sekkene er (0–1), bakerst, midt og fremst på hengeren. */
  fill: [rear: number, middle: number, front: number];
}

/**
 * Lasten på en henger med massen m_H (kg). Sekkene fylles slik at tyngdepunktet hele tiden ligger rett over
 * akslingen: først den bakerste og den fremste like mye, så den i midten. Da bærer hjulene hele tyngden, og
 * hengerfestet bare drar (ingen loddrett kraft på kula).
 */
export function trailerLoad(mH: number): TrailerLoad {
  const { empty, bagMass, bags } = TRAILER;
  const load = Math.min(bags * bagMass, Math.max(0, Number.isFinite(mH) ? mH - empty : 0));
  const ends = Math.min(1, load / (2 * bagMass));
  const middle = Math.min(1, Math.max(0, load - 2 * bagMass) / bagMass);
  return { load, fill: [ends, middle, ends] };
}

/* ---------- Kreftene på det valgte systemet ---------- */

export type TowView = 'system' | 'henger' | 'bil';

/** En vannrett kraft på en del av vogntoget. `value` er positiv fremover (fartsretningen). */
export interface TowForce {
  name: 'F' | 'S';
  /** Hvilken del kraften virker på. */
  on: 'henger' | 'bil';
  /** Hvem som gir kraften. */
  from: 'veien' | 'bilen' | 'hengeren';
  value: number;
  /** Indre kraft: både den som gir og den som får kraften, er med i systemet. */
  internal: boolean;
}

export interface TowSystem extends CoupledResult {
  view: TowView;
  /** Massen til systemet (kg). */
  mass: number;
  /** De vannrette kreftene på delene i systemet. */
  forces: TowForce[];
  /** Kraftsummen på systemet (N): summen av de ytre kreftene, siden de indre parene opphever hverandre. */
  net: number;
}

/**
 * De vannrette kreftene på det valgte systemet: hele vogntoget, bare hengeren eller bare bilen.
 * Kraften i hengerfestet er et kraftpar etter Newtons 3. lov: bilen drar hengeren fremover med S, og hengeren drar
 * bilen bakover med S. Når begge er i systemet, er begge kreftene indre og faller ut av kraftsummen.
 */
export function towSystem(view: TowView, mH: number, mB: number, F: number): TowSystem {
  const r = coupled(mH, mB, F);
  const withH = view !== 'bil';
  const withB = view !== 'henger';
  const both = withH && withB;
  const forces: TowForce[] = [];
  if (withB) forces.push({ name: 'F', on: 'bil', from: 'veien', value: F, internal: false });
  if (withH) forces.push({ name: 'S', on: 'henger', from: 'bilen', value: r.S, internal: both });
  if (withB) forces.push({ name: 'S', on: 'bil', from: 'hengeren', value: -r.S, internal: both });
  const net = forces.filter((f) => !f.internal).reduce((sum, f) => sum + f.value, 0);
  const mass = (withH ? mH : 0) + (withB ? mB : 0);
  return { ...r, view, mass, forces, net };
}

/* ---------- Bevegelsen fra ro ---------- */

/** Avspillingen stopper når vogntoget har nådd 80 km/h, eller etter 15 s. */
export const TOW_V_END = 80 / 3.6;
export const TOW_T_MAX = 15;
/** Uten drivkraft står vogntoget stille, og avspillingen varer 5 s. */
export const TOW_T_IDLE = 5;

/** Hvor lenge avspillingen varer (s) med akselerasjonen a. */
export function towDuration(a: number): number {
  if (!(a > 1e-9)) return TOW_T_IDLE;
  return Math.min(TOW_T_MAX, TOW_V_END / a);
}

/** Farten (m/s) og strekningen (m) etter tiden t, når vogntoget starter fra ro med konstant akselerasjon a. */
export function towMotion(a: number, t: number): { t: number; v: number; s: number } {
  const acc = a > 0 && Number.isFinite(a) ? a : 0;
  const tt = Math.min(Math.max(0, Number.isFinite(t) ? t : 0), towDuration(acc));
  return { t: tt, v: acc * tt, s: 0.5 * acc * tt * tt };
}

/* ---------- Visning ---------- */

/**
 * Rund av til `n` gjeldende siffer (standard 3), som i svar: 13 734 N → 13 700 N. Massene er gitt med tre siffer og
 * g = 9,81 m/s², så G og N vises med tre gjeldende siffer. Gir også antall desimaler til fmt().
 */
export function roundSig(v: number, n = 3): { value: number; decimals: number } {
  if (!Number.isFinite(v) || v === 0) return { value: 0, decimals: 0 };
  const exp = Math.floor(Math.log10(Math.abs(v)));
  const decimals = Math.max(0, n - 1 - exp);
  const step = 10 ** (exp - n + 1);
  const value = Math.round(v / step) * step;
  return { value: decimals > 0 ? Number(value.toFixed(decimals)) : value, decimals };
}
