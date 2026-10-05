import { describe, expect, it } from 'vitest';
import { checkBalance, formula, molarMass, reaction } from '../kit/formel';
import { element } from '../kit/grunnstoffer';
import {
  ANIONS,
  CATIONS,
  CONCENTRATIONS,
  PROPERTIES,
  REDOX_METALS,
  TREND_ELEMENTS,
  againstTrend,
  expectedTrend,
  groupSeries,
  ieAnomaly,
  innerElectrons,
  mixSolutions,
  normalizedValue,
  oxNumberText,
  pairInfo,
  periodSeries,
  propertyRange,
  propertyValue,
  redox,
  shieldedCharge,
  spectatorIons,
  unitParticles,
  zoomCounts,
} from './model';

describe('periodiske trender', () => {
  it('Z = 1–54 med alle tre egenskapene', () => {
    expect(TREND_ELEMENTS).toHaveLength(54);
    expect(TREND_ELEMENTS.map((e) => e.Z)).toEqual(Array.from({ length: 54 }, (_, i) => i + 1));
    for (const e of TREND_ELEMENTS) {
      expect(propertyValue(e, 'radius')).toBeGreaterThan(0);
      expect(propertyValue(e, 'ie')).toBeGreaterThan(0);
      if (['He', 'Ne', 'Ar'].includes(e.symbol)) expect(propertyValue(e, 'en')).toBeNull();
      else expect(propertyValue(e, 'en')).toBeGreaterThan(0);
    }
    expect(Object.keys(PROPERTIES)).toEqual(['radius', 'ie', 'en']);
  });

  it('atomradius minker bortover periode 3 og øker nedover gruppe 1 og 17', () => {
    const p3 = periodSeries(3).filter((e) => e.group !== 18);
    for (let i = 1; i < p3.length; i++) expect(propertyValue(p3[i]!, 'radius')!).toBeLessThan(propertyValue(p3[i - 1]!, 'radius')!);
    for (const g of [1, 17]) {
      const s = groupSeries(g).filter((e) => e.symbol !== 'H');
      for (let i = 1; i < s.length; i++) expect(propertyValue(s[i]!, 'radius')!).toBeGreaterThan(propertyValue(s[i - 1]!, 'radius')!);
    }
  });

  it('ioniseringsenergi og elektronegativitet: kjente ytterpunkter', () => {
    expect(propertyRange('ie')).toEqual([403, 2372]);
    expect(propertyRange('en')).toEqual([0.82, 3.98]);
    expect(element('He').ionizationEnergy).toBe(2372);
    expect(normalizedValue(element('F'), 'en')).toBe(1);
    expect(normalizedValue(element('He'), 'en')).toBeNull();
    // Nedover gruppe 1 synker ioniseringsenergien
    const g1 = groupSeries(1);
    for (let i = 2; i < g1.length; i++) expect(g1[i]!.ionizationEnergy).toBeLessThan(g1[i - 1]!.ionizationEnergy);
  });

  it('unntakene i ioniseringsenergi: gruppe 13 og 16', () => {
    for (const s of ['B', 'Al', 'Ga', 'In']) expect(ieAnomaly(element(s)), s).toBe('p-elektron');
    for (const s of ['O', 'S', 'Se']) expect(ieAnomaly(element(s)), s).toBe('paret');
    // Te har høyere ioniseringsenergi enn Sb i dataene, så ingen dupp der
    expect(ieAnomaly(element('Te'))).toBeNull();
    for (const s of ['C', 'N', 'F', 'Ne', 'Na', 'P', 'Cl']) expect(ieAnomaly(element(s)), s).toBeNull();
  });

  it('trendene og grunnstoffene som går mot dem (fra dataene)', () => {
    expect(expectedTrend('radius', 'periode')).toBe(-1);
    expect(expectedTrend('radius', 'gruppe')).toBe(1);
    expect(expectedTrend('ie', 'periode')).toBe(1);
    expect(expectedTrend('en', 'gruppe')).toBe(-1);
    const sym = (xs: { e: { symbol: string } }[]) => xs.map((x) => x.e.symbol);
    // Bortover periode 2 og 3: bare unntakene i gruppe 13 og 16
    expect(sym(againstTrend(periodSeries(2), 'ie', 'periode'))).toEqual(['B', 'O']);
    expect(sym(againstTrend(periodSeries(3), 'ie', 'periode'))).toEqual(['Al', 'S']);
    expect(againstTrend(periodSeries(1), 'ie', 'periode')).toEqual([]);
    expect(againstTrend(periodSeries(3), 'radius', 'periode')).toEqual([]);
    expect(againstTrend(periodSeries(3), 'en', 'periode')).toEqual([]);
    // Nedover gruppene: radiusen øker alltid, men Ga har høyere elektronegativitet enn Al og Ge enn Si
    for (const g of [1, 2, 13, 14, 15, 16, 17, 18]) expect(againstTrend(groupSeries(g), 'radius', 'gruppe'), `gruppe ${g}`).toEqual([]);
    expect(sym(againstTrend(groupSeries(13), 'en', 'gruppe'))).toEqual(['Ga']);
    expect(sym(againstTrend(groupSeries(14), 'en', 'gruppe'))).toEqual(['Ge']);
    expect(againstTrend(groupSeries(17), 'en', 'gruppe')).toEqual([]);
    expect(againstTrend(groupSeries(1), 'ie', 'gruppe')).toEqual([]);
  });

  it('skjerming: Z minus indre elektroner', () => {
    expect(innerElectrons(element('Na'))).toBe(10);
    expect(shieldedCharge(element('Na'))).toBe(1);
    expect(shieldedCharge(element('Cl'))).toBe(7);
    expect(shieldedCharge(element('K'))).toBe(1);
    expect(shieldedCharge(element('Fe'))).toBe(2);
  });
});

describe('redoks og spenningsrekka', () => {
  it('rekkefølgen etter E°', () => {
    expect(REDOX_METALS.map((m) => m.symbol)).toEqual(['Mg', 'Al', 'Zn', 'Fe', 'Pb', 'Cu', 'Ag']);
    for (let i = 1; i < REDOX_METALS.length; i++) expect(REDOX_METALS[i]!.E0).toBeGreaterThan(REDOX_METALS[i - 1]!.E0);
  });

  it('sink i kobber(II)løsning', () => {
    const r = redox('Zn', 'Cu');
    expect(r.reacts).toBe(true);
    expect(r.total).toBe('Zn(s) + Cu^2+(aq) → Zn^2+(aq) + Cu(s)');
    expect(r.oxidation).toBe('Zn(s) → Zn^2+(aq) + 2 e-');
    expect(r.reduction).toBe('Cu^2+(aq) + 2 e- → Cu(s)');
    expect(r.electrons).toBe(2);
  });

  it('balanserte likninger med ulike ladninger', () => {
    expect(redox('Al', 'Cu').total).toBe('2 Al(s) + 3 Cu^2+(aq) → 2 Al^3+(aq) + 3 Cu(s)');
    expect(redox('Al', 'Cu').electrons).toBe(6);
    expect(redox('Cu', 'Ag').total).toBe('Cu(s) + 2 Ag^+(aq) → Cu^2+(aq) + 2 Ag(s)');
    expect(redox('Al', 'Ag').total).toBe('Al(s) + 3 Ag^+(aq) → Al^3+(aq) + 3 Ag(s)');
  });

  it('alle kombinasjoner er balansert (atomer og ladning), og bare metaller til venstre reagerer', () => {
    for (const m of REDOX_METALS)
      for (const x of REDOX_METALS) {
        const r = redox(m.symbol, x.symbol);
        expect(checkBalance(r.total).balanced, r.total).toBe(true);
        expect(checkBalance(r.oxidation).balanced).toBe(true);
        expect(checkBalance(r.reduction).balanced).toBe(true);
        expect(r.reacts).toBe(m.E0 < x.E0);
        if (m.symbol === x.symbol) expect(r.same).toBe(true);
        // Elektroner avgitt = elektroner tatt opp
        expect(r.a * m.charge).toBe(r.b * x.charge);
      }
    expect(redox('Cu', 'Zn').reacts).toBe(false);
    expect(redox('Ag', 'Cu').reacts).toBe(false);
  });

  it('oksidasjonstall med romertall', () => {
    expect(oxNumberText(0)).toBe('0');
    expect(oxNumberText(2)).toBe('+II');
    expect(oxNumberText(3)).toBe('+III');
    expect(oxNumberText(-1)).toBe('−I');
  });
});

describe('fellingsreaksjoner', () => {
  it('løselighetstabellen: kjente bunnfall og farger', () => {
    expect(pairInfo('Ag', 'Cl')).toMatchObject({ kind: 'tungtløselig', precipitate: { formula: 'AgCl', color: 'hvitt' } });
    expect(pairInfo('Ag', 'I').precipitate?.color).toBe('lysegult');
    expect(pairInfo('Pb', 'I').precipitate).toMatchObject({ formula: 'PbI2', color: 'gult' });
    expect(pairInfo('Cu', 'OH').precipitate).toMatchObject({ formula: 'Cu(OH)2', color: 'blått' });
    expect(pairInfo('Fe', 'OH').precipitate).toMatchObject({ formula: 'Fe(OH)3', color: 'rustbrunt' });
    expect(pairInfo('Ba', 'SO4').precipitate).toMatchObject({ formula: 'BaSO4', color: 'hvitt' });
    expect(pairInfo('Na', 'Cl').kind).toBe('løselig');
    expect(pairInfo('Ba', 'OH').kind).toBe('løselig');
    for (const c of CATIONS) expect(pairInfo(c.id, 'NO3').kind, c.id).toBe('løselig');
    for (const a of ANIONS) {
      expect(pairInfo('Na', a.id).kind).toBe('løselig');
      expect(pairInfo('K', a.id).kind).toBe('løselig');
    }
  });

  it('nettolikningene og de fullstendige likningene er balansert', () => {
    for (const c of CATIONS)
      for (const a of ANIONS) {
        const info = pairInfo(c.id, a.id);
        if (!info.net) continue;
        expect(checkBalance(info.net).balanced, `${c.id}-${a.id} netto`).toBe(true);
        expect(checkBalance(info.full!).balanced, `${c.id}-${a.id} full`).toBe(true);
      }
    const net = pairInfo('Pb', 'I').net!;
    expect(net.reactants.map((t) => [t.coef, t.formula])).toEqual([
      [1, 'Pb^2+'],
      [2, 'I^-'],
    ]);
    expect(pairInfo('Fe', 'OH').net!.reactants[1]!.coef).toBe(3);
    expect(pairInfo('Pb', 'I').full!.products.map((t) => t.formula)).toEqual(['PbI2', 'NaNO3']);
    expect(checkBalance(reaction('Pb(NO3)2 + 2 NaI → PbI2 + 2 NaNO3')).balanced).toBe(true);
  });

  it('tilskuerioner', () => {
    expect(spectatorIons('Ag', 'Cl').sort()).toEqual(['NO3^-', 'Na^+'].sort());
    expect(spectatorIons('Na', 'Cl').sort()).toEqual(['Cl^-', 'NO3^-', 'Na^+'].sort());
    expect(spectatorIons('Ba', 'NO3').sort()).toEqual(['Ba^2+', 'NO3^-', 'Na^+'].sort());
  });

  it('mengde bunnfall: AgCl og PbI₂ ved 0,10 mol/L (50 mL + 50 mL)', () => {
    const agcl = mixSolutions('Ag', 'Cl', 0.1);
    expect(agcl.precipitates).toBe(true);
    expect(agcl.x).toBeCloseTo(0.05, 4);
    expect(agcl.mass).toBeCloseTo(0.05 * 0.1 * molarMass('AgCl'), 3);
    expect(agcl.limiting).toBeNull();
    const pbi2 = mixSolutions('Pb', 'I', 0.1);
    expect(pbi2.limiting).toBe('anion');
    expect(pbi2.x).toBeLessThan(0.025);
    expect(pbi2.x).toBeGreaterThan(0.02);
    // Bevaring: det som er igjen i løsningen oppfyller Ksp
    const rest = (0.05 - pbi2.x) * (0.05 - 2 * pbi2.x) ** 2;
    expect(rest / 9.8e-9).toBeCloseTo(1, 3);
  });

  it('lite løselige salter feller ut bare når konsentrasjonen er høy nok', () => {
    expect(mixSolutions('Ca', 'SO4', 0.01).precipitates).toBe(false);
    const caso4 = mixSolutions('Ca', 'SO4', 0.1);
    expect(caso4.precipitates).toBe(true);
    expect(caso4.x).toBeCloseTo(0.05 - Math.sqrt(4.93e-5), 6);
    expect(mixSolutions('Pb', 'Cl', 0.01).precipitates).toBe(false);
    expect(mixSolutions('Pb', 'Cl', 0.5).precipitates).toBe(true);
    // Tungtløselige feller ut selv ved den laveste konsentrasjonen
    expect(mixSolutions('Ag', 'Cl', CONCENTRATIONS[0]).precipitates).toBe(true);
    expect(mixSolutions('Fe', 'OH', CONCENTRATIONS[0]).fraction).toBeGreaterThan(0.99);
  });

  it('CuI og Fe(OH)₃: to formelenheter bunnfall per nettolikning', () => {
    // 50 mL + 50 mL av 0,10 mol/L: 0,005 mol av hvert ion. I⁻ er begrensende: 2 Cu²⁺ + 4 I⁻ → 2 CuI + I₂ gir 0,0025 mol CuI.
    const cui = mixSolutions('Cu', 'I', 0.1);
    expect(cui.limiting).toBe('anion');
    expect(cui.n).toBeCloseTo(0.0025, 9);
    expect(cui.mass).toBeCloseTo(0.0025 * molarMass('CuI'), 6);
    expect(cui.mass).toBeCloseTo(0.476, 3);
    // CO₃²⁻ er begrensende: 2 Fe³⁺ + 3 CO₃²⁻ + 3 H₂O → 2 Fe(OH)₃ + 3 CO₂ gir 0,005 · 2/3 mol Fe(OH)₃.
    const feoh = mixSolutions('Fe', 'CO3', 0.1);
    expect(feoh.limiting).toBe('anion');
    expect(feoh.n).toBeCloseTo((0.005 * 2) / 3, 9);
    expect(feoh.mass).toBeCloseTo(0.356, 3);
    // Ag₂O: én formelenhet per 2 Ag⁺ + 2 OH⁻
    expect(mixSolutions('Ag', 'OH', 0.5).n).toBeCloseTo(0.0125, 4);
  });

  it('partikkelbildet: bunnfallet har samme sammensetning som formelen, og ladningene går opp', () => {
    for (const c of CATIONS)
      for (const a of ANIONS) {
        const info = pairInfo(c.id, a.id);
        const u = unitParticles(c.id, a.id);
        if (!info.net) {
          expect(u).toBeNull();
          continue;
        }
        expect(u, `${c.id}-${a.id}`).not.toBeNull();
        // a og b er koeffisientene foran kationet og anionet i nettolikningen
        const coef = (f: string) => info.net!.reactants.find((t) => t.formula === f)?.coef;
        expect(u!.a, `${c.id}-${a.id}`).toBe(coef(c.formula));
        expect(u!.b, `${c.id}-${a.id}`).toBe(coef(a.formula));
        const p = info.precipitate;
        if (!p) {
          expect(u!.cationsInSolid + u!.anionsInSolid + u!.fromWater).toBe(0);
          continue;
        }
        const atoms: Record<string, number> = {};
        let charge = 0;
        const add = (f: string, n: number) => {
          if (n === 0) return;
          const pf = formula(f);
          for (const [sym, k] of Object.entries(pf.atoms)) atoms[sym] = (atoms[sym] ?? 0) + n * k;
          charge += n * pf.charge;
        };
        add(u!.cationInSolid, u!.cationsInSolid);
        add(u!.anionInSolid, u!.anionsInSolid);
        add('OH^-', u!.fromWater);
        const want = Object.fromEntries(Object.entries(formula(p.formula).atoms).map(([sym, k]) => [sym, k * (p.units ?? 1)]));
        expect(atoms, `${c.id}-${a.id}`).toEqual(want);
        expect(charge, `${c.id}-${a.id}`).toBe(0);
        expect(u!.anionsInSolid + u!.anionsConverted, `${c.id}-${a.id}`).toBe(u!.b);
      }
    expect(unitParticles('Cu', 'I')).toMatchObject({ cationInSolid: 'Cu^+', anionsInSolid: 2, anionsConverted: 2, convertedTo: 'I2' });
    expect(unitParticles('Fe', 'CO3')).toMatchObject({ cationsInSolid: 2, fromWater: 6, anionsConverted: 3, convertedTo: 'CO2' });
    expect(unitParticles('Ag', 'OH')).toMatchObject({ anionInSolid: 'O^2-', anionsInSolid: 1, convertedTo: 'H2O' });
    expect(unitParticles('Fe', 'I')).toMatchObject({ cationsConverted: 2, cationAfter: 'Fe^2+', anionsConverted: 2 });
  });

  it('utsnittet: hele enheter, og det begrensende ionet brukes opp', () => {
    expect(zoomCounts('Pb', 'I', mixSolutions('Pb', 'I', 0.5))).toEqual({ ions: 6, units: 3 });
    expect(zoomCounts('Cu', 'I', mixSolutions('Cu', 'I', 0.1))).toEqual({ ions: 8, units: 2 });
    expect(zoomCounts('Fe', 'CO3', mixSolutions('Fe', 'CO3', 0.1))).toEqual({ ions: 6, units: 2 });
    expect(zoomCounts('Fe', 'I', mixSolutions('Fe', 'I', 0.1))).toEqual({ ions: 6, units: 3 });
    expect(zoomCounts('Ca', 'SO4', mixSolutions('Ca', 'SO4', 0.001)).units).toBe(0);
    expect(zoomCounts('Na', 'Cl', mixSolutions('Na', 'Cl', 0.1))).toEqual({ ions: 6, units: 0 });
    for (const c of CATIONS)
      for (const a of ANIONS) {
        const u = unitParticles(c.id, a.id);
        const z = zoomCounts(c.id, a.id, mixSolutions(c.id, a.id, 0.5));
        if (!u) continue;
        expect(z.units * u.a, `${c.id}-${a.id}`).toBeLessThanOrEqual(z.ions);
        expect(z.units * u.b, `${c.id}-${a.id}`).toBeLessThanOrEqual(z.ions);
      }
  });

  it('alle kombinasjoner og konsentrasjoner gir gyldige tall', () => {
    for (const c of CATIONS)
      for (const a of ANIONS)
        for (const conc of CONCENTRATIONS) {
          const r = mixSolutions(c.id, a.id, conc);
          for (const v of [r.x, r.n, r.mass, r.fraction]) expect(Number.isFinite(v)).toBe(true);
          expect(r.fraction).toBeGreaterThanOrEqual(0);
          expect(r.fraction).toBeLessThanOrEqual(1);
          if (!pairInfo(c.id, a.id).precipitate) expect(r.precipitates).toBe(false);
        }
  });
});
