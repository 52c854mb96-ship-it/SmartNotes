import type { VizMeta } from '../../types';

/** Kapittel 7 Atomfysikk. */
const viz: VizMeta[] = [
  {
    id: 'atomets-oppbygning',
    chapter: '7',
    sections: ['7A', '8A'],
    title: 'Bygg et atom: protoner, nøytroner og elektroner',
    summary: 'Velg antall protoner, nøytroner og elektroner og se hvilket grunnstoff, hvilken isotop og hvilket ion du får.',
    keywords: ['protontall', 'nukleontall', 'nøytrontall', 'isotop', 'ion', 'elektronskall', 'kjerne', 'grunnstoff', 'atomnummer'],
    load: () => import('./AtometsOppbygning'),
  },
  {
    id: 'bohr-hydrogen',
    chapter: '7',
    sections: ['7B', '7C'],
    title: 'Bohrs atommodell: energinivåer i hydrogen',
    summary: 'Velg en overgang mellom to energinivåer og se energien, frekvensen og bølgelengden til fotonet som sendes ut eller tas opp.',
    keywords: ['energinivå', 'foton', 'Balmer', 'Lyman', 'Paschen', 'emisjon', 'absorpsjon', 'grunntilstand', 'ionisering', 'E = hf'],
    load: () => import('./BohrHydrogen'),
  },
  {
    id: 'spektre',
    chapter: '7',
    sections: ['7C'],
    title: 'Spektre: kontinuerlig, emisjon og absorpsjon',
    summary:
      'Sammenlign spektrene til hydrogen, helium, natrium og kvikksølv med sollys, og se at linjene er fingeravtrykk for grunnstoffene.',
    keywords: [
      'spektrallinjer',
      'linjespekter',
      'emisjonsspekter',
      'absorpsjonsspekter',
      'Fraunhofer',
      'sollys',
      'fingeravtrykk',
      'fotonenergi',
    ],
    load: () => import('./Spektre'),
  },
];

export default viz;
