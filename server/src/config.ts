import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import { DEFAULT_SEED_TEXTBOOKS } from './textbooks.js';

export type Effort = 'low' | 'medium' | 'high' | 'xhigh' | 'max';

export interface Config {
  port: number;
  host: string;
  /** Rotmappe for database, opplastinger, PDF-er og midlertidige byggefiler. */
  dataDir: string;
  /** Passordet for å logge inn i appen. */
  appPassword: string;
  anthropicApiKey: string | null;
  model: string;
  effort: Effort;
  /** Server-side fallback ved avslag fra modellens sikkerhetsfiltre (Claude API). */
  useFallbacks: boolean;
  /** Bruk en falsk Claude (for utvikling og tester uten API-nøkkel). */
  fakeClaude: boolean;
  /** Lærebok (id i TEXTBOOKS) som faget og kapitlene lages fra ved første oppstart, eller null for et tomt «Fysikk». */
  /** Læreboksett som legges inn (én gang hver). Tom liste = bare et tomt fag ved første oppstart. */
  seedTextbooks: string[];
  /** Mappe med ferdigbygd web-app som serveres statisk, eller null. */
  webDist: string | null;
  latexTimeoutMs: number;
  bundleTimeoutMs: number;
  maxFixAttempts: number;
  workerConcurrency: number;
  maxPagesPerNote: number;
  maxOutputTokens: number;
  secureCookies: boolean;
  /** Hvor lenge en innlogging varer (dager). */
  sessionDays: number;
  version: string;
}

const here = path.dirname(fileURLToPath(import.meta.url));
/** server/ (både fra src/ under utvikling og dist/ i produksjon). */
export const SERVER_ROOT = path.resolve(here, '..');

function bool(v: string | undefined, fallback: boolean): boolean {
  if (v === undefined || v === '') return fallback;
  return ['1', 'true', 'yes', 'on', 'ja'].includes(v.toLowerCase());
}

function int(v: string | undefined, fallback: number): number {
  const n = v ? Number.parseInt(v, 10) : Number.NaN;
  return Number.isFinite(n) ? n : fallback;
}

const EFFORTS: Effort[] = ['low', 'medium', 'high', 'xhigh', 'max'];

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const production = env.NODE_ENV === 'production';
  const fakeClaude = bool(env.SMARTNOTES_FAKE_CLAUDE, false);

  let appPassword = env.APP_PASSWORD ?? '';
  if (!appPassword) {
    if (production) {
      throw new Error('APP_PASSWORD må være satt i produksjon (passordet du logger inn med).');
    }
    appPassword = 'smartnotes';
  }

  const effort = (env.CLAUDE_EFFORT ?? 'high') as Effort;
  if (!EFFORTS.includes(effort)) {
    throw new Error(`CLAUDE_EFFORT må være en av ${EFFORTS.join(', ')}`);
  }

  const defaultWebDist = path.resolve(SERVER_ROOT, '..', 'web', 'dist');
  const webDist = env.WEB_DIST ?? (fs.existsSync(path.join(defaultWebDist, 'index.html')) ? defaultWebDist : null);

  let version = '0.0.0';
  try {
    version = JSON.parse(fs.readFileSync(path.join(SERVER_ROOT, 'package.json'), 'utf8')).version ?? version;
  } catch {
    // ignorer
  }

  return {
    port: int(env.PORT, 8787),
    host: env.HOST ?? '0.0.0.0',
    dataDir: path.resolve(env.DATA_DIR ?? path.join(SERVER_ROOT, '..', 'data')),
    appPassword,
    anthropicApiKey: env.ANTHROPIC_API_KEY?.trim() || null,
    model: env.CLAUDE_MODEL?.trim() || 'claude-opus-5-5',
    effort,
    useFallbacks: bool(env.CLAUDE_FALLBACKS, true),
    fakeClaude,
    seedTextbooks: parseSeedList(env.SEED_TEXTBOOKS ?? env.SEED_TEXTBOOK),
    webDist,
    latexTimeoutMs: int(env.LATEX_TIMEOUT_MS, 120_000),
    bundleTimeoutMs: int(env.BUNDLE_TIMEOUT_MS, 300_000),
    maxFixAttempts: int(env.LATEX_FIX_ATTEMPTS, 2),
    workerConcurrency: Math.max(1, int(env.WORKER_CONCURRENCY, 1)),
    maxPagesPerNote: int(env.MAX_PAGES_PER_NOTE, 30),
    maxOutputTokens: int(env.CLAUDE_MAX_TOKENS, 64_000),
    secureCookies: bool(env.COOKIE_SECURE, production),
    sessionDays: int(env.SESSION_DAYS, 365),
    version,
  };
}

/** «ergo-fysikk-1,aschehoug-kjemi-1» → liste; «none» eller tom → ingen; ikke satt → alle kjente læreboksett. */
function parseSeedList(value: string | undefined): string[] {
  if (value === undefined) return [...DEFAULT_SEED_TEXTBOOKS];
  const v = value.trim();
  if (!v || v === 'none') return [];
  return v
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean);
}
