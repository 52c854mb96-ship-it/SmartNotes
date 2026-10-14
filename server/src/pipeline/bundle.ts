import { createHash } from 'node:crypto';
import fsp from 'node:fs/promises';
import path from 'node:path';
import type { FastifyBaseLogger } from 'fastify';
import type { Config } from '../config.js';
import type { NoteRow, Repo, UserRepo } from '../db.js';
import { HttpError, notFound } from '../errors.js';
import { userTextbook } from '../presets.js';
import { getProfile, readPreamble } from '../profiles/index.js';
import { exists, type Storage } from '../storage.js';
import { EXTRA_PREAMBLE, assembleBundleDoc, chapterLabel, compileLatex, formatErrors, type BundleNote, type BundleSection } from './latex.js';

export interface BuildInput {
  subjectName: string;
  title: string;
  subtitle: string;
  headerLabel: string;
  sections: { heading: string | null; pageHeader?: string; notes: NoteRow[] }[];
}

/**
 * Samle-PDF-er: alle ferdige notater i et kapittel, eller i et helt fag, i én PDF med innholdsliste.
 * Lages ved behov og caches på disk med en nøkkel som endres når noe av innholdet endres.
 */
export class Bundler {
  private readonly inflight = new Map<string, Promise<string>>();

  constructor(
    private readonly repo: Repo,
    private readonly storage: Storage,
    private readonly config: Config,
    private readonly log: FastifyBaseLogger,
  ) {}

  /** Samle-PDF for et kapittel; `r` er brukerens utsnitt, så et kapittel som ikke er brukerens, gir 404. */
  async chapterPdf(r: UserRepo, chapterId: string): Promise<{ file: string; filename: string }> {
    const chapter = r.getChapter(chapterId);
    if (!chapter) throw notFound('Fant ikke kapittelet.');
    const subject = r.getSubject(chapter.subjectId);
    if (!subject) throw notFound('Fant ikke faget.');
    const notes = r.doneNotes({ chapterId });
    if (notes.length === 0) throw notFound('Det er ingen ferdige notater i dette kapittelet ennå.');
    const label = chapterLabel(chapter);
    // Grupper etter delkapittel når kapittelet har delkapitler; notater uten delkapittel kommer sist.
    const groups: { heading: string | null; notes: NoteRow[] }[] =
      chapter.sections.length === 0
        ? [{ heading: null, notes }]
        : [
            ...chapter.sections.map((x) => ({ heading: `${x.code} ${x.title}`, notes: notes.filter((n) => n.section === x.code) })),
            { heading: 'Uten delkapittel', notes: notes.filter((n) => !n.section || !chapter.sections.some((x) => x.code === n.section)) },
          ].filter((g) => g.notes.length > 0);
    const file = await this.build(
      `chapter-${chapterId}`,
      subject.profile,
      {
        subjectName: subject.name,
        title: label,
        subtitle: [subject.name, userTextbook(subject)].filter(Boolean).join(' · '),
        headerLabel: label,
        sections: groups,
      },
      () => !!this.repo.getChapter(chapterId) && this.stillThere(notes),
    );
    return { file, filename: `${slug(`${subject.name} ${label}`)}.pdf` };
  }

  async subjectPdf(r: UserRepo, subjectId: string): Promise<{ file: string; filename: string }> {
    const subject = r.getSubject(subjectId);
    if (!subject) throw notFound('Fant ikke faget.');
    const notes = r.doneNotes({ subjectId });
    if (notes.length === 0) throw notFound('Det er ingen ferdige notater i dette faget ennå.');
    const chapters = r.listChapters(subjectId);
    const sections: { heading: string; pageHeader: string; notes: NoteRow[] }[] = chapters
      .map((c) => ({ heading: chapterLabel(c), pageHeader: chapterLabel(c), notes: notes.filter((n) => n.chapter_id === c.id) }))
      .filter((s) => s.notes.length > 0);
    const known = new Set(chapters.map((c) => c.id));
    const unsorted = notes.filter((n) => !n.chapter_id || !known.has(n.chapter_id));
    if (unsorted.length > 0) sections.push({ heading: 'Uten kapittel', pageHeader: 'Uten kapittel', notes: unsorted });
    const file = await this.build(
      `subject-${subjectId}`,
      subject.profile,
      {
        subjectName: subject.name,
        title: subject.name,
        subtitle: userTextbook(subject) ? `Notater · ${userTextbook(subject)}` : 'Notater',
        headerLabel: '',
        sections,
      },
      () => !!this.repo.getSubject(subjectId) && this.stillThere(notes),
    );
    return { file, filename: `${slug(subject.name)}-notater.pdf` };
  }

  /** Om notatene fortsatt finnes (ikke slettet, alene eller med faget eller kontoen). */
  private stillThere(notes: NoteRow[]): boolean {
    return notes.every((n) => this.repo.getNoteRow(n.id) !== null);
  }

  /**
   * `current` sier om kapittelet eller faget og notatene fortsatt finnes. Den sjekkes når PDF-en er lagret: ble noe
   * slettet mens den ble laget, fjernes den igjen, så innhold eleven har slettet, ikke blir liggende i `bundles/`.
   */
  private async build(
    prefix: string,
    profileId: string,
    input: BuildInput,
    current: () => boolean,
  ): Promise<string> {
    const profile = getProfile(profileId);
    const preamble = readPreamble(profile);
    const key = bundleKey(preamble, input);
    const target = path.join(this.storage.bundlesRoot, `${prefix}-${key}.pdf`);
    if (await exists(target)) return target;

    const running = this.inflight.get(target);
    if (running) return running;
    const job = this.compile(target, prefix, preamble, input, current).finally(() => this.inflight.delete(target));
    this.inflight.set(target, job);
    return job;
  }

  private async compile(
    target: string,
    prefix: string,
    preamble: string,
    input: BuildInput,
    current: () => boolean,
  ): Promise<string> {
    const work = await this.storage.makeTmpDir('bundle');
    try {
      const sections: BundleSection[] = [];
      for (const s of input.sections) {
        const notes: BundleNote[] = [];
        for (const n of s.notes) {
          const body = await fsp.readFile(this.storage.noteFile(n.id, 'note.tex'), 'utf8').catch(() => null);
          if (body === null) continue;
          const figDir = this.storage.figuresDir(n.id);
          if (await exists(figDir)) await fsp.cp(figDir, path.join(work, n.id), { recursive: true });
          notes.push({ id: n.id, title: n.title || 'Notat', dateIso: n.note_date, figureDir: n.id, body });
        }
        if (notes.length > 0) sections.push({ heading: s.heading, pageHeader: s.pageHeader, notes });
      }
      if (sections.length === 0) throw notFound('Fant ingen ferdige notater å sette sammen.');
      const tex = assembleBundleDoc({ preamble, ...input, sections });
      const res = await compileLatex(work, tex, this.config.bundleTimeoutMs);
      if (!res.ok) {
        this.log.error({ prefix, errors: formatErrors(res.errors, 1) }, 'samle-PDF kompilerte ikke');
        throw new HttpError(500, 'bundle_failed', 'Klarte ikke å sette sammen PDF-en. Prøv igjen senere.');
      }
      // Fjern eldre versjoner av samme samle-PDF.
      const old = (await fsp.readdir(this.storage.bundlesRoot)).filter((f) => f.startsWith(`${prefix}-`));
      await Promise.all(old.map((f) => fsp.rm(path.join(this.storage.bundlesRoot, f), { force: true })));
      const tmp = `${target}.tmp`;
      await fsp.copyFile(res.pdfPath, tmp);
      await fsp.rename(tmp, target);
      // Sjekkes etter at fila er på plass: en sletting før dette fjernes her, en sletting etter dette fjerner fila selv.
      if (!current()) {
        await fsp.rm(target, { force: true });
        throw new HttpError(409, 'changed', 'Noe ble slettet mens PDF-en ble laget. Prøv igjen.');
      }
      return target;
    } finally {
      await fsp.rm(work, { recursive: true, force: true });
    }
  }
}

/**
 * Nøkkelen i filnavnet til en samle-PDF. Den endres når malen, det felles tillegget (`EXTRA_PREAMBLE`: bokser og
 * bunnteksten «AI-generert») eller noe av innholdet endres, så en lagret PDF aldri er eldre enn det den viser.
 */
export function bundleKey(preamble: string, input: BuildInput, extra = EXTRA_PREAMBLE): string {
  return createHash('sha256')
    .update(
      JSON.stringify({
        preamble,
        extra,
        ...input,
        sections: input.sections.map((s) => ({ h: s.heading, n: s.notes.map((n) => [n.id, n.pdf_rev, n.title, n.note_date, n.section]) })),
      }),
    )
    .digest('hex')
    .slice(0, 16);
}

export function slug(s: string): string {
  return (
    s
      .toLowerCase()
      .replace(/æ/g, 'ae')
      .replace(/ø/g, 'o')
      .replace(/å/g, 'a')
      .normalize('NFKD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 80) || 'notater'
  );
}
