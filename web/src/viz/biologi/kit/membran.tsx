/**
 * Cellemembranen i nærbilde: et lipiddobbeltlag (fosfolipider med hydrofile hoder og hydrofobe haler) med
 * transportproteiner, og partikler som krysser membranen (styrt av tida t og en plan fra transport.ts).
 *
 *   <Membran x={400} y={60} length={280} vertical skip={[[170, 230]]} />
 *   <Kanalprotein x={400} y={200} vertical />
 *   <MembranPartikler tracks={tracks} t={clock.t} geometry={geom} fill={BIO.opplost} />
 *
 * Alt tegnes vannrett med side A (utsiden) over membranen og side B (cytoplasma) under. Med `vertical` dreies
 * figuren, og da er A til venstre og B til høyre (som i transport.ts).
 */
import type { ReactNode } from 'react';
import { VIZ } from '../../kit';
import { BIO } from './colors';
import { DIM_OPACITY, Halo, useLineScale, type MarkProps } from './felles';
import { trackPosition, type CrossingGeometry, type Track } from './transport';

/** Standard tykkelse på membranen (figurenheter). */
export const MEMBRANE_THICKNESS = 44;

/** Bredden et protein tar i membranen, som andel av membrantykkelsen. Bruk til `skip` i <Membran>. */
export const PROTEIN_WIDTH = { kanal: 1.25, akvaporin: 1.1, baerer: 1.35, pumpe: 1.75, reseptor: 0.95 } as const;

/** Område langs membranen uten lipider (der proteinet står): [fra, til] i figurens koordinater langs membranen. */
export function proteinSlot(center: number, kind: keyof typeof PROTEIN_WIDTH, thickness = MEMBRANE_THICKNESS): [number, number] {
  const half = (PROTEIN_WIDTH[kind] * thickness) / 2 + 2;
  return [center - half, center + half];
}

function Orient({ x, y, vertical, dim, children }: { x: number; y: number; vertical?: boolean; dim?: boolean; children: ReactNode }) {
  return (
    <g transform={`translate(${x} ${y})${vertical ? ' rotate(-90)' : ''}`} opacity={dim ? DIM_OPACITY : undefined}>
      {children}
    </g>
  );
}

export interface MembranProps {
  /** Midtpunktet av membranstykket. */
  x: number;
  y: number;
  /** Lengden langs membranen. */
  length: number;
  thickness?: number;
  /** Loddrett membran (A til venstre, B til høyre). */
  vertical?: boolean;
  /**
   * Områder uten lipider der proteiner skal stå, i figurens koordinater langs membranen (x for vannrett, y for
   * loddrett), f.eks. `[proteinSlot(400, 'kanal')]`.
   */
  skip?: readonly (readonly [number, number])[];
  highlight?: boolean;
  dim?: boolean;
}

/** Lipiddobbeltlag: to rader fosfolipider med hodene ut mot vannet og halene inn mot hverandre. */
export function Membran({ x, y, length, thickness = MEMBRANE_THICKNESS, vertical, skip = [], highlight, dim }: MembranProps) {
  const lw = useLineScale();
  const T = thickness;
  const rh = T * 0.13;
  const step = 2 * rh + 1.6;
  const n = Math.max(1, Math.floor(length / step));
  const start = -((n - 1) * step) / 2;
  // `skip` er i figurkoordinater; regn om til lokal koordinat langs membranen (snudd ved rotasjon −90°)
  const center = vertical ? y : x;
  const blocked = (u: number) => {
    const global = vertical ? center - u : center + u;
    return skip.some(([a, b]) => global >= Math.min(a, b) - rh && global <= Math.max(a, b) + rh);
  };
  const tail = T / 2 - 2 * rh - 0.5;
  const lipids: ReactNode[] = [];
  for (let i = 0; i < n; i++) {
    const u = start + i * step;
    if (blocked(u)) continue;
    for (const side of [-1, 1]) {
      const hy = side * (T / 2 - rh);
      const ty = hy - side * rh;
      lipids.push(
        <g key={`${i}${side}`}>
          <path
            d={`M${u - rh * 0.35},${ty} q${-rh * 0.25},${-side * tail * 0.5} 0,${-side * tail} M${u + rh * 0.35},${ty} q${rh * 0.25},${-side * tail * 0.5} 0,${-side * tail}`}
            fill="none"
            stroke={BIO.lipidHale}
            strokeWidth={1.2 * lw}
            strokeLinecap="round"
          />
          <circle cx={u} cy={hy} r={rh} fill={BIO.lipidHode} />
        </g>,
      );
    }
  }
  const half = (n * step) / 2;
  const outline = `M${-half},${-T / 2} H${half} V${T / 2} H${-half} Z`;
  return (
    <Orient x={x} y={y} vertical={vertical} dim={dim}>
      {highlight && <Halo d={outline} color={BIO.membran} width={10} />}
      {lipids}
    </Orient>
  );
}

/** Felles egenskaper for proteiner i membranen. */
export interface ProteinProps extends MarkProps {
  /** Midt i membranen. */
  x: number;
  y: number;
  thickness?: number;
  vertical?: boolean;
}

function proteinStyle(lw: number) {
  return { fill: BIO.protein.fill, stroke: BIO.protein.line, strokeWidth: 1.6 * lw, strokeLinejoin: 'round' as const };
}

/**
 * Kanalprotein: to halvdeler med en pore imellom som bestemte ioner eller molekyler kan diffundere gjennom
 * (fasilitert diffusjon). `open={false}` lukker poren.
 */
export function Kanalprotein({
  x,
  y,
  thickness = MEMBRANE_THICKNESS,
  vertical,
  open = true,
  highlight,
  dim,
}: ProteinProps & { open?: boolean }) {
  const lw = useLineScale();
  const T = thickness;
  const W = PROTEIN_WIDTH.kanal * T;
  const H = T * 1.5;
  const gap = open ? T * 0.3 : T * 0.06;
  const left = `M${-W / 2 + 6},${-H / 2} H${-gap / 2} V${H / 2} H${-W / 2 + 6} Q${-W / 2},${H / 2} ${-W / 2},${H / 2 - 6} V${-H / 2 + 6} Q${-W / 2},${-H / 2} ${-W / 2 + 6},${-H / 2} Z`;
  const right = `M${W / 2 - 6},${-H / 2} H${gap / 2} V${H / 2} H${W / 2 - 6} Q${W / 2},${H / 2} ${W / 2},${H / 2 - 6} V${-H / 2 + 6} Q${W / 2},${-H / 2} ${W / 2 - 6},${-H / 2} Z`;
  return (
    <Orient x={x} y={y} vertical={vertical} dim={dim}>
      {highlight && <Halo d={`${left} ${right}`} color={BIO.protein.line} />}
      <path d={left} {...proteinStyle(lw)} />
      <path d={right} {...proteinStyle(lw)} />
    </Orient>
  );
}

/** Akvaporin: vannkanal med en smal pore (timeglassform) som slipper gjennom vannmolekyler én og én. */
export function Akvaporin({ x, y, thickness = MEMBRANE_THICKNESS, vertical, highlight, dim }: ProteinProps) {
  const lw = useLineScale();
  const T = thickness;
  const W = PROTEIN_WIDTH.akvaporin * T;
  const H = T * 1.5;
  const wide = T * 0.24;
  const narrow = T * 0.07;
  const half = (s: 1 | -1) =>
    `M${s * (W / 2 - 6)},${-H / 2} H${s * wide} Q${s * narrow},0 ${s * wide},${H / 2} H${s * (W / 2 - 6)} Q${s * (W / 2)},${H / 2} ${s * (W / 2)},${H / 2 - 6} V${-H / 2 + 6} Q${s * (W / 2)},${-H / 2} ${s * (W / 2 - 6)},${-H / 2} Z`;
  return (
    <Orient x={x} y={y} vertical={vertical} dim={dim}>
      {highlight && <Halo d={`${half(-1)} ${half(1)}`} color={BIO.protein.line} />}
      <path
        d={`M${-wide},${-H / 2} Q${-narrow},0 ${-wide},${H / 2} H${wide} Q${narrow},0 ${wide},${-H / 2} Z`}
        fill={BIO.vann}
        opacity={0.18}
      />
      <path d={half(-1)} {...proteinStyle(lw)} />
      <path d={half(1)} {...proteinStyle(lw)} />
    </Orient>
  );
}

/**
 * Bæreprotein som skifter form: `state` = 0 er åpent mot side A (utsiden), 1 er åpent mot side B (cytoplasma).
 * Brukes til fasilitert diffusjon (f.eks. glukose) og, med <NaKPumpe>, aktiv transport.
 */
export function Baereprotein({
  x,
  y,
  thickness = MEMBRANE_THICKNESS,
  vertical,
  state = 0,
  highlight,
  dim,
  width,
}: ProteinProps & { state?: number; width?: number }) {
  const lw = useLineScale();
  const T = thickness;
  const W = width ?? PROTEIN_WIDTH.baerer * T;
  const H = T * 1.55;
  const s = Math.min(1, Math.max(0, state));
  const open = T * 0.34;
  const shut = T * 0.04;
  const cTop = open + (shut - open) * s;
  const cBot = shut + (open - shut) * s;
  const lobe = (k: 1 | -1) =>
    `M${k * (W / 2 - 8)},${-H / 2} H${k * cTop} L${k * (T * 0.08)},0 L${k * cBot},${H / 2} H${k * (W / 2 - 8)} Q${k * (W / 2)},${H / 2} ${k * (W / 2)},${H / 2 - 8} V${-H / 2 + 8} Q${k * (W / 2)},${-H / 2} ${k * (W / 2 - 8)},${-H / 2} Z`;
  return (
    <Orient x={x} y={y} vertical={vertical} dim={dim}>
      {highlight && <Halo d={`${lobe(-1)} ${lobe(1)}`} color={BIO.protein.line} />}
      <path d={lobe(-1)} {...proteinStyle(lw)} />
      <path d={lobe(1)} {...proteinStyle(lw)} />
    </Orient>
  );
}

/**
 * Natrium-kalium-pumpe (aktiv transport): pumper 3 Na⁺ ut og 2 K⁺ inn for hvert ATP. Som et bæreprotein med
 * `state` (0 = åpen mot utsiden, 1 = åpen mot cytoplasma); `fosfat` viser fosfatgruppen fra ATP på innsiden.
 */
export function NaKPumpe({
  x,
  y,
  thickness = MEMBRANE_THICKNESS,
  vertical,
  state = 0,
  fosfat = false,
  highlight,
  dim,
}: ProteinProps & { state?: number; fosfat?: boolean }) {
  const lw = useLineScale();
  const T = thickness;
  const W = PROTEIN_WIDTH.pumpe * T;
  return (
    <g>
      <Baereprotein x={x} y={y} thickness={T} vertical={vertical} state={state} width={W} highlight={highlight} dim={dim} />
      {fosfat && (
        <Orient x={x} y={y} vertical={vertical} dim={dim}>
          <circle cx={W * 0.3} cy={T * 0.78 + 5} r={T * 0.13} fill={BIO.atp} stroke={VIZ.surface} strokeWidth={1.2 * lw} />
        </Orient>
      )}
    </g>
  );
}

/**
 * Reseptor: protein gjennom membranen med et bindingssete på utsiden (side A). Med `bound` sitter et signalstoff
 * (hormon, nevrotransmitter) i setet.
 */
export function Reseptor({
  x,
  y,
  thickness = MEMBRANE_THICKNESS,
  vertical,
  bound = false,
  highlight,
  dim,
}: ProteinProps & { bound?: boolean }) {
  const lw = useLineScale();
  const T = thickness;
  const W = PROTEIN_WIDTH.reseptor * T;
  const H = T * 1.2;
  const cup = T * 0.55;
  const body = `M${-W / 2},${-H / 2} V${H / 2 + T * 0.15} Q${-W / 2},${H / 2 + T * 0.32} ${-W / 4},${H / 2 + T * 0.32} H${W / 4} Q${W / 2},${H / 2 + T * 0.32} ${W / 2},${H / 2 + T * 0.15} V${-H / 2} L${W / 2 + cup * 0.35},${-H / 2 - cup} H${W * 0.16} L${0},${-H / 2 - cup * 0.25} L${-W * 0.16},${-H / 2 - cup} H${-W / 2 - cup * 0.35} Z`;
  return (
    <Orient x={x} y={y} vertical={vertical} dim={dim}>
      {highlight && <Halo d={body} color={BIO.protein.line} />}
      <path d={body} {...proteinStyle(lw)} />
      {bound && (
        <path
          d={`M0,${-H / 2 - cup * 0.3} l${W * 0.15},${-cup * 0.5} l${-W * 0.15},${-cup * 0.5} l${-W * 0.15},${cup * 0.5} Z`}
          fill={BIO.signal}
          stroke={VIZ.surface}
          strokeWidth={1 * lw}
        />
      )}
    </Orient>
  );
}

/* ---------- Partikler som krysser ---------- */

export interface MembranPartiklerProps {
  /** Planen fra `planCrossings`. */
  tracks: readonly Track[];
  /** Tid (fra useSimClock). */
  t: number;
  geometry: CrossingGeometry;
  fill: string;
  /** Kantfarge (standard VIZ.surface, så partiklene skiller seg fra hverandre). */
  line?: string;
  /** Egen tegning per partikkel i stedet for en sirkel. */
  render?: (p: { x: number; y: number; r: number; id: number; inMembrane: boolean }) => ReactNode;
  /** Marker partikler som er inne i membranen akkurat nå (standard true). */
  markCrossing?: boolean;
}

/** Tegner alle partiklene der de er ved tiden t. Partikler som er midt i membranen får en ring. */
export function MembranPartikler({ tracks, t, geometry, fill, line = VIZ.surface, render, markCrossing = true }: MembranPartiklerProps) {
  const lw = useLineScale();
  const r = geometry.r;
  return (
    <g>
      {tracks.map((tr) => {
        const p = trackPosition(tr, t, geometry);
        if (render) return <g key={tr.id}>{render({ x: p.x, y: p.y, r, id: tr.id, inMembrane: p.inMembrane })}</g>;
        return (
          <g key={tr.id}>
            {markCrossing && p.inMembrane && (
              <circle cx={p.x} cy={p.y} r={r + 3.5} fill="none" stroke={fill} strokeWidth={1.4 * lw} opacity={0.7} />
            )}
            <circle cx={p.x} cy={p.y} r={r} fill={fill} stroke={line} strokeWidth={1.2 * lw} />
          </g>
        );
      })}
    </g>
  );
}
