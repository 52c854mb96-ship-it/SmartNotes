import type { VizMeta } from '../../types';

/** Kapittel 4 Kollisjoner og eksplosjoner. */
const viz: VizMeta[] = [
  {
    id: 'impuls',
    chapter: '4',
    sections: ['4B'],
    title: 'Impulsloven: kort eller lang støttid',
    summary:
      'Stopp et egg eller en bilfører på ulike underlag og se at arealet under F-t-grafen er det samme, mens kraften blir stor når støttiden er kort.',
    keywords: ['impuls', 'bevegelsesmengde', 'støttid', 'kollisjonspute', 'bilbelte', 'hjelm', 'gjennomsnittskraft'],
    load: () => import('./Impuls'),
  },
  {
    id: 'sentrale-stot',
    chapter: '4',
    sections: ['4C', '4D'],
    title: 'Sentrale støt mellom to vogner',
    summary: 'Velg masser, farter og type støt. Bevegelsesmengden er alltid bevart, men kinetisk energi bare i elastiske støt.',
    keywords: ['bevegelsesmengde', 'elastisk', 'uelastisk', 'fullstendig uelastisk', 'kinetisk energi', 'bevaring', 'kollisjon'],
    load: () => import('./SentraleStot'),
  },
  {
    id: 'eksplosjon',
    chapter: '4',
    sections: ['4C'],
    title: 'Eksplosjon og rekyl',
    summary:
      'To vogner skyves fra hverandre av en fjær, eller et gevær skyter ut en kule. Σp er null før og etter, og den letteste får mest energi.',
    keywords: ['bevegelsesmengde', 'bevaring', 'rekyl', 'gevær', 'fjær', 'kinetisk energi', 'indre krefter'],
    load: () => import('./Eksplosjon'),
  },
];

export default viz;
