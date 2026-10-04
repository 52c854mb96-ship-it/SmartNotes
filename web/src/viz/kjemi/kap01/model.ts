/** Ren kjemi for kapittel 1 Kjemiske bindinger (ingen React), så den kan testes for seg. */
import { element, isMetal, type Element } from '../kit/grunnstoffer';
import { formula } from '../kit/formel';
import { superscript } from '../../kit/format';

/* ---------- 1.4 Bindingstype ut fra elektronegativitetsforskjellen ---------- */

/** Grunnstoffene eleven kan velge mellom (hovedgruppene uten edelgassene). */
export const BOND_ELEMENTS = ['H', 'Li', 'Be', 'B', 'C', 'N', 'O', 'F', 'Na', 'Mg', 'Al', 'Si', 'P', 'S', 'Cl', 'K', 'Ca', 'Br', 'I'] as const;

/** Grensene som brukes i norske lærebøker: ΔEN < 0,5 upolar kovalent, 0,5–1,7 polar kovalent, over 1,7 ionisk. */
export const DEN_POLAR = 0.5;
export const DEN_IONIC = 1.7;
/** Høyeste ΔEN på skalaen (Cs–F er 3,19). */
export const DEN_MAX = 3.3;

export type DenClass = 'upolar' | 'polar' | 'ionisk';
export type BondKind = DenClass | 'metallisk';

export const KIND_NAMES: Record<BondKind, string> = {
  upolar: 'Upolar kovalent',
  polar: 'Polar kovalent',
  ionisk: 'Ionebinding',
  metallisk: 'Metallbinding',
};

/** Korte navn til avlesningen (får plass på mobil). */
export const KIND_SHORT: Record<BondKind, string> = {
  upolar: 'Upolar kovalent',
  polar: 'Polar kovalent',
  ionisk: 'Ionisk',
  metallisk: 'Metallisk',
};

/** Klassifisering etter ΔEN alene. Akkurat 0,5 regnes som polar og akkurat 1,7 som polar kovalent. */
export function classifyDEN(dEN: number): DenClass {
  if (dEN < DEN_POLAR) return 'upolar';
  if (dEN <= DEN_IONIC) return 'polar';
  return 'ionisk';
}

/**
 * Omtrentlig ionisk karakter (0–1) etter Pauling: 1 − e^(−ΔEN²/4). Gir ca. 50 % ved ΔEN = 1,7, som er grunnen til
 * at 1,7 brukes som grense mellom polar kovalent binding og ionebinding.
 */
export function ionicCharacter(dEN: number): number {
  return 1 - Math.exp(-(dEN * dEN) / 4);
}

export interface IonicFormula {
  /** Formelenhet, f.eks. «MgCl2». */
  formula: string;
  cation: Element;
  anion: Element;
  cationCharge: number;
  anionCharge: number;
  /** Antall kationer og anioner i formelenheten. */
  nCation: number;
  nAnion: number;
}

const gcd = (a: number, b: number): number => (b === 0 ? Math.abs(a) : gcd(b, a % b));

/**
 * Formelen til en ionisk forbindelse mellom et metall og et ikke-metall, ut fra de vanligste ioneladningene, så
 * summen av ladningene blir null: Mg²⁺ og Cl⁻ → MgCl2, Al³⁺ og O²⁻ → Al2O3. Gir null hvis et av ionene mangler.
 */
export function ionicFormula(metal: Element, nonmetal: Element): IonicFormula | null {
  const c = metal.ions.find((q) => q > 0);
  const a = nonmetal.ions.find((q) => q < 0);
  if (!c || !a) return null;
  const g = gcd(c, -a);
  const nCation = -a / g;
  const nAnion = c / g;
  const part = (s: string, n: number) => `${s}${n > 1 ? n : ''}`;
  return { formula: part(metal.symbol, nCation) + part(nonmetal.symbol, nAnion), cation: metal, anion: nonmetal, cationCharge: c, anionCharge: a, nCation, nAnion };
}

/** Små, høyt ladde kationer (Be²⁺, Al³⁺) trekker elektronskyen til anionet mot seg, så bindingen får mye kovalent karakter. */
const POLARIZING = ['Be', 'Al'];
const METALLOID_LIKE = ['B', 'C', 'Si'];

/** Hvorfor tegningen avviker fra det ΔEN-regelen alene sier. */
export type Caveat =
  | 'metall-ikke-metall' // ΔEN ≤ 1,7, men metall + ikke-metall gir likevel ionebinding (NaH, MgI2)
  | 'polariserende' // Be og Al: ΔEN-regelen stemmer, forbindelsen er mer kovalent enn ionisk (AlCl3)
  | 'ikke-metaller' // to ikke-metaller med ΔEN > 1,7: fortsatt kovalent (HF, BF3, SiF4)
  | 'halvmetall' // metall + B, C eller Si: verken typisk ionisk eller kovalent
  | null;

export interface BondAnalysis {
  a: Element;
  b: Element;
  /** |EN(a) − EN(b)|. */
  dEN: number;
  /** Bindingstypen etter ΔEN-regelen alene (der markøren står på skalaen). */
  byDEN: DenClass;
  /** Bindingstypen som tegnes og står i avlesningen (tar hensyn til metall/ikke-metall). */
  kind: BondKind;
  caveat: Caveat;
  /** Atomet som trekker hardest i elektronene (δ− eller anion). null når ΔEN = 0. */
  negative: Element | null;
  positive: Element | null;
  /** Ionisk karakter etter Pauling (0–1). */
  ionicCharacter: number;
  /** Bare for ionebinding: ioner og formel. */
  ionic: IonicFormula | null;
  /** En kjent forbindelse med denne bindingen. */
  example: { formula: string; name: string } | null;
}

/** Analyserer bindingen mellom to grunnstoffer (symboler). Rekkefølgen spiller ingen rolle for resultatet. */
export function analyzeBond(symbolA: string, symbolB: string): BondAnalysis {
  const a = element(symbolA);
  const b = element(symbolB);
  const ea = a.electronegativity ?? 0;
  const eb = b.electronegativity ?? 0;
  const dEN = Math.round(Math.abs(ea - eb) * 100) / 100;
  const byDEN = classifyDEN(dEN);
  const negative = ea === eb ? null : ea > eb ? a : b;
  const positive = ea === eb ? null : ea > eb ? b : a;
  const metalA = isMetal(a);
  const metalB = isMetal(b);

  let kind: BondKind = byDEN;
  let caveat: Caveat = null;
  let ionic: IonicFormula | null = null;
  if (metalA && metalB) {
    kind = 'metallisk';
  } else if (metalA !== metalB) {
    const metal = metalA ? a : b;
    const other = metalA ? b : a;
    if (METALLOID_LIKE.includes(other.symbol)) {
      kind = byDEN === 'ionisk' ? 'polar' : byDEN;
      caveat = 'halvmetall';
    } else if (POLARIZING.includes(metal.symbol) && byDEN !== 'ionisk') {
      caveat = 'polariserende';
    } else {
      kind = 'ionisk';
      if (byDEN !== 'ionisk') caveat = 'metall-ikke-metall';
      ionic = ionicFormula(metal, other);
    }
  } else if (byDEN === 'ionisk') {
    kind = 'polar';
    caveat = 'ikke-metaller';
  }
  if (kind === 'ionisk' && !ionic) {
    const metal = metalA ? a : b;
    ionic = ionicFormula(metal, metal === a ? b : a);
  }
  return {
    a,
    b,
    dEN,
    byDEN,
    kind,
    caveat,
    negative,
    positive,
    ionicCharacter: ionicCharacter(dEN),
    ionic,
    example: exampleCompound(a.symbol, b.symbol),
  };
}

/** Kjente forbindelser for parene (nøkkel: symbolene sortert alfabetisk, skilt med «-»). */
const EXAMPLES: Record<string, [string, string]> = {
  'H-H': ['H2', 'hydrogengass'],
  'C-H': ['CH4', 'metan'],
  'H-N': ['NH3', 'ammoniakk'],
  'H-O': ['H2O', 'vann'],
  'F-H': ['HF', 'hydrogenfluorid'],
  'Cl-H': ['HCl', 'hydrogenklorid'],
  'Br-H': ['HBr', 'hydrogenbromid'],
  'H-I': ['HI', 'hydrogenjodid'],
  'H-S': ['H2S', 'hydrogensulfid'],
  'H-P': ['PH3', 'fosfin'],
  'H-Si': ['SiH4', 'silan'],
  'B-H': ['B2H6', 'diboran'],
  'H-Li': ['LiH', 'litiumhydrid'],
  'H-Na': ['NaH', 'natriumhydrid'],
  'H-K': ['KH', 'kaliumhydrid'],
  'Ca-H': ['CaH2', 'kalsiumhydrid'],
  'H-Mg': ['MgH2', 'magnesiumhydrid'],
  'Be-H': ['BeH2', 'berylliumhydrid'],
  'Al-H': ['AlH3', 'aluminiumhydrid'],
  'C-C': ['C', 'diamant og grafitt'],
  'C-O': ['CO2', 'karbondioksid'],
  'C-N': ['HCN', 'hydrogencyanid'],
  'C-F': ['CF4', 'tetrafluormetan'],
  'C-Cl': ['CCl4', 'tetraklormetan'],
  'Br-C': ['CBr4', 'tetrabrommetan'],
  'C-I': ['CH3I', 'jodmetan'],
  'C-S': ['CS2', 'karbondisulfid'],
  'C-Si': ['SiC', 'silisiumkarbid'],
  'C-Ca': ['CaC2', 'kalsiumkarbid'],
  'Al-C': ['Al4C3', 'aluminiumkarbid'],
  'B-C': ['B4C', 'borkarbid'],
  'N-N': ['N2', 'nitrogengass'],
  'N-O': ['NO2', 'nitrogendioksid'],
  'F-N': ['NF3', 'nitrogentrifluorid'],
  'Cl-N': ['NCl3', 'nitrogentriklorid'],
  'N-Si': ['Si3N4', 'silisiumnitrid'],
  'B-N': ['BN', 'bornitrid'],
  'Li-N': ['Li3N', 'litiumnitrid'],
  'Mg-N': ['Mg3N2', 'magnesiumnitrid'],
  'Ca-N': ['Ca3N2', 'kalsiumnitrid'],
  'Al-N': ['AlN', 'aluminiumnitrid'],
  'O-O': ['O2', 'oksygengass'],
  'F-O': ['OF2', 'oksygendifluorid'],
  'Cl-O': ['Cl2O', 'diklormonoksid'],
  'O-S': ['SO2', 'svoveldioksid'],
  'O-P': ['P4O10', 'tetrafosfordekaoksid'],
  'O-Si': ['SiO2', 'silisiumdioksid (kvarts)'],
  'B-O': ['B2O3', 'bortrioksid'],
  'Li-O': ['Li2O', 'litiumoksid'],
  'Na-O': ['Na2O', 'natriumoksid'],
  'K-O': ['K2O', 'kaliumoksid'],
  'Be-O': ['BeO', 'berylliumoksid'],
  'Mg-O': ['MgO', 'magnesiumoksid'],
  'Ca-O': ['CaO', 'kalsiumoksid'],
  'Al-O': ['Al2O3', 'aluminiumoksid'],
  'F-F': ['F2', 'fluorgass'],
  'Cl-F': ['ClF', 'klorfluorid'],
  'F-S': ['SF6', 'svovelheksafluorid'],
  'F-P': ['PF5', 'fosforpentafluorid'],
  'F-Si': ['SiF4', 'silisiumtetrafluorid'],
  'B-F': ['BF3', 'bortrifluorid'],
  'F-Li': ['LiF', 'litiumfluorid'],
  'F-Na': ['NaF', 'natriumfluorid'],
  'F-K': ['KF', 'kaliumfluorid'],
  'Be-F': ['BeF2', 'berylliumfluorid'],
  'F-Mg': ['MgF2', 'magnesiumfluorid'],
  'Ca-F': ['CaF2', 'kalsiumfluorid (flusspat)'],
  'Al-F': ['AlF3', 'aluminiumfluorid'],
  'Cl-Cl': ['Cl2', 'klorgass'],
  'Cl-S': ['SCl2', 'svoveldiklorid'],
  'Cl-P': ['PCl3', 'fosfortriklorid'],
  'Cl-Si': ['SiCl4', 'silisiumtetraklorid'],
  'B-Cl': ['BCl3', 'bortriklorid'],
  'Cl-Li': ['LiCl', 'litiumklorid'],
  'Cl-Na': ['NaCl', 'natriumklorid'],
  'Cl-K': ['KCl', 'kaliumklorid'],
  'Be-Cl': ['BeCl2', 'berylliumklorid'],
  'Cl-Mg': ['MgCl2', 'magnesiumklorid'],
  'Ca-Cl': ['CaCl2', 'kalsiumklorid'],
  'Al-Cl': ['AlCl3', 'aluminiumklorid'],
  'Br-Cl': ['BrCl', 'bromklorid'],
  'Cl-I': ['ICl', 'jodklorid'],
  'Br-Br': ['Br2', 'brom'],
  'Br-P': ['PBr3', 'fosfortribromid'],
  'Br-Si': ['SiBr4', 'silisiumtetrabromid'],
  'B-Br': ['BBr3', 'bortribromid'],
  'Br-Li': ['LiBr', 'litiumbromid'],
  'Br-Na': ['NaBr', 'natriumbromid'],
  'Br-K': ['KBr', 'kaliumbromid'],
  'Br-Mg': ['MgBr2', 'magnesiumbromid'],
  'Br-Ca': ['CaBr2', 'kalsiumbromid'],
  'Al-Br': ['AlBr3', 'aluminiumbromid'],
  'Br-I': ['IBr', 'jodbromid'],
  'I-I': ['I2', 'jod'],
  'I-P': ['PI3', 'fosfortrijodid'],
  'I-Si': ['SiI4', 'silisiumtetrajodid'],
  'I-Li': ['LiI', 'litiumjodid'],
  'I-Na': ['NaI', 'natriumjodid'],
  'I-K': ['KI', 'kaliumjodid'],
  'I-Mg': ['MgI2', 'magnesiumjodid'],
  'Ca-I': ['CaI2', 'kalsiumjodid'],
  'Al-I': ['AlI3', 'aluminiumjodid'],
  'S-S': ['S8', 'svovel'],
  'Li-S': ['Li2S', 'litiumsulfid'],
  'Na-S': ['Na2S', 'natriumsulfid'],
  'K-S': ['K2S', 'kaliumsulfid'],
  'Mg-S': ['MgS', 'magnesiumsulfid'],
  'Ca-S': ['CaS', 'kalsiumsulfid'],
  'Al-S': ['Al2S3', 'aluminiumsulfid'],
  'P-P': ['P4', 'hvitt fosfor'],
  'Na-P': ['Na3P', 'natriumfosfid'],
  'K-P': ['K3P', 'kaliumfosfid'],
  'Mg-P': ['Mg3P2', 'magnesiumfosfid'],
  'Ca-P': ['Ca3P2', 'kalsiumfosfid'],
  'Al-P': ['AlP', 'aluminiumfosfid'],
  'Si-Si': ['Si', 'silisiumkrystall'],
  'Mg-Si': ['Mg2Si', 'magnesiumsilisid'],
  'B-B': ['B', 'bor'],
  'Li-Li': ['Li', 'litiummetall'],
  'Na-Na': ['Na', 'natriummetall'],
  'K-K': ['K', 'kaliummetall'],
  'Be-Be': ['Be', 'berylliummetall'],
  'Mg-Mg': ['Mg', 'magnesiummetall'],
  'Ca-Ca': ['Ca', 'kalsiummetall'],
  'Al-Al': ['Al', 'aluminiummetall'],
  'K-Na': ['NaK', 'natrium-kalium-legering'],
};

export function exampleCompound(a: string, b: string): { formula: string; name: string } | null {
  const e = EXAMPLES[[a, b].sort().join('-')];
  return e ? { formula: e[0], name: e[1] } : null;
}

/** Alle eksemplene (for tester). */
export function allExamples(): [string, string, string][] {
  return Object.entries(EXAMPLES).map(([k, [f, n]]) => [k, f, n]);
}

/** Elektronene som flyttes ved ionebinding: hvert kation avgir `cationCharge`, hvert anion tar opp |anionCharge|. */
export function electronsTransferred(ionic: IonicFormula): number {
  return ionic.nCation * ionic.cationCharge;
}

/** Sjekk at formelen i et eksempel inneholder begge grunnstoffene. */
export function exampleHasBoth(a: string, b: string): boolean {
  const ex = exampleCompound(a, b);
  if (!ex) return false;
  const atoms = formula(ex.formula).atoms;
  return a in atoms && b in atoms;
}

/* ---------- 1.2–1.3 Elektronkonfigurasjon ---------- */

/**
 * Delskallene i fyllingsrekkefølgen etter oppbyggingsprinsippet (n + l, deretter n), til og med 4p: nok for Z = 1–36.
 * Kilde for grunntilstandene: NIST Atomic Spectra Database (samme som kit-ets grunnstoffer.ts).
 */
export const FILL_ORDER = ['1s', '2s', '2p', '3s', '3p', '4s', '3d', '4p'] as const;
export type SubshellKey = (typeof FILL_ORDER)[number];
/** Høyeste protontall visualiseringen dekker (krypton). */
export const CONFIG_Z_MAX = 36;

const L_INDEX = { s: 0, p: 1, d: 2 } as const;

export interface FilledSubshell {
  key: SubshellKey;
  /** Hovedkvantetall (skall). */
  n: number;
  /** 0 = s, 1 = p, 2 = d. */
  l: number;
  /** Antall orbitaler (bokser): 1, 3 eller 5. */
  orbitals: number;
  /** Plass til to elektroner per orbital. */
  capacity: number;
  electrons: number;
}

/** Protontallet avrundet og holdt innenfor 1–36. */
export function clampZ(Z: number): number {
  if (!Number.isFinite(Z)) return 1;
  return Math.min(CONFIG_Z_MAX, Math.max(1, Math.round(Z)));
}

function subshellInfo(key: SubshellKey) {
  const n = Number(key[0]);
  const l = L_INDEX[key[1] as 's' | 'p' | 'd'];
  const orbitals = 2 * l + 1;
  return { key, n, l, orbitals, capacity: 2 * orbitals };
}

/** Delskallene fylt strengt etter oppbyggingsprinsippet (uten unntak), i fyllingsrekkefølge. Tomme delskall er med. */
export function aufbauFill(Z: number): FilledSubshell[] {
  let left = clampZ(Z);
  return FILL_ORDER.map((key) => {
    const s = subshellInfo(key);
    const e = Math.min(left, s.capacity);
    left -= e;
    return { ...s, electrons: e };
  });
}

/**
 * Unntakene blant Z = 1–36: ett 4s-elektron går over i 3d, så 3d blir halvfullt (krom) eller fullt (kobber).
 * Et halvfullt eller fullt d-delskall har spesielt lav energi.
 */
export const CONFIG_EXCEPTIONS: Readonly<Record<number, 'halvfullt' | 'fullt'>> = { 24: 'halvfullt', 29: 'fullt' };

export function isConfigException(Z: number): boolean {
  return clampZ(Z) in CONFIG_EXCEPTIONS;
}

/** Grunntilstanden (med unntakene for Cr og Cu), i fyllingsrekkefølge. Tomme delskall er med. */
export function electronConfiguration(Z: number): FilledSubshell[] {
  const z = clampZ(Z);
  const subs = aufbauFill(z);
  if (z in CONFIG_EXCEPTIONS) {
    const s4 = subs.find((s) => s.key === '4s')!;
    const d3 = subs.find((s) => s.key === '3d')!;
    s4.electrons -= 1;
    d3.electrons += 1;
  }
  return subs;
}

/**
 * Orbitalboksene i et delskall etter Hunds regel: elektronene fyller hver boks enkeltvis (pil opp) før de pares
 * (pil ned). 0 = tom, 1 = ett elektron, 2 = elektronpar.
 */
export function orbitalBoxes(electrons: number, orbitals: number): (0 | 1 | 2)[] {
  const e = Math.max(0, Math.min(2 * orbitals, Math.round(electrons)));
  return Array.from({ length: orbitals }, (_, i) => (e >= orbitals + i + 1 ? 2 : e >= i + 1 ? 1 : 0));
}

const NOBLE_CORES: [number, string][] = [
  [36, 'Kr'],
  [18, 'Ar'],
  [10, 'Ne'],
  [2, 'He'],
];

/** Konfigurasjonen som tekst i fyllingsrekkefølge: «1s² 2s² 2p⁶ 3s¹». Bare delskall med elektroner. */
export function configurationText(subs: readonly FilledSubshell[]): string {
  return subs
    .filter((s) => s.electrons > 0)
    .map((s) => `${s.key}${superscript(s.electrons)}`)
    .join(' ');
}

/** Med edelgasskjerne: «[Ne] 3s¹», «[Ar] 4s² 3d⁶». H og He skrives fullt ut. */
export function shortConfigurationText(Z: number, subs: readonly FilledSubshell[] = electronConfiguration(Z)): string {
  const z = clampZ(Z);
  const core = NOBLE_CORES.find(([c]) => c < z);
  if (!core) return configurationText(subs);
  const coreSubs = aufbauFill(core[0]);
  const rest = subs.filter((s, i) => s.electrons > 0 && s.electrons !== coreSubs[i]!.electrons);
  return `[${core[1]}] ${configurationText(rest)}`;
}

/** Antall elektroner i hvert skall (n = 1, 2, 3 …): Fe → [2, 8, 14, 2]. Lærebokas Bohr-modell for Z ≤ 20. */
export function shellCounts(Z: number): number[] {
  const shells: number[] = [];
  for (const s of electronConfiguration(Z)) if (s.electrons > 0) shells[s.n - 1] = (shells[s.n - 1] ?? 0) + s.electrons;
  return Array.from(shells, (v) => v ?? 0);
}

/** Valenselektroner = elektronene i det ytterste skallet (høyeste n). Fe → 2 (4s²), Cl → 7 (3s² 3p⁵). */
export function valenceElectronCount(Z: number): number {
  const sh = shellCounts(Z);
  return sh[sh.length - 1] ?? 0;
}

/** Antall uparede elektroner (bokser med bare én pil). O → 2, Cr → 6, Cu → 1. */
export function unpairedElectrons(Z: number): number {
  return electronConfiguration(Z).reduce((sum, s) => sum + orbitalBoxes(s.electrons, s.orbitals).filter((b) => b === 1).length, 0);
}

/** Delskallet det siste elektronet går inn i etter oppbyggingsprinsippet. Gir blokka i periodesystemet. */
export function lastSubshell(Z: number): FilledSubshell {
  const subs = aufbauFill(Z);
  return [...subs].reverse().find((s) => s.electrons > 0)!;
}

export type ConfigBlock = 's' | 'p' | 'd';

export interface PeriodicPosition {
  /** Periode = antall skall med elektroner. */
  period: number;
  /** Gruppe 1–18, regnet ut fra konfigurasjonen. */
  group: number;
  block: ConfigBlock;
}

/**
 * Plassen i periodesystemet ut fra elektronkonfigurasjonen alene: perioden er antall skall, blokka er delskallet
 * som fylles sist, og gruppa er s-elektronene (s-blokka), s + d (d-blokka) eller 10 + s + p (p-blokka). He står i
 * gruppe 18 fordi skallet er fullt.
 */
export function periodicPosition(Z: number): PeriodicPosition {
  const z = clampZ(Z);
  const subs = electronConfiguration(z);
  const period = shellCounts(z).length;
  const last = lastSubshell(z);
  const block = (['s', 'p', 'd'] as const)[last.l]!;
  const outerS = subs.find((s) => s.n === period && s.l === 0)?.electrons ?? 0;
  let group: number;
  if (block === 's') group = z === 2 ? 18 : outerS;
  else if (block === 'p') group = 12 + (subs.find((s) => s.n === period && s.l === 1)?.electrons ?? 0);
  else group = outerS + (subs.find((s) => s.n === period - 1 && s.l === 2)?.electrons ?? 0);
  return { period, group, block };
}

/** Indeksen (i fyllingsrekkefølge) og boksen til det siste elektronet som ble lagt til (for å fremheve det). */
export function newestElectron(Z: number): { subshell: number; box: number; spin: 'opp' | 'ned' } {
  const subs = electronConfiguration(Z);
  const last = lastSubshell(Z);
  const i = subs.findIndex((s) => s.key === last.key);
  const s = subs[i]!;
  const e = s.electrons;
  return e <= s.orbitals ? { subshell: i, box: e - 1, spin: 'opp' } : { subshell: i, box: e - s.orbitals - 1, spin: 'ned' };
}

/* ---------- 1.4 Molekylform (VSEPR) ---------- */

/**
 * Formene VSEPR gir med 2–4 bundne atomer og 0–2 frie elektronpar på sentralatomet. De tre siste har fem eller seks
 * elektronområder (utvidet oktett) og er bare med så alle kombinasjonene i fri modus gir en riktig form.
 */
export type ShapeId =
  | 'linear'
  | 'bent-120'
  | 'bent'
  | 'trigonal-planar'
  | 'trigonal-pyramidal'
  | 't-shaped'
  | 'tetrahedral'
  | 'seesaw'
  | 'square-planar';

export interface ShapeInfo {
  id: ShapeId;
  /** Norsk navn på molekylformen. */
  name: string;
  /** Hvordan elektronområdene (bindinger + frie par) er ordnet. */
  electronGeometry: string;
  bonds: number;
  lonePairs: number;
  /** Typisk bindingsvinkel (grader) for et eksempelmolekyl. */
  angle: number;
  /** Vinkelen som tekst, f.eks. «ca. 104,5°». */
  angleText: string;
  /** Eksempelmolekyl (formel). */
  example: string;
}

/**
 * Bindingsvinkler: ideelle VSEPR-vinkler (180°, 120°, 109,5°) og målte vinkler i eksempelmolekylene
 * (NH₃ 107°, H₂O 104,5°, SO₂ 119°, ClF₃ 87,5°, SF₄ 102° og 173°), fra CRC Handbook of Chemistry and Physics.
 */
export const SHAPES: Record<ShapeId, ShapeInfo> = {
  linear: { id: 'linear', name: 'lineær', electronGeometry: 'lineær', bonds: 2, lonePairs: 0, angle: 180, angleText: '180°', example: 'CO2' },
  'bent-120': { id: 'bent-120', name: 'vinklet', electronGeometry: 'plan trekantet', bonds: 2, lonePairs: 1, angle: 119, angleText: 'ca. 119°', example: 'SO2' },
  bent: { id: 'bent', name: 'vinklet', electronGeometry: 'tetraedrisk', bonds: 2, lonePairs: 2, angle: 104.5, angleText: 'ca. 104,5°', example: 'H2O' },
  'trigonal-planar': { id: 'trigonal-planar', name: 'plan trekantet', electronGeometry: 'plan trekantet', bonds: 3, lonePairs: 0, angle: 120, angleText: '120°', example: 'BF3' },
  'trigonal-pyramidal': { id: 'trigonal-pyramidal', name: 'trigonal pyramide', electronGeometry: 'tetraedrisk', bonds: 3, lonePairs: 1, angle: 107, angleText: 'ca. 107°', example: 'NH3' },
  't-shaped': { id: 't-shaped', name: 'T-formet', electronGeometry: 'trigonal bipyramide', bonds: 3, lonePairs: 2, angle: 87.5, angleText: 'ca. 87,5°', example: 'ClF3' },
  tetrahedral: { id: 'tetrahedral', name: 'tetraedrisk', electronGeometry: 'tetraedrisk', bonds: 4, lonePairs: 0, angle: 109.5, angleText: '109,5°', example: 'CH4' },
  seesaw: { id: 'seesaw', name: 'vippehuske', electronGeometry: 'trigonal bipyramide', bonds: 4, lonePairs: 1, angle: 102, angleText: 'ca. 102° og 173°', example: 'SF4' },
  'square-planar': { id: 'square-planar', name: 'kvadratisk plan', electronGeometry: 'oktaedrisk', bonds: 4, lonePairs: 2, angle: 90, angleText: '90°', example: 'XeF4' },
};

/** Formen ut fra antall bundne atomer (2–4) og frie elektronpar (0–2) på sentralatomet. */
export function shapeFor(bonds: number, lonePairs: number): ShapeId {
  const b = Math.min(4, Math.max(2, Math.round(bonds)));
  const e = Math.min(2, Math.max(0, Math.round(lonePairs)));
  const map: Record<string, ShapeId> = {
    '2-0': 'linear',
    '2-1': 'bent-120',
    '2-2': 'bent',
    '3-0': 'trigonal-planar',
    '3-1': 'trigonal-pyramidal',
    '3-2': 't-shaped',
    '4-0': 'tetrahedral',
    '4-1': 'seesaw',
    '4-2': 'square-planar',
  };
  return map[`${b}-${e}`]!;
}

/** VSEPR-notasjonen AXₙEₘ: A = sentralatom, X = bundne atomer, E = frie elektronpar. */
export function axeNotation(bonds: number, lonePairs: number): string {
  const sub = (n: number) => (n > 1 ? String(n).replace(/\d/g, (d) => '₀₁₂₃₄₅₆₇₈₉'[Number(d)]!) : '');
  return `AX${sub(bonds)}${lonePairs > 0 ? `E${sub(lonePairs)}` : ''}`;
}

export type Vec3 = [number, number, number];

export interface LigandSlot {
  /** Retning i tegningen (grader, mot klokka, y opp). */
  deg: number;
  stereo: 'plane' | 'wedge' | 'hash';
  /** Lengde i tegningen i forhold til en binding i papirplanet (kiler er kortere). */
  len: number;
  /** Retningen i rommet (x mot høyre, y opp, z ut av papiret mot deg), enhetsvektor. */
  v: Vec3;
}

export interface ShapeLayout {
  ligands: LigandSlot[];
  /** Retningene (grader) til de frie elektronparene i tegningen. */
  lonePairs: number[];
  /** Mellom hvilke to bindinger bindingsvinkelen tegnes (null når den ikke kan vises riktig i 2D). */
  arc: [number, number] | null;
}

const rad = (d: number) => (d * Math.PI) / 180;
const planar = (deg: number, len = 1): LigandSlot => ({ deg, stereo: 'plane', len, v: [Math.cos(rad(deg)), Math.sin(rad(deg)), 0] });
// Tetraederet: to bindinger i papirplanet (opp og ned til venstre) og to mot høyre, én ut av og én inn i papiret.
const TET_SIDE: [number, number] = [Math.sqrt(2) / 3, -1 / 3];
const TET_Z = Math.sqrt(6) / 3;
/** Den eksakte tetraedervinkelen, arccos(−1/3) = 109,47°. */
const TET_ANGLE = (Math.acos(-1 / 3) * 180) / Math.PI;

/**
 * Tegnemåten for hver form (samme oppsett som kit-ets vsepr() for de vanlige formene), og retningen til hver binding
 * i rommet, som brukes til å legge sammen bindingsdipolene. `angle` overstyrer vinkelen i vinklede molekyler.
 */
export function shapeLayout(shape: ShapeId, angle?: number): ShapeLayout {
  const a = angle ?? SHAPES[shape].angle;
  switch (shape) {
    case 'linear':
      return { ligands: [planar(180), planar(0)], lonePairs: [], arc: [0, 1] };
    case 'bent-120':
      return { ligands: [planar(270 - a / 2), planar(270 + a / 2)], lonePairs: [90], arc: [0, 1] };
    case 'bent':
      return { ligands: [planar(270 - a / 2), planar(270 + a / 2)], lonePairs: [130, 50], arc: [0, 1] };
    case 'trigonal-planar':
      return { ligands: [planar(90), planar(210), planar(330)], lonePairs: [], arc: [1, 2] };
    case 'trigonal-pyramidal':
      return {
        ligands: [
          planar(90 + TET_ANGLE),
          { deg: 305, stereo: 'wedge', len: 0.9, v: [TET_SIDE[0], TET_SIDE[1], TET_Z] },
          { deg: 345, stereo: 'hash', len: 0.9, v: [TET_SIDE[0], TET_SIDE[1], -TET_Z] },
        ],
        lonePairs: [90],
        arc: [0, 1],
      };
    case 'tetrahedral':
      return {
        ligands: [
          planar(90),
          planar(90 + TET_ANGLE),
          { deg: 305, stereo: 'wedge', len: 0.9, v: [TET_SIDE[0], TET_SIDE[1], TET_Z] },
          { deg: 345, stereo: 'hash', len: 0.9, v: [TET_SIDE[0], TET_SIDE[1], -TET_Z] },
        ],
        lonePairs: [],
        arc: [0, 1],
      };
    case 't-shaped':
      // Aksiale bindinger opp og ned (litt bøyd bort fra de frie parene), én ekvatorial til høyre.
      return { ligands: [planar(a), planar(360 - a), planar(0)], lonePairs: [155, 205], arc: [0, 2] };
    case 'seesaw': {
      // Aksiale bindinger nesten rett opp og ned (173°), to ekvatoriale mot høyre (102° mellom dem), fritt par til venstre.
      const eq = rad(51);
      return {
        ligands: [
          planar(86.5),
          planar(273.5),
          { deg: 338, stereo: 'wedge', len: 0.9, v: [Math.cos(eq), 0, Math.sin(eq)] },
          { deg: 22, stereo: 'hash', len: 0.9, v: [Math.cos(eq), 0, -Math.sin(eq)] },
        ],
        lonePairs: [180],
        arc: null,
      };
    }
    case 'square-planar': {
      // Kvadratet ligger vannrett og sees skrått ovenfra og litt fra siden (dreid 25°, vippet 50°), så tegningen er en ekte
      // projeksjon: venstre og høyre nesten i papirplanet, foran (kile) og bak (stiplet). De frie parene peker opp og ned.
      const alpha = rad(25);
      const beta = rad(50);
      const slot = (theta: number, stereo: LigandSlot['stereo']): LigandSlot => {
        const t = rad(theta) + alpha;
        const v: Vec3 = [Math.cos(t), -Math.sin(t) * Math.sin(beta), Math.sin(t) * Math.cos(beta)];
        return { deg: (Math.atan2(v[1], v[0]) * 180) / Math.PI, stereo, len: Math.hypot(v[0], v[1]), v };
      };
      return { ligands: [slot(180, 'plane'), slot(0, 'plane'), slot(90, 'wedge'), slot(270, 'hash')], lonePairs: [90, 270], arc: null };
    }
  }
}

export interface MoleculePreset {
  id: string;
  formula: string;
  /** Norsk navn. */
  name: string;
  center: string;
  /** Atomene rundt sentralatomet, i samme rekkefølge som bindingene i shapeLayout. */
  ligands: string[];
  orders: (1 | 2 | 3)[];
  /** Frie elektronpar på sentralatomet. */
  lonePairs: number;
  /** Målt bindingsvinkel (grader). */
  angle: number;
  /** Hvilken vinkel, når molekylet har flere: «H–C–H». */
  angleBetween?: string;
  /** Målt dipolmoment i debye (CRC Handbook). 0 = upolart molekyl. */
  dipole: number;
}

/**
 * Molekylene eleven kan velge. Vinkler og dipolmomenter: CRC Handbook of Chemistry and Physics (gassfase).
 * SO₂ tegnes med to dobbeltbindinger (de to S–O-bindingene er like lange); S får da ti elektroner rundt seg.
 */
export const MOLECULES: MoleculePreset[] = [
  { id: 'H2O', formula: 'H2O', name: 'vann', center: 'O', ligands: ['H', 'H'], orders: [1, 1], lonePairs: 2, angle: 104.5, dipole: 1.85 },
  { id: 'NH3', formula: 'NH3', name: 'ammoniakk', center: 'N', ligands: ['H', 'H', 'H'], orders: [1, 1, 1], lonePairs: 1, angle: 107, dipole: 1.47 },
  { id: 'CH4', formula: 'CH4', name: 'metan', center: 'C', ligands: ['H', 'H', 'H', 'H'], orders: [1, 1, 1, 1], lonePairs: 0, angle: 109.5, dipole: 0 },
  { id: 'CO2', formula: 'CO2', name: 'karbondioksid', center: 'C', ligands: ['O', 'O'], orders: [2, 2], lonePairs: 0, angle: 180, dipole: 0 },
  { id: 'BF3', formula: 'BF3', name: 'bortrifluorid', center: 'B', ligands: ['F', 'F', 'F'], orders: [1, 1, 1], lonePairs: 0, angle: 120, dipole: 0 },
  { id: 'HCN', formula: 'HCN', name: 'hydrogencyanid', center: 'C', ligands: ['H', 'N'], orders: [1, 3], lonePairs: 0, angle: 180, dipole: 2.98 },
  { id: 'SO2', formula: 'SO2', name: 'svoveldioksid', center: 'S', ligands: ['O', 'O'], orders: [2, 2], lonePairs: 1, angle: 119, dipole: 1.63 },
  { id: 'H2S', formula: 'H2S', name: 'hydrogensulfid', center: 'S', ligands: ['H', 'H'], orders: [1, 1], lonePairs: 2, angle: 92, dipole: 0.97 },
  { id: 'CCl4', formula: 'CCl4', name: 'tetraklormetan', center: 'C', ligands: ['Cl', 'Cl', 'Cl', 'Cl'], orders: [1, 1, 1, 1], lonePairs: 0, angle: 109.5, dipole: 0 },
  { id: 'CH2O', formula: 'CH2O', name: 'metanal (formaldehyd)', center: 'C', ligands: ['O', 'H', 'H'], orders: [2, 1, 1], lonePairs: 0, angle: 116.5, angleBetween: 'H–C–H', dipole: 2.33 },
  { id: 'PCl3', formula: 'PCl3', name: 'fosfortriklorid', center: 'P', ligands: ['Cl', 'Cl', 'Cl'], orders: [1, 1, 1], lonePairs: 1, angle: 100, dipole: 0.56 },
  { id: 'CHCl3', formula: 'CHCl3', name: 'triklormetan (kloroform)', center: 'C', ligands: ['H', 'Cl', 'Cl', 'Cl'], orders: [1, 1, 1, 1], lonePairs: 0, angle: 108, angleBetween: 'H–C–Cl', dipole: 1.04 },
];

export function moleculeShape(m: MoleculePreset): ShapeId {
  return shapeFor(m.ligands.length, m.lonePairs);
}

/** Valenselektroner til et atom i en Lewisstruktur (hovedgruppene); «X» (fri modus) regnes som et halogen. */
export function lewisValence(symbol: string): number {
  if (symbol === 'X') return 7;
  return element(symbol).valenceElectrons ?? 0;
}

/** Frie elektronpar på et ytre atom med en binding av orden `order`: H 0, Cl 3, O (dobbeltbinding) 2, N (trippel) 1. */
export function ligandLonePairs(symbol: string, order: number): number {
  return Math.max(0, (lewisValence(symbol) - order) / 2);
}

/** Elektronene i Lewisstrukturen (bindinger · 2 + frie par · 2) og summen av valenselektronene. Skal være like. */
export function lewisElectronCount(m: MoleculePreset): { drawn: number; valence: number } {
  const bondE = 2 * m.orders.reduce((s, o) => s + o, 0);
  const lp = m.lonePairs + m.ligands.reduce((s, l, i) => s + ligandLonePairs(l, m.orders[i] ?? 1), 0);
  const valence = lewisValence(m.center) + m.ligands.reduce((s, l) => s + lewisValence(l), 0);
  return { drawn: bondE + 2 * lp, valence };
}

/** Elektroner rundt sentralatomet (oktettregelen: 8; B i BF₃ har 6, S i SO₂ med to dobbeltbindinger 10). */
export function centralElectrons(m: Pick<MoleculePreset, 'orders' | 'lonePairs'>): number {
  return 2 * m.orders.reduce((s, o) => s + o, 0) + 2 * m.lonePairs;
}

/**
 * Bindingsdipolen for hver binding: EN(ytre atom) − EN(sentralatom). Positiv = det ytre atomet trekker hardest
 * (får δ−). I fri modus regnes X som mer elektronegativt enn A (ΔEN = 1).
 */
export function bondPolarities(center: string, ligands: readonly string[]): number[] {
  if (center === 'A') return ligands.map(() => 1);
  const ec = element(center).electronegativity ?? 0;
  return ligands.map((l) => Math.round(((element(l).electronegativity ?? 0) - ec) * 100) / 100);
}

/** Bindinger med |ΔEN| under denne grensen tegnes uten delladning og dipolpil (C–H 0,35, S–H 0,38). */
export const DIPOLE_DRAW_MIN = 0.4;

/**
 * Summen av bindingsdipolene som vektorer (enhet: ΔEN). Null når formen er symmetrisk og bindingene like (CO₂, CCl₄,
 * BF₃). Forenkling: de frie elektronparene bidrar også til dipolmomentet i virkeligheten, men er ikke med her.
 */
export function netDipole(shape: ShapeId, polarities: readonly number[], angle?: number): Vec3 {
  const lay = shapeLayout(shape, angle);
  const sum: Vec3 = [0, 0, 0];
  lay.ligands.forEach((l, i) => {
    const p = polarities[i] ?? 0;
    for (let k = 0; k < 3; k++) sum[k] = sum[k]! + p * l.v[k]!;
  });
  return sum.map((v) => (Math.abs(v) < 1e-9 ? 0 : v)) as Vec3;
}

export const vecLength = (v: Vec3) => Math.hypot(v[0], v[1], v[2]);

/** Polart molekyl i fri modus: bindingsdipolene opphever ikke hverandre. */
export function isPolarShape(shape: ShapeId): boolean {
  return vecLength(netDipole(shape, [1, 1, 1, 1])) > 1e-3;
}

/* ---------- 1.5 Svake bindinger: kokepunkt og krefter mellom molekyler ---------- */

export const KELVIN = 273.15;

export interface Hydride {
  formula: string;
  name: string;
  /** Gruppa til grunnstoffet som er bundet til hydrogen. */
  group: 14 | 15 | 16 | 17;
  period: 2 | 3 | 4 | 5;
  /** Kokepunkt ved 1 atm (°C). */
  bp: number;
  /** Polart molekyl (dipol-dipol-krefter). Gruppe 14-hydridene er tetraedriske og upolare. */
  polar: boolean;
  /** H bundet til N, O eller F: kan danne hydrogenbindinger. */
  hbond: boolean;
}

/**
 * Hydridene i gruppe 14–17. Kokepunkter (°C, 1 atm) fra CRC Handbook of Chemistry and Physics, avrundet til én
 * desimal (læreboka bruker hele grader: H₂O 100, HF 20, NH₃ −33, CH₄ −161).
 */
export const HYDRIDES: Hydride[] = [
  { formula: 'CH4', name: 'metan', group: 14, period: 2, bp: -161.5, polar: false, hbond: false },
  { formula: 'SiH4', name: 'silan', group: 14, period: 3, bp: -111.9, polar: false, hbond: false },
  { formula: 'GeH4', name: 'german', group: 14, period: 4, bp: -88.5, polar: false, hbond: false },
  { formula: 'SnH4', name: 'stannan', group: 14, period: 5, bp: -51.8, polar: false, hbond: false },
  { formula: 'NH3', name: 'ammoniakk', group: 15, period: 2, bp: -33.3, polar: true, hbond: true },
  { formula: 'PH3', name: 'fosfin', group: 15, period: 3, bp: -87.7, polar: true, hbond: false },
  { formula: 'AsH3', name: 'arsin', group: 15, period: 4, bp: -62.5, polar: true, hbond: false },
  { formula: 'SbH3', name: 'stibin', group: 15, period: 5, bp: -17.0, polar: true, hbond: false },
  { formula: 'H2O', name: 'vann', group: 16, period: 2, bp: 100.0, polar: true, hbond: true },
  { formula: 'H2S', name: 'hydrogensulfid', group: 16, period: 3, bp: -60.3, polar: true, hbond: false },
  { formula: 'H2Se', name: 'hydrogenselenid', group: 16, period: 4, bp: -41.3, polar: true, hbond: false },
  { formula: 'H2Te', name: 'hydrogentellurid', group: 16, period: 5, bp: -2.2, polar: true, hbond: false },
  { formula: 'HF', name: 'hydrogenfluorid', group: 17, period: 2, bp: 19.5, polar: true, hbond: true },
  { formula: 'HCl', name: 'hydrogenklorid', group: 17, period: 3, bp: -85.1, polar: true, hbond: false },
  { formula: 'HBr', name: 'hydrogenbromid', group: 17, period: 4, bp: -66.8, polar: true, hbond: false },
  { formula: 'HI', name: 'hydrogenjodid', group: 17, period: 5, bp: -35.4, polar: true, hbond: false },
];

export interface Alkane {
  formula: string;
  name: string;
  carbons: number;
  /** Kokepunkt ved 1 atm (°C), CRC Handbook. */
  bp: number;
}

/** Rettkjedede alkaner C₁–C₈ (CRC Handbook). Alle er upolare: bare London-krefter. */
export const ALKANES: Alkane[] = [
  { formula: 'CH4', name: 'metan', carbons: 1, bp: -161.5 },
  { formula: 'C2H6', name: 'etan', carbons: 2, bp: -88.6 },
  { formula: 'C3H8', name: 'propan', carbons: 3, bp: -42.1 },
  { formula: 'C4H10', name: 'butan', carbons: 4, bp: -0.5 },
  { formula: 'C5H12', name: 'pentan', carbons: 5, bp: 36.1 },
  { formula: 'C6H14', name: 'heksan', carbons: 6, bp: 68.7 },
  { formula: 'C7H16', name: 'heptan', carbons: 7, bp: 98.4 },
  { formula: 'C8H18', name: 'oktan', carbons: 8, bp: 125.6 },
];

/** Antall elektroner i et molekyl (summen av protontallene). Alle hydridene i samme periode har like mange. */
export function electronCount(f: string): number {
  return Object.entries(formula(f).atoms).reduce((s, [sym, n]) => s + element(sym).Z * n, 0);
}

export function hydridesInGroup(group: number): Hydride[] {
  return HYDRIDES.filter((h) => h.group === group).sort((a, b) => a.period - b.period);
}

/**
 * Anslått kokepunkt (°C) for hydridet i periode 2 uten hydrogenbindinger: rett linje (minste kvadraters metode)
 * gjennom periode 3–5 i samme gruppe, forlenget til periode 2. Gir ca. −93 °C for vann (målt: 100 °C).
 */
export function trendEstimate(group: number, period = 2): number {
  const pts = hydridesInGroup(group).filter((h) => h.period >= 3);
  const mx = pts.reduce((s, h) => s + h.period, 0) / pts.length;
  const my = pts.reduce((s, h) => s + h.bp, 0) / pts.length;
  const sxy = pts.reduce((s, h) => s + (h.period - mx) * (h.bp - my), 0);
  const sxx = pts.reduce((s, h) => s + (h.period - mx) ** 2, 0);
  return my + (sxy / sxx) * (period - mx);
}

export interface ForceParts {
  /** Bidrag til kokepunktet i kelvin fra hver type krefter (grov modell, se forceParts). */
  london: number;
  dipole: number;
  hbond: number;
}

export interface ForceSwitches {
  london: boolean;
  dipole: boolean;
  hbond: boolean;
}

/**
 * Grov oppdeling av kokepunktet (i kelvin) etter hvilke krefter som holder molekylene sammen. Kokepunktet i kelvin er
 * omtrent proporsjonalt med fordampningsvarmen (Troutons regel, ΔH ≈ 88 J/(mol·K) · T), så bidragene kan legges
 * sammen:
 * - London: kokepunktet til det upolare gruppe 14-hydridet i samme periode (like mange elektroner).
 * - Dipol-dipol: resten opp til det målte kokepunktet (periode 3–5), eller opp til trendlinja (periode 2).
 * - Hydrogenbindinger: det målte kokepunktet minus trendlinja, bare for NH₃, H₂O og HF.
 */
export function forceParts(h: Hydride): ForceParts {
  const ref = HYDRIDES.find((x) => x.group === 14 && x.period === h.period)!;
  const london = ref.bp + KELVIN;
  if (h.group === 14) return { london: h.bp + KELVIN, dipole: 0, hbond: 0 };
  const withoutH = h.hbond ? trendEstimate(h.group, h.period) : h.bp;
  return { london, dipole: withoutH + KELVIN - london, hbond: h.hbond ? h.bp - withoutH : 0 };
}

/** Alkaner er upolare: hele kokepunktet skyldes London-krefter. */
export function alkaneParts(a: Alkane): ForceParts {
  return { london: a.bp + KELVIN, dipole: 0, hbond: 0 };
}

/**
 * Kokepunktet (°C) i modellen når bare de valgte kreftene virker. null når ingen krefter holder molekylene sammen
 * (da blir stoffet aldri flytende).
 */
export function modelBoilingPoint(parts: ForceParts, on: ForceSwitches): number | null {
  const T = (on.london ? parts.london : 0) + (on.dipole ? parts.dipole : 0) + (on.hbond ? parts.hbond : 0);
  return T > 0.5 ? T - KELVIN : null;
}

/**
 * Flytter etiketter (y-verdier) fra hverandre så de står minst `gap` fra hverandre, innenfor [lo, hi], og beholder
 * rekkefølgen. Gir de nye verdiene i samme rekkefølge som inn. (Ren layout-hjelper for grafer med mange linjer.)
 */
export function spreadLabels(ys: readonly number[], gap: number, lo = -Infinity, hi = Infinity): number[] {
  const idx = ys.map((y, i) => ({ y: Number.isFinite(y) ? y : 0, i })).sort((a, b) => a.y - b.y);
  const out = idx.map((p) => p.y);
  for (let i = 0; i < out.length; i++) out[i] = Math.max(out[i]!, i === 0 ? lo : out[i - 1]! + gap);
  for (let i = out.length - 1; i >= 0; i--) out[i] = Math.min(out[i]!, i === out.length - 1 ? hi : out[i + 1]! - gap);
  for (let i = 0; i < out.length; i++) out[i] = Math.max(out[i]!, i === 0 ? lo : out[i - 1]! + gap);
  const res: number[] = new Array(ys.length);
  idx.forEach((p, j) => (res[p.i] = out[j]!));
  return res;
}
