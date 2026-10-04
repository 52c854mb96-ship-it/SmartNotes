/** Lesehooks mot Dexie. `undefined` betyr «laster», `null` betyr «finnes ikke». */
import { useLiveQuery } from 'dexie-react-hooks';
import type { Chapter, Note, Subject } from '@smartnotes/shared';
import { db, type OutboxEntry, type PdfCacheEntry } from './db';
import { compareChapters, compareNotes, noteDay } from './lib/format';

export function useSubjects(): Subject[] | undefined {
  return useLiveQuery(async () => {
    const rows = await db.subjects.toArray();
    return rows.sort((a, b) => a.position - b.position || a.name.localeCompare(b.name, 'nb'));
  }, []);
}

export function useSubject(id: string | undefined): Subject | null | undefined {
  return useLiveQuery(async () => (id ? ((await db.subjects.get(id)) ?? null) : null), [id]);
}

export function useChapters(subjectId: string | undefined): Chapter[] | undefined {
  return useLiveQuery(async () => {
    if (!subjectId) return [];
    const rows = await db.chapters.where('subjectId').equals(subjectId).toArray();
    return rows.sort(compareChapters);
  }, [subjectId]);
}

export function useChapter(id: string | undefined): Chapter | null | undefined {
  return useLiveQuery(async () => (id ? ((await db.chapters.get(id)) ?? null) : null), [id]);
}

export function useSubjectNotes(subjectId: string | undefined): Note[] | undefined {
  return useLiveQuery(async () => {
    if (!subjectId) return [];
    const rows = await db.notes.where('subjectId').equals(subjectId).toArray();
    return rows.sort(compareNotes);
  }, [subjectId]);
}

export function useNote(id: string | undefined): Note | null | undefined {
  return useLiveQuery(async () => (id ? ((await db.notes.get(id)) ?? null) : null), [id]);
}

export function useOutbox(subjectId?: string): OutboxEntry[] | undefined {
  return useLiveQuery(async () => {
    const rows = subjectId
      ? await db.outbox.where('subjectId').equals(subjectId).toArray()
      : await db.outbox.toArray();
    return rows.sort((a, b) => a.createdAt - b.createdAt);
  }, [subjectId]);
}

/** Lokalt lagret PDF for et notat (`null` = ikke lagret). */
export function useCachedPdf(noteId: string | undefined): PdfCacheEntry | null | undefined {
  return useLiveQuery(async () => (noteId ? ((await db.pdfs.get(noteId)) ?? null) : null), [noteId]);
}

export interface ChapterStats {
  count: number;
  lastDay: string | null;
  converting: number;
}

/** Antall notater m.m. per kapittel-id (nøkkel '' = uten kapittel). */
export function chapterStats(notes: Note[]): Map<string, ChapterStats> {
  const map = new Map<string, ChapterStats>();
  for (const n of notes) {
    const key = n.chapterId ?? '';
    const s = map.get(key) ?? { count: 0, lastDay: null, converting: 0 };
    s.count += 1;
    const day = noteDay(n);
    if (!s.lastDay || day > s.lastDay) s.lastDay = day;
    if (n.status === 'queued' || n.status === 'processing') s.converting += 1;
    map.set(key, s);
  }
  return map;
}

/** Globale tellere til synkstatus i sidepanelet. */
export function useActivityCounts(): { outbox: number; outboxErrors: number; converting: number } | undefined {
  return useLiveQuery(async () => {
    const [outbox, outboxErrors, converting] = await Promise.all([
      db.outbox.count(),
      db.outbox.where('state').equals('error').count(),
      db.notes.where('status').anyOf('queued', 'processing').count(),
    ]);
    return { outbox, outboxErrors, converting };
  }, []);
}
