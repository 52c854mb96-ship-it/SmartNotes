import type { VizMeta } from '../../types';

/** Kapittel 5 Termisk energi. */
const viz: VizMeta[] = [
  {
    id: 'gassmodell',
    chapter: '5',
    sections: ['5A', '5B'],
    title: 'Gassmodell: trykk og temperatur',
    summary:
      'Varm opp gassen i en sylinder på kokeplata, eller endre volumet, og se hvordan støtene fra partiklene gir trykket på manometeret. Følg linjene ned til det absolutte nullpunktet.',
    keywords: ['partikkelmodell', 'trykk', 'kelvin', 'celsius', 'absolutt nullpunkt', 'pV = nRT', 'idealgass', 'p = F/A', 'manometer', 'stempel', 'partikkelfart'],
    load: () => import('./Gassmodell'),
  },
  {
    id: 'dekktrykk',
    chapter: '5',
    sections: ['5A', '5B'],
    title: 'Dekktrykk om vinteren',
    summary:
      'Fyll et bildekk i en varm garasje og la bilen stå ute i kulda. Se hvorfor trykket faller, hva måleren egentlig viser, og hvorfor du må regne med kelvin og absolutt trykk.',
    keywords: [
      'dekktrykk',
      'manometertrykk',
      'absolutt trykk',
      'overtrykk',
      'lufttrykk',
      'bar',
      'p/T = konstant',
      'fast volum',
      'kelvin',
      'celsius',
      'absolutt nullpunkt',
      'idealgass',
      'KM2',
      'KM10',
    ],
    load: () => import('./Dekktrykk'),
  },
  {
    id: 'blanding',
    chapter: '5',
    sections: ['5C', '5D'],
    title: 'Blanding og termisk likevekt',
    summary:
      'Bland varmt og kaldt vann, eller slipp en varm metallbit i vann. Energien det varme avgir, mottar det kalde, helt til temperaturene er like.',
    keywords: ['varme', 'indre energi', 'termisk likevekt', 'sluttemperatur', 'kalorimeter', 'energibevaring', 'Q = cmΔT'],
    load: () => import('./Blanding'),
  },
  {
    id: 'varmekapasitet',
    chapter: '5',
    sections: ['5D'],
    title: 'Spesifikk varmekapasitet',
    summary: 'Varm opp to stoffer med samme masse og samme effekt, og se hvorfor vann bruker mye lengre tid enn metallene. Q = c·m·ΔT.',
    keywords: ['varmekapasitet', 'Q = cmΔT', 'effekt', 'oppvarming', 'kokepunkt', 'fordampingsvarme', 'vannkoker'],
    load: () => import('./Varmekapasitet'),
  },
  {
    id: 'vannkoker',
    chapter: '5',
    sections: ['5C', '5D'],
    title: 'Vannkoker eller kokeplate',
    summary:
      'Kok opp like mye vann i en vannkoker og i en kasserolle på kokeplata, med samme effekt. Vannet trenger like mye varme, men varmetapet avgjør hvem som koker først og hvor mye strøm det koster.',
    keywords: [
      'vannkoker',
      'kokeplate',
      'kasserolle',
      'Q = cmΔT',
      'E = Pt',
      'effekt',
      'virkningsgrad',
      'varmetap',
      'energiregnskap',
      'energibevaring',
      'kokepunkt',
      'kWh',
      'temperatur-tid-graf',
      'KM8',
      'KM10',
    ],
    load: () => import('./Vannkoker'),
  },
  {
    id: 'forste-lov',
    chapter: '5',
    sections: ['5E'],
    title: 'Termofysikkens første lov',
    summary:
      'Tilfør eller ta bort varme, og press stempelet inn eller la gassen skyve det ut. Se hvordan ΔU = W + Q bestemmer om gassen blir varmere.',
    keywords: ['første lov', 'ΔU = W + Q', 'indre energi', 'arbeid', 'varme', 'fortegn', 'kompresjon', 'adiabatisk'],
    load: () => import('./ForsteLov'),
  },
];

export default viz;
