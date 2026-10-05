import type { VizMeta } from '../../types';

/** Kapittel 4 Forvaltning av naturressurser (Bi 1). Delkapitlene er ikke bekreftet ennå, så `sections` er tom. */
const viz: VizMeta[] = [
  {
    id: 'fangst-gjenfangst',
    chapter: '4',
    sections: [],
    title: 'Fangst og gjenfangst',
    summary:
      'Anslå hvor mange fisk det er i en dam ved å merke noen, sette dem ut igjen og telle hvor mange merkede du fanger på nytt. Gjenta forsøket og se hvor mye estimatet sprer seg.',
    keywords: [
      'fangst–gjenfangst',
      'merking og gjenfangst',
      'Lincoln–Petersen',
      'bestandsestimat',
      'populasjonsstørrelse',
      'utvalg',
      'usikkerhet',
      'feilkilder',
      'forutsetninger',
      'bestand',
      'KM1',
      'KM10',
    ],
    load: () => import('./FangstGjenfangst'),
  },
  {
    id: 'baerekraftig-hosting',
    chapter: '4',
    sections: [],
    title: 'Bærekraftig høsting',
    summary:
      'Velg kvote eller fangstandel for en fiskebestand med logistisk vekst, og se når fisket er bærekraftig, hvor det maksimale bærekraftige utbyttet ligger, og hvorfor silda kollapset på 1960-tallet.',
    keywords: [
      'bærekraftig høsting',
      'maksimalt bærekraftig utbytte',
      'MSY',
      'logistisk vekst',
      'bæreevne',
      'tilvekst',
      'kvote',
      'overfiske',
      'kollaps',
      'fiskestopp',
      'føre-var',
      'norsk vårgytende sild',
      'torsk',
      'forvaltning',
      'bestand',
      'KM11',
    ],
    load: () => import('./BaerekraftigHosting'),
  },
  {
    id: 'klima-og-utbredelse',
    chapter: '4',
    sections: [],
    title: 'Klimaendringer og utbredelse',
    summary:
      'Se hvordan klimasonen til en art flytter seg oppover i fjellet og nordover når det blir varmere, og hva fjellarter som fjellrev og issoleie mister når det ikke finnes noe høyere å flytte til.',
    keywords: [
      'klimaendringer',
      'utbredelse',
      'toleranseområde',
      'temperaturgradient',
      'skoggrense',
      'fjellrev',
      'issoleie',
      'fjellbjørk',
      'rødrev',
      'konkurranse',
      'abiotiske faktorer',
      'biologisk mangfold',
      'arealbruk',
      'KM10',
      'KM11',
    ],
    load: () => import('./KlimaOgUtbredelse'),
  },
];

export default viz;
