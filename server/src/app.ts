import fs from 'node:fs';
import path from 'node:path';
import Fastify, { type FastifyError, type FastifyInstance } from 'fastify';
import fastifyCookie from '@fastify/cookie';
import fastifyMultipart from '@fastify/multipart';
import fastifyStatic from '@fastify/static';
import type { HealthResponse } from '@smartnotes/shared';
import { registerAuth } from './auth.js';
import type { Config } from './config.js';
import { Repo } from './db.js';
import { HttpError } from './errors.js';
import { MAX_FILE_BYTES, MAX_FILES } from './limits.js';
import { Bundler } from './pipeline/bundle.js';
import { createClaude, type ClaudeService } from './pipeline/claude.js';
import { Converter } from './pipeline/converter.js';
import { latexAvailable } from './pipeline/latex.js';
import { Worker } from './pipeline/worker.js';
import { registerLibraryRoutes } from './routes/library.js';
import { registerNoteRoutes } from './routes/notes.js';
import { Storage } from './storage.js';
import { TEXTBOOKS } from './textbooks.js';

export interface AppContext {
  app: FastifyInstance;
  repo: Repo;
  storage: Storage;
  claude: ClaudeService;
  converter: Converter;
  worker: Worker;
  bundler: Bundler;
}


export async function buildApp(config: Config, opts: { claude?: ClaudeService; logger?: boolean } = {}): Promise<AppContext> {
  const app = Fastify({
    logger: opts.logger === false ? false : { level: process.env.LOG_LEVEL ?? 'info' },
    bodyLimit: 5 * 1024 * 1024,
    trustProxy: true,
  });

  const storage = new Storage(config.dataDir);
  const repo = new Repo(storage.dbFile);
  const unknown = config.seedTextbooks.filter((id) => !TEXTBOOKS[id]);
  if (unknown.length > 0) app.log.warn({ unknown }, 'ukjente læreboksett i SEED_TEXTBOOKS – hoppes over');
  const created = repo.seed(config.seedTextbooks.flatMap((id) => (TEXTBOOKS[id] ? [TEXTBOOKS[id]] : [])));
  if (created.length > 0) app.log.info({ created }, 'la inn fag fra læreboksett');
  const claude = opts.claude ?? createClaude(config);
  const converter = new Converter(repo, storage, claude, config, app.log);
  const worker = new Worker(repo, converter, config.workerConcurrency, app.log);
  const bundler = new Bundler(repo, storage, config, app.log);
  const latexOk = await latexAvailable();
  if (!latexOk) app.log.warn('latexmk ble ikke funnet – PDF-er kan ikke lages. Installer TeX Live (se README).');
  if (!claude.configured) app.log.warn('ANTHROPIC_API_KEY mangler – notater kan lastes opp, men ikke konverteres.');

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

  registerAuth(app, repo, config);

  app.get('/api/health', async (): Promise<HealthResponse> => ({
    ok: true,
    version: config.version,
    latex: latexOk,
    claudeConfigured: claude.configured,
    model: claude.model,
    fakeClaude: claude.fake,
  }));

  registerLibraryRoutes(app, { repo, storage, claude, converter, bundler });
  registerNoteRoutes(app, { repo, storage, converter, worker });

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
        else if (name === 'sw.js' || name.startsWith('workbox-') || name.endsWith('.webmanifest') || name === 'index.html')
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
    await worker.stop();
    // Rekompileringer i bakgrunnen skriver til databasen – la dem bli ferdige før den lukkes.
    await converter.idle();
    repo.close();
  });

  void storage.cleanTmp();
  return { app, repo, storage, claude, converter, worker, bundler };
}
