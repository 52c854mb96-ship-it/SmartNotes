/**
 * Friksjon og føre (2C, 2E): en bil bremser fullt på tørr asfalt, våt asfalt, snø eller is. Ren fysikk uten React,
 * så den kan testes for seg.
 *
 * Modell: bilen kjører på flat vei og bremser med alle fire hjulene. Vi ser bort fra luftmotstand, rullemotstand og
 * reaksjonstid (den kommer i tillegg, se kapittel 1).
 * - Loddrett: ingen akselerasjon, så N = G = mg.
 * - Vannrett: den eneste kraften er friksjonen R fra veien på dekkene, mot fartsretningen. Kraftsummen er ΣF = R.
 * - Med ABS ruller hjulene hele tiden. Der dekket er i kontakt med veien, står det et øyeblikk stille mot veien, så
 *   friksjonen er statisk. ABS letter på bremsen akkurat før hjulet låser seg, så friksjonen holder seg nær den
 *   største statiske friksjonen: R = μs · N (vi regner med akkurat μs · N).
 * - Med låste hjul sklir dekkene på veien, så friksjonen er glidefriksjon: R = μk · N, og μk < μs.
 * Newtons 2. lov gir a = R/m = μmg/m = μg: massen forkortes bort. Konstant akselerasjon gir bremsetiden t = v₀/a og
 * bremselengden s = v₀²/(2a) = v₀²/(2μg) (tidløs likning med v = 0).
 * Når bilen står stille, er friksjonen null: på flat vei prøver ingen kraft å flytte bilen langs veien.
 * Bil i kø: står det en bil stille d meter foran, stopper bilen før hvis s ≤ d. Ellers treffer den med farten
 * v = √(v₀² − 2ad) (tidløs likning), og den største farten som rekker å stoppe, er v₀ = √(2μgd).
 */
import { G_EARTH } from '../../kit/format';

/* ---------- Føre, dekk og bremser ---------- */

export type Fore = 'torr' | 'vaat' | 'sno' | 'is';
export type Dekk = 'sommer' | 'vinter';
export type Bremser = 'abs' | 'laast';

/** Førene i rekkefølge fra best til dårligst grep. */
export const FORE: readonly Fore[] = ['torr', 'vaat', 'sno', 'is'];
export const DEKK: readonly Dekk[] = ['sommer', 'vinter'];
export const BREMSER: readonly Bremser[] = ['abs', 'laast'];

export const FORE_NAVN: Record<Fore, string> = { torr: 'Tørr asfalt', vaat: 'Våt asfalt', sno: 'Snø', is: 'Is' };
/** Til løpende tekst: «på tørr asfalt», «på snø». */
export const FORE_TEKST: Record<Fore, string> = { torr: 'tørr asfalt', vaat: 'våt asfalt', sno: 'snø', is: 'is' };
export const DEKK_NAVN: Record<Dekk, string> = { sommer: 'Sommerdekk', vinter: 'Vinterdekk' };
export const BREMSER_NAVN: Record<Bremser, string> = { abs: 'ABS', laast: 'Låste hjul' };

/** Veien i scene-kit-et (Vei `type`) for hvert føre. */
export const FORE_VEI: Record<Fore, 'asfalt' | 'vaat-asfalt' | 'sno' | 'is'> = { torr: 'asfalt', vaat: 'vaat-asfalt', sno: 'sno', is: 'is' };

export interface Friksjonstall {
  /** Største statiske friksjonstall (hjulet ruller, ABS). */
  muS: number;
  /** Glidefriksjonstall (låste hjul som sklir). */
  muK: number;
}

/**
 * Typiske friksjonstall mellom bildekk og vei. Verdiene varierer mye med temperatur, slitasje på dekkene og typen
 * snø og is (våt is rundt 0 °C kan gi μ under 0,05 også med vinterdekk), så dette er omtrentlige verdier. Med riktige
 * dekk for årstiden og ABS gir de omtrent de samme bremseakselerasjonene som i kapittel 1 (8, 5, 2,5 og 1 m/s²).
 * Vinterdekk (piggfrie) griper omtrent dobbelt så godt som sommerdekk på snø og is, men litt dårligere på bar asfalt.
 * Låste hjul gir ca. 75–80 % av den største statiske friksjonen.
 */
export const FRIKSJONSTALL: Record<Fore, Record<Dekk, Friksjonstall>> = {
  torr: { sommer: { muS: 0.8, muK: 0.65 }, vinter: { muS: 0.75, muK: 0.6 } },
  vaat: { sommer: { muS: 0.5, muK: 0.4 }, vinter: { muS: 0.45, muK: 0.35 } },
  sno: { sommer: { muS: 0.12, muK: 0.08 }, vinter: { muS: 0.25, muK: 0.18 } },
  is: { sommer: { muS: 0.05, muK: 0.04 }, vinter: { muS: 0.1, muK: 0.07 } },
};

/** Friksjonstallet som gjelder: μs med ABS (hjulene ruller), μk med låste hjul (dekkene sklir). */
export function frictionCoefficient(fore: Fore, dekk: Dekk, bremser: Bremser): number {
  const f = FRIKSJONSTALL[fore][dekk];
  return bremser === 'abs' ? f.muS : f.muK;
}

/**
 * Glidebryterne: farten i km/h, massen til bilen med fører i kg og avstanden (m) fra der bremsingen starter til en
 * bil som står stille i kø. Med standardverdiene (80 km/h, snø, vinterdekk og ABS) stopper bilen så vidt før køen.
 */
export const BRAKE_RANGES = {
  v: { min: 30, max: 110, step: 5, start: 80 },
  m: { min: 1000, max: 2000, step: 50, start: 1400 },
  d: { min: 20, max: 200, step: 1, start: 103 },
} as const;

export const kmhToMs = (v: number): number => v / 3.6;
export const msToKmh = (v: number): number => v * 3.6;

/* ---------- Oppbremsingen ---------- */

export interface BrakeResult {
  /** Tyngden G = mg (N). */
  G: number;
  /** Normalkraften N = G (N) på flat vei. */
  N: number;
  /** Friksjonen fra veien R = μN (N), som er hele kraftsummen mens bilen bremser. */
  R: number;
  /** Bremseakselerasjonen (størrelse, m/s²): a = R/m = μg. */
  a: number;
  /** Bremselengden s = v₀²/(2a) (m). Uendelig når μ = 0. */
  s: number;
  /** Bremsetiden t = v₀/a (s). Uendelig når μ = 0. */
  t: number;
}

/** Full oppbremsing fra farten v0 (m/s) med friksjonstallet mu for en bil med massen m (kg). */
export function brake(v0: number, mu: number, m: number): BrakeResult {
  const v = Math.max(0, finite(v0));
  const muEff = Math.max(0, finite(mu));
  const mass = Math.max(0, finite(m));
  const G = mass * G_EARTH;
  const N = G;
  const R = muEff * N;
  const a = muEff * G_EARTH;
  if (v === 0) return { G, N, R, a, s: 0, t: 0 };
  if (!(a > 0)) return { G, N, R, a: 0, s: Infinity, t: Infinity };
  return { G, N, R, a, s: (v * v) / (2 * a), t: v / a };
}

/** Bremselengden s = v₀²/(2μg) (m) for farten v0 (m/s). */
export function brakingDistance(v0: number, mu: number): number {
  return brake(v0, mu, 1).s;
}

export interface BrakeState {
  /** Tiden siden bremsingen startet (s), høyst bremsetiden. */
  t: number;
  /** Farten (m/s). */
  v: number;
  /** Strekningen bilen har bremset (m). */
  s: number;
  /** Akselerasjonen (størrelse, m/s²) akkurat nå: μg mens bilen bremser, 0 når den står stille. */
  a: number;
  /** Friksjonen fra veien (N) akkurat nå: μN mens bilen bremser, 0 når den står stille. */
  R: number;
  stopped: boolean;
}

/**
 * Tilstanden t sekunder etter at bilen begynte å bremse: v = v₀ − at og s = v₀t − ½at², til bilen står stille.
 * Etter det er v = 0, s = bremselengden, og både friksjonen og akselerasjonen er null.
 */
export function brakeState(v0: number, mu: number, m: number, t: number): BrakeState {
  const r = brake(v0, mu, m);
  const v = Math.max(0, finite(v0));
  const tt = Math.max(0, finite(t));
  if (v === 0 || tt >= r.t) {
    return { t: Number.isFinite(r.t) ? r.t : tt, v: 0, s: v === 0 ? 0 : r.s, a: 0, R: 0, stopped: true };
  }
  const vNow = Math.max(0, v - r.a * tt);
  const s = v * tt - 0.5 * r.a * tt * tt;
  return { t: tt, v: vNow, s, a: r.a, R: r.R, stopped: false };
}

/**
 * Farten (samme enhet som v0) som gir like lang bremselengde med friksjonstallet muTo som farten v0 gir med muFrom:
 * v²/(2·muTo·g) = v₀²/(2·muFrom·g) gir v = v₀ · √(muTo/muFrom). Eksempel: 80 km/h på tørr asfalt (0,80) tilsvarer
 * 80 · √(0,10/0,80) ≈ 28 km/h på is (0,10).
 */
export function sameDistanceSpeed(v0: number, muFrom: number, muTo: number): number {
  if (!(muFrom > 0) || !(muTo >= 0)) return NaN;
  return v0 * Math.sqrt(muTo / muFrom);
}

/** Hvor mange ganger så lang bremselengden blir når farten endres fra v1 til v2: (v2/v1)². */
export function distanceRatio(v1: number, v2: number): number {
  if (!(v1 > 0)) return NaN;
  return (v2 / v1) ** 2;
}

/** Farten (m/s) bilen har igjen når den har bremset strekningen s (m): v = √(v₀² − 2as), 0 etter bremselengden. */
export function speedAfter(v0: number, mu: number, s: number): number {
  const v = Math.max(0, finite(v0));
  const a = Math.max(0, finite(mu)) * G_EARTH;
  return Math.sqrt(Math.max(0, v * v - 2 * a * Math.max(0, finite(s))));
}

/* ---------- Bil i kø foran: rekker bilen å stoppe? ---------- */

export interface QueueOutcome {
  /** Bilen stopper før bilen som står i kø (eller akkurat ved den). */
  stops: boolean;
  /** Avstanden igjen til bilen foran når bilen står stille (m), 0 ved sammenstøt. */
  gap: number;
  /** Farten i sammenstøtet (m/s), 0 når bilen stopper før. */
  vHit: number;
  /** Strekningen bilen bremser før den står stille eller treffer (m). */
  sEnd: number;
  /** Tiden fra bremsingen starter til bilen står stille eller treffer (s). */
  tEnd: number;
}

/**
 * En bil står stille i kø d meter foran der bremsingen starter (fra fronten vår til bakenden dens). Bilen stopper
 * før hvis bremselengden s = v₀²/(2μg) ≤ d. Ellers treffer den med farten fra den tidløse likningen:
 * v² = v₀² − 2ad, og det skjer etter tiden t = (v₀ − v)/a (uten friksjon: t = d/v₀).
 */
export function queueOutcome(v0: number, mu: number, d: number): QueueOutcome {
  const v = Math.max(0, finite(v0));
  const dd = Math.max(0, finite(d));
  const r = brake(v, mu, 1);
  if (r.s <= dd) return { stops: true, gap: dd - r.s, vHit: 0, sEnd: r.s, tEnd: r.t };
  const vHit = speedAfter(v, mu, dd);
  const tEnd = r.a > 0 ? (v - vHit) / r.a : dd / v;
  return { stops: false, gap: 0, vHit, sEnd: dd, tEnd };
}

/** Den største farten (m/s) bilen kan ha og likevel stoppe på strekningen d (m): v₀ = √(2μgd). */
export function maxStopSpeed(mu: number, d: number): number {
  return Math.sqrt(2 * Math.max(0, finite(mu)) * G_EARTH * Math.max(0, finite(d)));
}

export interface QueueState extends BrakeState {
  /** Bilen har truffet bilen foran (og står med fronten mot den). */
  crashed: boolean;
}

/**
 * Som brakeState, men med en bil i kø d meter foran (`d` = null: fri vei). Treffer bilen, stopper vi bevegelsen ved
 * sammenstøtet: s = d, og etter det regner vi ikke videre (det som skjer i selve sammenstøtet, er ikke med).
 */
export function queueState(v0: number, mu: number, m: number, t: number, d: number | null): QueueState {
  if (d !== null) {
    const out = queueOutcome(v0, mu, d);
    if (!out.stops && finite(t) >= out.tEnd) return { t: out.tEnd, v: 0, s: out.sEnd, a: 0, R: 0, stopped: true, crashed: true };
  }
  return { ...brakeState(v0, mu, m, t), crashed: false };
}

/**
 * Avspillingen tar høyst `target` sekunder: lange oppbremsinger (på is kan det ta et minutt) spilles av raskere.
 * Gir faktoren til useSimClock (`speed`), minst 1 (sanntid).
 */
export function playbackSpeed(tStop: number, target = 10): number {
  if (!(tStop > 0) || !Number.isFinite(tStop) || !(target > 0)) return 1;
  return Math.max(1, tStop / target);
}

/** Alle bremselengdene (m) ved farten v0 (m/s): føre → dekk → bremser. */
export function allDistances(v0: number): Record<Fore, Record<Dekk, Record<Bremser, number>>> {
  const out = {} as Record<Fore, Record<Dekk, Record<Bremser, number>>>;
  for (const f of FORE) {
    out[f] = {} as Record<Dekk, Record<Bremser, number>>;
    for (const d of DEKK) {
      out[f][d] = { abs: brakingDistance(v0, frictionCoefficient(f, d, 'abs')), laast: brakingDistance(v0, frictionCoefficient(f, d, 'laast')) };
    }
  }
  return out;
}

function finite(v: number): number {
  return Number.isFinite(v) ? v : 0;
}
