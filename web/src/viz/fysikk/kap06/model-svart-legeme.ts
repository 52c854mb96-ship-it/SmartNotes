/**
 * Ren fysikk og geometri for «Stråling fra svarte legemer» (k6-svart-legeme), uten React, så den kan testes for seg.
 * Strålingslovene selv (Planck, Wien, Stefan–Boltzmann) ligger i model.ts; her er det som bare denne
 * visualiseringen trenger: legemene i scenen, temperaturlinjalen, fordelingen på UV, synlig lys og IR, hvor sterkt
 * et legeme gløder, aksene i grafen og plasseringen av navnene.
 */
import { fmt, superscript } from '../../kit/format';
import { C_LIGHT, H_PLANCK, K_BOLTZMANN, VISIBLE, blackbodyRgb, planckBand, wienPeak } from './model';

/* ---------- Temperaturene ---------- */

/** Glidebryteren og temperaturlinjalen går fra 700 K (ingen synlig glød) til 12 000 K (Rigel). */
export const T_MIN = 700;
export const T_MAX = 12000;
export const T_STEP = 50;
/** Overflatetemperaturen til Sola, som intensitetene sammenlignes med. */
export const T_SUN = 5800;
/** Under omtrent 800 K gløder ikke et legeme så vi ser det (Drapers punkt er 798 K). */
export const T_GLOW_START = 800;
/** Grensen mellom «på jorda» og «i verdensrommet» på temperaturlinjalen (mellom glødelampa og Betelgeuse). */
export const T_SPLIT = 3150;

export type LegemeId = 'kokeplate' | 'smijern' | 'lampe' | 'betelgeuse' | 'sola' | 'sirius' | 'rigel';

export interface Legeme {
  id: LegemeId;
  /** Navnet i scenen og på knappen. */
  navn: string;
  /** Omtrentlig overflatetemperatur (K). */
  T: number;
  sted: 'jorda' | 'rommet';
}

/** Legemene i scenen, sortert etter temperatur. Tallene er omtrentlige (som i læreboka). */
export const LEGEMER: Legeme[] = [
  { id: 'kokeplate', navn: 'Kokeplate', T: 900, sted: 'jorda' },
  { id: 'smijern', navn: 'Smijern', T: 1500, sted: 'jorda' },
  { id: 'lampe', navn: 'Glødelampe', T: 2800, sted: 'jorda' },
  { id: 'betelgeuse', navn: 'Betelgeuse', T: 3500, sted: 'rommet' },
  { id: 'sola', navn: 'Sola', T: 5800, sted: 'rommet' },
  { id: 'sirius', navn: 'Sirius', T: 9900, sted: 'rommet' },
  { id: 'rigel', navn: 'Rigel', T: 12000, sted: 'rommet' },
];

/** Legemet som har akkurat temperaturen T, ellers undefined. */
export function legemeVed(T: number): Legeme | undefined {
  return LEGEMER.find((l) => l.T === T);
}

/** Rund av og hold temperaturen innenfor glidebryteren (steg på 50 K). */
export function snapT(T: number): number {
  if (!Number.isFinite(T)) return T_SUN;
  const s = Math.round(T / T_STEP) * T_STEP;
  return Math.min(T_MAX, Math.max(T_MIN, s));
}

/* ---------- Temperaturlinjalen (logaritmisk) ---------- */

export interface Linjal {
  /** Temperaturene i endene (K). */
  Ta: number;
  Tb: number;
  /** x-koordinatene til endene i figuren. */
  xa: number;
  xb: number;
}

/**
 * x-koordinaten til temperaturen T på en logaritmisk linjal: like store forhold (for eksempel dobbel temperatur)
 * gir like lange steg. Utenfor linjalen holdes x i endene.
 */
export function linjalX(T: number, l: Linjal): number {
  const t = Math.min(l.Tb, Math.max(l.Ta, Number.isFinite(T) && T > 0 ? T : l.Ta));
  return l.xa + ((l.xb - l.xa) * Math.log(t / l.Ta)) / Math.log(l.Tb / l.Ta);
}

/** Temperaturen ved x på linjalen (det motsatte av linjalX). */
export function linjalT(x: number, l: Linjal): number {
  const u = Math.min(1, Math.max(0, (x - l.xa) / (l.xb - l.xa)));
  return l.Ta * (l.Tb / l.Ta) ** u;
}

/** Fine temperaturer for streker med tall på linjalen. */
export const LINJAL_TALL = [1000, 2000, 3000, 5000, 10000];
/** Små streker uten tall (100-, 1000-steg). */
export const LINJAL_SMAA = [700, 800, 900, 1500, 4000, 6000, 7000, 8000, 9000, 12000];

/* ---------- Fordelingen av strålingen ---------- */

/**
 * Hele arealet under Planck-kurven med konstantene i modellen: 2π⁵k⁴T⁴ / (15c²h³). Med de avrundede konstantene
 * blir dette 5,64 · 10⁻⁸ · T⁴, altså 0,5 % under σT⁴ med σ = 5,67 · 10⁻⁸. Brukes til å regne ut andelene, så de blir
 * 100 % til sammen.
 */
export function planckTotal(T: number): number {
  if (!(T > 0)) return 0;
  return (2 * Math.PI ** 5 * K_BOLTZMANN ** 4 * T ** 4) / (15 * C_LIGHT ** 2 * H_PLANCK ** 3);
}

export interface Andeler {
  /** Ultrafiolett, λ < 380 nm. */
  uv: number;
  /** Synlig lys, 380–750 nm. */
  synlig: number;
  /** Infrarødt, λ > 750 nm. */
  ir: number;
}

/** Hvor stor del av strålingen som er UV, synlig lys og IR (0–1, til sammen 1). */
export function andeler(T: number): Andeler {
  const total = planckTotal(T);
  if (!(total > 0)) return { uv: 0, synlig: 0, ir: 1 };
  const uv = Math.min(1, planckBand(T, 1e-9, VISIBLE[0], 2000) / total);
  const synlig = Math.min(1 - uv, planckBand(T, VISIBLE[0], VISIBLE[1], 400) / total);
  return { uv, synlig, ir: Math.max(0, 1 - uv - synlig) };
}

/* ---------- Gløden ---------- */

/** Utstrålt synlig lys (W/m²) fra et svart legeme. */
const synligEffekt = (T: number) => planckBand(T, VISIBLE[0], VISIBLE[1], 200);
const LOG_START = Math.log10(synligEffekt(T_GLOW_START));
const LOG_FULL = Math.log10(synligEffekt(2000));

/**
 * Hvor sterkt legemet gløder for øyet, 0–1: 0 under omtrent 800 K (ingen synlig glød), så jevnt opp til 1 ved
 * 2 000 K. Øyet oppfatter lysstyrke omtrent logaritmisk, så skalaen er logaritmen til det synlige lyset.
 */
export function glodNivaa(T: number): number {
  if (!(T > T_GLOW_START)) return 0;
  const v = (Math.log10(synligEffekt(T)) - LOG_START) / (LOG_FULL - LOG_START);
  return Math.min(1, Math.max(0, v));
}

/**
 * Fargen et glødende legeme har på en mørk bakgrunn (sRGB 0–255): fargen fra blackbodyRgb, svakere jo mindre
 * synlig lys legemet sender ut. Under 800 K blir den svart (ingen glød).
 */
export function glodRgb(T: number): [number, number, number] {
  const k = glodNivaa(T) ** 0.6;
  const [r, g, b] = blackbodyRgb(T);
  return [Math.round(r * k), Math.round(g * k), Math.round(b * k)];
}

/** Hva øyet ser, til forklaringen. */
export type GlodTrinn = 'ingen' | 'morkerod' | 'oransje' | 'gulhvit' | 'hvit' | 'blaahvit';

export function glodTrinn(T: number): GlodTrinn {
  const peakNm = wienPeak(T) * 1e9;
  if (T < T_GLOW_START) return 'ingen';
  if (T < 1300) return 'morkerod';
  if (T < 2200) return 'oransje';
  if (peakNm > VISIBLE[1] * 1e9) return 'gulhvit';
  if (peakNm >= VISIBLE[0] * 1e9) return 'hvit';
  return 'blaahvit';
}

/* ---------- Grafen ---------- */

/**
 * Lengden på bølgelengdeaksen (nm): 3 000, 6 000 eller 12 000 nm, den minste som rommer tre ganger λ_maks.
 * Da får hele toppen og det meste av halen plass, og aksen bytter bare i to faste steg.
 */
export function spekterMaksNm(T: number): number {
  const need = 3 * wienPeak(T) * 1e9;
  for (const L of [3000, 6000, 12000]) if (L >= need - 1e-6) return L;
  return 12000;
}

/** Rund opp til et pent tall (1, 1,2, 1,5, 2, 2,5, 3, 4, 5, 6, 8 · 10ⁿ). */
export function niceCeil(v: number): number {
  if (!(v > 0)) return 1;
  const mag = 10 ** Math.floor(Math.log10(v));
  for (const c of [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10]) if (c * mag >= v * (1 - 1e-12)) return c * mag;
  return 10 * mag;
}

/**
 * Tallene på y-aksen. Vanlige desimaltall når de har høyst fire desimaler (0,0005 og oppover), ellers standardform
 * med samme tierpotens på alle (0,5 · 10⁻⁴, 1,0 · 10⁻⁴ …), så små tall ved lave temperaturer blir lette å lese.
 * Null skrives alltid «0».
 */
export function yTickLabels(ticks: number[]): string[] {
  const max = Math.max(...ticks.map(Math.abs), 0);
  const step = ticks.length > 1 ? Math.abs((ticks[1] ?? 0) - (ticks[0] ?? 0)) : max;
  if (!(max > 0) || !(step > 0)) return ticks.map(() => '0');
  const d = decimalsFor(step);
  if (d <= 4) return ticks.map((v) => (Math.abs(v) < step * 1e-6 ? '0' : fmt(v, d)));
  const E = Math.floor(Math.log10(max) + 1e-9);
  const m = step / 10 ** E;
  const dm = Math.abs(m - Math.round(m)) < 1e-9 ? 0 : 1;
  return ticks.map((v) => (Math.abs(v) < step * 1e-6 ? '0' : `${fmt(v / 10 ** E, dm)} · 10${superscript(E)}`));
}

/** Hvor mange desimaler som trengs for å skrive `step` nøyaktig (0,25 → 2, 5 → 0, 0,00005 → 5). */
export function decimalsFor(step: number): number {
  if (!(step > 0) || !Number.isFinite(step)) return 0;
  for (let d = 0; d < 12; d++) {
    const v = step * 10 ** d;
    if (Math.abs(v - Math.round(v)) < 1e-6 * Math.max(1, v)) return d;
  }
  return 12;
}

/* ---------- Navnene i scenen ---------- */

export interface Etikett {
  /** Ønsket midtpunkt (over legemet). */
  x: number;
  /** Bredden på etiketten. */
  w: number;
  /** Etiketten må holde seg mellom min og max (panelet den står i). */
  min: number;
  max: number;
}

/**
 * Plasser navnene: hver etikett flyttes innenfor panelet sitt (så den ikke går utenfor), og legges i rad 0 (nederst)
 * hvis det er plass, ellers i rad 1, 2 … Etikettene i samme rad overlapper aldri (minst `gap` mellom dem).
 */
export function plasserEtiketter(list: Etikett[], gap = 6): { x: number; rad: number }[] {
  const placed: { x: number; w: number; rad: number }[] = [];
  return list.map((e) => {
    const half = e.w / 2;
    const x = Math.min(e.max - half, Math.max(e.min + half, e.x));
    let rad = 0;
    while (placed.some((p) => p.rad === rad && Math.abs(p.x - x) < (p.w + e.w) / 2 + gap)) rad++;
    placed.push({ x, w: e.w, rad });
    return { x, rad };
  });
}
