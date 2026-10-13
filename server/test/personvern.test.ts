import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { CreateInviteResponse, Deck, InvitesResponse, LegalInfo, LoginResponse, Note, SyncResponse } from '@smartnotes/shared';
import { buildApp, type AppContext } from '../src/app.js';
import { loadConfig } from '../src/config.js';
import { OWNER_ID } from '../src/db.js';
import { FakeClaude } from '../src/pipeline/claude.js';

/**
 * Personvern og vilkår: det personvernerklæringen viser, at vilkårene godtas ved registrering, «AI-generert» i PDF-ene,
 * at forbruksloggen ikke har innhold fra notatene, og «Slett konto», som sletter alt brukeren har på serveren.
 */

const PASSWORD = 'hemmelig';
let ctx: AppContext;
let base = '';
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
    const raw = Buffer.from(await res.arrayBuffer());
    const text = raw.toString('utf8');
    return { status: res.status, body: (text.startsWith('{') ? JSON.parse(text) : raw) as T, setCookie: res.headers.getSetCookie() };
  }
  sync = async () => (await this.call<SyncResponse>('GET', '/api/sync?since=0')).body;
}

let owner: Client;

async function student(username: string) {
  const { code } = (await owner.call<CreateInviteResponse>('POST', '/api/admin/invites')).body;
  const client = new Client();
  const res = await client.call<LoginResponse>('POST', '/api/auth/register', {
    json: { code, username, password: 'passord-123', presetIds: ['fysikk-1-lk20'], ageConfirmed: true, termsAccepted: true },
  });
  expect(res.status).toBe(201);
  return { client, userId: res.body.user.id, subjectId: (await client.sync()).subjects[0]!.id };
}

async function convertedNote(c: Client, subjectId: string): Promise<Note> {
  const form = new FormData();
  form.append('subjectId', subjectId);
  form.append('clientId', randomUUID());
  form.append('title', 'Mitt hemmelige notat om krefter');
  form.append('files', new Blob([new Uint8Array(pngPage)], { type: 'image/png' }), 'side.png');
  const up = await c.call<Note>('POST', '/api/notes', { form });
  expect(up.status).toBe(201);
  const start = Date.now();
  for (;;) {
    const note = (await c.sync()).notes.find((n) => n.id === up.body.id);
    if (note?.status === 'done') return note;
    if (Date.now() - start > 60_000) throw new Error(`Tidsavbrudd: ${JSON.stringify(note)}`);
    await new Promise((r) => setTimeout(r, 150));
  }
}

beforeAll(async () => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'smartnotes-personvern-'));
  const config = loadConfig({
    ...process.env,
    NODE_ENV: 'test',
    DATA_DIR: dataDir,
    APP_PASSWORD: PASSWORD,
    WEB_DIST: '',
    SEED_TEXTBOOKS: 'fysikk-1-lk20',
    PRIVACY_CONTROLLER_NAME: 'Ola Nordmann',
    PRIVACY_CONTACT: 'smartnotes@example.no',
  });
  ctx = await buildApp({ ...config, webDist: null }, { ai: new FakeClaude(5), logger: false });
  ctx.worker.start();
  await ctx.app.listen({ port: 0, host: '127.0.0.1' });
  const addr = ctx.app.server.address();
  base = `http://127.0.0.1:${typeof addr === 'object' && addr ? addr.port : 0}`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="1600"><rect width="100%" height="100%" fill="#f4f1e8"/>
    <text x="100" y="200" font-size="80">Krefter</text></svg>`;
  pngPage = await sharp(Buffer.from(svg)).png().toBuffer();
  owner = new Client();
  expect((await owner.call('POST', '/api/auth/login', { json: { password: PASSWORD } })).status).toBe(200);
}, 60_000);

afterAll(async () => {
  await ctx?.worker.stop();
  await ctx?.app.close();
});

describe('personvernerklæringen og vilkårene', () => {
  it('viser ansvarlig og kontakt fra variablene, også uten innlogging', async () => {
    const res = await new Client().call<LegalInfo>('GET', '/api/legal');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ controllerName: 'Ola Nordmann', contact: 'smartnotes@example.no', minAge: 15, freePagesPerDay: 15, freeDecksPerDay: 2 });
  });

  it('er tomme (null) når variablene mangler, så appen viser «[Fylles inn]»', () => {
    const config = loadConfig({ NODE_ENV: 'test', APP_PASSWORD: 'x', PRIVACY_CONTROLLER_NAME: '  ' });
    expect(config.privacy).toEqual({ controllerName: null, contact: null });
  });

  it('lagrer når eleven godtok vilkårene ved registrering', async () => {
    const { userId } = await student('godtok');
    expect(ctx.repo.getUser(userId)!.terms_accepted_at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(ctx.repo.getUser(OWNER_ID)!.terms_accepted_at).toBeNull();
  });
});

describe('AI-generert', () => {
  it('står i bunnteksten på PDF-en, og forbruksloggen har ikke noe innhold fra notatet', async () => {
    const subjectId = (await owner.sync()).subjects[0]!.id;
    const note = await convertedNote(owner, subjectId);
    const text = execFileSync('pdftotext', ['-layout', ctx.storage.noteFile(note.id, 'note.pdf'), '-'], { encoding: 'utf8' });
    expect(text).toContain('AI-generert med SmartNotes');
    const rows = ctx.repo.db.prepare(`SELECT * FROM usage_log WHERE note_id = ?`).all(note.id);
    expect(rows.length).toBeGreaterThan(0);
    const dump = JSON.stringify(rows);
    for (const word of ['hemmelige', 'Krefter', 'Newton', note.searchText.slice(0, 30)]) expect(dump).not.toContain(word);
  }, 90_000);
});

describe('slett konto', () => {
  it('sletter alt eleven har på serveren, og ikke noe annet', async () => {
    const victim = await student('slettes');
    const other = await student('blir');
    const note = await convertedNote(victim.client, victim.subjectId);
    const keep = await convertedNote(other.client, other.subjectId);
    const deck = await victim.client.call<Deck>('POST', '/api/decks', { json: { subjectId: victim.subjectId, noteIds: [note.id], difficulty: 'easy' } });
    expect(deck.status).toBe(201);
    await ctx.generator.idle();
    // En samle-PDF for faget, så den også må ryddes bort.
    expect((await victim.client.call('GET', `/api/subjects/${victim.subjectId}/pdf`)).status).toBe(200);
    expect(fs.readdirSync(ctx.storage.bundlesRoot).some((f) => f.startsWith(`subject-${victim.subjectId}-`))).toBe(true);
    expect(fs.existsSync(ctx.storage.noteDir(note.id))).toBe(true);

    const wrong = await victim.client.call<{ error: string }>('DELETE', '/api/auth/account', { json: { password: 'feil-passord' } });
    expect(wrong.status).toBe(403);
    expect(wrong.body.error).toBe('wrong_password');
    const res = await victim.client.call('DELETE', '/api/auth/account', { json: { password: 'passord-123' } });
    expect(res.status).toBe(200);
    expect(res.setCookie.some((c) => /^sn_session=;/.test(c))).toBe(true);

    for (const table of ['subjects', 'chapters', 'notes', 'decks', 'cards', 'usage_log', 'quota_log', 'user_sessions', 'user_devices', 'password_resets']) {
      expect(ctx.repo.db.prepare(`SELECT COUNT(*) AS n FROM ${table} WHERE user_id = ?`).get(victim.userId), table).toEqual({ n: 0 });
    }
    expect(ctx.repo.db.prepare(`SELECT COUNT(*) AS n FROM note_files WHERE note_id = ?`).get(note.id)).toEqual({ n: 0 });
    expect(ctx.repo.getUser(victim.userId)).toBeNull();
    expect(fs.existsSync(ctx.storage.noteDir(note.id))).toBe(false);
    expect(fs.readdirSync(ctx.storage.bundlesRoot).some((f) => f.startsWith(`subject-${victim.subjectId}-`))).toBe(false);
    // Innloggingen virker ikke lenger, og invitasjonen står som brukt, uten navn.
    expect((await new Client().call('POST', '/api/auth/login', { json: { username: 'slettes', password: 'passord-123' } })).status).toBe(401);
    expect((await victim.client.call('GET', '/api/sync?since=0')).status).toBe(401);
    const invites = (await owner.call<InvitesResponse>('GET', '/api/admin/invites')).body.invites;
    expect(invites.filter((i) => i.status === 'used' && i.usedBy === null)).toHaveLength(1);

    // Den andre eleven og eieren har alt sitt.
    expect((await other.client.sync()).notes.map((n) => n.id)).toEqual([keep.id]);
    expect(fs.existsSync(ctx.storage.noteDir(keep.id))).toBe(true);
    expect((await owner.sync()).subjects.length).toBeGreaterThan(0);
  }, 120_000);

  it('lar ikke eieren slette sin egen konto', async () => {
    const res = await owner.call<{ message: string }>('DELETE', '/api/auth/account', { json: { password: PASSWORD } });
    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Eieren kan ikke slette sin egen konto.');
    expect(ctx.repo.getUser(OWNER_ID)).not.toBeNull();
  });
});
