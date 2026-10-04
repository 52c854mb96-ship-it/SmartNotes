import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';
import { dismissToast, toastStore } from '../lib/ui';

export function Toaster() {
  const toasts = toastStore.use();
  return (
    <div className="toaster" role="region" aria-label="Varsler">
      <div aria-live="polite" aria-atomic="false" className="toaster-list">
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
