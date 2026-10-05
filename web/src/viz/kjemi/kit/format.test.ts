import { describe, expect, it } from 'vitest';
import { fmtSig } from './format';
import { formula, formulaText } from './formel';

describe('gjeldende siffer', () => {
  it('runder til sig siffer og bruker standardform for store og små tall', () => {
    expect(fmtSig(0.555)).toBe('0,555');
    expect(fmtSig(100)).toBe('100');
    expect(fmtSig(18.016)).toBe('18,0');
    expect(fmtSig(18.016, 4)).toBe('18,02');
    expect(fmtSig(99.99)).toBe('100');
    expect(fmtSig(0.0009999)).toBe('0,00100');
    expect(fmtSig(3.343e24)).toBe('3,34 · 10²⁴');
    expect(fmtSig(0.0001661)).toBe('1,66 · 10⁻⁴');
    expect(fmtSig(-2.5)).toBe('−2,50');
    expect(fmtSig(0)).toBe('0');
    expect(fmtSig(Number.NaN)).toBe('–');
  });
});

describe('«NaN» i formeltekst', () => {
  it('NaNO₃ inneholder aldri teksten «NaN»', () => {
    const t = formulaText('NaNO3');
    expect(t).not.toMatch(/NaN/);
    expect(t.replace(/⁠/g, '')).toBe('NaNO₃');
    expect(formulaText('NaCl')).toBe('NaCl');
    expect(formula('NaNO3').atoms).toEqual({ Na: 1, N: 1, O: 3 });
  });
});
