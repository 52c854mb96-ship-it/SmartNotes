/**
 * Ren fysikk for eksempeloppgaven «Energi fra en kjernereaksjon» (kapittel 8, 8A–8D): finn den ukjente partikkelen
 * med bevaring av nukleontall og ladning, regn ut massedefekten fra tabellmasser, energien med E = Δm · c² (J og MeV),
 * energien i 1,0 kg brensel og hvor mye kull eller bensin som gir like mye energi.
 *
 * Egen modell (bruker ikke model.ts). Konstantene er verdiene i ERGO Fysikk 1. Atommassene er fra atommassetabellen
 * (AME 2020), avrundet til seks desimaler. Oppgaven og tallene er laget for appen.
 */

/* ---------- Konstanter (som i boka) ---------- */

/** Atommasseenheten (kg). */
export const U_KG = 1.66e-27;
/** Lysfarten (m/s). */
export const C_LIGHT = 3.0e8;
/** 1 MeV i joule (1 eV = 1,60 · 10⁻¹⁹ J). */
export const MEV_J = 1.6e-13;
/** Tabellverdien 1 u · c² = 931,5 MeV (snarveien i tipset). Med de avrundede konstantene over blir det 933,75 MeV. */
export const U_MEV_TABLE = 931.5;
/** Massen av brenselet i deloppgave d (kg). */
export const FUEL_KG = 1.0;

/* ---------- Partikler ---------- */

export type ParticleKind = 'kjerne' | 'noytron' | 'proton';

export interface Particle {
  key: string;
  Z: number;
  A: number;
  /** Symbolet i reaksjonslikningen: «U», «n», «p». */
  symbol: string;
  /** Navnet i teksten: «uran-235», «nøytron». */
  name: string;
  /** Atommasse (u). For protonet er det massen til et ¹H-atom, så elektronene går opp (se oppgaven). */
  mass: number;
  kind: ParticleKind;
}

const kjerne = (key: string, Z: number, A: number, symbol: string, name: string, mass: number): Particle => ({
  key,
  Z,
  A,
  symbol,
  name,
  mass,
  kind: 'kjerne',
});

/** Massene oppgaven gir (u). */
export const PARTICLES = {
  n: { key: 'n', Z: 0, A: 1, symbol: 'n', name: 'nøytron', mass: 1.008665, kind: 'noytron' },
  p: { key: 'p', Z: 1, A: 1, symbol: 'p', name: 'proton', mass: 1.007825, kind: 'proton' },
  H2: kjerne('H2', 1, 2, 'H', 'deuterium (hydrogen-2)', 2.014102),
  H3: kjerne('H3', 1, 3, 'H', 'tritium (hydrogen-3)', 3.016049),
  He3: kjerne('He3', 2, 3, 'He', 'helium-3', 3.016029),
  He4: kjerne('He4', 2, 4, 'He', 'helium-4', 4.002603),
  Xe140: kjerne('Xe140', 54, 140, 'Xe', 'xenon-140', 139.921646),
  Sr94: kjerne('Sr94', 38, 94, 'Sr', 'strontium-94', 93.915356),
  U235: kjerne('U235', 92, 235, 'U', 'uran-235', 235.04393),
} satisfies Record<string, Particle>;

/* ---------- Oppgavene (tallsettene) ---------- */

export interface Term {
  p: Particle;
  count: number;
  /** Den ukjente partikkelen X (bare ett ledd). */
  unknown?: boolean;
}

export interface Fuel {
  id: 'kull' | 'bensin';
  /** Navnet i teksten: «kull», «bensin». */
  name: string;
  /** Energien som frigjøres når 1 kg brenner (J/kg). */
  heat: number;
  /** Tetthet (kg/m³): kull i en haug (med luft mellom bitene) og bensin. */
  density: number;
}

export const KULL: Fuel = { id: 'kull', name: 'kull', heat: 3.0e7, density: 800 };
export const BENSIN: Fuel = { id: 'bensin', name: 'bensin', heat: 4.3e7, density: 740 };

export interface MassTask {
  id: 'fisjon' | 'fusjon' | 'sola';
  reactants: Term[];
  products: Term[];
  /** Brenselet som brukes i én reaksjon (nøytronet i fisjon er ikke brensel: det kommer fra en tidligere spaltning). */
  fuel: Term[];
  /** Brenselet i ord: «uran-235», «deuterium og tritium». */
  fuelName: string;
  /** Det vi sammenligner med i e. */
  compare: Fuel;
  /** Tettheten til brenselet (kg/m³) når det er et fast stoff (uranmetall), ellers null (gass på flaske). */
  fuelDensity: number | null;
}

const P = PARTICLES;

export const MASS_TASKS: MassTask[] = [
  // Fisjon i et kjernekraftverk: ²³⁵U + n → ¹⁴⁰Xe + X + 2n, X = ⁹⁴Sr.
  {
    id: 'fisjon',
    reactants: [
      { p: P.U235, count: 1 },
      { p: P.n, count: 1 },
    ],
    products: [
      { p: P.Xe140, count: 1 },
      { p: P.Sr94, count: 1, unknown: true },
      { p: P.n, count: 2 },
    ],
    fuel: [{ p: P.U235, count: 1 }],
    fuelName: 'uran-235',
    compare: KULL,
    fuelDensity: 19100,
  },
  // Fusjon i en fusjonsreaktor: ²H + ³H → ⁴He + X, X = n.
  {
    id: 'fusjon',
    reactants: [
      { p: P.H2, count: 1 },
      { p: P.H3, count: 1 },
    ],
    products: [
      { p: P.He4, count: 1 },
      { p: P.n, count: 1, unknown: true },
    ],
    fuel: [
      { p: P.H2, count: 1 },
      { p: P.H3, count: 1 },
    ],
    fuelName: 'deuterium og tritium',
    compare: BENSIN,
    fuelDensity: null,
  },
  // Siste trinn i proton–proton-kjeden i sola: ³He + ³He → ⁴He + 2X, X = p.
  {
    id: 'sola',
    reactants: [{ p: P.He3, count: 2 }],
    products: [
      { p: P.He4, count: 1 },
      { p: P.p, count: 2, unknown: true },
    ],
    fuel: [{ p: P.He3, count: 2 }],
    fuelName: 'helium-3',
    compare: KULL,
    fuelDensity: null,
  },
];

/* ---------- Løsningen ---------- */

const sum = (terms: Term[], f: (t: Term) => number) => terms.reduce((s, t) => s + f(t), 0);
/** Masser i u avrundes til seks desimaler (som i tabellen), så summene ikke får flyttallsstøy. */
const round6 = (v: number) => Math.round(v * 1e6) / 1e6;

/** Avrund til `n` gjeldende siffer (det samme som tallene som vises). */
export function sig(v: number, n: number): number {
  if (!Number.isFinite(v) || v === 0) return v;
  // toPrecision avrunder i titallsystemet, og Number gir samme flyttall som når tallet skrives direkte (7,9e6).
  return Number(v.toPrecision(n));
}

/** Haug med rasvinkel `angleDeg` (en kjegle): V = (π/3) r² h med h = r · tan(vinkel). */
export function heapFor(volume: number, angleDeg = 35): { r: number; h: number } {
  const t = Math.tan((angleDeg * Math.PI) / 180);
  const r = Math.cbrt((3 * volume) / (Math.PI * t));
  return { r, h: r * t };
}

/** Sylindrisk lagertank der høyden er halve diameteren: V = π D³ / 8. */
export function tankFor(volume: number): { d: number; h: number } {
  const d = Math.cbrt((8 * volume) / Math.PI);
  return { d, h: d / 2 };
}

export interface MassSolution {
  /** Nukleontall: sum før, sum av de kjente leddene etter, og A for én X. */
  A: { before: number; knownAfter: number; X: number };
  /** Ladning (protontall) på samme måte. */
  Z: { before: number; knownAfter: number; X: number };
  /** Koeffisienten foran X. */
  countX: number;
  /** Partikkelen som har A og Z for X (fra tabellen), eller undefined. */
  X: Particle | undefined;
  /** Antall elektroner i atomene før og etter (atommassene tar med elektronene). */
  electrons: [number, number];
  /** Masse før og etter (u) og massedefekten Δm (u). */
  mBefore: number;
  mAfter: number;
  dm: number;
  /** Δm i kg, energien i J og MeV, og MeV med snarveien 931,5 MeV per u. */
  dmKg: number;
  EJ: number;
  EMeV: number;
  EMeVTable: number;
  /** Brenselet i én reaksjon (u og kg), antall reaksjoner i 1,0 kg og energien fra 1,0 kg (J). */
  fuelU: number;
  fuelKgEach: number;
  N: number;
  Etot: number;
  /** Massen kull eller bensin (kg) som gir like mye energi, og hvor mange ganger mer masse det er. */
  compareKg: number;
  ratio: number;
  /** Andelen av massen som blir til energi: i kjernereaksjonen (Δm / brenselet) og i forbrenningen (E / mc²). */
  fraction: number;
  chemFraction: number;
  /** Massen som forsvinner når 1 kg kull eller bensin brenner (kg). */
  chemDmKg: number;
  /** Til figuren: siden i en kube av 1,0 kg brensel (m), haugen med kull eller tanken med bensin (m). */
  cubeSide: number | null;
  volume: number;
  heap: { r: number; h: number };
  tank: { d: number; h: number };
}

export function solveMassTask(task: MassTask): MassSolution {
  const xTerm = task.products.find((t) => t.unknown);
  const known = task.products.filter((t) => !t.unknown);
  const countX = xTerm?.count ?? 1;
  const Abefore = sum(task.reactants, (t) => t.count * t.p.A);
  const Zbefore = sum(task.reactants, (t) => t.count * t.p.Z);
  const AknownAfter = sum(known, (t) => t.count * t.p.A);
  const ZknownAfter = sum(known, (t) => t.count * t.p.Z);
  const AX = (Abefore - AknownAfter) / countX;
  const ZX = (Zbefore - ZknownAfter) / countX;
  const X = Object.values(PARTICLES).find((p) => p.A === AX && p.Z === ZX) as Particle | undefined;

  // Atommassene tar med elektronene: like mange før og etter når ladningen er bevart (nøytronet har ingen).
  const electronsOf = (terms: Term[]) => sum(terms, (t) => (t.p.kind === 'noytron' ? 0 : t.count * t.p.Z));
  const mBefore = round6(sum(task.reactants, (t) => t.count * t.p.mass));
  const mAfter = round6(sum(task.products, (t) => t.count * t.p.mass));
  const dm = round6(mBefore - mAfter);
  const dmKg = dm * U_KG;
  const EJ = dmKg * C_LIGHT * C_LIGHT;
  const EMeV = EJ / MEV_J;

  const fuelU = round6(sum(task.fuel, (t) => t.count * t.p.mass));
  const fuelKgEach = fuelU * U_KG;
  const N = FUEL_KG / fuelKgEach;
  const Etot = N * EJ;
  const compareKg = Etot / task.compare.heat;
  const volume = compareKg / task.compare.density;

  return {
    A: { before: Abefore, knownAfter: AknownAfter, X: AX },
    Z: { before: Zbefore, knownAfter: ZknownAfter, X: ZX },
    countX,
    X,
    electrons: [electronsOf(task.reactants), electronsOf(task.products)],
    mBefore,
    mAfter,
    dm,
    dmKg,
    EJ,
    EMeV,
    EMeVTable: dm * U_MEV_TABLE,
    fuelU,
    fuelKgEach,
    N,
    Etot,
    compareKg,
    ratio: compareKg / FUEL_KG,
    fraction: dm / fuelU,
    chemFraction: task.compare.heat / (C_LIGHT * C_LIGHT),
    chemDmKg: (1 * task.compare.heat) / (C_LIGHT * C_LIGHT),
    cubeSide: task.fuelDensity ? Math.cbrt(FUEL_KG / task.fuelDensity) : null,
    volume,
    heap: heapFor(volume),
    tank: tankFor(volume),
  };
}
