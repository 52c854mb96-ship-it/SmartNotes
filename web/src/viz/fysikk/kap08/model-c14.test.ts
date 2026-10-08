import { describe, expect, it } from 'vitest';
import {
  C14_SAMPLES,
  HALF_LIFE,
  LUPE_ATOMS,
  T_AXIS_MAX,
  UNCERTAINTY_PCT,
  ZOOM,
  activityPerGram,
  ageFromFraction,
  ageInterval,
  c14AtomsPerGram,
  carbonAtomsPerGram,
  datingLimit,
  decayConstant,
  decayRanks,
  decaysPerHour,
  extraReach,
  fractionLeft,
  getSample,
  halfLives,
  lupePositions,
  playbackAge,
  remainingOf,
  roundAge,
  roundSig,
  sampleForPercent,
  samplePercent,
} from './model-c14';

describe('henfallsloven for C-14', () => {
  it('halveres for hver halveringstid', () => {
    expect(fractionLeft(0)).toBe(1);
    expect(fractionLeft(HALF_LIFE)).toBeCloseTo(0.5, 12);
    expect(fractionLeft(2 * HALF_LIFE)).toBeCloseTo(0.25, 12);
    expect(fractionLeft(3 * HALF_LIFE)).toBeCloseTo(0.125, 12);
    expect(fractionLeft(10 * HALF_LIFE)).toBeCloseTo(1 / 1024, 12);
  });

  it('to halveringstider gir en fjerdedel, ikke null', () => {
    expect(fractionLeft(11460)).toBeCloseTo(0.25, 10);
    expect(fractionLeft(11460)).toBeGreaterThan(0);
  });

  it('negativ tid gir 1, uendelig tid 0', () => {
    expect(fractionLeft(-100)).toBe(1);
    expect(fractionLeft(Number.POSITIVE_INFINITY)).toBe(0);
    expect(Number.isNaN(fractionLeft(Number.NaN))).toBe(true);
  });

  it('avtar hele tida (monoton)', () => {
    let prev = 2;
    for (let t = 0; t <= T_AXIS_MAX; t += 500) {
      const p = fractionLeft(t);
      expect(p).toBeLessThan(prev);
      prev = p;
    }
  });
});

describe('alder fra målt andel', () => {
  it('kjente verdier', () => {
    expect(ageFromFraction(0.5)).toBeCloseTo(5730, 6);
    expect(ageFromFraction(0.25)).toBeCloseTo(11460, 6);
    expect(halfLives(0.125)).toBeCloseTo(3, 12);
    // 70 % igjen: t = 5730 · lg(1/0,7)/lg 2 ≈ 2949 år
    expect(ageFromFraction(0.7)).toBeCloseTo(2948.5, 0);
    // 10 % igjen: 3,32 halveringstider ≈ 19 035 år
    expect(ageFromFraction(0.1)).toBeCloseTo(19034.6, 0);
  });

  it('er den omvendte av henfallsloven', () => {
    for (const t of [0, 1, 250, 1200, 5300, 10000, 30000, 59999]) {
      expect(ageFromFraction(fractionLeft(t))).toBeCloseTo(t, 6);
    }
    for (const p of [1, 0.9, 0.5, 0.123, 0.01, 0.0005]) {
      expect(fractionLeft(ageFromFraction(p))).toBeCloseTo(p, 12);
    }
  });

  it('grensetilfeller: fersk prøve og ingen C-14', () => {
    expect(ageFromFraction(1)).toBe(0);
    expect(ageFromFraction(1.2)).toBe(0);
    expect(ageFromFraction(0)).toBe(Number.POSITIVE_INFINITY);
    expect(halfLives(-0.1)).toBe(Number.POSITIVE_INFINITY);
    expect(Number.isNaN(halfLives(Number.NaN))).toBe(true);
  });
});

describe('måleusikkerhet og grensen for metoden', () => {
  it('intervallet ligger rundt alderen', () => {
    const r = ageInterval(0.527, 0.003);
    expect(r.datable).toBe(true);
    expect(r.young).toBeLessThan(r.age);
    expect(r.old).toBeGreaterThan(r.age);
    // Ung prøve: ± ca. 50 år
    expect(r.old - r.young).toBeGreaterThan(80);
    expect(r.old - r.young).toBeLessThan(110);
  });

  it('samme usikkerhet gir mye bredere intervall for gamle prøver', () => {
    const u = 0.003;
    const young = ageInterval(fractionLeft(1200), u);
    const old = ageInterval(fractionLeft(30000), u);
    const wYoung = young.old - young.young;
    const wOld = old.old - old.young;
    expect(wOld / wYoung).toBeGreaterThan(20);
    // Bredden ≈ 2u · T / (p · ln 2) for små u
    const p = fractionLeft(30000);
    expect(wOld).toBeCloseTo((2 * u * HALF_LIFE) / (p * Math.LN2), -2);
  });

  it('under usikkerheten vet vi bare en minstealder', () => {
    const r = ageInterval(0.002, 0.003);
    expect(r.datable).toBe(false);
    expect(r.old).toBe(Number.POSITIVE_INFINITY);
    expect(r.young).toBeCloseTo(ageFromFraction(0.005), 6);
    const zero = ageInterval(0, 0.003);
    expect(zero.age).toBe(Number.POSITIVE_INFINITY);
    expect(zero.young).toBeCloseTo(datingLimit(0.003), 6);
  });

  it('fersk prøve: yngste alder er 0', () => {
    const r = ageInterval(1, 0.003);
    expect(r.age).toBe(0);
    expect(r.young).toBe(0);
    expect(r.old).toBeGreaterThan(0);
  });

  it('grensen er ca. 48 000 år med 0,3 % usikkerhet', () => {
    expect(datingLimit(0.003)).toBeCloseTo(48024, -1);
    expect(fractionLeft(datingLimit(0.003))).toBeCloseTo(0.003, 12);
  });

  it('grensen ligger i utsnittet for hele glidebryteren', () => {
    for (let u = UNCERTAINTY_PCT.min; u <= UNCERTAINTY_PCT.max + 1e-9; u += UNCERTAINTY_PCT.step) {
      const lim = datingLimit(u / 100);
      expect(lim).toBeGreaterThan(ZOOM.tMin);
      expect(lim).toBeLessThan(ZOOM.tMax);
      expect(u / 100).toBeLessThan(ZOOM.pMax);
    }
  });

  it('ti ganger bedre måling gir bare 3,3 halveringstider ekstra', () => {
    expect(extraReach(0.01, 0.001)).toBeCloseTo(HALF_LIFE * Math.log2(10), 6);
    expect(extraReach(0.004, 0.002)).toBeCloseTo(HALF_LIFE, 6);
  });
});

describe('antall atomer og aktivitet', () => {
  it('1 g karbon har ca. 5,0 · 10²² atomer og 6,0 · 10¹⁰ C-14-atomer', () => {
    expect(carbonAtomsPerGram()).toBeCloseTo(5.02e22, -20);
    expect(c14AtomsPerGram()).toBeCloseTo(6.02e10, -8);
    expect(c14AtomsPerGram(0.5)).toBeCloseTo(c14AtomsPerGram() / 2, 0);
  });

  it('λ = ln 2 / T', () => {
    expect(decayConstant()).toBeCloseTo(3.83e-12, 14);
    expect(decayConstant() * HALF_LIFE * 365.25 * 24 * 3600).toBeCloseTo(Math.LN2, 12);
  });

  it('levende karbon har ca. 0,23 Bq per gram (ca. 830 henfall i timen)', () => {
    expect(activityPerGram()).toBeCloseTo(0.23, 2);
    expect(decaysPerHour()).toBeGreaterThan(800);
    expect(decaysPerHour()).toBeLessThan(860);
  });

  it('aktiviteten halveres med andelen', () => {
    expect(activityPerGram(0.5)).toBeCloseTo(activityPerGram() / 2, 12);
    expect(activityPerGram(0)).toBe(0);
  });
});

describe('lupa', () => {
  it('antall igjen av 100', () => {
    expect(remainingOf(100, 1)).toBe(100);
    expect(remainingOf(100, 0.527)).toBe(53);
    expect(remainingOf(100, 0.004)).toBe(0);
    expect(remainingOf(100, 0)).toBe(0);
    expect(remainingOf(100, 1.5)).toBe(100);
    expect(remainingOf(100, Number.NaN)).toBe(0);
  });

  it('henfallsrekkefølgen er en fast permutasjon', () => {
    const r = decayRanks(LUPE_ATOMS);
    expect(r).toHaveLength(LUPE_ATOMS);
    expect([...r].sort((a, b) => a - b)).toEqual(Array.from({ length: LUPE_ATOMS }, (_, i) => i));
    expect(decayRanks(LUPE_ATOMS)).toEqual(r);
    expect(decayRanks(LUPE_ATOMS, 99)).not.toEqual(r);
  });

  it('plassene ligger i enhetssirkelen og overlapper ikke', () => {
    const pts = lupePositions(LUPE_ATOMS);
    expect(pts).toHaveLength(LUPE_ATOMS);
    let minD = Infinity;
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i]!;
      expect(Math.hypot(a.x, a.y)).toBeLessThanOrEqual(1 + 1e-9);
      for (let j = i + 1; j < pts.length; j++) {
        const b = pts[j]!;
        minD = Math.min(minD, Math.hypot(a.x - b.x, a.y - b.y));
      }
    }
    // Med 100 atomer i en sirkel med radius 1 er snittavstanden ca. 0,18
    expect(minD).toBeGreaterThan(0.1);
  });
});

describe('prøvene', () => {
  it('har fornuftige målte andeler og alder som stemmer', () => {
    const pct = Object.fromEntries(C14_SAMPLES.map((s) => [s.id, samplePercent(s)]));
    expect(pct.vikingskip).toBeCloseTo(86.5, 6);
    expect(pct.otzi).toBeCloseTo(52.7, 6);
    expect(pct.ildsted).toBeCloseTo(29.8, 6);
    expect(pct.mammut).toBeCloseTo(2.7, 6);
    expect(pct.dinosaur).toBe(0);
    for (const s of C14_SAMPLES) {
      const p = samplePercent(s) / 100;
      if (s.id === 'dinosaur') {
        expect(ageInterval(p, 0.003).datable).toBe(false);
        continue;
      }
      // Alderen fra den avrundede målingen ligger innenfor 2 % av den virkelige alderen
      expect(Math.abs(ageFromFraction(p) - s.age) / s.age).toBeLessThan(0.02);
      expect(ageInterval(p, 0.003).datable).toBe(true);
    }
  });

  it('dinosaurbein: 66 millioner år er over 11 000 halveringstider', () => {
    const s = getSample('dinosaur');
    expect(s.age / HALF_LIFE).toBeGreaterThan(11000);
    expect(fractionLeft(s.age)).toBe(0);
  });

  it('kjenner igjen prøven fra glidebryteren', () => {
    expect(sampleForPercent('otzi', 52.7)).toBe('otzi');
    expect(sampleForPercent('otzi', 52.8)).toBeNull();
    expect(sampleForPercent('dinosaur', 0)).toBe('dinosaur');
  });
});

describe('avspilling og avrunding', () => {
  it('alderen går fra 0 til prøvens alder', () => {
    expect(playbackAge(0, 0.527)).toBe(0);
    expect(playbackAge(1, 0.527)).toBeCloseTo(ageFromFraction(0.527), 9);
    expect(playbackAge(0.5, 0.527)).toBeCloseTo(ageFromFraction(0.527) / 2, 9);
    expect(playbackAge(2, 0.5)).toBeCloseTo(5730, 9);
  });

  it('prøver uten C-14 spilles til enden av aksen', () => {
    expect(playbackAge(1, 0)).toBe(T_AXIS_MAX);
    expect(playbackAge(1, 0.0001)).toBe(T_AXIS_MAX);
  });

  it('runder av alder og gjeldende siffer', () => {
    expect(roundAge(5295.3)).toBe(5300);
    expect(roundAge(1199.7)).toBe(1200);
    expect(roundAge(29858)).toBe(29900);
    expect(roundAge(Number.POSITIVE_INFINITY)).toBe(Number.POSITIVE_INFINITY);
    expect(roundSig(0.23064, 3)).toBeCloseTo(0.231, 12);
    expect(roundSig(830.3, 2)).toBe(830);
    expect(roundSig(0, 3)).toBe(0);
  });
});
