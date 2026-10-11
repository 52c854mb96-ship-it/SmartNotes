/**
 * Forbrukslogg: én rad per AI-kall (også mislykkede), med tokens og varighet. Grunnlaget for å se hva appen faktisk
 * koster, og senere for kvoter per bruker og dag.
 *
 * Loggingen skjer i `MeteredAi`, som legges rundt AI-tjenesten. Hva kallet gjaldt (notat, kortstokk, fag), settes av
 * den som starter arbeidet med `usageScope`, og følger med gjennom alle asynkrone kall (AsyncLocalStorage).
 */
import { AsyncLocalStorage } from 'node:async_hooks';
import type { ChapterInput, CompetenceAim, UsageKind, UsageSummaryResponse } from '@smartnotes/shared';
import { ConversionError } from './errors.js';
import type { AiService, ConvertRequest, ConvertResult, FixRequest } from './pipeline/ai.js';
import type { FlashcardRequest, RawFlashcard } from './flashcards/prompt.js';
import type { Profile } from './profiles/index.js';

export interface Usage {
  kind: UsageKind;
  model: string;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
}

/** Hva et AI-kall gjaldt. */
export interface UsageRef {
  noteId?: string | null;
  deckId?: string | null;
  subjectId?: string | null;
}

export interface UsageEntry extends Usage, Required<UsageRef> {
  /** Tidspunkt (ms siden 1970) da kallet startet. */
  at: number;
  provider: string;
  durationMs: number;
  ok: boolean;
  error: string | null;
}

const scope = new AsyncLocalStorage<UsageRef>();

/** Kjører `fn` slik at AI-kallene den gjør, logges som en del av `ref` (notat, kortstokk eller fag). */
export function usageScope<T>(ref: UsageRef, fn: () => Promise<T>): Promise<T> {
  return scope.run({ ...scope.getStore(), ...ref }, fn);
}

/** Hva AI-kallene som gjøres nå, gjelder (satt med `usageScope`). */
export function currentUsageRef(): UsageRef {
  return { ...scope.getStore() };
}

/** Legger forbruket ved en feil som oppstår etter at modellen har svart (avslag, avkuttet eller ugyldig svar). */
export function withUsage<T>(usage: Usage, fn: () => T): T {
  try {
    return fn();
  } catch (err) {
    if (err instanceof ConversionError && !err.usage) err.usage = usage;
    throw err;
  }
}

export const zeroUsage = (kind: UsageKind, model: string): Usage => ({
  kind,
  model,
  inputTokens: 0,
  outputTokens: 0,
  cacheReadTokens: 0,
  cacheWriteTokens: 0,
});

/**
 * AI-tjenesten med logging rundt hvert kall. Oppfører seg ellers helt likt som tjenesten den pakker inn.
 * Feil fra loggingen stopper aldri selve arbeidet.
 */
export class MeteredAi implements AiService {
  constructor(
    private readonly inner: AiService,
    private readonly record: (entry: UsageEntry) => void,
    private readonly onRecordError: (err: unknown) => void = () => {},
  ) {}

  get configured(): boolean {
    return this.inner.configured;
  }
  get model(): string {
    return this.inner.model;
  }
  get fake(): boolean {
    return this.inner.fake;
  }
  get provider(): string {
    return this.inner.provider;
  }

  convert(req: ConvertRequest): Promise<ConvertResult> {
    return this.meter('convert', () => this.inner.convert(req), (r) => r.usage);
  }

  fix(req: FixRequest): Promise<{ body: string; usage: Usage }> {
    return this.meter('fix', () => this.inner.fix(req), (r) => r.usage);
  }

  extractToc(
    profile: Profile,
    images: { data: Buffer; mediaType: 'image/jpeg' | 'image/png' }[],
    aims?: CompetenceAim[],
  ): Promise<{ chapters: ChapterInput[]; usage: Usage }> {
    return this.meter('toc', () => this.inner.extractToc(profile, images, aims), (r) => r.usage);
  }

  mapSectionAims(profile: Profile, chapters: ChapterInput[], aims: CompetenceAim[]): Promise<{ chapters: ChapterInput[]; usage: Usage }> {
    return this.meter('aims', () => this.inner.mapSectionAims(profile, chapters, aims), (r) => r.usage);
  }

  generateFlashcards(req: FlashcardRequest): Promise<{ cards: RawFlashcard[]; usage: Usage }> {
    return this.meter('flashcards', () => this.inner.generateFlashcards(req), (r) => r.usage);
  }

  private async meter<T>(kind: UsageKind, call: () => Promise<T>, usageOf: (result: T) => Usage): Promise<T> {
    const at = Date.now();
    try {
      const result = await call();
      this.write(at, usageOf(result), true, null);
      return result;
    } catch (err) {
      const usage = err instanceof ConversionError && err.usage ? err.usage : zeroUsage(kind, this.inner.model);
      this.write(at, usage, false, err instanceof Error ? err.message : String(err));
      throw err;
    }
  }

  private write(at: number, usage: Usage, ok: boolean, error: string | null): void {
    const ref = scope.getStore() ?? {};
    try {
      this.record({
        ...usage,
        at,
        provider: this.inner.provider,
        durationMs: Date.now() - at,
        ok,
        error: error ? error.slice(0, 500) : null,
        noteId: ref.noteId ?? null,
        deckId: ref.deckId ?? null,
        subjectId: ref.subjectId ?? null,
      });
    } catch (err) {
      this.onRecordError(err);
    }
  }
}

// ---------- Pris ----------

/** Listepris i dollar per million tokens. */
export interface ModelPrice {
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
}

/** Pris der lesing fra hurtigbufferen koster 0,1 × inndata og skriving 1,25 × inndata (5 minutter). */
const standard = (input: number, output: number): ModelPrice => ({ input, output, cacheRead: input / 10, cacheWrite: input * 1.25 });

/**
 * Listepriser fra Anthropic (prissiden, sjekket 11. oktober 2026). Sonnet 5.5 og Opus 5.5 leser fra hurtigbufferen for
 * 0,05 × inndata, de andre for 0,1 ×. De eldre modellene er med fordi et svar kan komme fra en reservemodell når
 * hovedmodellen avslår (server-side fallback). Haiku 5.5 har høyere pris for forespørsler over 100 000 tokens; det
 * regnes med i `costUsd`.
 */
export const MODEL_PRICES: Record<string, ModelPrice> = {
  'claude-sonnet-5-5': { input: 2, output: 10, cacheRead: 0.1, cacheWrite: 2.5 },
  'claude-opus-5-5': { input: 4, output: 20, cacheRead: 0.2, cacheWrite: 5 },
  'claude-haiku-5-5': standard(0.1, 0.5),
  'claude-sonnet-5': standard(2, 10),
  'claude-opus-5': standard(5, 25),
  'claude-opus-4-8': standard(5, 25),
  'claude-opus-4-7': standard(5, 25),
  'claude-opus-4-6': standard(5, 25),
  'claude-sonnet-4-6': standard(3, 15),
  'claude-haiku-4-5': standard(1, 5),
};
const HAIKU_LONG: ModelPrice = { input: 0.5, output: 2.5, cacheRead: 0.05, cacheWrite: 0.625 };

/** Beregnet kostnad i dollar, `0` for lokale og falske modeller, eller `null` når prisen er ukjent. */
export function costUsd(provider: string, u: Usage): number | null {
  if (provider !== 'anthropic') return 0;
  let price = MODEL_PRICES[u.model];
  if (!price) return null;
  if (u.model === 'claude-haiku-5-5' && u.inputTokens + u.cacheReadTokens + u.cacheWriteTokens > 100_000) price = HAIKU_LONG;
  return (
    (u.inputTokens * price.input + u.outputTokens * price.output + u.cacheReadTokens * price.cacheRead + u.cacheWriteTokens * price.cacheWrite) /
    1_000_000
  );
}

const osloDay = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Oslo', year: 'numeric', month: '2-digit', day: '2-digit' });

/** Oppsummering av loggen for perioden, gruppert etter type, dag og modell. */
export function summarizeUsage(entries: UsageEntry[], opts: { days: number; since: number; usdNok: number }): UsageSummaryResponse {
  const nok = (usd: number) => Math.round(usd * opts.usdNok * 100) / 100;
  type Acc = { calls: number; failed: number; inputTokens: number; outputTokens: number; usd: number; unpriced: number };
  const empty = (): Acc => ({ calls: 0, failed: 0, inputTokens: 0, outputTokens: 0, usd: 0, unpriced: 0 });
  const add = (acc: Acc, e: UsageEntry, usd: number | null) => {
    acc.calls += 1;
    if (!e.ok) acc.failed += 1;
    acc.inputTokens += e.inputTokens + e.cacheReadTokens + e.cacheWriteTokens;
    acc.outputTokens += e.outputTokens;
    if (usd === null) acc.unpriced += 1;
    else acc.usd += usd;
  };
  const total = empty();
  const byKind = new Map<UsageKind, Acc>();
  const byDay = new Map<string, Acc>();
  const byModel = new Map<string, Acc & { provider: string; model: string }>();
  for (const e of entries) {
    const usd = costUsd(e.provider, e);
    add(total, e, usd);
    add(byKind.get(e.kind) ?? byKind.set(e.kind, empty()).get(e.kind)!, e, usd);
    const day = osloDay.format(new Date(e.at));
    add(byDay.get(day) ?? byDay.set(day, empty()).get(day)!, e, usd);
    const key = `${e.provider}:${e.model}`;
    add(byModel.get(key) ?? byModel.set(key, { ...empty(), provider: e.provider, model: e.model }).get(key)!, e, usd);
  }
  const out = (a: Acc) => ({
    calls: a.calls,
    failed: a.failed,
    inputTokens: a.inputTokens,
    outputTokens: a.outputTokens,
    costNok: nok(a.usd),
    unpricedCalls: a.unpriced,
  });
  return {
    days: opts.days,
    since: new Date(opts.since).toISOString(),
    usdNok: opts.usdNok,
    total: out(total),
    byKind: [...byKind].map(([kind, a]) => ({ kind, ...out(a) })).sort((a, b) => b.costNok - a.costNok || b.calls - a.calls),
    byDay: [...byDay].map(([day, a]) => ({ day, ...out(a) })).sort((a, b) => a.day.localeCompare(b.day)),
    byModel: [...byModel.values()].map((a) => ({ provider: a.provider, model: a.model, ...out(a) })).sort((a, b) => b.calls - a.calls),
  };
}
