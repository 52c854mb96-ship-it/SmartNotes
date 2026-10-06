/**
 * Ren fysikk for visualiseringen «ballspark» (4A Bevegelsesmengde, 4B Impulsloven): foten, racketen eller
 * golfkølla presser på en ball som ligger i ro. Kraften er en puls (halv sinusbue eller trekant) med største
 * kraft F_maks og kontakttid Δt. Arealet under F-t-grafen er impulsen I, og impulsloven gir farten etter treffet:
 * I = Δp = m·v − m·v₀ = m·v, så v = I/m.
 *
 * Alle størrelser er i SI-enheter (N, s, kg, m/s) i funksjonene; UI-et viser ms og kN.
 * Tyngden, friksjonen og luftmotstanden er så små mot kraften i treffet (fotballen: G ≈ 4 N mot over 1 000 N) at vi
 * ser bort fra dem, og ballen beveger seg på en rett linje.
 */

/* ---------- Kraftpulsen ---------- */

/** Formen på kraftkurven: en halv sinusbue (som en fjær som presses sammen og spretter ut) eller en trekant. */
export type PulseShape = 'bue' | 'trekant';

/** Arealet under pulsen som andel av rektangelet F_maks · Δt: 2/π ≈ 0,64 for en halv sinusbue og 1/2 for en trekant. */
export function shapeFactor(shape: PulseShape): number {
  return shape === 'trekant' ? 0.5 : 2 / Math.PI;
}

/** Kraften (N) ved tiden t (s) i en puls med toppverdi Fmax (N) og varighet dt (s). Null før og etter treffet. */
export function pulseForce(shape: PulseShape, Fmax: number, dt: number, t: number): number {
  if (!(dt > 0) || t <= 0 || t >= dt) return 0;
  if (shape === 'trekant') return t <= dt / 2 ? (2 * Fmax * t) / dt : (2 * Fmax * (dt - t)) / dt;
  return Fmax * Math.sin((Math.PI * t) / dt);
}

/** Impulsen fra 0 til t (N·s): arealet under F-t-grafen så langt. Etter treffet er den hele arealet. */
export function pulseImpulse(shape: PulseShape, Fmax: number, dt: number, t: number): number {
  if (!(dt > 0)) return 0;
  const tau = Math.min(Math.max(t, 0), dt);
  if (shape === 'trekant') {
    return tau <= dt / 2 ? (Fmax * tau * tau) / dt : (Fmax * dt) / 2 - (Fmax * (dt - tau) ** 2) / dt;
  }
  return ((Fmax * dt) / Math.PI) * (1 - Math.cos((Math.PI * tau) / dt));
}

/**
 * ∫₀ᵗ I(τ) dτ (N·s²) for t ≥ 0, der I(τ) er impulsen så langt. Delt på massen gir det hvor langt en ball som lå i
 * ro, har flyttet seg. Etter treffet vokser det lineært med hele impulsen. For en symmetrisk puls er verdien ved
 * t = Δt lik I·Δt/2 (ballen har flyttet seg v·Δt/2 når den slipper).
 */
export function impulseIntegral(shape: PulseShape, Fmax: number, dt: number, t: number): number {
  if (!(dt > 0) || t <= 0) return 0;
  const tau = Math.min(t, dt);
  let a: number;
  if (shape === 'trekant') {
    const h = dt / 2;
    a =
      tau <= h
        ? (Fmax * tau ** 3) / (3 * dt)
        : (Fmax * h ** 3) / (3 * dt) + ((Fmax * dt) / 2) * (tau - h) + (Fmax * ((dt - tau) ** 3 - h ** 3)) / (3 * dt);
  } else {
    a = ((Fmax * dt) / Math.PI) * (tau - (dt / Math.PI) * Math.sin((Math.PI * tau) / dt));
  }
  return t > dt ? a + shapeFactor(shape) * Fmax * dt * (t - dt) : a;
}

/* ---------- Treffet ---------- */

export interface KickResult {
  /** Impulsen I = arealet under F-t-grafen (N·s). Lik endringen i bevegelsesmengde Δp. */
  I: number;
  /** Gjennomsnittskraften F_gj = I/Δt (N): høyden på et rektangel med samme areal. */
  Favg: number;
  /** Farten etter treffet (m/s): v = I/m, fordi ballen lå i ro. */
  v: number;
  /** Den samme farten i km/h. */
  kmh: number;
  /** Bevegelsesmengden etter treffet p = m·v (kg·m/s), lik I. */
  p: number;
  /** Kinetisk energi etter treffet (J). */
  Ek: number;
  /** Hvor langt ballen flytter seg mens den er i kontakt (m): v·Δt/2 for en symmetrisk puls. */
  contactDist: number;
}

/** En ball med masse m (kg) som ligger i ro, får en kraftpuls med toppverdi Fmax (N) som varer i dt (s). */
export function kick(m: number, Fmax: number, dt: number, shape: PulseShape): KickResult {
  const I = shapeFactor(shape) * Fmax * dt;
  const v = I / m;
  return {
    I,
    Favg: dt > 0 ? I / dt : 0,
    v,
    kmh: v * 3.6,
    p: m * v,
    Ek: 0.5 * m * v * v,
    contactDist: impulseIntegral(shape, Fmax, dt, dt) / m,
  };
}

export type KickPhase = 'for' | 'under' | 'etter';

export interface KickState {
  /** Kraften på ballen (N). */
  F: number;
  /** Impulsen så langt (N·s). */
  I: number;
  /** Farten til ballen (m/s): I/m. */
  v: number;
  /** Hvor langt ballen har flyttet seg fra der den lå (m). */
  s: number;
  phase: KickPhase;
}

/** Tilstanden ved tiden t (s), der t = 0 er når treffet begynner. Før det ligger ballen i ro. */
export function kickAt(m: number, Fmax: number, dt: number, shape: PulseShape, t: number): KickState {
  const I = pulseImpulse(shape, Fmax, dt, t);
  return {
    F: pulseForce(shape, Fmax, dt, t),
    I,
    v: I / m,
    s: impulseIntegral(shape, Fmax, dt, t) / m,
    phase: t <= 0 ? 'for' : t < dt ? 'under' : 'etter',
  };
}

/** Den største kraften (N) som trengs for å gi ballen farten v (m/s) på kontakttiden dt (s). */
export function fmaxFor(m: number, v: number, dt: number, shape: PulseShape): number {
  return (m * v) / (shapeFactor(shape) * dt);
}

/* ---------- Ballene ---------- */

export type SportId = 'fotball' | 'tennis' | 'golf';

export interface Range {
  min: number;
  max: number;
  step: number;
  /** Standardverdien: et typisk treff. */
  def: number;
}

export type LevelId = 'rolig' | 'middels' | 'hardt' | 'topp' | 'ekstrem';

export interface SpeedLevel {
  id: LevelId;
  /** Øvre grense (m/s); det siste nivået har Infinity. */
  upTo: number;
  /** «et hardt skudd», til overskriften i forklaringen. */
  text: string;
}

export interface SportSpec {
  id: SportId;
  /** Navnet på knappen. */
  label: string;
  /** I en setning: «fotballen», «tennisballen», «golfballen». */
  ball: string;
  /** Det som treffer ballen: «foten», «racketen», «kølla». */
  hitter: string;
  /** Treffet: «sparket», «serven», «slaget». */
  hit: string;
  /** Massen (kg) og radien (m) til ballen. */
  m: number;
  r: number;
  /** Kontakttiden i millisekunder. */
  dtMs: Range;
  /** Største kraft i newton. */
  F: Range;
  /** Kraften vises i N eller kN. */
  forceUnit: 'N' | 'kN';
  /** Grafens akser: tid (ms) og kraft (N). */
  tAxisMs: number;
  FAxis: number;
  /** Sakte film: simulert tid (s) per sekund avspilling. */
  slowmo: number;
  /** Fartsnivåer i stigende rekkefølge. */
  levels: SpeedLevel[];
  /** Farten til ballen delt på farten til foten, racketen eller køllehodet rett før treffet (til animasjonen). */
  speedRatio: number;
  /** Hvor mye ballen presses flat ved standardverdiene (andel av radien), til tegningen. */
  squashDef: number;
}

/**
 * Typiske verdier: en fotball på 430 g som sparkes med vristen (kontakttid ca. 10 ms), en tennisball på 57 g i en
 * serve (ca. 5 ms mot strengene) og en golfball på 46 g som slås ut med en driver (under et halvt millisekund).
 * Nivåene for farten er omtrentlige.
 */
export const SPORTS: Record<SportId, SportSpec> = {
  fotball: {
    id: 'fotball',
    label: 'Fotball',
    ball: 'fotballen',
    hitter: 'foten',
    hit: 'sparket',
    m: 0.43,
    r: 0.11,
    dtMs: { min: 4, max: 16, step: 0.5, def: 10 },
    F: { min: 200, max: 3000, step: 100, def: 1500 },
    forceUnit: 'kN',
    tAxisMs: 18,
    FAxis: 3200,
    slowmo: 0.01,
    levels: [
      { id: 'rolig', upTo: 8, text: 'en rolig pasning' },
      { id: 'middels', upTo: 18, text: 'en hard pasning' },
      { id: 'hardt', upTo: 30, text: 'et hardt skudd' },
      { id: 'topp', upTo: 45, text: 'et skudd i verdensklasse' },
      { id: 'ekstrem', upTo: Infinity, text: 'hardere enn nesten noen klarer å sparke' },
    ],
    speedRatio: 1.25,
    squashDef: 0.22,
  },
  tennis: {
    id: 'tennis',
    label: 'Tennis',
    ball: 'tennisballen',
    hitter: 'racketen',
    hit: 'serven',
    m: 0.057,
    r: 0.0335,
    dtMs: { min: 2, max: 8, step: 0.5, def: 5 },
    F: { min: 100, max: 1500, step: 25, def: 700 },
    forceUnit: 'N',
    tAxisMs: 9,
    FAxis: 1600,
    slowmo: 0.005,
    levels: [
      { id: 'rolig', upTo: 20, text: 'en forsiktig serve' },
      { id: 'middels', upTo: 36, text: 'en vanlig serve' },
      { id: 'hardt', upTo: 55, text: 'en hard serve' },
      { id: 'topp', upTo: 70, text: 'en serve i verdensklasse' },
      { id: 'ekstrem', upTo: Infinity, text: 'hardere enn nesten noen klarer å serve' },
    ],
    speedRatio: 1.35,
    squashDef: 0.3,
  },
  golf: {
    id: 'golf',
    label: 'Golf',
    ball: 'golfballen',
    hitter: 'kølla',
    hit: 'slaget',
    m: 0.046,
    r: 0.02135,
    dtMs: { min: 0.2, max: 1, step: 0.05, def: 0.45 },
    F: { min: 1000, max: 20000, step: 500, def: 9000 },
    forceUnit: 'kN',
    tAxisMs: 1.2,
    FAxis: 21000,
    slowmo: 0.0005,
    levels: [
      { id: 'rolig', upTo: 35, text: 'et svakt utslag' },
      { id: 'middels', upTo: 60, text: 'et vanlig utslag' },
      { id: 'hardt', upTo: 72, text: 'et langt utslag' },
      { id: 'topp', upTo: 82, text: 'et utslag i verdensklasse' },
      { id: 'ekstrem', upTo: Infinity, text: 'hardere enn nesten noen klarer å slå' },
    ],
    speedRatio: 1.45,
    squashDef: 0.22,
  },
};

export const SPORT_IDS: SportId[] = ['fotball', 'tennis', 'golf'];

/** Fartsnivået til et treff (det første nivået med v < upTo). */
export function speedLevel(sport: SportSpec, v: number): SpeedLevel {
  return sport.levels.find((l) => v < l.upTo) ?? sport.levels[sport.levels.length - 1]!;
}

/** Et typisk treff for ballen (standardverdiene). */
export function typicalKick(sport: SportSpec, shape: PulseShape = 'bue'): KickResult {
  return kick(sport.m, sport.F.def, sport.dtMs.def / 1000, shape);
}

/**
 * Hvor mye ballen er presset flat i den største kraften, som andel av radien (til tegningen). Ballen og det som
 * treffer den, oppfører seg omtrent som en fjær: kontakttiden er en halv svingetid, Δt = π·√(m/k), så
 * sammentrykningen F_maks/k = F_maks·(Δt/π)²/m vokser med kraften og med kvadratet av kontakttiden. Her skaleres den fra
 * et typisk treff og holdes mellom 4 % og 45 % av radien, så tegningen alltid ser ut som en ball.
 */
export function squashMax(sport: SportSpec, Fmax: number, dtMs: number): number {
  const rel = (Fmax * dtMs * dtMs) / (sport.F.def * sport.dtMs.def * sport.dtMs.def);
  const q = sport.squashDef * rel;
  return Math.min(0.45, Math.max(0.04, Number.isFinite(q) ? q : 0.04));
}
