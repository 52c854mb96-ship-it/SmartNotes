import type { AuthUser } from '@smartnotes/shared';
import { api } from '../api';
import { accountSwitchInfo, afterLogin, localDataInfo, pauseSync, resumeSync, type AccountSwitchInfo } from '../sync';
import { setSwitching } from './account';
import { authStore } from './connectivity';
import { plural } from './format';
import { confirmDialog } from './ui';

/**
 * Innlogging, registrering og nytt passord på en enhet som kan ha data fra en annen konto. Tenk på det som en delt pult:
 * før en annen setter seg, spør appen om tingene som ligger der kan ryddes bort (de ligger fortsatt på serveren).
 */

function losses(info: Pick<AccountSwitchInfo, 'pendingUploads' | 'pendingProgress'>): string {
  const lost = [
    info.pendingUploads > 0 ? `${plural(info.pendingUploads, 'opplasting', 'opplastinger')} som ikke er sendt, går tapt.` : '',
    info.pendingProgress > 0 ? 'Fremgang fra øving med flashcards som ikke er sendt, går tapt.' : '',
  ].filter(Boolean);
  return lost.length ? ` ${lost.join(' ')}` : '';
}

function owner(info: Pick<AccountSwitchInfo, 'previous'>): string {
  return info.previous ? `«${info.previous.username}»` : 'en annen konto';
}

/**
 * Før registrering eller nytt passord mens en konto er logget inn i appen: spør først (en ny konto er alltid en annen
 * konto), og sett synken på pause, så ingen forespørsel går med den gamle kontoen mens den nye økten settes. Gir
 * `'cancel'` når brukeren vil la være, `'asked'` når brukeren har sagt ja (så `finishLogin` ikke spør igjen), og
 * `'none'` når ingen er logget inn (da spør `finishLogin` om enheten har data fra en annen konto). Feiler forespørselen
 * etter et ja, kalles `cancelSwitch`.
 */
export async function confirmBeforeSwitch(kind: 'register' | 'reset'): Promise<'asked' | 'none' | 'cancel'> {
  if (authStore.get() !== 'ok') return 'none';
  const info = await localDataInfo();
  if (!info.hasData && !info.previous) return 'none';
  const what =
    kind === 'register'
      ? 'Lager du en ny konto, byttes kontoen her'
      : 'Gjelder lenken en annen konto, byttes kontoen her';
  const ok = await confirmDialog({
    title: 'Bytte konto på denne enheten?',
    body: `Du er logget inn som ${owner(info)} på denne enheten. ${what}, og notatene til ${owner(info)} slettes fra enheten. De ligger fortsatt på serveren.${losses(info)}`,
    confirmLabel: kind === 'register' ? 'Bytt konto' : 'Fortsett',
    cancelLabel: 'Avbryt',
    danger: true,
  });
  if (!ok) return 'cancel';
  pauseSync();
  return 'asked';
}

/** Registreringen eller lenken feilet etter `confirmBeforeSwitch`: den gamle økten gjelder fortsatt, så synken fortsetter. */
export function cancelSwitch(): void {
  resumeSync();
}

/**
 * Siste steg etter innlogging, registrering og nytt passord. Har enheten data fra en annen konto, spør appen først
 * (med mindre `asked`), fordi de slettes fra enheten. Sier brukeren nei, logges den nye økten ut igjen, og dataene blir
 * liggende. Gir `'replaced'` når enheten nå har den nye kontoens data, `'kept'` når dataene på enheten ble beholdt, og
 * null når brukeren sa nei.
 */
export async function finishLogin(user: AuthUser, opts: { asked?: boolean } = {}): Promise<'kept' | 'replaced' | null> {
  const info = await accountSwitchInfo(user.id);
  if (info.change === 'replace' && info.hasData && !opts.asked) {
    pauseSync();
    const ok = await confirmDialog({
      title: 'Bytte konto på denne enheten?',
      body: `Enheten har lagret notatene til ${owner(info)}. Logger du inn som «${user.username}», slettes de fra enheten, men de ligger fortsatt på serveren.${losses(info)}`,
      confirmLabel: 'Bytt konto',
      cancelLabel: 'Avbryt',
      danger: true,
    });
    if (!ok) {
      await api.logout().catch(() => undefined);
      // Den nye økten er logget ut, og den forrige ble erstattet av den: ingen er logget inn på enheten nå.
      setSwitching(false);
      authStore.set('required');
      return null;
    }
  }
  return afterLogin(user);
}
