/**
 * Rutherfords spredningsforsøk: α-partikler mot en tynn gullfolie (ren fysikk uten React).
 *
 * To modeller for gullatomet:
 * - Thomsons modell (rosinbollen): den positive ladningen er spredt jevnt i en kule like stor som atomet, med
 *   elektronene som rosiner. Hvert atom bøyer α-partikkelen bare litt, og mange små, tilfeldige avbøyninger legger
 *   seg sammen som en normalfordeling (som et tilfeldig gange).
 * - Rutherfords modell: all den positive ladningen og nesten all massen sitter i en bitteliten kjerne. Langt fra
 *   kjernen blir det de samme små avbøyningene, men en α-partikkel som kommer svært nær én kjerne, bøyes kraftig av
 *   (hyperbelbane, tan(θ/2) = d / 2b).
 *
 * «Det som ble målt» simuleres med Rutherfords modell (den stemmer med målingene), med en tallgenerator med fast frø,
 * så tellerne, testene og skjermbildene blir like hver gang.
 *
 * Konstanter som i ERGO Fysikk 1: e = 1,60 · 10⁻¹⁹ C, u = 1,66 · 10⁻²⁷ kg, 1 MeV = 1,60 · 10⁻¹³ J. Lengder i meter
 * (femtometer, 1 fm = 10⁻¹⁵ m, bare i visningen) og vinkler i radianer, hvis ikke navnet sier noe annet.
 */
import { seededRandom } from './random';

export const E_CHARGE = 1.6e-19;
export const U_KG = 1.66e-27;
/** Coulombs konstant k (N m²/C²). Brukes bare internt i modellen (kraften mellom α og kjernen). */
export const K_COULOMB = 8.99e9;
export const MEV_J = 1.6e-13;
export const FM = 1e-15;
export const ELECTRON_MASS = 9.11e-31;

/** α-partikkelen: heliumkjerne med to protoner og to nøytroner. */
export const ALPHA = { Z: 2, N: 2, massU: 4.0, mass: 4.0 * U_KG, charge: 2 * E_CHARGE } as const;

/** Bevegelsesenergien til α-partiklene (MeV): som fra americium-241, stoffet i ioniserende røykvarslere. */
export const ALPHA_ENERGY_MEV = 5.5;

/** Gull-197: Z = 79, atomradius 144 pm, tetthet 19,3 g/cm³, kjerneradius 1,2 fm · A^(1/3). */
export const GOLD = {
  Z: 79,
  N: 118,
  A: 197,
  atomRadius: 1.44e-10,
  density: 19.3e3,
  nucleusRadius: 1.2 * FM * Math.cbrt(197),
} as const;

/** Tykkelsen på gullfolien (m). */
export const FOIL_THICKNESS = 0.6e-6;

/** Bohr-radien (m), til skjermingsradien i Thomas–Fermi-modellen. */
const BOHR_RADIUS = 5.29e-11;

/** Vinkelgrensen mellom «små» og «store» enkeltavbøyninger i simuleringen (2°). */
export const HARD_LIMIT = (2 * Math.PI) / 180;

/** Avbøyningsvinkler i telleren (grader): under 5°, 5°–30°, 30°–90° og over 90°. */
export const BIN_EDGES_DEG = [0, 5, 30, 90, 180] as const;
export const BIN_COUNT = BIN_EDGES_DEG.length - 1;

/** Største sikteavstand b (m) på glidebryteren, og radien til utsnittet rundt kjernen. */
export const B_MAX = 120 * FM;
export const VIEW_RADIUS = 200 * FM;

/** Antall α-partikler i hele forsøket, og hvor lang tid avspillingen tar (s). */
export const N_TOTAL = 200_000;
export const PLAY_TIME = 16;
/** Hvor raskt skytingen øker: e^k − 1 ganger flere per sekund på slutten enn i starten. */
const FIRE_K = 10;
export const SIM_SEED = 7;

export const deg = (rad: number): number => (rad * 180) / Math.PI;
export const rad = (degrees: number): number => (degrees * Math.PI) / 180;

/** Bevegelsesenergien (J). */
export function alphaEnergy(MeV = ALPHA_ENERGY_MEV): number {
  return MeV * MEV_J;
}

/** Farten til α-partikkelen fra E_k = ½mv²: v = √(2E_k/m) (m/s). */
export function alphaSpeed(MeV = ALPHA_ENERGY_MEV): number {
  return Math.sqrt((2 * alphaEnergy(MeV)) / ALPHA.mass);
}

/**
 * Hvor nær kjernen α-partikkelen kommer i et sentralt støt (b = 0): all bevegelsesenergien er blitt elektrisk
 * potensiell energi, k · 2e · 79e / d = E_k (m).
 */
export function headOnDistance(MeV = ALPHA_ENERGY_MEV): number {
  return (K_COULOMB * ALPHA.charge * GOLD.Z * E_CHARGE) / alphaEnergy(MeV);
}

/** Avstanden mellom gullatomene (m): ett atom per a³, a³ = m_atom / ρ. */
export function atomSpacing(): number {
  return Math.cbrt((GOLD.A * U_KG) / GOLD.density);
}

/** Arealet hvert atom «dekker» i ett atomlag (m²). */
export function areaPerAtom(): number {
  return atomSpacing() ** 2;
}

/** Hvor mange atomlag α-partikkelen går gjennom i folien. */
export function foilLayers(thickness = FOIL_THICKNESS): number {
  return thickness / atomSpacing();
}

/** Masseforholdet m_α / m_e (ca. 7 300). */
export function alphaElectronMassRatio(): number {
  return ALPHA.mass / ELECTRON_MASS;
}

/** Masseforholdet m_kjerne / m_α for gull (197 u / 4,00 u ≈ 49). */
export function goldAlphaMassRatio(): number {
  return GOLD.A / ALPHA.massU;
}

// ---------------------------------------------------------------- én α-partikkel forbi én kjerne

/** Avbøyningsvinkelen θ forbi en punktkjerne: tan(θ/2) = d / (2b). b = 0 gir 180° (rett tilbake). */
export function rutherfordAngle(b: number, d = headOnDistance()): number {
  if (b <= 0) return Math.PI;
  return 2 * Math.atan(d / (2 * b));
}

/** Sikteavstanden som gir avbøyningen θ: b = (d/2) / tan(θ/2). */
export function impactForAngle(theta: number, d = headOnDistance()): number {
  if (theta >= Math.PI) return 0;
  if (theta <= 0) return Infinity;
  return d / 2 / Math.tan(theta / 2);
}

/** Eksentrisiteten til hyperbelbanen: ε = √(1 + (2b/d)²). */
export function eccentricity(b: number, d = headOnDistance()): number {
  return Math.sqrt(1 + ((2 * b) / d) ** 2);
}

/** Nærmeste avstand til kjernen: r_min = (d/2)(1 + ε). Er d når b = 0. */
export function closestApproach(b: number, d = headOnDistance()): number {
  return (d / 2) * (1 + eccentricity(b, d));
}

/** Farten i avstanden r fra kjernen, fra energibevaring: ½mv² + E_k · d/r = E_k (m/s). */
export function speedAt(r: number, MeV = ALPHA_ENERGY_MEV): number {
  const d = headOnDistance(MeV);
  return alphaSpeed(MeV) * Math.sqrt(Math.max(0, 1 - d / r));
}

/** Den elektriske kraften fra gullkjernen på α-partikkelen i avstanden r: F = k q Q / r² = E_k d / r² (N). */
export function nucleusForce(r: number, MeV = ALPHA_ENERGY_MEV): number {
  return (alphaEnergy(MeV) * headOnDistance(MeV)) / (r * r);
}

/**
 * Thomsons modell: avbøyningen fra den positive ladningen (spredt jevnt i en kule med atomets radius R) når α går
 * rett gjennom med sikteavstand b. Inne i kula er sidekraften konstant langs korden (k q Q b / R³), så
 * θ = d · b · √(R² − b²) / R³. Utenfor kula er atomet nøytralt (θ = 0).
 */
export function thomsonAngle(b: number, d = headOnDistance(), R = GOLD.atomRadius): number {
  const bb = Math.abs(b);
  if (bb >= R) return 0;
  return (d * bb * Math.sqrt(R * R - bb * bb)) / R ** 3;
}

/** Største avbøyning fra den positive kula i Thomsons modell: d / (2R), ved b = R/√2. */
export function thomsonMaxAngle(d = headOnDistance(), R = GOLD.atomRadius): number {
  return d / (2 * R);
}

/** Største avbøyning et fritt elektron kan gi en α-partikkel (elastisk støt, tung mot lett): m_e / m_α. */
export function electronMaxAngle(): number {
  return ELECTRON_MASS / ALPHA.mass;
}

/** Den største kraften fra den positive kula i Thomsons modell (på overflaten): E_k d / R² (N). */
export function thomsonMaxForce(MeV = ALPHA_ENERGY_MEV): number {
  return (alphaEnergy(MeV) * headOnDistance(MeV)) / GOLD.atomRadius ** 2;
}

// ---------------------------------------------------------------- mange atomlag: fordelingen av vinkler

export type ModelId = 'thomson' | 'rutherford';

export interface FoilSetup {
  /** Nærmeste avstand ved sentralt støt (m). */
  d: number;
  /** Areal per atom i ett lag (m²). */
  a2: number;
  layers: number;
}

export function foilSetup(MeV = ALPHA_ENERGY_MEV, thickness = FOIL_THICKNESS): FoilSetup {
  return { d: headOnDistance(MeV), a2: areaPerAtom(), layers: foilLayers(thickness) };
}

/**
 * Middelverdien av θ² fra elektronene i ett atomlag. Hvert elektron gir θ = d_e / b (d_e = d / 79), men aldri mer
 * enn m_e/m_α; innenfor b_min = d_e / θ_maks er avbøyningen θ_maks.
 */
function electronMeanSquare(s: FoilSetup): number {
  const de = s.d / GOLD.Z;
  const thMax = electronMaxAngle();
  const bMin = de / thMax;
  const perElectron = ((Math.PI * de * de) / s.a2) * (2 * Math.log(GOLD.atomRadius / bMin) + 1);
  return GOLD.Z * perElectron;
}

/**
 * Thomsons modell: kvadratisk middelverdi av den samlede avbøyningen etter alle lagene (rad). Den positive kula gir
 * ⟨θ²⟩ = d² / (6R²) per atom (snitt over sikteavstandene), elektronene litt til.
 */
export function thomsonSigma(s: FoilSetup = foilSetup()): number {
  const R = GOLD.atomRadius;
  const sphere = ((Math.PI * R * R) / s.a2) * ((s.d * s.d) / (6 * R * R));
  return Math.sqrt(s.layers * (sphere + electronMeanSquare(s)));
}

/**
 * Rutherfords modell: kvadratisk middelverdi av de mange små avbøyningene (alle under 2°) fra kjerner langt unna
 * og fra elektronene. Kjernen er skjermet av elektronene utenfor Thomas–Fermi-radien 0,885 a₀ / Z^(1/3).
 */
export function rutherfordSoftSigma(s: FoilSetup = foilSetup()): number {
  const bMax = (0.8853 * BOHR_RADIUS) / Math.cbrt(GOLD.Z);
  const bC = impactForAngle(HARD_LIMIT, s.d);
  const nuclear = ((2 * Math.PI * s.d * s.d) / s.a2) * Math.log(bMax / bC);
  return Math.sqrt(s.layers * (nuclear + electronMeanSquare(s)));
}

/** Forventet antall enkeltavbøyninger større enn θ gjennom hele folien: lag · π b(θ)² / a². */
export function hardRate(theta: number, s: FoilSetup = foilSetup()): number {
  const b = impactForAngle(theta, s.d);
  return (s.layers * Math.PI * b * b) / s.a2;
}

/** Sannsynligheten for at en α-partikkel blir avbøyd mer enn θ i modellen. */
export function probAbove(model: ModelId, theta: number, s: FoilSetup = foilSetup()): number {
  if (theta <= 0) return 1;
  if (theta >= Math.PI) return 0;
  if (model === 'thomson') {
    const sg = thomsonSigma(s);
    return Math.exp(-((theta / sg) ** 2));
  }
  // Ingen store avbøyninger (sannsynlighet e^−μ_c) og summen av de små over θ, eller den største store over θ.
  const soft = Math.exp(-hardRate(HARD_LIMIT, s)) * Math.exp(-((theta / rutherfordSoftSigma(s)) ** 2));
  if (theta < HARD_LIMIT) return soft + 1 - Math.exp(-hardRate(HARD_LIMIT, s));
  return soft + 1 - Math.exp(-hardRate(theta, s));
}

/** log₁₀ av sannsynligheten for avbøyning over θ i Thomsons modell (til svært små tall, f.eks. 10⁻²⁰⁰⁰⁰). */
export function thomsonLog10Above(theta: number, s: FoilSetup = foilSetup()): number {
  return -((theta / thomsonSigma(s)) ** 2) * Math.LOG10E;
}

/** Sannsynligheten for hvert vinkelintervall i telleren (summen er 1). */
export function binProbabilities(model: ModelId, s: FoilSetup = foilSetup()): number[] {
  const out: number[] = [];
  for (let i = 0; i < BIN_COUNT; i++) {
    const lo = rad(BIN_EDGES_DEG[i]!);
    const hi = rad(BIN_EDGES_DEG[i + 1]!);
    out.push(probAbove(model, lo, s) - probAbove(model, hi, s));
  }
  return out;
}

/** Hvilket intervall i telleren en vinkel (grader) hører til. */
export function binIndex(thetaDeg: number): number {
  for (let i = BIN_COUNT - 1; i > 0; i--) if (thetaDeg >= BIN_EDGES_DEG[i]!) return i;
  return 0;
}

// ---------------------------------------------------------------- simulert forsøk

export interface Experiment {
  /** Avbøyningsvinkel for hver α-partikkel (grader, 0–180). */
  thetaDeg: Float32Array;
  /** Til hvilken side partikkelen havner på skjermen i figuren (+1 opp, −1 ned). */
  side: Int8Array;
  /** Intervallet i telleren. */
  bin: Uint8Array;
}

function poisson(mu: number, rnd: () => number): number {
  const L = Math.exp(-mu);
  let k = 0;
  let p = rnd();
  while (p > L && k < 50) {
    k++;
    p *= rnd();
  }
  return k;
}

/**
 * Simulerer forsøket med Rutherfords modell (enkeltspredning, som Rutherford selv regnet): hver α-partikkel får
 * mange små avbøyninger (normalfordelt, som en tilfeldig vandring) og et Poisson-fordelt antall store
 * enkeltavbøyninger (over 2°) fra kjerner den kommer nær. Har den fått en stor, er det den største som bestemmer
 * vinkelen; ellers er det summen av de små. For de store er P(over θ) ∝ b(θ)² ∝ 1 / tan²(θ/2), så
 * θ = 2 · atan(tan(θ_c/2) / √u) med u jevnt fordelt i (0, 1]. Da gir `probAbove` nøyaktig fordelingen til simuleringen.
 */
export function simulateExperiment(n = N_TOTAL, seed = SIM_SEED, s: FoilSetup = foilSetup()): Experiment {
  const rnd = seededRandom(seed);
  const sigmaAxis = rutherfordSoftSigma(s) / Math.SQRT2;
  const mu = hardRate(HARD_LIMIT, s);
  const tanC = Math.tan(HARD_LIMIT / 2);
  const thetaDeg = new Float32Array(n);
  const side = new Int8Array(n);
  const bin = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    // Box–Muller: to normalfordelte tall.
    const u1 = 1 - rnd();
    const u2 = rnd();
    const g = Math.sqrt(-2 * Math.log(u1));
    let x = sigmaAxis * g * Math.cos(2 * Math.PI * u2);
    let y = sigmaAxis * g * Math.sin(2 * Math.PI * u2);
    const k = poisson(mu, rnd);
    let big = 0;
    for (let j = 0; j < k; j++) {
      const u = 1 - rnd();
      const th = 2 * Math.atan(tanC / Math.sqrt(u));
      const phi = 2 * Math.PI * rnd();
      if (th > big) {
        big = th;
        x = th * Math.cos(phi);
        y = th * Math.sin(phi);
      }
    }
    const th = Math.min(Math.PI, Math.hypot(x, y));
    const dDeg = deg(th);
    thetaDeg[i] = dDeg;
    side[i] = y >= 0 ? 1 : -1;
    bin[i] = binIndex(dDeg);
  }
  return { thetaDeg, side, bin };
}

/** Bredden på vinkelintervallene langs skjermen i figuren (grader). */
export const RING_STEP_DEG = 2;
export const RING_BUCKETS = 180 / RING_STEP_DEG;

export interface Tally {
  /** Antall i hvert intervall i telleren. */
  bins: number[];
  /** Treff langs skjermen, øvre og nedre halvdel, i intervaller på 2°. */
  up: Int32Array;
  down: Int32Array;
}

/** Teller opp de første n α-partiklene. */
export function tally(exp: Experiment, n: number): Tally {
  const m = Math.max(0, Math.min(n, exp.bin.length));
  const bins = new Array<number>(BIN_COUNT).fill(0);
  const up = new Int32Array(RING_BUCKETS);
  const down = new Int32Array(RING_BUCKETS);
  for (let i = 0; i < m; i++) {
    bins[exp.bin[i]!]!++;
    const k = Math.min(RING_BUCKETS - 1, Math.floor(exp.thetaDeg[i]! / RING_STEP_DEG));
    if (exp.side[i]! > 0) up[k]!++;
    else down[k]!++;
  }
  return { bins, up, down };
}

/** Indeksene til α-partiklene som ble avbøyd mer enn `minDeg` (i rekkefølgen de ble skutt). */
export function largeAngleIndices(exp: Experiment, minDeg: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < exp.thetaDeg.length; i++) if (exp.thetaDeg[i]! > minDeg) out.push(i);
  return out;
}

// ---------------------------------------------------------------- avspilling: skytingen går stadig fortere

/** Antall α-partikler skutt etter tiden t (s): N(t) = N · (e^(kt/T) − 1) / (e^k − 1). */
export function firedCount(t: number, total = N_TOTAL, T = PLAY_TIME): number {
  if (t <= 0) return 0;
  if (t >= T) return total;
  return Math.min(total, Math.floor((total * Math.expm1((FIRE_K * t) / T)) / Math.expm1(FIRE_K)));
}

/** Tidspunktet α-partikkel nummer i (0, 1, 2 …) blir skutt (s); den motsatte av firedCount. */
export function fireTime(i: number, total = N_TOTAL, T = PLAY_TIME): number {
  return (T / FIRE_K) * Math.log1p(((i + 1) * Math.expm1(FIRE_K)) / total);
}

// ---------------------------------------------------------------- størrelsen på kjernen fra tellingen

/**
 * Hvor nær en kjerne en α-partikkel må komme for å bli kastet tilbake, regnet ut fra tellingen alene: andelen som
 * kastes tilbake = lag · π b² / a² (som å kaste piler mot en vegg med én liten blink per atom), så
 * b = √(andel · a² / (π · lag)) (m). Gir 0 når ingen er kastet tilbake.
 */
export function targetRadiusFromCount(back: number, total: number, s: FoilSetup = foilSetup()): number {
  if (total <= 0 || back <= 0) return 0;
  const perAtom = back / total / s.layers;
  return Math.sqrt((perAtom * s.a2) / Math.PI);
}

/** Sjansen per atom (per lag) som tellingen gir: andel / lag. */
export function chancePerAtom(back: number, total: number, s: FoilSetup = foilSetup()): number {
  if (total <= 0) return 0;
  return back / total / s.layers;
}

// ---------------------------------------------------------------- banen forbi kjernen (utsnittet)

export interface Trajectory {
  /** Punkter (x, y) med kjernen i origo, y oppover. α kommer fra venstre i høyden b og bøyes oppover. */
  pts: [number, number][];
  /** Tiden fram til hvert punkt, i enheter av (lengdeenhet / v₀). */
  time: number[];
  /** Indeksen til punktet nærmest kjernen. */
  nearest: number;
}

/**
 * Hyperbelbanen forbi en frastøtende punktladning, i vilkårlige lengdeenheter (fm i utsnittet, px i atomgitteret).
 * Kjernen er i brennpunktet: r(ψ) = 2b² / (d (ε cos ψ − 1)), med retningen til nærmeste punkt (π + θ)/2. Banen
 * klippes der r > rMax. b = 0 gir en rett linje inn til r = d og samme vei tilbake. Tiden følger av energibevaring:
 * v = v₀ √(1 − d/r).
 */
export function trajectory(b: number, d: number, rMax: number, n = 160): Trajectory {
  const pts: [number, number][] = [];
  if (b <= 1e-9 * d) {
    const half = Math.max(2, Math.floor(n / 2));
    const reach = Math.max(rMax, d);
    for (let i = 0; i <= half; i++) pts.push([-(reach - ((reach - d) * i) / half), 0]);
    for (let i = half - 1; i >= 0; i--) pts.push([-(reach - ((reach - d) * i) / half), 0]);
  } else {
    const eps = eccentricity(b, d);
    const theta = rutherfordAngle(b, d);
    const ap = (Math.PI + theta) / 2;
    const cosLim = Math.min(1, (1 + (2 * b * b) / (d * rMax)) / eps);
    const psiLim = Math.acos(cosLim);
    if (psiLim <= 0) return { pts: [], time: [], nearest: 0 };
    for (let i = 0; i <= n; i++) {
      // Tettere punkter nær toppen av banen: ψ = ψ_lim · sin-fordeling.
      const s = 1 - (2 * i) / n;
      const psi = psiLim * Math.sin((s * Math.PI) / 2);
      const r = (2 * b * b) / (d * (eps * Math.cos(psi) - 1));
      pts.push([r * Math.cos(ap + psi), r * Math.sin(ap + psi)]);
    }
  }
  const time = [0];
  let nearest = 0;
  let rBest = Infinity;
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i]!;
    const r = Math.hypot(p[0], p[1]);
    if (r < rBest) {
      rBest = r;
      nearest = i;
    }
    if (i === 0) continue;
    const q = pts[i - 1]!;
    const ds = Math.hypot(p[0] - q[0], p[1] - q[1]);
    const rm = Math.hypot((p[0] + q[0]) / 2, (p[1] + q[1]) / 2);
    const v = Math.max(0.12, Math.sqrt(Math.max(0, 1 - d / rm)));
    time.push(time[i - 1]! + ds / v);
  }
  return { pts, time, nearest };
}

/** Punktet på banen ved tiden τ (lineær interpolasjon), og indeksen til segmentet. */
export function pointAt(tr: Trajectory, tau: number): { x: number; y: number; i: number } {
  const { pts, time } = tr;
  if (pts.length === 0) return { x: 0, y: 0, i: 0 };
  const end = time[time.length - 1]!;
  const tt = Math.max(0, Math.min(end, tau));
  let i = 1;
  while (i < time.length - 1 && time[i]! < tt) i++;
  const t0 = time[i - 1]!;
  const t1 = time[i] ?? t0;
  const a = pts[i - 1]!;
  const bb = pts[i] ?? a;
  const w = t1 > t0 ? (tt - t0) / (t1 - t0) : 0;
  return { x: a[0] + (bb[0] - a[0]) * w, y: a[1] + (bb[1] - a[1]) * w, i };
}

/** Skjæringspunktet mellom asymptotene (der vinkelen θ tegnes): (d/2)·ε fra kjernen mot nærmeste punkt. */
export function asymptoteCenter(b: number, d: number): [number, number] {
  if (b <= 0) return [-d / 2, 0];
  const theta = rutherfordAngle(b, d);
  const ap = (Math.PI + theta) / 2;
  const c = (d / 2) * eccentricity(b, d);
  return [c * Math.cos(ap), c * Math.sin(ap)];
}
