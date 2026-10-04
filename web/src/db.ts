import { Dexie, type EntityTable } from 'dexie';
import type { Chapter, Note, Subject } from '@smartnotes/shared';

/**
 * Filinnhold slik det lagres i IndexedDB: en Blob der nettleseren kan lagre Blob, ellers rå bytes.
 * Safari kan ikke lagre Blob i IndexedDB i private vinduer (og i WebKit uten fast lagring), og da
 * feilet både opplastingskøen og PDF-lageret. Les alltid via `asBlob`, lagre via `storable`.
 */
export type StoredBytes = Blob | ArrayBuffer;

export interface OutboxFile {
  name: string;
  type: string;
  blob: StoredBytes;
}

export type OutboxState = 'pending' | 'uploading' | 'error';

/** En opplasting som venter på å bli sendt til serveren. */
export interface OutboxEntry {
  clientId: string;
  subjectId: string;
  /** 'auto' = la Claude velge, ellers kapittel-id. */
  chapterId: string;
  title: string;
  noteDate: string;
  instructions: string;
  files: OutboxFile[];
  createdAt: number;
  attempts: number;
  lastError: string | null;
  state: OutboxState;
}

export interface PdfCacheEntry {
  noteId: string;
  rev: number;
  blob: StoredBytes;
  size: number;
  fetchedAt: number;
}

export interface BundlePdfEntry {
  /** `chapter:<id>` eller `subject:<id>` */
  key: string;
  blob: StoredBytes;
  fetchedAt: number;
  /** Signatur av innholdet (notater + pdfRev) da PDF-en ble hentet – brukes til å se om den er utdatert. */
  sig: string;
}

export interface MetaEntry {
  key: string;
  value: unknown;
}

export type SmartNotesDB = Dexie & {
  subjects: EntityTable<Subject, 'id'>;
  chapters: EntityTable<Chapter, 'id'>;
  notes: EntityTable<Note, 'id'>;
  meta: EntityTable<MetaEntry, 'key'>;
  pdfs: EntityTable<PdfCacheEntry, 'noteId'>;
  bundlePdfs: EntityTable<BundlePdfEntry, 'key'>;
  outbox: EntityTable<OutboxEntry, 'clientId'>;
};

export const db = new Dexie('smartnotes') as SmartNotesDB;

const STORES_V2 = {
  subjects: 'id, position',
  chapters: 'id, subjectId, position',
  // `stage` er indeksert slik at vi finner notater som er under arbeid (null indekseres ikke).
  notes: 'id, subjectId, chapterId, status, stage, clientId',
  meta: 'key',
  pdfs: 'noteId, [noteId+rev]',
  bundlePdfs: 'key',
  outbox: 'clientId, createdAt, subjectId, state',
};

// Versjon 2: indeks på notes.stage.
db.version(2).stores(STORES_V2);

// Versjon 3: delkapitler, kompetansemål og søketekst. Lokale rader mangler de nye feltene,
// så markøren nullstilles – neste synk blir en full synk som henter alt på nytt.
db.version(3)
  .stores({ ...STORES_V2, notes: 'id, subjectId, chapterId, status, stage, clientId, section' })
  .upgrade(async (tx) => {
    await tx.table('meta').put({ key: 'syncCursor', value: 0 });
  });

// ---------- filinnhold ----------

export function asBlob(data: StoredBytes, type: string): Blob {
  return data instanceof Blob ? data : new Blob([data], { type });
}

export function byteSize(data: StoredBytes): number {
  return data instanceof Blob ? data.size : data.byteLength;
}

let blobSupport: Promise<boolean> | null = null;

/** Om IndexedDB kan lagre Blob i denne nettleseren (prøves én gang). Safari i private vinduer kan ikke det. */
function canStoreBlobs(): Promise<boolean> {
  blobSupport ??= db.meta
    .put({ key: 'blobProbe', value: new Blob(['x'], { type: 'text/plain' }) })
    .then(() => db.meta.delete('blobProbe'))
    .then(
      () => true,
      () => false,
    );
  return blobSupport;
}

/**
 * Gjør filinnhold klart til å lagres: Blob der det går (rask og sparer minne), ellers bytes.
 * Kalles utenfor Dexie-transaksjoner, fordi den venter på ting som ikke er IndexedDB.
 */
export async function storable(data: StoredBytes): Promise<StoredBytes> {
  if (!(data instanceof Blob)) return data;
  return (await canStoreBlobs()) ? data : data.arrayBuffer();
}

// ---------- meta-hjelpere ----------

export const META = {
  cursor: 'syncCursor',
  lastSyncAt: 'lastSyncAt',
  loggedIn: 'loggedIn',
  persistAsked: 'persistAsked',
} as const;

export async function getMeta<T>(key: string): Promise<T | undefined> {
  const row = await db.meta.get(key);
  return row?.value as T | undefined;
}

export async function setMeta(key: string, value: unknown): Promise<void> {
  await db.meta.put({ key, value });
}

/** Tømmer alle lokale data (ved utlogging). */
export async function clearAllLocalData(): Promise<void> {
  await db.transaction('rw', db.tables, async () => {
    await Promise.all(db.tables.map((t) => t.clear()));
  });
}
