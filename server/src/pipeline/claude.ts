import fsp from 'node:fs/promises';
import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { z } from 'zod';
import type { ChapterInput } from '@smartnotes/shared';
import type { Config, Effort } from '../config.js';
import { ConversionError } from '../errors.js';
import type { Profile } from '../profiles/index.js';
import { extractLatex, parseConversion, type NoteMeta } from './parse.js';

export interface ChapterRef {
  /** Kort alias som Claude svarer med, f.eks. «k3». */
  alias: string;
  number: string | null;
  title: string;
  /** Delkapitlene, f.eks. [{ code: '2E', title: 'Newtons 2. lov' }]. */
  sections: { code: string; title: string }[];
}

export interface ConvertRequest {
  profile: Profile;
  subjectName: string;
  textbook: string | null;
  chapters: ChapterRef[];
  /** Kapittelet brukeren har valgt selv (Claude skal da ikke velge). */
  fixedChapter: { number: string | null; title: string; sections: { code: string; title: string }[] } | null;
  userTitle: string | null;
  userDate: string | null;
  instructions: string | null;
  /** Dagens dato, YYYY-MM-DD. */
  today: string;
  pages: { path: string; width: number; height: number }[];
}

export interface Usage {
  kind: 'convert' | 'fix' | 'toc';
  model: string;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
}

export interface ConvertResult {
  meta: NoteMeta;
  body: string;
  usage: Usage;
}

export interface FixRequest {
  profile: Profile;
  body: string;
  errorReport: string;
}

export interface ClaudeService {
  readonly configured: boolean;
  readonly model: string;
  readonly fake: boolean;
  convert(req: ConvertRequest): Promise<ConvertResult>;
  fix(req: FixRequest): Promise<{ body: string; usage: Usage }>;
  extractToc(profile: Profile, images: { data: Buffer; mediaType: 'image/jpeg' | 'image/png' }[]): Promise<ChapterInput[]>;
}

// ---------- Bygging av forespørselen ----------

/** Tekst-konteksten som sendes foran sidebildene. Eksportert for testing. */
const sectionList = (sections: { code: string; title: string }[]) => sections.map((x) => `${x.code} ${x.title}`).join('; ');

export function buildContext(req: ConvertRequest): string {
  const lines: string[] = ['<context>', `Fag: ${req.subjectName}`, `Lærebok/emne: ${req.textbook?.trim() || 'ikke oppgitt'}`, `Dagens dato: ${req.today}`];
  if (req.fixedChapter) {
    const c = req.fixedChapter;
    lines.push(
      `Kapittel: brukeren har allerede plassert notatet i «${c.number ? `${c.number} ` : ''}${c.title}». Sett "chapter" og "new_chapter" til null.`,
    );
    if (c.sections.length > 0) lines.push(`Delkapitler i dette kapittelet (svar med koden i "section"): ${sectionList(c.sections)}`);
  } else if (req.chapters.length > 0) {
    lines.push('Kapitler i læreboka (svar med id-en i "chapter" og koden for delkapittelet i "section"):');
    for (const c of req.chapters) {
      lines.push(`${c.alias}: ${c.number ? `${c.number} ` : ''}${c.title}${c.sections.length > 0 ? ` – delkapitler: ${sectionList(c.sections)}` : ''}`);
    }
  } else {
    lines.push('Faget har ingen kapittelliste ennå. Sett "chapter" til null og foreslå et lærebokkapittel i "new_chapter".');
  }
  if (req.userTitle) lines.push(`Tittel fra brukeren (bruk denne som "title"): ${req.userTitle}`);
  if (req.userDate) lines.push(`Dato fra brukeren: ${req.userDate}`);
  if (req.instructions?.trim()) lines.push(`Ekstra instruksjoner fra brukeren: ${req.instructions.trim()}`);
  lines.push('</context>');
  return lines.join('\n');
}

async function pageBlocks(pages: ConvertRequest['pages']): Promise<Anthropic.Beta.BetaContentBlockParam[]> {
  const blocks: Anthropic.Beta.BetaContentBlockParam[] = [];
  for (const [i, p] of pages.entries()) {
    blocks.push({ type: 'text', text: `Side ${i + 1} (${p.width}×${p.height} piksler):` });
    const data = (await fsp.readFile(p.path)).toString('base64');
    blocks.push({ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data } });
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
    return new ConversionError(`Claude kunne ikke behandle notatet: ${err.message}`);
  }
  if (err instanceof Anthropic.NotFoundError) {
    return new ConversionError('Claude-modellen ble ikke funnet. Sjekk CLAUDE_MODEL på serveren.');
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

function checkStop(stop: string | null): void {
  if (stop === 'refusal') throw new ConversionError('Claude avslo å konvertere dette notatet.');
  if (stop === 'max_tokens') {
    throw new ConversionError('Notatet ble for langt til å konverteres i én omgang. Del det opp i færre sider per opplasting.');
  }
}

// ---------- Ekte Claude ----------

export class AnthropicClaude implements ClaudeService {
  readonly fake = false;
  private readonly client: Anthropic | null;

  constructor(private readonly config: Config) {
    this.client = config.anthropicApiKey ? new Anthropic({ apiKey: config.anthropicApiKey, timeout: 20 * 60_000, maxRetries: 3 }) : null;
  }

  get configured(): boolean {
    return this.client !== null;
  }

  get model(): string {
    return this.config.model;
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
          model: this.config.model,
          max_tokens: this.config.maxOutputTokens,
          thinking: { type: 'adaptive' },
          output_config: { effort },
          system: [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }],
          messages: [{ role: 'user', content }],
          // Hvis modellens sikkerhetsfiltre (feilaktig) avslår, kjøres forespørselen på en anbefalt reservemodell.
          ...(this.config.useFallbacks ? { betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' as const } : {}),
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
      { type: 'text', text: 'Konverter notatet. Svar med <metadata> og <latex> som beskrevet.' },
    ];
    const msg = await this.stream(req.profile.systemPrompt, content, this.config.effort);
    checkStop(msg.stop_reason);
    const { meta, body } = parseConversion(textOf(msg.content));
    return { meta, body, usage: usageOf('convert', msg) };
  }

  async fix(req: FixRequest): Promise<{ body: string; usage: Usage }> {
    const content: Anthropic.Beta.BetaContentBlockParam[] = [
      { type: 'text', text: `${req.profile.fixInstructions}\n\n<compile_errors>\n${req.errorReport}\n</compile_errors>` },
      { type: 'text', text: `<latex>\n${req.body}\n</latex>` },
    ];
    const effort: Effort = this.config.effort === 'low' ? 'low' : 'medium';
    const msg = await this.stream(req.profile.systemPrompt, content, effort);
    checkStop(msg.stop_reason);
    const body = extractLatex(textOf(msg.content));
    if (body === null) throw new ConversionError('Claude klarte ikke å rette LaTeX-koden.');
    return { body, usage: usageOf('fix', msg) };
  }

  async extractToc(profile: Profile, images: { data: Buffer; mediaType: 'image/jpeg' | 'image/png' }[]): Promise<ChapterInput[]> {
    const client = this.requireClient();
    const schema = z.object({
      chapters: z.array(z.object({ number: z.string().nullable(), title: z.string() })),
    });
    try {
      const msg = await client.messages.parse({
        model: this.config.model,
        max_tokens: 16_000,
        output_config: { effort: 'low', format: zodOutputFormat(schema) },
        messages: [
          {
            role: 'user',
            content: [
              ...images.map((img) => ({
                type: 'image' as const,
                source: { type: 'base64' as const, media_type: img.mediaType, data: img.data.toString('base64') },
              })),
              { type: 'text' as const, text: profile.tocPrompt },
            ],
          },
        ],
      });
      checkStop(msg.stop_reason);
      const parsed = msg.parsed_output;
      if (!parsed) throw new ConversionError('Klarte ikke å lese innholdsfortegnelsen.');
      return parsed.chapters
        .map((c) => ({ number: c.number?.trim() || null, title: c.title.trim() }))
        .filter((c) => c.title.length > 0);
    } catch (err) {
      throw mapApiError(err);
    }
  }
}

// ---------- Falsk Claude (utvikling og tester) ----------

/**
 * Svarer med et realistisk notat uten å kalle API-et. Aktiveres med SMARTNOTES_FAKE_CLAUDE=1.
 * Instruksjonen «FEIL» gir først ugyldig LaTeX, slik at rette-løkken kan testes.
 */
export class FakeClaude implements ClaudeService {
  readonly fake = true;
  readonly configured = true;
  readonly model = 'fake-claude';

  constructor(private readonly delayMs = Number(process.env.FAKE_CLAUDE_DELAY_MS ?? 800)) {}

  private usage(kind: Usage['kind']): Usage {
    return { kind, model: this.model, inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 };
  }

  async convert(req: ConvertRequest): Promise<ConvertResult> {
    await new Promise((r) => setTimeout(r, this.delayMs));
    const first = req.pages[0]!;
    const broken = /FEIL/.test(req.instructions ?? '');
    const body = String.raw`\section{Newtons lover}

Newtons første lov: Et legeme som ikke påvirkes av en netto kraft, holder seg i ro eller beveger seg med konstant fart.

\begin{formel}[Newtons 2. lov]
\[ \sum \vec{F} = m\vec{a} \]
\end{formel}

Tyngdeakselerasjonen er $g = \qty{9.81}{\meter\per\second\squared}$.${broken ? '\n\\begin{formel}\nMangler slutt\n' : ''}

\begin{figure}[H]
\centering
\begin{tikzpicture}[>={Stealth}]
  \draw[thick] (0,0) -- (4,0) -- (4,2) -- cycle;
  \draw[->,thick,red] (2.4,1.2) -- ++(0,-1.2) node[below] {$G$};
\end{tikzpicture}
\caption{Kloss på skråplan.}
\end{figure}

\originalfigur[0.5]{fig1}{Skisse fra notatet}

\begin{merknad}
Dette er et testnotat laget uten Claude (${req.pages.length} ${req.pages.length === 1 ? 'side' : 'sider'}).
\end{merknad}
`;
    const meta: NoteMeta = {
      title: req.userTitle ?? `Testnotat (${req.pages.length} ${req.pages.length === 1 ? 'side' : 'sider'})`,
      chapter: req.fixedChapter ? null : (req.chapters[0]?.alias ?? null),
      section: (req.fixedChapter ?? req.chapters[0])?.sections[0]?.code ?? null,
      newChapter: req.fixedChapter || req.chapters.length > 0 ? null : { number: '1', title: 'Fysikk og måling' },
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

  async extractToc(): Promise<ChapterInput[]> {
    await new Promise((r) => setTimeout(r, this.delayMs));
    return [
      { number: '1', title: 'Fysikk og måling' },
      { number: '2', title: 'Bevegelse' },
      { number: '3', title: 'Kraft og bevegelse' },
      { number: '4', title: 'Energi' },
    ];
  }
}

export function createClaude(config: Config): ClaudeService {
  return config.fakeClaude ? new FakeClaude() : new AnthropicClaude(config);
}
