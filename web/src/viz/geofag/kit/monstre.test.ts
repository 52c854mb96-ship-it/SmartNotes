import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { GEO } from './colors';
import { LAG_MONSTRE_ID, LagFlate, LagMonstre, MONSTER_NAVN, lagFyll } from './monstre';
import { MONSTER_IDS } from './typer';

const svg = (child: ReturnType<typeof createElement>) => renderToStaticMarkup(createElement('svg', null, child));

describe('LagMonstre', () => {
  it('lager ett mønster per MonsterId med id-en lagFyll peker på', () => {
    const html = svg(createElement(LagMonstre, { id: 'test' }));
    const ids = [...html.matchAll(/<pattern[^>]*id="([^"]+)"/g)].map((m) => m[1]);
    expect(ids).toEqual(MONSTER_IDS.map((t) => `test-${t}`));
    for (const t of MONSTER_IDS) expect(lagFyll(t, 'test').fill).toBe(`url(#test-${t})`);
  });

  it('bruker standard-id-en uten id, og bare de valgte mønstrene med `bare`', () => {
    const html = svg(createElement(LagMonstre, { bare: ['sandstein', 'leire'] }));
    expect(html.match(/<pattern/g)).toHaveLength(2);
    expect(html).toContain(`id="${LAG_MONSTRE_ID}-sandstein"`);
    expect(lagFyll('leire').fill).toBe(`url(#${LAG_MONSTRE_ID}-leire)`);
  });

  it('har ingen ugyldige tall, også med rar skala', () => {
    for (const skala of [1, 0.4, 3, 0, -1, Number.NaN]) {
      const html = svg(createElement(LagMonstre, { id: 'x', skala }));
      expect(html).not.toMatch(/NaN|Infinity|undefined/);
    }
  });

  it('gir strekfargen til bergarten som kontur', () => {
    expect(lagFyll('granitt').stroke).toBe(GEO.bergart.granitt.line);
  });

  it('har et norsk navn for hvert mønster', () => {
    for (const t of MONSTER_IDS) expect(MONSTER_NAVN[t]).toMatch(/^[A-ZÆØÅ][a-zæøå ]+$/);
  });
});

describe('LagFlate', () => {
  it('tegner formen med mønster, lys og kontur', () => {
    const html = svg(createElement(LagFlate, { points: [[0, 0], [10, 0], [10, 5]], type: 'kalkstein', monstre: 'm' }));
    expect(html).toContain('url(#m-kalkstein)');
    expect(html).toContain('<linearGradient');
    expect(html).toContain(`stroke="${GEO.bergart.kalkstein.line}"`);
  });

  it('tegner ingenting uten form', () => {
    expect(svg(createElement(LagFlate, { points: [[0, 0]], type: 'leire' }))).toBe('<svg></svg>');
  });
});
