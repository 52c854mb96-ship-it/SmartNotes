import type { VizMeta } from '../../types';

/**
 * Kapittel 2 Krefter og Newtons lover. Rekkefølgen er slik at det en visualisering bygger på, kommer før:
 * skråplanet bruker friksjonstallene (2C) og Newtons 2. lov (2E), og luftmotstand bruker 2. lov og Eulers metode (2F).
 */
const viz: VizMeta[] = [
  {
    id: 'friksjon',
    chapter: '2',
    sections: ['2C'],
    title: 'Statisk friksjon og glidefriksjon',
    summary: 'Dytt en tung kasse over tregulv, betong eller is, og se hvordan friksjonen følger dyttet helt til kassen begynner å gli.',
    keywords: ['friksjonstall', 'statisk friksjon', 'glidefriksjon', 'normalkraft', 'akselerasjon', 'kasse', 'tregulv', 'betong', 'is'],
    load: () => import('./Friksjon'),
  },
  {
    id: 'fore-og-bremsing',
    chapter: '2',
    sections: ['2C', '2E'],
    title: 'Friksjon og føre: bremselengde for en bil',
    summary:
      'Brems fullt på tørr asfalt, våt asfalt, snø eller is, med sommer- eller vinterdekk og med ABS eller låste hjul. Friksjonen R = μmg gir a = μg og bremselengden v₀²/(2μg).',
    keywords: [
      'friksjonstall',
      'statisk friksjon',
      'glidefriksjon',
      'bremselengde',
      'bremsekraft',
      'ABS',
      'låste hjul',
      'vinterdekk',
      'føre',
      'is',
      'snø',
      'andre lov',
      'trafikk',
      'KM2',
      'KM5',
    ],
    load: () => import('./ForeOgBremsing'),
  },
  {
    id: 'kraftpar',
    chapter: '2',
    sections: ['2D'],
    title: 'Kraftpar: bok, bord og jord',
    summary: 'Se hvilke krefter som hører sammen etter Newtons 3. lov, og hvorfor G og N ikke er et kraftpar.',
    keywords: ['tredje lov', 'motkraft', 'frilegemediagram', 'gravitasjon', 'normalkraft'],
    load: () => import('./KraftparTredjeLov'),
  },
  {
    id: 'koblede-klosser',
    chapter: '2',
    sections: ['2E'],
    title: 'Koblede klosser: system og enkeltklosser',
    summary: 'Velg hva som er systemet, og se hvordan snordraget forsvinner fra kraftsummen når begge klossene er med.',
    keywords: ['andre lov', 'snordrag', 'indre krefter', 'ytre krefter'],
    load: () => import('./KobledeKlosser'),
  },
  {
    id: 'skraplan',
    chapter: '2',
    sections: ['2A', '2C', '2E'],
    title: 'Kloss på skråplan',
    summary: 'Gjør skråplanet brattere og se hvordan tyngden deles i G∥ og G⊥, og ved hvilken vinkel klossen begynner å gli.',
    keywords: ['dekomponering', 'komponenter', 'grensevinkel', 'normalkraft', 'friksjonstall', 'akselerasjon'],
    load: () => import('./Skraplan'),
  },
  {
    id: 'heis',
    chapter: '2',
    sections: ['2E'],
    title: 'Vekt i heis',
    summary: 'Stå på en vekt i en heis som starter, kjører og bremser, og se at det er akselerasjonen som bestemmer hva vekta viser.',
    keywords: ['andre lov', 'normalkraft', 'tilsynelatende vekt', 'vektløs', 'fritt fall', 'akselerasjon'],
    load: () => import('./Heis'),
  },
  {
    id: 'luftmotstand',
    chapter: '2',
    sections: ['2C', '2F'],
    title: 'Fall med luftmotstand',
    summary: 'Følg en fallskjermhopper fra utspranget: luftmotstanden vokser med farten til den blir like stor som tyngden, og farten blir konstant.',
    keywords: ['terminalfart', 'luftmotstand', 'kv²', 'fallskjermhopper', 'Eulers metode', 'numerisk', 'andre lov'],
    load: () => import('./Luftmotstand'),
  },
  {
    id: 'strikkhopp',
    chapter: '2',
    sections: ['2E', '2F'],
    title: 'Strikkhopp fra en bro',
    summary:
      'Velg masse, strikklengde og stivhet, og følg kreftene, høyden, farten og akselerasjonen fra fritt fall til det laveste punktet. Når er farten størst, og hvor stor blir akselerasjonen?',
    keywords: ['strikkraft', 'fjærkraft', 'Hookes lov', 'kraftsum', 'andre lov', 'fritt fall', 'laveste punkt', 'største akselerasjon', 'grafer', 'KM5', 'KM6'],
    load: () => import('./Strikkhopp'),
  },
  {
    id: 'eks-skraplan',
    kind: 'eksempel',
    chapter: '2',
    sections: ['2C', '2E'],
    title: 'Kasse som sklir ned en rampe',
    summary: 'Krefter, dekomponering av tyngden, Newtons 2. lov, fart nederst og grensevinkelen, steg for steg.',
    keywords: ['skråplan', 'rampe', 'friksjonstall', 'dekomponering', 'andre lov', 'grensevinkel', 'tidløs likning'],
    load: () => import('./EksSkraplan'),
  },
];

export default viz;
