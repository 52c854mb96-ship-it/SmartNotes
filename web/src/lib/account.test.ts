import { afterEach, describe, expect, it, vi } from 'vitest';
import { OWNER_ID, accountChange, logoutPending, markLogoutPending, planLabel, reloadForOtherAccount } from './account';

/** En enkel lagring i minnet i stedet for nettleserens sessionStorage/localStorage. */
function memoryStorage(): Storage {
  const data = new Map<string, string>();
  return {
    get length() {
      return data.size;
    },
    clear: () => data.clear(),
    getItem: (k) => data.get(k) ?? null,
    key: (i) => [...data.keys()][i] ?? null,
    removeItem: (k) => void data.delete(k),
    setItem: (k, v) => void data.set(k, String(v)),
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

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

describe('en annen fane har byttet konto (409)', () => {
  it('laster siden på nytt én gang, men ikke igjen innen et halvt minutt (ingen løkke)', () => {
    vi.useFakeTimers({ now: Date.parse('2026-10-14T00:00:00Z') });
    const reload = vi.fn();
    vi.stubGlobal('sessionStorage', memoryStorage());
    vi.stubGlobal('window', { location: { reload } });
    expect(reloadForOtherAccount()).toBe(true);
    expect(reload).toHaveBeenCalledTimes(1);
    vi.setSystemTime(Date.parse('2026-10-14T00:00:20Z'));
    expect(reloadForOtherAccount()).toBe(false);
    expect(reload).toHaveBeenCalledTimes(1);
    vi.setSystemTime(Date.parse('2026-10-14T00:01:00Z'));
    expect(reloadForOtherAccount()).toBe(true);
    expect(reload).toHaveBeenCalledTimes(2);
  });

  it('laster ikke på nytt når fanen ikke kan huske det (da må brukeren logge inn)', () => {
    const reload = vi.fn();
    vi.stubGlobal('sessionStorage', {
      getItem: () => {
        throw new Error('blokkert');
      },
    });
    vi.stubGlobal('window', { location: { reload } });
    expect(reloadForOtherAccount()).toBe(false);
    expect(reload).not.toHaveBeenCalled();
  });
});

describe('utlogging uten nett', () => {
  it('huskes til neste oppstart, også når de lokale dataene er slettet', () => {
    vi.stubGlobal('localStorage', memoryStorage());
    expect(logoutPending()).toBe(false);
    markLogoutPending(true);
    expect(logoutPending()).toBe(true);
    markLogoutPending(false);
    expect(logoutPending()).toBe(false);
  });
});
