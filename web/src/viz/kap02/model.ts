/** Ren fysikk for kapittel 2 (ingen React), så den kan testes for seg. */
import { G_EARTH } from '../kit/format';

/* ---------- 2C Statisk friksjon og glidefriksjon ---------- */

export interface FrictionInput {
  /** Dytt (N). */
  F: number;
  /** Masse (kg). */
  m: number;
  /** Statisk friksjonstall. */
  muS: number;
  /** Glidefriksjonstall (≤ muS). */
  muK: number;
  /** Om klossen allerede glir (glidefriksjonen holder den i gang til F ≤ μk·N). */
  wasMoving?: boolean;
}

export interface FrictionResult {
  /** Normalkraft N = mg. */
  N: number;
  /** Største statiske friksjon μs·N. */
  Rmax: number;
  /** Glidefriksjon μk·N. */
  Rk: number;
  moving: boolean;
  /** Friksjonskraften som faktisk virker. */
  R: number;
  /** Akselerasjon (m/s²). */
  a: number;
}

export function friction({ F, m, muS, muK, wasMoving = false }: FrictionInput): FrictionResult {
  const N = m * G_EARTH;
  const Rmax = muS * N;
  const Rk = Math.min(muK, muS) * N;
  const moving = wasMoving ? F > Rk : F > Rmax;
  const R = moving ? Rk : F;
  const a = moving ? (F - Rk) / m : 0;
  return { N, Rmax, Rk, moving, R, a };
}

/* ---------- 2D Newtons tredje lov: bok på bord ---------- */

export const EARTH_MASS = 5.97e24;

export interface BookResult {
  /** Tyngden til boka (jorda på boka) = kraften fra boka på jorda. */
  G: number;
  /** Normalkraften fra bordet på boka = kraften fra boka på bordet. */
  N: number;
  /** Akselerasjonen jorda får av G′ (m/s²). */
  earthAccel: number;
}

/** Boka ligger i ro. Hånda dytter eventuelt nedover med `push` (N), så N = G + push. */
export function bookOnTable(m: number, push = 0): BookResult {
  const G = m * G_EARTH;
  return { G, N: G + push, earthAccel: G / EARTH_MASS };
}

/* ---------- 2E Koblede klosser på glatt underlag ---------- */

export interface CoupledResult {
  /** Felles akselerasjon (m/s²). */
  a: number;
  /** Snordraget S (N). */
  S: number;
  /** Kraftsum på A og B hver for seg (N). */
  netA: number;
  netB: number;
}

/** A og B er bundet sammen med en snor, og F drar i B. Ingen friksjon. */
export function coupled(mA: number, mB: number, F: number): CoupledResult {
  const a = F / (mA + mB);
  const S = mA * a;
  return { a, S, netA: S, netB: F - S };
}
