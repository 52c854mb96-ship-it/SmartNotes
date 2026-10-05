import { Dexie, type EntityTable } from 'dexie';
import type { Chapter, Deck, Flashcard, FlashcardKind, Note, Subject } from '@smartnotes/shared';

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

/**
 * Fremgang fra øving som ikke er sendt til serveren ennå (også offline). Bare siste verdi per kort/kortstokk teller,
 * så nøkkelen er `card:<id>` eller `deck:<id>`.
 */
export interface ProgressEntry {
  key: string;
  type: 'card' | 'deck';
  id: string;
  /** Kort: nytt nivå og når det ble satt (ISO). */
  level?: number;
  at?: string;
  /** Kortstokk: ny beste rekke. */
  best?: number;
}

/** Rekkefølgen kortene øves i. */
export type PracticeOrder = 'notes' | 'shuffle';

/** Øktene lagres per kortstokk på denne enheten, så man kan gå fra og fortsette der man slapp. */
export interface PracticeState {
  deckId: string;
  /** Bare kort fra dette notatet (null = alle). */
  noteId: string | null;
  /** Bare denne korttypen (null = alle). */
  kind: FlashcardKind | null;
  order: PracticeOrder;
  /** Repetisjon av et utvalg (kort-id-er), eller null = hele utvalget. */
  subset: string[] | null;
  /** Køen (kort-id-er). Første kort er det som vises. */
  queue: string[];
  /** Dårligste vurdering (1–4) per kort i denne runden – grunnlaget for repetisjonsvalgene. */
  grades: Record<string, number>;
  answered: number;
  correct: number;
  streak: number;
  updatedAt: number;
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
  decks: EntityTable<Deck, 'id'>;
  cards: EntityTable<Flashcard, 'id'>;
  progress: EntityTable<ProgressEntry, 'key'>;
  practice: EntityTable<PracticeState, 'deckId'>;
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
const STORES_V3 = { ...STORES_V2, notes: 'id, subjectId, chapterId, status, stage, clientId, section' };
db.version(3)
  .stores(STORES_V3)
  .upgrade(async (tx) => {
    await tx.table('meta').put({ key: 'syncCursor', value: 0 });
  });

// Versjon 4: flashcards. Kortstokker laget på en annen enhet før denne versjonen har lavere rev enn markøren,
// så markøren nullstilles for en full synk.
db.version(4)
  .stores({ ...STORES_V3, decks: 'id, subjectId', cards: 'id, deckId', progress: 'key', practice: 'deckId' })
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
