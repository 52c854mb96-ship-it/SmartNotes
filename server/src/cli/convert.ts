/**
 * Konverter notatbilder/PDF-er direkte fra kommandolinjen – nyttig for å teste og justere
 * instruksene til Claude på ekte notater uten å gå via appen.
 *
 *   ANTHROPIC_API_KEY=... npx tsx server/src/cli/convert.ts side1.jpg side2.jpg [--out mappe] [--chapters "1 Måling;2 Bevegelse"]
 *
 * Skriver sidebilder, figurer, body.tex, main.tex, main.pdf og meta.json til utmappen.
 */
import fsp from 'node:fs/promises';
import path from 'node:path';
import { loadConfig } from '../config.js';
import { createClaude } from '../pipeline/claude.js';
import { cropFigure, preparePages, sniffKind } from '../pipeline/images.js';
import { assembleNoteDoc, compileLatex, errorExcerpt, formatErrors, replaceMissingFigures, sanitizeBody } from '../pipeline/latex.js';
import { physicsProfile } from '../profiles/physics.js';
import { readPreamble } from '../profiles/index.js';

const args = process.argv.slice(2);
const flag = (name: string) => {
  const i = args.indexOf(name);
  if (i === -1) return null;
  const v = args[i + 1] ?? null;
  args.splice(i, 2);
  return v;
};
const out = path.resolve(flag('--out') ?? `smartnotes-test-${Date.now()}`);
const chapterArg = flag('--chapters');
const instructions = flag('--instructions');
if (args.length === 0) {
  console.error('Bruk: convert.ts <bilde/pdf>... [--out mappe] [--chapters "1 Tittel;2 Tittel"] [--instructions "..."]');
  process.exit(1);
}

const config = loadConfig({ ...process.env, APP_PASSWORD: process.env.APP_PASSWORD ?? 'cli' });
const claude = createClaude(config);
await fsp.mkdir(out, { recursive: true });

const sources = [];
for (const file of args) {
  const head = (await fsp.readFile(file)).subarray(0, 16);
  const kind = sniffKind(head);
  if (!kind) throw new Error(`Ukjent filtype: ${file}`);
  sources.push({ file: path.resolve(file), kind });
}
const pages = await preparePages(sources, path.join(out, 'pages'), config.maxPagesPerNote);
console.log(`${pages.length} sider klargjort. Spør ${claude.model} …`);

const chapters = (chapterArg ?? '')
  .split(';')
  .map((s) => s.trim())
  .filter(Boolean)
  .map((s, i) => {
    const m = /^(\S+)\s+(.+)$/.exec(s);
    return { alias: `k${i + 1}`, number: m ? m[1]! : null, title: m ? m[2]! : s, sections: [] };
  });

const t0 = Date.now();
const result = await claude.convert({
  profile: physicsProfile,
  subjectName: 'Fysikk',
  textbook: null,
  chapters,
  fixedChapter: null,
  userTitle: null,
  userDate: null,
  instructions,
  today: new Date().toISOString().slice(0, 10),
  pages: pages.map((p) => ({ path: path.join(out, 'pages', p.file), width: p.width, height: p.height })),
});
console.log(`Svar etter ${((Date.now() - t0) / 1000).toFixed(1)} s`, result.usage);
console.log('Metadata:', JSON.stringify(result.meta, null, 2));

const figDir = path.join(out, 'fig');
await fsp.mkdir(figDir, { recursive: true });
const figures = new Set<string>();
for (const f of result.meta.figures) {
  const page = pages[f.page - 1];
  if (page && (await cropFigure(path.join(out, 'pages', page.file), page, f.box, path.join(figDir, `${f.id}.png`)))) figures.add(f.id);
}

let body = replaceMissingFigures(sanitizeBody(result.body), figures);
for (let attempt = 0; ; attempt++) {
  await fsp.writeFile(path.join(out, 'body.tex'), body);
  const doc = assembleNoteDoc({
    preamble: readPreamble(physicsProfile),
    subjectName: 'Fysikk',
    chapterLabel: chapters.find((c) => c.alias === result.meta.chapter)?.title ?? 'Uten kapittel',
    title: result.meta.title ?? 'Notat',
    dateIso: result.meta.date,
    figureDir: 'fig',
    body,
  });
  const res = await compileLatex(out, doc.tex, config.latexTimeoutMs);
  if (res.ok) {
    console.log(`PDF: ${path.join(out, 'main.pdf')}`);
    break;
  }
  console.log(`LaTeX-feil (forsøk ${attempt + 1}):\n${formatErrors(res.errors, doc.bodyStartLine)}`);
  if (attempt >= config.maxFixAttempts) process.exit(2);
  const fixed = await claude.fix({ profile: physicsProfile, body, errorReport: errorExcerpt(body, res.errors, doc.bodyStartLine) });
  console.log('Rettet av Claude', fixed.usage);
  body = replaceMissingFigures(sanitizeBody(fixed.body), figures);
}
await fsp.writeFile(path.join(out, 'meta.json'), JSON.stringify(result.meta, null, 2));
