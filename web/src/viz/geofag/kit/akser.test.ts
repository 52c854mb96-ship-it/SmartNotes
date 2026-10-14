import { describe, expect, it } from 'vitest';
import { logEtikett, logTicks, scaleLog, scaleLogInvert, tierpotens } from './akser';

describe('scaleLog', () => {
  it('er lineær i log₁₀', () => {
    const sx = scaleLog([0.001, 1000], [0, 600]);
    expect(sx(0.001)).toBeCloseTo(0, 10);
    expect(sx(1)).toBeCloseTo(300, 10);
    expect(sx(1000)).toBeCloseTo(600, 10);
    expect(sx(0.1)).toBeCloseTo(200, 10);
  });

  it('virker med omvendt domene og omvendt område', () => {
    const sx = scaleLog([1000, 0.001], [0, 600]);
    expect(sx(1000)).toBeCloseTo(0, 10);
    expect(sx(0.001)).toBeCloseTo(600, 10);
    const sy = scaleLog([0.1, 1000], [400, 0]);
    expect(sy(0.1)).toBeCloseTo(400, 10);
    expect(sy(10)).toBeCloseTo(200, 10);
  });

  it('legger 0, negative og ugyldige verdier ved den minste enden, aldri NaN', () => {
    const sx = scaleLog([0.01, 100], [50, 450]);
    expect(sx(0)).toBe(50);
    expect(sx(-5)).toBe(50);
    expect(sx(Number.NaN)).toBe(50);
    expect(sx(Infinity)).toBe(50);
    const omvendt = scaleLog([100, 0.01], [50, 450]);
    expect(omvendt(0)).toBe(450);
  });

  it('gir en konstant skala midt i området for ugyldig domene', () => {
    for (const d of [
      [0, 10],
      [-1, 10],
      [5, 5],
      [1, Number.NaN],
    ] as [number, number][]) {
      const s = scaleLog(d, [0, 100]);
      expect(s(3)).toBe(50);
    }
  });

  it('har en invers som går tilbake', () => {
    const d: [number, number] = [0.001, 1000];
    const r: [number, number] = [40, 760];
    const sx = scaleLog(d, r);
    const inv = scaleLogInvert(d, r);
    for (const v of [0.001, 0.0123, 0.5, 7, 999]) expect(inv(sx(v))).toBeCloseTo(v, 9);
    expect(scaleLogInvert([0, 1], r)(100)).toBe(1);
    expect(Number.isFinite(inv(Number.NaN))).toBe(true);
  });
});

describe('logTicks', () => {
  it('gir hele tierpotenser som hovedverdier og 2–9 som hjelpestreker', () => {
    const t = logTicks(0.001, 1000);
    expect(t.major).toEqual([0.001, 0.01, 0.1, 1, 10, 100, 1000]);
    expect(t.minor).toHaveLength(48);
    expect(t.minor).toContain(0.002);
    expect(t.minor).toContain(0.3);
    expect(t.minor).toContain(900);
    expect(t.minor).not.toContain(2000);
  });

  it('tynner ut lange akser', () => {
    const t = logTicks(1e-3, 1e11);
    expect(t.major.length).toBeLessThanOrEqual(8);
    expect(t.major).toContain(1);
    expect(t.major).toContain(1e10);
    for (let i = 1; i < t.major.length; i++) expect(t.major[i]! / t.major[i - 1]!).toBeCloseTo(100, 6);
    expect(t.minor).toContain(10);
  });

  it('legger til 2 og 5 på korte akser', () => {
    const t = logTicks(5, 0.5);
    expect(t.major).toEqual([0.5, 1, 2, 5]);
    expect(t.minor).toEqual([0.6, 0.7, 0.8, 0.9, 3, 4]);
  });

  it('gir tomme lister for ugyldige områder', () => {
    expect(logTicks(0, 10)).toEqual({ major: [], minor: [] });
    expect(logTicks(1, 1)).toEqual({ major: [], minor: [] });
    expect(logTicks(1, Infinity)).toEqual({ major: [], minor: [] });
    expect(logTicks(-1, 10)).toEqual({ major: [], minor: [] });
  });
});

describe('etiketter på norsk', () => {
  it('skriver tierpotenser med hevet eksponent og ekte minus', () => {
    expect(tierpotens(-3)).toBe('10⁻³');
    expect(tierpotens(11)).toBe('10¹¹');
    expect(tierpotens(Number.NaN)).toBe('–');
  });

  it('skriver vanlige tall fra 0,001 til 10 000 med desimalkomma', () => {
    expect(logEtikett(0.001)).toBe('0,001');
    expect(logEtikett(0.002)).toBe('0,002');
    expect(logEtikett(0.063)).toBe('0,063');
    expect(logEtikett(0.5)).toBe('0,5');
    expect(logEtikett(1)).toBe('1');
    expect(logEtikett(250)).toBe('250');
    expect(logEtikett(1000)).toBe('1000');
    expect(logEtikett(10_000)).toMatch(/^10\s000$/);
  });

  it('skriver svært store og små tall som tierpotenser', () => {
    expect(logEtikett(1e-4)).toBe('10⁻⁴');
    expect(logEtikett(1e5)).toBe('10⁵');
    expect(logEtikett(2e6)).toBe('2 · 10⁶');
    expect(logEtikett(1e11)).toBe('10¹¹');
    expect(logEtikett(1000, { form: 'potens' })).toBe('10³');
    expect(logEtikett(1, { form: 'potens' })).toBe('10⁰');
    expect(logEtikett(1e6, { form: 'desimal' })).toMatch(/^1\s000\s000$/);
  });

  it('gir «–» for 0, negative og ugyldige tall', () => {
    expect(logEtikett(0)).toBe('–');
    expect(logEtikett(-1)).toBe('–');
    expect(logEtikett(Number.NaN)).toBe('–');
    for (const v of [...logTicks(1e-6, 1e8).major, ...logTicks(1e-6, 1e8).minor]) {
      expect(logEtikett(v)).not.toMatch(/NaN|Infinity|undefined|e[+-]/);
    }
  });
});
