/**
 * Geometrien i scenen til «Blanding og termisk likevekt» (ren, uten React, testes i blanding-scene.test.ts).
 *
 * Forsøket står i et kalorimeter av isopor (snitt, med lokk) på en labbenk:
 * - Varmt og kaldt vann: det varme vannet står i et tynt metallbeger midt i karet, og det kalde vannet fyller ringen
 *   rundt. Da kan vi måle begge temperaturene mens energien går gjennom metallveggen. (Heller vi vannet rett sammen,
 *   blir sluttemperaturen den samme.)
 * - Metallbit i vann: en sylinder av metall ligger på bunnen av et smalere isoporkar med kaldt vann.
 *
 * Alle mål er i centimeter med én fast skala (k px/cm) i hele figuren, så vannstanden og størrelsen på metallbiten
 * følger massen: h = V/A og V = m/ρ.
 */

export type MetalId = 'aluminium' | 'jern' | 'kobber' | 'bly';

/** Tetthet (kg/m³), bare for å tegne metallbiten i riktig størrelse. */
export const METAL_DENSITY: Record<MetalId, number> = {
  aluminium: 2700,
  jern: 7870,
  kobber: 8960,
  bly: 11340,
};
export const WATER_DENSITY = 1000;

/** Volum (cm³) av massen m (kg) med tettheten rho (kg/m³). */
export function volumeCm3(m: number, rho: number): number {
  if (!(m > 0) || !(rho > 0)) return 0;
  return (m / rho) * 1e6;
}

export interface CupGeo {
  /** Ytre radius, høyde og veggtykkelse (cm). */
  r: number;
  h: number;
  wall: number;
}

export interface CalorimeterGeo {
  /** Innvendig radius og høyde i isoporkaret (cm). */
  innerR: number;
  innerH: number;
  /** Tykkelsen på isoporveggen, bunnen og lokket (cm). */
  wall: number;
  base: number;
  lid: number;
  /** Metallbegeret med varmt vann (bare i vannforsøket). */
  cup?: CupGeo;
}

/** Vannforsøket: isoporkar (Ø 20 cm) med et tynt metallbeger (Ø 13 cm) i midten. 2 kg varmt vann står 15,8 cm. */
export const CAL_WATER: CalorimeterGeo = { innerR: 10, innerH: 19, wall: 2.5, base: 2.5, lid: 2.5, cup: { r: 6.5, h: 18, wall: 0.15 } };
/**
 * Metallforsøket: smalere isoporkar (Ø 12,5 cm), så 0,5 kg vann dekker 0,5 kg jern. 1 kg vann står 8,1 cm
 * (11,2 cm med 1 kg aluminium i).
 */
export const CAL_METAL: CalorimeterGeo = { innerR: 6.25, innerH: 14, wall: 2.5, base: 2.5, lid: 2.5 };
/** Metallbiten ligger litt til venstre for midten og termometeret til høyre (cm fra midten). */
export const METAL_BLOCK_X = -1.2;
export const METAL_THERMO_X = 4.3;

/** Høyden på termometrene (cm), fra bunnen av kula til toppen av røret. Kula står 0,4 cm over bunnen. */
export const THERMO_LENGTH = 26;
export const THERMO_LIFT = 0.4;

/** Vannstanden (cm) i et sylindrisk kar med radius r (cm) for m kg vann. */
export function levelInCylinder(m: number, r: number): number {
  if (!(r > 0)) return 0;
  return volumeCm3(m, WATER_DENSITY) / (Math.PI * r * r);
}

/** Vannstanden (cm) i ringen mellom to sylindere (radius rInner < rOuter). */
export function levelInRing(m: number, rInner: number, rOuter: number): number {
  const a = Math.PI * (rOuter * rOuter - rInner * rInner);
  if (!(a > 0)) return 0;
  return volumeCm3(m, WATER_DENSITY) / a;
}

export interface MetalBlock {
  /** Diameter og høyde (cm); sylinderen er like høy som den er bred. */
  d: number;
  h: number;
  /** Volum (cm³). */
  V: number;
}

/** Metallbiten som en sylinder med høyde = diameter: V = π d³/4. */
export function metalBlock(metal: MetalId, m: number): MetalBlock {
  const V = volumeCm3(m, METAL_DENSITY[metal]);
  const d = Math.cbrt((4 * V) / Math.PI);
  return { d, h: d, V };
}

export interface LevelWithBlock {
  /** Vannstanden (cm) over bunnen. */
  level: number;
  /** Om metallbiten er helt dekket av vann. */
  covered: boolean;
}

/**
 * Vannstanden når en sylinder (metallbiten) står på bunnen av et kar med radius r. Vannet fyller rommet rundt
 * sylinderen: under toppen av biten er arealet π r² − π (d/2)², over den hele π r².
 */
export function levelWithBlock(mWater: number, block: MetalBlock, r: number): LevelWithBlock {
  const Vw = volumeCm3(mWater, WATER_DENSITY);
  const A = Math.PI * r * r;
  const Ab = Math.PI * (block.d / 2) ** 2;
  if (!(A > Ab)) return { level: 0, covered: false };
  const low = Vw / (A - Ab);
  if (low <= block.h) return { level: low, covered: low >= block.h - 1e-9 };
  return { level: (Vw + Ab * block.h) / A, covered: true };
}

/**
 * Hvor sterk energistrømmen er nå i forhold til starten (0–1). Den er proporsjonal med temperaturforskjellen
 * (Newtons avkjølingslov), så den er 1 ved start og går mot 0 i termisk likevekt.
 */
export function flowFraction(T1: number, T2: number, T1start: number, T2start: number): number {
  const gap = T1start - T2start;
  if (!(gap > 1e-9)) return 0;
  return Math.min(1, Math.max(0, (T1 - T2) / gap));
}

/**
 * Hvor varm vannfargen skal se ut (0 = vanlig vann, 1 = så varmt som skalaen går). 20 °C og kaldere er 0, og
 * 100 °C er 1. Begge vannmengdene får samme farge når temperaturene er like.
 */
export function warmth(T: number): number {
  if (!Number.isFinite(T)) return 0;
  return Math.min(1, Math.max(0, (T - 20) / 80));
}

/**
 * Hvor kula og toppen av skalaen havner på kit-ets Termometer (lab-varme.tsx), i enheter under ankerpunktet
 * (bunnen av kula). Samme formler som i kit-et: rørbredden tw = max(7, 0,06 · H). Brukes til en strek for
 * sluttemperaturen ved siden av termometeret.
 */
export function thermoScaleY(H: number, min: number, max: number, v: number): number {
  const tw = Math.max(7, H * 0.06);
  const bl = tw * 2.3;
  const yMin = -bl - tw * 0.9;
  const yMax = -H + tw * 1.3;
  const frac = Math.min(1.03, Math.max(-0.035, (v - min) / (max - min)));
  return yMin + (yMax - yMin) * frac;
}

/** Rørbredden på kit-ets Termometer med lengden H. */
export function thermoTubeWidth(H: number): number {
  return Math.max(7, H * 0.06);
}

/**
 * Plasserer to skilt på samme linje (sentrene a < b, bredder wa og wb) så de ikke overlapper: er de for nær
 * hverandre, skyves begge like mye til hver sin side. Deretter flyttes paret innenfor [lo, hi].
 */
export function separateTags(a: number, wa: number, b: number, wb: number, gap: number, lo: number, hi: number): [number, number] {
  let x1 = a;
  let x2 = b;
  const need = (wa + wb) / 2 + gap;
  if (x2 - x1 < need) {
    const mid = (x1 + x2) / 2;
    x1 = mid - need / 2;
    x2 = mid + need / 2;
  }
  const left = x1 - wa / 2;
  if (left < lo) {
    x1 += lo - left;
    x2 += lo - left;
  }
  const right = x2 + wb / 2;
  if (right > hi) {
    x1 -= right - hi;
    x2 -= right - hi;
  }
  return [x1, x2];
}

/** Bredden på kit-ets ValueTag med `chars` tegn (samme formel som i overlay.tsx). */
export function valueTagWidth(chars: number, f: number, size = 0.9): number {
  const fs = 17 * f * size;
  return Math.max(fs * 1.6, chars * fs * 0.6 + 16 * f);
}

export interface SceneLayout {
  /** viewBox-bredde og -høyde. */
  W: number;
  H: number;
  /** Overflaten på labbenken. */
  benchY: number;
  /** Piksler per centimeter. */
  k: number;
  /** Midten av kalorimeteret. */
  cx: number;
  /** Vannkoker/kokeplate til venstre og mugge til høyre (bare på bred skjerm). */
  props: boolean;
}

/**
 * Oppsettet: bred skjerm viser hele benken (kokeplate eller vannkoker, kalorimeteret og en mugge), mobil zoomer inn
 * på kalorimeteret med større skala, så termometrene og pilene synes. `f` er tekstskaleringen (useTextScale).
 */
export function sceneLayout(narrow: boolean, f = narrow ? 1.8 : 1): SceneLayout {
  const k = narrow ? 18 : 12;
  const top = THERMO_LENGTH + THERMO_LIFT + CAL_WATER.base;
  // Plass over termometrene til skiltene (høyde 1,55 · 17 · 0,9 · f) og en strek ned
  const tagSpace = 17 * 0.9 * f * 1.55 + 26 * f + 8;
  const depth = narrow ? 70 : 64;
  const benchY = Math.round(tagSpace + top * k);
  return { W: 800, H: benchY + depth, benchY, k, cx: 400, props: !narrow };
}
