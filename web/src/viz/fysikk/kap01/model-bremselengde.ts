/**
 * Bremselengde med en elg i veien (1D): ren fysikk for scenen i k1-bremselengde, uten React.
 *
 * Grunnmodellen (reaksjonslengde s_r = v₀·t_r og bremselengde s_b = v₀²/2a) ligger i model.ts (`stopping`). Her er
 * det som kommer i tillegg med en hindring: om bilen rekker å stoppe, og ellers farten når den treffer
 * (v² − v₀² = 2·(−a)·s, der s er strekningen bilen bremser før treffet). Positiv retning er kjøreretningen, og
 * posisjonen er fronten av bilen målt fra der den var da sjåføren så elgen.
 */
import { BRAKE_PRESETS, stopPosition, stopVelocity, stopping, type StopInput } from './model';

export const msToKmh = (ms: number): number => ms * 3.6;

/* ---------- Føre ---------- */

export type SurfaceId = 'torr' | 'vat' | 'sno' | 'is';
/** Typen vei i scene-kit-et (Vei `type`). */
export type RoadType = 'asfalt' | 'vaat-asfalt' | 'sno' | 'is';

/**
 * Føret og den typiske bremseakselerasjonen (størrelse, m/s²) med ABS-bremser: tørr asfalt (μ ≈ 0,8), våt asfalt
 * (μ ≈ 0,5), hardpakket snø (μ ≈ 0,25) og is (μ ≈ 0,1), med a ≈ μg.
 */
export const SURFACES: readonly { id: SurfaceId; label: string; a: number; road: RoadType }[] = [
  { id: 'torr', label: 'Tørr asfalt', a: BRAKE_PRESETS.torr, road: 'asfalt' },
  { id: 'vat', label: 'Våt asfalt', a: BRAKE_PRESETS.vat, road: 'vaat-asfalt' },
  { id: 'sno', label: 'Snø', a: 2.5, road: 'sno' },
  { id: 'is', label: 'Is', a: BRAKE_PRESETS.is, road: 'is' },
];

/** Føret med akkurat denne bremseakselerasjonen, eller null når glidebryteren står på en egen verdi. */
export function surfaceOf(a: number): SurfaceId | null {
  return SURFACES.find((s) => Math.abs(s.a - a) < 1e-9)?.id ?? null;
}

/**
 * Veien scenen tegner for en bremseakselerasjon: føret med nærmest bremseakselerasjon på en logaritmisk skala
 * (grensene er de geometriske middelverdiene, f.eks. √(8,0 · 5,0) ≈ 6,3 m/s² mellom tørr og våt asfalt).
 */
export function roadFor(a: number): RoadType {
  let best = SURFACES[0]!;
  for (const s of SURFACES) if (Math.abs(Math.log(a / s.a)) < Math.abs(Math.log(a / best.a))) best = s;
  return best.road;
}

/* ---------- Elgen i veien ---------- */

export interface ObstacleResult {
  /** Om bilen treffer elgen før den står stille. */
  hits: boolean;
  /** Om treffet skjer før sjåføren har begynt å bremse (elgen er nærmere enn reaksjonslengden). */
  beforeBraking: boolean;
  /** Når bevegelsen slutter (s etter at sjåføren ser elgen): ved treffet eller når bilen står stille. */
  tEnd: number;
  /** Farten når bilen treffer elgen (m/s), 0 når den rekker å stoppe. */
  vHit: number;
  /** Strekningen bilen bremser før den treffer eller stopper (m). */
  braked: number;
  /** Avstanden som er igjen til elgen når bilen står stille (m), 0 ved treff. */
  margin: number;
  /** Der fronten av bilen ender (m): ved elgen eller der bilen stopper. */
  sEnd: number;
}

/**
 * Hva som skjer med en elg `D` meter foran fronten av bilen i det sjåføren ser den. Bilen kjører med konstant fart
 * i reaksjonstiden og bremser så med konstant akselerasjon −a. Rekker den ikke å stoppe, treffer den elgen med
 * farten v = √(v₀² − 2a(D − s_r)). Står bilen akkurat ved elgen (stopplengden = D), regnes det som at den rekker det.
 */
export function obstacle(input: StopInput, D: number): ObstacleResult {
  const { v0, tr, a } = input;
  const r = stopping(input);
  const d = Math.max(0, D);
  if (r.total <= d + 1e-9) {
    return { hits: false, beforeBraking: false, tEnd: r.tStop, vHit: 0, braked: r.sb, margin: Math.max(0, d - r.total), sEnd: r.total };
  }
  if (d <= r.sr) {
    // Treffer i reaksjonstiden, med full fart
    return { hits: true, beforeBraking: true, tEnd: v0 > 0 ? d / v0 : 0, vHit: v0, braked: 0, margin: 0, sEnd: d };
  }
  const braked = d - r.sr;
  const vHit = Math.sqrt(Math.max(0, v0 * v0 - 2 * a * braked));
  return { hits: true, beforeBraking: false, tEnd: tr + (v0 - vHit) / a, vHit, braked, margin: 0, sEnd: d };
}

/** Fronten av bilen t sekunder etter at sjåføren ser elgen. Bilen kommer aldri forbi elgen. */
export function carPosition(input: StopInput, D: number, t: number): number {
  return Math.min(stopPosition(input, t), Math.max(0, D));
}

/** Farten t sekunder etter at sjåføren ser elgen. Etter et treff regnes bilen som stoppet (vi ser bort fra støtet). */
export function carVelocity(input: StopInput, D: number, t: number): number {
  const o = obstacle(input, D);
  if (o.hits && t >= o.tEnd) return 0;
  return stopVelocity(input, t);
}

/**
 * Den største farten (m/s) bilen kan ha og likevel stoppe på strekningen S med reaksjonstid t_r og
 * bremseakselerasjon a: v·t_r + v²/(2a) = S gir v = a·(√(t_r² + 2S/a) − t_r).
 */
export function speedForStoppingDistance(S: number, tr: number, a: number): number {
  if (!(S > 0) || !(a > 0)) return 0;
  return a * (Math.sqrt(tr * tr + (2 * S) / a) - tr);
}

/* ---------- Utsnittet av veien i scenen ---------- */

/** Så mye av veien scenen viser bak startpunktet (m): hele bilen (4,4 m) og litt luft. */
export const VIEW_BEHIND = 7;

/**
 * Utsnittet av veien (m) som scenen viser: fra litt bak bilen til litt forbi elgen (`elk` er hvor langt elgen og
 * luften bak den rekker forbi D). Er stopplengden lengre, tas den med så lenge utsnittet ikke blir mer enn
 * halvannen gang så langt (ellers blir bilen for liten); da vises resten med en pil. Enden rundes opp til et
 * helt antall femmere (ikke tiere), så utsnittet slutter like bak elgen og bil og elg blir så store som mulig.
 */
export function sceneRange(D: number, total: number, elk = 5): { min: number; max: number } {
  const need = Math.max(0, D) + elk;
  const end = Number.isFinite(total) && total + 2 > need && total + 2 <= 1.5 * need ? total + 2 : need;
  return { min: -VIEW_BEHIND, max: Math.ceil(end / 5 - 1e-9) * 5 };
}

/* ---------- Pilene for v og a over bilen ---------- */

/**
 * Faste skalaer for pilene i scenen (figurenheter, før mobilfaktoren): v-pila er `v` enheter lang ved startfarten
 * til bilen med full fart (også i stripen med halv fart), og a-pila er `a` enheter per m/s². Skalaene er like i
 * begge stripene og hele bevegelsen, og pilene kortes aldri: mangler det plass, flyttes de (`arrowPairCenter`).
 */
export const ARROW_SCALE = { v: 110, a: 18 } as const;

/**
 * Midtpunktet til pilparet over bilen (a-pila mot venstre og v-pila mot høyre, med halene på hver side av
 * midtpunktet): rett over bilen (`mid`) når begge får plass, ellers flyttet akkurat så langt at de får plass
 * mellom x0 og x1. `left` og `right` er plassen hver pil trenger (pil, etikett og luften ved midtpunktet).
 */
export function arrowPairCenter(mid: number, left: number, right: number, x0: number, x1: number): number {
  const lo = x0 + Math.max(0, left);
  const hi = x1 - Math.max(0, right);
  if (lo > hi) return (lo + hi) / 2;
  return Math.min(hi, Math.max(lo, Number.isFinite(mid) ? mid : (lo + hi) / 2));
}
