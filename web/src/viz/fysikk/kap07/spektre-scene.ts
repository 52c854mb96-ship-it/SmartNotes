/**
 * Geometrien i scenen til «Spektre»: lyskilden på labbenken, spalten, prismet og skjermen, vinkelen hver farge
 * brytes med i prismet, hvor fargene treffer skjermen og navnelappene på benken. Rene funksjoner uten React
 * (testes i spektre-scene.test.ts). Fysikken i spektrene (linjer, fotonenergi) står i model.ts.
 */
import { dischargeRgb } from './bohr-scene';
import { placeLabels } from './labels';
import type { SpectrumElement } from './model';

export type SpectrumMode = 'kontinuerlig' | 'emisjon' | 'absorpsjon';

export interface Pt {
  x: number;
  y: number;
}

/** Skalaen i scenen: 500 px per meter. Alt utstyret har riktige mål etter den (på mobil blir små ting litt større). */
export const SCALE = 500;

/** Mål på utstyret i meter (vanlige mål i skolelaben). */
export const GEAR = {
  /** Midten av lyset (glødetråden eller kapillærrøret) over benken. */
  sourceH: 0.25,
  /** Vanlig glødelampe (E27), høyden på pæra med sokkel. */
  bulb: 0.11,
  /** Spenningskilden til spektralrøret: fot, søyle og selve glassrøret. */
  supplyW: 0.24,
  supplyH: 0.085,
  columnW: 0.055,
  columnH: 0.36,
  tube: 0.26,
  tubeInset: 0.035,
  /** Glasskolben med kald gass (radius). */
  flaskR: 0.032,
  /** Spalteplata (høyde) og prismet (sidekant i et likesidet prisme). */
  slitH: 0.12,
  prismSide: 0.1,
  /** Skjermen: høyde, bredde sett på skrå og høyden på foten. */
  screenH: 0.3,
  screenW: 0.14,
  screenFoot: 0.025,
} as const;

/** Hvor tingene står langs benken (x i figuren, 800 enheter bred). */
export const XPOS = { src: 105, cell: 196, slit: 265, prism: 362, screen: 680 } as const;

/**
 * Prismet. Lyset kommer inn nedenfra med 19° stigning, og gulgrønt lys (550 nm) går symmetrisk gjennom (minste
 * avbøyning): det brytes 38° til sammen, som i et vanlig glassprisme (n ≈ 1,51). Fiolett brytes mest og rødt minst.
 * Forskjellen mellom fiolett og rødt er forstørret: i et vanlig glassprisme er den bare ca. 1,5°, her 12°, ellers ville
 * linjene falle oppå hverandre på skjermen.
 */
export const PRISM = { inDeg: 19, midNm: 550, spreadDeg: 12 } as const;

/** Brytningsindeksen i glass følger Cauchy: n = A + B/λ². Normert: 0 ved 550 nm og 1 fra 700 til 400 nm. */
export function dispersion(nm: number): number {
  const inv = (l: number) => 1 / (l * l);
  return (inv(nm) - inv(PRISM.midNm)) / (inv(400) - inv(700));
}

/** Vinkelen (grader under vannrett) til strålen med bølgelengde λ (nm) på vei ut av prismet. */
export function exitAngleDeg(nm: number): number {
  return PRISM.inDeg + PRISM.spreadDeg * dispersion(nm);
}

/** Hele avbøyningen i prismet (grader): stigningen inn pluss fallet ut. */
export function deviationDeg(nm: number): number {
  return PRISM.inDeg + exitAngleDeg(nm);
}

/**
 * Fargen gassen i et spektralrør lyser med, slik øyet ser den. Hydrogen er summen av Balmer-linjene (samme farge som
 * i «Bohrs atommodell»); de andre er målte inntrykk: helium laksrosa, natrium gulorange, kvikksølv lyseblå.
 */
export function tubeRgb(el: SpectrumElement): [number, number, number] {
  if (el === 'hydrogen') return dischargeRgb();
  if (el === 'helium') return [255, 190, 168];
  if (el === 'natrium') return [255, 186, 64];
  return [168, 192, 255];
}

export interface BenchLabel {
  text: string;
  x: number;
  /** 0 = øverste rad (rett under benkekanten), 1 = raden under. */
  row: number;
}

export interface SpektreScene {
  S: number;
  /** Forstørrelse av små ting (1 på PC, ca. 1,5 på mobil). */
  k: number;
  width: number;
  height: number;
  /** Linja gjenstandene står på, og forkanten av benken (navnelappene står under den). */
  floorY: number;
  benchY: number;
  /** Midten av lyset i lyskilden. */
  src: Pt;
  /** Høyden på glødelampa (med sokkel) og toppen av lampejekken den står på. */
  bulbSize: number;
  jackTop: number;
  /** Spektralrøret: toppen og bunnen av glassrøret og toppen av søylen. */
  tubeTop: number;
  tubeBottom: number;
  columnTop: number;
  /** Glasskolben med kald gass (bare ved absorpsjon). */
  flask: Pt & { r: number };
  /** Midten av spalten og høyden på plata. */
  slit: Pt & { h: number };
  prism: {
    c: Pt;
    a: number;
    apex: Pt;
    baseL: Pt;
    baseR: Pt;
    /** Der lyset går inn i og ut av glasset (midt på sideflatene). */
    inPt: Pt;
    outPt: Pt;
  };
  screen: {
    /** Midtlinja på skjermen, der strålene treffer. */
    mid: number;
    /** Den fjerne (venstre) og den nære (høyre) kanten. */
    xL: number;
    xR: number;
    /** Øverst og nederst på den nære kanten, og foten under. */
    top: number;
    bottom: number;
    /** Perspektiv: horisonten og hvor mye mindre den fjerne kanten er. */
    horizon: number;
    far: number;
  };
  /** Vinduet med persiennene nede, høyt oppe på veggen til høyre (over strålene). */
  window: { x1: number; x2: number; y1: number; y2: number };
  labels: BenchLabel[];
  /** Skriftstørrelsen på navnelappene. */
  labelSize: number;
  labelRowH: number;
}

/** Omtrentlig tekstbredde i em for navnelappene. */
export function labelWidthEm(s: string): number {
  let w = 0;
  for (const ch of s) w += ch === ' ' ? 0.28 : /[A-ZÆØÅ]/.test(ch) ? 0.72 : /[ijlrt]/.test(ch) ? 0.4 : 0.6;
  return w;
}

const R3 = Math.sqrt(3);
const rad = (d: number) => (d * Math.PI) / 180;

/** Navnene på utstyret i hver modus (lyskilden er viktigst, spalten får plass bare når det er rom). */
export function benchLabelItems(mode: SpectrumMode): { text: string; x: number; priority: number }[] {
  const items: { text: string; x: number; priority: number }[] = [
    { text: mode === 'emisjon' ? 'Spektralrør' : 'Glødelampe', x: XPOS.src, priority: 5 },
    { text: 'Spalte', x: XPOS.slit, priority: 1 },
    { text: 'Prisme', x: XPOS.prism, priority: 3 },
    { text: 'Skjerm', x: XPOS.screen, priority: 3 },
  ];
  if (mode === 'absorpsjon') items.push({ text: 'Kald gass', x: XPOS.cell, priority: 4 });
  return items;
}

const MODES: SpectrumMode[] = ['kontinuerlig', 'emisjon', 'absorpsjon'];

/**
 * Navnelappene på forkanten av benken i én eller to rader, uten overlapp. Lyskilden og gassen kommer først; spalten
 * står bare i øverste rad (er det ikke plass der, utelates den).
 */
export function placeBenchLabels(mode: SpectrumMode, f: number, width = 800, lowInRow1 = false): BenchLabel[] {
  const size = 17 * f * 0.8;
  const items = benchLabelItems(mode).map((it) => {
    const w = labelWidthEm(it.text) * size;
    return { ...it, x: Math.min(width - 10 - w / 2, Math.max(10 + w / 2, it.x)), width: w };
  });
  const rows = placeLabels(items, 2, 10 * f);
  return items
    .map((it, i) => ({ text: it.text, x: it.x, row: rows[i] ?? -1, priority: it.priority }))
    .filter((l) => l.row === 0 || (l.row === 1 && (lowInRow1 || l.priority >= 2)))
    .map(({ text, x, row }) => ({ text, x, row }));
}

/**
 * Hele geometrien for tekstskalaen `f` (1 på PC, ca. 1,8 på mobil). Høyden på viewBox-en følger av den, så den kan
 * regnes ut før figuren tegnes.
 */
export function spektreScene(f: number, mode: SpectrumMode, width = 800): SpektreScene {
  const S = SCALE;
  const k = Math.max(1, 0.85 * f);
  // Først med benken i y = 0 (oppover er negativt), så flyttes alt ned.
  const srcY = -GEAR.sourceH * S;
  const a = GEAR.prismSide * S * Math.min(k, 1.4);
  const inX = XPOS.prism - a / 4;
  const inY = srcY - (inX - XPOS.src) * Math.tan(rad(PRISM.inDeg));
  const cy = inY + a / (4 * R3);
  const apexY = cy - a / R3;
  const columnTop = -(GEAR.supplyH + GEAR.columnH) * S;
  const topPad = 14 + 4 * k;
  const floorY = topPad - Math.min(apexY, columnTop);
  const benchY = floorY + 6;

  const labelSize = 17 * f * 0.8;
  // Høyden er den samme i alle modusene, så figuren ikke hopper når eleven bytter. Trengs to rader i én modus
  // (mobil), får spalten plass i den nederste raden i de andre.
  const usedRows = Math.max(...MODES.map((m) => placeBenchLabels(m, f, width).reduce((r, l) => Math.max(r, l.row + 1), 1)));
  const labels = placeBenchLabels(mode, f, width, usedRows > 1);
  const labelRowH = labelSize * 1.3;
  const height = Math.round(benchY + 10 + usedRows * labelRowH + 6 + 4 * f);

  const y = (v: number) => v + floorY;
  const c = { x: XPOS.prism, y: y(cy) };
  const prism = {
    c,
    a,
    apex: { x: c.x, y: y(apexY) },
    baseL: { x: c.x - a / 2, y: c.y + a / (2 * R3) },
    baseR: { x: c.x + a / 2, y: c.y + a / (2 * R3) },
    inPt: { x: inX, y: y(inY) },
    outPt: { x: c.x + a / 4, y: y(inY) },
  };
  const tubeTop = y(columnTop + GEAR.tubeInset * S);
  // Glødelampa: midten av glasset er 84/108 av høyden over bunnen av fatningen (Lyspaere i scene-kit-et).
  const bulbSize = GEAR.bulb * S * Math.min(k, 1.3);
  const lineY = (x: number) => y(srcY) - (x - XPOS.src) * Math.tan(rad(PRISM.inDeg));
  const top = floorY - (GEAR.screenFoot + GEAR.screenH) * S;
  // Vinduet slutter godt over den øverste (røde) strålen.
  const winX1 = 560;
  const winX2 = 770;
  const redAt = prism.outPt.y + (winX1 - prism.outPt.x) * Math.tan(rad(exitAngleDeg(750)));
  const win = { x1: winX1, x2: winX2, y1: 12, y2: Math.max(40, Math.min(redAt - 14, top - 14)) };
  return {
    S,
    k,
    width,
    height,
    floorY,
    benchY,
    src: { x: XPOS.src, y: y(srcY) },
    bulbSize,
    jackTop: y(srcY) + (84 / 108) * bulbSize,
    tubeTop,
    tubeBottom: tubeTop + GEAR.tube * S,
    columnTop: y(columnTop),
    flask: { x: XPOS.cell, y: lineY(XPOS.cell), r: GEAR.flaskR * S * Math.min(k, 1.3) },
    slit: { x: XPOS.slit, y: lineY(XPOS.slit), h: GEAR.slitH * S },
    prism,
    screen: {
      mid: XPOS.screen,
      xL: XPOS.screen - (GEAR.screenW * S) / 2,
      xR: XPOS.screen + (GEAR.screenW * S) / 2,
      top,
      bottom: floorY - GEAR.screenFoot * S,
      horizon: floorY - 0.2 * S,
      far: 0.93,
    },
    window: win,
    labels,
    labelSize,
    labelRowH,
  };
}

/** Høyden der strålen med bølgelengde λ treffer midtlinja på skjermen. */
export function hitY(g: SpektreScene, nm: number): number {
  const o = g.prism.outPt;
  return o.y + (g.screen.mid - o.x) * Math.tan(rad(exitAngleDeg(nm)));
}

/**
 * Et punkt på skjermen sett på skrå: `t` går fra den fjerne kanten (0) til den nære (1), og høyden følger perspektivet
 * (streken fra spalten blir litt kortere og høyere mot den fjerne kanten). Ved t = 0,5 er punktet der strålen treffer.
 */
export function screenPoint(g: SpektreScene, nm: number, t: number): Pt {
  return screenAt(g, hitY(g, nm), t);
}

/** Som screenPoint, men for en høyde `yMid` på midtlinja. */
export function screenAt(g: SpektreScene, yMid: number, t: number): Pt {
  const { xL, xR, horizon, far } = g.screen;
  const s = (u: number) => far + (1 - far) * u;
  return { x: xL + (xR - xL) * t, y: horizon + ((yMid - horizon) * s(t)) / s(0.5) };
}

/** Hjørnene på skjermflaten: øverst og nederst på den fjerne (venstre) og den nære (høyre) kanten. */
export function screenCorners(g: SpektreScene): [Pt, Pt, Pt, Pt] {
  const { xL, xR, top, bottom, horizon, far } = g.screen;
  const fy = (v: number) => horizon + (v - horizon) * far;
  return [
    { x: xL, y: fy(top) },
    { x: xR, y: top },
    { x: xR, y: bottom },
    { x: xL, y: fy(bottom) },
  ];
}
