import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { GEO } from './colors';
import { hoydefelt, type Hoydefelt } from './kart';
import { Kotekart, Profildiagram, ekvidistanseFor, glattSti, hoydelagFor, jevnLinje, kartSkala } from './kotekart';

const svg = (child: ReturnType<typeof createElement>) => renderToStaticMarkup(createElement('svg', null, child));
const utenNaN = (html: string) => expect(html).not.toMatch(/NaN|Infinity/);

const felt: Hoydefelt = hoydefelt(
  3,
  [
    { type: 'plan', z0: 40, helningX: 0.05, helningY: 0 },
    { type: 'topp', x: 700, y: 500, hoyde: 600, radius: 500 },
    { type: 'dal', punkter: [[0, 1000], [1600, 1100]], dybde: 60, bredde: 300, form: 'V' },
  ],
  { bredde: 1600, lengde: 1200, celle: 40, ujevnhet: 5 },
)!;

describe('glattSti og jevnLinje', () => {
  it('glattSti gir tom sti under to punkter, rett linje for to og lukket sti med Z', () => {
    expect(glattSti([])).toBe('');
    expect(glattSti([[1, 1]])).toBe('');
    expect(glattSti([[0, 0], [10, 0]])).toBe('M0 0L10 0');
    const d = glattSti([[0, 0], [10, 0], [10, 10], [0, 0]], true);
    expect(d.startsWith('M0 0C')).toBe(true);
    expect(d.endsWith('Z')).toBe(true);
    expect(glattSti([[0, 0], [NaN, 3], [10, 0], [10, 10]])).not.toMatch(/NaN/);
  });

  it('jevnLinje holder endene fast, lar en rett linje være rett og fjerner ugyldige punkter', () => {
    const trapp: [number, number][] = [[0, 0], [1, 0], [1, 1], [2, 1], [2, 2], [3, 2], [3, 3]];
    const j = jevnLinje(trapp);
    expect(j[0]).toEqual([0, 0]);
    expect(j[j.length - 1]).toEqual([3, 3]);
    // Trappetrinnene nærmer seg diagonalen
    const avvik = (p: readonly number[]) => Math.abs(p[0]! - p[1]!);
    expect(Math.max(...j.slice(1, -1).map(avvik))).toBeLessThan(Math.max(...trapp.slice(1, -1).map(avvik)));
    expect(jevnLinje([[0, 0], [5, 0], [10, 0]])).toEqual([[0, 0], [5, 0], [10, 0]]);
    expect(jevnLinje([[0, 0], [NaN, 1], [2, 2]])).toHaveLength(2);
    const ring = jevnLinje([[0, 0], [10, 0], [10, 10], [0, 10]], true, 1);
    const midt = ring.reduce((s, p) => [s[0] + p[0] / 4, s[1] + p[1] / 4], [0, 0]);
    expect(midt[0]).toBeCloseTo(5, 9);
    expect(midt[1]).toBeCloseTo(5, 9);
  });
});

describe('kartSkala, ekvidistanseFor og hoydelagFor', () => {
  it('kartSkala går fra meter til figuren og tilbake', () => {
    const S = kartSkala(felt, 800, 10, 20);
    expect(S.px(0)).toBe(10);
    expect(S.px(1600)).toBeCloseTo(810, 9);
    expect(S.h).toBeCloseTo(600, 9);
    expect(S.mx(S.px(333))).toBeCloseTo(333, 9);
    expect(S.my(S.py(777))).toBeCloseTo(777, 9);
    expect(Number.isFinite(kartSkala(felt, NaN).k)).toBe(true);
  });

  it('ekvidistanseFor gir høyst 22 koter med en vanlig ekvidistanse', () => {
    const e = ekvidistanseFor(felt);
    expect([1, 2, 2.5, 5, 10, 20, 25, 50, 100]).toContain(e);
    expect((felt.max - felt.min) / e).toBeLessThanOrEqual(22);
    expect(ekvidistanseFor({ ...felt, min: 5, max: 5 })).toBe(1);
  });

  it('hoydelagFor gir sammenhengende lag fra bunn til topp i GEO-fargene', () => {
    const lag = hoydelagFor(felt);
    expect(lag.length).toBeGreaterThan(1);
    expect(lag.length).toBeLessThanOrEqual(6);
    expect(lag[0]!.fra).toBe(felt.min);
    expect(lag[lag.length - 1]!.til).toBe(felt.max);
    for (let i = 1; i < lag.length; i++) expect(lag[i]!.fra).toBe(lag[i - 1]!.til);
    expect(lag[0]!.farge).toBe(GEO.hoydelag[0]);
    expect(lag[lag.length - 1]!.farge).toBe(GEO.hoydelag[5]);
    // Med hav begynner laveste lag ved havnivå; egne grenser har fast farge
    expect(hoydelagFor(felt, 50, 100)[0]!.fra).toBe(Math.max(felt.min, 100));
    const egne = hoydelagFor(felt, 50, null, [100, 300]);
    expect(egne.map((l) => l.farge)).toEqual([GEO.hoydelag[0], GEO.hoydelag[1], GEO.hoydelag[2]]);
    expect(egne.map((l) => l.fra)).toEqual([felt.min, 100, 300]);
  });
});

describe('komponentene', () => {
  it('Kotekart tegner alt uten NaN, også med ugyldige valg', () => {
    utenNaN(
      svg(
        createElement(Kotekart, {
          felt,
          width: 800,
          hav: 20,
          maalestokk: 10000,
          innsjoer: [{ punkt: [1500, 200], niva: 100, navn: 'Vatnet' }],
          elver: [{ fra: [700, 300], navn: 'Elva' }, { punkter: [[0, 0], [NaN, 5], [100, 100]] }],
          vannskiller: [{ utlop: [800, 1050], navn: 'Nedbørfelt' }],
          soner: [{ verdi: (_x, _y, z) => 60 - z, farge: GEO.nedbor, navn: 'Flomsone', skravur: true }],
          merker: [{ p: [700, 500], symbol: 'topp', navn: 'Toppen' }, { p: [NaN, 0], symbol: 'hus' }],
          profil: { A: [100, 500], B: [1500, 600] },
          kotetallRetning: 'terreng',
        }),
      ),
    );
    utenNaN(svg(createElement(Kotekart, { felt, width: 800, ekvidistanse: 0, hoydelag: false, relieff: false, maalestokk: false })));
  });

  it('Profildiagram tåler overhøyde 0 og et profil med lengde 0', () => {
    utenNaN(svg(createElement(Profildiagram, { felt, A: [100, 500], B: [1500, 600], overhoyde: 1, hav: 20 })));
    utenNaN(svg(createElement(Profildiagram, { felt, A: [100, 500], B: [100, 500], overhoyde: 0 })));
  });
});
