import type { VizMeta } from '../../types';

/** Kapittel 5 Termisk energi. */
const viz: VizMeta[] = [
  {
    id: 'gassmodell',
    chapter: '5',
    sections: ['5A', '5B'],
    title: 'Gassmodell: trykk og temperatur',
    summary:
      'Varm opp eller klem sammen en gass og se hvordan partiklene som støter mot stempelet, gir trykket. Følg linjene ned til det absolutte nullpunktet.',
    keywords: ['partikkelmodell', 'trykk', 'kelvin', 'celsius', 'absolutt nullpunkt', 'pV = nRT', 'idealgass', 'p = F/A'],
    load: () => import('./Gassmodell'),
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
