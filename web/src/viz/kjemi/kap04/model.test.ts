import { describe, expect, it } from 'vitest';
import { checkBalance, formula, molarMass, reaction } from '../kit/formel';
import {
  BOND_ENTHALPY,
  BOND_REACTIONS,
  CAL_PROCESSES,
  C_WATER,
  ENTHALPY_PRESETS,
  HESS_EXAMPLES,
  K_LOSS,
  MOLECULES,
  SALT_MAX,
  T_END,
  bondEstimate,
  bondKey,
  bondTally,
  calorimetry,
  catalysedEa,
  dHFromMeasurement,
  deltaTAt,
  enthalpyKind,
  hessHint,
  hessSum,
  measuredDeltaT,
  netChange,
  onlyDiatomic,
  pathH,
  pathPoints,
  pathStage,
  perGram,
  reverseEa,
  scaleEquation,
  staircase,
  validEa,
} from './model';

const proc = (id: string) => CAL_PROCESSES.find((p) => p.id === id)!;

describe('entalpidiagram', () => {
  it('alle likningene er balanserte og ΔH har riktig fortegn', () => {
    for (const p of ENTHALPY_PRESETS) {
      expect(checkBalance(p.equation).balanced, p.id).toBe(true);
      expect(validEa(p.dH, p.ea)).toBe(p.ea);
      if (p.catalyst) expect(p.catalyst.ea).toBeLessThan(p.ea);
    }
    expect(enthalpyKind(-890)).toBe('eksoterm');
    expect(enthalpyKind(25.7)).toBe('endoterm');
    expect(enthalpyKind(0)).toBe('termonøytral');
  });

  it('kurven starter i 0, ender i ΔH og har toppen Eₐ', () => {
    const pts = pathPoints(-890, 260);
    expect(pathH(pts, 0)).toBe(0);
    expect(pathH(pts, 1)).toBe(-890);
    expect(pathH(pts, 0.48)).toBeCloseTo(260, 9);
    const xs = Array.from({ length: 501 }, (_, i) => i / 500);
    expect(Math.max(...xs.map((x) => pathH(pts, x)))).toBeCloseTo(260, 6);
  });

  it('katalysatoren senker toppen, men ikke ΔH', () => {
    const cases = [
      ...ENTHALPY_PRESETS.filter((p) => p.catalyst).map((p) => ({ dH: p.dH, ea: p.ea, eaCat: p.catalyst!.ea })),
      // Egen reaksjon: skjematisk katalysator, også for endoterme reaksjoner med liten Eₐ
      { dH: 25.7, ea: 38, eaCat: catalysedEa(25.7, 38) },
      { dH: 400, ea: 410, eaCat: catalysedEa(400, 410) },
      { dH: -400, ea: 10, eaCat: catalysedEa(-400, 10) },
    ];
    for (const p of cases) {
      const eaCat = p.eaCat;
      const pts = pathPoints(p.dH, p.ea, eaCat);
      const xs = Array.from({ length: 1001 }, (_, i) => i / 1000);
      const H = xs.map((x) => pathH(pts, x));
      expect(H[0]).toBe(0);
      expect(H[H.length - 1]).toBe(p.dH);
      expect(Math.max(...H)).toBeCloseTo(eaCat, 6);
      expect(Math.max(...H)).toBeLessThan(p.ea);
      // Den andre toppen må ligge over produktene og under den første
      const peak2 = pts[4]!.H;
      expect(peak2).toBeGreaterThan(Math.max(0, p.dH));
      expect(peak2).toBeLessThan(pts[2]!.H);
      expect(pts[3]!.H).toBeLessThan(peak2);
    }
  });

  it('trinnet langs kurven stemmer med retningen: opp = bindinger svekkes, ned = nye bindinger dannes', () => {
    const cases = [
      ...ENTHALPY_PRESETS.map((p) => ({ dH: p.dH, ea: p.ea, eaCat: p.catalyst?.ea })),
      { dH: 80, ea: 120, eaCat: catalysedEa(80, 120) },
      { dH: -300, ea: 60, eaCat: catalysedEa(-300, 60) },
    ];
    for (const c of cases)
      for (const cat of [false, true]) {
        if (cat && c.eaCat === undefined) continue;
        const pts = pathPoints(c.dH, c.ea, cat ? c.eaCat : undefined);
        for (let i = 15; i < 86; i++) {
          const x = i / 100;
          const st = pathStage(x, cat);
          const slope = pathH(pts, x + 0.002) - pathH(pts, x - 0.002);
          if (st === 'brytes') expect(slope, `${c.dH} ${cat} ${x}`).toBeGreaterThan(0);
          if (st === 'dannes') expect(slope, `${c.dH} ${cat} ${x}`).toBeLessThan(0);
        }
      }
    expect(pathStage(0.42, true)).toBe('dannes');
    expect(pathStage(0.58, true)).toBe('brytes');
    expect(pathStage(0.5, true)).toBe('mellomprodukt');
  });

  it('fotosyntesen drives av lys og har ingen katalysatorvei i diagrammet', () => {
    const foto = ENTHALPY_PRESETS.find((p) => p.id === 'fotosyntese')!;
    expect(foto.lightDriven).toBe(true);
    expect(foto.catalyst).toBeUndefined();
    expect(ENTHALPY_PRESETS.filter((p) => p.lightDriven).every((p) => p.dH > 0)).toBe(true);
  });

  it('Eₐ må være høyere enn ΔH for en endoterm reaksjon', () => {
    expect(validEa(100, 20)).toBe(110);
    expect(validEa(-100, 20)).toBe(20);
    expect(catalysedEa(-200, 100)).toBe(50);
    expect(catalysedEa(100, 300)).toBe(200);
    expect(reverseEa(-196, 75)).toBe(271);
  });

  it('ΔH per gram', () => {
    expect(perGram('CH4(g) + 2 O2(g) → CO2(g) + 2 H2O(l)', -890, 'CH4')).toBeCloseTo(-55.5, 1);
    expect(perGram('H2(g) + ½ O2(g) → H2O(l)', -286, 'H2')).toBeCloseTo(-141.9, 1);
    expect(perGram('6 CO2(g) + 6 H2O(l) → C6H12O6(s) + 6 O2(g)', 2803, 'C6H12O6')).toBeCloseTo(15.56, 2);
    expect(perGram('2 H2O2(l) → 2 H2O(l) + O2(g)', -196, 'H2O2')).toBeCloseTo(-2.88, 2);
  });
});

describe('bindingsentalpi', () => {
  it('bindingsnavn uansett rekkefølge', () => {
    expect(bondKey('Cl', 'H', 1)).toBe('H–Cl');
    expect(bondKey('H', 'O', 1)).toBe('O–H');
    expect(bondKey('O', 'C', 2)).toBe('C=O');
    expect(() => bondKey('C', 'C', 1)).toThrow();
  });

  it('molekylene har riktige bindinger', () => {
    expect(bondTally([{ coef: 1, formula: 'CH4(g)' }])).toEqual([{ bond: 'C–H', count: 4, each: 413, energy: 1652 }]);
    expect(bondTally([{ coef: 2, formula: 'H2O(g)' }])).toEqual([{ bond: 'O–H', count: 4, each: 463, energy: 1852 }]);
    expect(bondTally([{ coef: 1, formula: 'CO2(g)' }])[0]).toMatchObject({ bond: 'C=O', count: 2 });
    expect(bondTally([{ coef: 1, formula: 'N2(g)' }])[0]).toMatchObject({ bond: 'N≡N', count: 1, energy: 945 });
    // Antall bindinger = antall ligander, og atomene i malen stemmer med formelen
    for (const [f, m] of Object.entries(MOLECULES)) {
      const atoms: Record<string, number> = { [m.center]: 1 };
      for (const l of m.ligands) atoms[l.el] = (atoms[l.el] ?? 0) + 1;
      expect(atoms, f).toEqual(formula(f).atoms);
    }
  });

  it('lærebokresultater: ΔH ≈ Σ brutte − Σ dannede', () => {
    const r = (id: string) => bondEstimate(reaction(BOND_REACTIONS.find((b) => b.id === id)!.equation));
    expect(r('hcl')).toMatchObject({ sumBroken: 678, sumFormed: 862, dH: -184 });
    expect(r('metan')).toMatchObject({ sumBroken: 2648, sumFormed: 3450, dH: -802 });
    expect(r('ammoniakk')).toMatchObject({ sumBroken: 2253, sumFormed: 2346, dH: -93 });
    expect(r('vann')).toMatchObject({ sumBroken: 1370, sumFormed: 1852, dH: -482 });
  });

  it('estimatet ligger nær tabellverdien (gass), og innenfor 2 %', () => {
    for (const b of BOND_REACTIONS) {
      const est = bondEstimate(reaction(b.equation)).dH;
      expect(Math.abs(est - b.tabulated) / Math.abs(b.tabulated), b.id).toBeLessThan(0.02);
      expect(checkBalance(b.equation).balanced).toBe(true);
    }
    expect(Object.keys(BOND_ENTHALPY)).toHaveLength(9);
  });

  it('bare H₂ + Cl₂ har bare bindinger fra toatomige molekyler (avviket er avrunding)', () => {
    const only = (id: string) => onlyDiatomic(bondEstimate(reaction(BOND_REACTIONS.find((b) => b.id === id)!.equation)));
    expect(only('hcl')).toBe(true);
    expect(only('metan')).toBe(false);
    expect(only('ammoniakk')).toBe(false);
    expect(only('vann')).toBe(false);
  });
});

describe('kalorimetri', () => {
  it('lærebokeksempel: 50 mL 1,0 M HCl + 50 mL 1,0 M NaOH gir ΔT ≈ 6,8 °C', () => {
    const r = calorimetry(proc('noytralisering'), { mSalt: 0, Vwater: 0, Vacid: 50, Vbase: 50 });
    expect(r.n).toBeCloseTo(0.05, 12);
    expect(r.m).toBe(100);
    expect(r.q).toBeCloseTo(2850, 6);
    expect(r.dT).toBeCloseTo(6.82, 2);
    expect(r.excess).toBeNull();
  });

  it('nøytralisering: den begrensende reaktanten avgjør hvor mye vann som dannes', () => {
    const r = calorimetry(proc('noytralisering'), { mSalt: 0, Vwater: 0, Vacid: 30, Vbase: 50 });
    expect(r.n).toBeCloseTo(0.03, 12);
    expect(r.excess).toBe('base');
  });

  it('salter: eksoterme gir ΔT > 0, endoterme ΔT < 0', () => {
    const naoh = calorimetry(proc('naoh'), { mSalt: 4.0, Vwater: 100, Vacid: 0, Vbase: 0 });
    expect(naoh.n).toBeCloseTo(0.1, 3);
    expect(naoh.dT).toBeCloseTo((0.1 * 44500) / (104 * C_WATER), 1);
    expect(naoh.dT).toBeGreaterThan(0);
    const nh = calorimetry(proc('nh4no3'), { mSalt: 8.0, Vwater: 100, Vacid: 0, Vbase: 0 });
    expect(nh.dT).toBeLessThan(0);
    expect(nh.dT).toBeCloseTo(-((8 / molarMass('NH4NO3')) * 25700) / (108 * C_WATER), 6);
  });

  it('uten varmetap gir målingen tilbake tabellverdien', () => {
    for (const p of CAL_PROCESSES) {
      const r = calorimetry(p, { mSalt: 10, Vwater: 100, Vacid: 50, Vbase: 50 });
      const meas = measuredDeltaT(r.dT, false);
      expect(dHFromMeasurement(r.m, meas.dT, r.n)).toBeCloseTo(p.dH, 6);
    }
  });

  it('varmetap gir for liten |ΔT| og for liten |ΔH|', () => {
    const r = calorimetry(proc('cacl2'), { mSalt: 10, Vwater: 100, Vacid: 0, Vbase: 0 });
    const meas = measuredDeltaT(r.dT, true);
    expect(Math.abs(meas.dT)).toBeLessThan(Math.abs(r.dT));
    expect(Math.abs(meas.dT)).toBeGreaterThan(0.7 * Math.abs(r.dT));
    const dH = dHFromMeasurement(r.m, meas.dT, r.n);
    expect(dH).toBeLessThan(0);
    expect(Math.abs(dH)).toBeLessThan(81.3);
    // Toppen er der dθ/dt = 0
    const eps = 1e-3;
    expect(deltaTAt(meas.t + eps, r.dT, true)).toBeLessThan(meas.dT);
    expect(deltaTAt(meas.t - eps, r.dT, true)).toBeLessThan(meas.dT);
  });

  it('alt saltet løses også ved sluttemperaturen (KNO₃ har lav løselighet i kaldt vann)', () => {
    // Løselighet for KNO₃ i g per 100 g vann (CRC): 0 °C 13,3, 10 °C 20,9, 20 °C 31,6
    const sol = (T: number) => (T <= 0 ? 13.3 : T <= 10 ? 13.3 + (T / 10) * 7.6 : 20.9 + ((T - 10) / 10) * 10.7);
    const kno3 = proc('kno3');
    expect(kno3.mMax).toBeLessThan(SALT_MAX);
    const r = calorimetry(kno3, { mSalt: kno3.mMax!, Vwater: 50, Vacid: 0, Vbase: 0 });
    const Tend = 20 + r.dT;
    expect((kno3.mMax! / 50) * 100).toBeLessThan(sol(Tend));
    // Med 15 g i 50 mL ville det ikke løst seg (31,6 g/100 g ved 20 °C, men løsningen blir rundt 1 °C)
    const tooMuch = calorimetry(kno3, { mSalt: 15, Vwater: 50, Vacid: 0, Vbase: 0 });
    expect((15 / 50) * 100).toBeGreaterThan(sol(20 + tooMuch.dT));
  });

  it('temperaturkurven starter i 0 og nærmer seg ΔT (uten tap) eller 0 (med tap)', () => {
    expect(deltaTAt(0, 10, false)).toBe(0);
    expect(deltaTAt(0, 10, true)).toBe(0);
    expect(deltaTAt(T_END, 10, false)).toBeCloseTo(10, 6);
    expect(deltaTAt(T_END, 10, true)).toBeLessThan(10 * Math.exp(-K_LOSS * T_END) * 1.2);
  });
});

describe("Hess' lov", () => {
  it('løsningene gir målreaksjonen og tabellverdien', () => {
    for (const ex of HESS_EXAMPLES) {
      const s = hessSum(ex, ex.solution);
      expect(s.matches, ex.id).toBe(true);
      expect(s.dH).toBeCloseTo(ex.target.dH, 6);
    }
    expect(hessSum(HESS_EXAMPLES[0]!, HESS_EXAMPLES[0]!.solution).dH).toBeCloseTo(-110.5, 9);
    expect(hessSum(HESS_EXAMPLES[1]!, HESS_EXAMPLES[1]!.solution).dH).toBeCloseTo(-74.8, 9);
  });

  it('feil valg gir ikke målreaksjonen', () => {
    const ex = HESS_EXAMPLES[0]!;
    const s = hessSum(ex, [
      { reverse: false, factor: 1 },
      { reverse: false, factor: 1 },
    ]);
    expect(s.matches).toBe(false);
    expect(s.dH).toBeCloseTo(-676.5, 9);
  });

  it('hint: et stoff som bare finnes i én likning, avgjør om den skal snus og hva den skal ganges med', () => {
    const so3 = HESS_EXAMPLES[2]!;
    // Likning (1) ganget med 2 og likning (2) snudd: S står feil, og bare likning (1) har S
    expect(hessHint(so3, [
      { reverse: false, factor: 2 },
      { reverse: true, factor: 1 },
    ])).toEqual({ species: 'S(s)', eq: 0, want: -1, reverse: false, factor: 1 });
    // Riktig likning (1), men likning (2) ikke halvert: SO₃ finnes bare i likning (2)
    expect(hessHint(so3, [
      { reverse: false, factor: 1 },
      { reverse: false, factor: 1 },
    ])).toEqual({ species: 'SO3(g)', eq: 1, want: 1, reverse: false, factor: 0.5 });
    const co = HESS_EXAMPLES[0]!;
    expect(hessHint(co, [
      { reverse: false, factor: 1 },
      { reverse: false, factor: 1 },
    ])).toMatchObject({ species: 'CO(g)', eq: 1, reverse: true, factor: 1 });
    expect(hessHint(co, co.solution)).toBeNull();
  });

  it('snu og gang: ΔH skifter fortegn og skaleres', () => {
    const e = HESS_EXAMPLES[2]!.given[1]!;
    const s = scaleEquation(e, { reverse: true, factor: 0.5 });
    expect(s.dH).toBeCloseTo(98.9, 9);
    expect(s.reactants).toEqual([{ coef: 1, formula: 'SO3(g)' }]);
    expect(s.products).toEqual([
      { coef: 1, formula: 'SO2(g)' },
      { coef: 0.5, formula: 'O2(g)' },
    ]);
  });

  it('det som står på begge sider strykes', () => {
    const ex = HESS_EXAMPLES[0]!;
    const s = hessSum(ex, ex.solution);
    expect(s.cancelled).toEqual([
      { formula: 'O2(g)', coef: 0.5 },
      { formula: 'CO2(g)', coef: 1 },
    ]);
    expect(s.net.reactants).toEqual([
      { coef: 1, formula: 'C(s)' },
      { coef: 0.5, formula: 'O2(g)' },
    ]);
    expect(s.net.products).toEqual([{ coef: 1, formula: 'CO(g)' }]);
    expect(netChange([ex.target]).get('CO(g)')).toBe(1);
  });

  it('energitrappa: C + O₂ → CO₂ → CO + ½ O₂', () => {
    const ex = HESS_EXAMPLES[0]!;
    const lv = staircase(ex, ex.solution);
    expect(lv.map((l) => l.H)).toEqual([0, -393.5, -110.5]);
    expect(lv[0]!.species).toEqual([
      { formula: 'C(s)', coef: 1 },
      { formula: 'O2(g)', coef: 1 },
    ]);
    expect(lv[1]!.species).toEqual([{ formula: 'CO2(g)', coef: 1 }]);
    expect(lv[2]!.species).toEqual([
      { formula: 'O2(g)', coef: 0.5 },
      { formula: 'CO(g)', coef: 1 },
    ]);
  });

  it('energitrappa for metan har ingen negative mengder og samme sluttnivå', () => {
    const ex = HESS_EXAMPLES[1]!;
    const lv = staircase(ex, ex.solution);
    expect(lv.map((l) => l.H)).toEqual([0, -393.5, -965.1, -74.8]);
    expect(lv[0]!.species).toEqual([
      { formula: 'C(s)', coef: 1 },
      { formula: 'H2(g)', coef: 2 },
      { formula: 'O2(g)', coef: 2 },
    ]);
    for (const l of lv) expect(l.species.every((s) => s.coef > 0)).toBe(true);
  });
});
