/**
 * Streknings-ATK (1B, 1C): en bil kjører gjennom en strekning med fartsmåling. Kameraene ved start (A) og slutt (B)
 * noterer klokkeslettet, og snittfarten er strekningen delt på tiden mellom dem. Ren fysikk uten React.
 *
 * Fartsprofilen er gitt som punkter (s, v) langs veien. Mellom to punkter er akselerasjonen konstant, så v² endrer seg
 * lineært med s (v² − v₀² = 2as). Da er s(t) og v(t) kjent eksakt i hver fase, og s-t-grafen er glatt (ingen knekk),
 * så tangenten finnes overalt.
 */

/** Lengden på strekningen mellom kamera A og kamera B (m). */
export const ATK_LENGTH = 4000;
/** Fartsgrensen på strekningen (km/h). */
export const SPEED_LIMIT_KMH = 80;
/** Akselerasjonen når sjåføren gir gass (m/s²): en rolig, vanlig akselerasjon for en personbil. */
export const ACCEL_UP = 1.5;
/** Akselerasjonen når sjåføren bremser (størrelse, m/s²): en rolig nedbremsing, ikke full brems. */
export const BRAKE = 2.5;
/** Køen i situasjonen «Kø på strekningen» går fra 1,5 km til 2,0 km etter kamera A. */
export const QUEUE_START = 1500;
export const QUEUE_END = 2000;
/** Klokkeslettet da bilen passerer kamera A (sekunder etter midnatt): kl. 14:02:10,4. */
export const CAMERA_A_CLOCK = 14 * 3600 + 2 * 60 + 10.4;

export const kmhToMs = (kmh: number): number => kmh / 3.6;
export const msToKmh = (ms: number): number => ms * 3.6;

/** Et punkt i fartsprofilen: farten v (m/s) der bilen er kommet s meter forbi kamera A. */
export interface ProfilePoint {
  s: number;
  v: number;
}

/** En fase med konstant akselerasjon. */
export interface Phase {
  /** Starttid (s), startposisjon (m) og startfart (m/s). */
  t0: number;
  s0: number;
  v0: number;
  /** Akselerasjon (m/s²), negativ ved bremsing. */
  a: number;
  /** Varighet (s), sluttposisjon (m) og sluttfart (m/s). */
  dt: number;
  s1: number;
  v1: number;
}

export interface Trip {
  phases: Phase[];
  /** Strekningen fra første til siste punkt (m). */
  L: number;
  /** Tiden fra kamera A til kamera B (s). */
  T: number;
  /** Farten forbi kamera A og kamera B (m/s). */
  vStart: number;
  vEnd: number;
}

/**
 * Bygger turen fra fartsprofilen. Punktene må komme i rekkefølge langs veien (s øker), og farten må være positiv.
 * Mellom to punkter er akselerasjonen konstant: a = (v₁² − v₀²) / (2Δs) og Δt = 2Δs / (v₀ + v₁).
 */
export function buildTrip(points: ProfilePoint[]): Trip {
  const first = points[0];
  if (!first) throw new Error('Fartsprofilen trenger minst ett punkt');
  const phases: Phase[] = [];
  let t = 0;
  let prev = first;
  for (let i = 1; i < points.length; i++) {
    const p = points[i]!;
    const ds = p.s - prev.s;
    if (!(p.v > 0) || !(prev.v > 0)) throw new Error('Farten må være positiv');
    if (ds < -1e-9) throw new Error('Punktene i fartsprofilen må komme i rekkefølge langs veien');
    if (ds <= 1e-9) {
      // Samme sted: farten kan ikke hoppe, så punktet må ha samme fart (ellers er profilen ugyldig)
      if (Math.abs(p.v - prev.v) > 1e-9) throw new Error('Farten kan ikke endre seg uten strekning');
      continue;
    }
    const a = (p.v * p.v - prev.v * prev.v) / (2 * ds);
    const dt = (2 * ds) / (prev.v + p.v);
    phases.push({ t0: t, s0: prev.s, v0: prev.v, a: Math.abs(a) < 1e-12 ? 0 : a, dt, s1: p.s, v1: p.v });
    t += dt;
    prev = p;
  }
  const last = points[points.length - 1]!;
  return { phases, L: last.s - first.s, T: t, vStart: first.v, vEnd: last.v };
}

/** Fasen som gjelder ved tiden t (den første ved t ≤ 0, den siste ved t ≥ T). */
function phaseAt(trip: Trip, t: number): Phase | undefined {
  const { phases } = trip;
  for (const p of phases) if (t < p.t0 + p.dt) return p;
  return phases[phases.length - 1];
}

/**
 * Posisjonen s (m etter kamera A) ved tiden t (s etter kamera A): s = s₀ + v₀τ + ½aτ² i fasen.
 * Før A og etter B kjører bilen med konstant fart (farten forbi kameraet).
 */
export function tripPosition(trip: Trip, t: number): number {
  if (!Number.isFinite(t)) return NaN;
  if (t <= 0) return trip.vStart * t;
  if (t >= trip.T) return trip.L + trip.vEnd * (t - trip.T);
  const p = phaseAt(trip, t);
  if (!p) return trip.vStart * t;
  const tau = t - p.t0;
  return p.s0 + p.v0 * tau + 0.5 * p.a * tau * tau;
}

/** Momentanfarten v (m/s) ved tiden t: v = v₀ + aτ, det speedometeret viser. */
export function tripVelocity(trip: Trip, t: number): number {
  if (!Number.isFinite(t)) return NaN;
  if (t <= 0) return trip.vStart;
  if (t >= trip.T) return trip.vEnd;
  const p = phaseAt(trip, t);
  if (!p) return trip.vStart;
  return p.v0 + p.a * (t - p.t0);
}

/** Akselerasjonen (m/s²) ved tiden t (0 før A og etter B). */
export function tripAcceleration(trip: Trip, t: number): number {
  if (!Number.isFinite(t) || t < 0 || t > trip.T) return 0;
  return phaseAt(trip, t)?.a ?? 0;
}

/** Tiden (s etter kamera A) da bilen er ved posisjonen s (m). */
export function timeAtPosition(trip: Trip, s: number): number {
  if (!Number.isFinite(s)) return NaN;
  if (s <= 0) return s / trip.vStart;
  if (s >= trip.L) return trip.T + (s - trip.L) / trip.vEnd;
  for (const p of trip.phases) {
    if (s <= p.s1) {
      const d = s - p.s0;
      if (p.a === 0) return p.t0 + d / p.v0;
      // ½aτ² + v₀τ − d = 0 ⇒ τ = (−v₀ + √(v₀² + 2ad)) / a. Roten er alltid reell inne i fasen.
      const root = Math.sqrt(Math.max(0, p.v0 * p.v0 + 2 * p.a * d));
      return p.t0 + (root - p.v0) / p.a;
    }
  }
  return trip.T;
}

/**
 * Snittfarten fra kamera A fram til tiden t: Δs / Δt = s(t) / t (m/s). Det er stigningstallet til sekanten fra
 * (0, 0) til (t, s) i s-t-grafen. Ved t = T er det snittfarten ATK-en måler. Ikke definert ved t = 0 (NaN).
 */
export function averageSpeed(trip: Trip, t: number): number {
  if (!(t > 0)) return NaN;
  return tripPosition(trip, t) / t;
}

/** Snittfarten mellom kamera A og kamera B: Δs / Δt = L / T (m/s). */
export function tripAverage(trip: Trip): number {
  return trip.T > 0 ? trip.L / trip.T : NaN;
}

/** Høyeste og laveste fart på strekningen (m/s). Farten er lineær i tiden i hver fase, så ytterpunktene er i overgangene. */
export function speedRange(trip: Trip): [number, number] {
  let lo = Math.min(trip.vStart, trip.vEnd);
  let hi = Math.max(trip.vStart, trip.vEnd);
  for (const p of trip.phases) {
    lo = Math.min(lo, p.v0, p.v1);
    hi = Math.max(hi, p.v0, p.v1);
  }
  return [lo, hi];
}

/**
 * Tidsrommene [t₀, t₁] da farten er over grensen `limit` (m/s). Farten er lineær i tiden i hver fase, så grensen
 * krysses høyst én gang per fase. Tilstøtende tidsrom slås sammen.
 */
export function speedingIntervals(trip: Trip, limit: number): [number, number][] {
  const out: [number, number][] = [];
  const add = (a: number, b: number) => {
    if (!(b - a > 1e-9)) return;
    const last = out[out.length - 1];
    if (last && a - last[1] < 1e-6) last[1] = Math.max(last[1], b);
    else out.push([a, b]);
  };
  for (const p of trip.phases) {
    const end = p.t0 + p.dt;
    const over0 = p.v0 > limit;
    const over1 = p.v1 > limit;
    if (over0 && over1) add(p.t0, end);
    else if (over0 !== over1 && p.a !== 0) {
      const tc = p.t0 + (limit - p.v0) / p.a;
      if (over0) add(p.t0, tc);
      else add(tc, end);
    }
  }
  return out;
}

/** Hvor lenge (s) farten er over grensen `limit` (m/s) mellom kamera A og kamera B. */
export function speedingTime(trip: Trip, limit: number): number {
  return speedingIntervals(trip, limit).reduce((sum, [a, b]) => sum + (b - a), 0);
}

/** Den korteste lovlige tiden (s) på strekningen `L` (m) med fartsgrensen `limitKmh`: Δt = Δs / v. */
export function minLegalTime(L: number = ATK_LENGTH, limitKmh: number = SPEED_LIMIT_KMH): number {
  return L / kmhToMs(limitKmh);
}

/** Bot når snittfarten (km/h) er over fartsgrensen (forenklet: uten sikkerhetsmarginen politiet trekker fra). */
export function getsFine(averageKmh: number, limitKmh: number = SPEED_LIMIT_KMH): boolean {
  return averageKmh > limitKmh + 1e-9;
}

/* ---------- Fartsprofiler for de tre situasjonene ---------- */

/** Strekningen (m) det tar å endre farten fra `from` til `to` (m/s) med ACCEL_UP (gass) eller BRAKE (brems). */
export function rampDistance(from: number, to: number): number {
  const a = to > from ? ACCEL_UP : BRAKE;
  return Math.abs(to * to - from * from) / (2 * a);
}

/**
 * «Bremser før kameraene»: bilen passerer kamera A med `vCam`, gir gass (eller bremser) til `vFast` med en gang og
 * holder den farten, og bremser (eller gir gass) så den har `vCam` akkurat når den passerer kamera B. Fartene i m/s.
 * Rekker ikke bilen å komme opp i `vFast` på strekningen, snur den på den høyeste farten den rekker.
 */
export function brakeProfile(vFast: number, vCam: number, L: number = ATK_LENGTH): ProfilePoint[] {
  let top = vFast;
  let d1 = rampDistance(vCam, top);
  let d2 = rampDistance(top, vCam);
  if (d1 + d2 > L) {
    // (v² − v_kam²) · (1/(2a₁) + 1/(2a₂)) = L gir den farten bilen rekker (også når den bremser først).
    const up = vFast > vCam;
    const a1 = up ? ACCEL_UP : BRAKE;
    const a2 = up ? BRAKE : ACCEL_UP;
    const dv2 = L / (1 / (2 * a1) + 1 / (2 * a2));
    top = Math.sqrt(Math.max(1e-6, vCam * vCam + (up ? dv2 : -dv2)));
    d1 = rampDistance(vCam, top);
    d2 = L - d1;
  }
  return [
    { s: 0, v: vCam },
    { s: d1, v: top },
    { s: L - d2, v: top },
    { s: L, v: vCam },
  ];
}

/**
 * «To halvdeler»: `v1` på første halvdel og `v2` på andre (m/s). Fartsendringen er midt på strekningen, like
 * mye før som etter midtpunktet.
 */
export function halvesProfile(v1: number, v2: number, L: number = ATK_LENGTH): ProfilePoint[] {
  const d = rampDistance(v1, v2);
  return [
    { s: 0, v: v1 },
    { s: L / 2 - d / 2, v: v1 },
    { s: L / 2 + d / 2, v: v2 },
    { s: L, v: v2 },
  ];
}

/**
 * «Kø på strekningen»: `vNormal` utenom køen og `vQueue` i køen (m/s). Bilen har bremset ned til køfarten når køen
 * begynner (QUEUE_START) og gir gass når den er ute av køen (QUEUE_END).
 */
export function queueProfile(vNormal: number, vQueue: number, L: number = ATK_LENGTH): ProfilePoint[] {
  const dIn = rampDistance(vNormal, vQueue);
  const dOut = rampDistance(vQueue, vNormal);
  return [
    { s: 0, v: vNormal },
    { s: QUEUE_START - dIn, v: vNormal },
    { s: QUEUE_START, v: vQueue },
    { s: QUEUE_END, v: vQueue },
    { s: QUEUE_END + dOut, v: vNormal },
    { s: L, v: vNormal },
  ];
}

export type Situation = 'brems' | 'halvdeler' | 'ko';

/** Glidebryterne i hver situasjon (km/h): navn, område og standardverdi. */
export const SITUATION_SLIDERS: Record<Situation, { a: SliderSpec; b: SliderSpec }> = {
  brems: {
    a: { label: 'Fart mellom kameraene', min: 50, max: 130, value: 105 },
    b: { label: 'Fart forbi kameraene', min: 40, max: 100, value: 75 },
  },
  halvdeler: {
    a: { label: 'Fart første halvdel', min: 30, max: 130, value: 110 },
    b: { label: 'Fart andre halvdel', min: 30, max: 130, value: 60 },
  },
  ko: {
    a: { label: 'Fart utenom køen', min: 60, max: 130, value: 100 },
    b: { label: 'Fart i køen', min: 10, max: 60, value: 20 },
  },
};

export interface SliderSpec {
  label: string;
  min: number;
  max: number;
  value: number;
}

/** Fartsprofilen for en situasjon med de to glidebryterverdiene (km/h). */
export function situationProfile(situation: Situation, aKmh: number, bKmh: number, L: number = ATK_LENGTH): ProfilePoint[] {
  const a = kmhToMs(aKmh);
  const b = kmhToMs(bKmh);
  if (situation === 'halvdeler') return halvesProfile(a, b, L);
  if (situation === 'ko') return queueProfile(a, b, L);
  return brakeProfile(a, b, L);
}

/* ---------- Tall til teksten ---------- */

/** Gjennomsnittet av to farter, (v₁ + v₂) / 2: den vanlige (feil) måten å regne snittfart for to like lange halvdeler. */
export function arithmeticMean(v1: number, v2: number): number {
  return (v1 + v2) / 2;
}

/**
 * Den riktige snittfarten for to like lange halvdeler med farten v₁ og v₂ (uten tid til fartsendringen):
 * Δt = (L/2)/v₁ + (L/2)/v₂ ⇒ v = L / Δt = 2v₁v₂ / (v₁ + v₂).
 */
export function equalDistanceAverage(v1: number, v2: number): number {
  return (2 * v1 * v2) / (v1 + v2);
}

/** Klokkeslett med tideler: 50530.4 → «14:02:10,4». Regner i hele tideler, så det ikke blir avrundingsfeil. */
export function clockText(secondsAfterMidnight: number): string {
  if (!Number.isFinite(secondsAfterMidnight)) return '–';
  const tenths = Math.round(secondsAfterMidnight * 10);
  const day = 24 * 36000;
  const t = ((tenths % day) + day) % day;
  const h = Math.floor(t / 36000);
  const m = Math.floor((t % 36000) / 600);
  const s = Math.floor((t % 600) / 10);
  const d = t % 10;
  const two = (n: number) => String(n).padStart(2, '0');
  return `${two(h)}:${two(m)}:${two(s)},${d}`;
}
