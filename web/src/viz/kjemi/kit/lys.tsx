/**
 * Lys og materialer for kjemi-kit-et (illustrert realisme): kuler med lys fra øvre venstre, glass med veggtykkelse og
 * refleks, væske med dybde, og myk skygge. Bygger på toningene i scene-kit-et (kit/scene/core.tsx), men bruker bare
 * kjemiens egne farger (--kj-* i styles/viz.css), så lyst og mørkt tema og kjemitemaet følger med.
 * Ingen SVG-filtre: alt er toninger og vanlige figurer.
 */
import { LinearGradient, RadialGradient, alpha, mix, shade, tint, type GradientStop } from '../../kit/scene/core';
import { KJEMI } from './colors';

export { alpha, mix, shade, tint };

/** `color-mix` der andelen kommer fra en CSS-variabel (f.eks. ulik styrke i lyst og mørkt tema). */
function mixVar(a: string, b: string, variable: string): string {
  return `color-mix(in oklab, ${a}, ${b} var(${variable}))`;
}

/**
 * Toning for en atomkule: lyst punkt oppe til venstre, CPK-fargen i midten og en mørkere kant. I lyst tema går kanten
 * mot den mettede kantfargen, i mørkt tema går lyset mot kantfargen (som er lys der). Styrkene er CSS-variabler.
 */
export function atomSphereStops(fill: string, line: string): GradientStop[] {
  const hi = mixVar(mixVar(fill, line, '--kj-sphere-hi-line'), 'white', '--kj-sphere-hi');
  const lo = mixVar(mixVar(fill, line, '--kj-sphere-lo-line'), 'black', '--kj-sphere-lo');
  return [
    [0, hi],
    [0.22, mix(fill, hi, 0.5)],
    [0.62, fill],
    [1, lo],
  ];
}

/** Toning for små, mettede kuler (ioner og molekyler i partikkelbilder, elektroner). */
export function ballStops(fill: string): GradientStop[] {
  return [
    [0, mixVar(fill, 'white', '--kj-ball-hi')],
    [0.6, fill],
    [1, mixVar(fill, 'black', '--kj-ball-lo')],
  ];
}

/** Radiell toning for en kule med lys fra øvre venstre (i kulas eget koordinatsystem). */
export function SphereGradient({ id, stops }: { id: string; stops: GradientStop[] }) {
  return <RadialGradient id={id} cx={0.5} cy={0.5} r={0.5} fx={0.36} fy={0.32} stops={stops} />;
}

/** Glasset sett forfra: tykkere (mer farget) ut mot kantene, nesten klart i midten. Vannrett toning. */
export function GlassBodyGradient({ id }: { id: string }) {
  const g = KJEMI.glassTint;
  return (
    <LinearGradient
      id={id}
      x2={1}
      y2={0}
      stops={[
        [0, g, 0.55],
        [0.1, g, 0.2],
        [0.45, g, 0.08],
        [0.8, g, 0.14],
        [1, g, 0.5],
      ]}
    />
  );
}

/**
 * Væske med dybde: et lysere bånd rett under overflaten (lyset fra overflaten) og mørkere mot bunnen. Loddrett toning i
 * væskas eget koordinatsystem; `band` er båndets andel av væskehøyden.
 */
export function LiquidDepthGradient({ id, liquid, band = 0.14 }: { id: string; liquid: string; band?: number }) {
  const b = Math.min(0.5, Math.max(0.02, Number.isFinite(band) ? band : 0.14));
  return (
    <LinearGradient
      id={id}
      stops={[
        [0, tint(liquid, 0.24)],
        [b, liquid],
        [1, shade(liquid, 0.12)],
      ]}
    />
  );
}

/**
 * Væska i et rundt glass: lys fra venstre gir et lyst felt litt inn fra venstre kant og skygge mot begge kantene.
 * Vannrett toning med svart og hvitt som legges oppå væskefargen.
 */
export function LiquidVolumeGradient({ id }: { id: string }) {
  return (
    <LinearGradient
      id={id}
      x2={1}
      y2={0}
      stops={[
        [0, 'black', 0.13],
        [0.1, 'black', 0],
        [0.2, 'white', 0.2],
        [0.34, 'white', 0],
        [0.82, 'black', 0],
        [1, 'black', 0.14],
      ]}
    />
  );
}

/** Glass i en kolbe (kjegle eller kule): svakt farget, tettere ut mot kantene. Radiell toning. */
export function GlassRoundGradient({ id }: { id: string }) {
  const g = KJEMI.glassTint;
  return (
    <RadialGradient
      id={id}
      cx={0.45}
      cy={0.68}
      r={0.62}
      stops={[
        [0, g, 0.05],
        [0.6, g, 0.12],
        [1, g, 0.38],
      ]}
    />
  );
}

/** Væska i en kolbe: lyst felt litt til venstre for midten og mørkere ut mot veggene. Radiell toning oppå væskefargen. */
export function LiquidRoundGradient({ id }: { id: string }) {
  return (
    <RadialGradient
      id={id}
      cx={0.46}
      cy={0.4}
      r={0.7}
      fx={0.36}
      fy={0.3}
      stops={[
        [0, 'white', 0.2],
        [0.4, 'white', 0],
        [0.75, 'black', 0],
        [1, 'black', 0.12],
      ]}
    />
  );
}

/** Refleks i glass: sterkest på midten, blekner mot endene (loddrett eller vannrett). */
export function GlintGradient({ id, horizontal, strength = 1 }: { id: string; horizontal?: boolean; strength?: number }) {
  const g = KJEMI.glassGlint;
  return (
    <LinearGradient
      id={id}
      x2={horizontal ? 1 : 0}
      y2={horizontal ? 0 : 1}
      stops={[
        [0, g, 0],
        [0.18, g, 0.85 * strength],
        [0.7, g, 0.7 * strength],
        [1, g, 0],
      ]}
    />
  );
}

/** Myk skygge under en gjenstand som står på et (usynlig) bord. `cx`, `cy` er midt på bunnen. */
export function SoftShadow({ id, cx, cy, rx, ry }: { id: string; cx: number; cy: number; rx: number; ry: number }) {
  if (!(rx > 0) || !(ry > 0) || !Number.isFinite(cx) || !Number.isFinite(cy)) return null;
  return (
    <g aria-hidden>
      <RadialGradient
        id={id}
        stops={[
          [0, KJEMI.shadow],
          [0.55, KJEMI.shadow, 0.6],
          [1, KJEMI.shadow, 0],
        ]}
      />
      <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill={`url(#${id})`} />
    </g>
  );
}
