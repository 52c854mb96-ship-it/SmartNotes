import { describe, expect, it } from 'vitest';
import { MATERIALS, heating, type MaterialId } from './model';
import { DENSITY, SIZES, SYMBOL, blockDiameter, potCapacity, potFill, steamAmount, volume } from './varmekapasitet-scene';

const IDS = Object.keys(MATERIALS) as MaterialId[];
const LIQUIDS = IDS.filter((id) => MATERIALS[id].boil !== undefined);
const METALS = IDS.filter((id) => MATERIALS[id].boil === undefined);

describe('scenen i spesifikk varmekapasitet', () => {
  it('har tetthet for alle stoffene og symbol for alle metallene', () => {
    for (const id of IDS) expect(DENSITY[id]).toBeGreaterThan(500);
    for (const id of METALS) expect(SYMBOL[id]).toMatch(/^[A-Z][a-z]$/);
    expect(LIQUIDS).toEqual(['vann', 'etanol']);
  });

  it('1 kg vann er 1 liter, og etanol tar større plass enn vann', () => {
    expect(volume('vann', 1)).toBeCloseTo(1e-3, 9);
    expect(volume('etanol', 1)).toBeGreaterThan(volume('vann', 1));
    expect(volume('vann', 0)).toBe(0);
    expect(volume('vann', -1)).toBe(0);
  });

  it('kasserollen (21 cm) tar ca. 3 L, så 2 kg etanol får plass med god margin', () => {
    expect(potCapacity(SIZES.pot) * 1000).toBeCloseTo(3.08, 2);
    for (const id of LIQUIDS) {
      const v = potFill(volume(id, 2));
      expect(v).toBeGreaterThan(0.5);
      expect(v).toBeLessThan(0.9);
      // Den minste massen gir en tynn, men synlig hinne
      expect(potFill(volume(id, 0.1))).toBeGreaterThan(0.02);
    }
    expect(potFill(0)).toBe(0);
    expect(potFill(1)).toBe(1);
  });

  it('metallklossen er en sylinder med riktig volum, og tyngre metaller gir mindre kloss', () => {
    for (const id of METALS) {
      for (const m of [0.1, 1, 2]) {
        const d = blockDiameter(id, m);
        expect((Math.PI * d ** 3) / 4).toBeCloseTo(volume(id, m), 12);
      }
    }
    // 1 kg aluminium er en kloss på 7,8 cm, 1 kg bly bare 4,8 cm
    expect(blockDiameter('aluminium', 1) * 100).toBeCloseTo(7.78, 2);
    expect(blockDiameter('bly', 1) * 100).toBeCloseTo(4.82, 2);
    const order = (['aluminium', 'jern', 'kobber', 'bly'] as const).map((id) => blockDiameter(id, 1));
    for (let i = 1; i < order.length; i++) expect(order[i]!).toBeLessThan(order[i - 1]!);
    // Alle får plass på kokeplata (støpejernsplata er 0,62 · 30 cm)
    for (const id of METALS) expect(blockDiameter(id, 2)).toBeLessThan(0.62 * SIZES.plate);
    expect(blockDiameter('jern', 0)).toBe(0);
  });

  it('damp: ingen for metallene, litt før kokepunktet og full når væsken koker', () => {
    expect(steamAmount(MATERIALS.jern, 100, false)).toBe(0);
    expect(steamAmount(MATERIALS.vann, 20, false)).toBe(0);
    expect(steamAmount(MATERIALS.vann, 75, false)).toBe(0);
    expect(steamAmount(MATERIALS.vann, 90, false)).toBeGreaterThan(0);
    expect(steamAmount(MATERIALS.vann, 99.9, false)).toBeLessThanOrEqual(0.3);
    expect(steamAmount(MATERIALS.vann, 100, true)).toBe(1);
    // Etanol koker ved 78 °C: heating sier når
    const st = heating(MATERIALS.etanol, 1, 1000, 20, 400);
    expect(st.boiling).toBe(true);
    expect(steamAmount(MATERIALS.etanol, st.T, st.boiling)).toBe(1);
    expect(steamAmount(MATERIALS.vann, NaN, false)).toBe(0);
  });
});
