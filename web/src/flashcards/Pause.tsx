import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Coffee } from 'lucide-react';

/** Varselet etter 30 minutter øving (`useBreakClock`). */
export function BreakBar({ onPause, onContinue }: { onPause: () => void; onContinue: () => void }) {
  return (
    <div className="fc-breakbar" role="status">
      <span>Du har øvd i 30 minutter. En kort pause hjelper hukommelsen.</span>
      <span className="fc-breakbar-actions">
        <button type="button" className="btn btn-sm btn-primary" onClick={onPause}>
          <Coffee size={16} aria-hidden /> Ta pause
        </button>
        <button type="button" className="btn btn-sm" onClick={onContinue}>
          Fortsett
        </button>
      </span>
    </div>
  );
}

export function PauseOverlay({ since, onResume }: { since: number | null; onResume: () => void }) {
  const [now, setNow] = useState(() => Date.now());
  const ref = useRef<HTMLDialogElement>(null);
  const resume = useRef(onResume);
  resume.current = onResume;
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  // Ekte modal dialog: fokus holdes inne, bakgrunnen kan ikke brukes, og Esc betyr «Fortsett å øve».
  useLayoutEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (!dialog.open) dialog.showModal();
    const onCancel = (e: Event) => {
      e.preventDefault();
      resume.current();
    };
    dialog.addEventListener('cancel', onCancel);
    return () => {
      dialog.removeEventListener('cancel', onCancel);
      if (dialog.open) dialog.close();
    };
  }, []);
  const s = Math.max(0, Math.floor((now - (since ?? now)) / 1000));
  return (
    <dialog ref={ref} className="fc-pause" aria-labelledby="fc-pause-title">
      <h2 id="fc-pause-title">Pause</h2>
      <div className="fc-pause-clock" aria-hidden>
        {Math.floor(s / 60)}:{String(s % 60).padStart(2, '0')}
      </div>
      <p>Se bort fra skjermen, strekk på deg og drikk litt vann. Fremgangen din er lagret.</p>
      <button type="button" className="btn btn-primary btn-lg" onClick={onResume} autoFocus>
        Fortsett å øve
      </button>
    </dialog>
  );
}
