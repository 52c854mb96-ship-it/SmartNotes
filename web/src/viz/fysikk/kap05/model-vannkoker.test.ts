import { describe, expect, it } from 'vitest';
import { MATERIALS } from './model';
import {
  BOILING_POINT,
  C_WATER,
  KETTLE,
  KETTLE_ETA,
  POT_ETA,
  POT_LID_ETA,
  boilRun,
  boilTime,
  heatState,
  heatToBoil,
  idealBoilTime,
  minSec,
  potHeater,
  timeAxisEnd,
  toKWh,
  waterMass,
} from './model-vannkoker';

describe('vannkoker: energien vannet trenger', () => {
  it('bruker samme c for vann som resten av kapittelet', () => {
    expect(C_WATER).toBe(MATERIALS.vann.c);
    expect(BOILING_POINT).toBe(MATERIALS.vann.boil);
  });

  it('1 L vann har massen 1 kg', () => {
    expect(waterMass(1)).toBe(1);
    expect(waterMass(0.25)).toBeCloseTo(0.25, 12);
    expect(waterMass(-1)).toBe(0);
  });

  it('Q = c·m·ΔT: 1,0 kg fra 10 °C til 100 °C er 376,2 kJ', () => {
    expect(heatToBoil(1, 10)).toBeCloseTo(376200, 6);
    expect(heatToBoil(0.5, 20)).toBeCloseTo(4180 * 0.5 * 80, 6);
  });

  it('trenger ingen varme når vannet allerede koker', () => {
    expect(heatToBoil(1, 100)).toBe(0);
    expect(heatToBoil(1, 120)).toBe(0);
  });

  it('dobbelt så mye vann eller dobbel temperaturøkning gir dobbel varme', () => {
    expect(heatToBoil(2, 20)).toBeCloseTo(2 * heatToBoil(1, 20), 6);
    expect(heatToBoil(1, 0)).toBeCloseTo(2 * heatToBoil(1, 50), 6);
  });
});

describe('vannkoker: tiden til vannet koker', () => {
  it('uten varmetap: t = cmΔT/P (1,0 L fra 10 °C med 2000 W tar 188,1 s)', () => {
    expect(boilTime(2000, 1, 1, 10)).toBeCloseTo(188.1, 6);
    expect(idealBoilTime({ P: 2000, liters: 1, T0: 10 })).toBeCloseTo(188.1, 6);
  });

  it('med virkningsgrad: t = cmΔT/(ηP) blir lengre', () => {
    expect(boilTime(2000, 0.85, 1, 10)).toBeCloseTo(376200 / 1700, 6);
    expect(boilTime(2000, 0.5, 1, 10)).toBeCloseTo(376.2, 6);
    expect(boilTime(2000, 0.85, 1, 10)).toBeGreaterThan(boilTime(2000, 1, 1, 10));
  });

  it('tiden er omvendt proporsjonal med effekten og med virkningsgraden', () => {
    const t = boilTime(1000, 0.8, 1.5, 15);
    expect(boilTime(2000, 0.8, 1.5, 15)).toBeCloseTo(t / 2, 9);
    expect(boilTime(1000, 0.4, 1.5, 15)).toBeCloseTo(2 * t, 9);
  });

  it('tiden er proporsjonal med vannmengden og temperaturøkningen', () => {
    expect(boilTime(2000, 0.85, 0.5, 20)).toBeCloseTo(boilTime(2000, 0.85, 1, 20) / 2, 9);
    expect(boilTime(2000, 0.85, 1, 60)).toBeCloseTo(boilTime(2000, 0.85, 1, 20) / 2, 9);
  });

  it('uten effekt eller virkningsgrad koker vannet aldri', () => {
    expect(boilTime(0, 0.85, 1, 10)).toBe(Infinity);
    expect(boilTime(2000, 0, 1, 10)).toBe(Infinity);
  });
});

describe('vannkoker: tilstanden underveis', () => {
  const P = 2000;
  const eta = 0.85;
  const m = 1;
  const T0 = 10;
  const tb = boilTime(P, eta, m, T0);

  it('starter på T0 uten energi', () => {
    const s = heatState(P, eta, m, T0, 0);
    expect(s).toEqual({ T: T0, E: 0, Q: 0, loss: 0, done: false });
  });

  it('temperaturen stiger like mye hvert sekund (rett linje)', () => {
    const a = heatState(P, eta, m, T0, 30).T - T0;
    const b = heatState(P, eta, m, T0, 60).T - T0;
    expect(b).toBeCloseTo(2 * a, 9);
    expect(a).toBeCloseTo((eta * P * 30) / (C_WATER * m), 9);
  });

  it('energiregnskapet går opp: E = Q + tap, og Q = ηE = cmΔT', () => {
    for (const t of [0, 10, 77.7, tb / 2, tb, tb + 100]) {
      const s = heatState(P, eta, m, T0, t);
      expect(s.Q + s.loss).toBeCloseTo(s.E, 6);
      expect(s.Q).toBeCloseTo(eta * s.E, 6);
      expect(s.Q).toBeCloseTo(C_WATER * m * (s.T - T0), 4);
    }
  });

  it('koker etter tb og slår seg av: energien står stille og T = 100 °C', () => {
    const at = heatState(P, eta, m, T0, tb);
    const after = heatState(P, eta, m, T0, tb + 300);
    expect(at.done).toBe(true);
    expect(at.T).toBeCloseTo(100, 9);
    expect(after.T).toBe(100);
    expect(after.E).toBeCloseTo(P * tb, 6);
    expect(heatState(P, eta, m, T0, tb - 1).done).toBe(false);
    expect(heatState(P, eta, m, T0, tb - 1).T).toBeLessThan(100);
  });

  it('negativ tid gir starttilstanden, og tallene blir aldri NaN', () => {
    expect(heatState(P, eta, m, T0, -5).E).toBe(0);
    const s = heatState(0, eta, m, T0, 100);
    expect(s.T).toBe(T0);
    expect(Number.isNaN(heatState(P, eta, 0, T0, 10).T)).toBe(false);
    expect(Number.isNaN(heatState(P, eta, m, T0, Number.NaN).T)).toBe(false);
  });
});

describe('vannkoker mot kasserolle på kokeplate', () => {
  const input = { P: 2000, liters: 1, T0: 10 };

  it('virkningsgradene er realistiske, og lokket hjelper', () => {
    expect(KETTLE_ETA).toBeGreaterThan(POT_LID_ETA);
    expect(POT_LID_ETA).toBeGreaterThan(POT_ETA);
    expect(potHeater(false).eta).toBe(POT_ETA);
    expect(potHeater(true).eta).toBe(POT_LID_ETA);
  });

  it('samme varme Q til vannet, men kasserollen bruker mer energi og lengre tid', () => {
    const k = boilRun(input, KETTLE);
    const p = boilRun(input, potHeater(false));
    expect(k.Q).toBeCloseTo(p.Q, 6);
    expect(p.t).toBeGreaterThan(k.t);
    expect(p.E).toBeGreaterThan(k.E);
    expect(p.t / k.t).toBeCloseTo(KETTLE_ETA / POT_ETA, 9);
  });

  it('kjente tall: 221,3 s for vannkokeren og 376,2 s for kasserollen', () => {
    const k = boilRun(input, KETTLE);
    const p = boilRun(input, potHeater(false));
    expect(k.t).toBeCloseTo(221.29, 2);
    expect(k.E).toBeCloseTo(442588, 0);
    expect(k.loss).toBeCloseTo(66388, 0);
    expect(p.t).toBeCloseTo(376.2, 6);
    expect(p.E).toBeCloseTo(752400, 4);
    expect(p.loss).toBeCloseTo(376200, 4);
  });

  it('nyttig og tapt effekt blir til sammen P', () => {
    for (const h of [KETTLE, potHeater(false), potHeater(true)]) {
      const r = boilRun(input, h);
      expect(r.usefulPower + r.lossPower).toBeCloseTo(input.P, 9);
      expect(r.usefulPower * r.t).toBeCloseTo(r.Q, 4);
      expect(r.lossPower * r.t).toBeCloseTo(r.loss, 4);
      expect(r.rate * r.t).toBeCloseTo(BOILING_POINT - input.T0, 9);
    }
  });

  it('gir fornuftige tall i hele området til glidebryterne', () => {
    for (const P of [500, 2000, 3000])
      for (const liters of [0.25, 1, 1.7])
        for (const T0 of [0, 10, 90])
          for (const h of [KETTLE, potHeater(false), potHeater(true)]) {
            const r = boilRun({ P, liters, T0 }, h);
            expect(Number.isFinite(r.t)).toBe(true);
            expect(r.t).toBeGreaterThan(0);
            expect(r.t).toBeLessThan(3600);
            expect(r.loss).toBeGreaterThanOrEqual(0);
            expect(r.t).toBeGreaterThanOrEqual(idealBoilTime({ P, liters, T0 }));
          }
  });
});

describe('vannkoker: hjelpefunksjoner', () => {
  it('kWh: 3,6 MJ = 1 kWh', () => {
    expect(toKWh(3.6e6)).toBe(1);
    expect(toKWh(442588)).toBeCloseTo(0.1229, 4);
  });

  it('minutter og sekunder', () => {
    expect(minSec(221.29)).toEqual({ min: 3, s: 41 });
    expect(minSec(59.6)).toEqual({ min: 1, s: 0 });
    expect(minSec(45)).toEqual({ min: 0, s: 45 });
    expect(minSec(-3)).toEqual({ min: 0, s: 0 });
  });

  it('tidsaksen slutter litt etter siste oppkoking, på en pen verdi', () => {
    expect(timeAxisEnd(376.2)).toBe(500);
    expect(timeAxisEnd(221.3)).toBe(250);
    expect(timeAxisEnd(9)).toBe(10);
    expect(timeAxisEnd(2600)).toBe(3000);
    for (const t of [3, 47, 188, 999, 2700]) expect(timeAxisEnd(t)).toBeGreaterThanOrEqual(t * 1.08 - 1e-9);
  });
});
