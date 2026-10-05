/**
 * Strukturformler for organiske molekyler, uten React (testes i model.test.ts).
 *
 * Et molekyl beskrives som en kjede av tunge atomer (C, O, Cl, Br …) med grener, eller med egne koordinater.
 * Herfra lages:
 *   - strukturformelen (alle atomer og bindinger) på et rutenett som i lærebøkene: kjeden vannrett, grener opp/ned,
 *     H-atomene i de ledige retningene (90° mellom bindingene ved enkeltbundet C, 120° ved dobbeltbundet C)
 *   - skjelettformelen (sikksakk, bare heteroatomer har bokstav)
 *   - forenklet strukturformel (CH₃–CH(CH₃)–CH₃) og molekylformel (C₄H₁₀)
 *
 * Koordinater: enhet = én C–C-binding, y opp, vinkler i grader mot klokka (som i kit-ets geometri).
 * H-atomer sitter 0,6 enheter fra atomet sitt.
 */

export type El = 'C' | 'H' | 'O' | 'N' | 'Cl' | 'Br' | 'I';
export type Order = 1 | 2 | 3;

export const VALENCE: Record<El, number> = { C: 4, H: 1, O: 2, N: 3, Cl: 1, Br: 1, I: 1 };

/** Bindingslengde til H (enhet = C–C). */
export const H_BOND = 0.6;

export interface P {
  x: number;
  y: number;
}

export interface MolAtom {
  el: El;
  /** Plass i strukturformelen (rutenett, y opp). */
  p: P;
  /** Plass i skjelettformelen, null for H-atomer (de tegnes ikke der). */
  z: P | null;
  /** H som er lagt til automatisk for å fylle opp valensen. */
  implicit: boolean;
  /** Nummer i kjeden (0-basert) for kjedeatomer. */
  chain?: number;
  /** Kjedeatomet atomet hører til (for å gi kjeden mer plass der grener kolliderer). */
  anchor: number;
}

export interface MolBond {
  a: number;
  b: number;
  order: Order;
}

export interface Mol {
  atoms: MolAtom[];
  bonds: MolBond[];
  /** Kjedeatomene i rekkefølge (indekser i atoms). Tom for egne molekyler uten kjede. */
  chain: number[];
  /** Kjeden er lukket til en ring. */
  ring: boolean;
}

export interface BranchSpec {
  /** Kjedeatomet (0-basert) grenen sitter på. */
  at: number;
  /**
   * Retning i strukturformelen: opp, ned, ut fra enden av kjeden, eller til venstre/høyre (for et enkelt C).
   * I en ring peker alle grener utover.
   */
  side: 'up' | 'down' | 'out' | 'left' | 'right';
  /** Atomene i grenen, fra kjeden og utover, f.eks. ['C', 'C'] for etyl, ['O'] for OH, ['Cl']. */
  atoms: El[];
  /** Bindingsordenen langs grenen; første tall er bindingen til kjeden (standard 1). */
  orders?: Order[];
}

export interface MolSpec {
  /** De tunge atomene i hovedkjeden fra venstre mot høyre. Eksplisitte H kan også stå her (f.eks. ['C', 'H']). */
  chain: El[];
  /** Bindingsordenen mellom kjedeatom i og i + 1 (standard 1). */
  orders?: Order[];
  branches?: BranchSpec[];
  /** Lukk kjeden til en ring (syklobutan). */
  ring?: boolean;
}

export interface CustomSpec {
  /** Atomer med egne koordinater i strukturformelen (og eventuelt skjelettformelen, ellers samme). */
  atoms: { el: El; p: [number, number]; z?: [number, number] }[];
  bonds: [number, number, Order?][];
}

/* ---------- Små vektorhjelpere (y opp) ---------- */

const rad = (deg: number) => (deg * Math.PI) / 180;
export const norm360 = (deg: number) => ((deg % 360) + 360) % 360;
export function step(p: P, len: number, deg: number): P {
  return { x: p.x + len * Math.cos(rad(deg)), y: p.y + len * Math.sin(rad(deg)) };
}
export function dirOf(a: P, b: P): number {
  return norm360((Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI);
}
export const dist = (a: P, b: P) => Math.hypot(a.x - b.x, a.y - b.y);

/**
 * Retningene til `count` nye bindinger rundt et atom som allerede har bindinger i retningene `dirs`.
 * De nye fordeles i de største ledige vinklene, jevnt innen hver: to bindinger i en rett kjede gir H opp og ned,
 * én binding gir et kors (90°), og én binding ved et dobbeltbundet C (to nye) gir 120°.
 */
export function freeDirections(dirs: number[], count: number): number[] {
  if (count <= 0) return [];
  if (dirs.length === 0) {
    if (count === 4) return [90, 0, 270, 180];
    if (count === 3) return [90, 210, 330];
    if (count === 2) return [217.75, 322.25];
    return Array.from({ length: count }, (_, i) => norm360(90 + (360 * i) / count));
  }
  const sorted = [...dirs].map(norm360).sort((a, b) => a - b);
  const gaps = sorted.map((d, i) => {
    const next = i + 1 < sorted.length ? sorted[i + 1]! : sorted[0]! + 360;
    return { start: d, size: next - d, n: 0 };
  });
  for (let h = 0; h < count; h++) {
    let best = gaps[0]!;
    for (const g of gaps) {
      const s = g.size / (g.n + 1);
      const sb = best.size / (best.n + 1);
      if (s > sb + 1e-9 || (Math.abs(s - sb) < 1e-9 && g.size > best.size + 1e-9)) best = g;
    }
    best.n++;
  }
  const out: number[] = [];
  for (const g of gaps) for (let j = 1; j <= g.n; j++) out.push(norm360(g.start + (g.size * j) / (g.n + 1)));
  return out;
}

/* ---------- Bygging ---------- */

interface Raw {
  atoms: { el: El; p: P; z: P | null; chain?: number; anchor: number }[];
  bonds: MolBond[];
}

function chainStep(a: El, b: El): number {
  return a === 'H' || b === 'H' ? H_BOND : 1;
}

/** Plasseringer i strukturformelen for en kjede med gitte avstander mellom kjedeatomene. */
function buildGrid(spec: MolSpec, gaps: number[]): Raw {
  const n = spec.chain.length;
  const atoms: Raw['atoms'] = [];
  const bonds: MolBond[] = [];
  const ring = !!spec.ring && n >= 3;
  let centre: P = { x: 0, y: 0 };
  if (ring) {
    const R = 1 / (2 * Math.sin(Math.PI / n));
    const start = 270 - 180 / n;
    spec.chain.forEach((el, i) => atoms.push({ el, p: step(centre, R, start + (360 * i) / n), z: null, chain: i, anchor: i }));
  } else {
    let x = 0;
    spec.chain.forEach((el, i) => {
      if (i > 0) x += gaps[i - 1] ?? chainStep(spec.chain[i - 1]!, el);
      atoms.push({ el, p: { x, y: 0 }, z: null, chain: i, anchor: i });
    });
    centre = { x: x / 2, y: 0 };
  }
  for (let i = 0; i + 1 < n; i++) bonds.push({ a: i, b: i + 1, order: spec.orders?.[i] ?? 1 });
  if (ring) bonds.push({ a: n - 1, b: 0, order: spec.orders?.[n - 1] ?? 1 });
  const perAtom = new Map<number, number>();
  for (const br of spec.branches ?? []) {
    const base = atoms[br.at];
    if (!base) continue;
    let deg: number;
    if (ring) {
      const k = perAtom.get(br.at) ?? 0;
      perAtom.set(br.at, k + 1);
      deg = dirOf(centre, base.p) + (k === 0 ? 0 : k === 1 ? 40 : -40);
    } else
      deg =
        br.side === 'up' ? 90 : br.side === 'down' ? 270 : br.side === 'left' ? 180 : br.side === 'right' ? 0 : br.at === 0 && n > 1 ? 180 : 0;
    let prev = br.at;
    let prevEl = base.el;
    let p = base.p;
    br.atoms.forEach((el, j) => {
      p = step(p, chainStep(prevEl, el), deg);
      const idx = atoms.length;
      atoms.push({ el, p, z: null, anchor: br.at });
      bonds.push({ a: prev, b: idx, order: br.orders?.[j] ?? 1 });
      prev = idx;
      prevEl = el;
    });
  }
  return { atoms, bonds };
}

/** Skjelettformelen: sikksakk for kjeden (rett gjennom trippelbindinger), grener i de ledige vinklene. */
function buildZig(spec: MolSpec, raw: Raw): void {
  const isH = (i: number) => raw.atoms[i]!.el === 'H';
  const nbrs = (i: number) => raw.bonds.filter((b) => b.a === i || b.b === i).map((b) => (b.a === i ? b.b : b.a));
  const triple = (i: number) => raw.bonds.some((b) => b.order === 3 && (b.a === i || b.b === i));
  const chainHeavy = raw.atoms.map((a, i) => ({ a, i })).filter(({ a }) => a.chain !== undefined && a.el !== 'H');
  if (spec.ring && spec.chain.length >= 3) {
    for (const { a } of chainHeavy) a.z = { ...a.p };
  } else {
    // Start i origo, første binding 30° opp, så vekselvis ned og opp. Et atom med trippelbinding gir rett linje.
    let d = 30;
    let p: P = { x: 0, y: 0 };
    chainHeavy.forEach(({ a, i }, j) => {
      if (j > 0) {
        p = step(p, 1, d);
        if (!triple(i)) d = d === 30 ? -30 : 30;
      }
      a.z = p;
    });
  }
  const placed = () => raw.atoms.filter((a) => a.z !== null).map((a) => a.z!);
  const roomiest = (from: P, opts: number[]) =>
    opts.reduce((best, o) => (minDistance(step(from, 1, o), placed()) > minDistance(step(from, 1, best), placed()) + 0.02 ? o : best), opts[0]!);
  // Grenene legges ut i bredden fra kjeden (kjedeatomene først, så videre utover).
  const queue = chainHeavy.map(({ i }) => i);
  while (queue.length > 0) {
    const i = queue.shift()!;
    const pz = raw.atoms[i]!.z!;
    const kids = nbrs(i).filter((j) => !isH(j) && raw.atoms[j]!.z === null);
    if (kids.length === 0) continue;
    const known = nbrs(i)
      .filter((j) => !isH(j) && raw.atoms[j]!.z !== null)
      .map((j) => dirOf(pz, raw.atoms[j]!.z!));
    let dirs: number[];
    if (known.length === 1 && kids.length === 1) {
      // Fortsett sikksakken (eller rett fram gjennom en trippelbinding), dit det er mest plass.
      const ahead = norm360(known[0]! + 180);
      const opts = triple(i) ? [ahead] : raw.atoms[i]!.chain !== undefined ? [norm360(ahead - 60), norm360(ahead + 60)] : [norm360(ahead - 60), norm360(ahead + 60), ahead];
      dirs = [roomiest(pz, opts)];
    } else dirs = freeDirections(known, kids.length);
    kids.forEach((j, m) => {
      raw.atoms[j]!.z = step(pz, 1, dirs[m] ?? 90);
      queue.push(j);
    });
  }
}

function minDistance(p: P, others: P[]): number {
  let m = Infinity;
  for (const o of others) {
    const d = dist(p, o);
    if (d > 1e-6) m = Math.min(m, d);
  }
  return m;
}

/** Legger til H-atomer så hvert tunge atom får full valens. */
function addHydrogens(raw: Raw): Mol {
  const atoms: MolAtom[] = raw.atoms.map((a) => ({ el: a.el, p: a.p, z: a.el === 'H' ? null : a.z, implicit: false, chain: a.chain, anchor: a.anchor }));
  const bonds = [...raw.bonds];
  const n0 = atoms.length;
  for (let i = 0; i < n0; i++) {
    const a = atoms[i]!;
    if (a.el === 'H') continue;
    const mine = raw.bonds.filter((b) => b.a === i || b.b === i);
    const used = mine.reduce((s, b) => s + b.order, 0);
    const count = Math.max(0, VALENCE[a.el] - used);
    const dirs = mine.map((b) => dirOf(a.p, atoms[b.a === i ? b.b : b.a]!.p));
    for (const d of freeDirections(dirs, count)) {
      bonds.push({ a: i, b: atoms.length, order: 1 });
      atoms.push({ el: 'H', p: step(a.p, H_BOND, d), z: null, implicit: true, anchor: a.anchor });
    }
  }
  return { atoms, bonds, chain: atoms.map((a, i) => (a.chain !== undefined ? i : -1)).filter((i) => i >= 0), ring: false };
}

/** Par av atomer som står for nær hverandre uten å være bundet (for å gi kjeden mer plass). */
export function collisions(mol: Mol, min = 0.52): [number, number][] {
  const bonded = new Set(mol.bonds.map((b) => `${Math.min(b.a, b.b)}-${Math.max(b.a, b.b)}`));
  const out: [number, number][] = [];
  for (let i = 0; i < mol.atoms.length; i++)
    for (let j = i + 1; j < mol.atoms.length; j++) {
      if (bonded.has(`${i}-${j}`)) continue;
      if (dist(mol.atoms[i]!.p, mol.atoms[j]!.p) < min) out.push([i, j]);
    }
  return out;
}

/**
 * Bygger et molekyl fra en kjede med grener: strukturformel (med H), skjelettformel og kjedeinformasjon.
 * Når grener på naboatomer kommer for nær hverandre, får kjeden mer plass akkurat der.
 */
export function molecule(spec: MolSpec): Mol {
  const n = spec.chain.length;
  const gaps = Array.from({ length: Math.max(0, n - 1) }, (_, i) => chainStep(spec.chain[i]!, spec.chain[i + 1]!));
  let mol = buildFrom(spec, gaps);
  if (!spec.ring) {
    for (let iter = 0; iter < 16; iter++) {
      const hits = collisions(mol);
      if (hits.length === 0) break;
      let changed = false;
      for (const [i, j] of hits) {
        const a = mol.atoms[i]!.anchor;
        const b = mol.atoms[j]!.anchor;
        if (a === b) continue;
        const lo = Math.min(a, b);
        const hi = Math.max(a, b);
        for (let k = lo; k < hi; k++) gaps[k] = gaps[k]! + 0.2 / (hi - lo);
        changed = true;
      }
      if (!changed) break;
      mol = buildFrom(spec, gaps);
    }
  }
  return mol;
}

function buildFrom(spec: MolSpec, gaps: number[]): Mol {
  const raw = buildGrid(spec, gaps);
  buildZig(spec, raw);
  const mol = addHydrogens(raw);
  mol.ring = !!spec.ring && spec.chain.length >= 3;
  return mol;
}

/** Molekyl med egne koordinater (cis/trans-isomerer, vann). H-atomer som mangler, legges til. */
export function customMolecule(spec: CustomSpec): Mol {
  const raw: Raw = {
    atoms: spec.atoms.map((a) => ({ el: a.el, p: { x: a.p[0], y: a.p[1] }, z: a.el === 'H' ? null : a.z ? { x: a.z[0], y: a.z[1] } : { x: a.p[0], y: a.p[1] }, anchor: 0 })),
    bonds: spec.bonds.map(([a, b, o]) => ({ a, b, order: o ?? 1 })),
  };
  const mol = addHydrogens(raw);
  mol.chain = [];
  return mol;
}

/* ---------- Avledede størrelser ---------- */

export function neighbours(mol: Mol, i: number): { j: number; order: Order }[] {
  return mol.bonds.filter((b) => b.a === i || b.b === i).map((b) => ({ j: b.a === i ? b.b : b.a, order: b.order }));
}

/** Antall H bundet til atomet (implisitte og eksplisitte). */
export function hydrogenCount(mol: Mol, i: number): number {
  return neighbours(mol, i).filter(({ j }) => mol.atoms[j]!.el === 'H').length;
}

/** Molekylformelen etter Hill-systemet: C først, så H, så resten alfabetisk (C2H6O, CH3Cl, C2H4Br2). */
export function molFormula(mol: Mol): string {
  const count: Record<string, number> = {};
  for (const a of mol.atoms) count[a.el] = (count[a.el] ?? 0) + 1;
  const keys = Object.keys(count);
  const order = count.C ? ['C', 'H', ...keys.filter((k) => k !== 'C' && k !== 'H').sort()] : keys.sort();
  return order
    .filter((k) => count[k])
    .map((k) => `${k}${count[k] === 1 ? '' : count[k]}`)
    .join('');
}

/** Atomtelling { C: 2, H: 6, O: 1 }. */
export function atomTally(mol: Mol): Record<string, number> {
  const count: Record<string, number> = {};
  for (const a of mol.atoms) count[a.el] = (count[a.el] ?? 0) + 1;
  return count;
}

const SUB = '₀₁₂₃₄₅₆₇₈₉';
/** Sifrene som senket skrift: «CH3» → «CH₃». */
export const subscriptDigits = (s: string) => s.replace(/\d/g, (d) => SUB[Number(d)]!);

const BOND_SYMBOL: Record<Order, string> = { 1: '–', 2: '=', 3: '≡' };

/** Atomet med H-ene sine, f.eks. «CH3», «OH», «C». */
function group(mol: Mol, i: number): string {
  const a = mol.atoms[i]!;
  const h = hydrogenCount(mol, i);
  return `${a.el}${h ? `H${h > 1 ? h : ''}` : ''}`;
}

/** Forenklet formel for en gren (alt som henger på `i` bortsett fra `from`). */
function branchText(mol: Mol, i: number, from: number): string {
  const kids = neighbours(mol, i).filter(({ j }) => j !== from && mol.atoms[j]!.el !== 'H');
  let s = group(mol, i);
  for (const { j } of kids) s += `${kids.length > 1 ? '(' : ''}${branchText(mol, j, i)}${kids.length > 1 ? ')' : ''}`;
  return s;
}

/**
 * Forenklet strukturformel som tekst med vanlige sifre: «CH3–CH(CH3)–CH3», «CH3–COOH», «CH2=CH2», «HO–CH2–CH3».
 * Grener står i parentes, like grener slås sammen (C(CH3)2), og halogener står uten parentes (CHCl). Null for ringer
 * og molekyler uten kjede.
 */
export function condensed(mol: Mol): string | null {
  if (mol.ring) return null;
  const chain = mol.chain.filter((i) => mol.atoms[i]!.el !== 'H');
  if (chain.length === 0) return null;
  const inChain = new Set(chain);
  let out = '';
  for (let k = 0; k < chain.length; k++) {
    const i = chain[k]!;
    const a = mol.atoms[i]!;
    const nb = neighbours(mol, i);
    const h = hydrogenCount(mol, i);
    let last = i;
    let s: string;
    const next = chain[k + 1];
    const carbonylO = a.el === 'C' ? nb.find(({ j, order }) => order === 2 && mol.atoms[j]!.el === 'O' && !inChain.has(j)) : undefined;
    if (carbonylO && next !== undefined && mol.atoms[next]!.el === 'O') {
      // Karboksylgruppe og esterbinding: HCOOH, CH3–COOH, CH3–COO–CH2–CH3
      s = `${h ? 'H' : ''}COO${hydrogenCount(mol, next) ? 'H' : ''}`;
      last = next;
      k++;
    } else if (k === 0 && a.el !== 'C' && h > 0 && chain.length > 1) {
      s = `H${h > 1 ? h : ''}${a.el}`;
    } else {
      s = group(mol, i);
      const side = nb.filter(({ j }) => !inChain.has(j) && mol.atoms[j]!.el !== 'H');
      const halogens: Record<string, number> = {};
      const texts = new Map<string, number>();
      for (const { j, order } of side) {
        const el = mol.atoms[j]!.el;
        if ((el === 'Cl' || el === 'Br' || el === 'I') && neighbours(mol, j).length === 1) halogens[el] = (halogens[el] ?? 0) + 1;
        else {
          const t = `${order === 2 ? '=' : ''}${branchText(mol, j, i)}`;
          texts.set(t, (texts.get(t) ?? 0) + 1);
        }
      }
      for (const [el, c] of Object.entries(halogens)) s += `${el}${c > 1 ? c : ''}`;
      const end = k === chain.length - 1 && chain.length > 1;
      for (const [t, c] of texts) s += c === 1 && end && texts.size === 1 && t === 'OH' ? t : `(${t})${c > 1 ? c : ''}`;
    }
    out += s;
    const following = chain[k + 1];
    if (following !== undefined) out += BOND_SYMBOL[bondOrder(mol, last, following)];
  }
  return out;
}

function bondOrder(mol: Mol, a: number, b: number): Order {
  return mol.bonds.find((x) => (x.a === a && x.b === b) || (x.a === b && x.b === a))?.order ?? 1;
}

export interface Bounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

export type View = 'struktur' | 'skjelett' | 'kule';

/** Ytterpunktene til atomene i en visning (enheter, y opp). Skjelettformelen tar bare med tunge atomer. */
export function bounds(mol: Mol, view: View): Bounds {
  const pts = view === 'skjelett' ? mol.atoms.filter((a) => a.z).map((a) => a.z!) : mol.atoms.map((a) => a.p);
  if (pts.length === 0) return { minX: 0, maxX: 0, minY: 0, maxY: 0 };
  return {
    minX: Math.min(...pts.map((p) => p.x)),
    maxX: Math.max(...pts.map((p) => p.x)),
    minY: Math.min(...pts.map((p) => p.y)),
    maxY: Math.max(...pts.map((p) => p.y)),
  };
}

export type GroupKind = 'dobbeltbinding' | 'trippelbinding' | 'hydroksyl' | 'karboksyl' | 'ester' | 'eter' | 'halogen';

export interface FunctionalGroup {
  kind: GroupKind;
  atoms: number[];
}

/** De funksjonelle gruppene i molekylet (C=C, C≡C, –OH, –COOH, –COO–, –O–, halogen). */
export function functionalGroups(mol: Mol): FunctionalGroup[] {
  const out: FunctionalGroup[] = [];
  const used = new Set<number>();
  mol.atoms.forEach((a, i) => {
    if (a.el !== 'C') return;
    const nb = neighbours(mol, i);
    const dO = nb.find(({ j, order }) => order === 2 && mol.atoms[j]!.el === 'O');
    const sO = nb.find(({ j, order }) => order === 1 && mol.atoms[j]!.el === 'O');
    if (dO && sO) {
      const oH = neighbours(mol, sO.j).find(({ j }) => mol.atoms[j]!.el === 'H');
      const other = neighbours(mol, sO.j).find(({ j }) => j !== i && mol.atoms[j]!.el === 'C');
      const atoms = [i, dO.j, sO.j, ...(oH ? [oH.j] : [])];
      atoms.forEach((x) => used.add(x));
      out.push({ kind: oH ? 'karboksyl' : other ? 'ester' : 'karboksyl', atoms });
    }
  });
  mol.bonds.forEach((b) => {
    const A = mol.atoms[b.a]!;
    const B = mol.atoms[b.b]!;
    if (A.el === 'C' && B.el === 'C' && b.order > 1) out.push({ kind: b.order === 2 ? 'dobbeltbinding' : 'trippelbinding', atoms: [b.a, b.b] });
  });
  mol.atoms.forEach((a, i) => {
    if (used.has(i)) return;
    if (a.el === 'O') {
      const nb = neighbours(mol, i);
      const h = nb.find(({ j }) => mol.atoms[j]!.el === 'H');
      const cs = nb.filter(({ j }) => mol.atoms[j]!.el === 'C');
      if (h && cs.length === 1) out.push({ kind: 'hydroksyl', atoms: [i, h.j] });
      else if (cs.length === 2 && nb.every(({ order }) => order === 1)) out.push({ kind: 'eter', atoms: [i] });
    }
    if ((a.el === 'Cl' || a.el === 'Br' || a.el === 'I') && neighbours(mol, i).some(({ j }) => mol.atoms[j]!.el === 'C')) out.push({ kind: 'halogen', atoms: [i] });
  });
  return out;
}

/** Deler en tekst i linjer på høyst `max` tegn (ved mellomrom), til SVG-tekst som ikke brytes av seg selv. */
export function wrapText(text: string, max: number): string[] {
  const lines: string[] = [];
  let cur = '';
  for (const w of text.split(' ')) {
    if (cur && `${cur} ${w}`.length > max) {
      lines.push(cur);
      cur = w;
    } else cur = cur ? `${cur} ${w}` : w;
  }
  if (cur) lines.push(cur);
  return lines;
}
