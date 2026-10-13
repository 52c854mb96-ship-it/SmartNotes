import type { AuthUser } from '@smartnotes/shared';
import { api } from '../api';
import { accountSwitchInfo, afterLogin } from '../sync';
import { plural } from './format';
import { confirmDialog } from './ui';

/**
 * Siste steg etter innlogging, registrering og nytt passord. Har enheten data fra en annen konto, spør appen først,
 * fordi de slettes fra enheten (de ligger fortsatt på serveren). Sier brukeren nei, logges den nye økten ut igjen, og
 * dataene blir liggende. Gir `true` når brukeren er logget inn og dataene er hentet.
 */
export async function finishLogin(user: AuthUser): Promise<boolean> {
  const info = await accountSwitchInfo(user.id);
  if (info.change === 'replace' && info.hasData) {
    const owner = info.previous ? `«${info.previous.username}»` : 'en annen konto';
    const losses = [
      info.pendingUploads > 0 ? `${plural(info.pendingUploads, 'opplasting', 'opplastinger')} som ikke er sendt, går tapt.` : '',
      info.pendingProgress > 0 ? 'Fremgang fra øving med flashcards som ikke er sendt, går tapt.' : '',
    ].filter(Boolean);
    const ok = await confirmDialog({
      title: 'Bytte konto på denne enheten?',
      body: `Enheten har lagret notatene til ${owner}. Logger du inn som «${user.username}», slettes de fra enheten, men de ligger fortsatt på serveren.${losses.length ? ` ${losses.join(' ')}` : ''}`,
      confirmLabel: 'Bytt konto',
      cancelLabel: 'Avbryt',
      danger: true,
    });
    if (!ok) {
      await api.logout().catch(() => undefined);
      return false;
    }
  }
  await afterLogin(user);
  return true;
}
