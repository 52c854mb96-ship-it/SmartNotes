import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import { beforeAll, describe, expect, it } from 'vitest';
import { loadConfig } from '../src/config.js';
import { renderReport, summarize, writeReport } from '../src/eval/report.js';
import { findNotes, parseModelSpec, runEval, similarity, slug, type EvalResults } from '../src/eval/run.js';

let input = '';

beforeAll(async () => {
  input = fs.mkdtempSync(path.join(os.tmpdir(), 'smartnotes-eval-'));
  const page = (text: string) =>
    sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="1600"><rect width="100%" height="100%" fill="#fff"/><text x="80" y="200" font-size="70">${text}</text></svg>`))
      .png()
      .toBuffer();
  fs.mkdirSync(path.join(input, 'Notat A'));
  fs.writeFileSync(path.join(input, 'Notat A', 'side 10.png'), await page('Side ti'));
  fs.writeFileSync(path.join(input, 'Notat A', 'side 2.png'), await page('Side to'));
  fs.writeFileSync(path.join(input, 'enkelt.png'), await page('Enkelt'));
  fs.writeFileSync(path.join(input, 'notater.txt'), 'ikke et bilde');
});

describe('måleverktøyet', () => {
  it('leser modellnavn med leverandør og valg', () => {
    expect(parseModelSpec('fake')).toEqual({ label: 'fake', provider: 'fake', model: 'fake-claude' });
    expect(parseModelSpec('anthropic:claude-haiku-5-5')).toEqual({ label: 'anthropic:claude-haiku-5-5', provider: 'anthropic', model: 'claude-haiku-5-5' });
    expect(parseModelSpec(' ollama:qwen3-vl:8b@thousandths ')).toEqual({
      label: 'ollama:qwen3-vl:8b@thousandths',
      provider: 'ollama',
      model: 'qwen3-vl:8b',
      boxUnits: 'thousandths',
    });
    expect(() => parseModelSpec('openai:gpt')).toThrow('Ukjent modell');
    expect(() => parseModelSpec('ollama:qwen@prosent')).toThrow('@pixels eller @thousandths');
    expect(() => parseModelSpec('ollama:')).toThrow('Mangler modellnavn');
  });

  it('måler likhet i ord', () => {
    expect(similarity('a b c d', 'a b c d')).toBe(1);
    expect(similarity('a b c d', 'a x c d')).toBe(0.75);
    expect(similarity('', '')).toBe(1);
    expect(similarity('a', '')).toBe(0);
    expect(slug('ollama:qwen3-vl:8b@thousandths')).toBe('ollama-qwen3-vl-8b-thousandths');
  });

  it('finner notatene: undermapper er notater, løse filer er egne notater', async () => {
    const notes = await findNotes(input);
    expect(notes.map((n) => [n.name, n.files.map((f) => path.basename(f))])).toEqual([
      ['enkelt', ['enkelt.png']],
      ['Notat A', ['side 2.png', 'side 10.png']],
    ]);
  });

  it('kjører alle modellene, tåler at én feiler, og lager rapport', async () => {
    const out = fs.mkdtempSync(path.join(os.tmpdir(), 'smartnotes-eval-ut-'));
    // Port 9 svarer ikke, så «Ollama» feiler med en gang.
    const config = loadConfig({ ...process.env, NODE_ENV: 'test', APP_PASSWORD: 'x', OLLAMA_URL: 'http://127.0.0.1:9', ANTHROPIC_API_KEY: '' });
    const lines: string[] = [];
    const results = await runEval({
      input,
      out,
      models: ['fake', 'ollama:finnes-ikke', 'anthropic:claude-haiku-5-5'].map(parseModelSpec),
      subject: 'physics',
      config,
      flashcards: true,
      log: (l) => lines.push(l),
      now: '2026-10-11T22:00:00.000Z',
    });

    expect(results.reference).toBe('fake');
    expect(results.notes).toHaveLength(2);
    const [single, multi] = results.notes;
    expect(multi!.pages).toHaveLength(2);
    const fake = single!.runs.find((r) => r.model === 'fake')!;
    expect(fake).toMatchObject({ ok: true, compiled: true, costNok: 0, similarity: null, figuresRequested: 1, figuresCropped: 1 });
    expect(fs.existsSync(path.join(out, fake.dir, 'main.pdf'))).toBe(true);
    expect(fake.cards?.ok).toBe(true);
    expect(fake.cards!.cards.length).toBeGreaterThanOrEqual(3);

    const local = single!.runs.find((r) => r.model === 'ollama:finnes-ikke')!;
    expect(local.ok).toBe(false);
    expect(local.error).toMatch(/Fikk ikke kontakt med den lokale AI-en/);
    expect(local.cards?.ok).toBe(false);
    const claude = single!.runs.find((r) => r.model === 'anthropic:claude-haiku-5-5')!;
    expect(claude).toMatchObject({ ok: false, error: 'ANTHROPIC_API_KEY er ikke satt.' });
    expect(lines.some((l) => l.includes('Hopper over anthropic:claude-haiku-5-5'))).toBe(true);
    expect(fs.existsSync(path.join(out, 'resultater.json'))).toBe(true);

    const s = summarize(results);
    expect(s.find((x) => x.model === 'fake')).toMatchObject({ notes: 2, ok: 2, compiled: 2, pages: 3, costNok: 0 });
    expect(s.find((x) => x.model === 'ollama:finnes-ikke')).toMatchObject({ notes: 2, ok: 0 });

    const file = await writeReport(out, results);
    const html = fs.readFileSync(file, 'utf8');
    expect(html).toContain('<title>Måling av modeller</title>');
    expect(html).toContain(`${fake.dir.split(path.sep).map(encodeURIComponent).join('/')}/main.pdf`);
    expect(html).toContain('Fikk ikke kontakt med den lokale AI-en');
    expect(html).toContain('Last ned karakterene (CSV)');
    expect(html).toContain('\\begin{merknad}');
  });

  it('rapporten escaper tekst fra modellene', () => {
    const results: EvalResults = {
      createdAt: '2026-10-11T22:00:00.000Z',
      subject: 'physics',
      models: ['fake'],
      reference: 'fake',
      usdNok: 10.5,
      notes: [
        {
          name: '<script>alert(1)</script>',
          pages: [],
          runs: [
            {
              model: 'fake',
              ok: true,
              error: null,
              dir: 'x/fake',
              compiled: false,
              fixRounds: 2,
              seconds: 3,
              aiSeconds: 2,
              inputTokens: 0,
              outputTokens: 0,
              costNok: 0,
              figuresRequested: 0,
              figuresCropped: 0,
              remarks: ['<b>fet</b>'],
              title: '"Tittel"',
              similarity: null,
            },
          ],
        },
      ],
    };
    const html = renderReport(results, new Map([['x/fake', '\\section*{<img src=x>}']]));
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).not.toContain('<b>fet</b>');
    expect(html).not.toContain('<img src=x>');
    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('Ingen PDF.');
  });
});
