import { describe, expect, it } from 'vitest';
import { G_EARTH } from '../../kit/format';
import { LIFT_T_END, liftPhases, liftState, scaleForce, type LiftTrip } from './model';
import {
  FLOORS,
  FLOOR_HEIGHT,
  LIFT_A0,
  LIFT_A0_TYPICAL_MAX,
  floorBelow,
  floorHeight,
  liftHeight,
  liftMaxAcceleration,
  liftMaxSpeed,
  liftStartHeight,
  liftTripLength,
  nearestFloor,
  scaleReading,
} from './model-heis';

/** Alle verdiene glidebryteren for a0 kan ha. */
const A0_VALUES: number[] = [];
for (let a = LIFT_A0.min; a <= LIFT_A0.max + 1e-9; a += LIFT_A0.step) A0_VALUES.push(Math.round(a * 100) / 100);
const TRIPS: LiftTrip[] = ['opp', 'ned', 'fritt-fall'];
const times = Array.from({ length: 201 }, (_, i) => (i * LIFT_T_END) / 200);

describe('heisen i blokka', () => {
  it('etasjene: 1. etasje på bakkeplan, 3 m mellom gulvene, øverste etasje i 42 m', () => {
    expect(floorHeight(1)).toBe(0);
    expect(floorHeight(9)).toBe(24);
    expect(floorHeight(FLOORS)).toBe(42);
    expect(FLOOR_HEIGHT).toBe(3);
  });

  it('en tur er 12 · a0 lang: 2a0 under starten, 8a0 med konstant fart og 2a0 under bremsingen', () => {
    expect(liftTripLength(2)).toBeCloseTo(24, 9);
    expect(liftTripLength(0.5)).toBeCloseTo(6, 9);
    for (const a0 of A0_VALUES) expect(liftTripLength(a0)).toBeCloseTo(12 * a0, 9);
  });

  it('alle valg av a0 gir en tur på et helt antall etasjer, så heisen stopper ved en etasje', () => {
    expect(A0_VALUES).toEqual([0.5, 0.75, 1, 1.25, 1.5, 1.75, 2]);
    for (const a0 of A0_VALUES) {
      const up = nearestFloor(liftHeight('opp', a0, LIFT_T_END));
      expect(up.level).toBe(true);
      expect(up.floor).toBe(1 + (12 * a0) / FLOOR_HEIGHT);
      const down = nearestFloor(liftHeight('ned', a0, LIFT_T_END));
      expect(down).toEqual({ floor: 1, level: true });
      expect(nearestFloor(liftStartHeight('ned', a0)).level).toBe(true);
    }
    // a0 = 2 m/s²: fra 1. til 9. etasje (24 m)
    expect(nearestFloor(liftHeight('opp', 2, LIFT_T_END))).toEqual({ floor: 9, level: true });
    // Standardvalget a0 = 1 m/s²: fra 1. til 5. etasje (12 m)
    expect(nearestFloor(liftHeight('opp', LIFT_A0.start, LIFT_T_END))).toEqual({ floor: 5, level: true });
  });

  it('realistiske verdier: standardvalget gir en vanlig heis (a0 ≤ 1,5 m/s², toppfart 1–2,5 m/s)', () => {
    expect(A0_VALUES).toContain(LIFT_A0.start);
    expect(LIFT_A0.start).toBeLessThanOrEqual(LIFT_A0_TYPICAL_MAX);
    const vTop = liftMaxSpeed('opp', LIFT_A0.start);
    expect(vTop).toBeCloseTo(2, 9);
    expect(vTop).toBeGreaterThanOrEqual(1);
    expect(vTop).toBeLessThanOrEqual(2.5);
    // Det største valget er 2 m/s² (toppfart 4 m/s), i overkant av en vanlig heis
    expect(LIFT_A0.max).toBe(2);
    expect(liftMaxSpeed('opp', LIFT_A0.max)).toBeCloseTo(4, 9);
    // Vekta viser 70 · 10,81/9,81 = 77,1 kg når en person på 70 kg starter oppover med standardvalget
    expect(scaleReading(70, LIFT_A0.start)).toBeCloseTo(77.14, 2);
  });

  it('heisen holder seg i sjakta (0–42 m) på alle turer', () => {
    for (const trip of TRIPS)
      for (const a0 of A0_VALUES)
        for (const t of times) {
          const h = liftHeight(trip, a0, t);
          expect(h).toBeGreaterThanOrEqual(-1e-9);
          expect(h).toBeLessThanOrEqual(floorHeight(FLOORS) + 1e-9);
        }
  });

  it('kabelen ryker i 15. etasje: heisen faller 2g · 2 s = 39,2 m og stopper mellom 1. og 2. etasje', () => {
    expect(liftStartHeight('fritt-fall', 2)).toBe(42);
    const end = liftHeight('fritt-fall', 2, LIFT_T_END);
    expect(end).toBeCloseTo(42 - 2 * G_EARTH * 2, 9);
    expect(nearestFloor(end)).toEqual({ floor: 2, level: false });
    // Akselerasjonen ved start og stopp påvirker ikke fallet
    expect(liftHeight('fritt-fall', 0.5, 4)).toBeCloseTo(liftHeight('fritt-fall', 2, 4), 9);
  });

  it('etasjen under heisgulvet: «mellom 1. og 2. etasje» når heisen står fast i 2,76 m', () => {
    expect(floorBelow(0)).toBe(1);
    expect(floorBelow(2.76)).toBe(1);
    expect(floorBelow(3)).toBe(2);
    expect(floorBelow(24)).toBe(9);
    expect(floorBelow(-0.2)).toBe(1);
    expect(floorBelow(42)).toBe(FLOORS);
  });

  it('nærmeste etasje rundes og holdes innenfor bygget', () => {
    expect(nearestFloor(0)).toEqual({ floor: 1, level: true });
    expect(nearestFloor(1.4)).toEqual({ floor: 1, level: false });
    expect(nearestFloor(1.6)).toEqual({ floor: 2, level: false });
    expect(nearestFloor(-0.5).floor).toBe(1);
    expect(nearestFloor(60).floor).toBe(FLOORS);
  });
});

describe('det vekta viser', () => {
  it('i ro og med konstant fart viser vekta massen', () => {
    expect(scaleReading(70, 0)).toBeCloseTo(70, 9);
    expect(scaleReading(48, 0)).toBeCloseTo(48, 9);
  });

  it('m(g + a)/g: mer når akselerasjonen peker oppover, mindre når den peker nedover', () => {
    expect(scaleReading(70, 2)).toBeCloseTo((70 * 11.81) / 9.81, 9); // 84,3 kg
    expect(scaleReading(70, 2)).toBeCloseTo(84.27, 2);
    expect(scaleReading(70, -2)).toBeCloseTo(55.73, 2);
  });

  it('fritt fall gir 0 kg, nødbremsen med a = g gir dobbel masse', () => {
    expect(scaleReading(70, -G_EARTH)).toBe(0);
    expect(scaleReading(70, G_EARTH)).toBeCloseTo(140, 9);
  });

  it('Newtons 2. lov holder i alle faser: N − G = m · a', () => {
    for (const trip of TRIPS)
      for (const a0 of A0_VALUES)
        for (const p of liftPhases(trip, a0)) {
          const m = 63;
          expect(scaleForce(m, p.a) - m * G_EARTH).toBeCloseTo(m * p.a, 9);
        }
  });
});

describe('skalaene for pilene', () => {
  it('største fart: 2a0 på vanlige turer, 2g (19,6 m/s) i fritt fall', () => {
    expect(liftMaxSpeed('opp', 2)).toBeCloseTo(4, 9);
    expect(liftMaxSpeed('ned', 1.5)).toBeCloseTo(3, 9);
    expect(liftMaxSpeed('fritt-fall', 2)).toBeCloseTo(2 * G_EARTH, 9);
    // Farten underveis er aldri større
    for (const trip of TRIPS)
      for (const a0 of A0_VALUES)
        for (const t of times) expect(Math.abs(liftState(liftPhases(trip, a0), t).v)).toBeLessThanOrEqual(liftMaxSpeed(trip, a0) + 1e-9);
  });

  it('største akselerasjon: a0 på vanlige turer, g når kabelen ryker', () => {
    expect(liftMaxAcceleration('opp', 1.25)).toBe(1.25);
    expect(liftMaxAcceleration('ned', 0.5)).toBe(0.5);
    expect(liftMaxAcceleration('fritt-fall', 1)).toBe(G_EARTH);
  });
});
