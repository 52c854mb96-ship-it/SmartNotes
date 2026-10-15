/**
 * Platetektonikk og vulkaner i illustrert realisme (lys ovenfra, kontur og myke toninger, ingen filtre):
 *   - `JordasIndre`: jordkula med en utskåret kile (eller som et helt snitt), lagene etter radiene i jorda.ts.
 *   - `Plategrense`: blokkdiagram av en plategrense med litosfære, astenosfære, magma, skjelv og bevegelse med tiden:
 *     spredning, subduksjon (hav–kontinent og hav–hav), kollisjon og varmt punkt, og transformforkastning som kart
 *     ovenfra.
 *   - `Vulkan`: skjoldvulkan eller stratovulkan (også erodert), utvendig eller i snitt med magmakammer, og utbrudd med
 *     lavastrøm, lavafontene og askesky.
 *   - `SkjelvStjerne`: jordskjelvsymbolet (stjerne) som Plategrense bruker, til egne skjelv og episentre.
 * Rene hjelpere: `MAGNETISK_POLARITET`, `polaritetVed`, `magnetiskeStriper`, `havbunnsalder`, `jordasIndreRadius`,
 * `jordasIndreRadier`, `jordasIndreGeometri`, `plategrenseGeometri` (med `kraftankre` til kraftpiler) og
 * `vulkanGeometri`. Ugyldige tall gir null, aldri NaN eller Infinity. Farten er overalt den fulle spredningsfarten
 * (hver side flytter seg med halvparten).
 *
 * Fargene er GEO-fargene (jordas indre, magma, lava, aske, polaritet). Farter og strømning tegnes med `VIZ.velocity`;
 * krefter (platetrekk, ryggskyv) tegner kapitlet selv med VIZ-fargene ved ankerpunktene fra geometrifunksjonene.
 */
import { useMemo, type ReactNode } from 'react';
import { useTextScale } from '../../kit/controls';
import { VIZ } from '../../kit/colors';
import { fmt } from '../../kit/format';
import { Txt } from '../../kit/txt';
import { ContactShadow, LinearGradient, RadialGradient, alpha, mix, sceneRandom, shade, tint, useSvgId } from '../../kit/scene/core';
import { Callout, ForceArrow } from '../../kit/scene/overlay';
import { SCENE } from '../../kit/scene/palette';
import { Planet } from '../../kit/scene/rom';
import { GEO, MAGMA_GLOD, MAGMA_GLOD_STOPP, type GeoPaint } from './colors';
import { fmtTall } from './akser';
import { useGeoScale, useGeoStroke } from './felles';
import { fmtAlder } from './geotid';
import { JORDAS_LAG, JORDRADIUS, type JordLag, type Tilstand } from './jorda';
import { LagMonstre, useLagMonstre } from './monstre';
import { SnittEtiketter, snittblokkPerspektiv, type SnittEtikett } from './snitt';
import type { MonsterId } from './typer';

/* =====================================================================================================================
 * Små hjelpere
 * ================================================================================================================== */

type P = readonly [number, number];

const r2 = (v: number): number => (Number.isFinite(v) ? Math.round(v * 100) / 100 : 0);
const tall = (v: number | null | undefined, alt: number): number => (typeof v === 'number' && Number.isFinite(v) ? v : alt);
const klemme = (v: number, a: number, b: number): number => Math.min(b, Math.max(a, v));
/** Myk overgang fra 0 (x ≤ a) til 1 (x ≥ b). */
function trinn(a: number, b: number, x: number): number {
  const t = klemme((x - a) / (b - a || 1), 0, 1);
  return t * t * (3 - 2 * t);
}
/** Klokkeformet bump med topp 1 i c og halvbredde s. */
const klokke = (x: number, c: number, s: number): number => Math.exp(-(((x - c) / (s || 1)) ** 2));

function linspace(a: number, b: number, n: number): number[] {
  const m = Math.max(1, Math.round(n));
  return Array.from({ length: m + 1 }, (_, i) => a + ((b - a) * i) / m);
}

function sti(p: readonly P[], lukket = false): string {
  if (p.length === 0) return '';
  return p.map(([x, y], i) => `${i ? 'L' : 'M'}${r2(x)} ${r2(y)}`).join('') + (lukket ? 'Z' : '');
}

/** Glatt kurve gjennom punktene (Catmull–Rom som kubiske Bézier-kurver). */
function glattSti(p: readonly P[], lukket = false): string {
  const n = p.length;
  if (n < 3) return sti(p, lukket);
  const pt = (i: number): P => (lukket ? p[(i + n) % n]! : p[klemme(i, 0, n - 1)]!);
  let d = `M${r2(p[0]![0])} ${r2(p[0]![1])}`;
  const segs = lukket ? n : n - 1;
  for (let i = 0; i < segs; i++) {
    const p0 = pt(i - 1);
    const p1 = pt(i);
    const p2 = pt(i + 1);
    const p3 = pt(i + 2);
    d += `C${r2(p1[0] + (p2[0] - p0[0]) / 6)} ${r2(p1[1] + (p2[1] - p0[1]) / 6)} ${r2(p2[0] - (p3[0] - p1[0]) / 6)} ${r2(p2[1] - (p3[1] - p1[1]) / 6)} ${r2(p2[0])} ${r2(p2[1])}`;
  }
  return lukket ? `${d}Z` : d;
}

function iPolygon(p: readonly P[], x: number, y: number): boolean {
  let inne = false;
  for (let i = 0, j = p.length - 1; i < p.length; j = i++) {
    const [xi, yi] = p[i]!;
    const [xj, yj] = p[j]!;
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inne = !inne;
  }
  return inne;
}

function interp(xs: readonly number[], ys: readonly number[], x: number): number {
  const n = xs.length;
  if (n === 0) return 0;
  if (!(x > xs[0]!)) return ys[0]!;
  if (!(x < xs[n - 1]!)) return ys[n - 1]!;
  let lo = 0;
  let hi = n - 1;
  while (hi - lo > 1) {
    const m = (lo + hi) >> 1;
    if (xs[m]! <= x) lo = m;
    else hi = m;
  }
  const t = (x - xs[lo]!) / (xs[hi]! - xs[lo]! || 1);
  return ys[lo]! + t * (ys[hi]! - ys[lo]!);
}

/**
 * Bånd mellom to kurver over et x-intervall, som polygoner (ett per sammenhengende stykke der `bunn` ligger under
 * `topp`). Til lag i et snitt der et lag kan kiles ut.
 */
function baand(x0: number, x1: number, topp: (x: number) => number, bunn: (x: number) => number, steg: number): P[][] {
  const n = Math.max(2, Math.ceil(Math.abs(x1 - x0) / Math.max(0.5, steg)));
  const ut: P[][] = [];
  let ovre: P[] = [];
  let nedre: P[] = [];
  const lukk = () => {
    if (ovre.length > 1) ut.push([...ovre, ...nedre.reverse()]);
    ovre = [];
    nedre = [];
  };
  for (const x of linspace(x0, x1, n)) {
    const a = topp(x);
    const b = bunn(x);
    if (Number.isFinite(a) && Number.isFinite(b) && b > a + 0.05) {
      ovre.push([x, a]);
      nedre.push([x, b]);
    } else lukk();
  }
  lukk();
  return ut;
}

/** Femtakket stjerne (skjelv) med midten i (x, y). */
function stjerneSti(x: number, y: number, R: number): string {
  const p: P[] = [];
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const r = i % 2 === 0 ? R : R * 0.45;
    p.push([x + r * Math.cos(a), y + r * Math.sin(a)]);
  }
  return sti(p, true);
}

/** Trekant (pilhode) med spissen i `p` i retningen (ux, uy). */
function pilhode(p: P, ux: number, uy: number, L: number): string {
  const n = Math.hypot(ux, uy) || 1;
  const x = ux / n;
  const y = uy / n;
  const b = L * 0.55;
  return sti(
    [
      [p[0], p[1]],
      [p[0] - x * L - y * b, p[1] - y * L + x * b],
      [p[0] - x * L + y * b, p[1] - y * L - x * b],
    ],
    true,
  );
}

/* =====================================================================================================================
 * Magnetisk polaritet (0–5 millioner år) og stripene på havbunnen
 * ================================================================================================================== */

/** Ett intervall med samme polaritet i jordas magnetfelt. Aldre i millioner år (0 = i dag). */
export interface PolaritetsIntervall {
  /** Yngste alder i intervallet (millioner år). */
  fra: number;
  /** Eldste alder (millioner år). */
  til: number;
  /** Normal polaritet (som i dag) eller omvendt. */
  normal: boolean;
  /** Kronen eller episoden: «Brunhes», «Jaramillo» … */
  navn: string;
}

/**
 * Jordas magnetfelt de siste 6 millioner år: intervaller med normal og omvendt polaritet, yngst først, med kronene
 * (Brunhes, Matuyama, Gauss, Gilbert) og de korte episodene i dem (Jaramillo, Olduvai, Kaena, Mammoth, Cochiti,
 * Nunivak, Sidufjall, Thvera). Grunnlaget for de magnetiske stripene i `Plategrense` og `magnetiskeStriper`.
 *
 * Kilde: den astronomisk kalibrerte polaritetsskalaen ATNTS2004 (Lourens mfl. 2004), som Geologic Time Scale 2012
 * (Hilgen mfl. 2012) bruker for denne delen, avrundet til hele tusen år: Brunhes 0–0,781, Matuyama 0,781–2,581, Gauss
 * 2,581–3,596 og Gilbert 3,596–6,033 millioner år. To svært korte normale episoder er utelatt fordi de blir for smale
 * til å synes på havbunnen: Cobb Mountain (1,173–1,185) og Réunion (2,128–2,148 millioner år).
 */
export const MAGNETISK_POLARITET: readonly PolaritetsIntervall[] = [
  { fra: 0, til: 0.781, normal: true, navn: 'Brunhes' },
  { fra: 0.781, til: 0.988, normal: false, navn: 'Matuyama' },
  { fra: 0.988, til: 1.072, normal: true, navn: 'Jaramillo' },
  { fra: 1.072, til: 1.778, normal: false, navn: 'Matuyama' },
  { fra: 1.778, til: 1.945, normal: true, navn: 'Olduvai' },
  { fra: 1.945, til: 2.581, normal: false, navn: 'Matuyama' },
  { fra: 2.581, til: 3.032, normal: true, navn: 'Gauss' },
  { fra: 3.032, til: 3.116, normal: false, navn: 'Kaena' },
  { fra: 3.116, til: 3.207, normal: true, navn: 'Gauss' },
  { fra: 3.207, til: 3.33, normal: false, navn: 'Mammoth' },
  { fra: 3.33, til: 3.596, normal: true, navn: 'Gauss' },
  { fra: 3.596, til: 4.187, normal: false, navn: 'Gilbert' },
  { fra: 4.187, til: 4.3, normal: true, navn: 'Cochiti' },
  { fra: 4.3, til: 4.493, normal: false, navn: 'Gilbert' },
  { fra: 4.493, til: 4.631, normal: true, navn: 'Nunivak' },
  { fra: 4.631, til: 4.799, normal: false, navn: 'Gilbert' },
  { fra: 4.799, til: 4.896, normal: true, navn: 'Sidufjall' },
  { fra: 4.896, til: 4.997, normal: false, navn: 'Gilbert' },
  { fra: 4.997, til: 5.235, normal: true, navn: 'Thvera' },
  { fra: 5.235, til: 6.033, normal: false, navn: 'Gilbert' },
];

/** Hvor langt tilbake stripene i `Plategrense` går (millioner år). */
export const STRIPER_START = 5;

/**
 * Polariteten for en alder (millioner år): true = normal (som i dag), false = omvendt. En alder på en grense hører til
 * det yngre intervallet. Null for negative og ugyldige aldre og for aldre eldre enn tabellen (6,033 millioner år).
 */
export function polaritetVed(alder: number): boolean | null {
  if (!Number.isFinite(alder) || alder < 0) return null;
  const i = MAGNETISK_POLARITET.find((p) => alder >= p.fra && alder < p.til);
  return i ? i.normal : null;
}

/** Én magnetisk stripe på havbunnen på den ene siden av ryggen (avstand i km fra ryggen). */
export interface MagnetiskStripe {
  /** Avstanden fra ryggen til den indre kanten (km). */
  fra: number;
  /** Avstanden til den ytre kanten (km). */
  til: number;
  normal: boolean;
  navn: string;
  /** Hvor mange millioner år før i dag skorpa ved den indre og ytre kanten ble dannet. */
  dannetFra: number;
  dannetTil: number;
}

/**
 * Stripene på den ene siden av en spredningsrygg (de er speilvendt på den andre siden). `spredningsfart` er den
 * relative farten mellom platene i cm per år (full spredningsfart, som `Plategrense.fart`): hver side flytter seg med
 * spredningsfart/2. Har du halvfarten (farten til én plate), gang den med 2 først. `t` er hvor mange millioner år som
 * har gått siden figuren startet for `start` millioner år siden (standard 5). Skorpa som ble dannet ved tiden τ etter
 * start, ligger nå (t − τ) · v km fra ryggen, der v = 5 · spredningsfart km per million år, og har polariteten fra
 * (start − τ) millioner år før i dag. Ved t = start er mønsteret som på havbunnen i dag; t over start regnes som start.
 * Avstanden ut til den eldste stripa er 5 · spredningsfart · t km. Gir [] når farten eller t er 0 eller ugyldig.
 *   magnetiskeStriper(4, 5)[0]   // { fra: 0, til: 15,6, normal: true, navn: 'Brunhes', … }  (20 km per million år)
 */
export function magnetiskeStriper(spredningsfart: number, t: number, start = STRIPER_START): MagnetiskStripe[] {
  const fart = spredningsfart;
  if (!Number.isFinite(fart) || !Number.isFinite(t) || !Number.isFinite(start) || fart <= 0 || t <= 0 || start <= 0) return [];
  const T = Math.min(t, start);
  const v = 5 * fart; // km per million år på hver side
  const yngst = start - T; // dannet ved ryggen nå
  const ut: MagnetiskStripe[] = [];
  for (const p of MAGNETISK_POLARITET) {
    const a0 = Math.max(p.fra, yngst);
    const a1 = Math.min(p.til, start);
    if (!(a1 > a0)) continue;
    const fra = (a0 - yngst) * v;
    const til = (a1 - yngst) * v;
    const forrige = ut[ut.length - 1];
    if (forrige && forrige.normal === p.normal) {
      forrige.til = til;
      forrige.dannetTil = a1;
      continue;
    }
    ut.push({ fra, til, normal: p.normal, navn: p.navn, dannetFra: a0, dannetTil: a1 });
  }
  return ut;
}

/**
 * Alderen (millioner år) til havbunnen `avstand` km fra ryggaksen når platene sprer seg med `spredningsfart` cm per år
 * (full fart; hver side flytter seg med halvparten): alder = |avstand| / (5 · spredningsfart). 1 cm per år er 10 km per
 * million år. Samme konvensjon som `magnetiskeStriper` og `Plategrense.fart`. Null når farten er 0, negativ eller
 * ugyldig.
 *   havbunnsalder(100, 4)   // 5 (millioner år): 20 km per million år på hver side
 */
export function havbunnsalder(avstand: number, spredningsfart: number): number | null {
  if (!Number.isFinite(avstand) || !Number.isFinite(spredningsfart) || spredningsfart <= 0) return null;
  return Math.abs(avstand) / (5 * spredningsfart);
}

/* =====================================================================================================================
 * Jordas indre
 * ================================================================================================================== */

/** Den kjemiske (skorpe, mantel, kjerne) eller mekaniske inndelingen (litosfære, astenosfære …). */
export type JordInndeling = 'kjemisk' | 'mekanisk';

/** Id-ene til lagene i jorda.ts. */
export type JordLagId = JordLag['id'];

/** Ett lag i `JordasIndre` med tegnede radier. */
export interface JordasIndreLag {
  id: JordLagId;
  /** Navnet med stor forbokstav: «Øvre mantel». */
  navn: string;
  /** Øverste og nederste dyp i km (fra jorda.ts). */
  topp: number;
  bunn: number;
  /** Tegnet radius ved toppen og bunnen av laget (figurens enheter). */
  rYtre: number;
  rIndre: number;
  farge: GeoPaint;
  tilstand: Tilstand;
}

const LAG_FARGE: Record<JordLagId, GeoPaint> = {
  skorpe: GEO.skorpeKontinent,
  ovreMantel: GEO.mantel,
  nedreMantel: GEO.nedreMantel,
  ytreKjerne: GEO.ytreKjerne,
  indreKjerne: GEO.indreKjerne,
  litosfare: GEO.litosfare,
  astenosfare: GEO.astenosfare,
};

const storForbokstav = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);

const dypFor = (inndeling: JordInndeling, id: JordLagId, kant: 'topp' | 'bunn', alt: number): number =>
  JORDAS_LAG[inndeling].find((l) => l.id === id)?.[kant] ?? alt;

/** Støttepunktene (dyp i km → andel av radien) for den overdrevne skorpa og litosfæren. */
function radiusPunkter(r: number): (readonly [number, number])[] {
  const skorpe = dypFor('kjemisk', 'skorpe', 'bunn', 35);
  const lito = dypFor('mekanisk', 'litosfare', 'bunn', 100);
  const ovre = dypFor('kjemisk', 'ovreMantel', 'bunn', 660);
  const ytre = dypFor('kjemisk', 'ytreKjerne', 'topp', 2891);
  const indre = dypFor('kjemisk', 'indreKjerne', 'topp', 5150);
  // Skorpa minst 3 % av radien og helst 4 enheter (høyst 6 %), litosfæren minst 6,5 %; mantelen under krymper litt,
  // kjernen er riktig.
  const cs = klemme(Math.max(0.03, 4 / r), 0.03, 0.06);
  const ls = klemme(Math.max(0.065, cs + 4 / r), 0.065, 0.11);
  return [
    [0, 1],
    [skorpe, 1 - cs],
    [lito, 1 - ls],
    [ovre, 0.86],
    [ytre, 1 - ytre / JORDRADIUS],
    [indre, 1 - indre / JORDRADIUS],
    [JORDRADIUS, 0],
  ];
}

/**
 * Den tegnede radien (figurens enheter) for et dyp i km i en jordkule med radius `r`. Skorpa og litosfæren er så
 * tynne (35 og 100 av 6371 km) at de tegnes tykkere enn de er (skorpa minst 3 % av radien og helst 4 enheter,
 * høyst 6 %), og mantelen ned til 660 km krymper litt for å gi plass; grensene i kjernen (2891 og 5150 km) står
 * riktig. Med `riktigeForhold` er alt i målestokk. Null utenfor 0–6371 km eller for ugyldig r.
 */
export function jordasIndreRadius(dybde: number, r: number, riktigeForhold = false): number | null {
  if (!Number.isFinite(dybde) || !Number.isFinite(r) || !(r > 0) || dybde < 0 || dybde > JORDRADIUS) return null;
  if (riktigeForhold) return r * (1 - dybde / JORDRADIUS);
  const pts = radiusPunkter(r);
  return r * interp(
    pts.map((p) => p[0]),
    pts.map((p) => p[1]),
    dybde,
  );
}

/**
 * Lagene i `JordasIndre` med navn, dyp, farge og tegnede radier (se `jordasIndreRadius`), fra skorpa (eller
 * litosfæren) og innover. Tom liste for ugyldig r.
 */
export function jordasIndreRadier(r: number, inndeling: JordInndeling = 'kjemisk', riktigeForhold = false): JordasIndreLag[] {
  if (!Number.isFinite(r) || !(r > 0)) return [];
  return JORDAS_LAG[inndeling].map((l) => ({
    id: l.id,
    navn: storForbokstav(l.navn),
    topp: l.topp,
    bunn: l.bunn,
    rYtre: jordasIndreRadius(l.topp, r, riktigeForhold) ?? r,
    rIndre: jordasIndreRadius(l.bunn, r, riktigeForhold) ?? 0,
    farge: LAG_FARGE[l.id],
    tilstand: l.tilstand,
  }));
}

type V3 = readonly [number, number, number];
const dot3 = (a: V3, b: V3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const norm3 = (a: V3): V3 => {
  const n = Math.hypot(a[0], a[1], a[2]) || 1;
  return [a[0] / n, a[1] / n, a[2] / n];
};
const kryss3 = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

// Kula sett litt ovenfra og fra høyre, så kilen (åttendedelen x, y, z > 0) vender mot oss.
const KILE_D = norm3([0.6, 0.45, 1]);
const KILE_E1 = norm3([KILE_D[2], 0, -KILE_D[0]]);
const KILE_E2 = kryss3(KILE_D, KILE_E1);
const kileProj = (v: V3): P => [dot3(v, KILE_E1), -dot3(v, KILE_E2)];
const AKSE_X = kileProj([1, 0, 0]);
const AKSE_Y = kileProj([0, 1, 0]);
const AKSE_Z = kileProj([0, 0, 1]);
/** De tre snittflatene i kilen: aksene som spenner dem ut og lyset (positiv = lysere, negativ = i skygge). */
const KILE_FLATER: readonly { a: P; b: P; lys: number }[] = [
  { a: AKSE_X, b: AKSE_Z, lys: 0.2 }, // ekvatorplanet, vender opp mot lyset
  { a: AKSE_Y, b: AKSE_Z, lys: -0.2 }, // vender mot høyre, i skygge
  { a: AKSE_X, b: AKSE_Y, lys: 0.05 }, // vender mot oss
];
/** Ankerpunktene står midt på flaten som vender mot oss, 45° opp fra ekvator. */
const KILE_ANKER: P = [(AKSE_X[0] + AKSE_Y[0]) * Math.SQRT1_2, (AKSE_X[1] + AKSE_Y[1]) * Math.SQRT1_2];
const SNITT_ANKER: P = [Math.cos((-35 * Math.PI) / 180), Math.sin((-35 * Math.PI) / 180)];

function kvartBue(c: P, a: P, b: P, rho: number, n = 30): P[] {
  return linspace(0, Math.PI / 2, n).map((t): P => [c[0] + rho * (Math.cos(t) * a[0] + Math.sin(t) * b[0]), c[1] + rho * (Math.cos(t) * a[1] + Math.sin(t) * b[1])]);
}

/** Valg til `jordasIndreGeometri` (samme som propsene til `JordasIndre`). */
export interface JordasIndreValg {
  x: number;
  y: number;
  r: number;
  form?: 'kile' | 'snitt';
  inndeling?: JordInndeling;
  riktigeForhold?: boolean;
}

/** Geometrien til `JordasIndre`: lagene med ankerpunkter og punkter for et dyp, i figurens koordinater. */
export interface JordasIndreGeometri {
  x: number;
  y: number;
  r: number;
  form: 'kile' | 'snitt';
  inndeling: JordInndeling;
  /** Lagene utenfra og inn, med et ankerpunkt midt i laget på snittflaten (til etiketter og Callout). */
  lag: (JordasIndreLag & { anker: { x: number; y: number } })[];
  /** Tegnet radius for et dyp i km (null utenfor jorda). */
  radius: (dybde: number) => number | null;
  /** Punktet på snittflaten for et dyp i km, langs samme stråle som ankerpunktene (null utenfor jorda). */
  punkt: (dybde: number) => { x: number; y: number } | null;
}

/**
 * Geometrien til `JordasIndre` uten å tegne: lagene med radier og ankerpunkter, og punktet for et dyp (til
 * dybdemarkører, skjelvstråler og etiketter). Null for ugyldige tall.
 *   const g = jordasIndreGeometri({ x: 200, y: 200, r: 150, form: 'kile' });
 *   g?.punkt(2891)   // grensen mellom mantelen og kjernen på flaten som vender mot oss
 */
export function jordasIndreGeometri(v: JordasIndreValg): JordasIndreGeometri | null {
  const { x, y, r } = v;
  if (![x, y, r].every(Number.isFinite) || !(r > 0)) return null;
  const form = v.form ?? 'kile';
  const inndeling = v.inndeling ?? 'kjemisk';
  const riktige = v.riktigeForhold ?? false;
  const retning = form === 'kile' ? KILE_ANKER : SNITT_ANKER;
  const radius = (d: number) => jordasIndreRadius(d, r, riktige);
  const punkt = (d: number) => {
    const rho = radius(d);
    return rho === null ? null : { x: x + rho * retning[0], y: y + rho * retning[1] };
  };
  const lag = jordasIndreRadier(r, inndeling, riktige).map((l) => {
    const rho = l.rIndre > 0 ? (l.rYtre + l.rIndre) / 2 : l.rYtre * 0.45;
    return { ...l, anker: { x: x + rho * retning[0], y: y + rho * retning[1] } };
  });
  return { x, y, r, form, inndeling, lag, radius, punkt };
}

/** Props til `JordasIndre`. */
export interface JordasIndreProps extends JordasIndreValg {
  /** 'kile' (standard): kula med en utskåret åttendedel. 'snitt': hele tverrsnittet som en skive. */
  form?: 'kile' | 'snitt';
  /** 'kjemisk' (standard): skorpe, øvre og nedre mantel, ytre og indre kjerne. 'mekanisk': litosfære, astenosfære … */
  inndeling?: JordInndeling;
  /** Alt i målestokk (skorpa blir en hårfin strek). Standard av: skorpa og litosfæren er tegnet tykkere. */
  riktigeForhold?: boolean;
  /** Overflaten på kula: 'jorda' (kontinenter og hav, standard) eller 'stein' (ensfarget skorpe). */
  overflate?: 'jorda' | 'stein';
  /** Dybdemarkør i km: stiplet bue (eller ring) på snittflatene og en prikk med dybden. */
  dybde?: number | null;
  /** Teksten ved dybdemarkøren (standard «2891 km»; false = ingen tekst). */
  dybdeTekst?: string | boolean;
  /** Fremhev ett lag (de andre tones ned). */
  markert?: JordLagId | null;
  /** Lagnavn i en kolonne til høyre (true eller 'hoyre') eller venstre for kula, med streker til lagene. */
  etiketter?: boolean | 'hoyre' | 'venstre';
  /** Der kolonnen med etiketter står (standard x ± (r + 22)). */
  etikettX?: number;
  /** Dypet under navnet («35–660 km»). Standard på. */
  undertekst?: boolean;
  dim?: boolean;
  /** Tegnes oppå, med geometrien (lagene, ankerpunktene og punktet for et dyp). */
  children?: (g: JordasIndreGeometri) => ReactNode;
}

/**
 * Jordkula i snitt: med en utskåret kile (en åttendedel er tatt ut, så tre snittflater viser lagene) eller som et helt
 * tverrsnitt. Lagene følger radiene i jorda.ts, i kjemisk eller mekanisk inndeling; skorpa og litosfæren er tegnet
 * tykkere så de synes (`riktigeForhold` viser alt i målestokk). Kula har kontinenter og hav (Planet fra scene-kit-et)
 * med lys fra øvre venstre. Ankerpunkt: (x, y) er midten av kula, `r` radien. Kilen vender opp mot høyre, så
 * etikettkolonnen står best til høyre (fra x + r + 22, ca. 150 enheter bred, mer på mobil).
 *   <JordasIndre x={180} y={180} r={150} inndeling="mekanisk" etiketter dybde={2891} />
 */
export function JordasIndre({
  x,
  y,
  r,
  form = 'kile',
  inndeling = 'kjemisk',
  riktigeForhold = false,
  overflate = 'jorda',
  dybde,
  dybdeTekst = true,
  markert,
  etiketter = false,
  etikettX,
  undertekst = true,
  dim,
  children,
}: JordasIndreProps) {
  const s = useGeoStroke();
  const k = useGeoScale();
  const lysId = useSvgId('jord-lys');
  const steinId = useSvgId('jord-stein');
  const geo = jordasIndreGeometri({ x, y, r, form, inndeling, riktigeForhold });
  if (!geo) return null;
  const C: P = [x, y];
  // Fyll fra ytterst og inn. I den mekaniske inndelingen tegnes skorpa som et tynt bånd øverst i litosfæren.
  const skorpeR = jordasIndreRadius(dypFor('kjemisk', 'skorpe', 'bunn', 35), r, riktigeForhold) ?? r;
  const fyll: { id: JordLagId; rho: number; farge: GeoPaint; stiplet?: boolean }[] = [];
  for (const l of geo.lag) {
    if (inndeling === 'mekanisk' && l.id === 'litosfare') {
      fyll.push({ id: l.id, rho: l.rYtre, farge: GEO.skorpeKontinent });
      fyll.push({ id: l.id, rho: skorpeR, farge: l.farge, stiplet: true });
    } else fyll.push({ id: l.id, rho: l.rYtre, farge: l.farge });
  }
  const farge = (f: (typeof fyll)[number]) => (markert && markert !== f.id ? mix(f.farge.fill, VIZ.surface, 0.55) : f.farge.fill);
  const dRho = dybde === null || dybde === undefined ? null : jordasIndreRadius(dybde, r, riktigeForhold);
  const dPunkt = dybde === null || dybde === undefined ? null : geo.punkt(dybde);
  const dTekst = typeof dybdeTekst === 'string' ? dybdeTekst : dybdeTekst && dybde !== null && dybde !== undefined ? `${fmtTall(dybde)} km` : null;
  const markertLag = markert ? geo.lag.find((l) => l.id === markert) : undefined;

  const flate =
    form === 'kile' ? (
      <g>
        {overflate === 'jorda' ? (
          <Planet x={x} y={y} r={r} type="jorda" natt={0.32} fase={0.95} lysretning={215} />
        ) : (
          <g>
            <RadialGradient id={steinId} fx={0.32} fy={0.28} stops={[[0, tint(GEO.skorpeKontinent.fill, 0.35)], [0.5, GEO.skorpeKontinent.fill], [1, shade(GEO.skorpeKontinent.fill, 0.35)]]} />
            <circle cx={x} cy={y} r={r} fill={`url(#${steinId})`} stroke={SCENE.outline} strokeWidth={1.2 * s} />
          </g>
        )}
        {KILE_FLATER.map((fl, i) => (
          <g key={i}>
            {fyll.map((f, j) => (
              <path key={j} d={sti([C, ...kvartBue(C, fl.a, fl.b, f.rho)], true)} fill={farge(f)} />
            ))}
            <path
              d={sti([C, ...kvartBue(C, fl.a, fl.b, r)], true)}
              fill={fl.lys > 0 ? alpha(SCENE.highlight, fl.lys * 1.4) : alpha(SCENE.shadow, -fl.lys * 2.4)}
            />
            {fyll.slice(1).map((f, j) => (
              <path
                key={`g${j}`}
                d={sti(kvartBue(C, fl.a, fl.b, f.rho))}
                fill="none"
                stroke={shade(f.farge.line, 0.05)}
                strokeWidth={0.9 * s}
                strokeDasharray={f.stiplet ? `${r2(3 * s)} ${r2(2.5 * s)}` : undefined}
                opacity={0.85}
              />
            ))}
            {markertLag && (
              <path
                d={sti([...kvartBue(C, fl.a, fl.b, markertLag.rYtre), ...kvartBue(C, fl.a, fl.b, markertLag.rIndre).reverse()], true)}
                fill="none"
                stroke={VIZ.ink}
                strokeWidth={2 * s}
                strokeLinejoin="round"
              />
            )}
          </g>
        ))}
        <g stroke={SCENE.outline} strokeWidth={1.2 * s} fill="none" strokeLinecap="round" strokeLinejoin="round">
          {[AKSE_X, AKSE_Y, AKSE_Z].map((a, i) => (
            <line key={i} x1={r2(x)} y1={r2(y)} x2={r2(x + r * a[0])} y2={r2(y + r * a[1])} />
          ))}
          {KILE_FLATER.map((fl, i) => (
            <path key={`b${i}`} d={sti(kvartBue(C, fl.a, fl.b, r))} />
          ))}
        </g>
        {dRho !== null && dRho > 0 && (
          <g fill="none" strokeLinecap="round">
            {KILE_FLATER.map((fl, i) => (
              <g key={i}>
                <path d={sti(kvartBue(C, fl.a, fl.b, dRho))} stroke={VIZ.surface} strokeWidth={3.6 * s} opacity={0.75} />
                <path d={sti(kvartBue(C, fl.a, fl.b, dRho))} stroke={VIZ.ink} strokeWidth={1.7 * s} strokeDasharray={`${r2(5 * s)} ${r2(3.5 * s)}`} />
              </g>
            ))}
          </g>
        )}
      </g>
    ) : (
      <g>
        <RadialGradient
          id={lysId}
          fx={0.32}
          fy={0.28}
          stops={[
            [0, SCENE.highlight, 0.55],
            [0.55, SCENE.highlight, 0],
            [1, SCENE.shadow, 0.6],
          ]}
        />
        {fyll.map((f, j) => (
          <circle key={j} cx={r2(x)} cy={r2(y)} r={r2(f.rho)} fill={farge(f)} />
        ))}
        <circle cx={r2(x)} cy={r2(y)} r={r2(r)} fill={`url(#${lysId})`} />
        {fyll.slice(1).map((f, j) => (
          <circle
            key={`g${j}`}
            cx={r2(x)}
            cy={r2(y)}
            r={r2(f.rho)}
            fill="none"
            stroke={shade(f.farge.line, 0.05)}
            strokeWidth={0.9 * s}
            strokeDasharray={f.stiplet ? `${r2(3 * s)} ${r2(2.5 * s)}` : undefined}
            opacity={0.85}
          />
        ))}
        {markertLag && (
          <g fill="none" stroke={VIZ.ink} strokeWidth={2 * s}>
            <circle cx={r2(x)} cy={r2(y)} r={r2(markertLag.rYtre)} />
            {markertLag.rIndre > 0 && <circle cx={r2(x)} cy={r2(y)} r={r2(markertLag.rIndre)} />}
          </g>
        )}
        <circle cx={r2(x)} cy={r2(y)} r={r2(r)} fill="none" stroke={SCENE.outline} strokeWidth={1.3 * s} />
        {dRho !== null && dRho > 0 && (
          <g fill="none">
            <circle cx={r2(x)} cy={r2(y)} r={r2(dRho)} stroke={VIZ.surface} strokeWidth={3.6 * s} opacity={0.75} />
            <circle cx={r2(x)} cy={r2(y)} r={r2(dRho)} stroke={VIZ.ink} strokeWidth={1.7 * s} strokeDasharray={`${r2(5 * s)} ${r2(3.5 * s)}`} />
          </g>
        )}
      </g>
    );

  const side = etiketter === 'venstre' ? 'venstre' : 'hoyre';
  const etikettListe: SnittEtikett[] = geo.lag.map((l) => ({
    x: l.anker.x,
    y: l.anker.y,
    tekst: l.navn,
    undertekst: undertekst ? `${fmtTall(l.topp)}–${fmtTall(l.bunn)} km` : undefined,
    uthevet: markert === l.id,
    dim: Boolean(markert && markert !== l.id),
  }));

  return (
    <g opacity={dim ? 0.4 : undefined}>
      {flate}
      {dPunkt && (
        <g>
          <circle cx={r2(dPunkt.x)} cy={r2(dPunkt.y)} r={r2(3.4 * k)} fill={VIZ.ink} stroke={VIZ.surface} strokeWidth={1.2 * s} />
          {dTekst && (
            <Txt x={r2(dPunkt.x - 8 * k)} y={r2(dPunkt.y - 7 * k)} anchor="end" size={0.78}>
              {dTekst}
            </Txt>
          )}
        </g>
      )}
      {etiketter && (
        <SnittEtiketter
          x={etikettX ?? (side === 'hoyre' ? x + r + 22 : x - r - 22)}
          anchor={side === 'hoyre' ? 'start' : 'end'}
          topp={y - r}
          bunn={y + r}
          etiketter={etikettListe}
        />
      )}
      {children?.(geo)}
    </g>
  );
}

/* =====================================================================================================================
 * Kjegler (vulkaner) og blokka de står på
 * ================================================================================================================== */

/**
 * En kjegleformet vulkan som omdreiningsflate: profilen y(u) fra toppen (u = 0) til foten (u = 1), dreid rundt en
 * loddrett akse. I en blokk står den ved frontkanten og er skåret av snittet foran (bare bakre halvdel tegnes som
 * flate); fritt står den hel. Lokale koordinater (y nedover).
 */
interface Kjegle {
  /** Midten av foten (x). */
  x: number;
  /** Radius ved foten, vannrett. */
  r: number;
  /** Radius i dybden (standard r; mindre når blokka er grunn). */
  rz?: number;
  /** Toppen (y). */
  topp: number;
  /** Foten (y) midt under toppen. */
  fot: number;
  form: 'strato' | 'skjold';
  /** Krateret: radius som andel av r og dybden under kanten. */
  krater?: { u: number; dyp: number } | null;
  /** Flat topp (guyot) ut til denne andelen av radien. */
  flat?: number;
  /** Ruhet fra erosjon (0–1): terrasser og dype raviner. */
  ru?: number;
  /** Bergfargen på flankene. */
  farge: string;
  /** Snø over denne andelen av høyden (0–1). */
  sno?: number | null;
  /** Grønt (vegetasjon) under denne andelen av høyden. */
  gront?: number | null;
  /** Glød i krateret (0–1). */
  glo?: number;
  /** Havnivået (y): flankene under vann får farge som havbunnen. */
  vann?: number | null;
  seed?: number;
}

/** Profilen til kjegla (uten krater) ved andelen u av radien. */
function kjegleY(k: Kjegle, u: number): number {
  const H = k.fot - k.topp;
  const uf = klemme(k.flat ?? 0, 0, 0.9);
  if (u <= uf) return k.topp;
  const v = klemme((u - uf) / (1 - uf), 0, 1);
  const f = k.form === 'strato' ? 0.22 * v + 0.78 * (1 - (1 - v) ** 2) : v ** 1.55;
  let y = k.topp + H * f;
  if (k.ru) y += k.ru * H * 0.045 * Math.sin(v * 21 + (k.seed ?? 1) * 1.7) * Math.sin(Math.PI * v);
  return y;
}

/** Profilen med krateret (til snittet foran). */
function kjegleMedKrater(k: Kjegle, u: number): number {
  const kr = k.krater;
  if (kr && u < kr.u) {
    const kant = kjegleY(k, kr.u);
    return kant + kr.dyp * (1 - (u / kr.u) ** 2);
  }
  return kjegleY(k, u);
}

/** y-en til kjegla i snittet foran ved x (Infinity utenfor foten). */
function kjegleFront(k: Kjegle, x: number): number {
  const u = Math.abs(x - k.x) / Math.max(1e-6, k.r);
  return u > 1 ? Infinity : kjegleMedKrater(k, u);
}

// Lyset kommer fra øvre venstre og litt forfra (x mot høyre, opp, z bakover). I en blokk ser vi bare den bakre
// halvdelen av kjegla (flanken mot høyre), så der kommer lyset mer ovenfra, ellers blir hele flanken liggende i skygge.
const LYS3: V3 = norm3([-0.55, 0.75, -0.35]);
const LYS_BLOKK: V3 = norm3([-0.3, 0.9, -0.3]);

interface Strimmel {
  d: string;
  fill: string;
  f: number;
}

/** Punktet på kjegleflaten ved andelen u av radien og vinkelen phi (0 = høyre, π/2 = rett bakover). */
function kjeglePunkt(k: Kjegle, u: number, phi: number, ox: number, oy: number, terreng?: (x: number) => number): P {
  const rz = k.rz ?? k.r;
  const ex = u * k.r * Math.cos(phi);
  const ez = u * rz * Math.sin(phi);
  let y = kjegleY(k, u);
  if (terreng) y = Math.min(y, terreng(k.x + ex));
  return [k.x + ex + ez * ox, y - ez * oy];
}

/** Lys (−1 til 1) på kjegleflaten ved u og phi: Lambert med lyset fra øvre venstre. */
function kjegleLys(k: Kjegle, u: number, phi: number, lys: V3 = LYS3): number {
  const du = 0.02;
  const m = (kjegleY(k, Math.min(1, u + du)) - kjegleY(k, Math.max(0, u - du))) / (2 * du * Math.max(1e-6, k.r));
  const n = norm3([m * Math.cos(phi), 1, m * Math.sin(phi)]);
  return dot3(n, lys);
}

function lysFarge(base: string, b: number): string {
  const q = Math.round(b * 20) / 20;
  return q >= 0.5 ? tint(base, Math.min(0.38, (q - 0.5) * 0.85)) : shade(base, Math.min(0.36, (0.5 - q) * 0.48));
}

function kjegleBase(k: Kjegle, hoydeAndel: number): string {
  if (k.sno !== null && k.sno !== undefined && hoydeAndel > k.sno) return SCENE.snow;
  if (k.vann !== null && k.vann !== undefined && k.fot - hoydeAndel * (k.fot - k.topp) > k.vann) return mix(k.farge, HAVBUNN, 0.55);
  if (k.gront !== null && k.gront !== undefined && hoydeAndel < k.gront) return mix(k.farge, SCENE.grass, hoydeAndel < k.gront * 0.5 ? 0.42 : 0.25);
  return k.farge;
}

/**
 * Flaten til kjegla som strimler (fra det bakerste til det nærmeste), mellom vinklene phi0 og phi1. Med `vann` bare
 * delen over vannflaten (øyer). `terreng` gir bakken under foten, så kjegla står på et skrått terreng.
 */
function kjegleStrimler(
  k: Kjegle,
  ox: number,
  oy: number,
  phi0: number,
  phi1: number,
  terreng?: (x: number) => number,
  vann?: number | null,
  lys: V3 = LYS3,
): Strimmel[] {
  const H = k.fot - k.topp;
  if (!(H > 0) || !(k.r > 0)) return [];
  const u0 = k.krater ? k.krater.u : 0;
  let uMaks = 1;
  if (vann !== null && vann !== undefined) {
    if (kjegleY(k, u0) >= vann) return [];
    if (kjegleY(k, 1) >= vann) {
      let lo = u0;
      let hi = 1;
      for (let i = 0; i < 30; i++) {
        const m = (lo + hi) / 2;
        if (kjegleY(k, m) < vann) lo = m;
        else hi = m;
      }
      uMaks = lo;
    }
  }
  const nPhi = Math.max(6, Math.round(Math.abs(phi1 - phi0) / (Math.PI / 20)));
  const phis = linspace(phi0, phi1, nPhi);
  const knekk = [0, 0.14, 0.3, 0.5, 0.75, 1].map((t) => u0 + (uMaks - u0) * t);
  const ut: Strimmel[] = [];
  for (let i = 0; i < phis.length - 1; i++) {
    const pa = phis[i]!;
    const pb = phis[i + 1]!;
    const pm = (pa + pb) / 2;
    for (let j = 0; j < knekk.length - 1; j++) {
      const ua = knekk[j]!;
      const ub = knekk[j + 1]!;
      const us = linspace(ua, ub, 3);
      const sida: P[] = us.map((u) => kjeglePunkt(k, u, pa, ox, oy, terreng));
      const sidb: P[] = us.map((u) => kjeglePunkt(k, u, pb, ox, oy, terreng)).reverse();
      // Skjørt ned til terrenget der foten står høyere enn bakken (bare på land)
      if (j === knekk.length - 2 && uMaks === 1 && terreng && (vann === null || vann === undefined)) {
        const skjort = (phi: number): P | null => {
          const ex = k.r * Math.cos(phi);
          const ez = (k.rz ?? k.r) * Math.sin(phi);
          const yt = terreng(k.x + ex);
          return yt > kjegleY(k, 1) + 0.5 ? [k.x + ex + ez * ox, yt - ez * oy] : null;
        };
        const sa = skjort(pa);
        const sb = skjort(pb);
        if (sa) sida.push(sa);
        if (sb) sidb.unshift(sb);
      }
      const um = (ua + ub) / 2;
      const ym = kjegleY(k, um);
      const base = kjegleBase(k, (k.fot - ym) / H);
      ut.push({ d: sti([...sida, ...sidb], true), fill: lysFarge(base, kjegleLys(k, um, pm, lys)), f: -ox * Math.cos(pm) + Math.sin(pm) });
    }
  }
  return ut.sort((a, b) => b.f - a.f);
}

/** Kraterkanten (som polygon) mellom phi0 og phi1, og kraterbunnen. Null uten krater. */
function kraterFlater(k: Kjegle, ox: number, oy: number, phi0: number, phi1: number): { kant: P[]; bunn: P[] } | null {
  const kr = k.krater;
  if (!kr) return null;
  const rz = k.rz ?? k.r;
  const yk = kjegleY(k, kr.u);
  const ring = (u: number, y: number): P[] =>
    linspace(phi0, phi1, 28).map((phi): P => [k.x + u * k.r * Math.cos(phi) + u * rz * Math.sin(phi) * ox, y - u * rz * Math.sin(phi) * oy]);
  return { kant: ring(kr.u, yk), bunn: ring(kr.u * 0.55, yk + kr.dyp * 0.75) };
}

/** Ravinene på flanken (synlige deler): en mørk renne og en lys rygg ved siden av, med ulik lengde. */
function kjegleRaviner(k: Kjegle, ox: number, oy: number, phi0: number, phi1: number, antall: number, terreng?: (x: number) => number): { renne: string; rygg: string }[] {
  const u0 = (k.krater ? k.krater.u : 0) + 0.06;
  const rnd = sceneRandom((k.seed ?? 1) * 31 + 7);
  const ut: { renne: string; rygg: string }[] = [];
  for (let i = 0; i < antall; i++) {
    const phi = phi0 + ((i + 0.5 + (rnd() - 0.5) * 0.7) / antall) * (phi1 - phi0);
    const start = u0 + rnd() * 0.12;
    const slutt = 0.55 + rnd() * 0.38;
    const renne: P[] = [];
    const rygg: P[] = [];
    let synlig = 0;
    const us = linspace(start, slutt, 8);
    for (const u of us) {
      const du = 0.02;
      const m = (kjegleY(k, Math.min(1, u + du)) - kjegleY(k, Math.max(0, u - du))) / (2 * du * Math.max(1e-6, k.r));
      if (m * Math.cos(phi) * ox + oy - m * Math.sin(phi) > 0.02) synlig++;
      const w = 0.03 * Math.sin(u * 9 + i * 1.3) * (1 + (k.ru ?? 0));
      renne.push(kjeglePunkt(k, u, phi + w, ox, oy, terreng));
      rygg.push(kjeglePunkt(k, u, phi + w - 0.035 / Math.max(0.2, u), ox, oy, terreng));
    }
    if (synlig >= us.length - 1) ut.push({ renne: glattSti(renne), rygg: glattSti(rygg) });
  }
  return ut;
}

/** Ett bånd på sideflaten til en blokk (fra y0 til y1 ved x = w). */
interface SideBand {
  y0: number;
  y1: number;
  fill: string;
  line?: string;
}

interface BlokkProps {
  w: number;
  h: number;
  /** Forskyvningen av bakkanten og dybden den svarer til (for kjeglene). */
  dx: number;
  dy: number;
  dybde: number;
  /** Bakken (y) ved x, uten kjeglene. Toppflaten er denne profilen trukket bakover. */
  profil: (x: number) => number;
  /** Toppen av snittet foran (bakken med kjeglene). */
  frontTopp: (x: number) => number;
  /** Havnivået (y) eller null. */
  hav: number | null;
  /** Fargen på toppflaten ved x og høyden y (før lys og skygge). */
  toppFarge: (x: number, y: number) => string;
  /** Lys og skygge per firkant på toppflaten etter helningen (standard på). Av for flate bånd, som magnetiske striper. */
  toppSkygge?: boolean;
  /** Toppflaten bakover (standard `profil`): en glattere kurve gir en nesten flat havbunn med bølgene bare i snittet foran. */
  toppProfil?: (x: number) => number;
  /** Båndene på sideflaten (ved x = w), ovenfra og ned. */
  side: readonly SideBand[];
  kjegler: readonly Kjegle[];
  /** Innholdet i snittet foran (klippes til berget under frontTopp). */
  front: ReactNode;
  /** Tegnes på toppflaten etter kjeglene (lavastrømmer), før sideflaten og snittet foran. */
  overflate?: ReactNode;
  /** Hvor dekkende vannflaten er (standard 0,6; lavere når havbunnen skal synes). */
  vannAlfa?: number;
  /** Tegnes oppå snittet uten klipping (piler, skjelv, etiketter). */
  frontFri?: ReactNode;
  skygge?: boolean;
}

/**
 * Blokkdiagram i svakt perspektiv: toppflaten (profilen trukket bakover, med lys og skygge etter helningen),
 * vannflaten (halvgjennomsiktig over havbunnen), kjeglene ved frontkanten, sideflaten til høyre i skygge og snittet
 * foran med lys ovenfra. Samme stil som Snittblokk. Lokale koordinater: (0, 0) er øverste venstre hjørne av snittet.
 */
function Blokk({ w, h, dx, dy, dybde, profil, toppProfil, frontTopp, hav, toppFarge, toppSkygge = true, side, kjegler, front, overflate, frontFri, skygge = true, vannAlfa = 0.6 }: BlokkProps) {
  const s = useGeoStroke();
  const uid = useSvgId('blokk');
  const persp = dx > 0.5 && dy > 0.5 && dybde > 0;
  const ox = persp ? dx / dybde : 0;
  const oy = persp ? dy / dybde : 0;
  const nx = Math.max(40, Math.min(360, Math.ceil(w / 4)));
  const xs = linspace(0, w, nx);
  const bakke: P[] = xs.map((x): P => [x, (toppProfil ?? profil)(x)]);
  const ftXs = [...xs, ...kjegler.flatMap((k) => linspace(k.x - k.r, k.x + k.r, 48).filter((x) => x > 0 && x < w))].sort((a, b) => a - b);
  const ft: P[] = ftXs.map((x): P => [x, frontTopp(x)]);
  const rockSti = sti([...ft, [w, h], [0, h]], true);

  // Toppflaten som firkanter fra venstre mot høyre; de som vender bort (bratte bakker mot høyre), tegnes først.
  const quads = bakke.slice(0, -1).map((a, i) => {
    const b = bakke[i + 1]!;
    const ddx = b[0] - a[0];
    const ddy = b[1] - a[1];
    const bak = ddx * -dy - ddy * dx > 0;
    const xm = (a[0] + b[0]) / 2;
    const ym = (a[1] + b[1]) / 2;
    const under = hav !== null && ym > hav;
    const q = toppSkygge ? Math.round(klemme((-ddy / (ddx || 1)) * 1.6, -1, 1) * 10) / 10 : 0;
    const base = toppFarge(xm, ym);
    const fill = q > 0 ? tint(base, 0.13 * q) : q < 0 ? shade(base, 0.15 * -q) : base;
    return {
      d: sti([a, b, [b[0] + dx, b[1] - dy], [a[0] + dx, a[1] - dy]], true),
      kant: sti([
        [a[0] + dx, a[1] - dy],
        [b[0] + dx, b[1] - dy],
      ]),
      fill,
      under,
      bak,
    };
  });
  const tegnQuad = (q: (typeof quads)[number], i: number) => (
    <g key={i}>
      <path d={q.d} fill={q.fill} stroke={q.fill} strokeWidth={0.7} strokeLinejoin="round" />
      <path d={q.kant} fill="none" stroke={SCENE.outline} strokeWidth={1.1 * s} strokeLinecap="round" />
    </g>
  );

  // Vannflaten: der bakken ligger under havnivået
  const vannLop: [number, number][] = [];
  if (hav !== null) {
    let start: number | null = null;
    for (let i = 0; i < bakke.length; i++) {
      const [x, y] = bakke[i]!;
      const under = y > hav;
      if (under && start === null) {
        const forrige = bakke[i - 1];
        start = forrige ? forrige[0] + ((hav - forrige[1]) / (y - forrige[1] || 1)) * (x - forrige[0]) : x;
      }
      if (!under && start !== null) {
        const forrige = bakke[i - 1]!;
        vannLop.push([start, forrige[0] + ((hav - forrige[1]) / (y - forrige[1] || 1)) * (x - forrige[0])]);
        start = null;
      }
    }
    if (start !== null) vannLop.push([start, w]);
  }
  const frontVann: P[][] = hav === null ? [] : baand(0, w, () => hav, (x) => frontTopp(x), 2);

  const iVann = (k: Kjegle) => hav !== null && k.fot > hav;
  // Kjegler som stikker ut over venstre kant av blokka, klippes langs kanten (forkant og den skrå kanten bakover)
  const p0 = bakke[0]![1];
  const venstreKlipp = sti(
    [
      [0, h + 20],
      [0, p0],
      [dx, p0 - dy],
      [dx, -10 * h],
      [w * 3, -10 * h],
      [w * 3, h + 20],
    ],
    true,
  );
  const tegnKjegle = (k: Kjegle, i: number, vann: number | null) => {
    const strimler = kjegleStrimler(k, ox, oy, 0, Math.PI, profil, vann, LYS_BLOKK);
    if (strimler.length === 0) return null;
    const krater = kraterFlater(k, ox, oy, 0, Math.PI);
    const raviner = k.form === 'strato' && k.r > 25 ? kjegleRaviner(k, ox, oy, 0.15, Math.PI - 0.15, 5 + Math.round((k.ru ?? 0) * 6), profil) : [];
    const fot = vann === null ? linspace(0, Math.PI, 36).map((phi) => kjeglePunkt(k, 1, phi, ox, oy, profil)) : null;
    return (
      <g key={i}>
        {strimler.map((st, j) => (
          <path key={j} d={st.d} fill={st.fill} stroke={st.fill} strokeWidth={0.6} strokeLinejoin="round" />
        ))}
        {fot && <path d={sti(fot)} fill="none" stroke={shade(k.farge, 0.45)} strokeWidth={1 * s} opacity={0.55} />}
        {raviner.map((r, j) => (
          <g key={`r${j}`} fill="none" strokeLinecap="round">
            <path d={r.rygg} stroke={tint(k.farge, 0.35)} strokeWidth={0.9 * s} opacity={0.35} />
            <path d={r.renne} stroke={shade(k.farge, 0.35)} strokeWidth={0.9 * s} opacity={0.4} />
          </g>
        ))}
        {krater && (
          <g>
            <path d={sti(krater.kant, true)} fill={shade(k.farge, 0.38)} />
            <path d={sti(krater.bunn, true)} fill={k.glo ? mix(GEO.lava.fill, GEO.magma.fill, 0.12) : shade(k.farge, 0.55)} opacity={k.glo ? 0.6 + 0.4 * k.glo : 1} />
            <path d={sti(krater.kant)} fill="none" stroke={tint(k.farge, 0.15)} strokeWidth={0.9 * s} />
          </g>
        )}
      </g>
    );
  };

  const sidetopp = side[0]?.y0 ?? profil(w);
  return (
    <g>
      <defs>
        <clipPath id={`${uid}-berg`}>
          <path d={rockSti} />
        </clipPath>
        <clipPath id={`${uid}-kjegler`}>
          <path d={venstreKlipp} />
        </clipPath>
      </defs>
      <LinearGradient
        id={`${uid}-lys`}
        x2={0.3}
        y2={1}
        stops={[
          [0, SCENE.highlight, 0.42],
          [0.4, SCENE.highlight, 0],
          [1, SCENE.shadow, 0.55],
        ]}
      />
      <LinearGradient
        id={`${uid}-vann`}
        stops={[
          [0, SCENE.water],
          [0.6, SCENE.waterDeep],
          [1, shade(SCENE.waterDeep, 0.3)],
        ]}
      />
      {skygge && <ContactShadow cx={(w + dx) / 2} cy={h - dy / 2 + 3} rx={(w + dx) / 2 + 8} ry={Math.max(6, dy / 2 + 7)} opacity={0.7} />}

      {persp && (
        <g>
          {quads.filter((q) => q.bak).map(tegnQuad)}
          {quads.filter((q) => !q.bak && q.under).map(tegnQuad)}
          <g clipPath={`url(#${uid}-kjegler)`}>{kjegler.map((k, i) => (iVann(k) ? tegnKjegle(k, i, null) : null))}</g>
          {vannLop.map(([a, b], i) =>
            hav === null ? null : (
              <g key={`v${i}`}>
                <path
                  d={sti(
                    [
                      [a, hav],
                      [b, hav],
                      [b + dx, hav - dy],
                      [a + dx, hav - dy],
                    ],
                    true,
                  )}
                  fill={alpha(mix(SCENE.water, SCENE.waterLight, 0.3), vannAlfa)}
                />
                {b - a > 40 &&
                  [0.3, 0.62].map((t, j) => (
                    <line
                      key={j}
                      x1={r2(a + t * dx + (b - a) * (0.12 + 0.1 * j))}
                      y1={r2(hav - t * dy)}
                      x2={r2(b + t * dx - (b - a) * (0.18 + 0.08 * j))}
                      y2={r2(hav - t * dy)}
                      stroke={SCENE.highlight}
                      strokeWidth={1.3 * s}
                      strokeLinecap="round"
                      opacity={0.8 - 0.25 * j}
                    />
                  ))}
                <path
                  d={sti([
                    [a, hav],
                    [a + dx, hav - dy],
                    [b + dx, hav - dy],
                  ])}
                  fill="none"
                  stroke={SCENE.outline}
                  strokeWidth={1 * s}
                  opacity={0.6}
                />
              </g>
            ),
          )}
          {quads.filter((q) => !q.bak && !q.under).map(tegnQuad)}
          <g clipPath={`url(#${uid}-kjegler)`}>{kjegler.map((k, i) => tegnKjegle(k, i + 1000, iVann(k) ? hav : null))}</g>
          {overflate}
          <path
            d={sti([
              [0, bakke[0]![1]],
              [dx, bakke[0]![1] - dy],
            ])}
            fill="none"
            stroke={SCENE.outline}
            strokeWidth={1.1 * s}
          />
          <g transform={`matrix(${r2(dx / 100)} ${r2(-dy / 100)} 0 1 ${r2(w)} 0)`}>
            {side.map((b, i) => (
              <rect key={i} x={0} y={r2(b.y0)} width={100} height={r2(Math.max(0, b.y1 - b.y0))} fill={b.fill} stroke={b.fill} strokeWidth={0.6} />
            ))}
            <rect x={0} y={r2(sidetopp)} width={100} height={r2(Math.max(0, h - sidetopp))} fill={SCENE.shadow} opacity={0.62} />
            {side.slice(1).map((b, i) => (
              <line key={`l${i}`} x1={0} x2={100} y1={r2(b.y0)} y2={r2(b.y0)} stroke={b.line ?? SCENE.outline} strokeWidth={0.9 * s} opacity={0.8} />
            ))}
          </g>
        </g>
      )}

      {frontVann.map((p, i) => (
        <g key={`fv${i}`}>
          <path d={sti(p, true)} fill={`url(#${uid}-vann)`} />
        </g>
      ))}
      {hav !== null &&
        vannLop.map(([a, b], i) => <line key={`vl${i}`} x1={r2(a)} x2={r2(b)} y1={r2(hav)} y2={r2(hav)} stroke={SCENE.waterLight} strokeWidth={1.5 * s} />)}
      <g clipPath={`url(#${uid}-berg)`}>{front}</g>
      <path d={rockSti} fill={`url(#${uid}-lys)`} />
      <g fill="none" stroke={SCENE.outline} strokeWidth={1.2 * s} strokeLinejoin="round" strokeLinecap="round">
        <path d={`M0 ${r2(Math.min(ft[0]![1], hav ?? Infinity))}L0 ${r2(h)}L${r2(w)} ${r2(h)}L${r2(w)} ${r2(Math.min(ft[ft.length - 1]![1], hav ?? Infinity))}`} />
        {persp && <path d={`M${r2(w)} ${r2(sidetopp)}l${r2(dx)} ${r2(-dy)}V${r2(h - dy)}L${r2(w)} ${r2(h)}`} />}
        <path d={sti(ft)} strokeWidth={0.9 * s} opacity={0.75} />
      </g>
      {frontFri}
    </g>
  );
}

/* =====================================================================================================================
 * Plategrenser: modellene (ren geometri)
 * ================================================================================================================== */

/** Typen plategrense. `transform` tegnes som kart ovenfra; de andre som blokkdiagram. */
export type PlategrenseType = 'spredning' | 'subduksjon' | 'kollisjon' | 'transform' | 'varmt-punkt';

/** Hvilke plater som møtes i en subduksjonssone. */
export type SubduksjonVariant = 'hav-kontinent' | 'hav-hav';

/**
 * Navnene på ankerpunktene i `plategrenseGeometri` (hvilke som finnes, avhenger av typen):
 * - spredning: rygg, magmakammer, smeltesone, plateVenstre, plateHoyre, ryggskyvVenstre, ryggskyvHoyre, astenosfare
 * - subduksjon: grop, vulkan, magmakammer, smeltesone, mantelkile, platetrekk, skjelvsone, akkresjonskile, havplate,
 *   overplate, astenosfare
 * - kollisjon: sutur, fjelltopp, fjellrot, plateVenstre, plateHoyre, astenosfare
 * - transform: forkastning, ryggNord, ryggSor, bruddsoneVenstre, bruddsoneHoyre, plateVenstre, plateHoyre
 * - varmt-punkt: varmtPunkt, mantelplume, vulkan, eldreVulkan, magmakammer, plateVenstre, astenosfare
 */
export type PlateAnkerNavn =
  | 'rygg'
  | 'magmakammer'
  | 'smeltesone'
  | 'plateVenstre'
  | 'plateHoyre'
  | 'ryggskyvVenstre'
  | 'ryggskyvHoyre'
  | 'astenosfare'
  | 'grop'
  | 'vulkan'
  | 'mantelkile'
  | 'platetrekk'
  | 'skjelvsone'
  | 'akkresjonskile'
  | 'havplate'
  | 'overplate'
  | 'sutur'
  | 'fjelltopp'
  | 'fjellrot'
  | 'forkastning'
  | 'ryggNord'
  | 'ryggSor'
  | 'bruddsoneVenstre'
  | 'bruddsoneHoyre'
  | 'varmtPunkt'
  | 'mantelplume'
  | 'eldreVulkan';

/**
 * Navnene på kraftankrene i `plategrenseGeometri(…).kraftankre` (hvilke som finnes, avhenger av typen):
 * - spredning: ryggskyvVenstre, ryggskyvHoyre, plateVenstre, plateHoyre
 * - subduksjon: platetrekk, havplate
 * - kollisjon: kollisjonVenstre, kollisjonHoyre
 * - varmt-punkt: plateVenstre
 * - transform: plateVenstre, plateHoyre
 */
export type KraftAnkerNavn =
  | 'ryggskyvVenstre'
  | 'ryggskyvHoyre'
  | 'plateVenstre'
  | 'plateHoyre'
  | 'platetrekk'
  | 'havplate'
  | 'kollisjonVenstre'
  | 'kollisjonHoyre';

/** En rektangulær flate i figurens koordinater som noe allerede står i (tekst, pil). */
export interface PlateBoks {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  /** Hva som står der: 'lagnavn' (Litosfære …) eller 'fart' (fartspil med tekst). */
  hva: 'lagnavn' | 'fart';
}

/** Et ankerpunkt i figurens koordinater, med en retning (enhetsvektor) der en kraftpil naturlig peker. */
export interface PlateAnker {
  x: number;
  y: number;
  /** Retningen til platetrekket (ned langs plata), ryggskyvet (ned skråningen bort fra ryggen) eller platebevegelsen. */
  retning?: readonly [number, number];
}

/**
 * Standard relativ fart mellom platene (cm per år) for hver type: omtrentlige, typiske verdier i samme
 * størrelsesorden som platemodellen MORVEL (DeMets mfl. 2010). Den midtatlantiske ryggen sprer seg med 2–3 cm per
 * år og Øst-Stillehavsryggen med opptil 15, Nazcaplata går inn under Sør-Amerika med omtrent 7, India skyver mot
 * Eurasia med 4–5, og Stillehavsplata flytter seg over det varme punktet under Hawaii med 7–10 cm per år.
 */
export const PLATE_FART: Readonly<Record<PlategrenseType, number>> = {
  spredning: 4,
  subduksjon: 7,
  kollisjon: 4,
  transform: 4,
  'varmt-punkt': 8,
};

/**
 * Standard bredde på figuren i km (vannrett målestokk; loddrett er ikke i målestokk), valgt så stripene, vulkankjeden
 * og avstanden fra grøfta til vulkanene (ca. 200–300 km) får en lesbar størrelse.
 */
export const PLATE_BREDDE_KM: Readonly<Record<PlategrenseType, number>> = {
  spredning: 400,
  subduksjon: 900,
  kollisjon: 1000,
  transform: 400,
  'varmt-punkt': 1200,
};

type Fyll = 'kontinent' | 'kontinentB' | 'havskorpe' | 'litosfare' | 'astenosfare' | 'normal' | 'omvendt' | 'sediment';

interface Ellipse {
  x: number;
  y: number;
  rx: number;
  ry: number;
}

interface PlateKjegle extends Kjegle {
  /** Aktiv vulkan (glød og kanal opp fra magmakammeret). */
  aktiv: boolean;
}

interface PlateModell {
  hav: number | null;
  profil: (x: number) => number;
  /** Toppflaten bakover når den skal være glattere enn snittet foran (spredning med striper). */
  toppProfil?: (x: number) => number;
  kjegler: PlateKjegle[];
  flater: { p: P[]; fyll: Fyll }[];
  plume: P[] | null;
  smelte: P[][];
  kamre: Ellipse[];
  kanaler: { p: P[]; b: number }[];
  diapirer: Ellipse[];
  vaeske: [P, P][];
  linjer: { p: P[]; type: 'sutur' | 'skyvning' | 'fold' }[];
  foldKlipp: P[][];
  skjelv: P[];
  strom: P[][];
  farter: { x: number; y: number; retning: 1 | -1; fart: number }[];
  side: { y0: number; y1: number; fyll: Fyll | 'vann' }[];
  /** Fargen på toppflaten ved x og høyden y. */
  topp: (x: number, y: number) => string;
  ankere: Partial<Record<PlateAnkerNavn, PlateAnker>>;
  /** Kandidater til kraftankrene, i prioritert rekkefølge (den første som er fri for tekst og fartspiler velges). */
  kraft: Partial<Record<KraftAnkerNavn, PlateAnker[]>>;
  lagTekster: { x: number; y: number; tekst: string; anchor?: 'start' | 'middle' | 'end' }[];
  overTekster: { x: number; y: number; tekst: string }[];
  aldre: { x: number; y: number; alder: number; aktiv: boolean }[];
}

interface ModellInn {
  w: number;
  h: number;
  fart: number;
  t: number;
  kmPerPx: number;
  striper: boolean;
  variant: SubduksjonVariant;
  dybde: number;
}

/** Flankene på en stratovulkan (andesitt, gråbrun) og en skjoldvulkan (mørk basalt); mørkere i mørkt tema (skumring). */
const VULKAN_STRATO = mix(mix(GEO.aske.fill, SCENE.stoneDark, 0.5), GEO.skorpeKontinent.fill, 0.18);
const VULKAN_SKJOLD = shade(mix(GEO.bergart.basalt.fill, SCENE.stoneDark, 0.5), 0.18);
/** Havbunnen sett gjennom vannet (leire over basalt). */
const HAVBUNN = mix(GEO.bergart.leire.fill, GEO.skorpeHav.fill, 0.45);
const q10 = (v: number): number => Math.round(klemme(v, 0, 1) * 10) / 10;

/** Fargen på land etter høyden over havet (andel av h): gress i lavlandet, fjell høyere opp og snø over `sno`. */
function landFarge(el: number, sno: number, hav = true): string {
  if (el < 0 && hav) return HAVBUNN;
  const base = mix(SCENE.grass, SCENE.stone, q10(trinn(0.025, 0.09, el)));
  const t = q10(trinn(sno, sno + 0.018, el));
  return t > 0 ? mix(base, SCENE.snow, t) : base;
}

/** Fjerner løkker i en forskjøvet kurve (der x går bakover i en skarp bøy) og glatter knekken. */
function rensKurve(p: readonly P[], glatt = 6): P[] {
  const mono: P[] = [];
  for (const q of p) if (mono.length === 0 || q[0] > mono[mono.length - 1]![0] + 0.01) mono.push(q);
  if (glatt <= 0 || mono.length < 3) return mono;
  return mono.map((q, i) => {
    if (i === 0 || i === mono.length - 1) return q;
    let sx = 0;
    let sy = 0;
    let n = 0;
    for (let j = Math.max(0, i - glatt); j <= Math.min(mono.length - 1, i + glatt); j++) {
      sx += mono[j]![0];
      sy += mono[j]![1];
      n++;
    }
    return [sx / n, sy / n];
  });
}

function tomModell(): PlateModell {
  return {
    hav: null,
    profil: () => 0,
    kjegler: [],
    flater: [],
    plume: null,
    smelte: [],
    kamre: [],
    kanaler: [],
    diapirer: [],
    vaeske: [],
    linjer: [],
    foldKlipp: [],
    skjelv: [],
    strom: [],
    farter: [],
    side: [],
    topp: () => HAVBUNN,
    ankere: {},
    kraft: {},
    lagTekster: [],
    overTekster: [],
    aldre: [],
  };
}

/** Sidebånd fra en liste [y0, y1, fyll], klippet til 0–h og sortert ovenfra. */
function sidebaand(h: number, liste: [number, number, Fyll | 'vann'][]): PlateModell['side'] {
  return liste
    .map(([a, b, fyll]) => ({ y0: klemme(a, -h, h), y1: klemme(b, -h, h), fyll }))
    .filter((b) => Number.isFinite(b.y0) && Number.isFinite(b.y1) && b.y1 > b.y0 + 0.2)
    .sort((a, b) => a.y0 - b.y0);
}

/** Retningen nedover langs en kurve y(x) ved x, mot venstre (−1) eller høyre (1). */
function nedover(f: (x: number) => number, x: number, mot: 1 | -1): [number, number] {
  const d = 1;
  const dyv = f(x + mot * d) - f(x);
  const n = Math.hypot(d, dyv) || 1;
  return [r2((mot * d) / n), r2(dyv / n)];
}

/** Bølger på havbunnen (åsrygger parallelt med ryggen) som flytter seg med plata. */
const bolger = (x: number, forsk: number, lam: number): number => Math.sin((2 * Math.PI * (x - forsk)) / lam);

function modellSpredning(m: ModellInn): PlateModell {
  const { w, h, fart, t, kmPerPx } = m;
  const mod = tomModell();
  const xr = w / 2;
  const ys = 0.2 * h;
  const tc = 0.045 * h;
  const pxPerMa = (10 * fart) / kmPerPx;
  const forsk = (pxPerMa / 2) * t;
  const langsom = fart < 5;
  const lam = Math.max(12, 0.045 * w);
  // Havbunnen synker med alderen (omtrent som √alder): u = alder / 10 millioner år (alderen ved kanten med
  // standardverdiene, 200 km ved 4 cm/år). En rask rygg blir bred og slak, en langsom smal og bratt.
  const alderU = (a: number) => Math.min(1, (a * kmPerPx) / (5 * Math.max(0.5, fart)) / 10);
  const glattBunn = (x: number) => {
    const a = Math.abs(x - xr);
    const u = alderU(a);
    let y = ys + h * (0.05 + 0.075 * Math.sqrt(u));
    if (langsom) y += h * 0.03 * klokke(a, 0, 0.018 * w) - h * 0.014 * klokke(a, 0.045 * w, 0.022 * w);
    else y -= h * 0.01 * klokke(a, 0, 0.05 * w);
    return y;
  };
  const bunn = (x: number) => {
    const a = Math.abs(x - xr);
    return glattBunn(x) + h * 0.008 * trinn(0.03 * w, 0.1 * w, a) * bolger(a, forsk, lam);
  };
  const skorpeBunn = (x: number) => glattBunn(x) + tc;
  const litoBunn = (x: number) => glattBunn(x) + tc + h * (0.012 + 0.28 * Math.sqrt(alderU(Math.abs(x - xr))));
  const ysol = 0.54 * h;
  mod.hav = ys;
  mod.profil = bunn;
  // Med striper ligger havbunnen nesten flat bakover, så stripene ser ut som bånd på bunnen (bølgene bare foran)
  if (m.striper) mod.toppProfil = glattBunn;

  // Grunne skjelv (under ca. 10 km) i den tynne, sprø skorpa langs ryggaksen, der platene revner og sprekker opp
  {
    const rnd = sceneRandom(17);
    for (let i = 0; i < 9; i++) {
      const x = xr + (rnd() - 0.5) * 0.11 * w;
      const a = bunn(x) + 0.012 * h;
      const b = skorpeBunn(x) + 0.018 * h;
      if (b > a) mod.skjelv.push([x, a + rnd() * (b - a)]);
    }
  }

  // Skorpa, med magnetiske striper der den er dannet etter start
  const striper = m.striper ? magnetiskeStriper(fart, t) : [];
  const ytterst = striper.length > 0 ? striper[striper.length - 1]!.til / kmPerPx : 0;
  const stripeVed = (x: number): 'normal' | 'omvendt' | null => {
    const a = Math.abs(x - xr) * kmPerPx;
    const st = striper.find((p) => a >= p.fra && a < p.til);
    return st ? (st.normal ? 'normal' : 'omvendt') : null;
  };
  mod.flater.push({ p: [[0, 0], [w, 0], [w, h], [0, h]], fyll: 'astenosfare' });
  for (const p of baand(0, w, skorpeBunn, litoBunn, 3)) mod.flater.push({ p, fyll: 'litosfare' });
  if (striper.length === 0) for (const p of baand(0, w, bunn, skorpeBunn, 2)) mod.flater.push({ p, fyll: 'havskorpe' });
  else {
    for (const [a, b] of [
      [0, xr - ytterst],
      [xr + ytterst, w],
    ] as const)
      if (b > a) for (const p of baand(Math.max(0, a), Math.min(w, b), bunn, skorpeBunn, 2)) mod.flater.push({ p, fyll: 'havskorpe' });
    for (const st of striper) {
      const a = st.fra / kmPerPx;
      const b = st.til / kmPerPx;
      for (const [x0, x1] of [
        [xr + a, xr + b],
        [xr - b, xr - a],
      ] as const) {
        const lo = Math.max(0, x0);
        const hi = Math.min(w, x1);
        if (hi > lo) for (const p of baand(lo, hi, bunn, skorpeBunn, 2)) mod.flater.push({ p, fyll: st.normal ? 'normal' : 'omvendt' });
      }
    }
  }
  mod.topp = (x) => {
    const st = stripeVed(x);
    // Stripene ligger flatt på havbunnen og skimtes gjennom vannet: litt dempet mot havbunnsfargen
    return st === 'normal' ? mix(GEO.polaritet.normal.fill, HAVBUNN, 0.25) : st === 'omvendt' ? mix(GEO.polaritet.omvendt.fill, HAVBUNN, 0.25) : HAVBUNN;
  };

  // Smelting ved trykkavlastning: mellom litosfærens underside og dypet der mantelen begynner å smelte
  mod.smelte = baand(0, w, litoBunn, () => ysol, 3);
  const kammer: Ellipse = { x: xr, y: glattBunn(xr) + tc * 0.62, rx: 0.024 * w, ry: 0.011 * h };
  mod.kamre.push(kammer);
  mod.kanaler.push({ p: [[xr, kammer.y - kammer.ry * 0.5], [xr, bunn(xr) + 0.5]], b: Math.max(2.5, 0.006 * w) });
  for (const sgn of [1, -1]) {
    const X = (d: number) => xr + sgn * d * w;
    mod.strom.push([[X(0.025), 0.985 * h], [X(0.045), 0.8 * h], [X(0.14), 0.675 * h], [X(0.29), 0.705 * h]]);
    mod.strom.push([[X(0.085), 0.985 * h], [X(0.12), 0.885 * h], [X(0.28), 0.825 * h], [X(0.43), 0.845 * h]]);
    const xp = X(0.3);
    mod.farter.push({ x: xp, y: skorpeBunn(xp) + 0.38 * (litoBunn(xp) - skorpeBunn(xp)), retning: sgn === 1 ? 1 : -1, fart: fart / 2 });
  }
  const xb = w;
  const kantFyll: Fyll = stripeVed(xb - 0.5) ?? 'havskorpe';
  mod.side = sidebaand(h, [
    [ys, bunn(xb), 'vann'],
    [bunn(xb), skorpeBunn(xb), kantFyll],
    [skorpeBunn(xb), litoBunn(xb), 'litosfare'],
    [litoBunn(xb), h, 'astenosfare'],
  ]);
  const midtLito = (x: number) => (skorpeBunn(x) + litoBunn(x)) / 2;
  mod.ankere = {
    rygg: { x: xr, y: bunn(xr) },
    magmakammer: { x: kammer.x, y: kammer.y },
    smeltesone: { x: xr, y: (litoBunn(xr) + ysol) / 2 + 0.03 * h },
    plateVenstre: { x: xr - 0.3 * w, y: midtLito(xr - 0.3 * w), retning: [-1, 0] },
    plateHoyre: { x: xr + 0.3 * w, y: midtLito(xr + 0.3 * w), retning: [1, 0] },
    ryggskyvVenstre: { x: xr - 0.14 * w, y: midtLito(xr - 0.14 * w), retning: nedover(litoBunn, xr - 0.14 * w, -1) },
    ryggskyvHoyre: { x: xr + 0.14 * w, y: midtLito(xr + 0.14 * w), retning: nedover(litoBunn, xr + 0.14 * w, 1) },
    astenosfare: { x: xr + 0.3 * w, y: 0.9 * h },
  };
  const iLito = (x: number, andel: number) => skorpeBunn(x) + andel * (litoBunn(x) - skorpeBunn(x));
  mod.kraft = {
    ryggskyvVenstre: [0.14, 0.12, 0.17, 0.1, 0.2].map((d) => ({ x: xr - d * w, y: midtLito(xr - d * w), retning: nedover(litoBunn, xr - d * w, -1) })),
    ryggskyvHoyre: [0.14, 0.12, 0.17, 0.1, 0.2].map((d) => ({ x: xr + d * w, y: midtLito(xr + d * w), retning: nedover(litoBunn, xr + d * w, 1) })),
    plateVenstre: [0.3, 0.36, 0.25, 0.42].flatMap((d) => [0.78, 0.9, 0.6].map((a) => ({ x: xr - d * w, y: iLito(xr - d * w, a), retning: [-1, 0] as const }))),
    plateHoyre: [0.3, 0.36, 0.25, 0.42].flatMap((d) => [0.78, 0.9, 0.6].map((a) => ({ x: xr + d * w, y: iLito(xr + d * w, a), retning: [1, 0] as const }))),
  };
  mod.lagTekster = [
    { x: 0.025 * w, y: litoBunn(0.025 * w) - 0.045 * h, tekst: 'Litosfære', anchor: 'start' },
    { x: 0.025 * w, y: 0.93 * h, tekst: 'Astenosfære', anchor: 'start' },
  ];
  mod.overTekster = [
    { x: xr, y: bunn(xr), tekst: 'Spredningsrygg' },
    { x: xr + 0.3 * w, y: bunn(xr + 0.3 * w) + tc / 2, tekst: 'Havbunnsskorpe' },
  ];
  return mod;
}

function modellSubduksjon(m: ModellInn): PlateModell {
  const { w, h, fart, t, kmPerPx, variant, dybde } = m;
  const mod = tomModell();
  const hh = variant === 'hav-hav';
  const ys = 0.2 * h;
  const tc = 0.045 * h;
  const L = (hh ? 0.24 : 0.26) * h;
  const xg = (hh ? 0.36 : 0.34) * w;
  const yAbyss = ys + 0.11 * h;
  const yT = ys + 0.2 * h;
  const pxPerMa = (10 * fart) / kmPerPx;
  const forsk = pxPerMa * t;
  const lam = Math.max(12, 0.045 * w);
  const havGlatt = (x: number) => yAbyss - 0.014 * h * klokke(x, xg - 0.12 * w, 0.05 * w) + (yT - yAbyss) * trinn(xg - 0.08 * w, xg, x);

  // Oversiden av havbunnsplata: havbunnen fram til grøfta, så bøyer plata ned (vinkelen øker til th1)
  const th1 = ((hh ? 50 : 35) * Math.PI) / 180;
  const bend = 0.24 * w;
  const steg = Math.max(0.5, w / 500);
  const sx: number[] = [];
  const sy: number[] = [];
  for (let x = -steg; x < xg; x += steg) {
    sx.push(x);
    sy.push(havGlatt(x));
  }
  {
    let x = xg;
    let y = yT;
    sx.push(x);
    sy.push(y);
    while (y < h * 1.7 && x < 3 * w) {
      x += steg;
      y += steg * Math.tan(th1 * trinn(0, bend, x - xg));
      sx.push(x);
      sy.push(y);
    }
  }
  const sist = sx[sx.length - 1]!;
  const slab = (x: number) => (x > sist ? Infinity : interp(sx, sy, x));
  const slabX = (y: number) => {
    for (let i = 0; i < sy.length; i++) if (sx[i]! >= xg && sy[i]! >= y) return sx[i]!;
    return sist;
  };
  // Normal inn i plata (nedover/bakover) for hvert punkt
  const T: P[] = sx.map((x, i): P => [x, sy[i]!]);
  const N: P[] = T.map((_, i) => {
    const a = T[Math.max(0, i - 1)]!;
    const b = T[Math.min(T.length - 1, i + 1)]!;
    const tx = b[0] - a[0];
    const ty = b[1] - a[1];
    const n = Math.hypot(tx, ty) || 1;
    return [-ty / n, tx / n];
  });
  const off = (d: number) => T.map((p, i): P => [p[0] + d * N[i]![0], p[1] + d * N[i]![1]]);
  const krusing = (x: number) => 0.007 * h * (1 - trinn(xg - 0.14 * w, xg - 0.06 * w, x)) * bolger(x, forsk, lam);
  const toppHav = T.map((p): P => [p[0], p[1] + (p[0] < xg ? krusing(p[0]) : 0)]);
  const skorpeBunn = rensKurve(off(tc), 3);
  const litoBunn = rensKurve(off(L), 10);
  mod.flater.push({ p: [[0, 0], [w, 0], [w, h], [0, h]], fyll: 'astenosfare' });
  mod.flater.push({ p: [...skorpeBunn, ...litoBunn.slice().reverse()], fyll: 'litosfare' });
  mod.flater.push({ p: [...toppHav, ...skorpeBunn.slice().reverse()], fyll: 'havskorpe' });

  const yMelt = (hh ? 0.6 : 0.66) * h;
  const xm = slabX(yMelt);
  const xv = xm;
  let topp: (x: number) => number;
  let kammer: Ellipse;
  let kjegle: PlateKjegle;
  if (!hh) {
    const e = (x: number) =>
      -0.2 * h +
      0.21 * h * trinn(xg, xg + 0.11 * w, x) +
      0.1 * h * klokke(x, xv, 0.075 * w) +
      0.05 * h * klokke(x, xv + 0.13 * w, 0.07 * w) +
      0.035 * h * trinn(xv, w, x) +
      0.007 * h * Math.sin(x / (0.011 * w)) * klokke(x, xv + 0.06 * w, 0.12 * w);
    topp = (x) => (x < xg ? Infinity : ys - e(x));
    const moho = (x: number) => ys + 0.17 * h + 0.1 * h * klokke(x, xv + 0.04 * w, 0.11 * w);
    const litoK = (x: number) => 0.56 * h + 0.03 * h * klokke(x, xv + 0.1 * w, 0.15 * w);
    for (const p of baand(xg, w, topp, (x) => Math.min(moho(x), slab(x)), 2)) mod.flater.push({ p, fyll: 'kontinent' });
    for (const p of baand(xg, w, moho, (x) => Math.min(litoK(x), slab(x)), 2)) mod.flater.push({ p, fyll: 'litosfare' });
    kammer = { x: xv, y: topp(xv) + 0.13 * h, rx: 0.034 * w, ry: 0.022 * h };
    kjegle = {
      x: xv,
      r: 0.065 * w,
      topp: topp(xv) - 0.12 * h,
      fot: topp(xv),
      form: 'strato',
      krater: { u: 0.09, dyp: 0.014 * h },
      farge: VULKAN_STRATO,
      sno: 0.72,
      aktiv: true,
      seed: 3,
    };
    mod.topp = (x, y) => (x < xg ? HAVBUNN : landFarge((ys - y) / h, 0.125));
    mod.ankere.overplate = { x: 0.88 * w, y: (topp(0.88 * w) + moho(0.88 * w)) / 2 };
    const xk = xm + 0.1 * w;
    mod.ankere.mantelkile = { x: xk, y: (litoK(xk) + Math.min(h, slab(xk))) / 2 };
    mod.side = sidebaand(h, [
      [topp(w), Math.min(moho(w), slab(w)), 'kontinent'],
      [moho(w), Math.min(litoK(w), slab(w)), 'litosfare'],
      [slab(w), slab(w) + tc / Math.cos(th1), 'havskorpe'],
      [slab(w) + tc / Math.cos(th1), slab(w) + L / Math.cos(th1), 'litosfare'],
    ]);
    mod.lagTekster.push({ x: 0.98 * w, y: (topp(0.95 * w) + moho(0.95 * w)) / 2 + 6, tekst: 'Kontinentalskorpe', anchor: 'end' });
    mod.overTekster.push({ x: xv, y: kjegle.topp, tekst: 'Vulkan' });
  } else {
    const yOver = ys + 0.075 * h;
    topp = (x) => (x < xg ? Infinity : yT + (yOver - yT) * trinn(xg, xg + 0.1 * w, x));
    const skorpeO = (x: number) => topp(x) + 0.05 * h + 0.06 * h * klokke(x, xv, 0.08 * w);
    const litoO = 0.44 * h;
    for (const p of baand(xg, w, topp, (x) => Math.min(skorpeO(x), slab(x)), 2)) mod.flater.push({ p, fyll: 'havskorpe' });
    for (const p of baand(xg, w, skorpeO, (x) => Math.min(litoO, slab(x)), 2)) mod.flater.push({ p, fyll: 'litosfare' });
    kammer = { x: xv, y: yOver + 0.05 * h, rx: 0.03 * w, ry: 0.016 * h };
    const H = yOver - (ys - 0.1 * h);
    kjegle = {
      x: xv,
      r: 0.085 * w,
      topp: ys - 0.1 * h,
      fot: yOver,
      form: 'strato',
      krater: { u: 0.08, dyp: 0.014 * h },
      farge: VULKAN_STRATO,
      gront: klemme((yOver - ys) / H + 0.2, 0, 1),
      vann: ys,
      aktiv: true,
      seed: 5,
    };
    mod.topp = () => HAVBUNN;
    mod.ankere.overplate = { x: 0.88 * w, y: (skorpeO(0.88 * w) + litoO) / 2 };
    const xk = xm + 0.1 * w;
    mod.ankere.mantelkile = { x: xk, y: (litoO + Math.min(h, slab(xk))) / 2 };
    mod.side = sidebaand(h, [
      [ys, topp(w), 'vann'],
      [topp(w), Math.min(skorpeO(w), slab(w)), 'havskorpe'],
      [skorpeO(w), Math.min(litoO, slab(w)), 'litosfare'],
      [slab(w), slab(w) + tc / Math.cos(th1), 'havskorpe'],
      [slab(w) + tc / Math.cos(th1), slab(w) + L / Math.cos(th1), 'litosfare'],
    ]);
    mod.overTekster.push({ x: xv, y: kjegle.topp, tekst: 'Øybue' });
  }
  kjegle.rz = Math.min(kjegle.r, 0.85 * dybde);
  kjegle.glo = 0.7;
  mod.kjegler.push(kjegle);
  mod.hav = ys;
  mod.profil = (x) => (x < xg ? interp(sx, sy, x) + krusing(x) : Math.min(topp(x), slab(x)));

  // Akkresjonskile: sedimenter som skrapes av havbunnsplata i grøfta
  const xa = xg + (hh ? 0.06 : 0.075) * w;
  const xbk = xg + (hh ? 0.1 : 0.13) * w;
  mod.flater.push({
    p: [
      ...linspace(xg, xa, 12).map((x): P => [x, Math.min(topp(x), slab(x))]),
      [xbk, slab(xbk) - 0.002 * h],
      ...linspace(xbk, xg, 14).map((x): P => [x, slab(x)]),
    ],
    fyll: 'sediment',
  });

  // Magma: smelting i mantelkilen over plata (vann fra plata senker smeltepunktet), diapirer, kammer og kanal
  const sx0 = xm - 0.035 * w;
  const sx1 = xm + 0.05 * w;
  const smelteBunn = (x: number) => slab(x) - 0.006 * h;
  mod.smelte.push([
    ...linspace(sx0, sx1, 24).map((x): P => [x, smelteBunn(x) - 0.1 * h * Math.sin((Math.PI * (x - sx0)) / (sx1 - sx0)) ** 0.7]),
    ...linspace(sx1, sx0, 24).map((x): P => [x, smelteBunn(x)]),
  ]);
  mod.kamre.push(kammer);
  const kraterBunn = kjegleMedKrater(kjegle, 0);
  mod.kanaler.push({ p: [[xv, kammer.y - kammer.ry * 0.5], [xv, (kammer.y + kraterBunn) / 2], [xv, kraterBunn + 0.5]], b: Math.max(2.5, 0.007 * w) });
  const fra: P = [xm + 0.007 * w, slab(xm) - 0.11 * h];
  const til: P = [xv, kammer.y + kammer.ry];
  for (const q of [0.22, 0.5, 0.78]) {
    mod.diapirer.push({ x: fra[0] + (til[0] - fra[0]) * q, y: fra[1] + (til[1] - fra[1]) * q, rx: 0.013 * w * (1.15 - 0.35 * q), ry: 0.022 * h * (1.1 - 0.3 * q) });
  }
  for (const dxv of [-0.075, -0.05, -0.025]) {
    const xf = xm + dxv * w;
    mod.vaeske.push([
      [xf, slab(xf) - 0.008 * h],
      [xf + 0.012 * w, slab(xf) - 0.05 * h],
    ]);
  }

  // Skjelv langs oversiden av plata (Wadati–Benioff-sonen) og noen grunne i overplata
  const rnd = sceneRandom(17);
  const nI = (x: number): P => N[Math.max(0, Math.min(N.length - 1, sx.findIndex((v) => v >= x)))] ?? [0, 1];
  for (let i = 0; i < 22; i++) {
    const yq = yT + rnd() ** 1.5 * (0.93 * h - yT);
    const xq = slabX(yq);
    const n = nI(xq);
    const d = 0.006 * h + rnd() * 0.05 * h;
    mod.skjelv.push([xq + n[0] * d, slab(xq) + n[1] * d]);
  }
  for (let i = 0; i < 4; i++) {
    const xq = xg + (0.03 + rnd() * 0.12) * w;
    const a = topp(xq) + 0.015 * h;
    const b = slab(xq) - 0.012 * h;
    if (b > a) mod.skjelv.push([xq, a + rnd() * (b - a)]);
  }

  // Strømning: mantelkilen dras ned langs plata, og mantelen under havbunnsplata følger med
  const yC = (yMelt + 0.93 * h) / 2;
  const xC = slabX(yC);
  const nC = nI(xC);
  const xD = slabX(0.95 * h);
  const nD = nI(xD);
  const C: P = [xC - nC[0] * 0.05 * h, slab(xC) - nC[1] * 0.05 * h];
  const D: P = [xD - nD[0] * 0.04 * h, slab(xD) - nD[1] * 0.04 * h];
  const litoOver = hh ? 0.44 * h : 0.59 * h;
  const B: P = [Math.min(0.88 * w, Math.max(C[0] + 0.08 * w, 0.8 * w)), litoOver + 0.075 * h];
  if (slab(B[0]) > B[1] + 0.03 * h) mod.strom.push([[0.985 * w, B[1] - 0.005 * h], B, C, D]);
  else mod.strom.push([C, D]);
  mod.strom.push([[0.03 * w, 0.865 * h], [0.18 * w, 0.865 * h], [xg - 0.04 * w, 0.88 * h], [xg + 0.06 * w, 0.975 * h]]);
  const xp = 0.2 * w;
  const midtHav = havGlatt(xp) + tc + 0.38 * (L - tc);
  mod.farter.push({ x: xp, y: midtHav, retning: 1, fart });

  const yP = 0.7 * h;
  const xP = slabX(yP);
  const nP = nI(xP);
  const tP: [number, number] = [r2(nP[1]), r2(-nP[0])];
  mod.ankere = {
    ...mod.ankere,
    grop: { x: xg, y: yT },
    vulkan: { x: xv, y: kjegle.topp },
    magmakammer: { x: kammer.x, y: kammer.y },
    smeltesone: { x: xm + 0.007 * w, y: slab(xm) - 0.055 * h },
    platetrekk: { x: xP + (nP[0] * L) / 2, y: slab(xP) + (nP[1] * L) / 2, retning: tP },
    skjelvsone: { x: slabX(0.5 * h), y: 0.5 * h },
    akkresjonskile: { x: xg + 0.035 * w, y: (Math.min(topp(xg + 0.035 * w), slab(xg + 0.035 * w)) + slab(xg + 0.035 * w)) / 2 },
    havplate: { x: xp, y: midtHav, retning: [1, 0] },
    astenosfare: { x: 0.14 * w, y: 0.9 * h },
  };
  const trekkVed = (y: number): PlateAnker => {
    const x = slabX(y);
    const n = nI(x);
    return { x: x + (n[0] * L) / 2, y: slab(x) + (n[1] * L) / 2, retning: [r2(n[1]), r2(-n[0])] };
  };
  mod.kraft = {
    platetrekk: [0.7, 0.62, 0.78, 0.55].map((a) => trekkVed(a * h)),
    havplate: [0.2, 0.12, 0.26, 0.08, 0.3].flatMap((d) => [0.8, 0.92, 0.62].map((a) => ({ x: d * w, y: havGlatt(d * w) + tc + a * (L - tc), retning: [1, 0] as const }))),
  };
  mod.lagTekster.unshift(
    { x: 0.02 * w, y: havGlatt(0.02 * w) + L - 0.035 * h, tekst: 'Litosfære', anchor: 'start' },
    { x: 0.02 * w, y: 0.95 * h, tekst: 'Astenosfære', anchor: 'start' },
  );
  mod.overTekster.unshift({ x: xg, y: yT, tekst: 'Havgrop' });
  return mod;
}

/**
 * Hvor langt fjellkjeden ved en kollisjon har vokst (0–1) etter at kontinentene er skjøvet `fart · t · 10` km sammen:
 * 1 − e^(−S/500), som skorpefortykningen i en forenklet isostasimodell (63 % ved 500 km, nesten fullt etter ca. 1500
 * km). Ugyldige tall gir 1 (ferdig fjellkjede).
 */
function kollisjonVekst(fart: number, t: number): number {
  const S = 10 * fart * t;
  return Number.isFinite(S) && S >= 0 ? 1 - Math.exp(-S / 500) : 1;
}

function modellKollisjon(m: ModellInn): PlateModell {
  const { w, h, fart, t } = m;
  const mod = tomModell();
  const ylav = 0.3 * h;
  const xs = 0.47 * w;
  const dip = Math.tan((27 * Math.PI) / 180);
  // Fjellkjeden og rota vokser med sammenskyvingen (fortykningen); ved t = 0 har kontinentene akkurat møttes
  const g = kollisjonVekst(fart, t);
  const e = (x: number) =>
    g *
    (0.16 * h * klokke(x, 0.5 * w, 0.1 * w) +
      0.1 * h * klokke(x, 0.63 * w, 0.09 * w) +
      0.07 * h * klokke(x, 0.38 * w, 0.065 * w) +
      0.05 * h * klokke(x, 0.73 * w, 0.08 * w) +
      0.012 * h * Math.sin(x / (0.011 * w)) * klokke(x, 0.53 * w, 0.2 * w));
  const topp = (x: number) => ylav - e(x);
  const ys0 = topp(xs);
  const yi = (x: number) => (x < xs ? -Infinity : ys0 + (x - xs) * dip);
  const bL = (x: number) => Math.max(ylav + 0.15 * h + g * 0.16 * h * klokke(x, 0.46 * w, 0.12 * w), yi(x) + 0.13 * h);
  const mL = (x: number) => Math.max(0.64 * h + g * 0.05 * h * klokke(x, 0.45 * w, 0.15 * w), yi(x) + 0.3 * h);
  const bR = (x: number) => ylav + 0.15 * h + 0.14 * h * klokke(x, 0.6 * w, 0.12 * w);
  const mR = 0.62 * h;
  const lTopp = (x: number) => (x <= xs ? topp(x) : yi(x));
  mod.profil = topp;
  mod.flater.push({ p: [[0, 0], [w, 0], [w, h], [0, h]], fyll: 'astenosfare' });
  const venstreSkorpe = baand(0, w, lTopp, bL, 2);
  for (const p of venstreSkorpe) mod.flater.push({ p, fyll: 'kontinent' });
  for (const p of baand(0, w, bL, mL, 2)) mod.flater.push({ p, fyll: 'litosfare' });
  for (const p of baand(xs, w, topp, (x) => Math.min(bR(x), yi(x)), 2)) mod.flater.push({ p, fyll: 'kontinentB' });
  for (const p of baand(xs, w, bR, (x) => Math.min(mR, yi(x)), 2)) mod.flater.push({ p, fyll: 'litosfare' });
  mod.foldKlipp = venstreSkorpe;

  // Foldede lag i den venstre skorpa, skyveforkastninger og suturen
  for (let i = 0; i < 3; i++) {
    const p = linspace(0, xs + 0.06 * w, 90).map((x): P => [
      x,
      ylav + (0.03 + 0.045 * i) * h - 0.55 * e(x) + 0.022 * h * trinn(0.1 * w, xs, x) * Math.sin((2 * Math.PI * x) / (0.06 * w) + i),
    ]);
    mod.linjer.push({ p, type: 'fold' });
  }
  for (let i = 0; i < 3; i++) {
    const x0 = (0.29 + 0.055 * i) * w;
    const th = ((32 - 6 * i) * Math.PI) / 180;
    const p: P[] = [];
    for (let x = x0; x < xs + 0.05 * w; x += 2) {
      const y = topp(x0) + (x - x0) * Math.tan(th) * (1 - 0.35 * trinn(0, 0.2 * w, x - x0));
      if (y > bL(x) - 0.03 * h) break;
      p.push([x, y]);
    }
    if (p.length > 2) mod.linjer.push({ p, type: 'skyvning' });
  }
  const xEnd = xs + (0.74 * h - ys0) / dip;
  mod.linjer.push({ p: [[xs, ys0], [xEnd, yi(xEnd)]], type: 'sutur' });

  const rnd = sceneRandom(29);
  for (let i = 0; i < 15; i++) {
    const x = (0.3 + rnd() * 0.36) * w;
    const a = topp(x) + 0.02 * h;
    const b = Math.min(topp(x) + 0.24 * h, (x < xs ? bL(x) : yi(x) + 0.12 * h) - 0.02 * h);
    if (b > a) mod.skjelv.push([x, a + rnd() * (b - a)]);
  }
  for (let i = 0; i < 5; i++) {
    const x = xs + (0.02 + rnd() * 0.18) * w;
    mod.skjelv.push([x, yi(x) + (rnd() - 0.3) * 0.03 * h]);
  }
  const xp = 0.3 * w;
  mod.farter.push({ x: xp, y: bL(xp) + 0.38 * (mL(xp) - bL(xp)), retning: 1, fart });
  mod.side = sidebaand(h, [
    [topp(w), Math.min(bR(w), yi(w)), 'kontinentB'],
    [bR(w), Math.min(mR, yi(w)), 'litosfare'],
    [yi(w), bL(w), 'kontinent'],
    [bL(w), mL(w), 'litosfare'],
  ]);
  mod.topp = (_x, y) => landFarge((ylav - y) / h, 0.155, false);
  let xt = xs;
  let rot = xs;
  for (const x of linspace(0.2 * w, 0.8 * w, 120)) {
    if (e(x) > e(xt)) xt = x;
    if (x < xs + 0.1 * w && bL(x) > bL(rot)) rot = x;
  }
  const xsu = xs + 0.06 * w;
  mod.ankere = {
    sutur: { x: xsu, y: yi(xsu), retning: [r2(1 / Math.hypot(1, dip)), r2(dip / Math.hypot(1, dip))] },
    fjelltopp: { x: xt, y: topp(xt) },
    fjellrot: { x: rot, y: bL(rot) },
    plateVenstre: { x: xp, y: (bL(xp) + mL(xp)) / 2, retning: [1, 0] },
    plateHoyre: { x: 0.92 * w, y: (topp(0.92 * w) + bR(0.92 * w)) / 2 },
    astenosfare: { x: 0.12 * w, y: (mL(0.12 * w) + h) / 2 },
  };
  mod.kraft = {
    kollisjonVenstre: [0.2, 0.14, 0.26, 0.32, 0.08, 0.38].flatMap((d) => [0.78, 0.9, 0.6].map((a) => ({ x: d * w, y: bL(d * w) + a * (mL(d * w) - bL(d * w)), retning: [1, 0] as const }))),
    kollisjonHoyre: [0.86, 0.8, 0.92].flatMap((d) => {
      const x = d * w;
      const bunn = Math.min(mR, yi(x));
      return [0.7, 0.85, 0.45].map((a) => ({ x, y: bR(x) + a * (bunn - bR(x)), retning: [-1, 0] as const }));
    }),
  };
  mod.lagTekster = [
    { x: 0.02 * w, y: (topp(0.02 * w) + bL(0.02 * w)) / 2 + 6, tekst: 'Kontinentalskorpe', anchor: 'start' },
    { x: 0.02 * w, y: mL(0.02 * w) - 0.035 * h, tekst: 'Litosfære', anchor: 'start' },
    { x: 0.02 * w, y: (mL(0.02 * w) + h) / 2 + 6, tekst: 'Astenosfære', anchor: 'start' },
  ];
  mod.lagTekster.push({ x: xs + 0.24 * w + 8, y: yi(xs + 0.24 * w) + 4, tekst: 'Sutur', anchor: 'start' });
  mod.overTekster = [{ x: xt, y: topp(xt), tekst: 'Fjellkjede' }];
  return mod;
}

function modellVarmtPunkt(m: ModellInn): PlateModell {
  const { w, h, fart, t, kmPerPx, dybde } = m;
  const mod = tomModell();
  const ys = 0.26 * h;
  const sb = ys + 0.1 * h;
  const tc = 0.045 * h;
  const yL = 0.52 * h;
  const xh = 0.72 * w;
  const pxPerMa = (10 * fart) / kmPerPx;
  const forsk = pxPerMa * t;
  const lam = Math.max(12, 0.045 * w);
  const bunn = (x: number) => sb + 0.006 * h * bolger(x, -forsk, lam);
  mod.hav = ys;
  mod.profil = bunn;
  mod.flater.push({ p: [[0, 0], [w, 0], [w, h], [0, h]], fyll: 'astenosfare' });
  for (const p of baand(0, w, (x) => bunn(x) + tc, () => yL, 3)) mod.flater.push({ p, fyll: 'litosfare' });
  for (const p of baand(0, w, bunn, (x) => bunn(x) + tc, 2)) mod.flater.push({ p, fyll: 'havskorpe' });

  // Vulkankjeden: en ny vulkan for hver `avstand` plata har flyttet seg, eldre jo lenger til venstre. Hver vulkan
  // vokser det første halvannet million år og er aktiv til den neste har vokst seg over havbunnen (`vekst` etter at den
  // begynte), så det alltid er minst én aktiv vulkan over plumen (som Kīlauea og Mauna Loa samtidig). Etterpå eroderes
  // og synker den (guyot).
  const avstand = 0.21 * w;
  const vr = 0.12 * w;
  const Hmaks = sb - (ys - 0.12 * h);
  const ma = pxPerMa > 1e-9;
  const delta = ma ? avstand / pxPerMa : Infinity;
  const vekst = Math.min(1.5, delta);
  const aldre: number[] = [];
  // Står plata stille, vokser én vulkan over plumen (fullt utvokst om den har hatt tid)
  if (!ma) aldre.push(Math.max(t, vekst));
  else {
    const kMaks = Math.floor(t / delta);
    const antall = Math.ceil((xh + vr) / avstand) + 1;
    for (let kk = kMaks; kk >= kMaks - antall; kk--) aldre.push(t - kk * delta);
  }
  let aktiv: PlateKjegle | null = null;
  let eldre: PlateKjegle | null = null;
  aldre.forEach((a, i) => {
    const x = xh - pxPerMa * a;
    if (x < -vr * 0.6 || !Number.isFinite(x)) return;
    const g = trinn(0, vekst, a) ** 0.8;
    const erAktiv = a < delta + vekst;
    const etter = erAktiv ? 0 : a - delta - vekst;
    const erosjon = 0.045 * h * (1 - Math.exp(-etter / 4));
    const senkning = 0.16 * h * (1 - Math.exp(-etter / 15));
    const toppY = sb - Hmaks * g + erosjon + senkning;
    if (!(sb - toppY > 0.012 * h)) return;
    const guyot = toppY > ys && g > 0.99;
    const r = vr * (0.45 + 0.55 * g);
    const kj: PlateKjegle = {
      x,
      r,
      rz: Math.min(r, 0.85 * dybde),
      topp: toppY,
      fot: sb,
      form: 'skjold',
      krater: erAktiv && toppY < ys ? { u: 0.06, dyp: 0.01 * h } : null,
      flat: guyot ? 0.3 : 0,
      ru: Math.min(0.6, etter / 6),
      farge: erAktiv ? VULKAN_SKJOLD : mix(VULKAN_SKJOLD, SCENE.grass, Math.min(0.55, 0.2 + etter / 6)),
      gront: toppY < ys ? klemme((sb - ys) / (sb - toppY) + 0.12, 0, 1) : null,
      glo: erAktiv ? 0.9 : 0,
      vann: ys,
      aktiv: erAktiv,
      seed: i + 2,
    };
    mod.kjegler.push(kj);
    mod.aldre.push({ x, y: toppY, alder: a, aktiv: erAktiv });
    if (!aktiv) aktiv = kj;
    else if (!eldre) eldre = kj;
  });

  // Mantelplumen: stamme fra dypet og et flatt hode under litosfæren
  const cx = xh - 0.02 * w;
  const cy = yL + 0.065 * h;
  const rx = 0.16 * w;
  const ry = 0.06 * h;
  const sw = 0.035 * w;
  const thL = Math.acos(klemme((xh - sw - cx) / rx, -1, 1));
  const thR = Math.acos(klemme((xh + sw - cx) / rx, -1, 1));
  mod.plume = [
    [xh - sw * 1.1, h + 4],
    ...linspace(thL, 2 * Math.PI + thR, 60).map((th): P => [cx + rx * Math.cos(th), cy + ry * Math.sin(th)]),
    [xh + sw * 1.1, h + 4],
  ];
  mod.smelte.push(linspace(Math.PI, 2 * Math.PI, 30).map((th): P => [cx + 0.82 * rx * Math.cos(th), cy + 0.2 * ry + 0.9 * ry * Math.sin(th)]));
  const akt = aktiv as PlateKjegle | null;
  if (akt && akt.aktiv) {
    const kraterBunn = akt.krater ? kjegleMedKrater(akt, 0) : akt.topp;
    const hode = (x: number) => cy - ry * Math.sqrt(Math.max(0, 1 - ((x - cx) / rx) ** 2));
    const xk = klemme(akt.x, cx - rx * 0.85, cx + rx * 0.85);
    mod.kanaler.push({ p: [[xk, hode(xk) + 2], [(xk + akt.x) / 2, sb + tc], [akt.x, sb - 0.01 * h], [akt.x, kraterBunn + 0.5]], b: Math.max(2.5, 0.0065 * w) });
    mod.kamre.push({ x: akt.x, y: sb - 0.035 * h, rx: 0.024 * w, ry: 0.012 * h });
    const rnd = sceneRandom(41);
    for (let i = 0; i < 6; i++) mod.skjelv.push([akt.x + (rnd() - 0.5) * 0.08 * w, sb - 0.04 * h + rnd() * 0.14 * h]);
  }
  mod.strom.push([[xh, 0.985 * h], [xh, 0.8 * h], [xh, cy + ry * 0.5]]);
  mod.strom.push([[cx - 0.02 * w, cy], [cx - 0.08 * w, cy - 0.005 * h], [cx - 0.135 * w, cy + 0.005 * h]]);
  mod.strom.push([[cx + 0.04 * w, cy], [cx + 0.09 * w, cy - 0.005 * h], [cx + 0.13 * w, cy + 0.005 * h]]);
  const xp = 0.3 * w;
  mod.farter.push({ x: xp, y: sb + tc + 0.38 * (yL - sb - tc), retning: -1, fart });
  mod.side = sidebaand(h, [
    [ys, bunn(w), 'vann'],
    [bunn(w), bunn(w) + tc, 'havskorpe'],
    [bunn(w) + tc, yL, 'litosfare'],
    [yL, h, 'astenosfare'],
  ]);
  const a0 = aktiv as PlateKjegle | null;
  const e0 = eldre as PlateKjegle | null;
  mod.ankere = {
    varmtPunkt: { x: xh, y: cy },
    mantelplume: { x: xh, y: 0.82 * h },
    plateVenstre: { x: xp, y: (sb + tc + yL) / 2, retning: [-1, 0] },
    astenosfare: { x: 0.14 * w, y: 0.88 * h },
    ...(a0 ? { vulkan: { x: a0.x, y: a0.topp } } : {}),
    ...(e0 ? { eldreVulkan: { x: e0.x, y: e0.topp } } : {}),
    ...(mod.kamre[0] ? { magmakammer: { x: mod.kamre[0].x, y: mod.kamre[0].y } } : {}),
  };
  mod.kraft = {
    plateVenstre: [0.3, 0.2, 0.4, 0.48, 0.58, 0.64].flatMap((d) => [0.78, 0.9, 0.6].map((a) => ({ x: d * w, y: sb + tc + a * (yL - sb - tc), retning: [-1, 0] as const }))),
  };
  mod.lagTekster = [
    { x: 0.02 * w, y: yL - 0.035 * h, tekst: 'Litosfære', anchor: 'start' },
    { x: 0.02 * w, y: 0.93 * h, tekst: 'Astenosfære', anchor: 'start' },
    { x: xh + 0.1 * w, y: 0.86 * h, tekst: 'Mantelplume' },
    { x: cx + rx + 6, y: cy + 5, tekst: 'Varmt punkt', anchor: 'start' },
  ];

  return mod;
}

/** Standard tid for kollisjon (millioner år): fjellkjeden er nesten ferdig (2000 km sammenskyving ved 4 cm per år). */
const KOLLISJON_T = 50;

/** Normaliserte props (gyldige tall og standardverdier). */
interface PlateInn {
  type: PlategrenseType;
  variant: SubduksjonVariant;
  x: number;
  y: number;
  w: number;
  h: number;
  t: number;
  fart: number;
  breddeKm: number;
  striper: boolean;
  dybde: number;
  dx: number;
  dy: number;
}

function normaliser(p: PlategrenseProps): PlateInn {
  const type: PlategrenseType = p.type in PLATE_FART ? p.type : 'spredning';
  const w = Math.max(80, tall(p.w, 760));
  const h = Math.max(60, tall(p.h, 300));
  const dybdeInn = p.dybde === undefined ? Math.min(110, 0.13 * w) : Math.max(0, tall(p.dybde, 0));
  const { dx, dy } = type === 'transform' ? { dx: 0, dy: 0 } : snittblokkPerspektiv(dybdeInn, p.vinkel);
  return {
    type,
    variant: p.variant === 'hav-hav' ? 'hav-hav' : 'hav-kontinent',
    x: tall(p.x, 0),
    y: tall(p.y, 0),
    w,
    h,
    t: Math.max(0, tall(p.t, type === 'kollisjon' ? KOLLISJON_T : STRIPER_START)),
    fart: klemme(tall(p.fart, PLATE_FART[type]), 0, 30),
    breddeKm: Math.max(1, tall(p.breddeKm, PLATE_BREDDE_KM[type])),
    striper: p.striper ?? false,
    dybde: type === 'transform' ? 0 : dybdeInn,
    dx,
    dy,
  };
}

function byggModell(inn: PlateInn): PlateModell {
  const m: ModellInn = { w: inn.w, h: inn.h, fart: inn.fart, t: inn.t, kmPerPx: inn.breddeKm / inn.w, striper: inn.striper, variant: inn.variant, dybde: inn.dybde };
  switch (inn.type) {
    case 'subduksjon':
      return modellSubduksjon(m);
    case 'kollisjon':
      return modellKollisjon(m);
    case 'varmt-punkt':
      return modellVarmtPunkt(m);
    case 'transform':
      return modellTransform(m);
    default:
      return modellSpredning(m);
  }
}

/** Kartet ovenfra for en transformforkastning: ryggene, forkastningen og bruddsonene (lokale koordinater). */
function transformMaal(w: number, h: number) {
  return { xa: 0.36 * w, xb: 0.64 * w, yf: 0.5 * h };
}

function modellTransform(m: ModellInn): PlateModell {
  const { w, h, fart } = m;
  const mod = tomModell();
  const { xa, xb, yf } = transformMaal(w, h);
  mod.profil = () => 0;
  mod.ankere = {
    forkastning: { x: (xa + xb) / 2, y: yf },
    ryggNord: { x: xa, y: 0.25 * h },
    ryggSor: { x: xb, y: 0.75 * h },
    bruddsoneVenstre: { x: xa / 2, y: yf },
    bruddsoneHoyre: { x: (xb + w) / 2, y: yf },
    plateVenstre: { x: 0.13 * w, y: 0.25 * h, retning: [-1, 0] },
    plateHoyre: { x: 0.87 * w, y: 0.75 * h, retning: [1, 0] },
  };
  mod.kraft = {
    plateVenstre: [0.4, 0.6, 0.5].map((a) => ({ x: 0.13 * w, y: a * h, retning: [-1, 0] as const })),
    plateHoyre: [0.6, 0.4, 0.5].map((a) => ({ x: 0.87 * w, y: a * h, retning: [1, 0] as const })),
  };
  for (const [x, y, r] of [
    [0.13 * w, 0.25 * h, -1],
    [0.13 * w, 0.75 * h, -1],
    [0.87 * w, 0.25 * h, 1],
    [0.87 * w, 0.75 * h, 1],
  ] as const)
    mod.farter.push({ x, y, retning: r, fart: fart / 2 });
  const rnd = sceneRandom(53);
  for (let i = 0; i < 8; i++) mod.skjelv.push([xa + (0.05 + 0.9 * rnd()) * (xb - xa), yf + (rnd() - 0.5) * 0.04 * h]);
  for (let i = 0; i < 3; i++) mod.skjelv.push([xa + (rnd() - 0.5) * 0.02 * w, (0.1 + 0.3 * rnd()) * h]);
  for (let i = 0; i < 3; i++) mod.skjelv.push([xb + (rnd() - 0.5) * 0.02 * w, (0.6 + 0.3 * rnd()) * h]);
  return mod;
}

/** Geometrien til `Plategrense` i figurens koordinater: ankerpunkter, profil, havnivå, målestokk og rammen. */
export interface PlategrenseGeometri {
  type: PlategrenseType;
  /** Øverste venstre hjørne av snittet foran (eller kartet), bredde og høyde. */
  x: number;
  y: number;
  w: number;
  h: number;
  /** Forskyvningen av bakkanten (blokka stikker dx til høyre og dy opp). 0 for transform. */
  dx: number;
  dy: number;
  /** Havnivået (figurens y) eller null (kollisjon og transform). */
  havniva: number | null;
  /** Toppen av snittet foran (bakken eller havbunnen, med vulkanene) ved figurens x. */
  profil: (x: number) => number;
  /** Den relative bevegelsen mellom platene i figurens enheter per million år (bredden er `breddeKm`). */
  pxPerMa: number;
  /** Km per enhet vannrett (`breddeKm / w`). Loddrett er ikke i målestokk. */
  kmPerPx: number;
  /** Fart og tid etter normalisering. */
  fart: number;
  t: number;
  ankere: Partial<Record<PlateAnkerNavn, PlateAnker>>;
  /**
   * Ankerpunkter til kraftpiler (platetrekk, ryggskyv, platene som skyver mot hverandre) inne i litosfæren, valgt så en
   * pil på inntil ca. 0,11 · w fra ankeret i `retning` med en etikett ved spissen ikke dekker kit-ets egne lagnavn
   * eller fartspiler (`opptatt`). Bruk disse i stedet for `ankere` når du tegner krefter:
   *   const a = g.kraftankre.ryggskyvHoyre;
   *   a && <ForceArrow x1={a.x} y1={a.y} x2={a.x + 60 * a.retning![0]} y2={a.y + 60 * a.retning![1]} color={VIZ.applied} label="Ryggskyv" />
   */
  kraftankre: Partial<Record<KraftAnkerNavn, PlateAnker>>;
  /** Flatene kit-et selv tegner tekst og piler i (lagnavn med `etiketter`, fartspiler med tekst med `piler`). */
  opptatt: PlateBoks[];
  /** Varmt punkt: vulkanene i kjeden (toppen, alderen i millioner år og om den er aktiv), yngst først. Tom ellers. */
  vulkaner: { x: number; y: number; alder: number; aktiv: boolean }[];
  /** Hvor figuren tegner (blokka, skyggen og etikettene over), til viewBox-en. */
  ramme: { x0: number; y0: number; x1: number; y1: number };
}

/** Valgene som avgjør hva kit-et selv tegner (og dermed hvor det er opptatt). */
interface GeoValg {
  etiketter: boolean;
  skygge: boolean;
  piler: boolean;
  pilSkala: number;
}

function valgFra(props: Omit<PlategrenseProps, 'children'>, w: number): GeoValg {
  return {
    etiketter: props.etiketter ?? false,
    skygge: props.skygge ?? true,
    piler: props.piler ?? true,
    pilSkala: tall(props.pilSkala, 0.028 * w),
  };
}

/** Høyden etikettene over blokka trenger (to rader når de ellers ville overlappe). */
function overEtiketter(tekster: readonly { x: number; y: number; tekst: string }[], w: number, f: number, size = 0.8) {
  const fs = 17 * size * f;
  const sortert = tekster.map((t, i) => ({ ...t, i, b: t.tekst.length * 0.58 * fs })).sort((a, b) => a.x - b.x);
  const rad = new Array<number>(tekster.length).fill(0);
  const sluttRad: number[] = [-Infinity, -Infinity, -Infinity];
  for (const t of sortert) {
    const lx = klemme(t.x, t.b / 2, w - t.b / 2);
    let r = 0;
    while (r < 2 && lx - t.b / 2 < sluttRad[r]! + 12) r++;
    rad[t.i] = r;
    sluttRad[r] = lx + t.b / 2;
  }
  const rader = tekster.length === 0 ? 0 : Math.max(...rad) + 1;
  return { rad, rader, linje: fs * 1.25 };
}

/**
 * Geometrien til en `Plategrense` uten å tegne: ankerpunkter for kraftpiler og etiketter (platetrekk, ryggskyv, grop,
 * vulkan, sutur …), profilen, havnivået, målestokken og rammen figuren tegner innenfor (til viewBox-en). `f` er
 * tekstskaleringen (til plassen etikettene over blokka trenger). Null for ugyldige tall.
 *   const g = plategrenseGeometri({ type: 'subduksjon', x: 20, y: 60, w: 700, h: 300 });
 *   const a = g?.ankere.platetrekk;   // a.retning peker ned langs plata
 *   <ForceArrow x1={a.x} y1={a.y} x2={a.x + 60 * a.retning[0]} y2={a.y + 60 * a.retning[1]} color={VIZ.gravity} />
 */
export function plategrenseGeometri(props: Omit<PlategrenseProps, 'children'>, f = 1): PlategrenseGeometri | null {
  if (!props || !Number.isFinite(props.w) || !Number.isFinite(props.h)) return null;
  const inn = normaliser(props as PlategrenseProps);
  const mod = byggModell(inn);
  return geometriFra(inn, mod, valgFra(props, inn.w), Number.isFinite(f) && f > 0 ? f : 1);
}

function frontToppFor(mod: PlateModell): (x: number) => number {
  return (x) => {
    let y = mod.profil(x);
    for (const k of mod.kjegler) y = Math.min(y, kjegleFront(k, x));
    return y;
  };
}

/** Om to bokser overlapper (med margin). */
function overlapper(a: { x0: number; y0: number; x1: number; y1: number }, b: { x0: number; y0: number; x1: number; y1: number }, m = 0): boolean {
  return a.x0 < b.x1 + m && b.x0 < a.x1 + m && a.y0 < b.y1 + m && b.y0 < a.y1 + m;
}

/** Flatene kit-ets lagnavn og fartspiler tar (lokale koordinater). */
function opptattIModell(type: PlategrenseType, mod: PlateModell, w: number, h: number, valg: GeoValg, f: number): PlateBoks[] {
  const ut: PlateBoks[] = [];
  if (valg.piler) {
    const fs = 17 * 0.72 * f;
    for (const fp of mod.farter) {
      const L = Math.min(0.35 * w, valg.pilSkala * fp.fart);
      if (!(L > 3)) continue;
      const tekstB = fartTekst(fp.fart).length * 0.58 * fs;
      const b = Math.max(L, tekstB) / 2 + 4;
      ut.push({ x0: fp.x - b, y0: fp.y - 9 - 4 * f - fs, x1: fp.x + b, y1: fp.y + 7, hva: 'fart' });
    }
    if (type === 'transform') {
      // De to motsatte pilene langs forkastningen
      const { xa, xb, yf } = transformMaal(w, h);
      ut.push({ x0: xa, y0: yf - 22, x1: xb, y1: yf + 22, hva: 'fart' });
    }
  }
  if (valg.etiketter) {
    const fs = 17 * 0.72 * f;
    for (const l of mod.lagTekster) {
      const b = l.tekst.length * 0.58 * fs;
      const x0 = l.anchor === 'end' ? l.x - b : l.anchor === 'middle' ? l.x - b / 2 : l.x;
      ut.push({ x0, y0: l.y - fs * 0.9, x1: x0 + b, y1: l.y + fs * 0.3, hva: 'lagnavn' });
    }
  }
  return ut;
}

/** Velger den første kandidaten der en kraftpil (med etikett ved spissen) ikke dekker noe i `opptatt`. */
function velgKraftankre(mod: PlateModell, opptatt: readonly PlateBoks[], w: number, h: number, f: number): Partial<Record<KraftAnkerNavn, PlateAnker>> {
  const ut: Partial<Record<KraftAnkerNavn, PlateAnker>> = {};
  const L = 0.11 * w;
  const fs = 17 * 0.8 * f;
  for (const [navn, liste] of Object.entries(mod.kraft) as [KraftAnkerNavn, PlateAnker[]][]) {
    const gyldige = liste.filter((a) => Number.isFinite(a.x) && Number.isFinite(a.y) && a.x > 0 && a.x < w && a.y > 0 && a.y < h);
    if (gyldige.length === 0) continue;
    const fri = gyldige.find((a) => {
      const [ux, uy] = a.retning ?? [1, 0];
      const x2 = a.x + ux * L;
      const y2 = a.y + uy * L;
      const pil = { x0: Math.min(a.x, x2) - 6, y0: Math.min(a.y, y2) - fs - 4, x1: Math.max(a.x, x2) + 6, y1: Math.max(a.y, y2) + 6 };
      return !opptatt.some((b) => overlapper(pil, b, 2));
    });
    ut[navn] = fri ?? gyldige[0]!;
  }
  return ut;
}

function geometriFra(inn: PlateInn, mod: PlateModell, valg: GeoValg, f: number): PlategrenseGeometri {
  const { x, y, w, h, dx, dy } = inn;
  const { etiketter, skygge } = valg;
  const ft = frontToppFor(mod);
  const toppMin = inn.type === 'transform' ? 0 : Math.min(...linspace(0, w, 120).map(ft), mod.hav ?? Infinity);
  const over = inn.type !== 'transform' && etiketter ? overEtiketter(mod.overTekster, w + dx, f) : null;
  const y0 = y + Math.min(0, toppMin - dy - (over ? over.rader * over.linje + 18 : 0));
  const flytt = (a: PlateAnker): PlateAnker => ({ x: r2(x + a.x), y: r2(y + a.y), ...(a.retning ? { retning: a.retning } : {}) });
  const ankere: Partial<Record<PlateAnkerNavn, PlateAnker>> = {};
  for (const [navn, a] of Object.entries(mod.ankere) as [PlateAnkerNavn, PlateAnker][]) ankere[navn] = flytt(a);
  const lokaltOpptatt = opptattIModell(inn.type, mod, w, h, valg, f);
  const kraftankre: Partial<Record<KraftAnkerNavn, PlateAnker>> = {};
  for (const [navn, a] of Object.entries(velgKraftankre(mod, lokaltOpptatt, w, h, f)) as [KraftAnkerNavn, PlateAnker][]) kraftankre[navn] = flytt(a);
  return {
    type: inn.type,
    x,
    y,
    w,
    h,
    dx,
    dy,
    havniva: mod.hav === null ? null : y + mod.hav,
    profil: (fx) => y + ft(fx - x),
    pxPerMa: (10 * inn.fart * w) / inn.breddeKm,
    kmPerPx: inn.breddeKm / w,
    fart: inn.fart,
    t: inn.t,
    ankere,
    kraftankre,
    opptatt: lokaltOpptatt.map((b) => ({ x0: r2(x + b.x0), y0: r2(y + b.y0), x1: r2(x + b.x1), y1: r2(y + b.y1), hva: b.hva })),
    vulkaner: mod.aldre.map((a) => ({ x: r2(x + a.x), y: r2(y + a.y), alder: a.alder, aktiv: a.aktiv })),
    ramme: { x0: x, y0: r2(y0), x1: r2(x + w + dx + 2), y1: r2(y + h + (skygge && dy > 0 ? 10 : 2)) },
  };
}

/* =====================================================================================================================
 * Plategrense: komponenten
 * ================================================================================================================== */

/** Props til `Plategrense`. */
export interface PlategrenseProps {
  type: PlategrenseType;
  /** Subduksjon: 'hav-kontinent' (standard, vulkaner i en fjellkjede) eller 'hav-hav' (øybue). */
  variant?: SubduksjonVariant;
  /** Øverste venstre hjørne av snittet foran (eller kartet). Blokka stikker dx til høyre og dy opp (se geometrien). */
  x?: number;
  y?: number;
  /** Bredden og høyden på snittet foran (kartet for transform). */
  w: number;
  h: number;
  /**
   * Tid i millioner år siden start: platene har flyttet seg fart · t. Hva det gjør med figuren, avhenger av typen:
   * - spredning og transform (standard 5): bølgene på havbunnen og de magnetiske stripene følger med; stripene viser
   *   havbunnen som er dannet siden start for 5 millioner år siden, så ved t = 5 er mønsteret som i dag
   *   (`magnetiskeStriper`).
   * - subduksjon (standard 5): bølgene på havbunnsplata følger med inn mot grøfta.
   * - kollisjon (standard 50): fjellkjeden og fjellrota vokser med sammenskyvingen S = fart · t · 10 km som
   *   1 − e^(−S/500); ved t = 0 har kontinentene akkurat møttes.
   * - varmt punkt (standard 5): vulkankjeden vokser; det er alltid minst én aktiv vulkan over plumen.
   */
  t?: number;
  /**
   * Relativ fart mellom platene i cm per år (full spredningsfart, konvergens eller farten over et varmt punkt); ved en
   * spredningsrygg flytter hver side seg med fart/2. Standard etter typen (`PLATE_FART`).
   */
  fart?: number;
  /** Hvor mange km bredden svarer til (vannrett målestokk). Standard etter typen (`PLATE_BREDDE_KM`). */
  breddeKm?: number;
  /** Magnetiske striper (normal og omvendt polaritet, 0–5 millioner år) på havbunnen: spredning og transform. */
  striper?: boolean;
  /** Dybden på blokka (perspektivet; 0 = flatt snitt). Standard ca. 0,13 · w (høyst 110). */
  dybde?: number;
  /** Vinkelen på perspektivet i grader (standard 34). */
  vinkel?: number;
  /** Fartspiler for platene (VIZ.velocity) med «x cm/år». Standard på. */
  piler?: boolean;
  /** Fartspilenes målestokk i enheter per cm/år (standard 0,028 · w). Lengden er høyst 0,35 · w. */
  pilSkala?: number;
  /** Strømning i mantelen (tynne piler i VIZ.velocity). Standard på. */
  strom?: boolean;
  /** Jordskjelv (stjerner) der de er vanlige. Standard på. */
  skjelv?: boolean;
  /** Magma: smeltesoner, diapirer, magmakammer, kanaler og glød i kraterne. Standard på. */
  magma?: boolean;
  /** Navn på lagene i snittet og på formene over blokka (havgrop, rygg, vulkan …). Over blokka trengs ca. 30–60 enheter. */
  etiketter?: boolean;
  /** Varmt punkt: alderen over hver vulkan (standard på). */
  aldre?: boolean;
  /** Myk skygge under blokka (standard på). */
  skygge?: boolean;
  dim?: boolean;
  /** Tegnes oppå i figurens koordinater, med geometrien (ankerpunkter til kraftpiler og etiketter). */
  children?: (g: PlategrenseGeometri) => ReactNode;
}

const KJEGLE_MONSTRE: readonly MonsterId[] = ['leirskifer'];

/** Teksten på en fartspil: «2 cm/år», «2,5 cm/år». */
function fartTekst(v: number): string {
  return `${fmt(v, Math.abs(v - Math.round(v)) < 0.05 ? 0 : 1)} cm/år`;
}

/** Mønstrene for kontinentalskorpe (små kryss), skorpe på den andre kontinentet og havbunnsskorpe (små v-er). */
function SkorpeMonstre({ uid }: { uid: string }) {
  const k = useGeoScale();
  const s = useGeoStroke();
  const u = (1.1 * s) / k;
  const kB = mix(GEO.skorpeKontinent.fill, GEO.bergart.gneis.fill, 0.45);
  return (
    <defs>
      <pattern id={`${uid}-kont`} patternUnits="userSpaceOnUse" width={26} height={20} patternTransform={`scale(${r2(k)})`}>
        <rect width={26} height={20} fill={GEO.skorpeKontinent.fill} />
        <path d="M4 5h5M6.5 2.5v5M17 14h5M19.5 11.5v5" stroke={GEO.skorpeKontinent.line} strokeWidth={u} strokeLinecap="round" opacity={0.5} />
      </pattern>
      <pattern id={`${uid}-kontB`} patternUnits="userSpaceOnUse" width={26} height={20} patternTransform={`scale(${r2(k)})`}>
        <rect width={26} height={20} fill={kB} />
        <path d="M4 5h5M6.5 2.5v5M17 14h5M19.5 11.5v5" stroke={GEO.skorpeKontinent.line} strokeWidth={u} strokeLinecap="round" opacity={0.45} />
      </pattern>
      <pattern id={`${uid}-hav`} patternUnits="userSpaceOnUse" width={22} height={12} patternTransform={`scale(${r2(k)})`}>
        <rect width={22} height={12} fill={GEO.skorpeHav.fill} />
        <path d="M3 3.5l2.5 3 2.5-3M14 8.5l2.5 3 2.5-3" fill="none" stroke={GEO.skorpeHav.line} strokeWidth={u} strokeLinecap="round" strokeLinejoin="round" opacity={0.5} />
      </pattern>
    </defs>
  );
}

/** Magmakamre og diapirer: glødende linser (varmest i midten), ingen filtre. */
function MagmaLinser({ linser, gid }: { linser: readonly Ellipse[]; gid: string }) {
  const s = useGeoStroke();
  return (
    <g>
      {linser.map((e, i) => (
        <ellipse key={i} cx={r2(e.x)} cy={r2(e.y)} rx={r2(e.rx)} ry={r2(e.ry)} fill={`url(#${gid})`} stroke={GEO.magma.line} strokeWidth={1.5 * s} />
      ))}
    </g>
  );
}

/** Smeltesoner: delvis smeltet mantel (svak rød tone med dråper av magma). */
function Smeltesone({ p, seed }: { p: readonly P[]; seed: number }) {
  const k = useGeoScale();
  const s = useGeoStroke();
  const drapper = useMemo(() => {
    const xs = p.map((q) => q[0]);
    const ys = p.map((q) => q[1]);
    const x0 = Math.min(...xs);
    const x1 = Math.max(...xs);
    const y0 = Math.min(...ys);
    const y1 = Math.max(...ys);
    const rnd = sceneRandom(seed);
    const avst = 11 * k;
    const ut: P[] = [];
    const n = Math.min(90, Math.ceil(((x1 - x0) * (y1 - y0)) / (avst * avst)) * 2);
    for (let i = 0; i < n * 3 && ut.length < n; i++) {
      const x = x0 + rnd() * (x1 - x0);
      const y = y0 + rnd() ** 1.4 * (y1 - y0);
      if (!iPolygon(p, x, y)) continue;
      if (ut.some((q) => Math.hypot(q[0] - x, q[1] - y) < avst)) continue;
      ut.push([x, y]);
    }
    return ut;
  }, [p, seed, k]);
  return (
    <g>
      <path d={glattSti(p, true)} fill={alpha(GEO.magma.fill, 0.22)} stroke={alpha(GEO.magma.line, 0.6)} strokeWidth={1.1 * s} strokeDasharray={`${r2(4 * s)} ${r2(3 * s)}`} />
      {drapper.map(([x, y], i) => (
        <g key={i}>
          <ellipse cx={r2(x)} cy={r2(y)} rx={r2(2.6 * k)} ry={r2(1.9 * k)} fill={GEO.magma.fill} />
          <circle cx={r2(x - 0.8 * k)} cy={r2(y - 0.6 * k)} r={r2(0.7 * k)} fill={MAGMA_GLOD.kjerne} />
        </g>
      ))}
    </g>
  );
}

/** Strømningspil: tynn kurve i VIZ.velocity med pilhode. */
function Strompil({ p }: { p: readonly P[] }) {
  const s = useGeoStroke();
  if (p.length < 2) return null;
  const a = p[p.length - 2]!;
  const b = p[p.length - 1]!;
  const L = 9 * s;
  const n = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
  const kort: P[] = [...p.slice(0, -1), [b[0] - ((b[0] - a[0]) / n) * L * 0.7, b[1] - ((b[1] - a[1]) / n) * L * 0.7]];
  return (
    <g opacity={0.85}>
      <path d={glattSti(kort)} fill="none" stroke={VIZ.surface} strokeWidth={4.4 * s} strokeLinecap="round" opacity={0.5} />
      <path d={glattSti(kort)} fill="none" stroke={VIZ.velocity} strokeWidth={2.2 * s} strokeLinecap="round" />
      <path d={pilhode(b, b[0] - a[0], b[1] - a[1], L)} fill={VIZ.velocity} />
    </g>
  );
}

/** Props til `SkjelvStjerne`. */
export interface SkjelvStjerneProps {
  /** Midten (hyposenteret eller episenteret) i figurens koordinater. */
  x: number;
  y: number;
  /** Radius ytterst på takkene før `useGeoScale` (standard 4,6, så stjerna blir ca. 7 enheter på telefon). */
  r?: number;
  /** Fyllfarge (standard `GEO.fare[1]`, gul); kanten er alltid `VIZ.ink`. */
  farge?: string;
  /** Halvgjennomsiktig (eldre skjelv, eller skjelv bak noe annet). */
  dim?: boolean;
}

/**
 * Jordskjelvsymbolet som `Plategrense` bruker: en liten femtakket stjerne med mørk kant, som på lærebokkart over
 * hyposentre og episentre. Størrelsen ganges med `useGeoScale`, så den synes på mobil. Ankerpunkt: (x, y) er midten.
 *   <SkjelvStjerne x={g.ankere.skjelvsone.x} y={g.ankere.skjelvsone.y} />
 *   {liste.map((p, i) => <SkjelvStjerne key={i} x={p.x} y={p.y} r={3 + p.styrke} farge={GEO.fare[3]} />)}
 */
export function SkjelvStjerne({ x, y, r = 4.6, farge = GEO.fare[1], dim }: SkjelvStjerneProps) {
  const k = useGeoScale();
  const s = useGeoStroke();
  if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(r) || !(r > 0)) return null;
  return <path d={stjerneSti(x, y, r * k)} fill={farge} stroke={VIZ.ink} strokeWidth={0.8 * s} strokeLinejoin="round" opacity={dim ? 0.45 : undefined} />;
}

/** Jordskjelv: små stjerner (hyposentre). */
function Skjelv({ p }: { p: readonly P[] }) {
  return (
    <g>
      {p.map(([x, y], i) => (
        <SkjelvStjerne key={i} x={x} y={y} />
      ))}
    </g>
  );
}

/**
 * Plategrense i illustrert realisme. Spredning, subduksjon, kollisjon og varmt punkt er blokkdiagram (snittet foran,
 * havbunnen eller landskapet oppå i svakt perspektiv, sideflaten til høyre) med litosfære (skorpe og stiv mantel),
 * astenosfære, magma (smeltesoner ved trykkavlastning under ryggen og i mantelkilen over plata, diapirer, kammer og
 * kanal), havgrop, skjelvsone, mantelstrømning og fartspiler. Transform er et kart over havbunnen ovenfra med to
 * ryggsegmenter, den aktive transformforkastningen og bruddsonene. `t` (millioner år) flytter platene: bølgene på
 * havbunnen, de magnetiske stripene (spredning og transform) og vulkankjeden over et varmt punkt følger med.
 * Loddrett er ikke i målestokk; vannrett gir `breddeKm` målestokken.
 *
 * Ankerpunkt: (x, y) er øverste venstre hjørne av snittet foran (kartet for transform). Bakkanten er forskjøvet
 * (dx, −dy) fra `snittblokkPerspektiv(dybde, vinkel)`, og havnivået ligger ca. 0,2 · h ned (0,26 · h ved varmt punkt).
 * Bruk `plategrenseGeometri(props, f)` for ankerpunktene: `kraftankre` til kraftpiler (platetrekk, ryggskyv, platene
 * som skyver), valgt fri for kit-ets egne lagnavn og fartspiler (`opptatt`), `ankere` til etiketter, og `ramme` til
 * viewBox-en. Krefter tegner kapitlet selv med VIZ-fargene. På mobil trenger lagnavnene og fartspilene mer plass:
 * gjør h høyere når teksten vokser, f.eks. h = 0,42 · w · (1 + 0,22 · (f − 1)) med f fra `useContainerTextScale`.
 *   <Plategrense type="spredning" x={20} y={70} w={700} h={300} striper t={t} fart={4} />
 *   <Plategrense type="subduksjon" variant="hav-hav" x={20} y={70} w={700} h={300} etiketter>
 *     {(g) => g.ankere.platetrekk && <ForceArrow … color={VIZ.gravity} />}
 *   </Plategrense>
 */
export function Plategrense(props: PlategrenseProps) {
  return props.type === 'transform' ? <TransformKart {...props} /> : <PlateBlokk {...props} />;
}

function PlateBlokk(props: PlategrenseProps) {
  const f = useTextScale();
  const s = useGeoStroke();
  const k = useGeoScale();
  const uid = useSvgId('plate');
  const monstre = useLagMonstre('plate');
  const inn = normaliser(props);
  const { type, variant, w, h, t, fart, breddeKm, striper, dybde, dx, dy } = inn;
  const mod = useMemo(
    () => byggModell({ type, variant, w, h, t, fart, breddeKm, striper, dybde, dx, dy, x: 0, y: 0 }),
    [type, variant, w, h, t, fart, breddeKm, striper, dybde, dx, dy],
  );
  const { piler = true, strom = true, skjelv = true, magma = true, etiketter = false, aldre = true, skygge = true, dim, children } = props;
  const geo = geometriFra(inn, mod, valgFra(props, w), f);
  const ft = frontToppFor(mod);
  const kjegler = magma ? mod.kjegler : mod.kjegler.map((kj) => ({ ...kj, glo: 0 }));

  const FYLL: Record<Fyll, string> = {
    kontinent: `url(#${uid}-kont)`,
    kontinentB: `url(#${uid}-kontB)`,
    havskorpe: `url(#${uid}-hav)`,
    litosfare: GEO.litosfare.fill,
    astenosfare: GEO.astenosfare.fill,
    normal: GEO.polaritet.normal.fill,
    omvendt: GEO.polaritet.omvendt.fill,
    sediment: monstre.fyll('leirskifer').fill,
  };
  const LINJE: Record<Fyll, string> = {
    kontinent: GEO.skorpeKontinent.line,
    kontinentB: GEO.skorpeKontinent.line,
    havskorpe: GEO.skorpeHav.line,
    litosfare: GEO.litosfare.line,
    astenosfare: GEO.astenosfare.line,
    normal: GEO.polaritet.normal.line,
    omvendt: GEO.polaritet.omvendt.line,
    sediment: GEO.bergart.leirskifer.line,
  };
  const side: SideBand[] = mod.side.map((b) =>
    b.fyll === 'vann' ? { y0: b.y0, y1: b.y1, fill: SCENE.waterDeep, line: SCENE.waterLight } : { y0: b.y0, y1: b.y1, fill: FYLL[b.fyll], line: LINJE[b.fyll] },
  );
  const sideMedAsteno: SideBand[] = [];
  {
    // Astenosfæren fyller hullene på sideflaten
    let y = side[0]?.y0 ?? mod.profil(w);
    for (const b of side) {
      if (b.y0 > y + 0.5) sideMedAsteno.push({ y0: y, y1: b.y0, fill: FYLL.astenosfare, line: LINJE.astenosfare });
      sideMedAsteno.push(b);
      y = Math.max(y, b.y1);
    }
    if (y < h - 0.5) sideMedAsteno.push({ y0: y, y1: h, fill: FYLL.astenosfare, line: LINJE.astenosfare });
  }
  const gloId = `${uid}-glo`;
  const plumeId = `${uid}-plume`;
  const pilSkala = tall(props.pilSkala, 0.028 * w);

  const front = (
    <g>
      {mod.flater.map((fl, i) => (
        <path key={i} d={sti(fl.p, true)} fill={FYLL[fl.fyll]} stroke={LINJE[fl.fyll]} strokeWidth={1.1 * s} strokeLinejoin="round" />
      ))}
      {mod.plume && <path d={glattSti(mod.plume, true)} fill={`url(#${plumeId})`} stroke={alpha(GEO.magma.line, 0.5)} strokeWidth={1.2 * s} />}
      {kjegler.map((kj, i) => {
        // Snittet gjennom vulkanen: berg i flankefargen med lag parallelt med flanken (lyse askelag i en stratovulkan)
        const cf = (x: number) => kjegleFront(kj, x);
        const kropp = baand(kj.x - kj.r, kj.x + kj.r, cf, mod.profil, 1);
        const H = kj.fot - kj.topp;
        const ytre = (x: number) => kjegleY(kj, Math.abs(x - kj.x) / Math.max(1e-6, kj.r));
        const lag = [0.22, 0.45, 0.68];
        return (
          <g key={`k${i}`}>
            {kropp.map((p, j) => (
              <path key={j} d={sti(p, true)} fill={shade(kj.farge, 0.08)} />
            ))}
            {kj.form === 'strato'
              ? lag.map((q, j) =>
                  baand(kj.x - kj.r, kj.x + kj.r, (x) => Math.max(cf(x), ytre(x) + q * H * 0.6), (x) => Math.min(ytre(x) + (q + 0.08) * H * 0.6, mod.profil(x)), 1).map((p, n) => (
                    <path key={`${j}-${n}`} d={sti(p, true)} fill={tint(GEO.aske.fill, 0.25)} stroke={alpha(GEO.aske.line, 0.6)} strokeWidth={0.7 * s} />
                  )),
                )
              : lag.map((q, j) => (
                  <path
                    key={`l${j}`}
                    d={sti(
                      linspace(kj.x - kj.r, kj.x + kj.r, 48)
                        .map((x): P => [x, ytre(x) + q * H * 0.6])
                        .filter(([x, y]) => y < mod.profil(x) && y > cf(x)),
                    )}
                    fill="none"
                    stroke={shade(kj.farge, 0.4)}
                    strokeWidth={0.8 * s}
                    opacity={0.7}
                  />
                ))}
            {kropp.map((p, j) => (
              <path key={`o${j}`} d={sti(p, true)} fill="none" stroke={shade(kj.farge, 0.45)} strokeWidth={1.1 * s} strokeLinejoin="round" />
            ))}
          </g>
        );
      })}
      {mod.linjer.map((l, i) =>
        l.type === 'fold' ? null : (
          <path
            key={`li${i}`}
            d={sti(l.p)}
            fill="none"
            stroke={l.type === 'sutur' ? mix(GEO.skorpeKontinent.line, VIZ.ink, 0.55) : mix(GEO.skorpeKontinent.line, VIZ.ink, 0.3)}
            strokeWidth={(l.type === 'sutur' ? 2.4 : 1.5) * s}
            strokeDasharray={l.type === 'sutur' ? `${r2(7 * s)} ${r2(4 * s)}` : undefined}
            strokeLinecap="round"
          />
        ),
      )}
      {mod.foldKlipp.length > 0 && (
        <g clipPath={`url(#${uid}-fold)`}>
          {mod.linjer
            .filter((l) => l.type === 'fold')
            .map((l, i) => (
              <path key={`f${i}`} d={glattSti(l.p)} fill="none" stroke={GEO.skorpeKontinent.line} strokeWidth={1.1 * s} opacity={0.55} />
            ))}
        </g>
      )}
      {magma && mod.smelte.map((p, i) => <Smeltesone key={`s${i}`} p={p} seed={7 + i} />)}
      {magma &&
        mod.kanaler.map((kn, i) => (
          <g key={`kn${i}`} fill="none" strokeLinecap="round" strokeLinejoin="round">
            <path d={glattSti(kn.p)} stroke={GEO.magma.line} strokeWidth={kn.b + 2.2 * s} />
            <path d={glattSti(kn.p)} stroke={MAGMA_GLOD.kanal} strokeWidth={kn.b} />
          </g>
        ))}
      {magma && <MagmaLinser linser={[...mod.diapirer, ...mod.kamre]} gid={gloId} />}
      {magma &&
        mod.vaeske.map(([a, b], i) => (
          <g key={`v${i}`}>
            <line
              x1={r2(a[0])}
              y1={r2(a[1])}
              x2={r2(b[0] - (b[0] - a[0]) * 0.18)}
              y2={r2(b[1] - (b[1] - a[1]) * 0.18)}
              stroke={GEO.grunnvann.line}
              strokeWidth={1.5 * s}
              strokeDasharray={`${r2(3 * s)} ${r2(2.5 * s)}`}
            />
            <path d={pilhode(b, b[0] - a[0], b[1] - a[1], 6 * s)} fill={GEO.grunnvann.line} />
          </g>
        ))}
    </g>
  );

  // Etiketter over blokka
  const over = etiketter ? overEtiketter(mod.overTekster, w + dx, f) : null;
  const toppMin = Math.min(...linspace(0, w, 120).map(ft), mod.hav ?? Infinity);
  const yOver = toppMin - dy - 12;
  const aldreTekster = mod.aldre
    .filter((a) => a.x > 0)
    .map((a) => ({ ...a, tekst: a.aktiv ? 'aktiv' : fmtAlder(a.alder, { enhet: 'millioner', desimaler: a.alder < 10 ? 1 : 0, kort: true }) }));
  const aldreRader = overEtiketter(aldreTekster, w + dx, f, 0.68);

  const fri = (
    <g>
      {skjelv && <Skjelv p={mod.skjelv} />}
      {strom && mod.strom.map((p, i) => <Strompil key={`st${i}`} p={p} />)}
      {piler &&
        mod.farter.map((fp, i) => {
          const L = Math.min(0.35 * w, pilSkala * fp.fart);
          if (!(L > 3)) return null;
          const x1 = fp.x - (fp.retning * L) / 2;
          const x2 = fp.x + (fp.retning * L) / 2;
          return (
            <ForceArrow
              key={`p${i}`}
              x1={r2(x1)}
              y1={r2(fp.y)}
              x2={r2(x2)}
              y2={r2(fp.y)}
              color={VIZ.velocity}
              width={5.5}
              label={fartTekst(fp.fart)}
              labelX={r2(fp.x)}
              labelY={r2(fp.y - 9 - 4 * f)}
              labelAnchor="middle"
              labelSize={0.72}
            />
          );
        })}
      {etiketter &&
        mod.lagTekster.map((l, i) => (
          <Txt key={`lt${i}`} x={r2(l.x)} y={r2(l.y)} size={0.72} weight={620} anchor={l.anchor}>
            {l.tekst}
          </Txt>
        ))}
      {over &&
        mod.overTekster.map((o, i) => {
          const bredde = o.tekst.length * 0.58 * 17 * 0.8 * f;
          const lx = klemme(o.x, bredde / 2, w + dx - bredde / 2);
          return (
            <Callout key={`ot${i}`} x={r2(o.x)} y={r2(o.y)} lx={r2(lx)} ly={r2(yOver - (over.rad[i] ?? 0) * over.linje)} anchor="middle" size={0.8}>
              {o.tekst}
            </Callout>
          );
        })}
      {aldre &&
        type === 'varmt-punkt' &&
        aldreTekster.map((a, i) => {
          const b = a.tekst.length * 0.58 * 17 * 0.68 * f;
          return (
            <Txt
              key={`a${i}`}
              x={r2(klemme(a.x, b / 2, w + dx - b / 2))}
              y={r2(Math.min(a.y, mod.hav ?? a.y) - 8 * k - (aldreRader.rad[i] ?? 0) * aldreRader.linje)}
              size={0.68}
              weight={600}
              muted={!a.aktiv}
            >
              {a.tekst}
            </Txt>
          );
        })}
    </g>
  );

  return (
    <g opacity={dim ? 0.4 : undefined}>
      <g transform={`translate(${r2(inn.x)} ${r2(inn.y)})`}>
        <SkorpeMonstre uid={uid} />
        <LagMonstre id={monstre.id} bare={KJEGLE_MONSTRE} />
        <defs>
          {mod.foldKlipp.length > 0 && (
            <clipPath id={`${uid}-fold`}>
              {mod.foldKlipp.map((p, i) => (
                <path key={i} d={sti(p, true)} />
              ))}
            </clipPath>
          )}
        </defs>
        <RadialGradient
          id={gloId}
          fx={0.45}
          fy={0.4}
          stops={MAGMA_GLOD_STOPP}
        />
        <LinearGradient
          id={plumeId}
          x2={1}
          y2={0}
          stops={[
            [0, mix(GEO.astenosfare.fill, GEO.magma.fill, 0.18)],
            [0.5, mix(GEO.astenosfare.fill, GEO.magma.fill, 0.5)],
            [1, mix(GEO.astenosfare.fill, GEO.magma.fill, 0.18)],
          ]}
        />
        <Blokk
          w={w}
          h={h}
          dx={dx}
          dy={dy}
          dybde={dybde}
          profil={mod.profil}
          toppProfil={mod.toppProfil}
          frontTopp={ft}
          hav={mod.hav}
          toppFarge={mod.topp}
          toppSkygge={!(type === 'spredning' && striper)}
          vannAlfa={striper ? 0.4 : 0.6}
          side={sideMedAsteno}
          kjegler={kjegler}
          front={front}
          frontFri={fri}
          skygge={skygge}
        />
      </g>
      {children?.(geo)}
    </g>
  );
}

/** Transformforkastning ovenfra: havbunnen som kart med to ryggsegmenter, forkastningen og bruddsonene. */
function TransformKart(props: PlategrenseProps) {
  const f = useTextScale();
  const s = useGeoStroke();
  const k = useGeoScale();
  const inn = normaliser(props);
  const { x, y, w, h, fart, t, breddeKm } = inn;
  const mod = useMemo(() => modellTransform({ w, h, fart, t, kmPerPx: breddeKm / w, striper: false, variant: 'hav-kontinent', dybde: 0 }), [w, h, fart, t, breddeKm]);
  const { piler = true, skjelv = true, etiketter = false, dim, children } = props;
  const geo = geometriFra(inn, mod, { ...valgFra(props, w), skygge: false }, f);
  const { xa, xb, yf } = transformMaal(w, h);
  const kmPerPx = breddeKm / w;
  const vh = (5 * fart) / kmPerPx;
  const forsk = vh * t;
  const striper = props.striper ? magnetiskeStriper(fart, t) : [];
  const grunt = mix(GEO.skorpeHav.fill, SCENE.waterLight, 0.5);
  const dypt = mix(GEO.skorpeHav.fill, SCENE.waterDeep, 0.6);
  const farge = (avst: number): string => {
    const km = avst * kmPerPx;
    const st = striper.find((p) => km >= p.fra && km < p.til);
    if (st) return st.normal ? GEO.polaritet.normal.fill : GEO.polaritet.omvendt.fill;
    return mix(grunt, dypt, Math.round(Math.sqrt(Math.min(1, avst / (0.45 * w))) * 12) / 12);
  };
  const steg = Math.max(1.5, w / 220);
  const halvdeler = [
    { y0: 0, y1: yf, rygg: xa },
    { y0: yf, y1: h, rygg: xb },
  ];
  const lam = Math.max(10, 0.04 * w);
  const pilSkala = tall(props.pilSkala, 0.028 * w);
  const midt = (xa + xb) / 2;
  const Ls = Math.min(0.35 * w, pilSkala * (fart / 2));
  const klippId = useSvgId('transform');
  return (
    <g opacity={dim ? 0.4 : undefined}>
      <g transform={`translate(${r2(x)} ${r2(y)})`}>
        <defs>
          <clipPath id={klippId}>
            <rect width={r2(w)} height={r2(h)} />
          </clipPath>
        </defs>
        <g clipPath={`url(#${klippId})`}>
          {halvdeler.map((hd, i) => {
            // Striper og dybde: like farger slås sammen til lengre rektangler
            const runs: { x0: number; x1: number; fill: string }[] = [];
            for (let xx = 0; xx < w; xx += steg) {
              const fill = farge(Math.abs(xx + steg / 2 - hd.rygg));
              const siste = runs[runs.length - 1];
              if (siste && siste.fill === fill) siste.x1 = xx + steg;
              else runs.push({ x0: xx, x1: xx + steg, fill });
            }
            const linjer: number[] = [];
            for (let j = 0; j < 40; j++) {
              const d = j * lam + (((forsk % lam) + lam) % lam);
              if (d > 0.04 * w) linjer.push(hd.rygg + d, hd.rygg - d);
            }
            return (
              <g key={i}>
                {runs.map((r, j) => (
                  <rect key={j} x={r2(r.x0)} y={r2(hd.y0)} width={r2(r.x1 - r.x0 + 0.6)} height={r2(hd.y1 - hd.y0)} fill={r.fill} />
                ))}
                {linjer
                  .filter((lx) => lx > 0 && lx < w)
                  .map((lx, j) => (
                    <line key={`l${j}`} x1={r2(lx)} x2={r2(lx)} y1={r2(hd.y0)} y2={r2(hd.y1)} stroke={shade(dypt, 0.2)} strokeWidth={0.9 * s} opacity={0.28} />
                  ))}
                {/* Ryggen: en lys, hevet rygg med riftdalen midt i, oppå stripene */}
                <rect x={r2(hd.rygg - 0.016 * w)} y={r2(hd.y0)} width={r2(0.032 * w)} height={r2(hd.y1 - hd.y0)} fill={tint(grunt, 0.4)} />
                <rect x={r2(hd.rygg - 0.016 * w)} y={r2(hd.y0)} width={r2(0.012 * w)} height={r2(hd.y1 - hd.y0)} fill={SCENE.highlight} opacity={0.5} />
                <line x1={r2(hd.rygg - 0.016 * w)} x2={r2(hd.rygg - 0.016 * w)} y1={r2(hd.y0)} y2={r2(hd.y1)} stroke={SCENE.outline} strokeWidth={0.8 * s} opacity={0.5} />
                <line x1={r2(hd.rygg + 0.016 * w)} x2={r2(hd.rygg + 0.016 * w)} y1={r2(hd.y0)} y2={r2(hd.y1)} stroke={SCENE.outline} strokeWidth={0.8 * s} opacity={0.5} />
                {/* Ryggaksen som dobbel strek i magmafarge (som på kart over havbunnen) */}
                {[-1, 1].map((sd) => (
                  <g key={sd}>
                    <line x1={r2(hd.rygg + sd * 2.6 * s)} x2={r2(hd.rygg + sd * 2.6 * s)} y1={r2(hd.y0)} y2={r2(hd.y1)} stroke={VIZ.surface} strokeWidth={3.4 * s} opacity={0.7} />
                    <line x1={r2(hd.rygg + sd * 2.6 * s)} x2={r2(hd.rygg + sd * 2.6 * s)} y1={r2(hd.y0)} y2={r2(hd.y1)} stroke={GEO.magma.fill} strokeWidth={1.8 * s} />
                  </g>
                ))}
              </g>
            );
          })}
          {/* Lys fra nordvest over ryggene og et lite sprang ved bruddsonene */}
          <rect width={r2(w)} height={r2(h)} fill={alpha(SCENE.shadow, 0.08)} />
          <line x1={0} x2={r2(xa)} y1={r2(yf)} y2={r2(yf)} stroke={mix(GEO.skorpeHav.line, VIZ.ink, 0.35)} strokeWidth={1.6 * s} strokeDasharray={`${r2(7 * s)} ${r2(5 * s)}`} opacity={0.8} />
          <line x1={r2(xb)} x2={r2(w)} y1={r2(yf)} y2={r2(yf)} stroke={mix(GEO.skorpeHav.line, VIZ.ink, 0.35)} strokeWidth={1.6 * s} strokeDasharray={`${r2(7 * s)} ${r2(5 * s)}`} opacity={0.8} />
          <line x1={r2(xa)} x2={r2(xb)} y1={r2(yf)} y2={r2(yf)} stroke={VIZ.surface} strokeWidth={5 * s} opacity={0.6} />
          <line x1={r2(xa)} x2={r2(xb)} y1={r2(yf)} y2={r2(yf)} stroke={mix(GEO.skorpeHav.line, VIZ.ink, 0.65)} strokeWidth={2.8 * s} />
        </g>
        <rect width={r2(w)} height={r2(h)} fill="none" stroke={SCENE.outline} strokeWidth={1.2 * s} />
        {skjelv && <Skjelv p={mod.skjelv} />}
        {piler && Ls > 3 && (
          <g>
            <ForceArrow x1={r2(midt - Ls / 2)} y1={r2(yf - 13 * k)} x2={r2(midt + Ls / 2)} y2={r2(yf - 13 * k)} color={VIZ.velocity} width={4.5} />
            <ForceArrow x1={r2(midt + Ls / 2)} y1={r2(yf + 13 * k)} x2={r2(midt - Ls / 2)} y2={r2(yf + 13 * k)} color={VIZ.velocity} width={4.5} />
            {mod.farter.map((fp, i) => {
              const L = Math.min(0.35 * w, pilSkala * fp.fart);
              return (
                <ForceArrow
                  key={i}
                  x1={r2(fp.x - (fp.retning * L) / 2)}
                  y1={r2(fp.y)}
                  x2={r2(fp.x + (fp.retning * L) / 2)}
                  y2={r2(fp.y)}
                  color={VIZ.velocity}
                  width={5.5}
                  label={i % 2 === 0 ? fartTekst(fp.fart) : undefined}
                  labelX={r2(fp.x)}
                  labelY={r2(fp.y - 9 - 4 * f)}
                  labelAnchor="middle"
                  labelSize={0.72}
                />
              );
            })}
          </g>
        )}
        {etiketter && (
          <g>
            <Callout x={r2(xa + 0.012 * w)} y={r2(0.2 * h)} lx={r2(xa + 0.07 * w)} ly={r2(0.11 * h)} anchor="start" size={0.75}>
              Spredningsrygg
            </Callout>
            <Callout x={r2(midt + 0.07 * w)} y={r2(yf)} lx={r2(midt + 0.07 * w)} ly={r2(yf + 0.2 * h)} anchor="middle" size={0.75}>
              Transformforkastning
            </Callout>
            <Callout x={r2(xa * 0.45)} y={r2(yf)} lx={r2(xa * 0.45)} ly={r2(yf - 0.14 * h)} anchor="middle" size={0.75}>
              Bruddsone
            </Callout>
          </g>
        )}
      </g>
      {children?.(geo)}
    </g>
  );
}

/* =====================================================================================================================
 * Vulkan
 * ================================================================================================================== */

/** Skjoldvulkan (slak, av tynt flytende basaltlava) eller stratovulkan (bratt, lag av lava og aske). */
export type VulkanType = 'skjold' | 'strato';

/** Valg til `vulkanGeometri` (samme som propsene til `Vulkan`). */
export interface VulkanValg {
  /** Midt under toppen, på bakken (foran i snitt). */
  x: number;
  y: number;
  /** Bredden ved foten. */
  bredde: number;
  /** Høyden (standard 0,36 · bredde for strato, 0,14 · bredde for skjold; lavere når den er erodert). */
  hoyde?: number;
  type?: VulkanType;
  /** Erosjon 0–1 (mest for strato): lavere, bredere krater, dype raviner og vegetasjon høyere opp. */
  erosjon?: number;
  /** Utbrudd 0–1: glød i krateret, lavastrøm, lavafontene (skjold) og askesky (strato) vokser med tallet. */
  utbrudd?: number;
  /** Vulkanen skåret i to foran, på en blokk av berggrunnen med magmakammer og kanaler. */
  snitt?: boolean;
  /** Dypet på blokka under bakken i snitt (standard 0,6 · bredde). */
  dyp?: number;
  /** Bredden på blokka i snitt (standard 1,7 · bredde). */
  blokkBredde?: number;
  /** Dybden på blokka i snitt (perspektivet, standard 0,55 · bredde, så kjegla er rund) og vinkelen (standard 30°). */
  dybde?: number;
  vinkel?: number;
  /** Vind (−1 til 1): askeskya driver mot venstre eller høyre. */
  vind?: number;
  /** Høyden på askeskya over krateret ved fullt utbrudd (standard 2,6 · høyden for strato). */
  askeHoyde?: number;
  /** Lavastrøm ned flanken (standard: skjold ved utbrudd, strato ved utbrudd over 0,4). Et tall 0–1 er lengden. */
  lavastrom?: boolean | number;
  /** Lavafontene i krateret (standard: skjold ved utbrudd). */
  lavafontene?: boolean;
  /** Askesky (standard: strato ved utbrudd). */
  askesky?: boolean;
}

/** Geometrien til `Vulkan` i figurens koordinater. */
export interface VulkanGeometri {
  type: VulkanType;
  /** Foten (venstre og høyre kant foran) og toppen (kraterkanten foran). */
  fot: { venstre: { x: number; y: number }; hoyre: { x: number; y: number } };
  topp: { x: number; y: number };
  /** Midten av kraterbunnen. */
  krater: { x: number; y: number };
  /** Magmakammeret (bare i snitt). */
  magmakammer: Ellipse | null;
  /** Midt på hovedkanalen (bare i snitt). */
  kanal: { x: number; y: number } | null;
  /** Fronten av lavastrømmen og toppen av askeskya eller lavafontenen (når de vises). */
  lavastrom: { x: number; y: number } | null;
  /** Midt på lavastrømmen (til en etikett eller pil som peker på strømmen). */
  lavastromMidt: { x: number; y: number } | null;
  askesky: { x: number; y: number } | null;
  lavafontene: { x: number; y: number } | null;
  /** Snittet foran (eller omrisset fra siden) ved figurens x: y på flanken (Infinity utenfor foten). */
  profil: (x: number) => number;
  /** Hvor figuren tegner (med askesky og blokk), til viewBox-en. Etiketter i kolonne kommer i tillegg. */
  ramme: { x0: number; y0: number; x1: number; y1: number };
  /** Høyden og bredden etter standardverdier, og blokka i snitt (dx, dy, dyp, blokkbredde). */
  hoyde: number;
  bredde: number;
  blokk: { dx: number; dy: number; dyp: number; bredde: number } | null;
}

interface VulkanModell {
  type: VulkanType;
  R: number;
  H: number;
  e: number;
  u: number;
  kjegle: Kjegle;
  snitt: boolean;
  bb: number;
  dyp: number;
  dybde: number;
  dx: number;
  dy: number;
  kammer: Ellipse | null;
  lava: number;
  fontene: boolean;
  aske: boolean;
  askeTopp: number;
  fonteneH: number;
  vind: number;
  /** Synsvinkelen for vulkanen alene (ovenfra): 0,16. */
  oy: number;
}

function vulkanModell(v: VulkanValg): VulkanModell {
  const type: VulkanType = v.type === 'skjold' ? 'skjold' : 'strato';
  const bredde = Math.max(10, tall(v.bredde, 300));
  const R = bredde / 2;
  const e = klemme(tall(v.erosjon, 0), 0, 1);
  const u = klemme(tall(v.utbrudd, 0), 0, 1);
  const Hstd = type === 'strato' ? 0.36 * bredde * (1 - 0.42 * e) : 0.14 * bredde * (1 - 0.25 * e);
  const H = Math.max(4, tall(v.hoyde, Hstd));
  const snitt = v.snitt ?? false;
  const bb = Math.max(bredde, tall(v.blokkBredde, 1.7 * bredde));
  const dyp = Math.max(10, tall(v.dyp, 0.6 * bredde));
  const dybde = snitt ? Math.max(0, tall(v.dybde, 0.55 * bredde)) : 0;
  const { dx, dy } = snitt ? snittblokkPerspektiv(dybde, v.vinkel ?? 30) : { dx: 0, dy: 0 };
  const kjegle: Kjegle = {
    x: 0,
    r: R,
    rz: snitt ? Math.min(R, 0.9 * Math.max(1, dybde)) : R,
    topp: -H,
    fot: 0,
    form: type,
    krater: type === 'strato' ? { u: 0.075 + 0.1 * e, dyp: Math.min(0.09 * H, 0.06 * H * (1 + e)) } : { u: 0.065, dyp: 0.035 * H },
    ru: type === 'strato' ? e : e * 0.5,
    farge: type === 'strato' ? VULKAN_STRATO : VULKAN_SKJOLD,
    sno: null,
    gront: type === 'strato' ? 0.08 + 0.3 * e : 0.1 + 0.2 * e,
    glo: u > 0 ? 0.4 + 0.6 * u : 0,
    seed: 11,
  };
  const lavaStd = u > 0 && (type === 'skjold' || u > 0.4) ? 0.25 + 0.75 * u : 0;
  const lava = v.lavastrom === undefined ? lavaStd : typeof v.lavastrom === 'number' ? klemme(tall(v.lavastrom, 0), 0, 1) : v.lavastrom ? Math.max(0.35, lavaStd) : 0;
  const fontene = v.lavafontene ?? (type === 'skjold' && u > 0);
  const aske = v.askesky ?? (type === 'strato' && u > 0);
  const askeMaks = Math.max(0, tall(v.askeHoyde, 2.6 * H));
  return {
    type,
    R,
    H,
    e,
    u,
    kjegle,
    snitt,
    bb,
    dyp,
    dybde,
    dx,
    dy,
    kammer: snitt
      ? type === 'strato'
        ? { x: 0, y: 0.62 * dyp, rx: 0.42 * R, ry: 0.17 * dyp }
        : { x: 0, y: 0.4 * dyp, rx: 0.5 * R, ry: 0.12 * dyp }
      : null,
    lava,
    fontene: fontene && u > 0,
    aske: aske && u > 0,
    askeTopp: askeMaks * (0.25 + 0.75 * u),
    fonteneH: (0.35 + 0.95 * u) * Math.max(H, 0.1 * bredde),
    vind: klemme(tall(v.vind, 0.3), -1, 1),
    oy: 0.16,
  };
}

/** Punktet midt på en polylinje (etter lengden), flyttet (x, y). */
function midtPaa(p: readonly P[], x: number, y: number): { x: number; y: number } | null {
  if (p.length === 0) return null;
  let total = 0;
  for (let i = 1; i < p.length; i++) total += Math.hypot(p[i]![0] - p[i - 1]![0], p[i]![1] - p[i - 1]![1]);
  let igjen = total / 2;
  for (let i = 1; i < p.length; i++) {
    const a = p[i - 1]!;
    const b = p[i]!;
    const l = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (l >= igjen && l > 0) return { x: x + a[0] + ((b[0] - a[0]) * igjen) / l, y: y + a[1] + ((b[1] - a[1]) * igjen) / l };
    igjen -= l;
  }
  const sist = p[p.length - 1]!;
  return { x: x + sist[0], y: y + sist[1] };
}

/** Punktene på kraterkanten foran (y) og kraterbunnen. */
function vulkanKrater(m: VulkanModell): { kant: number; bunn: number } {
  return { kant: kjegleY(m.kjegle, m.kjegle.krater?.u ?? 0), bunn: kjegleMedKrater(m.kjegle, 0) };
}

/** Lavastrømmen som bånd ned flanken ved vinkelen phi (lokale koordinater). */
function lavastromOmriss(k: Kjegle, ox: number, oy: number, phi: number, lengde: number): { omriss: P[]; midt: P[]; front: P } | null {
  if (!(lengde > 0.02)) return null;
  const u0 = (k.krater?.u ?? 0.03) * 0.9;
  const u1 = u0 + (1 - u0) * klemme(lengde, 0, 1) * 0.97;
  const us = linspace(u0, u1, 18);
  const bredde = (u: number) => k.r * (0.03 + 0.1 * ((u - u0) / (1 - u0 || 1)));
  const vri = (u: number) => phi + 0.07 * Math.sin(u * 10);
  const venstre = us.map((u) => kjeglePunkt(k, u, vri(u) - bredde(u) / Math.max(1e-6, u * k.r), ox, oy));
  const hoyre = us.map((u) => kjeglePunkt(k, u, vri(u) + bredde(u) / Math.max(1e-6, u * k.r), ox, oy));
  const midt = us.map((u) => kjeglePunkt(k, u, vri(u), ox, oy));
  const ende = midt[midt.length - 1]!;
  const a = venstre[venstre.length - 1]!;
  const b = hoyre[hoyre.length - 1]!;
  const lobe: P[] = linspace(0, Math.PI, 7).map((t): P => [
    (a[0] + b[0]) / 2 + ((a[0] - b[0]) / 2) * Math.cos(t) * 1.15,
    (a[1] + b[1]) / 2 + ((a[1] - b[1]) / 2) * Math.cos(t) + Math.sin(t) * bredde(u1) * 0.6,
  ]);
  return { omriss: [...venstre, ...lobe, ...hoyre.reverse()], midt, front: ende };
}

/**
 * Geometrien til en `Vulkan` uten å tegne: foten, toppen, krateret, magmakammeret og kanalen (i snitt), fronten av
 * lavastrømmen og toppen av askeskya, profilen og rammen figuren tegner innenfor. Null for ugyldige tall.
 */
export function vulkanGeometri(v: VulkanValg): VulkanGeometri | null {
  if (!v || ![v.x, v.y, v.bredde].every(Number.isFinite) || !(v.bredde > 0)) return null;
  const m = vulkanModell(v);
  const { x, y } = v;
  const kr = vulkanKrater(m);
  const ox = m.snitt ? m.dx / Math.max(1, m.dybde) : 0;
  const oy = m.snitt ? m.dy / Math.max(1, m.dybde) : m.oy;
  const phi = m.snitt ? Math.PI * 0.3 : -Math.PI * 0.62;
  const ls = lavastromOmriss(m.kjegle, ox, oy, phi, m.lava);
  const kanalTopp = kr.bunn;
  const askeTopp = m.aske ? kr.kant - m.askeTopp : Infinity;
  const fonteneTopp = m.fontene ? kr.bunn - m.fonteneH : Infinity;
  const spredning = m.aske ? m.R * (0.5 + 1.1 * m.u) * (1 + Math.abs(m.vind) * 0.6) : 0;
  const toppY = Math.min(-m.H, askeTopp - 0.25 * m.R * (0.3 + m.u), fonteneTopp - 6, m.snitt ? -m.dy - 4 : -m.H);
  const x0 = m.snitt ? -m.bb / 2 : -m.R;
  const x1 = m.snitt ? m.bb / 2 + m.dx : m.R;
  return {
    type: m.type,
    hoyde: m.H,
    bredde: 2 * m.R,
    fot: { venstre: { x: x - m.R, y }, hoyre: { x: x + m.R, y } },
    topp: { x, y: y + kr.kant },
    krater: { x, y: y + kr.bunn },
    magmakammer: m.kammer ? { x: x + m.kammer.x, y: y + m.kammer.y, rx: m.kammer.rx, ry: m.kammer.ry } : null,
    kanal: m.kammer ? { x, y: y + (m.kammer.y - m.kammer.ry + kanalTopp) / 2 } : null,
    lavastrom: ls ? { x: x + ls.front[0], y: y + ls.front[1] } : null,
    lavastromMidt: ls ? midtPaa(ls.midt, x, y) : null,
    askesky: m.aske ? { x: x + m.vind * spredning * 0.5, y: y + askeTopp } : null,
    lavafontene: m.fontene ? { x, y: y + fonteneTopp } : null,
    profil: (fx) => y + kjegleFront(m.kjegle, fx - x),
    ramme: {
      x0: r2(x + Math.min(x0, m.aske ? m.vind * spredning * 0.5 - spredning * 1.15 : x0)),
      y0: r2(y + toppY),
      x1: r2(x + Math.max(x1, m.aske ? m.vind * spredning * 0.5 + spredning * 1.15 : x1)),
      y1: r2(y + (m.snitt ? m.dyp + 10 : m.R * m.oy + 4)),
    },
    blokk: m.snitt ? { dx: m.dx, dy: m.dy, dyp: m.dyp, bredde: m.bb } : null,
  };
}

/** Props til `Vulkan`. */
export interface VulkanProps extends VulkanValg {
  /** Krateret (standard på). */
  krater?: boolean;
  /** Magmakammeret i snitt er størknet til en dypbergart (standard når vulkanen er sterkt erodert uten utbrudd). */
  stivnet?: boolean;
  /** Snø på toppen (strato). */
  sno?: boolean;
  /** Grønt på de nedre flankene og på bakken (standard på). */
  vegetasjon?: boolean;
  /** Navnene i en kolonne til høyre (krater, askesky, lavastrøm, lag, hovedkanal, magmakammer). */
  etiketter?: boolean;
  /** Der kolonnen med etiketter står (standard like til høyre for vulkanen eller blokka). */
  etikettX?: number;
  dim?: boolean;
  /** Tegnes oppå, med geometrien. */
  children?: (g: VulkanGeometri) => ReactNode;
}

const VULKAN_MONSTRE: readonly MonsterId[] = ['basalt', 'aske', 'sandstein', 'leirskifer', 'gneis', 'granitt', 'diabas'];

/** Lavafontene: glødende søyle som sprer seg i toppen, sprut som faller i buer og kjølnes, og glød rundt. */
function Lavafontene({ x, y, hoyde, styrke, seed }: { x: number; y: number; hoyde: number; styrke: number; seed: number }) {
  const k = useGeoScale();
  const s = useGeoStroke();
  const gid = useSvgId('fontene-glo');
  const sid = useSvgId('fontene-sole');
  if (!(hoyde > 2)) return null;
  const rnd = sceneRandom(seed);
  const topp = y - hoyde;
  const b0 = Math.max(2.5, hoyde * 0.05);
  const bt = hoyde * 0.16;
  const n = Math.round(26 + 50 * styrke);
  const drapper: { x: number; y: number; r: number; q: number }[] = [];
  for (let i = 0; i < n; i++) {
    // Sprut fra toppen av søyla i parabler ned til begge sider; q = hvor langt den har falt (0–1)
    const side = rnd() < 0.5 ? -1 : 1;
    const spenn = side * hoyde * (0.12 + 0.45 * rnd());
    const q = rnd();
    const start = topp + hoyde * 0.12 * rnd();
    drapper.push({ x: x + spenn * q + (rnd() - 0.5) * bt, y: start + (y - start) * q * q - hoyde * 0.12 * q * (1 - q), r: (0.9 + 1.5 * rnd()) * k, q });
  }
  return (
    <g>
      <RadialGradient
        id={gid}
        stops={[
          [0, GEO.lava.fill, 0.6],
          [0.45, GEO.lava.fill, 0.22],
          [1, GEO.lava.fill, 0],
        ]}
      />
      <LinearGradient
        id={sid}
        stops={[
          [0, mix(GEO.lava.fill, GEO.lava.line, 0.45)],
          [0.35, GEO.lava.fill],
          [1, tint(GEO.lava.fill, 0.55)],
        ]}
      />
      <ellipse cx={r2(x)} cy={r2(y - hoyde * 0.45)} rx={r2(hoyde * 0.6)} ry={r2(hoyde * 0.8)} fill={`url(#${gid})`} />
      <path
        d={`M${r2(x - b0)} ${r2(y)}C${r2(x - b0)} ${r2(y - hoyde * 0.5)} ${r2(x - bt * 0.9)} ${r2(topp + hoyde * 0.25)} ${r2(x - bt)} ${r2(topp + bt * 0.6)}Q${r2(x - bt * 0.7)} ${r2(topp - bt * 0.25)} ${r2(x)} ${r2(topp)}Q${r2(x + bt * 0.7)} ${r2(topp - bt * 0.25)} ${r2(x + bt)} ${r2(topp + bt * 0.6)}C${r2(x + bt * 0.9)} ${r2(topp + hoyde * 0.25)} ${r2(x + b0)} ${r2(y - hoyde * 0.5)} ${r2(x + b0)} ${r2(y)}Z`}
        fill={`url(#${sid})`}
        stroke={GEO.lava.line}
        strokeWidth={0.9 * s}
        strokeLinejoin="round"
      />
      {drapper.map((d, i) => (
        <circle
          key={i}
          cx={r2(d.x)}
          cy={r2(d.y)}
          r={r2(d.r)}
          fill={d.q > 0.7 ? mix(GEO.lava.line, GEO.aske.line, 0.5) : d.q > 0.4 ? mix(GEO.lava.fill, GEO.lava.line, 0.45) : GEO.lava.fill}
          stroke={d.q > 0.7 ? 'none' : GEO.lava.line}
          strokeWidth={0.5 * s}
        />
      ))}
    </g>
  );
}

/**
 * Askesky: en søyle av bobler som vokser oppover (blomkålform), en flat paraply i toppen som driver med vinden, og
 * askeregn under paraplyen. Boblene tegnes i tre lag uten filtre: kontur rundt hele skya, fyll, og lys på oversiden
 * av hver boble (lys fra øvre venstre).
 */
function Askesky({ x, y, topp, R, styrke, vind, seed }: { x: number; y: number; topp: number; R: number; styrke: number; vind: number; seed: number }) {
  const s = useGeoStroke();
  const lys = useSvgId('aske-lys');
  const kropp = useSvgId('aske-kropp');
  const glo = useSvgId('aske-glo');
  const H = y - topp;
  if (!(H > 4)) return null;
  const rnd = sceneRandom(seed);
  const akse = (q: number) => x + vind * q * q * R * 0.8;
  const Wu = R * (0.55 + 1.25 * styrke);
  const yu = topp + H * 0.14;
  const tu = H * 0.13;
  const cu = akse(0.86) + vind * Wu * 0.45;
  type Boble = { x: number; y: number; r: number };
  const soyle: Boble[] = [];
  const nC = 26;
  for (let i = 0; i < nC; i++) {
    const q = (i + rnd() * 0.5) / nC;
    const b = R * (0.045 + 0.2 * q) * (0.75 + 0.25 * styrke);
    soyle.push({ x: akse(q) + (rnd() - 0.5) * b * 0.9, y: y - q * (y - yu) - rnd() * 3, r: b * (0.75 + 0.35 * rnd()) });
  }
  // Paraplyen: tykkest over søyla og tynnere ut mot kantene, med flatere underside
  const paraply: Boble[] = [];
  const m = 22;
  for (const rad of [0, 1]) {
    for (let j = 0; j < m; j++) {
      const q = (j + 0.5 + (rnd() - 0.5) * 0.5) / m - 0.5;
      const a = Math.max(0, 1 - (2 * Math.abs(q)) ** 1.6);
      const r = tu * (0.3 + 0.45 * a) * (0.85 + 0.3 * rnd()) * (rad === 0 ? 1 : 0.9);
      paraply.push({ x: cu + q * 2 * Wu, y: yu + (rad === 0 ? tu * 0.1 : -tu * 0.38 * a) - r * 0.1, r });
    }
  }
  const alle = [...soyle, ...paraply];
  const regn = Array.from({ length: Math.round(7 + 12 * styrke) }, (_, i) => {
    const x0 = cu + (((i + 0.5) / (7 + 12 * styrke)) * 1.7 - 0.85) * Wu + (rnd() - 0.5) * 8;
    const L = H * (0.18 + 0.35 * rnd()) * (0.5 + 0.5 * styrke);
    return { x0, y0: yu + tu * 0.45, x1: x0 + vind * L * 0.45, y1: yu + tu * 0.45 + L };
  });
  const sirkel = (p: Boble, i: number, props: Record<string, string | number>) => <circle key={i} cx={r2(p.x)} cy={r2(p.y)} r={r2(p.r)} {...props} />;
  return (
    <g>
      <RadialGradient
        id={lys}
        fx={0.32}
        fy={0.26}
        r={0.55}
        stops={[
          [0, tint(GEO.aske.fill, 0.55), 0.95],
          [0.55, tint(GEO.aske.fill, 0.3), 0.35],
          [1, GEO.aske.fill, 0],
        ]}
      />
      <LinearGradient
        id={kropp}
        userSpace
        x1={0}
        y1={r2(topp)}
        x2={0}
        y2={r2(y)}
        stops={[
          [0, GEO.aske.fill],
          [0.55, mix(GEO.aske.fill, GEO.aske.line, 0.25)],
          [1, mix(GEO.aske.fill, GEO.aske.line, 0.55)],
        ]}
      />
      <RadialGradient
        id={glo}
        stops={[
          [0, GEO.lava.fill, 0.65],
          [1, GEO.lava.fill, 0],
        ]}
      />
      {regn.map((r, i) => (
        <line key={i} x1={r2(r.x0)} y1={r2(r.y0)} x2={r2(r.x1)} y2={r2(r.y1)} stroke={GEO.aske.line} strokeWidth={1.1 * s} opacity={0.3} strokeLinecap="round" strokeDasharray={`${r2(4 * s)} ${r2(3.5 * s)}`} />
      ))}
      <ellipse cx={r2(x)} cy={r2(y - R * 0.04)} rx={r2(R * 0.2)} ry={r2(R * 0.13)} fill={`url(#${glo})`} />
      <g>{alle.map((p, i) => sirkel(p, i, { fill: 'none', stroke: alpha(GEO.aske.line, 0.75), strokeWidth: r2(2.4 * s) }))}</g>
      <g>{alle.map((p, i) => sirkel(p, i, { fill: `url(#${kropp})` }))}</g>
      <g>{alle.map((p, i) => sirkel({ ...p, r: p.r * 0.96 }, i, { fill: `url(#${lys})` }))}</g>
    </g>
  );
}

/**
 * Vulkan i illustrert realisme: skjoldvulkan (slak, av tynn basaltlava) eller stratovulkan (bratt og konkav, lag av lava
 * og aske), med lys fra øvre venstre, raviner, krater og vegetasjon nederst. `erosjon` gjør en stratovulkan lavere og
 * mer oppfurete med et bredere krater. `utbrudd` (0–1) gir glød i krateret, lavastrøm ned flanken, lavafontene
 * (skjold) og askesky med askeregn (strato); størrelsen vokser med tallet. Ingen filtre: gløden er radielle toninger.
 * Med `snitt` står vulkanen på en blokk av berggrunnen og er skåret i to foran, så lagene, hovedkanalen, en sidekanal,
 * en lagergang og magmakammeret synes.
 *
 * Ankerpunkt: (x, y) er midt under toppen, på bakken. Alene står foten som en ellipse rundt (x, y) (sett litt ovenfra,
 * ca. 0,08 · bredde ned foran); i snitt er (x, y) midt på bakkekanten foran, blokka går dyp ned og stikker dx til
 * høyre og dy opp. Askeskya kan nå 2,6 · høyden over krateret; bruk `vulkanGeometri(props).ramme` til viewBox-en.
 *   <Vulkan x={300} y={260} bredde={340} type="strato" utbrudd={u} vind={0.4} />
 *   <Vulkan x={260} y={170} bredde={300} type="skjold" snitt utbrudd={0.6} etiketter />
 */
export function Vulkan(props: VulkanProps) {
  const { x, y, krater = true, stivnet, sno, vegetasjon = true, etiketter = false, etikettX, dim, children } = props;
  const s = useGeoStroke();
  const monstre = useLagMonstre('vulkan');
  const gloId = useSvgId('vulkan-glo');
  const lavaId = useSvgId('vulkan-lava');
  const kraterGlo = useSvgId('vulkan-krater');
  const geo = vulkanGeometri(props);
  if (!geo || !Number.isFinite(x) || !Number.isFinite(y)) return null;
  const m = vulkanModell(props);
  const kj: Kjegle = {
    ...m.kjegle,
    krater: krater ? m.kjegle.krater : null,
    sno: sno && m.type === 'strato' ? 0.74 : null,
    gront: vegetasjon ? m.kjegle.gront : null,
  };
  const kr = { kant: kjegleY(kj, kj.krater?.u ?? 0), bunn: kjegleMedKrater(kj, 0) };
  const ox = m.snitt ? m.dx / Math.max(1, m.dybde) : 0;
  const oy = m.snitt ? m.dy / Math.max(1, m.dybde) : m.oy;
  const lava = lavastromOmriss(kj, ox, oy, m.snitt ? Math.PI * 0.3 : -Math.PI * 0.62, m.lava);
  const gamle = m.snitt ? [] : [-0.3, -0.82, -0.5].map((f, i) => lavastromOmriss(kj, ox, oy, Math.PI * f, [0.62, 0.5, 0.72][i]!));
  const erStivnet = stivnet ?? (m.u === 0 && m.e > 0.5);
  const aktiv = !erStivnet;

  const lavaTegning = lava && (
    <g>
      <LinearGradient
        id={lavaId}
        stops={[
          [0, tint(GEO.lava.fill, 0.25)],
          [0.55, GEO.lava.fill],
          [1, mix(GEO.lava.fill, GEO.lava.line, 0.55)],
        ]}
      />
      <path d={glattSti(lava.omriss, true)} fill={`url(#${lavaId})`} stroke={GEO.lava.line} strokeWidth={1.2 * s} strokeLinejoin="round" />
      <path d={glattSti(lava.midt)} fill="none" stroke={tint(GEO.lava.fill, 0.5)} strokeWidth={1.3 * s} strokeLinecap="round" opacity={0.85} />
    </g>
  );
  const utbruddTegning = (
    <g>
      {m.u > 0 && kj.krater && (
        <g>
          <RadialGradient
            id={gloId}
            stops={[
              [0, GEO.lava.fill, 0.5],
              [1, GEO.lava.fill, 0],
            ]}
          />
          <ellipse cx={0} cy={r2(kr.kant)} rx={r2(m.R * (0.18 + 0.2 * m.u))} ry={r2(m.R * (0.12 + 0.12 * m.u))} fill={`url(#${gloId})`} />
        </g>
      )}
      {m.fontene && <Lavafontene x={0} y={kr.bunn} hoyde={m.fonteneH} styrke={m.u} seed={5} />}
      {m.aske && <Askesky x={0} y={kr.kant} topp={kr.kant - m.askeTopp} R={m.R} styrke={m.u} vind={m.vind} seed={9} />}
    </g>
  );

  let tegning: ReactNode;
  if (!m.snitt) {
    // Hele vulkanen sett litt ovenfra
    const strimler = kjegleStrimler(kj, 0, oy, -Math.PI, Math.PI);
    const raviner = kjegleRaviner(kj, 0, oy, -Math.PI + 0.3, -0.3, m.type === 'strato' ? 8 + Math.round(m.e * 8) : 5);
    const kf = kraterFlater(kj, 0, oy, -Math.PI, Math.PI);
    tegning = (
      <g>
        <ContactShadow cx={m.R * 0.08} cy={m.R * oy * 0.4} rx={m.R * 1.08} ry={m.R * oy * 1.25} opacity={0.6} />
        {strimler.map((st, i) => (
          <path key={i} d={st.d} fill={st.fill} stroke={st.fill} strokeWidth={0.6} strokeLinejoin="round" />
        ))}
        {gamle.map((g, i) => g && <path key={`g${i}`} d={glattSti(g.omriss, true)} fill={shade(kj.farge, 0.25)} opacity={0.22} />)}
        {raviner.map((r, i) => (
          <g key={`r${i}`} fill="none" strokeLinecap="round">
            <path d={r.rygg} stroke={tint(kj.farge, 0.35)} strokeWidth={(0.9 + 0.4 * m.e) * s} opacity={0.35} />
            <path d={r.renne} stroke={shade(kj.farge, 0.38)} strokeWidth={(0.9 + 0.5 * m.e) * s} opacity={0.42} />
          </g>
        ))}
        {kf && (
          <g>
            <RadialGradient
              id={kraterGlo}
              stops={[
                [0, tint(GEO.lava.fill, 0.3)],
                [0.6, GEO.lava.fill],
                [1, GEO.lava.line],
              ]}
            />
            <path d={sti(kf.kant, true)} fill={shade(kj.farge, 0.38)} />
            <path d={sti(kf.bunn, true)} fill={kj.glo ? `url(#${kraterGlo})` : shade(kj.farge, 0.55)} />
            <path d={sti(kf.kant, true)} fill="none" stroke={tint(kj.farge, 0.2)} strokeWidth={1 * s} />
          </g>
        )}
        {lavaTegning}
        {utbruddTegning}
      </g>
    );
  } else {
    // Blokk med vulkanen skåret i to foran
    const bb = m.bb;
    const cx = bb / 2;
    const kB: Kjegle = { ...kj, x: cx };
    const dyp = m.dyp;
    const grunnlag: [number, number, MonsterId][] = [
      [0, 0.2 * dyp, 'sandstein'],
      [0.2 * dyp, 0.42 * dyp, 'leirskifer'],
      [0.42 * dyp, dyp, 'gneis'],
    ];
    const ytre = (xx: number) => kjegleY(kB, Math.abs(xx - cx) / m.R);
    const cf = (xx: number) => kjegleFront(kB, xx);
    const profil = () => 0;
    const n = m.type === 'strato' ? 6 : 1;
    const lagH = m.H / n;
    const kammer = m.kammer!;
    const kb = Math.max(4, (m.type === 'strato' ? 0.045 : 0.035) * m.R);
    const kanalFyll = aktiv ? MAGMA_GLOD.kanal : monstre.fyll('diabas').fill;
    const kanalKant = aktiv ? GEO.magma.line : GEO.bergart.diabas.line;
    const kanal = (p: P[], b: number, key: string) => (
      <g key={key} fill="none" strokeLinecap="round" strokeLinejoin="round">
        <path d={glattSti(p)} stroke={kanalKant} strokeWidth={b + 2.2 * s} />
        <path d={glattSti(p)} stroke={kanalFyll} strokeWidth={b} />
      </g>
    );
    const sideU = 0.56;
    const sidePunkt: P = [cx + sideU * m.R, ytre(cx + sideU * m.R)];
    const front = (
      <g>
        {grunnlag.map(([a, b, type], i) => (
          <path key={i} d={sti([[0, a], [bb, a], [bb, b], [0, b]], true)} fill={monstre.fyll(type).fill} stroke={GEO.bergart[type].line} strokeWidth={1 * s} />
        ))}
        {baand(cx - m.R, cx + m.R, cf, () => 0, 1).map((p, i) => (
          <path key={`k${i}`} d={sti(p, true)} fill={monstre.fyll('basalt').fill} />
        ))}
        {n > 1 &&
          Array.from({ length: n - 1 }, (_, j) =>
            baand(cx - m.R, cx + m.R, (xx) => Math.max(cf(xx), ytre(xx) + (j + 1) * lagH * 0.62), (xx) => Math.min(ytre(xx) + (j + 2) * lagH * 0.62, 0), 1).map((p, q) => {
              const type: MonsterId = j % 2 === 0 ? 'aske' : 'basalt';
              return <path key={`${j}-${q}`} d={sti(p, true)} fill={monstre.fyll(type).fill} stroke={GEO.bergart[type].line} strokeWidth={0.8 * s} />;
            }),
          )}
        {n === 1 &&
          [0.18, 0.36, 0.55, 0.74].map((q, j) => (
            <path
              key={`l${j}`}
              d={sti(
                linspace(cx - m.R, cx + m.R, 60)
                  .map((xx): P => [xx, ytre(xx) + q * m.H * 0.8])
                  .filter(([xx, yy]) => yy < 0 && yy > cf(xx)),
              )}
              fill="none"
              stroke={GEO.bergart.basalt.line}
              strokeWidth={0.9 * s}
              opacity={0.65}
            />
          ))}
        {baand(cx - m.R, cx + m.R, cf, () => 0, 1).map((p, i) => (
          <path key={`o${i}`} d={sti(p, true)} fill="none" stroke={shade(kj.farge, 0.4)} strokeWidth={1.1 * s} />
        ))}
        {/* Tilførsel fra dypet, magmakammer, hovedkanal, sidekanal og lagergang */}
        {kanal([[cx - kammer.rx * 0.1, dyp + 4], [cx - kammer.rx * 0.15, (kammer.y + dyp) / 2], [cx, kammer.y + kammer.ry * 0.5]], kb * 1.5, 'tilforsel')}
        {kanal([[cx, kammer.y - kammer.ry * 0.5], [cx + 0.02 * m.R, kammer.y * 0.5], [cx, -m.H * 0.3], [cx, kr.bunn + 1]], kb, 'hoved')}
        {m.type === 'strato' &&
          m.e < 0.6 &&
          kanal([[cx, -m.H * 0.22], [cx + 0.28 * m.R, -m.H * 0.27], [sidePunkt[0], sidePunkt[1] + 2]], kb * 0.6, 'side')}
        {kanal([[cx - 0.02 * m.R, 0.2 * dyp], [cx - 0.3 * m.R, 0.205 * dyp], [cx - 0.62 * m.R, 0.2 * dyp]], kb * 0.65, 'lagergang')}
        {erStivnet ? (
          <ellipse cx={r2(cx)} cy={r2(kammer.y)} rx={r2(kammer.rx)} ry={r2(kammer.ry)} fill={monstre.fyll('granitt').fill} stroke={GEO.bergart.granitt.line} strokeWidth={1.6 * s} />
        ) : (
          <MagmaLinser linser={[{ x: cx, y: kammer.y, rx: kammer.rx, ry: kammer.ry }]} gid={kraterGlo} />
        )}
      </g>
    );
    tegning = (
      <g transform={`translate(${r2(-bb / 2)} 0)`}>
        <RadialGradient
          id={kraterGlo}
          fx={0.45}
          fy={0.4}
          stops={MAGMA_GLOD_STOPP}
        />
        <Blokk
          w={bb}
          h={dyp}
          dx={m.dx}
          dy={m.dy}
          dybde={m.dybde}
          profil={profil}
          frontTopp={(xx) => Math.min(0, cf(xx))}
          hav={null}
          toppFarge={() => (vegetasjon ? SCENE.grass : SCENE.soil)}
          side={grunnlag.map(([a, b, type]) => ({ y0: a, y1: b, fill: monstre.fyll(type).fill, line: GEO.bergart[type].line }))}
          kjegler={[{ ...kB, glo: aktiv ? kB.glo : 0 }]}
          front={front}
          overflate={lavaTegning && <g transform={`translate(${r2(cx)} 0)`}>{lavaTegning}</g>}
          frontFri={<g transform={`translate(${r2(cx)} 0)`}>{utbruddTegning}</g>}
        />
      </g>
    );
  }

  const etikettListe: SnittEtikett[] = [];
  if (etiketter) {
    if (geo.askesky) etikettListe.push({ x: geo.askesky.x, y: (geo.askesky.y + geo.topp.y) / 2, tekst: 'Askesky' });
    if (geo.lavafontene) etikettListe.push({ x: x + m.fonteneH * 0.12, y: geo.krater.y - m.fonteneH * 0.55, tekst: 'Lavafontene' });
    // Punktene spres så strekene ikke samles nær toppen: kraterkanten, midt på lavastrømmen og laget langt ut i flanken
    if (krater) etikettListe.push({ x: x + m.R * (kj.krater?.u ?? 0) * 1.05, y: geo.topp.y, tekst: 'Krater' });
    if (geo.lavastromMidt) etikettListe.push({ x: geo.lavastromMidt.x, y: geo.lavastromMidt.y, tekst: 'Lavastrøm' });
    if (m.snitt) {
      const xl = x + 0.66 * m.R;
      const yf = geo.profil(xl);
      etikettListe.push({ x: xl, y: Number.isFinite(yf) ? y + 0.5 * (yf - y) : y - m.H * 0.1, tekst: m.type === 'strato' ? 'Lag av lava og aske' : 'Lavalag' });
      if (geo.kanal) etikettListe.push({ x, y: geo.kanal.y, tekst: 'Hovedkanal' });
      if (geo.magmakammer) etikettListe.push({ x: x + geo.magmakammer.rx * 0.5, y: geo.magmakammer.y, tekst: 'Magmakammer' });
    }
  }
  const kolonne = etikettX ?? x + (m.snitt ? m.bb / 2 + m.dx : m.R * 1.02) + 22;

  return (
    <g opacity={dim ? 0.4 : undefined}>
      <LagMonstre id={monstre.id} bare={VULKAN_MONSTRE} />
      <g transform={`translate(${r2(x)} ${r2(y)})`}>{tegning}</g>
      {etiketter && etikettListe.length > 0 && <SnittEtiketter x={kolonne} topp={geo.ramme.y0} bunn={geo.ramme.y1} etiketter={etikettListe} />}
      {children?.(geo)}
    </g>
  );
}
