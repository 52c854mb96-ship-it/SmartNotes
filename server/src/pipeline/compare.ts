import fsp from 'node:fs/promises';
import path from 'node:path';
import type { FastifyBaseLogger } from 'fastify';
import type { ComparisonSummaryResponse } from '@smartnotes/shared';
import type { Config, Effort } from '../config.js';
import type { ComparisonRow, NoteRow, Repo } from '../db.js';
import { AbortedError, ConversionError } from '../errors.js';
import { PROMPT_VERSION } from '../profiles/precise.js';
import { getProfile } from '../profiles/index.js';
import { type Storage, writeFileAtomic } from '../storage.js';
import { costUsd, usageScope, type Usage } from '../usage.js';
import type { AiService } from './ai.js';
import { RefusalError } from './claude.js';
import type { Converter } from './converter.js';
import type { PageImage } from './images.js';
import { errorExcerpt, replaceMissingFigures, sanitizeBody } from './latex.js';

/**
 * Sammenligning av modeller på elevens egne notater: et ferdig notat konverteres én gang til med Haiku, fra de samme
 * sidebildene, og legges ved siden av den vanlige versjonen. Notatet selv (PDF, LaTeX, figurer, raden i databasen og
 * synken) endres ikke. Eleven ser begge PDF-ene og vurderer om Haiku er god nok.
 *
 * Tenk på det som en blindtest: samme oppgave, to elever. Den ene besvarelsen er den som leveres inn; den andre
 * legges ved siden av, bare for å sammenligne.
 */

/** Modellen sammenligningen bruker. */
export const COMPARE_MODEL = 'claude-haiku-5-5';
/** Haiku får tenke grundigere enn Sonnet (elevens valg 13. oktober 2026); det koster fortsatt en brøkdel. */
export const COMPARE_EFFORT: Effort = 'high';
/** Instruksversjonen sammenligningen bruker nå (de presise reglene, Haikus avslutning og grundigheten). */
export const COMPARE_PROMPT_VERSION = PROMPT_VERSION;
/** Haiku 5.5 kan svare med opptil 128 000 tokens; grundigere tenkning og et langt notat skal ikke kuttes av. */
export const COMPARE_MAX_TOKENS = 128_000;
/** Minst tre rettingsrunder: en runde koster Haiku under ett øre, og LaTeX melder bare én feil per kompilering. */
export const COMPARE_FIX_ATTEMPTS = 3;

const COMPILE_FAILED = 'Haiku-versjonen kompilerte ikke, selv etter automatisk retting. Den vanlige versjonen er ikke endret.';

export class Comparer {
  /** Kjøringene går én om gangen: LaTeX tar mye minne, og eleven venter uansett på én om gangen. */
  private chain: Promise<void> = Promise.resolve();
  private readonly running = new Set<Promise<void>>();
  private stopped = false;

  /** `ai` er Haiku uten reserve: avslår Haiku, skal ikke Sonnet lage PDF-en som vises som Haikus. */
  constructor(
    private readonly repo: Repo,
    private readonly storage: Storage,
    private readonly converter: Converter,
    private readonly ai: AiService,
    private readonly config: Config,
    private readonly log: FastifyBaseLogger,
  ) {
    const n = repo.failInterruptedComparisons('Avbrutt fordi serveren startet på nytt. Prøv igjen.');
    if (n > 0) log.info({ count: n }, 'sammenligninger avbrutt ved omstart');
  }

  get configured(): boolean {
    return this.ai.configured;
  }

  /**
   * Starter en ny sammenligning (erstatter en tidligere) og kjører den i bakgrunnen. Raden settes til `running` før
   * første `await`, så to forespørsler samtidig ikke begge starter en kjøring.
   */
  start(row: NoteRow): void {
    this.repo.startComparison(row.id, {
      model: this.ai.model,
      baseModel: baseModelOf(row),
      basePdfRev: row.pdf_rev,
      pageCount: row.page_count,
      promptVersion: COMPARE_PROMPT_VERSION,
    });
    // Sidebildene kopieres med en gang, så en ny konvertering av notatet ikke bytter dem ut under kjøringen.
    const input = this.snapshotPages(row.id);
    const job = this.chain.then(async () => this.run(row.id, await input));
    this.chain = job.catch(() => undefined);
    this.running.add(job);
    void job
      .catch((err: unknown) => this.log.error({ err, noteId: row.id }, 'uventet feil i sammenligningen'))
      .finally(() => this.running.delete(job));
  }

  /** Stopper nye kjøringer (ved avslutning). En kjøring som er i gang, gjør ferdig AI-kallet den venter på. */
  stop(): void {
    this.stopped = true;
  }

  async idle(): Promise<void> {
    while (this.running.size > 0) await Promise.allSettled([...this.running]);
  }

  private async snapshotPages(id: string): Promise<{ staging: string; pages: PageImage[] } | { error: string }> {
    let staging: string | null = null;
    try {
      staging = await this.storage.makeTmpDir('compare');
      const pages = JSON.parse(await fsp.readFile(this.storage.noteFile(id, 'pages.json'), 'utf8')) as PageImage[];
      if (!Array.isArray(pages) || pages.length === 0) throw new Error('ingen sider');
      await fsp.cp(this.storage.pagesDir(id), path.join(staging, 'pages'), { recursive: true });
      return { staging, pages };
    } catch (err) {
      this.log.warn({ err, noteId: id }, 'fant ikke sidebildene til sammenligningen');
      if (staging) await fsp.rm(staging, { recursive: true, force: true });
      return { error: 'Fant ikke sidebildene til notatet. Konverter notatet på nytt og prøv igjen.' };
    }
  }

  private async run(id: string, input: { staging: string; pages: PageImage[] } | { error: string }): Promise<void> {
    if ('error' in input) {
      this.repo.finishComparison(id, { ok: false, error: input.error, remarks: [], costUsd: null });
      return;
    }
    const { staging, pages } = input;
    const usage: Usage[] = [];
    const alive = () => !this.stopped && this.repo.getNoteRow(id) !== null;
    try {
      const row = this.repo.getNoteRow(id);
      if (!row || this.stopped) throw new AbortedError('Notatet ble slettet.');
      const subject = this.repo.getSubject(row.subject_id);
      if (!subject) throw new ConversionError('Faget finnes ikke lenger.');
      const profile = getProfile(subject.profile);
      const pagesDir = path.join(staging, 'pages');
      const out = path.join(staging, 'out');
      const figDir = path.join(out, 'figures');

      const result = await usageScope({ noteId: id, subjectId: row.subject_id }, async () => {
        this.repo.setComparisonStage(id, 'reading');
        const { req } = this.converter.buildConvertRequest(row, subject, pages, pagesDir);
        const converted = await this.ai.convert(req);
        usage.push(converted.usage);
        if (!alive()) throw new AbortedError('Notatet ble slettet.');

        // Samme tittelblokk som notatet har nå, så bare innholdet skiller de to PDF-ene.
        const info = this.converter.docInfo(this.repo.getNoteRow(id) ?? row);
        const figures = await this.converter.cropFiguresInto(id, pagesDir, pages, converted.meta, figDir);
        let body = replaceMissingFigures(sanitizeBody(converted.body), figures);
        this.repo.setComparisonStage(id, 'compiling');
        let outcome = await this.converter.compileInto(out, figDir, row, body, info);
        // Samme automatiske retting som den vanlige konverteringen, med Haiku.
        for (let attempt = 0; !outcome.ok && attempt < Math.max(this.config.maxFixAttempts, COMPARE_FIX_ATTEMPTS); attempt++) {
          if (!alive()) throw new AbortedError('Notatet ble slettet.');
          this.repo.setComparisonStage(id, 'fixing');
          let fixed: { body: string; usage: Usage };
          try {
            fixed = await this.ai.fix({ profile, body, errorReport: errorExcerpt(body, outcome.errors, outcome.bodyStartLine) });
          } catch (err) {
            if (!(err instanceof ConversionError) || err.retryable) throw err;
            if (err.usage) usage.push(err.usage);
            break;
          }
          usage.push(fixed.usage);
          body = replaceMissingFigures(sanitizeBody(fixed.body), figures);
          this.repo.setComparisonStage(id, 'compiling');
          outcome = await this.converter.compileInto(out, figDir, row, body, info);
        }
        await writeFileAtomic(path.join(out, 'meta.json'), JSON.stringify({ meta: converted.meta, usage }, null, 2));
        return { ok: outcome.ok, remarks: converted.meta.remarks };
      });

      if (!alive()) throw new AbortedError('Notatet ble slettet.');
      // Flytt resultatet på plass i ett jafs. mkdir uten `recursive`: er notatmappen borte (notatet slettet akkurat nå),
      // lages den ikke på nytt.
      const compareRoot = path.dirname(this.storage.compareDir(id));
      try {
        await fsp.mkdir(compareRoot);
      } catch (err) {
        const code = (err as NodeJS.ErrnoException).code;
        if (code === 'ENOENT') throw new AbortedError('Notatet ble slettet.');
        if (code !== 'EEXIST') throw err;
      }
      await fsp.rm(this.storage.compareDir(id), { recursive: true, force: true });
      await fsp.rename(out, this.storage.compareDir(id));
      if (!alive()) {
        await fsp.rm(compareRoot, { recursive: true, force: true });
        throw new AbortedError('Notatet ble slettet.');
      }
      this.repo.finishComparison(id, { ok: result.ok, error: result.ok ? null : COMPILE_FAILED, remarks: result.remarks, costUsd: this.cost(usage) });
      this.log.info({ noteId: id, ok: result.ok }, 'sammenligning ferdig');
    } catch (err) {
      if (err instanceof ConversionError && err.usage) usage.push(err.usage);
      if (err instanceof AbortedError) {
        // Ved avslutning står raden som `running` og markeres som avbrutt ved neste oppstart; det som er brukt, telles likevel.
        if (!this.stopped) this.repo.finishComparison(id, { ok: false, error: 'Notatet ble slettet.', remarks: [], costUsd: this.cost(usage) });
        else this.repo.addComparisonSpend(id, this.cost(usage) ?? 0);
        return;
      }
      if (!(err instanceof ConversionError)) this.log.error({ err, noteId: id }, 'uventet feil i sammenligningen');
      else this.log.warn({ noteId: id, msg: err.message }, 'sammenligningen feilet');
      const message =
        err instanceof RefusalError
          ? 'Haiku avslo å lese notatet. Det skjer av og til; den vanlige versjonen er ikke endret.'
          : err instanceof ConversionError
            ? // Meldingene for midlertidige feil lover et nytt forsøk; her må eleven selv trykke «Prøv igjen».
              err.retryable
              ? 'Fikk ikke kontakt med Claude. Trykk «Prøv igjen» om litt.'
              : err.message
            : 'Uventet feil under sammenligningen. Prøv igjen.';
      this.repo.finishComparison(id, { ok: false, error: message, remarks: [], costUsd: this.cost(usage) });
    } finally {
      await fsp.rm(staging, { recursive: true, force: true });
    }
  }

  /** Summen av kallene i dollar etter listepris, eller null når ingen pris er kjent. */
  private cost(usage: Usage[]): number | null {
    const known = usage.map((u) => costUsd(this.ai.provider, u)).filter((c): c is number => c !== null);
    return known.length > 0 ? known.reduce((a, b) => a + b, 0) : null;
  }
}

/** Modellen bak notatets vanlige versjon: den første i forbruket fra siste konvertering. */
function baseModelOf(row: NoteRow): string | null {
  try {
    const usage = JSON.parse(row.usage ?? 'null') as { model?: unknown }[] | null;
    const model = Array.isArray(usage) ? usage[0]?.model : null;
    return typeof model === 'string' ? model : null;
  } catch {
    return null;
  }
}

/**
 * Oppsummeringen i Innstillinger: hvor ofte eleven syntes Haiku var god nok med de nåværende instruksene (tidligere
 * versjoner står i `versions`). Vurderinger av notater som senere er slettet, telles med. Uvurderte og mislykkede
 * telles for alle versjoner, men bare for notater som finnes: de kan fortsatt vurderes eller lages på nytt.
 */
export function summarizeComparisons(
  rows: (ComparisonRow & { title: string | null; note_deleted: number | null })[],
  versions: { version: number; rated: number; haikuOk: number }[],
  usdNok: number,
  promptVersion = COMPARE_PROMPT_VERSION,
): ComparisonSummaryResponse {
  const current = rows.filter((r) => r.prompt_version === promptVersion);
  const rated = current.filter((r) => r.verdict !== null && r.status !== 'running');
  const live = (r: { note_deleted: number | null }) => r.note_deleted === 0;
  const costUsdTotal = rows.reduce((sum, r) => sum + r.spent_usd, 0);
  return {
    promptVersion,
    total: rows.length,
    versions,
    rated: rated.length,
    haikuOk: rated.filter((r) => r.verdict === 'haiku_ok').length,
    sonnetBetter: rated.filter((r) => r.verdict === 'sonnet_better').length,
    failed: rows.filter((r) => r.status === 'failed' && r.verdict === null && live(r)).length,
    unrated: rows.filter((r) => r.status === 'done' && r.verdict === null && live(r)).length,
    running: rows.filter((r) => r.status === 'running' && live(r)).length,
    costNok: Math.round(costUsdTotal * usdNok * 100) / 100,
    // Alle vurderte notater (siste vurdering per notat), også med eldre instrukser, merket med versjonen.
    items: rows
      .filter((r) => r.verdict !== null && r.status !== 'running')
      .map((r) => ({
        noteId: r.note_id,
        title: r.title ?? '',
        deleted: r.note_deleted !== 0,
        verdict: r.verdict!,
        comment: r.comment,
        ratedAt: r.rated_at!,
        promptVersion: r.prompt_version,
      })),
  };
}
