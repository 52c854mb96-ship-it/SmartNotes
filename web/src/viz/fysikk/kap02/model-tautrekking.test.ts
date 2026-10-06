import { describe, expect, it } from 'vitest';
import { G_EARTH } from '../../kit/format';
import { FESTER, FESTE_MU, lagFor, leanAngle, tugPeaks, tugPlan, tugState, type Feste, type Lag } from './model-tautrekking';

const g = G_EARTH;

/** Numerisk derivasjon (sentral differanse). */
const deriv = (f: (t: number) => number, t: number, h = 1e-4) => (f(t + h) - f(t - h)) / (2 * h);

describe('friksjonstallene', () => {
  it('har μk ≤ μs, og gress gir best feste og is dårligst', () => {
    for (const f of FESTER) expect(FESTE_MU[f].muK).toBeLessThanOrEqual(FESTE_MU[f].muS);
    expect(FESTE_MU.gress.muS).toBeGreaterThan(FESTE_MU.sokker.muS);
    expect(FESTE_MU.sokker.muS).toBeGreaterThan(FESTE_MU.is.muS);
  });
});

describe('tugPlan: grensene og hvem som vinner', () => {
  it('regner ut N = mg, μs · N og μk · N', () => {
    const p = tugPlan(lagFor(120, 'gress'), lagFor(180, 'is'));
    expect(p.NA).toBeCloseTo(120 * g, 9);
    expect(p.NB).toBeCloseTo(180 * g, 9);
    expect(p.RmaxA).toBeCloseTo(0.6 * 120 * g, 9); // 706,3 N
    expect(p.RmaxB).toBeCloseTo(0.1 * 180 * g, 9); // 176,6 N
    expect(p.RkA).toBeCloseTo(0.45 * 120 * g, 9);
    expect(p.RkB).toBeCloseTo(0.05 * 180 * g, 9);
  });

  it('det letteste laget vinner når det har bedre feste (standardverdiene)', () => {
    const p = tugPlan(lagFor(120, 'gress'), lagFor(180, 'is'));
    expect(p.winner).toBe('A');
    expect(p.loser).toBe('B');
  });

  it('på samme underlag vinner det tyngste laget', () => {
    for (const f of FESTER) {
      expect(tugPlan(lagFor(150, f), lagFor(160, f)).winner).toBe('B');
      expect(tugPlan(lagFor(200, f), lagFor(90, f)).winner).toBe('A');
    }
  });

  it('er uavgjort når μs · m er like stort (også med ulike masser og underlag)', () => {
    const same = tugPlan(lagFor(150, 'gress'), lagFor(150, 'gress'));
    expect(same.winner).toBeNull();
    expect(same.tSlip).toBe(Infinity);
    // 0,6 · 100 = 0,25 · 240 = 60 og 0,25 · 80 = 0,1 · 200 = 20
    expect(tugPlan(lagFor(100, 'gress'), lagFor(240, 'sokker')).winner).toBeNull();
    expect(tugPlan(lagFor(80, 'sokker'), lagFor(200, 'is')).winner).toBeNull();
  });

  it('taperen glipper etter tRise, og vinneren når sin grense senere', () => {
    const p = tugPlan(lagFor(120, 'gress'), lagFor(180, 'is'), { tRise: 2 });
    expect(p.tSlip).toBe(2);
    expect(p.rate * p.tSlip).toBeCloseTo(p.RmaxB, 9);
    expect(p.rate * p.tFull).toBeCloseTo(p.RmaxA, 9);
    expect(p.tFull).toBeGreaterThan(p.tSlip);
    expect(p.tEnd).toBeGreaterThan(p.tSlip);
  });
});

describe('tugState: før noen glipper (Newtons 1. og 3. lov)', () => {
  const A = lagFor(120, 'gress');
  const B = lagFor(180, 'is');
  const p = tugPlan(A, B);

  it('står klar uten krefter ved t = 0', () => {
    const s = tugState(A, B, p, 0);
    expect(s.phase).toBe('klar');
    expect(s.S).toBe(0);
    expect(s.RA).toBe(0);
    expect(s.RB).toBe(0);
  });

  it('R_A = R_B = S, kraftsummene er null og ingen beveger seg', () => {
    for (const t of [0.3, 1, 1.6, 2.4, 2.5]) {
      const s = tugState(A, B, p, t);
      expect(s.phase).toBe('drar');
      expect(s.S).toBeCloseTo(p.rate * t, 9);
      expect(s.RA).toBe(s.S);
      expect(s.RB).toBe(s.S);
      expect(s.netA).toBe(0);
      expect(s.netB).toBe(0);
      expect(s.netSystem).toBe(0);
      expect(s.a).toBe(0);
      expect(s.v).toBe(0);
      expect(s.x).toBe(0);
      // Den statiske friksjonen er aldri større enn μs · N.
      expect(s.RA).toBeLessThanOrEqual(p.RmaxA + 1e-9);
      expect(s.RB).toBeLessThanOrEqual(p.RmaxB + 1e-9);
    }
  });
});

describe('tugState: når taperen glir (Newtons 2. lov)', () => {
  const A = lagFor(120, 'gress');
  const B = lagFor(180, 'is');
  const p = tugPlan(A, B);
  const M = A.m + B.m;

  it('taperen har glidefriksjon, vinneren statisk friksjon under grensen', () => {
    const s = tugState(A, B, p, p.tSlip + 0.5);
    expect(s.phase).toBe('glir');
    expect(s.slidingB).toBe(true);
    expect(s.slidingA).toBe(false);
    expect(s.RB).toBeCloseTo(p.RkB, 9);
    expect(s.RA).toBeCloseTo(p.rate * (p.tSlip + 0.5), 9);
    expect(s.RA).toBeLessThanOrEqual(p.RmaxA + 1e-9);
  });

  it('2. lov stemmer for hvert lag og for hele systemet, og S er indre kraft', () => {
    for (const dt of [0.01, 0.4, 1, 1.7]) {
      const s = tugState(A, B, p, p.tSlip + dt);
      // Systemet akselererer mot vinneren (lag A, mot venstre).
      expect(s.a).toBeLessThan(0);
      expect(s.netA).toBeCloseTo(A.m * s.a, 6);
      expect(s.netB).toBeCloseTo(B.m * s.a, 6);
      expect(s.netSystem).toBeCloseTo(M * s.a, 6);
      // Kraftsummen på systemet er bare de ytre kreftene: S forsvinner.
      expect(s.netA + s.netB).toBeCloseTo(s.netSystem, 9);
      expect(s.netSystem).toBeCloseTo(s.RB - s.RA, 9);
    }
  });

  it('snordraget er det samme sett fra begge lagene: S = R_L + m_L · a = R_W − m_W · a', () => {
    for (const dt of [0.2, 1.2]) {
      const s = tugState(A, B, p, p.tSlip + dt);
      const aMag = Math.abs(s.a);
      expect(s.S).toBeCloseTo(s.RB + B.m * aMag, 6);
      expect(s.S).toBeCloseTo(s.RA - A.m * aMag, 6);
    }
  });

  it('farten og strekningen henger sammen med akselerasjonen (v = dx/dt, a = dv/dt)', () => {
    const at = (t: number) => tugState(A, B, p, t);
    for (const t of [p.tSlip + 0.3, p.tSlip + 1.1, (p.tSlip + p.tEnd) / 2]) {
      expect(deriv((u) => at(u).x, t)).toBeCloseTo(at(t).v, 5);
      expect(deriv((u) => at(u).v, t)).toBeCloseTo(at(t).a, 4);
    }
  });

  it('slutter når taperen er dratt sEnd meter, og står stille i den tilstanden etterpå', () => {
    const end = tugState(A, B, p, p.tEnd);
    expect(end.phase).toBe('ferdig');
    expect(end.x).toBeCloseTo(-p.sEnd, 9);
    const later = tugState(A, B, p, p.tEnd + 5);
    expect(later.x).toBeCloseTo(end.x, 12);
    expect(later.t).toBe(p.tEnd);
  });

  it('er kontinuerlig i R_W, men S faller litt når taperen glipper (statisk → glidefriksjon)', () => {
    const before = tugState(A, B, p, p.tSlip);
    const after = tugState(A, B, p, p.tSlip + 1e-9);
    expect(after.RA).toBeCloseTo(before.RA, 6);
    expect(after.RB).toBeLessThan(before.RB);
    expect(after.S).toBeLessThan(before.S);
    expect(after.S).toBeGreaterThan(p.RkB);
  });

  it('lag B kan også vinne, og da går alt mot høyre', () => {
    const A2 = lagFor(200, 'sokker');
    const B2 = lagFor(100, 'gress');
    const p2 = tugPlan(A2, B2);
    expect(p2.winner).toBe('B');
    const s = tugState(A2, B2, p2, p2.tSlip + 0.8);
    expect(s.slidingA).toBe(true);
    expect(s.a).toBeGreaterThan(0);
    expect(s.v).toBeGreaterThan(0);
    expect(s.x).toBeGreaterThan(0);
    expect(s.RA).toBeCloseTo(p2.RkA, 9);
    expect(tugState(A2, B2, p2, p2.tEnd).x).toBeCloseTo(p2.sEnd, 9);
  });

  it('når vinneren presser så hardt den kan, blir akselerasjonen konstant', () => {
    // Stor forskjell i feste: vinneren når grensen sin lenge før slutten?
    const A3 = lagFor(240, 'gress');
    const B3 = lagFor(230, 'gress');
    const p3 = tugPlan(A3, B3);
    expect(p3.tFull).toBeLessThan(p3.tEnd);
    const s1 = tugState(A3, B3, p3, (p3.tFull + p3.tEnd) / 2);
    const s2 = tugState(A3, B3, p3, p3.tEnd);
    expect(s1.a).toBeCloseTo(s2.a, 9);
    expect(s1.RA).toBeCloseTo(p3.RmaxA, 9);
    expect(Math.abs(s1.a)).toBeCloseTo((p3.RmaxA - p3.RkB) / (A3.m + B3.m), 9);
  });
});

describe('uavgjort', () => {
  it('S stiger til den felles grensen og står der, uten bevegelse', () => {
    const A = lagFor(150, 'sokker');
    const B = lagFor(150, 'sokker');
    const p = tugPlan(A, B, { tRise: 2, tHold: 2 });
    expect(p.tEnd).toBe(4);
    expect(tugState(A, B, p, 1).phase).toBe('drar');
    const s = tugState(A, B, p, 3);
    expect(s.phase).toBe('uavgjort');
    expect(s.S).toBeCloseTo(p.RmaxA, 9);
    expect(s.RA).toBe(s.S);
    expect(s.RB).toBe(s.S);
    expect(s.a).toBe(0);
    expect(s.x).toBe(0);
  });
});

describe('alle kombinasjoner av glidebryterne gir fornuftige tall', () => {
  const masses = [60, 65, 100, 150, 175, 240];
  it('ingen NaN, R ≤ μs · N, S ≥ 0, og slutten nås innen rimelig tid', () => {
    for (const fa of FESTER as Feste[])
      for (const fb of FESTER as Feste[])
        for (const mA of masses)
          for (const mB of masses) {
            const A: Lag = lagFor(mA, fa);
            const B: Lag = lagFor(mB, fb);
            const p = tugPlan(A, B);
            expect(Number.isFinite(p.tEnd)).toBe(true);
            expect(p.tEnd).toBeLessThan(10);
            const peak = tugPeaks(A, B, p);
            for (const t of [0, 0.5, p.tSlip, p.tSlip + 0.3, (p.tSlip + p.tEnd) / 2, p.tEnd]) {
              if (!Number.isFinite(t)) continue;
              const s = tugState(A, B, p, t);
              for (const v of [s.S, s.RA, s.RB, s.a, s.v, s.x, s.netA, s.netB]) expect(Number.isFinite(v)).toBe(true);
              expect(s.S).toBeGreaterThanOrEqual(0);
              expect(s.RA).toBeLessThanOrEqual(p.RmaxA * (1 + 1e-9) + 1e-9);
              expect(s.RB).toBeLessThanOrEqual(p.RmaxB * (1 + 1e-9) + 1e-9);
              expect(Math.abs(s.x)).toBeLessThanOrEqual(p.sEnd + 1e-9);
              expect(s.S).toBeLessThanOrEqual(peak.S + 1e-9);
              expect(Math.max(s.RA, s.RB)).toBeLessThanOrEqual(peak.R + 1e-9);
              expect(s.RA + s.RB).toBeLessThanOrEqual(peak.Rsum + 1e-9);
            }
          }
  });
});

describe('leanAngle', () => {
  it('er null uten drag og ca. 31° på gress og 6° på is ved største friksjon', () => {
    expect(leanAngle(0, 1000)).toBe(0);
    expect(leanAngle(0.6 * 1000, 1000)).toBeCloseTo(30.96, 1);
    expect(leanAngle(0.1 * 1000, 1000)).toBeCloseTo(5.71, 1);
    expect(leanAngle(100, 0)).toBe(0);
  });
});
