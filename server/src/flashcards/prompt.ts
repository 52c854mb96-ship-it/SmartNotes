import { z } from 'zod';
import type { FlashcardChoices, FlashcardDifficulty, FlashcardInput, FlashcardKind } from '@smartnotes/shared';

/** Høyst så mange kort i én kortstokk. */
export const MAX_CARDS = 80;
/** Høyst så mange notater i én kortstokk. */
export const MAX_DECK_NOTES = 40;
/** Høyst så mye LaTeX (tegn) fra notatene til sammen. Mer enn dette får ikke plass i én forespørsel. */
export const MAX_SOURCE_CHARS = 400_000;

/** Antall gale svar i et flervalg (med det riktige blir det fire alternativer). */
export const WRONG_CHOICES = 3;
/** Høyst så mange tegn i ett svaralternativ: flervalg er korte svar på én linje. */
export const MAX_CHOICE_CHARS = 150;

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
  /**
   * Lag også svaralternativer (flervalg) til kortene. Bare når eleven har krysset av for det; utelatt eller false gir
   * nøyaktig samme instruks, brukermelding og skjema som før flervalg fantes (ingen ekstra kostnad).
   */
  withChoices?: boolean;
}

/** Svaralternativer slik AI-en svarer (før opprydding). */
export interface RawChoices {
  correct: string;
  wrong: string[];
}

/** Et kort slik Claude svarer (før opprydding). */
export interface RawFlashcard {
  note: string;
  kind: string;
  front: string;
  back: string[];
  detail: string;
  /** Bare når forespørselen ba om svaralternativer (`withChoices`); null for kort som ikke passer til flervalg. */
  choices?: RawChoices | null;
}

const rawChoicesSchema = z.object({ correct: z.string(), wrong: z.array(z.string()) });

const cardShape = {
  note: z.string(),
  kind: z.enum(['concept', 'explain', 'apply']),
  front: z.string(),
  back: z.array(z.string()),
  detail: z.string(),
};

/** Skjemaet for kortene, uten svaralternativer (som før flervalg fantes). */
export const flashcardSchema = z.object({ cards: z.array(z.object(cardShape)) });

/** Skjemaet når eleven har bedt om svaralternativer: hvert kort har også `choices`, som er null når kortet ikke passer. */
export const flashcardChoicesSchema = z.object({ cards: z.array(z.object({ ...cardShape, choices: rawChoicesSchema.nullable() })) });

/** Skjemaet som sendes til AI-en og brukes til å lese svaret. */
export function flashcardSchemaFor(withChoices: boolean | undefined): typeof flashcardSchema | typeof flashcardChoicesSchema {
  return withChoices ? flashcardChoicesSchema : flashcardSchema;
}

/** Et kort som skal få svaralternativer (jobben for en kortstokk som finnes). Bare kortets tekst, ikke notatene. */
export interface ChoicesSourceCard {
  /** Kort alias som AI-en svarer med, f.eks. «k1». */
  alias: string;
  kind: FlashcardKind;
  front: string;
  back: string[];
}

export interface ChoicesRequest {
  subjectName: string;
  /** «Fysikk», «Kjemi», «Biologi» eller «Geofag». */
  subjectLabel: string;
  cards: ChoicesSourceCard[];
}

/** Svaralternativene til ett kort slik AI-en svarer (før opprydding). */
export interface RawCardChoices {
  /** Aliaset til kortet («k1»). */
  card: string;
  choices: RawChoices | null;
}

/** Svaret på `AiService.generateChoices`. */
export const choicesSchema = z.object({ cards: z.array(z.object({ card: z.string(), choices: rawChoicesSchema.nullable() })) });

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
- Marker 1–3 korte nøkkelbegreper per kort med to stjerner: **akselerasjon**. Et nøkkelbegrep er ett til tre ord (et fagord, navnet på en enhet som newton eller joule, eller et navn), aldri en hel setning eller en formel. Marker helst begreper som ikke står i spørsmålet. Eleven kan øve med luketekst, der et markert begrep byttes ut med et tomt felt eleven skal fylle ut.
- Et punkt som starter med «!» blir en overskriftslinje uten punkttegn, f.eks. «!Fremgangsmåte». Bruk det sparsomt.
- Ikke gjenta spørsmålet.

Detaljert forklaring ("detail")
- 1–3 korte avsnitt (skill avsnittene med en tom linje) som forklarer svaret med egne ord, slik en god lærer ville gjort: hvorfor det er slik og hvordan det henger sammen med resten av stoffet.
- Ta gjerne med en huskeregel eller en analogi fra hverdagen når det gjør stoffet lettere å forstå og huske.
- Ikke gjenta svarpunktene ordrett.

Formler
- Skriv matematikk og symboler i LaTeX mellom enkle dollartegn: $F = m \cdot a$, $v = \frac{s}{t}$, $E_k = \frac{1}{2}mv^2$.
- Bruk bare vanlig LaTeX-matematikk (\frac, \sqrt, ^, _, \vec, \Delta, \cdot, \approx, \text{…}). Skriv enheter som $\text{m/s}^2$ eller $9{,}81\ \text{m/s}^2$.
- Notatene bruker egne makroer som ikke kan vises på kortene. Skriv dem om: \dv{v}{t} → \frac{\mathrm{d}v}{\mathrm{d}t}, \pdv → \frac{\partial …}{\partial …}, \vb{F} → \vec{F}, \abs{x} → |x|, \enhet{m/s} → [\text{m/s}]. Ikke bruk \qty, \SI, \num, \unit eller andre makroer fra notatene.
- Kjemiske formler og reaksjonslikninger skrives med \ce{…} inne i dollartegn: $\ce{H2O}$, $\ce{2H2 + O2 -> 2H2O}$, $\ce{SO4^2-}$. Ikke bruk \chemfig: skriv strukturen som en kondensert formel i \ce{…} ($\ce{CH3CH2OH}$) eller beskriv den med ord.
- Desimaltall skrives med komma, som i norske lærebøker: $9{,}81$ inne i formler og 9,81 i vanlig tekst.

Vanskelighetsgrad (oppgitt i forespørselen)
- easy (lett): mest concept, noen enkle explain. Baksiden har 1–3 korte punkter.
- medium (middels): mest explain, noen concept og noen enkle apply. Baksiden har 2–4 punkter.
- hard (vanskelig): mest apply (regning, drøfting, nye situasjoner), resten explain som krever resonnement. Baksiden har 3–6 punkter og viser hele resonnementet eller utregningen.
- mixed (blandet): omtrent like mange av hver type, med svarlengde som passer til typen.

Svar
- Svar bare med JSON etter skjemaet. "note" er id-en til notatet kortet er laget fra (f.eks. "n1").`;

/**
 * Reglene for svaralternativene, felles for nye kortstokker med `withChoices` og jobben for en kortstokk som finnes.
 * Formlene har egne regler i hver instruks.
 */
const CHOICE_RULES = String.raw`- "correct" er det riktige svaret kort, på én linje (helst under 80 tegn, høyst ${MAX_CHOICE_CHARS}): et begrep, et tall med enhet, en formel eller en kort setning. Det skal si det samme som svaret på kortet.
- For en regneoppgave er "correct" sluttsvaret (tallet med enhet, eller uttrykket oppgaven ber om), ikke utregningen, også når svaret på kortet viser hele utregningen. De gale svarene er sluttsvar eleven får med typiske regnefeil: glemt kvadrat eller faktor, feil prefiks eller enhet, feil fortegn, eller teller og nevner byttet om.
- "wrong" er nøyaktig tre gale svar som ligner det riktige og virker troverdige for en elev som ikke kan stoffet godt: typiske misforståelser, feil enhet, et begrep som lett forveksles, eller årsak og virkning byttet om.
- Det riktige svaret bygger bare på kortet. De gale svarene kan hente begreper, enheter og verdier fra faget på VG2-nivå som eleven lett forveksler med det riktige, også når de ikke står på kortet eller i notatene.
- Et galt svar må aldri også være riktig: heller ikke med andre ord, med en annen enhet for den samme verdien, som en avrunding, som et annet riktig svar når spørsmålet har flere («Nevn et eksempel på …»: er svaret «neon», kan ikke «argon» være galt), som en del av det riktige svaret, eller som et mer generelt svar som også stemmer («kovalent binding» når svaret er «polar kovalent binding»). De fire alternativene skal være ulike.
- Alle fire har samme form og omtrent samme lengde (er det riktige et tall med enhet, er de gale det også), så formen ikke røper svaret. Ikke bruk «alle svarene over», «ingen av dem» eller tullesvar.
- Ikke bruk **fet** skrift eller «!»-linjer i alternativene.
- Sett "choices" til null for kort uten ett kort svar på én linje, for eksempel åpne drøftinger, forklaringer i flere ledd og «vis at»-oppgaver der svaret er en hel utledning, og når det ikke finnes tre troverdige gale svar som er sikkert gale.`;

/** Delen om svaralternativer i instruksen for nye kort. Bare med når eleven har bedt om dem (`withChoices`). */
const CHOICES_SECTION = String.raw`Svaralternativer ("choices")
- Eleven vil også øve med flervalg: spørsmålet vises med fire alternativer i tilfeldig rekkefølge, der ett er riktig og tre er gale. Lag svaralternativer til hvert kort der det passer.
${CHOICE_RULES}
- Skriv formler og enheter i alternativene etter de samme reglene som på kortene (se «Formler»).`;

/**
 * Systeminstruksen for nye kort. Uten `withChoices` er den nøyaktig FLASHCARD_SYSTEM_PROMPT (som før flervalg fantes);
 * med den kommer delen «Svaralternativer» rett før «Svar».
 */
export function flashcardSystemPrompt(withChoices: boolean | undefined): string {
  if (!withChoices) return FLASHCARD_SYSTEM_PROMPT;
  const at = FLASHCARD_SYSTEM_PROMPT.lastIndexOf('\n\nSvar\n');
  return `${FLASHCARD_SYSTEM_PROMPT.slice(0, at)}\n\n${CHOICES_SECTION}${FLASHCARD_SYSTEM_PROMPT.slice(at)}`;
}

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
  if (req.withChoices) lines.push('Svaralternativer: ja. Lag "choices" til kortene som passer til flervalg, og sett null på resten.');
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

/** Systeminstruksen for svaralternativer til kort som finnes (`AiService.generateChoices`). Uten datoer og id-er. */
export const CHOICES_SYSTEM_PROMPT = String.raw`Du lager svaralternativer til flervalg for en elev på videregående skole (VG2) i Norge. Eleven har flashcards med et spørsmål (forside) og et svar (bakside), laget fra egne notater fra undervisningen. Nå vil eleven også øve med flervalg: spørsmålet vises med fire alternativer i tilfeldig rekkefølge, der ett er riktig og tre er gale.

For hvert kort
${CHOICE_RULES}
- Skriv på norsk bokmål, med de samme fagbegrepene som kortet.

Formler
- Skriv matematikk og symboler i LaTeX mellom enkle dollartegn, som på kortene: $F = m \cdot a$, $9{,}81\ \text{m/s}^2$.
- Bruk bare vanlig LaTeX-matematikk (\frac, \sqrt, ^, _, \vec, \Delta, \cdot, \approx, \text{…}). Ikke bruk \qty, \SI, \num, \unit eller lignende makroer for tall og enheter (kortene kan ikke vise dem).
- Kjemiske formler skrives med \ce{…} inne i dollartegn: $\ce{H2O}$, $\ce{SO4^2-}$.
- Desimaltall skrives med komma, som i norske lærebøker: $9{,}81$ inne i formler og 9,81 i vanlig tekst.

Svar
- Svar bare med JSON etter skjemaet, med én rad per kort. "card" er id-en til kortet (f.eks. "k1").`;

/** Brukermeldingen for svaralternativer: faget og kortene (spørsmål og svar). */
export function buildChoicesPrompt(req: ChoicesRequest): string {
  const lines: string[] = [`Fag: ${req.subjectName} (${req.subjectLabel.toLowerCase()})`, '', '<cards>'];
  for (const c of req.cards) {
    lines.push(`<card id="${c.alias}" kind="${c.kind}">`, `Spørsmål: ${c.front.trim()}`, 'Svar:', ...c.back.map((l) => `- ${l.trim()}`), '</card>');
  }
  lines.push('</cards>', '', 'Lag svaralternativer til kortene.');
  return lines.join('\n');
}

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
 * MAX_CARDS kort. Notat-aliasene oversettes til notat-id-er (ukjent alias = null). Svaralternativene ryddes med
 * `cleanChoices` (null når kortet ikke har brukbare alternativer, og alltid uten `withChoices`).
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
    out.push({ kind, front, back, detail: clip(c.detail.trim(), 4000), choices: cleanChoices(c.choices), noteId: aliases.get(c.note.trim()) ?? null });
    if (out.length >= MAX_CARDS) break;
  }
  return out;
}

/**
 * Et svaralternativ slik det sammenlignes: uten mellomrom (også LaTeX-mellomrom som \, og ~), **fet**-markering,
 * dollartegn rundt formler, \text{…} og \mathrm{…} rundt enheter og punktum eller utropstegn til slutt, og med {,} som
 * komma. «2,0 m/s.», «2,0m/s» og «$2{,}0\ \text{m/s}$» er da det samme svaret, og en formel uten innhold («$ $») er tom.
 * Store og små bokstaver teller, for i realfag er «2,0 mJ» og «2,0 MJ» (eller CO og Co) ulike svar. Appen bruker den
 * samme regelen når eleven redigerer (web/src/flashcards/choices.ts).
 */
export function normalizeChoice(s: string): string {
  return s
    .normalize('NFC')
    .replace(/\*\*/g, '')
    .replace(/\\(?:[,;:! ]|q?quad\b)|~/g, '')
    .replace(/\{,\}/g, ',')
    .replace(/\\(?:text|mathrm)\{([^{}]*)\}/g, '$1')
    .replace(/(?<!\\)\$/g, '')
    .replace(/\s+/g, '')
    .replace(/[.!]+$/, '');
}

/**
 * Hva som er galt med et sett svaralternativer (norsk melding til eleven), eller null når det kan brukes: et riktig svar,
 * tre gale svar som ikke er tomme, er ulike og ikke er like det riktige, og ingen lengre enn MAX_CHOICE_CHARS.
 */
export function choicesProblem(c: FlashcardChoices): string | null {
  const blank = 'eller la alle feltene for svaralternativer stå tomme.';
  if (!normalizeChoice(c.correct)) return `Skriv det riktige svaret kort, ${blank}`;
  if (c.wrong.length !== WRONG_CHOICES || c.wrong.some((w) => !normalizeChoice(w))) return `Skriv tre gale svar, ${blank}`;
  if ([c.correct, ...c.wrong].some((x) => x.length > MAX_CHOICE_CHARS)) return `Et svaralternativ kan ha høyst ${MAX_CHOICE_CHARS} tegn.`;
  const correct = normalizeChoice(c.correct);
  const wrong = c.wrong.map(normalizeChoice);
  if (wrong.includes(correct)) return 'Et galt svar kan ikke være likt det riktige svaret.';
  if (new Set(wrong).size !== wrong.length) return 'De tre gale svarene må være ulike.';
  return null;
}

/** Et svaralternativ fra AI-en på én linje og uten **fet** skrift (den ville røpe hvilket alternativ som er riktig). */
const choiceLine = (s: string) => s.replace(/\*\*/g, '').replace(/\s+/g, ' ').trim();

/** Like mange $ som åpner og lukker formler; ellers vises formelen som rå LaTeX på kortet. */
const balancedMath = (s: string) => (s.match(/(?<!\\)\$/g)?.length ?? 0) % 2 === 0;

const usableChoice = (s: string) => normalizeChoice(s).length > 0 && s.length <= MAX_CHOICE_CHARS && balancedMath(s);

/**
 * Rydder i svaralternativene fra AI-en: ett riktig svar og de tre første gale svarene som er brukbare (ikke tomme, høyst
 * MAX_CHOICE_CHARS tegn, hele formler), ulike og ikke like det riktige etter `normalizeChoice`. Er det riktige svaret
 * ubrukelig, eller er det færre enn tre gale svar igjen, får kortet ingen alternativer (null).
 */
export function cleanChoices(raw: RawChoices | null | undefined): FlashcardChoices | null {
  if (!raw || typeof raw.correct !== 'string' || !Array.isArray(raw.wrong)) return null;
  const correct = choiceLine(raw.correct);
  if (!usableChoice(correct)) return null;
  const seen = new Set([normalizeChoice(correct)]);
  const wrong: string[] = [];
  for (const w of raw.wrong) {
    if (typeof w !== 'string') continue;
    const line = choiceLine(w);
    const key = normalizeChoice(line);
    if (!usableChoice(line) || seen.has(key)) continue;
    seen.add(key);
    wrong.push(line);
    if (wrong.length === WRONG_CHOICES) break;
  }
  const choices = { correct, wrong };
  return choicesProblem(choices) === null ? choices : null;
}

/**
 * Svaralternativene fra jobben for en kortstokk som finnes, koblet til kortene: bare aliaser som ble sendt med (`cards`),
 * første brukbare svar per kort, og bare alternativer som holder (`cleanChoices`). Kort uten brukbare alternativer er ikke
 * med.
 */
export function cleanCardChoices<T>(raw: RawCardChoices[], cards: Map<string, T>): { card: T; choices: FlashcardChoices }[] {
  const out: { card: T; choices: FlashcardChoices }[] = [];
  const done = new Set<string>();
  for (const r of raw) {
    const alias = r.card.trim();
    const card = cards.get(alias);
    if (card === undefined || done.has(alias)) continue;
    const choices = cleanChoices(r.choices);
    if (!choices) continue;
    done.add(alias);
    out.push({ card, choices });
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
