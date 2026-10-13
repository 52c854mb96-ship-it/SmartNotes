import fsp from 'node:fs/promises';
import path from 'node:path';
import type { FastifyBaseLogger } from 'fastify';
import type { Chapter, Section, Subject } from '@smartnotes/shared';
import type { Config } from '../config.js';
import type { NoteRow, Repo } from '../db.js';
import { AbortedError, ConversionError } from '../errors.js';
import { userTextbook } from '../presets.js';
import { getProfile, readPreamble, type Profile } from '../profiles/index.js';
import { exists, type Storage, writeFileAtomic } from '../storage.js';
import { usageScope, type Usage } from '../usage.js';
import type { AiService, ChapterRef, ConvertRequest } from './ai.js';
import { cropFigure, preparePages, type FileKind, type PageImage } from './images.js';
import {
  assembleNoteDoc,
  chapterLabel,
  compileLatex,
  errorExcerpt,
  formatErrors,
  latexToText,
  replaceMissingFigures,
  sanitizeBody,
  type LatexErrorInfo,
} from './latex.js';
import type { NoteMeta } from './parse.js';

const KIND_BY_MIME: Record<string, FileKind> = {
  'application/pdf': 'pdf',
  'image/jpeg': 'jpeg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/heic': 'heic',
  'image/gif': 'gif',
  'image/tiff': 'tiff',
};

/** Ventetid før nytt forsøk ved midlertidige feil (1, 5, 15 min). */
const BACKOFF_MS = [60_000, 5 * 60_000, 15 * 60_000];

export type CompileOutcome = { ok: true } | { ok: false; errors: LatexErrorInfo[]; bodyStartLine: number; message: string };

class Semaphore {
  private active = 0;
  private readonly waiting: (() => void)[] = [];
  constructor(private readonly max: number) {}

  async run<T>(fn: () => Promise<T>): Promise<T> {
    if (this.active >= this.max) await new Promise<void>((r) => this.waiting.push(r));
    this.active++;
    try {
      return await fn();
    } finally {
      this.active--;
      this.waiting.shift()?.();
    }
  }
}

/** Det som står i tittelblokken og sidehodet i et notat-PDF. */
export interface DocInfo {
  title: string;
  dateIso: string | null;
  chapterLabel: string;
  sectionLabel: string | null;
}

export class Converter {
  constructor(
    private readonly repo: Repo,
    private readonly storage: Storage,
    private readonly ai: AiService,
    private readonly config: Config,
    private readonly log: FastifyBaseLogger,
  ) {}

  /** Kjører hele konverteringen for et notat som er hentet fra køen (status = processing). */
  async convertNote(row: NoteRow): Promise<void> {
    const id = row.id;
    const started = Date.now();
    try {
      await usageScope({ noteId: id, subjectId: row.subject_id }, () => this.run(row));
      this.log.info({ noteId: id, ms: Date.now() - started }, 'notat konvertert');
    } catch (err) {
      if (err instanceof AbortedError) {
        this.log.info({ noteId: id, msg: err.message }, 'konvertering avbrutt');
        return;
      }
      const e = err instanceof ConversionError ? err : new ConversionError('Uventet feil under konverteringen.');
      if (!(err instanceof ConversionError)) this.log.error({ err, noteId: id }, 'uventet feil i konvertering');
      else this.log.warn({ noteId: id, msg: e.message, retryable: e.retryable }, 'konvertering feilet');
      if (e.retryable && row.attempts <= BACKOFF_MS.length) {
        const delay = BACKOFF_MS[Math.min(row.attempts - 1, BACKOFF_MS.length - 1)]!;
        this.repo.requeueLater(id, new Date(Date.now() + delay), e.message);
      } else {
        this.repo.failNote(id, e.message);
      }
    }
  }

  private stillExists(id: string): boolean {
    return this.repo.getNoteRow(id) !== null;
  }

  private async run(row: NoteRow): Promise<void> {
    const id = row.id;
    const subject = this.repo.getSubject(row.subject_id);
    if (!subject) throw new ConversionError('Faget finnes ikke lenger.');
    const profile = getProfile(subject.profile);

    // 1. Sidebilder
    this.repo.setStage(id, 'preparing');
    const files = this.repo.noteFiles(id);
    const sources = files.map((f) => ({ file: path.join(this.storage.sourceDir(id), f.filename), kind: KIND_BY_MIME[f.mime] ?? 'jpeg' }));
    const pages = await preparePages(sources, this.storage.pagesDir(id), this.config.maxPagesPerNote);
    await writeFileAtomic(this.storage.noteFile(id, 'pages.json'), JSON.stringify(pages, null, 2));
    this.repo.setPageCount(id, pages.length);

    // 2. Claude leser notatet
    this.repo.setStage(id, 'reading');
    const { req, refs, chapters, fixed } = this.buildConvertRequest(row, subject, pages, this.storage.pagesDir(id));
    const result = await this.ai.convert(req);
    const usage: Usage[] = [result.usage];
    if (!this.stillExists(id)) return;

    // 3. Figurer klippet fra originalen
    const figures = await this.cropFigures(id, pages, result.meta);

    // 4. Kapittel (opprettes først når PDF-en er klar) og tekst til tittelblokken
    const match = row.chapter_auto === 1 ? this.matchChapter(result.meta, refs, chapters) : null;
    const headerChapter =
      row.chapter_auto === 1 ? (match === null ? null : 'id' in match ? chapters.find((c) => c.id === match.id)! : match.create) : fixed;
    // Delkapittelet må finnes i kapittelet notatet havner i; ellers ignoreres forslaget.
    const targetSections: Section[] = headerChapter && 'sections' in headerChapter ? (headerChapter as Chapter).sections : [];
    const proposed = result.meta.section?.toUpperCase() ?? null;
    const sectionCode =
      row.section_auto === 1 ? (targetSections.find((x) => x.code.toUpperCase() === proposed)?.code ?? null) : row.section;
    const sectionInfo = targetSections.find((x) => x.code === sectionCode) ?? null;
    const docInfo: DocInfo = {
      title: (row.title_auto === 0 ? row.title : result.meta.title) || row.title || 'Notat',
      dateIso: row.note_date_auto === 0 ? row.note_date : (result.meta.date ?? row.note_date),
      chapterLabel: chapterLabel(headerChapter),
      sectionLabel: sectionInfo ? `${sectionInfo.code} ${sectionInfo.title}` : null,
    };

    // 5. LaTeX → PDF, med inntil N runder automatisk retting
    let body = replaceMissingFigures(sanitizeBody(result.body), figures);
    this.repo.setStage(id, 'compiling');
    let outcome = await this.compileNote(id, body, docInfo);
    for (let attempt = 0; !outcome.ok && attempt < this.config.maxFixAttempts; attempt++) {
      if (!this.stillExists(id)) return;
      this.repo.setStage(id, 'fixing');
      let fixed: { body: string; usage: Usage };
      try {
        fixed = await this.ai.fix({ profile, body, errorReport: errorExcerpt(body, outcome.errors, outcome.bodyStartLine) });
      } catch (err) {
        // Klarer ikke AI-en å rette (for eksempel fordi notatet er for langt for en lokal modell), lagres notatet som
        // utkast som kan rettes for hånd, i stedet for å feile. Midlertidige feil prøves igjen som før.
        if (!(err instanceof ConversionError) || err.retryable) throw err;
        if (err.usage) usage.push(err.usage);
        this.log.warn({ noteId: id, msg: err.message }, 'automatisk retting feilet – lagres som utkast');
        break;
      }
      usage.push(fixed.usage);
      body = replaceMissingFigures(sanitizeBody(fixed.body), figures);
      this.repo.setStage(id, 'compiling');
      outcome = await this.compileNote(id, body, docInfo);
    }
    await writeFileAtomic(this.storage.noteFile(id, 'meta.json'), JSON.stringify({ meta: result.meta, usage }, null, 2));
    if (!this.stillExists(id)) return;

    // 6. Lagre resultatet (metadata lagres også når LaTeX-koden feilet, så notatet kan rettes for hånd)
    let chapterId: string | null | undefined;
    if (row.chapter_auto === 1) {
      chapterId = match === null ? null : 'id' in match ? match.id : this.createOrReuseChapter(subject.id, match.create);
    }
    this.repo.completeNote(
      id,
      {
        title: docInfo.title,
        chapterId,
        section: row.section_auto === 1 ? sectionCode : undefined,
        noteDate: docInfo.dateIso,
        remarks: result.meta.remarks,
        pageCount: pages.length,
        usage,
        searchText: latexToText(body),
      },
      { done: outcome.ok },
    );
    if (!outcome.ok) {
      throw new ConversionError(
        'LaTeX-koden kompilerte ikke, selv etter automatisk retting. Du kan rette koden selv under «LaTeX», eller konvertere på nytt.',
      );
    }
  }

  /**
   * Forespørselen til AI-en for et notat: fagets kapitler (som k1, k2 …), låst kapittel, tittel og dato eleven har
   * valgt, og sidebildene i `pagesDir`. Brukes også av sammenligningen, så Haiku får nøyaktig det samme.
   */
  buildConvertRequest(
    row: NoteRow,
    subject: Subject,
    pages: PageImage[],
    pagesDir: string,
  ): { req: ConvertRequest; refs: ChapterRef[]; chapters: Chapter[]; fixed: Chapter | null } {
    const chapters = this.repo.listChapters(subject.id);
    const refs: ChapterRef[] = chapters.map((c, i) => ({
      alias: `k${i + 1}`,
      number: c.number,
      title: c.title,
      sections: c.sections.map((x) => ({ code: x.code, title: x.title })),
    }));
    const fixed = row.chapter_auto === 0 ? (row.chapter_id ? this.repo.getChapter(row.chapter_id) : null) : null;
    const req: ConvertRequest = {
      profile: getProfile(subject.profile),
      subjectName: subject.name,
      textbook: userTextbook(subject),
      chapters: refs,
      fixedChapter:
        row.chapter_auto === 0
          ? fixed
            ? { number: fixed.number, title: fixed.title, sections: fixed.sections.map((x) => ({ code: x.code, title: x.title })) }
            : { number: null, title: 'Uten kapittel', sections: [] }
          : null,
      userTitle: row.title_auto === 0 ? row.title : null,
      userDate: row.note_date_auto === 0 ? row.note_date : null,
      instructions: row.instructions,
      today: new Date().toISOString().slice(0, 10),
      pages: pages.map((p) => ({ path: path.join(pagesDir, p.file), width: p.width, height: p.height })),
    };
    return { req, refs, chapters, fixed };
  }

  /** Kapittelet Claude valgte, eller kapittelet Claude foreslår å opprette (når faget ikke har noen). */
  private matchChapter(
    meta: NoteMeta,
    refs: ChapterRef[],
    chapters: { id: string }[],
  ): { id: string } | { create: { number: string | null; title: string } } | null {
    if (meta.chapter) {
      const idx = refs.findIndex((r) => r.alias.toLowerCase() === meta.chapter!.toLowerCase());
      if (idx !== -1) return { id: chapters[idx]!.id };
    }
    if (meta.newChapter && refs.length === 0) return { create: meta.newChapter };
    return null;
  }

  private createOrReuseChapter(subjectId: string, wanted: { number: string | null; title: string }): string {
    // Et annet notat kan ha opprettet det samme kapittelet i mellomtiden.
    const same = this.repo
      .listChapters(subjectId)
      .find((c) => c.title.toLowerCase() === wanted.title.toLowerCase() || (wanted.number !== null && c.number === wanted.number));
    return same ? same.id : this.repo.createChapters(subjectId, [wanted])[0]!.id;
  }

  private cropFigures(id: string, pages: PageImage[], meta: NoteMeta): Promise<Set<string>> {
    return this.cropFiguresInto(id, this.storage.pagesDir(id), pages, meta, this.storage.figuresDir(id));
  }

  /** Klipper figurene AI-en fant ut av sidebildene i `pagesDir`, til `<id>.png` i `outDir` (som tømmes først). */
  async cropFiguresInto(noteId: string, pagesDir: string, pages: PageImage[], meta: NoteMeta, outDir: string): Promise<Set<string>> {
    await fsp.rm(outDir, { recursive: true, force: true });
    await fsp.mkdir(outDir, { recursive: true });
    const ok = new Set<string>();
    for (const f of meta.figures) {
      const page = pages[f.page - 1];
      // Id-en blir et filnavn; parseMeta slipper bare gjennom trygge tegn, men sjekk igjen her.
      if (!page || !/^[A-Za-z0-9_-]{1,40}$/.test(f.id)) continue;
      try {
        if (await cropFigure(path.join(pagesDir, page.file), page, f.box, path.join(outDir, `${f.id}.png`))) ok.add(f.id);
      } catch (err) {
        this.log.warn({ err, noteId, figure: f.id }, 'klarte ikke å klippe ut figur');
      }
    }
    return ok;
  }

  /** Figurene som finnes for et notat (id-er uten filendelse). */
  async availableFigures(id: string): Promise<Set<string>> {
    const files = await fsp.readdir(this.storage.figuresDir(id)).catch(() => [] as string[]);
    return new Set(files.filter((f) => f.endsWith('.png')).map((f) => f.slice(0, -4)));
  }

  /**
   * Kompilerer en dokumentkropp for notatet. Ved suksess lagres note.tex + note.pdf;
   * ved feil lagres kroppen som draft.tex slik at den kan redigeres.
   */
  async compileNote(id: string, body: string, info?: DocInfo): Promise<CompileOutcome> {
    const row = this.repo.getNoteRow(id);
    if (!row) throw new ConversionError('Notatet finnes ikke lenger.');
    return this.compileInto(this.storage.noteDir(id), this.storage.figuresDir(id), row, body, info);
  }

  /**
   * Kompilerer en dokumentkropp med notatets fag, PDF-mal og tittelblokk, med figurene i `figDir`. Resultatet lagres i
   * `outDir`: build.log, og note.pdf + note.tex ved suksess eller draft.tex ved feil.
   */
  async compileInto(outDir: string, figDir: string, row: NoteRow, body: string, info?: DocInfo): Promise<CompileOutcome> {
    const subject = this.repo.getSubject(row.subject_id);
    const profile: Profile = getProfile(subject?.profile ?? 'physics');
    const d = info ?? this.docInfo(row);
    const out = (name: 'build.log' | 'note.pdf' | 'note.tex' | 'draft.tex') => path.join(outDir, name);
    const work = await this.storage.makeTmpDir('build');
    try {
      if (await exists(figDir)) await fsp.cp(figDir, path.join(work, 'fig'), { recursive: true });
      const doc = assembleNoteDoc({
        preamble: readPreamble(profile),
        subjectName: subject?.name ?? '',
        chapterLabel: d.chapterLabel,
        sectionLabel: d.sectionLabel,
        title: d.title,
        dateIso: d.dateIso,
        figureDir: 'fig',
        body,
      });
      const res = await compileLatex(work, doc.tex, this.config.latexTimeoutMs);
      await writeFileAtomic(out('build.log'), res.log);
      if (res.ok) {
        const tmpPdf = out('note.pdf') + '.tmp';
        await fsp.copyFile(res.pdfPath, tmpPdf);
        await fsp.rename(tmpPdf, out('note.pdf'));
        await writeFileAtomic(out('note.tex'), body);
        await fsp.rm(out('draft.tex'), { force: true });
        return { ok: true };
      }
      await writeFileAtomic(out('draft.tex'), body);
      return { ok: false, errors: res.errors, bodyStartLine: doc.bodyStartLine, message: formatErrors(res.errors, doc.bodyStartLine) };
    } finally {
      await fsp.rm(work, { recursive: true, force: true });
    }
  }

  /** Tittelblokken og sidehodet slik notatet står nå (tittel, dato, kapittel og delkapittel). */
  docInfo(row: NoteRow): DocInfo {
    const chapter = row.chapter_id ? this.repo.getChapter(row.chapter_id) : null;
    const section = chapter?.sections.find((x) => x.code === row.section);
    return {
      title: row.title || 'Notat',
      dateIso: row.note_date,
      chapterLabel: chapterLabel(chapter),
      sectionLabel: section ? `${section.code} ${section.title}` : null,
    };
  }

  /**
   * Når tittel, dato eller kapittel endres, lages PDF-en på nytt med samme LaTeX-kropp (uten Claude),
   * slik at tittelblokken og sidehodet stemmer. Kjøres i bakgrunnen; status vises som «compiling».
   */
  recompileInBackground(id: string): void {
    const row = this.repo.getNoteRow(id);
    if (!row || row.status !== 'done') return;
    const pending = this.recompiles.get(id);
    if (pending) {
      pending.again = true;
      return;
    }
    const state = { again: false };
    this.recompiles.set(id, state);
    const job = (async () => {
      try {
        do {
          state.again = false;
          const body = await fsp.readFile(this.storage.noteFile(id, 'note.tex'), 'utf8').catch(() => null);
          if (body === null) return;
          this.repo.markRecompiling(id);
          const res = await this.recompileSlots.run(() => this.compileNote(id, body));
          if (res.ok) this.repo.bumpPdfIfDone(id);
          else {
            // Kroppen kompilerte før, så dette skal ikke skje – behold forrige PDF.
            await fsp.rm(this.storage.noteFile(id, 'draft.tex'), { force: true });
            this.repo.finishRecompileWithoutChange(id);
            this.log.warn({ noteId: id, errors: res.message }, 'rekompilering feilet');
          }
        } while (state.again);
      } catch (err) {
        this.log.error({ err, noteId: id }, 'rekompilering feilet');
        this.repo.finishRecompileWithoutChange(id);
      } finally {
        this.recompiles.delete(id);
      }
    })();
    this.running.add(job);
    void job.finally(() => this.running.delete(job));
  }

  /** Venter til alle rekompileringer i bakgrunnen er ferdige (ved avslutning, før databasen lukkes). */
  async idle(): Promise<void> {
    while (this.running.size > 0) await Promise.allSettled([...this.running]);
  }

  private readonly recompiles = new Map<string, { again: boolean }>();
  private readonly running = new Set<Promise<void>>();
  /** Maks to samtidige rekompileringer (f.eks. når et kapittel med mange notater får nytt navn). */
  private readonly recompileSlots = new Semaphore(2);

  /** Den gjeldende LaTeX-kroppen: siste utkast hvis det finnes (feilet), ellers siste vellykkede. */
  async currentBody(id: string): Promise<string | null> {
    for (const name of ['draft.tex', 'note.tex'] as const) {
      const p = this.storage.noteFile(id, name);
      if (await exists(p)) return fsp.readFile(p, 'utf8');
    }
    return null;
  }

  /** Full .tex-fil (preamble + kropp) for nedlasting. */
  async fullTex(id: string): Promise<string | null> {
    const row = this.repo.getNoteRow(id);
    const body = await this.currentBody(id);
    if (!row || body === null) return null;
    const subject = this.repo.getSubject(row.subject_id);
    const chapter = row.chapter_id ? this.repo.getChapter(row.chapter_id) : null;
    return assembleNoteDoc({
      preamble: readPreamble(getProfile(subject?.profile ?? 'physics')),
      subjectName: subject?.name ?? '',
      chapterLabel: chapterLabel(chapter),
      sectionLabel: this.docInfo(row).sectionLabel,
      title: row.title || 'Notat',
      dateIso: row.note_date,
      figureDir: 'figurer',
      body,
    }).tex;
  }
}
