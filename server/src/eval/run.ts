/**
 * Måleverktøy: kjører de samme notatsidene gjennom flere modeller (Claude, lokale modeller via Ollama) og samler
 * resultatene side ved side, så eleven kan se hvor gode og raske de er, og hva de koster, på egne notater.
 *
 * For hvert notat og hver modell: konvertering, utklipp av figurer, kompilering med automatisk retting (samme modell),
 * og målinger av tid, tokens, kostnad og likhet med referansemodellen. Valgfritt også kortstokker, laget fra
 * referansens LaTeX så alle modellene får samme utgangspunkt.
 */
import fsp from 'node:fs/promises';
import path from 'node:path';
import type { SubjectProfile } from '@smartnotes/shared';
import type { Config, OllamaConfig } from '../config.js';
import { cleanFlashcards, noteSourceText, type RawFlashcard } from '../flashcards/prompt.js';
import type { AiService, ChapterRef } from '../pipeline/ai.js';
import { AnthropicClaude, FakeClaude } from '../pipeline/claude.js';
import { cropFigure, preparePages, sniffKind, type PageImage } from '../pipeline/images.js';
import { assembleNoteDoc, compileLatex, errorExcerpt, latexToText, replaceMissingFigures, sanitizeBody } from '../pipeline/latex.js';
import { OllamaAi } from '../pipeline/ollama.js';
import { getProfile, readPreamble } from '../profiles/index.js';
import { costUsd, type Usage } from '../usage.js';

export interface ModelSpec {
  /** Slik modellen ble oppgitt, f.eks. «ollama:qwen3-vl:8b@thousandths». */
  label: string;
  provider: 'anthropic' | 'ollama' | 'fake';
  model: string;
  boxUnits?: OllamaConfig['boxUnits'];
}

/**
 * «anthropic:claude-haiku-5-5», «ollama:qwen2.5vl:7b», «ollama:qwen3-vl:8b@thousandths» eller «fake».
 * Modellnavn kan inneholde kolon; leverandøren er det som står før det første.
 */
export function parseModelSpec(raw: string): ModelSpec {
  const label = raw.trim();
  if (label === 'fake') return { label, provider: 'fake', model: 'fake-claude' };
  const i = label.indexOf(':');
  const provider = i === -1 ? '' : label.slice(0, i);
  let model = i === -1 ? '' : label.slice(i + 1);
  if (provider !== 'anthropic' && provider !== 'ollama') {
    throw new Error(`Ukjent modell «${label}». Skriv for eksempel anthropic:claude-haiku-5-5 eller ollama:qwen2.5vl:7b.`);
  }
  let boxUnits: OllamaConfig['boxUnits'] | undefined;
  const at = model.lastIndexOf('@');
  if (at !== -1) {
    const opt = model.slice(at + 1);
    if (opt !== 'pixels' && opt !== 'thousandths') throw new Error(`Ukjent valg «@${opt}» i «${label}». Bruk @pixels eller @thousandths.`);
    boxUnits = opt;
    model = model.slice(0, at);
  }
  if (!model) throw new Error(`Mangler modellnavn i «${label}».`);
  return { label, provider, model, ...(boxUnits ? { boxUnits } : {}) };
}

/** AI-tjenesten for en modell, eller en forklaring på hvorfor den ikke kan brukes. */
export function serviceFor(spec: ModelSpec, config: Config): AiService | string {
  if (spec.provider === 'fake') return new FakeClaude(0);
  if (spec.provider === 'anthropic') {
    if (!config.anthropicApiKey) return 'ANTHROPIC_API_KEY er ikke satt.';
    return new AnthropicClaude({ ...config, model: spec.model });
  }
  return new OllamaAi({ ...config.ollama, model: spec.model, textModel: spec.model, boxUnits: spec.boxUnits ?? config.ollama.boxUnits });
}

/** Mappenavn for en modell, f.eks. «ollama-qwen3-vl-8b». */
export function slug(text: string): string {
  return (
    text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'x'
  );
}

/**
 * Hvor like to tekster er, fra 0 til 1: 1 − redigeringsavstand / lengste lengde, regnet i ord. Grovt mål på hvor mye
 * en modell har lest likt som referansen (ikke om noen av dem har rett).
 */
export function similarity(a: string, b: string): number {
  const words = (t: string) => t.toLowerCase().split(/\s+/).filter(Boolean);
  const x = words(a);
  const y = words(b);
  if (x.length === 0 && y.length === 0) return 1;
  if (x.length === 0 || y.length === 0) return 0;
  let prev = new Uint32Array(y.length + 1);
  let cur = new Uint32Array(y.length + 1);
  for (let j = 0; j <= y.length; j++) prev[j] = j;
  for (let i = 1; i <= x.length; i++) {
    cur[0] = i;
    for (let j = 1; j <= y.length; j++) {
      cur[j] = x[i - 1] === y[j - 1] ? prev[j - 1]! : 1 + Math.min(prev[j - 1]!, prev[j]!, cur[j - 1]!);
    }
    [prev, cur] = [cur, prev];
  }
  return 1 - prev[y.length]! / Math.max(x.length, y.length);
}

export interface EvalNote {
  name: string;
  files: string[];
}

/**
 * Notatene i mappen: hver undermappe er ett notat (filene i alfabetisk rekkefølge), og hver løse fil er et notat på
 * én side (eller en PDF med flere sider). Andre filtyper hoppes over.
 */
export async function findNotes(dir: string): Promise<EvalNote[]> {
  const entries = (await fsp.readdir(dir, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name, 'nb'));
  const notes: EvalNote[] = [];
  const isNoteFile = async (file: string) => {
    const fh = await fsp.open(file, 'r');
    try {
      const head = Buffer.alloc(16);
      await fh.read(head, 0, 16, 0);
      return sniffKind(head) !== null;
    } finally {
      await fh.close();
    }
  };
  for (const e of entries) {
    if (e.name.startsWith('.')) continue;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      const files = (await fsp.readdir(full)).filter((f) => !f.startsWith('.')).sort((a, b) => a.localeCompare(b, 'nb', { numeric: true }));
      const ok: string[] = [];
      for (const f of files) if (await isNoteFile(path.join(full, f))) ok.push(path.join(full, f));
      if (ok.length) notes.push({ name: e.name, files: ok });
    } else if (e.isFile() && (await isNoteFile(full))) {
      notes.push({ name: e.name.replace(/\.[^.]+$/, ''), files: [full] });
    }
  }
  return notes;
}

export interface ModelRun {
  model: string;
  ok: boolean;
  error: string | null;
  /** Mappe med resultatet, relativt til utmappen. */
  dir: string;
  compiled: boolean;
  fixRounds: number;
  seconds: number;
  aiSeconds: number;
  inputTokens: number;
  outputTokens: number;
  /** Beregnet etter listepris, `null` når prisen er ukjent. */
  costNok: number | null;
  figuresRequested: number;
  figuresCropped: number;
  remarks: string[];
  title: string | null;
  /** Likhet med referansemodellens tekst (0–1), eller null for referansen selv og når en av dem feilet. */
  similarity: number | null;
  cards?: { ok: boolean; error: string | null; seconds: number; costNok: number | null; cards: RawFlashcard[] };
}

export interface EvalNoteResult {
  name: string;
  pages: { file: string; width: number; height: number }[];
  runs: ModelRun[];
}

export interface EvalResults {
  createdAt: string;
  subject: SubjectProfile;
  models: string[];
  reference: string | null;
  usdNok: number;
  notes: EvalNoteResult[];
}

export interface EvalOptions {
  input: string;
  out: string;
  models: ModelSpec[];
  subject: SubjectProfile;
  config: Config;
  /** Modellen de andre sammenlignes med (standard: den første). */
  reference?: string;
  /** Lag også kortstokker fra referansens LaTeX. */
  flashcards?: boolean;
  /** Kapitler modellen kan velge mellom, f.eks. «1 Bevegelse;2 Krefter». Uten dem er kapittelet fast. */
  chapters?: string | null;
  log?: (line: string) => void;
  /** Tidspunktet som står i rapporten (ISO). */
  now?: string;
}

/** Feilmeldingen uten «Prøver igjen om litt.», som gjelder køen i appen, ikke målingen. */
const errorText = (err: unknown) => (err instanceof Error ? err.message : String(err)).replace(/\s*Prøver igjen om litt\.$/, '');

const round = (n: number, digits = 2) => Math.round(n * 10 ** digits) / 10 ** digits;

export async function runEval(opts: EvalOptions): Promise<EvalResults> {
  const log = opts.log ?? (() => {});
  const { config } = opts;
  const profile = getProfile(opts.subject);
  const preamble = readPreamble(profile);
  const notes = await findNotes(opts.input);
  if (notes.length === 0) throw new Error(`Fant ingen bilder eller PDF-er i ${opts.input}.`);
  const reference = opts.reference ?? opts.models[0]?.label ?? null;
  const services = new Map(opts.models.map((m) => [m.label, serviceFor(m, config)]));
  for (const [label, s] of services) if (typeof s === 'string') log(`Hopper over ${label}: ${s}`);

  const chapters = (opts.chapters ?? '')
    .split(';')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s, i): ChapterRef => {
      const m = /^(\S+)\s+(.+)$/.exec(s);
      return { alias: `k${i + 1}`, number: m ? m[1]! : null, title: m ? m[2]! : s, sections: [] };
    });

  await fsp.mkdir(opts.out, { recursive: true });
  const results: EvalNoteResult[] = [];
  for (const [n, note] of notes.entries()) {
    const noteDir = path.join(opts.out, slug(note.name));
    const sources = [];
    for (const file of note.files) {
      const fh = await fsp.readFile(file);
      sources.push({ file, kind: sniffKind(fh.subarray(0, 16))! });
    }
    const pages = await preparePages(sources, path.join(noteDir, 'sider'), config.maxPagesPerNote);
    log(`Notat ${n + 1}/${notes.length}: ${note.name} (${pages.length} ${pages.length === 1 ? 'side' : 'sider'})`);
    const runs: ModelRun[] = [];
    for (const spec of opts.models) {
      const service = services.get(spec.label)!;
      const run = await runModel(spec, service, pages, path.join(noteDir, 'sider'), path.join(noteDir, slug(spec.label)), {
        profile,
        preamble,
        chapters,
        config,
        noteName: note.name,
      });
      run.dir = path.relative(opts.out, path.join(noteDir, slug(spec.label)));
      log(
        `  ${spec.label}: ${run.ok ? (run.compiled ? 'PDF ok' : 'kompilerte ikke') : `feil – ${run.error}`} · ${run.seconds} s` +
          (run.costNok ? ` · ${run.costNok.toFixed(2)} kr` : ''),
      );
      runs.push(run);
    }
    // Likhet med referansen, og kortstokker fra referansens tekst.
    const ref = runs.find((r) => r.model === reference && r.ok);
    const refBody = ref ? await fsp.readFile(path.join(opts.out, ref.dir, 'body.tex'), 'utf8').catch(() => null) : null;
    for (const r of runs) {
      if (!ref || !refBody || r === ref || !r.ok) continue;
      const body = await fsp.readFile(path.join(opts.out, r.dir, 'body.tex'), 'utf8').catch(() => null);
      if (body !== null) r.similarity = round(similarity(latexToText(body), latexToText(refBody)), 3);
    }
    if (opts.flashcards && refBody) {
      for (const r of runs) {
        const service = services.get(r.model);
        if (typeof service !== 'object') continue;
        r.cards = await makeCards(service, note.name, refBody, profile.label, config.usdNok);
        log(`  ${r.model}: ${r.cards.ok ? `${r.cards.cards.length} kort` : `kort feilet – ${r.cards.error}`} · ${r.cards.seconds} s`);
      }
    }
    results.push({ name: note.name, pages: pages.map((p) => ({ file: path.relative(opts.out, path.join(noteDir, 'sider', p.file)), width: p.width, height: p.height })), runs });
  }

  const out: EvalResults = {
    createdAt: opts.now ?? new Date().toISOString(),
    subject: opts.subject,
    models: opts.models.map((m) => m.label),
    reference,
    usdNok: config.usdNok,
    notes: results,
  };
  await fsp.writeFile(path.join(opts.out, 'resultater.json'), JSON.stringify(out, null, 2));
  return out;
}

async function runModel(
  spec: ModelSpec,
  service: AiService | string,
  pages: PageImage[],
  pagesDir: string,
  dir: string,
  ctx: { profile: ReturnType<typeof getProfile>; preamble: string; chapters: ChapterRef[]; config: Config; noteName: string },
): Promise<ModelRun> {
  const run: ModelRun = {
    model: spec.label,
    ok: false,
    error: null,
    dir: '',
    compiled: false,
    fixRounds: 0,
    seconds: 0,
    aiSeconds: 0,
    inputTokens: 0,
    outputTokens: 0,
    costNok: 0,
    figuresRequested: 0,
    figuresCropped: 0,
    remarks: [],
    title: null,
    similarity: null,
  };
  if (typeof service === 'string') {
    run.error = service;
    return run;
  }
  const started = Date.now();
  const usages: { provider: string; usage: Usage }[] = [];
  const timed = async <T extends { usage: Usage }>(fn: () => Promise<T>): Promise<T> => {
    const t = Date.now();
    try {
      const res = await fn();
      usages.push({ provider: service.provider, usage: res.usage });
      return res;
    } finally {
      run.aiSeconds += (Date.now() - t) / 1000;
    }
  };
  try {
    await fsp.mkdir(path.join(dir, 'fig'), { recursive: true });
    const result = await timed(() =>
      service.convert({
        profile: ctx.profile,
        subjectName: ctx.profile.label,
        textbook: null,
        chapters: ctx.chapters,
        fixedChapter: ctx.chapters.length ? null : { number: null, title: 'Uten kapittel', sections: [] },
        userTitle: null,
        userDate: null,
        instructions: null,
        today: new Date().toISOString().slice(0, 10),
        pages: pages.map((p) => ({ path: path.join(pagesDir, p.file), width: p.width, height: p.height })),
      }),
    );
    run.title = result.meta.title;
    run.remarks = result.meta.remarks;
    run.figuresRequested = result.meta.figures.length;
    const figures = new Set<string>();
    for (const f of result.meta.figures) {
      const page = pages[f.page - 1];
      if (page && (await cropFigure(path.join(pagesDir, page.file), page, f.box, path.join(dir, 'fig', `${f.id}.png`)))) figures.add(f.id);
    }
    run.figuresCropped = figures.size;
    await fsp.writeFile(path.join(dir, 'meta.json'), JSON.stringify(result.meta, null, 2));

    let body = replaceMissingFigures(sanitizeBody(result.body), figures);
    for (let attempt = 0; ; attempt++) {
      await fsp.writeFile(path.join(dir, 'body.tex'), body);
      const doc = assembleNoteDoc({
        preamble: ctx.preamble,
        subjectName: ctx.profile.label,
        chapterLabel: ctx.chapters.find((c) => c.alias === result.meta.chapter)?.title ?? ctx.noteName,
        title: result.meta.title ?? ctx.noteName,
        dateIso: result.meta.date,
        figureDir: 'fig',
        body,
      });
      const res = await compileLatex(dir, doc.tex, ctx.config.latexTimeoutMs);
      if (res.ok) {
        run.compiled = true;
        break;
      }
      if (attempt >= ctx.config.maxFixAttempts) break;
      run.fixRounds += 1;
      const fixed = await timed(() => service.fix({ profile: ctx.profile, body, errorReport: errorExcerpt(body, res.errors, doc.bodyStartLine) }));
      body = replaceMissingFigures(sanitizeBody(fixed.body), figures);
    }
    run.ok = true;
  } catch (err) {
    run.error = errorText(err);
  }
  run.seconds = round((Date.now() - started) / 1000, 1);
  run.aiSeconds = round(run.aiSeconds, 1);
  run.inputTokens = usages.reduce((s, u) => s + u.usage.inputTokens + u.usage.cacheReadTokens + u.usage.cacheWriteTokens, 0);
  run.outputTokens = usages.reduce((s, u) => s + u.usage.outputTokens, 0);
  const costs = usages.map((u) => costUsd(u.provider, u.usage));
  run.costNok = costs.some((c) => c === null) ? null : round(costs.reduce((s: number, c) => s + (c ?? 0), 0) * ctx.config.usdNok, 3);
  return run;
}

async function makeCards(service: AiService, noteName: string, body: string, subjectLabel: string, usdNok: number): Promise<NonNullable<ModelRun['cards']>> {
  const t = Date.now();
  try {
    const { cards, usage } = await service.generateFlashcards({
      subjectName: subjectLabel,
      subjectLabel,
      difficulty: 'medium',
      count: null,
      notes: [{ alias: 'n1', title: noteName, chapter: null, section: null, date: null, body: noteSourceText(body) }],
    });
    const clean = cleanFlashcards(cards, new Map([['n1', 'n1']]));
    const cost = costUsd(service.provider, usage);
    return {
      ok: true,
      error: null,
      seconds: round((Date.now() - t) / 1000, 1),
      costNok: cost === null ? null : round(cost * usdNok, 3),
      cards: clean.map((c) => ({ note: 'n1', kind: c.kind, front: c.front, back: c.back, detail: c.detail })),
    };
  } catch (err) {
    return { ok: false, error: errorText(err), seconds: round((Date.now() - t) / 1000, 1), costNok: null, cards: [] };
  }
}
