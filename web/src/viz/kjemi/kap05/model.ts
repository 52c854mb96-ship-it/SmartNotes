/**
 * Kapittel 5 Organisk kjemi (Kjemi 1): homologe rekker, navnsetting etter IUPAC (på norsk), isomeri og
 * reaksjonstyper. Ren kjemi uten React, testet i model.test.ts. Strukturformlene bygges i struktur.ts.
 *
 * Kokepunkter (°C ved 1 atm) er fra CRC Handbook of Chemistry and Physics (97. utg., «Physical Constants of Organic
 * Compounds»), avrundet til én desimal. Lærebøkene bruker ofte hele grader (etanol 78 °C, eddiksyre 118 °C).
 */
import { molecule, customMolecule, neighbours, type El, type Mol, type MolSpec, type Order, type BranchSpec } from './struktur';

/* ====================================================================== */
/* Navnestammer                                                             */
/* ====================================================================== */

/** Stammen for 1–12 karbonatomer i hovedkjeden (met, et, prop, but …). */
export const STEMS = ['', 'met', 'et', 'prop', 'but', 'pent', 'heks', 'hept', 'okt', 'non', 'dek', 'undek', 'dodek'] as const;

export function stem(n: number): string {
  return STEMS[n] ?? `C${n}-`;
}

/* ====================================================================== */
/* Homologe rekker                                                          */
/* ====================================================================== */

export type SeriesId = 'alkaner' | 'alkener' | 'alkyner' | 'alkoholer' | 'karboksylsyrer';

export interface SeriesMember {
  n: number;
  name: string;
  /** Kokepunkt (°C, 1 atm). */
  bp: number;
  /** Vanlig navn i parentes (eddiksyre, maursyre …). */
  trivial?: string;
  /** Etyn har ikke kokepunkt ved 1 atm: det sublimerer (går rett fra fast stoff til gass). */
  sublimes?: boolean;
}

export interface Series {
  id: SeriesId;
  /** «Alkaner». */
  name: string;
  /** «alkan». */
  singular: string;
  /** Endelsen i navnet. */
  ending: string;
  /** Minste antall karbonatomer. */
  nMin: number;
  /** Generell formel som tekst med vanlige sifre/bokstaver, vises med senket skrift. */
  general: string;
  /** Den funksjonelle gruppa, kort. */
  group: string;
  /** Kan danne hydrogenbindinger mellom molekylene. */
  hbond: boolean;
  members: SeriesMember[];
}

/** De fem homologe rekkene med rettkjedede stoffer C₁–C₈ og kokepunkter fra CRC Handbook. */
export const SERIES: Series[] = [
  {
    id: 'alkaner',
    name: 'Alkaner',
    singular: 'alkan',
    ending: '-an',
    nMin: 1,
    general: 'CnH2n+2',
    group: 'bare enkeltbindinger',
    hbond: false,
    members: [
      { n: 1, name: 'metan', bp: -161.5 },
      { n: 2, name: 'etan', bp: -88.6 },
      { n: 3, name: 'propan', bp: -42.1 },
      { n: 4, name: 'butan', bp: -0.5 },
      { n: 5, name: 'pentan', bp: 36.1 },
      { n: 6, name: 'heksan', bp: 68.7 },
      { n: 7, name: 'heptan', bp: 98.4 },
      { n: 8, name: 'oktan', bp: 125.6 },
    ],
  },
  {
    id: 'alkener',
    name: 'Alkener',
    singular: 'alken',
    ending: '-en',
    nMin: 2,
    general: 'CnH2n',
    group: 'C=C (dobbeltbinding)',
    hbond: false,
    members: [
      { n: 2, name: 'eten', bp: -103.7 },
      { n: 3, name: 'propen', bp: -47.6 },
      { n: 4, name: 'but-1-en', bp: -6.3 },
      { n: 5, name: 'pent-1-en', bp: 30.0 },
      { n: 6, name: 'heks-1-en', bp: 63.4 },
      { n: 7, name: 'hept-1-en', bp: 93.6 },
      { n: 8, name: 'okt-1-en', bp: 121.3 },
    ],
  },
  {
    id: 'alkyner',
    name: 'Alkyner',
    singular: 'alkyn',
    ending: '-yn',
    nMin: 2,
    general: 'CnH2n−2',
    group: 'C≡C (trippelbinding)',
    hbond: false,
    members: [
      // Etyn (acetylen) sublimerer ved −84,7 °C og 1 atm (CRC: «sp»).
      { n: 2, name: 'etyn', bp: -84.7, trivial: 'acetylen', sublimes: true },
      { n: 3, name: 'propyn', bp: -23.2 },
      { n: 4, name: 'but-1-yn', bp: 8.1 },
      { n: 5, name: 'pent-1-yn', bp: 40.1 },
      { n: 6, name: 'heks-1-yn', bp: 71.3 },
      { n: 7, name: 'hept-1-yn', bp: 99.7 },
      { n: 8, name: 'okt-1-yn', bp: 126.3 },
    ],
  },
  {
    id: 'alkoholer',
    name: 'Alkoholer',
    singular: 'alkohol',
    ending: '-ol',
    nMin: 1,
    general: 'CnH2n+1OH',
    group: '–OH (hydroksylgruppe)',
    hbond: true,
    members: [
      { n: 1, name: 'metanol', bp: 64.7 },
      { n: 2, name: 'etanol', bp: 78.3 },
      { n: 3, name: 'propan-1-ol', bp: 97.2 },
      { n: 4, name: 'butan-1-ol', bp: 117.7 },
      { n: 5, name: 'pentan-1-ol', bp: 137.9 },
      { n: 6, name: 'heksan-1-ol', bp: 157.6 },
      { n: 7, name: 'heptan-1-ol', bp: 176.4 },
      { n: 8, name: 'oktan-1-ol', bp: 195.2 },
    ],
  },
  {
    id: 'karboksylsyrer',
    name: 'Karboksylsyrer',
    singular: 'karboksylsyre',
    ending: '-syre',
    nMin: 1,
    general: 'Cn−1H2n−1COOH',
    group: '–COOH (karboksylgruppe)',
    hbond: true,
    members: [
      { n: 1, name: 'metansyre', bp: 100.8, trivial: 'maursyre' },
      { n: 2, name: 'etansyre', bp: 117.9, trivial: 'eddiksyre' },
      { n: 3, name: 'propansyre', bp: 141.2 },
      { n: 4, name: 'butansyre', bp: 163.8, trivial: 'smørsyre' },
      { n: 5, name: 'pentansyre', bp: 186.1 },
      { n: 6, name: 'heksansyre', bp: 205.2 },
      { n: 7, name: 'heptansyre', bp: 222.2 },
      { n: 8, name: 'oktansyre', bp: 239.0 },
    ],
  },
];

export function series(id: SeriesId): Series {
  return SERIES.find((s) => s.id === id) ?? SERIES[0]!;
}

export function seriesMember(id: SeriesId, n: number): SeriesMember {
  const s = series(id);
  return s.members.find((m) => m.n === n) ?? s.members[0]!;
}

/** Strukturen til medlem nr. n i rekka (rettkjedet, funksjonell gruppe på C1 / enden av kjeden). */
export function seriesSpec(id: SeriesId, n: number): MolSpec {
  const C = Array.from({ length: n }, (): El => 'C');
  switch (id) {
    case 'alkaner':
      return { chain: C };
    case 'alkener':
      return { chain: C, orders: [2] };
    case 'alkyner':
      return { chain: C, orders: [3] };
    case 'alkoholer':
      return { chain: [...C, 'O'] };
    case 'karboksylsyrer':
      return { chain: [...C, 'O'], branches: [{ at: n - 1, side: 'up', atoms: ['O'], orders: [2] }] };
  }
}

/** Antall H i den generelle formelen for n karbonatomer (CₙH₂ₙ₊₂, CₙH₂ₙ, CₙH₂ₙ₋₂, CₙH₂ₙ₊₂O, CₙH₂ₙO₂). */
export function generalH(id: SeriesId, n: number): number {
  switch (id) {
    case 'alkaner':
    case 'alkoholer':
      return 2 * n + 2;
    case 'alkener':
    case 'karboksylsyrer':
      return 2 * n;
    case 'alkyner':
      return 2 * n - 2;
  }
}

/** Molekylformelen ut fra den generelle formelen (Hill-rekkefølge, som molFormula). */
export function generalFormula(id: SeriesId, n: number): string {
  const c = n === 1 ? 'C' : `C${n}`;
  const h = `H${generalH(id, n)}`;
  if (id === 'alkoholer') return `${c}${h}O`;
  if (id === 'karboksylsyrer') return `${c}${h}O2`;
  return `${c}${h}`;
}

/** Tilstand ved 25 °C ut fra kokepunktet (alle stoffene her smelter under 25 °C). */
export function stateAt25(bp: number): 'gass' | 'væske' {
  return bp < 25 ? 'gass' : 'væske';
}

/* ====================================================================== */
/* Navnsetting (IUPAC på norsk)                                             */
/* ====================================================================== */

export interface Substituent {
  /** «metyl», «klor», «(1-metyletyl)». */
  name: string;
  /** Nummeret i hovedkjeden. */
  locant: number;
  /** Atomet i hovedkjeden substituenten sitter på (indeks i Mol). */
  atom: number;
  /** Første atom i substituenten (indeks i Mol). */
  root: number;
}

export interface NameResult {
  name: string;
  /** Substituentene foran stamnavnet, f.eks. «3-etyl-2-metyl» (tom når det ikke er noen). */
  prefix: string;
  /** Stamnavnet med endelse, f.eks. «pentan», «but-3-en-2-ol». */
  parent: string;
  /** Hovedkjeden som atomindekser i Mol, fra C1. */
  chain: number[];
  substituents: Substituent[];
  /** Nummeret til C-atomet med OH, eller null. */
  ohLocant: number | null;
  /** Nummeret til den første av C-atomene i dobbelt- eller trippelbindingen, eller null. */
  multipleLocant: number | null;
  multiple: 'en' | 'yn' | null;
}

const HALOGEN_NAME: Partial<Record<El, string>> = { Cl: 'klor', Br: 'brom', I: 'jod' };
const MULT = ['', '', 'di', 'tri', 'tetra', 'penta', 'heksa'];
const MULT_COMPLEX = ['', '', 'bis', 'tris', 'tetrakis', 'pentakis', 'heksakis'];
/** Alfabetisk etter norsk rekkefølge (b, e, k, m …), uten parenteser og tall. */
const alphaKey = (s: string) => s.replace(/[()\d,-]/g, '');
const collate = (a: string, b: string) => alphaKey(a).localeCompare(alphaKey(b), 'nb');

interface CGraph {
  carbons: number[];
  adj: Map<number, { to: number; order: Order }[]>;
  halogens: Map<number, { el: El; atom: number }[]>;
  oh: Map<number, number>;
}

/** Karbonskjelettet til et molekyl, eller null når det har noe navngiveren ikke kan (ringer, eter, karbonyl …). */
function carbonGraph(mol: Mol): CGraph | null {
  if (mol.ring) return null;
  const carbons = mol.atoms.map((a, i) => (a.el === 'C' ? i : -1)).filter((i) => i >= 0);
  if (carbons.length === 0) return null;
  const adj = new Map<number, { to: number; order: Order }[]>();
  const halogens = new Map<number, { el: El; atom: number }[]>();
  const oh = new Map<number, number>();
  for (const c of carbons) {
    adj.set(c, []);
    halogens.set(c, []);
  }
  for (const b of mol.bonds) {
    const A = mol.atoms[b.a]!;
    const B = mol.atoms[b.b]!;
    if (A.el === 'C' && B.el === 'C') {
      adj.get(b.a)!.push({ to: b.b, order: b.order });
      adj.get(b.b)!.push({ to: b.a, order: b.order });
    }
  }
  for (let i = 0; i < mol.atoms.length; i++) {
    const a = mol.atoms[i]!;
    if (a.el === 'C' || a.el === 'H') continue;
    const nb = neighbours(mol, i);
    const cs = nb.filter(({ j }) => mol.atoms[j]!.el === 'C');
    if (HALOGEN_NAME[a.el] && nb.length === 1 && cs.length === 1) halogens.get(cs[0]!.j)!.push({ el: a.el, atom: i });
    else if (a.el === 'O' && cs.length === 1 && cs[0]!.order === 1 && nb.length === 2 && nb.some(({ j }) => mol.atoms[j]!.el === 'H')) {
      if (oh.has(cs[0]!.j)) return null;
      oh.set(cs[0]!.j, i);
    } else return null;
  }
  // Sammenhengende tre?
  const edges = [...adj.values()].reduce((s, l) => s + l.length, 0) / 2;
  if (edges !== carbons.length - 1) return null;
  const seen = new Set<number>([carbons[0]!]);
  const stack = [carbons[0]!];
  while (stack.length) {
    const c = stack.pop()!;
    for (const { to } of adj.get(c)!) if (!seen.has(to)) (seen.add(to), stack.push(to));
  }
  if (seen.size !== carbons.length) return null;
  if (oh.size > 1) return null;
  return { carbons, adj, halogens, oh };
}

function pathBetween(g: CGraph, u: number, v: number): number[] {
  const prev = new Map<number, number>([[u, -1]]);
  const queue = [u];
  while (queue.length) {
    const c = queue.shift()!;
    if (c === v) break;
    for (const { to } of g.adj.get(c)!)
      if (!prev.has(to)) {
        prev.set(to, c);
        queue.push(to);
      }
  }
  const path: number[] = [];
  for (let c = v; c !== -1; c = prev.get(c)!) path.push(c);
  return path.reverse();
}

function orderBetween(g: CGraph, a: number, b: number): Order {
  return g.adj.get(a)!.find((x) => x.to === b)?.order ?? 1;
}

/** Karbonatomene i en gren (alt som henger på `root` bortsett fra `from`). */
function subtree(g: CGraph, root: number, from: number): number[] {
  const out = [root];
  const stack = [root];
  const seen = new Set([root, from]);
  while (stack.length) {
    const c = stack.pop()!;
    for (const { to } of g.adj.get(c)!)
      if (!seen.has(to)) {
        seen.add(to);
        out.push(to);
        stack.push(to);
      }
  }
  return out;
}

/** Navnet på en alkylgruppe som starter i `root` (bundet til `from`): metyl, etyl, (1-metyletyl), (2-kloretyl) … */
function alkylName(g: CGraph, root: number, from: number): string {
  const sub = subtree(g, root, from);
  const set = new Set(sub);
  const hasHal = sub.some((c) => g.halogens.get(c)!.length > 0);
  // Lengste kjede fra root innen grenen (ved likhet: flest substituenter)
  let best: number[] = [root];
  for (const end of sub) {
    const p = pathBetween(g, root, end);
    if (!p.every((c) => set.has(c))) continue;
    if (p.length > best.length) best = p;
  }
  const linear = best.length === sub.length;
  if (linear && !hasHal) return `${stem(best.length)}yl`;
  const subs: { name: string; locant: number }[] = [];
  best.forEach((c, i) => {
    for (const h of g.halogens.get(c)!) subs.push({ name: HALOGEN_NAME[h.el]!, locant: i + 1 });
    for (const { to } of g.adj.get(c)!) {
      if (to === from || best.includes(to)) continue;
      subs.push({ name: alkylName(g, to, c), locant: i + 1 });
    }
  });
  return `(${prefixText(subs, best.length > 1)}${stem(best.length)}yl)`;
}

/** Prefiksene i alfabetisk rekkefølge med tall og di-/tri-: «2,2-dimetyl», «3-etyl-2-metyl», «bromklor». */
function prefixText(subs: { name: string; locant: number }[], locants: boolean): string {
  const groups = new Map<string, number[]>();
  for (const s of subs) groups.set(s.name, [...(groups.get(s.name) ?? []), s.locant]);
  const sorted = [...groups.entries()].sort((a, b) => collate(a[0], b[0]));
  const parts = sorted.map(([name, locs]) => {
    const n = locs.length;
    const mult = name.startsWith('(') ? MULT_COMPLEX[n] ?? '' : MULT[n] ?? '';
    const body = `${mult}${name}`;
    return locants ? `${locs.sort((a, b) => a - b).join(',')}-${body}` : body;
  });
  return parts.join(locants ? '-' : '');
}

interface Numbering {
  path: number[];
  subs: Substituent[];
  oh: number | null;
  multiple: number | null;
  multipleKind: 'en' | 'yn' | null;
}

function numberPath(g: CGraph, path: number[]): Numbering {
  const subs: Substituent[] = [];
  const onPath = new Set(path);
  let oh: number | null = null;
  let multiple: number | null = null;
  let multipleKind: 'en' | 'yn' | null = null;
  path.forEach((c, i) => {
    for (const h of g.halogens.get(c)!) subs.push({ name: HALOGEN_NAME[h.el]!, locant: i + 1, atom: c, root: h.atom });
    for (const { to } of g.adj.get(c)!) if (!onPath.has(to)) subs.push({ name: alkylName(g, to, c), locant: i + 1, atom: c, root: to });
    if (g.oh.has(c)) oh = i + 1;
    const next = path[i + 1];
    if (next !== undefined) {
      const o = orderBetween(g, c, next);
      if (o > 1 && multiple === null) {
        multiple = i + 1;
        multipleKind = o === 2 ? 'en' : 'yn';
      }
    }
  });
  return { path, subs, oh, multiple, multipleKind };
}

/** Sammenligner to nummereringer etter IUPAC-reglene: OH, så dobbeltbinding, så alle prefikser, så alfabetisk. */
function compareNumbering(a: Numbering, b: Numbering): { diff: number; rule: NumberingRule | null } {
  const inf = (v: number | null) => v ?? Infinity;
  if (inf(a.oh) !== inf(b.oh)) return { diff: inf(a.oh) - inf(b.oh), rule: 'oh' };
  if (inf(a.multiple) !== inf(b.multiple)) return { diff: inf(a.multiple) - inf(b.multiple), rule: 'dobbeltbinding' };
  const la = a.subs.map((s) => s.locant).sort((x, y) => x - y);
  const lb = b.subs.map((s) => s.locant).sort((x, y) => x - y);
  for (let i = 0; i < Math.min(la.length, lb.length); i++) if (la[i] !== lb[i]) return { diff: la[i]! - lb[i]!, rule: 'substituenter' };
  const alpha = (n: Numbering) =>
    [...n.subs].sort((x, y) => collate(x.name, y.name) || x.locant - y.locant).map((s) => s.locant);
  const aa = alpha(a);
  const ab = alpha(b);
  for (let i = 0; i < Math.min(aa.length, ab.length); i++) if (aa[i] !== ab[i]) return { diff: aa[i]! - ab[i]!, rule: 'alfabetisk' };
  return { diff: 0, rule: null };
}

export type NumberingRule = 'oh' | 'dobbeltbinding' | 'substituenter' | 'alfabetisk';

/** Setter sammen navnet for en nummerert hovedkjede. */
function assemble(n: Numbering): string {
  const p = nameParts(n);
  return `${p.prefix}${p.parent}`;
}

/** Navnet delt i prefikser (substituentene) og stamnavnet med endelse. */
function nameParts(n: Numbering): { prefix: string; parent: string } {
  const len = n.path.length;
  const features = n.subs.length + (n.oh !== null ? 1 : 0);
  // Tall som ikke trengs, utelates: metan-derivater, etan/eten med bare én gruppe, propen/propyn uten OH.
  const showSubs = len > 2 || (len === 2 && features > 1);
  const showOh = showSubs;
  const showMultiple = len > 3 || (len === 3 && n.oh !== null);
  const prefix = prefixText(n.subs, showSubs);
  let parent = stem(len);
  if (n.multipleKind) parent += showMultiple ? `-${n.multiple}-${n.multipleKind}` : n.multipleKind;
  else parent += 'an';
  if (n.oh !== null) parent += showOh ? `-${n.oh}-ol` : 'ol';
  return { prefix, parent };
}

/**
 * Systematisk navn (IUPAC, norsk) for et åpent molekyl med C, H, halogener, høyst én OH-gruppe og høyst én dobbelt-
 * eller trippelbinding. Gir null for stoffer navngiveren ikke håndterer (ringer, etere, syrer …).
 *
 * Hovedkjeden velges slik skolebøkene lærer: den må ha med C-atomet med OH-gruppa og dobbeltbindingen, så den
 * lengste, så den med flest substituenter. Nummereringen gir lavest mulig tall til OH, så dobbeltbindingen, så alle
 * substituentene samlet, og til slutt til den som kommer først alfabetisk.
 */
export function iupacName(mol: Mol): NameResult | null {
  const g = carbonGraph(mol);
  if (!g) return null;
  const multipleBonds: [number, number][] = [];
  for (const c of g.carbons) for (const { to, order } of g.adj.get(c)!) if (order > 1 && c < to) multipleBonds.push([c, to]);
  if (multipleBonds.length > 1) return null;
  const mb = multipleBonds[0];
  const ohCarbon = [...g.oh.keys()][0];
  let paths: number[][] = [];
  for (let i = 0; i < g.carbons.length; i++) for (let j = i; j < g.carbons.length; j++) paths.push(pathBetween(g, g.carbons[i]!, g.carbons[j]!));
  if (ohCarbon !== undefined) paths = paths.filter((p) => p.includes(ohCarbon));
  if (mb) {
    const withMb = paths.filter((p) => p.some((c, k) => p[k + 1] !== undefined && ((c === mb[0] && p[k + 1] === mb[1]) || (c === mb[1] && p[k + 1] === mb[0]))));
    if (withMb.length) paths = withMb;
  }
  const maxLen = Math.max(...paths.map((p) => p.length));
  paths = paths.filter((p) => p.length === maxLen);
  const numberings = paths.flatMap((p) => [numberPath(g, p), numberPath(g, [...p].reverse())]);
  const maxSubs = Math.max(...numberings.map((n) => n.subs.length));
  const candidates = numberings.filter((n) => n.subs.length === maxSubs);
  let best = candidates[0]!;
  for (const c of candidates.slice(1)) if (compareNumbering(c, best).diff < 0) best = c;
  const parts = nameParts(best);
  return {
    name: `${parts.prefix}${parts.parent}`,
    prefix: parts.prefix,
    parent: parts.parent,
    chain: best.path,
    substituents: best.subs,
    ohLocant: best.oh,
    multipleLocant: best.multiple,
    multiple: best.multipleKind,
  };
}

/* ---------- Byggesettet i «Navnsetting» ---------- */

export type SubKind = 'metyl' | 'etyl' | 'klor' | 'brom';

export const SUB_KINDS: SubKind[] = ['metyl', 'etyl', 'klor', 'brom'];
const SUB_ATOMS: Record<SubKind, El[]> = { metyl: ['C'], etyl: ['C', 'C'], klor: ['Cl'], brom: ['Br'] };

export interface NameInput {
  /** Antall C i kjeden eleven tegner (1–8). */
  length: number;
  /** Opptil tre substituenter med plass (1 = venstre ende). */
  subs: { kind: SubKind; pos: number }[];
  /** Dobbeltbinding mellom C(n) og C(n+1), eller null. */
  double: number | null;
  /** OH-gruppe på C(n), eller null. */
  oh: number | null;
}

export type BuildError =
  | { kind: 'posisjon'; what: string; pos: number; length: number }
  | { kind: 'valens'; carbon: number; bonds: number }
  | { kind: 'dobbeltbinding'; pos: number; length: number };

export interface BuiltMolecule {
  mol: Mol;
  errors: BuildError[];
  /** Molekylet kan tegnes og navngis (ingen feil). */
  valid: boolean;
  /** Atomindeksen (i mol) til første atom i hver substituent i input.subs, eller -1 når den ikke er tegnet. */
  subAtoms: number[];
  ohAtom: number;
}

/** Antall bindinger C(pos) får med valgene (kjede, dobbeltbinding, substituenter, OH). */
export function carbonBonds(input: NameInput, pos: number): number {
  const L = input.length;
  const chainNb = L === 1 ? 0 : pos === 1 || pos === L ? 1 : 2;
  const dbl = input.double !== null && (input.double === pos || input.double + 1 === pos) ? 1 : 0;
  const subs = input.subs.filter((s) => s.pos === pos).length;
  return chainNb + dbl + subs + (input.oh === pos ? 1 : 0);
}

/** Bygger molekylet eleven har satt sammen, og finner feil (plass utenfor kjeden, for mange bindinger på et C). */
export function buildNamed(input: NameInput): BuiltMolecule {
  const L = Math.max(1, Math.round(input.length));
  const errors: BuildError[] = [];
  input.subs.forEach((s) => {
    if (s.pos < 1 || s.pos > L) errors.push({ kind: 'posisjon', what: s.kind, pos: s.pos, length: L });
  });
  if (input.oh !== null && (input.oh < 1 || input.oh > L)) errors.push({ kind: 'posisjon', what: 'OH', pos: input.oh, length: L });
  const dbl = input.double !== null && input.double >= 1 && input.double < L ? input.double : null;
  if (input.double !== null && dbl === null) errors.push({ kind: 'dobbeltbinding', pos: input.double, length: L });
  const clean: NameInput = { ...input, length: L, double: dbl };
  for (let c = 1; c <= L; c++) {
    const n = carbonBonds({ ...clean, subs: clean.subs.filter((s) => s.pos <= L), oh: input.oh !== null && input.oh <= L ? input.oh : null }, c);
    if (n > 4) errors.push({ kind: 'valens', carbon: c, bonds: n });
  }
  // Tegning: grenene fordeles opp, ned (og ut ved endene). Det som ikke får plass, tegnes ikke.
  const slots = (pos: number): BranchSpec['side'][] => (L === 1 ? ['up', 'down', 'right', 'left'] : pos === 1 || pos === L ? ['up', 'down', 'out'] : ['up', 'down']);
  const used = new Map<number, number>();
  const branches: BranchSpec[] = [];
  const subAtoms: number[] = [];
  let next = L;
  const place = (pos: number, atoms: El[]): number => {
    if (pos < 1 || pos > L) return -1;
    const k = used.get(pos) ?? 0;
    const side = slots(pos)[k];
    if (!side) return -1;
    used.set(pos, k + 1);
    branches.push({ at: pos - 1, side, atoms });
    const idx = next;
    next += atoms.length;
    return idx;
  };
  input.subs.forEach((s) => subAtoms.push(place(s.pos, SUB_ATOMS[s.kind])));
  const ohAtom = input.oh !== null ? place(input.oh, ['O']) : -1;
  const orders: Order[] = Array.from({ length: Math.max(0, L - 1) }, (_, i) => (dbl === i + 1 ? 2 : 1));
  const mol = molecule({ chain: Array.from({ length: L }, () => 'C' as El), orders, branches });
  return { mol, errors, valid: errors.length === 0, subAtoms, ohAtom };
}

/** Navnet eleven ville skrevet med sin egen kjede og nummerering fra venstre (kan være feil). */
export function naiveName(built: BuiltMolecule, input: NameInput): string | null {
  if (!built.valid) return null;
  const g = carbonGraph(built.mol);
  if (!g) return null;
  const path = Array.from({ length: Math.round(input.length) }, (_, i) => i);
  return assemble(numberPath(g, path));
}

export type NameVerdict =
  | { kind: 'riktig' }
  | { kind: 'lengre-kjede'; length: number }
  | { kind: 'annen-kjede' }
  | { kind: 'nummerering'; rule: NumberingRule };

/** Hvorfor det riktige navnet er annerledes enn elevens forslag (egen kjede, nummerert fra venstre). */
export function verdict(built: BuiltMolecule, input: NameInput, result: NameResult): NameVerdict {
  const naive = naiveName(built, input);
  if (naive === result.name) return { kind: 'riktig' };
  const L = Math.round(input.length);
  if (result.chain.length > L) return { kind: 'lengre-kjede', length: result.chain.length };
  const mine = new Set(Array.from({ length: L }, (_, i) => i));
  if (result.chain.length !== L || !result.chain.every((c) => mine.has(c))) return { kind: 'annen-kjede' };
  const g = carbonGraph(built.mol)!;
  const left = numberPath(g, [...mine]);
  const right = numberPath(g, [...mine].reverse());
  return { kind: 'nummerering', rule: compareNumbering(right, left).rule ?? 'substituenter' };
}

/** Eksempler fra læreboka (og to vanlige feil). */
export const NAME_EXAMPLES: { id: string; label: string; input: NameInput }[] = [
  { id: '2-metylbutan', label: '2-metylbutan', input: { length: 4, subs: [{ kind: 'metyl', pos: 2 }], double: null, oh: null } },
  { id: '22-dimetylpropan', label: '2,2-dimetylpropan', input: { length: 3, subs: [{ kind: 'metyl', pos: 2 }, { kind: 'metyl', pos: 2 }], double: null, oh: null } },
  { id: 'but-2-en', label: 'but-2-en', input: { length: 4, subs: [], double: 2, oh: null } },
  { id: 'propan-2-ol', label: 'propan-2-ol', input: { length: 3, subs: [], double: null, oh: 2 } },
  { id: '2-klor-2-metylpropan', label: '2-klor-2-metylpropan', input: { length: 3, subs: [{ kind: 'klor', pos: 2 }, { kind: 'metyl', pos: 2 }], double: null, oh: null } },
  { id: '3-etyl-2-metylpentan', label: '3-etyl-2-metylpentan', input: { length: 5, subs: [{ kind: 'etyl', pos: 3 }, { kind: 'metyl', pos: 2 }], double: null, oh: null } },
  { id: 'feil-1-metyl', label: 'Feil: «1-metylbutan»', input: { length: 4, subs: [{ kind: 'metyl', pos: 1 }], double: null, oh: null } },
  { id: 'feil-2-etyl', label: 'Feil: «2-etylbutan»', input: { length: 4, subs: [{ kind: 'etyl', pos: 2 }], double: null, oh: null } },
  { id: 'feil-nummer', label: 'Feil: «2-metylbutan-4-ol»', input: { length: 4, subs: [{ kind: 'metyl', pos: 2 }], double: null, oh: 4 } },
];

/* ====================================================================== */
/* Isomeri                                                                  */
/* ====================================================================== */

export type IsomerKind = 'utgangspunkt' | 'kjede' | 'posisjon' | 'funksjon' | 'cis-trans';

export const ISOMER_KIND_NAME: Record<IsomerKind, string> = {
  utgangspunkt: 'rett kjede',
  kjede: 'kjedeisomer',
  posisjon: 'posisjonsisomer',
  funksjon: 'funksjonell isomer',
  'cis-trans': 'cis-trans-isomer',
};

export interface Isomer {
  id: string;
  name: string;
  /** Annet navn (IUPAC eller trivialnavn) i parentes. */
  alt?: string;
  build: () => Mol;
  /** Kokepunkt (°C, 1 atm), CRC Handbook. */
  bp: number;
  /** Forholdet til det første stoffet i settet. */
  kind: IsomerKind;
  /** Stoffgruppe: alkan, alken, alkohol, eter, sykloalkan. */
  group: string;
  hbond: boolean;
  /** Polart molekyl (dipol-dipol-krefter). */
  polar: boolean;
  /** Forgrening: antall C som ikke er i den lengste kjeden. */
  branches: number;
  /** Forenklet strukturformel når den ikke kan lages automatisk (ringer, cis/trans). */
  condensed?: string;
}

export interface IsomerSet {
  id: string;
  formula: string;
  isomers: Isomer[];
}

const chainC = (n: number): El[] => Array.from({ length: n }, () => 'C');
const up = (at: number, atoms: El[] = ['C']): BranchSpec => ({ at, side: 'up', atoms });
const down = (at: number, atoms: El[] = ['C']): BranchSpec => ({ at, side: 'down', atoms });

/** cis- eller trans-but-2-en med 120° rundt C=C. */
function butene2(cis: boolean): Mol {
  const s = Math.sin(Math.PI / 3);
  return customMolecule({
    atoms: [
      { el: 'C', p: [-0.5, s] },
      { el: 'C', p: [0, 0] },
      { el: 'C', p: [1, 0] },
      { el: 'C', p: [1.5, cis ? s : -s] },
    ],
    bonds: [
      [0, 1],
      [1, 2, 2],
      [2, 3],
    ],
  });
}

export const ISOMER_SETS: IsomerSet[] = [
  {
    id: 'C4H10',
    formula: 'C4H10',
    isomers: [
      { id: 'butan', name: 'butan', build: () => molecule({ chain: chainC(4) }), bp: -0.5, kind: 'utgangspunkt', group: 'alkan', hbond: false, polar: false, branches: 0 },
      { id: '2-metylpropan', name: '2-metylpropan', alt: 'isobutan', build: () => molecule({ chain: chainC(3), branches: [up(1)] }), bp: -11.7, kind: 'kjede', group: 'alkan', hbond: false, polar: false, branches: 1 },
    ],
  },
  {
    id: 'C5H12',
    formula: 'C5H12',
    isomers: [
      { id: 'pentan', name: 'pentan', build: () => molecule({ chain: chainC(5) }), bp: 36.1, kind: 'utgangspunkt', group: 'alkan', hbond: false, polar: false, branches: 0 },
      { id: '2-metylbutan', name: '2-metylbutan', alt: 'isopentan', build: () => molecule({ chain: chainC(4), branches: [up(1)] }), bp: 27.8, kind: 'kjede', group: 'alkan', hbond: false, polar: false, branches: 1 },
      { id: '22-dimetylpropan', name: '2,2-dimetylpropan', alt: 'neopentan', build: () => molecule({ chain: chainC(3), branches: [up(1), down(1)] }), bp: 9.5, kind: 'kjede', group: 'alkan', hbond: false, polar: false, branches: 2 },
    ],
  },
  {
    id: 'C6H14',
    formula: 'C6H14',
    isomers: [
      { id: 'heksan', name: 'heksan', build: () => molecule({ chain: chainC(6) }), bp: 68.7, kind: 'utgangspunkt', group: 'alkan', hbond: false, polar: false, branches: 0 },
      { id: '2-metylpentan', name: '2-metylpentan', build: () => molecule({ chain: chainC(5), branches: [up(1)] }), bp: 60.3, kind: 'kjede', group: 'alkan', hbond: false, polar: false, branches: 1 },
      { id: '3-metylpentan', name: '3-metylpentan', build: () => molecule({ chain: chainC(5), branches: [up(2)] }), bp: 63.3, kind: 'kjede', group: 'alkan', hbond: false, polar: false, branches: 1 },
      { id: '23-dimetylbutan', name: '2,3-dimetylbutan', build: () => molecule({ chain: chainC(4), branches: [up(1), up(2)] }), bp: 58.0, kind: 'kjede', group: 'alkan', hbond: false, polar: false, branches: 2 },
      { id: '22-dimetylbutan', name: '2,2-dimetylbutan', build: () => molecule({ chain: chainC(4), branches: [up(1), down(1)] }), bp: 49.7, kind: 'kjede', group: 'alkan', hbond: false, polar: false, branches: 2 },
    ],
  },
  {
    id: 'C2H6O',
    formula: 'C2H6O',
    isomers: [
      { id: 'etanol', name: 'etanol', build: () => molecule({ chain: ['C', 'C', 'O'] }), bp: 78.3, kind: 'utgangspunkt', group: 'alkohol', hbond: true, polar: true, branches: 0 },
      { id: 'dimetyleter', name: 'dimetyleter', alt: 'metoksymetan', build: () => molecule({ chain: ['C', 'O', 'C'] }), bp: -24.8, kind: 'funksjon', group: 'eter', hbond: false, polar: true, branches: 0 },
    ],
  },
  {
    id: 'C3H8O',
    formula: 'C3H8O',
    isomers: [
      { id: 'propan-1-ol', name: 'propan-1-ol', build: () => molecule({ chain: ['C', 'C', 'C', 'O'] }), bp: 97.2, kind: 'utgangspunkt', group: 'alkohol', hbond: true, polar: true, branches: 0 },
      { id: 'propan-2-ol', name: 'propan-2-ol', alt: 'isopropanol', build: () => molecule({ chain: chainC(3), branches: [up(1, ['O'])] }), bp: 82.3, kind: 'posisjon', group: 'alkohol', hbond: true, polar: true, branches: 0 },
      { id: 'etylmetyleter', name: 'etylmetyleter', alt: 'metoksyetan', build: () => molecule({ chain: ['C', 'O', 'C', 'C'] }), bp: 7.4, kind: 'funksjon', group: 'eter', hbond: false, polar: true, branches: 0 },
    ],
  },
  {
    id: 'C4H8',
    formula: 'C4H8',
    isomers: [
      { id: 'but-1-en', name: 'but-1-en', build: () => molecule({ chain: chainC(4), orders: [2] }), bp: -6.3, kind: 'utgangspunkt', group: 'alken', hbond: false, polar: false, branches: 0 },
      { id: 'cis-but-2-en', name: 'cis-but-2-en', build: () => butene2(true), bp: 3.7, kind: 'posisjon', group: 'alken', hbond: false, polar: true, branches: 0, condensed: 'CH3–CH=CH–CH3' },
      { id: 'trans-but-2-en', name: 'trans-but-2-en', build: () => butene2(false), bp: 0.9, kind: 'cis-trans', group: 'alken', hbond: false, polar: false, branches: 0, condensed: 'CH3–CH=CH–CH3' },
      { id: '2-metylpropen', name: '2-metylpropen', alt: 'isobuten', build: () => molecule({ chain: chainC(3), orders: [2], branches: [up(1)] }), bp: -6.9, kind: 'kjede', group: 'alken', hbond: false, polar: false, branches: 1 },
      { id: 'syklobutan', name: 'syklobutan', build: () => molecule({ chain: chainC(4), ring: true }), bp: 12.6, kind: 'funksjon', group: 'sykloalkan', hbond: false, polar: false, branches: 0, condensed: 'ring av fire CH2' },
      {
        id: 'metylsyklopropan',
        name: 'metylsyklopropan',
        build: () => molecule({ chain: chainC(3), ring: true, branches: [{ at: 2, side: 'out', atoms: ['C'] }] }),
        bp: 0.7,
        kind: 'funksjon',
        group: 'sykloalkan',
        hbond: false,
        polar: false,
        branches: 1,
        condensed: 'ring av tre C med CH3',
      },
    ],
  },
];

/* ====================================================================== */
/* Reaksjonstyper                                                           */
/* ====================================================================== */

export type ReactionType = 'addisjon' | 'substitusjon' | 'eliminasjon' | 'kondensasjon' | 'forbrenning';

export const REACTION_TYPE_NAME: Record<ReactionType, string> = {
  addisjon: 'Addisjon',
  substitusjon: 'Substitusjon',
  eliminasjon: 'Eliminasjon',
  kondensasjon: 'Kondensasjon',
  forbrenning: 'Forbrenning',
};

export interface Species {
  /** Navn, f.eks. «eten». */
  name: string;
  /** Formel til likningen («C2H4», «H2O»). */
  formula: string;
  coef: number;
  build: () => Mol;
  /** Bindinger som brytes eller dannes, som par av atomindekser i Mol, eller «alle». */
  bonds?: [number, number][] | 'alle';
}

export interface OrgReaction {
  id: string;
  type: ReactionType;
  /** Kort navn i lista. */
  label: string;
  reactants: Species[];
  products: Species[];
  /** Likevekt (forestring). */
  equilibrium?: boolean;
  /** Betingelser over pila. */
  conditions: string;
}

/** Vann med to H-er i 104,5° (O er atom 0). */
const water = () =>
  customMolecule({
    atoms: [
      { el: 'O', p: [0, 0] },
      { el: 'H', p: [-0.6 * Math.cos(Math.PI * 0.29), -0.6 * Math.sin(Math.PI * 0.29)] },
      { el: 'H', p: [0.6 * Math.cos(Math.PI * 0.29), -0.6 * Math.sin(Math.PI * 0.29)] },
    ],
    bonds: [
      [0, 1],
      [0, 2],
    ],
  });
const eten = () => molecule({ chain: ['C', 'C'], orders: [2] });
const diatomic = (a: El, b: El, order: Order = 1) => () => molecule({ chain: [a, b], orders: [order] });

/**
 * Reaksjonene i visualiseringen. Atomindeksene i `bonds` følger rekkefølgen i struktur.ts: kjedeatomene først
 * (venstre mot høyre), så atomene i grenene i den rekkefølgen grenene står (og for egne molekyler: atomene slik de
 * er listet). Testene sjekker at hvert par faktisk er en binding, og at likningene er balanserte.
 */
export const ORG_REACTIONS: OrgReaction[] = [
  {
    id: 'add-br2',
    type: 'addisjon',
    label: 'Eten + brom',
    conditions: 'romtemperatur',
    reactants: [
      { name: 'eten', formula: 'C2H4', coef: 1, build: eten, bonds: [[0, 1]] },
      { name: 'brom', formula: 'Br2', coef: 1, build: diatomic('Br', 'Br'), bonds: [[0, 1]] },
    ],
    products: [
      {
        name: '1,2-dibrometan',
        formula: 'C2H4Br2',
        coef: 1,
        build: () => molecule({ chain: ['C', 'C'], branches: [up(0, ['Br']), up(1, ['Br'])] }),
        bonds: [
          [0, 2],
          [1, 3],
        ],
      },
    ],
  },
  {
    id: 'add-h2o',
    type: 'addisjon',
    label: 'Eten + vann',
    conditions: 'syre som katalysator, varme',
    reactants: [
      { name: 'eten', formula: 'C2H4', coef: 1, build: eten, bonds: [[0, 1]] },
      { name: 'vann', formula: 'H2O', coef: 1, build: water, bonds: [[0, 1]] },
    ],
    products: [
      {
        name: 'etanol',
        formula: 'C2H6O',
        coef: 1,
        build: () => molecule({ chain: ['C', 'C'], branches: [down(0, ['H']), up(1, ['O'])] }),
        bonds: [
          [0, 2],
          [1, 3],
        ],
      },
    ],
  },
  {
    id: 'add-h2',
    type: 'addisjon',
    label: 'Eten + hydrogen',
    conditions: 'Ni eller Pt som katalysator',
    reactants: [
      { name: 'eten', formula: 'C2H4', coef: 1, build: eten, bonds: [[0, 1]] },
      { name: 'hydrogen', formula: 'H2', coef: 1, build: diatomic('H', 'H'), bonds: [[0, 1]] },
    ],
    products: [
      {
        name: 'etan',
        formula: 'C2H6',
        coef: 1,
        build: () => molecule({ chain: ['C', 'C'], branches: [up(0, ['H']), up(1, ['H'])] }),
        bonds: [
          [0, 2],
          [1, 3],
        ],
      },
    ],
  },
  {
    id: 'sub-cl2',
    type: 'substitusjon',
    label: 'Metan + klor',
    conditions: 'UV-lys',
    reactants: [
      { name: 'metan', formula: 'CH4', coef: 1, build: () => molecule({ chain: ['C', 'H'] }), bonds: [[0, 1]] },
      { name: 'klor', formula: 'Cl2', coef: 1, build: diatomic('Cl', 'Cl'), bonds: [[0, 1]] },
    ],
    products: [
      { name: 'klormetan', formula: 'CH3Cl', coef: 1, build: () => molecule({ chain: ['C', 'Cl'] }), bonds: [[0, 1]] },
      { name: 'hydrogenklorid', formula: 'HCl', coef: 1, build: diatomic('H', 'Cl'), bonds: [[0, 1]] },
    ],
  },
  {
    id: 'sub-cl2-2',
    type: 'substitusjon',
    label: 'Klormetan + klor',
    conditions: 'UV-lys',
    reactants: [
      { name: 'klormetan', formula: 'CH3Cl', coef: 1, build: () => molecule({ chain: ['C', 'Cl'], branches: [up(0, ['H'])] }), bonds: [[0, 2]] },
      { name: 'klor', formula: 'Cl2', coef: 1, build: diatomic('Cl', 'Cl'), bonds: [[0, 1]] },
    ],
    products: [
      { name: 'diklormetan', formula: 'CH2Cl2', coef: 1, build: () => molecule({ chain: ['C', 'Cl'], branches: [up(0, ['Cl'])] }), bonds: [[0, 2]] },
      { name: 'hydrogenklorid', formula: 'HCl', coef: 1, build: diatomic('H', 'Cl'), bonds: [[0, 1]] },
    ],
  },
  {
    id: 'sub-br2',
    type: 'substitusjon',
    label: 'Etan + brom',
    conditions: 'UV-lys',
    reactants: [
      { name: 'etan', formula: 'C2H6', coef: 1, build: () => molecule({ chain: ['C', 'C', 'H'] }), bonds: [[1, 2]] },
      { name: 'brom', formula: 'Br2', coef: 1, build: diatomic('Br', 'Br'), bonds: [[0, 1]] },
    ],
    products: [
      { name: 'brometan', formula: 'C2H5Br', coef: 1, build: () => molecule({ chain: ['C', 'C', 'Br'] }), bonds: [[1, 2]] },
      { name: 'hydrogenbromid', formula: 'HBr', coef: 1, build: diatomic('H', 'Br'), bonds: [[0, 1]] },
    ],
  },
  {
    id: 'elim',
    type: 'eliminasjon',
    label: 'Etanol → eten',
    conditions: 'konsentrert H₂SO₄, ca. 170 °C',
    reactants: [
      {
        name: 'etanol',
        formula: 'C2H6O',
        coef: 1,
        build: () => molecule({ chain: ['C', 'C'], branches: [down(0, ['H']), down(1, ['O'])] }),
        bonds: [
          [0, 2],
          [1, 3],
        ],
      },
    ],
    products: [
      { name: 'eten', formula: 'C2H4', coef: 1, build: eten, bonds: [[0, 1]] },
      { name: 'vann', formula: 'H2O', coef: 1, build: water, bonds: [[0, 1]] },
    ],
  },
  {
    id: 'ester',
    type: 'kondensasjon',
    label: 'Etansyre + etanol (forestring)',
    conditions: 'H₂SO₄ som katalysator, varme',
    equilibrium: true,
    reactants: [
      {
        name: 'etansyre',
        formula: 'C2H4O2',
        coef: 1,
        build: () => molecule({ chain: ['C', 'C', 'O'], branches: [{ at: 1, side: 'up', atoms: ['O'], orders: [2] }] }),
        bonds: [[1, 2]],
      },
      { name: 'etanol', formula: 'C2H6O', coef: 1, build: () => molecule({ chain: ['H', 'O', 'C', 'C'] }), bonds: [[0, 1]] },
    ],
    products: [
      {
        name: 'etyletanoat',
        formula: 'C4H8O2',
        coef: 1,
        build: () => molecule({ chain: ['C', 'C', 'O', 'C', 'C'], branches: [{ at: 1, side: 'up', atoms: ['O'], orders: [2] }] }),
        bonds: [[1, 2]],
      },
      { name: 'vann', formula: 'H2O', coef: 1, build: water, bonds: [[0, 1]] },
    ],
  },
  {
    id: 'forbr-metan',
    type: 'forbrenning',
    label: 'Metan',
    conditions: 'tenning',
    reactants: [
      { name: 'metan', formula: 'CH4', coef: 1, build: () => molecule({ chain: ['C'] }), bonds: 'alle' },
      { name: 'oksygen', formula: 'O2', coef: 2, build: diatomic('O', 'O', 2), bonds: 'alle' },
    ],
    products: [
      { name: 'karbondioksid', formula: 'CO2', coef: 1, build: () => molecule({ chain: ['O', 'C', 'O'], orders: [2, 2] }), bonds: 'alle' },
      { name: 'vann', formula: 'H2O', coef: 2, build: water, bonds: 'alle' },
    ],
  },
  {
    id: 'forbr-etanol',
    type: 'forbrenning',
    label: 'Etanol',
    conditions: 'tenning',
    reactants: [
      { name: 'etanol', formula: 'C2H6O', coef: 1, build: () => molecule({ chain: ['C', 'C', 'O'] }), bonds: 'alle' },
      { name: 'oksygen', formula: 'O2', coef: 3, build: diatomic('O', 'O', 2), bonds: 'alle' },
    ],
    products: [
      { name: 'karbondioksid', formula: 'CO2', coef: 2, build: () => molecule({ chain: ['O', 'C', 'O'], orders: [2, 2] }), bonds: 'alle' },
      { name: 'vann', formula: 'H2O', coef: 3, build: water, bonds: 'alle' },
    ],
  },
  {
    id: 'forbr-propan',
    type: 'forbrenning',
    label: 'Propan',
    conditions: 'tenning',
    reactants: [
      { name: 'propan', formula: 'C3H8', coef: 1, build: () => molecule({ chain: chainC(3) }), bonds: 'alle' },
      { name: 'oksygen', formula: 'O2', coef: 5, build: diatomic('O', 'O', 2), bonds: 'alle' },
    ],
    products: [
      { name: 'karbondioksid', formula: 'CO2', coef: 3, build: () => molecule({ chain: ['O', 'C', 'O'], orders: [2, 2] }), bonds: 'alle' },
      { name: 'vann', formula: 'H2O', coef: 4, build: water, bonds: 'alle' },
    ],
  },
];

/** Likningen som tekst til kit-ets Reaksjon: «C2H4 + Br2 → C2H4Br2». */
export function equationText(r: OrgReaction): string {
  const side = (s: Species[]) => s.map((x) => `${x.coef === 1 ? '' : `${x.coef} `}${x.formula}`).join(' + ');
  return `${side(r.reactants)} ${r.equilibrium ? '⇌' : '→'} ${side(r.products)}`;
}

/** Bindingsindeksene (i Mol) som brytes eller dannes i et stoff. */
export function highlightedBonds(s: Species, mol: Mol): number[] {
  if (!s.bonds) return [];
  if (s.bonds === 'alle') return mol.bonds.map((_, i) => i);
  return s.bonds.map(([a, b]) => mol.bonds.findIndex((x) => (x.a === a && x.b === b) || (x.a === b && x.b === a))).filter((i) => i >= 0);
}

/** Antall bindinger som brytes og dannes i alt (med koeffisientene). En dobbeltbinding som åpnes, teller som én. */
export function bondChanges(r: OrgReaction): { broken: number; formed: number } {
  const count = (list: Species[]) =>
    list.reduce((s, x) => {
      const mol = x.build();
      const idx = highlightedBonds(x, mol);
      const all = x.bonds === 'alle';
      return s + x.coef * idx.reduce((t, i) => t + (all ? mol.bonds[i]!.order : 1), 0);
    }, 0);
  return { broken: count(r.reactants), formed: count(r.products) };
}
