import type { ChapterInput, CompetenceAim, Section, SubjectProfile } from '@smartnotes/shared';

/** Kjente lærebøker som kan legges inn som startoppsett (fag + kapitler + delkapitler + kompetansemål). */
export interface TextbookPreset {
  id: string;
  subjectName: string;
  textbook: string;
  profile: SubjectProfile;
  aims: CompetenceAim[];
  chapters: (ChapterInput & { sections: Section[] })[];
}

/** Kompetansemål i Fysikk 1 (FYS01-02, LK20). Kilde: Udir, via Momentum (context/kompetansemaal.md). */
const FYSIKK1_AIMS: CompetenceAim[] = [
  { code: 'KM1', text: 'planlegge og gjennomføre forsøk, analysere data og trekke konklusjoner', cross: true },
  { code: 'KM2', text: 'vurdere, bruke og lage modeller til å beskrive og forutsi fysiske fenomener', cross: true },
  { code: 'KM3', text: 'vurdere ulike påstander og argumenter om energi og klima i samfunnsaktuelle problemstillinger', cross: false },
  { code: 'KM4', text: 'utforske, analysere og beskrive rettlinjet bevegelse', cross: false },
  { code: 'KM5', text: 'forstå sammenhenger mellom krefter, bevegelse og energi, og bruke dem til å gjøre beregninger', cross: false },
  {
    code: 'KM6',
    text: 'bruke numeriske metoder og programmering til å modellere og utforske bevegelse i situasjoner der akselerasjonen ikke er konstant',
    cross: true,
  },
  {
    code: 'KM7',
    text: 'forstå og gjøre rede for konsekvenser av at bevegelsesmengde og energi er bevart, og bruke dette i beregninger',
    cross: false,
  },
  {
    code: 'KM8',
    text: 'utforske hvordan energi kan gå fra en form til en annen, og vurdere energikvalitet og virkningsgrad i slike overganger',
    cross: false,
  },
  {
    code: 'KM9',
    text: 'gjøre rede for sammenhengene mellom ladning, spenning og elektrisk energi og utforske effektomsetning i elektriske kretser',
    cross: false,
  },
  {
    code: 'KM10',
    text: 'forstå begrepet temperatur og forklare hvordan tilført varme til et system fører til temperaturendring i dette systemet',
    cross: false,
  },
  { code: 'KM11', text: 'utforske, sammenligne og beskrive stråling fra legemer med ulik temperatur og overflate', cross: false },
  {
    code: 'KM12',
    text: 'bruke modeller av strålingsbalansen til jorda til å gjøre beregninger, og vurdere hvordan endringer på jordoverflaten og i atmosfæren påvirker denne balansen',
    cross: false,
  },
  { code: 'KM13', text: 'beskrive ulike atommodeller og drøfte hvordan observerbare effekter støtter eller utfordrer dem', cross: false },
  { code: 'KM14', text: 'forstå begrepet fusjon og vurdere hvordan ulike grunnstoff kan dannes når stjerner lever, kolliderer og dør', cross: false },
];

const s = (code: string, title: string, aims: string[]): Section => ({ code, title, aims });

export const TEXTBOOKS: Record<string, TextbookPreset> = {
  /**
   * ERGO Fysikk 1 (Aschehoug, fagfornyelsen/LK20, 2021). Kapitler og delkapitler fra innholdsfortegnelsen,
   * koblingen til kompetansemål fra Momentum (context/pensum-temaer.md og scripts/seed.ts).
   * 7D Drivhuseffekten og 7E Atomets historie er ute av pensum og er ikke tatt med.
   */
  'ergo-fysikk-1': {
    id: 'ergo-fysikk-1',
    subjectName: 'Fysikk 1',
    textbook: 'ERGO Fysikk 1',
    profile: 'physics',
    aims: FYSIKK1_AIMS,
    chapters: [
      {
        number: '1',
        title: 'Rettlinjet bevegelse',
        sections: [
          s('1A', 'Fysikk som målefag', ['KM1', 'KM2']),
          s('1B', 'På rett vei', ['KM4']),
          s('1C', 'Grafisk framstilling', ['KM4']),
          s('1D', 'Konstant akselerasjon', ['KM4', 'KM5']),
          s('1E', 'Simulering av bevegelse', ['KM1', 'KM4', 'KM6']),
        ],
      },
      {
        number: '2',
        title: 'Krefter',
        sections: [
          s('2A', 'Krefter', ['KM5']),
          s('2B', 'Newtons 1. lov', ['KM5']),
          s('2C', 'Friksjon og luftmotstand', ['KM5']),
          s('2D', 'Newtons 3. lov', ['KM5']),
          s('2E', 'Newtons 2. lov', ['KM5']),
          s('2F', 'Når kreftene ikke er konstante', ['KM5', 'KM6']),
        ],
      },
      {
        number: '3',
        title: 'Mekanisk energi',
        sections: [
          s('3A', 'Energi', ['KM5', 'KM8']),
          s('3B', 'Arbeid', ['KM5', 'KM8']),
          s('3C', 'Potensiell energi', ['KM5', 'KM7']),
          s('3D', 'Kinetisk energi', ['KM5', 'KM7']),
          s('3E', 'Bevaring av mekanisk energi', ['KM5', 'KM7', 'KM8']),
          s('3F', 'Endring i mekanisk energi', ['KM5', 'KM7', 'KM8']),
        ],
      },
      {
        number: '4',
        title: 'Kollisjoner og eksplosjoner',
        sections: [
          s('4A', 'Bevegelsesmengde', ['KM7']),
          s('4B', 'Impulsloven', ['KM7']),
          s('4C', 'Bevaring av bevegelsesmengde', ['KM7']),
          s('4D', 'Ulike typer sentrale støt', ['KM7', 'KM8']),
        ],
      },
      {
        number: '5',
        title: 'Termisk energi',
        sections: [
          s('5A', 'Trykk', ['KM10']),
          s('5B', 'Temperatur', ['KM10']),
          s('5C', 'Varme og indre energi', ['KM8', 'KM10']),
          s('5D', 'Varmekapasitet', ['KM8', 'KM10']),
          s('5E', 'Termofysikkens første lov', ['KM8', 'KM10']),
          s('5F', 'Termofysikkens andre lov', ['KM3', 'KM8', 'KM10']),
        ],
      },
      {
        number: '6',
        title: 'Bølger og stråling',
        sections: [s('6A', 'Bølger', ['KM2']), s('6B', 'Strålingslovene', ['KM11']), s('6C', 'Strålingsbalansen', ['KM3', 'KM12'])],
      },
      {
        number: '7',
        title: 'Atomfysikk',
        sections: [
          s('7A', 'Atomets sammensetning', ['KM13']),
          s('7B', 'Bohrs atommodell', ['KM2', 'KM13']),
          s('7C', 'Emisjon og absorpsjon', ['KM13']),
        ],
      },
      {
        number: '8',
        title: 'Kjernefysikk',
        sections: [
          s('8A', 'Atomkjernen', ['KM2']),
          s('8B', 'Bevaringslover for kjernereaksjoner', ['KM7', 'KM8']),
          s('8C', 'Fisjon', ['KM3', 'KM8']),
          s('8D', 'Fusjon', ['KM3', 'KM8', 'KM14']),
        ],
      },
      {
        number: '9',
        title: 'Astrofysikk',
        sections: [s('9A', 'Verdensrommet', ['KM2']), s('9B', 'En stjerne blir til', ['KM14']), s('9C', 'Stjernedød', ['KM14'])],
      },
      {
        number: '10',
        title: 'Elektrisitet',
        sections: [
          s('10A', 'Elektrisk strøm', ['KM9']),
          s('10B', 'Elektrisk spenning og resistans', ['KM9']),
          s('10C', 'Koblinger av motstander', ['KM9']),
          s('10D', 'Elektrisk energi og effekt', ['KM9']),
        ],
      },
    ],
  },
};

/** Læreboksettene som legges inn som standard (rekkefølgen blir rekkefølgen i sidepanelet). */
export const DEFAULT_SEED_TEXTBOOKS: string[] = Object.keys(TEXTBOOKS);
