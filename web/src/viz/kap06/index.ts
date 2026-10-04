import type { VizMeta } from '../types';

/** Kapittel 6 Bølger og stråling. */
const viz: VizMeta[] = [
  {
    id: 'bolger',
    chapter: '6',
    sections: ['6A'],
    title: 'Bølger: bølgelengde, frekvens og fart',
    summary: 'Endre amplitude, bølgelengde og frekvens, og se at bølgen flytter seg mens partiklene bare svinger. Sammenlign øyeblikksbildet med grafen for én partikkel.',
    keywords: ['v = λf', 'periode', 'amplitude', 'transversal', 'longitudinal', 'fortetning', 'fortynning', 'lyd'],
    load: () => import('./Bolger'),
  },
];

export default viz;
