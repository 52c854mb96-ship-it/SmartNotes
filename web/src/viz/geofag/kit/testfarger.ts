/**
 * Bare til testene: leser fargene i geofag.css, viz.css og scene.css (lyst og mørkt tema) og regner ut fargene kit-et
 * faktisk bruker, også `var(--…)` og `color-mix(in oklab | srgb, …)` fra `mix`, `tint`, `shade` og `alpha`. Gir
 * kontrast (WCAG) og fargeavstand (ΔE, CIE76 i Lab), så testene kan kreve at to farger skiller seg fra hverandre.
 * Eksporteres ikke fra index.ts.
 */
import { readFileSync } from 'node:fs';

export type Tema = 'lys' | 'mork';

/** Variablene i én CSS-blokk som `{ navn: verdi }`. */
function vars(block: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of block.matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/g)) out[m[1]!] = m[2]!.trim();
  return out;
}

/** Innholdet i den første blokken som starter med `start`. */
function blokk(css: string, start: string): string {
  const i = css.indexOf(start);
  if (i < 0) return '';
  const open = css.indexOf('{', i + start.length - 1);
  const close = css.indexOf('}', open);
  return css.slice(open + 1, close);
}

const les = (rel: string) => readFileSync(new URL(rel, import.meta.url), 'utf8');

function temaVars(css: string): Record<Tema, Record<string, string>> {
  return { lys: vars(blokk(css, ':root {')), mork: vars(blokk(css, ":root[data-theme='dark'] {")) };
}

const KILDER = [temaVars(les('./geofag.css')), temaVars(les('../../../styles/viz.css')), temaVars(les('../../kit/scene/scene.css'))];

/** Alle variablene i et tema (geofag, viz og scene). */
export function variabler(tema: Tema): Record<string, string> {
  return Object.assign({}, ...KILDER.map((k) => k[tema]));
}

type Rgb = [number, number, number];

const hexTilRgb = (h: string): Rgb => {
  const x = h.length === 4 ? `#${h[1]}${h[1]}${h[2]}${h[2]}${h[3]}${h[3]}` : h;
  return [1, 3, 5].map((i) => parseInt(x.slice(i, i + 2), 16) / 255) as Rgb;
};
const lin = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const gam = (c: number) => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);

function tilOklab([r0, g0, b0]: Rgb): Rgb {
  const [r, g, b] = [lin(r0), lin(g0), lin(b0)];
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s, 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s, 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s];
}

function fraOklab([L, a, b]: Rgb): Rgb {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const rgb = [4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s, -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s, -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s];
  return rgb.map((c) => Math.min(1, Math.max(0, gam(c)))) as Rgb;
}

/** Deler en argumentliste på komma på øverste nivå (ikke inne i parenteser). */
function delArgumenter(s: string): string[] {
  const ut: string[] = [];
  let dybde = 0;
  let start = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === '(') dybde++;
    else if (c === ')') dybde--;
    else if (c === ',' && dybde === 0) {
      ut.push(s.slice(start, i).trim());
      start = i + 1;
    }
  }
  ut.push(s.slice(start).trim());
  return ut;
}

/**
 * Fargen et CSS-uttrykk gir i et tema som sRGB (0–1), også `var(--x)`, hex, `white`/`black` og `color-mix(...)`.
 * Gjennomsiktighet (`transparent` i `alpha`) blandes mot `bak` (standard flaten i temaet).
 */
export function farge(uttrykk: string, tema: Tema, bak?: string): Rgb {
  const v = variabler(tema);
  const los = (e: string): Rgb => {
    const t = e.trim();
    if (t.startsWith('#')) return hexTilRgb(t);
    if (t === 'white') return [1, 1, 1];
    if (t === 'black') return [0, 0, 0];
    if (t === 'transparent') return los(bak ?? 'var(--viz-surface)');
    const mv = t.match(/^var\((--[a-z0-9-]+)\)$/);
    if (mv) {
      const verdi = v[mv[1]!];
      if (!verdi) throw new Error(`ukjent variabel ${mv[1]}`);
      return los(verdi);
    }
    const mm = t.match(/^color-mix\(in (oklab|srgb),\s*([\s\S]*)\)$/);
    if (mm) {
      const [a, b] = delArgumenter(mm[2]!);
      const pa = a!.match(/^([\s\S]*?)\s+([\d.]+)%$/);
      const pb = b!.match(/^([\s\S]*?)\s+([\d.]+)%$/);
      // color-mix(a p%, b) eller color-mix(a, b q%): andelen av b
      const andelB = pb ? Number(pb[2]) / 100 : pa ? 1 - Number(pa[2]) / 100 : 0.5;
      const ca = los(pa ? pa[1]! : a!);
      const cb = los(pb ? pb[1]! : b!);
      if (mm[1] === 'srgb') return ca.map((x, i) => x + (cb[i]! - x) * andelB) as Rgb;
      const [oa, ob] = [tilOklab(ca), tilOklab(cb)];
      return fraOklab(oa.map((x, i) => x + (ob[i]! - x) * andelB) as Rgb);
    }
    throw new Error(`kan ikke lese fargen «${t}»`);
  };
  return los(uttrykk);
}

/** Fargen som hex (til feilmeldinger). */
export function hex(uttrykk: string, tema: Tema): string {
  return `#${farge(uttrykk, tema)
    .map((c) => Math.round(c * 255).toString(16).padStart(2, '0'))
    .join('')}`;
}

const luminans = (c: Rgb) => {
  const [r, g, b] = c.map(lin) as Rgb;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

/** Kontrastforholdet (WCAG) mellom to farger i et tema (1–21). */
export function kontrast(a: string, b: string, tema: Tema): number {
  const [x, y] = [luminans(farge(a, tema)), luminans(farge(b, tema))].sort((p, q) => q - p);
  return (x! + 0.05) / (y! + 0.05);
}

function tilLab(c: Rgb): Rgb {
  const [r, g, b] = c.map(lin) as Rgb;
  const X = (0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047;
  const Y = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  const Z = (0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883;
  const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  return [116 * f(Y) - 16, 500 * (f(X) - f(Y)), 200 * (f(Y) - f(Z))];
}

/** Fargeavstanden ΔE (CIE76 i Lab) mellom to farger i et tema. */
export function deltaE(a: string, b: string, tema: Tema): number {
  const [p, q] = [tilLab(farge(a, tema)), tilLab(farge(b, tema))];
  return Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]);
}
