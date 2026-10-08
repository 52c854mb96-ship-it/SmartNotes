import { describe, expect, it } from 'vitest';
import {
  KELVIN_OFFSET,
  R_SUN,
  SIGMA,
  SUN_TASKS,
  WIEN_B,
  fmtSigPlain,
  fmtStd,
  greenhouseKind,
  planckExitance,
  roundSig,
  solveSunTask,
  spectrumArea,
  spectrumAt,
  spectrumCurve,
  spectrumYMax,
  toCelsius,
} from './model-eks-sola';

const [earth, mars, venus] = SUN_TASKS.map((t) => ({ task: t, s: solveSunTask(t) }));

describe('Sola som svart legeme: a)–c) (samme i alle tallsettene)', () => {
  const s = earth!.s;

  it('a) λ_maks = 500 nm gir T = 2,90 · 10⁻³ / 5,00 · 10⁻⁷ = 5800 K', () => {
    expect(s.lambda).toBeCloseTo(5e-7, 15);
    expect(s.T).toBeCloseTo(5800, 9);
  });

  it('b) I = σT⁴ = 6,416 · 10⁷ W/m², om lag 6,4 · 10⁷ W/m²', () => {
    expect(s.I).toBeCloseTo(6.41645e7, -2);
    expect(s.IShown).toBe(6.4e7);
    expect(fmtStd(s.IShown, 2)).toBe('6,4 · 10⁷');
  });

  it('c) A = 4πR² = 6,087 · 10¹⁸ m² og P = 3,906 · 10²⁶ W', () => {
    expect(s.Asun).toBeCloseTo(6.08735e18, -14);
    expect(s.P).toBeCloseTo(3.90592e26, -22);
    // I samme størrelsesorden som Solas faktiske effekt (3,83 · 10²⁶ W)
    expect(s.P / 3.83e26).toBeGreaterThan(0.98);
    expect(s.P / 3.83e26).toBeLessThan(1.05);
  });

  it('Sola er den samme i alle tallsettene', () => {
    for (const { s: o } of [mars!, venus!]) {
      expect(o.T).toBe(s.T);
      expect(o.I).toBe(s.I);
      expect(o.P).toBe(s.P);
    }
  });
});

describe('Sola som svart legeme: d) intensiteten ved planeten', () => {
  it('jorda: S = 3,906 · 10²⁶ / 2,827 · 10²³ = 1381 W/m² (1,5 % over målt 1361 W/m²)', () => {
    const s = earth!.s;
    expect(s.Asphere).toBeCloseTo(2.82743e23, -19);
    expect(s.S).toBeCloseTo(1381.44, 1);
    expect(s.SError).toBeCloseTo(0.015, 3);
  });

  it('Mars: S = 598 W/m², Venus: S = 2665 W/m²', () => {
    expect(mars!.s.S).toBeCloseTo(597.92, 1);
    expect(venus!.s.S).toBeCloseTo(2664.81, 1);
  });

  it('kuleflaten gir samme svar som I · (R/r)² (avstandskvadratloven)', () => {
    for (const { s } of [earth!, mars!, venus!]) {
      expect(s.S).toBeCloseTo(s.I * s.dilution, 6);
    }
    // Dobbel avstand gir en firedel av intensiteten
    const t = SUN_TASKS[0]!;
    const far = solveSunTask({ ...t, r: 2 * t.r });
    expect(far.S).toBeCloseTo(earth!.s.S / 4, 9);
  });

  it('alle tallsettene gir under 3 % avvik fra den målte intensiteten', () => {
    for (const { s } of [earth!, mars!, venus!]) {
      expect(s.SError).toBeGreaterThan(0);
      expect(s.SError).toBeLessThan(0.03);
    }
  });
});

describe('Sola som svart legeme: e) strålingsbalansen for planeten', () => {
  it('jorda: (1 − 0,30) · 1381 / 4 ≈ 242 W/m², T = 256 K (−17 °C), 32 K under målt 288 K', () => {
    const s = earth!.s;
    expect(s.absorbedAvg).toBeCloseTo(241.75, 2);
    expect(s.Teq).toBeCloseTo(255.53, 2);
    expect(roundSig(s.Teq, 3)).toBe(256);
    expect(toCelsius(s.Teq)).toBe(-17);
    expect(s.measuredT).toBe(288);
    expect(s.greenhouseK).toBeCloseTo(32.47, 2);
    expect(s.greenhouse).toBe('stor');
  });

  it('Mars: 211 K mot målt 210 K, nesten ingen drivhuseffekt', () => {
    const s = mars!.s;
    expect(roundSig(s.Teq, 3)).toBe(211);
    expect(toCelsius(s.Teq)).toBe(-62);
    expect(s.measuredT).toBe(210);
    expect(Math.abs(s.greenhouseK)).toBeLessThan(2);
    expect(s.greenhouse).toBe('nesten-ingen');
  });

  it('Venus: 228 K mot målt 737 K, enorm drivhuseffekt, selv om Venus tar opp mindre sollys enn jorda', () => {
    const s = venus!.s;
    expect(roundSig(s.Teq, 3)).toBe(228);
    expect(toCelsius(s.Teq)).toBe(-45);
    expect(s.measuredT).toBe(737);
    expect(s.greenhouseK).toBeCloseTo(509, 0);
    expect(s.greenhouse).toBe('enorm');
    expect(s.S).toBeGreaterThan(earth!.s.S);
    expect(s.absorbedAvg).toBeLessThan(earth!.s.absorbedAvg);
  });

  it('i likevekt stråler planeten ut like mye som den tar opp (inn = ut)', () => {
    for (const { task, s } of [earth!, mars!, venus!]) {
      const Rp = 6.4e6;
      const inn = (1 - task.albedo) * s.S * Math.PI * Rp ** 2;
      const ut = SIGMA * s.Teq ** 4 * 4 * Math.PI * Rp ** 2;
      expect(ut / inn).toBeCloseTo(1, 12);
    }
  });

  it('varmestrålingen fra planetene har toppen i infrarødt (10–15 µm)', () => {
    for (const { s } of [earth!, mars!, venus!]) {
      expect(s.lambdaPlanet).toBeGreaterThan(10e-6);
      expect(s.lambdaPlanet).toBeLessThan(15e-6);
      expect(s.lambdaPlanet).toBeCloseTo(WIEN_B / s.Teq, 15);
    }
  });

  it('drivhuseffekten deles inn i tre grupper', () => {
    expect(greenhouseKind(-1)).toBe('nesten-ingen');
    expect(greenhouseKind(9)).toBe('nesten-ingen');
    expect(greenhouseKind(33)).toBe('stor');
    expect(greenhouseKind(500)).toBe('enorm');
  });
});

/**
 * Hver linje i utregningen bruker tallene fra linja over slik de vises (fire gjeldende siffer). Eleven som regner
 * videre med de viste tallene, skal få det samme svaret som står i linja, med samme antall siffer.
 */
describe('utregningen går opp med de viste tallene i alle tallsettene', () => {
  const r4 = (v: number) => roundSig(v, 4);

  for (const { task, s } of [earth!, mars!, venus!]) {
    it(`${task.name}`, () => {
      // b) I = σT⁴ (T vises eksakt: 5800 K)
      expect(r4(SIGMA * roundSig(s.T, 4) ** 4)).toBe(r4(s.I));
      // c) A = 4πR², P = I · A
      expect(r4(4 * Math.PI * task.R ** 2)).toBe(r4(s.Asun));
      // P vises med tre siffer i c) (svaret), og med fire siffer når vi regner videre i d)
      expect(roundSig(r4(s.I) * r4(s.Asun), 3)).toBe(roundSig(s.P, 3));
      // d) A = 4πr², S = P / A
      expect(r4(4 * Math.PI * task.r ** 2)).toBe(r4(s.Asphere));
      // S er svaret i d) og vises med tre siffer; i e) regner vi videre med fire
      expect(roundSig(r4(s.P) / r4(s.Asphere), 3)).toBe(roundSig(s.S, 3));
      // d) S = I · (R/r)² (tipset)
      expect(roundSig(r4(s.I) * r4(s.dilution), 3)).toBe(roundSig(s.S, 3));
      // e) (1 − α) · S / 4 og T = (… / σ)^(1/4)
      // (vises med tre siffer, så linja går opp med S med fire siffer)
      const r3 = (v: number) => roundSig(v, 3);
      expect(r3(((1 - task.albedo) * r4(s.S)) / 4)).toBe(r3(s.absorbedAvg));
      expect(r3((r3(s.absorbedAvg) / SIGMA) ** 0.25)).toBe(r3(s.Teq));
      // T i celsius og forskjellen fra den målte
      expect(roundSig(s.Teq, 3) - KELVIN_OFFSET).toBe(toCelsius(s.Teq));
      expect(Math.round(s.measuredT - roundSig(s.Teq, 3))).toBe(Math.round(s.greenhouseK));
    });
  }
});

describe('spekteret i grafen', () => {
  const s = earth!.s;

  it('toppen ligger ved λ_maks = 500 nm (Wiens lov med de samme konstantene)', () => {
    const pts = spectrumCurve(s.T, R_SUN, 1.5e11, 100, 2000, 1900);
    const peak = pts.reduce((a, b) => (b[1] > a[1] ? b : a));
    expect(peak[0]).toBeGreaterThan(495);
    expect(peak[0]).toBeLessThan(506);
  });

  it('toppen ved jorda er ca. 1,8 W/(m²·nm), som målt sollys over atmosfæren', () => {
    const peak = spectrumAt(500, s.T, R_SUN, 1.5e11);
    expect(peak).toBeGreaterThan(1.7);
    expect(peak).toBeLessThan(1.9);
    expect(spectrumYMax(peak)).toBe(2.5);
    expect(spectrumYMax(spectrumAt(500, s.T, R_SUN, 2.28e11))).toBe(1);
    expect(spectrumYMax(spectrumAt(500, s.T, R_SUN, 1.08e11))).toBe(5);
  });

  it('arealet under hele kurven er S (innenfor 0,6 %: Plancks lov med avrundede konstanter)', () => {
    for (const { task, s: o } of [earth!, mars!, venus!]) {
      const area = spectrumArea(o.T, task.R, task.r, 20, 200000, 40000);
      expect(Math.abs(area / o.S - 1)).toBeLessThan(0.006);
    }
  });

  it('grafen fra 0 til 2500 nm viser over 95 % av arealet', () => {
    const area = spectrumArea(s.T, R_SUN, 1.5e11, 20, 2500, 4000);
    expect(area / s.S).toBeGreaterThan(0.95);
  });

  it('Plancks lov gir 0 for ugyldige tall og ingen NaN', () => {
    expect(planckExitance(0, 5800)).toBe(0);
    expect(planckExitance(5e-7, 0)).toBe(0);
    expect(planckExitance(1e-9, 300)).toBe(0);
    expect(Number.isFinite(planckExitance(1e-3, 5800))).toBe(true);
    expect(spectrumYMax(0)).toBe(1);
  });
});

describe('tallformat', () => {
  it('standardform med desimalkomma og ekte minus', () => {
    expect(fmtStd(3.905920291822583e26, 3)).toBe('3,91 · 10²⁶');
    expect(fmtStd(3.905920291822583e26, 4)).toBe('3,906 · 10²⁶');
    expect(fmtStd(2.9e-3, 3)).toBe('2,90 · 10⁻³');
    expect(fmtStd(9.996e3, 3)).toBe('1,00 · 10⁴');
    expect(fmtStd(-1.5e-3, 2)).toBe('−1,5 · 10⁻³');
    expect(fmtStd(Number.NaN, 2)).toBe('–');
  });

  it('vanlige tall med gjeldende siffer', () => {
    expect(fmtSigPlain(255.53, 3)).toBe('256');
    expect(fmtSigPlain(241.7514, 4)).toBe('241,8');
    expect(fmtSigPlain(1381.44, 4)).toBe('1381');
    expect(fmtSigPlain(597.92, 4)).toBe('597,9');
    expect(fmtSigPlain(0.5, 2)).toBe('0,50');
  });
});
