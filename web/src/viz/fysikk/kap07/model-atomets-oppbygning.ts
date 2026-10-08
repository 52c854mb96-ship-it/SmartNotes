/**
 * Målestokk, periodesystem og hverdagseksempler for «Bygg et atom» (7A). Rene funksjoner uten React, så de kan testes.
 * Selve atomet (protoner, nøytroner, elektroner, isotoper og ioner) regnes ut i model.ts.
 */
import { elementName, elementSymbol } from './elements';
import { shellConfig } from './model';

/* ---------- Målestokk: kjernen og atomet ---------- */

/** Radiekonstanten R₀ i R = R₀ · ∛A for atomkjerner (m). */
export const R0_NUCLEUS = 1.2e-15;

/** Størrelsesordenen for diameteren til et atom, som i læreboka (m). */
export const ATOM_DIAMETER = 1e-10;

/** Lengden av fotballbanen i sammenligningen (m). En vanlig bane er 100–110 m lang. */
export const PITCH_LENGTH = 100;

/** Diameteren til en atomkjerne med nukleontall A (m): d = 2 · R₀ · ∛A. Gir 0 for A ≤ 0. */
export function nucleusDiameter(A: number): number {
  if (!(A > 0)) return 0;
  return 2 * R0_NUCLEUS * Math.cbrt(A);
}

/** Hvor mange ganger bredere atomet (ca. 10⁻¹⁰ m) er enn kjernen. */
export function atomToNucleusRatio(A: number): number {
  const d = nucleusDiameter(A);
  return d > 0 ? ATOM_DIAMETER / d : Infinity;
}

/** Hvor stor kjernen ville vært (m) hvis atomet ble forstørret til `atomSize` meter (standard en fotballbane). */
export function scaledNucleus(A: number, atomSize = PITCH_LENGTH): number {
  return (atomSize * nucleusDiameter(A)) / ATOM_DIAMETER;
}

/** Avrunder til `sig` gjeldende siffer: 14 641 → 15 000 (sig = 2). */
export function roundSig(v: number, sig = 2): number {
  if (!Number.isFinite(v) || v === 0) return v;
  const p = 10 ** (Math.floor(Math.log10(Math.abs(v))) - sig + 1);
  return Math.round(v / p) * p;
}

/** Hverdagsting på omtrent samme størrelse som den forstørrede kjernen. */
export interface ScaleObject {
  /** Med ubestemt artikkel, f.eks. «en ert». */
  name: string;
  /** Typisk størrelse (mm), bare til kontroll. */
  typicalMm: number;
}

/** Tingen som ligner mest på en kjerne med diameter `mm` millimeter: knappenålshode, pepperkorn, ert eller blåbær. */
export function scaleObject(mm: number): ScaleObject {
  if (mm < 3) return { name: 'et knappenålshode', typicalMm: 2 };
  if (mm < 5) return { name: 'et pepperkorn', typicalMm: 4 };
  if (mm < 7.5) return { name: 'en ert', typicalMm: 7 };
  return { name: 'et blåbær', typicalMm: 9 };
}

/* ---------- Utsnitt av periodesystemet ---------- */

export interface TableCell {
  Z: number;
  symbol: string;
  /** Norsk navn med stor forbokstav. */
  name: string;
  /** Periode = rad (1–4). */
  period: number;
  /** Kolonne i utsnittet (0–7): gruppe 1, 2 og 13–18. */
  col: number;
  /** Gruppenummeret i periodesystemet (1, 2, 13–18). */
  group: number;
  /** Kan velges i visualiseringen (Z = 1–20). Ga–Kr vises bare for å fullføre periode 4. */
  selectable: boolean;
}

/** Gruppenummeret for kolonne 0–7 i utsnittet: 1, 2, 13, 14 … 18. */
export function groupOfColumn(col: number): number {
  return col < 2 ? col + 1 : col + 11;
}

/** Periode og kolonne for hovedgruppegrunnstoffene Z = 1–20 og 31–36 (Ga–Kr), ellers null. */
export function tablePosition(Z: number): { period: number; col: number } | null {
  if (!Number.isInteger(Z)) return null;
  if (Z === 1) return { period: 1, col: 0 };
  if (Z === 2) return { period: 1, col: 7 };
  if (Z >= 3 && Z <= 10) return { period: 2, col: Z - 3 };
  if (Z >= 11 && Z <= 18) return { period: 3, col: Z - 11 };
  if (Z === 19 || Z === 20) return { period: 4, col: Z - 19 };
  if (Z >= 31 && Z <= 36) return { period: 4, col: Z - 29 };
  return null;
}

const cap = (s: string) => s.charAt(0).toLocaleUpperCase('nb') + s.slice(1);

/** Cellene i utsnittet: Z = 1–20 (kan velges) og Ga–Kr (Z = 31–36) som fullfører periode 4. */
export const TABLE_CELLS: TableCell[] = [...Array.from({ length: 20 }, (_, i) => i + 1), 31, 32, 33, 34, 35, 36].map((Z) => {
  const pos = tablePosition(Z)!;
  return {
    Z,
    symbol: elementSymbol(Z),
    name: cap(elementName(Z)),
    period: pos.period,
    col: pos.col,
    group: groupOfColumn(pos.col),
    selectable: Z <= 20,
  };
});

/** Antall elektroner i ytterste skall i det nøytrale atomet (skallmodellen 2, 8, 8, 2). */
export function outerElectrons(Z: number): number {
  const shells = shellConfig(Z);
  return shells[shells.length - 1] ?? 0;
}

/* ---------- Hverdagen ---------- */

/** Hvor eleven møter grunnstoffet i hverdagen (Z = 1–20). Én setning, bokmål. */
export const EVERYDAY: Record<number, string> = {
  1: 'Hydrogen finner du i vann: to av de tre atomene i hvert vannmolekyl (H₂O) er hydrogen.',
  2: 'Helium fyller ballongene i 17. mai-toget, fordi gassen er mye lettere enn luft.',
  3: 'Litium sitter i batteriet i mobilen din (litium-ion-batteri).',
  4: 'Beryllium er et lett og stivt metall som brukes i fly, satellitter og speilene i romteleskoper.',
  5: 'Bor finner du i ildfast glass (borsilikatglass), som tåler at du heller kokende vann i det.',
  6: 'Karbon er grafitten i blyanten, og alt levende er bygd opp rundt karbonatomer.',
  7: 'Nitrogen er 78 % av lufta du puster inn.',
  8: 'Oksygen er 21 % av lufta, og det er O-en i H₂O.',
  9: 'Fluor finner du i tannkremen, som fluorid (F⁻) som gjør emaljen sterkere.',
  10: 'Neon lyser rødoransje i gammeldagse reklameskilt (neonrør).',
  11: 'Natrium finner du i bordsalt (NaCl), der det er positive natriumioner.',
  12: 'Magnesium sitter midt i klorofyllet i grønne blader, og brukes i lette sykkel- og bildeler.',
  13: 'Aluminium er brusboksen og aluminiumsfolien på kjøkkenet.',
  14: 'Silisium finner du i sand (kvarts), og i solcellepaneler og databrikker.',
  15: 'Fosfor er i strykeflaten på fyrstikkesken, og i DNA-et ditt.',
  16: 'Svovel er det som lukter i råtne egg (hydrogensulfid), og det finnes i proteinene i håret.',
  17: 'Klor finner du i bordsalt (NaCl), der det er negative kloridioner, og i vannet i svømmehallen.',
  18: 'Argon er nesten 1 % av lufta, og fyller rommet mellom glassene i mange vinduer.',
  19: 'Kalium finner du i bananer, som positive kaliumioner.',
  20: 'Kalsium er i melk, i skjelettet og tennene dine, og i kritt (kalsiumkarbonat).',
};
