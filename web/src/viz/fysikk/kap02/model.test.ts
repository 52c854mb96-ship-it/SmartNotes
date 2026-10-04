import { describe, expect, it } from 'vitest';
import {
  bookOnTable,
  coupled,
  criticalAngleDeg,
  dragFall,
  eulerFall,
  friction,
  incline,
  liftPhases,
  liftState,
  scaleForce,
  terminalVelocity,
} from './model';

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

describe('kloss på skråplan', () => {
  const base = { m: 4, muS: 0.5, muK: 0.3 };

  it('dekomponerer G: G∥ = G·sin α og N = G⊥ = G·cos α', () => {
    const r = incline({ ...base, alphaDeg: 20 });
    expect(r.G).toBeCloseTo(39.24, 2);
    expect(r.Gpar).toBeCloseTo(39.24 * Math.sin((20 * Math.PI) / 180), 9);
    expect(r.N).toBeCloseTo(39.24 * Math.cos((20 * Math.PI) / 180), 9);
    expect(r.Gpar ** 2 + r.Gperp ** 2).toBeCloseTo(r.G ** 2, 6);
  });

  it('ligger i ro med R = G∥ så lenge tan α ≤ μs', () => {
    const r = incline({ ...base, alphaDeg: 26 });
    expect(r.moving).toBe(false);
    expect(r.R).toBeCloseTo(r.Gpar, 9);
    expect(r.a).toBe(0);
    expect(r.R).toBeLessThanOrEqual(r.Rmax);
  });

  it('glir over grensevinkelen med a = g(sin α − μk·cos α)', () => {
    const r = incline({ ...base, alphaDeg: 30 });
    expect(r.moving).toBe(true);
    expect(r.R).toBeCloseTo(r.Rk, 9);
    expect(r.a).toBeCloseTo(9.81 * (0.5 - 0.3 * Math.cos(Math.PI / 6)), 9);
    expect(r.a).toBeCloseTo(2.36, 2);
  });

  it('akselerasjonen avhenger ikke av massen', () => {
    const a1 = incline({ ...base, m: 1, alphaDeg: 40 }).a;
    const a2 = incline({ ...base, m: 10, alphaDeg: 40 }).a;
    expect(a1).toBeCloseTo(a2, 9);
  });

  it('grensevinkelen er arctan μs (μs = 0,5 gir 26,6°, μs = 1 gir 45°)', () => {
    expect(criticalAngleDeg(0.5)).toBeCloseTo(26.57, 2);
    expect(criticalAngleDeg(1)).toBeCloseTo(45, 9);
    // Akkurat på grensen ligger klossen fortsatt i ro
    expect(incline({ ...base, muS: 1, alphaDeg: 45 }).moving).toBe(false);
  });

  it('glatt skråplan gir a = g·sin α, og vannrett underlag gir N = G uten friksjon', () => {
    expect(incline({ m: 2, muS: 0, muK: 0, alphaDeg: 30 }).a).toBeCloseTo(4.905, 9);
    const flat = incline({ ...base, alphaDeg: 0 });
    expect(flat.N).toBeCloseTo(flat.G, 9);
    expect(flat.R).toBe(0);
    expect(flat.moving).toBe(false);
  });

  it('μk kan aldri bli større enn μs', () => {
    const r = incline({ m: 1, muS: 0.2, muK: 0.6, alphaDeg: 30 });
    expect(r.Rk).toBeCloseTo(r.Rmax, 9);
    expect(r.a).toBeGreaterThan(0);
  });
});

describe('heis', () => {
  it('vekta viser N = m(g + a)', () => {
    expect(scaleForce(70, 0)).toBeCloseTo(686.7, 1);
    expect(scaleForce(70, 2)).toBeCloseTo(826.7, 1);
    expect(scaleForce(70, -2)).toBeCloseTo(546.7, 1);
  });

  it('i fritt fall er normalkraften null, og den blir aldri negativ', () => {
    expect(scaleForce(70, -9.81)).toBe(0);
    expect(scaleForce(70, -12)).toBe(0);
  });

  it('tur opp: fart og forflytning fase for fase', () => {
    const ph = liftPhases('opp', 2);
    expect(liftState(ph, 0.5)).toMatchObject({ a: 0, v: 0, y: 0 });
    const acc = liftState(ph, 2);
    expect(acc.phase.kind).toBe('akselererer');
    expect(acc.a).toBe(2);
    expect(acc.v).toBeCloseTo(2, 9);
    expect(acc.y).toBeCloseTo(1, 9);
    const cruise = liftState(ph, 5);
    expect(cruise.phase.kind).toBe('konstant');
    expect(cruise.a).toBe(0);
    expect(cruise.v).toBeCloseTo(4, 9);
    const brake = liftState(ph, 8);
    expect(brake.phase.kind).toBe('bremser');
    expect(brake.a).toBe(-2);
    expect(brake.v).toBeGreaterThan(0);
    // Står stille til slutt etter 12·a0 = 24 m
    const end = liftState(ph, 10);
    expect(end.v).toBeCloseTo(0, 9);
    expect(end.y).toBeCloseTo(24, 9);
  });

  it('tur ned er speilbildet av tur opp', () => {
    const up = liftState(liftPhases('opp', 1.5), 8);
    const down = liftState(liftPhases('ned', 1.5), 8);
    expect(down.a).toBe(-up.a);
    expect(down.v).toBeCloseTo(-up.v, 9);
    expect(down.y).toBeCloseTo(-up.y, 9);
  });

  it('fritt fall: a = −g, og nødbremsen stopper heisen igjen', () => {
    const ph = liftPhases('fritt-fall', 2);
    const fall = liftState(ph, 2);
    expect(fall.phase.kind).toBe('fritt-fall');
    expect(fall.v).toBeCloseTo(-9.81, 9);
    expect(scaleForce(70, fall.a)).toBe(0);
    const brake = liftState(ph, 4);
    expect(brake.phase.kind).toBe('nodbrems');
    expect(scaleForce(70, brake.a)).toBeCloseTo(2 * 70 * 9.81, 9);
    const end = liftState(ph, 10);
    expect(end.v).toBeCloseTo(0, 9);
    expect(end.y).toBeCloseTo(-2 * 9.81 * 2, 9);
  });
});

describe('fall med luftmotstand', () => {
  it('terminalfart v_T = √(mg/k): fallskjermhopper på 80 kg med k = 0,25 kg/m', () => {
    expect(terminalVelocity(80, 0.25)).toBeCloseTo(56.03, 2);
    expect(terminalVelocity(80, 0)).toBe(Infinity);
  });

  it('starter med a = g og L = 0', () => {
    const r = dragFall(80, 0.25, 0);
    expect(r.v).toBe(0);
    expect(r.L).toBe(0);
    expect(r.a).toBeCloseTo(9.81, 9);
  });

  it('Newtons 2. lov gjelder hele veien: m·a = mg − kv²', () => {
    for (const t of [0.5, 2, 5, 12]) {
      const r = dragFall(70, 0.3, t);
      expect(70 * r.a).toBeCloseTo(70 * 9.81 - 0.3 * r.v ** 2, 9);
      // a = dv/dt (numerisk derivert)
      const h = 1e-5;
      const dv = (dragFall(70, 0.3, t + h).v - dragFall(70, 0.3, t - h).v) / (2 * h);
      expect(dv).toBeCloseTo(r.a, 4);
    }
  });

  it('nærmer seg terminalfarten, og L nærmer seg G', () => {
    const r = dragFall(80, 0.25, 60);
    expect(r.v).toBeCloseTo(terminalVelocity(80, 0.25), 6);
    expect(r.L).toBeCloseTo(80 * 9.81, 3);
    expect(r.a).toBeCloseTo(0, 6);
    expect(Number.isFinite(dragFall(40, 1, 500).s)).toBe(true);
  });

  it('i starten er fallet nesten som uten luftmotstand', () => {
    const t = 0.3;
    expect(dragFall(80, 0.25, t).v).toBeCloseTo(9.81 * t, 2);
    expect(dragFall(80, 0.25, t).s).toBeCloseTo(0.5 * 9.81 * t * t, 2);
    expect(dragFall(80, 0, 3)).toMatchObject({ v: 9.81 * 3, a: 9.81, L: 0 });
  });

  it('Eulers metode nærmer seg den eksakte løsningen når Δt blir liten', () => {
    const exact = dragFall(80, 0.25, 5).v;
    const coarse = eulerFall(80, 0.25, 1, 5).at(-1)![1];
    const fine = eulerFall(80, 0.25, 0.001, 5).at(-1)![1];
    expect(Math.abs(fine - exact)).toBeLessThan(0.01);
    expect(Math.abs(coarse - exact)).toBeGreaterThan(Math.abs(fine - exact));
    // Første steg: v = g·Δt
    expect(eulerFall(80, 0.25, 1, 2)[1]).toEqual([1, 9.81]);
  });
});
