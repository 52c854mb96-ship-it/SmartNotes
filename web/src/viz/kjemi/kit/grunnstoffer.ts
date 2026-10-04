/**
 * Grunnstoffdata for kjemivisualiseringene: Z = 1–54 og Cs, Ba, Pt, Au, Hg, Pb, Rn, U.
 *
 * Kilder og konvensjoner (se også README, avsnittet «Kjemi»):
 * - Molar masse M (g/mol): IUPAC standard atommasse, forkortet til 4–5 gjeldende siffer slik norske lærebøker gjør
 *   (H 1,008, C 12,01, O 16,00, Na 22,99, Cl 35,45). Tc og Rn har ingen stabile isotoper: der står nukleontallet
 *   til den mest stabile isotopen (98 og 222), og `unstable` er satt.
 * - Elektronegativitet: Pauling-skalaen (reviderte verdier, Allred 1961, som i CRC Handbook). null for He, Ne og Ar.
 * - Atomradius: kovalent radius i pm fra Cordero mfl. (2008), ett datasett for alle. For Mn, Fe og Co er det verdien
 *   for lavspinn. Edelgassene danner nesten ikke bindinger, så radiene deres er ikke direkte sammenlignbare med resten
 *   av perioden (Ne og Ar er litt større enn F og Cl i dette datasettet).
 * - Ioneradius: effektive ioneradier i pm (Shannon 1976, koordinasjonstall 6; N³⁻ har koordinasjonstall 4).
 * - Første ioniseringsenergi: NIST Atomic Spectra Database, omregnet fra eV med 1 eV = 96,485 kJ/mol og avrundet.
 * - Elektronkonfigurasjon: grunntilstanden (NIST). Regnes ut etter oppbyggingsprinsippet (Madelung) med de kjente
 *   unntakene (Cr, Cu, Nb, Mo, Ru, Rh, Pd, Ag, Pt, Au, U). Skrives sortert etter skall (n), som hos NIST og IUPAC:
 *   Fe = [Ar] 3d⁶ 4s². Noen lærebøker skriver i fyllingsrekkefølge ([Ar] 4s² 3d⁶); det er samme konfigurasjon.
 * - Vanlige ioner: ladningen til enkle (enatomige) ioner, den vanligste først. Tom liste = danner sjelden enkle ioner.
 */
import { superscript } from '../../kit/format';

export type Category =
  | 'alkalimetall'
  | 'jordalkalimetall'
  | 'overgangsmetall'
  | 'annet metall'
  | 'halvmetall'
  | 'ikke-metall'
  | 'halogen'
  | 'edelgass'
  | 'lantanoid'
  | 'aktinoid';

export type ElementBlock = 's' | 'p' | 'd' | 'f';

/** Tilstand ved 25 °C og 1 atm. */
export type Phase = 's' | 'l' | 'g';

export interface Subshell {
  /** Hovedkvantetall (skall). */
  n: number;
  /** Bikvantetall: 0 = s, 1 = p, 2 = d, 3 = f. */
  l: number;
  /** Antall elektroner. */
  electrons: number;
}

export interface Element {
  /** Protontall. */
  Z: number;
  symbol: string;
  /** Norsk navn (bokmål), små bokstaver: «natrium». */
  name: string;
  /** Molar masse i g/mol. */
  molarMass: number;
  /** Ingen stabile isotoper; molarMass er nukleontallet til den mest stabile isotopen. */
  unstable?: boolean;
  /** Gruppe 1–18 (null for lantanoider og aktinoider). */
  group: number | null;
  period: number;
  block: ElementBlock;
  category: Category;
  /** Tilstand ved romtemperatur (25 °C). */
  phase: Phase;
  /** Elektronegativitet (Pauling). null for He, Ne og Ar. */
  electronegativity: number | null;
  /** Kovalent radius i pm (Cordero mfl. 2008). */
  covalentRadius: number;
  /** Ioneradius i pm for vanlige ioner, f.eks. { 1: 102 } for Na⁺ (Shannon). */
  ionicRadius: Readonly<Record<number, number>>;
  /** Første ioniseringsenergi i kJ/mol (NIST). */
  ionizationEnergy: number;
  /** Delskallene i grunntilstanden, sortert etter n og deretter l. */
  subshells: readonly Subshell[];
  /** Full elektronkonfigurasjon: «1s² 2s² 2p⁴». */
  configuration: string;
  /** Med edelgasskjerne: «[He] 2s² 2p⁴». For H og He det samme som `configuration`. */
  configurationShort: string;
  /** Antall elektroner i hvert skall etter hovedkvantetallet n: Fe → [2, 8, 14, 2]. */
  shells: readonly number[];
  /** Skallene i Bohrs atommodell slik lærebøkene tegner dem (bare Z ≤ 20, ellers null): K → [2, 8, 8, 1]. */
  bohrShells: readonly number[] | null;
  /** Valenselektroner for hovedgruppegrunnstoffene (gruppe 1, 2 og 13–18). null for overgangsmetaller og U. */
  valenceElectrons: number | null;
  /** Vanlige ioneladninger, den vanligste først: Fe → [2, 3], O → [−2]. */
  ions: readonly number[];
}

/*
 * Rådata. Kolonner: Z, symbol, navn, M (g/mol), gruppe, periode, kategori, tilstand, EN (Pauling), kovalent radius (pm),
 * første ioniseringsenergi (kJ/mol).
 */
type Row = [number, string, string, number, number | null, number, Category, Phase, number | null, number, number];

const ROWS: Row[] = [
  [1, 'H', 'hydrogen', 1.008, 1, 1, 'ikke-metall', 'g', 2.2, 31, 1312],
  [2, 'He', 'helium', 4.003, 18, 1, 'edelgass', 'g', null, 28, 2372],
  [3, 'Li', 'litium', 6.94, 1, 2, 'alkalimetall', 's', 0.98, 128, 520],
  [4, 'Be', 'beryllium', 9.012, 2, 2, 'jordalkalimetall', 's', 1.57, 96, 900],
  [5, 'B', 'bor', 10.81, 13, 2, 'halvmetall', 's', 2.04, 84, 801],
  [6, 'C', 'karbon', 12.01, 14, 2, 'ikke-metall', 's', 2.55, 76, 1086],
  [7, 'N', 'nitrogen', 14.01, 15, 2, 'ikke-metall', 'g', 3.04, 71, 1402],
  [8, 'O', 'oksygen', 16.0, 16, 2, 'ikke-metall', 'g', 3.44, 66, 1314],
  [9, 'F', 'fluor', 19.0, 17, 2, 'halogen', 'g', 3.98, 57, 1681],
  [10, 'Ne', 'neon', 20.18, 18, 2, 'edelgass', 'g', null, 58, 2081],
  [11, 'Na', 'natrium', 22.99, 1, 3, 'alkalimetall', 's', 0.93, 166, 496],
  [12, 'Mg', 'magnesium', 24.31, 2, 3, 'jordalkalimetall', 's', 1.31, 141, 738],
  [13, 'Al', 'aluminium', 26.98, 13, 3, 'annet metall', 's', 1.61, 121, 578],
  [14, 'Si', 'silisium', 28.09, 14, 3, 'halvmetall', 's', 1.9, 111, 787],
  [15, 'P', 'fosfor', 30.97, 15, 3, 'ikke-metall', 's', 2.19, 107, 1012],
  [16, 'S', 'svovel', 32.07, 16, 3, 'ikke-metall', 's', 2.58, 105, 1000],
  [17, 'Cl', 'klor', 35.45, 17, 3, 'halogen', 'g', 3.16, 102, 1251],
  [18, 'Ar', 'argon', 39.95, 18, 3, 'edelgass', 'g', null, 106, 1521],
  [19, 'K', 'kalium', 39.1, 1, 4, 'alkalimetall', 's', 0.82, 203, 419],
  [20, 'Ca', 'kalsium', 40.08, 2, 4, 'jordalkalimetall', 's', 1.0, 176, 590],
  [21, 'Sc', 'scandium', 44.96, 3, 4, 'overgangsmetall', 's', 1.36, 170, 633],
  [22, 'Ti', 'titan', 47.87, 4, 4, 'overgangsmetall', 's', 1.54, 160, 659],
  [23, 'V', 'vanadium', 50.94, 5, 4, 'overgangsmetall', 's', 1.63, 153, 651],
  [24, 'Cr', 'krom', 52.0, 6, 4, 'overgangsmetall', 's', 1.66, 139, 653],
  [25, 'Mn', 'mangan', 54.94, 7, 4, 'overgangsmetall', 's', 1.55, 139, 717],
  [26, 'Fe', 'jern', 55.85, 8, 4, 'overgangsmetall', 's', 1.83, 132, 762],
  [27, 'Co', 'kobolt', 58.93, 9, 4, 'overgangsmetall', 's', 1.88, 126, 760],
  [28, 'Ni', 'nikkel', 58.69, 10, 4, 'overgangsmetall', 's', 1.91, 124, 737],
  [29, 'Cu', 'kobber', 63.55, 11, 4, 'overgangsmetall', 's', 1.9, 132, 745],
  [30, 'Zn', 'sink', 65.38, 12, 4, 'overgangsmetall', 's', 1.65, 122, 906],
  [31, 'Ga', 'gallium', 69.72, 13, 4, 'annet metall', 's', 1.81, 122, 579],
  [32, 'Ge', 'germanium', 72.63, 14, 4, 'halvmetall', 's', 2.01, 120, 762],
  [33, 'As', 'arsen', 74.92, 15, 4, 'halvmetall', 's', 2.18, 119, 944],
  [34, 'Se', 'selen', 78.97, 16, 4, 'ikke-metall', 's', 2.55, 120, 941],
  [35, 'Br', 'brom', 79.9, 17, 4, 'halogen', 'l', 2.96, 120, 1140],
  [36, 'Kr', 'krypton', 83.8, 18, 4, 'edelgass', 'g', 3.0, 116, 1351],
  [37, 'Rb', 'rubidium', 85.47, 1, 5, 'alkalimetall', 's', 0.82, 220, 403],
  [38, 'Sr', 'strontium', 87.62, 2, 5, 'jordalkalimetall', 's', 0.95, 195, 549],
  [39, 'Y', 'yttrium', 88.91, 3, 5, 'overgangsmetall', 's', 1.22, 190, 600],
  [40, 'Zr', 'zirkonium', 91.22, 4, 5, 'overgangsmetall', 's', 1.33, 175, 640],
  [41, 'Nb', 'niob', 92.91, 5, 5, 'overgangsmetall', 's', 1.6, 164, 652],
  [42, 'Mo', 'molybden', 95.95, 6, 5, 'overgangsmetall', 's', 2.16, 154, 684],
  [43, 'Tc', 'technetium', 98, 7, 5, 'overgangsmetall', 's', 1.9, 147, 687],
  [44, 'Ru', 'ruthenium', 101.07, 8, 5, 'overgangsmetall', 's', 2.2, 146, 710],
  [45, 'Rh', 'rhodium', 102.91, 9, 5, 'overgangsmetall', 's', 2.28, 142, 720],
  [46, 'Pd', 'palladium', 106.42, 10, 5, 'overgangsmetall', 's', 2.2, 139, 804],
  [47, 'Ag', 'sølv', 107.87, 11, 5, 'overgangsmetall', 's', 1.93, 145, 731],
  [48, 'Cd', 'kadmium', 112.41, 12, 5, 'overgangsmetall', 's', 1.69, 144, 868],
  [49, 'In', 'indium', 114.82, 13, 5, 'annet metall', 's', 1.78, 142, 558],
  [50, 'Sn', 'tinn', 118.71, 14, 5, 'annet metall', 's', 1.96, 139, 709],
  [51, 'Sb', 'antimon', 121.76, 15, 5, 'halvmetall', 's', 2.05, 139, 831],
  [52, 'Te', 'tellur', 127.6, 16, 5, 'halvmetall', 's', 2.1, 138, 869],
  [53, 'I', 'jod', 126.9, 17, 5, 'halogen', 's', 2.66, 139, 1008],
  [54, 'Xe', 'xenon', 131.29, 18, 5, 'edelgass', 'g', 2.6, 140, 1170],
  [55, 'Cs', 'cesium', 132.91, 1, 6, 'alkalimetall', 's', 0.79, 244, 376],
  [56, 'Ba', 'barium', 137.33, 2, 6, 'jordalkalimetall', 's', 0.89, 215, 503],
  [78, 'Pt', 'platina', 195.08, 10, 6, 'overgangsmetall', 's', 2.28, 136, 864],
  [79, 'Au', 'gull', 196.97, 11, 6, 'overgangsmetall', 's', 2.54, 136, 890],
  [80, 'Hg', 'kvikksølv', 200.59, 12, 6, 'overgangsmetall', 'l', 2.0, 132, 1007],
  [82, 'Pb', 'bly', 207.2, 14, 6, 'annet metall', 's', 2.33, 146, 716],
  [86, 'Rn', 'radon', 222, 18, 6, 'edelgass', 'g', 2.2, 150, 1037],
  [92, 'U', 'uran', 238.03, null, 7, 'aktinoid', 's', 1.38, 196, 598],
];

/** Vanlige enkle ioner, den vanligste ladningen først. Grunnstoffer som mangler her, danner sjelden enkle ioner. */
const IONS: Record<string, number[]> = {
  H: [1, -1],
  Li: [1],
  Be: [2],
  N: [-3],
  O: [-2],
  F: [-1],
  Na: [1],
  Mg: [2],
  Al: [3],
  P: [-3],
  S: [-2],
  Cl: [-1],
  K: [1],
  Ca: [2],
  Sc: [3],
  Ti: [4, 3],
  V: [3, 2],
  Cr: [3, 2],
  Mn: [2],
  Fe: [2, 3],
  Co: [2, 3],
  Ni: [2],
  Cu: [2, 1],
  Zn: [2],
  Ga: [3],
  Se: [-2],
  Br: [-1],
  Rb: [1],
  Sr: [2],
  Y: [3],
  Zr: [4],
  Rh: [3],
  Pd: [2],
  Ag: [1],
  Cd: [2],
  In: [3],
  Sn: [2, 4],
  Sb: [3],
  Te: [-2],
  I: [-1],
  Cs: [1],
  Ba: [2],
  Pt: [2, 4],
  Au: [3, 1],
  Hg: [2],
  Pb: [2, 4],
  U: [4],
};

/** Effektive ioneradier i pm (Shannon 1976, koordinasjonstall 6; N³⁻ koordinasjonstall 4). */
const IONIC_RADII: Record<string, Record<number, number>> = {
  Li: { 1: 76 },
  Be: { 2: 45 },
  N: { [-3]: 146 },
  O: { [-2]: 140 },
  F: { [-1]: 133 },
  Na: { 1: 102 },
  Mg: { 2: 72 },
  Al: { 3: 53.5 },
  S: { [-2]: 184 },
  Cl: { [-1]: 181 },
  K: { 1: 138 },
  Ca: { 2: 100 },
  Fe: { 2: 78, 3: 64.5 },
  Cu: { 1: 77, 2: 73 },
  Zn: { 2: 74 },
  Se: { [-2]: 198 },
  Br: { [-1]: 196 },
  Rb: { 1: 152 },
  Sr: { 2: 118 },
  Ag: { 1: 115 },
  I: { [-1]: 220 },
  Cs: { 1: 167 },
  Ba: { 2: 135 },
};

/* ---------- Elektronkonfigurasjon ---------- */

const L_LETTER = ['s', 'p', 'd', 'f'] as const;
const CAPACITY = [2, 6, 10, 14];
/** Fyllingsrekkefølgen etter Madelungs regel (n + l, deretter n). */
const MADELUNG: [number, number][] = [];
for (let sum = 1; sum <= 8; sum++) for (let n = 1; n <= sum; n++) {
  const l = sum - n;
  if (l < n && l <= 3) MADELUNG.push([n, l]);
}

/** Kjente unntak i grunntilstanden: delskall → antall elektroner (overstyrer Madelung). */
const EXCEPTIONS: Record<number, Record<string, number>> = {
  24: { '3d': 5, '4s': 1 },
  29: { '3d': 10, '4s': 1 },
  41: { '4d': 4, '5s': 1 },
  42: { '4d': 5, '5s': 1 },
  44: { '4d': 7, '5s': 1 },
  45: { '4d': 8, '5s': 1 },
  46: { '4d': 10, '5s': 0 },
  47: { '4d': 10, '5s': 1 },
  78: { '5d': 9, '6s': 1 },
  79: { '5d': 10, '6s': 1 },
  92: { '5f': 3, '6d': 1, '7s': 2 },
};

const NOBLE_CORES = [2, 10, 18, 36, 54, 86];
const NOBLE_SYMBOL: Record<number, string> = { 2: 'He', 10: 'Ne', 18: 'Ar', 36: 'Kr', 54: 'Xe', 86: 'Rn' };

const key = (n: number, l: number) => `${n}${L_LETTER[l]}`;

/** Delskallene i grunntilstanden for protontallet Z (nøytralt atom), sortert etter n og l. */
export function subshellsFor(Z: number): Subshell[] {
  const occ = new Map<string, Subshell>();
  let left = Z;
  for (const [n, l] of MADELUNG) {
    if (left <= 0) break;
    const e = Math.min(left, CAPACITY[l]!);
    occ.set(key(n, l), { n, l, electrons: e });
    left -= e;
  }
  for (const [k, e] of Object.entries(EXCEPTIONS[Z] ?? {})) {
    const n = Number(k.slice(0, -1));
    const l = L_LETTER.indexOf(k.slice(-1) as (typeof L_LETTER)[number]);
    if (e === 0) occ.delete(k);
    else occ.set(k, { n, l, electrons: e });
  }
  return [...occ.values()].sort((a, b) => a.n - b.n || a.l - b.l);
}

function configText(subs: readonly Subshell[]): string {
  return subs.map((s) => `${s.n}${L_LETTER[s.l]}${superscript(s.electrons)}`).join(' ');
}

function shortConfig(Z: number, subs: readonly Subshell[]): string {
  const core = [...NOBLE_CORES].reverse().find((c) => c < Z);
  if (!core) return configText(subs);
  const coreKeys = new Map(subshellsFor(core).map((s) => [key(s.n, s.l), s.electrons]));
  const rest = subs.filter((s) => coreKeys.get(key(s.n, s.l)) !== s.electrons);
  return `[${NOBLE_SYMBOL[core]}] ${configText(rest)}`;
}

function shellsOf(subs: readonly Subshell[]): number[] {
  const shells: number[] = [];
  for (const s of subs) shells[s.n - 1] = (shells[s.n - 1] ?? 0) + s.electrons;
  return Array.from(shells, (v) => v ?? 0);
}

function blockOf(group: number | null, Z: number): ElementBlock {
  if (group === null) return 'f';
  if (group <= 2 || Z === 2) return 's';
  if (group <= 12) return 'd';
  return 'p';
}

function valenceOf(group: number | null, Z: number): number | null {
  if (group === null) return null;
  if (Z === 2) return 2;
  if (group <= 2) return group;
  if (group >= 13) return group - 10;
  return null;
}

/* ---------- Tabellen ---------- */

/** Alle grunnstoffene i tabellen, sortert etter protontall. */
export const ELEMENTS: readonly Element[] = ROWS.map(([Z, symbol, name, molarMass, group, period, category, phase, en, rcov, ie]) => {
  const subshells = subshellsFor(Z);
  const shells = shellsOf(subshells);
  return {
    Z,
    symbol,
    name,
    molarMass,
    ...(Z === 43 || Z === 86 ? { unstable: true } : {}),
    group,
    period,
    block: blockOf(group, Z),
    category,
    phase,
    electronegativity: en,
    covalentRadius: rcov,
    ionicRadius: IONIC_RADII[symbol] ?? {},
    ionizationEnergy: ie,
    subshells,
    configuration: configText(subshells),
    configurationShort: shortConfig(Z, subshells),
    shells,
    bohrShells: Z <= 20 ? shells : null,
    valenceElectrons: valenceOf(group, Z),
    ions: IONS[symbol] ?? [],
  };
});

const BY_SYMBOL = new Map(ELEMENTS.map((e) => [e.symbol, e]));
const BY_Z = new Map(ELEMENTS.map((e) => [e.Z, e]));

/** Grunnstoffet med dette symbolet («Na») eller protontallet (11). `undefined` hvis det ikke er i tabellen. */
export function getElement(symbolOrZ: string | number): Element | undefined {
  return typeof symbolOrZ === 'number' ? BY_Z.get(symbolOrZ) : BY_SYMBOL.get(symbolOrZ);
}

/** Som `getElement`, men kaster en feil for ukjente grunnstoffer. Bruk for faste verdier i koden: `element('O')`. */
export function element(symbolOrZ: string | number): Element {
  const e = getElement(symbolOrZ);
  if (!e) throw new Error(`Ukjent grunnstoff: ${symbolOrZ}`);
  return e;
}

export function elementsInPeriod(period: number): Element[] {
  return ELEMENTS.filter((e) => e.period === period);
}

export function elementsInGroup(group: number): Element[] {
  return ELEMENTS.filter((e) => e.group === group);
}

/** Hovedgruppegrunnstoffene (gruppe 1, 2 og 13–18) i en periode, f.eks. Na–Ar i periode 3. */
export function mainGroupInPeriod(period: number): Element[] {
  return elementsInPeriod(period).filter((e) => e.valenceElectrons !== null);
}

const METALS: readonly Category[] = ['alkalimetall', 'jordalkalimetall', 'overgangsmetall', 'annet metall', 'lantanoid', 'aktinoid'];

export function isMetal(e: Element): boolean {
  return METALS.includes(e.category);
}

/** Ikke-metaller, halogener og edelgasser (halvmetallene er verken metall eller ikke-metall). */
export function isNonmetal(e: Element): boolean {
  return e.category === 'ikke-metall' || e.category === 'halogen' || e.category === 'edelgass';
}

/** Navnet med stor forbokstav: «Natrium». */
export function capitalize(s: string): string {
  return s.charAt(0).toLocaleUpperCase('nb') + s.slice(1);
}

/** Ladning som hevet skrift: 2 → «²⁺», −1 → «⁻», 0 → «». */
export function chargeSuperscript(charge: number): string {
  if (charge === 0) return '';
  const n = Math.abs(charge);
  return `${n === 1 ? '' : superscript(n)}${charge > 0 ? '⁺' : '⁻'}`;
}

/** Ladning som vanlig tekst: 2 → «2+», −1 → «−», 0 → «». */
export function chargeText(charge: number): string {
  if (charge === 0) return '';
  const n = Math.abs(charge);
  return `${n === 1 ? '' : n}${charge > 0 ? '+' : '−'}`;
}

/** Ionesymbol med hevet ladning: («Mg», 2) → «Mg²⁺». */
export function ionSymbol(symbol: string, charge: number): string {
  return `${symbol}${chargeSuperscript(charge)}`;
}

/**
 * Bohr-skallene til et ion: positive ioner mister elektroner fra det ytterste skallet, negative tar dem opp der.
 * Na, +1 → [2, 8]; Cl, −1 → [2, 8, 8]; H, +1 → []. Gir null for grunnstoffer uten Bohr-skall i tabellen (Z > 20).
 */
export function ionShells(e: Element, charge: number): number[] | null {
  if (!e.bohrShells) return null;
  const shells = [...e.bohrShells];
  if (charge > 0) {
    let left = charge;
    while (left > 0 && shells.length) {
      const last = shells.length - 1;
      const take = Math.min(left, shells[last]!);
      shells[last] = shells[last]! - take;
      left -= take;
      if (shells[last] === 0) shells.pop();
    }
  } else if (charge < 0) {
    const last = shells.length - 1;
    shells[last] = shells[last]! - charge;
  }
  return shells;
}

/** Alle kjente grunnstoffsymboler (Z = 1–118), for å skille «ikke i tabellen» fra «finnes ikke» i feilmeldinger. */
export const ALL_SYMBOLS: readonly string[] = (
  'H He Li Be B C N O F Ne Na Mg Al Si P S Cl Ar K Ca Sc Ti V Cr Mn Fe Co Ni Cu Zn Ga Ge As Se Br Kr Rb Sr Y Zr Nb ' +
  'Mo Tc Ru Rh Pd Ag Cd In Sn Sb Te I Xe Cs Ba La Ce Pr Nd Pm Sm Eu Gd Tb Dy Ho Er Tm Yb Lu Hf Ta W Re Os Ir Pt Au Hg ' +
  'Tl Pb Bi Po At Rn Fr Ra Ac Th Pa U Np Pu Am Cm Bk Cf Es Fm Md No Lr Rf Db Sg Bh Hs Mt Ds Rg Cn Nh Fl Mc Lv Ts Og'
).split(' ');
