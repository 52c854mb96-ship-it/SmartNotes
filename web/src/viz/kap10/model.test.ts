import { describe, expect, it } from 'vitest';
import {
  APPLIANCES,
  E_CHARGE,
  KWH,
  LAMP,
  MATERIALS,
  blackbodyRgb,
  carrierPosition,
  chargeFrom,
  crossings,
  currentFrom,
  currentFromPower,
  driftSpeed,
  electronsPerSecond,
  energyKWh,
  glowStrength,
  lampCurrent,
  lampResistance,
  lampTemperature,
  makeCarriers,
  monthly,
  ohmCurrent,
  parallelCircuit,
  resistance,
  resistanceFromPower,
  seededRandom,
  seriesCircuit,
} from './model';

describe('elektrisk strøm', () => {
  it('I = Q/t og Q = I·t', () => {
    expect(chargeFrom(2, 5)).toBe(10);
    expect(currentFrom(10, 5)).toBe(2);
    expect(currentFrom(1, 0)).toBeNaN();
  });

  it('1 A er 6,25 · 10¹⁸ elektroner per sekund', () => {
    expect(electronsPerSecond(1)).toBeCloseTo(6.25e18, -15);
    expect(electronsPerSecond(1) * E_CHARGE).toBeCloseTo(1, 12);
  });

  it('driftsfarten i en kobberledning er svært liten (under 0,1 mm/s ved 1 A og 1 mm²)', () => {
    const v = driftSpeed(1, 1);
    expect(v).toBeCloseTo(7.35e-5, 7);
    expect(driftSpeed(1, 2)).toBeCloseTo(v / 2, 12);
    expect(driftSpeed(2, 1)).toBeCloseTo(2 * v, 12);
  });

  it('tellingen ved tverrsnittet gir strømmen: N·q/t ≈ I', () => {
    const L = 600;
    const carriers = makeCarriers(120, L);
    const q = 0.16;
    const I = 1.3;
    const v = (I * L) / (q * carriers.length);
    const t = 40;
    const n = crossings(
      carriers.map((c) => c.u0),
      L / 2,
      L,
      v * t,
    );
    expect((n * q) / t).toBeCloseTo(I, 1);
    // En hel runde betyr at alle har passert nøyaktig én gang
    expect(crossings(carriers.map((c) => c.u0), L / 2, L, L)).toBe(120);
    expect(crossings(carriers.map((c) => c.u0), L / 2, L, 0)).toBeLessThanOrEqual(1);
  });

  it('posisjonen er periodisk og tilfeldige tall er like hver gang', () => {
    expect(carrierPosition(10, 30, 100)).toBe(80);
    expect(carrierPosition(10, 230, 100)).toBe(80);
    const a = seededRandom(5);
    const b = seededRandom(5);
    for (let i = 0; i < 5; i++) expect(a()).toBe(b());
    for (const c of makeCarriers(50, 100)) {
      expect(c.u0).toBeGreaterThanOrEqual(0);
      expect(c.u0).toBeLessThan(100);
      expect(c.v).toBeGreaterThanOrEqual(0);
      expect(c.v).toBeLessThan(1);
    }
  });
});

describe('Ohms lov og resistivitet', () => {
  it('I = U/R', () => {
    expect(ohmCurrent(12, 4)).toBe(3);
    expect(ohmCurrent(6, 8)).toBe(0.75);
    expect(ohmCurrent(1, 0)).toBeNaN();
  });

  it('glødelampa: 12 V gir 2,0 A og 24 W, og R = U/I er større når tråden er varm', () => {
    expect(lampResistance(12)).toBeCloseTo(6, 9);
    expect(lampCurrent(12)).toBeCloseTo(2, 9);
    expect(12 * lampCurrent(12)).toBeCloseTo(LAMP.Pnom, 9);
    expect(lampResistance(0)).toBeCloseTo(LAMP.R0, 12);
    expect(lampCurrent(0)).toBe(0);
  });

  it('lampemodellen oppfyller U = R₀(1 + c·P)·I, og R øker med spenningen', () => {
    let prev = 0;
    for (const U of [0.5, 1, 3, 6, 9, 12]) {
      const I = lampCurrent(U);
      expect(U).toBeCloseTo(LAMP.R0 * (1 + LAMP.c * U * I) * I, 9);
      expect(lampResistance(U)).toBeGreaterThan(prev);
      prev = lampResistance(U);
    }
    // Ikke ohmsk: dobbel spenning gir mindre enn dobbel strøm
    expect(lampCurrent(12)).toBeLessThan(2 * lampCurrent(6));
  });

  it('glødetråden når ca. 2 000 °C ved full spenning og gløder ikke ved lav spenning', () => {
    expect(lampTemperature(12)).toBeCloseTo(2020, 0);
    expect(lampTemperature(0)).toBeCloseTo(20, 9);
    expect(glowStrength(lampTemperature(2))).toBe(0);
    expect(glowStrength(lampTemperature(12))).toBe(1);
  });

  it('R = ρL/A: kobberledning på 10 m og 1,5 mm² har ca. 0,11 Ω', () => {
    const cu = MATERIALS.find((m) => m.id === 'kobber')!;
    expect(resistance(cu.rho, 10, 1.5)).toBeCloseTo(0.1133, 4);
    expect(resistance(cu.rho, 20, 1.5)).toBeCloseTo(2 * resistance(cu.rho, 10, 1.5), 12);
    expect(resistance(cu.rho, 10, 3)).toBeCloseTo(resistance(cu.rho, 10, 1.5) / 2, 12);
  });

  it('kobber leder best, nikrom dårligst', () => {
    const rhos = MATERIALS.map((m) => m.rho);
    expect(Math.min(...rhos)).toBe(MATERIALS.find((m) => m.id === 'kobber')!.rho);
    expect(Math.max(...rhos)).toBe(MATERIALS.find((m) => m.id === 'nikrom')!.rho);
  });
});

describe('koblinger', () => {
  it('serie: R = R₁ + R₂ + R₃, samme strøm, og spenningene summeres til U (Kirchhoffs 2. lov)', () => {
    const c = seriesCircuit([10, 20, 30], 12);
    expect(c.Rtot).toBe(60);
    expect(c.I).toBeCloseTo(0.2, 12);
    expect(c.U[0]).toBeCloseTo(2, 12);
    expect(c.U[2]).toBeCloseTo(6, 12);
    expect(c.U.reduce((s, v) => s + v, 0)).toBeCloseTo(12, 12);
    for (const i of c.Ik) expect(i).toBeCloseTo(c.I, 12);
  });

  it('parallell: 1/R = 1/R₁ + 1/R₂, samme spenning, og strømmene summeres til I (Kirchhoffs 1. lov)', () => {
    const c = parallelCircuit([10, 20, 30], 12);
    expect(c.Rtot).toBeCloseTo(60 / 11, 12);
    expect(c.Ik).toEqual([1.2, 0.6, 0.4]);
    expect(c.Ik.reduce((s, v) => s + v, 0)).toBeCloseTo(c.I, 12);
    for (const u of c.U) expect(u).toBe(12);
  });

  it('to like motstander i parallell gir halv resistans, og R_parallell er mindre enn den minste', () => {
    expect(parallelCircuit([8, 8], 4).Rtot).toBeCloseTo(4, 12);
    const c = parallelCircuit([5, 50, 100], 10);
    expect(c.Rtot).toBeLessThan(5);
    expect(seriesCircuit([5, 50, 100], 10).Rtot).toBeGreaterThan(100);
  });

  it('energibevaring: effekten i motstandene er lik effekten fra batteriet', () => {
    for (const c of [seriesCircuit([3, 7, 12], 9), parallelCircuit([3, 7, 12], 9)]) {
      expect(c.P.reduce((s, p) => s + p, 0)).toBeCloseTo(9 * c.I, 9);
    }
  });

  it('ingen spenning gir ingen strøm', () => {
    expect(seriesCircuit([1, 1], 0).I).toBe(0);
    expect(parallelCircuit([1, 1], 0).Ik).toEqual([0, 0]);
  });
});

describe('effekt og energi', () => {
  it('panelovn på 1 000 W ved 230 V: I = 4,35 A og R = 52,9 Ω, og P = R·I²', () => {
    const I = currentFromPower(1000);
    const R = resistanceFromPower(1000);
    expect(I).toBeCloseTo(4.348, 3);
    expect(R).toBeCloseTo(52.9, 9);
    expect(R * I * I).toBeCloseTo(1000, 9);
  });

  it('W = P·t: 1 kW i 10 timer er 10 kWh = 3,6 · 10⁷ J', () => {
    expect(energyKWh(1000, 10)).toBe(10);
    expect(energyKWh(1000, 10) * KWH).toBeCloseTo(3.6e7, 0);
    expect(energyKWh(8, 5)).toBeCloseTo(0.04, 12);
  });

  it('per måned: 30 dager, og kostnaden er energi ganger pris', () => {
    const m = monthly(1000, 10, 1.5);
    expect(m.kWh).toBe(300);
    expect(m.cost).toBe(450);
    expect(monthly(2000, 0, 1.5)).toEqual({ kWh: 0, cost: 0 });
  });

  it('vannkokeren har dobbelt så stor effekt som panelovnen, men bruker mye mindre energi', () => {
    const kettle = APPLIANCES.find((a) => a.id === 'vannkoker')!;
    const heater = APPLIANCES.find((a) => a.id === 'panelovn')!;
    expect(kettle.P).toBe(2 * heater.P);
    expect(energyKWh(kettle.P, kettle.hours)).toBeLessThan(energyKWh(heater.P, heater.hours) / 10);
  });

  it('glødefarge: varmere tråd er mer hvit/blå', () => {
    const [, g1, b1] = blackbodyRgb(1500);
    const [, g2, b2] = blackbodyRgb(3000);
    expect(g2).toBeGreaterThan(g1);
    expect(b2).toBeGreaterThan(b1);
  });
});
