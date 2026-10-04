import type { ReactNode } from 'react';
import { Arrow, Label, VIZ, useTextScale } from '../kit';

/** Høyden på vognkassa og hjulene (piksler). */
export const CART_H = 62;
export const WHEEL_R = 10;

/** Bredden på vogna vokser med massen, så tunge vogner ser tunge ut. */
export function cartWidth(m: number): number {
  return 72 + 20 * m;
}

/** Vogn på skinne: kasse med fargestripe (samme farge som i søylediagrammet), hjul og navn. */
export function Cart({ x, ground, w, color, name }: { x: number; ground: number; w: number; color: string; name: ReactNode }) {
  const top = ground - 2 * WHEEL_R - CART_H;
  return (
    <g>
      <rect x={x} y={top} width={w} height={CART_H} rx={6} fill={VIZ.body} className="viz-block" />
      <rect x={x + 7} y={top + 7} width={w - 14} height={9} rx={4.5} fill={color} />
      <circle cx={x + 20} cy={ground - WHEEL_R} r={WHEEL_R} fill={VIZ.bodyStrong} className="viz-block" />
      <circle cx={x + w - 20} cy={ground - WHEEL_R} r={WHEEL_R} fill={VIZ.bodyStrong} className="viz-block" />
      <text x={x + w / 2} y={top + CART_H / 2 + 14} textAnchor="middle" className="viz-block-label">
        {name}
      </text>
    </g>
  );
}

/** Korteste fartspil (piksler), så en liten fart ikke forsvinner. */
const MIN_ARROW = 9;

/**
 * Fartspil over en vogn. Etiketten står over vogna (ikke ved pilspissen), så to vogner som står inntil
 * hverandre ikke får etiketter oppå hverandre.
 */
export function VelocityArrow({ cx, y, v, pxPerMs, name }: { cx: number; y: number; v: number; pxPerMs: number; name: ReactNode }) {
  const f = useTextScale();
  const labelY = y - 14 - 8 * f;
  // «= 0» bare når farten faktisk er null (avrundet). Små farter får en kort pil, så de ikke ser ut som ro.
  if (Math.abs(v) < 0.005)
    return (
      <Label x={cx} y={labelY} color={VIZ.velocity}>
        {name} = 0
      </Label>
    );
  const len = Math.sign(v) * Math.max(Math.abs(v) * pxPerMs, MIN_ARROW);
  return (
    <>
      <Arrow x1={cx - Math.sign(len) * 6} y1={y} x2={cx + len} y2={y} color={VIZ.velocity} />
      <Label x={cx} y={labelY} color={VIZ.velocity}>
        {name}
      </Label>
    </>
  );
}
