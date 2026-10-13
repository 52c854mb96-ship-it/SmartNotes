import fsp from 'node:fs/promises';
import path from 'node:path';
import type { FastifyInstance } from 'fastify';
import type { DeleteAccountRequest, LegalInfo } from '@smartnotes/shared';
import { AttemptLimiter, DEVICE_COOKIE, SESSION_COOKIE, requireUser } from '../auth.js';
import type { Config } from '../config.js';
import { OWNER_ID, type Repo } from '../db.js';
import { HttpError, badRequest } from '../errors.js';
import { verifyPassword } from '../passwords.js';
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
    const password = typeof req.body?.password === 'string' ? req.body.password.slice(0, 500) : '';
    // 403, ikke 401: appen tolker 401 som at brukeren er logget ut.
    if (!(await verifyPassword(password, user.password_hash))) {
      limiter.fail(key);
      throw new HttpError(403, 'wrong_password', 'Feil passord.');
    }
    const deleted = repo.deleteUser(user.id);
    if (!deleted) throw badRequest('Kontoen kunne ikke slettes.');
    // Arbeid som venter på hjemmemaskinen for disse notatene, trengs ikke lenger.
    const notes = new Set(deleted.noteIds);
    hub?.cancel((ref) => !!ref.noteId && notes.has(ref.noteId));
    await Promise.all(deleted.noteIds.map((id) => storage.removeNote(id).catch(() => undefined)));
    // Samle-PDF-ene for kapitlene og fagene (`chapter-<id>-….pdf`, `subject-<id>-….pdf`).
    const prefixes = [...deleted.chapterIds.map((id) => `chapter-${id}-`), ...deleted.subjectIds.map((id) => `subject-${id}-`)];
    const bundles = await fsp.readdir(storage.bundlesRoot).catch(() => [] as string[]);
    await Promise.all(
      bundles.filter((f) => prefixes.some((p) => f.startsWith(p))).map((f) => fsp.rm(path.join(storage.bundlesRoot, f), { force: true })),
    );
    reply.clearCookie(SESSION_COOKIE, { path: '/' });
    reply.clearCookie(DEVICE_COOKIE, { path: '/api/auth' });
    req.log.info({ userId: user.id, notes: deleted.noteIds.length }, 'konto slettet');
    return { ok: true };
  });
}
