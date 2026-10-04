/** Ren fysikk for kapittel 1 (ingen React), så den kan testes for seg. */
import { G_EARTH } from '../kit/format';

/* ---------- Hjelpere for akser ---------- */

/** «Pent» steg (1, 2, 5 · 10ⁿ) for omtrent `count` intervaller – samme regel som niceTicks i kit. */
export function niceStep(span: number, count = 5): number {
  if (!(span > 0)) return 1;
  const raw = span / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const norm = raw / mag;
  return (norm >= 5 ? 10 : norm >= 2 ? 5 : norm >= 1 ? 2 : 1) * mag;
}

/** Utvider [lo, hi] til pene grenser og gir steget som ble brukt. Spennet blir minst `minSpan`. */
function niceBounds(lo: number, hi: number, count: number, minSpan: number): [number, number, number] {
  let a = Math.min(lo, hi);
  let b = Math.max(lo, hi);
  if (b - a < minSpan) {
    const mid = (a + b) / 2;
    a = mid - minSpan / 2;
    b = mid + minSpan / 2;
    // Hold null som grense når alle verdiene ligger på samme side av null
    if (Math.min(lo, hi) >= 0 && Math.max(lo, hi) > 0 && a < 0) {
      b -= a;
      a = 0;
    } else if (Math.max(lo, hi) <= 0 && Math.min(lo, hi) < 0 && b > 0) {
      a -= b;
      b = 0;
    }
  }
  const step = niceStep(b - a, count);
  return [Math.floor(a / step + 1e-9) * step + 0, Math.ceil(b / step - 1e-9) * step + 0, step];
}

/** Utvider [lo, hi] til nærmeste pene akseverdier. Spennet blir minst `minSpan`. */
export function niceRange(lo: number, hi: number, count = 5, minSpan = 1): [number, number] {
  const [a, b] = niceBounds(lo, hi, count, minSpan);
  return [a, b];
}

/**
 * Som niceRange, men gir også akseverdiene: alle multipler av det samme steget fra min til max (minst tre).
 * (Å regne ut et nytt steg for akseverdiene etterpå kan gi bare én eller to verdier, f.eks. bare 0 på [−40, 40].)
 */
export function niceAxis(lo: number, hi: number, count = 5, minSpan = 1): { min: number; max: number; ticks: number[] } {
  const [min, max, step] = niceBounds(lo, hi, count, minSpan);
  const ticks: number[] = [];
  for (let i = Math.round(min / step); i <= Math.round(max / step); i++) ticks.push(Number((i * step).toPrecision(12)) + 0);
  return { min, max, ticks };
}

/* ---------- 1C Bevegelsesgrafer (konstant akselerasjon) ---------- */

export interface Motion {
  /** Startposisjon s₀ (m). */
  s0: number;
  /** Startfart v₀ (m/s), kan være negativ. */
  v0: number;
  /** Konstant akselerasjon a (m/s²). */
  a: number;
}

/** s = s₀ + v₀t + ½at² */
export function position({ s0, v0, a }: Motion, t: number): number {
  return s0 + v0 * t + 0.5 * a * t * t;
}

/** v = v₀ + at */
export function velocity({ v0, a }: Motion, t: number): number {
  return v0 + a * t;
}

/** Tidspunktet der farten er null og vogna snur (bare når t > 0), ellers null. */
export function turnTime({ v0, a }: Motion): number | null {
  if (a === 0 || v0 === 0) return null;
  const t = -v0 / a;
  return t > 0 ? t : null;
}

/** Forflytningen fra 0 til t, Δs = v₀t + ½at² = arealet under v-t-grafen (med fortegn). */
export function displacement(m: Motion, t: number): number {
  return position(m, t) - m.s0;
}

/** Strekningen vogna faktisk har kjørt fra 0 til t (veilengde), uansett retning. */
export function pathLength(m: Motion, t: number): number {
  const tt = turnTime(m);
  if (tt !== null && tt < t) return Math.abs(displacement(m, tt)) + Math.abs(position(m, t) - position(m, tt));
  return Math.abs(displacement(m, t));
}

/** Største og minste posisjon i tidsrommet [0, T]. */
export function positionExtent(m: Motion, T: number): [number, number] {
  const vals = [position(m, 0), position(m, T)];
  const tt = turnTime(m);
  if (tt !== null && tt < T) vals.push(position(m, tt));
  return [Math.min(...vals), Math.max(...vals)];
}

export type SpeedTrend = 'ro' | 'konstant' | 'starter' | 'snur' | 'øker' | 'avtar';

/**
 * Om banefarten (størrelsen av v) øker eller avtar: øker når v og a har samme fortegn, avtar når de har motsatt.
 * Med v = 0 og a ≠ 0 starter vogna fra ro (v₀ = 0) eller snur (v skifter fortegn).
 * `eps` er grensen for når vi sier at v er null.
 */
export function speedTrend({ v0, a }: Motion, t: number, eps = 0.05): SpeedTrend {
  const v = v0 + a * t;
  if (a === 0) return Math.abs(v) < eps ? 'ro' : 'konstant';
  if (Math.abs(v) < eps) return Math.abs(v0) < eps ? 'starter' : 'snur';
  return Math.sign(v) === Math.sign(a) ? 'øker' : 'avtar';
}

/* ---------- 1D Reaksjonslengde og bremselengde ---------- */

export const kmhToMs = (kmh: number): number => kmh / 3.6;

/** Typiske bremseakselerasjoner (størrelse, m/s²). */
export const BRAKE_PRESETS = {
  torr: 8.0,
  vat: 5.0,
  is: 1.0,
} as const;

export interface StopInput {
  /** Fart før oppbremsingen (m/s). */
  v0: number;
  /** Reaksjonstid (s). */
  tr: number;
  /** Størrelsen på bremseakselerasjonen (m/s²), > 0. */
  a: number;
}

export interface StopResult {
  /** Reaksjonslengde s_r = v₀·t_r. */
  sr: number;
  /** Bremselengde s_b = v₀²/(2a). */
  sb: number;
  /** Stopplengde s_r + s_b. */
  total: number;
  /** Bremsetid t_b = v₀/a. */
  tb: number;
  /** Tid fra faren oppdages til bilen står (t_r + t_b). */
  tStop: number;
}

export function stopping({ v0, tr, a }: StopInput): StopResult {
  const sr = v0 * tr;
  const sb = (v0 * v0) / (2 * a);
  const tb = v0 / a;
  return { sr, sb, total: sr + sb, tb, tStop: tr + tb };
}

/** Farten t sekunder etter at sjåføren ser faren. */
export function stopVelocity({ v0, tr, a }: StopInput, t: number): number {
  if (t <= tr) return v0;
  return Math.max(0, v0 - a * (t - tr));
}

/** Strekningen bilen har kjørt t sekunder etter at sjåføren ser faren. */
export function stopPosition(input: StopInput, t: number): number {
  const { v0, tr, a } = input;
  if (t <= tr) return v0 * Math.max(0, t);
  const tb = Math.min(t - tr, v0 / a);
  return v0 * tr + v0 * tb - 0.5 * a * tb * tb;
}

/* ---------- 1D Loddrett kast (positiv retning oppover) ---------- */

export interface Throw {
  /** Startfart (m/s), positiv oppover. */
  v0: number;
  /** Starthøyde over bakken (m), ≥ 0. */
  h0: number;
}

/** Høyden over bakken: s = h₀ + v₀t − ½gt². */
export function throwHeight({ v0, h0 }: Throw, t: number, g = G_EARTH): number {
  return h0 + v0 * t - 0.5 * g * t * t;
}

/** Farten: v = v₀ − gt. */
export function throwVelocity({ v0 }: Throw, t: number, g = G_EARTH): number {
  return v0 - g * t;
}

/** Tiden til ballen treffer bakken (s = 0). Null hvis den ligger på bakken og ikke kastes oppover. */
export function flightTime({ v0, h0 }: Throw, g = G_EARTH): number {
  if (h0 <= 0 && v0 <= 0) return 0;
  return (v0 + Math.sqrt(v0 * v0 + 2 * g * Math.max(0, h0))) / g;
}

/** Tidspunktet for toppunktet (v = 0), eller null hvis ballen kastes nedover eller slippes. */
export function topTime({ v0 }: Throw, g = G_EARTH): number | null {
  return v0 > 0 ? v0 / g : null;
}

/** Største høyde over bakken. */
export function maxHeight({ v0, h0 }: Throw, g = G_EARTH): number {
  return v0 > 0 ? h0 + (v0 * v0) / (2 * g) : h0;
}

/** Farten (størrelse) når ballen treffer bakken: v² = v₀² + 2gh₀. */
export function impactSpeed({ v0, h0 }: Throw, g = G_EARTH): number {
  if (h0 <= 0 && v0 <= 0) return 0;
  return Math.sqrt(v0 * v0 + 2 * g * Math.max(0, h0));
}

/* ---------- 1E Simulering: fall med luftmotstand L = kv² (Eulers metode) ---------- */

export interface DragFall {
  /** Masse (kg). */
  m: number;
  /** Luftmotstandstall k i L = kv² (kg/m). */
  k: number;
}

export interface EulerRow {
  /** Steg nummer n. */
  n: number;
  t: number;
  v: number;
  a: number;
  s: number;
}

/** Terminalfarten der L = G: v_T = √(mg/k). */
export function terminalVelocity({ m, k }: DragFall, g = G_EARTH): number {
  return Math.sqrt((m * g) / k);
}

/** Akselerasjonen a = (G − L)/m = g − (k/m)·v² (positiv retning nedover). */
export function dragAcceleration({ m, k }: DragFall, v: number, g = G_EARTH): number {
  return g - (k / m) * v * Math.abs(v);
}

/** Eksakt løsning: v(t) = v_T·tanh(gt/v_T). */
export function exactVelocity(p: DragFall, t: number, g = G_EARTH): number {
  const vT = terminalVelocity(p, g);
  return vT * Math.tanh((g * t) / vT);
}

/** Eksakt strekning: s(t) = (v_T²/g)·ln cosh(gt/v_T), skrevet så den ikke flyter over. */
export function exactPosition(p: DragFall, t: number, g = G_EARTH): number {
  const vT = terminalVelocity(p, g);
  const x = Math.abs((g * t) / vT);
  return ((vT * vT) / g) * (x + Math.log1p(Math.exp(-2 * x)) - Math.LN2);
}

/**
 * Eulers metode som i ERGO 1E: regn ut a fra farten, oppdater farten først og så posisjonen:
 *   a = g − (k/m)v²,  v = v + a·Δt,  s = s + v·Δt,  t = t + Δt
 * Raden for steg n viser t, v, s og akselerasjonen som brukes i neste steg.
 */
export function eulerFall(p: DragFall, dt: number, tEnd: number, g = G_EARTH): EulerRow[] {
  const rows: EulerRow[] = [];
  const steps = Math.max(1, Math.round(tEnd / dt));
  const vLimit = 50 * terminalVelocity(p, g);
  let v = 0;
  let s = 0;
  for (let n = 0; n <= steps; n++) {
    const a = dragAcceleration(p, v, g);
    rows.push({ n, t: n * dt, v, a, s });
    v += a * dt;
    s += v * dt;
    if (!Number.isFinite(v) || Math.abs(v) > vLimit) break;
  }
  return rows;
}

/** Største avvik |v_Euler − v_eksakt| over alle stegene. */
export function maxVelocityError(p: DragFall, rows: EulerRow[], g = G_EARTH): number {
  let worst = 0;
  for (const r of rows) worst = Math.max(worst, Math.abs(r.v - exactVelocity(p, r.t, g)));
  return worst;
}
