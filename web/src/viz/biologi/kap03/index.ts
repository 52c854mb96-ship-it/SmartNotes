import type { VizMeta } from '../../types';

/** Kapittel 3 Biologisk mangfold (Bi 1). Delkapitlene er ikke bekreftet ennå, så `sections` er tom. */
const viz: VizMeta[] = [
  {
    id: 'artsmangfold',
    chapter: '3',
    sections: [],
    title: 'Artsmangfold og Simpsons indeks',
    summary:
      'Bygg to prøveflater i skogen med ulikt antall arter og ulik jevnhet, og se hvordan Simpsons og Shannons indeks måler artsmangfoldet.',
    keywords: [
      'artsmangfold',
      'biologisk mangfold',
      'Simpsons indeks',
      'Simpsons diversitetsindeks',
      'Shannons indeks',
      'artsrikdom',
      'jevnhet',
      'genetisk mangfold',
      'økosystemmangfold',
      'prøveflate',
      'feltarbeid',
      'KM10',
      'KM1',
    ],
    load: () => import('./Artsmangfold'),
  },
  {
    id: 'arter-og-areal',
    chapter: '3',
    sections: [],
    title: 'Arter og areal',
    summary:
      'Se hvordan antall arter øker med arealet (S = c · Aᶻ), hvorfor øyer langt fra land har færre arter, og hvor mange arter som går tapt når en skog stykkes opp.',
    keywords: [
      'arts–areal-sammenheng',
      'øybiogeografi',
      'MacArthur og Wilson',
      'innvandring',
      'utdøing',
      'oppstykking',
      'fragmentering',
      'habitatfragmentering',
      'kanteffekt',
      'arealbruk',
      'utdøingsgjeld',
      'korridorer',
      'KM10',
      'KM11',
    ],
    load: () => import('./ArterOgAreal'),
  },
  {
    id: 'naeringsnett',
    chapter: '3',
    sections: [],
    title: 'Næringsnett og energipyramide',
    summary:
      'Fjern en art fra næringsnettet i en norsk barskog og se de direkte og indirekte virkningene, og hvor lite energi som når toppen av energipyramiden.',
    keywords: [
      'næringsnett',
      'næringskjede',
      'trofisk nivå',
      'produsent',
      'konsument',
      'primærkonsument',
      'sekundærkonsument',
      'toppredator',
      'nedbryter',
      'trofisk kaskade',
      'nøkkelart',
      'energipyramide',
      '10 %-regelen',
      'barskog',
      'økosystem',
      'KM10',
      'KM3',
    ],
    load: () => import('./Naeringsnett'),
  },
];

export default viz;
