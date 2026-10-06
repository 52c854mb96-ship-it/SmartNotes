import { describe, expect, it } from 'vitest';
import { BALCONY_THROW_TASKS, G, fmtSig, graphAxes, solveBalconyThrow } from './model-eks-kast-balkong';
import { labelWidth, placePassLabel } from './eks-kast-balkong-etiketter';

/**
 * v-t-grafen i steg 7 («Kontroller med den tidløse formelen»): på PC er grafen 376 enheter bred (marg 64f til venstre
 * og 14 til høyre), på mobil 440 (marg 74f og 12). Tidsaksen går fra 0 til tMax som i s-t-grafen.
 */
const LAYOUTS = [
  { name: 'PC', width: 376, left: 64, right: 14 },
  { name: 'mobil', width: 440, left: 74, right: 12 },
] as const;

describe('etiketten «forbi hånda» i v-t-grafen', () => {
  for (const [i, task] of BALCONY_THROW_TASKS.entries()) {
    for (const lay of LAYOUTS) {
      for (const f of [1, 1.15, 1.3]) {
        it(`tallsett ${i + 1}, ${lay.name}, f = ${f}: får plass i grafområdet og går klar av linja`, () => {
          const sol = solveBalconyThrow(task);
          const ax = graphAxes(sol, task.h0, 1);
          const x0 = lay.left * f;
          const x1 = lay.width - lay.right;
          const sx = (t: number) => x0 + ((t - 0) / (ax.tMax - 0)) * (x1 - x0);
          const tPass = (2 * task.v0) / G;
          const v = fmtSig(task.v0);
          const label = placePassLabel({
            px: sx(tPass),
            py: 200,
            x0,
            x1,
            f,
            text: `forbi hånda: −${v} m/s`,
            head: 'forbi hånda:',
            tail: `−${v} m/s`,
            size: 0.78,
          });
          // Innenfor grafområdet
          expect(label.left).toBeGreaterThanOrEqual(x0 + 4 - 1e-9);
          expect(label.right).toBeLessThanOrEqual(x1 - 4 + 1e-9);
          // Til venstre for punktet under hjelpelinja, eller til høyre for det over hjelpelinja: der går linja utenom
          if (label.anchor === 'end') {
            expect(label.right).toBeLessThanOrEqual(sx(tPass) - 12 * f + 1e-9);
            for (const y of label.ys) expect(y).toBeGreaterThan(200);
          } else {
            expect(label.left).toBeGreaterThanOrEqual(sx(tPass) + 12 * f - 1e-9);
            for (const y of label.ys) expect(y).toBeLessThan(200);
          }
          // Bredden stemmer med teksten som vises
          const widest = Math.max(...label.lines.map((l) => labelWidth(l, 0.78, f)));
          expect(label.right - label.left).toBeCloseTo(widest, 9);
        });
      }
    }
  }

  it('bruker én linje når det er plass, og to linjer når det er trangt', () => {
    const base = { py: 100, x0: 64, x1: 362, f: 1, text: 'forbi hånda: −7,50 m/s', head: 'forbi hånda:', tail: '−7,50 m/s', size: 0.78 };
    expect(placePassLabel({ ...base, px: 340 }).lines).toHaveLength(1);
    expect(placePassLabel({ ...base, px: 340 }).anchor).toBe('end');
    expect(placePassLabel({ ...base, px: 80 }).lines).toHaveLength(1);
    expect(placePassLabel({ ...base, px: 80 }).anchor).toBe('start');
    const tight = placePassLabel({ ...base, px: 246 });
    expect(tight.lines).toEqual(['forbi hånda:', '−7,50 m/s']);
    expect(tight.ys[1]! - tight.ys[0]!).toBeGreaterThan(17 * 0.78);
  });
});
