/**
 * Kapittel 5 Organisk kjemi (Kjemi 1): homologe rekker, navnsetting etter IUPAC (på norsk), isomeri og
 * reaksjonstyper. Ren kjemi uten React, testet i model.test.ts. Strukturformlene bygges i struktur.ts.
 *
 * Kokepunkter (°C ved 1 atm) er fra CRC Handbook of Chemistry and Physics (97. utg., «Physical Constants of Organic
 * Compounds»), avrundet til én desimal. Lærebøkene bruker ofte hele grader (etanol 78 °C, eddiksyre 118 °C).
 */
import { H_BOND, customMolecule, hydrogenCount, molecule, neighbours, type BranchSpec, type El, type Mol, type MolSpec, type Order } from './struktur';

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
    const mult = name.startsWith('(') ? (MULT_COMPLEX[n] ?? '') : (MULT[n] ?? '');
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
  const alpha = (n: Numbering) => [...n.subs].sort((x, y) => collate(x.name, y.name) || x.locant - y.locant).map((s) => s.locant);
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
    const withMb = paths.filter((p) =>
      p.some((c, k) => p[k + 1] !== undefined && ((c === mb[0] && p[k + 1] === mb[1]) || (c === mb[1] && p[k + 1] === mb[0]))),
    );
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
  const slots = (pos: number): BranchSpec['side'][] =>
    L === 1 ? ['up', 'down', 'right', 'left'] : pos === 1 || pos === L ? ['up', 'down', 'out'] : ['up', 'down'];
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
  {
    id: '22-dimetylpropan',
    label: '2,2-dimetylpropan',
    input: {
      length: 3,
      subs: [
        { kind: 'metyl', pos: 2 },
        { kind: 'metyl', pos: 2 },
      ],
      double: null,
      oh: null,
    },
  },
  { id: 'but-2-en', label: 'but-2-en', input: { length: 4, subs: [], double: 2, oh: null } },
  { id: 'propan-2-ol', label: 'propan-2-ol', input: { length: 3, subs: [], double: null, oh: 2 } },
  {
    id: '2-klor-2-metylpropan',
    label: '2-klor-2-metylpropan',
    input: {
      length: 3,
      subs: [
        { kind: 'klor', pos: 2 },
        { kind: 'metyl', pos: 2 },
      ],
      double: null,
      oh: null,
    },
  },
  {
    id: '3-etyl-2-metylpentan',
    label: '3-etyl-2-metylpentan',
    input: {
      length: 5,
      subs: [
        { kind: 'etyl', pos: 3 },
        { kind: 'metyl', pos: 2 },
      ],
      double: null,
      oh: null,
    },
  },
  {
    id: 'feil-snu',
    label: 'Feil: «3-etyl-4-metylpentan»',
    input: {
      length: 5,
      subs: [
        { kind: 'metyl', pos: 4 },
        { kind: 'etyl', pos: 3 },
      ],
      double: null,
      oh: null,
    },
  },
  { id: 'feil-1-metyl', label: 'Feil: «1-metylbutan»', input: { length: 4, subs: [{ kind: 'metyl', pos: 1 }], double: null, oh: null } },
  { id: 'feil-2-etyl', label: 'Feil: «2-etylbutan»', input: { length: 4, subs: [{ kind: 'etyl', pos: 2 }], double: null, oh: null } },
  { id: 'feil-nummer', label: 'Feil: «2-metylbutan-4-ol»', input: { length: 4, subs: [{ kind: 'metyl', pos: 2 }], double: null, oh: 4 } },
];

/* ====================================================================== */
/* Isomeri                                                                  */
/* ====================================================================== */

/** Hvordan to isomerer henger sammen (strukturisomeri: kjede, posisjon, funksjon; og cis-trans-isomeri). */
export type IsomerRelation = 'samme' | 'kjede' | 'posisjon' | 'funksjon' | 'cis-trans';

export const RELATION_NAME: Record<IsomerRelation, string> = {
  samme: 'samme stoff',
  kjede: 'kjedeisomerer',
  posisjon: 'posisjonsisomerer',
  funksjon: 'funksjonelle isomerer',
  'cis-trans': 'cis-trans-isomerer',
};

export interface Isomer {
  id: string;
  name: string;
  /** Annet navn (IUPAC eller trivialnavn) i parentes. */
  alt?: string;
  build: () => Mol;
  /** Kokepunkt (°C, 1 atm), CRC Handbook. */
  bp: number;
  /** Stoffgruppe: alkan, alken, alkohol, eter, sykloalkan. */
  group: string;
  /**
   * Karbonskjelettet (rett kjede, forgrenet, ring …). Samme gruppe og samme skjelett, men gruppa et annet sted, gir
   * posisjonsisomerer; samme gruppe og ulikt skjelett gir kjedeisomerer.
   */
  skeleton: string;
  /** Kan danne hydrogenbindinger mellom molekylene (H bundet til O). */
  hbond: boolean;
  /** Polart molekyl (dipol-dipol-krefter i tillegg til London-krefter). */
  polar: boolean;
  /** Forgrening: antall C som ikke er i den lengste kjeden. */
  branches: number;
}

export interface IsomerSet {
  id: string;
  formula: string;
  isomers: Isomer[];
  /** Standardvalg for sammenligningen (indekser i isomers). */
  compare: [number, number];
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

const alkane = (id: string, name: string, alt: string | undefined, build: () => Mol, bp: number, skeleton: string, branches: number): Isomer => ({
  id,
  name,
  alt,
  build,
  bp,
  group: 'alkan',
  skeleton,
  hbond: false,
  polar: false,
  branches,
});

/** Isomersettene. Kokepunkter fra CRC Handbook (97. utg.), avrundet til én desimal. */
export const ISOMER_SETS: IsomerSet[] = [
  {
    id: 'C4H10',
    formula: 'C4H10',
    compare: [0, 1],
    isomers: [
      alkane('butan', 'butan', undefined, () => molecule({ chain: chainC(4) }), -0.5, 'rett', 0),
      alkane('2-metylpropan', '2-metylpropan', 'isobutan', () => molecule({ chain: chainC(3), branches: [up(1)] }), -11.7, 'forgrenet', 1),
    ],
  },
  {
    id: 'C5H12',
    formula: 'C5H12',
    compare: [0, 2],
    isomers: [
      alkane('pentan', 'pentan', undefined, () => molecule({ chain: chainC(5) }), 36.1, 'rett', 0),
      alkane('2-metylbutan', '2-metylbutan', 'isopentan', () => molecule({ chain: chainC(4), branches: [up(1)] }), 27.8, 'metyl', 1),
      alkane('22-dimetylpropan', '2,2-dimetylpropan', 'neopentan', () => molecule({ chain: chainC(3), branches: [up(1), down(1)] }), 9.5, 'dimetyl', 2),
    ],
  },
  {
    id: 'C6H14',
    formula: 'C6H14',
    compare: [0, 4],
    isomers: [
      alkane('heksan', 'heksan', undefined, () => molecule({ chain: chainC(6) }), 68.7, 'rett', 0),
      alkane('2-metylpentan', '2-metylpentan', undefined, () => molecule({ chain: chainC(5), branches: [up(1)] }), 60.3, '2-metyl', 1),
      alkane('3-metylpentan', '3-metylpentan', undefined, () => molecule({ chain: chainC(5), branches: [up(2)] }), 63.3, '3-metyl', 1),
      alkane('23-dimetylbutan', '2,3-dimetylbutan', undefined, () => molecule({ chain: chainC(4), branches: [up(1), up(2)] }), 57.9, '2,3-dimetyl', 2),
      alkane('22-dimetylbutan', '2,2-dimetylbutan', undefined, () => molecule({ chain: chainC(4), branches: [up(1), down(1)] }), 49.7, '2,2-dimetyl', 2),
    ],
  },
  {
    id: 'C2H6O',
    formula: 'C2H6O',
    compare: [0, 1],
    isomers: [
      {
        id: 'etanol',
        name: 'etanol',
        build: () => molecule({ chain: ['C', 'C', 'O'] }),
        bp: 78.3,
        group: 'alkohol',
        skeleton: 'rett',
        hbond: true,
        polar: true,
        branches: 0,
      },
      {
        id: 'dimetyleter',
        name: 'dimetyleter',
        alt: 'metoksymetan',
        build: () => molecule({ chain: ['C', 'O', 'C'] }),
        bp: -24.8,
        group: 'eter',
        skeleton: 'eter',
        hbond: false,
        polar: true,
        branches: 0,
      },
    ],
  },
  {
    id: 'C3H8O',
    formula: 'C3H8O',
    compare: [0, 1],
    isomers: [
      {
        id: 'propan-1-ol',
        name: 'propan-1-ol',
        build: () => molecule({ chain: ['C', 'C', 'C', 'O'] }),
        bp: 97.2,
        group: 'alkohol',
        skeleton: 'rett',
        hbond: true,
        polar: true,
        branches: 0,
      },
      {
        id: 'propan-2-ol',
        name: 'propan-2-ol',
        alt: 'isopropanol',
        build: () => molecule({ chain: chainC(3), branches: [up(1, ['O'])] }),
        bp: 82.3,
        group: 'alkohol',
        skeleton: 'rett',
        hbond: true,
        polar: true,
        branches: 0,
      },
      {
        id: 'etylmetyleter',
        name: 'etylmetyleter',
        alt: 'metoksyetan',
        build: () => molecule({ chain: ['C', 'O', 'C', 'C'] }),
        bp: 7.4,
        group: 'eter',
        skeleton: 'eter',
        hbond: false,
        polar: true,
        branches: 0,
      },
    ],
  },
  {
    id: 'C4H8',
    formula: 'C4H8',
    compare: [1, 2],
    isomers: [
      // Dipolmoment (CRC): but-1-en 0,34 D, cis-but-2-en 0,25 D, 2-metylpropen 0,50 D, trans-but-2-en 0 (dipolene
      // opphever hverandre). Alle alkenene unntatt trans-formen er altså svakt polare.
      {
        id: 'but-1-en',
        name: 'but-1-en',
        build: () => molecule({ chain: chainC(4), orders: [2] }),
        bp: -6.3,
        group: 'alken',
        skeleton: 'rett',
        hbond: false,
        polar: true,
        branches: 0,
      },
      {
        id: 'cis-but-2-en',
        name: 'cis-but-2-en',
        build: () => butene2(true),
        bp: 3.7,
        group: 'alken',
        skeleton: 'rett',
        hbond: false,
        polar: true,
        branches: 0,
      },
      {
        id: 'trans-but-2-en',
        name: 'trans-but-2-en',
        build: () => butene2(false),
        bp: 0.9,
        group: 'alken',
        skeleton: 'rett',
        hbond: false,
        polar: false,
        branches: 0,
      },
      {
        id: '2-metylpropen',
        name: '2-metylpropen',
        alt: 'isobuten',
        build: () => molecule({ chain: chainC(3), orders: [2], branches: [up(1)] }),
        bp: -6.9,
        group: 'alken',
        skeleton: 'forgrenet',
        hbond: false,
        polar: true,
        branches: 1,
      },
      {
        id: 'syklobutan',
        name: 'syklobutan',
        build: () => molecule({ chain: chainC(4), ring: true }),
        bp: 12.6,
        group: 'sykloalkan',
        skeleton: 'ring4',
        hbond: false,
        polar: false,
        branches: 0,
      },
      {
        id: 'metylsyklopropan',
        name: 'metylsyklopropan',
        build: () => molecule({ chain: chainC(3), ring: true, branches: [{ at: 2, side: 'out', atoms: ['C'] }] }),
        bp: 0.7,
        group: 'sykloalkan',
        skeleton: 'ring3',
        hbond: false,
        polar: false,
        branches: 1,
      },
    ],
  },
];

const stripCisTrans = (name: string) => name.replace(/^(cis|trans)-/, '');

/**
 * Hvordan to isomerer henger sammen: ulik stoffgruppe (funksjonell gruppe) gir funksjonelle isomerer, samme gruppe og
 * ulikt karbonskjelett gir kjedeisomerer, samme skjelett med gruppa et annet sted gir posisjonsisomerer, og samme
 * bindinger med ulik plassering rundt en dobbeltbinding gir cis-trans-isomerer.
 */
export function isomerRelation(a: Isomer, b: Isomer): IsomerRelation {
  if (a.id === b.id) return 'samme';
  if (a.name !== b.name && stripCisTrans(a.name) === stripCisTrans(b.name)) return 'cis-trans';
  if (a.group !== b.group) return 'funksjon';
  if (a.skeleton !== b.skeleton) return 'kjede';
  return 'posisjon';
}

/* ---------- To molekyler inntil hverandre (London-krefter og hydrogenbindinger) ---------- */

export interface PairAtom {
  el: El;
  x: number;
  y: number;
  /** Hører til det øverste (0) eller nederste (1) molekylet. */
  mol: 0 | 1;
}

export interface PairLayout {
  atoms: PairAtom[];
  /** Bindinger mellom atomene (indekser i atoms). */
  bonds: [number, number, Order][];
  /** Nærkontakter mellom molekylene (indekser i atoms): her virker London-kreftene sterkest. */
  contacts: [number, number][];
  /** Hydrogenbindingen O–H···O som [H, O] (indekser i atoms), eller null. */
  hbond: [number, number] | null;
  bounds: Bounds2;
}

export interface Bounds2 {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

/** Avstand sentrum–sentrum (enhet = C–C) mellom de nærmeste atomene i de to molekylene. */
export const PAIR_DISTANCE = 1.45;
/** Atompar som er nærmere enn dette, regnes som nærkontakt. */
export const CONTACT_DISTANCE = 1.75;
/** O···O-avstanden i en hydrogenbinding (ca. 2,8 Å mot 1,54 Å for C–C). */
export const HBOND_OO = 2.0;

/**
 * To like molekyler lagt inntil hverandre, det nederste speilvendt: forenklet modell der hvert C-atom står for en
 * CH₃-, CH₂- eller CH-gruppe. Uten hydrogenbindinger legges molekylene med den lange aksen vannrett, så kontaktflaten
 * blir så stor som mulig. Med hydrogenbindinger vender OH-gruppene mot hverandre, og det tegnes en H mellom dem.
 * Koordinater: enhet = C–C, y opp.
 */
export function pairLayout(mol: Mol, hbond: boolean): PairLayout {
  const heavy = mol.atoms.map((a, i) => ({ a, i })).filter(({ a }) => a.z !== null && a.el !== 'H');
  const index = new Map(heavy.map(({ i }, k) => [i, k]));
  const pts = heavy.map(({ a }) => ({ x: a.z!.x, y: a.z!.y }));
  const n = pts.length;
  const cx = pts.reduce((s, p) => s + p.x, 0) / Math.max(1, n);
  const cy = pts.reduce((s, p) => s + p.y, 0) / Math.max(1, n);
  const oIdx = heavy.findIndex(({ a, i }) => a.el === 'O' && hydrogenCount(mol, i) > 0);
  const useHbond = hbond && oIdx >= 0;

  /** Det øverste molekylet dreid vinkelen `angle`, avstanden D ned til det speilvendte og antall nærkontakter. */
  const arrange = (angle: number, oo = 0) => {
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const top = pts.map((p) => ({ x: (p.x - cx) * cos - (p.y - cy) * sin, y: (p.x - cx) * sin + (p.y - cy) * cos }));
    const minDist = (D: number) => {
      let m = Infinity;
      for (const p of top) for (const q of top) m = Math.min(m, Math.hypot(p.x - q.x, p.y - (-q.y - D)));
      return m;
    };
    // Minste forskyvning D som gir avstanden PAIR_DISTANCE mellom de nærmeste atomene (halvering)
    let lo = 0;
    let hi = 20;
    for (let it = 0; it < 50; it++) {
      const mid = (lo + hi) / 2;
      if (minDist(mid) >= PAIR_DISTANCE) hi = mid;
      else lo = mid;
    }
    // Med hydrogenbinding står O-atomene rett over hverandre (speilingen beholder x): avstanden blir 2y + D
    const D = oo > 0 && oIdx >= 0 ? Math.max(hi, oo - 2 * top[oIdx]!.y) : hi;
    let contacts = 0;
    for (const p of top) for (const q of top) if (Math.hypot(p.x - q.x, p.y + q.y + D) < CONTACT_DISTANCE) contacts++;
    const height = Math.max(...top.map((p) => p.y)) - Math.min(...top.map((p) => p.y));
    return { top, D, contacts, height };
  };

  let best: ReturnType<typeof arrange>;
  if (useHbond) {
    // Snu molekylet så O peker skrått ned (−50°): det speilvendte molekylet under får da O rett under, og OH-gruppene
    // vender mot hverandre.
    const o = pts[oIdx]!;
    const d = Math.hypot(o.x - cx, o.y - cy) > 1e-6 ? Math.atan2(o.y - cy, o.x - cx) : -Math.PI / 2;
    best = arrange((-50 * Math.PI) / 180 - d, HBOND_OO);
  } else {
    // Molekylene legger seg slik at kontaktflaten blir størst mulig (flest nærkontakter, så lavest mulig)
    best = arrange(0);
    for (let deg = 5; deg < 180; deg += 5) {
      const c = arrange((deg * Math.PI) / 180);
      if (c.contacts > best.contacts || (c.contacts === best.contacts && c.height < best.height - 1e-6)) best = c;
    }
  }
  const { top, D } = best;
  const atoms: PairAtom[] = [
    ...top.map((p, k) => ({ el: heavy[k]!.a.el, x: p.x, y: p.y, mol: 0 as const })),
    ...top.map((p, k) => ({ el: heavy[k]!.a.el, x: p.x, y: -p.y - D, mol: 1 as const })),
  ];
  const bonds: [number, number, Order][] = [];
  for (const b of mol.bonds) {
    const ka = index.get(b.a);
    const kb = index.get(b.b);
    if (ka === undefined || kb === undefined) continue;
    bonds.push([ka, kb, b.order], [ka + n, kb + n, b.order]);
  }
  let hb: [number, number] | null = null;
  if (useHbond) {
    // H på det øverste O-atomet, rettet mot O-atomet i molekylet under; det nederste O-atomet får sin H på skrå bort
    const o1 = atoms[oIdx]!;
    const o2 = atoms[oIdx + n]!;
    const len = Math.hypot(o2.x - o1.x, o2.y - o1.y) || 1;
    const ux = (o2.x - o1.x) / len;
    const uy = (o2.y - o1.y) / len;
    const h1 = atoms.length;
    atoms.push({ el: 'H', x: o1.x + ux * H_BOND, y: o1.y + uy * H_BOND, mol: 0 });
    bonds.push([oIdx, h1, 1]);
    const h2 = atoms.length;
    const s = Math.SQRT1_2;
    atoms.push({ el: 'H', x: o2.x + (ux - uy) * s * H_BOND, y: o2.y + (ux + uy) * s * H_BOND, mol: 1 });
    bonds.push([oIdx + n, h2, 1]);
    hb = [h1, oIdx + n];
  }
  const contacts: [number, number][] = [];
  for (let i = 0; i < n; i++)
    for (let j = n; j < 2 * n; j++) {
      if (hb && i === oIdx && j === oIdx + n) continue;
      const p = atoms[i]!;
      const q = atoms[j]!;
      if (Math.hypot(p.x - q.x, p.y - q.y) < CONTACT_DISTANCE) contacts.push([i, j]);
    }
  const xs = atoms.map((a) => a.x);
  const ys = atoms.map((a) => a.y);
  return {
    atoms,
    bonds,
    contacts,
    hbond: hb,
    bounds: { minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) },
  };
}

/* ====================================================================== */
/* Reaksjonstyper                                                           */
/* ====================================================================== */

export type ReactionType = 'addisjon' | 'substitusjon' | 'eliminasjon' | 'kondensasjon' | 'forbrenning';

export const REACTION_TYPES: ReactionType[] = ['addisjon', 'substitusjon', 'eliminasjon', 'kondensasjon', 'forbrenning'];

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
  /** Formel til likningen («C2H4», «C2H5OH», «CH3COOH»), skrevet som i lærebøkene. */
  formula: string;
  coef: number;
  build: () => Mol;
  /** Bindinger som brytes (utgangsstoffer) eller dannes (produkter), som par av atomindekser i Mol, eller «alle». */
  bonds?: [number, number][] | 'alle';
  /**
   * Atomer vi følger gjennom reaksjonen (indekser i Mol): de som legges til i en addisjon, eller de som danner det
   * lille molekylet (HCl, H₂O) i en substitusjon, eliminasjon eller kondensasjon. H-atomene på et O-atom i lista tas med.
   */
  tracked?: number[];
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
  /** Hva de fulgte atomene er, f.eks. «Br-atomene som legges til». */
  trackedLabel?: string;
  /** Bromvann (eller brom) avfarges: kjennetegn på addisjon til C=C (og substitusjon i lys). */
  bromineTest?: 'rask' | 'lys';
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
const diatomic =
  (a: El, b: El, order: Order = 1) =>
  () =>
    molecule({ chain: [a, b], orders: [order] });
const co2 = () => molecule({ chain: ['O', 'C', 'O'], orders: [2, 2] });
const ALL_WATER = [0, 1, 2];

/**
 * Reaksjonene i visualiseringen. Atomindeksene i `bonds` og `tracked` følger rekkefølgen i struktur.ts: kjedeatomene
 * først (venstre mot høyre), så atomene i grenene i den rekkefølgen grenene står (og for egne molekyler: atomene slik
 * de er listet), og til slutt H-atomene som fylles på. Testene sjekker at hvert par faktisk er en binding, at
 * likningene er balanserte, og at de fulgte atomene er like mange før og etter.
 */
export const ORG_REACTIONS: OrgReaction[] = [
  {
    id: 'add-br2',
    type: 'addisjon',
    label: 'Eten + brom',
    conditions: 'romtemperatur',
    trackedLabel: 'Br-atomene som legges til',
    bromineTest: 'rask',
    reactants: [
      { name: 'eten', formula: 'C2H4', coef: 1, build: eten, bonds: [[0, 1]] },
      { name: 'brom', formula: 'Br2', coef: 1, build: diatomic('Br', 'Br'), bonds: [[0, 1]], tracked: [0, 1] },
    ],
    products: [
      {
        name: '1,2-dibrometan',
        formula: 'CH2BrCH2Br',
        coef: 1,
        build: () => molecule({ chain: ['C', 'C'], branches: [up(0, ['Br']), up(1, ['Br'])] }),
        bonds: [
          [0, 2],
          [1, 3],
        ],
        tracked: [2, 3],
      },
    ],
  },
  {
    id: 'add-h2o',
    type: 'addisjon',
    label: 'Eten + vann',
    conditions: 'syre som katalysator, varme',
    trackedLabel: 'H og OH fra vannmolekylet',
    reactants: [
      { name: 'eten', formula: 'C2H4', coef: 1, build: eten, bonds: [[0, 1]] },
      { name: 'vann', formula: 'H2O', coef: 1, build: water, bonds: [[0, 1]], tracked: ALL_WATER },
    ],
    products: [
      {
        name: 'etanol',
        formula: 'C2H5OH',
        coef: 1,
        build: () => molecule({ chain: ['C', 'C'], branches: [down(0, ['H']), up(1, ['O'])] }),
        bonds: [
          [0, 2],
          [1, 3],
        ],
        tracked: [2, 3],
      },
    ],
  },
  {
    id: 'add-h2',
    type: 'addisjon',
    label: 'Eten + hydrogen',
    conditions: 'Ni eller Pt som katalysator',
    trackedLabel: 'H-atomene som legges til',
    reactants: [
      { name: 'eten', formula: 'C2H4', coef: 1, build: eten, bonds: [[0, 1]] },
      { name: 'hydrogen', formula: 'H2', coef: 1, build: diatomic('H', 'H'), bonds: [[0, 1]], tracked: [0, 1] },
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
        tracked: [2, 3],
      },
    ],
  },
  {
    id: 'sub-cl2',
    type: 'substitusjon',
    label: 'Metan + klor',
    conditions: 'UV-lys',
    trackedLabel: 'H og Cl som danner HCl',
    reactants: [
      { name: 'metan', formula: 'CH4', coef: 1, build: () => molecule({ chain: ['C', 'H'] }), bonds: [[0, 1]], tracked: [1] },
      { name: 'klor', formula: 'Cl2', coef: 1, build: diatomic('Cl', 'Cl'), bonds: [[0, 1]], tracked: [1] },
    ],
    products: [
      { name: 'klormetan', formula: 'CH3Cl', coef: 1, build: () => molecule({ chain: ['C', 'Cl'] }), bonds: [[0, 1]] },
      { name: 'hydrogenklorid', formula: 'HCl', coef: 1, build: diatomic('H', 'Cl'), bonds: [[0, 1]], tracked: [0, 1] },
    ],
  },
  {
    id: 'sub-cl2-2',
    type: 'substitusjon',
    label: 'Klormetan + klor',
    conditions: 'UV-lys',
    trackedLabel: 'H og Cl som danner HCl',
    reactants: [
      { name: 'klormetan', formula: 'CH3Cl', coef: 1, build: () => molecule({ chain: ['C', 'Cl'], branches: [up(0, ['H'])] }), bonds: [[0, 2]], tracked: [2] },
      { name: 'klor', formula: 'Cl2', coef: 1, build: diatomic('Cl', 'Cl'), bonds: [[0, 1]], tracked: [1] },
    ],
    products: [
      { name: 'diklormetan', formula: 'CH2Cl2', coef: 1, build: () => molecule({ chain: ['C', 'Cl'], branches: [up(0, ['Cl'])] }), bonds: [[0, 2]] },
      { name: 'hydrogenklorid', formula: 'HCl', coef: 1, build: diatomic('H', 'Cl'), bonds: [[0, 1]], tracked: [0, 1] },
    ],
  },
  {
    id: 'sub-br2',
    type: 'substitusjon',
    label: 'Etan + brom',
    conditions: 'UV-lys',
    trackedLabel: 'H og Br som danner HBr',
    bromineTest: 'lys',
    reactants: [
      { name: 'etan', formula: 'C2H6', coef: 1, build: () => molecule({ chain: ['C', 'C', 'H'] }), bonds: [[1, 2]], tracked: [2] },
      { name: 'brom', formula: 'Br2', coef: 1, build: diatomic('Br', 'Br'), bonds: [[0, 1]], tracked: [1] },
    ],
    products: [
      { name: 'brometan', formula: 'C2H5Br', coef: 1, build: () => molecule({ chain: ['C', 'C', 'Br'] }), bonds: [[1, 2]] },
      { name: 'hydrogenbromid', formula: 'HBr', coef: 1, build: diatomic('H', 'Br'), bonds: [[0, 1]], tracked: [0, 1] },
    ],
  },
  {
    id: 'elim',
    type: 'eliminasjon',
    label: 'Etanol → eten',
    conditions: 'kons. H₂SO₄, ca. 170 °C',
    trackedLabel: 'H og OH som spaltes av som vann',
    reactants: [
      {
        name: 'etanol',
        formula: 'C2H5OH',
        coef: 1,
        build: () => molecule({ chain: ['C', 'C'], branches: [down(0, ['H']), down(1, ['O'])] }),
        bonds: [
          [0, 2],
          [1, 3],
        ],
        tracked: [2, 3],
      },
    ],
    products: [
      { name: 'eten', formula: 'C2H4', coef: 1, build: eten, bonds: [[0, 1]] },
      { name: 'vann', formula: 'H2O', coef: 1, build: water, bonds: [[0, 1]], tracked: ALL_WATER },
    ],
  },
  {
    id: 'ester',
    type: 'kondensasjon',
    label: 'Etansyre + etanol (forestring)',
    conditions: 'H₂SO₄ som katalysator, varme',
    equilibrium: true,
    trackedLabel: 'OH fra syra og H fra alkoholen blir vann',
    reactants: [
      {
        name: 'etansyre',
        formula: 'CH3COOH',
        coef: 1,
        build: () => molecule({ chain: ['C', 'C', 'O'], branches: [{ at: 1, side: 'up', atoms: ['O'], orders: [2] }] }),
        bonds: [[1, 2]],
        tracked: [2],
      },
      { name: 'etanol', formula: 'C2H5OH', coef: 1, build: () => molecule({ chain: ['H', 'O', 'C', 'C'] }), bonds: [[0, 1]], tracked: [0] },
    ],
    products: [
      {
        name: 'etyletanoat',
        formula: 'CH3COOC2H5',
        coef: 1,
        build: () => molecule({ chain: ['C', 'C', 'O', 'C', 'C'], branches: [{ at: 1, side: 'up', atoms: ['O'], orders: [2] }] }),
        bonds: [[1, 2]],
      },
      { name: 'vann', formula: 'H2O', coef: 1, build: water, bonds: [[0, 1]], tracked: ALL_WATER },
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
      { name: 'karbondioksid', formula: 'CO2', coef: 1, build: co2, bonds: 'alle' },
      { name: 'vann', formula: 'H2O', coef: 2, build: water, bonds: 'alle' },
    ],
  },
  {
    id: 'forbr-etanol',
    type: 'forbrenning',
    label: 'Etanol',
    conditions: 'tenning',
    reactants: [
      { name: 'etanol', formula: 'C2H5OH', coef: 1, build: () => molecule({ chain: ['C', 'C', 'O'] }), bonds: 'alle' },
      { name: 'oksygen', formula: 'O2', coef: 3, build: diatomic('O', 'O', 2), bonds: 'alle' },
    ],
    products: [
      { name: 'karbondioksid', formula: 'CO2', coef: 2, build: co2, bonds: 'alle' },
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
      { name: 'karbondioksid', formula: 'CO2', coef: 3, build: co2, bonds: 'alle' },
      { name: 'vann', formula: 'H2O', coef: 4, build: water, bonds: 'alle' },
    ],
  },
];

export function reactionsOfType(type: ReactionType): OrgReaction[] {
  return ORG_REACTIONS.filter((r) => r.type === type);
}

/** Likningen som tekst til kit-ets Reaksjon: «C2H4 + Br2 → CH2BrCH2Br». */
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

/** De fulgte atomene i et stoff, med H-atomene som sitter på et fulgt O-atom (OH-gruppa). */
export function trackedAtoms(s: Species, mol: Mol): number[] {
  if (!s.tracked) return [];
  const out = new Set(s.tracked);
  for (const i of s.tracked) if (mol.atoms[i]?.el === 'O') for (const { j } of neighbours(mol, i)) if (mol.atoms[j]!.el === 'H') out.add(j);
  return [...out].sort((a, b) => a - b);
}

/**
 * Bindingen C=C som bare delvis brytes eller dannes: ved addisjon åpnes bare den ene av de to bindingene (C=C blir
 * C–C), og ved eliminasjon dannes bare den andre bindingen (C–C blir C=C). Gjelder utgangsstoffene ved addisjon og
 * produktene ved eliminasjon.
 */
export function onlySecondBond(r: OrgReaction, side: 'reactants' | 'products'): boolean {
  return (r.type === 'addisjon' && side === 'reactants') || (r.type === 'eliminasjon' && side === 'products');
}

/** Atomtelling på hver side (med koeffisientene), for å vise at atomene er bevart. */
export function sideTally(list: Species[]): Record<string, number> {
  const t: Record<string, number> = {};
  for (const s of list) {
    const mol = s.build();
    for (const a of mol.atoms) t[a.el] = (t[a.el] ?? 0) + s.coef;
  }
  return t;
}

const BOND_SYM: Record<Order, string> = { 1: '–', 2: '=', 3: '≡' };
/** Rekkefølgen grunnstoffene skrives i en binding: C–H, C–O, O–H, H–Cl, C–Br. */
const BOND_RANK: Partial<Record<El, number>> = { C: 0, N: 1, O: 1, H: 2, Cl: 3, Br: 3, I: 3 };

/**
 * Bindingene som brytes (utgangsstoffer) eller dannes (produkter), samlet etter type og ganget med koeffisientene:
 * [{ label: 'C–H', count: 4 }, { label: 'O=O', count: 2 }].
 */
export function bondSummary(list: Species[]): { label: string; count: number; order: Order }[] {
  const out = new Map<string, { label: string; count: number; order: Order }>();
  for (const s of list) {
    const mol = s.build();
    for (const bi of highlightedBonds(s, mol)) {
      const b = mol.bonds[bi]!;
      const [x, y] = [mol.atoms[b.a]!.el, mol.atoms[b.b]!.el].sort((p, q) => (BOND_RANK[p] ?? 9) - (BOND_RANK[q] ?? 9) || p.localeCompare(q));
      const label = `${x}${BOND_SYM[b.order]}${y}`;
      const e = out.get(label) ?? { label, count: 0, order: b.order };
      e.count += s.coef;
      out.set(label, e);
    }
  }
  return [...out.values()];
}

/** Det lille molekylet som spaltes av eller dannes ved siden av hovedproduktet (H₂O, HCl, HBr), eller null. */
export function smallMolecule(r: OrgReaction): string | null {
  if (r.type === 'addisjon' || r.type === 'forbrenning') return null;
  return r.products.find((p) => ['H2O', 'HCl', 'HBr'].includes(p.formula))?.formula ?? null;
}
