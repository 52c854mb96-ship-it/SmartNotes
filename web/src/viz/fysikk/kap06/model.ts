/** Ren fysikk for kapittel 6 Bølger og stråling (ingen React), så den kan testes for seg. */

/* ---------- Konstanter (verdiene i ERGO Fysikk 1) ---------- */

/** Plancks konstant h (J·s). */
export const H_PLANCK = 6.63e-34;
/** Lysfarten c (m/s). */
export const C_LIGHT = 3.0e8;
/** Boltzmanns konstant k (J/K). */
export const K_BOLTZMANN = 1.38e-23;
/** Stefan–Boltzmanns konstant σ (W/(m²·K⁴)). */
export const SIGMA = 5.67e-8;
/** Wiens konstant b (m·K). */
export const WIEN_B = 2.9e-3;

/* ---------- 6A Bølger ---------- */

/** Bølgefarten v = λ·f. */
export const waveSpeed = (lambda: number, f: number): number => lambda * f;
/** Perioden T = 1/f. */
export const period = (f: number): number => (f > 0 ? 1 / f : Infinity);

/**
 * Utslaget til partikkelen i x ved tiden t for en harmonisk bølge som går i positiv x-retning:
 * y(x, t) = A·sin(2π(f·t − x/λ)). Kilden i x = 0 starter med å gå oppover.
 * For en longitudinal bølge er dette forskyvningen langs x i stedet for på tvers.
 */
export function waveDisplacement(x: number, t: number, A: number, lambda: number, f: number): number {
  return A * Math.sin(2 * Math.PI * (f * t - x / lambda));
}

/** Farten til partikkelen (ikke bølgen): dy/dt = 2πfA·cos(2π(f·t − x/λ)). */
export function particleVelocity(x: number, t: number, A: number, lambda: number, f: number): number {
  return 2 * Math.PI * f * A * Math.cos(2 * Math.PI * (f * t - x / lambda));
}

/**
 * Posisjonene (x) til bølgetoppene i [x0, x1] ved tiden t. Toppen er der fasen f·t − x/λ = 1/4 + n.
 */
export function crestPositions(t: number, lambda: number, f: number, x0: number, x1: number): number[] {
  const out: number[] = [];
  // x = λ(f·t − 1/4 − n)
  const nMin = Math.ceil(f * t - 0.25 - x1 / lambda - 1e-9);
  const nMax = Math.floor(f * t - 0.25 - x0 / lambda + 1e-9);
  for (let n = nMax; n >= nMin; n--) out.push(lambda * (f * t - 0.25 - n));
  return out;
}

/**
 * Største amplitude en longitudinal bølge kan ha uten at nabopartikler passerer hverandre: forskyvningen
 * må endre seg mindre enn avstanden, dvs. 2πA/λ < 1. Vi holder oss på 80 % av grensen.
 */
export function maxLongitudinalAmplitude(lambda: number): number {
  return (0.8 * lambda) / (2 * Math.PI);
}

/* ---------- 6B Strålingslovene ---------- */

/**
 * Plancks strålingslov: utstrålt effekt per areal og per bølgelengde fra et svart legeme,
 * M(λ, T) = 2πhc² / (λ⁵ · (e^(hc/(λkT)) − 1)), i W/m² per meter bølgelengde.
 */
export function planck(lambda: number, T: number): number {
  if (!(lambda > 0) || !(T > 0)) return 0;
  const x = (H_PLANCK * C_LIGHT) / (lambda * K_BOLTZMANN * T);
  if (x > 700) return 0;
  return (2 * Math.PI * H_PLANCK * C_LIGHT * C_LIGHT) / (lambda ** 5 * Math.expm1(x));
}

/** Wiens forskyvningslov: λ_maks = b/T (m). */
export const wienPeak = (T: number): number => WIEN_B / T;

/** Stefan–Boltzmanns lov: utstrålt intensitet I = σT⁴ (W/m²). */
export const stefanBoltzmann = (T: number): number => SIGMA * T ** 4;

/** Integralet av Plancks lov fra λ1 til λ2 (W/m²), med Simpsons metode. */
export function planckBand(T: number, lambda1: number, lambda2: number, n = 400): number {
  const steps = n % 2 === 0 ? n : n + 1;
  const h = (lambda2 - lambda1) / steps;
  let sum = planck(lambda1, T) + planck(lambda2, T);
  for (let i = 1; i < steps; i++) sum += (i % 2 === 0 ? 2 : 4) * planck(lambda1 + i * h, T);
  return (sum * h) / 3;
}

/** Synlig lys i modellen: 380–750 nm. */
export const VISIBLE: [number, number] = [380e-9, 750e-9];

/** Andelen av all strålingen som er synlig lys (0–1). */
export function visibleFraction(T: number): number {
  return planckBand(T, VISIBLE[0], VISIBLE[1]) / stefanBoltzmann(T);
}

/**
 * Omtrentlig farge (sRGB 0–255) på et svart legeme med temperaturen T, slik øyet ser den.
 * Tilpasset kurve (Tanner Helland) som stemmer godt mellom 1000 K og 40 000 K.
 */
export function blackbodyRgb(T: number): [number, number, number] {
  const t = Math.min(40000, Math.max(1000, T)) / 100;
  const clamp = (v: number) => Math.round(Math.min(255, Math.max(0, v)));
  const r = t <= 66 ? 255 : 329.698727446 * (t - 60) ** -0.1332047592;
  const g = t <= 66 ? 99.4708025861 * Math.log(t) - 161.1195681661 : 288.1221695283 * (t - 60) ** -0.0755148492;
  const b = t >= 66 ? 255 : t <= 19 ? 0 : 138.5177312231 * Math.log(t - 10) - 305.0447927307;
  return [clamp(r), clamp(g), clamp(b)];
}

/**
 * Omtrentlig sRGB-farge (0–255) for lys med én bølgelengde (nm) i det synlige området, svakere mot kantene.
 * Brukes bare til å tegne regnbuen under kurven.
 */
export function wavelengthRgb(nm: number): [number, number, number] {
  if (!(nm >= 380 && nm <= 750)) return [0, 0, 0];
  let r = 0;
  let g = 0;
  let b = 0;
  if (nm < 440) {
    r = (440 - nm) / 60;
    b = 1;
  } else if (nm < 490) {
    g = (nm - 440) / 50;
    b = 1;
  } else if (nm < 510) {
    g = 1;
    b = (510 - nm) / 20;
  } else if (nm < 580) {
    r = (nm - 510) / 70;
    g = 1;
  } else if (nm < 645) {
    r = 1;
    g = (645 - nm) / 65;
  } else {
    r = 1;
  }
  const edge = nm < 420 ? 0.3 + (0.7 * (nm - 380)) / 40 : nm > 700 ? 0.3 + (0.7 * (750 - nm)) / 50 : 1;
  const k = Math.max(0, edge);
  return [Math.round(255 * r * k), Math.round(255 * g * k), Math.round(255 * b * k)];
}

/* ---------- 6C Strålingsbalansen ---------- */

/** Solarkonstanten: innstrålt intensitet fra sola rett utenfor atmosfæren (W/m²). */
export const SOLAR_CONSTANT = 1361;

export interface Balance {
  /** Gjennomsnittlig innstråling over hele jordoverflaten, S/4 (W/m²). */
  incoming: number;
  /** Reflektert sollys, α·S/4. */
  reflected: number;
  /** Absorbert sollys, (1 − α)·S/4. */
  absorbed: number;
  /** Temperaturen jorda ville hatt uten atmosfære (K): (1 − α)S/4 = σT⁴. */
  Tbare: number;
  /** Temperaturen ved bakken med atmosfæren (K). */
  Tsurface: number;
  /** Temperaturen i atmosfærelaget (K), eller NaN uten atmosfære. */
  Tatm: number;
  /** Varmestråling fra bakken, σT_b⁴. */
  surfaceEmit: number;
  /** Den delen av varmestrålingen fra bakken som atmosfæren absorberer, ε·σT_b⁴. */
  atmAbsorbed: number;
  /** Den delen som slipper rett ut i verdensrommet, (1 − ε)·σT_b⁴. */
  transmitted: number;
  /** Atmosfæren stråler like mye opp som ned. */
  atmUp: number;
  atmDown: number;
  /** All utstråling til verdensrommet (varmestråling). */
  outgoingIR: number;
}

/**
 * Énlagsmodell for strålingsbalansen. Atmosfæren slipper sollyset gjennom, men absorberer andelen ε
 * av varmestrålingen fra bakken. Den stråler selv like mye opp og ned. Likevekt for bakken og atmosfæren gir
 *   σT_b⁴ = (1 − α)·S/4 / (1 − ε/2),
 * så T_b = T_uten · (2/(2 − ε))^(1/4). Uten atmosfære (ε = 0) blir T_b = T_uten.
 */
export function radiationBalance(albedo: number, eps: number, S = SOLAR_CONSTANT): Balance {
  const incoming = S / 4;
  const reflected = albedo * incoming;
  const absorbed = incoming - reflected;
  const Tbare = (absorbed / SIGMA) ** 0.25;
  const surfaceEmit = absorbed / (1 - eps / 2);
  const Tsurface = (surfaceEmit / SIGMA) ** 0.25;
  const atmAbsorbed = eps * surfaceEmit;
  const atmUp = atmAbsorbed / 2;
  const transmitted = surfaceEmit - atmAbsorbed;
  const Tatm = eps > 0 ? (atmUp / (eps * SIGMA)) ** 0.25 : NaN;
  return {
    incoming,
    reflected,
    absorbed,
    Tbare,
    Tsurface,
    Tatm,
    surfaceEmit,
    atmAbsorbed,
    transmitted,
    atmUp,
    atmDown: atmUp,
    outgoingIR: transmitted + atmUp,
  };
}

/** Andelen ε som gir en gitt bakketemperatur med albedoen α (snudd om på formelen over). */
export function epsForSurfaceTemp(albedo: number, Tsurface: number): number {
  const Tbare = radiationBalance(albedo, 0).Tbare;
  return 2 * (1 - (Tbare / Tsurface) ** 4);
}
