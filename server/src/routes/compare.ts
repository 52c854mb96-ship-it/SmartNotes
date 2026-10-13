import fs from 'node:fs';
import path from 'node:path';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import type { ComparisonSummaryResponse, NoteComparisonResponse } from '@smartnotes/shared';
import type { Config } from '../config.js';
import { requireUser } from '../auth.js';
import { type Repo, type UserRepo, toComparison } from '../db.js';
import { conflict, notFound, offlineFeature } from '../errors.js';
import { slug } from '../pipeline/bundle.js';
import { COMPARE_PROMPT_VERSION, type Comparer, summarizeComparisons } from '../pipeline/compare.js';
import { isId, type Storage } from '../storage.js';
import { parse, sendPdf } from './library.js';

const rateSchema = z.object({
  verdict: z.enum(['haiku_ok', 'sonnet_better']),
  comment: z.string().trim().max(2000, 'Kommentaren er for lang (maks 2000 tegn).').nullable().optional(),
});

/** Sammenligningen av den vanlige versjonen med Haiku (pipeline/compare.ts). Bare på nett; synkroniseres ikke. */
export function registerCompareRoutes(app: FastifyInstance, d: { repo: Repo; storage: Storage; comparer: Comparer; config: Config }): void {
  const { repo, storage, comparer, config } = d;

  // Rutene er bare for eieren (ROUTE_ACCESS i auth.ts), og gjelder bare eierens egne notater.
  const mine = (req: FastifyRequest): UserRepo => repo.forUser(requireUser(req).id);
  const requireNote = (r: UserRepo, id: string) => {
    const row = isId(id) ? r.getNoteRow(id) : null;
    if (!row) throw notFound('Fant ikke notatet.');
    return row;
  };
  const current = (r: UserRepo, noteId: string, notePdfRev: number): NoteComparisonResponse => {
    const row = r.getComparisonRow(noteId);
    return { comparison: row ? toComparison(row, notePdfRev, config.usdNok, COMPARE_PROMPT_VERSION) : null };
  };

  app.get<{ Params: { id: string } }>('/api/notes/:id/compare', async (req): Promise<NoteComparisonResponse> => {
    const r = mine(req);
    const note = requireNote(r, req.params.id);
    return current(r, note.id, note.pdf_rev);
  });

  app.post<{ Params: { id: string } }>('/api/notes/:id/compare', async (req, reply): Promise<NoteComparisonResponse> => {
    const r = mine(req);
    const note = requireNote(r, req.params.id);
    if (note.status !== 'done' || note.pdf_rev === 0) throw conflict('Notatet må være ferdig konvertert før det kan sammenlignes.');
    if (r.getComparisonRow(note.id)?.status === 'running') throw conflict('Haiku-versjonen lages allerede.');
    if (!comparer.configured) {
      throw offlineFeature('Serveren mangler Claude API-nøkkel (ANTHROPIC_API_KEY), så Haiku-versjonen kan ikke lages.');
    }
    comparer.start(note);
    reply.code(202);
    return current(r, note.id, note.pdf_rev);
  });

  app.get<{ Params: { id: string }; Querystring: { download?: string } }>('/api/notes/:id/compare/pdf', async (req, reply) => {
    const r = mine(req);
    const note = requireNote(r, req.params.id);
    const file = path.join(storage.compareDir(note.id), 'note.pdf');
    if (r.getComparisonRow(note.id)?.status !== 'done' || !fs.existsSync(file)) throw notFound('Haiku-PDF-en er ikke klar.');
    return sendPdf(reply, file, `${slug(note.title || 'notat')}-haiku.pdf`, req.query.download === '1');
  });

  app.put<{ Params: { id: string } }>('/api/notes/:id/compare/rating', async (req): Promise<NoteComparisonResponse> => {
    const r = mine(req);
    const note = requireNote(r, req.params.id);
    const body = parse(rateSchema, req.body);
    const existing = r.getComparisonRow(note.id);
    if (!existing) throw notFound('Det finnes ingen Haiku-versjon å vurdere.');
    if (existing.status === 'running') throw conflict('Vent til Haiku-versjonen er ferdig.');
    if (existing.status === 'failed' && body.verdict === 'haiku_ok') throw conflict('Haiku laget ingen PDF denne gangen, så den kan ikke være god nok.');
    r.rateComparison(note.id, body.verdict, body.comment || null);
    return current(r, note.id, note.pdf_rev);
  });

  app.get('/api/compare/summary', async (req): Promise<ComparisonSummaryResponse> => {
    const r = mine(req);
    return summarizeComparisons(r.listComparisons(), r.comparisonRatingsByVersion(), config.usdNok);
  });
}
