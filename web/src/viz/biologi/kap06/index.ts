import type { VizMeta } from '../../types';

/** Kapittel 6 Transport og kommunikasjon i celler (Bi 1). Delkapitlene er ikke bekreftet ennå, så `sections` er tom. */
const viz: VizMeta[] = [
  {
    id: 'diffusjon-og-osmose',
    chapter: '6',
    sections: [],
    title: 'Diffusjon og osmose',
    summary:
      'Se partikler diffundere gjennom en membran, vann strømme ved osmose, og hva som skjer med et rødt blodlegeme og en plantecelle i hypoton, isoton og hyperton løsning.',
    keywords: [
      'diffusjon',
      'osmose',
      'passiv transport',
      'fasilitert diffusjon',
      'kanalprotein',
      'akvaporin',
      'konsentrasjonsgradient',
      'halvgjennomtrengelig membran',
      'hypoton',
      'isoton',
      'hyperton',
      'hemolyse',
      'plasmolyse',
      'turgor',
      'cellemembran',
      'KM5',
    ],
    load: () => import('./DiffusjonOgOsmose'),
  },
];

export default viz;
