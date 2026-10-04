import { Dexie, type EntityTable } from 'dexie';
import type { Chapter, Note, Subject } from '@smartnotes/shared';

export interface OutboxFile {
  name: string;
  type: string;
  blob: Blob;
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
  blob: Blob;
  size: number;
  fetchedAt: number;
}

export interface BundlePdfEntry {
  /** `chapter:<id>` eller `subject:<id>` */
  key: string;
  blob: Blob;
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

db.version(1).stores({
  subjects: 'id, position',
  chapters: 'id, subjectId, position',
  // `stage` er indeksert slik at vi finner notater som er under arbeid (null indekseres ikke).
  notes: 'id, subjectId, chapterId, status, stage, clientId',
  meta: 'key',
  pdfs: 'noteId, [noteId+rev]',
  bundlePdfs: 'key',
  outbox: 'clientId, createdAt, subjectId, state',
});

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
