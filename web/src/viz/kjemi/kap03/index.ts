import type { VizMeta } from '../../types';

/** Kapittel 3 Støkiometri (Kjemi 1). Delkapitlene er ikke bekreftet ennå, så visualiseringene vises under kapittelet. */
const viz: VizMeta[] = [
  {
    id: 'stoffmengde',
    chapter: '3',
    sections: [],
    title: 'Stoffmengde og mol-brua',
    summary: 'Gå mellom masse, stoffmengde og antall partikler med m = n · M og Avogadros tall, og se hvor enormt én mol egentlig er.',
    keywords: ['mol', 'stoffmengde', 'molar masse', 'Avogadros tall', 'masse', 'konsentrasjon', 'c = n/V', 'støkiometri'],
    load: () => import('./Stoffmengde'),
  },
  {
    id: 'balansering',
    chapter: '3',
    sections: [],
    title: 'Balansering av reaksjonslikninger',
    summary: 'Juster koeffisientene til atomene stemmer på begge sider, og lær metoden: grunnstoffene i færrest stoffer først, H og O til slutt.',
    keywords: ['reaksjonslikning', 'koeffisient', 'balansere', 'bevaring av masse', 'forbrenning', 'ionelikning', 'ladning'],
    load: () => import('./Balansering'),
  },
];

export default viz;
