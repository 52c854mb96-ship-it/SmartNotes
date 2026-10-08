/**
 * Ren fysikk for eksempeloppgaven «Hydrogen i en stjernetåke» (7B, 7C): energinivåene i Bohrs modell for hydrogen,
 * fotonet ved en overgang, bølgelengden og fargen, og ioniseringsenergien fra grunntilstanden og fra et eksitert nivå.
 *
 * Tallene i oppgaveteksten, utregningen og svaret kommer alle fra solveHydrogenTask, så de stemmer med hverandre.
 * Konstantene er de i ERGO Fysikk 1.
 */

/** Konstanten i Bohrs formel for hydrogen: E_n = −B/n² (J). */
export const B_HYDROGEN = 2.18e-18;
/** Plancks konstant (J s). */
export const H_PLANCK = 6.63e-34;
/** Lysfarten i vakuum (m/s). */
export const C_LIGHT = 3.0e8;
/** Elementærladningen (C): 1 eV = 1,60 · 10⁻¹⁹ J. */
export const J_PER_EV = 1.6e-19;
/** Grensene for synlig lys (nm), de samme som i spektrene i kapittelet. */
export const VISIBLE_MIN = 380;
export const VISIBLE_MAX = 750;

/** Ett tallsett: elektronet går fra nivå `upper` ned til nivå `lower`. */
export interface HydrogenTask {
  upper: number;
  lower: number;
}

/**
 * Tallsettene: Hα (3 → 2, rødt), Hβ (4 → 2, blågrønt) og Paschen α (4 → 3, infrarødt). Det siste viser at ikke alle
 * overganger gir synlig lys, og at også infrarødt lys kan ionisere et atom i nivå 3.
 */
export const HYDROGEN_TASKS: readonly HydrogenTask[] = [
  { upper: 3, lower: 2 },
  { upper: 4, lower: 2 },
  { upper: 4, lower: 3 },
];

/** Energien til hydrogenatomet i nivå n (J): E_n = −B/n². n = ∞ (fritt elektron) gir 0. */
export function levelEnergy(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return -B_HYDROGEN / (n * n);
}

/** Bølgelengden (m) til et foton med energi E (J): E = hf = hc/λ. */
export function wavelengthFromEnergy(E: number): number {
  return (H_PLANCK * C_LIGHT) / E;
}

export type Region = 'uv' | 'synlig' | 'ir';

/** Hvilken del av spekteret bølgelengden (nm) hører til. */
export function regionOf(nm: number): Region {
  if (nm < VISIBLE_MIN) return 'uv';
  if (nm > VISIBLE_MAX) return 'ir';
  return 'synlig';
}

export const REGION_TEXT: Record<Region, string> = { uv: 'ultrafiolett', synlig: 'synlig lys', ir: 'infrarødt' };

/**
 * Navnet på fargen til synlig lys (nm), med de samme grensene som spektrene i kapittelet: 657 nm rød, 487 nm blågrønn,
 * 434 nm blåfiolett. Utenfor det synlige området: null.
 */
export function colorNameOf(nm: number): string | null {
  if (!(nm >= VISIBLE_MIN && nm <= VISIBLE_MAX)) return null;
  if (nm < 425) return 'fiolett';
  if (nm < 450) return 'blåfiolett';
  if (nm < 485) return 'blå';
  if (nm < 500) return 'blågrønn';
  if (nm < 565) return 'grønn';
  if (nm < 590) return 'gul';
  if (nm < 625) return 'oransje';
  return 'rød';
}

/** Ionisering fra nivå n: energien som må tilføres, og den største bølgelengden et foton kan ha og likevel klare det. */
export interface Ionization {
  n: number;
  /** Ioniseringsenergien (J), positiv: 0 − E_n. */
  E: number;
  eV: number;
  /** Største bølgelengde (nm) for et foton som kan ionisere atomet: λ = hc/E. */
  maxNm: number;
  region: Region;
}

export function ionization(n: number): Ionization {
  const E = levelEnergy(Infinity) - levelEnergy(n);
  const maxNm = wavelengthFromEnergy(E) * 1e9;
  return { n, E, eV: E / J_PER_EV, maxNm, region: regionOf(maxNm) };
}

export interface HydrogenSolution {
  task: HydrogenTask;
  /** Nivåene oppgaven spør etter i a): 1, det nederste og det øverste nivået i overgangen (stigende, uten dubletter). */
  asked: number[];
  /** Energien til grunntilstanden, det nederste og det øverste nivået (J, negative). */
  E1: number;
  Elower: number;
  Eupper: number;
  /** Fotonet: energi (J og eV), frekvens (Hz), bølgelengde (m og nm). */
  photon: { E: number; eV: number; f: number; lambda: number; nm: number };
  region: Region;
  /** Fargen når lyset er synlig, ellers null. */
  color: string | null;
  /** Ionisering fra grunntilstanden (d) og fra det nederste nivået i overgangen (e). */
  ionGround: Ionization;
  ionLower: Ionization;
}

export function solveHydrogenTask(task: HydrogenTask): HydrogenSolution {
  const { upper, lower } = task;
  const E1 = levelEnergy(1);
  const Elower = levelEnergy(lower);
  const Eupper = levelEnergy(upper);
  // Energibevaring: atomet mister E_øvre − E_nedre, og fotonet tar med seg nettopp den energien.
  const E = Eupper - Elower;
  const f = E / H_PLANCK;
  const lambda = wavelengthFromEnergy(E);
  const nm = lambda * 1e9;
  const asked = [...new Set([1, lower, upper])].sort((a, b) => a - b);
  return {
    task,
    asked,
    E1,
    Elower,
    Eupper,
    photon: { E, eV: E / J_PER_EV, f, lambda, nm },
    region: regionOf(nm),
    color: colorNameOf(nm),
    ionGround: ionization(1),
    ionLower: ionization(lower),
  };
}
