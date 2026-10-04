/** Ren fysikk for kapittel 7 Atomfysikk (ingen React), så den kan testes for seg. */
import { elementName, elementSymbol } from './elements';

/* ---------- Konstanter med verdiene i ERGO Fysikk 1 ---------- */

/** Plancks konstant (J·s). */
export const H_PLANCK = 6.63e-34;
/** Lysfarten i vakuum (m/s). */
export const C_LIGHT = 3.0e8;
/** Elementærladningen (C). 1 eV = 1,60 · 10⁻¹⁹ J. */
export const E_CHARGE = 1.6e-19;
/** Konstanten i Bohrs formel for hydrogen: E_n = −B/n² (J). */
export const BOHR_B = 2.18e-18;
/** Massen til proton, nøytron og elektron (kg). */
export const M_PROTON = 1.673e-27;
export const M_NEUTRON = 1.675e-27;
export const M_ELECTRON = 9.11e-31;

/** Grensene for synlig lys som brukes i spekterfigurene (nm). */
export const VISIBLE_MIN = 380;
export const VISIBLE_MAX = 750;

/* ---------- 7A Atomets sammensetning ---------- */

/**
 * Største antall elektroner i hvert skall i den enkle skallmodellen som brukes for Z = 1–20 (2, 8, 8, 2).
 * Det fjerde skallet får resten.
 */
export const SHELL_CAPACITY = [2, 8, 8, Infinity] as const;

/** Elektronfordeling i skall: 11 elektroner → [2, 8, 1]. */
export function shellConfig(electrons: number): number[] {
  const out: number[] = [];
  let left = Math.max(0, Math.floor(electrons));
  for (const cap of SHELL_CAPACITY) {
    if (left <= 0) break;
    const k = Math.min(cap, left);
    out.push(k);
    left -= k;
  }
  return out;
}

/** Stabile isotoper (nukleontall A) for Z = 1–20. Den første er den vanligste i naturen. */
export const STABLE_ISOTOPES: Record<number, number[]> = {
  1: [1, 2],
  2: [4, 3],
  3: [7, 6],
  4: [9],
  5: [11, 10],
  6: [12, 13],
  7: [14, 15],
  8: [16, 17, 18],
  9: [19],
  10: [20, 21, 22],
  11: [23],
  12: [24, 25, 26],
  13: [27],
  14: [28, 29, 30],
  15: [31],
  16: [32, 33, 34, 36],
  17: [35, 37],
  18: [40, 36, 38],
  19: [39, 41],
  20: [40, 42, 43, 44, 46, 48],
};

/** Noen kjente radioaktive isotoper med halveringstid (som tekst). */
export const RADIOACTIVE_ISOTOPES: { Z: number; A: number; halfLife: string }[] = [
  { Z: 1, A: 3, halfLife: '12,3 år' },
  { Z: 2, A: 6, halfLife: '0,81 s' },
  { Z: 3, A: 8, halfLife: '0,84 s' },
  { Z: 4, A: 7, halfLife: '53 døgn' },
  { Z: 4, A: 10, halfLife: '1,4 · 10⁶ år' },
  { Z: 6, A: 11, halfLife: '20 min' },
  { Z: 6, A: 14, halfLife: '5730 år' },
  { Z: 7, A: 13, halfLife: '10 min' },
  { Z: 8, A: 15, halfLife: '2,0 min' },
  { Z: 9, A: 18, halfLife: '110 min' },
  { Z: 11, A: 22, halfLife: '2,6 år' },
  { Z: 11, A: 24, halfLife: '15 timer' },
  { Z: 13, A: 26, halfLife: '7,2 · 10⁵ år' },
  { Z: 15, A: 32, halfLife: '14,3 døgn' },
  { Z: 16, A: 35, halfLife: '87 døgn' },
  { Z: 17, A: 36, halfLife: '3,0 · 10⁵ år' },
  { Z: 18, A: 39, halfLife: '269 år' },
  { Z: 19, A: 40, halfLife: '1,25 · 10⁹ år' },
  { Z: 20, A: 41, halfLife: '1,0 · 10⁵ år' },
  { Z: 20, A: 45, halfLife: '163 døgn' },
];

/** Den vanligste stabile isotopen (nukleontall) for protontallet Z. */
export function mostCommonA(Z: number): number {
  return STABLE_ISOTOPES[Z]?.[0] ?? 2 * Z;
}

/** Hvor mange nøytroner glidebryteren tillater for protontallet Z: litt på hver side av de stabile isotopene. */
export function neutronRange(Z: number): [number, number] {
  const ns = (STABLE_ISOTOPES[Z] ?? [2 * Z]).map((A) => A - Z);
  const lo = Math.min(...ns);
  const hi = Math.max(...ns);
  // Hydrogen: ¹H, ²H og ³H. Uten nøytroner holder ikke kjerner med flere protoner sammen.
  if (Z === 1) return [0, 2];
  return [Math.max(1, lo - 2), hi + 2];
}

/** Antall elektroner glidebryteren tillater: fra helt ionisert (bare kjernen) til to ekstra elektroner, høyst 20. */
export function electronRange(Z: number): [number, number] {
  return [0, Math.min(20, Z + 2)];
}

export type IsotopeStatus = 'stabil' | 'radioaktiv' | 'for-mange-noytroner' | 'for-faa-noytroner' | 'ustabil';

export interface AtomInfo {
  Z: number;
  N: number;
  electrons: number;
  /** Nukleontall A = Z + N. */
  A: number;
  symbol: string;
  name: string;
  /** Ladning i elementærladninger: Z − antall elektroner. */
  charge: number;
  status: IsotopeStatus;
  /** Halveringstid for kjente radioaktive isotoper. */
  halfLife?: string;
  /** Elektronfordeling i skall. */
  shells: number[];
  /** Total masse (kg). */
  mass: number;
  /** Andelen av massen som sitter i kjernen (0–1). */
  nucleusMassFraction: number;
}

export function atomInfo(Z: number, N: number, electrons: number): AtomInfo {
  const A = Z + N;
  const stable = STABLE_ISOTOPES[Z] ?? [];
  const known = RADIOACTIVE_ISOTOPES.find((r) => r.Z === Z && r.A === A);
  let status: IsotopeStatus;
  if (stable.includes(A)) status = 'stabil';
  else if (known) status = 'radioaktiv';
  else if (stable.length && N > Math.max(...stable) - Z) status = 'for-mange-noytroner';
  else if (stable.length && N < Math.min(...stable) - Z) status = 'for-faa-noytroner';
  else status = 'ustabil';
  const mNucleus = Z * M_PROTON + N * M_NEUTRON;
  const mass = mNucleus + electrons * M_ELECTRON;
  return {
    Z,
    N,
    electrons,
    A,
    symbol: elementSymbol(Z),
    name: elementName(Z),
    charge: Z - electrons,
    status,
    halfLife: known?.halfLife,
    shells: shellConfig(electrons),
    mass,
    nucleusMassFraction: mass > 0 ? mNucleus / mass : 0,
  };
}

/** Ladningen som hevet skrift etter symbolet: 1 → «⁺», 2 → «²⁺», −1 → «⁻», 0 → «». */
export function chargeSuperscript(q: number): string {
  if (q === 0) return '';
  const SUP = '⁰¹²³⁴⁵⁶⁷⁸⁹';
  const n = Math.abs(q);
  const digits = n === 1 ? '' : String(n).replace(/\d/g, (d) => SUP[Number(d)] ?? d);
  return digits + (q > 0 ? '⁺' : '⁻');
}

/* ---------- 7B Bohrs atommodell for hydrogen ---------- */

/** Antall desimaler som gir tre gjeldende siffer: 13,6 · 3,41 · 0,852. */
export function sigDecimals(v: number, sig = 3): number {
  if (!Number.isFinite(v) || v === 0) return 0;
  return Math.max(0, sig - 1 - Math.floor(Math.log10(Math.abs(v))));
}

/** Energinivå n i hydrogen (J): E_n = −B/n². */
export function levelEnergyJ(n: number): number {
  return -BOHR_B / (n * n);
}

/** Energinivå n i hydrogen (eV). */
export function levelEnergyEV(n: number): number {
  return levelEnergyJ(n) / E_CHARGE;
}

export interface Photon {
  /** Fotonenergien (J), alltid positiv. */
  E: number;
  /** Fotonenergien (eV). */
  eV: number;
  /** Frekvens (Hz). */
  f: number;
  /** Bølgelengde (m). */
  lambda: number;
}

/** Fotonet ved en overgang mellom nivåene nA og nB (samme foton ved emisjon og absorpsjon). */
export function transitionPhoton(nA: number, nB: number): Photon {
  const E = Math.abs(levelEnergyJ(nA) - levelEnergyJ(nB));
  const f = E / H_PLANCK;
  return { E, eV: E / E_CHARGE, f, lambda: C_LIGHT / f };
}

/** Fotonet med bølgelengde λ (nm): E = hc/λ. */
export function photonFromWavelength(nm: number): Photon {
  const lambda = nm * 1e-9;
  const f = C_LIGHT / lambda;
  const E = H_PLANCK * f;
  return { E, eV: E / E_CHARGE, f, lambda };
}

export const SERIES_NAMES = ['Lyman', 'Balmer', 'Paschen', 'Brackett', 'Pfund', 'Humphreys'] as const;

/** Serien er bestemt av det nederste nivået i overgangen: n = 1 Lyman, n = 2 Balmer, n = 3 Paschen … */
export function seriesName(nLower: number): string {
  return SERIES_NAMES[nLower - 1] ?? `n = ${nLower}`;
}

export type Region = 'uv' | 'synlig' | 'ir';

/** Hvilken del av det elektromagnetiske spekteret bølgelengden (nm) hører til. */
export function spectralRegion(nm: number): Region {
  if (nm < VISIBLE_MIN) return 'uv';
  if (nm > VISIBLE_MAX) return 'ir';
  return 'synlig';
}

export const REGION_NAMES: Record<Region, string> = { uv: 'ultrafiolett', synlig: 'synlig lys', ir: 'infrarødt' };

/**
 * Omtrentlig farge for lys med bølgelengde λ (nm), som [r, g, b] (0–255). Utenfor 380–750 nm: null.
 * Stykkevis lineær tilnærming (Dan Bruton), med svakere farge mot grensene for synet.
 */
export function wavelengthToRgb(nm: number): [number, number, number] | null {
  if (!(nm >= VISIBLE_MIN && nm <= VISIBLE_MAX)) return null;
  let r = 0;
  let g = 0;
  let b = 0;
  if (nm < 440) {
    r = (440 - nm) / (440 - 380);
    b = 1;
  } else if (nm < 490) {
    g = (nm - 440) / (490 - 440);
    b = 1;
  } else if (nm < 510) {
    g = 1;
    b = (510 - nm) / (510 - 490);
  } else if (nm < 580) {
    r = (nm - 510) / (580 - 510);
    g = 1;
  } else if (nm < 645) {
    r = 1;
    g = (645 - nm) / (645 - 580);
  } else {
    r = 1;
  }
  const fade = nm < 420 ? 0.3 + (0.7 * (nm - 380)) / 40 : nm > 700 ? 0.3 + (0.7 * (750 - nm)) / 50 : 1;
  const c = (x: number) => (x <= 0 ? 0 : Math.round(255 * (x * fade) ** 0.8));
  return [c(r), c(g), c(b)];
}

/** Navnet på fargen til lys med bølgelengde λ (nm). */
export function colorName(nm: number): string {
  if (nm < VISIBLE_MIN) return 'ultrafiolett';
  if (nm < 450) return 'fiolett';
  if (nm < 495) return 'blå';
  if (nm < 570) return 'grønn';
  if (nm < 590) return 'gul';
  if (nm < 620) return 'oransje';
  if (nm <= VISIBLE_MAX) return 'rød';
  return 'infrarødt';
}

/** Fargen som CSS-tekst, eller `fallback` utenfor det synlige området. */
export function wavelengthColor(nm: number, fallback: string): string {
  const rgb = wavelengthToRgb(nm);
  return rgb ? `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})` : fallback;
}

/* ---------- 7C Emisjon og absorpsjon ---------- */

export interface SpectralLine {
  /** Bølgelengde (nm). */
  nm: number;
  /** Relativ styrke 0–1. */
  I: number;
  /** Kort merkelapp, f.eks. «Hα» eller «D». */
  name?: string;
  /** Overgangen i hydrogen (øvre og nedre nivå). */
  from?: number;
  to?: number;
  /** Grunnstoffet linja kommer fra (for sollys). */
  element?: string;
}

/** Synlige linjer i hydrogen fra Bohrs modell: overgangene ned til n = 2 (Balmer-serien) innenfor 380–750 nm. */
export function hydrogenVisibleLines(): SpectralLine[] {
  const NAMES = ['Hα', 'Hβ', 'Hγ', 'Hδ', 'Hε', 'Hζ', 'Hη'];
  const I = [1, 0.75, 0.55, 0.42, 0.3, 0.22, 0.16];
  const lines: SpectralLine[] = [];
  // Opp til n = 9 (Hη). Linjene over det ligger så tett inntil 380 nm at de ikke kan skilles i figuren.
  for (let n = 3; n <= 9; n++) {
    const nm = transitionPhoton(n, 2).lambda * 1e9;
    if (nm < VISIBLE_MIN) break;
    lines.push({ nm, I: I[n - 3] ?? 0.12, name: NAMES[n - 3] ?? 'H', from: n, to: 2 });
  }
  return lines;
}

export type SpectrumElement = 'hydrogen' | 'helium' | 'natrium' | 'kvikksolv';

/** Målte linjer i det synlige området (nm i luft) for grunnstoffene i figuren. Hydrogen regnes ut fra Bohrs modell. */
export const ELEMENT_LINES: Record<Exclude<SpectrumElement, 'hydrogen'>, SpectralLine[]> = {
  helium: [
    { nm: 388.9, I: 0.45 },
    { nm: 402.6, I: 0.2 },
    { nm: 447.1, I: 0.6 },
    { nm: 471.3, I: 0.3 },
    { nm: 492.2, I: 0.3 },
    { nm: 501.6, I: 0.55 },
    { nm: 587.6, I: 1 },
    { nm: 667.8, I: 0.6 },
    { nm: 706.5, I: 0.5 },
  ],
  natrium: [
    { nm: 498.3, I: 0.1 },
    { nm: 568.8, I: 0.15 },
    { nm: 589.0, I: 1, name: 'D' },
    { nm: 589.6, I: 0.9, name: 'D' },
    { nm: 616.1, I: 0.12 },
  ],
  kvikksolv: [
    { nm: 404.7, I: 0.55 },
    { nm: 407.8, I: 0.2 },
    { nm: 435.8, I: 1 },
    { nm: 546.1, I: 1 },
    { nm: 577.0, I: 0.6 },
    { nm: 579.1, I: 0.6 },
  ],
};

export function elementLines(el: SpectrumElement): SpectralLine[] {
  return el === 'hydrogen' ? hydrogenVisibleLines() : ELEMENT_LINES[el];
}

/**
 * De sterkeste mørke linjene i sollys (Fraunhofer-linjer, nm i luft) med grunnstoffet som gir dem.
 * O₂-linjene kommer fra jordatmosfæren, ikke fra sola.
 */
export const SUN_LINES: SpectralLine[] = [
  { nm: 393.4, I: 1, name: 'K', element: 'Ca' },
  { nm: 396.8, I: 1, name: 'H', element: 'Ca' },
  { nm: 404.6, I: 0.3, element: 'Fe' },
  { nm: 410.2, I: 0.5, name: 'h', element: 'H' },
  { nm: 422.7, I: 0.45, element: 'Ca' },
  { nm: 430.8, I: 0.6, name: 'G', element: 'Fe' },
  { nm: 434.0, I: 0.5, element: 'H' },
  { nm: 438.4, I: 0.35, element: 'Fe' },
  { nm: 440.5, I: 0.25, element: 'Fe' },
  { nm: 466.8, I: 0.2, element: 'Fe' },
  { nm: 486.1, I: 0.7, name: 'F', element: 'H' },
  { nm: 495.8, I: 0.25, element: 'Fe' },
  { nm: 516.7, I: 0.35, element: 'Mg' },
  { nm: 517.3, I: 0.5, element: 'Mg' },
  { nm: 518.4, I: 0.6, name: 'b', element: 'Mg' },
  { nm: 527.0, I: 0.5, name: 'E', element: 'Fe' },
  { nm: 532.8, I: 0.25, element: 'Fe' },
  { nm: 589.0, I: 0.8, name: 'D', element: 'Na' },
  { nm: 589.6, I: 0.7, element: 'Na' },
  { nm: 612.2, I: 0.3, element: 'Ca' },
  { nm: 616.2, I: 0.3, element: 'Ca' },
  { nm: 627.7, I: 0.3, element: 'O₂' },
  { nm: 656.3, I: 0.8, name: 'C', element: 'H' },
  { nm: 686.7, I: 0.6, name: 'B', element: 'O₂' },
];

/** Grunnstoffsymbolet til hvert grunnstoff i spekterfiguren (for å finne linjene i sollys). */
export const SPECTRUM_SYMBOL: Record<SpectrumElement, string> = { hydrogen: 'H', helium: 'He', natrium: 'Na', kvikksolv: 'Hg' };

/** Linjene i sollys som kommer fra grunnstoffet. */
export function sunLinesOf(el: SpectrumElement): SpectralLine[] {
  return SUN_LINES.filter((l) => l.element === SPECTRUM_SYMBOL[el]);
}

/** Den nærmeste linja innenfor `tol` nm, ellers null. */
export function nearestLine(lines: SpectralLine[], nm: number, tol = 2): SpectralLine | null {
  let best: SpectralLine | null = null;
  for (const l of lines) if (Math.abs(l.nm - nm) <= tol && (!best || Math.abs(l.nm - nm) < Math.abs(best.nm - nm))) best = l;
  return best;
}

/** Den sterkeste linja (der markøren settes når du bytter grunnstoff). */
export function strongestLine(lines: SpectralLine[]): SpectralLine | undefined {
  return lines.reduce<SpectralLine | undefined>((a, l) => (!a || l.I > a.I ? l : a), undefined);
}
