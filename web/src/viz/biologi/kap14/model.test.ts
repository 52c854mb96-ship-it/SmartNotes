import { describe, expect, it } from 'vitest';
import {
  CARE_CAPACITY,
  CYCLES,
  DANGER,
  G_37,
  GROWTH_HOURS,
  NO_MEASURES,
  N_MAX,
  TOWN,
  afterRounds,
  antibioticWorks,
  basicR0,
  contactDays,
  contactGrid,
  countAt,
  currentR,
  effectiveP,
  generationTimeAt,
  generationsAfter,
  grows,
  outbreak,
  phaseAt,
  phaseEndsAt,
  reproductionNumber,
  roundsIn,
  stepAt,
  timeToCount,
  type Agent,
} from './model';

describe('bakterievekst', () => {
  it('generasjonstida: 20 min ved 37 °C, lengre jo kaldere, ingen vekst i kjøleskapet', () => {
    expect(generationTimeAt(37)).toBeCloseTo(G_37, 12);
    expect(generationTimeAt(37) * 60).toBeCloseTo(20, 9);
    // Romtemperatur: drøyt en time
    expect(generationTimeAt(20)).toBeGreaterThan(1);
    expect(generationTimeAt(20)).toBeLessThan(2);
    // 10 °C: rundt et halvt døgn
    expect(generationTimeAt(10)).toBeGreaterThan(8);
    expect(generationTimeAt(10)).toBeLessThan(16);
    expect(grows(4)).toBe(false);
    expect(grows(50)).toBe(false);
    // Raskest rundt kroppstemperatur
    for (const T of [10, 20, 30, 44]) expect(generationTimeAt(T)).toBeGreaterThan(generationTimeAt(38) - 1e-9);
    // Kaldere gir alltid langsommere vekst under 37 °C
    for (let T = 6; T < 37; T++) expect(generationTimeAt(T)).toBeGreaterThan(generationTimeAt(T + 1));
  });

  it('vekstkurven: lagfase, dobling hver generasjon, tak og dødsfase', () => {
    const N0 = 100;
    const e = phaseEndsAt(37, N0)!;
    expect(countAt(37, N0, e.lag * 0.5)).toBe(N0);
    const g = generationTimeAt(37);
    expect(countAt(37, N0, e.lag + 3 * g)).toBeCloseTo(N0 * 8, 6);
    expect(countAt(37, N0, e.log + 1)).toBe(N_MAX);
    expect(countAt(37, N0, e.stationary + 4)).toBeCloseTo(N_MAX / 2, 0);
    expect(phaseAt(37, N0, 0.1)).toBe('lag');
    expect(phaseAt(37, N0, e.lag + 1)).toBe('log');
    expect(phaseAt(37, N0, e.log + 1)).toBe('stasjonaer');
    expect(phaseAt(37, N0, e.stationary + 1)).toBe('dod');
    expect(phaseAt(4, N0, 10)).toBe('ingen');
    expect(generationsAfter(37, N0, e.lag + 5 * g)).toBeCloseTo(5, 9);
  });

  it('matsikkerhet: fra 100 til en million', () => {
    const body = timeToCount(37, 100, DANGER)!;
    const room = timeToCount(20, 100, DANGER)!;
    expect(body).toBeGreaterThan(4);
    expect(body).toBeLessThan(7);
    expect(room).toBeGreaterThan(15);
    expect(room).toBeLessThan(30);
    expect(timeToCount(4, 100, DANGER)).toBeNull();
    // Kjøleskap: like mange etter to døgn
    expect(countAt(4, 100, GROWTH_HOURS)).toBe(100);
    // Stemmer med vekstkurven
    expect(countAt(20, 100, room)).toBeCloseTo(DANGER, 3);
    expect(timeToCount(20, 2 * DANGER, DANGER)).toBe(0);
  });
});

describe('smittespredning', () => {
  const base = { contacts: 10, p: 0.05, days: 6 };

  it('R₀ = c · p · D, og tiltakene senker R', () => {
    expect(basicR0(base)).toBeCloseTo(3, 12);
    expect(reproductionNumber(base, NO_MEASURES)).toBeCloseTo(3, 12);
    expect(effectiveP(0.05, { handvask: true, munnbind: true, isolasjon: false })).toBeCloseTo(0.05 * 0.8 * 0.7, 12);
    expect(contactDays(6, { ...NO_MEASURES, isolasjon: true })).toBeCloseTo(2 + 4 * 0.25, 12);
    expect(contactDays(1, { ...NO_MEASURES, isolasjon: true })).toBe(1);
    const all = reproductionNumber(base, { handvask: true, munnbind: true, isolasjon: true });
    expect(all).toBeLessThan(1);
  });

  it('R > 1 gir utbrudd, R < 1 gjør det ikke', () => {
    const big = outbreak(3, 6);
    expect(big.peak).toBeGreaterThan(0.25 * TOWN);
    expect(big.total).toBeGreaterThan(0.9 * TOWN);
    const small = outbreak(0.8, 6);
    expect(small.peak).toBeLessThan(2);
    expect(small.total).toBeLessThan(10);
    expect(small.tMax).toBe(30);
  });

  it('S + I + R = hele byen, og toppen kommer når R · S = 1', () => {
    const ob = outbreak(3, 6);
    ob.series.S.forEach((S, i) => expect(S + ob.series.I[i]! + ob.series.R[i]!).toBeCloseTo(1, 9));
    const i = ob.series.t.findIndex((t) => t >= ob.peakDay);
    expect(currentR(3, ob.series.S[i]!)).toBeCloseTo(1, 1);
  });

  it('flat ut kurven: tiltak gir lavere topp og færre dager over kapasiteten', () => {
    const none = outbreak(reproductionNumber(base, NO_MEASURES), base.days);
    const some = outbreak(reproductionNumber(base, { handvask: true, munnbind: true, isolasjon: false }), base.days);
    expect(none.daysOverCapacity).toBeGreaterThan(10);
    expect(some.peak).toBeLessThan(none.peak);
    expect(some.peak).toBeLessThan(CARE_CAPACITY);
    expect(some.daysOverCapacity).toBe(0);
    expect(some.peakDay).toBeGreaterThan(none.peakDay);
  });

  it('kontaktene til én smittet: i snitt R smittede, isolasjon fjerner kontakter', () => {
    const grid = contactGrid(base, NO_MEASURES);
    expect(grid).toHaveLength(60);
    const infected = grid.filter((c) => c.kind === 'smittet').length;
    expect(infected).toBeGreaterThanOrEqual(1);
    expect(infected).toBeLessThanOrEqual(7);
    const iso = contactGrid(base, { ...NO_MEASURES, isolasjon: true });
    expect(iso.filter((c) => c.kind === 'unngått').length).toBeGreaterThan(20);
    expect(iso.filter((c) => c.day < 2 && c.kind === 'unngått')).toHaveLength(0);
    // Over mange frø er snittet nær R
    let sum = 0;
    for (let s = 1; s <= 400; s++) sum += contactGrid(base, NO_MEASURES, s).filter((c) => c.kind === 'smittet').length;
    expect(sum / 400).toBeCloseTo(3, 0);
  });
});

describe('virusformering', () => {
  const agents: Agent[] = ['bakteriofag', 'kappekledd', 'bakterie'];

  it('trinnene henger sammen og dekker hele runden', () => {
    for (const a of agents) {
      const c = CYCLES[a];
      expect(c.steps).toHaveLength(5);
      expect(c.steps[0]!.start).toBe(0);
      expect(c.steps[4]!.end).toBe(c.duration);
      for (let i = 1; i < 5; i++) expect(c.steps[i]!.start).toBe(c.steps[i - 1]!.end);
      expect(stepAt(a, 0).index).toBe(0);
      expect(stepAt(a, c.duration).index).toBe(4);
      expect(stepAt(a, c.duration).u).toBe(1);
    }
    expect(stepAt('bakteriofag', 10)).toEqual({ index: 2, u: 0.6 });
  });

  it('virus lager mange nye per runde, bakterier to', () => {
    expect(afterRounds('bakterie', 3)).toBe(8);
    expect(afterRounds('bakteriofag', 2)).toBe(10_000);
    expect(roundsIn('bakterie', 60)).toBe(3);
    expect(roundsIn('bakteriofag', 60)).toBe(2);
    expect(roundsIn('kappekledd', 60)).toBe(0);
    expect(CYCLES.bakterie.independent).toBe(true);
    expect(CYCLES.kappekledd.independent).toBe(false);
  });

  it('antibiotika virker på bakterier, ikke på virus', () => {
    expect(antibioticWorks('bakterie')).toBe(true);
    expect(antibioticWorks('kappekledd')).toBe(false);
    expect(antibioticWorks('bakteriofag')).toBe(false);
  });
});
