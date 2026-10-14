import fsp from 'node:fs/promises';
import type { FastifyBaseLogger } from 'fastify';
import type { Repo } from '../db.js';
import { AbortedError, ConversionError } from '../errors.js';
import type { AiService } from '../pipeline/ai.js';
import { getProfile } from '../profiles/index.js';
import type { Storage } from '../storage.js';
import { jobScope } from '../usage.js';
import { cleanCardChoices, cleanFlashcards, noteSourceText, type FlashcardSourceNote } from './prompt.js';

/** Hvor mange ganger en midlertidig feil (overbelastning, nett) prøves før kortstokken markeres som feilet. */
const MAX_ATTEMPTS = 3;
const RETRY_DELAY_MS = 15_000;

/** Meldingen når en midlertidig feil har vart alle forsøkene; her må eleven selv trykke «Prøv igjen». */
const RETRY_LATER = 'Fikk ikke kontakt med AI-en. Trykk «Prøv igjen» om litt.';

/** Når ingen av kortene fikk brukbare svaralternativer (f.eks. bare forklaringskort med lange svar). */
export const NO_CHOICES_MESSAGE =
  'Claude fant ingen kort med svar som passer til flervalg (svaret må kunne skrives kort, på én linje). Du kan skrive svaralternativer selv når du redigerer et kort.';

/** LaTeX-teksten til et ferdig notat (siste vellykkede versjon), eller null. */
async function noteBody(storage: Storage, noteId: string): Promise<string | null> {
  for (const name of ['note.tex', 'draft.tex'] as const) {
    try {
      return await fsp.readFile(storage.noteFile(noteId, name), 'utf8');
    } catch {
      /* prøv neste */
    }
  }
  return null;
}

/**
 * Notatene en kortstokk lages fra, med tekst og plassering i læreboka. Notater som er slettet, ikke er ferdige eller
 * hører til et annet fag, hoppes over. `aliases` oversetter Claudes korte id-er («n1») til notat-id-er.
 */
export async function loadSourceNotes(
  repo: Pick<Repo, 'getNoteRow' | 'getChapter'>,
  storage: Storage,
  subjectId: string,
  noteIds: string[],
): Promise<{ notes: FlashcardSourceNote[]; aliases: Map<string, string>; skipped: string[] }> {
  const notes: FlashcardSourceNote[] = [];
  const aliases = new Map<string, string>();
  const skipped: string[] = [];
  for (const id of noteIds) {
    const row = repo.getNoteRow(id);
    const body = row && row.subject_id === subjectId && row.pdf_rev > 0 ? await noteBody(storage, id) : null;
    if (!row || body === null) {
      skipped.push(id);
      continue;
    }
    const chapter = row.chapter_id ? repo.getChapter(row.chapter_id) : null;
    const section = row.section ? chapter?.sections.find((s) => s.code === row.section) : undefined;
    const alias = `n${notes.length + 1}`;
    aliases.set(alias, id);
    notes.push({
      alias,
      title: row.title || 'Notat uten tittel',
      chapter: chapter ? `${chapter.number ? `${chapter.number} ` : ''}${chapter.title}` : null,
      section: section ? `${section.code} ${section.title}` : (row.section ?? null),
      date: row.note_date,
      body: noteSourceText(body),
    });
  }
  return { notes, aliases, skipped };
}

/**
 * Lager kortene i bakgrunnen: Claude får notatene, svaret ryddes og lagres, og kortstokken blir «ready» (eller
 * «failed» med en norsk feilmelding). Kortstokker som var under arbeid da serveren stoppet, lages på nytt ved oppstart.
 * Lager også svaralternativer (flervalg) til kortene i en ferdig kortstokk når eleven ber om det (`startChoices`).
 */
export class FlashcardGenerator {
  private readonly active = new Map<string, Promise<void>>();
  /** Jobber for svaralternativer, per kortstokk (egen liste, så de ikke stenger for en ny generering av kortene). */
  private readonly activeChoices = new Map<string, Promise<void>>();
  private readonly sleepers = new Set<() => void>();
  private stopped = false;

  /** `retryDelayMs`: ventetiden før nytt forsøk etter en midlertidig feil (ganges med forsøket; kortere i testene). */
  constructor(
    private readonly repo: Repo,
    private readonly storage: Storage,
    private readonly ai: AiService,
    private readonly log: FastifyBaseLogger,
    private readonly retryDelayMs = RETRY_DELAY_MS,
  ) {}

  /** Ved oppstart: fortsett med kortstokker (og svaralternativer) som ikke ble ferdige. */
  resume(): void {
    this.stopped = false;
    const ids = this.repo.generatingDeckIds();
    if (ids.length > 0) this.log.info({ count: ids.length }, 'lager ferdig avbrutte kortstokker');
    for (const id of ids) this.start(id);
    for (const id of this.repo.generatingChoicesDeckIds()) this.startChoices(id);
  }

  start(deckId: string): void {
    if (this.stopped || this.active.has(deckId)) return;
    const p = this.run(deckId)
      .catch((err) => this.log.error({ err, deckId }, 'generering av kort krasjet'))
      .finally(() => this.active.delete(deckId));
    this.active.set(deckId, p);
  }

  /**
   * Lager svaralternativer til kortene i en ferdig kortstokk som mangler dem (POST /api/decks/:id/choices og `resume`).
   * Kortstokken står allerede med `choices_status` = 'generating' (`Repo.startChoices`), og jobben avslutter med
   * `Repo.completeChoices` eller `Repo.failChoices`. Kan kalles flere ganger for samme kortstokk (et dobbelttrykk gir
   * ingen ny jobb).
   */
  startChoices(deckId: string): void {
    if (this.stopped || this.activeChoices.has(deckId)) return;
    const p = this.withRetries(deckId, 'svaralternativer', () => this.makeChoices(deckId), (message) => this.repo.failChoices(deckId, message))
      .catch((err) => this.log.error({ err, deckId }, 'svaralternativer krasjet'))
      .finally(() => this.activeChoices.delete(deckId));
    this.activeChoices.set(deckId, p);
  }

  /** Venter på pågående arbeid (tester og nedstenging). */
  async idle(): Promise<void> {
    while (this.active.size + this.activeChoices.size > 0) await Promise.allSettled([...this.active.values(), ...this.activeChoices.values()]);
  }

  /** Stopper nye forsøk. Kortstokker som ikke ble ferdige, blir liggende som «generating» og fortsetter ved neste oppstart. */
  stop(): void {
    this.stopped = true;
    for (const wake of this.sleepers) wake();
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => {
      const wake = () => {
        clearTimeout(timer);
        this.sleepers.delete(wake);
        resolve();
      };
      const timer = setTimeout(wake, ms);
      this.sleepers.add(wake);
    });
  }

  private run(deckId: string): Promise<void> {
    return this.withRetries(deckId, 'kort', () => this.generate(deckId), (message) => this.repo.failDeck(deckId, message));
  }

  /**
   * Kjører `work` med nye forsøk ved midlertidige feil. Til slutt får `fail` en norsk melding eleven ser, med «Prøv igjen».
   * Avbrutt av serveren selv, eller serveren stenger: ingenting lagres, og jobben fortsetter ved neste oppstart.
   */
  private async withRetries(deckId: string, what: 'kort' | 'svaralternativer', work: () => Promise<void>, fail: (message: string) => void): Promise<void> {
    for (let attempt = 1; ; attempt++) {
      try {
        await work();
        return;
      } catch (err) {
        if (err instanceof AbortedError || (this.stopped && err instanceof ConversionError && err.retryable)) return;
        const unexpected = what === 'kort' ? 'Uventet feil da kortene skulle lages. Prøv igjen.' : 'Uventet feil da svaralternativene skulle lages. Prøv igjen.';
        const e = err instanceof ConversionError ? err : new ConversionError(unexpected);
        if (!(err instanceof ConversionError)) this.log.error({ err, deckId }, `uventet feil da ${what} skulle lages`);
        if (e.retryable && attempt < MAX_ATTEMPTS) {
          this.log.warn({ deckId, attempt, message: e.message }, 'midlertidig feil – prøver igjen');
          await this.sleep(this.retryDelayMs * attempt);
          if (this.stopped) return;
          continue;
        }
        // Meldingene for midlertidige feil lover et nytt forsøk; her må eleven selv trykke «Prøv igjen».
        fail(e.retryable ? RETRY_LATER : e.message);
        return;
      }
    }
  }

  /** Er kontoen stengt, settes kortstokken som feilet (eleven kan prøve igjen når kontoen er åpnet). */
  private disabled(userId: number, deckId: string): boolean {
    if (!this.repo.getUser(userId)?.disabled) return false;
    this.repo.failDeck(deckId, 'Kontoen ble stengt mens kortene ble laget. Prøv igjen når den er åpnet.');
    return true;
  }

  private async generate(deckId: string): Promise<void> {
    const row = this.repo.getDeckRow(deckId);
    if (!row || row.status !== 'generating') return;
    const subject = this.repo.getSubject(row.subject_id);
    if (!subject) return;
    const deck = this.repo.getDeck(deckId)!;
    // Bare notatene til eieren av kortstokken (de ble sjekket da kortstokken ble laget, og sjekkes igjen her).
    const { notes, aliases } = await loadSourceNotes(this.repo.forUser(row.user_id), this.storage, subject.id, deck.noteIds);
    if (notes.length === 0) throw new ConversionError('Notatene finnes ikke lenger, eller er ikke ferdig konvertert.');
    const profile = getProfile(subject.profile);
    const started = Date.now();
    // En stengt konto får ikke laget kort (heller ikke en kortstokk som var i gang da kontoen ble stengt).
    if (this.disabled(row.user_id, deckId)) return;
    const { cards, usage } = await jobScope({ userId: row.user_id, deckId, subjectId: subject.id }, () =>
      this.ai.generateFlashcards({
        subjectName: subject.name,
        subjectLabel: profile.label,
        difficulty: deck.difficulty,
        count: row.requested_count,
        notes,
        // Bare når eleven krysset av; ellers er forespørselen nøyaktig som før flervalg fantes.
        ...(row.with_choices === 1 ? { withChoices: true } : {}),
      }),
    );
    const clean = cleanFlashcards(cards, aliases);
    if (clean.length === 0) throw new ConversionError('Claude fant ikke noe å lage kort av i disse notatene.');
    if (this.disabled(row.user_id, deckId)) return;
    const done = this.repo.completeDeck(deckId, clean, usage);
    if (done) this.log.info({ deckId, cards: clean.length, ms: Date.now() - started, usage }, 'kortstokk laget');
  }

  /**
   * Om jobben for svaralternativer skal stoppe fordi kontoen er borte eller stengt. En slettet konto har ingen rader å
   * lagre i; en stengt får feilmeldingen og kan prøve igjen når kontoen er åpnet.
   */
  private choicesStopped(userId: number, deckId: string): boolean {
    const user = this.repo.getUser(userId);
    if (!user) return true;
    if (!user.disabled) return false;
    this.repo.failChoices(deckId, 'Kontoen ble stengt mens svaralternativene ble laget. Prøv igjen når den er åpnet.');
    return true;
  }

  /**
   * Svaralternativer til kortene som mangler dem: AI-en får bare kortenes tekst (spørsmål og svar), ikke notatene. Svaret
   * ryddes (`cleanCardChoices`), og `Repo.completeChoices` lagrer dem bare på kort som er uendret siden de ble lest.
   */
  private async makeChoices(deckId: string): Promise<void> {
    const row = this.repo.getDeckRow(deckId);
    if (!row || row.choices_status !== 'generating') return;
    const subject = this.repo.getSubject(row.subject_id);
    if (!subject) return;
    // En stengt eller slettet konto får ikke laget alternativer (heller ikke en jobb som var i gang da kontoen ble stengt).
    if (this.choicesStopped(row.user_id, deckId)) return;
    const missing = this.repo.listCards(deckId).filter((c) => !c.choices);
    // Alle kortene har fått alternativer i mellomtiden (eleven har skrevet dem selv): ingenting å lage.
    if (missing.length === 0) {
      this.repo.completeChoices(deckId, []);
      return;
    }
    const byAlias = new Map(missing.map((c, i) => [`k${i + 1}`, c]));
    const started = Date.now();
    const { cards, usage } = await jobScope({ userId: row.user_id, deckId, subjectId: subject.id }, () =>
      this.ai.generateChoices({
        subjectName: subject.name,
        subjectLabel: getProfile(subject.profile).label,
        cards: [...byAlias].map(([alias, c]) => ({ alias, kind: c.kind, front: c.front, back: c.back })),
      }),
    );
    const results = cleanCardChoices(cards, byAlias);
    if (results.length === 0) throw new ConversionError(NO_CHOICES_MESSAGE);
    if (this.choicesStopped(row.user_id, deckId)) return;
    const done = this.repo.completeChoices(deckId, results);
    if (done) this.log.info({ deckId, cards: done.updated, asked: missing.length, ms: Date.now() - started, usage }, 'svaralternativer laget');
  }
}
