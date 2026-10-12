import { execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import Database from 'better-sqlite3';
import sharp from 'sharp';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { BackupStatusResponse, Note, Subject, SyncResponse } from '@smartnotes/shared';
import { buildApp, type AppContext } from '../src/app.js';
import { backupName, TAR_END, tarEntry } from '../src/backup.js';
import { loadConfig } from '../src/config.js';
import { writeFileAtomic } from '../src/storage.js';
import { FakeClaude } from '../src/pipeline/claude.js';

/** Større enn det som får plass i bufferne til socketen, så en avbrutt nedlasting rekker å bli avbrutt. */
const BIG = 24 * 1024 * 1024;

const tmp = (prefix: string) => fs.mkdtempSync(path.join(os.tmpdir(), prefix));

/** Pakker ut med GNU tar, så formatet sjekkes av et annet program enn det som skrev det. */
function extract(archive: string, gzip: boolean): string {
  const out = tmp('smartnotes-utpakket-');
  execFileSync('tar', [gzip ? '-xzf' : '-xf', archive, '-C', out]);
  return out;
}

/** Alle filer under `dir`, relativt og sortert. */
function listFiles(dir: string): string[] {
  return (fs.readdirSync(dir, { recursive: true, withFileTypes: true }) as fs.Dirent[])
    .filter((e) => e.isFile())
    .map((e) => path.relative(dir, path.join(e.parentPath, e.name)))
    .sort();
}

describe('tar-formatet', () => {
  it('pakkes ut riktig av GNU tar, også lange navn, æøå og størrelser rundt blokkgrensen', () => {
    const files: [string, Buffer][] = [
      ['kopi/tom.txt', Buffer.alloc(0)],
      ['kopi/en.txt', Buffer.from('a')],
      ['kopi/blokk.bin', randomBytes(512)],
      ['kopi/blokk-pluss-en.bin', randomBytes(513)],
      ['kopi/blåbær og æøå.txt', Buffer.from('Ærlig talt, øl på åsen.')],
      [`kopi/${'lang-'.repeat(30)}.txt`, Buffer.from('langt navn')],
    ];
    // Navn der pax-posten krysser fra to til tre sifre i lengde (99 → 101 byte).
    for (let n = 85; n <= 100; n++) files.push([`kopi/å${'x'.repeat(n - 7)}`, Buffer.from(String(n))]);
    const archive = path.join(tmp('smartnotes-tar-'), 'test.tar');
    fs.writeFileSync(archive, Buffer.concat([...files.flatMap(([name, data]) => tarEntry(name, data, new Date(1_700_000_000_000))), TAR_END]));
    expect(fs.statSync(archive).size % 512).toBe(0);
    const out = extract(archive, false);
    expect(listFiles(out)).toEqual(files.map(([name]) => name).sort());
    for (const [name, data] of files) expect(fs.readFileSync(path.join(out, name)).equals(data)).toBe(true);
    expect(fs.statSync(path.join(out, 'kopi/en.txt')).mtimeMs).toBe(1_700_000_000_000);
  });

  it('navngir kopien etter datoen i Norge', () => {
    // 23.30 UTC 31. desember er 00.30 1. januar i Norge.
    expect(backupName(new Date('2026-12-31T23:30:00Z'))).toBe('smartnotes-sikkerhetskopi-2027-01-01');
  });
});

describe('writeFileAtomic', () => {
  it('bytter fila i ett jafs og lar ingen midlertidig fil ligge igjen', async () => {
    const dir = tmp('smartnotes-atomisk-');
    const file = path.join(dir, 'note.tex');
    fs.writeFileSync(file, 'gammel');
    fs.linkSync(file, path.join(dir, 'lenke.tex'));
    await writeFileAtomic(file, 'ny');
    expect(fs.readFileSync(file, 'utf8')).toBe('ny');
    // En lenke til den gamle fila (som i sikkerhetskopien) beholder det gamle innholdet.
    expect(fs.readFileSync(path.join(dir, 'lenke.tex'), 'utf8')).toBe('gammel');
    await expect(writeFileAtomic(path.join(dir, 'mangler', 'x.tex'), 'y')).rejects.toThrow();
    expect(fs.readdirSync(dir).sort()).toEqual(['lenke.tex', 'note.tex']);
  });
});

describe('sikkerhetskopi', () => {
  let ctx: AppContext;
  let dataDir = '';
  let base = '';
  let cookie = '';
  let note: Note;

  const call = async <T>(method: string, url: string, opts: { json?: unknown; form?: FormData; auth?: boolean } = {}) => {
    const headers: Record<string, string> = { 'x-smartnotes': '1', ...(cookie && opts.auth !== false ? { cookie } : {}) };
    let body: string | FormData | undefined;
    if (opts.json !== undefined) {
      headers['content-type'] = 'application/json';
      body = JSON.stringify(opts.json);
    } else body = opts.form;
    const res = await fetch(base + url, { method, headers, body });
    const buf = Buffer.from(await res.arrayBuffer());
    const json = res.headers.get('content-type')?.includes('json') && buf.length ? (JSON.parse(buf.toString()) as T) : (null as T);
    return { status: res.status, body: json, buf, headers: res.headers };
  };

  const backupDirs = () => fs.readdirSync(path.join(dataDir, 'tmp')).filter((n) => n.startsWith('backup-'));

  beforeAll(async () => {
    dataDir = tmp('smartnotes-backup-');
    const config = loadConfig({ ...process.env, NODE_ENV: 'test', DATA_DIR: dataDir, APP_PASSWORD: 'hemmelig', WEB_DIST: '', SEED_TEXTBOOKS: 'none' });
    ctx = await buildApp({ ...config, webDist: null }, { ai: new FakeClaude(5), logger: false });
    ctx.worker.start();
    await ctx.app.listen({ port: 0, host: '127.0.0.1' });
    const addr = ctx.app.server.address();
    base = `http://127.0.0.1:${typeof addr === 'object' && addr ? addr.port : 0}`;
    const login = await call('POST', '/api/auth/login', { json: { password: 'hemmelig' } });
    cookie = (login.headers.get('set-cookie') ?? '').split(';')[0]!;

    const subject = (await call<Subject>('POST', '/api/subjects', { json: { name: 'Kjemi 1', profile: 'chemistry' } })).body;
    const png = await sharp({ create: { width: 1200, height: 1600, channels: 3, background: '#fff' } }).png().toBuffer();
    const form = new FormData();
    form.append('subjectId', subject.id);
    form.append('clientId', 'klient-backup');
    form.append('files', new Blob([new Uint8Array(png)], { type: 'image/png' }), 's.png');
    note = (await call<Note>('POST', '/api/notes', { form })).body;
    for (const start = Date.now(); Date.now() - start < 60_000; await new Promise((r) => setTimeout(r, 100))) {
      const n = (await call<SyncResponse>('GET', '/api/sync?since=0')).body.notes.find((x) => x.id === note.id);
      if (n?.status === 'done' || n?.status === 'failed') break;
    }
    // En stor fil som ikke lar seg komprimere, så arkivet er større enn én bit av strømmen.
    fs.writeFileSync(path.join(dataDir, 'notes', note.id, 'source', 'stor.bin'), randomBytes(BIG));
    // Samle-PDF-er er hurtigbuffer og skal ikke være med.
    fs.writeFileSync(path.join(dataDir, 'bundles', 'kapittel.pdf'), 'cache');
  }, 90_000);

  afterAll(async () => {
    await ctx?.worker.stop();
    await ctx?.app.close();
  });

  it('krever innlogging, også med prosentkodet adresse', async () => {
    expect((await call('GET', '/api/backup', { auth: false })).status).toBe(401);
    expect((await call('GET', '/api/backup/status', { auth: false })).status).toBe(401);
    expect((await call('GET', '/%61pi/backup', { auth: false })).status).toBe(401);
    expect(backupDirs()).toEqual([]);
  });

  it('har ingen HEAD-rute som lager en kopi uten å sende den', async () => {
    expect((await call('HEAD', '/api/backup')).status).toBe(404);
    expect(backupDirs()).toEqual([]);
  });

  it('viser størrelsen og at ingen kopi er tatt ennå', async () => {
    const status = (await call<BackupStatusResponse>('GET', '/api/backup/status')).body;
    expect(status).toMatchObject({ lastBackupAt: null, notes: 1 });
    expect(status.approxBytes).toBeGreaterThan(BIG);
  });

  it('lastes ned som .tar.gz med databasen og alle filene til notatene', async () => {
    const res = await call('GET', '/api/backup');
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('application/gzip');
    expect(res.headers.get('cache-control')).toBe('no-store');
    const name = backupName(new Date());
    expect(res.headers.get('content-disposition')).toBe(`attachment; filename="${name}.tar.gz"`);

    const archive = path.join(tmp('smartnotes-arkiv-'), `${name}.tar.gz`);
    fs.writeFileSync(archive, res.buf);
    const out = extract(archive, true);
    expect(fs.readdirSync(out)).toEqual([name]);
    const root = path.join(out, name);
    const files = listFiles(root);
    expect(files.filter((f) => !f.startsWith('notes/'))).toEqual(['LES-MEG.txt', 'sikkerhetskopi.json', 'smartnotes.db']);
    // Hver fil under notes/ på serveren er med, uendret.
    const serverFiles = listFiles(path.join(dataDir, 'notes'));
    expect(serverFiles).toContain(`${note.id}/note.pdf`);
    expect(files.filter((f) => f.startsWith('notes/'))).toEqual(serverFiles.map((f) => `notes/${f}`));
    for (const f of serverFiles) expect(fs.readFileSync(path.join(root, 'notes', f)).equals(fs.readFileSync(path.join(dataDir, 'notes', f)))).toBe(true);

    // Databasen er én hel fil (ingen -wal), uten innlogginger, og har fagene og notatet.
    const copy = new Database(path.join(root, 'smartnotes.db'), { readonly: true });
    try {
      expect(copy.pragma('integrity_check', { simple: true })).toBe('ok');
      expect(copy.pragma('journal_mode', { simple: true })).toBe('delete');
      expect(copy.prepare('SELECT COUNT(*) AS n FROM sessions').get()).toEqual({ n: 0 });
      // «Fysikk» er det tomme faget en ny database får.
      expect(copy.prepare('SELECT name FROM subjects WHERE deleted = 0 ORDER BY name').all()).toEqual([{ name: 'Fysikk' }, { name: 'Kjemi 1' }]);
      expect(copy.prepare('SELECT id FROM notes').all()).toEqual([{ id: note.id }]);
    } finally {
      copy.close();
    }

    const manifest = JSON.parse(fs.readFileSync(path.join(root, 'sikkerhetskopi.json'), 'utf8'));
    expect(manifest).toMatchObject({ format: 'smartnotes-sikkerhetskopi', version: 1, subjects: 2, notes: 1, decks: 0, cards: 0 });
    expect(manifest.schemaVersion).toBeGreaterThan(0);
    const readme = fs.readFileSync(path.join(root, 'LES-MEG.txt'), 'utf8');
    expect(readme).toMatch(/^Sikkerhetskopi av SmartNotes\n.*\n2 fag, 1 notat og 0 kortstokker med 0 kort\./);
    // Gjenopprettingen må fjerne en gammel WAL-fil, ellers skriver SQLite gamle endringer over kopien.
    expect(readme).toContain('smartnotes.db-wal');

    // Den midlertidige kopien er ryddet bort, og Innstillinger viser når kopien ble tatt.
    expect(backupDirs()).toEqual([]);
    const status = (await call<BackupStatusResponse>('GET', '/api/backup/status')).body;
    expect(Date.now() - Date.parse(status.lastBackupAt!)).toBeLessThan(60_000);
    // Innloggingen på serveren virker fortsatt.
    expect((await call('GET', '/api/backup/status')).status).toBe(200);
  });

  it('rydder opp og regnes ikke som tatt når nedlastingen avbrytes', async () => {
    ctx.repo.setMeta('last_backup_at', '0');
    await new Promise<void>((resolve, reject) => {
      const req = http.get(`${base}/api/backup`, { headers: { cookie } }, (res) => {
        expect(res.statusCode).toBe(200);
        res.once('data', () => {
          req.destroy();
          resolve();
        });
      });
      req.on('error', (err) => (req.destroyed ? undefined : reject(err)));
    });
    for (const start = Date.now(); backupDirs().length > 0 && Date.now() - start < 5000; ) await new Promise((r) => setTimeout(r, 50));
    expect(backupDirs()).toEqual([]);
    expect((await call<BackupStatusResponse>('GET', '/api/backup/status')).body.lastBackupAt).toBeNull();
  });

  it('har med LaTeX-koden slik den var da kopien ble startet, også om notatet redigeres underveis', async () => {
    const texFile = path.join(dataDir, 'notes', note.id, 'note.tex');
    const original = fs.readFileSync(texFile, 'utf8');
    // En stor fil som pakkes før notatet (mappene sorteres), så notatet leses etter redigeringen.
    const filler = path.join(dataDir, 'notes', '00000000-0000-0000-0000-000000000000');
    fs.mkdirSync(filler);
    fs.writeFileSync(path.join(filler, 'fyll.bin'), randomBytes(BIG));
    try {
      const archive = await new Promise<Buffer>((resolve, reject) => {
        const chunks: Buffer[] = [];
        const req = http.get(`${base}/api/backup`, { headers: { cookie } }, (res) => {
          res.once('data', (first: Buffer) => {
            chunks.push(first);
            res.pause();
            void call<{ ok: boolean }>('PUT', `/api/notes/${note.id}/latex`, { json: { body: `${original}\n\nEndret under nedlastingen.\n` } })
              .then((put) => {
                expect(put.body.ok).toBe(true);
                expect(fs.readFileSync(texFile, 'utf8')).toContain('Endret under nedlastingen.');
                res.on('data', (c: Buffer) => chunks.push(c));
                res.on('end', () => resolve(Buffer.concat(chunks)));
                res.resume();
              })
              .catch(reject);
          });
        });
        req.on('error', reject);
      });
      const file = path.join(tmp('smartnotes-arkiv-'), 'kopi.tar.gz');
      fs.writeFileSync(file, archive);
      const root = path.join(extract(file, true), backupName(new Date()));
      expect(fs.readFileSync(path.join(root, 'notes', note.id, 'note.tex'), 'utf8')).toBe(original);
      expect(listFiles(root).filter((f) => f.endsWith('.tmp'))).toEqual([]);
    } finally {
      fs.rmSync(filler, { recursive: true, force: true });
    }
  }, 60_000);

  it('har med et notat som slettes mens nedlastingen pågår, slik det var da kopien ble startet', async () => {
    const before = listFiles(path.join(dataDir, 'notes', note.id));
    const archive = await new Promise<Buffer>((resolve, reject) => {
      const chunks: Buffer[] = [];
      const req = http.get(`${base}/api/backup`, { headers: { cookie } }, (res) => {
        res.once('data', (first: Buffer) => {
          chunks.push(first);
          res.pause();
          // Notatet slettes (filene fjernes fra disken) etter at nedlastingen har startet.
          void call('DELETE', `/api/notes/${note.id}`)
            .then((del) => {
              expect(del.status).toBe(200);
              expect(fs.existsSync(path.join(dataDir, 'notes', note.id))).toBe(false);
              res.on('data', (c: Buffer) => chunks.push(c));
              res.on('end', () => resolve(Buffer.concat(chunks)));
              res.resume();
            })
            .catch(reject);
        });
      });
      req.on('error', reject);
    });
    const file = path.join(tmp('smartnotes-arkiv-'), 'kopi.tar.gz');
    fs.writeFileSync(file, archive);
    const root = path.join(extract(file, true), backupName(new Date()));
    expect(listFiles(path.join(root, 'notes', note.id))).toEqual(before);
    expect(fs.existsSync(path.join(root, 'mangler.txt'))).toBe(false);
    expect(backupDirs()).toEqual([]);
  });
});
