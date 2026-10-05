import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Deck, Flashcard, ProgressResponse, Subject, SyncResponse } from '@smartnotes/shared';
import { buildApp, type AppContext } from '../src/app.js';
import { loadConfig } from '../src/config.js';
import { buildFlashcardPrompt, cleanFlashcards, defaultDeckTitle, noteSourceText, MAX_CARDS } from '../src/flashcards/prompt.js';
import { FakeClaude } from '../src/pipeline/claude.js';

/** Flashcards: kortstokker fra notater, redigering av kort og fremgang som synkes mellom enheter. */
let ctx: AppContext;
let dataDir = '';
let cookie = '';
let subject: Subject;

async function inject<T>(method: string, url: string, payload?: unknown): Promise<{ status: number; body: T }> {
  const res = await ctx.app.inject({
    method: method as 'GET',
    url,
    headers: { cookie, 'x-smartnotes': '1', ...(payload !== undefined ? { 'content-type': 'application/json' } : {}) },
    payload: payload !== undefined ? JSON.stringify(payload) : undefined,
  });
  return { status: res.statusCode, body: res.json() as T };
}

async function sync(since = 0): Promise<SyncResponse> {
  return (await inject<SyncResponse>('GET', `/api/sync?since=${since}`)).body;
}

/** Et ferdig konvertert notat (uten å gå via opplasting og LaTeX). */
function doneNote(opts: { title: string; chapterId?: string | null; section?: string | null; body?: string; done?: boolean }): string {
  const id = randomUUID();
  ctx.repo.createNote({
    id,
    subjectId: subject.id,
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
  const config = loadConfig({ ...process.env, NODE_ENV: 'test', DATA_DIR: dataDir, APP_PASSWORD: 'pw', WEB_DIST: '', SEED_TEXTBOOKS: 'ergo-fysikk-1' });
  ctx = await buildApp({ ...config, webDist: null }, { claude: new FakeClaude(5), logger: false });
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
    expect(notDone.body.message).toBe('Ingen av notatene er ferdig konvertert ennå.');

    const ready = doneNote({ title: 'Ferdig' });
    const mixed = await inject<{ message: string }>('POST', '/api/decks', { subjectId: subject.id, noteIds: [ready, pending], difficulty: 'easy' });
    expect(mixed.body.message).toMatch(/^Ett av notatene er ikke ferdig konvertert ennå/);

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

    // En annen enhet som var offline, sender en eldre vurdering: ignoreres.
    const older = await progress([{ id: card.id, level: 0, at: '2026-09-10T11:00:00.000Z' }]);
    expect(older.body.cards).toEqual([]);
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
    expect(down.body.decks).toEqual([]);
    expect(ctx.repo.getDeck(deck.id)!.best).toBe(7);
  });

  it('endringer synkes til andre enheter, og ukjente kort hoppes over', async () => {
    const cursor = (await sync()).cursor;
    const res = await progress([
      { id: card.id, level: 2, at: new Date().toISOString() },
      { id: randomUUID(), level: 2, at: new Date().toISOString() },
    ]);
    expect(res.status).toBe(200);
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
      { kind: 'concept', front: 'Hva er fart?', back: ['Strekning per tid'], detail: 'Forklaring', noteId: 'note-1' },
      { kind: 'concept', front: 'Ukjent type', back: ['x'], detail: '', noteId: null },
    ]);
    const many = Array.from({ length: 200 }, (_, i) => ({ note: 'n1', kind: 'explain', front: `Spørsmål ${i}`, back: ['svar'], detail: '' }));
    expect(cleanFlashcards(many, aliases)).toHaveLength(MAX_CARDS);
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
      notes: [{ alias: 'n1', title: 'Kraft "og" bevegelse', chapter: '2 Krefter', section: '2E Newtons 2. lov', date: '2026-09-01', body: 'Innhold' }],
    });
    expect(text).toContain('Vanskelighetsgrad: hard');
    expect(text).toContain('omtrent 20 til sammen');
    expect(text).toContain(`<note id="n1" title="Kraft 'og' bevegelse" chapter="2 Krefter" section="2E Newtons 2. lov" date="2026-09-01">`);
    expect(noteSourceText('% kommentar\nTekst\n\n\n\nMer')).toBe('Tekst\n\nMer');
  });
});
