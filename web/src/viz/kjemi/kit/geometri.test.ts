import { describe, expect, it } from 'vitest';
import { GEOMETRIES, angleOf, atomRadius, polar, trimSegment, vsepr, vseprGeometry } from './geometri';
import { placeParticles, seededRandom } from './random';
import { btbColor, mixColor, phColor, phenolphthaleinColor } from './colors';

const angleBetween = (a: number, b: number) => {
  const d = Math.abs((((a - b) % 360) + 540) % 360 - 180);
  return d;
};

describe('geometri', () => {
  it('polar og angleOf bruker y opp', () => {
    const p = polar(100, 100, 10, 90);
    expect(p.x).toBeCloseTo(100, 9);
    expect(p.y).toBeCloseTo(90, 9);
    expect(angleOf({ x: 0, y: 0 }, { x: 0, y: -5 })).toBeCloseTo(90, 9);
    expect(angleOf({ x: 0, y: 0 }, polar(0, 0, 3, 210))).toBeCloseTo(-150, 9);
  });

  it('atomradius følger grunnstoffet, og ioner får ioneradius', () => {
    expect(atomRadius('C')).toBe(24);
    expect(atomRadius('H')).toBeLessThan(atomRadius('O'));
    expect(atomRadius('O')).toBeLessThan(atomRadius('Cl'));
    expect(atomRadius('Na', { charge: 1 })).toBeLessThan(atomRadius('Na'));
    expect(atomRadius('Cl', { charge: -1 })).toBeGreaterThan(atomRadius('Cl'));
    expect(atomRadius('O', { charge: -1 })).toBe(atomRadius('O'));
    expect(atomRadius('C', { scale: 2 })).toBe(48);
    for (const s of ['H', 'Cs', 'F', 'U']) {
      expect(atomRadius(s)).toBeGreaterThanOrEqual(24 * 0.72 - 1e-9);
      expect(atomRadius(s)).toBeLessThanOrEqual(24 * 1.6 + 1e-9);
    }
  });

  it('bindingsstreken starter og slutter på kanten av kulene', () => {
    const s = trimSegment({ x: 0, y: 0 }, { x: 100, y: 0 }, 20, 10)!;
    expect(s).toEqual({ x1: 20, y1: 0, x2: 90, y2: 0 });
    const g = trimSegment({ x: 0, y: 0 }, { x: 100, y: 0 }, 20, 10, 5)!;
    expect([g.x1, g.x2]).toEqual([25, 85]);
    // Forskjøvet strek (dobbeltbinding) treffer sirkelen: x² + 6² = 20²
    const o = trimSegment({ x: 0, y: 0 }, { x: 100, y: 0 }, 20, 20, 0, 6)!;
    expect(Math.hypot(o.x1, o.y1)).toBeCloseTo(20, 9);
    expect(Math.hypot(o.x2 - 100, o.y2)).toBeCloseTo(20, 9);
    expect(trimSegment({ x: 0, y: 0 }, { x: 25, y: 0 }, 20, 10)).toBeNull();
    expect(trimSegment({ x: 0, y: 0 }, { x: 0, y: 0 }, 1, 1)).toBeNull();
  });

  it('VSEPR: form ut fra elektronpar, og riktige vinkler i papirplanet', () => {
    expect(vseprGeometry(2, 0)).toBe('linear');
    expect(vseprGeometry(4, 0)).toBe('tetrahedral');
    expect(vseprGeometry(3, 1)).toBe('trigonal-pyramidal');
    expect(vseprGeometry(2, 2)).toBe('bent');
    expect(vseprGeometry(5, 0)).toBeNull();
    expect(GEOMETRIES.bent.angle).toBe(104.5);
    expect(GEOMETRIES['trigonal-pyramidal'].angle).toBe(107);
    expect(GEOMETRIES.tetrahedral.angle).toBe(109.5);
    for (const [g, n, lp] of [
      ['linear', 2, 0],
      ['trigonal-planar', 3, 0],
      ['tetrahedral', 4, 0],
      ['trigonal-pyramidal', 3, 1],
      ['bent', 2, 2],
    ] as const) {
      const lay = vsepr(g, { x: 0, y: 0, bond: 50 });
      expect(lay.ligands).toHaveLength(n);
      expect(lay.lonePairs).toHaveLength(lp);
      const planar = lay.ligands.filter((l) => l.stereo === 'plane');
      for (const l of planar) expect(Math.hypot(l.x, l.y)).toBeCloseTo(50, 9);
    }
    // Vinkelen mellom bindingene i papirplanet er den ekte bindingsvinkelen
    const water = vsepr('bent', { x: 0, y: 0, bond: 60 });
    expect(angleBetween(water.ligands[0]!.angle, water.ligands[1]!.angle)).toBeCloseTo(104.5, 9);
    const methane = vsepr('tetrahedral', { x: 0, y: 0, bond: 60 });
    expect(angleBetween(methane.ligands[0]!.angle, methane.ligands[1]!.angle)).toBeCloseTo(109.5, 9);
    expect(methane.ligands.map((l) => l.stereo)).toEqual(['plane', 'plane', 'wedge', 'hash']);
    const co2 = vsepr('linear', { x: 0, y: 0, bond: 60 });
    expect(angleBetween(co2.ligands[0]!.angle, co2.ligands[1]!.angle)).toBeCloseTo(180, 9);
    const bf3 = vsepr('trigonal-planar', { x: 0, y: 0, bond: 60, rotate: 15 });
    expect(angleBetween(bf3.ligands[1]!.angle, bf3.ligands[2]!.angle)).toBeCloseTo(120, 9);
    // De frie parene i vann peker bort fra hydrogenatomene (oppover)
    for (const lp of water.lonePairs) expect(Math.sin((lp * Math.PI) / 180)).toBeGreaterThan(0.5);
  });
});

describe('partikler med fast frø', () => {
  const box = { x: 10, y: 20, w: 300, h: 160 };

  it('samme frø gir samme tall og samme plassering', () => {
    const a = seededRandom(42);
    const b = seededRandom(42);
    const xs = Array.from({ length: 5 }, a);
    expect(Array.from({ length: 5 }, b)).toEqual(xs);
    for (const x of xs) expect(x >= 0 && x < 1).toBe(true);
    expect(placeParticles(box, [{ n: 10, r: 8 }], 3)).toEqual(placeParticles(box, [{ n: 10, r: 8 }], 3));
    expect(placeParticles(box, [{ n: 10, r: 8 }], 3)).not.toEqual(placeParticles(box, [{ n: 10, r: 8 }], 4));
  });

  it('holder seg inne i boksen og overlapper ikke når det er plass', () => {
    const ps = placeParticles(box, [{ n: 12, r: 8 }, { n: 12, r: 11 }], 7);
    expect(ps).toHaveLength(24);
    expect(ps.filter((p) => p.group === 1)).toHaveLength(12);
    for (const p of ps) {
      expect(p.x - p.r).toBeGreaterThanOrEqual(box.x - 1e-9);
      expect(p.x + p.r).toBeLessThanOrEqual(box.x + box.w + 1e-9);
      expect(p.y - p.r).toBeGreaterThanOrEqual(box.y - 1e-9);
      expect(p.y + p.r).toBeLessThanOrEqual(box.y + box.h + 1e-9);
    }
    for (let i = 0; i < ps.length; i++)
      for (let j = i + 1; j < ps.length; j++) expect(Math.hypot(ps[i]!.x - ps[j]!.x, ps[i]!.y - ps[j]!.y)).toBeGreaterThanOrEqual(ps[i]!.r + ps[j]!.r);
  });

  it('tåler en for liten boks og null partikler', () => {
    expect(placeParticles({ x: 0, y: 0, w: 4, h: 4 }, [{ n: 3, r: 10 }], 1)).toHaveLength(3);
    expect(placeParticles(box, [{ n: 0, r: 5 }], 1)).toEqual([]);
  });
});

describe('indikatorfarger', () => {
  it('blander CSS-farger med color-mix', () => {
    expect(mixColor('var(--a)', 'var(--b)', 0)).toBe('var(--a)');
    expect(mixColor('var(--a)', 'var(--b)', 1)).toBe('var(--b)');
    expect(mixColor('var(--a)', 'var(--b)', 0.25)).toBe('color-mix(in srgb, var(--b) 25%, var(--a))');
  });

  it('bromtymolblått, fenolftalein og universalindikator', () => {
    expect(btbColor(3)).toBe('var(--kj-btb-acid)');
    expect(btbColor(7)).toBe('var(--kj-btb-neutral)');
    expect(btbColor(10)).toBe('var(--kj-btb-base)');
    expect(btbColor(6.4)).toMatch(/^color-mix/);
    expect(phenolphthaleinColor(7)).toBe('var(--kj-liquid)');
    expect(phenolphthaleinColor(12)).toBe('var(--kj-php-pink)');
    expect(phColor(1)).toBe('var(--kj-ph-1)');
    expect(phColor(7)).toBe('var(--kj-ph-7)');
    expect(phColor(0)).toBe('var(--kj-ph-1)');
    expect(phColor(14)).toBe('var(--kj-ph-13)');
    expect(phColor(8)).toBe('color-mix(in srgb, var(--kj-ph-9) 50%, var(--kj-ph-7))');
  });
});
