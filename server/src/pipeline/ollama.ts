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
import { withUsage, type Usage } from '../usage.js';
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
    const sx = units === 'thousandths' ? p.page.width / 1000 : p.page.width / p.sent.width;
    const sy = units === 'thousandths' ? p.page.height / 1000 : p.page.height / p.sent.height;
    const [x0, y0, x1, y1] = f.box;
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

  async convert(req: ConvertRequest): Promise<ConvertResult> {
    const pages: SentPage[] = [];
    const images: string[] = [];
    for (const p of req.pages) {
      const { data, width, height } = await this.pageImage(p.path, p.width, p.height);
      images.push(data.toString('base64'));
      pages.push({ sent: { width, height }, page: { width: p.width, height: p.height } });
    }
    const sizes = pages.map((p, i) => `Side ${i + 1}: ${p.sent.width}×${p.sent.height} piksler`).join('\n');
    const boxes =
      this.cfg.boxUnits === 'thousandths'
        ? 'Oppgi "box" for figurer i tusendeler (0–1000) av sidens bredde og høyde, ikke i piksler.'
        : 'Oppgi "box" for figurer i piksler i bildet av siden, med størrelsene over.';
    const user = [
      buildContext(req),
      `Notatet har ${req.pages.length} ${req.pages.length === 1 ? 'side' : 'sider'}. Bildene kommer i samme rekkefølge:\n${sizes}`,
      boxes,
      'Konverter notatet. Svar med <metadata> og <latex> som beskrevet.',
    ].join('\n\n');
    const res = await this.chat('convert', this.cfg.model, req.profile.systemPrompt, user, { images });
    return this.withLocal(res.usage, () => {
      checkDone(res.doneReason);
      const { meta, body } = parseConversion(res.content);
      return { meta: { ...meta, figures: scaleFigures(meta.figures, pages, this.cfg.boxUnits) }, body, usage: res.usage };
    });
  }

  async fix(req: FixRequest): Promise<{ body: string; usage: Usage }> {
    const user = `${req.profile.fixInstructions}\n\n<compile_errors>\n${req.errorReport}\n</compile_errors>\n\n<latex>\n${req.body}\n</latex>`;
    const res = await this.chat('fix', this.cfg.textModel, req.profile.systemPrompt, user);
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

  /** Sidebildet skalert ned til `imageMaxEdge` på lengste kant (aldri opp). */
  private async pageImage(file: string, width: number, height: number): Promise<{ data: Buffer; width: number; height: number }> {
    const scale = Math.min(1, this.cfg.imageMaxEdge / Math.max(width, height));
    const data = await fsp.readFile(file);
    if (scale >= 1) return { data, width, height };
    const w = Math.max(1, Math.round(width * scale));
    const h = Math.max(1, Math.round(height * scale));
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
    opts: { images?: string[]; schema?: z.ZodType } = {},
  ): Promise<ChatResult> {
    const messages: { role: string; content: string; images?: string[] }[] = [];
    if (system) messages.push({ role: 'system', content: system });
    messages.push({ role: 'user', content: user, ...(opts.images?.length ? { images: opts.images } : {}) });
    const body = {
      model,
      messages,
      stream: false,
      keep_alive: this.cfg.keepAlive,
      ...(opts.schema ? { format: z.toJSONSchema(opts.schema) } : {}),
      options: { temperature: 0, num_ctx: this.cfg.numCtx, num_predict: this.cfg.maxTokens },
    };
    let res: Response;
    try {
      res = await this.fetchImpl(`${this.cfg.url}/api/chat`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(this.cfg.timeoutMs),
      });
    } catch (err) {
      if (err instanceof Error && (err.name === 'TimeoutError' || err.name === 'AbortError')) {
        throw new ConversionError('Den lokale AI-en brukte for lang tid. Prøv med færre sider, eller en mindre modell.');
      }
      throw new ConversionError(`Fikk ikke kontakt med den lokale AI-en (Ollama på ${this.cfg.url}). Prøver igjen om litt.`, true);
    }
    const text = await res.text();
    let data: OllamaChatResponse & { error?: string };
    try {
      data = JSON.parse(text) as OllamaChatResponse & { error?: string };
    } catch {
      throw new ConversionError(`Uventet svar fra Ollama (HTTP ${res.status}).`, res.status >= 500);
    }
    if (!res.ok) throw ollamaError(res.status, data.error ?? '', model);
    return {
      content: stripThinking(data.message?.content ?? ''),
      doneReason: data.done_reason ?? null,
      usage: {
        kind,
        model: data.model || model,
        inputTokens: data.prompt_eval_count ?? 0,
        outputTokens: data.eval_count ?? 0,
        cacheReadTokens: 0,
        cacheWriteTokens: 0,
      },
    };
  }
}

function checkDone(reason: string | null): void {
  if (reason === 'length') {
    throw new ConversionError('Notatet ble for langt for den lokale AI-en. Del det opp i færre sider per opplasting.');
  }
}

/** Oversetter feil fra Ollama til norske meldinger. Manglende modell og for lite minne er ikke midlertidige. */
export function ollamaError(status: number, message: string, model: string): ConversionError {
  if (status === 404 || /not found|pull/i.test(message)) {
    return new ConversionError(`Modellen «${model}» finnes ikke i Ollama. Last den ned med: ollama pull ${model}`);
  }
  if (/memory|out of memory|cuda|vram/i.test(message)) {
    return new ConversionError(`Den lokale maskinen har ikke nok minne til modellen «${model}». Velg en mindre modell eller færre sider.`);
  }
  if (status >= 500) return new ConversionError(`Feil i den lokale AI-en (Ollama ${status}). Prøver igjen om litt.`, true);
  return new ConversionError(`Den lokale AI-en avviste forespørselen: ${message || `HTTP ${status}`}`);
}

function parseJson<T extends z.ZodType>(schema: T, text: string, failure: string): z.infer<T> {
  let data: unknown;
  try {
    data = JSON.parse(text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, ''));
  } catch {
    throw new ConversionError(failure);
  }
  const parsed = schema.safeParse(data);
  if (!parsed.success) throw new ConversionError(failure);
  return parsed.data;
}
