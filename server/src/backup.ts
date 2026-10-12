import fsp from 'node:fs/promises';
import path from 'node:path';
import { Readable, pipeline } from 'node:stream';
import { createGzip } from 'node:zlib';
import type { Repo } from './db.js';
import type { Storage } from './storage.js';

/**
 * Sikkerhetskopi som eleven laster ned fra Innstillinger: én .tar.gz med en kopi av databasen og alle filene til
 * notatene. Railway tar bare backup av volumet på dyrere abonnement, så dette er kopien eleven selv eier.
 *
 * Arkivet strømmes rett til nettleseren, én fil om gangen, så minnebruken holder seg på størrelse med den største
 * fila (ikke hele arkivet). Samle-PDF-ene (bundles/) er hurtigbuffer og tas ikke med, heller ikke tmp/.
 */

/** Når en sikkerhetskopi sist ble lastet ned helt (millisekunder), i meta-tabellen. */
export const LAST_BACKUP_KEY = 'last_backup_at';

const osloDay = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Oslo', year: 'numeric', month: '2-digit', day: '2-digit' });
const osloTime = new Intl.DateTimeFormat('nb-NO', { timeZone: 'Europe/Oslo', dateStyle: 'long', timeStyle: 'short' });

/** Navnet på arkivet og mappen i det, f.eks. `smartnotes-sikkerhetskopi-2026-10-12`. */
export function backupName(at: Date): string {
  return `smartnotes-sikkerhetskopi-${osloDay.format(at)}`;
}

// ---------- tar (ustar + pax) ----------

const BLOCK = 512;
/** Største størrelse et ustar-felt på 11 oktale sifre kan holde (8 GiB). */
const MAX_OCTAL_SIZE = 8 ** 11 - 1;

function writeString(buf: Buffer, text: string, offset: number, length: number): void {
  buf.write(text, offset, length, 'utf8');
}

function writeOctal(buf: Buffer, n: number, offset: number, length: number): void {
  writeString(buf, `${n.toString(8).padStart(length - 1, '0')}\0`, offset, length);
}

/** Én 512-byte header. `name` må være ASCII og høyst 100 byte; lengre navn går i en pax-header foran. */
function header(name: string, size: number, mtime: Date, type: '0' | 'x'): Buffer {
  const buf = Buffer.alloc(BLOCK);
  writeString(buf, name, 0, 100);
  writeOctal(buf, 0o644, 100, 8);
  writeOctal(buf, 0, 108, 8);
  writeOctal(buf, 0, 116, 8);
  writeOctal(buf, Math.min(size, MAX_OCTAL_SIZE), 124, 12);
  writeOctal(buf, Math.max(0, Math.floor(mtime.getTime() / 1000)), 136, 12);
  buf.fill(' ', 148, 156);
  writeString(buf, type, 156, 1);
  writeString(buf, 'ustar\0', 257, 6);
  writeString(buf, '00', 263, 2);
  let sum = 0;
  for (const byte of buf) sum += byte;
  writeString(buf, `${sum.toString(8).padStart(6, '0')}\0 `, 148, 8);
  return buf;
}

/** Én pax-post: «<lengde> <nøkkel>=<verdi>\n», der lengden teller hele posten, også sifrene sine. */
function paxRecord(key: string, value: string): string {
  const body = ` ${key}=${value}\n`;
  const bodyBytes = Buffer.byteLength(body);
  let length = bodyBytes + String(bodyBytes).length;
  // Lengden kan få et siffer til når sifrene selv telles med (f.eks. 98 + 2 = 100).
  while (bodyBytes + String(length).length !== length) length = bodyBytes + String(length).length;
  return `${length}${body}`;
}

function padding(size: number): Buffer {
  const rest = size % BLOCK;
  return Buffer.alloc(rest === 0 ? 0 : BLOCK - rest);
}

/** Header (med pax foran ved behov), innhold og utfylling til hel blokk for én fil. */
export function tarEntry(name: string, data: Buffer, mtime: Date): Buffer[] {
  const ascii = /^[\x20-\x7e]*$/.test(name);
  const out: Buffer[] = [];
  const pax: string[] = [];
  if (!ascii || name.length > 100) pax.push(paxRecord('path', name));
  if (data.length > MAX_OCTAL_SIZE) pax.push(paxRecord('size', String(data.length)));
  if (pax.length > 0) {
    const records = Buffer.from(pax.join(''), 'utf8');
    out.push(header('PaxHeader', records.length, mtime, 'x'), records, padding(records.length));
  }
  // Uten pax-støtte får leseren i det minste et lesbart navn (ikke-ASCII byttes ut, og navnet kortes ned).
  const fallback = ascii && name.length <= 100 ? name : name.replace(/[^\x20-\x7e]/g, '_').slice(-100);
  out.push(header(fallback, data.length, mtime, '0'), data, padding(data.length));
  return out;
}

/** To tomme blokker avslutter et tar-arkiv. */
export const TAR_END = Buffer.alloc(2 * BLOCK);

// ---------- Innholdet ----------

/**
 * Alle vanlige filer under `root`, sortert, med sti relativ til `root` (skråstrek). Lenker følges ikke, og
 * halvskrevne `*.tmp` (fra `writeFileAtomic` og PDF-kopieringen) tas ikke med.
 */
async function* walk(root: string, rel = ''): AsyncGenerator<string> {
  const entries = await fsp.readdir(path.join(root, rel), { withFileTypes: true }).catch((err: NodeJS.ErrnoException) => {
    if (err.code === 'ENOENT') return [];
    throw err;
  });
  entries.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  for (const e of entries) {
    const child = rel ? `${rel}/${e.name}` : e.name;
    if (e.isDirectory()) yield* walk(root, child);
    else if (e.isFile() && !e.name.endsWith('.tmp')) yield child;
  }
}

/** Omtrent hvor stor sikkerhetskopien blir (byte før komprimering): databasen og filene til notatene. */
export async function backupBytes(storage: Storage): Promise<number> {
  let total = 0;
  for (const file of [storage.dbFile, `${storage.dbFile}-wal`]) total += (await fsp.stat(file).catch(() => null))?.size ?? 0;
  for await (const rel of walk(storage.notesRoot)) total += (await fsp.stat(path.join(storage.notesRoot, rel)).catch(() => null))?.size ?? 0;
  return total;
}

/**
 * Lenker (hard link) alle filene under notes/ inn i `into`, så arkivet får filene slik de var da databasen ble
 * kopiert: et notat som slettes, redigeres eller konverteres på nytt mens nedlastingen pågår, endrer ikke kopien.
 * Det forutsetter at filene under notes/ aldri skrives om på stedet, men byttes ut (`writeFileAtomic`, rename) eller
 * slettes og lages på nytt. Lenker tar ikke ekstra plass (tmp/ ligger på samme volum). Går det ikke å lenke, leses
 * originalen når den pakkes.
 */
async function snapshotFiles(notesRoot: string, into: string): Promise<{ rel: string; file: string }[]> {
  const files: { rel: string; file: string }[] = [];
  for await (const rel of walk(notesRoot)) {
    const src = path.join(notesRoot, rel);
    const dest = path.join(into, rel);
    try {
      await fsp.mkdir(path.dirname(dest), { recursive: true });
      await fsp.link(src, dest);
      files.push({ rel, file: dest });
    } catch (err) {
      // Slettet akkurat nå: hører ikke med. Ellers (et annet filsystem, for mange lenker) brukes originalen.
      if ((err as NodeJS.ErrnoException).code !== 'ENOENT') files.push({ rel, file: src });
    }
  }
  return files;
}

const count = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

function readme(at: Date, version: string, s: ReturnType<Repo['backupSummary']>): string {
  return `Sikkerhetskopi av SmartNotes
Laget ${osloTime.format(at)} (SmartNotes ${version}).
${s.subjects} fag, ${count(s.notes, 'notat', 'notater')} og ${count(s.decks, 'kortstokk', 'kortstokker')} med ${s.cards} kort.

Innhold
- smartnotes.db: databasen med fagene, kapitlene, notatene, kortstokkene og forbruket av AI (SQLite).
- notes/: én mappe per notat med originalbildene (source), sidebildene (pages), figurene, LaTeX-koden og PDF-en.
- sikkerhetskopi.json: hva kopien inneholder, til bruk ved gjenoppretting.

Ikke med
- Samle-PDF-ene for kapitler og fag. De lages på nytt når du åpner dem.
- Innloggingene. Etter en gjenoppretting logger du inn på nytt på hver enhet.

Gjenoppretting
Ta vare på fila, for eksempel i iCloud Drive. Gjenoppretting er ikke bygd inn i appen ennå. Be gjerne Claude om
hjelp, og følg disse stegene i datamappen til serveren (/data på Railway):
1. Stopp serveren. Ingen prosess kan ha databasen åpen mens du bytter den.
2. Flytt smartnotes.db, smartnotes.db-wal, smartnotes.db-shm og mappen notes/ til en egen mappe ved siden av.
   Ikke slett dem: -wal kan ha de siste endringene. Blir en -wal liggende igjen, skriver SQLite gamle endringer
   over kopien.
3. Legg inn smartnotes.db og notes/ fra denne mappen. Sjekk at det ikke ligger noen smartnotes.db-wal eller
   smartnotes.db-shm ved siden av.
4. Start serveren. Docker-bildet gir filene riktig eier selv (ellers: chown -R node:node /data).
5. Logg inn på nytt på hver enhet. Appen henter da alt på nytt og glemmer notater og PDF-er som ikke finnes i kopien.
På Railway kan volumet bare nås fra en tjeneste som kjører, så der trengs noen ekstra steg. Mer i docs/OPPSETT.md
under «Sikkerhetskopi».
`;
}

/**
 * Lager sikkerhetskopien: kopierer databasen (så den er konsistent) og lenker filene til notatene, og returnerer en
 * strøm med .tar.gz som pakker dem etter hvert som nettleseren tar imot. Den midlertidige mappen slettes når
 * strømmen er ferdig eller avbrutt.
 */
export async function createBackup(
  repo: Repo,
  storage: Storage,
  opts: { version: string; now?: Date; onError?: (err: Error) => void },
): Promise<{ name: string; stream: Readable }> {
  const at = opts.now ?? new Date();
  const name = backupName(at);
  const dir = await storage.makeTmpDir('backup');
  const dbCopy = path.join(dir, 'smartnotes.db');
  const cleanup = () => fsp.rm(dir, { recursive: true, force: true }).catch(() => {});
  let summary: ReturnType<Repo['backupSummary']>;
  let files: { rel: string; file: string }[];
  try {
    summary = repo.backupSummary();
    await repo.backupTo(dbCopy);
    files = await snapshotFiles(storage.notesRoot, path.join(dir, 'notes'));
  } catch (err) {
    await cleanup();
    throw err;
  }
  const manifest = {
    format: 'smartnotes-sikkerhetskopi',
    version: 1,
    createdAt: at.toISOString(),
    appVersion: opts.version,
    ...summary,
  };

  async function* entries(): AsyncGenerator<Buffer> {
    try {
      yield* tarEntry(`${name}/LES-MEG.txt`, Buffer.from(readme(at, opts.version, summary)), at);
      yield* tarEntry(`${name}/sikkerhetskopi.json`, Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`), at);
      yield* tarEntry(`${name}/smartnotes.db`, await fsp.readFile(dbCopy), at);
      const missing: string[] = [];
      for (const { rel, file } of files) {
        // Hele fila leses før headeren skrives, så størrelsen i headeren alltid stemmer med innholdet, også om
        // fila skrives på nytt imens. Bare en original som ikke kunne lenkes, kan forsvinne underveis.
        let data: Buffer;
        let mtime: Date;
        try {
          [data, mtime] = await Promise.all([fsp.readFile(file), fsp.stat(file).then((s) => s.mtime)]);
        } catch (err) {
          if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err;
          missing.push(`notes/${rel}`);
          continue;
        }
        yield* tarEntry(`${name}/notes/${rel}`, data, mtime);
      }
      if (missing.length > 0) {
        const text = `Disse filene ble slettet mens sikkerhetskopien ble laget, og er ikke med:\n${missing.join('\n')}\n`;
        yield* tarEntry(`${name}/mangler.txt`, Buffer.from(text), new Date());
      }
      yield TAR_END;
    } finally {
      await cleanup();
    }
  }

  // Bildene og PDF-ene er komprimert fra før, så lett gzip er nok (databasen og LaTeX-filene krymper likevel godt).
  const gzip = createGzip({ level: 1 });
  pipeline(Readable.from(entries(), { objectMode: false }), gzip, (err) => {
    // Også når strømmen rives ned før første fil er lest (da kjører aldri `finally` i entries).
    void cleanup();
    // Avbrutt av nettleseren (lukket fane, mistet nett) er ikke en feil som trenger logging.
    if (err && err.code !== 'ERR_STREAM_PREMATURE_CLOSE') opts.onError?.(err);
  });
  return { name, stream: gzip };
}
