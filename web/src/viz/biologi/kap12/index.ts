import type { VizMeta } from '../../types';

/** Kapittel 12 Kommunikasjon og bevegelse i planter (Bi 1). Delkapitlene er ikke bekreftet ennå, så `sections` er tom. */
const viz: VizMeta[] = [
  {
    id: 'fototropisme',
    chapter: '12',
    sections: [],
    title: 'Auksin, fototropisme og gravitropisme',
    summary:
      'Se auksin flytte seg til skyggesiden og få skuddet til å bøye seg mot lyset, hvorfor skudd og røtter bøyer seg hver sin vei når planten ligger, og test deg selv på de klassiske forsøkene til Darwin, Boysen-Jensen og Went.',
    keywords: [
      'fototropisme',
      'gravitropisme',
      'tropisme',
      'auksin',
      'IAA',
      'plantehormon',
      'koleoptil',
      'celleforlengelse',
      'skyggesiden',
      'statolitter',
      'Darwin',
      'Boysen-Jensen',
      'Went',
      'agarblokk',
      'signalstoff',
      'KM3',
      'KM5',
    ],
    load: () => import('./Fototropisme'),
  },
  {
    id: 'fotoperiode',
    chapter: '12',
    sections: [],
    title: 'Fotoperiode og blomstring',
    summary:
      'Endre daglengden og se hvilke planter som blomstrer: langdagsplanter, kortdagsplanter som julestjerne og dagnøytrale planter. Test hva et kort lysglimt midt i natta gjør, og hvorfor det er nattlengden som teller.',
    keywords: [
      'fotoperiodisme',
      'fotoperiode',
      'daglengde',
      'nattlengde',
      'kritisk nattlengde',
      'langdagsplante',
      'kortdagsplante',
      'dagnøytral',
      'blomstring',
      'fytokrom',
      'rødt lys',
      'langrødt lys',
      'julestjerne',
      'midnattssol',
      'KM3',
    ],
    load: () => import('./Fotoperiode'),
  },
];

export default viz;
