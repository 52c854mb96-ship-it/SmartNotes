import { describe, expect, it } from 'vitest';
import {
  CONDENSER_DT,
  EVAPORATOR_DT,
  HOUSE_LOSS,
  KELVIN,
  T_IN_MAX,
  T_IN_MIN,
  T_OUT_MAX,
  T_OUT_MIN,
  heatNeed,
  heatPumpCop,
  heatPumpState,
  idealCop,
  kWhPerDay,
  panelFlows,
  pumpFlows,
  refrigerantTemps,
  toKelvin,
} from './model-varmepumpe';

/** Alle heltallskombinasjoner av glidebryterne. */
function allSettings(): [number, number][] {
  const out: [number, number][] = [];
  for (let tIn = T_IN_MIN; tIn <= T_IN_MAX; tIn++) for (let tOut = T_OUT_MIN; tOut <= T_OUT_MAX; tOut++) out.push([tIn, tOut]);
  return out;
}

describe('kelvin og den ideelle varmefaktoren', () => {
  it('T = t + 273,15', () => {
    expect(KELVIN).toBe(273.15);
    expect(toKelvin(0)).toBeCloseTo(273.15, 10);
    expect(toKelvin(-273.15)).toBeCloseTo(0, 10);
    expect(toKelvin(21)).toBeCloseTo(294.15, 10);
  });

  it('ε_maks = T_v / (T_v − T_k): 21 °C inne og −5 °C ute gir 294,15 / 26 = 11,3', () => {
    expect(idealCop(294.15, 268.15)).toBeCloseTo(294.15 / 26, 10);
    expect(idealCop(294.15, 268.15)).toBeCloseTo(11.31, 2);
  });

  it('ε_maks blir mindre når temperaturforskjellen øker, og er alltid over 1', () => {
    let prev = Infinity;
    for (let tk = 20; tk >= -40; tk -= 5) {
      const e = idealCop(toKelvin(21), toKelvin(tk));
      expect(e).toBeLessThan(prev);
      expect(e).toBeGreaterThan(1);
      prev = e;
    }
  });

  it('like temperaturer: ingen arbeid trengs (uendelig), og aldri NaN', () => {
    expect(idealCop(300, 300)).toBe(Infinity);
    expect(idealCop(280, 300)).toBe(Infinity);
  });
});

describe('kuldemediet og varmefaktoren til varmepumpa', () => {
  it('fordamperen er kaldere enn uteluften og kondensatoren varmere enn inneluften', () => {
    const r = refrigerantTemps(21, -5);
    expect(r.evap).toBe(-5 - EVAPORATOR_DT);
    expect(r.cond).toBe(21 + CONDENSER_DT);
    for (const [tIn, tOut] of allSettings()) {
      const { evap, cond } = refrigerantTemps(tIn, tOut);
      // Varmen går av seg selv fra lufta inn i kuldemediet ute og fra kuldemediet ut i rommet inne
      expect(evap).toBeLessThan(tOut);
      expect(cond).toBeGreaterThan(tIn);
    }
  });

  it('kjente verdier: ca. 4,2 ved 7 °C ute, 3,2 ved −5 °C og 2,3 ved −25 °C (21 °C inne)', () => {
    expect(heatPumpCop(20, 7)).toBeCloseTo(4.2, 1);
    expect(heatPumpCop(21, -5)).toBeCloseTo(0.55 * (314.15 / 54), 10);
    expect(heatPumpCop(21, -5)).toBeCloseTo(3.2, 1);
    expect(heatPumpCop(21, -15)).toBeCloseTo(2.7, 1);
    expect(heatPumpCop(21, -25)).toBeCloseTo(2.33, 2);
  });

  it('varmefaktoren synker når det blir kaldere ute, og når det er varmere inne', () => {
    for (let tIn = T_IN_MIN; tIn <= T_IN_MAX; tIn++) {
      let prev = Infinity;
      for (let tOut = T_OUT_MAX; tOut >= T_OUT_MIN; tOut--) {
        const e = heatPumpCop(tIn, tOut);
        expect(e).toBeLessThan(prev);
        prev = e;
      }
    }
    expect(heatPumpCop(24, -5)).toBeLessThan(heatPumpCop(18, -5));
  });

  it('andre lov: alltid over 1 (bedre enn panelovn) og under den ideelle verdien mellom inne og ute', () => {
    for (const [tIn, tOut] of allSettings()) {
      const e = heatPumpCop(tIn, tOut);
      expect(Number.isFinite(e)).toBe(true);
      expect(e).toBeGreaterThan(2);
      expect(e).toBeLessThan(6);
      expect(e).toBeLessThan(idealCop(toKelvin(tIn), toKelvin(tOut)));
    }
  });
});

describe('varmebehov og energi per døgn', () => {
  it('huset taper 100 W per grad: 21 °C inne og −5 °C ute gir 2 600 W', () => {
    expect(HOUSE_LOSS).toBe(100);
    expect(heatNeed(21, -5)).toBe(2600);
    expect(heatNeed(18, 15)).toBe(300);
    expect(heatNeed(24, -25)).toBe(4900);
  });

  it('ingen varme trengs når det er like varmt eller varmere ute', () => {
    expect(heatNeed(21, 21)).toBe(0);
    expect(heatNeed(18, 25)).toBe(0);
  });

  it('E = P · 24 h: 2 600 W i et døgn er 62,4 kWh', () => {
    expect(kWhPerDay(2600)).toBeCloseTo(62.4, 10);
    expect(kWhPerDay(1000)).toBeCloseTo(24, 10);
    expect(kWhPerDay(0)).toBe(0);
  });
});

describe('energistrømmene', () => {
  it('panelovnen: W = Q_v og Q_k = 0 (ε = 1)', () => {
    const p = panelFlows(2600);
    expect(p).toEqual({ Qv: 2600, W: 2600, Qk: 0 });
  });

  it('varmepumpa: W = Q_v / ε og Q_k = Q_v − W', () => {
    const f = pumpFlows(3000, 3);
    expect(f.W).toBeCloseTo(1000, 10);
    expect(f.Qk).toBeCloseTo(2000, 10);
  });

  it('standardverdiene: 62,4 kWh varme, ca. 19,5 kWh strøm og 42,9 kWh fra uteluften per døgn', () => {
    const s = heatPumpState(21, -5);
    expect(s.dT).toBe(26);
    expect(s.need).toBe(2600);
    expect(s.cop).toBeCloseTo(3.2, 1);
    expect(s.day.pump.Qv).toBeCloseTo(62.4, 10);
    expect(s.day.pump.W).toBeCloseTo(62.4 / s.cop, 10);
    expect(s.day.pump.W).toBeCloseTo(19.5, 1);
    expect(s.day.pump.Qk).toBeCloseTo(42.9, 1);
    expect(s.day.panel.W).toBeCloseTo(62.4, 10);
    expect(s.saved).toBeCloseTo(s.day.pump.Qk, 10);
    expect(s.savedShare).toBeCloseTo(0.69, 2);
    expect(s.refrigerant).toEqual({ evap: -13, cond: 41 });
    expect(s.ideal).toBeCloseTo(294.15 / 26, 10);
  });

  it('energibevaring og fornuftige tall for alle innstillinger', () => {
    for (const [tIn, tOut] of allSettings()) {
      const s = heatPumpState(tIn, tOut);
      for (const f of [s.pump, s.panel, s.day.pump, s.day.panel]) {
        expect(f.Qv).toBeCloseTo(f.Qk + f.W, 9);
        expect(f.W).toBeGreaterThan(0);
        expect(f.Qk).toBeGreaterThanOrEqual(0);
        for (const v of [f.Qv, f.W, f.Qk]) expect(Number.isFinite(v)).toBe(true);
      }
      // Samme varme til huset, men varmepumpa bruker mindre strøm
      expect(s.day.pump.Qv).toBeCloseTo(s.day.panel.Qv, 9);
      expect(s.day.pump.W).toBeLessThan(s.day.panel.W);
      expect(s.day.pump.W * s.cop).toBeCloseTo(s.day.pump.Qv, 9);
      expect(s.saved).toBeGreaterThan(0);
      expect(s.savedShare).toBeGreaterThan(0.5);
      expect(s.savedShare).toBeLessThan(0.85);
      expect(s.day.panel.W).toBeLessThanOrEqual(117.6 + 1e-9);
    }
  });

  it('når det blir kaldere, trengs mer varme og varmepumpa bruker mer strøm per kWh varme', () => {
    const mild = heatPumpState(21, 5);
    const cold = heatPumpState(21, -20);
    expect(cold.need).toBeGreaterThan(mild.need);
    expect(cold.day.pump.W / cold.day.pump.Qv).toBeGreaterThan(mild.day.pump.W / mild.day.pump.Qv);
    // Strømmen vokser raskere enn varmebehovet (dobbelt så mye varme, mer enn dobbelt så mye strøm)
    expect(cold.day.pump.W / mild.day.pump.W).toBeGreaterThan(cold.need / mild.need);
  });
});
