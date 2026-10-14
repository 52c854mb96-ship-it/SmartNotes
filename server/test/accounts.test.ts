import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type {
  AdminUsersResponse,
  Chapter,
  CreateInviteResponse,
  Deck,
  InvitesResponse,
  LoginResponse,
  MeResponse,
  Note,
  PublicPresetsResponse,
  ResetLinkResponse,
  SyncResponse,
} from '@smartnotes/shared';
import { buildApp, type AppContext } from '../src/app.js';
import { ROUTE_ACCESS } from '../src/auth.js';
import { loadConfig } from '../src/config.js';
import { OWNER_ID, Repo } from '../src/db.js';
import { hashPassword, hashToken, newInviteCode, normalizeInviteCode, verifyPassword } from '../src/passwords.js';
import { FakeClaude } from '../src/pipeline/claude.js';
import type { UsageRef } from '../src/usage.js';
import { Storage } from '../src/storage.js';

/**
 * Kontoene: innlogging, invitasjoner, nytt passord, eierens sider, modell per plan, og at ingen bruker kan se eller
 * endre en annens data på noen rute. Tenk på det som en oppgang med postkasser: alle brevene ligger i samme bygg, men
 * nøkkelen din åpner bare din egen kasse.
 */

const PASSWORD = 'hemmelig';
const WORKER_TOKEN = 'arbeider-'.repeat(5);

/** Gratisbrukerne konverterer med en egen modell; en egen falsk modell viser hvilken som ble brukt. */
class FreeFake extends FakeClaude {
  override readonly model = 'fake-free' as 'fake-claude';
}

interface CallOpts {
  json?: unknown;
  form?: FormData;
  csrf?: boolean;
  headers?: Record<string, string>;
}

interface Res<T> {
  status: number;
  body: T;
  raw: Buffer;
}

let ctx: AppContext;
let base = '';
let pngPage: Buffer;
let ipCounter = 10;

/** En nettleser med egne informasjonskapsler (med sti, som en ekte) og sin egen IP-adresse bak proxyen. */
class Client {
  private readonly cookies = new Map<string, { value: string; path: string }>();
  constructor(readonly ip = `198.51.100.${ipCounter++}`) {}

  async call<T = unknown>(method: string, url: string, opts: CallOpts = {}): Promise<Res<T>> {
    const headers: Record<string, string> = { 'x-forwarded-for': this.ip, ...opts.headers };
    const jar = [...this.cookies].filter(([, c]) => url.startsWith(c.path)).map(([k, c]) => `${k}=${c.value}`);
    if (jar.length > 0) headers.cookie = jar.join('; ');
    if (opts.csrf !== false && method !== 'GET') headers['x-smartnotes'] = '1';
    let body: string | FormData | undefined;
    if (opts.json !== undefined) {
      headers['content-type'] = 'application/json';
      body = JSON.stringify(opts.json);
    } else if (opts.form) body = opts.form;
    const res = await fetch(base + url, { method, headers, body });
    for (const line of res.headers.getSetCookie()) {
      const [pair, ...attrs] = line.split(';');
      const [name, ...rest] = pair!.split('=');
      const value = rest.join('=');
      const cookiePath = attrs.map((a) => a.trim()).find((a) => a.toLowerCase().startsWith('path='))?.slice(5) ?? '/';
      if (!value || /max-age=0|expires=thu, 01 jan 1970/i.test(line)) this.cookies.delete(name!.trim());
      else this.cookies.set(name!.trim(), { value, path: cookiePath });
    }
    const raw = Buffer.from(await res.arrayBuffer());
    const type = res.headers.get('content-type') ?? '';
    return { status: res.status, body: (type.includes('application/json') ? JSON.parse(raw.toString('utf8')) : raw) as T, raw };
  }

  get = <T = unknown>(url: string) => this.call<T>('GET', url);
  post = <T = unknown>(url: string, json: unknown = {}) => this.call<T>('POST', url, { json });

  hasCookie(name: string): boolean {
    return this.cookies.has(name);
  }

  cookieValue(name: string): string | undefined {
    return this.cookies.get(name)?.value;
  }

  forget(name: string): void {
    this.cookies.delete(name);
  }

  async sync(since = 0): Promise<SyncResponse> {
    const res = await this.get<SyncResponse>(`/api/sync?since=${since}`);
    expect(res.status).toBe(200);
    return res.body;
  }
}

let owner: Client;

async function loginOwner(c = new Client()): Promise<Client> {
  const res = await c.post<LoginResponse>('/api/auth/login', { password: PASSWORD });
  expect(res.status, JSON.stringify(res.body)).toBe(200);
  return c;
}

async function invite(): Promise<CreateInviteResponse> {
  const res = await owner.post<CreateInviteResponse>('/api/admin/invites');
  expect(res.status).toBe(201);
  return res.body;
}

async function register(username: string, opts: { presetIds?: string[]; password?: string } = {}): Promise<{ client: Client; userId: number }> {
  const { code } = await invite();
  const client = new Client();
  const res = await client.post<LoginResponse>('/api/auth/register', {
    code,
    username,
    password: opts.password ?? 'passord-123',
    presetIds: opts.presetIds ?? ['fysikk-1-lk20'],
    ageConfirmed: true,
    termsAccepted: true,
  });
  expect(res.status, JSON.stringify(res.body)).toBe(201);
  return { client, userId: res.body.user.id };
}

function pageForm(fields: Record<string, string>): FormData {
  const form = new FormData();
  for (const [k, v] of Object.entries(fields)) form.append(k, v);
  form.append('files', new Blob([new Uint8Array(pngPage)], { type: 'image/png' }), 'side.png');
  return form;
}

async function waitUntil<T>(what: string, fn: () => Promise<T | null | undefined>, timeoutMs = 90_000): Promise<T> {
  const start = Date.now();
  for (;;) {
    const v = await fn();
    if (v) return v;
    if (Date.now() - start > timeoutMs) throw new Error(`Tidsavbrudd: ${what}`);
    await new Promise((r) => setTimeout(r, 150));
  }
}

/** Det en bruker har: et fag, et kapittel, et ferdig notat og en ferdig kortstokk med kort. */
interface Fixture {
  userId: number;
  subjectId: string;
  chapterId: string;
  noteId: string;
  clientId: string;
  deckId: string;
  cardId: string;
}

async function makeFixture(c: Client, userId: number): Promise<Fixture> {
  const subject = (await c.sync()).subjects[0]!;
  const ch = await c.post<Chapter>(`/api/subjects/${subject.id}/chapters`, { number: '42', title: 'Testkapittel' });
  expect(ch.status).toBe(201);
  const clientId = randomUUID();
  const up = await c.call<Note>('POST', '/api/notes', { form: pageForm({ subjectId: subject.id, chapterId: ch.body.id, clientId }) });
  expect(up.status, JSON.stringify(up.body)).toBe(201);
  const noteId = up.body.id;
  await waitUntil('notatet konverteres', async () => (await c.sync()).notes.find((n) => n.id === noteId && n.status === 'done'));
  const deck = await c.post<Deck>('/api/decks', { subjectId: subject.id, noteIds: [noteId], difficulty: 'medium' });
  expect(deck.status, JSON.stringify(deck.body)).toBe(201);
  await waitUntil('kortstokken lages', async () => (await c.sync()).decks.find((d) => d.id === deck.body.id && d.status === 'ready'));
  const card = (await c.sync()).cards.find((k) => k.deckId === deck.body.id)!;
  return { userId, subjectId: subject.id, chapterId: ch.body.id, noteId, clientId, deckId: deck.body.id, cardId: card.id };
}

/** Alt en bruker har, slik synken viser det (uten cursor, som andres endringer flytter). */
async function snapshot(c: Client, userId: number) {
  const { cursor: _cursor, ...rows } = await c.sync();
  return { rows, usage: ctx.repo.usageSince(0, userId).length, files: ctx.repo.noteFiles(rows.notes[0]?.id ?? '').length };
}

beforeAll(async () => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'smartnotes-kontoer-'));
  const config = loadConfig({
    ...process.env,
    NODE_ENV: 'test',
    DATA_DIR: dataDir,
    APP_PASSWORD: PASSWORD,
    WEB_DIST: '',
    SEED_TEXTBOOKS: 'fysikk-1-lk20',
    WORKER_TOKEN,
  });
  ctx = await buildApp({ ...config, webDist: null }, { ai: new FakeClaude(5), freeAi: new FreeFake(5), logger: false });
  ctx.worker.start();
  await ctx.app.listen({ port: 0, host: '127.0.0.1' });
  const addr = ctx.app.server.address();
  base = `http://127.0.0.1:${typeof addr === 'object' && addr ? addr.port : 0}`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="1600"><rect width="100%" height="100%" fill="#f4f1e8"/>
    <text x="100" y="200" font-size="80">Krefter</text></svg>`;
  pngPage = await sharp(Buffer.from(svg)).png().toBuffer();
  owner = await loginOwner();
}, 60_000);

afterAll(async () => {
  await ctx?.worker.stop();
  await ctx?.app.close();
});

describe('passord', () => {
  it('lagres med scrypt og sjekkes riktig', async () => {
    const hash = await hashPassword('riktig-passord');
    expect(hash).toMatch(/^scrypt\$16384\$8\$1\$[\w-]+\$[\w-]+$/);
    expect(hash).not.toContain('riktig-passord');
    expect(await verifyPassword('riktig-passord', hash)).toBe(true);
    expect(await verifyPassword('feil-passord', hash)).toBe(false);
    expect(await verifyPassword('riktig-passord', null)).toBe(false);
    expect(await hashPassword('riktig-passord')).not.toBe(hash);
  });

  it('lager invitasjonskoder uten tegn som kan forveksles', () => {
    const code = newInviteCode();
    expect(code).toMatch(/^[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/);
    expect(normalizeInviteCode(` ${code.toLowerCase()} `)).toBe(code.replaceAll('-', ''));
  });
});

describe('innlogging', () => {
  it('eieren logger inn med APP_PASSWORD, med eller uten brukernavn, som før kontoene', async () => {
    for (const username of [undefined, '', 'eier', ' Eier ']) {
      const c = new Client();
      const res = await c.post<LoginResponse>('/api/auth/login', { username, password: PASSWORD });
      expect(res.status, String(username)).toBe(200);
      expect(res.body.user).toEqual({ id: OWNER_ID, username: 'eier', plan: 'owner' });
      expect((await c.get<MeResponse>('/api/auth/me')).body).toEqual({ authenticated: true, user: res.body.user });
    }
    const wrong = await new Client().post('/api/auth/login', { username: 'eier', password: 'feil' });
    expect(wrong.status).toBe(401);
  });

  it('gir samme svar for ukjent brukernavn og feil passord', async () => {
    await register('kari');
    const unknown = await new Client().post<{ message: string }>('/api/auth/login', { username: 'finnesikke', password: 'passord-123' });
    const wrong = await new Client().post<{ message: string }>('/api/auth/login', { username: 'kari', password: 'feil-passord' });
    expect(unknown.status).toBe(401);
    expect(wrong.status).toBe(401);
    expect(unknown.body.message).toBe(wrong.body.message);
    const right = await new Client().post<LoginResponse>('/api/auth/login', { username: 'KARI', password: 'passord-123' });
    expect(right.status).toBe(200);
    expect(right.body.user).toMatchObject({ username: 'kari', plan: 'free' });
  });

  it('sperrer en konto for nye enheter etter 10 feil, men ikke en enhet som har logget inn før', async () => {
    const { client: known } = await register('per');
    expect(known.hasCookie('sn_device')).toBe(true);
    // Ti feil fra ti forskjellige adresser (så grensene per IP ikke slår inn).
    for (let i = 0; i < 10; i++) {
      expect((await new Client().post('/api/auth/login', { username: 'per', password: 'feil-passord' })).status).toBe(401);
    }
    const fresh = await new Client().post<{ error: string }>('/api/auth/login', { username: 'per', password: 'passord-123' });
    expect(fresh.status).toBe(429);
    expect(fresh.body.error).toBe('locked');
    // Enheten som har logget inn før, slipper inn (ellers kunne hvem som helst sperre eleven ute).
    known.forget('sn_session');
    const again = await known.post<LoginResponse>('/api/auth/login', { username: 'per', password: 'passord-123' });
    expect(again.status).toBe(200);
    // Riktig passord nullstiller tellingen.
    expect(ctx.repo.getUserByName('per')).toMatchObject({ failed_logins: 0, locked_until: null });
  });

  it('sperrer også eierens konto for nye enheter etter 10 feil uten brukernavn, men ikke eierens egne enheter', async () => {
    // Testene over har gitt eieren noen feil forsøk; start tellingen på null.
    ctx.repo.recordLogin(OWNER_ID);
    for (let i = 0; i < 10; i++) {
      expect((await new Client().post('/api/auth/login', { password: 'feil' })).status).toBe(401);
    }
    const fresh = await new Client().post<{ error: string }>('/api/auth/login', { password: PASSWORD });
    expect(fresh.status).toBe(429);
    expect(fresh.body.error).toBe('locked');
    // Enheten eieren har logget inn fra før, slipper inn.
    owner.forget('sn_session');
    expect((await owner.post('/api/auth/login', { password: PASSWORD })).status).toBe(200);
    expect(ctx.repo.getUser(OWNER_ID)).toMatchObject({ locked_until: null, failed_logins: 0 });
  });

  it('gir samme svar for riktig og feil passord mens kontoen er sperret, og sperrer ukjente brukernavn på samme måte', async () => {
    await register('sperret');
    for (let i = 0; i < 10; i++) await new Client().post('/api/auth/login', { username: 'sperret', password: 'feil-passord' });
    const right = await new Client().post<{ error: string; message: string }>('/api/auth/login', { username: 'sperret', password: 'passord-123' });
    const wrong = await new Client().post<{ error: string; message: string }>('/api/auth/login', { username: 'sperret', password: 'feil-igjen' });
    expect([right.status, right.body]).toEqual([429, wrong.body]);
    expect(wrong.status).toBe(429);
    for (let i = 0; i < 10; i++) await new Client().post('/api/auth/login', { username: 'finnesikke-heller', password: 'feil' });
    const unknown = await new Client().post<{ error: string; message: string }>('/api/auth/login', { username: 'finnesikke-heller', password: 'x' });
    expect([unknown.status, unknown.body]).toEqual([429, wrong.body]);
  });

  it('teller forsøk som sendes samtidig (grensene kan ikke omgås ved å sende mange på en gang)', async () => {
    const c = new Client();
    const results = await Promise.all(
      Array.from({ length: 16 }, () => c.post('/api/auth/login', { username: 'kari', password: 'feil-samtidig' })),
    );
    const statuses = results.map((r) => r.status);
    expect(statuses.filter((x) => x === 401).length).toBeLessThanOrEqual(10);
    expect(statuses.filter((x) => x === 429).length).toBeGreaterThanOrEqual(6);
  });

  it('begrenser forsøk per adresse og per adresse og brukernavn', async () => {
    const pair = new Client();
    for (let i = 0; i < 10; i++) await pair.post('/api/auth/login', { username: 'kari', password: 'feil' });
    expect((await pair.post('/api/auth/login', { username: 'kari', password: 'passord-123' })).status).toBe(429);

    const ip = new Client();
    for (let i = 0; i < 50; i++) await ip.post('/api/auth/login', { username: `ukjent${i}`, password: 'feil' });
    const blocked = await ip.post<{ error: string }>('/api/auth/login', { password: PASSWORD });
    expect(blocked.status).toBe(429);
    expect(blocked.body.error).toBe('too_many_attempts');
    // En annen adresse merker ingenting.
    expect((await new Client().post('/api/auth/login', { password: PASSWORD })).status).toBe(200);
  });

  it('bruker adressen fra proxyen bare ett ledd bak (TRUST_PROXY_HOPS=1)', async () => {
    // Klienten legger selv inn en ny adresse først i X-Forwarded-For hver gang (og et nytt brukernavn); bare den siste
    // adressen kommer fra proxyen, så forsøkene telles likevel på samme adresse.
    const real = '198.51.100.250';
    for (let i = 0; i < 50; i++) {
      const res = await new Client(`10.0.${i}.1, ${real}`).post('/api/auth/login', { username: `proxy${i}`, password: 'feil' });
      expect(res.status).toBe(401);
    }
    const blocked = await new Client(`10.9.9.9, ${real}`).post<{ error: string }>('/api/auth/login', { username: 'proxy-ny', password: 'feil' });
    expect(blocked.status).toBe(429);
    expect(blocked.body.error).toBe('too_many_attempts');
    expect((await new Client(`10.9.9.9, 198.51.100.251`).post('/api/auth/login', { username: 'proxy-ny', password: 'feil' })).status).toBe(401);
  });

  it('svarer 409 når appen tror den er logget inn med en annen konto', async () => {
    const res = await owner.call('GET', '/api/sync?since=0', { headers: { 'x-smartnotes-account': '999' } });
    expect(res.status).toBe(409);
    const ok = await owner.call('GET', '/api/sync?since=0', { headers: { 'x-smartnotes-account': String(OWNER_ID) } });
    expect(ok.status).toBe(200);
  });

  it('logger ut', async () => {
    const c = await loginOwner();
    expect((await c.post('/api/auth/logout')).status).toBe(200);
    expect((await c.get<MeResponse>('/api/auth/me')).body).toEqual({ authenticated: false, user: null });
    expect((await c.get('/api/sync?since=0')).status).toBe(401);
  });
});

describe('registrering', () => {
  it('viser fagene og aldersgrensen uten innlogging', async () => {
    const res = await new Client().get<PublicPresetsResponse>('/api/auth/presets');
    expect(res.status).toBe(200);
    expect(res.body.minAge).toBe(15);
    expect(res.body.presets.map((p) => p.id)).toEqual(['fysikk-1-lk20', 'kjemi-1-lk20', 'biologi-1-lk20', 'geofag-1-lk20']);
  });

  it('lager en gratiskonto med fagene eleven valgte, og koden virker bare én gang', async () => {
    const { code, invite: inv } = await invite();
    expect(inv.status).toBe('active');
    expect(inv.codeHint).toBe(normalizeInviteCode(code).slice(-4));
    const c = new Client();
    const res = await c.post<LoginResponse>('/api/auth/register', {
      code: code.toLowerCase().replaceAll('-', ' '),
      username: ' Ola.Nordmann ',
      password: 'langt-passord',
      presetIds: ['kjemi-1-lk20', 'geofag-1-lk20'],
      ageConfirmed: true,
      termsAccepted: true,
    });
    expect(res.status, JSON.stringify(res.body)).toBe(201);
    expect(res.body.user).toMatchObject({ username: 'ola.nordmann', plan: 'free' });
    const sync = await c.sync();
    expect(sync.userId).toBe(res.body.user.id);
    expect(sync.subjects.map((s) => s.name).sort()).toEqual(['Geofag 1', 'Kjemi 1']);
    expect(sync.chapters.length).toBeGreaterThan(0);
    expect(sync.chapters.every((ch) => sync.subjects.some((s) => s.id === ch.subjectId))).toBe(true);

    const again = await new Client().post<{ message: string }>('/api/auth/register', {
      code,
      username: 'noenannen',
      password: 'langt-passord',
      presetIds: ['fysikk-1-lk20'],
      ageConfirmed: true,
      termsAccepted: true,
    });
    expect(again.status).toBe(400);
    expect(again.body.message).toMatch(/ugyldig, brukt eller utløpt/);
    const list = (await owner.get<InvitesResponse>('/api/admin/invites')).body.invites.find((i) => i.id === inv.id)!;
    expect(list).toMatchObject({ status: 'used', usedBy: 'ola.nordmann' });
  });

  it('avviser utløpte og tilbaketrukne koder', async () => {
    const expired = await invite();
    ctx.repo.db.prepare(`UPDATE invites SET expires_at = ? WHERE id = ?`).run(new Date(Date.now() - 1000).toISOString(), expired.invite.id);
    const revoked = await invite();
    expect((await owner.call('DELETE', `/api/admin/invites/${revoked.invite.id}`)).status).toBe(200);
    expect((await owner.call('DELETE', `/api/admin/invites/${revoked.invite.id}`)).status).toBe(404);
    for (const code of [expired.code, revoked.code, 'AAAA-BBBB-CCCC', '']) {
      const res = await new Client().post('/api/auth/register', {
        code,
        username: 'nyelev',
        password: 'langt-passord',
        presetIds: ['fysikk-1-lk20'],
        ageConfirmed: true,
        termsAccepted: true,
      });
      expect(res.status, code).toBe(400);
    }
    const statuses = (await owner.get<InvitesResponse>('/api/admin/invites')).body.invites;
    expect(statuses.find((i) => i.id === expired.invite.id)!.status).toBe('expired');
    expect(statuses.find((i) => i.id === revoked.invite.id)!.status).toBe('revoked');
    expect(ctx.repo.getUserByName('nyelev')).toBeNull();
  });

  it('sjekker brukernavn, passord, alder og fag, og bruker ikke opp koden ved feil', async () => {
    const { code } = await invite();
    const good = { code, username: 'lise', password: 'langt-passord', presetIds: ['fysikk-1-lk20'], ageConfirmed: true, termsAccepted: true };
    const cases: [Record<string, unknown>, number, RegExp][] = [
      [{ username: 'eier' }, 409, /tatt/],
      [{ username: 'kari' }, 409, /tatt/],
      [{ username: 'ab' }, 400, /3–32 tegn/],
      [{ username: 'med mellomrom' }, 400, /bare ha bokstaver/],
      [{ password: 'kort' }, 400, /minst 8 tegn/],
      [{ ageConfirmed: false }, 400, /minst 15 år/],
      [{ termsAccepted: false }, 400, /godta vilkårene/],
      [{ presetIds: [] }, 400, /minst ett fag/],
      [{ presetIds: ['finnes-ikke'] }, 400, /Ukjent fag/],
      [{ presetIds: ['__proto__'] }, 400, /Ukjent fag/],
    ];
    for (const [patch, status, message] of cases) {
      const res = await new Client().post<{ message: string }>('/api/auth/register', { ...good, ...patch });
      expect(res.status, JSON.stringify(patch)).toBe(status);
      expect(res.body.message, JSON.stringify(patch)).toMatch(message);
    }
    expect((await new Client().post('/api/auth/register', good)).status).toBe(201);
  });

  it('begrenser forsøk med feil kode per adresse', async () => {
    const c = new Client();
    for (let i = 0; i < 10; i++) {
      expect((await c.post('/api/auth/register', { code: `FEIL-KODE-${i}`, username: 'x', password: 'y' })).status).toBe(400);
    }
    expect((await c.post('/api/auth/register', { code: 'FEIL-KODE-X', username: 'x', password: 'y' })).status).toBe(429);
  });
});

describe('nytt passord', () => {
  it('lenken virker én gang, logger ut alle andre steder og bytter passordet', async () => {
    const { client: old, userId } = await register('mari');
    const oldDevice = old.cookieValue('sn_device')!;
    expect(ctx.repo.isKnownDevice(hashToken(oldDevice), userId)).toBe(true);
    const link = await owner.post<ResetLinkResponse>(`/api/admin/users/${userId}/reset-link`);
    expect(link.status).toBe(200);
    const c = new Client();
    const res = await c.post<LoginResponse>('/api/auth/reset', { token: link.body.token, password: 'nytt-passord' });
    expect(res.status, JSON.stringify(res.body)).toBe(200);
    expect(res.body.user.username).toBe('mari');
    expect((await c.get('/api/sync?since=0')).status).toBe(200);
    expect((await old.get('/api/sync?since=0')).status).toBe(401);
    // Ingen enhet fra før er lenger unntatt fra kontosperren (en som kjente det gamle passordet, skal ikke slippe den).
    expect(ctx.repo.isKnownDevice(hashToken(oldDevice), userId)).toBe(false);
    expect((await new Client().post('/api/auth/login', { username: 'mari', password: 'passord-123' })).status).toBe(401);
    expect((await new Client().post('/api/auth/login', { username: 'mari', password: 'nytt-passord' })).status).toBe(200);
    expect((await new Client().post('/api/auth/reset', { token: link.body.token, password: 'tredje-passord' })).status).toBe(400);
  });

  it('avviser en utløpt lenke, en ny lenke trekker tilbake den forrige, og eieren får ingen lenke', async () => {
    const { userId } = await register('jonas');
    const first = await owner.post<ResetLinkResponse>(`/api/admin/users/${userId}/reset-link`);
    const second = await owner.post<ResetLinkResponse>(`/api/admin/users/${userId}/reset-link`);
    ctx.repo.db
      .prepare(`UPDATE password_resets SET expires_at = ? WHERE token_hash = ?`)
      .run(new Date(Date.now() - 1000).toISOString(), hashToken(second.body.token));
    for (const token of [first.body.token, second.body.token, 'tull']) {
      expect((await new Client().post('/api/auth/reset', { token, password: 'nytt-passord' })).status).toBe(400);
    }
    expect((await owner.post(`/api/admin/users/${OWNER_ID}/reset-link`)).status).toBe(400);
    expect((await owner.post('/api/admin/users/99999/reset-link')).status).toBe(404);
    expect((await new Client().post('/api/auth/reset', { token: 'x', password: 'kort' })).status).toBe(400);
  });
});

describe('eierens sider', () => {
  it('stenger og åpner en konto', async () => {
    const { client, userId } = await register('stengt');
    // Det som venter på hjemmemaskinen, avbrytes for denne brukeren og ingen andre.
    const cancels: ((ref: UsageRef) => boolean)[] = [];
    const cancel = ctx.hub.cancel.bind(ctx.hub);
    ctx.hub.cancel = (match) => {
      cancels.push(match);
      return cancel(match);
    };
    try {
      expect((await owner.post(`/api/admin/users/${userId}/disable`)).status).toBe(200);
    } finally {
      ctx.hub.cancel = cancel;
    }
    expect(cancels).toHaveLength(1);
    expect(cancels[0]!({ userId, deckId: 'kortstokk' })).toBe(true);
    expect(cancels[0]!({ userId: OWNER_ID, noteId: 'notat' })).toBe(false);
    expect(ctx.repo.isKnownDevice(hashToken(client.cookieValue('sn_device')!), userId)).toBe(false);
    expect((await client.get('/api/sync?since=0')).status).toBe(401);
    const wrong = await new Client().post('/api/auth/login', { username: 'stengt', password: 'feil-passord' });
    expect(wrong.status).toBe(401);
    const right = await new Client().post<{ error: string }>('/api/auth/login', { username: 'stengt', password: 'passord-123' });
    expect(right.status).toBe(403);
    expect(right.body.error).toBe('disabled');
    expect((await owner.post(`/api/admin/users/${userId}/reset-link`)).status).toBe(400);
    expect((await owner.post(`/api/admin/users/${OWNER_ID}/disable`)).status).toBe(400);
    expect((await owner.post(`/api/admin/users/${userId}/enable`)).status).toBe(200);
    expect((await new Client().post('/api/auth/login', { username: 'stengt', password: 'passord-123' })).status).toBe(200);
  });

  it('viser brukerne med plan og forbruk, bare for eieren', async () => {
    const res = await owner.get<AdminUsersResponse>('/api/admin/users');
    expect(res.status).toBe(200);
    expect(res.body.users[0]).toMatchObject({ id: OWNER_ID, username: 'eier', plan: 'owner', disabled: false });
    expect(res.body.users.find((u) => u.username === 'kari')).toMatchObject({ plan: 'free', usage30d: { calls: 0, pages: 0, costNok: 0 } });
    const { client } = await register('nysgjerrig');
    for (const url of ['/api/admin/users', '/api/admin/invites', '/api/usage', '/api/backup/status', '/api/compare/summary', '/api/ai/status']) {
      expect((await client.get(url)).status, url).toBe(404);
    }
    expect((await client.post('/api/admin/invites')).status).toBe(404);
  });

  it('lar eieren velge et annet brukernavn', async () => {
    const taken = await owner.call('PATCH', '/api/admin/me', { json: { username: 'kari' } });
    expect(taken.status).toBe(409);
    expect((await owner.call('PATCH', '/api/admin/me', { json: { username: 'x' } })).status).toBe(400);
    const res = await owner.call<LoginResponse>('PATCH', '/api/admin/me', { json: { username: 'Mamma' } });
    expect(res.status).toBe(200);
    expect(res.body.user.username).toBe('mamma');
    expect((await new Client().post('/api/auth/login', { username: 'mamma', password: PASSWORD })).status).toBe(200);
    expect((await new Client().post('/api/auth/login', { password: PASSWORD })).status).toBe(200);
    expect((await new Client().post('/api/auth/login', { username: 'eier', password: PASSWORD })).status).toBe(401);
    expect((await owner.call('PATCH', '/api/admin/me', { json: { username: 'eier' } })).status).toBe(200);
  });
});

describe('modell per plan', () => {
  it('eieren konverterer med konverteringsmodellen, gratisbrukerne med sin egen, og forbruket logges per bruker med sider', async () => {
    const { client, userId } = await register('modell');
    const mine = await makeFixture(client, userId);
    const theirs = await makeFixture(owner, OWNER_ID);
    const rows = ctx.repo.usageSince(0);
    const convert = (noteId: string) => rows.filter((r) => r.kind === 'convert' && r.noteId === noteId);
    expect(convert(mine.noteId).map((r) => [r.model, r.userId, r.pages])).toEqual([['fake-free', userId, 1]]);
    expect(convert(theirs.noteId).map((r) => [r.model, r.userId, r.pages])).toEqual([['fake-claude', OWNER_ID, 1]]);
    // Kortstokkene bruker samme modell for alle, men logges på brukeren.
    expect(rows.filter((r) => r.kind === 'flashcards' && r.deckId === mine.deckId).map((r) => [r.model, r.userId])).toEqual([['fake-claude', userId]]);
    const users = (await owner.get<AdminUsersResponse>('/api/admin/users')).body.users;
    expect(users.find((u) => u.id === userId)!.usage30d).toMatchObject({ calls: 2, pages: 1 });
  }, 120_000);
});

describe('gratiskontoene i bakgrunnen', () => {
  it('teller sidene i en PDF med flere sider i forbruksloggen (ikke antall filer)', async () => {
    const { client, userId } = await register('pdf-elev');
    const subject = (await client.sync()).subjects[0]!;
    const texDir = fs.mkdtempSync(path.join(os.tmpdir(), 'smartnotes-pdf-'));
    fs.writeFileSync(path.join(texDir, 'a.tex'), '\\documentclass{article}\\begin{document}Side en\\newpage Side to\\newpage Side tre\\end{document}');
    execFileSync('pdflatex', ['-interaction=nonstopmode', 'a.tex'], { cwd: texDir });
    const form = new FormData();
    form.append('subjectId', subject.id);
    form.append('files', new Blob([new Uint8Array(fs.readFileSync(path.join(texDir, 'a.pdf')))], { type: 'application/pdf' }), 'tre-sider.pdf');
    const up = await client.call<Note>('POST', '/api/notes', { form });
    expect(up.status).toBe(201);
    expect(up.body.pageCount).toBe(1);
    await waitUntil('PDF-en konverteres', async () => (await client.sync()).notes.find((n) => n.id === up.body.id && n.status === 'done'));
    const rows = ctx.repo.usageSince(0, userId).filter((r) => r.kind === 'convert' && r.noteId === up.body.id);
    expect(rows.map((r) => r.pages)).toEqual([3]);
  }, 120_000);

  it('lager ikke kort til en konto som er stengt mens kortstokken venter', async () => {
    const { client, userId } = await register('stengt-kort');
    const fx = await makeFixture(client, userId);
    const deck = ctx.repo.forUser(userId).createDeck({ subjectId: fx.subjectId, title: 'Venter', difficulty: 'easy', noteIds: [fx.noteId], count: null })!;
    ctx.repo.setDisabled(userId, true);
    try {
      ctx.generator.start(deck.id);
      await ctx.generator.idle();
      expect(ctx.repo.getDeck(deck.id)).toMatchObject({ status: 'failed', error: expect.stringMatching(/Kontoen ble stengt/) });
      expect(ctx.repo.listCards(deck.id)).toEqual([]);
    } finally {
      ctx.repo.setDisabled(userId, false);
    }
  }, 120_000);
});

describe('hver rute holder brukerne fra hverandre', () => {
  type Case =
    | { skip: string }
    | {
        /** Adressen og innholdet, bygd av offerets id-er. */
        req: (v: Fixture) => { url: string; json?: unknown; form?: () => FormData };
        /** Statusen angriperen får (standard 404). */
        deny?: number;
        /** Ruten gjelder hele serveren (eieren skal ha tilgang), så den prøves ikke av eieren mot en elev. */
        global?: boolean;
      };

  // Hver rute i ROUTE_ACCESS må stå her. En ny rute må altså tas stilling til.
  const CASES: Record<string, Case> = {
    'GET /api/health': { skip: 'offentlig, ingen data' },
    'POST /api/auth/login': { skip: 'offentlig, testet over' },
    'POST /api/auth/logout': { skip: 'offentlig, sletter bare egen økt' },
    'GET /api/auth/me': { skip: 'offentlig, viser bare egen konto' },
    'POST /api/auth/register': { skip: 'offentlig, testet over' },
    'POST /api/auth/reset': { skip: 'offentlig, testet over' },
    'GET /api/auth/presets': { skip: 'offentlig, ingen brukerdata' },
    'GET /api/legal': { skip: 'offentlig, ingen brukerdata' },
    'DELETE /api/auth/account': { skip: 'sletter bare egen konto (testet i personvern.test.ts)' },

    'GET /api/sync': { skip: 'egen test under' },
    'GET /api/presets': { skip: 'viser bare egne fag (egen test under)' },
    'POST /api/subjects': { skip: 'lager bare et eget fag' },
    'POST /api/subjects/from-preset': { skip: 'lager bare et eget fag (egen test under)' },
    'PATCH /api/subjects/:id': { req: (v) => ({ url: `/api/subjects/${v.subjectId}`, json: { name: 'Overtatt' } }) },
    'DELETE /api/subjects/:id': { req: (v) => ({ url: `/api/subjects/${v.subjectId}` }) },
    'GET /api/subjects/:id/pdf': { req: (v) => ({ url: `/api/subjects/${v.subjectId}/pdf` }) },
    'POST /api/subjects/:id/chapters': { req: (v) => ({ url: `/api/subjects/${v.subjectId}/chapters`, json: { number: '9', title: 'Inntrenger' } }) },
    'POST /api/subjects/:id/chapters/bulk': {
      req: (v) => ({ url: `/api/subjects/${v.subjectId}/chapters/bulk`, json: { chapters: [{ number: '9', title: 'Inntrenger' }] } }),
    },
    'POST /api/subjects/:id/chapters/parse': { req: (v) => ({ url: `/api/subjects/${v.subjectId}/chapters/parse`, json: { text: '1 Krefter' } }) },
    'POST /api/subjects/:id/chapters/extract': {
      req: (v) => ({ url: `/api/subjects/${v.subjectId}/chapters/extract`, form: () => pageForm({}) }),
    },
    'POST /api/subjects/:id/chapters/reorder': { req: (v) => ({ url: `/api/subjects/${v.subjectId}/chapters/reorder`, json: { ids: [v.chapterId] } }) },
    'PATCH /api/chapters/:id': { req: (v) => ({ url: `/api/chapters/${v.chapterId}`, json: { title: 'Overtatt' } }) },
    'DELETE /api/chapters/:id': { req: (v) => ({ url: `/api/chapters/${v.chapterId}` }) },
    'GET /api/chapters/:id/pdf': { req: (v) => ({ url: `/api/chapters/${v.chapterId}/pdf` }) },
    // Faget i skjemaet er offerets; opplastingen avvises, og en klient-id offeret har brukt, røper ikke notatet.
    'POST /api/notes': { req: (v) => ({ url: '/api/notes', form: () => pageForm({ subjectId: v.subjectId, chapterId: v.chapterId }) }), deny: 400 },
    'PATCH /api/notes/:id': { req: (v) => ({ url: `/api/notes/${v.noteId}`, json: { title: 'Overtatt' } }) },
    'DELETE /api/notes/:id': { req: (v) => ({ url: `/api/notes/${v.noteId}` }) },
    'POST /api/notes/:id/retry': { req: (v) => ({ url: `/api/notes/${v.noteId}/retry`, json: {} }) },
    'GET /api/notes/:id/pdf': { req: (v) => ({ url: `/api/notes/${v.noteId}/pdf` }) },
    'GET /api/notes/:id/latex': { req: (v) => ({ url: `/api/notes/${v.noteId}/latex` }) },
    'PUT /api/notes/:id/latex': { req: (v) => ({ url: `/api/notes/${v.noteId}/latex`, json: { body: 'Overtatt' } }) },
    'GET /api/notes/:id/tex': { req: (v) => ({ url: `/api/notes/${v.noteId}/tex` }) },
    'GET /api/notes/:id/pages': { req: (v) => ({ url: `/api/notes/${v.noteId}/pages` }) },
    'GET /api/notes/:id/pages/:index': { req: (v) => ({ url: `/api/notes/${v.noteId}/pages/0` }) },
    'POST /api/decks': { req: (v) => ({ url: '/api/decks', json: { subjectId: v.subjectId, noteIds: [v.noteId], difficulty: 'easy' } }) },
    'PATCH /api/decks/:id': { req: (v) => ({ url: `/api/decks/${v.deckId}`, json: { title: 'Overtatt' } }) },
    'DELETE /api/decks/:id': { req: (v) => ({ url: `/api/decks/${v.deckId}` }) },
    'POST /api/decks/:id/retry': { req: (v) => ({ url: `/api/decks/${v.deckId}/retry`, json: {} }) },
    'POST /api/decks/:id/cards': {
      req: (v) => ({ url: `/api/decks/${v.deckId}/cards`, json: { kind: 'concept', front: 'Inntrenger?', back: ['Ja'] } }),
    },
    'PATCH /api/cards/:id': { req: (v) => ({ url: `/api/cards/${v.cardId}`, json: { front: 'Overtatt' } }) },
    'DELETE /api/cards/:id': { req: (v) => ({ url: `/api/cards/${v.cardId}` }) },
    // Fremgang på andres kort hoppes over i stillhet (appen sender en kø som kan være gammel).
    'GET /api/quota': { skip: 'viser bare egen kvote (testet i quota.test.ts)' },
    'POST /api/flashcards/progress': {
      req: (v) => ({
        url: '/api/flashcards/progress',
        json: { cards: [{ id: v.cardId, level: 3, at: new Date(Date.now() + 60_000).toISOString() }], decks: [{ id: v.deckId, best: 999 }] },
      }),
      deny: 200,
    },

    'GET /api/ai/status': { req: () => ({ url: '/api/ai/status' }), global: true },
    'GET /api/usage': { req: () => ({ url: '/api/usage?days=30' }), global: true },
    'GET /api/backup/status': { req: () => ({ url: '/api/backup/status' }), global: true },
    'GET /api/backup': { req: () => ({ url: '/api/backup' }), global: true },
    'GET /api/compare/summary': { req: () => ({ url: '/api/compare/summary' }), global: true },
    'GET /api/notes/:id/compare': { req: (v) => ({ url: `/api/notes/${v.noteId}/compare` }) },
    'POST /api/notes/:id/compare': { req: (v) => ({ url: `/api/notes/${v.noteId}/compare`, json: {} }) },
    'GET /api/notes/:id/compare/pdf': { req: (v) => ({ url: `/api/notes/${v.noteId}/compare/pdf` }) },
    'PUT /api/notes/:id/compare/rating': {
      req: (v) => ({ url: `/api/notes/${v.noteId}/compare/rating`, json: { verdict: 'haiku_ok', comment: null } }),
    },
    'GET /api/admin/users': { req: () => ({ url: '/api/admin/users' }), global: true },
    'POST /api/admin/users/:id/reset-link': { req: (v) => ({ url: `/api/admin/users/${v.userId}/reset-link`, json: {} }), global: true },
    'POST /api/admin/users/:id/disable': { req: (v) => ({ url: `/api/admin/users/${v.userId}/disable`, json: {} }), global: true },
    'POST /api/admin/users/:id/enable': { req: (v) => ({ url: `/api/admin/users/${v.userId}/enable`, json: {} }), global: true },
    'PATCH /api/admin/me': { req: () => ({ url: '/api/admin/me', json: { username: 'overtatt' } }), global: true },
    'GET /api/admin/invites': { req: () => ({ url: '/api/admin/invites' }), global: true },
    'POST /api/admin/invites': { req: () => ({ url: '/api/admin/invites', json: {} }), global: true },
    'DELETE /api/admin/invites/:id': { req: () => ({ url: `/api/admin/invites/${randomUUID()}` }), global: true },

    // Hjemmemaskinen logger inn med WORKER_TOKEN; en innlogget bruker kommer ikke inn med informasjonskapselen sin.
    'POST /api/worker/claim': { req: () => ({ url: '/api/worker/claim', json: {} }), deny: 401, global: true },
    'POST /api/worker/tasks/:id/heartbeat': { req: () => ({ url: `/api/worker/tasks/${randomUUID()}/heartbeat`, json: {} }), deny: 401, global: true },
    'POST /api/worker/tasks/:id/result': { req: () => ({ url: `/api/worker/tasks/${randomUUID()}/result`, json: {} }), deny: 401, global: true },
  };

  let a: { client: Client; fx: Fixture };
  let b: { client: Client; fx: Fixture };
  let own: { client: Client; fx: Fixture };

  beforeAll(async () => {
    const ra = await register('elev-a');
    const rb = await register('elev-b');
    a = { client: ra.client, fx: await makeFixture(ra.client, ra.userId) };
    b = { client: rb.client, fx: await makeFixture(rb.client, rb.userId) };
    const subject = (await owner.sync()).subjects.find((s) => s.profile === 'physics')!;
    own = { client: owner, fx: { ...(await makeFixture(owner, OWNER_ID)), subjectId: subject.id } };
    // Eierens notat har en sammenligning, så rutene for den har noe å vise.
    expect((await owner.post(`/api/notes/${own.fx.noteId}/compare`)).status).toBe(202);
  }, 240_000);

  it('har et tilfelle for hver rute, og hver rute i ROUTE_ACCESS finnes', () => {
    expect(Object.keys(CASES).sort()).toEqual(Object.keys(ROUTE_ACCESS).sort());
    for (const key of Object.keys(ROUTE_ACCESS)) {
      const [method, url] = key.split(' ') as [string, string];
      expect(ctx.app.hasRoute({ method: method as 'GET', url }), key).toBe(true);
    }
  });

  const directions: [string, () => { attacker: Client; victim: { client: Client; fx: Fixture } }][] = [
    ['elev B mot elev A', () => ({ attacker: b.client, victim: a })],
    ['elev A mot elev B', () => ({ attacker: a.client, victim: b })],
    ['elev A mot eieren', () => ({ attacker: a.client, victim: own })],
    ['eieren mot elev A', () => ({ attacker: owner, victim: a })],
  ];

  for (const [name, pick] of directions) {
    it(`${name}: får ${'404'} på alle rutene med den andres id-er, og ingenting endres`, async () => {
      const { attacker, victim } = pick();
      const attackerIsOwner = attacker === owner;
      const before = await snapshot(victim.client, victim.fx.userId);
      const failures: string[] = [];
      for (const [key, c] of Object.entries(CASES)) {
        if ('skip' in c) continue;
        if (attackerIsOwner && c.global) continue;
        const [method] = key.split(' ') as [string];
        const r = c.req(victim.fx);
        const res = await attacker.call(method, r.url, { json: r.form ? undefined : (r.json ?? (method === 'GET' || method === 'DELETE' ? undefined : {})), form: r.form?.() });
        // Eierens egne ruter gir 404 til elevene, uansett id.
        const expected = ROUTE_ACCESS[key] === 'owner' && !attackerIsOwner ? 404 : (c.deny ?? 404);
        if (res.status !== expected) failures.push(`${key}: ${res.status} (ventet ${expected}) ${res.raw.toString('utf8').slice(0, 200)}`);
        const text = res.raw.toString('utf8');
        for (const id of [victim.fx.subjectId, victim.fx.chapterId, victim.fx.noteId, victim.fx.deckId, victim.fx.cardId]) {
          if (text.includes(id) && expected !== 200) failures.push(`${key}: svaret inneholder ${id}`);
        }
      }
      expect(failures).toEqual([]);
      // Vent til det angriperen eventuelt satte i gang, er ferdig, før offerets data sammenlignes.
      await ctx.worker.idle?.();
      expect(await snapshot(victim.client, victim.fx.userId)).toEqual(before);
    }, 120_000);
  }

  it('offeret selv når de samme adressene (id-ene i testen er gyldige)', async () => {
    for (const victim of [a, b, own]) {
      for (const [key, c] of Object.entries(CASES)) {
        if ('skip' in c || !key.startsWith('GET ') || c.global) continue;
        if (ROUTE_ACCESS[key] === 'owner' && victim !== own) continue;
        const res = await victim.client.get(c.req(victim.fx).url);
        expect(res.status, `${key} ${res.raw.toString('utf8').slice(0, 200)}`).toBe(200);
      }
    }
  }, 120_000);

  it('synken viser bare egne rader, også fra cursor 0 og med en annen brukers klient-id', async () => {
    for (const me of [a, b, own]) {
      const sync = await me.client.sync(0);
      expect(sync.userId).toBe(me.fx.userId);
      const others = [a, b, own].filter((x) => x !== me).map((x) => x.fx);
      const ids = JSON.stringify(sync);
      for (const o of others) for (const id of [o.subjectId, o.chapterId, o.noteId, o.deckId, o.cardId]) expect(ids).not.toContain(id);
    }
    // Samme klient-id som elev A brukte: opplastingen avvises uten å vise A sitt notat.
    const subject = (await b.client.sync()).subjects[0]!;
    const res = await b.client.call('POST', '/api/notes', { form: pageForm({ subjectId: subject.id, clientId: a.fx.clientId }) });
    expect(res.status).toBe(409);
    expect(res.raw.toString('utf8')).not.toContain(a.fx.noteId);
  });

  it('«Legg til fag» ser bare egne fag', async () => {
    const res = await b.client.get<{ presets: { id: string; added: boolean }[] }>('/api/presets');
    expect(res.status).toBe(200);
    expect(res.body.presets.find((p) => p.id === 'fysikk-1-lk20')!.added).toBe(true);
    expect(res.body.presets.find((p) => p.id === 'kjemi-1-lk20')!.added).toBe(false);
    const add = await b.client.post('/api/subjects/from-preset', { presetId: 'kjemi-1-lk20' });
    expect(add.status).toBe(201);
    expect((await a.client.sync()).subjects.map((s) => s.name)).toEqual(['Fysikk 1']);
  });
});

describe('sikkerhetskopien', () => {
  it('har ingen innlogginger, enheter, lenker eller ubrukte koder, heller ikke i ledige sider i databasefila', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'smartnotes-kopi-'));
    const repo = new Repo(path.join(dir, 'db.sqlite'));
    const secrets = ['okt-hemmelig', 'enhet-hemmelig', 'lenke-hemmelig', 'KODEHEMMELIG'].map(hashToken);
    repo.createSession(secrets[0]!, OWNER_ID, new Date(Date.now() + 86_400_000), 'Safari');
    repo.addDevice(secrets[1]!, OWNER_ID);
    repo.createPasswordReset(secrets[2]!, OWNER_ID, new Date(Date.now() + 86_400_000));
    repo.createInvite({ id: randomUUID(), codeHash: secrets[3]!, codeHint: 'MLIG', createdBy: OWNER_ID, expiresAt: new Date(Date.now() + 86_400_000) });
    const copy = path.join(dir, 'kopi.sqlite');
    await repo.backupTo(copy);
    repo.close();
    const bytes = fs.readFileSync(copy).toString('latin1');
    for (const secret of secrets) expect(bytes).not.toContain(secret);
    expect(fs.existsSync(`${copy}-wal`)).toBe(false);
  });
});

describe('migrering 7 (kontoer)', () => {
  it('gir eieren alt som fantes, holder enhetene innlogget og trenger ingen ny synk', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'smartnotes-migrering-'));
    const storage = new Storage(dir);
    fs.mkdirSync(path.dirname(storage.dbFile), { recursive: true });
    const old = new Repo(storage.dbFile, { migrateTo: 6 });
    const t = '2026-10-12T10:00:00.000Z';
    const future = new Date(Date.now() + 30 * 86_400_000).toISOString();
    old.db.exec(`
      UPDATE meta SET value = '7' WHERE key = 'rev';
      INSERT INTO subjects (id, name, profile, textbook, position, rev, created_at, updated_at, aims)
        VALUES ('s1', 'Fysikk 1', 'physics', NULL, 0, 1, '${t}', '${t}', '[]');
      INSERT INTO chapters (id, subject_id, number, title, position, rev, created_at, updated_at, sections)
        VALUES ('c1', 's1', '1', 'Fysikk og måling', 0, 2, '${t}', '${t}', '[]');
      INSERT INTO notes (id, subject_id, chapter_id, client_id, title, status, pdf_rev, rev, created_at, updated_at, search_text)
        VALUES ('n1', 's1', 'c1', 'klient-1', 'Newtons lover', 'done', 1, 3, '${t}', '${t}', 'Newtons lover');
      INSERT INTO note_files (id, note_id, position, original_name, mime, filename, size)
        VALUES ('f1', 'n1', 0, 'side.jpg', 'image/jpeg', '001.jpg', 1000);
      INSERT INTO decks (id, subject_id, title, difficulty, note_ids, status, best, rev, created_at, updated_at)
        VALUES ('d1', 's1', 'Krefter', 'medium', '["n1"]', 'done', 4, 4, '${t}', '${t}');
      INSERT INTO cards (id, deck_id, note_id, kind, front, back, level, rev, created_at, updated_at)
        VALUES ('k1', 'd1', 'n1', 'concept', 'Hva er kraft?', '["Masse ganger akselerasjon"]', 2, 5, '${t}', '${t}');
      INSERT INTO notes (id, subject_id, chapter_id, title, status, rev, deleted, created_at, updated_at)
        VALUES ('n2', 's1', NULL, 'Slettet', 'done', 7, 1, '${t}', '${t}');
      INSERT INTO sessions (token_hash, created_at, expires_at, user_agent) VALUES ('${hashToken('gammel-okt')}', '${t}', '${future}', 'Safari');
      INSERT INTO sessions (token_hash, created_at, expires_at, user_agent) VALUES ('${hashToken('utlopt-okt')}', '${t}', '${t}', 'Safari');
      INSERT INTO note_comparisons (note_id, model, base_model, base_pdf_rev, status, created_at, verdict, comment, rated_at, prompt_version)
        VALUES ('n1', 'claude-haiku-5-5', 'claude-sonnet-5-5', 1, 'done', '${t}', 'haiku_ok', 'Fin', '${t}', 2);
      INSERT INTO comparison_ratings (note_id, prompt_version, verdict, comment, rated_at) VALUES ('n1', 2, 'haiku_ok', 'Fin', '${t}');
      INSERT INTO usage_log (at, kind, provider, model, input_tokens, output_tokens, ok, note_id) VALUES (${Date.now()}, 'convert', 'anthropic', 'claude-sonnet-5-5', 100, 50, 1, 'n1');
    `);
    const cursorBefore = 7;
    old.close();

    const repo = new Repo(storage.dbFile);
    expect(repo.db.pragma('user_version', { simple: true })).toBeGreaterThanOrEqual(7);
    for (const table of ['subjects', 'chapters', 'notes', 'decks', 'cards', 'note_comparisons', 'comparison_ratings', 'usage_log']) {
      expect(repo.db.prepare(`SELECT DISTINCT user_id FROM ${table}`).all(), table).toEqual([{ user_id: OWNER_ID }]);
    }
    expect(repo.getUser(OWNER_ID)).toMatchObject({ username: 'eier', plan: 'owner', password_hash: null, disabled: 0 });
    expect(repo.sessionUser(hashToken('gammel-okt'))?.id).toBe(OWNER_ID);
    expect(repo.sessionUser(hashToken('utlopt-okt'))).toBeNull();
    // Ingen rader har fått ny rev: en enhet med cursoren fra før får ingenting nytt.
    expect(repo.currentRev()).toBe(7);
    const fresh = repo.sync(OWNER_ID, 7);
    expect([fresh.subjects, fresh.chapters, fresh.notes, fresh.decks, fresh.cards].flat()).toEqual([]);
    const all = repo.sync(OWNER_ID, 0);
    expect(all.notes.map((n) => n.id)).toEqual(['n1']);
    // Det slettede notatet kommer som gravstein til en enhet som har en eldre cursor.
    expect(repo.sync(OWNER_ID, 6).notes.map((n) => [n.id, n.deleted])).toEqual([['n2', true]]);
    expect(all.cards[0]).toMatchObject({ id: 'k1', level: 2 });
    expect(repo.sync(2, 0).subjects).toEqual([]);
    expect(repo.comparisonRatingsByVersion(OWNER_ID)).toEqual([{ version: 2, rated: 1, haikuOk: 1 }]);
    expect(repo.usageSince(0, OWNER_ID)).toHaveLength(1);
    expect(repo.forUser(OWNER_ID).noteFiles('n1')).toHaveLength(1);
    expect(repo.forUser(2).noteFiles('n1')).toEqual([]);
    // Eieren av en rad kan ikke endres.
    expect(() => repo.db.prepare(`UPDATE notes SET user_id = 2 WHERE id = 'n1'`).run()).toThrow(/user_id kan ikke endres/);
    // En eldre versjon av serveren (etter en tilbakerulling) ser fortsatt eierens økter fra før kontoene.
    expect(repo.db.prepare(`SELECT COUNT(*) AS n FROM sessions`).get()).toEqual({ n: 2 });
    repo.close();

    // Og gjennom API-et: enheten med den gamle informasjonskapselen er fortsatt innlogget, og synken er tom.
    const config = loadConfig({ ...process.env, NODE_ENV: 'test', DATA_DIR: dir, APP_PASSWORD: PASSWORD, WEB_DIST: '', SEED_TEXTBOOKS: 'none' });
    const app = await buildApp({ ...config, webDist: null }, { ai: new FakeClaude(5), logger: false });
    try {
      const res = await app.app.inject({ method: 'GET', url: `/api/sync?since=${cursorBefore}`, cookies: { sn_session: 'gammel-okt' } });
      expect(res.statusCode).toBe(200);
      const body = res.json<SyncResponse>();
      expect(body.userId).toBe(OWNER_ID);
      expect(body.cursor).toBe(cursorBefore);
      expect([body.subjects, body.chapters, body.notes, body.decks, body.cards].flat()).toEqual([]);
      const me = await app.app.inject({ method: 'GET', url: '/api/auth/me', cookies: { sn_session: 'gammel-okt' } });
      expect(me.json<MeResponse>().user).toEqual({ id: OWNER_ID, username: 'eier', plan: 'owner' });
    } finally {
      await app.app.close();
    }
  });
});
