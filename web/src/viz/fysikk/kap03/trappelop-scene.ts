/**
 * Geometrien i scenen «Arbeid og effekt i trappa» (ren matematikk uten React, så den kan testes): trinnene i
 * steintrappa, hvor løperen er og hvordan hun står, hvor langt «kameraet» må følge med når trappa er for høy til å
 * få plass, lupen med kreftene (sentrert på tyngdepunktet, egen fast skala px/m og px/N), ringen og strekene ut til
 * lupen, skiltet med stoppeklokka og steinene og buskene i lia.
 *
 * Verden måles i meter med origo nederst ved første trinn, x mot høyre (opp trappa) og y opp. Figuren tegnes med én
 * fast skala S (px/m) i hver utforming, så løperen, trinnene og høyden alltid står i riktig forhold til hverandre.
 */

import { personPunkter, type Leddvinkler, type PersonPose } from '../../kit/scene/figurer-skjelett';

const DEG = 180 / Math.PI;

/** Et trinn i en steintrapp: ca. 19 cm opp og 26 cm inn (litt brattere enn en trapp innendørs). */
export const STEP_RISE = 0.19;
export const STEP_RUN = 0.26;
/** Høyden til løperen (m). */
export const RUNNER_HEIGHT = 1.75;
/**
 * Lengden på én gangsyklus (to skritt) som andel av høyden, som i scene-kit-et (gange 0,8). I trappa tar løperen
 * to trinn per skritt, og det passer med gangsyklusen: 0,7 m per skritt langs trappa er to trinn.
 */
export const GAIT_CYCLE = 0.8;

export interface StairGeom {
  /** Høyden (m). */
  h: number;
  /** Antall trinn. */
  n: number;
  /** Høyden og dybden på hvert trinn (m). Høyden er justert litt så trinnene går opp i h. */
  rise: number;
  run: number;
  /** Vannrett lengde på trappa (m). */
  L: number;
  /** Lengden langs trappa (m). */
  slope: number;
  /** Stigningsvinkelen (grader). */
  angle: number;
}

export function stairGeometry(h: number): StairGeom {
  const hh = Number.isFinite(h) && h > 0 ? h : STEP_RISE;
  const n = Math.max(1, Math.round(hh / STEP_RISE));
  const rise = hh / n;
  const run = STEP_RUN;
  const L = n * run;
  return { h: hh, n, rise, run, L, slope: Math.hypot(L, hh), angle: Math.atan2(rise, run) * DEG };
}

/** En sirkel i figuren (px): forstørrelsen (lupen) og ringen rundt løperen. */
export interface Circle {
  x: number;
  y: number;
  r: number;
}

/** Utformingen av figuren: størrelse (viewBox) og plassen trappa kan bruke når kameraet står nederst. */
export interface StairLayout {
  W: number;
  H: number;
  /** Foten av trappa (første trinn) i figuren når kameraet står nederst. */
  xs: number;
  yBot: number;
  /** Hodet til løperen på toppen av trappa skal ikke komme høyere enn dette … */
  yTopMin: number;
  /** … eller lenger til høyre enn dette (plass til toppen med varden). */
  xTopMax: number;
  /** Minste og største skala (px/m). Under den minste følger kameraet løperen i stedet for å zoome ut mer. */
  Smin: number;
  Smax: number;
  /** Hvor høyt løperen står i figuren (andel av høyden fra yBot til yTopMin) når kameraet følger med. */
  follow: number;
  /**
   * Forstørrelsen (lupen) med løperen og kreftene, oppe til venstre under skiltet med stoppeklokka. Trappa går
   * alltid langs den samme linja i figuren (fast fot og fast stigning, og kameraet flytter seg langs linja), så
   * lupen ligger over linja og kommer aldri i veien for løperen.
   */
  lupe: Circle;
}

export const LAYOUT_WIDE: StairLayout = {
  W: 800,
  H: 450,
  xs: 188,
  yBot: 412,
  yTopMin: 14,
  xTopMax: 652,
  Smin: 22,
  Smax: 46,
  follow: 0.42,
  lupe: { x: 116, y: 210, r: 90 },
};
export const LAYOUT_NARROW: StairLayout = {
  W: 560,
  H: 540,
  xs: 92,
  yBot: 502,
  yTopMin: 70,
  xTopMax: 476,
  Smin: 32,
  Smax: 54,
  follow: 0.45,
  lupe: { x: 112, y: 218, r: 90 },
};

/** Skalaen og kameraet for en trapp i en utforming. */
export interface StairView {
  /** Skala (px/m), den samme for alt i scenen. */
  S: number;
  /** Den største forflytningen kameraet trenger (m opp langs trappa): 0 når hele trappa får plass. */
  cMax: number;
  /** Hvor høyt over foten av trappa løperen står i figuren når kameraet følger med (m). */
  follow: number;
}

/** Plassen over toppen av trappa som skal være med i figuren (m): løperen står der til slutt. */
export const HEADROOM = RUNNER_HEIGHT + 0.25;

/**
 * Skalaen velges så hele trappa og løperen på toppen får plass (zoomer ut når h øker), men aldri mindre enn Smin,
 * så løperen ikke blir for liten. Får trappa likevel ikke plass, følger kameraet løperen langs trappa
 * (c m opp og c / tan(vinkel) m bortover).
 */
export function stairView(g: StairGeom, lay: StairLayout): StairView {
  const availH = lay.yBot - lay.yTopMin;
  const availW = lay.xTopMax - lay.xs;
  const S = clamp(Math.min(availH / (g.h + HEADROOM), availW / g.L), lay.Smin, lay.Smax);
  const tan = g.rise / g.run;
  const cMax = Math.max(0, g.h + HEADROOM - availH / S, (g.L - availW / S) * tan);
  return { S, cMax: cMax < 1e-9 ? 0 : cMax, follow: (lay.follow * availH) / S };
}

/** Hvor mange meter kameraet er flyttet opp langs trappa når løperen har løftet seg `climbed` m. */
export function cameraLift(v: StairView, climbed: number): number {
  if (v.cMax <= 0) return 0;
  return clamp(climbed - v.follow, 0, v.cMax);
}

/** Fra verden (m) til figuren (px) når kameraet er flyttet c m opp langs trappa. */
export function toScreen(g: StairGeom, lay: StairLayout, S: number, c: number, x: number, y: number): { x: number; y: number } {
  const cx = c * (g.run / g.rise);
  return { x: lay.xs + (x - cx) * S, y: lay.yBot - (y - c) * S };
}

export type RunnerPhase = 'start' | 'climb' | 'top';

export interface RunnerPlace {
  /** Ankerpunktet til personen (m): midt mellom føttene, under hofta mens løperen er i trappa. */
  x: number;
  y: number;
  phase: RunnerPhase;
  /** Fasen i gangsyklusen (0–1), så føttene ikke glir langs trappa. */
  fase: number;
}

/** Hvor høyt over linja gjennom de indre hjørnene føttene treffer trinnene (andel av trinnhøyden). */
export const FOOT_LIFT = 0.55;

/**
 * Hvor løperen er når andelen u av trappa er løpt: står klar nederst (u = 0), er på vei opp, eller står på toppen
 * (u = 1). Underveis følger ankerpunktet trappa jevnt, så høyden over bakken er u · h (pluss litt, så føttene
 * treffer midt på trinnene).
 */
export function runnerPlace(g: StairGeom, u: number): RunnerPlace {
  if (!(u > 0)) return { x: -0.55, y: 0, phase: 'start', fase: 0 };
  if (u >= 1) return { x: g.L + 0.75, y: g.h, phase: 'top', fase: 0 };
  const along = u * g.slope;
  return { x: u * g.L, y: u * g.h + FOOT_LIFT * g.rise, phase: 'climb', fase: mod(along / (GAIT_CYCLE * RUNNER_HEIGHT), 1) };
}

/**
 * Armene når løperen løper (ikke går): skulder og albue for armen med fasen x, som i løpesyklusen i scene-kit-et,
 * så armene svinger i takt med beina (den nære armen fram når det fjerne beinet er fram).
 */
export function runningArm(x: number): { skulder: number; albue: number } {
  const c = Math.cos(2 * Math.PI * (x - 0.86));
  return { skulder: 8 - 36 * c, albue: 86 + 12 * Math.max(0, -c) };
}

/** Positur, leddvinkler og helning for løperen der hun er nå. */
export interface RunnerPose {
  pose: PersonPose;
  ledd: Partial<Leddvinkler> | undefined;
  /** Helningen under føttene (grader): trappa mens hun løper, 0 nederst og på toppen. */
  skraaning: number;
}

/**
 * Står klar nederst, går eller løper opp trappa (armene svinger i takt når hun løper, ryggen lener mer forover),
 * og strekker armene i været på toppen.
 */
export function runnerPose(g: StairGeom, place: RunnerPlace, running: boolean): RunnerPose {
  if (place.phase === 'start') return { pose: 'staa', ledd: undefined, skraaning: 0 };
  if (place.phase === 'top') return { pose: 'armer-opp', ledd: undefined, skraaning: 0 };
  if (!running) return { pose: 'gaa', ledd: { rygg: 9 }, skraaning: g.angle };
  const near = runningArm(place.fase);
  const far = runningArm(place.fase + 0.5);
  return {
    pose: 'gaa',
    ledd: { rygg: 17, hoyreSkulder: near.skulder, hoyreAlbue: near.albue, venstreSkulder: far.skulder, venstreAlbue: far.albue },
    skraaning: g.angle,
  };
}

/* ---------- Skiltet, ringen rundt løperen og lupen ---------- */

/** Skiltet med stoppeklokka og arbeidet så langt (oppe til venstre). `f` = tekstskalaen, `k` = sceneskalaen. */
export interface PanelBox {
  x: number;
  y: number;
  w: number;
  h: number;
  /** Radius og sentrum til stoppeklokka, og der teksten begynner. */
  clockR: number;
  clockX: number;
  clockY: number;
  textX: number;
}

export function panelBox(f: number, k: number): PanelBox {
  const pad = 12;
  const clockR = 27 * k;
  const fs = 17 * f;
  const textX = pad + 12 + clockR * 2 + 14;
  // Bredden er satt av etiketten «Arbeid så langt» (lengre enn tallet, også «35 316 J»), så den står fast under avspillingen.
  const w = textX - pad + Math.max(15 * 0.6 * fs * 0.82, 8 * 0.62 * fs * 1.25) + 14;
  const h = clockR * 2.4 + 18;
  return { x: pad, y: pad, w, h, clockR, clockX: pad + 12 + clockR, clockY: pad + 9 + clockR * 1.4, textX };
}

/**
 * Tyngdepunktet til løperen i forhold til ankerpunktet, som andel av høyden (y nedover i figuren). Det flytter seg
 * litt med skrittet og armene, og ringen og lupen er sentrert på det.
 */
export function comOffset(rp: RunnerPose, fase: number): Pt {
  const c = personPunkter(rp.pose, 100, rp.ledd, { x: 0, y: 0, skraaning: rp.skraaning, fase }).tyngdepunkt;
  return { x: c.x / 100, y: c.y / 100 };
}

/**
 * Ringen rundt løperen i scenen (den delen som er forstørret i lupen), sentrert på tyngdepunktet. `p` er
 * ankerpunktet til løperen i figuren (midt under hofta, på trinnet), `S` er skalaen (px/m).
 */
export function runnerRing(p: Pt, S: number, rp: RunnerPose, fase: number): Circle {
  const H = RUNNER_HEIGHT * S;
  const c = comOffset(rp, fase);
  return { x: p.x + c.x * H, y: p.y + c.y * H, r: 0.64 * H };
}

/** Hvor høy løperen er i lupen, som andel av radien. */
export const LUPE_RUNNER = 1.22;

/**
 * Fra verden (m) til lupen (px): tyngdepunktet til løperen havner midt i lupen, akkurat som det er midt i ringen
 * i scenen. X(x) = ox + x · Z og Y(y) = oy − y · Z, der Z er skalaen i lupen (px/m). `anchor` er løperens
 * ankerpunkt i lupen.
 */
export function lupeMap(lupe: Circle, place: RunnerPlace, rp: RunnerPose) {
  const Z = (LUPE_RUNNER * lupe.r) / RUNNER_HEIGHT;
  const H = RUNNER_HEIGHT * Z;
  const c = comOffset(rp, place.fase);
  const anchor = { x: lupe.x - c.x * H, y: lupe.y - c.y * H };
  return { Z, ox: anchor.x - place.x * Z, oy: anchor.y + place.y * Z, anchor };
}

/** Den største massen på glidebryteren (kg). Kreftene i lupen er tegnet så G for denne massen er 0,86 · radien. */
export const MAX_MASS = 120;

/** Kraftskalaen i lupen (px/N): fast for hele glidebryteren, så pila blir dobbelt så lang når massen dobles. */
export function lupeForceScale(lupe: Circle, g = 9.81): number {
  return (0.86 * lupe.r) / (MAX_MASS * g);
}

export interface Segment {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

/**
 * Pilene i lupen (px): tyngden G fra tyngdepunktet og nedover, og kraften oppover (F i trappa, N når hun står)
 * fra fotlinja like foran tyngdepunktet, som i læreboka. Begge er m · g · k lange (fast kraftskala k i lupen).
 */
export function lupeForces(lupe: Circle, place: RunnerPlace, rp: RunnerPose, m: number, g = 9.81): { com: Pt; G: Segment; up: Segment } {
  const map = lupeMap(lupe, place, rp);
  const size = RUNNER_HEIGHT * map.Z;
  const plass = { x: map.anchor.x, y: map.anchor.y, skraaning: rp.skraaning, fase: place.fase };
  const com = personPunkter(rp.pose, size, rp.ledd, plass).tyngdepunkt;
  const len = m * g * lupeForceScale(lupe, g);
  const upX = com.x + 0.22 * size;
  const upY = plass.y - (upX - plass.x) * Math.tan(rp.skraaning / DEG);
  return {
    com,
    G: { x1: com.x, y1: com.y, x2: com.x, y2: com.y + len },
    up: { x1: upX, y1: upY, x2: upX, y2: upY - len },
  };
}

/**
 * De to ytre tangentene mellom to sirkler (strekene fra ringen rundt løperen ut til lupen), som par av punkter
 * [på a, på b]. Null når sirklene overlapper.
 */
export function outerTangents(a: Circle, b: Circle): [Pt, Pt][] | null {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const d = Math.hypot(dx, dy);
  if (!(d > a.r + b.r)) return null;
  const phi = Math.atan2(dy, dx);
  const beta = Math.acos((a.r - b.r) / d);
  return [phi + beta, phi - beta].map((t) => {
    const c = Math.cos(t);
    const s = Math.sin(t);
    return [
      { x: a.x + a.r * c, y: a.y + a.r * s },
      { x: b.x + b.r * c, y: b.y + b.r * s },
    ] as [Pt, Pt];
  });
}

export interface Pt {
  x: number;
  y: number;
}

/**
 * Der løperen er i figuren (ankerpunktet, px) når andelen u av trappa er løpt, med kameraet der det står da.
 * Samme regning som i scenen, så testene kan sjekke at ringen og lupen aldri overlapper.
 */
export function runnerOnScreen(g: StairGeom, lay: StairLayout, view: StairView, u: number): Pt {
  const place = runnerPlace(g, u);
  const c = cameraLift(view, u * g.h);
  return toScreen(g, lay, view.S, c, place.x, place.y);
}

/* ---------- Detaljer i lia ---------- */

export interface HillItem {
  kind: 'stein' | 'busk';
  /** Midt på foten (m), i verden. */
  x: number;
  y: number;
  /** Bredden (m). */
  w: number;
  /** Frø til formen. */
  seed: number;
}

/** Hvor mye lia som får detaljer til høyre for toppen av trappa (m). */
const HILL_RIGHT = 6;
/** Bredden på lia (m) der alle plassene brukes; i smalere lier brukes en tilsvarende mindre andel. */
const HILL_DENSITY_SPAN = 18;

/**
 * Steiner og einerbusker i lia under trappa, så den ikke er en tom, grønn flate. Plassene er faste andeler av lia
 * (frø), så detaljene flytter seg jevnt når h endres. De står minst 0,7 m under trinnene, ikke ved mållinja
 * for h (x = L) og ikke nede ved foten av trappa.
 */
export function hillItems(g: StairGeom, seed = 23, count = 26): HillItem[] {
  const rnd = seeded(seed);
  const tan = g.rise / g.run;
  const out: HillItem[] = [];
  for (let i = 0; i < count; i++) {
    const a = rnd();
    const b = rnd();
    const kind: HillItem['kind'] = rnd() < 0.55 ? 'stein' : 'busk';
    const w = kind === 'stein' ? 0.35 + 0.5 * rnd() : 0.6 + 0.7 * rnd();
    const s = Math.floor(rnd() * 1e6);
    // Like tett i alle trapper: i en kort trapp blir lia smalere, så færre av plassene brukes.
    if (rnd() > (g.L + HILL_RIGHT) / HILL_DENSITY_SPAN) continue;
    const x = a * (g.L + HILL_RIGHT);
    const surface = Math.min(x * tan, g.h);
    const top = surface - 0.7 - w * 0.6;
    const bottom = -0.35;
    if (top - bottom < w * 0.5) continue;
    if (Math.abs(x - g.L) < 0.7 + w / 2) continue;
    // Ikke nede ved foten av trappa, der lia er tynn og løperen står og venter
    if (x - w / 2 < 2) continue;
    const y = bottom + b * (top - bottom);
    out.push({ kind, x, y, w, seed: s });
  }
  return out;
}

function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

function mod(a: number, b: number): number {
  return ((a % b) + b) % b;
}
