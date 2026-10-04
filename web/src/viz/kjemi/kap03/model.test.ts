import { describe, expect, it } from 'vitest';
import { formula } from '../kit/formel';
import { LADDERS, LANDMARKS, N_A, SUBSTANCES, amounts, concentration, countingYears, dissolve, fmtSig, ladder, nearestIndex, particleWord } from './model';

describe('mol-brua', () => {
  it('lærebokeksempel: 100 g vann', () => {
    const a = amounts(formula('H2O'), 'm', 100);
    expect(a.M).toBeCloseTo(18.016, 3);
    expect(a.n).toBeCloseTo(5.55, 2);
    expect(a.N).toBeCloseTo(3.343e24, -21);
    expect(a.atoms).toBeCloseTo(3 * a.N, -21);
  });

  it('1 mol av et stoff veier M gram og har N_A partikler', () => {
    for (const s of SUBSTANCES) {
      const f = formula(s.formula);
      const a = amounts(f, 'n', 1);
      expect(a.m).toBeCloseTo(a.M, 9);
      expect(a.N).toBe(N_A);
    }
    expect(amounts(formula('C6H12O6'), 'n', 0.5).m).toBeCloseTo(90.08, 2);
    expect(amounts(formula('CaCO3'), 'n', 2).m).toBeCloseTo(200.18, 2);
  });

  it('alle tre veier gir samme resultat', () => {
    const f = formula('NaCl');
    const fromM = amounts(f, 'm', 58.44);
    const fromN = amounts(f, 'N', N_A);
    expect(fromM.n).toBeCloseTo(1, 9);
    expect(fromN.m).toBeCloseTo(58.44, 9);
    const back = amounts(f, 'n', fromM.n);
    expect(back.N).toBeCloseTo(fromM.N, -10);
  });

  it('konsentrasjon c = n / V', () => {
    expect(concentration(0.5, 0.25)).toBe(2);
    // 5,844 g NaCl i 100 mL gir 1,00 mol/L
    const a = amounts(formula('NaCl'), 'm', 5.844);
    expect(concentration(a.n, 0.1)).toBeCloseTo(1, 9);
  });

  it('løselighet: overskuddet blir bunnfall', () => {
    expect(dissolve(10, 1, 360)).toEqual({ dissolved: 10, excess: 0, saturated: false });
    const d = dissolve(1, 0.5, 0.013);
    expect(d.saturated).toBe(true);
    expect(d.dissolved).toBeCloseTo(0.0065, 9);
    expect(d.excess).toBeCloseTo(0.9935, 9);
    expect(dissolve(5, 1, undefined).saturated).toBe(false);
  });

  it('partiklene heter molekyler, formelenheter, atomer eller ioner', () => {
    expect(particleWord(formula('H2O'))).toBe('molekyler');
    expect(particleWord(formula('NaCl'))).toBe('formelenheter');
    expect(particleWord(formula('CaCO3'))).toBe('formelenheter');
    expect(particleWord(formula('Fe'))).toBe('atomer');
    expect(particleWord(formula('O2'))).toBe('molekyler');
    expect(particleWord(formula('SO4^2-'))).toBe('ioner');
  });
});

describe('glidebrytere og tall', () => {
  it('pene verdier', () => {
    expect(ladder(0, 1)).toEqual([1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10]);
    expect(LADDERS.m[0]).toBe(0.01);
    expect(LADDERS.m[LADDERS.m.length - 1]).toBe(1000);
    expect(LADDERS.n[0]).toBe(0.001);
    expect(LADDERS.N[0]).toBe(1e20);
    expect(LADDERS.N[LADDERS.N.length - 1]).toBe(1e26);
    expect(LADDERS.m).toContain(100);
    expect(LADDERS.n).toContain(1);
    expect(nearestIndex(LADDERS.n, 1)).toBe(LADDERS.n.indexOf(1));
    expect(LADDERS.n[nearestIndex(LADDERS.n, 0.555)]).toBe(0.6);
    expect(nearestIndex(LADDERS.m, 0)).toBe(0);
    expect(nearestIndex(LADDERS.m, 1e9)).toBe(LADDERS.m.length - 1);
  });

  it('gjeldende siffer', () => {
    expect(fmtSig(0.555)).toBe('0,555');
    expect(fmtSig(100)).toBe('100');
    expect(fmtSig(18.016)).toBe('18,0');
    expect(fmtSig(5.5506)).toBe('5,55');
    expect(fmtSig(3.343e24)).toBe('3,34 · 10²⁴');
    expect(fmtSig(0.0001661)).toBe('1,66 · 10⁻⁴');
    expect(fmtSig(0)).toBe('0');
    expect(fmtSig(Number.NaN)).toBe('–');
  });

  it('sammenligningene er sortert, og telletiden for 1 mol er mye lenger enn universets alder', () => {
    const v = LANDMARKS.map((l) => l.value);
    expect(v).toEqual([...v].sort((a, b) => a - b));
    expect(LANDMARKS.find((l) => l.label.startsWith('Vannmolekyler'))!.value).toBeCloseTo(1.671e21, -18);
    expect(countingYears(N_A)).toBeCloseTo(1.908e16, -13);
    expect(countingYears(N_A) / 13.8e9).toBeGreaterThan(1e6);
  });
});
