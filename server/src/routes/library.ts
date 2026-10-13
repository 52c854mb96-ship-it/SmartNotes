import fs from 'node:fs';
import type { FastifyInstance, FastifyReply } from 'fastify';
import sharp from 'sharp';
import { z } from 'zod';
import type { ChapterPreviewResponse, SubjectPresetsResponse, SyncResponse } from '@smartnotes/shared';
import type { Repo } from '../db.js';
import { ConversionError, HttpError, badRequest, notFound } from '../errors.js';
import type { Bundler } from '../pipeline/bundle.js';
import type { AiService } from '../pipeline/ai.js';
import { aiConfigured } from '../pipeline/providers.js';
import type { Converter } from '../pipeline/converter.js';
import { fitScale, sniffKind } from '../pipeline/images.js';
import { SUBJECT_PRESETS } from '../presets.js';
import { getProfile, isProfile } from '../profiles/index.js';
import { isId, type Storage } from '../storage.js';
import { cleanChapterInputs, parseTocText } from '../toc.js';
import { usageScope } from '../usage.js';

interface Deps {
  repo: Repo;
  storage: Storage;
  ai: AiService;
  converter: Converter;
  bundler: Bundler;
}

const name = z.string().trim().min(1, 'Navnet kan ikke være tomt.').max(80, 'Navnet er for langt.');
const textbook = z.string().trim().max(120, 'Teksten er for lang.').nullable();
const chapterNumber = z
  .string()
  .trim()
  .max(20, 'Kapittelnummeret er for langt.')
  .nullable()
  .transform((v) => (v ? v : null));
const chapterTitle = z.string().trim().min(1, 'Kapittelet må ha en tittel.').max(200, 'Tittelen er for lang.');
const sectionList = z
  .array(
    z.object({
      code: z.string().trim().min(1, 'Delkapittelet må ha en kode.').max(12, 'Koden er for lang.'),
      title: z.string().trim().min(1, 'Delkapittelet må ha en tittel.').max(200, 'Tittelen er for lang.'),
      aims: z.array(z.string().trim().max(12)).max(30).default([]),
    }),
  )
  .max(60, 'For mange delkapitler.')
  .refine((list) => new Set(list.map((x) => x.code.toUpperCase())).size === list.length, 'To delkapitler har samme kode.');
const chapterInput = z.object({ number: chapterNumber.optional().default(null), title: chapterTitle, sections: sectionList.optional() });

/** Validerer en request-body med zod og gir norsk feilmelding. */
export function parse<T extends z.ZodType>(schema: T, data: unknown): z.infer<T> {
  const r = schema.safeParse(data);
  if (!r.success) throw badRequest(r.error.issues[0]?.message ?? 'Ugyldige data.');
  return r.data;
}

function idParam(id: string): string {
  if (!isId(id)) throw notFound();
  return id;
}

export async function sendPdf(reply: FastifyReply, file: string, filename: string, download: boolean): Promise<FastifyReply> {
  const stat = await fs.promises.stat(file);
  return reply
    .type('application/pdf')
    .header('Content-Length', stat.size)
    .header('Cache-Control', 'private, no-cache')
    .header('Content-Disposition', `${download ? 'attachment' : 'inline'}; filename="${filename.replace(/"/g, '')}"`)
    .send(fs.createReadStream(file));
}

export function registerLibraryRoutes(app: FastifyInstance, d: Deps): void {
  const { repo, storage, ai, converter, bundler } = d;

  const recompileSubject = (subjectId: string) => {
    for (const n of repo.sync(0).notes.filter((n) => n.subjectId === subjectId && n.status === 'done')) converter.recompileInBackground(n.id);
  };
  const recompileChapter = (chapterId: string) => {
    for (const n of repo.sync(0).notes.filter((n) => n.chapterId === chapterId && n.status === 'done')) converter.recompileInBackground(n.id);
  };

  // ---------- Synk ----------

  app.get<{ Querystring: { since?: string } }>('/api/sync', async (req): Promise<SyncResponse> => {
    const since = Math.max(0, Number.parseInt(req.query.since ?? '0', 10) || 0);
    const r = repo.sync(since);
    return { ...r, full: since <= 0 };
  });

  // ---------- Fag ----------

  app.post('/api/subjects', async (req, reply) => {
    const body = parse(z.object({ name, profile: z.string().default('physics'), textbook: textbook.optional().default(null) }), req.body);
    if (!isProfile(body.profile)) throw badRequest('Ukjent fagtype.');
    reply.code(201);
    return repo.createSubject({ name: body.name, profile: body.profile, textbook: body.textbook || null });
  });

  // Fagoppsettene etter læreplanen, og om brukeren har faget fra før.
  app.get('/api/presets', async (): Promise<SubjectPresetsResponse> => {
    const subjects = repo.listSubjects();
    return {
      presets: Object.values(SUBJECT_PRESETS).map((p) => ({
        id: p.id,
        subjectName: p.subjectName,
        profile: p.profile,
        plan: p.udir.plan,
        aimCount: p.aims.length,
        chapterCount: p.chapters.length,
        added: subjects.some((s) => s.name === p.subjectName && s.profile === p.profile),
      })),
    };
  });

  app.post('/api/subjects/from-preset', async (req, reply) => {
    const body = parse(z.object({ presetId: z.string().max(100) }), req.body);
    const preset = Object.hasOwn(SUBJECT_PRESETS, body.presetId) ? SUBJECT_PRESETS[body.presetId] : undefined;
    if (!preset) throw notFound('Fant ikke fagoppsettet.');
    const subject = repo.addPreset(preset);
    if (!subject) throw new HttpError(409, 'exists', `Du har allerede ${preset.subjectName}.`);
    reply.code(201);
    return subject;
  });

  app.patch<{ Params: { id: string } }>('/api/subjects/:id', async (req) => {
    const id = idParam(req.params.id);
    const body = parse(z.object({ name: name.optional(), textbook: textbook.optional() }), req.body);
    const before = repo.getSubject(id);
    const s = repo.updateSubject(id, { name: body.name, textbook: body.textbook === undefined ? undefined : body.textbook || null });
    if (!s) throw notFound('Fant ikke faget.');
    if (before && before.name !== s.name) recompileSubject(id);
    return s;
  });

  app.delete<{ Params: { id: string } }>('/api/subjects/:id', async (req) => {
    const id = idParam(req.params.id);
    const noteIds = repo.deleteSubject(id);
    if (!noteIds) throw notFound('Fant ikke faget.');
    await Promise.all(noteIds.map((nid) => storage.removeNote(nid).catch(() => undefined)));
    return { ok: true };
  });

  app.get<{ Params: { id: string }; Querystring: { download?: string } }>('/api/subjects/:id/pdf', async (req, reply) => {
    const { file, filename } = await bundler.subjectPdf(idParam(req.params.id));
    return sendPdf(reply, file, filename, req.query.download === '1');
  });

  // ---------- Kapitler ----------

  const requireSubject = (id: string) => {
    const s = repo.getSubject(idParam(id));
    if (!s) throw notFound('Fant ikke faget.');
    return s;
  };

  app.post<{ Params: { id: string } }>('/api/subjects/:id/chapters', async (req, reply) => {
    const s = requireSubject(req.params.id);
    const body = parse(chapterInput, req.body);
    reply.code(201);
    return repo.createChapters(s.id, [body])[0];
  });

  app.post<{ Params: { id: string } }>('/api/subjects/:id/chapters/bulk', async (req, reply) => {
    const s = requireSubject(req.params.id);
    const body = parse(z.object({ chapters: z.array(chapterInput).min(1, 'Ingen kapitler å legge til.').max(200) }), req.body);
    reply.code(201);
    return { chapters: repo.createChapters(s.id, body.chapters) };
  });

  app.post<{ Params: { id: string } }>('/api/subjects/:id/chapters/parse', async (req): Promise<ChapterPreviewResponse> => {
    const s = requireSubject(req.params.id);
    const body = parse(z.object({ text: z.string().max(50_000) }), req.body);
    const chapters = parseTocText(body.text);
    // Delkapitler fra teksten kobles til kompetansemålene av Claude. Går det ikke, får de bare ingen mål.
    if (s.aims.length && aiConfigured(ai, 'toc') && chapters.some((c) => c.sections?.length)) {
      try {
        const mapped = await usageScope({ subjectId: s.id }, () => ai.mapSectionAims(getProfile(s.profile), chapters, s.aims));
        return { chapters: cleanChapterInputs(mapped.chapters, s.aims) };
      } catch (err) {
        req.log.warn({ err }, 'kunne ikke koble delkapitler til kompetansemål');
      }
    }
    return { chapters };
  });

  app.post<{ Params: { id: string } }>('/api/subjects/:id/chapters/extract', async (req): Promise<ChapterPreviewResponse> => {
    const s = requireSubject(req.params.id);
    const images: { data: Buffer; mediaType: 'image/jpeg' }[] = [];
    for await (const part of req.parts()) {
      if (part.type !== 'file') continue;
      const buf = await part.toBuffer();
      if (images.length >= 6) continue;
      const kind = sniffKind(buf.subarray(0, 16));
      if (!kind || kind === 'pdf') throw badRequest('Last opp bilder (JPEG, PNG eller HEIC) av innholdsfortegnelsen.');
      try {
        const img = sharp(buf, { failOn: 'none' }).rotate();
        const meta = await img.metadata();
        const w = meta.autoOrient?.width ?? meta.width ?? 2000;
        const h = meta.autoOrient?.height ?? meta.height ?? 2000;
        const scale = fitScale(w, h);
        const data = await img
          .resize(Math.round(w * scale), Math.round(h * scale), { fit: 'inside' })
          .jpeg({ quality: 88 })
          .toBuffer();
        images.push({ data, mediaType: 'image/jpeg' });
      } catch {
        throw badRequest('Klarte ikke å lese bildet. Prøv JPEG eller PNG.');
      }
    }
    if (images.length === 0) throw badRequest('Last opp minst ett bilde av innholdsfortegnelsen.');
    try {
      const read = await usageScope({ subjectId: s.id }, () => ai.extractToc(getProfile(s.profile), images, s.aims));
      return { chapters: cleanChapterInputs(read.chapters, s.aims) };
    } catch (err) {
      if (err instanceof ConversionError) throw new HttpError(err.retryable ? 503 : 422, 'claude_failed', err.message);
      throw err;
    }
  });

  app.post<{ Params: { id: string } }>('/api/subjects/:id/chapters/reorder', async (req) => {
    const s = requireSubject(req.params.id);
    const body = parse(z.object({ ids: z.array(z.string()).max(500) }), req.body);
    repo.reorderChapters(s.id, body.ids);
    return { ok: true };
  });

  app.patch<{ Params: { id: string } }>('/api/chapters/:id', async (req) => {
    const id = idParam(req.params.id);
    const body = parse(z.object({ number: chapterNumber.optional(), title: chapterTitle.optional(), sections: sectionList.optional() }), req.body);
    const c = repo.updateChapter(id, body);
    if (!c) throw notFound('Fant ikke kapittelet.');
    recompileChapter(id);
    return c;
  });

  app.delete<{ Params: { id: string } }>('/api/chapters/:id', async (req) => {
    const id = idParam(req.params.id);
    const affected = repo.sync(0).notes.filter((n) => n.chapterId === id && n.status === 'done').map((n) => n.id);
    if (!repo.deleteChapter(id)) throw notFound('Fant ikke kapittelet.');
    for (const nid of affected) converter.recompileInBackground(nid);
    return { ok: true };
  });

  app.get<{ Params: { id: string }; Querystring: { download?: string } }>('/api/chapters/:id/pdf', async (req, reply) => {
    const { file, filename } = await bundler.chapterPdf(idParam(req.params.id));
    return sendPdf(reply, file, filename, req.query.download === '1');
  });

}
