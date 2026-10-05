import { describe, expect, it } from 'vitest';
import { EGG_SIZE, dentDepth, eggAt, eggLowerY, eggPath, layerY, surfacePoints, surfaceY } from './impuls-form';

describe('egget og bulken i underlaget', () => {
  const k = 1500;
  const top = 200;

  it('egget har ekte mål i skalaen', () => {
    const e = eggAt(300, 250, k);
    expect(e.up + e.down).toBeCloseTo(EGG_SIZE.length * k, 9);
    expect(2 * e.w).toBeCloseTo(EGG_SIZE.width * k, 9);
    expect(e.mid + e.down).toBeCloseTo(250, 9);
    expect(eggLowerY(e, 300)).toBeCloseTo(250, 9);
    expect(eggLowerY(e, 300 + e.w + 1)).toBeNull();
    expect(eggPath(e)).not.toMatch(/NaN/);
  });

  it('uten egg (eller over overflaten) er underlaget flatt', () => {
    expect(surfaceY(100, { top, egg: null, spread: 50, shoulder: 0.6 })).toBe(top);
    const above = eggAt(300, top - 5, k);
    expect(dentDepth({ top, egg: above, spread: 50, shoulder: 0.6 })).toBe(0);
    expect(surfaceY(300, { top, egg: above, spread: 50, shoulder: 0.6 })).toBe(top);
  });

  it('overflaten følger undersiden av egget og er aldri over egget eller over toppen', () => {
    for (const sink of [3, 16, 60]) {
      const egg = eggAt(300, top + sink, k);
      const d = { top, egg, spread: 70, shoulder: 0.6 };
      expect(dentDepth(d)).toBeCloseTo(sink, 9);
      expect(surfaceY(300, d)).toBeCloseTo(top + sink, 9);
      for (let x = 100; x <= 500; x += 0.5) {
        const y = surfaceY(x, d);
        expect(y).toBeGreaterThanOrEqual(top);
        const lower = eggLowerY(egg, x);
        if (lower !== null) expect(y).toBeGreaterThanOrEqual(lower - 1e-9);
      }
      // Langt unna er overflaten tilbake på toppen
      expect(surfaceY(300 + 6 * 70, d)).toBeCloseTo(top, 3);
    }
  });

  it('punktene langs overflaten er sortert og uten NaN, og lagene bøyer seg mindre jo dypere de ligger', () => {
    const d = { top, egg: eggAt(300, top + 30, k), spread: 60, shoulder: 0.5 };
    const pts = surfacePoints(0, 820, d);
    expect(pts[0]![0]).toBe(0);
    expect(pts.at(-1)![0]).toBe(820);
    for (let i = 1; i < pts.length; i++) expect(pts[i]![0]).toBeGreaterThan(pts[i - 1]![0]);
    expect(pts.every(([x, y]) => Number.isFinite(x) && Number.isFinite(y))).toBe(true);
    const bottom = top + 80;
    expect(layerY(300, d, bottom, 0)).toBeCloseTo(top + 30, 9);
    expect(layerY(300, d, bottom, 1)).toBeCloseTo(bottom, 9);
    expect(layerY(300, d, bottom, 0.5) - (top + 40)).toBeCloseTo(15, 9);
  });
});
