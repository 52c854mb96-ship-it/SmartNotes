/**
 * Ren fysikk for eksempeloppgaven «Sola som svart legeme» (k6-eks-sola, 6B og 6C).
 *
 * En satellitt eller romsonde måler spekteret til sollyset. Vi regner Sola som et svart legeme:
 *   a) Wiens forskyvningslov:   λ_maks · T = b  ⇒  T = b / λ_maks
 *   b) Stefan–Boltzmanns lov:   I = σT⁴ (utstrålt effekt per kvadratmeter av soloverflaten)
 *   c) Total effekt:            P = I · 4πR²
 *   d) Intensiteten i avstanden r: hele effekten går gjennom en kuleflate med radius r rundt Sola, så
 *                               S = P / (4πr²) = I · (R/r)²
 *   e) Strålingsbalansen for planeten (uten drivhuseffekt): planeten fanger sollys på tverrsnittet πR_p² og stråler
 *      ut varme fra hele overflaten 4πR_p²:
 *                               (1 − α) · S · πR_p² = σT_p⁴ · 4πR_p²  ⇒  T_p = ((1 − α) · S / (4σ))^(1/4)
 *
 * Sola er den samme i alle tallsettene, så a)–c) gir samme svar. Det er et poeng i seg selv: toppen i spekteret
 * og temperaturen avhenger ikke av hvor vi måler, bare intensiteten gjør det. Tallsettene er jorda, Mars og Venus,
 * og sammenligningen med den målte middeltemperaturen i e) viser en drivhuseffekt som er stor (jorda), nesten
 * borte (Mars) og enorm (Venus).
 *
 * Tallene i oppgaveteksten, utregningen og svaret kommer alle fra solveSunTask. Mellomsvarene vises med fire
 * gjeldende siffer og svarene med tre, så hver linje i utregningen går opp (testet).
 * Konstantene er de i ERGO Fysikk 1.
 */

/** Konstanten i Wiens forskyvningslov (m·K). */
export const WIEN_B = 2.9e-3;
/** Stefan–Boltzmanns konstant (W/(m²·K⁴)). */
export const SIGMA = 5.67e-8;
/** Plancks konstant (J s), lysfarten (m/s) og Boltzmanns konstant (J/K), til spekteret i grafen. */
export const H_PLANCK = 6.63e-34;
export const C_LIGHT = 3.0e8;
export const K_BOLTZMANN = 1.38e-23;
/** Fra celsius til kelvin som i læreboka: T = t + 273. */
export const KELVIN_OFFSET = 273;

/** Radien til Sola (m). */
export const R_SUN = 6.96e8;
/** Toppen i spekteret som grafen viser (nm). */
export const LAMBDA_PEAK_NM = 500;

export type PlanetId = 'jorda' | 'mars' | 'venus';

export interface SunTask {
  planet: PlanetId;
  /** Navnet i en setning: «jorda», «Mars», «Venus». */
  name: string;
  /** Med stor forbokstav, til starten av en setning. */
  Name: string;
  /** Satellitten eller romsonden som måler: «En forskningssatellitt i bane rundt jorda». */
  probe: string;
  /** Toppen i spekteret (nm). */
  lambdaNm: number;
  /** Radien til Sola (m). */
  R: number;
  /** Avstanden fra Sola til planeten (m). */
  r: number;
  /** Albedoen: andelen av sollyset som planeten reflekterer. */
  albedo: number;
  /** Den målte middeltemperaturen ved overflaten (°C). */
  measuredC: number;
  /** Den målte intensiteten til sollyset ved planeten (W/m²), til sammenligning i d). */
  measuredS: number;
}

/**
 * Tallsettene. Avstandene, albedoen (Bond-albedo) og de målte verdiene er avrundede verdier fra NASAs faktaark for
 * planetene: middeltemperatur 15 °C, −63 °C og 464 °C, og intensitet 1361, 586 og 2601 W/m².
 */
export const SUN_TASKS: readonly SunTask[] = [
  {
    planet: 'jorda',
    name: 'jorda',
    Name: 'Jorda',
    probe: 'En forskningssatellitt i bane rundt jorda',
    lambdaNm: LAMBDA_PEAK_NM,
    R: R_SUN,
    r: 1.5e11,
    albedo: 0.3,
    measuredC: 15,
    measuredS: 1361,
  },
  {
    planet: 'mars',
    name: 'Mars',
    Name: 'Mars',
    probe: 'En romsonde i bane rundt Mars',
    lambdaNm: LAMBDA_PEAK_NM,
    R: R_SUN,
    r: 2.28e11,
    albedo: 0.25,
    measuredC: -63,
    measuredS: 586,
  },
  {
    planet: 'venus',
    name: 'Venus',
    Name: 'Venus',
    probe: 'En romsonde i bane rundt Venus',
    lambdaNm: LAMBDA_PEAK_NM,
    R: R_SUN,
    r: 1.08e11,
    albedo: 0.77,
    measuredC: 464,
    measuredS: 2601,
  },
];

/** Hvor stor drivhuseffekten er: forskjellen mellom målt temperatur og likevektstemperaturen uten atmosfære. */
export type Greenhouse = 'nesten-ingen' | 'stor' | 'enorm';

export interface SunSolution {
  /** λ_maks i meter. */
  lambda: number;
  /** a) Overflatetemperaturen til Sola (K). */
  T: number;
  /** b) Utstrålt effekt per kvadratmeter av soloverflaten, I = σT⁴ (W/m²). */
  I: number;
  /** b) I med to gjeldende siffer, til «Vis at …». */
  IShown: number;
  /** c) Overflaten til Sola, 4πR² (m²). */
  Asun: number;
  /** c) Effekten Sola stråler ut (W). */
  P: number;
  /** d) Arealet av kuleflaten med radius r (m²). */
  Asphere: number;
  /** d) Intensiteten til sollyset ved planeten (W/m²). */
  S: number;
  /** d) (R/r)²: hvor mye svakere sollyset er ved planeten enn ved soloverflaten. */
  dilution: number;
  /** d) Avviket fra den målte intensiteten, (S − S_målt) / S_målt. */
  SError: number;
  /** e) Sollyset planeten tar opp, i snitt over hele overflaten: (1 − α) · S / 4 (W/m²). */
  absorbedAvg: number;
  /** e) Likevektstemperaturen uten drivhuseffekt (K). */
  Teq: number;
  /** e) Den målte middeltemperaturen (K). */
  measuredT: number;
  /** e) Målt minus beregnet temperatur (K): drivhuseffekten. */
  greenhouseK: number;
  greenhouse: Greenhouse;
  /** e) Toppen i varmestrålingen fra planeten, b / T_p (m). */
  lambdaPlanet: number;
}

export function solveSunTask(task: SunTask): SunSolution {
  const lambda = task.lambdaNm * 1e-9;
  const T = WIEN_B / lambda;
  const I = SIGMA * T ** 4;
  const Asun = 4 * Math.PI * task.R ** 2;
  const P = I * Asun;
  const Asphere = 4 * Math.PI * task.r ** 2;
  const S = P / Asphere;
  const dilution = (task.R / task.r) ** 2;
  const absorbedAvg = ((1 - task.albedo) * S) / 4;
  const Teq = (absorbedAvg / SIGMA) ** 0.25;
  const measuredT = task.measuredC + KELVIN_OFFSET;
  const greenhouseK = measuredT - Teq;
  return {
    lambda,
    T,
    I,
    IShown: roundSig(I, 2),
    Asun,
    P,
    Asphere,
    S,
    dilution,
    SError: (S - task.measuredS) / task.measuredS,
    absorbedAvg,
    Teq,
    measuredT,
    greenhouseK,
    greenhouse: greenhouseKind(greenhouseK),
    lambdaPlanet: WIEN_B / Teq,
  };
}

/** Under 10 K regnes som nesten ingen drivhuseffekt, over 200 K som enorm. */
export function greenhouseKind(dT: number): Greenhouse {
  if (dT < 10) return 'nesten-ingen';
  if (dT > 200) return 'enorm';
  return 'stor';
}

/* ---------- Spekteret i grafen ---------- */

/**
 * Strålingen fra et svart legeme per bølgelengde ved overflaten, π · B_λ (Plancks strålingslov), i W/m² per meter
 * bølgelengde. Integralet over alle bølgelengder er σT⁴ (med konstantene over 0,5 % mindre, se testene).
 */
export function planckExitance(lambda: number, T: number): number {
  if (!(lambda > 0) || !(T > 0)) return 0;
  const x = (H_PLANCK * C_LIGHT) / (lambda * K_BOLTZMANN * T);
  if (x > 700) return 0;
  return (2 * Math.PI * H_PLANCK * C_LIGHT ** 2) / (lambda ** 5 * Math.expm1(x));
}

/**
 * Spekteret til sollyset i avstanden r fra Sola, i W/(m²·nm): utstrålingen ved overflaten fordelt på kuleflaten,
 * altså ganget med (R/r)². Arealet under hele kurven er intensiteten S.
 */
export function spectrumAt(lambdaNm: number, T: number, R: number, r: number): number {
  return planckExitance(lambdaNm * 1e-9, T) * 1e-9 * (R / r) ** 2;
}

/** Punktene på spekterkurven fra `fromNm` til `toNm` (nm), [λ i nm, W/(m²·nm)]. */
export function spectrumCurve(T: number, R: number, r: number, fromNm: number, toNm: number, n = 240): [number, number][] {
  const pts: [number, number][] = [];
  for (let i = 0; i <= n; i++) {
    const nm = fromNm + ((toNm - fromNm) * i) / n;
    pts.push([nm, spectrumAt(nm, T, R, r)]);
  }
  return pts;
}

/** Arealet under spekterkurven fra `fromNm` til `toNm` (W/m²), med Simpsons metode. */
export function spectrumArea(T: number, R: number, r: number, fromNm: number, toNm: number, n = 2000): number {
  const m = n % 2 === 0 ? n : n + 1;
  const h = (toNm - fromNm) / m;
  let sum = spectrumAt(fromNm, T, R, r) + spectrumAt(toNm, T, R, r);
  for (let i = 1; i < m; i++) sum += (i % 2 === 0 ? 2 : 4) * spectrumAt(fromNm + i * h, T, R, r);
  return (sum * h) / 3;
}

/** Den høyeste verdien på y-aksen i grafen: litt over toppen, rundet opp til 1, 2, 2,5 eller 5 ganger en tierpotens. */
export function spectrumYMax(peak: number): number {
  if (!(peak > 0)) return 1;
  const v = peak * 1.12;
  const e = Math.floor(Math.log10(v));
  const base = 10 ** e;
  const m = v / base;
  const nice = m <= 1 ? 1 : m <= 2 ? 2 : m <= 2.5 ? 2.5 : m <= 5 ? 5 : 10;
  return nice * base;
}

/* ---------- Tall på standardform ---------- */

/** Rund av til `sig` gjeldende siffer. */
export function roundSig(v: number, sig: number): number {
  if (!Number.isFinite(v) || v === 0) return v;
  const e = Math.floor(Math.log10(Math.abs(v)));
  const f = 10 ** (sig - 1 - e);
  return Math.round(v * f) / f;
}

/** Mantisse og eksponent etter avrunding til `sig` gjeldende siffer: 6,4164 · 10⁷ med 3 → { m: 6.42, e: 7 }. */
export function sciParts(v: number, sig: number): { m: number; e: number } {
  const r = roundSig(v, sig);
  if (!Number.isFinite(r) || r === 0) return { m: r, e: 0 };
  const e = Math.floor(Math.log10(Math.abs(r)));
  return { m: roundSig(r / 10 ** e, sig), e };
}

/** Desimalkomma, ekte minus og hevet eksponent: «6,42 · 10⁷», «−1,5 · 10⁻³». */
export function fmtStd(v: number, sig: number): string {
  if (!Number.isFinite(v)) return '–';
  if (v === 0) return '0';
  const { m, e } = sciParts(v, sig);
  const mant = m.toFixed(Math.max(0, sig - 1)).replace('.', ',').replace('-', '−');
  return `${mant} · 10${superscriptInt(e)}`;
}

/** Tall med `sig` gjeldende siffer uten standardform (for tall mellom 1 og 10 000): 255,53 → «256», 241,75 → «241,8». */
export function fmtSigPlain(v: number, sig: number): string {
  if (!Number.isFinite(v)) return '–';
  if (v === 0) return '0';
  const r = roundSig(v, sig);
  const e = Math.floor(Math.log10(Math.abs(r)));
  const decimals = Math.max(0, sig - 1 - e);
  return r.toFixed(decimals).replace('.', ',').replace('-', '−');
}

const SUP: Record<string, string> = { '-': '⁻', '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹' };

function superscriptInt(n: number): string {
  return String(n)
    .split('')
    .map((c) => SUP[c] ?? c)
    .join('');
}

/** Temperatur i celsius fra kelvin (T − 273), avrundet til hele grader. */
export const toCelsius = (T: number): number => Math.round(T - KELVIN_OFFSET);
