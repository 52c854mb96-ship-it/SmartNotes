/**
 * Geometrien i scenen «Vannkraftverk» (ren matematikk uten React, så den kan testes): magasinet med demningen,
 * fjellsida med rørgata, kraftstasjonen, elva og bygda.
 *
 * Fallhøyden går fra 5 m (elveterskel) til 1 000 m (de høyeste fjellkraftverkene), så scenen kan ikke tegnes i
 * målestokk. Høyden i figuren følger logaritmen til fallhøyden (hver dobling flytter magasinet like langt), og
 * figuren sier fra om det. Alt annet (demningen, stasjonen, trærne) har fast størrelse.
 */
import { FLOW_STEPS, HEAD_STEPS } from './model-vannkraft';

export type Pt = [number, number];

export interface HydroLayout {
  W: number;
  H: number;
  /** Dalbunnen der kraftstasjonen står (y i figuren). */
  groundY: number;
  /** Fallhøyden i figuren (px) for den minste og den største fallhøyden. */
  dropMin: number;
  dropMax: number;
  /** Oppstrøms side av demningen (x) ved minst og størst fallhøyde. */
  xDam: [number, number];
  /** Vannrett avstand fra foten av demningen til foten av fjellsida ved minst og størst fallhøyde. */
  run: [number, number];
  /** Kraftstasjonen (bredde og høyde på veggene). */
  stationW: number;
  stationH: number;
  /** Bredden på elva til høyre for stasjonen. */
  riverW: number;
  /** Tykkelsen på rørgata (px) ved minst og størst vannføring. */
  pipe: [number, number];
}

export const HYDRO_WIDE: HydroLayout = {
  W: 800,
  H: 450,
  groundY: 394,
  dropMin: 104,
  dropMax: 296,
  xDam: [270, 150],
  run: [46, 246],
  stationW: 150,
  stationH: 96,
  riverW: 74,
  pipe: [6, 22],
};

export const HYDRO_NARROW: HydroLayout = {
  W: 560,
  H: 560,
  groundY: 488,
  dropMin: 120,
  dropMax: 330,
  xDam: [168, 96],
  run: [34, 162],
  stationW: 132,
  stationH: 90,
  riverW: 50,
  pipe: [7, 22],
};

const H_MIN = HEAD_STEPS[0]!;
const H_MAX = HEAD_STEPS[HEAD_STEPS.length - 1]!;
const Q_MIN = FLOW_STEPS[0]!;
const Q_MAX = FLOW_STEPS[FLOW_STEPS.length - 1]!;

/** Hvor langt fallhøyden er kommet på glidebryteren (0 ved 5 m, 1 ved 1 000 m), på logaritmisk skala. */
export function headFraction(h: number): number {
  return logFraction(h, H_MIN, H_MAX);
}

/** Det samme for vannføringen (0 ved 0,01 m³/s, 1 ved 300 m³/s). */
export function flowFraction(Q: number): number {
  return logFraction(Q, Q_MIN, Q_MAX);
}

function logFraction(v: number, lo: number, hi: number): number {
  if (!(v > 0)) return 0;
  return clamp(Math.log(v / lo) / Math.log(hi / lo), 0, 1);
}

export interface Dam {
  /** Oppstrøms side (mot magasinet), loddrett. */
  x: number;
  /** Toppen (kronen) og foten. */
  crestY: number;
  baseY: number;
  crestW: number;
  /** Nedstrøms fot (der fjellsida begynner). */
  toeX: number;
}

export interface HydroScene {
  lay: HydroLayout;
  /** 0–1 langs glidebryteren for fallhøyden. */
  u: number;
  /** Fallhøyden i figuren (px): fra vannflata i magasinet ned til midten av turbinen. */
  drop: number;
  surfaceY: number;
  turbine: { x: number; y: number };
  dam: Dam;
  /** Overflata av terrenget fra venstre kant til høyre kant (med bunnen av magasinet og elveleiet). */
  terrain: Pt[];
  /** Fjellsida fra foten av demningen til foten av lia (der rørgata ligger). */
  slope: Pt[];
  /**
   * Midtlinja i rørgata: fra inntaket i magasinet, gjennom demningen (tegnes bak den), ned lia og inn i stasjonen
   * til turbinen.
   */
  pipe: Pt[];
  /** Inntaket (munningen av røret i magasinet). */
  intake: { x: number; y: number };
  /** Tykkelsen på rørgata (px). */
  pipeW: number;
  /** Kraftstasjonen: venstre vegg i x, bakken i y. */
  station: { x: number; y: number; w: number; h: number };
  /** Elva til høyre for stasjonen: vannflata og bredden. */
  river: { x1: number; x2: number; y: number; depth: number };
  /** Plassen til bygda til høyre for elva. */
  village: { x1: number; x2: number };
}

/** Høyden på turbinen over bakken, som andel av høyden på stasjonen. */
export const TURBINE_LIFT = 0.19;
/** Hvor høyt over vannflata kronen på demningen står (px). */
const FREEBOARD = 7;

/**
 * Hele scenen for fallhøyden h og vannføringen Q i utformingen `lay`. Magasinet ligger øverst til venstre bak
 * demningen, rørgata følger fjellsida ned til stasjonen, og elva og bygda ligger til høyre.
 */
export function hydroScene(h: number, Q: number, lay: HydroLayout): HydroScene {
  const u = headFraction(h);
  const drop = lerp(lay.dropMin, lay.dropMax, u);
  const { groundY, stationW, stationH } = lay;
  const turbineY = groundY - TURBINE_LIFT * stationH;
  const surfaceY = turbineY - drop;

  // Demningen: dybden i magasinet vokser med fallhøyden, men demningen er aldri høyere enn 53 px.
  const lakeDepth = clamp(0.35 * (groundY - surfaceY), 18, 46);
  const crestY = surfaceY - FREEBOARD;
  const baseY = surfaceY + lakeDepth;
  const xDam = lerp(lay.xDam[0], lay.xDam[1], u);
  const crestW = 9;
  const toeX = xDam + crestW + 0.72 * (baseY - crestY);
  const dam: Dam = { x: xDam, crestY, baseY, crestW, toeX };

  // Fjellsida: slak ved toppen og foten og brattest midt på (cosinusform), med noen små hyller.
  const footX = toeX + lerp(lay.run[0], lay.run[1], u);
  const slope: Pt[] = [];
  const n = 28;
  for (let i = 0; i <= n; i++) {
    const s = i / n;
    const bump = Math.sin(s * Math.PI * 3) * Math.sin(s * Math.PI) * 0.035;
    const t = 0.5 - 0.5 * Math.cos(Math.PI * s) + bump;
    slope.push([toeX + s * (footX - toeX), baseY + clamp(t, 0, 1) * (groundY - baseY)]);
  }

  const station = { x: footX + 8, y: groundY, w: stationW, h: stationH };
  const riverX1 = station.x + stationW + 6;
  const riverX2 = riverX1 + lay.riverW;
  const river = { x1: riverX1, x2: riverX2, y: groundY + 9, depth: 22 };

  // Terrenget: fjellet til venstre for magasinet, bunnen av magasinet, demningen står på en rygg, fjellsida,
  // dalbunnen, elveleiet og et flatt jorde der bygda ligger.
  const shoreX = -30;
  const terrain: Pt[] = [
    [-60, surfaceY - 30],
    [shoreX, surfaceY + 0.55 * lakeDepth],
    [0.28 * xDam, baseY - 2],
    [0.7 * xDam, baseY],
    [xDam, baseY],
    ...slope,
    [station.x + stationW + 2, groundY],
    [riverX1, groundY + 4],
    [riverX1 + 8, groundY + 20],
    [riverX2 - 8, groundY + 20],
    [riverX2, groundY + 4],
    [riverX2 + 6, groundY],
    [lay.W + 60, groundY],
  ];

  // Rørgata: inntaket ligger like over bunnen av magasinet, røret går gjennom foten av demningen og følger
  // fjellsida (litt over bakken, på støtter) ned til stasjonen, der det går vannrett inn til turbinen.
  const pipeW = lerp(lay.pipe[0], lay.pipe[1], flowFraction(Q));
  const lift = pipeW / 2 + 4;
  const intakeY = baseY - lift;
  const pipe: Pt[] = [[xDam - 16, intakeY]];
  // Der røret kommer ut av den skrå nedstrøms siden av demningen
  pipe.push([toeX - 0.72 * (baseY - intakeY), intakeY]);
  // Langs lia: punktene på bakken løftet loddrett, men aldri lavere enn turbinen (røret går ikke under den).
  for (let i = 1; i < slope.length - 1; i++) {
    const [x, y] = slope[i]!;
    pipe.push([x, Math.min(y - lift, turbineY)]);
  }
  pipe.push([footX - 2, turbineY]);
  const turbineX = station.x + 0.33 * stationW;
  pipe.push([turbineX - 0.2 * stationW, turbineY]);

  return {
    lay,
    u,
    drop,
    surfaceY,
    turbine: { x: turbineX, y: turbineY },
    dam,
    terrain,
    slope,
    pipe: smoothCorners(pipe, 1),
    intake: { x: xDam - 16, y: intakeY },
    pipeW,
    station,
    river,
    village: { x1: riverX2 + 10, x2: lay.W },
  };
}

/* ---------- Plassering av etiketter ---------- */

export interface Box {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface LabelSpot {
  /** Grunnlinjen til (første linje i) teksten. */
  lx: number;
  ly: number;
  anchor: 'start' | 'middle' | 'end';
}

/** Omtrentlig bredde på et tegn som andel av skriftstørrelsen (halvfet skrift). */
const CHAR_W = 0.68;

/**
 * Omtrentlig boks rundt en etikett med `lines` linjer (den lengste har `chars` tegn) og skriftstørrelsen `fs` (px),
 * med litt luft rundt.
 */
export function labelBox(s: LabelSpot, chars: number, fs: number, lines = 1, pad = 4): Box {
  const w = chars * CHAR_W * fs;
  const x1 = s.anchor === 'start' ? s.lx : s.anchor === 'end' ? s.lx - w : s.lx - w / 2;
  return { x1: x1 - pad, y1: s.ly - 0.82 * fs - pad, x2: x1 + w + pad, y2: s.ly + 0.25 * fs + (lines - 1) * 1.25 * fs + pad };
}

export function overlap(a: Box, b: Box): number {
  const w = Math.min(a.x2, b.x2) - Math.max(a.x1, b.x1);
  const h = Math.min(a.y2, b.y2) - Math.max(a.y1, b.y1);
  return w > 0 && h > 0 ? w * h : 0;
}

/** Hvor mye av boksen som stikker utenfor rammen (areal). */
function outside(a: Box, frame: Box): number {
  const area = (a.x2 - a.x1) * (a.y2 - a.y1);
  return area - overlap(a, frame);
}

/**
 * Velg den første plassen der etiketten verken overlapper noe eller går ut av rammen. Finnes ingen, velges plassen
 * med minst overlapp (det som går ut av rammen teller dobbelt).
 */
export function placeLabel<T extends LabelSpot>(spots: T[], chars: number, fs: number, obstacles: Box[], frame: Box, lines = 1): T & { box: Box } {
  let best: (T & { box: Box }) | null = null;
  let bestCost = Infinity;
  for (const s of spots) {
    const box = labelBox(s, chars, fs, lines);
    const cost = obstacles.reduce((sum, o) => sum + overlap(box, o), 0) + 2 * outside(box, frame);
    if (cost <= 0) return { ...s, box };
    if (cost < bestCost) {
      bestCost = cost;
      best = { ...s, box };
    }
  }
  if (best) return best;
  const fallback = spots[0];
  if (!fallback) throw new Error('placeLabel trenger minst én plass');
  return { ...fallback, box: labelBox(fallback, chars, fs, lines) };
}

/**
 * Hvor langt langs en polylinje (px) hvert punkt ligger, og punktet og retningen (enhetsvektor) ved en gitt lengde.
 */
export function polylineLength(pts: Pt[]): number[] {
  const out = [0];
  for (let i = 1; i < pts.length; i++) {
    const [ax, ay] = pts[i - 1]!;
    const [bx, by] = pts[i]!;
    out.push(out[i - 1]! + Math.hypot(bx - ax, by - ay));
  }
  return out;
}

export function pointAlong(pts: Pt[], d: number): { x: number; y: number; dx: number; dy: number } {
  const L = polylineLength(pts);
  const total = L[L.length - 1] ?? 0;
  const s = clamp(d, 0, total);
  for (let i = 1; i < pts.length; i++) {
    if (s <= L[i]! || i === pts.length - 1) {
      const [ax, ay] = pts[i - 1]!;
      const [bx, by] = pts[i]!;
      const seg = L[i]! - L[i - 1]!;
      const t = seg > 0 ? (s - L[i - 1]!) / seg : 0;
      const len = seg > 0 ? seg : 1;
      return { x: ax + (bx - ax) * t, y: ay + (by - ay) * t, dx: (bx - ax) / len, dy: (by - ay) / len };
    }
  }
  const p = pts[0] ?? [0, 0];
  return { x: p[0], y: p[1], dx: 1, dy: 0 };
}

/** Avrund knekkene i en polylinje litt (Chaikin), så røret bøyer mykt. Endepunktene står fast. */
export function smoothCorners(pts: Pt[], iterations = 1): Pt[] {
  let cur = pts;
  for (let k = 0; k < iterations; k++) {
    if (cur.length < 3) return cur;
    const next: Pt[] = [cur[0]!];
    for (let i = 0; i < cur.length - 1; i++) {
      const [ax, ay] = cur[i]!;
      const [bx, by] = cur[i + 1]!;
      if (i > 0) next.push([0.75 * ax + 0.25 * bx, 0.75 * ay + 0.25 * by]);
      if (i < cur.length - 2) next.push([0.25 * ax + 0.75 * bx, 0.25 * ay + 0.75 * by]);
    }
    next.push(cur[cur.length - 1]!);
    cur = next;
  }
  return cur;
}

/** Høyden på terrenget (y) i x, lineært mellom punktene. */
export function terrainY(pts: Pt[], x: number): number {
  if (pts.length === 0) return 0;
  if (x <= pts[0]![0]) return pts[0]![1];
  for (let i = 1; i < pts.length; i++) {
    const [ax, ay] = pts[i - 1]!;
    const [bx, by] = pts[i]!;
    if (x <= bx) return bx > ax ? ay + ((by - ay) * (x - ax)) / (bx - ax) : by;
  }
  return pts[pts.length - 1]![1];
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}
