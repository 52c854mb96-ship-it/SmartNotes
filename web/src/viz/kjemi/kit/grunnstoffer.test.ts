import { describe, expect, it } from 'vitest';
import {
  ALL_SYMBOLS,
  ELEMENTS,
  chargeSuperscript,
  chargeText,
  element,
  elementsInGroup,
  elementsInPeriod,
  getElement,
  ionShells,
  ionSymbol,
  isMetal,
  isNonmetal,
  mainGroupInPeriod,
  subshellsFor,
} from './grunnstoffer';

describe('grunnstofftabellen', () => {
  it('har Z = 1–54 og Cs, Ba, Pt, Au, Hg, Pb, Rn, U, med unike symboler og navn', () => {
    expect(ELEMENTS).toHaveLength(62);
    const Zs = ELEMENTS.map((e) => e.Z);
    expect(Zs.slice(0, 54)).toEqual(Array.from({ length: 54 }, (_, i) => i + 1));
    expect(Zs.slice(54)).toEqual([55, 56, 78, 79, 80, 82, 86, 92]);
    expect(new Set(ELEMENTS.map((e) => e.symbol)).size).toBe(62);
    expect(new Set(ELEMENTS.map((e) => e.name)).size).toBe(62);
    for (const e of ELEMENTS) {
      expect(ALL_SYMBOLS[e.Z - 1]).toBe(e.symbol);
      expect(e.name).toMatch(/^[a-zæøå]+$/);
    }
    expect(ALL_SYMBOLS).toHaveLength(118);
  });

  it('norske navn', () => {
    const names = Object.fromEntries(ELEMENTS.map((e) => [e.symbol, e.name]));
    expect(names).toMatchObject({ H: 'hydrogen', C: 'karbon', N: 'nitrogen', O: 'oksygen', Na: 'natrium', K: 'kalium', S: 'svovel', Fe: 'jern', Cu: 'kobber', Zn: 'sink', Ag: 'sølv', Sn: 'tinn', I: 'jod', Au: 'gull', Hg: 'kvikksølv', Pb: 'bly', U: 'uran', Sc: 'scandium', Si: 'silisium' });
  });

  it('oppslag på symbol og protontall', () => {
    expect(getElement('Na')?.Z).toBe(11);
    expect(getElement(17)?.symbol).toBe('Cl');
    expect(getElement('Xx')).toBeUndefined();
    expect(getElement(60)).toBeUndefined();
    expect(() => element('Xx')).toThrow();
    expect(element(79).name).toBe('gull');
  });

  it('molare masser som i lærebøkene', () => {
    const M = (s: string) => element(s).molarMass;
    expect(M('H')).toBe(1.008);
    expect(M('C')).toBe(12.01);
    expect(M('N')).toBe(14.01);
    expect(M('O')).toBe(16.0);
    expect(M('Na')).toBe(22.99);
    expect(M('Cl')).toBe(35.45);
    expect(M('Ca')).toBe(40.08);
    expect(M('Fe')).toBe(55.85);
    expect(M('Cu')).toBe(63.55);
    expect(M('U')).toBe(238.03);
    // Molar masse øker nesten alltid med Z (unntak: Ar/K, Co/Ni, Te/I)
    const inversions = ELEMENTS.slice(1).filter((e, i) => e.molarMass < ELEMENTS[i]!.molarMass).map((e) => e.symbol);
    expect(inversions).toEqual(['K', 'Ni', 'I']);
    expect(element('Tc').unstable).toBe(true);
    expect(element('Rn').unstable).toBe(true);
    expect(element('U').unstable).toBeUndefined();
  });

  it('gruppe, periode, blokk og kategori', () => {
    expect(element('Na')).toMatchObject({ group: 1, period: 3, block: 's', category: 'alkalimetall' });
    expect(element('He')).toMatchObject({ group: 18, period: 1, block: 's', category: 'edelgass' });
    expect(element('Fe')).toMatchObject({ group: 8, period: 4, block: 'd', category: 'overgangsmetall' });
    expect(element('Cl')).toMatchObject({ group: 17, block: 'p', category: 'halogen' });
    expect(element('Si')).toMatchObject({ group: 14, category: 'halvmetall' });
    expect(element('U')).toMatchObject({ group: null, period: 7, block: 'f', category: 'aktinoid' });
    expect(elementsInGroup(1).map((e) => e.symbol)).toEqual(['H', 'Li', 'Na', 'K', 'Rb', 'Cs']);
    expect(elementsInGroup(18).map((e) => e.symbol)).toEqual(['He', 'Ne', 'Ar', 'Kr', 'Xe', 'Rn']);
    expect(elementsInPeriod(2)).toHaveLength(8);
    expect(elementsInPeriod(4)).toHaveLength(18);
    expect(mainGroupInPeriod(4).map((e) => e.symbol)).toEqual(['K', 'Ca', 'Ga', 'Ge', 'As', 'Se', 'Br', 'Kr']);
    expect(isMetal(element('Al'))).toBe(true);
    expect(isMetal(element('Si'))).toBe(false);
    expect(isNonmetal(element('Si'))).toBe(false);
    expect(isNonmetal(element('Br'))).toBe(true);
    expect(element('Br').phase).toBe('l');
    expect(element('Hg').phase).toBe('l');
    expect(element('Cl').phase).toBe('g');
  });

  it('elektronegativitet: null for He, Ne og Ar, F er høyest, og den øker bortover periode 2 og 3', () => {
    expect(['He', 'Ne', 'Ar'].map((s) => element(s).electronegativity)).toEqual([null, null, null]);
    expect(element('F').electronegativity).toBe(3.98);
    expect(element('O').electronegativity).toBe(3.44);
    expect(element('Na').electronegativity).toBe(0.93);
    expect(element('Cs').electronegativity).toBe(0.79);
    const max = Math.max(...ELEMENTS.map((e) => e.electronegativity ?? 0));
    expect(max).toBe(3.98);
    for (const period of [2, 3]) {
      const en = mainGroupInPeriod(period).map((e) => e.electronegativity).filter((v): v is number => v !== null);
      expect(en).toHaveLength(7);
      for (let i = 1; i < en.length; i++) expect(en[i]!).toBeGreaterThan(en[i - 1]!);
    }
    // og avtar nedover gruppe 1 og 17
    for (const g of [1, 17]) {
      const en = elementsInGroup(g).map((e) => e.electronegativity!);
      for (let i = 1; i < en.length; i++) expect(en[i]!).toBeLessThanOrEqual(en[i - 1]!);
    }
  });

  it('første ioniseringsenergi: edelgassen er størst i hver periode, alkalimetallet minst', () => {
    expect(element('H').ionizationEnergy).toBe(1312);
    expect(element('Na').ionizationEnergy).toBe(496);
    expect(element('Cl').ionizationEnergy).toBe(1251);
    expect(element('He').ionizationEnergy).toBe(2372);
    for (let p = 1; p <= 6; p++) {
      const els = elementsInPeriod(p);
      const max = els.reduce((a, b) => (b.ionizationEnergy > a.ionizationEnergy ? b : a));
      const min = els.reduce((a, b) => (b.ionizationEnergy < a.ionizationEnergy ? b : a));
      expect(max.category).toBe('edelgass');
      if (p > 1) expect(min.category).toBe('alkalimetall');
    }
    // Kjente knekker i periode 2: Be > B og N > O
    expect(element('Be').ionizationEnergy).toBeGreaterThan(element('B').ionizationEnergy);
    expect(element('N').ionizationEnergy).toBeGreaterThan(element('O').ionizationEnergy);
  });

  it('atomradius avtar bortover en periode (gruppe 1–17) og øker nedover en gruppe', () => {
    for (const period of [2, 3, 4, 5]) {
      const r = mainGroupInPeriod(period)
        .filter((e) => e.category !== 'edelgass')
        .map((e) => e.covalentRadius);
      // Strengt avtagende i periode 2 og 3. I periode 4 og 5 har Cordero-dataene små knekker på 1 pm (As/Se, Te/I).
      const slack = period <= 3 ? 0 : 1;
      for (let i = 1; i < r.length; i++) expect(r[i]!).toBeLessThanOrEqual(r[i - 1]! + slack);
      expect(r[r.length - 1]!).toBeLessThan(r[0]! * 0.7);
    }
    for (const g of [1, 2, 17]) {
      const r = elementsInGroup(g).map((e) => e.covalentRadius);
      for (let i = 1; i < r.length; i++) expect(r[i]!).toBeGreaterThan(r[i - 1]!);
    }
    expect(element('C').covalentRadius).toBe(76);
    expect(element('H').covalentRadius).toBe(31);
  });

  it('ioneradius: kationer er mindre og anioner større enn atomet', () => {
    expect(element('Na').ionicRadius[1]).toBe(102);
    expect(element('Cl').ionicRadius[-1]).toBe(181);
    for (const e of ELEMENTS)
      for (const [q, r] of Object.entries(e.ionicRadius)) {
        if (Number(q) > 0) expect(r).toBeLessThan(e.covalentRadius);
        else expect(r).toBeGreaterThan(e.covalentRadius);
      }
  });

  it('elektronkonfigurasjon', () => {
    expect(element('H').configuration).toBe('1s¹');
    expect(element('O').configuration).toBe('1s² 2s² 2p⁴');
    expect(element('O').configurationShort).toBe('[He] 2s² 2p⁴');
    expect(element('S').configurationShort).toBe('[Ne] 3s² 3p⁴');
    expect(element('K').configurationShort).toBe('[Ar] 4s¹');
    expect(element('Fe').configurationShort).toBe('[Ar] 3d⁶ 4s²');
    expect(element('Fe').configuration).toBe('1s² 2s² 2p⁶ 3s² 3p⁶ 3d⁶ 4s²');
    expect(element('Cr').configurationShort).toBe('[Ar] 3d⁵ 4s¹');
    expect(element('Cu').configurationShort).toBe('[Ar] 3d¹⁰ 4s¹');
    expect(element('Zn').configurationShort).toBe('[Ar] 3d¹⁰ 4s²');
    expect(element('Br').configurationShort).toBe('[Ar] 3d¹⁰ 4s² 4p⁵');
    expect(element('Pd').configurationShort).toBe('[Kr] 4d¹⁰');
    expect(element('Ag').configurationShort).toBe('[Kr] 4d¹⁰ 5s¹');
    expect(element('Au').configurationShort).toBe('[Xe] 4f¹⁴ 5d¹⁰ 6s¹');
    expect(element('Pb').configurationShort).toBe('[Xe] 4f¹⁴ 5d¹⁰ 6s² 6p²');
    expect(element('U').configurationShort).toBe('[Rn] 5f³ 6d¹ 7s²');
    // Elektrontallet stemmer for alle
    for (const e of ELEMENTS) expect(e.subshells.reduce((s, x) => s + x.electrons, 0)).toBe(e.Z);
    expect(subshellsFor(10).map((s) => s.electrons)).toEqual([2, 2, 6]);
  });

  it('skall, Bohr-modell og valenselektroner', () => {
    expect(element('Na').bohrShells).toEqual([2, 8, 1]);
    expect(element('Ca').bohrShells).toEqual([2, 8, 8, 2]);
    expect(element('K').shells).toEqual([2, 8, 8, 1]);
    expect(element('Fe').shells).toEqual([2, 8, 14, 2]);
    expect(element('Fe').bohrShells).toBeNull();
    expect(element('Br').shells).toEqual([2, 8, 18, 7]);
    for (const e of ELEMENTS) expect(e.shells.reduce((s, x) => s + x, 0)).toBe(e.Z);
    // Valenselektroner = elektroner i ytterste skall for hovedgruppene (unntatt He: 2)
    for (const e of ELEMENTS) if (e.valenceElectrons !== null) expect(e.shells[e.shells.length - 1]).toBe(e.valenceElectrons);
    expect(element('He').valenceElectrons).toBe(2);
    expect(element('Ne').valenceElectrons).toBe(8);
    expect(element('C').valenceElectrons).toBe(4);
    expect(element('Fe').valenceElectrons).toBeNull();
  });

  it('vanlige ioner og ioneskall', () => {
    expect(element('Na').ions).toEqual([1]);
    expect(element('Mg').ions).toEqual([2]);
    expect(element('Al').ions).toEqual([3]);
    expect(element('O').ions).toEqual([-2]);
    expect(element('Cl').ions).toEqual([-1]);
    expect(element('Fe').ions).toEqual([2, 3]);
    expect(element('Cu').ions).toEqual([2, 1]);
    expect(element('Ne').ions).toEqual([]);
    // Hovedgruppene får edelgasstruktur
    for (const s of ['Li', 'Na', 'Mg', 'Al', 'K', 'Ca', 'N', 'O', 'F', 'P', 'S', 'Cl']) {
      const e = element(s);
      const shells = ionShells(e, e.ions[0]!)!;
      const last = shells[shells.length - 1]!;
      expect(last === 8 || (shells.length === 1 && last === 2)).toBe(true);
    }
    expect(ionShells(element('Na'), 1)).toEqual([2, 8]);
    expect(ionShells(element('Cl'), -1)).toEqual([2, 8, 8]);
    expect(ionShells(element('H'), 1)).toEqual([]);
    expect(ionShells(element('H'), -1)).toEqual([2]);
    expect(ionShells(element('Fe'), 2)).toBeNull();
    expect(ionSymbol('Mg', 2)).toBe('Mg²⁺');
    expect(ionSymbol('Cl', -1)).toBe('Cl⁻');
    expect(chargeSuperscript(-2)).toBe('²⁻');
    expect(chargeText(3)).toBe('3+');
    expect(chargeText(-1)).toBe('−');
  });
});
