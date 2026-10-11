import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import { beforeAll, describe, expect, it } from 'vitest';
import { loadConfig, type OllamaConfig } from '../src/config.js';
import { ConversionError } from '../src/errors.js';
import type { ConvertRequest } from '../src/pipeline/ai.js';
import { AnthropicClaude, FakeClaude } from '../src/pipeline/claude.js';
import { OllamaAi, mergeParts, ollamaError, partPage, repairLatexEscapes, scaleFigures, stripThinking } from '../src/pipeline/ollama.js';
import { supportsServerFallback } from '../src/pipeline/claude.js';
import { parseMeta } from '../src/pipeline/parse.js';
import { RoutedAi, aiConfigured, createAi, describeAi } from '../src/pipeline/providers.js';
import { getProfile } from '../src/profiles/index.js';

const CFG: OllamaConfig = {
  url: 'http://ollama.test:11434',
  model: 'qwen2.5vl:7b',
  textModel: 'qwen3:8b',
  imageMaxEdge: 1600,
  numCtx: 16_384,
  maxCtx: 32_768,
  think: false,
  maxTokens: 8192,
  timeoutMs: 60_000,
  boxUnits: 'pixels',
  pagesPerCall: 0,
  keepAlive: '10m',
};

interface Call {
  url: string;
  body: {
    model: string;
    messages: { role: string; content: string; images?: string[] }[];
    format?: unknown;
    think?: boolean;
    options: Record<string, number>;
    stream: boolean;
  };
}

/** En falsk Ollama: svarer med det testen ber om og husker forespørslene. */
function fakeOllama(reply: (call: Call) => { status?: number; lines: unknown[] } | Error) {
  const calls: Call[] = [];
  const fetchImpl = (async (url: string, init: RequestInit) => {
    const call: Call = { url, body: JSON.parse(String(init.body)) };
    calls.push(call);
    const r = reply(call);
    if (r instanceof Error) throw r;
    const ndjson = r.lines.map((l) => JSON.stringify(l)).join('\n') + '\n';
    return new Response(ndjson, { status: r.status ?? 200, headers: { 'content-type': 'application/x-ndjson' } });
  }) as unknown as typeof fetch;
  return { calls, fetchImpl };
}

/** Et strømmet svar fra Ollama: innholdet i to biter, og tallene i den siste. */
const answer = (content: string, extra: Record<string, unknown> = {}) => {
  const half = Math.floor(content.length / 2);
  return {
    lines: [
      { model: 'qwen2.5vl:7b', message: { role: 'assistant', content: content.slice(0, half) }, done: false },
      {
        model: 'qwen2.5vl:7b',
        message: { role: 'assistant', content: content.slice(half) },
        done: true,
        done_reason: 'stop',
        prompt_eval_count: 4200,
        eval_count: 900,
        ...extra,
      },
    ],
  };
};
const failure = (status: number, error: string) => ({ status, lines: [{ error }] });

let pagePath = '';
const PAGE = { width: 2576, height: 1932 };

beforeAll(async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'smartnotes-ollama-'));
  pagePath = path.join(dir, 'side1.jpg');
  await sharp({ create: { width: PAGE.width, height: PAGE.height, channels: 3, background: '#ffffff' } }).jpeg().toFile(pagePath);
});

function convertRequest(): ConvertRequest {
  return {
    profile: getProfile('physics'),
    subjectName: 'Fysikk 1',
    textbook: null,
    chapters: [{ alias: 'k1', number: '1', title: 'Bevegelse', sections: [] }],
    fixedChapter: null,
    userTitle: null,
    userDate: null,
    instructions: null,
    today: '2026-10-11',
    pages: [{ path: pagePath, ...PAGE }],
  };
}

const CONVERTED = `<metadata>{"title":"Fart","chapter":"k1","section":null,"new_chapter":null,"date":null,
"figures":[{"id":"fig1","page":1,"box":[100,200,800,600]}],"remarks":[]}</metadata>
<latex>\\section*{Fart}
Fart er strekning per tid.</latex>`;

describe('OllamaAi', () => {
  it('konverterer med nedskalerte bilder og regner figurboksene tilbake til sidepiksler', async () => {
    const { calls, fetchImpl } = fakeOllama(() => answer(`<think>Jeg tenker …</think>${CONVERTED}`));
    const ai = new OllamaAi(CFG, fetchImpl);
    const res = await ai.convert(convertRequest());

    expect(calls).toHaveLength(1);
    const { url, body } = calls[0]!;
    expect(url).toBe('http://ollama.test:11434/api/chat');
    expect(body).toMatchObject({ model: 'qwen2.5vl:7b', stream: true, think: false, options: { temperature: 0, num_ctx: 16_384, num_predict: 8192 } });
    expect(body.format).toBeUndefined();
    expect(body.messages[0]).toMatchObject({ role: 'system', content: getProfile('physics').systemPrompt });
    const user = body.messages[1]!;
    // 2576 × 1932 skalert til 1600 på lengste kant og rundet ned til hele 28-piksler.
    expect(user.content).toContain('Side 1: 1596×1176 piksler');
    expect(user.content).toContain('k1: 1 Bevegelse');
    expect(user.images).toHaveLength(1);
    const sent = await sharp(Buffer.from(user.images![0]!, 'base64')).metadata();
    expect([sent.width, sent.height]).toEqual([1596, 1176]);

    expect(res.body).toBe('\\section*{Fart}\nFart er strekning per tid.');
    expect(res.meta.title).toBe('Fart');
    // 2576 / 1596 og 1932 / 1176
    expect(res.meta.figures).toEqual([{ id: 'fig1', page: 1, box: [161, 329, 1291, 986] }]);
    expect(res.usage).toEqual({ kind: 'convert', model: 'qwen2.5vl:7b', inputTokens: 4200, outputTokens: 900, cacheReadTokens: 0, cacheWriteTokens: 0 });
  });

  it('forstår figurbokser i tusendeler', async () => {
    const { calls, fetchImpl } = fakeOllama(() => answer(CONVERTED));
    const res = await new OllamaAi({ ...CFG, boxUnits: 'thousandths' }, fetchImpl).convert(convertRequest());
    expect(calls[0]!.body.messages[1]!.content).toContain('tusendeler');
    expect(res.meta.figures[0]!.box).toEqual([258, 386, 2061, 1159]);
  });

  it('avkuttet svar gir norsk feil med forbruket', async () => {
    const { fetchImpl } = fakeOllama(() => answer('<metadata>{}</metadata><latex>\\section*{A', { done_reason: 'length' }));
    const err = await new OllamaAi(CFG, fetchImpl).convert(convertRequest()).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ConversionError);
    expect((err as ConversionError).message).toMatch(/for langt for den lokale AI-en/);
    expect((err as ConversionError).usage).toMatchObject({ kind: 'convert', inputTokens: 4200, outputTokens: 900 });
  });

  it('uventet format sier at det var den lokale AI-en', async () => {
    const { fetchImpl } = fakeOllama(() => answer('Her er notatet ditt!'));
    await expect(new OllamaAi(CFG, fetchImpl).convert(convertRequest())).rejects.toThrow(/^Den lokale AI-en svarte i et uventet format/);
  });

  it('retter LaTeX med tekstmodellen', async () => {
    const { calls, fetchImpl } = fakeOllama(() => answer('<latex>\\section*{Rettet}</latex>'));
    const res = await new OllamaAi(CFG, fetchImpl).fix({ profile: getProfile('physics'), body: '\\section*{Rettet', errorReport: 'Missing }' });
    expect(res.body).toBe('\\section*{Rettet}');
    expect(calls[0]!.body.model).toBe('qwen3:8b');
    expect(calls[0]!.body.messages[1]!.content).toContain('<compile_errors>\nMissing }');
    expect(res.usage.kind).toBe('fix');
  });

  it('lager kort med JSON-skjema og avviser ugyldige svar', async () => {
    const cards = { cards: [{ note: 'n1', kind: 'concept', front: 'Hva er fart?', back: ['Strekning per tid'], detail: '' }] };
    const ok = fakeOllama(() => answer(JSON.stringify(cards)));
    const req = { subjectName: 'Fysikk 1', subjectLabel: 'Fysikk', difficulty: 'medium', count: null, notes: [] } as never;
    const res = await new OllamaAi(CFG, ok.fetchImpl).generateFlashcards(req);
    expect(res.cards).toEqual(cards.cards);
    expect(ok.calls[0]!.body.format).toMatchObject({ type: 'object' });
    expect(ok.calls[0]!.body.model).toBe('qwen3:8b');

    const bad = fakeOllama(() => answer('{"kort": []}'));
    await expect(new OllamaAi(CFG, bad.fetchImpl).generateFlashcards(req)).rejects.toThrow('Den lokale AI-en svarte ikke med kort');
  });

  it('retter LaTeX som modellen skrev med enkel backslash i JSON', async () => {
    // Slik en liten modell ofte skriver det: \frac blir sideskift + «rac» når JSON leses, \theta blir tabulator + «heta».
    const raw =
      '{"cards": [{"note": "n1", "kind": "concept", "front": "$v = \\frac{s}{t}$ og $\\theta$", "back": ["$\\nu \\neq \\rho$", "$\\beta$"], "detail": "Første linje\\nneste linje"}]}';
    const ok = fakeOllama(() => answer(raw));
    const req = { subjectName: 'Fysikk 1', subjectLabel: 'Fysikk', difficulty: 'medium', count: null, notes: [] } as never;
    const [card] = (await new OllamaAi(CFG, ok.fetchImpl).generateFlashcards(req)).cards;
    expect(card).toMatchObject({ front: '$v = \\frac{s}{t}$ og $\\theta$', back: ['$\\nu \\neq \\rho$', '$\\beta$'], detail: 'Første linje\nneste linje' });
  });

  it('repairLatexEscapes lar riktig LaTeX og vanlig tekst være', () => {
    // Utenfor $…$ er linjeskift og tabulator vanlig tekst, også foran ord som «u-land» og «mid».
    const plain = ['$\\frac{1}{2}$', 'linje\nNeste', 'linje\ni dag', 'Dette er\nu-land', 'linje\nmid', 'tab\t1', '1 u\n= 1,66'];
    expect(repairLatexEscapes({ a: plain, n: 3, b: null })).toEqual({ a: plain, n: 3, b: null });
    // Sideskift og backspace alltid, resten bare inne i matematikk.
    expect(repairLatexEscapes('\f og \x08')).toBe('\\f og \\b');
    expect(repairLatexEscapes('$\tx + \rho + \nabla + a \ne b + \neg c$ og $$\theta$$')).toBe(
      '$\\tx + \\rho + \\nabla + a \\ne b + \\neg c$ og $$\\theta$$',
    );
  });

  it('leser innholdsfortegnelse og kompetansemål som JSON', async () => {
    const toc = { chapters: [{ number: '1', title: 'Bevegelse', sections: [{ code: '1.1', title: 'Fart', aims: [] }] }] };
    const { calls, fetchImpl } = fakeOllama((c) => (c.body.messages.at(-1)!.images ? answer(JSON.stringify(toc)) : answer('{"sections":[{"code":"1.1","aims":["KM2"]}]}')));
    const ai = new OllamaAi(CFG, fetchImpl);
    const png = await sharp({ create: { width: 3000, height: 2000, channels: 3, background: '#fff' } }).png().toBuffer();
    const read = await ai.extractToc(getProfile('physics'), [{ data: png, mediaType: 'image/png' }]);
    expect(read.chapters).toEqual(toc.chapters);
    const sent = await sharp(Buffer.from(calls[0]!.body.messages[0]!.images![0]!, 'base64')).metadata();
    expect(sent.width).toBe(1600);
    const mapped = await ai.mapSectionAims(getProfile('physics'), toc.chapters, [{ code: 'KM2', text: 'Mål', cross: false }]);
    expect(mapped.chapters[0]!.sections![0]!.aims).toEqual(['KM2']);
    expect(mapped.usage.kind).toBe('aims');
  });

  it('gir norske feilmeldinger når Ollama ikke svarer eller mangler modellen', async () => {
    const down = fakeOllama(() => new TypeError('fetch failed'));
    const offline = await new OllamaAi(CFG, down.fetchImpl).fix({ profile: getProfile('physics'), body: '', errorReport: '' }).catch((e: unknown) => e);
    expect(offline).toMatchObject({ retryable: true });
    expect((offline as Error).message).toMatch(/Fikk ikke kontakt med den lokale AI-en \(Ollama på http:\/\/ollama\.test:11434\)/);

    const slow = fakeOllama(() => Object.assign(new Error('timeout'), { name: 'TimeoutError' }));
    await expect(new OllamaAi(CFG, slow.fetchImpl).fix({ profile: getProfile('physics'), body: '', errorReport: '' })).rejects.toMatchObject({
      retryable: false,
      message: expect.stringMatching(/brukte for lang tid/),
    });

    const missing = fakeOllama(() => failure(404, "model 'qwen3:8b' not found, try pulling it first"));
    await expect(new OllamaAi(CFG, missing.fetchImpl).fix({ profile: getProfile('physics'), body: '', errorReport: '' })).rejects.toThrow(
      'Last den ned med: ollama pull qwen3:8b',
    );
  });

  it('ollamaError skiller minne, serverfeil og andre feil', () => {
    expect(ollamaError(500, 'model requires more system memory (9.1 GiB) than is available', 'm')).toMatchObject({ retryable: false });
    expect(ollamaError(500, 'llama runner process has terminated', 'm')).toMatchObject({ retryable: true });
    expect(ollamaError(500, 'file not found', 'm')).toMatchObject({ retryable: true });
    expect(ollamaError(429, 'server busy', 'm')).toMatchObject({ retryable: true });
    expect(ollamaError(404, '', 'm').message).toContain('Fant ikke Ollama');
    expect(ollamaError(400, 'invalid format', 'm').message).toContain('invalid format');
  });

  it('feil midt i strømmen, tidsavbrudd og forbruk ved feil', async () => {
    const midway = fakeOllama(() => ({ lines: [{ message: { content: '<latex>' }, done: false }, { error: 'llama runner process has terminated' }] }));
    await expect(new OllamaAi(CFG, midway.fetchImpl).fix({ profile: getProfile('physics'), body: '', errorReport: '' })).rejects.toMatchObject({
      retryable: true,
      usage: { kind: 'fix', model: 'qwen3:8b', inputTokens: 0 },
    });
    const headers = fakeOllama(() => Object.assign(new TypeError('fetch failed'), { cause: { code: 'UND_ERR_HEADERS_TIMEOUT' } }));
    await expect(new OllamaAi(CFG, headers.fetchImpl).fix({ profile: getProfile('physics'), body: '', errorReport: '' })).rejects.toMatchObject({
      retryable: false,
      message: expect.stringMatching(/brukte for lang tid/),
    });
  });

  it('gjør kontekstvinduet større ved behov, og sier fra før det blir for stort', async () => {
    const { calls, fetchImpl } = fakeOllama(() => answer('<latex>x</latex>'));
    const ai = new OllamaAi(CFG, fetchImpl);
    await ai.fix({ profile: getProfile('physics'), body: 'a'.repeat(30_000), errorReport: '' });
    const ctx = calls[0]!.body.options.num_ctx!;
    expect(ctx).toBeGreaterThan(16_384);
    expect(ctx % 2048).toBe(0);
    const err = await ai.fix({ profile: getProfile('physics'), body: 'a'.repeat(100_000), errorReport: '' }).catch((e: unknown) => e);
    expect((err as Error).message).toMatch(/for stort for den lokale AI-en .* OLLAMA_MAX_CTX/);
    expect(calls).toHaveLength(1);
    await new OllamaAi({ ...CFG, think: true }, fetchImpl).fix({ profile: getProfile('physics'), body: '', errorReport: '' });
    expect(calls[1]!.body.think).toBeUndefined();
  });

  it('konverterer én side om gangen og setter delene sammen', async () => {
    const part = (n: number) =>
      `<metadata>{"title":${n === 1 ? 'null' : '"Fart"'},"chapter":"k1","section":null,"new_chapter":null,"date":null,` +
      `"figures":[{"id":"fig1","page":1,"box":[100,100,500,500]}],"remarks":["Merknad ${n}"]}</metadata>` +
      `<latex>\\section*{Del ${n}}\n\\originalfigur[0.5]{fig1}{Figur ${n}}</latex>`;
    let n = 0;
    const { calls, fetchImpl } = fakeOllama(() => answer(part(++n)));
    const req = convertRequest();
    const res = await new OllamaAi({ ...CFG, boxUnits: 'thousandths', pagesPerCall: 1 }, fetchImpl).convert({ ...req, pages: [req.pages[0]!, req.pages[0]!] });
    expect(calls).toHaveLength(2);
    expect(calls[0]!.body.messages[1]!.images).toHaveLength(1);
    expect(calls[0]!.body.messages[1]!.content).toContain('Dette er side 1 av 2');
    expect(calls[1]!.body.messages[1]!.content).toContain('Dette er side 2 av 2');
    expect(res.body).toBe('\\section*{Del 1}\n\\originalfigur[0.5]{fig1}{Figur 1}\n\n\\section*{Del 2}\n\\originalfigur[0.5]{fig2}{Figur 2}');
    expect(res.meta.figures.map((f) => [f.id, f.page])).toEqual([
      ['fig1', 1],
      ['fig2', 2],
    ]);
    expect(res.meta).toMatchObject({ title: 'Fart', chapter: 'k1', remarks: ['Merknad 1', 'Merknad 2'] });
    expect(res.usage).toMatchObject({ inputTokens: 8400, outputTokens: 1800 });
  });

  it('figurene på side 2 og utover finnes også når modellen oppgir sidenummeret i hele notatet', async () => {
    let n = 0;
    const { fetchImpl } = fakeOllama(() => {
      n += 1;
      // Modellen svarer «page»: 2 for den andre siden, selv om delen bare har ett bilde.
      return answer(`<metadata>{"title":"T","figures":[{"id":"fig1","page":${n},"box":[100,100,500,500]}],"remarks":[]}</metadata><latex>\\originalfigur[0.5]{fig1}{F}</latex>`);
    });
    const req = convertRequest();
    const res = await new OllamaAi({ ...CFG, boxUnits: 'thousandths', pagesPerCall: 1 }, fetchImpl).convert({ ...req, pages: [req.pages[0]!, req.pages[0]!] });
    expect(res.meta.figures.map((f) => [f.id, f.page])).toEqual([
      ['fig1', 1],
      ['fig2', 2],
    ]);
    expect([partPage(2, 1, 1), partPage(4, 2, 2), partPage(2, 2, 2), partPage(9, 2, 2)]).toEqual([1, 2, 2, 9]);
  });

  it('rettingen av et langt notat får plass til hele kroppen i svaret', async () => {
    const { calls, fetchImpl } = fakeOllama(() => answer('<latex>\\section*{Rettet}</latex>'));
    const body = 'x'.repeat(30_000);
    await new OllamaAi(CFG, fetchImpl).fix({ profile: getProfile('physics'), body, errorReport: '' });
    expect(calls[0]!.body.options.num_predict).toBe(11_000);
    const short = fakeOllama(() => answer('<latex>\\section*{Rettet}</latex>'));
    await new OllamaAi(CFG, short.fetchImpl).fix({ profile: getProfile('physics'), body: 'kort', errorReport: '' });
    expect(short.calls[0]!.body.options.num_predict).toBe(8192);
  });

  it('mergeParts: figurer som ikke er i metadata, får også nye navn', () => {
    const usage = { kind: 'convert' as const, model: 'm', inputTokens: 1, outputTokens: 1, cacheReadTokens: 0, cacheWriteTokens: 0 };
    const meta = { title: null, chapter: null, section: null, newChapter: null, date: null, figures: [], remarks: [] };
    const merged = mergeParts(
      [
        { meta: { ...meta, figures: [{ id: 'a', page: 2, box: [0, 0, 1, 1] }] }, body: '\\originalfigur{a}{A} \\originalfigur{b}{B}', usage },
        { meta: { ...meta, date: '2026-10-11' }, body: '\\originalfigur [0.4] {a}{C}', usage },
      ],
      4,
      2,
    );
    expect(merged.body).toBe('\\originalfigur{fig1}{A} \\originalfigur{fig2}{B}\n\n\\originalfigur [0.4] {fig3}{C}');
    expect(merged.meta.figures).toEqual([{ id: 'fig1', page: 2, box: [0, 0, 1, 1] }]);
    expect(merged.meta.date).toBe('2026-10-11');
    expect(merged.usage.inputTokens).toBe(2);
  });

  it('hjelpere: fjerner tenkning og ugyldige bokser', () => {
    expect(stripThinking('<think>\nhmm\n</think>\n\nSvar')).toBe('Svar');
    const page = { sent: { width: 100, height: 100 }, page: { width: 200, height: 200 } };
    expect(scaleFigures([{ id: 'a', page: 1, box: [50, 50, 10, 10] }], [page], 'pixels')).toEqual([{ id: 'a', page: 1, box: [20, 20, 100, 100] }]);
    expect(scaleFigures([{ id: 'b', page: 2, box: [0, 0, 10, 10] }], [page], 'pixels')).toEqual([]);
    expect(scaleFigures([{ id: 'c', page: 1, box: [5, 5, 5, 50] }], [page], 'pixels')).toEqual([]);
    // [y0, x0, y1, x1] i tusendeler
    expect(scaleFigures([{ id: 'e', page: 1, box: [100, 200, 500, 600] }], [page], 'thousandths-yx')).toEqual([{ id: 'e', page: 1, box: [40, 20, 120, 100] }]);
    // Andeler (0–1) forstås uansett innstilling.
    expect(scaleFigures([{ id: 'd', page: 1, box: [0.1, 0.2, 0.5, 0.6] }], [page], 'thousandths')).toEqual([{ id: 'd', page: 1, box: [20, 40, 100, 120] }]);
  });
});

describe('små ting for lokale modeller', () => {
  it('leser figurbokser i Qwens eget format (bbox_2d)', () => {
    expect(parseMeta('{"figures":[{"id":"fig1","page":1,"bbox_2d":[1,2,3,4]}]}').figures).toEqual([{ id: 'fig1', page: 1, box: [1, 2, 3, 4] }]);
  });
  it('sender ikke server-side fallback til Haiku', () => {
    expect(supportsServerFallback('claude-sonnet-5-5')).toBe(true);
    expect(supportsServerFallback('claude-haiku-5-5')).toBe(false);
  });
  it('standard: Qwen3.5 9B, figurbokser i tusendeler, én side per kall', () => {
    const c = loadConfig({ ...process.env, NODE_ENV: 'test', APP_PASSWORD: 'x' });
    expect(c.ollama).toMatchObject({ model: 'qwen3.5:9b', textModel: 'qwen3.5:9b', boxUnits: 'thousandths', pagesPerCall: 1 });
  });
});

describe('valg av leverandør', () => {
  const base = { ...process.env, NODE_ENV: 'test', APP_PASSWORD: 'x', SMARTNOTES_FAKE_CLAUDE: '' };

  it('bruker Claude for alt som standard', () => {
    const config = loadConfig({ ...base, ANTHROPIC_API_KEY: 'sk-test' });
    expect(config.aiProviders).toEqual({ convert: 'anthropic', flashcards: 'anthropic', toc: 'anthropic' });
    expect(createAi(config)).toBeInstanceOf(AnthropicClaude);
    expect(describeAi(config)).toEqual([
      { task: 'convert', provider: 'anthropic', model: 'claude-sonnet-5-5' },
      { task: 'flashcards', provider: 'anthropic', model: 'claude-sonnet-5-5' },
      { task: 'toc', provider: 'anthropic', model: 'claude-sonnet-5-5' },
    ]);
  });

  it('kan sende én oppgave til Ollama og resten til Claude', () => {
    const config = loadConfig({ ...base, AI_PROVIDER_CONVERT: 'ollama', OLLAMA_MODEL: 'qwen3-vl:8b', OLLAMA_TEXT_MODEL: 'qwen3:8b', OLLAMA_URL: 'http://pc:11434/' });
    expect(config.ollama).toMatchObject({ url: 'http://pc:11434', model: 'qwen3-vl:8b', textModel: 'qwen3:8b' });
    const wrapped: string[] = [];
    const ai = createAi(config, (inner) => {
      wrapped.push(inner.provider);
      return inner;
    });
    expect(ai).toBeInstanceOf(RoutedAi);
    expect(wrapped.sort()).toEqual(['anthropic', 'ollama']);
    // Uten API-nøkkel kan konverteringen (lokal) kjøre, men ikke kortstokkene (Claude).
    expect(aiConfigured(ai, 'convert')).toBe(true);
    expect(aiConfigured(ai, 'flashcards')).toBe(false);
    expect(describeAi(config).map((d) => `${d.task}:${d.provider}:${d.model}`)).toEqual([
      'convert:ollama:qwen3-vl:8b',
      'flashcards:anthropic:claude-sonnet-5-5',
      'toc:anthropic:claude-sonnet-5-5',
    ]);
  });

  it('AI_PROVIDER=ollama gir én lokal leverandør for alt, og falsk AI overstyrer', () => {
    expect(createAi(loadConfig({ ...base, AI_PROVIDER: 'ollama' }))).toBeInstanceOf(OllamaAi);
    expect(createAi(loadConfig({ ...base, AI_PROVIDER: 'ollama', SMARTNOTES_FAKE_CLAUDE: '1' }))).toBeInstanceOf(FakeClaude);
  });

  it('avviser ukjente verdier med norsk melding', () => {
    expect(() => loadConfig({ ...base, AI_PROVIDER: 'openai' })).toThrow('AI_PROVIDER må være «anthropic», «ollama» eller «remote».');
    expect(() => loadConfig({ ...base, OLLAMA_BOX_UNITS: 'prosent' })).toThrow('OLLAMA_BOX_UNITS');
  });
});
