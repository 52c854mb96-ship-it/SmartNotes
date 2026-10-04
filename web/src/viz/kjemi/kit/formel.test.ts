import { describe, expect, it } from 'vitest';
import {
  atomCount,
  balanceCoefficients,
  checkBalance,
  coefText,
  formula,
  formulaText,
  molarMass,
  molarMassTerms,
  parseFormula,
  parseReaction,
  reaction,
  reactionText,
} from './formel';

const atoms = (s: string) => formula(s).atoms;
const charge = (s: string) => formula(s).charge;
const error = (s: string) => {
  const r = parseFormula(s);
  return r.ok ? null : r.error;
};

describe('formler', () => {
  it('teller atomer, også med parenteser og krystallvann', () => {
    expect(atoms('H2O')).toEqual({ H: 2, O: 1 });
    expect(atoms('Ca(OH)2')).toEqual({ Ca: 1, O: 2, H: 2 });
    expect(atoms('Fe2(SO4)3')).toEqual({ Fe: 2, S: 3, O: 12 });
    expect(atoms('CuSO4·5H2O')).toEqual({ Cu: 1, S: 1, O: 9, H: 10 });
    expect(atoms('CuSO4.5H2O')).toEqual(atoms('CuSO4·5H2O'));
    expect(atoms('CuSO4*5H2O')).toEqual(atoms('CuSO4·5H2O'));
    expect(atoms('CH3COOH')).toEqual({ C: 2, H: 4, O: 2 });
    expect(atoms('[Cu(NH3)4]^2+')).toEqual({ Cu: 1, N: 4, H: 12 });
    expect(atoms('C6H12O6')).toEqual({ C: 6, H: 12, O: 6 });
    expect(atoms('Co')).toEqual({ Co: 1 });
    expect(atoms('CO')).toEqual({ C: 1, O: 1 });
    expect(atomCount('CuSO4·5H2O')).toBe(21);
  });

  it('ladning med ^, kortform og Unicode', () => {
    expect(charge('SO4^2-')).toBe(-2);
    expect(charge('NH4^+')).toBe(1);
    expect(charge('Fe^3+')).toBe(3);
    expect(charge('Fe3+')).toBe(3);
    expect(atoms('Fe3+')).toEqual({ Fe: 1 });
    expect(charge('O2-')).toBe(-2);
    expect(atoms('O2-')).toEqual({ O: 1 });
    expect(charge('NH4+')).toBe(1);
    expect(atoms('NH4+')).toEqual({ N: 1, H: 4 });
    expect(charge('SO42-')).toBe(-2);
    expect(atoms('SO42-')).toEqual({ S: 1, O: 4 });
    expect(charge('PO43-')).toBe(-3);
    expect(atoms('Cr2O72-')).toEqual({ Cr: 2, O: 7 });
    expect(charge('Cl-')).toBe(-1);
    expect(charge('OH-')).toBe(-1);
    expect(charge('H3O+')).toBe(1);
    expect(charge('MnO4-')).toBe(-1);
    expect(charge('SO4 2-')).toBe(-2);
    expect(charge('SO₄²⁻')).toBe(-2);
    expect(atoms('SO₄²⁻')).toEqual({ S: 1, O: 4 });
    expect(charge('Fe³⁺')).toBe(3);
    expect(charge('Al^-3'.replace('-3', '3+'))).toBe(3);
    expect(charge('H2O')).toBe(0);
    expect(charge('Fe+++')).toBe(3);
    expect(charge('SO4−−'.replace(/−/g, '-'))).toBe(-2);
  });

  it('tilstand og elektron', () => {
    expect(formula('NaCl(aq)').state).toBe('aq');
    expect(formula('H2O(l)').state).toBe('l');
    expect(formula('CO2(g)').state).toBe('g');
    expect(formula('CaCO3(s)').state).toBe('s');
    expect(formula('Cu^2+(aq)').charge).toBe(2);
    expect(formula('H2O').state).toBeNull();
    const e = formula('e-');
    expect(e.electron).toBe(true);
    expect(e.charge).toBe(-1);
    expect(formula('e⁻').electron).toBe(true);
  });

  it('molar masse som i lærebøkene', () => {
    expect(molarMass('H2O')).toBeCloseTo(18.02, 2);
    expect(molarMass('CO2')).toBeCloseTo(44.01, 2);
    expect(molarMass('NaCl')).toBeCloseTo(58.44, 2);
    // 40,08 + 2 · (16,00 + 1,008) = 74,096. Bøker som bruker O = 15,999 får 74,09.
    expect(molarMass('Ca(OH)2')).toBeCloseTo(74.09, 1);
    expect(molarMass('CuSO4·5H2O')).toBeCloseTo(249.7, 1);
    expect(molarMass('C6H12O6')).toBeCloseTo(180.16, 2);
    expect(molarMass('CaCO3')).toBeCloseTo(100.09, 2);
    expect(molarMass('SO4^2-')).toBeCloseTo(96.07, 2);
    expect(molarMass('e-')).toBe(0);
    const terms = molarMassTerms('C6H12O6');
    expect(terms.map((t) => [t.symbol, t.count])).toEqual([
      ['C', 6],
      ['H', 12],
      ['O', 6],
    ]);
    expect(terms.reduce((s, t) => s + t.fraction, 0)).toBeCloseTo(1, 12);
    expect(terms[2]!.fraction).toBeCloseTo(96 / 180.156, 6);
  });

  it('tekst med senket og hevet skrift', () => {
    expect(formulaText('H2O')).toBe('H₂O');
    expect(formulaText('Ca(OH)2')).toBe('Ca(OH)₂');
    expect(formulaText('CuSO4·5H2O')).toBe('CuSO₄·5H₂O');
    expect(formulaText('SO4^2-')).toBe('SO₄²⁻');
    expect(formulaText('NH4+')).toBe('NH₄⁺');
    expect(formulaText('Fe3+')).toBe('Fe³⁺');
    expect(formulaText('NaCl(aq)', true)).toBe('NaCl(aq)');
    expect(formulaText('NaCl(aq)')).toBe('NaCl');
    expect(formulaText('C12H22O11')).toBe('C₁₂H₂₂O₁₁');
    expect(formula('SO4^2-').tokens).toEqual([
      { kind: 'text', text: 'S' },
      { kind: 'text', text: 'O' },
      { kind: 'sub', text: '4' },
      { kind: 'sup', text: '2−' },
    ]);
  });

  it('forklarende feilmeldinger', () => {
    expect(error('')).toMatch(/Skriv en formel/);
    expect(error('h2o')).toMatch(/stor bokstav.*Mente du «H»/);
    expect(error('nacl')).toMatch(/Mente du «Na»/);
    expect(error('Xy2')).toMatch(/Ukjent grunnstoff «Xy»/);
    expect(error('La2O3')).toMatch(/ikke med i tabellen/);
    expect(error('Ch4')).toMatch(/Mente du CH/);
    expect(error('Ca(OH2')).toMatch(/aldri lukket/);
    expect(error('CaOH)2')).toMatch(/mangler en startparentes/);
    expect(error('Ca(OH]2')).toMatch(/passer ikke sammen/);
    expect(error('H0')).toMatch(/kan ikke være 0/);
    expect(error('2H2O')).toMatch(/starter ikke med et tall/);
    expect(error('H2O!')).toMatch(/Tegnet «!»/);
    expect(error('SO4^2x')).toMatch(/ladningen/i);
    expect(error('()')).toMatch(/tom/);
    expect(error('CuSO4·')).toMatch(/mangler en formel/);
    for (const ok of ['H2O', 'Ca(OH)2', 'SO4^2-', 'NH4+', 'CuSO4·5H2O']) expect(error(ok)).toBeNull();
  });
});

describe('reaksjonslikninger', () => {
  it('tolker tekst med koeffisienter, tilstander og likevektspil', () => {
    const r = reaction('2 H2 + O2 → 2 H2O');
    expect(r.reactants).toEqual([
      { coef: 2, formula: 'H2' },
      { coef: 1, formula: 'O2' },
    ]);
    expect(r.products).toEqual([{ coef: 2, formula: 'H2O' }]);
    expect(r.equilibrium).toBe(false);
    expect(reaction('N2 + 3H2 <=> 2NH3').equilibrium).toBe(true);
    expect(reaction('H2 + 1/2 O2 -> H2O').reactants[1]!.coef).toBe(0.5);
    expect(reaction('NH3(aq) + H2O(l) ⇌ NH4+(aq) + OH-(aq)').products.map((t) => t.formula)).toEqual(['NH4+(aq)', 'OH-(aq)']);
    expect(parseReaction('H2 + O2').ok).toBe(false);
    expect(parseReaction('H2 + → H2O').ok).toBe(false);
    const bad = parseReaction('H2 + Oo → H2O');
    expect(bad.ok ? '' : bad.error).toMatch(/Oo/);
  });

  it('skriver likningen som tekst', () => {
    expect(reactionText(reaction('2 H2 + O2 → 2 H2O'))).toBe('2 H₂ + O₂ → 2 H₂O');
    expect(reactionText(reaction('N2 + 3 H2 ⇌ 2 NH3'))).toBe('N₂ + 3 H₂ ⇌ 2 NH₃');
    expect(reactionText(reaction('Cu^2+(aq) + 2 e- → Cu(s)'), true)).toBe('Cu²⁺(aq) + 2 e⁻ → Cu(s)');
    expect(reactionText(reaction('H2 + 1/2 O2 → H2O'))).toBe('H₂ + ½ O₂ → H₂O');
    expect(coefText(1)).toBe('');
    expect(coefText(1.5)).toBe('3/2');
  });

  it('sjekker atomer og ladning', () => {
    expect(checkBalance('2 H2 + O2 → 2 H2O').balanced).toBe(true);
    const c = checkBalance('H2 + O2 → H2O');
    expect(c.balanced).toBe(false);
    expect(c.atoms).toEqual([
      { symbol: 'H', left: 2, right: 2 },
      { symbol: 'O', left: 2, right: 1 },
    ]);
    expect(checkBalance('CH4 + 2 O2 → CO2 + 2 H2O').balanced).toBe(true);
    expect(checkBalance('H2 + 1/2 O2 → H2O').balanced).toBe(true);
    expect(checkBalance('CaCO3(s) → CaO(s) + CO2(g)').balanced).toBe(true);
    // Ladning: atomene stemmer, men ikke ladningen
    const q = checkBalance('Fe^3+ + Cu → Fe^2+ + Cu^2+');
    expect(q.atomsBalanced).toBe(true);
    expect(q.chargeBalanced).toBe(false);
    expect([q.chargeLeft, q.chargeRight]).toEqual([3, 4]);
    expect(checkBalance('2 Fe^3+ + Cu → 2 Fe^2+ + Cu^2+').balanced).toBe(true);
    expect(checkBalance('Cu^2+ + 2 e- → Cu').balanced).toBe(true);
    expect(checkBalance('Ag+ + Cl- → AgCl').balanced).toBe(true);
    expect(checkBalance('Ba^2+ + SO4^2- → BaSO4').balanced).toBe(true);
    expect(checkBalance('NH3 + H2O ⇌ NH4+ + OH-').balanced).toBe(true);
  });

  it('finner minste heltallige koeffisienter', () => {
    expect(balanceCoefficients(['H2', 'O2'], ['H2O'])).toEqual([2, 1, 2]);
    expect(balanceCoefficients(['C3H8', 'O2'], ['CO2', 'H2O'])).toEqual([1, 5, 3, 4]);
    expect(balanceCoefficients(['Fe', 'O2'], ['Fe2O3'])).toEqual([4, 3, 2]);
    expect(balanceCoefficients(['C6H12O6', 'O2'], ['CO2', 'H2O'])).toEqual([1, 6, 6, 6]);
    expect(balanceCoefficients(['Al', 'HCl'], ['AlCl3', 'H2'])).toEqual([2, 6, 2, 3]);
    expect(balanceCoefficients(['MnO4-', 'Fe^2+', 'H+'], ['Mn^2+', 'Fe^3+', 'H2O'])).toEqual([1, 5, 8, 1, 5, 4]);
    expect(balanceCoefficients(['Cu^2+', 'e-'], ['Cu'])).toEqual([1, 2, 1]);
    // Umulig og flertydig
    expect(balanceCoefficients(['H2'], ['O2'])).toBeNull();
    expect(balanceCoefficients(['H2', 'O2'], ['H2O', 'H2O2'])).toBeNull();
  });
});
