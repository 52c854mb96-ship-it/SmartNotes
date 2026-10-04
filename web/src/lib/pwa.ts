import { registerSW } from 'virtual:pwa-register';
import { createStore } from './store';
import { toast } from './ui';

/** Satt når en ny service worker har tatt over – siden lastes på nytt ved neste navigering. */
export const reloadPendingStore = createStore<boolean>(false);

export function registerPwa(): void {
  if (!('serviceWorker' in navigator)) return;
  registerSW({
    immediate: true,
    onOfflineReady() {
      toast('SmartNotes er klar til bruk offline.', { kind: 'success' });
    },
    onNeedReload() {
      reloadPendingStore.set(true);
      toast('En ny versjon av SmartNotes er klar.', {
        duration: 0,
        action: { label: 'Oppdater', onClick: () => window.location.reload() },
      });
    },
    onRegisteredSW(_url, registration) {
      if (!registration) return;
      // Se etter oppdateringer hver time mens appen er åpen.
      setInterval(() => {
        if (navigator.onLine) registration.update().catch(() => {});
      }, 60 * 60 * 1000);
    },
  });
}
