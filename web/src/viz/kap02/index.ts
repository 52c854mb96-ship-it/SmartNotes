import type { VizMeta } from '../types';

/** Kapittel 2 Krefter og Newtons lover. */
const viz: VizMeta[] = [
  {
    id: 'friksjon',
    chapter: '2',
    sections: ['2C'],
    title: 'Statisk friksjon og glidefriksjon',
    summary: 'Dytt på en kloss og se hvordan friksjonen følger dyttet helt til klossen begynner å gli.',
    keywords: ['friksjonstall', 'normalkraft', 'akselerasjon'],
    load: () => import('./Friksjon'),
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
];

export default viz;
