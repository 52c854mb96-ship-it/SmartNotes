import { describe, expect, it } from 'vitest';
import { classicKeys, clozeKeys, keyName, masteryKeys, quickKeys } from './keys';

describe('tastekart', () => {
  it('bokstaver gjelder med og uten Shift, andre taster står som de er', () => {
    expect(keyName('Z')).toBe('z');
    expect(keyName('d')).toBe('d');
    expect(keyName(' ')).toBe(' ');
    expect(keyName('Enter')).toBe('Enter');
    expect(keyName('ArrowLeft')).toBe('ArrowLeft');
  });

  it('Mestring: snu, 1–4, pilene som «Feil» og «Bra», angre og detaljer', () => {
    const calls: string[] = [];
    const keys = masteryKeys({
      flip: () => calls.push('snu'),
      rate: (g) => calls.push(`vurder ${g}`),
      undo: () => calls.push('angre'),
      toggleDetail: () => calls.push('detaljer'),
    });
    for (const key of [' ', 'Enter', '1', '2', '3', '4', 'ArrowLeft', 'ArrowRight', 'Z', 'D']) keys[keyName(key)]?.();
    expect(calls).toEqual(['snu', 'snu', 'vurder 1', 'vurder 2', 'vurder 3', 'vurder 4', 'vurder 1', 'vurder 3', 'angre', 'detaljer']);
    for (const key of ['5', '0', 'm', 'Escape', 'ArrowUp']) expect(keys[keyName(key)]).toBeUndefined();
  });

  it('Rask runde: pilene er «Kunne ikke» og «Kunne», tallene er av', () => {
    const calls: string[] = [];
    const keys = quickKeys({
      flip: () => calls.push('snu'),
      answer: (known) => calls.push(known ? 'kunne' : 'kunne ikke'),
      undo: () => calls.push('angre'),
      toggleDetail: () => calls.push('detaljer'),
    });
    for (const key of [' ', 'Enter', 'ArrowLeft', 'ArrowRight', 'z', 'D']) keys[keyName(key)]?.();
    expect(calls).toEqual(['snu', 'snu', 'kunne ikke', 'kunne', 'angre', 'detaljer']);
    for (const key of ['1', '2', '3', '4', 'm']) expect(keys[keyName(key)]).toBeUndefined();
  });

  it('Klassisk: snu, forrige og neste, merk og detaljer, men ingen vurdering eller angring', () => {
    const calls: string[] = [];
    const keys = classicKeys({
      flip: () => calls.push('snu'),
      next: () => calls.push('neste'),
      prev: () => calls.push('forrige'),
      mark: () => calls.push('merk'),
      toggleDetail: () => calls.push('detaljer'),
    });
    for (const key of [' ', 'Enter', 'ArrowRight', 'ArrowLeft', 'M', 'd']) keys[keyName(key)]?.();
    expect(calls).toEqual(['snu', 'snu', 'neste', 'forrige', 'merk', 'detaljer']);
    for (const key of ['1', '3', 'z']) expect(keys[keyName(key)]).toBeUndefined();
  });

  it('Luketekst: feltet før sjekken, neste kort etter', () => {
    const calls: string[] = [];
    const h = {
      focusField: () => calls.push('felt'),
      next: () => calls.push('neste'),
      undo: () => calls.push('angre'),
      toggleDetail: () => calls.push('detaljer'),
    };
    const before = clozeKeys({ ...h, checked: false });
    for (const key of [' ', 'Enter', 'z']) before[keyName(key)]?.();
    for (const key of ['ArrowRight', 'ArrowLeft', 'd', '1']) expect(before[keyName(key)]).toBeUndefined();
    const after = clozeKeys({ ...h, checked: true });
    for (const key of [' ', 'Enter', 'ArrowRight', 'Z', 'd']) after[keyName(key)]?.();
    expect(calls).toEqual(['felt', 'felt', 'angre', 'neste', 'neste', 'neste', 'angre', 'detaljer']);
    expect(after[keyName('ArrowLeft')]).toBeUndefined();
  });
});
