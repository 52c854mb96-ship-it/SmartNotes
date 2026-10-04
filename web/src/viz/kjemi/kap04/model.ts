/**
 * Ren kjemi for kapittel 4 Termokjemi (ingen React), så den kan testes for seg: entalpidiagram, bindingsentalpier,
 * kalorimetri og Hess' lov. Fortegn som i Kjemi 1: ΔH < 0 er eksoterm (systemet avgir varme til omgivelsene).
 *
 * Kilder for ΔH: standard dannelsesentalpier ved 25 °C (Aylward og Findlay, «SI Chemical Data», og CRC Handbook of
 * Chemistry and Physics), avrundet som i lærebøkene: ΔfH(CO₂) = −393,5, ΔfH(H₂O, l) = −285,8, ΔfH(H₂O, g) = −241,8,
 * ΔfH(CH₄) = −74,8, ΔfH(NH₃) = −45,9, ΔfH(HCl) = −92,3, ΔfH(CO) = −110,5, ΔfH(SO₂) = −296,8, ΔfH(SO₃, g) = −395,7,
 * ΔfH(H₂O₂, l) = −187,8, ΔfH(CaCO₃) = −1207, ΔfH(CaO) = −635 kJ/mol.
 */
import { formula, molarMass, reaction, type Reaction, type Term } from '../kit/formel';

/** Formelen uten tilstand: «H2O(l)» → «H2O». */
export const bare = (f: string): string => f.replace(/\((aq|s|l|g)\)$/i, '').trim();

/* ====================================================================== */
/* Entalpidiagram (Entalpidiagram.tsx)                                     */
/* ====================================================================== */

export interface EnthalpyPreset {
  id: string;
  /** Navn i nedtrekkslista (ren tekst). */
  name: string;
  /** Likningen med tilstander. ΔH gjelder for formelomsetningen slik den står. */
  equation: string;
  /** Reaksjonsentalpi (kJ). */
  dH: number;
  /** Stoffet ΔH per gram regnes for. */
  perGram: string;
  /**
   * Aktiveringsenergi (kJ/mol). Bare når `eaKnown` er satt, er tallet en litteraturverdi som vises; ellers er det et
   * skjematisk anslag som bare bestemmer formen på kurven (Eₐ for slike reaksjoner er ikke én veldefinert verdi).
   */
  ea: number;
  eaKnown: boolean;
  /** Katalysator (navn i setning) og Eₐ med katalysator. */
  catalyst?: { name: string; ea: number; known: boolean };
  /** Én til to setninger om reaksjonen. */
  note: string;
}

export const ENTHALPY_PRESETS: EnthalpyPreset[] = [
  {
    id: 'metan',
    name: 'Forbrenning av metan',
    equation: 'CH4(g) + 2 O2(g) → CO2(g) + 2 H2O(l)',
    dH: -890,
    perGram: 'CH4',
    ea: 420,
    eaKnown: false,
    catalyst: { name: 'platina', ea: 200, known: false },
    note: 'Naturgass brenner ikke før den tennes. En gnist gir de første molekylene nok energi til å komme over aktiveringsenergien, og etterpå holder varmen fra reaksjonen den i gang.',
  },
  {
    id: 'vann',
    name: 'Dannelse av vann',
    equation: 'H2(g) + ½ O2(g) → H2O(l)',
    dH: -286,
    perGram: 'H2',
    ea: 180,
    eaKnown: false,
    catalyst: { name: 'platina', ea: 70, known: false },
    note: 'Hydrogen og oksygen kan stå blandet uten å reagere. En gnist, eller litt platina som katalysator, setter i gang reaksjonen. Hydrogen gir mest energi per gram av alle brensler.',
  },
  {
    id: 'peroksid',
    name: 'Spalting av hydrogenperoksid',
    equation: '2 H2O2(l) → 2 H2O(l) + O2(g)',
    dH: -196,
    perGram: 'H2O2',
    // Omtrentlige litteraturverdier: ca. 75 kJ/mol uten katalysator og ca. 56 kJ/mol med jodid (verdiene varierer litt mellom kilder).
    ea: 75,
    eaKnown: true,
    catalyst: { name: 'jodidioner', ea: 56, known: true },
    note: 'Hydrogenperoksid spaltes svært sakte av seg selv. Med jodidioner, eller enzymet katalase i levercellene, går det raskt og skummer av oksygen.',
  },
  {
    id: 'ammoniakk',
    name: 'Ammoniakksyntesen',
    equation: 'N2(g) + 3 H2(g) → 2 NH3(g)',
    dH: -92,
    perGram: 'NH3',
    ea: 230,
    eaKnown: false,
    catalyst: { name: 'jern', ea: 110, known: false },
    note: 'Trippelbindingen i N₂ er svært sterk, så aktiveringsenergien er høy. I Haber–Bosch-prosessen brukes jern som katalysator.',
  },
  {
    id: 'ammoniumnitrat',
    name: 'Oppløsning av ammoniumnitrat',
    equation: 'NH4NO3(s) → NH4^+(aq) + NO3^-(aq)',
    dH: 25.7,
    perGram: 'NH4NO3',
    ea: 38,
    eaKnown: false,
    note: 'Ammoniumnitrat brukes i kuldeposer: når saltet løses, tas varme fra vannet, og posen blir kald.',
  },
  {
    id: 'kalk',
    name: 'Spalting av kalsiumkarbonat',
    equation: 'CaCO3(s) → CaO(s) + CO2(g)',
    dH: 178,
    perGram: 'CaCO3',
    ea: 225,
    eaKnown: false,
    note: 'Kalkbrenning: kalkstein må varmes til rundt 900 °C for å spaltes til brent kalk og karbondioksid.',
  },
  {
    id: 'fotosyntese',
    name: 'Fotosyntesen',
    equation: '6 CO2(g) + 6 H2O(l) → C6H12O6(s) + 6 O2(g)',
    dH: 2803,
    perGram: 'C6H12O6',
    ea: 3250,
    eaKnown: false,
    catalyst: { name: 'enzymer', ea: 3000, known: false },
    note: 'Fotosyntesen er den omvendte reaksjonen av forbrenning av glukose. Den skjer i mange trinn som drives av lysenergi, så toppen i diagrammet er bare skjematisk.',
  },
];

export const CUSTOM_ID = 'egen';

export type EnthalpyKind = 'eksoterm' | 'endoterm' | 'termonøytral';

export function enthalpyKind(dH: number): EnthalpyKind {
  return dH < 0 ? 'eksoterm' : dH > 0 ? 'endoterm' : 'termonøytral';
}

/** Minste avstand (kJ) fra det høyeste av start- og sluttnivået opp til toppen. */
export const EA_MARGIN = 10;

/** Eₐ må nå over både reaktantene og produktene: Eₐ ≥ ΔH + margin for en endoterm reaksjon. */
export function validEa(dH: number, ea: number): number {
  return Math.max(ea, Math.max(0, dH) + EA_MARGIN);
}

/** Skjematisk Eₐ med katalysator: halve høyden over det høyeste av start- og sluttnivået. */
export function catalysedEa(dH: number, ea: number): number {
  const base = Math.max(0, dH);
  return base + 0.5 * (validEa(dH, ea) - base);
}

/** Aktiveringsenergien for den motsatte reaksjonen: Eₐ(bakover) = Eₐ − ΔH. */
export function reverseEa(dH: number, ea: number): number {
  return ea - dH;
}

export interface PathPoint {
  /** Reaksjonsforløp 0–1. */
  x: number;
  /** Entalpi i forhold til reaktantene (kJ). */
  H: number;
}

/**
 * Kontrollpunktene for entalpikurven. Uten katalysator én topp (overgangstilstanden). Med katalysator en annen
 * reaksjonsvei med to lavere topper og et mellomprodukt imellom; den høyeste toppen er `eaCat` over reaktantene.
 */
export function pathPoints(dH: number, ea: number, eaCat?: number): PathPoint[] {
  const top = validEa(dH, ea);
  if (eaCat === undefined)
    return [
      { x: 0, H: 0 },
      { x: 0.14, H: 0 },
      { x: 0.48, H: top },
      { x: 0.86, H: dH },
      { x: 1, H: dH },
    ];
  const base = Math.max(0, dH);
  const t = Math.min(top, Math.max(eaCat, base + EA_MARGIN / 2));
  const valley = dH / 2 + 0.3 * (t - base);
  const peak2 = Math.min(t - 0.05 * (t - base), Math.max(valley + 0.7 * (t - valley), base + 0.5 * (t - base)));
  return [
    { x: 0, H: 0 },
    { x: 0.14, H: 0 },
    { x: 0.34, H: t },
    { x: 0.5, H: valley },
    { x: 0.66, H: peak2 },
    { x: 0.86, H: dH },
    { x: 1, H: dH },
  ];
}

/** Entalpien langs kurven ved forløp x (0–1): myk overgang (cosinus) mellom kontrollpunktene, flat i hvert punkt. */
export function pathH(points: readonly PathPoint[], x: number): number {
  const xc = Math.min(1, Math.max(0, x));
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i]!;
    const b = points[i + 1]!;
    if (xc <= b.x) {
      const u = b.x > a.x ? (xc - a.x) / (b.x - a.x) : 1;
      return a.H + (b.H - a.H) * (1 - Math.cos(Math.PI * u)) * 0.5;
    }
  }
  return points[points.length - 1]!.H;
}

/** ΔH per gram av et stoff i likningen (kJ/g): ΔH / (koeffisient · M). */
export function perGram(equation: string, dH: number, species: string): number {
  const rx = reaction(equation);
  const t = [...rx.reactants, ...rx.products].find((x) => bare(x.formula) === species);
  if (!t) return Number.NaN;
  return dH / (t.coef * molarMass(formula(t.formula)));
}

/* ====================================================================== */
/* Bindingsentalpi (Bindingsentalpi.tsx)                                   */
/* ====================================================================== */

/**
 * Gjennomsnittlige bindingsentalpier (kJ/mol) for gasser, som i tabellene i Kjemi 1 og i «SI Chemical Data»
 * (Aylward og Findlay). C=O-verdien 799 kJ/mol gjelder CO₂ (gjennomsnittet for C=O i andre stoffer er lavere, ca. 745).
 */
export const BOND_ENTHALPY = {
  'H–H': 436,
  'Cl–Cl': 242,
  'H–Cl': 431,
  'C–H': 413,
  'O=O': 498,
  'C=O': 799,
  'O–H': 463,
  'N≡N': 945,
  'N–H': 391,
} as const;

export type BondKey = keyof typeof BOND_ENTHALPY;
export type BondOrder = 1 | 2 | 3;

const ORDER_SIGN: Record<BondOrder, string> = { 1: '–', 2: '=', 3: '≡' };

/** Navnet på bindingen i tabellen, uansett rekkefølge på atomene: bondKey('Cl', 'H', 1) → «H–Cl». */
export function bondKey(a: string, b: string, order: BondOrder): BondKey {
  const k1 = `${a}${ORDER_SIGN[order]}${b}`;
  const k2 = `${b}${ORDER_SIGN[order]}${a}`;
  if (k1 in BOND_ENTHALPY) return k1 as BondKey;
  if (k2 in BOND_ENTHALPY) return k2 as BondKey;
  throw new Error(`Mangler bindingsentalpi for ${k1}`);
}

/**
 * Molekylene som strukturformler: et sentralatom med ligander (retning i figuren, y nedover, og bindingsorden).
 * Toatomige molekyler har ett ligandatom. Vinklene er de virkelige der det går i 2D (H₂O 104,5°).
 */
export interface MoleculeTemplate {
  center: string;
  ligands: { el: string; dx: number; dy: number; order: BondOrder }[];
}

const s52 = Math.sin((52.25 * Math.PI) / 180);
const c52 = Math.cos((52.25 * Math.PI) / 180);

export const MOLECULES: Record<string, MoleculeTemplate> = {
  H2: { center: 'H', ligands: [{ el: 'H', dx: 1, dy: 0, order: 1 }] },
  Cl2: { center: 'Cl', ligands: [{ el: 'Cl', dx: 1, dy: 0, order: 1 }] },
  HCl: { center: 'H', ligands: [{ el: 'Cl', dx: 1, dy: 0, order: 1 }] },
  O2: { center: 'O', ligands: [{ el: 'O', dx: 1, dy: 0, order: 2 }] },
  N2: { center: 'N', ligands: [{ el: 'N', dx: 1, dy: 0, order: 3 }] },
  H2O: {
    center: 'O',
    ligands: [
      { el: 'H', dx: -s52, dy: c52, order: 1 },
      { el: 'H', dx: s52, dy: c52, order: 1 },
    ],
  },
  NH3: {
    center: 'N',
    ligands: [
      { el: 'H', dx: -0.87, dy: 0.5, order: 1 },
      { el: 'H', dx: 0.87, dy: 0.5, order: 1 },
      { el: 'H', dx: 0, dy: -1, order: 1 },
    ],
  },
  CH4: {
    center: 'C',
    ligands: [
      { el: 'H', dx: -0.71, dy: -0.71, order: 1 },
      { el: 'H', dx: 0.71, dy: -0.71, order: 1 },
      { el: 'H', dx: -0.71, dy: 0.71, order: 1 },
      { el: 'H', dx: 0.71, dy: 0.71, order: 1 },
    ],
  },
  CO2: {
    center: 'C',
    ligands: [
      { el: 'O', dx: -1, dy: 0, order: 2 },
      { el: 'O', dx: 1, dy: 0, order: 2 },
    ],
  },
};

export function moleculeTemplate(f: string): MoleculeTemplate {
  const t = MOLECULES[bare(f)];
  if (!t) throw new Error(`Mangler strukturformel for ${f}`);
  return t;
}

export interface BondReaction {
  id: string;
  name: string;
  /** Alle stoffene er gasser, som bindingsentalpiene gjelder for. */
  equation: string;
  /** Tabellverdi for ΔH med vann som gass (fra dannelsesentalpier). */
  tabulated: number;
  /** ΔH når vannet er væske, hvis det dannes vann. */
  liquid?: number;
}

export const BOND_REACTIONS: BondReaction[] = [
  { id: 'hcl', name: 'Hydrogen + klor', equation: 'H2(g) + Cl2(g) → 2 HCl(g)', tabulated: -184.6 },
  { id: 'metan', name: 'Forbrenning av metan', equation: 'CH4(g) + 2 O2(g) → CO2(g) + 2 H2O(g)', tabulated: -802.3, liquid: -890.3 },
  { id: 'ammoniakk', name: 'Ammoniakksyntesen', equation: 'N2(g) + 3 H2(g) → 2 NH3(g)', tabulated: -91.8 },
  { id: 'vann', name: 'Hydrogen + oksygen', equation: '2 H2(g) + O2(g) → 2 H2O(g)', tabulated: -483.6, liquid: -571.6 },
];

export interface BondTally {
  bond: BondKey;
  count: number;
  /** Bindingsentalpi per mol bindinger. */
  each: number;
  /** count · each (kJ). */
  energy: number;
}

/** Bindingene i stoffene (koeffisient · bindinger per molekyl), slått sammen per bindingstype. */
export function bondTally(terms: readonly Term[]): BondTally[] {
  const map = new Map<BondKey, number>();
  for (const t of terms) {
    const m = moleculeTemplate(t.formula);
    for (const l of m.ligands) {
      const k = bondKey(m.center, l.el, l.order);
      map.set(k, (map.get(k) ?? 0) + t.coef);
    }
  }
  return [...map].map(([bond, count]) => ({ bond, count, each: BOND_ENTHALPY[bond], energy: count * BOND_ENTHALPY[bond] }));
}

export interface BondEstimate {
  broken: BondTally[];
  formed: BondTally[];
  /** Energi som må tilføres for å bryte alle bindingene i reaktantene (kJ, positiv). */
  sumBroken: number;
  /** Energi som frigjøres når bindingene i produktene dannes (kJ, positiv). */
  sumFormed: number;
  /** ΔH ≈ Σ brutte − Σ dannede (kJ). */
  dH: number;
}

export function bondEstimate(rx: Reaction): BondEstimate {
  const broken = bondTally(rx.reactants);
  const formed = bondTally(rx.products);
  const sumBroken = broken.reduce((s, b) => s + b.energy, 0);
  const sumFormed = formed.reduce((s, b) => s + b.energy, 0);
  return { broken, formed, sumBroken, sumFormed, dH: sumBroken - sumFormed };
}

/* ====================================================================== */
/* Kalorimetri (Kalorimetri.tsx)                                           */
/* ====================================================================== */

/** Spesifikk varmekapasitet for vann og fortynnede løsninger, J/(g · °C). */
export const C_WATER = 4.18;
/** Starttemperatur (romtemperatur), °C. */
export const T_START = 20;
/** Tidskonstant for at saltet løses / løsningene blandes (s). */
export const TAU_MIX = 15;
/** Varmeutveksling med omgivelsene gjennom koppen (per sekund) når varmetap er slått på. */
export const K_LOSS = 0.004;
/** Hvor lenge målingen varer (s). */
export const T_END = 300;
/** Konsentrasjonen av saltsyren og natronluten (mol/L). */
export const C_ACID_BASE = 1.0;

export interface CalProcess {
  id: string;
  name: string;
  kind: 'salt' | 'noytralisering';
  /** Saltet som løses (bare for kind = salt). */
  salt?: string;
  /**
   * ΔH per mol (kJ/mol): løsningsentalpi ved uendelig fortynning, 25 °C (CRC Handbook, «Enthalpy of solution of
   * electrolytes»), og nøytralisasjonsentalpi for sterk syre + sterk base (−57 kJ per mol vann, som i Kjemi 1).
   */
  dH: number;
  equation: string;
}

export const CAL_PROCESSES: CalProcess[] = [
  { id: 'naoh', name: 'Natriumhydroksid løses', kind: 'salt', salt: 'NaOH', dH: -44.5, equation: 'NaOH(s) → Na^+(aq) + OH^-(aq)' },
  { id: 'cacl2', name: 'Kalsiumklorid løses', kind: 'salt', salt: 'CaCl2', dH: -81.3, equation: 'CaCl2(s) → Ca^2+(aq) + 2 Cl^-(aq)' },
  { id: 'nh4no3', name: 'Ammoniumnitrat løses', kind: 'salt', salt: 'NH4NO3', dH: 25.7, equation: 'NH4NO3(s) → NH4^+(aq) + NO3^-(aq)' },
  { id: 'kno3', name: 'Kaliumnitrat løses', kind: 'salt', salt: 'KNO3', dH: 34.9, equation: 'KNO3(s) → K^+(aq) + NO3^-(aq)' },
  { id: 'noytralisering', name: 'Saltsyre + natronlut', kind: 'noytralisering', dH: -57, equation: 'HCl(aq) + NaOH(aq) → NaCl(aq) + H2O(l)' },
];

export interface CalInput {
  /** Masse salt (g). */
  mSalt: number;
  /** Volum vann (mL) som saltet løses i. */
  Vwater: number;
  /** Volum saltsyre og natronlut (mL), begge C_ACID_BASE mol/L. */
  Vacid: number;
  Vbase: number;
}

export interface CalResult {
  /** Stoffmengde som reagerer (mol salt, eller mol vann som dannes). */
  n: number;
  /** Massen som varmes opp/kjøles ned (g): vann + salt, eller begge løsningene (1,00 g/mL). */
  m: number;
  /** Varme reaksjonen avgir til løsningen (J): q = −n · ΔH. Positiv for eksoterme prosesser. */
  q: number;
  /** Temperaturendringen uten varmetap (°C): ΔT = q / (m · c). */
  dT: number;
  /** For nøytralisering: hva som er i overskudd. */
  excess: 'syre' | 'base' | null;
}

export function calorimetry(p: CalProcess, inp: CalInput): CalResult {
  if (p.kind === 'salt') {
    const M = molarMass(formula(p.salt!));
    const n = inp.mSalt / M;
    const m = inp.Vwater * 1.0 + inp.mSalt;
    const q = -n * p.dH * 1000;
    return { n, m, q, dT: q / (m * C_WATER), excess: null };
  }
  const nA = (C_ACID_BASE * inp.Vacid) / 1000;
  const nB = (C_ACID_BASE * inp.Vbase) / 1000;
  const n = Math.min(nA, nB);
  const m = (inp.Vacid + inp.Vbase) * 1.0;
  const q = -n * p.dH * 1000;
  const excess = Math.abs(nA - nB) < 1e-12 ? null : nA > nB ? 'syre' : 'base';
  return { n, m, q, dT: q / (m * C_WATER), excess };
}

/**
 * Temperaturendringen ved tiden t (s) etter blanding: varmen frigjøres gradvis (tidskonstant TAU_MIX), og med varmetap
 * utveksles varme med omgivelsene (Newtons avkjølingslov). Løsningen av dθ/dt = θ₀ a e^(−at) − kθ, θ(0) = 0:
 * θ(t) = θ₀ · a/(k − a) · (e^(−at) − e^(−kt)), og uten varmetap θ(t) = θ₀ (1 − e^(−at)).
 */
export function deltaTAt(t: number, dTideal: number, heatLoss: boolean): number {
  const a = 1 / TAU_MIX;
  if (t <= 0) return 0;
  if (!heatLoss) return dTideal * (1 - Math.exp(-a * t));
  const k = K_LOSS;
  return ((dTideal * a) / (k - a)) * (Math.exp(-a * t) - Math.exp(-k * t));
}

/** Største temperaturendring i måleperioden (den man leser av) og når den kommer. */
export function measuredDeltaT(dTideal: number, heatLoss: boolean): { dT: number; t: number } {
  if (!heatLoss) return { dT: deltaTAt(T_END, dTideal, false), t: T_END };
  const a = 1 / TAU_MIX;
  const k = K_LOSS;
  const t = Math.min(T_END, Math.log(a / k) / (a - k));
  return { dT: deltaTAt(t, dTideal, true), t };
}

/** ΔH beregnet fra målingen (kJ/mol): ΔH = −m · c · ΔT / n. */
export function dHFromMeasurement(m: number, dT: number, n: number): number {
  return n > 0 ? (-m * C_WATER * dT) / n / 1000 : Number.NaN;
}

/* ====================================================================== */
/* Hess' lov (Hess.tsx)                                                    */
/* ====================================================================== */

export interface ThermoEquation {
  reactants: Term[];
  products: Term[];
  /** ΔH (kJ) for likningen slik den står. */
  dH: number;
}

const thermo = (text: string, dH: number): ThermoEquation => {
  const r = reaction(text);
  return { reactants: r.reactants, products: r.products, dH };
};

export interface HessChoice {
  reverse: boolean;
  factor: number;
}

export interface HessExample {
  id: string;
  name: string;
  target: ThermoEquation;
  given: ThermoEquation[];
  solution: HessChoice[];
  note: string;
}

export const HESS_FACTORS = [0.5, 1, 2] as const;

export const HESS_EXAMPLES: HessExample[] = [
  {
    id: 'co',
    name: 'Karbonmonoksid fra karbon',
    target: thermo('C(s) + ½ O2(g) → CO(g)', -110.5),
    given: [thermo('C(s) + O2(g) → CO2(g)', -393.5), thermo('CO(g) + ½ O2(g) → CO2(g)', -283.0)],
    solution: [
      { reverse: false, factor: 1 },
      { reverse: true, factor: 1 },
    ],
    note: 'ΔH for C + ½ O₂ → CO kan ikke måles direkte, fordi karbon som brenner med lite oksygen alltid gir litt CO₂ også.',
  },
  {
    id: 'metan',
    name: 'Metan fra karbon og hydrogen',
    target: thermo('C(s) + 2 H2(g) → CH4(g)', -74.8),
    given: [thermo('C(s) + O2(g) → CO2(g)', -393.5), thermo('H2(g) + ½ O2(g) → H2O(l)', -285.8), thermo('CH4(g) + 2 O2(g) → CO2(g) + 2 H2O(l)', -890.3)],
    solution: [
      { reverse: false, factor: 1 },
      { reverse: false, factor: 2 },
      { reverse: true, factor: 1 },
    ],
    note: 'Karbon og hydrogen reagerer ikke til metan i et kalorimeter, men alle tre forbrenningsentalpiene kan måles.',
  },
  {
    id: 'so3',
    name: 'Svoveltrioksid fra svovel',
    target: thermo('S(s) + 3/2 O2(g) → SO3(g)', -395.7),
    given: [thermo('S(s) + O2(g) → SO2(g)', -296.8), thermo('2 SO2(g) + O2(g) → 2 SO3(g)', -197.8)],
    solution: [
      { reverse: false, factor: 1 },
      { reverse: false, factor: 0.5 },
    ],
    note: 'Svovel brenner til SO₂. Videre til SO₃ (råstoff for svovelsyre) går det bare med katalysator.',
  },
];

/** Likningen snudd og/eller ganget med en faktor: snur du, skifter ΔH fortegn; ganger du, ganges ΔH med det samme. */
export function scaleEquation(eq: ThermoEquation, c: HessChoice): ThermoEquation {
  const mul = (ts: Term[]) => ts.map((t) => ({ ...t, coef: round9(t.coef * c.factor) }));
  return c.reverse
    ? { reactants: mul(eq.products), products: mul(eq.reactants), dH: round9(-eq.dH * c.factor) }
    : { reactants: mul(eq.reactants), products: mul(eq.products), dH: round9(eq.dH * c.factor) };
}

const round9 = (v: number) => Math.round(v * 1e9) / 1e9;

/** Netto endring per stoff: produkter positive, reaktanter negative. Stoffene skilles på formel med tilstand. */
export function netChange(eqs: readonly ThermoEquation[]): Map<string, number> {
  const net = new Map<string, number>();
  for (const e of eqs) {
    for (const t of e.reactants) net.set(t.formula, round9((net.get(t.formula) ?? 0) - t.coef));
    for (const t of e.products) net.set(t.formula, round9((net.get(t.formula) ?? 0) + t.coef));
  }
  return net;
}

/** Likningen som tilsvarer en netto endring (stoffer med 0 er strøket). */
export function netEquation(net: Map<string, number>): { reactants: Term[]; products: Term[] } {
  const reactants: Term[] = [];
  const products: Term[] = [];
  for (const [f, v] of net) {
    if (v < -1e-9) reactants.push({ coef: -v, formula: f });
    else if (v > 1e-9) products.push({ coef: v, formula: f });
  }
  return { reactants, products };
}

export function sameReaction(a: Map<string, number>, b: Map<string, number>): boolean {
  const keys = new Set([...a.keys(), ...b.keys()]);
  for (const k of keys) if (Math.abs((a.get(k) ?? 0) - (b.get(k) ?? 0)) > 1e-9) return false;
  return true;
}

export interface HessSum {
  scaled: ThermoEquation[];
  /** Alle reaktantene og produktene før noe strykes. */
  allLeft: Term[];
  allRight: Term[];
  /** Det som står på begge sider og strykes (mengden som strykes på hver side). */
  cancelled: Term[];
  net: { reactants: Term[]; products: Term[] };
  dH: number;
  matches: boolean;
}

function gather(ts: Term[][]): Term[] {
  const map = new Map<string, number>();
  for (const list of ts) for (const t of list) map.set(t.formula, round9((map.get(t.formula) ?? 0) + t.coef));
  return [...map].map(([f, coef]) => ({ formula: f, coef }));
}

/** Summen av de valgte (snudde og skalerte) likningene, med det som strykes, og om den gir målreaksjonen. */
export function hessSum(ex: HessExample, choices: readonly HessChoice[]): HessSum {
  const scaled = ex.given.map((g, i) => scaleEquation(g, choices[i] ?? { reverse: false, factor: 1 }));
  const allLeft = gather(scaled.map((e) => e.reactants));
  const allRight = gather(scaled.map((e) => e.products));
  const cancelled = allLeft
    .map((l) => ({ formula: l.formula, coef: Math.min(l.coef, allRight.find((r) => r.formula === l.formula)?.coef ?? 0) }))
    .filter((t) => t.coef > 1e-9);
  const net = netChange(scaled);
  const dH = round9(scaled.reduce((s, e) => s + e.dH, 0));
  return { scaled, allLeft, allRight, cancelled, net: netEquation(net), dH, matches: sameReaction(net, netChange([ex.target])) };
}

export interface StairLevel {
  /** Entalpi i forhold til startnivået (kJ). */
  H: number;
  /** Stoffene som finnes på dette nivået (inkludert «tilskuere» som O₂ som trengs senere). */
  species: Term[];
}

/**
 * Energitrappa: startnivået er målreaksjonens reaktanter pluss de stoffene som trengs underveis (f.eks. ekstra O₂),
 * og hvert trinn legger til én av de valgte likningene. Alle mengdene er ikke-negative, som i lærebokas diagrammer.
 */
export function staircase(ex: HessExample, choices: readonly HessChoice[]): StairLevel[] {
  const scaled = ex.given.map((g, i) => scaleEquation(g, choices[i] ?? { reverse: false, factor: 1 }));
  const start = new Map<string, number>();
  for (const t of ex.target.reactants) start.set(t.formula, t.coef);
  const cumulative: Map<string, number>[] = [new Map()];
  for (let i = 0; i < scaled.length; i++) cumulative.push(netChange(scaled.slice(0, i + 1)));
  // Tilskuere: det som må være med fra start for at ingen mengde blir negativ underveis.
  const extra = new Map<string, number>();
  for (const c of cumulative)
    for (const [f, v] of c) {
      const have = (start.get(f) ?? 0) + v;
      if (have < -1e-9) extra.set(f, Math.max(extra.get(f) ?? 0, -have));
    }
  let H = 0;
  return cumulative.map((c, i) => {
    if (i > 0) H = round9(H + scaled[i - 1]!.dH);
    const amounts = new Map<string, number>();
    for (const [f, v] of start) amounts.set(f, v);
    for (const [f, v] of extra) amounts.set(f, round9((amounts.get(f) ?? 0) + v));
    for (const [f, v] of c) amounts.set(f, round9((amounts.get(f) ?? 0) + v));
    const species = [...amounts].filter(([, v]) => v > 1e-9).map(([f, coef]) => ({ formula: f, coef }));
    return { H, species };
  });
}
