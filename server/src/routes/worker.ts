/**
 * API-et hjemmemaskinen bruker (se remote/protocol.ts). Krever `Authorization: Bearer <WORKER_TOKEN>`; uten
 * WORKER_TOKEN på serveren finnes ikke disse rutene. Innloggingen i appen (informasjonskapselen) gjelder ikke her.
 */
import { timingSafeEqual } from 'node:crypto';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { HttpError } from '../errors.js';
import type { RemoteHub } from '../remote/hub.js';
import { PROTOCOL_VERSION, type RemoteOutcome } from '../remote/protocol.js';
import { parse } from './library.js';

/** Så lenge en henting venter på en ny oppgave før den svarer «ingenting» (long polling). */
const CLAIM_WAIT_MS = 25_000;

const name = z.string().trim().min(1, 'Hjemmemaskinen mangler navn.').max(60, 'Navnet er for langt.');
const lease = z.string().min(1).max(64);
const claimBody = z.object({ name, protocol: z.number().int(), models: z.array(z.string().max(120)).max(10).optional() });
const outcomeBody = z.object({
  name,
  lease,
  outcome: z.union([
    z.object({ ok: z.literal(true), result: z.unknown() }),
    z.object({ ok: z.literal(false), error: z.object({ message: z.string().max(2000), retryable: z.boolean(), usage: z.unknown().optional() }) }),
  ]),
});

function tokenMatches(header: string | undefined, token: string): boolean {
  const m = /^Bearer\s+(.+)$/i.exec(header ?? '');
  if (!m) return false;
  const a = Buffer.from(m[1]!.trim());
  const b = Buffer.from(token);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Svaret fra hjemmemaskinen er tekst (LaTeX, kort), aldri bilder. */
const RESULT_BODY_LIMIT = 2 * 1024 * 1024;

export function registerWorkerRoutes(app: FastifyInstance, d: { hub: RemoteHub; token: string }): void {
  // Sjekkes i onRequest, før innholdet i forespørselen leses.
  const requireWorker = async (req: FastifyRequest) => {
    if (!tokenMatches(req.headers.authorization, d.token)) {
      throw new HttpError(401, 'unauthorized', 'Feil eller manglende WORKER_TOKEN.');
    }
  };

  app.post('/api/worker/claim', { onRequest: requireWorker }, async (req, reply) => {
    const body = parse(claimBody, req.body);
    if (body.protocol !== PROTOCOL_VERSION) {
      throw new HttpError(426, 'outdated', 'Hjemmemaskinen har en annen versjon av SmartNotes enn serveren. Oppdater den (git pull) og start den på nytt.');
    }
    let gone = false;
    reply.raw.on('close', () => {
      if (!reply.raw.writableFinished) gone = true;
    });
    const task = await d.hub.claim(body, CLAIM_WAIT_MS, () => gone || req.raw.destroyed);
    if (!task) return reply.code(204).send();
    return { task };
  });

  app.post<{ Params: { id: string } }>('/api/worker/tasks/:id/heartbeat', { onRequest: requireWorker }, async (req, reply) => {
    const body = parse(z.object({ name, lease }), req.body);
    if (!d.hub.heartbeat(req.params.id, body.lease, body.name)) return reply.code(410).send({ error: 'gone', message: 'Oppgaven er ikke lenger din.' });
    return { ok: true };
  });

  app.post<{ Params: { id: string } }>('/api/worker/tasks/:id/result', { onRequest: requireWorker, bodyLimit: RESULT_BODY_LIMIT }, async (req, reply) => {
    const body = parse(outcomeBody, req.body);
    if (!d.hub.complete(req.params.id, body.lease, body.name, body.outcome as RemoteOutcome)) {
      return reply.code(410).send({ error: 'gone', message: 'Oppgaven er ikke lenger din.' });
    }
    return { ok: true };
  });
}
