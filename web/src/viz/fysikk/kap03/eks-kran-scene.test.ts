import { describe, expect, it } from 'vitest';
import {
  CRANE,
  FACADE_X,
  HOOK,
  LIFT_X,
  LOAD_DIMS,
  STEP_COUNT,
  craneLayout,
  craneTop,
  figureSpec,
  hookHeights,
  jibBottom,
  loadBottom,
  loadSpan,
  lupeArrows,
  lupeMap,
  outerTangents,
  type Spot,
} from './eks-kran-scene';
import { CRANE_TASKS } from './model-eks-kran';

const SCALES = [
  { narrow: false, f: 1 },
  { narrow: true, f: 1.8 },
  { narrow: true, f: 1.55 },
];

describe('craneLayout: alt får plass i figuren', () => {
  for (const task of CRANE_TASKS) {
    for (const sc of SCALES) {
      const L = craneLayout(task, sc);
      const name = `${task.load}, f = ${sc.f}`;

      it(`${name}: kranen, bakken og bygget er innenfor viewBox`, () => {
        expect(L.Y(craneTop(task.h))).toBeGreaterThanOrEqual(0);
        expect(L.groundY).toBeLessThan(L.H);
        expect(L.X(-CRANE.counterLen)).toBeGreaterThanOrEqual(0);
        expect(L.X(CRANE.jibLen)).toBeLessThanOrEqual(L.W);
        expect(L.facadeX).toBeLessThan(L.W - 2 * L.lupe.r);
        expect(Number.isFinite(L.ppm) && L.ppm > 5).toBe(true);
      });

      it(`${name}: lasta går klar av bygget og tårnet`, () => {
        const [left, right] = loadSpan(L, task.load);
        expect(right).toBeLessThan(L.facadeX - 0.5 * L.ppm);
        expect(left).toBeGreaterThan(L.X(CRANE.footW / 2));
        // Lasta oppe ved dekket: krokblokka er under løpekatten
        const hh = hookHeights(task.load, loadBottom('top', task.h));
        expect(hh.blockTop).toBeLessThan(jibBottom(task.h) - 0.6 - 1);
      });

      it(`${name}: lupen står på fasaden, under dekket med plass til skiltet, og dekker ikke lasta`, () => {
        const { lupe } = L;
        const tagH = 17 * sc.f * 0.9 * 1.55;
        expect(lupe.x - lupe.r).toBeGreaterThanOrEqual(L.facadeX);
        expect(lupe.x + lupe.r).toBeLessThanOrEqual(L.W);
        expect(lupe.y + lupe.r).toBeLessThanOrEqual(L.groundY);
        expect(L.lupeTag.y - tagH / 2).toBeGreaterThanOrEqual(L.Y(task.h) - 0.5);
        expect(L.lupeTag.y + tagH / 2).toBeLessThan(lupe.y - lupe.r);
        expect(lupe.r).toBeGreaterThanOrEqual(60);
        const [, right] = loadSpan(L, task.load);
        expect(lupe.x - lupe.r).toBeGreaterThan(right);
      });

      it(`${name}: lasta og pilene i lupen er innenfor lupen`, () => {
        const { Z, cx, cy } = lupeMap(L.lupe, task.load);
        const { w, h } = LOAD_DIMS[task.load];
        const inside = (x: number, y: number) => Math.hypot(x - L.lupe.x, y - L.lupe.y) <= L.lupe.r;
        expect(inside(cx - (w / 2) * Z, cy + (h / 2) * Z)).toBe(true);
        expect(inside(cx + (w / 2) * Z, cy + (h / 2) * Z)).toBe(true);
        for (const dir of ['up', 'down'] as const) {
          const A = lupeArrows(L.lupe, task.load, dir);
          for (const seg of [A.S, A.G, A.v]) {
            expect(inside(seg.x1, seg.y1)).toBe(true);
            expect(inside(seg.x2, seg.y2)).toBe(true);
          }
        }
      });
    }
  }
});

describe('lupeArrows', () => {
  const lupe = { x: 500, y: 300, r: 90 };
  it('S og G er like lange og motsatt rettet (jevn fart)', () => {
    for (const load of ['murstein', 'stalbjelker', 'gips'] as const) {
      const { S, G } = lupeArrows(lupe, load);
      expect(Math.abs(S.y2 - S.y1)).toBeCloseTo(Math.abs(G.y2 - G.y1), 9);
      expect(S.y2).toBeLessThan(S.y1);
      expect(G.y2).toBeGreaterThan(G.y1);
      expect(S.x1).toBe(S.x2);
      expect(G.x1).toBe(G.x2);
    }
  });
  it('fartspila peker opp ved løft og ned ved senking', () => {
    const up = lupeArrows(lupe, 'murstein', 'up').v;
    const down = lupeArrows(lupe, 'murstein', 'down').v;
    expect(up.y2).toBeLessThan(up.y1);
    expect(down.y2).toBeGreaterThan(down.y1);
  });
  it('fartspila står utenfor stroppene (til høyre for festepunktet på lasta)', () => {
    for (const load of ['murstein', 'stalbjelker', 'gips'] as const) {
      const { Z, cx } = lupeMap(lupe, load);
      const v = lupeArrows(lupe, load).v;
      // Stroppene går fra kroken (midt over) ned til festepunktene, som er innenfor halve bredden av lasta
      expect(v.x1).toBeGreaterThan(cx + Math.min((LOAD_DIMS[load].w / 2) * Z, 0.3 * lupe.r));
    }
  });
});

describe('outerTangents', () => {
  it('strekene tangerer begge sirklene', () => {
    const a = { x: 100, y: 200, r: 15 };
    const b = { x: 500, y: 260, r: 90 };
    const t = outerTangents(a, b)!;
    expect(t).toHaveLength(2);
    for (const [p, q] of t) {
      expect(Math.hypot(p.x - a.x, p.y - a.y)).toBeCloseTo(a.r, 9);
      expect(Math.hypot(q.x - b.x, q.y - b.y)).toBeCloseTo(b.r, 9);
      // Radiene står vinkelrett på streken
      const dx = q.x - p.x;
      const dy = q.y - p.y;
      expect((p.x - a.x) * dx + (p.y - a.y) * dy).toBeCloseTo(0, 6);
      expect((q.x - b.x) * dx + (q.y - b.y) * dy).toBeCloseTo(0, 6);
    }
  });
  it('gir null når sirklene overlapper', () => {
    expect(outerTangents({ x: 0, y: 0, r: 50 }, { x: 60, y: 0, r: 50 })).toBeNull();
  });
});

describe('figureSpec', () => {
  it('har en figur for oppgaven, hvert steg og hele løsningen', () => {
    for (let i = 0; i <= STEP_COUNT; i++) expect(figureSpec(i, false)).toBeDefined();
    const all = figureSpec(0, true);
    expect(all.lupe && all.height && all.ep).toBe(true);
    expect(all.energy).toBe('round');
  });
  it('lasta er der deloppgaven handler om', () => {
    const spots: Spot[] = Array.from({ length: STEP_COUNT + 1 }, (_, i) => figureSpec(i, false).spot);
    // a og c: på vei opp; b og d: oppe ved dekket; e: på vei ned og til slutt nede
    expect(spots).toEqual(['mid', 'mid', 'mid', 'top', 'top', 'mid', 'mid', 'top', 'top', 'mid', 'mid', 'ground']);
    expect(figureSpec(1, false).dir).toBe('up');
    expect(figureSpec(9, false).dir).toBe('down');
    expect(figureSpec(10, false).dir).toBe('down');
  });
  it('energiflyten kommer i d) og e), og hele turen til slutt', () => {
    const e = Array.from({ length: STEP_COUNT + 1 }, (_, i) => figureSpec(i, false).energy);
    expect(e).toEqual([null, null, null, null, null, null, null, 'up', 'upKwh', null, 'down', 'round']);
  });
  it('lupen med kreftene i a), b), c) og e)', () => {
    const l = Array.from({ length: STEP_COUNT + 1 }, (_, i) => figureSpec(i, false).lupe);
    expect(l).toEqual([false, true, true, true, false, false, true, false, false, true, false, false]);
  });
});

describe('målene', () => {
  it('kranen rekker over dekket, og stroppene og kroken har rimelige mål', () => {
    for (const task of CRANE_TASKS) {
      expect(jibBottom(task.h) - task.h).toBeGreaterThan(8);
      expect(craneTop(task.h)).toBeGreaterThan(jibBottom(task.h));
    }
    expect(FACADE_X - LIFT_X).toBeGreaterThan(LOAD_DIMS.stalbjelker.w / 2);
    expect(HOOK.slingH).toBeGreaterThan(1);
    expect(CRANE.jibLen).toBeGreaterThan(FACADE_X + 5);
  });
});
