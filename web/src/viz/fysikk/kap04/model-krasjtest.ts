/**
 * Krasjtest (4A, 4B): en bil kjører rett inn i en stiv betongvegg, og en krasjtestdukke sitter i forsetet.
 * Ren fysikk uten React, så den kan testes for seg.
 *
 * Modellen (t = 0 når støtfangeren treffer veggen, positiv retning er fartsretningen):
 * - Bilen bremses jevnt fra v₀ til ro mens fronten (knusesonen) presses sammen strekningen d:
 *   a = v₀²/(2d) og t = 2d/v₀. Bilen flytter seg altså d etter at den har truffet veggen.
 * - Med belte (og kollisjonspute) bremses passasjeren jevnt fra treffet til hen står stille. Beltet strekkes og puta
 *   presses sammen, så passasjeren glir Δx fram i bilen og bremses over s = d + Δx. Jevn kraft er det beste et belte
 *   med kraftbegrenser kan få til.
 * - Uten belte holder ingenting igjen (Newtons 1. lov): passasjeren fortsetter med v₀ mens bilen bremser, til hen
 *   treffer frontruta og dashbordet 0,45 m lenger fram i bilen. Der stoppes hen i forhold til bilen på noen få
 *   centimeter (hode, bryst, rute og dashbord gir litt etter). Avstanden er minst like stor som den lengste knusesonen,
 *   så treffet kommer alltid etter at bilen har stoppet.
 *
 * Impulsloven: F_gj · Δt = Δp = m · v₀ er den samme i alle tilfellene. Med jevn oppbremsing er gjennomsnittsfarten
 * v₀/2, så Δt = 2s/v₀ og F_gj = m · v₀²/(2s).
 */
import { G_EARTH } from '../../kit/format';

/** Sikringen til passasjeren. */
export type Restraint = 'ingen' | 'belte' | 'pute';

export interface RestraintSpec {
  /** Knappetekst. */
  label: string;
  /**
   * Hvordan passasjeren bremses: «jevn» = med jevn kraft fra treffet (belte), «treff» = først fri bevegelse fram i
   * bilen, deretter stoppet mot dashbordet (uten belte).
   */
  kind: 'jevn' | 'treff';
  /** Hvor langt passasjeren kan bevege seg fram i bilen før noe bremser hen (m). */
  free: number;
  /** Hvor langt passasjeren flytter seg fram i bilen mens beltet, puta eller dashbordet bremser hen (m). */
  stroke: number;
}

export const RESTRAINTS: Record<Restraint, RestraintSpec> = {
  ingen: { label: 'Uten belte og pute', kind: 'treff', free: 0.45, stroke: 0.05 },
  belte: { label: 'Bilbelte', kind: 'jevn', free: 0, stroke: 0.2 },
  pute: { label: 'Belte og pute', kind: 'jevn', free: 0, stroke: 0.35 },
};

export const RESTRAINT_ORDER: Restraint[] = ['ingen', 'belte', 'pute'];

/** Krasjtestdukken (en voksen mann) veier 78 kg. */
export const DUMMY_MASS = 78;

/** Glidebryterne: farten før treffet (km/h) og hvor mye knusesonen presses sammen (m). */
export const SPEED_KMH = { min: 30, max: 90, step: 5, initial: 50 } as const;
export const CRUSH = { min: 0.1, max: 0.45, step: 0.05, initial: 0.4 } as const;
/** Grensen for «stiv bil» i forklaringen og figuren (m). */
export const STIFF_CRUSH = 0.2;

/** Tiden figuren og grafen viser etter treffet (s). Alle tallsett er ferdige før dette. */
export const T_END = 0.25;

/** Fra km/h til m/s. */
export const kmh = (v: number) => v / 3.6;

/** Et tidsrom med konstant bremsing `a` (m/s², positiv = farten minker). Mellom tidsrommene er bremsingen null. */
export interface Phase {
  t0: number;
  t1: number;
  a: number;
}

export interface CrashResult {
  m: number;
  v0: number;
  /** Bilens stoppstrekning = hvor mye knusesonen presses sammen (m). */
  d: number;
  restraint: Restraint;
  /** Bilen: bremsing (m/s²), stopptid (s) og bremsingen i g. */
  car: { a: number; t: number; g: number; phases: Phase[] };
  /** Passasjerens bremsing over tid. */
  phases: Phase[];
  /** Når kraften på passasjeren begynner å virke, og når hen står stille (s). */
  tStart: number;
  tStop: number;
  /** Stoppetiden Δt = tStop − tStart (s). */
  dt: number;
  /** Strekningen passasjeren beveger seg før noe bremser hen, og mens hen bremses (m, langs bakken). */
  sFree: number;
  sBrake: number;
  /** Hvor langt passasjeren til slutt har flyttet seg fram i bilen (m). */
  rel: number;
  /** Δp = m · v₀ (kg·m/s = N·s). */
  dp: number;
  /** Gjennomsnittskraften F_gj = Δp/Δt (N), gjennomsnittlig bremsing (m/s²) og i g. */
  F: number;
  a: number;
  g: number;
  /** Største kraft i løpet av støtet (N). */
  Fmax: number;
}

/**
 * Bil og passasjer når bilen med farten v0 (m/s) kjører rett inn i en stiv vegg og knusesonen presses sammen d (m).
 */
export function crash(v0: number, d: number, restraint: Restraint, m: number = DUMMY_MASS): CrashResult {
  const v = Math.max(1e-6, v0);
  const dd = Math.max(1e-4, d);
  const spec = RESTRAINTS[restraint];
  const A = (v * v) / (2 * dd);
  const tc = (2 * dd) / v;
  const car = { a: A, t: tc, g: A / G_EARTH, phases: [{ t0: 0, t1: tc, a: A }] };

  let phases: Phase[];
  if (spec.kind === 'jevn') {
    // Jevn bremsing over s = d + Δx (+ eventuelt slakk i beltet, som her er null).
    const s = dd + spec.stroke;
    phases = [{ t0: 0, t1: (2 * s) / v, a: (v * v) / (2 * s) }];
  } else {
    phases = hitPhases(v, A, tc, dd, spec.free, spec.stroke);
  }

  const first = phases[0]!;
  const last = phases[phases.length - 1]!;
  const tStart = first.t0;
  const tStop = last.t1;
  const dt = tStop - tStart;
  const sFree = v * tStart;
  const sStop = motionAt(v, phases, tStop).x;
  const dp = m * v;
  const F = dp / dt;
  const aAvg = v / dt;
  return {
    m,
    v0: v,
    d: dd,
    restraint,
    car,
    phases,
    tStart,
    tStop,
    dt,
    sFree,
    sBrake: sStop - sFree,
    rel: sStop - dd,
    dp,
    F,
    a: aAvg,
    g: aAvg / G_EARTH,
    Fmax: m * Math.max(...phases.map((p) => p.a)),
  };
}

/**
 * Uten belte: passasjeren flyr fram (ingen kraft) til hen har flyttet seg `free` fram i bilen, og stoppes så i forhold
 * til bilen med jevn bremsing over `stroke`. Står bilen fortsatt ikke stille da, følger passasjeren med bilen resten
 * av veien. Gir tidsrommene med bremsing for passasjeren (i forhold til bakken).
 */
function hitPhases(v: number, A: number, tc: number, d: number, free: number, stroke: number): Phase[] {
  // Når bilen står stille, har passasjeren (fart v hele tiden) flyttet seg 2d langs bakken, altså d fram i bilen.
  const before = free < d;
  const th = before ? Math.sqrt((2 * free) / A) : (free + d) / v;
  const vRel = before ? A * th : v;
  const b = (vRel * vRel) / (2 * stroke);
  const tau = (2 * stroke) / vRel;
  const te = th + tau;
  if (!before) return [{ t0: th, t1: te, a: b }];
  const phases: Phase[] = [];
  // Mens både bilen og dashbordet bremser passasjeren: a = A + b.
  phases.push({ t0: th, t1: Math.min(te, tc), a: A + b });
  if (te > tc) phases.push({ t0: tc, t1: te, a: b });
  else if (te < tc) phases.push({ t0: te, t1: tc, a: A });
  return phases.filter((p) => p.t1 - p.t0 > 1e-12);
}

export interface MotionState {
  /** Strekning fra treffet (m), fart (m/s) og bremsing (m/s²). */
  x: number;
  v: number;
  a: number;
}

/**
 * Hvor langt et legeme med startfarten v0 har kommet ved tiden t, når det bremses i tidsrommene `phases`
 * (sortert, uten overlapp) og ellers beveger seg med konstant fart. Etter siste tidsrom står det stille.
 */
export function motionAt(v0: number, phases: Phase[], t: number): MotionState {
  if (!(t > 0)) return { x: 0, v: v0, a: phases[0] && phases[0].t0 <= 0 ? phases[0].a : 0 };
  let x = 0;
  let v = v0;
  let tc = 0;
  for (const p of phases) {
    if (t <= p.t0) return { x: x + v * (t - tc), v, a: 0 };
    x += v * (p.t0 - tc);
    const dt = Math.min(t, p.t1) - p.t0;
    x += v * dt - 0.5 * p.a * dt * dt;
    v -= p.a * dt;
    tc = p.t0 + dt;
    if (t < p.t1) return { x, v: Math.max(0, v), a: p.a };
  }
  // Etter siste tidsrom: står stille (v er null bortsett fra avrundingsfeil).
  return { x, v: 0, a: 0 };
}

/** Bilen og passasjeren ved tiden t: strekning fra treffet, fart, bremsing og kraften på passasjeren. */
export function crashAt(r: CrashResult, t: number) {
  const car = motionAt(r.v0, r.car.phases, t);
  const p = motionAt(r.v0, r.phases, t);
  return {
    car,
    passenger: p,
    /** Hvor langt passasjeren har flyttet seg fram i bilen (m). */
    rel: p.x - car.x,
    /** Kraften på passasjeren (N). */
    F: r.m * p.a,
  };
}

/** Kraften på passasjeren ved tiden t (N): trappetrinn med én verdi i hvert tidsrom. */
export function forceAt(r: CrashResult, t: number): number {
  for (const p of r.phases) if (t >= p.t0 && t < p.t1) return r.m * p.a;
  return 0;
}

/** Kraften som en trappetrinnskurve [t (s), F (N)] fra 0 til tEnd, til grafen. */
export function forceSteps(r: CrashResult, tEnd: number = T_END): [number, number][] {
  const pts: [number, number][] = [[0, 0]];
  let F = 0;
  for (const p of r.phases) {
    const Fp = r.m * p.a;
    pts.push([p.t0, F], [p.t0, Fp]);
    F = Fp;
    pts.push([p.t1, F]);
  }
  const last = r.phases[r.phases.length - 1];
  if (last) pts.push([last.t1, 0]);
  pts.push([Math.max(tEnd, last?.t1 ?? 0), 0]);
  // Fjern punkter som ligger oppå hverandre (et tidsrom som starter der det forrige slutter).
  return pts.filter((q, i) => i === 0 || q[0] !== pts[i - 1]![0] || q[1] !== pts[i - 1]![1]);
}

/** Massen (kg) som har en tyngde lik kraften F: «like mye som tyngden av … kg». */
export function weightEquivalent(F: number): number {
  return F / G_EARTH;
}

/**
 * Hvor full kollisjonsputa er (0–1) ved tiden t: den utløses ca. 15 ms etter treffet og er full etter ca. 40 ms
 * (lenge før passasjeren har glidd fram til den).
 */
export function airbagFill(t: number): number {
  const x = (t - 0.015) / 0.025;
  if (!(x > 0)) return 0;
  if (x >= 1) return 1;
  return 1 - (1 - x) * (1 - x);
}

/**
 * Største verdi på kraftaksen (kN) for en fart: plass til beltet i den stiveste bilen, med et rundt tall.
 * Støtet uten belte er mye større og går over grafen.
 */
export function forceAxisMax(v0: number, m: number = DUMMY_MASS): number {
  const worst = crash(v0, CRUSH.min, 'belte', m).F / 1000;
  const steps = [5, 10, 15, 20, 25, 30, 40, 50, 60, 80, 100, 120, 150];
  return steps.find((s) => s >= worst * 1.12) ?? Math.ceil((worst * 1.12) / 50) * 50;
}

/** Akseverdier for kraftaksen (kN), 4–6 stykker. */
export function forceAxisTicks(max: number): number[] {
  const step = [1, 2, 5, 10, 20, 25, 50].find((s) => max / s <= 6) ?? 50;
  const ticks: number[] = [];
  for (let v = 0; v <= max + 1e-9; v += step) ticks.push(Math.round(v * 1000) / 1000);
  return ticks;
}
