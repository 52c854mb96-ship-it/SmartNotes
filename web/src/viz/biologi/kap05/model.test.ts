import { describe, expect, it } from 'vitest';
import { CELL_PARTS, ORGANELLER, type Celletype } from '../kit';
import {
  AREA_REFERENCES,
  CELLETYPER,
  CUBE_CENTRE,
  GUT,
  LUNG,
  O2_SURFACE,
  O2_USE,
  ROOT_AREA,
  SIZE_STEPS,
  alveoliCount,
  compareArea,
  gutArea,
  lungArea,
  lungAreaTwoSacs,
  maxSize,
  o2CriticalRadius,
  o2Profile,
  o2Radius,
  CO2_AIR,
  DELER,
  D_O2,
  OUTGROWTHS,
  PS,
  SAMMENLIGNING,
  compensationLight,
  defaultPart,
  diffusionReach,
  diffusionTime,
  enzymeLimited,
  formatArea,
  formatDuration,
  formatLength,
  formatVolume,
  grossPhotosynthesis,
  hasPart,
  leafExchange,
  limitingFactor,
  netO2,
  outgrowthFactor,
  respiration,
  saturationLight,
  smoothMin,
  splitCube,
  spreadLabels,
  surfaceArea,
  surfaceToVolume,
  tempFactor,
  volume,
} from './model';

const TYPES: Celletype[] = ['dyr', 'plante', 'bakterie'];
/** Tusenskillet fra Intl er et hardt mellomrom. */
const sp = (s: string) => s.replace(/\s/g, ' ');

describe('cellen', () => {
  it('alle deler i kit-ets celletyper har struktur og funksjon', () => {
    for (const t of TYPES)
      for (const id of CELL_PARTS[t]) {
        expect(DELER[id].struktur.length).toBeGreaterThan(20);
        expect(DELER[id].funksjon.length).toBeGreaterThan(20);
        expect(ORGANELLER[id].navn).toBeTruthy();
      }
  });

  it('sammenligningen stemmer med delene i figuren', () => {
    for (const row of SAMMENLIGNING)
      for (const t of TYPES) {
        const part = row.part[t];
        if (row[t] === 'nei') expect(part).toBeUndefined();
        if (part) expect(hasPart(t, part)).toBe(true);
      }
    // Prokaryot: ingen organeller med membran, men membran, ribosomer og DNA som alle celler
    const pro = SAMMENLIGNING.filter((r) => r.bakterie === 'ja').map((r) => r.navn);
    expect(pro).toEqual(expect.arrayContaining(['Cellemembran', 'Ribosomer', 'Arvestoff (DNA)', 'Cellevegg']));
    for (const n of ['Cellekjerne', 'Mitokondrier', 'Kloroplaster']) expect(SAMMENLIGNING.find((r) => r.navn === n)!.bakterie).toBe('nei');
    // Plante mot dyr: kloroplaster, vakuole og cellevegg bare i plantecellen; mitokondrier i begge
    const plantOnly = SAMMENLIGNING.filter((r) => r.plante === 'ja' && r.dyr === 'nei').map((r) => r.navn);
    expect(plantOnly).toEqual(['Kloroplaster', 'Stor vakuole', 'Cellevegg']);
    expect(SAMMENLIGNING.find((r) => r.navn === 'Mitokondrier')).toMatchObject({ dyr: 'ja', plante: 'ja' });
  });

  it('størrelser og standardvalg', () => {
    expect(CELLETYPER.bakterie.gruppe).toBe('prokaryot');
    expect(CELLETYPER.dyr.gruppe).toBe('eukaryot');
    for (const t of TYPES) {
      const c = CELLETYPER[t];
      expect(c.typisk).toBeGreaterThanOrEqual(c.min);
      expect(c.typisk).toBeLessThanOrEqual(c.max);
      expect(hasPart(t, defaultPart(t))).toBe(true);
    }
    expect(CELLETYPER.plante.typisk / CELLETYPER.bakterie.typisk).toBe(25);
  });

  it('etiketter fordeles uten overlapp og innenfor grensene', () => {
    const wanted = [100, 102, 105, 300, 301, 50];
    const pos = spreadLabels(wanted, 30, 40, 400);
    const sorted = [...pos].sort((a, b) => a - b);
    for (let i = 1; i < sorted.length; i++) expect(sorted[i]! - sorted[i - 1]!).toBeGreaterThanOrEqual(30 - 1e-9);
    for (const p of pos) {
      expect(p).toBeGreaterThanOrEqual(40);
      expect(p).toBeLessThanOrEqual(400);
    }
    // Rekkefølgen beholdes, og etiketter med god plass blir der de er
    expect(pos[5]).toBe(50);
    expect(pos[0]!).toBeLessThan(pos[1]!);
    expect(spreadLabels([10, 380, 390], 30, 0, 400)).toEqual([10, 370, 400]);
  });
});

describe('overflate og volum', () => {
  it('kube og kule: A, V og A/V = 6/d', () => {
    expect(surfaceArea('kube', 2)).toBe(24);
    expect(volume('kube', 2)).toBe(8);
    expect(surfaceToVolume('kube', 1)).toBe(6);
    expect(surfaceToVolume('kube', 3)).toBeCloseTo(2, 12);
    expect(surfaceArea('kule', 2)).toBeCloseTo(4 * Math.PI, 12);
    expect(volume('kule', 2)).toBeCloseTo((4 / 3) * Math.PI, 12);
    for (const d of [1, 10, 250]) expect(surfaceToVolume('kule', d)).toBeCloseTo(6 / d, 12);
    // Dobbel størrelse: 4 ganger overflaten, 8 ganger volumet, halvparten så stort forhold
    expect(surfaceArea('kube', 20) / surfaceArea('kube', 10)).toBeCloseTo(4, 12);
    expect(volume('kube', 20) / volume('kube', 10)).toBeCloseTo(8, 12);
  });

  it('diffusjonstid øker med kvadratet av avstanden', () => {
    expect(D_O2).toBe(2000);
    expect(diffusionTime(10)).toBeCloseTo(0.025, 12);
    expect(diffusionTime(20) / diffusionTime(10)).toBeCloseTo(4, 12);
    expect(diffusionReach(diffusionTime(37))).toBeCloseTo(37, 9);
    // 1 cm: over en time
    expect(diffusionTime(5000)).toBeGreaterThan(3600);
  });

  it('tid og lengde som tekst', () => {
    expect(formatDuration(0.025)).toBe('25 ms');
    expect(formatDuration(0.0062)).toBe('6,2 ms');
    expect(formatDuration(95)).toBe('1,6 min');
    expect(formatDuration(6250)).toBe('1,7 timer');
    expect(formatDuration(5e-6)).toBe('5,0 µs');
    expect(formatLength(2)).toBe('2 µm');
    expect(formatLength(20)).toBe('20 µm');
    expect(formatLength(1500)).toBe('1,5 mm');
    expect(formatLength(10000)).toBe('1 cm');
    expect(sp(formatArea(2400))).toBe('2 400 µm²');
    expect(formatArea(6)).toBe('6 µm²');
    expect(formatArea(Math.PI)).toBe('3,14 µm²');
    expect(formatArea(24e6)).toBe('24 mm²');
    expect(sp(formatVolume(8000))).toBe('8 000 µm³');
    expect(formatVolume(179594380)).toBe('0,18 mm³');
    expect(formatVolume(8e9)).toBe('8 mm³');
    expect(formatVolume(0.5236)).toBe('0,524 µm³');
  });

  it('oppdeling: samme volum, n ganger så stor overflate', () => {
    const one = splitCube(10, 1);
    const ten = splitCube(10, 10);
    expect(one.area).toBe(600);
    expect(ten.count).toBe(1000);
    expect(ten.volume).toBe(one.volume);
    expect(ten.area / one.area).toBeCloseTo(10, 12);
    expect(ten.ratio).toBeCloseTo(6, 12);
  });

  it('tarmtotter gir 7–10 ganger så stor overflate, rothår ca. 2–3 ganger', () => {
    const t = OUTGROWTHS.tarmtotter;
    const f = outgrowthFactor(t.density, t.radius, t.length);
    expect(f).toBeGreaterThan(6);
    expect(f).toBeLessThan(10);
    const r = OUTGROWTHS.rothar;
    const fr = outgrowthFactor(r.density, r.radius, r.length);
    expect(fr).toBeGreaterThan(2);
    expect(fr).toBeLessThan(4);
    expect(outgrowthFactor(0, 0.05, 1)).toBe(1);
  });
});

describe('oksygen inne i cellen', () => {
  it('kritisk størrelse ca. 1 mm (Krogh): R² = 6Dc₀/q', () => {
    const Rc = o2CriticalRadius();
    expect(Rc).toBeCloseTo(Math.sqrt((6 * D_O2 * O2_SURFACE) / O2_USE), 9);
    expect(maxSize('kule')).toBeGreaterThan(900);
    expect(maxSize('kule')).toBeLessThan(1300);
    expect(maxSize('kube')).toBeGreaterThan(800);
    // Kuben har like stort underskudd i midten som den ekvivalente kula
    expect(o2Radius('kube', 100) ** 2 / 6).toBeCloseTo(CUBE_CENTRE * 100 ** 2, 9);
    expect(o2Radius('kule', 100)).toBe(50);
  });

  it('små celler: nesten like mye O₂ i midten som ved overflaten', () => {
    const p = o2Profile('kule', 20);
    expect(p.centre).toBeGreaterThan(0.999);
    expect(p.anoxic).toBe(0);
    expect(p.at(1)).toBeCloseTo(1, 12);
    // Profilen er en parabel: underskuddet i midten er R²/R_c²
    const big = o2Profile('kule', 600);
    expect(big.centre).toBeCloseTo(1 - 300 ** 2 / o2CriticalRadius() ** 2, 9);
    expect(big.at(0.5)).toBeGreaterThan(big.centre);
  });

  it('akkurat ved grensen er midten tom, og over den blir det en kjerne uten O₂', () => {
    const edge = o2Profile('kule', maxSize('kule'));
    expect(edge.centre).toBeCloseTo(0, 6);
    expect(edge.anoxic).toBeLessThan(0.01);
    const p = o2Profile('kule', 2000);
    expect(p.centre).toBe(0);
    expect(p.anoxic).toBeGreaterThan(0.3);
    expect(p.anoxic).toBeLessThan(0.9);
    expect(p.anoxicVolume).toBeCloseTo(p.anoxic ** 3, 12);
    // Kontinuerlig og glatt overgang ved kjernen, 1 ved overflaten, aldri negativ
    expect(p.at(p.anoxic)).toBeCloseTo(0, 6);
    expect(p.at(p.anoxic + 0.01)).toBeLessThan(0.01);
    expect(p.at(1)).toBeCloseTo(1, 9);
    for (let u = 0; u <= 1; u += 0.05) expect(p.at(u)).toBeGreaterThanOrEqual(0);
    // Større celle: større død kjerne
    expect(o2Profile('kule', 1500).anoxic).toBeLessThan(p.anoxic);
  });

  it('glidebryterens størrelser er stigende og dekker 1 µm–2 mm', () => {
    expect(SIZE_STEPS[0]).toBe(1);
    expect(SIZE_STEPS[SIZE_STEPS.length - 1]).toBe(2000);
    for (let i = 1; i < SIZE_STEPS.length; i++) expect(SIZE_STEPS[i]!).toBeGreaterThan(SIZE_STEPS[i - 1]!);
    expect(SIZE_STEPS).toContain(20);
  });
});

describe('store overflater', () => {
  it('lungeblærer: ca. 70 m² og ca. 400 millioner blærer, mot 0,2 m² for to sekker', () => {
    const A = lungArea(LUNG.alveolus);
    expect(A).toBeGreaterThan(50);
    expect(A).toBeLessThan(100);
    const n = alveoliCount(LUNG.alveolus);
    expect(n).toBeGreaterThan(3e8);
    expect(n).toBeLessThan(5e8);
    // Samme som n · πd² (mm² → m²)
    expect((n * Math.PI * LUNG.alveolus ** 2) / 1e6).toBeCloseTo(A, 9);
    expect(lungArea(LUNG.alveolus / 2) / A).toBeCloseTo(2, 12);
    expect(lungAreaTwoSacs()).toBeCloseTo(0.2, 2);
    expect(lungArea(0)).toBe(0);
  });

  it('tynntarmen: ca. 30 m² med standard tarmtotter', () => {
    const t = OUTGROWTHS.tarmtotter;
    const A = gutArea(outgrowthFactor(t.density, t.radius, t.length));
    expect(A).toBeGreaterThan(25);
    expect(A).toBeLessThan(40);
    expect(gutArea(1)).toBeCloseTo(Math.PI * GUT.diameter * GUT.length * GUT.folds * GUT.microvilli, 9);
  });

  it('rothår: standardverdiene gir Dittmers forhold (ca. 2,7)', () => {
    const r = OUTGROWTHS.rothar;
    expect(outgrowthFactor(r.density, r.radius, r.length)).toBeCloseTo(2.7, 1);
    expect(ROOT_AREA).toBe(240);
  });

  it('sammenligning med kjente flater', () => {
    // Den største flaten som ikke er større: alltid «x ganger» med x ≥ 1 (unntatt under et A4-ark)
    expect(compareArea(80)).toMatchObject({ navn: 'en parkeringsplass', m2: 12.5 });
    expect(compareArea(80).ratio).toBeCloseTo(6.4, 12);
    expect(compareArea(30).navn).toBe('en parkeringsplass');
    expect(compareArea(72).ratio).toBeGreaterThan(1);
    expect(compareArea(0.2).navn).toBe('et A4-ark');
    expect(compareArea(650).navn).toBe('en tennisbane');
    expect(compareArea(0.03).navn).toBe('et A4-ark');
    expect(compareArea(0.03).ratio).toBeLessThan(1);
    for (const r of AREA_REFERENCES) expect(compareArea(r.m2)).toMatchObject({ navn: r.navn, ratio: 1 });
  });
});

describe('fotosyntese og celleånding', () => {
  it('enzymkurven: null ved ytterpunktene, 1 ved optimum', () => {
    expect(tempFactor(PS.Topt)).toBeCloseTo(1, 12);
    expect(tempFactor(PS.Tmax)).toBe(0);
    expect(tempFactor(50)).toBe(0);
    expect(tempFactor(10)).toBeGreaterThan(0);
    expect(tempFactor(10)).toBeLessThan(tempFactor(20));
    expect(tempFactor(40)).toBeLessThan(tempFactor(30));
  });

  it('det glattede minimumet ligger under begge og nær den minste', () => {
    expect(smoothMin(10, 100)).toBeLessThanOrEqual(10);
    expect(smoothMin(10, 100)).toBeGreaterThan(9.5);
    expect(smoothMin(100, 10)).toBeCloseTo(smoothMin(10, 100), 12);
    expect(smoothMin(0, 50)).toBe(0);
  });

  it('lyskurven: øker lineært ved lite lys og flater ut ved metning', () => {
    const P = (I: number) => grossPhotosynthesis(I, CO2_AIR, 25);
    expect(P(0)).toBe(0);
    expect(P(5) / P(2.5)).toBeCloseTo(2, 1);
    expect(P(100) - P(80)).toBeLessThan(1);
    expect(P(100)).toBeLessThanOrEqual(enzymeLimited(CO2_AIR, 25));
    // Mer CO₂ hever metningsnivået
    expect(grossPhotosynthesis(100, 1000, 25)).toBeGreaterThan(P(100) * 1.2);
    expect(saturationLight(1000, 25)).toBeGreaterThan(saturationLight(CO2_AIR, 25));
    // Ved lysmetningen er fotosyntesen 95 % av det høyeste den kan bli
    const Is = saturationLight(CO2_AIR, 25);
    expect(grossPhotosynthesis(Is, CO2_AIR, 25)).toBeCloseTo(0.95 * enzymeLimited(CO2_AIR, 25), 9);
    expect(Is).toBeGreaterThan(40);
    expect(Is).toBeLessThan(80);
  });

  it('celleånding: Q₁₀ = 2 og uavhengig av lys', () => {
    expect(respiration(25)).toBe(PS.R25);
    expect(respiration(35) / respiration(25)).toBeCloseTo(2, 12);
    expect(netO2(0, CO2_AIR, 25)).toBeCloseTo(-PS.R25, 12);
  });

  it('kompensasjonspunktet: netto O₂ er null der', () => {
    const Ic = compensationLight(CO2_AIR, 25)!;
    expect(Ic).toBeGreaterThan(2);
    expect(Ic).toBeLessThan(15);
    expect(netO2(Ic, CO2_AIR, 25)).toBeCloseTo(0, 9);
    expect(netO2(Ic * 0.5, CO2_AIR, 25)).toBeLessThan(0);
    expect(netO2(Ic * 2, CO2_AIR, 25)).toBeGreaterThan(0);
    // Varmere: mer celleånding, høyere kompensasjonspunkt
    expect(compensationLight(CO2_AIR, 35)!).toBeGreaterThan(Ic);
    // For varmt eller for lite CO₂: fotosyntesen tar aldri igjen celleåndingen
    expect(compensationLight(CO2_AIR, 44)).toBeNull();
    expect(compensationLight(20, 25)).toBeNull();
  });

  it('stoffbalansen i bladcellen: kloroplasten bruker P CO₂ og H₂O, mitokondrien lager R', () => {
    for (const [P, R] of [
      [40, 7],
      [3, 10],
      [0, 4],
      [10, 10],
    ] as const) {
      const e = leafExchange(P, R);
      // CO₂ og H₂O til kloroplasten: fra mitokondrien + det som kommer inn utenfra
      expect(e.internal + Math.max(0, e.co2In)).toBeCloseTo(P, 12);
      expect(e.internal + Math.max(0, e.h2oIn)).toBeCloseTo(P, 12);
      // CO₂ fra mitokondrien: til kloroplasten + det som går ut av cellen
      expect(e.internal + Math.max(0, -e.co2In)).toBeCloseTo(R, 12);
      // O₂ til mitokondrien: fra kloroplasten + det som tas inn utenfra
      expect(e.internal + Math.max(0, -e.o2Out)).toBeCloseTo(R, 12);
      expect(e.starch).toBeCloseTo(P - R, 12);
    }
  });

  it('begrensende faktor: lys, CO₂ eller temperatur', () => {
    expect(limitingFactor(5, CO2_AIR, 25)).toBe('lys');
    expect(limitingFactor(100, 150, 25)).toBe('co2');
    expect(limitingFactor(100, 1500, 5)).toBe('temperatur');
    expect(limitingFactor(100, 1500, 42)).toBe('temperatur');
  });
});
