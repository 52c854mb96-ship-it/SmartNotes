/**
 * Utformingen av scenen i «Bevaring av mekanisk energi» (ren geometri uten React, så den kan testes):
 * skalaen px/m, hvor banen og energistolpene står, og hvor skateren eller akebrettet er på banen.
 *
 * På PC står energistolpene til høyre for banen med samme høydeskala som banen: E_p-stolpen er like høy som brettet
 * står over nullnivået, og E₀ ligger på linja for h₀. På mobil fyller banen hele bredden, og stolpene står under.
 */
import { TRACK_TOP, type Track, type TrackKind } from './model';

export const SCENE_W = 800;

/**
 * Synlig del av verden (m) rundt banen: plattformene på halfpipen og toppene i akebakken. På mobil er utsnittet
 * smalere, så personene blir større.
 */
export const WORLD: Record<'wide' | 'narrow', Record<TrackKind, { left: number; right: number }>> = {
  wide: { rampe: { left: -1.6, right: 13.6 }, bakke: { left: -0.6, right: 16.8 } },
  narrow: { rampe: { left: -0.7, right: 12.7 }, bakke: { left: -0.6, right: 16.6 } },
};

/** Bunnen av halfpipen står på et lavt fundament, så banen begynner litt over betongen. */
export const RAMP_BASE = 0.3;

/** Brettet: lengde og høyden fra underlaget til oversiden av brettet der føttene står (m). */
export const SKATEBOARD = { length: 0.8, deck: 0.11 };
/** Akebrettet er 0,8 m langt (som i scene-kit-et). */
export const SLED_LENGTH = 0.8;
/** Personene er 1,75 m høye. */
export const PERSON_HEIGHT = 1.75;
/** Tyngdepunktet over underlaget (m): skateren står på huk på brettet, akeren sitter. */
export const COM_HEIGHT: Record<TrackKind, number> = { rampe: 0.11 + 0.83, bakke: 0.42 };

/** Fartspila: lengden i meter per m/s (i samme skala som banen), så 10 m/s blir 2,8 m lang. */
export const SPEED_ARROW_M = 0.28;

export interface BarBox {
  /** Venstre og høyre kant av området for stolpene. */
  x0: number;
  x1: number;
  /** Grunnlinja (E = 0). */
  base: number;
  /** Figurenheter per «energimeter» E/(mg), altså px/m når stolpene står ved siden av banen. */
  k: number;
  /** Kortet bak stolpene. */
  card: { x: number; y: number; w: number; h: number };
  /** Stolpene står ved siden av banen med samme høydeskala (PC), eller under scenen (mobil). */
  beside: boolean;
}

export interface SceneLayout {
  kind: TrackKind;
  narrow: boolean;
  W: number;
  /** Høyden på hele figuren. */
  H: number;
  /** Høyden på selve scenen (på mobil står stolpene under). */
  sceneH: number;
  ppm: number;
  /** Synlig del av verden (m). */
  xLeft: number;
  xRight: number;
  /** Høyre kant av scenen som er fri for tekst (stolpekortet begynner der på PC). */
  freeRight: number;
  X: (x: number) => number;
  Y: (h: number) => number;
  /** Bakken (betongen under halfpipen, eller snøen foran bakken). */
  groundY: number;
  /** Horisonten bak scenen. */
  horizon: number;
  bars: BarBox;
}

/**
 * Utformingen for en bane og en skjermbredde. `f` er tekstskalaen (1 på PC, ca. 1,84 på mobil), så det blir
 * plass til etikettene under stolpene og over banen.
 */
export function sceneLayout(kind: TrackKind, narrow: boolean, f = narrow ? 1.84 : 1): SceneLayout {
  const W = SCENE_W;
  const { left: xLeft, right: xRight } = WORLD[narrow ? 'narrow' : 'wide'][kind];
  // På PC får banen 580 av 800 enheter, og stolpene resten. På mobil fyller banen hele bredden.
  const trackW = narrow ? W : 580;
  const ppm = trackW / (xRight - xLeft);
  // Over den høyeste delen av banen: rekkverket på plattformen (1 m) og litt himmel.
  const yTop = Math.round(1.3 * ppm + 22 * f);
  const yZero = yTop + TRACK_TOP * ppm;
  const X = (x: number) => (x - xLeft) * ppm;
  const Y = (h: number) => yZero - h * ppm;
  const groundY = kind === 'rampe' ? Y(-RAMP_BASE) : Y(0);
  // Under nullnivået: etiketten «nullnivå» og (på PC) navnene under stolpene. I akebakken kan fartspila peke ned
  // bakken under nullnivået (opptil 2,2 m når akebrettet suser ned mot dalen), så der er det mer snø nederst.
  const sceneH = Math.round(Math.max(groundY + 26 * f, yZero + 40 * f, kind === 'bakke' ? Y(-2.35) : 0) + 6);
  const horizon = kind === 'rampe' ? groundY - 0.9 * ppm : Y(1.2);

  if (!narrow) {
    const x0 = 598;
    const x1 = 788;
    const card = { x: x0 - 8, y: Y(TRACK_TOP) - 44, w: x1 - x0 + 16, h: yZero + 38 * f - (Y(TRACK_TOP) - 44) };
    return {
      kind,
      narrow,
      W,
      H: sceneH,
      sceneH,
      ppm,
      xLeft,
      xRight,
      freeRight: card.x - 6,
      X,
      Y,
      groundY,
      horizon,
      bars: { x0, x1, base: yZero, k: ppm, card, beside: true },
    };
  }

  // Mobil: stolpene i et eget felt under scenen, med fast skala (E for hele banehøyden = 150 enheter).
  const top = sceneH + 12;
  const barMax = 150;
  const base = top + 18 + 30 * f + barMax;
  const H = Math.round(base + 34 * f + 14);
  const card = { x: 12, y: top, w: W - 24, h: H - top - 6 };
  return {
    kind,
    narrow,
    W,
    H,
    sceneH,
    ppm,
    xLeft,
    xRight,
    freeRight: W - 6,
    X,
    Y,
    groundY,
    horizon,
    bars: { x0: 40, x1: W - 40, base, k: barMax / TRACK_TOP, card, beside: false },
  };
}

/** Høyden på stolpen (figurenheter) for energien E når massen er m: E/(mg) «energimeter» ganger skalaen. */
export function barHeight(bars: BarBox, E: number, m: number, g: number): number {
  if (!(m > 0) || !Number.isFinite(E)) return 0;
  return Math.max(0, (E / (m * g)) * bars.k);
}

export interface RiderFrame {
  /** Punktet på banen (figurens enheter). */
  x: number;
  y: number;
  /** Dreiningen (grader med klokka i SVG) som legger brettet langs banen. */
  rotate: number;
  /** Enhetsvektor langs banen mot høyre (figurens koordinater, y ned). */
  tx: number;
  ty: number;
  /** Enhetsvektor ut fra banen, oppover (normalen). */
  nx: number;
  ny: number;
}

/** Punktet på banen i posisjonen x (m), med tangent og normal, i figurens koordinater. */
export function riderFrame(track: Track, L: Pick<SceneLayout, 'X' | 'Y'>, x: number): RiderFrame {
  const k = track.slope(x);
  const n = Math.sqrt(1 + k * k);
  return {
    x: L.X(x),
    y: L.Y(track.height(x)),
    rotate: (-Math.atan(k) * 180) / Math.PI,
    tx: 1 / n,
    ty: -k / n,
    nx: -k / n,
    ny: -1 / n,
  };
}

/** Et punkt `along` langs banen og `up` ut fra den, regnet fra punktet i rammen (figurens enheter). */
export function framePoint(fr: RiderFrame, along: number, up: number): { x: number; y: number } {
  return { x: fr.x + fr.tx * along + fr.nx * up, y: fr.y + fr.ty * along + fr.ny * up };
}

/** Hvor langt foran tyngdepunktet fartspila begynner (m), så den ikke dekker kroppen. */
export const ARROW_AHEAD: Record<TrackKind, number> = { rampe: 0.62, bakke: 0.7 };

/**
 * Fartspila langs banen: fra et punkt i hoftehøyde litt foran kroppen og v · SPEED_ARROW_M meter i fartsretningen.
 * `v` er farten med fortegn (positiv mot høyre).
 */
export function speedArrow(fr: RiderFrame, kind: TrackKind, ppm: number, v: number): { x1: number; y1: number; x2: number; y2: number } {
  const sv = v >= 0 ? 1 : -1;
  const com = framePoint(fr, 0, COM_HEIGHT[kind] * ppm);
  const ahead = ARROW_AHEAD[kind] * ppm;
  const x1 = com.x + fr.tx * sv * ahead;
  const y1 = com.y + fr.ty * sv * ahead;
  const len = Math.abs(v) * SPEED_ARROW_M * ppm;
  return { x1, y1, x2: x1 + fr.tx * sv * len, y2: y1 + fr.ty * sv * len };
}

/**
 * Hvilken vei skateren ser: fartsretningen når den beveger seg, ellers den veien tyngden vil dra den (ned bakken).
 * På bunnen i ro: mot høyre.
 */
export function facing(v: number, slope: number): 1 | -1 {
  if (Math.abs(v) > 0.05) return v > 0 ? 1 : -1;
  if (Math.abs(slope) > 1e-6) return slope > 0 ? -1 : 1;
  return 1;
}

/** Omtrentlig bredde på en etikett i figurens enheter (Txt er 17 · størrelse · tekstskala høy). */
export function textWidth(text: string, size: number, f: number): number {
  return text.length * 17 * size * f * 0.58;
}

/**
 * Plassering av fartsetiketten ved spissen av pila, men innenfor scenen (mellom 6 og `right`, og under toppen).
 * Bratte piler får etiketten ved siden av spissen, flatere piler like forbi spissen.
 */
export function speedLabelPlace({
  x1,
  y1,
  x2,
  y2,
  text,
  f,
  right,
  top,
  bottom = Infinity,
}: {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  text: string;
  f: number;
  right: number;
  top: number;
  /** Nederste grunnlinje etiketten kan ha. */
  bottom?: number;
}): { x: number; y: number; anchor: 'start' | 'end' } {
  const len = Math.hypot(x2 - x1, y2 - y1) || 1;
  const ux = (x2 - x1) / len;
  const uy = (y2 - y1) / len;
  const w = textWidth(text, 0.9, f);
  let anchor: 'start' | 'end';
  let x: number;
  let y: number;
  if (Math.abs(uy) > 0.75) {
    // Bratt: ved siden av spissen, på den siden pila heller mot
    anchor = ux >= 0 ? 'start' : 'end';
    x = x2 + (anchor === 'start' ? 1 : -1) * 10 * f;
    y = y2 + (uy > 0 ? -2 : 12) * f;
  } else {
    anchor = ux >= 0 ? 'start' : 'end';
    x = x2 + ux * 10 * f;
    y = y2 + uy * 14 * f + 6 * f;
  }
  // Innenfor figuren: snu etiketten til andre siden av spissen hvis den går ut, og legg den på den siden av pila
  // der skaftet ikke er (under spissen når pila peker nedover, over når den peker oppover)
  const flipY = uy > 0.15 ? y2 + 20 * f : y2 - 12 * f;
  if (anchor === 'start' && x + w > right) {
    anchor = 'end';
    x = Math.min(x2, right) - 6 * f;
    y = flipY;
  } else if (anchor === 'end' && x - w < 6) {
    anchor = 'start';
    x = Math.max(x2, 6) + 6 * f;
    y = flipY;
  }
  x = anchor === 'start' ? Math.max(6, Math.min(x, right - w)) : Math.min(right, Math.max(x, 6 + w));
  y = Math.min(bottom, Math.max(top + 16 * f, y));
  return { x, y, anchor };
}

/* ---------- Plassering av etiketter ---------- */

export interface Box {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
}

/** Boksen rundt en tekst med grunnlinje y (Txt er ca. 17 · størrelse · f høy, bredden fra textWidth). */
export function textBox(x: number, y: number, w: number, anchor: 'start' | 'middle' | 'end', size: number, f: number): Box {
  const x0 = anchor === 'start' ? x : anchor === 'end' ? x - w : x - w / 2;
  return { x0: x0 - 5, x1: x0 + w + 5, y0: y - 15 * size * f - 2, y1: y + 5 * size * f + 2 };
}

export function boxesOverlap(a: Box, b: Box): boolean {
  return a.x0 < b.x1 && a.x1 > b.x0 && a.y0 < b.y1 && a.y1 > b.y0;
}

/** Om linjestykket fra a til b (med halv tykkelse `pad`) går gjennom boksen. */
export function segmentHitsBox(a: { x: number; y: number }, b: { x: number; y: number }, box: Box, pad = 0): boolean {
  const len = Math.hypot(b.x - a.x, b.y - a.y);
  const n = Math.max(1, Math.ceil(len / 3));
  for (let i = 0; i <= n; i++) {
    const x = a.x + ((b.x - a.x) * i) / n;
    const y = a.y + ((b.y - a.y) * i) / n;
    if (x > box.x0 - pad && x < box.x1 + pad && y > box.y0 - pad && y < box.y1 + pad) return true;
  }
  return false;
}
