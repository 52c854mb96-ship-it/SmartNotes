/**
 * Ren geometri for scenene i «impuls» (ingen React, så den kan testes): eggets form og overflaten til et mykt
 * underlag (matte, håndkle, pute) som egget presses ned i. Alle mål er i figurens enheter, y nedover.
 */

/** Egget står med den butte enden ned. `mid` er den bredeste linja; `up` og `down` er høyden over og under den. */
export interface EggShape {
  cx: number;
  mid: number;
  /** Halve bredden. */
  w: number;
  up: number;
  down: number;
}

/** Et hønseegg: 5,7 cm langt og 4,4 cm bredt, med den bredeste linja 43 % opp fra den butte enden. */
export const EGG_SIZE = {
  length: 0.057,
  width: 0.044,
  bluntShare: 0.43,
} as const;

/** Egget i en skala `pxPerM`, med bunnen (den butte enden) i (cx, bottom). */
export function eggAt(cx: number, bottom: number, pxPerM: number): EggShape {
  const L = EGG_SIZE.length * pxPerM;
  const down = L * EGG_SIZE.bluntShare;
  return {
    cx,
    mid: bottom - down,
    w: (EGG_SIZE.width * pxPerM) / 2,
    up: L - down,
    down,
  };
}

/** Omrisset av egget som SVG-sti: to halve ellipser, spissere over midten enn under. */
export function eggPath(e: EggShape): string {
  const { cx, mid, w, up, down } = e;
  return `M${r2(cx - w)},${r2(mid)}A${r2(w)},${r2(up)} 0 0 1 ${r2(cx + w)},${r2(mid)}A${r2(w)},${r2(down)} 0 0 1 ${r2(cx - w)},${r2(mid)}Z`;
}

/** y-koordinaten til undersiden av egget i x, eller null utenfor egget. */
export function eggLowerY(e: EggShape, x: number): number | null {
  const u = (x - e.cx) / e.w;
  if (!(Math.abs(u) <= 1)) return null;
  return e.mid + e.down * Math.sqrt(1 - u * u);
}

export interface Dent {
  /** Overflaten før den presses ned. */
  top: number;
  /** Egget der det er nå (null: ingen bulk). */
  egg: EggShape | null;
  /** Hvor bredt materialet rundt trekkes med ned (standardavvik i figurens enheter). */
  spread: number;
  /** Hvor dypt materialet rett ved siden av egget trekkes med, som andel av dybden (0–1). */
  shoulder: number;
}

/** Hvor dypt egget har presset seg ned i underlaget (figurens enheter, 0 når det ikke rører det). */
export function dentDepth(d: Dent): number {
  return d.egg ? Math.max(0, d.egg.mid + d.egg.down - d.top) : 0;
}

/**
 * Overflaten til underlaget i x: der egget presser, følger den undersiden av egget, og rundt egget trekkes
 * materialet med ned i en myk bulk som flater ut. Overflaten er aldri over egget eller over `top`.
 */
export function surfaceY(x: number, d: Dent): number {
  const depth = dentDepth(d);
  if (!d.egg || depth <= 0) return d.top;
  const u = (x - d.egg.cx) / Math.max(1e-6, d.spread);
  let sink = depth * d.shoulder * Math.exp(-u * u);
  const lower = eggLowerY(d.egg, x);
  if (lower !== null) sink = Math.max(sink, lower - d.top);
  return d.top + Math.max(0, sink);
}

/** Punkter langs overflaten fra x1 til x2, tettere rundt egget så bulken blir glatt. */
export function surfacePoints(x1: number, x2: number, d: Dent, step = 6): [number, number][] {
  const xs = new Set<number>();
  for (let x = x1; x < x2; x += step) xs.add(r2(x));
  xs.add(r2(x2));
  if (d.egg) {
    const a = d.egg.cx - d.spread * 2.5;
    const b = d.egg.cx + d.spread * 2.5;
    for (let x = Math.max(x1, a); x <= Math.min(x2, b); x += step / 4) xs.add(r2(x));
  }
  return [...xs].sort((p, q) => p - q).map((x) => [x, surfaceY(x, d)]);
}

/** En linje inne i materialet (f.eks. et lag i et håndkle) en andel `f` ned fra toppen: den bøyer seg mindre jo dypere den ligger. */
export function layerY(x: number, d: Dent, bottom: number, f: number): number {
  const y0 = d.top + (bottom - d.top) * f;
  return y0 + (surfaceY(x, d) - d.top) * (1 - f);
}

export function r2(v: number): number {
  return Math.round(v * 100) / 100;
}
