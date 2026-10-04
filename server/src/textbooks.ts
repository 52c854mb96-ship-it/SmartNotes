import type { ChapterInput, SubjectProfile } from '@smartnotes/shared';

/** Kjente lærebøker som kan legges inn som startoppsett (fag + kapittelliste). */
export interface TextbookPreset {
  id: string;
  subjectName: string;
  textbook: string;
  profile: SubjectProfile;
  chapters: ChapterInput[];
}

export const TEXTBOOKS: Record<string, TextbookPreset> = {
  /**
   * ERGO Fysikk 1 (Aschehoug, fagfornyelsen/LK20, 2021).
   * Kapittelnavnene er hentet fra innholdsfortegnelsen (via Momentum: context/pensum-temaer.md).
   */
  'ergo-fysikk-1': {
    id: 'ergo-fysikk-1',
    subjectName: 'Fysikk 1',
    textbook: 'ERGO Fysikk 1',
    profile: 'physics',
    chapters: [
      { number: '1', title: 'Rettlinjet bevegelse' },
      { number: '2', title: 'Krefter' },
      { number: '3', title: 'Mekanisk energi' },
      { number: '4', title: 'Kollisjoner og eksplosjoner' },
      { number: '5', title: 'Termisk energi' },
      { number: '6', title: 'Bølger og stråling' },
      { number: '7', title: 'Atomfysikk' },
      { number: '8', title: 'Kjernefysikk' },
      { number: '9', title: 'Astrofysikk' },
      { number: '10', title: 'Elektrisitet' },
    ],
  },
};
