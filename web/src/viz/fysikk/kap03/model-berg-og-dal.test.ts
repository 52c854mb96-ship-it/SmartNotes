import { describe, expect, it } from 'vitest';
import { G_EARTH } from '../../kit/format';
import {
  CART_MASS,
  COASTER_MU,
  CREST_DX,
  CREST_RISE,
  H0_MAX,
  H0_MIN,
  MAX_RIDERS,
  POINT_IDS,
  RIDER_MASS,
  cartMass,
  energyState,
  getPoint,
  makeCoaster,
  minStartHeight,
  pointResults,
  reachHeight,
  rideAt,
  segmentAngle,
  simulateRide,
  speedSquared,
  turningPoint,
} from './model-berg-og-dal';

const g = G_EARTH;
/** Alle starthøydene glidebryteren kan gi (steg 0,5 m). */
const H0S = Array.from({ length: Math.round((H0_MAX - H0_MIN) / 0.5) + 1 }, (_, i) => H0_MIN + 0.5 * i);
const MUS = [0, COASTER_MU];

describe('banen', () => {
  it.each([H0_MIN, 20, 26, H0_MAX])('h₀ = %s m: sammenhengende høyde og helning, vogna starter i høyden h₀', (h0) => {
    const c = makeCoaster(h0);
    expect(c.height(0)).toBeCloseTo(h0, 9);
    // Startpunktet ligger på toppbuen, 3 m etter toppen, og banen heller nedover der (vogna triller av seg selv).
    expect(c.crest.x).toBe(-CREST_DX);
    expect(c.crest.h).toBeCloseTo(h0 + CREST_RISE, 9);
    expect(c.height(c.crest.x)).toBeCloseTo(c.crest.h, 9);
    expect(c.slope(0)).toBeLessThan(-0.3);
    for (let i = 1; i < c.pieces.length; i++) {
      const a = c.pieces[i - 1]!;
      const b = c.pieces[i]!;
      expect(b.x0).toBeCloseTo(a.x1, 9);
      // Høyde og helning like på begge sider av skjøten
      expect(c.height(b.x0 + 1e-7)).toBeCloseTo(c.height(a.x1 - 1e-7), 5);
      expect(c.slope(b.x0 + 1e-7)).toBeCloseTo(c.slope(a.x1 - 1e-7), 4);
    }
  });

  it('toppene og bunnene ligger der de skal, med vannrett tangent', () => {
    const c = makeCoaster(26);
    for (const e of c.extremes) {
      expect(c.height(e.x)).toBeCloseTo(e.h, 9);
      expect(Math.abs(c.slope(e.x))).toBeLessThan(1e-6);
    }
    expect(getPoint(c, 'A').h).toBe(0);
    expect(getPoint(c, 'B')).toMatchObject({ h: 20, top: true });
    expect(getPoint(c, 'C')).toMatchObject({ h: 14, top: true });
    expect(getPoint(c, 'D')).toMatchObject({ h: 2, top: false });
    expect(c.xEnd).toBe(getPoint(c, 'D').x);
  });

  it('nullnivået er det laveste punktet på turen, og toppen av heisebakken er den høyeste', () => {
    for (const h0 of H0S) {
      const c = makeCoaster(h0);
      let lo = Infinity;
      let hi = -Infinity;
      for (let x = 0; x <= c.xEnd; x += 0.1) {
        lo = Math.min(lo, c.height(x));
        hi = Math.max(hi, c.height(x));
      }
      expect(lo).toBeCloseTo(0, 6);
      // Startpunktet er høyest på turen når h₀ er over B (20 m); ellers er B høyest
      expect(hi).toBeCloseTo(Math.max(h0, 20), 6);
      expect(c.crest.h).toBeGreaterThan(h0);
    }
  });

  it('krumningen er 1/r i toppene (negativ) og bunnene (positiv)', () => {
    const c = makeCoaster(26);
    expect(c.curvature(22)).toBeCloseTo(1 / 14, 9);
    expect(c.curvature(48)).toBeCloseTo(-1 / 8, 9);
    expect(c.curvature(c.crest.x)).toBeCloseTo(-1 / 8, 9);
    expect(c.curvature(120)).toBe(0);
  });

  it('bakkene er bratte, men ikke loddrette (28°–80°)', () => {
    for (const h0 of [H0_MIN, H0_MAX]) {
      const th = (segmentAngle(25, h0 + CREST_RISE, 8, 14).theta * 180) / Math.PI;
      expect(th).toBeGreaterThan(28);
      expect(th).toBeLessThan(80);
    }
    // Radiene trenger ikke gjøres mindre for noen av bakkene
    expect(segmentAngle(26, 20, 14, 8)).toMatchObject({ r0: 14, r1: 8 });
    expect(segmentAngle(25, H0_MAX + CREST_RISE, CREST_DX + 5, 14)).toMatchObject({ r0: 8, r1: 14 });
  });

  it('strekningen langs banen stemmer med ∫√(1 + h′²) dx', () => {
    const c = makeCoaster(30);
    expect(c.pathLength(0)).toBeCloseTo(0, 12);
    let s = 0;
    const dx = 0.001;
    for (let x = dx / 2; x < c.xEnd; x += dx) s += Math.sqrt(1 + c.slope(x) ** 2) * dx;
    expect(c.pathLength(c.xEnd)).toBeCloseTo(s, 1);
    // Lengre enn den vannrette avstanden, og voksende
    expect(c.pathLength(c.xEnd)).toBeGreaterThan(c.xEnd);
    let prev = -Infinity;
    for (let x = -5; x <= c.xEnd; x += 0.5) {
      expect(c.pathLength(x)).toBeGreaterThan(prev);
      prev = c.pathLength(x);
    }
  });
});

describe('energibevaring: farten i hvert punkt', () => {
  it('uten friksjon er v = √(2g(h₀ − h)), uavhengig av banen', () => {
    const c = makeCoaster(26);
    const res = pointResults(c, 0);
    const byId = Object.fromEntries(res.map((p) => [p.id, p]));
    expect(byId.A!.v).toBeCloseTo(Math.sqrt(2 * g * 26), 9); // 22,59 m/s
    expect(byId.A!.v).toBeCloseTo(22.59, 2);
    expect(byId.B!.v).toBeCloseTo(Math.sqrt(2 * g * 6), 9); // 10,85 m/s
    expect(byId.C!.v).toBeCloseTo(Math.sqrt(2 * g * 12), 9);
    expect(byId.D!.v).toBeCloseTo(Math.sqrt(2 * g * 24), 9);
    for (const p of res) expect(p.reach).toBe(26);
  });

  it('med friksjon er v = √(2g(h₀ − h − μs))', () => {
    const c = makeCoaster(26);
    for (const p of pointResults(c, COASTER_MU)) {
      expect(p.reach).toBeCloseTo(26 - COASTER_MU * p.s, 12);
      expect(p.v).toBeCloseTo(Math.sqrt(2 * g * (26 - p.h - COASTER_MU * p.s)), 9);
    }
    // Lavere fart med friksjon, og mer tapt jo lenger vogna har kjørt
    const without = pointResults(c, 0);
    const withMu = pointResults(c, COASTER_MU);
    for (let i = 0; i < 4; i++) expect(withMu[i]!.v!).toBeLessThan(without[i]!.v!);
  });

  it('farten er uavhengig av massen (passasjerene), men energiene er proporsjonale med m', () => {
    const c = makeCoaster(24);
    const B = getPoint(c, 'B');
    for (const mu of MUS) {
      const light = energyState({ m: cartMass(0), h0: 24, h: B.h, s: B.s, mu });
      const heavy = energyState({ m: cartMass(MAX_RIDERS), h0: 24, h: B.h, s: B.s, mu });
      expect(heavy.v).toBeCloseTo(light.v, 12);
      expect(heavy.E0 / light.E0).toBeCloseTo(cartMass(MAX_RIDERS) / cartMass(0), 12);
      expect(light.v).toBeCloseTo(Math.sqrt(speedSquared(c, B.x, mu)), 9);
    }
    expect(cartMass(0)).toBe(CART_MASS);
    expect(cartMass(2)).toBe(CART_MASS + 2 * RIDER_MASS);
  });

  it('energiregnskapet går opp: E₀ = E_p + E_k + R·s (650 kg, h₀ = 26 m, B med friksjon)', () => {
    const c = makeCoaster(26);
    const B = getPoint(c, 'B');
    const e = energyState({ m: 650, h0: 26, h: 20, s: B.s, mu: COASTER_MU });
    expect(e.E0).toBeCloseTo(650 * 9.81 * 26, 9); // 165,8 kJ
    expect(e.Ep).toBeCloseTo(127_530, 6);
    expect(e.R).toBeCloseTo(0.03 * 650 * 9.81, 9); // 191 N
    expect(e.Ep + e.Ek + e.heat).toBeCloseTo(e.E0, 6);
    expect(e.E).toBeCloseTo(e.E0 - e.heat, 6);
    expect(e.v).toBeCloseTo(Math.sqrt((2 * e.Ek) / 650), 12);
    // Når ikke vogna fram, blir E_k negativ og farten 0
    const low = energyState({ m: 650, h0: 18, h: 20, s: B.s, mu: 0 });
    expect(low.Ek).toBeLessThan(0);
    expect(low.v).toBe(0);
  });
});

describe('vendepunkt og laveste starthøyde', () => {
  it('uten friksjon kommer vogna over alle toppene bare når h₀ er høyere enn B (20 m)', () => {
    expect(turningPoint(makeCoaster(20.5), 0)).toBeNull();
    const t = turningPoint(makeCoaster(18), 0)!;
    expect(t.h).toBeCloseTo(18, 6); // snur i starthøyden
    expect(t.x).toBeGreaterThan(getPoint(makeCoaster(18), 'A').x);
    expect(t.x).toBeLessThan(48);
    // Like høy som toppen: stopper akkurat på toppen
    expect(turningPoint(makeCoaster(20), 0)!.x).toBeCloseTo(48, 3);
    expect(minStartHeight(0)).toBeCloseTo(20, 6);
  });

  it('med friksjon snur vogna lavere, der h₀ − μs = h', () => {
    const c = makeCoaster(20);
    const t = turningPoint(c, COASTER_MU)!;
    expect(t.h).toBeLessThan(20);
    expect(t.h).toBeCloseTo(20 - COASTER_MU * t.s, 6);
    expect(reachHeight(c, t.x, COASTER_MU)).toBeCloseTo(t.h, 6);
  });

  it('med friksjon må h₀ være høyere: B pluss friksjonsarbeidet fram til B', () => {
    const hMin = minStartHeight(COASTER_MU);
    expect(hMin).toBeGreaterThan(21.5);
    expect(hMin).toBeLessThan(22.5);
    const c = makeCoaster(hMin);
    // Med friksjon er farten minst litt etter toppen (der helningen nedover er like stor som μ), så grensen ligger
    // noen millimeter over 20 m + μs_B.
    expect(hMin).toBeGreaterThanOrEqual(20 + COASTER_MU * getPoint(c, 'B').s);
    expect(hMin).toBeCloseTo(20 + COASTER_MU * getPoint(c, 'B').s, 2);
    expect(turningPoint(makeCoaster(hMin + 0.01), COASTER_MU)).toBeNull();
    expect(turningPoint(makeCoaster(hMin - 0.01), COASTER_MU)).not.toBeNull();
  });

  it('punktene etter vendepunktet nås ikke', () => {
    const res = pointResults(makeCoaster(15), COASTER_MU);
    expect(res.map((p) => p.v === null)).toEqual([false, true, true, true]);
  });
});

describe('simuleringen', () => {
  it.each(MUS)('μ = %s: farten i hvert punkt stemmer med energibevaringen', (mu) => {
    const c = makeCoaster(26);
    const ride = simulateRide(c, mu);
    expect(ride.endTime).not.toBeNull();
    for (const p of pointResults(c, mu)) {
      const s = rideAt(ride, ride.firstTime[p.id]);
      expect(s.x).toBeCloseTo(p.x, 1);
      expect(s.v).toBeCloseTo(p.v!, 1);
      expect(s.d).toBeCloseTo(p.s, 1);
    }
    expect(ride.tEnd).toBe(ride.endTime);
    expect(rideAt(ride, ride.tEnd).x).toBeCloseTo(c.xEnd, 9);
  });

  it.each(MUS)('μ = %s: ½v² + gh + μgd = gh₀ i hvert lagret punkt', (mu) => {
    for (const h0 of [12, 21, 33]) {
      const c = makeCoaster(h0);
      for (const s of simulateRide(c, mu).samples) {
        expect(0.5 * s.v ** 2 + g * c.height(s.x) + mu * g * s.d).toBeCloseTo(g * h0, 1);
      }
    }
  });

  it('uten friksjon og for lav start pendler vogna mellom startpunktet og vendepunktet', () => {
    const c = makeCoaster(18);
    const ride = simulateRide(c, 0);
    const turn = turningPoint(c, 0)!;
    const xs = ride.samples.map((s) => s.x);
    expect(Math.max(...xs)).toBeLessThan(turn.x + 0.01);
    expect(Math.max(...xs)).toBeGreaterThan(turn.x - 0.05);
    expect(Math.min(...xs.slice(10))).toBeGreaterThan(-0.01);
    expect(ride.endTime).toBeNull();
    expect(ride.stopTime).toBeNull();
    expect(ride.turnTime).toBeGreaterThan(0);
    expect(ride.firstTime.B).toBe(ride.turnTime);
    expect(rideAt(ride, ride.turnTime!).v).toBeCloseTo(0, 1);
  });

  it('like høy som B uten friksjon: vogna kommer ikke over toppen', () => {
    const ride = simulateRide(makeCoaster(20), 0);
    expect(Math.max(...ride.samples.map((s) => s.x))).toBeLessThanOrEqual(48);
    expect(ride.endTime).toBeNull();
    expect(ride.firstTime.B).toBe(ride.turnTime);
  });

  it('med friksjon og for lav start blir vogna stående i dalen ved A, og all energi er blitt termisk', () => {
    const c = makeCoaster(14);
    // Svingningene i dalen dør sakte ut (omtrent halvannet minutt), så simuler lenge.
    const ride = simulateRide(c, COASTER_MU, { tMax: 200 });
    expect(ride.stopTime).not.toBeNull();
    const last = ride.samples[ride.samples.length - 1]!;
    expect(last.v).toBe(0);
    expect(Math.abs(last.x - 22)).toBeLessThan(6);
    // Står i ro: tyngdekomponenten langs banen klarer ikke å overvinne friksjonen
    expect(Math.abs(c.slope(last.x)) / Math.sqrt(1 + c.slope(last.x) ** 2)).toBeLessThanOrEqual(COASTER_MU + 1e-9);
    expect(g * c.height(last.x) + COASTER_MU * g * last.d).toBeCloseTo(g * 14, 1);
    expect(ride.tEnd).toBeCloseTo(ride.stopTime! + 0.6, 9);
  });

  it('alle starthøyder, med og uten friksjon: endelige tall og en tid for hvert punkt', () => {
    for (const h0 of H0S) {
      for (const mu of MUS) {
        const c = makeCoaster(h0);
        const ride = simulateRide(c, mu);
        expect(ride.tEnd).toBeGreaterThan(0);
        for (const s of ride.samples) expect(Number.isFinite(s.x + s.v + s.d)).toBe(true);
        const passes = turningPoint(c, mu) === null;
        expect(ride.endTime !== null).toBe(passes);
        for (const id of POINT_IDS) {
          expect(Number.isFinite(ride.firstTime[id])).toBe(true);
          expect(ride.firstTime[id]).toBeLessThanOrEqual(ride.tEnd);
        }
        for (const p of pointResults(c, mu)) expect(p.v === null || Number.isFinite(p.v)).toBe(true);
      }
    }
  });
});
