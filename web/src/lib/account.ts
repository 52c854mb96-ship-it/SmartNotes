import type { AuthUser } from '@smartnotes/shared';
import { createStore } from './store';

/** Eieren er alltid bruker 1 (serveren ga eieren alle data fra før kontoene). */
export const OWNER_ID = 1;

/**
 * Kontoen appen er logget inn som. Den lagres i Dexie (`META.account`), så den er kjent også uten nett, og sendes med
 * hver forespørsel (`X-SmartNotes-Account`). Da merker serveren det hvis en annen fane har logget inn med en annen konto.
 */
export const accountStore = createStore<AuthUser | null>(null);

export function useAccount(): AuthUser | null {
  return accountStore.use();
}

export function useIsOwner(): boolean {
  return accountStore.use()?.plan === 'owner';
}

/**
 * Hva som skal skje med de lokale dataene når `userId` logger inn på en enhet der `stored` sist var logget inn.
 * - `keep`: samme konto, eller en enhet uten lagret konto der det er eieren som logger inn (eierens enheter fra før
 *   kontoene). Alt beholdes, også opplastingskøen.
 * - `replace`: en annen konto. De lokale dataene tilhører den forrige og må slettes før noe hentes.
 *
 * Tenk på det som en delt pult på biblioteket: sitter du der selv igjen, ligger tingene dine der fortsatt, men kommer
 * en annen, må pulten ryddes først.
 */
export function accountChange(stored: Pick<AuthUser, 'id'> | null | undefined, userId: number, hasLocalData: boolean): 'keep' | 'replace' {
  if (stored) return stored.id === userId ? 'keep' : 'replace';
  if (!hasLocalData) return 'keep';
  return userId === OWNER_ID ? 'keep' : 'replace';
}

/** Navnet på planen, slik den vises i appen. */
export function planLabel(plan: AuthUser['plan']): string {
  if (plan === 'owner') return 'Eier';
  if (plan === 'pro') return 'Pro';
  return 'Gratis';
}

const RELOAD_KEY = 'smartnotes-account-reload';

/**
 * En annen fane har logget inn med en annen konto (serveren svarte 409). Siden lastes på nytt, så den leser kontoen og
 * dataene som nå ligger i Dexie. Skjer det igjen innen et halvt minutt, lastes den ikke på nytt (ingen løkke), og
 * `false` betyr at brukeren må logge inn.
 */
export function reloadForOtherAccount(): boolean {
  try {
    const last = Number(sessionStorage.getItem(RELOAD_KEY) ?? 0);
    if (Date.now() - last < 30_000) return false;
    sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
  } catch {
    return false;
  }
  window.location.reload();
  return true;
}
