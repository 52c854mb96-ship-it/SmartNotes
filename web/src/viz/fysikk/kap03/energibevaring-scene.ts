/**
 * Utformingen av scenen i «Bevaring av mekanisk energi» (ren geometri uten React, så den kan testes):
 * skalaen px/m, hvor banen og energistolpene står, og hvor skateren eller akebrettet er på banen.
 *
 * På PC står energistolpene til høyre for banen med samme høydeskala som banen: E_p-stolpen er like høy som brettet
 * står over nullnivået, og E₀ ligger på linja for h₀. På mobil fyller banen hele bredden, og stolpene står under.
 *
 * Halfpipen får plass i bildet. Akebakken er ca. 40 m lang (slake sider og en bred kul, som i en ekte akebakke), så der
 * viser scenen et utsnitt som følger akebrettet, som et kamera (`cameraX`). Hele bakken ses i energigrafen under.
 */
import { G_EARTH } from '../../kit/format';
import { TRACK_TOP, makeTrack, type Track, type TrackKind } from './model';

export const SCENE_W = 800;

/**
 * Hvor mye av verden (m) som tegnes på hver side av banen: plattformene på halfpipen og toppene i akebakken.
 */
export const WORLD_MARGIN: Record<TrackKind, { left: number; right: number }> = {
  rampe: { left: 1.6, right: 1.6 },
  bakke: { left: 2, right: 2 },
};

/**
 * Bredden på utsnittet (m). Halfpipen får plass i sin helhet (på mobil uten det ytterste av plattformene, så personene
 * blir større). I akebakken følger utsnittet akebrettet.
 */
export const VIEW_M: Record<'wide' | 'narrow', Record<TrackKind, number>> = {
  wide: { rampe: 15.2, bakke: 18.5 },
  narrow: { rampe: 13.4, bakke: 14 },
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
  /** Delen av verden som tegnes (m), og bredden i figurens enheter. */
  xLeft: number;
  xRight: number;
  worldW: number;
  /** Bredden på utsnittet av banen i figurens enheter (fra x = 0 i figuren). */
  viewW: number;
  /** Høyre kant av scenen som er fri for tekst (stolpekortet begynner der på PC). */
  freeRight: number;
  /** Fra vannrett posisjon (m) til figuren. I en `viewLayout` er kameraet trukket fra. */
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
  const track = makeTrack(kind);
  // På PC får banen 580 av 800 enheter, og stolpene resten. På mobil fyller banen hele bredden.
  const trackW = narrow ? W : 580;
  const view = VIEW_M[narrow ? 'narrow' : 'wide'][kind];
  const ppm = trackW / view;
  // Halfpipen: utsnittet står midt på rampa. Akebakken: hele bakken med toppene, og kameraet følger akebrettet.
  const mid = (track.xMin + track.xMax) / 2;
  const xLeft = kind === 'rampe' ? mid - view / 2 : track.xMin - WORLD_MARGIN[kind].left;
  const xRight = kind === 'rampe' ? mid + view / 2 : track.xMax + WORLD_MARGIN[kind].right;
  const worldW = (xRight - xLeft) * ppm;
  // Over den høyeste delen av banen: rekkverket på plattformen (1 m) og litt himmel.
  const yTop = Math.round(1.3 * ppm + 22 * f);
  const yZero = yTop + TRACK_TOP * ppm;
  const X = (x: number) => (x - xLeft) * ppm;
  const Y = (h: number) => yZero - h * ppm;
  const groundY = kind === 'rampe' ? Y(-RAMP_BASE) : Y(0);
  // Under nullnivået: etiketten «nullnivå» og (på PC) navnene under stolpene. I akebakken er tyngden G 2,6 m lang og
  // går ca. 2,2 m ned i snøen i dalen, så der er det mer snø nederst.
  const sceneH = Math.round(Math.max(groundY + 26 * f, yZero + 40 * f, kind === 'bakke' ? Y(-2.45) : 0) + 6);
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
      worldW,
      viewW: trackW,
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
    worldW,
    viewW: trackW,
    freeRight: W - 6,
    X,
    Y,
    groundY,
    horizon,
    bars: { x0: 40, x1: W - 40, base, k: barMax / TRACK_TOP, card, beside: false },
  };
}

/* ---------- Kameraet i akebakken ---------- */

/**
 * Kameraet ser litt framover: personen står mellom 30 % og 70 % av utsnittet, lenger bak jo fortere det går. Hvilken
 * vei «framover» er, regnes fra farten om et lite øyeblikk (v − g sin θ · τ), så kameraet glir jevnt rundt i
 * vendepunktene og ser nedover bakken når akebrettet står i ro i starten.
 */
export const CAMERA = { lead: 0.2, v0: 2.5, tau: 0.6 };

/** Hvor langt kameraet er flyttet (figurens enheter) når personen er i x med farten v, der banen har helningen `slope`. */
export function cameraX(L: Pick<SceneLayout, 'X' | 'worldW' | 'viewW'>, x: number, v: number, slope: number, g = G_EARTH): number {
  const max = L.worldW - L.viewW;
  if (!(max > 0.5)) return 0;
  const sin = slope / Math.sqrt(1 + slope * slope);
  const ahead = Math.tanh((v - g * sin * CAMERA.tau) / CAMERA.v0);
  const at = (0.5 - CAMERA.lead * (Number.isFinite(ahead) ? ahead : 0)) * L.viewW;
  return Math.min(max, Math.max(0, L.X(x) - at));
}

/** Utformingen sett gjennom kameraet: `X` gir figurkoordinaten i utsnittet. */
export function viewLayout(L: SceneLayout, cam: number): SceneLayout {
  if (!cam) return L;
  const X = (x: number) => L.X(x) - cam;
  return { ...L, X };
}

export interface ShownState {
  /** Høyden med to desimaler (m), som i utregningen. */
  h: number;
  /** E_p = mg · h av høyden som vises (hele joule), eller E når akebrettet står i ro med friksjon (se `fromEnergy`). */
  Ep: number;
  /** Strekningen langs banen med to desimaler (m) og varmen R · s av den med én desimal (J). 0 uten friksjon. */
  s: number;
  heat: number;
  /** E: E₀ uten friksjon (hele joule), E₀ + W_R med én desimal med friksjon. */
  E: number;
  /** E_k = E − E_p (samme presisjon som E), aldri negativ. */
  Ek: number;
  /**
   * I ro med friksjon (stoppet eller i et vendepunkt) står legemet i en vilkårlig høyde. Da er E_k = 0 og E_p = E, og
   * utregningen viser h = E_p/(mg) i stedet for E_p = mgh, så avrundingen av h ikke gir E_p ≠ E.
   */
  fromEnergy: boolean;
  /** Hele joule til tallene under figuren og over stolpene: E_p + E_k = E også her. */
  Epint: number;
  Eint: number;
  Ekint: number;
  /** v = √(2E_k/m) (m/s). */
  v: number;
}

/**
 * Tallene som vises, regnet fra de avrundede tallene som står i utregningen, så hver linje går opp og forklaringen
 * bruker de samme tallene: h med to desimaler og E_p = mgh av den; uten friksjon E = E₀; med friksjon W_R = −R · s
 * (s med to desimaler) og E = E₀ + W_R med én desimal; så E_k = E − E_p og v = √(2E_k/m). `still`: legemet står i ro.
 */
export function shownState(
  { h, d, m, E0, mu, still = false }: { h: number; d: number; m: number; E0: number; mu: number; still?: boolean },
  g = G_EARTH,
): ShownState {
  const r = (v: number, n: number) => Math.round(v * 10 ** n) / 10 ** n;
  const s = mu > 0 ? r(d, 2) : 0;
  const heat = mu > 0 ? r(mu * m * g * s, 1) : 0;
  const E = mu > 0 ? r(r(E0, 1) - heat, 1) : Math.round(E0);
  const Eint = Math.round(E);
  const hs = r(h, 2);
  const Ep = Math.round(m * g * hs);
  const raw = r(E - Ep, 1);
  // I ro, eller så nær et vendepunkt at avrundingen av h ville gitt E_p > E: E_k = 0, og høyden regnes av energien
  if (mu > 0 && (still || raw < 0)) {
    return { h: m > 0 ? r(E / (m * g), 2) : 0, Ep: E, s, heat, E, Ek: 0, fromEnergy: true, Epint: Eint, Eint, Ekint: 0, v: 0 };
  }
  const Ek = Math.max(0, raw);
  return { h: hs, Ep, s, heat, E, Ek, fromEnergy: false, Epint: Ep, Eint, Ekint: Math.max(0, Eint - Ep), v: m > 0 ? Math.sqrt((2 * Ek) / m) : 0 };
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
 * Hvor mye høyere fartspila går (m ut fra banen) når kreftene vises: da går G∥ langs banen fra tyngdepunktet, og
 * de to pilene skal ikke ligge oppå hverandre.
 */
export const SPEED_ARROW_LIFT = 0.55;

/**
 * Fartspila langs banen: fra et punkt i hoftehøyde litt foran kroppen og v · SPEED_ARROW_M meter i fartsretningen.
 * `v` er farten med fortegn (positiv mot høyre). `lift` (m) flytter pila lenger ut fra banen.
 */
export function speedArrow(fr: RiderFrame, kind: TrackKind, ppm: number, v: number, lift = 0): { x1: number; y1: number; x2: number; y2: number } {
  const sv = v >= 0 ? 1 : -1;
  const com = framePoint(fr, 0, (COM_HEIGHT[kind] + lift) * ppm);
  const ahead = ARROW_AHEAD[kind] * ppm;
  const x1 = com.x + fr.tx * sv * ahead;
  const y1 = com.y + fr.ty * sv * ahead;
  const len = Math.abs(v) * SPEED_ARROW_M * ppm;
  return { x1, y1, x2: x1 + fr.tx * sv * len, y2: y1 + fr.ty * sv * len };
}

/* ---------- Kreftene (bryteren «Vis krefter») ---------- */

/**
 * Kraftskalaen: tyngden er alltid like lang i samme skala som banen (1,8 m i halfpipen, 2,6 m i akebakken, der banen er
 * slakere), så G∥ synes også for lette personer. Skalaen (px/N) avhenger dermed av massen, men er den samme for alle
 * kreftene i figuren; størrelsen på G står på pila.
 */
export const G_ARROW_M: Record<TrackKind, number> = { rampe: 1.8, bakke: 2.6 };
/** Friksjonspila begynner ved bakenden av brettet (m bak midten). */
const R_BACK = 0.4;
/**
 * G∥ tegnes bare når pila er lengre enn en pilspiss (figurens enheter). Ellers er banen nesten vannrett, og forklaringen
 * sier at G∥ ≈ 0 der.
 */
export const GPAR_MIN = 16;

/** Om pila for G∥ er lang nok til å tegnes i en bane med helningen `slope` (G er G_ARROW_M lang). */
export function gparVisible(kind: TrackKind, ppm: number, slope: number): boolean {
  return (G_ARROW_M[kind] * ppm * Math.abs(slope)) / Math.sqrt(1 + slope * slope) >= GPAR_MIN;
}

export interface Seg {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface SceneForces {
  /** Tyngdepunktet, der G og komponenten G∥ har angrepspunkt. */
  com: { x: number; y: number };
  /** Tyngden G = mg, rett ned. */
  G: Seg;
  /** Komponenten av G langs banen, G∥ = G · sin θ, ned bakken (null når pila blir kortere enn GPAR_MIN). */
  Gpar: Seg | null;
  /** G∥ med fortegn langs banen mot høyre (N): negativ når banen stiger mot høyre. */
  GparN: number;
  /** Friksjon og luftmotstand R mot farten, med angrepspunkt ved brettet (null i ro eller uten friksjon). */
  R: Seg | null;
  /** Figurenheter per newton. */
  k: number;
}

/**
 * Pilene for tyngden, komponenten av tyngden langs banen og friksjonen, med én skala px/N for alle kreftene.
 * Normalkraften er ikke med: den står vinkelrett på farten og gjør ikke arbeid, og størrelsen endrer seg når banen
 * krummer. `v` er farten med fortegn (positiv mot høyre), `R` friksjonskraften (0 uten friksjon).
 */
export function sceneForces(fr: RiderFrame, kind: TrackKind, ppm: number, m: number, g: number, v: number, R: number): SceneForces {
  const G = Math.max(0, m * g);
  const k = G > 0 ? (G_ARROW_M[kind] * ppm) / G : 0;
  const com = framePoint(fr, 0, COM_HEIGHT[kind] * ppm);
  // sin θ for banen mot høyre: tangenten (tx, ty) har ty < 0 når banen stiger (y ned i figuren)
  const sin = -fr.ty;
  const GparN = -G * sin;
  const Gpar = Math.abs(GparN) * k >= GPAR_MIN ? { x1: com.x, y1: com.y, x2: com.x + fr.tx * GparN * k, y2: com.y + fr.ty * GparN * k } : null;
  // R fra bakenden av brettet (0,4 m bak midten, i hjulhøyde), bakover langs banen
  const sv = Math.sign(v);
  const back = framePoint(fr, -sv * R_BACK * ppm, 0.06 * ppm);
  const Rseg = R > 0 && sv !== 0 ? { x1: back.x, y1: back.y, x2: back.x - fr.tx * sv * R * k, y2: back.y - fr.ty * sv * R * k } : null;
  return { com, G: { x1: com.x, y1: com.y, x2: com.x, y2: com.y + G * k }, Gpar, GparN, R: Rseg, k };
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

/**
 * Bredden på tegnene i em, omtrent som en fet sans-serif (DejaVu Sans Bold, som er bred; systemskriftene på mobil og
 * nettbrett er smalere), så etikettene får nok plass.
 */
function charWidth(c: string): number {
  if (/[0-9]/.test(c)) return 0.7;
  if (c === ' ' || c === '\u00a0') return 0.35;
  if (/[.,:;'·|!]/.test(c)) return 0.38;
  if (/[=+−<>≈]/.test(c)) return 0.84;
  if (/[ijlft()/\-]/.test(c)) return 0.42;
  if (/[mwMW]/.test(c)) return 1.0;
  if (/[₀-₉⁰-⁹∥⊥]/.test(c)) return 0.48;
  if (/[A-ZÆØÅ]/.test(c)) return 0.77;
  return 0.66;
}

/** Omtrentlig bredde på en etikett i figurens enheter (Txt er 17 · størrelse · tekstskala høy). */
export function textWidth(text: string, size: number, f: number): number {
  let em = 0;
  for (const c of text) em += charWidth(c);
  return em * 17 * size * f;
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

/**
 * Om en ForceArrow fra (x1, y1) til (x2, y2) med tykkelsen `width` treffer boksen, med samme mål som i scene-kit-et:
 * skaftet er w = width · ss bredt (0,75 · w stiplet), spissen er hl lang og 2 · hh bred, og konturen er 2 · ss utenfor.
 * `gap` er luft i tillegg.
 */
export function arrowHitsBox(seg: Seg, box: Box, width: number, ss: number, { dashed = false, gap = 2 } = {}): boolean {
  const len = Math.hypot(seg.x2 - seg.x1, seg.y2 - seg.y1);
  if (!(len > 0)) return false;
  const w = (dashed ? width * 0.75 : width) * ss;
  const hl = Math.min(len * 0.62, Math.max(14 * ss, w * 2.5));
  const hh = Math.max(7 * ss, w * 1.45);
  const ux = (seg.x2 - seg.x1) / len;
  const uy = (seg.y2 - seg.y1) / len;
  const base = { x: seg.x2 - ux * hl, y: seg.y2 - uy * hl };
  const edge = 2 * ss + gap;
  if (segmentHitsBox({ x: seg.x1, y: seg.y1 }, base, box, w / 2 + edge)) return true;
  // Spissen er en trekant: halv bredde hh ved roten og 0 i spissen
  const n = Math.max(2, Math.ceil(hl / 2));
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const x = base.x + (seg.x2 - base.x) * t;
    const y = base.y + (seg.y2 - base.y) * t;
    const pad = hh * (1 - t) + edge;
    if (x > box.x0 - pad && x < box.x1 + pad && y > box.y0 - pad && y < box.y1 + pad) return true;
  }
  return false;
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
