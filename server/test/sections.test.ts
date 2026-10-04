import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Chapter, ChapterInput, Note, Subject, SyncResponse } from '@smartnotes/shared';
import { buildApp, type AppContext } from '../src/app.js';
import { loadConfig } from '../src/config.js';
import { FakeClaude } from '../src/pipeline/claude.js';

/** Delkapitler, kompetansemål og søketekst med ERGO Fysikk 1 lagt inn ved oppstart. */
let ctx: AppContext;
let dataDir = '';
let cookie = '';

async function inject<T>(method: string, url: string, payload?: unknown): Promise<{ status: number; body: T }> {
  const res = await ctx.app.inject({
    method: method as 'GET',
    url,
    headers: { cookie, 'x-smartnotes': '1', ...(payload ? { 'content-type': 'application/json' } : {}) },
    payload: payload ? JSON.stringify(payload) : undefined,
  });
  return { status: res.statusCode, body: res.json() as T };
}

async function sync(): Promise<SyncResponse> {
  return (await inject<SyncResponse>('GET', '/api/sync?since=0')).body;
}

async function waitFor(id: string, pred: (n: Note) => boolean): Promise<Note> {
  for (let i = 0; i < 300; i++) {
    const n = (await sync()).notes.find((x) => x.id === id);
    if (n && pred(n)) return n;
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error('tidsavbrudd');
}

beforeAll(async () => {
  dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'smartnotes-sections-'));
  const config = loadConfig({ ...process.env, NODE_ENV: 'test', DATA_DIR: dataDir, APP_PASSWORD: 'pw', WEB_DIST: '', SEED_TEXTBOOKS: 'ergo-fysikk-1' });
  ctx = await buildApp({ ...config, webDist: null }, { claude: new FakeClaude(5), logger: false });
  ctx.worker.start();
  const login = await ctx.app.inject({
    method: 'POST',
    url: '/api/auth/login',
    headers: { 'x-smartnotes': '1', 'content-type': 'application/json' },
    payload: JSON.stringify({ password: 'pw' }),
  });
  cookie = String(login.headers['set-cookie']).split(';')[0]!;
});

afterAll(async () => {
  await ctx.worker.stop();
  await ctx.worker.idle();
  await ctx.app.close();
  fs.rmSync(dataDir, { recursive: true, force: true });
});

describe('delkapitler og kompetansemål', () => {
  let subject: Subject;
  let chapters: Chapter[];
  let noteId = '';

  it('synker fag med kompetansemål og kapitler med delkapitler', async () => {
    const s = await sync();
    subject = s.subjects[0]!;
    chapters = s.chapters.sort((a, b) => a.position - b.position);
    expect(subject.aims.map((a) => a.code)).toEqual(Array.from({ length: 14 }, (_, i) => `KM${i + 1}`));
    expect(subject.aims.find((a) => a.code === 'KM1')?.cross).toBe(true);
    expect(chapters[1]!.sections.map((x) => x.code)).toEqual(['2A', '2B', '2C', '2D', '2E', '2F']);
    expect(chapters[1]!.sections.find((x) => x.code === '2F')?.aims).toEqual(['KM5', 'KM6']);
    expect(chapters.flatMap((c) => c.sections)).toHaveLength(44);
  });

  it('Claude velger kapittel og delkapittel, og notatet får søketekst', async () => {
    const page = await sharp({ create: { width: 800, height: 1000, channels: 3, background: '#fff' } }).png().toBuffer();
    const boundary = '----sn';
    const parts = [
      `--${boundary}\r\nContent-Disposition: form-data; name="subjectId"\r\n\r\n${subject.id}\r\n`,
      `--${boundary}\r\nContent-Disposition: form-data; name="clientId"\r\n\r\nseksjon-1\r\n`,
      `--${boundary}\r\nContent-Disposition: form-data; name="files"; filename="s.png"\r\nContent-Type: image/png\r\n\r\n`,
    ];
    const payload = Buffer.concat([Buffer.from(parts.join('')), page, Buffer.from(`\r\n--${boundary}--\r\n`)]);
    const res = await ctx.app.inject({
      method: 'POST',
      url: '/api/notes',
      headers: { cookie, 'x-smartnotes': '1', 'content-type': `multipart/form-data; boundary=${boundary}` },
      payload,
    });
    expect(res.statusCode).toBe(201);
    noteId = res.json<Note>().id;
    const done = await waitFor(noteId, (n) => n.status === 'done');
    expect(done.chapterId).toBe(chapters[0]!.id);
    expect(done.section).toBe('1A');
    expect(done.searchText).toContain('Newtons første lov');
    expect(done.searchText).not.toContain('\\');
    const tex = await ctx.app.inject({ method: 'GET', url: `/api/notes/${noteId}/tex`, headers: { cookie } });
    expect(tex.body).toContain('1A Fysikk som målefag');
  });

  it('brukeren kan bytte delkapittel, men bare til et som finnes i kapittelet', async () => {
    const ok = await inject<Note>('PATCH', `/api/notes/${noteId}`, { section: '1c' });
    expect(ok.status).toBe(200);
    expect(ok.body.section).toBe('1C');
    const bad = await inject<{ message: string }>('PATCH', `/api/notes/${noteId}`, { section: '2E' });
    expect(bad.status).toBe(400);
    expect(bad.body.message).toMatch(/Delkapittelet finnes ikke/);
  });

  it('flytting til et annet kapittel nullstiller delkapittelet, eller setter det som oppgis', async () => {
    const moved = await inject<Note>('PATCH', `/api/notes/${noteId}`, { chapterId: chapters[1]!.id });
    expect(moved.body.chapterId).toBe(chapters[1]!.id);
    expect(moved.body.section).toBeNull();
    const both = await inject<Note>('PATCH', `/api/notes/${noteId}`, { chapterId: chapters[2]!.id, section: '3E' });
    expect(both.body.section).toBe('3E');
    await waitFor(noteId, (n) => n.stage === null);
  });

  it('kapittel-PDF grupperes etter delkapittel', async () => {
    const res = await ctx.app.inject({ method: 'GET', url: `/api/chapters/${chapters[2]!.id}/pdf`, headers: { cookie } });
    expect(res.statusCode).toBe(200);
    expect(res.rawPayload.subarray(0, 4).toString()).toBe('%PDF');
  });

  it('delkapitler kan endres; notater med kode som forsvinner, mister den', async () => {
    const dup = await inject<{ message: string }>('PATCH', `/api/chapters/${chapters[2]!.id}`, {
      sections: [
        { code: '3A', title: 'Energi', aims: [] },
        { code: '3a', title: 'Igjen', aims: [] },
      ],
    });
    expect(dup.status).toBe(400);
    const res = await inject<Chapter>('PATCH', `/api/chapters/${chapters[2]!.id}`, { sections: [{ code: '3A', title: 'Energi', aims: ['KM5'] }] });
    expect(res.status).toBe(200);
    expect(res.body.sections).toHaveLength(1);
    const note = (await sync()).notes.find((n) => n.id === noteId)!;
    expect(note.section).toBeNull();
  });

  it('delkapitler fra innlimt innholdsfortegnelse kobles til fagets kompetansemål', async () => {
    const res = await inject<{ chapters: ChapterInput[] }>('POST', `/api/subjects/${subject.id}/chapters/parse`, {
      text: '11 Nytt kapittel\n11.1 Første del\n11.2 Andre del',
    });
    expect(res.status).toBe(200);
    // Falsk Claude velger det første målet som ikke går på tvers av kapitlene.
    const first = subject.aims.find((a) => !a.cross)!.code;
    expect(res.body.chapters[0]!.sections).toEqual([
      { code: '11.1', title: 'Første del', aims: [first] },
      { code: '11.2', title: 'Andre del', aims: [first] },
    ]);
  });
});
