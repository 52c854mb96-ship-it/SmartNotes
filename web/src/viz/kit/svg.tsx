import type { ReactNode } from 'react';
import { VIZ } from './colors';
import { useTextScale } from './controls';
import { fmt } from './format';

/** Lineær skala fra domene (fysiske verdier) til område (SVG-koordinater). */
export function scaleLinear(domain: [number, number], range: [number, number]): (v: number) => number {
  const [d0, d1] = domain;
  const [r0, r1] = range;
  const k = d1 === d0 ? 0 : (r1 - r0) / (d1 - d0);
  return (v: number) => r0 + (v - d0) * k;
}

/** «Pene» akseverdier mellom min og max (ca. `count` stykker). */
export function niceTicks(min: number, max: number, count = 5): number[] {
  if (!(max > min)) return [min];
  const raw = (max - min) / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const norm = raw / mag;
  const step = (norm >= 5 ? 10 : norm >= 2 ? 5 : norm >= 1 ? 2 : 1) * mag;
  const ticks: number[] = [];
  for (let v = Math.ceil(min / step) * step; v <= max + step * 1e-9; v += step) ticks.push(Math.round(v / step) * step);
  return ticks;
}

/** SVG-sti gjennom punkter (allerede i fysiske verdier). Hopper over ugyldige punkter. */
export function linePath(points: [number, number][], sx: (v: number) => number, sy: (v: number) => number): string {
  let d = '';
  let pen = false;
  for (const [x, y] of points) {
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      pen = false;
      continue;
    }
    d += `${pen ? 'L' : 'M'}${sx(x).toFixed(2)},${sy(y).toFixed(2)}`;
    pen = true;
  }
  return d;
}

/** Punkter for en funksjon y = f(x) på [x0, x1]. */
export function sample(f: (x: number) => number, x0: number, x1: number, n = 200): [number, number][] {
  const pts: [number, number][] = [];
  for (let i = 0; i <= n; i++) {
    const x = x0 + ((x1 - x0) * i) / n;
    pts.push([x, f(x)]);
  }
  return pts;
}

export interface ArrowProps {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  color?: string;
  width?: number;
  /** Lengden på pilspissen. */
  head?: number;
  dashed?: boolean;
  label?: ReactNode;
  /** Plassering av etiketten (standard: litt forbi spissen). */
  labelX?: number;
  labelY?: number;
  labelAnchor?: 'start' | 'middle' | 'end';
  /** Tegn ingenting når pilen er kortere enn dette (piksler). */
  minLength?: number;
}

/** Kraft- eller hastighetspil. Spissen tegnes som en egen trekant (ingen markers, så fargen følger alltid). */
export function Arrow({
  x1,
  y1,
  x2,
  y2,
  color = VIZ.ink,
  width = 3,
  head = 11,
  dashed,
  label,
  labelX,
  labelY,
  labelAnchor = 'middle',
  minLength = 2,
}: ArrowProps) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy);
  if (!Number.isFinite(len) || len < minLength) return null;
  const ux = dx / len;
  const uy = dy / len;
  const h = Math.min(head, len);
  const bx = x2 - ux * h;
  const by = y2 - uy * h;
  const hw = h * 0.5;
  const points = `${x2},${y2} ${bx - uy * hw},${by + ux * hw} ${bx + uy * hw},${by - ux * hw}`;
  const lx = labelX ?? x2 + ux * 14;
  const ly = labelY ?? y2 + uy * 14 + 5;
  return (
    <g className="viz-arrow">
      <line x1={x1} y1={y1} x2={bx} y2={by} stroke={color} strokeWidth={width} strokeDasharray={dashed ? '6 5' : undefined} />
      <polygon points={points} fill={color} />
      {label !== undefined && (
        <text x={lx} y={ly} textAnchor={labelAnchor} className="viz-label" fill={color}>
          {label}
        </text>
      )}
    </g>
  );
}

/** Tekst i figuren som følger temaet. */
export function Label({
  x,
  y,
  children,
  anchor = 'middle',
  muted,
  size,
  weight,
  color,
}: {
  x: number;
  y: number;
  children: ReactNode;
  anchor?: 'start' | 'middle' | 'end';
  muted?: boolean;
  size?: number;
  weight?: number;
  color?: string;
}) {
  return (
    <text
      x={x}
      y={y}
      textAnchor={anchor}
      className={`viz-label${muted ? ' is-muted' : ''}`}
      style={{ fontSize: size, fontWeight: weight }}
      fill={color}
    >
      {children}
    </text>
  );
}

/** Kloss/legeme med navn, f.eks. «A», «boka». */
export function Block({
  x,
  y,
  w,
  h,
  label,
  strong,
  fill,
  rotate,
}: {
  x: number;
  y: number;
  w: number;
  h: number;
  label?: ReactNode;
  strong?: boolean;
  fill?: string;
  /** Rotasjon i grader om sentrum (f.eks. for skråplan). */
  rotate?: number;
}) {
  const cx = x + w / 2;
  const cy = y + h / 2;
  return (
    <g transform={rotate ? `rotate(${rotate} ${cx} ${cy})` : undefined}>
      <rect x={x} y={y} width={w} height={h} rx={6} fill={fill ?? (strong ? VIZ.bodyStrong : VIZ.body)} className="viz-block" />
      {label !== undefined && (
        <text x={cx} y={cy + 6} textAnchor="middle" className={`viz-block-label${strong ? ' is-strong' : ''}`}>
          {label}
        </text>
      )}
    </g>
  );
}

/** Underlag (bakke/bord) med skravering. */
export function Ground({ x1, x2, y, hatch = true }: { x1: number; x2: number; y: number; hatch?: boolean }) {
  const lines: ReactNode[] = [];
  if (hatch) for (let x = x1; x < x2; x += 16) lines.push(<line key={x} x1={x} y1={y + 12} x2={x + 12} y2={y} className="viz-hatch" />);
  return (
    <g>
      <line x1={x1} y1={y} x2={x2} y2={y} className="viz-ground" />
      {lines}
    </g>
  );
}

export interface AxisSpec {
  min: number;
  max: number;
  /** Aksetittel, f.eks. «dytt F (N)». */
  label: string;
  ticks?: number[];
  /** Desimaler på akseverdiene (standard 0). */
  decimals?: number;
}

/**
 * Koordinatsystem med akser, rutenett og akseverdier. Barna får skalaene:
 *   <Plot x={…} y={…} width={800} height={400}>{({ sx, sy }) => <path d={linePath(pts, sx, sy)} />}</Plot>
 * Plasseres inne i <Figure viewBox="0 0 800 400">.
 */
export function Plot({
  x,
  y,
  width,
  height,
  margin,
  grid = true,
  children,
}: {
  x: AxisSpec;
  y: AxisSpec;
  width: number;
  height: number;
  /** Standard gir plass til akseverdier og aksetitler, og vokser når teksten er større (mobil). */
  margin?: { top: number; right: number; bottom: number; left: number };
  grid?: boolean;
  children: (s: { sx: (v: number) => number; sy: (v: number) => number; x0: number; x1: number; y0: number; y1: number }) => ReactNode;
}) {
  const f = useTextScale();
  const m = margin ?? { top: 20 * f, right: 24 * f, bottom: 56 * f, left: 72 * f };
  const x0 = m.left;
  const x1 = width - m.right;
  const y0 = height - m.bottom;
  const y1 = m.top;
  const sx = scaleLinear([x.min, x.max], [x0, x1]);
  const sy = scaleLinear([y.min, y.max], [y0, y1]);
  const xt = x.ticks ?? niceTicks(x.min, x.max);
  const yt = y.ticks ?? niceTicks(y.min, y.max);
  const zeroY = y.min < 0 && y.max > 0 ? sy(0) : y0;
  const zeroX = x.min < 0 && x.max > 0 ? sx(0) : x0;
  return (
    <g className="viz-plot">
      {grid &&
        yt.map((v) => <line key={`gy${v}`} x1={x0} x2={x1} y1={sy(v)} y2={sy(v)} className="viz-gridline" />)}
      {grid &&
        xt.map((v) => <line key={`gx${v}`} x1={sx(v)} x2={sx(v)} y1={y0} y2={y1} className="viz-gridline" />)}
      <line x1={x0} x2={x1} y1={zeroY} y2={zeroY} className="viz-axis" />
      <line x1={zeroX} x2={zeroX} y1={y0} y2={y1} className="viz-axis" />
      {xt.map((v) => (
        <text key={`tx${v}`} x={sx(v)} y={y0 + 22 * f} textAnchor="middle" className="viz-tick">
          {fmt(v, x.decimals ?? 0)}
        </text>
      ))}
      {yt.map((v) => (
        <text key={`ty${v}`} x={x0 - 10} y={sy(v) + 5 * f} textAnchor="end" className="viz-tick">
          {fmt(v, y.decimals ?? 0)}
        </text>
      ))}
      <text x={(x0 + x1) / 2} y={height - 10} textAnchor="middle" className="viz-axis-label">
        {x.label}
      </text>
      <text x={18 * f} y={(y0 + y1) / 2} textAnchor="middle" className="viz-axis-label" transform={`rotate(-90 ${18 * f} ${(y0 + y1) / 2})`}>
        {y.label}
      </text>
      {children({ sx, sy, x0, x1, y0, y1 })}
    </g>
  );
}

/** Fylt punkt som markerer nåværende tilstand i en graf. */
export function Dot({ x, y, r = 8, color }: { x: number; y: number; r?: number; color?: string }) {
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  return <circle cx={x} cy={y} r={r} className="viz-dot" fill={color} />;
}

/** Sikksakk-fjær mellom to punkter. */
export function Spring({ x1, y1, x2, y2, coils = 8, amplitude = 10 }: { x1: number; y1: number; x2: number; y2: number; coils?: number; amplitude?: number }) {
  const len = Math.hypot(x2 - x1, y2 - y1);
  if (len < 1) return null;
  const ux = (x2 - x1) / len;
  const uy = (y2 - y1) / len;
  const lead = Math.min(14, len * 0.15);
  const pts: string[] = [`${x1},${y1}`, `${x1 + ux * lead},${y1 + uy * lead}`];
  const n = coils * 2;
  for (let i = 1; i < n; i++) {
    const t = lead + ((len - 2 * lead) * i) / n;
    const side = i % 2 === 0 ? -1 : 1;
    pts.push(`${x1 + ux * t - uy * amplitude * side},${y1 + uy * t + ux * amplitude * side}`);
  }
  pts.push(`${x2 - ux * lead},${y2 - uy * lead}`, `${x2},${y2}`);
  return <polyline points={pts.join(' ')} className="viz-spring" />;
}

/**
 * Senket/hevet skrift inne i SVG-tekst: <Label x={…} y={…}>μ<TSub>s</TSub>N</Label>.
 * Grunnlinjen settes tilbake etterpå, så teksten kan fortsette.
 */
export function TSub({ children }: { children: ReactNode }) {
  return (
    <>
      <tspan dy="0.32em" fontSize="0.72em">
        {children}
      </tspan>
      <tspan dy="-0.32em">{'​'}</tspan>
    </>
  );
}

export function TSup({ children }: { children: ReactNode }) {
  return (
    <>
      <tspan dy="-0.45em" fontSize="0.72em">
        {children}
      </tspan>
      <tspan dy="0.45em">{'​'}</tspan>
    </>
  );
}

/** Stiplet ramme rundt det vi ser på som «systemet» (f.eks. i Newtons 2. lov). */
export function Boundary({ x, y, w, h, label }: { x: number; y: number; w: number; h: number; label?: ReactNode }) {
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx={14} className="viz-boundary" />
      {label !== undefined && (
        <text x={x + 12} y={y - 10} className="viz-label is-muted">
          {label}
        </text>
      )}
    </g>
  );
}
