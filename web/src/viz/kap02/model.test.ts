import { describe, expect, it } from 'vitest';
import { bookOnTable, coupled, friction } from './model';

describe('friksjon', () => {
  const base = { m: 6, muS: 0.5, muK: 0.3 };

  it('statisk friksjon er like stor som dyttet så lenge klossen står i ro', () => {
    const r = friction({ ...base, F: 12 });
    expect(r.moving).toBe(false);
    expect(r.R).toBe(12);
    expect(r.a).toBe(0);
    expect(r.N).toBeCloseTo(58.86, 2);
    expect(r.Rmax).toBeCloseTo(29.43, 2);
  });

  it('akkurat på grensen står klossen fortsatt i ro', () => {
    const N = 6 * 9.81;
    expect(friction({ ...base, F: 0.5 * N }).moving).toBe(false);
  });

  it('glir når dyttet er større enn μs·N, og da er friksjonen μk·N', () => {
    const r = friction({ ...base, F: 40 });
    expect(r.moving).toBe(true);
    expect(r.R).toBeCloseTo(17.658, 3);
    expect(r.a).toBeCloseTo((40 - 17.658) / 6, 3);
  });

  it('holder seg i gang mellom μk·N og μs·N når den allerede glir', () => {
    expect(friction({ ...base, F: 20, wasMoving: false }).moving).toBe(false);
    expect(friction({ ...base, F: 20, wasMoving: true }).moving).toBe(true);
    expect(friction({ ...base, F: 15, wasMoving: true }).moving).toBe(false);
  });

  it('μk kan aldri bli større enn μs', () => {
    const r = friction({ m: 1, muS: 0.2, muK: 0.6, F: 5 });
    expect(r.Rk).toBeCloseTo(r.Rmax, 9);
  });
});

describe('bok på bord', () => {
  it('N = G uten hånd, og kraftparene er like store', () => {
    const r = bookOnTable(1.5);
    expect(r.G).toBeCloseTo(14.715, 3);
    expect(r.N).toBe(r.G);
    expect(r.earthAccel).toBeLessThan(1e-23);
  });

  it('dytt fra hånda gjør N større enn G', () => {
    const r = bookOnTable(1.5, 10);
    expect(r.N - r.G).toBeCloseTo(10, 9);
  });
});

describe('koblede klosser', () => {
  it('eksempelet fra boka: 9 N på 2 kg + 4 kg', () => {
    const r = coupled(2, 4, 9);
    expect(r.a).toBeCloseTo(1.5, 9);
    expect(r.S).toBeCloseTo(3, 9);
    expect(r.netA).toBeCloseTo(2 * r.a, 9);
    expect(r.netB).toBeCloseTo(4 * r.a, 9);
  });

  it('uten kraft står alt stille', () => {
    expect(coupled(3, 3, 0)).toEqual({ a: 0, S: 0, netA: 0, netB: 0 });
  });
});
