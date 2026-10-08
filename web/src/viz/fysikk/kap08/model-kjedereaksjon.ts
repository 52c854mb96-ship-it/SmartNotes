/**
 * Modellen til «Fisjon og kjedereaksjon» (k8-kjedereaksjon), 8B og 8C.
 *
 * Et nøytron treffer en U-235-kjerne, som spaltes i to mindre kjerner og 2 eller 3 nye nøytroner. Noen av nøytronene
 * fanges av kontrollstavene, resten spalter nye U-235-kjerner. Formeringsfaktoren k er hvor mange nye fisjoner én
 * fisjon gir i gjennomsnitt: k = ν · (1 − f), der ν = 2,5 er antall nøytroner per fisjon og f er andelen som fanges.
 *
 * Kjedetreet er deterministisk med frø: antall fisjoner i hver generasjon følger gjennomsnittet N₀ · kᵍ (avrundet),
 * mens frøet bestemmer hvilke nøytroner som fanges og hvilke fisjoner som gir 2 og 3 nøytroner.
 * Konstanter som i ERGO Fysikk 1: u = 1,66 · 10⁻²⁷ kg, c = 3,00 · 10⁸ m/s, e = 1,60 · 10⁻¹⁹ C.
 */

export const U_KG = 1.66e-27;
export const C_LIGHT = 3.0e8;
export const E_CHARGE = 1.6e-19;
/** 1 MeV i joule. */
export const MEV_J = 1e6 * E_CHARGE;

/** Nøytroner per fisjon i gjennomsnitt (2 eller 3). */
export const NU = 2.5;

/** Glidebryteren: andelen av nøytronene som fanges av kontrollstavene (prosent). */
export const CAPTURE_PCT = { min: 40, max: 80, step: 1, initial: 60 } as const;

/** Generasjonene i treet: 0 til 5. */
export const TREE_GENERATIONS = 5;
/** Generasjonene i grafen. */
export const GRAPH_GENERATIONS = 10;

/** Forhåndsvalgene: å stenge ned (k = 0,70), jevn drift (k = 1,00) og å starte opp (k = 1,30). */
export const PRESETS = [
  { id: 'ned', capturePct: 72 },
  { id: 'jevn', capturePct: 60 },
  { id: 'opp', capturePct: 48 },
] as const;
export type PresetId = (typeof PRESETS)[number]['id'];

/** Forhåndsvalget som passer til andelen, eller null. */
export function presetFor(capturePct: number): PresetId | null {
  return PRESETS.find((p) => Math.abs(p.capturePct - capturePct) < 1e-9)?.id ?? null;
}

/* ---------- Kjerner og fisjonsenergi ---------- */

export interface Nuclide {
  /** Kjemisk symbol (n for nøytronet). */
  symbol: string;
  /** Navn på bokmål, f.eks. «barium-141». */
  name: string;
  Z: number;
  A: number;
  /** Atommasse i u (nøytronet: nøytronmassen). */
  mass: number;
}

/** Atommasser (u) fra atommassetabellen (AME), med elektronene, så de balanserer i likningen. */
export const NUCLIDES = {
  n: { symbol: 'n', name: 'nøytron', Z: 0, A: 1, mass: 1.0086649 },
  U235: { symbol: 'U', name: 'uran-235', Z: 92, A: 235, mass: 235.0439299 },
  Ba141: { symbol: 'Ba', name: 'barium-141', Z: 56, A: 141, mass: 140.9144033 },
  Kr92: { symbol: 'Kr', name: 'krypton-92', Z: 36, A: 92, mass: 91.9261731 },
  Xe140: { symbol: 'Xe', name: 'xenon-140', Z: 54, A: 140, mass: 139.9216458 },
  Sr94: { symbol: 'Sr', name: 'strontium-94', Z: 38, A: 94, mass: 93.915356 },
} as const satisfies Record<string, Nuclide>;

export type ChannelId = 'ba-kr' | 'xe-sr';

/** To vanlige måter U-235 spaltes på: med 3 eller 2 nye nøytroner. */
export interface FissionChannel {
  id: ChannelId;
  /** Den tyngste kjernen først. */
  fragments: [Nuclide, Nuclide];
  neutrons: 2 | 3;
}

export const CHANNELS: Record<ChannelId, FissionChannel> = {
  // ²³⁵U + n → ¹⁴¹Ba + ⁹²Kr + 3n
  'ba-kr': { id: 'ba-kr', fragments: [NUCLIDES.Ba141, NUCLIDES.Kr92], neutrons: 3 },
  // ²³⁵U + n → ¹⁴⁰Xe + ⁹⁴Sr + 2n
  'xe-sr': { id: 'xe-sr', fragments: [NUCLIDES.Xe140, NUCLIDES.Sr94], neutrons: 2 },
};

export function channelFor(neutrons: number): FissionChannel {
  return neutrons >= 3 ? CHANNELS['ba-kr'] : CHANNELS['xe-sr'];
}

export interface FissionEnergy {
  /** Masse før (U-235 + n) og etter (to kjerner + nøytronene), i u. */
  mBefore: number;
  mAfter: number;
  /** Massetapet Δm (u). */
  dm: number;
  /** Frigjort energi E = Δm · c² (J og MeV). */
  EJ: number;
  EMeV: number;
  /** Nukleontall og ladning før og etter (bevares). */
  A: [number, number];
  Z: [number, number];
}

export function fissionEnergy(ch: FissionChannel): FissionEnergy {
  const { n, U235 } = NUCLIDES;
  const [a, b] = ch.fragments;
  const mBefore = U235.mass + n.mass;
  const mAfter = a.mass + b.mass + ch.neutrons * n.mass;
  const dm = mBefore - mAfter;
  const EJ = dm * U_KG * C_LIGHT * C_LIGHT;
  return {
    mBefore,
    mAfter,
    dm,
    EJ,
    EMeV: EJ / MEV_J,
    A: [U235.A + n.A, a.A + b.A + ch.neutrons * n.A],
    Z: [U235.Z + n.Z, a.Z + b.Z],
  };
}

/* ---------- Formeringsfaktoren ---------- */

/** k = ν · (1 − f): nye fisjoner per fisjon i gjennomsnitt, når andelen f av nøytronene fanges. */
export function multiplicationFactor(captureFraction: number, nu = NU): number {
  const f = Math.min(1, Math.max(0, Number.isFinite(captureFraction) ? captureFraction : 0));
  return nu * (1 - f);
}

/** Andelen som må fanges for å få formeringsfaktoren k: f = 1 − k/ν. */
export function captureForK(k: number, nu = NU): number {
  return 1 - k / nu;
}

/** Gjennomsnittlig antall fisjoner i generasjon g: N₀ · kᵍ. */
export function expectedFissions(k: number, g: number, n0 = 1): number {
  return n0 * Math.pow(Math.max(0, k), g);
}

export type Regime = 'dor-ut' | 'jevn' | 'vokser';

/** Kjedereaksjonen dør ut (k < 1, underkritisk), er jevn (k = 1, kritisk) eller vokser (k > 1, overkritisk). */
export function regime(k: number, tol = 1e-6): Regime {
  if (Math.abs(k - 1) <= tol) return 'jevn';
  return k < 1 ? 'dor-ut' : 'vokser';
}

/**
 * Hvor mange generasjoner det tar før antallet fisjoner er dobbelt (k > 1) eller halvt (k < 1) så stort:
 * ln 2 / |ln k|. Uendelig når k = 1, 0-ish når k er langt fra 1.
 */
export function generationsToDoubleOrHalve(k: number): number {
  const l = Math.abs(Math.log(k));
  return l > 0 ? Math.LN2 / l : Number.POSITIVE_INFINITY;
}

/**
 * Antall fisjoner i generasjon 0 … generations i treet: N₀ i generasjon 0, deretter N₀ · kᵍ avrundet. En kjede som har
 * dødd ut, starter ikke igjen, og én generasjon kan høyst gi 2 nye fisjoner per fisjon (hver fisjon gir minst 2
 * nøytroner).
 */
export function fissionCounts(k: number, generations = TREE_GENERATIONS, n0 = 1): number[] {
  const counts = [Math.max(0, Math.round(n0))];
  for (let g = 1; g <= generations; g++) {
    const prev = counts[g - 1]!;
    counts.push(prev === 0 ? 0 : Math.min(2 * prev, Math.max(0, Math.round(expectedFissions(k, g, n0)))));
  }
  return counts;
}

/* ---------- Kjedetreet ---------- */

export type NeutronFate = 'fisjon' | 'fanget' | 'videre';

export interface ChainNeutron {
  id: number;
  /** Generasjonen til fisjonen som sendte det ut (−1 for startnøytronet). */
  gen: number;
  /** Fisjonen som sendte det ut (−1 for startnøytronet). */
  parent: number;
  /** Nummeret blant nøytronene fra samme fisjon (0, 1, 2). */
  order: number;
  /** Spalter en ny kjerne, fanges av en kontrollstav, eller fortsetter ut av utsnittet (siste generasjon). */
  fate: NeutronFate;
  /** Fisjonen det gir (fate «fisjon»), kontrollstavkjernen som fanger det («fanget») eller −1 («videre»). */
  target: number;
}

export interface ChainFission {
  id: number;
  gen: number;
  /** Nøytronet som spaltet kjernen. */
  by: number;
  channel: ChannelId;
  /** Nøytronene som kommer ut, i rekkefølge. */
  out: number[];
}

export interface ChainAbsorber {
  id: number;
  /** Mellom generasjon gen og gen + 1. */
  gen: number;
  neutron: number;
}

export interface GenerationStats {
  gen: number;
  fissions: number;
  /** Nøytroner ut av fisjonene i generasjonen. */
  emitted: number;
  /** Av dem: fanget av kontrollstavene. */
  captured: number;
  /** Av dem: spalter en ny kjerne i neste generasjon. */
  onward: number;
}

export interface ChainTree {
  k: number;
  seed: number;
  generations: number;
  counts: number[];
  fissions: ChainFission[];
  neutrons: ChainNeutron[];
  absorbers: ChainAbsorber[];
  /** Fisjonene i hver generasjon, i rekkefølge ovenfra og ned. */
  byGen: number[][];
  stats: GenerationStats[];
}

/** Liten tallgenerator med fast frø (mulberry32), så treet blir likt hver gang. */
export function seededRandom(seed: number): () => number {
  let a = Math.floor(Number.isFinite(seed) ? seed : 1) >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Tallene 0 … n − 1 i tilfeldig rekkefølge (Fisher–Yates). */
function shuffled(n: number, rnd: () => number): number[] {
  const a = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

/**
 * Kjedetreet: ett startnøytron spalter en U-235-kjerne i generasjon 0. Hver fisjon gir 2 eller 3 nøytroner (i
 * gjennomsnitt ν), og i hver generasjon spalter så mange av dem nye kjerner som `fissionCounts` sier. Resten fanges.
 * Nøytronene fra siste generasjon fortsetter ut av utsnittet.
 */
export function buildChainTree(k: number, seed: number, generations = TREE_GENERATIONS, nu = NU): ChainTree {
  const rnd = seededRandom(seed);
  const counts = fissionCounts(k, generations);
  const neutrons: ChainNeutron[] = [{ id: 0, gen: -1, parent: -1, order: 0, fate: 'fisjon', target: 0 }];
  const fissions: ChainFission[] = [{ id: 0, gen: 0, by: 0, channel: 'xe-sr', out: [] }];
  const absorbers: ChainAbsorber[] = [];
  const byGen: number[][] = [[0]];
  const stats: GenerationStats[] = [];

  for (let g = 0; g <= generations; g++) {
    const ids = byGen[g]!;
    const F = ids.length;
    // Antall nøytroner ut: ν · F i gjennomsnitt, men minst 2 og høyst 3 per fisjon.
    const mean = nu * F;
    const base = Math.floor(mean);
    const emitted = Math.min(3 * F, Math.max(2 * F, base + (rnd() < mean - base ? 1 : 0)));
    const three = new Set(shuffled(F, rnd).slice(0, emitted - 2 * F));
    const out: number[] = [];
    ids.forEach((fid, i) => {
      const f = fissions[fid]!;
      const m = three.has(i) ? 3 : 2;
      f.channel = channelFor(m).id;
      for (let j = 0; j < m; j++) {
        const id = neutrons.length;
        neutrons.push({ id, gen: g, parent: fid, order: j, fate: 'videre', target: -1 });
        f.out.push(id);
        out.push(id);
      }
    });

    const next: number[] = [];
    let captured = 0;
    if (g < generations) {
      const need = Math.min(out.length, counts[g + 1] ?? 0);
      const chosen = new Set(shuffled(out.length, rnd).slice(0, need));
      out.forEach((nid, i) => {
        const n = neutrons[nid]!;
        if (chosen.has(i)) {
          const fid = fissions.length;
          fissions.push({ id: fid, gen: g + 1, by: nid, channel: 'xe-sr', out: [] });
          n.fate = 'fisjon';
          n.target = fid;
          next.push(fid);
        } else {
          const aid = absorbers.length;
          absorbers.push({ id: aid, gen: g, neutron: nid });
          n.fate = 'fanget';
          n.target = aid;
          captured++;
        }
      });
      byGen.push(next);
    }
    stats.push({ gen: g, fissions: F, emitted: out.length, captured, onward: next.length });
  }

  return { k, seed, generations, counts, fissions, neutrons, absorbers, byGen, stats };
}

/** Energien som frigjøres i alle fisjonene i treet (MeV). */
export function treeEnergyMeV(tree: ChainTree): number {
  return tree.fissions.reduce((s, f) => s + fissionEnergy(CHANNELS[f.channel]).EMeV, 0);
}

/* ---------- Kjernekraftverket ---------- */

/** En stor reaktor gir ca. 3 000 MW varme (ca. 1 000 MW strøm). */
export const REACTOR_THERMAL_W = 3.0e9;
export const DAY_S = 24 * 3600;

/** Fisjoner per sekund for å gi effekten P når hver fisjon gir energien E (J). */
export function fissionsPerSecond(P: number, EJ: number): number {
  return P / EJ;
}

/** Massen av U-235 (kg) som spaltes per døgn ved effekten P. */
export function u235KgPerDay(P: number, EJ: number): number {
  return fissionsPerSecond(P, EJ) * DAY_S * NUCLIDES.U235.mass * U_KG;
}

/* ---------- Plassering i figuren ---------- */

export interface Point {
  x: number;
  y: number;
}

export interface TreeBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface TreeLayoutOptions {
  /** Radius til U-235-kjernene. */
  R: number;
  /** Radius til kontrollstavkjernene (bor) som fanger nøytroner. */
  rA: number;
  /** Ønsket avstand mellom søsken i neste generasjon (standard 2,9 R). */
  childGap?: number;
  /** Hvor langt ut i mellomrommet kontrollstavkjernene står (0–1 av kolonneavstanden, standard 0,5). */
  absorberAt?: number;
}

export interface NeutronPath {
  from: Point;
  to: Point;
  /** Tidspunktene (generasjoner, se `fissionTime`) da nøytronet sendes ut og når fram. */
  depart: number;
  arrive: number;
}

export interface TreeLayout {
  dx: number;
  columns: number[];
  fissions: Point[];
  absorbers: Point[];
  neutrons: NeutronPath[];
  /** Hvor lenge hele treet tar å spille av. */
  tMax: number;
}

/** Tidspunktet da generasjon g spaltes. Startnøytronet bruker tida fra 0 til fissionTime(0). */
export const FIRST_FISSION = 0.6;
export function fissionTime(g: number): number {
  return FIRST_FISSION + g;
}
/** Nøytronene sendes ut litt etter fisjonen, så spaltingen synes først. */
export const EMIT_DELAY = 0.08;
/** Hvor lang tid nøytronene fra siste generasjon bruker ut av utsnittet (andel av en generasjon). */
const STUB_TIME = 0.45;

/** Når hele treet er ferdig spilt av: nøytronene fra siste generasjon har forlatt utsnittet. */
export function treeTMax(generations = TREE_GENERATIONS): number {
  return fissionTime(generations) + EMIT_DELAY + (1 - EMIT_DELAY) * STUB_TIME;
}

/**
 * Plasserer punkter i rekkefølge med minst `gap` mellom seg, så nær ønsket plass som mulig, innenfor [lo, hi].
 * Punkter som kolliderer, samles i klynger rundt gjennomsnittet. Får de ikke plass, fordeles de jevnt.
 * Returnerer posisjonene i samme rekkefølge som `desired`.
 */
export function spreadPositions(desired: number[], gap: number, lo: number, hi: number): number[] {
  const n = desired.length;
  if (n === 0) return [];
  const idx = desired.map((_, i) => i).sort((a, b) => desired[a]! - desired[b]! || a - b);
  const d = idx.map((i) => desired[i]!);
  const span = hi - lo;
  let pos: number[];
  if (n === 1) pos = [Math.min(hi, Math.max(lo, d[0]!))];
  else if ((n - 1) * gap >= span) pos = d.map((_, i) => lo + (span * i) / (n - 1));
  else {
    // Klynger: hver klynge har toppen `top` og `n` punkter med avstand gap; toppen er gjennomsnittet av d_i − i · gap.
    const clusters: { first: number; n: number; sum: number; top: number }[] = [];
    d.forEach((v, i) => {
      clusters.push({ first: i, n: 1, sum: v, top: v });
      for (;;) {
        const b = clusters[clusters.length - 1]!;
        const a = clusters[clusters.length - 2];
        if (!a || a.top + a.n * gap <= b.top) break;
        const merged = { first: a.first, n: a.n + b.n, sum: 0, top: 0 };
        let s = 0;
        for (let j = 0; j < merged.n; j++) s += d[merged.first + j]! - j * gap;
        merged.sum = s;
        merged.top = s / merged.n;
        clusters.splice(clusters.length - 2, 2, merged);
      }
    });
    pos = [];
    for (const c of clusters) for (let j = 0; j < c.n; j++) pos.push(c.top + j * gap);
    // Innenfor grensene: skyv ned fra toppen og opp fra bunnen.
    pos[0] = Math.max(lo, pos[0]!);
    for (let i = 1; i < n; i++) pos[i] = Math.max(pos[i]!, pos[i - 1]! + gap);
    pos[n - 1] = Math.min(hi, pos[n - 1]!);
    for (let i = n - 2; i >= 0; i--) pos[i] = Math.min(pos[i]!, pos[i + 1]! - gap);
  }
  const out = new Array<number>(n);
  idx.forEach((orig, i) => (out[orig] = pos[i]!));
  return out;
}

/**
 * Plasseringen av kjernene, kontrollstavkjernene og nøytronbanene i et utsnitt `box`. Generasjonene står i kolonner
 * fra venstre mot høyre. Barna til en fisjon står samlet rett til høyre for den, og kontrollstavkjernene står midt i
 * mellomrommet, over, mellom eller under banene til barna (i samme rekkefølge som nøytronene), så banene ikke krysser dem.
 */
export function layoutChainTree(tree: ChainTree, box: TreeBox, opts: TreeLayoutOptions): TreeLayout {
  const G = tree.generations;
  const { R, rA } = opts;
  const dx = box.w / (G + 1);
  const columns = Array.from({ length: G + 1 }, (_, g) => box.x + dx * (0.55 + g));
  const childGap = opts.childGap ?? 2.9 * R;
  const fa = opts.absorberAt ?? 0.5;
  const pad = 2;
  const loF = box.y + R + pad;
  const hiF = box.y + box.h - R - pad;
  const loA = box.y + rA + pad;
  const hiA = box.y + box.h - rA - pad;

  const fissions: Point[] = tree.fissions.map(() => ({ x: 0, y: 0 }));
  const absorbers: Point[] = tree.absorbers.map(() => ({ x: 0, y: 0 }));
  const neutrons: NeutronPath[] = tree.neutrons.map(() => ({ from: { x: 0, y: 0 }, to: { x: 0, y: 0 }, depart: 0, arrive: 0 }));

  fissions[0] = { x: columns[0]!, y: box.y + box.h / 2 };

  for (let g = 0; g <= G; g++) {
    const parents = tree.byGen[g] ?? [];
    const xc = columns[g]!;
    // Barna i neste generasjon: samlet rundt forelderen, i rekkefølge.
    const kids: { fid: number; want: number }[] = [];
    for (const pid of parents) {
      const p = fissions[pid]!;
      const own = tree.fissions[pid]!.out.filter((nid) => tree.neutrons[nid]!.fate === 'fisjon');
      own.forEach((nid, i) => kids.push({ fid: tree.neutrons[nid]!.target, want: p.y + (i - (own.length - 1) / 2) * childGap }));
    }
    if (g < G && kids.length > 0) {
      const ys = spreadPositions(
        kids.map((c) => c.want),
        2.4 * R,
        loF,
        hiF,
      );
      kids.forEach((c, i) => (fissions[c.fid] = { x: columns[g + 1]!, y: ys[i]! }));
    }

    // Kontrollstavkjernene i mellomrommet etter generasjon g.
    const xa = xc + fa * dx;
    const want: { aid: number; y: number }[] = [];
    const sA = 2.6 * rA;
    for (const pid of parents) {
      const p = fissions[pid]!;
      const outIds = tree.fissions[pid]!.out;
      // Der banene til barna krysser x = xa.
      const mids: number[] = [];
      outIds.forEach((nid) => {
        const n = tree.neutrons[nid]!;
        if (n.fate === 'fisjon') mids.push(p.y + fa * (fissions[n.target]!.y - p.y));
      });
      // Grupper kontrollstavkjernene etter hvor de står i rekkefølgen: før første barn, mellom barn i og i + 1, etter siste.
      const groups = new Map<number, number[]>();
      let seen = 0;
      outIds.forEach((nid) => {
        const n = tree.neutrons[nid]!;
        if (n.fate === 'fisjon') seen++;
        else if (n.fate === 'fanget') groups.set(seen, [...(groups.get(seen) ?? []), n.target]);
      });
      for (const [slot, aids] of groups) {
        const q = aids.length;
        aids.forEach((aid, j) => {
          let y: number;
          if (mids.length === 0) y = p.y + (j - (q - 1) / 2) * sA;
          else if (slot === 0) y = mids[0]! - (q - j) * sA;
          else if (slot >= mids.length) y = mids[mids.length - 1]! + (j + 1) * sA;
          else y = mids[slot - 1]! + ((j + 1) / (q + 1)) * (mids[slot]! - mids[slot - 1]!);
          want.push({ aid, y });
        });
      }
    }
    if (want.length > 0) {
      const ys = spreadPositions(
        want.map((w) => w.y),
        2.3 * rA,
        loA,
        hiA,
      );
      want.forEach((w, i) => (absorbers[w.aid] = { x: xa, y: ys[i]! }));
    }
  }

  // Banene og tidene.
  const travel = 1 - EMIT_DELAY;
  const stub = 0.4 * dx;
  for (const n of tree.neutrons) {
    if (n.parent < 0) {
      const to = fissions[0]!;
      neutrons[n.id] = { from: { x: box.x + 0.04 * dx, y: to.y }, to, depart: 0, arrive: fissionTime(0) };
      continue;
    }
    const from = fissions[n.parent]!;
    const depart = fissionTime(n.gen) + EMIT_DELAY;
    if (n.fate === 'fisjon') {
      neutrons[n.id] = { from, to: fissions[n.target]!, depart, arrive: fissionTime(n.gen + 1) };
    } else if (n.fate === 'fanget') {
      const to = absorbers[n.target]!;
      neutrons[n.id] = { from, to, depart, arrive: depart + travel * Math.min(1, Math.hypot(to.x - from.x, to.y - from.y) / dx) };
    } else {
      const m = tree.fissions[n.parent]!.out.length;
      const y = Math.min(box.y + box.h - 4, Math.max(box.y + 4, from.y + (n.order - (m - 1) / 2) * 0.9 * R));
      const to = { x: from.x + stub, y };
      neutrons[n.id] = { from, to, depart, arrive: depart + travel * STUB_TIME };
    }
  }

  return { dx, columns, fissions, absorbers, neutrons, tMax: treeTMax(G) };
}

/** Hvor langt nøytronet har kommet ved tida t (0 = ikke sendt ut, 1 = framme). */
export function neutronProgress(path: NeutronPath, t: number): number {
  if (t <= path.depart) return 0;
  if (t >= path.arrive) return 1;
  return (t - path.depart) / (path.arrive - path.depart);
}

/** Generasjonen som er i gang ved tida t (−1 før første fisjon). */
export function generationAt(t: number, generations = TREE_GENERATIONS): number {
  if (t < fissionTime(0)) return -1;
  return Math.min(generations, Math.floor(t - FIRST_FISSION + 1e-9));
}

/* ---------- Grafen ---------- */

/** Minste «pene» tall (1; 1,5; 2; 2,5; 3; 4; 5; 6; 8 ganger en tierpotens) som er minst v. */
export function niceCeil(v: number): number {
  if (!(v > 0) || !Number.isFinite(v)) return 1;
  const mag = 10 ** Math.floor(Math.log10(v));
  for (const m of [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10]) if (m * mag >= v * (1 - 1e-12)) return m * mag;
  return 10 * mag;
}

/** Toppen av y-aksen i grafen: plass til N₀ · kᵍ i alle generasjonene og til søylene fra treet. */
export function graphMax(k: number, counts: number[], generations = GRAPH_GENERATIONS): number {
  return niceCeil(Math.max(1.5, expectedFissions(k, generations), ...counts) * 1.04);
}
