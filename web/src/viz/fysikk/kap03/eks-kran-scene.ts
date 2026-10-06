/**
 * Geometrien i figuren til «Byggekran løfter en last» (k3-eks-kran): målene på kranen og lasta i meter, utsnittet
 * (px per meter, viewBox) på PC og mobil, hvor lupen og stoppeklokka står, og hva figuren viser i hvert steg.
 * Rene funksjoner uten React, så de kan testes.
 *
 * Koordinater i meter: x langs bakken fra midten av tårnet (positiv mot bygget), y opp fra bakken.
 */
import type { CraneLoad, CraneTask } from './model-eks-kran';

/** Målene på tårnkranen (m). Høyden på tårnet følger løftehøyden, så kranen alltid rekker over bygget. */
export const CRANE = {
  /** Bredden på tårnet (fagverket). */
  mastW: 1.7,
  /** Fra dekket på bygget opp til svingkransen øverst i tårnet. */
  aboveRoof: 9,
  /** Høyden på svingkransen (mellom tårnet og utliggeren). */
  turntableH: 1.2,
  /** Høyden på fagverket i utliggeren. */
  jibDepth: 1.7,
  /** Tårnspissen over underkanten av utliggeren. */
  apexH: 8,
  /** Motutliggeren mot venstre (med motvektene ytterst). */
  counterLen: 11,
  /** Utliggeren mot høyre, fra midten av tårnet. */
  jibLen: 30,
  /** Bredden på betongfundamentet. */
  footW: 4.6,
} as const;

/** Der løpekatten står under løftet (m fra tårnet), og veggen på bygget (m). */
export const LIFT_X = 12.5;
export const FACADE_X = 16.5;

/** Høyden på krokblokka, kroken og stroppene (m). */
export const HOOK = { blockH: 0.9, blockW: 0.72, hookH: 0.45, slingH: 1.5 } as const;

/** Lasta sett fra siden (m): bredde og høyde (med pall eller strøbord). */
export const LOAD_DIMS: Record<CraneLoad, { w: number; h: number }> = {
  murstein: { w: 1.2, h: 1.05 },
  stalbjelker: { w: 6, h: 0.5 },
  gips: { w: 2.4, h: 0.62 },
};

/** Høyden til en person med hjelm (m). */
export const PERSON_HEIGHT = 1.8;

/** Hvor lasta er: på bakken, på vei (45 % av høyden) eller oppe ved dekket. */
export type Spot = 'ground' | 'mid' | 'top';

/** Underkanten av lasta over bakken (m). */
export function loadBottom(spot: Spot, h: number): number {
  return spot === 'ground' ? 0 : spot === 'top' ? h : 0.45 * h;
}

/** Høydene (m over bakken) til delene over lasta, når underkanten av lasta er `bottom`. */
export function hookHeights(load: CraneLoad, bottom: number) {
  const loadTop = bottom + LOAD_DIMS[load].h;
  const hookPoint = loadTop + HOOK.slingH;
  const blockBottom = hookPoint + HOOK.hookH;
  const blockTop = blockBottom + HOOK.blockH;
  return { loadTop, hookPoint, blockBottom, blockTop };
}

/** Underkanten av utliggeren (der løpekatten går) over bakken (m). */
export function jibBottom(h: number): number {
  return h + CRANE.aboveRoof + CRANE.turntableH;
}

/** Det høyeste punktet på kranen (toppen av tårnspissen med lampe) over bakken (m). */
export function craneTop(h: number): number {
  return jibBottom(h) + CRANE.apexH + 0.4;
}

export interface Circle {
  x: number;
  y: number;
  r: number;
}

export interface CraneLayout {
  W: number;
  H: number;
  /** Figurenheter per meter i scenen. */
  ppm: number;
  /** Bakken (forkanten av underlaget) i figurens enheter. */
  groundY: number;
  /** Bakkanten av underlaget (horisonten i landskapet). */
  horizonY: number;
  /** Midten av tårnet i figurens enheter. */
  mastX: number;
  /** Meter → figurens enheter. */
  X: (m: number) => number;
  Y: (m: number) => number;
  /** Tekstskalaen (1 på PC, ca. 1,8 på mobil) og gjenstandsskalaen k = max(1, 0,85 · f). */
  f: number;
  k: number;
  narrow: boolean;
  /** Lupen over fasaden. */
  lupe: Circle;
  /** Plass til et skilt rett over lupen (midten av skiltet). */
  lupeTag: { x: number; y: number };
  /** Stoppeklokka i c). */
  clock: Circle;
  /** Venstre kant av bygget i figurens enheter. */
  facadeX: number;
}

/**
 * Utsnittet. Skalaen (px/m) velges så hele kranen får plass i høyden, men aldri så stor at fasaden blir for smal til
 * lupen. På mobil er figuren høyere og lupen større, fordi teksten er større.
 */
export function craneLayout(task: CraneTask, opts: { narrow: boolean; f: number }): CraneLayout {
  const { narrow, f } = opts;
  const k = Math.max(1, 0.85 * f);
  const W = 800;
  const top = narrow ? 22 : 14;
  const groundDepth = narrow ? 64 : 44;
  const lupeR = narrow ? 128 : 92;
  const left = 10;
  const extentM = craneTop(task.h);
  // Høyden: hele kranen mellom toppmargen og bakken
  const Htarget = narrow ? 800 : 500;
  const ppmHeight = (Htarget - top - groundDepth) / extentM;
  // Bredden: fasaden må være minst 2R + 40 bred (fra veggen til høyre kant)
  const leftM = CRANE.counterLen + 1.6;
  const ppmWidth = (W - left - 2 * lupeR - 44) / (leftM + FACADE_X);
  const ppm = Math.min(ppmHeight, ppmWidth);
  const groundY = Math.round(top + extentM * ppm);
  const H = groundY + groundDepth;
  const mastX = left + leftM * ppm;
  const X = (m: number) => mastX + m * ppm;
  const Y = (m: number) => groundY - m * ppm;
  const facadeX = X(FACADE_X);

  // Lupen på fasaden, nær bakken, med plass til et skilt over den (under dekket). Er fasaden lav, blir lupen mindre.
  const roofY = Y(task.h);
  const tagH = 17 * f * 0.9 * 1.55;
  const facadeH = groundY - roofY;
  const R = Math.max(60, Math.min(lupeR, (facadeH - tagH - 26 * k) / 2));
  const slack = Math.max(0, facadeH - 2 * R - tagH - 26 * k);
  const lx = (facadeX + W) / 2;
  const ly = groundY - 10 * k - R - 0.35 * slack;
  const lupe = { x: lx, y: ly, r: R };
  const lupeTag = { x: lx, y: ly - R - 6 * k - tagH / 2 };

  // Stoppeklokka i c) står på samme sted som lupen (lupen vises ikke da).
  const clock = { x: lx, y: ly, r: 0.36 * R };

  return {
    W,
    H,
    ppm,
    groundY,
    horizonY: groundY - (narrow ? 30 : 26),
    mastX,
    X,
    Y,
    f,
    k,
    narrow,
    lupe,
    lupeTag,
    clock,
    facadeX,
  };
}

/** Hva figuren viser i ett steg. */
export interface FigureSpec {
  /** Hvor lasta er, og hvilken vei den beveger seg (null = står i ro eller ikke vist). */
  spot: Spot;
  dir: 'up' | 'down' | null;
  /** Gjennomsiktig last der den var (bakken eller oppe ved dekket). */
  ghost: Spot | null;
  /** Lupen med kreftene, med verdiene i et skilt over lupen. */
  lupe: boolean;
  values: boolean;
  /** Mållinja h fra bakken til dekket. */
  height: boolean;
  /** Den stiplede banen lasta går. */
  path: boolean;
  /** E_p ved bakken og oppe ved dekket, og nullnivået. */
  ep: boolean;
  /** Fartspila og skiltet med farten ved lasta, og stoppeklokka. */
  velocity: boolean;
  clock: boolean;
  /** Effekten ved vinsjen. */
  power: boolean;
  /** Byggestrømskapet og kabelen. */
  supply: boolean;
  /** Motoren som generator. */
  generator: boolean;
  /** Energiflyten under scenen. */
  energy: 'up' | 'upKwh' | 'down' | 'round' | null;
}

const BASE: FigureSpec = {
  spot: 'mid',
  dir: null,
  ghost: null,
  lupe: false,
  values: false,
  height: false,
  path: false,
  ep: false,
  velocity: false,
  clock: false,
  power: false,
  supply: false,
  generator: false,
  energy: null,
};

/** Antall steg i løsningen (a: 2, b: 2, c: 2, d: 2, e: 3). */
export const STEP_COUNT = 11;

/**
 * Figuren i hvert steg. 0 = oppgaven (situasjonen med h), 1–2 a), 3–4 b), 5–6 c), 7–8 d), 9–11 e).
 * Med `showAll` vises lasta oppe med lupen, høyden, E_p og hele energiflyten.
 */
export function figureSpec(step: number, showAll: boolean): FigureSpec {
  if (showAll) return { ...BASE, spot: 'top', ghost: 'ground', lupe: true, height: true, path: true, ep: true, energy: 'round' };
  switch (step) {
    case 1:
      return { ...BASE, dir: 'up', lupe: true };
    case 2:
      return { ...BASE, dir: 'up', lupe: true, values: true };
    case 3:
      return { ...BASE, spot: 'top', ghost: 'ground', lupe: true, height: true, path: true };
    case 4:
      return { ...BASE, spot: 'top', ghost: 'ground', height: true, path: true, ep: true };
    case 5:
      return { ...BASE, dir: 'up', height: true, velocity: true, clock: true };
    case 6:
      return { ...BASE, dir: 'up', lupe: true, velocity: true, power: true };
    case 7:
      return { ...BASE, spot: 'top', ghost: 'ground', supply: true, energy: 'up' };
    case 8:
      return { ...BASE, spot: 'top', ghost: 'ground', supply: true, energy: 'upKwh' };
    case 9:
      return { ...BASE, dir: 'down', ghost: 'top', lupe: true, values: true, ep: true };
    case 10:
      return { ...BASE, dir: 'down', ghost: 'top', generator: true, energy: 'down' };
    case 11:
      return { ...BASE, spot: 'ground', ghost: 'top', supply: true, generator: true, energy: 'round' };
    default:
      return { ...BASE, dir: 'up', height: true };
  }
}

/** Den vannrette utstrekningen av lasta i figurens enheter: [venstre, høyre]. */
export function loadSpan(L: CraneLayout, load: CraneLoad): [number, number] {
  const w = LOAD_DIMS[load].w;
  return [L.X(LIFT_X - w / 2), L.X(LIFT_X + w / 2)];
}

/**
 * Lupens skala (px/m) og hvor lasta står i lupen: midten av lasta litt under midten av lupen, så stroppene og kroken
 * synes over og G-pila får plass under. Lange laster (stålbjelker) zoomes mindre, så hele bunten får plass.
 */
export function lupeMap(lupe: Circle, load: CraneLoad): { Z: number; cx: number; cy: number } {
  const { w } = LOAD_DIMS[load];
  const Z = Math.min(lupe.r / 2.0, (1.6 * lupe.r) / w);
  return { Z, cx: lupe.x, cy: lupe.y + 0.1 * lupe.r };
}

/**
 * Pilene i lupen: S fra midt på oversiden av lasta og opp, G fra tyngdepunktet og ned, like lange (S = G). Fartspila
 * står over lasta til høyre, utenfor stroppene, og peker opp eller ned.
 */
export function lupeArrows(lupe: Circle, load: CraneLoad, dir: 'up' | 'down' | null = 'up'): { S: Seg; G: Seg; v: Seg } {
  const { Z, cx, cy } = lupeMap(lupe, load);
  const hh = (LOAD_DIMS[load].h * Z) / 2;
  const len = 0.52 * lupe.r;
  const vx = cx + 0.62 * lupe.r;
  const vLow = cy - hh - 0.08 * lupe.r;
  const vHigh = cy - hh - 0.46 * lupe.r;
  return {
    S: { x1: cx, y1: cy - hh, x2: cx, y2: cy - hh - len },
    G: { x1: cx, y1: cy, x2: cx, y2: cy + len },
    v: dir === 'down' ? { x1: vx, y1: vHigh, x2: vx, y2: vLow } : { x1: vx, y1: vLow, x2: vx, y2: vHigh },
  };
}

export interface Seg {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

/**
 * De to ytre tangentene mellom ringen rundt lasta og lupen (strekene som viser hvor utsnittet er tatt).
 * null når sirklene overlapper.
 */
export function outerTangents(a: Circle, b: Circle): [{ x: number; y: number }, { x: number; y: number }][] | null {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const d = Math.hypot(dx, dy);
  if (d <= Math.abs(b.r - a.r) + 1e-9 || d <= a.r + b.r) return null;
  const out: [{ x: number; y: number }, { x: number; y: number }][] = [];
  const base = Math.atan2(dy, dx);
  const phi = Math.acos((a.r - b.r) / d);
  for (const s of [1, -1]) {
    const t = base + s * phi;
    out.push([
      { x: a.x + a.r * Math.cos(t), y: a.y + a.r * Math.sin(t) },
      { x: b.x + b.r * Math.cos(t), y: b.y + b.r * Math.sin(t) },
    ]);
  }
  return out;
}
