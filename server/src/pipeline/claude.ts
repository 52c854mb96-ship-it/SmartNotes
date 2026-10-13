import fsp from 'node:fs/promises';
import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { z } from 'zod';
import type { ChapterInput, CompetenceAim, SubjectProfile } from '@smartnotes/shared';
import type { Config, Effort } from '../config.js';
import { ConversionError } from '../errors.js';
import {
  FLASHCARD_SYSTEM_PROMPT,
  buildFlashcardPrompt,
  flashcardSchema,
  type FlashcardRequest,
  type RawFlashcard,
} from '../flashcards/prompt.js';
import { systemPromptFor, usesHaikuClosing, type Profile } from '../profiles/index.js';
import { CLOSING, HAIKU_CLOSING } from '../profiles/precise.js';
import { withUsage, zeroUsage, type Usage } from '../usage.js';
import { TOC_AIMS_PROMPT, buildContext, tocSchema, type AiService, type ConvertRequest, type ConvertResult, type FixRequest } from './ai.js';
import { extractLatex, parseConversion, type NoteMeta } from './parse.js';

/**
 * Sidebildene til Claude. De er skalert slik at modeller med høy oppløsning (Sonnet, Opus og Haiku 5.5) leser dem uten
 * å krympe dem, og figurboksene blir da i sidens egne piksler. `oversized_image: 'error'` gjør at API-et avviser bildet
 * i stedet for å krympe det i stillhet, for eksempel med en eldre modell, så figurene aldri klippes ut feil.
 */
export async function pageBlocks(pages: ConvertRequest['pages']): Promise<Anthropic.Beta.BetaContentBlockParam[]> {
  const blocks: Anthropic.Beta.BetaContentBlockParam[] = [];
  for (const [i, p] of pages.entries()) {
    blocks.push({ type: 'text', text: `Side ${i + 1} (${p.width}×${p.height} piksler):` });
    const data = (await fsp.readFile(p.path)).toString('base64');
    blocks.push({ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data }, transformations: { oversized_image: 'error' } });
  }
  return blocks;
}

function usageOf(kind: Usage['kind'], msg: { model: string; usage: Anthropic.Beta.BetaUsage | Anthropic.Usage }): Usage {
  return {
    kind,
    model: msg.model,
    inputTokens: msg.usage.input_tokens,
    outputTokens: msg.usage.output_tokens,
    cacheReadTokens: msg.usage.cache_read_input_tokens ?? 0,
    cacheWriteTokens: msg.usage.cache_creation_input_tokens ?? 0,
  };
}

function textOf(content: Array<{ type: string }>): string {
  return content
    .filter((b): b is { type: 'text'; text: string } => b.type === 'text')
    .map((b) => b.text)
    .join('');
}

/** Oversetter API-feil til norske meldinger og markerer midlertidige feil som `retryable`. */
export function mapApiError(err: unknown): ConversionError {
  if (err instanceof ConversionError) return err;
  if (err instanceof Anthropic.AuthenticationError || err instanceof Anthropic.PermissionDeniedError) {
    return new ConversionError('Claude API-nøkkelen ble avvist. Sjekk ANTHROPIC_API_KEY på serveren.');
  }
  if (err instanceof Anthropic.RateLimitError) {
    return new ConversionError('Claude har for mange forespørsler akkurat nå. Prøver igjen om litt.', true);
  }
  if (err instanceof Anthropic.BadRequestError) {
    if (/oversized_image|exceed the maximum image size/i.test(err.message)) {
      return new ConversionError(
        'Claude-modellen leser ikke sidebildene i høy oppløsning, så figurene ville blitt klippet ut feil. Bruk claude-sonnet-5-5, claude-opus-5-5 eller claude-haiku-5-5 (CLAUDE_MODEL på serveren, --models i målingen).',
      );
    }
    return new ConversionError(`Claude kunne ikke behandle notatet: ${err.message}`);
  }
  if (err instanceof Anthropic.NotFoundError) {
    return new ConversionError('Claude-modellen ble ikke funnet. Sjekk CLAUDE_MODEL, CLAUDE_MODEL_FLASHCARDS og CLAUDE_MODEL_TOC på serveren.');
  }
  if (err instanceof Anthropic.APIConnectionError || err instanceof Anthropic.InternalServerError) {
    return new ConversionError('Fikk ikke kontakt med Claude. Prøver igjen om litt.', true);
  }
  if (err instanceof Anthropic.APIError) {
    const retryable = err.status === undefined || err.status >= 500 || err.status === 408 || err.status === 409;
    return new ConversionError(`Feil fra Claude (${err.status ?? 'ukjent'}). ${retryable ? 'Prøver igjen om litt.' : ''}`.trim(), retryable);
  }
  return new ConversionError('Uventet feil under konverteringen.');
}

/** Haiku-modellene har ikke server-side fallback; der sendes ikke parameteren. */
export function supportsServerFallback(model: string): boolean {
  return !/haiku/i.test(model);
}

/**
 * Modellens sikkerhetsfiltre avslo forespørselen. Haiku har ingen server-side fallback, så `RefusalFallback` i
 * providers.ts prøver da en gang til med konverteringsmodellen (Sonnet).
 */
export class RefusalError extends ConversionError {}

function checkStop(stop: string | null): void {
  if (stop === 'refusal') throw new RefusalError('Claude avslo å konvertere dette notatet.');
  if (stop === 'max_tokens') {
    throw new ConversionError('Notatet ble for langt til å konverteres i én omgang. Del det opp i færre sider per opplasting.');
  }
}

/**
 * Strukturert svar (`output_config.format`), tolket først etter at stop_reason er sjekket. SDK-ens `messages.parse`
 * tolker teksten før vi får se stop_reason, så et avslag midt i svaret ble en generell feil i stedet for RefusalError.
 */
function parseStructured<T extends z.ZodType>(schema: T, msg: { stop_reason: string | null; content: Array<{ type: string }> }, failure: string): z.infer<T> {
  checkStop(msg.stop_reason);
  let data: unknown;
  try {
    data = JSON.parse(textOf(msg.content));
  } catch {
    throw new ConversionError(failure);
  }
  const parsed = schema.safeParse(data);
  if (!parsed.success) throw new ConversionError(failure);
  return parsed.data;
}

// ---------- Ekte Claude ----------

export class AnthropicClaude implements AiService {
  readonly fake = false;
  readonly provider = 'anthropic';
  private readonly client: Anthropic | null;
  private readonly modelId: string;
  private readonly effort: Effort;
  private readonly maxTokens: number;

  /**
   * `model` er modellen denne tjenesten bruker; standard er konverteringsmodellen (CLAUDE_MODEL). `effort` overstyrer
   * CLAUDE_EFFORT og `maxTokens` CLAUDE_MAX_TOKENS for konvertering og retting (sammenligningen lar Haiku tenke
   * grundigere og gir den plass til både tenkningen og et langt notat).
   */
  constructor(
    private readonly config: Config,
    model: string = config.model,
    opts: { effort?: Effort; maxTokens?: number } = {},
  ) {
    this.modelId = model;
    this.effort = opts.effort ?? config.effort;
    this.maxTokens = opts.maxTokens ?? config.maxOutputTokens;
    this.client = config.anthropicApiKey ? new Anthropic({ apiKey: config.anthropicApiKey, timeout: 20 * 60_000, maxRetries: 3 }) : null;
  }

  get configured(): boolean {
    return this.client !== null;
  }

  get model(): string {
    return this.modelId;
  }

  private requireClient(): Anthropic {
    if (!this.client) throw new ConversionError('Serveren mangler Claude API-nøkkel (ANTHROPIC_API_KEY).');
    return this.client;
  }

  /** Felles for konvertering og retting: strømmet kall med adaptiv tenkning og server-side fallback. */
  private async stream(system: string, content: Anthropic.Beta.BetaContentBlockParam[], effort: Effort) {
    const client = this.requireClient();
    try {
      return await client.beta.messages
        .stream({
          model: this.modelId,
          max_tokens: this.maxTokens,
          thinking: { type: 'adaptive' },
          output_config: { effort },
          system: [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }],
          messages: [{ role: 'user', content }],
          // Hvis modellens sikkerhetsfiltre (feilaktig) avslår, kjøres forespørselen på en anbefalt reservemodell.
          ...(this.config.useFallbacks && supportsServerFallback(this.modelId) ? { betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' as const } : {}),
        })
        .finalMessage();
    } catch (err) {
      throw mapApiError(err);
    }
  }

  async convert(req: ConvertRequest): Promise<ConvertResult> {
    const content: Anthropic.Beta.BetaContentBlockParam[] = [
      { type: 'text', text: buildContext(req) },
      { type: 'text', text: `Notatet har ${req.pages.length} ${req.pages.length === 1 ? 'side' : 'sider'}:` },
      ...(await pageBlocks(req.pages)),
      // Det modellen leser sist, veier mest: Haiku får de viktigste reglene sine gjentatt rett etter sidene.
      { type: 'text', text: usesHaikuClosing(this.modelId) ? HAIKU_CLOSING : CLOSING },
    ];
    const msg = await this.stream(systemPromptFor(req.profile, this.modelId), content, this.effort);
    const usage = usageOf('convert', msg);
    return withUsage(usage, () => {
      checkStop(msg.stop_reason);
      const { meta, body } = parseConversion(textOf(msg.content));
      return { meta, body, usage };
    });
  }

  async fix(req: FixRequest): Promise<{ body: string; usage: Usage }> {
    const content: Anthropic.Beta.BetaContentBlockParam[] = [
      { type: 'text', text: `${req.profile.fixInstructions}\n\n<compile_errors>\n${req.errorReport}\n</compile_errors>` },
      { type: 'text', text: `<latex>\n${req.body}\n</latex>` },
    ];
    const effort: Effort = this.effort === 'low' ? 'low' : 'medium';
    const msg = await this.stream(systemPromptFor(req.profile, this.modelId), content, effort);
    const usage = usageOf('fix', msg);
    return withUsage(usage, () => {
      checkStop(msg.stop_reason);
      const body = extractLatex(textOf(msg.content));
      if (body === null) throw new ConversionError('Claude klarte ikke å rette LaTeX-koden.');
      return { body, usage };
    });
  }

  async extractToc(
    profile: Profile,
    images: { data: Buffer; mediaType: 'image/jpeg' | 'image/png' }[],
    aims: CompetenceAim[] = [],
  ): Promise<{ chapters: ChapterInput[]; usage: Usage }> {
    const client = this.requireClient();
    const { schema } = zodOutputFormat(tocSchema);
    try {
      const msg = await client.messages.create({
        model: this.modelId,
        max_tokens: 32_000,
        output_config: { effort: 'low', format: { type: 'json_schema', schema } },
        messages: [
          {
            role: 'user',
            content: [
              ...images.map((img) => ({
                type: 'image' as const,
                source: { type: 'base64' as const, media_type: img.mediaType, data: img.data.toString('base64') },
              })),
              { type: 'text' as const, text: profile.tocPrompt + (aims.length ? TOC_AIMS_PROMPT(aims) : '') },
            ],
          },
        ],
      });
      const usage = usageOf('toc', msg);
      return withUsage(usage, () => {
        const parsed = parseStructured(tocSchema, msg, 'Klarte ikke å lese innholdsfortegnelsen.');
        return { chapters: parsed.chapters.map((c) => ({ number: c.number, title: c.title, sections: c.sections })), usage };
      });
    } catch (err) {
      throw mapApiError(err);
    }
  }

  async mapSectionAims(
    profile: Profile,
    chapters: ChapterInput[],
    aims: CompetenceAim[],
  ): Promise<{ chapters: ChapterInput[]; usage: Usage }> {
    const client = this.requireClient();
    const aimsSchema = z.object({ sections: z.array(z.object({ code: z.string(), aims: z.array(z.string()) })) });
    const { schema } = zodOutputFormat(aimsSchema);
    const list = chapters
      .flatMap((c) => [`${c.number ?? ''} ${c.title}`.trim(), ...(c.sections ?? []).map((s) => `  ${s.code} ${s.title}`)])
      .join('\n');
    try {
      const msg = await client.messages.create({
        model: this.modelId,
        max_tokens: 16_000,
        output_config: { effort: 'low', format: { type: 'json_schema', schema } },
        messages: [
          {
            role: 'user',
            content: `Dette er innholdsfortegnelsen (kapitler og delkapitler) i en lærebok i faget ${profile.label.toLowerCase()}:\n\n${list}${TOC_AIMS_PROMPT(aims)}\n\nSvar med én rad per delkapittel (koden slik den står over).`,
          },
        ],
      });
      const usage = usageOf('aims', msg);
      const parsed = withUsage(usage, () => parseStructured(aimsSchema, msg, 'Klarte ikke å koble delkapitlene til kompetansemålene.'));
      const byCode = new Map(parsed.sections.map((s) => [s.code.trim(), s.aims]));
      return {
        chapters: chapters.map((c) => ({
          ...c,
          sections: c.sections?.map((s) => ({ ...s, aims: byCode.get(s.code) ?? s.aims })),
        })),
        usage,
      };
    } catch (err) {
      throw mapApiError(err);
    }
  }

  async generateFlashcards(req: FlashcardRequest): Promise<{ cards: RawFlashcard[]; usage: Usage }> {
    const client = this.requireClient();
    // Formatet sendes uten `parse`, så SDK-en ikke tolker svaret selv: et avkuttet eller avslått svar skal gi en norsk
    // melding (se parseFlashcardMessage), ikke en generell feil.
    const { schema } = zodOutputFormat(flashcardSchema);
    let msg: Anthropic.Beta.BetaMessage;
    try {
      msg = await client.beta.messages
        .stream({
          model: this.modelId,
          max_tokens: 64_000,
          thinking: { type: 'adaptive' },
          output_config: { effort: 'medium', format: { type: 'json_schema', schema } },
          system: [{ type: 'text', text: FLASHCARD_SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
          messages: [{ role: 'user', content: buildFlashcardPrompt(req) }],
          // Avslår modellens sikkerhetsfiltre feilaktig (f.eks. biologi om virus), prøves en anbefalt reservemodell.
          ...(this.config.useFallbacks && supportsServerFallback(this.modelId) ? { betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' as const } : {}),
        })
        .finalMessage();
    } catch (err) {
      throw flashcardError(err);
    }
    const usage = usageOf('flashcards', msg);
    return { cards: withUsage(usage, () => parseFlashcardMessage(msg)), usage };
  }
}

/** Feilmeldingene fra mapApiError handler om notatkonvertering; her gjelder de kortstokker. */
export function flashcardError(err: unknown): ConversionError {
  const e = mapApiError(err);
  if (e.message === 'Uventet feil under konverteringen.') return new ConversionError('Uventet feil da kortene skulle lages. Prøv igjen.');
  if (e.message.startsWith('Claude kunne ikke behandle notatet')) {
    return new ConversionError(e.message.replace('Claude kunne ikke behandle notatet', 'Claude kunne ikke lage kort av notatene'));
  }
  return e;
}

/** Kortene i svaret fra Claude. Avslag, avkuttet svar og ugyldig JSON gir norske feilmeldinger. */
export function parseFlashcardMessage(msg: { stop_reason: string | null; content: Array<{ type: string }> }): RawFlashcard[] {
  if (msg.stop_reason === 'refusal') throw new RefusalError('Claude avslo å lage kort av disse notatene.');
  if (msg.stop_reason === 'max_tokens') throw new ConversionError('Utvalget ble for stort. Velg færre notater eller færre kort.');
  let data: unknown;
  try {
    data = JSON.parse(textOf(msg.content));
  } catch {
    throw new ConversionError('Claude svarte ikke med kort. Prøv igjen.');
  }
  const parsed = flashcardSchema.safeParse(data);
  if (!parsed.success) throw new ConversionError('Claude svarte ikke med kort. Prøv igjen.');
  return parsed.data.cards;
}

// ---------- Falsk Claude (utvikling og tester) ----------

/**
 * Svarer med et realistisk notat uten å kalle API-et. Aktiveres med SMARTNOTES_FAKE_CLAUDE=1.
 * Instruksjonen «FEIL» gir først ugyldig LaTeX, slik at rette-løkken kan testes.
 */
export class FakeClaude implements AiService {
  readonly fake = true;
  readonly configured = true;
  readonly model = 'fake-claude';
  readonly provider: string = 'fake';

  constructor(private readonly delayMs = Number(process.env.FAKE_CLAUDE_DELAY_MS ?? 800)) {}

  private usage(kind: Usage['kind']): Usage {
    return zeroUsage(kind, this.model);
  }

  async convert(req: ConvertRequest): Promise<ConvertResult> {
    await new Promise((r) => setTimeout(r, this.delayMs));
    const first = req.pages[0]!;
    const broken = /FEIL/.test(req.instructions ?? '');
    const body = fakeBody(req.profile.id, broken) + String.raw`
\originalfigur[0.5]{fig1}{Skisse fra notatet}

\begin{merknad}
Dette er et testnotat laget uten Claude (${req.pages.length} ${req.pages.length === 1 ? 'side' : 'sider'}).
\end{merknad}
`;
    const meta: NoteMeta = {
      title: req.userTitle ?? `Testnotat (${req.pages.length} ${req.pages.length === 1 ? 'side' : 'sider'})`,
      chapter: req.fixedChapter ? null : (req.chapters[0]?.alias ?? null),
      section: (req.fixedChapter ?? req.chapters[0])?.sections[0]?.code ?? null,
      newChapter: req.fixedChapter || req.chapters.length > 0 ? null : { number: '1', title: FAKE_TOC[req.profile.id][0]!.title },
      date: req.today,
      figures: [{ id: 'fig1', page: 1, box: [first.width * 0.2, first.height * 0.2, first.width * 0.8, first.height * 0.5] }],
      remarks: ['Dette er et testnotat fra falsk Claude.'],
    };
    return { meta, body, usage: this.usage('convert') };
  }

  async fix(req: FixRequest): Promise<{ body: string; usage: Usage }> {
    await new Promise((r) => setTimeout(r, this.delayMs / 2));
    const body = req.body.replace(/\\begin\{formel\}\nMangler slutt\n/, '');
    return { body, usage: this.usage('fix') };
  }

  async extractToc(profile: Profile, _images: unknown, aims: CompetenceAim[] = []): Promise<{ chapters: ChapterInput[]; usage: Usage }> {
    await new Promise((r) => setTimeout(r, this.delayMs));
    const { chapters } = await this.mapSectionAims(profile, FAKE_TOC[profile.id], aims);
    return { chapters, usage: this.usage('toc') };
  }

  /**
   * Tre kort per notat (begrep, forklaring, anvendelse) med formel, fet skrift og overskriftslinje, så visningen kan
   * testes. Med `count` lages så mange kort (gjentatt over notatene). Et notat med «FEIL» i tittelen gir feil.
   */
  async generateFlashcards(req: FlashcardRequest): Promise<{ cards: RawFlashcard[]; usage: Usage }> {
    await new Promise((r) => setTimeout(r, this.delayMs));
    if (req.notes.some((n) => /FEIL/.test(n.title))) throw new ConversionError('Testfeil fra falsk Claude.');
    const formula = req.subjectLabel === 'Kjemi' ? String.raw`$\ce{2H2 + O2 -> 2H2O}$` : String.raw`$F = m \cdot a$`;
    const perNote = (n: FlashcardRequest['notes'][number]): RawFlashcard[] => [
      {
        note: n.alias,
        kind: 'concept',
        front: `Hva handler notatet «${n.title}» om?`,
        back: [`**${n.title}**`, `Formel: ${formula}`],
        detail: `Dette er et testkort fra falsk Claude.\n\nTenk på det som en huskelapp: ${formula} er en formel.`,
      },
      {
        note: n.alias,
        kind: 'explain',
        front: `Forklar hovedideen i «${n.title}».`,
        back: ['!Tre punkter', 'Første punkt', 'Andre punkt med **nøkkelbegrep**', String.raw`Tredje punkt med $v = \frac{s}{t}$`],
        detail: '',
      },
      {
        note: n.alias,
        kind: 'apply',
        front: String.raw`${n.title}: regn ut $F$ når $m = 2{,}0\ \text{kg}$ og $a = 3{,}0\ \text{m/s}^2$.`,
        back: [String.raw`$F = m \cdot a$`, String.raw`$F = 2{,}0 \cdot 3{,}0\ \text{N} = 6{,}0\ \text{N}$`],
        detail: 'Sett inn tallene i Newtons andre lov.',
      },
    ];
    let cards = req.notes.flatMap(perNote);
    if (req.count) {
      const all = cards;
      cards = Array.from({ length: req.count }, (_, i) => {
        const c = all[i % all.length]!;
        return i < all.length ? c : { ...c, front: `${c.front} (${Math.floor(i / all.length) + 1})` };
      });
    }
    return { cards, usage: this.usage('flashcards') };
  }

  /** Kobler hvert delkapittel til det første målet som ikke går på tvers av kapitlene. */
  async mapSectionAims(_profile: Profile, chapters: ChapterInput[], aims: CompetenceAim[]): Promise<{ chapters: ChapterInput[]; usage: Usage }> {
    const first = aims.find((a) => !a.cross)?.code;
    return {
      chapters: chapters.map((c) => ({ ...c, sections: c.sections?.map((s) => ({ ...s, aims: first ? [first] : [] })) })),
      usage: this.usage('aims'),
    };
  }
}

const sec = (code: string, title: string) => ({ code, title, aims: [] as string[] });

const FAKE_TOC: Record<SubjectProfile, ChapterInput[]> = {
  physics: [
    { number: '1', title: 'Fysikk og måling', sections: [sec('1A', 'Måling'), sec('1B', 'Usikkerhet')] },
    { number: '2', title: 'Bevegelse', sections: [sec('2A', 'Fart'), sec('2B', 'Akselerasjon')] },
    { number: '3', title: 'Kraft og bevegelse' },
    { number: '4', title: 'Energi' },
  ],
  chemistry: [
    { number: '1', title: 'Atomer og periodesystemet', sections: [sec('1.1', 'Atomet'), sec('1.2', 'Periodesystemet')] },
    { number: '2', title: 'Kjemiske bindinger', sections: [sec('2.1', 'Ionebinding'), sec('2.2', 'Kovalent binding')] },
    { number: '3', title: 'Mol og stoffmengde' },
  ],
  biology: [
    { number: '1', title: 'Cellen', sections: [sec('1.1', 'Cellens oppbygning'), sec('1.2', 'Transport gjennom membranen')] },
    { number: '2', title: 'Fotosyntese og celleånding' },
    { number: '3', title: 'Økologi' },
  ],
  geoscience: [
    { number: '1', title: 'Jordas indre', sections: [sec('1.1', 'Jordas oppbygning'), sec('1.2', 'Platetektonikk')] },
    { number: '2', title: 'Bergarter og mineraler', sections: [sec('2.1', 'Mineraler'), sec('2.2', 'Bergartenes kretsløp')] },
    { number: '3', title: 'Vær og klima' },
  ],
};

/** Testinnhold per fag fra falsk Claude: bruker malens bokser, formler og tegninger, så malene kompileres ordentlig. */
function fakeBody(profile: SubjectProfile, broken: boolean): string {
  const brokenTail = broken ? '\n\\begin{formel}\nMangler slutt\n' : '';
  if (profile === 'chemistry')
    return String.raw`\section{Stoffmengde}

Forbrenning av hydrogen: \ce{2 H2(g) + O2(g) -> 2 H2O(l)}. Ionene \ce{SO4^2-} og \ce{Fe^3+} finnes i løsningen.

\begin{formel}[Stoffmengde]
\[ n = \frac{m}{M} \]
\end{formel}

Konsentrasjonen er $c = \qty{0.10}{mol/L}$, så $\mathrm{pH} = -\lg[\ce{H3O+}]$.${brokenTail}

\begin{center}
\chemfig{H-C(-[2]H)(-[6]H)-C(-[2]H)(-[6]H)-O-H}
\end{center}
`;
  if (profile === 'geoscience')
    return String.raw`\section{Bergartenes kretsløp}

Kalkstein løses opp av surt vann: \ce{CaCO3 + H2O + CO2 -> Ca^2+ + 2 HCO3-}. Gjennomsnittstemperaturen i juli er \qty{16.4}{\degreeCelsius}, og årsnedbøren er \qty{760}{mm}.

\begin{formel}[Halveringstid]
\[ N = N_0 \left(\tfrac12\right)^{t/T_{1/2}} \]
\end{formel}

Platene beveger seg om lag \qty{2.5}{cm} per år. Kartet har målestokk 1:\num{50000}, og toppen ligger på $60^\circ$\,N.${brokenTail}

\begin{figure}[H]
\centering
\begin{tikzpicture}
\begin{axis}[width=8cm, height=4cm, axis lines=left, xlabel={Avstand / \unit{km}}, ylabel={Høyde / \unit{m}}, xmin=0, xmax=4, ymin=0, ymax=900]
  \addplot[thick, fill=sngreen!15] coordinates {(0,0) (1,300) (2,800) (3,400) (4,0)} \closedcycle;
\end{axis}
\end{tikzpicture}
\caption{Terrengprofil.}
\end{figure}
`;
  if (profile === 'biology')
    return String.raw`\section{Fotosyntesen}

Planter som \textit{Elodea canadensis} lager sukker i lyset:
\[ \ce{6 CO2 + 6 H2O -> C6H12O6 + 6 O2} \]

\begin{formel}[Mendels første lov]
To alleler skilles fra hverandre når kjønnscellene dannes.
\end{formel}

\begin{tabular}{c|cc}
 & $A$ & $a$ \\ \hline
$A$ & $AA$ & $Aa$ \\
$a$ & $Aa$ & $aa$
\end{tabular}${brokenTail}

\begin{figure}[H]
\centering
\begin{tikzpicture}[>={Stealth}, node distance=2.2cm, every node/.style={draw, rounded corners}]
  \node (p) {Produsent};
  \node[right=of p] (k) {Konsument};
  \draw[->, thick] (p) -- (k);
\end{tikzpicture}
\caption{Næringskjede.}
\end{figure}
`;
  return String.raw`\section{Newtons lover}

Newtons første lov: Et legeme som ikke påvirkes av en netto kraft, holder seg i ro eller beveger seg med konstant fart.

\begin{formel}[Newtons 2. lov]
\[ \sum \vec{F} = m\vec{a} \]
\end{formel}

Tyngdeakselerasjonen er $g = \qty{9.81}{\meter\per\second\squared}$.${brokenTail}

\begin{figure}[H]
\centering
\begin{tikzpicture}[>={Stealth}]
  \draw[thick] (0,0) -- (4,0) -- (4,2) -- cycle;
  \draw[->,thick,red] (2.4,1.2) -- ++(0,-1.2) node[below] {$G$};
\end{tikzpicture}
\caption{Kloss på skråplan.}
\end{figure}
`;
}
