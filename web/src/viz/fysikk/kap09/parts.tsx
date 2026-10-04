/** Små byggeklosser som kit-et mangler (lokale for kapittel 9). */
import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { Pause, Play, RotateCcw } from 'lucide-react';
import type { SimClock } from '../../kit';

/**
 * Tekst i figuren i en bestemt farge. Kit-ets <Label color> blir alltid blekkfarget fordi .viz-label i viz.css
 * overstyrer fill-attributtet, så fargen settes som stil her.
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

/** Nedtrekksliste i verktøyraden, f.eks. «Velg stjerne». Bruker appens vanlige <select>-stil. */
export function Select<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  const id = useId();
  return (
    <label htmlFor={id} className="viz-toggle" style={{ flexWrap: 'wrap', cursor: 'default' }}>
      <span>{label}</span>
      <select id={id} value={value} onChange={(e) => onChange(e.currentTarget.value as T)} style={{ width: 'auto', maxWidth: '100%' }}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

/**
 * Om elementet er smalere enn `limit` piksler (mobil eller smal kolonne). Brukes til å velge en høyere
 * viewBox når teksten i SVG-en blir stor, så figurene ikke blir trange.
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

/** Omtrentlig bredde (figurenheter) av en etikett med `chars` tegn ved tekstskala `f`. */
export const textWidth = (chars: number, f = 1): number => chars * 9.6 * f;

/**
 * Som <PlayControls> i kit-et, men med egen tekst i stedet for «t = … s» (klokka her teller stadier, ikke sekunder).
 */
export function PlayBar({ clock, status }: { clock: SimClock; status: ReactNode }) {
  return (
    <div className="viz-play">
      <button type="button" className="btn btn-sm" onClick={clock.toggle} aria-pressed={clock.playing}>
        {clock.playing ? <Pause size={16} aria-hidden /> : <Play size={16} aria-hidden />}
        {clock.playing ? 'Pause' : 'Spill av livet'}
      </button>
      <button type="button" className="btn btn-sm btn-ghost" onClick={clock.reset}>
        <RotateCcw size={16} aria-hidden />
        Start på nytt
      </button>
      <span className="viz-play-time" aria-live="off">
        {status}
      </span>
    </div>
  );
}
