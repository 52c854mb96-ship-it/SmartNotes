/**
 * Grunnstoffene med kjemisk symbol og norsk navn (bokmål), indeksert etter protontallet Z.
 * Brukes både i kapittel 7 (atomets oppbygning) og kapittel 8 (kjernereaksjoner).
 */
import { superscript } from '../kit/format';

/** Indeks = protontall Z. Z = 0 er et fritt nøytron, som skrives ¹₀n. */
const SYMBOLS = [
  'n H He Li Be B C N O F Ne Na Mg Al Si P S Cl Ar K',
  'Ca Sc Ti V Cr Mn Fe Co Ni Cu Zn Ga Ge As Se Br Kr Rb Sr Y',
  'Zr Nb Mo Tc Ru Rh Pd Ag Cd In Sn Sb Te I Xe Cs Ba La Ce Pr',
  'Nd Pm Sm Eu Gd Tb Dy Ho Er Tm Yb Lu Hf Ta W Re Os Ir Pt Au',
  'Hg Tl Pb Bi Po At Rn Fr Ra Ac Th Pa U Np Pu Am Cm Bk Cf Es',
  'Fm',
]
  .join(' ')
  .split(' ');

const NAMES = [
  'nøytron hydrogen helium litium beryllium bor karbon nitrogen oksygen fluor',
  'neon natrium magnesium aluminium silisium fosfor svovel klor argon kalium',
  'kalsium skandium titan vanadium krom mangan jern kobolt nikkel kobber',
  'sink gallium germanium arsen selen brom krypton rubidium strontium yttrium',
  'zirkonium niob molybden technetium ruthenium rhodium palladium sølv kadmium indium',
  'tinn antimon tellur jod xenon cesium barium lantan cerium praseodym',
  'neodym prometium samarium europium gadolinium terbium dysprosium holmium erbium thulium',
  'ytterbium lutetium hafnium tantal wolfram rhenium osmium iridium platina gull',
  'kvikksølv thallium bly vismut polonium astat radon francium radium aktinium',
  'thorium protactinium uran neptunium plutonium americium curium berkelium californium einsteinium',
  'fermium',
]
  .join(' ')
  .split(' ');

/** Høyeste protontall i tabellen. */
export const Z_MAX = SYMBOLS.length - 1;

/** Kjemisk symbol for protontallet Z (1–100). Ukjente Z gir «?». */
export function elementSymbol(Z: number): string {
  return SYMBOLS[Z] ?? '?';
}

/** Norsk navn (små bokstaver) for protontallet Z. */
export function elementName(Z: number): string {
  return NAMES[Z] ?? 'ukjent grunnstoff';
}

/** Navnet med stor forbokstav, f.eks. «Natrium». */
export function elementNameCap(Z: number): string {
  const n = elementName(Z);
  return n.charAt(0).toLocaleUpperCase('nb') + n.slice(1);
}

/** Kort nuklidenavn med hevet nukleontall: (6, 14) → «¹⁴C». */
export function nuclideText(Z: number, A: number): string {
  return `${superscript(A)}${elementSymbol(Z)}`;
}

/** Nuklidenavn med ord: (6, 14) → «karbon-14». */
export function nuclideWords(Z: number, A: number): string {
  return `${elementName(Z)}-${A}`;
}
