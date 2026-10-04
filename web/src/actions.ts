/**
 * Endringer som krever nett (alt unntatt opplasting). Hver handling kaller API-et,
 * legger svaret inn i Dexie med en gang og trigger en synk for å hente resten.
 */
import type { Chapter, ChapterInput, Note, UpdateNoteRequest } from '@smartnotes/shared';
import { api } from './api';
import { db } from './db';
import { applyServerRows, syncNow } from './sync';

// ---------- Fag ----------

export async function createSubject(name: string, textbook: string | null) {
  const subject = await api.createSubject({ name, profile: 'physics', textbook });
  await applyServerRows({ subjects: [subject] });
  void syncNow();
  return subject;
}

export async function updateSubject(id: string, req: { name?: string; textbook?: string | null }) {
  const subject = await api.updateSubject(id, req);
  await applyServerRows({ subjects: [subject] });
  void syncNow();
  return subject;
}

export async function deleteSubject(id: string) {
  await api.deleteSubject(id);
  await db.transaction('rw', [db.subjects, db.chapters, db.notes, db.pdfs, db.outbox], async () => {
    const noteIds = await db.notes.where('subjectId').equals(id).primaryKeys();
    await db.pdfs.bulkDelete(noteIds);
    await db.notes.bulkDelete(noteIds);
    await db.chapters.where('subjectId').equals(id).delete();
    await db.outbox.where('subjectId').equals(id).delete();
    await db.subjects.delete(id);
  });
  await db.bundlePdfs.delete(`subject:${id}`);
  void syncNow();
}

// ---------- Kapitler ----------

export async function createChapter(subjectId: string, input: ChapterInput) {
  const chapter = await api.createChapter(subjectId, input);
  await applyServerRows({ chapters: [chapter] });
  void syncNow();
  return chapter;
}

export async function addChapters(subjectId: string, chapters: ChapterInput[]) {
  const res = await api.bulkChapters(subjectId, chapters);
  await applyServerRows({ chapters: res.chapters });
  void syncNow();
  return res.chapters;
}

export async function updateChapter(id: string, req: { number?: string | null; title?: string }) {
  const chapter = await api.updateChapter(id, req);
  await applyServerRows({ chapters: [chapter] });
  void syncNow();
  return chapter;
}

export async function deleteChapter(id: string) {
  await api.deleteChapter(id);
  await db.transaction('rw', db.chapters, db.notes, async () => {
    await db.notes.where('chapterId').equals(id).modify({ chapterId: null });
    await db.chapters.delete(id);
  });
  await db.bundlePdfs.delete(`chapter:${id}`);
  void syncNow();
}

/** Ny rekkefølge – oppdateres lokalt med en gang (optimistisk) og rulles tilbake ved feil. */
export async function reorderChapters(subjectId: string, ordered: Chapter[]) {
  const before = await db.chapters.where('subjectId').equals(subjectId).toArray();
  await db.chapters.bulkPut(ordered.map((c, i) => ({ ...c, position: i })));
  try {
    await api.reorderChapters(
      subjectId,
      ordered.map((c) => c.id),
    );
  } catch (err) {
    await db.chapters.bulkPut(before);
    throw err;
  }
  void syncNow();
}

// ---------- Notater ----------

export async function updateNote(id: string, req: UpdateNoteRequest): Promise<Note> {
  const note = await api.updateNote(id, req);
  await applyServerRows({ notes: [note] });
  void syncNow();
  return note;
}

export async function deleteNote(id: string) {
  await api.deleteNote(id);
  await db.transaction('rw', db.notes, db.pdfs, async () => {
    await db.notes.delete(id);
    await db.pdfs.delete(id);
  });
  void syncNow();
}

export async function retryNote(id: string, instructions: string | null) {
  const note = await api.retryNote(id, { instructions });
  await applyServerRows({ notes: [note] });
  void syncNow();
  return note;
}

export async function saveLatex(id: string, body: string) {
  const res = await api.saveLatex(id, body);
  if (res.note) await applyServerRows({ notes: [res.note] });
  void syncNow();
  return res;
}
