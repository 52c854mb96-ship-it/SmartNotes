import type { VizMeta } from '../../types';

/** Kapittel 3 Mekanisk energi. */
const viz: VizMeta[] = [
  {
    id: 'arbeid',
    chapter: '3',
    sections: ['3B'],
    title: 'Arbeid: dra en kjelke på skrå',
    summary: 'Endre kraft og vinkel og se når arbeidet blir positivt, null eller negativt, og hvordan friksjonen gjør negativt arbeid.',
    keywords: ['arbeid', 'kraftkomponent', 'cos', 'friksjonsarbeid', 'totalt arbeid', 'kinetisk energi', 'joule'],
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
];

export default viz;
