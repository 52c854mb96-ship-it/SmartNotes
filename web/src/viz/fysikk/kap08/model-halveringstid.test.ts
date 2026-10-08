import { describe, expect, it } from 'vitest';
import { countRemaining, decayTimes } from './model';
import {
  ALPHA_RANGE_AIR,
  FRESH_WINDOW,
  anyAngle,
  decayedCount,
  decaysBetween,
  emissionDraws,
  freshDecays,
  trackLength,
  upwardAngle,
} from './model-halveringstid';

describe('strålingen fra prøven', () => {
  it('tilfeldige tall med fast frø, alle mellom 0 og 1', () => {
    expect(emissionDraws(40, 3)).toEqual(emissionDraws(40, 3));
    expect(emissionDraws(40, 3)).not.toEqual(emissionDraws(40, 4));
    for (const d of emissionDraws(400, 24)) {
      for (const v of [d.u, d.v, d.w]) {
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThan(1);
      }
    }
  });

  it('retningene oppover holder seg i den øvre halvdelen, og 0,5 er rett opp', () => {
    expect(upwardAngle(0.5)).toBeCloseTo(Math.PI / 2, 12);
    expect(upwardAngle(0, 80)).toBeCloseTo((10 * Math.PI) / 180, 12);
    expect(upwardAngle(1, 80)).toBeCloseTo((170 * Math.PI) / 180, 12);
    for (const w of [0, 0.1, 0.37, 0.9, 1, -2, 7, NaN]) {
      const a = upwardAngle(w, 90);
      expect(Math.sin(a)).toBeGreaterThanOrEqual(-1e-12);
    }
    expect(anyAngle(0.25)).toBeCloseTo(Math.PI / 2, 12);
  });

  it('α-partikler stopper etter noen centimeter i luft', () => {
    expect(ALPHA_RANGE_AIR).toBeGreaterThan(0.02);
    expect(ALPHA_RANGE_AIR).toBeLessThan(0.06);
  });

  it('sporet stopper ved rekkevidden eller veggen, det som kommer først', () => {
    const box = { x0: -0.02, y0: 0, x1: 0.02, y1: 0.05 };
    expect(trackLength(0, 0.01, 0, 1)).toBe(1);
    expect(trackLength(0, 0.01, 0, 0.035, box)).toBeCloseTo(0.02, 12);
    expect(trackLength(0, 0.01, Math.PI / 2, 0.035, box)).toBeCloseTo(0.035, 12);
    expect(trackLength(0, 0.04, Math.PI / 2, 0.035, box)).toBeCloseTo(0.01, 12);
    expect(trackLength(0, 0.01, Math.PI, 0.035, box)).toBeCloseTo(0.02, 12);
    expect(trackLength(0, 0.01, -Math.PI / 2, 0.035, box)).toBeCloseTo(0.01, 12);
    // Diagonalt mot hjørnet: veggen i x kommer først
    expect(trackLength(0, 0.01, Math.PI / 4, 1, box)).toBeCloseTo(0.02 * Math.SQRT2, 12);
    // Utenfor boksen eller uten rekkevidde: ingen spor
    expect(trackLength(0.05, 0.01, 0, 1, box)).toBe(0);
    expect(trackLength(0, 0.01, 0, 0, box)).toBe(0);
  });
});

describe('klikkene i telleren', () => {
  const times = decayTimes(400, 24);

  it('henfall + kjerner igjen = 400 hele tida', () => {
    for (const t of [0, 0.3, 1, 2.5, 6]) expect(decayedCount(times, t) + countRemaining(times, t)).toBe(400);
    expect(decayedCount(times, 0)).toBe(0);
  });

  it('kjernene som akkurat har henfalt, er de som henfalt i det siste vinduet', () => {
    for (const t of [0.05, 1, 2, 4.5, 6]) {
      const fresh = freshDecays(times, t);
      // Med tilfeldige tall kan et henfall falle akkurat på grensen, så sammenlign med en liten margin
      expect(Math.abs(fresh.length - decaysBetween(times, t - FRESH_WINDOW, t))).toBeLessThanOrEqual(1);
      for (const { i, age } of fresh) {
        expect(age).toBeGreaterThanOrEqual(0);
        expect(age).toBeLessThan(1);
        expect(times[i]).toBeLessThanOrEqual(t);
      }
    }
    expect(freshDecays(times, 0)).toHaveLength(0);
    expect(freshDecays(times, 1, 0)).toHaveLength(0);
  });

  it('klikkraten halveres for hver halveringstid (aktiviteten følger N)', () => {
    const many = decayTimes(200000, 5);
    const r0 = decaysBetween(many, 0, 0.1);
    const r1 = decaysBetween(many, 1, 1.1);
    const r2 = decaysBetween(many, 2, 2.1);
    expect(r0 / r1).toBeCloseTo(2, 1);
    expect(r1 / r2).toBeCloseTo(2, 1);
    // Forventet: N₀ · (1 − 2^(−0,1)) henfall i det første tidsrommet
    expect(r0 / 200000).toBeCloseTo(1 - 2 ** -0.1, 2);
  });
});
