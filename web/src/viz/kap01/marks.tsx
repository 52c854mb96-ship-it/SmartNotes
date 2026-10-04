import { VIZ } from '../kit';

/**
 * Fylt punkt i en bestemt farge. (Kit-ets <Dot> får alltid blekkfarge fordi .viz-dot i viz.css overstyrer fill.)
 */
export function ColorDot({ x, y, r = 7, color }: { x: number; y: number; r?: number; color: string }) {
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  return <circle cx={x} cy={y} r={r} fill={color} stroke={VIZ.surface} strokeWidth={2.5} />;
}
