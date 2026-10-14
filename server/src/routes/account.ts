import type { FastifyInstance } from 'fastify';
import type { DeleteAccountRequest, LegalInfo } from '@smartnotes/shared';
import { AttemptLimiter, DEVICE_COOKIE, SESSION_COOKIE, requireUser } from '../auth.js';
import type { Config } from '../config.js';
import { OWNER_ID, type Repo } from '../db.js';
import { HttpError, badRequest } from '../errors.js';
import { passwordQueueFull, verifyPassword } from '../passwords.js';
import type { RemoteHub } from '../remote/hub.js';
import type { Storage } from '../storage.js';

/**
 * Personvernerklæringen og vilkårene (det de viser fra serveren), og «Slett konto», som sletter alt brukeren har på
 * serveren. Eieren kan ikke slette sin egen konto.
 */
export function registerAccountRoutes(app: FastifyInstance, d: { repo: Repo; storage: Storage; config: Config; hub?: RemoteHub }): void {
  const { repo, storage, config, hub } = d;
  // Feil passord ved sletting: per bruker, så ingen kan prøve seg fram med en stjålet økt.
  const limiter = new AttemptLimiter(5);

  app.get('/api/legal', async (): Promise<LegalInfo> => ({
    controllerName: config.privacy.controllerName,
    contact: config.privacy.contact,
    minAge: config.accounts.minAge,
    freePagesPerDay: config.quota.pagesPerDay,
    freeDecksPerDay: config.quota.decksPerDay,
  }));

  app.delete<{ Body: DeleteAccountRequest }>('/api/auth/account', async (req, reply) => {
    const user = requireUser(req);
    if (user.id === OWNER_ID) throw badRequest('Eieren kan ikke slette sin egen konto.');
    const key = String(user.id);
    if (limiter.blocked(key)) throw new HttpError(429, 'too_many_attempts', 'For mange feil forsøk. Vent et kvarter og prøv igjen.');
    if (passwordQueueFull()) throw new HttpError(503, 'busy', 'Serveren har mye å gjøre akkurat nå. Prøv igjen om litt.');
    const password = typeof req.body?.password === 'string' ? req.body.password.slice(0, 500) : '';
    // Forsøket telles før passordsjekken (som venter), så forsøk sendt samtidig ikke slipper forbi grensen, som ved
    // innloggingen. Stemmer passordet, gis det tilbake.
    limiter.fail(key);
    // 403, ikke 401: appen tolker 401 som at brukeren er logget ut.
    if (!(await verifyPassword(password, user.password_hash))) throw new HttpError(403, 'wrong_password', 'Feil passord.');
    limiter.refund(key);
    const deleted = repo.deleteUser(user.id);
    if (!deleted) throw badRequest('Kontoen kunne ikke slettes.');
    // Arbeid som venter på hjemmemaskinen for brukeren (notater, kortstokker, innholdsfortegnelser), trengs ikke lenger.
    const notes = new Set(deleted.noteIds);
    hub?.cancel((ref) => ref.userId === user.id || (!!ref.noteId && notes.has(ref.noteId)));
    await Promise.all(deleted.noteIds.map((id) => storage.removeNote(id).catch(() => undefined)));
    // Samle-PDF-ene for kapitlene og fagene. En som lages akkurat nå, fjernes av Bundler når den er ferdig.
    await storage.removeBundles([...deleted.chapterIds.map((id) => `chapter-${id}`), ...deleted.subjectIds.map((id) => `subject-${id}`)]);
    reply.clearCookie(SESSION_COOKIE, { path: '/' });
    reply.clearCookie(DEVICE_COOKIE, { path: '/api/auth' });
    req.log.info({ userId: user.id, notes: deleted.noteIds.length }, 'konto slettet');
    return { ok: true };
  });
}
