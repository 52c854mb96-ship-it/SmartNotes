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

/** Kompetansemål i Kjemi 1 (KJE01-02, LK20, kompetansemålsett KV532). Ordlyd fra Udir (Grep). */
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

/** Kompetansemål i Biologi 1 (BIO01-02, LK20, kompetansemålsett KV538). Ordlyd fra Udir (Grep). */
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

  /**
   * Kjemi 1 (Aschehoug, LK20, 2021; Haraldsrud, Sandtorv, Hushovd og Brandt). Kapitlene er godt belagt i forlagets
   * egne sider og skolers planer. Delkapitlene er bare funnet for kapittel 1 (1.3 er mest usikker), og resten er ikke
   * gjettet: eleven legger dem inn fra innholdsfortegnelsen (bilde) i faginnstillingene, som også kobler dem til målene.
   * Kapittel 2 kalles «Periodiske egenskaper og reaksjoner» ett sted hos forlaget, men «Egenskaper og reaksjoner» i
   * alle andre kilder.
   */
  'aschehoug-kjemi-1': {
    id: 'aschehoug-kjemi-1',
    subjectName: 'Kjemi 1',
    textbook: 'Kjemi 1 (Aschehoug)',
    profile: 'chemistry',
    aims: KJEMI1_AIMS,
    chapters: [
      {
        number: '1',
        title: 'Kjemiske bindinger',
        sections: [
          s('1.1', 'Hva er kjemi?', ['KM1', 'KM5']),
          s('1.2', 'Atomer', ['KM6', 'KM11', 'KM5']),
          s('1.3', 'Periodesystemet', ['KM6']),
          s('1.4', 'Sterke bindinger', ['KM7', 'KM1']),
          s('1.5', 'Svake bindinger', ['KM7', 'KM14']),
        ],
      },
      { number: '2', title: 'Egenskaper og reaksjoner', sections: [] },
      { number: '3', title: 'Støkiometri', sections: [] },
      { number: '4', title: 'Termokjemi', sections: [] },
      { number: '5', title: 'Organisk kjemi', sections: [] },
      { number: '6', title: 'Likevekter', sections: [] },
      { number: '7', title: 'Syrer og baser', sections: [] },
      { number: '8', title: 'Miljøanalyse', sections: [] },
    ],
  },

  /**
   * Bi 1 (Gyldendal, 3. utgave 2021, LK20; Grønlien, Tandberg og Glørstad Tsigaridas). De 15 kapitlene er belagt av
   * flere uavhengige elevkilder (middels sikkerhet; titlene på kapittel 8, 13 og 15 kan være litt annerledes i boka).
   * Delkapitlene er bare funnet bruddstykkevis og er derfor ikke lagt inn: eleven importerer innholdsfortegnelsen.
   */
  'gyldendal-bi-1': {
    id: 'gyldendal-bi-1',
    subjectName: 'Biologi 1',
    textbook: 'Bi 1 (Gyldendal)',
    profile: 'biology',
    aims: BIOLOGI1_AIMS,
    chapters: [
      { number: '1', title: 'Liv', sections: [] },
      { number: '2', title: 'Systematikk', sections: [] },
      { number: '3', title: 'Biologisk mangfold', sections: [] },
      { number: '4', title: 'Forvaltning av naturressurser', sections: [] },
      { number: '5', title: 'Cellestrukturer og cellefunksjon', sections: [] },
      { number: '6', title: 'Transport og kommunikasjon i celler', sections: [] },
      { number: '7', title: 'Celledeling', sections: [] },
      { number: '8', title: 'Kommunikasjonssystemer i mennesket', sections: [] },
      { number: '9', title: 'Transportsystemer i mennesket', sections: [] },
      { number: '10', title: 'Transportsystemer i dyr', sections: [] },
      { number: '11', title: 'Transportsystemer i planter', sections: [] },
      { number: '12', title: 'Kommunikasjon og bevegelse i planter', sections: [] },
      { number: '13', title: 'Formering', sections: [] },
      { number: '14', title: 'Mikrobielle og virale sykdommer', sections: [] },
      { number: '15', title: 'Bekjempelse av mikrobielle og virale sykdommer', sections: [] },
    ],
  },
};

/** Læreboksettene som legges inn som standard (rekkefølgen blir rekkefølgen i sidepanelet). */
export const DEFAULT_SEED_TEXTBOOKS: string[] = Object.keys(TEXTBOOKS);
