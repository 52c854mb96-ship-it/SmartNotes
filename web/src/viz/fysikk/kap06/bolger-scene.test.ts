import { describe, expect, it } from 'vitest';
import {
  ARM_REACH_PX,
  BENCH_M,
  COIL_M,
  PERSON_SIZE,
  PX_PER_M,
  ROPE_M,
  SLINKY_R_M,
  X0,
  X_END,
  X_MAX,
  coilDensity,
  coilPositions,
  compressionCenters,
  driverPoints,
  driverPose,
  homeAnchor,
  lambdaSpan,
  rarefactionCenters,
  speedScale,
} from './bolger-scene';
import { crestPositions, maxLongitudinalAmplitude, particleVelocity, waveDisplacement } from './model';

const FLOOR = 300;

describe('scenen: skala og proporsjoner', () => {
  it('eleven er 1,75 m og hele målebåndet (0–6 m) får plass i figuren', () => {
    expect(PERSON_SIZE / PX_PER_M).toBeCloseTo(1.75, 9);
    expect(X0 + X_MAX * PX_PER_M).toBeLessThanOrEqual(800);
    expect(X_END).toBeGreaterThan(X_MAX);
  });

  it('tauet holdes i skulderhøyde, så hånda rekker både toppen og bunnen med den største amplituden', () => {
    const p = driverPose({ x: X0, y: FLOOR - ROPE_M * PX_PER_M }, FLOOR, 'transversal');
    const shoulder = (FLOOR - p.shoulder.y) / PX_PER_M;
    expect(Math.abs(shoulder - ROPE_M)).toBeLessThan(0.05);
    // Med 0,5 m opp og ned og hånda 0,3 m foran skulderen er avstanden innenfor armlengden
    expect(Math.hypot(0.3, 0.5) * PX_PER_M).toBeLessThan(ARM_REACH_PX);
  });
});

describe('eleven som rister i tauet eller dytter i fjæra', () => {
  /** Hvor langt hånda som tegnes, er fra punktet den skal holde (px). */
  const handError = (hand: { x: number; y: number }, kind: 'transversal' | 'longitudinal') => {
    const p = driverPose(hand, FLOOR, kind);
    const pts = driverPoints(p, FLOOR, { hoyreHand: hand });
    return { err: Math.hypot(pts.hoyreHand.x - hand.x, pts.hoyreHand.y - hand.y), p, pts };
  };

  it('tauet: hånda holder enden av tauet gjennom hele perioden, for alle amplituder', () => {
    for (const A of [0.05, 0.3, 0.5])
      for (let ph = 0; ph < 1; ph += 0.02) {
        const hand = { x: X0, y: FLOOR - (ROPE_M + A * Math.sin(2 * Math.PI * ph)) * PX_PER_M };
        const { err, p, pts } = handError(hand, 'transversal');
        expect(err).toBeLessThan(0.5);
        // Eleven står stille (føttene flyttes ikke) og står bak enden av tauet
        expect(p.x).toBeCloseTo(homeAnchor('transversal', FLOOR), 6);
        expect(Math.max(pts.venstreFot.x, pts.hoyreFot.x)).toBeLessThan(X0);
      }
  });

  it('fjæra: hånda holder enden også med den største longitudinale amplituden, og føttene flyttes lite', () => {
    const y = FLOOR - (BENCH_M + SLINKY_R_M) * PX_PER_M;
    const home = homeAnchor('longitudinal', FLOOR);
    for (const lambda of [0.5, 1, 2, 3, 4]) {
      const A = maxLongitudinalAmplitude(lambda);
      for (let ph = 0; ph < 1; ph += 0.02) {
        const hand = { x: X0 + A * Math.sin(2 * Math.PI * ph) * PX_PER_M, y };
        const { err, p } = handError(hand, 'longitudinal');
        expect(err).toBeLessThan(0.5);
        expect(Math.abs(p.x - home) / PX_PER_M).toBeLessThan(0.2);
      }
    }
  });

  it('fjæra: med vanlige amplituder står føttene stille, og eleven lener seg fram når hånda går fram', () => {
    const y = FLOOR - (BENCH_M + SLINKY_R_M) * PX_PER_M;
    const home = homeAnchor('longitudinal', FLOOR);
    const back = driverPose({ x: X0 - 0.25 * PX_PER_M, y }, FLOOR, 'longitudinal');
    const mid = driverPose({ x: X0, y }, FLOOR, 'longitudinal');
    const fwd = driverPose({ x: X0 + 0.25 * PX_PER_M, y }, FLOOR, 'longitudinal');
    for (const p of [back, mid, fwd]) expect(p.x).toBeCloseTo(home, 6);
    expect(fwd.ledd.rygg!).toBeGreaterThan(mid.ledd.rygg!);
    expect(mid.ledd.rygg!).toBeGreaterThan(back.ledd.rygg!);
  });
});

describe('fjæra: vindingene', () => {
  it('i likevekt (A = 0) står vindingene med fast avstand fra hånda og ut av bildet', () => {
    const c = coilPositions(0.7, 0, 2, 0.5);
    expect(c[0]).toBe(0);
    for (let i = 1; i < c.length; i++) expect(c[i]! - c[i - 1]!).toBeCloseTo(COIL_M, 12);
    expect(c[c.length - 1]!).toBeGreaterThanOrEqual(X_END);
  });

  it('vindingene passerer aldri hverandre med den største amplituden, og hånda følger u(0, t)', () => {
    for (const lambda of [0.5, 2, 4]) {
      const A = maxLongitudinalAmplitude(lambda);
      for (const t of [0, 0.37, 1.2, 3.3]) {
        const c = coilPositions(t, A, lambda, 0.8);
        expect(c[0]).toBeCloseTo(waveDisplacement(0, t, A, lambda, 0.8), 12);
        for (let i = 1; i < c.length; i++) expect(c[i]!).toBeGreaterThan(c[i - 1]!);
      }
    }
  });

  it('fortetningene er der vindingene står tettest, fortynningene der de står glissest, λ fra hverandre', () => {
    const [A, lambda, f, t] = [0.25, 2, 0.5, 0.6];
    const comp = compressionCenters(t, lambda, f, 0, X_MAX);
    const rare = rarefactionCenters(t, lambda, f, 0, X_MAX);
    expect(comp.length).toBeGreaterThanOrEqual(2);
    expect(rare.length).toBeGreaterThanOrEqual(2);
    const dMax = 1 + (2 * Math.PI * A) / lambda;
    const dMin = 1 - (2 * Math.PI * A) / lambda;
    for (const x of comp) expect(coilDensity(x, t, A, lambda, f)).toBeCloseTo(dMax, 9);
    for (const x of rare) expect(coilDensity(x, t, A, lambda, f)).toBeCloseTo(dMin, 9);
    for (let i = 1; i < comp.length; i++) expect(Math.abs(comp[i]! - comp[i - 1]!)).toBeCloseTo(lambda, 9);
    // Tettheten stemmer med avstanden mellom nabovindingene
    const c = coilPositions(t, A, lambda, f);
    const near = (x: number) => {
      const i = Math.round(x / COIL_M);
      return (c[i + 1]! - c[i - 1]!) / (2 * COIL_M);
    };
    const x0 = comp.find((x) => x > 0.2)!;
    // Vindingen som er nærmest midten av fortetningen (målt i likevektsplassen x − u)
    const xe = x0 - waveDisplacement(x0, t, A, lambda, f);
    expect(1 / near(xe)).toBeGreaterThan(1.5);
  });

  it('fortetningen ligger der forskyvningen går fra positiv (bakfra) til negativ (forfra), og flytter seg med v', () => {
    const [A, lambda, f] = [0.2, 1.5, 0.8];
    const dt = 0.3;
    const c0 = compressionCenters(0, lambda, f, 1, 5)[0]!;
    expect(waveDisplacement(c0, 0, A, lambda, f)).toBeCloseTo(0, 9);
    expect(waveDisplacement(c0 - 0.05, 0, A, lambda, f)).toBeGreaterThan(0);
    expect(waveDisplacement(c0 + 0.05, 0, A, lambda, f)).toBeLessThan(0);
    const later = compressionCenters(dt, lambda, f, c0, c0 + lambda);
    expect(later[0]!).toBeCloseTo(c0 + lambda * f * dt, 9);
  });
});

describe('målene og fartspilene', () => {
  it('λ-målet har alltid plass i 0–6 m og står mellom to daler (tau) eller to fortetninger (fjær)', () => {
    for (const [lambda, f] of [
      [4, 0.25],
      [3.5, 0.5],
      [2, 0.5],
      [0.5, 2],
    ] as const) {
      for (let t = 0; t < 2 / f; t += 0.05) {
        for (const kind of ['transversal', 'longitudinal'] as const) {
          const p = lambdaSpan(kind, t, lambda, f);
          expect(p).toBeDefined();
          expect(p!).toBeGreaterThanOrEqual(-1e-9);
          expect(p! + lambda).toBeLessThanOrEqual(X_MAX + 1e-9);
        }
        const p = lambdaSpan('transversal', t, lambda, f)!;
        const y = waveDisplacement(p, t, 0.3, lambda, f);
        expect(Math.abs(Math.abs(y) - 0.3)).toBeLessThan(1e-9);
        expect(waveDisplacement(p + lambda, t, 0.3, lambda, f)).toBeCloseTo(y, 9);
      }
    }
    // Når en dal har plass, er det den som brukes
    const t = 0.4;
    const troughs = crestPositions(t + 1, 2, 0.5, 0, X_MAX).filter((x) => x + 2 <= X_MAX);
    expect(lambdaSpan('transversal', t, 2, 0.5)).toBeCloseTo(troughs[0]!, 9);
  });

  it('fartspilene har én skala: v og den største partikkelfarten får plass, og skalaen er den samme for begge', () => {
    for (const [A, lambda, f] of [
      [0.05, 4, 0.2],
      [0.3, 2, 0.5],
      [0.5, 0.5, 2],
      [0.5, 4, 2],
      [0.05, 0.5, 0.2],
    ] as const) {
      const v = lambda * f;
      const uMax = 2 * Math.PI * f * A;
      const k = speedScale(v, uMax);
      expect(k).toBeGreaterThanOrEqual(10);
      expect(k).toBeLessThanOrEqual(45);
      expect(v * k).toBeLessThanOrEqual(330);
      expect(uMax * k).toBeLessThanOrEqual(70);
      // Partikkelfarten er aldri større enn uMax
      for (const t of [0, 0.3, 1.1]) expect(Math.abs(particleVelocity(3, t, A, lambda, f))).toBeLessThanOrEqual(uMax + 1e-12);
    }
  });
});
