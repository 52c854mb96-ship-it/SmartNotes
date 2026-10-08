import { describe, expect, it } from 'vitest';
import {
  ACTIVITY_TASKS,
  activity,
  clockText,
  convertTime,
  decayCurve,
  fractionLeft,
  hourMinText,
  roundTo,
  sig,
  solveActivityTask,
  startTexts,
  timeToFraction,
  weekdayAfter,
  type ActivityTask,
} from './model-eks-aktivitet';

const task = (id: ActivityTask['id']) => ACTIVITY_TASKS.find((t) => t.id === id)!;

describe('halveringsloven', () => {
  it('halverer aktiviteten for hver halveringstid', () => {
    expect(activity(800, 0, 6)).toBe(800);
    expect(activity(800, 6, 6)).toBeCloseTo(400, 10);
    expect(activity(800, 12, 6)).toBeCloseTo(200, 10);
    expect(activity(800, 24, 6)).toBeCloseTo(50, 10);
    expect(fractionLeft(3 * 8, 8)).toBeCloseTo(1 / 8, 12);
  });

  it('gir samme svar uansett tidsenhet, så lenge t og T½ har samme enhet', () => {
    const inH = fractionLeft(2.5, 6);
    const inMin = fractionLeft(150, 360);
    expect(inMin).toBeCloseTo(inH, 12);
    expect(convertTime(6, 'døgn', 'h')).toBe(144);
    expect(convertTime(1, 'døgn', 'min')).toBe(1440);
    expect(convertTime(75, 'min', 'h')).toBeCloseTo(1.25, 12);
  });

  it('er brattest i starten: kurven ligger under den rette linja mellom to halveringer', () => {
    for (const x of [0.1, 0.25, 0.5, 0.75, 0.9]) {
      expect(fractionLeft(x, 1)).toBeLessThan(1 - x / 2);
    }
  });

  it('finner tida til en andel med logaritmer, og den går tilbake til andelen', () => {
    expect(timeToFraction(0.5, 6)).toBeCloseTo(6, 12);
    expect(timeToFraction(0.25, 6)).toBeCloseTo(12, 12);
    expect(timeToFraction(0.1, 1)).toBeCloseTo(3.3219, 4);
    expect(timeToFraction(0.01, 1)).toBeCloseTo(6.6439, 4);
    for (const p of [0.9, 0.5, 0.1, 0.05, 0.001]) {
      expect(fractionLeft(timeToFraction(p, 8), 8)).toBeCloseTo(p, 12);
    }
  });

  it('håndterer grensetilfeller uten NaN der svaret finnes', () => {
    expect(timeToFraction(1, 6)).toBe(0);
    expect(timeToFraction(1.5, 6)).toBe(0);
    expect(timeToFraction(0, 6)).toBe(Number.POSITIVE_INFINITY);
    expect(Number.isNaN(timeToFraction(0.5, 0))).toBe(true);
    expect(Number.isNaN(activity(800, 1, 0))).toBe(true);
  });

  it('lager en kurve som starter i startverdien og synker hele veien', () => {
    const pts = decayCurve(600, 2.5, 30, 6, 50);
    expect(pts).toHaveLength(51);
    expect(pts[0]).toEqual([2.5, 600]);
    expect(pts.at(-1)![0]).toBeCloseTo(30, 12);
    for (let i = 1; i < pts.length; i++) expect(pts[i]![1]).toBeLessThan(pts[i - 1]![1]);
    expect(decayCurve(600, 5, 5, 6)).toEqual([]);
  });
});

describe('tekst for tidspunkter', () => {
  it('skriver klokkeslett, ukedager og varigheter', () => {
    expect(clockText(7.5)).toBe('07.30');
    expect(clockText(10)).toBe('10.00');
    expect(clockText(7.5 + 24)).toBe('07.30');
    expect(weekdayAfter(0, 3)).toBe('torsdag');
    expect(weekdayAfter(4, 3)).toBe('mandag');
    expect(hourMinText(75)).toBe('1 h 15 min');
    expect(hourMinText(150)).toBe('2 h 30 min');
    expect(hourMinText(45)).toBe('45 min');
    expect(hourMinText(120)).toBe('2 h');
  });

  it('henger sammen med tida fram til innsprøytingen', () => {
    expect(startTexts(task('tc'))).toEqual({ measured: 'klokka 07.30', given: 'klokka 10.00', diff: '2 h 30 min' });
    expect(startTexts(task('jod'))).toEqual({ measured: 'mandag', given: 'torsdag', diff: 'fra mandag til torsdag' });
    expect(startTexts(task('fluor')).diff).toBe('1 h 15 min');
  });
});

describe('eksempeloppgaven «Aktivitet og halveringstid i medisin»', () => {
  it('har tre tallsett: Tc-99m, I-131 og F-18', () => {
    expect(ACTIVITY_TASKS.map((t) => t.id)).toEqual(['tc', 'jod', 'fluor']);
  });

  it('a) halveringstida kan leses av på grafen: halv aktivitet etter T½ og en firedel etter 2 T½', () => {
    for (const t of ACTIVITY_TASKS) {
      const s = solveActivityTask(t);
      expect(s.halvings.map((h) => h.t)).toEqual([0, t.T, 2 * t.T]);
      expect(s.halvings[1]!.A).toBeCloseTo(t.A0 / 2, 9);
      expect(s.halvings[2]!.A).toBeCloseTo(t.A0 / 4, 9);
    }
  });

  it('b) gir aktiviteten ved innsprøytingen (kjente verdier)', () => {
    const tc = solveActivityTask(task('tc'));
    expect(tc.nB).toBeCloseTo(0.41667, 5);
    expect(tc.factorB).toBeCloseTo(0.7492, 4);
    expect(tc.Ab).toBeCloseTo(599.3, 1);
    expect(sig(tc.Ab, 2)).toBe(600);
    expect(tc.linearWrong).toBeCloseTo(633.3, 1);

    const jod = solveActivityTask(task('jod'));
    expect(jod.Ab).toBeCloseTo(539.8, 1);
    expect(sig(jod.Ab, 2)).toBe(540);

    const f = solveActivityTask(task('fluor'));
    expect(f.Ab).toBeCloseTo(311.7, 1);
    expect(f.lostB).toBeCloseTo(0.377, 3);
  });

  it('b) mellomsvaret går opp med tallene som vises (faktoren med fire desimaler, A med tre siffer)', () => {
    for (const t of ACTIVITY_TASKS) {
      const s = solveActivityTask(t);
      expect(sig(t.A0 * Number(s.factorB.toFixed(4)), 3)).toBe(sig(s.Ab, 3));
      // Den lineære feilen gir alltid for stor aktivitet.
      expect(s.linearWrong).toBeGreaterThan(s.Ab);
    }
  });

  it('c) tida til andelen p: logaritmene, overslaget og avlesningen på grafen stemmer', () => {
    const tc = solveActivityTask(task('tc'));
    expect(tc.lgP).toBeCloseTo(-1, 12);
    expect(tc.nC).toBeCloseTo(3.3219, 4);
    expect(tc.tC).toBeCloseTo(19.93, 2);
    expect(tc.Ac).toBeCloseTo(59.93, 2);
    expect(tc.tCross).toBeCloseTo(22.43, 2);
    expect(tc.tRead).toBe(22.5);
    expect(tc.tReadDiff).toBe(20);
    expect(tc.between).toMatchObject({ k: 3, t1: 18, t2: 24, fracHigh: 0.125, fracLow: 0.0625 });

    const jod = solveActivityTask(task('jod'));
    expect(jod.nC).toBeCloseTo(4.3219, 4);
    expect(jod.tC).toBeCloseTo(34.58, 2);
    expect(jod.between).toMatchObject({ k: 4, t1: 32, t2: 40 });

    const f = solveActivityTask(task('fluor'));
    expect(f.tC).toBeCloseTo(365.4, 1);
    expect(f.tRead).toBe(440);
    expect(f.tReadDiff).toBe(365);

    for (const t of ACTIVITY_TASKS) {
      const s = solveActivityTask(t);
      // Aktiviteten ved krysningen er p · Ab.
      expect(activity(t.A0, s.tCross, t.T)).toBeCloseTo(s.Ac, 9);
      // Overslaget: p ligger mellom andelen etter k og k + 1 halveringstider.
      expect(t.p).toBeLessThanOrEqual(s.between.fracHigh);
      expect(t.p).toBeGreaterThan(s.between.fracLow);
      expect(s.tC).toBeGreaterThanOrEqual(s.between.t1);
      expect(s.tC).toBeLessThan(s.between.t2);
      // Avlesningen er nær nok det utregnede svaret.
      expect(Math.abs(s.tReadDiff - s.tC)).toBeLessThanOrEqual(t.graph.read / 2 + 1e-9);
      // Mellomsvaret T½ · n med n på fire siffer gir samme tid med tre siffer.
      expect(sig(t.T * sig(s.nC, 4), 3)).toBe(sig(s.tC, 3));
    }
  });

  it('d) mye mindre er igjen av det medisinske stoffet enn av det tenkte stoffet', () => {
    const tc = solveActivityTask(task('tc'));
    expect(tc.nD).toBe(4);
    expect(tc.fD).toBeCloseTo(0.0625, 12);
    expect(tc.fDLong).toBeCloseTo(0.8909, 4);
    expect(tc.ratio).toBe(24);

    const jod = solveActivityTask(task('jod'));
    expect(jod.fD).toBeCloseTo(0.0884, 4);
    expect(jod.fDLong).toBeCloseTo(0.7846, 4);
    expect(jod.ratio).toBe(10);

    const f = solveActivityTask(task('fluor'));
    expect(f.fD).toBeCloseTo(0.0486, 4);
    expect(f.fDLong).toBeCloseTo(0.7937, 4);

    for (const t of ACTIVITY_TASKS) {
      const s = solveActivityTask(t);
      expect(s.fD).toBeLessThan(0.1);
      expect(s.fDLong).toBeGreaterThan(0.75);
      expect(s.AD).toBeCloseTo(s.Ab * s.fD, 9);
      expect(s.ADLong).toBeGreaterThan(s.AD);
    }
  });

  it('har fornuftige tall i alle tallsettene, og alt får plass på grafen', () => {
    for (const t of ACTIVITY_TASKS) {
      const s = solveActivityTask(t);
      const g = t.graph;
      // Teksten og modellen bruker samme tider.
      expect(convertTime(t.tDText.unit === 'uker' ? t.tDText.value * 7 : t.tDText.value, t.tDText.unit === 'uker' ? 'døgn' : t.tDText.unit, t.unit)).toBeCloseTo(t.tD, 9);
      expect(convertTime(t.TLongText.value, t.TLongText.unit, t.unit)).toBeCloseTo(t.TLong, 9);
      // Pasienten får stoffet før én halveringstid har gått, og aktiviteten er realistisk (100–1000 MBq).
      expect(t.tB).toBeGreaterThan(0);
      expect(t.tB).toBeLessThan(t.T);
      expect(s.Ab).toBeGreaterThan(100);
      expect(s.Ab).toBeLessThan(1000);
      // Grafen viser startverdien, to halveringer, krysningen i c og tidspunktet i d.
      expect(t.A0).toBeLessThanOrEqual(g.yMax);
      expect(2 * t.T).toBeLessThan(g.xMax);
      expect(s.tCross).toBeLessThan(g.xMax);
      expect(t.tB + t.tD).toBeLessThanOrEqual(g.xMax);
      // Rutenettet går opp med akseverdiene.
      expect((g.xMax / g.xStep) % 1).toBe(0);
      expect((g.xStep / g.xMinor) % 1).toBe(0);
      expect((g.yMax / g.yStep) % 1).toBe(0);
      expect((g.yStep / g.yMinor) % 1).toBe(0);
      // Halveringstida ligger på en rutelinje eller midt mellom to, så den kan leses av.
      expect((t.T / (g.xMinor / 2)) % 1).toBeCloseTo(0, 9);
      expect(((t.A0 / 2) / g.yMinor) % 1).toBeCloseTo(0, 9);
      expect(roundTo(s.tCross, g.read)).toBe(s.tRead);
      // Det tenkte stoffet lever minst ti ganger så lenge.
      expect(s.ratio).toBeGreaterThanOrEqual(10);
    }
  });
});
