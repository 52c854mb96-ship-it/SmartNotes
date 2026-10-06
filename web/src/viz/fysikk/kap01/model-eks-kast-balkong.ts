/**
 * Eksempeloppgaven «Golfball kastet rett opp fra en balkong» (k1-eks-kast-balkong, 1D og 1E).
 *
 * En person står på en balkong og kaster en golfball rett opp. Ballen forlater hånda h₀ over plenen med farten v₀,
 * går klar av balkongen på vei ned og lander på plenen. Vi velger positiv retning oppover og måler posisjonen s fra
 * hånda (s = 0 der ballen slippes), så plenen er i s = −h₀. Uten luftmotstand er a = −g hele tiden:
 *
 *   s = v₀t − ½gt²,   v = v₀ − gt
 *   Toppunktet (v = 0):        s_topp = v₀² / (2g),   t_topp = v₀ / g,   H = h₀ + s_topp over plenen
 *   Plenen (s = −h₀):          ½g · t² − v₀ · t − h₀ = 0  ⇒  t = (v₀ ± √(v₀² + 2gh₀)) / g
 *                              Den positive løsningen er tiden ballen bruker. Den negative er før kastet.
 *   Farten ved plenen:         v = v₀ − gt = −√(v₀² + 2gh₀)   (negativ: nedover)
 *
 * Drøftingen av luftmotstanden (d) bruker L = kv². Den er størst like før ballen lander, og der sammenlignes den med
 * tyngden G = mg. En simulering med Eulers metode som i 1E (a = −g − (k/m)·v·|v|, først farten og så posisjonen,
 * Δt = 0,001 s) viser hvor mye svarene endres.
 */
import { fmt } from '../../kit/format';

export const G = 9.81;

/** Høyden fra plenen til gulvet i 1. etasje (grunnmuren), m. */
export const BASE_HEIGHT = 0.7;
/** Etasjehøyden (fra gulv til gulv), m. */
export const FLOOR_HEIGHT = 2.9;
/**
 * Hånda over balkonggulvet når ballen slippes, m. Armen er strekt skrått opp og litt fram over rekkverket, så ballen
 * går klar av balkongen på vei ned.
 */
export const HAND_OVER_FLOOR = 1.9;

export interface BalconyThrowTask {
  /** Den som kaster. */
  name: string;
  /** Etasjen balkongen er i (2 = andre etasje). Kasteren bor i øverste etasje, så det er ingen balkong over. */
  floor: number;
  /** Hånda over plenen når ballen slippes (m). Lik gulvet i etasjen pluss HAND_OVER_FLOOR. */
  h0: number;
  /** Startfarten rett opp (m/s). */
  v0: number;
  /** Massen til golfballen (kg). */
  m: number;
  /** Luftmotstandstallet i L = kv² (kg/m). */
  k: number;
}

/**
 * Tre tallsett. En golfball har massen 46 g og diameteren 4,3 cm. Med ρ = 1,2 kg/m³ og en formfaktor (C_d) på ca. 0,4
 * ved disse fartene blir k = ½ρC_dA ≈ 3 · 10⁻⁴ kg/m. Balkongene er i 2.–4. etasje (5,5–11,3 m), og startfartene
 * 5,0–9,5 m/s er et vanlig håndkast.
 */
export const BALCONY_THROW_TASKS: BalconyThrowTask[] = [
  { name: 'Elias', floor: 3, h0: 8.4, v0: 7.5, m: 0.046, k: 3.0e-4 },
  { name: 'Sofie', floor: 4, h0: 11.3, v0: 5.0, m: 0.046, k: 3.0e-4 },
  { name: 'Amir', floor: 2, h0: 5.5, v0: 9.5, m: 0.046, k: 3.0e-4 },
];

/** Gulvet i etasje `floor` over plenen (m): 1. etasje er grunnmuren. */
export function floorLevel(floor: number): number {
  return BASE_HEIGHT + (Math.max(1, floor) - 1) * FLOOR_HEIGHT;
}

/** Posisjonen (m) ved tiden t uten luftmotstand, positiv oppover fra hånda. Gjelder også for t < 0 (parabelen). */
export function positionAt(task: Pick<BalconyThrowTask, 'v0'>, t: number, g = G): number {
  return task.v0 * t - 0.5 * g * t * t;
}

/** Farten (m/s) ved tiden t uten luftmotstand, positiv oppover. */
export function velocityAt(task: Pick<BalconyThrowTask, 'v0'>, t: number, g = G): number {
  return task.v0 - g * t;
}

/** Tidspunktet (s) da ballen er i posisjonen s på vei ned (s ≤ s_topp), eller NaN når den aldri er der. */
export function timeAtPositionDown(task: Pick<BalconyThrowTask, 'v0'>, s: number, g = G): number {
  const disc = task.v0 * task.v0 - 2 * g * s;
  return disc >= 0 ? (task.v0 + Math.sqrt(disc)) / g : Number.NaN;
}

export interface QuadraticSolution {
  /** Koeffisientene i at² + bt + c = 0: a = ½g, b = −v₀, c = −h₀. */
  a: number;
  b: number;
  c: number;
  /** Diskriminanten b² − 4ac (= v₀² + 2gh₀) og kvadratroten av den. */
  disc: number;
  root: number;
  /** Løsningene (−b ± √disk) / (2a): den positive og den negative. */
  tPos: number;
  tNeg: number;
}

/** Andregradslikningen for når ballen er i posisjonen s = −h₀ (plenen). */
export function landingQuadratic(task: Pick<BalconyThrowTask, 'v0' | 'h0'>, g = G): QuadraticSolution {
  const a = 0.5 * g;
  const b = -task.v0;
  const c = -task.h0;
  const disc = b * b - 4 * a * c;
  const root = Math.sqrt(disc);
  return { a, b, c, disc, root, tPos: (-b + root) / (2 * a), tNeg: (-b - root) / (2 * a) };
}

export interface DragPoint {
  t: number;
  s: number;
  v: number;
}

export interface DragSimulation {
  /** Punktene (t, s, v) i hvert steg, til og med landingen. */
  points: DragPoint[];
  /** Høyeste posisjon over hånda (m) og når ballen er der (s). */
  sTop: number;
  tTop: number;
  /** Tiden til ballen lander (s), interpolert mellom de to siste stegene. */
  tLand: number;
  /** Farten ved landingen (m/s, negativ). */
  vLand: number;
}

/**
 * Bevegelsen med luftmotstand L = kv² (motsatt fartsretningen), simulert med Eulers metode som i 1E:
 * a = −g − (k/m) · v · |v|, så v ← v + aΔt og s ← s + vΔt (med den nye farten). Stopper når ballen når plenen.
 */
export function simulateWithDrag(task: BalconyThrowTask, dt = 0.001, g = G): DragSimulation {
  const { v0, h0, m, k } = task;
  const points: DragPoint[] = [{ t: 0, s: 0, v: v0 }];
  let t = 0;
  let s = 0;
  let v = v0;
  let sTop = 0;
  let tTop = 0;
  const maxSteps = Math.ceil(60 / dt);
  for (let n = 0; n < maxSteps; n++) {
    const a = -g - (k / m) * v * Math.abs(v);
    const vNext = v + a * dt;
    const sNext = s + vNext * dt;
    if (sNext <= -h0) {
      const f = (s + h0) / (s - sNext);
      const tLand = t + f * dt;
      const vLand = v + f * (vNext - v);
      points.push({ t: tLand, s: -h0, v: vLand });
      return { points, sTop, tTop, tLand, vLand };
    }
    t += dt;
    s = sNext;
    v = vNext;
    if (s > sTop) {
      sTop = s;
      tTop = t;
    }
    points.push({ t, s, v });
  }
  return { points, sTop, tTop, tLand: Number.NaN, vLand: Number.NaN };
}

export interface BalconyThrowSolution {
  /** Gulvet på balkongen over plenen (m). */
  floorY: number;
  /** Høyden over hånda i toppunktet (m) og tiden dit (s). */
  sTop: number;
  tTop: number;
  /** Høyden over plenen i toppunktet (m). */
  H: number;
  /** Andregradslikningen for landingen. */
  quad: QuadraticSolution;
  /** Tiden til ballen lander (s). */
  tLand: number;
  /** Den negative løsningen (s): før kastet, så den forkastes. */
  tNeg: number;
  /** Tiden fra toppunktet ned til plenen (s), til kontrollen t = t_topp + √(2H/g). */
  tFall: number;
  /** Farten ved plenen (m/s, negativ) og farten som tall (m/s og km/h). */
  vLand: number;
  speedLand: number;
  speedLandKmh: number;
  /** v² ved plenen fra den tidløse formelen: v₀² + 2gh₀. */
  vSquared: number;
  /** Tyngden (N), luftmotstanden like før landingen (N) og forholdet L/G. */
  weight: number;
  dragMax: number;
  dragRatio: number;
  /** Simuleringen med luftmotstand. */
  drag: DragSimulation;
  /** Med luftmotstand: høyden over plenen i toppunktet (m) og farten ved plenen (m/s, positiv). */
  dragH: number;
  dragSpeed: number;
  /** Relative endringer med luftmotstand (negativ = mindre), for H, tiden og farten. */
  dragChangeH: number;
  dragChangeT: number;
  dragChangeSpeed: number;
}

export function solveBalconyThrow(task: BalconyThrowTask, g = G): BalconyThrowSolution {
  const { v0, h0, m, k } = task;
  const sTop = (v0 * v0) / (2 * g);
  const tTop = v0 / g;
  const H = h0 + sTop;
  const quad = landingQuadratic(task, g);
  const tLand = quad.tPos;
  const vLand = velocityAt(task, tLand, g);
  const speedLand = Math.abs(vLand);
  const weight = m * g;
  const dragMax = k * speedLand * speedLand;
  const drag = simulateWithDrag(task, 0.001, g);
  const dragH = h0 + drag.sTop;
  const dragSpeed = Math.abs(drag.vLand);
  return {
    floorY: h0 - HAND_OVER_FLOOR,
    sTop,
    tTop,
    H,
    quad,
    tLand,
    tNeg: quad.tNeg,
    tFall: Math.sqrt((2 * H) / g),
    vLand,
    speedLand,
    speedLandKmh: speedLand * 3.6,
    vSquared: v0 * v0 + 2 * g * h0,
    weight,
    dragMax,
    dragRatio: dragMax / weight,
    drag,
    dragH,
    dragSpeed,
    dragChangeH: dragH / H - 1,
    dragChangeT: drag.tLand / tLand - 1,
    dragChangeSpeed: dragSpeed / speedLand - 1,
  };
}

/** Luftmotstanden (N) ved farten v uten luftmotstand i bevegelsen (overslaget i d): L = kv². */
export function dragForceAt(task: BalconyThrowTask, t: number, g = G): number {
  const v = velocityAt(task, t, g);
  return task.k * v * v;
}

/**
 * Til sammenligning i drøftingen: en badeball (40 cm, 100 g) har k ≈ ½ · 1,2 kg/m³ · 0,47 · 0,126 m² ≈ 0,035 kg/m.
 */
export const BEACH_BALL = { m: 0.1, k: 0.035 } as const;

/** Farten (m/s) der luftmotstanden er like stor som tyngden: kv² = mg (terminalfarten). */
export function equalForceSpeed(m: number, k: number, g = G): number {
  return Math.sqrt((m * g) / k);
}

/** Gulvene i blokka (m over plenen), fra 1. etasje til og med kasterens etasje. */
export function buildingFloors(floor: number): number[] {
  return Array.from({ length: Math.max(1, Math.round(floor)) }, (_, i) => floorLevel(i + 1));
}

/** Toppen av blokka (m): taket over kasterens etasje, med en lav kant (brystning) rundt taket. */
export function roofLevel(floor: number): number {
  return floorLevel(floor) + FLOOR_HEIGHT;
}

export interface GraphAxes {
  /** Tidsaksen (s): fra litt før den negative løsningen til litt etter landingen. */
  tMin: number;
  tMax: number;
  /** Posisjonsaksen (m): fra 1,5 m under plenen (plass til tekst under plenen) til litt over toppunktet. */
  sMin: number;
  sMax: number;
  /** Akseverdier: tid hvert halve (eller hele) sekund, posisjon hver annen meter. */
  tTicks: number[];
  sTicks: number[];
}

/**
 * Aksene i s-t-grafen, så begge løsningene av andregradslikningen og toppunktet får plass. `tStep` er avstanden
 * mellom akseverdiene på tidsaksen (standard 1 s).
 */
export function graphAxes(sol: BalconyThrowSolution, h0: number, tStep = 1): GraphAxes {
  const tMin = -Math.ceil((Math.abs(sol.tNeg) + 0.2) / 0.5) * 0.5;
  const tMax = Math.ceil((sol.tLand + 0.15) / 0.5) * 0.5;
  const sMin = -h0 - 1.5;
  const sMax = sol.sTop + 1.3;
  const tTicks: number[] = [];
  for (let v = Math.ceil(tMin / tStep - 1e-9) * tStep; v <= tMax + 1e-9; v += tStep) tTicks.push(round6(v));
  const sTicks: number[] = [];
  for (let v = Math.ceil(sMin / 2) * 2; v <= sMax + 1e-9; v += 2) sTicks.push(round6(v));
  return { tMin, tMax, sMin, sMax, tTicks, sTicks };
}

const round6 = (v: number) => Math.round(v * 1e6) / 1e6 + 0;

/**
 * Tall med `n` gjeldende siffer og desimalkomma, som i svarene: 2,8670 → «2,87», 11,267 → «11,3», 14,868 → «14,9»
 * (n = 3). Null skrives «0».
 */
export function fmtSig(v: number, n = 3): string {
  if (!Number.isFinite(v)) return fmt(v, 0);
  if (v === 0) return '0';
  const d = Math.max(0, n - 1 - Math.floor(Math.log10(Math.abs(v)) + 1e-9));
  return fmt(v, d);
}

/** Prosent med ett gjeldende siffer mer enn nødvendig for små tall: 0,147 → «15 %», 0,038 → «3,8 %». */
export function fmtPercent(fraction: number): string {
  const p = Math.abs(fraction) * 100;
  return `${p < 9.95 ? fmt(p, 1) : fmt(p, 0)} %`;
}
