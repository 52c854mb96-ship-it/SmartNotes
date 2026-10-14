import Database from 'better-sqlite3';
import { randomUUID } from 'node:crypto';
import type {
  Chapter,
  ChapterInput,
  CompetenceAim,
  ComparisonStatus,
  ComparisonVerdict,
  Deck,
  DeckChoicesStatus,
  DeckStatus,
  Flashcard,
  FlashcardChoices,
  FlashcardDifficulty,
  FlashcardInput,
  FlashcardKind,
  Note,
  NoteComparison,
  NoteStage,
  NoteStatus,
  Section,
  Subject,
  SubjectProfile,
  UsageKind,
} from '@smartnotes/shared';
import type { UsageEntry } from './usage.js';

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
  // 2: delkapitler, kompetansemål og søketekst
  `
  ALTER TABLE subjects ADD COLUMN aims TEXT NOT NULL DEFAULT '[]';
  ALTER TABLE chapters ADD COLUMN sections TEXT NOT NULL DEFAULT '[]';
  ALTER TABLE notes ADD COLUMN section TEXT;
  ALTER TABLE notes ADD COLUMN section_auto INTEGER NOT NULL DEFAULT 1;
  ALTER TABLE notes ADD COLUMN search_text TEXT NOT NULL DEFAULT '';
  `,
  // 3: flashcards – kortstokker og kort med mestringsnivå
  `
  CREATE TABLE decks (
    id TEXT PRIMARY KEY,
    subject_id TEXT NOT NULL REFERENCES subjects(id),
    title TEXT NOT NULL,
    difficulty TEXT NOT NULL,
    note_ids TEXT NOT NULL DEFAULT '[]',
    requested_count INTEGER,
    status TEXT NOT NULL,
    error TEXT,
    best INTEGER NOT NULL DEFAULT 0,
    usage TEXT,
    rev INTEGER NOT NULL,
    deleted INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE INDEX decks_rev ON decks(rev);
  CREATE INDEX decks_subject ON decks(subject_id);
  CREATE INDEX decks_status ON decks(status);

  CREATE TABLE cards (
    id TEXT PRIMARY KEY,
    deck_id TEXT NOT NULL REFERENCES decks(id),
    note_id TEXT,
    kind TEXT NOT NULL,
    front TEXT NOT NULL,
    back TEXT NOT NULL DEFAULT '[]',
    detail TEXT NOT NULL DEFAULT '',
    position INTEGER NOT NULL DEFAULT 0,
    level INTEGER NOT NULL DEFAULT 0,
    level_at TEXT,
    rev INTEGER NOT NULL,
    deleted INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE INDEX cards_rev ON cards(rev);
  CREATE INDEX cards_deck ON cards(deck_id);
  `,
  // Forbrukslogg: én rad per AI-kall. Bare på serveren (synkroniseres ikke), så den trenger ingen rev.
  `
  CREATE TABLE usage_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    at INTEGER NOT NULL,
    kind TEXT NOT NULL,
    provider TEXT NOT NULL,
    model TEXT NOT NULL,
    input_tokens INTEGER NOT NULL DEFAULT 0,
    output_tokens INTEGER NOT NULL DEFAULT 0,
    cache_read_tokens INTEGER NOT NULL DEFAULT 0,
    cache_write_tokens INTEGER NOT NULL DEFAULT 0,
    duration_ms INTEGER NOT NULL DEFAULT 0,
    ok INTEGER NOT NULL,
    error TEXT,
    note_id TEXT,
    deck_id TEXT,
    subject_id TEXT
  );
  CREATE INDEX usage_log_at ON usage_log(at);
  `,
  // Sammenligning: notatet konvertert på nytt med en annen modell (Haiku), ved siden av den vanlige versjonen.
  // Ett resultat per notat. Bare på serveren (synkroniseres ikke), så den trenger ingen rev.
  `
  CREATE TABLE note_comparisons (
    note_id TEXT PRIMARY KEY,
    model TEXT NOT NULL,
    base_model TEXT,
    base_pdf_rev INTEGER NOT NULL,
    status TEXT NOT NULL,
    stage TEXT,
    error TEXT,
    page_count INTEGER NOT NULL DEFAULT 0,
    remarks TEXT NOT NULL DEFAULT '[]',
    cost_usd REAL,
    spent_usd REAL NOT NULL DEFAULT 0,
    verdict TEXT,
    comment TEXT,
    created_at TEXT NOT NULL,
    finished_at TEXT,
    rated_at TEXT
  );
  `,
  // Instruksversjonen bak hver sammenligning, og en logg med elevens vurdering per notat og versjon, så Innstillinger
  // kan vise om nye instrukser for Haiku hjelper. Vurderingene som finnes, ble gjort med versjon 1.
  `
  ALTER TABLE note_comparisons ADD COLUMN prompt_version INTEGER NOT NULL DEFAULT 1;
  CREATE TABLE comparison_ratings (
    note_id TEXT NOT NULL,
    prompt_version INTEGER NOT NULL,
    verdict TEXT NOT NULL,
    comment TEXT,
    rated_at TEXT NOT NULL,
    PRIMARY KEY (note_id, prompt_version)
  );
  INSERT INTO comparison_ratings (note_id, prompt_version, verdict, comment, rated_at)
    SELECT note_id, 1, verdict, comment, rated_at FROM note_comparisons WHERE verdict IS NOT NULL AND rated_at IS NOT NULL;
  `,
  // 7: kontoer. Eieren er bruker 1 og får alt som finnes. Brukerdata får user_id (NOT NULL DEFAULT 1, uten fremmednøkkel:
  // SQLite tillater ikke en fremmednøkkel med en annen standardverdi enn NULL i ALTER TABLE, og en rad som en eldre
  // versjon av serveren skriver etter en tilbakerulling, tilhører da eieren, den eneste som kan logge inn der).
  // Innloggingene flyttes til user_sessions, så en eldre versjon bare ser eierens økter fra før kontoene.
  // En rad bytter aldri eier (triggerne), så den globale rev-cursoren i synken holder per bruker.
  `
  CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT,
    plan TEXT NOT NULL,
    disabled INTEGER NOT NULL DEFAULT 0,
    failed_logins INTEGER NOT NULL DEFAULT 0,
    failed_since TEXT,
    locked_until TEXT,
    age_confirmed_at TEXT,
    terms_accepted_at TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    last_login_at TEXT
  );
  INSERT INTO users (id, username, password_hash, plan, created_at, updated_at)
    VALUES (1, 'eier', NULL, 'owner', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));

  CREATE TABLE user_sessions (
    token_hash TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL,
    created_at TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    user_agent TEXT
  );
  CREATE INDEX user_sessions_user ON user_sessions(user_id);
  INSERT INTO user_sessions (token_hash, user_id, created_at, expires_at, user_agent)
    SELECT token_hash, 1, created_at, expires_at, user_agent FROM sessions;

  CREATE TABLE user_devices (
    token_hash TEXT NOT NULL,
    user_id INTEGER NOT NULL,
    created_at TEXT NOT NULL,
    last_used_at TEXT NOT NULL,
    PRIMARY KEY (token_hash, user_id)
  );
  CREATE INDEX user_devices_user ON user_devices(user_id);

  CREATE TABLE invites (
    id TEXT PRIMARY KEY,
    code_hash TEXT NOT NULL UNIQUE,
    code_hint TEXT NOT NULL,
    created_by INTEGER NOT NULL,
    created_at TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    used_at TEXT,
    used_by INTEGER,
    revoked_at TEXT
  );

  CREATE TABLE password_resets (
    token_hash TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL,
    created_at TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    used_at TEXT,
    revoked_at TEXT
  );
  CREATE INDEX password_resets_user ON password_resets(user_id);

  ALTER TABLE subjects ADD COLUMN user_id INTEGER NOT NULL DEFAULT 1;
  ALTER TABLE chapters ADD COLUMN user_id INTEGER NOT NULL DEFAULT 1;
  ALTER TABLE notes ADD COLUMN user_id INTEGER NOT NULL DEFAULT 1;
  ALTER TABLE decks ADD COLUMN user_id INTEGER NOT NULL DEFAULT 1;
  ALTER TABLE cards ADD COLUMN user_id INTEGER NOT NULL DEFAULT 1;
  ALTER TABLE note_comparisons ADD COLUMN user_id INTEGER NOT NULL DEFAULT 1;
  ALTER TABLE comparison_ratings ADD COLUMN user_id INTEGER NOT NULL DEFAULT 1;
  ALTER TABLE usage_log ADD COLUMN user_id INTEGER NOT NULL DEFAULT 1;
  ALTER TABLE usage_log ADD COLUMN pages INTEGER;

  CREATE INDEX subjects_user_rev ON subjects(user_id, rev);
  CREATE INDEX chapters_user_rev ON chapters(user_id, rev);
  CREATE INDEX notes_user_rev ON notes(user_id, rev);
  CREATE INDEX decks_user_rev ON decks(user_id, rev);
  CREATE INDEX cards_user_rev ON cards(user_id, rev);
  CREATE INDEX note_comparisons_user ON note_comparisons(user_id);
  CREATE INDEX usage_log_user_at ON usage_log(user_id, at);

  CREATE TRIGGER subjects_owner_fixed BEFORE UPDATE OF user_id ON subjects BEGIN SELECT RAISE(ABORT, 'user_id kan ikke endres'); END;
  CREATE TRIGGER chapters_owner_fixed BEFORE UPDATE OF user_id ON chapters BEGIN SELECT RAISE(ABORT, 'user_id kan ikke endres'); END;
  CREATE TRIGGER notes_owner_fixed BEFORE UPDATE OF user_id ON notes BEGIN SELECT RAISE(ABORT, 'user_id kan ikke endres'); END;
  CREATE TRIGGER decks_owner_fixed BEFORE UPDATE OF user_id ON decks BEGIN SELECT RAISE(ABORT, 'user_id kan ikke endres'); END;
  CREATE TRIGGER cards_owner_fixed BEFORE UPDATE OF user_id ON cards BEGIN SELECT RAISE(ABORT, 'user_id kan ikke endres'); END;
  `,
  // 8: kvoter for gratisbrukerne. `quota_log` teller det som er brukt (sider når en konvertering starter, kortstokker og
  // innholdsfortegnelser med AI). Bare på serveren (synkroniseres ikke). `last_claim_rev` gjør køen rettferdig: neste
  // notat tas fra brukeren som har ventet lengst siden forrige tur (rev-telleren, som aldri står stille).
  `
  CREATE TABLE quota_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    kind TEXT NOT NULL,
    amount INTEGER NOT NULL,
    at INTEGER NOT NULL,
    ref TEXT
  );
  CREATE INDEX quota_log_user_kind_at ON quota_log(user_id, kind, at);
  ALTER TABLE users ADD COLUMN last_claim_rev INTEGER NOT NULL DEFAULT 0;
  `,
  // 9: flervalg. Et kort kan ha svaralternativer (JSON {correct, wrong}, eller NULL). En kortstokk husker om eleven ba om
  // alternativer da den ble laget (`with_choices`, bare på serveren, som `requested_count`), og har en status for jobben
  // som lager alternativer til en kortstokk som finnes (`choices_status` 'generating' | 'failed' | NULL, med feilmelding).
  // `choices_declined` = 1 når AI-en har fått kortet uten å gi brukbare alternativer (f.eks. et langt svar): det sendes
  // ikke på nytt før spørsmålet, svaret eller korttypen endres, eller eleven skriver eller fjerner alternativer selv.
  // Ingen rader endres, så rev står stille; appen synker alt på nytt (Dexie versjon 5) for å få de nye feltene.
  `
  ALTER TABLE cards ADD COLUMN choices TEXT;
  ALTER TABLE cards ADD COLUMN choices_declined INTEGER NOT NULL DEFAULT 0;
  ALTER TABLE decks ADD COLUMN with_choices INTEGER NOT NULL DEFAULT 0;
  ALTER TABLE decks ADD COLUMN choices_status TEXT;
  ALTER TABLE decks ADD COLUMN choices_error TEXT;
  `,
];

/** Eieren av appen (eleven): bruker 1, som fikk alle data da kontoene kom (migrering 7). */
export const OWNER_ID = 1;

export type UserPlan = 'owner' | 'free' | 'pro';

export interface UserRow {
  id: number;
  username: string;
  password_hash: string | null;
  plan: UserPlan;
  disabled: number;
  failed_logins: number;
  failed_since: string | null;
  locked_until: string | null;
  age_confirmed_at: string | null;
  terms_accepted_at: string | null;
  created_at: string;
  updated_at: string;
  last_login_at: string | null;
  last_claim_rev: number;
}

/** Det gratisbrukerne har tak på per døgn. */
export type QuotaKind = 'pages' | 'decks' | 'toc';

export interface InviteRow {
  id: string;
  code_hash: string;
  code_hint: string;
  created_by: number;
  created_at: string;
  expires_at: string;
  used_at: string | null;
  used_by: number | null;
  revoked_at: string | null;
}

/** Et fagoppsett slik databasen trenger det (se `SubjectPreset` i presets.ts). */
export interface PresetInput {
  id: string;
  /** Tidligere id-er for samme oppsett (et oppsett som er lagt inn under en av dem, legges ikke inn på nytt). */
  aliases?: string[];
  subjectName: string;
  profile: SubjectProfile;
  aims: CompetenceAim[];
  chapters: (ChapterInput & { sections: Section[] })[];
}

function isUniqueViolation(err: unknown): boolean {
  return (err as { code?: string }).code === 'SQLITE_CONSTRAINT_UNIQUE' || (err as { code?: string }).code === 'SQLITE_CONSTRAINT_PRIMARYKEY';
}

// ---------- Rad-typer (slik de ligger i SQLite) ----------

interface SubjectRow {
  id: string;
  user_id: number;
  name: string;
  profile: string;
  textbook: string | null;
  position: number;
  aims: string;
  rev: number;
  deleted: number;
  created_at: string;
  updated_at: string;
}

interface ChapterRow {
  id: string;
  user_id: number;
  subject_id: string;
  number: string | null;
  title: string;
  position: number;
  sections: string;
  rev: number;
  deleted: number;
  created_at: string;
  updated_at: string;
}

export interface NoteRow {
  id: string;
  user_id: number;
  subject_id: string;
  chapter_id: string | null;
  section: string | null;
  section_auto: number;
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
  search_text: string;
  rev: number;
  deleted: number;
  created_at: string;
  updated_at: string;
}

export interface DeckRow {
  id: string;
  user_id: number;
  subject_id: string;
  title: string;
  difficulty: FlashcardDifficulty;
  note_ids: string;
  requested_count: number | null;
  status: DeckStatus;
  error: string | null;
  best: number;
  usage: string | null;
  /** 1 når eleven ba om svaralternativer da kortstokken ble laget (migrering 9). */
  with_choices: number;
  choices_status: DeckChoicesStatus | null;
  choices_error: string | null;
  rev: number;
  deleted: number;
  created_at: string;
  updated_at: string;
}

interface CardRow {
  id: string;
  user_id: number;
  deck_id: string;
  note_id: string | null;
  kind: FlashcardKind;
  front: string;
  back: string;
  detail: string;
  position: number;
  level: number;
  level_at: string | null;
  /** JSON `FlashcardChoices`, eller NULL (migrering 9). */
  choices: string | null;
  /** 1 når AI-en har fått kortet uten å gi brukbare svaralternativer (migrering 9). */
  choices_declined: number;
  rev: number;
  deleted: number;
  created_at: string;
  updated_at: string;
}

interface UsageLogRow {
  at: number;
  user_id: number;
  pages: number | null;
  kind: string;
  provider: string;
  model: string;
  input_tokens: number;
  output_tokens: number;
  cache_read_tokens: number;
  cache_write_tokens: number;
  duration_ms: number;
  ok: number;
  error: string | null;
  note_id: string | null;
  deck_id: string | null;
  subject_id: string | null;
}

export interface ComparisonRow {
  note_id: string;
  user_id: number;
  model: string;
  base_model: string | null;
  base_pdf_rev: number;
  status: ComparisonStatus;
  stage: NoteComparison['stage'];
  error: string | null;
  page_count: number;
  remarks: string;
  /** Kostnaden for siste kjøring. */
  cost_usd: number | null;
  /** Alt kjøringene for dette notatet har kostet, også de som er erstattet eller avbrutt. */
  spent_usd: number;
  /** Versjonen av instruksene kjøringen brukte (`PROMPT_VERSION` i `profiles/precise.ts`). */
  prompt_version: number;
  verdict: ComparisonVerdict | null;
  comment: string | null;
  created_at: string;
  finished_at: string | null;
  rated_at: string | null;
}

export function toComparison(r: ComparisonRow, notePdfRev: number, usdNok: number, currentPromptVersion: number): NoteComparison {
  return {
    noteId: r.note_id,
    model: r.model,
    promptVersion: r.prompt_version,
    promptOutdated: r.prompt_version < currentPromptVersion,
    baseModel: r.base_model,
    status: r.status,
    stage: r.stage,
    error: r.error,
    pageCount: r.page_count,
    remarks: parseRemarks(r.remarks),
    costNok: r.cost_usd === null ? null : Math.round(r.cost_usd * usdNok * 100) / 100,
    baseChanged: notePdfRev !== r.base_pdf_rev,
    verdict: r.verdict,
    comment: r.comment,
    createdAt: r.created_at,
    finishedAt: r.finished_at,
    ratedAt: r.rated_at,
  };
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
    aims: parseJsonArray(r.aims).filter(isAim),
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
    sections: parseJsonArray(r.sections).filter(isSection),
    rev: r.rev,
    deleted: r.deleted === 1,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

function parseJsonArray(s: string): unknown[] {
  try {
    const v: unknown = JSON.parse(s);
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

/** Svaralternativene til et kort, eller null når kolonnen er tom eller ikke har riktig form. */
function parseChoices(s: string | null): FlashcardChoices | null {
  if (!s) return null;
  try {
    const v = JSON.parse(s) as Partial<FlashcardChoices> | null;
    if (v && typeof v.correct === 'string' && Array.isArray(v.wrong) && v.wrong.every((w) => typeof w === 'string')) {
      return { correct: v.correct, wrong: [...v.wrong] };
    }
  } catch {
    /* ugyldig JSON: ingen alternativer */
  }
  return null;
}

const choicesJson = (c: FlashcardChoices | null | undefined): string | null => (c ? JSON.stringify({ correct: c.correct, wrong: c.wrong }) : null);

function isAim(v: unknown): v is CompetenceAim {
  const a = v as CompetenceAim;
  return !!a && typeof a.code === 'string' && typeof a.text === 'string' && typeof a.cross === 'boolean';
}

function isSection(v: unknown): v is Section {
  const x = v as Section;
  return !!x && typeof x.code === 'string' && typeof x.title === 'string' && Array.isArray(x.aims);
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
    section: r.section,
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
    searchText: r.search_text,
    rev: r.rev,
    deleted: r.deleted === 1,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export function toDeck(r: DeckRow): Deck {
  return {
    id: r.id,
    subjectId: r.subject_id,
    title: r.title,
    difficulty: r.difficulty,
    noteIds: parseJsonArray(r.note_ids).filter((x): x is string => typeof x === 'string'),
    status: r.status,
    error: r.error,
    best: r.best,
    choicesStatus: r.choices_status === 'generating' || r.choices_status === 'failed' ? r.choices_status : null,
    choicesError: r.choices_error,
    rev: r.rev,
    deleted: r.deleted === 1,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export function toCard(r: CardRow): Flashcard {
  return {
    id: r.id,
    deckId: r.deck_id,
    noteId: r.note_id,
    kind: r.kind,
    front: r.front,
    back: parseJsonArray(r.back).filter((x): x is string => typeof x === 'string'),
    detail: r.detail,
    position: r.position,
    level: r.level,
    levelAt: r.level_at,
    choices: parseChoices(r.choices),
    choicesDeclined: r.choices_declined === 1,
    rev: r.rev,
    deleted: r.deleted === 1,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

/** Høyeste mestringsnivå (mestret). */
export const MASTER_LEVEL = 3;

const now = () => new Date().toISOString();

export interface NoteResultUpdate {
  title?: string;
  chapterId?: string | null;
  /** Delkapittel valgt av Claude; brukes bare hvis brukeren ikke har valgt selv. */
  section?: string | null;
  noteDate?: string | null;
  searchText?: string;
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

  /** `migrateTo` stopper migreringen ved en eldre versjon (bare for tester av migreringene). */
  constructor(file: string, opts: { migrateTo?: number } = {}) {
    this.db = new Database(file);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('foreign_keys = ON');
    this.db.pragma('busy_timeout = 5000');
    this.migrate(opts.migrateTo ?? MIGRATIONS.length);
  }

  private migrate(target: number): void {
    const version = this.db.pragma('user_version', { simple: true }) as number;
    // En database fra en nyere versjon (f.eks. etter en tilbakerulling i Railway) kan ha data denne versjonen ikke
    // forstår, som kontoer; da startes ikke serveren i stedet for å vise noe feil.
    if (version > MIGRATIONS.length) {
      throw new Error(`Databasen er fra en nyere versjon av SmartNotes (skjema ${version}, denne versjonen kjenner ${MIGRATIONS.length}). Bruk en nyere versjon.`);
    }
    for (let i = version; i < target; i++) {
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

  getMeta(key: string): string | null {
    const row = this.db.prepare(`SELECT value FROM meta WHERE key = ?`).get(key) as { value: string } | undefined;
    return row?.value ?? null;
  }

  setMeta(key: string, value: string): void {
    this.db.prepare(`INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`).run(key, value);
  }

  // ---------- Sikkerhetskopi ----------

  /**
   * Kopierer databasen mens appen kjører (SQLites backup-API gir en konsistent kopi). Innloggingene fjernes fra
   * kopien, og den blir én selvstendig fil uten -wal ved siden av.
   */
  async backupTo(file: string): Promise<void> {
    await this.db.backup(file);
    const copy = new Database(file);
    try {
      // Slettede rader blir ellers liggende i ledige sider i fila; secure_delete skriver over dem, og VACUUM under lager
      // fila på nytt uten dem.
      copy.pragma('secure_delete = ON');
      // Innlogginger, enheter, lenker for nytt passord og ubrukte invitasjoner er hemmeligheter som ikke hører hjemme i en
      // kopi som lastes ned.
      copy.prepare(`DELETE FROM sessions`).run();
      copy.prepare(`DELETE FROM user_sessions`).run();
      copy.prepare(`DELETE FROM user_devices`).run();
      copy.prepare(`DELETE FROM password_resets`).run();
      copy.prepare(`DELETE FROM invites WHERE used_at IS NULL`).run();
      copy.pragma('journal_mode = DELETE');
      copy.exec('VACUUM');
    } finally {
      copy.close();
    }
  }

  // ---------- Sammenligning (bare på serveren, ingen rev) ----------

  /** Starter (eller starter på nytt) sammenligningen for et notat. En tidligere vurdering fjernes; det som er brukt, beholdes. */
  startComparison(
    noteId: string,
    c: { model: string; baseModel: string | null; basePdfRev: number; pageCount: number; promptVersion: number },
  ): void {
    const start = this.db.prepare(
      `INSERT INTO note_comparisons (note_id, model, base_model, base_pdf_rev, status, stage, error, page_count, remarks,
         cost_usd, verdict, comment, created_at, finished_at, rated_at, prompt_version, user_id)
       VALUES (?, ?, ?, ?, 'running', NULL, NULL, ?, '[]', NULL, NULL, NULL, ?, NULL, NULL, ?, COALESCE((SELECT user_id FROM notes WHERE id = ?), ${OWNER_ID}))
       ON CONFLICT(note_id) DO UPDATE SET model = excluded.model, base_model = excluded.base_model,
         base_pdf_rev = excluded.base_pdf_rev, status = 'running', stage = NULL, error = NULL, page_count = excluded.page_count,
         remarks = '[]', cost_usd = NULL, verdict = NULL, comment = NULL, created_at = excluded.created_at, finished_at = NULL,
         rated_at = NULL, prompt_version = excluded.prompt_version`,
    );
    // Vurderingen av den forrige kjøringen erstattes (som dialogen sier); med samme instruksversjon skal den heller ikke
    // telles i loggen. Vurderinger av andre versjoner blir stående.
    const forget = this.db.prepare(`DELETE FROM comparison_ratings WHERE note_id = ? AND prompt_version = ?`);
    this.db.transaction(() => {
      start.run(noteId, c.model, c.baseModel, c.basePdfRev, c.pageCount, now(), c.promptVersion, noteId);
      forget.run(noteId, c.promptVersion);
    })();
  }

  setComparisonStage(noteId: string, stage: NoteComparison['stage']): void {
    this.db.prepare(`UPDATE note_comparisons SET stage = ? WHERE note_id = ? AND status = 'running'`).run(stage, noteId);
  }

  finishComparison(noteId: string, r: { ok: boolean; error: string | null; remarks: string[]; costUsd: number | null }): void {
    this.db
      .prepare(
        `UPDATE note_comparisons SET status = ?, stage = NULL, error = ?, remarks = ?, cost_usd = ?, spent_usd = spent_usd + ?,
           finished_at = ? WHERE note_id = ? AND status = 'running'`,
      )
      .run(r.ok ? 'done' : 'failed', r.error, JSON.stringify(r.remarks), r.costUsd, r.costUsd ?? 0, now(), noteId);
  }

  /** Det en kjøring som ble avbrutt (serveren stoppet), rakk å bruke. */
  addComparisonSpend(noteId: string, usd: number): void {
    this.db.prepare(`UPDATE note_comparisons SET spent_usd = spent_usd + ? WHERE note_id = ?`).run(usd, noteId);
  }

  /** Lagrer elevens vurdering. Gir false når det ikke finnes noen ferdig sammenligning å vurdere. */
  rateComparison(noteId: string, verdict: ComparisonVerdict, comment: string | null): boolean {
    return this.db.transaction(() => {
      const at = now();
      const res = this.db
        .prepare(`UPDATE note_comparisons SET verdict = ?, comment = ?, rated_at = ? WHERE note_id = ? AND status != 'running'`)
        .run(verdict, comment, at, noteId);
      if (res.changes === 0) return false;
      // Loggen beholder vurderingen per instruksversjon, også etter at sammenligningen er laget på nytt.
      this.db
        .prepare(
          `INSERT INTO comparison_ratings (note_id, prompt_version, verdict, comment, rated_at, user_id)
           SELECT note_id, prompt_version, verdict, comment, rated_at, user_id FROM note_comparisons WHERE note_id = ?
           ON CONFLICT(note_id, prompt_version) DO UPDATE SET verdict = excluded.verdict, comment = excluded.comment,
             rated_at = excluded.rated_at`,
        )
        .run(noteId);
      return true;
    })();
  }

  /** Vurderingene per instruksversjon (siste vurdering per notat), nyeste versjon først. */
  comparisonRatingsByVersion(userId: number): { version: number; rated: number; haikuOk: number }[] {
    return this.db
      .prepare(
        `SELECT prompt_version AS version, COUNT(*) AS rated, SUM(CASE WHEN verdict = 'haiku_ok' THEN 1 ELSE 0 END) AS haikuOk
         FROM comparison_ratings WHERE user_id = ? GROUP BY prompt_version ORDER BY prompt_version DESC`,
      )
      .all(userId) as { version: number; rated: number; haikuOk: number }[];
  }

  getComparisonRow(noteId: string): ComparisonRow | null {
    return (this.db.prepare(`SELECT * FROM note_comparisons WHERE note_id = ?`).get(noteId) as ComparisonRow | undefined) ?? null;
  }

  /** Sammenligninger som var i gang da serveren stoppet, kjøres ikke på nytt av seg selv (det koster penger). */
  failInterruptedComparisons(message: string): number {
    return this.db
      .prepare(`UPDATE note_comparisons SET status = 'failed', stage = NULL, error = ?, finished_at = ? WHERE status = 'running'`)
      .run(message, now()).changes;
  }

  /** Alle sammenligninger med tittelen på notatet (også slettede notater), nyeste vurdering først. */
  listComparisons(userId: number): (ComparisonRow & { title: string | null; note_deleted: number | null })[] {
    return this.db
      .prepare(
        `SELECT c.*, n.title AS title, n.deleted AS note_deleted FROM note_comparisons c LEFT JOIN notes n ON n.id = c.note_id
         WHERE c.user_id = ? ORDER BY c.rated_at DESC, c.created_at DESC`,
      )
      .all(userId) as (ComparisonRow & { title: string | null; note_deleted: number | null })[];
  }

  /** Det som står i manifestet til sikkerhetskopien. Slettede rader telles ikke. */
  backupSummary(): { schemaVersion: number; subjects: number; notes: number; decks: number; cards: number } {
    const count = (table: 'subjects' | 'notes' | 'decks' | 'cards') =>
      (this.db.prepare(`SELECT COUNT(*) AS n FROM ${table} WHERE deleted = 0`).get() as { n: number }).n;
    return {
      schemaVersion: this.db.pragma('user_version', { simple: true }) as number,
      subjects: count('subjects'),
      notes: count('notes'),
      decks: count('decks'),
      cards: count('cards'),
    };
  }

  // ---------- Forbrukslogg ----------

  logUsage(e: UsageEntry): void {
    // Et kall som var i gang da kontoen ble slettet, skriver ikke inn en ny rad for den slettede brukeren.
    if (e.userId != null && !this.getUser(e.userId)) return;
    this.db
      .prepare(
        `INSERT INTO usage_log (at, kind, provider, model, input_tokens, output_tokens, cache_read_tokens, cache_write_tokens,
           duration_ms, ok, error, note_id, deck_id, subject_id, user_id, pages) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        e.at,
        e.kind,
        e.provider,
        e.model,
        e.inputTokens,
        e.outputTokens,
        e.cacheReadTokens,
        e.cacheWriteTokens,
        e.durationMs,
        e.ok ? 1 : 0,
        e.error,
        e.noteId,
        e.deckId,
        e.subjectId,
        // Hvem som eier kallet, settes alltid av jobben (jobScope) eller ruten; eieren er reserven, så forbruket aldri
        // forsvinner fra loggen.
        e.userId ?? OWNER_ID,
        e.pages,
      );
  }

  /** AI-kallene fra og med `since` (ms), eldste først; med `userId` bare den brukerens. */
  usageSince(since: number, userId?: number): UsageEntry[] {
    const rows = (
      userId === undefined
        ? this.db.prepare(`SELECT * FROM usage_log WHERE at >= ? ORDER BY at, id`).all(since)
        : this.db.prepare(`SELECT * FROM usage_log WHERE at >= ? AND user_id = ? ORDER BY at, id`).all(since, userId)
    ) as UsageLogRow[];
    return rows.map((r) => ({
      at: r.at,
      kind: r.kind as UsageKind,
      provider: r.provider,
      model: r.model,
      inputTokens: r.input_tokens,
      outputTokens: r.output_tokens,
      cacheReadTokens: r.cache_read_tokens,
      cacheWriteTokens: r.cache_write_tokens,
      durationMs: r.duration_ms,
      ok: r.ok === 1,
      error: r.error,
      userId: r.user_id,
      noteId: r.note_id,
      deckId: r.deck_id,
      subjectId: r.subject_id,
      pages: r.pages,
    }));
  }

  // ---------- Synk ----------

  /** Radene til én bruker som er endret etter `since` (alle som ikke er slettet ved `since <= 0`). */
  sync(userId: number, since: number): { cursor: number; subjects: Subject[]; chapters: Chapter[]; notes: Note[]; decks: Deck[]; cards: Flashcard[] } {
    return this.db.transaction(() => {
      const cursor = this.currentRev();
      const full = since <= 0;
      const where = full ? 'user_id = ? AND deleted = 0' : 'user_id = ? AND rev > ?';
      const args = full ? [userId] : [userId, since];
      const subjects = (this.db.prepare(`SELECT * FROM subjects WHERE ${where} ORDER BY rev`).all(...args) as SubjectRow[]).map(toSubject);
      const chapters = (this.db.prepare(`SELECT * FROM chapters WHERE ${where} ORDER BY rev`).all(...args) as ChapterRow[]).map(toChapter);
      const notes = (this.db.prepare(`SELECT * FROM notes WHERE ${where} ORDER BY rev`).all(...args) as NoteRow[]).map(toNote);
      const decks = (this.db.prepare(`SELECT * FROM decks WHERE ${where} ORDER BY rev`).all(...args) as DeckRow[]).map(toDeck);
      const cards = (this.db.prepare(`SELECT * FROM cards WHERE ${where} ORDER BY rev`).all(...args) as CardRow[]).map(toCard);
      return { cursor, subjects, chapters, notes, decks, cards };
    })();
  }

  // ---------- Fag ----------

  listSubjects(userId: number): Subject[] {
    return (
      this.db.prepare(`SELECT * FROM subjects WHERE user_id = ? AND deleted = 0 ORDER BY position, created_at`).all(userId) as SubjectRow[]
    ).map(toSubject);
  }

  getSubject(id: string): Subject | null {
    const r = this.db.prepare(`SELECT * FROM subjects WHERE id = ? AND deleted = 0`).get(id) as SubjectRow | undefined;
    return r ? toSubject(r) : null;
  }

  createSubject(input: { userId: number; name: string; profile: SubjectProfile; textbook?: string | null; aims?: CompetenceAim[] }): Subject {
    const id = randomUUID();
    const t = now();
    const position = (
      this.db.prepare(`SELECT COALESCE(MAX(position), -1) + 1 AS p FROM subjects WHERE user_id = ? AND deleted = 0`).get(input.userId) as { p: number }
    ).p;
    this.db
      .prepare(
        `INSERT INTO subjects (id, user_id, name, profile, textbook, position, aims, rev, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(id, input.userId, input.name, input.profile, input.textbook ?? null, position, JSON.stringify(input.aims ?? []), this.nextRev(), t, t);
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
      const deckIds = (this.db.prepare(`SELECT id FROM decks WHERE subject_id = ? AND deleted = 0`).all(id) as { id: string }[]).map((r) => r.id);
      for (const did of deckIds) this.softDeleteDeck(did, t);
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

  createChapters(subjectId: string, inputs: (ChapterInput & { sections?: Section[] })[]): Chapter[] {
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
            `INSERT INTO chapters (id, user_id, subject_id, number, title, position, sections, rev, created_at, updated_at)
             VALUES (?, (SELECT user_id FROM subjects WHERE id = ?), ?, ?, ?, ?, ?, ?, ?, ?)`,
          )
          .run(id, subjectId, subjectId, input.number, input.title, position++, JSON.stringify(input.sections ?? []), this.nextRev(), t, t);
        ids.push(id);
      }
      return ids.map((id) => this.getChapter(id)!);
    })();
  }

  updateChapter(id: string, patch: { number?: string | null; title?: string; sections?: Section[] }): Chapter | null {
    const c = this.getChapter(id);
    if (!c) return null;
    this.db
      .prepare(`UPDATE chapters SET number = ?, title = ?, sections = ?, rev = ?, updated_at = ? WHERE id = ?`)
      .run(
        patch.number === undefined ? c.number : patch.number,
        patch.title ?? c.title,
        JSON.stringify(patch.sections ?? c.sections),
        this.nextRev(),
        now(),
        id,
      );
    if (patch.sections) {
      // Notater med et delkapittel som ikke finnes lenger, mister det.
      const codes = new Set(patch.sections.map((x) => x.code));
      const stale = (this.db.prepare(`SELECT id, section FROM notes WHERE chapter_id = ? AND deleted = 0 AND section IS NOT NULL`).all(id) as {
        id: string;
        section: string;
      }[]).filter((n) => !codes.has(n.section));
      for (const n of stale) {
        this.db.prepare(`UPDATE notes SET section = NULL, rev = ?, updated_at = ? WHERE id = ?`).run(this.nextRev(), now(), n.id);
      }
    }
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

  /** Notatet med denne klient-id-en (også et slettet), uansett eier. Klient-id-en er unik på tvers av brukerne. */
  getNoteRowByClientId(clientId: string): NoteRow | null {
    return (this.db.prepare(`SELECT * FROM notes WHERE client_id = ?`).get(clientId) as NoteRow | undefined) ?? null;
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
          `INSERT INTO notes (id, user_id, subject_id, chapter_id, client_id, title, title_auto, note_date, note_date_auto, status,
             page_count, chapter_auto, instructions, rev, created_at, updated_at)
           VALUES (?, (SELECT user_id FROM subjects WHERE id = ?), ?, ?, ?, ?, ?, ?, ?, 'queued', ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          input.id,
          input.subjectId,
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

  updateNoteUser(
    id: string,
    patch: { title?: string; chapterId?: string | null; section?: string | null; noteDate?: string | null },
  ): Note | null {
    const r = this.getNoteRow(id);
    if (!r) return null;
    const title = patch.title !== undefined ? patch.title : r.title;
    const titleAuto = patch.title !== undefined ? 0 : r.title_auto;
    const chapterId = patch.chapterId !== undefined ? patch.chapterId : r.chapter_id;
    const chapterAuto = patch.chapterId !== undefined ? 0 : r.chapter_auto;
    const chapterChanged = patch.chapterId !== undefined && patch.chapterId !== r.chapter_id;
    // Nytt kapittel uten oppgitt delkapittel: delkapittelet nullstilles og kan velges av Claude ved ny konvertering.
    const section = patch.section !== undefined ? patch.section : chapterChanged ? null : r.section;
    const sectionAuto = patch.section !== undefined ? 0 : chapterChanged ? 1 : r.section_auto;
    const noteDate = patch.noteDate !== undefined ? patch.noteDate : r.note_date;
    const noteDateAuto = patch.noteDate !== undefined ? (patch.noteDate ? 0 : 1) : r.note_date_auto;
    this.db
      .prepare(
        `UPDATE notes SET title = ?, title_auto = ?, chapter_id = ?, chapter_auto = ?, section = ?, section_auto = ?, note_date = ?, note_date_auto = ?,
           rev = ?, updated_at = ? WHERE id = ?`,
      )
      .run(title, titleAuto, chapterId, chapterAuto, section, sectionAuto, noteDate, noteDateAuto, this.nextRev(), now(), id);
    return this.getNote(id);
  }

  deleteNote(id: string): boolean {
    const res = this.db.prepare(`UPDATE notes SET deleted = 1, rev = ?, updated_at = ? WHERE id = ? AND deleted = 0`).run(this.nextRev(), now(), id);
    return res.changes > 0;
  }

  /** Neste notat som skal konverteres, eller null. */
  /** `at` er klokka køen bruker for `not_before` (testene gir den samme falske klokka som kvotene). */
  claimNextQueued(at: Date = new Date()): NoteRow | null {
    return this.db.transaction(() => {
      const r = this.db
        .prepare(
          // Rettferdig kø: brukeren som har ventet lengst siden forrige tur, og så brukerens eldste notat. Notater fra
          // stengte kontoer blir liggende.
          `SELECT n.* FROM notes n JOIN users u ON u.id = n.user_id
           WHERE n.status = 'queued' AND n.deleted = 0 AND (n.not_before IS NULL OR n.not_before <= ?) AND u.disabled = 0
           ORDER BY u.last_claim_rev ASC, n.created_at ASC, n.rowid ASC LIMIT 1`,
        )
        .get(at.toISOString()) as NoteRow | undefined;
      if (!r) return null;
      const rev = this.nextRev();
      this.db.prepare(`UPDATE users SET last_claim_rev = ? WHERE id = ?`).run(rev, r.user_id);
      this.db
        .prepare(`UPDATE notes SET status = 'processing', stage = 'preparing', error = NULL, attempts = attempts + 1, rev = ?, updated_at = ? WHERE id = ?`)
        .run(rev, now(), r.id);
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
    const section = r.section_auto === 1 && result.section !== undefined ? result.section : r.section;
    const searchText = result.searchText ?? r.search_text;
    this.db
      .prepare(
        opts.done
          ? `UPDATE notes SET status = 'done', stage = NULL, error = NULL, not_before = NULL, attempts = 0, title = ?, chapter_id = ?, section = ?,
               note_date = ?, search_text = ?, remarks = ?, page_count = ?, pdf_rev = pdf_rev + 1, usage = ?, rev = ?, updated_at = ? WHERE id = ?`
          : `UPDATE notes SET title = ?, chapter_id = ?, section = ?, note_date = ?, search_text = ?, remarks = ?, page_count = ?, usage = ?, rev = ?,
               updated_at = ? WHERE id = ?`,
      )
      .run(
        title,
        chapterId,
        section,
        noteDate,
        searchText,
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
  bumpPdf(id: string, searchText?: string): Note | null {
    this.db
      .prepare(
        `UPDATE notes SET status = 'done', stage = NULL, error = NULL, pdf_rev = pdf_rev + 1, search_text = COALESCE(?, search_text), rev = ?, updated_at = ?
         WHERE id = ? AND deleted = 0`,
      )
      .run(searchText ?? null, this.nextRev(), now(), id);
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

  /**
   * Notatet venter til `notBefore` (gratiskvoten er brukt opp). Forsøket telles ikke som et mislykket forsøk, og
   * meldingen vises på notatet.
   */
  deferNote(id: string, notBefore: Date, message: string): void {
    this.db
      .prepare(
        `UPDATE notes SET status = 'queued', stage = NULL, error = ?, not_before = ?, attempts = MAX(attempts - 1, 0), rev = ?, updated_at = ?
         WHERE id = ? AND deleted = 0`,
      )
      .run(message, notBefore.toISOString(), this.nextRev(), now(), id);
  }

  /** Notater brukeren har i køen (også de som venter på morgendagens kvote). */
  queuedNoteCount(userId: number): number {
    return (this.db.prepare(`SELECT COUNT(*) AS n FROM notes WHERE user_id = ? AND deleted = 0 AND status = 'queued'`).get(userId) as { n: number }).n;
  }

  // ---------- Kvoter (bare på serveren, ingen rev) ----------

  quotaUsed(userId: number, kind: QuotaKind, since: number): number {
    return (
      this.db.prepare(`SELECT COALESCE(SUM(amount), 0) AS n FROM quota_log WHERE user_id = ? AND kind = ? AND at >= ?`).get(userId, kind, since) as {
        n: number;
      }
    ).n;
  }

  addQuota(userId: number, kind: QuotaKind, amount: number, ref: string | null, at = Date.now()): void {
    if (!this.getUser(userId)) return;
    this.db.prepare(`INSERT INTO quota_log (user_id, kind, amount, at, ref) VALUES (?, ?, ?, ?, ?)`).run(userId, kind, amount, at, ref);
  }

  /** Forbruket til alle gratisbrukerne siden `since` (for dagsbudsjettet). */
  freeUsageSince(since: number): UsageEntry[] {
    const free = new Set(
      (this.db.prepare(`SELECT id FROM users WHERE plan = 'free'`).all() as { id: number }[]).map((r) => r.id),
    );
    return this.usageSince(since).filter((e) => e.userId !== null && free.has(e.userId));
  }

  /** Notatene til en bruker som står i køen eller konverteres nå. */
  activeNoteIds(userId: number): string[] {
    return (
      this.db
        .prepare(`SELECT id FROM notes WHERE user_id = ? AND deleted = 0 AND status IN ('queued', 'processing')`)
        .all(userId) as { id: string }[]
    ).map((r) => r.id);
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

  // ---------- Flashcards ----------

  getDeckRow(id: string): DeckRow | null {
    return (this.db.prepare(`SELECT * FROM decks WHERE id = ? AND deleted = 0`).get(id) as DeckRow | undefined) ?? null;
  }

  getDeck(id: string): Deck | null {
    const r = this.getDeckRow(id);
    return r ? toDeck(r) : null;
  }

  /** `withChoices`: kortene lages med svaralternativer (bare når eleven har bedt om det). */
  createDeck(input: {
    subjectId: string;
    title: string;
    difficulty: FlashcardDifficulty;
    noteIds: string[];
    count: number | null;
    withChoices?: boolean;
  }): Deck {
    const id = randomUUID();
    const t = now();
    this.db
      .prepare(
        `INSERT INTO decks (id, user_id, subject_id, title, difficulty, note_ids, requested_count, with_choices, status, rev, created_at, updated_at)
         VALUES (?, (SELECT user_id FROM subjects WHERE id = ?), ?, ?, ?, ?, ?, ?, 'generating', ?, ?, ?)`,
      )
      .run(
        id,
        input.subjectId,
        input.subjectId,
        input.title,
        input.difficulty,
        JSON.stringify(input.noteIds),
        input.count,
        input.withChoices ? 1 : 0,
        this.nextRev(),
        t,
        t,
      );
    return this.getDeck(id)!;
  }

  renameDeck(id: string, title: string): Deck | null {
    const res = this.db.prepare(`UPDATE decks SET title = ?, rev = ?, updated_at = ? WHERE id = ? AND deleted = 0`).run(title, this.nextRev(), now(), id);
    return res.changes > 0 ? this.getDeck(id) : null;
  }

  /** Kortstokker som var midt i genereringen (f.eks. da serveren stoppet). */
  generatingDeckIds(): string[] {
    return (
      this.db
        .prepare(
          `SELECT id FROM decks WHERE status = 'generating' AND deleted = 0 AND user_id NOT IN (SELECT id FROM users WHERE disabled = 1)
           ORDER BY created_at`,
        )
        .all() as { id: string }[]
    ).map(
      (r) => r.id,
    );
  }

  /** Setter kortstokken tilbake til «generating» (ny generering etter feil). */
  restartDeck(id: string): Deck | null {
    const res = this.db
      .prepare(`UPDATE decks SET status = 'generating', error = NULL, rev = ?, updated_at = ? WHERE id = ? AND deleted = 0 AND status = 'failed'`)
      .run(this.nextRev(), now(), id);
    return res.changes > 0 ? this.getDeck(id) : null;
  }

  failDeck(id: string, message: string): void {
    this.db
      .prepare(`UPDATE decks SET status = 'failed', error = ?, rev = ?, updated_at = ? WHERE id = ? AND deleted = 0`)
      .run(message, this.nextRev(), now(), id);
  }

  /**
   * Lagrer de genererte kortene og gjør kortstokken klar. Gir null hvis kortstokken er slettet i mellomtiden. Ba eleven
   * om svaralternativer (`with_choices`), har AI-en allerede fått hvert kort: de uten alternativer merkes som avslått.
   */
  completeDeck(id: string, cards: (FlashcardInput & { noteId: string | null })[], usage: unknown): Deck | null {
    return this.db.transaction(() => {
      const row = this.getDeckRow(id);
      if (!row) return null;
      this.insertCards(id, cards, row.with_choices === 1);
      this.db
        .prepare(`UPDATE decks SET status = 'ready', error = NULL, usage = ?, rev = ?, updated_at = ? WHERE id = ?`)
        .run(usage === undefined ? null : JSON.stringify(usage), this.nextRev(), now(), id);
      return this.getDeck(id);
    })();
  }

  /** `declineMissing`: AI-en ble bedt om svaralternativer til kortene, så de som mangler dem, merkes som avslått. */
  private insertCards(deckId: string, cards: (FlashcardInput & { noteId: string | null })[], declineMissing = false): string[] {
    let position = (this.db.prepare(`SELECT COALESCE(MAX(position), -1) + 1 AS p FROM cards WHERE deck_id = ? AND deleted = 0`).get(deckId) as { p: number }).p;
    const ids: string[] = [];
    const t = now();
    const insert = this.db.prepare(
      `INSERT INTO cards (id, user_id, deck_id, note_id, kind, front, back, detail, choices, choices_declined, position, rev, created_at, updated_at)
       VALUES (?, (SELECT user_id FROM decks WHERE id = ?), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    for (const c of cards) {
      const id = randomUUID();
      const choices = choicesJson(c.choices);
      const declined = declineMissing && choices === null ? 1 : 0;
      insert.run(id, deckId, deckId, c.noteId, c.kind, c.front, JSON.stringify(c.back), c.detail, choices, declined, position++, this.nextRev(), t, t);
      ids.push(id);
    }
    return ids;
  }

  // ---------- Svaralternativer til en kortstokk som finnes ----------

  /**
   * Starter jobben som lager svaralternativer (`choices_status` = 'generating'). Bare for en ferdig kortstokk uten en jobb
   * i gang; gir null ellers (eller når kortstokken er slettet).
   */
  startChoices(id: string): Deck | null {
    const res = this.db
      .prepare(
        `UPDATE decks SET choices_status = 'generating', choices_error = NULL, rev = ?, updated_at = ?
         WHERE id = ? AND deleted = 0 AND status = 'ready' AND (choices_status IS NULL OR choices_status = 'failed')`,
      )
      .run(this.nextRev(), now(), id);
    return res.changes > 0 ? this.getDeck(id) : null;
  }

  /** Jobben for svaralternativer feilet: eleven ser meldingen og kan prøve igjen. */
  failChoices(id: string, message: string): void {
    this.db
      .prepare(`UPDATE decks SET choices_status = 'failed', choices_error = ?, rev = ?, updated_at = ? WHERE id = ? AND deleted = 0 AND choices_status = 'generating'`)
      .run(message, this.nextRev(), now(), id);
  }

  /**
   * Lagrer svaralternativene fra jobben og avslutter den. Et kort får dem bare når det fortsatt finnes i kortstokken, ikke
   * har fått alternativer i mellomtiden (f.eks. fra eleven) og har samme spørsmål, svar og korttype som da jobben leste
   * det; ellers passer de kanskje ikke lenger. Kortene i `sent` (alle AI-en fikk) som ikke fikk alternativer, merkes som
   * avslått (`choices_declined`, med ny rev) på de samme vilkårene, så et nytt trykk ikke sender dem igjen. Gir null når
   * kortstokken er slettet i mellomtiden, ellers kortstokken, hvor mange kort som fikk alternativer og hvor mange som ble
   * avslått.
   */
  completeChoices(
    id: string,
    results: { card: Pick<Flashcard, 'id' | 'kind' | 'front' | 'back'>; choices: FlashcardChoices }[],
    sent: Pick<Flashcard, 'id' | 'kind' | 'front' | 'back'>[] = [],
  ): { deck: Deck; updated: number; declined: number } | null {
    return this.db.transaction(() => {
      if (!this.getDeckRow(id)) return null;
      const t = now();
      const unchanged = `id = ? AND deck_id = ? AND deleted = 0 AND choices IS NULL AND kind = ? AND front = ? AND back = ?`;
      const update = this.db.prepare(`UPDATE cards SET choices = ?, choices_declined = 0, rev = ?, updated_at = ? WHERE ${unchanged}`);
      const decline = this.db.prepare(`UPDATE cards SET choices_declined = 1, rev = ?, updated_at = ? WHERE ${unchanged} AND choices_declined = 0`);
      let updated = 0;
      for (const { card, choices } of results) {
        updated += update.run(choicesJson(choices), this.nextRev(), t, card.id, id, card.kind, card.front, JSON.stringify(card.back)).changes;
      }
      const answered = new Set(results.map((r) => r.card.id));
      let declined = 0;
      for (const card of sent) {
        if (answered.has(card.id)) continue;
        declined += decline.run(this.nextRev(), t, card.id, id, card.kind, card.front, JSON.stringify(card.back)).changes;
      }
      this.db
        .prepare(`UPDATE decks SET choices_status = NULL, choices_error = NULL, rev = ?, updated_at = ? WHERE id = ?`)
        .run(this.nextRev(), t, id);
      return { deck: this.getDeck(id)!, updated, declined };
    })();
  }

  /** Kortstokker med en jobb for svaralternativer i gang (f.eks. da serveren stoppet); stengte kontoer hoppes over. */
  generatingChoicesDeckIds(): string[] {
    return (
      this.db
        .prepare(
          `SELECT id FROM decks WHERE choices_status = 'generating' AND deleted = 0 AND user_id NOT IN (SELECT id FROM users WHERE disabled = 1)
           ORDER BY updated_at`,
        )
        .all() as { id: string }[]
    ).map((r) => r.id);
  }

  private softDeleteDeck(id: string, t: string): void {
    const cardIds = (this.db.prepare(`SELECT id FROM cards WHERE deck_id = ? AND deleted = 0`).all(id) as { id: string }[]).map((r) => r.id);
    for (const cid of cardIds) {
      this.db.prepare(`UPDATE cards SET deleted = 1, rev = ?, updated_at = ? WHERE id = ?`).run(this.nextRev(), t, cid);
    }
    this.db.prepare(`UPDATE decks SET deleted = 1, rev = ?, updated_at = ? WHERE id = ?`).run(this.nextRev(), t, id);
  }

  /** Sletter kortstokken med alle kortene (soft delete). */
  deleteDeck(id: string): boolean {
    if (!this.getDeckRow(id)) return false;
    this.db.transaction(() => this.softDeleteDeck(id, now()))();
    return true;
  }

  listCards(deckId: string): Flashcard[] {
    return (this.db.prepare(`SELECT * FROM cards WHERE deck_id = ? AND deleted = 0 ORDER BY position, created_at`).all(deckId) as CardRow[]).map(toCard);
  }

  getCard(id: string): Flashcard | null {
    const r = this.db.prepare(`SELECT * FROM cards WHERE id = ? AND deleted = 0`).get(id) as CardRow | undefined;
    return r ? toCard(r) : null;
  }

  /** Nytt kort laget av brukeren, sist i kortstokken. */
  createCard(deckId: string, input: FlashcardInput): Flashcard {
    const [id] = this.db.transaction(() => this.insertCards(deckId, [{ ...input, noteId: null }]))();
    return this.getCard(id!)!;
  }

  /**
   * Endrer innholdet i et kort. Mestringsnivået beholdes. Svaralternativer: utelatt = uendret, null = fjernes. Et kort AI-en
   * har avslått (`choices_declined`), kan få alternativer fra AI-en igjen når spørsmålet, svaret eller korttypen endres, og
   * når eleven skriver eller fjerner alternativer selv.
   */
  updateCard(id: string, patch: Partial<FlashcardInput>): Flashcard | null {
    const c = this.getCard(id);
    if (!c) return null;
    const choices = patch.choices === undefined ? c.choices : patch.choices;
    const kind = patch.kind ?? c.kind;
    const front = patch.front ?? c.front;
    const back = JSON.stringify(patch.back ?? c.back);
    const reset = patch.choices !== undefined || kind !== c.kind || front !== c.front || back !== JSON.stringify(c.back);
    this.db
      .prepare(`UPDATE cards SET kind = ?, front = ?, back = ?, detail = ?, choices = ?, choices_declined = ?, rev = ?, updated_at = ? WHERE id = ?`)
      .run(
        kind,
        front,
        back,
        patch.detail ?? c.detail,
        choicesJson(choices),
        c.choicesDeclined && !reset ? 1 : 0,
        this.nextRev(),
        now(),
        id,
      );
    return this.getCard(id);
  }

  deleteCard(id: string): boolean {
    const res = this.db.prepare(`UPDATE cards SET deleted = 1, rev = ?, updated_at = ? WHERE id = ? AND deleted = 0`).run(this.nextRev(), now(), id);
    return res.changes > 0;
  }

  /**
   * Fremgang fra øving (også offline). Et kortnivå lagres bare når vurderingen er nyere enn den serveren har (siste
   * vurdering vinner på tvers av enheter); for beste rekke vinner den høyeste verdien. Gir tilbake radene slik de er etterpå.
   */
  applyProgress(input: { cards: { id: string; level: number; at: string }[]; decks: { id: string; best: number }[] }): {
    cards: Flashcard[];
    decks: Deck[];
  } {
    return this.db.transaction(() => {
      const t = now();
      // Radene sendes tilbake også når vurderingen ble avvist (en nyere fantes), så enheten får serverens nivå.
      const cards = new Map<string, Flashcard>();
      const decks = new Map<string, Deck>();
      for (const p of input.cards) {
        const level = Math.max(0, Math.min(MASTER_LEVEL, Math.round(p.level)));
        // En klokke som går for fort, skal ikke låse kortet: tidspunkt fram i tid regnes som nå.
        const at = p.at > t ? t : p.at;
        this.db
          .prepare(`UPDATE cards SET level = ?, level_at = ?, rev = ?, updated_at = ? WHERE id = ? AND deleted = 0 AND (level_at IS NULL OR level_at < ?)`)
          .run(level, at, this.nextRev(), t, p.id, at);
        const card = this.getCard(p.id);
        if (card) cards.set(card.id, card);
      }
      for (const p of input.decks) {
        this.db
          .prepare(`UPDATE decks SET best = ?, rev = ?, updated_at = ? WHERE id = ? AND deleted = 0 AND best < ?`)
          .run(Math.max(0, Math.round(p.best)), this.nextRev(), t, p.id, Math.round(p.best));
        const deck = this.getDeck(p.id);
        if (deck) decks.set(deck.id, deck);
      }
      return { cards: [...cards.values()], decks: [...decks.values()] };
    })();
  }

  // ---------- Innloggingsøkter ----------

  createSession(tokenHash: string, userId: number, expiresAt: Date, userAgent: string | null): void {
    this.db
      .prepare(`INSERT INTO user_sessions (token_hash, user_id, created_at, expires_at, user_agent) VALUES (?, ?, ?, ?, ?)`)
      .run(tokenHash, userId, now(), expiresAt.toISOString(), userAgent);
  }

  /** Brukeren bak en gyldig økt, eller null (utløpt, ukjent eller stengt konto). */
  sessionUser(tokenHash: string): UserRow | null {
    return (
      (this.db
        .prepare(
          `SELECT u.* FROM user_sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ? AND s.expires_at > ? AND u.disabled = 0`,
        )
        .get(tokenHash, now()) as UserRow | undefined) ?? null
    );
  }

  deleteSession(tokenHash: string): void {
    this.db.prepare(`DELETE FROM user_sessions WHERE token_hash = ?`).run(tokenHash);
  }

  /** Logger brukeren ut overalt (nytt passord, stengt konto). */
  deleteUserSessions(userId: number): void {
    this.db.prepare(`DELETE FROM user_sessions WHERE user_id = ?`).run(userId);
  }

  /** Glemmer enhetene brukeren har logget inn fra (de er da ikke lenger unntatt fra kontosperren). */
  deleteUserDevices(userId: number): void {
    this.db.prepare(`DELETE FROM user_devices WHERE user_id = ?`).run(userId);
  }

  pruneSessions(): void {
    const t = now();
    this.db.prepare(`DELETE FROM user_sessions WHERE expires_at <= ?`).run(t);
    this.db.prepare(`DELETE FROM sessions WHERE expires_at <= ?`).run(t);
  }

  // ---------- Brukere ----------

  getUser(id: number): UserRow | null {
    return (this.db.prepare(`SELECT * FROM users WHERE id = ?`).get(id) as UserRow | undefined) ?? null;
  }

  /** Brukeren med dette brukernavnet (allerede normalisert med `normalizeUsername`). */
  getUserByName(username: string): UserRow | null {
    return (this.db.prepare(`SELECT * FROM users WHERE username = ?`).get(username) as UserRow | undefined) ?? null;
  }

  listUsers(): UserRow[] {
    return this.db.prepare(`SELECT * FROM users ORDER BY id`).all() as UserRow[];
  }

  /** Nytt brukernavn. Gir false når navnet er tatt. */
  renameUser(id: number, username: string): boolean {
    try {
      return this.db.prepare(`UPDATE users SET username = ?, updated_at = ? WHERE id = ?`).run(username, now(), id).changes > 0;
    } catch (err) {
      if (isUniqueViolation(err)) return false;
      throw err;
    }
  }

  setPasswordHash(id: number, hash: string): void {
    this.db.prepare(`UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?`).run(hash, now(), id);
  }

  setDisabled(id: number, disabled: boolean): void {
    this.db.prepare(`UPDATE users SET disabled = ?, updated_at = ? WHERE id = ?`).run(disabled ? 1 : 0, now(), id);
  }

  /** Et mislykket forsøk fra en ukjent enhet; etter `max` innen `windowMs` sperres kontoen for ukjente enheter i `lockMs`. */
  recordLoginFailure(id: number, opts: { max: number; windowMs: number; lockMs: number }): void {
    const u = this.getUser(id);
    if (!u) return;
    const t = Date.now();
    const fresh = !u.failed_since || t - Date.parse(u.failed_since) > opts.windowMs;
    const failures = fresh ? 1 : u.failed_logins + 1;
    const lockedUntil = failures >= opts.max ? new Date(t + opts.lockMs).toISOString() : u.locked_until;
    this.db
      .prepare(`UPDATE users SET failed_logins = ?, failed_since = ?, locked_until = ? WHERE id = ?`)
      .run(failures, fresh ? new Date(t).toISOString() : u.failed_since, lockedUntil, id);
  }

  recordLogin(id: number): void {
    this.db
      .prepare(`UPDATE users SET failed_logins = 0, failed_since = NULL, locked_until = NULL, last_login_at = ? WHERE id = ?`)
      .run(now(), id);
  }

  // ---------- Kjente enheter (unntak fra kontosperren) ----------

  addDevice(tokenHash: string, userId: number): void {
    const t = now();
    this.db
      .prepare(`INSERT INTO user_devices (token_hash, user_id, created_at, last_used_at) VALUES (?, ?, ?, ?) ON CONFLICT(token_hash, user_id) DO UPDATE SET last_used_at = excluded.last_used_at`)
      .run(tokenHash, userId, t, t);
  }

  isKnownDevice(tokenHash: string, userId: number): boolean {
    return !!this.db.prepare(`SELECT 1 FROM user_devices WHERE token_hash = ? AND user_id = ?`).get(tokenHash, userId);
  }

  // ---------- Invitasjoner ----------

  createInvite(input: { id: string; codeHash: string; codeHint: string; createdBy: number; expiresAt: Date }): InviteRow {
    this.db
      .prepare(`INSERT INTO invites (id, code_hash, code_hint, created_by, created_at, expires_at) VALUES (?, ?, ?, ?, ?, ?)`)
      .run(input.id, input.codeHash, input.codeHint, input.createdBy, now(), input.expiresAt.toISOString());
    return this.db.prepare(`SELECT * FROM invites WHERE id = ?`).get(input.id) as InviteRow;
  }

  listInvites(): (InviteRow & { used_by_name: string | null })[] {
    return this.db
      .prepare(`SELECT i.*, u.username AS used_by_name FROM invites i LEFT JOIN users u ON u.id = i.used_by ORDER BY i.created_at DESC`)
      .all() as (InviteRow & { used_by_name: string | null })[];
  }

  /** Om koden kan brukes nå (finnes, ikke brukt, ikke trukket tilbake, ikke utløpt). */
  inviteUsable(codeHash: string): boolean {
    return !!this.db
      .prepare(`SELECT 1 FROM invites WHERE code_hash = ? AND used_at IS NULL AND revoked_at IS NULL AND expires_at > ?`)
      .get(codeHash, now());
  }

  /** Trekker tilbake en ubrukt invitasjon. Gir false når den ikke finnes eller allerede er brukt. */
  revokeInvite(id: string): boolean {
    return this.db.prepare(`UPDATE invites SET revoked_at = ? WHERE id = ? AND used_at IS NULL AND revoked_at IS NULL`).run(now(), id).changes > 0;
  }

  /**
   * Registrering: bruker invitasjonen og lager brukeren, fagene og økten i én transaksjon, så to registreringer med
   * samme kode ikke begge lykkes. `passwordHash` lages før kallet (scrypt er asynkron og kan ikke stå i transaksjonen).
   */
  registerUser(input: {
    codeHash: string;
    username: string;
    passwordHash: string;
    presets: Parameters<Repo['addPreset']>[1][];
    session: { tokenHash: string; expiresAt: Date; userAgent: string | null };
  }): { ok: true; user: UserRow } | { ok: false; reason: 'invite' | 'username' } {
    // Brukeren har bekreftet alderen og godtatt vilkårene og personvernerklæringen (sjekket i ruten).
    return this.db.transaction(() => {
      const t = now();
      const invite = this.db
        .prepare(`SELECT id FROM invites WHERE code_hash = ? AND used_at IS NULL AND revoked_at IS NULL AND expires_at > ?`)
        .get(input.codeHash, t) as { id: string } | undefined;
      if (!invite) return { ok: false as const, reason: 'invite' as const };
      let userId: number;
      try {
        userId = Number(
          this.db
            .prepare(
              `INSERT INTO users (username, password_hash, plan, age_confirmed_at, terms_accepted_at, created_at, updated_at, last_login_at)
               VALUES (?, ?, 'free', ?, ?, ?, ?, ?)`,
            )
            .run(input.username, input.passwordHash, t, t, t, t, t).lastInsertRowid,
        );
      } catch (err) {
        if (isUniqueViolation(err)) return { ok: false as const, reason: 'username' as const };
        throw err;
      }
      const used = this.db
        .prepare(`UPDATE invites SET used_at = ?, used_by = ? WHERE id = ? AND used_at IS NULL AND revoked_at IS NULL`)
        .run(t, userId, invite.id);
      if (used.changes !== 1) throw new Error('Invitasjonen ble brukt samtidig.');
      for (const preset of input.presets) this.addPreset(userId, preset);
      this.createSession(input.session.tokenHash, userId, input.session.expiresAt, input.session.userAgent);
      return { ok: true as const, user: this.getUser(userId)! };
    })();
  }

  /**
   * «Slett konto»: alt brukeren har på serveren (fag, kapitler, notater, kortstokker, sammenligninger, forbruk, kvoter,
   * økter, enheter og lenker). Radene slettes helt, ikke som gravsteiner, fordi ingen andre synkroniserer dem. Gir
   * id-ene som trengs for å slette filene (notatene) og samle-PDF-ene (kapitler og fag). Eieren kan ikke slettes.
   */
  deleteUser(userId: number): { noteIds: string[]; chapterIds: string[]; subjectIds: string[] } | null {
    if (userId === OWNER_ID || !this.getUser(userId)) return null;
    return this.db.transaction(() => {
      const ids = (table: string) =>
        (this.db.prepare(`SELECT id FROM ${table} WHERE user_id = ?`).all(userId) as { id: string }[]).map((r) => r.id);
      const result = { noteIds: ids('notes'), chapterIds: ids('chapters'), subjectIds: ids('subjects') };
      this.db.prepare(`DELETE FROM note_files WHERE note_id IN (SELECT id FROM notes WHERE user_id = ?)`).run(userId);
      for (const table of ['cards', 'decks', 'notes', 'chapters', 'subjects', 'comparison_ratings', 'note_comparisons', 'usage_log', 'quota_log']) {
        this.db.prepare(`DELETE FROM ${table} WHERE user_id = ?`).run(userId);
      }
      for (const table of ['user_sessions', 'user_devices', 'password_resets']) this.db.prepare(`DELETE FROM ${table} WHERE user_id = ?`).run(userId);
      // Invitasjonen eleven brukte, blir stående som brukt, men uten navnet.
      this.db.prepare(`UPDATE invites SET used_by = NULL WHERE used_by = ?`).run(userId);
      this.db.prepare(`DELETE FROM users WHERE id = ?`).run(userId);
      return result;
    })();
  }

  // ---------- Lenker for nytt passord ----------

  /** Ny engangslenke for brukeren; eldre lenker som ikke er brukt, trekkes tilbake. */
  createPasswordReset(tokenHash: string, userId: number, expiresAt: Date): void {
    this.db.transaction(() => {
      this.revokePasswordResets(userId);
      this.db
        .prepare(`INSERT INTO password_resets (token_hash, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)`)
        .run(tokenHash, userId, now(), expiresAt.toISOString());
    })();
  }

  /** Om lenken kan brukes nå (sjekkes før passordet hashes). */
  passwordResetUsable(tokenHash: string): boolean {
    return !!this.db
      .prepare(
        `SELECT 1 FROM password_resets r JOIN users u ON u.id = r.user_id
         WHERE r.token_hash = ? AND r.used_at IS NULL AND r.revoked_at IS NULL AND r.expires_at > ? AND u.disabled = 0 AND u.id != ?`,
      )
      .get(tokenHash, now(), OWNER_ID);
  }

  revokePasswordResets(userId: number): void {
    this.db.prepare(`UPDATE password_resets SET revoked_at = ? WHERE user_id = ? AND used_at IS NULL AND revoked_at IS NULL`).run(now(), userId);
  }

  /**
   * Bruker lenken: nytt passord, alle økter for brukeren slettes, sperren nullstilles og en ny økt lages, i én
   * transaksjon. Gir brukeren, eller null når lenken er ukjent, brukt, trukket tilbake eller utløpt, eller kontoen er stengt.
   */
  usePasswordReset(input: {
    tokenHash: string;
    passwordHash: string;
    session: { tokenHash: string; expiresAt: Date; userAgent: string | null };
  }): UserRow | null {
    return this.db.transaction(() => {
      const t = now();
      const reset = this.db
        .prepare(
          `SELECT r.user_id FROM password_resets r JOIN users u ON u.id = r.user_id
           WHERE r.token_hash = ? AND r.used_at IS NULL AND r.revoked_at IS NULL AND r.expires_at > ? AND u.disabled = 0 AND u.id != ?`,
        )
        .get(input.tokenHash, t, OWNER_ID) as { user_id: number } | undefined;
      if (!reset) return null;
      this.db.prepare(`UPDATE password_resets SET used_at = ? WHERE token_hash = ?`).run(t, input.tokenHash);
      this.setPasswordHash(reset.user_id, input.passwordHash);
      // Logget ut overalt, og ingen enhet er lenger «kjent» (en som kjente det gamle passordet, skal ikke slippe sperren).
      this.deleteUserSessions(reset.user_id);
      this.deleteUserDevices(reset.user_id);
      this.recordLogin(reset.user_id);
      this.createSession(input.session.tokenHash, reset.user_id, input.session.expiresAt, input.session.userAgent);
      return this.getUser(reset.user_id);
    })();
  }

  /**
   * Startoppsett for eieren: hvert fagoppsett (fag + kapitler + delkapitler + kompetansemål) legges inn én gang.
   * Hvilke som er lagt inn, huskes i meta, så et fag eieren har slettet, ikke kommer tilbake. Et fag som allerede finnes
   * med samme navn og fagtype (lagt inn før denne ordningen), regnes som lagt inn. Uten oppsett og uten fag lages et
   * tomt fag «Fysikk». Returnerer navnene på fagene som ble laget. Andre brukere velger fagene sine ved registrering.
   */
  seed(presets: PresetInput[]): string[] {
    return this.db.transaction(() => {
      const created: string[] = [];
      if (presets.length === 0) {
        const count = (this.db.prepare(`SELECT COUNT(*) AS n FROM subjects WHERE user_id = ?`).get(OWNER_ID) as { n: number }).n;
        if (count === 0) {
          this.createSubject({ userId: OWNER_ID, name: 'Fysikk', profile: 'physics', textbook: null });
          created.push('Fysikk');
        }
        return created;
      }
      const seeded = this.seededPresets();
      const existing = this.listSubjects(OWNER_ID);
      for (const preset of presets) {
        const ids = [preset.id, ...(preset.aliases ?? [])];
        if (ids.some((id) => seeded.has(id))) {
          seeded.add(preset.id);
          continue;
        }
        seeded.add(preset.id);
        if (existing.some((s) => s.name === preset.subjectName && s.profile === preset.profile)) continue;
        const subject = this.createSubject({ userId: OWNER_ID, name: preset.subjectName, profile: preset.profile, textbook: null, aims: preset.aims });
        this.createChapters(subject.id, preset.chapters);
        created.push(preset.subjectName);
      }
      this.saveSeededPresets(seeded);
      return created;
    })();
  }

  private seededPresets(): Set<string> {
    const row = this.db.prepare(`SELECT value FROM meta WHERE key = 'seeded_presets'`).get() as { value: string } | undefined;
    return new Set<string>(row ? (JSON.parse(row.value) as string[]) : []);
  }

  private saveSeededPresets(seeded: Set<string>): void {
    this.db
      .prepare(`INSERT INTO meta (key, value) VALUES ('seeded_presets', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`)
      .run(JSON.stringify([...seeded]));
  }

  /**
   * Legger et fagoppsett til som fag for en bruker («Legg til fag», registrering), med temaene, deltemaene og
   * kompetansemålene. For eieren huskes oppsettet som lagt inn, så startoppsettet ikke legger det inn en gang til.
   * Returnerer null når brukeren har et fag med samme navn og fagtype fra før.
   */
  addPreset(userId: number, preset: PresetInput): Subject | null {
    return this.db.transaction(() => {
      if (this.listSubjects(userId).some((s) => s.name === preset.subjectName && s.profile === preset.profile)) return null;
      const subject = this.createSubject({ userId, name: preset.subjectName, profile: preset.profile, textbook: null, aims: preset.aims });
      this.createChapters(subject.id, preset.chapters);
      if (userId === OWNER_ID) {
        const seeded = this.seededPresets();
        seeded.add(preset.id);
        this.saveSeededPresets(seeded);
      }
      return subject;
    })();
  }

  /** Utsnittet av databasen som tilhører én bruker (alt rutene gjør, går gjennom det). */
  forUser(userId: number): UserRepo {
    return new UserRepo(this, userId);
  }
}


type OwnedTable = 'subjects' | 'chapters' | 'notes' | 'decks' | 'cards';

/**
 * Det én bruker har lov til å se og endre. Hver metode sjekker at raden tilhører brukeren før den går videre til `Repo`,
 * og gir null, false eller en tom liste ellers, så rutene svarer 404 som om raden ikke fantes. Eieren av en rad endres
 * aldri (triggere i migrering 7), og better-sqlite3 er synkront, så sjekken og endringen skjer uten noe imellom.
 *
 * Tenk på det som en postkasse i en oppgang: alle brevene ligger i samme bygg, men nøkkelen din åpner bare din kasse.
 */
export class UserRepo {
  constructor(
    private readonly repo: Repo,
    readonly userId: number,
  ) {}

  private owns(table: OwnedTable, id: string | null | undefined): boolean {
    if (!id) return false;
    return !!this.repo.db.prepare(`SELECT 1 FROM ${table} WHERE id = ? AND user_id = ?`).get(id, this.userId);
  }

  // ---------- Synk og fag ----------

  sync(since: number) {
    return this.repo.sync(this.userId, since);
  }

  listSubjects(): Subject[] {
    return this.repo.listSubjects(this.userId);
  }

  getSubject(id: string): Subject | null {
    return this.owns('subjects', id) ? this.repo.getSubject(id) : null;
  }

  createSubject(input: { name: string; profile: SubjectProfile; textbook?: string | null; aims?: CompetenceAim[] }): Subject {
    return this.repo.createSubject({ ...input, userId: this.userId });
  }

  updateSubject(id: string, patch: { name?: string; textbook?: string | null }): Subject | null {
    return this.owns('subjects', id) ? this.repo.updateSubject(id, patch) : null;
  }

  deleteSubject(id: string): string[] | null {
    return this.owns('subjects', id) ? this.repo.deleteSubject(id) : null;
  }

  addPreset(preset: PresetInput): Subject | null {
    return this.repo.addPreset(this.userId, preset);
  }

  // ---------- Kapitler ----------

  listChapters(subjectId: string): Chapter[] {
    return this.owns('subjects', subjectId) ? this.repo.listChapters(subjectId) : [];
  }

  getChapter(id: string): Chapter | null {
    return this.owns('chapters', id) ? this.repo.getChapter(id) : null;
  }

  createChapters(subjectId: string, inputs: (ChapterInput & { sections?: Section[] })[]): Chapter[] | null {
    return this.owns('subjects', subjectId) ? this.repo.createChapters(subjectId, inputs) : null;
  }

  updateChapter(id: string, patch: { number?: string | null; title?: string; sections?: Section[] }): Chapter | null {
    return this.owns('chapters', id) ? this.repo.updateChapter(id, patch) : null;
  }

  deleteChapter(id: string): boolean {
    return this.owns('chapters', id) ? this.repo.deleteChapter(id) : false;
  }

  /** Bare kapitler i faget flyttes (spørringen i Repo filtrerer på faget), så id-er fra andre fag ignoreres. */
  reorderChapters(subjectId: string, ids: string[]): boolean {
    if (!this.owns('subjects', subjectId)) return false;
    this.repo.reorderChapters(subjectId, ids);
    return true;
  }

  /** Ferdige notater i et kapittel eller fag (samle-PDF). */
  doneNotes(filter: { chapterId: string } | { subjectId: string }): NoteRow[] {
    const ok = 'chapterId' in filter ? this.owns('chapters', filter.chapterId) : this.owns('subjects', filter.subjectId);
    return ok ? this.repo.doneNotes(filter) : [];
  }

  /** Id-ene til de ferdige notatene i et kapittel eller fag (for å lage PDF-ene på nytt). */
  doneNoteIds(filter: { chapterId: string } | { subjectId: string }): string[] {
    const col = 'chapterId' in filter ? 'chapter_id' : 'subject_id';
    const val = 'chapterId' in filter ? filter.chapterId : filter.subjectId;
    return (
      this.repo.db
        .prepare(`SELECT id FROM notes WHERE ${col} = ? AND user_id = ? AND deleted = 0 AND status = 'done'`)
        .all(val, this.userId) as { id: string }[]
    ).map((r) => r.id);
  }

  // ---------- Notater ----------

  getNoteRow(id: string): NoteRow | null {
    return this.owns('notes', id) ? this.repo.getNoteRow(id) : null;
  }

  getNote(id: string): Note | null {
    return this.owns('notes', id) ? this.repo.getNote(id) : null;
  }

  /**
   * Opplastingen med denne klient-id-en: brukerens eget notat (også et slettet), `'taken'` når id-en er brukt av en
   * annen bruker (svaret avslører ikke noe om notatet), eller null.
   */
  noteByClientId(clientId: string): Note | 'taken' | null {
    const row = this.repo.getNoteRowByClientId(clientId);
    if (!row) return null;
    return row.user_id === this.userId ? toNote(row) : 'taken';
  }

  /** Nytt notat i et av brukerens fag; et kapittel må høre til samme bruker og fag, ellers velger Claude. */
  createNote(input: Parameters<Repo['createNote']>[0]): Note | null {
    if (!this.owns('subjects', input.subjectId)) return null;
    const chapter = input.chapterId ? this.getChapter(input.chapterId) : null;
    const chapterOk = !!chapter && chapter.subjectId === input.subjectId;
    return this.repo.createNote({ ...input, chapterId: chapterOk ? chapter.id : null, chapterAuto: chapterOk ? input.chapterAuto : true });
  }

  noteFiles(noteId: string): NoteFileRow[] {
    return this.owns('notes', noteId) ? this.repo.noteFiles(noteId) : [];
  }

  updateNoteUser(id: string, patch: Parameters<Repo['updateNoteUser']>[1]): Note | null {
    return this.owns('notes', id) ? this.repo.updateNoteUser(id, patch) : null;
  }

  deleteNote(id: string): boolean {
    return this.owns('notes', id) ? this.repo.deleteNote(id) : false;
  }

  requeue(id: string, instructions: string | null | undefined): Note | null {
    return this.owns('notes', id) ? this.repo.requeue(id, instructions) : null;
  }

  bumpPdf(id: string, searchText?: string): Note | null {
    return this.owns('notes', id) ? this.repo.bumpPdf(id, searchText) : null;
  }

  // ---------- Flashcards ----------

  getDeckRow(id: string): DeckRow | null {
    return this.owns('decks', id) ? this.repo.getDeckRow(id) : null;
  }

  getDeck(id: string): Deck | null {
    return this.owns('decks', id) ? this.repo.getDeck(id) : null;
  }

  /** Ny kortstokk i et av brukerens fag, bare fra brukerens egne notater. */
  createDeck(input: Parameters<Repo['createDeck']>[0]): Deck | null {
    if (!this.owns('subjects', input.subjectId)) return null;
    if (!input.noteIds.every((id) => this.owns('notes', id))) return null;
    return this.repo.createDeck(input);
  }

  renameDeck(id: string, title: string): Deck | null {
    return this.owns('decks', id) ? this.repo.renameDeck(id, title) : null;
  }

  restartDeck(id: string): Deck | null {
    return this.owns('decks', id) ? this.repo.restartDeck(id) : null;
  }

  /** Starter jobben for svaralternativer (se `Repo.startChoices`). */
  startChoices(id: string): Deck | null {
    return this.owns('decks', id) ? this.repo.startChoices(id) : null;
  }

  deleteDeck(id: string): boolean {
    return this.owns('decks', id) ? this.repo.deleteDeck(id) : false;
  }

  listCards(deckId: string): Flashcard[] {
    return this.owns('decks', deckId) ? this.repo.listCards(deckId) : [];
  }

  getCard(id: string): Flashcard | null {
    return this.owns('cards', id) ? this.repo.getCard(id) : null;
  }

  createCard(deckId: string, input: FlashcardInput): Flashcard | null {
    return this.owns('decks', deckId) ? this.repo.createCard(deckId, input) : null;
  }

  updateCard(id: string, patch: Partial<FlashcardInput>): Flashcard | null {
    return this.owns('cards', id) ? this.repo.updateCard(id, patch) : null;
  }

  deleteCard(id: string): boolean {
    return this.owns('cards', id) ? this.repo.deleteCard(id) : false;
  }

  /** Fremgang fra øving; kort og kortstokker som ikke er brukerens, hoppes over. */
  applyProgress(input: Parameters<Repo['applyProgress']>[0]): ReturnType<Repo['applyProgress']> {
    return this.repo.applyProgress({
      cards: input.cards.filter((c) => this.owns('cards', c.id)),
      decks: input.decks.filter((d) => this.owns('decks', d.id)),
    });
  }

  // ---------- Sammenligning (eieren) ----------

  getComparisonRow(noteId: string): ComparisonRow | null {
    return this.owns('notes', noteId) ? this.repo.getComparisonRow(noteId) : null;
  }

  rateComparison(noteId: string, verdict: ComparisonVerdict, comment: string | null): boolean {
    return this.owns('notes', noteId) ? this.repo.rateComparison(noteId, verdict, comment) : false;
  }

  listComparisons() {
    return this.repo.listComparisons(this.userId);
  }

  comparisonRatingsByVersion() {
    return this.repo.comparisonRatingsByVersion(this.userId);
  }
}
