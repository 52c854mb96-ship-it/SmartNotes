/** Ren kjemi for kapittel 1 Kjemiske bindinger (ingen React), så den kan testes for seg. */
import { element, isMetal, type Element } from '../kit/grunnstoffer';
import { formula } from '../kit/formel';

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
