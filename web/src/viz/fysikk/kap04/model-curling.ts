/**
 * Ren fysikk for «Curling: rett treff på en stein i ro» (4A, 4C, 4D), uten React, så den kan testes for seg.
 *
 * En rød curlingstein glir rett inn i en like tung gul stein som ligger i ro (sentralt støt). Positiv retning er
 * fartsretningen til den røde steinen før støtet. Med like masser og den gule i ro sier bevaring av
 * bevegelsesmengde at v₁′ + v₂′ = v₁, så alt bestemmes av hvor stor del av farten den røde beholder:
 *   v₁′ = a · v₁ og v₂′ = (1 − a) · v₁, der 0 ≤ a ≤ ½.
 * a = 0 er et elastisk støt (den røde stopper helt), a = ½ er fullstendig uelastisk (felles fart). Andelen av den
 * kinetiske energien som går tapt, blir 1 − a² − (1 − a)² = 2a(1 − a), som er mellom 0 og ½.
 */
import { G_EARTH } from '../../kit/format';

/** Massen til en curlingstein (kg). Reglene tillater 17,2–20,0 kg; de fleste veier rundt 19 kg. */
export const STONE_MASS = 19;
/** Største diameter på en curlingstein (m). */
export const STONE_DIAMETER = 0.29;
/** Radiene til ringene i huset (m): 12 fot, 8 fot, 4 fot og midten («knappen», 1 fot). */
export const HOUSE_RADII = [1.829, 1.219, 0.61, 0.152] as const;

/**
 * Glidebryteren for farten til den røde steinen rett før støtet (m/s). Startverdien er ikke 2,0 m/s, for da blir
 * p = 38,0 kg·m/s og E_k = 38,0 J samme tall, og det kan få p og E_k til å se ut som det samme.
 */
export const SPEED = { min: 0.5, max: 3, step: 0.1, initial: 2.5 } as const;
/** Glidebryteren for energitapet i et uelastisk støt (andel av E_k før støtet). Over 0,5 går ikke. */
export const LOSS = { min: 0.02, max: 0.48, step: 0.01, initial: 0.1 } as const;

/** Omtrentlig friksjonstall mellom curlingstein og is (rundt 0,01; det varierer med isen). */
export const MU_ICE = 0.01;
/** Omtrentlig varighet av støtet mellom to granittsteiner (s). */
export const CONTACT_TIME = 0.001;

export type HitKind = 'elastisk' | 'uelastisk' | 'fullstendig';

export const HIT_KINDS: { value: HitKind; label: string }[] = [
  { value: 'elastisk', label: 'Elastisk' },
  { value: 'uelastisk', label: 'Uelastisk' },
  { value: 'fullstendig', label: 'Fullstendig uelastisk' },
];

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Andelen av den kinetiske energien som går tapt når den røde beholder andelen a av farten: 2a(1 − a). */
export function lossShareForSpeedShare(a: number): number {
  return 2 * a * (1 - a);
}

/**
 * Hvor stor andel a (0–½) av farten den røde steinen beholder når andelen L (0–½) av den kinetiske energien går
 * tapt: løsningen av 2a(1 − a) = L som er mindre enn ½, a = (1 − √(1 − 2L))/2.
 */
export function speedShareForLoss(L: number): number {
  const l = clamp(Number.isFinite(L) ? L : 0, 0, 0.5);
  return (1 - Math.sqrt(1 - 2 * l)) / 2;
}

/** Kinetisk energi etter støtet i forhold til før når den røde beholder andelen a av farten: a² + (1 − a)². */
export function kineticRatio(a: number): number {
  return a * a + (1 - a) * (1 - a);
}

export interface CurlingHit {
  /** Massen til hver stein (kg). */
  m: number;
  /** Farten til den røde steinen rett før støtet (m/s). Den gule ligger i ro. */
  v: number;
  kind: HitKind;
  /** Andelen av farten den røde beholder: v₁′ = a · v. */
  a: number;
  /** Farten rett etter støtet (m/s), positiv i samme retning som den røde kom. */
  v1: number;
  v2: number;
  /** Bevegelsesmengde (kg·m/s): før støtet (bare den røde) og etter (hver stein og summen). */
  p: number;
  p1: number;
  p2: number;
  pAfter: number;
  /** Kinetisk energi (J): før støtet og etter (hver stein og summen). */
  Ek: number;
  Ek1: number;
  Ek2: number;
  EkAfter: number;
  /** Kinetisk energi som blir til andre energiformer i støtet (J), og andelen av E_k før. */
  lost: number;
  lossShare: number;
}

/**
 * Rett (sentralt) støt mellom to like tunge curlingsteiner der den gule ligger i ro. `loss` er andelen av den
 * kinetiske energien som går tapt i et uelastisk støt (0–½); den brukes ikke for de to andre typene.
 */
export function curlingHit(v: number, kind: HitKind, loss: number = LOSS.initial, m: number = STONE_MASS): CurlingHit {
  const a = kind === 'elastisk' ? 0 : kind === 'fullstendig' ? 0.5 : speedShareForLoss(loss);
  const v1 = a * v;
  const v2 = (1 - a) * v;
  const ek = (u: number) => 0.5 * m * u * u;
  const Ek = ek(v);
  const Ek1 = ek(v1);
  const Ek2 = ek(v2);
  const EkAfter = Ek1 + Ek2;
  const lost = Ek - EkAfter;
  return {
    m,
    v,
    kind,
    a,
    v1,
    v2,
    p: m * v,
    p1: m * v1,
    p2: m * v2,
    pAfter: m * v1 + m * v2,
    Ek,
    Ek1,
    Ek2,
    EkAfter,
    lost,
    lossShare: Ek > 0 ? lost / Ek : 0,
  };
}

/**
 * Hva om den røde steinen spratt tilbake med farten `back` (m/s)? Da må den gule få v + back for at Σp skal være
 * bevart, og den kinetiske energien etter blir større enn før. Brukes til å vise at det er umulig.
 */
export function bounceBack(v: number, back: number, m: number = STONE_MASS): { v1: number; v2: number; EkAfter: number; Ek: number } {
  const v1 = -Math.abs(back);
  const v2 = v - v1;
  return { v1, v2, EkAfter: 0.5 * m * (v1 * v1 + v2 * v2), Ek: 0.5 * m * v * v };
}

/** Friksjonskraften fra isen R = μmg (N). */
export function iceFriction(m: number = STONE_MASS, mu: number = MU_ICE): number {
  return mu * m * G_EARTH;
}

/** Impulsen fra friksjonen mens støtet varer, R · Δt (N·s). Den er bitteliten mot bevegelsesmengden. */
export function frictionImpulse(m: number = STONE_MASS, mu: number = MU_ICE, dt: number = CONTACT_TIME): number {
  return iceFriction(m, mu) * dt;
}

/* ---------- Bevegelsen i animasjonen ---------- */

export interface CurlingTimeline {
  /** Avstanden mellom steinene (m) når animasjonen starter, og hvor langt en stein med farten v kommer etter støtet. */
  approach: number;
  after: number;
  /** Tidspunktet for støtet og slutten av animasjonen (s). */
  tHit: number;
  tEnd: number;
}

/**
 * Tidslinja for animasjonen: den røde starter `approach` meter fra den gule og treffer etter approach/v sekunder.
 * Etterpå varer animasjonen til en stein med farten v (den raskeste mulige) har glidd `after` meter, så begge
 * steinene alltid er i bildet. Vi ser bort fra friksjonen fra isen mens steinene glir.
 */
export function curlingTimeline(v: number, approach: number, after: number): CurlingTimeline {
  const vv = Math.max(1e-6, v);
  return { approach, after, tHit: approach / vv, tEnd: (approach + after) / vv };
}

export interface StonesAt {
  /** Posisjonen til midten av steinene (m). Den gule ligger i 0 før støtet (midt i huset). */
  x1: number;
  x2: number;
  /** Farten (m/s) akkurat nå. */
  u1: number;
  u2: number;
  /** Om støtet har skjedd. */
  after: boolean;
}

/** Hvor steinene er, og hvor fort de går, ved tiden t (avgrenset til animasjonen). */
export function stonesAt(hit: CurlingHit, tl: CurlingTimeline, t: number, d: number = STONE_DIAMETER): StonesAt {
  const tt = clamp(Number.isFinite(t) ? t : 0, 0, tl.tEnd);
  if (tt < tl.tHit) return { x1: -d - tl.approach + hit.v * tt, x2: 0, u1: hit.v, u2: 0, after: false };
  const tau = tt - tl.tHit;
  return { x1: -d + hit.v1 * tau, x2: hit.v2 * tau, u1: hit.v1, u2: hit.v2, after: true };
}

/** Tidene vi kan velge mellom for stroboskopbildet (s). */
export const STROBE_STEPS = [0.02, 0.04, 0.05, 0.1, 0.2, 0.25, 0.4, 0.5] as const;

/** Tid mellom bildene i stroboskopbildet: det fine tallet som gir omtrent `spacing` meter mellom bildene ved farten v. */
export function strobeInterval(v: number, spacing: number): number {
  const target = spacing / Math.max(1e-6, v);
  let best: number = STROBE_STEPS[0];
  for (const s of STROBE_STEPS) if (Math.abs(Math.log(s / target)) < Math.abs(Math.log(best / target))) best = s;
  return best;
}

/**
 * Tidspunktene for bildene i stroboskopbildet fram til tiden `tNow`: tHit + k · dt for hele tall k, så ett av bildene
 * tas akkurat i støtet.
 */
export function strobeTimes(tl: CurlingTimeline, dt: number, tNow: number): number[] {
  if (!(dt > 0)) return [];
  const end = Math.min(tNow, tl.tEnd) + 1e-9;
  const out: number[] = [];
  for (let k = -Math.floor(tl.tHit / dt + 1e-9); tl.tHit + k * dt <= end; k++) out.push(Math.max(0, tl.tHit + k * dt));
  return out;
}
