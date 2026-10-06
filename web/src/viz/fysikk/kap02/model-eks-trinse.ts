/**
 * Eksempeloppgaven «Vogn trukket av et lodd over en trinse» (k2-eks-trinse, 2B–2E).
 *
 * En vogn med masse m₁ står på et vannrett labbord. En snor fra vogna går over en trinse på bordkanten ned til et
 * lodd med masse m₂, som henger h over gulvet når vogna slippes. Snora og trinsa er masseløse, og snora strekkes
 * ikke, så vogna og loddet har like stor akselerasjon og fart, og snordraget S er like stort i begge ender.
 *
 *   Hele systemet (positiv retning langs snora):  G₂ = (m₁ + m₂) · a          ⇒ a = m₂g / (m₁ + m₂)
 *   Vogna alene:                                  S = m₁ · a
 *   Loddet alene:                                 G₂ − S = m₂ · a            ⇒ S = m₂(g − a) < G₂
 *   Fart når loddet treffer gulvet:               v² = 2ah
 *
 * Med friksjon (vogna byttes med en trekloss med samme masse og glidefriksjonstall μ):
 *   R = μ · N = μ · m₁g,  a = (G₂ − R) / (m₁ + m₂),  S = m₂(g − a) = m₁a + R
 */
import { G_EARTH } from '../../kit/format';

export interface PulleyTask {
  /** Massen til vogna med ekstralodd (kg). Treklossen i e) har samme masse. */
  m1: number;
  /** Massen til loddet (kg). */
  m2: number;
  /** Høyden fra bunnen av loddet til gulvet når vogna slippes (m). Vogna ruller like langt før loddet lander. */
  h: number;
  /** Glidefriksjonstallet mellom treklossen og bordet (deloppgave e). */
  muK: number;
  /** Antall ekstralodd (stålstenger) oppå vogna i figuren (0–3). Bare til tegningen. */
  bars: number;
}

/**
 * Tre tallsett. Forholdet m₂/(m₁ + m₂) er mellom 0,29 og 0,38, så snordraget blir minst en tredjedel av tyngden til
 * vogna (pila S er da lang nok til å se ved siden av G₁ og N), og akselerasjonen blir 2,9–3,7 m/s² som i et
 * vanlig labforsøk med lett vogn.
 */
export const PULLEY_TASKS: PulleyTask[] = [
  { m1: 0.4, m2: 0.2, h: 0.45, muK: 0.2, bars: 1 },
  { m1: 0.6, m2: 0.25, h: 0.5, muK: 0.2, bars: 2 },
  { m1: 0.25, m2: 0.15, h: 0.35, muK: 0.3, bars: 0 },
];

export interface PulleySolution {
  /** Tyngden til vogna G₁ = m₁g (N). */
  G1: number;
  /** Tyngden til loddet G₂ = m₂g (N). */
  G2: number;
  /** Normalkraften fra bordet på vogna (N). Bordet er vannrett, og ingen andre krefter virker loddrett: N = G₁. */
  N: number;
  /** Akselerasjonen uten friksjon (m/s²), lik for vogna og loddet. */
  a: number;
  /** Snordraget uten friksjon (N): S = m₁a = m₂(g − a). */
  S: number;
  /** Kraftsummen på loddet uten friksjon, G₂ − S = m₂a (N), nedover. */
  netLodd: number;
  /** Snordraget som andel av tyngden til loddet: S/G₂ = m₁/(m₁ + m₂) (alltid under 1). */
  ratioS: number;
  /** Farten til vogna (og loddet) når loddet treffer gulvet, uten friksjon (m/s). */
  v: number;
  /** Tiden fra start til loddet treffer gulvet, uten friksjon (s). */
  t: number;
  /** Om treklossen glir når den slippes (G₂ er større enn glidefriksjonen μm₁g). */
  slides: boolean;
  /** Friksjonen på treklossen (N): μ · N = μm₁g når den glir, ellers lik G₂ (klossen ligger i ro). */
  R: number;
  /** Akselerasjonen med treklossen (m/s²); 0 hvis den ikke glir. */
  aF: number;
  /** Snordraget med treklossen (N): m₂(g − a). */
  SF: number;
  /** Farten når loddet treffer gulvet med treklossen (m/s). */
  vF: number;
}

/** Løser hele oppgaven for ett tallsett. Alle tall i teksten, utregningen og figuren kommer herfra. */
export function solvePulleyTask({ m1, m2, h, muK }: PulleyTask, g = G_EARTH): PulleySolution {
  const G1 = m1 * g;
  const G2 = m2 * g;
  const N = G1;
  const M = m1 + m2;
  const a = M > 0 ? G2 / M : 0;
  const S = m1 * a;
  const netLodd = G2 - S;
  const ratioS = M > 0 ? m1 / M : 0;
  const v = Math.sqrt(2 * a * Math.max(0, h));
  const t = a > 0 ? v / a : 0;

  const Rk = muK * N;
  const slides = G2 > Rk;
  const R = slides ? Rk : G2;
  const aF = slides && M > 0 ? (G2 - Rk) / M : 0;
  const SF = m2 * (g - aF);
  const vF = Math.sqrt(2 * aF * Math.max(0, h));
  return { G1, G2, N, a, S, netLodd, ratioS, v, t, slides, R, aF, SF, vF };
}
