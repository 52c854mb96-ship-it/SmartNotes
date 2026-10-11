/**
 * Måleverktøy: sammenlign modeller på dine egne notater. Se docs/MALING.md.
 *
 *   npm run eval --workspace server -- <mappe med notater> --models "anthropic:claude-sonnet-5-5,ollama:qwen2.5vl:7b"
 *     [--subject physics|chemistry|biology] [--out mappe] [--reference modell] [--flashcards] [--chapters "1 Tittel;2 Tittel"]
 *
 * Hver undermappe i notatmappen er ett notat (sidene i alfabetisk rekkefølge), og hver løse fil er et eget notat.
 * Skriver resultater.json og rapport.html til utmappen.
 */
import path from 'node:path';
import type { SubjectProfile } from '@smartnotes/shared';
import { loadConfig } from '../config.js';
import { writeReport } from '../eval/report.js';
import { parseModelSpec, runEval } from '../eval/run.js';

const SUBJECTS: Record<string, SubjectProfile> = {
  physics: 'physics',
  fysikk: 'physics',
  chemistry: 'chemistry',
  kjemi: 'chemistry',
  biology: 'biology',
  biologi: 'biology',
};

const USAGE = `Bruk: npm run eval --workspace server -- <mappe med notater> --models "anthropic:claude-sonnet-5-5,ollama:qwen2.5vl:7b"
  --models       kommaliste med modeller: anthropic:<modell>, ollama:<modell> (valgfritt @pixels eller @thousandths), eller fake
  --subject      physics (standard), chemistry eller biology
  --out          mappe for resultatene (standard: maling-<dato> der du står)
  --reference    modellen de andre sammenlignes med (standard: den første)
  --flashcards   lag også kortstokker fra referansens LaTeX
  --chapters     kapitler modellen kan velge mellom, f.eks. "1 Bevegelse;2 Krefter"`;

const args = process.argv.slice(2);
const take = (name: string): string | null => {
  const i = args.indexOf(name);
  if (i === -1) return null;
  const v = args[i + 1] ?? null;
  args.splice(i, 2);
  return v;
};
const has = (name: string): boolean => {
  const i = args.indexOf(name);
  if (i !== -1) args.splice(i, 1);
  return i !== -1;
};

const modelsArg = take('--models');
const subjectArg = (take('--subject') ?? 'physics').toLowerCase();
const outArg = take('--out');
const reference = take('--reference');
const chapters = take('--chapters');
const flashcards = has('--flashcards');
if (args.includes('--help') || args.includes('-h') || args.length !== 1 || !modelsArg) {
  console.error(USAGE);
  process.exit(args.includes('--help') || args.includes('-h') ? 0 : 1);
}
const subject = SUBJECTS[subjectArg];
if (!subject) {
  console.error(`Ukjent fag «${subjectArg}». Bruk physics, chemistry eller biology.`);
  process.exit(1);
}

// npm kjører skriptet i server/; stier tolkes fra mappen du sto i (INIT_CWD).
const here = process.env.INIT_CWD ?? process.cwd();
const stamp = new Date().toISOString().slice(0, 16).replace(/[-:]/g, '').replace('T', '-');
const input = path.resolve(here, args[0]!);
const out = path.resolve(here, outArg ?? `maling-${stamp}`);

try {
  const models = modelsArg.split(',').map(parseModelSpec);
  if (reference && !models.some((m) => m.label === reference)) throw new Error(`Referansen «${reference}» er ikke med i --models.`);
  const config = loadConfig({ ...process.env, APP_PASSWORD: process.env.APP_PASSWORD ?? 'eval' });
  console.log(`Måler ${models.length} ${models.length === 1 ? 'modell' : 'modeller'} på notatene i ${input}`);
  const results = await runEval({
    input,
    out,
    models,
    subject,
    config,
    reference: reference ?? undefined,
    flashcards,
    chapters,
    log: (line) => console.log(line),
  });
  const report = await writeReport(out, results);
  console.log(`\nFerdig. Åpne rapporten i nettleseren:\n${report}`);
} catch (err) {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
}
