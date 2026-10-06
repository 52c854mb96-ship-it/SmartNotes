/**
 * Forbikjøring på landeveien (1B, 1C, 1D): ren fysikk for k1-forbikjoring, uten React.
 *
 * En bil ligger bak en lastebil og har samme fart v₀. Ved t = 0 svinger den ut og akselererer forbi med konstant
 * akselerasjon a. Forbikjøringen er ferdig når bakenden av bilen er GAP_AHEAD foran lastebilen, så bilen kan svinge
 * inn igjen. Samtidig kommer en bil imot i det andre feltet med konstant fart u.
 *
 * Positiv retning er kjøreretningen til bilen som kjører forbi, og origo er fronten av bilen ved t = 0.
 * Den møtende bilen har derfor negativ fart (−u).
 *
 * Nøkkelen er relativ bevegelse: i forhold til lastebilen starter bilen i ro og flytter seg ½·a·t². Den må flytte seg
 *   Δs_rel = GAP_BEHIND + lastebilens lengde + bilens lengde + GAP_AHEAD
 * så tiden blir T = √(2·Δs_rel / a), uavhengig av v₀. På veien kjører bilen s = v₀·T + ½·a·T² = v₀·T + Δs_rel.
 * Den møtende bilen kjører u·T på samme tid, så avstanden D mellom frontene ved t = 0 må være minst s + u·T.
 */

export const kmhToMs = (kmh: number): number => kmh / 3.6;
export const msToKmh = (ms: number): number => ms * 3.6;

/** Lengden på bilen som kjører forbi (m), samme som BIL_MAAL.lengde i scene-kit-et. */
export const CAR_LENGTH = 4.4;
/** Avstanden fra fronten av bilen til bakenden av lastebilen før forbikjøringen (m). */
export const GAP_BEHIND = 15;
/** Avstanden fra fronten av lastebilen til bakenden av bilen når bilen svinger inn igjen (m). */
export const GAP_AHEAD = 15;
/** Farten til den møtende bilen (km/h): den holder fartsgrensen. */
export const ONCOMING_KMH = 80;
/** Fartsgrensen på veien (km/h). */
export const SPEED_LIMIT_KMH = 80;
/** Under så mange sekunder fra bilen er tilbake i feltet sitt til bilene møtes, kaller vi forbikjøringen knepen. */
export const TIGHT_MARGIN = 2;
/** Animasjonen fortsetter så lenge etter at bilene har passert hverandre (s), og minst så lenge etter T. */
export const AFTER_MEET = 1;
export const AFTER_DONE = 1.5;

export type TruckId = 'lastebil' | 'vogntog';

/** Kjøretøyene bilen kan kjøre forbi: en lastebil med skap og et vogntog (lastebil med tilhenger), største lengde i Norge. */
export const TRUCKS: Record<TruckId, { length: number; label: string; name: string }> = {
  lastebil: { length: 12, label: 'Lastebil (12 m)', name: 'lastebilen' },
  vogntog: { length: 19.5, label: 'Vogntog (19,5 m)', name: 'vogntoget' },
};

export interface OvertakeInput {
  /** Farten til lastebilen og startfarten til bilen (m/s). */
  v0: number;
  /** Akselerasjonen til bilen under forbikjøringen (m/s²). */
  a: number;
  /** Avstanden mellom fronten av bilen og fronten av den møtende bilen ved t = 0 (m). */
  D: number;
  /** Lengden på lastebilen (m). */
  truckLength: number;
  /** Farten til den møtende bilen (m/s, størrelsen). Standard 80 km/h. */
  u?: number;
}

export type Verdict = 'trygt' | 'knepent' | 'kollisjon';

export interface Overtake {
  v0: number;
  a: number;
  D: number;
  u: number;
  truckLength: number;
  /** Hvor langt bilen må flytte seg i forhold til lastebilen (m). */
  rel: number;
  /** Tiden forbikjøringen tar (s). Uendelig når a ≤ 0. */
  T: number;
  /** Strekningen lastebilen kjører mens bilen kjører forbi, v₀·T (m). */
  sTruck: number;
  /** Strekningen bilen kjører under forbikjøringen, v₀·T + ½·a·T² (m). */
  s: number;
  /** Farten til bilen når den er forbi, v₀ + a·T (m/s). */
  vEnd: number;
  /** Strekningen den møtende bilen kjører på tiden T, u·T (m). */
  sOncoming: number;
  /** Minste avstand D som trengs, s + u·T (m). */
  needed: number;
  /** D − needed (m): avstanden mellom frontene når bilen er tilbake i feltet sitt. Negativ: bilene møtes før. */
  margin: number;
  /** Tiden når fronten av bilen og fronten av den møtende bilen er like langt fram (s). */
  tMeet: number;
  /** Der det skjer (posisjon, m). */
  xMeet: number;
  /** tMeet − T (s): tid fra bilen er tilbake i feltet sitt til bilene møtes. Negativ ved kollisjon. */
  timeMargin: number;
  verdict: Verdict;
  /** Slutten av animasjonen (s): kollisjonen, eller litt etter at bilene har passert hverandre. */
  tEnd: number;
}

/** Hvor langt bilen må flytte seg i forhold til lastebilen: luke bak + lastebil + bil + luke foran. */
export function relativeDistance(truckLength: number): number {
  return GAP_BEHIND + truckLength + CAR_LENGTH + GAP_AHEAD;
}

/** Tiden det tar å flytte seg Δs i forhold til lastebilen fra relativ fart 0: ½·a·T² = Δs. */
export function overtakeTime(rel: number, a: number): number {
  if (!(a > 0)) return Infinity;
  return Math.sqrt((2 * Math.max(0, rel)) / a);
}

/** Positiv rot av ½·a·t² + b·t − c = 0 (b, c ≥ 0), regnet ut på en numerisk stabil måte. */
function positiveRoot(a: number, b: number, c: number): number {
  if (!(c > 0)) return 0;
  if (!(a > 0)) return b > 0 ? c / b : Infinity;
  return (2 * c) / (b + Math.sqrt(b * b + 2 * a * c));
}

/** Hele forbikjøringen for et tallsett. */
export function solveOvertake(input: OvertakeInput): Overtake {
  const v0 = Math.max(0, input.v0);
  const a = Math.max(0, input.a);
  const D = input.D;
  const u = Math.max(0, input.u ?? kmhToMs(ONCOMING_KMH));
  const truckLength = Math.max(0, input.truckLength);
  const rel = relativeDistance(truckLength);
  const T = overtakeTime(rel, a);
  // Uten akselerasjon kommer bilen aldri forbi (T = ∞); unngå 0 · ∞ = NaN.
  const finite = Number.isFinite(T);
  const sTruck = finite ? v0 * T : v0 > 0 ? Infinity : 0;
  const s = sTruck + rel;
  const vEnd = finite ? v0 + a * T : v0;
  const sOncoming = u * T;
  const needed = s + sOncoming;
  const margin = D - needed;

  // Møtet: først under forbikjøringen (½at² + (v₀ + u)t = D), ellers etterpå når bilen holder farten vEnd.
  let tMeet = positiveRoot(a, v0 + u, D);
  if (!(tMeet <= T)) tMeet = vEnd + u > 0 ? T + margin / (vEnd + u) : Infinity;
  const xMeet = D - u * tMeet;
  const timeMargin = tMeet - T;
  const verdict: Verdict = margin < 0 ? 'kollisjon' : timeMargin < TIGHT_MARGIN ? 'knepent' : 'trygt';

  const tEnd = verdict === 'kollisjon' ? tMeet : Math.max(T + AFTER_DONE, tMeet + AFTER_MEET);

  return { v0, a, D, u, truckLength, rel, T, sTruck, s, vEnd, sOncoming, needed, margin, tMeet, xMeet, timeMargin, verdict, tEnd };
}

/* ---------- Bevegelsen (posisjon = fronten, unntatt lastebilen) ---------- */

/** Fronten av bilen ved tiden t: konstant fart før start, konstant akselerasjon til T, så konstant fart vEnd. */
export function carFront(o: Overtake, t: number): number {
  if (t <= 0) return o.v0 * t;
  if (t <= o.T) return o.v0 * t + 0.5 * o.a * t * t;
  return o.s + o.vEnd * (t - o.T);
}

export function carVelocity(o: Overtake, t: number): number {
  if (t <= 0) return o.v0;
  if (t <= o.T) return o.v0 + o.a * t;
  return o.vEnd;
}

export function carAcceleration(o: Overtake, t: number): number {
  return t >= 0 && t < o.T ? o.a : 0;
}

/** Bakenden av lastebilen. */
export function truckRear(o: Overtake, t: number): number {
  return GAP_BEHIND + o.v0 * t;
}

/** Fronten av lastebilen. */
export function truckFront(o: Overtake, t: number): number {
  return truckRear(o, t) + o.truckLength;
}

/** Der fronten av bilen må være for at forbikjøringen er ferdig (GAP_AHEAD foran lastebilen). Følger lastebilen. */
export function targetFront(o: Overtake, t: number): number {
  return truckFront(o, t) + GAP_AHEAD + CAR_LENGTH;
}

/** Fronten av den møtende bilen (den kjører i negativ retning). */
export function oncomingFront(o: Overtake, t: number): number {
  return o.D - o.u * t;
}

/**
 * Hvor langt bilen har flyttet seg i forhold til lastebilen ved tiden t (m): ½·a·t² under forbikjøringen, Δs_rel
 * ved T. Lastebilen kjører like fort som bilen startet, så v₀·t faller bort.
 */
export function relativeGain(o: Overtake, t: number): number {
  return carFront(o, t) - (truckRear(o, t) - GAP_BEHIND);
}

/** Farten til bilen i forhold til lastebilen (m/s): a·t under forbikjøringen. */
export function relativeVelocity(o: Overtake, t: number): number {
  return carVelocity(o, t) - o.v0;
}

/**
 * Hva som skjer ved tiden t, til forklaringen: «start» (har ikke begynt), «bak» (i motgående felt, men fortsatt bak
 * lastebilen), «ved siden» (fronten er forbi bakenden av lastebilen), «foran» (bakenden er forbi fronten av
 * lastebilen, men luka er ennå ikke GAP_AHEAD), «ferdig» (t ≥ T) eller «kollisjon» (bilene har møtt hverandre før T).
 */
export type Phase = 'start' | 'bak' | 'ved siden' | 'foran' | 'ferdig' | 'kollisjon';

export function overtakePhase(o: Overtake, t: number): Phase {
  if (o.verdict === 'kollisjon' && t >= o.tMeet - 1e-9) return 'kollisjon';
  if (t >= o.T) return 'ferdig';
  if (t <= 0) return 'start';
  const front = carFront(o, t);
  if (front < truckRear(o, t)) return 'bak';
  return front - CAR_LENGTH < truckFront(o, t) ? 'ved siden' : 'foran';
}

/** Avstanden mellom fronten av bilen og fronten av den møtende bilen (m), negativ når de har passert hverandre. */
export function gapToOncoming(o: Overtake, t: number): number {
  return oncomingFront(o, t) - carFront(o, t);
}

/* ---------- Til tegningen ---------- */

/** Tiden bilen bruker på å svinge ut (s). Bare for tegningen; fysikken regner som om den er ute med en gang. */
export const PULL_OUT_TIME = 1;
/** Bilen begynner å svinge inn når bakenden er så langt foran lastebilen (m). */
export const PULL_IN_START = 4;

const smoothstep = (x: number): number => {
  const c = Math.min(1, Math.max(0, x));
  return c * c * (3 - 2 * c);
};

/**
 * Hvor langt ute i motgående felt bilen er (0 = i sitt eget felt, 1 = i motgående felt), bare til tegningen.
 * Bilen svinger ut det første sekundet og svinger inn mens bakenden går fra PULL_IN_START til GAP_AHEAD foran
 * lastebilen, så den aldri skjærer inn foran lastebilen.
 */
export function laneOffset(o: Overtake, t: number): number {
  if (t <= 0 || !(t < o.T)) return 0;
  const out = smoothstep(t / PULL_OUT_TIME);
  const clear = carFront(o, t) - CAR_LENGTH - truckFront(o, t);
  const back = smoothstep((clear - PULL_IN_START) / (GAP_AHEAD - PULL_IN_START));
  return Math.min(out, 1 - back);
}

/**
 * Største akselerasjon som holder bilen innenfor fartsgrensen hele forbikjøringen: v₀ + a·T ≤ v_maks med
 * a·T = √(2·a·Δs_rel), så a ≤ (v_maks − v₀)² / (2·Δs_rel). 0 når lastebilen allerede holder fartsgrensen.
 */
export function legalAcceleration(v0: number, rel: number, vLimit: number = kmhToMs(SPEED_LIMIT_KMH)): number {
  if (!(vLimit > v0) || !(rel > 0)) return 0;
  return (vLimit - v0) ** 2 / (2 * rel);
}

/** Tidsaksen til grafene: hele animasjonen og hele forbikjøringen, også når bilene kolliderer før T. */
export function graphDuration(o: Overtake): number {
  const end = Math.max(o.tEnd, Number.isFinite(o.T) ? o.T : 0);
  return Number.isFinite(end) && end > 0 ? end : 1;
}
