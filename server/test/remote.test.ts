import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { AiStatusResponse, Note, Subject, SyncResponse } from '@smartnotes/shared';
import { buildApp, type AppContext } from '../src/app.js';
import { loadConfig } from '../src/config.js';
import { ConversionError } from '../src/errors.js';
import { FakeClaude } from '../src/pipeline/claude.js';
import { RemoteAi, RemoteHub, RemoteWithFallback, type RemoteHubOptions } from '../src/remote/hub.js';
import { HomeWorker, parseHours } from '../src/remote/homeworker.js';
import { PROTOCOL_VERSION, executeRemoteCall, type RemoteCall } from '../src/remote/protocol.js';
import { getProfile } from '../src/profiles/index.js';
import type { UsageRef } from '../src/usage.js';

const TOKEN = 'test-token-som-er-lang-nok-1234567890';
const fixCall: RemoteCall = { method: 'fix', req: { profile: 'physics', body: '\\section*{A}', errorReport: '' } };

function makeHub(extra: Partial<RemoteHubOptions> = {}) {
  let t = 1_000_000;
  const events: string[] = [];
  const hub = new RemoteHub({
    leaseMs: 60_000,
    maxWaitMs: 12 * 3_600_000,
    interactiveWaitMs: 180_000,
    maxAttempts: 2,
    onlineWithinMs: 120_000,
    onWaiting: (ref: UsageRef, m) => events.push(`venter ${ref.noteId ?? '-'} ${m}`),
    onClaimed: (ref: UsageRef, m) => events.push(`hentet ${ref.noteId ?? '-'} ${m}`),
    now: () => t,
    ...extra,
  });
  return { hub, events, advance: (ms: number) => (t += ms) };
}

const claimReq = (name = 'PC') => ({ name, protocol: PROTOCOL_VERSION, models: ['qwen2.5vl:7b'] });

describe('RemoteHub', () => {
  it('gir kallet til en maskin som venter, og leverer svaret', async () => {
    const { hub, events } = makeHub();
    const claimed = hub.claim(claimReq(), 1_000, () => false);
    const result = hub.submit(fixCall, { ref: { noteId: 'n1' } });
    const task = (await claimed)!;
    expect(task.call).toEqual(fixCall);
    expect(task.leaseMs).toBe(60_000);
    // Hentet med en gang: ingen «venter».
    expect(events).toEqual([]);
    expect(hub.complete(task.id, 'Mac', { ok: true, result: 1 })).toBe(false);
    expect(hub.complete(task.id, 'PC', { ok: true, result: 'svar' })).toBe(true);
    expect(await result).toEqual({ ok: true, result: 'svar' });
    expect(hub.complete(task.id, 'PC', { ok: true, result: 'igjen' })).toBe(false);
    hub.close();
  });

  it('sier fra når kallet må vente, og når det hentes', async () => {
    const { hub, events } = makeHub();
    void hub.submit({ ...fixCall }, { ref: { noteId: 'n2' } });
    expect(events).toEqual(['venter n2 fix']);
    expect(hub.status()).toMatchObject({ waiting: 1, running: 0 });
    const task = await hub.claim(claimReq(), 0, () => false);
    expect(task).not.toBeNull();
    expect(events).toEqual(['venter n2 fix', 'hentet n2 fix']);
    expect(hub.status()).toMatchObject({ waiting: 0, running: 1, workers: [{ name: 'PC', busy: true, models: ['qwen2.5vl:7b'] }] });
    hub.close();
  });

  it('gir ikke kallet til en forespørsel som er avbrutt', async () => {
    const { hub } = makeHub();
    const dead = hub.claim(claimReq('Borte'), 1_000, () => true);
    void hub.submit(fixCall);
    expect(await dead).toBeNull();
    expect(hub.status().waiting).toBe(1);
    expect(await hub.claim(claimReq('PC'), 0, () => false)).not.toBeNull();
    hub.close();
  });

  it('legger kallet tilbake når reservasjonen går ut, og gir opp etter for mange forsøk', async () => {
    const { hub, events, advance } = makeHub();
    const result = hub.submit(fixCall, { ref: { noteId: 'n3' } });
    const first = (await hub.claim(claimReq(), 0, () => false))!;
    advance(30_000);
    expect(hub.heartbeat(first.id, 'PC')).toBe(true);
    advance(59_000);
    hub.sweep();
    expect(hub.status().running).toBe(1); // heartbeat forlenget reservasjonen
    advance(2_000);
    hub.sweep();
    expect(hub.status()).toMatchObject({ waiting: 1, running: 0 });
    expect(hub.heartbeat(first.id, 'PC')).toBe(false);
    const second = (await hub.claim(claimReq('Mac'), 0, () => false))!;
    expect(second.id).toBe(first.id);
    advance(61_000);
    hub.sweep();
    const outcome = await result;
    expect(outcome).toMatchObject({ ok: false, error: { retryable: true } });
    expect(events.filter((e) => e.startsWith('venter'))).toHaveLength(2);
    hub.close();
  });

  it('gir opp kall som har ventet for lenge', async () => {
    const { hub, advance } = makeHub();
    const result = hub.submit(fixCall);
    advance(12 * 3_600_000);
    hub.sweep();
    expect(await result).toMatchObject({ ok: false, error: { retryable: false, message: expect.stringContaining('12 timer') } });
  });

  it('kall der brukeren venter, feiler med en gang når ingen hjemmemaskin er på nett', async () => {
    const { hub, advance } = makeHub();
    expect(await hub.submit(fixCall, { interactive: true })).toMatchObject({ ok: false, error: { message: expect.stringContaining('ikke på nett') } });
    await hub.claim(claimReq(), 0, () => false);
    void hub.submit(fixCall, { interactive: true });
    expect(hub.status().waiting).toBe(1);
    advance(180_000);
    hub.sweep();
    expect(hub.status().waiting).toBe(0);
    advance(121_000);
    expect(hub.online()).toBe(false);
    hub.close();
  });

  it('stenger: kall som venter, kan prøves igjen, og ventende hentinger avsluttes', async () => {
    const { hub } = makeHub();
    const waiting = hub.claim(claimReq(), 10_000, () => false);
    hub.close();
    expect(await waiting).toBeNull();
    expect(await hub.submit(fixCall)).toMatchObject({ ok: false, error: { retryable: true } });
  });
});

describe('WORKER_HOURS', () => {
  const at = (h: number) => new Date(2026, 9, 11, h, 30);
  it('tar imot oppgaver bare i de oppgitte timene, også over midnatt', () => {
    const night = parseHours('16-23,0-7');
    expect([0, 7, 8, 15, 16, 23].map((h) => night(at(h)))).toEqual([true, true, false, false, true, true]);
    const wrap = parseHours('22-6');
    expect([21, 22, 3, 6, 7].map((h) => wrap(at(h)))).toEqual([false, true, true, true, false]);
    expect(parseHours('')(at(12))).toBe(true);
    expect(parseHours(undefined)(at(12))).toBe(true);
    expect(() => parseHours('kveld')).toThrow('Ugyldig WORKER_HOURS');
    expect(() => parseHours('20-25')).toThrow('Ugyldig WORKER_HOURS');
  });
});

describe('RemoteAi og reserve', () => {
  const stubHub = (outcome: unknown, online = true) =>
    ({ submit: async () => outcome, online: () => online, status: () => ({ workers: [], waiting: 0, running: 0 }) }) as unknown as RemoteHub;

  it('kontrollerer svaret og gir norske feil med forbruket', async () => {
    const usage = { kind: 'fix', model: 'qwen', inputTokens: 5, outputTokens: 6, cacheReadTokens: 0, cacheWriteTokens: 0 };
    const ok = await new RemoteAi(stubHub({ ok: true, result: { body: 'x', usage } })).fix({ profile: getProfile('physics'), body: '', errorReport: '' });
    expect(ok).toEqual({ body: 'x', usage });
    await expect(
      new RemoteAi(stubHub({ ok: true, result: { body: 42 } })).fix({ profile: getProfile('physics'), body: '', errorReport: '' }),
    ).rejects.toThrow('uventet format');
    const err = await new RemoteAi(stubHub({ ok: false, error: { message: 'For lite minne', retryable: false, usage } }))
      .fix({ profile: getProfile('physics'), body: '', errorReport: '' })
      .catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ConversionError);
    expect(err).toMatchObject({ message: 'For lite minne', retryable: false, usage });
  });

  it('bruker reserven når ingen hjemmemaskin er på nett', async () => {
    const remote = new RemoteAi(stubHub({ ok: false, error: { message: 'skal ikke brukes', retryable: false } }, false));
    const ai = new RemoteWithFallback(remote, new FakeClaude(0), stubHub(null, false));
    expect((await ai.fix({ profile: getProfile('physics'), body: 'b', errorReport: '' })).usage.model).toBe('fake-claude');
  });

  it('hjemmemaskinen kjører kallet og rydder sidebildene', async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'smartnotes-remote-'));
    const jpeg = await sharp({ create: { width: 400, height: 300, channels: 3, background: '#fff' } }).jpeg().toBuffer();
    const call: RemoteCall = {
      method: 'convert',
      req: {
        profile: 'physics',
        subjectName: 'Fysikk 1',
        textbook: null,
        chapters: [],
        fixedChapter: null,
        userTitle: 'Fart',
        userDate: null,
        instructions: null,
        today: '2026-10-11',
        pages: [{ width: 400, height: 300, data: jpeg.toString('base64') }],
      },
    };
    const out = await executeRemoteCall(call, new FakeClaude(0), tmp);
    expect(out).toMatchObject({ ok: true, result: { meta: { title: 'Fart' } } });
    expect(fs.readdirSync(tmp)).toEqual([]);
    const failed = await executeRemoteCall(
      { method: 'generateFlashcards', req: { subjectName: 'F', subjectLabel: 'Fysikk', difficulty: 'medium', count: null, notes: [{ alias: 'n1', title: 'FEIL', chapter: null, section: null, date: null, body: '' }] } },
      new FakeClaude(0),
      tmp,
    );
    expect(failed).toEqual({ ok: false, error: { message: 'Testfeil fra falsk Claude.', retryable: false } });
  });
});

describe('server og hjemmemaskin sammen', () => {
  let ctx: AppContext;
  let base = '';
  let cookie = '';
  let worker: HomeWorker | null = null;
  let running: Promise<void> | null = null;

  const call = async <T = unknown>(method: string, url: string, opts: { json?: unknown; form?: FormData; headers?: Record<string, string> } = {}) => {
    const headers: Record<string, string> = { 'x-smartnotes': '1', ...(cookie ? { cookie } : {}), ...opts.headers };
    let body: string | FormData | undefined;
    if (opts.json !== undefined) {
      headers['content-type'] = 'application/json';
      body = JSON.stringify(opts.json);
    } else if (opts.form) body = opts.form;
    const res = await fetch(base + url, { method, headers, body });
    const text = await res.text();
    return { status: res.status, body: (text ? JSON.parse(text) : null) as T, headers: res.headers };
  };
  const sync = async () => (await call<SyncResponse>('GET', '/api/sync?since=0')).body;
  const waitFor = async (noteId: string, pred: (n: Note) => boolean) => {
    const start = Date.now();
    for (;;) {
      const n = (await sync()).notes.find((x) => x.id === noteId);
      if (n && pred(n)) return n;
      if (Date.now() - start > 60_000) throw new Error(`Tidsavbrudd: ${JSON.stringify(n)}`);
      await new Promise((r) => setTimeout(r, 100));
    }
  };

  beforeAll(async () => {
    const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'smartnotes-remote-app-'));
    const config = loadConfig({
      ...process.env,
      NODE_ENV: 'test',
      DATA_DIR: dataDir,
      APP_PASSWORD: 'hemmelig',
      WEB_DIST: '',
      SEED_TEXTBOOK: 'none',
      SMARTNOTES_FAKE_CLAUDE: '',
      ANTHROPIC_API_KEY: '',
      AI_PROVIDER: 'remote',
      WORKER_TOKEN: TOKEN,
    });
    ctx = await buildApp({ ...config, webDist: null }, { logger: false });
    ctx.worker.start();
    await ctx.app.listen({ port: 0, host: '127.0.0.1' });
    const addr = ctx.app.server.address();
    base = `http://127.0.0.1:${typeof addr === 'object' && addr ? addr.port : 0}`;
    const login = await call('POST', '/api/auth/login', { json: { password: 'hemmelig' } });
    cookie = (login.headers.get('set-cookie') ?? '').split(';')[0]!;
  });

  afterAll(async () => {
    worker?.stop();
    await running;
    await ctx?.worker.stop();
    await ctx?.app.close();
  });

  it('API-et for hjemmemaskinen krever riktig nøkkel og versjon', async () => {
    const body = { name: 'PC', protocol: PROTOCOL_VERSION };
    expect((await call('POST', '/api/worker/claim', { json: body })).status).toBe(401);
    expect((await call('POST', '/api/worker/claim', { json: body, headers: { authorization: 'Bearer feil' } })).status).toBe(401);
    const old = await call<{ message: string }>('POST', '/api/worker/claim', {
      json: { ...body, protocol: PROTOCOL_VERSION + 1 },
      headers: { authorization: `Bearer ${TOKEN}` },
    });
    expect(old.status).toBe(426);
    expect(old.body.message).toContain('git pull');
  });

  it('notatet venter til hjemmemaskinen kobler seg til, og konverteres der', async () => {
    const subject = (await call<Subject>('POST', '/api/subjects', { json: { name: 'Fysikk 1', profile: 'physics' } })).body;
    const png = await sharp({ create: { width: 1200, height: 1600, channels: 3, background: '#fff' } }).png().toBuffer();
    const form = new FormData();
    form.append('subjectId', subject.id);
    form.append('clientId', 'klient-remote');
    form.append('title', 'Hjemme');
    form.append('files', new Blob([new Uint8Array(png)], { type: 'image/png' }), 's.png');
    const note = (await call<Note>('POST', '/api/notes', { form })).body;

    await waitFor(note.id, (n) => n.stage === 'waiting');
    const before = (await call<AiStatusResponse>('GET', '/api/ai/status')).body;
    expect(before.remote).toMatchObject({ waiting: 1, fallback: false });

    const lines: string[] = [];
    worker = new HomeWorker({ serverUrl: base, token: TOKEN, name: 'Testmaskin', ai: new FakeClaude(5), models: ['fake-claude'], log: (l) => lines.push(l) });
    running = worker.run();
    const done = await waitFor(note.id, (n) => n.status === 'done' || n.status === 'failed');
    expect(done).toMatchObject({ status: 'done', title: 'Hjemme' });
    expect(lines.some((l) => l.includes('Koblet til'))).toBe(true);

    const usage = ctx.repo.usageSince(0).filter((e) => e.noteId === note.id);
    expect(usage.map((e) => [e.kind, e.provider, e.model, e.ok])).toEqual([['convert', 'remote', 'fake-claude', true]]);
    const status = (await call<AiStatusResponse>('GET', '/api/ai/status')).body;
    expect(status.remote?.workers).toEqual([expect.objectContaining({ name: 'Testmaskin', models: ['fake-claude'] })]);
    expect(status.remote?.waiting).toBe(0);
  });
});
