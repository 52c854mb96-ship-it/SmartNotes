import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { ComparisonSummaryResponse, Note, NoteComparisonResponse, Subject, SyncResponse } from '@smartnotes/shared';
import { buildApp, type AppContext } from '../src/app.js';
import { loadConfig } from '../src/config.js';
import type { AiService, ConvertRequest, ConvertResult } from '../src/pipeline/ai.js';
import { FakeClaude, RefusalError } from '../src/pipeline/claude.js';
import { zeroUsage } from '../src/usage.js';

/** Haiku som avslår, og teller kallene (for å vise at Sonnet ikke tar over i sammenligningen). */
class RefusingHaiku extends FakeClaude {
  calls = 0;
  override async convert(): Promise<ConvertResult> {
    this.calls++;
    const err = new RefusalError('Claude avslo å konvertere dette notatet.');
    err.usage = zeroUsage('convert', 'fake-claude');
    throw err;
  }
}

/** Haiku som bruker litt tid, så notatet kan slettes mens den leser. */
class SlowHaiku extends FakeClaude {
  release: () => void = () => {};
  // Feltene settes i rekkefølge, så onStart må stå før `started` (ellers overskrives den).
  private onStart: () => void = () => {};
  readonly started = new Promise<void>((r) => (this.onStart = r));
  override async convert(req: ConvertRequest): Promise<ConvertResult> {
    this.onStart();
    await new Promise<void>((r) => (this.release = r));
    return super.convert(req);
  }
}

interface Env {
  ctx: AppContext;
  dataDir: string;
  /** Rå forespørsel med innloggingen (for PDF-er). */
  fetch: (url: string) => Promise<Response>;
  call: <T>(method: string, url: string, opts?: { json?: unknown; form?: FormData; auth?: boolean }) => Promise<{ status: number; body: T }>;
}

async function startApp(compareAi?: AiService, dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'smartnotes-compare-'))): Promise<Env> {
  const config = loadConfig({ ...process.env, NODE_ENV: 'test', DATA_DIR: dataDir, APP_PASSWORD: 'hemmelig', WEB_DIST: '', SEED_TEXTBOOKS: 'none' });
  const ctx = await buildApp({ ...config, webDist: null }, { ai: new FakeClaude(5), compareAi, logger: false });
  ctx.worker.start();
  await ctx.app.listen({ port: 0, host: '127.0.0.1' });
  const addr = ctx.app.server.address();
  const base = `http://127.0.0.1:${typeof addr === 'object' && addr ? addr.port : 0}`;
  let cookie = '';
  const call: Env['call'] = async (method, url, opts = {}) => {
    const headers: Record<string, string> = { 'x-smartnotes': '1', ...(cookie && opts.auth !== false ? { cookie } : {}) };
    let body: string | FormData | undefined;
    if (opts.json !== undefined) {
      headers['content-type'] = 'application/json';
      body = JSON.stringify(opts.json);
    } else body = opts.form;
    const res = await fetch(base + url, { method, headers, body });
    const text = res.headers.get('content-type')?.includes('json') ? await res.text() : '';
    if (!text) await res.arrayBuffer().catch(() => undefined);
    return { status: res.status, body: (text ? JSON.parse(text) : null) as never };
  };
  const login = await fetch(`${base}/api/auth/login`, {
    method: 'POST',
    headers: { 'x-smartnotes': '1', 'content-type': 'application/json' },
    body: JSON.stringify({ password: 'hemmelig' }),
  });
  cookie = (login.headers.get('set-cookie') ?? '').split(';')[0]!;
  return { ctx, dataDir, call, fetch: (url) => fetch(base + url, { headers: { cookie } }) };
}

async function stopApp(env: Env | undefined): Promise<void> {
  await env?.ctx.worker.stop();
  await env?.ctx.comparer.idle();
  await env?.ctx.app.close();
}

/** Laster opp et notat og venter til den vanlige konverteringen er ferdig. */
async function convertedNote(env: Env, instructions = ''): Promise<Note> {
  const subject = (await env.call<Subject>('POST', '/api/subjects', { json: { name: 'Fysikk 1', profile: 'physics' } })).body;
  const png = await sharp({ create: { width: 1200, height: 1600, channels: 3, background: '#fff' } }).png().toBuffer();
  const form = new FormData();
  form.append('subjectId', subject.id);
  form.append('clientId', `klient-${Math.random()}`);
  if (instructions) form.append('instructions', instructions);
  form.append('files', new Blob([new Uint8Array(png)], { type: 'image/png' }), 's.png');
  const note = (await env.call<Note>('POST', '/api/notes', { form })).body;
  for (const start = Date.now(); Date.now() - start < 60_000; await new Promise((r) => setTimeout(r, 100))) {
    const n = (await env.call<SyncResponse>('GET', '/api/sync?since=0')).body.notes.find((x) => x.id === note.id);
    if (n?.status === 'done') return n;
    if (n?.status === 'failed') throw new Error(`konverteringen feilet: ${n.error}`);
  }
  throw new Error('konverteringen ble ikke ferdig');
}

const noteFiles = (env: Env, id: string) => {
  const dir = path.join(env.dataDir, 'notes', id);
  const out: Record<string, string> = {};
  for (const e of fs.readdirSync(dir, { recursive: true, withFileTypes: true }) as fs.Dirent[]) {
    const rel = path.relative(dir, path.join(e.parentPath, e.name));
    if (e.isFile() && !rel.startsWith('compare')) out[rel] = fs.readFileSync(path.join(dir, rel)).toString('base64');
  }
  return out;
};

describe('sammenligning med Haiku', () => {
  let env: Env;
  let note: Note;

  beforeAll(async () => {
    env = await startApp();
    note = await convertedNote(env);
  }, 90_000);
  afterAll(() => stopApp(env));

  it('krever innlogging', async () => {
    expect((await env.call('GET', `/api/notes/${note.id}/compare`, { auth: false })).status).toBe(401);
    expect((await env.call('POST', `/api/notes/${note.id}/compare`, { auth: false })).status).toBe(401);
    expect((await env.call('GET', '/api/compare/summary', { auth: false })).status).toBe(401);
  });

  it('har ingen sammenligning før den er laget, og ingenting å vurdere', async () => {
    expect((await env.call<NoteComparisonResponse>('GET', `/api/notes/${note.id}/compare`)).body).toEqual({ comparison: null });
    expect((await env.call('GET', `/api/notes/${note.id}/compare/pdf`)).status).toBe(404);
    expect((await env.call('PUT', `/api/notes/${note.id}/compare/rating`, { json: { verdict: 'haiku_ok' } })).status).toBe(404);
  });

  it('lager en Haiku-versjon ved siden av, uten å endre notatet, PDF-en eller synken', async () => {
    const before = noteFiles(env, note.id);
    const cursor = (await env.call<SyncResponse>('GET', '/api/sync?since=0')).body.cursor;
    const usageBefore = env.ctx.repo.usageSince(0).filter((u) => u.noteId === note.id).length;

    const started = await env.call<NoteComparisonResponse>('POST', `/api/notes/${note.id}/compare`);
    expect(started.status).toBe(202);
    expect(started.body.comparison).toMatchObject({ status: 'running', pageCount: 1, verdict: null, baseModel: 'fake-claude' });
    // To samtidige kjøringer for samme notat går ikke.
    expect((await env.call('POST', `/api/notes/${note.id}/compare`)).status).toBe(409);

    await env.ctx.comparer.idle();
    const done = (await env.call<NoteComparisonResponse>('GET', `/api/notes/${note.id}/compare`)).body.comparison!;
    expect(done).toMatchObject({ status: 'done', stage: null, error: null, baseChanged: false, costNok: 0 });
    expect(done.finishedAt).not.toBeNull();

    const pdf = await env.fetch(`/api/notes/${note.id}/compare/pdf?download=1`);
    expect(pdf.status).toBe(200);
    expect(pdf.headers.get('content-type')).toBe('application/pdf');
    expect(pdf.headers.get('content-disposition')).toMatch(/^attachment; filename=".+-haiku\.pdf"$/);
    expect(Buffer.from(await pdf.arrayBuffer()).subarray(0, 4).toString()).toBe('%PDF');
    const dir = path.join(env.dataDir, 'notes', note.id, 'compare', 'haiku');
    expect(fs.readdirSync(dir).sort()).toEqual(['build.log', 'figures', 'meta.json', 'note.pdf', 'note.tex']);

    // Notatet er urørt: samme filer, ingen endrede rader i synken, og samme PDF-nummer.
    expect(noteFiles(env, note.id)).toEqual(before);
    const after = (await env.call<SyncResponse>('GET', `/api/sync?since=${cursor}`)).body;
    expect(after.notes).toEqual([]);
    expect(env.ctx.repo.getNoteRow(note.id)!.pdf_rev).toBe(note.pdfRev);
    // Kallene står i forbruksloggen under notatet.
    expect(env.ctx.repo.usageSince(0).filter((u) => u.noteId === note.id).length).toBeGreaterThan(usageBefore);
    // Ingen midlertidige mapper igjen.
    expect(fs.readdirSync(path.join(env.dataDir, 'tmp')).filter((n) => n.startsWith('compare-'))).toEqual([]);
  });

  it('lagrer vurderingen og viser den i oppsummeringen', async () => {
    const tooLong = await env.call('PUT', `/api/notes/${note.id}/compare/rating`, { json: { verdict: 'haiku_ok', comment: 'x'.repeat(2001) } });
    expect(tooLong.status).toBe(400);
    expect((await env.call('PUT', `/api/notes/${note.id}/compare/rating`, { json: { verdict: 'kanskje' } })).status).toBe(400);
    const rated = await env.call<NoteComparisonResponse>('PUT', `/api/notes/${note.id}/compare/rating`, {
      json: { verdict: 'haiku_ok', comment: '  Like bra, men figuren ble litt liten.  ' },
    });
    expect(rated.status).toBe(200);
    expect(rated.body.comparison).toMatchObject({ verdict: 'haiku_ok', comment: 'Like bra, men figuren ble litt liten.' });
    const summary = (await env.call<ComparisonSummaryResponse>('GET', '/api/compare/summary')).body;
    expect(summary).toMatchObject({ rated: 1, haikuOk: 1, sonnetBetter: 0, failed: 0, unrated: 0 });
    expect(summary.items).toEqual([
      expect.objectContaining({ noteId: note.id, deleted: false, verdict: 'haiku_ok', comment: 'Like bra, men figuren ble litt liten.' }),
    ]);
    // En tom kommentar lagres som ingen kommentar, og vurderingen kan endres.
    const changed = await env.call<NoteComparisonResponse>('PUT', `/api/notes/${note.id}/compare/rating`, { json: { verdict: 'sonnet_better', comment: ' ' } });
    expect(changed.body.comparison).toMatchObject({ verdict: 'sonnet_better', comment: null });
  });

  it('starter på nytt og nullstiller vurderingen, og merker når den vanlige versjonen er endret', async () => {
    expect((await env.call('POST', `/api/notes/${note.id}/compare`)).status).toBe(202);
    await env.ctx.comparer.idle();
    const again = (await env.call<NoteComparisonResponse>('GET', `/api/notes/${note.id}/compare`)).body.comparison!;
    expect(again).toMatchObject({ status: 'done', verdict: null, comment: null, ratedAt: null });
    // Endres LaTeX-koden til den vanlige versjonen, får den et nytt PDF-nummer.
    const body = fs.readFileSync(path.join(env.dataDir, 'notes', note.id, 'note.tex'), 'utf8');
    expect((await env.call<{ ok: boolean }>('PUT', `/api/notes/${note.id}/latex`, { json: { body: `${body}\n\nTillegg.\n` } })).body.ok).toBe(true);
    expect((await env.call<NoteComparisonResponse>('GET', `/api/notes/${note.id}/compare`)).body.comparison!.baseChanged).toBe(true);
  });

  it('går ikke for et notat som ikke er ferdig konvertert', async () => {
    const subject = (await env.call<Subject>('POST', '/api/subjects', { json: { name: 'Tomt', profile: 'physics' } })).body;
    const form = new FormData();
    form.append('subjectId', subject.id);
    form.append('clientId', 'klient-venter');
    form.append('files', new Blob([new Uint8Array(await sharp({ create: { width: 800, height: 1000, channels: 3, background: '#fff' } }).png().toBuffer())], { type: 'image/png' }), 's.png');
    const queued = (await env.call<Note>('POST', '/api/notes', { form })).body;
    const res = await env.call<{ message: string }>('POST', `/api/notes/${queued.id}/compare`);
    expect(res.status).toBe(409);
    expect(res.body.message).toMatch(/ferdig konvertert/);
  });

  it('kjører den automatiske rettingen med Haiku når LaTeX-koden ikke kompilerer', async () => {
    const broken = await convertedNote(env, 'FEIL');
    const fixesBefore = env.ctx.repo.usageSince(0).filter((u) => u.noteId === broken.id && u.kind === 'fix').length;
    expect((await env.call('POST', `/api/notes/${broken.id}/compare`)).status).toBe(202);
    await env.ctx.comparer.idle();
    expect((await env.call<NoteComparisonResponse>('GET', `/api/notes/${broken.id}/compare`)).body.comparison).toMatchObject({ status: 'done' });
    expect(env.ctx.repo.usageSince(0).filter((u) => u.noteId === broken.id && u.kind === 'fix').length).toBeGreaterThan(fixesBefore);
  });
});

describe('sammenligning når noe går galt', () => {
  let env: Env | undefined;
  afterAll(() => stopApp(env));

  it('bruker ikke Sonnet når Haiku avslår, og notatet er urørt', async () => {
    const haiku = new RefusingHaiku(0);
    env = await startApp(haiku);
    const note = await convertedNote(env);
    const before = noteFiles(env, note.id);
    expect((await env.call('POST', `/api/notes/${note.id}/compare`)).status).toBe(202);
    await env.ctx.comparer.idle();
    const failed = (await env.call<NoteComparisonResponse>('GET', `/api/notes/${note.id}/compare`)).body.comparison!;
    expect(failed).toMatchObject({ status: 'failed' });
    expect(failed.error).toMatch(/avslo/);
    expect(haiku.calls).toBe(1);
    expect(noteFiles(env, note.id)).toEqual(before);
    expect(fs.existsSync(path.join(env.dataDir, 'notes', note.id, 'compare'))).toBe(false);
    // En mislykket kjøring telles for seg, og kan vurderes for hånd.
    expect((await env.call<ComparisonSummaryResponse>('GET', '/api/compare/summary')).body).toMatchObject({ rated: 0, failed: 1 });
    expect((await env.call('PUT', `/api/notes/${note.id}/compare/rating`, { json: { verdict: 'sonnet_better' } })).status).toBe(200);
    expect((await env.call<ComparisonSummaryResponse>('GET', '/api/compare/summary')).body).toMatchObject({ rated: 1, sonnetBetter: 1, failed: 0 });
    await stopApp(env);
    env = undefined;
  }, 90_000);

  it('lager ikke notatmappen på nytt når notatet slettes mens Haiku leser', async () => {
    const haiku = new SlowHaiku(0);
    env = await startApp(haiku);
    const note = await convertedNote(env);
    expect((await env.call('POST', `/api/notes/${note.id}/compare`)).status).toBe(202);
    await haiku.started;
    // Vurdering mens den kjører, går ikke.
    expect((await env.call('PUT', `/api/notes/${note.id}/compare/rating`, { json: { verdict: 'haiku_ok' } })).status).toBe(409);
    expect((await env.call('DELETE', `/api/notes/${note.id}`)).status).toBe(200);
    haiku.release();
    await env.ctx.comparer.idle();
    expect(fs.existsSync(path.join(env.dataDir, 'notes', note.id))).toBe(false);
    const row = env.ctx.repo.getComparisonRow(note.id)!;
    expect(row).toMatchObject({ status: 'failed', error: 'Notatet ble slettet.' });
    expect(fs.readdirSync(path.join(env.dataDir, 'tmp')).filter((n) => n.startsWith('compare-'))).toEqual([]);
    await stopApp(env);
    env = undefined;
  }, 90_000);

  it('markerer en kjøring som ble avbrutt av en omstart, i stedet for å kjøre den på nytt', async () => {
    env = await startApp();
    const note = await convertedNote(env);
    env.ctx.repo.startComparison(note.id, { model: 'claude-haiku-5-5', baseModel: null, basePdfRev: note.pdfRev, pageCount: 1 });
    const dataDir = env.dataDir;
    await stopApp(env);
    env = await startApp(undefined, dataDir);
    const row = (await env.call<NoteComparisonResponse>('GET', `/api/notes/${note.id}/compare`)).body.comparison!;
    expect(row).toMatchObject({ status: 'failed' });
    expect(row.error).toMatch(/startet på nytt/);
  }, 90_000);
});
