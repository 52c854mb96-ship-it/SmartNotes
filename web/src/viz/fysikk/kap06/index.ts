import type { VizMeta } from '../../types';

/** Kapittel 6 Bølger og stråling. */
const viz: VizMeta[] = [
  {
    id: 'bolger',
    chapter: '6',
    sections: ['6A'],
    title: 'Bølger: bølgelengde, frekvens og fart',
    summary:
      'Endre amplitude, bølgelengde og frekvens, og se at bølgen flytter seg mens partiklene bare svinger. Sammenlign øyeblikksbildet med grafen for én partikkel.',
    keywords: ['v = λf', 'periode', 'amplitude', 'transversal', 'longitudinal', 'fortetning', 'fortynning', 'lyd'],
    load: () => import('./Bolger'),
  },
  {
    id: 'svart-legeme',
    chapter: '6',
    sections: ['6B'],
    title: 'Stråling fra svarte legemer',
    summary:
      'Endre temperaturen og se Planck-kurven flytte seg: toppen følger Wiens lov, og arealet under kurven følger Stefan–Boltzmanns lov.',
    keywords: ['Planck', 'Wiens forskyvningslov', 'Stefan–Boltzmann', 'σT⁴', 'λmaks', 'temperatur', 'stjerner', 'glødelampe', 'infrarødt'],
    load: () => import('./SvartLegeme'),
  },
  {
    id: 'stralingsbalanse',
    chapter: '6',
    sections: ['6C'],
    title: 'Strålingsbalansen til jorda',
    summary: 'Endre albedoen og hvor mye varmestråling atmosfæren tar opp, og se hvordan temperaturen ved bakken finner en ny likevekt.',
    keywords: ['drivhuseffekt', 'albedo', 'solarkonstant', 'S/4', 'σT⁴', '255 K', '288 K', 'klima', 'énlagsmodell'],
    load: () => import('./Stralingsbalanse'),
  },
];

export default viz;
