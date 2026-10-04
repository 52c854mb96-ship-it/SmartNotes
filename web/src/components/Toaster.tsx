import { useLayoutEffect, useRef } from 'react';
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';
import { dismissToast, toastStore, toasterRaiseStore } from '../lib/ui';

const supportsPopover = typeof HTMLElement !== 'undefined' && 'showPopover' in HTMLElement.prototype;

export function Toaster() {
  const toasts = toastStore.use();
  const raise = toasterRaiseStore.use();
  const ref = useRef<HTMLDivElement>(null);

  // Som popover ligger varslene i «top layer» – over åpne modale dialoger.
  // Vi viser den på nytt ved hvert nytt varsel slik at den havner øverst.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || !supportsPopover) return;
    try {
      if (el.matches(':popover-open')) el.hidePopover();
      if (toasts.length > 0) el.showPopover();
    } catch {
      /* ignorer */
    }
  }, [toasts, raise]);

  return (
    <div
      ref={ref}
      className="toaster"
      role="region"
      aria-label="Varsler"
      popover={supportsPopover ? 'manual' : undefined}
    >
      <div aria-live="polite" className="toaster-list">
        {toasts.map((t) => {
          const Icon = t.kind === 'success' ? CheckCircle2 : t.kind === 'error' ? AlertCircle : Info;
          return (
            <div key={t.id} className={`toast toast-${t.kind}`} role={t.kind === 'error' ? 'alert' : 'status'}>
              <Icon size={18} aria-hidden className="toast-icon" />
              <span className="toast-text">{t.text}</span>
              {t.action && (
                <button
                  type="button"
                  className="toast-action"
                  onClick={() => {
                    t.action?.onClick();
                    dismissToast(t.id);
                  }}
                >
                  {t.action.label}
                </button>
              )}
              <button type="button" className="toast-close" aria-label="Lukk varsel" onClick={() => dismissToast(t.id)}>
                <X size={16} aria-hidden />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
