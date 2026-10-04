/** Ren fysikk for kapittel 5 Termisk energi (ingen React), så den kan testes for seg. */

/* ---------- Konstanter (verdiene i ERGO Fysikk 1) ---------- */

/** Gasskonstanten R (J/(mol·K)). */
export const R_GAS = 8.31;
/** Boltzmanns konstant k (J/K). */
export const K_BOLTZMANN = 1.38e-23;
/** Atommasseenheten u (kg). */
export const U_MASS = 1.66e-27;
/** 0 °C i kelvin. */
export const ZERO_CELSIUS = 273.15;

export const toKelvin = (celsius: number): number => celsius + ZERO_CELSIUS;
export const toCelsius = (kelvin: number): number => kelvin - ZERO_CELSIUS;

/* ---------- 5A/5B Gass i en sylinder ---------- */

/** Gassen i sylinderen: 0,10 mol nitrogen (N₂, 28 u), som er det meste av lufta. */
export const GAS_N = 0.1;
export const GAS_MOLAR_U = 28;
/** Tverrsnittsarealet til sylinderen (m²), 50 cm². */
export const PISTON_AREA = 0.005;

/** Tilstandslikningen for idealgass, pV = nRT ⇒ p = nRT/V. T i kelvin, V i m³, svar i Pa. */
export function gasPressure(n: number, T: number, V: number): number {
  if (!(V > 0)) return NaN;
  return (n * R_GAS * Math.max(0, T)) / V;
}

/**
 * Typisk fart (rot-middel-kvadrat) for gasspartikler med masse `massU` (i u): ½m·v² = (3/2)kT ⇒ v = √(3kT/m).
 * Farten er proporsjonal med √T.
 */
export function typicalSpeed(T: number, massU: number): number {
  return Math.sqrt((3 * K_BOLTZMANN * Math.max(0, T)) / (massU * U_MASS));
}

/** Liten tallgenerator med fast frø (mulberry32), så animasjonen og skjermbildene blir like hver gang. */
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Én gasspartikkel. Posisjonen (u, w) er en andel av boksens bredde og høyde (0–1), så partiklene følger
 * med når stempelet flyttes. Farten (vx, vy) er i piksler per sekund ved referansetemperaturen.
 */
export interface Particle {
  u: number;
  w: number;
  vx: number;
  vy: number;
}

/**
 * Partikler med tilfeldig plassering og retning, og fart fra en todimensjonal Maxwell-fordeling
 * (Rayleigh) med middelkvadrat `speed²`. Samme frø gir samme partikler.
 */
export function makeParticles(count: number, seed: number, speed: number): Particle[] {
  const rnd = seededRandom(seed);
  const ps: Particle[] = [];
  for (let i = 0; i < count; i++) {
    const u = 0.04 + 0.92 * rnd();
    const w = 0.04 + 0.92 * rnd();
    const angle = 2 * Math.PI * rnd();
    // Rayleigh-fordelt fart med <s²> = 1, begrenset så ingen står helt stille eller farer avgårde
    const s = Math.min(2.4, Math.max(0.25, Math.sqrt(-Math.log(1 - 0.999 * rnd()))));
    ps.push({ u, w, vx: speed * s * Math.cos(angle), vy: speed * s * Math.sin(angle) });
  }
  return ps;
}

export interface StepResult {
  particles: Particle[];
  /** Høyden (andel 0–1) der partikler traff stempelet (høyre vegg) i dette steget. */
  pistonHits: number[];
}

/**
 * Flytter partiklene `dt` sekunder i en boks på `width` × `height` piksler. Farten skaleres med
 * `scale` (= √(T/T_ref)), og støtene mot veggene er fullstendig elastiske (farten snus).
 * Partiklene støter ikke mot hverandre (idealgass).
 */
export function stepParticles(ps: Particle[], dt: number, scale: number, width: number, height: number): StepResult {
  const hits: number[] = [];
  const out = ps.map((p) => {
    let { u, w, vx, vy } = p;
    u += (vx * scale * dt) / width;
    w += (vy * scale * dt) / height;
    // Speiling i veggene. Steget er så kort at en partikkel aldri går mer enn én boks.
    if (u > 1) {
      u = 2 - u;
      vx = -vx;
      hits.push(w);
    } else if (u < 0) {
      u = -u;
      vx = -vx;
    }
    if (w > 1) {
      w = 2 - w;
      vy = -vy;
    } else if (w < 0) {
      w = -w;
      vy = -vy;
    }
    return { u: Math.min(1, Math.max(0, u)), w: Math.min(1, Math.max(0, w)), vx, vy };
  });
  return { particles: out, pistonHits: hits };
}

/** Middelverdien av v² for partiklene (til testing: elastiske støt endrer ikke bevegelsesenergien). */
export function meanSquareSpeed(ps: Particle[]): number {
  if (ps.length === 0) return 0;
  return ps.reduce((sum, p) => sum + p.vx * p.vx + p.vy * p.vy, 0) / ps.length;
}

/* ---------- 5D Spesifikk varmekapasitet ---------- */

export type MaterialId = 'vann' | 'etanol' | 'aluminium' | 'jern' | 'kobber' | 'bly';

export interface Material {
  id: MaterialId;
  name: string;
  /** Spesifikk varmekapasitet c (J/(kg·K)). */
  c: number;
  /** Kokepunkt (°C) for væskene. */
  boil?: number;
  /** Spesifikk fordampingsvarme (J/kg). */
  Lv?: number;
}

export const MATERIALS: Record<MaterialId, Material> = {
  vann: { id: 'vann', name: 'Vann', c: 4180, boil: 100, Lv: 2.26e6 },
  etanol: { id: 'etanol', name: 'Etanol', c: 2440, boil: 78, Lv: 0.85e6 },
  aluminium: { id: 'aluminium', name: 'Aluminium', c: 900 },
  jern: { id: 'jern', name: 'Jern', c: 450 },
  kobber: { id: 'kobber', name: 'Kobber', c: 390 },
  bly: { id: 'bly', name: 'Bly', c: 130 },
};

export interface HeatingState {
  /** Temperatur (°C). */
  T: number;
  /** Tilført energi Q = P·t (J). */
  Q: number;
  /** Om stoffet koker (temperaturen står stille). */
  boiling: boolean;
  /** Masse som har fordampet (kg). */
  evaporated: number;
}

/**
 * Oppvarming med konstant effekt P (W) i tiden t (s), uten varmetap. Q = P·t = c·m·ΔT til stoffet når
 * kokepunktet. Da går energien med til å fordampe væsken (Q = L·m), og temperaturen stiger ikke.
 */
export function heating(mat: Material, m: number, P: number, T0: number, t: number): HeatingState {
  const Q = P * Math.max(0, t);
  const C = mat.c * m;
  if (mat.boil === undefined || mat.Lv === undefined) return { T: T0 + Q / C, Q, boiling: false, evaporated: 0 };
  const toBoil = C * Math.max(0, mat.boil - T0);
  if (Q <= toBoil && toBoil > 0) return { T: T0 + Q / C, Q, boiling: false, evaporated: 0 };
  return { T: mat.boil, Q, boiling: true, evaporated: Math.min(m, (Q - toBoil) / mat.Lv) };
}

/** Tiden (s) det tar å varme stoffet fra T0 til T1 med effekten P: t = c·m·ΔT/P. Uendelig hvis væsken koker før T1. */
export function timeToReach(mat: Material, m: number, P: number, T0: number, T1: number): number {
  if (mat.boil !== undefined && T1 > mat.boil + 1e-9) return Infinity;
  if (!(P > 0)) return Infinity;
  return (mat.c * m * Math.max(0, T1 - T0)) / P;
}

/* ---------- 5C/5D Blanding og termisk likevekt ---------- */

export interface MixInput {
  /** Det varme legemet: spesifikk varmekapasitet, masse og starttemperatur. */
  c1: number;
  m1: number;
  T1: number;
  /** Det kalde legemet. */
  c2: number;
  m2: number;
  T2: number;
}

/** Sluttemperaturen når avgitt energi = mottatt energi: c₁m₁(T₁ − T) = c₂m₂(T − T₂). */
export function equilibriumTemp({ c1, m1, T1, c2, m2, T2 }: MixInput): number {
  const C1 = c1 * m1;
  const C2 = c2 * m2;
  return (C1 * T1 + C2 * T2) / (C1 + C2);
}

export interface MixState {
  /** Temperaturene ved tiden t (°C). */
  T1: number;
  T2: number;
  /** Sluttemperaturen (°C). */
  Ts: number;
  /** Energi som er gått fra det varme til det kalde legemet så langt (J). */
  Q: number;
  /** All energien som overføres til slutt (J). */
  Qtotal: number;
}

/** Tidskonstanten (s) i modellen for hvor fort temperaturene nærmer seg hverandre. */
export const MIX_TAU = 6;

/**
 * Temperaturene underveis. Energistrømmen er proporsjonal med temperaturforskjellen (Newtons
 * avkjølingslov), så forskjellen avtar eksponentielt: T₁ − T₂ = (T₁₀ − T₂₀)·e^(−t/τ). Hvor fort det går
 * avhenger av omrøring og kontaktflate (τ), men sluttemperaturen gjør det ikke. Ingen varmetap.
 */
export function mixState(input: MixInput, t: number, tau = MIX_TAU): MixState {
  const Ts = equilibriumTemp(input);
  const k = Math.exp(-Math.max(0, t) / tau);
  const T1 = Ts + (input.T1 - Ts) * k;
  const T2 = Ts + (input.T2 - Ts) * k;
  const C1 = input.c1 * input.m1;
  return { T1, T2, Ts, Q: C1 * (input.T1 - T1), Qtotal: C1 * (input.T1 - Ts) };
}

/* ---------- 5E Termofysikkens første lov ---------- */

/**
 * Termofysikkens første lov slik ERGO skriver den: ΔU = W + Q, der W er arbeidet som blir gjort
 * PÅ systemet og Q er varmen som blir tilført systemet. Begge er negative når energi går ut.
 */
export function firstLaw(W: number, Q: number): number {
  return W + Q;
}

/** Gassen i 5E: 1,0 mol luft. Indre energi U = (5/2)nRT, så det trengs (5/2)nR ≈ 20,8 J per kelvin. */
export const AIR_MOL = 1;
export const AIR_HEAT_CAPACITY = 2.5 * AIR_MOL * R_GAS;

/** Temperaturen etter en endring ΔU i indre energi: ΔT = ΔU / C. */
export function temperatureAfter(T0: number, dU: number, C = AIR_HEAT_CAPACITY): number {
  return T0 + dU / C;
}
