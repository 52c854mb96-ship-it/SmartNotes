import { describe, expect, it } from 'vitest';
import { doorLayout } from './vannkoker-layout';

const check = (W: number, doorW: number, centers: number[]) => {
  const doors = doorLayout(W, doorW, centers);
  // Dørene dekker hele benken uten hull eller overlapp
  expect(doors[0]![0]).toBe(0);
  expect(doors[doors.length - 1]![1]).toBe(W);
  for (let i = 1; i < doors.length; i++) expect(doors[i]![0]).toBeCloseTo(doors[i - 1]![1], 9);
  // Ingen smale striper, og hvert apparat står foran én dør med god plass til navnet
  for (const [a, b] of doors) expect(b - a).toBeGreaterThan(0.36 * doorW - 1e-9);
  for (const c of centers) {
    const d = doors.find(([a, b]) => a <= c && c <= b)!;
    expect(Math.min(c - d[0], d[1] - c)).toBeGreaterThanOrEqual(doorW / 2 - 1e-9);
  }
  return doors;
};

describe('skapdørene', () => {
  it('bred figur: én dør sentrert under hvert apparat', () => {
    const doors = check(800, 200, [235, 585]);
    expect(doors).toContainEqual([135, 335]);
    expect(doors).toContainEqual([485, 685]);
  });

  it('smal figur og bare vannkokeren', () => {
    check(560, 186, [140, 390]);
    check(560, 186, [300]);
    check(800, 200, [420]);
  });
});
