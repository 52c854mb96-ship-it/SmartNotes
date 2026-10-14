import { describe, expect, it } from 'vitest';
import { BERGART_IDS } from './bergarter';
import { punktIPolygon } from './korn';
import { MINERAL_IDS, MINERAL_TONER } from './mineraler';
import { KRYSTALLFORMER, KRYSTALLFORM_NAVN, konveksInnhylling, krystallGeometri, lupeKjegle, mineralFarge, prikkerIPolygon, steinproveGeometri } from './stein';

describe('mineralFarge', () => {
  it('har farge for hver tone og hvert mineral', () => {
    for (const t of MINERAL_TONER) {
      const c = mineralFarge(t);
      expect(c.fill).toMatch(/var\(--sc-/);
      expect(c.line).toMatch(/var\(--sc-/);
    }
    for (const id of MINERAL_IDS) expect(mineralFarge(id).fill).toBeTruthy();
    expect(mineralFarge('pyritt').metall).toBe(true);
    expect(mineralFarge('kvarts').gjennomsiktig).toBe(true);
  });
});

describe('konveksInnhylling', () => {
  it('gir hjørnene i et kvadrat med et punkt inni', () => {
    const h = konveksInnhylling([
      [0, 0],
      [2, 0],
      [1, 1],
      [2, 2],
      [0, 2],
    ]);
    expect(h).toHaveLength(4);
    expect(h.some(([x, y]) => x === 1 && y === 1)).toBe(false);
  });
});

describe('krystallGeometri', () => {
  it('alle formene har navn, synlige flater og største mål 1', () => {
    for (const form of KRYSTALLFORMER) {
      expect(KRYSTALLFORM_NAVN[form]).toBeTruthy();
      const g = krystallGeometri(form)!;
      expect(g).not.toBeNull();
      expect(Math.max(g.bredde, g.hoyde)).toBeCloseTo(1, 9);
      const synlige = g.flater.filter((f) => f.synlig);
      expect(synlige.length).toBeGreaterThanOrEqual(form === 'terning' ? 3 : 2);
      for (const f of g.flater) {
        for (const [x, y] of f.punkter) {
          expect(Number.isFinite(x) && Number.isFinite(y)).toBe(true);
          expect(Math.abs(x)).toBeLessThanOrEqual(0.5 + 1e-9);
          expect(Math.abs(y)).toBeLessThanOrEqual(0.5 + 1e-9);
        }
        expect(f.lys).toBeGreaterThanOrEqual(-1 - 1e-9);
        expect(f.lys).toBeLessThanOrEqual(1 + 1e-9);
      }
      // De bakre flatene tegnes først
      const forsteSynlige = g.flater.findIndex((f) => f.synlig);
      expect(g.flater.slice(forsteSynlige).every((f) => f.synlig)).toBe(true);
      expect(punktIPolygon(0, 0, g.omriss)).toBe(true);
    }
  });

  it('terningen viser tre flater, og flaten mot lyset er lysest', () => {
    const g = krystallGeometri('terning', { dreiing: 30, helning: 25 })!;
    const synlige = g.flater.filter((f) => f.synlig);
    expect(synlige).toHaveLength(3);
    const topp = synlige.find((f) => f.del === 'ende')!;
    expect(topp.lys).toBeGreaterThan(Math.min(...synlige.map((f) => f.lys)));
  });

  it('kvarts har vannrette striper på prismeflatene, zirkon spiss i begge ender', () => {
    const kvarts = krystallGeometri('prisme', { sider: 6 })!;
    expect(kvarts.flater.filter((f) => f.del === 'side' && f.striper.length > 0).length).toBeGreaterThan(0);
    const zirkon = krystallGeometri('prisme', { sider: 4, dobbel: true })!;
    expect(zirkon.flater.filter((f) => f.del === 'spiss')).toHaveLength(8);
    expect(krystallGeometri('prisme', { dreiing: Number.NaN })).not.toBeNull();
  });
});

describe('prikkerIPolygon', () => {
  const kvadrat = [
    [0, 0],
    [100, 0],
    [100, 100],
    [0, 100],
  ] as const;
  it('gir faste punkter inne i polygonet med avstand mellom', () => {
    const p = prikkerIPolygon(kvadrat, 20, 10, 3);
    expect(p).toHaveLength(20);
    expect(p).toEqual(prikkerIPolygon(kvadrat, 20, 10, 3));
    for (const [x, y] of p) expect(punktIPolygon(x, y, kvadrat)).toBe(true);
    for (let i = 0; i < p.length; i++) for (let j = i + 1; j < p.length; j++) expect(Math.hypot(p[i]![0] - p[j]![0], p[i]![1] - p[j]![1])).toBeGreaterThan(5);
  });
  it('tåler ugyldige tall', () => {
    expect(prikkerIPolygon(kvadrat, Number.NaN, 10)).toEqual([]);
    expect(prikkerIPolygon(kvadrat, 5, 0)).toEqual([]);
    expect(prikkerIPolygon([], 5, 10)).toEqual([]);
  });
});

describe('lupeKjegle', () => {
  it('strekene tangerer begge sirklene', () => {
    const fra = { x: 100, y: 200, r: 10 };
    const lupe = { x: 400, y: 120, r: 80 };
    const k = lupeKjegle(fra, lupe)!;
    expect(k).not.toBeNull();
    for (const [a, b] of k) {
      const avstand = (p: { x: number; y: number }) => Math.abs((b[0] - a[0]) * (a[1] - p.y) - (a[0] - p.x) * (b[1] - a[1])) / Math.hypot(b[0] - a[0], b[1] - a[1]);
      expect(avstand(fra)).toBeCloseTo(fra.r, 6);
      expect(avstand(lupe)).toBeCloseTo(lupe.r, 6);
    }
  });
  it('gir null når den ene sirkelen ligger inni den andre', () => {
    expect(lupeKjegle({ x: 0, y: 0, r: 5 }, { x: 10, y: 0, r: 80 })).toBeNull();
    expect(lupeKjegle({ x: Number.NaN, y: 0, r: 5 }, { x: 10, y: 0, r: 8 })).toBeNull();
  });
});

describe('steinproveGeometri', () => {
  it('ligger på underlaget med riktig bredde for alle bergartene', () => {
    for (const bergart of BERGART_IDS) {
      for (const form of ['kantet', 'rundslipt'] as const) {
        const g = steinproveGeometri({ x: 200, y: 300, size: 150, bergart, form, seed: 3 })!;
        expect(Math.max(...g.omriss.map((q) => q[1]))).toBeCloseTo(300, 6);
        expect(g.bredde).toBeGreaterThan(140);
        expect(g.bredde).toBeLessThan(151);
        expect(g.hoyde).toBeGreaterThan(30);
        expect(g.hoyde).toBeLessThan(150);
        expect(punktIPolygon(g.midt[0], g.midt[1], g.omriss)).toBe(true);
        if (form === 'kantet') expect(g.flater.length).toBeGreaterThan(3);
        else expect(g.flater).toHaveLength(0);
      }
    }
  });
  it('er lik for samme frø og null for ugyldige tall', () => {
    expect(steinproveGeometri({ x: 0, y: 0, seed: 4 })).toEqual(steinproveGeometri({ x: 0, y: 0, seed: 4 }));
    expect(steinproveGeometri({ x: Number.NaN, y: 0 })).toBeNull();
    expect(steinproveGeometri({ x: 0, y: 0, size: 0 })).toBeNull();
  });
});
