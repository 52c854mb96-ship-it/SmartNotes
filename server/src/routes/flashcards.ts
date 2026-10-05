import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { ProgressResponse } from '@smartnotes/shared';
import { MASTER_LEVEL, type Repo } from '../db.js';
import { badRequest, notFound, offlineFeature } from '../errors.js';
import type { FlashcardGenerator } from '../flashcards/generator.js';
import { loadSourceNotes } from '../flashcards/generator.js';
import { DIFFICULTIES, KINDS, MAX_CARDS, MAX_DECK_NOTES, MAX_SOURCE_CHARS, defaultDeckTitle } from '../flashcards/prompt.js';
import type { ClaudeService } from '../pipeline/claude.js';
import { isId, type Storage } from '../storage.js';
import { parse } from './library.js';

interface Deps {
  repo: Repo;
  storage: Storage;
  claude: ClaudeService;
  generator: FlashcardGenerator;
}

const id = z.string().refine(isId, 'Ugyldig id.');
const deckTitle = z.string().trim().min(1, 'Kortstokken må ha et navn.').max(120, 'Navnet er for langt.');
const front = z.string().trim().min(1, 'Spørsmålet kan ikke være tomt.').max(500, 'Spørsmålet er for langt.');
const back = z
  .array(z.string().trim().max(500, 'Et svarpunkt er for langt.'))
  .transform((lines) => lines.filter((l) => l.length > 0 && l !== '!'))
  .refine((lines) => lines.length > 0, 'Svaret må ha minst ett punkt.')
  .refine((lines) => lines.length <= 12, 'Svaret kan ha høyst 12 punkter.');
const detail = z.string().trim().max(4000, 'Forklaringen er for lang.');
const kind = z.enum(KINDS as [string, ...string[]], { message: 'Ukjent korttype.' }).transform((k) => k as (typeof KINDS)[number]);
const isoTime = z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/, 'Ugyldig tidspunkt.');

export function registerFlashcardRoutes(app: FastifyInstance, d: Deps): void {
  const { repo, storage, claude, generator } = d;

  const requireDeck = (deckId: string) => {
    const deck = isId(deckId) ? repo.getDeck(deckId) : null;
    if (!deck) throw notFound('Fant ikke kortstokken.');
    return deck;
  };
  const requireCard = (cardId: string) => {
    const card = isId(cardId) ? repo.getCard(cardId) : null;
    if (!card) throw notFound('Fant ikke kortet.');
    return card;
  };

  // ---------- Kortstokker ----------

  app.post('/api/decks', async (req, reply) => {
    const body = parse(
      z.object({
        subjectId: id,
        noteIds: z
          .array(id)
          .min(1, 'Velg minst ett notat.')
          .max(MAX_DECK_NOTES, `Velg høyst ${MAX_DECK_NOTES} notater i én kortstokk.`)
          .transform((ids) => [...new Set(ids)]),
        difficulty: z.enum(DIFFICULTIES as [string, ...string[]], { message: 'Ukjent vanskelighetsgrad.' }),
        count: z.number().int().min(5, 'Velg minst 5 kort.').max(MAX_CARDS, `Høyst ${MAX_CARDS} kort i én kortstokk.`).nullable().default(null),
        title: z.string().trim().max(120, 'Navnet er for langt.').nullable().optional(),
      }),
      req.body,
    );
    const subject = repo.getSubject(body.subjectId);
    if (!subject) throw notFound('Fant ikke faget.');
    if (!claude.configured) throw offlineFeature('Serveren mangler Claude API-nøkkel (ANTHROPIC_API_KEY), så kortene kan ikke lages.');

    const { notes, skipped } = await loadSourceNotes(repo, storage, subject.id, body.noteIds);
    if (skipped.length > 0) {
      // Et notat kan mangle fordi det er slettet (f.eks. på en annen enhet), feilet eller ikke er ferdig ennå.
      const waiting = skipped.some((nid) => {
        const row = repo.getNoteRow(nid);
        return row?.subject_id === subject.id && (row.status === 'queued' || row.status === 'processing');
      });
      const one = skipped.length === 1;
      const what = skipped.length === body.noteIds.length ? (one ? 'Notatet' : 'Notatene') : one ? 'Ett av notatene' : `${skipped.length} av notatene`;
      throw badRequest(
        waiting
          ? `${what} er ikke ferdig konvertert ennå. Vent litt, eller fjern ${one ? 'det' : 'dem'} fra utvalget.`
          : `${what} finnes ikke lenger eller kunne ikke konverteres. Fjern ${one ? 'det' : 'dem'} fra utvalget.`,
      );
    }
    const chars = notes.reduce((n, x) => n + x.body.length, 0);
    if (chars > MAX_SOURCE_CHARS) throw badRequest('Notatene har for mye tekst til én kortstokk. Velg færre notater.');

    const title =
      body.title ||
      defaultDeckTitle(
        body.noteIds.map((nid) => {
          const row = repo.getNoteRow(nid)!;
          const chapter = row.chapter_id ? repo.getChapter(row.chapter_id) : null;
          return { title: row.title, chapter };
        }),
      );
    const deck = repo.createDeck({
      subjectId: subject.id,
      title,
      difficulty: body.difficulty as (typeof DIFFICULTIES)[number],
      noteIds: body.noteIds,
      count: body.count,
    });
    generator.start(deck.id);
    reply.code(201);
    return deck;
  });

  app.patch<{ Params: { id: string } }>('/api/decks/:id', async (req) => {
    const deck = requireDeck(req.params.id);
    const body = parse(z.object({ title: deckTitle.optional() }), req.body);
    return body.title === undefined ? deck : repo.renameDeck(deck.id, body.title)!;
  });

  app.delete<{ Params: { id: string } }>('/api/decks/:id', async (req) => {
    const deck = requireDeck(req.params.id);
    repo.deleteDeck(deck.id);
    return { ok: true };
  });

  /** Ny generering etter feil. */
  app.post<{ Params: { id: string } }>('/api/decks/:id/retry', async (req) => {
    const deck = requireDeck(req.params.id);
    if (deck.status !== 'failed') throw badRequest('Kortstokken har ingen feil å prøve på nytt.');
    if (!claude.configured) throw offlineFeature('Serveren mangler Claude API-nøkkel (ANTHROPIC_API_KEY), så kortene kan ikke lages.');
    const restarted = repo.restartDeck(deck.id)!;
    generator.start(deck.id);
    return restarted;
  });

  // ---------- Kort ----------

  app.post<{ Params: { id: string } }>('/api/decks/:id/cards', async (req, reply) => {
    const deck = requireDeck(req.params.id);
    const body = parse(z.object({ kind, front, back, detail: detail.default('') }), req.body);
    if (repo.listCards(deck.id).length >= MAX_CARDS * 2) throw badRequest('Kortstokken har for mange kort.');
    reply.code(201);
    return repo.createCard(deck.id, body);
  });

  app.patch<{ Params: { id: string } }>('/api/cards/:id', async (req) => {
    const card = requireCard(req.params.id);
    const body = parse(z.object({ kind: kind.optional(), front: front.optional(), back: back.optional(), detail: detail.optional() }), req.body);
    return repo.updateCard(card.id, body)!;
  });

  app.delete<{ Params: { id: string } }>('/api/cards/:id', async (req) => {
    const card = requireCard(req.params.id);
    repo.deleteCard(card.id);
    return { ok: true };
  });

  // ---------- Fremgang ----------

  app.post('/api/flashcards/progress', async (req): Promise<ProgressResponse> => {
    const body = parse(
      z.object({
        cards: z.array(z.object({ id, level: z.number().int().min(0).max(MASTER_LEVEL), at: isoTime })).max(5000).default([]),
        decks: z.array(z.object({ id, best: z.number().int().min(0).max(1_000_000) })).max(500).default([]),
      }),
      req.body,
    );
    // Kort og kortstokker som er slettet i mellomtiden, hoppes over i stillhet (klienten får gravsteinene ved synk).
    return repo.applyProgress(body);
  });
}
