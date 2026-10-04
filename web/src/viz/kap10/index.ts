import type { VizMeta } from '../types';

/** Kapittel 10 Elektrisitet. */
const viz: VizMeta[] = [
  {
    id: 'strom',
    chapter: '10',
    sections: ['10A'],
    title: 'Elektrisk strøm i en ledning',
    summary:
      'Se de frie elektronene drive gjennom en kobberledning, tell ladningen som passerer et tverrsnitt, og sammenlign strømretningen med retningen elektronene går.',
    keywords: ['I = Q/t', 'ladning', 'coulomb', 'ampere', 'elektroner', 'strømretning', 'driftsfart', 'elementærladning'],
    load: () => import('./Strom'),
  },
];

export default viz;
