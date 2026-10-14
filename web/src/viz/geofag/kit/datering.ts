/**
 * Radiometrisk datering for geofag: isotopsystemene uran–bly, kalium–argon og C-14, hvor mye som er igjen, forholdet
 * mellom datter og mor, alder fra et målt forhold og om oppvarming nullstiller klokka. Ren logikk uten React.
 *
 * Geofag vinkler dateringen mot mineralet og isotopsystemet (hvilket mineral, hvilken lukketemperatur, hva som kan
 * dateres); selve halveringstiden er fysikkstoff. Alle tider er i **år** (også halveringstidene), så U–Pb-aldre
 * blir store tall: del på 10⁶ og bruk `fmtAlder` fra `geotid.ts` til tekst.
 *
 *   gjenvaerende(4.468e9, 'u-pb')          // 0,5
 *   datterForhold(1e9, 'k-ar')             // ⁴⁰Ar* / ⁴⁰K etter 1 milliard år
 *   alderFraForhold(0.1, 'k-ar')           // år
 *   nullstilles('k-ar', 400, 1e6)          // biotitt nullstilles, hornblende delvis
 */

/** Isotopsystemene i Geofag 1. Rb–Sr er utelatt med vilje. */
export type IsotopId = 'u-pb' | 'k-ar' | 'c-14';

/** Et mineral som dateres med systemet, og temperaturen der klokka starter når mineralet kjøles ned. */
export interface DateringsMineral {
  /** Mineralnavn som i `mineraler.ts` (zirkon, biotitt …). */
  mineral: string;
  /** Lukketemperatur i °C (omtrentlig: den avhenger av kornstørrelse og hvor fort mineralet kjøles ned). */
  lukketemperatur: number;
  /**
   * Aktiveringsenergi for diffusjon av datterisotopen ut av mineralet i kJ/mol (omtrentlig), som bestemmer hvor
   * brått tapet øker med temperaturen i `nullstilles`.
   */
  aktiveringsenergi: number;
}

/** Ett isotopsystem: morisotop, datterisotop, halveringstid og hva det egner seg til. */
export interface Isotopsystem {
  id: IsotopId;
  /** «uran–bly» (løpende tekst). */
  navn: string;
  /** «U–Pb» (etiketter). */
  kort: string;
  /** Morisotopen med hevet massetall: «²³⁸U». */
  mor: string;
  /** Datterisotopen: «²⁰⁶Pb». */
  datter: string;
  /** Halveringstid i år. */
  halveringstid: number;
  /**
   * Andelen av morkjernene som blir til den målte datterisotopen (1 når alle blir det). ⁴⁰K blir for det meste til
   * ⁴⁰Ca (som finnes overalt fra før), og bare omtrent en tidel til ⁴⁰Ar.
   */
  forgrening: number;
  /**
   * Hva som måles: `'datter'` = forholdet datter/mor i mineralet (U–Pb, K–Ar), `'rest'` = hvor mye av morisotopen
   * som er igjen sammenlignet med en levende organisme (C-14; ¹⁴N kan ikke skilles fra nitrogenet ellers).
   */
  maling: 'datter' | 'rest';
  /** Mineraler som dateres, med lukketemperatur. Tom for C-14, der klokka starter når organismen dør. */
  mineraler: readonly DateringsMineral[];
  /** Hva som kan dateres, kort og i løpende tekst. */
  materialer: readonly string[];
  /** Aldersområdet systemet egner seg for, i år (omtrentlig). */
  maleomrade: { min: number; max: number };
  /** Den andre uran–bly-kjeden (²³⁵U → ²⁰⁷Pb), som gir en uavhengig alder fra samme zirkon. */
  andreKjede?: { mor: string; datter: string; halveringstid: number };
  /** Kort merknad til forklaringen. */
  merknad: string;
}

/*
 * Kilder:
 * - Halveringstider og forgrening: Steiger og Jäger 1977 (IUGS-konstantene som brukes i geokronologien):
 *   λ(²³⁸U) = 1,55125 · 10⁻¹⁰ per år (t½ = 4,468 milliarder år), λ(²³⁵U) = 9,8485 · 10⁻¹⁰ per år (t½ = 703,8 millioner
 *   år), λ(⁴⁰K) = 5,543 · 10⁻¹⁰ per år (t½ = 1,250 milliarder år) med λε = 0,581 · 10⁻¹⁰ til ⁴⁰Ar, altså en andel på
 *   0,581/5,543 = 10,5 %. (Nyere kjernedata gir 10,7 % og 1,248 milliarder år; forskjellen syns ikke i figurene.)
 * - C-14: 5730 år (Godwin 1962). Laboratoriene oppgir «konvensjonell» alder med Libbys 5568 år og kalibrerer etterpå;
 *   her regnes det med 5730 år, og resultatet kalles «forenklet alder».
 * - Lukketemperaturer (omtrentlige, ved en nedkjøling på rundt 10 °C per million år): zirkon over 900 °C (Cherniak og
 *   Watson 2001), monazitt omtrent 750 °C, titanitt omtrent 650 °C og apatitt omtrent 500 °C for U–Pb; hornblende
 *   omtrent 500 °C (Harrison 1981), muskovitt omtrent 400 °C, biotitt omtrent 300 °C (Harrison mfl. 1985) og
 *   K-feltspat omtrent 200 °C for K–Ar. Aktiveringsenergiene er avrundede verdier fra de samme diffusjonsforsøkene
 *   (Pb i zirkon omtrent 550 kJ/mol, Ar i biotitt omtrent 200 kJ/mol osv.).
 * - Måleområder: lærebokverdier, omtrentlige.
 */
export const ISOTOPER: Readonly<Record<IsotopId, Isotopsystem>> = {
  'u-pb': {
    id: 'u-pb',
    navn: 'uran–bly',
    kort: 'U–Pb',
    mor: '²³⁸U',
    datter: '²⁰⁶Pb',
    halveringstid: 4.468e9,
    forgrening: 1,
    maling: 'datter',
    mineraler: [
      { mineral: 'zirkon', lukketemperatur: 900, aktiveringsenergi: 550 },
      { mineral: 'monazitt', lukketemperatur: 750, aktiveringsenergi: 590 },
      { mineral: 'titanitt', lukketemperatur: 650, aktiveringsenergi: 330 },
      { mineral: 'apatitt', lukketemperatur: 500, aktiveringsenergi: 230 },
    ],
    materialer: ['zirkon i granitt, gneis og vulkansk aske', 'monazitt, titanitt og apatitt'],
    maleomrade: { min: 1e6, max: 4.6e9 },
    andreKjede: { mor: '²³⁵U', datter: '²⁰⁷Pb', halveringstid: 7.038e8 },
    merknad:
      'Zirkon tar opp uran, men nesten ikke bly når det krystalliserer, og tåler forvitring og metamorfose. To uavhengige klokker (²³⁸U og ²³⁵U) i samme korn viser om noe bly har lekket ut.',
  },
  'k-ar': {
    id: 'k-ar',
    navn: 'kalium–argon',
    kort: 'K–Ar',
    mor: '⁴⁰K',
    datter: '⁴⁰Ar',
    halveringstid: 1.25e9,
    forgrening: 0.581 / 5.543,
    maling: 'datter',
    mineraler: [
      { mineral: 'hornblende', lukketemperatur: 500, aktiveringsenergi: 270 },
      { mineral: 'muskovitt', lukketemperatur: 400, aktiveringsenergi: 260 },
      { mineral: 'biotitt', lukketemperatur: 300, aktiveringsenergi: 200 },
      { mineral: 'kalifeltspat', lukketemperatur: 200, aktiveringsenergi: 180 },
    ],
    materialer: ['glimmer og hornblende i dyp- og metamorfe bergarter', 'lava og vulkansk aske (sanidin, basalt)'],
    maleomrade: { min: 1e5, max: 4.6e9 },
    merknad:
      'Argon er en gass som slipper ut av smeltet stein, så klokka står på null når lava størkner. Oppvarming senere kan drive argonet ut igjen og nullstille klokka.',
  },
  'c-14': {
    id: 'c-14',
    navn: 'karbon-14',
    kort: 'C-14',
    mor: '¹⁴C',
    datter: '¹⁴N',
    halveringstid: 5730,
    forgrening: 1,
    maling: 'rest',
    mineraler: [],
    materialer: ['trekull, tre, torv og planterester', 'bein og skjell (skjell trenger korreksjon for havets reservoaralder)'],
    maleomrade: { min: 300, max: 5e4 },
    merknad:
      'Bare for det som en gang levde. Klokka starter når organismen dør og slutter å ta opp karbon. Etter omtrent 50 000 år er det for lite C-14 igjen til å måle.',
  },
};

/** Isotopsystemene i fast rekkefølge (til knapper og tester). */
export const ISOTOP_IDS: readonly IsotopId[] = ['u-pb', 'k-ar', 'c-14'];

/**
 * Havets reservoaralder for C-14 i år (omtrent 400 år for overflatehavet; langs norskekysten omtrent 400–450 år,
 * Mangerud og Gulliksen 1975). Skjell og fisk ser så mye eldre ut enn trekull fra samme år, fordi havet blander inn
 * gammelt karbon fra dypvannet.
 */
export const MARIN_RESERVOARALDER = 400;

function halvering(system: IsotopId | number): number | null {
  const t = typeof system === 'number' ? system : ISOTOPER[system]?.halveringstid;
  return t !== undefined && Number.isFinite(t) && t > 0 ? t : null;
}

function forgreningFor(system: IsotopId | number): number {
  return typeof system === 'number' ? 1 : (ISOTOPER[system]?.forgrening ?? 1);
}

/**
 * Andelen av morisotopen som er igjen etter tiden `t` (år): 2^(−t/t½). `system` er et isotopsystem eller en
 * halveringstid i år. Null for negativ tid, ugyldige tall eller halveringstid ≤ 0.
 */
export function gjenvaerende(t: number, system: IsotopId | number): number | null {
  const th = halvering(system);
  if (th === null || !Number.isFinite(t) || t < 0) return null;
  return Math.exp((-t * Math.LN2) / th);
}

/**
 * Forholdet radiogen datter / mor (D* / P) etter tiden `t` (år), med forgreningen til systemet:
 * D* / P = f · (2^(t/t½) − 1). For K–Ar er f ≈ 0,105, så forholdet ⁴⁰Ar* / ⁴⁰K blir omtrent en tidel av det det ville
 * vært om alt kaliumet ble til argon. Null for negativ tid eller ugyldige tall, og for så lange tider at forholdet
 * ikke lenger er et endelig tall.
 */
export function datterForhold(t: number, system: IsotopId | number): number | null {
  const th = halvering(system);
  if (th === null || !Number.isFinite(t) || t < 0) return null;
  const r = forgreningFor(system) * Math.expm1((t * Math.LN2) / th);
  return Number.isFinite(r) ? r : null;
}

/**
 * Alderen (år) fra et målt forhold datter/mor (D* / P): t = t½/ln 2 · ln(1 + (D* / P)/f). Null for negativt forhold
 * eller ugyldige tall.
 */
export function alderFraForhold(forhold: number, system: IsotopId | number): number | null {
  const th = halvering(system);
  if (th === null || !Number.isFinite(forhold) || forhold < 0) return null;
  const f = forgreningFor(system);
  if (!(f > 0)) return null;
  const t = (th / Math.LN2) * Math.log1p(forhold / f);
  return Number.isFinite(t) ? t : null;
}

/**
 * Alderen (år) fra mengdene datter og mor i en prøve (atomer, mol eller prosent, bare det er samme enhet). Null når
 * det ikke er noen mor igjen (P = 0, alderen kan ikke bestemmes), ved negative mengder eller ugyldige tall.
 */
export function alderFraMengder(datter: number, mor: number, system: IsotopId | number): number | null {
  if (!Number.isFinite(datter) || !Number.isFinite(mor) || datter < 0 || mor <= 0) return null;
  return alderFraForhold(datter / mor, system);
}

/**
 * Alderen (år) fra andelen av morisotopen som er igjen (0–1), slik C-14 måles: t = −t½ · log₂(andel). Med
 * C-14 og 5730 år er dette en «forenklet alder» (ikke kalibrert). Null for andel ≤ 0 (alt er borte, alderen er
 * ubestemt), andel over 1 eller ugyldige tall.
 */
export function alderFraRest(andel: number, system: IsotopId | number): number | null {
  const th = halvering(system);
  if (th === null || !Number.isFinite(andel) || andel <= 0 || andel > 1) return null;
  return Math.max(0, -th * Math.log2(andel));
}

/**
 * Om en alder (år) ligger i måleområdet til systemet: `'for-ung'` (for lite datter eller for lite henfall til å
 * måle), `'egnet'` eller `'for-gammel'` (for lite mor igjen). Null for ugyldige tall.
 */
export function egnet(system: IsotopId, alder: number): 'for-ung' | 'egnet' | 'for-gammel' | null {
  const s = ISOTOPER[system];
  if (!s || !Number.isFinite(alder) || alder < 0) return null;
  if (alder < s.maleomrade.min) return 'for-ung';
  if (alder > s.maleomrade.max) return 'for-gammel';
  return 'egnet';
}

/**
 * Konkordiakurven for uran–bly: punktet (²⁰⁷Pb* / ²³⁵U, ²⁰⁶Pb* / ²³⁸U) etter tiden `t` (år). Zirkon som ikke har mistet
 * bly, ligger på kurven; tap av bly drar punktet inn mot origo. Null for negativ tid eller ugyldige tall.
 */
export function konkordia(t: number): { x: number; y: number } | null {
  const up = ISOTOPER['u-pb'];
  if (!up.andreKjede) return null;
  const y = datterForhold(t, up.halveringstid);
  const x = datterForhold(t, up.andreKjede.halveringstid);
  return x === null || y === null ? null : { x, y };
}

// ---------------------------------------------------------------------------------------------------------------
// Oppvarming og lukketemperatur

/** Hvordan det går med klokka i ett mineral etter en oppvarming. */
export interface Nullstilling {
  mineral: string;
  lukketemperatur: number;
  /** Andelen av datterisotopen som har lekket ut (0–1). */
  andelTapt: number;
  /** `'urort'` under 5 % tap, `'nullstilt'` over 95 %, ellers `'delvis'`. */
  status: 'urort' | 'delvis' | 'nullstilt';
}

const R = 8.314e-3; // kJ/(mol · K)
/** Tidskonstanten ved lukketemperaturen: holdes mineralet der i omtrent 1 million år, har omtrent 63 % lekket ut. */
const TAU_VED_LUKKING = 1e6;

/**
 * Om en oppvarming til `toppTemperatur` (°C) i `varighet` (år) nullstiller klokka i hvert mineral systemet daterer.
 * Forenklet modell: datterisotopen lekker ut med en tidskonstant som er 1 million år ved lukketemperaturen og endrer
 * seg med temperaturen som diffusjon (Arrhenius), så tapet er 1 − e^(−varighet/τ). Zirkon tåler nesten all
 * metamorfose, mens biotitt nullstilles allerede ved noen hundre grader.
 *
 * Gir en tom liste for C-14 (oppvarming nullstiller ikke C-14; klokka starter når organismen dør), og null for
 * ugyldige tall, negativ varighet eller temperatur under det absolutte nullpunktet.
 */
export function nullstilles(system: IsotopId, toppTemperatur: number, varighet: number): Nullstilling[] | null {
  const s = ISOTOPER[system];
  if (!s || !Number.isFinite(toppTemperatur) || !Number.isFinite(varighet)) return null;
  if (varighet < 0 || toppTemperatur <= -273.15) return null;
  const T = toppTemperatur + 273.15;
  return s.mineraler.map((m) => {
    const Tc = m.lukketemperatur + 273.15;
    const eksponent = (m.aktiveringsenergi / R) * (1 / T - 1 / Tc);
    // Svært kalde forhold gir en enorm tidskonstant: tapet er da null, ikke NaN
    const tau = eksponent > 700 ? Number.POSITIVE_INFINITY : TAU_VED_LUKKING * Math.exp(eksponent);
    const andelTapt = Number.isFinite(tau) ? Math.min(1, Math.max(0, -Math.expm1(-varighet / tau))) : 0;
    const status: Nullstilling['status'] = andelTapt < 0.05 ? 'urort' : andelTapt > 0.95 ? 'nullstilt' : 'delvis';
    return { mineral: m.mineral, lukketemperatur: m.lukketemperatur, andelTapt, status };
  });
}

/**
 * Alderen (år) et mineral ser ut til å ha i dag når det ble dannet for `dannet` år siden, ble varmet opp for
 * `oppvarmet` år siden og da mistet andelen `andelTapt` (0–1) av datterisotopen. Helt nullstilt gir alderen til
 * oppvarmingen, urørt gir dannelsesalderen, og delvis tap gir noe imellom. Null for ugyldige tall, oppvarming før
 * dannelsen eller andel utenfor 0–1.
 */
export function tilsynelatendeAlder(
  dannet: number,
  oppvarmet: number,
  andelTapt: number,
  system: IsotopId | number,
): number | null {
  const th = halvering(system);
  if (th === null || ![dannet, oppvarmet, andelTapt].every(Number.isFinite)) return null;
  if (oppvarmet < 0 || dannet < oppvarmet || andelTapt < 0 || andelTapt > 1) return null;
  const f = forgreningFor(system);
  const lambda = Math.LN2 / th;
  // Datter per mor like før oppvarmingen, minus tapet, ført fram til i dag, pluss det som er laget siden
  const forFor = f * Math.expm1(lambda * (dannet - oppvarmet));
  const forhold = (1 - andelTapt) * forFor * Math.exp(lambda * oppvarmet) + f * Math.expm1(lambda * oppvarmet);
  return alderFraForhold(forhold, system);
}

/** C-14-alder (år) for et marint skjell, korrigert for havets reservoaralder. Null for ugyldige tall. */
export function korrigerForReservoar(alder: number, reservoaralder = MARIN_RESERVOARALDER): number | null {
  if (!Number.isFinite(alder) || !Number.isFinite(reservoaralder) || alder < 0) return null;
  return Math.max(0, alder - reservoaralder);
}
