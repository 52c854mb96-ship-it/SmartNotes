import { describe, expect, it } from 'vitest';
import { DISEASES, I0, NICE_DAYS, POPULATION, countsAt, epidemic, expectedFinalSize, people, personStates } from './model';
import {
  COURSE_PERIOD,
  IMMUNE_DAYS,
  PRIMARY_RESPONSE,
  RES_F0,
  RES_K,
  SECONDARY_RESPONSE,
  antibodiesAt,
  defenseStage,
  immuneRun,
  onAntibiotic,
  resistanceAt,
  responseAt,
  sampleCounts,
  samplePositions,
  simulateResistance,
} from './model';

describe('sykdommene', () => {
  it('flokkimmunitetsgrensen for influensa, covid-19 og meslinger', () => {
    const pc = Object.fromEntries(DISEASES.map((d) => [d.id, epidemic({ R0: d.R0, p: 0, e: 1 }).pc]));
    expect(pc.influensa).toBeCloseTo(1 / 3, 9);
    expect(pc.covid).toBeCloseTo(2 / 3, 9);
    expect(pc.meslinger).toBeCloseTo(14 / 15, 9);
  });
});

describe('epidemien', () => {
  it('uten vaksine: stor epidemi som stemmer med sluttstørrelsen', () => {
    const ep = epidemic({ R0: 3, p: 0, e: 1 });
    expect(ep.herd).toBe(false);
    expect(ep.Re0).toBeCloseTo(3, 9);
    expect(epidemic({ R0: 3, p: 0.4, e: 0.5 }).Re0).toBeCloseTo(3 * (1 - 0.2), 9);
    expect(ep.peak).toBeGreaterThan(0.2);
    expect(ep.totalInfected).toBeCloseTo(expectedFinalSize({ R0: 3, p: 0, e: 1 }), 2);
    expect(NICE_DAYS).toContain(ep.tMax);
    // Epidemien er over når tidsrommet slutter
    expect(ep.series.I[ep.series.I.length - 1]!).toBeLessThan(0.001);
  });

  it('vaksinasjon over p_c gir flokkimmunitet og beskytter de uvaksinerte', () => {
    for (const d of DISEASES) {
      const none = epidemic({ R0: d.R0, p: 0, e: 1 });
      const above = epidemic({ R0: d.R0, p: Math.min(1, none.pc + 0.03), e: 1 });
      expect(above.herd).toBe(true);
      expect(above.peak).toBeCloseTo(I0, 9);
      expect(above.attackUnvaccinated).toBeLessThan(0.1);
      expect(none.attackUnvaccinated).toBeGreaterThan(0.5);
    }
  });

  it('meslinger: 90 % dekning er ikke nok, men 95 % er det', () => {
    expect(epidemic({ R0: 15, p: 0.9, e: 1 }).herd).toBe(false);
    expect(epidemic({ R0: 15, p: 0.95, e: 1 }).herd).toBe(true);
    // Med en vaksine som virker på 90 % må dekningen over 100 %: umulig
    expect(epidemic({ R0: 15, p: 1, e: 0.9 }).required).toBeGreaterThan(1);
    expect(epidemic({ R0: 15, p: 1, e: 0.9 }).herd).toBe(false);
  });

  it('tidsaksen er kort for raske epidemier og lang for langsomme', () => {
    const fast = epidemic({ R0: 15, p: 0, e: 1 }).tMax;
    const slow = epidemic({ R0: 1.5, p: 0, e: 1 }).tMax;
    expect(fast).toBeLessThanOrEqual(90);
    expect(slow).toBeGreaterThanOrEqual(120);
    expect(slow).toBeGreaterThan(fast);
    // Alle vaksinert med en vaksine som virker: ingen kan smittes, kortest mulig tidsakse
    const all = epidemic({ R0: 18, p: 1, e: 1 });
    expect(all.tMax).toBe(30);
    expect(all.totalInfected).toBe(0);
  });
});

describe('individene i rutenettet', () => {
  it('riktig antall vaksinerte og immune', () => {
    const list = people({ p: 0.6, e: 0.9 });
    expect(list).toHaveLength(POPULATION);
    expect(list.filter((x) => x.vaccinated)).toHaveLength(240);
    expect(list.filter((x) => x.immune)).toHaveLength(216);
    // Alle som ikke er immune har en unik plass i smitterekkefølgen
    const orders = list.filter((x) => !x.immune).map((x) => x.order);
    expect(new Set(orders).size).toBe(orders.length);
    expect(Math.max(...orders)).toBe(orders.length - 1);
    expect(people({ p: 0.6, e: 0.9 })).toEqual(list);
  });

  it('én smittet ved start, og ingen går tilbake fra smittet til mottakelig', () => {
    const ep = epidemic({ R0: 3, p: 0.3, e: 1 });
    const list = people({ p: 0.3, e: 1 });
    let prev = personStates(list, countsAt(ep.series, 0).ever, countsAt(ep.series, 0).recovered);
    expect(prev.filter((s) => s === 'I')).toHaveLength(1);
    expect(prev.filter((s) => s === 'V')).toHaveLength(120);
    for (let t = 1; t <= ep.tMax; t += 1) {
      const c = countsAt(ep.series, t);
      const now = personStates(list, c.ever, c.recovered);
      now.forEach((s, i) => {
        const before = prev[i]!;
        if (before === 'I') expect(['I', 'R']).toContain(s);
        if (before === 'R') expect(s).toBe('R');
        if (before === 'V') expect(s).toBe('V');
      });
      prev = now;
    }
    // Til slutt stemmer antallet med modellen
    const end = countsAt(ep.series, ep.tMax);
    expect(prev.filter((s) => s === 'R' || s === 'I').length).toBe(end.ever);
    expect(end.ever / POPULATION).toBeCloseTo(ep.totalInfected, 2);
  });
});

describe('immunforsvaret: primær og sekundær respons', () => {
  it('primærresponsen: antistoffer etter ca. en uke, topp etter ca. to uker', () => {
    expect(responseAt(PRIMARY_RESPONSE, 3)).toBe(0);
    expect(responseAt(PRIMARY_RESPONSE, 14)).toBeCloseTo(1, 9);
    expect(responseAt(PRIMARY_RESPONSE, 60)).toBeLessThan(0.3);
    expect(responseAt(PRIMARY_RESPONSE, 1000)).toBeCloseTo(PRIMARY_RESPONSE.plateau, 6);
  });

  it('sekundærresponsen kommer raskere, blir sterkere og varer lenger', () => {
    const run = immuneRun({ first: 'sykdom', second: 60, memory: true });
    const [p1, p2] = run.peaks;
    expect(p2.day).toBeLessThan(p1.day);
    expect(p2.level / p1.level).toBeGreaterThan(5);
    expect(SECONDARY_RESPONSE.halfLife).toBeGreaterThan(PRIMARY_RESPONSE.halfLife);
    // Syk første gang, ikke andre gang
    expect(run.sickDays[0]).toBeGreaterThan(3);
    expect(run.sickDays[1]).toBe(0);
  });

  it('vaksine: ingen sykdom, men hukommelse som beskytter ved smitte', () => {
    const run = immuneRun({ first: 'vaksine', second: 60, memory: true });
    expect(run.sickDays).toEqual([0, 0]);
    expect(run.peaks[1].level).toBeGreaterThan(5);
  });

  it('uten hukommelsesceller blir du syk igjen', () => {
    for (const first of ['sykdom', 'vaksine'] as const) {
      const run = immuneRun({ first, second: 60, memory: false });
      expect(run.sickDays[1]).toBeGreaterThan(2);
      expect(run.peaks[1].level).toBeCloseTo(run.peaks[0].level / (first === 'vaksine' ? 0.7 : 1), 0);
    }
    // Kort tid etter første møte er det fortsatt antistoffer igjen som beskytter (forklaringen sier det)
    expect(immuneRun({ first: 'sykdom', second: 30, memory: false }).sickDays[1]).toBe(0);
    expect(immuneRun({ first: 'sykdom', second: 140, memory: false }).sickDays[1]).toBeCloseTo(immuneRun({ first: 'sykdom', second: 60, memory: true }).sickDays[0], 0);
  });

  it('nivåene er endelige og ikke negative', () => {
    const run = immuneRun({ first: 'sykdom', second: 140, memory: true });
    expect(run.t[run.t.length - 1]).toBeCloseTo(IMMUNE_DAYS, 6);
    for (const v of [...run.antibodies, ...run.pathogen]) {
      expect(Number.isFinite(v)).toBe(true);
      expect(v).toBeGreaterThanOrEqual(0);
    }
    expect(antibodiesAt({ first: 'sykdom', second: 60, memory: true }, 0)).toBe(0);
  });

  it('forsvaret i riktig rekkefølge', () => {
    const s = { first: 'sykdom' as const, second: 60, memory: true };
    expect(defenseStage(s, 1)).toBe('uspesifikt');
    expect(defenseStage(s, 3.5)).toBe('aktivering');
    expect(defenseStage(s, 10)).toBe('effekt');
    expect(defenseStage(s, 40)).toBe('hukommelse');
    expect(defenseStage(s, 60.3)).toBe('uspesifikt');
    expect(defenseStage(s, 63)).toBe('effekt');
  });
});

describe('antibiotikaresistens', () => {
  it('hele kuren: infeksjonen blir borte hver gang, andelen resistente bygger seg ikke opp', () => {
    const run = simulateResistance('hele', 3);
    expect(run.clearedAfter).toEqual([true, true, true]);
    for (const f of run.shareAtStart) expect(f).toBeCloseTo(RES_F0, 9);
  });

  it('avbrutt kur: infeksjonen kommer tilbake, og andelen resistente øker for hver kur', () => {
    const run = simulateResistance('avbrutt', 4);
    expect(run.clearedAfter.every((c) => !c)).toBe(true);
    const f = run.shareAtStart;
    expect(f[1]!).toBeGreaterThan(100 * f[0]!);
    expect(f[2]!).toBeGreaterThan(f[1]!);
    expect(f[3]!).toBeGreaterThan(0.95);
  });

  it('unødvendig bruk: normalfloraen blir mer og mer resistent', () => {
    const run = simulateResistance('unodvendig', 3);
    const f = run.shareAtStart;
    expect(f[1]!).toBeGreaterThan(100 * f[0]!);
    expect(f[2]!).toBeGreaterThan(f[1]!);
    // Floraen er ikke borte, den blir bare annerledes
    expect(resistanceAt(run, 3 * COURSE_PERIOD).S + resistanceAt(run, 3 * COURSE_PERIOD).R).toBeGreaterThan(1e9);
  });

  it('antallene er aldri negative eller over bæreevnen', () => {
    for (const kind of ['hele', 'avbrutt', 'unodvendig'] as const) {
      const run = simulateResistance(kind, 4);
      run.S.forEach((S, i) => {
        const R = run.R[i]!;
        expect(S).toBeGreaterThanOrEqual(0);
        expect(R).toBeGreaterThanOrEqual(0);
        expect(S + R).toBeLessThanOrEqual(RES_K * 1.0001);
      });
      expect(simulateResistance(kind, 4)).toEqual(run);
    }
  });

  it('antibiotikadagene', () => {
    expect(onAntibiotic('hele', 6.9, 2)).toBe(true);
    expect(onAntibiotic('hele', 7.1, 2)).toBe(false);
    expect(onAntibiotic('avbrutt', 3.1, 2)).toBe(false);
    expect(onAntibiotic('hele', COURSE_PERIOD + 1, 2)).toBe(true);
    expect(onAntibiotic('hele', 2 * COURSE_PERIOD + 1, 2)).toBe(false);
  });

  it('utvalget i figuren: log-skala og minst én resistent', () => {
    expect(sampleCounts(0, 0, 100)).toEqual({ shown: 0, resistant: 0 });
    expect(sampleCounts(RES_K, 0, 100)).toEqual({ shown: 100, resistant: 0 });
    expect(sampleCounts(1e9, 1e4, 100)).toEqual({ shown: 90, resistant: 1 });
    expect(sampleCounts(5e9, 5e9, 100)).toEqual({ shown: 100, resistant: 50 });
    expect(samplePositions(10)).toEqual(samplePositions(10));
  });
});
