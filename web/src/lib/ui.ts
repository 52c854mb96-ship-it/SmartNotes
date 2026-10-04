import { createStore } from './store';

// ---------- Toasts ----------

export type ToastKind = 'info' | 'success' | 'error';

export interface Toast {
  id: number;
  kind: ToastKind;
  text: string;
  action?: { label: string; onClick: () => void };
  duration: number;
}

export const toastStore = createStore<Toast[]>([]);
let toastSeq = 0;

export function toast(
  text: string,
  opts: { kind?: ToastKind; action?: Toast['action']; duration?: number } = {},
): number {
  const id = ++toastSeq;
  const kind = opts.kind ?? 'info';
  const duration = opts.duration ?? (kind === 'error' ? 7000 : 4000);
  toastStore.set((list) => [...list.slice(-3), { id, kind, text, action: opts.action, duration }]);
  if (duration > 0) setTimeout(() => dismissToast(id), duration);
  return id;
}

/** Økes når en modal åpnes, slik at varslene kan legges øverst i «top layer» igjen. */
export const toasterRaiseStore = createStore(0);

export function dismissToast(id: number): void {
  toastStore.set((list) => list.filter((t) => t.id !== id));
}

// ---------- Bekreftelsesdialog ----------

export interface ConfirmRequest {
  title: string;
  body?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  resolve: (ok: boolean) => void;
}

export const confirmStore = createStore<ConfirmRequest | null>(null);

export function confirmDialog(opts: Omit<ConfirmRequest, 'resolve'>): Promise<boolean> {
  return new Promise((resolve) => {
    confirmStore.get()?.resolve(false);
    confirmStore.set({ ...opts, resolve });
  });
}

// ---------- Opplastingsdialog ----------

export interface UploadRequest {
  subjectId?: string;
  chapterId?: string;
  files?: File[];
}

export const uploadStore = createStore<UploadRequest | null>(null);

export function openUpload(req: UploadRequest = {}): void {
  uploadStore.set(req);
}

export function closeUpload(): void {
  uploadStore.set(null);
}

// ---------- Nytt fag ----------

export const newSubjectStore = createStore<boolean>(false);

// ---------- Mobilskuff ----------

export const drawerStore = createStore<boolean>(false);
