import type { AuthUser } from '@smartnotes/shared';
import { api } from './api';
import { META, getMeta, setMeta } from './db';
import { authStore } from './lib/connectivity';
import { loadAccount, rememberAccount, requestPersistentStorage, startSyncEngine } from './sync';

/**
 * Avgjør innloggingsstatus ved oppstart.
 * Har vi vært innlogget før, åpnes appen med lokale data med en gang (fungerer offline);
 * en eventuell 401 fra serveren sender oss til innlogging senere.
 */
export async function boot(): Promise<void> {
  let loggedIn = false;
  let account: AuthUser | null = null;
  try {
    loggedIn = (await getMeta<boolean>(META.loggedIn)) === true;
    account = await loadAccount();
  } catch {
    loggedIn = false;
  }

  if (loggedIn) {
    authStore.set('ok');
    // Brukernavnet eller planen kan ha endret seg. Er økten en annen konto enn den dataene på enheten tilhører (en
    // annen fane logget inn uten å bli ferdig), må brukeren logge inn igjen, så dataene byttes på riktig måte.
    void api
      .me()
      .then(async (me) => {
        if (!me.user || !account) return;
        if (me.user.id === account.id) await rememberAccount(me.user);
        else authStore.set('required');
      })
      .catch(() => undefined);
  } else {
    try {
      const me = await api.me();
      if (me.authenticated && me.user) {
        await setMeta(META.loggedIn, true);
        await rememberAccount(me.user);
        authStore.set('ok');
      } else {
        authStore.set('required');
      }
    } catch {
      authStore.set('required');
    }
  }

  startSyncEngine();
  if (authStore.get() === 'ok') void requestPersistentStorage();
}
