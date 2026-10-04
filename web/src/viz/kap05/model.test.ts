import { describe, expect, it } from 'vitest';
import {
  AIR_HEAT_CAPACITY,
  GAS_MOLAR_U,
  GAS_N,
  MATERIALS,
  equilibriumTemp,
  firstLaw,
  gasPressure,
  heating,
  makeParticles,
  meanSquareSpeed,
  mixState,
  seededRandom,
  stepParticles,
  temperatureAfter,
  timeToReach,
  toCelsius,
  toKelvin,
  typicalSpeed,
} from './model';

describe('temperatur og trykk i en gass', () => {
  it('kelvin og celsius: 0 K = −273,15 °C, og 20 °C = 293,15 K', () => {
    expect(toCelsius(0)).toBeCloseTo(-273.15, 9);
    expect(toKelvin(20)).toBeCloseTo(293.15, 9);
    expect(toCelsius(toKelvin(-40))).toBeCloseTo(-40, 9);
  });

  it('pV = nRT: 0,10 mol ved 20 °C i 2,40 L gir omtrent lufttrykket', () => {
    expect(gasPressure(GAS_N, 293, 2.4e-3)).toBeCloseTo(101_455, -1);
    // Lærebokeksempel: 1,00 mol ved 273 K i 22,4 L gir 1 atm
    expect(gasPressure(1, 273, 22.4e-3)).toBeCloseTo(101_276, -1);
  });

  it('litt over romtemperatur gir litt høyere trykk (ved samme volum)', () => {
    const p293 = gasPressure(GAS_N, 293, 2e-3);
    expect(gasPressure(GAS_N, 300, 2e-3) / p293).toBeCloseTo(300 / 293, 9);
    expect(gasPressure(GAS_N, 300, 2e-3)).toBeGreaterThan(p293);
  });

  it('trykket er proporsjonalt med T i kelvin, ikke i celsius', () => {
    const p20 = gasPressure(GAS_N, toKelvin(20), 2e-3);
    const p40 = gasPressure(GAS_N, toKelvin(40), 2e-3);
    expect(p40 / p20).toBeCloseTo(313.15 / 293.15, 9);
    expect(p40 / p20).toBeLessThan(1.1);
    expect(gasPressure(GAS_N, 600, 2e-3) / gasPressure(GAS_N, 300, 2e-3)).toBeCloseTo(2, 9);
  });

  it('halvt volum gir dobbelt trykk, og ved det absolutte nullpunktet er trykket null', () => {
    expect(gasPressure(GAS_N, 300, 1e-3) / gasPressure(GAS_N, 300, 2e-3)).toBeCloseTo(2, 9);
    expect(gasPressure(GAS_N, 0, 2e-3)).toBe(0);
    expect(gasPressure(GAS_N, -5, 2e-3)).toBe(0);
    expect(Number.isNaN(gasPressure(GAS_N, 300, 0))).toBe(true);
  });

  it('nitrogenmolekyler har en typisk fart på omtrent 500 m/s ved romtemperatur, og farten følger √T', () => {
    expect(typicalSpeed(293, GAS_MOLAR_U)).toBeCloseTo(510, -1);
    expect(typicalSpeed(4 * 293, GAS_MOLAR_U) / typicalSpeed(293, GAS_MOLAR_U)).toBeCloseTo(2, 9);
    expect(typicalSpeed(0, GAS_MOLAR_U)).toBe(0);
  });
});

describe('partikkelmodellen', () => {
  it('tallgeneratoren gir samme tall for samme frø, mellom 0 og 1', () => {
    const a = seededRandom(7);
    const b = seededRandom(7);
    for (let i = 0; i < 100; i++) {
      const x = a();
      expect(x).toBe(b());
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThan(1);
    }
    expect(seededRandom(8)()).not.toBe(seededRandom(7)());
  });

  it('samme frø gir samme partikler, og alle starter inne i boksen', () => {
    const ps = makeParticles(40, 11, 100);
    expect(ps).toEqual(makeParticles(40, 11, 100));
    for (const p of ps) {
      expect(p.u).toBeGreaterThan(0);
      expect(p.u).toBeLessThan(1);
      expect(p.w).toBeGreaterThan(0);
      expect(p.w).toBeLessThan(1);
    }
    // Middelkvadratet av farten er omtrent speed²
    expect(Math.sqrt(meanSquareSpeed(makeParticles(4000, 3, 100)))).toBeCloseTo(100, -1);
  });

  it('elastiske støt mot veggene bevarer bevegelsesenergien, og partiklene blir i boksen', () => {
    let ps = makeParticles(40, 5, 120);
    const e0 = meanSquareSpeed(ps);
    let hits = 0;
    for (let i = 0; i < 2000; i++) {
      const r = stepParticles(ps, 0.02, 1, 300, 200);
      ps = r.particles;
      hits += r.pistonHits.length;
    }
    expect(meanSquareSpeed(ps)).toBeCloseTo(e0, 6);
    for (const p of ps) {
      expect(p.u).toBeGreaterThanOrEqual(0);
      expect(p.u).toBeLessThanOrEqual(1);
      expect(p.w).toBeGreaterThanOrEqual(0);
      expect(p.w).toBeLessThanOrEqual(1);
    }
    expect(hits).toBeGreaterThan(0);
  });

  it('høyere temperatur gir flere støt mot stempelet per sekund (omtrent ∝ √T)', () => {
    const count = (scale: number) => {
      let ps = makeParticles(60, 9, 120);
      let hits = 0;
      for (let i = 0; i < 3000; i++) {
        const r = stepParticles(ps, 0.01, scale, 300, 200);
        ps = r.particles;
        hits += r.pistonHits.length;
      }
      return hits;
    };
    const ratio = count(2) / count(1);
    expect(ratio).toBeGreaterThan(1.8);
    expect(ratio).toBeLessThan(2.2);
  });

  it('ved 0 K står partiklene stille', () => {
    const ps = makeParticles(10, 1, 100);
    expect(stepParticles(ps, 0.05, 0, 300, 200).particles.map((p) => [p.u, p.w])).toEqual(ps.map((p) => [p.u, p.w]));
  });
});

describe('spesifikk varmekapasitet', () => {
  it('Q = c·m·ΔT: vannkoker på 2000 W varmer 1,5 kg vann fra 20 °C til 100 °C på 251 s', () => {
    expect(timeToReach(MATERIALS.vann, 1.5, 2000, 20, 100)).toBeCloseTo(250.8, 1);
    expect(heating(MATERIALS.vann, 1.5, 2000, 20, 250.8).T).toBeCloseTo(100, 2);
  });

  it('med samme masse og effekt stiger temperaturen raskest i stoffet med minst c', () => {
    const w = heating(MATERIALS.vann, 1, 500, 20, 60).T - 20;
    const al = heating(MATERIALS.aluminium, 1, 500, 20, 60).T - 20;
    expect(al / w).toBeCloseTo(4180 / 900, 9);
    expect(timeToReach(MATERIALS.kobber, 1, 500, 20, 60)).toBeLessThan(timeToReach(MATERIALS.jern, 1, 500, 20, 60));
  });

  it('energien som er tilført er P·t, og ΔT er proporsjonal med tiden', () => {
    const a = heating(MATERIALS.jern, 2, 300, 20, 100);
    const b = heating(MATERIALS.jern, 2, 300, 20, 200);
    expect(a.Q).toBe(30_000);
    expect(b.T - 20).toBeCloseTo(2 * (a.T - 20), 9);
    expect(a.Q).toBeCloseTo(450 * 2 * (a.T - 20), 6);
  });

  it('temperaturen står stille mens væsken koker', () => {
    const before = heating(MATERIALS.etanol, 1, 1000, 20, 100);
    expect(before.boiling).toBe(false);
    const tBoil = (2440 * 58) / 1000;
    const r = heating(MATERIALS.etanol, 1, 1000, 20, tBoil + 300);
    expect(r.boiling).toBe(true);
    expect(r.T).toBe(78);
    expect(r.evaporated).toBeCloseTo((1000 * 300) / 0.85e6, 9);
    expect(timeToReach(MATERIALS.etanol, 1, 1000, 20, 90)).toBe(Infinity);
    // Vann når akkurat 100 °C
    expect(Number.isFinite(timeToReach(MATERIALS.vann, 1, 1000, 20, 100))).toBe(true);
  });

  it('metallene koker ikke, og null effekt gir ingen oppvarming', () => {
    expect(heating(MATERIALS.bly, 0.1, 2000, 20, 600).boiling).toBe(false);
    expect(timeToReach(MATERIALS.bly, 1, 0, 20, 60)).toBe(Infinity);
  });
});

describe('blanding og termisk likevekt', () => {
  it('0,5 kg vann på 80 °C og 1,0 kg vann på 20 °C gir 40 °C', () => {
    expect(equilibriumTemp({ c1: 4180, m1: 0.5, T1: 80, c2: 4180, m2: 1, T2: 20 })).toBeCloseTo(40, 9);
  });

  it('like mye vann gir gjennomsnittet, ellers ikke', () => {
    expect(equilibriumTemp({ c1: 4180, m1: 1, T1: 90, c2: 4180, m2: 1, T2: 10 })).toBeCloseTo(50, 9);
    expect(equilibriumTemp({ c1: 4180, m1: 2, T1: 90, c2: 4180, m2: 1, T2: 10 })).toBeCloseTo(63.33, 2);
  });

  it('metallbit i vann: 0,50 kg jern på 100 °C i 0,50 kg vann på 20 °C', () => {
    const Ts = equilibriumTemp({ c1: 450, m1: 0.5, T1: 100, c2: 4180, m2: 0.5, T2: 20 });
    expect(Ts).toBeCloseTo(27.8, 1);
    // Avgitt energi = mottatt energi
    expect(450 * 0.5 * (100 - Ts)).toBeCloseTo(4180 * 0.5 * (Ts - 20), 6);
  });

  it('legemet med størst c·m endrer temperaturen minst, også når det er metallet', () => {
    // 1,0 kg aluminium (900 J/K) i bare 0,10 kg vann (418 J/K): her blir vannet mer varmt enn metallet blir kaldt
    const input = { c1: 900, m1: 1, T1: 100, c2: 4180, m2: 0.1, T2: 20 };
    const Ts = equilibriumTemp(input);
    expect(Ts).toBeCloseTo((900 * 100 + 418 * 20) / 1318, 9);
    expect(100 - Ts).toBeLessThan(Ts - 20);
    // Vanlig tilfelle: lite metall i mye vann, da endrer vannet seg minst
    const Ts2 = equilibriumTemp({ c1: 450, m1: 0.5, T1: 100, c2: 4180, m2: 0.5, T2: 20 });
    expect(100 - Ts2).toBeGreaterThan(Ts2 - 20);
  });

  it('energien er bevart hele veien: det det varme avgir, mottar det kalde', () => {
    const input = { c1: 900, m1: 0.3, T1: 95, c2: 4180, m2: 0.4, T2: 12 };
    for (const t of [0, 1, 3, 6, 15, 40]) {
      const s = mixState(input, t);
      expect(900 * 0.3 * (95 - s.T1)).toBeCloseTo(4180 * 0.4 * (s.T2 - 12), 6);
      expect(s.Q).toBeCloseTo(4180 * 0.4 * (s.T2 - 12), 6);
      expect(s.T1).toBeGreaterThanOrEqual(s.Ts - 1e-9);
      expect(s.T2).toBeLessThanOrEqual(s.Ts + 1e-9);
    }
  });

  it('starter i starttemperaturene og nærmer seg sluttemperaturen', () => {
    const input = { c1: 4180, m1: 0.5, T1: 80, c2: 4180, m2: 1, T2: 20 };
    expect(mixState(input, 0)).toMatchObject({ T1: 80, T2: 20, Q: 0 });
    const late = mixState(input, 100);
    expect(late.T1).toBeCloseTo(40, 4);
    expect(late.T2).toBeCloseTo(40, 4);
    expect(late.Q).toBeCloseTo(late.Qtotal, 2);
    expect(late.Qtotal).toBeCloseTo(4180 * 0.5 * 40, 6);
  });
});

describe('termofysikkens første lov', () => {
  it('ΔU = W + Q med W = arbeid på gassen og Q = tilført varme', () => {
    expect(firstLaw(600, 0)).toBe(600);
    expect(firstLaw(0, 600)).toBe(600);
    expect(firstLaw(-400, 600)).toBe(200);
    expect(firstLaw(-600, 600)).toBe(0);
    expect(firstLaw(300, -500)).toBe(-200);
  });

  it('1,0 mol luft trenger 20,8 J per kelvin, så ΔU = 208 J gir 10 K varmere gass', () => {
    expect(AIR_HEAT_CAPACITY).toBeCloseTo(20.775, 3);
    expect(temperatureAfter(293, 207.75)).toBeCloseTo(303, 6);
    expect(temperatureAfter(293, 0)).toBe(293);
    // Største endring i visualiseringen (±2000 J) gir fortsatt positiv temperatur
    expect(temperatureAfter(293, -2000)).toBeGreaterThan(190);
  });
});
