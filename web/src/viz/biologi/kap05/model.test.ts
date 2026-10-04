import { describe, expect, it } from 'vitest';
import { CELL_PARTS, ORGANELLER, type Celletype } from '../kit';
import {
  CELLETYPER,
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
  formatDuration,
  formatLength,
  grossPhotosynthesis,
  hasPart,
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

  it('begrensende faktor: lys, CO₂ eller temperatur', () => {
    expect(limitingFactor(5, CO2_AIR, 25)).toBe('lys');
    expect(limitingFactor(100, 150, 25)).toBe('co2');
    expect(limitingFactor(100, 1500, 5)).toBe('temperatur');
    expect(limitingFactor(100, 1500, 42)).toBe('temperatur');
  });
});
