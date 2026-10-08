/**
 * Eksempeloppgaven «Luft i en sylinder med stempel» (k5-eks-gass, 5A, 5B og 5E).
 *
 * En tett glassylinder med stempel står i et vannbad på en kokeplate. Stempelet har arealet A, glir uten friksjon og
 * er så lett at vi ser bort fra tyngden. Til å begynne med holder vannbadet romtemperatur t₁, og lufta i sylinderen
 * har volumet V₁ og samme trykk som lufta utenfor, p₁ = p₀. En splint over stempelet låser det.
 *
 *   a) Stoffmengden:                  n = p₁V₁ / (RT₁)                          (T i kelvin)
 *   b) Oppvarmet til t₂ (V og n fast): p₂ = p₁ · T₂ / T₁
 *   c) Kraften fra splinten:          F_s = p₂A − p₀A = (p₂ − p₀)A               (stempelet i ro, ΣF = 0)
 *   d) Første lov, ΔU = W + Q:        oppvarmingen: W = 0 ⇒ ΔU = Q;  utvidelsen: W = −(arbeidet lufta gjør), Q > 0
 *   e) Stempelet i ro uten splint:    p₃ = p₀,  V₃ = nRT₃ / p₃
 *
 * Tallene eleven får oppgitt (varmen under oppvarmingen, arbeidet under utvidelsen og temperaturen etterpå) lager vi
 * her, så de passer sammen med en ekte gass. Lufta er en toatomig idealgass med indre energi U = (5/2)nRT (eleven
 * trenger ikke den formelen). Under utvidelsen skyver lufta stempelet ut mot lufttrykket p₀, så arbeidet den gjør er
 * p₀(V₃ − V₁), og første lov gir sluttemperaturen:
 *
 *   (5/2)nR(T₃ − T₂) = −p₀(V₃ − V₁) + Q_u  og  p₀V₃ = nRT₃   ⇒   T₃ = ((5/2)nRT₂ + p₀V₁ + Q_u) / ((7/2)nR)
 *
 * Eleven regner bare med de avrundede tallene i oppgaveteksten, og alle svarene (også i figuren) regnes ut fra dem.
 */

/** Gasskonstanten R (J/(mol·K)), som i ERGO Fysikk 1. */
export const R_GAS = 8.31;
/** 0 °C i kelvin. */
export const ZERO_CELSIUS = 273.15;
/** Arealet til stempelet (m²): 100 cm², innvendig diameter 11,3 cm. */
export const PISTON_AREA = 1.0e-2;
/** Molar varmekapasitet ved konstant volum for luft, (5/2)R (J/(mol·K)). Bare til å lage tallene i oppgaven. */
export const CV_AIR = 2.5 * R_GAS;

export const toKelvin = (celsius: number): number => celsius + ZERO_CELSIUS;

export interface GasTask {
  /** Volumet til lufta før oppvarmingen (L). */
  V1: number;
  /** Romtemperaturen: vannbadet og lufta før oppvarmingen (°C). */
  t1: number;
  /** Lufttrykket utenfor (kPa). Lufta i sylinderen har samme trykk når splinten settes i. */
  p0: number;
  /** Temperaturen i vannbadet etter oppvarmingen (°C). 100 °C betyr at vannet koker. */
  t2: number;
  /** Varmen lufta får fra vannbadet mens den utvider seg (J). */
  Qexp: number;
}

/**
 * Tre tallsett: kokende vannbad (1 og 3) og et vannbad på 80 °C (2). I alle tre gjør lufta mer arbeid enn den får
 * varme under utvidelsen, så den blir kaldere selv om den får varme.
 */
export const GAS_TASKS: GasTask[] = [
  { V1: 1.5, t1: 18, p0: 101, t2: 100, Qexp: 20 },
  { V1: 1.2, t1: 21, p0: 99, t2: 80, Qexp: 15 },
  { V1: 1.6, t1: 12, p0: 102, t2: 100, Qexp: 25 },
];

export interface GasSolution {
  /* ---------- a) */
  /** Temperaturene i kelvin før og etter oppvarmingen. */
  T1: number;
  T2: number;
  /** V₁ i m³ og p₀ = p₁ i Pa. */
  V1: number;
  p0: number;
  /** Stoffmengden (mol). */
  n: number;
  /** Den vanlige feilen: celsius i stedet for kelvin gir n = p₁V₁ / (R · t₁). */
  nCelsius: number;
  /* ---------- b) */
  /** Trykket etter oppvarmingen (Pa). */
  p2: number;
  /** p₂ avrundet til tre gjeldende siffer i kPa, til «Vis at»-teksten. */
  p2Shown: number;
  /** Den vanlige feilen: p₁ · t₂ / t₁ med celsius (Pa). */
  p2Celsius: number;
  /* ---------- c) */
  /** Kraften fra lufta inni (oppover) og lufta utenfor (nedover) på stempelet når det er låst (N). */
  Fgas2: number;
  Fair: number;
  /** Kraften fra splinten på stempelet (nedover), F_s = (p₂ − p₀)A (N). */
  Fpin: number;
  /* ---------- d) */
  /** Varmen under oppvarmingen, slik oppgaven oppgir den (J, heltall). */
  Qheat: number;
  /** Arbeidet på lufta under oppvarmingen: stempelet står fast, så W = 0. */
  Wheat: number;
  /** ΔU under oppvarmingen = Q (J). */
  dUheat: number;
  /** Arbeidet lufta gjør på stempelet under utvidelsen, slik oppgaven oppgir det (J, positivt heltall). */
  Wout: number;
  /** Arbeidet på lufta i første lov: W = −Wout (J). */
  Wexp: number;
  /** Varmen lufta får under utvidelsen (J). */
  Qexp: number;
  /** ΔU under utvidelsen = W + Q (J). */
  dUexp: number;
  /* ---------- e) */
  /** Temperaturen etter utvidelsen, slik oppgaven oppgir den (°C, én desimal), og i kelvin. */
  t3: number;
  T3: number;
  /** Trykket når stempelet står i ro uten splint: p₃ = p₀ (Pa). */
  p3: number;
  /** Volumet etter utvidelsen (m³), regnet ut fra n, T₃ og p₃. */
  V3: number;
  /** Kraften fra lufta inni og utenfor når stempelet står i ro uten splint (N). Like store. */
  Fgas3: number;
  /* ---------- Kontroll (ikke vist): den nøyaktige modellen bak tallene */
  exact: { Qheat: number; Wout: number; T3: number; V3: number; dUexp: number };
}

/** Avrunder til `n` gjeldende siffer: 129,45 → 129 (n = 3). */
export function roundSig(v: number, n: number): number {
  if (!Number.isFinite(v) || v === 0) return v;
  const p = 10 ** (n - Math.ceil(Math.log10(Math.abs(v))));
  return Math.round(v * p) / p;
}

/** Tilstandslikningen løst for n: n = pV / (RT). p i Pa, V i m³, T i kelvin. */
export function molesFrom(p: number, V: number, T: number): number {
  if (!(T > 0)) return Number.NaN;
  return (p * V) / (R_GAS * T);
}

/** Tilstandslikningen løst for V: V = nRT / p (m³). */
export function volumeFrom(n: number, T: number, p: number): number {
  if (!(p > 0)) return Number.NaN;
  return (n * R_GAS * T) / p;
}

/** Den nøyaktige modellen bak tallene i oppgaven (idealgass med U = (5/2)nRT, utvidelse mot lufttrykket p₀). */
export function exactProcess(task: GasTask): GasSolution['exact'] {
  const T1 = toKelvin(task.t1);
  const T2 = toKelvin(task.t2);
  const p0 = task.p0 * 1e3;
  const V1 = task.V1 * 1e-3;
  const n = molesFrom(p0, V1, T1);
  const Qheat = n * CV_AIR * (T2 - T1);
  const T3 = (n * CV_AIR * T2 + p0 * V1 + task.Qexp) / (n * (CV_AIR + R_GAS));
  const V3 = volumeFrom(n, T3, p0);
  const Wout = p0 * (V3 - V1);
  return { Qheat, Wout, T3, V3, dUexp: n * CV_AIR * (T3 - T2) };
}

/** Løser hele oppgaven for ett tallsett. Alle tall i teksten, utregningen og figuren kommer herfra. */
export function solveGasTask(task: GasTask): GasSolution {
  const exact = exactProcess(task);
  const T1 = toKelvin(task.t1);
  const T2 = toKelvin(task.t2);
  const V1 = task.V1 * 1e-3;
  const p0 = task.p0 * 1e3;

  const n = molesFrom(p0, V1, T1);
  const nCelsius = task.t1 > 0 ? (p0 * V1) / (R_GAS * task.t1) : Number.NaN;

  const p2 = (p0 * T2) / T1;
  const p2Celsius = task.t1 > 0 ? (p0 * task.t2) / task.t1 : Number.NaN;

  const Fgas2 = p2 * PISTON_AREA;
  const Fair = p0 * PISTON_AREA;
  const Fpin = Fgas2 - Fair;

  const Qheat = Math.round(exact.Qheat);
  const Wout = Math.round(exact.Wout);
  const Wexp = -Wout;
  const dUexp = Wexp + task.Qexp;

  const t3 = Math.round((exact.T3 - ZERO_CELSIUS) * 10) / 10;
  const T3 = toKelvin(t3);
  const p3 = p0;
  const V3 = volumeFrom(n, T3, p3);

  return {
    T1,
    T2,
    V1,
    p0,
    n,
    nCelsius,
    p2,
    p2Shown: roundSig(p2 / 1e3, 3),
    p2Celsius,
    Fgas2,
    Fair,
    Fpin,
    Qheat,
    Wheat: 0,
    dUheat: Qheat,
    Wout,
    Wexp,
    Qexp: task.Qexp,
    dUexp,
    t3,
    T3,
    p3,
    V3,
    Fgas3: p3 * PISTON_AREA,
    exact,
  };
}

/* ---------- Geometri til figuren (cm), testet så stempelet holder seg i sylinderen ---------- */

/**
 * Sylinderen: innvendig radius (fra arealet), høyden innvendig fra bunnplata til åpningen, tykkelsen på stempelet og
 * bunnplata, og vannbadet (innvendig radius, høyde og vanndybde). Alt i cm.
 */
export const RIG = {
  r: Math.sqrt((PISTON_AREA * 1e4) / Math.PI),
  wall: 0.5,
  height: 25,
  piston: 2.4,
  base: 1.2,
  bathR: 11.5,
  bathH: 22,
  water: 17.5,
};

/** Høyden på luftsøylen (cm) for et volum i liter: h = V / A. */
export function columnHeight(VLiter: number): number {
  return (VLiter * 1000) / (PISTON_AREA * 1e4);
}
