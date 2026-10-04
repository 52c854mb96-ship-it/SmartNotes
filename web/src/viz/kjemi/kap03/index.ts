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
  {
    id: 'begrensende-reaktant',
    chapter: '3',
    sections: [],
    title: 'Begrensende reaktant og utbytte',
    summary: 'Bland reaktanter i ulike mengder og se hvilken som brukes opp først, hva som blir til overs, og hvor stort det teoretiske og prosentvise utbyttet blir.',
    keywords: ['begrensende reaktant', 'overskudd', 'teoretisk utbytte', 'prosentvis utbytte', 'støkiometri', 'molforhold', 'masse'],
    load: () => import('./BegrensendeReaktant'),
  },
  {
    id: 'konsentrasjon',
    chapter: '3',
    sections: [],
    title: 'Konsentrasjon og fortynning',
    summary: 'Løs et stoff i en målekolbe og se konsentrasjonen i mol/L, g/L, mg/L, ppm og masseprosent. Pipetter ut og fortynn med c₁V₁ = c₂V₂.',
    keywords: ['konsentrasjon', 'c = n/V', 'fortynning', 'c₁V₁ = c₂V₂', 'ppm', 'mg/L', 'masseprosent', 'målekolbe', 'pipette', 'kobbersulfat'],
    load: () => import('./Konsentrasjon'),
  },
];

export default viz;
