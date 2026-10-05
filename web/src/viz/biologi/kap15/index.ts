import type { VizMeta } from '../../types';

/**
 * Kapittel 15 Bekjempelse av mikrobielle og virale sykdommer (Bi 1). Delkapitlene er ikke bekreftet ennå, så
 * `sections` er tom.
 */
const viz: VizMeta[] = [
  {
    id: 'flokkimmunitet',
    chapter: '15',
    sections: [],
    title: 'Vaksiner og flokkimmunitet',
    summary:
      'Velg hvor smittsom sykdommen er og hvor mange som er vaksinert, og se hvordan en epidemi sprer seg i en befolkning, og når flokkimmunitet beskytter også de uvaksinerte.',
    keywords: [
      'flokkimmunitet',
      'vaksine',
      'vaksinasjonsdekning',
      'basisreproduksjonstall',
      'R0',
      'smittsomhet',
      'epidemi',
      'SIR-modell',
      'meslinger',
      'influensa',
      'covid-19',
      'immunitet',
      'KM7',
      'KM8',
    ],
    load: () => import('./Flokkimmunitet'),
  },
  {
    id: 'immunforsvaret',
    chapter: '15',
    sections: [],
    title: 'Immunforsvaret og hukommelsesceller',
    summary:
      'Se antistoffnivået og smittestoffet etter første og andre møte med det samme antigenet, etter sykdom eller vaksine. Følg forsvaret steg for steg fra fagocytter til T-hjelpeceller, plasmaceller, drepe-T-celler og hukommelsesceller.',
    keywords: [
      'immunforsvar',
      'primærrespons',
      'sekundærrespons',
      'antistoff',
      'antigen',
      'hukommelsesceller',
      'immunitet',
      'vaksine',
      'uspesifikt forsvar',
      'spesifikt forsvar',
      'fagocytter',
      'makrofager',
      'T-hjelpeceller',
      'B-celler',
      'plasmaceller',
      'drepe-T-celler',
      'lymfocytter',
      'KM7',
      'KM8',
    ],
    load: () => import('./Immunforsvaret'),
  },
  {
    id: 'antibiotikaresistens',
    chapter: '15',
    sections: [],
    title: 'Antibiotikaresistens',
    summary:
      'Gi antibiotika til en infeksjon der noen få bakterier er resistente: hele kuren, en avbrutt kur eller unødvendig bruk, flere ganger etter hverandre. Se hvordan andelen resistente øker ved naturlig utvalg.',
    keywords: [
      'antibiotika',
      'antibiotikaresistens',
      'resistens',
      'resistente bakterier',
      'naturlig utvalg',
      'seleksjon',
      'antibiotikakur',
      'normalflora',
      'tarmflora',
      'penicillin',
      'mutasjon',
      'plasmid',
      'KM9',
      'KM7',
    ],
    load: () => import('./Antibiotikaresistens'),
  },
];

export default viz;
