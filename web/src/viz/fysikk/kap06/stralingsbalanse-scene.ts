/**
 * Geometrien i scenen for k6-stralingsbalanse (ren, uten React): et snitt gjennom atmosfæren med sola og jordkloden
 * i verdensrommet øverst, drivhusgasslaget, skyene og et norsk kystlandskap nederst, og hvor energistrømmene (pilene)
 * og tallene står. Figurens koordinater, y nedover.
 *
 * Bredden på en pil er pxPerW · strømmen (W/m²), med samme skala for alle pilene i figuren.
 */
import type { Balance } from './model';

export interface Pt {
  x: number;
  y: number;
}

export interface Box {
  l: number;
  r: number;
  t: number;
  b: number;
}

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
const smooth = (t: number) => {
  const u = clamp(Number.isFinite(t) ? t : 0, 0, 1);
  return u * u * (3 - 2 * u);
};

/** Typiske albedoverdier for flatene i scenen (omtrentlige lærebokverdier). */
export const SURFACE_ALBEDO = {
  hav: 0.06,
  skog: 0.1,
  sjois: 0.6,
  sno: 0.85,
  skyer: 0.5,
} as const;

/* ------------------------------------------------------------------ Hva tegningen viser for en albedo */

export interface Cover {
  /** Skydekket, 0–1. */
  clouds: number;
  /** Snø på fjellene: 0 = ingen, 1 = helt ned til foten. */
  snow: number;
  /** Snø på lavlandet (fra fjellet mot kysten), 0–1. */
  land: number;
  /** Andelen av havet med is (fra land og utover), 0–1. */
  seaIce: number;
}

/**
 * Hvor mye skyer, snø og is tegningen viser for planetens albedo α: mørkt hav og skog uten snø ved α = 0, snø på
 * fjelltoppene og noen skyer ved α = 0,30 (jorda i dag), og hvit snø, is og tett skydekke ved høy albedo. Bare til
 * tegningen; modellen bruker bare α.
 */
export function albedoCover(albedo: number): Cover {
  const a = Number.isFinite(albedo) ? albedo : 0;
  return {
    clouds: smooth((a - 0.05) / 0.55),
    snow: smooth((a - 0.12) / 0.4),
    land: smooth((a - 0.33) / 0.3),
    seaIce: smooth((a - 0.33) / 0.32),
  };
}

/** Faste plasser for skyene (x som andel av bredden, y som andel av skybeltet, bredde). Den første kommer først. */
export const CLOUD_SLOTS: readonly { x: number; y: number; w: number }[] = [
  { x: 0.37, y: 0.35, w: 1 },
  { x: 0.71, y: 0.6, w: 0.9 },
  { x: 0.1, y: 0.55, w: 0.85 },
  { x: 0.93, y: 0.25, w: 0.8 },
  { x: 0.53, y: 0.8, w: 0.75 },
  { x: 0.23, y: 0.15, w: 0.9 },
  { x: 0.83, y: 0.9, w: 1 },
];

/** Antall skyer som tegnes for skydekket (0–7). */
export const cloudCount = (clouds: number) => Math.round(clamp(clouds, 0, 1) * CLOUD_SLOTS.length);

/* ------------------------------------------------------------------ Molekyler i drivhusgasslaget */

export interface Molecule {
  /** Plassering i laget, 0–1 i begge retninger. */
  u: number;
  v: number;
  /** Dreining i grader. */
  rot: number;
  kind: 'co2' | 'h2o';
}

/** Liten tallgenerator med fast frø (mulberry32), så molekylene står likt hver gang. */
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const MOLECULE_MAX = 44;

/**
 * Molekylene i laget, jevnt spredt (rutenett med litt tilfeldig forskyvning) og i en fast rekkefølge der de første
 * er spredt over hele laget. Med ε vises de `moleculeCount(ε)` første, så nye molekyler kommer til uten at de andre
 * flytter seg.
 */
export function molecules(): Molecule[] {
  const rand = rng(61);
  const cols = 11;
  const rows = 4;
  const out: Molecule[] = [];
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++)
      out.push({
        u: (c + 0.2 + 0.6 * rand() + (r % 2) * 0.35) / (cols + 0.35),
        v: (r + 0.2 + 0.6 * rand()) / rows,
        rot: rand() * 180,
        kind: (r + c) % 3 === 0 ? 'h2o' : 'co2',
      });
  // Rekkefølge: hver tredje kolonne og annenhver rad først, så de første er spredt utover.
  const order = out.map((m, i) => ({
    m,
    k: ((i % cols) % 3) * 10 + (Math.floor(i / cols) % 2) * 5 + rand(),
  }));
  return order.sort((a, b) => a.k - b.k).map((o) => o.m);
}

export const moleculeCount = (eps: number) => Math.round(clamp(eps, 0, 1) * MOLECULE_MAX);

/* ------------------------------------------------------------------ Oppsettet */

export interface StralingLayout {
  W: number;
  H: number;
  /** Tekstskalering, gjenstandsskalering og strekskalering. */
  f: number;
  s: number;
  ss: number;
  /** Piksler bredde per W/m² for pilene. */
  pxPerW: number;
  /** Høyden på et ValueTag-skilt. */
  tagH: number;
  /** Der pilene opp ender (i verdensrommet). */
  yTop: number;
  /** Der himmelen begynner (toppen av atmosfæren). */
  yToa: number;
  /** Drivhusgasslaget. */
  yL1: number;
  yL2: number;
  yLc: number;
  /** Bakken (havflaten). */
  yG: number;
  /** Skybeltet og høyden på fjellene. */
  cloudTop: number;
  cloudBot: number;
  mountainH: number;
  /** Fjellkjeden går fra x = mountainX til høyre kant. */
  mountainX: number;
  /** Kysten: havet til venstre, land til høyre. */
  xShore: number;
  /** Der sollyset treffer bakken. */
  xV: number;
  /** Midten av varmestrålingen fra bakken. */
  xS: number;
  /** Strålingen fra atmosfæren (opp og ned). */
  xU: number;
  sun: { x: number; y: number; r: number };
  globe: { x: number; y: number; r: number };
  /** Retningen til sollyset (enhetsvektor, ned mot høyre) og halen på pila (rett utenfor sola). */
  sunDir: Pt;
  inTail: Pt;
  /** Grunnlinjene for tallene høyt oppe og lavt nede. */
  yHi: number;
  yLo: number;
  /** Midten av radene med skilt i snittet under bakken. */
  rows: [number, number];
  /** Skogen: x-intervaller. */
  forest: [number, number][];
  /** Midten av hytta ved sjøen. */
  cabinX: number;
}

/**
 * Oppsettet for en figur med bredde W (800 på PC, 600 på mobil) og tekstskalering f. Høyden vokser litt med teksten.
 */
export function stralingLayout(W: number, f: number): StralingLayout {
  const s = Math.max(1, 0.85 * f);
  const fs = 17 * f;
  const tagH = fs * 0.9 * 1.55;
  const narrow = W < 700;
  const pxPerW = narrow ? 0.062 : 0.07;
  const yTop = 26 + 8 * (f - 1);
  const yToa = 100 + 30 * (f - 1);
  const A = 300 + 30 * (f - 1);
  const yG = yToa + A;
  const yL1 = yToa + 0.2 * A;
  const yL2 = yToa + 0.46 * A;
  const rows: [number, number] = [yG + 16 + tagH / 2, yG + 26 + tagH * 1.5];
  const H = Math.round(rows[1] + tagH / 2 + 14);
  const sun = { x: 30 * s, y: 30 * s, r: 34 * s };
  const xV = 0.25 * W;
  const dx = xV - sun.x;
  const dy = yG - sun.y;
  const dl = Math.hypot(dx, dy);
  const sunDir = { x: dx / dl, y: dy / dl };
  const gap = sun.r + 6 * s;
  return {
    W,
    H,
    f,
    s,
    ss: Math.max(1, 0.75 * f),
    pxPerW,
    tagH,
    yTop,
    yToa,
    yL1,
    yL2,
    yLc: (yL1 + yL2) / 2,
    yG,
    cloudTop: yG - 0.37 * A,
    cloudBot: yG - 0.2 * A,
    mountainH: 0.27 * A,
    mountainX: 0.4 * W,
    xShore: 0.22 * W,
    xV,
    xS: 0.55 * W,
    // På mobil står jorda mellom pilene, så søylen med strålingen fra atmosfæren kan stå lenger ut mot kanten
    xU: (narrow ? 0.87 : 0.83) * W,
    sun,
    globe: narrow ? { x: 0.7 * W, y: 44 * s, r: 30 * s } : { x: W - 44 * s, y: 44 * s, r: 30 * s },
    sunDir,
    inTail: { x: sun.x + sunDir.x * gap, y: sun.y + sunDir.y * gap },
    yHi: yToa + 0.1 * A + fs * 0.35,
    yLo: yToa + 0.72 * A + fs * 0.35,
    rows,
    forest: [
      [0.27 * W, 0.47 * W],
      [0.6 * W, 0.78 * W],
    ],
    cabinX: (narrow ? 0.385 : 0.36) * W,
  };
}

/* ------------------------------------------------------------------ Energistrømmene */

export type FlowId = 'inn' | 'reflektert' | 'bakkeAtm' | 'gjennom' | 'atmOpp' | 'atmNed';

export interface FlowArrowGeo {
  id: FlowId;
  /** Halen og spissen. */
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  /** Bredden på skaftet (pxPerW · strømmen). */
  w: number;
  kind: 'sol' | 'varme';
}

export interface ValueLabel {
  id: FlowId | 'bakke' | 'lag';
  x: number;
  y: number;
  anchor: 'start' | 'middle' | 'end';
  text: string;
  kind: 'sol' | 'varme';
}

/** Skaftet er bredere enn dette før pila tegnes (figurens enheter). */
export const MIN_ARROW_W = 0.5;

/** Hodet på en flytpil: lengde og halv bredde. */
export function arrowHead(w: number, len: number, ss = 1) {
  return { len: Math.min(len * 0.5, 12 * ss + 0.45 * w), half: w / 2 + 7 * ss };
}

/** Omrisset av en flytpil fra (x1, y1) til spissen (x2, y2) med skaftbredde w (sju hjørner), eller [] når den er for kort. */
export function arrowPolygon(x1: number, y1: number, x2: number, y2: number, w: number, ss = 1): Pt[] {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy);
  if (!(w >= MIN_ARROW_W) || !(len > 4)) return [];
  const ux = dx / len;
  const uy = dy / len;
  const nx = -uy;
  const ny = ux;
  const h = arrowHead(w, len, ss);
  const bx = x2 - ux * h.len;
  const by = y2 - uy * h.len;
  return [
    { x: x1 + (nx * w) / 2, y: y1 + (ny * w) / 2 },
    { x: bx + (nx * w) / 2, y: by + (ny * w) / 2 },
    { x: bx + nx * h.half, y: by + ny * h.half },
    { x: x2, y: y2 },
    { x: bx - nx * h.half, y: by - ny * h.half },
    { x: bx - (nx * w) / 2, y: by - (ny * w) / 2 },
    { x: x1 - (nx * w) / 2, y: y1 - (ny * w) / 2 },
  ];
}

/** Omtrentlig tekstboks (grunnlinje y) for en etikett med skriftstørrelse fs. */
export function textBox(x: number, y: number, anchor: 'start' | 'middle' | 'end', text: string, fs: number): Box {
  const w = text.length * 0.56 * fs;
  const l = anchor === 'start' ? x : anchor === 'end' ? x - w : x - w / 2;
  return { l, r: l + w, t: y - 0.78 * fs, b: y + 0.24 * fs };
}

const num = (v: number) => String(Math.round(v));

/**
 * Pilene og tallene for en strålingsbalanse b. Sollyset kommer på skrå fra sola og treffer bakken i xV; det
 * reflekterte går tilbake opp med samme vinkel (som et speil). Varmestrålingen fra bakken deles i en del som
 * atmosfæren tar opp (venstre, ender i laget) og en del som slipper ut (høyre). Atmosfæren stråler like mye opp
 * (fra toppen av laget) som ned (fra bunnen) i samme søyle.
 */
export function flowGeometry(b: Balance, L: StralingLayout) {
  const k = L.pxPerW;
  const fs = 17 * L.f;
  const arrows: FlowArrowGeo[] = [];
  const labels: ValueLabel[] = [];
  const d = L.sunDir;
  const cos = d.y; // vinkelen mot loddlinja
  const wIn = b.incoming * k;
  const wR = b.reflected * k;
  const wA = b.atmAbsorbed * k;
  const wT = b.transmitted * k;
  const wU = b.atmUp * k;
  const show = (w: number) => w >= MIN_ARROW_W;
  const xAt = (x0: number, y0: number, y: number, dir: 1 | -1) => x0 + dir * d.x * ((y - y0) / d.y);

  // Sollyset inn og reflektert
  arrows.push({
    id: 'inn',
    x1: L.inTail.x,
    y1: L.inTail.y,
    x2: L.xV,
    y2: L.yG,
    w: wIn,
    kind: 'sol',
  });
  const xInLo = xAt(L.xV, L.yG, L.yLo - 0.3 * fs, 1);
  labels.push({
    id: 'inn',
    x: xInLo - wIn / 2 / cos - 8,
    y: L.yLo,
    anchor: 'end',
    text: num(b.incoming),
    kind: 'sol',
  });
  if (show(wR)) {
    // Halen står på bakken: midten løftes så det nederste hjørnet av den skrå enden akkurat når bakken.
    const lift = (wR / 2) * d.x;
    const x0 = L.xV + wR / 2 / cos + 5 * L.s;
    const x1 = x0 + d.x * (lift / d.y);
    const x2 = x0 + d.x * ((L.yG - L.yTop) / d.y);
    arrows.push({
      id: 'reflektert',
      x1,
      y1: L.yG - lift,
      x2,
      y2: L.yTop,
      w: wR,
      kind: 'sol',
    });
    const xr = x0 + d.x * ((L.yG - (L.yHi - 0.3 * fs)) / d.y);
    labels.push({
      id: 'reflektert',
      x: xr + wR / 2 / cos + 8,
      y: L.yHi,
      anchor: 'start',
      text: num(b.reflected),
      kind: 'sol',
    });
  }

  // Varmestrålingen fra bakken: delen atmosfæren tar opp (venstre) og delen som slipper ut (høyre)
  // Mellomrommet gir plass til hodet på pila som ender i laget.
  const both = show(wA) && show(wT);
  const gap = arrowHead(wA, 100, L.ss).half - wA / 2 + 3;
  const pairW = (show(wA) ? wA : 0) + (show(wT) ? wT : 0) + (both ? gap : 0);
  const left = L.xS - pairW / 2;
  if (show(wA))
    arrows.push({
      id: 'bakkeAtm',
      x1: left + wA / 2,
      y1: L.yG,
      x2: left + wA / 2,
      y2: L.yLc,
      w: wA,
      kind: 'varme',
    });
  const xT = show(wA) ? left + wA + gap + wT / 2 : L.xS;
  if (show(wT)) {
    arrows.push({
      id: 'gjennom',
      x1: xT,
      y1: L.yG,
      x2: xT,
      y2: L.yTop,
      w: wT,
      kind: 'varme',
    });
    labels.push({
      id: 'gjennom',
      x: xT + wT / 2 + 8,
      y: L.yHi,
      anchor: 'start',
      text: num(b.transmitted),
      kind: 'varme',
    });
  }
  labels.push({
    id: 'bakke',
    x: left - 8,
    y: L.yLo,
    anchor: 'end',
    text: num(b.surfaceEmit),
    kind: 'varme',
  });

  // Atmosfæren stråler like mye opp som ned
  if (show(wU)) {
    arrows.push({
      id: 'atmOpp',
      x1: L.xU,
      y1: L.yL1,
      x2: L.xU,
      y2: L.yTop,
      w: wU,
      kind: 'varme',
    });
    arrows.push({
      id: 'atmNed',
      x1: L.xU,
      y1: L.yL2,
      x2: L.xU,
      y2: L.yG,
      w: wU,
      kind: 'varme',
    });
    labels.push({
      id: 'atmOpp',
      x: L.xU + wU / 2 + 8,
      y: L.yHi,
      anchor: 'start',
      text: num(b.atmUp),
      kind: 'varme',
    });
    labels.push({
      id: 'atmNed',
      x: L.xU + wU / 2 + 8,
      y: L.yLo,
      anchor: 'start',
      text: num(b.atmDown),
      kind: 'varme',
    });
  }

  return { arrows, labels, pairRight: L.xS + pairW / 2, pairLeft: left };
}

/**
 * Hvor navnet på laget og temperaturen der står: midt i åpningen mellom varmestrålingen fra bakken og søylen
 * med strålingen fra atmosfæren (uten drivhusgasser: til høyre for pila som går rett ut). `size` er den relative
 * tekststørrelsen som får plass (0,8–0,9), `fits` om navnet får plass i det hele tatt.
 */
export function layerLabel(b: Balance, eps: number, L: StralingLayout, name: string) {
  const geo = flowGeometry(b, L);
  const hasAtm = eps > 0 && b.atmUp * L.pxPerW >= MIN_ARROW_W;
  const l = geo.pairRight + 10;
  const r = hasAtm ? L.xU - (b.atmUp * L.pxPerW) / 2 - 10 : L.W - 8;
  const fs = 17 * L.f;
  const need = (size: number) => name.length * 0.56 * fs * size;
  const size = [0.9, 0.85, 0.8].find((sz) => need(sz) <= r - l) ?? 0.8;
  return { x: (l + r) / 2, y: L.yLc, size, fits: need(size) <= r - l, l, r };
}

/** Bredden på et ValueTag-skilt med teksten (samme regel som i scene-kit-et). */
export function tagWidth(text: string, f: number, size = 0.9): number {
  const fs = 17 * f * size;
  return Math.max(fs * 1.6, text.length * fs * 0.6 + 16 * f);
}

/** x for midten av et skilt med bredde w, flyttet inn så det holder seg i figuren. */
export const clampTag = (x: number, w: number, W: number) => clamp(x, w / 2 + 6, W - w / 2 - 6);

/* ------------------------------------------------------------------ Albedoen til flatene */

export interface AlbedoTag {
  id: 'hav' | 'sjois' | 'skog' | 'land-sno' | 'fjell-sno' | 'skyer';
  text: string;
  /** Midten av skiltet. */
  x: number;
  y: number;
  /** Spiss ned mot flaten (høyde), eller ingen. */
  pointer?: number;
}

/**
 * Skiltene med albedoen til flatene, når energistrømmene er skjult: havet eller sjøisen og skogen (eller snøen på
 * lavlandet) i snittet under bakken, snøen på den høyeste fjelltoppen og den første skya oppe i lufta.
 * `peak` er toppen av det høyeste fjellet og `cloud` midten av den første skya (begge fra tegningen).
 */
export function albedoTags(cover: Cover, L: StralingLayout, peak: Pt, cloud: Pt | undefined, fmt2: (v: number) => string): AlbedoTag[] {
  const tags: AlbedoTag[] = [];
  const iceStart = L.xShore * (1 - cover.seaIce);
  if (cover.seaIce < 0.5) {
    const text = `hav ≈ ${fmt2(SURFACE_ALBEDO.hav)}`;
    tags.push({
      id: 'hav',
      text,
      x: clampTag(iceStart / 2, tagWidth(text, L.f), L.W),
      y: L.rows[0],
    });
  } else {
    const text = `sjøis ≈ ${fmt2(SURFACE_ALBEDO.sjois)}`;
    tags.push({
      id: 'sjois',
      text,
      x: clampTag((iceStart + L.xShore) / 2, tagWidth(text, L.f), L.W),
      y: L.rows[0],
    });
  }
  const [f0, f1] = L.forest[0]!;
  const landText = cover.land < 0.5 ? `skog ≈ ${fmt2(SURFACE_ALBEDO.skog)}` : `snø ≈ ${fmt2(SURFACE_ALBEDO.sno)}`;
  const prev = tags[0]!;
  const pw = tagWidth(prev.text, L.f);
  const lw = tagWidth(landText, L.f);
  const lx = Math.max((f0 + f1) / 2, prev.x + pw / 2 + 12 + lw / 2);
  tags.push({
    id: cover.land < 0.5 ? 'skog' : 'land-sno',
    text: landText,
    x: clampTag(lx, lw, L.W),
    y: L.rows[0],
  });
  if (cover.snow > 0.12) {
    const text = `snø ≈ ${fmt2(SURFACE_ALBEDO.sno)}`;
    tags.push({
      id: 'fjell-sno',
      text,
      x: clampTag(peak.x, tagWidth(text, L.f), L.W),
      y: peak.y - 12 * L.s - L.tagH / 2,
      pointer: 9 * L.s,
    });
  }
  if (cloud) {
    const text = `skyer ≈ ${fmt2(SURFACE_ALBEDO.skyer)}`;
    tags.push({
      id: 'skyer',
      text,
      x: clampTag(cloud.x, tagWidth(text, L.f), L.W),
      y: cloud.y,
      pointer: 6 * L.s,
    });
  }
  return tags;
}

/* ------------------------------------------------------------------ Landskapet */

/** Fjellkjeden: (x som andel av bredden fra mountainX til høyre kant, høyde som andel av mountainH). */
const RIDGE: readonly [number, number][] = [
  [0, 0.04],
  [0.05, 0.36],
  [0.1, 0.24],
  [0.19, 0.74],
  [0.26, 0.46],
  [0.32, 0.58],
  [0.4, 0.34],
  [0.5, 0.97],
  [0.58, 0.62],
  [0.66, 0.8],
  [0.74, 0.46],
  [0.83, 0.7],
  [0.91, 0.44],
  [1, 0.6],
];

/** Fjerne åser bak (luftperspektiv), over hele bredden. */
const FAR_RIDGE: readonly [number, number][] = [
  [0, 0.16],
  [0.08, 0.3],
  [0.17, 0.2],
  [0.27, 0.4],
  [0.36, 0.26],
  [0.46, 0.5],
  [0.55, 0.34],
  [0.64, 0.56],
  [0.74, 0.38],
  [0.86, 0.6],
  [1, 0.42],
];

/** Foten av fjellene ligger litt over havflaten (bak lavlandet). */
export const mountainBase = (L: StralingLayout) => L.yG - 4 * L.s;

/** Punktene langs fjellkjeden (venstre til høyre). */
export function mountainProfile(L: StralingLayout): Pt[] {
  const x0 = L.mountainX;
  const span = L.W + 4 - x0;
  const base = mountainBase(L);
  return RIDGE.map(([u, h]) => ({
    x: x0 + u * span,
    y: base - h * L.mountainH,
  }));
}

/** De fjerne åsene bak fjellene. */
export function farProfile(L: StralingLayout): Pt[] {
  const base = mountainBase(L);
  return FAR_RIDGE.map(([u, h]) => ({
    x: -4 + u * (L.W + 8),
    y: base - h * 0.62 * L.mountainH,
  }));
}

/** Den høyeste toppen. */
export function highestPeak(L: StralingLayout): Pt {
  return mountainProfile(L).reduce((a, b) => (b.y < a.y ? b : a));
}

/** Snøgrensen (y) på fjellene for snødekket 0–1: over den høyeste toppen ved 0, ved foten ved 1. */
export function snowLine(L: StralingLayout, snow: number): number {
  return mountainBase(L) - (1 - clamp(snow, 0, 1)) * L.mountainH;
}

/** Der snøen på lavlandet begynner (snøen ligger fra x til høyre kant). Ved 0 er det ingen snø. */
export const landSnowX = (L: StralingLayout, land: number) => L.W - clamp(land, 0, 1) * (L.W - L.xShore);

/** Der sjøisen begynner (isen ligger fra x til kysten). */
export const seaIceX = (L: StralingLayout, seaIce: number) => L.xShore * (1 - clamp(seaIce, 0, 1));

/**
 * Hvor punktet (lengde, bredde) i grader havner på jordkloden sett forfra (ortografisk projeksjon med senter i
 * (lon0, lat0)), i enheter av radien. z > 0 betyr synlig. Samme projeksjon som Planet i scene-kit-et.
 */
export function globePoint(lon: number, lat: number, lon0: number, lat0: number): [number, number, number] {
  const R = Math.PI / 180;
  const s0 = Math.sin(lat0 * R);
  const c0 = Math.cos(lat0 * R);
  const lam = (lon - lon0) * R;
  const cp = Math.cos(lat * R);
  const sp = Math.sin(lat * R);
  return [cp * Math.sin(lam), -(c0 * sp - s0 * cp * Math.cos(lam)), s0 * sp + c0 * cp * Math.cos(lam)];
}
