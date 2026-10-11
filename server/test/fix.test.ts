import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Note, Subject, SyncResponse } from '@smartnotes/shared';
import { buildApp, type AppContext } from '../src/app.js';
import { loadConfig } from '../src/config.js';
import { ConversionError } from '../src/errors.js';
import type { FixRequest } from '../src/pipeline/ai.js';
import { FakeClaude } from '../src/pipeline/claude.js';
import { zeroUsage } from '../src/usage.js';

/** En AI som konverterer, men ikke klarer å rette LaTeX, slik en lokal modell kan svikte på et langt notat. */
class NoFixAi extends FakeClaude {
  override async fix(_req: FixRequest): Promise<never> {
    const err = new ConversionError('Dette er for stort for den lokale AI-en.');
    err.usage = zeroUsage('fix', 'fake-claude');
    throw err;
  }
}

describe('når den automatiske rettingen ikke virker', () => {
  let ctx: AppContext;
  let base = '';
  let cookie = '';

  const call = async <T>(method: string, url: string, opts: { json?: unknown; form?: FormData } = {}) => {
    const headers: Record<string, string> = { 'x-smartnotes': '1', ...(cookie ? { cookie } : {}) };
    let body: string | FormData | undefined;
    if (opts.json !== undefined) {
      headers['content-type'] = 'application/json';
      body = JSON.stringify(opts.json);
    } else body = opts.form;
    const res = await fetch(base + url, { method, headers, body });
    const text = await res.text();
    return { status: res.status, body: (text ? JSON.parse(text) : null) as T, headers: res.headers };
  };

  beforeAll(async () => {
    const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'smartnotes-fix-'));
    const config = loadConfig({ ...process.env, NODE_ENV: 'test', DATA_DIR: dataDir, APP_PASSWORD: 'hemmelig', WEB_DIST: '', SEED_TEXTBOOK: 'none' });
    ctx = await buildApp({ ...config, webDist: null }, { ai: new NoFixAi(5), logger: false });
    ctx.worker.start();
    await ctx.app.listen({ port: 0, host: '127.0.0.1' });
    const addr = ctx.app.server.address();
    base = `http://127.0.0.1:${typeof addr === 'object' && addr ? addr.port : 0}`;
    const login = await call('POST', '/api/auth/login', { json: { password: 'hemmelig' } });
    cookie = (login.headers.get('set-cookie') ?? '').split(';')[0]!;
  });

  afterAll(async () => {
    await ctx?.worker.stop();
    await ctx?.app.close();
  });

  it('lagres notatet som utkast med metadata, i stedet for å feile med feilen fra AI-en', async () => {
    const subject = (await call<Subject>('POST', '/api/subjects', { json: { name: 'Fysikk 1', profile: 'physics' } })).body;
    const png = await sharp({ create: { width: 1200, height: 1600, channels: 3, background: '#fff' } }).png().toBuffer();
    const form = new FormData();
    form.append('subjectId', subject.id);
    form.append('clientId', 'klient-utkast');
    form.append('instructions', 'FEIL');
    form.append('files', new Blob([new Uint8Array(png)], { type: 'image/png' }), 's.png');
    const note = (await call<Note>('POST', '/api/notes', { form })).body;

    let done: Note | undefined;
    for (const start = Date.now(); Date.now() - start < 60_000; await new Promise((r) => setTimeout(r, 100))) {
      done = (await call<SyncResponse>('GET', '/api/sync?since=0')).body.notes.find((n) => n.id === note.id);
      if (done?.status === 'failed' || done?.status === 'done') break;
    }
    expect(done).toMatchObject({ status: 'failed', pageCount: 1 });
    expect(done!.error).toMatch(/kompilerte ikke/);
    // Utkastet kan åpnes og rettes for hånd.
    const latex = await call<{ body: string }>('GET', `/api/notes/${note.id}/latex`);
    expect(latex.status).toBe(200);
    expect(latex.body.body).toContain('Mangler slutt');
    expect(ctx.repo.usageSince(0).filter((e) => e.noteId === note.id).map((e) => [e.kind, e.ok])).toEqual([
      ['convert', true],
      ['fix', false],
    ]);
  });
});
