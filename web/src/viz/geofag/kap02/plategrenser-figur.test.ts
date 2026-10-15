import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { plategrenseGeometri } from '../kit';
import Plategrenser from './Plategrenser';
import { VulkankjedeDiagram } from './plategrenser-deler';

/** Ingen NaN, Infinity eller undefined i det som tegnes eller skrives (viz-shot leter etter dem uten ordgrense). */
const feiltall = /NaN|Infinity|undefined/;

let feil: unknown[][] = [];
beforeEach(() => {
  feil = [];
  vi.spyOn(console, 'error').mockImplementation((...a: unknown[]) => {
    feil.push(a);
  });
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe('Platene beveger seg', () => {
  it('tegnes uten feiltall og uten advarsler', () => {
    const html = renderToStaticMarkup(createElement(Plategrenser));
    expect(html).not.toMatch(feiltall);
    expect(feil.map((a) => String(a[0]).slice(0, 80))).toEqual([]);
  });

  it('vulkankjeden i diagrammet har alltid en aktiv vulkan, de samme som i blokka', () => {
    for (const fart of [1, 4, 10]) {
      for (const t of [0, 0.3, 3.1, 6.3, 12, 20]) {
        const v = plategrenseGeometri({ type: 'varmt-punkt', fart, t, w: 1000, h: 420 })!.vulkaner;
        expect(v.some((q) => q.aktiv), `fart ${fart}, t ${t}`).toBe(true);
        const svg = renderToStaticMarkup(createElement('svg', null, createElement(VulkankjedeDiagram, { fart, vulkaner: v, height: 280 })));
        expect(svg).toContain('>aktiv</text>');
        expect(svg).not.toMatch(feiltall);
      }
    }
  });
});
