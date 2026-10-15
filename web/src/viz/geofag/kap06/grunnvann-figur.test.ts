import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GrunnvannFigur, PoreFigur, beregn, forklaring } from './Grunnvann';
import { oppsett } from './grunnvann-scene';
import { AVSTAND_MAKS_M, AVSTAND_MIN_M, MATERIAL_VALG } from './model-grunnvann';

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

describe('Snittet', () => {
  it('tegnes uten feiltall for alle materialer, pumperater, avstander og tider', () => {
    for (const f of [1, 1.85]) {
      const o = oppsett(f);
      for (const valg of MATERIAL_VALG) {
        for (const q of [0, 5, 20]) {
          for (const L of [AVSTAND_MIN_M, AVSTAND_MAKS_M]) {
            for (const nitrat of [false, true]) {
              const b = beregn(valg, q, L, nitrat);
              for (const andel of nitrat ? [0.37, 1] : [0, 1]) {
                const svg = renderToStaticMarkup(createElement('svg', null, createElement(GrunnvannFigur, { o, b, tau: andel * b.spenn, t: andel * 12 })));
                expect(svg, `${valg} ${q} l/s ${L} m ${nitrat ? 'nitrat' : ''} ${andel}`).not.toMatch(feiltall);
              }
              const tekst = renderToStaticMarkup(createElement('div', null, forklaring(b)));
              expect(tekst).not.toMatch(feiltall);
            }
          }
        }
      }
    }
    expect(feil).toEqual([]);
  }, 120_000);

  it('merkene når brønnen i grus, men ikke i leire', () => {
    const o = oppsett(1);
    const grus = beregn('grus', 5, 60, false);
    const leire = beregn('leire', 5, 60, false);
    const tell = (svg: string) => (svg.match(/<circle/g) ?? []).length;
    const grusStart = renderToStaticMarkup(createElement('svg', null, createElement(GrunnvannFigur, { o, b: grus, tau: 0, t: 0 })));
    const grusSlutt = renderToStaticMarkup(createElement('svg', null, createElement(GrunnvannFigur, { o, b: grus, tau: grus.spenn, t: 12 })));
    expect(tell(grusSlutt)).toBeGreaterThan(tell(grusStart) + 10);
    // I leire dør smittestoffene lenge før de kommer noen vei
    const leireStart = renderToStaticMarkup(createElement('svg', null, createElement(GrunnvannFigur, { o, b: leire, tau: 0, t: 0 })));
    const leireSlutt = renderToStaticMarkup(createElement('svg', null, createElement(GrunnvannFigur, { o, b: leire, tau: leire.spenn, t: 12 })));
    expect(tell(leireSlutt)).toBeLessThan(tell(leireStart) + 3);
  });
});

describe('Forklaringen', () => {
  it('kaller aldri oppsprukket fjell en hygienisk barriere, selv når reisetiden er over 60 døgn', () => {
    const tekst = (q: number, L: number) => renderToStaticMarkup(createElement('div', null, forklaring(beregn('oppsprukket-fjell', q, L, false))));
    for (const q of [0, 0.2, 1, 5, 20]) {
      for (const L of [AVSTAND_MIN_M, 60, AVSTAND_MAKS_M]) {
        const t = tekst(q, L);
        expect(t).toContain('regnes ikke som en hygienisk barriere');
        expect(t).toContain('UV-behandling');
        expect(t).not.toContain('regnes som en hygienisk barriere:');
      }
    }
    // Med lite pumping og lang avstand er reisetiden med snittfarten godt over 60 døgn (testet over), men ingen barriere
    const b = beregn('oppsprukket-fjell', 0.2, AVSTAND_MAKS_M, false);
    expect(b.tSmitte!).toBeGreaterThan(60);
    // I løsmasser med lang nok reisetid er grunnen en barriere
    const sand = renderToStaticMarkup(createElement('div', null, forklaring(beregn('sand', 0, AVSTAND_MAKS_M, false))));
    expect(sand).toContain('løsmassene regnes som en hygienisk barriere');
  });
});

describe('Lupene og fartsstigen', () => {
  it('tegnes uten feiltall og uten advarsler for alle materialer', () => {
    for (const f of [1, 1.85]) {
      for (const valg of MATERIAL_VALG) {
        const svg = renderToStaticMarkup(createElement('svg', null, createElement(PoreFigur, { valg, t: 3, f })));
        expect(svg).not.toMatch(feiltall);
      }
    }
    expect(feil.map((a) => String(a[0]).slice(0, 80))).toEqual([]);
  }, 60_000);
});
