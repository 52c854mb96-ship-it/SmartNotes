import { Children, createContext, useContext, useEffect, useId, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { fmt } from './format';

/** Ramme rundt én visualisering: kontroller øverst, figur i midten, avlesninger og forklaring under. */
export function VizLayout({ children }: { children: ReactNode }) {
  return <div className="viz">{children}</div>;
}

/** Rutenett for glidebrytere (etikett · skinne · verdi). */
export function Controls({ children }: { children: ReactNode }) {
  return <div className="viz-controls">{children}</div>;
}

export interface SliderProps {
  label: ReactNode;
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  step?: number;
  /** Enhet som vises etter verdien, f.eks. «N» eller «kg». */
  unit?: string;
  /** Antall desimaler i verdien som vises. */
  decimals?: number;
  /** Egen visning av verdien (overstyrer unit/decimals). */
  format?: (value: number) => string;
  /** Tekst for skjermlesere når etiketten er en formel, f.eks. «Masse til kloss A». */
  ariaLabel?: string;
}

export function Slider({ label, value, onChange, min, max, step = 1, unit = '', decimals = 0, format, ariaLabel }: SliderProps) {
  const id = useId();
  const shown = format ? format(value) : `${fmt(value, decimals)}${unit ? ` ${unit}` : ''}`;
  const pct = max > min ? ((value - min) / (max - min)) * 100 : 0;
  return (
    <div className="viz-slider">
      <label htmlFor={id} className="viz-slider-label">
        {label}
      </label>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        aria-label={ariaLabel}
        aria-valuetext={shown}
        style={{ '--pct': `${pct}%` } as CSSProperties}
        onChange={(e) => onChange(Number(e.currentTarget.value))}
      />
      <output htmlFor={id} className="viz-slider-value">
        {shown}
      </output>
    </div>
  );
}

export interface SegmentedOption<T extends string> {
  value: T;
  label: ReactNode;
}

/** Knapperad der én er valgt (f.eks. «Hele systemet · Kloss A · Kloss B»). */
export function Segmented<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  /** Usynlig etikett for skjermlesere, f.eks. «Velg visning». */
  label: string;
  options: SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div className="viz-segmented" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={o.value === value}
          className={o.value === value ? 'is-on' : undefined}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Av/på-bryter, f.eks. «Med luftmotstand». */
export function Toggle({ label, checked, onChange }: { label: ReactNode; checked: boolean; onChange: (checked: boolean) => void }) {
  const id = useId();
  return (
    <label className="viz-toggle" htmlFor={id}>
      <input id={id} type="checkbox" role="switch" checked={checked} onChange={(e) => onChange(e.currentTarget.checked)} />
      <span className="viz-toggle-track" aria-hidden />
      <span>{label}</span>
    </label>
  );
}

/** Rad med knapper og brytere under glidebryterne. */
export function Toolbar({ children }: { children: ReactNode }) {
  return <div className="viz-toolbar">{children}</div>;
}

const TextScaleContext = createContext(1);

/**
 * Hvor mye større teksten i figuren er enn normalt (1 på PC, ca. 1,8 på mobil).
 * Bruk den til å gi etiketter mer plass, f.eks. `y={y0 + 22 * useTextScale()}`. <Plot> gjør dette selv.
 */
export function useTextScale(): number {
  return useContext(TextScaleContext);
}

/**
 * Responsiv SVG-figur. Tegn i et fast koordinatsystem (viewBox) – figuren skaleres til bredden.
 * `label` beskriver figuren for skjermlesere.
 *
 * Figuren måler hvor mye den er skalert ned (`--viz-scale`), og viz.css gjør teksten større i SVG-en
 * når figuren er smal (mobil), så etikettene alltid kan leses. Sett av litt luft rundt etikettene.
 */
export function Figure({
  viewBox,
  label,
  children,
  caption,
  maxHeight,
}: {
  viewBox: string;
  label: string;
  children: ReactNode;
  caption?: ReactNode;
  /** Største høyde i px (standard 440). */
  maxHeight?: number;
}) {
  const ref = useRef<SVGSVGElement>(null);
  const [textScale, setTextScale] = useState(1);
  const vbWidth = Number(viewBox.split(/[\s,]+/)[2]) || 800;
  useEffect(() => {
    const svg = ref.current;
    if (!svg || typeof ResizeObserver === 'undefined') return;
    const update = () => {
      const w = svg.getBoundingClientRect().width;
      if (w <= 0) return;
      const scale = w / vbWidth;
      svg.style.setProperty('--viz-scale', String(scale));
      // Samme regel som i viz.css: etiketter er minst 12,5 px på skjermen (ellers 17 i figurens enheter).
      setTextScale(Math.round(Math.max(1, 12.5 / 17 / scale) * 20) / 20);
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(svg);
    return () => ro.disconnect();
  }, [vbWidth]);
  return (
    <figure className="viz-figure">
      <svg
        ref={ref}
        viewBox={viewBox}
        role="img"
        aria-label={label}
        style={maxHeight ? { maxHeight } : undefined}
        preserveAspectRatio="xMidYMid meet"
      >
        <TextScaleContext.Provider value={textScale}>{children}</TextScaleContext.Provider>
      </svg>
      {caption && <figcaption>{caption}</figcaption>}
    </figure>
  );
}

/** Store tall under figuren, f.eks. «Normalkraft N = mg · 58,9 N». */
export function Readouts({ children }: { children: ReactNode }) {
  return <dl className="viz-readouts">{children}</dl>;
}

export function Readout({ label, value, unit, tone }: { label: ReactNode; value: string; unit?: string; tone?: string }) {
  return (
    <div className="viz-readout">
      <dt>{label}</dt>
      <dd style={tone ? { color: tone } : undefined}>
        {value}
        {unit && <span className="viz-readout-unit">{' '}{unit}</span>}
      </dd>
    </div>
  );
}

/** Utregning med levende tall. Hver barn-node er én linje. */
export function Formula({ children, label }: { children: ReactNode; label?: string }) {
  return (
    <div className="viz-formula" aria-label={label}>
      {children}
    </div>
  );
}

export function FormulaLine({ children }: { children: ReactNode }) {
  return <div className="viz-formula-line">{Children.map(children, wrapRoot)}</div>;
}

/** Matematikkfontene tegner √ lavt (laget for rottegn med strek over), så √ settes med vanlig skrift. */
function wrapRoot(child: ReactNode): ReactNode {
  if (typeof child !== 'string' || !child.includes('√')) return child;
  return child.split('√').flatMap((part, i) => (i === 0 ? [part] : [<span key={i} className="viz-root">√</span>, part]));
}

/** Indeks i formler: <Sub>A</Sub> → m_A. */
export function Sub({ children }: { children: ReactNode }) {
  return <sub>{children}</sub>;
}

export function Sup({ children }: { children: ReactNode }) {
  return <sup>{children}</sup>;
}

/** Forklarende tekst under figuren. */
export function Explain({ children }: { children: ReactNode }) {
  return <div className="viz-explain">{children}</div>;
}

/** Fargeforklaring for kraftpiler eller grafer. */
export function Legend({ items }: { items: { color: string; label: ReactNode; dashed?: boolean }[] }) {
  return (
    <ul className="viz-legend" role="list">
      {items.map((it, i) => (
        <li key={i}>
          <span className={`viz-legend-swatch${it.dashed ? ' is-dashed' : ''}`} style={{ '--c': it.color } as CSSProperties} aria-hidden />
          {it.label}
        </li>
      ))}
    </ul>
  );
}
