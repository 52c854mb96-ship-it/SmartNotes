import { describe, expect, it } from 'vitest';
import { formula } from '../kit/formel';
import { getElement } from '../kit/grunnstoffer';
import {
  BOND_ELEMENTS,
  DEN_MAX,
  allExamples,
  analyzeBond,
  classifyDEN,
  electronsTransferred,
  exampleHasBoth,
  ionicCharacter,
  ionicFormula,
} from './model';
import {
  ALKANES,
  CONFIG_Z_MAX,
  DIPOLE_DRAW_MIN,
  HYDRIDES,
  KELVIN,
  MOLECULES,
  SHAPES,
  alkaneParts,
  aufbauFill,
  axeNotation,
  bondPolarities,
  centralElectrons,
  clampZ,
  configurationText,
  electronConfiguration,
  electronCount,
  forceParts,
  isPolarShape,
  lewisElectronCount,
  ligandLonePairs,
  modelBoilingPoint,
  moleculeShape,
  netDipole,
  newestElectron,
  orbitalBoxes,
  periodicPosition,
  shapeFor,
  shapeLayout,
  shellCounts,
  shortConfigurationText,
  spreadLabels,
  trendEstimate,
  unpairedElectrons,
  valenceElectronCount,
  vecLength,
  type ShapeId,
} from './model';

describe('bindingstype ut fra ΔEN', () => {
  it('grensene 0,5 og 1,7', () => {
    expect(classifyDEN(0)).toBe('upolar');
    expect(classifyDEN(0.49)).toBe('upolar');
    expect(classifyDEN(0.5)).toBe('polar');
    expect(classifyDEN(1.7)).toBe('polar');
    expect(classifyDEN(1.71)).toBe('ionisk');
  });

  it('lærebokeksempler', () => {
    const hh = analyzeBond('H', 'H');
    expect(hh.dEN).toBe(0);
    expect(hh.kind).toBe('upolar');
    expect(hh.negative).toBeNull();
    expect(analyzeBond('C', 'H')).toMatchObject({ dEN: 0.35, kind: 'upolar' });
    const hcl = analyzeBond('H', 'Cl');
    expect(hcl).toMatchObject({ dEN: 0.96, byDEN: 'polar', kind: 'polar', caveat: null });
    expect(hcl.negative?.symbol).toBe('Cl');
    expect(hcl.positive?.symbol).toBe('H');
    expect(analyzeBond('O', 'H')).toMatchObject({ dEN: 1.24, kind: 'polar' });
    const nacl = analyzeBond('Na', 'Cl');
    expect(nacl).toMatchObject({ dEN: 2.23, byDEN: 'ionisk', kind: 'ionisk', caveat: null });
    expect(nacl.ionic?.formula).toBe('NaCl');
    expect(analyzeBond('Mg', 'O').ionic?.formula).toBe('MgO');
    expect(analyzeBond('Ca', 'Cl').ionic?.formula).toBe('CaCl2');
    expect(analyzeBond('O', 'Al').ionic?.formula).toBe('Al2O3');
    expect(analyzeBond('Mg', 'N').ionic?.formula).toBe('Mg3N2');
    expect(analyzeBond('K', 'F').dEN).toBe(3.16);
  });

  it('er symmetrisk i rekkefølgen', () => {
    for (const [a, b] of [
      ['H', 'Cl'],
      ['Na', 'O'],
      ['Al', 'Cl'],
      ['Mg', 'Ca'],
    ] as const) {
      const x = analyzeBond(a, b);
      const y = analyzeBond(b, a);
      expect(y.dEN).toBe(x.dEN);
      expect(y.kind).toBe(x.kind);
      expect(y.ionic?.formula).toBe(x.ionic?.formula);
      expect(y.negative?.symbol).toBe(x.negative?.symbol);
    }
  });

  it('metall + ikke-metall gir ionebinding også når ΔEN ≤ 1,7, unntatt Be og Al', () => {
    const nah = analyzeBond('Na', 'H');
    expect(nah).toMatchObject({ byDEN: 'polar', kind: 'ionisk', caveat: 'metall-ikke-metall' });
    expect(nah.ionic?.formula).toBe('NaH');
    expect(nah.negative?.symbol).toBe('H');
    expect(analyzeBond('Mg', 'I')).toMatchObject({ byDEN: 'polar', kind: 'ionisk' });
    expect(analyzeBond('Al', 'Cl')).toMatchObject({ dEN: 1.55, kind: 'polar', caveat: 'polariserende' });
    expect(analyzeBond('Be', 'Cl')).toMatchObject({ kind: 'polar', caveat: 'polariserende' });
    expect(analyzeBond('Al', 'F')).toMatchObject({ kind: 'ionisk', caveat: null });
  });

  it('to ikke-metaller er kovalente selv med ΔEN over 1,7 (HF)', () => {
    expect(analyzeBond('H', 'F')).toMatchObject({ dEN: 1.78, byDEN: 'ionisk', kind: 'polar', caveat: 'ikke-metaller' });
    expect(analyzeBond('B', 'F')).toMatchObject({ kind: 'polar', caveat: 'ikke-metaller' });
  });

  it('to metaller gir metallbinding', () => {
    expect(analyzeBond('Na', 'Mg').kind).toBe('metallisk');
    expect(analyzeBond('Al', 'Al').kind).toBe('metallisk');
    expect(analyzeBond('K', 'Ca').ionic).toBeNull();
  });

  it('metall + B, C eller Si', () => {
    expect(analyzeBond('Mg', 'Si')).toMatchObject({ caveat: 'halvmetall' });
    expect(analyzeBond('K', 'C')).toMatchObject({ byDEN: 'ionisk', kind: 'polar', caveat: 'halvmetall' });
  });

  it('ionisk karakter er ca. 50 % ved ΔEN = 1,7', () => {
    expect(ionicCharacter(0)).toBe(0);
    expect(ionicCharacter(1.7)).toBeCloseTo(0.514, 3);
    expect(ionicCharacter(2.23)).toBeCloseTo(0.712, 3);
    expect(ionicCharacter(DEN_MAX)).toBeLessThan(1);
  });

  it('ioneformler og elektronoverføring', () => {
    const al2o3 = ionicFormula(getElement('Al')!, getElement('O')!)!;
    expect(al2o3).toMatchObject({ formula: 'Al2O3', nCation: 2, nAnion: 3, cationCharge: 3, anionCharge: -2 });
    expect(electronsTransferred(al2o3)).toBe(6);
    expect(ionicFormula(getElement('C')!, getElement('O')!)).toBeNull();
  });

  it('alle par kan analyseres uten feil, og ΔEN holder seg på skalaen', () => {
    for (const a of BOND_ELEMENTS)
      for (const b of BOND_ELEMENTS) {
        const r = analyzeBond(a, b);
        expect(r.dEN).toBeGreaterThanOrEqual(0);
        expect(r.dEN).toBeLessThanOrEqual(DEN_MAX);
        if (r.kind === 'ionisk') expect(r.ionic).not.toBeNull();
        if (r.kind !== 'ionisk') expect(r.ionic).toBeNull();
        // Ioniske eksempler stemmer med formelen fra ioneladningene
        if (r.kind === 'ionisk' && r.example) expect(r.example.formula).toBe(r.ionic!.formula);
      }
  });

  it('eksemplene er gyldige formler med begge grunnstoffene', () => {
    for (const [key, f, name] of allExamples()) {
      const [a, b] = key.split('-') as [string, string];
      expect(formula(f)).toBeTruthy();
      expect(exampleHasBoth(a, b)).toBe(true);
      expect(name).toMatch(/^[a-zæøå]/);
      expect([a, b]).toEqual([a, b].sort());
    }
  });
});

describe('elektronkonfigurasjon (1.2–1.3)', () => {
  it('stemmer med grunntilstanden i grunnstofftabellen for Z = 1–36', () => {
    for (let Z = 1; Z <= CONFIG_Z_MAX; Z++) {
      const mine = electronConfiguration(Z).filter((s) => s.electrons > 0);
      const kit = getElement(Z)!.subshells;
      const asMap = (xs: { n: number; l: number; electrons: number }[]) => Object.fromEntries(xs.map((s) => [`${s.n}-${s.l}`, s.electrons]));
      expect(asMap(mine)).toEqual(asMap([...kit]));
      expect(mine.reduce((s, x) => s + x.electrons, 0)).toBe(Z);
    }
  });

  it('kjente konfigurasjoner i fyllingsrekkefølge', () => {
    expect(configurationText(electronConfiguration(1))).toBe('1s¹');
    expect(configurationText(electronConfiguration(8))).toBe('1s² 2s² 2p⁴');
    expect(configurationText(electronConfiguration(11))).toBe('1s² 2s² 2p⁶ 3s¹');
    expect(configurationText(electronConfiguration(26))).toBe('1s² 2s² 2p⁶ 3s² 3p⁶ 4s² 3d⁶');
    expect(shortConfigurationText(2)).toBe('1s²');
    expect(shortConfigurationText(10)).toBe('[He] 2s² 2p⁶');
    expect(shortConfigurationText(17)).toBe('[Ne] 3s² 3p⁵');
    expect(shortConfigurationText(19)).toBe('[Ar] 4s¹');
    expect(shortConfigurationText(31)).toBe('[Ar] 4s² 3d¹⁰ 4p¹');
    expect(shortConfigurationText(36)).toBe('[Ar] 4s² 3d¹⁰ 4p⁶');
  });

  it('unntakene krom og kobber', () => {
    expect(shortConfigurationText(24)).toBe('[Ar] 4s¹ 3d⁵');
    expect(shortConfigurationText(29)).toBe('[Ar] 4s¹ 3d¹⁰');
    expect(configurationText(aufbauFill(24))).toBe('1s² 2s² 2p⁶ 3s² 3p⁶ 4s² 3d⁴');
    expect(unpairedElectrons(24)).toBe(6);
    expect(unpairedElectrons(29)).toBe(1);
    expect(valenceElectronCount(24)).toBe(1);
  });

  it('Hunds regel: enkeltvis før par', () => {
    expect(orbitalBoxes(0, 3)).toEqual([0, 0, 0]);
    expect(orbitalBoxes(2, 3)).toEqual([1, 1, 0]);
    expect(orbitalBoxes(3, 3)).toEqual([1, 1, 1]);
    expect(orbitalBoxes(4, 3)).toEqual([2, 1, 1]);
    expect(orbitalBoxes(6, 3)).toEqual([2, 2, 2]);
    expect(orbitalBoxes(6, 5)).toEqual([2, 1, 1, 1, 1]);
    expect(unpairedElectrons(7)).toBe(3);
    expect(unpairedElectrons(8)).toBe(2);
    expect(unpairedElectrons(26)).toBe(4);
    expect(unpairedElectrons(25)).toBe(5);
    expect(unpairedElectrons(10)).toBe(0);
  });

  it('skall og valenselektroner', () => {
    expect(shellCounts(11)).toEqual([2, 8, 1]);
    expect(shellCounts(20)).toEqual([2, 8, 8, 2]);
    expect(shellCounts(26)).toEqual([2, 8, 14, 2]);
    expect(shellCounts(36)).toEqual([2, 8, 18, 8]);
    expect(valenceElectronCount(17)).toBe(7);
    expect(valenceElectronCount(2)).toBe(2);
    for (let Z = 1; Z <= 20; Z++) expect(shellCounts(Z)).toEqual([...getElement(Z)!.bohrShells!]);
  });

  it('plassen i periodesystemet kan leses ut av konfigurasjonen', () => {
    for (let Z = 1; Z <= CONFIG_Z_MAX; Z++) {
      const e = getElement(Z)!;
      const pos = periodicPosition(Z);
      expect(pos.period).toBe(e.period);
      expect(pos.group).toBe(e.group);
      expect(pos.block).toBe(e.block);
      if (e.valenceElectrons !== null) expect(valenceElectronCount(Z)).toBe(e.valenceElectrons);
    }
  });

  it('det nyeste elektronet og grenseverdier', () => {
    expect(newestElectron(1)).toEqual({ subshell: 0, box: 0, spin: 'opp' });
    expect(newestElectron(8)).toEqual({ subshell: 2, box: 0, spin: 'ned' });
    expect(newestElectron(21)).toEqual({ subshell: 6, box: 0, spin: 'opp' });
    expect(clampZ(0)).toBe(1);
    expect(clampZ(99)).toBe(36);
    expect(clampZ(Number.NaN)).toBe(1);
  });
});

describe('molekylform og polaritet (1.4)', () => {
  it('VSEPR-formene', () => {
    expect(shapeFor(2, 0)).toBe('linear');
    expect(shapeFor(2, 2)).toBe('bent');
    expect(shapeFor(3, 1)).toBe('trigonal-pyramidal');
    expect(shapeFor(4, 0)).toBe('tetrahedral');
    expect(shapeFor(3, 0)).toBe('trigonal-planar');
    expect(shapeFor(9, -3)).toBe('tetrahedral');
    expect(SHAPES['trigonal-planar'].name).toBe('plan trekantet');
    expect(axeNotation(2, 2)).toBe('AX₂E₂');
    expect(axeNotation(4, 0)).toBe('AX₄');
    expect(axeNotation(3, 1)).toBe('AX₃E');
    for (const s of Object.values(SHAPES)) {
      expect(shapeFor(s.bonds, s.lonePairs)).toBe(s.id);
      const lay = shapeLayout(s.id);
      expect(lay.ligands).toHaveLength(s.bonds);
      expect(lay.lonePairs).toHaveLength(s.lonePairs);
      for (const l of lay.ligands) expect(vecLength(l.v)).toBeCloseTo(1, 9);
    }
  });

  it('tetraedervinkelen er 109,5° i rommet', () => {
    const lay = shapeLayout('tetrahedral');
    const dot = (a: number[], b: number[]) => a[0]! * b[0]! + a[1]! * b[1]! + a[2]! * b[2]!;
    for (let i = 0; i < 4; i++)
      for (let j = i + 1; j < 4; j++) expect((Math.acos(dot(lay.ligands[i]!.v, lay.ligands[j]!.v)) * 180) / Math.PI).toBeCloseTo(109.47, 1);
  });

  it('lærebokmolekylene får riktig form', () => {
    const shape = (id: string) => moleculeShape(MOLECULES.find((m) => m.id === id)!);
    expect(shape('H2O')).toBe('bent');
    expect(shape('H2S')).toBe('bent');
    expect(shape('NH3')).toBe('trigonal-pyramidal');
    expect(shape('PCl3')).toBe('trigonal-pyramidal');
    expect(shape('CH4')).toBe('tetrahedral');
    expect(shape('CCl4')).toBe('tetrahedral');
    expect(shape('CHCl3')).toBe('tetrahedral');
    expect(shape('CO2')).toBe('linear');
    expect(shape('HCN')).toBe('linear');
    expect(shape('BF3')).toBe('trigonal-planar');
    expect(shape('CH2O')).toBe('trigonal-planar');
    expect(shape('SO2')).toBe('bent-120');
    expect(MOLECULES).toHaveLength(12);
  });

  it('Lewisstrukturene bruker nøyaktig valenselektronene', () => {
    for (const m of MOLECULES) {
      const { drawn, valence } = lewisElectronCount(m);
      expect(drawn, m.id).toBe(valence);
      expect(formula(m.formula).atoms[m.center]).toBeGreaterThan(0);
      expect(m.orders).toHaveLength(m.ligands.length);
    }
    expect(ligandLonePairs('Cl', 1)).toBe(3);
    expect(ligandLonePairs('O', 2)).toBe(2);
    expect(ligandLonePairs('N', 3)).toBe(1);
    expect(ligandLonePairs('H', 1)).toBe(0);
    expect(centralElectrons(MOLECULES.find((m) => m.id === 'H2O')!)).toBe(8);
    expect(centralElectrons(MOLECULES.find((m) => m.id === 'BF3')!)).toBe(6);
  });

  it('symmetriske molekyler med polare bindinger er upolare (CO₂, CCl₄, BF₃), CHCl₃ er polart', () => {
    for (const m of MOLECULES) {
      const net = vecLength(netDipole(moleculeShape(m), bondPolarities(m.center, m.ligands), m.angle));
      if (m.dipole === 0) expect(net, m.id).toBeLessThan(1e-3);
      else expect(net, m.id).toBeGreaterThan(0.2);
    }
    expect(bondPolarities('C', ['O', 'O'])).toEqual([0.89, 0.89]);
    expect(Math.abs(bondPolarities('C', ['H'])[0]!)).toBeLessThan(DIPOLE_DRAW_MIN);
    // Dipolen i vann peker mot O (oppover i tegningen), i CHCl₃ mot kloratomene (nedover)
    expect(netDipole('bent', bondPolarities('O', ['H', 'H']), 104.5)[1]).toBeGreaterThan(0);
    expect(netDipole('tetrahedral', bondPolarities('C', ['H', 'Cl', 'Cl', 'Cl']))[1]).toBeLessThan(0);
  });

  it('fri modus: hvilke former er polare', () => {
    const polar: Record<ShapeId, boolean> = {
      linear: false,
      'bent-120': true,
      bent: true,
      'trigonal-planar': false,
      'trigonal-pyramidal': true,
      't-shaped': true,
      tetrahedral: false,
      seesaw: true,
      'square-planar': false,
    };
    for (const [id, p] of Object.entries(polar)) expect(isPolarShape(id as ShapeId), id).toBe(p);
  });
});

describe('svake bindinger og kokepunkt (1.5)', () => {
  it('datasettet: 16 hydrider, like mange elektroner i hver periode', () => {
    expect(HYDRIDES).toHaveLength(16);
    const perPeriod: Record<number, number> = { 2: 10, 3: 18, 4: 36, 5: 54 };
    for (const h of HYDRIDES) expect(electronCount(h.formula), h.formula).toBe(perPeriod[h.period]);
    expect(HYDRIDES.find((h) => h.formula === 'H2O')!.bp).toBe(100);
    expect(HYDRIDES.filter((h) => h.hbond).map((h) => h.formula).sort()).toEqual(['H2O', 'HF', 'NH3']);
  });

  it('vann, HF og NH₃ koker mye høyere enn trenden i gruppa', () => {
    for (const f of ['H2O', 'HF', 'NH3']) {
      const h = HYDRIDES.find((x) => x.formula === f)!;
      const est = trendEstimate(h.group);
      expect(h.bp - est, f).toBeGreaterThan(80);
    }
    expect(trendEstimate(16)).toBeCloseTo(-92.7, 0);
    // Gruppe 14 følger trenden: CH₄ koker lavere enn forlengelsen
    expect(HYDRIDES[0]!.bp).toBeLessThan(trendEstimate(14));
  });

  it('bidragene summerer til det målte kokepunktet og er positive', () => {
    for (const h of HYDRIDES) {
      const p = forceParts(h);
      expect(p.london + p.dipole + p.hbond - KELVIN).toBeCloseTo(h.bp, 6);
      expect(p.london).toBeGreaterThan(0);
      expect(p.dipole).toBeGreaterThanOrEqual(0);
      expect(p.hbond).toBeGreaterThanOrEqual(0);
      if (!h.hbond) expect(p.hbond).toBe(0);
      if (!h.polar) expect(p.dipole).toBe(0);
    }
  });

  it('modellen med av/på-brytere', () => {
    const water = forceParts(HYDRIDES.find((h) => h.formula === 'H2O')!);
    const all = { london: true, dipole: true, hbond: true };
    expect(modelBoilingPoint(water, all)).toBeCloseTo(100, 6);
    expect(modelBoilingPoint(water, { ...all, hbond: false })).toBeCloseTo(-92.7, 0);
    expect(modelBoilingPoint(water, { london: false, dipole: false, hbond: false })).toBeNull();
    // Med bare London-krefter koker alle hydridene i samme periode ved samme temperatur
    const only = { london: true, dipole: false, hbond: false };
    for (const h of HYDRIDES) {
      const ref = HYDRIDES.find((x) => x.group === 14 && x.period === h.period)!;
      expect(modelBoilingPoint(forceParts(h), only)).toBeCloseTo(ref.bp, 6);
    }
  });

  it('alkanene: kokepunktet stiger med kjedelengden', () => {
    expect(ALKANES.map((a) => a.carbons)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    for (let i = 1; i < ALKANES.length; i++) expect(ALKANES[i]!.bp).toBeGreaterThan(ALKANES[i - 1]!.bp);
    for (const a of ALKANES) {
      expect(formula(a.formula).atoms).toEqual({ C: a.carbons, H: 2 * a.carbons + 2 });
      expect(modelBoilingPoint(alkaneParts(a), { london: true, dipole: false, hbond: false })).toBeCloseTo(a.bp, 6);
    }
  });
});

describe('etiketter i grafer', () => {
  it('spreadLabels holder avstand og rekkefølge', () => {
    expect(spreadLabels([10, 12, 50], 10)).toEqual([10, 20, 50]);
    expect(spreadLabels([12, 10], 10)).toEqual([20, 10]);
    expect(spreadLabels([95, 96, 97], 10, 0, 100)).toEqual([80, 90, 100]);
    expect(spreadLabels([], 10)).toEqual([]);
    const r = spreadLabels([5, 5, 5, 5], 8, 0, 100);
    expect(r).toEqual([5, 13, 21, 29]);
  });
});
