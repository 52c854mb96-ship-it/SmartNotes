/** Ren kjemi for kapittel 3 Støkiometri (ingen React), så den kan testes for seg. */
import { atomCount, molarMass, type ParsedFormula } from '../kit/formel';
import { getElement, isMetal } from '../kit/grunnstoffer';
import { balanceCoefficients, checkBalance, formula, reaction, type Reaction } from '../kit/formel';

/** Avogadros tall N_A (per mol), med fire gjeldende siffer som i lærebøkene. */
export const N_A = 6.022e23;

/* ---------- Mol-brua: m = n · M, N = n · N_A, c = n / V ---------- */

export interface Substance {
  id: string;
  /** Norsk navn, små bokstaver. */
  name: string;
  formula: string;
  /** Løselighet i vann ved 25 °C, omtrent (gram per liter vann). Mangler for vann selv. */
  solubility?: number;
  /** Ioner stoffet deler seg i når det løses (for partikkelbildet), f.eks. NaCl → Na⁺ og Cl⁻. */
  ions?: { formula: string; count: number }[];
}

export const SUBSTANCES: Substance[] = [
  { id: 'vann', name: 'vann', formula: 'H2O' },
  { id: 'karbondioksid', name: 'karbondioksid', formula: 'CO2', solubility: 1.45 },
  {
    id: 'natriumklorid',
    name: 'natriumklorid',
    formula: 'NaCl',
    solubility: 360,
    ions: [
      { formula: 'Na^+', count: 1 },
      { formula: 'Cl^-', count: 1 },
    ],
  },
  { id: 'glukose', name: 'glukose', formula: 'C6H12O6', solubility: 909 },
  {
    id: 'kalsiumkarbonat',
    name: 'kalsiumkarbonat',
    formula: 'CaCO3',
    solubility: 0.013,
    ions: [
      { formula: 'Ca^2+', count: 1 },
      { formula: 'CO3^2-', count: 1 },
    ],
  },
];

export type Known = 'm' | 'n' | 'N';

export interface Amounts {
  /** Molar masse (g/mol). */
  M: number;
  /** Masse (g). */
  m: number;
  /** Stoffmengde (mol). */
  n: number;
  /** Antall partikler (molekyler, formelenheter, atomer eller ioner). */
  N: number;
  /** Antall atomer til sammen (N · atomer per formelenhet). */
  atoms: number;
}

/**
 * Regner ut de andre størrelsene fra den du kjenner: m = n · M og N = n · N_A.
 * `value` er i g (m), mol (n) eller et antall (N).
 */
export function amounts(f: ParsedFormula, known: Known, value: number): Amounts {
  const M = molarMass(f);
  const n = known === 'm' ? value / M : known === 'n' ? value : value / N_A;
  return { M, m: n * M, n, N: n * N_A, atoms: n * N_A * atomCount(f) };
}

/** Konsentrasjon c = n / V (mol/L), V i liter. */
export function concentration(n: number, V: number): number {
  return n / V;
}

/** Hva partiklene heter: ioner, atomer, formelenheter (ioniske stoffer) eller molekyler. */
export function particleWord(f: ParsedFormula): string {
  if (f.charge !== 0) return 'ioner';
  const syms = Object.keys(f.atoms);
  if (syms.length === 1 && f.atoms[syms[0]!] === 1) return 'atomer';
  if (syms.some((s) => isMetal(getElement(s)!))) return 'formelenheter';
  return 'molekyler';
}

/** Hvor mye som løses: dissolved er massen i løsningen (g), excess blir liggende som bunnfall (g). */
export function dissolve(m: number, V: number, solubility: number | undefined): { dissolved: number; excess: number; saturated: boolean } {
  if (solubility === undefined) return { dissolved: m, excess: 0, saturated: false };
  const max = solubility * V;
  return m > max ? { dissolved: max, excess: m - max, saturated: true } : { dissolved: m, excess: 0, saturated: false };
}

/* ---------- Glidebrytere med «pene» verdier ---------- */

const STEPS = [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8];

/** Pene verdier fra 10^lo til 10^hi (begge med): 1; 1,2; 1,5; 2; 2,5; 3; 4; 5; 6; 8 i hver dekade. */
export function ladder(lo: number, hi: number): number[] {
  const out: number[] = [];
  for (let e = lo; e < hi; e++) for (const s of STEPS) out.push(Number((s * 10 ** e).toPrecision(3)));
  out.push(Number((10 ** hi).toPrecision(3)));
  return out;
}

/** Indeksen til verdien i lista som ligger nærmest `v` (på logaritmisk skala). */
export function nearestIndex(values: readonly number[], v: number): number {
  if (!(v > 0)) return 0;
  let best = 0;
  let bestD = Infinity;
  values.forEach((x, i) => {
    const d = Math.abs(Math.log(x) - Math.log(v));
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  });
  return best;
}

/** Verdiområdene for den kjente størrelsen: masse 0,01 g–1 kg, stoffmengde 0,001–100 mol, antall 10²⁰–10²⁶. */
export const LADDERS: Record<Known, number[]> = {
  m: ladder(-2, 3),
  n: ladder(-3, 2),
  N: ladder(20, 26),
};

/* ---------- Hvor stort er N_A? ---------- */

export interface Landmark {
  label: string;
  /** Verdi (eller midten av et område). */
  value: number;
  /** Område når tallet er usikkert (min, max). */
  range?: [number, number];
}

/** Sammenligninger, sortert etter størrelse. Grove anslag er merket med «ca.». En vanndråpe er regnet som 0,05 mL. */
export const LANDMARKS: Landmark[] = [
  { label: 'Mennesker på jorda', value: 8.1e9 },
  { label: 'Stjerner i Melkeveien, ca.', value: 2e11, range: [1e11, 4e11] },
  { label: 'Celler i et menneske, ca.', value: 3.7e13 },
  { label: 'Sekunder siden big bang', value: 13.8e9 * 365.25 * 24 * 3600 },
  { label: 'Sandkorn på alle strender, ca.', value: 7.5e18 },
  { label: 'Molekyler i en vanndråpe', value: (0.05 / 18.02) * N_A },
  { label: 'Stjerner i universet, ca.', value: 1e23, range: [1e22, 1e24] },
];

/** Universets alder i år. */
export const UNIVERSE_AGE_YEARS = 13.8e9;
const SECONDS_PER_YEAR = 365.25 * 24 * 3600;

/** År det tar å telle N partikler med én i sekundet. */
export function countingYears(N: number): number {
  return N / SECONDS_PER_YEAR;
}

/* ====================================================================== */
/* Balansering av reaksjonslikninger (Balansering.tsx)                     */
/* ====================================================================== */

export interface BalanceReaction {
  id: string;
  /** Navn i nedtrekkslista (ren tekst). */
  name: string;
  /** Formlene med tilstand, uten koeffisienter: «CH4(g)». */
  reactants: string[];
  products: string[];
  /** Én setning om reaksjonen til forklaringen. */
  about: string;
}

/**
 * Reaksjoner å balansere. Formlene står uten koeffisienter; balanceCoefficients i kit-et finner løsningen.
 * Ionelikningen (kobber i sølvnitrat) har ladning, så der må også ladningen balanseres.
 */
export const BALANCE_REACTIONS: BalanceReaction[] = [
  {
    id: 'metan',
    name: 'Metan + oksygen',
    reactants: ['CH4(g)', 'O2(g)'],
    products: ['CO2(g)', 'H2O(g)'],
    about: 'Forbrenning av metan: metan er hovedbestanddelen i naturgass og biogass.',
  },
  {
    id: 'propan',
    name: 'Propan + oksygen',
    reactants: ['C3H8(g)', 'O2(g)'],
    products: ['CO2(g)', 'H2O(g)'],
    about: 'Forbrenning av propan: propan er gassen i gassgrill og campingbrennere.',
  },
  {
    id: 'glukose',
    name: 'Glukose + oksygen',
    reactants: ['C6H12O6(s)', 'O2(g)'],
    products: ['CO2(g)', 'H2O(l)'],
    about: 'Forbrenning av glukose: cellene får energi fra den samme reaksjonen, men der skjer den i mange små trinn (celleånding).',
  },
  {
    id: 'etanol',
    name: 'Etanol + oksygen',
    reactants: ['C2H5OH(l)', 'O2(g)'],
    products: ['CO2(g)', 'H2O(g)'],
    about: 'Forbrenning av etanol: etanol brukes som drivstoff (bioetanol) og i rødsprit.',
  },
  {
    id: 'jern',
    name: 'Jern + oksygen',
    reactants: ['Fe(s)', 'O2(g)'],
    products: ['Fe2O3(s)'],
    about: 'Jern og oksygen danner jern(III)oksid. Rust er i hovedsak jern(III)oksid med krystallvann.',
  },
  {
    id: 'aluminium',
    name: 'Aluminium + saltsyre',
    reactants: ['Al(s)', 'HCl(aq)'],
    products: ['AlCl3(aq)', 'H2(g)'],
    about: 'Et uedelt metall løses i syre, og det dannes hydrogengass.',
  },
  {
    id: 'natrium',
    name: 'Natrium + vann',
    reactants: ['Na(s)', 'H2O(l)'],
    products: ['NaOH(aq)', 'H2(g)'],
    about: 'Alkalimetallene reagerer kraftig med vann og danner en basisk løsning og hydrogengass.',
  },
  {
    id: 'fotosyntese',
    name: 'Fotosyntesen',
    reactants: ['CO2(g)', 'H2O(l)'],
    products: ['C6H12O6(aq)', 'O2(g)'],
    about: 'Fotosyntesen er den omvendte reaksjonen av forbrenningen av glukose, og den drives av lysenergi.',
  },
  {
    id: 'ammoniakk',
    name: 'Ammoniakksyntesen',
    reactants: ['N2(g)', 'H2(g)'],
    products: ['NH3(g)'],
    about: 'Ammoniakk lages av nitrogen fra lufta (Haber–Bosch-prosessen) og brukes mest til kunstgjødsel.',
  },
  {
    id: 'kalkstein',
    name: 'Kalkstein + saltsyre',
    reactants: ['CaCO3(s)', 'HCl(aq)'],
    products: ['CaCl2(aq)', 'H2O(l)', 'CO2(g)'],
    about: 'Karbonater bruser i syre fordi det dannes karbondioksid.',
  },
  {
    id: 'termitt',
    name: 'Termittreaksjonen',
    reactants: ['Al(s)', 'Fe2O3(s)'],
    products: ['Al2O3(s)', 'Fe(l)'],
    about: 'Termitt blir så varm at jernet smelter, og brukes til sveising av jernbaneskinner.',
  },
  {
    id: 'kobber-solv',
    name: 'Kobber + sølvioner',
    reactants: ['Cu(s)', 'Ag^+(aq)'],
    products: ['Cu^2+(aq)', 'Ag(s)'],
    about: 'Kobber i sølvnitratløsning: nitrationene er tilskuerioner og er utelatt. I en ionelikning må også ladningen være lik på begge sider.',
  },
];

/** Minste og største koeffisient på stepperne. */
export const COEF_MIN = 1;
export const COEF_MAX = 12;

/** Reaksjonen med gitte koeffisienter (reaktantene først, så produktene). */
export function withCoefficients(r: BalanceReaction, coefs: readonly number[]): Reaction {
  const n = r.reactants.length;
  return {
    reactants: r.reactants.map((f, i) => ({ coef: coefs[i] ?? 1, formula: f })),
    products: r.products.map((f, i) => ({ coef: coefs[n + i] ?? 1, formula: f })),
  };
}

/** De minste heltallige koeffisientene som balanserer likningen. */
export function balanceSolution(r: BalanceReaction): number[] {
  const s = balanceCoefficients(r.reactants, r.products);
  if (!s) throw new Error(`${r.id} kan ikke balanseres entydig`);
  return s;
}

/** Grunnstoffet står alene i et av stoffene (et fritt grunnstoff som O₂, Fe eller Ag, ikke et ion). */
export function standsAlone(r: BalanceReaction, sym: string): boolean {
  return [...r.reactants, ...r.products].some((f) => {
    const p = formula(f);
    const syms = Object.keys(p.atoms);
    return p.charge === 0 && syms.length === 1 && syms[0] === sym;
  });
}

/**
 * Rekkefølgen grunnstoffene bør balanseres i (lærebokas metode): først grunnstoffene som er bundet i forbindelser og
 * finnes i færrest stoffer, så H og O, som ofte finnes i mange stoffer. Grunnstoffer som står alene (O₂, Fe, H₂) tas
 * til slutt, fordi koeffisienten foran dem ikke endrer noe annet grunnstoff.
 */
export function balanceOrder(r: BalanceReaction): string[] {
  const species = [...r.reactants, ...r.products].map((f) => formula(f));
  const symbols: string[] = [];
  for (const s of species) for (const sym of Object.keys(s.atoms)) if (!symbols.includes(sym)) symbols.push(sym);
  const inSpecies = (sym: string) => species.filter((s) => (s.atoms[sym] ?? 0) > 0).length;
  const rank = (sym: string) => (sym === 'O' ? 2 : sym === 'H' ? 1 : 0);
  return symbols
    .map((sym, i) => ({ sym, i, free: standsAlone(r, sym) ? 1 : 0, rank: rank(sym), count: inSpecies(sym) }))
    .sort((a, b) => a.free - b.free || a.rank - b.rank || a.count - b.count || a.i - b.i)
    .map((x) => x.sym);
}

const gcd2 = (a: number, b: number): number => {
  a = Math.abs(Math.round(a));
  b = Math.abs(Math.round(b));
  while (b) [a, b] = [b, a % b];
  return a;
};

export interface AtomRow {
  symbol: string;
  left: number;
  right: number;
  ok: boolean;
}

export interface BalanceState {
  /** Atomtelling per grunnstoff, i rekkefølgen fra balanceOrder. */
  rows: AtomRow[];
  /** Likningen har ioner, så ladningen må også balanseres. */
  hasCharge: boolean;
  chargeLeft: number;
  chargeRight: number;
  chargeOk: boolean;
  balanced: boolean;
  /** Største felles faktor for koeffisientene (1 = minste heltall). */
  divisor: number;
  /** Første grunnstoff (i metodens rekkefølge) som ikke stemmer, «ladning», eller null når alt stemmer. */
  next: string | null;
  /** Σ koeffisient · M på hver side (g når koeffisientene leses som mol). */
  massLeft: number;
  massRight: number;
  atomsLeft: number;
  atomsRight: number;
}

/** Hvordan likningen står med disse koeffisientene: atomtelling, ladning og masse på hver side. */
export function balanceState(r: BalanceReaction, coefs: readonly number[]): BalanceState {
  const rx = withCoefficients(r, coefs);
  const check = checkBalance(rx);
  const order = balanceOrder(r);
  const rows = order.map((symbol) => {
    const a = check.atoms.find((x) => x.symbol === symbol) ?? { left: 0, right: 0 };
    return { symbol, left: a.left, right: a.right, ok: Math.abs(a.left - a.right) < 1e-9 };
  });
  const hasCharge = [...r.reactants, ...r.products].some((f) => formula(f).charge !== 0);
  const side = (terms: Reaction['reactants']) => terms.reduce((s, t) => s + t.coef * molarMass(formula(t.formula)), 0);
  const firstBad = rows.find((x) => !x.ok);
  const divisor = coefs.reduce((g, c) => gcd2(g, c), 0) || 1;
  return {
    rows,
    hasCharge,
    chargeLeft: check.chargeLeft,
    chargeRight: check.chargeRight,
    chargeOk: check.chargeBalanced,
    balanced: check.balanced,
    divisor,
    next: firstBad ? firstBad.symbol : check.chargeBalanced ? null : 'ladning',
    massLeft: side(rx.reactants),
    massRight: side(rx.products),
    atomsLeft: rows.reduce((s, x) => s + x.left, 0),
    atomsRight: rows.reduce((s, x) => s + x.right, 0),
  };
}

/** Stoffene på siden som har for få atomer av grunnstoffet: der kan du øke en koeffisient. */
export function hintFor(r: BalanceReaction, coefs: readonly number[], symbol: string): { side: 'left' | 'right'; species: string[] } | null {
  const st = balanceState(r, coefs);
  const row = st.rows.find((x) => x.symbol === symbol);
  if (!row || row.ok) return null;
  const side = row.left < row.right ? 'left' : 'right';
  const list = side === 'left' ? r.reactants : r.products;
  return { side, species: list.filter((f) => (formula(f).atoms[symbol] ?? 0) > 0) };
}

/* ====================================================================== */
/* Begrensende reaktant og utbytte (BegrensendeReaktant.tsx)               */
/* ====================================================================== */

export interface LimitingReaction {
  id: string;
  name: string;
  /** Balansert likning med tilstander og heltallige koeffisienter. */
  equation: string;
  /** Største stoffmengde på glidebryteren for hver reaktant (mol), et multiplum av amountStep(koeffisient). */
  nMax: number[];
  /** Startverdier (mol), også multipler av amountStep(koeffisient). */
  n0: number[];
  /** Hvilket produkt utbyttet regnes for (indeks blant produktene). */
  yieldOf: number;
}

export const LIMITING_REACTIONS: LimitingReaction[] = [
  { id: 'vann', name: 'Hydrogen + oksygen → vann', equation: '2 H2(g) + O2(g) → 2 H2O(l)', nMax: [6, 4], n0: [3, 2], yieldOf: 0 },
  { id: 'ammoniakk', name: 'Ammoniakksyntesen', equation: 'N2(g) + 3 H2(g) → 2 NH3(g)', nMax: [4, 9], n0: [2, 4.5], yieldOf: 0 },
  { id: 'metan', name: 'Forbrenning av metan', equation: 'CH4(g) + 2 O2(g) → CO2(g) + 2 H2O(l)', nMax: [4, 6], n0: [2, 3], yieldOf: 0 },
  { id: 'jernsulfid', name: 'Jern + svovel → jern(II)sulfid', equation: 'Fe(s) + S(s) → FeS(s)', nMax: [4, 4], n0: [1.5, 1], yieldOf: 0 },
];

export interface LimitingResult {
  /** n / koeffisient for hver reaktant: den minste avgjør hvor langt reaksjonen går. */
  ratios: number[];
  /** Hvor mange «formelomsetninger» (mol) som skjer: ξ = min(n / koeffisient). */
  extent: number;
  /** Indeksene til den/de begrensende reaktantene (tom når alle er 0). */
  limiting: number[];
  /** Alle reaktantene brukes opp samtidig (støkiometrisk blanding). */
  exact: boolean;
  /** Stoffmengder (mol) for alle stoffene, reaktantene først: før, endring og etter. */
  before: number[];
  change: number[];
  after: number[];
}

/** Likningen tolket (koeffisienter og formler). */
export function parsedEquation(r: LimitingReaction): Reaction {
  return reaction(r.equation);
}

const REL = 1e-9;

/** Begrensende reaktant og stoffmengdene før og etter: endring = ∓ koeffisient · ξ. */
export function limitingResult(rx: Reaction, n: readonly number[]): LimitingResult {
  const ratios = rx.reactants.map((t, i) => Math.max(0, n[i] ?? 0) / t.coef);
  const extent = Math.min(...ratios);
  const tol = Math.max(1e-12, extent * REL);
  const limiting = ratios.map((r, i) => (r - extent <= tol ? i : -1)).filter((i) => i >= 0);
  const before = [...rx.reactants.map((_, i) => Math.max(0, n[i] ?? 0)), ...rx.products.map(() => 0)];
  const change = [...rx.reactants.map((t) => -t.coef * extent), ...rx.products.map((t) => t.coef * extent)];
  const after = before.map((b, i) => {
    const v = b + change[i]!;
    return Math.abs(v) < tol * 10 ? 0 : v;
  });
  // Når det ikke er noe av noen av reaktantene, er ingen av dem begrensende.
  const none = ratios.every((r) => r === 0);
  return { ratios, extent, limiting: none ? [] : limiting, exact: extent > 0 && limiting.length === rx.reactants.length, before, change, after };
}

/**
 * Partikkelbildet: hver tegnet partikkel er `unit` mol (reaktantene først, så produktene). Antall omsetninger i bildet
 * er den eksakte ξ rundet til hele partikler, og restene er de eksakte restene rundet av. Før-bildet bygges så baklengs
 * (rest + koeffisient · omsetninger), så atomene alltid er bevart, og den begrensende reaktanten er alltid brukt opp i
 * bildet. Går tallene opp i hele partikler, er bildet eksakt.
 */
export function pictureCounts(rx: Reaction, n: readonly number[], unit = 0.5): { before: number[]; after: number[]; extent: number; exact: boolean } {
  const res = limitingResult(rx, n);
  const extent = Math.max(0, Math.round(res.extent / unit + 1e-9));
  const left = rx.reactants.map((_, i) => Math.max(0, Math.round(res.after[i]! / unit + 1e-9)));
  const before = rx.reactants.map((t, i) => left[i]! + t.coef * extent);
  const exact = before.every((N, i) => Math.abs(N * unit - res.before[i]!) < 1e-9) && Math.abs(extent * unit - res.extent) < 1e-9;
  return {
    before: [...before, ...rx.products.map(() => 0)],
    after: [...left, ...rx.products.map((t) => t.coef * extent)],
    extent,
    exact,
  };
}

/**
 * Steget på glidebryteren for stoffmengden av en reaktant (mol): koeffisienten · én partikkel. Da går
 * partikkelbildet alltid opp når mengdene er oppgitt i mol (se pictureCounts).
 */
export function amountStep(coef: number, unit = 0.5): number {
  return coef * unit;
}

/** Prosentvis utbytte = faktisk / teoretisk · 100 %. NaN når det teoretiske utbyttet er 0. */
export function percentYield(actual: number, theoretical: number): number {
  return theoretical > 0 ? (actual / theoretical) * 100 : Number.NaN;
}

/** Pent steg for en glidebryter: 1, 2 eller 5 · 10^k, omtrent x. */
export function niceStep(x: number): number {
  if (!(x > 0)) return 1;
  const e = 10 ** Math.floor(Math.log10(x));
  const m = x / e;
  return (m >= 5 ? 5 : m >= 2 ? 2 : 1) * e;
}

/** Rund opp til nærmeste multiplum av steget. */
export function ceilTo(v: number, step: number): number {
  return Number((Math.ceil(v / step - 1e-9) * step).toPrecision(12));
}

/* ====================================================================== */
/* Konsentrasjon og fortynning (Konsentrasjon.tsx)                         */
/* ====================================================================== */

export interface Solute {
  id: string;
  name: string;
  formula: string;
  /**
   * Hvor mye tettheten øker med massekonsentrasjonen: ρ ≈ ρ(vann) + k · (m/V) med m/V i g/mL. Tilpasset tabellverdier
   * for tetthet ved 20 °C (CRC Handbook, «Concentrative properties of aqueous solutions») opp til ca. 20 masseprosent:
   * NaCl 10 % → 1,071 g/mL, glukose 10 % → 1,038 g/mL, CuSO₄ 10 % → 1,107 g/mL.
   */
  densitySlope: number;
  /** Største masse på glidebryteren (g). Holdt under løseligheten i 100 mL (NaCl 360 g/L, CuSO₄ ca. 200 g/L) og i området der tetthetsmodellen stemmer. */
  mMax: number;
  /** Løsningen er farget (Cu²⁺ er blå), og fargen blir sterkere med konsentrasjonen. */
  colored?: boolean;
  /** Ionene stoffet deler seg i når det løses. */
  ions?: { formula: string; count: number }[];
}

export const SOLUTES: Solute[] = [
  {
    id: 'natriumklorid',
    name: 'natriumklorid',
    formula: 'NaCl',
    densitySlope: 0.68,
    mMax: 25,
    ions: [
      { formula: 'Na^+', count: 1 },
      { formula: 'Cl^-', count: 1 },
    ],
  },
  { id: 'glukose', name: 'glukose', formula: 'C6H12O6', densitySlope: 0.38, mMax: 30 },
  {
    id: 'kobbersulfat',
    name: 'kobber(II)sulfat',
    formula: 'CuSO4',
    densitySlope: 0.99,
    mMax: 15,
    colored: true,
    ions: [
      { formula: 'Cu^2+', count: 1 },
      { formula: 'SO4^2-', count: 1 },
    ],
  },
];

/** Målekolber (mL) og fullpipetter (mL) som finnes på skolelaboratoriet. */
export const FLASKS = [50, 100, 250, 500, 1000];
export const PIPETTES = [1, 2, 5, 10, 20, 25, 50];
/** Tettheten til rent vann ved 20 °C (g/mL). */
export const WATER_DENSITY = 0.998;

export interface SolutionInfo {
  /** Stoffmengde (mol). */
  n: number;
  /** Konsentrasjon (mol/L). */
  c: number;
  /** Massekonsentrasjon (g/L og mg/L). */
  gPerL: number;
  mgPerL: number;
  /** Tetthet (g/mL), omtrent. */
  density: number;
  /** Massen av hele løsningen (g). */
  mSolution: number;
  /** Masseprosent (%) og ppm (milliondeler, regnet etter masse: mg stoff per kg løsning). */
  massPercent: number;
  ppm: number;
}

/** Konsentrasjonen av m gram stoff (molar masse M) løst og fortynnet til V mL i en målekolbe. */
export function solutionInfo(M: number, m: number, V_mL: number, densitySlope: number): SolutionInfo {
  const V = V_mL / 1000;
  const n = m / M;
  const gPerL = m / V;
  const density = WATER_DENSITY + densitySlope * (m / V_mL);
  const mSolution = density * V_mL;
  const w = m / mSolution;
  return { n, c: n / V, gPerL, mgPerL: gPerL * 1000, density, mSolution, massPercent: w * 100, ppm: w * 1e6 };
}

/** Fortynning: c₁ · V₁ = c₂ · V₂. Stoffmengden som flyttes er n = c₁ · V₁ (volum i mL). */
export function dilution(c1: number, V1_mL: number, V2_mL: number): { c2: number; n: number; factor: number } {
  return { c2: (c1 * V1_mL) / V2_mL, n: (c1 * V1_mL) / 1000, factor: V2_mL / V1_mL };
}
