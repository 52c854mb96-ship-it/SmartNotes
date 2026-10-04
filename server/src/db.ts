import Database from 'better-sqlite3';
import { randomUUID } from 'node:crypto';
import type { Chapter, ChapterInput, Note, NoteStage, NoteStatus, Subject, SubjectProfile } from '@smartnotes/shared';

type DB = Database.Database;

const MIGRATIONS: string[] = [
  `
  CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
  INSERT INTO meta (key, value) VALUES ('rev', '0');

  CREATE TABLE subjects (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    profile TEXT NOT NULL,
    textbook TEXT,
    position INTEGER NOT NULL DEFAULT 0,
    rev INTEGER NOT NULL,
    deleted INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE INDEX subjects_rev ON subjects(rev);

  CREATE TABLE chapters (
    id TEXT PRIMARY KEY,
    subject_id TEXT NOT NULL REFERENCES subjects(id),
    number TEXT,
    title TEXT NOT NULL,
    position INTEGER NOT NULL DEFAULT 0,
    rev INTEGER NOT NULL,
    deleted INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE INDEX chapters_rev ON chapters(rev);
  CREATE INDEX chapters_subject ON chapters(subject_id);

  CREATE TABLE notes (
    id TEXT PRIMARY KEY,
    subject_id TEXT NOT NULL REFERENCES subjects(id),
    chapter_id TEXT,
    client_id TEXT UNIQUE,
    title TEXT NOT NULL DEFAULT '',
    title_auto INTEGER NOT NULL DEFAULT 1,
    note_date TEXT,
    note_date_auto INTEGER NOT NULL DEFAULT 1,
    status TEXT NOT NULL,
    stage TEXT,
    error TEXT,
    page_count INTEGER NOT NULL DEFAULT 0,
    pdf_rev INTEGER NOT NULL DEFAULT 0,
    remarks TEXT NOT NULL DEFAULT '[]',
    chapter_auto INTEGER NOT NULL DEFAULT 1,
    instructions TEXT,
    position INTEGER NOT NULL DEFAULT 0,
    attempts INTEGER NOT NULL DEFAULT 0,
    not_before TEXT,
    usage TEXT,
    rev INTEGER NOT NULL,
    deleted INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE INDEX notes_rev ON notes(rev);
  CREATE INDEX notes_subject ON notes(subject_id);
  CREATE INDEX notes_chapter ON notes(chapter_id);
  CREATE INDEX notes_status ON notes(status);

  CREATE TABLE note_files (
    id TEXT PRIMARY KEY,
    note_id TEXT NOT NULL REFERENCES notes(id),
    position INTEGER NOT NULL,
    original_name TEXT NOT NULL,
    mime TEXT NOT NULL,
    filename TEXT NOT NULL,
    size INTEGER NOT NULL
  );
  CREATE INDEX note_files_note ON note_files(note_id);

  CREATE TABLE sessions (
    token_hash TEXT PRIMARY KEY,
    created_at TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    user_agent TEXT
  );
  `,
];

// ---------- Rad-typer (slik de ligger i SQLite) ----------

interface SubjectRow {
  id: string;
  name: string;
  profile: string;
  textbook: string | null;
  position: number;
  rev: number;
  deleted: number;
  created_at: string;
  updated_at: string;
}

interface ChapterRow {
  id: string;
  subject_id: string;
  number: string | null;
  title: string;
  position: number;
  rev: number;
  deleted: number;
  created_at: string;
  updated_at: string;
}

export interface NoteRow {
  id: string;
  subject_id: string;
  chapter_id: string | null;
  client_id: string | null;
  title: string;
  title_auto: number;
  note_date: string | null;
  note_date_auto: number;
  status: NoteStatus;
  stage: NoteStage | null;
  error: string | null;
  page_count: number;
  pdf_rev: number;
  remarks: string;
  chapter_auto: number;
  instructions: string | null;
  position: number;
  attempts: number;
  not_before: string | null;
  usage: string | null;
  rev: number;
  deleted: number;
  created_at: string;
  updated_at: string;
}

export interface NoteFileRow {
  id: string;
  note_id: string;
  position: number;
  original_name: string;
  mime: string;
  filename: string;
  size: number;
}

// ---------- Mapping til API-typer ----------

export function toSubject(r: SubjectRow): Subject {
  return {
    id: r.id,
    name: r.name,
    profile: r.profile as SubjectProfile,
    textbook: r.textbook,
    position: r.position,
    rev: r.rev,
    deleted: r.deleted === 1,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export function toChapter(r: ChapterRow): Chapter {
  return {
    id: r.id,
    subjectId: r.subject_id,
    number: r.number,
    title: r.title,
    position: r.position,
    rev: r.rev,
    deleted: r.deleted === 1,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

function parseRemarks(s: string): string[] {
  try {
    const v: unknown = JSON.parse(s);
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

export function toNote(r: NoteRow): Note {
  return {
    id: r.id,
    subjectId: r.subject_id,
    chapterId: r.chapter_id,
    clientId: r.client_id,
    title: r.title,
    noteDate: r.note_date,
    status: r.status,
    stage: r.stage,
    error: r.error,
    pageCount: r.page_count,
    pdfRev: r.pdf_rev,
    remarks: parseRemarks(r.remarks),
    chapterAuto: r.chapter_auto === 1,
    instructions: r.instructions,
    position: r.position,
    rev: r.rev,
    deleted: r.deleted === 1,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

const now = () => new Date().toISOString();

export interface NoteResultUpdate {
  title?: string;
  chapterId?: string | null;
  noteDate?: string | null;
  remarks: string[];
  pageCount: number;
  usage?: unknown;
}

/**
 * All databasetilgang samlet ett sted. better-sqlite3 er synkront, så hver metode er atomisk
 * i forhold til resten av JavaScript-koden.
 */
export class Repo {
  readonly db: DB;

  constructor(file: string) {
    this.db = new Database(file);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('foreign_keys = ON');
    this.db.pragma('busy_timeout = 5000');
    this.migrate();
  }

  private migrate(): void {
    const version = this.db.pragma('user_version', { simple: true }) as number;
    for (let i = version; i < MIGRATIONS.length; i++) {
      this.db.transaction(() => {
        this.db.exec(MIGRATIONS[i]!);
        this.db.pragma(`user_version = ${i + 1}`);
      })();
    }
  }

  close(): void {
    this.db.close();
  }

  /** Neste globale revisjonsnummer. Hver endring av en synkronisert rad får et nytt. */
  nextRev(): number {
    const row = this.db
      .prepare(`UPDATE meta SET value = CAST(value AS INTEGER) + 1 WHERE key = 'rev' RETURNING value`)
      .get() as { value: string | number };
    return Number(row.value);
  }

  currentRev(): number {
    const row = this.db.prepare(`SELECT value FROM meta WHERE key = 'rev'`).get() as { value: string };
    return Number(row.value);
  }

  // ---------- Synk ----------

  sync(since: number): { cursor: number; subjects: Subject[]; chapters: Chapter[]; notes: Note[] } {
    return this.db.transaction(() => {
      const cursor = this.currentRev();
      const full = since <= 0;
      const where = full ? 'deleted = 0' : 'rev > ?';
      const args = full ? [] : [since];
      const subjects = (this.db.prepare(`SELECT * FROM subjects WHERE ${where} ORDER BY rev`).all(...args) as SubjectRow[]).map(toSubject);
      const chapters = (this.db.prepare(`SELECT * FROM chapters WHERE ${where} ORDER BY rev`).all(...args) as ChapterRow[]).map(toChapter);
      const notes = (this.db.prepare(`SELECT * FROM notes WHERE ${where} ORDER BY rev`).all(...args) as NoteRow[]).map(toNote);
      return { cursor, subjects, chapters, notes };
    })();
  }

  // ---------- Fag ----------

  listSubjects(): Subject[] {
    return (this.db.prepare(`SELECT * FROM subjects WHERE deleted = 0 ORDER BY position, created_at`).all() as SubjectRow[]).map(toSubject);
  }

  getSubject(id: string): Subject | null {
    const r = this.db.prepare(`SELECT * FROM subjects WHERE id = ? AND deleted = 0`).get(id) as SubjectRow | undefined;
    return r ? toSubject(r) : null;
  }

  createSubject(input: { name: string; profile: SubjectProfile; textbook?: string | null }): Subject {
    const id = randomUUID();
    const t = now();
    const position = (this.db.prepare(`SELECT COALESCE(MAX(position), -1) + 1 AS p FROM subjects WHERE deleted = 0`).get() as { p: number }).p;
    this.db
      .prepare(
        `INSERT INTO subjects (id, name, profile, textbook, position, rev, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(id, input.name, input.profile, input.textbook ?? null, position, this.nextRev(), t, t);
    return this.getSubject(id)!;
  }

  updateSubject(id: string, patch: { name?: string; textbook?: string | null }): Subject | null {
    const s = this.getSubject(id);
    if (!s) return null;
    this.db
      .prepare(`UPDATE subjects SET name = ?, textbook = ?, rev = ?, updated_at = ? WHERE id = ?`)
      .run(patch.name ?? s.name, patch.textbook === undefined ? s.textbook : patch.textbook, this.nextRev(), now(), id);
    return this.getSubject(id);
  }

  /** Sletter faget med alle kapitler og notater (soft delete). Returnerer id-ene til slettede notater. */
  deleteSubject(id: string): string[] | null {
    if (!this.getSubject(id)) return null;
    return this.db.transaction(() => {
      const t = now();
      const noteIds = (this.db.prepare(`SELECT id FROM notes WHERE subject_id = ? AND deleted = 0`).all(id) as { id: string }[]).map((r) => r.id);
      for (const nid of noteIds) {
        this.db.prepare(`UPDATE notes SET deleted = 1, rev = ?, updated_at = ? WHERE id = ?`).run(this.nextRev(), t, nid);
      }
      const chapterIds = (this.db.prepare(`SELECT id FROM chapters WHERE subject_id = ? AND deleted = 0`).all(id) as { id: string }[]).map((r) => r.id);
      for (const cid of chapterIds) {
        this.db.prepare(`UPDATE chapters SET deleted = 1, rev = ?, updated_at = ? WHERE id = ?`).run(this.nextRev(), t, cid);
      }
      this.db.prepare(`UPDATE subjects SET deleted = 1, rev = ?, updated_at = ? WHERE id = ?`).run(this.nextRev(), t, id);
      return noteIds;
    })();
  }

  // ---------- Kapitler ----------

  listChapters(subjectId: string): Chapter[] {
    return (
      this.db.prepare(`SELECT * FROM chapters WHERE subject_id = ? AND deleted = 0 ORDER BY position, created_at`).all(subjectId) as ChapterRow[]
    ).map(toChapter);
  }

  getChapter(id: string): Chapter | null {
    const r = this.db.prepare(`SELECT * FROM chapters WHERE id = ? AND deleted = 0`).get(id) as ChapterRow | undefined;
    return r ? toChapter(r) : null;
  }

  createChapters(subjectId: string, inputs: ChapterInput[]): Chapter[] {
    return this.db.transaction(() => {
      let position = (
        this.db.prepare(`SELECT COALESCE(MAX(position), -1) + 1 AS p FROM chapters WHERE subject_id = ? AND deleted = 0`).get(subjectId) as {
          p: number;
        }
      ).p;
      const ids: string[] = [];
      for (const input of inputs) {
        const id = randomUUID();
        const t = now();
        this.db
          .prepare(
            `INSERT INTO chapters (id, subject_id, number, title, position, rev, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          )
          .run(id, subjectId, input.number, input.title, position++, this.nextRev(), t, t);
        ids.push(id);
      }
      return ids.map((id) => this.getChapter(id)!);
    })();
  }

  updateChapter(id: string, patch: { number?: string | null; title?: string }): Chapter | null {
    const c = this.getChapter(id);
    if (!c) return null;
    this.db
      .prepare(`UPDATE chapters SET number = ?, title = ?, rev = ?, updated_at = ? WHERE id = ?`)
      .run(patch.number === undefined ? c.number : patch.number, patch.title ?? c.title, this.nextRev(), now(), id);
    return this.getChapter(id);
  }

  /** Sletter kapittelet; notatene i det blir «uten kapittel». */
  deleteChapter(id: string): boolean {
    if (!this.getChapter(id)) return false;
    this.db.transaction(() => {
      const t = now();
      const noteIds = (this.db.prepare(`SELECT id FROM notes WHERE chapter_id = ? AND deleted = 0`).all(id) as { id: string }[]).map((r) => r.id);
      for (const nid of noteIds) {
        this.db.prepare(`UPDATE notes SET chapter_id = NULL, rev = ?, updated_at = ? WHERE id = ?`).run(this.nextRev(), t, nid);
      }
      this.db.prepare(`UPDATE chapters SET deleted = 1, rev = ?, updated_at = ? WHERE id = ?`).run(this.nextRev(), t, id);
    })();
    return true;
  }

  reorderChapters(subjectId: string, ids: string[]): void {
    this.db.transaction(() => {
      const t = now();
      ids.forEach((id, i) => {
        this.db
          .prepare(`UPDATE chapters SET position = ?, rev = ?, updated_at = ? WHERE id = ? AND subject_id = ? AND deleted = 0`)
          .run(i, this.nextRev(), t, id, subjectId);
      });
    })();
  }

  // ---------- Notater ----------

  getNoteRow(id: string): NoteRow | null {
    return (this.db.prepare(`SELECT * FROM notes WHERE id = ? AND deleted = 0`).get(id) as NoteRow | undefined) ?? null;
  }

  getNote(id: string): Note | null {
    const r = this.getNoteRow(id);
    return r ? toNote(r) : null;
  }

  getNoteByClientId(clientId: string): Note | null {
    const r = this.db.prepare(`SELECT * FROM notes WHERE client_id = ?`).get(clientId) as NoteRow | undefined;
    return r ? toNote(r) : null;
  }

  createNote(input: {
    id: string;
    subjectId: string;
    chapterId: string | null;
    chapterAuto: boolean;
    clientId: string | null;
    title: string | null;
    noteDate: string | null;
    instructions: string | null;
    files: Omit<NoteFileRow, 'note_id'>[];
  }): Note {
    this.db.transaction(() => {
      const t = now();
      this.db
        .prepare(
          `INSERT INTO notes (id, subject_id, chapter_id, client_id, title, title_auto, note_date, note_date_auto, status,
             page_count, chapter_auto, instructions, rev, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'queued', ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          input.id,
          input.subjectId,
          input.chapterId,
          input.clientId,
          input.title ?? '',
          input.title ? 0 : 1,
          input.noteDate,
          input.noteDate ? 0 : 1,
          input.files.length,
          input.chapterAuto ? 1 : 0,
          input.instructions,
          this.nextRev(),
          t,
          t,
        );
      for (const f of input.files) {
        this.db
          .prepare(`INSERT INTO note_files (id, note_id, position, original_name, mime, filename, size) VALUES (?, ?, ?, ?, ?, ?, ?)`)
          .run(f.id, input.id, f.position, f.original_name, f.mime, f.filename, f.size);
      }
    })();
    return this.getNote(input.id)!;
  }

  noteFiles(noteId: string): NoteFileRow[] {
    return this.db.prepare(`SELECT * FROM note_files WHERE note_id = ? ORDER BY position`).all(noteId) as NoteFileRow[];
  }

  updateNoteUser(id: string, patch: { title?: string; chapterId?: string | null; noteDate?: string | null }): Note | null {
    const r = this.getNoteRow(id);
    if (!r) return null;
    const title = patch.title !== undefined ? patch.title : r.title;
    const titleAuto = patch.title !== undefined ? 0 : r.title_auto;
    const chapterId = patch.chapterId !== undefined ? patch.chapterId : r.chapter_id;
    const chapterAuto = patch.chapterId !== undefined ? 0 : r.chapter_auto;
    const noteDate = patch.noteDate !== undefined ? patch.noteDate : r.note_date;
    const noteDateAuto = patch.noteDate !== undefined ? (patch.noteDate ? 0 : 1) : r.note_date_auto;
    this.db
      .prepare(
        `UPDATE notes SET title = ?, title_auto = ?, chapter_id = ?, chapter_auto = ?, note_date = ?, note_date_auto = ?, rev = ?, updated_at = ? WHERE id = ?`,
      )
      .run(title, titleAuto, chapterId, chapterAuto, noteDate, noteDateAuto, this.nextRev(), now(), id);
    return this.getNote(id);
  }

  deleteNote(id: string): boolean {
    const res = this.db.prepare(`UPDATE notes SET deleted = 1, rev = ?, updated_at = ? WHERE id = ? AND deleted = 0`).run(this.nextRev(), now(), id);
    return res.changes > 0;
  }

  /** Neste notat som skal konverteres, eller null. */
  claimNextQueued(): NoteRow | null {
    return this.db.transaction(() => {
      const r = this.db
        .prepare(
          `SELECT * FROM notes WHERE status = 'queued' AND deleted = 0 AND (not_before IS NULL OR not_before <= ?)
           ORDER BY created_at LIMIT 1`,
        )
        .get(now()) as NoteRow | undefined;
      if (!r) return null;
      this.db
        .prepare(`UPDATE notes SET status = 'processing', stage = 'preparing', error = NULL, attempts = attempts + 1, rev = ?, updated_at = ? WHERE id = ?`)
        .run(this.nextRev(), now(), r.id);
      return this.getNoteRow(r.id);
    })();
  }

  setStage(id: string, stage: NoteStage): void {
    this.db.prepare(`UPDATE notes SET stage = ?, rev = ?, updated_at = ? WHERE id = ? AND deleted = 0`).run(stage, this.nextRev(), now(), id);
  }

  setPageCount(id: string, pageCount: number): void {
    this.db.prepare(`UPDATE notes SET page_count = ?, rev = ?, updated_at = ? WHERE id = ? AND deleted = 0`).run(pageCount, this.nextRev(), now(), id);
  }

  /**
   * Lagrer resultatet av en konvertering. Felter som brukeren har satt selv, overstyres ikke.
   * Med done=false lagres bare metadata (brukes når LaTeX-koden ikke kompilerte).
   */
  completeNote(id: string, result: NoteResultUpdate, opts: { done: boolean } = { done: true }): Note | null {
    const r = this.getNoteRow(id);
    if (!r) return null;
    const title = r.title_auto === 1 && result.title ? result.title : r.title;
    const chapterId = r.chapter_auto === 1 && result.chapterId !== undefined ? result.chapterId : r.chapter_id;
    const noteDate = r.note_date_auto === 1 && result.noteDate !== undefined ? result.noteDate : r.note_date;
    this.db
      .prepare(
        opts.done
          ? `UPDATE notes SET status = 'done', stage = NULL, error = NULL, not_before = NULL, attempts = 0, title = ?, chapter_id = ?, note_date = ?,
               remarks = ?, page_count = ?, pdf_rev = pdf_rev + 1, usage = ?, rev = ?, updated_at = ? WHERE id = ?`
          : `UPDATE notes SET title = ?, chapter_id = ?, note_date = ?, remarks = ?, page_count = ?, usage = ?, rev = ?, updated_at = ? WHERE id = ?`,
      )
      .run(
        title,
        chapterId,
        noteDate,
        JSON.stringify(result.remarks),
        result.pageCount,
        result.usage === undefined ? r.usage : JSON.stringify(result.usage),
        this.nextRev(),
        now(),
        id,
      );
    return this.getNote(id);
  }

  /** Etter at brukeren har redigert LaTeX og den kompilerte. */
  bumpPdf(id: string): Note | null {
    this.db
      .prepare(`UPDATE notes SET status = 'done', stage = NULL, error = NULL, pdf_rev = pdf_rev + 1, rev = ?, updated_at = ? WHERE id = ? AND deleted = 0`)
      .run(this.nextRev(), now(), id);
    return this.getNote(id);
  }

  /** PDF-en lages på nytt etter endret tittel/dato/kapittel. Status forblir «done», men stage viser arbeidet. */
  markRecompiling(id: string): void {
    this.db
      .prepare(`UPDATE notes SET stage = 'compiling', rev = ?, updated_at = ? WHERE id = ? AND status = 'done' AND deleted = 0`)
      .run(this.nextRev(), now(), id);
  }

  bumpPdfIfDone(id: string): void {
    this.db
      .prepare(`UPDATE notes SET stage = NULL, pdf_rev = pdf_rev + 1, rev = ?, updated_at = ? WHERE id = ? AND status = 'done' AND deleted = 0`)
      .run(this.nextRev(), now(), id);
  }

  finishRecompileWithoutChange(id: string): void {
    this.db
      .prepare(`UPDATE notes SET stage = NULL, rev = ?, updated_at = ? WHERE id = ? AND status = 'done' AND deleted = 0`)
      .run(this.nextRev(), now(), id);
  }

  failNote(id: string, message: string): void {
    this.db
      .prepare(`UPDATE notes SET status = 'failed', stage = NULL, error = ?, not_before = NULL, rev = ?, updated_at = ? WHERE id = ? AND deleted = 0`)
      .run(message, this.nextRev(), now(), id);
  }

  /** Midlertidig feil (f.eks. Claude overbelastet): legg tilbake i køen og prøv senere. */
  requeueLater(id: string, notBefore: Date, message: string): void {
    this.db
      .prepare(`UPDATE notes SET status = 'queued', stage = NULL, error = ?, not_before = ?, rev = ?, updated_at = ? WHERE id = ? AND deleted = 0`)
      .run(message, notBefore.toISOString(), this.nextRev(), now(), id);
  }

  /** Brukeren ber om ny konvertering. */
  requeue(id: string, instructions: string | null | undefined): Note | null {
    const r = this.getNoteRow(id);
    if (!r) return null;
    this.db
      .prepare(
        `UPDATE notes SET status = 'queued', stage = NULL, error = NULL, not_before = NULL, attempts = 0, instructions = ?, rev = ?, updated_at = ? WHERE id = ?`,
      )
      .run(instructions === undefined ? r.instructions : instructions, this.nextRev(), now(), id);
    return this.getNote(id);
  }

  /** Ved oppstart: notater som var midt i en konvertering da serveren stoppet, legges tilbake i køen. */
  resetInterrupted(): number {
    const rows = this.db.prepare(`SELECT id FROM notes WHERE status = 'processing' AND deleted = 0`).all() as { id: string }[];
    for (const { id } of rows) {
      this.db.prepare(`UPDATE notes SET status = 'queued', stage = NULL, rev = ?, updated_at = ? WHERE id = ?`).run(this.nextRev(), now(), id);
    }
    // Avbrutte rekompileringer: forrige PDF er fortsatt gyldig.
    const stale = this.db.prepare(`SELECT id FROM notes WHERE status = 'done' AND stage IS NOT NULL AND deleted = 0`).all() as { id: string }[];
    for (const { id } of stale) this.finishRecompileWithoutChange(id);
    return rows.length;
  }

  hasQueued(): boolean {
    return !!this.db.prepare(`SELECT 1 FROM notes WHERE status = 'queued' AND deleted = 0 LIMIT 1`).get();
  }

  /** Ferdige notater i et kapittel (eller hele faget), sortert for samle-PDF. */
  doneNotes(filter: { chapterId: string } | { subjectId: string }): NoteRow[] {
    const col = 'chapterId' in filter ? 'chapter_id' : 'subject_id';
    const val = 'chapterId' in filter ? filter.chapterId : filter.subjectId;
    return this.db
      .prepare(
        `SELECT * FROM notes WHERE ${col} = ? AND deleted = 0 AND status = 'done' AND pdf_rev > 0
         ORDER BY CASE WHEN note_date IS NULL THEN 1 ELSE 0 END, note_date, created_at`,
      )
      .all(val) as NoteRow[];
  }

  // ---------- Innloggingsøkter ----------

  createSession(tokenHash: string, expiresAt: Date, userAgent: string | null): void {
    this.db
      .prepare(`INSERT INTO sessions (token_hash, created_at, expires_at, user_agent) VALUES (?, ?, ?, ?)`)
      .run(tokenHash, now(), expiresAt.toISOString(), userAgent);
  }

  validSession(tokenHash: string): boolean {
    return !!this.db.prepare(`SELECT 1 FROM sessions WHERE token_hash = ? AND expires_at > ?`).get(tokenHash, now());
  }

  deleteSession(tokenHash: string): void {
    this.db.prepare(`DELETE FROM sessions WHERE token_hash = ?`).run(tokenHash);
  }

  pruneSessions(): void {
    this.db.prepare(`DELETE FROM sessions WHERE expires_at <= ?`).run(now());
  }

  /** Første oppstart: opprett faget Fysikk. */
  seed(): void {
    const count = (this.db.prepare(`SELECT COUNT(*) AS n FROM subjects`).get() as { n: number }).n;
    if (count === 0) {
      this.createSubject({ name: 'Fysikk', profile: 'physics', textbook: null });
    }
  }
}
