import { describe, expect, it } from 'vitest';
import {
  bacterialGrowth,
  countAfter,
  doublingTime,
  effectiveR,
  exponential,
  exponentialDerivs,
  finalSize,
  generationTime,
  generations,
  growthPhase,
  growthPhaseEnds,
  harvestRate,
  herdImmunityThreshold,
  logistic,
  logisticDerivs,
  logisticRate,
  lotkaVolterraEquilibrium,
  lotkaVolterraInvariant,
  msy,
  proportionalEquilibrium,
  quotaEquilibria,
  rateFromGenerationTime,
  requiredCoverage,
  rk4Step,
  sirStart,
  sirStats,
  solveHarvest,
  solveLotkaVolterra,
  solveOde,
  solveSir,
  timeToReach,
  valueAt,
  type BacterialGrowthParams,
} from './modeller';

describe('RK4 med fast steg', () => {
  it('ett steg er nøyaktig for polynomer av grad ≤ 4', () => {
    // y′ = 4t³ → y = t⁴
    const [y] = rk4Step((t) => [4 * t ** 3], 1, [1], 0.5);
    expect(y).toBeCloseTo(1.5 ** 4, 12);
  });

  it('treffer tMax nøyaktig og er deterministisk', () => {
    const a = solveOde(exponentialDerivs(0.3), [5], { tMax: 10, dt: 0.3 });
    const b = solveOde(exponentialDerivs(0.3), [5], { tMax: 10, dt: 0.3 });
    expect(a.t[a.t.length - 1]).toBeCloseTo(10, 12);
    expect(a.y).toEqual(b.y);
    // Like steg
    const h = a.t[1]! - a.t[0]!;
    a.t.forEach((t, i) => expect(t).toBeCloseTo(i * h, 10));
  });

  it('valueAt interpolerer og holder seg innenfor tidsrommet', () => {
    const sol = solveOde(() => [2], [1], { tMax: 4, dt: 1 });
    expect(valueAt(sol, 2.5)[0]).toBeCloseTo(6, 12);
    expect(valueAt(sol, -3)[0]).toBe(1);
    expect(valueAt(sol, 99)[0]).toBeCloseTo(9, 12);
  });
});

describe('eksponentiell og logistisk vekst', () => {
  it('RK4 stemmer med den analytiske løsningen', () => {
    const sol = solveOde(exponentialDerivs(0.4), [100], { tMax: 10, dt: 0.05 });
    for (const t of [1, 3.3, 10]) expect(valueAt(sol, t)[0]! / exponential(100, 0.4, t)).toBeCloseTo(1, 6);
    expect(doublingTime(0.4)).toBeCloseTo(Math.LN2 / 0.4, 12);
    expect(exponential(100, 0.4, doublingTime(0.4))).toBeCloseTo(200, 9);
  });

  it('logistisk: analytisk løsning, K/2 i vendepunktet og N → K', () => {
    const r = 0.8;
    const K = 1000;
    const sol = solveOde(logisticDerivs(r, K), [10], { tMax: 30, dt: 0.05 });
    for (const t of [2, 5.5, 8, 30]) expect(valueAt(sol, t)[0]).toBeCloseTo(logistic(10, r, K, t), 4);
    expect(logistic(10, r, K, 200)).toBeCloseTo(K, 6);
    // Vendepunktet (størst tilvekst) er ved N = K/2, der tilveksten er rK/4
    const tHalf = Math.log((K - 10) / 10) / r;
    expect(logistic(10, r, K, tHalf)).toBeCloseTo(K / 2, 9);
    expect(logisticRate(K / 2, r, K)).toBeCloseTo((r * K) / 4, 12);
    expect(logisticRate(K / 2, r, K)).toBeGreaterThan(logisticRate(0.4 * K, r, K));
    expect(logisticRate(K, r, K)).toBe(0);
  });

  it('en bestand over bæreevnen synker mot K', () => {
    expect(logistic(1500, 0.5, 1000, 0)).toBeCloseTo(1500, 9);
    expect(logistic(1500, 0.5, 1000, 40)).toBeCloseTo(1000, 3);
  });
});

describe('høsting og maksimalt bærekraftig utbytte', () => {
  const r = 0.5;
  const K = 1000;

  it('MSY er rK/4 ved N = K/2 (andel h = r/2)', () => {
    expect(msy(r, K)).toEqual({ N: 500, yield: 125, rate: 0.25 });
    const best = proportionalEquilibrium(r, K, r / 2);
    expect(best.N).toBeCloseTo(500, 12);
    expect(best.yield).toBeCloseTo(125, 12);
    // Både mindre og større andel gir mindre utbytte
    for (const h of [0.1, 0.2, 0.3, 0.4]) expect(proportionalEquilibrium(r, K, h).yield).toBeLessThan(best.yield);
    expect(proportionalEquilibrium(r, K, 0.6)).toEqual({ N: 0, yield: 0 });
  });

  it('fast andel: bestanden går mot K(1 − h/r)', () => {
    const sol = solveHarvest(800, r, K, { kind: 'andel', h: 0.2 }, { tMax: 120, dt: 0.1 });
    expect(valueAt(sol, 120)[0]).toBeCloseTo(K * (1 - 0.2 / r), 3);
  });

  it('fast kvote: to likevekter under MSY, ingen over', () => {
    const [low, high] = quotaEquilibria(r, K, 100);
    expect(low! + high!).toBeCloseTo(K, 9);
    expect(logisticRate(low!, r, K)).toBeCloseTo(100, 9);
    expect(logisticRate(high!, r, K)).toBeCloseTo(100, 9);
    expect(quotaEquilibria(r, K, 125)).toEqual([500]);
    expect(quotaEquilibria(r, K, 126)).toEqual([]);
  });

  it('fast kvote: over den ustabile likevekten går bestanden mot den stabile, under den dør den ut', () => {
    const [low, high] = quotaEquilibria(r, K, 100);
    const above = solveHarvest(low! + 30, r, K, { kind: 'kvote', H: 100 }, { tMax: 150, dt: 0.05 });
    expect(valueAt(above, 150)[0]).toBeCloseTo(high!, 1);
    const below = solveHarvest(low! - 30, r, K, { kind: 'kvote', H: 100 }, { tMax: 150, dt: 0.05 });
    expect(valueAt(below, 150)[0]).toBe(0);
    // Kvote over MSY: bestanden dør ut selv fra K
    const over = solveHarvest(K, r, K, { kind: 'kvote', H: 140 }, { tMax: 200, dt: 0.05 });
    expect(valueAt(over, 200)[0]).toBe(0);
    expect(over.y.every(([N]) => N! >= 0)).toBe(true);
  });

  it('ingen fangst fra en bestand som er borte', () => {
    expect(harvestRate(0, { kind: 'kvote', H: 50 })).toBe(0);
    expect(harvestRate(200, { kind: 'kvote', H: 50 })).toBe(50);
    expect(harvestRate(200, { kind: 'andel', h: 0.1 })).toBeCloseTo(20, 12);
    expect(harvestRate(200, { kind: 'ingen' })).toBe(0);
  });
});

describe('rovdyr og byttedyr (Lotka–Volterra)', () => {
  const p = { a: 1, b: 0.1, c: 1.5, d: 0.075 };

  it('likevektspunktet står stille', () => {
    const eq = lotkaVolterraEquilibrium(p);
    expect(eq).toEqual({ prey: 20, predators: 10 });
    const sol = solveLotkaVolterra(p, eq.prey, eq.predators, { tMax: 20, dt: 0.01 });
    expect(valueAt(sol, 20)[0]).toBeCloseTo(20, 9);
    expect(valueAt(sol, 20)[1]).toBeCloseTo(10, 9);
  });

  it('den bevarte størrelsen er konstant, og bestandene svinger', () => {
    const sol = solveLotkaVolterra(p, 40, 9, { tMax: 30, dt: 0.005 });
    const v0 = lotkaVolterraInvariant(p, 40, 9);
    for (const [B, R] of sol.y) expect(lotkaVolterraInvariant(p, B!, R!)).toBeCloseTo(v0, 6);
    const prey = sol.y.map(([B]) => B!);
    expect(Math.max(...prey)).toBeGreaterThan(40);
    expect(Math.min(...prey)).toBeLessThan(20);
  });
});

describe('SIR-modellen og flokkimmunitet', () => {
  it('S + I + R + V = 1 hele tida', () => {
    const s = solveSir({ R0: 3, D: 7, p: 0.3, e: 0.9 }, { tMax: 300, dt: 0.25 });
    s.t.forEach((_, i) => expect(s.S[i]! + s.I[i]! + s.R[i]! + s.V).toBeCloseTo(1, 9));
    expect(s.V).toBeCloseTo(0.27, 12);
  });

  it('flokkimmunitetsgrensen p_c = 1 − 1/R₀', () => {
    expect(herdImmunityThreshold(2)).toBeCloseTo(0.5, 12);
    expect(herdImmunityThreshold(15)).toBeCloseTo(14 / 15, 12);
    expect(herdImmunityThreshold(1)).toBe(0);
    expect(herdImmunityThreshold(0.7)).toBe(0);
    expect(requiredCoverage(15, 0.97)).toBeCloseTo(14 / 15 / 0.97, 12);
    expect(requiredCoverage(15, 0.9)).toBeGreaterThan(1);
    expect(effectiveR(4, 0.25)).toBe(1);
  });

  it('R₀ ≤ 1 gir ingen epidemi: antallet smittede bare synker', () => {
    for (const R0 of [0.6, 1]) {
      const s = solveSir({ R0, D: 7, I0: 0.01 }, { tMax: 200, dt: 0.25 });
      for (let i = 1; i < s.I.length; i++) expect(s.I[i]!).toBeLessThanOrEqual(s.I[i - 1]! + 1e-15);
      expect(sirStats(s).peak).toBeCloseTo(0.01, 12);
      expect(finalSize(R0)).toBe(0);
    }
  });

  it('vaksinasjonsdekning over p_c gir intet utbrudd, under p_c gir utbrudd', () => {
    const R0 = 4;
    const pc = herdImmunityThreshold(R0);
    const over = solveSir({ R0, D: 7, p: pc + 0.05 }, { tMax: 600, dt: 0.25 });
    for (let i = 1; i < over.I.length; i++) expect(over.I[i]!).toBeLessThan(over.I[i - 1]!);
    // Noen få smittes likevel før smitten dør ut: til sammen ca. I₀ / (1 − R) = 0,001 / 0,2
    expect(sirStats(over).totalInfected).toBeCloseTo(0.001 / (1 - effectiveR(R0, sirStart({ p: pc + 0.05 }).S)), 3);
    expect(sirStats(over).totalInfected).toBeLessThan(0.006);
    const under = solveSir({ R0, D: 7, p: pc - 0.15 }, { tMax: 400, dt: 0.25 });
    expect(sirStats(under).peak).toBeGreaterThan(0.01);
    // Med en vaksine som ikke virker på alle trengs høyere dekning
    const weak = solveSir({ R0, D: 7, p: pc + 0.01, e: 0.8 }, { tMax: 400, dt: 0.25 });
    expect(sirStats(weak).peak).toBeGreaterThan(0.001);
  });

  it('sluttstørrelsen stemmer med kjente verdier og med simuleringen', () => {
    // Klassisk: R₀ = 2 gir ca. 79,7 % smittet
    expect(finalSize(2)).toBeCloseTo(0.7968, 4);
    const z = finalSize(2);
    expect(Math.log(1 / (1 - z))).toBeCloseTo(2 * z, 9);
    for (const [R0, p] of [
      [2, 0],
      [3, 0.3],
      [15, 0.8],
    ] as const) {
      const s = solveSir({ R0, D: 7, I0: 1e-6, p }, { tMax: 2000, dt: 0.1 });
      const S0 = sirStart({ I0: 1e-6, p }).S;
      expect(sirStats(s).totalInfected).toBeCloseTo(finalSize(R0, S0), 3);
    }
  });

  it('toppen kommer når R = R₀ · S faller under 1', () => {
    const s = solveSir({ R0: 3, D: 7 }, { tMax: 300, dt: 0.02 });
    const { peakTime } = sirStats(s);
    const i = s.t.findIndex((t) => t >= peakTime);
    expect(Math.abs(effectiveR(3, s.S[i]!) - 1)).toBeLessThan(0.005);
  });
});

describe('bakterievekst og generasjonstid', () => {
  const p: BacterialGrowthParams = { N0: 1000, lag: 2, g: 0.5, Nmax: 1000 * 2 ** 10, stationary: 3, deathHalfLife: 2 };

  it('fasene kommer i riktig rekkefølge', () => {
    const e = growthPhaseEnds(p);
    expect(e).toEqual({ lag: 2, log: 7, stationary: 10 });
    expect(growthPhase(p, 1)).toBe('lag');
    expect(growthPhase(p, 3)).toBe('log');
    expect(growthPhase(p, 8)).toBe('stasjonaer');
    expect(growthPhase(p, 11)).toBe('dod');
  });

  it('antallet er sammenhengende og følger N₀ · 2^(t/g) i den eksponentielle fasen', () => {
    expect(bacterialGrowth(p, 0)).toBe(1000);
    expect(bacterialGrowth(p, 2)).toBe(1000);
    expect(bacterialGrowth(p, 3)).toBeCloseTo(4000, 9);
    expect(bacterialGrowth(p, 7)).toBeCloseTo(p.Nmax, 6);
    expect(bacterialGrowth(p, 9)).toBe(p.Nmax);
    expect(bacterialGrowth(p, 12)).toBeCloseTo(p.Nmax / 2, 6);
    for (const t of [2, 7, 10]) expect(bacterialGrowth(p, t + 1e-9) / bacterialGrowth(p, t - 1e-9)).toBeCloseTo(1, 6);
  });

  it('generasjonstid: lærebokeksempel med E. coli (g = 20 min)', () => {
    // Én bakterie med generasjonstid 20 min blir 2²¹ ≈ 2,1 millioner på 7 timer
    expect(countAfter(1, 7 * 60, 20)).toBe(2 ** 21);
    expect(generations(7 * 60, 20)).toBe(21);
    expect(generationTime(1, 2 ** 21, 420)).toBeCloseTo(20, 12);
    expect(timeToReach(100, 800, 20)).toBeCloseTo(60, 12);
    expect(exponential(1, rateFromGenerationTime(20), 60)).toBeCloseTo(8, 12);
  });
});
