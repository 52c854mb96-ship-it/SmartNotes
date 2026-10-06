/**
 * Ren fysikk for «Sykle opp bakken» (3B arbeid og effekt, 3C potensiell energi, 3F endring i mekanisk energi).
 * Ingen React, så alt kan testes.
 *
 * Modell: syklisten og sykkelen (til sammen massen m) sykler med konstant fart v opp en rett bakke med stigningen p
 * i prosent (p meter opp for hver 100 m bortover), altså vinkelen θ = arctan(p / 100). Kreftene langs veien:
 *   G∥ = mg · sin θ          komponenten av tyngden langs veien (nedover bakken)
 *   R  = μ · N = μ · mg · cos θ   rullefriksjonen i dekkene (μ = 0,006 for sykkeldekk på asfalt)
 *   L  = k · v²               luftmotstanden (valgfri, k = 0,24 kg/m for en syklist på en vanlig sykkel)
 * Farten er konstant, så summen av kreftene langs veien er null (Newtons 1. lov). Kraften fra veien på bakhjulet
 * (drivkraften) er da
 *   F = G∥ + R + L.
 * Effekten syklisten yter, er P = F · v (vi ser bort fra tapet i kjedet). Uten luftmotstand gir det v = P / F rett
 * fram. Med luftmotstand avhenger F av v, og vi løser P = (G∥ + R + k v²) · v (én positiv løsning).
 *
 * Bakken har høydeforskjellen h, og veien er s = h / sin θ lang. Tida til toppen er t = s / v, og arbeidet
 *   W = F · s = P · t = mgh + (R + L) · s.
 * mgh blir potensiell energi. Resten blir termisk energi (varme) i dekkene og lufta. Farten er den samme hele veien,
 * så den kinetiske energien endres ikke.
 */
import { G_EARTH } from '../../kit/format';

/* ---------- Konstanter ---------- */

/** Rullefriksjonstallet μ for sykkeldekk på asfalt (R = μN). Landeveisdekk ca. 0,004, terrengdekk 0,01 eller mer. */
export const ROLLING_COEFF = 0.006;
/**
 * k i L = k v² (kg/m) for en syklist på en vanlig sykkel, med hendene på styret: ½ · ρ · C · A med lufttettheten
 * ρ = 1,2 kg/m³ og «luftmotstandsarealet» C · A ≈ 0,40 m².
 */
export const AIR_K = 0.24;
/** Musklene gjør omtrent 25 % av energien fra maten om til arbeid; resten blir varme i kroppen. */
export const MUSCLE_EFFICIENCY = 0.25;
/** En brødskive med ost gir omtrent 700 kJ (samme tall som i «Arbeid og effekt i trappa»). */
export const BREAD_SLICE_ENERGY = 700e3;
/** Under omtrent 5 km/h er det vanskelig å holde balansen på sykkelen. */
export const BALANCE_SPEED = 5 / 3.6;
/** Tråkkfrekvensen i animasjonen (omdreininger per sekund): med gir holder syklisten omtrent 80 omdreininger i minuttet. */
export const CADENCE = 80 / 60;
/** Hvor langt sykkelen kommer på én omdreining av pedalene i laveste og høyeste gir (m). */
export const GEAR_LOW = 1.6;
export const GEAR_HIGH = 9;
/** Massen til sykkelen (kg), brukt til tyngdepunktet i figuren. Resten av m er syklisten. */
export const BIKE_MASS = 10;

/**
 * Hvor mange omdreininger pedalene går per sekund ved farten v (m/s): med gir holder syklisten omtrent 80
 * omdreininger i minuttet, men i laveste gir går det ikke saktere enn v / 1,6 m (og i høyeste gir ikke fortere enn
 * v / 9 m). Bare til animasjonen.
 */
export function pedalRate(v: number): number {
  if (!(v > 0)) return 0;
  return Math.min(v / GEAR_LOW, Math.max(CADENCE, v / GEAR_HIGH));
}

/** Glidebryterne. Massen er syklisten og sykkelen sammen. */
export const MASS_MIN = 40;
export const MASS_MAX = 130;
export const POWER_MIN = 50;
export const POWER_MAX = 500;
export const GRADE_MIN = 1;
export const GRADE_MAX = 20;
export const GRADE_STEP = 0.5;

/**
 * Høydeforskjellen h (m) i glidebryteren: tettere for små bakker (10–30 m i steg på 5 m, 30–100 m i steg på 10 m,
 * 100–200 m i steg på 25 m, så 50 m opp til 1 200 m).
 */
export const HEIGHT_STEPS: readonly number[] = (() => {
  const out: number[] = [];
  for (let h = 10; h < 30; h += 5) out.push(h);
  for (let h = 30; h < 100; h += 10) out.push(h);
  for (let h = 100; h < 200; h += 25) out.push(h);
  for (let h = 200; h <= 1200; h += 50) out.push(h);
  return out;
})();

/** Indeksen til verdien i lista som ligger nærmest `v`. */
export function nearestIndex(steps: readonly number[], v: number): number {
  let best = 0;
  let bestD = Infinity;
  steps.forEach((s, i) => {
    const d = Math.abs(s - v);
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  });
  return best;
}

/* ---------- Bakken ---------- */

/** Vinkelen (radianer) til en bakke med stigningen `grade` i prosent: θ = arctan(p / 100). */
export function slopeAngle(grade: number): number {
  return Math.atan(grade / 100);
}

/** Vinkelen i grader. */
export function slopeDegrees(grade: number): number {
  return (slopeAngle(grade) * 180) / Math.PI;
}

/** Lengden av veien (m) opp en bakke med høydeforskjellen h og stigningen `grade` (%): s = h / sin θ. */
export function roadLength(h: number, grade: number): number {
  return h / Math.sin(slopeAngle(grade));
}

/* ---------- Kreftene langs veien ---------- */

export interface AlongForces {
  /** Tyngden G = mg (N). */
  G: number;
  /** Normalkraften N = mg · cos θ (N), lik komponenten av tyngden vinkelrett på veien. */
  N: number;
  /** Komponenten av tyngden langs veien, G∥ = mg · sin θ (N). */
  Gpar: number;
  /** Rullefriksjonen R = μN (N). */
  R: number;
  /** Luftmotstanden L = k v² (N), 0 uten luftmotstand. */
  L: number;
  /** Kraften fra veien på bakhjulet (drivkraften) ved konstant fart: F = G∥ + R + L (N). */
  F: number;
}

/** Kreftene langs veien når syklisten (massen m) holder farten v i en bakke med stigningen `grade` (%). */
export function alongForces(m: number, grade: number, v: number, air: boolean): AlongForces {
  const th = slopeAngle(grade);
  const G = m * G_EARTH;
  const N = G * Math.cos(th);
  const Gpar = G * Math.sin(th);
  const R = ROLLING_COEFF * N;
  const L = air ? AIR_K * v * v : 0;
  return { G, N, Gpar, R, L, F: Gpar + R + L };
}

/**
 * Den konstante farten (m/s) syklisten holder med effekten P: løsningen av P = F(v) · v. Uten luftmotstand er
 * F = G∥ + R uavhengig av farten, så v = P / F. Med luftmotstand er k v³ + A v − P = 0 med A = G∥ + R > 0. Venstre
 * side vokser med v, så det er nøyaktig én positiv løsning. Den finnes med Cardanos formel og pusses med Newtons
 * metode.
 */
export function steadySpeed(m: number, P: number, grade: number, air: boolean): number {
  const { Gpar, R } = alongForces(m, grade, 0, false);
  const A = Gpar + R;
  if (!(P > 0)) return 0;
  if (!air) return P / A;
  const p = A / AIR_K;
  const q = -P / AIR_K;
  const D = (q * q) / 4 + (p * p * p) / 27;
  let v = Math.cbrt(-q / 2 + Math.sqrt(D)) + Math.cbrt(-q / 2 - Math.sqrt(D));
  if (!(v > 0) || !Number.isFinite(v)) v = Math.min(P / A, Math.cbrt(P / AIR_K));
  for (let i = 0; i < 3; i++) {
    const f = AIR_K * v ** 3 + A * v - P;
    const df = 3 * AIR_K * v * v + A;
    v -= f / df;
  }
  return v;
}

/* ---------- Turen opp bakken ---------- */

export interface ClimbInput {
  /** Massen til syklisten og sykkelen sammen (kg). */
  m: number;
  /** Effekten syklisten yter (W). */
  P: number;
  /** Stigningen i prosent. */
  grade: number;
  /** Høydeforskjellen fra bunnen til toppen (m). */
  h: number;
  /** Med luftmotstand. */
  air: boolean;
}

export interface Climb extends AlongForces {
  input: ClimbInput;
  /** Vinkelen θ i radianer og grader. */
  theta: number;
  thetaDeg: number;
  /** Farten (m/s og km/h). */
  v: number;
  kmh: number;
  /** Veien opp bakken (m). */
  s: number;
  /** Tida til toppen (s). */
  t: number;
  /** Arbeidet F gjør hele veien opp: W = F · s = P · t (J). */
  W: number;
  /** Delen av arbeidet som blir potensiell energi: mgh (J). */
  Wg: number;
  /** Arbeidet mot rullefriksjonen R · s og luftmotstanden L · s (J): blir termisk energi. */
  Wr: number;
  Wl: number;
  /** Hvor fort syklisten kommer høyere: v · sin θ (m/s) og høydemeter i timen. */
  vVert: number;
  vam: number;
  /** Effekten per kilo (W/kg). */
  wPerKg: number;
  /** Energien kroppen bruker når musklene har virkningsgraden 25 % (J), og hvor mange brødskiver det tilsvarer. */
  body: number;
  slices: number;
}

export function climb(input: ClimbInput): Climb {
  const { m, P, grade, h, air } = input;
  const theta = slopeAngle(grade);
  const v = steadySpeed(m, P, grade, air);
  const f = alongForces(m, grade, v, air);
  const s = h / Math.sin(theta);
  const t = s / v;
  const W = f.F * s;
  const body = W / MUSCLE_EFFICIENCY;
  return {
    ...f,
    input,
    theta,
    thetaDeg: (theta * 180) / Math.PI,
    v,
    kmh: v * 3.6,
    s,
    t,
    W,
    Wg: m * G_EARTH * h,
    Wr: f.R * s,
    Wl: f.L * s,
    vVert: v * Math.sin(theta),
    vam: v * Math.sin(theta) * 3600,
    wPerKg: P / m,
    body,
    slices: body / BREAD_SLICE_ENERGY,
  };
}

export interface ClimbProgress {
  /** Tida (s), avgrenset til 0 … t. */
  tau: number;
  /** Andelen av veien. */
  frac: number;
  /** Strekningen langs veien (m), høyden over bunnen (m) og arbeidet så langt (J). */
  s: number;
  height: number;
  W: number;
}

/** Hvor langt syklisten har kommet etter tida τ (konstant fart hele veien). */
export function climbAt(c: Climb, tau: number): ClimbProgress {
  const tt = Math.min(Math.max(tau, 0), c.t);
  const frac = c.t > 0 ? tt / c.t : 0;
  return { tau: tt, frac, s: frac * c.s, height: frac * c.input.h, W: frac * c.W };
}

/** Farten (km/h) mot stigningen (%) for samme syklist og effekt: punkter til grafen. */
export function speedCurve(m: number, P: number, air: boolean, from = GRADE_MIN, to = GRADE_MAX, step = 0.25): [number, number][] {
  const out: [number, number][] = [];
  for (let g = from; g <= to + 1e-9; g += step) out.push([g, steadySpeed(m, P, g, air) * 3.6]);
  return out;
}

/* ---------- Kjente bakker ---------- */

export type HillId = 'skole' | 'trollstigen' | 'alpe';
export type Scenery = 'by' | 'aaser' | 'fjell';

export interface Hill {
  id: HillId;
  label: string;
  /** Stigningen (%) og høydeforskjellen (m), rundet til stegene i glidebryterne. */
  grade: number;
  h: number;
}

/**
 * Bakkene i forhåndsvalgene (rundede tall). Trollstigen i Romsdalen: omtrent 11 km og 850 høydemeter med 11
 * hårnålssvinger, i snitt ca. 7,5 %. Alpe d'Huez i de franske Alpene (kjent fra Tour de France): 13,8 km og ca.
 * 1 100 høydemeter med 21 svinger, i snitt ca. 8 %. Skolebakken er en vanlig, bratt bakke på 300 m.
 */
export const HILLS: readonly Hill[] = [
  { id: 'skole', label: 'Skolebakken', grade: 10, h: 30 },
  { id: 'trollstigen', label: 'Trollstigen', grade: 7.5, h: 850 },
  { id: 'alpe', label: "Alpe d'Huez", grade: 8, h: 1100 },
];

/** Forhåndsvalget som har akkurat denne stigningen og høyden, eller null. */
export function matchHill(grade: number, h: number): HillId | null {
  const hit = HILLS.find((b) => Math.abs(b.grade - grade) < 1e-9 && Math.abs(b.h - h) < 1e-9);
  return hit ? hit.id : null;
}

/** Bakgrunnen i scenen: by for små bakker, åser for mellomstore og fjell for de store. */
export function sceneryFor(h: number): Scenery {
  if (h < 100) return 'by';
  if (h < 300) return 'aaser';
  return 'fjell';
}

/* ---------- Tekst og skalaer ---------- */

/** Tida som tekst: «42 s», «3 min 12 s», «58 min», «1 t», «1 t 12 min». */
export function durationText(t: number): string {
  if (!Number.isFinite(t) || t < 0) return '–';
  if (t < 59.5) return `${Math.round(t)} s`;
  if (t < 599.5) {
    const total = Math.round(t);
    return `${Math.floor(total / 60)} min ${total % 60} s`;
  }
  const min = Math.round(t / 60);
  if (min < 60) return `${min} min`;
  return min % 60 === 0 ? `${min / 60} t` : `${Math.floor(min / 60)} t ${min % 60} min`;
}

/** Tida på klokka under avspillingen, til hele sekunder: «42 s», «24 min 31 s», «1 t 02 min». */
export function clockText(t: number): string {
  if (!Number.isFinite(t) || t < 0) return '–';
  const total = Math.floor(t);
  if (total < 60) return `${total} s`;
  if (total < 3600) return `${Math.floor(total / 60)} min ${String(total % 60).padStart(2, '0')} s`;
  return `${Math.floor(total / 3600)} t ${String(Math.floor((total % 3600) / 60)).padStart(2, '0')} min`;
}

/**
 * Tida delt i tall og enhet til en avlesning: { value: «3 min 12», unit: «s» }, { value: «1 t 12», unit: «min» } eller
 * { value: «1», unit: «t» }.
 */
export function durationParts(t: number): { value: string; unit: string } {
  const text = durationText(t);
  const i = text.lastIndexOf(' ');
  return i < 0 ? { value: text, unit: '' } : { value: text.slice(0, i), unit: text.slice(i + 1) };
}

/** Pene skalaer for kraftpilene (px per N). */
const FORCE_SCALES = [0.4, 0.5, 0.6, 0.8, 1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10, 12, 15, 20, 25, 30];

/**
 * Den største pene skalaen (px/N) som gir en pil på høyst `maxLen` for den største kraften `Fmax`. Samme skala
 * gjelder for alle pilene i figuren, så lengdene kan sammenlignes.
 */
export function forceScale(Fmax: number, maxLen: number): number {
  let best = FORCE_SCALES[0]!;
  for (const k of FORCE_SCALES) if (Fmax * k <= maxLen) best = k;
  return best;
}

/** En pen kraft (N) til målestokken under pilene: omtrent `targetPx` lang med skalaen k (px/N). */
export function scaleBarForce(k: number, targetPx: number): number {
  const raw = targetPx / k;
  const nice = [1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500];
  let best = nice[0]!;
  for (const n of nice) if (n <= raw) best = n;
  return best;
}
