// Felles typer for API-kontrakten mellom server og web-app.
// Kun typer her – ingen kjørbar kode – slik at begge sider kan importere med `import type`.

/** Fagprofil styrer LaTeX-mal og instruksjoner til Claude. Foreløpig bare fysikk. */
/** Fagprofil: bestemmer instruksene til Claude, LaTeX-malen og fargetemaet i appen. */
export type SubjectProfile = 'physics' | 'chemistry' | 'biology';

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

/** Kompetansemål fra læreplanen, f.eks. KM5 i Fysikk 1 (FYS01-02). */
export interface CompetenceAim {
  /** Kort kode, f.eks. «KM5». */
  code: string;
  /** Målet slik det står i læreplanen («forstå sammenhenger mellom krefter …»). */
  text: string;
  /** Mål som går på tvers av kapitlene (metamål), f.eks. forsøk og modellering. */
  cross: boolean;
}

/** Delkapittel i læreboka, f.eks. «2E Newtons 2. lov». */
export interface Section {
  /** Kode slik den står i boka, f.eks. «2E». Unik innen faget. */
  code: string;
  title: string;
  /** Koder for kompetansemålene delkapittelet dekker, f.eks. ["KM5"]. */
  aims: string[];
}

export interface Subject extends SyncedRow {
  name: string;
  profile: SubjectProfile;
  /** Lærebok/emne, f.eks. «Ergo Fysikk 1» eller «FYS-MEK1110». Gis til Claude som kontekst. */
  textbook: string | null;
  position: number;
  /** Kompetansemålene i faget (tom liste hvis ikke lagt inn). */
  aims: CompetenceAim[];
}

export interface Chapter extends SyncedRow {
  subjectId: string;
  /** Kapittelnummer slik det står i læreboka, f.eks. «3» eller «3.2». */
  number: string | null;
  title: string;
  position: number;
  /** Delkapitlene i rekkefølge (tom liste hvis ikke lagt inn). */
  sections: Section[];
}

export interface Note extends SyncedRow {
  subjectId: string;
  /** null = «Uten kapittel» (ikke sortert ennå). */
  chapterId: string | null;
  /** Kode for delkapittelet i kapittelet, f.eks. «2E», eller null. Kompetansemålene følger av delkapittelet. */
  section: string | null;
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
  /** Ren tekst fra notatet (uten LaTeX-kommandoer), for søk – også offline. */
  searchText: string;
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
  /** Delkapitlene, hvis innholdsfortegnelsen har dem (f.eks. «2.1», «2.2» eller «2A», «2B»). */
  sections?: Section[];
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

/**
 * Svar fra /chapters/parse og /chapters/extract (bilde). Lagres ikke før /bulk (nye kapitler) eller PATCH (kapitler som
 * finnes fra før og får nye delkapitler). Har faget kompetansemål, kobler Claude hvert delkapittel til målene det dekker.
 */
export interface ChapterPreviewResponse {
  chapters: ChapterInput[];
}

export interface UpdateChapterRequest {
  number?: string | null;
  title?: string;
  sections?: Section[];
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
  /** Flytter notatet. Delkapittelet nullstilles hvis `section` ikke sendes samtidig. */
  chapterId?: string | null;
  /** Kode for et delkapittel i notatets (nye) kapittel, eller null. */
  section?: string | null;
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
