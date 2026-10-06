import { describe, expect, it } from 'vitest';
import {
  CRUSH,
  DUMMY_MASS,
  RESTRAINTS,
  RESTRAINT_ORDER,
  SPEED_KMH,
  T_END,
  airbagFill,
  crash,
  crashAt,
  forceAt,
  forceAxisMax,
  forceAxisTicks,
  forceSteps,
  kmh,
  motionAt,
  weightEquivalent,
  type Restraint,
} from './model-krasjtest';

const g = 9.81;
const v50 = kmh(50);

/** Alle kombinasjoner av glidebryterne og sikringene. */
function grid(): { v: number; d: number; r: Restraint }[] {
  const out: { v: number; d: number; r: Restraint }[] = [];
  for (let kmhV = SPEED_KMH.min; kmhV <= SPEED_KMH.max + 1e-9; kmhV += SPEED_KMH.step)
    for (let d = CRUSH.min; d <= CRUSH.max + 1e-9; d += CRUSH.step) for (const r of RESTRAINT_ORDER) out.push({ v: kmh(kmhV), d, r });
  return out;
}

describe('bilen i veggen', () => {
  it('bremses jevnt over knusesonen: a = v²/(2d), t = 2d/v', () => {
    const r = crash(v50, 0.4, 'pute');
    expect(v50).toBeCloseTo(13.889, 3);
    expect(r.car.a).toBeCloseTo(241.1, 1);
    expect(r.car.t).toBeCloseTo(0.0576, 4);
    expect(r.car.g).toBeCloseTo(24.58, 2);
    const end = motionAt(r.v0, r.car.phases, 1);
    expect(end.x).toBeCloseTo(0.4, 12);
    expect(end.v).toBe(0);
  });

  it('en stiv bil stopper på kortere tid enn en med knusesone', () => {
    const stiv = crash(v50, 0.1, 'pute');
    const myk = crash(v50, 0.4, 'pute');
    expect(stiv.car.t).toBeCloseTo(0.0144, 4);
    expect(stiv.car.t / myk.car.t).toBeCloseTo(0.25, 12);
    expect(stiv.car.g / myk.car.g).toBeCloseTo(4, 12);
  });
});

describe('passasjeren med belte', () => {
  it('kjent tallsett: 50 km/h, knusesone 0,40 m, belte og pute', () => {
    const r = crash(v50, 0.4, 'pute');
    expect(r.m).toBe(78);
    expect(r.dp).toBeCloseTo(1083.3, 1);
    expect(r.sBrake).toBeCloseTo(0.75, 12);
    expect(r.rel).toBeCloseTo(0.35, 12);
    expect(r.dt).toBeCloseTo(0.108, 4);
    expect(r.F).toBeCloseTo(10031, 0);
    expect(r.g).toBeCloseTo(13.11, 2);
    expect(r.tStart).toBe(0);
    expect(r.sFree).toBe(0);
    // Jevn kraft: største kraft = gjennomsnittet
    expect(r.Fmax).toBeCloseTo(r.F, 6);
  });

  it('bare belte: s = d + 0,20 m', () => {
    const r = crash(v50, 0.4, 'belte');
    expect(r.sBrake).toBeCloseTo(0.6, 12);
    expect(r.dt).toBeCloseTo(0.0864, 4);
    expect(r.F).toBeCloseTo(12539, 0);
    expect(r.g).toBeCloseTo(16.39, 2);
  });

  it('stiv bil med belte og pute: s = 0,10 m + 0,35 m', () => {
    const r = crash(v50, 0.1, 'pute');
    expect(r.sBrake).toBeCloseTo(0.45, 12);
    expect(r.g).toBeCloseTo(21.85, 2);
    expect(r.F / crash(v50, 0.4, 'pute').F).toBeCloseTo(0.75 / 0.45, 12);
  });

  it('passasjeren glir fram i bilen hele tiden, aldri bakover', () => {
    const r = crash(v50, 0.4, 'belte');
    let prev = -1;
    for (let i = 0; i <= 500; i++) {
      const s = crashAt(r, (i / 500) * T_END);
      expect(s.rel).toBeGreaterThanOrEqual(prev - 1e-12);
      expect(s.passenger.v).toBeGreaterThanOrEqual(s.car.v - 1e-9);
      prev = s.rel;
    }
    expect(prev).toBeCloseTo(0.2, 12);
  });
});

describe('passasjeren uten belte', () => {
  it('flyr fram med full fart og treffer frontruta etter at bilen har stoppet', () => {
    const r = crash(v50, 0.4, 'ingen');
    expect(r.tStart).toBeCloseTo(0.85 / v50, 12);
    expect(r.tStart).toBeGreaterThan(r.car.t);
    expect(r.sFree).toBeCloseTo(0.85, 12);
    expect(r.sBrake).toBeCloseTo(0.05, 12);
    expect(r.dt).toBeCloseTo(0.0072, 4);
    expect(r.F).toBeCloseTo(150_463, 0);
    expect(r.g).toBeCloseTo(196.6, 1);
    // Rett før treffet har passasjeren fortsatt hele farten, og ingen kraft virker.
    const before = crashAt(r, r.tStart - 1e-4);
    expect(before.passenger.v).toBeCloseTo(v50, 12);
    expect(before.F).toBe(0);
    expect(before.car.v).toBe(0);
  });

  it('avstanden til frontruta er minst like stor som den lengste knusesonen', () => {
    expect(RESTRAINTS.ingen.free).toBeGreaterThanOrEqual(CRUSH.max);
  });

  it('knusesonen hjelper ikke: kraften er den samme for alle knusesoner', () => {
    const forces = [];
    for (let d = CRUSH.min; d <= CRUSH.max + 1e-9; d += CRUSH.step) forces.push(crash(v50, d, 'ingen').F);
    for (const F of forces) expect(F).toBeCloseTo(forces[0]!, 6);
  });

  it('treffer frontruta mens bilen fortsatt bremser når knusesonen er lengre enn avstanden dit', () => {
    const d = 0.9;
    const r = crash(v50, d, 'ingen');
    const free = RESTRAINTS.ingen.free;
    const stroke = RESTRAINTS.ingen.stroke;
    expect(r.tStart).toBeLessThan(r.car.t);
    expect(r.tStart).toBeCloseTo(Math.sqrt((2 * free) / r.car.a), 12);
    // Passasjeren ender like langt fram i bilen, og hele Δp er tatt opp.
    expect(r.rel).toBeCloseTo(free + stroke, 9);
    const impulse = r.phases.reduce((sum, p) => sum + r.m * p.a * (p.t1 - p.t0), 0);
    expect(impulse).toBeCloseTo(r.dp, 9);
    // Etter treffet følger passasjeren med bilen (samme fart), og står stille når bilen gjør det.
    expect(r.tStop).toBeCloseTo(r.car.t, 12);
  });
});

describe('impulsloven og energien gjelder for alle tallsett', () => {
  it('arealet under F-t-grafen er Δp = mv, og F_gj · Δt = Δp', () => {
    for (const { v, d, r: rr } of grid()) {
      const r = crash(v, d, rr);
      const impulse = r.phases.reduce((sum, p) => sum + r.m * p.a * (p.t1 - p.t0), 0);
      expect(impulse).toBeCloseTo(r.dp, 6);
      expect(r.F * r.dt).toBeCloseTo(r.dp, 6);
      expect(r.dp).toBeCloseTo(DUMMY_MASS * v, 9);
      // Areal under trappekurven = Δp (trapesmetoden er eksakt for rette biter)
      const pts = forceSteps(r);
      let area = 0;
      for (let i = 1; i < pts.length; i++) area += ((pts[i]![1] + pts[i - 1]![1]) / 2) * (pts[i]![0] - pts[i - 1]![0]);
      expect(area).toBeCloseTo(r.dp, 6);
    }
  });

  it('jevn oppbremsing: Δt = 2s/v, og arbeidet F_gj · s = ½mv²', () => {
    for (const { v, d, r: rr } of grid()) {
      const r = crash(v, d, rr);
      expect(r.dt).toBeCloseTo((2 * r.sBrake) / v, 9);
      expect(r.F * r.sBrake).toBeCloseTo(0.5 * r.m * v * v, 6);
      expect(r.g).toBeCloseTo((v * v) / (2 * r.sBrake * g), 6);
    }
  });

  it('passasjeren ender rett bak dashbordet eller i beltet, og står stille innen T_END', () => {
    for (const { v, d, r: rr } of grid()) {
      const r = crash(v, d, rr);
      const spec = RESTRAINTS[rr];
      expect(r.rel).toBeCloseTo(spec.free + spec.stroke, 9);
      expect(r.tStop).toBeLessThan(T_END);
      const end = crashAt(r, T_END);
      expect(end.passenger.v).toBe(0);
      expect(end.car.v).toBe(0);
      expect(end.car.x).toBeCloseTo(d, 9);
      expect(end.rel).toBeCloseTo(r.rel, 9);
    }
  });

  it('passasjeren beveger seg aldri bakover i bilen', () => {
    for (const { v, d, r: rr } of grid()) {
      const r = crash(v, d, rr);
      let prev = 0;
      for (let i = 0; i <= 250; i++) {
        const rel = crashAt(r, (i / 250) * T_END).rel;
        expect(rel).toBeGreaterThanOrEqual(prev - 1e-9);
        prev = rel;
      }
    }
  });

  it('belte og pute gir minst kraft, uten belte mest, for alle tallsett', () => {
    for (let kmhV = SPEED_KMH.min; kmhV <= SPEED_KMH.max; kmhV += SPEED_KMH.step)
      for (let d = CRUSH.min; d <= CRUSH.max + 1e-9; d += CRUSH.step) {
        const [ingen, belte, pute] = RESTRAINT_ORDER.map((r) => crash(kmh(kmhV), d, r).F);
        expect(pute!).toBeLessThan(belte!);
        expect(belte!).toBeLessThan(ingen!);
      }
  });

  it('en stivere bil gir større kraft på passasjeren med belte', () => {
    for (const rr of ['belte', 'pute'] as const) {
      let prev = Infinity;
      for (let d = CRUSH.min; d <= CRUSH.max + 1e-9; d += CRUSH.step) {
        const F = crash(v50, d, rr).F;
        expect(F).toBeLessThan(prev);
        prev = F;
      }
    }
  });

  it('dobbel fart gir fire ganger så stor kraft (samme stoppstrekning)', () => {
    for (const rr of RESTRAINT_ORDER) {
      const a = crash(kmh(40), 0.5, rr);
      const b = crash(kmh(80), 0.5, rr);
      expect(b.F / a.F).toBeCloseTo(4, 9);
      expect(b.dt / a.dt).toBeCloseTo(0.5, 9);
    }
  });

  it('ingen NaN eller uendelige tall', () => {
    for (const { v, d, r: rr } of grid()) {
      const r = crash(v, d, rr);
      for (const x of [r.F, r.g, r.dt, r.sBrake, r.sFree, r.rel, r.tStart, r.tStop, r.Fmax, r.car.a, r.car.t]) expect(Number.isFinite(x)).toBe(true);
      for (let i = 0; i <= 50; i++) {
        const s = crashAt(r, (i / 50) * T_END);
        for (const x of [s.car.x, s.car.v, s.passenger.x, s.passenger.v, s.rel, s.F]) expect(Number.isFinite(x)).toBe(true);
      }
    }
  });
});

describe('hjelpefunksjoner', () => {
  it('motionAt før, under og etter bremsingen', () => {
    const phases = [{ t0: 0.1, t1: 0.2, a: 10 }];
    expect(motionAt(2, phases, -1)).toEqual({ x: 0, v: 2, a: 0 });
    expect(motionAt(2, phases, 0.05)).toEqual({ x: 0.1, v: 2, a: 0 });
    const mid = motionAt(2, phases, 0.15);
    expect(mid.x).toBeCloseTo(0.2 + 2 * 0.05 - 0.5 * 10 * 0.0025, 12);
    expect(mid.v).toBeCloseTo(1.5, 12);
    expect(mid.a).toBe(10);
    const end = motionAt(2, phases, 1);
    expect(end.x).toBeCloseTo(0.2 + 0.2 - 0.05, 12);
    expect(end.v).toBe(0);
  });

  it('forceAt er null før og etter støtet', () => {
    const r = crash(v50, 0.4, 'ingen');
    expect(forceAt(r, 0.01)).toBe(0);
    expect(forceAt(r, r.tStart + r.dt / 2)).toBeCloseTo(r.F, 6);
    expect(forceAt(r, r.tStop + 0.001)).toBe(0);
  });

  it('kraftaksen gir plass til beltet i den stiveste bilen og er et rundt tall', () => {
    for (let kmhV = SPEED_KMH.min; kmhV <= SPEED_KMH.max; kmhV += SPEED_KMH.step) {
      const v = kmh(kmhV);
      const max = forceAxisMax(v);
      expect(max * 1000).toBeGreaterThan(crash(v, CRUSH.min, 'belte').F);
      const ticks = forceAxisTicks(max);
      expect(ticks[0]).toBe(0);
      expect(ticks[ticks.length - 1]).toBe(max);
      expect(ticks.length).toBeGreaterThanOrEqual(3);
      expect(ticks.length).toBeLessThanOrEqual(7);
      for (const t of ticks) expect(Number.isInteger(t)).toBe(true);
    }
    expect(forceAxisMax(v50)).toBe(30);
  });

  it('kollisjonsputa er tom før 15 ms og full etter 40 ms', () => {
    expect(airbagFill(0)).toBe(0);
    expect(airbagFill(0.015)).toBe(0);
    expect(airbagFill(0.025)).toBeGreaterThan(0.5);
    expect(airbagFill(0.04)).toBe(1);
    expect(airbagFill(0.2)).toBe(1);
    // Med knusesone (50 km/h, 0,40 m) er puta full før passasjeren har glidd 10 cm fram i bilen.
    const r = crash(v50, 0.4, 'pute');
    expect(crashAt(r, 0.04).rel).toBeLessThan(0.1);
  });

  it('tyngden av ... kg', () => {
    expect(weightEquivalent(9810)).toBeCloseTo(1000, 9);
  });
});
