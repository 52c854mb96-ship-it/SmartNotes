/**
 * Simulering av fall med luftmotstand (1E): det scenen i k1-simulering trenger i tillegg til grunnmodellen i
 * model.ts (`eulerFall`, `exactVelocity`, `exactPosition`, `terminalVelocity`). Ren fysikk uten React.
 *
 * Situasjonen: en fallskjermhopper hopper ut av et fly 4 000 m over bakken og faller fritt med luftmotstand L = kv²
 * før skjermen utløses. Positiv retning er nedover, og s er strekningen hopperen har falt.
 */
import { G_EARTH } from '../../kit/format';
import { terminalVelocity, type DragFall, type EulerRow } from './model';

/** Minste og største tidssteg på glidebryteren (s). */
export const SIM_DT_MIN = 0.1;
export const SIM_DT_MAX = 2.5;

/** Høyden flyet slipper hopperen fra (m over bakken). */
export const EXIT_HEIGHT = 4000;
/** Høyden der skjermen senest skal utløses (m over bakken). Under den er det rødt felt på høydemåleren. */
export const DEPLOY_HEIGHT = 1000;

export const toKmh = (ms: number): number => ms * 3.6;

/** Hvor lenge vi simulerer: omtrent til farten har nådd terminalfarten, avrundet opp til hele 5 s (10–40 s). */
export function simTime(vT: number, g = G_EARTH): number {
  if (!(vT > 0)) return 10;
  return Math.min(40, Math.max(10, Math.ceil((3.2 * vT) / g / 5) * 5));
}

/** Desimaler på strekningen s i tabellen (små tidssteg gir små tall i de første stegene). */
export const sDecimals = (dt: number): number => (dt < 0.5 ? 3 : 1);

/** Luftmotstanden L = kv² (N), med fortegn som farten (virker alltid mot bevegelsen). */
export function dragForce({ k }: Pick<DragFall, 'k'>, v: number): number {
  return k * v * Math.abs(v);
}

/** Tidssteget i en Euler-tabell (t i rad 1), eller `fallback` når tabellen bare har én rad. */
export function rowStep(rows: EulerRow[], fallback = 1): number {
  const dt = rows[1]?.t;
  return dt !== undefined && dt > 0 ? dt : fallback;
}

/**
 * Hvilket steg n tiden t ligger i: den siste raden med t_n ≤ t (t_n = n·Δt). En liten margin gjør at
 * t = 0,6 s med Δt = 0,3 s gir steg 2 selv om 0,6/0,3 = 1,999… i flyttall.
 */
export function stepIndex(rows: EulerRow[], t: number): number {
  if (rows.length === 0 || !Number.isFinite(t)) return 0;
  const dt = rowStep(rows);
  const n = Math.floor(t / dt + 1e-6);
  return Math.min(Math.max(0, n), rows.length - 1);
}

/** Tilstanden i simuleringen ved tiden t (det scenen viser). */
export interface EulerState {
  /** Steget t ligger i (raden simuleringen regner fra). */
  n: number;
  /** Tiden, avgrenset til simuleringen. */
  t: number;
  /** Starten av steget: t_n = n·Δt. */
  tn: number;
  /** Farten (m/s): v_n + a_n·(t − t_n), altså den rette linja Euler følger gjennom steget. */
  v: number;
  /** Strekningen (m): s_n + v_(n+1)·(t − t_n), som i oppdateringen s = s + v·Δt med den nye farten. */
  s: number;
  /** Farten i starten av steget, v_n (den simuleringen regner kreftene ut fra). */
  vn: number;
  /** Akselerasjonen i hele steget: a_n = g − (k/m)·v_n² (m/s²). */
  a: number;
  /** Luftmotstanden simuleringen bruker i hele steget: L_n = k·v_n² (N). */
  L: number;
}

/**
 * Tilstanden ved tiden t mellom to rader i Eulers metode. I et steg holder simuleringen akselerasjonen (og dermed
 * kreftene) fast på verdien fra starten av steget, så farten vokser lineært fra v_n til v_(n+1), og posisjonen
 * flytter seg med den nye farten v_(n+1) (slik `eulerFall` oppdaterer). Ved t = t_(n+1) er tilstanden lik neste rad.
 */
export function eulerStateAt(p: DragFall, rows: EulerRow[], t: number): EulerState {
  const n = stepIndex(rows, t);
  const row = rows[n] ?? { n: 0, t: 0, v: 0, a: G_EARTH, s: 0 };
  const next = rows[n + 1];
  const L = dragForce(p, row.v);
  if (!next) return { n, t: row.t, tn: row.t, v: row.v, s: row.s, vn: row.v, a: row.a, L };
  const dt = next.t - row.t;
  const tau = Math.min(Math.max(0, (Number.isFinite(t) ? t : 0) - row.t), dt);
  return { n, t: row.t + tau, tn: row.t, v: row.v + row.a * tau, s: row.s + next.v * tau, vn: row.v, a: row.a, L };
}

/**
 * Første rad i et vindu på `size` rader av tabellen, så både steg n og neste rad (n + 1) synes. De første stegene
 * står fast øverst så lenge de får plass; etter det ligger steg n som fjerde rad (to rader før og etter).
 */
export function tableWindow(n: number, total: number, size = 6): number {
  if (total <= size || n + 2 <= size) return 0;
  return Math.max(0, Math.min(n - (size - 3), total - size));
}

/* ---------- Kroppsstilling ---------- */

export type BodyPositionId = 'hode' | 'mage' | 'vid';

/**
 * Typiske luftmotstandstall for en hopper på ca. 80 kg (k = ½ρC_dA i ca. 3 km høyde, der lufta er tynnere):
 * med hodet ned er flaten liten (ca. 290 km/h), magen ned gir ca. 200 km/h, og en vid drakt med armer og bein
 * spredt ut gir ca. 160 km/h.
 */
export const BODY_POSITIONS: readonly { id: BodyPositionId; label: string; k: number }[] = [
  { id: 'hode', label: 'Hodet ned', k: 0.12 },
  { id: 'mage', label: 'Magen ned', k: 0.25 },
  { id: 'vid', label: 'Vid drakt', k: 0.4 },
];

/** Kroppsstillingen med akkurat dette luftmotstandstallet, eller null når glidebryteren står på en egen verdi. */
export function bodyPositionOf(k: number): BodyPositionId | null {
  return BODY_POSITIONS.find((b) => Math.abs(b.k - k) < 1e-6)?.id ?? null;
}

/**
 * Stillingen hopperen tegnes i for et luftmotstandstall: små k betyr liten flate mot lufta (hodet ned), store k en
 * vid drakt med armer og bein strukket ut. Grensene ligger midt mellom forhåndsvalgene, så også egne verdier på
 * glidebryteren får den nærmeste stillingen.
 */
export function bodyPoseOf(k: number): BodyPositionId {
  if (k < 0.17) return 'hode';
  return k < 0.33 ? 'mage' : 'vid';
}

/** Om hopperen tegnes med hodet ned: små luftmotstandstall betyr liten flate mot lufta. */
export const isHeadDown = (k: number): boolean => bodyPoseOf(k) === 'hode';

/* ---------- Flyet ---------- */

/**
 * Flyet står lenger inne i bildet enn hopperen (dybdefaktor: hvor mange ganger mindre det tegnes per meter), så det
 * ser ut som et ekte hoppfly bak og over ham uten å dekke ham. Kameraet følger hopperen, så flyet glir oppover med
 * strekningen han har falt, i samme dybdeskala.
 */
export const PLANE_DEPTH = 0.25;

/** Hvor langt flyet har glidd oppover i figuren (figurenheter) når hopperen har falt s meter. */
export function planeRise(s: number, pxPerM: number, depth = PLANE_DEPTH): number {
  return Math.max(0, Number.isFinite(s) ? s : 0) * pxPerM * depth;
}

/* ---------- Høyde og utløsning ---------- */

/** Høyden over bakken (m) etter å ha falt s fra `h0`, aldri under 0. */
export function altitude(s: number, h0 = EXIT_HEIGHT): number {
  return Math.max(0, h0 - (Number.isFinite(s) ? s : 0));
}

/**
 * Tiden det tar å falle strekningen `d` i virkeligheten (den eksakte løsningen s = (v_T²/g)·ln cosh(gt/v_T)):
 * t = (v_T/g)·arcosh(e^y) med y = gd/v_T², skrevet som y + ln(1 + √(1 − e^(−2y))) så den ikke flyter over.
 */
export function timeToFall(p: DragFall, d: number, g = G_EARTH): number {
  if (!(d > 0)) return 0;
  const vT = terminalVelocity(p, g);
  const y = (g * d) / (vT * vT);
  return (vT / g) * (y + Math.log1p(Math.sqrt(Math.max(0, -Math.expm1(-2 * y)))));
}

/* ---------- Skalaer i scenen ---------- */

/**
 * Skalaen for kreftene (figurenheter per N): `base`, men mindre når den største kraften ellers går ut av figuren.
 * Samme skala for G og L, så lengdene kan sammenlignes. `Lmax` er den største luftmotstanden i simuleringen
 * (med store tidssteg skyter den over G), `up` og `down` plassen over og under tyngdepunktet.
 */
export function forceScale(G: number, Lmax: number, up: number, down: number, base: number): number {
  let k = base;
  if (Lmax > 0 && up > 0) k = Math.min(k, up / Lmax);
  if (G > 0 && down > 0) k = Math.min(k, down / G);
  return k > 0 && Number.isFinite(k) ? k : base;
}

/** Største fart og største luftmotstand i simuleringen (til skalaene i scenen). */
export function extremes(p: DragFall, rows: EulerRow[]): { vMax: number; Lmax: number; aMin: number } {
  let vMax = 0;
  let aMin = 0;
  for (const r of rows) {
    if (Number.isFinite(r.v)) vMax = Math.max(vMax, Math.abs(r.v));
    if (Number.isFinite(r.a)) aMin = Math.min(aMin, r.a);
  }
  return { vMax, Lmax: dragForce(p, vMax), aMin };
}
