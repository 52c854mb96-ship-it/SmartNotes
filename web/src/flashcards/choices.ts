/**
 * Svaralternativene (flervalg) i redigeringen av et kort: feltene «Kort riktig svar» og tre «Gale svar». Reglene og
 * meldingene er de samme som serverens (`normalizeChoice` og `choicesProblem` i server/src/flashcards/prompt.ts, og
 * `choiceText` i routes/flashcards.ts), så eleven får feilen før kortet sendes, og serveren aldri svarer annerledes.
 */
import type { FlashcardChoices } from '@smartnotes/shared';

/** Antall gale svar i et sett svaralternativer. */
export const WRONG_CHOICES = 3;
/** Høyst så mange tegn i ett svaralternativ: flervalg er korte svar på én linje. */
export const MAX_CHOICE_CHARS = 150;

/** Feltene i redigeringen, slik eleven skrev dem. */
export interface ChoiceFields {
  correct: string;
  /** Alltid WRONG_CHOICES felt. */
  wrong: string[];
}

/** Feltet en feil gjelder: det riktige svaret, eller det gale svaret med denne plassen (0–2). */
export type ChoiceField = 'correct' | number;

export type ChoicesResult =
  /** `choices` er null når alle feltene er tomme: kortet har ingen svaralternativer. */
  | { ok: true; choices: FlashcardChoices | null }
  /** En norsk melding til eleven, og det første feltet den gjelder. */
  | { ok: false; error: string; field: ChoiceField };

/** Feltene for et kort: alternativene det har, eller tomme felt. Gir alltid tre felt for gale svar. */
export function choiceFieldsOf(choices: FlashcardChoices | null | undefined): ChoiceFields {
  const wrong = Array.from({ length: WRONG_CHOICES }, (_, i) => choices?.wrong[i] ?? '');
  return { correct: choices?.correct ?? '', wrong };
}

/** Et svaralternativ står på én linje: linjeskift og doble mellomrom blir ett mellomrom (som på serveren). */
export function choiceLine(s: string): string {
  return s.replace(/\s+/g, ' ').trim();
}

/**
 * Et svaralternativ slik det sammenlignes: uten mellomrom (også LaTeX-mellomrom som \, og ~), **fet**-markering,
 * dollartegn rundt formler, \text{…} og \mathrm{…} rundt enheter og punktum eller utropstegn til slutt, og med {,} som
 * komma. «2,0 m/s.», «2,0m/s» og «$2{,}0\ \text{m/s}$» er da det samme svaret, og en formel uten innhold («$ $») er tom.
 * Store og små bokstaver teller, for i realfag er «2,0 mJ» og «2,0 MJ» (eller CO og Co) ulike svar. Samme regel som
 * `normalizeChoice` på serveren.
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
 * Om eleven har endret svaralternativene fra det redigeringen startet med (`original`, kortets alternativer). Bare da
 * sendes de når kortet lagres: utelatt betyr «uendret» på serveren, så alternativer som en jobb har lagret mens skjemaet
 * sto åpent, blir stående. Mellomrom i endene og doble mellomrom teller ikke som en endring (`choiceLine`).
 */
export function choicesChanged(original: FlashcardChoices | null | undefined, fields: ChoiceFields): boolean {
  const start = choiceFieldsOf(original);
  if (choiceLine(start.correct) !== choiceLine(fields.correct)) return true;
  return start.wrong.some((w, i) => choiceLine(w) !== choiceLine(fields.wrong[i] ?? ''));
}

/**
 * Leser feltene: alle tomme gir ingen alternativer (null). Ellers trengs et riktig svar og tre gale som ikke er tomme,
 * høyst MAX_CHOICE_CHARS tegn hver, ingen gale like det riktige og ingen like hverandre (etter `normalizeChoice`).
 * Tekstene kommer tilbake på én linje (`choiceLine`), klare til å sendes. Meldingene og rekkefølgen de sjekkes i, er
 * serverens.
 */
export function readChoiceFields(fields: ChoiceFields): ChoicesResult {
  const correct = choiceLine(fields.correct);
  const wrong = Array.from({ length: WRONG_CHOICES }, (_, i) => choiceLine(fields.wrong[i] ?? ''));
  if (!correct && wrong.every((w) => !w)) return { ok: true, choices: null };

  const blank = 'eller la alle feltene for svaralternativer stå tomme.';
  if (!normalizeChoice(correct)) return { ok: false, error: `Skriv det riktige svaret kort, ${blank}`, field: 'correct' };
  const empty = wrong.findIndex((w) => !normalizeChoice(w));
  if (empty >= 0) return { ok: false, error: `Skriv tre gale svar, ${blank}`, field: empty };

  const all = [correct, ...wrong];
  const long = all.findIndex((x) => x.length > MAX_CHOICE_CHARS);
  if (long >= 0) {
    const error = `Et svaralternativ kan ha høyst ${MAX_CHOICE_CHARS} tegn.`;
    return { ok: false, error, field: long === 0 ? 'correct' : long - 1 };
  }
  const key = normalizeChoice(correct);
  const keys = wrong.map(normalizeChoice);
  const same = keys.indexOf(key);
  if (same >= 0) return { ok: false, error: 'Et galt svar kan ikke være likt det riktige svaret.', field: same };
  const dup = keys.findIndex((k, i) => keys.indexOf(k) !== i);
  if (dup >= 0) return { ok: false, error: 'De tre gale svarene må være ulike.', field: dup };
  return { ok: true, choices: { correct, wrong } };
}
