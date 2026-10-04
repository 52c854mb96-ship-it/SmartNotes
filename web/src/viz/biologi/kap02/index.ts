import type { VizMeta } from '../../types';

/** Kapittel 2 Systematikk (Bi 1). Delkapitlene er ikke bekreftet ennå, så `sections` er tom. */
const viz: VizMeta[] = [
  {
    id: 'klassifisering',
    chapter: '2',
    sections: [],
    title: 'Klassifisering fra domene til art',
    summary:
      'Velg to av 18 organismer og se hele klassifiseringen deres side om side, fra domene ned til art, og hvilket nivå som er det laveste de har felles.',
    keywords: [
      'klassifisering',
      'systematikk',
      'taksonomi',
      'domene',
      'rike',
      'rekke',
      'klasse',
      'orden',
      'familie',
      'slekt',
      'art',
      'binær nomenklatur',
      'vitenskapelig navn',
      'Linné',
      'eukaryoter',
      'prokaryoter',
      'arker',
      'KM2',
    ],
    load: () => import('./Klassifisering'),
  },
  {
    id: 'slektskapstre',
    chapter: '2',
    sections: [],
    title: 'Slektskapstre før og etter DNA',
    summary:
      'Bytt mellom slektskapstrær bygd på ytre likhet, anatomi og DNA, og se hvorfor hvalen er et pattedyr, sopp er nærmere dyr enn planter, fugler er krypdyr og arker er et eget domene.',
    keywords: [
      'slektskapstre',
      'fylogenetisk tre',
      'kladogram',
      'felles stamform',
      'evolusjon',
      'morfologi',
      'molekylære data',
      'DNA-sekvensering',
      'tre domener',
      'Woese',
      'konvergent utvikling',
      'hval',
      'dinosaurer',
      'KM2',
    ],
    load: () => import('./Slektskapstre'),
  },
];

export default viz;
