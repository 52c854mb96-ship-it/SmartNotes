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
   * Kapittelnavnene er hentet fra løsningsforslag og kortsett på nett, ikke fra forlaget direkte –
   * sjekk mot boka og rett i appen (Fag → Innstillinger) om noe avviker.
   */
  'ergo-fysikk-1': {
    id: 'ergo-fysikk-1',
    subjectName: 'Fysikk 1',
    textbook: 'ERGO Fysikk 1',
    profile: 'physics',
    chapters: [
      { number: '1', title: 'Bevegelse' },
      { number: '2', title: 'Krefter' },
      { number: '3', title: 'Mekanisk energi' },
      { number: '4', title: 'Bevegelsesmengde' },
      { number: '5', title: 'Termisk energi og trykk' },
      { number: '6', title: 'Bølger og stråling' },
      { number: '7', title: 'Atomfysikk' },
      { number: '8', title: 'Kjernefysikk' },
      { number: '9', title: 'Astrofysikk' },
      { number: '10', title: 'Elektrisitet' },
    ],
  },
};
