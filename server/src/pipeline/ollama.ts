/**
 * Lokal AI via Ollama (https://ollama.com), for eksempel på elevens egen PC eller Mac. Bruker Ollamas eget API
 * (`POST /api/chat`) med bilder som base64 og JSON-skjema for strukturerte svar. Kostnaden er 0 i forbruksloggen
 * (strømmen regnes ikke med).
 *
 * Konverteringen bruker samme instrukser og svarformat (<metadata> og <latex>) som Claude. Sidebildene skaleres ned
 * (`imageMaxEdge`) før de sendes, og figurboksene modellen oppgir, regnes tilbake til pikslene i sidebildet.
 */
import fsp from 'node:fs/promises';
import sharp from 'sharp';
import { z } from 'zod';
import type { ChapterInput, CompetenceAim, UsageKind } from '@smartnotes/shared';
import type { OllamaConfig } from '../config.js';
import { ConversionError } from '../errors.js';
import { FLASHCARD_SYSTEM_PROMPT, buildFlashcardPrompt, flashcardSchema, type FlashcardRequest, type RawFlashcard } from '../flashcards/prompt.js';
import type { Profile } from '../profiles/index.js';
import { withUsage, zeroUsage, type Usage } from '../usage.js';
import { TOC_AIMS_PROMPT, buildContext, tocSchema, type AiService, type ConvertRequest, type ConvertResult, type FixRequest } from './ai.js';
import type { FigureBox } from './images.js';
import { extractLatex, parseConversion } from './parse.js';

interface OllamaChatResponse {
  model?: string;
  message?: { role: string; content: string; thinking?: string };
  done_reason?: string;
  prompt_eval_count?: number;
  eval_count?: number;
}

interface ChatResult {
  content: string;
  doneReason: string | null;
  usage: Usage;
}

/** Størrelsen på et bilde som er sendt til modellen, og på sidebildet det er laget fra. */
interface SentPage {
  sent: { width: number; height: number };
  page: { width: number; height: number };
}

const aimsSchema = z.object({ sections: z.array(z.object({ code: z.string(), aims: z.array(z.string()) })) });

/** Teksten modellen svarte med, uten eventuell tenkning i <think>…</think> (noen modeller skriver den i svaret). */
export function stripThinking(text: string): string {
  return text.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
}

/** Meldingene fra parse.ts nevner Claude; her er det den lokale modellen som har svart. */
function localMessage(err: unknown): unknown {
  if (err instanceof ConversionError && /^Claude\b|fra Claude/.test(err.message)) {
    const e = new ConversionError(err.message.replace(/^Claude\b/, 'Den lokale AI-en').replace('fra Claude', 'fra den lokale AI-en'), err.retryable);
    e.usage = err.usage;
    return e;
  }
  return err;
}

/**
 * Figurboksene fra modellen, regnet om til piksler i sidebildene. Boksene kan være oppgitt i piksler i bildet modellen
 * fikk (`pixels`), eller i tusendeler av bredde og høyde (`thousandths`, slik Qwen3-VL gjør). Ugyldige bokser fjernes.
 */
export function scaleFigures(figures: FigureBox[], pages: SentPage[], units: OllamaConfig['boxUnits']): FigureBox[] {
  const out: FigureBox[] = [];
  for (const f of figures) {
    const p = pages[f.page - 1];
    if (!p) continue;
    // Noen modeller svarer med andeler (0–1) uansett hva de blir bedt om.
    const fractions = Math.max(...f.box) <= 1;
    const thousandths = units !== 'pixels';
    const sx = fractions ? p.page.width : thousandths ? p.page.width / 1000 : p.page.width / p.sent.width;
    const sy = fractions ? p.page.height : thousandths ? p.page.height / 1000 : p.page.height / p.sent.height;
    const [x0, y0, x1, y1] = units === 'thousandths-yx' ? [f.box[1], f.box[0], f.box[3], f.box[2]] : f.box;
    const box: FigureBox['box'] = [
      Math.round(Math.min(x0, x1) * sx),
      Math.round(Math.min(y0, y1) * sy),
      Math.round(Math.max(x0, x1) * sx),
      Math.round(Math.max(y0, y1) * sy),
    ];
    if (box[2] - box[0] < 2 || box[3] - box[1] < 2) continue;
    out.push({ ...f, box });
  }
  return out;
}

export class OllamaAi implements AiService {
  readonly fake = false;
  readonly configured = true;
  readonly provider = 'ollama';

  constructor(
    private readonly cfg: OllamaConfig,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  get model(): string {
    return this.cfg.model;
  }

  /**
   * Konverterer notatet, `pagesPerCall` sider om gangen (standard én), og setter delene sammen: teksten etter hverandre,
   * metadata fra den første delen som har den, figurene nummerert fortløpende og merknadene samlet.
   */
  async convert(req: ConvertRequest): Promise<ConvertResult> {
    const per = this.cfg.pagesPerCall > 0 ? this.cfg.pagesPerCall : req.pages.length;
    if (req.pages.length <= per) return this.convertPages(req, 0);
    const parts: ConvertResult[] = [];
    try {
      for (let start = 0; start < req.pages.length; start += per) {
        parts.push(await this.convertPages({ ...req, pages: req.pages.slice(start, start + per) }, start, req.pages.length));
      }
    } catch (err) {
      // Forbruket fra delene som lyktes, regnes med når en senere del feiler.
      if (err instanceof ConversionError && parts.length) err.usage = sumUsage([...parts.map((p) => p.usage), ...(err.usage ? [err.usage] : [])]);
      throw err;
    }
    return mergeParts(parts, req.pages.length, per);
  }

  /** Én forespørsel med sidene i `req.pages`. `offset` og `total` sier hvor i notatet de hører hjemme. */
  private async convertPages(req: ConvertRequest, offset: number, total = req.pages.length): Promise<ConvertResult> {
    const pages: SentPage[] = [];
    const images: string[] = [];
    for (const p of req.pages) {
      const { data, width, height } = await this.pageImage(p.path, p.width, p.height);
      images.push(data.toString('base64'));
      pages.push({ sent: { width, height }, page: { width: p.width, height: p.height } });
    }
    const sizes = pages.map((p, i) => `Side ${i + 1}: ${p.sent.width}×${p.sent.height} piksler`).join('\n');
    const boxes =
      this.cfg.boxUnits === 'pixels'
        ? 'Oppgi "box" for figurer i piksler i bildet av siden, med størrelsene over.'
        : this.cfg.boxUnits === 'thousandths-yx'
          ? 'Oppgi "box" for figurer som [y0, x0, y1, x1] i tusendeler (0–1000) av sidens høyde og bredde, ikke i piksler.'
          : 'Oppgi "box" for figurer i tusendeler (0–1000) av sidens bredde og høyde, ikke i piksler.';
    const part =
      total > req.pages.length
        ? `Dette er ${req.pages.length === 1 ? `side ${offset + 1}` : `side ${offset + 1}–${offset + req.pages.length}`} av ${total} i notatet. Konverter bare disse sidene; resten settes sammen etterpå. "page" for figurer gjelder bildene her (1 = det første).`
        : `Notatet har ${req.pages.length} ${req.pages.length === 1 ? 'side' : 'sider'}.`;
    const user = [
      buildContext(req),
      `${part} Bildene kommer i samme rekkefølge:\n${sizes}`,
      boxes,
      'Konverter notatet. Svar med <metadata> og <latex> som beskrevet.',
    ].join('\n\n');
    const res = await this.chat('convert', this.cfg.model, req.profile.systemPrompt, user, {
      images,
      imageTokens: pages.reduce((sum, p) => sum + imageTokens(p.sent.width, p.sent.height), 0),
      outputTokens: Math.min(this.cfg.maxTokens, 3_000 * pages.length),
    });
    return this.withLocal(res.usage, () => {
      checkDone(res.doneReason);
      const { meta, body } = parseConversion(res.content);
      return { meta: { ...meta, figures: scaleFigures(meta.figures, pages, this.cfg.boxUnits) }, body, usage: res.usage };
    });
  }

  async fix(req: FixRequest): Promise<{ body: string; usage: Usage }> {
    const user = `${req.profile.fixInstructions}\n\n<compile_errors>\n${req.errorReport}\n</compile_errors>\n\n<latex>\n${req.body}\n</latex>`;
    const res = await this.chat('fix', this.cfg.textModel, req.profile.systemPrompt, user, { outputTokens: this.cfg.maxTokens });
    return this.withLocal(res.usage, () => {
      checkDone(res.doneReason);
      const body = extractLatex(res.content);
      if (body === null) throw new ConversionError('Den lokale AI-en klarte ikke å rette LaTeX-koden.');
      return { body, usage: res.usage };
    });
  }

  async extractToc(
    profile: Profile,
    images: { data: Buffer; mediaType: 'image/jpeg' | 'image/png' }[],
    aims: CompetenceAim[] = [],
  ): Promise<{ chapters: ChapterInput[]; usage: Usage }> {
    const res = await this.chat('toc', this.cfg.model, null, profile.tocPrompt + (aims.length ? TOC_AIMS_PROMPT(aims) : ''), {
      images: await Promise.all(images.map(async (img) => (await this.shrink(img.data)).data.toString('base64'))),
      imageTokens: images.length * imageTokens(this.cfg.imageMaxEdge, this.cfg.imageMaxEdge),
      outputTokens: this.cfg.maxTokens,
      schema: tocSchema,
    });
    return this.withLocal(res.usage, () => {
      checkDone(res.doneReason);
      const parsed = parseJson(tocSchema, res.content, 'Klarte ikke å lese innholdsfortegnelsen.');
      return { chapters: parsed.chapters.map((c) => ({ number: c.number, title: c.title, sections: c.sections })), usage: res.usage };
    });
  }

  async mapSectionAims(profile: Profile, chapters: ChapterInput[], aims: CompetenceAim[]): Promise<{ chapters: ChapterInput[]; usage: Usage }> {
    const list = chapters
      .flatMap((c) => [`${c.number ?? ''} ${c.title}`.trim(), ...(c.sections ?? []).map((s) => `  ${s.code} ${s.title}`)])
      .join('\n');
    const user = `Dette er innholdsfortegnelsen (kapitler og delkapitler) i en lærebok i faget ${profile.label.toLowerCase()}:\n\n${list}${TOC_AIMS_PROMPT(aims)}\n\nSvar med én rad per delkapittel (koden slik den står over).`;
    const res = await this.chat('aims', this.cfg.textModel, null, user, { schema: aimsSchema });
    return this.withLocal(res.usage, () => {
      checkDone(res.doneReason);
      const parsed = parseJson(aimsSchema, res.content, 'Klarte ikke å koble delkapitlene til kompetansemålene.');
      const byCode = new Map(parsed.sections.map((s) => [s.code.trim(), s.aims]));
      return {
        chapters: chapters.map((c) => ({ ...c, sections: c.sections?.map((s) => ({ ...s, aims: byCode.get(s.code) ?? s.aims })) })),
        usage: res.usage,
      };
    });
  }

  async generateFlashcards(req: FlashcardRequest): Promise<{ cards: RawFlashcard[]; usage: Usage }> {
    const res = await this.chat('flashcards', this.cfg.textModel, FLASHCARD_SYSTEM_PROMPT, buildFlashcardPrompt(req), { schema: flashcardSchema });
    return this.withLocal(res.usage, () => {
      if (res.doneReason === 'length') throw new ConversionError('Utvalget ble for stort. Velg færre notater eller færre kort.');
      return { cards: parseJson(flashcardSchema, res.content, 'Den lokale AI-en svarte ikke med kort. Prøv igjen.').cards, usage: res.usage };
    });
  }

  // ---------- Hjelpere ----------

  private withLocal<T>(usage: Usage, fn: () => T): T {
    try {
      return withUsage(usage, fn);
    } catch (err) {
      throw localMessage(err);
    }
  }

  /**
   * Sidebildet skalert ned til `imageMaxEdge` på lengste kant (aldri opp). Med figurbokser i piksler rundes målene til
   * hele 28-piksler, slik Qwen-VL-modellene deler opp bildet; da endrer ikke modellen størrelsen selv, og boksene den
   * oppgir, gjelder bildet vi sendte.
   */
  private async pageImage(file: string, width: number, height: number): Promise<{ data: Buffer; width: number; height: number }> {
    const scale = Math.min(1, this.cfg.imageMaxEdge / Math.max(width, height));
    const data = await fsp.readFile(file);
    const snap = (n: number) => (this.cfg.boxUnits === 'pixels' ? Math.max(28, Math.floor(n / 28) * 28) : Math.max(1, Math.round(n)));
    const w = snap(width * scale);
    const h = snap(height * scale);
    if (w === width && h === height) return { data, width, height };
    return { data: await sharp(data).resize(w, h, { fit: 'fill' }).jpeg({ quality: 90 }).toBuffer(), width: w, height: h };
  }

  private async shrink(data: Buffer): Promise<{ data: Buffer }> {
    const meta = await sharp(data).metadata();
    const w = meta.width ?? this.cfg.imageMaxEdge;
    const h = meta.height ?? this.cfg.imageMaxEdge;
    if (Math.max(w, h) <= this.cfg.imageMaxEdge) return { data };
    return { data: await sharp(data).resize(this.cfg.imageMaxEdge, this.cfg.imageMaxEdge, { fit: 'inside' }).jpeg({ quality: 90 }).toBuffer() };
  }

  private async chat(
    kind: UsageKind,
    model: string,
    system: string | null,
    user: string,
    opts: { images?: string[]; schema?: z.ZodType; imageTokens?: number; outputTokens?: number } = {},
  ): Promise<ChatResult> {
    try {
      return await this.request(kind, model, system, user, opts);
    } catch (err) {
      // Feil før modellen svarte, logges med riktig modell (tekstmodellen for retting, kort og kompetansemål).
      if (err instanceof ConversionError && !err.usage) err.usage = zeroUsage(kind, model);
      throw err;
    }
  }

  private async request(
    kind: UsageKind,
    model: string,
    system: string | null,
    user: string,
    opts: { images?: string[]; schema?: z.ZodType; imageTokens?: number; outputTokens?: number },
  ): Promise<ChatResult> {
    const messages: { role: string; content: string; images?: string[] }[] = [];
    if (system) messages.push({ role: 'system', content: system });
    messages.push({ role: 'user', content: user, ...(opts.images?.length ? { images: opts.images } : {}) });

    // Kontekstvinduet må ha plass til instruksene, bildene og svaret. Grovt anslag: 3 tegn per token.
    const needed = Math.ceil(((system?.length ?? 0) + user.length) / 3) + (opts.imageTokens ?? 0) + (opts.outputTokens ?? this.cfg.maxTokens);
    if (needed > this.cfg.maxCtx) {
      throw new ConversionError(
        `Notatet er for stort for den lokale AI-en (omtrent ${needed.toLocaleString('nb-NO')} tokens, grensen er ${this.cfg.maxCtx.toLocaleString('nb-NO')}). Del det opp i færre sider, eller øk OLLAMA_MAX_CTX.`,
      );
    }
    const numCtx = Math.max(this.cfg.numCtx, Math.ceil(needed / 2048) * 2048);

    const body = {
      model,
      messages,
      // Strømming: svaret begynner å komme med en gang, så Node ikke gir opp etter 5 minutter uten svar.
      stream: true,
      keep_alive: this.cfg.keepAlive,
      ...(this.cfg.think ? {} : { think: false }),
      ...(opts.schema ? { format: z.toJSONSchema(opts.schema) } : {}),
      options: { temperature: 0, num_ctx: numCtx, num_predict: this.cfg.maxTokens },
    };
    let text: string;
    let status: number;
    try {
      const res = await this.fetchImpl(`${this.cfg.url}/api/chat`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(this.cfg.timeoutMs),
      });
      status = res.status;
      text = await res.text();
    } catch (err) {
      const code = (err as { cause?: { code?: string } }).cause?.code ?? '';
      if (err instanceof Error && (err.name === 'TimeoutError' || err.name === 'AbortError' || /TIMEOUT/.test(code))) {
        throw new ConversionError('Den lokale AI-en brukte for lang tid. Prøv med færre sider, eller en mindre modell.');
      }
      throw new ConversionError(`Fikk ikke kontakt med den lokale AI-en (Ollama på ${this.cfg.url}). Prøver igjen om litt.`, true);
    }
    // Svaret er én JSON-linje per bit (NDJSON). Feil kommer som {"error": "..."}, også midt i strømmen.
    let content = '';
    let last: OllamaChatResponse = {};
    let error: string | null = null;
    for (const line of text.split('\n')) {
      if (!line.trim()) continue;
      let chunk: OllamaChatResponse & { error?: string };
      try {
        chunk = JSON.parse(line) as OllamaChatResponse & { error?: string };
      } catch {
        throw new ConversionError(`Uventet svar fra Ollama (HTTP ${status}).`, status >= 500);
      }
      if (chunk.error) error = chunk.error;
      content += chunk.message?.content ?? '';
      last = chunk;
    }
    if (error !== null || status < 200 || status >= 300) throw ollamaError(status, error ?? '', model);
    return {
      content: stripThinking(content),
      doneReason: last.done_reason ?? null,
      usage: {
        kind,
        model: last.model || model,
        inputTokens: last.prompt_eval_count ?? 0,
        outputTokens: last.eval_count ?? 0,
        cacheReadTokens: 0,
        cacheWriteTokens: 0,
      },
    };
  }
}

/** Omtrent hvor mange tokens et bilde blir hos Qwen-VL-modellene (én per 28 × 28 piksler). */
export function imageTokens(width: number, height: number): number {
  return Math.ceil(width / 28) * Math.ceil(height / 28);
}

function sumUsage(usages: Usage[]): Usage {
  return usages.reduce((a, u) => ({
    ...a,
    inputTokens: a.inputTokens + u.inputTokens,
    outputTokens: a.outputTokens + u.outputTokens,
    cacheReadTokens: a.cacheReadTokens + u.cacheReadTokens,
    cacheWriteTokens: a.cacheWriteTokens + u.cacheWriteTokens,
  }));
}

const FIGURE_REF = /(\\originalfigur\s*(?:\[[^\]]*\])?\s*\{)([^}]*)(\})/g;

/**
 * Setter sammen delene av et notat som er konvertert noen sider om gangen. Figur-id-ene gis nye, fortløpende navn
 * (fig1, fig2, …) i både metadata og LaTeX, så to deler som begge har «fig1», ikke kolliderer.
 */
export function mergeParts(parts: ConvertResult[], total: number, per: number): ConvertResult {
  let next = 1;
  const bodies: string[] = [];
  const figures: ConvertResult['meta']['figures'] = [];
  const remarks: string[] = [];
  for (const [i, part] of parts.entries()) {
    const rename = new Map<string, string>();
    const idFor = (id: string) => {
      const key = id.trim();
      if (!rename.has(key)) rename.set(key, `fig${next++}`);
      return rename.get(key)!;
    };
    for (const f of part.meta.figures) figures.push({ ...f, id: idFor(f.id), page: Math.min(total, f.page + i * per) });
    bodies.push(part.body.replace(FIGURE_REF, (_m, open: string, id: string, close: string) => `${open}${idFor(id)}${close}`).trim());
    remarks.push(...part.meta.remarks);
  }
  const first = <K extends keyof ConvertResult['meta']>(key: K) => parts.map((p) => p.meta[key]).find((v) => v !== null) ?? null;
  return {
    meta: {
      title: first('title') as string | null,
      chapter: first('chapter') as string | null,
      section: first('section') as string | null,
      newChapter: first('newChapter') as ConvertResult['meta']['newChapter'],
      date: first('date') as string | null,
      figures,
      remarks: remarks.slice(0, 20),
    },
    body: bodies.join('\n\n'),
    usage: sumUsage(parts.map((p) => p.usage)),
  };
}

function checkDone(reason: string | null): void {
  if (reason === 'length') {
    throw new ConversionError('Notatet ble for langt for den lokale AI-en. Del det opp i færre sider per opplasting.');
  }
}

/** Oversetter feil fra Ollama til norske meldinger. Manglende modell og for lite minne er ikke midlertidige. */
export function ollamaError(status: number, message: string, model: string): ConversionError {
  if (/model ['"]?[^'"]*['"]? not found|try pulling/i.test(message) || (status === 404 && /model/i.test(message))) {
    return new ConversionError(`Modellen «${model}» finnes ikke i Ollama. Last den ned med: ollama pull ${model}`);
  }
  if (/memory|cuda|vram/i.test(message)) {
    return new ConversionError(`Den lokale maskinen har ikke nok minne til modellen «${model}». Velg en mindre modell eller færre sider.`);
  }
  if (status === 429) return new ConversionError('Den lokale AI-en er opptatt. Prøver igjen om litt.', true);
  if (status === 404) return new ConversionError(`Fant ikke Ollama på adressen i OLLAMA_URL (HTTP 404).`);
  // En feil midt i et strømmet svar kommer med HTTP 200: modellen stoppet underveis.
  if (status >= 500 || (status >= 200 && status < 300)) return new ConversionError(`Feil i den lokale AI-en (Ollama: ${message || status}). Prøver igjen om litt.`, true);
  return new ConversionError(`Den lokale AI-en avviste forespørselen: ${message || `HTTP ${status}`}`);
}

/**
 * Kommandoer som begynner på «n», der `\n` i JSON (linjeskift) egentlig var LaTeX. JSON bruker opp n-en, så `\nabla`
 * blir linjeskift + «abla». Listen har resten av navnet. Korte ord som også er vanlige ord (`\ni` = «i», `\neg` = «eg»),
 * er utelatt.
 */
const NEWLINE_COMMANDS = /\n(u|eq|abla|otin|leq|geq|leqslant|geqslant|mid|exists|ewline|oindent|olimits|parallel|subseteq|supseteq|cong|sim)(?![A-Za-z])/g;

/**
 * Retter LaTeX som en liten modell har skrevet feil i JSON. Skriver den `\frac` i stedet for `\\frac`, leser JSON det som
 * sideskift + «rac», og `\theta` blir tabulator + «heta». Ollama tillater disse escape-tegnene, så ingenting feiler,
 * men kortene blir feil. Sideskift og backspace hører aldri hjemme i teksten og gjøres alltid om; tabulator og
 * linjeskift bare foran bokstaver (linjeskift bare foran kjente kommandoer som `\nu` og `\neq`, siden et ekte
 * linjeskift foran et ord er vanlig).
 */
export function repairLatexEscapes<T>(value: T): T {
  if (typeof value === 'string') {
    return value
      .replace(/\f/g, '\\f')
      .replace(/\x08/g, '\\b')
      .replace(/\t(?=[A-Za-z])/g, '\\t')
      .replace(/\r(?=[A-Za-z])/g, '\\r')
      .replace(NEWLINE_COMMANDS, '\\n$1') as T;
  }
  if (Array.isArray(value)) return value.map((v) => repairLatexEscapes(v)) as T;
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, repairLatexEscapes(v)])) as T;
  return value;
}

function parseJson<T extends z.ZodType>(schema: T, text: string, failure: string): z.infer<T> {
  let data: unknown;
  try {
    data = repairLatexEscapes(JSON.parse(text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')));
  } catch {
    throw new ConversionError(failure);
  }
  const parsed = schema.safeParse(data);
  if (!parsed.success) throw new ConversionError(failure);
  return parsed.data;
}
