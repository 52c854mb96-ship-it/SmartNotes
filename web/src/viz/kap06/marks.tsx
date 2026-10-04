import { useEffect, useRef, useState, type ReactNode } from 'react';
import { VIZ } from '../kit';

/**
 * Tekst i en bestemt farge. (Kit-ets <Label color> får alltid blekkfarge fordi .viz-label i viz.css
 * overstyrer fill-attributtet, så fargen settes som stil her.)
 */
export function Tag({
  x,
  y,
  children,
  color,
  anchor = 'middle',
  muted,
  size,
  weight,
}: {
  x: number;
  y: number;
  children: ReactNode;
  color?: string;
  anchor?: 'start' | 'middle' | 'end';
  muted?: boolean;
  size?: number;
  weight?: number;
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

/** Fylt punkt i en bestemt farge (kit-ets <Dot> får alltid blekkfarge). */
export function ColorDot({ x, y, r = 7, color }: { x: number; y: number; r?: number; color: string }) {
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  return <circle cx={x} cy={y} r={r} fill={color} stroke={VIZ.surface} strokeWidth={2.5} />;
}

/**
 * Om elementet er smalere enn `limit` piksler (mobil eller smal kolonne). Brukes til å gi grafer en
 * høyere viewBox når teksten i SVG-en blir stor, så plottene ikke blir flate.
 */
export function useNarrow<T extends HTMLElement>(limit = 560) {
  const ref = useRef<T>(null);
  const [narrow, setNarrow] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const update = () => {
      const w = el.getBoundingClientRect().width;
      if (w > 0) setNarrow(w < limit);
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [limit]);
  return [ref, narrow] as const;
}
