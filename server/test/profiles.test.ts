import fs from 'node:fs';
import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { FakeClaude } from '../src/pipeline/claude.js';
import { assembleNoteDoc, compileLatex, sanitizeBody } from '../src/pipeline/latex.js';
import { PROFILE_IDS, getProfile, readPreamble } from '../src/profiles/index.js';

/** Delen av instruksen som må være lik i alle fag (svarformatet leses av parse.ts). */
function outputFormat(prompt: string): string {
  return prompt
    .slice(prompt.indexOf('# 6. Output format'))
    .replace(/"title": "[^"]*"\}/, '')
    .replace(/the code \(for example [^)]*\)/, '');
}

describe('fagprofiler', () => {
  it('har stabil instruks med samme svarformat i alle fag', () => {
    const physics = outputFormat(getProfile('physics').systemPrompt);
    for (const id of PROFILE_IDS) {
      const p = getProfile(id);
      expect(p.id).toBe(id);
      expect(p.systemPrompt).not.toMatch(/\$\{|\d{4}-\d{2}-\d{2}/); // ingen innsatte verdier eller datoer (prompt-caching)
      expect(outputFormat(p.systemPrompt)).toBe(physics);
      expect(fs.existsSync(p.preamblePath)).toBe(true);
    }
  });

  it.each(PROFILE_IDS)('%s: et notat fra falsk Claude kompilerer med fagets LaTeX-mal', async (id) => {
    const profile = getProfile(id);
    const page = { path: '', width: 1200, height: 1600 };
    const res = await new FakeClaude(0).convert({
      profile,
      subjectName: 'Fag',
      textbook: null,
      chapters: [],
      fixedChapter: null,
      userTitle: 'Testnotat',
      userDate: null,
      instructions: null,
      today: '2026-10-04',
      pages: [page],
    });
    const work = await fsp.mkdtemp(path.join(os.tmpdir(), `smartnotes-${id}-`));
    try {
      await fsp.mkdir(path.join(work, 'fig'), { recursive: true });
      await sharp({ create: { width: 40, height: 30, channels: 3, background: '#ddd' } })
        .png()
        .toFile(path.join(work, 'fig', 'fig1.png'));
      const doc = assembleNoteDoc({
        preamble: readPreamble(profile),
        subjectName: profile.label,
        chapterLabel: 'Kapittel 1',
        sectionLabel: null,
        title: res.meta.title ?? 'Testnotat',
        dateIso: '2026-10-04',
        figureDir: 'fig',
        body: sanitizeBody(res.body),
      });
      const out = await compileLatex(work, doc.tex, 120_000);
      expect(out.ok, out.ok ? '' : JSON.stringify(out.errors).slice(0, 800)).toBe(true);
    } finally {
      await fsp.rm(work, { recursive: true, force: true });
    }
  }, 180_000);
});
