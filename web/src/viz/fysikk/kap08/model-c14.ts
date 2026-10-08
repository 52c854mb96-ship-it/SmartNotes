/**
 * Karbon-14-datering (8A, 8B): ren fysikk uten React.
 *
 * Mens en organisme lever, tar den opp karbon fra lufta (planter ved fotosyntesen, dyr gjennom maten), så andelen
 * C-14 i kroppen er den samme som i lufta. Når den dør, stopper opptaket, og C-14 henfaller (β⁻) til N-14 med
 * halveringstid T = 5730 år:  N = N₀ · (½)^(t/T)  ⇒  t = T · lg(N₀/N) / lg 2.
 *
 * Andelen N/N₀ er hvor mye C-14 prøven har igjen, regnet i forhold til en levende organisme (1 = like mye som nå).
 */

/** Halveringstida til C-14 i år (som i læreboka). */
export const HALF_LIFE = 5730;
/** Ett år i sekunder (365,25 døgn ≈ 3,16 · 10⁷ s). */
export const YEAR_S = 365.25 * 24 * 3600;
/** Atommasseenheten u i kg (som i læreboka). */
export const U_KG = 1.66e-27;
/** Massen til et karbonatom i u (nesten bare C-12). */
export const CARBON_MASS_U = 12.0;
/** Antall C-14-atomer per karbonatom i lufta og i levende organismer (ca. 1,2 · 10⁻¹²). */
export const C14_PER_C = 1.2e-12;

/** Tidsaksen i grafen: 0–60 000 år (drøyt ti halveringstider). */
export const T_AXIS_MAX = 60000;
/** Utsnittet som forstørres: de siste prosentene, der kurven er nesten flat. */
export const ZOOM = { tMin: 20000, tMax: 60000, pMax: 0.1 } as const;

/** Glidebryteren for målt andel, i prosent av nivået i levende organismer. */
export const MEASURED_PCT = { min: 0, max: 100, step: 0.1 } as const;
/** Glidebryteren for måleusikkerheten, i prosentpoeng (± av andelen). 0,3 er typisk for et godt laboratorium. */
export const UNCERTAINTY_PCT = { min: 0.1, max: 2, step: 0.1, initial: 0.3 } as const;

/** Antall C-14-atomer som vises i lupa (et utvalg: i virkeligheten er det milliarder). */
export const LUPE_ATOMS = 100;

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/** Andelen C-14 som er igjen etter tida t (år): (½)^(t/T). Negativ tid gir 1, uendelig tid 0. */
export function fractionLeft(t: number, T = HALF_LIFE): number {
  if (Number.isNaN(t)) return Number.NaN;
  if (t <= 0) return 1;
  return 0.5 ** (t / T);
}

/**
 * Antall halveringstider n som har gått når andelen p er igjen: n = lg(1/p) / lg 2.
 * p ≥ 1 gir 0 (prøven er fersk), p ≤ 0 gir uendelig (ingen C-14 igjen).
 */
export function halfLives(p: number): number {
  if (Number.isNaN(p)) return Number.NaN;
  if (p >= 1) return 0;
  if (p <= 0) return Number.POSITIVE_INFINITY;
  return Math.log10(1 / p) / Math.log10(2);
}

/** Alderen (år) til en prøve med andelen p igjen: t = n · T. */
export function ageFromFraction(p: number, T = HALF_LIFE): number {
  return halfLives(p) * T;
}

export interface AgeInterval {
  /** Alderen ut fra målingen. */
  age: number;
  /** Yngste mulige alder (andelen p + u). */
  young: number;
  /** Eldste mulige alder (andelen p − u), uendelig når p − u ≤ 0. */
  old: number;
  /** Om målingen skiller seg fra null: p − u > 0. Ellers vet vi bare at prøven er eldre enn `young`. */
  datable: boolean;
}

/**
 * Aldersintervallet når andelen er målt til p ± u. Kurven er bratt for unge prøver og nesten flat for gamle, så den
 * samme usikkerheten i andelen gir et mye bredere intervall i tid når prøven er gammel.
 */
export function ageInterval(p: number, u: number, T = HALF_LIFE): AgeInterval {
  const lo = p - u;
  const datable = lo > 0;
  return {
    age: ageFromFraction(p, T),
    young: ageFromFraction(clamp01(p + u), T),
    old: datable ? ageFromFraction(lo, T) : Number.POSITIVE_INFINITY,
    datable,
  };
}

/**
 * Den eldste alderen som kan måles med usikkerheten u: der andelen er like stor som usikkerheten (p = u).
 * Eldre prøver kan ikke skilles fra en prøve uten C-14.
 */
export function datingLimit(u: number, T = HALF_LIFE): number {
  return ageFromFraction(u, T);
}

/**
 * Hvor mye eldre prøver vi kan datere hvis usikkerheten blir mindre, fra u1 til u2: T · lg(u1/u2) / lg 2.
 * Ti ganger bedre måling gir bare ca. 3,3 halveringstider (19 000 år) ekstra.
 */
export function extraReach(u1: number, u2: number, T = HALF_LIFE): number {
  return datingLimit(u2, T) - datingLimit(u1, T);
}

/** Antall karbonatomer i 1 g karbon: 1 g / (12,0 u). */
export function carbonAtomsPerGram(): number {
  return 1e-3 / (CARBON_MASS_U * U_KG);
}

/** Antall C-14-atomer i 1 g karbon med andelen p igjen (p = 1: levende organisme). */
export function c14AtomsPerGram(p = 1): number {
  return C14_PER_C * carbonAtomsPerGram() * p;
}

/** Desintegrasjonskonstanten λ = ln 2 / T i s⁻¹. */
export function decayConstant(T = HALF_LIFE): number {
  return Math.LN2 / (T * YEAR_S);
}

/** Aktiviteten (Bq) i 1 g karbon med andelen p igjen: A = λ · N. Levende: ca. 0,23 Bq per gram. */
export function activityPerGram(p = 1): number {
  return decayConstant() * c14AtomsPerGram(p);
}

/** Antall henfall per time i 1 g karbon. */
export function decaysPerHour(p = 1): number {
  return activityPerGram(p) * 3600;
}

/** Alder avrundet som i en dateringsrapport: til nærmeste 10 år under 10 000 år, ellers til nærmeste 100 år. */
export function roundAge(t: number): number {
  if (!Number.isFinite(t)) return t;
  const step = t < 10000 ? 10 : 100;
  return Math.round(t / step) * step;
}

/** Hvor mange av `n` C-14-atomer som er igjen når andelen er p (avrundet, 0–n). */
export function remainingOf(n: number, p: number): number {
  if (!Number.isFinite(p)) return 0;
  return Math.round(n * clamp01(p));
}

/** Liten tallgenerator med fast frø (mulberry32), så lupa ser lik ut hver gang. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Rekkefølgen atomene henfaller i: rank[i] er plassen til atom i (0 = henfaller sist). Atom i er fortsatt C-14 når
 * rank[i] < antallet som er igjen. Rekkefølgen er tilfeldig (henfall er tilfeldig), men fast for samme frø, så
 * atomene henfaller ett og ett når andelen går ned, og kommer tilbake i samme rekkefølge når den går opp.
 */
export function decayRanks(n: number, seed = 14): number[] {
  const rnd = mulberry32(seed);
  const order = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    const a = order[i]!;
    order[i] = order[j]!;
    order[j] = a;
  }
  const rank = new Array<number>(n).fill(0);
  order.forEach((atom, r) => {
    rank[atom] = r;
  });
  return rank;
}

/**
 * Plassene til n atomer jevnt fordelt i en sirkel med radius 1 (solsikkemønster), med litt fast uro så det ser ut
 * som et stoff og ikke et rutenett.
 */
export function lupePositions(n: number, seed = 3): { x: number; y: number }[] {
  const rnd = mulberry32(seed);
  const golden = Math.PI * (3 - Math.sqrt(5));
  return Array.from({ length: n }, (_, i) => {
    const r = Math.sqrt((i + 0.5) / n);
    const a = i * golden;
    const jr = (rnd() - 0.5) * 0.04;
    const ja = (rnd() - 0.5) * 0.12;
    const rr = Math.min(1, Math.max(0, r + jr));
    return { x: rr * Math.cos(a + ja), y: rr * Math.sin(a + ja) };
  });
}

export type SampleId = 'vikingskip' | 'otzi' | 'ildsted' | 'mammut' | 'dinosaur';

export interface C14Sample {
  id: SampleId;
  /** Kort navn til knappen. */
  label: string;
  /** Hva prøven er, til etiketten i figuren. */
  name: string;
  /** Omtrentlig alder i år (til å lage en målt andel). */
  age: number;
}

/**
 * Prøvene. Alderen er omtrentlig (kjente funn og tidsperioder), og den «målte» andelen regnes ut av alderen og
 * avrundes til 0,1 %, som en måling.
 */
export const C14_SAMPLES: C14Sample[] = [
  { id: 'vikingskip', label: 'Vikingskip', name: 'Eikeplanke fra et vikingskip', age: 1200 },
  { id: 'otzi', label: 'Ötzi', name: 'Beinprøve fra ismannen Ötzi', age: 5300 },
  { id: 'ildsted', label: 'Ildsted', name: 'Trekull fra et ildsted fra steinalderen', age: 10000 },
  { id: 'mammut', label: 'Mammut', name: 'Støttann fra en mammut', age: 30000 },
  { id: 'dinosaur', label: 'Dinosaur', name: 'Fossilt dinosaurbein', age: 66e6 },
];

export function getSample(id: SampleId): C14Sample {
  return C14_SAMPLES.find((s) => s.id === id) ?? C14_SAMPLES[0]!;
}

/** Den målte andelen i prosent (avrundet til 0,1 %, som glidebryteren). */
export function samplePercent(s: C14Sample): number {
  return Math.round(fractionLeft(s.age) * 1000) / 10;
}

/** Hvilken prøve en målt andel (i prosent) hører til, eller null når eleven har flyttet glidebryteren selv. */
export function sampleForPercent(id: SampleId, pct: number): SampleId | null {
  return Math.abs(samplePercent(getSample(id)) - pct) < 1e-9 ? id : null;
}

/**
 * Alderen under avspillingen «fra døden til i dag»: progress går fra 0 til 1, og alderen vokser jevnt opp til
 * prøvens alder. Prøver uten målbar C-14 spilles bare til enden av tidsaksen.
 */
export function playbackAge(progress: number, p: number): number {
  const target = Math.min(ageFromFraction(p), T_AXIS_MAX);
  return clamp01(progress) * target;
}

/** Tall med n gjeldende siffer, f.eks. 0,2306 → 0,231 (n = 3). */
export function roundSig(v: number, n = 3): number {
  if (!Number.isFinite(v) || v === 0) return v;
  const d = n - 1 - Math.floor(Math.log10(Math.abs(v)));
  const f = 10 ** d;
  return Math.round(v * f) / f;
}
