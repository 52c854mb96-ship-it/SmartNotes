/**
 * Starter hjemmemaskinen: henter AI-kall fra SmartNotes-serveren og kjører dem med Ollama på denne maskinen.
 * Se docs/HJEMMEMASKIN.md.
 *
 *   npm run homeworker --workspace server
 *
 * Innstillinger leses fra miljøvariabler eller fra en .env-fil i mappen du står i:
 *   SMARTNOTES_URL   adressen til serveren, f.eks. https://smartnotes.up.railway.app
 *   WORKER_TOKEN     samme hemmelige nøkkel som på serveren
 *   WORKER_NAME      navnet som vises i appen (standard: maskinnavnet)
 *   WORKER_HOURS     når maskinen tar imot oppgaver, f.eks. 16-23,0-7 (standard: hele døgnet)
 *   OLLAMA_URL, OLLAMA_MODEL, OLLAMA_TEXT_MODEL, … som i README
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { loadConfig } from '../config.js';
import type { AiService } from '../pipeline/ai.js';
import { FakeClaude } from '../pipeline/claude.js';
import { OllamaAi } from '../pipeline/ollama.js';
import { FatalWorkerError, HomeWorker, loadEnvFile, parseHours, safeServerUrl } from '../remote/homeworker.js';

const here = process.env.INIT_CWD ?? process.cwd();
for (const dir of new Set([here, process.cwd()])) {
  const file = path.join(dir, '.env');
  if (fs.existsSync(file)) {
    loadEnvFile(fs.readFileSync(file, 'utf8'));
    break;
  }
}

const serverUrl = process.env.SMARTNOTES_URL?.trim();
const token = process.env.WORKER_TOKEN?.trim();
if (!serverUrl || !token) {
  console.error('Mangler SMARTNOTES_URL eller WORKER_TOKEN. Legg dem i en .env-fil (se docs/HJEMMEMASKIN.md).');
  process.exit(1);
}
if (!safeServerUrl(serverUrl)) {
  console.error('SMARTNOTES_URL må begynne med https:// (bare localhost kan bruke http://), så nøkkelen ikke sendes ukryptert.');
  process.exit(1);
}

// Serverinnstillingene brukes bare for Ollama-delen; APP_PASSWORD trengs ikke her.
const config = loadConfig({
  ...process.env,
  APP_PASSWORD: 'hjemmemaskin',
  WORKER_TOKEN: '',
  AI_PROVIDER: 'ollama',
  AI_PROVIDER_CONVERT: '',
  AI_PROVIDER_FLASHCARDS: '',
  AI_PROVIDER_TOC: '',
});
const ai: AiService = config.fakeClaude ? new FakeClaude() : new OllamaAi(config.ollama);
const models = config.fakeClaude ? ['fake-claude'] : [...new Set([config.ollama.model, config.ollama.textModel])];
const name = process.env.WORKER_NAME?.trim() || os.hostname();
let activeHours: (now: Date) => boolean;
try {
  activeHours = parseHours(process.env.WORKER_HOURS);
} catch (err) {
  console.error((err as Error).message);
  process.exit(1);
}

const worker = new HomeWorker({
  serverUrl,
  token,
  name,
  ai,
  models,
  activeHours,
  log: (line) => console.log(`${new Date().toLocaleTimeString('nb-NO')}  ${line}`),
});

console.log(`SmartNotes hjemmemaskin «${name}» med ${models.join(' og ')} (Ollama på ${config.ollama.url}).`);
let stopping = false;
for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    if (stopping) {
      console.log('Stopper nå. Oppgaven som pågikk, gis til hjemmemaskinen igjen om litt.');
      process.exit(130);
    }
    stopping = true;
    console.log('Stopper etter oppgaven som pågår (trykk Ctrl+C en gang til for å stoppe med en gang) …');
    worker.stop();
  });
}

try {
  await worker.run();
} catch (err) {
  console.error(err instanceof FatalWorkerError ? err.message : err);
  process.exit(1);
}
