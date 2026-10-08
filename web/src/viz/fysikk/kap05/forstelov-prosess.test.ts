import { describe, expect, it } from 'vitest';
import { AIR_HEAT_CAPACITY, AIR_MOL, R_GAS } from './model';
import {
  BORE_AREA,
  ENERGY_MAX,
  ENERGY_STEP,
  MAAL,
  PX_PER_J,
  PX_PER_M,
  P_START,
  T_START,
  V_MAX,
  V_MIN,
  V_START,
  cylinderAt,
  diagramRange,
  energyArrowLength,
  frostAmount,
  gasColumnHeight,
  gasWarmth,
  logRatio,
  particlePoint,
  plateEffect,
  processState,
  sceneLayout,
  spreadLabels,
} from './forstelov-prosess';

const nR = AIR_MOL * R_GAS;
const ALL: [number, number][] = [];
for (let W = -ENERGY_MAX; W <= ENERGY_MAX; W += ENERGY_STEP) for (let Q = -ENERGY_MAX; Q <= ENERGY_MAX; Q += ENERGY_STEP) ALL.push([W, Q]);

/** Arbeidet på gassen langs veien, regnet numerisk: −∫ p dV (trapesmetoden). */
function numericWork(W: number, Q: number, n = 4000): number {
  let sum = 0;
  let prev = processState(W, Q, 0);
  for (let i = 1; i <= n; i++) {
    const cur = processState(W, Q, i / n);
    sum -= 0.5 * (prev.p + cur.p) * (cur.V - prev.V);
    prev = cur;
  }
  return sum;
}

describe('starttilstanden', () => {
  it('1,0 mol luft ved 293 K og 101,3 kPa fyller 24,0 L', () => {
    expect(V_START * 1000).toBeCloseTo(24.04, 2);
    const s = processState(500, -200, 0);
    expect(s.T).toBe(T_START);
    expect(s.V).toBeCloseTo(V_START, 12);
    expect(s.p).toBeCloseTo(P_START, 6);
    expect(s.dU).toBe(0);
  });

  it('ln(1 + x)/x går mot 1 når x går mot 0, og stemmer med Math.log1p ellers', () => {
    expect(logRatio(0)).toBe(1);
    expect(logRatio(1e-8)).toBeCloseTo(1, 7);
    expect(logRatio(0.3)).toBeCloseTo(Math.log(1.3) / 0.3, 12);
    expect(logRatio(-0.3)).toBeCloseTo(Math.log(0.7) / -0.3, 12);
  });
});

describe('første lov langs prosessen', () => {
  it('ΔU = W + Q og ΔT = ΔU / C, også midt i prosessen', () => {
    const end = processState(500, -200);
    expect(end.dU).toBe(300);
    expect(end.T).toBeCloseTo(T_START + 300 / AIR_HEAT_CAPACITY, 9);
    const half = processState(500, -200, 0.5);
    expect(half.W).toBe(250);
    expect(half.Q).toBe(-100);
    expect(half.dU).toBe(150);
  });

  it('fast volum når W = 0: all varmen går til indre energi', () => {
    const s = processState(0, 600);
    expect(s.V).toBeCloseTo(V_START, 12);
    expect(s.p / P_START).toBeCloseTo(s.T / T_START, 9);
  });

  it('adiabatisk (Q = 0): T · V^0,4 er konstant for luft', () => {
    for (const W of [-1000, -600, 300, 600, 1000]) {
      const s = processState(W, 0);
      expect(s.T * s.V ** 0.4).toBeCloseTo(T_START * V_START ** 0.4, 6);
    }
    // Kompresjon med 600 J: lufta blir 28,9 K varmere og volumet går ned til ca. 19 L
    const c = processState(600, 0);
    expect(c.T - T_START).toBeCloseTo(28.88, 2);
    expect(c.V * 1000).toBeCloseTo(18.98, 1);
  });

  it('isoterm (ΔU = 0): V = V₀ · e^(−W/(nRT₀)) og pV er konstant', () => {
    for (const W of [-1000, -600, 600, 1000]) {
      const s = processState(W, -W);
      expect(s.T).toBe(T_START);
      expect(s.V).toBeCloseTo(V_START * Math.exp(-W / (nR * T_START)), 9);
      expect(s.p * s.V).toBeCloseTo(P_START * V_START, 6);
    }
  });

  it('arbeidet langs veien, −∫p dV, er lik W for alle tallsettene (energien er bevart)', () => {
    for (const [W, Q] of [
      [500, -200],
      [1000, 1000],
      [-1000, -1000],
      [-600, 600],
      [1000, -950],
      [-50, 1000],
    ] as const) {
      expect(numericWork(W, Q)).toBeCloseTo(W, 1);
    }
  });

  it('volumet endrer seg jevnt med s, og ingen ugyldige tall for alle verdiene på glidebryterne', () => {
    for (const [W, Q] of ALL) {
      let last = V_START;
      for (let i = 1; i <= 10; i++) {
        const s = processState(W, Q, i / 10);
        expect(Number.isFinite(s.V) && Number.isFinite(s.p) && Number.isFinite(s.T)).toBe(true);
        expect(s.T).toBeGreaterThan(190);
        expect(s.p).toBeGreaterThan(0);
        // Gassen presses sammen når W > 0 og utvider seg når W < 0
        if (W > 0) expect(s.V).toBeLessThanOrEqual(last + 1e-15);
        if (W < 0) expect(s.V).toBeGreaterThanOrEqual(last - 1e-15);
        last = s.V;
      }
    }
  });

  it('ytterpunktene: 16 L (sterk kompresjon med avkjøling) og 40 L (sterk utvidelse med avkjøling)', () => {
    expect(V_MIN * 1000).toBeCloseTo(processState(1000, -1000).V * 1000, 9);
    expect(V_MAX * 1000).toBeCloseTo(processState(-1000, -1000).V * 1000, 9);
    expect(V_MIN * 1000).toBeGreaterThan(15.5);
    expect(V_MAX * 1000).toBeLessThan(40.5);
  });
});

describe('scenen', () => {
  it('én skala: sylinderen har radius 18 cm, og 24,0 L gir en gass-søyle på 23,6 cm', () => {
    expect(BORE_AREA).toBeCloseTo(0.1018, 4);
    expect(gasColumnHeight(V_START)).toBeCloseTo(0.2361, 4);
    const g = cylinderAt(sceneLayout(false), V_START);
    expect(g.r).toBe(MAAL.boreR * PX_PER_M);
    expect(g.gasH).toBeCloseTo(0.2361 * PX_PER_M, 0);
    expect(g.flensTop - g.gasTop).toBeCloseTo(g.gasH, 9);
  });

  it('stempelet og stanga holder seg i figuren og i glasset for alle verdiene', () => {
    for (const narrow of [false, true]) {
      const layout = sceneLayout(narrow);
      for (const [W, Q] of ALL) {
        const g = cylinderAt(layout, processState(W, Q).V);
        expect(g.pistonTop).toBeGreaterThan(g.rimY);
        expect(g.gasH).toBeGreaterThan(70);
        expect(g.rodTop).toBeGreaterThan(layout.top + 20);
        expect(g.flensTop).toBeLessThan(layout.benchY);
      }
    }
  });

  it('energipilene: samme skala for W og Q, og den lengste pila (1 000 J) får plass over stempelet', () => {
    expect(energyArrowLength(-500)).toBe(500 * PX_PER_J);
    expect(energyArrowLength(Number.NaN)).toBe(0);
    for (const [W, Q] of ALL) {
      if (W >= 0) continue;
      const g = cylinderAt(sceneLayout(false), processState(W, Q).V);
      expect(g.pistonTop - energyArrowLength(W)).toBeGreaterThan(20);
    }
  });

  it('partiklene ligger inne i gassen', () => {
    const g = cylinderAt(sceneLayout(false), V_START);
    for (const [u, w] of [
      [0, 0],
      [1, 1],
      [0.5, 0.5],
      [1, 0],
    ] as const) {
      const p = particlePoint(g, 340, 6, u, w);
      expect(p.x).toBeGreaterThanOrEqual(340 - g.r);
      expect(p.x).toBeLessThanOrEqual(340 + g.r);
      expect(p.y).toBeLessThanOrEqual(g.flensTop + g.r * g.ellipse);
      expect(p.y).toBeGreaterThanOrEqual(g.gasTop);
    }
  });

  it('farge, rim og kokeplate følger temperaturen og varmen', () => {
    expect(gasWarmth(T_START)).toBe(0);
    expect(gasWarmth(400)).toBe(1);
    expect(gasWarmth(200)).toBe(-1);
    expect(frostAmount(293)).toBe(0);
    expect(frostAmount(200)).toBeGreaterThan(0.4);
    expect(plateEffect(0)).toBe(0);
    expect(plateEffect(-500)).toBe(0);
    expect(plateEffect(1000)).toBe(1);
    expect(plateEffect(50)).toBeGreaterThan(0.25);
  });

  it('etikettene skyves fra hverandre i samme rekkefølge og holder seg innenfor grensene', () => {
    expect(spreadLabels([100, 200, 300], 30)).toEqual([100, 200, 300]);
    expect(spreadLabels([100, 105, 110], 30)).toEqual([100, 130, 160]);
    const s = spreadLabels([380, 390, 400], 30, 0, 400);
    expect(s).toEqual([340, 370, 400]);
  });
});

describe('energidiagrammet', () => {
  it('aksen går i 500-steg og rommer alle søylene', () => {
    expect(diagramRange(0, 0)).toBe(500);
    expect(diagramRange(500, -200)).toBe(500);
    expect(diagramRange(600, 0)).toBe(1000);
    expect(diagramRange(1000, 1000)).toBe(2000);
    expect(diagramRange(-1000, 50)).toBe(1000);
    for (const [W, Q] of ALL) {
      const M = diagramRange(W, Q);
      expect(Math.max(Math.abs(W), Math.abs(Q), Math.abs(W + Q))).toBeLessThanOrEqual(M);
    }
  });
});
