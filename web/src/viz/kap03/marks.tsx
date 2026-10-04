import type { ReactNode } from 'react';
import { Arrow as KitArrow, VIZ, type ArrowProps } from '../kit';

/*
 * Lokale varianter av kit-ets merker. I viz.css setter .viz-label og .viz-dot `fill` med CSS, og CSS vinner over
 * SVG-attributtet `fill`, så kit-ets <Label color>, pil-etiketter og <Dot color> blir alltid blekkfarget.
 * Her settes fargen som stil (style.fill), som vinner over klassen.
 */

/** Fylt punkt i en bestemt farge, med kant i bakgrunnsfargen. */
export function ColorDot({ x, y, r = 7, color }: { x: number; y: number; r?: number; color: string }) {
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  return <circle cx={x} cy={y} r={r} fill={color} stroke={VIZ.surface} strokeWidth={2.5} />;
}

/** Som kit-ets <Label>, men `color` virker. */
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
      style={{ fill: color, fontSize: size, fontWeight: weight }}
    >
      {children}
    </text>
  );
}

/** Som kit-ets <Arrow>, men etiketten får samme farge som pilen. */
export function Arrow(props: ArrowProps) {
  const { label, color = VIZ.ink } = props;
  return <KitArrow {...props} label={label === undefined ? undefined : <tspan style={{ fill: color }}>{label}</tspan>} />;
}
