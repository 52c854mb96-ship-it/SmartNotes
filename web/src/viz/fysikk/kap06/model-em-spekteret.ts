/**
 * Ren fysikk for «Det elektromagnetiske spekteret i hverdagen» (k6-em-spekteret), ingen React.
 * Alle elektromagnetiske bølger går med lysfarten c i vakuum, så c = λf: kort bølgelengde gir høy frekvens.
 * Hvert foton har energien E = hf = hc / λ. Spekteret vises på en logaritmisk skala fra 1 km til 0,1 pm.
 */
import { fmt, fmtSci } from '../../kit/format';

/* ---------- Konstanter (verdiene i ERGO Fysikk 1) ---------- */

/** Lysfarten c (m/s). */
export const C = 3.0e8;
/** Plancks konstant h (J s). */
export const H = 6.63e-34;
/** Elementærladningen e (C): 1 eV = 1,60 · 10⁻¹⁹ J. */
export const E_CHARGE = 1.6e-19;
/** Konstanten i Wiens forskyvningslov, λmaks = b / T (m K). */
export const WIEN_B = 2.9e-3;
/** Kroppstemperaturen (K) varmekameraet ser: ca. 37 °C. */
export const T_KROPP = 310;
/** Fotonenergien (eV) der strålingen blir ioniserende: den kan rive elektroner løs fra atomer. */
export const IONISERING_EV = 10;
/** Typisk energi (eV) som trengs for å bryte en kjemisk binding, f.eks. i DNA. */
export const BINDING_EV = 4;
/** Effekten i mikrobølgeovnen og wifi-ruteren (W). */
export const P_OVN = 800;
export const P_RUTER = 0.1;

/** Endene av spekteret i figuren: log10(λ / m). 10³ m = 1 km (300 kHz), 10⁻¹³ m = 0,1 pm (12 MeV). */
export const LOG_MAX = 3;
export const LOG_MIN = -13;
export const LAMBDA_MAX = 10 ** LOG_MAX;
export const LAMBDA_MIN = 10 ** LOG_MIN;

/** Synlig lys (m), samme grenser som spektrene i scene-kit-et. */
export const VISIBLE_MIN = 380e-9;
export const VISIBLE_MAX = 750e-9;

/* ---------- Sammenhengene ---------- */

/** f = c / λ (Hz). */
export const frequency = (lambda: number): number => C / lambda;
/** λ = c / f (m). */
export const wavelength = (f: number): number => C / f;
/** Fotonenergien E = hf = hc / λ (J). */
export const photonEnergy = (lambda: number): number => (H * C) / lambda;
/** Fotonenergien i elektronvolt. */
export const energyEv = (lambda: number): number => photonEnergy(lambda) / E_CHARGE;
/** Bølgelengden (m) til et foton med energien `ev` elektronvolt. */
export const lambdaFromEv = (ev: number): number => (H * C) / (ev * E_CHARGE);
/** Bølgelengden der strålingen blir ioniserende (ca. 124 nm). */
export const LAMBDA_ION = lambdaFromEv(IONISERING_EV);
/** Om ett foton har nok energi til å ionisere (E ≥ ca. 10 eV). */
export const isIonizing = (lambda: number): boolean => energyEv(lambda) >= IONISERING_EV;
/** Wiens lov: bølgelengden (m) der et legeme med temperatur T (K) stråler mest. */
export const wienPeak = (T: number): number => WIEN_B / T;

export const clampLambda = (lambda: number): number =>
  Number.isFinite(lambda) ? Math.min(LAMBDA_MAX, Math.max(LAMBDA_MIN, lambda)) : 1;

/**
 * Plassen langs spekteret, 0 (lengst bølgelengde, radio, til venstre) til 1 (kortest, gamma, til høyre).
 * Skalaen er logaritmisk: hver tierpotens får like mye plass.
 */
export function bandPos(lambda: number): number {
  return (LOG_MAX - Math.log10(clampLambda(lambda))) / (LOG_MAX - LOG_MIN);
}

/** Bølgelengden ved plassen p (0–1) langs spekteret. */
export function lambdaAtPos(p: number): number {
  const q = Number.isFinite(p) ? Math.min(1, Math.max(0, p)) : 0;
  return 10 ** (LOG_MAX - q * (LOG_MAX - LOG_MIN));
}

/* ---------- Områdene ---------- */

export type RegionId = 'radio' | 'mikro' | 'ir' | 'synlig' | 'uv' | 'rontgen' | 'gamma';

export interface Region {
  id: RegionId;
  navn: string;
  /** Lengste og korteste bølgelengde (m). */
  fra: number;
  til: number;
}

/** Områdene fra lang til kort bølgelengde (grensene som i lærebøkene; røntgen og gamma overlapper egentlig). */
export const REGIONS: Region[] = [
  { id: 'radio', navn: 'Radiobølger', fra: LAMBDA_MAX, til: 1 },
  { id: 'mikro', navn: 'Mikrobølger', fra: 1, til: 1e-3 },
  { id: 'ir', navn: 'Infrarødt', fra: 1e-3, til: VISIBLE_MAX },
  { id: 'synlig', navn: 'Synlig lys', fra: VISIBLE_MAX, til: VISIBLE_MIN },
  { id: 'uv', navn: 'Ultrafiolett', fra: VISIBLE_MIN, til: 10e-9 },
  { id: 'rontgen', navn: 'Røntgen', fra: 10e-9, til: 10e-12 },
  { id: 'gamma', navn: 'Gamma', fra: 10e-12, til: LAMBDA_MIN },
];

export function region(id: RegionId): Region {
  return REGIONS.find((r) => r.id === id) ?? REGIONS[0]!;
}

/** Området bølgelengden hører til. Synlig lys tar med begge grensene (380 og 750 nm). */
export function regionOf(lambda: number): Region {
  const l = clampLambda(lambda);
  const visible = region('synlig');
  if (l >= visible.til && l <= visible.fra) return visible;
  return REGIONS.find((r) => l >= r.til && l <= r.fra) ?? REGIONS[0]!;
}

/* ---------- Eksemplene fra hverdagen ---------- */

export type ExampleId = 'radio' | 'mobil' | 'mikro' | 'varme' | 'fjern' | 'synlig' | 'uv' | 'rontgen' | 'gamma';

export interface Example {
  id: ExampleId;
  /** Kort tekst på knappen. */
  knapp: string;
  /** Hva eksempelet er, til forklaringen. */
  navn: string;
  /** Bølgelengden (m). */
  lambda: number;
}

/** Bølgelengden til gammafotonene fra cesium-137 i fysikklaben (662 keV). */
export const GAMMA_KEV = 662;

export const EXAMPLES: Example[] = [
  { id: 'radio', knapp: 'Radio', navn: 'DAB-radioen i bilen (200 MHz)', lambda: wavelength(200e6) },
  { id: 'mobil', knapp: 'Mobil og wifi', navn: 'mobilen og mobilmasta (4G på 800 MHz)', lambda: wavelength(800e6) },
  { id: 'mikro', knapp: 'Mikrobølgeovn', navn: 'mikrobølgeovnen (2,45 GHz)', lambda: wavelength(2.45e9) },
  { id: 'varme', knapp: 'Varmekamera', navn: 'varmekameraet som ser varmestrålingen fra kroppen', lambda: wienPeak(T_KROPP) },
  { id: 'fjern', knapp: 'Fjernkontroll', navn: 'fjernkontrollen til TV-en (940 nm)', lambda: 940e-9 },
  { id: 'synlig', knapp: 'Synlig lys', navn: 'regnbuen', lambda: 550e-9 },
  { id: 'uv', knapp: 'UV og solkrem', navn: 'UV-B fra sola i påskefjellet (300 nm)', lambda: 300e-9 },
  { id: 'rontgen', knapp: 'Røntgen', navn: 'røntgenbildet av håndleddet på legevakta', lambda: 0.05e-9 },
  { id: 'gamma', knapp: 'Gamma', navn: 'strålekilden med cesium-137 i fysikklaben', lambda: lambdaFromEv(GAMMA_KEV * 1e3) },
];

export function example(id: ExampleId): Example {
  return EXAMPLES.find((e) => e.id === id) ?? EXAMPLES[0]!;
}

/**
 * Eksempelet som passer best til bølgelengden: det nærmeste (på den logaritmiske skalaen) blant eksemplene i samme
 * område, så 390 nm gir regnbuen (synlig lys) og ikke solkremen. Alle områdene har minst ett eksempel.
 */
export function nearestExample(lambda: number): Example {
  const l = clampLambda(lambda);
  const r = regionOf(l).id;
  const inRegion = EXAMPLES.filter((e) => regionOf(e.lambda).id === r);
  const pool = inRegion.length > 0 ? inRegion : EXAMPLES;
  let best = pool[0]!;
  for (const e of pool) {
    if (Math.abs(Math.log10(e.lambda / l)) < Math.abs(Math.log10(best.lambda / l))) best = e;
  }
  return best;
}

/** Om bølgelengden er (nesten) nøyaktig eksempelet, f.eks. etter et trykk på knappen. */
export const atExample = (lambda: number, e: Example): boolean => Math.abs(Math.log10(lambda / e.lambda)) < 0.004;

/* ---------- Glidebryteren ---------- */

/** Glidebryteren går langs spekteret (p = 0–1) med 1000 steg: 0,016 tierpotens per steg. */
export const SLIDER = { min: 0, max: 1, step: 0.001 } as const;

/* ---------- Størrelser å sammenligne med ---------- */

const SIZES: { m: number; t: string }[] = [
  { m: 105, t: 'lengden av en fotballbane' },
  { m: 12, t: 'lengden av en buss' },
  { m: 1.75, t: 'høyden til en voksen person' },
  { m: 0.22, t: 'en fotball' },
  { m: 0.09, t: 'bredden av en hånd' },
  { m: 0.015, t: 'en sukkerbit' },
  { m: 1e-3, t: 'et sandkorn' },
  { m: 8e-5, t: 'tykkelsen av et hårstrå' },
  { m: 8e-6, t: 'et rødt blodlegeme' },
  { m: 1.5e-6, t: 'en bakterie' },
  { m: 1e-7, t: 'et virus' },
  { m: 1e-8, t: 'et stort proteinmolekyl' },
  { m: 2e-9, t: 'bredden av DNA-tråden' },
  { m: 1e-10, t: 'et atom' },
  { m: 1e-14, t: 'en atomkjerne' },
];

/** Tall med ett gjeldende siffer, til «ca. 50 ganger»: 53 → 50, 9,5 → 10. */
export function oneSig(v: number): number {
  if (!(v > 0) || !Number.isFinite(v)) return 0;
  const p = 10 ** Math.floor(Math.log10(v));
  return Math.round(v / p) * p;
}

/**
 * Noe kjent med omtrent samme størrelse som bølgelengden: «omtrent like stor som en fotball», eller «ca. 50 ganger
 * mindre enn et atom» når det nærmeste er mer enn en halv tierpotens unna.
 */
export function sizeComparison(lambda: number): string {
  const l = clampLambda(lambda);
  let best = SIZES[0]!;
  for (const s of SIZES) if (Math.abs(Math.log10(s.m / l)) < Math.abs(Math.log10(best.m / l))) best = s;
  const d = Math.log10(l / best.m);
  if (Math.abs(d) <= 0.5) return `omtrent like stor som ${best.t}`;
  const ratio = fmt(oneSig(10 ** Math.abs(d)), 0);
  return d < 0 ? `ca. ${ratio} ganger mindre enn ${best.t}` : `ca. ${ratio} ganger større enn ${best.t}`;
}

/* ---------- Tall og enheter ---------- */

/** Tall med `sig` gjeldende siffer og norsk desimalkomma: 0,1224 → «0,122», 37,5 → «37,5», 940 → «940». */
export function fmtSig(v: number, sig = 3): string {
  if (!Number.isFinite(v)) return '–';
  if (v === 0) return '0';
  const e = Math.floor(Math.log10(Math.abs(v)));
  const rounded = Number(v.toPrecision(sig));
  const e2 = Math.floor(Math.log10(Math.abs(rounded)));
  return fmt(rounded, Math.max(0, sig - 1 - Math.max(e, e2)));
}

/** [fra og med, enhet i meter, navn]: 0,05 nm skrives i nm (som røntgen i lærebøkene), under 0,01 nm i pm. */
const LAMBDA_UNITS: [number, number, string][] = [
  [1e3, 1e3, 'km'],
  [1, 1, 'm'],
  [1e-2, 1e-2, 'cm'],
  [1e-3, 1e-3, 'mm'],
  [1e-6, 1e-6, 'µm'],
  [1e-11, 1e-9, 'nm'],
  [0, 1e-12, 'pm'],
];

/** Bølgelengden med passende enhet og tre gjeldende siffer: «1,50 m», «12,2 cm», «9,35 µm», «0,0500 nm», «1,88 pm». */
export function fmtLambda(lambda: number, sig = 3): string {
  if (!Number.isFinite(lambda) || lambda <= 0) return '–';
  // Avrund først, så 9,9999 mm blir «1,00 cm» og ikke «10,0 mm»
  const l = Number(lambda.toPrecision(sig));
  const [, unit, name] = LAMBDA_UNITS.find(([from]) => l >= from * 0.99999) ?? LAMBDA_UNITS[LAMBDA_UNITS.length - 1]!;
  return `${fmtSig(l / unit, sig)} ${name}`;
}

/** Bølgelengden for en akseetikett (tierpotenser): «1 km», «1 m», «10 cm», «1 µm», «0,1 nm», «1 pm». */
export function fmtLambdaTick(k: number): string {
  const units: [number, string][] = [
    [3, 'km'],
    [0, 'm'],
    [-2, 'cm'],
    [-3, 'mm'],
    [-6, 'µm'],
    [-9, 'nm'],
    [-12, 'pm'],
  ];
  // Enheten der tallet blir 1, 10 eller 100 (0,1 nm for 10⁻¹⁰ m, som i lærebøkene)
  const special: Record<number, string> = { [-10]: '0,1 nm', [-13]: '0,1 pm' };
  if (special[k]) return special[k]!;
  const u = units.find(([e]) => k >= e) ?? units[units.length - 1]!;
  return `${fmt(10 ** (k - u[0]), 0)} ${u[1]}`;
}

/** Frekvensen: «200 MHz», «2,45 GHz», over 1 THz på standardform «5,45 · 10¹⁴ Hz». */
export function fmtFreq(f: number, sig = 3): string {
  if (!Number.isFinite(f) || f <= 0) return '–';
  const v = Number(f.toPrecision(sig));
  if (v >= 1e12) return `${fmtSci(v, sig - 1)} Hz`;
  if (v >= 1e9) return `${fmtSig(v / 1e9, sig)} GHz`;
  if (v >= 1e6) return `${fmtSig(v / 1e6, sig)} MHz`;
  if (v >= 1e3) return `${fmtSig(v / 1e3, sig)} kHz`;
  return `${fmtSig(v, sig)} Hz`;
}

/** Fotonenergien i eV: «8,29 · 10⁻⁷ eV», «2,26 eV», «24,9 keV», «662 keV», «1,24 MeV». */
export function fmtEv(ev: number, sig = 3): string {
  if (!Number.isFinite(ev) || ev <= 0) return '–';
  const v = Number(ev.toPrecision(sig));
  if (v >= 1e6) return `${fmtSig(v / 1e6, sig)} MeV`;
  if (v >= 1e3) return `${fmtSig(v / 1e3, sig)} keV`;
  if (v >= 0.01) return `${fmtSig(v, sig)} eV`;
  return `${fmtSci(v, sig - 1)} eV`;
}

/* ---------- Aksene i figuren ---------- */

export interface Tick {
  /** Plassen langs spekteret (0–1). */
  p: number;
  /** Tierpotensen. */
  k: number;
  /** Stor strek med tall (hver tredje tierpotens). */
  major: boolean;
}

function decadeTicks(lo: number, hi: number, pos: (k: number) => number): Tick[] {
  const out: Tick[] = [];
  for (let k = Math.ceil(lo - 1e-9); k <= Math.floor(hi + 1e-9); k++) {
    const p = pos(k);
    if (p >= -1e-9 && p <= 1 + 1e-9) out.push({ p, k, major: ((k % 3) + 3) % 3 === 0 });
  }
  return out;
}

/** Tierpotensene for λ (m) langs spekteret. */
export function lambdaTicks(): Tick[] {
  return decadeTicks(LOG_MIN, LOG_MAX, (k) => bandPos(10 ** k));
}

/** Tierpotensene for f (Hz): de ligger ikke rett under λ-strekene, fordi c = 3,00 · 10⁸ m/s. */
export function freqTicks(): Tick[] {
  const lo = Math.log10(frequency(LAMBDA_MAX));
  const hi = Math.log10(frequency(LAMBDA_MIN));
  return decadeTicks(lo, hi, (k) => bandPos(wavelength(10 ** k)));
}

/** Tierpotensene for E (eV). */
export function energyTicks(): Tick[] {
  const lo = Math.log10(energyEv(LAMBDA_MAX));
  const hi = Math.log10(energyEv(LAMBDA_MIN));
  return decadeTicks(lo, hi, (k) => bandPos(lambdaFromEv(10 ** k)));
}

/** «10⁹ Hz» eller «1 eV»/«10³ eV»: tierpotens med enhet. */
export function fmtPow(k: number, unit: string): string {
  if (k === 0) return `1 ${unit}`;
  const sup = String(k)
    .replace('-', '⁻')
    .split('')
    .map((c) => ({ '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹' })[c] ?? c)
    .join('');
  return `10${sup} ${unit}`;
}

/**
 * «Kvitring»: fasen (radianer) til den skjematiske bølgen langs spekteret, der den tegnede bølgelengden avtar
 * eksponentielt fra `lMax` (venstre) til `lMin` (høyre) over bredden `w`. Fasen er integralet av 2π / L(x).
 */
export function chirpPhase(u: number, w: number, lMax: number, lMin: number): number {
  const r = Math.log(lMin / lMax) / w;
  if (Math.abs(r) < 1e-12) return (2 * Math.PI * u) / lMax;
  return (2 * Math.PI * (1 - Math.exp(-r * u))) / (r * lMax);
}

/** Den tegnede bølgelengden (figurens enheter) i punktet u langs bredden w. */
export function chirpLength(u: number, w: number, lMax: number, lMin: number): number {
  return lMax * (lMin / lMax) ** (u / w);
}

/* ---------- Synlig lys ---------- */

/** Navnet på fargen (bokmål) for synlig lys med bølgelengden `nm`. */
export function colorName(nm: number): string {
  if (nm < 450) return 'fiolett';
  if (nm < 495) return 'blått';
  if (nm < 570) return 'grønt';
  if (nm < 590) return 'gult';
  if (nm < 620) return 'oransje';
  return 'rødt';
}

/** Regnbuen: 0 for fiolett (innerst, 400 nm) til 1 for rødt (ytterst, 700 nm). */
export function rainbowT(nm: number): number {
  return Math.min(1, Math.max(0, (nm - 400) / 300));
}

/* ---------- Mikrobølgeovnen ---------- */

/** Avstanden mellom de varme flekkene i ovnen (bukene i den stående bølgen): λ / 2. */
export const hotSpotSpacing = (lambda: number): number => lambda / 2;

/** Lysfarten målt med sjokoladeforsøket: c = λ f = 2 d f, der d er avstanden mellom de smeltede flekkene. */
export const chocolateSpeed = (d: number, f: number): number => 2 * d * f;

/** Hvor mange fotoner med energien E (eV) som til sammen har energien til å bryte én binding. */
export const photonsPerBond = (lambda: number): number => BINDING_EV / energyEv(lambda);
