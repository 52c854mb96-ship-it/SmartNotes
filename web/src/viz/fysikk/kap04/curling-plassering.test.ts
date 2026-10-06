import { describe, expect, it } from 'vitest';
import { placeTagPair, spreadLabels, textWidthEm } from './curling-plassering';

describe('textWidthEm', () => {
  it('er litt over målt bredde i DejaVu Sans Bold (den bredeste skrifta)', () => {
    // Målt i Chromium: «v₁′ = 1,50 m/s» 7,71 em, «0123456789» 6,96 em, «Σp er bevart» 6,96 em.
    expect(textWidthEm('v₁′ = 1,50 m/s')).toBeGreaterThan(7.71);
    expect(textWidthEm('v₁′ = 1,50 m/s')).toBeLessThan(7.71 * 1.1);
    expect(textWidthEm('0123456789')).toBeGreaterThanOrEqual(6.96);
    expect(textWidthEm('Σp er bevart')).toBeGreaterThan(6.5);
    expect(textWidthEm('')).toBe(0);
  });
});

describe('placeTagPair', () => {
  const W = 800;
  const inside = (left: number, w: number) => left >= 6 - 1e-9 && left + w <= W - 6 + 1e-9;

  it('står rett over punktene når det er plass', () => {
    const r = placeTagPair({ x: 200, w: 140 }, { x: 500, w: 140 }, W, 10, 12);
    expect(r.a).toEqual({ left: 130, row: 0 });
    expect(r.b).toEqual({ left: 430, row: 0 });
  });

  it('skyves fra hverandre når punktene er nær, med spissen fortsatt under skiltet', () => {
    const a = { x: 370, w: 140 };
    const b = { x: 435, w: 140 };
    const r = placeTagPair(a, b, W, 10, 12);
    expect(r.a.row).toBe(0);
    expect(r.b.row).toBe(0);
    expect(r.a.left + a.w + 10).toBeLessThanOrEqual(r.b.left + 1e-9);
    expect(a.x).toBeGreaterThanOrEqual(r.a.left + 12 - 1e-9);
    expect(a.x).toBeLessThanOrEqual(r.a.left + a.w - 12 + 1e-9);
    expect(b.x).toBeGreaterThanOrEqual(r.b.left + 12 - 1e-9);
    expect(b.x).toBeLessThanOrEqual(r.b.left + b.w - 12 + 1e-9);
  });

  it('flytter bare den ene når den andre står mot kanten', () => {
    const a = { x: 20, w: 140 };
    const b = { x: 200, w: 140 };
    const r = placeTagPair(a, b, W, 10, 12);
    expect(r.a.left).toBeCloseTo(6, 9);
    expect(r.b.row).toBe(0);
    expect(r.a.left + a.w + 10).toBeLessThanOrEqual(r.b.left + 1e-9);
    expect(b.x).toBeGreaterThanOrEqual(r.b.left + 12 - 1e-9);
  });

  it('setter b på raden over når skiltene ikke får plass ved siden av hverandre', () => {
    const a = { x: 240, w: 250 };
    const b = { x: 300, w: 250 };
    const r = placeTagPair(a, b, 520, 10, 12);
    expect(r.a.row).toBe(0);
    expect(r.b.row).toBe(1);
    expect(inside(r.a.left, a.w) && r.b.left + b.w <= 514 + 1e-9).toBe(true);
  });

  it('holder alt innenfor figuren for mange plasseringer', () => {
    for (let xa = 0; xa <= W; xa += 40)
      for (let d = 30; d <= 400; d += 37) {
        const a = { x: xa, w: 150 };
        const b = { x: xa + d, w: 170 };
        const r = placeTagPair(a, b, W, 10, 12);
        expect(inside(r.a.left, a.w)).toBe(true);
        expect(r.b.left).toBeGreaterThanOrEqual(6 - 1e-9);
        expect(r.b.left + b.w).toBeLessThanOrEqual(W - 6 + 1e-9);
        if (r.b.row === 0) expect(r.a.left + a.w + 10).toBeLessThanOrEqual(r.b.left + 1e-9);
      }
  });
});

describe('spreadLabels', () => {
  it('står midt under segmentene når det er plass', () => {
    expect(spreadLabels([{ x: 100, w: 40 }, { x: 300, w: 60 }], 0, 500, 10)).toEqual([80, 270]);
  });

  it('skyves fra hverandre uten å overlappe, og holdes innenfor', () => {
    const items = [
      { x: 102, w: 40 },
      { x: 110, w: 60 },
      { x: 490, w: 80 },
    ];
    const l = spreadLabels(items, 100, 500, 10);
    expect(l[0]).toBeGreaterThanOrEqual(100);
    expect(l[0]! + 40 + 10).toBeLessThanOrEqual(l[1]! + 1e-9);
    expect(l[1]! + 60 + 10).toBeLessThanOrEqual(l[2]! + 1e-9);
    expect(l[2]! + 80).toBeLessThanOrEqual(500 + 1e-9);
  });

  it('stables fra venstre når det ikke er plass til alle', () => {
    const l = spreadLabels(
      [
        { x: 10, w: 100 },
        { x: 20, w: 100 },
      ],
      0,
      150,
      10,
    );
    expect(l).toEqual([0, 110]);
    expect(spreadLabels([], 0, 10, 2)).toEqual([]);
  });
});
