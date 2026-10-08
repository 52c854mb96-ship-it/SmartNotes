/**
 * Geometrien i scenen til «Bølger» (ren, uten React, så den kan testes): fysikkrommet med en elev som rister i et tau
 * (transversal bølge) eller dytter i en lang spiralfjær som ligger på labbenken (longitudinal bølge).
 *
 * Én fast skala PX_PER_M i hele scenen: eleven er 1,75 m, tauet henger i skulderhøyde, benken er 0,90 m høy, og
 * målebåndet på gulvet går fra x = 0 (hånda i likevekt) til 6 m. Bølgen selv regnes ut i model.ts.
 */
import { personPunkter, type Leddvinkler } from '../../kit/scene/figurer-skjelett';
import { crestPositions, waveDisplacement } from './model';

/** Bredden på figuren. */
export const W = 800;
/** Piksler per meter. Eleven (1,75 m) blir 196 høy. */
export const PX_PER_M = 112;
/** Der x = 0 m ligger i figuren: hånda (enden av tauet eller fjæra) i likevekt. */
export const X0 = 124;
/** Den delen av mediet som vises og måles (m). */
export const X_MAX = 6;
/** Tauet og fjæra fortsetter litt ut av bildet til høyre (m), så enden ikke synes. */
export const X_END = (W + 30 - X0) / PX_PER_M;
/** Den markerte partikkelen (båndet på tauet eller den merkede vindingen), m. */
export const XP = 3;

/** Høyden til eleven (m). */
export const PERSON_M = 1.75;
export const PERSON_SIZE = PERSON_M * PX_PER_M;
/** Tauet holdes i skulderhøyde (m), så hånda rekker både opp og ned med den største amplituden (0,5 m). */
export const ROPE_M = 1.37;
/** Labbenken (m). */
export const BENCH_M = 0.9;
/**
 * Radius på vindingene i fjæra (m) og avstanden mellom dem i likevekt (m): en stor demonstrasjonsfjær (17 cm i
 * diameter), så fortetningene synes.
 */
export const SLINKY_R_M = 0.085;
export const COIL_M = 0.04;

/** Hvor langt foran skulderen hånda er når eleven står i ro (m): litt bøyd arm. */
const PREF_REACH_M = 0.3;
/** Hvor nær skulderen hånda kan komme (m) når armen bøyes. */
const MIN_REACH_M = 0.1;
/** Hvor stor del av en bevegelse fram og tilbake armen tar (resten tar overkroppen, og til slutt føttene). */
const ARM_SHARE = 0.4;
/** Ryggvinkelen eleven kan lene seg (grader, positiv = forover), og ryggvinkelen når hånda er i likevekt. */
export const RYGG_MIN = -12;
export const RYGG_MAX = 34;
const RYGG_REST: Record<WaveKind, number> = { transversal: 3, longitudinal: 11 };
/** Armen fra skulderen til midten av en knyttet hånd: overarm + underarm + grep, i en figur som er 100 høy. */
const ARM_U = 18.5 + 14.5 + 2.3;
/** Hånda holdes innenfor denne andelen av armlengden, så armen aldri er helt strak. */
const REACH_USE = 0.94;
/** Rekkevidden til armen (px). */
export const ARM_REACH_PX = ARM_U * (PERSON_SIZE / 100);

export type WaveKind = 'transversal' | 'longitudinal';

/** Stillingen til eleven: litt skrittstilling, overkroppen lener `rygg` grader forover (hofta står stille). */
export function stance(rygg: number, kind: WaveKind): Partial<Leddvinkler> {
  // Hofte er låret mot overkroppen, så + rygg holder lårene i ro når overkroppen lener seg.
  const legs = kind === 'transversal' ? { bak: -9, fram: 12 } : { bak: -13, fram: 15 };
  return {
    rygg,
    nakke: -0.65 * rygg,
    venstreHofte: rygg + legs.bak,
    hoyreHofte: rygg + legs.fram,
    venstreKne: 6,
    hoyreKne: 8,
  };
}

export interface Pt {
  x: number;
  y: number;
}

export interface DriverPose {
  /** Ankerpunktet (midt mellom føttene). */
  x: number;
  ledd: Partial<Leddvinkler>;
  /** Skulderen (der armen går fra). */
  shoulder: Pt;
}

/** Skulderen med ankerpunktet i (x, floorY) og ryggvinkelen r. */
function shoulderAt(r: number, x: number, floorY: number, kind: WaveKind): Pt {
  return personPunkter('dra', PERSON_SIZE, stance(r, kind), { x, y: floorY }).skulder;
}

/** Ankerpunktet (midt mellom føttene) når hånda er i likevekt i x = 0 og eleven står med RYGG_REST. */
export function homeAnchor(kind: WaveKind, floorY: number): number {
  return X0 - PREF_REACH_M * PX_PER_M - (shoulderAt(RYGG_REST[kind], 0, floorY, kind).x - 0);
}

/**
 * Hvor eleven står og hvor mye den lener seg, så hånda (som holder enden) når `hand`. Når hånda går fram og tilbake,
 * strekker og bøyer eleven armen og lener overkroppen; føttene flyttes bare når det ikke er nok (de største
 * longitudinale bølgene). Når hånda bare går opp og ned (tauet), står eleven nesten stille og bruker armen.
 */
export function driverPose(hand: Pt, floorY: number, kind: WaveKind): DriverPose {
  const reach = REACH_USE * ARM_REACH_PX;
  const d = hand.x - X0;
  /** Hvor mye lenger fram hånda er enn der den skal være foran skulderen (px): positiv = skulderen må fram. */
  const excess = (r: number, x: number) => {
    const s = shoulderAt(r, x, floorY, kind);
    const dy = hand.y - s.y;
    const max = Math.sqrt(Math.max(0, reach * reach - dy * dy));
    const want = Math.min(max, Math.max(MIN_REACH_M * PX_PER_M, PREF_REACH_M * PX_PER_M + ARM_SHARE * d));
    return hand.x - s.x - want;
  };
  let x = homeAnchor(kind, floorY);
  let r: number;
  const lo = excess(RYGG_MIN, x);
  const hi = excess(RYGG_MAX, x);
  if (lo <= 0) {
    // Hånda er bak: eleven lener seg bakover og tar et lite skritt tilbake.
    r = RYGG_MIN;
    x += lo;
  } else if (hi >= 0) {
    r = RYGG_MAX;
    x += hi;
  } else {
    // excess avtar når eleven lener seg forover: halver intervallet.
    let a = RYGG_MIN;
    let b = RYGG_MAX;
    for (let i = 0; i < 22; i++) {
      const m = (a + b) / 2;
      if (excess(m, x) > 0) a = m;
      else b = m;
    }
    r = (a + b) / 2;
  }
  return { x, ledd: stance(r, kind), shoulder: shoulderAt(r, x, floorY, kind) };
}

/** Punktene til eleven med hendene festet (samme som Person tegner). */
export function driverPoints(p: DriverPose, floorY: number, hands: { hoyreHand?: Pt; venstreHand?: Pt }) {
  return personPunkter('dra', PERSON_SIZE, p.ledd, { x: p.x, y: floorY, fest: hands });
}

/* ---------- Fjæra ---------- */

/**
 * Posisjonene (m) til vindingene i fjæra ved tiden t: vinding i har likevektsplassen i · COIL_M og er forskjøvet
 * u(x, t) langs fjæra. Den første vindingen er i hånda.
 */
export function coilPositions(t: number, A: number, lambda: number, f: number, xEnd = X_END): number[] {
  const n = Math.ceil(xEnd / COIL_M);
  const out: number[] = [];
  for (let i = 0; i <= n; i++) {
    const xe = i * COIL_M;
    out.push(xe + waveDisplacement(xe, t, A, lambda, f));
  }
  return out;
}

/**
 * Midten av fortetningene (m) i [x0, x1]: der vindingene står tettest, dvs. der forskyvningen avtar fortest
 * (fasen f·t − x/λ er et heltall). Med u = A·sin(2π(ft − x/λ)) ligger de en kvart bølgelengde foran toppene i u.
 */
export function compressionCenters(t: number, lambda: number, f: number, x0: number, x1: number): number[] {
  return crestPositions(t, lambda, f, x0 - lambda / 4, x1 - lambda / 4).map((c) => c + lambda / 4);
}

/** Midten av fortynningene (m) i [x0, x1]: en halv bølgelengde fra fortetningene. */
export function rarefactionCenters(t: number, lambda: number, f: number, x0: number, x1: number): number[] {
  return compressionCenters(t + 0.5 / f, lambda, f, x0, x1);
}

/** Tettheten av vindinger i forhold til likevekt: 1 − ∂u/∂x (over 1 = fortetning). */
export function coilDensity(x: number, t: number, A: number, lambda: number, f: number): number {
  return 1 + ((2 * Math.PI * A) / lambda) * Math.cos(2 * Math.PI * (f * t - x / lambda));
}

/* ---------- Målene ---------- */

/**
 * Hvor λ-målet står (m): mellom to bølgedaler (eller to topper når ingen dal har plass, så målet ikke blinker under
 * avspillingen). For den longitudinale bølgen mellom to fortetninger.
 */
export function lambdaSpan(kind: WaveKind, t: number, lambda: number, f: number, xMin = 0, xMax = X_MAX): number | undefined {
  const fits = (p: number) => p >= xMin - 1e-9 && p + lambda <= xMax + 1e-9;
  if (kind === 'longitudinal') {
    const comp = compressionCenters(t, lambda, f, xMin, xMax);
    return comp.find(fits) ?? rarefactionCenters(t, lambda, f, xMin, xMax).find(fits);
  }
  const crests = crestPositions(t, lambda, f, xMin, xMax);
  const troughs = crestPositions(t + 0.5 / f, lambda, f, xMin, xMax);
  return troughs.find(fits) ?? crests.find(fits);
}

/**
 * Skalaen for fartspilene (px per m/s): den samme for bølgefarten v og for farten til det merkede punktet, så de kan
 * sammenlignes. Den lengste pila får plass (høyst ca. 300 px for v og 64 px for punktet, som svinger rundt et punkt).
 */
export function speedScale(v: number, uMax: number): number {
  const k = Math.min(300 / Math.max(v, 1e-9), 64 / Math.max(uMax, 1e-9));
  return Math.min(45, Math.max(10, k));
}
