import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import Anthropic from '@anthropic-ai/sdk';
import sharp from 'sharp';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ChapterInput } from '@smartnotes/shared';
import { loadConfig } from '../src/config.js';
import { ConversionError } from '../src/errors.js';
import type { AiService, ConvertRequest } from '../src/pipeline/ai.js';
import { AnthropicClaude, RefusalError, mapApiError, pageBlocks } from '../src/pipeline/claude.js';
import { EMPTY_META } from '../src/pipeline/parse.js';
import { RefusalFallback, RoutedAi, createAi, describeAi } from '../src/pipeline/providers.js';
import { getProfile } from '../src/profiles/index.js';
import { RemoteHub } from '../src/remote/hub.js';
import { MeteredAi, zeroUsage, type UsageEntry } from '../src/usage.js';

const base = {
  ...process.env,
  NODE_ENV: 'test',
  APP_PASSWORD: 'x',
  SMARTNOTES_FAKE_CLAUDE: '',
  ANTHROPIC_API_KEY: 'sk-test',
  CLAUDE_MODEL: '',
  CLAUDE_MODEL_FLASHCARDS: '',
  CLAUDE_MODEL_TOC: '',
  CLAUDE_FALLBACKS: '',
  AI_PROVIDER: '',
  AI_PROVIDER_CONVERT: '',
  AI_PROVIDER_FLASHCARDS: '',
  AI_PROVIDER_TOC: '',
  REMOTE_FALLBACK: '',
  WORKER_TOKEN: '',
};

/** En AI som bare forteller hvilken modell som svarte, og som kan avslå (som Claudes sikkerhetsfiltre) eller feile. */
class Answering implements AiService {
  readonly fake = false;
  readonly configured = true;
  constructor(
    readonly provider: string,
    readonly model: string,
    private readonly failure: 'refuse' | 'error' | null = null,
  ) {}
  private async answer<T>(value: T): Promise<T> {
    if (this.failure === 'refuse') throw new RefusalError('Claude avslo å lage kort av disse notatene.');
    if (this.failure === 'error') throw new ConversionError('Noe annet gikk galt.');
    return value;
  }
  convert() {
    return this.answer({ meta: EMPTY_META, body: this.model, usage: zeroUsage('convert', this.model) });
  }
  fix() {
    return this.answer({ body: this.model, usage: zeroUsage('fix', this.model) });
  }
  extractToc() {
    return this.answer({ chapters: [{ number: null, title: this.model }] as ChapterInput[], usage: zeroUsage('toc', this.model) });
  }
  mapSectionAims(_profile: unknown, chapters: ChapterInput[]) {
    return this.answer({ chapters, usage: zeroUsage('aims', this.model) });
  }
  generateFlashcards() {
    return this.answer({ cards: [{ note: 'n1', kind: 'concept' as const, front: this.model, back: [], detail: '' }], usage: zeroUsage('flashcards', this.model) });
  }
}

/** Bytter hver Claude-tjeneste ut med `Answering`, logger kallene, og noterer hvilke modeller som ble laget. */
function answeringAi(config: ReturnType<typeof loadConfig>, failing: Record<string, 'refuse' | 'error'> = {}, hub?: RemoteHub) {
  const made: string[] = [];
  const log: UsageEntry[] = [];
  const ai = createAi(
    config,
    (inner) => {
      made.push(`${inner.provider}:${inner.model}`);
      if (inner.provider !== 'anthropic') return inner;
      return new MeteredAi(new Answering(inner.provider, inner.model, failing[inner.model] ?? null), (e) => log.push(e));
    },
    hub,
  );
  return { ai, made, log };
}

const profile = getProfile('physics');
const convertReq = { profile } as ConvertRequest;
const cardsReq = { subjectName: 'Fysikk 1', subjectLabel: 'Fysikk', difficulty: 'medium', count: null, notes: [] } as never;

describe('Claude-modell per oppgave', () => {
  it('Sonnet konverterer, Haiku lager kortstokker og leser innholdsfortegnelser', async () => {
    const config = loadConfig(base);
    expect(config.claudeModels).toEqual({ convert: 'claude-sonnet-5-5', flashcards: 'claude-haiku-5-5', toc: 'claude-haiku-5-5' });
    expect(config.model).toBe('claude-sonnet-5-5');
    expect(describeAi(config)).toEqual([
      { task: 'convert', provider: 'anthropic', model: 'claude-sonnet-5-5' },
      { task: 'flashcards', provider: 'anthropic', model: 'claude-haiku-5-5' },
      { task: 'toc', provider: 'anthropic', model: 'claude-haiku-5-5' },
    ]);

    const { ai, made } = answeringAi(config);
    expect(ai).toBeInstanceOf(RoutedAi);
    expect(ai.model).toBe('claude-sonnet-5-5');
    // Én tjeneste per modell: Sonnet brukes både til konvertering og som reserve for Haiku.
    expect(made.sort()).toEqual(['anthropic:claude-haiku-5-5', 'anthropic:claude-sonnet-5-5']);
    expect((await ai.convert(convertReq)).body).toBe('claude-sonnet-5-5');
    expect((await ai.fix({ profile, body: '', errorReport: '' })).body).toBe('claude-sonnet-5-5');
    expect((await ai.generateFlashcards(cardsReq)).cards[0]!.front).toBe('claude-haiku-5-5');
    expect((await ai.extractToc(profile, [])).chapters[0]!.title).toBe('claude-haiku-5-5');
    expect((await ai.mapSectionAims(profile, [], [])).usage.model).toBe('claude-haiku-5-5');
  });

  it('avslår Haiku, prøves Sonnet, og begge kallene havner i forbruksloggen', async () => {
    const { ai, log } = answeringAi(loadConfig(base), { 'claude-haiku-5-5': 'refuse' });
    expect((await ai.generateFlashcards(cardsReq)).cards[0]!.front).toBe('claude-sonnet-5-5');
    expect((await ai.extractToc(profile, [])).chapters[0]!.title).toBe('claude-sonnet-5-5');
    expect(log.map((e) => [e.kind, e.model, e.ok])).toEqual([
      ['flashcards', 'claude-haiku-5-5', false],
      ['flashcards', 'claude-sonnet-5-5', true],
      ['toc', 'claude-haiku-5-5', false],
      ['toc', 'claude-sonnet-5-5', true],
    ]);
  });

  it('andre feil enn avslag sendes ikke til reserven', async () => {
    const { ai, log } = answeringAi(loadConfig(base), { 'claude-haiku-5-5': 'error' });
    await expect(ai.generateFlashcards(cardsReq)).rejects.toThrow('Noe annet gikk galt.');
    expect(log.map((e) => e.model)).toEqual(['claude-haiku-5-5']);
  });

  it('CLAUDE_FALLBACKS=0 slår av reserven', async () => {
    const { ai } = answeringAi(loadConfig({ ...base, CLAUDE_FALLBACKS: '0' }), { 'claude-haiku-5-5': 'refuse' });
    await expect(ai.generateFlashcards(cardsReq)).rejects.toBeInstanceOf(RefusalError);
  });

  it('kan overstyres per oppgave', async () => {
    const opus = loadConfig({ ...base, CLAUDE_MODEL: ' claude-opus-5-5 ' });
    expect(opus.claudeModels).toEqual({ convert: 'claude-opus-5-5', flashcards: 'claude-haiku-5-5', toc: 'claude-haiku-5-5' });
    // Reserven for Haiku er konverteringsmodellen.
    const { ai } = answeringAi(opus, { 'claude-haiku-5-5': 'refuse' });
    expect((await ai.generateFlashcards(cardsReq)).cards[0]!.front).toBe('claude-opus-5-5');

    const sonnetCards = loadConfig({ ...base, CLAUDE_MODEL_FLASHCARDS: 'claude-sonnet-5-5' });
    expect(describeAi(sonnetCards).map((d) => d.model)).toEqual(['claude-sonnet-5-5', 'claude-sonnet-5-5', 'claude-haiku-5-5']);
    const routed = answeringAi(sonnetCards);
    expect((await routed.ai.generateFlashcards(cardsReq)).cards[0]!.front).toBe('claude-sonnet-5-5');

    // Samme modell for alt gir én tjeneste, som før.
    const one = loadConfig({ ...base, CLAUDE_MODEL_FLASHCARDS: 'claude-sonnet-5-5', CLAUDE_MODEL_TOC: 'claude-sonnet-5-5' });
    expect(createAi(one)).toBeInstanceOf(AnthropicClaude);
    expect(createAi(one).model).toBe('claude-sonnet-5-5');
  });

  it('Haiku som konverteringsmodell får ingen reserve, og AnthropicClaude bruker modellen den lages med', () => {
    const allHaiku = loadConfig({ ...base, CLAUDE_MODEL: 'claude-haiku-5-5' });
    const ai = createAi(allHaiku);
    expect(ai).toBeInstanceOf(AnthropicClaude);
    expect(ai.model).toBe('claude-haiku-5-5');
    expect(new AnthropicClaude(allHaiku, 'claude-sonnet-5-5').model).toBe('claude-sonnet-5-5');
  });

  it('reserven til hjemmemaskinen bruker oppgavens Claude-modell', async () => {
    const config = loadConfig({ ...base, AI_PROVIDER: 'remote', WORKER_TOKEN: 'x'.repeat(40), REMOTE_FALLBACK: 'anthropic' });
    expect(describeAi(config).map((d) => d.model)).toEqual([
      'hjemmemaskin, ellers claude-sonnet-5-5',
      'hjemmemaskin, ellers claude-haiku-5-5',
      'hjemmemaskin, ellers claude-haiku-5-5',
    ]);
    const hub = new RemoteHub({ leaseMs: 60_000, maxWaitMs: 60_000, interactiveWaitMs: 60_000, maxRunMs: 60_000, maxAttempts: 3, onlineWithinMs: 60_000, fallback: true });
    try {
      // Ingen hjemmemaskin er på nett, så alt går til reserven.
      const { ai } = answeringAi(config, {}, hub);
      expect((await ai.convert(convertReq)).body).toBe('claude-sonnet-5-5');
      expect((await ai.generateFlashcards(cardsReq)).cards[0]!.front).toBe('claude-haiku-5-5');
    } finally {
      hub.close();
    }
  });

  it('RefusalFallback viser primærmodellen utad', () => {
    const fb = new RefusalFallback(new Answering('anthropic', 'claude-haiku-5-5'), new Answering('anthropic', 'claude-sonnet-5-5'));
    expect([fb.model, fb.provider, fb.configured, fb.fake]).toEqual(['claude-haiku-5-5', 'anthropic', true, false]);
  });
});

describe('innholdsfortegnelse og kompetansemål mot API-et', () => {
  /** En falsk Claude API: svarer ut fra forespørselen og husker dem. Må settes før klienten lages, for SDK-en husker fetch. */
  function fakeApi(answer: (model: string, body: Record<string, unknown>) => { text: string; stop: string }) {
    const bodies: Record<string, unknown>[] = [];
    vi.stubGlobal('fetch', async (_url: string, init: RequestInit) => {
      const body = JSON.parse(String(init.body)) as Record<string, unknown>;
      bodies.push(body);
      const { text, stop } = answer(String(body.model), body);
      return Response.json({
        id: 'msg_test',
        type: 'message',
        role: 'assistant',
        model: body.model,
        content: [{ type: 'text', text }],
        stop_reason: stop,
        stop_sequence: null,
        usage: { input_tokens: 100, output_tokens: 20, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 },
      });
    });
    return bodies;
  }
  afterEach(() => vi.unstubAllGlobals());

  const toc = JSON.stringify({ chapters: [{ number: '1', title: 'Bevegelse', sections: [{ code: '1.1', title: 'Fart', aims: [] }] }] });

  it('sender oppgavens modell og ingen server-side fallback til Haiku', async () => {
    const bodies = fakeApi(() => ({ text: toc, stop: 'end_turn' }));
    const res = await new AnthropicClaude(loadConfig(base), 'claude-haiku-5-5').extractToc(profile, []);
    expect(res.chapters).toEqual([{ number: '1', title: 'Bevegelse', sections: [{ code: '1.1', title: 'Fart', aims: [] }] }]);
    expect(res.usage).toMatchObject({ kind: 'toc', model: 'claude-haiku-5-5', inputTokens: 100, outputTokens: 20 });
    expect(bodies[0]).toMatchObject({ model: 'claude-haiku-5-5', output_config: { effort: 'low', format: { type: 'json_schema' } } });
    expect(bodies[0]).not.toHaveProperty('fallbacks');
  });

  it('et avslag midt i svaret fra Haiku går til Sonnet, også når teksten er halvferdig', async () => {
    const aims = JSON.stringify({ sections: [{ code: '1.1', aims: ['km1'] }] });
    // Innholdsfortegnelsen har max_tokens 32 000, kompetansemålene 16 000.
    const bodies = fakeApi((model, body) => {
      const isToc = body.max_tokens === 32_000;
      if (model === 'claude-haiku-5-5') return { text: isToc ? '{"chapters": [' : '', stop: 'refusal' };
      return { text: isToc ? toc : aims, stop: 'end_turn' };
    });
    const ai = createAi(loadConfig(base));
    expect((await ai.extractToc(profile, [])).chapters[0]!.title).toBe('Bevegelse');
    const mapped = await ai.mapSectionAims(profile, [{ number: '1', title: 'Bevegelse', sections: [{ code: '1.1', title: 'Fart', aims: [] }] }], []);
    expect(mapped.chapters[0]!.sections![0]!.aims).toEqual(['km1']);
    expect(bodies.map((b) => b.model)).toEqual(['claude-haiku-5-5', 'claude-sonnet-5-5', 'claude-haiku-5-5', 'claude-sonnet-5-5']);
  });

  it('et ugyldig svar uten avslag gir norsk feil og prøver ikke Sonnet', async () => {
    const bodies = fakeApi(() => ({ text: '{"chapters": [', stop: 'end_turn' }));
    const ai = createAi(loadConfig(base));
    const err = await ai.extractToc(profile, []).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ConversionError);
    expect(err).not.toBeInstanceOf(RefusalError);
    expect((err as Error).message).toBe('Klarte ikke å lese innholdsfortegnelsen.');
    expect(bodies.map((b) => b.model)).toEqual(['claude-haiku-5-5']);
  });
});

describe('sidebildene til Claude', () => {
  it('ber API-et avvise for store bilder i stedet for å krympe dem', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'smartnotes-blocks-'));
    const file = path.join(dir, 'side.jpg');
    fs.writeFileSync(file, await sharp({ create: { width: 20, height: 30, channels: 3, background: '#fff' } }).jpeg().toBuffer());
    const blocks = await pageBlocks([{ path: file, width: 20, height: 30 }]);
    expect(blocks[0]).toEqual({ type: 'text', text: 'Side 1 (20×30 piksler):' });
    expect(blocks[1]).toMatchObject({ type: 'image', source: { type: 'base64', media_type: 'image/jpeg' }, transformations: { oversized_image: 'error' } });
  });

  it('gir norsk melding når modellen ville krympet bildet', () => {
    const err = Anthropic.APIError.generate(
      400,
      {
        type: 'error',
        error: {
          type: 'invalid_request_error',
          message:
            'messages.0.content.1: image dimensions 2576x1400 exceed the maximum image size of a model named on this request and would be downsized to 1568x852; scale the image to at most 1568x852 or set the image\'s oversized_image setting to "downsize"',
        },
      },
      undefined,
      new Headers(),
    );
    const e = mapApiError(err);
    expect(e.message).toMatch(/leser ikke sidebildene i høy oppløsning/);
    expect(e.retryable).toBe(false);
    expect(mapApiError(Anthropic.APIError.generate(404, { type: 'error', error: { type: 'not_found_error', message: 'model' } }, undefined, new Headers())).message).toMatch(
      /CLAUDE_MODEL_FLASHCARDS/,
    );
  });
});
