// Felles typer for API-kontrakten mellom server og web-app.
// Kun typer her – ingen kjørbar kode – slik at begge sider kan importere med `import type`.

/** Fagprofil: bestemmer instruksene til Claude, LaTeX-malen og fargetemaet i appen. */
export type SubjectProfile = 'physics' | 'chemistry' | 'biology' | 'geoscience';

/**
 * Livssyklus for et notat på serveren:
 *  queued      – lastet opp, venter på konvertering
 *  processing  – Claude leser/LaTeX kompileres (se `stage`)
 *  done        – PDF er klar
 *  failed      – konvertering feilet (se `error`), kan prøves igjen
 */
export type NoteStatus = 'queued' | 'processing' | 'done' | 'failed';

/** Detaljert steg mens status er `processing`. */
/** «waiting»: venter på at hjemmemaskinen med den lokale AI-en skal bli ledig. */
export type NoteStage = 'preparing' | 'waiting' | 'reading' | 'compiling' | 'fixing';

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
  /** Lærebok/emne, f.eks. navnet på læreboka eleven bruker, eller «FYS-MEK1110». Gis til Claude som kontekst. */
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

// ---------- Flashcards ----------

/** Vanskelighetsgrad for en kortstokk. Styrer både hva slags spørsmål Claude lager og hvor mye svaret skal inneholde. */
export type FlashcardDifficulty = 'easy' | 'medium' | 'hard' | 'mixed';

/**
 * Korttype:
 *  concept – begrep, definisjon eller fakta
 *  explain – forklare en sammenheng eller hvorfor noe skjer
 *  apply   – bruke stoffet: drøfte, overføre til en ny situasjon eller regne
 */
export type FlashcardKind = 'concept' | 'explain' | 'apply';

/** generating = Claude lager kortene, ready = klar til øving, failed = se `error` (kan prøves igjen). */
export type DeckStatus = 'generating' | 'ready' | 'failed';

/** En kortstokk laget fra ett eller flere notater i et fag. */
export interface Deck extends SyncedRow {
  subjectId: string;
  title: string;
  difficulty: FlashcardDifficulty;
  /** Notatene kortene ble laget fra, i rekkefølge. */
  noteIds: string[];
  status: DeckStatus;
  /** Norsk feilmelding når status er `failed`. */
  error: string | null;
  /** Lengste rekke svar på rad som var «delvis» eller bedre. Høyeste verdi vinner ved synk. */
  best: number;
}

/**
 * Ett kort. Tekstfeltene bruker en enkel markering: **fet** for nøkkelbegreper og $…$ for formler (LaTeX, med \ce{…}
 * for kjemi). Et svarpunkt som starter med «!» er en overskriftslinje.
 */
export interface Flashcard extends SyncedRow {
  deckId: string;
  /** Notatet kortet ble laget fra, eller null for kort brukeren har laget selv. */
  noteId: string | null;
  kind: FlashcardKind;
  /** Spørsmålet (forsiden). */
  front: string;
  /** Svaret som korte punkter (baksiden). */
  back: string[];
  /** Detaljert forklaring, avsnitt skilt med tom linje. Tom streng hvis ingen. */
  detail: string;
  position: number;
  /** Mestringsnivå 0–3. 3 = mestret. */
  level: number;
  /** Når nivået sist ble satt (klientens klokke, ISO). Siste vurdering vinner ved synk mellom enheter. */
  levelAt: string | null;
}

/** POST /api/decks – kortene lages i bakgrunnen; følg med på `status` via synk. */
export interface CreateDeckRequest {
  subjectId: string;
  noteIds: string[];
  difficulty: FlashcardDifficulty;
  /** Omtrent hvor mange kort. null = Claude velger ut fra hvor mye stoff notatene har. */
  count: number | null;
  /** Navn på kortstokken. Tomt = lages fra kapittelet eller notatene. */
  title?: string | null;
}

export interface UpdateDeckRequest {
  title?: string;
}

export interface FlashcardInput {
  kind: FlashcardKind;
  front: string;
  back: string[];
  detail: string;
}

/** POST /api/decks/:id/cards */
export type CreateFlashcardRequest = FlashcardInput;

/** PATCH /api/cards/:id */
export type UpdateFlashcardRequest = Partial<FlashcardInput>;

/**
 * POST /api/flashcards/progress – fremgang fra øving, også det som ble gjort offline. Et kortnivå lagres bare hvis `at`
 * er nyere enn det serveren har; for `best` vinner den høyeste verdien.
 */
export interface ProgressRequest {
  cards: { id: string; level: number; at: string }[];
  decks: { id: string; best: number }[];
}

export interface ProgressResponse {
  cards: Flashcard[];
  decks: Deck[];
}

// ---------- Auth ----------

// ---------- Kontoer ----------

/** `owner` er eleven som eier appen (bruker 1), `free` er en invitert bruker; `pro` kommer senere. */
export type UserPlan = 'owner' | 'free' | 'pro';

export interface AuthUser {
  id: number;
  username: string;
  plan: UserPlan;
}

/** Tomt brukernavn (eller eierens) og APP_PASSWORD logger inn eieren, som før kontoene. */
export interface LoginRequest {
  username?: string;
  password: string;
}

export interface LoginResponse {
  ok: true;
  user: AuthUser;
}

export interface MeResponse {
  authenticated: boolean;
  user: AuthUser | null;
}

/** POST /api/auth/register: invitasjonskode fra eieren, brukernavn, passord, fag og aldersbekreftelse. */
export interface RegisterRequest {
  code: string;
  username: string;
  password: string;
  /** Fagoppsett som legges inn (id-er fra GET /api/auth/presets). */
  presetIds: string[];
  /** Brukeren bekrefter at hen er minst `minAge` år. */
  ageConfirmed: boolean;
}

/** GET /api/auth/presets: fagene man kan velge ved registrering, og aldersgrensen. */
export interface PublicPresetsResponse {
  presets: { id: string; subjectName: string; profile: SubjectProfile }[];
  minAge: number;
}

/** POST /api/auth/reset: engangslenken fra eieren. */
export interface ResetPasswordRequest {
  token: string;
  password: string;
}

export interface AdminUser {
  id: number;
  username: string;
  plan: UserPlan;
  disabled: boolean;
  createdAt: string;
  lastLoginAt: string | null;
  /** AI-forbruket de siste 30 dagene. */
  usage30d: { calls: number; pages: number; costNok: number };
}

export interface AdminUsersResponse {
  users: AdminUser[];
}

export type InviteStatus = 'active' | 'used' | 'expired' | 'revoked';

export interface InviteSummary {
  id: string;
  /** De siste fire tegnene i koden, så eieren kjenner den igjen. Selve koden vises bare én gang. */
  codeHint: string;
  status: InviteStatus;
  createdAt: string;
  expiresAt: string;
  usedAt: string | null;
  usedBy: string | null;
}

export interface InvitesResponse {
  invites: InviteSummary[];
}

/** POST /api/admin/invites: koden vises bare her. */
export interface CreateInviteResponse {
  invite: InviteSummary;
  code: string;
}

/** POST /api/admin/users/:id/reset-link: appen lager lenken (`/nytt-passord#<token>`) av sin egen adresse. */
export interface ResetLinkResponse {
  token: string;
  expiresAt: string;
}

// ---------- Synk ----------

/** GET /api/sync?since=<rev> */
export interface SyncResponse {
  /** Brukeren dataene tilhører. En enhet som har data fra en annen konto, tømmes før den tar imot disse. */
  userId: number;
  /** Høyeste rev serveren kjenner til. Send som `since` neste gang. */
  cursor: number;
  /** true når `since` var 0 – klienten bør erstatte alt lokalt. */
  full: boolean;
  subjects: Subject[];
  chapters: Chapter[];
  notes: Note[];
  decks: Deck[];
  cards: Flashcard[];
}

// ---------- Fag og kapitler ----------

export interface CreateSubjectRequest {
  name: string;
  profile: SubjectProfile;
  textbook?: string | null;
}

/** Et fagoppsett etter læreplanen (LK20) som kan legges til som fag («Legg til fag»). */
export interface SubjectPresetSummary {
  id: string;
  subjectName: string;
  profile: SubjectProfile;
  /** Læreplankoden hos Udir, f.eks. «GFG01-03». */
  plan: string;
  aimCount: number;
  chapterCount: number;
  /** Brukeren har allerede et fag med samme navn og fagtype. */
  added: boolean;
}

export interface SubjectPresetsResponse {
  presets: SubjectPresetSummary[];
}

export interface AddPresetSubjectRequest {
  presetId: string;
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
  /** Hvem som kjører AI-en per oppgave: «anthropic» (Claude), «ollama» (lokal modell) eller «fake» (testmodus). */
  ai?: { task: 'convert' | 'flashcards' | 'toc'; provider: string; model: string }[];
}

/** Hva et AI-kall gjaldt: konvertering, retting av LaTeX, innholdsfortegnelse, kompetansemål eller kortstokk. */
export type UsageKind = 'convert' | 'fix' | 'toc' | 'aims' | 'flashcards';

export interface UsageTotals {
  calls: number;
  failed: number;
  /** Inndata inkludert hurtigbuffer. */
  inputTokens: number;
  outputTokens: number;
  /** Beregnet etter listepris (kroner, avrundet til øre). Lokale og falske modeller koster 0. */
  costNok: number;
  /** Kall med en modell uten kjent pris (ikke med i `costNok`). */
  unpricedCalls: number;
}

/** GET /api/usage?days=N – forbruket av AI de siste N dagene. */
export interface UsageSummaryResponse {
  days: number;
  since: string;
  /** Kursen som er brukt fra dollar til kroner. */
  usdNok: number;
  total: UsageTotals;
  byKind: (UsageTotals & { kind: UsageKind })[];
  /** Per dag (norsk tid), eldste først. Bare dager med kall. */
  byDay: (UsageTotals & { day: string })[];
  byModel: (UsageTotals & { provider: string; model: string })[];
}

/** GET /api/ai/status – hjemmemaskinene som henter AI-kall fra serveren (bare når en oppgave bruker dem). */
export interface AiStatusResponse {
  remote: {
    /** `online`: har vært i kontakt nylig (serveren avgjør, så klokken på enheten ikke spiller inn). */
    workers: { name: string; lastSeenAt: string; models: string[]; busy: boolean; online: boolean }[];
    /** AI-kall som venter på en ledig hjemmemaskin. */
    waiting: number;
    running: number;
    /** Om kallene går til Claude når ingen hjemmemaskin er på nett. */
    fallback: boolean;
  } | null;
}

/** GET /api/backup/status – det Innstillinger viser om sikkerhetskopien. Selve kopien (.tar.gz) kommer fra GET /api/backup. */
export interface BackupStatusResponse {
  /** Når serveren sist sendte en hel sikkerhetskopi (ISO), eller null. Om fila ble lagret, vet bare enheten. */
  lastBackupAt: string | null;
  /** Omtrent hvor stor kopien er (byte før komprimering): databasen og filene til notatene. */
  approxBytes: number;
  notes: number;
}

// ---------- Sammenligning av modeller ----------

export type ComparisonStatus = 'running' | 'done' | 'failed';
/** Elevens vurdering: Haiku-versjonen er god nok, eller den vanlige versjonen (Sonnet) er bedre. */
export type ComparisonVerdict = 'haiku_ok' | 'sonnet_better';

/**
 * Notatet konvertert på nytt med Haiku fra de samme sidebildene, ved siden av den vanlige versjonen, som ikke
 * endres. Ett resultat per notat; en ny kjøring erstatter det gamle. Bare på serveren (synkroniseres ikke).
 */
export interface NoteComparison {
  noteId: string;
  /** Modellen som laget sammenligningen (`claude-haiku-5-5`). */
  model: string;
  /** Versjonen av Haiku-instruksene som ble brukt. */
  promptVersion: number;
  /** Laget med eldre instrukser enn de serveren har nå; «Lag på nytt» prøver de nye. */
  promptOutdated: boolean;
  /** Modellen bak notatets vanlige PDF, hvis den er kjent. */
  baseModel: string | null;
  status: ComparisonStatus;
  /** Steget mens status er `running`; null betyr at den venter på tur. */
  stage: Extract<NoteStage, 'reading' | 'compiling' | 'fixing'> | null;
  error: string | null;
  pageCount: number;
  /** Merknadene Haiku skrev om notatet (som `Note.remarks`). */
  remarks: string[];
  /** Beregnet kostnad etter listepris, i kroner. Null til den er kjent. */
  costNok: number | null;
  /** Den vanlige PDF-en er endret etter at Haiku-versjonen ble laget. */
  baseChanged: boolean;
  verdict: ComparisonVerdict | null;
  comment: string | null;
  createdAt: string;
  finishedAt: string | null;
  ratedAt: string | null;
}

/** GET og POST /api/notes/:id/compare. */
export interface NoteComparisonResponse {
  comparison: NoteComparison | null;
}

/** PUT /api/notes/:id/compare/rating */
export interface RateComparisonRequest {
  verdict: ComparisonVerdict;
  comment?: string | null;
}

/**
 * GET /api/compare/summary – oppsummeringen i Innstillinger. Tallene gjelder sammenligninger laget med de nåværende
 * instruksene (`promptVersion`); `versions` viser vurderingene for alle versjonene.
 */
export interface ComparisonSummaryResponse {
  /** Versjonen av Haiku-instruksene serveren bruker nå. */
  promptVersion: number;
  /** Antall sammenligninger som er laget (alle versjoner, også for slettede notater). */
  total: number;
  /** Vurderingene per instruksversjon, nyeste først (siste vurdering per notat). */
  versions: { version: number; rated: number; haikuOk: number }[];
  /** Antall vurderte sammenligninger. */
  rated: number;
  haikuOk: number;
  sonnetBetter: number;
  /** Kjøringer som feilet og ikke er vurdert (alle versjoner). En mislykket kjøring kan bare vurderes som «Sonnet er bedre». */
  failed: number;
  /** Ferdige kjøringer som ikke er vurdert ennå (alle versjoner). */
  unrated: number;
  /** Kjøringer som lages nå. */
  running: number;
  /** Hva alle sammenligningene har kostet, i kroner (også kjøringer som er erstattet eller avbrutt). */
  costNok: number;
  /** De vurderte, nyeste først. `title` er tom hvis notatet er slettet. */
  items: {
    noteId: string;
    title: string;
    deleted: boolean;
    verdict: ComparisonVerdict;
    comment: string | null;
    ratedAt: string;
    promptVersion: number;
  }[];
}

export interface ApiError {
  error: string;
  /** Norsk, brukervennlig melding. */
  message: string;
}
