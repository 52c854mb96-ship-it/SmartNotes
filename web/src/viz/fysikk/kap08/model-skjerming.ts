/**
 * Ren modell for «Skjerming»: hvor mye α-, β- og γ-stråling som slipper gjennom papir, aluminium og bly, og hva en
 * geigerteller viser i ett minutt (med bakgrunnsstråling og tilfeldig variasjon).
 *
 * Forenklinger (som i skolelaben):
 * - α: alle partiklene fra americium-241 har omtrent samme energi (5,5 MeV) og samme rekkevidde. Lufta mellom kilden
 *   og røret bruker opp en del av rekkevidden; resten avgjør hvor tykt lag som stopper dem.
 * - β: elektronene fra strontium-90 har ulik energi, så strålingen avtar omtrent eksponentielt (fast halveringstykkelse)
 *   fram til den maksimale rekkevidden, der den er borte.
 * - γ: fotonene fra kobolt-60 svekkes eksponentielt med fast halveringstykkelse, og blir aldri helt borte.
 * - Alle tykkelser er i millimeter og tellerater i klikk per minutt.
 */

export type RadiationId = 'alfa' | 'beta' | 'gamma';
export type MaterialId = 'papir' | 'aluminium' | 'bly';

export const RADIATION_IDS: RadiationId[] = ['alfa', 'beta', 'gamma'];
export const MATERIAL_IDS: MaterialId[] = ['papir', 'aluminium', 'bly'];

export interface RadiationInfo {
  id: RadiationId;
  symbol: 'α' | 'β' | 'γ';
  /** «α-stråling». */
  name: string;
  /** Kilden i oppsettet, f.eks. «americium-241». */
  source: string;
  /** Kort nuklidenavn, f.eks. «Am-241». */
  short: string;
  /** Hva strålingen består av. */
  particle: string;
  /** Netto tellerate uten skjerm i oppsettet (klikk per minutt, uten bakgrunnen). */
  rate0: number;
  /** Avstanden fra kilden til vinduet på røret (mm). */
  gap: number;
}

export const RADIATIONS: Record<RadiationId, RadiationInfo> = {
  alfa: {
    id: 'alfa',
    symbol: 'α',
    name: 'α-stråling',
    source: 'americium-241',
    short: 'Am-241',
    particle: 'heliumkjerner',
    rate0: 1500,
    gap: 30,
  },
  beta: {
    id: 'beta',
    symbol: 'β',
    name: 'β-stråling',
    source: 'strontium-90',
    short: 'Sr-90',
    particle: 'elektroner',
    rate0: 2400,
    gap: 60,
  },
  gamma: {
    id: 'gamma',
    symbol: 'γ',
    name: 'γ-stråling',
    source: 'kobolt-60',
    short: 'Co-60',
    particle: 'fotoner',
    rate0: 640,
    gap: 60,
  },
};

export interface MaterialInfo {
  id: MaterialId;
  /** «Papir». */
  name: string;
  /** Tetthet (g/cm³). */
  density: number;
  /** Største tykkelse på glidebryteren (mm). */
  max: number;
  /** Steget på glidebryteren (mm): ett ark papir, 0,1 mm aluminium, 1 mm bly. */
  step: number;
}

export const MATERIALS: Record<MaterialId, MaterialInfo> = {
  papir: { id: 'papir', name: 'Papir', density: 0.8, max: 5, step: 0.1 },
  aluminium: { id: 'aluminium', name: 'Aluminium', density: 2.7, max: 10, step: 0.1 },
  bly: { id: 'bly', name: 'Bly', density: 11.3, max: 50, step: 1 },
};

/** Tykkelsen på ett ark kopipapir (mm). */
export const SHEET = 0.1;

/** Rekkevidden til α-partiklene fra americium-241 i luft (mm): ca. 4 cm. */
export const ALPHA_RANGE_AIR = 40;

/** Rekkevidden til de samme α-partiklene i hvert materiale (mm), uten luft foran. */
export const ALPHA_RANGE: Record<MaterialId, number> = { papir: 0.05, aluminium: 0.025, bly: 0.015 };

/** Spredningen i rekkevidden til α (andel av rekkevidden), så overgangen ikke blir helt brå. */
export const ALPHA_STRAGGLING = 0.06;

/** β fra strontium-90: halveringstykkelse og største rekkevidde (mm). Omtrent samme masse per areal i alle stoffene. */
export const BETA: Record<MaterialId, { half: number; range: number }> = {
  papir: { half: 1.3, range: 14 },
  aluminium: { half: 0.4, range: 4 },
  bly: { half: 0.09, range: 1 },
};

/** Halveringstykkelsen for γ fra kobolt-60 (mm). */
export const GAMMA_HALF: Record<MaterialId, number> = { papir: 140, aluminium: 47, bly: 10 };

/** Bakgrunnsstrålingen telleren registrerer uten kilde (klikk per minutt). */
export const BACKGROUND = 20;

/** Lengden på én måling (s). */
export const MEASURE_TIME = 60;

/** Luft som må være på hver side av skjermen i holderen (mm). */
export const PLATE_CLEARANCE = 5;

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const safeD = (d: number) => (Number.isFinite(d) && d > 0 ? d : 0);

/** Den tykkeste skjermen som får plass mellom kilden og røret (mm). */
export function maxThickness(rad: RadiationId, mat: MaterialId): number {
  return Math.min(MATERIALS[mat].max, RADIATIONS[rad].gap - 2 * PLATE_CLEARANCE);
}

/**
 * Hvor mye av rekkevidden α-partiklene bruker opp (1 = akkurat stoppet) når skjermen er `d` mm tykk og resten av
 * avstanden er luft.
 */
export function alphaRangeUsed(mat: MaterialId, d: number): number {
  const dd = safeD(d);
  const air = Math.max(0, RADIATIONS.alfa.gap - dd);
  return air / ALPHA_RANGE_AIR + dd / ALPHA_RANGE[mat];
}

/** Hvor tykt lag av materialet α-partiklene kan gå gjennom etter lufta i oppsettet (mm). */
export function alphaRangeLeft(mat: MaterialId): number {
  return ALPHA_RANGE[mat] * Math.max(0, 1 - RADIATIONS.alfa.gap / ALPHA_RANGE_AIR);
}

/** Om α-partiklene når fram gjennom `distance` mm luft. */
export function alphaReachesThroughAir(distance: number): boolean {
  return safeD(distance) < ALPHA_RANGE_AIR;
}

/** Halveringstykkelsen (mm) for β og γ, eller null for α (som har en fast rekkevidde i stedet). */
export function halfThickness(rad: RadiationId, mat: MaterialId): number | null {
  if (rad === 'beta') return BETA[mat].half;
  if (rad === 'gamma') return GAMMA_HALF[mat];
  return null;
}

/** Tykkelsen som stopper all strålingen (mm): rekkevidden for α og β, null for γ (som aldri stoppes helt). */
export function stoppingThickness(rad: RadiationId, mat: MaterialId): number | null {
  if (rad === 'alfa') return alphaRangeLeft(mat);
  if (rad === 'beta') return BETA[mat].range;
  return null;
}

/** Andelen (0–1) av strålingen mot røret som slipper gjennom en skjerm med tykkelse `d` mm. */
export function transmission(rad: RadiationId, mat: MaterialId, d: number): number {
  const dd = safeD(d);
  switch (rad) {
    case 'alfa': {
      const s = ALPHA_STRAGGLING;
      return clamp01((1 + s - alphaRangeUsed(mat, dd)) / (2 * s));
    }
    case 'beta': {
      const { half, range } = BETA[mat];
      return dd >= range ? 0 : 0.5 ** (dd / half);
    }
    case 'gamma':
      return 0.5 ** (dd / GAMMA_HALF[mat]);
  }
}

/** Netto tellerate fra kilden bak skjermen (klikk per minutt). */
export function netRate(rad: RadiationId, mat: MaterialId, d: number): number {
  return RADIATIONS[rad].rate0 * transmission(rad, mat, d);
}

/** Tellerate med bakgrunnen (klikk per minutt): det telleren viser i gjennomsnitt. */
export function expectedRate(rad: RadiationId, mat: MaterialId, d: number): number {
  return netRate(rad, mat, d) + BACKGROUND;
}

/** Hvor tykk skjerm som trengs for at bare andelen `fraction` skal slippe gjennom (mm), eller null hvis ingen grense. */
export function thicknessForFraction(rad: RadiationId, mat: MaterialId, fraction: number): number | null {
  if (!(fraction > 0 && fraction < 1)) return null;
  if (rad === 'alfa') return alphaRangeLeft(mat) * (1 + ALPHA_STRAGGLING);
  const half = halfThickness(rad, mat)!;
  const d = half * Math.log2(1 / fraction);
  return rad === 'beta' ? Math.min(d, BETA[mat].range) : d;
}

// ---------------------------------------------------------------------------------------------------------------
// Målingen: tilfeldige klikk i telleren

/** Liten tallgenerator med fast frø (mulberry32), så målingene og figuren blir like hver gang for samme frø. */
export function seededRandom(seed: number): () => number {
  let a = (Math.floor(seed) * 2654435761) >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Tidspunktene (s) for tilfeldige hendelser med gjennomsnittlig `ratePerMin` per minutt fram til `tMax` (en
 * poissonprosess: tida mellom to hendelser er eksponentielt fordelt).
 */
export function arrivalTimes(ratePerMin: number, tMax: number, seed: number): number[] {
  const out: number[] = [];
  const perSec = ratePerMin / 60;
  if (!(perSec > 0) || !(tMax > 0)) return out;
  const rnd = seededRandom(seed);
  let t = 0;
  for (;;) {
    t += -Math.log(1 - rnd()) / perSec;
    if (t > tMax) return out;
    out.push(t);
  }
}

/** Én partikkel fra kilden mot røret: når den kommer (s), og et tilfeldig tall som avgjør om den slipper gjennom. */
export interface Emission {
  t: number;
  v: number;
}

/**
 * Strålingen fra kilden mot røret i løpet av målingen, uten skjerm. Med skjerm slipper partikkelen gjennom når
 * `v` < andelen som slipper gjennom, så samme måling med tykkere skjerm gir færre klikk (aldri flere).
 */
export function emissions(ratePerMin: number, tMax: number, seed: number): Emission[] {
  const times = arrivalTimes(ratePerMin, tMax, seed * 2 + 1);
  const rnd = seededRandom(seed * 2 + 2);
  return times.map((t) => ({ t, v: rnd() }));
}

/** Klikkene fra kilden fram til tida `t` når andelen `T` slipper gjennom skjermen. */
export function registered(list: Emission[], T: number, t: number): number {
  let n = 0;
  for (const e of list) {
    if (e.t > t) break;
    if (e.v < T) n += 1;
  }
  return n;
}

/** Antall tidspunkter fram til og med `t` i en sortert liste. */
export function countUpTo(times: number[], t: number): number {
  let lo = 0;
  let hi = times.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (times[mid]! <= t) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

/** Hvor lenge siden (s) det siste klikket var ved tida `t` (fra kilden eller bakgrunnen), eller Infinity. */
export function timeSinceLastClick(list: Emission[], T: number, background: number[], t: number): number {
  let last = -Infinity;
  for (const e of list) {
    if (e.t > t) break;
    if (e.v < T) last = e.t;
  }
  const nb = countUpTo(background, t);
  if (nb > 0) last = Math.max(last, background[nb - 1]!);
  return t - last;
}

// ---------------------------------------------------------------------------------------------------------------
// Sporene i figuren

/** Et spor i det forstørrede utsnittet: hvor det starter og slutter (−1 til 1 av radiusen) og tilfeldige tall. */
export interface TrackDraw {
  /** Startpunkt på kilden (andel av radiusen til den aktive flekken). */
  y0: number;
  /** Retning: der sporet ville truffet vinduet (andel av radiusen til vinduet). */
  y1: number;
  /** Rangering 0 … n − 1: sporene med lavest rangering slipper gjennom først. */
  rank: number;
  /** Tilfeldige tall til dybden der partikkelen stopper og til sikksakken for β. */
  v: number;
  w: number;
}

export function trackDraws(n: number, seed: number): TrackDraw[] {
  const rnd = seededRandom(seed * 31 + 7);
  const order = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [order[i], order[j]] = [order[j]!, order[i]!];
  }
  return Array.from({ length: n }, (_, i) => {
    // Sporene spres jevnt over vinduet (lagdelt), så figuren blir rolig
    const y1 = -1 + (2 * (i + 0.2 + 0.6 * rnd())) / n;
    return { y0: 2 * rnd() - 1, y1, rank: order[i]!, v: rnd(), w: rnd() };
  });
}

/**
 * Hvor mange av `n` tegnede spor som skal slippe gjennom når andelen `T` gjør det: avrundet, men minst ett så lenge
 * minst 1 % slipper gjennom (så γ aldri ser helt stoppet ut).
 */
export function shownPassing(n: number, T: number): number {
  if (!(T > 0)) return 0;
  const k = Math.round(n * T);
  if (k === 0 && T >= 0.01) return 1;
  return Math.min(n, k);
}

/**
 * Dybden (mm) der en partikkel som blir stoppet i skjermen, stopper. `v` (0–1) er et tilfeldig tall.
 * α: like før rekkevidden er brukt opp (litt spredning). β og γ: eksponentielt fordelt, flest nær forsiden.
 */
export function stopDepth(rad: RadiationId, mat: MaterialId, d: number, v: number): number {
  const dd = safeD(d);
  if (dd === 0) return 0;
  const u = clamp01(v);
  if (rad === 'alfa') {
    const before = Math.max(0, (RADIATIONS.alfa.gap - dd) / 2);
    const left = ALPHA_RANGE[mat] * Math.max(0, 1 - before / ALPHA_RANGE_AIR);
    return Math.min(dd, Math.max(0, left * (1 + ALPHA_STRAGGLING * (2 * u - 1))));
  }
  const half = halfThickness(rad, mat)!;
  const zMax = rad === 'beta' ? Math.min(dd, BETA[mat].range) : dd;
  const p = 1 - 0.5 ** (zMax / half);
  return Math.min(zMax, -half * Math.log2(1 - u * p));
}
