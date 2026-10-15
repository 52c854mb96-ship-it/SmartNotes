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

  it('lyset kommer fra øvre venstre også når krystallen vippes', () => {
    for (const vipp of [-40, 0, 40]) {
      const g = krystallGeometri('terning', { dreiing: 30, helning: 25, vipp })!;
      const synlige = g.flater.filter((f) => f.synlig);
      // Flaten som vender mest mot øvre venstre i bildet er den lyseste
      const retning = (f: (typeof synlige)[number]) => {
        const cx = f.punkter.reduce((s, q) => s + q[0], 0) / f.punkter.length;
        const cy = f.punkter.reduce((s, q) => s + q[1], 0) / f.punkter.length;
        return -cx - cy;
      };
      const mest = synlige.reduce((b, f) => (retning(f) > retning(b) ? f : b), synlige[0]!);
      expect(mest.lys).toBe(Math.max(...synlige.map((f) => f.lys)));
    }
  });

  it('romboederen ligger på en flate og ser ikke ut som en terning: flatene er skjeve romber', () => {
    const g = krystallGeometri('rombeeder')!;
    const synlige = g.flater.filter((f) => f.synlig);
    expect(synlige).toHaveLength(3);
    expect(synlige.find((f) => f.del === 'ende')!.lys).toBe(Math.max(...synlige.map((f) => f.lys)));
    const vinkler = synlige.flatMap((f) =>
      f.punkter.map((p, i) => {
        const a = f.punkter[(i + f.punkter.length - 1) % f.punkter.length]!;
        const c = f.punkter[(i + 1) % f.punkter.length]!;
        const v1 = [a[0] - p[0], a[1] - p[1]];
        const v2 = [c[0] - p[0], c[1] - p[1]];
        return (Math.acos((v1[0]! * v2[0]! + v1[1]! * v2[1]!) / Math.hypot(v1[0]!, v1[1]!) / Math.hypot(v2[0]!, v2[1]!)) * 180) / Math.PI;
      }),
    );
    expect(Math.min(...vinkler.map((v) => Math.abs(v - 90)))).toBeGreaterThan(15);
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

describe('steinproveGeometri: bruddflatene', () => {
  it('flatene dekker silhuetten uten å overlappe, med lyse og mørke flater', () => {
    const areal = (p: readonly (readonly [number, number])[]) => Math.abs(p.reduce((s, q, i) => s + q[0] * p[(i + 1) % p.length]![1] - p[(i + 1) % p.length]![0] * q[1], 0)) / 2;
    for (let seed = 1; seed <= 12; seed++) {
      const g = steinproveGeometri({ x: 0, y: 0, size: 200, seed })!;
      const sum = g.flater.reduce((s, f) => s + areal(f.punkter), 0);
      expect(sum / areal(g.omriss)).toBeGreaterThan(0.97);
      expect(sum / areal(g.omriss)).toBeLessThan(1.03);
      // Lys mot lyset og skygge bort fra det
      expect(Math.max(...g.flater.map((f) => f.lys))).toBeGreaterThan(0.6);
      expect(Math.min(...g.flater.map((f) => f.lys))).toBeLessThan(0.45);
    }
  });
  it('steinen ligger på en flat underside, ikke på et hjørne', () => {
    for (let seed = 1; seed <= 12; seed++) {
      const g = steinproveGeometri({ x: 0, y: 0, size: 200, seed })!;
      // Minst to hjørner i silhuetten ligger nær bunnen (y = 0), langt fra hverandre
      const bunn = g.omriss.filter(([, py]) => py > -0.12 * g.hoyde);
      const xs = bunn.map(([px]) => px);
      expect(Math.max(...xs) - Math.min(...xs)).toBeGreaterThan(0.25 * g.bredde);
    }
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
        if (form === 'kantet') {
          // Noen få, brede bruddflater (ikke mange små fasetter), og ryggene mellom dem
          expect(g.flater.length).toBeGreaterThanOrEqual(3);
          expect(g.flater.length).toBeLessThanOrEqual(12);
          expect(g.kanter.length).toBeGreaterThanOrEqual(2);
        } else {
          expect(g.flater).toHaveLength(0);
          expect(g.kanter).toHaveLength(0);
        }
      }
    }
  });
  it('er lik for samme frø og null for ugyldige tall', () => {
    expect(steinproveGeometri({ x: 0, y: 0, seed: 4 })).toEqual(steinproveGeometri({ x: 0, y: 0, seed: 4 }));
    expect(steinproveGeometri({ x: Number.NaN, y: 0 })).toBeNull();
    expect(steinproveGeometri({ x: 0, y: 0, size: 0 })).toBeNull();
  });
});
