import { describe, expect, it } from 'vitest';
import { checkBalance, formula } from '../kit/formel';
import { getElement } from '../kit/grunnstoffer';
import {
  ABSORBERS,
  EV,
  FLAME,
  FLAME_ELEMENTS,
  GRAV,
  GRAV_ERRORS,
  POLLUTANTS,
  UNKNOWN_SAMPLES,
  V_M,
  VIS_MAX,
  VIS_MIN,
  absorbanceFromT,
  absorptionMax,
  airUnits,
  atomicLines,
  beerLambert,
  colorWord,
  colorWordNeuter,
  epsilon,
  fitStandardCurve,
  getAbsorber,
  getPollutant,
  gravError,
  gravimetry,
  intensityAt,
  levelOf,
  limitRatio,
  limitStatus,
  logPosition,
  logValue,
  matchElement,
  measureStandards,
  measuredAbsorbance,
  niceRound,
  photonEnergy,
  photonEnergyPerMol,
  pollutantMolarMass,
  readSample,
  reagentNeeded,
  sampleLines,
  strongestLine,
  transitionEnergy,
  transmittance,
  waterUnits,
  wavelengthFromEnergy,
  wavelengthSensitivity,
} from './model';

describe('fotoner', () => {
  it('E = hc/λ: natriumlinja 589 nm', () => {
    expect(photonEnergy(589)).toBeCloseTo(3.373e-19, 21);
    expect(photonEnergyPerMol(589)).toBeCloseTo(203.1, 0);
    expect(wavelengthFromEnergy(photonEnergy(500))).toBeCloseTo(500, 8);
    // Kortere bølgelengde gir mer energi
    expect(photonEnergy(400)).toBeGreaterThan(photonEnergy(700));
  });

  it('fargenavn', () => {
    expect(colorWord(420)).toBe('fiolett');
    expect(colorWord(470)).toBe('blå');
    expect(colorWord(520)).toBe('grønn');
    expect(colorWord(589)).toBe('gul');
    expect(colorWord(610)).toBe('oransje');
    expect(colorWord(671)).toBe('rød');
    expect(colorWordNeuter(520)).toBe('grønt');
    expect(colorWordNeuter(589)).toBe('gult');
  });
});

describe('Beer–Lamberts lov', () => {
  it('A = ε·l·c og T = 10^(−A)', () => {
    expect(beerLambert(2400, 1, 2e-4)).toBeCloseTo(0.48, 10);
    expect(beerLambert(2400, 2, 2e-4)).toBeCloseTo(0.96, 10);
    expect(transmittance(1)).toBeCloseTo(0.1, 12);
    expect(transmittance(0)).toBe(1);
    expect(absorbanceFromT(0.01)).toBeCloseTo(2, 12);
    // Intensiteten gjennom hele kyvetten er transmittansen
    expect(intensityAt(2400, 2e-4, 1)).toBeCloseTo(transmittance(0.48), 12);
    expect(intensityAt(2400, 2e-4, 0)).toBe(1);
  });

  it('absorpsjonsmaksimum og ε stemmer med tabellverdiene', () => {
    const p = getAbsorber('permanganat');
    expect(absorptionMax(p).nm).toBeGreaterThanOrEqual(522);
    expect(absorptionMax(p).nm).toBeLessThanOrEqual(530);
    expect(epsilon(p, absorptionMax(p).nm)).toBeCloseTo(2400, 6);
    // Permanganat har en topp nummer to ved ca. 546 nm, nesten like høy
    expect(epsilon(p, 546) / 2400).toBeGreaterThan(0.85);
    // og absorberer nesten ikke rødt lys
    expect(epsilon(p, 700)).toBeLessThan(10);
    const cu = getAbsorber('kobberammin');
    expect(Math.abs(absorptionMax(cu).nm - 600)).toBeLessThanOrEqual(1);
    const fe = getAbsorber('jerntiocyanat');
    expect(Math.abs(absorptionMax(fe).nm - 450)).toBeLessThanOrEqual(1);
    for (const a of ABSORBERS) for (let nm = VIS_MIN; nm <= VIS_MAX; nm += 5) expect(epsilon(a, nm)).toBeLessThanOrEqual(a.epsMax + 1e-9);
  });

  it('strølys gjør at målt absorbans flater ut ved høye konsentrasjoner', () => {
    expect(measuredAbsorbance(0)).toBeCloseTo(0, 12);
    expect(measuredAbsorbance(0.5)).toBeCloseTo(0.5, 1);
    expect(measuredAbsorbance(1) / 1).toBeGreaterThan(0.97);
    expect(measuredAbsorbance(3)).toBeLessThan(2.4);
    expect(measuredAbsorbance(10)).toBeLessThan(-Math.log10(0.005 / 1.005) + 1e-9);
    // Stiger hele tiden, men stadig langsommere
    expect(measuredAbsorbance(2) - measuredAbsorbance(1)).toBeLessThan(measuredAbsorbance(1) - measuredAbsorbance(0));
  });

  it('standardkurven gir tilbake ε·l, og en prøve leses av riktig', () => {
    for (const a of ABSORBERS) {
      const nm = absorptionMax(a).nm;
      const curve = fitStandardCurve(measureStandards(a, nm, 1));
      expect(curve.slope / (a.epsMax * 1)).toBeGreaterThan(0.97);
      expect(curve.slope / (a.epsMax * 1)).toBeLessThan(1.02);
      expect(curve.r2).toBeGreaterThan(0.995);
      // Standardene ligger mellom A ≈ 0,1 og 1 ved maksimum
      expect(curve.maxA).toBeGreaterThan(0.8);
      expect(curve.maxA).toBeLessThan(1.1);
      const r = readSample(a, nm, 1, a.cDefault, curve);
      expect(r.status).toBe('ok');
      expect(r.cFound / a.cDefault).toBeGreaterThan(0.97);
      expect(r.cFound / a.cDefault).toBeLessThan(1.03);
    }
  });

  it('for sterk prøve havner utenfor standardkurven, og der stoffet ikke absorberer kan ingenting måles', () => {
    const p = getAbsorber('permanganat');
    const curve = fitStandardCurve(measureStandards(p, 525, 1));
    const strong = readSample(p, 525, 1, p.cMax, curve);
    expect(strong.status).toBe('over');
    // Strølyset gjør at en for sterk prøve gir for lav konsentrasjon
    expect(strong.cFound).toBeLessThan(p.cMax);
    const red = readSample(p, 720, 1, p.cDefault, fitStandardCurve(measureStandards(p, 720, 1)));
    expect(red.status).toBe('ingen-absorpsjon');
    expect(Number.isNaN(red.cFound)).toBe(true);
    expect(readSample(p, 525, 1, 0, curve).A).toBeCloseTo(0, 12);
  });

  it('ved absorpsjonsmaksimum betyr en liten feil i bølgelengden minst', () => {
    for (const a of ABSORBERS) {
      const nm = absorptionMax(a).nm;
      expect(wavelengthSensitivity(a, nm)).toBeLessThan(0.01);
    }
    const fe = getAbsorber('jerntiocyanat');
    expect(wavelengthSensitivity(fe, 520)).toBeGreaterThan(0.05);
  });

  it('gir endelige tall i ytterpunktene til glidebryterne', () => {
    for (const a of ABSORBERS)
      for (const nm of [VIS_MIN, VIS_MAX])
        for (const l of [0.5, 2])
          for (const c of [0, a.cMax]) {
            const curve = fitStandardCurve(measureStandards(a, nm, l));
            const r = readSample(a, nm, l, c, curve);
            expect(Number.isFinite(r.A)).toBe(true);
            expect(Number.isFinite(r.T)).toBe(true);
            expect(Number.isFinite(curve.slope)).toBe(true);
          }
  });
});

describe('emisjonsspektre', () => {
  it('bølgelengdene stemmer med energinivåene: λ = hc/ΔE (innenfor 0,5 nm)', () => {
    for (const el of FLAME_ELEMENTS)
      for (const line of atomicLines(el)) {
        const E = transitionEnergy(el, line);
        expect(E, `${el} ${line.nm}`).toBeGreaterThan(0);
        expect(Math.abs(wavelengthFromEnergy(E) - line.nm), `${el} ${line.nm}`).toBeLessThan(0.5);
      }
  });

  it('nivåene ligger under ioniseringsenergien, og grunntilstanden er 0', () => {
    for (const el of FLAME_ELEMENTS) {
      const ie = ((getElement(el)!.ionizationEnergy ?? 0) * 1000) / 6.022e23 / EV;
      const d = FLAME[el];
      expect(d.levels[0]!.eV).toBe(0);
      for (const l of d.levels) expect(l.eV).toBeLessThan(ie);
      for (const line of d.lines) {
        expect(line.nm).toBeGreaterThanOrEqual(VIS_MIN);
        expect(line.nm).toBeLessThanOrEqual(VIS_MAX + 20);
        if (!line.band) {
          expect(levelOf(el, line.from)).toBeDefined();
          expect(levelOf(el, line.to)).toBeDefined();
        }
      }
    }
  });

  it('kjente linjer: Na 589 nm, Li 671 nm, K 766 nm, Ca 423 nm, Sr 461 nm, Ba 554 nm, Cu 515–522 nm', () => {
    const has = (el: keyof typeof FLAME, nm: number) => FLAME[el].lines.some((l) => Math.abs(l.nm - nm) < 1);
    expect(has('Na', 589)).toBe(true);
    expect(has('Li', 671)).toBe(true);
    expect(has('K', 766)).toBe(true);
    expect(has('Ca', 423)).toBe(true);
    expect(has('Sr', 461)).toBe(true);
    expect(has('Ba', 553.5)).toBe(true);
    expect(has('Cu', 521.8)).toBe(true);
    expect(strongestLine('Na').nm).toBeCloseTo(589, 0);
    expect(colorWord(strongestLine('Li').nm)).toBe('rød');
    expect(colorWord(strongestLine('Na').nm)).toBe('gul');
    // Flammefargen til strontium kommer fra SrOH-båndene i det røde
    expect(strongestLine('Sr').band?.molecule).toBe('SrOH');
    expect(colorWord(strongestLine('Sr').nm)).toBe('rød');
  });

  it('ukjente prøver: riktig grunnstoff har alle linjene sine i prøven, feil grunnstoff mangler noen', () => {
    for (const s of UNKNOWN_SAMPLES) {
      for (const el of s.elements) expect(matchElement(s, el).present, `${s.id} ${el}`).toBe(true);
      for (const el of FLAME_ELEMENTS.filter((e) => !s.elements.includes(e))) {
        const m = matchElement(s, el);
        expect(m.present, `${s.id} ${el}`).toBe(false);
        expect(m.missing).not.toBeNull();
      }
      expect(sampleLines(s).length).toBe(s.elements.reduce((n, el) => n + FLAME[el].lines.length, 0));
    }
  });
});

describe('gravimetri', () => {
  it('klorid som AgCl: 0,1433 g AgCl fra 100 mL gir 355 mg/L klorid', () => {
    const r = gravimetry(GRAV.klorid, 0.1433, 100);
    expect(r.M).toBeCloseTo(143.32, 2);
    expect(r.nP).toBeCloseTo(1.0e-3, 6);
    expect(r.nA).toBeCloseTo(1.0e-3, 6);
    expect(r.mA).toBeCloseTo(0.03545, 4);
    expect(r.c).toBeCloseTo(0.01, 4);
    expect(r.mgPerL).toBeCloseTo(354.5, 0);
  });

  it('sulfat som BaSO₄ og kalsium som CaC₂O₄·H₂O', () => {
    const s = gravimetry(GRAV.sulfat, 0.2334, 200);
    expect(s.M).toBeCloseTo(233.4, 1);
    expect(s.nA).toBeCloseTo(1.0e-3, 5);
    expect(s.mgPerL).toBeCloseTo(480.3, 0);
    const ca = gravimetry(GRAV.kalsium, 0.1461, 100);
    expect(ca.M).toBeCloseTo(146.12, 1);
    expect(ca.mgPerL).toBeCloseTo(400.8, 0);
    // Standardverdiene gir realistiske vannprøver
    expect(gravimetry(GRAV.kalsium, GRAV.kalsium.m, GRAV.kalsium.V).mgPerL).toBeCloseTo(100, -1);
  });

  it('massebevaring: masse analytt = masse bunnfall · M(analytt)/M(bunnfall)', () => {
    for (const a of Object.values(GRAV)) {
      const r = gravimetry(a, 0.2, 150);
      expect(r.mA).toBeCloseTo((0.2 * r.Ma) / r.M, 12);
      expect(r.mA).toBeLessThan(0.2);
    }
  });

  it('fellingslikningene er balanserte', () => {
    for (const a of Object.values(GRAV)) expect(checkBalance(a.equation).balanced, a.equation).toBe(true);
    // Analytten og fellingsionet gir et nøytralt bunnfall
    for (const a of Object.values(GRAV)) expect(formula(a.precipitate.formula).charge).toBe(0);
  });

  it('feilkilder: fuktig bunnfall gir for høyt resultat, tap og for lite reagens for lavt', () => {
    expect(gravError('ingen', 0.1).relError).toBe(0);
    expect(gravError('fuktig', 0.106).mTrue).toBeCloseTo(0.1, 10);
    expect(gravError('fuktig', 0.1).relError).toBeGreaterThan(0);
    expect(gravError('tap', 0.1).relError).toBeLessThan(0);
    expect(gravError('underskudd', 0.1).relError).toBeLessThan(0);
    expect(Object.keys(GRAV_ERRORS)).toHaveLength(4);
  });

  it('nok fellingsreagens: n(reagens) ≥ n(analytt)', () => {
    const r = gravimetry(GRAV.klorid, 0.1433, 100);
    expect(reagentNeeded(GRAV.klorid, r.nA)).toBeCloseTo(10, 1);
  });
});

describe('vann- og luftkvalitet', () => {
  it('nitrat: 50 mg/L = 50 ppm = 8,06 · 10⁻⁴ mol/L', () => {
    const p = getPollutant('nitrat');
    const u = waterUnits(50, 'mg/L', pollutantMolarMass(p)!);
    expect(u.ppm).toBe(50);
    expect(u.ppb).toBe(50000);
    expect(u.molPerL).toBeCloseTo(8.06e-4, 6);
  });

  it('bly: 10 µg/L = 10 ppb = 0,010 mg/L', () => {
    const u = waterUnits(10, 'µg/L', 207.2);
    expect(u.mgPerL).toBeCloseTo(0.01, 12);
    expect(u.ppb).toBeCloseTo(10, 10);
    expect(u.molPerL).toBeCloseTo(4.83e-8, 9);
  });

  it('NO₂: 40 µg/m³ ≈ 21 ppb, og 1 ppm CO ≈ 1,14 mg/m³ (25 °C)', () => {
    const no2 = airUnits(40, 'µg/m³', 46.01);
    expect(no2.ppb).toBeCloseTo(21.3, 1);
    expect(no2.umolPerM3).toBeCloseTo(0.869, 3);
    const co = airUnits(1.143, 'mg/m³', 28.01);
    expect(co.ppm).toBeCloseTo(1.0, 2);
    expect(V_M).toBe(24.5);
  });

  it('svevestøv har ingen molar masse, så bare µg/m³ gir mening', () => {
    const pm = getPollutant('pm10');
    expect(pollutantMolarMass(pm)).toBeNull();
    const u = airUnits(50, 'µg/m³', null);
    expect(u.ugPerM3).toBe(50);
    expect(Number.isNaN(u.ppb)).toBe(true);
  });

  it('grenseverdiene vi bruker', () => {
    expect(getPollutant('nitrat').limits[0]!.value).toBe(50);
    expect(getPollutant('fluorid').limits[0]!.value).toBe(1.5);
    expect(getPollutant('bly').limits[0]!.value).toBe(10);
    expect(getPollutant('no2').limits.map((l) => l.value)).toEqual([200, 40]);
    expect(getPollutant('pm10').limits.map((l) => l.value)).toEqual([50, 25]);
    for (const p of POLLUTANTS) {
      expect(p.value).toBeGreaterThanOrEqual(p.min);
      expect(p.value).toBeLessThanOrEqual(p.max);
      for (const l of p.limits) {
        expect(l.value).toBeGreaterThan(p.min);
        expect(l.value).toBeLessThan(p.max);
      }
    }
  });

  it('forholdet til grenseverdien', () => {
    const lim = { value: 50, label: 'drikkevann' };
    expect(limitRatio(25, lim)).toBe(0.5);
    expect(limitStatus(limitRatio(75, lim))).toBe('over');
    expect(limitStatus(limitRatio(45, lim))).toBe('nær');
    expect(limitStatus(limitRatio(12, lim))).toBe('under');
    expect(limitStatus(limitRatio(1, lim))).toBe('langt under');
  });

  it('logaritmisk glidebryter og pene tall', () => {
    expect(logValue(1, 1000, 0)).toBe(1);
    expect(logValue(1, 1000, 1)).toBeCloseTo(1000, 9);
    expect(logValue(1, 100, 0.5)).toBeCloseTo(10, 9);
    expect(logPosition(1, 1000, logValue(1, 1000, 0.37))).toBeCloseTo(0.37, 9);
    expect(niceRound(12.34)).toBe(12);
    expect(niceRound(0.04567)).toBeCloseTo(0.046, 12);
    expect(niceRound(1234)).toBe(1200);
  });
});
