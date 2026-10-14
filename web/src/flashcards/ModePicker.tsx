import { useId, type KeyboardEvent } from 'react';
import type { PracticeMode } from '../db';
import { MODE_HINT, MODE_LABEL, MODES } from './labels';

/**
 * «Øvingsform» øverst på fanen «Øv»: en radiogruppe med piltaster (som `ThemeSwitch`) og én linje om formen under.
 * Et nytt valg starter en ny runde i den formen.
 */
export function ModePicker({ mode, onChange }: { mode: PracticeMode; onChange: (mode: PracticeMode) => void }) {
  const labelId = useId();
  const hintId = useId();

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const i = MODES.indexOf(mode);
    let next = -1;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = (i + 1) % MODES.length;
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = (i - 1 + MODES.length) % MODES.length;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = MODES.length - 1;
    if (next < 0) return;
    e.preventDefault();
    const value = MODES[next]!;
    onChange(value);
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
            tabIndex={m === mode ? 0 : -1}
            data-value={m}
            className="segment"
            onClick={() => onChange(m)}
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
