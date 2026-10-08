import { describe, expect, it } from 'vitest';
import {
  CV_AIR,
  GAS_TASKS,
  PISTON_AREA,
  RIG,
  R_GAS,
  columnHeight,
  exactProcess,
  molesFrom,
  roundSig,
  solveGasTask,
  toKelvin,
  volumeFrom,
} from './model-eks-gass';

describe('eks-gass: tallsett 1 (kokende vannbad)', () => {
  const task = GAS_TASKS[0]!;
  const s = solveGasTask(task);

  it('a) n = 1,01 · 10⁵ Pa · 1,50 · 10⁻³ m³ / (8,31 · 291,15 K) = 0,0626 mol', () => {
    expect(s.T1).toBeCloseTo(291.15, 10);
    expect(s.p0).toBe(101000);
    expect(s.V1).toBeCloseTo(1.5e-3, 12);
    expect(s.n).toBeCloseTo(0.062622, 5);
  });

  it('a) med celsius blir n omtrent 16 ganger for stor', () => {
    expect(s.nCelsius).toBeCloseTo(1.0129, 3);
    expect(s.nCelsius / s.n).toBeCloseTo(291.15 / 18, 8);
  });

  it('b) p₂ = 101 kPa · 373,15 / 291,15 = 129,4 kPa, omtrent 129 kPa', () => {
    expect(s.T2).toBeCloseTo(373.15, 10);
    expect(s.p2).toBeCloseTo(129445.8, 0);
    expect(s.p2Shown).toBe(129);
    expect(s.p2Celsius).toBeCloseTo(561111, 0);
  });

  it('c) splinten holder igjen (p₂ − p₀)A = 284 N', () => {
    expect(s.Fgas2).toBeCloseTo(1294.46, 2);
    expect(s.Fair).toBeCloseTo(1010, 8);
    expect(s.Fpin).toBeCloseTo(284.46, 2);
  });

  it('d) oppvarmingen: Q = 107 J og W = 0 ⇒ ΔU = 107 J', () => {
    expect(s.Qheat).toBe(107);
    expect(s.Wheat).toBe(0);
    expect(s.dUheat).toBe(107);
  });

  it('d) utvidelsen: W = −36 J, Q = +20 J ⇒ ΔU = −16 J', () => {
    expect(s.Wout).toBe(36);
    expect(s.Wexp).toBe(-36);
    expect(s.Qexp).toBe(20);
    expect(s.dUexp).toBe(-16);
  });

  it('e) t₃ = 87,6 °C, p₃ = p₀ og V₃ = 1,86 L', () => {
    expect(s.t3).toBe(87.6);
    expect(s.p3).toBe(s.p0);
    expect(s.V3 * 1000).toBeCloseTo(1.8586, 3);
    expect(s.Fgas3).toBeCloseTo(s.Fair, 10);
  });
});

describe('eks-gass: tallsett 2 (80 °C) og 3 (kaldt vann som koker)', () => {
  it('tallsett 2: n = 0,0486 mol, p₂ ≈ 119 kPa, F_s = 199 N, ΔU = −6 J, V₃ = 1,42 L', () => {
    const s = solveGasTask(GAS_TASKS[1]!);
    expect(s.n).toBeCloseTo(0.048601, 5);
    expect(s.p2Shown).toBe(119);
    expect(s.Fpin).toBeCloseTo(198.6, 1);
    expect(s.Qheat).toBe(60);
    expect(s.Wout).toBe(21);
    expect(s.dUexp).toBe(-6);
    expect(s.t3).toBe(73.8);
    expect(s.V3 * 1000).toBeCloseTo(1.415, 2);
  });

  it('tallsett 3: n = 0,0689 mol, p₂ ≈ 133 kPa, F_s = 315 N, ΔU = −18 J, V₃ = 2,02 L', () => {
    const s = solveGasTask(GAS_TASKS[2]!);
    expect(s.n).toBeCloseTo(0.068873, 5);
    expect(s.p2Shown).toBe(133);
    expect(s.Fpin).toBeCloseTo(314.8, 1);
    expect(s.Qheat).toBe(126);
    expect(s.Wout).toBe(43);
    expect(s.dUexp).toBe(-18);
    expect(s.t3).toBe(87.3);
    expect(s.V3 * 1000).toBeCloseTo(2.023, 2);
  });
});

describe('eks-gass: alle tallsettene gir fornuftige og sammenhengende svar', () => {
  for (const [i, task] of GAS_TASKS.entries()) {
    const s = solveGasTask(task);
    const e = exactProcess(task);
    const name = `tallsett ${i + 1}`;

    it(`${name}: tilstandslikningen stemmer i alle tre tilstandene (pV/T = nR)`, () => {
      expect((s.p0 * s.V1) / s.T1).toBeCloseTo(s.n * R_GAS, 10);
      expect((s.p2 * s.V1) / s.T2).toBeCloseTo(s.n * R_GAS, 10);
      expect((s.p3 * s.V3) / s.T3).toBeCloseTo(s.n * R_GAS, 10);
    });

    it(`${name}: trykket stiger med oppvarmingen, men celsius-feilen gir mye mer`, () => {
      expect(s.p2).toBeGreaterThan(s.p0);
      expect(s.p2 / s.p0).toBeLessThan(1.35);
      expect(s.p2Celsius / s.p2).toBeGreaterThan(2.5);
      expect(Math.abs(s.p2Shown * 1000 - s.p2) / s.p2).toBeLessThan(0.005);
    });

    it(`${name}: kreftene på det låste stempelet går i null, og splinten tar trykkforskjellen`, () => {
      expect(s.Fgas2 - s.Fair - s.Fpin).toBeCloseTo(0, 10);
      expect(s.Fpin).toBeCloseTo((s.p2 - s.p0) * PISTON_AREA, 8);
      expect(s.Fpin).toBeGreaterThan(150);
      expect(s.Fpin).toBeLessThan(400);
    });

    it(`${name}: første lov i den nøyaktige modellen (energibevaring)`, () => {
      // Oppvarmingen: ΔU = n·Cv·ΔT = Q, utvidelsen: ΔU = −p₀ΔV + Q.
      const n = s.n;
      expect(n * CV_AIR * (s.T2 - s.T1)).toBeCloseTo(e.Qheat, 8);
      expect(e.dUexp).toBeCloseTo(-e.Wout + task.Qexp, 8);
      expect(e.Wout).toBeCloseTo(s.p0 * (e.V3 - s.V1), 8);
      expect(s.p0 * e.V3).toBeCloseTo(n * R_GAS * e.T3, 6);
    });

    it(`${name}: de avrundede tallene i teksten passer med den nøyaktige modellen`, () => {
      expect(Math.abs(s.Qheat - e.Qheat)).toBeLessThanOrEqual(0.5);
      expect(Math.abs(s.Wout - e.Wout)).toBeLessThanOrEqual(0.5);
      expect(Math.abs(s.dUexp - e.dUexp)).toBeLessThanOrEqual(1);
      expect(Math.abs(s.T3 - e.T3)).toBeLessThanOrEqual(0.05 + 1e-9);
      expect(Math.abs(s.V3 - e.V3) / e.V3).toBeLessThan(0.001);
    });

    it(`${name}: lufta får varme, men blir kaldere fordi den gjør mer arbeid`, () => {
      expect(s.Qexp).toBeGreaterThan(0);
      expect(s.Wexp).toBeLessThan(0);
      expect(s.dUexp).toBeLessThan(0);
      expect(s.T3).toBeLessThan(s.T2);
      expect(s.T3).toBeGreaterThan(s.T1);
      expect(s.V3).toBeGreaterThan(s.V1);
    });

    it(`${name}: tallene er realistiske for en sylinder i et vannbad`, () => {
      expect(s.n).toBeGreaterThan(0.03);
      expect(s.n).toBeLessThan(0.1);
      expect(s.Qheat).toBeGreaterThan(30);
      expect(s.Qheat).toBeLessThan(200);
      expect(s.Wout).toBeGreaterThan(s.Qexp);
      expect(s.T2 - s.T3).toBeLessThan(20);
    });

    it(`${name}: stempelet holder seg i sylinderen, og luftsøylen står i vannet før utvidelsen`, () => {
      const h1 = columnHeight(task.V1);
      const h3 = columnHeight(s.V3 * 1000);
      expect(h3 + RIG.piston).toBeLessThan(RIG.height - 1);
      expect(RIG.base + h1).toBeLessThanOrEqual(RIG.water);
      expect(RIG.water).toBeLessThan(RIG.bathH);
      expect(RIG.r + RIG.wall).toBeLessThan(RIG.bathR - 2);
    });
  }
});

describe('eks-gass: hjelpefunksjonene', () => {
  it('molesFrom og volumeFrom er omvendte, og T ≤ 0 gir NaN', () => {
    const n = molesFrom(1.0e5, 2.0e-3, 300);
    expect(volumeFrom(n, 300, 1.0e5)).toBeCloseTo(2.0e-3, 12);
    expect(molesFrom(1.0e5, 1e-3, 0)).toBeNaN();
    expect(volumeFrom(0.1, 300, 0)).toBeNaN();
  });

  it('kelvin og gjeldende siffer', () => {
    expect(toKelvin(0)).toBe(273.15);
    expect(toKelvin(-273.15)).toBeCloseTo(0, 10);
    expect(roundSig(129.445, 3)).toBe(129);
    expect(roundSig(118.86, 3)).toBe(119);
    expect(roundSig(0, 3)).toBe(0);
  });

  it('arealet 100 cm² gir 10 cm luftsøyle per liter og radius 5,64 cm', () => {
    expect(columnHeight(1)).toBeCloseTo(10, 10);
    expect(RIG.r).toBeCloseTo(5.642, 3);
  });
});
