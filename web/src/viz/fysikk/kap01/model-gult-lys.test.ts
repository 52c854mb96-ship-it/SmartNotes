import { describe, expect, it } from 'vitest';
import {
  BRAKE,
  CAR_LENGTH,
  CLEAR_DISTANCE,
  KRYSS,
  brakingDistance,
  canGo,
  canStop,
  dilemmaLength,
  goLimit,
  goOutcome,
  graphTop,
  kmhToMs,
  minGoSpeed,
  msToKmh,
  niceCeil,
  pickValues,
  noDilemmaSpeeds,
  planAcceleration,
  planEndTime,
  planPosition,
  planVelocity,
  reactionDistance,
  requiredDeceleration,
  sceneRange,
  situation,
  stopDistance,
  stopOutcome,
  stopTime,
  yellowDistance,
  yellowNeeded,
  zones,
  type YellowInput,
} from './model-gult-lys';

/** Standardverdiene i visualiseringen: 50 km/h, t_r = 1,0 s, a = 3,0 m/s², gultid 3,0 s. */
const base: YellowInput = { v0: kmhToMs(50), tr: 1.0, a: 3.0, tg: 3.0 };

describe('krysset', () => {
  it('bilen må kjøre krysset pluss sin egen lengde', () => {
    expect(CAR_LENGTH).toBe(4.4);
    expect(CLEAR_DISTANCE).toBeCloseTo(19.4, 10);
    expect(KRYSS.gangfelt.fra).toBeGreaterThan(0);
    expect(KRYSS.gangfelt.til).toBeLessThanOrEqual(KRYSS.tverrvei.fra);
    expect(KRYSS.tverrvei.til).toBe(KRYSS.bredde);
  });
  it('km/h og m/s', () => {
    expect(kmhToMs(36)).toBeCloseTo(10, 10);
    expect(msToKmh(kmhToMs(73))).toBeCloseTo(73, 10);
  });
});

describe('grensene ved 50 km/h', () => {
  it('stopplengden er reaksjonslengde pluss bremselengde', () => {
    // v₀ = 13,89 m/s: s_r = 13,89 m, s_b = 13,89² / 6 = 32,15 m
    expect(reactionDistance(base)).toBeCloseTo(13.889, 3);
    expect(brakingDistance(base)).toBeCloseTo(32.150, 3);
    expect(stopDistance(base)).toBeCloseTo(46.039, 3);
  });
  it('grensen for å rekke over er v₀t_g − (b + l)', () => {
    expect(yellowDistance(base)).toBeCloseTo(41.667, 3);
    expect(goLimit(base)).toBeCloseTo(22.267, 3);
  });
  it('dilemmasonen ligger mellom grensene', () => {
    const z = zones(base);
    expect(z.dilemma).not.toBeNull();
    expect(z.dilemma![0]).toBeCloseTo(22.267, 3);
    expect(z.dilemma![1]).toBeCloseTo(46.039, 3);
    expect(z.option).toBeNull();
    expect(dilemmaLength(base)).toBeCloseTo(23.772, 3);
  });
  it('situasjonen for ulike avstander', () => {
    expect(situation(base, 60)).toBe('stopp');
    expect(situation(base, 35)).toBe('dilemma');
    expect(situation(base, 10)).toBe('kjor');
    // Akkurat på grensene regnes det som at det går
    expect(canStop(base, stopDistance(base))).toBe(true);
    expect(canGo(base, goLimit(base))).toBe(true);
  });
  it('med lang gultid går begge deler i et område', () => {
    const long = { ...base, tg: 5 };
    const z = zones(long);
    expect(z.dGo).toBeCloseTo(69.444 - 19.4, 3);
    expect(z.dilemma).toBeNull();
    expect(z.option![0]).toBeCloseTo(46.039, 3);
    expect(z.option![1]).toBeCloseTo(50.044, 3);
    expect(situation(long, 48)).toBe('begge');
    expect(situation(long, 60)).toBe('stopp');
    expect(situation(long, 30)).toBe('kjor');
  });
  it('når bilen ikke rekker over selv ved linja, går dilemmasonen helt ned til linja', () => {
    const short = { ...base, v0: kmhToMs(20), tg: 2 }; // v₀t_g = 11,1 m < 19,4 m
    const z = zones(short);
    expect(z.dGo).toBeLessThan(0);
    expect(z.dilemma![0]).toBe(0);
    expect(z.dilemma![1]).toBeCloseTo(stopDistance(short), 10);
    expect(situation(short, 0)).toBe('dilemma');
  });
});

describe('bremseakselerasjonen som trengs', () => {
  it('fra 35 m ved 50 km/h', () => {
    // Bremser på 35 − 13,89 = 21,11 m: a = 13,89² / (2 · 21,11) = 4,57 m/s²
    expect(requiredDeceleration(base, 35)).toBeCloseTo(4.569, 3);
  });
  it('er akkurat a når D er stopplengden', () => {
    for (const a of [1.5, 3, 8]) {
      const i = { ...base, a };
      expect(requiredDeceleration(i, stopDistance(i))).toBeCloseTo(a, 9);
    }
  });
  it('er uendelig når bilen er forbi linja før bremsingen begynner', () => {
    expect(requiredDeceleration(base, 10)).toBe(Infinity);
    expect(requiredDeceleration(base, reactionDistance(base))).toBe(Infinity);
  });
  it('står bilen stille, trengs ingen bremsing', () => {
    expect(requiredDeceleration({ ...base, v0: 0 }, 5)).toBe(0);
  });
});

describe('gultiden som fjerner dilemmasonen', () => {
  it('t_g = t_r + v₀/(2a) + (b + l)/v₀', () => {
    // 1,0 + 13,89/6 + 19,4/13,89 = 1,0 + 2,315 + 1,397 = 4,71 s
    expect(yellowNeeded(base)).toBeCloseTo(4.712, 3);
  });
  it('med akkurat den gultiden er grensene like', () => {
    for (const kmh of [30, 50, 70, 90]) {
      const i = { ...base, v0: kmhToMs(kmh) };
      const tg = yellowNeeded(i);
      const z = zones({ ...i, tg });
      expect(z.dGo).toBeCloseTo(z.dStop, 9);
      expect(dilemmaLength({ ...i, tg: tg + 0.01 })).toBe(0);
      expect(dilemmaLength({ ...i, tg: tg - 0.01 })).toBeGreaterThan(0);
    }
  });
  it('fartene uten dilemmasone er røttene', () => {
    const r = noDilemmaSpeeds({ tr: 1, a: 3, tg: 5 });
    expect(r).not.toBeNull();
    const [lo, hi] = r!;
    // d = 4: v = 3 · (4 ± √(16 − 12,93)) = 3 · (4 ± 1,751)
    expect(lo).toBeCloseTo(3 * (4 - Math.sqrt(16 - 38.8 / 3)), 9);
    expect(hi).toBeCloseTo(3 * (4 + Math.sqrt(16 - 38.8 / 3)), 9);
    for (const v of [lo, hi]) {
      const z = zones({ v0: v, tr: 1, a: 3, tg: 5 });
      expect(z.dGo).toBeCloseTo(z.dStop, 8);
    }
    expect(dilemmaLength({ v0: (lo + hi) / 2, tr: 1, a: 3, tg: 5 })).toBe(0);
    expect(dilemmaLength({ v0: lo * 0.8, tr: 1, a: 3, tg: 5 })).toBeGreaterThan(0);
    expect(dilemmaLength({ v0: hi * 1.2, tr: 1, a: 3, tg: 5 })).toBeGreaterThan(0);
  });
  it('med kort gultid finnes dilemmasonen ved alle farter', () => {
    expect(noDilemmaSpeeds({ tr: 1, a: 3, tg: 3 })).toBeNull();
    expect(noDilemmaSpeeds({ tr: 2, a: 3, tg: 2 })).toBeNull();
    for (const kmh of [20, 40, 60, 80, 100]) expect(dilemmaLength({ ...base, v0: kmhToMs(kmh) })).toBeGreaterThan(0);
  });
  it('dilemmasonen blir lengre når farten øker (vanlige farter)', () => {
    const L = [30, 50, 70, 90].map((kmh) => dilemmaLength({ ...base, v0: kmhToMs(kmh) }));
    for (let i = 1; i < L.length; i++) expect(L[i]!).toBeGreaterThan(L[i - 1]!);
  });
  it('lengre gultid, kortere reaksjonstid og hardere bremsing gir kortere dilemmasone', () => {
    const L0 = dilemmaLength(base);
    expect(dilemmaLength({ ...base, tg: 4 })).toBeLessThan(L0);
    expect(dilemmaLength({ ...base, tr: 0.7 })).toBeLessThan(L0);
    expect(dilemmaLength({ ...base, a: BRAKE.full })).toBeLessThan(L0);
  });
});

describe('bevegelsen', () => {
  it('bremsing: konstant fart i reaksjonstiden, så jevnt avtagende fart', () => {
    const D = 35;
    expect(planPosition(base, D, 'bremse', 0)).toBe(-35);
    expect(planPosition(base, D, 'bremse', 1)).toBeCloseTo(-35 + 13.889, 3);
    expect(planVelocity(base, 'bremse', 0.5)).toBeCloseTo(base.v0, 10);
    expect(planVelocity(base, 'bremse', 2)).toBeCloseTo(base.v0 - 3, 10);
    expect(planAcceleration(base, 'bremse', 0.5)).toBe(0);
    expect(planAcceleration(base, 'bremse', 2)).toBe(-3);
    const tS = stopTime(base);
    expect(tS).toBeCloseTo(1 + 13.889 / 3, 3);
    expect(planVelocity(base, 'bremse', tS)).toBeCloseTo(0, 9);
    expect(planPosition(base, D, 'bremse', tS)).toBeCloseTo(-35 + stopDistance(base), 9);
    // Står stille etterpå
    expect(planPosition(base, D, 'bremse', tS + 5)).toBeCloseTo(-35 + stopDistance(base), 9);
    expect(planAcceleration(base, 'bremse', tS + 1)).toBe(0);
  });
  it('tidløs formel: v² − v₀² = 2·(−a)·s under bremsingen', () => {
    for (const t of [1.2, 2, 3.5, 5]) {
      const v = planVelocity(base, 'bremse', t);
      const s = planPosition(base, 0, 'bremse', t) - reactionDistance(base);
      expect(v * v - base.v0 * base.v0).toBeCloseTo(-2 * base.a * s, 8);
    }
  });
  it('kjøre videre: konstant fart', () => {
    expect(planPosition(base, 35, 'kjore', 3)).toBeCloseTo(-35 + 41.667, 3);
    expect(planVelocity(base, 'kjore', 2)).toBe(base.v0);
    expect(planAcceleration(base, 'kjore', 2)).toBe(0);
  });
  it('ingen negativ tid', () => {
    expect(planPosition(base, 20, 'bremse', -1)).toBe(-20);
    expect(planPosition(base, 20, 'kjore', -1)).toBe(-20);
  });
});

describe('utfallet av hvert valg', () => {
  it('bremse i dilemmasonen: bilen stopper i gangfeltet eller krysset', () => {
    const o = stopOutcome(base, 35);
    expect(o.stopAt).toBeCloseTo(11.039, 3);
    expect(o.over).toBeCloseTo(11.039, 3);
    expect(o.margin).toBe(0);
    expect(o.place).toBe('krysset');
    expect(stopOutcome(base, 44).place).toBe('gangfelt');
    expect(stopOutcome(base, 45.5).place).toBe('over-linja');
  });
  it('bremse langt unna: bilen stopper før linja', () => {
    const o = stopOutcome(base, 60);
    expect(o.place).toBe('foer');
    expect(o.margin).toBeCloseTo(60 - 46.039, 3);
  });
  it('bremse helt inntil: bilen ender forbi krysset', () => {
    const fast = { ...base, v0: kmhToMs(80) };
    expect(stopOutcome(fast, 5).place).toBe('forbi');
  });
  it('kjøre videre i dilemmasonen: fortsatt i krysset når det blir rødt', () => {
    const g = goOutcome(base, 35);
    expect(g.status).toBe('i-krysset');
    expect(g.tLine).toBeCloseTo(35 / base.v0, 10);
    expect(g.tClear).toBeCloseTo(54.4 / base.v0, 10);
    expect(g.atRed).toBeCloseTo(6.667, 3);
    expect(g.missing).toBeCloseTo(54.4 - 41.667, 3);
    expect(g.margin).toBeLessThan(0);
  });
  it('kjøre videre nær linja: over krysset før rødt', () => {
    const g = goOutcome(base, 10);
    expect(g.status).toBe('over');
    expect(g.missing).toBe(0);
    expect(g.margin).toBeCloseTo(3 - 29.4 / base.v0, 10);
  });
  it('kjøre videre langt unna: når ikke linja før rødt', () => {
    const g = goOutcome(base, 60);
    expect(g.status).toBe('rodt');
    expect(g.atRed).toBeLessThan(0);
  });
  it('utfallene stemmer med situasjonen', () => {
    for (const kmh of [20, 35, 50, 65, 90])
      for (const tr of [0.5, 1, 2])
        for (const a of [1, 3, 8])
          for (const tg of [2, 3, 4.5, 6])
            for (const D of [0, 5, 20, 40, 70, 100]) {
              const i = { v0: kmhToMs(kmh), tr, a, tg };
              const s = situation(i, D);
              const stopOk = stopOutcome(i, D).place === 'foer';
              const goOk = goOutcome(i, D).status === 'over';
              expect(stopOk).toBe(s === 'stopp' || s === 'begge');
              expect(goOk).toBe(s === 'kjor' || s === 'begge');
              const z = zones(i);
              if (s === 'dilemma') expect(D > z.dGo && D < z.dStop).toBe(true);
            }
  });
  it('avspillingen varer til bilen står eller er ute av krysset', () => {
    expect(planEndTime(base, 35, 'bremse')).toBeCloseTo(stopTime(base) + 0.4, 10);
    expect(planEndTime(base, 35, 'kjore')).toBeCloseTo(54.4 / base.v0 + 0.6, 10);
    expect(planEndTime(base, 5, 'kjore')).toBeCloseTo(3.6, 10);
    expect(planEndTime({ ...base, v0: kmhToMs(20), a: 1, tr: 2 }, 100, 'kjore')).toBeLessThanOrEqual(30);
  });
});

describe('utsnittet og grafen', () => {
  it('scenen viser bilen, stopplengden og krysset ved standardverdiene', () => {
    const r = sceneRange(35, zones(base));
    expect(r.min).toBe(-60);
    expect(r.max).toBeCloseTo(KRYSS.bredde + CAR_LENGTH + 7, 10);
  });
  it('hele bilen er alltid med, og utsnittet blir ikke for langt', () => {
    for (const kmh of [20, 50, 90])
      for (const a of [1, 3, 8])
        for (const tg of [2, 6])
          for (const D of [0, 30, 100]) {
            const i = { v0: kmhToMs(kmh), tr: 2, a, tg };
            const r = sceneRange(D, zones(i));
            expect(r.min).toBeLessThanOrEqual(-(D + CAR_LENGTH));
            expect(r.min).toBeGreaterThanOrEqual(-130);
            expect(Math.abs(r.min % 10)).toBe(0);
          }
  });
  it('pene akser', () => {
    expect(niceCeil(53)).toBe(60);
    expect(niceCeil(60)).toBe(60);
    expect(niceCeil(61)).toBe(70);
    expect(niceCeil(117)).toBe(120);
    expect(niceCeil(230)).toBe(250);
    expect(niceCeil(141)).toBe(160);
    expect(niceCeil(8)).toBe(8);
    expect(niceCeil(0)).toBe(1);
    expect(graphTop(base, 35)).toBe(60);
    expect(graphTop(base, 100)).toBe(120);
    expect(graphTop({ ...base, v0: kmhToMs(90), a: 1, tr: 2 }, 50)).toBe(250);
  });
  it('ingen ugyldige tall ved ytterverdiene til glidebryterne', () => {
    for (const kmh of [20, 90])
      for (const tr of [0.5, 2])
        for (const a of [1, 8])
          for (const tg of [2, 6])
            for (const D of [0, 100]) {
              const i = { v0: kmhToMs(kmh), tr, a, tg };
              const z = zones(i);
              for (const v of [z.dStop, z.dGo, dilemmaLength(i), yellowNeeded(i), graphTop(i, D)]) expect(Number.isFinite(v)).toBe(true);
              for (const plan of ['bremse', 'kjore'] as const) {
                const T = planEndTime(i, D, plan);
                expect(Number.isFinite(T)).toBe(true);
                for (const t of [0, T / 2, T]) {
                  expect(Number.isFinite(planPosition(i, D, plan, t))).toBe(true);
                  expect(planVelocity(i, plan, t)).toBeGreaterThanOrEqual(0);
                }
              }
            }
  });
});

describe('klikk i grafen', () => {
  it('runder til stegene på glidebryterne og holder seg innenfor', () => {
    expect(pickValues(47.4, 35.6)).toEqual([45, 36]);
    expect(pickValues(48, 35.4)).toEqual([50, 35]);
    expect(pickValues(3, -8)).toEqual([20, 0]);
    expect(pickValues(99, 140)).toEqual([90, 100]);
    expect(pickValues(Number.NaN, Number.NaN)).toEqual([20, 0]);
  });
});

describe('for sakte til å rekke over (grensen for å rekke over er negativ)', () => {
  it('den laveste farten som rekker over fra stopplinja: v · t_g = 19,4 m', () => {
    expect(minGoSpeed(3)).toBeCloseTo(CLEAR_DISTANCE / 3, 12);
    expect(msToKmh(minGoSpeed(3))).toBeCloseTo(23.28, 2);
    expect(minGoSpeed(0)).toBe(Infinity);
    for (const tg of [2, 3, 4.5, 6]) {
      const v = minGoSpeed(tg);
      // Akkurat ved denne farten er grensen 0 m: bilen rekker over bare fra stopplinja
      expect(goLimit({ v0: v, tr: 1, a: 3, tg })).toBeCloseTo(0, 9);
      expect(goLimit({ v0: 0.9 * v, tr: 1, a: 3, tg })).toBeLessThan(0);
      expect(goLimit({ v0: 1.1 * v, tr: 1, a: 3, tg })).toBeGreaterThan(0);
    }
  });

  it('20 km/h med gultid 3 s: selv fra stopplinja rekker bilen bare 16,7 m, så den er i dilemmasonen ved D = 0', () => {
    const input = { v0: kmhToMs(20), tr: 1, a: 3, tg: 3 };
    const z = zones(input);
    expect(yellowDistance(input)).toBeCloseTo(16.67, 2);
    expect(z.dGo).toBeLessThan(0);
    expect(situation(input, 0)).toBe('dilemma');
    expect(kmhToMs(20)).toBeLessThan(minGoSpeed(3));
  });

  it('på glidebryternes rutenett runder aldri minstefarten til en fart som faktisk er for sakte', () => {
    // Teksten viser minstefarten med 0 desimaler; en bil med akkurat den viste farten må være under den ekte grensen
    for (let tg = 2; tg <= 6 + 1e-9; tg += 0.5)
      for (let kmh = 20; kmh <= 90; kmh += 5) {
        const input = { v0: kmhToMs(kmh), tr: 1, a: 3, tg };
        if (zones(input).dGo < 0) expect(Math.round(msToKmh(minGoSpeed(tg)))).toBeGreaterThan(kmh);
      }
  });
});
