/**
 * Kommunikasjon og bevegelse i planter (Bi 1 kapittel 12, KM3 og KM5): ren modell uten React.
 *
 * 1. Fototropisme og gravitropisme: auksin flyttes til skyggesiden (eller undersiden), cellene der strekker seg mer
 *    (i stengelen) eller mindre (i rota), og planten bøyer seg. De klassiske forsøkene til Darwin (1880),
 *    Boysen-Jensen (1913) og Went (1928) som regler for hvor auksinet havner.
 * 2. Fotoperiodisme: langdags-, kortdags- og dagnøytrale planter, kritisk nattlengde, lysglimt om natta og fytokrom.
 */

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const rad = (deg: number) => (deg * Math.PI) / 180;
const deg = (r: number) => (r * 180) / Math.PI;

/* ====================================================================== */
/* 1. Fototropisme                                                          */
/* ====================================================================== */

/**
 * Største andel av auksinet som havner på skyggesiden når lyset kommer rett fra siden. Målinger på havrekoleoptiler
 * gir omtrent 60–70 % på skyggesiden (Briggs 1963; lærebøkene sier «mer auksin på skyggesiden»). Vi bruker 65 %.
 */
export const MAX_SHADED_SHARE = 0.65;

/** Hvor sterkt spissen reagerer på lyset (0–1): mettes ved svakt lys. */
export function lightResponse(intensity: number): number {
  const I = clamp(intensity, 0, 100);
  return (I * 1.2) / (I + 20);
}

/**
 * Andelen auksin på skyggesiden når spissen peker i retningen `tip` (grader fra loddrett, positiv mot høyre) og lyset
 * kommer fra retningen `light` (samme mål). Asymmetrien følger sinus til vinkelen mellom spissen og lyset.
 */
export function shadedShare(light: number, tip: number, intensity: number): number {
  const a = (MAX_SHADED_SHARE - 0.5) * Math.min(1, lightResponse(intensity)) * Math.sin(rad(light - tip));
  return 0.5 + Math.abs(a);
}

/** Bøyningsfart (per minutt, i radianer per radian vinkelforskjell) ved full asymmetri. Gir ca. 45° på to timer. */
export const BEND_RATE = 0.008;

/**
 * Vinkelen til spissen (grader) etter t minutter: dθ/dt = k · sin(φ − θ), som har den lukkede løsningen
 * tan((φ − θ)/2) = tan((φ − θ₀)/2) · e^(−kt). Spissen nærmer seg lysretningen, og bøyningen stopper når den peker mot lyset.
 */
export function bendAngle(light: number, intensity: number, t: number, start = 0): number {
  const k = BEND_RATE * Math.min(1, lightResponse(intensity));
  const d0 = rad(light - start);
  if (Math.abs(d0) < 1e-9 || k === 0) return start;
  const d = 2 * Math.atan(Math.tan(d0 / 2) * Math.exp(-k * Math.max(0, t)));
  return light - deg(d);
}

/** Celleforlengelsen på hver side er proporsjonal med auksinet der: skyggesiden / lyssiden. */
export function elongationRatio(share: number): number {
  return share / (1 - share);
}

/* ---------- Gravitropisme ---------- */

/**
 * Doserespons for auksin (Thimann 1937): vekst (relativ, negativ = hemmes) mot log10 av konsentrasjonen (mol/L).
 * Røtter er mye mer følsomme (optimum ca. 10⁻¹⁰ mol/L) enn stengler (ca. 10⁻⁶–10⁻⁵ mol/L).
 */
export const OPTIMUM = { rot: -10.5, stengel: -5.5 } as const;
export const RESPONSE_WIDTH = 2;
export function auxinResponse(organ: 'rot' | 'stengel', log10c: number): number {
  return 1 - ((log10c - OPTIMUM[organ]) / RESPONSE_WIDTH) ** 2;
}

/** Vanlig auksinnivå (log10 mol/L) i stengelen og rota, og hvor mye det forskyves mot undersiden når planten ligger. */
export const BASE_LEVEL = { rot: -9.5, stengel: -7 } as const;
export const GRAVI_SHIFT = 0.4;

export interface GraviState {
  /** Auksin (log10 mol/L) på oversiden og undersiden. */
  upper: number;
  lower: number;
  /** Vekst på oversiden og undersiden. */
  growthUpper: number;
  growthLower: number;
  /** Bøyer seg opp (+1) eller ned (−1), eller ingen (0). */
  bend: -1 | 0 | 1;
}

/** Stengel eller rot som ligger med vinkelen `tilt` fra loddrett (0 = rett, 90 = vannrett). */
export function gravitropism(organ: 'rot' | 'stengel', tilt: number): GraviState {
  const s = Math.sin(rad(clamp(tilt, 0, 180)));
  const upper = BASE_LEVEL[organ] - GRAVI_SHIFT * s;
  const lower = BASE_LEVEL[organ] + GRAVI_SHIFT * s;
  const gu = auxinResponse(organ, upper);
  const gl = auxinResponse(organ, lower);
  const diff = gl - gu;
  // Undersiden vokser mest → bøyer seg opp
  const bend = Math.abs(diff) < 1e-6 ? 0 : diff > 0 ? 1 : -1;
  return { upper, lower, growthUpper: gu, growthLower: gl, bend };
}

/**
 * Vinkelen fra loddrett (grader) etter t minutter for et skudd eller en rot som ble lagt med vinkelen `tilt`:
 * skuddet bøyer seg opp og rota ned, til de står loddrett igjen (samme tan(θ/2)-løsning som over).
 */
export function graviAngle(tilt: number, t: number, rate = 0.012): number {
  const d0 = rad(clamp(tilt, 0, 180));
  if (d0 === 0) return 0;
  return deg(2 * Math.atan(Math.tan(d0 / 2) * Math.exp(-rate * Math.max(0, t))));
}

/* ---------- De klassiske forsøkene ---------- */

export type Outcome = 'venstre' | 'rett' | 'hoyre';

export interface Experiment {
  id: string;
  /** Hvem og når. */
  who: string;
  /** Kort navn i lista. */
  name: string;
  /** Spissen: urørt, kuttet av, satt tilbake på gelatin, eller erstattet av en agarblokk med eller uten auksin (til venstre). */
  tip: 'intakt' | 'kuttet' | 'gelatin' | 'agar-auksin' | 'agar-tom';
  cap: 'ingen' | 'ugjennomsiktig' | 'gjennomsiktig';
  /** Ugjennomsiktig rør rundt den nedre delen (spissen fri). */
  sleeve: boolean;
  /** Glimmerplate (slipper ikke gjennom stoffer) under spissen på skyggesiden (venstre) eller lyssiden (høyre). */
  mica: 'ingen' | 'skygge' | 'lys';
  /** Lys fra høyre (ellers mørke). */
  light: boolean;
}

export const EXPERIMENTS: readonly Experiment[] = [
  { id: 'intakt', who: 'Darwin 1880', name: 'Hel koleoptil', tip: 'intakt', cap: 'ingen', sleeve: false, mica: 'ingen', light: true },
  { id: 'kuttet', who: 'Darwin 1880', name: 'Spissen kuttet av', tip: 'kuttet', cap: 'ingen', sleeve: false, mica: 'ingen', light: true },
  { id: 'hette', who: 'Darwin 1880', name: 'Ugjennomsiktig hette på spissen', tip: 'intakt', cap: 'ugjennomsiktig', sleeve: false, mica: 'ingen', light: true },
  {
    id: 'glasshette',
    who: 'Darwin 1880',
    name: 'Gjennomsiktig hette på spissen',
    tip: 'intakt',
    cap: 'gjennomsiktig',
    sleeve: false,
    mica: 'ingen',
    light: true,
  },
  { id: 'ror', who: 'Darwin 1880', name: 'Ugjennomsiktig rør under spissen', tip: 'intakt', cap: 'ingen', sleeve: true, mica: 'ingen', light: true },
  { id: 'gelatin', who: 'Boysen-Jensen 1913', name: 'Spissen satt tilbake på gelatin', tip: 'gelatin', cap: 'ingen', sleeve: false, mica: 'ingen', light: true },
  { id: 'glimmer-skygge', who: 'Boysen-Jensen 1913', name: 'Glimmerplate på skyggesiden', tip: 'intakt', cap: 'ingen', sleeve: false, mica: 'skygge', light: true },
  { id: 'glimmer-lys', who: 'Boysen-Jensen 1913', name: 'Glimmerplate på lyssiden', tip: 'intakt', cap: 'ingen', sleeve: false, mica: 'lys', light: true },
  { id: 'went', who: 'Went 1928', name: 'Agarblokk med auksin på venstre side, i mørke', tip: 'agar-auksin', cap: 'ingen', sleeve: false, mica: 'ingen', light: false },
  { id: 'went-tom', who: 'Went 1928', name: 'Agarblokk uten auksin, i mørke', tip: 'agar-tom', cap: 'ingen', sleeve: false, mica: 'ingen', light: false },
];

export function getExperiment(id: string): Experiment {
  return EXPERIMENTS.find((e) => e.id === id) ?? EXPERIMENTS[0]!;
}

export interface ExperimentResult {
  /** Auksin som når vekstsonen på venstre og høyre side (relativt, 1 = alt auksinet fra en spiss). */
  left: number;
  right: number;
  outcome: Outcome;
  /** Om spissen ser lyset (og dermed kan flytte auksin til skyggesiden). */
  tipSeesLight: boolean;
  /** Om koleoptilen vokser i det hele tatt. */
  grows: boolean;
}

/**
 * Hvor auksinet havner, ut fra det vi vet i dag: spissen lager auksin; lys fra siden flytter en del av det til
 * skyggesiden i spissen (bare hvis spissen ser lyset); auksin går gjennom gelatin og agar, men ikke gjennom glimmer.
 * En glimmerplate stopper det ekstra auksinet som er flyttet til den siden. Den siden med mest auksin vokser mest, så
 * koleoptilen bøyer seg mot den andre siden. Lyset kommer fra høyre, så skyggesiden er venstre.
 */
export function runExperiment(e: Experiment): ExperimentResult {
  if (e.tip === 'kuttet' || e.tip === 'agar-tom') return { left: 0, right: 0, outcome: 'rett', tipSeesLight: false, grows: false };
  if (e.tip === 'agar-auksin') return { left: 1, right: 0, outcome: 'hoyre', tipSeesLight: false, grows: true };
  const tipSeesLight = e.light && e.cap !== 'ugjennomsiktig';
  const shaded = tipSeesLight ? MAX_SHADED_SHARE : 0.5;
  let left = shaded;
  let right = 1 - shaded;
  if (e.mica === 'skygge') left = Math.min(left, right);
  if (e.mica === 'lys') right = Math.min(left, right);
  const d = left - right;
  const outcome: Outcome = d > 0.05 ? 'hoyre' : d < -0.05 ? 'venstre' : 'rett';
  return { left, right, outcome, tipSeesLight, grows: left + right > 0 };
}

/* ====================================================================== */
/* 2. Fotoperiodisme                                                        */
/* ====================================================================== */

export type PhotoType = 'langdag' | 'kortdag' | 'dagnoytral';

export interface PhotoPlant {
  id: string;
  name: string;
  latin: string;
  type: PhotoType;
  /** Kritisk nattlengde (timer). Langdagsplanter blomstrer når den lengste mørkeperioden er kortere, kortdagsplanter når den er lengre. */
  critical: number | null;
  /** Kort merknad til forklaringen. */
  note: string;
}

/**
 * Omtrentlige kritiske nattlengder (varierer med sort, temperatur og alder). Kilder: Taiz og Zeiger (Plant Physiology),
 * Thomas og Vince-Prue (Photoperiodism in Plants), NIBIO og gartnernæringen for julestjerne og jordbær.
 */
export const PHOTO_PLANTS: readonly PhotoPlant[] = [
  {
    id: 'bulmeurt',
    name: 'Bulmeurt',
    latin: 'Hyoscyamus niger',
    type: 'langdag',
    critical: 13,
    note: 'klassisk forsøksplante; blomstrer når nettene er kortere enn ca. 13 timer',
  },
  { id: 'timotei', name: 'Timotei', latin: 'Phleum pratense', type: 'langdag', critical: 10, note: 'viktig fôrgras i Norge; skyter aks i lange sommerdager' },
  {
    id: 'julestjerne',
    name: 'Julestjerne',
    latin: 'Euphorbia pulcherrima',
    type: 'kortdag',
    critical: 11.7,
    note: 'danner røde høyblad når nettene er lengre enn ca. 11 t 40 min, derfor i desember',
  },
  {
    id: 'krysantemum',
    name: 'Krysantemum',
    latin: 'Chrysanthemum × morifolium',
    type: 'kortdag',
    critical: 10.5,
    note: 'blomstrer om høsten; gartnere styrer blomstringen med mørkleggingsgardiner',
  },
  {
    id: 'jordbaer',
    name: 'Jordbær',
    latin: 'Fragaria × ananassa',
    type: 'kortdag',
    critical: 10,
    note: 'vanlige sorter (som Korona) legger blomsteranlegg om høsten når nettene blir lange',
  },
  { id: 'tomat', name: 'Tomat', latin: 'Solanum lycopersicum', type: 'dagnoytral', critical: null, note: 'blomstrer uansett daglengde' },
];

export type Interruption = 'ingen' | 'glimt' | 'morkt';
export type Flash = 'rod' | 'rod-langrod';

export interface Schedule {
  /** Daglengde (timer), lyset er sentrert rundt kl. 12. */
  day: number;
  interruption: Interruption;
  flash: Flash;
}

/** Lengden av et lysglimt og et mørkt avbrudd (timer). */
export const FLASH_HOURS = 0.25;
export const DARK_BREAK_HOURS = 1;

/** Fytokrom etter natta: rødt lys gjør Pr om til Pfr; langrødt lys rett etter gjør det om igjen. Det siste lyset avgjør. */
export function phytochromeAfterFlash(flash: Flash): 'Pfr' | 'Pr' {
  return flash === 'rod' ? 'Pfr' : 'Pr';
}

/**
 * Den lengste sammenhengende mørkeperioden (timer). Et rødt lysglimt midt i natta deler natta i to (rødt etterfulgt av
 * langrødt virker ikke, fordi Pfr gjøres om til Pr igjen). Et mørkt avbrudd om dagen endrer ikke natta.
 */
export function longestDark(s: Schedule): number {
  const night = clamp(24 - s.day, 0, 24);
  if (s.interruption !== 'glimt' || night <= FLASH_HOURS) return night;
  if (phytochromeAfterFlash(s.flash) === 'Pr') return night;
  return (night - FLASH_HOURS) / 2;
}

/** Samlet antall timer mørke i døgnet. */
export function totalDark(s: Schedule): number {
  const night = clamp(24 - s.day, 0, 24);
  return s.interruption === 'morkt' ? Math.min(24, night + DARK_BREAK_HOURS) : night;
}

/** Om planten blomstrer med denne lengste mørkeperioden. */
export function flowers(p: PhotoPlant, dark: number): boolean {
  if (p.type === 'dagnoytral' || p.critical === null) return true;
  return p.type === 'langdag' ? dark <= p.critical : dark >= p.critical;
}

/** Nattlengdene (timer) der planten blomstrer: [fra, til]. */
export function floweringRange(p: PhotoPlant): [number, number] {
  if (p.type === 'dagnoytral' || p.critical === null) return [0, 24];
  return p.type === 'langdag' ? [0, p.critical] : [p.critical, 24];
}

/**
 * Daglengde (timer) på breddegraden `lat` (grader nord) på dag nummer `n` i året, med sola rett under horisonten
 * (−0,833° for lysbrytning og solskiva). Midnattssol gir 24, mørketid 0.
 */
export function dayLength(lat: number, n: number): number {
  const decl = rad(23.44) * Math.sin((2 * Math.PI * (284 + n)) / 365);
  const phi = rad(lat);
  const cosH = (Math.sin(rad(-0.833)) - Math.sin(phi) * Math.sin(decl)) / (Math.cos(phi) * Math.cos(decl));
  if (cosH <= -1) return 24;
  if (cosH >= 1) return 0;
  return (2 * deg(Math.acos(cosH))) / 15;
}

/** Timer som tekst: 14,5 → «14 t 30 min», 24 → «24 t». */
export function hoursText(h: number): string {
  if (!Number.isFinite(h)) return '–';
  const total = Math.round(clamp(h, 0, 24) * 60);
  const t = Math.floor(total / 60);
  const m = total % 60;
  return m === 0 ? `${t} t` : `${t} t ${m} min`;
}
