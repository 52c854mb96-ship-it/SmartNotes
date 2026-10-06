/** Ren fysikk for kapittel 4 Kollisjoner og eksplosjoner (ingen React), så den kan testes for seg. */
import { G_EARTH } from '../../kit/format';

/* ---------- 4B Impulsloven ---------- */

export interface ImpactResult {
  /** Endringen i bevegelsesmengde Δp = m·v når legemet stoppes helt (kg·m/s). */
  dp: number;
  /** Gjennomsnittskraften F_gj = Δp/Δt (N). */
  Favg: number;
  /** Største kraft når kraften er en halv sinusbølge: F_maks = (π/2)·F_gj (N). */
  Fmax: number;
  /** Bremselengden under støtet (m): s = v·Δt/2. */
  stopDist: number;
  /** Største kraft i forhold til tyngden mg. */
  Gs: number;
}

/**
 * Et legeme med masse m (kg) og fart v (m/s) stoppes helt i løpet av støttiden Δt (s).
 * Kraften bygges opp og avtar igjen, modellert som en halv sinusbølge. Impulsen er arealet under F-t-grafen.
 */
export function impact(m: number, v: number, dt: number): ImpactResult {
  const dp = m * v;
  const Favg = dp / dt;
  const Fmax = (Math.PI / 2) * Favg;
  return { dp, Favg, Fmax, stopDist: (v * dt) / 2, Gs: Fmax / (m * G_EARTH) };
}

/** Kraften ved tiden t (s) i en halv sinuspuls med toppverdi Fmax og varighet Δt. Null utenfor støtet. */
export function pulseForce(Fmax: number, dt: number, t: number): number {
  return t <= 0 || t >= dt ? 0 : Fmax * Math.sin((Math.PI * t) / dt);
}

/** Impulsen (arealet under F-t-grafen) fra 0 til t for en halv sinuspuls. */
export function pulseImpulse(Fmax: number, dt: number, t: number): number {
  const tt = Math.min(Math.max(t, 0), dt);
  return ((Fmax * dt) / Math.PI) * (1 - Math.cos((Math.PI * tt) / dt));
}

/** Støttiden som gir en gitt største kraft (s): Δt = π·Δp/(2·F_maks). */
export function dtForFmax(dp: number, Fmax: number): number {
  return (Math.PI * dp) / (2 * Fmax);
}

export interface ImpactState {
  /** Kraften fra underlaget på legemet (N). */
  F: number;
  /** Farten (m/s), positiv i bevegelsesretningen før støtet. */
  v: number;
  /** Hvor langt legemet har flyttet seg siden det traff (m). Negativ før støtet. */
  s: number;
  /** Impulsen så langt (N·s): arealet under F-t-grafen fra 0 til t. */
  I: number;
}

/**
 * Tilstanden ved tiden t (s) i støtet fra `impact` (til avspilling i sakte film): t = 0 når legemet treffer, t = Δt når
 * det står stille. Med kraften som en halv sinusbue blir v(t) = (v₀/2)·(1 + cos(πt/Δt)) og
 * s(t) = (v₀/2)·(t + (Δt/π)·sin(πt/Δt)). Impulsloven gjelder i hvert øyeblikk: I(t) = m·v₀ − m·v(t).
 * Før støtet går legemet med farten v₀; tyngden er sett bort fra, som i `impact`.
 */
export function impactAt(m: number, v0: number, dt: number, t: number): ImpactState {
  if (t <= 0) return { F: 0, v: v0, s: v0 * t, I: 0 };
  if (t >= dt) return { F: 0, v: 0, s: (v0 * dt) / 2, I: m * v0 };
  const w = (Math.PI * t) / dt;
  const Fmax = (Math.PI / 2) * ((m * v0) / dt);
  return {
    F: Fmax * Math.sin(w),
    v: (v0 / 2) * (1 + Math.cos(w)),
    s: (v0 / 2) * (t + (dt / Math.PI) * Math.sin(w)),
    I: ((m * v0) / 2) * (1 - Math.cos(w)),
  };
}

/** Første tidspunkt (s) der kraften i en halv sinuspuls når F, eller null hvis toppen F_maks er mindre enn F. */
export function timeToForce(Fmax: number, dt: number, F: number): number | null {
  if (!(Fmax >= F)) return null;
  if (F <= 0) return 0;
  return (dt / Math.PI) * Math.asin(F / Fmax);
}

/* ---------- 4C/4D Sentrale støt ---------- */

export interface CollisionResult {
  /** Om vogn 1 tar igjen vogn 2 (v1 > v2). Ellers skjer det ikke noe støt. */
  collides: boolean;
  /** Farten etter støtet (m/s), positiv mot høyre. */
  u1: number;
  u2: number;
  /** Sum av bevegelsesmengde før og etter (kg·m/s). */
  pBefore: number;
  pAfter: number;
  /** Sum av kinetisk energi før og etter (J). */
  EkBefore: number;
  EkAfter: number;
  /** Kinetisk energi som går over til andre energiformer (J). */
  lost: number;
}

/**
 * Sentralt støt på en rett linje. Vogn 1 er til venstre for vogn 2, og positiv retning er mot høyre.
 * `e` sier hvor elastisk støtet er: 1 er elastisk, 0 er fullstendig uelastisk (vognene henger sammen).
 * Bevegelsesmengden er bevart for alle e; kinetisk energi bare for e = 1.
 */
export function collide(m1: number, v1: number, m2: number, v2: number, e: number): CollisionResult {
  const M = m1 + m2;
  const pBefore = m1 * v1 + m2 * v2;
  const collides = v1 > v2;
  const vcm = pBefore / M;
  const rel = v1 - v2;
  const u1 = collides ? vcm - (e * m2 * rel) / M : v1;
  const u2 = collides ? vcm + (e * m1 * rel) / M : v2;
  const ek = (m: number, v: number) => 0.5 * m * v * v;
  const EkBefore = ek(m1, v1) + ek(m2, v2);
  const EkAfter = ek(m1, u1) + ek(m2, u2);
  return { collides, u1, u2, pBefore, pAfter: m1 * u1 + m2 * u2, EkBefore, EkAfter, lost: EkBefore - EkAfter };
}

/** Største mulige tap av kinetisk energi i et støt (fullstendig uelastisk): ½·m1·m2/(m1 + m2)·(v1 − v2)². */
export function maxLoss(m1: number, v1: number, m2: number, v2: number): number {
  const rel = v1 > v2 ? v1 - v2 : 0;
  return (0.5 * m1 * m2 * rel * rel) / (m1 + m2);
}

/** e som gir at andelen `share` (0–1) av det størst mulige energitapet går tapt: tap = (1 − e²)·maks. */
export function elasticityForLossShare(share: number): number {
  return Math.sqrt(Math.max(0, Math.min(1, 1 - share)));
}

/* ---------- 4C Eksplosjon / rekyl ---------- */

export interface ExplosionResult {
  /** Fart etterpå (m/s). Legeme 1 går mot venstre (negativ), legeme 2 mot høyre. */
  v1: number;
  v2: number;
  /** Bevegelsesmengde (kg·m/s). p1 = −p2. */
  p1: number;
  p2: number;
  /** Kinetisk energi (J). E_k = p²/(2m), så den lette får mest. */
  Ek1: number;
  Ek2: number;
}

/**
 * To legemer i ro skyves fra hverandre (fjær, krutt) og får til sammen den kinetiske energien E (J).
 * Σp = 0 før og etter: m1·v1 + m2·v2 = 0. Med E = p²/(2m1) + p²/(2m2) blir p = √(2E·m1·m2/(m1 + m2)).
 */
export function explode(m1: number, m2: number, E: number): ExplosionResult {
  const p = Math.sqrt((2 * Math.max(0, E) * m1 * m2) / (m1 + m2));
  return { v1: -p / m1, v2: p / m2, p1: -p, p2: p, Ek1: (p * p) / (2 * m1), Ek2: (p * p) / (2 * m2) };
}

export interface PushResult extends ExplosionResult {
  /** Kraften mellom legemene mens de skyves fra hverandre (N). Konstant i modellen (gjennomsnittskraften). */
  F: number;
  /** Hvor lenge kraften virker (s): Δt = p/F. */
  dt: number;
  /** Impulsen på legeme 2 (N·s): I = F·Δt = p₂. Legeme 1 får −I. */
  I: number;
  /** Energien som blir kinetisk energi (J): arbeidet E = F·D. */
  E: number;
  /** Hvor mye avstanden mellom legemene øker mens kraften virker (m). */
  D: number;
}

/**
 * To legemer i ro skyves fra hverandre av en konstant kraft F (N) mens avstanden mellom dem øker med D (m): armene
 * strekkes, fjæra spretter ut eller kula går gjennom løpet. Arbeidet F·D blir kinetisk energi, så farten etterpå er
 * den samme som i explode(m1, m2, F·D). Kraften virker i Δt = p/F, og begge får impulsen F·Δt (motsatt rettet).
 * Med E kjent i stedet for F (fjær, krutt): pushApart(m1, m2, E/D, D).
 */
export function pushApart(m1: number, m2: number, F: number, D: number): PushResult {
  const force = Math.max(0, F);
  const dist = Math.max(0, D);
  const E = force * dist;
  const r = explode(m1, m2, E);
  return { ...r, F: force, dt: force > 0 ? r.p2 / force : 0, I: r.p2, E, D: dist };
}

export type PushPhase = 'for' | 'under' | 'etter';

export interface PushState {
  /** Før dyttet (i ro), under dyttet (kraften virker) eller etter (jevn fart). */
  phase: PushPhase;
  /** Hvor langt hvert legeme har flyttet seg fra start (m), negativt mot venstre. */
  x1: number;
  x2: number;
  /** Farten (m/s), positiv mot høyre. */
  v1: number;
  v2: number;
  /** Kraften på legeme 2 (N, mot høyre). Legeme 1 får −F (Newtons 3. lov). Null før og etter dyttet. */
  F: number;
}

/**
 * Tilstanden ved tiden t (s) etter at dyttet begynner (t < 0: i ro). Kraften er konstant i [0, Δt], så farten øker
 * jevnt (v = a·t, s = ½·a·t²), og etterpå går begge med jevn fart. Σp = 0 og massesenteret står stille hele tiden.
 */
export function pushAt(m1: number, m2: number, r: PushResult, t: number): PushState {
  if (!(t >= 0)) return { phase: 'for', x1: 0, x2: 0, v1: 0, v2: 0, F: 0 };
  if (t < r.dt) {
    const a1 = -r.F / m1;
    const a2 = r.F / m2;
    return { phase: 'under', x1: 0.5 * a1 * t * t, x2: 0.5 * a2 * t * t, v1: a1 * t, v2: a2 * t, F: r.F };
  }
  // Etter dyttet: x = v·(t − Δt/2), som henger sammen med ½·a·Δt² når t = Δt.
  const tt = t - r.dt / 2;
  return { phase: 'etter', x1: r.v1 * tt, x2: r.v2 * tt, v1: r.v1, v2: r.v2, F: 0 };
}

/* ---------- Tegnehjelp: posisjoner langs en bane ---------- */

export interface TrackFit {
  /** Piksler per meter. */
  scale: number;
  /** Piksel-x for posisjonen 0 m. */
  origin: number;
}

/**
 * Velger skala og nullpunkt så alle intervallene [a, b] (i meter, med fast bredde i piksler foran og bak)
 * får plass mellom xMin og xMax. `extents` er [venstre kant (m), høyre kant (m), piksler til venstre, piksler til høyre].
 */
export function fitTrack(extents: [number, number, number, number][], xMin: number, xMax: number, maxScale: number): TrackFit {
  // Finn største skala k der max(b·k + pr) − min(a·k − pl) ≤ bredden, ved halvering (funksjonen er voksende i k).
  const width = xMax - xMin;
  const span = (k: number) => {
    let lo = Infinity;
    let hi = -Infinity;
    for (const [a, b, pl, pr] of extents) {
      lo = Math.min(lo, a * k - pl);
      hi = Math.max(hi, b * k + pr);
    }
    return { lo, hi };
  };
  let k0 = 0;
  let k1 = maxScale;
  const fits = (k: number) => {
    const { lo, hi } = span(k);
    return hi - lo <= width;
  };
  if (fits(k1)) k0 = k1;
  else
    for (let i = 0; i < 40; i++) {
      const mid = (k0 + k1) / 2;
      if (fits(mid)) k0 = mid;
      else k1 = mid;
    }
  const { lo, hi } = span(k0);
  return { scale: k0, origin: xMin + (width - (hi - lo)) / 2 - lo };
}
