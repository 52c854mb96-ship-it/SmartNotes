import { describe, expect, it } from 'vitest';
import { SHIN, SOLE, THIGH } from '../../kit/scene/figurer-skjelett';
import { arrowZoom, barrelCut, bulletSize, exitTime, skaterHeight, stanceLegs } from './eksplosjon-form';

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

describe('lupen inni løpet', () => {
  const base = { x0: 20, x1: 780, M: 3000, back: 0.04, uA: 0.078, gap: 28 };

  it('er sammenhengende så lenge alt fram til kulespissen får plass', () => {
    const c = barrelCut({ ...base, uEnd: 0.1 });
    expect(c.broken).toBe(false);
    expect(c.offA).toBeCloseTo(20 + 0.04 * 3000, 9);
    expect(c.hidden).toBe(0);
    // Sluttstykket (u = 0) og spissen står der skalaen sier
    expect(c.offA + 0.1 * 3000).toBeLessThanOrEqual(780);
  });

  it('brytes når kula er langt fram: spissen står ved høyre kant, og det skjulte stykket stemmer', () => {
    const uEnd = 0.3;
    const c = barrelCut({ ...base, uEnd });
    expect(c.broken).toBe(true);
    expect(c.xA1).toBeCloseTo(c.offA + 0.078 * 3000, 9);
    expect(c.xB0).toBeCloseTo(c.xA1 + 28, 9);
    expect(c.offB + uEnd * 3000).toBeCloseTo(780, 9);
    // Det som vises i A og B, pluss det skjulte, er hele stykket fram til uEnd
    const shownB = (780 - c.xB0) / 3000;
    expect(0.078 + c.hidden + shownB).toBeCloseTo(uEnd, 9);
    expect(c.hidden).toBeGreaterThan(0);
  });

  it('henger sammen i overgangen (samme plassering like før og like etter bruddet)', () => {
    const uSwitch = (780 - (20 + 0.04 * 3000)) / 3000;
    const before = barrelCut({ ...base, uEnd: uSwitch });
    const after = barrelCut({ ...base, uEnd: uSwitch + 1e-9 });
    expect(before.broken).toBe(false);
    expect(after.broken).toBe(true);
    expect(after.offB).toBeCloseTo(before.offA, 4);
    expect(after.hidden).toBeCloseTo(28 / 3000, 6);
  });
});

describe('forstørret rekylpil', () => {
  it('velger 1, 2 eller 5 ganger en tierpotens, så pila blir mellom 40 % og 100 % av maks', () => {
    expect(arrowZoom(0.37, 110)).toBe(200);
    expect(arrowZoom(0.094, 110)).toBe(1000);
    expect(arrowZoom(2.25, 110)).toBe(20);
    for (const len of [0.013, 0.05, 0.37, 1, 2.25, 7, 30]) {
      const k = arrowZoom(len, 110);
      expect(len * k).toBeLessThanOrEqual(110);
      expect(len * k).toBeGreaterThanOrEqual(110 / 2.5 - 1e-9);
    }
  });

  it('forstørrer ikke en pil som er lang nok, og tåler null og negative lengder', () => {
    expect(arrowZoom(80, 110)).toBe(1);
    expect(arrowZoom(0, 110)).toBe(1);
    expect(arrowZoom(-0.37, 110)).toBe(200);
    expect(arrowZoom(Number.NaN, 110)).toBe(1);
  });
});
