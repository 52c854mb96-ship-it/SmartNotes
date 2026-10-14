import type { FlashcardDifficulty, FlashcardKind } from '@smartnotes/shared';
import type { PracticeMode } from '../db';

export const KIND_LABEL: Record<FlashcardKind, string> = {
  concept: 'Begrep',
  explain: 'Forklaring',
  apply: 'Anvendelse',
};

/** Til filteret «Korttype». */
export const KIND_FILTER_LABEL: Record<FlashcardKind, string> = {
  concept: 'Bare begreper',
  explain: 'Bare forklaringer',
  apply: 'Bare anvendelse',
};

export const KIND_HINT: Record<FlashcardKind, string> = {
  concept: 'Et begrep, en definisjon eller et faktum.',
  explain: 'Forklare en sammenheng eller hvorfor noe skjer.',
  apply: 'Bruke stoffet: drøfte, overføre eller regne.',
};

export const KINDS: FlashcardKind[] = ['concept', 'explain', 'apply'];

export const DIFFICULTY_LABEL: Record<FlashcardDifficulty, string> = {
  easy: 'Lett',
  medium: 'Middels',
  hard: 'Vanskelig',
  mixed: 'Blandet',
};

export const DIFFICULTY_HINT: Record<FlashcardDifficulty, string> = {
  easy: 'Begreper og fakta. Korte svar.',
  medium: 'Forklare sammenhenger. Svar med noen punkter.',
  hard: 'Bruke stoffet: drøfte og regne. Utfyllende svar.',
  mixed: 'Litt av alt, med svar som passer til spørsmålet.',
};

export const DIFFICULTIES: FlashcardDifficulty[] = ['easy', 'medium', 'hard', 'mixed'];

/** Valgene for antall kort. null = la Claude velge. */
export const COUNT_CHOICES: (number | null)[] = [null, 10, 20, 30, 50];

/** Øvingsformene, i rekkefølgen velgeren viser dem. */
export const MODES: PracticeMode[] = ['mastery', 'quick', 'classic', 'cloze'];

export const MODE_LABEL: Record<PracticeMode, string> = {
  mastery: 'Mestring',
  quick: 'Rask runde',
  classic: 'Klassisk',
  cloze: 'Luketekst',
};

/** Én forklarende linje under velgeren «Øvingsform». */
export const MODE_HINT: Record<PracticeMode, string> = {
  mastery: 'Grundig: kortene kommer igjen til du har svart riktig flere ganger. Tar lengst tid.',
  quick: 'Ett riktig svar per kort. Kortene du ikke kunne, kommer igjen til slutt.',
  classic: 'Snu og gå videre. Endrer ikke mestringen.',
  cloze: 'Skriv begrepet som mangler i svaret. Riktige svar teller litt, men gjør aldri et kort mestret.',
};
