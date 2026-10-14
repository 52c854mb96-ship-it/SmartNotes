import { useId, type KeyboardEvent } from 'react';
import type { PracticeMode } from '../db';
import { MODE_HINT, MODE_LABEL, MODES } from './labels';

/**
 * «Øvingsform» øverst på fanen «Øv»: en radiogruppe med piltaster (som `ThemeSwitch`) og én linje om formen under.
 * Et nytt valg starter en ny runde i den formen. `fromPointer` er sann for et klikk eller trykk (ikke tastaturet), så
 * øvingen kan flytte fokus ut av velgeren.
 *
 * En form i `unavailable` (Flervalg uten kort med svaralternativer) kan ikke velges: den vises dempet med
 * `aria-disabled`, piltastene hopper over den, og et trykk på den gir `onUnavailable` (forklaringen) i stedet for et
 * bytte. Formen som er valgt, er alltid tilgjengelig.
 */
export function ModePicker({
  mode,
  onChange,
  unavailable,
  onUnavailable,
}: {
  mode: PracticeMode;
  onChange: (mode: PracticeMode, fromPointer: boolean) => void;
  unavailable?: ReadonlySet<PracticeMode>;
  onUnavailable?: (mode: PracticeMode) => void;
}) {
  const labelId = useId();
  const hintId = useId();
  const off = (m: PracticeMode) => m !== mode && !!unavailable?.has(m);
  const usable = MODES.filter((m) => !off(m));

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const i = usable.indexOf(mode);
    let next = -1;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = (i + 1) % usable.length;
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = (i - 1 + usable.length) % usable.length;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = usable.length - 1;
    if (next < 0) return;
    e.preventDefault();
    const value = usable[next]!;
    onChange(value, false);
    e.currentTarget.querySelector<HTMLElement>(`[data-value="${value}"]`)?.focus();
  };

  return (
    <div className="fc-mode">
      <span id={labelId} className="fc-mode-label">
        Øvingsform
      </span>
      <div
        role="radiogroup"
        aria-labelledby={labelId}
        aria-describedby={hintId}
        className="segmented fc-mode-switch"
        onKeyDown={onKeyDown}
      >
        {MODES.map((m) => (
          <button
            key={m}
            type="button"
            role="radio"
            aria-checked={m === mode}
            aria-disabled={off(m) || undefined}
            tabIndex={m === mode ? 0 : -1}
            data-value={m}
            className="segment"
            // Mellomrom og Enter på knappen gir et klikk med `detail` 0: da blir fokus stående i velgeren.
            onClick={(e) => (off(m) ? onUnavailable?.(m) : onChange(m, e.detail > 0))}
          >
            {MODE_LABEL[m]}
          </button>
        ))}
      </div>
      <p id={hintId} className="fc-mode-hint">
        {MODE_HINT[mode]}
      </p>
    </div>
  );
}
