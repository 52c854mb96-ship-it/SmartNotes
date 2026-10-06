import { describe, expect, it } from 'vitest';
import { alongPolyline, edgeNoise, hash01, peakAt, periodicNoise, periodicSteps, profile, shiftPath, smoothPolyline, wavePoints } from './bakgrunn-geo';
import { buildLandscape, type LandskapType } from './bakgrunn-landskap';
import { sceneRandom } from './core';

describe('bakgrunn: geometri', () => {
  it('periodisk støy og fjelltopper er like i begge ender (landskapet kan rulle sømløst)', () => {
    const noise = periodicNoise(sceneRandom(3), [
      [1, 2],
      [5, 1],
    ]);
    expect(noise(0)).toBeCloseTo(noise(1), 9);
    const w = 800;
    const p = { c: 790, hgt: 100, s: 200 };
    expect(peakAt(-4, w, p)).toBeCloseTo(peakAt(w - 4, w, p), 9);
    expect(peakAt(790, w, p)).toBeCloseTo(100, 6);
    expect(peakAt(200, w, p)).toBe(0);
  });

  it('profilen med marg går fra −margin til w + margin', () => {
    const pts = profile(100, 10, () => 5, 0, 3);
    expect(pts[0]![0]).toBeCloseTo(-3);
    expect(pts[pts.length - 1]![0]).toBeCloseTo(103);
    expect(pts.every((p) => p[1] === -5)).toBe(true);
  });

  it('sagtann for snøgrense gjentar seg med perioden', () => {
    const m = 10;
    const pts = periodicSteps(100, m, (i) => i * 1.5);
    expect(pts.length).toBe(m + 3);
    // x = −10 og x = 90 har samme verdi, og x = 0 og x = 100 likeså.
    expect(pts[0]![1]).toBe(pts[m]![1]);
    expect(pts[1]![1]).toBe(pts[m + 1]![1]);
    expect(pts[m + 1]![0]).toBeCloseTo(100);
  });

  it('bølgen flytter seg mot høyre når fasen øker', () => {
    const lam = 200;
    const crest = (phase: number) => {
      const pts = wavePoints(0, 400, 100, 10, lam, phase);
      let best = pts[0]!;
      for (const p of pts) if (p[1] < best[1] && p[0] < lam) best = p;
      return best[0];
    };
    expect(Math.abs(crest(0) - 50)).toBeLessThan(4);
    expect(crest(Math.PI / 2)).toBeGreaterThan(crest(0));
    // Uten bølge: rett linje, og ugyldige tall gir ikke NaN
    expect(wavePoints(0, 100, 50, 0, 100, 0)).toEqual([
      [0, 50],
      [100, 50],
    ]);
    expect(wavePoints(0, 100, 50, NaN, NaN, NaN).every((p) => Number.isFinite(p[1]))).toBe(true);
  });

  it('punkter langs en brutt linje tåler bratte partier og like punkter', () => {
    const pts = alongPolyline(
      [
        [0, 0],
        [0, 0],
        [100, 0],
        [100, 200],
        [300, 200],
      ],
      10,
      sceneRandom(1),
    );
    expect(pts.length).toBeGreaterThan(30);
    for (const p of pts) {
      expect(Number.isFinite(p.x) && Number.isFinite(p.y)).toBe(true);
      expect(Math.hypot(p.tx, p.ty)).toBeCloseTo(1, 6);
    }
    expect(pts.some((p) => p.tx === 0 && p.ty === 1)).toBe(true);
  });

  it('glatt kurve går gjennom punktene med retningen fra forrige til neste punkt, uten sløyfer', () => {
    const pts: [number, number][] = [
      [0, 112],
      [130, 116],
      [260, 150],
      [340, 186],
      [420, 222],
      [560, 268],
      [800, 286],
    ];
    const c = smoothPolyline(pts);
    expect(c.length).toBeGreaterThan(100);
    for (const p of pts) expect(c.some((q) => Math.hypot(q[0] - p[0], q[1] - p[1]) < 1e-6)).toBe(true);
    // x øker hele veien (en bakke fra venstre til høyre får ingen sløyfer)
    for (let i = 1; i < c.length; i++) expect(c[i]![0]).toBeGreaterThan(c[i - 1]![0]);
    // Retningen i (340, 186) er retningen fra (260, 150) til (420, 222)
    const i = c.findIndex((q) => Math.abs(q[0] - 340) < 1e-6);
    const dir = Math.atan2(c[i + 1]![1] - c[i - 1]![1], c[i + 1]![0] - c[i - 1]![0]);
    expect(dir).toBeCloseTo(Math.atan2(72, 160), 2);
    // Et kort stykke ved siden av et langt og like punkter gir ikke NaN eller sløyfer
    const odd = smoothPolyline([
      [0, 0],
      [400, 0],
      [402, 60],
      [402, 60],
      [800, 60],
    ]);
    for (const q of odd) expect(Number.isFinite(q[0]) && Number.isFinite(q[1])).toBe(true);
    expect(Math.min(...odd.map((q) => q[0]))).toBeGreaterThanOrEqual(-1);
    expect(Math.max(...odd.map((q) => q[0]))).toBeLessThanOrEqual(801);
    expect(smoothPolyline([[1, 2], [3, 4]])).toEqual([[1, 2], [3, 4]]);
  });

  it('hash og myk støy er faste og i [0, 1)', () => {
    expect(hash01(7, 3)).toBe(hash01(7, 3));
    expect(hash01(7, 3)).not.toBe(hash01(8, 3));
    for (let x = -50; x < 50; x += 3.7) {
      const v = edgeNoise(x, 10, 2);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('flytter bare absolutte M- og L-punkter', () => {
    expect(shiftPath('M1,2L-3.5,4Z', 10)).toBe('M11,2L6.5,4Z');
    expect(shiftPath('M0,0a2,2 0 1,1 4,0Z', 100)).toBe('M100,0a2,2 0 1,1 4,0Z');
  });
});

describe('bakgrunn: landskap', () => {
  const types: LandskapType[] = ['fjell', 'aaser', 'skog', 'by', 'kyst'];
  it.each(types)('%s: samme frø gir samme landskap, uten NaN, innenfor høyden', (type) => {
    const a = buildLandscape(type, 800, 140, 4);
    const b = buildLandscape(type, 800, 140, 4);
    expect(a.map((l) => l.d)).toEqual(b.map((l) => l.d));
    expect(a.length).toBeGreaterThanOrEqual(3);
    for (const l of a) {
      expect(l.d).not.toMatch(/NaN|Infinity/);
      for (const p of l.parts) expect(p.d).not.toMatch(/NaN|Infinity/);
      expect(l.top).toBeGreaterThanOrEqual(-140 * 1.05);
      expect(l.top).toBeLessThanOrEqual(0);
    }
  });

  it('tåler små og rare størrelser', () => {
    for (const type of types) {
      expect(buildLandscape(type, 0, 100, 1)).toEqual([]);
      for (const [w, h] of [
        [60, 20],
        [2000, 300],
        [400, 6],
      ] as const) {
        const layers = buildLandscape(type, w, h, 2);
        for (const l of layers) expect(l.d).not.toMatch(/NaN|Infinity/);
      }
    }
  });
});
