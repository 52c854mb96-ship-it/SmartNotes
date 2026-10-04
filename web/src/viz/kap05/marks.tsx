import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Pause, Play, RotateCcw } from 'lucide-react';
import { VIZ, type SimClock } from '../kit';
import { makeParticles, stepParticles, type Particle } from './model';

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

export interface ThermoTick {
  value: number;
  label: string;
}

/**
 * Termometer med søyle. `min`–`max` er skalaen fra bunnen (yBottom) til toppen (yTop) av røret.
 * Akseverdier kan stå på venstre og/eller høyre side, og `marker` tegner en stiplet strek (f.eks. sluttemperaturen).
 */
export function Thermometer({
  x,
  yTop,
  yBottom,
  min,
  max,
  value,
  color,
  left = [],
  right = [],
  marker,
}: {
  x: number;
  yTop: number;
  yBottom: number;
  min: number;
  max: number;
  value: number;
  color: string;
  left?: ThermoTick[];
  right?: ThermoTick[];
  marker?: number;
}) {
  const y = (v: number) => yBottom - ((Math.min(max, Math.max(min, v)) - min) / (max - min)) * (yBottom - yTop);
  const tubeW = 14;
  const bulbR = 15;
  const top = y(value);
  return (
    <g>
      <rect
        x={x - tubeW / 2}
        y={yTop - 10}
        width={tubeW}
        height={yBottom - yTop + 14}
        rx={tubeW / 2}
        fill={VIZ.surface}
        stroke={VIZ.muted}
        strokeWidth={1.5}
      />
      <circle cx={x} cy={yBottom + bulbR} r={bulbR} fill={color} stroke={VIZ.muted} strokeWidth={1.5} />
      <rect x={x - 4} y={top} width={8} height={Math.max(0, yBottom + 6 - top)} rx={3} fill={color} />
      {left.map((t) => (
        <g key={`l${t.value}`}>
          <line x1={x - tubeW / 2 - 6} x2={x - tubeW / 2} y1={y(t.value)} y2={y(t.value)} stroke={VIZ.muted} strokeWidth={1.5} />
          <text x={x - tubeW / 2 - 10} y={y(t.value) + 5} textAnchor="end" className="viz-tick">
            {t.label}
          </text>
        </g>
      ))}
      {right.map((t) => (
        <g key={`r${t.value}`}>
          <line x1={x + tubeW / 2} x2={x + tubeW / 2 + 6} y1={y(t.value)} y2={y(t.value)} stroke={VIZ.muted} strokeWidth={1.5} />
          <text x={x + tubeW / 2 + 10} y={y(t.value) + 5} textAnchor="start" className="viz-tick">
            {t.label}
          </text>
        </g>
      ))}
      {marker !== undefined && Number.isFinite(marker) && (
        <line x1={x - tubeW} x2={x + tubeW} y1={y(marker)} y2={y(marker)} stroke={VIZ.ink} strokeWidth={2} strokeDasharray="4 3" />
      )}
    </g>
  );
}

/** Spill/pause og start på nytt, uten tidsvisning (for animasjoner der tiden ikke er en fysisk størrelse). */
export function PlayToggle({ clock, resetLabel = 'Start på nytt' }: { clock: SimClock; resetLabel?: string }) {
  return (
    <div className="viz-play">
      <button type="button" className="btn btn-sm" onClick={clock.toggle} aria-pressed={clock.playing}>
        {clock.playing ? <Pause size={16} aria-hidden /> : <Play size={16} aria-hidden />}
        {clock.playing ? 'Pause' : 'Spill av'}
      </button>
      <button type="button" className="btn btn-sm btn-ghost" onClick={clock.reset}>
        <RotateCcw size={16} aria-hidden />
        {resetLabel}
      </button>
    </div>
  );
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

export interface GasSim {
  particles: Particle[];
  /** Nylige støt mot stempelet: høyden (andel 0–1) og hvor lenge siden (s). */
  flashes: { w: number; age: number }[];
}

/** Hvor lenge et støt mot stempelet vises (s). */
const FLASH_TIME = 0.35;

/**
 * Partikkelsimulering som følger klokka: hver gang `t` øker, flyttes partiklene fram i korte steg.
 * Ved t = 0 (start eller «Start på nytt») begynner de fra samme frø, så figuren er lik hver gang.
 * `scale` er farten i forhold til referansetemperaturen (√(T/T_ref)), `width` × `height` boksen i piksler.
 */
export function useGasSim(
  t: number,
  {
    count,
    seed,
    speed,
    scale,
    width,
    height,
  }: { count: number; seed: number; speed: number; scale: number; width: number; height: number },
): GasSim {
  const ref = useRef<{ t: number; ps: Particle[]; hits: { w: number; t: number }[] } | null>(null);
  const cur = ref.current;
  if (!cur || t <= 0 || t < cur.t - 1e-9) {
    ref.current = { t, ps: makeParticles(count, seed, speed), hits: [] };
  } else if (t > cur.t) {
    // Lange pauser mellom bildene (f.eks. når fanen var skjult) hoppes over
    let left = Math.min(t - cur.t, 0.1);
    let ps = cur.ps;
    let now = cur.t;
    while (left > 1e-9) {
      const dt = Math.min(0.02, left);
      const r = stepParticles(ps, dt, scale, Math.max(1, width), Math.max(1, height));
      ps = r.particles;
      now += dt;
      for (const w of r.pistonHits) cur.hits.push({ w, t: now });
      left -= dt;
    }
    cur.ps = ps;
    cur.t = t;
    cur.hits = cur.hits.filter((h) => t - h.t < FLASH_TIME);
  }
  const state = ref.current!;
  return { particles: state.ps, flashes: state.hits.map((h) => ({ w: h.w, age: (t - h.t) / FLASH_TIME })) };
}
