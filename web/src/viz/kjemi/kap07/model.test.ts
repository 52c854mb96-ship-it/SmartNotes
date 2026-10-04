import { describe, expect, it } from 'vitest';
import { checkBalance } from '../kit/formel';
import {
  EVERYDAY,
  INDICATORS,
  KB_NH3,
  KW,
  PROTOLYSIS_ACIDS,
  PROTOLYSIS_BASES,
  WEAK_ACIDS,
  character,
  endpoint,
  equivalenceVolume,
  fromPH,
  h3oRatio,
  indicatorColorWord,
  indicatorShift,
  nearestEveryday,
  pHFromH3O,
  pKa,
  protolysedCount,
  protolysis,
  strongAcid,
  strongBase,
  titrationCurve,
  titrationPH,
  titrationPhase,
  volumeAtPH,
  weakAcid,
  weakBase,
  weakProtolysis,
  weakProtolysisApprox,
  type TitrationSetup,
} from './model';

describe('pH-skalaen', () => {
  it('pH, pOH, [H₃O⁺] og [OH⁻] henger sammen ved 25 °C', () => {
    const s = fromPH(4);
    expect(s.h3o).toBeCloseTo(1e-4, 12);
    expect(s.oh).toBeCloseTo(1e-10, 18);
    expect(s.pOH).toBe(10);
    for (const pH of [0, 2.3, 7, 8.1, 13.5, 14]) {
      const x = fromPH(pH);
      expect(x.h3o * x.oh).toBeCloseTo(KW, 20);
      expect(x.pH + x.pOH).toBeCloseTo(14, 12);
      expect(pHFromH3O(x.h3o)).toBeCloseTo(pH, 10);
    }
  });

  it('én pH-enhet er en faktor 10', () => {
    expect(h3oRatio(3, 4)).toBeCloseTo(10, 10);
    expect(h3oRatio(2, 5)).toBeCloseTo(1000, 8);
    expect(h3oRatio(7, 7)).toBe(1);
    expect(fromPH(3).h3o / fromPH(4).h3o).toBeCloseTo(10, 10);
  });

  it('sur, nøytral og basisk', () => {
    expect(character(2)).toBe('sur');
    expect(character(7)).toBe('nøytral');
    expect(character(7.4)).toBe('basisk');
  });

  it('stoffene ligger i stigende pH og innenfor variasjonen sin', () => {
    for (let i = 1; i < EVERYDAY.length; i++) expect(EVERYDAY[i]!.pH).toBeGreaterThan(EVERYDAY[i - 1]!.pH);
    for (const s of EVERYDAY) {
      expect(s.pH).toBeGreaterThanOrEqual(s.range[0]);
      expect(s.pH).toBeLessThanOrEqual(s.range[1]);
    }
    expect(EVERYDAY.find((s) => s.id === 'vann')!.pH).toBe(7);
    expect(EVERYDAY.find((s) => s.id === 'blod')!.pH).toBeCloseTo(7.4, 5);
    expect(nearestEveryday(7.35)?.id).toBe('blod');
    expect(nearestEveryday(6)).toBeNull();
  });
});

describe('indikatorer', () => {
  it('omslagsområdene fra tabellen', () => {
    expect([INDICATORS.metyloransje.low, INDICATORS.metyloransje.high]).toEqual([3.1, 4.4]);
    expect([INDICATORS.bromtymolblatt.low, INDICATORS.bromtymolblatt.high]).toEqual([6.0, 7.6]);
    expect([INDICATORS.fenolftalein.low, INDICATORS.fenolftalein.high]).toEqual([8.2, 10.0]);
    expect([INDICATORS.lakmus.low, INDICATORS.lakmus.high]).toEqual([4.5, 8.3]);
  });

  it('fargene skifter gjennom omslagsområdet', () => {
    const btb = INDICATORS.bromtymolblatt;
    expect(indicatorShift(btb, 3)).toBe(0);
    expect(indicatorShift(btb, 6.8)).toBeCloseTo(0.5, 10);
    expect(indicatorShift(btb, 12)).toBe(1);
    expect(indicatorColorWord(btb, 3)).toBe('gul');
    expect(indicatorColorWord(btb, 7)).toBe('grønn');
    expect(indicatorColorWord(btb, 9)).toBe('blå');
    expect(indicatorColorWord(INDICATORS.fenolftalein, 7)).toBe('fargeløs');
    expect(indicatorColorWord(INDICATORS.fenolftalein, 11)).toBe('rosa');
    expect(indicatorColorWord(INDICATORS.metyloransje, 1)).toBe('rød');
  });
});

describe('sterke og svake syrer', () => {
  it('0,10 mol/L HCl har pH 1,00 og protolysegrad 100 %', () => {
    const s = strongAcid(0.1);
    expect(s.pH).toBeCloseTo(1, 6);
    expect(s.alpha).toBe(1);
    // Svært fortynnet: vannets egen protolyse gjør at pH aldri går over 7
    expect(strongAcid(1e-9).pH).toBeLessThan(7);
    expect(strongAcid(1e-9).pH).toBeGreaterThan(6.99);
  });

  it('0,10 mol/L eddiksyre: pH 2,87 og protolysegrad 1,3 %', () => {
    const s = weakAcid(0.1, 1.8e-5);
    expect(s.pH).toBeCloseTo(2.875, 2);
    expect(s.alpha * 100).toBeCloseTo(1.33, 2);
    expect(weakAcid(0.01, 1.8e-5).pH).toBeCloseTo(3.38, 2);
  });

  it('løsningen av andregradslikningen oppfyller K_a = x²/(c − x)', () => {
    for (const a of WEAK_ACIDS)
      for (const c of [1e-4, 1e-3, 0.05, 1]) {
        const x = weakProtolysis(c, a.Ka);
        expect((x * x) / (c - x)).toBeCloseTo(a.Ka, 12);
        expect(x).toBeLessThan(c);
      }
  });

  it('tilnærmingen √(K_a·c) er god for fortynnet svak syre bare når protolysegraden er liten', () => {
    const exact = weakProtolysis(0.1, 1.8e-5);
    // Under 1 % feil når protolysegraden er 1,3 %
    expect(weakProtolysisApprox(0.1, 1.8e-5) / exact).toBeLessThan(1.01);
    expect(weakProtolysisApprox(1e-4, 6.8e-4) / weakProtolysis(1e-4, 6.8e-4)).toBeGreaterThan(1.2);
  });

  it('fortynning: sterk syre +1 pH per tidobling, svak syre omtrent +0,5, og protolysegraden øker', () => {
    expect(strongAcid(0.01).pH - strongAcid(0.1).pH).toBeCloseTo(1, 6);
    const d = weakAcid(0.01, 1.8e-5).pH - weakAcid(0.1, 1.8e-5).pH;
    expect(d).toBeGreaterThan(0.45);
    expect(d).toBeLessThan(0.55);
    expect(weakAcid(0.001, 1.8e-5).alpha).toBeGreaterThan(weakAcid(0.1, 1.8e-5).alpha);
  });

  it('sterkere syre (større K_a) gir lavere pH ved samme konsentrasjon', () => {
    const sorted = [...WEAK_ACIDS].sort((a, b) => a.Ka - b.Ka);
    for (let i = 1; i < sorted.length; i++) expect(weakAcid(0.1, sorted[i]!.Ka).pH).toBeLessThan(weakAcid(0.1, sorted[i - 1]!.Ka).pH);
    expect(pKa(1.8e-5)).toBeCloseTo(4.74, 2);
  });

  it('baser: 0,10 mol/L NaOH har pH 13,00, 0,10 mol/L NH₃ har pH 11,1', () => {
    expect(strongBase(0.1).pH).toBeCloseTo(13, 6);
    const b = weakBase(0.1, KB_NH3);
    expect(b.pH).toBeCloseTo(11.12, 2);
    expect(b.alpha * 100).toBeCloseTo(1.33, 2);
  });

  it('partikkelbildet viser minst én protolysert syre når α > 0', () => {
    expect(protolysedCount(1, 30)).toBe(30);
    expect(protolysedCount(0.0133, 30)).toBe(1);
    expect(protolysedCount(0.34, 30)).toBe(10);
    expect(protolysedCount(0, 30)).toBe(0);
  });
});

describe('titrering', () => {
  const hac: TitrationSetup = { acid: 'CH3COOH', ca: 0.1, Va: 20, cb: 0.1 };
  const hcl: TitrationSetup = { acid: 'HCl', ca: 0.1, Va: 20, cb: 0.1 };

  it('ekvivalensvolumet: n(NaOH) = n(syre)', () => {
    expect(equivalenceVolume(hac)).toBeCloseTo(20, 10);
    expect(equivalenceVolume({ ...hcl, ca: 0.05, cb: 0.2 })).toBeCloseTo(5, 10);
  });

  it('HCl med NaOH: startpH 1,00, pH 7,00 ved ekvivalens og 12,30 etter', () => {
    expect(titrationPH(hcl, 0)).toBeCloseTo(1, 6);
    expect(titrationPH(hcl, 10)).toBeCloseTo(-Math.log10(0.1 / 3), 6);
    expect(titrationPH(hcl, 20)).toBeCloseTo(7, 6);
    expect(titrationPH(hcl, 30)).toBeCloseTo(14 + Math.log10(0.02), 6);
  });

  it('eddiksyre med NaOH: start 2,87, halvtitrerpunkt pH = pK_a, ekvivalens 8,72', () => {
    expect(titrationPH(hac, 0)).toBeCloseTo(2.875, 2);
    expect(titrationPH(hac, 10)).toBeCloseTo(4.74, 1);
    expect(Math.abs(titrationPH(hac, 10) - pKa(1.8e-5))).toBeLessThan(0.01);
    expect(titrationPH(hac, 20)).toBeCloseTo(8.72, 2);
    expect(titrationPH(hac, 30)).toBeCloseTo(12.3, 2);
  });

  it('kurven stiger hele veien og har et bratt sprang ved V_e', () => {
    const pts = titrationCurve(hac, 40);
    for (let i = 1; i < pts.length; i++) expect(pts[i]![1]).toBeGreaterThanOrEqual(pts[i - 1]![1] - 1e-9);
    const jump = titrationPH(hcl, 20.05) - titrationPH(hcl, 19.95);
    expect(jump).toBeGreaterThan(5);
    expect(pts.some(([v]) => v === 20)).toBe(true);
  });

  it('volumet ved en gitt pH finnes igjen på kurven', () => {
    const V = volumeAtPH(hac, 6);
    expect(titrationPH(hac, V)).toBeCloseTo(6, 4);
    expect(volumeAtPH(hac, 1)).toBe(0);
  });

  it('indikatorvalg: fenolftalein er godt for eddiksyre, metyloransje er dårlig', () => {
    const php = endpoint(hac, INDICATORS.fenolftalein);
    expect(php.verdict).toBe('god');
    expect(php.cFound).toBeCloseTo(0.1, 3);
    const mo = endpoint(hac, INDICATORS.metyloransje);
    expect(mo.verdict).toBe('dårlig');
    expect(mo.cFound).toBeLessThan(0.02);
    expect(endpoint(hac, INDICATORS.bromtymolblatt).verdict).toBe('brukbar');
  });

  it('for sterk syre med sterk base går alle de vanlige indikatorene', () => {
    for (const ind of [INDICATORS.metyloransje, INDICATORS.bromtymolblatt, INDICATORS.fenolftalein]) {
      const r = endpoint(hcl, ind);
      expect(r.verdict).toBe('god');
      expect(Math.abs(r.relError)).toBeLessThan(0.005);
    }
  });

  it('fasene i titreringen', () => {
    expect(titrationPhase(hac, 0)).toBe('start');
    expect(titrationPhase(hac, 10)).toBe('halv');
    expect(titrationPhase(hac, 5)).toBe('før');
    expect(titrationPhase(hac, 20)).toBe('ekvivalens');
    expect(titrationPhase(hac, 25)).toBe('etter');
    expect(titrationPhase(hcl, 10)).toBe('før');
  });

  it('gir endelige tall for ytterverdiene til glidebryterne', () => {
    for (const acid of ['HCl', 'CH3COOH'] as const)
      for (const ca of [0.02, 0.15])
        for (const Va of [10, 25])
          for (const cb of [0.1, 0.2]) {
            const s: TitrationSetup = { acid, ca, Va, cb };
            for (const V of [0, equivalenceVolume(s), 50]) expect(Number.isFinite(titrationPH(s, V))).toBe(true);
            for (const ind of Object.values(INDICATORS)) expect(Number.isFinite(endpoint(s, ind).cFound)).toBe(true);
          }
  });
});

describe('protolyse', () => {
  it('alle kombinasjonene er balanserte (atomer og ladning)', () => {
    for (const a of PROTOLYSIS_ACIDS)
      for (const b of PROTOLYSIS_BASES) {
        const r = protolysis(a.id, b.id);
        const check = checkBalance(r.equation);
        expect(check.balanced, r.equation).toBe(true);
      }
  });

  it('korresponderende par skiller seg med nøyaktig ett proton', () => {
    for (const a of PROTOLYSIS_ACIDS) {
      expect(checkBalance(`${a.formula} → ${a.conj.formula} + H^+`).balanced).toBe(true);
    }
    for (const b of PROTOLYSIS_BASES) {
      expect(checkBalance(`${b.formula} + H^+ → ${b.conj.formula}`).balanced).toBe(true);
    }
  });

  it('sterk syre med vann er fullstendig, svak syre med vann er en likevekt', () => {
    const hcl = protolysis('HCl', 'H2O');
    expect(hcl.arrow).toBe('→');
    expect(hcl.kind).toBe('fullstendig');
    expect(hcl.equation).toBe('HCl(aq) + H2O(l) → H3O^+(aq) + Cl^-(aq)');
    const hac = protolysis('CH3COOH', 'H2O');
    expect(hac.arrow).toBe('⇌');
    expect(hac.kind).toBe('svært lite');
    expect(hac.logK).toBeCloseTo(-4.74, 2);
  });

  it('likevekten ligger mot den svakeste syra', () => {
    expect(protolysis('NH4', 'OH').kind).toBe('fullstendig');
    expect(protolysis('CH3COOH', 'CO3').kind).toBe('fullstendig');
    expect(protolysis('NH4', 'CO3').kind).toBe('mot høyre');
    expect(protolysis('HSO4', 'H2O').kind).toBe('mot venstre');
    expect(protolysis('H2O', 'NH3').kind).toBe('svært lite');
    // Autoprotolyse: K = K_w
    expect(protolysis('H2O', 'H2O').logK).toBe(-14);
  });

  it('samme par på begge sider gir ingen endring', () => {
    expect(protolysis('NH4', 'NH3').identity).toBe(true);
    expect(protolysis('NH4', 'NH3').kind).toBe('ingen endring');
    expect(protolysis('H2O', 'OH').identity).toBe(true);
  });
});
