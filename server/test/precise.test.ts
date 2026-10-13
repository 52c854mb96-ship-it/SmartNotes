import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadConfig } from '../src/config.js';
import type { ConvertRequest } from '../src/pipeline/ai.js';
import { AnthropicClaude } from '../src/pipeline/claude.js';
import { COMPARE_EFFORT, COMPARE_FIX_ATTEMPTS, COMPARE_MAX_TOKENS } from '../src/pipeline/compare.js';
import { assembleNoteDoc, compileLatex, replaceMissingFigures, sanitizeBody } from '../src/pipeline/latex.js';
import { getProfile, PROFILE_IDS, readPreamble, systemPromptFor } from '../src/profiles/index.js';
import { CLOSING, HAIKU_CLOSING, PROMPT_VERSION } from '../src/profiles/precise.js';

/**
 * Fingeravtrykket av instruksene for hver versjon. Endrer du de presise reglene, avslutningene eller oppsettet i
 * sammenligningen (grundighet, svarlengde, rettingsrunder), øker du PROMPT_VERSION i profiles/precise.ts og legger inn
 * det nye fingeravtrykket her. Da skilles elevens vurderinger av de gamle og de nye instruksene i Innstillinger.
 */
const FINGERPRINTS: Record<number, string> = {
  2: '1cd64847f6a76608',
  3: 'c8f97971bcaecdbb',
};

const fingerprint = () =>
  createHash('sha256')
    .update(PROFILE_IDS.map((id) => getProfile(id).preciseRules).join('\n---\n'))
    .update(`\n---\n${HAIKU_CLOSING}`)
    .update(`\n---\n${CLOSING}`)
    .update(`effort=${COMPARE_EFFORT};maxTokens=${COMPARE_MAX_TOKENS};fixAttempts=${COMPARE_FIX_ATTEMPTS}`)
    .digest('hex')
    .slice(0, 16);

describe('de presise reglene', () => {
  it('legges til for alle Claude-modeller, men ikke for lokale modeller', () => {
    for (const id of PROFILE_IDS) {
      const profile = getProfile(id);
      for (const model of ['claude-sonnet-5-5', 'claude-opus-5-5', 'claude-haiku-5-5']) {
        const prompt = systemPromptFor(profile, model);
        expect(prompt).toBe(`${profile.systemPrompt}\n\n${profile.preciseRules}`);
        expect(prompt).toContain('# 7. Precise rules');
        expect(prompt).toContain('\\begin{samlet}');
      }
      // Ollama-modellene får grunninstruksen alene (OllamaAi bruker profile.systemPrompt direkte).
      expect(systemPromptFor(profile, 'qwen3.5:9b')).toBe(profile.systemPrompt);
      expect(profile.preciseRules).not.toMatch(/Extra rules|this model/);
    }
  });

  it('har maler for tegningene i hvert fag', () => {
    const physics = getProfile('physics').preciseRules;
    expect(physics).toContain('\\begin{circuitikz}');
    const chemistry = getProfile('chemistry').preciseRules;
    expect(chemistry).toContain('\\chemfig{');
    expect(chemistry).toMatch(/^\\\[ \\ce\{.*->.*\} /m);
    expect(chemistry).toContain('Reaksjonsforløp');
    const biology = getProfile('biology').preciseRules;
    expect(biology).toContain('\\begin{tabular}{c|cc}');
    expect(biology).toContain('tikzpicture');
    // Levende ting klippes fortsatt ut i biologi, og fysikkmalene står bare hos fysikk.
    expect(biology).toMatch(/Crop drawings of living things/);
    for (const other of [chemistry, biology]) expect(other).not.toContain('\\begin{circuitikz}');
  });

  // Reglene sier hvilke regler over de erstatter. Står ikke sitatet ordrett i grunninstruksen, peker de på ingenting.
  it('erstatter bare regler som finnes ordrett i grunninstruksen', () => {
    for (const id of PROFILE_IDS) {
      const { systemPrompt, preciseRules } = getProfile(id);
      const quoted = [...preciseRules.matchAll(/replaces "([^"]+)"/g)].map((m) => m[1]!);
      expect(quoted.length).toBeGreaterThanOrEqual(3);
      for (const q of quoted) expect(systemPrompt, `«${q}» finnes ikke i instruksen for ${id}`).toContain(q);
    }
  });

  it('bruker \\uleselig bare når sammenhengen ikke avgjør', () => {
    for (const id of PROFILE_IDS) {
      const rules = getProfile(id).preciseRules;
      expect(rules).toContain('## 7.4 Handwriting that is hard to read');
      expect(rules).toContain('If the context leaves one sensible reading, write it as ordinary text, with no marking');
      expect(rules).toContain('Use \\uleselig{...} only when two or more readings are still possible');
    }
    expect(HAIKU_CLOSING).toContain('bruk \\uleselig bare når to lesninger fortsatt er mulige');
  });

  it('har fått ny versjon når teksten er endret', () => {
    expect(
      FINGERPRINTS[PROMPT_VERSION],
      `Instruksene er endret. Øk PROMPT_VERSION og sett fingeravtrykket for den nye versjonen til ${fingerprint()}.`,
    ).toBe(fingerprint());
  });

  // Malene modellen får, må kompilere med fagets PDF-mal, ellers lærer den feil syntaks.
  for (const id of PROFILE_IDS) {
    it(`har maler som kompilerer med PDF-malen for ${id}`, async () => {
      const addendum = getProfile(id).preciseRules;
      // Malene står på egne linjer; i reglene nevnes miljøene midt i en linje.
      const blocks = [
        ...addendum.matchAll(/^\\begin\{(figure|formel|samlet|circuitikz|center)\}[\s\S]*?^\\end\{\1\}/gm),
        ...addendum.matchAll(/^\\\[ .* \\\]$/gm),
      ].map((m) => m[0]);
      expect(blocks.length).toBeGreaterThanOrEqual({ physics: 8, chemistry: 7, biology: 6 }[id]);
      // Eksempelsvaret i sin helhet, slik SmartNotes behandler et svar (figuren finnes ikke her).
      const example = /<latex>\n([\s\S]*?)<\/latex>/.exec(addendum)?.[1];
      expect(example).toBeTruthy();
      blocks.push(replaceMissingFigures(sanitizeBody(example!), new Set()));
      const doc = assembleNoteDoc({
        preamble: readPreamble(getProfile(id)),
        subjectName: 'Test',
        chapterLabel: 'Kapittel',
        sectionLabel: null,
        title: 'Maler',
        dateIso: null,
        figureDir: 'fig',
        body: blocks.join('\n\n'),
      });
      const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'smartnotes-haiku-'));
      const res = await compileLatex(dir, doc.tex, 120_000);
      expect(res.ok, res.ok ? '' : res.log.slice(-2000)).toBe(true);
    }, 150_000);
  }
});

describe('kallet til Claude', () => {
  /** Svarer som Messages API-et i strømmeform (SSE) og husker forespørslene. */
  function fakeStream(text: string) {
    const bodies: Record<string, unknown>[] = [];
    vi.stubGlobal('fetch', async (_url: string, init: RequestInit) => {
      const body = JSON.parse(String(init.body)) as Record<string, unknown>;
      bodies.push(body);
      const events: [string, unknown][] = [
        ['message_start', { type: 'message_start', message: { id: 'msg_test', type: 'message', role: 'assistant', model: body.model, content: [], stop_reason: null, stop_sequence: null, usage: { input_tokens: 100, output_tokens: 1 } } }],
        ['content_block_start', { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } }],
        ['content_block_delta', { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text } }],
        ['content_block_stop', { type: 'content_block_stop', index: 0 }],
        ['message_delta', { type: 'message_delta', delta: { stop_reason: 'end_turn', stop_sequence: null }, usage: { output_tokens: 20 } }],
        ['message_stop', { type: 'message_stop' }],
      ];
      const sse = events.map(([event, data]) => `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`).join('');
      return new Response(sse, { headers: { 'content-type': 'text/event-stream' } });
    });
    return bodies;
  }
  afterEach(() => vi.unstubAllGlobals());
  type Sent = {
    max_tokens: number;
    system: { text: string }[];
    output_config: { effort: string };
    messages: { content: { type: string; text?: string }[] }[];
  };

  const config = () =>
    loadConfig({ ...process.env, NODE_ENV: 'test', APP_PASSWORD: 'x', SMARTNOTES_FAKE_CLAUDE: '', ANTHROPIC_API_KEY: 'sk-test', CLAUDE_EFFORT: 'medium' });
  const answer = '<metadata>{"title":"Test","chapter":null,"section":null,"new_chapter":null,"date":null,"figures":[],"remarks":[]}</metadata><latex>Hei</latex>';

  async function request(): Promise<ConvertRequest> {
    const page = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'smartnotes-side-')), 'side.png');
    await sharp({ create: { width: 200, height: 300, channels: 3, background: '#fff' } }).png().toFile(page);
    return {
      profile: getProfile('physics'),
      subjectName: 'Fysikk 1',
      textbook: null,
      chapters: [],
      fixedChapter: null,
      userTitle: null,
      userDate: null,
      instructions: null,
      today: '2026-10-13',
      pages: [{ path: page, width: 200, height: 300 }],
    };
  }

  it('sender de presise reglene, avslutningen og den grundigere tenkningen til Haiku', async () => {
    const bodies = fakeStream(answer);
    const res = await new AnthropicClaude(config(), 'claude-haiku-5-5', { effort: COMPARE_EFFORT, maxTokens: COMPARE_MAX_TOKENS }).convert(await request());
    expect(res.body).toBe('Hei');
    const sent = bodies[0] as Sent;
    expect(sent.system[0]!.text).toBe(systemPromptFor(getProfile('physics'), 'claude-haiku-5-5'));
    expect(sent.output_config.effort).toBe('high');
    expect(sent.max_tokens).toBe(128_000);
    // Påminnelsen kommer sist, rett etter sidebildet.
    const content = sent.messages[0]!.content;
    expect(content.at(-2)!.type).toBe('image');
    expect(content.at(-1)!.text).toBe(HAIKU_CLOSING);
  });

  it('har metadata etter latex i Haiku-svaret', async () => {
    fakeStream('<latex>Hei</latex>\n<metadata>{"title":"Etterpå","figures":[],"remarks":["$\\Delta v$"]}</metadata>');
    const res = await new AnthropicClaude(config(), 'claude-haiku-5-5').convert(await request());
    expect(res.meta.title).toBe('Etterpå');
    expect(res.meta.remarks).toEqual(['$\\Delta v$']);
  });

  it('sender de presise reglene til Sonnet, med vanlig grundighet og vanlig avslutning', async () => {
    const bodies = fakeStream(answer);
    await new AnthropicClaude(config(), 'claude-sonnet-5-5').convert(await request());
    const sent = bodies[0] as Sent;
    const physics = getProfile('physics');
    expect(sent.system[0]!.text).toBe(`${physics.systemPrompt}\n\n${physics.preciseRules}`);
    expect(sent.output_config.effort).toBe('medium');
    expect(sent.max_tokens).toBe(64_000);
    expect(sent.messages[0]!.content.at(-1)!.text).toBe(CLOSING);
  });

  it('sender de presise reglene også når Sonnet retter LaTeX-koden', async () => {
    const bodies = fakeStream('<latex>Rettet</latex>');
    const res = await new AnthropicClaude(config(), 'claude-sonnet-5-5').fix({ profile: getProfile('chemistry'), body: 'Feil', errorReport: 'Undefined control sequence' });
    expect(res.body).toBe('Rettet');
    const sent = bodies[0] as Sent;
    expect(sent.system[0]!.text).toBe(systemPromptFor(getProfile('chemistry'), 'claude-sonnet-5-5'));
    expect(sent.system[0]!.text).toContain('# 7. Precise rules');
  });
});
