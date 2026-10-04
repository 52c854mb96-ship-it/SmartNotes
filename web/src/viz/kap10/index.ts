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
  {
    id: 'ohms-lov',
    chapter: '10',
    sections: ['10B'],
    title: 'Ohms lov og resistans',
    summary:
      'Skru på spenningen over en motstand og en glødelampe og sammenlign U–I-grafene. Se også hvordan resistansen til en ledning avhenger av materiale, lengde og tverrsnitt.',
    keywords: ['U = RI', 'spenning', 'resistans', 'ohm', 'ohmsk', 'glødelampe', 'resistivitet', 'R = ρL/A', 'amperemeter', 'voltmeter'],
    load: () => import('./OhmsLov'),
  },
];

export default viz;
