import type { VizMeta } from '../../types';

/**
 * Kapittel 5 Organisk kjemi (Kjemi 1). Delkapitlene er ikke bekreftet ennå, så visualiseringene vises under kapittelet.
 * Rekkefølgen: stoffgruppene og navnene først, så isomeri og til slutt reaksjonstypene.
 */
const viz: VizMeta[] = [
  {
    id: 'homologe-rekker',
    chapter: '5',
    sections: [],
    title: 'Homologe rekker og kokepunkt',
    summary:
      'Bla gjennom alkaner, alkener, alkyner, alkoholer og karboksylsyrer med 1–8 C. Se strukturformel, skjelettformel, navn og formel, og hvorfor kokepunktet stiger med kjedelengden og med hydrogenbindinger.',
    keywords: [
      'homolog rekke',
      'alkan',
      'alken',
      'alkyn',
      'alkohol',
      'karboksylsyre',
      'strukturformel',
      'skjelettformel',
      'kokepunkt',
      'London-krefter',
      'hydrogenbinding',
      'KM1',
      'KM7',
    ],
    load: () => import('./HomologeRekker'),
  },
  {
    id: 'navnsetting',
    chapter: '5',
    sections: [],
    title: 'Navnsetting av organiske forbindelser',
    summary:
      'Bygg et molekyl med hovedkjede, sidegrupper, dobbeltbinding og OH-gruppe, og få det systematiske navnet. Se hvorfor kjeden kan bli lengre enn du tegnet, og hvilken ende du skal nummerere fra.',
    keywords: [
      'navnsetting',
      'IUPAC',
      'hovedkjede',
      'substituent',
      'metyl',
      'etyl',
      'klor',
      'brom',
      'laveste nummer',
      'alfabetisk',
      'di',
      'tri',
      'alken',
      'alkohol',
      'KM1',
    ],
    load: () => import('./Navnsetting'),
  },
  {
    id: 'isomeri',
    chapter: '5',
    sections: [],
    title: 'Isomeri og kokepunkt',
    summary:
      'Sammenlign stoffer med samme molekylformel: butan og 2-metylpropan, de tre pentanene, etanol og dimetyleter, og cis- og trans-but-2-en. Se hvorfor forgrening og funksjonell gruppe endrer kokepunktet.',
    keywords: [
      'isomeri',
      'strukturisomer',
      'kjedeisomer',
      'posisjonsisomer',
      'funksjonell isomer',
      'cis-trans',
      'forgrening',
      'kokepunkt',
      'London-krefter',
      'hydrogenbinding',
      'KM7',
    ],
    load: () => import('./Isomeri'),
  },
  {
    id: 'organiske-reaksjoner',
    chapter: '5',
    sections: [],
    title: 'Organiske reaksjonstyper',
    summary:
      'Addisjon, substitusjon, eliminasjon, kondensasjon (forestring) og forbrenning med strukturformler før og etter. Se hvilke bindinger som brytes og dannes, og lær å kjenne igjen reaksjonstypen.',
    keywords: [
      'addisjon',
      'substitusjon',
      'eliminasjon',
      'kondensasjon',
      'forestring',
      'ester',
      'forbrenning',
      'eten',
      'brom',
      'bromvann',
      'UV-lys',
      'reaksjonstype',
      'KM8',
    ],
    load: () => import('./OrganiskeReaksjoner'),
  },
];

export default viz;
