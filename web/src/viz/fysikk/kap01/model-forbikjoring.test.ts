import { describe, expect, it } from 'vitest';
import {
  CAR_LENGTH,
  GAP_AHEAD,
  GAP_BEHIND,
  ONCOMING_KMH,
  AFTER_DONE,
  AFTER_MEET,
  PULL_IN_START,
  SPEED_LIMIT_KMH,
  TIGHT_MARGIN,
  TRUCKS,
  carAcceleration,
  carFront,
  carVelocity,
  gapToOncoming,
  graphDuration,
  kmhToMs,
  laneOffset,
  legalAcceleration,
  msToKmh,
  oncomingFront,
  overtakePhase,
  overtakeTime,
  relativeDistance,
  relativeGain,
  relativeVelocity,
  solveOvertake,
  targetFront,
  truckFront,
  truckRear,
  type OvertakeInput,
  type TruckId,
} from './model-forbikjoring';

/** Ytterverdiene, standardverdiene og noen verdier imellom for glidebryterne i visualiseringen. */
const SPEEDS = [30, 45, 60, 70, 80];
const ACCELERATIONS = [0.3, 0.5, 1, 2, 3, 4];
const DISTANCES = [100, 250, 450, 700, 1000];
const TRUCK_IDS: TruckId[] = ['lastebil', 'vogntog'];

function* allInputs(): Generator<OvertakeInput> {
  for (const kmh of SPEEDS)
    for (const a of ACCELERATIONS)
      for (const D of DISTANCES) for (const id of TRUCK_IDS) yield { v0: kmhToMs(kmh), a, D, truckLength: TRUCKS[id].length };
}

/** Standardverdiene: lastebil i 60 km/h, a = 2,0 m/s², møtende bil 450 m unna. */
const DEFAULT: OvertakeInput = { v0: kmhToMs(60), a: 2, D: 450, truckLength: 12 };

describe('enheter og konstanter', () => {
  it('regner om mellom km/h og m/s', () => {
    expect(kmhToMs(72)).toBeCloseTo(20, 12);
    expect(msToKmh(25)).toBeCloseTo(90, 12);
    expect(msToKmh(kmhToMs(83))).toBeCloseTo(83, 12);
  });

  it('har lengder og farter som i virkeligheten', () => {
    expect(CAR_LENGTH).toBe(4.4);
    expect(TRUCKS.lastebil.length).toBe(12);
    expect(TRUCKS.vogntog.length).toBe(19.5);
    expect(ONCOMING_KMH).toBe(80);
    expect(SPEED_LIMIT_KMH).toBe(80);
  });
});

describe('relativ bevegelse', () => {
  it('bilen må flytte seg luke + lastebil + bil + luke i forhold til lastebilen', () => {
    expect(relativeDistance(12)).toBeCloseTo(15 + 12 + 4.4 + 15, 12);
    expect(relativeDistance(19.5)).toBeCloseTo(53.9, 12);
  });

  it('tiden følger av ½·a·T² = Δs_rel', () => {
    expect(overtakeTime(50, 2)).toBeCloseTo(Math.sqrt(50), 12);
    expect(overtakeTime(46.4, 0.5)).toBeCloseTo(Math.sqrt(185.6), 12);
    expect(overtakeTime(46.4, 0)).toBe(Infinity);
    expect(overtakeTime(0, 2)).toBe(0);
  });

  it('dobbel akselerasjon gir ikke halve tiden, men 1/√2 av tiden', () => {
    const t1 = overtakeTime(46.4, 1);
    const t2 = overtakeTime(46.4, 2);
    expect(t2 / t1).toBeCloseTo(1 / Math.SQRT2, 12);
  });

  it('tiden avhenger ikke av farten til lastebilen, men strekningen gjør det', () => {
    const slow = solveOvertake({ ...DEFAULT, v0: kmhToMs(40) });
    const fast = solveOvertake({ ...DEFAULT, v0: kmhToMs(80) });
    expect(slow.T).toBeCloseTo(fast.T, 12);
    expect(fast.s - slow.s).toBeCloseTo(kmhToMs(40) * fast.T, 9);
  });
});

describe('standardverdiene (regnet for hånd)', () => {
  const o = solveOvertake(DEFAULT);

  it('gir T = 6,81 s, s = 160 m og sluttfart 109 km/h', () => {
    expect(o.rel).toBeCloseTo(46.4, 12);
    expect(o.T).toBeCloseTo(6.8118, 4);
    expect(o.sTruck).toBeCloseTo(113.53, 2);
    expect(o.s).toBeCloseTo(159.93, 2);
    expect(o.vEnd).toBeCloseTo(30.290, 3);
    expect(msToKmh(o.vEnd)).toBeCloseTo(109.04, 2);
  });

  it('trenger 311 m og rekker det med 139 m (2,6 s) margin', () => {
    expect(o.u).toBeCloseTo(kmhToMs(80), 12);
    expect(o.sOncoming).toBeCloseTo(151.37, 2);
    expect(o.needed).toBeCloseTo(311.30, 2);
    expect(o.margin).toBeCloseTo(138.70, 2);
    expect(o.timeMargin).toBeCloseTo(2.641, 3);
    expect(o.verdict).toBe('trygt');
  });

  it('møtes etter T, der frontene er like langt fram', () => {
    expect(o.tMeet).toBeCloseTo(o.T + o.timeMargin, 12);
    expect(carFront(o, o.tMeet)).toBeCloseTo(oncomingFront(o, o.tMeet), 9);
    expect(o.xMeet).toBeCloseTo(carFront(o, o.tMeet), 9);
  });

  it('animasjonen slutter litt etter at bilene har passert hverandre', () => {
    expect(o.tEnd).toBeCloseTo(o.tMeet + AFTER_MEET, 12);
    expect(o.tEnd).toBeGreaterThanOrEqual(o.T + AFTER_DONE);
  });
});

describe('vurderingen', () => {
  it('blir kollisjon når avstanden er kortere enn det som trengs', () => {
    const o = solveOvertake({ ...DEFAULT, D: 250 });
    expect(o.margin).toBeCloseTo(250 - 311.30, 2);
    expect(o.verdict).toBe('kollisjon');
    expect(o.tMeet).toBeLessThan(o.T);
    expect(o.timeMargin).toBeLessThan(0);
    // Under forbikjøringen: ½at² + (v₀ + u)t = D
    const t = o.tMeet;
    expect(0.5 * o.a * t * t + (o.v0 + o.u) * t).toBeCloseTo(250, 9);
    expect(o.tEnd).toBeCloseTo(o.tMeet, 12);
  });

  it('blir knepent når bilen er tilbake mindre enn TIGHT_MARGIN før møtet', () => {
    const base = solveOvertake(DEFAULT);
    const D = base.needed + 1.5 * (base.vEnd + base.u); // 1,5 s margin
    const o = solveOvertake({ ...DEFAULT, D });
    expect(o.timeMargin).toBeCloseTo(1.5, 9);
    expect(o.verdict).toBe('knepent');
    const ok = solveOvertake({ ...DEFAULT, D: base.needed + TIGHT_MARGIN * (base.vEnd + base.u) + 0.01 });
    expect(ok.verdict).toBe('trygt');
  });

  it('grensetilfellet D = needed gir møte akkurat ved T', () => {
    const base = solveOvertake(DEFAULT);
    const o = solveOvertake({ ...DEFAULT, D: base.needed });
    expect(o.margin).toBeCloseTo(0, 9);
    expect(o.tMeet).toBeCloseTo(o.T, 6);
    expect(o.verdict).not.toBe('trygt');
  });

  it('uten akselerasjon kommer bilen aldri forbi', () => {
    const o = solveOvertake({ ...DEFAULT, a: 0 });
    expect(o.T).toBe(Infinity);
    expect(o.verdict).toBe('kollisjon');
    expect(o.tMeet).toBeCloseTo(450 / (kmhToMs(60) + kmhToMs(80)), 12);
    expect(o.vEnd).toBe(o.v0);
  });
});

describe('alle kombinasjoner av glidebryterne', () => {
  it('gir endelige tall og fysisk sammenheng', () => {
    for (const input of allInputs()) {
      const o = solveOvertake(input);
      for (const v of [o.T, o.s, o.vEnd, o.needed, o.margin, o.tMeet, o.xMeet, o.tEnd, o.timeMargin]) expect(Number.isFinite(v)).toBe(true);
      // Konstant akselerasjon: s = (v₀ + v)/2 · T og v² − v₀² = 2as
      expect(o.s).toBeCloseTo(((o.v0 + o.vEnd) / 2) * o.T, 9);
      expect(o.vEnd ** 2 - o.v0 ** 2).toBeCloseTo(2 * o.a * o.s, 6);
      // I forhold til lastebilen: (v − v₀)² = 2a·Δs_rel
      expect((o.vEnd - o.v0) ** 2).toBeCloseTo(2 * o.a * o.rel, 6);
      // Bilen er ferdig akkurat når fronten når mållinja
      expect(carFront(o, o.T)).toBeCloseTo(targetFront(o, o.T), 9);
      expect(o.needed).toBeCloseTo(o.s + o.u * o.T, 9);
      // Møtepunktet ligger på begge grafene, og fortegnet på marginen stemmer med rekkefølgen
      expect(gapToOncoming(o, o.tMeet)).toBeCloseTo(0, 6);
      expect(Math.sign(o.timeMargin)).toBe(o.margin === 0 ? 0 : Math.sign(o.margin));
      expect(o.verdict === 'kollisjon').toBe(o.margin < 0);
      expect(o.tEnd).toBeGreaterThan(0);
      expect(graphDuration(o)).toBeGreaterThanOrEqual(o.T - 1e-12);
      expect(graphDuration(o)).toBeGreaterThanOrEqual(o.tEnd - 1e-12);
    }
  });

  it('bilene nærmer seg hele tiden før møtet', () => {
    for (const input of allInputs()) {
      const o = solveOvertake(input);
      let last = gapToOncoming(o, 0);
      expect(last).toBeCloseTo(o.D, 12);
      for (let i = 1; i <= 40; i++) {
        const g = gapToOncoming(o, (o.tMeet * i) / 40);
        expect(g).toBeLessThan(last);
        last = g;
      }
    }
  });
});

describe('bevegelsen', () => {
  const o = solveOvertake(DEFAULT);

  it('er sammenhengende i T, med fart som er stigningstallet til posisjonen', () => {
    const e = 1e-6;
    expect(carFront(o, o.T + e)).toBeCloseTo(carFront(o, o.T - e), 3);
    expect(carVelocity(o, o.T + e)).toBeCloseTo(carVelocity(o, o.T - e), 4);
    for (const t of [0.5, 3, 6, 9, 12]) expect((carFront(o, t + e) - carFront(o, t - e)) / (2 * e)).toBeCloseTo(carVelocity(o, t), 4);
  });

  it('akselererer bare under forbikjøringen', () => {
    expect(carAcceleration(o, -1)).toBe(0);
    expect(carAcceleration(o, 0)).toBe(2);
    expect(carAcceleration(o, o.T / 2)).toBe(2);
    expect(carAcceleration(o, o.T + 0.1)).toBe(0);
    expect(carVelocity(o, -2)).toBeCloseTo(o.v0, 12);
    expect(carFront(o, -2)).toBeCloseTo(-2 * o.v0, 12);
  });

  it('starter GAP_BEHIND bak lastebilen, og lastebilen og den møtende bilen har konstant fart', () => {
    expect(truckRear(o, 0) - carFront(o, 0)).toBe(GAP_BEHIND);
    expect(truckFront(o, 4) - truckRear(o, 4)).toBe(12);
    expect(truckRear(o, 4) - truckRear(o, 1)).toBeCloseTo(3 * o.v0, 12);
    expect(oncomingFront(o, 0)).toBe(450);
    expect(oncomingFront(o, 2) - oncomingFront(o, 5)).toBeCloseTo(3 * o.u, 12);
    expect(targetFront(o, 0)).toBeCloseTo(GAP_BEHIND + 12 + GAP_AHEAD + CAR_LENGTH, 12);
  });
});

describe('bevegelsen i forhold til lastebilen', () => {
  const o = solveOvertake(DEFAULT);

  it('er ½at² og a·t, uavhengig av v₀', () => {
    for (const t of [0, 1, 2.5, 4, o.T]) {
      expect(relativeGain(o, t)).toBeCloseTo(0.5 * o.a * t * t, 9);
      expect(relativeVelocity(o, t)).toBeCloseTo(o.a * t, 9);
    }
    const fast = solveOvertake({ ...DEFAULT, v0: kmhToMs(80) });
    expect(relativeGain(fast, 3)).toBeCloseTo(relativeGain(o, 3), 9);
  });

  it('er bare en fjerdedel av Δs_rel etter halve tiden, og hele Δs_rel ved T', () => {
    expect(relativeGain(o, o.T / 2)).toBeCloseTo(o.rel / 4, 9);
    expect(relativeGain(o, o.T)).toBeCloseTo(o.rel, 9);
    // Etter T kjører bilen fra med konstant relativ fart
    expect(relativeGain(o, o.T + 1) - relativeGain(o, o.T)).toBeCloseTo(o.vEnd - o.v0, 9);
  });

  it('sluttfarten i forhold til lastebilen er dobbelt så stor som snittet', () => {
    for (const input of allInputs()) {
      const s = solveOvertake(input);
      expect(relativeVelocity(s, s.T)).toBeCloseTo((2 * s.rel) / s.T, 9);
    }
  });
});

describe('fasene i forklaringen', () => {
  it('går fra start via bak og ved siden til ferdig', () => {
    const o = solveOvertake(DEFAULT);
    expect(overtakePhase(o, 0)).toBe('start');
    // Fronten når bakenden av lastebilen når ½at² = GAP_BEHIND
    const tAlong = Math.sqrt((2 * GAP_BEHIND) / o.a);
    expect(overtakePhase(o, tAlong - 0.01)).toBe('bak');
    expect(overtakePhase(o, tAlong + 0.01)).toBe('ved siden');
    // Bakenden passerer fronten av lastebilen når ½at² = GAP_BEHIND + L + CAR_LENGTH
    const tAhead = Math.sqrt((2 * (GAP_BEHIND + 12 + CAR_LENGTH)) / o.a);
    expect(overtakePhase(o, tAhead - 0.01)).toBe('ved siden');
    expect(overtakePhase(o, tAhead + 0.01)).toBe('foran');
    expect(overtakePhase(o, o.T - 0.01)).toBe('foran');
    expect(overtakePhase(o, o.T)).toBe('ferdig');
    expect(overtakePhase(o, o.tEnd)).toBe('ferdig');
  });

  it('ender i kollisjon når bilene møtes før T', () => {
    const o = solveOvertake({ ...DEFAULT, D: 250 });
    expect(overtakePhase(o, o.tMeet - 0.01)).not.toBe('kollisjon');
    expect(overtakePhase(o, o.tMeet)).toBe('kollisjon');
    expect(overtakePhase(o, o.T)).toBe('kollisjon');
  });
});

describe('feltskiftet i tegningen', () => {
  it('er ute i motgående felt midt i forbikjøringen og tilbake ved T', () => {
    const o = solveOvertake(DEFAULT);
    expect(laneOffset(o, 0)).toBe(0);
    expect(laneOffset(o, o.T / 2)).toBe(1);
    expect(laneOffset(o, o.T)).toBe(0);
    expect(laneOffset(o, o.T + 1)).toBe(0);
  });

  it('skjærer aldri inn i lastebilen: bilen er helt ute når den er ved siden av lastebilen', () => {
    for (const input of allInputs()) {
      const o = solveOvertake(input);
      for (let i = 0; i <= 200; i++) {
        const t = (o.T * i) / 200;
        const front = carFront(o, t);
        const rear = front - CAR_LENGTH;
        const alongside = front > truckRear(o, t) && rear < truckFront(o, t) + PULL_IN_START;
        if (alongside) expect(laneOffset(o, t)).toBe(1);
      }
    }
  });
});

describe('fartsgrensen', () => {
  it('gir største lovlige akselerasjon: sluttfarten blir akkurat fartsgrensen', () => {
    for (const kmh of [30, 50, 60, 70]) {
      for (const L of [12, 19.5]) {
        const rel = relativeDistance(L);
        const aMax = legalAcceleration(kmhToMs(kmh), rel);
        const o = solveOvertake({ v0: kmhToMs(kmh), a: aMax, D: 1000, truckLength: L });
        expect(msToKmh(o.vEnd)).toBeCloseTo(SPEED_LIMIT_KMH, 9);
      }
    }
    // 60 km/h forbi en lastebil: høyst (80 − 60)² km²/h² … = 0,333 m/s²
    expect(legalAcceleration(kmhToMs(60), 46.4)).toBeCloseTo(kmhToMs(20) ** 2 / 92.8, 12);
    expect(legalAcceleration(kmhToMs(60), 46.4)).toBeCloseTo(0.3326, 4);
  });

  it('er umulig å holde når lastebilen kjører i fartsgrensen', () => {
    expect(legalAcceleration(kmhToMs(80), 46.4)).toBe(0);
    expect(legalAcceleration(kmhToMs(90), 46.4)).toBe(0);
  });
});
