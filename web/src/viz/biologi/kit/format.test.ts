import { describe, expect, it } from 'vitest';
import { fmtCount, fmtPct } from './format';

describe('tallformat for biologi', () => {
  it('prosent med hardt mellomrom og desimalkomma', () => {
    expect(fmtPct(0.456)).toBe('46 %');
    expect(fmtPct(0.4567, 1)).toBe('45,7 %');
    expect(fmtPct(0)).toBe('0 %');
    expect(fmtPct(1)).toBe('100 %');
    expect(fmtPct(0.001)).toBe('< 1 %');
    expect(fmtPct(0.0002, 1)).toBe('< 0,1 %');
    expect(fmtPct(Number.NaN)).toBe('–');
  });

  it('store antall', () => {
    expect(fmtCount(2097152)).toBe('2 097 152');
    expect(fmtCount(3.4e12)).toBe('3,40 · 10¹²');
    expect(fmtCount(Infinity)).toBe('–');
  });
});
