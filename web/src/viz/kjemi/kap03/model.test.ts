import { describe, expect, it } from 'vitest';
import { formula } from '../kit/formel';
import { LADDERS, LANDMARKS, N_A, SUBSTANCES, amounts, concentration, countingYears, dissolve, ladder, nearestIndex, particleWord } from './model';

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

  it('sammenligningene er sortert, og telletiden for 1 mol er mye lenger enn universets alder', () => {
    const v = LANDMARKS.map((l) => l.value);
    expect(v).toEqual([...v].sort((a, b) => a - b));
    expect(LANDMARKS.find((l) => l.label.startsWith('Molekyler i en vanndråpe'))!.value).toBeCloseTo(1.671e21, -18);
    expect(countingYears(N_A)).toBeCloseTo(1.908e16, -13);
    expect(countingYears(N_A) / 13.8e9).toBeGreaterThan(1e6);
  });
});

/* ---------- Balansering, begrensende reaktant og konsentrasjon ---------- */
import { checkBalance, molarMass as mm, reaction as rxn } from '../kit/formel';
import {
  BALANCE_REACTIONS,
  COEF_MAX,
  FLASKS,
  LIMITING_REACTIONS,
  PIPETTES,
  SOLUTES,
  balanceOrder,
  balanceSolution,
  balanceState,
  ceilTo,
  dilution,
  hintFor,
  limitingResult,
  niceStep,
  parsedEquation,
  percentYield,
  pictureCounts,
  solutionInfo,
  withCoefficients,
} from './model';

const byId = (id: string) => BALANCE_REACTIONS.find((r) => r.id === id)!;

describe('balansering', () => {
  it('kjente løsninger fra læreboka', () => {
    expect(balanceSolution(byId('metan'))).toEqual([1, 2, 1, 2]);
    expect(balanceSolution(byId('propan'))).toEqual([1, 5, 3, 4]);
    expect(balanceSolution(byId('glukose'))).toEqual([1, 6, 6, 6]);
    expect(balanceSolution(byId('etanol'))).toEqual([1, 3, 2, 3]);
    expect(balanceSolution(byId('jern'))).toEqual([4, 3, 2]);
    expect(balanceSolution(byId('aluminium'))).toEqual([2, 6, 2, 3]);
    expect(balanceSolution(byId('natrium'))).toEqual([2, 2, 2, 1]);
    expect(balanceSolution(byId('fotosyntese'))).toEqual([6, 6, 1, 6]);
    expect(balanceSolution(byId('ammoniakk'))).toEqual([1, 3, 2]);
    expect(balanceSolution(byId('kalkstein'))).toEqual([1, 2, 1, 1, 1]);
    expect(balanceSolution(byId('termitt'))).toEqual([2, 1, 1, 2]);
    expect(balanceSolution(byId('kobber-solv'))).toEqual([1, 2, 1, 2]);
  });

  it('alle løsningene er balansert (atomer, ladning og masse) og passer på stepperne', () => {
    for (const r of BALANCE_REACTIONS) {
      const sol = balanceSolution(r);
      const st = balanceState(r, sol);
      expect(st.balanced, r.id).toBe(true);
      expect(st.divisor).toBe(1);
      expect(st.next).toBeNull();
      expect(st.massLeft).toBeCloseTo(st.massRight, 9);
      expect(st.atomsLeft).toBe(st.atomsRight);
      expect(checkBalance(withCoefficients(r, sol)).balanced).toBe(true);
      expect(Math.max(...sol)).toBeLessThanOrEqual(COEF_MAX / 2);
    }
  });

  it('metoden: grunnstoffer i få stoffer først, H og O til slutt', () => {
    expect(balanceOrder(byId('metan'))).toEqual(['C', 'H', 'O']);
    expect(balanceOrder(byId('fotosyntese'))).toEqual(['C', 'H', 'O']);
    expect(balanceOrder(byId('aluminium'))).toEqual(['Al', 'Cl', 'H']);
    expect(balanceOrder(byId('jern'))).toEqual(['Fe', 'O']);
    expect(balanceOrder(byId('kalkstein'))).toEqual(['Ca', 'C', 'Cl', 'H', 'O']);
  });

  it('ubalansert likning: atomtelling og neste steg', () => {
    const r = byId('propan');
    const st = balanceState(r, [1, 1, 1, 1]);
    expect(st.balanced).toBe(false);
    expect(st.rows.map((x) => [x.symbol, x.left, x.right])).toEqual([
      ['C', 3, 1],
      ['H', 8, 2],
      ['O', 2, 3],
    ]);
    expect(st.next).toBe('C');
    expect(hintFor(r, [1, 1, 1, 1], 'C')).toEqual({ side: 'right', species: ['CO2(g)'] });
    expect(hintFor(r, [1, 1, 3, 1], 'C')).toBeNull();
    // Massen er ikke bevart før likningen er balansert
    expect(st.massLeft).not.toBeCloseTo(st.massRight, 1);
  });

  it('balansert, men ikke minste heltall', () => {
    const st = balanceState(byId('metan'), [2, 4, 2, 4]);
    expect(st.balanced).toBe(true);
    expect(st.divisor).toBe(2);
  });

  it('ionelikning: atomene kan stemme selv om ladningen ikke gjør det', () => {
    const st = balanceState(byId('kobber-solv'), [1, 1, 1, 1]);
    expect(st.rows.every((x) => x.ok)).toBe(true);
    expect(st.hasCharge).toBe(true);
    expect(st.chargeLeft).toBe(1);
    expect(st.chargeRight).toBe(2);
    expect(st.balanced).toBe(false);
    expect(st.next).toBe('ladning');
  });

  it('masse per side: 1 mol CH₄ + 2 mol O₂ = 80,05 g', () => {
    const st = balanceState(byId('metan'), [1, 2, 1, 2]);
    expect(st.massLeft).toBeCloseTo(16.042 + 2 * 32.0, 2);
  });
});

describe('begrensende reaktant', () => {
  it('2 H₂ + O₂: 3 mol H₂ og 2 mol O₂ gir 3 mol vann og 0,5 mol O₂ til overs', () => {
    const rx = rxn('2 H2(g) + O2(g) → 2 H2O(l)');
    const r = limitingResult(rx, [3, 2]);
    expect(r.limiting).toEqual([0]);
    expect(r.extent).toBeCloseTo(1.5, 12);
    expect(r.after).toEqual([0, 0.5, 3]);
    expect(r.exact).toBe(false);
  });

  it('det stoffet det er minst av er ikke alltid begrensende: CH₄ + 2 O₂', () => {
    const rx = rxn('CH4(g) + 2 O2(g) → CO2(g) + 2 H2O(l)');
    const r = limitingResult(rx, [2, 3]);
    expect(r.limiting).toEqual([1]);
    expect(r.after[0]).toBeCloseTo(0.5, 12);
    expect(r.after[2]).toBeCloseTo(1.5, 12);
    expect(r.after[3]).toBeCloseTo(3, 12);
  });

  it('støkiometrisk blanding og null av én reaktant', () => {
    const rx = rxn('N2(g) + 3 H2(g) → 2 NH3(g)');
    const exact = limitingResult(rx, [1, 3]);
    expect(exact.exact).toBe(true);
    expect(exact.limiting).toEqual([0, 1]);
    expect(exact.after).toEqual([0, 0, 2]);
    const none = limitingResult(rx, [0, 3]);
    expect(none.extent).toBe(0);
    expect(none.limiting).toEqual([0]);
    expect(none.after).toEqual([0, 3, 0]);
    expect(limitingResult(rx, [0, 0]).limiting).toEqual([]);
  });

  it('massen er bevart (før = etter)', () => {
    for (const L of LIMITING_REACTIONS) {
      const rx = parsedEquation(L);
      expect(checkBalance(rx).balanced, L.id).toBe(true);
      const M = [...rx.reactants, ...rx.products].map((t) => mm(t.formula));
      for (const n of [L.n0, L.nMax, [0.7, 2.3], [L.nMax[0]!, 0.1]]) {
        const r = limitingResult(rx, n);
        const before = r.before.reduce((s, v, i) => s + v * M[i]!, 0);
        const after = r.after.reduce((s, v, i) => s + v * M[i]!, 0);
        expect(after).toBeCloseTo(before, 9);
        expect(r.after.every((v) => v >= 0)).toBe(true);
      }
    }
  });

  it('jern og svovel med masser: 5,6 g Fe og 3,2 g S', () => {
    const rx = rxn('Fe(s) + S(s) → FeS(s)');
    const r = limitingResult(rx, [5.6 / mm('Fe'), 3.2 / mm('S')]);
    expect(r.limiting).toEqual([1]);
    expect(r.after[2]! * mm('FeS')).toBeCloseTo(8.775, 2);
  });

  it('partikkelbildet bevarer atomene', () => {
    for (const L of LIMITING_REACTIONS) {
      const rx = parsedEquation(L);
      const terms = [...rx.reactants, ...rx.products];
      for (const n of [L.n0, L.nMax, [1.3, 0.4]]) {
        const p = pictureCounts(rx, n);
        const count = (arr: number[]) => {
          const tally: Record<string, number> = {};
          arr.forEach((N, i) => {
            for (const [s, a] of Object.entries(formula(terms[i]!.formula).atoms)) tally[s] = (tally[s] ?? 0) + N * a;
          });
          return tally;
        };
        expect(count(p.after)).toEqual(count(p.before));
        expect(p.after.every((v) => v >= 0 && Number.isInteger(v))).toBe(true);
      }
    }
    expect(pictureCounts(rxn('2 H2(g) + O2(g) → 2 H2O(l)'), [3, 2])).toEqual({ before: [6, 4, 0], after: [0, 1, 6], extent: 3 });
  });

  it('prosentvis utbytte og pene steg', () => {
    expect(percentYield(40, 50)).toBe(80);
    expect(percentYield(1, 0)).toBeNaN();
    expect(niceStep(0.12)).toBe(0.1);
    expect(niceStep(0.3)).toBe(0.2);
    expect(niceStep(7)).toBe(5);
    expect(ceilTo(12.096, 0.1)).toBe(12.1);
    expect(ceilTo(128, 1)).toBe(128);
  });
});

describe('konsentrasjon', () => {
  it('lærebokeksempel: 5,844 g NaCl i 100 mL gir 1,00 mol/L', () => {
    const nacl = SOLUTES.find((s) => s.id === 'natriumklorid')!;
    const r = solutionInfo(mm('NaCl'), 5.844, 100, nacl.densitySlope);
    expect(r.c).toBeCloseTo(1.0, 3);
    expect(r.gPerL).toBeCloseTo(58.44, 6);
    expect(r.mgPerL).toBeCloseTo(58440, 3);
    // Tettheten til 1 mol/L NaCl er ca. 1,037 g/mL (CRC)
    expect(r.density).toBeCloseTo(1.038, 2);
    expect(r.massPercent).toBeCloseTo(5.63, 1);
  });

  it('fortynnet vannløsning: 1 mg/L er omtrent 1 ppm', () => {
    const r = solutionInfo(mm('C6H12O6'), 0.001, 1000, 0.38);
    expect(r.mgPerL).toBeCloseTo(1, 9);
    expect(r.ppm).toBeCloseTo(1, 2);
  });

  it('fortynning: c₁V₁ = c₂V₂ og stoffmengden er bevart', () => {
    const d = dilution(0.5, 25, 250);
    expect(d.c2).toBeCloseTo(0.05, 12);
    expect(d.factor).toBe(10);
    expect(d.n).toBeCloseTo(0.0125, 12);
    expect(d.c2 * 0.25).toBeCloseTo(d.n, 12);
    expect(dilution(1, 50, 50).c2).toBe(1);
  });

  it('ytterverdiene holder seg under løseligheten og gir fornuftige tall', () => {
    for (const s of SOLUTES) {
      const max = solutionInfo(mm(s.formula), s.mMax, 100, s.densitySlope);
      expect(max.gPerL).toBeLessThanOrEqual(s.id === 'kobbersulfat' ? 200 : s.id === 'natriumklorid' ? 360 : 909);
      expect(max.massPercent).toBeLessThan(30);
      expect(max.density).toBeGreaterThan(1);
    }
    expect(FLASKS[0]! >= PIPETTES[PIPETTES.length - 1]!).toBe(true);
  });
});
