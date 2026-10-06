/**
 * Heisen i blokka (k2-heis, 2E): hvor i bygget heisen er, hvilken etasje den står ved, og det vekta viser.
 * Bevegelsen og normalkraften står i model.ts (liftPhases, liftState, scaleForce); her er det som knytter dem til
 * bygget i scenen. Ren fysikk uten React, testet i model-heis.test.ts.
 */
import { G_EARTH } from '../../kit/format';
import { LIFT_T_END, liftPhases, liftState, scaleForce, type LiftTrip } from './model';

/** Etasjehøyden i blokka (m), fra gulv til gulv. */
export const FLOOR_HEIGHT = 3;
/** Antall etasjer. 1. etasje er på bakkeplan (h = 0), øverste etasje i h = (FLOORS − 1) · FLOOR_HEIGHT = 42 m. */
export const FLOORS = 15;
/** Heisstolen innvendig (m): bredde sett forfra og høyde fra gulv til tak. */
export const LIFT_CAR = { width: 1.1, height: 2.2 } as const;

/**
 * Akselerasjonen ved start og stopp (m/s²) som eleven kan velge. En tur er 12 · a0 lang (se liftTripLength), så med
 * steg på 0,25 m/s² blir turen et helt antall etasjer (3 m), og heisen stopper alltid ved en etasje.
 * Heiser i boligblokker akselererer typisk med 0,5–1,5 m/s² og kjører 1–2,5 m/s. Standardvalget 1 m/s² gir toppfarten
 * 2a0 = 2 m/s, og det største valget (2 m/s², toppfart 4 m/s) er allerede i overkant av hva en vanlig heis gjør.
 */
export const LIFT_A0 = { min: 0.5, max: 2, step: 0.25, start: 1 } as const;

/** Over denne akselerasjonen (m/s²) er heisen kraftigere enn vanlige heiser i boligblokker. */
export const LIFT_A0_TYPICAL_MAX = 1.5;

/** Høyden (m) til gulvet i etasje nummer `floor` (1 = bakkeplan). */
export function floorHeight(floor: number): number {
  return (floor - 1) * FLOOR_HEIGHT;
}

/**
 * Hvor langt heisen kjører på en tur opp eller ned (m): 2 s med akselerasjon a0, 4 s med konstant fart 2a0 og 2 s
 * med oppbremsing, til sammen 2a0 + 8a0 + 2a0 = 12 · a0. Regnet ut med selve bevegelsen (liftState).
 */
export function liftTripLength(a0: number): number {
  return Math.abs(liftState(liftPhases('opp', a0), LIFT_T_END).y);
}

/**
 * Høyden (m over 1. etasje) der heisgulvet er når turen starter. Tur opp starter i 1. etasje, tur ned starter så høyt
 * at den ender i 1. etasje, og når kabelen ryker, står heisen i øverste etasje.
 */
export function liftStartHeight(trip: LiftTrip, a0: number): number {
  if (trip === 'opp') return 0;
  if (trip === 'ned') return liftTripLength(a0);
  return floorHeight(FLOORS);
}

/** Høyden (m over 1. etasje) til heisgulvet ved tiden t. */
export function liftHeight(trip: LiftTrip, a0: number, t: number): number {
  return liftStartHeight(trip, a0) + liftState(liftPhases(trip, a0), t).y;
}

/**
 * Etasjen heisgulvet er nærmest (1 = bakkeplan, høyst FLOORS), og om heisen står ved den (gulvene innenfor 1 cm,
 * så dørene kan åpnes).
 */
export function nearestFloor(h: number): { floor: number; level: boolean } {
  const exact = h / FLOOR_HEIGHT + 1;
  const floor = Math.min(FLOORS, Math.max(1, Math.round(exact)));
  return { floor, level: Math.abs(h - floorHeight(floor)) < 0.01 };
}

/** Etasjen rett under (eller ved) heisgulvet: 1 = bakkeplan, høyst FLOORS. */
export function floorBelow(h: number): number {
  return Math.min(FLOORS, Math.max(1, Math.floor(h / FLOOR_HEIGHT + 1e-9) + 1));
}

/**
 * Det vekta viser (kg). Vekta måler kraften fra føttene, som er like stor som normalkraften N (Newtons 3. lov), og
 * deler på g: N / g = m(g + a) / g. I ro eller med konstant fart viser den massen.
 */
export function scaleReading(m: number, a: number): number {
  return scaleForce(m, a) / G_EARTH;
}

/** Den største farten (m/s) på turen, til skalaen for fartspila: 2a0 opp og ned, 2g i fritt fall (etter 2 s). */
export function liftMaxSpeed(trip: LiftTrip, a0: number): number {
  const phases = liftPhases(trip, a0);
  let max = 0;
  for (const p of phases) max = Math.max(max, Math.abs(liftState(phases, p.t1).v), Math.abs(liftState(phases, p.t0).v));
  return max;
}

/** Den største akselerasjonen (m/s², som tallverdi) på turen, til skalaen for akselerasjonspila. */
export function liftMaxAcceleration(trip: LiftTrip, a0: number): number {
  return Math.max(...liftPhases(trip, a0).map((p) => Math.abs(p.a)));
}
