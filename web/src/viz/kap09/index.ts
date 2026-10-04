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
  {
    id: 'hr-diagram',
    chapter: '9',
    sections: ['9B', '9C'],
    title: 'HR-diagrammet',
    summary:
      'Finn kjente stjerner i HR-diagrammet og se hvorfor noen er kjemper og andre hvite dverger. Velg en masse og se hvor stjernen havner på hovedserien og hvor lenge den lever.',
    keywords: ['Hertzsprung–Russell', 'hovedserien', 'luminositet', 'overflatetemperatur', 'kjempe', 'superkjempe', 'hvit dverg', 'spektralklasse', 'levetid', 'Stefan–Boltzmann'],
    load: () => import('./HrDiagram'),
  },
];

export default viz;
