/**
 * Geometrien i scenen til «Spesifikk varmekapasitet» (ren, uten React, testes i varmekapasitet-scene.test.ts).
 *
 * To like kokeplater står på en labbenk. På hver plate står enten en kasserolle med væske (vann eller etanol)
 * eller en sylinder av metall med et hull til termometeret. Alt tegnes med én fast skala (px/m), så samme masse
 * gir ulikt volum: 1 kg vann er 1 L, mens 1 kg bly er en kloss på knapt 5 cm.
 */
import type { Material, MaterialId } from './model';

/** Tetthet ved romtemperatur (kg/m³), bare for å tegne stoffet i riktig størrelse. */
export const DENSITY: Record<MaterialId, number> = {
  vann: 1000,
  etanol: 789,
  aluminium: 2700,
  jern: 7870,
  kobber: 8960,
  bly: 11340,
};

/** Kjemisk symbol som er stemplet på metallklossene (som på klossene i fysikklaben). */
export const SYMBOL: Partial<Record<MaterialId, string>> = {
  aluminium: 'Al',
  jern: 'Fe',
  kobber: 'Cu',
  bly: 'Pb',
};

/** Ekte mål i meter: kokeplata (hele kassen), kasserollen (ytre diameter) og termometeret. */
export const SIZES = {
  plate: 0.3,
  pot: 0.21,
  thermometer: 0.2,
} as const;

/**
 * Kasserollen i scene-kit-et har innvendig radius 0,485 · b og vannstand fra bunnen opp til 0,45 · b ved
 * `vann = 1` (b = bredden). Volumet ved full stand (m³).
 */
export function potCapacity(width: number): number {
  if (!(width > 0)) return 0;
  const r = 0.485 * width;
  return Math.PI * r * r * 0.45 * width;
}

/** Volumet (m³) av massen m (kg) av stoffet. */
export function volume(id: MaterialId, m: number): number {
  if (!(m > 0)) return 0;
  return m / DENSITY[id];
}

/** Vannstanden (0–1, som `vann` på Kasserolle) når væskevolumet V (m³) står i en kasserolle med bredden `width` (m). */
export function potFill(V: number, width: number = SIZES.pot): number {
  const cap = potCapacity(width);
  if (!(cap > 0) || !(V > 0)) return 0;
  return Math.min(1, V / cap);
}

/** Metallklossen er en sylinder med høyde lik diameteren: V = π d³ / 4. Diameteren (m) for massen m. */
export function blockDiameter(id: MaterialId, m: number): number {
  const V = volume(id, m);
  return V > 0 ? Math.cbrt((4 * V) / Math.PI) : 0;
}

/**
 * Hvor mye damp vi ser (0–1, som `damp` på Kasserolle): litt fra 25 K under kokepunktet, og full damp med bobler
 * først når væsken koker. Metallene damper ikke.
 */
export function steamAmount(mat: Material, T: number, boiling: boolean): number {
  if (mat.boil === undefined) return 0;
  if (boiling) return 1;
  const below = mat.boil - T;
  if (!(below < 25)) return 0;
  return Math.min(0.28, Math.max(0, (25 - below) / 25) * 0.28);
}
