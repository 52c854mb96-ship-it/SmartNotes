import { describe, expect, it } from 'vitest';
import {
  BRAKE_RANGES,
  BREMSER,
  DEKK,
  FORE,
  FRIKSJONSTALL,
  allDistances,
  brake,
  brakeState,
  brakingDistance,
  distanceRatio,
  frictionCoefficient,
  kmhToMs,
  msToKmh,
  playbackSpeed,
  sameDistanceSpeed,
  speedAfter,
} from './model-fore-og-bremsing';

const g = 9.81;

describe('friksjonstallene', () => {
  it('μk er mindre enn μs for alle føre og dekk (låste hjul bremser dårligere enn ABS)', () => {
    for (const f of FORE)
      for (const d of DEKK) {
        const { muS, muK } = FRIKSJONSTALL[f][d];
        expect(muK).toBeGreaterThan(0);
        expect(muK).toBeLessThan(muS);
        expect(muS).toBeLessThanOrEqual(1);
      }
  });

  it('grepet blir dårligere fra tørr asfalt til våt asfalt, snø og is', () => {
    for (const d of DEKK)
      for (const b of BREMSER)
        for (let i = 1; i < FORE.length; i++) {
          expect(frictionCoefficient(FORE[i]!, d, b)).toBeLessThan(frictionCoefficient(FORE[i - 1]!, d, b));
        }
  });

  it('vinterdekk griper minst dobbelt så godt på snø og is, men litt dårligere på bar asfalt', () => {
    for (const b of BREMSER) {
      for (const f of ['sno', 'is'] as const) {
        expect(frictionCoefficient(f, 'vinter', b) / frictionCoefficient(f, 'sommer', b)).toBeGreaterThanOrEqual(1.75);
      }
      for (const f of ['torr', 'vaat'] as const) {
        const ratio = frictionCoefficient(f, 'vinter', b) / frictionCoefficient(f, 'sommer', b);
        expect(ratio).toBeLessThan(1);
        expect(ratio).toBeGreaterThan(0.85);
      }
    }
  });

  it('riktige dekk og ABS gir omtrent bremseakselerasjonene fra kapittel 1 (8, 5, 2,5 og 1 m/s²)', () => {
    expect(frictionCoefficient('torr', 'sommer', 'abs') * g).toBeCloseTo(7.85, 2);
    expect(frictionCoefficient('vaat', 'sommer', 'abs') * g).toBeCloseTo(4.9, 1);
    expect(frictionCoefficient('sno', 'vinter', 'abs') * g).toBeCloseTo(2.45, 2);
    expect(frictionCoefficient('is', 'vinter', 'abs') * g).toBeCloseTo(0.98, 2);
  });
});

describe('brake: kreftene og bremselengden', () => {
  it('kjent eksempel: 80 km/h på tørr asfalt med μ = 0,80', () => {
    const r = brake(kmhToMs(80), 0.8, 1400);
    expect(r.G).toBeCloseTo(13734, 6);
    expect(r.N).toBe(r.G);
    expect(r.R).toBeCloseTo(0.8 * 13734, 6);
    expect(r.a).toBeCloseTo(7.848, 6);
    expect(r.s).toBeCloseTo(31.46, 2);
    expect(r.t).toBeCloseTo(2.832, 3);
  });

  it('Newtons 2. lov: a = R/m = μg, så massen forkortes bort', () => {
    const light = brake(25, 0.5, 1000);
    const heavy = brake(25, 0.5, 2000);
    expect(light.a).toBeCloseTo(0.5 * g, 12);
    expect(heavy.a).toBeCloseTo(light.a, 12);
    expect(heavy.s).toBeCloseTo(light.s, 12);
    expect(heavy.t).toBeCloseTo(light.t, 12);
    expect(heavy.R).toBeCloseTo(2 * light.R, 9);
    expect(heavy.R / 2000).toBeCloseTo(heavy.a, 12);
  });

  it('dobbel fart gir fire ganger så lang bremselengde og dobbelt så lang bremsetid', () => {
    const a = brake(10, 0.4, 1200);
    const b = brake(20, 0.4, 1200);
    expect(b.s / a.s).toBeCloseTo(4, 12);
    expect(b.t / a.t).toBeCloseTo(2, 12);
    expect(distanceRatio(10, 20)).toBeCloseTo(4, 12);
    expect(distanceRatio(80, 60)).toBeCloseTo(0.5625, 12);
  });

  it('halvert friksjonstall gir dobbelt så lang bremselengde', () => {
    expect(brakingDistance(22, 0.2) / brakingDistance(22, 0.4)).toBeCloseTo(2, 12);
  });

  it('arbeidet friksjonen gjør, er lik den kinetiske energien bilen hadde: R · s = ½mv₀²', () => {
    const m = 1600;
    const v0 = kmhToMs(90);
    const r = brake(v0, frictionCoefficient('sno', 'vinter', 'laast'), m);
    expect(r.R * r.s).toBeCloseTo(0.5 * m * v0 * v0, 6);
  });

  it('grensetilfeller: står stille fra før, og ingen friksjon', () => {
    expect(brake(0, 0.5, 1000)).toMatchObject({ s: 0, t: 0 });
    const none = brake(20, 0, 1000);
    expect(none.R).toBe(0);
    expect(none.a).toBe(0);
    expect(none.s).toBe(Infinity);
    expect(none.t).toBe(Infinity);
    expect(brake(NaN, 0.5, 1000).s).toBe(0);
  });
});

describe('brakeState: bevegelsen under oppbremsingen', () => {
  const v0 = kmhToMs(80);
  const mu = 0.25;
  const m = 1400;
  const r = brake(v0, mu, m);

  it('starter med full fart og står stille etter bremselengden', () => {
    expect(brakeState(v0, mu, m, 0)).toMatchObject({ v: v0, s: 0, stopped: false });
    const end = brakeState(v0, mu, m, r.t);
    expect(end.stopped).toBe(true);
    expect(end.v).toBe(0);
    expect(end.s).toBeCloseTo(r.s, 9);
  });

  it('farten avtar jevnt, og den tidløse likningen v² = v₀² − 2as gjelder hele veien', () => {
    for (const k of [0.1, 0.25, 0.5, 0.75, 0.99]) {
      const st = brakeState(v0, mu, m, k * r.t);
      expect(st.v).toBeCloseTo(v0 * (1 - k), 9);
      expect(st.v ** 2).toBeCloseTo(v0 * v0 - 2 * r.a * st.s, 6);
      expect(st.a).toBeCloseTo(r.a, 12);
      expect(st.R).toBeCloseTo(r.R, 9);
      expect(speedAfter(v0, mu, st.s)).toBeCloseTo(st.v, 6);
    }
  });

  it('halvveis i bremselengden er farten fortsatt v₀/√2 (ca. 71 %)', () => {
    expect(speedAfter(v0, mu, r.s / 2) / v0).toBeCloseTo(Math.SQRT1_2, 9);
    expect(speedAfter(v0, mu, 2 * r.s)).toBe(0);
  });

  it('etter stopp er både friksjonen og akselerasjonen null', () => {
    const later = brakeState(v0, mu, m, r.t + 5);
    expect(later).toMatchObject({ v: 0, a: 0, R: 0, stopped: true });
    expect(later.s).toBeCloseTo(r.s, 9);
    expect(later.t).toBeCloseTo(r.t, 9);
  });

  it('negative og ugyldige tider gir starttilstanden', () => {
    expect(brakeState(v0, mu, m, -1)).toMatchObject({ t: 0, v: v0, s: 0 });
    expect(brakeState(v0, mu, m, NaN)).toMatchObject({ t: 0, v: v0, s: 0 });
  });

  it('uten friksjon kjører bilen videre med konstant fart', () => {
    const st = brakeState(20, 0, m, 3);
    expect(st).toMatchObject({ v: 20, s: 60, a: 0, R: 0, stopped: false });
  });
});

describe('sammenligninger', () => {
  it('samme bremselengde på is som på tørr asfalt krever mye lavere fart', () => {
    const v = sameDistanceSpeed(80, 0.8, 0.1);
    expect(v).toBeCloseTo(80 * Math.sqrt(0.125), 9);
    expect(v).toBeCloseTo(28.3, 1);
    expect(brakingDistance(kmhToMs(v), 0.1)).toBeCloseTo(brakingDistance(kmhToMs(80), 0.8), 9);
    expect(sameDistanceSpeed(80, 0, 0.1)).toBeNaN();
  });

  it('allDistances: ABS er alltid kortere enn låste hjul, og is med sommerdekk er lengst', () => {
    const d = allDistances(kmhToMs(80));
    let longest = 0;
    for (const f of FORE)
      for (const dk of DEKK) {
        expect(d[f][dk].abs).toBeLessThan(d[f][dk].laast);
        longest = Math.max(longest, d[f][dk].laast);
      }
    expect(longest).toBe(d.is.sommer.laast);
    expect(d.torr.sommer.abs).toBeCloseTo(31.46, 2);
    expect(d.is.sommer.laast).toBeCloseTo(629.2, 1);
  });

  it('enhetene: km/h ↔ m/s', () => {
    expect(kmhToMs(72)).toBeCloseTo(20, 12);
    expect(msToKmh(kmhToMs(93))).toBeCloseTo(93, 12);
  });
});

describe('glidebryterne og avspillingen', () => {
  it('alle ytterverdier gir endelige tall og en avspilling på høyst 10 s', () => {
    for (const vk of [BRAKE_RANGES.v.min, BRAKE_RANGES.v.start, BRAKE_RANGES.v.max])
      for (const m of [BRAKE_RANGES.m.min, BRAKE_RANGES.m.max])
        for (const f of FORE)
          for (const dk of DEKK)
            for (const b of BREMSER) {
              const r = brake(kmhToMs(vk), frictionCoefficient(f, dk, b), m);
              for (const v of Object.values(r)) expect(Number.isFinite(v)).toBe(true);
              expect(r.s).toBeGreaterThan(3);
              expect(r.s).toBeLessThan(1200);
              const speed = playbackSpeed(r.t);
              expect(speed).toBeGreaterThanOrEqual(1);
              expect(r.t / speed).toBeLessThanOrEqual(10 + 1e-9);
            }
  });

  it('korte oppbremsinger spilles av i sanntid', () => {
    expect(playbackSpeed(2.8)).toBe(1);
    expect(playbackSpeed(40)).toBeCloseTo(4, 12);
    expect(playbackSpeed(Infinity)).toBe(1);
    expect(playbackSpeed(0)).toBe(1);
  });
});
