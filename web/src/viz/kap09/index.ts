import type { VizMeta } from '../types';

/** Kapittel 9 Astrofysikk. */
const viz: VizMeta[] = [
  {
    id: 'universets-skala',
    chapter: '9',
    sections: ['9A'],
    title: 'Avstander i universet',
    summary:
      'Reis utover på en logaritmisk skala fra romstasjonen til kanten av det observerbare universet, og se avstandene i km, AE og lysår og hvor lenge lyset er underveis.',
    keywords: ['lysår', 'astronomisk enhet', 'AE', 'lysfart', 'logaritmisk skala', 'Proxima Centauri', 'Andromeda', 'Melkeveien', 'parsec'],
    load: () => import('./UniversetsSkala'),
  },
];

export default viz;
