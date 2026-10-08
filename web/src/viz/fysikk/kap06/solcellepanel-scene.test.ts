import { describe, expect, it } from 'vitest';
import { incidenceAngle } from './model-solcellepanel';
import {
  arcPath,
  beamPolygon,
  beamWidth,
  beamWindow,
  besideBeam,
  insideBeam,
  labelClear,
  segmentDistance,
  normalDirAngle,
  panelFace,
  polar,
  solcelleLayout,
  sunDirAngle,
  sunPosition,
  sunRay,
  towardSun,
} from './solcellepanel-scene';

const dot = (a: { x: number; y: number }, b: { x: number; y: number }) => a.x * b.x + a.y * b.y;

describe('panelet', () => {
  it('midtlinja er w lang, går gjennom midten og står vinkelrett på normalen', () => {
    for (const beta of [0, 15, 40, 75, 90]) {
      const p = panelFace(400, 300, 150, beta);
      const d = { x: p.e2.x - p.e1.x, y: p.e2.y - p.e1.y };
      expect(Math.hypot(d.x, d.y)).toBeCloseTo(150, 9);
      expect((p.e1.x + p.e2.x) / 2).toBeCloseTo(p.center.x, 9);
      expect((p.e1.y + p.e2.y) / 2).toBeCloseTo(p.center.y, 9);
      expect(dot(d, p.normal)).toBeCloseTo(0, 9);
      expect(Math.hypot(p.normal.x, p.normal.y)).toBeCloseTo(1, 9);
      // Normalen peker opp (mot himmelen) og ikke mot høyre
      expect(p.normal.y).toBeLessThanOrEqual(0);
      expect(p.normal.x).toBeLessThanOrEqual(0);
    }
  });

  it('stolpen er minst 0,55 · w og høyere når panelet står bratt, så panelet aldri treffer bakken', () => {
    for (const beta of [0, 30, 60, 90]) {
      const p = panelFace(400, 300, 150, beta);
      expect(p.postH).toBeGreaterThanOrEqual(0.55 * 150);
      expect(p.e1.y).toBeLessThan(300);
    }
  });
});

describe('sollyset', () => {
  it('lysbuntet er w · cos θ bredt, og vinduet står vinkelrett på strålene', () => {
    for (const h of [3, 30, 55]) {
      for (const beta of [0, 30, 60, 90]) {
        const theta = incidenceAngle(h, beta);
        expect(beamWidth(150, h, beta)).toBeCloseTo(150 * Math.cos((theta * Math.PI) / 180), 9);
        const p = panelFace(400, 300, 150, beta);
        const [a, b] = beamWindow(p.center, h, 150, beta, 100);
        expect(Math.hypot(b.x - a.x, b.y - a.y)).toBeCloseTo(150 * Math.cos((theta * Math.PI) / 180), 9);
        expect(dot({ x: b.x - a.x, y: b.y - a.y }, sunRay(h))).toBeCloseTo(0, 9);
        // Vinduet ligger mellom kantene av lysbuntet: endene ligger på strålene gjennom e1 og e2
        const cross = (o: { x: number; y: number }, q: { x: number; y: number }) => {
          const u = sunRay(h);
          return (q.x - o.x) * u.y - (q.y - o.y) * u.x;
        };
        const [w1, w2] = [a, b].sort((m, n) => Math.abs(cross(p.e1, m)) - Math.abs(cross(p.e1, n)));
        expect(cross(p.e1, w1!)).toBeCloseTo(0, 6);
        expect(cross(p.e2, w2!)).toBeCloseTo(0, 6);
      }
    }
  });

  it('lysbuntet går fra panelet bakover mot sola', () => {
    const p = panelFace(400, 300, 150, 40);
    const poly = beamPolygon(p.e1, p.e2, 30, 500);
    expect(poly).toHaveLength(4);
    expect(poly[2]!.x).toBeLessThan(p.e2.x);
    expect(poly[2]!.y).toBeLessThan(p.e2.y);
  });

  it('sola ligger på linja mot sola og innenfor figuren', () => {
    const c = { x: 470, y: 250 };
    for (const h of [0.5, 3, 7, 30, 55, 89]) {
      const sp = sunPosition(c, h, 46, 40);
      expect(sp.x).toBeGreaterThanOrEqual(46 - 1e-9);
      expect(sp.y).toBeGreaterThanOrEqual(40 - 1e-9);
      // På linja: (sp − c) er parallell med −sunRay
      const u = sunRay(h);
      expect((sp.x - c.x) * u.y - (sp.y - c.y) * u.x).toBeCloseTo(0, 6);
      expect(sp.x).toBeLessThanOrEqual(c.x);
    }
    const back = towardSun(c, 30, 100);
    expect(Math.hypot(back.x - c.x, back.y - c.y)).toBeCloseTo(100, 9);
  });
});

describe('vinkelbuene', () => {
  it('retningen mot sola og normalen gir θ og h', () => {
    for (const h of [5, 30, 55]) {
      for (const beta of [0, 40, 90]) {
        expect(Math.abs(normalDirAngle(beta) - sunDirAngle(h))).toBeCloseTo(incidenceAngle(h, beta), 9);
      }
      expect(sunDirAngle(h) - 180).toBe(h);
    }
    const s = polar({ x: 0, y: 0 }, 1, sunDirAngle(30));
    expect(s.x).toBeLessThan(0);
    expect(s.y).toBeLessThan(0);
  });

  it('buen går riktig vei og er tom for svært små vinkler', () => {
    expect(arcPath({ x: 0, y: 0 }, 50, 180, 210)).toContain(' 0 0 1 ');
    expect(arcPath({ x: 0, y: 0 }, 50, 230, 200)).toContain(' 0 0 0 ');
    expect(arcPath({ x: 0, y: 0 }, 50, 200, 200.2)).toBe('');
  });
});

describe('etiketten for θ', () => {
  it('punktet ved siden av lysbuntet er utenfor, og midten er innenfor', () => {
    for (const [h, beta] of [
      [53.5, 40],
      [53.5, 0],
      [6.7, 40],
      [6.7, 90],
      [30, 60],
    ] as const) {
      const c = { x: 400, y: 250 };
      expect(insideBeam(towardSun(c, h, 50), c, h, 150, beta)).toBe(true);
      const q = besideBeam(c, h, 150, beta, 10);
      expect(insideBeam(q, c, h, 150, beta)).toBe(false);
      expect(insideBeam(q, c, h, 150, beta, 12)).toBe(true);
      // På den siden der panelet stiger (oppover)
      expect(q.y).toBeLessThan(c.y);
    }
  });
});

describe('plass til etiketter', () => {
  it('avstanden til et linjestykke', () => {
    const a = { x: 0, y: 0 };
    const b = { x: 10, y: 0 };
    expect(segmentDistance({ x: 5, y: 3 }, a, b)).toBeCloseTo(3, 9);
    expect(segmentDistance({ x: -4, y: 3 }, a, b)).toBeCloseTo(5, 9);
    expect(segmentDistance({ x: 13, y: 4 }, a, b)).toBeCloseTo(5, 9);
    expect(segmentDistance({ x: 1, y: 1 }, a, a)).toBeCloseTo(Math.SQRT2, 9);
  });

  it('en tekst som krysser en strek, er ikke fri', () => {
    const seg: [{ x: number; y: number }, { x: number; y: number }] = [
      { x: 50, y: 0 },
      { x: 50, y: 100 },
    ];
    expect(labelClear(0, 100, 50, [seg], 10)).toBe(false);
    expect(labelClear(0, 30, 50, [seg], 10)).toBe(true);
    expect(labelClear(0, 45, 50, [seg], 10)).toBe(false);
  });
});

describe('plassen', () => {
  it('høyere figur på mobil, og sola får plass over horisonten', () => {
    const pc = solcelleLayout(1, 1);
    const mob = solcelleLayout(1.35, 1.15, 600);
    expect(mob.H).toBeGreaterThan(pc.H);
    for (const L of [pc, mob]) {
      expect(L.hz).toBeLessThan(L.gy);
      expect(L.gy).toBeLessThan(L.H);
      expect(L.px + L.pw / 2).toBeLessThan(L.hytteX + L.hytteW / 2);
      expect(L.px - L.pw / 2).toBeGreaterThan(0.25 * L.W);
      expect(L.hytteX + L.hytteW / 2).toBeLessThanOrEqual(L.W);
      // Midten av panelet er over horisonten, så selv lav vintersol står over landskapet
      for (const beta of [0, 45, 90]) expect(panelFace(L.px, L.gy, L.pw, beta).center.y).toBeLessThan(L.hz);
    }
  });
});
