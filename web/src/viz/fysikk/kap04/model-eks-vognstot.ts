/**
 * Eksempeloppgaven «Godsvogner som kobles sammen» (k4-eks-vognstot, 4A–4D).
 *
 * På en godsterminal triller vogn A (masse m_A, fart v_A) inn i vogn B (masse m_B, fart v_B) på et rett og vannrett
 * spor. Koblingene låser seg i støtet, så vognene ruller videre sammen: et fullstendig uelastisk støt. Positiv retning
 * er fartsretningen til A, så v_B kan være positiv (B triller samme vei), null (B står i ro) eller negativ (B triller
 * mot A).
 *
 *   Bevegelsesmengden er bevart (ytre krefter G og N er loddrette og opphever hverandre, friksjonen ser vi bort fra):
 *     m_A·v_A + m_B·v_B = (m_A + m_B)·V
 *   Kinetisk energi før og etter:
 *     E_før = ½m_A·v_A² + ½m_B·v_B²,  E_etter = ½(m_A + m_B)·V²
 *     ΔE = E_før − E_etter = ½ · m_A·m_B/(m_A + m_B) · (v_A − v_B)²   (bare den relative farten teller)
 *   Impulsloven på hver vogn (I = Δp):
 *     I_A = m_A(V − v_A) < 0,  I_B = m_B(V − v_B) > 0,  I_A + I_B = 0   (Newtons 3. lov: kraftpar i like lang tid)
 *   Gjennomsnittskraften i støtet (varigheten Δt) og akselerasjonen til hver vogn (Newtons 2. lov):
 *     F = |I|/Δt,  a_A = F/m_A,  a_B = F/m_B
 */
import { G_EARTH } from '../../kit/format';

/** Lasten på en vogn: ingen container, én 20-fots container eller én 40-fots container. Bare til teksten og figuren. */
export type WagonLoad = 'tom' | 'container20' | 'container40';

export interface WagonTask {
  /** Massen til vogn A (kg). */
  mA: number;
  /** Farten til vogn A før støtet (m/s), positiv. */
  vA: number;
  /** Massen til vogn B (kg). */
  mB: number;
  /** Farten til vogn B før støtet (m/s), med fortegn: positiv i samme retning som A, negativ mot A. */
  vB: number;
  /** Hvor lenge støtet varer (s), fra bufferne møtes til vognene har felles fart. */
  dt: number;
  /** Lasten på vognene (teksten og figuren). */
  loadA: WagonLoad;
  loadB: WagonLoad;
}

/**
 * Tre tallsett med toakslede containervogner (egenvekt 12–14 t, en full 40-fots container gir 34–40 t). Farten er
 * vanlig ved skifting (1,5–2,0 m/s, 5–7 km/h). I tallsett 1 står B i ro, i tallsett 2 triller B sakte samme vei, og i
 * tallsett 3 triller B mot A, så fortegnet til v_B betyr noe. «Om lag»-farten i a) ligger ikke nær grensen mellom to
 * avrundinger (testet).
 */
export const WAGON_TASKS: WagonTask[] = [
  { mA: 38_000, vA: 1.5, mB: 13_000, vB: 0, dt: 0.3, loadA: 'container40', loadB: 'tom' },
  { mA: 34_000, vA: 2.0, mB: 20_000, vB: 0.6, dt: 0.32, loadA: 'container40', loadB: 'container20' },
  { mA: 40_000, vA: 1.6, mB: 14_000, vB: -0.8, dt: 0.4, loadA: 'container40', loadB: 'tom' },
];

export interface WagonSolution {
  /** Den samlede massen m_A + m_B (kg). */
  M: number;
  /** Bevegelsesmengden til A og B før støtet og summen (kg·m/s), med fortegn. */
  pA: number;
  pB: number;
  p: number;
  /** Felles fart like etter støtet (m/s): V = p/(m_A + m_B). */
  V: number;
  /** V avrundet til to gjeldende siffer, til «Vis at …» i a). */
  VShown: number;
  /** Kinetisk energi til A og B før støtet (J). */
  EkA: number;
  EkB: number;
  /** Kinetisk energi før og etter støtet (J). */
  EkBefore: number;
  EkAfter: number;
  /** Kinetisk energi som blir omdannet til andre energiformer i støtet (J). */
  lost: number;
  /** Andelen som blir omdannet: lost / EkBefore. */
  lossShare: number;
  /** Den relative farten v_A − v_B før støtet (m/s), positiv når A tar igjen B. */
  u: number;
  /** Den «reduserte massen» m_A·m_B/(m_A + m_B) (kg): ΔE = ½ · mu · u². */
  mu: number;
  /** Den gale farten fra bevaring av kinetisk energi, ½m_A·v_A² + ½m_B·v_B² = ½(m_A + m_B)V² (m/s). For stor. */
  vEnergyWrong: number;
  /** Den gale farten når fortegnet til v_B glemmes (m/s). Lik V når v_B ≥ 0. */
  vSignWrong: number;
  /** Endringen i farten til A og B i støtet (m/s): V − v_A (negativ) og V − v_B (positiv). */
  dvA: number;
  dvB: number;
  /** Impulsen på A og B i støtet (N·s), med fortegn: I = Δp. */
  IA: number;
  IB: number;
  /** Gjennomsnittskraften mellom vognene i støtet (N): |I|/Δt. */
  F: number;
  /** Gjennomsnittsakselerasjonen til A og B i støtet (m/s²), størrelsen: F/m. */
  aA: number;
  aB: number;
  /** Tyngden til A og B (N). Bare til figuren (G og N i a). */
  GA: number;
  GB: number;
}

/** Avrunder til `sig` gjeldende siffer: 1,4815 → 1,5 (sig = 2). */
export function roundSig(x: number, sig: number): number {
  if (!Number.isFinite(x) || x === 0) return x;
  const e = Math.floor(Math.log10(Math.abs(x))) - sig + 1;
  const f = 10 ** e;
  return Math.round(x / f) * f;
}

/** Hvor mange desimaler `roundSig(x, sig)` har (0 for 48 000, 2 for 0,98). Til fmt(). */
export function sigDecimals(x: number, sig: number): number {
  if (!Number.isFinite(x) || x === 0) return 0;
  return Math.max(0, sig - 1 - Math.floor(Math.log10(Math.abs(x))));
}

/** Løser hele oppgaven for ett tallsett. Alle tall i teksten, utregningen og figuren kommer herfra. */
export function solveWagonTask({ mA, vA, mB, vB, dt }: WagonTask, g = G_EARTH): WagonSolution {
  const M = mA + mB;
  const pA = mA * vA;
  const pB = mB * vB;
  const p = pA + pB;
  const V = M > 0 ? p / M : 0;
  const EkA = 0.5 * mA * vA * vA;
  const EkB = 0.5 * mB * vB * vB;
  const EkBefore = EkA + EkB;
  const EkAfter = 0.5 * M * V * V;
  const lost = EkBefore - EkAfter;
  const lossShare = EkBefore > 0 ? lost / EkBefore : 0;
  const u = vA - vB;
  const mu = M > 0 ? (mA * mB) / M : 0;
  const vEnergyWrong = M > 0 ? Math.sqrt((2 * EkBefore) / M) : 0;
  const vSignWrong = M > 0 ? (pA + mB * Math.abs(vB)) / M : 0;
  const dvA = V - vA;
  const dvB = V - vB;
  const IA = mA * dvA;
  const IB = mB * dvB;
  const F = dt > 0 ? Math.abs(IB) / dt : 0;
  return {
    M,
    pA,
    pB,
    p,
    V,
    VShown: roundSig(V, 2),
    EkA,
    EkB,
    EkBefore,
    EkAfter,
    lost,
    lossShare,
    u,
    mu,
    vEnergyWrong,
    vSignWrong,
    dvA,
    dvB,
    IA,
    IB,
    F,
    aA: mA > 0 ? F / mA : 0,
    aB: mB > 0 ? F / mB : 0,
    GA: mA * g,
    GB: mB * g,
  };
}

/**
 * Kraften mellom vognene ved tiden t i støtet (N), som en halv sinusbølge fra 0 til Δt (til F-t-grafen i e). Toppen
 * er π/2 · F, så arealet under grafen er F · Δt = |I|, akkurat som med gjennomsnittskraften.
 */
export function pulseForce(t: number, F: number, dt: number): number {
  if (!(dt > 0) || t <= 0 || t >= dt) return 0;
  return (Math.PI / 2) * F * Math.sin((Math.PI * t) / dt);
}

/** Den største kraften i støtet (N) med formen i `pulseForce`. */
export function peakForce(F: number): number {
  return (Math.PI / 2) * F;
}
