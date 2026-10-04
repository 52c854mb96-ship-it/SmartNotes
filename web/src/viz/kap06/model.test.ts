import { describe, expect, it } from 'vitest';
import {
  SIGMA,
  blackbodyRgb,
  crestPositions,
  epsForSurfaceTemp,
  maxLongitudinalAmplitude,
  particleVelocity,
  period,
  planck,
  planckBand,
  radiationBalance,
  stefanBoltzmann,
  visibleFraction,
  waveDisplacement,
  waveSpeed,
  wavelengthRgb,
  wienPeak,
} from './model';

describe('bølger', () => {
  it('v = λ·f og T = 1/f', () => {
    expect(waveSpeed(2, 0.5)).toBe(1);
    expect(waveSpeed(0.68, 500)).toBeCloseTo(340, 9); // lyd i luft
    expect(period(0.5)).toBe(2);
    expect(period(0)).toBe(Infinity);
  });

  it('bølgen gjentar seg etter én bølgelengde og etter én periode', () => {
    const [A, lambda, f] = [0.3, 2, 0.5];
    for (const [x, t] of [
      [0.3, 0.1],
      [1.7, 2.4],
      [4.1, 7.3],
    ] as const) {
      const y = waveDisplacement(x, t, A, lambda, f);
      expect(waveDisplacement(x + lambda, t, A, lambda, f)).toBeCloseTo(y, 9);
      expect(waveDisplacement(x, t + 1 / f, A, lambda, f)).toBeCloseTo(y, 9);
      expect(Math.abs(y)).toBeLessThanOrEqual(A + 1e-12);
    }
  });

  it('formen flytter seg med farten v = λf i positiv x-retning', () => {
    const [A, lambda, f] = [0.2, 1.5, 0.8];
    const v = waveSpeed(lambda, f);
    const dt = 0.37;
    for (const x of [0, 0.4, 2.2])
      expect(waveDisplacement(x + v * dt, dt, A, lambda, f)).toBeCloseTo(waveDisplacement(x, 0, A, lambda, f), 9);
  });

  it('partikkelfarten er den deriverte av utslaget, og er null på toppen', () => {
    const [A, lambda, f] = [0.3, 2, 0.5];
    const h = 1e-6;
    for (const t of [0.2, 1.1, 3.3]) {
      const dy = (waveDisplacement(1.5, t + h, A, lambda, f) - waveDisplacement(1.5, t - h, A, lambda, f)) / (2 * h);
      expect(particleVelocity(1.5, t, A, lambda, f)).toBeCloseTo(dy, 5);
    }
    const crest = crestPositions(1.3, lambda, f, 0, 6)[0]!;
    expect(waveDisplacement(crest, 1.3, A, lambda, f)).toBeCloseTo(A, 9);
    expect(particleVelocity(crest, 1.3, A, lambda, f)).toBeCloseTo(0, 9);
  });

  it('bølgetoppene ligger én bølgelengde fra hverandre', () => {
    const crests = crestPositions(0.8, 1.2, 0.7, 0, 6);
    expect(crests.length).toBeGreaterThanOrEqual(4);
    for (let i = 1; i < crests.length; i++) expect(crests[i]! - crests[i - 1]!).toBeCloseTo(1.2, 9);
    for (const c of crests) {
      expect(c).toBeGreaterThanOrEqual(0);
      expect(c).toBeLessThanOrEqual(6);
    }
  });

  it('det finnes alltid en topp eller en dal som har plass til hele λ-målet i øyeblikksbildet', () => {
    // Topper og daler kommer annenhver halve bølgelengde, så én av dem ligger alltid i [0, 6 − λ] når λ ≤ 4 m
    for (const [lambda, f] of [
      [4, 0.25],
      [3.5, 0.5],
      [2, 0.5],
    ] as const) {
      for (let t = 0; t < 2 / f; t += 0.05) {
        const crests = crestPositions(t, lambda, f, 0, 6);
        const troughs = crestPositions(t + 0.5 / f, lambda, f, 0, 6);
        const fits = [...crests, ...troughs].some((p) => p + lambda <= 6 + 1e-9);
        expect(fits).toBe(true);
        for (const p of troughs) expect(waveDisplacement(p, t, 0.3, lambda, f)).toBeCloseTo(-0.3, 9);
      }
    }
  });

  it('longitudinal bølge: partiklene passerer aldri hverandre med den største amplituden', () => {
    const lambda = 0.5;
    const A = maxLongitudinalAmplitude(lambda);
    const dx = 0.01;
    for (let x = 0; x < 2; x += dx) {
      const a = x + waveDisplacement(x, 0.3, A, lambda, 1);
      const b = x + dx + waveDisplacement(x + dx, 0.3, A, lambda, 1);
      expect(b).toBeGreaterThan(a);
    }
  });
});

describe('strålingslovene', () => {
  it('Wiens lov: Sola (5800 K) har toppen ved 500 nm, og glødelampa (2800 K) i infrarødt', () => {
    expect(wienPeak(5800)).toBeCloseTo(500e-9, 10);
    expect(wienPeak(2800) * 1e9).toBeCloseTo(1036, 0);
    // Kroppstemperatur: omtrent 9,4 μm
    expect(wienPeak(310) * 1e6).toBeCloseTo(9.35, 2);
  });

  it('toppen på Planck-kurven ligger der Wiens lov sier', () => {
    for (const T of [2000, 5800, 12000]) {
      const peak = wienPeak(T);
      expect(planck(peak, T)).toBeGreaterThan(planck(peak * 0.97, T));
      expect(planck(peak, T)).toBeGreaterThan(planck(peak * 1.03, T));
    }
  });

  it('Stefan–Boltzmann: I = σT⁴, og dobbel temperatur gir 16 ganger så stor intensitet', () => {
    expect(stefanBoltzmann(5800)).toBeCloseTo(6.42e7, -5);
    expect(stefanBoltzmann(2 * 3000) / stefanBoltzmann(3000)).toBeCloseTo(16, 9);
  });

  it('arealet under Planck-kurven er σT⁴ (innenfor 1 % med de avrundede konstantene)', () => {
    for (const T of [2800, 5800]) {
      const total = planckBand(T, 50e-9, 100e-6, 20000);
      expect(total / stefanBoltzmann(T)).toBeGreaterThan(0.99);
      expect(total / stefanBoltzmann(T)).toBeLessThan(1.01);
    }
  });

  it('Sola sender ut omtrent 40 % synlig lys, glødelampa bare omtrent 10 %', () => {
    expect(visibleFraction(5800)).toBeGreaterThan(0.35);
    expect(visibleFraction(5800)).toBeLessThan(0.45);
    expect(visibleFraction(2800)).toBeGreaterThan(0.06);
    expect(visibleFraction(2800)).toBeLessThan(0.12);
  });

  it('svært kalde legemer sender ut bare noen få prosent synlig lys (vises med én desimal)', () => {
    expect(visibleFraction(2000)).toBeGreaterThan(0.01);
    expect(visibleFraction(2000)).toBeLessThan(0.02);
    expect(Math.round(wienPeak(310) * 1e9 / 100) * 100).toBe(9400);
  });

  it('Planck-kurven er null for ugyldige verdier og flyter ikke over', () => {
    expect(planck(0, 5800)).toBe(0);
    expect(planck(500e-9, 0)).toBe(0);
    expect(planck(10e-9, 300)).toBe(0);
    expect(Number.isFinite(planck(3000e-9, 12000))).toBe(true);
  });

  it('fargene: kalde legemer er røde, varme er blåhvite', () => {
    const [r1, , b1] = blackbodyRgb(2800);
    expect(r1).toBe(255);
    expect(b1).toBeLessThan(180);
    const [r2, g2, b2] = blackbodyRgb(6500);
    expect(Math.min(r2, g2, b2)).toBeGreaterThan(240);
    const [r3, , b3] = blackbodyRgb(12000);
    expect(b3).toBe(255);
    expect(r3).toBeLessThan(220);
    expect(wavelengthRgb(300)).toEqual([0, 0, 0]);
    expect(wavelengthRgb(650)[0]).toBe(255);
    expect(wavelengthRgb(470)[2]).toBe(255);
  });
});

describe('strålingsbalansen', () => {
  it('uten atmosfære og med albedo 0,30 blir jorda 255 K (−18 °C)', () => {
    const b = radiationBalance(0.3, 0);
    expect(b.incoming).toBeCloseTo(340.25, 2);
    expect(b.absorbed).toBeCloseTo(238.2, 1);
    expect(b.Tbare).toBeCloseTo(254.6, 1);
    expect(b.Tsurface).toBeCloseTo(b.Tbare, 9);
    expect(Number.isNaN(b.Tatm)).toBe(true);
  });

  it('med ε ≈ 0,78 gir modellen dagens 288 K, og ε = 1 gir 303 K', () => {
    const eps = epsForSurfaceTemp(0.3, 288);
    expect(eps).toBeCloseTo(0.78, 2);
    expect(radiationBalance(0.3, eps).Tsurface).toBeCloseTo(288, 6);
    expect(radiationBalance(0.3, 1).Tsurface).toBeCloseTo(254.6 * 2 ** 0.25, 0);
  });

  it('energien er i balanse: på toppen av atmosfæren, i atmosfæren og ved bakken', () => {
    for (const [albedo, eps] of [
      [0.3, 0.78],
      [0, 1],
      [0.9, 0.2],
      [0.5, 0],
    ] as const) {
      const b = radiationBalance(albedo, eps);
      // Inn = ut på toppen
      expect(b.reflected + b.outgoingIR).toBeCloseTo(b.incoming, 9);
      // Atmosfæren: absorbert = utstrålt opp + ned
      expect(b.atmAbsorbed).toBeCloseTo(b.atmUp + b.atmDown, 9);
      // Bakken: absorbert sollys + tilbakestråling = utstråling
      expect(b.absorbed + b.atmDown).toBeCloseTo(b.surfaceEmit, 9);
      expect(SIGMA * b.Tsurface ** 4).toBeCloseTo(b.surfaceEmit, 6);
    }
  });

  it('eksemplene: flere drivhusgasser gir omtrent 2,4 K varmere bakke, mer is og snø omtrent 17 K kaldere', () => {
    const today = radiationBalance(0.3, 0.78).Tsurface;
    expect(today).toBeCloseTo(288.1, 1);
    expect(radiationBalance(0.3, 0.82).Tsurface - today).toBeCloseTo(2.4, 1);
    expect(radiationBalance(0.45, 0.78).Tsurface).toBeCloseTo(271.2, 1);
    // Uten atmosfære avhenger temperaturen bare av albedoen
    expect(radiationBalance(0.9, 0).Tsurface).toBeCloseTo(156.5, 1);
    expect(radiationBalance(0, 0).Tsurface).toBeCloseTo(278.3, 1);
  });

  it('høyere albedo gir kaldere jord, mer drivhuseffekt gir varmere bakke', () => {
    expect(radiationBalance(0.6, 0.78).Tsurface).toBeLessThan(radiationBalance(0.3, 0.78).Tsurface);
    expect(radiationBalance(0.3, 0.85).Tsurface).toBeGreaterThan(radiationBalance(0.3, 0.78).Tsurface);
    // Atmosfæren er kaldere enn bakken: T_a = T_b / 2^(1/4)
    const b = radiationBalance(0.3, 0.78);
    expect(b.Tatm).toBeCloseTo(b.Tsurface / 2 ** 0.25, 9);
  });
});
