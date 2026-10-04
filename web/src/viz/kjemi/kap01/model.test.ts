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
