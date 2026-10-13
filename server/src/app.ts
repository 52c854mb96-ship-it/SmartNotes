import fs from 'node:fs';
import path from 'node:path';
import Fastify, { type FastifyError, type FastifyInstance } from 'fastify';
import fastifyCookie from '@fastify/cookie';
import fastifyMultipart from '@fastify/multipart';
import fastifyStatic from '@fastify/static';
import type { AiStatusResponse, HealthResponse } from '@smartnotes/shared';
import { registerAuth } from './auth.js';
import { AI_TASKS, type Config } from './config.js';
import { Repo } from './db.js';
import { HttpError } from './errors.js';
import { FlashcardGenerator } from './flashcards/generator.js';
import { MAX_FILE_BYTES, MAX_FILES } from './limits.js';
import { Bundler } from './pipeline/bundle.js';
import type { AiService } from './pipeline/ai.js';
import { AnthropicClaude, FakeClaude } from './pipeline/claude.js';
import { COMPARE_EFFORT, COMPARE_MAX_TOKENS, COMPARE_MODEL, Comparer } from './pipeline/compare.js';
import { Converter } from './pipeline/converter.js';
import { latexAvailable } from './pipeline/latex.js';
import { aiConfigured, createAi, createFreeConvertAi, describeAi } from './pipeline/providers.js';
import { Worker } from './pipeline/worker.js';
import { registerAdminRoutes } from './routes/admin.js';
import { registerBackupRoutes } from './routes/backup.js';
import { registerCompareRoutes } from './routes/compare.js';
import { registerFlashcardRoutes } from './routes/flashcards.js';
import { registerLibraryRoutes } from './routes/library.js';
import { registerNoteRoutes } from './routes/notes.js';
import { registerUsageRoutes } from './routes/usage.js';
import { registerWorkerRoutes } from './routes/worker.js';
import { RemoteHub } from './remote/hub.js';
import { Storage } from './storage.js';
import { findPreset } from './presets.js';
import { Quota } from './quota.js';
import { MeteredAi } from './usage.js';

export interface AppContext {
  app: FastifyInstance;
  repo: Repo;
  storage: Storage;
  ai: AiService;
  hub: RemoteHub;
  converter: Converter;
  worker: Worker;
  bundler: Bundler;
  generator: FlashcardGenerator;
  comparer: Comparer;
  quota: Quota;
}

/** Byggnummeret Vite skriver i index.html (`<meta name="smartnotes-build">`), eller null uten ferdigbygd web-app. */
function readWebBuild(webDist: string | null): string | null {
  if (!webDist) return null;
  try {
    const html = fs.readFileSync(path.join(webDist, 'index.html'), 'utf8');
    return /<meta name="smartnotes-build" content="([^"]+)"/.exec(html)?.[1] ?? null;
  } catch {
    return null;
  }
}

/**
 * `ai` erstatter AI-tjenesten (tester), `freeAi` konverteringen for gratisbrukerne (uten den: `ai` når den er gitt,
 * ellers Haiku), og `compareAi` sammenligningen.
 */
export async function buildApp(
  config: Config,
  opts: { ai?: AiService; freeAi?: AiService; compareAi?: AiService; logger?: boolean; now?: () => number } = {},
): Promise<AppContext> {
  const app = Fastify({
    logger: opts.logger === false ? false : { level: process.env.LOG_LEVEL ?? 'info' },
    bodyLimit: 5 * 1024 * 1024,
    // Bare så mange proxyer som faktisk står foran serveren (Railway: én), ellers kan en klient sette sin egen IP i
    // X-Forwarded-For og komme seg rundt grensene for innlogging.
    // `hop` 0 er den nærmeste adressen (proxyen hos Railway); adressen bak de betrodde leddene blir `req.ip`.
    trustProxy: (_address: string, hop: number) => hop < config.accounts.trustProxyHops,
  });

  const storage = new Storage(config.dataDir);
  const repo = new Repo(storage.dbFile);
  const unknown = config.seedTextbooks.filter((id) => !findPreset(id));
  if (unknown.length > 0) app.log.warn({ unknown }, 'ukjente fagoppsett i SEED_TEXTBOOKS – hoppes over');
  const presets = [...new Map(config.seedTextbooks.flatMap((id) => findPreset(id) ?? []).map((p) => [p.id, p])).values()];
  const created = repo.seed(presets);
  if (created.length > 0) app.log.info({ created }, 'la inn fag fra læreboksett');
  // Hvert AI-kall logges i forbruksloggen (usage_log), også når det feiler.
  const metered = (inner: AiService) =>
    new MeteredAi(
      inner,
      (entry) => repo.logUsage(entry),
      (err) => app.log.warn({ err }, 'kunne ikke skrive til forbruksloggen'),
    );
  // Kø for AI-kall som kjøres på hjemmemaskinen. Notatet viser «venter» til en hjemmemaskin henter kallet.
  const hub = new RemoteHub({
    leaseMs: config.remote.leaseMs,
    maxWaitMs: config.remote.maxWaitMs,
    interactiveWaitMs: 3 * 60_000,
    maxRunMs: config.remote.maxRunMs,
    maxAttempts: 3,
    onlineWithinMs: config.remote.onlineWithinMs,
    fallback: config.remote.fallback === 'anthropic',
    // Bare selve lesingen vises som «venter»; rettingen av LaTeX-feil fortsetter å vise «retter».
    onWaiting: (ref, method) => {
      if (ref.noteId && method === 'convert') repo.setStage(ref.noteId, 'waiting');
    },
    onWaitEnded: (ref, method) => {
      if (ref.noteId && method === 'convert') repo.setStage(ref.noteId, 'reading');
    },
  });
  const ai = opts.ai ? metered(opts.ai) : createAi(config, metered, hub);
  // Gratisbrukerne konverterer med Haiku (høy grundighet, Sonnet som reserve ved avslag); eieren med `ai`.
  const freeAi = opts.freeAi ? metered(opts.freeAi) : opts.ai ? null : createFreeConvertAi(config, metered);
  const quota = new Quota(repo, config, opts.now);
  const converter = new Converter(repo, storage, ai, config, app.log, freeAi ? { ai: freeAi, fixAttempts: 3 } : null, quota);
  const worker = new Worker(repo, converter, config.workerConcurrency, app.log);
  const bundler = new Bundler(repo, storage, config, app.log);
  const generator = new FlashcardGenerator(repo, storage, ai, app.log);
  // Sammenligningen bruker alltid Haiku direkte, uten reserven (RefusalFallback) som ellers sender et avslag til Sonnet.
  const compareAi = metered(
    opts.compareAi ?? opts.ai ?? (config.fakeClaude ? new FakeClaude() : new AnthropicClaude(config, COMPARE_MODEL, { effort: COMPARE_EFFORT, maxTokens: COMPARE_MAX_TOKENS })),
  );
  const comparer = new Comparer(repo, storage, converter, compareAi, config, app.log);
  const latexOk = await latexAvailable();
  if (!latexOk) app.log.warn('latexmk ble ikke funnet – PDF-er kan ikke lages. Installer TeX Live (se README).');
  const missing = AI_TASKS.filter((t) => !aiConfigured(ai, t));
  if (missing.length > 0) app.log.warn({ tasks: missing }, 'ANTHROPIC_API_KEY mangler – disse oppgavene kan ikke kjøres med Claude.');
  const aiTasks = opts.ai ? [] : describeAi(config);
  if (aiTasks.some((t) => t.provider === 'remote') && config.remote.fallback === 'anthropic' && !config.anthropicApiKey && !config.fakeClaude) {
    app.log.warn('REMOTE_FALLBACK=anthropic, men ANTHROPIC_API_KEY mangler – reserven virker ikke.');
  }
  if (aiTasks.some((t) => t.provider === 'ollama')) app.log.info({ ai: aiTasks, ollama: config.ollama.url }, 'bruker lokal AI (Ollama)');

  await app.register(fastifyCookie);
  await app.register(fastifyMultipart, {
    limits: { fileSize: MAX_FILE_BYTES, files: MAX_FILES, fields: 20, fieldSize: 10_000, parts: MAX_FILES + 20 },
  });

  app.setErrorHandler((err: FastifyError | HttpError, req, reply) => {
    if (err instanceof HttpError) {
      return reply.code(err.statusCode).send({ error: err.code, message: err.message });
    }
    const code = (err as FastifyError).code;
    const multipartMessages: Record<string, [number, string]> = {
      FST_REQ_FILE_TOO_LARGE: [413, `En av filene er for stor (maks ${MAX_FILE_BYTES / 1024 / 1024} MB per fil).`],
      FST_FILES_LIMIT: [413, `For mange filer i én opplasting (maks ${MAX_FILES}).`],
      FST_PARTS_LIMIT: [413, 'For mange deler i opplastingen.'],
      FST_FIELDS_LIMIT: [400, 'For mange felter i opplastingen.'],
      FST_INVALID_MULTIPART_CONTENT_TYPE: [400, 'Opplastingen må sendes som multipart/form-data.'],
    };
    const known = code ? multipartMessages[code] : undefined;
    if (known) return reply.code(known[0]).send({ error: code, message: known[1] });
    const status = (err as FastifyError).statusCode ?? 500;
    if (status >= 500) {
      req.log.error({ err }, 'serverfeil');
      return reply.code(500).send({ error: 'internal', message: 'Noe gikk galt på serveren. Prøv igjen.' });
    }
    if (status === 413) return reply.code(413).send({ error: 'too_large', message: 'Forespørselen er for stor.' });
    return reply.code(status).send({ error: code ?? 'bad_request', message: 'Ugyldig forespørsel.' });
  });

  // Byggnummeret til web-appen følger med hvert API-svar. Da ser appen at serveren har en nyere versjon, også når
  // service workeren ikke sa fra i tide (web/src/lib/pwa.ts).
  const webBuild = readWebBuild(config.webDist);
  if (webBuild) {
    app.addHook('onRequest', async (req, reply) => {
      if (req.url.startsWith('/api/')) reply.header('X-SmartNotes-Build', webBuild);
    });
  }

  registerAuth(app, repo, config);

  app.get('/api/health', async (): Promise<HealthResponse> => ({
    ok: true,
    version: config.version,
    latex: latexOk,
    claudeConfigured: ai.configured,
    model: ai.model,
    fakeClaude: ai.fake,
    ai: aiTasks,
  }));

  registerLibraryRoutes(app, { repo, storage, ai, converter, bundler, quota });
  registerNoteRoutes(app, { repo, storage, converter, worker, hub, quota });
  registerFlashcardRoutes(app, { repo, storage, ai, generator, quota });
  registerUsageRoutes(app, { repo, config });
  registerCompareRoutes(app, { repo, storage, comparer, config });
  registerBackupRoutes(app, { repo, storage, config });
  registerAdminRoutes(app, { repo, config, hub });
  if (config.remote.token) registerWorkerRoutes(app, { hub, token: config.remote.token });
  const usesRemote = aiTasks.some((t) => t.provider === 'remote');
  app.get('/api/ai/status', async (): Promise<AiStatusResponse> => ({
    remote: usesRemote ? { ...hub.status(), fallback: config.remote.fallback === 'anthropic' } : null,
  }));

  // Ferdigbygd web-app (PWA) med SPA-fallback.
  if (config.webDist && fs.existsSync(path.join(config.webDist, 'index.html'))) {
    const indexHtml = fs.readFileSync(path.join(config.webDist, 'index.html'));
    await app.register(fastifyStatic, {
      root: config.webDist,
      prefix: '/',
      wildcard: false,
      index: false,
      setHeaders(res, filePath) {
        const name = path.basename(filePath);
        if (filePath.includes(`${path.sep}assets${path.sep}`)) res.header('Cache-Control', 'public, max-age=31536000, immutable');
        else if (name.startsWith('sw') || name.startsWith('workbox-') || name.endsWith('.webmanifest') || name === 'index.html')
          res.header('Cache-Control', 'no-cache');
        else res.header('Cache-Control', 'public, max-age=86400');
      },
    });
    app.get('/', (_req, reply) => reply.type('text/html').header('Cache-Control', 'no-cache').send(indexHtml));
    app.setNotFoundHandler((req, reply) => {
      const urlPath = req.url.split('?')[0]!;
      // SPA-fallback bare for sider – ikke for filer (en gammel kodebit skal få 404, ikke HTML).
      const looksLikeFile = urlPath.startsWith('/assets/') || /\.[a-z0-9]{1,12}$/i.test(urlPath);
      if (req.method === 'GET' && !urlPath.startsWith('/api/') && !looksLikeFile) {
        return reply.type('text/html').header('Cache-Control', 'no-cache').send(indexHtml);
      }
      return reply.code(404).send({ error: 'not_found', message: 'Fant ikke det du lette etter.' });
    });
  } else {
    app.setNotFoundHandler((_req, reply) => reply.code(404).send({ error: 'not_found', message: 'Fant ikke det du lette etter.' }));
  }

  app.addHook('onClose', async () => {
    // Stopp køene først, så avbrytes kallene som venter på hjemmemaskinen uten at noe lagres.
    await worker.stop();
    generator.stop();
    comparer.stop();
    hub.close();
    await generator.idle();
    await comparer.idle();
    // Rekompileringer i bakgrunnen skriver til databasen – la dem bli ferdige før den lukkes.
    await converter.idle();
    repo.close();
  });

  void storage.cleanTmp();
  return { app, repo, storage, ai, hub, converter, worker, bundler, generator, comparer, quota };
}
