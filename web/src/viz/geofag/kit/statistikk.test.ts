import { describe, expect, it } from 'vitest';
import { lineaerRegresjon, median, middel, normalKumulativ, normalKvantil, standardavvik, standardfeil } from './statistikk';

describe('middel, median og spredning', () => {
  it('regner middelverdi og median', () => {
    expect(middel([2, 4, 9])).toBeCloseTo(5, 12);
    expect(median([9, 2, 4])).toBe(4);
    expect(median([1, 2, 3, 10])).toBe(2.5);
  });

  it('regner utvalgs- og populasjonsstandardavvik', () => {
    const v = [2, 4, 4, 4, 5, 5, 7, 9];
    expect(standardavvik(v, { populasjon: true })).toBeCloseTo(2, 12);
    expect(standardavvik(v)).toBeCloseTo(Math.sqrt(32 / 7), 12);
    expect(standardfeil(v)).toBeCloseTo(Math.sqrt(32 / 7) / Math.sqrt(8), 12);
  });

  it('gir standardavvik 0 når alle målingene er like', () => {
    expect(standardavvik([12.3, 12.3, 12.3])).toBe(0);
  });

  it('gir null i stedet for NaN for tomme, korte eller ugyldige serier', () => {
    expect(middel([])).toBeNull();
    expect(median([])).toBeNull();
    expect(standardavvik([5])).toBeNull();
    expect(standardavvik([5], { populasjon: true })).toBe(0);
    expect(standardfeil([5])).toBeNull();
    expect(middel([1, Number.NaN])).toBeNull();
    expect(middel([1, Infinity])).toBeNull();
  });
});

describe('lineær regresjon', () => {
  it('finner en eksakt linje', () => {
    const r = lineaerRegresjon([0, 1, 2, 3], [1, 3, 5, 7])!;
    expect(r.stigning).toBeCloseTo(2, 12);
    expect(r.konstantledd).toBeCloseTo(1, 12);
    expect(r.r2).toBeCloseTo(1, 12);
    expect(r.n).toBe(4);
  });

  it('gir R² under 1 for punkter med spredning', () => {
    const r = lineaerRegresjon([1, 2, 3, 4, 5], [2.1, 3.9, 6.2, 7.8, 10.1])!;
    expect(r.stigning).toBeCloseTo(1.99, 2);
    expect(r.r2).toBeGreaterThan(0.99);
    expect(r.r2).toBeLessThan(1);
  });

  it('gir null når x-ene er like, listene er ulike lange eller for korte', () => {
    expect(lineaerRegresjon([2, 2, 2], [1, 2, 3])).toBeNull();
    expect(lineaerRegresjon([1, 2], [1])).toBeNull();
    expect(lineaerRegresjon([1], [1])).toBeNull();
    expect(lineaerRegresjon([1, Number.NaN], [1, 2])).toBeNull();
  });

  it('gir R² = 1 og stigning 0 når alle y er like', () => {
    const r = lineaerRegresjon([1, 2, 3], [4, 4, 4])!;
    expect(r.stigning).toBe(0);
    expect(r.r2).toBe(1);
  });
});

describe('normalfordelingen', () => {
  it('har kjente verdier', () => {
    expect(normalKumulativ(0)).toBeCloseTo(0.5, 7);
    expect(normalKumulativ(1.96)).toBeCloseTo(0.975, 4);
    expect(normalKumulativ(-1)).toBeCloseTo(0.158655, 5);
    expect(normalKumulativ(100)).toBe(1);
    expect(normalKumulativ(-100)).toBe(0);
    expect(normalKumulativ(Number.NaN)).toBeNull();
  });

  it('har en invers som går tilbake', () => {
    for (const p of [0.001, 0.05, 0.16, 0.5, 0.84, 0.95, 0.999]) {
      expect(normalKumulativ(normalKvantil(p)!)).toBeCloseTo(p, 6);
    }
    expect(normalKvantil(0.975)).toBeCloseTo(1.959964, 5);
    expect(normalKvantil(0)).toBeNull();
    expect(normalKvantil(1)).toBeNull();
  });
});
