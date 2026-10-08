import { describe, expect, it } from 'vitest';
import {
  ALPHA_RANGE,
  ALPHA_RANGE_AIR,
  BACKGROUND,
  BETA,
  GAMMA_HALF,
  MATERIALS,
  MATERIAL_IDS,
  MEASURE_TIME,
  RADIATIONS,
  RADIATION_IDS,
  SHEET,
  alphaRangeLeft,
  alphaRangeUsed,
  alphaReachesThroughAir,
  arrivalTimes,
  countUpTo,
  emissions,
  expectedRate,
  halfThickness,
  maxThickness,
  netRate,
  registered,
  seededRandom,
  shownPassing,
  stopDepth,
  stoppingThickness,
  thicknessForFraction,
  timeSinceLastClick,
  trackDraws,
  transmission,
} from './model-skjerming';

/** Alle tykkelsene glidebryteren kan stå på for en stråling og et materiale. */
function sliderValues(rad: (typeof RADIATION_IDS)[number], mat: (typeof MATERIAL_IDS)[number]): number[] {
  const { step } = MATERIALS[mat];
  const n = Math.round(maxThickness(rad, mat) / step);
  return Array.from({ length: n + 1 }, (_, i) => Math.round(i * step * 1000) / 1000);
}

describe('oppsettet', () => {
  it('α-kilden står nærmere røret enn rekkevidden i luft, β og γ lenger unna', () => {
    expect(RADIATIONS.alfa.gap).toBeLessThan(ALPHA_RANGE_AIR);
    expect(alphaReachesThroughAir(RADIATIONS.alfa.gap)).toBe(true);
    expect(alphaReachesThroughAir(RADIATIONS.beta.gap)).toBe(false);
    expect(alphaReachesThroughAir(50)).toBe(false);
  });

  it('skjermen får plass mellom kilden og røret', () => {
    for (const rad of RADIATION_IDS)
      for (const mat of MATERIAL_IDS) {
        const max = maxThickness(rad, mat);
        expect(max).toBeGreaterThan(0);
        expect(max).toBeLessThanOrEqual(RADIATIONS[rad].gap - 10);
        expect(max).toBeLessThanOrEqual(MATERIALS[mat].max);
      }
    // β og γ: hele blyskalaen (5 cm) får plass
    expect(maxThickness('gamma', 'bly')).toBe(50);
    expect(maxThickness('beta', 'bly')).toBe(50);
    expect(maxThickness('alfa', 'bly')).toBe(20);
    expect(maxThickness('beta', 'papir')).toBe(5);
  });

  it('glidebryteren for papir går i hele ark', () => {
    expect(MATERIALS.papir.step).toBe(SHEET);
    expect(sliderValues('beta', 'papir')).toHaveLength(51);
  });
});

describe('α-stråling', () => {
  it('når fram uten skjerm', () => {
    for (const mat of MATERIAL_IDS) expect(transmission('alfa', mat, 0)).toBe(1);
  });

  it('stoppes av ett papirark og av det tynneste laget aluminium og bly', () => {
    expect(transmission('alfa', 'papir', SHEET)).toBe(0);
    expect(transmission('alfa', 'aluminium', MATERIALS.aluminium.step)).toBe(0);
    expect(transmission('alfa', 'bly', MATERIALS.bly.step)).toBe(0);
  });

  it('har brukt opp tre firedeler av rekkevidden i 3 cm luft', () => {
    expect(RADIATIONS.alfa.gap).toBe(30);
    expect(alphaRangeUsed('papir', 0)).toBeCloseTo(0.75, 10);
    expect(alphaRangeLeft('papir')).toBeCloseTo(ALPHA_RANGE.papir / 4, 10);
    expect(stoppingThickness('alfa', 'papir')).toBeCloseTo(0.0125, 10);
    // Litt tynnere enn rekkevidden slipper gjennom, litt tykkere stopper
    expect(transmission('alfa', 'papir', 0.008)).toBe(1);
    expect(transmission('alfa', 'papir', 0.017)).toBe(0);
    expect(transmission('alfa', 'papir', 0.0125)).toBeCloseTo(0.5, 1);
  });

  it('rekkevidden er omtrent like mange gram per areal i alle stoffene (litt lenger i bly)', () => {
    const mass = (mat: (typeof MATERIAL_IDS)[number]) => (ALPHA_RANGE[mat] / 10) * MATERIALS[mat].density * 1000; // mg/cm²
    expect(mass('papir')).toBeCloseTo(4, 0);
    expect(mass('aluminium')).toBeGreaterThan(5);
    expect(mass('aluminium')).toBeLessThan(mass('bly'));
    // Luft: 4 cm · 1,2 mg/cm³ ≈ 4,8 mg/cm²
    expect((ALPHA_RANGE_AIR / 10) * 1.2).toBeCloseTo(4.8, 5);
  });
});

describe('β-stråling', () => {
  it('halveres for hver halveringstykkelse', () => {
    for (const mat of MATERIAL_IDS) {
      const h = BETA[mat].half;
      expect(transmission('beta', mat, h)).toBeCloseTo(0.5, 10);
      expect(transmission('beta', mat, 2 * h)).toBeCloseTo(0.25, 10);
      expect(transmission('beta', mat, 0.3 + h) / transmission('beta', mat, 0.3)).toBeCloseTo(0.5, 10);
    }
    expect(halfThickness('beta', 'aluminium')).toBe(0.4);
  });

  it('stoppes helt av noen millimeter aluminium og én millimeter bly', () => {
    expect(transmission('beta', 'aluminium', 3.9)).toBeGreaterThan(0);
    expect(transmission('beta', 'aluminium', 3.9)).toBeLessThan(0.002);
    expect(transmission('beta', 'aluminium', 4)).toBe(0);
    expect(transmission('beta', 'aluminium', 10)).toBe(0);
    expect(transmission('beta', 'bly', 1)).toBe(0);
    expect(stoppingThickness('beta', 'aluminium')).toBe(4);
  });

  it('svekkes lite av papir: 10 ark slipper gjennom omtrent 60 %', () => {
    expect(transmission('beta', 'papir', 1)).toBeCloseTo(0.587, 2);
    expect(transmission('beta', 'papir', 5)).toBeGreaterThan(0.05);
    expect(transmission('beta', 'papir', 5)).toBeLessThan(0.1);
  });

  it('rekkevidden er omtrent 10 halveringstykkelser og samme masse per areal i alle stoffene', () => {
    for (const mat of MATERIAL_IDS) {
      const { half, range } = BETA[mat];
      expect(range / half).toBeGreaterThan(9.5);
      expect(range / half).toBeLessThan(11.5);
      // ca. 1,1 g/cm²
      expect((range / 10) * MATERIALS[mat].density).toBeGreaterThan(1);
      expect((range / 10) * MATERIALS[mat].density).toBeLessThan(1.2);
    }
  });
});

describe('γ-stråling', () => {
  it('halveres for hver centimeter bly og blir aldri helt borte', () => {
    expect(transmission('gamma', 'bly', 0)).toBe(1);
    expect(transmission('gamma', 'bly', 10)).toBeCloseTo(0.5, 12);
    expect(transmission('gamma', 'bly', 20)).toBeCloseTo(0.25, 12);
    expect(transmission('gamma', 'bly', 50)).toBeCloseTo(1 / 32, 12);
    expect(transmission('gamma', 'bly', 50)).toBeGreaterThan(0);
    expect(stoppingThickness('gamma', 'bly')).toBeNull();
  });

  it('640 klikk/min halveres til 320, 160, 80, 40 og 20', () => {
    expect([0, 10, 20, 30, 40, 50].map((d) => netRate('gamma', 'bly', d))).toEqual([640, 320, 160, 80, 40, 20].map((v) => expect.closeTo(v, 9)));
    // Med 5 cm bly er signalet like stort som bakgrunnen
    expect(netRate('gamma', 'bly', 50)).toBeCloseTo(BACKGROUND, 9);
    expect(expectedRate('gamma', 'bly', 50)).toBeCloseTo(2 * BACKGROUND, 9);
  });

  it('det er massen som skjermer: halveringstykkelsen er omtrent like mange gram per areal', () => {
    const mass = MATERIAL_IDS.map((m) => (GAMMA_HALF[m] / 10) * MATERIALS[m].density);
    for (const m of mass) {
      expect(m).toBeGreaterThan(10);
      expect(m).toBeLessThan(13);
    }
    // Aluminium må være 4–5 ganger så tykt som bly
    expect(GAMMA_HALF.aluminium / GAMMA_HALF.bly).toBeGreaterThan(4);
    expect(GAMMA_HALF.aluminium / GAMMA_HALF.bly).toBeLessThan(5);
  });

  it('tykkelsen som trengs for å komme ned til en andel', () => {
    expect(thicknessForFraction('gamma', 'bly', 0.5)).toBeCloseTo(10, 10);
    expect(thicknessForFraction('gamma', 'bly', 0.01)).toBeCloseTo(66.4, 1);
    expect(thicknessForFraction('beta', 'aluminium', 1e-6)).toBe(4);
    expect(thicknessForFraction('gamma', 'bly', 0)).toBeNull();
    expect(thicknessForFraction('gamma', 'bly', 1)).toBeNull();
  });
});

describe('alle strålingene og stoffene', () => {
  it('andelen er mellom 0 og 1, avtar med tykkelsen og gir aldri NaN', () => {
    for (const rad of RADIATION_IDS)
      for (const mat of MATERIAL_IDS) {
        let prev = 1;
        for (const d of sliderValues(rad, mat)) {
          const T = transmission(rad, mat, d);
          expect(Number.isFinite(T)).toBe(true);
          expect(T).toBeGreaterThanOrEqual(0);
          expect(T).toBeLessThanOrEqual(prev + 1e-12);
          prev = T;
        }
      }
    expect(transmission('gamma', 'bly', Number.NaN)).toBe(1);
    expect(transmission('beta', 'papir', -3)).toBe(1);
  });

  it('γ går lettest gjennom, så β, og α stoppes først (for alle tykkelser på glidebryteren)', () => {
    for (const mat of MATERIAL_IDS)
      for (const d of sliderValues('alfa', mat).filter((x) => x > 0)) {
        expect(transmission('alfa', mat, d)).toBeLessThanOrEqual(transmission('beta', mat, d));
        expect(transmission('beta', mat, d)).toBeLessThan(transmission('gamma', mat, d));
      }
  });

  it('bly skjermer bedre enn aluminium, som skjermer bedre enn papir (samme tykkelse)', () => {
    for (const rad of ['beta', 'gamma'] as const)
      for (const d of [0.5, 1, 2, 3]) {
        expect(transmission(rad, 'bly', d)).toBeLessThanOrEqual(transmission(rad, 'aluminium', d));
        expect(transmission(rad, 'aluminium', d)).toBeLessThan(transmission(rad, 'papir', d));
      }
  });

  it('netto tellerate er tellerate uten skjerm ganger andelen', () => {
    for (const rad of RADIATION_IDS) {
      expect(netRate(rad, 'papir', 0)).toBe(RADIATIONS[rad].rate0);
      expect(expectedRate(rad, 'papir', 0)).toBe(RADIATIONS[rad].rate0 + BACKGROUND);
    }
  });
});

describe('målingen', () => {
  it('tallgeneratoren gir samme tall for samme frø og tall mellom 0 og 1', () => {
    const a = seededRandom(5);
    const b = seededRandom(5);
    for (let i = 0; i < 100; i++) {
      const x = a();
      expect(x).toBe(b());
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThan(1);
    }
    expect(seededRandom(6)()).not.toBe(seededRandom(5)());
  });

  it('klikkene kommer i stigende rekkefølge innenfor måletida', () => {
    const t = arrivalTimes(600, MEASURE_TIME, 3);
    for (let i = 1; i < t.length; i++) expect(t[i]!).toBeGreaterThan(t[i - 1]!);
    expect(t[t.length - 1]!).toBeLessThanOrEqual(MEASURE_TIME);
    expect(arrivalTimes(0, MEASURE_TIME, 3)).toEqual([]);
    expect(countUpTo(t, MEASURE_TIME)).toBe(t.length);
    expect(countUpTo(t, 0)).toBe(0);
    expect(countUpTo(t, t[9]!)).toBe(10);
  });

  it('antall klikk er poissonfordelt: gjennomsnitt og varians er lik forventningen', () => {
    const mu = 340; // 320 fra kilden + 20 i bakgrunnen på ett minutt
    const counts = Array.from({ length: 400 }, (_, s) => {
      const em = emissions(640, MEASURE_TIME, s);
      const bg = arrivalTimes(BACKGROUND, MEASURE_TIME, 10_000 + s);
      return registered(em, 0.5, MEASURE_TIME) + bg.length;
    });
    const mean = counts.reduce((a, b) => a + b, 0) / counts.length;
    const variance = counts.reduce((a, b) => a + (b - mean) ** 2, 0) / (counts.length - 1);
    expect(Math.abs(mean - mu)).toBeLessThan(4 * Math.sqrt(mu / counts.length));
    expect(variance / mu).toBeGreaterThan(0.8);
    expect(variance / mu).toBeLessThan(1.2);
  });

  it('tykkere skjerm gir aldri flere klikk i samme måling', () => {
    const em = emissions(RADIATIONS.gamma.rate0, MEASURE_TIME, 9);
    let prev = Infinity;
    for (let d = 0; d <= 50; d += 1) {
      const n = registered(em, transmission('gamma', 'bly', d), MEASURE_TIME);
      expect(n).toBeLessThanOrEqual(prev);
      prev = n;
    }
    expect(registered(em, 1, MEASURE_TIME)).toBe(em.length);
    expect(registered(em, 0, MEASURE_TIME)).toBe(0);
  });

  it('tida siden siste klikk', () => {
    const em = [
      { t: 1, v: 0.2 },
      { t: 2, v: 0.9 },
    ];
    expect(timeSinceLastClick(em, 0.5, [1.5], 3)).toBeCloseTo(1.5, 10);
    expect(timeSinceLastClick(em, 1, [1.5], 3)).toBeCloseTo(1, 10);
    expect(timeSinceLastClick([], 1, [], 3)).toBe(Infinity);
  });
});

describe('sporene i figuren', () => {
  it('har fast form for samme frø og rangering 0 … n − 1', () => {
    const a = trackDraws(18, 1);
    expect(a).toEqual(trackDraws(18, 1));
    expect([...a.map((t) => t.rank)].sort((x, y) => x - y)).toEqual(Array.from({ length: 18 }, (_, i) => i));
    for (const t of a) {
      expect(Math.abs(t.y0)).toBeLessThanOrEqual(1);
      expect(Math.abs(t.y1)).toBeLessThanOrEqual(1);
    }
  });

  it('like stor andel av sporene slipper gjennom som i modellen, men minst ett når γ ikke er borte', () => {
    expect(shownPassing(18, 1)).toBe(18);
    expect(shownPassing(18, 0.5)).toBe(9);
    expect(shownPassing(18, 0)).toBe(0);
    expect(shownPassing(18, transmission('gamma', 'bly', 50))).toBe(1);
    expect(shownPassing(18, 0.002)).toBe(0);
  });

  it('partiklene som stoppes, stopper inne i skjermen', () => {
    for (const rad of RADIATION_IDS)
      for (const mat of MATERIAL_IDS)
        for (const d of [0.1, 1, 5, maxThickness(rad, mat)])
          for (const v of [0, 0.3, 0.999]) {
            const z = stopDepth(rad, mat, d, v);
            expect(z).toBeGreaterThanOrEqual(0);
            expect(z).toBeLessThanOrEqual(Math.min(d, rad === 'beta' ? BETA[mat].range : d) + 1e-12);
          }
    // α stopper like ved forsiden av papiret (ca. 0,03 mm inn): lufta foran skjermen er (30 − 1) / 2 mm
    expect(stopDepth('alfa', 'papir', 1, 0.5)).toBeCloseTo(0.05 * (1 - (30 - 1) / 2 / 40), 10);
    expect(stopDepth('gamma', 'bly', 0, 0.5)).toBe(0);
    // γ: halvparten av dem som stoppes i 2 halveringstykkelser, stopper i den første (3 av 4 stoppes, 2 av 4 i første)
    expect(stopDepth('gamma', 'bly', 20, 2 / 3)).toBeCloseTo(10, 6);
  });
});
