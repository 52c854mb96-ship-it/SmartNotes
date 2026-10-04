// Felles typer for API-kontrakten mellom server og web-app.
// Kun typer her – ingen kjørbar kode – slik at begge sider kan importere med `import type`.

/** Fagprofil styrer LaTeX-mal og instruksjoner til Claude. Foreløpig bare fysikk. */
export type SubjectProfile = 'physics';

/**
 * Livssyklus for et notat på serveren:
 *  queued      – lastet opp, venter på konvertering
 *  processing  – Claude leser/LaTeX kompileres (se `stage`)
 *  done        – PDF er klar
 *  failed      – konvertering feilet (se `error`), kan prøves igjen
 */
export type NoteStatus = 'queued' | 'processing' | 'done' | 'failed';

/** Detaljert steg mens status er `processing`. */
export type NoteStage = 'preparing' | 'reading' | 'compiling' | 'fixing';

/** Felter alle synkroniserte rader har. */
export interface SyncedRow {
  id: string;
  /** Global, strengt økende versjon. Brukes som synk-markør. */
  rev: number;
  /** Soft delete – slettede rader sendes som «gravsteiner» ved inkrementell synk. */
  deleted: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Subject extends SyncedRow {
  name: string;
  profile: SubjectProfile;
  /** Lærebok/emne, f.eks. «Ergo Fysikk 1» eller «FYS-MEK1110». Gis til Claude som kontekst. */
  textbook: string | null;
  position: number;
}

export interface Chapter extends SyncedRow {
  subjectId: string;
  /** Kapittelnummer slik det står i læreboka, f.eks. «3» eller «3.2». */
  number: string | null;
  title: string;
  position: number;
}

export interface Note extends SyncedRow {
  subjectId: string;
  /** null = «Uten kapittel» (ikke sortert ennå). */
  chapterId: string | null;
  /** Klient-generert UUID for idempotent opplasting fra offline-køen. */
  clientId: string | null;
  title: string;
  /** Dato for forelesningen/notatet (YYYY-MM-DD) hvis kjent. */
  noteDate: string | null;
  status: NoteStatus;
  stage: NoteStage | null;
  /** Feilmelding på norsk når status er `failed`. */
  error: string | null;
  pageCount: number;
  /** Øker for hver vellykket kompilering. 0 = ingen PDF ennå. Brukes for cache. */
  pdfRev: number;
  /** Merknader fra Claude, f.eks. om uleselige ord eller mulige regnefeil. */
  remarks: string[];
  /** Kapittelet ble valgt av Claude (true) eller av brukeren (false). */
  chapterAuto: boolean;
  /** Ekstra instruksjoner brukeren ga ved opplasting. */
  instructions: string | null;
  position: number;
}

// ---------- Auth ----------

export interface LoginRequest {
  password: string;
}

export interface MeResponse {
  authenticated: boolean;
}

// ---------- Synk ----------

/** GET /api/sync?since=<rev> */
export interface SyncResponse {
  /** Høyeste rev serveren kjenner til. Send som `since` neste gang. */
  cursor: number;
  /** true når `since` var 0 – klienten bør erstatte alt lokalt. */
  full: boolean;
  subjects: Subject[];
  chapters: Chapter[];
  notes: Note[];
}

// ---------- Fag og kapitler ----------

export interface CreateSubjectRequest {
  name: string;
  profile: SubjectProfile;
  textbook?: string | null;
}

export interface UpdateSubjectRequest {
  name?: string;
  textbook?: string | null;
}

export interface ChapterInput {
  number: string | null;
  title: string;
}

export interface CreateChapterRequest extends ChapterInput {}

/** POST /api/subjects/:id/chapters/bulk – legger til flere kapitler på slutten. */
export interface BulkChaptersRequest {
  chapters: ChapterInput[];
}

/** POST /api/subjects/:id/chapters/parse – tolker innlimt innholdsfortegnelse (tekst). */
export interface ParseChaptersRequest {
  text: string;
}

/** Svar fra /chapters/parse og /chapters/extract (bilde). Lagres ikke før /bulk. */
export interface ChapterPreviewResponse {
  chapters: ChapterInput[];
}

export interface UpdateChapterRequest {
  number?: string | null;
  title?: string;
}

/** POST /api/subjects/:id/chapters/reorder */
export interface ReorderRequest {
  ids: string[];
}

// ---------- Notater ----------

/**
 * POST /api/notes  (multipart/form-data)
 *  felter: subjectId, clientId, chapterId ('auto' eller kapittel-id), title?, noteDate?, instructions?
 *  filer:  `files` (én eller flere, bilder og/eller PDF) i riktig rekkefølge
 * Svarer med `Note`. Samme clientId to ganger gir samme notat tilbake (idempotent).
 */

export interface UpdateNoteRequest {
  title?: string;
  chapterId?: string | null;
  noteDate?: string | null;
}

export interface RetryNoteRequest {
  instructions?: string | null;
}

export interface NoteLatexResponse {
  /** Dokumentkroppen (det Claude skrev / brukeren redigerer). */
  body: string;
}

export interface SaveLatexRequest {
  body: string;
}

export interface SaveLatexResponse {
  ok: boolean;
  note: Note;
  /** Kompileringsfeil (utdrag fra loggen) hvis ok=false. PDF-en er da uendret. */
  error?: string;
}

export interface NotePage {
  index: number;
  width: number;
  height: number;
}

export interface NotePagesResponse {
  pages: NotePage[];
}

// ---------- Diverse ----------

export interface HealthResponse {
  ok: boolean;
  version: string;
  latex: boolean;
  claudeConfigured: boolean;
  model: string;
  fakeClaude: boolean;
}

export interface ApiError {
  error: string;
  /** Norsk, brukervennlig melding. */
  message: string;
}
