/**
 * Kjemiske formler og reaksjonslikninger uten React: tolking («parsing»), molar masse, ladning, tekst med
 * senket/hevet skrift og kontroll av at en reaksjonslikning er balansert.
 *
 * Formler som forstås:
 *   H2O, Ca(OH)2, Fe2(SO4)3, CuSO4·5H2O (også CuSO4.5H2O og CuSO4*5H2O), [Cu(NH3)4]^2+
 *   Ladning: SO4^2-, NH4^+, Fe^3+ (entydig), eller kortformene Fe3+, O2-, NH4+, SO42-, PO43-, Cl-
 *   Unicode: H₂O, SO₄²⁻, Fe³⁺. Tilstand til slutt: NaCl(aq), H2O(l), CO2(g), CaCO3(s). Elektron: e- eller e⁻.
 *
 * Kortformen uten ^ er flertydig og tolkes slik lærebøker skriver ioner: ett grunnstoff + ett siffer er ladning
 * (Fe3+ = Fe³⁺, O2- = O²⁻), flere grunnstoffer + ett siffer er antall (NH4+ = NH₄⁺), og to siffer på slutten er
 * antall + ladning (SO42- = SO₄²⁻, O22- = O₂²⁻). Bruk ^ når du vil være sikker.
 */
import { fmt } from '../../kit/format';
import { ALL_SYMBOLS, capitalize, chargeSuperscript, getElement } from './grunnstoffer';

export type State = 'aq' | 's' | 'l' | 'g';

/** Bit av en formel slik den skal vises: vanlig tekst, senket antall eller hevet ladning. */
export interface FormulaToken {
  kind: 'text' | 'sub' | 'sup';
  text: string;
}

export interface Formula {
  /** Teksten formelen ble tolket fra. */
  source: string;
  /** Antall atomer av hvert grunnstoff, i rekkefølgen de først står i formelen: Ca(OH)2 → { Ca: 1, O: 2, H: 2 }. */
  atoms: Readonly<Record<string, number>>;
  /** Ladning (0 for nøytrale stoffer). */
  charge: number;
  /** Tilstandssymbol hvis det sto i formelen. */
  state: State | null;
  /** Et fritt elektron (e⁻) i en halvreaksjon. */
  electron: boolean;
  /** For visning: Ca, (, OH, ), ₂ … uten tilstand. */
  tokens: readonly FormulaToken[];
}

export type FormulaResult = { ok: true; formula: Formula } | { ok: false; error: string };

const SUB_DIGITS = '₀₁₂₃₄₅₆₇₈₉';
const SUP_DIGITS = '⁰¹²³⁴⁵⁶⁷⁸⁹';
const STATE_RE = /\((aq|s|l|g)\)$/i;

/** Gjør om Unicode-varianter til vanlig skrivemåte: H₂O → H2O, SO₄²⁻ → SO4^2-, − → -. */
function normalize(input: string): string {
  let s = input.trim();
  // Hevet ladning (²⁻, ⁺, ³⁺ …) → ^2-, ^+, ^3+
  s = s.replace(/([⁰¹²³⁴⁵⁶⁷⁸⁹]*)([⁺⁻])/g, (_, d: string, sign: string) => {
    const digits = [...d].map((c) => String(SUP_DIGITS.indexOf(c))).join('');
    return `^${digits}${sign === '⁺' ? '+' : '-'}`;
  });
  s = s.replace(/[₀-₉]/g, (c) => String(SUB_DIGITS.indexOf(c)));
  s = s.replace(/[−–]/g, '-').replace(/[•∙⋅*.]/g, '·');
  return s;
}

function fail(error: string): FormulaResult {
  return { ok: false, error };
}

/** Tolker en kjemisk formel. Gir en forklarende norsk feilmelding hvis formelen ikke kan tolkes. */
export function parseFormula(input: string): FormulaResult {
  let s = normalize(input);
  if (!s) return fail('Skriv en formel, for eksempel H2O eller Ca(OH)2.');

  // Tilstand til slutt: (aq), (s), (l), (g)
  let state: State | null = null;
  const st = STATE_RE.exec(s);
  if (st) {
    state = st[1]!.toLowerCase() as State;
    s = s.slice(0, st.index).trim();
  }

  // Elektron
  if (/^e\^?-$/.test(s)) {
    return {
      ok: true,
      formula: { source: input, atoms: {}, charge: -1, state, electron: true, tokens: [{ kind: 'text', text: 'e' }, { kind: 'sup', text: '−' }] },
    };
  }

  // Ladning skilt med mellomrom: «SO4 2-»
  const spaced = /^(.*\S)\s+(\d*)([+-])$/.exec(s);
  if (spaced) s = `${spaced[1]}^${spaced[2]}${spaced[3]}`;
  s = s.replace(/\s+/g, '');
  if (!s) return fail('Skriv en formel, for eksempel H2O eller Ca(OH)2.');

  // Ladning
  let charge = 0;
  const caret = s.lastIndexOf('^');
  if (caret >= 0) {
    const c = s.slice(caret + 1);
    const a = /^(\d*)([+-])$/.exec(c);
    const b = a ? null : /^([+-])(\d*)$/.exec(c);
    if (!a && !b) return fail('Skriv ladningen etter ^ som tall og fortegn, for eksempel SO4^2- eller NH4^+.');
    const digits = a ? a[1]! : b![2]!;
    const sign = (a ? a[2] : b![1]) === '-' ? -1 : 1;
    const n = digits ? Number(digits) : 1;
    if (n === 0) return fail('Ladningen kan ikke være 0. Skriv ladningen bare for ioner.');
    charge = sign * n;
    s = s.slice(0, caret);
  } else {
    const m = /(\d*)([+-]+)$/.exec(s);
    if (m) {
      const signs = m[2]!;
      if (/[+]/.test(signs) && /-/.test(signs)) return fail('Ladningen kan ikke ha både + og −.');
      const sign = signs[0] === '-' ? -1 : 1;
      let digits = m[1]!;
      let rest = s.slice(0, m.index);
      if (signs.length > 1) {
        // Gammel skrivemåte: Fe+++ = Fe³⁺
        charge = sign * signs.length;
        rest += digits;
      } else if (!digits) {
        charge = sign;
      } else {
        const single = /^[A-Z][a-z]?$/.test(rest);
        let chargeDigits: string;
        if (single && digits.length === 1) {
          chargeDigits = digits;
          digits = '';
        } else if (digits.length >= 2) {
          chargeDigits = digits.slice(-1);
          digits = digits.slice(0, -1);
        } else {
          chargeDigits = '1';
        }
        charge = sign * Number(chargeDigits);
        rest += digits;
        if (charge === 0) return fail('Ladningen kan ikke være 0. Skriv ladningen bare for ioner.');
      }
      s = rest;
    }
  }
  if (!s) return fail('Formelen mangler grunnstoffer.');
  if (/[+\-^]/.test(s)) return fail('Ladningen skal stå helt til slutt, for eksempel SO4^2-.');

  // Selve formelen, med hydratdeler skilt med ·
  const atoms: Record<string, number> = {};
  const tokens: FormulaToken[] = [];
  const parts = s.split('·');
  for (let p = 0; p < parts.length; p++) {
    const part = parts[p]!;
    if (!part) return fail(p === 0 ? 'Formelen kan ikke starte med ·.' : 'Det mangler en formel etter ·.');
    if (p > 0) tokens.push({ kind: 'text', text: '·' });
    const coef = /^\d+/.exec(part);
    let mult = 1;
    let body = part;
    if (coef) {
      if (p === 0)
        return fail(`En formel starter ikke med et tall. Skriv bare ${part.slice(coef[0].length) || 'formelen'}; antallet hører til koeffisienten i reaksjonslikningen.`);
      mult = Number(coef[0]);
      if (mult === 0) return fail('Antallet foran krystallvannet kan ikke være 0.');
      tokens.push({ kind: 'text', text: coef[0] });
      body = part.slice(coef[0].length);
      if (!body) return fail(`Det mangler en formel etter ${coef[0]}.`);
    }
    const res = parseGroup(body, tokens);
    if (typeof res === 'string') return fail(res);
    for (const [sym, n] of Object.entries(res)) atoms[sym] = (atoms[sym] ?? 0) + n * mult;
  }
  if (charge !== 0) tokens.push({ kind: 'sup', text: chargeLabel(charge) });
  return { ok: true, formula: { source: input, atoms, charge, state, electron: false, tokens } };
}

/** «2−», «+», «3+» (med ekte minustegn), som hevet ladning i formler. */
function chargeLabel(q: number): string {
  const n = Math.abs(q);
  return `${n === 1 ? '' : n}${q > 0 ? '+' : '−'}`;
}

/** Tolker en formel uten ladning og hydratdeler. Gir atomtellingen, eller en feilmelding. */
function parseGroup(s: string, tokens: FormulaToken[]): Record<string, number> | string {
  const stack: { atoms: Record<string, number>; open: string; at: number }[] = [{ atoms: {}, open: '', at: -1 }];
  let i = 0;
  const add = (into: Record<string, number>, from: Record<string, number>, k: number) => {
    for (const [sym, n] of Object.entries(from)) into[sym] = (into[sym] ?? 0) + n * k;
  };
  while (i < s.length) {
    const ch = s[i]!;
    const top = stack[stack.length - 1]!;
    if (ch === '(' || ch === '[') {
      stack.push({ atoms: {}, open: ch, at: i });
      tokens.push({ kind: 'text', text: ch });
      i++;
    } else if (ch === ')' || ch === ']') {
      const want = ch === ')' ? '(' : '[';
      if (stack.length === 1) return `Sluttparentesen «${ch}» mangler en startparentes.`;
      if (top.open !== want) return `Parentesene passer ikke sammen: «${top.open}» lukkes med «${ch}».`;
      if (Object.keys(top.atoms).length === 0) return 'Parentesen er tom.';
      stack.pop();
      tokens.push({ kind: 'text', text: ch });
      const m = /^\d+/.exec(s.slice(i + 1));
      const n = m ? Number(m[0]) : 1;
      if (m) {
        if (n === 0) return 'Antall kan ikke være 0.';
        tokens.push({ kind: 'sub', text: m[0] });
      }
      add(stack[stack.length - 1]!.atoms, top.atoms, n);
      i += 1 + (m ? m[0].length : 0);
    } else if (/[A-Z]/.test(ch)) {
      const two = s.slice(i, i + 2);
      const sym = /^[A-Z][a-z]$/.test(two) ? two : ch;
      const known = getElement(sym);
      if (!known) return unknownSymbol(sym, s, i);
      tokens.push({ kind: 'text', text: sym });
      i += sym.length;
      const m = /^\d+/.exec(s.slice(i));
      const n = m ? Number(m[0]) : 1;
      if (m) {
        if (n === 0) return 'Antall kan ikke være 0.';
        tokens.push({ kind: 'sub', text: m[0] });
        i += m[0].length;
      }
      top.atoms[sym] = (top.atoms[sym] ?? 0) + n;
    } else if (/[a-z]/.test(ch)) {
      const run = /^[a-z]+/.exec(s.slice(i))![0];
      const guess = capitalize(run.slice(0, 2));
      const hint = getElement(guess) ? ` Mente du «${guess}»?` : getElement(run[0]!.toUpperCase()) ? ` Mente du «${run[0]!.toUpperCase()}»?` : '';
      return `Grunnstoffsymboler starter med stor bokstav («${run}» er ikke et symbol).${hint}`;
    } else if (/\d/.test(ch)) {
      return 'Et tall må stå etter et grunnstoff eller en parentes.';
    } else {
      return `Tegnet «${ch}» kan ikke stå i en formel.`;
    }
  }
  if (stack.length > 1) return `Parentesen «${stack[stack.length - 1]!.open}» blir aldri lukket.`;
  const atoms = stack[0]!.atoms;
  if (Object.keys(atoms).length === 0) return 'Formelen mangler grunnstoffer.';
  return atoms;
}

function unknownSymbol(sym: string, s: string, i: number): string {
  if (ALL_SYMBOLS.includes(sym)) return `Grunnstoffet ${sym} er ikke med i tabellen her (den har Z = 1–54 og noen tyngre grunnstoffer).`;
  // To store bokstaver som hvert er et symbol, f.eks. «Ch» skrevet for «CH»
  const split = sym.length === 2 ? `${sym[0]}${sym[1]!.toUpperCase()}` : '';
  if (split && getElement(sym[0]!) && getElement(sym[1]!.toUpperCase()))
    return `«${sym}» er ikke et grunnstoff. Mente du ${split}? Hvert symbol starter med stor bokstav.`;
  const next = s.slice(i, i + 3);
  return `Ukjent grunnstoff «${sym}»${next.length > sym.length ? ` (i «${next}»)` : ''}.`;
}

/** Som `parseFormula`, men kaster en feil. Bruk for faste formler i koden: `formula('H2O')`. */
export function formula(input: string): Formula {
  const r = parseFormula(input);
  if (!r.ok) throw new Error(`${input}: ${r.error}`);
  return r.formula;
}

const asFormula = (f: string | Formula): Formula => (typeof f === 'string' ? formula(f) : f);

/** Unicode-tekst: Ca(OH)₂, CuSO₄·5H₂O, SO₄²⁻. Med `withState` også (aq), (s) osv. Fin til aria-label og vanlig tekst. */
export function formulaText(f: string | Formula, withState = false): string {
  const p = asFormula(f);
  const body = p.tokens
    .map((t) =>
      t.kind === 'sub'
        ? [...t.text].map((d) => SUB_DIGITS[Number(d)]).join('')
        : t.kind === 'sup'
          ? chargeSuperscript(p.charge)
          : t.text,
    )
    .join('');
  return withState && p.state ? `${body}(${p.state})` : body;
}

export interface MolarMassTerm {
  symbol: string;
  /** Antall atomer i formelen. */
  count: number;
  /** Molar masse til grunnstoffet (g/mol). */
  M: number;
  /** count · M (g/mol). */
  mass: number;
  /** Andel av den molare massen (0–1). */
  fraction: number;
}

/** Bidraget fra hvert grunnstoff til den molare massen, i formelens rekkefølge: M = Σ antall · M(grunnstoff). */
export function molarMassTerms(f: string | Formula): MolarMassTerm[] {
  const p = asFormula(f);
  const terms = Object.entries(p.atoms).map(([symbol, count]) => {
    const M = getElement(symbol)!.molarMass;
    return { symbol, count, M, mass: count * M, fraction: 0 };
  });
  const total = terms.reduce((s, t) => s + t.mass, 0);
  for (const t of terms) t.fraction = total > 0 ? t.mass / total : 0;
  return terms;
}

/** Molar masse i g/mol (elektronenes masse regnes ikke med, som i lærebøkene). Kaster feil for ugyldige formler. */
export function molarMass(f: string | Formula): number {
  return molarMassTerms(f).reduce((s, t) => s + t.mass, 0);
}

/** Antall atomer totalt i én formelenhet: H2O → 3, CuSO4·5H2O → 21. */
export function atomCount(f: string | Formula): number {
  return Object.values(asFormula(f).atoms).reduce((s, n) => s + n, 0);
}

/* ---------- Reaksjonslikninger ---------- */

export interface Term {
  /** Koeffisient (1 vises ikke). Brøker som 0,5 er lov (vises som ½). */
  coef: number;
  formula: string;
  /** Tilstand; overstyrer en tilstand skrevet i formelen. */
  state?: State;
}

export interface Reaction {
  reactants: Term[];
  products: Term[];
  /** Likevekt: ⇌ i stedet for →. */
  equilibrium?: boolean;
}

export type ReactionResult = { ok: true; reaction: Reaction } | { ok: false; error: string };

const ARROW_RE = /\s*(⇌|<=>|<->|⇄|→|->|⟶|=>|=)\s*/;

/**
 * Tolker en reaksjonslikning skrevet som tekst: «2 H2 + O2 → 2 H2O», «CH3COOH(aq) + H2O(l) ⇌ CH3COO^-(aq) + H3O^+(aq)».
 * Plusstegnet mellom stoffene må ha mellomrom rundt seg (NH4+ er et ion). Pil: →, ->, ⇌ eller <=>.
 */
export function parseReaction(text: string): ReactionResult {
  const m = ARROW_RE.exec(text);
  if (!m) return { ok: false, error: 'Likningen mangler pil (→ eller ⇌).' };
  const left = text.slice(0, m.index);
  const right = text.slice(m.index + m[0].length);
  if (ARROW_RE.test(right)) return { ok: false, error: 'Likningen kan bare ha én pil.' };
  const equilibrium = ['⇌', '<=>', '<->', '⇄'].includes(m[1]!);
  const side = (s: string, name: string): Term[] | string => {
    const t = s.trim();
    if (!t || /^\+(\s|$)|\s\+$/.test(t)) return `Det mangler et stoff på ${name}.`;
    const parts = t.split(/\s+\+\s+/);
    if (parts.length === 0 || parts.some((p) => !p.trim())) return `Det mangler et stoff på ${name}.`;
    const terms: Term[] = [];
    for (const raw of parts) {
      const c = /^(\d+\/\d+|\d+(?:[.,]\d+)?|½)\s*/.exec(raw.trim());
      let coef = 1;
      let f = raw.trim();
      if (c && !/^\d/.test(f.slice(c[0].length)) && f.slice(c[0].length)) {
        const t = c[1]!;
        coef = t === '½' ? 0.5 : t.includes('/') ? Number(t.split('/')[0]) / Number(t.split('/')[1]) : Number(t.replace(',', '.'));
        f = f.slice(c[0].length);
      }
      const r = parseFormula(f);
      if (!r.ok) return `${f}: ${r.error}`;
      terms.push({ coef, formula: f });
    }
    return terms;
  };
  const reactants = side(left, 'venstre side');
  if (typeof reactants === 'string') return { ok: false, error: reactants };
  const products = side(right, 'høyre side');
  if (typeof products === 'string') return { ok: false, error: products };
  return { ok: true, reaction: { reactants, products, equilibrium } };
}

/** Som `parseReaction`, men kaster en feil. */
export function reaction(text: string): Reaction {
  const r = parseReaction(text);
  if (!r.ok) throw new Error(`${text}: ${r.error}`);
  return r.reaction;
}

/** Koeffisient som tekst: 1 → «», 2 → «2», 0,5 → «½», 1,5 → «3/2». */
export function coefText(c: number): string {
  if (c === 1) return '';
  if (Number.isInteger(c)) return String(c);
  if (c === 0.5) return '½';
  if (Number.isInteger(c * 2)) return `${c * 2}/2`;
  return fmt(c, 2);
}

/** Hele likningen som Unicode-tekst: «2 H₂ + O₂ → 2 H₂O». */
export function reactionText(r: Reaction, withState = false): string {
  const side = (ts: Term[]) =>
    ts
      .map((t) => {
        const p = formula(t.formula);
        const st = t.state ?? (withState ? p.state : null);
        const c = coefText(t.coef);
        return `${c ? `${c} ` : ''}${formulaText(p)}${withState && st ? `(${st})` : ''}`;
      })
      .join(' + ');
  return `${side(r.reactants)} ${r.equilibrium ? '⇌' : '→'} ${side(r.products)}`;
}

export interface BalanceCheck {
  /** Like mange atomer av hvert grunnstoff og lik ladning på begge sider. */
  balanced: boolean;
  atomsBalanced: boolean;
  chargeBalanced: boolean;
  /** Atomtelling per grunnstoff (i rekkefølgen de først dukker opp). */
  atoms: { symbol: string; left: number; right: number }[];
  chargeLeft: number;
  chargeRight: number;
}

const EPS = 1e-9;

/** Sjekker at en reaksjonslikning er balansert: samme antall atomer av hvert grunnstoff og samme ladning på begge sider. */
export function checkBalance(r: Reaction | string): BalanceCheck {
  const rx = typeof r === 'string' ? reaction(r) : r;
  const tally = (ts: Term[]) => {
    const atoms = new Map<string, number>();
    let charge = 0;
    for (const t of ts) {
      const p = formula(t.formula);
      for (const [sym, n] of Object.entries(p.atoms)) atoms.set(sym, (atoms.get(sym) ?? 0) + n * t.coef);
      charge += p.charge * t.coef;
    }
    return { atoms, charge };
  };
  const L = tally(rx.reactants);
  const R = tally(rx.products);
  const symbols = [...new Set([...L.atoms.keys(), ...R.atoms.keys()])];
  const atoms = symbols.map((symbol) => ({ symbol, left: L.atoms.get(symbol) ?? 0, right: R.atoms.get(symbol) ?? 0 }));
  const atomsBalanced = atoms.every((a) => Math.abs(a.left - a.right) < EPS);
  const chargeBalanced = Math.abs(L.charge - R.charge) < EPS;
  return { balanced: atomsBalanced && chargeBalanced, atomsBalanced, chargeBalanced, atoms, chargeLeft: L.charge, chargeRight: R.charge };
}

/* ---------- Balansering ---------- */

const gcd = (a: number, b: number): number => {
  a = Math.abs(a);
  b = Math.abs(b);
  while (b) [a, b] = [b, a % b];
  return a;
};

/** Brøk a/b med heltall (b > 0). */
type Frac = [number, number];
const frac = (n: number, d = 1): Frac => {
  if (d < 0) [n, d] = [-n, -d];
  const g = gcd(n, d) || 1;
  return [n / g, d / g];
};
const sub = (a: Frac, b: Frac): Frac => frac(a[0] * b[1] - b[0] * a[1], a[1] * b[1]);
const mul = (a: Frac, b: Frac): Frac => frac(a[0] * b[0], a[1] * b[1]);
const div = (a: Frac, b: Frac): Frac => frac(a[0] * b[1], a[1] * b[0]);

/**
 * Finner de minste heltallige koeffisientene som balanserer likningen (atomer og ladning), f.eks.
 * balanceCoefficients(['C3H8', 'O2'], ['CO2', 'H2O']) → [1, 5, 3, 4].
 * Gir null hvis likningen ikke kan balanseres, eller hvis den kan balanseres på flere uavhengige måter.
 */
export function balanceCoefficients(reactants: string[], products: string[]): number[] | null {
  const species = [...reactants.map((f) => ({ f: formula(f), sign: 1 })), ...products.map((f) => ({ f: formula(f), sign: -1 }))];
  const symbols = [...new Set(species.flatMap((s) => Object.keys(s.f.atoms)))];
  const rows: Frac[][] = symbols.map((sym) => species.map((s) => frac((s.f.atoms[sym] ?? 0) * s.sign)));
  if (species.some((s) => s.f.charge !== 0)) rows.push(species.map((s) => frac(s.f.charge * s.sign)));
  const cols = species.length;
  // Redusert trappeform
  const pivots: number[] = [];
  let r = 0;
  for (let c = 0; c < cols && r < rows.length; c++) {
    const p = rows.findIndex((row, i) => i >= r && row[c]![0] !== 0);
    if (p < 0) continue;
    [rows[r], rows[p]] = [rows[p]!, rows[r]!];
    const pr = rows[r]!;
    const pv = pr[c]!;
    for (let k = 0; k < cols; k++) pr[k] = div(pr[k]!, pv);
    for (let i = 0; i < rows.length; i++) {
      if (i === r) continue;
      const f = rows[i]![c]!;
      if (f[0] === 0) continue;
      for (let k = 0; k < cols; k++) rows[i]![k] = sub(rows[i]![k]!, mul(f, pr[k]!));
    }
    pivots.push(c);
    r++;
  }
  const free = Array.from({ length: cols }, (_, c) => c).filter((c) => !pivots.includes(c));
  if (free.length !== 1) return null;
  const fc = free[0]!;
  const x: Frac[] = Array.from({ length: cols }, () => frac(0));
  x[fc] = frac(1);
  pivots.forEach((c, i) => {
    x[c] = frac(-rows[i]![fc]![0], rows[i]![fc]![1]);
  });
  const lcm = x.reduce((l, [, d]) => (l * d) / gcd(l, d), 1);
  let ints = x.map(([n, d]) => (n * lcm) / d);
  if (ints.every((v) => v <= 0)) ints = ints.map((v) => -v);
  if (ints.some((v) => v <= 0)) return null;
  const g = ints.reduce((a, b) => gcd(a, b));
  return ints.map((v) => v / g);
}
