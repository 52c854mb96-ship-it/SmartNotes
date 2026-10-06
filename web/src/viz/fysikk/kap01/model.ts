/** Ren fysikk for kapittel 1 (ingen React), så den kan testes for seg. */
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

/** Utvider [lo, hi] til pene grenser og gir steget som ble brukt. Spennet blir minst `minSpan`. */
function niceBounds(lo: number, hi: number, count: number, minSpan: number): [number, number, number] {
  let a = Math.min(lo, hi);
  let b = Math.max(lo, hi);
  if (b - a < minSpan) {
    const mid = (a + b) / 2;
    a = mid - minSpan / 2;
    b = mid + minSpan / 2;
    // Hold null som grense når alle verdiene ligger på samme side av null
    if (Math.min(lo, hi) >= 0 && Math.max(lo, hi) > 0 && a < 0) {
      b -= a;
      a = 0;
    } else if (Math.max(lo, hi) <= 0 && Math.min(lo, hi) < 0 && b > 0) {
      a -= b;
      b = 0;
    }
  }
  const step = niceStep(b - a, count);
  return [Math.floor(a / step + 1e-9) * step + 0, Math.ceil(b / step - 1e-9) * step + 0, step];
}

/** Utvider [lo, hi] til nærmeste pene akseverdier. Spennet blir minst `minSpan`. */
export function niceRange(lo: number, hi: number, count = 5, minSpan = 1): [number, number] {
  const [a, b] = niceBounds(lo, hi, count, minSpan);
  return [a, b];
}

/**
 * Som niceRange, men gir også akseverdiene: alle multipler av det samme steget fra min til max (minst tre).
 * (Å regne ut et nytt steg for akseverdiene etterpå kan gi bare én eller to verdier, f.eks. bare 0 på [−40, 40].)
 */
export function niceAxis(lo: number, hi: number, count = 5, minSpan = 1): { min: number; max: number; ticks: number[] } {
  const [min, max, step] = niceBounds(lo, hi, count, minSpan);
  const ticks: number[] = [];
  for (let i = Math.round(min / step); i <= Math.round(max / step); i++) ticks.push(Number((i * step).toPrecision(12)) + 0);
  return { min, max, ticks };
}

/* ---------- 1C Bevegelsesgrafer (konstant akselerasjon) ---------- */

export interface Motion {
  /** Startposisjon s₀ (m). */
  s0: number;
  /** Startfart v₀ (m/s), kan være negativ. */
  v0: number;
  /** Konstant akselerasjon a (m/s²). */
  a: number;
}

/** s = s₀ + v₀t + ½at² */
export function position({ s0, v0, a }: Motion, t: number): number {
  return s0 + v0 * t + 0.5 * a * t * t;
}

/** v = v₀ + at */
export function velocity({ v0, a }: Motion, t: number): number {
  return v0 + a * t;
}

/** Tidspunktet der farten er null og vogna snur (bare når t > 0), ellers null. */
export function turnTime({ v0, a }: Motion): number | null {
  if (a === 0 || v0 === 0) return null;
  const t = -v0 / a;
  return t > 0 ? t : null;
}

/** Forflytningen fra 0 til t, Δs = v₀t + ½at² = arealet under v-t-grafen (med fortegn). */
export function displacement(m: Motion, t: number): number {
  return position(m, t) - m.s0;
}

/** Strekningen vogna faktisk har kjørt fra 0 til t (veilengde), uansett retning. */
export function pathLength(m: Motion, t: number): number {
  const tt = turnTime(m);
  if (tt !== null && tt < t) return Math.abs(displacement(m, tt)) + Math.abs(position(m, t) - position(m, tt));
  return Math.abs(displacement(m, t));
}

/** Største og minste posisjon i tidsrommet [0, T]. */
export function positionExtent(m: Motion, T: number): [number, number] {
  const vals = [position(m, 0), position(m, T)];
  const tt = turnTime(m);
  if (tt !== null && tt < T) vals.push(position(m, tt));
  return [Math.min(...vals), Math.max(...vals)];
}

export type SpeedTrend = 'ro' | 'konstant' | 'starter' | 'snur' | 'øker' | 'avtar';

/**
 * Om banefarten (størrelsen av v) øker eller avtar: øker når v og a har samme fortegn, avtar når de har motsatt.
 * Med v = 0 og a ≠ 0 starter vogna fra ro (v₀ = 0) eller snur (v skifter fortegn).
 * `eps` er grensen for når vi sier at v er null.
 */
export function speedTrend({ v0, a }: Motion, t: number, eps = 0.05): SpeedTrend {
  const v = v0 + a * t;
  if (a === 0) return Math.abs(v) < eps ? 'ro' : 'konstant';
  if (Math.abs(v) < eps) return Math.abs(v0) < eps ? 'starter' : 'snur';
  return Math.sign(v) === Math.sign(a) ? 'øker' : 'avtar';
}

/* ---------- 1C Scenen til bevegelsesgrafene: bil på en vei med målebånd ---------- */

/**
 * Retningen fronten på bilen peker (+1 = positiv retning): fartsretningen i starten, eller retningen til
 * akselerasjonen når bilen starter fra ro. En bil snur ikke på en rett vei, så etter et vendepunkt rygger den.
 */
export function facingDirection({ v0, a }: Motion): 1 | -1 {
  if (v0 !== 0) return v0 > 0 ? 1 : -1;
  if (a !== 0) return a > 0 ? 1 : -1;
  return 1;
}

/** Om bilen rygger ved tiden t: farten peker motsatt vei av fronten (og er større enn `eps`). */
export function isReversing(m: Motion, t: number, eps = 0.05): boolean {
  return velocity(m, t) * facingDirection(m) < -eps;
}

/** Posisjonen hvert hele sekund fra 0 til og med t (merkene på veien og punktene i s-t-grafen). */
export function secondMarks(m: Motion, t: number): { t: number; s: number }[] {
  const out: { t: number; s: number }[] = [];
  if (!(t >= 0)) return out;
  for (let n = 0; n <= Math.floor(t + 1e-9); n++) out.push({ t: n, s: position(m, n) });
  return out;
}

export interface SceneCamera {
  /** Skala i scenen (figurens enheter per meter), lik for veien, bilen og målebåndet. */
  pxPerM: number;
  /** Posisjonen (m) midt i bildet. */
  center: number;
  /** Om kameraet følger bilen (strekningen får ikke plass med minste skala). */
  follows: boolean;
}

/**
 * Kameraet i scenen. Bilens midtpunkt skal kunne stå `inner` figurenheter bredt rundt midten av bildet.
 * Hele strekningen [min, max] vises når den får plass med minst `pMin` per meter (skalaen blir da høyst `pMax`,
 * så en kort strekning ikke gir en kjempestor bil). Ellers brukes `pMin`, og kameraet følger bilen (s), men
 * stopper ved endene av strekningen, så bilen aldri kommer nærmere kanten enn ved full visning.
 */
export function sceneCamera(min: number, max: number, s: number, inner: number, pMin: number, pMax: number): SceneCamera {
  const span = Math.max(1e-9, max - min);
  const pxPerM = Math.min(pMax, Math.max(pMin, inner / span));
  const half = inner / 2 / pxPerM;
  if (span <= 2 * half + 1e-9) return { pxPerM, center: (min + max) / 2, follows: false };
  return { pxPerM, center: Math.min(max - half, Math.max(min + half, s)), follows: true };
}

export interface MarkGroup {
  /** Midten av gruppen (figurens enheter), der etiketten står. */
  x: number;
  /** Tidspunktene i gruppen, stigende. */
  times: number[];
}

export interface MarkLabel extends MarkGroup {
  /** Raden etiketten står i: 0 rett under veien, 1 under den igjen. */
  row: 0 | 1;
}

/**
 * Etikettene til sekundmerkene på veien, i høyst to rader. Merker som ligger nærmere hverandre enn `same`
 * figurenheter, er på samme sted (rundt et vendepunkt, f.eks. 1 s og 5 s) og får én felles etikett. Fra venstre mot
 * høyre legges hver etikett i rad 0 når den ikke overlapper den forrige der (minst `gap` luft), ellers i rad 1, og
 * ellers sløyfes den (merket på veien og punktet i s-t-grafen synes fortsatt). `visible(x, w)` sier om en etikett
 * med midten i x og bredde w er innenfor bildet; de som ikke er det, tar ikke plass.
 */
export function layoutMarkLabels(
  marks: { t: number; x: number }[],
  width: (times: number[]) => number,
  opts: { gap?: number; same?: number; visible?: (x: number, w: number) => boolean } = {},
): MarkLabel[] {
  const gap = opts.gap ?? 4;
  const same = opts.same ?? 6;
  const sorted = marks.filter((m) => Number.isFinite(m.x)).sort((p, q) => p.x - q.x || p.t - q.t);
  const clusters: { lo: number; hi: number; times: number[] }[] = [];
  for (const m of sorted) {
    const last = clusters[clusters.length - 1];
    if (last && m.x - last.hi < same) {
      last.hi = m.x;
      last.times.push(m.t);
    } else clusters.push({ lo: m.x, hi: m.x, times: [m.t] });
  }
  const end: [number, number] = [-Infinity, -Infinity];
  const out: MarkLabel[] = [];
  for (const c of clusters) {
    const times = [...c.times].sort((p, q) => p - q);
    const x = (c.lo + c.hi) / 2;
    const w = width(times);
    if (opts.visible && !opts.visible(x, w)) continue;
    const row = x - w / 2 >= end[0] + gap ? 0 : x - w / 2 >= end[1] + gap ? 1 : null;
    if (row === null) continue;
    end[row] = x + w / 2;
    out.push({ x, times, row });
  }
  return out;
}

/**
 * Etiketten til en gruppe sekundmerker, med enhet på hvert tidspunkt så komma aldri kan leses som desimalkomma:
 * «3 s», «1 s og 5 s», «2 s, 3 s og 4 s». (Merkene ligger på hele sekunder.)
 */
export function markLabel(times: number[]): string {
  const parts = times.map((t) => `${Math.round(t)} s`);
  if (parts.length <= 1) return parts[0] ?? '';
  return `${parts.slice(0, -1).join(', ')} og ${parts[parts.length - 1]}`;
}

/* ---------- 1D Reaksjonslengde og bremselengde ---------- */

export const kmhToMs = (kmh: number): number => kmh / 3.6;

/** Typiske bremseakselerasjoner (størrelse, m/s²). */
export const BRAKE_PRESETS = {
  torr: 8.0,
  vat: 5.0,
  is: 1.0,
} as const;

export interface StopInput {
  /** Fart før oppbremsingen (m/s). */
  v0: number;
  /** Reaksjonstid (s). */
  tr: number;
  /** Størrelsen på bremseakselerasjonen (m/s²), > 0. */
  a: number;
}

export interface StopResult {
  /** Reaksjonslengde s_r = v₀·t_r. */
  sr: number;
  /** Bremselengde s_b = v₀²/(2a). */
  sb: number;
  /** Stopplengde s_r + s_b. */
  total: number;
  /** Bremsetid t_b = v₀/a. */
  tb: number;
  /** Tid fra faren oppdages til bilen står (t_r + t_b). */
  tStop: number;
}

export function stopping({ v0, tr, a }: StopInput): StopResult {
  const sr = v0 * tr;
  const sb = (v0 * v0) / (2 * a);
  const tb = v0 / a;
  return { sr, sb, total: sr + sb, tb, tStop: tr + tb };
}

/** Farten t sekunder etter at sjåføren ser faren. */
export function stopVelocity({ v0, tr, a }: StopInput, t: number): number {
  if (t <= tr) return v0;
  return Math.max(0, v0 - a * (t - tr));
}

/** Strekningen bilen har kjørt t sekunder etter at sjåføren ser faren. */
export function stopPosition(input: StopInput, t: number): number {
  const { v0, tr, a } = input;
  if (t <= tr) return v0 * Math.max(0, t);
  const tb = Math.min(t - tr, v0 / a);
  return v0 * tr + v0 * tb - 0.5 * a * tb * tb;
}

/* ---------- 1D Loddrett kast (positiv retning oppover) ---------- */

export interface Throw {
  /** Startfart (m/s), positiv oppover. */
  v0: number;
  /** Starthøyde over bakken (m), ≥ 0. */
  h0: number;
}

/** Høyden over bakken: s = h₀ + v₀t − ½gt². */
export function throwHeight({ v0, h0 }: Throw, t: number, g = G_EARTH): number {
  return h0 + v0 * t - 0.5 * g * t * t;
}

/** Farten: v = v₀ − gt. */
export function throwVelocity({ v0 }: Throw, t: number, g = G_EARTH): number {
  return v0 - g * t;
}

/** Tiden til ballen treffer bakken (s = 0). Null hvis den ligger på bakken og ikke kastes oppover. */
export function flightTime({ v0, h0 }: Throw, g = G_EARTH): number {
  if (h0 <= 0 && v0 <= 0) return 0;
  return (v0 + Math.sqrt(v0 * v0 + 2 * g * Math.max(0, h0))) / g;
}

/** Tidspunktet for toppunktet (v = 0), eller null hvis ballen kastes nedover eller slippes. */
export function topTime({ v0 }: Throw, g = G_EARTH): number | null {
  return v0 > 0 ? v0 / g : null;
}

/** Største høyde over bakken. */
export function maxHeight({ v0, h0 }: Throw, g = G_EARTH): number {
  return v0 > 0 ? h0 + (v0 * v0) / (2 * g) : h0;
}

/** Farten (størrelse) når ballen treffer bakken: v² = v₀² + 2gh₀. */
export function impactSpeed({ v0, h0 }: Throw, g = G_EARTH): number {
  if (h0 <= 0 && v0 <= 0) return 0;
  return Math.sqrt(v0 * v0 + 2 * g * Math.max(0, h0));
}

/** Hvor i kastet ballen er ved tiden t (til forklaringen og overskriften i figuren). */
export type ThrowPhase = 'ro' | 'start' | 'opp' | 'topp' | 'ned' | 'slutt';

/**
 * Fasen i kastet ved tiden t: «ro» når ballen ikke beveger seg (T = 0), «start» i t = 0, «topp» når |v| < `vEps`
 * rundt toppunktet, «slutt» når ballen er tatt imot (t ≥ T), ellers «opp» eller «ned» etter fortegnet til v.
 */
export function throwPhase(th: Throw, t: number, vEps = 0.25, g = G_EARTH): ThrowPhase {
  const T = flightTime(th, g);
  if (!(T > 0)) return 'ro';
  if (t >= T - 1e-3) return 'slutt';
  const v = throwVelocity(th, t, g);
  if (topTime(th, g) !== null && Math.abs(v) < vEps) return 'topp';
  if (t < 0.005) return 'start';
  return v > 0 ? 'opp' : 'ned';
}

/**
 * Øverste verdi på høydeaksen i loddrett kast: 20 % luft over toppunktet (så ballen ikke kolliderer med
 * overskriften), og minst `minTop` (scenen trenger plass til personene under s = 0). Pene verdier (2, 5, 10 …).
 */
export function throwAxisTop(th: Throw, minTop = 2, g = G_EARTH): number {
  const need = Math.max(maxHeight(th, g) * 1.2, Number.isFinite(minTop) ? minTop : 2, 2);
  return niceRange(0, need, 5, 2)[1];
}

/**
 * Minste høydeakse (m) som gir plass til bakken under s = 0: s = 0 er der ballen tas imot (hendene), og bakken
 * ligger `below` meter lavere. Med `plotHeight` figurenheter fra s = 0 til toppen av aksen og `room` figurenheter
 * ledig under s = 0, må skalaen være høyst room / below per meter.
 */
export function minAxisTopForGround(below: number, plotHeight: number, room: number): number {
  if (!(below > 0) || !(plotHeight > 0)) return 0;
  return (below * plotHeight) / Math.max(1, room);
}

/** Rektangel i figuren (x og y er øvre venstre hjørne). */
export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

const overlaps = (a: Box, b: Box): boolean => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

/**
 * Hvor etiketten «toppunkt» skal stå ved punktet der v-t-grafen krysser t-aksen (px, py): under og til venstre
 * for punktet (linja går over til venstre og under til høyre), og skjøvet mot høyre så den ikke dekker aksetallene
 * (`x0` er venstre kant av grafen) så lenge den ikke krysser linja. Ellers over og til høyre for punktet. `w` og
 * `h` er bredden og høyden på teksten, `slope` hvor mange figurenheter linja synker per enhet mot høyre, `avoid`
 * andre ting etiketten ikke skal overlappe (stigningstrekanten). Null når den ikke får plass noe sted.
 */
export function topLabelPlacement(o: {
  px: number;
  py: number;
  w: number;
  h: number;
  /** Luft fra punktet til teksten. */
  pad: number;
  x0: number;
  x1: number;
  slope: number;
  avoid?: Box[];
}): { x: number; y: number; anchor: 'start' | 'end' } | null {
  const { px, py, w, h, pad, x0, x1 } = o;
  const free = (b: Box) => b.x >= x0 + 2 && b.x + b.w <= x1 - 2 && !(o.avoid ?? []).some((a) => overlaps(a, b));
  // Under og til venstre: grunnlinja 2,5 · pad under aksen. Linja er under aksen bare til høyre for punktet, så
  // teksten krysser den ikke så lenge høyre kant er til venstre for der linja er ved overkanten av teksten.
  const base = py + 2.5 * pad;
  const top = base - h;
  const right = Math.max(px - pad, x0 + 4 + w);
  const lineX = o.slope > 0 ? px + (top - py) / o.slope : Infinity;
  const below: Box = { x: right - w, y: top, w, h };
  if (right <= lineX - 3 && free(below)) return { x: right, y: base, anchor: 'end' };
  // Over og til høyre: linja er over aksen bare til venstre for punktet.
  const above: Box = { x: px + pad, y: py - 1.25 * pad - h, w, h };
  if (free(above)) return { x: px + pad, y: py - 1.25 * pad, anchor: 'start' };
  return null;
}

/** Etasjehøyden i boligblokka i scenen (m). */
export const THROW_FLOOR_HEIGHT = 3;

export interface ThrowBuilding {
  /** Etasjegulvene (m over bakken), stigende. Det øverste er h₀, der den som kaster står (når h₀ > 0). */
  floors: number[];
  /** Gulvene som har balkong: de med minst `minClear` fri høyde under, og alltid det øverste når h₀ > 0. */
  balconies: number[];
  /** Grunnmuren under det nederste gulvet (m), 0 når nederste etasje står på bakken. */
  base: number;
  /** Taket (m over bakken): én etasje over det øverste gulvet. */
  roof: number;
}

/**
 * Boligblokka i scenen til loddrett kast: den som kaster står på en balkong h₀ over bakken, og etasjene ligger
 * `floorH` fra hverandre opp og ned derfra (det som er igjen nederst, blir grunnmur). Blokka er minst `minRoof` høy
 * (tre etasjer), så den er en høydereferanse også når h₀ = 0 og den som kaster står i skolegården. Over 6 m står
 * den som kaster i øverste etasje.
 */
export function throwBuilding(h0: number, floorH = THROW_FLOOR_HEIGHT, minClear = 2.4, minRoof = 9): ThrowBuilding {
  const own = Math.max(0, Number.isFinite(h0) ? h0 : 0);
  const step = floorH > 0 ? floorH : THROW_FLOOR_HEIGHT;
  const storeysUp = Math.max(1, Math.ceil((minRoof - own) / step - 1e-9));
  const top = own + (storeysUp - 1) * step;
  const floors: number[] = [];
  for (let n = 0; n < 1000; n++) {
    const L = Math.round((top - n * step) * 1000) / 1000;
    if (L < 0) break;
    floors.unshift(L);
  }
  const balconies = floors.filter((L) => L >= minClear - 1e-9 || (own > 0 && Math.abs(L - own) < 1e-6));
  return { floors, balconies, base: floors[0] ?? 0, roof: Math.round((top + step) * 1000) / 1000 };
}

/* ---------- 1E Simulering: fall med luftmotstand L = kv² (Eulers metode) ---------- */

export interface DragFall {
  /** Masse (kg). */
  m: number;
  /** Luftmotstandstall k i L = kv² (kg/m). */
  k: number;
}

export interface EulerRow {
  /** Steg nummer n. */
  n: number;
  t: number;
  v: number;
  a: number;
  s: number;
}

/** Terminalfarten der L = G: v_T = √(mg/k). */
export function terminalVelocity({ m, k }: DragFall, g = G_EARTH): number {
  return Math.sqrt((m * g) / k);
}

/** Akselerasjonen a = (G − L)/m = g − (k/m)·v² (positiv retning nedover). */
export function dragAcceleration({ m, k }: DragFall, v: number, g = G_EARTH): number {
  return g - (k / m) * v * Math.abs(v);
}

/** Eksakt løsning: v(t) = v_T·tanh(gt/v_T). */
export function exactVelocity(p: DragFall, t: number, g = G_EARTH): number {
  const vT = terminalVelocity(p, g);
  return vT * Math.tanh((g * t) / vT);
}

/** Eksakt strekning: s(t) = (v_T²/g)·ln cosh(gt/v_T), skrevet så den ikke flyter over. */
export function exactPosition(p: DragFall, t: number, g = G_EARTH): number {
  const vT = terminalVelocity(p, g);
  const x = Math.abs((g * t) / vT);
  return ((vT * vT) / g) * (x + Math.log1p(Math.exp(-2 * x)) - Math.LN2);
}

/**
 * Eulers metode som i ERGO 1E: regn ut a fra farten, oppdater farten først og så posisjonen:
 *   a = g − (k/m)v²,  v = v + a·Δt,  s = s + v·Δt,  t = t + Δt
 * Raden for steg n viser t, v, s og akselerasjonen som brukes i neste steg.
 */
export function eulerFall(p: DragFall, dt: number, tEnd: number, g = G_EARTH): EulerRow[] {
  const rows: EulerRow[] = [];
  const steps = Math.max(1, Math.round(tEnd / dt));
  const vLimit = 50 * terminalVelocity(p, g);
  let v = 0;
  let s = 0;
  for (let n = 0; n <= steps; n++) {
    const a = dragAcceleration(p, v, g);
    rows.push({ n, t: n * dt, v, a, s });
    v += a * dt;
    s += v * dt;
    if (!Number.isFinite(v) || Math.abs(v) > vLimit) break;
  }
  return rows;
}

/** Største avvik |v_Euler − v_eksakt| over alle stegene. */
export function maxVelocityError(p: DragFall, rows: EulerRow[], g = G_EARTH): number {
  let worst = 0;
  for (const r of rows) worst = Math.max(worst, Math.abs(r.v - exactVelocity(p, r.t, g)));
  return worst;
}
