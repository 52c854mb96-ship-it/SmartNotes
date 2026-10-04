import type { VizMeta } from '../../types';

/** Kapittel 2 Egenskaper og reaksjoner (Kjemi 1). Delkapitlene er ikke bekreftet ennå, så visualiseringene vises under kapittelet. */
const viz: VizMeta[] = [
  {
    id: 'periodiske-trender',
    chapter: '2',
    sections: [],
    title: 'Periodiske trender',
    summary:
      'Se atomradius, ioniseringsenergi og elektronegativitet som fargekart over periodesystemet, og følg trendene bortover en periode og nedover en gruppe.',
    keywords: ['atomradius', 'ioniseringsenergi', 'elektronegativitet', 'kjerneladning', 'skjerming', 'periodesystemet', 'trend'],
    load: () => import('./PeriodiskeTrender'),
  },
  {
    id: 'redoks',
    chapter: '2',
    sections: [],
    title: 'Redoks: metall i en løsning av metallioner',
    summary:
      'Sett et metall i en løsning med metallioner og se med spenningsrekka om det skjer en reaksjon, hvordan elektronene går fra atomene til ionene, og hvordan oksidasjonstallene endres.',
    keywords: ['redoks', 'oksidasjon', 'reduksjon', 'spenningsrekka', 'oksidasjonstall', 'halvreaksjon', 'reduksjonsmiddel', 'oksidasjonsmiddel', 'elektroner'],
    load: () => import('./Redoks'),
  },
  {
    id: 'fellingsreaksjoner',
    chapter: '2',
    sections: [],
    title: 'Fellingsreaksjoner og løselighet',
    summary:
      'Bland to saltløsninger og bruk løselighetstabellen til å se om det dannes bunnfall, hvilken farge det får, hvilke ioner som er tilskuerioner, og hvordan nettolikningen blir.',
    keywords: ['fellingsreaksjon', 'bunnfall', 'løselighet', 'løselighetstabell', 'tilskuerioner', 'nettolikning', 'ionelikning', 'tungtløselig', 'salt'],
    load: () => import('./Fellingsreaksjoner'),
  },
];

export default viz;
