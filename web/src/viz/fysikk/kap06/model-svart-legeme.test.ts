import { describe, expect, it } from 'vitest';
import { blackbodyRgb, planckBand, stefanBoltzmann, visibleFraction, wienPeak } from './model';
import {
  LEGEMER,
  LINJAL_SMAA,
  LINJAL_TALL,
  T_MAX,
  T_MIN,
  T_SPLIT,
  T_STEP,
  T_SUN,
  andeler,
  decimalsFor,
  glodNivaa,
  glodRgb,
  glodTrinn,
  legemeVed,
  linjalT,
  linjalX,
  niceCeil,
  planckTotal,
  plasserEtiketter,
  snapT,
  spekterMaksNm,
  yTickLabels,
  type Linjal,
} from './model-svart-legeme';

/** Alle temperaturene glidebryteren kan stå på. */
const ALLE_T = Array.from({ length: (T_MAX - T_MIN) / T_STEP + 1 }, (_, i) => T_MIN + i * T_STEP);

describe('legemene i scenen', () => {
  it('er sortert etter temperatur, ligger på glidebryteren og er delt mellom jorda og verdensrommet', () => {
    for (let i = 1; i < LEGEMER.length; i++) expect(LEGEMER[i]!.T).toBeGreaterThan(LEGEMER[i - 1]!.T);
    for (const l of LEGEMER) {
      expect(l.T).toBeGreaterThanOrEqual(T_MIN);
      expect(l.T).toBeLessThanOrEqual(T_MAX);
      expect(l.T % T_STEP).toBe(0);
      expect(l.sted === 'jorda' ? l.T < T_SPLIT : l.T > T_SPLIT).toBe(true);
      expect(legemeVed(l.T)).toBe(l);
    }
    expect(legemeVed(T_SUN)?.navn).toBe('Sola');
    expect(legemeVed(5850)).toBeUndefined();
  });

  it('toppene etter Wiens lov: kokeplata og glødelampa i IR, Sola i det synlige, Rigel i UV', () => {
    const peak = (id: string) => wienPeak(LEGEMER.find((l) => l.id === id)!.T) * 1e9;
    expect(peak('kokeplate')).toBeCloseTo(3222, 0);
    expect(peak('smijern')).toBeCloseTo(1933, 0);
    expect(peak('lampe')).toBeCloseTo(1036, 0);
    expect(peak('betelgeuse')).toBeCloseTo(829, 0);
    expect(peak('sola')).toBeCloseTo(500, 6);
    expect(peak('sirius')).toBeCloseTo(293, 0);
    expect(peak('rigel')).toBeCloseTo(242, 0);
  });

  it('snapT runder til 50 K og holder seg på glidebryteren', () => {
    expect(snapT(5824)).toBe(5800);
    expect(snapT(5826)).toBe(5850);
    expect(snapT(10)).toBe(T_MIN);
    expect(snapT(1e6)).toBe(T_MAX);
    expect(snapT(Number.NaN)).toBe(T_SUN);
  });
});

describe('temperaturlinjalen', () => {
  const l: Linjal = { Ta: 700, Tb: 12000, xa: 34, xb: 766 };

  it('endene havner i endene, og linjalT er det motsatte av linjalX', () => {
    expect(linjalX(700, l)).toBeCloseTo(34, 9);
    expect(linjalX(12000, l)).toBeCloseTo(766, 9);
    for (const T of [700, 900, 2800, 5800, 12000]) expect(linjalT(linjalX(T, l), l)).toBeCloseTo(T, 6);
  });

  it('er logaritmisk: dobbel temperatur gir alltid like langt steg', () => {
    const d1 = linjalX(2000, l) - linjalX(1000, l);
    const d2 = linjalX(6000, l) - linjalX(3000, l);
    expect(d1).toBeCloseTo(d2, 9);
  });

  it('holder seg innenfor linjalen for ugyldige og for store verdier', () => {
    expect(linjalX(100, l)).toBe(34);
    expect(linjalX(1e6, l)).toBeCloseTo(766, 9);
    expect(linjalX(Number.NaN, l)).toBe(34);
    expect(linjalT(-100, l)).toBe(700);
    expect(linjalT(5000, l)).toBeCloseTo(12000, 6);
  });

  it('strekene på linjalen er ulike og ligger innenfor glidebryteren', () => {
    const all = [...LINJAL_TALL, ...LINJAL_SMAA];
    expect(new Set(all).size).toBe(all.length);
    for (const t of all) {
      expect(t).toBeGreaterThanOrEqual(T_MIN);
      expect(t).toBeLessThanOrEqual(T_MAX);
    }
  });
});

describe('fordelingen på UV, synlig lys og IR', () => {
  it('hele arealet under kurven er σT⁴ med de avrundede konstantene (0,5 % lavere)', () => {
    for (const T of [900, 2800, 5800, 12000]) {
      expect(planckTotal(T) / stefanBoltzmann(T)).toBeCloseTo(0.995, 3);
      expect(planckBand(T, 1e-9, 1e-3, 200000) / planckTotal(T)).toBeCloseTo(1, 4);
    }
    expect(planckTotal(2 * 3000) / planckTotal(3000)).toBeCloseTo(16, 9);
    expect(planckTotal(0)).toBe(0);
  });

  it('andelene er 100 % til sammen for alle temperaturene på glidebryteren', () => {
    for (const T of ALLE_T) {
      const a = andeler(T);
      expect(a.uv + a.synlig + a.ir).toBeCloseTo(1, 12);
      for (const v of [a.uv, a.synlig, a.ir]) {
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(1);
      }
    }
  });

  it('Sola: omtrent 10 % UV, 44 % synlig og 46 % IR; glødelampa: 8 % synlig, resten nesten bare IR', () => {
    const sol = andeler(5800);
    expect(sol.uv).toBeCloseTo(0.1, 2);
    expect(sol.synlig).toBeCloseTo(0.44, 2);
    expect(sol.ir).toBeCloseTo(0.46, 2);
    const lampe = andeler(2800);
    expect(lampe.synlig).toBeCloseTo(0.082, 3);
    expect(lampe.ir).toBeGreaterThan(0.9);
    // Den synlige andelen er den samme som visibleFraction i model.ts, bare delt på hele arealet i stedet for σT⁴
    for (const T of [1500, 2800, 5800, 12000]) expect(andeler(T).synlig).toBeCloseTo(visibleFraction(T) / 0.995, 3);
  });

  it('kokeplata sender nesten bare IR, Rigel mest UV, og UV-andelen vokser med temperaturen', () => {
    expect(andeler(900).ir).toBeGreaterThan(0.9999);
    expect(andeler(12000).uv).toBeGreaterThan(0.5);
    let prev = -1;
    for (const T of ALLE_T) {
      const uv = andeler(T).uv;
      expect(uv).toBeGreaterThanOrEqual(prev);
      prev = uv;
    }
  });
});

describe('gløden', () => {
  it('ingen glød under 800 K, full ved 2 000 K og over, og den vokser med temperaturen', () => {
    expect(glodNivaa(700)).toBe(0);
    expect(glodNivaa(800)).toBe(0);
    expect(glodNivaa(2000)).toBeCloseTo(1, 9);
    expect(glodNivaa(12000)).toBe(1);
    let prev = -1;
    for (const T of ALLE_T) {
      const g = glodNivaa(T);
      expect(g).toBeGreaterThanOrEqual(prev);
      prev = g;
    }
    // Kokeplata gløder svakt, smijernet godt
    expect(glodNivaa(900)).toBeGreaterThan(0.1);
    expect(glodNivaa(900)).toBeLessThan(0.3);
    expect(glodNivaa(1500)).toBeGreaterThan(0.7);
  });

  it('fargen: svart når den er kald, mørkerød for kokeplata, og som blackbodyRgb når den gløder fullt', () => {
    expect(glodRgb(700)).toEqual([0, 0, 0]);
    const [r, g, b] = glodRgb(900);
    expect(r).toBeGreaterThan(60);
    expect(r).toBeLessThan(140);
    expect(g).toBeLessThan(r / 2);
    expect(b).toBe(0);
    for (const T of [2000, 5800, 12000]) expect(glodRgb(T)).toEqual(blackbodyRgb(T));
    for (const T of ALLE_T) for (const c of glodRgb(T)) expect(c >= 0 && c <= 255 && Number.isInteger(c)).toBe(true);
  });

  it('trinnene i forklaringen passer med legemene', () => {
    const trinn = (id: string) => glodTrinn(LEGEMER.find((l) => l.id === id)!.T);
    expect(glodTrinn(700)).toBe('ingen');
    expect(trinn('kokeplate')).toBe('morkerod');
    expect(trinn('smijern')).toBe('oransje');
    expect(trinn('lampe')).toBe('gulhvit');
    expect(trinn('betelgeuse')).toBe('gulhvit');
    expect(trinn('sola')).toBe('hvit');
    expect(trinn('sirius')).toBe('blaahvit');
    expect(trinn('rigel')).toBe('blaahvit');
    // Grensene følger toppen: 750 nm ved 3 867 K og 380 nm ved 7 632 K
    expect(glodTrinn(3850)).toBe('gulhvit');
    expect(glodTrinn(3900)).toBe('hvit');
    expect(glodTrinn(7600)).toBe('hvit');
    expect(glodTrinn(7650)).toBe('blaahvit');
  });
});

describe('aksene i grafen', () => {
  it('bølgelengdeaksen rommer alltid hele toppen og går i tre faste steg', () => {
    expect(spekterMaksNm(5800)).toBe(3000);
    expect(spekterMaksNm(2900)).toBe(3000);
    expect(spekterMaksNm(2850)).toBe(6000);
    expect(spekterMaksNm(1450)).toBe(6000);
    expect(spekterMaksNm(1400)).toBe(12000);
    expect(spekterMaksNm(T_MIN)).toBe(12000);
    for (const T of ALLE_T) {
      const L = spekterMaksNm(T);
      expect([3000, 6000, 12000]).toContain(L);
      // Minst 2,9 ganger toppen, så halen er godt nede ved enden av aksen
      expect(L / (wienPeak(T) * 1e9)).toBeGreaterThan(2.89);
    }
  });

  it('niceCeil runder opp til pene tall', () => {
    expect(niceCeil(1.12)).toBe(1.2);
    expect(niceCeil(0.0049)).toBeCloseTo(0.005, 12);
    expect(niceCeil(2)).toBe(2);
    expect(niceCeil(31)).toBe(40);
    expect(niceCeil(0)).toBe(1);
  });

  it('tallene på y-aksen: desimaltall når det går, ellers standardform med felles tierpotens', () => {
    expect(yTickLabels([0, 0.2, 0.4, 0.6])).toEqual(['0', '0,2', '0,4', '0,6']);
    expect(yTickLabels([0, 5, 10, 15])).toEqual(['0', '5', '10', '15']);
    expect(yTickLabels([0, 0.001, 0.002, 0.003])).toEqual(['0', '0,001', '0,002', '0,003']);
    expect(yTickLabels([0, 0.0005, 0.001])).toEqual(['0', '0,0005', '0,0010']);
    expect(yTickLabels([0, 0.00005, 0.0001, 0.00015, 0.0002])).toEqual(['0', '0,5 · 10⁻⁴', '1,0 · 10⁻⁴', '1,5 · 10⁻⁴', '2,0 · 10⁻⁴']);
    expect(yTickLabels([0, 0.00001, 0.00002, 0.00003])).toEqual(['0', '1 · 10⁻⁵', '2 · 10⁻⁵', '3 · 10⁻⁵']);
    expect(yTickLabels([0])).toEqual(['0']);
  });

  it('decimalsFor finner antall desimaler som trengs', () => {
    expect(decimalsFor(5)).toBe(0);
    expect(decimalsFor(0.25)).toBe(2);
    expect(decimalsFor(0.2)).toBe(1);
    expect(decimalsFor(0.00005)).toBe(5);
    expect(decimalsFor(0)).toBe(0);
  });
});

describe('navnene i scenen', () => {
  it('etiketter som ville overlappet, havner i hver sin rad, og alle holder seg innenfor bildet sitt', () => {
    const list = [
      { x: 720, w: 60, min: 422, max: 800 },
      { x: 766, w: 56, min: 422, max: 800 },
      { x: 449, w: 96, min: 422, max: 800 },
    ];
    const out = plasserEtiketter(list, 8);
    expect(out[0]!.rad).toBe(0);
    expect(out[1]!.rad).toBe(1);
    expect(out[2]!.rad).toBe(0);
    out.forEach((o, i) => {
      const e = list[i]!;
      expect(o.x - e.w / 2).toBeGreaterThanOrEqual(e.min - 1e-9);
      expect(o.x + e.w / 2).toBeLessThanOrEqual(e.max + 1e-9);
    });
    // Ingen overlapp innenfor samme rad
    for (let i = 0; i < out.length; i++)
      for (let j = i + 1; j < out.length; j++)
        if (out[i]!.rad === out[j]!.rad) expect(Math.abs(out[i]!.x - out[j]!.x)).toBeGreaterThanOrEqual((list[i]!.w + list[j]!.w) / 2 + 8 - 1e-9);
  });

  it('etiketter med god plass blir stående over tingen sin', () => {
    const out = plasserEtiketter([{ x: 200, w: 80, min: 0, max: 400 }]);
    expect(out[0]).toEqual({ x: 200, rad: 0 });
  });
});
