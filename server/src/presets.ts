import type { ChapterInput, CompetenceAim, Section, SubjectProfile } from '@smartnotes/shared';

/**
 * Startoppsett for et fag etter læreplanen (LK20): kompetansemålene fra Udir og SmartNotes' egne temaer og deltemaer,
 * skrevet ut fra målene. Oppsettet bygger ikke på noen lærebok; hver elev kan importere innholdsfortegnelsen i sin egen
 * lærebok privat (faginnstillingene), som da kobles til de samme målene.
 *
 * Kompetansemålene er offentlige (læreplanene er forskrift, åndsverkloven § 14) og tilgjengelige fra Udir under
 * Norsk lisens for offentlige data (NLOD). Se «Om SmartNotes» i innstillingene.
 */
export interface SubjectPreset {
  id: string;
  /** Tidligere id-er for samme oppsett, så en database som allerede har det, ikke får det på nytt. */
  aliases: string[];
  /**
   * Læreboka SmartNotes selv skrev i «Lærebok/emne» da oppsettet ble lagt inn under en tidligere id (til 13. oktober
   * 2026). Brukeren har ikke skrevet den, så den vises ikke i samle-PDF-ene og sendes ikke til AI-en (`userTextbook`).
   */
  legacyTextbooks?: string[];
  subjectName: string;
  profile: SubjectProfile;
  /** Læreplanen og kompetansemålsettet hos Udir som `aims` er hentet fra (Grep, data.udir.no). */
  udir: { plan: string; aimSet: string };
  aims: CompetenceAim[];
  chapters: (ChapterInput & { sections: Section[] })[];
}

/**
 * Kompetansemål i Fysikk 1 (FYS01-02, LK20, kompetansemålsett KV466). Ordrett fra Udir (bokmål), kontrollert ord for ord
 * mot Grep 13. oktober 2026 (`test/fixtures/udir-kompetansemaal.json`). KM3 har Udirs skrivemåte «problemsstillinger».
 */
const FYSIKK1_AIMS: CompetenceAim[] = [
  { code: 'KM1', text: 'planlegge og gjennomføre forsøk, analysere data og trekke konklusjoner', cross: true },
  { code: 'KM2', text: 'vurdere, bruke og lage modeller til å beskrive og forutsi fysiske fenomener', cross: true },
  { code: 'KM3', text: 'vurdere ulike påstander og argumenter om energi og klima i samfunnsaktuelle problemsstillinger', cross: false },
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

/** Kompetansemål i Kjemi 1 (KJE01-02, LK20, kompetansemålsett KV532). Ordrett fra Udir (bokmål), kontrollert mot Grep. */
const KJEMI1_AIMS: CompetenceAim[] = [
  { code: 'KM1', text: 'forstå og bruke kjemisk terminologi og regler for navnsetting i faglig kommunikasjon', cross: true },
  {
    code: 'KM2',
    text: 'planlegge og gjennomføre forsøk, estimere usikkerhet og vurdere feilkilder, presentere resultater og argumentere for gyldigheten av resultater og konklusjoner',
    cross: true,
  },
  {
    code: 'KM3',
    text: 'bruke informasjon fra sikkerhetsdatablad til å gjøre vurderinger knyttet til helse, miljø og sikkerhet i praktisk arbeid',
    cross: true,
  },
  { code: 'KM4', text: 'bruke data, simuleringer og beregninger i tolkninger og til å trekke konklusjoner', cross: true },
  {
    code: 'KM5',
    text: 'bruke modeller til å forklare observasjoner og kjemiske fenomener, og argumentere for modellenes styrker og begrensinger',
    cross: true,
  },
  {
    code: 'KM6',
    text: 'gjøre rede for oppbygningen av periodesystemet, og bruke kjerneladning og elektronkonfigurasjon til å forklare periodiske trender',
    cross: false,
  },
  {
    code: 'KM7',
    text: 'gjøre rede for kjemisk binding som elektrostatiske krefter som virker mellom partikler, og bruke dette til å forklare molekylgeometri og organiske og uorganiske stoffers struktur, sammensetning og egenskaper',
    cross: false,
  },
  {
    code: 'KM8',
    text: 'utforske og gjøre beregninger på kjemiske reaksjoner, og bruke observasjoner og teoretiske vurderinger til å identifisere reaksjonstype',
    cross: false,
  },
  {
    code: 'KM9',
    text: 'gjøre beregninger med ulike enheter for konsentrasjon og bruke stoffkonsentrasjon i vurderinger av vann- og luftkvalitet',
    cross: false,
  },
  { code: 'KM10', text: 'gjennomføre volumetrisk og gravimetrisk titreranalyse og drøfte bruk av titreranalyse', cross: false },
  {
    code: 'KM11',
    text: 'gjøre rede for sammenhengen mellom atomets oppbygning og grunnstoffers absorbsjons- og emisjonsspektre og bruke spektroskopiske metoder i kvalitativ og kvantitativ analyse',
    cross: false,
  },
  {
    code: 'KM12',
    text: 'gjøre rede for entalpi og bruke beregninger og forsøk til å utforske entalpiendringer i reaksjoner',
    cross: false,
  },
  {
    code: 'KM13',
    text: 'gjøre rede for kollisjonsteori og utforske faktorer som påvirker reaksjonsfart og kjemisk likevekt',
    cross: false,
  },
  {
    code: 'KM14',
    text: 'utforske løseligheten til stoffer, og gjøre rede for betydningen av ladning, polaritet og temperatur for løselighet',
    cross: false,
  },
  {
    code: 'KM15',
    text: 'gjøre rede for begrepene syre, base, protolyse og pH, og utforske egenskapene til sterke og svake syrer og baser',
    cross: false,
  },
  {
    code: 'KM16',
    text: 'gjøre rede for prinsipper for grønn kjemi og drøfte hvordan bruk av prinsippene kan bidra til bærekraftig utvikling',
    cross: false,
  },
  {
    code: 'KM17',
    text: 'presentere kjemifaglig innhold fra ulike kilder, kritisk vurdere kildene og bruke relevant teori til å drøfte innholdet',
    cross: true,
  },
];

/** Kompetansemål i Biologi 1 (BIO01-02, LK20, kompetansemålsett KV538). Ordrett fra Udir (bokmål), kontrollert mot Grep. */
const BIOLOGI1_AIMS: CompetenceAim[] = [
  {
    code: 'KM1',
    text: 'planlegge og gjennomføre undersøkelser, samle, behandle og tolke data og presentere resultater og funn',
    cross: true,
  },
  {
    code: 'KM2',
    text: 'utforske hvordan de taksonomiske kriteriene har endret seg i tråd med den teknologiske utviklingen, og sammenligne organismer med hensyn til fellestrekk og variasjon',
    cross: false,
  },
  {
    code: 'KM3',
    text: 'utforske sammenhenger mellom anatomi og fysiologi og gjøre rede for prinsippene for livsprosessene i organismer',
    cross: false,
  },
  {
    code: 'KM4',
    text: 'gjøre rede for hvordan utvalgte reguleringsmekanismer styrer homeostase hos mennesket, og undersøke hvordan livsstil kan påvirke disse mekanismene',
    cross: false,
  },
  {
    code: 'KM5',
    text: 'utforske sammenhenger mellom cellestrukturer og -funksjoner og gjøre rede for hvordan cellulære membraner danner grunnlag for kommunikasjon mellom celler',
    cross: false,
  },
  {
    code: 'KM6',
    text: 'sammenligne hvordan ulike celler deler seg, og gjøre rede for hvorfor regulering av celledeling er viktig for vekst og reparasjon',
    cross: false,
  },
  { code: 'KM7', text: 'gjøre rede for hvordan virale og mikrobielle sykdommer oppstår, spres og nedkjempes', cross: false },
  { code: 'KM8', text: 'drøfte hvordan vaksiner forebygger og verner mot sykdom på individ- og populasjonsnivå', cross: false },
  { code: 'KM9', text: 'gjøre rede for bruk av antibiotika og drøfte mulige konsekvenser', cross: false },
  {
    code: 'KM10',
    text: 'utforske abiotiske og biotiske faktorer i et økosystem, drøfte sammenhenger som forklarer det biologiske mangfoldet, og reflektere over naturens egenverdi',
    cross: false,
  },
  {
    code: 'KM11',
    text: 'utforske hvilke konsekvenser endringer i klima og arealutnytting kan ha for det biologiske mangfoldet, og drøfte tiltak for en mer bærekraftig forvaltning',
    cross: false,
  },
];

const s = (code: string, title: string, aims: string[]): Section => ({ code, title, aims });

export const SUBJECT_PRESETS: Record<string, SubjectPreset> = {
  /** Fysikk 1: ti temaer i den rekkefølgen læreplanen bygger opp faget, med egne deltemaer. */
  'fysikk-1-lk20': {
    id: 'fysikk-1-lk20',
    aliases: ['ergo-fysikk-1'],
    legacyTextbooks: ['ERGO Fysikk 1'],
    subjectName: 'Fysikk 1',
    profile: 'physics',
    udir: { plan: 'FYS01-02', aimSet: 'KV466' },
    aims: FYSIKK1_AIMS,
    chapters: [
      {
        number: '1',
        title: 'Rettlinjet bevegelse',
        sections: [
          s('1.1', 'Måling, enheter og usikkerhet', ['KM1', 'KM2']),
          s('1.2', 'Posisjon, fart og bevegelsesgrafer', ['KM4']),
          s('1.3', 'Bevegelse med konstant akselerasjon', ['KM4', 'KM5']),
          s('1.4', 'Numerisk modellering av bevegelse', ['KM1', 'KM4', 'KM6']),
        ],
      },
      {
        number: '2',
        title: 'Krefter og Newtons lover',
        sections: [
          s('2.1', 'Kraftbegrepet og kraftdiagrammer', ['KM5']),
          s('2.2', 'Newtons lover', ['KM5']),
          s('2.3', 'Friksjon og luftmotstand', ['KM5']),
          s('2.4', 'Krefter som varierer', ['KM5', 'KM6']),
        ],
      },
      {
        number: '3',
        title: 'Arbeid og energi',
        sections: [
          s('3.1', 'Energi, arbeid og effekt', ['KM5', 'KM8']),
          s('3.2', 'Kinetisk og potensiell energi', ['KM5', 'KM7']),
          s('3.3', 'Bevaring og tap av mekanisk energi', ['KM5', 'KM7', 'KM8']),
        ],
      },
      {
        number: '4',
        title: 'Bevegelsesmengde og støt',
        sections: [
          s('4.1', 'Bevegelsesmengde og impuls', ['KM7']),
          s('4.2', 'Bevaring av bevegelsesmengde', ['KM7']),
          s('4.3', 'Elastiske og uelastiske støt', ['KM7', 'KM8']),
        ],
      },
      {
        number: '5',
        title: 'Varme og termodynamikk',
        sections: [
          s('5.1', 'Trykk og temperatur', ['KM10']),
          s('5.2', 'Varme, indre energi og varmekapasitet', ['KM8', 'KM10']),
          s('5.3', 'Termodynamikkens lover og virkningsgrad', ['KM3', 'KM8', 'KM10']),
        ],
      },
      {
        number: '6',
        title: 'Bølger og stråling',
        sections: [
          s('6.1', 'Bølger og bølgeegenskaper', ['KM2']),
          s('6.2', 'Stråling fra legemer med ulik temperatur', ['KM11']),
          s('6.3', 'Jordas strålingsbalanse og klima', ['KM3', 'KM12']),
        ],
      },
      {
        number: '7',
        title: 'Atomfysikk',
        sections: [s('7.1', 'Atommodeller', ['KM2', 'KM13']), s('7.2', 'Emisjon, absorpsjon og spektre', ['KM13'])],
      },
      {
        number: '8',
        title: 'Kjernefysikk',
        sections: [
          s('8.1', 'Atomkjernen, radioaktivitet og kjernereaksjoner', ['KM2', 'KM7', 'KM8']),
          s('8.2', 'Fisjon og fusjon som energikilder', ['KM3', 'KM8', 'KM14']),
        ],
      },
      {
        number: '9',
        title: 'Astrofysikk',
        sections: [
          s('9.1', 'Universet, avstander og observasjoner', ['KM2']),
          s('9.2', 'Stjerners liv og dannelsen av grunnstoffer', ['KM14']),
        ],
      },
      {
        number: '10',
        title: 'Elektriske kretser',
        sections: [
          s('10.1', 'Ladning, strøm og spenning', ['KM9']),
          s('10.2', 'Resistans og koblinger av motstander', ['KM9']),
          s('10.3', 'Elektrisk energi og effekt', ['KM9']),
        ],
      },
    ],
  },

  /** Kjemi 1: åtte temaer etter læreplanen. Deltemaene legger eleven inn fra sin egen lærebok. */
  'kjemi-1-lk20': {
    id: 'kjemi-1-lk20',
    aliases: ['aschehoug-kjemi-1'],
    legacyTextbooks: ['Kjemi 1 (Aschehoug)'],
    subjectName: 'Kjemi 1',
    profile: 'chemistry',
    udir: { plan: 'KJE01-02', aimSet: 'KV532' },
    aims: KJEMI1_AIMS,
    chapters: [
      { number: '1', title: 'Atomer, periodesystemet og kjemiske bindinger', sections: [] },
      { number: '2', title: 'Stoffers egenskaper og reaksjonstyper', sections: [] },
      { number: '3', title: 'Stoffmengde og kjemiske beregninger', sections: [] },
      { number: '4', title: 'Energi i kjemiske reaksjoner', sections: [] },
      { number: '5', title: 'Organiske forbindelser', sections: [] },
      { number: '6', title: 'Kjemisk likevekt', sections: [] },
      { number: '7', title: 'Syrer, baser og pH', sections: [] },
      { number: '8', title: 'Kjemisk analyse og miljø', sections: [] },
    ],
  },

  /** Biologi 1: åtte temaer etter læreplanen. Deltemaene legger eleven inn fra sin egen lærebok. */
  'biologi-1-lk20': {
    id: 'biologi-1-lk20',
    aliases: ['gyldendal-bi-1'],
    legacyTextbooks: ['Bi 1 (Gyldendal)'],
    subjectName: 'Biologi 1',
    profile: 'biology',
    udir: { plan: 'BIO01-02', aimSet: 'KV538' },
    aims: BIOLOGI1_AIMS,
    chapters: [
      { number: '1', title: 'Livets kjennetegn og systematikk', sections: [] },
      { number: '2', title: 'Økologi, biologisk mangfold og forvaltning', sections: [] },
      { number: '3', title: 'Celler og cellemembraner', sections: [] },
      { number: '4', title: 'Celledeling', sections: [] },
      { number: '5', title: 'Mennesket: regulering og transport', sections: [] },
      { number: '6', title: 'Transport og regulering hos dyr og planter', sections: [] },
      { number: '7', title: 'Formering', sections: [] },
      { number: '8', title: 'Sykdom, smitte og immunforsvar', sections: [] },
    ],
  },
};

/** Oppsettene som legges inn som standard (rekkefølgen blir rekkefølgen i sidepanelet). */
export const DEFAULT_SEED_PRESETS: string[] = Object.keys(SUBJECT_PRESETS);

/** Oppsettet med denne id-en, også under en tidligere id (for eksempel i SEED_TEXTBOOKS fra før). */
export function findPreset(id: string): SubjectPreset | undefined {
  return SUBJECT_PRESETS[id] ?? Object.values(SUBJECT_PRESETS).find((p) => p.aliases.includes(id));
}

const LEGACY_TEXTBOOKS = new Set(Object.values(SUBJECT_PRESETS).flatMap((p) => (p.legacyTextbooks ?? []).map((t) => t.toLocaleLowerCase('nb'))));

/**
 * Læreboka brukeren selv har skrevet på faget, eller null. En lærebok SmartNotes la inn selv da faget ble opprettet
 * (`legacyTextbooks`), regnes ikke med: den skal ikke stå i samle-PDF-ene eller sendes til AI-en. Feltet i faget endres
 * ikke, så brukeren ser det fortsatt i faginnstillingene og kan skrive inn sin egen.
 */
export function userTextbook(subject: { textbook: string | null }): string | null {
  const textbook = subject.textbook?.trim();
  if (!textbook || LEGACY_TEXTBOOKS.has(textbook.toLocaleLowerCase('nb'))) return null;
  return textbook;
}
