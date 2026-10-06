/**
 * Forløpet i et sentralt støt mellom to labvogner på en bane (4C, 4D), til avspillingen i «Sentrale støt».
 *
 * Sluttfartene kommer fra `collide` i model.ts. Her regnes også selve støtet: det varer en kort støttid τ, og
 * kraften mellom vognene bygges opp og avtar som en halv sinusbue (slik en fjær gir). Kraften fra vogn 2 på vogn 1 er
 * like stor og motsatt rettet som kraften fra vogn 1 på vogn 2 (Newtons 3. lov), og de virker like lenge. Da er
 * impulsene like store og motsatte, og Σp er bevart i hvert øyeblikk av støtet, ikke bare før og etter.
 *
 * Posisjonene regnes for tuppen av støtfangeren: vogn 1 er til venstre og har støtfangeren foran (mot høyre),
 * vogn 2 til høyre har den bak (mot venstre). Positiv retning er mot høyre.
 */
import { collide, type CollisionResult } from './model';

/* ---------- Selve støtet ---------- */

export interface ContactState {
  /** Hvor langt tuppen av støtfangeren har flyttet seg siden første kontakt (m), positiv mot høyre. */
  s1: number;
  s2: number;
  /** Farten (m/s). */
  v1: number;
  v2: number;
  /** Kraften mellom vognene (N), ≥ 0. Den virker mot venstre på vogn 1 og mot høyre på vogn 2. */
  F: number;
  /** Impulsen fra vogn 1 på vogn 2 så langt (N·s). Vogn 1 får like stor impuls motsatt vei. */
  I: number;
}

/** Hele impulsen i støtet (N·s): J = m₁m₂/(m₁ + m₂) · (1 + e) · (v₁ − v₂), og 0 når vognene ikke treffer hverandre. */
export function contactImpulse(m1: number, v1: number, m2: number, v2: number, e: number): number {
  if (!(v1 > v2)) return 0;
  return ((m1 * m2) / (m1 + m2)) * (1 + e) * (v1 - v2);
}

/**
 * Tilstanden ved tiden t (s) etter første kontakt (t = 0 når støtfangerne møtes). Kraften er en halv sinusbue
 * F(t) = (π/2)·(J/τ)·sin(πt/τ) i 0 < t < τ, så impulsen så langt er I(t) = (J/2)·(1 − cos(πt/τ)). Farten følger av
 * impulsloven: v₁(t) = v₁ − I/m₁ og v₂(t) = v₂ + I/m₂. Før kontakt går vognene med v₁ og v₂, etterpå med sluttfartene.
 * Med τ = 0 skjer støtet på et øyeblikk.
 */
export function contactAt(m1: number, v1: number, m2: number, v2: number, e: number, tau: number, t: number): ContactState {
  const J = contactImpulse(m1, v1, m2, v2, e);
  if (t <= 0 || J === 0) return { s1: v1 * t, s2: v2 * t, v1, v2, F: 0, I: 0 };
  const u1 = v1 - J / m1;
  const u2 = v2 + J / m2;
  if (!(tau > 0) || t >= tau) {
    // Etter støtet: posisjonen ved slutten av støtet pluss jevn fart. I støtet flytter tuppene seg (v + u)·τ/2.
    const T = tau > 0 ? tau : 0;
    return { s1: ((v1 + u1) * T) / 2 + u1 * (t - T), s2: ((v2 + u2) * T) / 2 + u2 * (t - T), v1: u1, v2: u2, F: 0, I: J };
  }
  const w = (Math.PI * t) / tau;
  const I = (J / 2) * (1 - Math.cos(w));
  // ∫I dt fra 0 til t
  const area = (J / 2) * (t - (tau / Math.PI) * Math.sin(w));
  return {
    s1: v1 * t - area / m1,
    s2: v2 * t + area / m2,
    v1: v1 - I / m1,
    v2: v2 + I / m2,
    F: ((Math.PI * J) / (2 * tau)) * Math.sin(w),
    I,
  };
}

/**
 * Største sammentrykk av støtfangerne i forhold til (v₁ − v₂)·τ. Sammentrykket er størst når vognene har samme fart,
 * dvs. når cos(πt/τ) = (e − 1)/(e + 1). Elastisk (e = 1): 1/π (midt i støtet); fullstendig uelastisk (e = 0): 1/2 (på
 * slutten, og det blir værende fordi vognene henger sammen).
 */
export function compressionFactor(e: number): number {
  const ee = Math.min(1, Math.max(0, e));
  const s = Math.acos((ee - 1) / (ee + 1)) / Math.PI;
  return s - ((1 + ee) / 2) * (s - Math.sin(Math.PI * s) / Math.PI);
}

/** Støtfangerne på labvognene: fjær (elastisk), gummi (uelastisk) og borrelås (vognene henger sammen). */
export type Bumper = 'fjaer' | 'gummi' | 'borrelaas';

/** Hvor mye støtfangerne (begge sammen) kan presses inn (m) i et kraftig støt. */
export const BUMPER_SQUEEZE: Record<Bumper, number> = { fjaer: 0.03, gummi: 0.012, borrelaas: 0.006 };

/** Hvor mye støtfangerne presses sammen (m) når de møtes med den relative farten `rel` (m/s): mindre i rolige støt. */
export function squeezeFor(bumper: Bumper, rel: number): number {
  return BUMPER_SQUEEZE[bumper] * Math.min(1, Math.max(0.3, rel / 2));
}

/** Støttiden τ (s) som gir sammentrykket `squeeze` (m): squeeze = k(e)·(v₁ − v₂)·τ. */
export function contactTime(rel: number, e: number, squeeze: number): number {
  if (!(rel > 0) || !(squeeze > 0)) return 0;
  return squeeze / (compressionFactor(e) * rel);
}

/* ---------- Forsøket på banen ---------- */

/** Hvor lenge vognene kjører før og etter støtet (s) når det er plass på banen. Ellers kortes begge ned like mye. */
export const T_BEFORE = 1.5;
export const T_AFTER = 2;

export interface RunSpec {
  m1: number;
  v1: number;
  m2: number;
  v2: number;
  /** Elastisitet: 1 = elastisk, 0 = fullstendig uelastisk. */
  e: number;
  bumper: Bumper;
  /** Lengden på banebiten som vises (m). */
  length: number;
  /** Fra tuppen av støtfangeren til bakenden av vogna (m): vogn 1 går w1 til venstre for tuppen, vogn 2 w2 til høyre. */
  w1: number;
  w2: number;
  /** Luft ved hver ende av banebiten (m). */
  margin: number;
}

export interface Run {
  result: CollisionResult;
  collides: boolean;
  /** Tidspunktet for første kontakt (s). */
  tHit: number;
  /** Støttiden (s), 0 uten støt. */
  tau: number;
  /** Slutten av forsøket (s). */
  tEnd: number;
  /** Posisjonen langs banen (m) der støtfangertuppene møtes. Uten støt: tuppen til vogn 1 ved t = 0. */
  x0: number;
  /** Uten støt: avstanden mellom tuppene ved t = 0 (m). Med støt: 0. */
  gap: number;
  /** Hvor mye tidene er kortet ned for at vognene skal holde seg på banen (1 = ikke kortet ned). */
  lambda: number;
}

/** Posisjonene (m langs banen) til tuppene av støtfangerne, fartene og kraften ved tiden t (s) i forsøket. */
export interface RunState extends ContactState {
  tip1: number;
  tip2: number;
  /** Hvor mye støtfangerne er presset sammen (m), ≥ 0. */
  squeeze: number;
  phase: 'for' | 'under' | 'etter' | 'ingen';
}

const relSpeed = (s: { v1: number; v2: number }) => s.v1 - s.v2;

/** Tuppene i forhold til møtepunktet ved tiden t (s) etter første kontakt. */
function rel(spec: RunSpec, tau: number, t: number): ContactState {
  return contactAt(spec.m1, spec.v1, spec.m2, spec.v2, spec.e, tau, t);
}

/**
 * Planlegger forsøket så begge vognene er på banebiten hele tiden: vognene kjører T_BEFORE før støtet og T_AFTER
 * etter (kortet ned med samme faktor λ når farten er stor), og hele bevegelsen sentreres på banen.
 */
export function planRun(spec: RunSpec): Run {
  const result = collide(spec.m1, spec.v1, spec.m2, spec.v2, spec.e);
  const avail = spec.length - 2 * spec.margin;
  const fitLambda = (width: (lambda: number) => number) => {
    if (width(1) <= avail) return 1;
    let lo = 0;
    let hi = 1;
    for (let i = 0; i < 50; i++) {
      const mid = (lo + hi) / 2;
      if (width(mid) <= avail) lo = mid;
      else hi = mid;
    }
    return lo;
  };

  if (!result.collides) {
    // Uten støt øker avstanden hele tiden (v₁ ≤ v₂). Start med en tydelig luke mellom vognene.
    const gap = Math.max(0, Math.min(0.25, 0.5 * (avail - spec.w1 - spec.w2)));
    const T = T_BEFORE + T_AFTER;
    const extent = (l: number) => {
      const lo = Math.min(0, spec.v1 * T * l) - spec.w1;
      const hi = gap + Math.max(0, spec.v2 * T * l) + spec.w2;
      return { lo, hi };
    };
    const lambda = fitLambda((l) => extent(l).hi - extent(l).lo);
    const { lo, hi } = extent(lambda);
    const x0 = spec.margin + (avail - (hi - lo)) / 2 - lo;
    return { result, collides: false, tHit: 0, tau: 0, tEnd: T * lambda, x0, gap, lambda };
  }

  const r = relSpeed(spec);
  const tau = contactTime(r, spec.e, squeezeFor(spec.bumper, r));
  const extent = (l: number) => {
    const times = [-T_BEFORE * l, 0, tau, tau + T_AFTER * l];
    const states = times.map((t) => rel(spec, tau, t));
    // Vogn 1 er alltid til venstre for vogn 2: venstre ende av vogn 1 og høyre ende av vogn 2 gir plassen som trengs.
    // s₁ er konkav i støtet (farten avtar) og s₂ konveks, så ytterpunktene er i endene av hver fase.
    const lo = Math.min(...states.map((s) => s.s1)) - spec.w1;
    const hi = Math.max(...states.map((s) => s.s2)) + spec.w2;
    return { lo, hi };
  };
  const lambda = fitLambda((l) => extent(l).hi - extent(l).lo);
  const { lo, hi } = extent(lambda);
  const x0 = spec.margin + (avail - (hi - lo)) / 2 - lo;
  const tHit = T_BEFORE * lambda;
  return { result, collides: true, tHit, tau, tEnd: tHit + tau + T_AFTER * lambda, x0, gap: 0, lambda };
}

/** Tilstanden i forsøket ved tiden t (s), fra 0 til run.tEnd. */
export function runAt(spec: RunSpec, run: Run, t: number): RunState {
  if (!run.collides) {
    const tip1 = run.x0 + spec.v1 * t;
    const tip2 = run.x0 + run.gap + spec.v2 * t;
    return { s1: spec.v1 * t, s2: spec.v2 * t, v1: spec.v1, v2: spec.v2, F: 0, I: 0, tip1, tip2, squeeze: 0, phase: 'ingen' };
  }
  const tt = t - run.tHit;
  const c = rel(spec, run.tau, tt);
  const phase = tt < 0 ? 'for' : tt < run.tau ? 'under' : 'etter';
  return { ...c, tip1: run.x0 + c.s1, tip2: run.x0 + c.s2, squeeze: Math.max(0, c.s1 - c.s2), phase };
}

/* ---------- Avspilling ---------- */

/** Hvor lenge (s, ekte tid) avspillingen av fasene før og etter støtet varer til sammen, og selve støtet. */
export const PLAY_SECONDS = 3.2;
export const CONTACT_PLAY_SECONDS = 1.2;

export interface Playback {
  /** Simulert tid per sekund ekte tid før og etter støtet (1 = sanntid, 0,25 = fire ganger saktere). */
  rate: number;
  /** Simulert tid per sekund rundt selve støtet (enda saktere, så sammentrykket og kreftene kan sees). */
  contactRate: number;
  /** Tidsrommet (s) som spilles av med contactRate. */
  slowFrom: number;
  slowTo: number;
}

/**
 * Avspillingsfarten: før og etter støtet går klokka like fort (så fartene kan sammenlignes på skjermen), og
 * hele forsøket tar ca. PLAY_SECONDS (aldri fortere enn sanntid). Rundt selve støtet går den mye saktere.
 */
export function playback(run: Run): Playback {
  const free = Math.max(1e-6, run.tEnd - run.tau);
  const rate = Math.min(1, free / PLAY_SECONDS);
  if (!run.collides || !(run.tau > 0)) return { rate, contactRate: rate, slowFrom: Infinity, slowTo: -Infinity };
  // Litt før og etter støtet også, så to bilder (inntil 0,05 s ekte tid hver; avspillingsfarten byttes ett bilde
  // for sent) ikke hopper over starten av støtet.
  const pad = Math.max(0.3 * run.tau, 0.12 * rate);
  const slowFrom = Math.max(0, run.tHit - pad);
  const slowTo = Math.min(run.tEnd, run.tHit + run.tau + pad);
  const contactRate = Math.min(rate, (slowTo - slowFrom) / CONTACT_PLAY_SECONDS);
  return { rate, contactRate, slowFrom, slowTo };
}

/** Avspillingsfarten ved tiden t. */
export function rateAt(p: Playback, t: number): number {
  return t >= p.slowFrom && t < p.slowTo ? p.contactRate : p.rate;
}

/** Grensene (s simulert tid) for det langsomme tidsrommet, klemt inn i forsøket: 0 ≤ a ≤ b ≤ tEnd. */
function slowWindow(p: Playback, run: Run): [number, number] {
  const a = Math.min(run.tEnd, Math.max(0, p.slowFrom));
  const b = Math.min(run.tEnd, Math.max(a, p.slowTo));
  return [a, b];
}

/** Hvor lenge hele avspillingen varer (s ekte tid): før og etter støtet med `rate`, rundt støtet med `contactRate`. */
export function playDuration(p: Playback, run: Run): number {
  const [a, b] = slowWindow(p, run);
  return a / p.rate + (b - a) / p.contactRate + (run.tEnd - b) / p.rate;
}

/**
 * Simulert tid (s) etter `real` sekunder avspilling, fra 0 til playDuration. Klokka i visualiseringen teller ekte
 * avspillingstid, og denne funksjonen gir tiden i forsøket, så sakte film rundt støtet blir eksakt (ingen hopp).
 */
export function simTimeAt(p: Playback, run: Run, real: number): number {
  const [a, b] = slowWindow(p, run);
  const ra = a / p.rate;
  const rb = ra + (b - a) / p.contactRate;
  const r = Math.max(0, real);
  const t = r <= ra ? r * p.rate : r <= rb ? a + (r - ra) * p.contactRate : b + (r - rb) * p.rate;
  return Math.min(run.tEnd, t);
}

/** Avspillingstiden (s ekte tid) da forsøket er kommet til den simulerte tiden t (s); motsatt av simTimeAt. */
export function playTimeAt(p: Playback, run: Run, t: number): number {
  const [a, b] = slowWindow(p, run);
  const tt = Math.min(run.tEnd, Math.max(0, t));
  if (tt <= a) return tt / p.rate;
  if (tt <= b) return a / p.rate + (tt - a) / p.contactRate;
  return a / p.rate + (b - a) / p.contactRate + (tt - b) / p.rate;
}
