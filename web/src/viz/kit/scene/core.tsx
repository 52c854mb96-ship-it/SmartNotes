/**
 * Grunnlaget for de illustrerte scenene: lys og skygge (toninger), myke skygger på bakken og skalering på mobil.
 * Alle gjenstander i scene-kit-et bygger på dette, og kapittelmappene kan bruke det til egne gjenstander.
 */
import type { ReactNode } from 'react';
import { useTextScale } from '../controls';
import { useSvgId } from '../ids';
import { SCENE } from './palette';

export { useSvgId };

/** Mørkere utgave av en farge (0 = uendret, 1 = svart). Virker med CSS-variabler, så temaet følger med. */
export function shade(color: string, amount: number): string {
  return `color-mix(in oklab, ${color}, black ${pct(amount)}%)`;
}

/** Lysere utgave av en farge (0 = uendret, 1 = hvit). */
export function tint(color: string, amount: number): string {
  return `color-mix(in oklab, ${color}, white ${pct(amount)}%)`;
}

/** Fargen med gjennomsiktighet `a` (0–1). */
export function alpha(color: string, a: number): string {
  return `color-mix(in srgb, ${color} ${pct(a)}%, transparent)`;
}

/** Blanding av to farger: t = 0 gir a, t = 1 gir b. */
export function mix(a: string, b: string, t: number): string {
  return `color-mix(in oklab, ${a}, ${b} ${pct(t)}%)`;
}

function pct(v: number): number {
  return Math.round(Math.min(1, Math.max(0, Number.isFinite(v) ? v : 0)) * 1000) / 10;
}

/**
 * Hvor mye gjenstander og små detaljer bør forstørres på mobil: 1 på PC, ca. 1,5 på telefon (samme som
 * `useBioScale` og `useAtomScale`). Bare inne i en <Figure>. Teksten vokser av seg selv, gjenstandene gjør det ikke.
 */
export function useSceneScale(): number {
  return Math.max(1, useTextScale() * 0.85);
}

/** Faktor for strektykkelser: 1 på PC, ca. 1,35 på mobil, så tynne streker ikke forsvinner. */
export function useStrokeScale(): number {
  return Math.max(1, useTextScale() * 0.75);
}

export type GradientStop = [offset: number, color: string, opacity?: number];

/**
 * Lineær toning i objektets eget koordinatsystem (0–1). Standard er ovenfra og ned.
 *   const id = useSvgId('kasse');
 *   <LinearGradient id={id} stops={[[0, tint(SCENE.wood, 0.2)], [1, shade(SCENE.wood, 0.2)]]} />
 *   <rect fill={`url(#${id})`} … />
 */
export function LinearGradient({
  id,
  stops,
  x1 = 0,
  y1 = 0,
  x2 = 0,
  y2 = 1,
  userSpace,
}: {
  id: string;
  stops: GradientStop[];
  x1?: number;
  y1?: number;
  x2?: number;
  y2?: number;
  /** Koordinater i figurens enheter i stedet for 0–1 av objektet (f.eks. himmel over hele figuren). */
  userSpace?: boolean;
}) {
  return (
    <defs>
      <linearGradient id={id} x1={x1} y1={y1} x2={x2} y2={y2} gradientUnits={userSpace ? 'userSpaceOnUse' : 'objectBoundingBox'}>
        {stops.map(([offset, color, opacity], i) => (
          <stop key={i} offset={offset} style={{ stopColor: color, stopOpacity: opacity ?? 1 }} />
        ))}
      </linearGradient>
    </defs>
  );
}

/** Radiell toning, f.eks. en kule med lys fra øvre venstre hjørne (`fx`, `fy`) eller en glød rundt en lampe. */
export function RadialGradient({
  id,
  stops,
  cx = 0.5,
  cy = 0.5,
  r = 0.5,
  fx,
  fy,
  userSpace,
}: {
  id: string;
  stops: GradientStop[];
  cx?: number;
  cy?: number;
  r?: number;
  fx?: number;
  fy?: number;
  userSpace?: boolean;
}) {
  return (
    <defs>
      <radialGradient id={id} cx={cx} cy={cy} r={r} fx={fx} fy={fy} gradientUnits={userSpace ? 'userSpaceOnUse' : 'objectBoundingBox'}>
        {stops.map(([offset, color, opacity], i) => (
          <stop key={i} offset={offset} style={{ stopColor: color, stopOpacity: opacity ?? 1 }} />
        ))}
      </radialGradient>
    </defs>
  );
}

/** Toning for et materiale med lys ovenfra: litt lysere øverst, litt mørkere nederst. */
export function materialStops(color: string, strength = 1): GradientStop[] {
  return [
    [0, tint(color, 0.22 * strength)],
    [0.55, color],
    [1, shade(color, 0.22 * strength)],
  ];
}

/** Toning for en kule eller sylinder sett fra siden, med lys fra øvre venstre. Bruk med RadialGradient fx/fy ≈ 0,35. */
export function sphereStops(color: string): GradientStop[] {
  return [
    [0, tint(color, 0.55)],
    [0.45, color],
    [1, shade(color, 0.35)],
  ];
}

/**
 * Myk skygge på underlaget under en gjenstand (en uskarp ellipse). Tegnes før gjenstanden.
 * `cx`, `cy` er midten av kontaktflaten; `rx` halve bredden.
 */
export function ContactShadow({ cx, cy, rx, ry, opacity = 1 }: { cx: number; cy: number; rx: number; ry?: number; opacity?: number }) {
  const id = useSvgId('skygge');
  if (!(rx > 0) || !Number.isFinite(cx) || !Number.isFinite(cy)) return null;
  return (
    <g opacity={opacity} aria-hidden>
      <RadialGradient
        id={id}
        stops={[
          [0, SCENE.shadow],
          [0.6, SCENE.shadow, 0.55],
          [1, SCENE.shadow, 0],
        ]}
      />
      <ellipse cx={cx} cy={cy} rx={rx} ry={ry ?? Math.max(3, rx * 0.16)} fill={`url(#${id})`} />
    </g>
  );
}

/**
 * Gruppe som flyttes, dreies og skaleres rundt et ankerpunkt: <Place x y rotate scale>…</Place>.
 * Barna tegnes med ankerpunktet i (0, 0), f.eks. midt under hjulene på en bil.
 */
export function Place({
  x,
  y,
  rotate,
  scale,
  flip,
  children,
  className,
  opacity,
}: {
  x: number;
  y: number;
  /** Grader med klokka (SVG). */
  rotate?: number;
  scale?: number;
  /** Speilvend vannrett (f.eks. en bil som kjører mot venstre). */
  flip?: boolean;
  children: ReactNode;
  className?: string;
  opacity?: number;
}) {
  const parts = [`translate(${round(x)} ${round(y)})`];
  if (rotate) parts.push(`rotate(${round(rotate)})`);
  if (scale !== undefined && scale !== 1) parts.push(`scale(${round(scale)})`);
  if (flip) parts.push('scale(-1 1)');
  return (
    <g transform={parts.join(' ')} className={className} opacity={opacity}>
      {children}
    </g>
  );
}

function round(v: number): number {
  return Number.isFinite(v) ? Math.round(v * 100) / 100 : 0;
}

/** Felles props for gjenstander i scene-kit-et. Gjenstanden tegnes med ankerpunktet i (x, y). */
export interface SceneObjectProps {
  x: number;
  y: number;
  /** Størrelse i figurens enheter (se hver gjenstand for hva den betyr, ofte bredden). */
  size?: number;
  /** Grader med klokka. */
  rotate?: number;
  /** Speilvend vannrett. */
  flip?: boolean;
  /** Ton ned gjenstanden (f.eks. når kreftene skal fram). */
  dim?: boolean;
  /** Tekst for skjermlesere (<title>). */
  title?: string;
}

/** Gjennomsiktighet for nedtonede gjenstander i scenene. */
export const SCENE_DIM = 0.38;

/**
 * Liten tallgenerator med fast frø (mulberry32) til teksturer og plassering (stjerner, grus, skyer), så figuren og
 * skjermbildene blir like hver gang. Aldri Math.random i scenene.
 */
export function sceneRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
