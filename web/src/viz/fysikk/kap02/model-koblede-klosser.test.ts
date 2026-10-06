import { describe, expect, it } from 'vitest';
import { coupled } from './model';
import {
  TOW_RANGES,
  TOW_T_IDLE,
  TOW_T_MAX,
  TOW_V_END,
  TRAILER,
  roundSig,
  towDuration,
  towMotion,
  towSystem,
  trailerLoad,
  type TowView,
} from './model-koblede-klosser';

const VIEWS: TowView[] = ['system', 'henger', 'bil'];
const R = TOW_RANGES;

/** Alle hjørnene i tallområdet pluss standardverdiene. */
const CASES: [mH: number, mB: number, F: number][] = [
  [R.mH.start, R.mB.start, R.F.start],
  ...[R.mH.min, R.mH.max].flatMap((mH) => [R.mB.min, R.mB.max].flatMap((mB) => [R.F.min, R.F.max].map((F): [number, number, number] => [mH, mB, F]))),
];

describe('bil med tilhenger: standardverdiene', () => {
  it('800 kg henger, 1 400 kg bil og 3 300 N gir a = 1,50 m/s² og S = 1 200 N', () => {
    const r = towSystem('system', 800, 1400, 3300);
    expect(r.a).toBeCloseTo(1.5, 12);
    expect(r.S).toBeCloseTo(1200, 9);
    expect(r.netA).toBeCloseTo(1200, 9);
    expect(r.netB).toBeCloseTo(2100, 9);
  });

  it('er de samme tallene som to klosser med snor (coupled)', () => {
    for (const [mH, mB, F] of CASES) expect(towSystem('bil', mH, mB, F)).toMatchObject(coupled(mH, mB, F));
  });
});

describe('bil med tilhenger: valg av system', () => {
  it('kraftsummen på hvert system er massen til systemet ganger a (Newtons 2. lov)', () => {
    for (const [mH, mB, F] of CASES)
      for (const view of VIEWS) {
        const r = towSystem(view, mH, mB, F);
        expect(r.net).toBeCloseTo(r.mass * r.a, 6);
      }
  });

  it('hele vogntoget: bare F er ytre kraft, og de to S-ene er indre og opphever hverandre', () => {
    const r = towSystem('system', 800, 1400, 3300);
    expect(r.mass).toBe(2200);
    expect(r.net).toBe(3300);
    const internal = r.forces.filter((f) => f.internal);
    expect(internal.map((f) => f.name)).toEqual(['S', 'S']);
    expect(internal.reduce((s, f) => s + f.value, 0)).toBeCloseTo(0, 12);
    expect(r.forces.filter((f) => !f.internal).map((f) => f.name)).toEqual(['F']);
  });

  it('hengeren alene: bare S virker, fremover, og den er ytre kraft', () => {
    const r = towSystem('henger', 800, 1400, 3300);
    expect(r.mass).toBe(800);
    expect(r.forces).toEqual([{ name: 'S', on: 'henger', from: 'bilen', value: r.S, internal: false }]);
    expect(r.net).toBeCloseTo(1200, 9);
  });

  it('bilen alene: F fremover og S bakover', () => {
    const r = towSystem('bil', 800, 1400, 3300);
    expect(r.mass).toBe(1400);
    expect(r.forces.map((f) => [f.name, f.internal, Math.sign(f.value)])).toEqual([
      ['F', false, 1],
      ['S', false, -1],
    ]);
    expect(r.net).toBeCloseTo(2100, 9);
  });

  it('kraften i hengerfestet er et kraftpar: like stor på bilen og hengeren, motsatt rettet', () => {
    for (const [mH, mB, F] of CASES) {
      const r = towSystem('system', mH, mB, F);
      const onH = r.forces.find((f) => f.on === 'henger')!;
      const onB = r.forces.find((f) => f.on === 'bil' && f.name === 'S')!;
      expect(onH.value).toBeCloseTo(-onB.value, 9);
      expect(onH.from).toBe('bilen');
      expect(onB.from).toBe('hengeren');
    }
  });

  it('S er alltid mindre enn F, og andelen er m_H/(m_H + m_B)', () => {
    for (const [mH, mB, F] of CASES) {
      const r = towSystem('system', mH, mB, F);
      expect(r.S).toBeGreaterThanOrEqual(0);
      expect(r.S).toBeLessThanOrEqual(F);
      if (F > 0) expect(r.S / F).toBeCloseTo(mH / (mH + mB), 12);
    }
  });

  it('tyngre henger: mindre akselerasjon, men større kraft i hengerfestet', () => {
    const light = towSystem('system', 400, 1400, 3300);
    const heavy = towSystem('system', 1100, 1400, 3300);
    expect(heavy.a).toBeLessThan(light.a);
    expect(heavy.S).toBeGreaterThan(light.S);
  });

  it('uten drivkraft er alle kreftene og akselerasjonen null', () => {
    for (const view of VIEWS) {
      const r = towSystem(view, 800, 1400, 0);
      expect(r.a).toBe(0);
      expect(r.S).toBe(0);
      expect(r.net).toBe(0);
    }
  });

  it('alle hjørnene i tallområdet gir endelige og fornuftige tall', () => {
    for (const [mH, mB, F] of CASES) {
      const r = towSystem('system', mH, mB, F);
      expect(Number.isFinite(r.a) && Number.isFinite(r.S)).toBe(true);
      expect(r.a).toBeGreaterThanOrEqual(0);
      // Den letteste kombinasjonen med full drivkraft gir 5 m/s², omtrent som en sterk bil uten henger.
      expect(r.a).toBeLessThanOrEqual(5 + 1e-9);
    }
  });
});

describe('bil med tilhenger: lasten', () => {
  it('tom henger har ingen last', () => {
    expect(trailerLoad(TRAILER.empty)).toEqual({ load: 0, fill: [0, 0, 0] });
  });

  it('massen stemmer: tom henger pluss sekkene er m_H', () => {
    for (let mH = R.mH.min; mH <= R.mH.max; mH += R.mH.step) {
      const { load, fill } = trailerLoad(mH);
      expect(load).toBe(mH - TRAILER.empty);
      expect(TRAILER.empty + fill.reduce((s, x) => s + x, 0) * TRAILER.bagMass).toBeCloseTo(mH, 9);
    }
  });

  it('fyller den bakerste og den fremste sekken like mye først (tyngdepunktet over akslingen)', () => {
    expect(trailerLoad(500).fill).toEqual([0.5, 0, 0.5]);
    expect(trailerLoad(800).fill).toEqual([1, 0, 1]);
    expect(trailerLoad(950).fill).toEqual([1, 0.5, 1]);
    expect(trailerLoad(R.mH.max).fill).toEqual([1, 1, 1]);
  });

  it('holder seg innenfor null og tre fulle sekker', () => {
    expect(trailerLoad(0).fill).toEqual([0, 0, 0]);
    expect(trailerLoad(5000).fill).toEqual([1, 1, 1]);
    expect(trailerLoad(Number.NaN).load).toBe(0);
  });
});

describe('bil med tilhenger: bevegelsen fra ro', () => {
  it('v = at og s = ½at², så v² = 2as (tidløs likning)', () => {
    const m = towMotion(1.5, 8);
    expect(m.v).toBeCloseTo(12, 12);
    expect(m.s).toBeCloseTo(48, 12);
    expect(m.v ** 2).toBeCloseTo(2 * 1.5 * m.s, 9);
  });

  it('stopper ved 80 km/h eller etter 15 s', () => {
    expect(towDuration(1.5)).toBeCloseTo(TOW_V_END / 1.5, 12);
    expect(towDuration(0.5)).toBe(TOW_T_MAX);
    expect(towMotion(5, 100).v).toBeCloseTo(TOW_V_END, 12);
    expect(towMotion(0.5, 100).t).toBe(TOW_T_MAX);
  });

  it('uten akselerasjon står vogntoget stille', () => {
    expect(towDuration(0)).toBe(TOW_T_IDLE);
    expect(towMotion(0, 3)).toEqual({ t: 3, v: 0, s: 0 });
    expect(towMotion(Number.NaN, 2).s).toBe(0);
    expect(towMotion(1, -2)).toEqual({ t: 0, v: 0, s: 0 });
  });

  it('farten blir aldri større enn 80 km/h i tallområdet', () => {
    for (const [mH, mB, F] of CASES) {
      const { a } = towSystem('system', mH, mB, F);
      const end = towMotion(a, towDuration(a));
      expect(end.v).toBeLessThanOrEqual(TOW_V_END + 1e-9);
      expect(end.s).toBeGreaterThanOrEqual(0);
    }
  });
});

describe('bil med tilhenger: tre gjeldende siffer', () => {
  it('G for en bil på 1 400 kg vises som 13 700 N', () => {
    expect(roundSig(1400 * 9.81)).toEqual({ value: 13700, decimals: 0 });
    expect(roundSig(200 * 9.81)).toEqual({ value: 1960, decimals: 0 });
    expect(roundSig(2200 * 9.81)).toEqual({ value: 21600, decimals: 0 });
  });

  it('små tall får desimaler, og negative tall og null går greit', () => {
    expect(roundSig(1.2345)).toEqual({ value: 1.23, decimals: 2 });
    expect(roundSig(0.012345)).toEqual({ value: 0.0123, decimals: 4 });
    expect(roundSig(-13734)).toEqual({ value: -13700, decimals: 0 });
    expect(roundSig(0)).toEqual({ value: 0, decimals: 0 });
    expect(roundSig(Number.NaN)).toEqual({ value: 0, decimals: 0 });
    expect(roundSig(999.6)).toEqual({ value: 1000, decimals: 0 });
  });
});
