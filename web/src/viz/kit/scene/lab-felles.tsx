/**
 * Interne hjelpere for familien «lab» (varme og elektrisitet). Eksporteres ikke fra kit/scene, så navnene her
 * kan ikke kollidere med de andre familiene.
 */
import type { ReactNode } from 'react';
import { LinearGradient, RadialGradient, SCENE_DIM, shade, tint, useStrokeScale, type GradientStop } from './core';

/** Farger som bare familien «lab» bruker (lab.css). */
export const LAB = {
  thermo: 'var(--sc-lab-thermo)',
  ink: 'var(--sc-lab-ink)',
  resistor: 'var(--sc-lab-resistor)',
  bands: [
    'var(--sc-lab-band-0)',
    'var(--sc-lab-band-1)',
    'var(--sc-lab-band-2)',
    'var(--sc-lab-band-3)',
    'var(--sc-lab-band-4)',
    'var(--sc-lab-band-5)',
    'var(--sc-lab-band-6)',
    'var(--sc-lab-band-7)',
    'var(--sc-lab-band-8)',
    'var(--sc-lab-band-9)',
  ],
  solar: 'var(--sc-lab-solar)',
  solarLine: 'var(--sc-lab-solar-line)',
  steam: 'var(--sc-lab-steam)',
  steamEdge: 'var(--sc-lab-steam-edge)',
} as const;

export interface Pt {
  x: number;
  y: number;
}

/** Tall i [0, 1]; ugyldige tall gir `fallback`. */
export function clamp01(v: number | undefined, fallback = 0): number {
  const n = v === undefined || !Number.isFinite(v) ? fallback : v;
  return Math.min(1, Math.max(0, n));
}

/** Endelig tall eller `fallback`. */
export function fin(v: number | undefined, fallback: number): number {
  return v !== undefined && Number.isFinite(v) ? v : fallback;
}

/** Avrund til to desimaler (korte stier og stabile skjermbilder). */
export function r2(v: number): number {
  return Number.isFinite(v) ? Math.round(v * 100) / 100 : 0;
}

/**
 * Et lokalt punkt i en gjenstand → figurens koordinater. Samme rekkefølge som <ObjectFrame>: speilvend, skaler med k,
 * drei `rotate` grader med klokka og flytt til (x, y).
 */
export function localToFigure(lx: number, ly: number, x: number, y: number, k: number, rotate = 0, flip = false): Pt {
  const fx = (flip ? -lx : lx) * k;
  const fy = ly * k;
  const a = (fin(rotate, 0) * Math.PI) / 180;
  const c = Math.cos(a);
  const s = Math.sin(a);
  return { x: r2(x + fx * c - fy * s), y: r2(y + fx * s + fy * c) };
}

/** Strektykkelse i lokale enheter: `w` figurenheter (ganget med useStrokeScale) delt på skalaen k. */
export function useLocalStroke(k: number): (w: number) => number {
  const ss = useStrokeScale();
  return (w: number) => (w * ss) / (k > 0 ? k : 1);
}

/**
 * Ramme for en gjenstand: flytter til (x, y), dreier og tegner barna skalert med k (lokale enheter).
 * `after` tegnes etter barna uten skalering (figurens enheter), f.eks. etiketter som skal vokse på mobil.
 */
export function ObjectFrame({
  x,
  y,
  k = 1,
  rotate,
  flip,
  dim,
  title,
  children,
  after,
}: {
  x: number;
  y: number;
  k?: number;
  rotate?: number;
  flip?: boolean;
  dim?: boolean;
  title?: string;
  children: ReactNode;
  after?: ReactNode;
}) {
  const outer = [`translate(${r2(fin(x, 0))} ${r2(fin(y, 0))})`];
  if (rotate) outer.push(`rotate(${r2(rotate)})`);
  const inner: string[] = [];
  if (k !== 1) inner.push(`scale(${Math.round(k * 10000) / 10000})`);
  if (flip) inner.push('scale(-1 1)');
  return (
    <g transform={outer.join(' ')} opacity={dim ? SCENE_DIM : undefined}>
      {title && <title>{title}</title>}
      <g transform={inner.length ? inner.join(' ') : undefined}>{children}</g>
      {after}
    </g>
  );
}

/** Sti for en sirkel (til mange små sirkler i ett element). */
export function circlePath(cx: number, cy: number, r: number): string {
  return `M${r2(cx - r)},${r2(cy)}a${r2(r)},${r2(r)} 0 1,0 ${r2(2 * r)},0a${r2(r)},${r2(r)} 0 1,0 ${r2(-2 * r)},0`;
}

/**
 * Toning for en sylinder sett fra siden med lys fra venstre (bruk x2 = 1, y2 = 0) eller ovenfra (y2 = 1):
 * mørk kant, høylys, farge, skygge.
 */
export function cylinderStops(color: string, strength = 1): GradientStop[] {
  return [
    [0, shade(color, 0.22 * strength)],
    [0.16, tint(color, 0.42 * strength)],
    [0.38, color],
    [0.78, shade(color, 0.16 * strength)],
    [1, shade(color, 0.32 * strength)],
  ];
}

/** Flat boks sett forfra med lys fra venstre: litt lysere til venstre, litt mørkere til høyre. */
export function boxStops(color: string, strength = 1): GradientStop[] {
  return [
    [0, tint(color, 0.16 * strength)],
    [0.5, color],
    [1, shade(color, 0.18 * strength)],
  ];
}

/** Sti for en mangekant med avrundede hjørner (radius r, kortere ved korte kanter). */
export function roundedPolygon(pts: [number, number][], r: number): string {
  const n = pts.length;
  if (n < 3) return '';
  const corners = pts.map((p, i) => {
    const a = pts[(i + n - 1) % n]!;
    const b = pts[(i + 1) % n]!;
    const l1 = Math.hypot(p[0] - a[0], p[1] - a[1]) || 1;
    const l2 = Math.hypot(b[0] - p[0], b[1] - p[1]) || 1;
    const rr = Math.max(0, Math.min(r, l1 / 2, l2 / 2));
    return {
      s: `${r2(p[0] - ((p[0] - a[0]) / l1) * rr)},${r2(p[1] - ((p[1] - a[1]) / l1) * rr)}`,
      p: `${r2(p[0])},${r2(p[1])}`,
      e: `${r2(p[0] + ((b[0] - p[0]) / l2) * rr)},${r2(p[1] + ((b[1] - p[1]) / l2) * rr)}`,
    };
  });
  let d = `M${corners[0]!.e}`;
  for (let i = 1; i <= n; i++) {
    const c = corners[i % n]!;
    d += `L${c.s}Q${c.p} ${c.e}`;
  }
  return `${d}Z`;
}

/**
 * Damp som stiger fra (x, y): en tynn, bølgete damptråd nederst og tre myke dotter som vokser, brer seg ut og blir
 * mykere mens de stiger. Ingen kontur: hver dott er en radiell toning fra nesten hvit i midten til gjennomsiktig i
 * kanten, så dampen ser lys ut både på lys vegg og i skumring (ikke som røyk). `mengde` 0–1 styrer størrelse og
 * tetthet; med `tid` (sekunder) stiger dottene og tråden bølger, ellers står de stille. Alle mål i lokale enheter.
 */
export function Damp({
  id,
  x,
  y,
  mengde,
  tid,
  bredde,
  hoyde,
  sw,
  drift = 0,
}: {
  id: string;
  x: number;
  y: number;
  mengde: number;
  tid?: number;
  /** Omtrentlig bredde på en dott høyt oppe. */
  bredde: number;
  /** Hvor høyt dampen stiger. */
  hoyde: number;
  sw: (w: number) => number;
  /** Sidelengs drift (lokale enheter over hele høyden, negativ = mot venstre). */
  drift?: number;
}) {
  const m = clamp01(mengde);
  if (m <= 0.02) return null;
  const animated = tid !== undefined && Number.isFinite(tid);
  const t = animated ? tid : 0;
  const n = 4;
  const grow = 0.55 + 0.45 * m;
  const dens = 0.45 + 0.55 * m;
  const blobs: { cx: number; cy: number; rx: number; ry: number; rot: number; op: number }[] = [];
  for (let i = 0; i < n; i++) {
    const p = animated ? (((t * 0.4 + i / n) % 1) + 1) % 1 : (i + 0.4) / n;
    // Smal og avlang nederst, bred og flat høyere opp (dottene overlapper til en sammenhengende søyle). Kjernen holder
    // seg tett til p ≈ 0,72 og tones så raskt ut.
    const rx = bredde * (0.2 + 0.42 * p) * grow;
    const ry = rx * (1.45 - 0.65 * p);
    const sway = Math.sin(p * 5.2 + i * 2.1) * bredde * 0.14;
    const cx = x + drift * p + sway;
    const cy = y - p * hoyde - ry * 0.35;
    const env = p < 0.1 ? p / 0.1 : p < 0.72 ? 1 : Math.max(0, 1 - ((p - 0.72) / 0.28) ** 1.6);
    const op = dens * env;
    if (op <= 0.02) continue;
    const rot = Math.sin(p * 4 + i) * 14 + (drift < 0 ? -8 : drift > 0 ? 8 : 0) * p;
    const side = i % 2 ? 1 : -1;
    blobs.push({ cx, cy, rx, ry, rot, op });
    blobs.push({ cx: cx + side * rx * 0.62, cy: cy + ry * 0.3, rx: rx * 0.7, ry: ry * 0.66, rot: -rot, op: op * 0.9 });
  }
  // Damptråden: en bølgete stripe fra kilden og opp til der dottene tar over.
  const wispH = hoyde * 0.42;
  let wisp = '';
  for (let j = 0; j <= 8; j++) {
    const u = j / 8;
    const wx = x + drift * u * 0.42 + Math.sin(u * Math.PI * 2.2 - t * 4.2) * bredde * 0.12 * (0.35 + u);
    wisp += `${j ? 'L' : 'M'}${r2(wx)},${r2(y - u * wispH)}`;
  }
  // To lag: først en myk blågrå kant rundt alle dottene, så de hvite kjernene oppå, så kanten ikke tegner ringer
  // inne i dampen der dottene overlapper.
  const pass = (grad: string) =>
    blobs.map((b, i) => (
      <ellipse
        key={`${grad}${i}`}
        cx={r2(b.cx)}
        cy={r2(b.cy)}
        rx={r2(b.rx)}
        ry={r2(b.ry)}
        transform={`rotate(${r2(b.rot)} ${r2(b.cx)} ${r2(b.cy)})`}
        fill={`url(#${id}-${grad})`}
        opacity={r2(b.op)}
      />
    ));
  return (
    <g aria-hidden>
      <RadialGradient
        id={`${id}-e`}
        stops={[
          [0, LAB.steamEdge, 0.55],
          [0.72, LAB.steamEdge, 0.42],
          [1, LAB.steamEdge, 0],
        ]}
      />
      <RadialGradient
        id={`${id}-c`}
        fx={0.42}
        fy={0.38}
        stops={[
          [0, LAB.steam, 0.95],
          [0.45, LAB.steam, 0.88],
          [0.78, LAB.steam, 0.3],
          [1, LAB.steam, 0],
        ]}
      />
      <LinearGradient
        id={`${id}-t`}
        userSpace
        x1={r2(x)}
        y1={r2(y)}
        x2={r2(x)}
        y2={r2(y - wispH)}
        stops={[
          [0, LAB.steam, 0],
          [0.3, LAB.steam, 0.8 * dens],
          [1, LAB.steam, 0.15 * dens],
        ]}
      />
      <path d={wisp} fill="none" stroke={`url(#${id}-t)`} strokeWidth={r2(Math.max(sw(1.4), bredde * 0.09 * grow))} strokeLinecap="round" strokeLinejoin="round" />
      {pass('e')}
      {pass('c')}
    </g>
  );
}

/** Tekst inne i en gjenstand (lokale enheter, vokser ikke på mobil, ingen glorie). */
export function ObjText({
  x,
  y,
  size,
  children,
  fill,
  anchor = 'middle',
  weight = 650,
  mono,
  rotate,
}: {
  x: number;
  y: number;
  size: number;
  children: ReactNode;
  fill: string;
  anchor?: 'start' | 'middle' | 'end';
  weight?: number;
  mono?: boolean;
  rotate?: number;
}) {
  return (
    <text
      x={r2(x)}
      y={r2(y)}
      textAnchor={anchor}
      transform={rotate ? `rotate(${rotate} ${r2(x)} ${r2(y)})` : undefined}
      style={{ fontSize: r2(size), fontWeight: weight, fill, fontFamily: mono ? 'var(--mono)' : undefined, letterSpacing: mono ? '-0.02em' : undefined }}
      aria-hidden
    >
      {children}
    </text>
  );
}
