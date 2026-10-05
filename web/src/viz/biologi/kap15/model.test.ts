import { describe, expect, it } from 'vitest';
import { DISEASES, I0, NICE_DAYS, POPULATION, countsAt, epidemic, expectedFinalSize, people, personStates } from './model';

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
