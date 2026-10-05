import { describe, expect, it } from 'vitest';
import {
  DIVERSITY_PRESETS,
  FOREST_SPECIES_COUNT,
  INDIVIDUALS,
  MAX_SPECIES,
  PATCH_LAYOUTS,
  WEB,
  cOfDistance,
  cascade,
  counts,
  energyPyramid,
  factorPerTenfold,
  fragmentation,
  keptWhenHalved,
  pielou,
  plotIndividuals,
  predatorsOf,
  shannon,
  shares,
  simpson,
  simpsonMax,
  speciesArea,
  summarizeEffects,
  trophicLevels,
  webRow,
  type WebId,
} from './model';

describe('artsmangfold', () => {
  it('andelene summerer til 1 og er like når jevnheten er 1', () => {
    for (const S of [1, 3, 8, 12])
      for (const e of [0, 0.5, 1]) expect(shares(S, e).reduce((a, b) => a + b, 0)).toBeCloseTo(1, 12);
    expect(shares(4, 1)).toEqual([0.25, 0.25, 0.25, 0.25]);
    // Lav jevnhet: én art dominerer
    expect(shares(8, 0)[0]!).toBeGreaterThan(0.7);
  });

  it('antallene er heltall, summerer til N og har minst ett individ per art', () => {
    for (let S = 1; S <= MAX_SPECIES; S++)
      for (const e of [0, 0.1, 0.37, 0.8, 1]) {
        const c = counts(S, e);
        expect(c).toHaveLength(S);
        expect(c.reduce((a, b) => a + b, 0)).toBe(INDIVIDUALS);
        expect(Math.min(...c)).toBeGreaterThanOrEqual(1);
        for (const n of c) expect(Number.isInteger(n)).toBe(true);
      }
  });

  it('Simpsons indeks: kjente verdier og grenser', () => {
    expect(simpson([10])).toBe(0);
    expect(simpson([5, 5])).toBeCloseTo(0.5, 12);
    expect(simpson([25, 25, 25, 25])).toBeCloseTo(0.75, 12);
    expect(simpson([1, 1, 1, 1])).toBeCloseTo(simpsonMax(4), 12);
    // Lærebokeksempel: 6, 3, 1 av 10 → 1 − (0,36 + 0,09 + 0,01) = 0,54
    expect(simpson([6, 3, 1])).toBeCloseTo(0.54, 12);
    for (let S = 1; S <= 12; S++) for (const e of [0, 0.5, 1]) expect(simpson(counts(S, e))).toBeLessThanOrEqual(simpsonMax(S) + 1e-12);
  });

  it('Shannon og jevnhet', () => {
    expect(shannon([5, 5])).toBeCloseTo(Math.log(2), 12);
    expect(pielou([3, 3, 3])).toBeCloseTo(1, 12);
    expect(pielou([8, 1, 1])).toBeLessThan(0.7);
    expect(pielou([7])).toBe(1);
  });

  it('jevnere fordeling gir høyere indeks med samme antall arter', () => {
    expect(simpson(counts(8, 0.9))).toBeGreaterThan(simpson(counts(8, 0.1)));
    // Forhåndsvalget «flest arter er ikke alltid mest mangfold»
    const p = DIVERSITY_PRESETS.find((x) => x.id === 'flere')!;
    expect(simpson(counts(p.b.S, p.b.evenness))).toBeGreaterThan(simpson(counts(p.a.S, p.a.evenness)));
    expect(p.a.S).toBeGreaterThan(p.b.S);
  });

  it('individene i prøveflata: riktig antall av hver art, innenfor boksen, likt for samme frø', () => {
    const c = counts(7, 0.4);
    const ind = plotIndividuals(c, 3);
    expect(ind).toHaveLength(INDIVIDUALS);
    for (let s = 0; s < 7; s++) expect(ind.filter((i) => i.species === s)).toHaveLength(c[s]!);
    for (const i of ind) {
      expect(i.x).toBeGreaterThan(0);
      expect(i.x).toBeLessThan(1);
      expect(i.y).toBeGreaterThan(0);
      expect(i.y).toBeLessThan(1);
    }
    expect(plotIndividuals(c, 3)).toEqual(ind);
  });
});

describe('arter og areal', () => {
  it('S = c · A^z og tommelfingerregelen 10 × areal ≈ 2 × arter', () => {
    expect(speciesArea(40, 1, 0.25)).toBe(40);
    expect(speciesArea(40, 10000, 0.25)).toBeCloseTo(400, 9);
    expect(factorPerTenfold(0.3)).toBeCloseTo(1.995, 3);
    expect(keptWhenHalved(0.25)).toBeCloseTo(0.841, 3);
    // Rett linje i log–log med stigningstall z
    const z = 0.3;
    const slope = (Math.log10(speciesArea(20, 1000, z)) - Math.log10(speciesArea(20, 1, z))) / 3;
    expect(slope).toBeCloseTo(z, 12);
  });

  it('øyer langt fra fastlandet har færre arter', () => {
    expect(cOfDistance(0)).toBe(40);
    expect(cOfDistance(200)).toBeCloseTo(40 / Math.E, 9);
    expect(cOfDistance(400)).toBeLessThan(cOfDistance(50));
  });

  it('oppstykking: én bit uten tap gir alle artene, flere biter gir færre', () => {
    const z = 0.25;
    expect(fragmentation(1, 0, z, false).species).toBeCloseTo(FOREST_SPECIES_COUNT, 9);
    let last = Infinity;
    for (const { n } of PATCH_LAYOUTS) {
      const r = fragmentation(n, 0, z, false);
      expect(r.species).toBeLessThanOrEqual(last + 1e-9);
      last = r.species;
      // Uten kanteffekt: S = S0 · n^(−z)
      expect(r.species).toBeCloseTo(FOREST_SPECIES_COUNT * n ** -z, 9);
    }
    // Den hele skogen har 100 arter også med kanteffekt (c er satt etter den)
    expect(fragmentation(1, 0, z, true).species).toBeCloseTo(FOREST_SPECIES_COUNT, 9);
    expect(fragmentation(1, 0, z, true).referenceArea).toBeCloseTo(9.8 ** 2, 9);
    // Kanteffekt gir enda færre, og tap av skog gir færre
    expect(fragmentation(9, 0, z, true).species).toBeLessThan(fragmentation(9, 0, z, false).species);
    expect(fragmentation(4, 0.5, z, false).species).toBeLessThan(fragmentation(4, 0, z, false).species);
    // Samme skog i ett stykke har flere arter enn oppstykket
    const r = fragmentation(16, 0.3, z, true);
    expect(r.speciesOnePiece).toBeGreaterThan(r.species);
    expect(r.remaining).toBeCloseTo(70, 9);
    for (const { n, rows, cols } of PATCH_LAYOUTS) expect(rows * cols).toBe(n);
  });

  it('alle kombinasjoner gir endelige tall', () => {
    for (const { n } of PATCH_LAYOUTS)
      for (const loss of [0, 0.4, 0.8])
        for (const edge of [false, true]) for (const z of [0.2, 0.35]) expect(Number.isFinite(fragmentation(n, loss, z, edge).species)).toBe(true);
  });
});

describe('næringsnettet', () => {
  it('diettandelene summerer til 1, og all mat finnes i nettet', () => {
    const ids = new Set(WEB.map((s) => s.id));
    for (const s of WEB) {
      const w = Object.values(s.diet);
      if (w.length) expect(w.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 9);
      for (const p of Object.keys(s.diet)) expect(ids.has(p as WebId)).toBe(true);
    }
  });

  it('trofiske nivåer', () => {
    const tl = trophicLevels();
    expect(tl.get('blabaer')).toBe(1);
    expect(tl.get('elg')).toBeCloseTo(2, 9);
    expect(tl.get('ulv')).toBeCloseTo(3, 9);
    expect(webRow('spurvehauk', tl)).toBe(4);
    expect(webRow('meis', tl)).toBe(3);
    expect(webRow('nedbrytere', tl)).toBe(0);
    for (const s of WEB) if (s.id !== 'nedbrytere') expect(webRow(s.id, tl)).toBeGreaterThanOrEqual(1);
  });

  it('uten ulv: flere elg (direkte) og mindre lauvtrær (indirekte) – trofisk kaskade', () => {
    const e = cascade('ulv');
    expect(e.get('ulv')?.kind).toBe('fjernet');
    expect(e.get('elg')).toMatchObject({ kind: 'oker', round: 1 });
    expect(e.get('radyr')?.kind).toBe('oker');
    expect(e.get('lauvtraer')).toMatchObject({ kind: 'minker', round: 2 });
  });

  it('uten meiser dør spurvehauken ut, og insektene øker', () => {
    const e = cascade('meis');
    expect(e.get('spurvehauk')?.kind).toBe('dor-ut');
    expect(e.get('insekter')?.kind).toBe('oker');
  });

  it('uten smågnagere får rev og mår mindre mat', () => {
    const e = cascade('smagnagere');
    expect(e.get('rev')).toMatchObject({ kind: 'minker', round: 1 });
    expect(e.get('mar')).toMatchObject({ kind: 'minker', round: 1 });
    expect(e.get('ekorn')?.kind).toBe('oker');
  });

  it('uten nedbrytere minker produsentene og planteeterne', () => {
    const e = cascade('nedbrytere');
    for (const id of ['gras', 'blabaer', 'lauvtraer', 'bartraer'] as WebId[]) expect(e.get(id)?.kind).toBe('minker');
    expect(e.get('elg')?.kind).toBe('minker');
  });

  it('ingen art fjernet gir ingen virkninger, og alle virkninger er endelige', () => {
    expect(cascade(null).size).toBe(0);
    for (const s of WEB)
      for (const [, ef] of cascade(s.id)) {
        expect(Number.isFinite(ef.value)).toBe(true);
        expect(Math.abs(ef.value)).toBeLessThanOrEqual(1);
      }
    // Spurvehauken har bare én matkilde
    expect(predatorsOf('meis')).toContain('spurvehauk');
  });

  it('oppsummeringen fordeler virkningene på direkte og indirekte', () => {
    const sum = summarizeEffects(cascade('ulv'));
    expect(sum.direct.oker).toEqual(['radyr', 'elg']);
    expect(sum.indirect.minker).toContain('lauvtraer');
    const all = [...Object.values(sum.direct), ...Object.values(sum.indirect)].flat();
    expect(all).not.toContain('ulv');
    expect(new Set(all).size).toBe(all.length);
    const none = summarizeEffects(cascade(null));
    expect([...Object.values(none.direct), ...Object.values(none.indirect)].flat()).toHaveLength(0);
  });

  it('energipyramiden: 10 % videre gir 16 000, 1 600, 160 og 16 kJ', () => {
    const e = energyPyramid(0.1);
    expect(e).toHaveLength(4);
    expect(e[0]).toBe(16000);
    expect(e[1]).toBeCloseTo(1600, 9);
    expect(e[3]).toBeCloseTo(16, 9);
    expect(e[3]! / e[0]!).toBeCloseTo(0.001, 12);
  });
});
