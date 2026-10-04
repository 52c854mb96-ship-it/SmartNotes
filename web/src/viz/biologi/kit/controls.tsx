/**
 * Kontroller biologien trenger i tillegg til kit-ets Slider/Segmented/Toggle: forhåndsvalg (f.eks. sykdommer med kjent
 * R₀) og avspillingslinje med egen tidsenhet (døgn, timer, år). Plasser dem i <Toolbar>.
 */
import type { ReactNode } from 'react';
import { Pause, Play, RotateCcw } from 'lucide-react';
import type { SimClock } from '../../kit';

export interface ForvalgOption<T extends string> {
  value: T;
  label: ReactNode;
  /** Liten tekst etter navnet, f.eks. «R₀ ≈ 15». */
  detail?: ReactNode;
}

/**
 * Rad med forhåndsvalg der ingen eller én er valgt, f.eks. sykdommer som setter R₀-glidebryteren. Til forskjell fra
 * <Segmented> kan `value` være null (når glidebryteren er flyttet til en verdi som ikke er et forhåndsvalg).
 *
 *   <Forvalg label="Sykdom" options={[{ value: 'meslinger', label: 'Meslinger', detail: 'R₀ ≈ 15' }]} value={match} onPick={…} />
 */
export function Forvalg<T extends string>({
  label,
  options,
  value,
  onPick,
}: {
  label: string;
  options: ForvalgOption<T>[];
  value: T | null;
  onPick: (value: T) => void;
}) {
  return (
    <div className="bio-presets" role="group" aria-label={label}>
      <span className="bio-presets-label" aria-hidden>
        {label}:
      </span>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          className={`bio-preset${o.value === value ? ' is-on' : ''}`}
          aria-pressed={o.value === value}
          onClick={() => onPick(o.value)}
        >
          <span>{o.label}</span>
          {o.detail !== undefined && <span className="bio-preset-detail">{o.detail}</span>}
        </button>
      ))}
    </div>
  );
}

const prefersReducedMotion = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/**
 * Som <PlayControls> i kit-et, men tida vises med egen tekst og enhet, f.eks. «dag 34» eller «t = 6,5 timer», fordi
 * klokka i biologi ofte teller døgn eller år og ikke sekunder. `time` er ferdig formatert tekst.
 */
export function PlayBar({ clock, time }: { clock: SimClock; time: ReactNode }) {
  return (
    <div className="viz-play">
      <button type="button" className="btn btn-sm" onClick={clock.toggle} aria-pressed={clock.playing}>
        {clock.playing ? <Pause size={16} aria-hidden /> : <Play size={16} aria-hidden />}
        {clock.playing ? 'Pause' : 'Spill av'}
      </button>
      <button type="button" className="btn btn-sm btn-ghost" onClick={clock.reset}>
        <RotateCcw size={16} aria-hidden />
        Start på nytt
      </button>
      <span className="viz-play-time" aria-live="off">
        {time}
      </span>
      {prefersReducedMotion() && <span className="viz-play-note">Animasjoner er redusert i systeminnstillingene.</span>}
    </div>
  );
}
