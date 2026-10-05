import { describe, expect, it } from 'vitest';
import { bolgelengdeFarge, stjerneFarge } from './rom';

const rgb = (s: string) => s.match(/\d+/g)!.map(Number) as [number, number, number];

describe('rom: farger for lys', () => {
  it('ultrafiolett blir fiolett (blått over rødt), ikke magenta', () => {
    for (const nm of [250, 300, 379]) {
      const [r, g, b] = rgb(bolgelengdeFarge(nm, false));
      expect(g).toBe(0);
      expect(b).toBeGreaterThan(r * 1.25);
    }
  });

  it('infrarødt er tydelig mørkere enn synlig rødt, også med full styrke', () => {
    const [r656] = rgb(bolgelengdeFarge(656, false));
    const [r900, g900, b900] = rgb(bolgelengdeFarge(900, false));
    expect(r656).toBe(255);
    expect(r900).toBeLessThan(170);
    expect(g900 + b900).toBe(0);
  });

  it('synlige farger ligger der de skal', () => {
    const [r1, g1, b1] = rgb(bolgelengdeFarge(486));
    expect(g1).toBeGreaterThan(r1);
    expect(b1).toBeGreaterThan(r1);
    const [r2, g2] = rgb(bolgelengdeFarge(580));
    expect(r2).toBeGreaterThan(200);
    expect(g2).toBeGreaterThan(200);
    expect(bolgelengdeFarge(Number.NaN)).toBe(bolgelengdeFarge(550));
  });

  it('kalde stjerner er røde og varme blå', () => {
    const [r3, , b3] = rgb(stjerneFarge(3000));
    const [r25, , b25] = rgb(stjerneFarge(25000));
    expect(r3).toBeGreaterThan(b3);
    expect(b25).toBeGreaterThan(r25);
  });
});
