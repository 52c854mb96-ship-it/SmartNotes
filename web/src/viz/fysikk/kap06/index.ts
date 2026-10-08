import type { VizMeta } from '../../types';

/** Kapittel 6 Bølger og stråling. */
const viz: VizMeta[] = [
  {
    id: 'bolger',
    chapter: '6',
    sections: ['6A'],
    title: 'Bølger: bølgelengde, frekvens og fart',
    summary:
      'Rist i et langt tau eller dytt i en spiralfjær på labbenken, og se at bølgen går bortover mens hvert punkt bare svinger. Mål bølgelengden på målebåndet og sammenlign med grafen for ett punkt.',
    keywords: ['v = λf', 'periode', 'amplitude', 'transversal', 'longitudinal', 'fortetning', 'fortynning', 'lyd', 'tau', 'spiralfjær', 'målebånd', 'bølgefart'],
    load: () => import('./Bolger'),
  },
  {
    id: 'ekko',
    chapter: '6',
    sections: ['6A'],
    title: 'Lyd og ekko: avstanden til lynet og dybden under båten',
    summary:
      'Mål tiden fra lynet til tordenen og finn avstanden med s = v · t, og se ekkoloddet på en fiskebåt måle dybden når lydpulsen går ned og opp igjen. Sammenlign bølgelengden λ = v / f i luft og vann.',
    keywords: ['lydfart', '340 m/s', '1500 m/s', 'ekko', 'ekkolodd', 'torden', 'lyn', 'ultralyd', 'refleksjon', 's = vt', 'λ = v/f', 'KM1', 'KM2'],
    load: () => import('./Ekko'),
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
  {
    id: 'solcellepanel',
    chapter: '6',
    sections: ['6C'],
    title: 'Solcellepanel ved hytta: sommer, vinter og beste vinkel',
    summary:
      'Vipp et solcellepanel og se hvordan effekten P = η · I · A · cos θ avhenger av solhøyden og vinkelen mellom sollyset og normalen. Sammenlign sommer og vinter fra Kristiansand til Tromsø, og finn den beste vinkelen.',
    keywords: [
      'solcelle',
      'solenergi',
      'virkningsgrad',
      'innstråling',
      'W/m²',
      'cos θ',
      'normal',
      'solhøyde',
      'innfallsvinkel',
      'luftmasse',
      'mørketid',
      'midnattssol',
      'breddegrad',
      'årstider',
      'fornybar energi',
      'KM2',
      'KM3',
      'KM8',
      'KM12',
    ],
    load: () => import('./Solcellepanel'),
  },
];

export default viz;
