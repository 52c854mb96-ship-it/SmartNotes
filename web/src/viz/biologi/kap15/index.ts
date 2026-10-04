import type { VizMeta } from '../../types';

/**
 * Kapittel 15 Bekjempelse av mikrobielle og virale sykdommer (Bi 1). Delkapitlene er ikke bekreftet ennå, så
 * `sections` er tom.
 */
const viz: VizMeta[] = [
  {
    id: 'flokkimmunitet',
    chapter: '15',
    sections: [],
    title: 'Vaksiner og flokkimmunitet',
    summary:
      'Velg hvor smittsom sykdommen er og hvor mange som er vaksinert, og se hvordan en epidemi sprer seg i en befolkning, og når flokkimmunitet beskytter også de uvaksinerte.',
    keywords: [
      'flokkimmunitet',
      'vaksine',
      'vaksinasjonsdekning',
      'basisreproduksjonstall',
      'R0',
      'smittsomhet',
      'epidemi',
      'SIR-modell',
      'meslinger',
      'influensa',
      'covid-19',
      'immunitet',
      'KM7',
      'KM8',
    ],
    load: () => import('./Flokkimmunitet'),
  },
];

export default viz;
