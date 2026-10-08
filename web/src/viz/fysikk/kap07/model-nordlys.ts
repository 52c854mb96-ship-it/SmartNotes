/**
 * Ren fysikk for visualiseringen «Nordlys» (kapittel 7, 7B og 7C): fotonenergien til de tre klareste
 * nordlysfargene, energinivåene de kommer fra, og en enkel modell av hvilken høyde hver farge lyser i.
 *
 * Høydemodellen er forenklet, men bygger på ekte størrelser:
 *  - Elektronene fra solvinden har ulik energi (en maxwellfordeling rundt en typisk energi). Hvert elektron gir fra
 *    seg energien sin i mange støt og stopper i en høyde som avhenger av energien: raske elektroner kommer lenger ned.
 *  - Lufta består mest av N₂ langt nede og mest av O-atomer høyt oppe.
 *  - Et eksitert atom eller ion venter en stund før det sender ut fotonet (levetiden). Støter det i andre partikler
 *    før det, mister det energien uten å lyse. Lufta er tettere lenger ned, så nivåer med lang levetid (rødt, ca.
 *    110 s) lyser bare høyt oppe, mens nitrogenionet (under ett mikrosekund) lyser like godt helt nede.
 */

/* ---------- Konstanter med verdiene i ERGO Fysikk 1 ---------- */

/** Plancks konstant (J s). */
export const H_PLANCK = 6.63e-34;
/** Lysfarten (m/s). */
export const C_LIGHT = 3.0e8;
/** Elementærladningen (C): 1 eV = 1,60 · 10⁻¹⁹ J. */
export const E_CHARGE = 1.6e-19;

/* ---------- Fotonene ---------- */

export interface Photon {
  /** Bølgelengde (m). */
  lambda: number;
  /** Frekvens (Hz). */
  f: number;
  /** Energi (J). */
  E: number;
  /** Energi (eV). */
  eV: number;
}

/** Fotonet med bølgelengde `nm`: f = c/λ og E = hf. Ugyldige bølgelengder gir NaN. */
export function photonFromNm(nm: number): Photon {
  if (!(nm > 0) || !Number.isFinite(nm)) return { lambda: NaN, f: NaN, E: NaN, eV: NaN };
  const lambda = nm * 1e-9;
  const f = C_LIGHT / lambda;
  const E = H_PLANCK * f;
  return { lambda, f, E, eV: E / E_CHARGE };
}

/** Bølgelengden (nm) til et foton med energi `eV`: λ = hc/E. */
export function nmFromEV(eV: number): number {
  if (!(eV > 0)) return NaN;
  return ((H_PLANCK * C_LIGHT) / (eV * E_CHARGE)) * 1e9;
}

/* ---------- De tre nordlysfargene ---------- */

export type LineId = 'gronn' | 'rod' | 'blaa';
export type Emitter = 'O' | 'N2+';

export interface AuroraLine {
  id: LineId;
  /** Bølgelengde (nm). */
  nm: number;
  /** Hva som sender ut lyset: oksygenatomet O eller nitrogenionet N₂⁺. */
  emitter: Emitter;
  /** Fargen med små bokstaver: «grønt», «rødt», «blåfiolett». */
  color: string;
  /** Bestemt form: «det grønne lyset», «det røde lyset», «det blåfiolette lyset». */
  colorDef: string;
  /**
   * Hvor lenge det eksiterte nivået lever i gjennomsnitt før fotonet sendes ut (s). O: ca. 0,7 s (grønt) og
   * ca. 110 s (rødt). N₂⁺: ca. 70 ns.
   */
  lifetime: number;
  /** Det eleven typisk leser: høyden fargen kommer fra i et vanlig nordlys (km). */
  typical: [number, number];
}

export const LINES: Record<LineId, AuroraLine> = {
  gronn: { id: 'gronn', nm: 557.7, emitter: 'O', color: 'grønt', colorDef: 'grønne', lifetime: 0.74, typical: [100, 200] },
  rod: { id: 'rod', nm: 630.0, emitter: 'O', color: 'rødt', colorDef: 'røde', lifetime: 110, typical: [200, 400] },
  blaa: { id: 'blaa', nm: 427.8, emitter: 'N2+', color: 'blåfiolett', colorDef: 'blåfiolette', lifetime: 7e-8, typical: [80, 120] },
};

/** Rekkefølgen i knapperaden og i forklaringene. */
export const LINE_ORDER: readonly LineId[] = ['gronn', 'rod', 'blaa'];

/**
 * Energinivåene i oksygenatomet (eV over grunntilstanden) som de to oksygenlinjene går mellom, regnet ut fra
 * fotonene: det røde fotonet går fra nivå 1 ned til grunntilstanden, det grønne fra nivå 2 ned til nivå 1.
 * Så E₁ = E(rødt foton) og E₂ = E₁ + E(grønt foton).
 */
export function oxygenLevels(): { ground: number; first: number; second: number } {
  const first = photonFromNm(LINES.rod.nm).eV;
  const second = first + photonFromNm(LINES.gronn.nm).eV;
  return { ground: 0, first, second };
}

/** Øvre og nedre nivå (eV) for overgangen som gir linja. N₂⁺ regnes fra sitt eget nedre nivå (0 eV). */
export function transitionLevels(id: LineId): { upper: number; lower: number } {
  const o = oxygenLevels();
  if (id === 'gronn') return { upper: o.second, lower: o.first };
  if (id === 'rod') return { upper: o.first, lower: o.ground };
  return { upper: photonFromNm(LINES.blaa.nm).eV, lower: 0 };
}

/**
 * Energien et elektron fra solvinden må gi fra seg i støtet for å lage det eksiterte nivået (eV): fra grunntilstanden
 * til O, og for N₂⁺ fra et vanlig N₂-molekyl (ioniseringen, 15,6 eV, pluss eksitasjonen av ionet, 3,2 eV).
 */
export function excitationEnergy(id: LineId): number {
  if (id === 'blaa') return N2_IONIZATION_EV + N2PLUS_B_EV;
  return transitionLevels(id).upper;
}

/** Ioniseringsenergien til N₂ (eV). */
export const N2_IONIZATION_EV = 15.58;
/** Det eksiterte nivået i N₂⁺ som gir 427,8 nm, over grunntilstanden til ionet (eV). */
export const N2PLUS_B_EV = 3.17;

/* ---------- Elektronene fra solvinden ---------- */

/** Valgene for den typiske energien til elektronene (keV). Vanlig nordlys: 1–10 keV. */
export const ENERGY_STEPS: readonly number[] = [0.3, 0.5, 1, 2, 3, 5, 7, 10];
export const DEFAULT_ENERGY_INDEX = 5; // 5 keV

/** Laveste og høyeste høyde i modellen og figuren (km). */
export const H_MIN = 70;
export const H_MAX = 450;

/**
 * Høyden der et elektron med energi `keV` gir fra seg mest energi (km), omtrentlige verdier for en vanlig
 * atmosfære (rekkevidden til elektroner i luft). Mellom tabellpunktene interpoleres det lineært i log(E).
 */
const PEAK_TABLE: readonly [number, number][] = [
  [0.05, 260],
  [0.1, 230],
  [0.3, 185],
  [0.5, 165],
  [1, 145],
  [2, 128],
  [5, 113],
  [10, 105],
  [20, 97],
  [50, 88],
  [100, 82],
  [300, 74],
];

export function peakAltitude(keV: number): number {
  if (!(keV > 0)) return NaN;
  const t = PEAK_TABLE;
  const lx = Math.log10(keV);
  const first = t[0]!;
  const last = t[t.length - 1]!;
  if (keV <= first[0]) return first[1];
  if (keV >= last[0]) return last[1];
  for (let i = 1; i < t.length; i++) {
    const [e1, h1] = t[i]!;
    if (keV <= e1) {
      const [e0, h0] = t[i - 1]!;
      const u = (lx - Math.log10(e0)) / (Math.log10(e1) - Math.log10(e0));
      return h0 + (h1 - h0) * u;
    }
  }
  return last[1];
}

/* ---------- Lufta ---------- */

/** Tettheten av partikler i lufta (log₁₀ av antall per cm³), omtrentlige verdier fra standardatmosfæren. */
const DENSITY_TABLE: readonly [number, number][] = [
  [60, 15.81],
  [70, 15.28],
  [80, 14.62],
  [90, 13.85],
  [100, 13.07],
  [110, 12.33],
  [120, 11.7],
  [140, 10.97],
  [160, 10.55],
  [180, 10.23],
  [200, 9.96],
  [250, 9.4],
  [300, 8.92],
  [350, 8.5],
  [400, 8.1],
  [450, 7.72],
  [500, 7.35],
];

/** Antall partikler per cm³ i høyden `h` (km). Avtar hele veien oppover. */
export function airDensity(h: number): number {
  const t = DENSITY_TABLE;
  const first = t[0]!;
  const last = t[t.length - 1]!;
  if (!Number.isFinite(h)) return NaN;
  if (h <= first[0]) {
    const next = t[1]!;
    const slope = (next[1] - first[1]) / (next[0] - first[0]);
    return 10 ** (first[1] + slope * (h - first[0]));
  }
  if (h >= last[0]) {
    const prev = t[t.length - 2]!;
    const slope = (last[1] - prev[1]) / (last[0] - prev[0]);
    return 10 ** (last[1] + slope * (h - last[0]));
  }
  for (let i = 1; i < t.length; i++) {
    const [h1, l1] = t[i]!;
    if (h <= h1) {
      const [h0, l0] = t[i - 1]!;
      return 10 ** (l0 + ((l1 - l0) * (h - h0)) / (h1 - h0));
    }
  }
  return 10 ** last[1];
}

/** Skalahøyden (km): hvor mye høyere du må opp for at tettheten skal avta til 1/e. Vokser oppover. */
export function scaleHeight(h: number): number {
  const d = 2;
  return (2 * d) / Math.log(airDensity(h - d) / airDensity(h + d));
}

/** Andelen O-atomer i lufta i høyden `h` (km): lite nede (der N₂ og O₂ dominerer), mest høyt oppe. */
export function oxygenFraction(h: number): number {
  return 1 / (1 + Math.exp(-(h - 185) / 45));
}

/* ---------- Energien elektronene gir fra seg ---------- */

/**
 * Energien elektroner med én bestemt energi gir fra seg per km i høyden `h` (Chapman-form: bratt nede der de stopper,
 * jevnt avtakende oppover). Arealet under kurva er 1, så summen over alle høyder er hele energien.
 */
export function depositionMono(h: number, keV: number): number {
  const hp = peakAltitude(keV);
  if (!Number.isFinite(hp) || !Number.isFinite(h)) return 0;
  const W = 1.25 * scaleHeight(hp);
  const z = (h - hp) / W;
  if (z < -4) return 0;
  return Math.exp(1 - z - Math.exp(-z)) / (Math.E * W);
}

/** Energiene (keV) fordelingen deles opp i: 0,05–300 keV, jevnt fordelt i log(E). */
const SPECTRUM_E: readonly number[] = Array.from({ length: 33 }, (_, i) => 0.05 * 10 ** ((i * Math.log10(300 / 0.05)) / 32));

/**
 * Andelen av energien som kommer med hver energi i SPECTRUM_E når elektronene har typisk energi `keV`
 * (maxwellfordeling: energistrømmen ∝ E² e^(−E/E₀) per energiintervall). Summen er 1.
 */
export function spectrumWeights(keV: number): number[] {
  if (!(keV > 0)) return SPECTRUM_E.map(() => 0);
  // Med log-avstand er dE ∝ E, så vekten blir E³ e^(−E/E₀).
  const w = SPECTRUM_E.map((E) => (E / keV) ** 3 * Math.exp(-E / keV));
  const sum = w.reduce((a, b) => a + b, 0);
  return w.map((v) => v / sum);
}

/** Andel av energien som kommer med langsomme elektroner (ca. 0,1 keV) i tillegg, som gir den svake røde toppen. */
export const SOFT_SHARE = 0.015;
const SOFT_KEV = 0.12;

/** Energien elektronene gir fra seg per km i høyden `h` (summen over hele høyden er 1). */
export function deposition(h: number, keV: number): number {
  const w = spectrumWeights(keV);
  let d = 0;
  for (let i = 0; i < SPECTRUM_E.length; i++) {
    const wi = w[i]!;
    if (wi > 1e-6) d += wi * depositionMono(h, SPECTRUM_E[i]!);
  }
  return (1 - SOFT_SHARE) * d + SOFT_SHARE * depositionMono(h, SOFT_KEV);
}

/* ---------- Støt som tar energien før fotonet sendes ut ---------- */

/**
 * Hvor effektivt støt med N₂-molekyler og med O-atomer tar energien fra det eksiterte nivået (cm³/s, effektive
 * verdier): antall slike støt per sekund er k_N₂ · n_N₂ + k_O · n_O. Det røde nivået mister energien mest i støt
 * med N₂, som det er mest av langt nede.
 */
const QUENCH_RATE: Record<LineId, { N2: number; O: number }> = {
  gronn: { N2: 4.7e-14, O: 4.7e-14 },
  rod: { N2: 5.3e-12, O: 5.3e-13 },
  blaa: { N2: 1e-10, O: 1e-10 },
};

/** Støt per sekund som tar energien fra det eksiterte nivået i høyden `h`. */
export function quenchRate(id: LineId, h: number): number {
  const fO = oxygenFraction(h);
  const k = QUENCH_RATE[id];
  return airDensity(h) * (k.N2 * (1 - fO) + k.O * fO);
}

/**
 * Andelen av de eksiterte atomene (ionene) som rekker å sende ut fotonet før et støt tar energien:
 * 1 / (1 + τ · k · n). Nær 1 høyt oppe, nær 0 der lufta er tett og levetiden τ lang.
 */
export function survival(id: LineId, h: number): number {
  return 1 / (1 + LINES[id].lifetime * quenchRate(id, h));
}

/** Høyden (km) der halvparten av de eksiterte nivåene rekker å lyse (survival = 0,5). */
export function quenchAltitude(id: LineId): number {
  let lo = 20;
  let hi = 600;
  if (survival(id, lo) >= 0.5) return lo;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    if (survival(id, mid) < 0.5) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

/* ---------- Lyset fra hver høyde ---------- */

/** Hvor mange fotoner hver linje gir per energi elektronene gir fra seg (relativt, når ingen støt tar energien). */
const YIELD: Record<LineId, number> = { gronn: 2.4, rod: 12, blaa: 0.1 };

/** Hva som sender ut lyset i høyden `h`: andelen O for oksygenlinjene, N₂ for nitrogenionet. */
function emitterFraction(id: LineId, h: number): number {
  const fO = oxygenFraction(h);
  if (id === 'gronn') return fO * (GREEN_BASE + (1 - GREEN_BASE) * (1 - fO));
  return LINES[id].emitter === 'O' ? fO : 1 - fO;
}

/**
 * Mye av energien til det grønne nivået kommer via N₂-molekyler som først blir eksitert og så gir energien videre
 * til O-atomer i støt. Høyt oppe, der det er lite N₂, blir det derfor relativt mindre grønt per energi.
 */
const GREEN_BASE = 0.3;

/** Lyset (fotoner, relativt) fra linja `id` per km i høyden `h` når elektronene har typisk energi `keV`. */
export function emission(id: LineId, h: number, keV: number): number {
  return YIELD[id] * deposition(h, keV) * emitterFraction(id, h) * survival(id, h);
}

export interface AuroraProfile {
  /** Høydene (km), fra H_MIN til H_MAX. */
  h: number[];
  /** Lyset fra hver linje i hver høyde. */
  I: Record<LineId, number[]>;
  /** Det sterkeste lyset fra én linje i én høyde (til normering i figuren). */
  max: number;
}

const profileCache = new Map<string, AuroraProfile>();

/** Lyset fra alle tre linjene i høydene H_MIN, H_MIN + step, …, H_MAX (huskes, så samme valg regnes ut én gang). */
export function auroraProfile(keV: number, step = 2): AuroraProfile {
  const key = `${keV}|${step}`;
  const hit = profileCache.get(key);
  if (hit) return hit;
  const p = computeProfile(keV, step);
  if (profileCache.size > 64) profileCache.clear();
  profileCache.set(key, p);
  return p;
}

function computeProfile(keV: number, step: number): AuroraProfile {
  const n = Math.round((H_MAX - H_MIN) / step);
  const h = Array.from({ length: n + 1 }, (_, i) => H_MIN + i * step);
  const I = {} as Record<LineId, number[]>;
  let max = 0;
  for (const id of LINE_ORDER) {
    I[id] = h.map((hi) => emission(id, hi, keV));
    for (const v of I[id]) if (v > max) max = v;
  }
  return { h, I, max };
}

/** Høyden (km) der linja lyser sterkest. */
export function peakEmissionAltitude(id: LineId, keV: number): number {
  const p = auroraProfile(keV, 1);
  const arr = p.I[id];
  let best = 0;
  for (let i = 1; i < arr.length; i++) if (arr[i]! > arr[best]!) best = i;
  return p.h[best]!;
}

/**
 * Høyden (km) som en andel `q` av lyset fra linja kommer nedenfor (q = 0,5 gir medianen: halvparten av fotonene
 * kommer fra lavere høyder og halvparten fra høyere).
 */
export function emissionQuantile(id: LineId, keV: number, q: number): number {
  const p = auroraProfile(keV, 1);
  const arr = p.I[id];
  const total = arr.reduce((a, b) => a + b, 0);
  if (!(total > 0)) return NaN;
  const target = Math.min(1, Math.max(0, q)) * total;
  let acc = 0;
  for (let i = 0; i < arr.length; i++) {
    const v = arr[i]!;
    if (acc + v >= target) {
      const u = v > 0 ? (target - acc) / v : 0;
      return p.h[i]! - 0.5 + u;
    }
    acc += v;
  }
  return p.h[p.h.length - 1]!;
}

/**
 * Høydeområdet (km) der den midterste andelen `central` av lyset fra linja kommer fra (standard 50 %: fra
 * 25 %- til 75 %-punktet). Avrundet til nærmeste 5 km, så tallene ikke later som de er mer nøyaktige enn modellen.
 */
export function emissionRange(id: LineId, keV: number, central = 0.5): [number, number] {
  const a = (1 - central) / 2;
  return [round5(emissionQuantile(id, keV, a)), round5(emissionQuantile(id, keV, 1 - a))];
}

/** Den typiske høyden (km) for linja: medianen, avrundet til nærmeste 5 km. */
export function typicalAltitude(id: LineId, keV: number): number {
  return round5(emissionQuantile(id, keV, 0.5));
}

const round5 = (v: number) => (Number.isFinite(v) ? Math.round(v / 5) * 5 : NaN);

/** Hvor stor andel av fotonene i nordlyset hver linje står for (summen er 1). */
export function lineShares(keV: number): Record<LineId, number> {
  const p = auroraProfile(keV, 1);
  const tot = {} as Record<LineId, number>;
  let sum = 0;
  for (const id of LINE_ORDER) {
    tot[id] = p.I[id].reduce((a, b) => a + b, 0);
    sum += tot[id];
  }
  const out = {} as Record<LineId, number>;
  for (const id of LINE_ORDER) out[id] = sum > 0 ? tot[id] / sum : 0;
  return out;
}

/** Linja med flest fotoner, altså fargen nordlyset får mest av. */
export function dominantLine(keV: number): LineId {
  const s = lineShares(keV);
  return LINE_ORDER.reduce((best, id) => (s[id] > s[best] ? id : best), LINE_ORDER[0]!);
}

/** Høyden (km) der nordlyset slutter nederst: der det samlede lyset har falt til 10 % av det sterkeste. */
export function lowerEdge(keV: number): number {
  const p = auroraProfile(keV, 1);
  const tot = p.h.map((_, i) => LINE_ORDER.reduce((a, id) => a + p.I[id][i]!, 0));
  const top = Math.max(...tot);
  const i = tot.findIndex((v) => v >= 0.1 * top);
  return i < 0 ? NaN : p.h[i]!;
}

/* ---------- Grafen «Lys fra hver høyde» ---------- */

/** Forstørrelsene en svak kurve kan få i grafen (alltid med etikett, f.eks. «rødt × 10»). */
export const GRAPH_GAINS: readonly number[] = [2, 5, 10, 20];

/**
 * Hvor mye hver kurve forstørres i grafen. Alle kurvene tegnes på samme skala (delt på profile.max), så en svak farge
 * også ser svak ut. En kurve med topp under 30 % av den sterkeste forstørres med den største faktoren i GRAPH_GAINS
 * som holder toppen under 95 % av bredden, ellers 1.
 */
export function graphGains(profile: AuroraProfile): Record<LineId, number> {
  const out = {} as Record<LineId, number>;
  for (const id of LINE_ORDER) {
    const peak = profile.max > 0 ? Math.max(...profile.I[id]) / profile.max : 0;
    let gain = 1;
    if (peak > 0 && peak < 0.3) for (const g of GRAPH_GAINS) if (peak * g <= 0.95) gain = g;
    out[id] = gain;
  }
  return out;
}

/** Antall gjeldende siffer i `v` (avrundet): roundSig(1190,5, 2) = 1200, roundSig(18,75, 3) = 18,8. */
export function roundSig(v: number, sig: number): number {
  if (!Number.isFinite(v) || v === 0) return v;
  const p = sig - 1 - Math.floor(Math.log10(Math.abs(v)));
  const m = 10 ** Math.abs(p);
  return p >= 0 ? Math.round(v * m) / m : Math.round(v / m) * m;
}

/**
 * Energien (eV) som vises for støtet som lager linja, med tre gjeldende siffer (4,20 eV, 1,97 eV, 18,8 eV), og
 * hvor mange slike støt ett elektron med energi `keV` i beste fall rekker, regnet med den viste energien og avrundet
 * til to gjeldende siffer (5 000 eV / 4,20 eV ≈ 1 200).
 */
export function collisionCount(id: LineId, keV: number): { eV: number; count: number } {
  const eV = roundSig(excitationEnergy(id), 3);
  return { eV, count: roundSig((keV * 1000) / eV, 2) };
}

/* ---------- Fargen vi ser ---------- */

export type Rgb = [number, number, number];

/**
 * Additiv blanding av lys: summen av fargene vektet med lysstyrken, skalert så den sterkeste kanalen blir 255.
 * Gir fargetonen; hvor sterkt det lyser, styres for seg (gjennomsiktighet i figuren).
 */
export function mixLight(parts: readonly { rgb: Rgb; w: number }[]): Rgb {
  let r = 0;
  let g = 0;
  let b = 0;
  for (const p of parts) {
    const w = Math.max(0, Number.isFinite(p.w) ? p.w : 0);
    r += w * p.rgb[0];
    g += w * p.rgb[1];
    b += w * p.rgb[2];
  }
  const m = Math.max(r, g, b);
  if (!(m > 0)) return [0, 0, 0];
  return [Math.round((255 * r) / m), Math.round((255 * g) / m), Math.round((255 * b) / m)];
}

/** Lysere utgave av en rgb-farge: t = 0 gir fargen, t = 1 hvitt. */
export function lightenRgb(c: Rgb, t: number): Rgb {
  const u = Math.min(1, Math.max(0, Number.isFinite(t) ? t : 0));
  return [Math.round(c[0] + (255 - c[0]) * u), Math.round(c[1] + (255 - c[1]) * u), Math.round(c[2] + (255 - c[2]) * u)];
}

/** [12, 34, 56] → «rgb(12 34 56)». */
export function rgbText(c: Rgb): string {
  return `rgb(${c[0]} ${c[1]} ${c[2]})`;
}

/** «rgb(12 34 56)» eller «rgb(12, 34, 56)» → [12, 34, 56]. Ugyldig tekst gir svart. */
export function parseRgb(s: string): Rgb {
  const m = /rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)/.exec(s);
  if (!m) return [0, 0, 0];
  return [Number(m[1]), Number(m[2]), Number(m[3])];
}

/** Antall gjeldende siffer → desimaler for visning (2,23 eV, 1,97 eV). */
export function decimalsFor(v: number, sig = 3): number {
  if (!(Math.abs(v) > 0) || !Number.isFinite(v)) return 0;
  return Math.max(0, sig - 1 - Math.floor(Math.log10(Math.abs(v))));
}
