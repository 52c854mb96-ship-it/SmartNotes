/**
 * Kroppsstillingen til fallskjermhopperen i «Fall med luftmotstand» (k2-luftmotstand), styrt av luftmotstandstallet k:
 * hodet først (0,12 kg/m), magen ned (0,25 kg/m), armer og bein ut (ca. 0,4 kg/m) og vingedrakt (fra ca. 0,6 til 1 kg/m).
 * Ren geometri uten React (testes i luftmotstand-positur.test.ts); tegningen er i luftmotstand-scene.tsx.
 */
import { POSER, type Leddvinkler } from '../../kit/scene/figurer-skjelett';

type Ledd = Leddvinkler;
const LEDD_KEYS = Object.keys(POSER.falle) as (keyof Ledd)[];

/** Hodet først: kroppen nesten loddrett med hodet ned, strake bein samlet og armene inntil kroppen. Minst areal mot lufta. */
const HODET_FORST: Ledd = {
  rygg: 0,
  nakke: -20,
  venstreSkulder: 16,
  hoyreSkulder: 8,
  venstreAlbue: 14,
  hoyreAlbue: 10,
  venstreHofte: 3,
  hoyreHofte: -3,
  venstreKne: 4,
  hoyreKne: 9,
  venstreAnkel: 32,
  hoyreAnkel: 28,
};
/** Armer og bein spredt så mye som mulig, med svai i ryggen. Størst areal uten vingedrakt. */
const SPREDT: Ledd = {
  rygg: -18,
  nakke: -32,
  venstreSkulder: 150,
  hoyreSkulder: 164,
  venstreAlbue: 24,
  hoyreAlbue: 30,
  venstreHofte: 12,
  hoyreHofte: -4,
  venstreKne: 26,
  hoyreKne: 36,
  venstreAnkel: 30,
  hoyreAnkel: 24,
};

const smooth = (e0: number, e1: number, v: number) => {
  const t = Math.min(1, Math.max(0, (v - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
function blend(a: Ledd, b: Ledd, t: number): Ledd {
  const out = { ...a };
  for (const key of LEDD_KEYS) out[key] = lerp(a[key], b[key], t);
  return out;
}

export interface Posture {
  /** Dreiningen om tyngdepunktet: 90 = magen ned (hodet mot høyre), 180 = hodet rett ned. */
  rotate: number;
  ledd: Ledd;
  /** 0 = hodet først, 1 = magen ned (og videre). */
  belly: number;
  /** 0 = magen ned, 1 = armer og bein spredt så mye som mulig. */
  spread: number;
  /** 0–1: hvor mye vingedrakt (stoff mellom armer og kropp og mellom beina). */
  wings: number;
  /** Kort navn til etiketten i scenen. */
  name: string;
}

/**
 * Kroppsstillingen for et luftmotstandstall k: hodet først (0,12), magen ned (0,25), armer og bein spredt (ca. 0,4) og
 * vingedrakt (fra ca. 0,6 til 1). Med 80 kg gir det terminalfart på ca. 290, 200, 160 og 100 km/h.
 */
export function posture(k: number): Posture {
  const belly = smooth(0.12, 0.25, k);
  const spread = smooth(0.25, 0.42, k);
  const wings = smooth(0.45, 0.8, k);
  const ledd = spread > 0 ? blend(POSER.falle, SPREDT, spread) : blend(HODET_FORST, POSER.falle, belly);
  const rotate = lerp(174, 90, belly);
  const name = k < 0.165 ? 'Hodet først' : k < 0.215 ? 'Stuper skrått' : k < 0.33 ? 'Magen ned' : k < 0.6 ? 'Armer og bein ut' : 'Vingedrakt';
  return { rotate, ledd, belly, spread, wings, name };
}

/** Knappene for kjente kroppsstillinger før skjermen løses ut, og luftmotstandstallet de gir (for en hopper på ca. 80 kg). */
export const POSTURE_PRESETS = [
  { value: 'hode', label: 'Hodet først', k: 0.12 },
  { value: 'mage', label: 'Magen ned', k: 0.25 },
  { value: 'vinge', label: 'Vingedrakt', k: 1 },
] as const;
export type PosturePreset = (typeof POSTURE_PRESETS)[number]['value'];
