import { useEffect, useId, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { toasterRaiseStore } from '../lib/ui';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg';
  /** Hindrer lukking (Esc/bakgrunn) mens noe pågår. */
  busy?: boolean;
  className?: string;
}

/**
 * Modal basert på native <dialog> (showModal gir fokusfelle, Esc og inert bakgrunn).
 * På smale skjermer vises den som et ark som glir opp nedenfra.
 */
export function Modal({ open, onClose, title, description, children, footer, size = 'md', busy, className }: ModalProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descId = useId();
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const busyRef = useRef(busy);
  busyRef.current = busy;

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
      toasterRaiseStore.set((n) => n + 1);
      // Fokuser feltet som er merket med data-autofocus (ellers første fokuserbare element).
      const target = dialog.querySelector<HTMLElement>('[data-autofocus]');
      target?.focus();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    const onCancel = (e: Event) => {
      e.preventDefault();
      if (!busyRef.current) onCloseRef.current();
    };
    dialog.addEventListener('cancel', onCancel);
    return () => dialog.removeEventListener('cancel', onCancel);
  }, []);

  return (
    <dialog
      ref={ref}
      className={`modal modal-${size}${className ? ` ${className}` : ''}`}
      aria-labelledby={titleId}
      aria-describedby={description ? descId : undefined}
      onMouseDown={(e) => {
        // Klikk på bakgrunnen (selve dialog-elementet utenfor innholdet) lukker.
        if (e.target === ref.current && !busyRef.current) onCloseRef.current();
      }}
    >
      {open && (
        <div className="modal-inner">
          <header className="modal-header">
            <div>
              <h2 id={titleId} className="modal-title">
                {title}
              </h2>
              {description && (
                <p id={descId} className="modal-description">
                  {description}
                </p>
              )}
            </div>
            <button
              type="button"
              className="icon-btn"
              onClick={() => !busy && onClose()}
              aria-label="Lukk"
              disabled={busy}
            >
              <X size={20} aria-hidden />
            </button>
          </header>
          <div className="modal-body">{children}</div>
          {footer && <footer className="modal-footer">{footer}</footer>}
        </div>
      )}
    </dialog>
  );
}
