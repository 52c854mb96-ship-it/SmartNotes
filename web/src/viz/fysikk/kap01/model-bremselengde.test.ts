import { describe, expect, it } from 'vitest';
import { BRAKE_PRESETS, kmhToMs, stopPosition, stopVelocity, stopping, type StopInput } from './model';
import {
  SURFACES,
  VIEW_BEHIND,
  carPosition,
  carVelocity,
  msToKmh,
  obstacle,
  roadFor,
  sceneRange,
  speedForStoppingDistance,
  surfaceOf,
} from './model-bremselengde';

/** Ytterverdiene og standardverdiene til glidebryterne i visualiseringen. */
const SPEEDS = [20, 45, 80, 130];
const REACTIONS = [0.5, 1.0, 2.5];
const BRAKES = [1, 2.5, 5, 8, 10];
const DISTANCES = [10, 35, 60, 100];

function* allInputs(): Generator<[StopInput, number]> {
  for (const kmh of SPEEDS) for (const tr of REACTIONS) for (const a of BRAKES) for (const D of DISTANCES) yield [{ v0: kmhToMs(kmh), tr, a }, D];
}

describe('føre', () => {
  it('har de faste bremseakselerasjonene fra model.ts og en for snø mellom våt asfalt og is', () => {
    expect(SURFACES.map((s) => s.a)).toEqual([BRAKE_PRESETS.torr, BRAKE_PRESETS.vat, 2.5, BRAKE_PRESETS.is]);
    expect(SURFACES.map((s) => s.label)).toEqual(['Tørr asfalt', 'Våt asfalt', 'Snø', 'Is']);
  });

  it('kjenner igjen føret fra bremseakselerasjonen, og gir null for en egen verdi', () => {
    for (const s of SURFACES) expect(surfaceOf(s.a)).toBe(s.id);
    expect(surfaceOf(6.5)).toBeNull();
  });

  it('velger veien med nærmest bremseakselerasjon på logaritmisk skala', () => {
    for (const s of SURFACES) expect(roadFor(s.a)).toBe(s.road);
    expect(roadFor(10)).toBe('asfalt');
    expect(roadFor(6.5)).toBe('asfalt');
    expect(roadFor(6)).toBe('vaat-asfalt');
    expect(roadFor(3.5)).toBe('sno');
    expect(roadFor(2)).toBe('sno');
    expect(roadFor(1.5)).toBe('is');
  });
});

describe('elgen i veien', () => {
  const dry: StopInput = { v0: kmhToMs(80), tr: 1, a: 8 };
  const wet: StopInput = { v0: kmhToMs(80), tr: 1, a: 5 };

  it('80 km/h på tørr asfalt: stopper 6,9 m før en elg 60 m unna', () => {
    const o = obstacle(dry, 60);
    expect(o.hits).toBe(false);
    expect(o.margin).toBeCloseTo(60 - 53.086, 2);
    expect(o.sEnd).toBeCloseTo(53.09, 2);
    expect(o.tEnd).toBeCloseTo(stopping(dry).tStop, 12);
    expect(o.vHit).toBe(0);
  });

  it('80 km/h på våt asfalt: treffer elgen i ca. 39 km/h etter 37,8 m bremsing', () => {
    const o = obstacle(wet, 60);
    expect(o.hits).toBe(true);
    expect(o.beforeBraking).toBe(false);
    expect(o.braked).toBeCloseTo(37.78, 2);
    // v² = v₀² − 2as = 493,8 − 377,8 = 116,0
    expect(o.vHit).toBeCloseTo(10.77, 2);
    expect(msToKmh(o.vHit)).toBeCloseTo(38.8, 1);
    expect(o.tEnd).toBeCloseTo(1 + (kmhToMs(80) - o.vHit) / 5, 12);
    expect(o.margin).toBe(0);
    expect(o.sEnd).toBe(60);
  });

  it('treffer med full fart når elgen er nærmere enn reaksjonslengden', () => {
    const o = obstacle(dry, 15);
    expect(o.hits).toBe(true);
    expect(o.beforeBraking).toBe(true);
    expect(o.vHit).toBe(dry.v0);
    expect(o.tEnd).toBeCloseTo(15 / dry.v0, 12);
    expect(o.braked).toBe(0);
  });

  it('akkurat ved elgen regnes som stopp, og en elg i fronten gir treff med en gang', () => {
    const r = stopping(dry);
    const o = obstacle(dry, r.total);
    expect(o.hits).toBe(false);
    expect(o.margin).toBe(0);
    const zero = obstacle(dry, 0);
    expect(zero.hits).toBe(true);
    expect(zero.tEnd).toBe(0);
  });

  it('henger sammen med bevegelsen for alle kombinasjoner av glidebryterne', () => {
    for (const [input, D] of allInputs()) {
      const r = stopping(input);
      const o = obstacle(input, D);
      expect(o.hits).toBe(r.total > D);
      expect(Number.isFinite(o.tEnd) && Number.isFinite(o.vHit)).toBe(true);
      expect(o.tEnd).toBeGreaterThan(0);
      expect(o.tEnd).toBeLessThanOrEqual(r.tStop + 1e-12);
      // Posisjonen og farten i bevegelsen stemmer med treffpunktet
      expect(stopPosition(input, o.tEnd)).toBeCloseTo(o.sEnd, 9);
      if (o.hits) {
        expect(o.sEnd).toBe(D);
        expect(o.vHit).toBeGreaterThan(0);
        expect(o.vHit).toBeLessThanOrEqual(input.v0 + 1e-12);
        expect(stopVelocity(input, o.tEnd)).toBeCloseTo(o.vHit, 9);
        // v² − v₀² = 2·(−a)·s for strekningen bilen bremser
        expect(o.vHit ** 2 - input.v0 ** 2).toBeCloseTo(-2 * input.a * o.braked, 8);
        expect(o.braked + Math.min(D, r.sr)).toBeCloseTo(D, 9);
      } else {
        expect(o.margin + r.total).toBeCloseTo(D, 9);
        expect(o.braked).toBeCloseTo(r.sb, 12);
      }
    }
  });

  it('bilen kommer aldri forbi elgen, og står stille etter et treff', () => {
    for (const [input, D] of allInputs()) {
      const o = obstacle(input, D);
      let prev = -Infinity;
      for (let i = 0; i <= 200; i++) {
        const t = (i / 200) * (stopping(input).tStop + 1);
        const s = carPosition(input, D, t);
        expect(s).toBeLessThanOrEqual(D + 1e-12);
        expect(s).toBeGreaterThanOrEqual(prev - 1e-12);
        prev = s;
        const v = carVelocity(input, D, t);
        expect(v).toBeGreaterThanOrEqual(0);
        if (t >= o.tEnd && o.hits) expect(v).toBe(0);
      }
      expect(carPosition(input, D, o.tEnd + 5)).toBeCloseTo(o.sEnd, 9);
    }
  });
});

describe('største fart for en gitt stopplengde', () => {
  it('gir tilbake farten som gir stopplengden', () => {
    for (const kmh of SPEEDS)
      for (const tr of REACTIONS)
        for (const a of BRAKES) {
          const v0 = kmhToMs(kmh);
          const S = stopping({ v0, tr, a }).total;
          expect(speedForStoppingDistance(S, tr, a)).toBeCloseTo(v0, 9);
        }
  });

  it('for å stoppe på 53,1 m på våt asfalt må farten ned til ca. 67 km/h', () => {
    const S = stopping({ v0: kmhToMs(80), tr: 1, a: 8 }).total;
    const v = speedForStoppingDistance(S, 1, 5);
    // v = a(√(t_r² + 2S/a) − t_r) = 5 · (√22,23 − 1) = 18,58 m/s
    expect(msToKmh(v)).toBeCloseTo(66.9, 1);
    expect(stopping({ v0: v, tr: 1, a: 5 }).total).toBeCloseTo(S, 9);
  });

  it('uten reaksjonstid er det bare bremselengden, og ingen strekning gir null', () => {
    expect(speedForStoppingDistance(50, 0, 8)).toBeCloseTo(Math.sqrt(2 * 8 * 50), 12);
    expect(speedForStoppingDistance(0, 1, 8)).toBe(0);
  });
});

describe('utsnittet av veien', () => {
  it('viser bilen bak start og elgen, med enden på et helt antall tiere', () => {
    for (const [input, D] of allInputs()) {
      const total = stopping(input).total;
      const { min, max } = sceneRange(D, total);
      expect(min).toBe(-VIEW_BEHIND);
      expect(min).toBeLessThan(-4.4);
      expect(max).toBeGreaterThanOrEqual(D + 5);
      expect(max % 10).toBe(0);
      expect(max).toBeLessThanOrEqual(Math.ceil((1.5 * (D + 5)) / 10) * 10);
    }
  });

  it('tar med hele stopplengden når den ikke er mye lengre enn avstanden til elgen', () => {
    expect(sceneRange(60, 53.1)).toEqual({ min: -VIEW_BEHIND, max: 70 });
    expect(sceneRange(60, 71.6)).toEqual({ min: -VIEW_BEHIND, max: 80 });
    // Is: 269 m får ikke plass
    expect(sceneRange(60, 269)).toEqual({ min: -VIEW_BEHIND, max: 70 });
    expect(sceneRange(10, 4)).toEqual({ min: -VIEW_BEHIND, max: 20 });
  });
});
