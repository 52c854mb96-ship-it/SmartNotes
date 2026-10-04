import { describe, expect, it } from 'vitest';
import { msy } from '../kit';
import {
  COLLAPSE_BELOW,
  LAND,
  REOPEN_ABOVE,
  SILD,
  SPECIES,
  STOP_BELOW,
  altitudeBand,
  altitudeOfTemp,
  analyseHarvest,
  chapman,
  coneBandArea,
  expectedRecaptures,
  hypergeometric,
  landLength,
  latitudeBand,
  lincolnPetersen,
  markRecaptureTrial,
  pondLayout,
  recaptureDistribution,
  shiftPerDegreeAltitude,
  shiftPerDegreeLatitude,
  simulateHarvest,
  speciesRange,
  summarizeEstimates,
  tempAtAltitude,
  tempAtLatitude,
  type HarvestParams,
} from './model';

const base: HarvestParams = { r: SILD.r, K: SILD.K, mode: 'kvote', H: 1.2, h: 0.25, moratorium: false };
const last = <T,>(a: readonly T[]) => a[a.length - 1]!;

describe('bærekraftig høsting', () => {
  it('MSY for silda: rK/4 = 1,5 millioner tonn per år ved N = K/2', () => {
    const m = msy(SILD.r, SILD.K);
    expect(m.yield).toBeCloseTo(1.5, 12);
    expect(m.N).toBe(6);
    expect(analyseHarvest(base).msy).toBeCloseTo(1.5, 12);
  });

  it('kvote under MSY: bestanden går mot den øvre likevekten og fangsten holder seg', () => {
    const a = analyseHarvest(base);
    expect(a.outcome).toBe('baerekraftig');
    // K/2 · (1 + √(1 − 4H/(rK))) = 6 · (1 + √0,2)
    expect(a.equilibrium).toBeCloseTo(6 * (1 + Math.sqrt(0.2)), 9);
    expect(a.unstable).toBeCloseTo(6 * (1 - Math.sqrt(0.2)), 9);
    const run = simulateHarvest(base);
    expect(last(run.N)).toBeCloseTo(a.equilibrium, 2);
    expect(last(run.catchRate)).toBeCloseTo(1.2, 9);
    expect(run.collapseTime).toBeNull();
    // Samlet fangst = kvote · år når bestanden aldri går tom
    expect(last(run.cumulative)).toBeCloseTo(1.2 * 40, 1);
  });

  it('kvote over MSY: bestanden kollapser, og fangsten stopper når den er borte', () => {
    const p = { ...base, H: 2 };
    expect(analyseHarvest(p)).toMatchObject({ outcome: 'kollaps', overMsy: true, equilibrium: 0 });
    const run = simulateHarvest(p);
    expect(run.collapseTime).not.toBeNull();
    expect(run.collapseTime!).toBeGreaterThan(3);
    expect(run.collapseTime!).toBeLessThan(15);
    expect(last(run.N)).toBe(0);
    expect(last(run.catchRate)).toBe(0);
    // Aldri negative bestander
    expect(Math.min(...run.N)).toBeGreaterThanOrEqual(0);
    // Overfiske gir mindre samlet fangst over 40 år enn en bærekraftig kvote
    expect(last(run.cumulative)).toBeLessThan(last(simulateHarvest(base).cumulative));
    // … og hele bestanden pluss tilveksten er det mest som kan fanges
    expect(last(run.cumulative)).toBeGreaterThan(SILD.K);
  });

  it('kvote lik MSY: bestanden går mot K/2', () => {
    const p = { ...base, H: 1.5 };
    expect(analyseHarvest(p).outcome).toBe('msy');
    const run = simulateHarvest({ ...p, years: 400 });
    expect(last(run.N)).toBeGreaterThan(6);
    expect(last(run.N)).toBeLessThan(6.6);
  });

  it('fiskestopp: ingen fangst under føre-var-grensen, og fisket åpner igjen over K/2', () => {
    const run = simulateHarvest({ ...base, H: 2, moratorium: true });
    expect(analyseHarvest({ ...base, H: 2, moratorium: true }).outcome).toBe('fiskestopp');
    const firstClosed = run.closed.indexOf(true);
    expect(firstClosed).toBeGreaterThan(0);
    expect(run.N[firstClosed]!).toBeLessThan(STOP_BELOW * SILD.K);
    run.closed.forEach((c, i) => {
      if (c) expect(run.catchRate[i]).toBe(0);
    });
    // Bestanden kollapser aldri helt, og den vokser til over K/2 før fisket åpner igjen
    expect(run.collapseTime).toBeNull();
    expect(Math.min(...run.N)).toBeGreaterThan(COLLAPSE_BELOW * SILD.K);
    const reopen = run.closed.findIndex((c, i) => i > firstClosed && !c);
    expect(reopen).toBeGreaterThan(firstClosed);
    expect(run.N[reopen]!).toBeGreaterThanOrEqual(REOPEN_ABOVE * SILD.K);
  });

  it('fast andel: likevekt K(1 − h/r), størst fangst ved h = r/2, kollaps når h ≥ r', () => {
    const p = { ...base, mode: 'andel' as const };
    const a = analyseHarvest({ ...p, h: 0.25 });
    expect(a.outcome).toBe('msy');
    expect(a.equilibrium).toBeCloseTo(6, 9);
    expect(a.equilibriumYield).toBeCloseTo(1.5, 9);
    for (const h of [0.1, 0.2, 0.3, 0.4]) expect(analyseHarvest({ ...p, h }).equilibriumYield).toBeLessThan(1.5);
    expect(analyseHarvest({ ...p, h: 0.35 }).overfished).toBe(true);
    expect(analyseHarvest({ ...p, h: 0.15 }).overfished).toBe(false);
    expect(analyseHarvest({ ...p, h: 0.5 }).outcome).toBe('kollaps');
    const run = simulateHarvest({ ...p, h: 0.1 });
    expect(last(run.N)).toBeCloseTo(SILD.K * (1 - 0.1 / 0.5), 2);
  });

  it('uten fiske står bestanden på bæreevnen', () => {
    const run = simulateHarvest({ ...base, H: 0 });
    expect(analyseHarvest({ ...base, H: 0 }).outcome).toBe('urort');
    expect(last(run.N)).toBeCloseTo(SILD.K, 9);
    expect(last(run.cumulative)).toBe(0);
  });
});

describe('fangst–gjenfangst', () => {
  it('Lincoln–Petersen og Chapman', () => {
    expect(lincolnPetersen(40, 50, 10)).toBe(200);
    expect(lincolnPetersen(40, 50, 0)).toBeNull();
    expect(chapman(40, 50, 10)).toBeCloseTo((41 * 51) / 11 - 1, 12);
    expect(expectedRecaptures(200, 40, 50)).toBe(10);
  });

  it('den hypergeometriske fordelingen summerer til 1 og har forventning CM/N', () => {
    const N = 150;
    const M = 30;
    const C = 40;
    const dist = recaptureDistribution(N, M, C);
    expect(dist.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 12);
    const mean = dist.reduce((s, p, r) => s + p * r, 0);
    expect(mean).toBeCloseTo(expectedRecaptures(N, M, C), 9);
  });

  it('små tall: C(3,3)·C(7,1)/C(10,4) = 7/210 og C(7,4)/C(10,4) = 35/210', () => {
    expect(hypergeometric(10, 3, 4, 3)).toBeCloseTo(7 / 210, 12);
    expect(hypergeometric(10, 3, 4, 0)).toBeCloseTo(35 / 210, 12);
  });

  it('brutte forutsetninger gir skjeve estimater i forventet retning', () => {
    const N = 200;
    const M = 40;
    const C = 50;
    const meanR = (d: number[]) => d.reduce((s, p, r) => s + p * r, 0);
    const ideal = meanR(recaptureDistribution(N, M, C, 'ideell'));
    expect(meanR(recaptureDistribution(N, M, C, 'merkeTap'))).toBeCloseTo(ideal * 0.6, 9);
    expect(meanR(recaptureDistribution(N, M, C, 'ikkeBlandet'))).toBeLessThan(ideal * 0.6);
    expect(meanR(recaptureDistribution(N, M, C, 'fellelyst'))).toBeGreaterThan(ideal * 1.4);
    for (const s of ['ikkeBlandet', 'merkeTap', 'fellelyst'] as const)
      expect(recaptureDistribution(N, M, C, s).reduce((a, b) => a + b, 0)).toBeCloseTo(1, 9);
    // Færre merkede i fangsten gir for høyt estimat, flere gir for lavt
    expect(summarizeEstimates(recaptureDistribution(N, M, C, 'merkeTap'), M, C).mean).toBeGreaterThan(N * 1.3);
    expect(summarizeEstimates(recaptureDistribution(N, M, C, 'fellelyst'), M, C).mean).toBeLessThan(N * 0.8);
  });

  it('spredningen blir mindre med flere merkede og større fangst', () => {
    // Med svært få merkede er R ofte 0 (ingen estimat i det hele tatt)
    expect(summarizeEstimates(recaptureDistribution(200, 10, 15), 10, 15).pNone).toBeGreaterThan(0.3);
    const small = summarizeEstimates(recaptureDistribution(200, 25, 30), 25, 30);
    const big = summarizeEstimates(recaptureDistribution(200, 60, 80), 60, 80);
    expect(big.pNone).toBeLessThan(1e-6);
    expect(big.high - big.low).toBeLessThan(small.high - small.low);
    expect(big.low).toBeLessThan(200);
    expect(big.high).toBeGreaterThan(200);
    expect(Math.abs(big.mean - 200) / 200).toBeLessThan(0.05);
  });

  it('dammen: fisk inne i dammen, alltid likt for samme frø', () => {
    const a = pondLayout(120, 3);
    expect(a).toEqual(pondLayout(120, 3));
    for (const p of a) expect(Math.hypot(p.u, p.v)).toBeLessThanOrEqual(0.93 + 1e-9);
  });

  it('ett forsøk: M merket, C fanget, R ≤ min(M, C) og estimatet MC/R', () => {
    for (const scenario of ['ideell', 'ikkeBlandet', 'merkeTap', 'fellelyst'] as const) {
      const t = markRecaptureTrial({ N: 150, M: 30, C: 40, seed: 4, scenario });
      expect(t.marked.size).toBe(30);
      expect(t.caught.size).toBe(40);
      expect(t.R).toBeLessThanOrEqual(30);
      expect(t.before).toHaveLength(150);
      expect(t.atCatch).toHaveLength(150);
      expect(t.estimate).toBe(t.R > 0 ? (30 * 40) / t.R : null);
      if (scenario !== 'merkeTap') expect(t.lostTag.size).toBe(0);
    }
    // Snittet over mange ideelle forsøk ligger nær CM/N
    let sum = 0;
    for (let s = 1; s <= 200; s++) sum += markRecaptureTrial({ N: 150, M: 30, C: 40, seed: s, scenario: 'ideell' }).R;
    expect(sum / 200).toBeGreaterThan(expectedRecaptures(150, 30, 40) * 0.85);
    expect(sum / 200).toBeLessThan(expectedRecaptures(150, 30, 40) * 1.15);
  });
});

describe('klima og utbredelse', () => {
  it('temperaturen faller 0,6 °C per 100 m og ca. 0,55 °C per breddegrad', () => {
    expect(tempAtAltitude(0)).toBe(16);
    expect(tempAtAltitude(1000)).toBeCloseTo(10, 9);
    expect(altitudeOfTemp(10)).toBeCloseTo(1000, 9);
    expect(tempAtLatitude(58)).toBe(17);
    expect(tempAtLatitude(78)).toBeCloseTo(6, 9); // som Longyearbyen i juli
    expect(shiftPerDegreeAltitude()).toBeCloseTo(166.7, 1);
    expect(shiftPerDegreeLatitude()).toBeCloseTo(201.8, 1);
  });

  it('skoggrensen (fjellbjørk) ligger ved ca. 1100 m og flytter seg opp ved oppvarming', () => {
    const bjork = SPECIES.find((s) => s.id === 'fjellbjork')!;
    const today = altitudeBand(bjork.Tmin, bjork.Tmax, 0, 2469)!;
    expect(today.to).toBeCloseTo(1083, 0);
    const warm = altitudeBand(bjork.Tmin, bjork.Tmax, 2, 2469)!;
    expect(warm.to - today.to).toBeCloseTo(333.3, 1);
  });

  it('arealet på en kjegle: hele fjellet = 1, og et belte høyt oppe er lite', () => {
    expect(coneBandArea({ from: 0, to: 2000 }, 2000)).toBeCloseTo(1, 12);
    expect(coneBandArea({ from: 1000, to: 2000 }, 2000)).toBeCloseTo(0.25, 12);
    expect(coneBandArea({ from: 0, to: 1000 }, 2000)).toBeCloseTo(0.75, 12);
    expect(coneBandArea(null, 2000)).toBe(0);
  });

  it('fjellarter mister areal og forsvinner når det ikke finnes noe høyere å gå til', () => {
    const rev = SPECIES.find((s) => s.id === 'fjellrev')!;
    let prev = Number.POSITIVE_INFINITY;
    for (const dT of [0, 1, 2, 3, 4, 5]) {
      const r = speciesRange(rev, dT, 'hoyde', 2000);
      expect(r.areaFuture).toBeLessThanOrEqual(prev + 1e-12);
      prev = r.areaFuture;
    }
    expect(speciesRange(rev, 0, 'hoyde', 2000).remaining).toBeCloseTo(1, 12);
    const iso = SPECIES.find((s) => s.id === 'issoleie')!;
    const low = speciesRange(iso, 3, 'hoyde', 2000);
    expect(low.gone).toBe(true);
    expect(low.areaFuture).toBe(0);
    expect(speciesRange(iso, 1, 'hoyde', 2000).squeezed).toBe(true);
    // På et høyere fjell overlever den lenger
    expect(speciesRange(iso, 3, 'hoyde', 2469).gone).toBe(false);
  });

  it('nordover: sonen flytter seg, men landet slutter ved Nordkapp og Svalbard', () => {
    const rev = SPECIES.find((s) => s.id === 'fjellrev')!;
    const b = latitudeBand(rev.Tmin, rev.Tmax, 0)!;
    expect(b.from).toBeCloseTo(71.64, 2);
    expect(landLength({ from: 58, to: 82 })).toBeCloseTo(LAND.reduce((s, l) => s + l.to - l.from, 0), 12);
    const iso = SPECIES.find((s) => s.id === 'issoleie')!;
    expect(speciesRange(iso, 3, 'nord', 0).gone).toBe(true);
    // En art fra lavlandet mister ikke noe areal i Norge når det blir varmere
    const rod = SPECIES.find((s) => s.id === 'rodrev')!;
    expect(speciesRange(rod, 3, 'nord', 0).remaining!).toBeGreaterThanOrEqual(1);
  });
});
