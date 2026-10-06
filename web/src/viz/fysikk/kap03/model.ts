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
  /** Kulen i midten (bare for «bakke»): toppunktet og krumningsradien r der (m). */
  hump: { x: number; h: number; r: number } | null;
  height: (x: number) => number;
  slope: (x: number) => number;
  /** Krumningen κ = h″/(1 + h′²)^{3/2} (1/m): positiv i en dal, negativ over en topp, 0 på rette stykker. */
  curvature: (x: number) => number;
}

/** Stykker av en bane: rett stykke, sirkelbue eller parabel h = ha − (x − xa)²/(2c) med toppen i xa. */
type Piece =
  | { kind: 'line'; x0: number; x1: number; h0: number; k: number }
  /** Sirkelbue med sentrum (cx, cy): `convex` = sentrum under (en topp), ellers sentrum over (en dal). */
  | { kind: 'arc'; x0: number; x1: number; cx: number; cy: number; r: number; convex: boolean }
  | { kind: 'parabola'; x0: number; x1: number; xa: number; ha: number; c: number };

function pieceHeight(p: Piece, x: number): number {
  if (p.kind === 'line') return p.h0 + p.k * (x - p.x0);
  if (p.kind === 'parabola') return p.ha - (x - p.xa) ** 2 / (2 * p.c);
  const dx = Math.min(p.r, Math.max(-p.r, x - p.cx));
  const root = Math.sqrt(p.r * p.r - dx * dx);
  return p.convex ? p.cy + root : p.cy - root;
}

function pieceSlope(p: Piece, x: number): number {
  if (p.kind === 'line') return p.k;
  if (p.kind === 'parabola') return -(x - p.xa) / p.c;
  const dx = Math.min(p.r * 0.999999, Math.max(-p.r * 0.999999, x - p.cx));
  const root = Math.sqrt(p.r * p.r - dx * dx);
  return p.convex ? -dx / root : dx / root;
}

function pieceCurvature(p: Piece, x: number): number {
  if (p.kind === 'line') return 0;
  if (p.kind === 'arc') return p.convex ? -1 / p.r : 1 / p.r;
  const k = pieceSlope(p, x);
  return -1 / p.c / (1 + k * k) ** 1.5;
}

/**
 * Bygger en glatt bane fra venstre mot høyre: hvert stykke begynner der det forrige sluttet, med samme helning.
 * Vinklene er helningsvinkelen φ (radianer, positiv når banen stiger mot høyre).
 */
function trackBuilder(x: number, h: number) {
  const pieces: Piece[] = [];
  let phi = 0;
  const api = {
    /** Sirkelbue med radius r til helningsvinkelen `to`; dal (sentrum over) når vinkelen øker. */
    arc(r: number, to: number) {
      const convex = to < phi;
      // Punktet med helningsvinkel φ: dal x = cx + r sin φ, h = cy − r cos φ; topp x = cx − r sin φ, h = cy + r cos φ
      const s = convex ? -1 : 1;
      const cx = x - s * r * Math.sin(phi);
      const cy = h + s * r * Math.cos(phi);
      const x1 = cx + s * r * Math.sin(to);
      pieces.push({ kind: 'arc', x0: x, x1, cx, cy, r, convex });
      h = cy - s * r * Math.cos(to);
      x = x1;
      phi = to;
      return api;
    },
    /** Rett stykke med helningen φ som endrer høyden med dh. */
    line(dh: number) {
      const k = Math.tan(phi);
      const x1 = x + dh / k;
      pieces.push({ kind: 'line', x0: x, x1, h0: h, k });
      x = x1;
      h += dh;
      return api;
    },
    /** Parabel (en topp) med krumningsradius c i toppunktet, til helningsvinkelen `to`. */
    parabola(c: number, to: number) {
      const k0 = Math.tan(phi);
      const k1 = Math.tan(to);
      const xa = x + c * k0;
      const ha = h + (c * k0 * k0) / 2;
      const x1 = xa - c * k1;
      pieces.push({ kind: 'parabola', x0: x, x1, xa, ha, c });
      x = x1;
      h = ha - (c * k1 * k1) / 2;
      phi = to;
      return api;
    },
    get x() {
      return x;
    },
    get h() {
      return h;
    },
    pieces,
  };
  return api;
}

function piecewise(pieces: Piece[]) {
  const xMin = pieces[0]!.x0;
  const xMax = pieces[pieces.length - 1]!.x1;
  const find = (x: number) => pieces.find((p) => x <= p.x1) ?? pieces[pieces.length - 1]!;
  const at = (x: number) => Math.min(xMax, Math.max(xMin, x));
  return {
    xMin,
    xMax,
    height: (x: number) => pieceHeight(find(at(x)), at(x)),
    slope: (x: number) => pieceSlope(find(at(x)), at(x)),
    curvature: (x: number) => pieceCurvature(find(at(x)), at(x)),
  };
}

export const TRACK_TOP = 6;

/**
 * Akebakken: en bakke på 6 m ned i en dal, en kul og en motbakke opp til 6 m igjen. Mål som i en ekte akebakke:
 * sidene er høyst 30° bratte, kulen er 2,5 m høy med høyst 25° helning, og dalene er runde.
 */
export const SLED_HILL = {
  /** Den bratteste helningen i bakken og motbakken (grader). */
  sideDeg: 30,
  /** Krumningsradien på toppen av bakken og motbakken, og i dalene (m). */
  crestR: 3,
  valleyR: 4,
  /** Kulen: høyde, største helning og krumningsradius i toppunktet (m). */
  humpH: 2.5,
  humpDeg: 25,
  /**
   * Toppen av kulen er en parabel. Et legeme som glir over en parabel med krumningsradius c i toppen, letter ikke så lenge
   * v² < g·c i toppen, og da letter det heller ikke lenger ned (parabelen er like krum som en kastebane med denne farten).
   * Med h₀ ≤ 5,5 m er v² ≤ 2g · 3,0 m på toppen, så c = 7,5 m gir 25 % margin: akebrettet følger alltid bakken.
   */
  humpR: 7.5,
} as const;

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
      curvature: (x) => {
        const k = (2 * TRACK_TOP * (x - 6)) / 36;
        return (2 * TRACK_TOP) / 36 / (1 + k * k) ** 1.5;
      },
    };
  }
  // Bakke: topp (6 m), rett ned i 30°, dal (0 m), opp i 25°, kulen, ned i 25°, dal, opp i 30° og topp (6 m)
  const { crestR, valleyR, humpH, humpR } = SLED_HILL;
  const side = (SLED_HILL.sideDeg * Math.PI) / 180;
  const hump = (SLED_HILL.humpDeg * Math.PI) / 180;
  const crestDrop = crestR * (1 - Math.cos(side));
  const valleySide = valleyR * (1 - Math.cos(side));
  const valleyHump = valleyR * (1 - Math.cos(hump));
  const parabolaDrop = (humpR * Math.tan(hump) ** 2) / 2;
  const b = trackBuilder(0, TRACK_TOP).arc(crestR, -side).line(-(TRACK_TOP - crestDrop - valleySide)).arc(valleyR, 0);
  const xBottom = b.x;
  b.arc(valleyR, hump).line(humpH - valleyHump - parabolaDrop);
  const humpX = b.x + humpR * Math.tan(hump);
  b.parabola(humpR, -hump)
    .line(-(humpH - valleyHump - parabolaDrop))
    .arc(valleyR, side)
    .line(TRACK_TOP - crestDrop - valleySide)
    .arc(crestR, 0);
  const p = piecewise(b.pieces);
  return { kind, top: TRACK_TOP, xBottom, hump: { x: humpX, h: humpH, r: humpR }, ...p };
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
 * Normalkraften delt på tyngden, N/(mg), i posisjonen x når farten er v: N = m(g cos θ + κv²), der κ er krumningen
 * (negativ over en topp). Simuleringen lar legemet følge banen; den stemmer bare så lenge N > 0 overalt der det kommer.
 * (Selve formelen er Fysikk 2-stoff og brukes bare til å kontrollere at banen er realistisk, ikke i teksten.)
 */
export function normalRatio(track: Track, x: number, v: number, g = G_EARTH): number {
  const k = track.slope(x);
  const cos = 1 / Math.sqrt(1 + k * k);
  return cos + (track.curvature(x) * v * v) / g;
}

/** Den minste N/(mg) langs banen når legemet slippes fra h₀ uten friksjon (der det får størst fart). */
export function minNormalRatio(track: Track, h0: number, g = G_EARTH): number {
  let min = Infinity;
  for (let x = track.xMin; x <= track.xMax + 1e-9; x += 0.01) {
    const h = track.height(x);
    if (h > h0) continue;
    min = Math.min(min, normalRatio(track, x, Math.sqrt(2 * g * (h0 - h)), g));
  }
  return min;
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
  const hx = track.hump.x;
  const i = sim.samples.findIndex((s) => s.x >= hx);
  if (sim.R === 0 && Math.abs(sim.E0 - need) <= 1e-9 * Math.max(1, need)) return { result: 'akkurat', need, Etop: need };
  if (i < 0) return { result: 'under', need, Etop: null };
  // E akkurat på toppen: mellom punktet før og etter (E minker jevnt med strekningen når det er friksjon)
  const b = sim.samples[i]!;
  const a = sim.samples[i - 1];
  const Etop = a && b.x > a.x ? a.E + ((b.E - a.E) * (hx - a.x)) / (b.x - a.x) : b.E;
  return { result: 'over', need, Etop };
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
