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
import type { Profile } from '../profiles/index.js';
import { aimsForPrompt } from '../toc.js';
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
  kind: 'convert' | 'fix' | 'toc' | 'flashcards';
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
  /** Leser kapitler og delkapitler fra bilder av innholdsfortegnelsen, og kobler delkapitlene til `aims` (hvis noen). */
  extractToc(profile: Profile, images: { data: Buffer; mediaType: 'image/jpeg' | 'image/png' }[], aims?: CompetenceAim[]): Promise<ChapterInput[]>;
  /** Kobler delkapitlene (fra innlimt tekst) til kompetansemålene. Gir tilbake de samme kapitlene med `aims` fylt inn. */
  mapSectionAims(profile: Profile, chapters: ChapterInput[], aims: CompetenceAim[]): Promise<ChapterInput[]>;
  /** Lager flashcards fra notatene (LaTeX). */
  generateFlashcards(req: FlashcardRequest): Promise<{ cards: RawFlashcard[]; usage: Usage }>;
}

const TOC_AIMS_PROMPT = (aims: CompetenceAim[]) => `

Fagets kompetansemål:
${aimsForPrompt(aims)}

For hvert delkapittel: sett "aims" til kodene for de 1–3 kompetansemålene delkapittelet dekker best, ut fra hva delkapittelet handler om. Bruk mål som går på tvers av kapitlene bare når delkapittelet handler om nettopp det (f.eks. forsøk eller modellering). Bruk bare kodene i listen.`;

const tocSchema = z.object({
  chapters: z.array(
    z.object({
      number: z.string().nullable(),
      title: z.string(),
      sections: z.array(z.object({ code: z.string(), title: z.string(), aims: z.array(z.string()) })),
    }),
  ),
});

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

  async extractToc(
    profile: Profile,
    images: { data: Buffer; mediaType: 'image/jpeg' | 'image/png' }[],
    aims: CompetenceAim[] = [],
  ): Promise<ChapterInput[]> {
    const client = this.requireClient();
    try {
      const msg = await client.messages.parse({
        model: this.config.model,
        max_tokens: 32_000,
        output_config: { effort: 'low', format: zodOutputFormat(tocSchema) },
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
      checkStop(msg.stop_reason);
      const parsed = msg.parsed_output;
      if (!parsed) throw new ConversionError('Klarte ikke å lese innholdsfortegnelsen.');
      return parsed.chapters.map((c) => ({ number: c.number, title: c.title, sections: c.sections }));
    } catch (err) {
      throw mapApiError(err);
    }
  }

  async mapSectionAims(profile: Profile, chapters: ChapterInput[], aims: CompetenceAim[]): Promise<ChapterInput[]> {
    const client = this.requireClient();
    const schema = z.object({ sections: z.array(z.object({ code: z.string(), aims: z.array(z.string()) })) });
    const list = chapters
      .flatMap((c) => [`${c.number ?? ''} ${c.title}`.trim(), ...(c.sections ?? []).map((s) => `  ${s.code} ${s.title}`)])
      .join('\n');
    try {
      const msg = await client.messages.parse({
        model: this.config.model,
        max_tokens: 16_000,
        output_config: { effort: 'low', format: zodOutputFormat(schema) },
        messages: [
          {
            role: 'user',
            content: `Dette er innholdsfortegnelsen (kapitler og delkapitler) i en lærebok i faget ${profile.label.toLowerCase()}:\n\n${list}${TOC_AIMS_PROMPT(aims)}\n\nSvar med én rad per delkapittel (koden slik den står over).`,
          },
        ],
      });
      checkStop(msg.stop_reason);
      const byCode = new Map((msg.parsed_output?.sections ?? []).map((s) => [s.code.trim(), s.aims]));
      return chapters.map((c) => ({
        ...c,
        sections: c.sections?.map((s) => ({ ...s, aims: byCode.get(s.code) ?? s.aims })),
      }));
    } catch (err) {
      throw mapApiError(err);
    }
  }

  async generateFlashcards(req: FlashcardRequest): Promise<{ cards: RawFlashcard[]; usage: Usage }> {
    const client = this.requireClient();
    try {
      const msg = await client.messages
        .stream({
          model: this.config.model,
          max_tokens: 64_000,
          thinking: { type: 'adaptive' },
          output_config: { effort: 'medium', format: zodOutputFormat(flashcardSchema) },
          system: [{ type: 'text', text: FLASHCARD_SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
          messages: [{ role: 'user', content: buildFlashcardPrompt(req) }],
        })
        .finalMessage();
      if (msg.stop_reason === 'refusal') throw new ConversionError('Claude avslo å lage kort av disse notatene.');
      if (msg.stop_reason === 'max_tokens') throw new ConversionError('Utvalget ble for stort. Velg færre notater eller færre kort.');
      const parsed = msg.parsed_output;
      if (!parsed) throw new ConversionError('Claude svarte ikke med kort. Prøv igjen.');
      return { cards: parsed.cards, usage: usageOf('flashcards', msg) };
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

  async extractToc(profile: Profile, _images: unknown, aims: CompetenceAim[] = []): Promise<ChapterInput[]> {
    await new Promise((r) => setTimeout(r, this.delayMs));
    return this.mapSectionAims(profile, FAKE_TOC[profile.id], aims);
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
  async mapSectionAims(_profile: Profile, chapters: ChapterInput[], aims: CompetenceAim[]): Promise<ChapterInput[]> {
    const first = aims.find((a) => !a.cross)?.code;
    return chapters.map((c) => ({ ...c, sections: c.sections?.map((s) => ({ ...s, aims: first ? [first] : [] })) }));
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

export function createClaude(config: Config): ClaudeService {
  return config.fakeClaude ? new FakeClaude() : new AnthropicClaude(config);
}
