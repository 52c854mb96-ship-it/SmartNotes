/** Ren fysikk for kapittel 3 (ingen React), så den kan testes for seg. */
import { G_EARTH } from '../../kit/format';

/* ---------- Hjelpere for akser ---------- */

/** «Pent» steg (1, 2, 5 · 10ⁿ) for omtrent `count` intervaller – samme regel som niceTicks i kit. */
export function niceStep(span: number, count = 5): number {
  if (!(span > 0)) return 1;
  const raw = span / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const norm = raw / mag;
  return (norm >= 5 ? 10 : norm >= 2 ? 5 : norm >= 1 ? 2 : 1) * mag;
}

/** Runder `v` opp til nærmeste pene akseverdi. */
export function niceCeil(v: number, count = 5): number {
  if (!(v > 0)) return 1;
  const step = niceStep(v, count);
  return Math.ceil(v / step - 1e-9) * step;
}

const DEG = Math.PI / 180;

/* ---------- 3B Arbeid: kjelke som dras med en kraft på skrå ---------- */

/** Massen til kjelken med last (kg). */
export const SLED_MASS = 25;

export interface SledInput {
  /** Kraften du drar med (N). */
  F: number;
  /** Vinkelen mellom kraften og bevegelsesretningen (grader, 0–180). */
  alphaDeg: number;
  /** Strekningen kjelken flyttes (m). */
  s: number;
  /** Friksjonstall mellom kjelke og snø. */
  mu: number;
  /** Masse (kg). */
  m?: number;
}

export interface SledResult {
  /** Komponenten av F langs bevegelsen, F·cos α (negativ når α > 90°). */
  Fpar: number;
  /** Komponenten av F vinkelrett på bevegelsen (oppover), F·sin α. */
  Fperp: number;
  G: number;
  /** Normalkraft N = G − F·sin α (aldri negativ). */
  N: number;
  /** Friksjon R = μN. */
  R: number;
  /** Arbeidet fra F: W = F·s·cos α. */
  WF: number;
  /** Friksjonsarbeidet W_R = −R·s (alltid ≤ 0). */
  WR: number;
  /** Tyngden og normalkraften står vinkelrett på bevegelsen og gjør ikke arbeid. */
  WG: number;
  WN: number;
  /** Totalt arbeid = endringen i kinetisk energi. */
  W: number;
}

export function sledWork({ F, alphaDeg, s, mu, m = SLED_MASS }: SledInput, g = G_EARTH): SledResult {
  const a = alphaDeg * DEG;
  // Rund av så cos 90° blir nøyaktig 0 og ikke 6 · 10⁻¹⁷
  const cos = Math.abs(Math.cos(a)) < 1e-12 ? 0 : Math.cos(a);
  const sin = Math.abs(Math.sin(a)) < 1e-12 ? 0 : Math.sin(a);
  const Fpar = F * cos;
  const Fperp = F * sin;
  const G = m * g;
  const N = Math.max(0, G - Fperp);
  const R = mu * N;
  const WF = Fpar * s;
  const WR = -R * s;
  return { Fpar, Fperp, G, N, R, WF, WR, WG: 0, WN: 0, W: WF + WR };
}

/**
 * Vinkelen (grader) som gir mest totalt arbeid for en gitt kraft når kjelken ikke letter:
 * W = s(F cos α − μ(G − F sin α)) har dW/dα = sF(μ cos α − sin α) = 0, altså tan α = μ.
 */
export function bestPullAngle(mu: number): number {
  return Math.atan(Math.max(0, mu)) / DEG;
}

/* ---------- 3C–3F Energibevaring: kule på en bane ---------- */

export type TrackKind = 'rampe' | 'bakke';

export interface Track {
  kind: TrackKind;
  xMin: number;
  xMax: number;
  /** Høyeste punkt på banen (m). */
  top: number;
  /** Laveste punkt (der kula starter fra venstre side ned mot). */
  xBottom: number;
  /** Toppen i midten (bare for «bakke»), med den minste krumningsradien r der (m). */
  hump: { x: number; h: number; r: number } | null;
  height: (x: number) => number;
  slope: (x: number) => number;
}

interface Segment {
  x0: number;
  x1: number;
  h0: number;
  h1: number;
}

/** Glatt bane satt sammen av cosinusbuer mellom punktene (vannrett tangent i hvert knekkpunkt). */
function cosineTrack(segments: Segment[]) {
  const find = (x: number) => segments.find((s) => x <= s.x1) ?? segments[segments.length - 1]!;
  return {
    height(x: number) {
      const s = find(x);
      const u = Math.min(1, Math.max(0, (x - s.x0) / (s.x1 - s.x0)));
      return s.h0 + ((s.h1 - s.h0) * (1 - Math.cos(Math.PI * u))) / 2;
    },
    slope(x: number) {
      const s = find(x);
      const L = s.x1 - s.x0;
      const u = Math.min(1, Math.max(0, (x - s.x0) / L));
      return ((s.h1 - s.h0) * Math.PI * Math.sin(Math.PI * u)) / (2 * L);
    },
  };
}

export const TRACK_TOP = 6;

export function makeTrack(kind: TrackKind): Track {
  if (kind === 'rampe') {
    // U-rampe: parabel h = 6 m · ((x − 6)/6)², 12 m bred
    return {
      kind,
      xMin: 0,
      xMax: 12,
      top: TRACK_TOP,
      xBottom: 6,
      hump: null,
      height: (x) => TRACK_TOP * ((x - 6) / 6) ** 2,
      slope: (x) => (2 * TRACK_TOP * (x - 6)) / 36,
    };
  }
  // Bakke: høy start, dal, en topp på 3 m, ny dal og en vegg til høyre
  const segments = [
    { x0: 0, x1: 4.5, h0: TRACK_TOP, h1: 0 },
    { x0: 4.5, x1: 9, h0: 0, h1: 3 },
    { x0: 9, x1: 12.5, h0: 3, h1: 0 },
    { x0: 12.5, x1: 16, h0: 0, h1: TRACK_TOP },
  ];
  // Krumningsradien på toppen av en cosinusbue med lengde L og høyde H er r = 2L²/(π²H); den bratteste siden gir minst r.
  const r = Math.min(...segments.slice(1, 3).map((sg) => (2 * (sg.x1 - sg.x0) ** 2) / (Math.PI ** 2 * Math.abs(sg.h1 - sg.h0))));
  return { kind, xMin: 0, xMax: 16, top: TRACK_TOP, xBottom: 4.5, hump: { x: 9, h: 3, r }, ...cosineTrack(segments) };
}

/** Startpunktet på venstre side av banen der høyden er h₀ (halveringsmetoden). */
export function startPosition(track: Track, h0: number): number {
  let lo = track.xMin;
  let hi = track.xBottom;
  if (h0 >= track.height(lo)) return lo;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    if (track.height(mid) > h0) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

export interface TrackSample {
  t: number;
  /** Vannrett posisjon (m). */
  x: number;
  /** Fart langs banen (m/s), positiv mot høyre. */
  v: number;
  /** Høyde over laveste punkt (m). */
  h: number;
  /** Strekning tilbakelagt langs banen (m). */
  d: number;
  Ep: number;
  Ek: number;
  /** Varme fra friksjonsarbeidet, −W_R = R·d (J). */
  heat: number;
  /** Mekanisk energi E = E_p + E_k (J). */
  E: number;
}

export interface TrackSim {
  samples: TrackSample[];
  /** Tid mellom lagrede punkter (s). */
  every: number;
  /** Når kula blir liggende i ro (bare med friksjon), ellers null. */
  stopTime: number | null;
  /** Mekanisk energi ved start, m·g·h₀. */
  E0: number;
  /** Friksjonskraften R = μmg (forenklet: vi ser bort fra at N varierer langs banen). */
  R: number;
}

export interface TrackSimInput {
  track: Track;
  h0: number;
  m: number;
  /** Friksjonstall (0 = uten friksjon). */
  mu: number;
  tMax: number;
  /** Tidssteg i integrasjonen (s). */
  dt?: number;
  /** Tid mellom lagrede punkter (s). */
  every?: number;
}

/**
 * Bevegelse langs banen y = h(x) for et punktlegeme (kula regnes uten rotasjon og følger banen som en vogn på skinner). Langs banen er
 *   dv/dt = −g·sin θ − (R/m)·fortegn(v),   dx/dt = v·cos θ,   tan θ = h′(x),
 * løst med Runge–Kutta (RK4). Friksjonen er forenklet til R = μmg, så varmen blir R · (strekning langs banen).
 * Kula blir liggende i et vendepunkt hvis tyngdekomponenten langs banen ikke klarer å overvinne friksjonen.
 */
export function simulateTrack({ track, h0, m, mu, tMax, dt = 0.002, every = 0.02 }: TrackSimInput, g = G_EARTH): TrackSim {
  const R = mu * m * g;
  const af = mu * g;
  const E0 = m * g * h0;
  const per = Math.max(1, Math.round(every / dt));
  const steps = Math.round(tMax / dt);
  const samples: TrackSample[] = [];
  let x = startPosition(track, h0);
  let v = 0;
  let d = 0;
  let stopTime: number | null = null;

  const record = (t: number) => {
    const h = track.height(x);
    const Ep = m * g * h;
    const Ek = 0.5 * m * v * v;
    samples.push({ t, x, v, h, d, Ep, Ek, heat: R * d, E: Ep + Ek });
  };
  const deriv = (xx: number, vv: number, dir: number): [number, number, number] => {
    const hp = track.slope(xx);
    const c = 1 / Math.sqrt(1 + hp * hp);
    return [vv * c, -g * hp * c - dir * af, Math.abs(vv)];
  };

  record(0);
  for (let i = 1; i <= steps; i++) {
    if (stopTime === null) {
      let dir = Math.sign(v);
      if (dir === 0) {
        // I ro: begynner den å gli, og i så fall hvilken vei?
        const hp = track.slope(x);
        const ag = (-g * hp) / Math.sqrt(1 + hp * hp);
        if (mu > 0 && Math.abs(ag) <= af) stopTime = (i - 1) * dt;
        dir = Math.sign(ag);
      }
      if (stopTime === null) {
        const fd = mu > 0 ? dir : 0;
        const k1 = deriv(x, v, fd);
        const k2 = deriv(x + (dt / 2) * k1[0], v + (dt / 2) * k1[1], fd);
        const k3 = deriv(x + (dt / 2) * k2[0], v + (dt / 2) * k2[1], fd);
        const k4 = deriv(x + dt * k3[0], v + dt * k3[1], fd);
        x += (dt / 6) * (k1[0] + 2 * k2[0] + 2 * k3[0] + k4[0]);
        const vNew = v + (dt / 6) * (k1[1] + 2 * k2[1] + 2 * k3[1] + k4[1]);
        d += (dt / 6) * (k1[2] + 2 * k2[2] + 2 * k3[2] + k4[2]);
        // Med friksjon kan ikke friksjonen snu bevegelsen: farten stopper i vendepunktet.
        v = mu > 0 && Math.sign(vNew) !== dir && vNew !== 0 ? 0 : vNew;
        x = Math.min(track.xMax, Math.max(track.xMin, x));
      }
    }
    if (i % per === 0) record(i * dt);
  }
  return { samples, every: per * dt, stopTime, E0, R };
}

/**
 * Om en løs kule med mekanisk energi E ville lettet fra banen på toppen i midten: der må tyngden alene gi
 * sentripetalakselerasjonen, så den følger banen bare hvis v²/r ≤ g. Simuleringen lar kula følge banen uansett.
 */
export function liftsOffAtHump(track: Track, E: number, m: number, g = G_EARTH): boolean {
  if (!track.hump) return false;
  const v2 = 2 * (E / m - g * track.hump.h);
  return v2 > g * track.hump.r;
}

export interface HumpOutcome {
  /**
   * 'over': kommer over toppen i midten. 'under': snur før toppen. 'akkurat': uten friksjon og med starthøyden
   * nøyaktig like høy som toppen, der legemet i teorien stopper på toppen (simuleringen tipper over på avrundingen).
   */
  result: 'over' | 'under' | 'akkurat';
  /** Energien som trengs for å komme opp på toppen, m·g·h_topp (J). */
  need: number;
  /** Mekanisk energi første gang legemet er på toppen (J), eller null hvis det aldri kommer dit. */
  Etop: number | null;
}

/** Om legemet kommer over toppen i midten av «bakke» (null for U-rampen), regnet fra simuleringen. */
export function humpOutcome(track: Track, sim: TrackSim, m: number, g = G_EARTH): HumpOutcome | null {
  if (!track.hump) return null;
  const need = m * g * track.hump.h;
  const first = sim.samples.find((s) => s.x >= track.hump!.x);
  if (sim.R === 0 && Math.abs(sim.E0 - need) <= 1e-9 * Math.max(1, need)) return { result: 'akkurat', need, Etop: need };
  return first ? { result: 'over', need, Etop: first.E } : { result: 'under', need, Etop: null };
}

/** Punktet som er nærmest tiden t. */
export function sampleAt(sim: TrackSim, t: number): TrackSample {
  const i = Math.min(sim.samples.length - 1, Math.max(0, Math.round(t / sim.every)));
  return sim.samples[i]!;
}

/* ---------- 3A/3B Arbeid og effekt: løp opp trappa ---------- */

export interface StairInput {
  /** Masse (kg). */
  m: number;
  /** Høydeforskjell (m). */
  h: number;
  /** Tid (s). */
  t: number;
}

export interface StairResult {
  /** Arbeid mot tyngden, W = mgh (J). */
  W: number;
  /** Effekt P = W/t (W). */
  P: number;
  /** Hvor fort du løfter deg, h/t (m/s). */
  vertical: number;
}

export function stairRun({ m, h, t }: StairInput, g = G_EARTH): StairResult {
  const W = m * g * h;
  return { W, P: W / t, vertical: h / t };
}

/** Hverdagseffekter å sammenligne med (W). */
export const POWER_REFS: { label: string; P: number }[] = [
  { label: 'LED-pære', P: 7 },
  { label: 'Glødepære', P: 60 },
  { label: 'Kroppen i hvile', P: 100 },
  { label: 'Mikrobølgeovn', P: 800 },
  { label: 'Vannkoker', P: 2000 },
];

export type Pace = 'rolig' | 'gange' | 'løping' | 'sprint' | 'urealistisk';

/**
 * Hvor krevende trappeløpet er, ut fra hvor mange meter du løfter deg per sekund. Vanlig gange i trapp er
 * omtrent 0,3 m/s (et trinn på 17 cm nesten to ganger i sekundet).
 */
export function pace(vertical: number): Pace {
  if (vertical < 0.2) return 'rolig';
  if (vertical < 0.45) return 'gange';
  if (vertical < 1.2) return 'løping';
  if (vertical < 1.8) return 'sprint';
  return 'urealistisk';
}

/** Hvor lenge et apparat med effekt P må gå for å bruke energien W. */
export const timeForEnergy = (W: number, P: number): number => W / P;

export interface StairProgress {
  /** Andelen av trappa du har løpt (0–1). */
  u: number;
  /** Høyden du har løftet deg så langt (m). */
  climbed: number;
  /** Arbeidet så langt, mg · høyden (J). Med jevn fart er det P · τ. */
  W: number;
}

/** Hvor langt du er kommet etter tiden τ (s) når du løper opp trappa med jevn fart på tiden t. */
export function stairProgress({ m, h, t }: StairInput, tau: number, g = G_EARTH): StairProgress {
  const u = t > 0 && Number.isFinite(tau) ? Math.min(1, Math.max(0, tau / t)) : 1;
  const climbed = u * h;
  return { u, climbed, W: m * g * climbed };
}

/** Virkningsgraden til musklene: omtrent en firedel av energien blir til arbeid, resten blir varme. */
export const MUSCLE_EFFICIENCY = 0.25;

/** Energien kroppen bruker for å gjøre arbeidet W (J) med virkningsgraden η. */
export const bodyEnergy = (W: number, eta = MUSCLE_EFFICIENCY): number => W / eta;

/** Omtrent hvor mye energi en brødskive med ost gir (J), til sammenligning. */
export const BREAD_SLICE_ENERGY = 700e3;
