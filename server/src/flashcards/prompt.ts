import { z } from 'zod';
import type { FlashcardDifficulty, FlashcardInput, FlashcardKind } from '@smartnotes/shared';

/** Høyst så mange kort i én kortstokk. */
export const MAX_CARDS = 80;
/** Høyst så mange notater i én kortstokk. */
export const MAX_DECK_NOTES = 40;
/** Høyst så mye LaTeX (tegn) fra notatene til sammen. Mer enn dette får ikke plass i én forespørsel. */
export const MAX_SOURCE_CHARS = 400_000;

export const KINDS: FlashcardKind[] = ['concept', 'explain', 'apply'];
export const DIFFICULTIES: FlashcardDifficulty[] = ['easy', 'medium', 'hard', 'mixed'];

export interface FlashcardSourceNote {
  /** Kort alias som Claude svarer med, f.eks. «n1». */
  alias: string;
  title: string;
  /** «2 Krefter», eller null. */
  chapter: string | null;
  /** «2E Newtons 2. lov», eller null. */
  section: string | null;
  date: string | null;
  /** LaTeX-kroppen til notatet. */
  body: string;
}

export interface FlashcardRequest {
  subjectName: string;
  /** «Fysikk», «Kjemi» eller «Biologi». */
  subjectLabel: string;
  difficulty: FlashcardDifficulty;
  /** Omtrent så mange kort, eller null = Claude velger. */
  count: number | null;
  notes: FlashcardSourceNote[];
}

/** Et kort slik Claude svarer (før opprydding). */
export interface RawFlashcard {
  note: string;
  kind: string;
  front: string;
  back: string[];
  detail: string;
}

export const flashcardSchema = z.object({
  cards: z.array(
    z.object({
      note: z.string(),
      kind: z.enum(['concept', 'explain', 'apply']),
      front: z.string(),
      back: z.array(z.string()),
      detail: z.string(),
    }),
  ),
});

/** Systeminstruksen. Uten datoer og id-er, så den kan caches. */
export const FLASHCARD_SYSTEM_PROMPT = String.raw`Du lager flashcards (spørsmålskort) for en elev på videregående skole (VG2) i Norge, ut fra elevens egne notater fra undervisningen. Eleven øver slik: leser spørsmålet, svarer i hodet, snur kortet og vurderer selv hvor godt svaret var på en skala fra 1 til 4. Kort eleven ikke kunne, kommer tilbake etter noen få andre kort.

Innhold
- Lag kort bare om det som står i notatene, eller som følger direkte av dem. Ikke ta med stoff notatene ikke forklarer.
- Ett kort er én idé. Spørsmålet skal kunne besvares uten å se i notatene, og svaret skal være tydelig nok til at eleven kan vurdere seg selv.
- Dekk det viktigste i hvert notat, fordelt etter hvor mye stoff notatet har. Ikke lag to kort som spør om det samme.
- Rekkefølgen følger notatene og rekkefølgen stoffet kommer i innenfor hvert notat.
- Skriv på norsk bokmål, med fagbegrepene slik notatene og norske lærebøker bruker dem.

Korttyper ("kind")
- concept: et begrep, en definisjon, en enhet, en lov eller et faktum. «Hva er …», «Hva kalles …», «Hva er enheten for …».
- explain: forklare en sammenheng, et fenomen eller hvorfor noe skjer. «Hvorfor …», «Forklar …», «Hva skjer med … når …».
- apply: bruke stoffet på en ny situasjon, drøfte, sammenligne eller regne. I fysikk og kjemi er dette ofte en liten regneoppgave: gi tallene i spørsmålet, og la svaret vise formelen, innsettingen og svaret med enhet. Bruk tall som er enkle å regne med. I biologi er det heller et nytt eksempel, en forutsigelse eller en kort drøfting.

Forside ("front")
- Én setning, helst under 200 tegn. Ikke skriv «Spørsmål:» foran.

Bakside ("back")
- Svaret som korte punkter, ett punkt per element i listen. Stikkord er bedre enn hele setninger når det holder.
- Marker de viktigste begrepene med to stjerner: **akselerasjon**.
- Et punkt som starter med «!» blir en overskriftslinje uten punkttegn, f.eks. «!Fremgangsmåte». Bruk det sparsomt.
- Ikke gjenta spørsmålet.

Detaljert forklaring ("detail")
- 1–3 korte avsnitt (skill avsnittene med en tom linje) som forklarer svaret med egne ord, slik en god lærer ville gjort: hvorfor det er slik og hvordan det henger sammen med resten av stoffet.
- Ta gjerne med en huskeregel eller en analogi fra hverdagen når det gjør stoffet lettere å forstå og huske.
- Ikke gjenta svarpunktene ordrett.

Formler
- Skriv matematikk og symboler i LaTeX mellom enkle dollartegn: $F = m \cdot a$, $v = \frac{s}{t}$, $E_k = \frac{1}{2}mv^2$.
- Bruk bare vanlig LaTeX-matematikk (\frac, \sqrt, ^, _, \vec, \Delta, \cdot, \approx, \text{…}). Ikke bruk \qty, \SI, \num, \unit eller egne makroer fra notatene. Skriv enheter som $\text{m/s}^2$ eller $9{,}81\ \text{m/s}^2$.
- Kjemiske formler og reaksjonslikninger skrives med \ce{…} inne i dollartegn: $\ce{H2O}$, $\ce{2H2 + O2 -> 2H2O}$, $\ce{SO4^2-}$.
- Desimaltall skrives med komma, som i norske lærebøker: $9{,}81$ inne i formler og 9,81 i vanlig tekst.

Vanskelighetsgrad (oppgitt i forespørselen)
- easy (lett): mest concept, noen enkle explain. Baksiden har 1–3 korte punkter.
- medium (middels): mest explain, noen concept og noen enkle apply. Baksiden har 2–4 punkter.
- hard (vanskelig): mest apply (regning, drøfting, nye situasjoner), resten explain som krever resonnement. Baksiden har 3–6 punkter og viser hele resonnementet eller utregningen.
- mixed (blandet): omtrent like mange av hver type, med svarlengde som passer til typen.

Svar
- Svar bare med JSON etter skjemaet. "note" er id-en til notatet kortet er laget fra (f.eks. "n1").`;

/** Innholdet i brukermeldingen: notatene og hva slags kort som ønskes. */
export function buildFlashcardPrompt(req: FlashcardRequest): string {
  const lines: string[] = [];
  lines.push(`Fag: ${req.subjectName} (${req.subjectLabel.toLowerCase()})`);
  lines.push(`Vanskelighetsgrad: ${req.difficulty}`);
  if (req.count) lines.push(`Antall kort: omtrent ${req.count} til sammen.`);
  else
    lines.push(
      `Antall kort: velg selv ut fra hvor mye stoff notatene har, omtrent 5–12 kort per notat og høyst ${Math.min(MAX_CARDS, 60)} til sammen.`,
    );
  lines.push('', '<notes>');
  for (const n of req.notes) {
    const attrs = [`id="${n.alias}"`, `title="${attr(n.title)}"`];
    if (n.chapter) attrs.push(`chapter="${attr(n.chapter)}"`);
    if (n.section) attrs.push(`section="${attr(n.section)}"`);
    if (n.date) attrs.push(`date="${n.date}"`);
    lines.push(`<note ${attrs.join(' ')}>`, n.body.trim(), '</note>');
  }
  lines.push('</notes>', '', 'Lag kortene.');
  return lines.join('\n');
}

const attr = (s: string) => s.replace(/"/g, "'").replace(/[\r\n]+/g, ' ');

/** Fjerner det i LaTeX-koden som ikke er stoff (kommentarer, figurplassering), så forespørselen blir kortere. */
export function noteSourceText(body: string): string {
  return body
    .split('\n')
    .filter((l) => !/^\s*%/.test(l))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

const clip = (s: string, max: number) => (s.length > max ? `${s.slice(0, max - 1).trimEnd()}…` : s);

/**
 * Rydder i kortene fra Claude: kjente korttyper, ikke tomme felter, rimelige lengder, ingen like spørsmål og høyst
 * MAX_CARDS kort. Notat-aliasene oversettes til notat-id-er (ukjent alias = null).
 */
export function cleanFlashcards(raw: RawFlashcard[], aliases: Map<string, string>): (FlashcardInput & { noteId: string | null })[] {
  const out: (FlashcardInput & { noteId: string | null })[] = [];
  const seen = new Set<string>();
  for (const c of raw) {
    const front = clip(c.front.trim(), 500);
    const back = c.back
      .map((l) => clip(l.trim(), 500))
      .filter((l) => l.length > 0 && l !== '!')
      .slice(0, 12);
    if (!front || back.length === 0) continue;
    const key = front.toLowerCase().replace(/\s+/g, ' ');
    if (seen.has(key)) continue;
    seen.add(key);
    const kind = (KINDS as string[]).includes(c.kind) ? (c.kind as FlashcardKind) : 'concept';
    out.push({ kind, front, back, detail: clip(c.detail.trim(), 4000), noteId: aliases.get(c.note.trim()) ?? null });
    if (out.length >= MAX_CARDS) break;
  }
  return out;
}

/** Navn på en kortstokk når brukeren ikke har gitt et. */
export function defaultDeckTitle(notes: { title: string; chapter: { number: string | null; title: string } | null }[]): string {
  if (notes.length === 1) return clip(notes[0]!.title.trim() || 'Notat uten tittel', 120);
  const chapters = new Set(notes.map((n) => (n.chapter ? `${n.chapter.number ?? ''}|${n.chapter.title}` : '')));
  const first = notes[0]?.chapter;
  if (chapters.size === 1 && first) return clip(`${first.number ? `${first.number} ` : ''}${first.title}`, 120);
  return `${notes.length} notater`;
}
