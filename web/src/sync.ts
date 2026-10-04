/**
 * Synk-motoren. Dexie er eneste kilde UI-et leser fra; denne modulen
 *  1) sender køen av opplastinger (outbox) til serveren,
 *  2) henter endringer fra /api/sync og legger dem inn i Dexie,
 *  3) forhåndslaster ferdige PDF-er slik at alt kan leses offline.
 * Tilstanden eksponeres gjennom `syncStore`/`useSyncState()`.
 */
import type { EntityTable, IDType } from 'dexie';
import type { Chapter, Note, Subject, SyncResponse, SyncedRow } from '@smartnotes/shared';
import { ApiError, NetworkError, api, errorMessage, isAbortError, isRetryable, uploadNote } from './api';
import { META, clearAllLocalData, db, getMeta, setMeta, storable, type OutboxEntry } from './db';
import { authStore, isOnline, setBrowserOnline } from './lib/connectivity';
import { createStore } from './lib/store';

export interface SyncState {
  running: boolean;
  lastSyncAt: number | null;
  lastError: string | null;
  /** clientId → andel lastet opp (0–1) for opplastinger som pågår. */
  uploadProgress: Record<string, number>;
  /** Fremdrift for PDF-forhåndslasting. */
  prefetch: { done: number; total: number } | null;
}

const initialState: SyncState = {
  running: false,
  lastSyncAt: null,
  lastError: null,
  uploadProgress: {},
  prefetch: null,
};

export const syncStore = createStore<SyncState>(initialState);
export const useSyncState = (): SyncState => syncStore.use();

const FAST_INTERVAL = 4_000;
const SLOW_INTERVAL = 60_000;
const MAX_BACKOFF = 60_000;
const PREFETCH_CONCURRENCY = 2;

let started = false;
let running: Promise<void> | null = null;
let rerunRequested = false;
let fullRequested = false;
let failures = 0;
let timer: ReturnType<typeof setTimeout> | undefined;
let scheduleToken = 0;
const uploadAborts = new Map<string, AbortController>();

// ---------- Oppstart og triggere ----------

export function startSyncEngine(): void {
  if (started) return;
  started = true;

  window.addEventListener('online', () => {
    setBrowserOnline(true);
    failures = 0;
    void syncNow();
  });
  window.addEventListener('offline', () => {
    setBrowserOnline(false);
    void scheduleNext();
  });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void syncNow();
  });

  void (async () => {
    // En opplasting som ble avbrutt (appen lukket) skal prøves på nytt.
    await db.outbox.where('state').equals('uploading').modify({ state: 'pending' });
    const lastSyncAt = (await getMeta<number>(META.lastSyncAt)) ?? null;
    syncStore.set((s) => ({ ...s, lastSyncAt }));
    void syncNow();
  })();
}

/** Ber nettleseren om varig lagring (én gang), slik at offline-data ikke ryddes bort. */
export async function requestPersistentStorage(): Promise<boolean> {
  try {
    if (!navigator.storage?.persist) return false;
    if (await navigator.storage.persisted()) return true;
    if (await getMeta<boolean>(META.persistAsked)) return false;
    await setMeta(META.persistAsked, true);
    return await navigator.storage.persist();
  } catch {
    return false;
  }
}

// ---------- Hovedløkka ----------

/**
 * Kjør en synk nå. Samtidige kall slås sammen: kalles den mens en synk pågår,
 * kjøres én runde til etterpå, og løftet løses først når alt er ferdig.
 */
export function syncNow(opts: { full?: boolean } = {}): Promise<void> {
  if (opts.full) fullRequested = true;
  if (running) {
    rerunRequested = true;
    return running;
  }
  clearTimeout(timer);
  running = (async () => {
    syncStore.set((s) => ({ ...s, running: true }));
    try {
      do {
        rerunRequested = false;
        await runOnce();
      } while (rerunRequested && authStore.get() === 'ok' && navigator.onLine);
    } finally {
      running = null;
      syncStore.set((s) => ({ ...s, running: false }));
      void scheduleNext();
    }
  })();
  return running;
}

async function runOnce(): Promise<void> {
  if (authStore.get() !== 'ok') return;
  if (!navigator.onLine) {
    setBrowserOnline(false);
    return;
  }
  const fail = (err: unknown) => {
    failures += 1;
    syncStore.set((s) => ({ ...s, lastError: errorMessage(err, 'Synkroniseringen feilet.') }));
  };
  const is401 = (err: unknown) => err instanceof ApiError && err.status === 401;

  // 1) Send køen. En serverfeil på én opplasting skal ikke hindre at vi henter endringer.
  let flushError: unknown = null;
  try {
    await withLock('smartnotes-outbox', flushOutbox);
  } catch (err) {
    if (is401(err)) return; // authStore er satt til 'required'
    if (err instanceof NetworkError) {
      fail(err);
      return;
    }
    flushError = err;
  }

  // 2) Hent endringer.
  try {
    await pull();
  } catch (err) {
    if (!is401(err)) fail(err);
    return;
  }
  if (flushError) {
    fail(flushError);
  } else {
    failures = 0;
    syncStore.set((s) => ({ ...s, lastError: null }));
  }

  // 3) Forhåndslast PDF-er i bakgrunnen (blokkerer ikke nye opplastinger/synker).
  void runPrefetch(false);
}

let prefetchRunning: Promise<{ fetched: number; failed: number }> | null = null;

/** Kjører forhåndslasting, aldri to samtidig i samme fane (og helst ikke på tvers av faner). */
function runPrefetch(wait: boolean): Promise<{ fetched: number; failed: number }> {
  if (prefetchRunning) return prefetchRunning;
  prefetchRunning = withLock('smartnotes-prefetch', prefetchPdfs, wait)
    .then((r) => r ?? { fetched: 0, failed: 0 })
    .catch(() => ({ fetched: 0, failed: 0 }))
    .finally(() => {
      prefetchRunning = null;
    });
  return prefetchRunning;
}

async function scheduleNext(): Promise<void> {
  const token = ++scheduleToken;
  clearTimeout(timer);
  if (authStore.get() !== 'ok') return;
  if (!navigator.onLine) return; // 'online'-hendelsen vekker oss

  let delay: number;
  if (failures > 0) {
    delay = Math.min(MAX_BACKOFF, 2_000 * 2 ** (failures - 1));
  } else {
    const outboxPending = await db.outbox.where('state').anyOf('pending', 'uploading').count();
    const converting = await countNotesInProgress();
    if (outboxPending > 0) delay = FAST_INTERVAL;
    else if (converting > 0) delay = document.visibilityState === 'hidden' ? SLOW_INTERVAL : FAST_INTERVAL;
    else delay = SLOW_INTERVAL;
  }
  if (token !== scheduleToken || running) return;
  timer = setTimeout(() => void syncNow(), delay);
}

/**
 * Notater serveren jobber med: i kø/under konvertering, eller ferdige notater der PDF-en
 * bygges på nytt i bakgrunnen (status 'done' men `stage` ≠ null, f.eks. etter navnebytte).
 */
export async function countNotesInProgress(): Promise<number> {
  const keys = new Set<string>();
  for (const k of await db.notes.where('status').anyOf('queued', 'processing').primaryKeys()) keys.add(k);
  for (const k of await db.notes.where('stage').anyOf('preparing', 'reading', 'compiling', 'fixing').primaryKeys()) {
    keys.add(k);
  }
  return keys.size;
}

async function withLock<T>(name: string, fn: () => Promise<T>, wait = false): Promise<T | undefined> {
  const locks = typeof navigator !== 'undefined' ? navigator.locks : undefined;
  if (!locks) return fn();
  // Vent på låsen ved eksplisitte handlinger.
  if (wait) return locks.request(name, async () => fn());
  // ifAvailable: hvis en annen fane holder på, hopper vi over (den gjør jobben).
  return locks.request(name, { ifAvailable: true }, async (lock) => (lock ? fn() : undefined));
}

// ---------- 1) Outbox ----------

function setProgress(clientId: string, value: number | null): void {
  syncStore.set((s) => {
    const uploadProgress = { ...s.uploadProgress };
    if (value === null) delete uploadProgress[clientId];
    else uploadProgress[clientId] = value;
    return { ...s, uploadProgress };
  });
}

async function flushOutbox(): Promise<void> {
  const entries = await db.outbox.orderBy('createdAt').toArray();
  for (const entry of entries) {
    if (entry.state === 'error') continue;
    if (authStore.get() !== 'ok' || !navigator.onLine) return;
    // Kan ha blitt slettet av brukeren i mellomtiden.
    const updated = await db.outbox.update(entry.clientId, { state: 'uploading' });
    if (!updated) continue;

    const abort = new AbortController();
    uploadAborts.set(entry.clientId, abort);
    setProgress(entry.clientId, 0);
    try {
      const note = await uploadNote(entry, (p) => setProgress(entry.clientId, p), abort.signal);
      await db.transaction('rw', db.outbox, db.notes, async () => {
        await db.outbox.delete(entry.clientId);
        await mergeRows(db.notes, [note]);
      });
    } catch (err) {
      if (isAbortError(err)) continue; // slettet fra køen mens den ble lastet opp
      const lastError = errorMessage(err, 'Opplastingen feilet.');
      if (err instanceof ApiError && err.status === 401) {
        await db.outbox.update(entry.clientId, { state: 'pending' });
        throw err;
      }
      if (isRetryable(err)) {
        await db.outbox.update(entry.clientId, { state: 'pending', attempts: entry.attempts + 1, lastError });
        throw err;
      }
      // Permanent feil (400, 413, 415 …): brukeren må prøve igjen eller slette.
      await db.outbox.update(entry.clientId, { state: 'error', attempts: entry.attempts + 1, lastError });
    } finally {
      uploadAborts.delete(entry.clientId);
      setProgress(entry.clientId, null);
    }
  }
}

export async function enqueueUpload(
  input: Omit<OutboxEntry, 'createdAt' | 'attempts' | 'lastError' | 'state'>,
): Promise<void> {
  const files = await Promise.all(input.files.map(async (f) => ({ ...f, blob: await storable(f.blob) })));
  await db.outbox.add({ ...input, files, createdAt: Date.now(), attempts: 0, lastError: null, state: 'pending' });
  void syncNow();
}

export async function retryOutboxEntry(clientId: string): Promise<void> {
  await db.outbox.update(clientId, { state: 'pending', lastError: null });
  failures = 0;
  void syncNow();
}

export async function deleteOutboxEntry(clientId: string): Promise<void> {
  uploadAborts.get(clientId)?.abort();
  await db.outbox.delete(clientId);
}

// ---------- 2) Hent endringer ----------

async function pull(): Promise<void> {
  const wantFull = fullRequested;
  const cursor = (await getMeta<number>(META.cursor)) ?? 0;
  const since = wantFull ? 0 : cursor;
  let res = await api.sync(since);
  if (!res.full && res.cursor < since) {
    // Serveren har en lavere markør enn oss (f.eks. tilbakestilt database) – hent alt på nytt.
    res = await api.sync(0);
  }
  await applySync(res);
  if (wantFull) fullRequested = false;
  const now = Date.now();
  syncStore.set((s) => ({ ...s, lastSyncAt: now }));
}

async function applySync(res: SyncResponse): Promise<void> {
  await db.transaction('rw', [db.subjects, db.chapters, db.notes, db.pdfs, db.meta], async () => {
    if (res.full) {
      await replaceRows(db.subjects, res.subjects, res.cursor);
      await replaceRows(db.chapters, res.chapters, res.cursor);
      await replaceRows(db.notes, res.notes, res.cursor);
      const noteIds = new Set(await db.notes.toCollection().primaryKeys());
      const cached = await db.pdfs.toCollection().primaryKeys();
      await db.pdfs.bulkDelete(cached.filter((id) => !noteIds.has(id)));
    } else {
      await mergeRows(db.subjects, res.subjects);
      await mergeRows(db.chapters, res.chapters);
      await mergeRows(db.notes, res.notes);
      const deletedNotes = res.notes.filter((n) => n.deleted).map((n) => n.id);
      if (deletedNotes.length) await db.pdfs.bulkDelete(deletedNotes);
    }
    await db.meta.bulkPut([
      { key: META.cursor, value: res.cursor },
      { key: META.lastSyncAt, value: Date.now() },
    ]);
  });
}

/** Legger inn rader fra serveren, men overskriver aldri en lokal rad med høyere rev. */
async function mergeRows<T extends SyncedRow>(table: EntityTable<T, 'id'>, rows: T[]): Promise<void> {
  if (!rows.length) return;
  const existing = await table.bulkGet(rows.map((r) => r.id as IDType<T, 'id'>));
  const puts: T[] = [];
  const deletes: IDType<T, 'id'>[] = [];
  rows.forEach((row, i) => {
    const current = existing[i];
    if (current && current.rev > row.rev) return;
    if (row.deleted) deletes.push(row.id as IDType<T, 'id'>);
    else puts.push(row);
  });
  if (puts.length) await table.bulkPut(puts);
  if (deletes.length) await table.bulkDelete(deletes);
}

/** Full synk: erstatt tabellen, men behold lokale rader som er nyere enn øyeblikksbildet. */
async function replaceRows<T extends SyncedRow>(table: EntityTable<T, 'id'>, rows: T[], cursor: number): Promise<void> {
  const newerLocal = (await table.toArray()).filter((r) => r.rev > cursor);
  const byId = new Map<string, T>();
  for (const row of rows) if (!row.deleted) byId.set(row.id, row);
  for (const row of newerLocal) {
    const remote = byId.get(row.id);
    if (!remote || row.rev > remote.rev) byId.set(row.id, row);
  }
  await table.clear();
  await table.bulkPut([...byId.values()]);
}

/** Legg inn rader vi fikk som svar på en endring (PATCH/POST), og synk etterpå. */
export async function applyServerRows(rows: {
  subjects?: Subject[];
  chapters?: Chapter[];
  notes?: Note[];
}): Promise<void> {
  await db.transaction('rw', db.subjects, db.chapters, db.notes, async () => {
    if (rows.subjects) await mergeRows(db.subjects, rows.subjects);
    if (rows.chapters) await mergeRows(db.chapters, rows.chapters);
    if (rows.notes) await mergeRows(db.notes, rows.notes);
  });
}

// ---------- 3) Forhåndslasting av PDF-er ----------

const inflightPdfs = new Map<string, Promise<Blob>>();

/** Henter PDF-en til et notat fra serveren og lagrer den i Dexie. Samtidige kall deles. */
export function fetchNotePdf(noteId: string, rev: number): Promise<Blob> {
  const key = `${noteId}:${rev}`;
  let p = inflightPdfs.get(key);
  if (!p) {
    p = (async () => {
      const blob = await api.notePdf(noteId, rev);
      const stored = await storable(blob);
      await db.transaction('rw', db.pdfs, db.notes, async () => {
        if (!(await db.notes.get(noteId))) return; // slettet i mellomtiden
        const current = await db.pdfs.get(noteId);
        if (current && current.rev > rev) return;
        await db.pdfs.put({ noteId, rev, blob: stored, size: blob.size, fetchedAt: Date.now() });
      });
      return blob;
    })().finally(() => inflightPdfs.delete(key));
    inflightPdfs.set(key, p);
  }
  return p;
}

/** Notater med ferdig PDF som ikke er lagret lokalt (eller er utdatert). */
export async function notesMissingPdf(): Promise<Note[]> {
  const done = await db.notes.where('status').equals('done').toArray();
  const keys = (await db.pdfs.orderBy('[noteId+rev]').keys()) as unknown as [string, number][];
  const cachedRev = new Map(keys.map(([id, rev]) => [id, rev]));
  return done.filter((n) => n.pdfRev > 0 && (cachedRev.get(n.id) ?? -1) < n.pdfRev);
}

async function prefetchPdfs(): Promise<{ fetched: number; failed: number }> {
  const todo = await notesMissingPdf();
  if (!todo.length) return { fetched: 0, failed: 0 };
  let next = 0;
  let fetched = 0;
  let failed = 0;
  syncStore.set((s) => ({ ...s, prefetch: { done: 0, total: todo.length } }));
  const worker = async () => {
    while (next < todo.length) {
      const note = todo[next++]!;
      if (!isOnline() || authStore.get() !== 'ok') return;
      try {
        await fetchNotePdf(note.id, note.pdfRev);
        fetched += 1;
      } catch (err) {
        failed += 1;
        if (err instanceof NetworkError) return; // vi er offline – gi opp denne runden
      }
      syncStore.set((s) => ({ ...s, prefetch: { done: fetched + failed, total: todo.length } }));
    }
  };
  try {
    await Promise.all(Array.from({ length: PREFETCH_CONCURRENCY }, worker));
  } finally {
    syncStore.set((s) => ({ ...s, prefetch: null }));
  }
  return { fetched, failed };
}

/** «Last ned alt for offline»: synk og hent alle manglende PDF-er nå. */
export async function downloadAllForOffline(): Promise<{ fetched: number; failed: number; missing: number }> {
  await syncNow();
  // En pågående runde fullføres først; deretter en ny runde som tar med alt som mangler.
  if (prefetchRunning) await prefetchRunning;
  const result = await runPrefetch(true);
  const missing = (await notesMissingPdf()).length;
  return { ...result, missing };
}

// ---------- Utlogging ----------

export async function logoutAndClear(): Promise<void> {
  clearTimeout(timer);
  for (const abort of uploadAborts.values()) abort.abort();
  try {
    if (isOnline()) await api.logout();
  } catch {
    /* logger ut lokalt uansett */
  }
  await clearAllLocalData();
  try {
    await Promise.all(['note-pages', 'note-page-lists'].map((name) => caches.delete(name)));
  } catch {
    /* Cache API ikke tilgjengelig */
  }
  failures = 0;
  syncStore.set(initialState);
  authStore.set('required');
}

/** Etter vellykket innlogging: marker og hent alt. */
export async function afterLogin(): Promise<void> {
  await setMeta(META.loggedIn, true);
  authStore.set('ok');
  failures = 0;
  void requestPersistentStorage();
  await syncNow({ full: true });
}
