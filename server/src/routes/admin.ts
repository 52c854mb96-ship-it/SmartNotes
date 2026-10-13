import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { AdminUsersResponse, CreateInviteResponse, InviteSummary, InvitesResponse, ResetLinkResponse } from '@smartnotes/shared';
import { authUser, requireUser } from '../auth.js';
import type { Config } from '../config.js';
import { OWNER_ID, type InviteRow, type Repo } from '../db.js';
import { HttpError, badRequest, notFound } from '../errors.js';
import { hashToken, newInviteCode, newToken, normalizeInviteCode, normalizeUsername, usernameProblem } from '../passwords.js';
import type { RemoteHub } from '../remote/hub.js';
import { costUsd } from '../usage.js';
import { parse } from './library.js';

function inviteSummary(i: InviteRow & { used_by_name?: string | null }, now = Date.now()): InviteSummary {
  const status = i.used_at ? 'used' : i.revoked_at ? 'revoked' : Date.parse(i.expires_at) <= now ? 'expired' : 'active';
  return {
    id: i.id,
    codeHint: i.code_hint,
    status,
    createdAt: i.created_at,
    expiresAt: i.expires_at,
    usedAt: i.used_at,
    usedBy: i.used_by_name ?? null,
  };
}

/**
 * Eierens side i Innstillinger: brukerne med plan og forbruk, invitasjoner, lenke for nytt passord og stenging av en
 * konto. Alle rutene er bare for eieren (ROUTE_ACCESS i auth.ts gir 404 til andre).
 */
export function registerAdminRoutes(app: FastifyInstance, d: { repo: Repo; config: Config; hub?: RemoteHub }): void {
  const { repo, config, hub } = d;

  const userParam = (id: string) => {
    const n = /^\d{1,9}$/.test(id) ? Number(id) : Number.NaN;
    const user = Number.isFinite(n) ? repo.getUser(n) : null;
    if (!user) throw notFound('Fant ikke brukeren.');
    return user;
  };

  app.get('/api/admin/users', async (): Promise<AdminUsersResponse> => {
    const since = Date.now() - 30 * 86_400_000;
    const usage = repo.usageSince(since);
    return {
      users: repo.listUsers().map((u) => {
        const mine = usage.filter((e) => e.userId === u.id);
        const usd = mine.reduce((sum, e) => sum + (costUsd(e.provider, e) ?? 0), 0);
        return {
          id: u.id,
          username: u.username,
          plan: u.plan,
          disabled: u.disabled === 1,
          createdAt: u.created_at,
          lastLoginAt: u.last_login_at,
          usage30d: {
            calls: mine.length,
            pages: mine.reduce((sum, e) => sum + (e.kind === 'convert' && e.ok ? (e.pages ?? 0) : 0), 0),
            costNok: Math.round(usd * config.usdNok * 100) / 100,
          },
        };
      }),
    };
  });

  // Eierens brukernavn (eieren logger inn med APP_PASSWORD og dette navnet, eller uten navn).
  app.patch('/api/admin/me', async (req) => {
    const body = parse(z.object({ username: z.string().max(64) }), req.body);
    const username = normalizeUsername(body.username);
    const problem = usernameProblem(username);
    if (problem) throw badRequest(problem);
    if (!repo.renameUser(requireUser(req).id, username)) throw new HttpError(409, 'username_taken', 'Brukernavnet er tatt. Velg et annet.');
    return { ok: true, user: authUser(repo.getUser(requireUser(req).id)!) };
  });

  app.post<{ Params: { id: string } }>('/api/admin/users/:id/reset-link', async (req): Promise<ResetLinkResponse> => {
    const user = userParam(req.params.id);
    if (user.id === OWNER_ID) throw badRequest('Eieren logger inn med passordet i APP_PASSWORD og trenger ingen lenke.');
    if (user.disabled) throw badRequest('Kontoen er stengt. Åpne den først.');
    const token = newToken();
    const expiresAt = new Date(Date.now() + config.accounts.resetHours * 3_600_000);
    repo.createPasswordReset(hashToken(token), user.id, expiresAt);
    return { token, expiresAt: expiresAt.toISOString() };
  });

  app.post<{ Params: { id: string } }>('/api/admin/users/:id/disable', async (req) => {
    const user = userParam(req.params.id);
    if (user.id === OWNER_ID) throw badRequest('Eieren kan ikke stenge sin egen konto.');
    repo.setDisabled(user.id, true);
    // Logget ut overalt, kjente enheter og lenker for nytt passord glemmes, og alt brukerens arbeid som venter på
    // hjemmemaskinen, avbrytes (kortstokker, innholdsfortegnelser og notater; hvert kall vet hvilken bruker det gjelder).
    // Notater i køen blir liggende (køen hopper over stengte kontoer) og konverteres om kontoen åpnes igjen; en kortstokk
    // som er i gang, settes som feilet.
    repo.deleteUserSessions(user.id);
    repo.deleteUserDevices(user.id);
    repo.revokePasswordResets(user.id);
    hub?.cancel((ref) => ref.userId === user.id);
    return { ok: true };
  });

  app.post<{ Params: { id: string } }>('/api/admin/users/:id/enable', async (req) => {
    const user = userParam(req.params.id);
    repo.setDisabled(user.id, false);
    return { ok: true };
  });

  app.get('/api/admin/invites', async (): Promise<InvitesResponse> => ({ invites: repo.listInvites().map((i) => inviteSummary(i)) }));

  app.post('/api/admin/invites', async (req, reply): Promise<CreateInviteResponse> => {
    const code = newInviteCode();
    const normalized = normalizeInviteCode(code);
    const invite = repo.createInvite({
      id: randomUUID(),
      codeHash: hashToken(normalized),
      codeHint: normalized.slice(-4),
      createdBy: requireUser(req).id,
      expiresAt: new Date(Date.now() + config.accounts.inviteDays * 86_400_000),
    });
    reply.code(201);
    return { invite: inviteSummary(invite), code };
  });

  app.delete<{ Params: { id: string } }>('/api/admin/invites/:id', async (req) => {
    if (!repo.revokeInvite(req.params.id)) throw notFound('Fant ingen ubrukt invitasjon med den id-en.');
    return { ok: true };
  });
}
