import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import { DEFAULT_SEED_TEXTBOOKS } from './textbooks.js';

export type Effort = 'low' | 'medium' | 'high' | 'xhigh' | 'max';

/**
 * Hvem som kjører AI-modellen: Claude hos Anthropic, en lokal modell via Ollama på samme maskin som serveren, eller
 * hjemmemaskinen («remote»), som henter AI-kallene fra serveren og kjører dem med sin egen lokale modell.
 */
export type AiProviderId = 'anthropic' | 'ollama' | 'remote';
const PROVIDERS: AiProviderId[] = ['anthropic', 'ollama', 'remote'];
/** Oppgavene som kan bruke hver sin leverandør. «convert» omfatter også retting av LaTeX, «toc» også kompetansemål. */
export type AiTask = 'convert' | 'flashcards' | 'toc';
export const AI_TASKS: AiTask[] = ['convert', 'flashcards', 'toc'];

export interface OllamaConfig {
  /** Adressen til Ollama, f.eks. http://127.0.0.1:11434. */
  url: string;
  /** Modell som leser bilder (konvertering og innholdsfortegnelse). */
  model: string;
  /** Modell for ren tekst (retting av LaTeX, kortstokker, kompetansemål). */
  textModel: string;
  /** Lengste kant på sidebildene som sendes (piksler). */
  imageMaxEdge: number;
  /** Minste kontekstvindu i tokens (num_ctx). Økes per kall når notatet trenger mer, opp til `maxCtx`. */
  numCtx: number;
  /** Største kontekstvindu. Større vindu bruker mer minne på skjermkortet. */
  maxCtx: number;
  /** La modellen tenke før den svarer (for modeller som kan det). Av som standard: tenkning tar tid og plass. */
  think: boolean;
  /** Maks antall tokens i svaret (num_predict). */
  maxTokens: number;
  timeoutMs: number;
  /** Hvordan modellen oppgir figurbokser: piksler i bildet den fikk, eller tusendeler (0–1000) av bredde og høyde. */
  boxUnits: 'pixels' | 'thousandths';
  /** Hvor lenge Ollama holder modellen i minnet etter et kall (keep_alive), f.eks. «10m». */
  keepAlive: string;
}

export interface RemoteConfig {
  /** Hemmelig nøkkel hjemmemaskinen logger inn med (WORKER_TOKEN). Uten den er hjemmemaskin-API-et avslått. */
  token: string | null;
  /** Hva som skjer når ingen hjemmemaskin er på nett: vente, eller bruke Claude (REMOTE_FALLBACK). */
  fallback: 'none' | 'anthropic';
  /** Hvor lenge et notat eller en kortstokk kan vente på hjemmemaskinen før det gir opp. */
  maxWaitMs: number;
  /** Hvor lenge en henting er reservert uten livstegn fra hjemmemaskinen. */
  leaseMs: number;
  /** En hjemmemaskin regnes som på nett hvis den har vært i kontakt så nylig. */
  onlineWithinMs: number;
}

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
  /** Leverandør per oppgave (AI_PROVIDER, og AI_PROVIDER_CONVERT / _FLASHCARDS / _TOC for unntak). Standard: Claude. */
  aiProviders: Record<AiTask, AiProviderId>;
  ollama: OllamaConfig;
  remote: RemoteConfig;
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
  /** Kurs fra dollar til kroner i oversikten over AI-forbruk (USD_NOK). */
  usdNok: number;
  version: string;
}

const here = path.dirname(fileURLToPath(import.meta.url));
/** server/ (både fra src/ under utvikling og dist/ i produksjon). */
export const SERVER_ROOT = path.resolve(here, '..');

function bool(v: string | undefined, fallback: boolean): boolean {
  if (v === undefined || v === '') return fallback;
  return ['1', 'true', 'yes', 'on', 'ja'].includes(v.toLowerCase());
}

function num(v: string | undefined, fallback: number): number {
  const n = v ? Number.parseFloat(v.replace(',', '.')) : Number.NaN;
  return Number.isFinite(n) && n > 0 ? n : fallback;
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

  // Middels grundighet ved konvertering: mindre tenkning og lavere pris enn «high», og godt nok for vanlige notater.
  const effort = (env.CLAUDE_EFFORT ?? 'medium') as Effort;
  if (!EFFORTS.includes(effort)) {
    throw new Error(`CLAUDE_EFFORT må være en av ${EFFORTS.join(', ')}`);
  }

  const provider = (name: string, fallback: AiProviderId): AiProviderId => {
    const v = env[name]?.trim().toLowerCase();
    if (!v) return fallback;
    if (!(PROVIDERS as string[]).includes(v)) throw new Error(`${name} må være «anthropic», «ollama» eller «remote».`);
    return v as AiProviderId;
  };
  const defaultProvider = provider('AI_PROVIDER', 'anthropic');
  const aiProviders: Record<AiTask, AiProviderId> = {
    convert: provider('AI_PROVIDER_CONVERT', defaultProvider),
    flashcards: provider('AI_PROVIDER_FLASHCARDS', defaultProvider),
    toc: provider('AI_PROVIDER_TOC', defaultProvider),
  };
  const boxUnits = env.OLLAMA_BOX_UNITS?.trim().toLowerCase() || 'pixels';
  if (boxUnits !== 'pixels' && boxUnits !== 'thousandths') throw new Error('OLLAMA_BOX_UNITS må være «pixels» eller «thousandths».');
  const ollamaModel = env.OLLAMA_MODEL?.trim() || 'qwen2.5vl:7b';
  const workerToken = env.WORKER_TOKEN?.trim() || null;
  if (workerToken && workerToken.length < 32) throw new Error('WORKER_TOKEN må være minst 32 tegn lang.');
  if (Object.values(aiProviders).includes('remote') && !workerToken) {
    throw new Error('WORKER_TOKEN må være satt når en oppgave bruker hjemmemaskinen (AI_PROVIDER … = remote).');
  }
  const fallback = env.REMOTE_FALLBACK?.trim() || 'none';
  if (fallback !== 'none' && fallback !== 'anthropic') throw new Error('REMOTE_FALLBACK må være «none» eller «anthropic».');

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
    // Sonnet 5.5 koster halvparten av Opus 5.5 og leser bilder i like høy oppløsning. CLAUDE_MODEL=claude-opus-5-5 gir Opus.
    model: env.CLAUDE_MODEL?.trim() || 'claude-sonnet-5-5',
    effort,
    useFallbacks: bool(env.CLAUDE_FALLBACKS, true),
    fakeClaude,
    aiProviders,
    ollama: {
      url: (env.OLLAMA_URL?.trim() || 'http://127.0.0.1:11434').replace(/\/+$/, ''),
      model: ollamaModel,
      textModel: env.OLLAMA_TEXT_MODEL?.trim() || ollamaModel,
      imageMaxEdge: int(env.OLLAMA_IMAGE_MAX_EDGE, 1600),
      numCtx: int(env.OLLAMA_NUM_CTX, 16_384),
      maxCtx: Math.max(int(env.OLLAMA_NUM_CTX, 16_384), int(env.OLLAMA_MAX_CTX, 32_768)),
      think: bool(env.OLLAMA_THINK, false),
      maxTokens: int(env.OLLAMA_MAX_TOKENS, 8192),
      timeoutMs: int(env.OLLAMA_TIMEOUT_MS, 15 * 60_000),
      boxUnits,
      keepAlive: env.OLLAMA_KEEP_ALIVE?.trim() || '10m',
    },
    remote: {
      token: workerToken,
      fallback,
      maxWaitMs: int(env.REMOTE_MAX_WAIT_MS, 12 * 60 * 60_000),
      leaseMs: int(env.REMOTE_LEASE_MS, 60_000),
      onlineWithinMs: int(env.REMOTE_ONLINE_MS, 2 * 60_000),
    },
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
    usdNok: num(env.USD_NOK, 10.5),
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
