/**
 * Partikler som krysser en membran (diffusjon, fasilitert diffusjon, aktiv transport): ren logikk uten React.
 *
 * Hver partikkel krysser membranen tilfeldig og uavhengig av de andre, med en fast sannsynlighet per tid i hver
 * retning (rate A → B og B → A). Ved diffusjon er ratene like: partiklene «vil» ingenting, men fordi flere partikler
 * står på siden med høy konsentrasjon, krysser flere den veien, og nettotransporten går ned gradienten. Ved aktiv
 * transport er bare den ene retningen åpen (pumpa), uansett konsentrasjon.
 *
 * Alle tider trekkes på forhånd med fast frø (`planCrossings`), så posisjonen ved tiden t er en ren funksjon av t:
 * samme bilde hver gang, også når du drar i tidsglidebryteren baklengs.
 *
 *   const tracks = planCrossings({ n: [30, 5], rates: [0.08, 0.08], tMax: 60, seed: 3 });
 *   const [venstre, hoyre] = countSides(tracks, t);
 *   const p = trackPosition(tracks[0]!, t, geometry);
 */
import { seededRandom, type Box } from '../../kjemi/kit/random';

/** Side 0 = A (venstre eller utenfor), side 1 = B (høyre eller inne i cellen). */
export type Side = 0 | 1;

export interface CrossingSpec {
  /** Antall partikler som starter på side A og på side B. */
  n: readonly [number, number];
  /** Sannsynlighet per tidsenhet for at én partikkel krysser: [A → B, B → A]. Like rater = passiv transport. */
  rates: readonly [number, number];
  /** Hvor langt fram i tid kryssingene planlegges. */
  tMax: number;
  seed?: number;
  /**
   * Antall porter (kanalproteiner, bæreproteiner, pumper) partiklene må gå gjennom. 0 (standard) betyr rett gjennom
   * lipidlaget hvor som helst langs membranen (små, upolare molekyler som O₂ og CO₂).
   */
  gates?: number;
  /** Hvor lang tid selve passasjen gjennom membranen tar (standard 0,5). Ingen ny kryssing før den er ferdig. */
  transit?: number;
}

export interface Crossing {
  /** Midt i passasjen; partikkelen regnes som over på den nye siden fra og med dette tidspunktet. */
  t: number;
  /** Siden partikkelen går til. */
  to: Side;
  /** Porten den går gjennom (indeks), eller plassering langs membranen (0–1) når det ikke er porter. */
  gate: number;
}

export interface Track {
  /** Partikkelens nummer (stabil React-nøkkel). */
  id: number;
  start: Side;
  crossings: Crossing[];
  /** Frø for tilfeldige mellomstopp på hver side. */
  seed: number;
  transit: number;
  gates: number;
}

/** Enkel heltallshash av flere tall (for frø som avhenger av partikkel og opphold). */
export function hash32(...nums: number[]): number {
  let h = 0x811c9dc5;
  for (const n of nums) {
    h ^= Math.floor(n) >>> 0;
    h = Math.imul(h, 0x01000193) >>> 0;
    h ^= h >>> 13;
  }
  return h >>> 0;
}

/** Plan for alle partiklene: når hver av dem krysser membranen, hvilken vei og gjennom hvilken port. */
export function planCrossings(spec: CrossingSpec): Track[] {
  const seed = spec.seed ?? 1;
  const transit = Math.max(0, spec.transit ?? 0.5);
  const gates = Math.max(0, Math.floor(spec.gates ?? 0));
  const tracks: Track[] = [];
  let id = 0;
  ([0, 1] as const).forEach((side) => {
    const count = Math.max(0, Math.floor(spec.n[side]));
    for (let i = 0; i < count; i++) {
      const rnd = seededRandom(hash32(seed, id, 7));
      const crossings: Crossing[] = [];
      let s: Side = side;
      // Første kryssing kan skje helt fra start, men passasjen må få plass etter t = 0.
      let t = transit / 2;
      for (let guard = 0; guard < 10_000; guard++) {
        const rate = spec.rates[s];
        if (!(rate > 0)) break;
        // Eksponentielt fordelt ventetid, minst én passasjetid etter forrige kryssing
        const wait = -Math.log(1 - rnd()) / rate;
        t = crossings.length === 0 ? Math.max(t, wait) : t + Math.max(transit, wait);
        if (t > spec.tMax) break;
        const to: Side = s === 0 ? 1 : 0;
        crossings.push({ t, to, gate: gates > 0 ? Math.floor(rnd() * gates) : 0.06 + 0.88 * rnd() });
        s = to;
      }
      tracks.push({ id, start: side, crossings, seed: hash32(seed, id, 13), transit, gates });
      id++;
    }
  });
  return tracks;
}

/** Siden partikkelen er på ved tiden t (byttes midt i passasjen). */
export function sideAt(track: Track, t: number): Side {
  let s = track.start;
  for (const c of track.crossings) {
    if (c.t > t) break;
    s = c.to;
  }
  return s;
}

/** Antall partikler på side A og side B ved tiden t. */
export function countSides(tracks: readonly Track[], t: number): [number, number] {
  let a = 0;
  for (const tr of tracks) if (sideAt(tr, t) === 0) a++;
  return [a, tracks.length - a];
}

/** Hvor mange kryssinger som har skjedd fram til t: [A → B, B → A]. */
export function crossingCounts(tracks: readonly Track[], t: number): [number, number] {
  let ab = 0;
  let ba = 0;
  for (const tr of tracks)
    for (const c of tr.crossings) {
      if (c.t > t) break;
      if (c.to === 1) ab++;
      else ba++;
    }
  return [ab, ba];
}

/**
 * Forventet antall på side A ved tiden t (gjennomsnittet over mange forsøk): hver partikkel er en tilstand som bytter
 * side med ratene α (A → B) og β (B → A). N_A(t) = N·π + (N_A(0) − N·π) · e^(−(α+β)t), der π = β/(α+β).
 */
export function expectedSideA(spec: Pick<CrossingSpec, 'n' | 'rates'>, t: number): number {
  const [nA, nB] = spec.n;
  const [alpha, beta] = spec.rates;
  const N = nA + nB;
  const k = alpha + beta;
  if (!(k > 0)) return nA;
  const pi = beta / k;
  return N * pi + (nA - N * pi) * Math.exp(-k * t);
}

/* ---------- Posisjoner ---------- */

export interface CrossingGeometry {
  /** Rommet på side A og side B (partiklene holder seg inne i dem). */
  a: Box;
  b: Box;
  /** 'vertical': loddrett membran, A til venstre og B til høyre. 'horizontal': vannrett membran, A over og B under. */
  orientation: 'vertical' | 'horizontal';
  /** Membranens midtlinje: x for loddrett membran, y for vannrett. */
  at: number;
  /** Membranens tykkelse. */
  thickness: number;
  /** Portenes plassering langs membranen (y for loddrett, x for vannrett), én per port i planen. */
  gates?: readonly number[];
  /** Partikkelradius. */
  r: number;
  /** Hvor fort partiklene vandrer mellom kryssingene (figurenheter per tidsenhet, standard 60). */
  speed?: number;
  /** Hvor mye partiklene dirrer (standard r · 0,6). */
  jitter?: number;
}

export interface TrackPoint {
  x: number;
  y: number;
  /** Partikkelen er inne i membranen akkurat nå. */
  inMembrane: boolean;
  side: Side;
}

/** Rommets utstrekning: «dybde» bort fra membranen og plass langs membranen. */
function frame(g: CrossingGeometry, side: Side) {
  const box = side === 0 ? g.a : g.b;
  const vertical = g.orientation === 'vertical';
  const lo = vertical ? box.y : box.x;
  const hi = vertical ? box.y + box.h : box.x + box.w;
  const near = side === 0 ? (vertical ? box.x + box.w : box.y + box.h) : vertical ? box.x : box.y;
  const far = side === 0 ? (vertical ? box.x : box.y) : vertical ? box.x + box.w : box.y + box.h;
  return { lo: lo + g.r, hi: hi - g.r, near, far, sign: side === 0 ? -1 : 1 };
}

/** Punkt i rommet på en side: d = 0 ved membranen, 1 ved bakveggen; u = 0–1 langs membranen. */
function roomPoint(g: CrossingGeometry, side: Side, d: number, u: number): { x: number; y: number } {
  const f = frame(g, side);
  const depthMin = f.near + f.sign * g.r;
  const depthMax = f.far - f.sign * g.r;
  const across = depthMin + (depthMax - depthMin) * Math.min(1, Math.max(0, d));
  const along = f.lo + (f.hi - f.lo) * Math.min(1, Math.max(0, u));
  return g.orientation === 'vertical' ? { x: across, y: along } : { x: along, y: across };
}

/** Plassering langs membranen (figurenheter) for en kryssing. */
function gateAlong(g: CrossingGeometry, track: Track, c: Crossing, side: Side): number {
  const f = frame(g, side);
  if (track.gates > 0) {
    const p = g.gates?.[c.gate];
    // Mangler porten i geometrien, fordeles portene jevnt langs membranen
    return p ?? f.lo + ((f.hi - f.lo) * (c.gate + 0.5)) / track.gates;
  }
  return f.lo + (f.hi - f.lo) * c.gate;
}

/** Punktet rett ved membranåpningen på en side. */
function gatePoint(g: CrossingGeometry, side: Side, along: number): { x: number; y: number } {
  const off = g.thickness / 2 + g.r + 2;
  const across = g.at + (side === 0 ? -off : off);
  return g.orientation === 'vertical' ? { x: across, y: along } : { x: along, y: across };
}

const smooth = (u: number) => u * u * (3 - 2 * u);

/**
 * Hvor partikkelen er ved tiden t. Mellom kryssingene vandrer den rolig rundt på sin side (via to tilfeldige
 * mellomstopp), og under en kryssing går den rett gjennom membranen ved porten.
 */
export function trackPosition(track: Track, t: number, g: CrossingGeometry): TrackPoint {
  const half = track.transit / 2;
  const cs = track.crossings;
  // Finn oppholdet eller passasjen t ligger i
  let side: Side = track.start;
  let stayStart = 0;
  let k = 0;
  for (; k < cs.length; k++) {
    const c = cs[k]!;
    if (t < c.t - half) break;
    if (t <= c.t + half) {
      // Midt i en passasje gjennom membranen
      const from: Side = c.to === 1 ? 0 : 1;
      const along = gateAlong(g, track, c, from);
      const p0 = gatePoint(g, from, along);
      const p1 = gatePoint(g, c.to, along);
      const u = track.transit > 0 ? smooth((t - (c.t - half)) / track.transit) : 1;
      return { x: p0.x + (p1.x - p0.x) * u, y: p0.y + (p1.y - p0.y) * u, inMembrane: true, side: u < 0.5 ? from : c.to };
    }
    side = c.to;
    stayStart = c.t + half;
  }
  const next = cs[k];
  const prev = k > 0 ? cs[k - 1] : undefined;
  const stayEnd = next ? next.t - half : Number.POSITIVE_INFINITY;
  const rnd = seededRandom(hash32(track.seed, k));
  const f = frame(g, side);
  const depthRange = Math.abs(f.far - f.near) - 2 * g.r;
  const speed = g.speed ?? 60;
  // Hvor langt inn i rommet partikkelen rekker å vandre (korte opphold holder seg nær membranen)
  const reach = (dur: number) => (depthRange > 0 ? Math.min(1, (speed * dur) / 2 / depthRange) : 0);
  const dur = Number.isFinite(stayEnd) ? stayEnd - stayStart : Number.POSITIVE_INFINITY;
  const dMax = Number.isFinite(dur) ? reach(dur) : 1;
  const alongToU = (along: number) => (f.hi > f.lo ? (along - f.lo) / (f.hi - f.lo) : 0.5);
  const w1 = { d: rnd() * dMax, u: rnd() };
  const w2 = { d: rnd() * dMax, u: rnd() };
  // Uten forrige kryssing starter partikkelen et sted i rommet; skal den snart krysse, starter den nær membranen.
  const startPt = prev ? gatePoint(g, side, gateAlong(g, track, prev, side)) : roomPoint(g, side, rnd() * dMax, rnd());
  const endPt = next ? gatePoint(g, side, gateAlong(g, track, next, side)) : roomPoint(g, side, rnd(), rnd());
  // Mellomstoppene ligger nær den linja partikkelen går langs
  const uStart = prev ? alongToU(gateAlong(g, track, prev, side)) : w1.u;
  const uEnd = next ? alongToU(gateAlong(g, track, next, side)) : w2.u;
  const mid1 = roomPoint(g, side, w1.d, uStart + (w1.u - 0.5) * dMax * 0.8);
  const mid2 = roomPoint(g, side, w2.d, uEnd + (w2.u - 0.5) * dMax * 0.8);
  const pts = [startPt, mid1, mid2, endPt];
  // Siste opphold uten ende: vandre fram og tilbake i et fast tempo
  let u: number;
  if (Number.isFinite(dur)) u = dur > 0 ? Math.min(1, Math.max(0, (t - stayStart) / dur)) : 1;
  else {
    const period = 12 + 6 * rnd();
    const ph = ((t - stayStart) / period) % 2;
    u = Math.min(1, Math.max(0, ph < 1 ? ph : 2 - ph));
  }
  const seg = Math.min(2, Math.floor(u * 3));
  const a = pts[seg]!;
  const b = pts[seg + 1]!;
  const s = smooth(u * 3 - seg);
  const jitter = g.jitter ?? g.r * 0.6;
  const ph = (track.seed % 628) / 100;
  let x = a.x + (b.x - a.x) * s + jitter * Math.sin(2.3 * t + ph);
  let y = a.y + (b.y - a.y) * s + jitter * Math.cos(1.9 * t + ph * 1.3);
  // Hold partikkelen inne i rommet (dirringen kan ellers dytte den inn i membranen)
  const box = side === 0 ? g.a : g.b;
  x = Math.min(box.x + box.w - g.r, Math.max(box.x + g.r, x));
  y = Math.min(box.y + box.h - g.r, Math.max(box.y + g.r, y));
  return { x, y, inMembrane: false, side };
}
