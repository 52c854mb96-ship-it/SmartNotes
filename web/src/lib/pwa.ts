import { registerSW } from 'virtual:pwa-register';
import { RUNNING_BUILD, serverBuildStore } from './build';
import { createStore } from './store';
import { toast } from './ui';

/** Satt når en ny service worker har tatt over – siden lastes på nytt ved neste navigering. */
export const reloadPendingStore = createStore<boolean>(false);

/** Når appen blir synlig igjen, ses det etter en ny versjon høyst så ofte. */
const RECHECK_MS = 5 * 60 * 1000;

/** Versjonen siden sist ble lastet inn på nytt for, i denne fanen. */
const RELOADED_FOR_KEY = 'smartnotes-reloaded-for';

function needReload(): void {
  if (reloadPendingStore.get()) return;
  reloadPendingStore.set(true);
  toast('En ny versjon av SmartNotes er klar.', {
    duration: 0,
    action: { label: 'Oppdater', onClick: () => window.location.reload() },
  });
}

function session(key: string, value?: string): string | null {
  try {
    if (value !== undefined) sessionStorage.setItem(key, value);
    return sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

/**
 * Serveren har en annen versjon enn den som kjører: sørg for at service workeren henter den, vent til den har tatt
 * over, og si fra. Dette fanger også opp oppdateringer service workeren ikke sa fra om i tide.
 */
async function adoptServerBuild(registration: ServiceWorkerRegistration, build: string): Promise<void> {
  // Lastet vi allerede inn på nytt for denne versjonen uten å få den (f.eks. fordi installasjonen feilet), går vi ikke
  // i ring. Service workeren sier uansett fra når den tar over.
  if (reloadPendingStore.get() || session(RELOADED_FOR_KEY) === build) return;
  await registration.update().catch(() => {});
  for (let i = 0; i < 120 && (registration.installing || registration.waiting); i++) {
    await new Promise((r) => setTimeout(r, 1000));
  }
  if (registration.installing || registration.waiting || serverBuildStore.get() !== build) return;
  session(RELOADED_FOR_KEY, build);
  needReload();
}

export function registerPwa(): void {
  if (!('serviceWorker' in navigator)) return;

  // Følg selv med på når en ny service worker tar over. Workbox sier ikke fra hvis nettleseren begynte å installere
  // oppdateringen før siden rakk å registrere seg (Safari på Mac gjør det gjerne når siden lastes på nytt).
  // Første installasjon (ingen styrte siden fra før) er ingen oppdatering.
  let controlled = navigator.serviceWorker.controller !== null;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (controlled) needReload();
    controlled = true;
  });

  registerSW({
    immediate: true,
    onOfflineReady() {
      toast('SmartNotes er klar til bruk offline.', { kind: 'success' });
    },
    onNeedReload: needReload,
    onRegisteredSW(_url, registration) {
      if (!registration) return;

      // Serveren sender byggnummeret sitt med API-svarene (se api.ts). Er det et annet enn vårt, finnes en ny versjon,
      // også om den nye service workeren tok over før siden rakk å lytte.
      const onServerBuild = () => {
        const build = serverBuildStore.get();
        if (RUNNING_BUILD && build && build !== RUNNING_BUILD) void adoptServerBuild(registration, build);
      };
      serverBuildStore.subscribe(onServerBuild);
      onServerBuild();

      let lastCheck = Date.now();
      const check = (minGap: number) => {
        if (!navigator.onLine || Date.now() - lastCheck < minGap) return;
        lastCheck = Date.now();
        registration.update().catch(() => {});
      };
      // Hver time mens appen er åpen, og når den blir synlig igjen: på Mac kan en fane stå åpen i dagevis, og Safari
      // holder igjen tidtakere i faner som ikke vises.
      setInterval(() => check(0), 60 * 60 * 1000);
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') check(RECHECK_MS);
      });
      window.addEventListener('focus', () => check(RECHECK_MS));
      window.addEventListener('online', () => check(RECHECK_MS));
      // Siden kan også komme tilbake fra Safaris tilbake-hurtigbuffer uten å lastes på nytt.
      window.addEventListener('pageshow', (e) => {
        if (e.persisted) check(RECHECK_MS);
      });
    },
  });
}
