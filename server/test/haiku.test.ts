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
import { HAIKU_CLOSING, HAIKU_PROMPT_VERSION } from '../src/profiles/haiku.js';
import { getProfile, PROFILE_IDS, readPreamble, systemPromptFor } from '../src/profiles/index.js';

/**
 * Fingeravtrykket av Haiku-instruksene for hver versjon. Endrer du tilleggene, avslutningen eller oppsettet i
 * sammenligningen (grundighet, svarlengde, rettingsrunder), øker du HAIKU_PROMPT_VERSION i profiles/haiku.ts og legger
 * inn det nye fingeravtrykket her. Da skilles elevens vurderinger av de gamle og de nye instruksene i Innstillinger.
 */
const FINGERPRINTS: Record<number, string> = {
  2: 'f914dfdf2266154d',
};

const fingerprint = () =>
  createHash('sha256')
    .update(PROFILE_IDS.map((id) => getProfile(id).haikuAddendum).join('\n---\n'))
    .update(`\n---\n${HAIKU_CLOSING}`)
    .update(`effort=${COMPARE_EFFORT};maxTokens=${COMPARE_MAX_TOKENS};fixAttempts=${COMPARE_FIX_ATTEMPTS}`)
    .digest('hex')
    .slice(0, 16);

describe('Haiku-instruksene', () => {
  it('legges bare til for Haiku; Sonnet og Opus får instruksen uendret', () => {
    for (const id of PROFILE_IDS) {
      const profile = getProfile(id);
      expect(systemPromptFor(profile, 'claude-sonnet-5-5')).toBe(profile.systemPrompt);
      expect(systemPromptFor(profile, 'claude-opus-5-5')).toBe(profile.systemPrompt);
      const haiku = systemPromptFor(profile, 'claude-haiku-5-5');
      expect(haiku.startsWith(profile.systemPrompt)).toBe(true);
      expect(haiku).toContain('# 7. Extra rules for this model');
      expect(haiku).toContain('\\begin{samlet}');
    }
    // TikZ-malene er for fysikk; biologi beholder utklipp som vanlig valg.
    expect(getProfile('physics').haikuAddendum).toContain('\\begin{circuitikz}');
    expect(getProfile('biology').haikuAddendum).not.toContain('tikzpicture');
  });

  it('har fått ny versjon når teksten er endret', () => {
    expect(
      FINGERPRINTS[HAIKU_PROMPT_VERSION],
      `Haiku-instruksene er endret. Øk HAIKU_PROMPT_VERSION og sett fingeravtrykket for den nye versjonen til ${fingerprint()}.`,
    ).toBe(fingerprint());
  });

  // Malene Haiku får, må kompilere med fagets PDF-mal, ellers lærer den feil syntaks.
  for (const id of PROFILE_IDS) {
    it(`har maler som kompilerer med PDF-malen for ${id}`, async () => {
      const addendum = getProfile(id).haikuAddendum;
      // Malene står på egne linjer; i reglene nevnes miljøene midt i en linje.
      const blocks = [...addendum.matchAll(/^\\begin\{(figure|formel|samlet|circuitikz)\}[\s\S]*?^\\end\{\1\}/gm)].map((m) => m[0]);
      expect(blocks.length).toBeGreaterThanOrEqual(id === 'physics' ? 8 : 3);
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

  it('sender Haiku-tillegget og den grundigere tenkningen til Haiku', async () => {
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

  it('sender instruksen uendret til Sonnet, med vanlig grundighet', async () => {
    const bodies = fakeStream(answer);
    await new AnthropicClaude(config(), 'claude-sonnet-5-5').convert(await request());
    const sent = bodies[0] as Sent;
    expect(sent.system[0]!.text).toBe(getProfile('physics').systemPrompt);
    expect(sent.output_config.effort).toBe('medium');
    expect(sent.max_tokens).toBe(64_000);
    expect(sent.messages[0]!.content.at(-1)!.text).toBe('Konverter notatet. Svar med <metadata> og <latex> som beskrevet.');
  });
});
