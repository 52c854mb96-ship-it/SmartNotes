/**
 * Ren fysikk for eksempeloppgaven «Bølger ved brygga» (k6-eks-bolge, 6A).
 *
 * Bølger fra en båt går inn mot land langs ei brygge. Grafen viser vannflaten i to bilder fra en film, tatt med
 * tiden Δt mellom. Bølgene går mot høyre (positiv x-retning), og en bølgetopp flytter seg mindre enn en halv
 * bølgelengde mellom bildene, så det er bare én måte å følge toppen på.
 *
 * Vannflaten er en sinusbølge som går mot høyre med farten v:
 *   y(x, t) = A · cos(2π (x − x_topp − v t) / λ)
 * der x_topp er en bølgetopp ved t = 0.
 *
 *   a) A og λ leses av grafen.
 *   b) v = Δx / Δt, der Δx er hvor langt én topp har flyttet seg.
 *   c) f = v / λ og T = 1 / f.
 *   d) Bølgeformen flytter seg mot høyre, så det som ligger rett til venstre for P, kommer til P. Er det nærmeste
 *      ytterpunktet til venstre for P en dal, er P på vei ned; er det en topp, er P på vei opp. Samme svar som
 *      farten til punktet: ∂y/∂t = −v · ∂y/∂x (vannflaten er nær nok en transversal bølge til at vi ser på
 *      bevegelsen opp og ned).
 *   e) P er på en topp når den nærmeste toppen til venstre for P har gått avstanden d: t = d / v = (d / λ) · T.
 *
 * Tallene i oppgaveteksten, utregningen og svaret kommer alle fra solveWaveTask. Alle toppene, dalene og P ligger
 * på hele meter, så de kan leses av rutenettet.
 */

export interface WaveTask {
  /** Hva som lager bølgene, til starten av oppgaveteksten: «En ferje har nettopp kjørt forbi». */
  source: string;
  /** Amplituden (m). */
  A: number;
  /** Bølgelengden (m). */
  lambda: number;
  /** Tiden mellom de to bildene (s). */
  dt: number;
  /** Hvor langt en bølgetopp flytter seg mellom bildene (m). */
  dx: number;
  /** En bølgetopp ved t = 0 (m): den første toppen fra venstre i grafen. */
  crest0: number;
  /** Der måken (punktet P) ligger (m). */
  xP: number;
  /** x-aksen går fra 0 til xMax (m). */
  xMax: number;
  /** Avstanden mellom tallene på x-aksen (m). Rutenettet har 1 m mellom linjene. */
  xTick: number;
  /** y-aksen går fra −yMax til yMax (m). */
  yMax: number;
  /** Avstanden mellom tallene på y-aksen (m). */
  yTick: number;
  /** Avstanden mellom linjene i rutenettet på y-aksen (m). */
  yGrid: number;
  /** Antall desimaler på y-aksen. */
  yDecimals: number;
}

/** Avstanden mellom linjene i rutenettet langs x-aksen (m). */
export const X_GRID = 1;
/** Avstanden mellom pælene under brygga (m), som også er en målestokk i tegningen. */
export const POST_SPACING = 2;

/**
 * Tallsettene: bølger fra en ferje, dønninger fra havet og bølger fra en liten motorbåt. Farten ligger nær det
 * havbølger med disse bølgelengdene har (v ≈ √(gλ / 2π) på dypt vann gir 3,5 m/s, 4,3 m/s og 3,1 m/s), litt
 * mindre der vannet er grunnere.
 */
export const WAVE_TASKS: readonly WaveTask[] = [
  {
    source: 'En ferje har nettopp kjørt forbi',
    A: 0.4,
    lambda: 8,
    dt: 0.6,
    dx: 2,
    crest0: 3,
    xP: 9,
    xMax: 16,
    xTick: 2,
    yMax: 0.8,
    yTick: 0.4,
    yGrid: 0.1,
    yDecimals: 1,
  },
  {
    source: 'Det er dønninger fra havet',
    A: 0.5,
    lambda: 12,
    dt: 0.7,
    dx: 3,
    crest0: 2,
    xP: 6,
    xMax: 24,
    xTick: 4,
    yMax: 1,
    yTick: 0.5,
    yGrid: 0.1,
    yDecimals: 1,
  },
  {
    source: 'En liten motorbåt har nettopp kjørt forbi',
    A: 0.25,
    lambda: 6,
    dt: 0.35,
    dx: 1,
    crest0: 1,
    xP: 5,
    xMax: 12,
    xTick: 2,
    yMax: 0.5,
    yTick: 0.25,
    yGrid: 0.05,
    yDecimals: 2,
  },
];

/** Høyden til vannflaten (m) i x ved tiden t. */
export function surfaceY(task: WaveTask, x: number, t: number): number {
  const v = task.dx / task.dt;
  return task.A * Math.cos((2 * Math.PI * (x - task.crest0 - v * t)) / task.lambda);
}

/** Farten opp (positiv) eller ned (negativ) til vannflaten i x ved tiden t (m/s): ∂y/∂t. */
export function surfaceVelocity(task: WaveTask, x: number, t: number): number {
  const v = task.dx / task.dt;
  const k = (2 * Math.PI) / task.lambda;
  return task.A * k * v * Math.sin(k * (x - task.crest0 - v * t));
}

/** Toppene (eller dalene med `trough`) i [xMin, xMax] ved tiden t, fra venstre. */
export function crestsAt(task: WaveTask, t: number, xMin: number, xMax: number, trough = false): number[] {
  const v = task.dx / task.dt;
  const first = task.crest0 + v * t + (trough ? task.lambda / 2 : 0);
  const out: number[] = [];
  const n0 = Math.ceil((xMin - first) / task.lambda - 1e-9);
  for (let n = n0; ; n++) {
    const x = first + n * task.lambda;
    if (x > xMax + 1e-9) break;
    out.push(clean(x));
  }
  return out;
}

/** En brøk p/q med liten nevner (opptil 12) som er lik r, eller null. */
export function simpleFraction(r: number): { num: number; den: number } | null {
  for (let den = 1; den <= 12; den++) {
    const num = Math.round(r * den);
    if (Math.abs(num / den - r) < 1e-9) return { num, den };
  }
  return null;
}

/** Antall desimaler som gir `sig` gjeldende siffer for v (minst 0). */
export function decimalsFor(v: number, sig: number): number {
  if (!Number.isFinite(v) || v === 0) return Math.max(0, sig - 1);
  return Math.max(0, sig - 1 - Math.floor(Math.log10(Math.abs(v)) + 1e-12));
}

/** v avrundet til `sig` gjeldende siffer. */
export function roundSig(v: number, sig: number): number {
  const d = decimalsFor(v, sig);
  const p = 10 ** d;
  return Math.round(v * p) / p;
}

export type Direction = 'opp' | 'ned';

export interface WaveSolution {
  /** b) Farten (m/s), uavrundet. */
  v: number;
  /** b) Farten med to gjeldende siffer, til «Vis at …». */
  vShown: number;
  /** c) Frekvensen (Hz). */
  f: number;
  /** c) Perioden (s). */
  T: number;
  /** a) Toppene i grafen ved t = 0 og ved t = Δt (m), fra venstre. */
  crests0: number[];
  crests1: number[];
  /** Dalene i grafen ved t = 0 (m), fra venstre. */
  troughs0: number[];
  /** a) Toppen vi måler λ fra (x_topp) og neste topp (x_topp + λ). */
  lambdaFrom: number;
  lambdaTo: number;
  /** b) Toppen i bilde 2 som var i crest0 i bilde 1 (m). */
  crestMoved: number;
  /** d) Høyden til vannet i P i bilde 1 og bilde 2 (m). */
  yP0: number;
  yP1: number;
  /** d) Farten opp eller ned til vannet i P i bilde 1 (m/s). */
  uP: number;
  /** d) Om P er på vei opp eller ned i bilde 1. */
  direction: Direction;
  /** d) Det nærmeste ytterpunktet til venstre for P i bilde 1: en topp eller en dal, og hvor (m). */
  leftExtreme: { kind: 'topp' | 'dal'; x: number };
  /** e) Den nærmeste toppen til venstre for P i bilde 1 (m). */
  crestLeftOfP: number;
  /** e) Hvor langt den toppen må gå før den er ved P (m). */
  d: number;
  /** e) Tiden fra bilde 1 til P er på en topp for første gang (s). */
  tCrest: number;
  /** e) d / λ som en enkel brøk (også t / T). */
  fraction: { num: number; den: number } | null;
}

export function solveWaveTask(task: WaveTask): WaveSolution {
  const { lambda, dt, dx, crest0, xP, xMax } = task;
  const v = dx / dt;
  const f = v / lambda;
  const T = 1 / f;
  const crests0 = crestsAt(task, 0, 0, xMax);
  const crests1 = crestsAt(task, dt, 0, xMax);
  const troughs0 = crestsAt(task, 0, 0, xMax, true);
  const yP0 = clean(surfaceY(task, xP, 0));
  const yP1 = clean(surfaceY(task, xP, dt));
  const uP = surfaceVelocity(task, xP, 0);
  const crestLeftOfP = clean(crest0 + lambda * Math.floor((xP - crest0) / lambda + 1e-9));
  const troughLeftOfP = clean(crest0 + lambda / 2 + lambda * Math.floor((xP - crest0 - lambda / 2) / lambda + 1e-9));
  const leftExtreme = troughLeftOfP > crestLeftOfP ? { kind: 'dal' as const, x: troughLeftOfP } : { kind: 'topp' as const, x: crestLeftOfP };
  const d = clean(xP - crestLeftOfP);
  return {
    v,
    vShown: roundSig(v, 2),
    f,
    T,
    crests0,
    crests1,
    troughs0,
    lambdaFrom: crest0,
    lambdaTo: crest0 + lambda,
    crestMoved: crest0 + dx,
    yP0,
    yP1,
    uP,
    direction: uP > 0 ? 'opp' : 'ned',
    leftExtreme,
    crestLeftOfP,
    d,
    tCrest: d / v,
    fraction: simpleFraction(d / lambda),
  };
}

/** Fjerner flyttallsstøy (2.9999999 → 3) så posisjonene kan sammenlignes og skrives. */
function clean(x: number): number {
  const r = Math.round(x * 1e9) / 1e9;
  return Object.is(r, -0) ? 0 : r;
}
