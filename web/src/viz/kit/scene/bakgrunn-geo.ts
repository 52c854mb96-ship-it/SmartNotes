/**
 * Ren geometri for bakgrunnene i scene-kit-et (bakgrunn.tsx): stier, profiler, fjelltopper, punkter langs en
 * overflate og bølger. Ingen React og ingen farger. Eksporteres ikke fra scene-kit-et (bare til bakgrunnsfilene).
 */

export type Pt = [number, number];

/** Avrunding til én desimal for korte stier. */
export const r1 = (v: number): number => (Number.isFinite(v) ? Math.round(v * 10) / 10 : 0);
/** Avrunding til to desimaler (små detaljer). */
export const r2 = (v: number): number => (Number.isFinite(v) ? Math.round(v * 100) / 100 : 0);

export const clamp = (v: number, lo: number, hi: number): number => (Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : lo);

/** Positiv rest (også for negative tall). */
export const mod = (a: number, n: number): number => (n > 0 && Number.isFinite(a) ? ((a % n) + n) % n : 0);

export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

/** Brutt linje gjennom punktene (åpen sti). */
export function polyline(pts: readonly Pt[]): string {
  let d = '';
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i]!;
    d += `${i ? 'L' : 'M'}${r1(p[0])},${r1(p[1])}`;
  }
  return d;
}

/** Lukket mangekant. */
export function polygon(pts: readonly Pt[]): string {
  return pts.length > 1 ? `${polyline(pts)}Z` : '';
}

/** Sirkel som delsti (med klokka), så mange sirkler kan stå i én <path>. */
export function circle(cx: number, cy: number, r: number): string {
  if (!(r > 0)) return '';
  const a = r2(r);
  return `M${r2(cx - r)},${r2(cy)}a${a},${a} 0 1,1 ${r2(2 * a)},0a${a},${a} 0 1,1 ${r2(-2 * a)},0Z`;
}

/** Ellipse som delsti (med klokka). */
export function ellipse(cx: number, cy: number, rx: number, ry: number): string {
  if (!(rx > 0) || !(ry > 0)) return '';
  const a = r2(rx);
  const b = r2(ry);
  return `M${r2(cx - rx)},${r2(cy)}a${a},${b} 0 1,1 ${r2(2 * a)},0a${a},${b} 0 1,1 ${r2(-2 * a)},0Z`;
}

/** Fast tallgenerator gjort om til en tabell, så samme frø gir samme tekstur uansett hvor mange merker som tegnes. */
export function randomTable(rand: () => number, n: number): Float64Array {
  const t = new Float64Array(n);
  for (let i = 0; i < n; i++) t[i] = rand();
  return t;
}

/** Frø fra et tall og en tekst (så hver type får sitt eget mønster med samme frø). */
export function seedFor(seed: number, text: string): number {
  let h = (Math.floor(Number.isFinite(seed) ? seed : 1) * 2654435761) >>> 0;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619) >>> 0;
  return h;
}

/**
 * Periodisk støy på [0, 1): sum av sinuser med hele antall perioder, så profilen er like i begge ender og kan
 * rulle i det uendelige (forskyvning). `terms` = [frekvens, amplitude].
 */
export function periodicNoise(rand: () => number, terms: readonly [number, number][]): (t: number) => number {
  const phases = terms.map(() => rand() * Math.PI * 2);
  return (t: number) => {
    let s = 0;
    for (let i = 0; i < terms.length; i++) {
      const [f, a] = terms[i]!;
      s += a * Math.sin(2 * Math.PI * f * t + phases[i]!);
    }
    return s;
  };
}

/** En fjelltopp: midten `c`, høyden `hgt` og halve bredden ved foten `s`. */
export interface Peak {
  c: number;
  hgt: number;
  s: number;
}

/** Høyden til en fjelltopp i avstanden d fra midten: bratt øverst, slakere mot foten, litt avrundet topp. */
export function peakShape(d: number, p: Peak): number {
  const soft = p.s * 0.05;
  const dd = Math.sqrt(d * d + soft * soft) - soft;
  if (dd >= p.s) return 0;
  return p.hgt * Math.pow(1 - dd / p.s, 1.35);
}

/** Høyden til toppen i x når landskapet gjentar seg med perioden w. */
export function peakAt(x: number, w: number, p: Peak): number {
  let d = Math.abs(x - p.c);
  if (w > 0) d = Math.min(d, Math.abs(w - d));
  return peakShape(d, p);
}

/**
 * Profil fra x = −margin til w + margin med høyden `height(x)` over grunnlinja `base` (y opp er negativ).
 * Margen gir overlapp mellom kopiene når et periodisk landskap ruller, så det ikke blir hårfine glipper.
 */
export function profile(w: number, n: number, height: (x: number) => number, base = 0, margin = 0): Pt[] {
  const pts: Pt[] = [];
  const m = Math.max(2, Math.round(n));
  for (let i = 0; i <= m; i++) {
    const x = -margin + (i / m) * (w + 2 * margin);
    pts.push([x, base - Math.max(0, height(x))]);
  }
  return pts;
}

/**
 * Periodisk sagtann: n verdier jevnt fordelt på [0, w), gjentatt én ekstra på hver side, så kanten (snøgrense,
 * skogkant) passer sammen når landskapet ruller. `value(i)` kalles én gang per verdi.
 */
export function periodicSteps(w: number, n: number, value: (i: number) => number): Pt[] {
  const m = Math.max(2, Math.round(n));
  const vals: number[] = [];
  for (let i = 0; i < m; i++) vals.push(value(i));
  const pts: Pt[] = [];
  for (let i = -1; i <= m + 1; i++) pts.push([(i / m) * w, vals[mod(i, m)]!]);
  return pts;
}

/** Lukket form: profilen og rett ned til y = bottom. */
export function fillDown(pts: readonly Pt[], bottom: number): string {
  const first = pts[0];
  const last = pts[pts.length - 1];
  if (!first || !last) return '';
  return `${polyline(pts)}L${r1(last[0])},${r1(bottom)}L${r1(first[0])},${r1(bottom)}Z`;
}

/** Høyeste punkt (minste y) i en profil. */
export function topOf(pts: readonly Pt[]): number {
  let m = Infinity;
  for (const p of pts) m = Math.min(m, p[1]);
  return Number.isFinite(m) ? m : 0;
}

/** Sti med første punkt absolutt og resten relativt (kortere tekst for mange små trær). */
function relPath(pts: readonly Pt[]): string {
  const first = pts[0];
  if (!first) return '';
  let d = `M${r1(first[0])},${r1(first[1])}`;
  let [px, py] = [r1(first[0]), r1(first[1])];
  for (let i = 1; i < pts.length; i++) {
    const [x, y] = [r1(pts[i]![0]), r1(pts[i]![1])];
    d += `l${r1(x - px)},${r1(y - py)}`;
    px = x;
    py = y;
  }
  return `${d}z`;
}

/**
 * Silhuett av en gran i landskapet (tre etasjer, eller en enkel spiss når den er liten), med foten midt på
 * (cx, baseY), høyden th og halve bredden hw. Med klokka, så mange trær og en bakke kan stå i samme sti uten hull.
 */
export function spruceSilhouette(cx: number, baseY: number, th: number, hw: number): string {
  if (th < 12)
    return relPath([
      [cx - hw, baseY],
      [cx - hw * 0.3, baseY - th * 0.55],
      [cx, baseY - th],
      [cx + hw * 0.3, baseY - th * 0.55],
      [cx + hw, baseY],
    ]);
  return relPath([
    [cx - hw, baseY],
    [cx - hw * 0.42, baseY - th * 0.34],
    [cx - hw * 0.66, baseY - th * 0.33],
    [cx - hw * 0.24, baseY - th * 0.64],
    [cx - hw * 0.42, baseY - th * 0.63],
    [cx, baseY - th],
    [cx + hw * 0.42, baseY - th * 0.63],
    [cx + hw * 0.24, baseY - th * 0.64],
    [cx + hw * 0.66, baseY - th * 0.33],
    [cx + hw * 0.42, baseY - th * 0.34],
    [cx + hw, baseY],
  ]);
}

/** Høyre halvdel av samme gran (skyggesiden når lyset kommer fra venstre). */
export function spruceShadeSide(cx: number, baseY: number, th: number, hw: number): string {
  if (th < 12)
    return relPath([
      [cx, baseY - th],
      [cx + hw * 0.3, baseY - th * 0.55],
      [cx + hw, baseY],
      [cx + hw * 0.08, baseY],
    ]);
  return relPath([
    [cx, baseY - th],
    [cx + hw * 0.42, baseY - th * 0.63],
    [cx + hw * 0.24, baseY - th * 0.64],
    [cx + hw * 0.66, baseY - th * 0.33],
    [cx + hw * 0.42, baseY - th * 0.34],
    [cx + hw, baseY],
    [cx + hw * 0.08, baseY],
  ]);
}

/** Et punkt på en overflate med retningen (enhetsvektor) langs overflaten. */
export interface SurfacePoint {
  x: number;
  y: number;
  tx: number;
  ty: number;
}

/**
 * Punkter med omtrent fast avstand langs en brutt linje (med litt tilfeldig variasjon), til tekstur langs
 * overflaten av et terreng. Tåler bratte partier, korte segmenter og mange punkter.
 */
export function alongPolyline(pts: readonly Pt[], spacing: number, rand: () => number, max = 400): SurfacePoint[] {
  const out: SurfacePoint[] = [];
  if (!(spacing > 0)) return out;
  let next = spacing * (0.2 + rand() * 0.8);
  for (let i = 0; i < pts.length - 1 && out.length < max; i++) {
    const [ax, ay] = pts[i]!;
    const [bx, by] = pts[i + 1]!;
    const len = Math.hypot(bx - ax, by - ay);
    if (!(len > 0)) continue;
    const tx = (bx - ax) / len;
    const ty = (by - ay) / len;
    while (next <= len && out.length < max) {
      out.push({ x: ax + tx * next, y: ay + ty * next, tx, ty });
      next += spacing * (0.6 + rand() * 0.8);
    }
    next -= len;
  }
  return out;
}

/** Fjerner punkter som ikke er tall, og sorterer ingenting (rekkefølgen er overflaten fra venstre til høyre). */
export function cleanPoints(points: readonly (readonly [number, number])[]): Pt[] {
  const out: Pt[] = [];
  for (const p of points) {
    if (p && Number.isFinite(p[0]) && Number.isFinite(p[1])) out.push([p[0], p[1]]);
  }
  return out;
}

/**
 * Myk kurve gjennom punktene (Catmull-Rom med lengdevekt), som en tett brutt linje med ca. `step` mellom punktene.
 * Kurven går gjennom hvert punkt med retningen fra forrige til neste punkt (endepunktene: langs første og siste
 * stykke). Tangentene skaleres med lengden på stykkene, så et kort stykke ved siden av et langt ikke gir sløyfer.
 */
export function smoothPolyline(pts: readonly Pt[], step = 3, max = 1200): Pt[] {
  const n = pts.length;
  if (n < 3) return pts.map((p): Pt => [p[0], p[1]]);
  const len: number[] = [];
  let total = 0;
  for (let i = 0; i < n - 1; i++) {
    const l = Math.hypot(pts[i + 1]![0] - pts[i]![0], pts[i + 1]![1] - pts[i]![1]);
    len.push(l);
    total += l;
  }
  // Retningen i hvert punkt per lengdeenhet: (neste − forrige) / (lengden av de to stykkene).
  const tan: Pt[] = pts.map((_, i) => {
    const a = pts[Math.max(0, i - 1)]!;
    const b = pts[Math.min(n - 1, i + 1)]!;
    const d = (i > 0 ? len[i - 1]! : 0) + (i < n - 1 ? len[i]! : 0);
    return d > 0 ? [(b[0] - a[0]) / d, (b[1] - a[1]) / d] : [0, 0];
  });
  const st = Math.max(step, total / max);
  const out: Pt[] = [[pts[0]![0], pts[0]![1]]];
  for (let i = 0; i < n - 1; i++) {
    const L = len[i]!;
    if (!(L > 0)) continue;
    const [x0, y0] = pts[i]!;
    const [x1, y1] = pts[i + 1]!;
    const [ax, ay] = [tan[i]![0] * L, tan[i]![1] * L];
    const [bx, by] = [tan[i + 1]![0] * L, tan[i + 1]![1] * L];
    const k = Math.max(1, Math.ceil(L / st));
    for (let j = 1; j <= k; j++) {
      const t = j / k;
      const t2 = t * t;
      const t3 = t2 * t;
      const h00 = 2 * t3 - 3 * t2 + 1;
      const h10 = t3 - 2 * t2 + t;
      const h01 = -2 * t3 + 3 * t2;
      const h11 = t3 - t2;
      out.push([h00 * x0 + h10 * ax + h01 * x1 + h11 * bx, h00 * y0 + h10 * ay + h01 * y1 + h11 * by]);
    }
  }
  return out;
}

/**
 * Overflaten til vann med en sinusbølge: η(x) = A · sin(2π (x − x0) / λ − fase), y = y0 − η.
 * Når fasen øker, flytter bølgen seg mot høyre.
 */
export function wavePoints(x0: number, w: number, y0: number, amplitude: number, wavelength: number, phase: number): Pt[] {
  const A = Number.isFinite(amplitude) ? amplitude : 0;
  const lam = Number.isFinite(wavelength) && wavelength > 1 ? wavelength : 0;
  if (!A || !lam) return [
    [x0, y0],
    [x0 + w, y0],
  ];
  const step = clamp(lam / 16, 1.5, 6);
  const n = Math.round(clamp(Math.ceil(w / step), 8, 480));
  const ph = Number.isFinite(phase) ? phase : 0;
  const pts: Pt[] = [];
  for (let i = 0; i <= n; i++) {
    const x = x0 + (i / n) * w;
    pts.push([x, y0 - A * Math.sin((2 * Math.PI * (x - x0)) / lam - ph)]);
  }
  return pts;
}

/** Tall i [0, 1) fra et heltall og et frø (samme svar hver gang), til mønstre som ruller med forskyvningen. */
export function hash01(i: number, seed: number): number {
  let h = Math.imul((Math.floor(i) | 0) ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(Math.floor(seed) | 0, 0xc2b2ae35);
  h ^= h >>> 13;
  h = Math.imul(h, 0x27d4eb2f);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

/** Myk støy i [0, 1) langs x (cosinus-interpolert mellom faste verdier hver `spacing`), til myke kanter i snø. */
export function edgeNoise(x: number, spacing: number, seed: number): number {
  const s = spacing > 0 ? spacing : 1;
  const i = Math.floor(x / s);
  const f = x / s - i;
  const a = hash01(i, seed);
  const b = hash01(i + 1, seed);
  const t = (1 - Math.cos(Math.PI * f)) / 2;
  return a + (b - a) * t;
}

/**
 * Flytter en sti fra bakgrunnsgeneratorene vannrett: alle absolutte M- og L-punkter får + dx (buer og andre relative
 * kommandoer er uendret). Brukes til å legge to perioder av et rullende landskap i samme sti, så det ikke blir søm.
 */
export function shiftPath(d: string, dx: number): string {
  return d.replace(/([ML])(-?\d+(?:\.\d+)?)(?=,)/g, (_m, c: string, x: string) => `${c}${r2(Number(x) + dx)}`);
}
