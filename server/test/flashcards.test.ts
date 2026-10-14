import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { z } from 'zod';
import { afterAll, beforeAll, describe, expect, it, onTestFinished, vi } from 'vitest';
import type { CreateInviteResponse, Deck, Flashcard, FlashcardChoices, LoginResponse, ProgressResponse, Subject, SyncResponse } from '@smartnotes/shared';
import { buildApp, type AppContext } from '../src/app.js';
import { loadConfig } from '../src/config.js';
import { OWNER_ID, Repo } from '../src/db.js';
import { AbortedError, ConversionError } from '../src/errors.js';
import { FlashcardGenerator } from '../src/flashcards/generator.js';
import {
  CHOICES_SYSTEM_PROMPT,
  FLASHCARD_SYSTEM_PROMPT,
  buildChoicesPrompt,
  buildFlashcardPrompt,
  choicesProblem,
  cleanCardChoices,
  cleanChoices,
  cleanFlashcards,
  defaultDeckTitle,
  flashcardChoicesSchema,
  flashcardSchema,
  flashcardSchemaFor,
  flashcardSystemPrompt,
  noteSourceText,
  normalizeChoice,
  type ChoicesRequest,
  type FlashcardRequest,
  type RawCardChoices,
  MAX_CARDS,
  MAX_CHOICE_CHARS,
} from '../src/flashcards/prompt.js';
import type { AiService } from '../src/pipeline/ai.js';
import { FakeClaude, RefusalError, choicesError, flashcardError, parseChoicesMessage, parseFlashcardMessage } from '../src/pipeline/claude.js';
import { QUOTA_MESSAGES } from '../src/quota.js';
import { currentUsageRef, usageScope, zeroUsage, type UsageRef } from '../src/usage.js';

/** Flashcards: kortstokker fra notater, redigering av kort og fremgang som synkes mellom enheter. */
let ctx: AppContext;
let dataDir = '';
let cookie = '';
let subject: Subject;

/** Et kall som en innlogget bruker (standard: eieren). */
async function injectAs<T>(as: string, method: string, url: string, payload?: unknown): Promise<{ status: number; body: T }> {
  const res = await ctx.app.inject({
    method: method as 'GET',
    url,
    headers: { cookie: as, 'x-smartnotes': '1', ...(payload !== undefined ? { 'content-type': 'application/json' } : {}) },
    payload: payload !== undefined ? JSON.stringify(payload) : undefined,
  });
  return { status: res.statusCode, body: res.json() as T };
}

const inject = <T>(method: string, url: string, payload?: unknown) => injectAs<T>(cookie, method, url, payload);

async function sync(since = 0, as = cookie): Promise<SyncResponse> {
  return (await injectAs<SyncResponse>(as, 'GET', `/api/sync?since=${since}`)).body;
}

/** Et ferdig konvertert notat (uten å gå via opplasting og LaTeX). */
function doneNote(opts: {
  title: string;
  chapterId?: string | null;
  section?: string | null;
  body?: string;
  done?: boolean;
  subjectId?: string;
}): string {
  const id = randomUUID();
  ctx.repo.createNote({
    id,
    subjectId: opts.subjectId ?? subject.id,
    chapterId: opts.chapterId ?? null,
    chapterAuto: false,
    clientId: null,
    title: opts.title,
    noteDate: '2026-09-01',
    instructions: null,
    files: [],
  });
  if (opts.done !== false) {
    ctx.repo.completeNote(id, { remarks: [], pageCount: 1, section: opts.section ?? null, searchText: opts.title });
    fs.mkdirSync(ctx.storage.noteDir(id), { recursive: true });
    fs.writeFileSync(ctx.storage.noteFile(id, 'note.tex'), opts.body ?? `\\section{${opts.title}}\n% kommentar\nInnhold om $F = ma$.\n`);
  }
  return id;
}

async function waitReady(deckId: string): Promise<Deck> {
  await ctx.generator.idle();
  return (await sync()).decks.find((d) => d.id === deckId)!;
}

beforeAll(async () => {
  dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'smartnotes-flashcards-'));
  const config = loadConfig({ ...process.env, NODE_ENV: 'test', DATA_DIR: dataDir, APP_PASSWORD: 'pw', WEB_DIST: '', SEED_TEXTBOOKS: 'fysikk-1-lk20' });
  ctx = await buildApp({ ...config, webDist: null }, { ai: new FakeClaude(5), logger: false });
  const login = await ctx.app.inject({
    method: 'POST',
    url: '/api/auth/login',
    headers: { 'x-smartnotes': '1', 'content-type': 'application/json' },
    payload: JSON.stringify({ password: 'pw' }),
  });
  cookie = String(login.headers['set-cookie']).split(';')[0]!;
  subject = (await sync()).subjects[0]!;
});

afterAll(async () => {
  await ctx?.app.close();
  fs.rmSync(dataDir, { recursive: true, force: true });
});

describe('kortstokker', () => {
  it('synk har kortstokker og kort (tomme fra start)', async () => {
    const s = await sync();
    expect(s.decks).toEqual([]);
    expect(s.cards).toEqual([]);
  });

  it('avviser ugyldige utvalg med norske meldinger', async () => {
    const empty = await inject<{ message: string }>('POST', '/api/decks', { subjectId: subject.id, noteIds: [], difficulty: 'easy' });
    expect(empty.status).toBe(400);
    expect(empty.body.message).toBe('Velg minst ett notat.');

    const pending = doneNote({ title: 'Under arbeid', done: false });
    const notDone = await inject<{ message: string }>('POST', '/api/decks', { subjectId: subject.id, noteIds: [pending], difficulty: 'easy' });
    expect(notDone.status).toBe(400);
    expect(notDone.body.message).toBe('Notatet er ikke ferdig konvertert ennå. Vent litt, eller fjern det fra utvalget.');

    const ready = doneNote({ title: 'Ferdig' });
    const mixed = await inject<{ message: string }>('POST', '/api/decks', { subjectId: subject.id, noteIds: [ready, pending], difficulty: 'easy' });
    expect(mixed.body.message).toBe('Ett av notatene er ikke ferdig konvertert ennå. Vent litt, eller fjern det fra utvalget.');

    // Et slettet notat (f.eks. på en annen enhet) blir ikke ferdig av å vente.
    const gone = doneNote({ title: 'Slettet' });
    ctx.repo.deleteNote(gone);
    const deleted = await inject<{ message: string }>('POST', '/api/decks', { subjectId: subject.id, noteIds: [ready, gone], difficulty: 'easy' });
    expect(deleted.body.message).toBe('Ett av notatene finnes ikke lenger eller kunne ikke konverteres. Fjern det fra utvalget.');

    const badLevel = await inject<{ message: string }>('POST', '/api/decks', { subjectId: subject.id, noteIds: [ready], difficulty: 'umulig' });
    expect(badLevel.body.message).toBe('Ukjent vanskelighetsgrad.');

    const unknown = await inject('POST', '/api/decks', { subjectId: randomUUID(), noteIds: [ready], difficulty: 'easy' });
    expect(unknown.status).toBe(404);
  });

  it('lager kort fra notatene i bakgrunnen, med navn fra kapittelet', async () => {
    const chapter = ctx.repo.listChapters(subject.id).find((c) => c.sections.length > 0)!;
    const a = doneNote({ title: 'Newtons første lov', chapterId: chapter.id, section: chapter.sections[0]!.code });
    const b = doneNote({ title: 'Newtons andre lov', chapterId: chapter.id });
    const res = await inject<Deck>('POST', '/api/decks', { subjectId: subject.id, noteIds: [a, b], difficulty: 'mixed' });
    expect(res.status).toBe(201);
    expect(res.body.status).toBe('generating');
    expect(res.body.title).toBe(`${chapter.number} ${chapter.title}`);
    expect(res.body.noteIds).toEqual([a, b]);

    const deck = await waitReady(res.body.id);
    expect(deck.status).toBe('ready');
    const cards = (await sync()).cards.filter((c) => c.deckId === deck.id).sort((x, y) => x.position - y.position);
    expect(cards).toHaveLength(6);
    expect(cards.map((c) => c.noteId)).toEqual([a, a, a, b, b, b]);
    expect(cards.map((c) => c.kind)).toEqual(['concept', 'explain', 'apply', 'concept', 'explain', 'apply']);
    expect(cards[1]!.back[0]).toBe('!Tre punkter');
    expect(cards.every((c) => c.level === 0 && c.levelAt === null)).toBe(true);
  });

  it('bruker navnet brukeren ga, og omtrent så mange kort som bedt om', async () => {
    const a = doneNote({ title: 'Energi' });
    const res = await inject<Deck>('POST', '/api/decks', { subjectId: subject.id, noteIds: [a], difficulty: 'hard', count: 7, title: '  Til prøven  ' });
    expect(res.body.title).toBe('Til prøven');
    await waitReady(res.body.id);
    expect((await sync()).cards.filter((c) => c.deckId === res.body.id)).toHaveLength(7);
  });

  it('feil fra Claude gir feilmelding, og kan prøves på nytt', async () => {
    const a = doneNote({ title: 'FEIL i notatet' });
    const res = await inject<Deck>('POST', '/api/decks', { subjectId: subject.id, noteIds: [a], difficulty: 'easy' });
    const failed = await waitReady(res.body.id);
    expect(failed.status).toBe('failed');
    expect(failed.error).toBe('Testfeil fra falsk Claude.');

    const retry = await inject<Deck>('POST', `/api/decks/${res.body.id}/retry`);
    expect(retry.status).toBe(200);
    expect(retry.body.status).toBe('generating');
    expect((await waitReady(res.body.id)).status).toBe('failed');

    const again = await inject<{ message: string }>('POST', `/api/decks/${(await sync()).decks.find((d) => d.status === 'ready')!.id}/retry`);
    expect(again.status).toBe(400);
  });

  it('fortsetter avbrutte kortstokker ved oppstart', async () => {
    const a = doneNote({ title: 'Bevegelse' });
    const deck = ctx.repo.createDeck({ subjectId: subject.id, title: 'Avbrutt', difficulty: 'easy', noteIds: [a], count: null });
    ctx.generator.resume();
    expect((await waitReady(deck.id)).status).toBe('ready');
  });

  it('gir nytt navn og sletter kortstokken med kortene', async () => {
    const a = doneNote({ title: 'Krefter' });
    const created = await inject<Deck>('POST', '/api/decks', { subjectId: subject.id, noteIds: [a], difficulty: 'easy' });
    await waitReady(created.body.id);
    const renamed = await inject<Deck>('PATCH', `/api/decks/${created.body.id}`, { title: 'Nytt navn' });
    expect(renamed.body.title).toBe('Nytt navn');
    const empty = await inject<{ message: string }>('PATCH', `/api/decks/${created.body.id}`, { title: ' ' });
    expect(empty.body.message).toBe('Kortstokken må ha et navn.');

    const cursor = (await sync()).cursor;
    expect((await inject('DELETE', `/api/decks/${created.body.id}`)).status).toBe(200);
    const changes = await sync(cursor);
    expect(changes.decks).toEqual([expect.objectContaining({ id: created.body.id, deleted: true })]);
    expect(changes.cards.filter((c) => c.deckId === created.body.id).every((c) => c.deleted)).toBe(true);
    expect(changes.cards.filter((c) => c.deckId === created.body.id)).toHaveLength(3);
    expect((await sync()).decks.some((d) => d.id === created.body.id)).toBe(false);
  });
});

describe('kort', () => {
  let deck: Deck;
  let cards: Flashcard[];

  beforeAll(async () => {
    const a = doneNote({ title: 'Arbeid' });
    deck = (await inject<Deck>('POST', '/api/decks', { subjectId: subject.id, noteIds: [a], difficulty: 'medium' })).body;
    await waitReady(deck.id);
    cards = ctx.repo.listCards(deck.id);
  });

  it('redigerer et kort og beholder mestringsnivået', async () => {
    ctx.repo.applyProgress({ cards: [{ id: cards[0]!.id, level: 2, at: '2026-09-01T10:00:00.000Z' }], decks: [] });
    const res = await inject<Flashcard>('PATCH', `/api/cards/${cards[0]!.id}`, {
      front: '  Hva er arbeid?  ',
      back: ['**Arbeid** = kraft ganger strekning', '', '$W = F \\cdot s$'],
    });
    expect(res.status).toBe(200);
    expect(res.body.front).toBe('Hva er arbeid?');
    expect(res.body.back).toEqual(['**Arbeid** = kraft ganger strekning', '$W = F \\cdot s$']);
    expect(res.body.level).toBe(2);
    expect(res.body.kind).toBe(cards[0]!.kind);

    const bad = await inject<{ message: string }>('PATCH', `/api/cards/${cards[0]!.id}`, { back: ['  ', '!'] });
    expect(bad.status).toBe(400);
    expect(bad.body.message).toBe('Svaret må ha minst ett punkt.');
    const badKind = await inject<{ message: string }>('PATCH', `/api/cards/${cards[0]!.id}`, { kind: 'quiz' });
    expect(badKind.body.message).toBe('Ukjent korttype.');
  });

  it('legger til et eget kort sist i kortstokken', async () => {
    const res = await inject<Flashcard>('POST', `/api/decks/${deck.id}/cards`, { kind: 'concept', front: 'Hva er effekt?', back: ['Arbeid per tid'] });
    expect(res.status).toBe(201);
    expect(res.body.noteId).toBeNull();
    expect(res.body.detail).toBe('');
    expect(res.body.position).toBe(Math.max(...cards.map((c) => c.position)) + 1);
    const empty = await inject<{ message: string }>('POST', `/api/decks/${deck.id}/cards`, { kind: 'concept', front: '', back: ['x'] });
    expect(empty.body.message).toBe('Spørsmålet kan ikke være tomt.');
  });

  it('sletter et kort (gravstein ved synk)', async () => {
    const cursor = (await sync()).cursor;
    expect((await inject('DELETE', `/api/cards/${cards[2]!.id}`)).status).toBe(200);
    expect((await sync(cursor)).cards).toEqual([expect.objectContaining({ id: cards[2]!.id, deleted: true })]);
    expect((await inject('DELETE', `/api/cards/${cards[2]!.id}`)).status).toBe(404);
  });
});

describe('fremgang', () => {
  let deck: Deck;
  let card: Flashcard;

  beforeAll(async () => {
    const a = doneNote({ title: 'Impuls' });
    deck = (await inject<Deck>('POST', '/api/decks', { subjectId: subject.id, noteIds: [a], difficulty: 'easy' })).body;
    await waitReady(deck.id);
    card = ctx.repo.listCards(deck.id)[0]!;
  });

  const progress = (cards: { id: string; level: number; at: string }[], decks: { id: string; best: number }[] = []) =>
    inject<ProgressResponse>('POST', '/api/flashcards/progress', { cards, decks });

  it('siste vurdering vinner, også når en eldre kommer fram senere (offline)', async () => {
    const first = await progress([{ id: card.id, level: 2, at: '2026-09-10T12:00:00.000Z' }]);
    expect(first.body.cards).toEqual([expect.objectContaining({ id: card.id, level: 2, levelAt: '2026-09-10T12:00:00.000Z' })]);

    // En annen enhet som var offline, sender en eldre vurdering: ignoreres, men enheten får serverens nivå tilbake.
    const older = await progress([{ id: card.id, level: 0, at: '2026-09-10T11:00:00.000Z' }]);
    expect(older.body.cards).toEqual([expect.objectContaining({ id: card.id, level: 2, levelAt: '2026-09-10T12:00:00.000Z' })]);
    expect(ctx.repo.getCard(card.id)!.level).toBe(2);

    const newer = await progress([{ id: card.id, level: 3, at: '2026-09-10T13:00:00.000Z' }]);
    expect(newer.body.cards[0]!.level).toBe(3);
  });

  it('tidspunkt fram i tid regnes som nå, så kortet ikke låses', async () => {
    const res = await progress([{ id: card.id, level: 1, at: '2099-01-01T00:00:00.000Z' }]);
    expect(res.body.cards[0]!.level).toBe(1);
    expect(res.body.cards[0]!.levelAt! < '2099-01-01').toBe(true);
    const later = await progress([{ id: card.id, level: 0, at: new Date(Date.now() + 1000).toISOString() }]);
    expect(later.body.cards[0]!.level).toBe(0);
  });

  it('beste rekke: høyeste verdi vinner', async () => {
    const up = await progress([], [{ id: deck.id, best: 7 }]);
    expect(up.body.decks[0]!.best).toBe(7);
    const down = await progress([], [{ id: deck.id, best: 4 }]);
    expect(down.body.decks).toEqual([expect.objectContaining({ id: deck.id, best: 7 })]);
    expect(ctx.repo.getDeck(deck.id)!.best).toBe(7);
  });

  it('endringer synkes til andre enheter, og ukjente kort hoppes over', async () => {
    const cursor = (await sync()).cursor;
    const res = await progress([
      { id: card.id, level: 2, at: new Date().toISOString() },
      { id: randomUUID(), level: 2, at: new Date().toISOString() },
    ]);
    expect(res.status).toBe(200);
    expect(res.body.cards.map((c) => c.id)).toEqual([card.id]);
    expect((await sync(cursor)).cards.map((c) => [c.id, c.level])).toEqual([[card.id, 2]]);
  });

  it('avviser ugyldige nivåer og tidspunkt', async () => {
    expect((await progress([{ id: card.id, level: 4, at: new Date().toISOString() }])).status).toBe(400);
    expect((await progress([{ id: card.id, level: 1, at: 'i går' }])).status).toBe(400);
  });

  it('sletting av faget sletter kortstokkene', async () => {
    const other = (await inject<Subject>('POST', '/api/subjects', { name: 'Kjemi', profile: 'chemistry' })).body;
    const id = randomUUID();
    ctx.repo.createNote({ id, subjectId: other.id, chapterId: null, chapterAuto: false, clientId: null, title: 'Mol', noteDate: null, instructions: null, files: [] });
    ctx.repo.completeNote(id, { remarks: [], pageCount: 1 });
    fs.mkdirSync(ctx.storage.noteDir(id), { recursive: true });
    fs.writeFileSync(ctx.storage.noteFile(id, 'note.tex'), 'Stoffmengde $n = m/M$.');
    const d = (await inject<Deck>('POST', '/api/decks', { subjectId: other.id, noteIds: [id], difficulty: 'easy' })).body;
    await waitReady(d.id);
    // Et notat fra et annet fag kan ikke tas med.
    const cross = await inject<{ message: string }>('POST', '/api/decks', { subjectId: subject.id, noteIds: [id], difficulty: 'easy' });
    expect(cross.status).toBe(400);
    expect((await inject('DELETE', `/api/subjects/${other.id}`)).status).toBe(200);
    const s = await sync();
    expect(s.decks.some((x) => x.id === d.id)).toBe(false);
    expect(s.cards.some((c) => c.deckId === d.id)).toBe(false);
  });
});

describe('flervalg: data og ruter', () => {
  let deck: Deck;
  let cards: Flashcard[];
  const good: FlashcardChoices = { correct: '$9{,}81\\ \\text{m/s}^2$', wrong: ['$9{,}81\\ \\text{m/s}$', '$98{,}1\\ \\text{m/s}^2$', '$1{,}0\\ \\text{m/s}^2$'] };

  beforeAll(async () => {
    const a = doneNote({ title: 'Fritt fall' });
    deck = (await inject<Deck>('POST', '/api/decks', { subjectId: subject.id, noteIds: [a], difficulty: 'easy' })).body;
    deck = await waitReady(deck.id);
    cards = ctx.repo.listCards(deck.id);
  });

  it('en kortstokk har ingen alternativer og ingen jobb uten at eleven ber om det', async () => {
    expect(deck).toMatchObject({ status: 'ready', choicesStatus: null, choicesError: null });
    expect(ctx.repo.getDeckRow(deck.id)!.with_choices).toBe(0);
    expect(cards.length).toBeGreaterThan(0);
    expect(cards.every((c) => c.choices === null)).toBe(true);
    expect((await sync()).cards.filter((c) => c.deckId === deck.id).every((c) => c.choices === null)).toBe(true);
  });

  it('husker avkrysningen «Lag også svaralternativer» på kortstokken, og avviser en ugyldig verdi', async () => {
    const a = doneNote({ title: 'Kast' });
    const res = await inject<Deck>('POST', '/api/decks', { subjectId: subject.id, noteIds: [a], difficulty: 'easy', withChoices: true });
    expect(res.status).toBe(201);
    expect(ctx.repo.getDeckRow(res.body.id)!.with_choices).toBe(1);
    expect(res.body).toMatchObject({ status: 'generating', choicesStatus: null });
    // Avkrysningen gjelder bare den nye kortstokken; et nytt forsøk etter en feil bruker den samme.
    ctx.repo.failDeck(res.body.id, 'Testfeil.');
    expect(ctx.repo.restartDeck(res.body.id)).not.toBeNull();
    expect(ctx.repo.getDeckRow(res.body.id)!.with_choices).toBe(1);
    await waitReady(res.body.id);
    const bad = await inject<{ message: string }>('POST', '/api/decks', { subjectId: subject.id, noteIds: [a], difficulty: 'easy', withChoices: 'ja' });
    expect(bad.status).toBe(400);
  });

  it('eleven legger inn, endrer og fjerner alternativene, og hver endring synkes med ny rev', async () => {
    const cursor = (await sync()).cursor;
    const created = await inject<Flashcard>('POST', `/api/decks/${deck.id}/cards`, {
      kind: 'concept',
      front: 'Hva er tyngdeakselerasjonen?',
      back: ['$g = 9{,}81\\ \\text{m/s}^2$'],
      choices: { correct: '  $9{,}81\\ \\text{m/s}^2$ ', wrong: [' $9{,}81\\ \\text{m/s}$', '$98{,}1\\ \\text{m/s}^2$\n', '$1{,}0\\ \\text{m/s}^2$'] },
    });
    expect(created.status).toBe(201);
    expect(created.body.choices).toEqual(good);
    const synced = (await sync(cursor)).cards.find((c) => c.id === created.body.id)!;
    expect(synced.choices).toEqual(good);

    // Et kort uten alternativer (som før).
    const plain = await inject<Flashcard>('POST', `/api/decks/${deck.id}/cards`, { kind: 'concept', front: 'Hva er masse?', back: ['Mengde stoff'] });
    expect(plain.body.choices).toBeNull();

    // Endring av spørsmålet beholder alternativene; nye alternativer erstatter dem; null fjerner dem.
    const c1 = (await sync()).cursor;
    const front = await inject<Flashcard>('PATCH', `/api/cards/${created.body.id}`, { front: 'Hva er g?' });
    expect(front.body.choices).toEqual(good);
    const changed = { correct: 'Omtrent 9,8 m/s²', wrong: ['Omtrent 9,8 m/s', 'Omtrent 98 m/s²', 'Omtrent 1 m/s²'] };
    const replaced = await inject<Flashcard>('PATCH', `/api/cards/${created.body.id}`, { choices: changed });
    expect(replaced.body.choices).toEqual(changed);
    expect(replaced.body.rev).toBeGreaterThan(front.body.rev);
    expect((await sync(c1)).cards.find((c) => c.id === created.body.id)!.choices).toEqual(changed);
    const c2 = (await sync()).cursor;
    const removed = await inject<Flashcard>('PATCH', `/api/cards/${created.body.id}`, { choices: null });
    expect(removed.body.choices).toBeNull();
    expect((await sync(c2)).cards).toEqual([expect.objectContaining({ id: created.body.id, choices: null })]);
    // Mestringsnivået følger med som før.
    expect(removed.body.level).toBe(created.body.level);
  });

  it('avviser ufullstendige eller like alternativer med norske meldinger', async () => {
    const id = cards[0]!.id;
    const patch = async (choices: unknown) => {
      const res = await inject<{ message: string }>('PATCH', `/api/cards/${id}`, { choices });
      expect(res.status).toBe(400);
      return res.body.message;
    };
    expect(await patch({ correct: ' ', wrong: ['a', 'b', 'c'] })).toBe('Skriv det riktige svaret kort, eller la alle feltene for svaralternativer stå tomme.');
    expect(await patch({ correct: 'x', wrong: ['a', 'b'] })).toBe('Skriv tre gale svar, eller la alle feltene for svaralternativer stå tomme.');
    expect(await patch({ correct: 'x', wrong: ['a', ' ', 'c'] })).toBe('Skriv tre gale svar, eller la alle feltene for svaralternativer stå tomme.');
    expect(await patch({ correct: 'x', wrong: ['a', 'b', 'c', 'd'] })).toBe('Skriv tre gale svar, eller la alle feltene for svaralternativer stå tomme.');
    expect(await patch({ correct: '**2,0 m/s**', wrong: ['2,0m/s.', 'b', 'c'] })).toBe('Et galt svar kan ikke være likt det riktige svaret.');
    expect(await patch({ correct: 'x', wrong: ['**Newton**', ' Newton.', 'c'] })).toBe('De tre gale svarene må være ulike.');
    expect(await patch({ correct: 'x'.repeat(MAX_CHOICE_CHARS + 1), wrong: ['a', 'b', 'c'] })).toBe(`Et svaralternativ kan ha høyst ${MAX_CHOICE_CHARS} tegn.`);
    expect(await patch({ correct: 'x', wrong: 'a, b, c' })).toBeTruthy();
    // Ingenting ble lagret.
    expect(ctx.repo.getCard(id)!.choices).toBeNull();
    // Det samme gjelder et nytt kort.
    const created = await inject<{ message: string }>('POST', `/api/decks/${deck.id}/cards`, {
      kind: 'concept',
      front: 'Spørsmål',
      back: ['Svar'],
      choices: { correct: 'a', wrong: ['a', 'b', 'c'] },
    });
    expect(created.status).toBe(400);
    expect(created.body.message).toBe('Et galt svar kan ikke være likt det riktige svaret.');
  });

  it('normaliserer svaralternativene før de sammenlignes', () => {
    expect(normalizeChoice('  **Newton**. ')).toBe('Newton');
    expect(normalizeChoice('2,0 m/s!')).toBe(normalizeChoice('2,0m/s'));
    expect(normalizeChoice('$F = m \\cdot a$')).toBe('F=m\\cdota');
    expect(normalizeChoice(' . ')).toBe('');
    // Det samme svaret med LaTeX-mellomrom, {,} eller \\text rundt enheten; en formel uten innhold er tom.
    for (const same of ['$6{,}0\\ \\text{N}$', '$6{,}0\\,\\text{N}$', '$6{,}0~\\text{N}$', '$6{,}0\\;\\mathrm{N}$', '6,0 N']) {
      expect(normalizeChoice(same), same).toBe('6,0N');
    }
    for (const empty of ['$ $', '$\\,$', '$\\quad$', '$~$']) expect(normalizeChoice(empty), empty).toBe('');
    expect(normalizeChoice('Koster \\$5')).toBe('Koster\\$5');
    expect(choicesProblem({ correct: '$6{,}0\\ \\text{N}$', wrong: ['$6{,}0\\,\\text{N}$', '$5{,}0\\ \\text{N}$', '$6{,}0\\ \\text{kg}$'] })).toBe(
      'Et galt svar kan ikke være likt det riktige svaret.',
    );
    expect(choicesProblem({ correct: '$ $', wrong: ['a', 'b', 'c'] })).toBe('Skriv det riktige svaret kort, eller la alle feltene for svaralternativer stå tomme.');
    // Store og små bokstaver teller: et galt prefiks eller en annen formel er et ekte galt svar.
    expect(choicesProblem({ correct: '2,0 MJ', wrong: ['2,0 mJ', '2,0 kJ', '20 MJ'] })).toBeNull();
    expect(choicesProblem({ correct: '$\\ce{CO}$', wrong: ['$\\ce{Co}$', '$\\ce{CO2}$', '$\\ce{C}$'] })).toBeNull();
    expect(choicesProblem(good)).toBeNull();
    expect(choicesProblem({ correct: 'Ja', wrong: ['Nei', 'Kanskje', 'Ja.'] })).toBe('Et galt svar kan ikke være likt det riktige svaret.');
  });

  it('«Lag svaralternativer» starter en jobb for kortene som mangler dem, og synker statusen', async () => {
    // Bare ruten her: jobben selv testes under «flervalg: jobben».
    const start = vi.spyOn(ctx.generator, 'startChoices').mockImplementation(() => {});
    try {
      const cursor = (await sync()).cursor;
      const res = await inject<Deck>('POST', `/api/decks/${deck.id}/choices`);
      expect(res.status).toBe(202);
      expect(res.body).toMatchObject({ id: deck.id, choicesStatus: 'generating', choicesError: null });
      expect(start).toHaveBeenCalledWith(deck.id);
      const changes = await sync(cursor);
      expect(changes.decks).toEqual([expect.objectContaining({ id: deck.id, choicesStatus: 'generating', status: 'ready' })]);
      expect(changes.cards).toEqual([]);
      expect(ctx.repo.generatingChoicesDeckIds()).toContain(deck.id);

      // Et dobbelttrykk mens jobben går: samme svar, ingen ny rev.
      const again = await inject<Deck>('POST', `/api/decks/${deck.id}/choices`);
      expect(again.status).toBe(202);
      expect(again.body.rev).toBe(res.body.rev);

      // Jobben feiler: eleven ser meldingen og kan prøve igjen.
      ctx.repo.failChoices(deck.id, 'Fikk ikke kontakt med AI-en. Trykk «Prøv igjen» om litt.');
      const failed = (await sync()).decks.find((d) => d.id === deck.id)!;
      expect(failed).toMatchObject({ choicesStatus: 'failed', choicesError: 'Fikk ikke kontakt med AI-en. Trykk «Prøv igjen» om litt.' });
      expect(ctx.repo.generatingChoicesDeckIds()).not.toContain(deck.id);
      const retry = await inject<Deck>('POST', `/api/decks/${deck.id}/choices`);
      expect(retry.status).toBe(202);
      expect(retry.body).toMatchObject({ choicesStatus: 'generating', choicesError: null });
      expect(start).toHaveBeenCalledTimes(3);
    } finally {
      start.mockRestore();
    }
  });

  it('jobben lagrer alternativene bare på kort som er uendret siden den leste dem', async () => {
    const current = ctx.repo.listCards(deck.id).filter((c) => c.choices === null);
    expect(current.length).toBeGreaterThanOrEqual(3);
    const [same, edited, removed] = current as [Flashcard, Flashcard, Flashcard];
    // Mens jobben går: ett kort endres, ett slettes, og ett får nytt nivå fra øving (det teller ikke som en endring).
    ctx.repo.updateCard(edited.id, { front: 'Endret spørsmål' });
    ctx.repo.deleteCard(removed.id);
    ctx.repo.applyProgress({ cards: [{ id: same.id, level: 1, at: new Date().toISOString() }], decks: [] });
    const cursor = (await sync()).cursor;
    const done = ctx.repo.completeChoices(
      deck.id,
      [same, edited, removed].map((card) => ({ card, choices: good })),
    );
    expect(done).toMatchObject({ updated: 1, deck: { choicesStatus: null, choicesError: null } });
    const changes = await sync(cursor);
    expect(changes.decks).toEqual([expect.objectContaining({ id: deck.id, choicesStatus: null })]);
    expect(changes.cards).toEqual([expect.objectContaining({ id: same.id, choices: good, level: 1 })]);
    expect(ctx.repo.getCard(edited.id)!.choices).toBeNull();
    // Et kort som har fått alternativer, får ikke nye fra en senere jobb.
    expect(ctx.repo.startChoices(deck.id)).not.toBeNull();
    expect(ctx.repo.completeChoices(deck.id, [{ card: ctx.repo.getCard(same.id)!, choices: { ...good, correct: 'Annet' } }])!.updated).toBe(0);
    expect(ctx.repo.getCard(same.id)!.choices).toEqual(good);
  });

  it('avviser kortstokker som ikke er klare, og en kortstokk der alle kortene har alternativer', async () => {
    const a = doneNote({ title: 'Under arbeid' });
    const generating = ctx.repo.createDeck({ subjectId: subject.id, title: 'Lages', difficulty: 'easy', noteIds: [a], count: null });
    const busy = await inject<{ message: string }>('POST', `/api/decks/${generating.id}/choices`);
    expect(busy.status).toBe(400);
    expect(busy.body.message).toBe('Vent til kortene er laget, og prøv igjen.');
    ctx.repo.failDeck(generating.id, 'Testfeil.');
    const failed = await inject<{ message: string }>('POST', `/api/decks/${generating.id}/choices`);
    expect(failed.status).toBe(400);
    expect(failed.body.message).toBe('Kortene ble ikke laget. Trykk «Prøv igjen» på kortstokken først.');
    expect(ctx.repo.getDeck(generating.id)!.choicesStatus).toBeNull();

    // Alle kortene har alternativer: ingen jobb å starte.
    const b = doneNote({ title: 'Ferdige alternativer' });
    const full = (await inject<Deck>('POST', '/api/decks', { subjectId: subject.id, noteIds: [b], difficulty: 'easy' })).body;
    await waitReady(full.id);
    for (const c of ctx.repo.listCards(full.id)) ctx.repo.updateCard(c.id, { choices: good });
    const all = await inject<{ message: string }>('POST', `/api/decks/${full.id}/choices`);
    expect(all.status).toBe(400);
    expect(all.body.message).toBe('Alle kortene har allerede svaralternativer.');

    // Ukjent kortstokk eller ugyldig id.
    expect((await inject('POST', `/api/decks/${randomUUID()}/choices`)).status).toBe(404);
    expect((await inject('POST', '/api/decks/ikke-en-id/choices')).status).toBe(404);
    ctx.repo.deleteDeck(full.id);
    expect((await inject('POST', `/api/decks/${full.id}/choices`)).status).toBe(404);
  });

  it('gratiskontoer: teller som én kortstokk i dagens kvote, men et nytt forsøk etter feil telles ikke', async () => {
    const { code } = (await inject<CreateInviteResponse>('POST', '/api/admin/invites', {})).body;
    const res = await ctx.app.inject({
      method: 'POST',
      url: '/api/auth/register',
      headers: { 'x-smartnotes': '1', 'content-type': 'application/json' },
      payload: JSON.stringify({ code, username: 'flervalg-elev', password: 'passord-123', presetIds: ['fysikk-1-lk20'], ageConfirmed: true, termsAccepted: true }),
    });
    expect(res.statusCode, res.body).toBe(201);
    const userId = (res.json() as LoginResponse).user.id;
    const set = res.headers['set-cookie'];
    const student = ([set].flat().find((c) => String(c).startsWith('sn_session=')) ?? '').split(';')[0]!;
    expect(student).toContain('sn_session=');
    const own = (await sync(0, student)).subjects[0]!;
    const note = doneNote({ title: 'Elevens notat', subjectId: own.id });
    const created = await injectAs<Deck>(student, 'POST', '/api/decks', { subjectId: own.id, noteIds: [note], difficulty: 'easy' });
    expect(created.status).toBe(201);
    await ctx.generator.idle();
    expect(ctx.quota.usage(userId)!.decks.used).toBe(1);

    // Brukerne når ikke hverandres kortstokker.
    expect((await injectAs(student, 'POST', `/api/decks/${deck.id}/choices`)).status).toBe(404);
    expect((await inject('POST', `/api/decks/${created.body.id}/choices`)).status).toBe(404);
    expect(ctx.repo.getDeck(created.body.id)!.choicesStatus).toBeNull();

    // Bare ruten og kvoten her: jobben stubbes, så statusen ikke endres i bakgrunnen.
    const start = vi.spyOn(ctx.generator, 'startChoices').mockImplementation(() => {});
    onTestFinished(() => start.mockRestore());
    const first = await injectAs<Deck>(student, 'POST', `/api/decks/${created.body.id}/choices`);
    expect(first.status).toBe(202);
    expect(ctx.quota.usage(userId)!.decks.used).toBe(2);

    // «Prøv igjen» etter en feil telles ikke.
    ctx.repo.failChoices(created.body.id, 'Testfeil.');
    expect((await injectAs(student, 'POST', `/api/decks/${created.body.id}/choices`)).status).toBe(202);
    expect(ctx.quota.usage(userId)!.decks.used).toBe(2);

    // Nye alternativer (f.eks. til nye kort) når dagens kvote er brukt: 429 med en norsk melding.
    ctx.repo.completeChoices(created.body.id, []);
    const blocked = await injectAs<{ error: string; message: string }>(student, 'POST', `/api/decks/${created.body.id}/choices`);
    expect(blocked.status).toBe(429);
    expect(blocked.body).toEqual({ error: 'quota_exceeded', message: QUOTA_MESSAGES.choices(2) });
    expect(ctx.repo.getDeck(created.body.id)!.choicesStatus).toBeNull();

    // En stengt konto får ikke jobben fortsatt ved oppstart.
    ctx.repo.db.prepare(`UPDATE decks SET choices_status = 'generating' WHERE id = ?`).run(created.body.id);
    expect(ctx.repo.generatingChoicesDeckIds()).toContain(created.body.id);
    ctx.repo.db.prepare(`UPDATE users SET disabled = 1 WHERE id = ?`).run(userId);
    expect(ctx.repo.generatingChoicesDeckIds()).not.toContain(created.body.id);
    ctx.repo.db.prepare(`UPDATE users SET disabled = 0 WHERE id = ?`).run(userId);
    ctx.repo.failChoices(created.body.id, 'Testfeil.');
  });
});

describe('flervalg: jobben', () => {
  const owned = (deckId: string) => ctx.repo.listCards(deckId);
  const deckOf = async (deckId: string) => (await sync()).decks.find((d) => d.id === deckId)!;

  it('ny kortstokk med «Lag også svaralternativer»: kortene får alternativer der de passer, og bare da', async () => {
    const spy = vi.spyOn(ctx.ai, 'generateFlashcards');
    onTestFinished(() => spy.mockRestore());
    const a = doneNote({ title: 'Newtons lover' });
    const withChoices = (await inject<Deck>('POST', '/api/decks', { subjectId: subject.id, noteIds: [a], difficulty: 'easy', withChoices: true })).body;
    expect((await waitReady(withChoices.id)).status).toBe('ready');
    expect(spy.mock.calls.at(-1)![0]).toMatchObject({ withChoices: true });
    const cards = (await sync()).cards.filter((c) => c.deckId === withChoices.id);
    expect(cards.map((c) => [c.kind, c.choices])).toEqual([
      ['concept', { correct: 'Newtons lover', wrong: ['Feil svar A', 'Feil svar B', 'Feil svar C'] }],
      // Et åpent forklaringskort får ingen alternativer og øves som før.
      ['explain', null],
      ['apply', { correct: '$6{,}0\\ \\text{N}$', wrong: ['$5{,}0\\ \\text{N}$', '$1{,}5\\ \\text{N}$', '$6{,}0\\ \\text{kg}$'] }],
    ]);
    // AI-en har allerede fått forklaringskortet: det er avslått, så «Lag svaralternativer» ikke sender det igjen.
    expect(cards.map((c) => c.choicesDeclined)).toEqual([false, true, false]);
    const again = await inject<{ message: string }>('POST', `/api/decks/${withChoices.id}/choices`);
    expect(again.status).toBe(400);

    // Uten avkrysningen er forespørselen som før: feltet er ikke med i det hele tatt.
    const plain = (await inject<Deck>('POST', '/api/decks', { subjectId: subject.id, noteIds: [a], difficulty: 'easy' })).body;
    await waitReady(plain.id);
    expect(spy.mock.calls.at(-1)![0]).not.toHaveProperty('withChoices');
    expect(owned(plain.id).every((c) => c.choices === null && !c.choicesDeclined)).toBe(true);
  });

  it('«Lag svaralternativer» lager dem til kortene som mangler dem, ut fra kortenes tekst, og logger forbruket på kortstokken', async () => {
    const a = doneNote({ title: 'Akselerasjon', body: '\\section{Akselerasjon}\nHemmelig notattekst som ikke skal sendes.\n' });
    const deck = (await inject<Deck>('POST', '/api/decks', { subjectId: subject.id, noteIds: [a], difficulty: 'easy' })).body;
    await waitReady(deck.id);
    const [concept, explain, apply] = owned(deck.id) as [Flashcard, Flashcard, Flashcard];
    // Et kort med egne alternativer beholder dem og sendes ikke med.
    const own = { correct: 'Fart per tid', wrong: ['Strekning per tid', 'Kraft per masse', 'Tid per fart'] };
    await inject('PATCH', `/api/cards/${concept.id}`, { choices: own });
    const extra = (await inject<Flashcard>('POST', `/api/decks/${deck.id}/cards`, { kind: 'concept', front: 'Hva er enheten for kraft?', back: ['**newton** (N)'] })).body;

    const spy = vi.spyOn(ctx.ai, 'generateChoices');
    onTestFinished(() => spy.mockRestore());
    const before = ctx.repo.usageSince(0).length;
    const res = await inject<Deck>('POST', `/api/decks/${deck.id}/choices`);
    expect(res.status).toBe(202);
    await ctx.generator.idle();

    const req = spy.mock.calls[0]![0];
    expect(req).toEqual({
      subjectName: subject.name,
      subjectLabel: 'Fysikk',
      cards: [
        { alias: 'k1', kind: 'explain', front: explain.front, back: explain.back },
        { alias: 'k2', kind: 'apply', front: apply.front, back: apply.back },
        { alias: 'k3', kind: 'concept', front: 'Hva er enheten for kraft?', back: ['**newton** (N)'] },
      ],
    });
    expect(buildChoicesPrompt(req)).not.toContain('Hemmelig notattekst');

    expect(await deckOf(deck.id)).toMatchObject({ choicesStatus: null, choicesError: null });
    const after = new Map(owned(deck.id).map((c) => [c.id, c.choices]));
    expect(after.get(concept.id)).toEqual(own);
    expect(after.get(explain.id)).toBeNull();
    expect(after.get(apply.id)).toEqual({ correct: '$F = m \\cdot a$', wrong: ['Feil svar A', 'Feil svar B', 'Feil svar C'] });
    // **Fet** skrift fjernes fra alternativene (den ville røpe det riktige).
    expect(after.get(extra.id)).toEqual({ correct: 'newton (N)', wrong: ['Feil svar A', 'Feil svar B', 'Feil svar C'] });

    const rows = ctx.repo.usageSince(0).slice(before);
    expect(rows.map((r) => [r.kind, r.userId, r.deckId, r.subjectId, r.noteId, r.ok])).toEqual([['flashcards', OWNER_ID, deck.id, subject.id, null, true]]);
  });

  it('en feil gir «failed» med norsk melding, og «Prøv igjen» lager dem', async () => {
    const a = doneNote({ title: 'Energi' });
    const deck = (await inject<Deck>('POST', '/api/decks', { subjectId: subject.id, noteIds: [a], difficulty: 'easy' })).body;
    await waitReady(deck.id);
    const bad = (await inject<Flashcard>('POST', `/api/decks/${deck.id}/cards`, { kind: 'concept', front: 'FEIL i kortet', back: ['Joule'] })).body;
    expect((await inject('POST', `/api/decks/${deck.id}/choices`)).status).toBe(202);
    await ctx.generator.idle();
    expect(await deckOf(deck.id)).toMatchObject({ choicesStatus: 'failed', choicesError: 'Testfeil fra falsk Claude.' });
    expect(owned(deck.id).every((c) => c.choices === null)).toBe(true);

    await inject('PATCH', `/api/cards/${bad.id}`, { front: 'Hva er enheten for energi?' });
    const retry = await inject<Deck>('POST', `/api/decks/${deck.id}/choices`);
    expect(retry.status).toBe(202);
    expect(retry.body).toMatchObject({ choicesStatus: 'generating', choicesError: null });
    await ctx.generator.idle();
    expect(await deckOf(deck.id)).toMatchObject({ choicesStatus: null, choicesError: null });
    expect(ctx.repo.getCard(bad.id)!.choices).toEqual({ correct: 'Joule', wrong: ['Feil svar A', 'Feil svar B', 'Feil svar C'] });
  });

  it('kort uten brukbare alternativer merkes som avslått: ingen feil, og de sendes ikke igjen før de endres', async () => {
    const a = doneNote({ title: 'Drøfting' });
    const deck = (await inject<Deck>('POST', '/api/decks', { subjectId: subject.id, noteIds: [a], difficulty: 'easy' })).body;
    await waitReady(deck.id);
    // Bare forklaringskortet mangler alternativer, og falsk Claude gir det null (som et åpent kort).
    const good = { correct: 'Riktig', wrong: ['Galt 1', 'Galt 2', 'Galt 3'] };
    for (const c of owned(deck.id).filter((c) => c.kind !== 'explain')) await inject('PATCH', `/api/cards/${c.id}`, { choices: good });
    const explain = owned(deck.id).find((c) => c.kind === 'explain')!;
    expect(explain.choicesDeclined).toBe(false);
    const spy = vi.spyOn(ctx.ai, 'generateChoices');
    onTestFinished(() => spy.mockRestore());
    const cursor = (await sync()).cursor;
    expect((await inject('POST', `/api/decks/${deck.id}/choices`)).status).toBe(202);
    await ctx.generator.idle();
    // Ingen feil (et nytt forsøk ville gitt det samme), og kortet er merket med ny rev, så alle enhetene får det med seg.
    expect(await deckOf(deck.id)).toMatchObject({ choicesStatus: null, choicesError: null });
    const changes = await sync(cursor);
    expect(changes.cards).toEqual([expect.objectContaining({ id: explain.id, choices: null, choicesDeclined: true })]);

    // Et nytt trykk: 400 med en forklaring, uten AI-kall og uten jobb.
    const again = await inject<{ message: string }>('POST', `/api/decks/${deck.id}/choices`);
    expect(again.status).toBe(400);
    expect(again.body.message).toBe(
      'Claude har allerede prøvd kortene som mangler svaralternativer, uten å finne gode. Du kan skrive dem selv når du redigerer kortet.',
    );
    expect(spy).toHaveBeenCalledTimes(1);
    expect(ctx.repo.getDeck(deck.id)!.choicesStatus).toBeNull();

    // Bare forklaringen endret: fortsatt avslått. Nytt svar: kortet kan sendes igjen.
    expect((await inject<Flashcard>('PATCH', `/api/cards/${explain.id}`, { detail: 'Mer forklaring' })).body.choicesDeclined).toBe(true);
    expect((await inject<Flashcard>('PATCH', `/api/cards/${explain.id}`, { back: ['Kort svar'] })).body.choicesDeclined).toBe(false);
    expect((await inject('POST', `/api/decks/${deck.id}/choices`)).status).toBe(202);
    await ctx.generator.idle();
    expect(spy.mock.calls[1]![0].cards).toEqual([{ alias: 'k1', kind: 'explain', front: explain.front, back: ['Kort svar'] }]);
    expect(ctx.repo.getCard(explain.id)!.choicesDeclined).toBe(true);

    // Alternativer eleven skriver eller fjerner selv, nullstiller merket.
    const written = await inject<Flashcard>('PATCH', `/api/cards/${explain.id}`, { choices: good });
    expect(written.body).toMatchObject({ choices: good, choicesDeclined: false });
    expect((await inject<Flashcard>('PATCH', `/api/cards/${explain.id}`, { choices: null })).body).toMatchObject({ choices: null, choicesDeclined: false });
  });

  describe('med en styrt AI', () => {
    let userId = 0;
    let own: Subject;

    /** En generator med en AI som bare kan lage svaralternativer, og kort ventetid før nye forsøk. */
    const generatorWith = (generateChoices: (req: ChoicesRequest) => Promise<{ cards: RawCardChoices[] }>) => {
      const calls: { req: ChoicesRequest; ref: UsageRef }[] = [];
      const ai = {
        generateChoices: async (req: ChoicesRequest) => {
          calls.push({ req, ref: currentUsageRef() });
          return { usage: zeroUsage('flashcards', 'styrt'), ...(await generateChoices(req)) };
        },
      } as unknown as AiService;
      return { gen: new FlashcardGenerator(ctx.repo, ctx.storage, ai, ctx.app.log, 1), calls };
    };
    const answer = (req: ChoicesRequest) => ({
      cards: req.cards.map((c) => ({ card: c.alias, choices: { correct: `Riktig ${c.alias}`, wrong: ['Galt 1', 'Galt 2', 'Galt 3'] } })),
    });

    /** En ferdig kortstokk med tre kort uten alternativer, og jobben for svaralternativer startet (status «generating»). */
    const readyDeck = (): Deck => {
      const deck = ctx.repo.createDeck({ subjectId: own.id, title: 'Styrt', difficulty: 'easy', noteIds: [], count: null });
      ctx.repo.completeDeck(
        deck.id,
        ['Første', 'Andre', 'Tredje'].map((front) => ({ kind: 'concept' as const, front: `${front}?`, back: [front], detail: '', noteId: null })),
        null,
      );
      expect(ctx.repo.startChoices(deck.id)).not.toBeNull();
      return deck;
    };

    beforeAll(() => {
      const t = new Date().toISOString();
      userId = Number(
        ctx.repo.db.prepare(`INSERT INTO users (username, password_hash, plan, created_at, updated_at) VALUES ('styrt-elev', NULL, 'free', ?, ?)`).run(t, t)
          .lastInsertRowid,
      );
      own = ctx.repo.createSubject({ userId, name: 'Fysikk 1', profile: 'physics' });
    });

    it('kjører i jobScope med eieren av kortstokken, ikke den som startet jobben, og rydder i svaret', async () => {
      const deck = readyDeck();
      const [first, second, third] = owned(deck.id) as [Flashcard, Flashcard, Flashcard];
      const { gen, calls } = generatorWith(async () => ({
        cards: [
          { card: 'k1', choices: { correct: ' Riktig ', wrong: ['Galt 1', '**Galt 2**', 'Galt 3', 'Galt 4'] } },
          // Et galt svar er likt det riktige: ingen alternativer til det kortet.
          { card: 'k2', choices: { correct: 'Ja', wrong: ['Nei', 'Ja.', 'Kanskje'] } },
          { card: 'k3', choices: null },
          { card: 'k3', choices: { correct: 'Svar', wrong: ['a', 'b', 'c'] } },
          // Ukjente kort og et kort som allerede er besvart, hoppes over.
          { card: 'k9', choices: { correct: 'x', wrong: ['a', 'b', 'c'] } },
          { card: 'k1', choices: { correct: 'Annet', wrong: ['a', 'b', 'c'] } },
        ],
      }));
      // Startet inne i en annen brukers forespørsel (eierens): forbruket hører likevel til eleven og kortstokken.
      await usageScope({ userId: OWNER_ID, noteId: 'et-notat' }, async () => gen.startChoices(deck.id));
      await gen.idle();
      expect(calls.map((c) => c.ref)).toEqual([{ userId, deckId: deck.id, subjectId: own.id }]);
      expect(ctx.repo.getDeck(deck.id)).toMatchObject({ choicesStatus: null, choicesError: null });
      expect(ctx.repo.getCard(first.id)!.choices).toEqual({ correct: 'Riktig', wrong: ['Galt 1', 'Galt 2', 'Galt 3'] });
      expect(ctx.repo.getCard(second.id)!.choices).toBeNull();
      // Kortet uten brukbare alternativer er avslått; de to andre fikk alternativer.
      expect([first, second, third].map((c) => ctx.repo.getCard(c.id)!.choicesDeclined)).toEqual([false, true, false]);
      expect(ctx.repo.getCard(third.id)!.choices).toEqual({ correct: 'Svar', wrong: ['a', 'b', 'c'] });
    });

    it('et dobbelttrykk gir ikke to jobber', async () => {
      const deck = readyDeck();
      const { gen, calls } = generatorWith(async (req) => answer(req));
      gen.startChoices(deck.id);
      gen.startChoices(deck.id);
      await gen.idle();
      expect(calls).toHaveLength(1);
      expect(owned(deck.id).every((c) => c.choices)).toBe(true);
    });

    it('en stengt konto stopper jobben før AI-kallet', async () => {
      const deck = readyDeck();
      const { gen, calls } = generatorWith(async (req) => answer(req));
      ctx.repo.setDisabled(userId, true);
      try {
        gen.startChoices(deck.id);
        await gen.idle();
      } finally {
        ctx.repo.setDisabled(userId, false);
      }
      expect(calls).toEqual([]);
      expect(ctx.repo.getDeck(deck.id)).toMatchObject({
        choicesStatus: 'failed',
        choicesError: 'Kontoen ble stengt mens svaralternativene ble laget. Prøv igjen når den er åpnet.',
      });
    });

    it('en konto som stenges mens AI-en jobber, får ingenting lagret', async () => {
      const deck = readyDeck();
      const { gen } = generatorWith(async (req) => {
        ctx.repo.setDisabled(userId, true);
        return answer(req);
      });
      try {
        gen.startChoices(deck.id);
        await gen.idle();
      } finally {
        ctx.repo.setDisabled(userId, false);
      }
      expect(owned(deck.id).every((c) => c.choices === null)).toBe(true);
      expect(ctx.repo.getDeck(deck.id)!.choicesStatus).toBe('failed');
    });

    it('en konto som slettes mens AI-en jobber, får ingenting lagret og gir ingen feil', async () => {
      const t = new Date().toISOString();
      const gone = Number(
        ctx.repo.db.prepare(`INSERT INTO users (username, password_hash, plan, created_at, updated_at) VALUES ('slettes', NULL, 'free', ?, ?)`).run(t, t)
          .lastInsertRowid,
      );
      const s = ctx.repo.createSubject({ userId: gone, name: 'Fysikk 1', profile: 'physics' });
      const deck = ctx.repo.createDeck({ subjectId: s.id, title: 'Slettes', difficulty: 'easy', noteIds: [], count: null });
      ctx.repo.completeDeck(deck.id, [{ kind: 'concept', front: 'Hva?', back: ['Dette'], detail: '', noteId: null }], null);
      ctx.repo.startChoices(deck.id);
      const error = vi.spyOn(ctx.app.log, 'error');
      onTestFinished(() => error.mockRestore());
      const { gen, calls } = generatorWith(async (req) => {
        expect(ctx.repo.deleteUser(gone)).not.toBeNull();
        return answer(req);
      });
      gen.startChoices(deck.id);
      await gen.idle();
      expect(calls).toHaveLength(1);
      expect(ctx.repo.getDeckRow(deck.id)).toBeNull();
      expect(ctx.repo.db.prepare(`SELECT COUNT(*) AS n FROM cards WHERE deck_id = ?`).get(deck.id)).toEqual({ n: 0 });
      expect(error).not.toHaveBeenCalled();
      // En jobb for en konto som allerede er slettet, gjør ingenting.
      gen.startChoices(deck.id);
      await gen.idle();
      expect(calls).toHaveLength(1);
    });

    it('midlertidige feil prøves igjen; vedvarer de, kan eleven trykke «Prøv igjen»', async () => {
      const deck = readyDeck();
      let n = 0;
      const once = generatorWith(async (req) => {
        if (++n === 1) throw new ConversionError('Claude har for mange forespørsler akkurat nå. Prøver igjen om litt.', true);
        return answer(req);
      });
      once.gen.startChoices(deck.id);
      await once.gen.idle();
      expect(once.calls).toHaveLength(2);
      expect(ctx.repo.getDeck(deck.id)!.choicesStatus).toBeNull();
      expect(owned(deck.id).every((c) => c.choices)).toBe(true);

      const busy = readyDeck();
      const always = generatorWith(async () => {
        throw new ConversionError('Fikk ikke kontakt med Claude. Prøver igjen om litt.', true);
      });
      always.gen.startChoices(busy.id);
      await always.gen.idle();
      expect(always.calls).toHaveLength(3);
      expect(ctx.repo.getDeck(busy.id)).toMatchObject({ choicesStatus: 'failed', choicesError: 'Fikk ikke kontakt med AI-en. Trykk «Prøv igjen» om litt.' });

      // En uventet feil (ikke fra AI-en) gir en generell melding.
      const odd = readyDeck();
      const crash = generatorWith(async () => {
        throw new TypeError('x is undefined');
      });
      crash.gen.startChoices(odd.id);
      await crash.gen.idle();
      expect(ctx.repo.getDeck(odd.id)!.choicesError).toBe('Uventet feil da svaralternativene skulle lages. Prøv igjen.');
    });

    it('avbrutt ved nedstengning: ingenting lagres, og jobben fortsetter ved neste oppstart', async () => {
      const deck = readyDeck();
      const aborted = generatorWith(async () => {
        throw new AbortedError('Serveren startet på nytt. Prøver igjen om litt.');
      });
      aborted.gen.startChoices(deck.id);
      await aborted.gen.idle();
      expect(ctx.repo.getDeck(deck.id)!.choicesStatus).toBe('generating');
      expect(ctx.repo.generatingChoicesDeckIds()).toContain(deck.id);

      // Serveren stenger mens jobben venter på et nytt forsøk: ingen feilmelding.
      const stopping = generatorWith(async () => {
        stopping.gen.stop();
        throw new ConversionError('Fikk ikke kontakt med Claude. Prøver igjen om litt.', true);
      });
      stopping.gen.startChoices(deck.id);
      await stopping.gen.idle();
      expect(ctx.repo.getDeck(deck.id)!.choicesStatus).toBe('generating');
      // En stoppet generator tar ikke nye jobber.
      stopping.gen.startChoices(deck.id);
      expect(stopping.calls).toHaveLength(1);

      const next = generatorWith(async (req) => answer(req));
      next.gen.startChoices(deck.id);
      await next.gen.idle();
      expect(ctx.repo.getDeck(deck.id)!.choicesStatus).toBeNull();
      expect(owned(deck.id).every((c) => c.choices)).toBe(true);
    });
  });
});

describe('migrering 9 (flervalg)', () => {
  it('gir kort og kortstokker de nye feltene uten å endre noe som finnes', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'smartnotes-migrering9-'));
    const file = path.join(dir, 'db.sqlite');
    const old = new Repo(file, { migrateTo: 8 });
    const s = old.createSubject({ userId: OWNER_ID, name: 'Fysikk 1', profile: 'physics' });
    const t = new Date().toISOString();
    old.db.exec(`
      INSERT INTO decks (id, subject_id, title, difficulty, note_ids, status, best, rev, created_at, updated_at)
        VALUES ('d1', '${s.id}', 'Krefter', 'medium', '[]', 'ready', 4, 10, '${t}', '${t}');
      INSERT INTO cards (id, deck_id, note_id, kind, front, back, level, rev, created_at, updated_at)
        VALUES ('k1', 'd1', NULL, 'concept', 'Hva er kraft?', '["Masse ganger akselerasjon"]', 2, 11, '${t}', '${t}');
      UPDATE meta SET value = '11' WHERE key = 'rev';
    `);
    old.close();
    const repo = new Repo(file);
    try {
      expect(repo.db.pragma('user_version', { simple: true })).toBe(9);
      expect(repo.currentRev()).toBe(11);
      expect(repo.getDeckRow('d1')).toMatchObject({ with_choices: 0, choices_status: null, choices_error: null });
      const all = repo.sync(OWNER_ID, 0);
      expect(all.decks).toEqual([expect.objectContaining({ id: 'd1', best: 4, choicesStatus: null, choicesError: null })]);
      expect(all.cards).toEqual([expect.objectContaining({ id: 'k1', level: 2, choices: null, choicesDeclined: false })]);
      // Ingen rader har fått ny rev: en enhet med cursoren fra før får ingenting nytt (appen synker alt på nytt selv).
      expect([repo.sync(OWNER_ID, 11).decks, repo.sync(OWNER_ID, 11).cards].flat()).toEqual([]);
      // En ødelagt verdi gir ingen alternativer i stedet for en feil.
      repo.db.prepare(`UPDATE cards SET choices = '{"correct": 1}' WHERE id = 'k1'`).run();
      expect(repo.getCard('k1')!.choices).toBeNull();
    } finally {
      repo.close();
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('svar fra Claude', () => {
  const text = (t: string, stop: string | null = 'end_turn') => ({ stop_reason: stop, content: [{ type: 'text', text: t }] });
  const ok = JSON.stringify({ cards: [{ note: 'n1', kind: 'concept', front: 'Hva er fart?', back: ['s/t'], detail: '' }] });

  it('tolker kortene og gir norske meldinger ved avslag, avkuttet svar og ugyldig JSON', () => {
    expect(parseFlashcardMessage(text(ok))).toHaveLength(1);
    expect(() => parseFlashcardMessage(text(ok.slice(0, 40), 'max_tokens'))).toThrow('Utvalget ble for stort. Velg færre notater eller færre kort.');
    expect(() => parseFlashcardMessage(text('{"cards": [', 'refusal'))).toThrow('Claude avslo å lage kort av disse notatene.');
    // Bare avslag sendes videre til reservemodellen (RefusalFallback), ikke avkuttede eller ugyldige svar.
    expect(() => parseFlashcardMessage(text('{"cards": [', 'refusal'))).toThrow(RefusalError);
    expect(() => parseFlashcardMessage(text(ok.slice(0, 40), 'max_tokens'))).not.toThrow(RefusalError);
    expect(flashcardError(new RefusalError('Claude avslo å lage kort av disse notatene.'))).toBeInstanceOf(RefusalError);
    expect(() => parseFlashcardMessage(text('{"cards": ['))).toThrow('Claude svarte ikke med kort. Prøv igjen.');
    expect(() => parseFlashcardMessage(text('{"kort": []}'))).toThrow('Claude svarte ikke med kort. Prøv igjen.');
  });

  it('feilmeldingene handler om kort, ikke om konvertering', () => {
    expect(flashcardError(new Error('x')).message).toBe('Uventet feil da kortene skulle lages. Prøv igjen.');
    expect(choicesError(new Error('x')).message).toBe('Uventet feil da svaralternativene skulle lages. Prøv igjen.');
    expect(choicesError(new RefusalError('Claude avslo å lage svaralternativer til disse kortene.'))).toBeInstanceOf(RefusalError);
  });

  it('svaralternativene i kortene leses bare når de ble bedt om', () => {
    const choices = { correct: 'Strekning per tid', wrong: ['a', 'b', 'c'] };
    const withChoices = JSON.stringify({ cards: [{ note: 'n1', kind: 'concept', front: 'Hva er fart?', back: ['s/t'], detail: '', choices }] });
    expect(parseFlashcardMessage(text(withChoices), true)[0]!.choices).toEqual(choices);
    // Uten avkrysningen er skjemaet som før, og et felt modellen likevel sendte, forsvinner.
    expect(parseFlashcardMessage(text(withChoices))[0]).not.toHaveProperty('choices');
    // Med avkrysningen må hvert kort ha feltet (null for kort som ikke passer).
    expect(() => parseFlashcardMessage(text(ok), true)).toThrow('Claude svarte ikke med kort. Prøv igjen.');
  });

  it('tolker svaralternativer til kort som finnes, med egne norske meldinger', () => {
    const answer = JSON.stringify({ cards: [{ card: 'k1', choices: { correct: 'Joule', wrong: ['Watt', 'Newton', 'Pascal'] } }, { card: 'k2', choices: null }] });
    expect(parseChoicesMessage(text(answer))).toEqual([
      { card: 'k1', choices: { correct: 'Joule', wrong: ['Watt', 'Newton', 'Pascal'] } },
      { card: 'k2', choices: null },
    ]);
    expect(() => parseChoicesMessage(text('{"cards": [', 'refusal'))).toThrow(RefusalError);
    expect(() => parseChoicesMessage(text('{"cards": [', 'refusal'))).toThrow('Claude avslo å lage svaralternativer til disse kortene.');
    expect(() => parseChoicesMessage(text(answer.slice(0, 30), 'max_tokens'))).toThrow(
      'Kortstokken har for mange kort til at svaralternativene kan lages i én omgang. Slett noen kort, og prøv igjen.',
    );
    expect(() => parseChoicesMessage(text(ok))).toThrow('Claude svarte ikke med svaralternativer. Prøv igjen.');
  });
});

describe('opprydding og ledetekst', () => {
  it('rydder i kortene fra Claude', () => {
    const aliases = new Map([['n1', 'note-1']]);
    const out = cleanFlashcards(
      [
        { note: 'n1', kind: 'concept', front: ' Hva er fart? ', back: [' Strekning per tid ', '', '!'], detail: ' Forklaring ' },
        { note: 'n1', kind: 'concept', front: 'hva er  FART?', back: ['Duplikat'], detail: '' },
        { note: 'n9', kind: 'quiz', front: 'Ukjent type', back: ['x'], detail: '' },
        { note: 'n1', kind: 'apply', front: 'Uten svar', back: ['  '], detail: '' },
      ],
      aliases,
    );
    expect(out).toEqual([
      { kind: 'concept', front: 'Hva er fart?', back: ['Strekning per tid'], detail: 'Forklaring', choices: null, noteId: 'note-1' },
      { kind: 'concept', front: 'Ukjent type', back: ['x'], detail: '', choices: null, noteId: null },
    ]);
    const many = Array.from({ length: 200 }, (_, i) => ({ note: 'n1', kind: 'explain', front: `Spørsmål ${i}`, back: ['svar'], detail: '' }));
    expect(cleanFlashcards(many, aliases)).toHaveLength(MAX_CARDS);
  });

  it('rydder i svaralternativene fra AI-en', () => {
    const wrong = ['Galt 1', 'Galt 2', 'Galt 3'];
    expect(cleanChoices(null)).toBeNull();
    expect(cleanChoices(undefined)).toBeNull();
    // Én linje, uten **fet** skrift, og de tre første brukbare gale svarene.
    expect(cleanChoices({ correct: ' **Newton**\n(N) ', wrong: ['Galt  1', ...wrong.slice(1), 'Galt 4'] })).toEqual({ correct: 'Newton (N)', wrong });
    // Like eller tomme gale svar hoppes over; er det færre enn tre igjen, får kortet ingen alternativer.
    expect(cleanChoices({ correct: 'Ja', wrong: ['Ja.', 'Nei', ' ', 'Nei!', 'Kanskje', 'Aldri', 'Alltid'] })).toEqual({ correct: 'Ja', wrong: ['Nei', 'Kanskje', 'Aldri'] });
    expect(cleanChoices({ correct: 'Ja', wrong: ['Ja.', 'Nei', 'Nei.', 'Kanskje'] })).toBeNull();
    expect(cleanChoices({ correct: 'Ja', wrong: ['Nei', 'Kanskje'] })).toBeNull();
    // For lange svar og formler som ikke lukkes.
    expect(cleanChoices({ correct: 'x'.repeat(MAX_CHOICE_CHARS + 1), wrong })).toBeNull();
    expect(cleanChoices({ correct: 'Ja', wrong: [...wrong.slice(0, 2), 'y'.repeat(MAX_CHOICE_CHARS + 1)] })).toBeNull();
    expect(cleanChoices({ correct: '$F = ma', wrong })).toBeNull();
    expect(cleanChoices({ correct: '$F = ma$', wrong: ['$F = m/a', ...wrong] })).toEqual({ correct: '$F = ma$', wrong });
    // Et dollartegn med backslash foran er ikke en formel.
    expect(cleanChoices({ correct: 'Koster \\$5', wrong })).toEqual({ correct: 'Koster \\$5', wrong });
    expect(cleanChoices({ correct: ' . ', wrong })).toBeNull();

    const cards = new Map([
      ['k1', 'kort-1'],
      ['k2', 'kort-2'],
    ]);
    expect(
      cleanCardChoices(
        [
          { card: 'k2', choices: null },
          { card: ' k1 ', choices: { correct: 'A', wrong } },
          { card: 'k1', choices: { correct: 'B', wrong } },
          { card: 'k3', choices: { correct: 'C', wrong } },
          { card: 'k2', choices: { correct: 'D', wrong } },
        ],
        cards,
      ),
    ).toEqual([
      { card: 'kort-1', choices: { correct: 'A', wrong } },
      { card: 'kort-2', choices: { correct: 'D', wrong } },
    ]);

    // cleanFlashcards: brukbare alternativer beholdes, resten blir null.
    const out = cleanFlashcards(
      [
        { note: 'n1', kind: 'concept', front: 'Hva er g?', back: ['9,81 m/s²'], detail: '', choices: { correct: '9,81 m/s²', wrong: ['9,81 m/s', '98,1 m/s²', '1,0 m/s²'] } },
        { note: 'n1', kind: 'explain', front: 'Hvorfor?', back: ['Fordi'], detail: '', choices: null },
        { note: 'n1', kind: 'apply', front: 'Regn ut', back: ['6 N'], detail: '', choices: { correct: '6 N', wrong: ['6 N.', '5 N', '4 N'] } },
      ],
      new Map([['n1', 'note-1']]),
    );
    expect(out.map((c) => c.choices)).toEqual([{ correct: '9,81 m/s²', wrong: ['9,81 m/s', '98,1 m/s²', '1,0 m/s²'] }, null, null]);
  });

  it('uten «Lag også svaralternativer» er instruksen, brukermeldingen og skjemaet byte for byte som før', () => {
    const sha = (s: string) => createHash('sha256').update(s).digest('hex');
    const req: FlashcardRequest = {
      subjectName: 'Fysikk 1',
      subjectLabel: 'Fysikk',
      difficulty: 'mixed',
      count: null,
      notes: [
        { alias: 'n1', title: 'Kraft', chapter: '2 Krefter', section: '2E Newtons 2. lov', date: '2026-09-01', body: 'Innhold $F = ma$' },
        { alias: 'n2', title: 'Fart', chapter: null, section: null, date: null, body: 'Mer' },
      ],
    };
    // Fingeravtrykkene er regnet ut fra versjonen før flervalg (main etter #33).
    expect(sha(FLASHCARD_SYSTEM_PROMPT)).toBe('73168f148febe1a296f99846071b78655b265d53260ece50cb62b7839b8d3210');
    expect(sha(buildFlashcardPrompt(req))).toBe('76856ad10c2541ded41ddb5c544ec678abdd09d5175f9b8dc60b84b76d0f0504');
    expect(sha(buildFlashcardPrompt({ ...req, count: 20 }))).toBe('32bf14294454490d0e586cbba2ec96e4ad1dbdff00f6453664de893a6dbffd7f');
    expect(sha(JSON.stringify(z.toJSONSchema(flashcardSchema)))).toBe('3162baaa54614acb3c18d541f8b1c9a19e0bd2f7b7277af88d90528733d8dc53');
    expect(sha(JSON.stringify(zodOutputFormat(flashcardSchema).schema))).toBe('ef57f3c51cf3f588c0eb6b187f6396c08eda3eaef38f3e335f9cf465de56660b');
    // Det er dette som sendes når eleven ikke har krysset av (feltet utelatt eller false).
    for (const withChoices of [undefined, false]) {
      expect(flashcardSystemPrompt(withChoices)).toBe(FLASHCARD_SYSTEM_PROMPT);
      expect(buildFlashcardPrompt({ ...req, withChoices })).toBe(buildFlashcardPrompt(req));
      expect(flashcardSchemaFor(withChoices)).toBe(flashcardSchema);
    }
  });

  it('med «Lag også svaralternativer» får instruksen en egen del, og skjemaet feltet "choices"', () => {
    const req: FlashcardRequest = { subjectName: 'Kjemi 1', subjectLabel: 'Kjemi', difficulty: 'easy', count: 10, notes: [], withChoices: true };
    const system = flashcardSystemPrompt(true);
    expect(system.startsWith(FLASHCARD_SYSTEM_PROMPT.slice(0, FLASHCARD_SYSTEM_PROMPT.lastIndexOf('\n\nSvar\n')))).toBe(true);
    expect(system.endsWith(FLASHCARD_SYSTEM_PROMPT.slice(FLASHCARD_SYSTEM_PROMPT.lastIndexOf('\n\nSvar\n')))).toBe(true);
    expect(system.split('Svaralternativer ("choices")')).toHaveLength(2);
    expect(system.indexOf('Svaralternativer ("choices")')).toBeLessThan(system.lastIndexOf('\n\nSvar\n'));
    expect(system).toContain(`høyst ${MAX_CHOICE_CHARS}`);
    expect(system).toContain('Sett "choices" til null');
    // Regnekort får sluttsvaret som riktig svar; gale svar kan hentes utenfor kortet, men aldri være et annet riktig svar.
    for (const prompt of [system, CHOICES_SYSTEM_PROMPT]) {
      expect(prompt).toContain('"correct" sluttsvaret');
      expect(prompt).toContain('også når de ikke står på kortet');
      expect(prompt).toContain('som et annet riktig svar når spørsmålet har flere');
      expect(prompt).not.toContain('lange utregninger');
    }
    expect(CHOICES_SYSTEM_PROMPT).toContain('Skriv på norsk bokmål');
    expect(CHOICES_SYSTEM_PROMPT).not.toContain('Ikke ta med stoff kortet ikke har');
    expect(buildFlashcardPrompt(req)).toContain('Svaralternativer: ja.');
    expect(buildFlashcardPrompt({ ...req, withChoices: false })).not.toContain('Svaralternativer');
    expect(flashcardSchemaFor(true)).toBe(flashcardChoicesSchema);
    expect(JSON.stringify(zodOutputFormat(flashcardChoicesSchema).schema)).toContain('"choices"');

    // Instruksen for kort som finnes, har de samme reglene, og brukermeldingen bare kortenes tekst.
    expect(CHOICES_SYSTEM_PROMPT).toContain(`høyst ${MAX_CHOICE_CHARS}`);
    expect(CHOICES_SYSTEM_PROMPT).toContain('"card" er id-en til kortet');
    expect(CHOICES_SYSTEM_PROMPT).not.toMatch(/\d{4}-\d{2}-\d{2}/);
    expect(
      buildChoicesPrompt({
        subjectName: 'Kjemi 1',
        subjectLabel: 'Kjemi',
        cards: [{ alias: 'k1', kind: 'apply', front: ' Hva er pH i $\\ce{HCl}$? ', back: ['!Svar', 'pH = 1'] }],
      }),
    ).toBe(
      ['Fag: Kjemi 1 (kjemi)', '', '<cards>', '<card id="k1" kind="apply">', 'Spørsmål: Hva er pH i $\\ce{HCl}$?', 'Svar:', '- !Svar', '- pH = 1', '</card>', '</cards>', '', 'Lag svaralternativer til kortene.'].join('\n'),
    );
  });

  it('navn på kortstokken', () => {
    expect(defaultDeckTitle([{ title: 'Newtons lover', chapter: null }])).toBe('Newtons lover');
    const ch = { number: '2', title: 'Krefter' };
    expect(defaultDeckTitle([{ title: 'a', chapter: ch }, { title: 'b', chapter: ch }])).toBe('2 Krefter');
    expect(defaultDeckTitle([{ title: 'a', chapter: ch }, { title: 'b', chapter: null }])).toBe('2 notater');
  });

  it('ledeteksten har notatene, vanskelighetsgraden og antallet', () => {
    const text = buildFlashcardPrompt({
      subjectName: 'Fysikk 1',
      subjectLabel: 'Fysikk',
      difficulty: 'hard',
      count: 20,
      notes: [{ alias: 'n1', title: 'Kraft "og" bevegelse', chapter: '2 Krefter', section: '2.2 Newtons lover', date: '2026-09-01', body: 'Innhold' }],
    });
    expect(text).toContain('Vanskelighetsgrad: hard');
    expect(text).toContain('omtrent 20 til sammen');
    expect(text).toContain(`<note id="n1" title="Kraft 'og' bevegelse" chapter="2 Krefter" section="2.2 Newtons lover" date="2026-09-01">`);
    expect(noteSourceText('% kommentar\nTekst\n\n\n\nMer')).toBe('Tekst\n\nMer');
  });
});
