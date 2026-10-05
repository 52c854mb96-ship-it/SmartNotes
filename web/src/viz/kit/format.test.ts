import { describe, expect, it } from 'vitest';
import { fmt, fmtSci } from './format';

describe('tallformat', () => {
  it('desimalkomma og ekte minus', () => {
    expect(fmt(1.5, 2)).toBe('1,50');
    expect(fmt(-2, 1)).toMatch(/^[−-]2,0$/);
  });

  it('fmtSci bruker tierpotens utenfor 0,01–99 999', () => {
    expect(fmtSci(6.63e-34)).toBe('6,63 · 10⁻³⁴');
    expect(fmtSci(1234.5, 1)).toBe(fmt(1234.5, 1));
    expect(fmtSci(0)).toBe('0');
    expect(fmtSci(Number.NaN)).toBe('–');
  });

  it('fmtSci flytter avrundingen over i eksponenten', () => {
    expect(fmtSci(9.996e5)).toBe('1,00 · 10⁶');
    expect(fmtSci(-9.9999e-7, 1)).toMatch(/^[−-]1,0 · 10⁻⁶$/);
    expect(fmtSci(9.994e5)).toBe('9,99 · 10⁵');
  });
});
