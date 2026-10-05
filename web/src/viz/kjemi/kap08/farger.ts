/**
 * Farger for kapittel 8: lys med en bestemt bølgelengde, flammefarger og fargede løsninger. Alt blandes fra kit-ets
 * tokens (universalindikatorens regnbuefarger KJEMI.ph og fenolftaleinrosa), så fargene følger lyst og mørkt tema.
 */
import { KJEMI, VIZ, mixColor } from '../kit';
import type { AbsorberId, FlameElement } from './model';

const [RED, ORANGE, YELLOW, GREEN, TEAL, BLUE, VIOLET] = KJEMI.ph as unknown as [string, string, string, string, string, string, string];
const PINK = KJEMI.indicator.fenolftaleinRosa;

/** Regnbuefargene ved disse bølgelengdene (nm); imellom blandes de jevnt. */
const STOPS: [number, string][] = [
  [410, VIOLET],
  [462, BLUE],
  [492, TEAL],
  [528, GREEN],
  [576, YELLOW],
  [603, ORANGE],
  [640, RED],
];

/**
 * Fargen til lys med bølgelengde λ (nm). Mot kantene av det synlige området (under 410 nm og over 690 nm) blir
 * fargen svakere, fordi øyet er lite følsomt der.
 */
export function spectrumColor(nm: number): string {
  const first = STOPS[0]!;
  const last = STOPS[STOPS.length - 1]!;
  if (nm <= first[0]) return mixColor(first[1], VIZ.muted, Math.min(0.7, (first[0] - nm) / 45));
  if (nm >= last[0]) return nm <= 690 ? last[1] : mixColor(last[1], VIZ.muted, Math.min(0.7, (nm - 690) / 80));
  for (let i = 0; i < STOPS.length - 1; i++) {
    const [a, ca] = STOPS[i]!;
    const [b, cb] = STOPS[i + 1]!;
    if (nm <= b) return mixColor(ca, cb, (nm - a) / (b - a));
  }
  return last[1];
}

/** Fargen løsningen har (ved høy konsentrasjon). */
export const SOLUTION_COLOR: Record<AbsorberId, string> = {
  permanganat: mixColor(VIOLET, PINK, 0.45),
  kobberammin: mixColor(BLUE, VIOLET, 0.2),
  jerntiocyanat: mixColor(RED, ORANGE, 0.1),
};

/**
 * Hvor sterk fargen ser ut (0–1) ved en gitt absorbans i et vanlig glass: øyet ser forskjell opp til A ≈ 2.
 */
export function colorStrength(A: number): number {
  return 1 - 10 ** (-0.9 * Math.max(0, A));
}

/** Flammefargen slik den ser ut for øyet. */
export const FLAME_COLOR: Record<FlameElement, string> = {
  Li: mixColor(RED, PINK, 0.35),
  Na: mixColor(YELLOW, ORANGE, 0.3),
  K: mixColor(VIOLET, PINK, 0.35),
  Ca: mixColor(ORANGE, RED, 0.45),
  Sr: RED,
  Ba: mixColor(GREEN, YELLOW, 0.45),
  Cu: mixColor(GREEN, TEAL, 0.45),
};

/** Den blå, nesten fargeløse flammen fra en bunsenbrenner uten salt. */
export const BURNER_FLAME = mixColor(BLUE, VIZ.surface, 0.55);
