import { describe, expect, it } from 'vitest';
import {
  ENZYMES,
  NUTRIENTS,
  P50_STANDARD,
  STATIONS,
  TISSUE_PRESETS,
  T_OPT,
  activity,
  activityPH,
  activityT,
  airPressure,
  alveolarPO2,
  capillaryPO2,
  cardiacOutput,
  circulationTime,
  cycleTiming,
  ejectedVolume,
  endSystolicVolume,
  enzymeState,
  fragments,
  gasExchange,
  heartAt,
  nativeFraction,
  o2Content,
  p50At,
  pco2FromPh,
  saturation,
} from './model';

describe('hjertet', () => {
  it('ved 75 slag/min: 0,8 s per slag, ca. 0,1 s forkammersystole og 0,3 s systole', () => {
    const c = cycleTiming(75);
    expect(c.T).toBeCloseTo(0.8, 9);
    expect(c.atrial).toBeCloseTo(0.104, 3);
    expect(c.systole).toBeCloseTo(0.304, 3);
    expect(c.atrial + c.systole + c.diastole).toBeCloseTo(c.T, 9);
    // Høy puls: diastolen krymper mest, men blir aldri negativ
    const fast = cycleTiming(200);
    expect(fast.diastole).toBeGreaterThanOrEqual(0);
    expect(fast.diastole / fast.T).toBeLessThan(c.diastole / c.T);
  });

  it('minuttvolum ca. 5 L/min i hvile, og hele blodet rundt på ca. ett minutt', () => {
    expect(cardiacOutput(70, 70)).toBeCloseTo(4.9, 9);
    expect(circulationTime(70, 70)).toBeCloseTo(5 / 4.9, 9);
    expect(cardiacOutput(180, 115)).toBeGreaterThan(20);
  });

  it('volumet i hjertekammeret går fra EDV til ESV, og forskjellen er slagvolumet', () => {
    for (const [HR, SV] of [
      [70, 70],
      [180, 120],
      [45, 40],
    ] as const) {
      const c = cycleTiming(HR);
      let max = 0;
      let min = Infinity;
      for (let t = 0; t < c.T; t += c.T / 400) {
        const v = heartAt(t, HR, SV).volume;
        max = Math.max(max, v);
        min = Math.min(min, v);
      }
      expect(max - min).toBeCloseTo(SV, 0);
      expect(min).toBeCloseTo(endSystolicVolume(SV), 0);
    }
    expect(endSystolicVolume(70) + 70).toBe(120);
  });

  it('klaffene: seilklaffene er lukket i systolen, lommeklaffene åpne bare mens blodet presses ut', () => {
    const c = cycleTiming(70);
    const a = heartAt(c.atrial / 2, 70, 70);
    expect(a).toMatchObject({ phase: 'forkammersystole', avOpen: true, semilunarOpen: false });
    const s = heartAt(c.atrial + c.systole * 0.5, 70, 70);
    expect(s).toMatchObject({ phase: 'hjertekammersystole', avOpen: false, semilunarOpen: true });
    const iso = heartAt(c.atrial + c.systole * 0.05, 70, 70);
    expect(iso).toMatchObject({ avOpen: false, semilunarOpen: false });
    const d = heartAt(c.atrial + c.systole + c.diastole * 0.5, 70, 70);
    expect(d).toMatchObject({ phase: 'diastole', avOpen: true, semilunarOpen: false });
    // Aldri begge åpne samtidig
    for (let t = 0; t < 3 * c.T; t += 0.005) {
      const h = heartAt(t, 70, 70);
      expect(h.avOpen && h.semilunarOpen).toBe(false);
    }
  });

  it('utpumpet blod øker med ett slagvolum per slag og aldri bakover', () => {
    const c = cycleTiming(70);
    expect(ejectedVolume(0, 70, 70)).toBe(0);
    expect(ejectedVolume(c.T * 3 + 0.001, 70, 70)).toBeCloseTo(3 * 70, 0);
    let prev = 0;
    for (let t = 0; t < 4 * c.T; t += 0.01) {
      const v = ejectedVolume(t, 70, 70);
      expect(v).toBeGreaterThanOrEqual(prev - 1e-9);
      prev = v;
    }
  });
});

describe('gassutveksling', () => {
  it('metningskurven: 50 % ved P50, ca. 97 % i arterieblod og ca. 75 % i veneblod', () => {
    expect(saturation(P50_STANDARD)).toBeCloseTo(0.5, 9);
    expect(saturation(13.3)).toBeGreaterThan(0.96);
    expect(saturation(5.3)).toBeGreaterThan(0.72);
    expect(saturation(5.3)).toBeLessThan(0.78);
    expect(saturation(0)).toBe(0);
    // Monotont økende
    for (let p = 0.5; p < 14; p += 0.5) expect(saturation(p + 0.5)).toBeGreaterThan(saturation(p));
  });

  it('Bohr-effekten: lavere pH og høyere temperatur gir høyere P50', () => {
    expect(p50At(7.4, 37)).toBeCloseTo(P50_STANDARD, 9);
    expect(p50At(7.2, 37)).toBeGreaterThan(P50_STANDARD);
    expect(p50At(7.4, 40)).toBeGreaterThan(P50_STANDARD);
    expect(p50At(7.6, 37)).toBeLessThan(P50_STANDARD);
    expect(pco2FromPh(7.4)).toBeCloseTo(5.2, 1);
    expect(pco2FromPh(7.2)).toBeGreaterThan(pco2FromPh(7.4));
  });

  it('alveolene ved havet: O₂ ca. 13,3 kPa; lavere i høyden', () => {
    expect(airPressure(0)).toBeCloseTo(101.3, 9);
    expect(alveolarPO2(0)).toBeCloseTo(13.3, 0);
    expect(alveolarPO2(3000)).toBeLessThan(10);
    expect(alveolarPO2(8849)).toBeLessThan(5);
    expect(alveolarPO2(8849)).toBeGreaterThan(2.5);
  });

  it('arbeidende muskel får mer O₂, og Bohr-effekten bidrar', () => {
    const rest = gasExchange(0, TISSUE_PRESETS.hvile);
    const work = gasExchange(0, TISSUE_PRESETS.arbeid);
    expect(rest.SaO2).toBeGreaterThan(0.96);
    expect(rest.released).toBeGreaterThan(35);
    expect(rest.released).toBeLessThan(60);
    expect(rest.extraction).toBeCloseTo(0.24, 1);
    expect(work.released).toBeGreaterThan(2.5 * rest.released);
    expect(work.released).toBeGreaterThan(work.releasedNoBohr + 15);
    // Bevaring: avgitt = innhold inn − innhold ut
    expect(work.released).toBeCloseTo(work.CaO2 - work.CvO2, 9);
    expect(o2Content(1, 0)).toBeCloseTo(201, 0);
  });

  it('kapillæren i lungene: blodet når likevekt med alveolene', () => {
    expect(capillaryPO2(0, 5.3, 13.3)).toBeCloseTo(5.3, 9);
    expect(capillaryPO2(0.33, 5.3, 13.3)).toBeGreaterThan(12.7);
    expect(capillaryPO2(1, 5.3, 13.3)).toBeCloseTo(13.3, 2);
    // Vevet kan ikke ha høyere O₂-trykk enn blodet som kommer inn (Mount Everest)
    const everest = gasExchange(8849, TISSUE_PRESETS.hvile);
    expect(everest.PvO2).toBeLessThanOrEqual(everest.PaO2);
    expect(everest.released).toBeGreaterThanOrEqual(0);
  });
});

describe('enzymer', () => {
  it('pH-optimum: amylase 7, pepsin 2, trypsin og lipase 8', () => {
    expect(activityPH(ENZYMES.amylase, 7)).toBeCloseTo(1, 9);
    expect(activityPH(ENZYMES.pepsin, 2)).toBeCloseTo(1, 9);
    expect(activityPH(ENZYMES.trypsin, 8)).toBeCloseTo(1, 9);
    // Pepsin virker ikke i tynntarmen, spyttamylase ikke i magesekken
    expect(activityPH(ENZYMES.pepsin, 8)).toBeLessThan(0.001);
    expect(activityPH(ENZYMES.amylase, 2)).toBeLessThan(0.01);
    expect(activityPH(ENZYMES.trypsin, 2)).toBeLessThan(0.01);
  });

  it('temperatur: optimum rundt 40 °C, langsomt i kulde og denaturert over ca. 50 °C', () => {
    expect(T_OPT).toBeGreaterThan(37);
    expect(T_OPT).toBeLessThan(43);
    expect(activityT(T_OPT)).toBeCloseTo(1, 9);
    expect(activityT(37)).toBeGreaterThan(0.85);
    expect(activityT(5)).toBeLessThan(0.15);
    expect(activityT(5)).toBeGreaterThan(0.02);
    expect(activityT(60)).toBeLessThan(0.02);
    expect(nativeFraction(20)).toBeGreaterThan(0.99);
    expect(nativeFraction(60)).toBeLessThan(0.01);
    for (let t = 0; t <= 80; t += 1) expect(activityT(t)).toBeLessThanOrEqual(1 + 1e-9);
  });

  it('varig denaturering og tilstandene', () => {
    expect(activity(ENZYMES.pepsin, 2, 37, true)).toBe(0);
    expect(enzymeState(ENZYMES.pepsin, 2, 37)).toBe('aktivt');
    expect(enzymeState(ENZYMES.pepsin, 2, 5)).toBe('kaldt');
    expect(enzymeState(ENZYMES.pepsin, 8, 37)).toBe('feil-ph');
    expect(enzymeState(ENZYMES.pepsin, 2, 60)).toBe('denaturert');
    expect(enzymeState(ENZYMES.pepsin, 2, 20, true)).toBe('varmet');
  });
});

describe('fordøyelseskanalen', () => {
  it('nedbrytingen øker langs kanalen og er ferdig i tynntarmen', () => {
    for (const n of ['stivelse', 'protein', 'fett'] as const) {
      let prev = 0;
      for (const s of STATIONS) {
        expect(s.digested[n]).toBeGreaterThanOrEqual(prev);
        prev = s.digested[n];
      }
      expect(STATIONS.find((s) => s.id === 'tynntarm')!.digested[n]).toBe(1);
    }
    expect(STATIONS.find((s) => s.id === 'munn')!.digested.protein).toBe(0);
    expect(STATIONS.find((s) => s.id === 'magesekk')!.pH).toBe(2);
    expect(STATIONS.filter((s) => s.absorbs).map((s) => s.id)).toEqual(['tynntarm']);
  });

  it('kjedene deles i biter uten at noe forsvinner', () => {
    for (const n of Object.values(NUTRIENTS)) {
      for (const d of [0, 0.08, 0.2, 0.3, 0.5, 1]) {
        const p = fragments(n.units, d);
        expect(p.reduce((a, b) => a + b, 0)).toBe(n.units);
      }
    }
    expect(fragments(12, 0)).toEqual([12]);
    expect(fragments(12, 1)).toEqual(Array(12).fill(1));
    expect(fragments(10, 0.2)).toEqual([8, 2]);
  });
});
