import type { FlashcardDifficulty, FlashcardKind } from '@smartnotes/shared';

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
