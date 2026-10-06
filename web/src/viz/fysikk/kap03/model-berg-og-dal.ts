/**
 * Ren fysikk for «Berg-og-dal-bane» (3C–3F): banen, farten i hvert punkt fra energibevaring, vendepunktet og
 * en simulering av vogna langs banen. Ingen React, så alt kan testes.
 *
 * Modell: vogna er et punkt som følger skinnene (den kan ikke lette). Nullnivået er det laveste punktet på banen (A).
 * Friksjon og luftmotstand er samlet i én konstant kraft R = μ·mg mot bevegelsen (forenklet: vi ser bort fra at
 * normalkraften varierer i bakkene). Da er friksjonsarbeidet W_R = −R·s, der s er strekningen langs banen, og
 * energibevaring fra start gir
 *   mgh₀ = mgh + ½mv² + R·s   ⇒   v = √(2g(h₀ − h − μs)).
 * Massen forkortes bort, så farten avhenger ikke av hvor mange som sitter i vogna.
 */
import { G_EARTH } from '../../kit/format';

/* ---------- Tall i situasjonen ---------- */

/** Massen til den tomme vogna (kg). */
export const CART_MASS = 500;
/** Massen til én passasjer (kg). */
export const RIDER_MASS = 75;
export const MAX_RIDERS = 4;
/** Friksjon og luftmotstand samlet: R = μ·mg (3,0 % av tyngden). */
export const COASTER_MU = 0.03;
/** Starthøyden h₀ (m): der vogna står i ro etter heisebakken. */
export const H0_MIN = 10;
export const H0_MAX = 35;

export const cartMass = (riders: number): number => CART_MASS + RIDER_MASS * riders;

/** Punktene på banen med navn. A og D er bunner, B og C topper. */
export type PointId = 'A' | 'B' | 'C' | 'D';
export const POINT_IDS: PointId[] = ['A', 'B', 'C', 'D'];

/**
 * Banen mellom ytterpunktene: x vannrett (m, x = 0 i startpunktet), h høyden over nullnivået (m) og
 * krumningsradien r (m) i toppen eller bunnen. Mellom to ytterpunkter går banen i en sirkelbue, en rett strekning og
 * en ny sirkelbue (slik ekte berg-og-dal-baner er bygd), med vannrett tangent i hvert ytterpunkt.
 */
const FIXED_EXTREMES: { x: number; h: number; r: number; id?: PointId }[] = [
  { x: 22, h: 0, r: 14, id: 'A' },
  { x: 48, h: 20, r: 8, id: 'B' },
  { x: 70, h: 3, r: 12 },
  { x: 88, h: 14, r: 7, id: 'C' },
  { x: 106, h: 2, r: 10, id: 'D' },
];
/** Toppen av heisebakken ligger 3 m til venstre for startpunktet; startpunktet ligger på toppbuen. */
export const CREST_DX = 3;
export const CREST_R = 8;
/** Bremsene begynner i D; banen fortsetter flatt hit (m). */
const BRAKE_END = 140;
/** Stasjonen nederst i heisebakken (m over nullnivået). */
const STATION_H = 1;

/* ---------- Banen: buer og rette stykker ---------- */

export type Piece =
  | { kind: 'line'; x0: number; x1: number; h0: number; k: number }
  /** Sirkelbue med sentrum (cx, cy) og radius r: `top` = +1 for en topp (sentrum under), −1 for en bunn. */
  | { kind: 'arc'; x0: number; x1: number; cx: number; cy: number; r: number; top: 1 | -1 };

function pieceHeight(p: Piece, x: number): number {
  if (p.kind === 'line') return p.h0 + p.k * (x - p.x0);
  const dx = clamp(x - p.cx, -p.r, p.r);
  return p.cy + p.top * Math.sqrt(p.r * p.r - dx * dx);
}

function pieceSlope(p: Piece, x: number): number {
  if (p.kind === 'line') return p.k;
  const dx = clamp(x - p.cx, -p.r * 0.999999, p.r * 0.999999);
  return (-p.top * dx) / Math.sqrt(p.r * p.r - dx * dx);
}

/** Buelengden langs stykket fra x0 til x (m). */
function pieceLength(p: Piece, x: number): number {
  if (p.kind === 'line') return (x - p.x0) * Math.sqrt(1 + p.k * p.k);
  const phi = (v: number) => Math.asin(clamp((v - p.cx) / p.r, -1, 1));
  return p.r * (phi(x) - phi(p.x0));
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/**
 * Vinkelen θ til det rette stykket mellom to ytterpunkter: med radiene r₀ og r₁ (R = r₀ + r₁), vannrett avstand L og
 * høydeforskjell Δ må L·tan θ − R(1/cos θ − 1) = Δ. Venstresiden vokser med θ, så halveringsmetoden finner θ.
 * Er bakken for kort til radiene, gjøres radiene mindre.
 */
export function segmentAngle(L: number, delta: number, r0: number, r1: number): { theta: number; r0: number; r1: number } {
  let a = r0;
  let b = r1;
  for (let tries = 0; tries < 60; tries++) {
    const R = a + b;
    const thMax = L >= R ? Math.PI / 2 - 1e-9 : Math.asin(L / R);
    const f = (th: number) => L * Math.tan(th) - R * (1 / Math.cos(th) - 1) - delta;
    if (f(thMax) >= 0) {
      let lo = 0;
      let hi = thMax;
      for (let i = 0; i < 100; i++) {
        const mid = (lo + hi) / 2;
        if (f(mid) < 0) lo = mid;
        else hi = mid;
      }
      return { theta: (lo + hi) / 2, r0: a, r1: b };
    }
    a *= 0.85;
    b *= 0.85;
  }
  return { theta: Math.atan2(delta, L), r0: 0, r1: 0 };
}

/** Bue, rett stykke og bue fra ytterpunktet (x0, h0) til (x1, h1). */
function segment(x0: number, h0: number, r0: number, x1: number, h1: number, r1: number): Piece[] {
  const dir = h1 > h0 ? 1 : -1;
  const s = segmentAngle(x1 - x0, Math.abs(h1 - h0), r0, r1);
  const sin = Math.sin(s.theta);
  const cos = Math.cos(s.theta);
  const xa = x0 + s.r0 * sin;
  const ha = h0 + dir * s.r0 * (1 - cos);
  const xb = x1 - s.r1 * sin;
  const pieces: Piece[] = [];
  // Opp fra en bunn (sentrum over) eller ned fra en topp (sentrum under)
  if (s.r0 > 0) pieces.push({ kind: 'arc', x0, x1: xa, cx: x0, cy: h0 + dir * s.r0, r: s.r0, top: dir > 0 ? -1 : 1 });
  pieces.push({ kind: 'line', x0: xa, x1: xb, h0: ha, k: dir * Math.tan(s.theta) });
  if (s.r1 > 0) pieces.push({ kind: 'arc', x0: xb, x1, cx: x1, cy: h1 - dir * s.r1, r: s.r1, top: dir > 0 ? 1 : -1 });
  return pieces;
}

export interface CoasterPoint {
  id: PointId;
  x: number;
  h: number;
  /** Strekningen langs banen fra start (m). */
  s: number;
  /** Topp eller bunn. */
  top: boolean;
}

export interface Coaster {
  /** Starthøyden (m over nullnivået). */
  h0: number;
  pieces: Piece[];
  xMin: number;
  xMax: number;
  /** Toppen av heisebakken (litt høyere enn startpunktet). */
  crest: { x: number; h: number };
  /** Der heisebakken begynner (m). */
  liftStart: number;
  /** Bremsene begynner i D: der turen slutter. */
  xEnd: number;
  points: CoasterPoint[];
  /** Toppene etter start (B og C) og bunnen mellom dem. */
  extremes: { x: number; h: number; r: number; id?: PointId }[];
  height: (x: number) => number;
  /** Stigningstallet dh/dx. */
  slope: (x: number) => number;
  /** Krumningen 1/r (positiv i en bunn, negativ over en topp, 0 på rette stykker). */
  curvature: (x: number) => number;
  /** Strekningen langs banen fra startpunktet (negativ til venstre for det). */
  pathLength: (x: number) => number;
}

/** Høyden toppen av heisebakken ligger over startpunktet (m): startpunktet ligger på toppbuen, 3 m fra toppen. */
export const CREST_RISE = CREST_R * (1 - Math.sqrt(1 - (CREST_DX / CREST_R) ** 2));

/** Banen med starthøyden h₀. Toppene etter start ligger fast; heisebakken og første fall følger h₀. */
export function makeCoaster(h0: number): Coaster {
  const hc = h0 + CREST_RISE;
  const xc = -CREST_DX;
  const liftLen = 1.2 * (hc - STATION_H) + 6;
  const liftStart = xc - liftLen;
  const first = FIXED_EXTREMES[0]!;
  const pieces: Piece[] = [
    { kind: 'line', x0: liftStart - 30, x1: liftStart, h0: STATION_H, k: 0 },
    ...segment(liftStart, STATION_H, 10, xc, hc, CREST_R),
    ...segment(xc, hc, CREST_R, first.x, first.h, first.r),
  ];
  for (let i = 1; i < FIXED_EXTREMES.length; i++) {
    const a = FIXED_EXTREMES[i - 1]!;
    const b = FIXED_EXTREMES[i]!;
    pieces.push(...segment(a.x, a.h, a.r, b.x, b.h, b.r));
  }
  const last = FIXED_EXTREMES[FIXED_EXTREMES.length - 1]!;
  pieces.push({ kind: 'line', x0: last.x, x1: BRAKE_END, h0: last.h, k: 0 });

  const xMin = pieces[0]!.x0;
  const xMax = BRAKE_END;
  // Samlet buelengd fram til starten av hvert stykke
  const cum: number[] = [];
  let acc = 0;
  for (const p of pieces) {
    cum.push(acc);
    acc += pieceLength(p, p.x1);
  }
  const find = (x: number): number => {
    let i = 0;
    while (i < pieces.length - 1 && x > pieces[i]!.x1) i++;
    return i;
  };
  const height = (x: number) => {
    const xx = clamp(x, xMin, xMax);
    return pieceHeight(pieces[find(xx)]!, xx);
  };
  const slope = (x: number) => {
    const xx = clamp(x, xMin, xMax);
    return pieceSlope(pieces[find(xx)]!, xx);
  };
  const curvature = (x: number) => {
    const p = pieces[find(clamp(x, xMin, xMax))]!;
    return p.kind === 'arc' ? -p.top / p.r : 0;
  };
  const rawLength = (x: number) => {
    const xx = clamp(x, xMin, xMax);
    const i = find(xx);
    return cum[i]! + pieceLength(pieces[i]!, xx);
  };
  const s0 = rawLength(0);
  const pathLength = (x: number) => rawLength(x) - s0;

  const points: CoasterPoint[] = FIXED_EXTREMES.filter((e) => e.id).map((e) => ({
    id: e.id!,
    x: e.x,
    h: e.h,
    s: pathLength(e.x),
    top: e.id === 'B' || e.id === 'C',
  }));
  return {
    h0,
    pieces,
    xMin,
    xMax,
    crest: { x: xc, h: hc },
    liftStart,
    xEnd: last.x,
    points,
    extremes: FIXED_EXTREMES,
    height,
    slope,
    curvature,
    pathLength,
  };
}

export function getPoint(c: Coaster, id: PointId): CoasterPoint {
  return c.points.find((p) => p.id === id)!;
}

/* ---------- Energibevaring: farten i hvert punkt ---------- */

/**
 * Høyden energien rekker til når vogna har kjørt fram til x første gang: h₀ − μ·s(x). Uten friksjon er den h₀
 * overalt. Farten i x er v = √(2g(dette − h)).
 */
export function reachHeight(c: Coaster, x: number, mu: number): number {
  return c.h0 - mu * c.pathLength(x);
}

/** v² i x på første tur fram (kan bli negativ: da når ikke vogna fram dit). */
export function speedSquared(c: Coaster, x: number, mu: number, g = G_EARTH): number {
  return 2 * g * (reachHeight(c, x, mu) - c.height(x));
}

export interface TurnPoint {
  x: number;
  h: number;
  s: number;
}

/**
 * Det første vendepunktet etter start: der v² = 0 på vei opp en bakke. `null` når vogna kommer helt fram til
 * bremsene i D. Når h₀ er nøyaktig like høy som en topp (uten friksjon), stopper vogna akkurat på toppen.
 */
export function turningPoint(c: Coaster, mu: number): TurnPoint | null {
  const step = 0.05;
  let prev = 0;
  for (let x = step; x <= c.xEnd + 1e-9; x += step) {
    const xx = Math.min(x, c.xEnd);
    if (speedSquared(c, xx, mu) <= 1e-9) {
      let lo = prev;
      let hi = xx;
      for (let i = 0; i < 60; i++) {
        const mid = (lo + hi) / 2;
        if (speedSquared(c, mid, mu) > 1e-9) lo = mid;
        else hi = mid;
      }
      const tx = (lo + hi) / 2;
      return { x: tx, h: c.height(tx), s: c.pathLength(tx) };
    }
    prev = xx;
  }
  return null;
}

export interface PointResult extends CoasterPoint {
  /** Høyden energien rekker til der: h₀ − μs. */
  reach: number;
  /** Farten (m/s), eller null når vogna ikke kommer fram. */
  v: number | null;
}

/** Farten i A, B, C og D fra energibevaring (første tur fram). */
export function pointResults(c: Coaster, mu: number, g = G_EARTH): PointResult[] {
  const turn = turningPoint(c, mu);
  return c.points.map((p) => {
    const reach = reachHeight(c, p.x, mu);
    const reached = turn === null || p.x < turn.x;
    return { ...p, reach, v: reached ? Math.sqrt(Math.max(0, 2 * g * (reach - p.h))) : null };
  });
}

/**
 * Den laveste starthøyden som får vogna over alle toppene og fram til bremsene. Uten friksjon er det den høyeste
 * toppen etter start (B); med friksjon må h₀ også dekke friksjonsarbeidet på veien dit.
 */
export function minStartHeight(mu: number): number {
  let lo = 0;
  let hi = 80;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    if (turningPoint(makeCoaster(mid), mu) === null) hi = mid;
    else lo = mid;
  }
  return hi;
}

export interface EnergyState {
  /** Mekanisk energi ved start, E₀ = mgh₀ (J). */
  E0: number;
  /** Potensiell energi mgh (J). */
  Ep: number;
  /** Termisk energi fra friksjonen, −W_R = R·s (J). */
  heat: number;
  /** Kinetisk energi E₀ − E_p − R·s (J); negativ betyr at vogna ikke kan være der. */
  Ek: number;
  /** Mekanisk energi E_p + E_k (J). */
  E: number;
  /** Friksjonskraften R = μmg (N). */
  R: number;
  /** Farten √(2E_k/m) (m/s), 0 når E_k ≤ 0. */
  v: number;
}

/** Energiregnskapet når vogna er i høyden h etter å ha kjørt strekningen s langs banen. */
export function energyState({ m, h0, h, s, mu }: { m: number; h0: number; h: number; s: number; mu: number }, g = G_EARTH): EnergyState {
  const E0 = m * g * h0;
  const Ep = m * g * h;
  const R = mu * m * g;
  const heat = R * s;
  const Ek = E0 - Ep - heat;
  return { E0, Ep, heat, Ek, E: Ep + Ek, R, v: Ek > 0 ? Math.sqrt((2 * Ek) / m) : 0 };
}

/* ---------- Simulering langs banen ---------- */

export interface RideSample {
  t: number;
  /** Vannrett posisjon (m). */
  x: number;
  /** Fart langs banen (m/s), positiv framover (mot høyre). */
  v: number;
  /** Strekningen vogna har kjørt langs banen (m), også fram og tilbake. */
  d: number;
}

export interface Ride {
  samples: RideSample[];
  every: number;
  /** Når vogna kommer til bremsene i D, ellers null. */
  endTime: number | null;
  /** Når vogna blir stående (bare med friksjon), ellers null. */
  stopTime: number | null;
  /** Første vendepunkt (v = 0 på vei opp), ellers null. */
  turnTime: number | null;
  /** Når vogna kommer til hvert punkt første gang. Kommer den ikke fram, tiden i første vendepunkt. */
  firstTime: Record<PointId, number>;
  /** Hvor lenge animasjonen varer. */
  tEnd: number;
}

/**
 * Vogna langs banen h(x), løst med Runge–Kutta (RK4). Langs banen er
 *   dv/dt = −g·sin θ − μg·fortegn(v),   dx/dt = v·cos θ,   tan θ = h′(x).
 * Vogna starter i ro i x = 0. Med friksjon stopper den i et vendepunkt hvis tyngdekomponenten langs banen ikke er
 * større enn friksjonen. Simuleringen slutter når vogna kommer til bremsene (D) eller etter tMax.
 */
export function simulateRide(c: Coaster, mu: number, { tMax = 30, dt = 0.002, every = 0.01 } = {}, g = G_EARTH): Ride {
  const af = mu * g;
  const per = Math.max(1, Math.round(every / dt));
  const steps = Math.round(tMax / dt);
  const samples: RideSample[] = [];
  const firstTime: Partial<Record<PointId, number>> = {};
  let x = 0;
  let v = 0;
  let d = 0;
  let endTime: number | null = null;
  let stopTime: number | null = null;
  let turnTime: number | null = null;

  const deriv = (xx: number, vv: number, dir: number): [number, number, number] => {
    const k = c.slope(xx);
    const n = Math.sqrt(1 + k * k);
    return [vv / n, (-g * k) / n - dir * af, Math.abs(vv)];
  };

  samples.push({ t: 0, x, v, d });
  // Start en millimeter ut i fallet (0,4 mm lavere). Da kommer ikke vogna over en topp som er nøyaktig like høy
  // som startpunktet, i samsvar med energibevaringen (v = 0 på toppen), i stedet for å snike seg over på avrundingsfeil.
  x = 1e-3;
  d = c.pathLength(x);
  for (let i = 1; i <= steps; i++) {
    const t0 = (i - 1) * dt;
    let dir = Math.sign(v);
    if (dir === 0) {
      // I ro: begynner den å trille, og i så fall hvilken vei?
      const k = c.slope(x);
      const ag = (-g * k) / Math.sqrt(1 + k * k);
      if (mu > 0 && Math.abs(ag) <= af) {
        stopTime = t0;
        break;
      }
      dir = Math.sign(ag);
    }
    const fd = mu > 0 ? dir : 0;
    const k1 = deriv(x, v, fd);
    const k2 = deriv(x + (dt / 2) * k1[0], v + (dt / 2) * k1[1], fd);
    const k3 = deriv(x + (dt / 2) * k2[0], v + (dt / 2) * k2[1], fd);
    const k4 = deriv(x + dt * k3[0], v + dt * k3[1], fd);
    const xNew = x + (dt / 6) * (k1[0] + 2 * k2[0] + 2 * k3[0] + k4[0]);
    let vNew = v + (dt / 6) * (k1[1] + 2 * k2[1] + 2 * k3[1] + k4[1]);
    const dNew = d + (dt / 6) * (k1[2] + 2 * k2[2] + 2 * k3[2] + k4[2]);
    // Friksjonen kan ikke snu bevegelsen: farten stopper i vendepunktet.
    if (mu > 0 && Math.sign(vNew) !== dir && vNew !== 0) vNew = 0;
    if (turnTime === null && v > 0 && vNew <= 0) turnTime = t0 + (v > vNew ? (dt * v) / (v - vNew) : dt);
    for (const p of c.points) {
      if (firstTime[p.id] === undefined && vNew > 0 && x < p.x && xNew >= p.x) firstTime[p.id] = t0 + (dt * (p.x - x)) / (xNew - x);
    }
    if (xNew >= c.xEnd && vNew > 0) {
      // Fram til bremsene: siste punkt nøyaktig i D
      const f = (c.xEnd - x) / (xNew - x);
      endTime = t0 + f * dt;
      samples.push({ t: endTime, x: c.xEnd, v: v + f * (vNew - v), d: d + f * (dNew - d) });
      break;
    }
    x = xNew;
    v = vNew;
    d = dNew;
    if (i % per === 0) samples.push({ t: i * dt, x, v, d });
  }
  if (stopTime !== null) samples.push({ t: stopTime, x, v: 0, d });
  const last = samples[samples.length - 1]!;
  const fallback = turnTime ?? last.t;
  const ft = {} as Record<PointId, number>;
  for (const id of POINT_IDS) ft[id] = firstTime[id] ?? fallback;
  const tEnd = endTime ?? (stopTime !== null ? stopTime + 0.6 : tMax);
  return { samples, every: per * dt, endTime, stopTime, turnTime, firstTime: ft, tEnd };
}

/** Tilstanden ved tiden t (lineær interpolasjon mellom de lagrede punktene). */
export function rideAt(ride: Ride, t: number): RideSample {
  const s = ride.samples;
  const last = s[s.length - 1]!;
  if (t >= last.t) return last;
  if (t <= 0) return s[0]!;
  const i = Math.min(s.length - 2, Math.max(0, Math.floor(t / ride.every)));
  const a = s[i]!;
  const b = s[i + 1]!;
  const f = b.t > a.t ? clamp((t - a.t) / (b.t - a.t), 0, 1) : 0;
  return { t, x: a.x + f * (b.x - a.x), v: a.v + f * (b.v - a.v), d: a.d + f * (b.d - a.d) };
}
