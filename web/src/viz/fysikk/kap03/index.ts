import type { VizMeta } from '../../types';

/** Kapittel 3 Mekanisk energi. */
const viz: VizMeta[] = [
  {
    id: 'arbeid',
    chapter: '3',
    sections: ['3B'],
    title: 'Arbeid: dra en kjelke på skrå',
    summary:
      'Dra lillesøster på kjelken med tauet på skrå. Se når arbeidet blir positivt, null eller negativt, hvordan friksjonen gjør negativt arbeid, og at arbeidet er arealet under kraft–strekning-grafen.',
    keywords: [
      'arbeid',
      'kjelke',
      'tau',
      'kraftkomponent',
      'dekomponering',
      'cos',
      'friksjonsarbeid',
      'totalt arbeid',
      'kinetisk energi',
      'areal under graf',
      'joule',
      'hverdag',
    ],
    load: () => import('./Arbeid'),
  },
  {
    id: 'trappelop',
    chapter: '3',
    sections: ['3A', '3B'],
    title: 'Arbeid og effekt i trappa',
    summary: 'Løp opp trappa og regn ut arbeidet og effekten din. Sammenlign med lyspærer, mikrobølgeovn og vannkoker.',
    keywords: ['effekt', 'watt', 'arbeid', 'potensiell energi', 'energi', 'virkningsgrad', 'hverdag'],
    load: () => import('./Trappelop'),
  },
  {
    id: 'energibevaring',
    chapter: '3',
    sections: ['3C', '3D', '3E', '3F'],
    title: 'Bevaring av mekanisk energi',
    summary: 'Slipp en kule i en U-rampe eller over en bakketopp og se potensiell og kinetisk energi bytte plass. Med friksjon blir mekanisk energi til termisk energi (varme).',
    keywords: ['potensiell energi', 'kinetisk energi', 'mekanisk energi', 'energibevaring', 'friksjonsarbeid', 'termisk energi', 'varme', 'referansenivå'],
    load: () => import('./Energibevaring'),
  },
  {
    id: 'berg-og-dal',
    chapter: '3',
    sections: ['3C', '3D', '3E', '3F'],
    title: 'Berg-og-dal-bane: kommer vogna over toppen?',
    summary: 'Velg starthøyden og se farten i hvert punkt fra energibevaring, energistolpene og om vogna kommer over neste topp, med og uten friksjon. Hvorfor må første topp være høyest?',
    keywords: [
      'berg-og-dal-bane',
      'fornøyelsespark',
      'energibevaring',
      'mekanisk energi',
      'potensiell energi',
      'kinetisk energi',
      'fart',
      'friksjonsarbeid',
      'termisk energi',
      'energistolper',
      'nullnivå',
      'KM5',
      'KM7',
      'KM8',
    ],
    load: () => import('./BergOgDal'),
  },
];

export default viz;
