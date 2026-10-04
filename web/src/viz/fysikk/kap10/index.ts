import type { VizMeta } from '../../types';

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
  {
    id: 'koblinger',
    chapter: '10',
    sections: ['10C'],
    title: 'Serie- og parallellkobling',
    summary:
      'Koble to eller tre motstander i serie eller parallell og se hvordan strømmen og spenningen fordeler seg, hva den totale resistansen blir, og at Kirchhoffs lover alltid stemmer.',
    keywords: ['seriekobling', 'parallellkobling', 'total resistans', 'erstatningsresistans', 'Kirchhoffs lover', 'strømloven', 'spenningsloven', 'forgreining'],
    load: () => import('./Koblinger'),
  },
  {
    id: 'effekt-og-energi',
    chapter: '10',
    sections: ['10D'],
    title: 'Effekt, energi og strømregning',
    summary:
      'Velg et apparat, hvor lenge det står på og strømprisen, og se forskjellen på effekt og energi: hvor mange kWh det bruker og hva det koster per måned.',
    keywords: ['effekt', 'energi', 'kWh', 'kilowattime', 'P = UI', 'P = RI²', 'W = Pt', 'strømpris', 'sikring', 'watt'],
    load: () => import('./EffektOgEnergi'),
  },
];

export default viz;
