/**
 * Felles grensesnitt for AI-en appen bruker, uavhengig av hvem som kjører modellen: Claude (Anthropic), en lokal modell
 * (Ollama) eller den falske AI-en i testene. `createAi` velger leverandør per oppgave ut fra konfigurasjonen.
 */
import type { ChapterInput, CompetenceAim } from '@smartnotes/shared';
import { z } from 'zod';
import type { Config } from '../config.js';
import type { FlashcardRequest, RawFlashcard } from '../flashcards/prompt.js';
import type { Profile } from '../profiles/index.js';
import { aimsForPrompt } from '../toc.js';
import type { Usage } from '../usage.js';
import type { NoteMeta } from './parse.js';

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

export interface AiService {
  readonly configured: boolean;
  readonly model: string;
  readonly fake: boolean;
  /** Hvem som kjører modellen: «anthropic», «ollama» eller «fake» (for forbruksloggen og prisberegningen). */
  readonly provider: string;
  convert(req: ConvertRequest): Promise<ConvertResult>;
  fix(req: FixRequest): Promise<{ body: string; usage: Usage }>;
  /** Leser kapitler og delkapitler fra bilder av innholdsfortegnelsen, og kobler delkapitlene til `aims` (hvis noen). */
  extractToc(
    profile: Profile,
    images: { data: Buffer; mediaType: 'image/jpeg' | 'image/png' }[],
    aims?: CompetenceAim[],
  ): Promise<{ chapters: ChapterInput[]; usage: Usage }>;
  /** Kobler delkapitlene (fra innlimt tekst) til kompetansemålene. Gir tilbake de samme kapitlene med `aims` fylt inn. */
  mapSectionAims(profile: Profile, chapters: ChapterInput[], aims: CompetenceAim[]): Promise<{ chapters: ChapterInput[]; usage: Usage }>;
  /** Lager flashcards fra notatene (LaTeX). */
  generateFlashcards(req: FlashcardRequest): Promise<{ cards: RawFlashcard[]; usage: Usage }>;
}

export const TOC_AIMS_PROMPT = (aims: CompetenceAim[]) => `

Fagets kompetansemål:
${aimsForPrompt(aims)}

For hvert delkapittel: sett "aims" til kodene for de 1–3 kompetansemålene delkapittelet dekker best, ut fra hva delkapittelet handler om. Bruk mål som går på tvers av kapitlene bare når delkapittelet handler om nettopp det (f.eks. forsøk eller modellering). Bruk bare kodene i listen.`;

export const tocSchema = z.object({
  chapters: z.array(
    z.object({
      number: z.string().nullable(),
      title: z.string(),
      sections: z.array(z.object({ code: z.string(), title: z.string(), aims: z.array(z.string()) })),
    }),
  ),
});

// ---------- Felles for alle leverandører ----------

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
