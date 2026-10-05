/**
 * Kromosomer gjennom mitose og meiose: ren logikk uten React (tegnes av <Delingsfigur> og <Kromatide> i kromosom.tsx).
 *
 * Et sett med 2n = 4 eller 6 kromosomer (n = 2 eller 3 homologe par). Hvert par har sin egen lengde og
 * sentromerplassering, og ett kromosom fra mor og ett fra far. `layoutPhase` regner ut hvor hver kromatide står i en
 * fase av mitosen, meiose I eller meiose II, med cellene, kjernene, spolen og ekvatorplanet.
 *
 * Hver kromatide har en fast nøkkel gjennom alle fasene (f.eks. «0-mor-a»), så figuren kan animere overgangene.
 */
import type { Box } from '../../kjemi/kit/random';
import type { Opphav } from './colors';

export type Fase = 'interfase' | 'profase' | 'metafase' | 'anafase' | 'telofase';
export type Deling = 'mitose' | 'meiose1' | 'meiose2';

export const FASER: readonly Fase[] = ['interfase', 'profase', 'metafase', 'anafase', 'telofase'];

/** Navnet på fasen slik læreboka skriver det, f.eks. «metafase I» i meiose I. */
export function faseNavn(fase: Fase, deling: Deling = 'mitose'): string {
  if (deling === 'mitose' || fase === 'interfase') return fase;
  return `${fase} ${deling === 'meiose1' ? 'I' : 'II'}`;
}

/** Et stykke av en kromatide med farge fra den andre forelderen etter overkrysning. Fra 0 (øverste ende) til 1. */
export interface Segment {
  fra: number;
  til: number;
  opphav: Opphav;
}

export interface ChromosomeSpec {
  /** Homologt par (0, 1, 2). */
  par: number;
  opphav: Opphav;
  /** Relativ lengde (det lengste paret = 1). */
  lengde: number;
  /** Sentromerets plass fra øverste ende (0–1). */
  sentromer: number;
}

/** Formen på de tre parene: langt med sentromeret over midten, middels med sentromeret midt på, kort med sentromeret nær enden. */
export const PAIR_SHAPES: readonly { lengde: number; sentromer: number; overkrysning: number }[] = [
  { lengde: 1, sentromer: 0.38, overkrysning: 0.7 },
  { lengde: 0.74, sentromer: 0.5, overkrysning: 0.74 },
  { lengde: 0.52, sentromer: 0.26, overkrysning: 0.66 },
];

/** Kromosomsettet i en diploid celle: n par, ett kromosom fra mor og ett fra far i hvert par (2n = 4 eller 6). */
export function chromosomeSet(n: 2 | 3): ChromosomeSpec[] {
  const set: ChromosomeSpec[] = [];
  for (let par = 0; par < n; par++) {
    const s = PAIR_SHAPES[par]!;
    for (const opphav of ['mor', 'far'] as const) set.push({ par, opphav, lengde: s.lengde, sentromer: s.sentromer });
  }
  return set;
}

export interface Pt {
  x: number;
  y: number;
}

export interface Ellipse {
  cx: number;
  cy: number;
  rx: number;
  ry: number;
}

/** Én kromatide plassert i figuren. Lengder og bredder er i figurens enheter. */
export interface PlacedChromatid {
  /** Fast nøkkel gjennom alle fasene: «par-opphav-søster», f.eks. «0-mor-a». */
  key: string;
  par: number;
  /** Kromosomet kromatiden hører til (fra mor eller far). Fargen på stykker etter overkrysning står i `segmenter`. */
  opphav: Opphav;
  /** Søsterkromatide a eller b. */
  sister: 'a' | 'b';
  /** Sentromeret. */
  x: number;
  y: number;
  /** Rotasjon av hele kromatiden (grader, 0 = loddrett). */
  rot: number;
  /** Ekstra rotasjon av den øvre og den nedre armen (grader, med klokka). Gir X-form og V-form i anafasen. */
  armU: number;
  armL: number;
  lengde: number;
  bredde: number;
  sentromer: number;
  segmenter: Segment[];
  /** false i interfasen: kromatinet er en tynn, utstrakt tråd. */
  kondensert: boolean;
  /** Cellen kromatiden ligger i (indeks i `celler`). */
  celle: number;
}

/** To søsterkromatider som holdes sammen i sentromeret. */
export interface CentromereLink {
  a: string;
  b: string;
  x: number;
  y: number;
  par: number;
  opphav: Opphav;
}

export interface Spindle {
  poler: [Pt, Pt];
  /** Spoletråder fra en pol til et sentromer eller mot midten. */
  fibre: [Pt, Pt][];
}

export interface DivisionLayout {
  celler: Ellipse[];
  /** Celler som henger sammen to og to under innsnøringen (telofasen): indekser i `celler`. */
  innsnoring: [number, number][];
  kjerner: (Ellipse & { opploses: boolean })[];
  spoler: Spindle[];
  ekvatorplan: { x: number; y0: number; y1: number }[];
  kromatider: PlacedChromatid[];
  sentromerer: CentromereLink[];
  /** Lengden av det lengste kromosomet (figurenheter). */
  enhet: number;
  /** Antall kromosomer i hver celle (et kromosom = én kromatide eller to søsterkromatider). */
  kromosomtall: number[];
}

export interface LayoutOptions {
  deling: Deling;
  fase: Fase;
  /** Antall homologe par (2n = 4 eller 6). */
  n: 2 | 3;
  /** Området figuren skal fylle. */
  box: Box;
  /** Overkrysning i profase I (meiose): søsterkromatider bytter stykker med en kromatide fra det homologe kromosomet. */
  overkrysning?: boolean;
  /** Per par i metafase I: true = kromosomet fra mor går til venstre. Standard [true, false, true]. */
  orientering?: readonly boolean[];
  /** Mitose: vis interfasen etter S-fasen (to søsterkromatider). */
  replikert?: boolean;
}

interface Chr {
  spec: ChromosomeSpec;
  sisters: [Segment[], Segment[]];
}

const PAD = 4;

/** Lengden av det lengste kromosomet og kromatidebredden som får plass i alle fasene for denne boksen. */
export function chromosomeUnit(box: Box, n: 2 | 3): { L: number; W: number } {
  const cell = motherCell(box);
  const sum = 2 * PAIR_SHAPES.slice(0, n).reduce((s, p) => s + p.lengde, 0);
  const avail = 2 * cell.ry * 0.84;
  // Første anslag for bredden, så mellomrommene kan trekkes fra
  const W0 = Math.min(13, Math.max(6, (avail / sum) * 0.16));
  const L = Math.min(cell.ry * 0.8, 90, (avail - (2 * n - 1) * W0 * 0.9) / sum);
  const W = Math.min(13, Math.max(6, L * 0.16));
  return { L, W };
}

function motherCell(box: Box): Ellipse {
  const rx = Math.min(box.w / 2 - PAD, (box.h / 2 - PAD) * 1.7);
  const ry = Math.min(box.h / 2 - PAD, rx * 0.8);
  return { cx: box.x + box.w / 2, cy: box.y + box.h / 2, rx, ry };
}

function twoCells(box: Box): [Ellipse, Ellipse] {
  const rx = Math.min(box.w / 4 - PAD, (box.h / 2 - PAD) * 1.3);
  const ry = Math.min(box.h / 2 - PAD, rx * 0.92);
  const cy = box.y + box.h / 2;
  return [
    { cx: box.x + box.w / 4, cy, rx, ry },
    { cx: box.x + (3 * box.w) / 4, cy, rx, ry },
  ];
}

/** De to dattercellene under innsnøringen i telofasen. */
function daughters(c: Ellipse): [Ellipse, Ellipse] {
  const rx = c.rx * 0.53;
  const ry = c.ry * 0.94;
  return [
    { cx: c.cx - c.rx * 0.47, cy: c.cy, rx, ry },
    { cx: c.cx + c.rx * 0.47, cy: c.cy, rx, ry },
  ];
}

function buildChromosomes(n: 2 | 3, crossing: boolean): Chr[] {
  const chrs: Chr[] = chromosomeSet(n).map((spec) => ({ spec, sisters: [[], []] }));
  if (crossing) {
    for (let par = 0; par < n; par++) {
      const mor = chrs.find((c) => c.spec.par === par && c.spec.opphav === 'mor')!;
      const far = chrs.find((c) => c.spec.par === par && c.spec.opphav === 'far')!;
      const at = PAIR_SHAPES[par]!.overkrysning;
      // De to kromatidene som ligger inntil hverandre i paret (mor b og far a) bytter enden av den lange armen.
      mor.sisters[1] = [{ fra: at, til: 1, opphav: 'far' }];
      far.sisters[0] = [{ fra: at, til: 1, opphav: 'mor' }];
    }
  }
  return chrs;
}

interface Ctx {
  L: number;
  W: number;
  out: DivisionLayout;
}

function chromatid(
  ctx: Ctx,
  c: Chr,
  sister: 0 | 1,
  at: Pt,
  celle: number,
  o: Partial<Pick<PlacedChromatid, 'rot' | 'armU' | 'armL' | 'kondensert'>> = {},
): PlacedChromatid {
  const p: PlacedChromatid = {
    key: `${c.spec.par}-${c.spec.opphav}-${sister === 0 ? 'a' : 'b'}`,
    par: c.spec.par,
    opphav: c.spec.opphav,
    sister: sister === 0 ? 'a' : 'b',
    x: at.x,
    y: at.y,
    rot: o.rot ?? 0,
    armU: o.armU ?? 0,
    armL: o.armL ?? 0,
    lengde: c.spec.lengde * ctx.L,
    bredde: ctx.W,
    sentromer: c.spec.sentromer,
    segmenter: c.sisters[sister],
    kondensert: o.kondensert ?? true,
    celle,
  };
  ctx.out.kromatider.push(p);
  return p;
}

/** Et kromosom med to søsterkromatider side om side (sentromeret i `at`), litt sprikende armer (X-form). */
function replicated(
  ctx: Ctx,
  c: Chr,
  at: Pt,
  celle: number,
  rot = 0,
  opts: { armU?: number; armL?: number; kondensert?: boolean; splay?: number } = {},
) {
  const off = ctx.W / 2 + 0.6;
  const rad = (rot * Math.PI) / 180;
  const nx = Math.cos(rad);
  const ny = Math.sin(rad);
  const splay = opts.splay ?? 7;
  const u = opts.armU ?? 0;
  const l = opts.armL ?? 0;
  const kondensert = opts.kondensert ?? true;
  const a = chromatid(ctx, c, 0, { x: at.x - nx * off, y: at.y - ny * off }, celle, { rot, armU: u - splay, armL: l + splay, kondensert });
  const b = chromatid(ctx, c, 1, { x: at.x + nx * off, y: at.y + ny * off }, celle, { rot, armU: u + splay, armL: l - splay, kondensert });
  ctx.out.sentromerer.push({ a: a.key, b: b.key, x: at.x, y: at.y, par: c.spec.par, opphav: c.spec.opphav });
}

/** Sentromerplasser for kromosomer stablet loddrett (langs ekvatorplanet), sentrert om cy. */
function stack(ctx: Ctx, items: { lengde: number; sentromer: number }[], cy: number, gap: number): number[] {
  const heights = items.map((it) => it.lengde * ctx.L);
  const total = heights.reduce((s, h) => s + h, 0) + gap * Math.max(0, items.length - 1);
  let top = cy - total / 2;
  return items.map((it, i) => {
    const y = top + it.sentromer * heights[i]!;
    top += heights[i]! + gap;
    return y;
  });
}

/** Punkter for kromosomer spredt i en kjerne (profase og interfase), alltid likt. */
function scatter(count: number, e: Ellipse, spread = 0.5): (Pt & { rot: number })[] {
  return Array.from({ length: count }, (_, i) => {
    const th = (i / count) * Math.PI * 2 + 0.45;
    const rr = spread * (i % 2 === 0 ? 1 : 0.55);
    return { x: e.cx + e.rx * rr * Math.cos(th), y: e.cy + e.ry * rr * Math.sin(th), rot: ((i * 53) % 110) - 55 };
  });
}

/** Spole fra to poler til sentromerene (kinetokortråder) pluss noen poltråder som overlapper på midten. */
function spindle(c: Ellipse, poleFrac: number, left: Pt[], right: Pt[], polar = 2, reach = 0.12): Spindle {
  const pl = { x: c.cx - c.rx * poleFrac, y: c.cy };
  const pr = { x: c.cx + c.rx * poleFrac, y: c.cy };
  const fibre: [Pt, Pt][] = [...left.map((p): [Pt, Pt] => [pl, p]), ...right.map((p): [Pt, Pt] => [pr, p])];
  for (let i = 0; i < polar; i++) {
    const dy = (i - (polar - 1) / 2) * c.ry * 0.5;
    fibre.push([pl, { x: c.cx + c.rx * reach, y: c.cy + dy }]);
    fibre.push([pr, { x: c.cx - c.rx * reach, y: c.cy + dy }]);
  }
  return { poler: [pl, pr], fibre };
}

/** Kjerne som rommer en klynge med `count` kromatider side om side. */
function clusterNucleus(ctx: Ctx, cell: Ellipse, count: number): Ellipse {
  const step = ctx.W * 1.7;
  const rx = Math.min(cell.rx * 0.8, (count * step) / 2 + ctx.W * 1.2);
  const ry = Math.min(cell.ry * 0.82, ctx.L * 0.62 + ctx.W);
  return { cx: cell.cx, cy: cell.cy, rx, ry };
}

/** Kromatider i en klynge side om side i en kjerne (telofasen). */
function cluster(ctx: Ctx, list: { c: Chr; sister: 0 | 1 }[], nucleus: Ellipse, celle: number, replicatedPairs = false) {
  if (replicatedPairs) {
    // Hele kromosomer (to søsterkromatider) etter meiose I
    const step = ctx.W * 2.9;
    list.forEach(({ c }, i) => {
      const x = nucleus.cx + (i - (list.length - 1) / 2) * step;
      const y = nucleus.cy + (c.spec.sentromer - 0.5) * c.spec.lengde * ctx.L * 0.9;
      replicated(ctx, c, { x, y }, celle, 0, { splay: 5 });
    });
    return;
  }
  const step = ctx.W * 1.7;
  list.forEach(({ c, sister }, i) => {
    const x = nucleus.cx + (i - (list.length - 1) / 2) * step;
    const y = nucleus.cy + (c.spec.sentromer - 0.5) * c.spec.lengde * ctx.L * 0.9;
    chromatid(ctx, c, sister, { x, y }, celle, { armU: i % 2 ? 3 : -3, armL: i % 2 ? -3 : 3 });
  });
}

/** Rekkefølgen kromosomene står i langs ekvatorplanet i mitosen (blandet, som i et ekte bilde). */
function mixedOrder(chrs: Chr[]): Chr[] {
  const mor = chrs.filter((c) => c.spec.opphav === 'mor');
  const far = chrs.filter((c) => c.spec.opphav === 'far');
  const out: Chr[] = [];
  for (let i = 0; i < mor.length; i++) {
    out.push(i % 2 === 0 ? mor[i]! : far[i]!);
  }
  for (let i = 0; i < mor.length; i++) out.push(i % 2 === 0 ? far[i]! : mor[i]!);
  return out;
}

/**
 * Hele figuren for én fase: celler, kjerner, spole, ekvatorplan og alle kromatidene.
 *
 *   const lay = layoutPhase({ deling: 'mitose', fase: 'metafase', n: 2, box: { x: 20, y: 20, w: 760, h: 320 } });
 */
export function layoutPhase(opts: LayoutOptions): DivisionLayout {
  const { deling, fase, n, box } = opts;
  const { L, W } = chromosomeUnit(box, n);
  const out: DivisionLayout = {
    celler: [],
    innsnoring: [],
    kjerner: [],
    spoler: [],
    ekvatorplan: [],
    kromatider: [],
    sentromerer: [],
    enhet: L,
    kromosomtall: [],
  };
  const ctx: Ctx = { L, W, out };
  const crossing = !!opts.overkrysning && (deling === 'meiose2' || (deling === 'meiose1' && fase !== 'interfase'));
  const chrs = buildChromosomes(n, crossing);
  const orient = (par: number) => opts.orientering?.[par] ?? par % 2 === 0;
  const homolog = (par: number, side: 0 | 1) => {
    const morLeft = orient(par);
    const opphav: Opphav = (side === 0) === morLeft ? 'mor' : 'far';
    return chrs.find((c) => c.spec.par === par && c.spec.opphav === opphav)!;
  };
  const pairs = Array.from({ length: n }, (_, i) => i);

  if (deling === 'meiose2') {
    const cells = twoCells(box);
    cells.forEach((cell, ci) => {
      const own = pairs.map((p) => homolog(p, ci as 0 | 1));
      divideHaploid(ctx, cell, own, fase);
    });
    out.kromosomtall = countPerCell(out);
    return out;
  }

  const cell = motherCell(box);
  const nucleus: Ellipse = { cx: cell.cx, cy: cell.cy, rx: cell.rx * 0.5, ry: cell.ry * 0.66 };
  const gap = W * 0.9;

  switch (fase) {
    case 'interfase': {
      out.celler.push(cell);
      out.kjerner.push({ ...nucleus, opploses: false });
      const two = deling === 'mitose' && !!opts.replikert;
      const spots = scatter(chrs.length, nucleus, 0.42);
      chrs.forEach((c, i) => {
        const s = spots[i]!;
        if (two) replicated(ctx, c, s, 0, s.rot, { kondensert: false, splay: 0 });
        else chromatid(ctx, c, 0, s, 0, { rot: s.rot, kondensert: false });
      });
      break;
    }
    case 'profase': {
      out.celler.push(cell);
      out.kjerner.push({ ...nucleus, rx: nucleus.rx * 1.1, ry: nucleus.ry * 1.05, opploses: true });
      out.spoler.push(spindle(cell, 0.8, [], [], 3, -0.45));
      if (deling === 'mitose') {
        const spots = scatter(chrs.length, nucleus, 0.5);
        chrs.forEach((c, i) => replicated(ctx, c, spots[i]!, 0, spots[i]!.rot));
      } else {
        // Homologe kromosomer legger seg sammen to og to (synapse) – her skjer overkrysningen.
        const spots = scatter(n, nucleus, 0.42);
        pairs.forEach((p, i) => bivalent(ctx, homolog(p, 0), homolog(p, 1), spots[i]!, 0, spots[i]!.rot * 0.3));
      }
      break;
    }
    case 'metafase': {
      out.celler.push(cell);
      out.ekvatorplan.push({ x: cell.cx, y0: cell.cy - cell.ry * 0.88, y1: cell.cy + cell.ry * 0.88 });
      const left: Pt[] = [];
      const right: Pt[] = [];
      if (deling === 'mitose') {
        const order = mixedOrder(chrs);
        const ys = stack(
          ctx,
          order.map((c) => c.spec),
          cell.cy,
          gap,
        );
        order.forEach((c, i) => {
          replicated(ctx, c, { x: cell.cx, y: ys[i]! }, 0);
          left.push({ x: cell.cx - W, y: ys[i]! });
          right.push({ x: cell.cx + W, y: ys[i]! });
        });
      } else {
        const ys = stack(
          ctx,
          pairs.map((p) => PAIR_SHAPES[p]!),
          cell.cy,
          gap * 1.4,
        );
        const q = W + 1.2;
        pairs.forEach((p, i) => {
          const y = ys[i]!;
          const lx = cell.cx - q - W * 0.35;
          const rx = cell.cx + q + W * 0.35;
          replicated(ctx, homolog(p, 0), { x: lx, y }, 0);
          replicated(ctx, homolog(p, 1), { x: rx, y }, 0);
          left.push({ x: lx - W, y });
          right.push({ x: rx + W, y });
        });
      }
      out.spoler.push(spindle(cell, 0.82, left, right, 2));
      break;
    }
    case 'anafase': {
      out.celler.push(cell);
      const left: Pt[] = [];
      const right: Pt[] = [];
      const xl = cell.cx - cell.rx * 0.44;
      const xr = cell.cx + cell.rx * 0.44;
      if (deling === 'mitose') {
        // Søsterkromatidene skilles og trekkes mot hver sin pol med sentromeret først.
        const order = mixedOrder(chrs);
        const ys = stack(
          ctx,
          order.map((c) => c.spec),
          cell.cy,
          gap,
        ).map((y) => cell.cy + (y - cell.cy) * 0.82);
        order.forEach((c, i) => {
          const y = ys[i]!;
          chromatid(ctx, c, 0, { x: xl, y }, 0, { armU: 58, armL: -58 });
          chromatid(ctx, c, 1, { x: xr, y }, 0, { armU: -58, armL: 58 });
          left.push({ x: xl - 2, y });
          right.push({ x: xr + 2, y });
        });
      } else {
        // De homologe kromosomene skilles; søsterkromatidene holder sammen.
        const ys = stack(
          ctx,
          pairs.map((p) => PAIR_SHAPES[p]!),
          cell.cy,
          gap * 1.4,
        ).map((y) => cell.cy + (y - cell.cy) * 0.9);
        pairs.forEach((p, i) => {
          const y = ys[i]!;
          replicated(ctx, homolog(p, 0), { x: xl, y }, 0, 0, { armU: 42, armL: -42, splay: 6 });
          replicated(ctx, homolog(p, 1), { x: xr, y }, 0, 0, { armU: -42, armL: 42, splay: 6 });
          left.push({ x: xl - W, y });
          right.push({ x: xr + W, y });
        });
      }
      out.spoler.push(spindle(cell, 0.86, left, right, 2, 0.2));
      break;
    }
    case 'telofase': {
      const [d0, d1] = daughters(cell);
      out.celler.push(d0, d1);
      out.innsnoring.push([0, 1]);
      if (deling === 'mitose') {
        const order = mixedOrder(chrs);
        const n0 = clusterNucleus(ctx, d0, order.length);
        const n1 = clusterNucleus(ctx, d1, order.length);
        out.kjerner.push({ ...n0, opploses: false }, { ...n1, opploses: false });
        cluster(
          ctx,
          order.map((c) => ({ c, sister: 0 as const })),
          n0,
          0,
        );
        cluster(
          ctx,
          order.map((c) => ({ c, sister: 1 as const })),
          n1,
          1,
        );
      } else {
        const l = pairs.map((p) => ({ c: homolog(p, 0), sister: 0 as const }));
        const r = pairs.map((p) => ({ c: homolog(p, 1), sister: 0 as const }));
        const n0 = clusterNucleus(ctx, d0, n * 1.7);
        const n1 = clusterNucleus(ctx, d1, n * 1.7);
        out.kjerner.push({ ...n0, opploses: false }, { ...n1, opploses: false });
        cluster(ctx, l, n0, 0, true);
        cluster(ctx, r, n1, 1, true);
      }
      break;
    }
  }
  out.kromosomtall = countPerCell(out);
  return out;
}

/** Bivalent (tetrade): to homologe kromosomer side om side, fire kromatider i alt. */
function bivalent(ctx: Ctx, left: Chr, right: Chr, at: Pt & { rot: number }, celle: number, rot: number) {
  const q = ctx.W + 1.2;
  const rad = (rot * Math.PI) / 180;
  const nx = Math.cos(rad);
  const ny = Math.sin(rad);
  replicated(ctx, left, { x: at.x - nx * q, y: at.y - ny * q }, celle, rot, { splay: 4 });
  replicated(ctx, right, { x: at.x + nx * q, y: at.y + ny * q }, celle, rot, { splay: 4 });
}

/** Meiose II i én haploid celle (n kromosomer med to søsterkromatider). */
function divideHaploid(ctx: Ctx, cell: Ellipse, own: Chr[], fase: Fase) {
  const out = ctx.out;
  const nucleus: Ellipse = { cx: cell.cx, cy: cell.cy, rx: cell.rx * 0.58, ry: cell.ry * 0.68 };
  const base = out.celler.length;
  switch (fase) {
    case 'interfase':
    case 'profase': {
      out.celler.push(cell);
      out.kjerner.push({ ...nucleus, opploses: fase === 'profase' });
      if (fase === 'profase') out.spoler.push(spindle(cell, 0.8, [], [], 2, -0.45));
      const spots = scatter(own.length, nucleus, 0.42);
      own.forEach((c, i) =>
        replicated(ctx, c, spots[i]!, base, spots[i]!.rot, { kondensert: fase === 'profase', splay: fase === 'profase' ? 7 : 0 }),
      );
      break;
    }
    case 'metafase': {
      out.celler.push(cell);
      out.ekvatorplan.push({ x: cell.cx, y0: cell.cy - cell.ry * 0.88, y1: cell.cy + cell.ry * 0.88 });
      const ys = stack(
        ctx,
        own.map((c) => c.spec),
        cell.cy,
        ctx.W * 1.2,
      );
      const left: Pt[] = [];
      const right: Pt[] = [];
      own.forEach((c, i) => {
        replicated(ctx, c, { x: cell.cx, y: ys[i]! }, base);
        left.push({ x: cell.cx - ctx.W, y: ys[i]! });
        right.push({ x: cell.cx + ctx.W, y: ys[i]! });
      });
      out.spoler.push(spindle(cell, 0.82, left, right, 1));
      break;
    }
    case 'anafase': {
      out.celler.push(cell);
      const xl = cell.cx - cell.rx * 0.46;
      const xr = cell.cx + cell.rx * 0.46;
      const ys = stack(
        ctx,
        own.map((c) => c.spec),
        cell.cy,
        ctx.W * 1.2,
      ).map((y) => cell.cy + (y - cell.cy) * 0.85);
      const left: Pt[] = [];
      const right: Pt[] = [];
      own.forEach((c, i) => {
        const y = ys[i]!;
        chromatid(ctx, c, 0, { x: xl, y }, base, { armU: 58, armL: -58 });
        chromatid(ctx, c, 1, { x: xr, y }, base, { armU: -58, armL: 58 });
        left.push({ x: xl - 2, y });
        right.push({ x: xr + 2, y });
      });
      out.spoler.push(spindle(cell, 0.86, left, right, 1, 0.2));
      break;
    }
    case 'telofase': {
      const [d0, d1] = daughters(cell);
      out.celler.push(d0, d1);
      out.innsnoring.push([base, base + 1]);
      const n0 = clusterNucleus(ctx, d0, own.length);
      const n1 = clusterNucleus(ctx, d1, own.length);
      out.kjerner.push({ ...n0, opploses: false }, { ...n1, opploses: false });
      cluster(
        ctx,
        own.map((c) => ({ c, sister: 0 as const })),
        n0,
        base,
      );
      cluster(
        ctx,
        own.map((c) => ({ c, sister: 1 as const })),
        n1,
        base + 1,
      );
      break;
    }
  }
}

/** Antall kromosomer per celle: søsterkromatider som henger sammen teller som ett kromosom. */
function countPerCell(out: DivisionLayout): number[] {
  const counts = out.celler.map(() => 0);
  const linked = new Set(out.sentromerer.map((s) => s.b));
  for (const k of out.kromatider) if (!linked.has(k.key)) counts[k.celle] = (counts[k.celle] ?? 0) + 1;
  return counts;
}

/** Om et punkt ligger inne i en ellipse (for tester og for å plassere etiketter). */
export function insideEllipse(p: Pt, e: Ellipse, margin = 0): boolean {
  const rx = e.rx - margin;
  const ry = e.ry - margin;
  if (rx <= 0 || ry <= 0) return false;
  return ((p.x - e.cx) / rx) ** 2 + ((p.y - e.cy) / ry) ** 2 <= 1;
}

/**
 * Omriss av én eller to celler: en ellipse, eller to ellipser som henger sammen i en innsnøring (telofasen).
 * `waist` er hvor smal innsnøringen er (0 = helt delt, 1 = ingen innsnøring).
 */
export function cellOutlinePath(a: Ellipse, b?: Ellipse, waist = 0.45): string {
  const ell = (e: Ellipse) =>
    `M${e.cx - e.rx},${e.cy} A${e.rx},${e.ry} 0 1 0 ${e.cx + e.rx},${e.cy} A${e.rx},${e.ry} 0 1 0 ${e.cx - e.rx},${e.cy} Z`;
  if (!b) return ell(a);
  // Peanøttform: én ellipse rundt begge cellene, klemt jevnt inn på midten (gaussisk innsnøring, ingen spisser).
  const left = Math.min(a.cx - a.rx, b.cx - b.rx);
  const right = Math.max(a.cx + a.rx, b.cx + b.rx);
  const cx = (left + right) / 2;
  const cy = (a.cy + b.cy) / 2;
  const rx = (right - left) / 2;
  const ry = Math.max(a.ry, b.ry);
  const mid = (a.cx + a.rx + (b.cx - b.rx)) / 2;
  const sigma = Math.min(a.rx, b.rx) * 0.42;
  const pts: Pt[] = [];
  const N = 64;
  for (let i = 0; i < N; i++) {
    const th = (i / N) * Math.PI * 2;
    // Litt «firkantet» ellipse (superellipse), så endene blir runde og sidene fyldige
    const c = Math.cos(th);
    const s = Math.sin(th);
    const x = cx + rx * Math.sign(c) * Math.abs(c) ** 0.85;
    const pinch = 1 - (1 - waist) * Math.exp(-((x - mid) ** 2) / (2 * sigma * sigma));
    const y = cy + ry * Math.sign(s) * Math.abs(s) ** 0.85 * pinch;
    pts.push({ x, y });
  }
  return smoothClosedPath(pts);
}

/** Jevn lukket kurve gjennom punktene (Catmull–Rom omgjort til Bézier). */
export function smoothClosedPath(pts: readonly Pt[]): string {
  const n = pts.length;
  if (n < 3) return '';
  const p = (i: number) => pts[((i % n) + n) % n]!;
  let d = `M${p(0).x.toFixed(2)},${p(0).y.toFixed(2)}`;
  for (let i = 0; i < n; i++) {
    const p0 = p(i - 1);
    const p1 = p(i);
    const p2 = p(i + 1);
    const p3 = p(i + 2);
    const c1 = { x: p1.x + (p2.x - p0.x) / 6, y: p1.y + (p2.y - p0.y) / 6 };
    const c2 = { x: p2.x - (p3.x - p1.x) / 6, y: p2.y - (p3.y - p1.y) / 6 };
    d += ` C${c1.x.toFixed(2)},${c1.y.toFixed(2)} ${c2.x.toFixed(2)},${c2.y.toFixed(2)} ${p2.x.toFixed(2)},${p2.y.toFixed(2)}`;
  }
  return `${d} Z`;
}
