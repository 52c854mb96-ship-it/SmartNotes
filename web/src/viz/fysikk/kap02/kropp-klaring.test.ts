import { describe, expect, it } from 'vitest';
import { POSER, personPunkter } from '../../kit/scene/figurer-skjelett';
import { kroppsdeler, ledigX, ledigY, type KroppsDel } from './kropp-klaring';

/** En loddrett «kropp» langs x = 0 fra y = −100 til 100 med radius 10. */
const loddrett: KroppsDel[] = [{ a: { x: 0, y: -100 }, b: { x: 0, y: 100 }, r: 10 }];
/** En vannrett «kropp» langs y = 0 fra x = −100 til 100 med radius 10. */
const vannrett: KroppsDel[] = [{ a: { x: -100, y: 0 }, b: { x: 100, y: 0 }, r: 10 }];

describe('ledigX', () => {
  it('flytter en loddrett strek forbi en loddrett kropp, til den siden vi ber om', () => {
    expect(ledigX(loddrett, { start: 0, fra: 0, til: 80, gap: 5, dir: 1 })).toBeCloseTo(15, 6);
    expect(ledigX(loddrett, { start: 0, fra: 0, til: 80, gap: 5, dir: -1 })).toBeCloseTo(-15, 6);
  });

  it('lar streken stå der den er når den er langt nok unna', () => {
    expect(ledigX(loddrett, { start: 30, fra: 0, til: 80, gap: 5, dir: -1 })).toBe(30);
    // Streken går under kroppen (y > 100 + r + gap)
    expect(ledigX(loddrett, { start: 0, fra: 120, til: 200, gap: 5 })).toBe(0);
  });

  it('lar pila gå gjennom kroppen like ved angrepspunktet (fri), men ikke langs hele kroppen', () => {
    // Vannrett kropp og pil rett ned fra midten: bare tykkelsen krysses, så pila står i midten.
    expect(ledigX(vannrett, { start: 0, fra: 0, til: 80, gap: 5, fri: [-20, 20] })).toBe(0);
    // Loddrett kropp: delene utenfor fri-båndet er fortsatt i veien.
    expect(ledigX(loddrett, { start: 0, fra: 0, til: 80, gap: 5, fri: [-20, 20] })).toBeCloseTo(15, 6);
  });

  it('fri gjelder bare like ved angrepspunktet, også for deler som ligger like utenfor', () => {
    // En vannrett kropp som ligger litt over angrepspunktet (innenfor fri), og et hode langt over (utenfor).
    const deler: KroppsDel[] = [...vannrett, { a: { x: 4, y: -60 }, b: { x: 4, y: -60 }, r: 8 }];
    expect(ledigX(deler, { start: 0, fra: -80, til: 80, gap: 4, fri: [-20, 20] })).toBeCloseTo(16, 6);
    expect(ledigX(deler, { start: 0, fra: -40, til: 80, gap: 4, fri: [-20, 20] })).toBe(0);
  });

  it('hopper forbi flere deler etter hverandre', () => {
    const to: KroppsDel[] = [...loddrett, { a: { x: 16, y: -50 }, b: { x: 16, y: 50 }, r: 4 }];
    // Først forbi den første delen (x = 12), som er inne i den andre (10–22), så forbi den.
    expect(ledigX(to, { start: 0, fra: -10, til: 10, gap: 2, dir: 1 })).toBeCloseTo(22, 6);
  });

  it('tåler ugyldige tall', () => {
    const rar: KroppsDel[] = [{ a: { x: NaN, y: 0 }, b: { x: 0, y: 1 }, r: 5 }];
    expect(ledigX(rar, { start: 3, fra: 0, til: 10, gap: 1 })).toBe(3);
  });
});

describe('ledigY', () => {
  it('flytter en vannrett strek under en vannrett kropp', () => {
    expect(ledigY(vannrett, { start: 0, fra: -20, til: 20, gap: 5, dir: 1 })).toBeCloseTo(15, 6);
    expect(ledigY(vannrett, { start: 0, fra: -20, til: 20, gap: 5, dir: -1 })).toBeCloseTo(-15, 6);
  });
});

describe('kroppsdeler', () => {
  it('en person med hodet rett ned dekker en loddrett strek gjennom tyngdepunktet, en med magen ned gjør det ikke', () => {
    const size = 150;
    const hodeNed = personPunkter('falle', size, POSER.falle, { x: 0, y: 0, anker: 'tyngdepunkt', rotate: 180 });
    const magenNed = personPunkter('falle', size, POSER.falle, { x: 0, y: 0, anker: 'tyngdepunkt', rotate: 90 });
    const fri: [number, number] = [-0.2 * size, 0.2 * size];
    const xNed = ledigX(kroppsdeler(hodeNed, size), { start: 0, fra: 0, til: 90, gap: 6, fri });
    const xMage = ledigX(kroppsdeler(magenNed, size), { start: 0, fra: 0, til: 90, gap: 6, fri });
    expect(xNed).toBeGreaterThan(0.08 * size);
    expect(xMage).toBe(0);
  });
});
