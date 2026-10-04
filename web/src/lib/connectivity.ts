import { createStore } from './store';

export type AuthState = 'checking' | 'ok' | 'required';

/** Innloggingsstatus. 401 fra serveren setter `required` (lokale data beholdes). */
export const authStore = createStore<AuthState>('checking');

export interface ConnectivityState {
  /** navigator.onLine */
  browserOnline: boolean;
  /** false etter en mislykket forespørsel (nettverksfeil), true etter neste vellykkede. */
  serverReachable: boolean;
}

export const connectivityStore = createStore<ConnectivityState>({
  browserOnline: typeof navigator === 'undefined' ? true : navigator.onLine,
  serverReachable: true,
});

export function isOnline(): boolean {
  const s = connectivityStore.get();
  return s.browserOnline && s.serverReachable;
}

export function markReachable(reachable: boolean): void {
  connectivityStore.set((prev) =>
    prev.serverReachable === reachable ? prev : { ...prev, serverReachable: reachable },
  );
}

export function setBrowserOnline(online: boolean): void {
  connectivityStore.set((prev) => ({
    browserOnline: online,
    // Når nettleseren sier at vi er tilbake, antar vi at serveren også er det til det motsatte er bevist.
    serverReachable: online ? true : prev.serverReachable,
  }));
}

/** Hook: { online, reason } der reason skiller mellom «ingen nett» og «server utilgjengelig». */
export function useOnline(): { online: boolean; reason: 'offline' | 'server' | null } {
  const s = connectivityStore.use();
  if (!s.browserOnline) return { online: false, reason: 'offline' };
  if (!s.serverReachable) return { online: false, reason: 'server' };
  return { online: true, reason: null };
}

export function useAuth(): AuthState {
  return authStore.use();
}
