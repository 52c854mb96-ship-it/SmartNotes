import { describe, expect, it } from 'vitest';
import { SHIN, SOLE, THIGH } from '../../kit/scene/figurer-skjelett';
import { bulletSize, exitTime, skaterHeight, stanceLegs } from './eksplosjon-form';

describe('høyden til skøyteløperne', () => {
  it('barn er lavere enn voksne, og høyden øker med massen', () => {
    expect(skaterHeight(20)).toBeCloseTo(1.15, 12);
    expect(skaterHeight(40)).toBeCloseTo(1.48, 12);
    expect(skaterHeight(80)).toBeCloseTo(1.81, 12);
    let prev = 0;
    for (let m = 10; m <= 120; m += 2.5) {
      const h = skaterHeight(m);
      expect(h).toBeGreaterThanOrEqual(prev);
      expect(h).toBeGreaterThanOrEqual(1.15);
      expect(h).toBeLessThanOrEqual(1.88);
      prev = h;
    }
    // Mellom tabellverdiene: lineært
    expect(skaterHeight(45)).toBeCloseTo((1.48 + 1.6) / 2, 12);
  });
});

describe('beina i skrittstilling', () => {
  /** Ankelen og sålen regnet ut fra vinklene, på samme måte som skjelettet i scene-kit-et. */
  function ankle(rygg: number, hofte: number, kne: number) {
    const d = Math.PI / 180;
    const phiT = (-rygg + hofte) * d;
    const phiS = phiT - kne * d;
    return { x: Math.sin(phiT) * THIGH + Math.sin(phiS) * SHIN, y: Math.cos(phiT) * THIGH + Math.cos(phiS) * SHIN, phiS: phiS / d };
  }

  it('begge ankelene havner der de skal, med flate såler på samme bakkelinje', () => {
    for (const [rygg, drop, back, front] of [
      [0, 50, -8, 8],
      [14, 48, -14, 10],
      [-5, 46, -20, 16],
    ] as const) {
      const j = stanceLegs(rygg, drop, back, front);
      const b = ankle(rygg, j.venstreHofte, j.venstreKne);
      const f = ankle(rygg, j.hoyreHofte, j.hoyreKne);
      expect(b.x).toBeCloseTo(back, 6);
      expect(f.x).toBeCloseTo(front, 6);
      expect(b.y + SOLE).toBeCloseTo(drop, 6);
      expect(f.y + SOLE).toBeCloseTo(drop, 6);
      // Flat såle: ankelen = leggens vinkel
      expect(j.venstreAnkel).toBeCloseTo(b.phiS, 6);
      expect(j.hoyreAnkel).toBeCloseTo(f.phiS, 6);
      // Knærne bøyes fram (aldri bakover)
      expect(j.venstreKne).toBeGreaterThanOrEqual(0);
      expect(j.hoyreKne).toBeGreaterThanOrEqual(0);
    }
  });

  it('for langt unna: beinet strekkes mot målet i stedet for å gi NaN', () => {
    const j = stanceLegs(0, 80, -30, 30);
    for (const v of Object.values(j)) expect(Number.isFinite(v)).toBe(true);
    expect(j.hoyreKne).toBeLessThan(5);
  });
});

describe('når det første legemet når kanten', () => {
  it('den raskeste i forhold til plassen bestemmer', () => {
    // Fra midten av [0, 10]: 2 m/s mot høyre bruker 2,5 s, 1 m/s mot venstre 5 s
    expect(exitTime([5, 5], [2, -1], 0, 10, 20)).toBeCloseTo(2.5, 12);
    expect(exitTime([5, 5], [0.5, -4], 0, 10, 20)).toBeCloseTo(1.25, 12);
  });

  it('høyst cap, og ingen bevegelse gir cap', () => {
    expect(exitTime([5, 5], [0.01, -0.01], 0, 10, 4)).toBe(4);
    expect(exitTime([5], [0], 0, 10, 4)).toBe(4);
    // Allerede utenfor: 0, ikke negativ
    expect(exitTime([12], [1], 0, 10, 4)).toBe(0);
  });
});

describe('geværkula', () => {
  it('10 g er ca. 30 mm lang, og størrelsen vokser som kubikkroten av massen', () => {
    expect(bulletSize(0.01).length).toBeCloseTo(0.03, 12);
    expect(bulletSize(0.08).length / bulletSize(0.01).length).toBeCloseTo(2, 12);
    expect(bulletSize(0.005).diameter).toBeLessThan(bulletSize(0.03).diameter);
  });
});
