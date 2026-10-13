import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { CreateInviteResponse, Deck, LoginResponse, Note, QuotaResponse, SyncResponse } from '@smartnotes/shared';
import { buildApp, type AppContext } from '../src/app.js';
import { loadConfig } from '../src/config.js';
import { OWNER_ID, Repo } from '../src/db.js';
import { FakeClaude } from '../src/pipeline/claude.js';
import { Quota, QUOTA_MESSAGES, osloDay } from '../src/quota.js';
import { hashPassword } from '../src/passwords.js';

/**
 * Gratiskvotene: norsk døgn (også rundt sommertid), sider telt når konverteringen starter, kortstokker og
 * innholdsfortegnelser per døgn, taket på notater i kø, dagsbudsjettet og den rettferdige køen. Klokka er falsk.
 */

describe('norsk døgn', () => {
  it('starter ved midnatt norsk tid, vinter og sommer', () => {
    // 14. januar 2026 kl. 00.30 i Oslo er 13. januar 23.30 UTC (UTC+1).
    const winter = osloDay(Date.parse('2026-01-13T23:30:00Z'));
    expect(winter.day).toBe('2026-01-14');
    expect(new Date(winter.start).toISOString()).toBe('2026-01-13T23:00:00.000Z');
    expect(new Date(winter.next).toISOString()).toBe('2026-01-14T23:00:00.000Z');
    // 13. januar 23.59 i Oslo hører til 13. januar.
    expect(osloDay(Date.parse('2026-01-13T22:59:00Z')).day).toBe('2026-01-13');
    // 14. oktober 2026 kl. 00.10 i Oslo er 13. oktober 22.10 UTC (UTC+2).
    const summer = osloDay(Date.parse('2026-10-13T22:10:00Z'));
    expect(summer.day).toBe('2026-10-14');
    expect(new Date(summer.start).toISOString()).toBe('2026-10-13T22:00:00.000Z');
  });

  it('har 23 og 25 timer på dagene sommertiden skifter', () => {
    const spring = osloDay(Date.parse('2026-03-29T12:00:00Z'));
    expect((spring.next - spring.start) / 3_600_000).toBe(23);
    const autumn = osloDay(Date.parse('2026-10-25T12:00:00Z'));
    expect((autumn.next - autumn.start) / 3_600_000).toBe(25);
    expect(new Date(autumn.next).toISOString()).toBe('2026-10-25T23:00:00.000Z');
  });
});

describe('migrering 8 (kvoter)', () => {
  it('legger til kvoteloggen og køturen uten å endre noe som finnes', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'smartnotes-migrering8-'));
    const file = path.join(dir, 'db.sqlite');
    const old = new Repo(file, { migrateTo: 7 });
    const subject = old.createSubject({ userId: OWNER_ID, name: 'Fysikk 1', profile: 'physics' });
    const rev = old.currentRev();
    old.close();
    const repo = new Repo(file);
    expect(repo.db.pragma('user_version', { simple: true })).toBe(8);
    expect(repo.getUser(OWNER_ID)).toMatchObject({ last_claim_rev: 0 });
    expect(repo.currentRev()).toBe(rev);
    expect(repo.listSubjects(OWNER_ID).map((s) => s.id)).toEqual([subject.id]);
    expect(repo.quotaUsed(OWNER_ID, 'pages', 0)).toBe(0);
    repo.close();
  });
});

describe('rettferdig kø', () => {
  it('tar notatene annenhver gang fra to brukere med full kø', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'smartnotes-ko-'));
    const repo = new Repo(path.join(dir, 'db.sqlite'));
    const hash = await hashPassword('passord-123');
    const users = [2, 3].map((n) => {
      repo.db
        .prepare(`INSERT INTO users (id, username, password_hash, plan, created_at, updated_at) VALUES (?, ?, ?, 'free', ?, ?)`)
        .run(n, `elev${n}`, hash, new Date().toISOString(), new Date().toISOString());
      return n;
    });
    const subjects = users.map((userId) => repo.createSubject({ userId, name: 'Fysikk 1', profile: 'physics' }));
    // Elev 2 laster opp fem notater først, så laster elev 3 opp fem.
    for (const [i, s] of subjects.entries()) {
      for (let k = 0; k < 5; k++) {
        repo.forUser(users[i]!).createNote({
          id: randomUUID(),
          subjectId: s.id,
          chapterId: null,
          chapterAuto: true,
          clientId: null,
          title: `Notat ${k}`,
          noteDate: null,
          instructions: null,
          files: [],
        });
      }
    }
    const order: number[] = [];
    for (let k = 0; k < 10; k++) order.push(repo.claimNextQueued()!.user_id);
    expect(order).toEqual([2, 3, 2, 3, 2, 3, 2, 3, 2, 3]);
    expect(repo.claimNextQueued()).toBeNull();
    repo.close();
  });
});

const PASSWORD = 'hemmelig';
let ctx: AppContext;
let base = '';
let clock = Date.parse('2026-10-14T20:00:00Z'); // kl. 22 norsk tid
let pngPage: Buffer;

class Client {
  cookie = '';
  async call<T = unknown>(method: string, url: string, opts: { json?: unknown; form?: FormData } = {}) {
    const headers: Record<string, string> = {};
    if (this.cookie) headers.cookie = this.cookie;
    if (method !== 'GET') headers['x-smartnotes'] = '1';
    let body: string | FormData | undefined;
    if (opts.json !== undefined) {
      headers['content-type'] = 'application/json';
      body = JSON.stringify(opts.json);
    } else body = opts.form;
    const res = await fetch(base + url, { method, headers, body });
    const set = res.headers.getSetCookie().find((c) => c.startsWith('sn_session='));
    if (set) this.cookie = set.split(';')[0]!;
    const text = await res.text();
    return { status: res.status, body: (text.startsWith('{') ? JSON.parse(text) : text) as T };
  }
  sync = async () => (await this.call<SyncResponse>('GET', '/api/sync?since=0')).body;
}

let owner: Client;

async function student(username: string): Promise<{ client: Client; subjectId: string }> {
  const { code } = (await owner.call<CreateInviteResponse>('POST', '/api/admin/invites')).body;
  const client = new Client();
  const res = await client.call<LoginResponse>('POST', '/api/auth/register', {
    json: { code, username, password: 'passord-123', presetIds: ['fysikk-1-lk20'], ageConfirmed: true },
  });
  expect(res.status).toBe(201);
  return { client, subjectId: (await client.sync()).subjects[0]!.id };
}

function pageForm(subjectId: string): FormData {
  const form = new FormData();
  form.append('subjectId', subjectId);
  form.append('clientId', randomUUID());
  form.append('files', new Blob([new Uint8Array(pngPage)], { type: 'image/png' }), 'side.png');
  return form;
}

async function upload(c: Client, subjectId: string): Promise<Note> {
  const res = await c.call<Note>('POST', '/api/notes', { form: pageForm(subjectId) });
  expect(res.status, JSON.stringify(res.body)).toBe(201);
  return res.body;
}

async function settle(c: Client, noteId: string, pred: (n: Note) => boolean): Promise<Note> {
  const start = Date.now();
  for (;;) {
    ctx.worker.kick();
    await ctx.worker.idle();
    const note = (await c.sync()).notes.find((n) => n.id === noteId);
    if (note && pred(note)) return note;
    if (Date.now() - start > 60_000) throw new Error(`Tidsavbrudd: ${JSON.stringify(note)}`);
    await new Promise((r) => setTimeout(r, 100));
  }
}

beforeAll(async () => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'smartnotes-kvote-'));
  const config = loadConfig({
    ...process.env,
    NODE_ENV: 'test',
    DATA_DIR: dataDir,
    APP_PASSWORD: PASSWORD,
    WEB_DIST: '',
    SEED_TEXTBOOKS: 'fysikk-1-lk20',
    FREE_PAGES_PER_DAY: '2',
    FREE_DECKS_PER_DAY: '1',
    FREE_TOC_PER_DAY: '1',
    FREE_QUEUE_MAX: '3',
    FREE_DAILY_BUDGET_NOK: '30',
  });
  ctx = await buildApp({ ...config, webDist: null }, { ai: new FakeClaude(5), logger: false, now: () => clock });
  await ctx.app.listen({ port: 0, host: '127.0.0.1' });
  const addr = ctx.app.server.address();
  base = `http://127.0.0.1:${typeof addr === 'object' && addr ? addr.port : 0}`;
  pngPage = await sharp({ create: { width: 800, height: 1100, channels: 3, background: '#f4f1e8' } }).png().toBuffer();
  owner = new Client();
  expect((await owner.call('POST', '/api/auth/login', { json: { password: PASSWORD } })).status).toBe(200);
}, 60_000);

afterAll(async () => {
  await ctx?.worker.stop();
  await ctx?.app.close();
});

describe('gratiskvoten', () => {
  it('teller sidene når konverteringen starter, lar resten vente til midnatt og konverterer dem neste døgn', async () => {
    const { client, subjectId } = await student('kvote-sider');
    const first = await upload(client, subjectId);
    expect((await settle(client, first.id, (n) => n.status === 'done')).pageCount).toBe(1);
    // «Konverter på nytt» teller sidene igjen: nå er begge sidene i dag brukt.
    expect((await client.call('POST', `/api/notes/${first.id}/retry`, { json: {} })).status).toBe(200);
    await settle(client, first.id, (n) => n.status === 'done');
    expect((await client.call<QuotaResponse>('GET', '/api/quota')).body.quota).toMatchObject({ pages: { used: 2, limit: 2 } });

    const second = await upload(client, subjectId);
    const waiting = await settle(client, second.id, (n) => n.status === 'queued' && !!n.error);
    expect(waiting.error).toBe(QUOTA_MESSAGES.pages(2));
    const row = ctx.repo.getNoteRow(second.id)!;
    // Venter til midnatt norsk tid (22.00 UTC i oktober), og forsøket regnes ikke som mislykket.
    expect(row.not_before).toBe('2026-10-14T22:00:00.000Z');
    expect(row.attempts).toBe(0);

    // Neste døgn: notatet konverteres (not_before settes tilbake her, fordi køen bruker den ekte klokka).
    clock = Date.parse('2026-10-14T22:05:00Z');
    ctx.repo.db.prepare(`UPDATE notes SET not_before = ? WHERE id = ?`).run(new Date(Date.now() - 1000).toISOString(), second.id);
    const done = await settle(client, second.id, (n) => n.status === 'done');
    expect(done.error).toBeNull();
    expect((await client.call<QuotaResponse>('GET', '/api/quota')).body.quota).toMatchObject({
      pages: { used: 1, limit: 2 },
      resetsAt: '2026-10-15T22:00:00.000Z',
    });
  }, 120_000);

  it('lar det første notatet i et døgn starte selv om det har flere sider enn taket', () => {
    const config = loadConfig({ NODE_ENV: 'test', APP_PASSWORD: 'x', FREE_PAGES_PER_DAY: '2' });
    const quota = new Quota(ctx.repo, config, () => Date.parse('2026-10-20T10:00:00Z'));
    const user = ctx.repo.getUserByName('kvote-sider')!.id;
    expect(quota.startConversion(user, 'n-langt', 9)).toBeNull();
    expect(quota.startConversion(user, 'n-kort', 1)).toMatchObject({ message: QUOTA_MESSAGES.pages(2) });
  });

  it('eieren har ingen tak', async () => {
    const subjectId = (await owner.sync()).subjects[0]!.id;
    for (let k = 0; k < 4; k++) await upload(owner, subjectId);
    expect((await owner.call<QuotaResponse>('GET', '/api/quota')).body.quota).toBeNull();
    expect(ctx.quota.startConversion(OWNER_ID, 'x', 100)).toBeNull();
    expect(ctx.quota.takeDeck(OWNER_ID, null)).toBeNull();
    expect(ctx.quota.queueFull(OWNER_ID)).toBeNull();
    await ctx.worker.idle();
  });

  it('begrenser kortstokker og innholdsfortegnelser per døgn med en norsk melding', async () => {
    clock = Date.parse('2026-10-21T10:00:00Z');
    const { client, subjectId } = await student('kvote-kort');
    const note = await upload(client, subjectId);
    await settle(client, note.id, (n) => n.status === 'done');
    const deck = { subjectId, noteIds: [note.id], difficulty: 'easy' };
    expect((await client.call<Deck>('POST', '/api/decks', { json: deck })).status).toBe(201);
    const second = await client.call<{ error: string; message: string }>('POST', '/api/decks', { json: deck });
    expect(second.status).toBe(429);
    expect(second.body).toEqual({ error: 'quota_exceeded', message: QUOTA_MESSAGES.decks(1) });

    const extract = () => {
      const form = new FormData();
      form.append('files', new Blob([new Uint8Array(pngPage)], { type: 'image/png' }), 'innhold.png');
      return client.call<{ message: string }>('POST', `/api/subjects/${subjectId}/chapters/extract`, { form });
    };
    expect((await extract()).status).toBe(200);
    const blocked = await extract();
    expect(blocked.status).toBe(429);
    expect(blocked.body.message).toBe(QUOTA_MESSAGES.toc(1));
    // Teksten tolkes fortsatt, men uten AI-koblingen til kompetansemålene.
    const parsed = await client.call<{ chapters: { title: string }[] }>('POST', `/api/subjects/${subjectId}/chapters/parse`, {
      json: { text: '1 Krefter\n1.1 Newtons lover' },
    });
    expect(parsed.status).toBe(200);
    expect(parsed.body.chapters[0]!.title).toBe('Krefter');

    // Neste døgn er alt tilbake.
    clock = Date.parse('2026-10-22T10:00:00Z');
    expect((await client.call('POST', '/api/decks', { json: deck })).status).toBe(201);
    expect((await extract()).status).toBe(200);
    await ctx.worker.idle();
    await ctx.generator.idle();
  }, 120_000);

  it('har et tak på notater i kø, uten 429 (opplastingskøen i appen prøver ellers på nytt i det uendelige)', async () => {
    clock = Date.parse('2026-10-23T10:00:00Z');
    const { client, subjectId } = await student('kvote-ko');
    await ctx.worker.stop();
    try {
      for (let k = 0; k < 3; k++) await upload(client, subjectId);
      const full = await client.call<{ error: string; message: string }>('POST', '/api/notes', { form: pageForm(subjectId) });
      expect(full.status).toBe(403);
      expect(full.body).toEqual({ error: 'queue_full', message: QUOTA_MESSAGES.queue(3) });
    } finally {
      ctx.worker.start();
    }
  });

  it('lar gratisjobbene vente når dagsbudsjettet er brukt, men ikke eierens', async () => {
    clock = Date.parse('2026-10-24T10:00:00Z');
    const { client, subjectId } = await student('kvote-budsjett');
    const userId = ctx.repo.getUserByName('kvote-budsjett')!.id;
    // 2 millioner tokens inn på Sonnet-pris er 4 dollar, godt over 30 kroner.
    ctx.repo.logUsage({
      at: clock,
      kind: 'convert',
      provider: 'anthropic',
      model: 'claude-sonnet-5-5',
      inputTokens: 2_000_000,
      outputTokens: 0,
      cacheReadTokens: 0,
      cacheWriteTokens: 0,
      durationMs: 1,
      ok: true,
      error: null,
      noteId: null,
      deckId: null,
      subjectId: null,
      userId,
      pages: null,
    });
    expect(ctx.quota.budgetUsed()).toBe(true);
    const note = await upload(client, subjectId);
    const waiting = await settle(client, note.id, (n) => n.status === 'queued' && !!n.error);
    expect(waiting.error).toBe(QUOTA_MESSAGES.budget);
    expect(ctx.quota.takeDeck(userId, null)).toBe(QUOTA_MESSAGES.decksBudget);
    expect(ctx.quota.startConversion(OWNER_ID, 'eier', 5)).toBeNull();
  });
});

