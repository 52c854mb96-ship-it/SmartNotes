import type { VizMeta } from '../../types';

/** Geofag 1, tema 9 (Feltarbeid og geofaglige metoder). Deltemaene står i `sections` (som i fysikk). */
const viz: VizMeta[] = [
  {
    id: 'kotekart',
    chapter: '9',
    sections: ['9.1', '9.2'],
    title: 'Kotekart og terrengprofil',
    summary:
      'Legg en profillinje over et tenkt kotekart med dal, elv, vann og topper, og se terrengprofilet med overhøyde. Flytt punktet P og les av høyde, helning i grader og prosent og avstanden mellom kotene, og se vannskillet rundt nedbørfeltet.',
    keywords: [
      'kotekart',
      'koter',
      'kote',
      'tellekote',
      'ekvidistanse',
      'høydelag',
      'terrengprofil',
      'profil',
      'overhøyde',
      'målestokk',
      'kartlesing',
      'topografisk kart',
      'helning',
      'helning i prosent',
      'stigning',
      'bratt terreng',
      'skredterreng',
      'elvedal',
      'V-form',
      'vannskille',
      'nedbørfelt',
      'feltarbeid',
      'kart og kompass',
      'm o.h.',
      'KM12',
      'KM11',
    ],
    load: () => import('./KotekartOgProfil'),
  },
];

export default viz;
