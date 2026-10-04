import { api } from './api';
import { META, getMeta, setMeta } from './db';
import { authStore } from './lib/connectivity';
import { requestPersistentStorage, startSyncEngine } from './sync';

/**
 * Avgjør innloggingsstatus ved oppstart.
 * Har vi vært innlogget før, åpnes appen med lokale data med en gang (fungerer offline);
 * en eventuell 401 fra serveren sender oss til innlogging senere.
 */
export async function boot(): Promise<void> {
  let loggedIn = false;
  try {
    loggedIn = (await getMeta<boolean>(META.loggedIn)) === true;
  } catch {
    loggedIn = false;
  }

  if (loggedIn) {
    authStore.set('ok');
  } else {
    try {
      const me = await api.me();
      if (me.authenticated) {
        await setMeta(META.loggedIn, true);
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
