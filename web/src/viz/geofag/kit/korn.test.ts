import { describe, expect, it } from 'vitest';
import {
  RUNDHETSKLASSER,
  fmtMm,
  kornOmriss,
  kornSti,
  kornpakningGeometri,
  pakkKorn,
  polygonAreal,
  porositetEtterSortering,
  porositetIUtsnitt,
  punktIPolygon,
  rundhetVerdi,
  rundhetsklasse,
  voronoiCeller,
} from './korn';

describe('rundhet', () => {
  it('har seks klasser fra svært kantet til godt rundet', () => {
    expect(RUNDHETSKLASSER.map((k) => k.verdi)).toEqual([0, 0.2, 0.4, 0.6, 0.8, 1]);
    expect(rundhetVerdi('kantet')).toBe(0.2);
    expect(rundhetVerdi(1.7)).toBe(1);
    expect(rundhetVerdi(Number.NaN)).toBe(0.6);
    expect(rundhetsklasse(0.75)?.id).toBe('rundet');
    expect(rundhetsklasse(Number.NaN)).toBeNull();
  });
});

describe('kornOmriss', () => {
  it('ligger innenfor enhetssirkelen og er likt for samme frø', () => {
    for (const rundhet of [0, 0.5, 1]) {
      for (let seed = 1; seed < 20; seed++) {
        const o = kornOmriss({ rundhet, seed, avlang: 0.4 });
        for (const [x, y] of o.kontur) expect(Math.hypot(x, y)).toBeLessThanOrEqual(1 + 1e-9);
        expect(o.hjorner.length).toBeGreaterThanOrEqual(6);
        expect(o.spisser.length).toBe(o.hjorner.length);
      }
    }
    expect(kornOmriss({ seed: 4 })).toEqual(kornOmriss({ seed: 4 }));
  });

  it('runde korn fyller mer av sirkelen enn kantete', () => {
    let rund = 0;
    let kantet = 0;
    for (let seed = 1; seed <= 30; seed++) {
      rund += polygonAreal(kornOmriss({ rundhet: 1, seed }).kontur);
      kantet += polygonAreal(kornOmriss({ rundhet: 0, seed }).kontur);
    }
    expect(rund / 30).toBeGreaterThan(0.6 * Math.PI * 0.8);
    expect(kantet).toBeLessThan(rund * 1.2);
  });

  it('kornSti gir en lukket sti og tom streng for ugyldige tall', () => {
    expect(kornSti(10, 10, 5, { seed: 2 })).toMatch(/^M.*Z$/);
    expect(kornSti(Number.NaN, 10, 5)).toBe('');
    expect(kornSti(10, 10, 0)).toBe('');
  });
});

describe('polygoner', () => {
  const kvadrat = [
    [0, 0],
    [2, 0],
    [2, 2],
    [0, 2],
  ] as const;
  it('punktIPolygon og polygonAreal', () => {
    expect(punktIPolygon(1, 1, kvadrat)).toBe(true);
    expect(punktIPolygon(3, 1, kvadrat)).toBe(false);
    expect(polygonAreal(kvadrat)).toBe(4);
  });

  it('voronoiCeller deler boksen uten hull', () => {
    const pts: [number, number][] = [];
    for (let i = 0; i < 25; i++) pts.push([((i * 37) % 100) + 0.5, ((i * 61) % 100) + 0.25]);
    const celler = voronoiCeller(pts, { x0: 0, y0: 0, x1: 100, y1: 100 });
    const sum = celler.reduce((s, c) => s + polygonAreal(c), 0);
    expect(sum).toBeCloseTo(10000, 3);
    celler.forEach((c, i) => expect(punktIPolygon(pts[i]![0], pts[i]![1], c)).toBe(true));
  });
});

describe('pakkKorn', () => {
  it('er lik for samme frø og gir tom liste for ugyldige mål', () => {
    const a = pakkKorn({ w: 200, h: 200, r: 14, seed: 3 });
    expect(a).toEqual(pakkKorn({ w: 200, h: 200, r: 14, seed: 3 }));
    expect(a.length).toBeGreaterThan(20);
    expect(pakkKorn({ w: 0, h: 200, r: 14 })).toEqual([]);
    expect(pakkKorn({ w: 200, h: 200, r: Number.NaN })).toEqual([]);
    for (const k of a) expect([k.x, k.y, k.r].every(Number.isFinite)).toBe(true);
  });

  it('kornene overlapper nesten ikke (finstoffet ligger mellom kornomrissene)', () => {
    const korn = pakkKorn({ w: 240, h: 240, r: 15, seed: 5, sortering: 1 }).filter((k) => k.r >= 0.25 * 15 - 1e-9);
    let verst = 0;
    for (let i = 0; i < korn.length; i++)
      for (let j = i + 1; j < korn.length; j++) {
        const a = korn[i]!;
        const b = korn[j]!;
        verst = Math.max(verst, (a.r + b.r - Math.hypot(a.x - b.x, a.y - b.y)) / Math.min(a.r, b.r));
      }
    expect(verst).toBeLessThan(0.06);
  });

  it('tett pakking: porøsiteten ligger der sand ligger, og dårlig sortert har mindre porerom', () => {
    const utsnitt = { x: 130, y: 130, r: 120 };
    const snitt = (sortering: number) => {
      let sum = 0;
      for (let seed = 1; seed <= 3; seed++) sum += porositetIUtsnitt(pakkKorn({ w: 260, h: 260, r: 16, sortering, seed, rundhet: 0.6 }), utsnitt, 0.6, 40)!;
      return sum / 3;
    };
    const god = snitt(0.35);
    const moderat = snitt(1);
    const darlig = snitt(2);
    expect(god).toBeGreaterThan(0.25);
    expect(god).toBeLessThan(0.45);
    expect(moderat).toBeLessThan(god - 0.015);
    expect(darlig).toBeLessThan(moderat);
  });
});

describe('porositetEtterSortering', () => {
  it('faller fra ca. 42 % til ca. 28 % (Beard og Weyl 1973)', () => {
    expect(porositetEtterSortering(0)).toBeCloseTo(0.424, 3);
    expect(porositetEtterSortering(5)).toBeCloseTo(0.279, 3);
    expect(porositetEtterSortering(1)!).toBeLessThan(porositetEtterSortering(0.5)!);
    expect(porositetEtterSortering(-1)).toBeNull();
    expect(porositetEtterSortering(Number.NaN)).toBeNull();
  });
});

describe('porositetIUtsnitt', () => {
  it('er 1 uten korn og null for ugyldig utsnitt', () => {
    expect(porositetIUtsnitt([], { x: 0, y: 0, r: 10 })).toBe(1);
    expect(porositetIUtsnitt([], { x: 0, y: 0, r: 0 })).toBeNull();
    expect(porositetIUtsnitt([], { x: 0, y: 0, w: 10, h: Number.NaN })).toBeNull();
  });
});

describe('kornpakningGeometri', () => {
  it('gir korn i figurens koordinater rundt utsnittet', () => {
    const g = kornpakningGeometri({ x: 300, y: 200, r: 100, seed: 2 })!;
    expect(g.korn.length).toBeGreaterThan(10);
    for (const k of g.korn) expect(Math.hypot(k.x - 300, k.y - 200)).toBeLessThan(100 + k.r + 1e-9);
    expect(g.porositet).not.toBeNull();
    expect(kornpakningGeometri({ x: Number.NaN, y: 0 })).toBeNull();
    const rute = kornpakningGeometri({ x: 0, y: 0, w: 120, h: 80, korn: 6 })!;
    expect('w' in rute.utsnitt).toBe(true);
  });

  it('kornene vokser med k (mobil)', () => {
    const a = kornpakningGeometri({ x: 0, y: 0, r: 100 }, 1)!;
    const b = kornpakningGeometri({ x: 0, y: 0, r: 100 }, 1.5)!;
    expect(b.kornRadius).toBeCloseTo(1.5 * a.kornRadius, 9);
  });
});

describe('fmtMm', () => {
  it('skriver passe mange desimaler', () => {
    expect(fmtMm(25)).toBe('25');
    expect(fmtMm(2.5)).toBe('2,5');
    expect(fmtMm(0.153)).toBe('0,15');
    expect(fmtMm(0.0123)).toBe('0,012');
    expect(fmtMm(0)).toBe('–');
    expect(fmtMm(Number.NaN)).toBe('–');
  });
});
