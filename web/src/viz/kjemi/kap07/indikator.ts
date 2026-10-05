/**
 * Indikatorfarger for kapittel 7. Fargene blandes fra kit-ets tokens (KJEMI.ph, KJEMI.indicator), så de virker i både
 * lyst og mørkt tema. Omslagsområdene står i model.ts (INDICATORS).
 */
import { KJEMI, btbColor, mixColor, phColor, phenolphthaleinColor } from '../kit';
import { INDICATORS, indicatorShift, type IndicatorId } from './model';

const RED = KJEMI.ph[0]!;
const ORANGE = KJEMI.ph[1]!;
const YELLOW = KJEMI.ph[2]!;
const BLUE = KJEMI.ph[5]!;
const VIOLET = KJEMI.ph[6]!;

/** Fargen til indikatoren ved en pH (gradvis overgang gjennom omslagsområdet). */
export function indicatorColor(id: IndicatorId | 'universal', pH: number): string {
  if (id === 'universal') return phColor(pH);
  if (id === 'bromtymolblatt') return btbColor(pH);
  if (id === 'fenolftalein') return phenolphthaleinColor(pH);
  const t = indicatorShift(INDICATORS[id], pH);
  if (id === 'lakmus') return t < 0.5 ? mixColor(RED, VIOLET, t * 2) : mixColor(VIOLET, BLUE, (t - 0.5) * 2);
  // Metyloransje og metylrødt: rød → oransje → gul
  return t < 0.5 ? mixColor(RED, ORANGE, t * 2) : mixColor(ORANGE, YELLOW, (t - 0.5) * 2);
}

/** Væskefarge i et glass med indikator: litt lysere enn selve indikatorfargen, så partikler og menisk synes. */
export function liquidWithIndicator(id: IndicatorId | 'universal', pH: number, strength = 0.75): string {
  return mixColor(KJEMI.liquid, indicatorColor(id, pH), strength);
}
