/** Ren kjemi for kapittel 2 Egenskaper og reaksjoner (ingen React), så den kan testes for seg. */
import { ELEMENTS, type Element } from '../kit/grunnstoffer';
import { balanceCoefficients, formula, molarMass, type Reaction, type State } from '../kit/formel';

/* ---------- Periodiske trender (KM6) ---------- */

export type TrendProperty = 'radius' | 'ie' | 'en';

export interface PropertyInfo {
  name: string;
  /** Kort navn til knapper og akser. */
  short: string;
  unit: string;
  decimals: number;
  /** Datakilde (samme som kit-ets grunnstoffer.ts). */
  source: string;
}

export const PROPERTIES: Record<TrendProperty, PropertyInfo> = {
  radius: { name: 'Atomradius', short: 'Atomradius', unit: 'pm', decimals: 0, source: 'kovalent radius, Cordero mfl. (2008)' },
  ie: { name: 'Første ioniseringsenergi', short: 'Ioniseringsenergi', unit: 'kJ/mol', decimals: 0, source: 'NIST Atomic Spectra Database' },
  en: { name: 'Elektronegativitet', short: 'Elektronegativitet', unit: '', decimals: 2, source: 'Pauling-skalaen (Allred 1961, CRC)' },
};

/** Grunnstoffene i det lille periodesystemet: Z = 1–54 (periode 1–5). */
export const TREND_ELEMENTS: readonly Element[] = ELEMENTS.filter((e) => e.Z <= 54);

/** Verdien til en egenskap, eller null når den mangler (elektronegativitet for He, Ne og Ar). */
export function propertyValue(e: Element, p: TrendProperty): number | null {
  if (p === 'radius') return e.covalentRadius;
  if (p === 'ie') return e.ionizationEnergy;
  return e.electronegativity;
}

/** Laveste og høyeste verdi blant Z = 1–54. */
export function propertyRange(p: TrendProperty): [number, number] {
  const vs = TREND_ELEMENTS.map((e) => propertyValue(e, p)).filter((v): v is number => v !== null);
  return [Math.min(...vs), Math.max(...vs)];
}

/** Verdien skalert til 0–1 (for fargeskalaen), eller null. */
export function normalizedValue(e: Element, p: TrendProperty): number | null {
  const v = propertyValue(e, p);
  if (v === null) return null;
  const [lo, hi] = propertyRange(p);
  return hi > lo ? (v - lo) / (hi - lo) : 0;
}

/** Grunnstoffene bortover en periode (sortert etter Z) eller nedover en gruppe (sortert etter periode). */
export function periodSeries(period: number): Element[] {
  return TREND_ELEMENTS.filter((e) => e.period === period);
}

export function groupSeries(group: number): Element[] {
  return TREND_ELEMENTS.filter((e) => e.group === group).sort((a, b) => a.period - b.period);
}

/** Elektroner i det ytterste skallet (høyeste n). */
export function outerShellElectrons(e: Element): number {
  return e.shells[e.shells.length - 1] ?? 0;
}

/** Elektronene innenfor det ytterste skallet, som skjermer valenselektronene for kjerneladningen. */
export function innerElectrons(e: Element): number {
  return e.Z - outerShellElectrons(e);
}

/**
 * Kjerneladningen valenselektronene «merker» i den enkle skjermingsmodellen i Kjemi 1: Z minus de indre elektronene.
 * Na: 11 − 10 = +1, Cl: 17 − 10 = +7. (Elektronene i samme skall skjermer litt, så den virkelige effektive
 * kjerneladningen er lavere, men trenden er den samme.)
 */
export function shieldedCharge(e: Element): number {
  return e.Z - innerElectrons(e);
}

export type IeAnomaly = 'p-elektron' | 'paret' | null;

/**
 * Unntak fra trenden i ioniseringsenergi bortover en periode: lavere enn grunnstoffet før.
 * - Gruppe 13 (B, Al, Ga, In): det ytterste elektronet er alene i en p-orbital, med høyere energi enn s.
 * - Gruppe 16 (O, S, Se): det første parede p-elektronet frastøtes av partneren sin og er lettere å fjerne.
 */
export function ieAnomaly(e: Element): IeAnomaly {
  const prev = TREND_ELEMENTS.find((x) => x.Z === e.Z - 1);
  if (!prev || prev.period !== e.period || e.ionizationEnergy >= prev.ionizationEnergy) return null;
  if (e.group === 13) return 'p-elektron';
  if (e.group === 16) return 'paret';
  return null;
}

/* ---------- Redoks: metall i en løsning med metallioner (KM8) ---------- */

export interface RedoxMetal {
  symbol: string;
  name: string;
  /** Ladningen til ionet metallet danner. */
  charge: number;
  /** Standard reduksjonspotensial E° (V) for Mⁿ⁺/M ved 25 °C. Bestemmer plassen i spenningsrekka. */
  E0: number;
  /** Navnet på ionet og saltet i løsningen (nitrat, alle er lettløselige). */
  ionName: string;
  salt: string;
  saltName: string;
}

/**
 * Metallene i spenningsrekka, fra sterkest til svakest reduksjonsmiddel. E° fra standard tabeller (CRC Handbook,
 * «Electrochemical Series»): Mg −2,37, Al −1,66, Zn −0,76, Fe −0,44, Pb −0,13, Cu +0,34, Ag +0,80 V.
 */
export const REDOX_METALS: RedoxMetal[] = [
  { symbol: 'Mg', name: 'magnesium', charge: 2, E0: -2.37, ionName: 'magnesiumion', salt: 'Mg(NO3)2', saltName: 'magnesiumnitrat' },
  { symbol: 'Al', name: 'aluminium', charge: 3, E0: -1.66, ionName: 'aluminiumion', salt: 'Al(NO3)3', saltName: 'aluminiumnitrat' },
  { symbol: 'Zn', name: 'sink', charge: 2, E0: -0.76, ionName: 'sinkion', salt: 'Zn(NO3)2', saltName: 'sinknitrat' },
  { symbol: 'Fe', name: 'jern', charge: 2, E0: -0.44, ionName: 'jern(II)ion', salt: 'Fe(NO3)2', saltName: 'jern(II)nitrat' },
  { symbol: 'Pb', name: 'bly', charge: 2, E0: -0.13, ionName: 'bly(II)ion', salt: 'Pb(NO3)2', saltName: 'bly(II)nitrat' },
  { symbol: 'Cu', name: 'kobber', charge: 2, E0: 0.34, ionName: 'kobber(II)ion', salt: 'Cu(NO3)2', saltName: 'kobber(II)nitrat' },
  { symbol: 'Ag', name: 'sølv', charge: 1, E0: 0.8, ionName: 'sølvion', salt: 'AgNO3', saltName: 'sølvnitrat' },
];

export function redoxMetal(symbol: string): RedoxMetal {
  const m = REDOX_METALS.find((x) => x.symbol === symbol);
  if (!m) throw new Error(`Ukjent metall i spenningsrekka: ${symbol}`);
  return m;
}

/** Ioneformelen med ^ for ladningen: «Cu^2+», «Ag^+». */
export function ionOf(m: RedoxMetal): string {
  return `${m.symbol}^${m.charge === 1 ? '' : m.charge}+`;
}

const ROMAN = ['0', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII'];

/** Oksidasjonstall med romertall og fortegn, slik norske lærebøker skriver dem: 0, +II, −I. */
export function oxNumberText(n: number): string {
  if (n === 0) return '0';
  return `${n > 0 ? '+' : '−'}${ROMAN[Math.abs(n)] ?? String(Math.abs(n))}`;
}

const gcd = (a: number, b: number): number => (b === 0 ? Math.abs(a) : gcd(b, a % b));

export interface RedoxResult {
  metal: RedoxMetal;
  /** Metallet som ionet i løsningen tilhører. */
  ion: RedoxMetal;
  /** Samme metall som ionene i løsningen: ingen reaksjon å se. */
  same: boolean;
  /** Metallet står til venstre for ionets metall i spenningsrekka (lavere E°): reaksjon. */
  reacts: boolean;
  /** Koeffisientene i totallikningen: a M + b Xᵐ⁺ → a Mⁿ⁺ + b X. */
  a: number;
  b: number;
  /** Elektroner som overføres i totallikningen (a · n = b · m). */
  electrons: number;
  /** Halvreaksjonene og totalreaksjonen som tekst (kan tolkes med parseReaction). */
  oxidation: string;
  reduction: string;
  total: string;
}

/** Hva som skjer når metallet `metal` settes i en løsning med ioner av metallet `ion`. */
export function redox(metal: string, ion: string): RedoxResult {
  const M = redoxMetal(metal);
  const X = redoxMetal(ion);
  const same = M.symbol === X.symbol;
  const reacts = !same && M.E0 < X.E0;
  const g = gcd(M.charge, X.charge);
  const a = X.charge / g;
  const b = M.charge / g;
  const c = (n: number) => (n === 1 ? '' : `${n} `);
  const e = (n: number) => `${n} e-`;
  return {
    metal: M,
    ion: X,
    same,
    reacts,
    a,
    b,
    electrons: a * M.charge,
    oxidation: `${M.symbol}(s) → ${ionOf(M)}(aq) + ${e(M.charge)}`,
    reduction: `${ionOf(X)}(aq) + ${e(X.charge)} → ${X.symbol}(s)`,
    total: `${c(a)}${M.symbol}(s) + ${c(b)}${ionOf(X)}(aq) → ${c(a)}${ionOf(M)}(aq) + ${c(b)}${X.symbol}(s)`,
  };
}

/* ---------- Fellingsreaksjoner (KM8, KM14) ---------- */

export interface Ion {
  id: string;
  /** Formel med ^ for ladningen. */
  formula: string;
  name: string;
  charge: number;
  /** Løsningen ionet kommer fra: kationer som nitrat, anioner som natriumsalt (alle lettløselige). */
  salt: string;
  saltName: string;
}

export const CATIONS: Ion[] = [
  { id: 'Na', formula: 'Na^+', name: 'natriumion', charge: 1, salt: 'NaNO3', saltName: 'natriumnitrat' },
  { id: 'K', formula: 'K^+', name: 'kaliumion', charge: 1, salt: 'KNO3', saltName: 'kaliumnitrat' },
  { id: 'Ag', formula: 'Ag^+', name: 'sølvion', charge: 1, salt: 'AgNO3', saltName: 'sølvnitrat' },
  { id: 'Ba', formula: 'Ba^2+', name: 'bariumion', charge: 2, salt: 'Ba(NO3)2', saltName: 'bariumnitrat' },
  { id: 'Ca', formula: 'Ca^2+', name: 'kalsiumion', charge: 2, salt: 'Ca(NO3)2', saltName: 'kalsiumnitrat' },
  { id: 'Pb', formula: 'Pb^2+', name: 'bly(II)ion', charge: 2, salt: 'Pb(NO3)2', saltName: 'bly(II)nitrat' },
  { id: 'Cu', formula: 'Cu^2+', name: 'kobber(II)ion', charge: 2, salt: 'Cu(NO3)2', saltName: 'kobber(II)nitrat' },
  { id: 'Fe', formula: 'Fe^3+', name: 'jern(III)ion', charge: 3, salt: 'Fe(NO3)3', saltName: 'jern(III)nitrat' },
];

export const ANIONS: Ion[] = [
  { id: 'Cl', formula: 'Cl^-', name: 'kloridion', charge: -1, salt: 'NaCl', saltName: 'natriumklorid' },
  { id: 'NO3', formula: 'NO3^-', name: 'nitration', charge: -1, salt: 'NaNO3', saltName: 'natriumnitrat' },
  { id: 'SO4', formula: 'SO4^2-', name: 'sulfation', charge: -2, salt: 'Na2SO4', saltName: 'natriumsulfat' },
  { id: 'CO3', formula: 'CO3^2-', name: 'karbonation', charge: -2, salt: 'Na2CO3', saltName: 'natriumkarbonat' },
  { id: 'OH', formula: 'OH^-', name: 'hydroksidion', charge: -1, salt: 'NaOH', saltName: 'natriumhydroksid' },
  { id: 'I', formula: 'I^-', name: 'jodidion', charge: -1, salt: 'NaI', saltName: 'natriumjodid' },
];

export type SolubilityKind = 'løselig' | 'lite løselig' | 'tungtløselig' | 'reagerer';
export type PrecipitateColor = 'hvitt' | 'gult' | 'lysegult' | 'blått' | 'blågrønt' | 'rustbrunt' | 'brunt';

export interface Precipitate {
  formula: string;
  name: string;
  color: PrecipitateColor;
  /** Kationer og anioner som går med per formelenhet bunnfall (Ag₂O: 2 Ag⁺ og 2 OH⁻). */
  a: number;
  b: number;
  /** Løselighetsproduktet (25 °C), uttrykt med eksponentene `exps` på [kation] og [anion]. Mangler: går fullstendig. */
  ksp?: number;
  exps?: [number, number];
}

export interface PairInfo {
  kind: SolubilityKind;
  precipitate: Precipitate | null;
  /** Nettolikningen (ionelikningen), med tilstander. Mangler når ingenting skjer. */
  net: Reaction | null;
  /** Den fullstendige likningen med saltene. */
  full: Reaction | null;
  /** Løsningen får farge av et produkt (I₂ er brunt). */
  solutionColor?: 'brun';
  /** Gass som dannes (CO₂). */
  gas?: string;
  note?: string;
}

/**
 * Løselighetstabellen for parene (kation-id + anion-id). Ksp ved 25 °C fra CRC Handbook of Chemistry and Physics
 * («Solubility product constants»). Kategoriene følger løselighetstabellene i norske lærebøker: «lite løselig» er salter
 * som løses med noen gram per liter (Ag₂SO₄, CaSO₄, Ca(OH)₂, PbCl₂), «tungtløselig» er mye mindre.
 * Par som ikke står her, er løselige.
 */
const PRECIPITATES: Record<string, { kind: SolubilityKind; p: Precipitate | null; note?: string }> = {
  'Ag-Cl': { kind: 'tungtløselig', p: { formula: 'AgCl', name: 'sølvklorid', color: 'hvitt', a: 1, b: 1, ksp: 1.77e-10 } },
  'Ag-SO4': { kind: 'lite løselig', p: { formula: 'Ag2SO4', name: 'sølvsulfat', color: 'hvitt', a: 2, b: 1, ksp: 1.2e-5 } },
  'Ag-CO3': { kind: 'tungtløselig', p: { formula: 'Ag2CO3', name: 'sølvkarbonat', color: 'lysegult', a: 2, b: 1, ksp: 8.46e-12 } },
  'Ag-OH': {
    kind: 'tungtløselig',
    p: { formula: 'Ag2O', name: 'sølvoksid', color: 'brunt', a: 2, b: 2, ksp: 2.0e-8, exps: [1, 1] },
    note: 'Sølvhydroksid er ustabilt og går over til brunt sølvoksid og vann.',
  },
  'Ag-I': { kind: 'tungtløselig', p: { formula: 'AgI', name: 'sølvjodid', color: 'lysegult', a: 1, b: 1, ksp: 8.52e-17 } },
  'Ba-SO4': { kind: 'tungtløselig', p: { formula: 'BaSO4', name: 'bariumsulfat', color: 'hvitt', a: 1, b: 1, ksp: 1.08e-10 } },
  'Ba-CO3': { kind: 'tungtløselig', p: { formula: 'BaCO3', name: 'bariumkarbonat', color: 'hvitt', a: 1, b: 1, ksp: 2.58e-9 } },
  'Ca-SO4': { kind: 'lite løselig', p: { formula: 'CaSO4', name: 'kalsiumsulfat', color: 'hvitt', a: 1, b: 1, ksp: 4.93e-5 } },
  'Ca-CO3': { kind: 'tungtløselig', p: { formula: 'CaCO3', name: 'kalsiumkarbonat', color: 'hvitt', a: 1, b: 1, ksp: 3.36e-9 } },
  'Ca-OH': { kind: 'lite løselig', p: { formula: 'Ca(OH)2', name: 'kalsiumhydroksid', color: 'hvitt', a: 1, b: 2, ksp: 5.02e-6 } },
  'Pb-Cl': { kind: 'lite løselig', p: { formula: 'PbCl2', name: 'bly(II)klorid', color: 'hvitt', a: 1, b: 2, ksp: 1.7e-5 } },
  'Pb-SO4': { kind: 'tungtløselig', p: { formula: 'PbSO4', name: 'bly(II)sulfat', color: 'hvitt', a: 1, b: 1, ksp: 2.53e-8 } },
  'Pb-CO3': { kind: 'tungtløselig', p: { formula: 'PbCO3', name: 'bly(II)karbonat', color: 'hvitt', a: 1, b: 1, ksp: 7.4e-14 } },
  'Pb-OH': { kind: 'tungtløselig', p: { formula: 'Pb(OH)2', name: 'bly(II)hydroksid', color: 'hvitt', a: 1, b: 2, ksp: 1.43e-20 } },
  'Pb-I': { kind: 'tungtløselig', p: { formula: 'PbI2', name: 'bly(II)jodid', color: 'gult', a: 1, b: 2, ksp: 9.8e-9 } },
  'Cu-CO3': {
    kind: 'tungtløselig',
    p: { formula: 'CuCO3', name: 'kobber(II)karbonat', color: 'blågrønt', a: 1, b: 1, ksp: 1.4e-10 },
    note: 'Bunnfallet er egentlig et basisk kobberkarbonat, men skrives ofte som CuCO₃.',
  },
  'Cu-OH': { kind: 'tungtløselig', p: { formula: 'Cu(OH)2', name: 'kobber(II)hydroksid', color: 'blått', a: 1, b: 2, ksp: 2.2e-20 } },
  'Cu-I': {
    kind: 'reagerer',
    p: { formula: 'CuI', name: 'kobber(I)jodid', color: 'hvitt', a: 2, b: 4 },
    note: 'Cu²⁺ oksiderer jodid til jod (I₂), som farger løsningen brun. Bunnfallet er hvitt kobber(I)jodid.',
  },
  'Fe-CO3': {
    kind: 'reagerer',
    p: { formula: 'Fe(OH)3', name: 'jern(III)hydroksid', color: 'rustbrunt', a: 2, b: 3 },
    note: 'Jern(III)karbonat finnes ikke: karbonationene reagerer med vannet, og det dannes rustbrunt jern(III)hydroksid og CO₂-gass.',
  },
  'Fe-OH': { kind: 'tungtløselig', p: { formula: 'Fe(OH)3', name: 'jern(III)hydroksid', color: 'rustbrunt', a: 1, b: 3, ksp: 2.79e-39 } },
  'Fe-I': {
    kind: 'reagerer',
    p: null,
    note: 'Fe³⁺ oksiderer jodid til jod (I₂), som farger løsningen brun. Det blir ikke noe bunnfall.',
  },
};

const term = (coef: number, f: string, state: State) => ({ coef, formula: f, state });

/** Opplysningene om et par fra løselighetstabellen, med nettolikning og fullstendig likning. */
export function pairInfo(cationId: string, anionId: string): PairInfo {
  const cat = CATIONS.find((c) => c.id === cationId)!;
  const an = ANIONS.find((a) => a.id === anionId)!;
  const entry = PRECIPITATES[`${cationId}-${anionId}`];
  if (!entry) return { kind: 'løselig', precipitate: null, net: null, full: null };
  const key = `${cationId}-${anionId}`;
  // Spesialtilfellene har faste nettolikninger; resten balanseres automatisk. Den fullstendige likningen har saltene,
  // natriumnitrat og eventuelt vann på reaktantsiden.
  let netR: Reaction;
  let extraReactants: string[] = [];
  let fullProducts: string[];
  let solutionColor: PairInfo['solutionColor'];
  let gas: string | undefined;
  if (key === 'Cu-I') {
    netR = { reactants: [term(2, 'Cu^2+', 'aq'), term(4, 'I^-', 'aq')], products: [term(2, 'CuI', 's'), term(1, 'I2', 'aq')] };
    fullProducts = ['CuI', 'I2', 'NaNO3'];
    solutionColor = 'brun';
  } else if (key === 'Fe-I') {
    netR = { reactants: [term(2, 'Fe^3+', 'aq'), term(2, 'I^-', 'aq')], products: [term(2, 'Fe^2+', 'aq'), term(1, 'I2', 'aq')] };
    fullProducts = ['Fe(NO3)2', 'I2', 'NaNO3'];
    solutionColor = 'brun';
  } else if (key === 'Fe-CO3') {
    netR = {
      reactants: [term(2, 'Fe^3+', 'aq'), term(3, 'CO3^2-', 'aq'), term(3, 'H2O', 'l')],
      products: [term(2, 'Fe(OH)3', 's'), term(3, 'CO2', 'g')],
    };
    extraReactants = ['H2O'];
    fullProducts = ['Fe(OH)3', 'CO2', 'NaNO3'];
    gas = 'CO2';
  } else if (key === 'Ag-OH') {
    netR = { reactants: [term(2, 'Ag^+', 'aq'), term(2, 'OH^-', 'aq')], products: [term(1, 'Ag2O', 's'), term(1, 'H2O', 'l')] };
    fullProducts = ['Ag2O', 'H2O', 'NaNO3'];
  } else {
    const pf = entry.p!.formula;
    const c = balanceCoefficients([cat.formula, an.formula], [pf])!;
    netR = { reactants: [term(c[0]!, cat.formula, 'aq'), term(c[1]!, an.formula, 'aq')], products: [term(c[2]!, pf, 's')] };
    fullProducts = [pf, 'NaNO3'];
  }
  const reactants = [cat.salt, an.salt, ...extraReactants];
  const coefs = balanceCoefficients(reactants, fullProducts)!;
  const stateOf = (f: string): State => (f === 'H2O' ? 'l' : f === 'CO2' ? 'g' : f === entry.p?.formula ? 's' : 'aq');
  const fullR: Reaction = {
    reactants: reactants.map((f, i) => term(coefs[i]!, f, stateOf(f))),
    products: fullProducts.map((f, i) => term(coefs[reactants.length + i]!, f, stateOf(f))),
  };
  return { kind: entry.kind, precipitate: entry.p, net: netR, full: fullR, solutionColor, gas, note: entry.note };
}

/** Volumet av hver løsning (L). De blandes i like deler. */
export const MIX_VOLUME = 0.05;

export interface MixResult {
  /** Konsentrasjonen av kationet og anionet rett etter blanding (mol/L), før noe felles ut. */
  cCation: number;
  cAnion: number;
  /** Ioneproduktet Q (samme eksponenter som Ksp) og om det er større enn Ksp. */
  Q: number | null;
  precipitates: boolean;
  /** Formelenheter bunnfall per liter blanding (mol/L) og i alt (mol), og massen (g). */
  x: number;
  n: number;
  mass: number;
  /** Andel av det som kunne felles ut (0–1). */
  fraction: number;
  /** Ionet som blir brukt opp først, eller null når de går opp i opp. */
  limiting: 'kation' | 'anion' | null;
}

/**
 * Blander like volum (50 mL + 50 mL) av kationets nitratløsning og anionets natriumsalt, begge med konsentrasjonen
 * `c` (mol/L). Bunnfall dannes når ioneproduktet Q er større enn Ksp; da regnes likevekten ut (halveringssøk på
 * (c₁ − a·x)ᵖ · (c₂ − b·x)ᵠ = Ksp). Reaksjonene uten Ksp går fullstendig.
 */
export function mixSolutions(cationId: string, anionId: string, c: number): MixResult {
  const info = pairInfo(cationId, anionId);
  const cM = c / 2;
  const cX = c / 2;
  const none: MixResult = { cCation: cM, cAnion: cX, Q: null, precipitates: false, x: 0, n: 0, mass: 0, fraction: 0, limiting: null };
  if (!info.net || !info.precipitate || !(c > 0)) return none;
  const p = info.precipitate;
  const xMax = Math.min(cM / p.a, cX / p.b);
  const limiting = Math.abs(cM / p.a - cX / p.b) < 1e-12 ? null : cM / p.a < cX / p.b ? 'kation' : 'anion';
  const vol = 2 * MIX_VOLUME;
  if (p.ksp === undefined) {
    const n = xMax * vol;
    return { ...none, precipitates: true, x: xMax, n, mass: n * molarMass(p.formula), fraction: 1, limiting };
  }
  const [ep, eq] = p.exps ?? [p.a, p.b];
  const ionProduct = (x: number) => Math.max(0, cM - p.a * x) ** ep * Math.max(0, cX - p.b * x) ** eq;
  const Q = ionProduct(0);
  if (Q <= p.ksp) return { ...none, Q };
  let lo = 0;
  let hi = xMax;
  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2;
    if (ionProduct(mid) > p.ksp) lo = mid;
    else hi = mid;
  }
  const x = (lo + hi) / 2;
  const n = x * vol;
  return { cCation: cM, cAnion: cX, Q, precipitates: true, x, n, mass: n * molarMass(p.formula), fraction: x / xMax, limiting };
}

/** Konsentrasjonene eleven kan velge (mol/L). */
export const CONCENTRATIONS = [0.001, 0.002, 0.005, 0.01, 0.02, 0.05, 0.1, 0.2, 0.5] as const;

/** Tilskuerionene: ionene som er i løsningen før og etter, og ikke er med i nettolikningen. */
export function spectatorIons(cationId: string, anionId: string): string[] {
  const info = pairInfo(cationId, anionId);
  const cat = CATIONS.find((c) => c.id === cationId)!;
  const an = ANIONS.find((a) => a.id === anionId)!;
  const all = [...new Set([cat.formula, 'NO3^-', 'Na^+', an.formula])];
  if (!info.net) return all;
  const inNet = new Set(info.net.reactants.map((t) => t.formula));
  return all.filter((f) => !inNet.has(f));
}

/** Molar masse til et salt eller bunnfall (g/mol), for tester og visning. */
export function saltMolarMass(f: string): number {
  return molarMass(formula(f));
}

/** Elementsymbolet i et enkelt kation: «Ag^+» → «Ag». */
export function cationSymbol(f: string): string {
  return Object.keys(formula(f).atoms)[0] ?? '';
}
