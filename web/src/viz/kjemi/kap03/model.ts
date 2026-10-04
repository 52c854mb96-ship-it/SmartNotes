/** Ren kjemi for kapittel 3 Støkiometri (ingen React), så den kan testes for seg. */
import { fmt, fmtSci } from '../../kit/format';
import { atomCount, molarMass, type ParsedFormula } from '../kit/formel';
import { getElement, isMetal } from '../kit/grunnstoffer';

/** Avogadros tall N_A (per mol), med fire gjeldende siffer som i lærebøkene. */
export const N_A = 6.022e23;

/* ---------- Mol-brua: m = n · M, N = n · N_A, c = n / V ---------- */

export interface Substance {
  id: string;
  /** Norsk navn, små bokstaver. */
  name: string;
  formula: string;
  /** Løselighet i vann ved 25 °C, omtrent (gram per liter vann). Mangler for vann selv. */
  solubility?: number;
  /** Ioner stoffet deler seg i når det løses (for partikkelbildet), f.eks. NaCl → Na⁺ og Cl⁻. */
  ions?: { formula: string; count: number }[];
}

export const SUBSTANCES: Substance[] = [
  { id: 'vann', name: 'vann', formula: 'H2O' },
  { id: 'karbondioksid', name: 'karbondioksid', formula: 'CO2', solubility: 1.45 },
  {
    id: 'natriumklorid',
    name: 'natriumklorid',
    formula: 'NaCl',
    solubility: 360,
    ions: [
      { formula: 'Na^+', count: 1 },
      { formula: 'Cl^-', count: 1 },
    ],
  },
  { id: 'glukose', name: 'glukose', formula: 'C6H12O6', solubility: 909 },
  {
    id: 'kalsiumkarbonat',
    name: 'kalsiumkarbonat',
    formula: 'CaCO3',
    solubility: 0.013,
    ions: [
      { formula: 'Ca^2+', count: 1 },
      { formula: 'CO3^2-', count: 1 },
    ],
  },
];

export type Known = 'm' | 'n' | 'N';

export interface Amounts {
  /** Molar masse (g/mol). */
  M: number;
  /** Masse (g). */
  m: number;
  /** Stoffmengde (mol). */
  n: number;
  /** Antall partikler (molekyler, formelenheter, atomer eller ioner). */
  N: number;
  /** Antall atomer til sammen (N · atomer per formelenhet). */
  atoms: number;
}

/**
 * Regner ut de andre størrelsene fra den du kjenner: m = n · M og N = n · N_A.
 * `value` er i g (m), mol (n) eller et antall (N).
 */
export function amounts(f: ParsedFormula, known: Known, value: number): Amounts {
  const M = molarMass(f);
  const n = known === 'm' ? value / M : known === 'n' ? value : value / N_A;
  return { M, m: n * M, n, N: n * N_A, atoms: n * N_A * atomCount(f) };
}

/** Konsentrasjon c = n / V (mol/L), V i liter. */
export function concentration(n: number, V: number): number {
  return n / V;
}

/** Hva partiklene heter: ioner, atomer, formelenheter (ioniske stoffer) eller molekyler. */
export function particleWord(f: ParsedFormula): string {
  if (f.charge !== 0) return 'ioner';
  const syms = Object.keys(f.atoms);
  if (syms.length === 1 && f.atoms[syms[0]!] === 1) return 'atomer';
  if (syms.some((s) => isMetal(getElement(s)!))) return 'formelenheter';
  return 'molekyler';
}

/** Hvor mye som løses: dissolved er massen i løsningen (g), excess blir liggende som bunnfall (g). */
export function dissolve(m: number, V: number, solubility: number | undefined): { dissolved: number; excess: number; saturated: boolean } {
  if (solubility === undefined) return { dissolved: m, excess: 0, saturated: false };
  const max = solubility * V;
  return m > max ? { dissolved: max, excess: m - max, saturated: true } : { dissolved: m, excess: 0, saturated: false };
}

/* ---------- Glidebrytere med «pene» verdier ---------- */

const STEPS = [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8];

/** Pene verdier fra 10^lo til 10^hi (begge med): 1; 1,2; 1,5; 2; 2,5; 3; 4; 5; 6; 8 i hver dekade. */
export function ladder(lo: number, hi: number): number[] {
  const out: number[] = [];
  for (let e = lo; e < hi; e++) for (const s of STEPS) out.push(Number((s * 10 ** e).toPrecision(3)));
  out.push(Number((10 ** hi).toPrecision(3)));
  return out;
}

/** Indeksen til verdien i lista som ligger nærmest `v` (på logaritmisk skala). */
export function nearestIndex(values: readonly number[], v: number): number {
  if (!(v > 0)) return 0;
  let best = 0;
  let bestD = Infinity;
  values.forEach((x, i) => {
    const d = Math.abs(Math.log(x) - Math.log(v));
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  });
  return best;
}

/** Verdiområdene for den kjente størrelsen: masse 0,01 g–1 kg, stoffmengde 0,001–100 mol, antall 10²⁰–10²⁶. */
export const LADDERS: Record<Known, number[]> = {
  m: ladder(-2, 3),
  n: ladder(-3, 2),
  N: ladder(20, 26),
};

/* ---------- Tallformat ---------- */

/** Tall med `sig` gjeldende siffer, på standardform når det er veldig stort eller lite: 0,555; 18,0; 3,34 · 10²³. */
export function fmtSig(v: number, sig = 3): string {
  if (!Number.isFinite(v)) return '–';
  if (v === 0) return '0';
  const exp = Math.floor(Math.log10(Math.abs(v)));
  if (exp < -3 || exp >= 6) return fmtSci(v, sig - 1);
  return fmt(v, Math.max(0, sig - 1 - exp));
}

/* ---------- Hvor stort er N_A? ---------- */

export interface Landmark {
  label: string;
  /** Verdi (eller midten av et område). */
  value: number;
  /** Område når tallet er usikkert (min, max). */
  range?: [number, number];
}

/** Sammenligninger, sortert etter størrelse. Grove anslag er merket med «ca.». */
export const LANDMARKS: Landmark[] = [
  { label: 'Mennesker på jorda', value: 8.1e9 },
  { label: 'Stjerner i Melkeveien, ca.', value: 2e11, range: [1e11, 4e11] },
  { label: 'Celler i et menneske, ca.', value: 3.7e13 },
  { label: 'Sekunder siden big bang', value: 13.8e9 * 365.25 * 24 * 3600 },
  { label: 'Sandkorn på alle strender, ca.', value: 7.5e18 },
  { label: 'Vannmolekyler i én dråpe (0,05 mL)', value: (0.05 / 18.02) * N_A },
  { label: 'Stjerner i universet, ca.', value: 1e23, range: [1e22, 1e24] },
];

/** Universets alder i år. */
export const UNIVERSE_AGE_YEARS = 13.8e9;
const SECONDS_PER_YEAR = 365.25 * 24 * 3600;

/** År det tar å telle N partikler med én i sekundet. */
export function countingYears(N: number): number {
  return N / SECONDS_PER_YEAR;
}
