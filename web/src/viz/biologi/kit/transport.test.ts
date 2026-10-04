import { describe, expect, it } from 'vitest';
import { countSides, crossingCounts, expectedSideA, planCrossings, sideAt, trackPosition, type CrossingGeometry } from './transport';

const geom: CrossingGeometry = {
  a: { x: 0, y: 0, w: 180, h: 200 },
  b: { x: 220, y: 0, w: 180, h: 200 },
  orientation: 'vertical',
  at: 200,
  thickness: 40,
  r: 6,
};

describe('partikler som krysser en membran', () => {
  it('er deterministisk og bevarer antallet partikler', () => {
    const spec = { n: [30, 10] as const, rates: [0.1, 0.1] as const, tMax: 60, seed: 4 };
    const a = planCrossings(spec);
    expect(planCrossings(spec)).toEqual(a);
    expect(a).toHaveLength(40);
    for (const t of [0, 5, 20, 60]) {
      const [nA, nB] = countSides(a, t);
      expect(nA + nB).toBe(40);
      // Netto kryssinger = endringen på side A
      const [ab, ba] = crossingCounts(a, t);
      expect(30 - ab + ba).toBe(nA);
    }
    expect(countSides(a, 0)).toEqual([30, 10]);
  });

  it('kryssingene veksler side og har minst én passasjetid mellom seg', () => {
    for (const tr of planCrossings({ n: [20, 20], rates: [0.5, 0.5], tMax: 40, seed: 2, transit: 0.6 })) {
      let s = tr.start;
      let last = -Infinity;
      for (const c of tr.crossings) {
        expect(c.to).toBe(s === 0 ? 1 : 0);
        expect(c.t - last).toBeGreaterThanOrEqual(0.6 - 1e-9);
        expect(c.t).toBeGreaterThanOrEqual(0.3);
        s = c.to;
        last = c.t;
      }
      expect(sideAt(tr, 1e9)).toBe(s);
    }
  });

  it('like rater: gjennomsnittet går mot like mange på hver side (diffusjon)', () => {
    const spec = { n: [80, 0] as const, rates: [0.05, 0.05] as const, tMax: 200 };
    expect(expectedSideA(spec, 0)).toBe(80);
    expect(expectedSideA(spec, 1e4)).toBeCloseTo(40, 9);
    // Snitt over mange frø ligger nær forventningen
    for (const t of [10, 30, 100]) {
      let sum = 0;
      const runs = 60;
      for (let seed = 1; seed <= runs; seed++) sum += countSides(planCrossings({ ...spec, seed }), t)[0];
      expect(Math.abs(sum / runs - expectedSideA(spec, t))).toBeLessThan(3);
    }
  });

  it('bare én retning åpen: alle havner på den siden (aktiv transport mot gradienten)', () => {
    const spec = { n: [10, 30] as const, rates: [0, 0.2] as const, tMax: 200, seed: 9, gates: 3 };
    const tracks = planCrossings(spec);
    expect(countSides(tracks, 200)).toEqual([40, 0]);
    expect(crossingCounts(tracks, 200)).toEqual([0, 30]);
    for (const tr of tracks) for (const c of tr.crossings) expect([0, 1, 2]).toContain(c.gate);
    expect(expectedSideA(spec, 1e4)).toBeCloseTo(40, 9);
  });

  it('posisjonene ligger i riktig rom, og passasjen går gjennom membranen', () => {
    const tracks = planCrossings({ n: [20, 20], rates: [0.08, 0.08], tMax: 60, seed: 5 });
    for (const tr of tracks)
      for (let t = 0; t <= 60; t += 0.37) {
        const p = trackPosition(tr, t, geom);
        expect(Number.isFinite(p.x) && Number.isFinite(p.y)).toBe(true);
        if (p.inMembrane) {
          expect(p.x).toBeGreaterThan(180 - 6 - 3);
          expect(p.x).toBeLessThan(220 + 6 + 3);
        } else {
          const box = p.side === 0 ? geom.a : geom.b;
          expect(p.x).toBeGreaterThanOrEqual(box.x + 6 - 1e-9);
          expect(p.x).toBeLessThanOrEqual(box.x + box.w - 6 + 1e-9);
          expect(p.y).toBeGreaterThanOrEqual(box.y + 6 - 1e-9);
          expect(p.y).toBeLessThanOrEqual(box.y + box.h - 6 + 1e-9);
          expect(p.side).toBe(sideAt(tr, t));
        }
      }
  });

  it('kryssinger gjennom porter skjer ved portene', () => {
    const tracks = planCrossings({ n: [15, 0], rates: [0.3, 0.3], tMax: 30, seed: 1, gates: 2 });
    const g = { ...geom, gates: [50, 150] };
    for (const tr of tracks)
      for (const c of tr.crossings) {
        const p = trackPosition(tr, c.t, g);
        expect(p.inMembrane).toBe(true);
        expect(p.y).toBe(c.gate === 0 ? 50 : 150);
        expect(p.x).toBeCloseTo(200, 6);
      }
  });

  it('gir samme bilde ved samme tid (kan spoles fram og tilbake)', () => {
    const [tr] = planCrossings({ n: [1, 0], rates: [0.2, 0.2], tMax: 50, seed: 3 });
    expect(trackPosition(tr!, 17.3, geom)).toEqual(trackPosition(tr!, 17.3, geom));
  });
});
