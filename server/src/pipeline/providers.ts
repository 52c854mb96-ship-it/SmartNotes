/**
 * Velger hvem som kjører AI-en for hver oppgave (konvertering, kortstokker, innholdsfortegnelse) ut fra konfigurasjonen.
 * Standard er Claude for alt. Med for eksempel AI_PROVIDER_CONVERT=ollama konverteres notatene lokalt, mens resten
 * fortsatt går til Claude.
 */
import type { ChapterInput, CompetenceAim } from '@smartnotes/shared';
import { AI_TASKS, type AiProviderId, type AiTask, type Config } from '../config.js';
import type { FlashcardRequest } from '../flashcards/prompt.js';
import type { Profile } from '../profiles/index.js';
import type { AiService, ConvertRequest, FixRequest } from './ai.js';
import { AnthropicClaude, FakeClaude } from './claude.js';
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

/** Om oppgaven kan kjøres (for eksempel at Claude har API-nøkkel når oppgaven skal til Claude). */
export function aiConfigured(ai: AiService, task: AiTask): boolean {
  return ai instanceof RoutedAi ? ai.configuredFor(task) : ai.configured;
}

/**
 * AI-tjenesten appen bruker. `wrap` legges rundt hver leverandør (for eksempel forbruksloggen), én gang per leverandør.
 * Med SMARTNOTES_FAKE_CLAUDE=1 brukes den falske AI-en til alt. Hjemmemaskinen («remote») trenger køen `hub`, og med
 * REMOTE_FALLBACK=anthropic går kallene til Claude når ingen hjemmemaskin er på nett.
 */
export function createAi(config: Config, wrap: (ai: AiService) => AiService = (ai) => ai, hub?: RemoteHub): AiService {
  if (config.fakeClaude) return wrap(new FakeClaude());
  const instances = new Map<AiProviderId, AiService>();
  const make = (id: AiProviderId): AiService => {
    if (id === 'ollama') return wrap(new OllamaAi(config.ollama));
    if (id === 'anthropic') return wrap(new AnthropicClaude(config));
    if (!hub) throw new Error('Hjemmemaskinen (remote) trenger en kø (RemoteHub).');
    const remote = wrap(new RemoteAi(hub));
    return config.remote.fallback === 'anthropic' ? new RemoteWithFallback(remote, get('anthropic'), hub) : remote;
  };
  const get = (id: AiProviderId): AiService => {
    let ai = instances.get(id);
    if (!ai) {
      ai = make(id);
      instances.set(id, ai);
    }
    return ai;
  };
  const byTask = Object.fromEntries(AI_TASKS.map((t) => [t, get(config.aiProviders[t])])) as Record<AiTask, AiService>;
  return instances.size === 1 ? byTask.convert : new RoutedAi(byTask);
}

/** Hvilken leverandør og modell hver oppgave bruker (vises i innstillingene). */
export function describeAi(config: Config): { task: AiTask; provider: AiProviderId | 'fake'; model: string }[] {
  return AI_TASKS.map((task) => {
    if (config.fakeClaude) return { task, provider: 'fake' as const, model: 'fake-claude' };
    const provider = config.aiProviders[task];
    if (provider === 'anthropic') return { task, provider, model: config.model };
    if (provider === 'remote') {
      return { task, provider, model: config.remote.fallback === 'anthropic' ? `hjemmemaskin, ellers ${config.model}` : 'hjemmemaskin' };
    }
    return { task, provider, model: task === 'flashcards' ? config.ollama.textModel : config.ollama.model };
  });
}
