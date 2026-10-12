/**
 * Velger hvem som kjører AI-en for hver oppgave (konvertering, kortstokker, innholdsfortegnelse) ut fra konfigurasjonen.
 * Standard er Claude for alt: Sonnet for konvertering og Haiku for kortstokker og innholdsfortegnelser
 * (`config.claudeModels`). Med for eksempel AI_PROVIDER_CONVERT=ollama konverteres notatene lokalt, mens resten
 * fortsatt går til Claude.
 */
import type { ChapterInput, CompetenceAim } from '@smartnotes/shared';
import { AI_TASKS, type AiProviderId, type AiTask, type Config } from '../config.js';
import type { FlashcardRequest } from '../flashcards/prompt.js';
import type { Profile } from '../profiles/index.js';
import type { AiService, ConvertRequest, FixRequest } from './ai.js';
import { AnthropicClaude, FakeClaude, RefusalError, supportsServerFallback } from './claude.js';
import { OllamaAi } from './ollama.js';
import { RemoteAi, RemoteWithFallback, type RemoteHub } from '../remote/hub.js';

/** Sender hver oppgave til sin leverandør. Retting av LaTeX følger konverteringen, kompetansemål følger innholdsfortegnelsen. */
export class RoutedAi implements AiService {
  constructor(private readonly byTask: Record<AiTask, AiService>) {}

  get configured(): boolean {
    return AI_TASKS.every((t) => this.byTask[t].configured);
  }
  configuredFor(task: AiTask): boolean {
    return this.byTask[task].configured;
  }
  get model(): string {
    return this.byTask.convert.model;
  }
  get fake(): boolean {
    return this.byTask.convert.fake;
  }
  get provider(): string {
    return this.byTask.convert.provider;
  }

  convert(req: ConvertRequest) {
    return this.byTask.convert.convert(req);
  }
  fix(req: FixRequest) {
    return this.byTask.convert.fix(req);
  }
  extractToc(profile: Profile, images: { data: Buffer; mediaType: 'image/jpeg' | 'image/png' }[], aims?: CompetenceAim[]) {
    return this.byTask.toc.extractToc(profile, images, aims);
  }
  mapSectionAims(profile: Profile, chapters: ChapterInput[], aims: CompetenceAim[]) {
    return this.byTask.toc.mapSectionAims(profile, chapters, aims);
  }
  generateFlashcards(req: FlashcardRequest) {
    return this.byTask.flashcards.generateFlashcards(req);
  }
}

/**
 * Prøver `fallback` når `primary` avslår (Claude-modellens sikkerhetsfiltre). Brukes for Haiku, som ikke har
 * server-side fallback, med konverteringsmodellen (Sonnet) som reserve. Begge kallene logges i forbruksloggen.
 */
export class RefusalFallback implements AiService {
  constructor(
    private readonly primary: AiService,
    private readonly fallback: AiService,
  ) {}

  get configured(): boolean {
    return this.primary.configured;
  }
  get model(): string {
    return this.primary.model;
  }
  get fake(): boolean {
    return this.primary.fake;
  }
  get provider(): string {
    return this.primary.provider;
  }

  private async run<T>(call: (ai: AiService) => Promise<T>): Promise<T> {
    try {
      return await call(this.primary);
    } catch (err) {
      if (err instanceof RefusalError) return call(this.fallback);
      throw err;
    }
  }

  convert(req: ConvertRequest) {
    return this.run((ai) => ai.convert(req));
  }
  fix(req: FixRequest) {
    return this.run((ai) => ai.fix(req));
  }
  extractToc(profile: Profile, images: { data: Buffer; mediaType: 'image/jpeg' | 'image/png' }[], aims?: CompetenceAim[]) {
    return this.run((ai) => ai.extractToc(profile, images, aims));
  }
  mapSectionAims(profile: Profile, chapters: ChapterInput[], aims: CompetenceAim[]) {
    return this.run((ai) => ai.mapSectionAims(profile, chapters, aims));
  }
  generateFlashcards(req: FlashcardRequest) {
    return this.run((ai) => ai.generateFlashcards(req));
  }
}

/** Om oppgaven kan kjøres (for eksempel at Claude har API-nøkkel når oppgaven skal til Claude). */
export function aiConfigured(ai: AiService, task: AiTask): boolean {
  return ai instanceof RoutedAi ? ai.configuredFor(task) : ai.configured;
}

/**
 * AI-tjenesten appen bruker. `wrap` legges rundt hver leverandør og modell (for eksempel forbruksloggen), én gang hver.
 * Med SMARTNOTES_FAKE_CLAUDE=1 brukes den falske AI-en til alt. Hjemmemaskinen («remote») trenger køen `hub`, og med
 * REMOTE_FALLBACK=anthropic går kallene til Claude (med oppgavens modell) når ingen hjemmemaskin er på nett.
 */
export function createAi(config: Config, wrap: (ai: AiService) => AiService = (ai) => ai, hub?: RemoteHub): AiService {
  if (config.fakeClaude) return wrap(new FakeClaude());
  const instances = new Map<string, AiService>();
  const cached = (key: string, make: () => AiService): AiService => {
    let ai = instances.get(key);
    if (!ai) {
      ai = make();
      instances.set(key, ai);
    }
    return ai;
  };
  const claudeModel = (model: string): AiService => cached(`anthropic:${model}`, () => wrap(new AnthropicClaude(config, model)));
  /** Claude for oppgaven. En modell uten server-side fallback (Haiku) får konverteringsmodellen som reserve ved avslag. */
  const claude = (task: AiTask): AiService => {
    const model = config.claudeModels[task];
    const reserve = config.claudeModels.convert;
    if (!config.useFallbacks || supportsServerFallback(model) || model === reserve || !supportsServerFallback(reserve)) return claudeModel(model);
    return cached(`anthropic:${model}>${reserve}`, () => new RefusalFallback(claudeModel(model), claudeModel(reserve)));
  };
  const forTask = (task: AiTask): AiService => {
    const id: AiProviderId = config.aiProviders[task];
    if (id === 'anthropic') return claude(task);
    if (id === 'ollama') return cached('ollama', () => wrap(new OllamaAi(config.ollama)));
    return cached('remote', () => {
      if (!hub) throw new Error('Hjemmemaskinen (remote) trenger en kø (RemoteHub).');
      const remote = wrap(new RemoteAi(hub));
      if (config.remote.fallback !== 'anthropic') return remote;
      const reserve = new RoutedAi(Object.fromEntries(AI_TASKS.map((t) => [t, claude(t)])) as Record<AiTask, AiService>);
      return new RemoteWithFallback(remote, reserve, hub);
    });
  };
  const byTask = Object.fromEntries(AI_TASKS.map((t) => [t, forTask(t)])) as Record<AiTask, AiService>;
  return new Set(Object.values(byTask)).size === 1 ? byTask.convert : new RoutedAi(byTask);
}

/** Hvilken leverandør og modell hver oppgave bruker (vises i innstillingene). */
export function describeAi(config: Config): { task: AiTask; provider: AiProviderId | 'fake'; model: string }[] {
  return AI_TASKS.map((task) => {
    if (config.fakeClaude) return { task, provider: 'fake' as const, model: 'fake-claude' };
    const provider = config.aiProviders[task];
    const claude = config.claudeModels[task];
    if (provider === 'anthropic') return { task, provider, model: claude };
    if (provider === 'remote') {
      return { task, provider, model: config.remote.fallback === 'anthropic' ? `hjemmemaskin, ellers ${claude}` : 'hjemmemaskin' };
    }
    return { task, provider, model: task === 'flashcards' ? config.ollama.textModel : config.ollama.model };
  });
}
