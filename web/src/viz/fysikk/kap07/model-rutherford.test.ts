import { describe, expect, it } from 'vitest';
import {
  ALPHA,
  ALPHA_ENERGY_MEV,
  BIN_COUNT,
  BIN_EDGES_DEG,
  B_MAX,
  ELECTRON_MASS,
  FM,
  GOLD,
  HARD_LIMIT,
  MEV_J,
  N_TOTAL,
  PLAY_TIME,
  RING_BUCKETS,
  VIEW_RADIUS,
  alphaElectronMassRatio,
  alphaSpeed,
  areaPerAtom,
  asymptoteCenter,
  atomSpacing,
  binIndex,
  binProbabilities,
  chancePerAtom,
  closestApproach,
  deg,
  eccentricity,
  electronMaxAngle,
  fireTime,
  firedCount,
  foilLayers,
  foilSetup,
  goldAlphaMassRatio,
  hardRate,
  headOnDistance,
  impactForAngle,
  largeAngleIndices,
  nucleusForce,
  pointAt,
  probAbove,
  rad,
  rutherfordAngle,
  rutherfordSoftSigma,
  simulateExperiment,
  speedAt,
  tally,
  targetRadiusFromCount,
  thomsonAngle,
  thomsonLog10Above,
  thomsonMaxAngle,
  thomsonMaxForce,
  thomsonSigma,
  trajectory,
} from './model-rutherford';

const s = foilSetup();
const exp = simulateExperiment();

describe('konstanter og α-partikkelen', () => {
  it('α-partikkelen er en heliumkjerne med masse 4,00 u = 6,64 · 10⁻²⁷ kg og ladning +2e', () => {
    expect(ALPHA.mass).toBeCloseTo(6.64e-27, 29);
    expect(ALPHA.charge).toBeCloseTo(3.2e-19, 21);
    expect(ALPHA_ENERGY_MEV).toBe(5.5);
  });

  it('farten fra E_k = ½mv² er ca. 1,6 · 10⁷ m/s (ca. 5 % av lysfarten)', () => {
    const v = alphaSpeed();
    expect(v).toBeCloseTo(1.628e7, -4);
    expect(0.5 * ALPHA.mass * v * v).toBeCloseTo(5.5 * MEV_J, 20);
    expect(v / 3.0e8).toBeGreaterThan(0.05);
    expect(v / 3.0e8).toBeLessThan(0.06);
  });

  it('masseforholdene: elektronet er ca. 7 300 ganger lettere, gullkjernen ca. 49 ganger tyngre enn α', () => {
    expect(alphaElectronMassRatio()).toBeCloseTo(6.64e-27 / 9.11e-31, 6);
    expect(Math.round(alphaElectronMassRatio() / 10) * 10).toBe(7290);
    expect(goldAlphaMassRatio()).toBeCloseTo(49.25, 2);
  });

  it('gull: atomavstand ca. 2,57 · 10⁻¹⁰ m og ca. 2 300 atomlag i en folie på 0,6 µm', () => {
    expect(atomSpacing()).toBeCloseTo(2.568e-10, 12);
    expect(areaPerAtom()).toBeCloseTo(6.597e-20, 22);
    expect(foilLayers()).toBeGreaterThan(2300);
    expect(foilLayers()).toBeLessThan(2350);
    expect(GOLD.nucleusRadius / FM).toBeCloseTo(6.98, 2);
  });
});

describe('én α-partikkel forbi én gullkjerne', () => {
  const d = headOnDistance();

  it('sentralt støt: snur ca. 41 fm fra kjernen, langt utenfor kjernen (ca. 7 fm)', () => {
    expect(d / FM).toBeCloseTo(41.3, 1);
    expect(closestApproach(0)).toBeCloseTo(d, 25);
    expect(closestApproach(0)).toBeGreaterThan(5 * GOLD.nucleusRadius);
    // Energibevaring: k q Q / d = E_k
    expect((8.99e9 * 2 * 79 * 1.6e-19 * 1.6e-19) / d).toBeCloseTo(5.5 * MEV_J, 20);
  });

  it('tan(θ/2) = d/(2b): b = 0 gir 180°, b = d/2 gir 90°, stor b gir nesten 0°', () => {
    expect(deg(rutherfordAngle(0))).toBe(180);
    expect(deg(rutherfordAngle(d / 2))).toBeCloseTo(90, 10);
    expect(deg(rutherfordAngle(1e-10))).toBeLessThan(0.03);
    expect(deg(rutherfordAngle(20 * FM))).toBeCloseTo(91.9, 1);
  });

  it('avbøyningen avtar jevnt når sikteavstanden øker', () => {
    let prev = Infinity;
    for (let b = 0; b <= B_MAX; b += FM) {
      const th = rutherfordAngle(b);
      expect(th).toBeLessThan(prev);
      prev = th;
    }
    expect(deg(rutherfordAngle(B_MAX))).toBeGreaterThan(19);
  });

  it('impactForAngle er den omvendte av rutherfordAngle', () => {
    for (const thDeg of [1, 5, 30, 90, 150, 179]) {
      expect(deg(rutherfordAngle(impactForAngle(rad(thDeg))))).toBeCloseTo(thDeg, 9);
    }
    expect(impactForAngle(Math.PI)).toBe(0);
    expect(impactForAngle(0)).toBe(Infinity);
  });

  it('nærmeste avstand: r_min = (d/2)(1 + ε) er større enn både b og d/2', () => {
    for (const bFm of [0, 5, 20, 60, 120]) {
      const b = bFm * FM;
      const r = closestApproach(b);
      expect(r).toBeGreaterThanOrEqual(b);
      expect(r).toBeGreaterThanOrEqual(d - 1e-25);
      expect(r).toBeCloseTo((d / 2) * (1 + eccentricity(b)), 25);
    }
  });

  it('energibevaring: farten er null i snupunktet for et sentralt støt og v₀ langt unna', () => {
    expect(speedAt(d)).toBeCloseTo(0, 6);
    expect(speedAt(1e-9) / alphaSpeed()).toBeCloseTo(1, 4);
  });

  it('kraften i det nærmeste punktet er stor (ca. 21 N ved sentralt støt), mens rosinbollen gir under 10⁻⁵ N', () => {
    expect(nucleusForce(d)).toBeCloseTo(21.3, 1);
    expect(nucleusForce(closestApproach(20 * FM))).toBeCloseTo(14.9, 1);
    expect(thomsonMaxForce()).toBeLessThan(1e-5);
    expect(nucleusForce(d) / thomsonMaxForce()).toBeGreaterThan(1e6);
  });
});

describe('Thomsons modell (rosinbollen)', () => {
  it('største avbøyning per atom er under 0,01° (positiv kule) og elektronene gir høyst m_e/m_α', () => {
    expect(deg(thomsonMaxAngle())).toBeLessThan(0.01);
    expect(deg(thomsonMaxAngle())).toBeCloseTo(0.0082, 4);
    expect(electronMaxAngle()).toBeCloseTo(ELECTRON_MASS / ALPHA.mass, 12);
    expect(deg(electronMaxAngle())).toBeCloseTo(0.0079, 4);
  });

  it('avbøyningen er størst ved b = R/√2 og null i midten og utenfor atomet', () => {
    const R = GOLD.atomRadius;
    expect(thomsonAngle(0)).toBe(0);
    expect(thomsonAngle(R)).toBe(0);
    expect(thomsonAngle(2 * R)).toBe(0);
    expect(thomsonAngle(R / Math.SQRT2)).toBeCloseTo(thomsonMaxAngle(), 12);
    expect(thomsonAngle(0.5 * R)).toBeLessThan(thomsonMaxAngle());
    // Nær midten (som sikteavstandene på glidebryteren) er den helt ubetydelig.
    expect(deg(thomsonAngle(B_MAX))).toBeLessThan(1e-4);
  });

  it('etter hele folien er avbøyningen typisk ca. 0,4°, og over 90° er praktisk talt umulig', () => {
    expect(deg(thomsonSigma(s))).toBeGreaterThan(0.3);
    expect(deg(thomsonSigma(s))).toBeLessThan(0.5);
    expect(probAbove('thomson', rad(5), s)).toBeLessThan(1e-40);
    expect(probAbove('thomson', rad(90), s)).toBe(0);
    expect(thomsonLog10Above(rad(90), s)).toBeLessThan(-10000);
  });
});

describe('Rutherfords modell: fordelingen av vinkler', () => {
  it('de mange små avbøyningene gir ca. 1,7°, mye mer enn i rosinbollen', () => {
    expect(deg(rutherfordSoftSigma(s))).toBeGreaterThan(1.4);
    expect(deg(rutherfordSoftSigma(s))).toBeLessThan(2);
    expect(rutherfordSoftSigma(s)).toBeGreaterThan(thomsonSigma(s));
  });

  it('antall store avbøyninger er proporsjonalt med tykkelsen og med b(θ)²', () => {
    const thick = foilSetup(ALPHA_ENERGY_MEV, 1.2e-6);
    expect(hardRate(rad(90), thick) / hardRate(rad(90), s)).toBeCloseTo(2, 6);
    expect(hardRate(rad(90), s)).toBeCloseTo((s.layers * Math.PI * (s.d / 2) ** 2) / s.a2, 12);
    // Ca. 1 av 21 000 kastes tilbake.
    expect(1 / probAbove('rutherford', rad(90), s)).toBeGreaterThan(18000);
    expect(1 / probAbove('rutherford', rad(90), s)).toBeLessThan(24000);
  });

  it('sannsynligheten for over θ avtar med θ og går fra 1 til 0', () => {
    for (const model of ['thomson', 'rutherford'] as const) {
      expect(probAbove(model, 0, s)).toBe(1);
      expect(probAbove(model, Math.PI, s)).toBe(0);
      let prev = 1;
      for (let d = 0.5; d < 180; d += 0.5) {
        const p = probAbove(model, rad(d), s);
        expect(p).toBeLessThanOrEqual(prev + 1e-15);
        expect(p).toBeGreaterThanOrEqual(0);
        prev = p;
      }
    }
  });

  it('intervallene i telleren summerer til 1, og de fleste går nesten rett gjennom', () => {
    for (const model of ['thomson', 'rutherford'] as const) {
      const p = binProbabilities(model, s);
      expect(p).toHaveLength(BIN_COUNT);
      expect(p.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 12);
      expect(p[0]!).toBeGreaterThan(0.97);
    }
    const r = binProbabilities('rutherford', s);
    expect(r[1]!).toBeGreaterThan(r[2]!);
    expect(r[2]!).toBeGreaterThan(r[3]!);
    expect(r[3]!).toBeGreaterThan(0);
  });

  it('binIndex plasserer vinklene i riktig intervall', () => {
    expect(BIN_EDGES_DEG).toEqual([0, 5, 30, 90, 180]);
    expect(binIndex(0)).toBe(0);
    expect(binIndex(4.99)).toBe(0);
    expect(binIndex(5)).toBe(1);
    expect(binIndex(29.9)).toBe(1);
    expect(binIndex(30)).toBe(2);
    expect(binIndex(90)).toBe(3);
    expect(binIndex(180)).toBe(3);
  });
});

describe('simulert forsøk', () => {
  it('er likt hver gang (fast frø) og har gyldige vinkler', () => {
    const again = simulateExperiment(1000);
    expect(Array.from(again.thetaDeg)).toEqual(Array.from(exp.thetaDeg.slice(0, 1000)));
    for (let i = 0; i < exp.thetaDeg.length; i++) {
      const th = exp.thetaDeg[i]!;
      expect(th >= 0 && th <= 180).toBe(true);
    }
    expect(exp.thetaDeg.length).toBe(N_TOTAL);
  });

  it('tellingen stemmer med forutsigelsen fra Rutherfords modell innenfor tilfeldig variasjon', () => {
    const t = tally(exp, N_TOTAL);
    expect(t.bins.reduce((a, b) => a + b, 0)).toBe(N_TOTAL);
    const p = binProbabilities('rutherford', s);
    for (let i = 0; i < BIN_COUNT; i++) {
      const expected = p[i]! * N_TOTAL;
      // Poisson-spredning: avvik under 4 standardavvik (+ 3 for de minste tallene).
      expect(Math.abs(t.bins[i]! - expected)).toBeLessThan(4 * Math.sqrt(expected) + 3);
    }
    // Noen ble kastet tilbake, men svært få.
    expect(t.bins[3]!).toBeGreaterThan(3);
    expect(t.bins[3]!).toBeLessThan(30);
  });

  it('skjermtellingen har like mange treff som telleren, og flest rett fram', () => {
    const t = tally(exp, 50_000);
    let sum = 0;
    for (let k = 0; k < RING_BUCKETS; k++) sum += t.up[k]! + t.down[k]!;
    expect(sum).toBe(50_000);
    expect(t.up[0]! + t.down[0]!).toBeGreaterThan(0.5 * 50_000);
    expect(tally(exp, 0).bins).toEqual([0, 0, 0, 0]);
    expect(tally(exp, 10 * N_TOTAL).bins.reduce((a, b) => a + b, 0)).toBe(N_TOTAL);
  });

  it('largeAngleIndices gir de store vinklene i rekkefølge', () => {
    const idx = largeAngleIndices(exp, 30);
    expect(idx.length).toBe(tally(exp, N_TOTAL).bins[2]! + tally(exp, N_TOTAL).bins[3]!);
    for (let i = 1; i < idx.length; i++) expect(idx[i]!).toBeGreaterThan(idx[i - 1]!);
  });

  it('størrelsen fra tellingen: «blinken» er ca. 2 · 10⁻¹⁴ m, tusenvis av ganger mindre enn atomet', () => {
    const back = tally(exp, N_TOTAL).bins[3]!;
    const b = targetRadiusFromCount(back, N_TOTAL, s);
    expect(b).toBeGreaterThan(1.5e-14);
    expect(b).toBeLessThan(3.5e-14);
    expect(GOLD.atomRadius / b).toBeGreaterThan(3000);
    // Med den forventede andelen får vi nøyaktig b(90°) = d/2 tilbake.
    const pBack = hardRate(rad(90), s);
    expect(targetRadiusFromCount(pBack * 1e6, 1e6, s)).toBeCloseTo(s.d / 2, 25);
    expect(chancePerAtom(back, N_TOTAL, s)).toBeCloseTo(back / N_TOTAL / s.layers, 20);
    expect(targetRadiusFromCount(0, N_TOTAL, s)).toBe(0);
    expect(targetRadiusFromCount(3, 0, s)).toBe(0);
  });
});

describe('avspilling', () => {
  it('antall skutt går fra 0 til alle, stadig fortere', () => {
    expect(firedCount(0)).toBe(0);
    expect(firedCount(-1)).toBe(0);
    expect(firedCount(PLAY_TIME)).toBe(N_TOTAL);
    expect(firedCount(PLAY_TIME + 5)).toBe(N_TOTAL);
    expect(firedCount(4)).toBeLessThan(200);
    expect(firedCount(12)).toBeGreaterThan(10_000);
    let prev = 0;
    for (let t = 0; t <= PLAY_TIME; t += 0.25) {
      const n = firedCount(t);
      expect(n).toBeGreaterThanOrEqual(prev);
      prev = n;
    }
  });

  it('fireTime er den omvendte av firedCount', () => {
    for (const i of [0, 9, 99, 1234, 50_000, N_TOTAL - 1]) {
      const t = fireTime(i);
      expect(firedCount(t + 1e-9)).toBeGreaterThanOrEqual(i + 1);
      expect(firedCount(t - 1e-6)).toBeLessThanOrEqual(i + 1);
    }
    expect(fireTime(N_TOTAL - 1)).toBeCloseTo(PLAY_TIME, 9);
  });
});

describe('banen forbi kjernen', () => {
  const d = 41.3;
  const R = VIEW_RADIUS / FM;

  it('går inn fra venstre i høyden b og ut i vinkelen θ', () => {
    for (const b of [5, 20, 60, 120]) {
      const tr = trajectory(b, d, R);
      const first = tr.pts[0]!;
      const last = tr.pts[tr.pts.length - 1]!;
      // Starter på kanten av utsnittet, til venstre for kjernen.
      expect(first[0]).toBeLessThan(-0.5 * R);
      expect(Math.hypot(first[0], first[1])).toBeCloseTo(R, 6);
      expect(Math.hypot(last[0], last[1])).toBeLessThanOrEqual(R * 1.0001);
      // Langt unna går banen langs asymptoten: retningen fra skjæringspunktet mellom asymptotene → θ.
      const far = trajectory(b, d, 1e6);
      const end = far.pts[far.pts.length - 1]!;
      const c = asymptoteCenter(b, d);
      const out = Math.atan2(end[1] - c[1], end[0] - c[0]);
      expect(deg(out)).toBeCloseTo(deg(rutherfordAngle(b, d)), 1);
      const start = far.pts[0]!;
      expect(start[1]).toBeCloseTo(b, 0);
      // Nærmeste punkt stemmer med r_min.
      const near = tr.pts[tr.nearest]!;
      expect(Math.hypot(near[0], near[1])).toBeCloseTo(closestApproach(b, d), 1);
    }
  });

  it('asymptotene: den inngående ligger i høyden b', () => {
    for (const b of [3, 20, 90]) expect(asymptoteCenter(b, d)[1]).toBeCloseTo(b, 9);
    expect(asymptoteCenter(0, d)).toEqual([-d / 2, 0]);
  });

  it('sentralt støt: rett inn til r = d og samme vei tilbake', () => {
    const tr = trajectory(0, d, R);
    const near = tr.pts[tr.nearest]!;
    expect(near[0]).toBeCloseTo(-d, 9);
    expect(near[1]).toBe(0);
    expect(tr.pts[0]![0]).toBeCloseTo(-R, 9);
    expect(tr.pts[tr.pts.length - 1]![0]).toBeCloseTo(-R, 9);
  });

  it('tiden øker langs banen, og α er saktest nær kjernen', () => {
    const tr = trajectory(20, d, R);
    for (let i = 1; i < tr.time.length; i++) expect(tr.time[i]!).toBeGreaterThan(tr.time[i - 1]!);
    const end = tr.time[tr.time.length - 1]!;
    expect(pointAt(tr, 0)).toMatchObject({ x: tr.pts[0]![0], y: tr.pts[0]![1] });
    const p = pointAt(tr, end);
    expect(p.x).toBeCloseTo(tr.pts[tr.pts.length - 1]![0], 9);
    const mid = pointAt(tr, tr.time[tr.nearest]!);
    expect(Math.hypot(mid.x, mid.y)).toBeCloseTo(closestApproach(20, d), 1);
  });

  it('banen holder seg innenfor utsnittet for alle sikteavstander på glidebryteren', () => {
    for (let b = 0; b <= B_MAX / FM; b += 1) {
      const tr = trajectory(b, d, R);
      expect(tr.pts.length).toBeGreaterThan(10);
      for (const [x, y] of tr.pts) {
        expect(Number.isFinite(x) && Number.isFinite(y)).toBe(true);
        expect(Math.hypot(x, y)).toBeLessThanOrEqual(R * 1.0001);
      }
    }
  });

  it('HARD_LIMIT er 2°', () => {
    expect(deg(HARD_LIMIT)).toBeCloseTo(2, 12);
  });
});
