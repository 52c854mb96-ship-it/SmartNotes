import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { NoteLatexResponse, NotePagesResponse, SaveLatexResponse } from '@smartnotes/shared';
import type { NoteFileRow, Repo } from '../db.js';
import { badRequest, conflict, notFound } from '../errors.js';
import { slug } from '../pipeline/bundle.js';
import type { Converter } from '../pipeline/converter.js';
import { MIME_BY_KIND, sniffKind, type FileKind, type PageImage } from '../pipeline/images.js';
import { replaceMissingFigures, sanitizeBody } from '../pipeline/latex.js';
import type { Worker } from '../pipeline/worker.js';
import { exists, isId, type Storage } from '../storage.js';
import { parse, sendPdf } from './library.js';

interface Deps {
  repo: Repo;
  storage: Storage;
  converter: Converter;
  worker: Worker;
}

const EXT_BY_KIND: Record<FileKind, string> = { pdf: 'pdf', jpeg: 'jpg', png: 'png', webp: 'webp', heic: 'heic', gif: 'gif', tiff: 'tiff' };

const dateField = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Datoen må være på formen ÅÅÅÅ-MM-DD.')
  .nullable();

export function registerNoteRoutes(app: FastifyInstance, d: Deps): void {
  const { repo, storage, converter, worker } = d;

  const requireNote = (id: string) => {
    const row = isId(id) ? repo.getNoteRow(id) : null;
    if (!row) throw notFound('Fant ikke notatet.');
    return row;
  };

  // ---------- Opplasting ----------

  app.post('/api/notes', async (req, reply) => {
    const tmp = await storage.makeTmpDir('upload');
    try {
      const fields: Record<string, string> = {};
      const files: { tmpFile: string; originalName: string; kind: FileKind; size: number }[] = [];
      for await (const part of req.parts()) {
        if (part.type === 'field') {
          fields[part.fieldname] = typeof part.value === 'string' ? part.value : String(part.value ?? '');
          continue;
        }
        if (part.fieldname !== 'files') {
          part.file.resume();
          continue;
        }
        const tmpFile = path.join(tmp, String(files.length).padStart(3, '0'));
        await pipeline(part.file, fs.createWriteStream(tmpFile));
        const head = Buffer.alloc(16);
        const fh = await fsp.open(tmpFile, 'r');
        const { bytesRead } = await fh.read(head, 0, 16, 0);
        await fh.close();
        const kind = sniffKind(head.subarray(0, bytesRead));
        if (!kind) {
          throw badRequest(`Filtypen til «${part.filename}» støttes ikke. Bruk bilder (JPEG, PNG, HEIC) eller PDF.`);
        }
        const size = (await fsp.stat(tmpFile)).size;
        files.push({ tmpFile, originalName: (part.filename || 'fil').slice(0, 200), kind, size });
      }

      const clientId = fields.clientId?.trim() || null;
      if (clientId && clientId.length > 100) throw badRequest('Ugyldig clientId.');
      if (clientId) {
        // Samme opplasting sendt på nytt (f.eks. etter brudd i nettet): svar med notatet vi allerede har.
        const existing = repo.getNoteByClientId(clientId);
        if (existing) return existing;
      }

      const subject = fields.subjectId && isId(fields.subjectId) ? repo.getSubject(fields.subjectId) : null;
      if (!subject) throw badRequest('Faget finnes ikke (lenger).');
      if (files.length === 0) throw badRequest('Ingen filer ble lastet opp.');

      // Hvis kapittelet er slettet mens opplastingen lå i køen, lar vi Claude velge i stedet.
      const chapterField = fields.chapterId?.trim() || 'auto';
      const chapter = chapterField !== 'auto' && isId(chapterField) ? repo.getChapter(chapterField) : null;
      const chapterOk = chapter && chapter.subjectId === subject.id;
      const noteDate = /^\d{4}-\d{2}-\d{2}$/.test(fields.noteDate ?? '') ? fields.noteDate! : null;
      const title = fields.title?.trim().slice(0, 120) || null;
      const instructions = fields.instructions?.trim().slice(0, 2000) || null;

      const noteId = randomUUID();
      const srcDir = storage.sourceDir(noteId);
      await fsp.mkdir(srcDir, { recursive: true });
      const fileRows: Omit<NoteFileRow, 'note_id'>[] = [];
      for (const [i, f] of files.entries()) {
        const filename = `${String(i + 1).padStart(3, '0')}.${EXT_BY_KIND[f.kind]}`;
        await fsp.rename(f.tmpFile, path.join(srcDir, filename));
        fileRows.push({ id: randomUUID(), position: i, original_name: f.originalName, mime: MIME_BY_KIND[f.kind], filename, size: f.size });
      }
      const note = repo.createNote({
        id: noteId,
        subjectId: subject.id,
        chapterId: chapterOk ? chapter.id : null,
        chapterAuto: !chapterOk,
        clientId,
        title,
        noteDate,
        instructions,
        files: fileRows,
      });
      worker.kick();
      reply.code(201);
      return note;
    } finally {
      await fsp.rm(tmp, { recursive: true, force: true });
    }
  });

  // ---------- Endringer ----------

  app.patch<{ Params: { id: string } }>('/api/notes/:id', async (req) => {
    const row = requireNote(req.params.id);
    const body = parse(
      z.object({
        title: z.string().trim().min(1, 'Tittelen kan ikke være tom.').max(120, 'Tittelen er for lang.').optional(),
        chapterId: z.string().nullable().optional(),
        noteDate: dateField.optional(),
      }),
      req.body,
    );
    if (body.chapterId) {
      const c = isId(body.chapterId) ? repo.getChapter(body.chapterId) : null;
      if (!c || c.subjectId !== row.subject_id) throw badRequest('Kapittelet finnes ikke i dette faget.');
    }
    const note = repo.updateNoteUser(row.id, body);
    const changed =
      (body.title !== undefined && body.title !== row.title) ||
      (body.chapterId !== undefined && body.chapterId !== row.chapter_id) ||
      (body.noteDate !== undefined && body.noteDate !== row.note_date);
    if (changed) converter.recompileInBackground(row.id);
    return note;
  });

  app.delete<{ Params: { id: string } }>('/api/notes/:id', async (req) => {
    const row = requireNote(req.params.id);
    repo.deleteNote(row.id);
    await storage.removeNote(row.id).catch(() => undefined);
    return { ok: true };
  });

  app.post<{ Params: { id: string } }>('/api/notes/:id/retry', async (req) => {
    const row = requireNote(req.params.id);
    if (row.status === 'processing') throw conflict('Notatet konverteres allerede.');
    const body = parse(z.object({ instructions: z.string().max(2000).nullable().optional() }).default({}), req.body ?? {});
    const note = repo.requeue(row.id, body.instructions === undefined ? undefined : body.instructions?.trim() || null);
    worker.kick();
    return note;
  });

  // ---------- PDF, LaTeX og originalsider ----------

  app.get<{ Params: { id: string }; Querystring: { download?: string } }>('/api/notes/:id/pdf', async (req, reply) => {
    const row = requireNote(req.params.id);
    const file = storage.noteFile(row.id, 'note.pdf');
    if (!(await exists(file))) throw notFound('PDF-en er ikke klar ennå.');
    reply.header('ETag', `"${row.pdf_rev}"`);
    return sendPdf(reply, file, `${slug(row.title || 'notat')}.pdf`, req.query.download === '1');
  });

  app.get<{ Params: { id: string } }>('/api/notes/:id/latex', async (req): Promise<NoteLatexResponse> => {
    const row = requireNote(req.params.id);
    const body = await converter.currentBody(row.id);
    if (body === null) throw notFound('Det finnes ingen LaTeX-kode for dette notatet ennå.');
    return { body };
  });

  app.put<{ Params: { id: string } }>('/api/notes/:id/latex', async (req): Promise<SaveLatexResponse> => {
    const row = requireNote(req.params.id);
    if (row.status === 'processing' || row.status === 'queued') throw conflict('Vent til konverteringen er ferdig før du redigerer.');
    const { body: raw } = parse(z.object({ body: z.string().min(1, 'LaTeX-koden er tom.').max(1_000_000) }), req.body);
    const body = replaceMissingFigures(sanitizeBody(raw), await converter.availableFigures(row.id));
    const res = await converter.compileNote(row.id, body);
    if (res.ok) {
      return { ok: true, note: repo.bumpPdf(row.id)! };
    }
    return { ok: false, note: repo.getNote(row.id)!, error: res.message };
  });

  app.get<{ Params: { id: string } }>('/api/notes/:id/tex', async (req, reply) => {
    const row = requireNote(req.params.id);
    const tex = await converter.fullTex(row.id);
    if (tex === null) throw notFound('Det finnes ingen LaTeX-kode for dette notatet ennå.');
    return reply
      .type('application/x-tex; charset=utf-8')
      .header('Content-Disposition', `attachment; filename="${slug(row.title || 'notat')}.tex"`)
      .send(`% Laget av SmartNotes. Figurer klippet fra originalen ligger i mappen «figurer».\n${tex}`);
  });

  const readPages = async (id: string): Promise<PageImage[]> => {
    try {
      return JSON.parse(await fsp.readFile(storage.noteFile(id, 'pages.json'), 'utf8')) as PageImage[];
    } catch {
      return [];
    }
  };

  app.get<{ Params: { id: string } }>('/api/notes/:id/pages', async (req): Promise<NotePagesResponse> => {
    const row = requireNote(req.params.id);
    const pages = await readPages(row.id);
    return { pages: pages.map((p) => ({ index: p.index, width: p.width, height: p.height })) };
  });

  app.get<{ Params: { id: string; index: string } }>('/api/notes/:id/pages/:index', async (req, reply) => {
    const row = requireNote(req.params.id);
    const index = Number.parseInt(req.params.index, 10);
    const page = (await readPages(row.id)).find((p) => p.index === index);
    if (!page) throw notFound('Fant ikke siden.');
    const file = path.join(storage.pagesDir(row.id), path.basename(page.file));
    if (!(await exists(file))) throw notFound('Fant ikke siden.');
    return reply.type('image/jpeg').header('Cache-Control', 'private, max-age=86400').send(fs.createReadStream(file));
  });
}
