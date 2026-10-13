import { describe, expect, it } from 'vitest';
import { OWNER_ID, accountChange, planLabel } from './account';

describe('kontoen på enheten', () => {
  it('beholder dataene for samme konto', () => {
    expect(accountChange({ id: 7 }, 7, true)).toBe('keep');
    expect(accountChange({ id: OWNER_ID }, OWNER_ID, true)).toBe('keep');
  });

  it('bytter dataene når en annen konto logger inn', () => {
    expect(accountChange({ id: 7 }, 8, true)).toBe('replace');
    expect(accountChange({ id: OWNER_ID }, 7, true)).toBe('replace');
    expect(accountChange({ id: 7 }, OWNER_ID, false)).toBe('replace');
  });

  it('lar eierens enheter fra før kontoene beholde alt, også køen', () => {
    expect(accountChange(null, OWNER_ID, true)).toBe('keep');
    expect(accountChange(undefined, OWNER_ID, true)).toBe('keep');
  });

  it('sletter data uten kjent konto når det ikke er eieren som logger inn', () => {
    expect(accountChange(null, 7, true)).toBe('replace');
    expect(accountChange(null, 7, false)).toBe('keep');
  });

  it('viser planen på norsk', () => {
    expect(planLabel('owner')).toBe('Eier');
    expect(planLabel('free')).toBe('Gratis');
    expect(planLabel('pro')).toBe('Pro');
  });
});
