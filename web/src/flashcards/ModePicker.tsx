import { useId, type KeyboardEvent } from 'react';
import type { PracticeMode } from '../db';
import { MODE_HINT, MODE_LABEL, MODES } from './labels';

/**
 * «Øvingsform» øverst på fanen «Øv»: en radiogruppe med piltaster (som `ThemeSwitch`) og én linje om formen under.
 * Et nytt valg starter en ny runde i den formen. `fromPointer` er sann for et klikk eller trykk (ikke tastaturet), så
 * øvingen kan flytte fokus ut av velgeren.
 *
 * En form i `unavailable` (Flervalg uten kort med svaralternativer) kan ikke velges: den vises dempet med
 * `aria-disabled`, og et trykk på den (eller mellomrom og Enter) gir `onUnavailable` (forklaringen) i stedet for et
 * bytte. Piltastene, Home og End flytter fokus dit uten å bytte form, så forklaringen kan nås med tastaturet. Formen som
 * er valgt, er alltid tilgjengelig.
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

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    // Fra formen som har fokus: det kan være en form som ikke kan velges (og da ikke er valgt).
    const focused = (e.target as HTMLElement).dataset.value as PracticeMode | undefined;
    const at = MODES.indexOf(focused && MODES.includes(focused) ? focused : mode);
    const n = MODES.length;
    let next = -1;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = (at + 1) % n;
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = (at - 1 + n) % n;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = n - 1;
    if (next < 0) return;
    e.preventDefault();
    const value = MODES[next]!;
    if (!off(value)) onChange(value, false);
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
