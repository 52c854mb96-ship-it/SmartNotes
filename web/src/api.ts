import type {
  BulkChaptersRequest,
  Chapter,
  ChapterInput,
  ChapterPreviewResponse,
  CreateChapterRequest,
  CreateSubjectRequest,
  HealthResponse,
  MeResponse,
  Note,
  NoteLatexResponse,
  NotePagesResponse,
  RetryNoteRequest,
  SaveLatexResponse,
  Subject,
  SyncResponse,
  UpdateChapterRequest,
  UpdateNoteRequest,
  UpdateSubjectRequest,
} from '@smartnotes/shared';
import { authStore, markReachable } from './lib/connectivity';

const BASE = '/api';
const MUTATING = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/** Feil som serveren svarte med (HTTP-status ≠ 2xx). `message` er norsk og kan vises til brukeren. */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

/** Fikk ikke kontakt med serveren (offline, DNS, tidsavbrudd …). */
export class NetworkError extends Error {
  constructor(message = 'Får ikke kontakt med serveren.') {
    super(message);
    this.name = 'NetworkError';
  }
}

export function isAbortError(err: unknown): boolean {
  return err instanceof DOMException && err.name === 'AbortError';
}

/** Feil som tyder på at vi bør prøve igjen senere (nett, timeout, overbelastning, serverfeil). */
export function isRetryable(err: unknown): boolean {
  if (err instanceof NetworkError) return true;
  if (err instanceof ApiError) {
    return err.status === 408 || err.status === 429 || err.status >= 500;
  }
  return false;
}

export function errorMessage(err: unknown, fallback = 'Noe gikk galt.'): string {
  if (err instanceof ApiError || err instanceof NetworkError) return err.message;
  return fallback;
}

function fallbackMessage(status: number): string {
  if (status === 401) return 'Du må logge inn på nytt.';
  if (status === 403) return 'Du har ikke tilgang til dette.';
  if (status === 404) return 'Fant ikke det du lette etter.';
  if (status === 413) return 'Filene er for store.';
  if (status === 429) return 'For mange forespørsler. Vent litt og prøv igjen.';
  if (status >= 500) return 'Noe gikk galt på serveren. Prøv igjen om litt.';
  return `Noe gikk galt (HTTP ${status}).`;
}

function parseErrorBody(status: number, text: string): ApiError {
  try {
    const data = JSON.parse(text) as Partial<{ error: string; message: string }>;
    if (data && typeof data === 'object' && (data.message || data.error)) {
      return new ApiError(status, data.error ?? `http_${status}`, data.message || fallbackMessage(status));
    }
  } catch {
    /* ikke JSON */
  }
  if (status === 502 || status === 503 || status === 504) {
    // Typisk en proxy foran en server som er nede.
    markReachable(false);
  }
  return new ApiError(status, `http_${status}`, fallbackMessage(status));
}

interface RequestOptions {
  json?: unknown;
  form?: FormData;
  signal?: AbortSignal;
  timeoutMs?: number;
  /** For innlogging: 401 betyr feil passord, ikke utlogget. */
  allow401?: boolean;
  cache?: RequestCache;
  /** Ikke la svaret påvirke «på nett»-status (svaret kan komme fra service worker-cachen). */
  quiet?: boolean;
}

function withTimeout(signal: AbortSignal | undefined, timeoutMs: number | undefined) {
  if (!timeoutMs) return { signal, timedOut: () => false, cleanup: () => {} };
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);
  const onAbort = () => controller.abort();
  signal?.addEventListener('abort', onAbort, { once: true });
  return {
    signal: controller.signal,
    timedOut: () => timedOut,
    cleanup: () => {
      clearTimeout(timer);
      signal?.removeEventListener('abort', onAbort);
    },
  };
}

async function request(method: string, path: string, opts: RequestOptions = {}): Promise<Response> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (MUTATING.has(method)) headers['X-SmartNotes'] = '1';
  let body: BodyInit | undefined;
  if (opts.form) {
    body = opts.form;
  } else if (opts.json !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(opts.json);
  }
  const t = withTimeout(opts.signal, opts.timeoutMs);
  let res: Response;
  try {
    res = await fetch(BASE + path, {
      method,
      headers,
      body,
      credentials: 'same-origin',
      signal: t.signal,
      cache: opts.cache ?? (method === 'GET' ? 'no-store' : undefined),
    });
  } catch (err) {
    t.cleanup();
    if (opts.signal?.aborted) throw err;
    if (!opts.quiet) markReachable(false);
    throw new NetworkError(t.timedOut() ? 'Serveren svarte ikke i tide.' : 'Får ikke kontakt med serveren.');
  }
  t.cleanup();
  if (res.ok) {
    if (!opts.quiet) markReachable(true);
    return res;
  }
  const text = await res.text().catch(() => '');
  const error = parseErrorBody(res.status, text);
  if (!opts.quiet && res.status !== 502 && res.status !== 503 && res.status !== 504) markReachable(true);
  if (res.status === 401 && !opts.allow401) authStore.set('required');
  throw error;
}

async function json<T>(method: string, path: string, opts: RequestOptions = {}): Promise<T> {
  const res = await request(method, path, opts);
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

async function blob(path: string, signal?: AbortSignal, timeoutMs?: number): Promise<Blob> {
  const res = await request('GET', path, { signal, timeoutMs, cache: 'default' });
  return res.blob();
}

const enc = encodeURIComponent;

// ---------- URL-er (brukes direkte i <img>/<a>) ----------

export const urls = {
  notePdf: (id: string, rev: number) => `${BASE}/notes/${enc(id)}/pdf?v=${rev}`,
  /** `download=1` gir Content-Disposition: attachment. */
  notePdfDownload: (id: string, rev: number) => `${BASE}/notes/${enc(id)}/pdf?v=${rev}&download=1`,
  chapterPdfDownload: (id: string) => `${BASE}/chapters/${enc(id)}/pdf?download=1`,
  subjectPdfDownload: (id: string) => `${BASE}/subjects/${enc(id)}/pdf?download=1`,
  noteTex: (id: string) => `${BASE}/notes/${enc(id)}/tex`,
  notePage: (id: string, index: number) => `${BASE}/notes/${enc(id)}/pages/${index}`,
};

// ---------- Endepunkter ----------

export const api = {
  health: (signal?: AbortSignal) => json<HealthResponse>('GET', '/health', { signal, timeoutMs: 10_000 }),

  login: (password: string) =>
    json<{ ok: boolean }>('POST', '/auth/login', { json: { password }, allow401: true, timeoutMs: 20_000 }),
  logout: () => json<{ ok: boolean }>('POST', '/auth/logout', { timeoutMs: 10_000, allow401: true }),
  me: () => json<MeResponse>('GET', '/auth/me', { allow401: true, timeoutMs: 10_000 }),

  sync: (since: number, signal?: AbortSignal) =>
    json<SyncResponse>('GET', `/sync?since=${since}`, { signal, timeoutMs: 45_000 }),

  createSubject: (req: CreateSubjectRequest) => json<Subject>('POST', '/subjects', { json: req }),
  updateSubject: (id: string, req: UpdateSubjectRequest) =>
    json<Subject>('PATCH', `/subjects/${enc(id)}`, { json: req }),
  deleteSubject: (id: string) => json<{ ok: boolean }>('DELETE', `/subjects/${enc(id)}`),

  createChapter: (subjectId: string, req: CreateChapterRequest) =>
    json<Chapter>('POST', `/subjects/${enc(subjectId)}/chapters`, { json: req }),
  bulkChapters: (subjectId: string, chapters: ChapterInput[]) =>
    json<{ chapters: Chapter[] }>('POST', `/subjects/${enc(subjectId)}/chapters/bulk`, {
      json: { chapters } satisfies BulkChaptersRequest,
    }),
  parseChapters: (subjectId: string, text: string) =>
    json<ChapterPreviewResponse>('POST', `/subjects/${enc(subjectId)}/chapters/parse`, { json: { text } }),
  extractChapters: (subjectId: string, files: { blob: Blob; name: string }[], signal?: AbortSignal) => {
    const form = new FormData();
    for (const f of files) form.append('files', f.blob, f.name);
    return json<ChapterPreviewResponse>('POST', `/subjects/${enc(subjectId)}/chapters/extract`, {
      form,
      signal,
      timeoutMs: 180_000,
    });
  },
  reorderChapters: (subjectId: string, ids: string[]) =>
    json<{ ok: boolean }>('POST', `/subjects/${enc(subjectId)}/chapters/reorder`, { json: { ids } }),
  updateChapter: (id: string, req: UpdateChapterRequest) =>
    json<Chapter>('PATCH', `/chapters/${enc(id)}`, { json: req }),
  deleteChapter: (id: string) => json<{ ok: boolean }>('DELETE', `/chapters/${enc(id)}`),

  updateNote: (id: string, req: UpdateNoteRequest) => json<Note>('PATCH', `/notes/${enc(id)}`, { json: req }),
  deleteNote: (id: string) => json<{ ok: boolean }>('DELETE', `/notes/${enc(id)}`),
  retryNote: (id: string, req: RetryNoteRequest) =>
    json<Note>('POST', `/notes/${enc(id)}/retry`, { json: req }),
  getLatex: (id: string, signal?: AbortSignal) =>
    json<NoteLatexResponse>('GET', `/notes/${enc(id)}/latex`, { signal, timeoutMs: 20_000 }),
  saveLatex: (id: string, body: string) =>
    json<SaveLatexResponse>('PUT', `/notes/${enc(id)}/latex`, { json: { body }, timeoutMs: 120_000 }),
  getPages: (id: string, signal?: AbortSignal) =>
    json<NotePagesResponse>('GET', `/notes/${enc(id)}/pages`, {
      signal,
      cache: 'default',
      timeoutMs: 15_000,
      quiet: true,
    }),

  notePdf: (id: string, rev: number, signal?: AbortSignal) =>
    blob(`/notes/${enc(id)}/pdf?v=${rev}`, signal, 120_000),
  chapterPdf: (id: string, signal?: AbortSignal) => blob(`/chapters/${enc(id)}/pdf`, signal, 240_000),
  subjectPdf: (id: string, signal?: AbortSignal) => blob(`/subjects/${enc(id)}/pdf`, signal, 300_000),
};

// ---------- Opplasting (XHR for fremdrift) ----------

export interface UploadInput {
  clientId: string;
  subjectId: string;
  chapterId: string;
  title: string;
  noteDate: string;
  instructions: string;
  files: { name: string; type: string; blob: Blob }[];
}

export function uploadNote(
  input: UploadInput,
  onProgress?: (fraction: number) => void,
  signal?: AbortSignal,
): Promise<Note> {
  const form = new FormData();
  // Tekstfelt først – noen multipart-parsere trenger dem før filene.
  form.append('subjectId', input.subjectId);
  form.append('clientId', input.clientId);
  form.append('chapterId', input.chapterId || 'auto');
  if (input.title.trim()) form.append('title', input.title.trim());
  if (input.noteDate) form.append('noteDate', input.noteDate);
  if (input.instructions.trim()) form.append('instructions', input.instructions.trim());
  for (const f of input.files) form.append('files', f.blob, f.name);

  return new Promise<Note>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${BASE}/notes`);
    xhr.setRequestHeader('X-SmartNotes', '1');
    xhr.setRequestHeader('Accept', 'application/json');
    xhr.timeout = 15 * 60_000;
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && e.total > 0) onProgress?.(e.loaded / e.total);
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        markReachable(true);
        try {
          resolve(JSON.parse(xhr.responseText) as Note);
        } catch {
          reject(new ApiError(xhr.status, 'bad_response', 'Uventet svar fra serveren.'));
        }
        return;
      }
      const err = parseErrorBody(xhr.status, xhr.responseText);
      if (xhr.status !== 502 && xhr.status !== 503 && xhr.status !== 504) markReachable(true);
      if (xhr.status === 401) authStore.set('required');
      reject(err);
    };
    xhr.onerror = () => {
      markReachable(false);
      reject(new NetworkError());
    };
    xhr.ontimeout = () => reject(new NetworkError('Opplastingen tok for lang tid.'));
    xhr.onabort = () => reject(new DOMException('Opplastingen ble avbrutt.', 'AbortError'));
    if (signal?.aborted) {
      reject(new DOMException('Opplastingen ble avbrutt.', 'AbortError'));
      return;
    }
    signal?.addEventListener('abort', () => xhr.abort(), { once: true });
    xhr.send(form);
  });
}
