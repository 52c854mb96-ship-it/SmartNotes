import { describe, expect, it } from 'vitest';
import {
  POST_SPACING,
  WAVE_TASKS,
  X_GRID,
  crestsAt,
  decimalsFor,
  roundSig,
  simpleFraction,
  solveWaveTask,
  surfaceVelocity,
  surfaceY,
  type WaveTask,
} from './model-eks-bolge';

const onGrid = (x: number, step: number) => Math.abs(x / step - Math.round(x / step)) < 1e-9;

describe('tallsett 1: bølger fra en ferje', () => {
  const task = WAVE_TASKS[0]!;
  const s = solveWaveTask(task);
  it('gir fart, frekvens og periode', () => {
    expect(s.v).toBeCloseTo(3.333, 3);
    expect(s.vShown).toBe(3.3);
    expect(s.f).toBeCloseTo(0.4167, 4);
    expect(s.T).toBeCloseTo(2.4, 9);
  });
  it('toppene, dalene og P', () => {
    expect(s.crests0).toEqual([3, 11]);
    expect(s.crests1).toEqual([5, 13]);
    expect(s.troughs0).toEqual([7, 15]);
    expect(s.yP0).toBe(0);
    expect(s.yP1).toBeCloseTo(-0.4, 9);
    expect(s.direction).toBe('ned');
    expect(s.leftExtreme).toEqual({ kind: 'dal', x: 7 });
  });
  it('tiden til P er på en topp: 3/4 periode', () => {
    expect(s.crestLeftOfP).toBe(3);
    expect(s.d).toBe(6);
    expect(s.tCrest).toBeCloseTo(1.8, 9);
    expect(s.fraction).toEqual({ num: 3, den: 4 });
  });
});

describe('tallsett 2: dønninger', () => {
  const s = solveWaveTask(WAVE_TASKS[1]!);
  it('gir fart, frekvens og periode', () => {
    expect(s.v).toBeCloseTo(4.2857, 4);
    expect(s.vShown).toBe(4.3);
    expect(s.f).toBeCloseTo(0.3571, 4);
    expect(s.T).toBeCloseTo(2.8, 9);
  });
  it('P er under likevekt og på vei opp', () => {
    expect(s.yP0).toBeCloseTo(-0.25, 9);
    expect(s.direction).toBe('opp');
    expect(s.leftExtreme).toEqual({ kind: 'topp', x: 2 });
    expect(s.d).toBe(4);
    expect(s.tCrest).toBeCloseTo(0.9333, 4);
    expect(s.fraction).toEqual({ num: 1, den: 3 });
  });
});

describe('tallsett 3: motorbåt', () => {
  const s = solveWaveTask(WAVE_TASKS[2]!);
  it('gir fart, frekvens og periode', () => {
    expect(s.v).toBeCloseTo(2.857, 3);
    expect(s.vShown).toBe(2.9);
    expect(s.f).toBeCloseTo(0.4762, 4);
    expect(s.T).toBeCloseTo(2.1, 9);
  });
  it('P er under likevekt og på vei ned', () => {
    expect(s.yP0).toBeCloseTo(-0.125, 9);
    expect(s.direction).toBe('ned');
    expect(s.leftExtreme).toEqual({ kind: 'dal', x: 4 });
    expect(s.d).toBe(4);
    expect(s.tCrest).toBeCloseTo(1.4, 9);
    expect(s.fraction).toEqual({ num: 2, den: 3 });
  });
});

describe.each(WAVE_TASKS.map((task, i) => [i + 1, task] as [number, WaveTask]))('tallsett %i: fornuftig og entydig', (_, task) => {
  const s = solveWaveTask(task);

  it('v = λf og T = 1/f', () => {
    expect(s.v).toBeCloseTo(task.lambda * s.f, 12);
    expect(s.T * s.f).toBeCloseTo(1, 12);
    expect(s.v * s.T).toBeCloseTo(task.lambda, 12);
  });

  it('realistiske havbølger: 2–5 m/s, perioder 1,5–4 s, ikke for bratte', () => {
    expect(s.v).toBeGreaterThan(2);
    expect(s.v).toBeLessThan(5);
    expect(s.T).toBeGreaterThan(1.5);
    expect(s.T).toBeLessThan(4);
    // Bølgehøyden 2A er godt under 1/7 av bølgelengden (der bølgene bryter).
    expect((2 * task.A) / task.lambda).toBeLessThan(1 / 7);
    // Farten er under farten på dypt vann, √(gλ/2π) (grunnere vann gir lavere fart).
    expect(s.v).toBeLessThan(Math.sqrt((9.81 * task.lambda) / (2 * Math.PI)) * 1.05);
  });

  it('entydig å følge toppen: Δx under λ/2 og Δt under T/2', () => {
    expect(task.dx).toBeGreaterThan(0);
    expect(task.dx).toBeLessThan(task.lambda / 2);
    expect(task.dt).toBeLessThan(s.T / 2);
    // Toppen i bilde 2 som er nærmest til høyre for crest0, er den som har flyttet seg.
    expect(s.crests1.find((x) => x > task.crest0)).toBeCloseTo(s.crestMoved, 9);
  });

  it('toppene, dalene, P og flyttingen ligger på rutenettet', () => {
    for (const x of [...s.crests0, ...s.crests1, ...s.troughs0, task.xP, task.dx, task.lambda, s.d]) expect(onGrid(x, X_GRID)).toBe(true);
    expect(onGrid(task.A, task.yGrid)).toBe(true);
    expect(onGrid(task.yMax, task.yTick)).toBe(true);
    expect(onGrid(task.xMax, task.xTick)).toBe(true);
    expect(onGrid(task.lambda, POST_SPACING)).toBe(true);
  });

  it('grafen viser to hele bølgelengder og to topper i hvert bilde', () => {
    expect(task.xMax).toBeCloseTo(2 * task.lambda, 9);
    expect(s.crests0.length).toBe(2);
    expect(s.crests1.length).toBe(2);
    expect(s.lambdaTo).toBeLessThanOrEqual(task.xMax);
    expect(s.troughs0.length).toBe(2);
    expect(task.yMax).toBeGreaterThanOrEqual(1.5 * task.A);
  });

  it('toppene og dalene er ytterpunkter: y = ±A og ∂y/∂t = 0', () => {
    for (const x of s.crests0) {
      expect(surfaceY(task, x, 0)).toBeCloseTo(task.A, 12);
      expect(surfaceVelocity(task, x, 0)).toBeCloseTo(0, 9);
    }
    for (const x of s.crests1) expect(surfaceY(task, x, task.dt)).toBeCloseTo(task.A, 12);
    for (const x of s.troughs0) expect(surfaceY(task, x, 0)).toBeCloseTo(-task.A, 12);
  });

  it('P er ikke på en topp eller i en dal, så retningen er tydelig', () => {
    expect(Math.abs(s.yP0)).toBeLessThan(task.A * 0.9);
    expect(Math.abs(s.uP)).toBeGreaterThan(0.3 * ((2 * Math.PI * task.A) / s.T));
  });

  it('retningen stemmer med regelen ∂y/∂t = −v · ∂y/∂x og med en liten tid senere', () => {
    const h = 1e-5;
    const slope = (surfaceY(task, task.xP + h, 0) - surfaceY(task, task.xP - h, 0)) / (2 * h);
    expect(s.uP).toBeCloseTo(-s.v * slope, 6);
    const later = surfaceY(task, task.xP, 1e-3) - s.yP0;
    expect(Math.sign(later)).toBe(s.direction === 'opp' ? 1 : -1);
    // Et ytterpunkt til venstre: en topp betyr på vei opp, en dal på vei ned.
    expect(s.leftExtreme.kind === 'topp').toBe(s.direction === 'opp');
    expect(s.leftExtreme.x).toBeLessThan(task.xP);
    expect(task.xP - s.leftExtreme.x).toBeLessThan(task.lambda / 2 + 1e-9);
  });

  it('bilde 2 bekrefter retningen (P passerer ingen topp eller dal mellom bildene)', () => {
    expect(Math.sign(s.yP1 - s.yP0)).toBe(s.direction === 'opp' ? 1 : -1);
    const tTurn = (task.xP - s.leftExtreme.x) / s.v;
    expect(task.dt).toBeLessThanOrEqual(tTurn + 1e-9);
  });

  it('e) P er på en topp etter tCrest, og ikke før', () => {
    expect(surfaceY(task, task.xP, s.tCrest)).toBeCloseTo(task.A, 9);
    for (let i = 0; i < 200; i++) {
      const t = (s.tCrest * i) / 200;
      expect(surfaceY(task, task.xP, t)).toBeLessThan(task.A - 1e-6);
    }
    expect(s.tCrest).toBeGreaterThan(0);
    expect(s.tCrest).toBeLessThanOrEqual(s.T);
    expect(s.tCrest).toBeCloseTo((s.d / task.lambda) * s.T, 12);
    expect(s.fraction).not.toBeNull();
    // På vei ned: mer enn en halv periode til toppen. På vei opp: mindre enn en halv.
    if (s.direction === 'ned') expect(s.tCrest).toBeGreaterThan(s.T / 2);
    else expect(s.tCrest).toBeLessThan(s.T / 2);
  });
});

describe.each(WAVE_TASKS.map((task, i) => [i + 1, task] as [number, WaveTask]))('tallsett %i: linjene i utregningen går opp', (_, task) => {
  // Farten vises med fire gjeldende siffer og regnes videre med; mellomsvarene med tre, svarene med to.
  const s = solveWaveTask(task);
  const v4 = roundSig(s.v, 4);
  it('f = v / λ og T = 1 / f med de viste tallene', () => {
    expect(roundSig(v4 / task.lambda, 3)).toBe(roundSig(s.f, 3));
    expect(roundSig(1 / roundSig(s.f, 3), 3)).toBe(roundSig(s.T, 3));
    expect(roundSig(task.lambda / v4, 3)).toBe(roundSig(s.T, 3));
  });
  it('t = d / v og kontrollen med brøken av perioden', () => {
    expect(roundSig(s.d / v4, 3)).toBe(roundSig(s.tCrest, 3));
    const fr = s.fraction!;
    expect(roundSig((fr.num / fr.den) * roundSig(s.T, 3), 3)).toBe(roundSig(s.tCrest, 3));
  });
  it('«Vis at»-verdien er farten med to gjeldende siffer', () => {
    expect(Math.abs(s.vShown - s.v)).toBeLessThan(0.05 + 1e-9);
  });
});

describe('hjelpefunksjoner', () => {
  it('crestsAt finner toppene og dalene i intervallet', () => {
    const task = WAVE_TASKS[0]!;
    expect(crestsAt(task, 0, 0, 16)).toEqual([3, 11]);
    expect(crestsAt(task, 0, 0, 16, true)).toEqual([7, 15]);
    expect(crestsAt(task, 0.6, 0, 16)).toEqual([5, 13]);
    expect(crestsAt(task, 0, -10, 0)).toEqual([-5]);
    expect(crestsAt(task, 0, 4, 10)).toEqual([]);
  });
  it('simpleFraction', () => {
    expect(simpleFraction(0.75)).toEqual({ num: 3, den: 4 });
    expect(simpleFraction(1 / 3)).toEqual({ num: 1, den: 3 });
    expect(simpleFraction(2 / 3)).toEqual({ num: 2, den: 3 });
    expect(simpleFraction(1)).toEqual({ num: 1, den: 1 });
    expect(simpleFraction(Math.PI / 10)).toBeNull();
  });
  it('gjeldende siffer', () => {
    expect(decimalsFor(3.333, 3)).toBe(2);
    expect(decimalsFor(0.4167, 2)).toBe(2);
    expect(decimalsFor(12, 2)).toBe(0);
    expect(decimalsFor(0, 2)).toBe(1);
    expect(roundSig(3.3333, 2)).toBe(3.3);
    expect(roundSig(4.2857, 2)).toBe(4.3);
    expect(roundSig(0.41667, 2)).toBe(0.42);
    expect(roundSig(2.857, 2)).toBe(2.9);
  });
});
