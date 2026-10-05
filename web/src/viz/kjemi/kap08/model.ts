/**
 * Ren kjemi for kapittel 8 Miljøanalyse (ingen React), så den kan testes for seg: spektrofotometri (Beer–Lamberts lov),
 * emisjonsspektre og flammefarger, gravimetrisk analyse og konsentrasjonsenheter for vann- og luftkvalitet.
 *
 * Molare masser regnes med kit-ets formelparser (IUPAC-verdier forkortet som i Kjemi 1, se viz/README.md).
 */
import { fmt } from '../../kit/format';
import { molarMass } from '../kit/formel';
import { seededRandom } from '../kit/random';

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Plancks konstant (J·s), lysfarten (m/s), Avogadros tall (/mol) og elektronvolt (J), CODATA avrundet som i Kjemi 1. */
export const H_PLANCK = 6.626e-34;
export const C_LIGHT = 2.998e8;
export const N_A = 6.022e23;
export const EV = 1.602e-19;

/** Synlig lys i figurene (nm). */
export const VIS_MIN = 380;
export const VIS_MAX = 750;

/** Energien til ett foton med bølgelengde λ (nm): E = hc/λ, i joule. */
export function photonEnergy(nm: number): number {
  return (H_PLANCK * C_LIGHT) / (nm * 1e-9);
}

/** Energien for ett mol fotoner (kJ/mol): E · N_A. Samme enhet som ioniseringsenergi og entalpi i Kjemi 1. */
export function photonEnergyPerMol(nm: number): number {
  return (photonEnergy(nm) * N_A) / 1000;
}

/** Bølgelengden (nm) til et foton med energi E (J): λ = hc/E. */
export function wavelengthFromEnergy(E: number): number {
  return ((H_PLANCK * C_LIGHT) / E) * 1e9;
}

export type ColorWord = 'fiolett' | 'blå' | 'blågrønn' | 'grønn' | 'gulgrønn' | 'gul' | 'oransje' | 'rød' | 'dyp rød';

/** Fargenavnet til lys med bølgelengde λ (nm), med de vanlige grensene for regnbuefargene. */
export function colorWord(nm: number): ColorWord {
  if (nm < 450) return 'fiolett';
  if (nm < 490) return 'blå';
  if (nm < 505) return 'blågrønn';
  if (nm < 550) return 'grønn';
  if (nm < 575) return 'gulgrønn';
  if (nm < 595) return 'gul';
  if (nm < 620) return 'oransje';
  if (nm < 700) return 'rød';
  return 'dyp rød';
}

const NEUTER: Record<ColorWord, string> = {
  fiolett: 'fiolett',
  blå: 'blått',
  blågrønn: 'blågrønt',
  grønn: 'grønt',
  gulgrønn: 'gulgrønt',
  gul: 'gult',
  oransje: 'oransje',
  rød: 'rødt',
  'dyp rød': 'dyprødt',
};

/** Fargeordet i intetkjønn, til «… lys»: «grønt lys», «gult lys», «rødt lys». */
export function colorWordNeuter(nm: number): string {
  return NEUTER[colorWord(nm)];
}

/* =====================================================================================================
 * Spektrofotometri: Beer–Lamberts lov A = ε · l · c
 * ===================================================================================================== */

export interface Band {
  /** Midten av absorpsjonsbåndet (nm). */
  center: number;
  /** Standardavvik σ (nm). */
  width: number;
  /** Relativ høyde. */
  height: number;
}

export type AbsorberId = 'permanganat' | 'kobberammin' | 'jerntiocyanat';

export interface Absorber {
  id: AbsorberId;
  /** Navnet på løsningen. */
  name: string;
  /** Kort navn til nedtrekkslista. */
  short: string;
  /** Det fargede stoffet (formel med ^ for ladning). */
  formula: string;
  /** Hva prøven typisk er i en miljøanalyse. */
  use: string;
  /** Molar absorpsjonskoeffisient ε ved absorpsjonsmaksimum (L/(mol·cm)). */
  epsMax: number;
  bands: Band[];
  /** Fargen løsningen har (komplementærfargen til lyset som absorberes). */
  seen: string;
  /** Standardløsningene (mol/L). */
  standards: number[];
  /** Største konsentrasjon på glidebryteren (mol/L). */
  cMax: number;
  /** Standardverdien til prøven (mol/L). */
  cDefault: number;
}

/**
 * Tre fargede løsninger fra skolelaben. Båndene er tilpasset slik at maksimum og ε stemmer med vanlige tabellverdier:
 *  - Permanganat MnO₄⁻: maksimum ved ca. 525 nm (to topper, 526 og 546 nm, og skuldre ved 507 og 566 nm),
 *    ε ≈ 2,4 · 10³ L/(mol·cm) (Harris, «Quantitative Chemical Analysis»; vanlig skoleforsøk).
 *  - Tetraamminkobber(II) [Cu(NH₃)₄]²⁺: bredt bånd med maksimum ved ca. 600 nm, ε ≈ 50 L/(mol·cm) (dypblå løsning
 *    når kobberioner i vann tilsettes ammoniakk, brukt til å bestemme kobber).
 *  - Jern(III)tiocyanat [FeSCN]²⁺: maksimum ved ca. 450 nm, ε ≈ 4,7 · 10³ L/(mol·cm) (blodrød; bestemmelse av jern i
 *    vann etter tilsetning av tiocyanat).
 * Formen på båndene er forenklet (summer av gaussiske bånd).
 */
export const ABSORBERS: Absorber[] = [
  {
    id: 'permanganat',
    name: 'kaliumpermanganat',
    short: 'permanganat',
    formula: 'MnO4^-',
    use: 'mangan i vann (oksidert til permanganat)',
    epsMax: 2.4e3,
    bands: [
      { center: 507, width: 9, height: 0.55 },
      { center: 526, width: 9, height: 0.92 },
      { center: 546, width: 9, height: 0.86 },
      { center: 566, width: 10, height: 0.38 },
      { center: 530, width: 30, height: 0.25 },
    ],
    seen: 'fiolett',
    standards: [0.05e-3, 0.1e-3, 0.2e-3, 0.3e-3, 0.4e-3],
    cMax: 1.0e-3,
    cDefault: 0.25e-3,
  },
  {
    id: 'kobberammin',
    name: 'tetraamminkobber(II)',
    short: 'kobberammin',
    formula: '[Cu(NH3)4]^2+',
    use: 'kobber i vann (tilsatt ammoniakk)',
    epsMax: 50,
    bands: [{ center: 600, width: 72, height: 1 }],
    seen: 'dypblå',
    standards: [4e-3, 8e-3, 12e-3, 16e-3, 20e-3],
    cMax: 50e-3,
    cDefault: 11e-3,
  },
  {
    id: 'jerntiocyanat',
    name: 'jern(III)tiocyanat',
    short: 'jerntiocyanat',
    formula: '[FeSCN]^2+',
    use: 'jern i vann (tilsatt tiocyanat)',
    epsMax: 4.7e3,
    bands: [{ center: 450, width: 48, height: 1 }],
    seen: 'blodrød',
    standards: [0.04e-3, 0.08e-3, 0.12e-3, 0.16e-3, 0.2e-3],
    cMax: 0.5e-3,
    cDefault: 0.11e-3,
  },
];

export function getAbsorber(id: string): Absorber {
  return ABSORBERS.find((a) => a.id === id) ?? ABSORBERS[0]!;
}

function bandShape(a: Absorber, nm: number): number {
  let s = 0;
  for (const b of a.bands) s += b.height * Math.exp(-((nm - b.center) ** 2) / (2 * b.width * b.width));
  return s;
}

const peakCache = new Map<AbsorberId, { nm: number; shape: number }>();

/** Absorpsjonsmaksimum λ_maks (nm, nærmeste 0,5 nm i det synlige området) og formens høyde der. */
export function absorptionMax(a: Absorber): { nm: number; shape: number } {
  const hit = peakCache.get(a.id);
  if (hit) return hit;
  let best = { nm: VIS_MIN, shape: -1 };
  for (let nm = VIS_MIN; nm <= VIS_MAX; nm += 0.5) {
    const s = bandShape(a, nm);
    if (s > best.shape) best = { nm, shape: s };
  }
  peakCache.set(a.id, best);
  return best;
}

/** Molar absorpsjonskoeffisient ε(λ) i L/(mol·cm). */
export function epsilon(a: Absorber, nm: number): number {
  return (a.epsMax * bandShape(a, nm)) / absorptionMax(a).shape;
}

/** Beer–Lamberts lov: A = ε · l · c (l i cm, c i mol/L). */
export function beerLambert(eps: number, l: number, c: number): number {
  return eps * l * c;
}

/** Transmittans T = I/I₀ = 10^(−A). */
export function transmittance(A: number): number {
  return 10 ** -A;
}

/** Absorbans fra transmittans: A = −lg T. */
export function absorbanceFromT(T: number): number {
  return -Math.log10(T);
}

/**
 * Strølys i fotometeret (andel av lyset som går utenom prøven eller har feil bølgelengde). Det gjør at målt absorbans
 * flater ut ved høye konsentrasjoner, så standardkurven bøyer av over A ≈ 1. 0,5 % er et typisk tall for enkle
 * skolefotometre.
 */
export const STRAY_LIGHT = 0.005;

/** Absorbansen fotometeret viser når den «ekte» absorbansen er A: A_målt = −lg((10^(−A) + s)/(1 + s)). */
export function measuredAbsorbance(A: number, s = STRAY_LIGHT): number {
  return -Math.log10((10 ** -A + s) / (1 + s));
}

/** Lysintensiteten (andel av I₀) etter x cm inn i kyvetten: I/I₀ = 10^(−ε·c·x). */
export function intensityAt(eps: number, c: number, x: number): number {
  return 10 ** -(eps * c * x);
}

export interface Measurement {
  c: number;
  /** Absorbans uten strølys (Beer–Lamberts lov). */
  ideal: number;
  /** Absorbansen som vises (med strølys og litt målestøy for standardene). */
  A: number;
}

/** Målte absorbanser for standardløsningene ved λ, med litt fast målestøy (±0,003) så punktene ikke ligger perfekt. */
export function measureStandards(a: Absorber, nm: number, l: number): Measurement[] {
  const rnd = seededRandom(17);
  const eps = epsilon(a, nm);
  return a.standards.map((c) => {
    const ideal = beerLambert(eps, l, c);
    const noise = (rnd() - 0.5) * 0.006;
    return { c, ideal, A: Math.max(0, measuredAbsorbance(ideal) + noise) };
  });
}

export interface StandardCurve {
  /** Stigningstallet (L/mol): A = k · c. Teoretisk k = ε · l. */
  slope: number;
  /** Forklaringsgraden R² for linja gjennom origo. */
  r2: number;
  /** Høyeste absorbans blant standardene (kurven gjelder bare opp hit). */
  maxA: number;
}

/** Rett linje gjennom origo (blindprøven har A = 0) tilpasset standardene med minste kvadraters metode. */
export function fitStandardCurve(points: Measurement[]): StandardCurve {
  let sxy = 0;
  let sxx = 0;
  for (const p of points) {
    sxy += p.c * p.A;
    sxx += p.c * p.c;
  }
  const slope = sxx > 0 ? sxy / sxx : 0;
  const mean = points.reduce((s, p) => s + p.A, 0) / Math.max(1, points.length);
  let ssRes = 0;
  let ssTot = 0;
  for (const p of points) {
    ssRes += (p.A - slope * p.c) ** 2;
    ssTot += (p.A - mean) ** 2;
  }
  return { slope, r2: ssTot > 0 ? 1 - ssRes / ssTot : 0, maxA: Math.max(0, ...points.map((p) => p.A)) };
}

export type ReadingStatus = 'ok' | 'over' | 'for-svak' | 'ingen-absorpsjon';

export interface SampleReading {
  /** Absorbansen fotometeret viser for prøven. */
  A: number;
  ideal: number;
  T: number;
  /** Konsentrasjonen lest av på standardkurven (mol/L), NaN når den ikke kan leses av. */
  cFound: number;
  status: ReadingStatus;
}

/**
 * Leser av prøven på standardkurven: c = A/k. «over» betyr at prøven er sterkere enn den sterkeste standarden (fortynn
 * og mål på nytt), «for-svak» at absorbansen er så liten at målestøyen blir stor, «ingen-absorpsjon» at stoffet
 * nesten ikke absorberer ved denne bølgelengden.
 */
export function readSample(a: Absorber, nm: number, l: number, c: number, curve: StandardCurve): SampleReading {
  const ideal = beerLambert(epsilon(a, nm), l, c);
  const A = measuredAbsorbance(ideal);
  const T = 10 ** -A;
  if (curve.slope * Math.max(...a.standards) < 0.02) return { A, ideal, T, cFound: NaN, status: 'ingen-absorpsjon' };
  const cFound = A / curve.slope;
  const status: ReadingStatus = A > curve.maxA * 1.05 ? 'over' : A < 0.02 && c > 0 ? 'for-svak' : 'ok';
  return { A, ideal, T, cFound, status };
}

/**
 * Hvor mye ε endrer seg (relativt) hvis bølgelengden er stilt inn 2 nm feil: |dε/dλ| · 2 nm / ε. Ved
 * absorpsjonsmaksimum er dette nesten null; på en bratt flanke kan det bli mange prosent.
 */
export function wavelengthSensitivity(a: Absorber, nm: number, dnm = 2): number {
  const e = epsilon(a, nm);
  if (!(e > 1e-9 * a.epsMax)) return Infinity;
  return Math.abs(epsilon(a, nm + dnm) - epsilon(a, nm - dnm)) / 2 / e;
}

/* =====================================================================================================
 * Emisjonsspektre og flammefarger
 * ===================================================================================================== */

export type FlameElement = 'Li' | 'Na' | 'K' | 'Ca' | 'Sr' | 'Ba' | 'Cu';

export interface Level {
  id: string;
  /** Energi over grunntilstanden (eV). */
  eV: number;
  /** Elektronkonfigurasjonen til tilstanden, f.eks. «3p» (det ytterste elektronet) eller «4s4p». */
  label: string;
}

export interface EmissionLine {
  /** Bølgelengde i luft (nm), NIST Atomic Spectra Database. */
  nm: number;
  /** Relativ styrke i figuren (0–1), grovt etter NIST og flammespektre. */
  strength: number;
  /** Overgangen for atomlinjer (fra nivå → til nivå); mangler for molekylbånd. */
  from?: string;
  to?: string;
  /** Molekylbånd fra f.eks. CaOH i flammen: bredde (nm) og molekylet som sender ut lyset. */
  band?: { width: number; molecule: string };
}

export interface FlameData {
  symbol: FlameElement;
  name: string;
  /** Flammefargen slik lærebøkene beskriver den. */
  flame: string;
  /** Saltet som vanligvis brukes i flammeprøven. */
  salt: string;
  levels: Level[];
  lines: EmissionLine[];
}

/**
 * Data: bølgelengder i luft og energinivåer (eV over grunntilstanden) fra NIST Atomic Spectra Database (avrundet).
 * Bare de sterkeste synlige linjene er med. Molekylbåndene i flammen (CaOH, SrOH, BaOH/BaCl) er omtrentlige
 * midtpunkter fra flammespektroskopi; de gir mye av flammefargen til jordalkalimetallene.
 * Noen nivåer ligger svært tett (finstruktur, f.eks. Na 3p og K 4p) og tegnes nesten oppå hverandre. λ = hc/ΔE fra
 * nivåene stemmer med tabellverdien innenfor 0,5 nm (forskjellen mellom bølgelengde i luft og vakuum er ca. 0,2 nm).
 */
export const FLAME: Record<FlameElement, FlameData> = {
  Li: {
    symbol: 'Li',
    name: 'litium',
    flame: 'karminrød',
    salt: 'LiCl',
    levels: [
      { id: '2s', eV: 0, label: '2s' },
      { id: '2p', eV: 1.8478, label: '2p' },
      { id: '3d', eV: 3.8786, label: '3d' },
      { id: '4d', eV: 4.5408, label: '4d' },
    ],
    lines: [
      { nm: 670.79, strength: 1, from: '2p', to: '2s' },
      { nm: 610.36, strength: 0.45, from: '3d', to: '2p' },
      { nm: 460.29, strength: 0.25, from: '4d', to: '2p' },
    ],
  },
  Na: {
    symbol: 'Na',
    name: 'natrium',
    flame: 'gul',
    salt: 'NaCl',
    levels: [
      { id: '3s', eV: 0, label: '3s' },
      { id: '3p1', eV: 2.1023, label: '3p' },
      { id: '3p3', eV: 2.1044, label: '3p' },
      { id: '5s', eV: 4.1163, label: '5s' },
      { id: '4d', eV: 4.2835, label: '4d' },
      { id: '5d', eV: 4.5918, label: '5d' },
    ],
    lines: [
      { nm: 589.0, strength: 1, from: '3p3', to: '3s' },
      { nm: 589.59, strength: 1, from: '3p1', to: '3s' },
      { nm: 568.82, strength: 0.18, from: '4d', to: '3p3' },
      { nm: 616.07, strength: 0.15, from: '5s', to: '3p3' },
      { nm: 498.28, strength: 0.12, from: '5d', to: '3p3' },
    ],
  },
  K: {
    symbol: 'K',
    name: 'kalium',
    flame: 'fiolett (lilla)',
    salt: 'KCl',
    levels: [
      { id: '4s', eV: 0, label: '4s' },
      { id: '4p1', eV: 1.61, label: '4p' },
      { id: '4p3', eV: 1.6171, label: '4p' },
      { id: '5p', eV: 3.0644, label: '5p' },
      { id: '6s', eV: 3.403, label: '6s' },
    ],
    lines: [
      { nm: 766.49, strength: 1, from: '4p3', to: '4s' },
      { nm: 769.9, strength: 0.9, from: '4p1', to: '4s' },
      { nm: 404.41, strength: 0.4, from: '5p', to: '4s' },
      { nm: 404.72, strength: 0.35, from: '5p', to: '4s' },
      { nm: 693.88, strength: 0.12, from: '6s', to: '4p3' },
    ],
  },
  Ca: {
    symbol: 'Ca',
    name: 'kalsium',
    flame: 'oransjerød (teglrød)',
    salt: 'CaCl₂',
    levels: [
      { id: '4s2', eV: 0, label: '4s²' },
      { id: '4s4p-a', eV: 1.8858, label: '4s4p' },
      { id: '4s4p-b', eV: 1.899, label: '4s4p' },
      { id: '3d4s', eV: 2.526, label: '3d4s' },
      { id: '4s4p-c', eV: 2.9325, label: '4s4p' },
      { id: '4s5s', eV: 3.9105, label: '4s5s' },
      { id: '3d4p', eV: 4.7435, label: '3d4p' },
    ],
    lines: [
      { nm: 422.67, strength: 0.75, from: '4s4p-c', to: '4s2' },
      { nm: 558.88, strength: 0.3, from: '3d4p', to: '3d4s' },
      { nm: 616.22, strength: 0.3, from: '4s5s', to: '4s4p-b' },
      { nm: 657.28, strength: 0.2, from: '4s4p-a', to: '4s2' },
      { nm: 554, strength: 0.7, band: { width: 9, molecule: 'CaOH' } },
      { nm: 622, strength: 1, band: { width: 11, molecule: 'CaOH' } },
    ],
  },
  Sr: {
    symbol: 'Sr',
    name: 'strontium',
    flame: 'rød (karminrød)',
    salt: 'SrCl₂',
    levels: [
      { id: '5s2', eV: 0, label: '5s²' },
      { id: '5s5p-a', eV: 1.7985, label: '5s5p' },
      { id: '5s5p-b', eV: 2.6902, label: '5s5p' },
    ],
    lines: [
      { nm: 460.73, strength: 0.6, from: '5s5p-b', to: '5s2' },
      { nm: 689.26, strength: 0.2, from: '5s5p-a', to: '5s2' },
      { nm: 606, strength: 0.6, band: { width: 9, molecule: 'SrOH' } },
      { nm: 646, strength: 0.85, band: { width: 10, molecule: 'SrOH' } },
      { nm: 682, strength: 1, band: { width: 10, molecule: 'SrOH' } },
    ],
  },
  Ba: {
    symbol: 'Ba',
    name: 'barium',
    flame: 'gulgrønn',
    salt: 'BaCl₂',
    levels: [
      { id: '6s2', eV: 0, label: '6s²' },
      { id: '6s6p', eV: 2.2394, label: '6s6p' },
    ],
    lines: [
      { nm: 553.55, strength: 1, from: '6s6p', to: '6s2' },
      { nm: 487, strength: 0.45, band: { width: 8, molecule: 'BaOH' } },
      { nm: 513, strength: 0.8, band: { width: 8, molecule: 'BaOH' } },
      { nm: 524, strength: 0.65, band: { width: 7, molecule: 'BaCl' } },
    ],
  },
  Cu: {
    symbol: 'Cu',
    name: 'kobber',
    flame: 'grønn (blågrønn)',
    salt: 'CuCl₂',
    levels: [
      { id: '4s', eV: 0, label: '3d¹⁰4s' },
      { id: '3d9-a', eV: 1.3889, label: '3d⁹4s²' },
      { id: '3d9-b', eV: 1.6422, label: '3d⁹4s²' },
      { id: '4p-a', eV: 3.7859, label: '3d¹⁰4p' },
      { id: '4p-b', eV: 3.8167, label: '3d¹⁰4p' },
      { id: '4d', eV: 6.1919, label: '3d¹⁰4d' },
    ],
    lines: [
      { nm: 510.55, strength: 0.7, from: '4p-b', to: '3d9-a' },
      { nm: 515.32, strength: 1, from: '4d', to: '4p-a' },
      { nm: 521.82, strength: 1, from: '4d', to: '4p-b' },
      { nm: 578.21, strength: 0.5, from: '4p-a', to: '3d9-b' },
    ],
  },
};

export const FLAME_ELEMENTS = Object.keys(FLAME) as FlameElement[];

/** Atomlinjene (de med en overgang mellom to nivåer), sortert etter styrke. */
export function atomicLines(el: FlameElement): EmissionLine[] {
  return FLAME[el].lines.filter((l) => !l.band).sort((a, b) => b.strength - a.strength);
}

/** Den sterkeste linja eller båndet, altså det som gir mest av flammefargen. */
export function strongestLine(el: FlameElement): EmissionLine {
  return [...FLAME[el].lines].sort((a, b) => b.strength - a.strength)[0]!;
}

export function levelOf(el: FlameElement, id: string | undefined): Level | undefined {
  return FLAME[el].levels.find((l) => l.id === id);
}

/** Energiforskjellen mellom nivåene i en overgang (J), fra energinivåtabellen. */
export function transitionEnergy(el: FlameElement, line: EmissionLine): number {
  const a = levelOf(el, line.from);
  const b = levelOf(el, line.to);
  if (!a || !b) return NaN;
  return (a.eV - b.eV) * EV;
}

export interface UnknownSample {
  id: string;
  /** Grunnstoffene i prøven (det første er hovedsvaret). */
  elements: FlameElement[];
  /** Styrken til hvert grunnstoff (natrium som forurensning er svak). */
  weights: number[];
  hint: string;
}

/**
 * Ukjente prøver. Natrium finnes nesten overalt (svette, støv, glass), så en svak gul natriumlinje dukker ofte opp
 * som forurensning, som i prøve B og E.
 */
export const UNKNOWN_SAMPLES: UnknownSample[] = [
  { id: 'A', elements: ['Li'], weights: [1], hint: 'Én sterk rød linje og noen svakere.' },
  { id: 'B', elements: ['K', 'Na'], weights: [1, 0.35], hint: 'Se etter linjer helt ytterst i begge ender av spekteret.' },
  { id: 'C', elements: ['Ba'], weights: [1], hint: 'Grønne linjer og bånd.' },
  { id: 'D', elements: ['Sr'], weights: [1], hint: 'Brede bånd i det røde og én blå linje.' },
  { id: 'E', elements: ['Cu', 'Na'], weights: [1, 0.3], hint: 'Flere grønne linjer tett i tett.' },
  { id: 'F', elements: ['Ca'], weights: [1], hint: 'En fiolett linje og brede bånd i oransje og gulgrønt.' },
];

/** Linjene i en ukjent prøve: linjene til alle grunnstoffene, med styrken ganget med vekten. */
export function sampleLines(s: UnknownSample): (EmissionLine & { element: FlameElement })[] {
  return s.elements.flatMap((el, i) => FLAME[el].lines.map((l) => ({ ...l, strength: l.strength * (s.weights[i] ?? 1), element: el })));
}

export interface MatchResult {
  /** Hvor mange av grunnstoffets linjer som finnes i prøven. */
  found: number;
  total: number;
  /** Den sterkeste linja til grunnstoffet som mangler i prøven. */
  missing: EmissionLine | null;
  /** Alle grunnstoffets linjer finnes i prøven. */
  present: boolean;
}

/** Sammenligner et grunnstoffs linjer med prøven (samme bølgelengde innenfor `tol` nm). */
export function matchElement(sample: UnknownSample, el: FlameElement, tol = 1): MatchResult {
  const lines = sampleLines(sample);
  const own = FLAME[el].lines;
  const hits = own.filter((l) => lines.some((s) => Math.abs(s.nm - l.nm) <= tol));
  const missing = own.filter((l) => !hits.includes(l)).sort((a, b) => b.strength - a.strength)[0] ?? null;
  return { found: hits.length, total: own.length, missing, present: hits.length === own.length };
}

/* =====================================================================================================
 * Gravimetri
 * ===================================================================================================== */

export type GravId = 'klorid' | 'sulfat' | 'kalsium';

export interface GravAnalysis {
  id: GravId;
  /** Stoffet som bestemmes (analytten). */
  analyte: { formula: string; name: string };
  /** Fellingsreagenset (løsning) og ionet som feller. */
  reagent: { formula: string; name: string; c: number };
  /** Bunnfallet som veies (tørket). */
  precipitate: { formula: string; name: string; look: string };
  /** Ionelikningen for fellingen. */
  equation: string;
  /** mol analytt per mol bunnfall. */
  ratio: number;
  /** Tørketemperatur. */
  dry: string;
  /** Grenseverdi i drikkevann (mg/L), drikkevannsforskriften (2016), vedlegg 1. */
  limit: number | null;
  /** Standardverdier: prøvevolum (mL) og masse bunnfall (g). */
  V: number;
  m: number;
}

/**
 * Tre klassiske gravimetriske analyser. Kalsiumoksalat tørkes ved ca. 105 °C og veies som monohydratet
 * CaC₂O₄·H₂O; sølvklorid og bariumsulfat tørkes ved ca. 110–120 °C. Grenseverdiene for klorid og sulfat er
 * indikatorparametere i drikkevannsforskriften (250 mg/L); kalsium har ingen grenseverdi.
 */
export const GRAV: Record<GravId, GravAnalysis> = {
  klorid: {
    id: 'klorid',
    analyte: { formula: 'Cl^-', name: 'klorid' },
    reagent: { formula: 'AgNO3', name: 'sølvnitrat', c: 0.1 },
    precipitate: { formula: 'AgCl', name: 'sølvklorid', look: 'hvitt' },
    equation: 'Ag^+(aq) + Cl^-(aq) → AgCl(s)',
    ratio: 1,
    dry: 'ca. 110 °C',
    limit: 250,
    V: 100,
    m: 0.085,
  },
  sulfat: {
    id: 'sulfat',
    analyte: { formula: 'SO4^2-', name: 'sulfat' },
    reagent: { formula: 'BaCl2', name: 'bariumklorid', c: 0.1 },
    precipitate: { formula: 'BaSO4', name: 'bariumsulfat', look: 'hvitt' },
    equation: 'Ba^2+(aq) + SO4^2-(aq) → BaSO4(s)',
    ratio: 1,
    dry: 'ca. 110 °C',
    limit: 250,
    V: 200,
    m: 0.15,
  },
  kalsium: {
    id: 'kalsium',
    analyte: { formula: 'Ca^2+', name: 'kalsium' },
    reagent: { formula: '(NH4)2C2O4', name: 'ammoniumoksalat', c: 0.1 },
    precipitate: { formula: 'CaC2O4·H2O', name: 'kalsiumoksalatmonohydrat', look: 'hvitt' },
    equation: 'Ca^2+(aq) + C2O4^2-(aq) + H2O(l) → CaC2O4·H2O(s)',
    ratio: 1,
    dry: 'ca. 105 °C',
    limit: null,
    V: 100,
    m: 0.0365,
  },
};

export type GravError = 'ingen' | 'fuktig' | 'tap' | 'underskudd';

/**
 * Feilkildene og hvor stor feil de gir i den veide massen (andel). Fuktig bunnfall: ca. 6 % vann igjen. Tap: ca.
 * 5 % av bunnfallet går gjennom filteret eller blir igjen i begeret. For lite fellingsreagens: ca. 15 % av
 * analytten blir ikke felt.
 */
export const GRAV_ERRORS: Record<GravError, { factor: number; text: string }> = {
  ingen: { factor: 1, text: 'Ingen' },
  fuktig: { factor: 1.06, text: 'Bunnfallet er ikke helt tørt' },
  tap: { factor: 0.95, text: 'Tap av bunnfall ved filtrering' },
  underskudd: { factor: 0.85, text: 'For lite fellingsreagens' },
};

export interface GravResult {
  M: number;
  Ma: number;
  /** Stoffmengde bunnfall (mol). */
  nP: number;
  /** Stoffmengde analytt (mol). */
  nA: number;
  /** Masse analytt (g). */
  mA: number;
  /** Konsentrasjon (mol/L). */
  c: number;
  /** Massekonsentrasjon (mg/L). */
  mgPerL: number;
  /** Masseandel i prøven (ppm, mg/kg) når tettheten er 1,00 g/mL. */
  ppm: number;
}

/** Utregningen fra veid masse bunnfall (g) og prøvevolum (mL) til konsentrasjonen av analytten. */
export function gravimetry(a: GravAnalysis, m: number, VmL: number): GravResult {
  const M = molarMass(a.precipitate.formula);
  const Ma = molarMass(a.analyte.formula);
  const nP = m / M;
  const nA = nP * a.ratio;
  const mA = nA * Ma;
  const V = VmL / 1000;
  const mgPerL = (mA * 1000) / V;
  return { M, Ma, nP, nA, mA, c: nA / V, mgPerL, ppm: mgPerL };
}

/**
 * Den riktige massen av tørt bunnfall når en feilkilde har påvirket den veide massen, og hvor mye resultatet bommer
 * (relativ feil i konsentrasjonen, positiv = for høyt).
 */
export function gravError(err: GravError, mMeasured: number): { mTrue: number; relError: number } {
  const f = GRAV_ERRORS[err].factor;
  return { mTrue: mMeasured / f, relError: f - 1 };
}

/** Minste volum fellingsreagens (mL) som trengs for å felle all analytten (molforholdet er 1 : 1 for alle tre). */
export function reagentNeeded(a: GravAnalysis, nA: number): number {
  return (nA / a.reagent.c) * 1000;
}

/* =====================================================================================================
 * Konsentrasjonsenheter for vann- og luftkvalitet
 * ===================================================================================================== */

/** Molvolumet til en gass ved 25 °C og 1 atm (101,3 kPa), L/mol, som i Kjemi 1. */
export const V_M = 24.5;

export type Medium = 'vann' | 'luft';
export type NaturalUnit = 'mg/L' | 'µg/L' | 'µg/m³' | 'mg/m³';

export interface Limit {
  /** Grenseverdien i den naturlige enheten. */
  value: number;
  /** Hva den gjelder, f.eks. «årsmiddel» eller «drikkevann». */
  label: string;
}

export interface Pollutant {
  id: string;
  name: string;
  /** Formel, eller null for svevestøv (blanding av partikler uten én molar masse). */
  formula: string | null;
  medium: Medium;
  unit: NaturalUnit;
  limits: Limit[];
  /** Glidebryterens område i den naturlige enheten (logaritmisk). */
  min: number;
  max: number;
  value: number;
  source: string;
  /** Hvor stoffet kommer fra. */
  origin: string;
}

/**
 * Stoffer og grenseverdier. Drikkevann: drikkevannsforskriften (2016), vedlegg 1 (nitrat 50 mg/L, nitritt
 * 0,50 mg/L, fluorid 1,5 mg/L, bly 10 µg/L, arsen 10 µg/L). Uteluft: forurensningsforskriften kapittel 7, § 7-6
 * (endret 2016): NO₂ timemiddel 200 µg/m³ og årsmiddel 40 µg/m³, SO₂ timemiddel 350 µg/m³ og døgnmiddel
 * 125 µg/m³, PM10 døgnmiddel 50 µg/m³ og årsmiddel 25 µg/m³, PM2,5 årsmiddel 15 µg/m³, CO 10 mg/m³ (8 timer).
 */
export const POLLUTANTS: Pollutant[] = [
  {
    id: 'nitrat',
    name: 'nitrat',
    formula: 'NO3^-',
    medium: 'vann',
    unit: 'mg/L',
    limits: [{ value: 50, label: 'drikkevann' }],
    min: 0.1,
    max: 1000,
    value: 12,
    source: 'drikkevannsforskriften',
    origin: 'gjødsel og kloakk som siver ned i grunnvannet',
  },
  {
    id: 'nitritt',
    name: 'nitritt',
    formula: 'NO2^-',
    medium: 'vann',
    unit: 'mg/L',
    limits: [{ value: 0.5, label: 'drikkevann' }],
    min: 0.001,
    max: 10,
    value: 0.05,
    source: 'drikkevannsforskriften',
    origin: 'nedbrytning av nitrogenforbindelser (gjødsel, kloakk)',
  },
  {
    id: 'fluorid',
    name: 'fluorid',
    formula: 'F^-',
    medium: 'vann',
    unit: 'mg/L',
    limits: [{ value: 1.5, label: 'drikkevann' }],
    min: 0.01,
    max: 30,
    value: 0.8,
    source: 'drikkevannsforskriften',
    origin: 'berggrunnen (særlig i borebrønner)',
  },
  {
    id: 'bly',
    name: 'bly',
    formula: 'Pb^2+',
    medium: 'vann',
    unit: 'µg/L',
    limits: [{ value: 10, label: 'drikkevann' }],
    min: 0.1,
    max: 2000,
    value: 4,
    source: 'drikkevannsforskriften',
    origin: 'gamle vannrør og armaturer',
  },
  {
    id: 'arsen',
    name: 'arsen',
    formula: 'As',
    medium: 'vann',
    unit: 'µg/L',
    limits: [{ value: 10, label: 'drikkevann' }],
    min: 0.1,
    max: 2000,
    value: 25,
    source: 'drikkevannsforskriften',
    origin: 'berggrunnen (borebrønner)',
  },
  {
    id: 'no2',
    name: 'nitrogendioksid',
    formula: 'NO2',
    medium: 'luft',
    unit: 'µg/m³',
    limits: [
      { value: 200, label: 'timemiddel' },
      { value: 40, label: 'årsmiddel' },
    ],
    min: 1,
    max: 2000,
    value: 65,
    source: 'forurensningsforskriften',
    origin: 'eksos, særlig fra dieselbiler',
  },
  {
    id: 'so2',
    name: 'svoveldioksid',
    formula: 'SO2',
    medium: 'luft',
    unit: 'µg/m³',
    limits: [
      { value: 350, label: 'timemiddel' },
      { value: 125, label: 'døgnmiddel' },
    ],
    min: 1,
    max: 5000,
    value: 20,
    source: 'forurensningsforskriften',
    origin: 'forbrenning av svovelholdig kull og olje, industri',
  },
  {
    id: 'co',
    name: 'karbonmonoksid',
    formula: 'CO',
    medium: 'luft',
    unit: 'mg/m³',
    limits: [{ value: 10, label: '8-timersmiddel' }],
    min: 0.01,
    max: 200,
    value: 1.5,
    source: 'forurensningsforskriften',
    origin: 'ufullstendig forbrenning (eksos, vedfyring)',
  },
  {
    id: 'pm10',
    name: 'svevestøv PM10',
    formula: null,
    medium: 'luft',
    unit: 'µg/m³',
    limits: [
      { value: 50, label: 'døgnmiddel' },
      { value: 25, label: 'årsmiddel' },
    ],
    min: 1,
    max: 1000,
    value: 35,
    source: 'forurensningsforskriften',
    origin: 'veistøv fra piggdekk, vedfyring og eksos',
  },
  {
    id: 'pm25',
    name: 'svevestøv PM2,5',
    formula: null,
    medium: 'luft',
    unit: 'µg/m³',
    limits: [{ value: 15, label: 'årsmiddel' }],
    min: 0.5,
    max: 500,
    value: 8,
    source: 'forurensningsforskriften',
    origin: 'vedfyring og eksos (små partikler som når langt ned i lungene)',
  },
];

export function getPollutant(id: string): Pollutant {
  return POLLUTANTS.find((p) => p.id === id) ?? POLLUTANTS[0]!;
}

/** Faktoren fra den naturlige enheten til mg/L (vann) eller µg/m³ (luft). */
const TO_BASE: Record<NaturalUnit, number> = { 'mg/L': 1, 'µg/L': 1e-3, 'µg/m³': 1, 'mg/m³': 1000 };

export interface WaterUnits {
  molPerL: number;
  mgPerL: number;
  ugPerL: number;
  /** Masse-ppm (mg/kg): for fortynnede vannløsninger er 1 L ≈ 1 kg, så mg/L ≈ ppm. */
  ppm: number;
  ppb: number;
}

/** Alle enhetene for et stoff i vann. M i g/mol. */
export function waterUnits(value: number, unit: NaturalUnit, M: number): WaterUnits {
  const mgPerL = value * TO_BASE[unit];
  return { molPerL: mgPerL / 1000 / M, mgPerL, ugPerL: mgPerL * 1000, ppm: mgPerL, ppb: mgPerL * 1000 };
}

export interface AirUnits {
  ugPerM3: number;
  mgPerM3: number;
  /** Stoffmengdekonsentrasjon (µmol/m³), NaN for svevestøv. */
  umolPerM3: number;
  /** mol per liter luft, NaN for svevestøv. */
  molPerL: number;
  /** Volum-ppb (nL gass per L luft): ppb = µg/m³ · V_m / M. NaN for svevestøv. */
  ppb: number;
  ppm: number;
}

/** Alle enhetene for et stoff i luft (25 °C, 1 atm). M = null for svevestøv. */
export function airUnits(value: number, unit: NaturalUnit, M: number | null): AirUnits {
  const ug = value * TO_BASE[unit];
  if (M === null || !(M > 0)) return { ugPerM3: ug, mgPerM3: ug / 1000, umolPerM3: NaN, molPerL: NaN, ppb: NaN, ppm: NaN };
  const umol = ug / M;
  const ppb = umol * V_M;
  return { ugPerM3: ug, mgPerM3: ug / 1000, umolPerM3: umol, molPerL: (umol * 1e-6) / 1000, ppb, ppm: ppb / 1000 };
}

/** Molar masse for et forurensende stoff (null for svevestøv). */
export function pollutantMolarMass(p: Pollutant): number | null {
  return p.formula ? molarMass(p.formula) : null;
}

/**
 * Grenseverdien som tekst slik forskriftene skriver den (125 µg/m³, 0,50 mg/L, 1,5 mg/L), ikke avrundet til to gjeldende
 * siffer som målingene (fmtSig(125, 2) ville gitt «130»).
 */
export function formatLimit(v: number): string {
  return fmt(v, v >= 10 ? 0 : v >= 1 ? (Number.isInteger(v) ? 0 : 1) : 2);
}

/** Målt verdi delt på grenseverdien: 1 = akkurat på grensen. */
export function limitRatio(value: number, limit: Limit): number {
  return value / limit.value;
}

export type LimitStatus = 'langt under' | 'under' | 'nær' | 'over';

/** Hvordan en måling ligger an mot grenseverdien. */
export function limitStatus(ratio: number): LimitStatus {
  if (ratio > 1) return 'over';
  if (ratio >= 0.8) return 'nær';
  if (ratio >= 0.1) return 'under';
  return 'langt under';
}

/** Verdi på en logaritmisk glidebryter: posisjon 0–1 → verdi mellom min og max. */
export function logValue(min: number, max: number, t: number): number {
  return min * (max / min) ** clamp(t, 0, 1);
}

/** Motsatt av logValue. */
export function logPosition(min: number, max: number, v: number): number {
  return clamp(Math.log(v / min) / Math.log(max / min), 0, 1);
}

/** Runder av til «pene» tall med to gjeldende siffer (til glidebryteren, så verdiene blir 12, 15, 0,50 …). */
export function niceRound(v: number): number {
  if (!(v > 0)) return v;
  const e = Math.floor(Math.log10(v)) - 1;
  return Math.round(v / 10 ** e) * 10 ** e;
}
