import { describe, expect, it } from 'vitest';
import {
  FASER,
  cellOutlinePath,
  chromosomeSet,
  faseNavn,
  insideEllipse,
  layoutPhase,
  type Deling,
  type PlacedChromatid,
} from './kromosomer';

const box = { x: 20, y: 20, w: 760, h: 340 };

/** Hvilke kromosomer (par + opphav) som finnes i en celle, sortert. */
function content(ks: PlacedChromatid[], celle: number): string[] {
  return ks
    .filter((k) => k.celle === celle)
    .map((k) => `${k.par}${k.opphav}`)
    .sort();
}

describe('kromosomsettet', () => {
  it('2n = 4 og 2n = 6 med ett kromosom fra mor og ett fra far i hvert par', () => {
    expect(chromosomeSet(2)).toHaveLength(4);
    const six = chromosomeSet(3);
    expect(six).toHaveLength(6);
    for (const par of [0, 1, 2]) expect(six.filter((c) => c.par === par).map((c) => c.opphav)).toEqual(['mor', 'far']);
    // Homologe kromosomer er like lange
    expect(six[0]!.lengde).toBe(six[1]!.lengde);
    expect(six[0]!.lengde).toBeGreaterThan(six[2]!.lengde);
  });

  it('fasenavn', () => {
    expect(faseNavn('metafase')).toBe('metafase');
    expect(faseNavn('metafase', 'meiose1')).toBe('metafase I');
    expect(faseNavn('anafase', 'meiose2')).toBe('anafase II');
    expect(faseNavn('interfase', 'meiose1')).toBe('interfase');
  });
});

describe('mitose', () => {
  for (const n of [2, 3] as const) {
    it(`2n = ${2 * n}: like mange kromatider i alle fasene etter S-fasen, og begge dattercellene får hele settet`, () => {
      for (const fase of ['profase', 'metafase', 'anafase', 'telofase'] as const) {
        const lay = layoutPhase({ deling: 'mitose', fase, n, box });
        expect(lay.kromatider).toHaveLength(4 * n);
        const keys = lay.kromatider.map((k) => k.key);
        expect(new Set(keys).size).toBe(keys.length);
      }
      const meta = layoutPhase({ deling: 'mitose', fase: 'metafase', n, box });
      expect(meta.sentromerer).toHaveLength(2 * n);
      expect(meta.kromosomtall).toEqual([2 * n]);
      // Alle sentromerene står i ekvatorplanet
      for (const s of meta.sentromerer) expect(s.x).toBeCloseTo(meta.ekvatorplan[0]!.x, 9);
      const ana = layoutPhase({ deling: 'mitose', fase: 'anafase', n, box });
      expect(ana.sentromerer).toHaveLength(0);
      expect(ana.kromosomtall).toEqual([4 * n]);
      const tel = layoutPhase({ deling: 'mitose', fase: 'telofase', n, box });
      expect(tel.celler).toHaveLength(2);
      expect(tel.innsnoring).toEqual([[0, 1]]);
      expect(tel.kromosomtall).toEqual([2 * n, 2 * n]);
      // Dattercellene er genetisk like morcellen: ett av hvert kromosom fra både mor og far
      const all = chromosomeSet(n)
        .map((c) => `${c.par}${c.opphav}`)
        .sort();
      expect(content(tel.kromatider, 0)).toEqual(all);
      expect(content(tel.kromatider, 1)).toEqual(all);
    });
  }

  it('interfasen: kromatinet er ikke kondensert, med én kromatide per kromosom før S-fasen', () => {
    const g1 = layoutPhase({ deling: 'mitose', fase: 'interfase', n: 2, box });
    expect(g1.kromatider).toHaveLength(4);
    expect(g1.kromatider.every((k) => !k.kondensert)).toBe(true);
    expect(g1.kjerner).toHaveLength(1);
    const g2 = layoutPhase({ deling: 'mitose', fase: 'interfase', n: 2, box, replikert: true });
    expect(g2.kromatider).toHaveLength(8);
    expect(g2.kromosomtall).toEqual([4]);
  });
});

describe('meiose', () => {
  it('meiose I: de homologe kromosomene skilles, og hver celle får ett fra hvert par', () => {
    for (const n of [2, 3] as const) {
      const tel = layoutPhase({ deling: 'meiose1', fase: 'telofase', n, box });
      expect(tel.kromosomtall).toEqual([n, n]);
      for (const celle of [0, 1]) {
        const pars = content(tel.kromatider, celle).map((s) => s[0]);
        // Hvert par er med, to søsterkromatider per kromosom
        for (let p = 0; p < n; p++) expect(pars.filter((x) => x === String(p))).toHaveLength(2);
      }
    }
  });

  it('uavhengig fordeling: orienteringen i metafase I bestemmer hvem som går hvor', () => {
    const a = layoutPhase({ deling: 'meiose1', fase: 'anafase', n: 2, box, orientering: [true, true] });
    const b = layoutPhase({ deling: 'meiose1', fase: 'anafase', n: 2, box, orientering: [true, false] });
    const leftOf = (lay: typeof a) =>
      lay.kromatider
        .filter((k) => k.x < box.x + box.w / 2)
        .map((k) => `${k.par}${k.opphav}`)
        .sort();
    expect(leftOf(a)).toEqual(['0mor', '0mor', '1mor', '1mor']);
    expect(leftOf(b)).toEqual(['0mor', '0mor', '1far', '1far']);
  });

  it('meiose II: fire haploide celler med én kromatide fra hvert par', () => {
    for (const n of [2, 3] as const) {
      const tel = layoutPhase({ deling: 'meiose2', fase: 'telofase', n, box });
      expect(tel.celler).toHaveLength(4);
      expect(tel.innsnoring).toEqual([
        [0, 1],
        [2, 3],
      ]);
      expect(tel.kromosomtall).toEqual([n, n, n, n]);
      for (let celle = 0; celle < 4; celle++) {
        const pars = content(tel.kromatider, celle).map((s) => Number(s[0]));
        expect(pars.sort()).toEqual(Array.from({ length: n }, (_, i) => i));
      }
    }
  });

  it('overkrysning: mor og far bytter like store stykker, og bare de to indre kromatidene endres', () => {
    const lay = layoutPhase({ deling: 'meiose1', fase: 'profase', n: 3, box, overkrysning: true });
    for (const par of [0, 1, 2]) {
      const ks = lay.kromatider.filter((k) => k.par === par);
      const changed = ks.filter((k) => k.segmenter.length > 0);
      expect(changed.map((k) => k.key).sort()).toEqual([`${par}-far-a`, `${par}-mor-b`]);
      const [x, y] = changed;
      expect(x!.segmenter[0]!.opphav).not.toBe(x!.opphav);
      expect(x!.segmenter[0]!.fra).toBe(y!.segmenter[0]!.fra);
    }
    // Uten overkrysning er alle kromatidene rene
    expect(layoutPhase({ deling: 'meiose1', fase: 'profase', n: 3, box }).kromatider.every((k) => k.segmenter.length === 0)).toBe(true);
    // Rekombinasjonen følger med til kjønnscellene: to av de fire kromatidene i hvert par er rekombinante
    const gametes = layoutPhase({ deling: 'meiose2', fase: 'telofase', n: 2, box, overkrysning: true });
    expect(gametes.kromatider.filter((k) => k.segmenter.length > 0)).toHaveLength(4);
  });

  it('alle sentromerene ligger inne i sin celle, i alle faser og delinger', () => {
    const delinger: Deling[] = ['mitose', 'meiose1', 'meiose2'];
    for (const deling of delinger)
      for (const fase of FASER)
        for (const n of [2, 3] as const) {
          const lay = layoutPhase({ deling, fase, n, box, overkrysning: true });
          for (const k of lay.kromatider) {
            expect(Number.isFinite(k.x) && Number.isFinite(k.y)).toBe(true);
            expect(insideEllipse(k, lay.celler[k.celle]!, 2)).toBe(true);
            expect(k.lengde).toBeGreaterThan(20);
          }
          expect(lay.kromosomtall.length).toBe(lay.celler.length);
        }
  });

  it('metafasen får plass i cellen (kromosomene stikker ikke ut)', () => {
    for (const n of [2, 3] as const) {
      const lay = layoutPhase({ deling: 'mitose', fase: 'metafase', n, box });
      const cell = lay.celler[0]!;
      for (const k of lay.kromatider) {
        const top = k.y - k.sentromer * k.lengde;
        const bottom = k.y + (1 - k.sentromer) * k.lengde;
        expect(top).toBeGreaterThan(cell.cy - cell.ry);
        expect(bottom).toBeLessThan(cell.cy + cell.ry);
      }
    }
  });
});

describe('omriss', () => {
  it('en ellipse eller en peanøttform uten NaN', () => {
    const one = cellOutlinePath({ cx: 100, cy: 100, rx: 80, ry: 50 });
    expect(one).toMatch(/^M20,100 A80,50/);
    const two = cellOutlinePath({ cx: 60, cy: 100, rx: 50, ry: 45 }, { cx: 140, cy: 100, rx: 50, ry: 45 });
    expect(two).not.toMatch(/NaN/);
    expect(two.endsWith('Z')).toBe(true);
  });
});
