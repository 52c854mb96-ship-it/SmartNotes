import { describe, expect, it } from 'vitest';
import {
  ACCEL_UP,
  ATK_LENGTH,
  BRAKE,
  CAMERA_A_CLOCK,
  QUEUE_END,
  QUEUE_START,
  SITUATION_SLIDERS,
  SPEED_LIMIT_KMH,
  arithmeticMean,
  averageSpeed,
  brakeProfile,
  buildTrip,
  clockText,
  equalDistanceAverage,
  getsFine,
  halvesProfile,
  kmhToMs,
  minLegalTime,
  msToKmh,
  queueProfile,
  rampDistance,
  situationProfile,
  speedRange,
  speedingIntervals,
  speedingTime,
  timeAtPosition,
  tripAcceleration,
  tripAverage,
  tripPosition,
  tripVelocity,
  type Situation,
  type Trip,
} from './model-fartskontroll';

const SITUATIONS: Situation[] = ['brems', 'halvdeler', 'ko'];
const LIMIT = kmhToMs(SPEED_LIMIT_KMH);

/** Alle kombinasjoner av ytterverdiene og standardverdiene til de to glidebryterne i en situasjon. */
function sliderCombos(situation: Situation): [number, number][] {
  const { a, b } = SITUATION_SLIDERS[situation];
  const out: [number, number][] = [];
  for (const va of [a.min, a.value, a.max]) for (const vb of [b.min, b.value, b.max]) out.push([va, vb]);
  return out;
}

/** Strekningen som integralet av v(t) (trapesmetoden): skal bli lik L. */
function integrateVelocity(trip: Trip, n = 20000): number {
  let sum = 0;
  const h = trip.T / n;
  for (let i = 0; i < n; i++) sum += 0.5 * (tripVelocity(trip, i * h) + tripVelocity(trip, (i + 1) * h)) * h;
  return sum;
}

describe('enheter og konstanter', () => {
  it('regner om mellom km/h og m/s', () => {
    expect(kmhToMs(72)).toBeCloseTo(20, 12);
    expect(msToKmh(25)).toBeCloseTo(90, 12);
    expect(msToKmh(kmhToMs(83))).toBeCloseTo(83, 12);
  });

  it('gir 180 s som minste lovlige tid på 4,0 km med 80 km/h', () => {
    expect(minLegalTime()).toBeCloseTo(180, 9);
    expect(minLegalTime(ATK_LENGTH, 60)).toBeCloseTo(240, 9);
    expect(minLegalTime(1000, 36)).toBeCloseTo(100, 9);
  });

  it('gir bot bare når snittfarten er over fartsgrensen', () => {
    expect(getsFine(80)).toBe(false);
    expect(getsFine(79.9)).toBe(false);
    expect(getsFine(80.1)).toBe(true);
    expect(getsFine(55, 50)).toBe(true);
  });
});

describe('buildTrip og bevegelsen', () => {
  it('jevn fart: T = L / v, snittfart = momentanfart overalt', () => {
    const v = kmhToMs(80);
    const trip = buildTrip([
      { s: 0, v },
      { s: ATK_LENGTH, v },
    ]);
    expect(trip.T).toBeCloseTo(180, 9);
    expect(tripAverage(trip)).toBeCloseTo(v, 12);
    for (const t of [10, 90, 179]) {
      expect(tripPosition(trip, t)).toBeCloseTo(v * t, 9);
      expect(tripVelocity(trip, t)).toBeCloseTo(v, 12);
      expect(averageSpeed(trip, t)).toBeCloseTo(v, 12);
      expect(tripAcceleration(trip, t)).toBe(0);
    }
  });

  it('konstant akselerasjon fra lærebokformlene: v = v₀ + at, s = v₀t + ½at², v² − v₀² = 2as', () => {
    // Fra 10 m/s til 30 m/s på 400 m: a = (900 − 100) / 800 = 1,0 m/s², t = 2 · 400 / 40 = 20 s
    const trip = buildTrip([
      { s: 0, v: 10 },
      { s: 400, v: 30 },
    ]);
    expect(trip.T).toBeCloseTo(20, 12);
    expect(tripAcceleration(trip, 5)).toBeCloseTo(1, 12);
    expect(tripVelocity(trip, 5)).toBeCloseTo(15, 12);
    expect(tripPosition(trip, 5)).toBeCloseTo(10 * 5 + 0.5 * 25, 12);
    expect(tripPosition(trip, 20)).toBeCloseTo(400, 9);
    expect(timeAtPosition(trip, 62.5)).toBeCloseTo(5, 9);
  });

  it('nedbremsing: farten avtar lineært og strekningen stemmer', () => {
    // Fra 30 m/s til 10 m/s på 160 m: a = (100 − 900) / 320 = −2,5 m/s², t = 320 / 40 = 8 s
    const trip = buildTrip([
      { s: 0, v: 30 },
      { s: 160, v: 10 },
    ]);
    expect(tripAcceleration(trip, 1)).toBeCloseTo(-2.5, 12);
    expect(trip.T).toBeCloseTo(8, 12);
    expect(tripVelocity(trip, 4)).toBeCloseTo(20, 12);
    expect(tripPosition(trip, 4)).toBeCloseTo(30 * 4 - 0.5 * 2.5 * 16, 12);
    expect(timeAtPosition(trip, 100)).toBeCloseTo(4, 9);
  });

  it('hopper over punkter på samme sted med samme fart, og avviser ugyldige profiler', () => {
    const trip = buildTrip([
      { s: 0, v: 20 },
      { s: 0, v: 20 },
      { s: 100, v: 20 },
    ]);
    expect(trip.phases).toHaveLength(1);
    expect(() => buildTrip([])).toThrow();
    expect(() =>
      buildTrip([
        { s: 0, v: 20 },
        { s: 0, v: 25 },
      ]),
    ).toThrow();
    expect(() =>
      buildTrip([
        { s: 10, v: 20 },
        { s: 0, v: 20 },
      ]),
    ).toThrow();
    expect(() =>
      buildTrip([
        { s: 0, v: 0 },
        { s: 10, v: 20 },
      ]),
    ).toThrow();
  });

  it('kjører med konstant fart før kamera A og etter kamera B', () => {
    const trip = buildTrip(brakeProfile(kmhToMs(105), kmhToMs(75)));
    expect(tripVelocity(trip, -3)).toBeCloseTo(kmhToMs(75), 12);
    expect(tripPosition(trip, -2)).toBeCloseTo(-2 * kmhToMs(75), 9);
    expect(tripPosition(trip, trip.T + 2)).toBeCloseTo(ATK_LENGTH + 2 * kmhToMs(75), 9);
    expect(tripAcceleration(trip, -1)).toBe(0);
    expect(averageSpeed(trip, 0)).toBeNaN();
    expect(tripPosition(trip, NaN)).toBeNaN();
  });
});

describe('alle situasjoner og tallsett', () => {
  for (const situation of SITUATIONS) {
    for (const [a, b] of sliderCombos(situation)) {
      it(`${situation} med ${a} og ${b} km/h: sammenhengende, glatt og fysisk riktig`, () => {
        const points = situationProfile(situation, a, b);
        // Punktene kommer i rekkefølge langs veien og starter i A og slutter i B
        expect(points[0]!.s).toBe(0);
        expect(points[points.length - 1]!.s).toBeCloseTo(ATK_LENGTH, 9);
        for (let i = 1; i < points.length; i++) expect(points[i]!.s).toBeGreaterThanOrEqual(points[i - 1]!.s - 1e-9);
        const trip = buildTrip(points);
        expect(trip.L).toBeCloseTo(ATK_LENGTH, 9);
        expect(Number.isFinite(trip.T) && trip.T > 0).toBe(true);
        expect(tripPosition(trip, trip.T)).toBeCloseTo(ATK_LENGTH, 6);

        // Akselerasjonene er de faste verdiene (eller 0)
        for (const p of trip.phases) {
          expect([0, ACCEL_UP, -BRAKE].some((x) => Math.abs(p.a - x) < 1e-9)).toBe(true);
          expect(p.dt).toBeGreaterThan(0);
        }

        // Posisjonen og farten er sammenhengende i overgangene mellom fasene
        for (let i = 1; i < trip.phases.length; i++) {
          const p = trip.phases[i - 1]!;
          const q = trip.phases[i]!;
          expect(q.t0).toBeCloseTo(p.t0 + p.dt, 9);
          expect(tripPosition(trip, q.t0 - 1e-7)).toBeCloseTo(tripPosition(trip, q.t0 + 1e-7), 4);
          expect(tripVelocity(trip, q.t0 - 1e-7)).toBeCloseTo(tripVelocity(trip, q.t0 + 1e-7), 4);
        }

        // Farten er den deriverte av posisjonen (stigningstallet til tangenten)
        for (const f of [0.03, 0.31, 0.5, 0.77, 0.98]) {
          const t = f * trip.T;
          const h = 1e-4;
          const slope = (tripPosition(trip, t + h) - tripPosition(trip, t - h)) / (2 * h);
          expect(slope).toBeCloseTo(tripVelocity(trip, t), 4);
        }

        // Arealet under v-t-grafen er strekningen
        expect(integrateVelocity(trip)).toBeCloseTo(ATK_LENGTH, 1);

        // Tiden ved en posisjon er det motsatte av posisjonen ved en tid
        for (const s of [0, 137, 1500, 1999, 2001, 3900, ATK_LENGTH]) expect(tripPosition(trip, timeAtPosition(trip, s))).toBeCloseTo(s, 6);

        // Snittfarten ligger mellom laveste og høyeste fart
        const [lo, hi] = speedRange(trip);
        const avg = tripAverage(trip);
        expect(avg).toBeGreaterThanOrEqual(lo - 1e-9);
        expect(avg).toBeLessThanOrEqual(hi + 1e-9);
        expect(avg).toBeCloseTo(averageSpeed(trip, trip.T), 9);

        // Middelverdisetningen: er snittfarten over grensen, har bilen kjørt for fort en del av tiden
        if (getsFine(msToKmh(avg))) expect(speedingTime(trip, LIMIT)).toBeGreaterThan(0);
        // … og kjører den aldri over grensen, kan snittfarten ikke bli over grensen
        if (hi <= LIMIT) expect(getsFine(msToKmh(avg))).toBe(false);
        // Bot nøyaktig når tiden er kortere enn den minste lovlige tiden
        expect(getsFine(msToKmh(avg))).toBe(trip.T < minLegalTime() - 1e-9);
      });
    }
  }
});

describe('bremser før kameraene', () => {
  it('passerer begge kameraene med farten forbi kameraene', () => {
    const trip = buildTrip(brakeProfile(kmhToMs(105), kmhToMs(75)));
    expect(msToKmh(tripVelocity(trip, 0))).toBeCloseTo(75, 9);
    expect(msToKmh(tripVelocity(trip, trip.T))).toBeCloseTo(75, 9);
    expect(msToKmh(tripVelocity(trip, trip.T / 2))).toBeCloseTo(105, 9);
  });

  it('standardvalget gir bot selv om speedometeret viser 75 km/h ved kameraene', () => {
    const { a, b } = SITUATION_SLIDERS.brems;
    const trip = buildTrip(situationProfile('brems', a.value, b.value));
    const avg = msToKmh(tripAverage(trip));
    expect(avg).toBeGreaterThan(100);
    expect(avg).toBeLessThan(105);
    expect(getsFine(avg)).toBe(true);
    // Å bremse før kameraet hjelper lite: snittfarten blir bare noen få km/h lavere enn farten mellom kameraene
    expect(105 - avg).toBeLessThan(4);
  });

  it('overgangene har riktig lengde: gass med 1,5 m/s² og brems med 2,5 m/s²', () => {
    const vFast = kmhToMs(108);
    const vCam = kmhToMs(72);
    const p = brakeProfile(vFast, vCam);
    expect(p[1]!.s).toBeCloseTo((30 * 30 - 20 * 20) / (2 * 1.5), 9);
    expect(ATK_LENGTH - p[2]!.s).toBeCloseTo((30 * 30 - 20 * 20) / (2 * 2.5), 9);
    expect(rampDistance(20, 30)).toBeCloseTo(500 / 3, 9);
    expect(rampDistance(30, 20)).toBeCloseTo(100, 9);
    expect(rampDistance(25, 25)).toBe(0);
  });

  it('like farter gir jevn fart og snittfart lik farten', () => {
    const trip = buildTrip(brakeProfile(kmhToMs(80), kmhToMs(80)));
    expect(trip.phases).toHaveLength(1);
    expect(msToKmh(tripAverage(trip))).toBeCloseTo(80, 9);
    expect(getsFine(msToKmh(tripAverage(trip)))).toBe(false);
    expect(speedingTime(trip, LIMIT)).toBe(0);
  });

  it('en for kort strekning gir et toppunkt på den farten bilen rekker', () => {
    const vCam = 10;
    const p = brakeProfile(40, vCam, 200);
    const trip = buildTrip(p);
    const [, hi] = speedRange(trip);
    // (v² − 100) · (1/3 + 1/5) = 200 ⇒ v² = 100 + 375
    expect(hi).toBeCloseTo(Math.sqrt(475), 9);
    expect(trip.L).toBeCloseTo(200, 9);
    expect(tripVelocity(trip, trip.T)).toBeCloseTo(vCam, 9);
  });
});

describe('to halvdeler', () => {
  it('snittfarten er ikke gjennomsnittet av fartene', () => {
    const { a, b } = SITUATION_SLIDERS.halvdeler;
    const trip = buildTrip(situationProfile('halvdeler', a.value, b.value));
    const avg = msToKmh(tripAverage(trip));
    const naive = arithmeticMean(a.value, b.value);
    expect(naive).toBe(85);
    expect(getsFine(naive)).toBe(true);
    // Den riktige snittfarten er under grensen: ingen bot
    expect(avg).toBeLessThan(SPEED_LIMIT_KMH);
    expect(getsFine(avg)).toBe(false);
    // og nær 2v₁v₂ / (v₁ + v₂) = 77,6 km/h (litt høyere fordi bremsingen tar litt mindre tid enn et brått skifte)
    expect(avg).toBeCloseTo(equalDistanceAverage(110, 60), 0);
  });

  it('120 og 60 km/h gir 80 km/h i snitt uten fartsendringstid, ikke 90 km/h', () => {
    expect(equalDistanceAverage(120, 60)).toBeCloseTo(80, 12);
    expect(arithmeticMean(120, 60)).toBe(90);
  });

  it('nærmer seg 2v₁v₂ / (v₁ + v₂) når fartsendringen er brå (kort overgang)', () => {
    const v1 = kmhToMs(110);
    const v2 = kmhToMs(60);
    const trip = buildTrip([
      { s: 0, v: v1 },
      { s: 1999.95, v: v1 },
      { s: 2000.05, v: v2 },
      { s: 4000, v: v2 },
    ]);
    expect(tripAverage(trip)).toBeCloseTo(equalDistanceAverage(v1, v2), 4);
  });

  it('bruker lengst tid på den langsomme halvdelen', () => {
    const trip = buildTrip(halvesProfile(kmhToMs(110), kmhToMs(60)));
    const tHalf = timeAtPosition(trip, ATK_LENGTH / 2);
    expect(tHalf).toBeLessThan(trip.T - tHalf);
    expect(tHalf).toBeCloseTo(2000 / kmhToMs(110), -1);
  });
});

describe('kø på strekningen', () => {
  it('har køfarten i hele køen', () => {
    const trip = buildTrip(queueProfile(kmhToMs(100), kmhToMs(20)));
    const t0 = timeAtPosition(trip, QUEUE_START);
    const t1 = timeAtPosition(trip, QUEUE_END);
    expect(msToKmh(tripVelocity(trip, t0 + 0.01))).toBeCloseTo(20, 6);
    expect(msToKmh(tripVelocity(trip, t1 - 0.01))).toBeCloseTo(20, 6);
    expect(t1 - t0).toBeCloseTo(500 / kmhToMs(20), 6);
  });

  it('standardvalget: ingen bot fra ATK, men bilen kjører for fort mesteparten av strekningen', () => {
    const { a, b } = SITUATION_SLIDERS.ko;
    const trip = buildTrip(situationProfile('ko', a.value, b.value));
    expect(getsFine(msToKmh(tripAverage(trip)))).toBe(false);
    expect(speedingTime(trip, LIMIT)).toBeGreaterThan(90);
  });
});

describe('fartsoverskridelser', () => {
  it('finner tidsrommene over grensen og slår sammen tilstøtende', () => {
    // 20 → 30 m/s over 250 m (a = 1, 10 s), 30 m/s i 300 m (10 s), 30 → 20 m/s over 250 m (a = −1, 10 s)
    const trip = buildTrip([
      { s: 0, v: 20 },
      { s: 250, v: 30 },
      { s: 550, v: 30 },
      { s: 800, v: 20 },
    ]);
    const iv = speedingIntervals(trip, 25);
    expect(iv).toHaveLength(1);
    expect(iv[0]![0]).toBeCloseTo(5, 9);
    expect(iv[0]![1]).toBeCloseTo(25, 9);
    expect(speedingTime(trip, 25)).toBeCloseTo(20, 9);
    expect(speedingTime(trip, 40)).toBe(0);
    expect(speedingTime(trip, 10)).toBeCloseTo(trip.T, 9);
  });

  it('gir høyeste og laveste fart', () => {
    const trip = buildTrip(queueProfile(kmhToMs(120), kmhToMs(30)));
    const [lo, hi] = speedRange(trip);
    expect(msToKmh(lo)).toBeCloseTo(30, 9);
    expect(msToKmh(hi)).toBeCloseTo(120, 9);
  });
});

describe('klokkeslett', () => {
  it('skriver timer, minutter, sekunder og tideler', () => {
    expect(clockText(CAMERA_A_CLOCK)).toBe('14:02:10,4');
    expect(clockText(CAMERA_A_CLOCK + 161.46)).toBe('14:04:51,9');
    expect(clockText(CAMERA_A_CLOCK + 49.6)).toBe('14:03:00,0');
    expect(clockText(3599.96)).toBe('01:00:00,0');
    expect(clockText(NaN)).toBe('–');
  });

  it('Δt fra de avrundede klokkeslettene stemmer med T avrundet til tideler', () => {
    for (const T of [111.11, 142.05, 161.46, 179.99, 480.04]) {
      const tenthsB = Math.round((CAMERA_A_CLOCK + T) * 10);
      const tenthsA = Math.round(CAMERA_A_CLOCK * 10);
      expect((tenthsB - tenthsA) / 10).toBeCloseTo(Math.round(T * 10) / 10, 9);
    }
  });
});
