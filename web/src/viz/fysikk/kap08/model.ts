/** Ren fysikk for kapittel 8 Kjernefysikk (ingen React), så den kan testes for seg. */
import { nuclideText } from '../kap07/elements';
import { seededRandom } from '../kap07/random';

/* ---------- Konstanter med verdiene i ERGO Fysikk 1 ---------- */

/** Atommasseenheten (kg). */
export const U_KG = 1.66e-27;
/** Lysfarten (m/s). */
export const C_LIGHT = 3.0e8;
/** 1 MeV i joule (1 eV = 1,60 · 10⁻¹⁹ J). */
export const MEV = 1.6e-13;
/** Masser i u: nøytron, hydrogenatom (¹H) og elektron. */
export const M_NEUTRON_U = 1.008665;
export const M_H1_U = 1.007825;
export const M_ELECTRON_U = 0.000549;
/** Ett år og ett døgn i sekunder. */
export const YEAR_S = 365.25 * 24 * 3600;
export const DAY_S = 24 * 3600;

/** Energien (J) som svarer til massen m (u): E = mc². */
export function massEnergyJ(mU: number): number {
  return mU * U_KG * C_LIGHT * C_LIGHT;
}

/** Energien (MeV) som svarer til massen m (u). Med verdiene over er 1 u ≈ 934 MeV. */
export function massEnergyMeV(mU: number): number {
  return massEnergyJ(mU) / MEV;
}

/* ---------- Nuklidetabell ---------- */

export type DecayType = 'alfa' | 'beta-' | 'beta+' | 'gamma';

export interface Nuclide {
  Z: number;
  A: number;
  /** Atommasse (u), fra atommassetabellen (AME 2020). */
  mass: number;
  /** Halveringstid som tekst, eller null for stabile kjerner. */
  halfLife: string | null;
  /** Vanlig henfallstype (udefinert for stabile kjerner). */
  mode?: DecayType;
  /** Datterkjernen dannes i en eksitert tilstand med denne energien (MeV), og sender så ut γ-stråling. */
  daughterExcitation?: number;
  /** Merknad om henfallet. */
  note?: string;
}

const nuc = (
  Z: number,
  A: number,
  mass: number,
  halfLife: string | null = null,
  mode?: DecayType,
  extra: Partial<Nuclide> = {},
): Nuclide => ({
  Z,
  A,
  mass,
  halfLife,
  mode,
  ...extra,
});

/** Atommasser (u) og henfall for kjernene som brukes i kapittel 8. */
export const NUCLIDES: Nuclide[] = [
  nuc(1, 1, 1.007825),
  nuc(1, 2, 2.014102),
  nuc(1, 3, 3.016049, '12,3 år', 'beta-'),
  nuc(2, 3, 3.016029),
  nuc(2, 4, 4.002603),
  nuc(3, 6, 6.015123),
  nuc(3, 7, 7.016003),
  nuc(4, 9, 9.012183),
  nuc(5, 11, 11.009305),
  nuc(6, 11, 11.011434, '20,4 min', 'beta+'),
  nuc(6, 12, 12.0),
  nuc(6, 14, 14.003242, '5730 år', 'beta-'),
  nuc(7, 14, 14.003074),
  nuc(8, 16, 15.994915),
  nuc(8, 18, 17.99916),
  nuc(9, 18, 18.000937, '110 min', 'beta+'),
  nuc(9, 19, 18.998403),
  nuc(10, 20, 19.99244),
  nuc(10, 22, 21.991385),
  // ²²Na gir nesten alltid ²²Ne* (1,275 MeV), som straks sender ut et γ-foton
  nuc(11, 22, 21.994437, '2,60 år', 'beta+', { daughterExcitation: 1.275 }),
  nuc(11, 23, 22.989769),
  nuc(12, 24, 23.985042),
  nuc(13, 27, 26.981538),
  nuc(14, 28, 27.976927),
  nuc(16, 32, 31.972071),
  nuc(18, 40, 39.962383),
  nuc(19, 40, 39.963998, '1,25 · 10⁹ år', 'beta-', { note: '89 % av henfallene er β⁻, resten gir ⁴⁰Ar' }),
  nuc(20, 40, 39.962591),
  nuc(24, 52, 51.940506),
  nuc(26, 56, 55.934936),
  nuc(27, 60, 59.933816, '5,27 år', 'beta-', { daughterExcitation: 2.505 }),
  nuc(28, 60, 59.930786),
  nuc(28, 62, 61.928345),
  nuc(36, 84, 83.911498),
  nuc(36, 92, 91.926173, '1,84 s', 'beta-'),
  nuc(40, 90, 89.904697),
  nuc(47, 107, 106.905092),
  nuc(50, 120, 119.902202),
  nuc(53, 131, 130.906126, '8,02 døgn', 'beta-'),
  nuc(54, 131, 130.905084),
  nuc(55, 137, 136.907089, '30,1 år', 'beta-', { daughterExcitation: 0.662 }),
  nuc(56, 137, 136.905827),
  nuc(56, 138, 137.905247),
  nuc(56, 141, 140.914403, '18,3 min', 'beta-'),
  nuc(79, 197, 196.96657),
  nuc(82, 206, 205.974465),
  nuc(82, 208, 207.976652),
  // Uranserien: ²³⁸U → … → ²⁰⁶Pb
  nuc(92, 238, 238.050788, '4,47 · 10⁹ år', 'alfa'),
  nuc(90, 234, 234.043601, '24,1 døgn', 'beta-'),
  // ²³⁴Pa dannes nesten alltid i den metastabile tilstanden ²³⁴ᵐPa (1,17 min). Massen er for grunntilstanden.
  nuc(91, 234, 234.043308, '1,17 min', 'beta-'),
  nuc(92, 234, 234.040952, '2,45 · 10⁵ år', 'alfa'),
  nuc(90, 230, 230.033134, '7,54 · 10⁴ år', 'alfa'),
  nuc(88, 226, 226.02541, '1600 år', 'alfa'),
  nuc(86, 222, 222.017578, '3,82 døgn', 'alfa'),
  nuc(84, 218, 218.008973, '3,10 min', 'alfa'),
  nuc(82, 214, 213.999805, '26,8 min', 'beta-'),
  nuc(83, 214, 213.998712, '19,9 min', 'beta-'),
  nuc(84, 214, 213.995201, '164 µs', 'alfa'),
  nuc(82, 210, 209.984189, '22,2 år', 'beta-'),
  nuc(83, 210, 209.98412, '5,01 døgn', 'beta-'),
  nuc(84, 210, 209.982874, '138 døgn', 'alfa'),
  // Americium fra røykvarslere og videre nedover
  nuc(95, 241, 241.056829, '432 år', 'alfa'),
  nuc(93, 237, 237.048174, '2,14 · 10⁶ år', 'alfa'),
  nuc(91, 233, 233.040247, '27,0 døgn', 'beta-'),
  nuc(92, 233, 233.039635, '1,59 · 10⁵ år', 'alfa'),
  nuc(90, 229, 229.031762, '7880 år', 'alfa'),
  nuc(88, 225, 225.023612, '14,9 døgn', 'beta-'),
  nuc(89, 225, 225.02323, '9,92 døgn', 'alfa'),
  nuc(87, 221, 221.014255, '4,8 min', 'alfa'),
  nuc(85, 217, 217.004719, '32 ms', 'alfa'),
  nuc(83, 213, 212.994385, '45,6 min', 'beta-'),
  nuc(84, 213, 212.992857, '3,7 µs', 'alfa'),
  nuc(82, 209, 208.98109, '3,25 timer', 'beta-'),
  // ²⁰⁹Bi er så vidt radioaktiv, med en halveringstid mye lengre enn universets alder
  nuc(83, 209, 208.980399, '2,0 · 10¹⁹ år', 'alfa'),
  nuc(81, 205, 204.974428),
  // Til fisjon
  nuc(94, 239, 239.052163, '2,41 · 10⁴ år', 'alfa'),
  nuc(92, 235, 235.04393, '7,04 · 10⁸ år', 'alfa'),
  nuc(90, 231, 231.036304, '25,5 timer', 'beta-'),
  nuc(91, 231, 231.035884, '3,28 · 10⁴ år', 'alfa'),
  // Datterkjernene når du velger et annet henfall enn det naturlige for startkjernene (så Q kan regnes ut og vise
  // at henfallet ikke frigjør energi)
  nuc(4, 10, 10.013535, '1,39 · 10⁶ år', 'beta-'),
  nuc(5, 14, 14.025404, '12,5 ms', 'beta-'),
  nuc(10, 18, 18.005709, '1,66 s', 'beta+'),
  nuc(12, 22, 21.999571, '3,88 s', 'beta+'),
  nuc(17, 36, 35.968307, '3,01 · 10⁵ år', 'beta-'),
  nuc(25, 56, 55.938904, '2,58 timer', 'beta-'),
  nuc(26, 60, 59.934071, '2,6 · 10⁶ år', 'beta-'),
  nuc(89, 226, 226.026098, '29,4 timer', 'beta-'),
  nuc(93, 238, 238.050946, '2,10 døgn', 'beta-'),
  nuc(94, 241, 241.056851, '14,3 år', 'beta-'),
];

const BY_KEY = new Map(NUCLIDES.map((n) => [`${n.Z}-${n.A}`, n]));

export function findNuclide(Z: number, A: number): Nuclide | undefined {
  return BY_KEY.get(`${Z}-${A}`);
}

/** Atommassen (u), eller undefined hvis kjernen ikke er i tabellen. */
export function atomicMass(Z: number, A: number): number | undefined {
  if (Z === 0 && A === 1) return M_NEUTRON_U;
  return findNuclide(Z, A)?.mass;
}

/* ---------- 8A Bindingsenergi ---------- */

export interface Binding {
  /** Massedefekt Δm = Z·m(¹H) + N·m_n − m(atom) (u). Elektronmassene går mot hverandre. */
  dm: number;
  /** Bindingsenergi (J og MeV). */
  EJ: number;
  E: number;
  /** Bindingsenergi per nukleon (MeV). */
  perNucleon: number;
}

export function bindingEnergy(Z: number, A: number, mass: number): Binding {
  const dm = Z * M_H1_U + (A - Z) * M_NEUTRON_U - mass;
  const EJ = massEnergyJ(dm);
  const E = EJ / MEV;
  return { dm, EJ, E, perNucleon: A > 0 ? E / A : 0 };
}

/** Kjernene i grafen over bindingsenergi per nukleon (stabile og noen langlivede). */
export const CURVE_KEYS = (
  '1-1 1-2 2-3 2-4 3-6 3-7 4-9 5-11 6-12 7-14 8-16 9-19 10-20 11-23 12-24 13-27 ' +
  '14-28 16-32 20-40 24-52 26-56 28-62 36-84 40-90 47-107 50-120 56-138 79-197 82-208 92-235 92-238'
).split(' ');

export const CURVE: Nuclide[] = CURVE_KEYS.map((k) => BY_KEY.get(k)!).filter(Boolean);

/* ---------- 8C og 8D Fisjon og fusjon ---------- */

export interface Particle {
  Z: number;
  A: number;
  count: number;
}

export interface Reaction {
  id: 'fisjon' | 'fusjon' | 'sola';
  reactants: Particle[];
  products: Particle[];
  /** Brenselet (uten frie nøytroner), for energi per nukleon og per kilogram. */
  fuel: Particle[];
}

export const REACTIONS: Record<Reaction['id'], Reaction> = {
  // ²³⁵U + n → ¹⁴¹Ba + ⁹²Kr + 3n
  fisjon: {
    id: 'fisjon',
    reactants: [
      { Z: 92, A: 235, count: 1 },
      { Z: 0, A: 1, count: 1 },
    ],
    products: [
      { Z: 56, A: 141, count: 1 },
      { Z: 36, A: 92, count: 1 },
      { Z: 0, A: 1, count: 3 },
    ],
    fuel: [{ Z: 92, A: 235, count: 1 }],
  },
  // ²H + ³H → ⁴He + n
  fusjon: {
    id: 'fusjon',
    reactants: [
      { Z: 1, A: 2, count: 1 },
      { Z: 1, A: 3, count: 1 },
    ],
    products: [
      { Z: 2, A: 4, count: 1 },
      { Z: 0, A: 1, count: 1 },
    ],
    fuel: [
      { Z: 1, A: 2, count: 1 },
      { Z: 1, A: 3, count: 1 },
    ],
  },
  // Netto i sola: 4 ¹H → ⁴He (+ 2 positroner som annihilerer med 2 elektroner, og 2 nøytrinoer).
  // Med atommasser blir det 4 m(¹H) − m(⁴He).
  sola: {
    id: 'sola',
    reactants: [{ Z: 1, A: 1, count: 4 }],
    products: [{ Z: 2, A: 4, count: 1 }],
    fuel: [{ Z: 1, A: 1, count: 4 }],
  },
};

const sumMass = (ps: Particle[]) => ps.reduce((s, p) => s + p.count * (atomicMass(p.Z, p.A) ?? NaN), 0);
const sumA = (ps: Particle[]) => ps.reduce((s, p) => s + p.count * p.A, 0);
const sumZ = (ps: Particle[]) => ps.reduce((s, p) => s + p.count * p.Z, 0);

export interface ReactionEnergy {
  /** Masse før og etter (u). */
  mBefore: number;
  mAfter: number;
  /** Massetapet (u). */
  dm: number;
  /** Frigjort energi (J og MeV). */
  QJ: number;
  Q: number;
  /** Energi per nukleon i brenselet (MeV). */
  perNucleon: number;
  /** Energi per kilogram brensel (J/kg). */
  perKg: number;
  /** Nukleontall og ladning før og etter (bevares). */
  A: [number, number];
  Z: [number, number];
}

export function reactionEnergy(r: Reaction): ReactionEnergy {
  const mBefore = sumMass(r.reactants);
  const mAfter = sumMass(r.products);
  const dm = mBefore - mAfter;
  const QJ = massEnergyJ(dm);
  const fuelMass = sumMass(r.fuel);
  return {
    mBefore,
    mAfter,
    dm,
    QJ,
    Q: QJ / MEV,
    perNucleon: QJ / MEV / sumA(r.fuel),
    perKg: QJ / (fuelMass * U_KG),
    A: [sumA(r.reactants), sumA(r.products)],
    Z: [sumZ(r.reactants), sumZ(r.products)],
  };
}

/* ---------- 8A Halveringstid og aktivitet ---------- */

export interface HalfLifePreset {
  id: string;
  Z: number;
  A: number;
  /** Halveringstida i visningsenheten. */
  T: number;
  /** Visningsenheten, f.eks. «år» eller «døgn». U-238 vises i milliarder år. */
  unit: string;
  /** Sekunder per visningsenhet. */
  unitSeconds: number;
  /** Datterkjernen og henfallstypen (tekst). */
  daughter: string;
  decay: string;
}

export const HALF_LIFE_PRESETS: HalfLifePreset[] = [
  { id: 'c14', Z: 6, A: 14, T: 5730, unit: 'år', unitSeconds: YEAR_S, daughter: '¹⁴N', decay: 'β⁻' },
  { id: 'i131', Z: 53, A: 131, T: 8.02, unit: 'døgn', unitSeconds: DAY_S, daughter: '¹³¹Xe', decay: 'β⁻' },
  { id: 'rn222', Z: 86, A: 222, T: 3.82, unit: 'døgn', unitSeconds: DAY_S, daughter: '²¹⁸Po', decay: 'α' },
  { id: 'co60', Z: 27, A: 60, T: 5.27, unit: 'år', unitSeconds: YEAR_S, daughter: '⁶⁰Ni', decay: 'β⁻' },
  { id: 'u238', Z: 92, A: 238, T: 4.47, unit: '10⁹ år', unitSeconds: 1e9 * YEAR_S, daughter: '²³⁴Th', decay: 'α' },
];

/** Halveringstida i sekunder. */
export function halfLifeSeconds(p: HalfLifePreset): number {
  return p.T * p.unitSeconds;
}

/** Antall kjerner igjen: N = N₀ · (1/2)^(t/T½). */
export function remaining(N0: number, t: number, T: number): number {
  return N0 * 0.5 ** (t / T);
}

/** Desintegrasjonskonstanten λ = ln 2 / T½ (samme tidsenhet som T½, invers). */
export function decayConstant(T: number): number {
  return Math.LN2 / T;
}

/** Aktiviteten A = λN (henfall per tidsenhet, Bq når λ er i s⁻¹). */
export function activity(lambda: number, N: number): number {
  return lambda * N;
}

/** Antall atomer i en prøve med masse m (kg) og nukleontall A: N ≈ m / (A·u). */
export function atomsInSample(massKg: number, A: number): number {
  return massKg / (A * U_KG);
}

/**
 * Tidspunktet (målt i halveringstider) da hver av `n` kjerner henfaller. Hver kjerne har samme sannsynlighet for å henfalle
 * per tid, så levetidene er eksponentialfordelte: τ = −log₂(1 − U), der U er et tilfeldig tall i [0, 1).
 */
export function decayTimes(n: number, seed: number): number[] {
  const rnd = seededRandom(seed);
  const out: number[] = [];
  for (let i = 0; i < n; i++) out.push(-Math.log2(1 - rnd()));
  return out;
}

/** Hvor mange av kjernene som ikke har henfalt ved tiden t (i halveringstider). */
export function countRemaining(times: number[], t: number): number {
  let k = 0;
  for (const tau of times) if (tau > t) k++;
  return k;
}

/* ---------- 8B Bevaringslover for kjernereaksjoner ---------- */

export interface Emitted {
  A: number;
  Z: number;
  /** Symbolet slik det skrives i reaksjonslikningen. */
  symbol: string;
  name: string;
}

export interface Decay {
  type: DecayType;
  parent: { Z: number; A: number; excited: boolean };
  daughter: { Z: number; A: number; excited: boolean };
  /** Partiklene som sendes ut (med nøytrino/antinøytrino ved β). */
  emitted: Emitted[];
  /**
   * Om henfallet i det hele tatt kan skrives: datterkjernen må ha minst ett proton og ikke flere protoner enn nukleoner,
   * og γ-stråling krever en eksitert kjerne (en kjerne i grunntilstanden har ingen energi å kvitte seg med).
   */
  possible: boolean;
}

export const ALPHA: Emitted = { A: 4, Z: 2, symbol: 'He', name: 'alfapartikkel' };
export const ELECTRON: Emitted = { A: 0, Z: -1, symbol: 'e', name: 'elektron' };
export const POSITRON: Emitted = { A: 0, Z: 1, symbol: 'e', name: 'positron' };
export const ANTINEUTRINO: Emitted = { A: 0, Z: 0, symbol: 'ν̄', name: 'antinøytrino' };
export const NEUTRINO: Emitted = { A: 0, Z: 0, symbol: 'ν', name: 'nøytrino' };
export const GAMMA: Emitted = { A: 0, Z: 0, symbol: 'γ', name: 'foton' };

/** Datterkjernen og partiklene som sendes ut. Nukleontall og ladning er bevart i alle henfallene. */
export function decay(Z: number, A: number, type: DecayType, excited = false): Decay {
  let d: { Z: number; A: number };
  let emitted: Emitted[];
  switch (type) {
    case 'alfa':
      d = { Z: Z - 2, A: A - 4 };
      emitted = [ALPHA];
      break;
    case 'beta-':
      d = { Z: Z + 1, A };
      emitted = [ELECTRON, ANTINEUTRINO];
      break;
    case 'beta+':
      d = { Z: Z - 1, A };
      emitted = [POSITRON, NEUTRINO];
      break;
    case 'gamma':
      d = { Z, A };
      // Noen kjerner faller ned i flere trinn og sender ut flere fotoner (⁶⁰Ni*: to)
      emitted = (gammaPhotons(Z, A) ?? [0]).map(() => GAMMA);
      break;
  }
  // Etter et β-henfall kan datterkjernen være eksitert (f.eks. ⁶⁰Co → ⁶⁰Ni*), og etter γ er den i grunntilstanden.
  const nat = findNuclide(Z, A);
  const dExcited = type !== 'gamma' && !excited && nat?.mode === type && nat.daughterExcitation !== undefined;
  const possible =
    type === 'gamma' ? excited : d.Z >= 1 && d.A >= d.Z && d.A - d.Z >= 0 && d.Z <= 100 && (d.A > 1 || d.Z === 1);
  return { type, parent: { Z, A, excited }, daughter: { ...d, excited: dExcited }, emitted, possible };
}

/** Summen av nukleontall og ladning før og etter henfallet. */
export function conservation(dc: Decay): { A: [number, number]; Z: [number, number] } {
  const A1 = dc.daughter.A + dc.emitted.reduce((s, e) => s + e.A, 0);
  const Z1 = dc.daughter.Z + dc.emitted.reduce((s, e) => s + e.Z, 0);
  return { A: [dc.parent.A, A1], Z: [dc.parent.Z, Z1] };
}

/** Eksiterte kjerner som dannes i tabellens β-henfall: halveringstid og hvordan energien sendes ut. */
export const EXCITED_INFO: Record<string, { halfLife: string; photons: number[] }> = {
  // ⁶⁰Ni* faller ned i to trinn og sender ut to fotoner (1,17 MeV og 1,33 MeV). Halveringstida til nivået på
  // 2,505 MeV er 3,3 ps (1 ps = 10⁻¹² s).
  '28-60': { halfLife: 'ca. 3 ps', photons: [1.173, 1.332] },
  // ¹³⁷Ba* er den metastabile tilstanden ¹³⁷ᵐBa
  '56-137': { halfLife: '2,55 min', photons: [0.662] },
  // Nivået på 1,275 MeV i ²²Ne har halveringstid 3,6 ps
  '10-22': { halfLife: 'ca. 4 ps', photons: [1.275] },
};

/** Fotonene (MeV) som en eksitert kjerne sender ut, hvis vi kjenner dem. */
export function gammaPhotons(Z: number, A: number): number[] | undefined {
  return EXCITED_INFO[`${Z}-${A}`]?.photons;
}

/** Energien som frigjøres fra en eksitert kjerne (γ), hvis vi kjenner den. */
export function excitationEnergy(Z: number, A: number): number | undefined {
  // Finn mora som gir denne eksiterte datterkjernen
  for (const n of NUCLIDES) {
    if (n.daughterExcitation === undefined || !n.mode) continue;
    const d = decay(n.Z, n.A, n.mode).daughter;
    if (d.Z === Z && d.A === A) return n.daughterExcitation;
  }
  return undefined;
}

export interface DecayEnergy {
  /** Massetapet (u). */
  dm: number;
  /** Energien som svarer til massetapet (MeV), regnet fra atommassene i grunntilstanden. */
  Qmass: number;
  /** Eksitasjonsenergien til en eksitert morkjerne (kommer i tillegg) og til en eksitert datterkjerne (blir igjen der), i MeV. */
  parentExcitation: number;
  daughterExcitation: number;
  /** Frigjort energi (J og MeV): Qmass + parentExcitation − daughterExcitation. Negativ betyr at henfallet ikke kan skje av seg selv. */
  QJ: number;
  Q: number;
  /** Hvordan massetapet er regnet ut (tekst med nuklidenavn). */
  terms: { label: string; mass: number; sign: 1 | -1 }[];
}

/**
 * Q-verdien regnet fra atommasser:
 *   α: m(mor) − m(datter) − m(⁴He)   β⁻: m(mor) − m(datter)   β⁺: m(mor) − m(datter) − 2m_e
 * (Elektronene i atommassene går mot hverandre, bortsett fra ved β⁺.) Hvis datterkjernen dannes eksitert, går
 * eksitasjonsenergien fra (den kommer senere som γ), og en eksitert morkjerne har eksitasjonsenergien i tillegg.
 * For γ er Q eksitasjonsenergien.
 */
export function decayEnergy(dc: Decay): DecayEnergy | null {
  const { parent: p, daughter: d } = dc;
  if (dc.type === 'gamma') {
    const E = p.excited ? excitationEnergy(p.Z, p.A) : undefined;
    if (E === undefined) return null;
    const dmG = (E * MEV) / (U_KG * C_LIGHT * C_LIGHT);
    return { dm: dmG, Qmass: E, parentExcitation: 0, daughterExcitation: 0, QJ: E * MEV, Q: E, terms: [] };
  }
  if (!dc.possible) return null;
  const mp = atomicMass(p.Z, p.A);
  const md = atomicMass(d.Z, d.A);
  if (mp === undefined || md === undefined) return null;
  const terms: DecayEnergy['terms'] = [
    { label: `m(${nuclideText(p.Z, p.A)})`, mass: mp, sign: 1 },
    { label: `m(${nuclideText(d.Z, d.A)})`, mass: md, sign: -1 },
  ];
  if (dc.type === 'alfa') terms.push({ label: 'm(⁴He)', mass: atomicMass(2, 4)!, sign: -1 });
  if (dc.type === 'beta+') terms.push({ label: '2m(e)', mass: 2 * M_ELECTRON_U, sign: -1 });
  const dm = terms.reduce((s, t) => s + t.sign * t.mass, 0);
  const Qmass = massEnergyMeV(dm);
  const parentExcitation = p.excited ? (excitationEnergy(p.Z, p.A) ?? 0) : 0;
  const daughterExcitation = d.excited ? (excitationEnergy(d.Z, d.A) ?? 0) : 0;
  const Q = Qmass + parentExcitation - daughterExcitation;
  return { dm, Qmass, parentExcitation, daughterExcitation, QJ: Q * MEV, Q, terms };
}

/** Nuklidenavn med stjerne for eksiterte kjerner: «⁶⁰Ni*». */
export function nuclideLabel(Z: number, A: number, excited = false): string {
  return `${nuclideText(Z, A)}${excited ? '*' : ''}`;
}

/** Om kjernen er stabil (i tabellen uten henfall). Ukjente kjerner gir undefined. */
export function isStable(Z: number, A: number): boolean | undefined {
  const n = findNuclide(Z, A);
  return n ? n.mode === undefined : undefined;
}


/* ---------- Fart etter α-henfall og forstørrelsen i figuren ---------- */

export interface AlphaKinetics {
  /** Bevegelsesenergien (MeV) til α-partikkelen og datterkjernen. Summen er Q. */
  Ealpha: number;
  Edaughter: number;
  /** Farten (m/s), regnet klassisk med E_k = ½mv² (α-partiklene har under 6 % av lysfarten). */
  valpha: number;
  vdaughter: number;
  /** Massene (u) som er brukt: atommassen til ⁴He og til datterkjernen. */
  malpha: number;
  mdaughter: number;
}

/**
 * Hvordan Q deles ved α-henfall. Kjernen ligger i ro før henfallet, så den samlede bevegelsesmengden er null også
 * etterpå: m_α · v_α = m_d · v_d, i hver sin retning. Da er E_k = p²/(2m), og energien deles i omvendt forhold til
 * massene: E_α = Q · m_d / (m_α + m_d). Den lette α-partikkelen får nesten alt.
 * null når det ikke er et α-henfall som frigjør energi (Q ≤ 0 eller ukjent).
 */
export function alphaKinetics(dc: Decay, e: DecayEnergy | null): AlphaKinetics | null {
  if (dc.type !== 'alfa' || !dc.possible || !e || !(e.Q > 0)) return null;
  const malpha = atomicMass(2, 4)!;
  const mdaughter = atomicMass(dc.daughter.Z, dc.daughter.A) ?? dc.daughter.A;
  const Ealpha = (e.Q * mdaughter) / (malpha + mdaughter);
  const Edaughter = e.Q - Ealpha;
  const speed = (E: number, m: number) => Math.sqrt((2 * E * MEV) / (m * U_KG));
  return { Ealpha, Edaughter, valpha: speed(Ealpha, malpha), vdaughter: speed(Edaughter, mdaughter), malpha, mdaughter };
}

/** Omtrentlig radius (m) til en atomkjerne med nukleontall A: r ≈ 1,2 · 10⁻¹⁵ m · ∛A. */
export function nuclearRadiusM(A: number): number {
  return 1.2e-15 * Math.cbrt(Math.max(1, A));
}

/**
 * Hvor mange ganger kjernen er forstørret i figuren, avrundet til en tierpotens: kjernen tegnes med radius
 * `radiusPx`, mens resten av scenen er tegnet med skalaen `pxPerM`. Gir eksponenten (13 betyr ca. 10¹³ ganger).
 */
export function magnificationExponent(radiusPx: number, A: number, pxPerM: number): number {
  const m = radiusPx / nuclearRadiusM(A) / pxPerM;
  return Number.isFinite(m) && m > 0 ? Math.round(Math.log10(m)) : 0;
}
