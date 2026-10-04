import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Chapter, ChapterInput, Note, SaveLatexResponse, Subject, SyncResponse } from '@smartnotes/shared';
import { buildApp, type AppContext } from '../src/app.js';
import { loadConfig } from '../src/config.js';
import { FakeClaude } from '../src/pipeline/claude.js';

let ctx: AppContext;
let base = '';
let cookie = '';
let dataDir = '';
let pngPage: Buffer;
let pdfDoc: Buffer;

async function call<T = unknown>(
  method: string,
  url: string,
  opts: { json?: unknown; form?: FormData; csrf?: boolean; auth?: boolean } = {},
): Promise<{ status: number; body: T; headers: Headers; raw: Buffer }> {
  const headers: Record<string, string> = {};
  if (opts.auth !== false && cookie) headers.cookie = cookie;
  if (opts.csrf !== false && method !== 'GET') headers['x-smartnotes'] = '1';
  let body: string | FormData | undefined;
  if (opts.json !== undefined) {
    headers['content-type'] = 'application/json';
    body = JSON.stringify(opts.json);
  } else if (opts.form) body = opts.form;
  const res = await fetch(base + url, { method, headers, body });
  const raw = Buffer.from(await res.arrayBuffer());
  const type = res.headers.get('content-type') ?? '';
  const parsed = type.includes('application/json') ? JSON.parse(raw.toString('utf8')) : raw;
  return { status: res.status, body: parsed as T, headers: res.headers, raw };
}

async function sync(since = 0): Promise<SyncResponse> {
  return (await call<SyncResponse>('GET', `/api/sync?since=${since}`)).body;
}

async function waitFor(noteId: string, pred: (n: Note) => boolean, timeoutMs = 60_000): Promise<Note> {
  const start = Date.now();
  for (;;) {
    const note = (await sync()).notes.find((n) => n.id === noteId);
    if (note && pred(note)) return note;
    if (Date.now() - start > timeoutMs) throw new Error(`Tidsavbrudd for ${noteId}: ${JSON.stringify(note)}`);
    await new Promise((r) => setTimeout(r, 150));
  }
}

function uploadForm(fields: Record<string, string>, files: { data: Buffer; name: string; type: string }[]): FormData {
  const form = new FormData();
  for (const [k, v] of Object.entries(fields)) form.append(k, v);
  for (const f of files) form.append('files', new Blob([new Uint8Array(f.data)], { type: f.type }), f.name);
  return form;
}

beforeAll(async () => {
  dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'smartnotes-test-'));
  const config = loadConfig({ ...process.env, NODE_ENV: 'test', DATA_DIR: dataDir, APP_PASSWORD: 'hemmelig', WEB_DIST: '', SEED_TEXTBOOK: 'none' });
  ctx = await buildApp({ ...config, webDist: null }, { claude: new FakeClaude(5), logger: false });
  ctx.worker.start();
  await ctx.app.listen({ port: 0, host: '127.0.0.1' });
  const addr = ctx.app.server.address();
  base = `http://127.0.0.1:${typeof addr === 'object' && addr ? addr.port : 0}`;

  // Et «håndskrevet» sidebilde og en PDF med to sider.
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="1600"><rect width="100%" height="100%" fill="#f4f1e8"/>
    <text x="100" y="200" font-size="80">Newtons lover</text><circle cx="600" cy="700" r="200" stroke="black" stroke-width="8" fill="none"/></svg>`;
  pngPage = await sharp(Buffer.from(svg)).png().toBuffer();
  const texDir = fs.mkdtempSync(path.join(os.tmpdir(), 'smartnotes-pdf-'));
  fs.writeFileSync(path.join(texDir, 'a.tex'), '\\documentclass{article}\\begin{document}Side en\\newpage Side to\\end{document}');
  execFileSync('pdflatex', ['-interaction=nonstopmode', 'a.tex'], { cwd: texDir });
  pdfDoc = fs.readFileSync(path.join(texDir, 'a.pdf'));
});

afterAll(async () => {
  await ctx?.worker.stop();
  await ctx?.worker.idle();
  await ctx?.app.close();
  fs.rmSync(dataDir, { recursive: true, force: true });
});

describe('innlogging', () => {
  it('helsesjekk er åpen, alt annet krever innlogging', async () => {
    const h = await call<{ ok: boolean; latex: boolean; fakeClaude: boolean }>('GET', '/api/health', { auth: false });
    expect(h.status).toBe(200);
    expect(h.body).toMatchObject({ ok: true, latex: true, fakeClaude: true });
    expect((await call('GET', '/api/sync', { auth: false })).status).toBe(401);
  });

  it('avviser feil passord og mutasjoner uten sikkerhetsheader', async () => {
    const wrong = await call<{ message: string }>('POST', '/api/auth/login', { json: { password: 'feil' }, auth: false });
    expect(wrong.status).toBe(401);
    expect(wrong.body.message).toBe('Feil passord.');
    const noCsrf = await call('POST', '/api/auth/login', { json: { password: 'hemmelig' }, csrf: false, auth: false });
    expect(noCsrf.status).toBe(403);
  });

  it('logger inn med riktig passord', async () => {
    const res = await call('POST', '/api/auth/login', { json: { password: 'hemmelig' }, auth: false });
    expect(res.status).toBe(200);
    const setCookie = res.headers.get('set-cookie') ?? '';
    expect(setCookie).toMatch(/sn_session=/);
    expect(setCookie).toMatch(/HttpOnly/i);
    cookie = setCookie.split(';')[0]!;
    expect((await call<{ authenticated: boolean }>('GET', '/api/auth/me')).body.authenticated).toBe(true);
  });
});

describe('fag, kapitler og notater', () => {
  let physics: Subject;
  let chapters: Chapter[];
  let noteId = '';

  it('har faget Fysikk fra start', async () => {
    const s = await sync();
    expect(s.full).toBe(true);
    physics = s.subjects.find((x) => x.name === 'Fysikk')!;
    expect(physics.profile).toBe('physics');
  });

  it('tolker og legger inn kapitler fra læreboka', async () => {
    const parsed = await call<{ chapters: { number: string | null; title: string }[] }>('POST', `/api/subjects/${physics.id}/chapters/parse`, {
      json: { text: '1 Fysikk og måling .... 9\n2 Bevegelse .... 31\n3 Newtons lover .... 61' },
    });
    expect(parsed.body.chapters).toHaveLength(3);
    const res = await call<{ chapters: Chapter[] }>('POST', `/api/subjects/${physics.id}/chapters/bulk`, { json: { chapters: parsed.body.chapters } });
    expect(res.status).toBe(201);
    chapters = res.body.chapters;
    expect(chapters.map((c) => c.number)).toEqual(['1', '2', '3']);
    const fromPhoto = await call<{ chapters: ChapterInput[] }>('POST', `/api/subjects/${physics.id}/chapters/extract`, {
      form: uploadForm({}, [{ data: pngPage, name: 'toc.png', type: 'image/png' }]),
    });
    expect(fromPhoto.status).toBe(200);
    expect(fromPhoto.body.chapters.length).toBeGreaterThan(0);
    // Delkapitlene fra bildet kobles til fagets kompetansemål (falsk Claude velger første mål som ikke er tverrgående).
    const firstAim = physics.aims.find((a) => !a.cross)?.code;
    const withSections = fromPhoto.body.chapters.find((c) => c.sections?.length);
    expect(withSections?.sections?.[0]?.aims).toEqual(firstAim ? [firstAim] : []);
  });

  it('legger inn delkapitler fra innlimt tekst og oppdaterer et kapittel som finnes', async () => {
    const parsed = await call<{ chapters: ChapterInput[] }>('POST', `/api/subjects/${physics.id}/chapters/parse`, {
      json: { text: '20 Testkapittel\n20A Første del\n20B Andre del\n21 Neste' },
    });
    expect(parsed.status).toBe(200);
    expect(parsed.body.chapters.map((c) => [c.number, c.sections?.map((x) => x.code) ?? []])).toEqual([
      ['20', ['20A', '20B']],
      ['21', []],
    ]);
    const firstAim = physics.aims.find((a) => !a.cross)?.code;
    if (firstAim) expect(parsed.body.chapters[0]!.sections![0]!.aims).toEqual([firstAim]);

    const res = await call<{ chapters: Chapter[] }>('POST', `/api/subjects/${physics.id}/chapters/bulk`, { json: { chapters: parsed.body.chapters } });
    expect(res.status).toBe(201);
    const [ch20] = res.body.chapters;
    expect(ch20!.sections.map((x) => x.title)).toEqual(['Første del', 'Andre del']);

    // To delkapitler med samme kode avvises
    const dup = await call('POST', `/api/subjects/${physics.id}/chapters/bulk`, {
      json: { chapters: [{ number: '22', title: 'X', sections: [{ code: '22A', title: 'a' }, { code: '22a', title: 'b' }] }] },
    });
    expect(dup.status).toBe(400);

    const upd = await call<Chapter>('PATCH', `/api/chapters/${ch20!.id}`, {
      json: { title: 'Testkapittel (ny)', sections: [{ code: '20A', title: 'Første del', aims: [] }] },
    });
    expect(upd.status).toBe(200);
    expect(upd.body.sections).toHaveLength(1);
    for (const c of res.body.chapters) expect((await call('DELETE', `/api/chapters/${c.id}`)).status).toBe(200);
  });

  it('laster opp et bilde, konverterer det og lager PDF', async () => {
    const res = await call<Note>('POST', '/api/notes', {
      form: uploadForm({ subjectId: physics.id, clientId: 'klient-1', chapterId: 'auto' }, [{ data: pngPage, name: 'side1.png', type: 'image/png' }]),
    });
    expect(res.status).toBe(201);
    expect(res.body.status).toBe('queued');
    noteId = res.body.id;

    const done = await waitFor(noteId, (n) => n.status === 'done' || n.status === 'failed');
    expect(done.error).toBeNull();
    expect(done.status).toBe('done');
    expect(done.pdfRev).toBe(1);
    expect(done.chapterId).toBe(chapters[0]!.id); // falsk Claude velger første kapittel
    expect(done.title).toBe('Testnotat (1 side)');
    expect(done.remarks.length).toBeGreaterThan(0);

    const pdf = await call('GET', `/api/notes/${noteId}/pdf`);
    expect(pdf.status).toBe(200);
    expect(pdf.headers.get('content-type')).toBe('application/pdf');
    expect(pdf.raw.subarray(0, 4).toString()).toBe('%PDF');

    const pages = await call<{ pages: { index: number; width: number; height: number }[] }>('GET', `/api/notes/${noteId}/pages`);
    expect(pages.body.pages).toEqual([{ index: 0, width: 1200, height: 1600 }]);
    const img = await call('GET', `/api/notes/${noteId}/pages/0`);
    expect(img.headers.get('content-type')).toBe('image/jpeg');

    expect(fs.existsSync(path.join(dataDir, 'notes', noteId, 'figures', 'fig1.png'))).toBe(true);
    const latex = await call<{ body: string }>('GET', `/api/notes/${noteId}/latex`);
    expect(latex.body.body).toContain('\\originalfigur[0.5]{fig1}');
    const tex = await call('GET', `/api/notes/${noteId}/tex`);
    expect(tex.raw.toString()).toContain('\\documentclass');
  });

  it('samme clientId gir samme notat (trygg ny sending fra offline-køen)', async () => {
    const before = (await sync()).notes.length;
    const res = await call<Note>('POST', '/api/notes', {
      form: uploadForm({ subjectId: physics.id, clientId: 'klient-1', chapterId: 'auto' }, [{ data: pngPage, name: 'side1.png', type: 'image/png' }]),
    });
    expect(res.body.id).toBe(noteId);
    expect((await sync()).notes.length).toBe(before);
  });

  it('avviser filtyper som ikke støttes', async () => {
    const res = await call<{ message: string }>('POST', '/api/notes', {
      form: uploadForm({ subjectId: physics.id, clientId: 'klient-x' }, [{ data: Buffer.from('bare tekst'), name: 'a.txt', type: 'text/plain' }]),
    });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/støttes ikke/);
  });

  it('avviser for store filer med norsk melding', async () => {
    const big = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(31 * 1024 * 1024)]);
    const res = await call<{ message: string }>('POST', '/api/notes', {
      form: uploadForm({ subjectId: physics.id, clientId: 'klient-stor' }, [{ data: big, name: 'stor.jpg', type: 'image/jpeg' }]),
    });
    expect(res.status).toBe(413);
    expect(res.body.message).toMatch(/for stor/);
  });

  it('ny tittel gir ny PDF i bakgrunnen', async () => {
    const res = await call<Note>('PATCH', `/api/notes/${noteId}`, { json: { title: 'Newtons lover' } });
    expect(res.body.title).toBe('Newtons lover');
    const n = await waitFor(noteId, (x) => x.pdfRev === 2 && x.stage === null);
    expect(n.status).toBe('done');
  });

  it('redigering av LaTeX: feil vises, riktig kode gir ny PDF', async () => {
    const bad = await call<SaveLatexResponse>('PUT', `/api/notes/${noteId}/latex`, { json: { body: 'Hei\n\\begin{formel}\nuten slutt\n' } });
    expect(bad.body.ok).toBe(false);
    expect(bad.body.error).toBeTruthy();
    expect(bad.body.note.pdfRev).toBe(2);
    const good = await call<SaveLatexResponse>('PUT', `/api/notes/${noteId}/latex`, { json: { body: '\\section{Ny}\n$E = mc^2$\n' } });
    expect(good.body.ok).toBe(true);
    expect(good.body.note.pdfRev).toBe(3);
  });

  it('retter LaTeX-feil automatisk', async () => {
    const res = await call<Note>('POST', '/api/notes', {
      form: uploadForm({ subjectId: physics.id, clientId: 'klient-feil', chapterId: chapters[2]!.id, instructions: 'FEIL', title: 'Med feil' }, [
        { data: pngPage, name: 's.png', type: 'image/png' },
      ]),
    });
    const done = await waitFor(res.body.id, (n) => n.status === 'done' || n.status === 'failed');
    expect(done.status).toBe('done');
    expect(done.chapterId).toBe(chapters[2]!.id); // brukerens valg står fast
    expect(done.title).toBe('Med feil');
  });

  it('PDF-opplasting blir til sidebilder', async () => {
    const res = await call<Note>('POST', '/api/notes', {
      form: uploadForm({ subjectId: physics.id, clientId: 'klient-pdf' }, [{ data: pdfDoc, name: 'notat.pdf', type: 'application/pdf' }]),
    });
    const done = await waitFor(res.body.id, (n) => n.status === 'done' || n.status === 'failed');
    expect(done.status).toBe('done');
    expect(done.pageCount).toBe(2);
  });

  it('lager samle-PDF for kapittel og fag', async () => {
    const ch = await call('GET', `/api/chapters/${chapters[0]!.id}/pdf`);
    expect(ch.status).toBe(200);
    expect(ch.raw.subarray(0, 4).toString()).toBe('%PDF');
    const subj = await call('GET', `/api/subjects/${physics.id}/pdf?download=1`);
    expect(subj.status).toBe(200);
    expect(subj.headers.get('content-disposition')).toMatch(/attachment/);
    const empty = await call<{ message: string }>('GET', `/api/chapters/${chapters[1]!.id}/pdf`);
    expect(empty.status).toBe(404);
    expect(empty.body.message).toMatch(/ingen ferdige notater/);
  });

  it('inkrementell synk gir endringer og gravsteiner', async () => {
    const { cursor } = await sync();
    const del = await call('DELETE', `/api/chapters/${chapters[0]!.id}`);
    expect(del.status).toBe(200);
    const inc = await sync(cursor);
    expect(inc.full).toBe(false);
    expect(inc.chapters).toEqual([expect.objectContaining({ id: chapters[0]!.id, deleted: true })]);
    expect(inc.notes.find((n) => n.id === noteId)?.chapterId).toBeNull();
    expect(inc.cursor).toBeGreaterThan(cursor);

    await call('DELETE', `/api/notes/${noteId}`);
    const inc2 = await sync(inc.cursor);
    expect(inc2.notes.find((n) => n.id === noteId)).toMatchObject({ deleted: true });
    expect((await sync()).notes.find((n) => n.id === noteId)).toBeUndefined();
    expect(fs.existsSync(path.join(dataDir, 'notes', noteId))).toBe(false);
  });

  it('konverterer på nytt ved forespørsel', async () => {
    const note = (await sync()).notes.find((n) => n.status === 'done')!;
    const res = await call<Note>('POST', `/api/notes/${note.id}/retry`, { json: { instructions: 'Prøv igjen' } });
    expect(res.body.status).toBe('queued');
    const done = await waitFor(note.id, (n) => n.status === 'done' && n.pdfRev > note.pdfRev);
    expect(done.instructions).toBe('Prøv igjen');
  });

  it('foreslår og oppretter kapittel når faget ikke har noen', async () => {
    const s = await call<Subject>('POST', '/api/subjects', { json: { name: 'Fysikk 2', profile: 'physics', textbook: 'Ergo Fysikk 2' } });
    expect(s.status).toBe(201);
    const res = await call<Note>('POST', '/api/notes', {
      form: uploadForm({ subjectId: s.body.id, clientId: 'klient-ny' }, [{ data: pngPage, name: 's.png', type: 'image/png' }]),
    });
    const done = await waitFor(res.body.id, (n) => n.status === 'done' || n.status === 'failed');
    const chapter = (await sync()).chapters.find((c) => c.id === done.chapterId);
    expect(chapter).toMatchObject({ subjectId: s.body.id, number: '1', title: 'Fysikk og måling' });
  });
});
