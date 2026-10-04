import type { VizMeta } from '../../types';

/**
 * Kapittel 5 Organisk kjemi (Kjemi 1). Delkapitlene er ikke bekreftet ennå, så visualiseringene vises under kapittelet.
 * Rekkefølgen: stoffgruppene og navnene først, så isomeri og til slutt reaksjonstypene.
 */
const viz: VizMeta[] = [
  {
    id: 'homologe-rekker',
    chapter: '5',
    sections: [],
    title: 'Homologe rekker og kokepunkt',
    summary:
      'Bla gjennom alkaner, alkener, alkyner, alkoholer og karboksylsyrer med 1–8 C. Se strukturformel, skjelettformel, navn og formel, og hvorfor kokepunktet stiger med kjedelengden og med hydrogenbindinger.',
    keywords: ['homolog rekke', 'alkan', 'alken', 'alkyn', 'alkohol', 'karboksylsyre', 'strukturformel', 'skjelettformel', 'kokepunkt', 'London-krefter', 'hydrogenbinding', 'KM1', 'KM7'],
    load: () => import('./HomologeRekker'),
  },
];

export default viz;
