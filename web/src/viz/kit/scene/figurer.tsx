/**
 * Scene-kit, familien «figurer»: personer i lærebokstil sett fra siden, og fallskjerm.
 *
 *   <Person x={300} y={bakke} size={120} pose="skyve" jakke="gronn" />
 *   const p = personPunkter('dra', 120, undefined, { x: 300, y: bakke });   // hendene, føttene, hofta …
 *   <Fallskjerm x={sele.x} y={sele.y} size={360} aapen={0.8} />
 *
 * Personen er bygd på et skjelett med leddvinkler (`Leddvinkler`, i figurer-skjelett.ts), så positurene i `POSER`
 * bare er tall, og nye positurer er lette å lage: `ledd={{ hoyreAlbue: 90 }}`. Personen ser mot høyre (`flip` mot
 * venstre). «hoyre…» er armen og beinet nærmest betrakteren (tegnes foran kroppen), «venstre…» de bakerste (litt
 * mørkere). Hender og føtter kan festes til punkter i figuren med `fest` (tau, styre, pedaler, en kasse), og
 * skjelettet regner ut albuer og knær selv. Føtter som står på bakken, står alltid begge på bakkelinja.
 *
 * Alle mål regnes internt i en figur som er 100 enheter høy (fra sålene til hodet) og skaleres til `size`.
 */
import './figurer.css';
import { ContactShadow, LinearGradient, RadialGradient, SCENE_DIM, shade, tint, useStrokeScale, useSvgId, type GradientStop, type SceneObjectProps } from './core';
import {
  EYE_POS,
  SEATED,
  SKI_BACK,
  SKI_DROP,
  SKI_FRONT,
  SOLE,
  UPPER_R,
  add,
  armRaised,
  clamp,
  dir,
  num,
  r2,
  solve,
  type Anker,
  type Arm,
  type Leddvinkler,
  type Leg,
  type PersonFeste,
  type PersonPlass,
  type PersonPose,
  type Pt,
  type Side,
} from './figurer-skjelett';
import { PAINTS, SCENE, paint, type PaintName } from './palette';

export { POSER, personPunkter } from './figurer-skjelett';
export type { Leddvinkler, PersonPose } from './figurer-skjelett';

/* ================================================================================================
 * Tegning
 * ============================================================================================== */

const fmt = (p: Pt) => `${r2(p.x)},${r2(p.y)}`;

/**
 * Kapsel (avrundet lem) fra a (radius ra) til b (radius rb), alltid mot klokka, så flere kapsler i samme sti
 * smelter sammen til én form (nonzero).
 */
function capsule(a: Pt, ra: number, b: Pt, rb: number): string {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const L = Math.hypot(dx, dy);
  if (!(L > Math.abs(ra - rb) + 1e-3)) {
    const c = ra >= rb ? a : b;
    const r = Math.max(ra, rb);
    return `M${fmt({ x: c.x, y: c.y + r })}A${r2(r)},${r2(r)} 0 0 0 ${fmt({ x: c.x + r, y: c.y })}A${r2(r)},${r2(r)} 0 0 0 ${fmt({
      x: c.x,
      y: c.y - r,
    })}A${r2(r)},${r2(r)} 0 0 0 ${fmt({ x: c.x - r, y: c.y })}A${r2(r)},${r2(r)} 0 0 0 ${fmt({ x: c.x, y: c.y + r })}Z`;
  }
  const ux = dx / L;
  const uy = dy / L;
  const nx = -uy;
  const ny = ux;
  const s = (ra - rb) / L;
  const c = Math.sqrt(1 - s * s);
  const u1 = { x: nx * c - ux * s, y: ny * c - uy * s };
  const u2 = { x: -nx * c - ux * s, y: -ny * c - uy * s };
  const p1 = add(a, u1, ra);
  const p2 = add(b, u1, rb);
  const p3 = add(b, u2, rb);
  const p4 = add(a, u2, ra);
  const tb = add(b, { x: ux, y: uy }, rb);
  const ta = add(a, { x: ux, y: uy }, -ra);
  const R = (r: number) => `${r2(r)},${r2(r)}`;
  return `M${fmt(p1)}L${fmt(p2)}A${R(rb)} 0 0 0 ${fmt(tb)}A${R(rb)} 0 0 0 ${fmt(p3)}L${fmt(p4)}A${R(ra)} 0 0 0 ${fmt(ta)}A${R(ra)} 0 0 0 ${fmt(p1)}Z`;
}

/** Glatt lukket form der punktene er kontrollpunkter (et punkt to ganger gir et skarpt hjørne). */
function smooth(pts: Pt[]): string {
  const n = pts.length;
  const mid = (a: Pt, b: Pt) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
  let d = `M${fmt(mid(pts[n - 1]!, pts[0]!))}`;
  for (let i = 0; i < n; i++) d += `Q${fmt(pts[i]!)} ${fmt(mid(pts[i]!, pts[(i + 1) % n]!))}`;
  return `${d}Z`;
}

function shape(f: (a: number, b: number) => Pt, pts: [number, number][]): string {
  return smooth(pts.map(([a, b]) => f(a, b)));
}

/** Skoen i fotens koordinater: sålen ligger på b = SOLE. */
function shoePaths(f: (a: number, b: number) => Pt, boot: boolean, flip: boolean): { body: string; sole: string; shine: string } {
  const P = (a: number, b: number) => fmt(f(a, b));
  const top = boot ? -3.2 : -2.6;
  const body =
    `M${P(-3.8, top + 1.2)}Q${P(-5.4, 0.6)} ${P(-4.8, 2.8)}Q${P(-4.6, SOLE)} ${P(-2.8, SOLE)}L${P(9.4, SOLE)}` +
    `Q${P(11.9, SOLE)} ${P(11.6, 2.4)}Q${P(11.2, 0.9)} ${P(8.8, 0.2)}Q${P(5.8, -0.5)} ${P(3.4, top + 0.6)}Q${P(1.6, top - 0.4)} ${P(-0.6, top)}Z`;
  const sole = `M${P(-4.7, 3)}Q${P(-4.6, SOLE)} ${P(-2.8, SOLE)}L${P(9.4, SOLE)}Q${P(11.8, SOLE)} ${P(11.7, 3)}Z`;
  // Glansen på oversiden av tåa, mot lyset: nær vristen når personen ser mot høyre, ut mot tåspissen når speilvendt.
  const shine = flip ? `M${P(6.6, 0.1)}Q${P(9.2, 0.5)} ${P(10.6, 1.7)}` : `M${P(4.2, -0.4)}Q${P(6.6, -0.1)} ${P(8.6, 0.6)}`;
  return { body, sole, shine };
}

type Hudtone = 'lys' | 'middels' | 'mork';
type Harfarge = 'blond' | 'brun' | 'svart' | 'rod' | 'graa';
const HUD: Record<Hudtone, string> = {
  lys: 'var(--sc-figurer-hud-lys)',
  middels: 'var(--sc-figurer-hud-middels)',
  mork: 'var(--sc-figurer-hud-mork)',
};
const HAR: Record<Harfarge, string> = {
  blond: 'var(--sc-figurer-har-blond)',
  brun: 'var(--sc-figurer-har-brun)',
  svart: 'var(--sc-figurer-har-svart)',
  rod: 'var(--sc-figurer-har-rod)',
  graa: 'var(--sc-figurer-har-graa)',
};
const EYE = 'var(--sc-figurer-oye)';
const LINE = 'var(--sc-figurer-line)';

function clothStops(c: string): GradientStop[] {
  return [
    [0, tint(c, 0.2)],
    [0.5, c],
    [1, shade(c, 0.22)],
  ];
}

export interface PersonProps extends SceneObjectProps {
  /**
   * Ankerpunktet: midt mellom føttene, på bakken (for 'gaa' og 'loepe' rett under hofta, så figuren står stille
   * når `fase` endres). For 'sitte' og 'sykle': under setet (sittebeina). `rotate` dreier om dette punktet.
   */
  x: number;
  y: number;
  /** Høyden stående (fra sålene til toppen av hodet) i figurens enheter, også når personen sitter eller bøyer seg. Standard 120. */
  size?: number;
  /** Positur (standard 'staa'). Se PersonPose. */
  pose?: PersonPose;
  /** Jakkefarge (navn fra PAINTS eller en CSS-farge, f.eks. SCENE.denim). Standard 'blaa'. */
  jakke?: PaintName | string;
  /** Buksefarge. Standard SCENE.denim (olabukse). */
  bukse?: PaintName | string;
  /** Hudfarge: 'lys', 'middels', 'mork' eller en CSS-farge. Standard SCENE.skin. */
  hud?: Hudtone | string;
  /** Hårfarge: 'blond', 'brun', 'svart', 'rod', 'graa' eller en CSS-farge. Standard SCENE.hair. */
  har?: Harfarge | string;
  /** Frisyre: 'kort' (standard), 'lang' (til skuldrene) eller 'hestehale'. */
  frisyre?: 'kort' | 'lang' | 'hestehale';
  /** Strikkelue i denne fargen (vinter, ski). */
  lue?: PaintName | string;
  /** Hjelm i denne fargen (sykkel, ski). Går foran `lue`. */
  hjelm?: PaintName | string;
  /** Sekk på ryggen i denne fargen (ryggsekk, eller fallskjermsekken til en hopper). */
  sekk?: PaintName | string;
  /** Skofarge (standard 'svart'). */
  sko?: PaintName | string;
  /** Skifarge for 'ski' (standard 'rod'). `false` tegner personen uten ski og staver. */
  ski?: PaintName | string | false;
  /** Overstyr enkeltledd i posituren, f.eks. `{ rygg: -35 }` eller `{ hoyreSkulder: 90, hoyreAlbue: 0 }`. */
  ledd?: Partial<Leddvinkler>;
  /**
   * Fase 0–1 i en syklus: to skritt for 'gaa' og 'loepe' (0 = den nære hælen treffer bakken), én omdreining av kranken
   * for 'sykle' (0 = den nære pedalen rett fram, 0,25 = nederst). Foten som står i bakken, glir ikke når personen
   * flyttes like langt som én syklus per fase, i figurens enheter:
   * gange `fase = (strekning / (0.8 * size)) % 1` (ca. 1,4 m for en person på 1,75 m), løp
   * `fase = (strekning / (1.5 * size)) % 1` (ca. 2,6 m, med svev mellom stegene). `strekning` er hvor langt
   * ankerpunktet (x) er flyttet. Uten `fase` står 'gaa' og 'loepe' i et fast skritt.
   */
  fase?: number;
  /** Vinkelen på tauet for 'dra' i grader: 0 = vannrett fram, positiv = skrått nedover mot det som dras. */
  tauvinkel?: number;
  /**
   * Fest hender (alle positurer) og føtter ('sitte', 'sykle') til punkter i figuren, f.eks. styret og pedalene fra
   * sykkelPunkter eller kanten på en kasse. Hånda griper midt i punktet (håndflata for 'skyve'), foten har punktet
   * under fotballen ('sykle') eller midt under sålen ('sitte'). Albuer og knær regnes ut selv; når punktet er for
   * langt unna, strekkes armen eller beinet mot det. Ledd du gir i `ledd`, går foran.
   */
  fest?: PersonFeste;
  /** Bakken heller (grader, positiv = oppover i retningen personen ser): personen står loddrett med flate såler langs bakken. */
  skraaning?: number;
  /** Ankerpunktet: 'bakke' (standard, se x og y) eller 'tyngdepunkt' (fritt fall: dreier om tyngdepunktet). */
  anker?: Anker;
  /** Myk skygge på bakken (standard: når personen står på bakken). */
  skygge?: boolean;
}

/**
 * Person i lærebokstil sett fra siden: hode med hår og ansiktsprofil, jakke, bukse, sko og avrundede lemmer med ledd.
 * Ankerpunktet (x, y) er midt mellom føttene på bakken; for 'gaa' og 'loepe' rett under hofta (så figuren står
 * stille når `fase` endres); for 'sitte' og 'sykle' under setet (sittebeina). `size` er høyden stående i figurens
 * enheter. Skjelettet styres av positurene i POSER, som kan overstyres med `ledd`. Føtter som står på bakken, står
 * alltid begge på bakkelinja (også med `skraaning`): knærne bøyes eller rettes av seg selv.
 *
 *   <Person x={260} y={300} size={130} pose="dra" tauvinkel={8} jakke="rod" />
 *   <Person x={x0 + s} y={bakke} size={120} pose="gaa" fase={(s / (0.8 * 120)) % 1} />   // går s figurenheter uten å gli
 *   <Person x={x} y={y} pose="falle" anker="tyngdepunkt" rotate={90} />                  // fallskjermhopper med magen ned
 *
 *   // På sykkelen fra kjoretoy (v = pedalvinkelen i grader):
 *   const p = sykkelPunkter(180, { x, y });
 *   <Person x={p.sete.x} y={p.sete.y} size={p.rytterHoyde} pose="sykle" fase={v / 360}
 *     fest={{ venstreHand: p.styre, hoyreHand: p.styre, venstreFot: p.venstrePedal(v), hoyreFot: p.hoyrePedal(v) }} />
 *
 * For 'sitte' står føttene ca. 0,23 · size under setet (stolhøyden). Skyggen på bakken tegnes bare når personen står.
 */
export function Person({
  x,
  y,
  size = 120,
  pose = 'staa',
  rotate,
  flip,
  dim,
  title,
  jakke = 'blaa',
  bukse = SCENE.denim,
  hud,
  har,
  frisyre = 'kort',
  lue,
  hjelm,
  sko = 'svart',
  sekk,
  ski = 'rod',
  ledd,
  fase,
  tauvinkel,
  fest,
  skraaning,
  anker,
  skygge,
}: PersonProps) {
  const ss = useStrokeScale();
  const gJ = useSvgId('sc-jakke');
  const gB = useSvgId('sc-bukse');
  const gH = useSvgId('sc-hud');
  const s = Math.max(4, num(size, 120));
  const k = s / 100;
  const o: PersonPlass = { x, y, rotate, flip, anker, fase, tauvinkel, fest, skraaning, ski: ski !== false };
  const sk = solve(pose, s, ledd, o);
  const A = sk.anchor;

  const cJ = paint(jakke);
  const cB = paint(bukse);
  const cS = hud ? (Object.hasOwn(HUD, hud) ? HUD[hud as Hudtone] : hud) : SCENE.skin;
  const cH = har ? (Object.hasOwn(HAR, har) ? HAR[har as Harfarge] : har) : SCENE.hair;
  const cShoe = paint(sko);
  // Strektykkelse: ca. 0,9 px på PC (litt tynnere for små figurer), regnet om til personens enheter.
  const ow = (0.9 * ss * clamp(s / 120, 0.55, 1.15)) / k;
  const outline = SCENE.outline;
  const far = (c: string) => shade(c, 0.2);
  /** Strektykkelse for høylys, remmer og staver: `units` i personens enheter (× ss), men minst `minPx` i figuren. */
  const px = (units: number, minPx: number) => Math.max(units * ss, (minPx * ss) / k);
  const grad = (id: string, c: string) => <LinearGradient id={id} stops={clothStops(c)} x1={flip ? 1 : 0} x2={flip ? 0 : 1} y1={0} y2={1} />;

  const { arms, legs, trunk, head, j } = sk;
  const fx = Number.isFinite(x) ? x : 0;
  const fy = Number.isFinite(y) ? y : 0;
  const transform = `translate(${r2(fx)} ${r2(fy)})${rotate ? ` rotate(${r2(rotate)})` : ''} scale(${r2(flip ? -k : k)} ${r2(k)}) translate(${r2(-A.x)} ${r2(-A.y)})`;

  // Skygge på bakken (langs skråningen).
  const onGround = skygge ?? (!SEATED(pose) && pose !== 'falle' && anker !== 'tyngdepunkt');
  const xs = sk.ski ? [legs.venstre.foot(SKI_BACK, 0).x, legs.hoyre.foot(SKI_FRONT, 0).x] : [legs.venstre.sole.x, legs.hoyre.sole.x];
  const shadowCx = sk.ski ? (xs[0]! + xs[1]!) / 2 : (Math.min(...xs) + Math.max(...xs)) / 2;
  const shadowRx = sk.ski ? Math.abs(xs[1]! - xs[0]!) / 2 : Math.abs(xs[1]! - xs[0]!) / 2 + 9;

  const limbs = (side: Side) => {
    const a = arms[side];
    const l = legs[side];
    return {
      arm: capsule(a.s, UPPER_R[0], a.e, UPPER_R[1]) + capsule(a.e, UPPER_R[1], a.w, 2.6),
      leg: capsule({ x: 0, y: 0 }, 6.4, l.k, 4.3) + capsule(l.k, 4.3, l.a, 3.1),
    };
  };
  const near = limbs('hoyre');
  const back = limbs('venstre');

  const hand = (a: Arm, fill: string) => {
    const d = dir(a.phiF);
    let path: string;
    if (a.mode === 'knyttet') path = capsule(add(a.w, d, 0.9), 2.45, add(a.w, d, 3.2), 2.35);
    else if (a.mode === 'aapen') path = capsule(add(a.w, d, 0.8), 2.25, add(a.w, d, 6.4), 1.75);
    else {
      const up = dir(a.phiF + 80);
      path = capsule(add(a.w, up, 0.6), 2.3, add(a.w, up, 6), 1.8);
    }
    const thumb =
      a.mode === 'aapen' ? capsule(add(add(a.w, d, 1.6), dir(a.phiF + 90), 1.45), 0.95, add(add(a.w, d, 4.1), dir(a.phiF + 90), 1.9), 0.82) : null;
    return (
      <>
        <path d={path} fill={fill} stroke={outline} strokeWidth={ow} strokeLinejoin="round" />
        {thumb && <path d={thumb} fill={fill} stroke={outline} strokeWidth={ow * 0.8} />}
      </>
    );
  };
  const cuff = (a: Arm, fill: string) => {
    const d = dir(a.phiF);
    return <path d={capsule(add(a.w, d, -2.6), 2.75, add(a.w, d, -0.3), 2.7)} fill={fill} />;
  };

  const shoe = (l: Leg, fill: string, isNear: boolean) => {
    const boot = sk.ski;
    const p = shoePaths(l.foot, boot, !!flip);
    const shaftDir = dir(l.phiS + 180);
    return (
      <g>
        {boot && <path d={capsule(add(l.a, shaftDir, -0.5), 3.9, add(l.a, shaftDir, 8.5), 4.15)} fill={fill} stroke={outline} strokeWidth={ow} />}
        <path d={p.body} fill={fill} stroke={outline} strokeWidth={ow} strokeLinejoin="round" />
        <path d={p.sole} fill={shade(fill, 0.35)} />
        {isNear && <path d={p.shine} fill="none" stroke={SCENE.highlight} strokeWidth={px(0.9, 0.5)} strokeLinecap="round" />}
      </g>
    );
  };

  // Ski og staver for 'ski'.
  const skiColor = paint(typeof ski === 'string' ? ski : 'rod');
  const skiPath = (l: Leg, shift: number) => {
    const f = l.foot;
    const P = (a: number, b: number) => fmt(f(a + shift, b));
    const top = SOLE + SKI_DROP - 1.2;
    const bot = SOLE + SKI_DROP;
    return {
      ski:
        `M${P(SKI_BACK, top)}L${P(SKI_FRONT - 6, top)}Q${P(SKI_FRONT - 0.5, top - 0.2)} ${P(SKI_FRONT + 2.6, top - 4.4)}` +
        `L${P(SKI_FRONT + 3.6, top - 3.9)}Q${P(SKI_FRONT + 1, bot)} ${P(SKI_FRONT - 6, bot)}L${P(SKI_BACK + 1, bot)}Q${P(SKI_BACK - 0.6, bot - 0.6)} ${P(SKI_BACK, top)}Z`,
      binding: `M${P(-3.8, SOLE - 0.2)}L${P(9.6, SOLE - 0.2)}L${P(9.2, top)}L${P(-3.4, top)}Z`,
    };
  };
  const pole = (a: Arm) => {
    // Utforstilling: staven ligger inn under armen, bakover langs kroppen og nesten parallelt med skiene (litt
    // oppover), så trinsen havner bak hofta over halene på skiene. Staven er ca. 1,2 m (0,68 · høyden).
    const len = 68;
    const d = dir(-90 + clamp(num(skraaning, 0), -50, 50) + 8);
    const top = add(a.grip, d, -4.5);
    const tip = add(a.grip, d, len - 4.5);
    const basket = add(a.grip, d, len - 10);
    const n = { x: -d.y, y: d.x };
    const rb = Math.max(0.75, (0.55 * ss) / k);
    return (
      <g>
        <line x1={top.x} y1={top.y} x2={tip.x} y2={tip.y} stroke={SCENE.metalDark} strokeWidth={px(1.25, 1.1)} strokeLinecap="round" />
        <path d={capsule(add(basket, n, -2.6), rb, add(basket, n, 2.6), rb)} fill={SCENE.rubber} />
        <path d={capsule(top, Math.max(1.35, rb * 1.4), add(a.grip, d, 3.6), Math.max(1.25, rb * 1.3))} fill={SCENE.rubber} stroke={outline} strokeWidth={ow * 0.8} />
      </g>
    );
  };

  // Overkroppen (jakka) i overkroppens koordinater (fram, ned) fra hofteleddet.
  const T = trunk;
  const jacket = shape(T, [
    [-7.2, 3.2],
    [-7.2, 3.2],
    [-6.7, -4],
    [-5.3, -11],
    [-6.9, -20],
    [-5.8, -29.4],
    [-2.6, -32.2],
    [2.6, -31.6],
    [5.8, -26.6],
    [7.6, -19.2],
    [6.2, -9.2],
    [6.8, 3.2],
    [6.8, 3.2],
  ]);
  const hem = `M${fmt(T(-7.1, 3.25))}L${fmt(T(6.75, 3.25))}L${fmt(T(6.6, 0.6))}L${fmt(T(-6.95, 0.6))}Z`;
  const collar = shape(T, [
    [-4, -29.4],
    [-3.6, -32.8],
    [2.9, -32.4],
    [3.4, -29.2],
  ]);
  // Høylyset ligger på siden som vender mot lyset (øvre venstre): ryggen, eller brystet når personen er speilvendt.
  const backShine = flip
    ? `M${fmt(T(4.4, -26.6))}Q${fmt(T(6.6, -21.6))} ${fmt(T(5.6, -15.4))}`
    : `M${fmt(T(-4.6, -27.6))}Q${fmt(T(-6.2, -22))} ${fmt(T(-5.6, -15))}`;
  const pack =
    sekk === undefined
      ? null
      : {
          color: paint(sekk),
          body: shape(T, [
            [-5.6, -28.2],
            [-12.6, -27.6],
            [-14.6, -21],
            [-14.4, -11],
            [-12.4, -6.6],
            [-5.8, -6.8],
          ]),
          pocket: shape(T, [
            [-13.6, -16.2],
            [-9.2, -16.4],
            [-9, -8.6],
            [-13.2, -8.8],
          ]),
          strap: `M${fmt(T(-6.2, -27.6))}Q${fmt(T(0.6, -32))} ${fmt(T(5.6, -24.4))}L${fmt(T(5.8, -13.6))}`,
        };

  // Hodet i hodets koordinater (fram, ned) fra toppen av nakken.
  const H = head;
  const P = (a: number, b: number) => fmt(H(a, b));
  const headPath =
    `M${P(0.4, -12.7)}C${P(-3.6, -12.8)} ${P(-6, -10.4)} ${P(-5.7, -7.2)}C${P(-5.5, -4.6)} ${P(-4.9, -2.8)} ${P(-3.3, -0.6)}` +
    `Q${P(-1, 0.1)} ${P(1.4, 0.9)}Q${P(3.6, 2)} ${P(5.2, 1.2)}Q${P(6.1, 0.5)} ${P(5.9, -0.7)}L${P(6.2, -1.8)}L${P(5.95, -2.7)}` +
    `Q${P(6.3, -3.1)} ${P(6.8, -3.1)}L${P(7.5, -3.6)}Q${P(7.75, -4.1)} ${P(7.3, -4.7)}L${P(6.2, -6.7)}Q${P(6.7, -7.6)} ${P(6.45, -8.4)}` +
    `Q${P(6.1, -11.4)} ${P(3.6, -12.4)}Q${P(2.2, -12.8)} ${P(0.4, -12.7)}Z`;
  const ear = capsule(H(-0.7, -6.6), 1.45, H(-0.5, -4.6), 1.25);
  const brow = capsule(H(3.4, -8.15), 0.45, H(5.5, -8.25), 0.4);
  const hairCap = shape(H, [
    [5.9, -9.6],
    [5.6, -13.4],
    [1, -14.6],
    [-4.4, -13.9],
    [-7.1, -10.2],
    [-6.6, -5],
    [-5.2, -1.6],
    [-3.6, -3.4],
    [-2.6, -5.8],
    [-1.6, -8.8],
    [1.6, -9.9],
    [4.2, -9.4],
  ]);
  const hairBack =
    frisyre === 'lang'
      ? shape(H, [
          [-1, -14.2],
          [-7.4, -12],
          [-8, -4.4],
          [-7.6, 2],
          [-6.8, 6.6],
          [-3.2, 7],
          [-2.2, 2.4],
          [-2.6, -5],
        ])
      : frisyre === 'hestehale'
        ? shape(H, [
            [-4.8, -12],
            [-8.4, -11.4],
            [-10.2, -6.8],
            [-10.4, -1],
            [-9, 3.6],
            [-8, -1.4],
            [-6.8, -6.8],
            [-5.4, -9],
          ])
        : null;
  const hairShine = flip ? `M${P(-1.6, -13.5)}Q${P(2.6, -13.6)} ${P(4.8, -11.6)}` : `M${P(2.2, -13)}Q${P(-1.4, -13.7)} ${P(-4.4, -11.6)}`;
  const hat = hjelm ?? lue;
  const hatColor = hat !== undefined ? paint(hat) : undefined;
  const helmet = hjelm !== undefined;
  const hatPath = helmet
    ? shape(H, [
        [7.9, -9.2],
        [7.9, -9.2],
        [7.4, -14.2],
        [1.4, -17.4],
        [-5.6, -16.2],
        [-10.4, -11.6],
        [-10.4, -11.6],
        [-7.6, -8.4],
        [-4.2, -9.6],
        [0.4, -10.6],
        [5.6, -10.4],
      ])
    : shape(H, [
        [6.5, -8.4],
        [6.6, -13.8],
        [1.2, -16.2],
        [-5, -15.4],
        [-7.6, -11.6],
        [-7.2, -6.8],
        [-7.2, -6.8],
        [6.5, -8.4],
      ]);
  const hatBand = helmet ? '' : `M${P(-7.3, -6.7)}L${P(6.55, -8.35)}L${P(6.6, -10.6)}L${P(-7.45, -9)}Z`;
  const vents = helmet ? [capsule(H(-6.2, -13.2), 0.55, H(-3.4, -14.9), 0.55), capsule(H(-1.6, -15.5), 0.55, H(1.6, -15.6), 0.55), capsule(H(3.4, -15), 0.55, H(5.6, -13.4), 0.5)].join('') : '';
  const pompom = H(-1.4, -16.8);
  const strap = `M${P(-0.6, -8.4)}L${P(2.6, 0.6)}`;

  const neck = capsule(add(sk.neckBase, dir(-j.rygg), 1.6), 2.55, add(sk.pivot, dir(-j.rygg - j.nakke), -1.2), 2.45);
  const jacketFar = far(cJ);
  const pantsFar = far(cB);
  const skinFar = shade(cS, 0.14);
  const shoeFar = shade(cShoe, 0.15);
  // Den nære armen tegnes bak hodet når den peker opp (armer opp, fritt fall), så ansiktsprofilen alltid synes.
  const raised = armRaised(arms.hoyre);
  const nearArm = (
    <>
      <path d={near.arm} fill="none" stroke={outline} strokeWidth={ow * 2} strokeLinejoin="round" />
      <path d={near.arm} fill={`url(#${gJ})`} />
      {cuff(arms.hoyre, shade(cJ, 0.14))}
      {hand(arms.hoyre, cS)}
    </>
  );

  return (
    <g transform={transform} opacity={dim ? SCENE_DIM : undefined}>
      {title && <title>{title}</title>}
      {grad(gJ, cJ)}
      {grad(gB, cB)}
      <RadialGradient id={gH} stops={[[0, tint(cS, 0.18)], [0.6, cS], [1, shade(cS, 0.16)]]} cx={flip ? 0.6 : 0.4} cy={0.4} r={0.7} />
      {onGround && (
        <g transform={skraaning ? `rotate(${r2(-clamp(num(skraaning, 0), -50, 50))} ${r2(A.x)} ${r2(A.y)})` : undefined}>
          <ContactShadow cx={shadowCx} cy={A.y} rx={shadowRx} ry={Math.max(2.2, shadowRx * 0.14)} />
        </g>
      )}

      {/* Bakerste stav, ski, arm og bein (mørkere) */}
      {sk.ski && pole(arms.venstre)}
      {sk.ski && (
        <g fill={shade(skiColor, 0.2)} stroke={outline} strokeWidth={ow} strokeLinejoin="round">
          <path d={skiPath(legs.venstre, 2.5).ski} />
          <path d={skiPath(legs.venstre, 0).binding} fill={SCENE.metalDark} />
        </g>
      )}
      <path d={back.arm} fill="none" stroke={outline} strokeWidth={ow * 2} strokeLinejoin="round" />
      <path d={back.arm} fill={jacketFar} />
      {hand(arms.venstre, skinFar)}
      <path d={back.leg} fill="none" stroke={outline} strokeWidth={ow * 2} strokeLinejoin="round" />
      <path d={back.leg} fill={pantsFar} />
      {shoe(legs.venstre, shoeFar, false)}

      {/* Nærmeste ski og bein */}
      {sk.ski && (
        <g stroke={outline} strokeWidth={ow} strokeLinejoin="round">
          <path d={skiPath(legs.hoyre, 0).ski} fill={skiColor} />
          <path d={skiPath(legs.hoyre, 0).binding} fill={SCENE.metal} />
        </g>
      )}
      <path d={near.leg} fill="none" stroke={outline} strokeWidth={ow * 2} strokeLinejoin="round" />
      <path d={near.leg} fill={`url(#${gB})`} />
      {shoe(legs.hoyre, cShoe, true)}

      {/* Nakke, sekk, jakke og hode */}
      <path d={neck} fill={shade(cS, 0.12)} stroke={outline} strokeWidth={ow} />
      {pack && (
        <>
          <path d={pack.body} fill={pack.color} stroke={outline} strokeWidth={ow} strokeLinejoin="round" />
          <path d={pack.pocket} fill={shade(pack.color, 0.16)} stroke={outline} strokeWidth={ow * 0.7} />
        </>
      )}
      <path d={jacket} fill={`url(#${gJ})`} />
      <path d={hem} fill={shade(cJ, 0.14)} />
      <path d={collar} fill={shade(cJ, 0.1)} stroke={outline} strokeWidth={ow * 0.8} />
      <path d={jacket} fill="none" stroke={outline} strokeWidth={ow} strokeLinejoin="round" />
      {pack ? (
        <path d={pack.strap} fill="none" stroke={shade(pack.color, 0.3)} strokeWidth={px(1.5, 1)} strokeLinecap="round" strokeLinejoin="round" />
      ) : (
        <path d={backShine} fill="none" stroke={SCENE.highlight} strokeWidth={px(1.3, 0.8)} strokeLinecap="round" />
      )}
      {raised && nearArm}
      {hairBack && <path d={hairBack} fill={shade(cH, 0.08)} stroke={outline} strokeWidth={ow} strokeLinejoin="round" />}
      <path d={headPath} fill={`url(#${gH})`} stroke={outline} strokeWidth={ow} strokeLinejoin="round" />
      <path d={ear} fill={shade(cS, 0.08)} stroke={outline} strokeWidth={ow * 0.8} />
      <circle cx={H(EYE_POS.x, EYE_POS.y).x} cy={H(EYE_POS.x, EYE_POS.y).y} r={0.68} fill={EYE} />
      <path d={brow} fill={shade(cH, 0.15)} />
      {hat === undefined && (
        <>
          <path d={hairCap} fill={cH} stroke={outline} strokeWidth={ow} strokeLinejoin="round" />
          <path d={hairShine} fill="none" stroke={SCENE.highlight} strokeWidth={px(0.9, 0.6)} strokeLinecap="round" />
        </>
      )}
      {hatColor && (
        <>
          {helmet && <path d={strap} stroke={shade(hatColor, 0.45)} strokeWidth={px(0.7, 0.5)} strokeLinecap="round" />}
          <path d={hatPath} fill={hatColor} stroke={outline} strokeWidth={ow} strokeLinejoin="round" />
          {helmet ? (
            <>
              <path d={vents} fill={shade(hatColor, 0.5)} />
              <path d={`M${P(-8.2, -11.2)}Q${P(-5.2, -9.4)} ${P(0, -10.4)}Q${P(4, -10.8)} ${P(6.8, -9.8)}`} fill="none" stroke={shade(hatColor, 0.3)} strokeWidth={px(0.8, 0.5)} />
            </>
          ) : (
            <>
              <path d={hatBand} fill={shade(hatColor, 0.16)} />
              <circle cx={pompom.x} cy={pompom.y} r={2.3} fill={tint(hatColor, 0.12)} stroke={outline} strokeWidth={ow * 0.8} />
            </>
          )}
        </>
      )}

      {/* Nærmeste stav og arm */}
      {sk.ski && pole(arms.hoyre)}
      {!raised && nearArm}
    </g>
  );
}

/* ================================================================================================
 * Fallskjerm
 * ============================================================================================== */

export interface FallskjermProps extends Omit<SceneObjectProps, 'flip'> {
  /** Festepunktet: selen (ved skuldrene til hopperen). Linene samles her, og `rotate` dreier om dette punktet. */
  x: number;
  y: number;
  /** Bredden på skjermen når den er helt åpen, i figurens enheter (standard 240; ca. 4 ganger høyden på en person). */
  size?: number;
  /** 0 = pakket i sekken, ca. 0,3 = linene er strukket ut, 1 = helt åpen. */
  aapen?: number;
  /** Fargen på annenhver duk (de andre er hvite). Standard 'rod'. */
  lakk?: PaintName | string;
}

/**
 * Rund fallskjerm sett fra siden: kuppel med duker i to farger, liner ned til selen og innsiden av kanten.
 * `aapen` går fra 0 (pakket sekk ved festepunktet) via en smal pølse på strake liner til en helt åpen kuppel,
 * så utløsningen kan animeres. Ankerpunktet (x, y) er selen; skjermen er over den (dreies med `rotate`).
 *
 *   const sele = personPunkter('armer-opp', 110, undefined, { x: 400, y: 330 }).skulder;
 *   <Fallskjerm x={sele.x} y={sele.y} size={420} aapen={0.9} lakk="oransje" />
 *   <Person x={400} y={330} size={110} pose="armer-opp" skygge={false} />
 */
export function Fallskjerm({ x, y, size = 240, aapen = 1, lakk = 'rod', rotate, dim, title }: FallskjermProps) {
  const ss = useStrokeScale();
  const gDome = useSvgId('sc-skjerm');
  const gShade = useSvgId('sc-skjerm-lys');
  const s = Math.max(4, num(size, 240));
  const k = s / 100;
  const a = clamp(num(aapen, 1), 0, 1);
  const color = paint(lakk);
  const white = PAINTS.hvit;
  const ow = (0.9 * ss) / k;
  const smoothstep = (e0: number, e1: number, v: number) => {
    const t = clamp((v - e0) / (e1 - e0), 0, 1);
    return t * t * (3 - 2 * t);
  };
  const ext = smoothstep(0.03, 0.3, a);
  const inf = smoothstep(0.28, 1, a);
  // Mål i en skjerm som er 100 enheter bred når den er åpen.
  const L = 84 * (0.14 + 0.86 * ext) - 6 * inf;
  const w = 50 * (0.05 + 0.95 * Math.pow(inf, 0.85));
  const h = 30 + 12 * inf;
  const sy = -L;
  const n = inf > 0.35 ? 7 : 3;
  const xsPts = Array.from({ length: n }, (_, i) => -w * Math.cos((i / (n - 1)) * Math.PI));
  const fx = Number.isFinite(x) ? x : 0;
  const fy = Number.isFinite(y) ? y : 0;
  const transform = `translate(${r2(fx)} ${r2(fy)})${rotate ? ` rotate(${r2(rotate)})` : ''} scale(${r2(k)})`;
  const R = (rx: number, ry: number) => `${r2(Math.max(0.01, Math.abs(rx)))},${r2(ry)}`;
  const apex = { x: 0, y: sy - h };
  const scallop = (from: number, to: number) => `Q${r2((from + to) / 2)},${r2(sy + Math.abs(to - from) * 0.12)} ${r2(to)},${r2(sy)}`;
  const skirtBack = xsPts
    .slice()
    .reverse()
    .slice(1)
    .map((xv, i) => scallop(xsPts[n - 1 - i]!, xv))
    .join('');
  const dome = `M${r2(-w)},${r2(sy)}A${R(w, h)} 0 0 1 ${r2(w)},${r2(sy)}${skirtBack}Z`;
  const gores: string[] = [];
  for (let i = 0; i < n - 1; i += 2) {
    const x0 = xsPts[i]!;
    const x1 = xsPts[i + 1]!;
    const up = x0 < 0 ? 1 : 0;
    const down = x1 > 0 ? 1 : 0;
    gores.push(`M${r2(x0)},${r2(sy)}A${R(x0, h)} 0 0 ${up} ${fmt(apex)}A${R(x1, h)} 0 0 ${down} ${r2(x1)},${r2(sy)}${scallop(x1, x0)}Z`);
  }
  const mouth = `M${r2(-w)},${r2(sy)}A${R(w, w * 0.13)} 0 0 0 ${r2(w)},${r2(sy)}${skirtBack}Z`;
  const riserL = { x: -1.8, y: -9 };
  const riserR = { x: 1.8, y: -9 };
  const lines = xsPts.map((xv) => `M${r2(xv)},${r2(sy)}L${fmt(xv < 0 ? riserL : xv > 0 ? riserR : { x: 0, y: -9 })}`).join('');
  const risers = `M${fmt(riserL)}L-1.2,0M${fmt(riserR)}L1.2,0`;
  const packed = a < 0.03;
  return (
    <g transform={transform} opacity={dim ? SCENE_DIM : undefined}>
      {title && <title>{title}</title>}
      <RadialGradient id={gDome} stops={[[0, tint(color, 0.25)], [0.55, color], [1, shade(color, 0.25)]]} cx={0.4} cy={0.3} r={0.75} />
      <RadialGradient id={gShade} stops={[[0, SCENE.highlight], [0.4, SCENE.highlight, 0], [0.75, SCENE.shadow, 0], [1, SCENE.shadow, 0.9]]} cx={0.38} cy={0.25} r={0.85} />
      {!packed && (
        <>
          <path d={lines} fill="none" stroke={LINE} strokeWidth={(0.7 * ss) / k} strokeLinecap="round" opacity={0.85} />
          <path d={risers} fill="none" stroke={LINE} strokeWidth={(1.4 * ss) / k} strokeLinecap="round" />
          <path d={mouth} fill={shade(color, 0.45)} stroke={SCENE.outline} strokeWidth={ow} strokeLinejoin="round" />
          <path d={dome} fill={`url(#${gDome})`} />
          {gores.map((d, i) => (
            <path key={i} d={d} fill={white} />
          ))}
          <path d={dome} fill={`url(#${gShade})`} />
          <path d={dome} fill="none" stroke={SCENE.outline} strokeWidth={ow} strokeLinejoin="round" />
        </>
      )}
      <rect x={-2.6} y={-6.4} width={5.2} height={7} rx={1.4} fill={PAINTS.svart} stroke={SCENE.outline} strokeWidth={ow * 0.8} />
      {packed && <rect x={-1.8} y={-5.6} width={3.6} height={1.4} rx={0.6} fill={color} />}
    </g>
  );
}
