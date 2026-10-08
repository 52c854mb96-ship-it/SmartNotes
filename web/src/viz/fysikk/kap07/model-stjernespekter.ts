/**
 * Ren fysikk for «Stjernespekter» (7C Emisjon og absorpsjon): de mørke linjene i spekteret til en stjerne sammenlignes
 * med linjene til fem grunnstoffer målt i laboratoriet. Ingen React, så alt kan testes.
 *
 * Forenklinger (står også i forklaringen): stjernespekteret viser bare linjer fra de fem grunnstoffene eleven kan slå
 * på (ekte stjerner har tusenvis av linjer), og et grunnstoff som finnes i atmosfæren, gir alle sine linjer, sterke
 * eller svake. Bølgelengdene er målte verdier i luft (nm). Det kontinuerlige spekteret er et svart legeme (Planck).
 */

/* ---------- Konstanter med verdiene i ERGO Fysikk 1 ---------- */

/** Plancks konstant (J s). */
export const H_PLANCK = 6.63e-34;
/** Lysfarten (m/s). */
export const C_LIGHT = 3.0e8;
/** Elementærladningen (C): 1 eV = 1,60 · 10⁻¹⁹ J. */
export const E_CHARGE = 1.6e-19;
/** Konstanten i Bohrs formel for hydrogen: E_n = −B/n² (J). */
export const BOHR_B = 2.18e-18;
/** Boltzmanns konstant (J/K), bare til formen på det kontinuerlige spekteret. */
export const K_BOLTZMANN = 1.38e-23;

/** Bølgelengdene i figuren (nm): synlig lys fra fiolett til dyp rød. */
export const RANGE: readonly [number, number] = [380, 700];
/** To linjer regnes som samme linje når de er nærmere enn dette (nm). Heliums 587,6 nm og natriums 589,0 nm er ulike. */
export const MATCH_TOL = 0.5;

/* ---------- Grunnstoffene og linjene målt i laboratoriet ---------- */

export type ElementId = 'H' | 'He' | 'Na' | 'Ca' | 'Fe';
export const ELEMENT_ORDER: readonly ElementId[] = ['H', 'He', 'Na', 'Ca', 'Fe'];

export interface LabLine {
  /** Bølgelengde i luft (nm). */
  nm: number;
  /** Relativ lysstyrke i laboratoriet (emisjon), 0–1. */
  I: number;
  /** Hvor sterkt linja typisk tas opp i en stjerneatmosfære, 0–1 (ganges med styrken i hver stjerne). */
  a: number;
  /** Breddefaktor: resonanslinjene (Ca K og H, Na D) blir bredere enn de andre. Standard 1. */
  w?: number;
  /** Navn, f.eks. «Hβ» eller «D₂». */
  name?: string;
  /** Øvre nivå n for hydrogenlinjene (overgang til eller fra n = 2). */
  n?: number;
}

export interface ElementInfo {
  id: ElementId;
  /** Navn med liten forbokstav (bokmål). */
  name: string;
  lines: LabLine[];
}

export const ELEMENTS: Record<ElementId, ElementInfo> = {
  H: {
    id: 'H',
    name: 'hydrogen',
    // Balmer-serien: overganger mellom n = 2 og n = 3, 4, 5, 6.
    lines: [
      { nm: 410.17, I: 0.3, a: 0.7, name: 'Hδ', n: 6 },
      { nm: 434.05, I: 0.4, a: 0.8, name: 'Hγ', n: 5 },
      { nm: 486.13, I: 0.6, a: 0.85, name: 'Hβ', n: 4 },
      { nm: 656.28, I: 1, a: 0.8, name: 'Hα', n: 3 },
    ],
  },
  He: {
    id: 'He',
    name: 'helium',
    lines: [
      { nm: 447.15, I: 0.5, a: 0.8 },
      { nm: 471.31, I: 0.2, a: 0.4 },
      { nm: 492.19, I: 0.25, a: 0.5 },
      { nm: 501.57, I: 0.55, a: 0.4 },
      { nm: 587.56, I: 1, a: 0.6 },
      { nm: 667.82, I: 0.5, a: 0.5 },
    ],
  },
  Na: {
    id: 'Na',
    name: 'natrium',
    lines: [
      { nm: 568.82, I: 0.2, a: 0.25 },
      { nm: 589.0, I: 1, a: 1, w: 1.4, name: 'D₂' },
      { nm: 589.59, I: 0.9, a: 0.9, w: 1.4, name: 'D₁' },
    ],
  },
  Ca: {
    id: 'Ca',
    name: 'kalsium',
    lines: [
      { nm: 393.37, I: 1, a: 1, w: 2.2, name: 'K' },
      { nm: 396.85, I: 0.9, a: 0.95, w: 2.2, name: 'H' },
      { nm: 422.67, I: 0.8, a: 0.7 },
      { nm: 612.22, I: 0.35, a: 0.35 },
      { nm: 616.22, I: 0.4, a: 0.35 },
      { nm: 643.91, I: 0.35, a: 0.3 },
    ],
  },
  Fe: {
    id: 'Fe',
    name: 'jern',
    lines: [
      { nm: 404.58, I: 0.7, a: 0.5 },
      { nm: 430.79, I: 0.8, a: 0.6 },
      { nm: 438.35, I: 1, a: 0.65 },
      { nm: 440.48, I: 0.7, a: 0.5 },
      { nm: 466.81, I: 0.3, a: 0.3 },
      { nm: 495.76, I: 0.4, a: 0.35 },
      { nm: 527.04, I: 0.6, a: 0.5 },
      { nm: 532.8, I: 0.6, a: 0.45 },
      { nm: 537.15, I: 0.5, a: 0.4 },
      { nm: 649.5, I: 0.25, a: 0.25 },
    ],
  },
};

/** Navnet med stor forbokstav: «Hydrogen». */
export function elementNameCap(id: ElementId): string {
  const n = ELEMENTS[id].name;
  return n.charAt(0).toLocaleUpperCase('nb') + n.slice(1);
}

/** Linjene til grunnstoffet innenfor figuren, sortert etter bølgelengde. */
export function labLines(id: ElementId): LabLine[] {
  return ELEMENTS[id].lines.filter((l) => l.nm >= RANGE[0] && l.nm <= RANGE[1]).sort((a, b) => a.nm - b.nm);
}

/* ---------- Stjernene ---------- */

export type StarId = 'bellatrix' | 'vega' | 'capella' | 'arcturus';
export const STAR_ORDER: readonly StarId[] = ['bellatrix', 'vega', 'capella', 'arcturus'];

export interface StarElement {
  /** Hvor sterke linjene er i denne stjernen (ganges med `a` for hver linje). */
  strength: number;
  /** Bredden på linjene (standardavvik i nm, før breddefaktoren `w`). */
  sigma: number;
}

export interface StarInfo {
  id: StarId;
  name: string;
  /** Stjernebildet med norsk navn. */
  constellation: string;
  /** Overflatetemperatur (K). */
  T: number;
  /** Avstand i lysår. */
  distanceLy: number;
  /** Fargen slik vi ser den. */
  colorWord: string;
  /** Grunnstoffene som gir linjer i atmosfæren (fasiten). */
  elements: Partial<Record<ElementId, StarElement>>;
}

export const STARS: Record<StarId, StarInfo> = {
  bellatrix: {
    id: 'bellatrix',
    name: 'Bellatrix',
    constellation: 'Orion',
    T: 22000,
    distanceLy: 250,
    colorWord: 'blåhvit',
    elements: { H: { strength: 0.75, sigma: 0.9 }, He: { strength: 0.85, sigma: 0.45 } },
  },
  vega: {
    id: 'vega',
    name: 'Vega',
    constellation: 'Lyren',
    T: 9600,
    distanceLy: 25,
    colorWord: 'hvit',
    elements: { H: { strength: 1, sigma: 1.7 }, Ca: { strength: 0.3, sigma: 0.35 } },
  },
  capella: {
    id: 'capella',
    name: 'Capella',
    constellation: 'Kusken',
    T: 5300,
    distanceLy: 43,
    colorWord: 'gul',
    elements: {
      H: { strength: 0.55, sigma: 0.5 },
      Na: { strength: 0.75, sigma: 0.4 },
      Ca: { strength: 0.9, sigma: 0.4 },
      Fe: { strength: 0.75, sigma: 0.3 },
    },
  },
  arcturus: {
    id: 'arcturus',
    name: 'Arcturus',
    constellation: 'Bjørnevokteren',
    T: 4300,
    distanceLy: 37,
    colorWord: 'oransje',
    elements: {
      H: { strength: 0.3, sigma: 0.35 },
      Na: { strength: 1, sigma: 0.45 },
      Ca: { strength: 1, sigma: 0.45 },
      Fe: { strength: 0.95, sigma: 0.32 },
    },
  },
};

/** Grunnstoffene som faktisk gir linjer i stjernen, i fast rekkefølge (fasiten). */
export function presentElements(star: StarId): ElementId[] {
  return ELEMENT_ORDER.filter((id) => STARS[star].elements[id] !== undefined);
}

/** Svakeste og sterkeste linje i stjernespekteret (andel av lyset som mangler midt i linja). */
export const DEPTH_MIN = 0.15;
export const DEPTH_MAX = 0.9;

export interface StarLine {
  nm: number;
  /** Andelen av lyset som mangler midt i linja (0–1). */
  depth: number;
  /** Bredden (standardavvik, nm). */
  sigma: number;
  /** Grunnstoffet som gir linja (fasiten, vises ikke før eleven har funnet det). */
  element: ElementId;
  lab: LabLine;
}

/** De mørke linjene i stjernen, sortert etter bølgelengde. */
export function starLines(star: StarId): StarLine[] {
  const s = STARS[star];
  const out: StarLine[] = [];
  for (const id of ELEMENT_ORDER) {
    const e = s.elements[id];
    if (!e) continue;
    for (const l of labLines(id)) {
      out.push({
        nm: l.nm,
        depth: Math.min(DEPTH_MAX, Math.max(DEPTH_MIN, l.a * e.strength)),
        sigma: e.sigma * (l.w ?? 1),
        element: id,
        lab: l,
      });
    }
  }
  return out.sort((a, b) => a.nm - b.nm);
}

/** Indeksen til linja som er valgt når stjernen byttes: Hβ (alle stjernene har hydrogen), ellers den sterkeste. */
export function defaultLineIndex(lines: StarLine[]): number {
  const hb = lines.findIndex((l) => l.element === 'H' && l.lab.n === 4);
  if (hb >= 0) return hb;
  let best = 0;
  lines.forEach((l, i) => {
    if (l.depth > (lines[best]?.depth ?? -1)) best = i;
  });
  return best;
}

/* ---------- Sammenligning: hvilke linjer forklarer grunnstoffene? ---------- */

export type Verdict = 'av' | 'passer' | 'delvis' | 'passer-ikke';

export interface LineStatus {
  line: StarLine;
  /** Det første påslåtte grunnstoffet som har en linje her, ellers null. */
  explainedBy: ElementId | null;
}

export interface ElementStatus {
  id: ElementId;
  on: boolean;
  /** Linjer fra laboratoriet som treffer en mørk linje i stjernen. */
  hits: number;
  /** Antall linjer i laboratoriet (innenfor figuren). */
  total: number;
  /** Laboratorielinjene som ikke finnes i stjernen. */
  missing: LabLine[];
  verdict: Verdict;
}

export interface Analysis {
  lines: LineStatus[];
  explained: number;
  total: number;
  elements: Record<ElementId, ElementStatus>;
  /** Påslåtte grunnstoffer der alle linjene treffer. */
  found: ElementId[];
  /** Påslåtte grunnstoffer uten treff. */
  wrong: ElementId[];
  /** Alle linjene er forklart, og ingen påslåtte grunnstoffer mangler i stjernen. */
  solved: boolean;
}

/** Om stjernen har en mørk linje innenfor MATCH_TOL av bølgelengden. */
export function hasLineAt(lines: { nm: number }[], nm: number, tol = MATCH_TOL): boolean {
  return lines.some((l) => Math.abs(l.nm - nm) <= tol);
}

export function analyse(star: StarId, on: readonly ElementId[]): Analysis {
  const lines = starLines(star);
  const active = ELEMENT_ORDER.filter((id) => on.includes(id));
  const status: LineStatus[] = lines.map((line) => ({
    line,
    explainedBy: active.find((id) => hasLineAt(labLines(id), line.nm)) ?? null,
  }));
  const elements = {} as Record<ElementId, ElementStatus>;
  for (const id of ELEMENT_ORDER) {
    const ll = labLines(id);
    const missing = ll.filter((l) => !hasLineAt(lines, l.nm));
    const hits = ll.length - missing.length;
    const isOn = active.includes(id);
    const verdict: Verdict = !isOn ? 'av' : hits === ll.length ? 'passer' : hits === 0 ? 'passer-ikke' : 'delvis';
    elements[id] = { id, on: isOn, hits, total: ll.length, missing, verdict };
  }
  const explained = status.filter((s) => s.explainedBy !== null).length;
  const found = active.filter((id) => elements[id].verdict === 'passer');
  const wrong = active.filter((id) => elements[id].verdict === 'passer-ikke');
  return {
    lines: status,
    explained,
    total: lines.length,
    elements,
    found,
    wrong,
    solved: explained === lines.length && wrong.length === 0 && found.length === active.length,
  };
}

/* ---------- Det kontinuerlige spekteret og linjene i grafen ---------- */

/** Plancks strålingslov uten konstantfaktor: λ⁻⁵ / (e^(hc/λkT) − 1), med λ i nm. */
export function planckShape(nm: number, T: number): number {
  const lambda = nm * 1e-9;
  const x = (H_PLANCK * C_LIGHT) / (lambda * K_BOLTZMANN * T);
  return 1 / (lambda ** 5 * Math.expm1(x));
}

/** Bølgelengden (nm) der et svart legeme med temperatur T lyser sterkest (Wiens forskyvningslov, λ_maks = b/T). */
export function peakWavelength(T: number): number {
  // hc/(4,965 kT) = 2,90 · 10⁻³ m K / T med konstantene over.
  return ((H_PLANCK * C_LIGHT) / (4.965114 * K_BOLTZMANN * T)) * 1e9;
}

/** Det kontinuerlige spekteret innenfor figuren, normert så det sterkeste punktet i figuren er 1. */
export function continuum(nm: number, T: number): number {
  const peak = Math.min(RANGE[1], Math.max(RANGE[0], peakWavelength(T)));
  return planckShape(nm, T) / planckShape(peak, T);
}

/** Profilen til én linje (1 midt i linja, faller av som en normalfordeling). */
export function lineProfile(nm: number, line: { nm: number; sigma: number }): number {
  const u = (nm - line.nm) / line.sigma;
  return Math.exp(-0.5 * u * u);
}

/** Lysstyrken fra stjernen (relativ): det kontinuerlige spekteret med de mørke linjene. */
export function intensity(star: StarId, nm: number, lines = starLines(star)): number {
  let k = 1;
  for (const l of lines) {
    if (Math.abs(nm - l.nm) > 6 * l.sigma) continue;
    k *= 1 - l.depth * lineProfile(nm, l);
  }
  return continuum(nm, STARS[star].T) * k;
}

/** Punktene i grafen over lysstyrken, med fast steg i nm (fint nok til at de smale linjene synes). */
export function spectrumCurve(star: StarId, step = 0.1): [number, number][] {
  const lines = starLines(star);
  const out: [number, number][] = [];
  const n = Math.round((RANGE[1] - RANGE[0]) / step);
  for (let i = 0; i <= n; i++) {
    const nm = RANGE[0] + i * step;
    out.push([nm, intensity(star, nm, lines)]);
  }
  return out;
}

/* ---------- Fotonet i en linje ---------- */

export interface Photon {
  /** Frekvens (Hz). */
  f: number;
  /** Energi (J). */
  E: number;
  /** Energi (eV). */
  eV: number;
}

/** Fotonet med bølgelengde λ (nm): f = c/λ og E = hf. */
export function photon(nm: number): Photon {
  const f = C_LIGHT / (nm * 1e-9);
  const E = H_PLANCK * f;
  return { f, E, eV: E / E_CHARGE };
}

/** Energinivå n i hydrogen etter Bohr (J). */
export function bohrLevel(n: number): number {
  return -BOHR_B / (n * n);
}

/** Overgangen mellom n = 2 og n i hydrogen: energien (J) og bølgelengden (nm) etter Bohrs modell. */
export function balmer(n: number): { E: number; nm: number } {
  const E = bohrLevel(n) - bohrLevel(2);
  return { E, nm: ((H_PLANCK * C_LIGHT) / E) * 1e9 };
}

/* ---------- Plassering av atomene i stjerneatmosfæren (scenen) ---------- */

/**
 * Vinklene (grader, positiv nedover) der atomene i atmosfæren tegnes, ett per grunnstoff i stjernen. Atomet som tar
 * opp den valgte linja, står på strålen (vinkel 0); de andre fordeles over og under, så de ikke overlapper.
 */
export function atomAngles(count: number, absorberIndex: number, spacing = 13): number[] {
  const out: number[] = [];
  const others: number[] = [];
  // Rekkefølgen for de andre plassene: −1, +1, −2, +2 … (over og under strålen)
  for (let k = 1; others.length < count; k++) others.push(-k, k);
  let j = 0;
  for (let i = 0; i < count; i++) {
    if (i === absorberIndex) out.push(0);
    else out.push((others[j++] ?? 0) * spacing);
  }
  return out;
}
