import fsp from 'node:fs/promises';
import type { FastifyBaseLogger } from 'fastify';
import type { Repo } from '../db.js';
import { ConversionError } from '../errors.js';
import type { ClaudeService } from '../pipeline/claude.js';
import { getProfile } from '../profiles/index.js';
import type { Storage } from '../storage.js';
import { cleanFlashcards, noteSourceText, type FlashcardSourceNote } from './prompt.js';

/** Hvor mange ganger en midlertidig feil (overbelastning, nett) prøves før kortstokken markeres som feilet. */
const MAX_ATTEMPTS = 3;
const RETRY_DELAY_MS = 15_000;

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
  repo: Repo,
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
 */
export class FlashcardGenerator {
  private readonly active = new Map<string, Promise<void>>();
  private readonly sleepers = new Set<() => void>();
  private stopped = false;

  constructor(
    private readonly repo: Repo,
    private readonly storage: Storage,
    private readonly claude: ClaudeService,
    private readonly log: FastifyBaseLogger,
  ) {}

  /** Ved oppstart: fortsett med kortstokker som ikke ble ferdige. */
  resume(): void {
    this.stopped = false;
    const ids = this.repo.generatingDeckIds();
    if (ids.length > 0) this.log.info({ count: ids.length }, 'lager ferdig avbrutte kortstokker');
    for (const id of ids) this.start(id);
  }

  start(deckId: string): void {
    if (this.stopped || this.active.has(deckId)) return;
    const p = this.run(deckId)
      .catch((err) => this.log.error({ err, deckId }, 'generering av kort krasjet'))
      .finally(() => this.active.delete(deckId));
    this.active.set(deckId, p);
  }

  /** Venter på pågående arbeid (tester og nedstenging). */
  async idle(): Promise<void> {
    while (this.active.size > 0) await Promise.allSettled([...this.active.values()]);
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

  private async run(deckId: string): Promise<void> {
    for (let attempt = 1; ; attempt++) {
      try {
        await this.generate(deckId);
        return;
      } catch (err) {
        const e = err instanceof ConversionError ? err : new ConversionError('Uventet feil da kortene skulle lages. Prøv igjen.');
        if (!(err instanceof ConversionError)) this.log.error({ err, deckId }, 'uventet feil i generering av kort');
        if (e.retryable && attempt < MAX_ATTEMPTS) {
          this.log.warn({ deckId, attempt, message: e.message }, 'midlertidig feil – prøver igjen');
          await this.sleep(RETRY_DELAY_MS * attempt);
          if (this.stopped) return;
          continue;
        }
        if (this.stopped && e.retryable) return;
        this.repo.failDeck(deckId, e.message);
        return;
      }
    }
  }

  private async generate(deckId: string): Promise<void> {
    const row = this.repo.getDeckRow(deckId);
    if (!row || row.status !== 'generating') return;
    const subject = this.repo.getSubject(row.subject_id);
    if (!subject) return;
    const deck = this.repo.getDeck(deckId)!;
    const { notes, aliases } = await loadSourceNotes(this.repo, this.storage, subject.id, deck.noteIds);
    if (notes.length === 0) throw new ConversionError('Notatene finnes ikke lenger, eller er ikke ferdig konvertert.');
    const profile = getProfile(subject.profile);
    const started = Date.now();
    const { cards, usage } = await this.claude.generateFlashcards({
      subjectName: subject.name,
      subjectLabel: profile.label,
      difficulty: deck.difficulty,
      count: row.requested_count,
      notes,
    });
    const clean = cleanFlashcards(cards, aliases);
    if (clean.length === 0) throw new ConversionError('Claude fant ikke noe å lage kort av i disse notatene.');
    const done = this.repo.completeDeck(deckId, clean, usage);
    if (done) this.log.info({ deckId, cards: clean.length, ms: Date.now() - started, usage }, 'kortstokk laget');
  }
}
