import type { VizMeta } from '../../types';

/**
 * Kapittel 6 Likevekter (Kjemi 1). Delkapitlene er ikke bekreftet ennå, så visualiseringene vises under kapittelet.
 * Rekkefølgen: reaksjonsfart (kollisjonsteori) først, så hvordan likevekt innstilles, beregninger med K og til slutt
 * Le Chateliers prinsipp.
 */
const viz: VizMeta[] = [
  {
    id: 'reaksjonsfart',
    chapter: '6',
    sections: [],
    title: 'Reaksjonsfart og kollisjonsteori',
    summary:
      'Se energifordelingen til partiklene ved to temperaturer og hvor stor andel som har nok energi til å reagere. Prøv katalysator, konsentrasjon og oppdeling av et fast stoff, og se hvorfor 10 °C høyere omtrent dobler farten.',
    keywords: [
      'reaksjonsfart',
      'kollisjonsteori',
      'aktiveringsenergi',
      'katalysator',
      'temperatur',
      'konsentrasjon',
      'overflate',
      'energifordeling',
      'Maxwell-Boltzmann',
      'effektive kollisjoner',
      'KM13',
    ],
    load: () => import('./Reaksjonsfart'),
  },
  {
    id: 'likevekt-innstilles',
    chapter: '6',
    sections: [],
    title: 'Likevekt innstilles',
    summary:
      'Start med valgfrie konsentrasjoner og se konsentrasjonene og farten begge veier endre seg til likevekt, mens partiklene fortsetter å reagere begge veier. Følg Q mot K underveis.',
    keywords: ['kjemisk likevekt', 'dynamisk likevekt', 'reaksjonsfart', 'reaksjonskvotient', 'Q', 'K', 'hydrogenjodid', 'likevektskonstant', 'KM13'],
    load: () => import('./LikevektInnstilles'),
  },
  {
    id: 'likevektsberegning',
    chapter: '6',
    sections: [],
    title: 'Likevektsberegning med tabell',
    summary:
      'Sett opp start, endring og likevekt for en reaksjon, velg startkonsentrasjoner og K, og se likevektskonsentrasjonene. Hva betyr en stor eller liten K?',
    keywords: [
      'likevektskonstant',
      'K',
      'likevektsuttrykk',
      'start endring likevekt',
      'ICE-tabell',
      'reaksjonskvotient',
      'likevektsberegning',
      'hydrogenjodid',
      'ammoniakk',
      'ester',
      'KM13',
      'KM4',
    ],
    load: () => import('./Likevektsberegning'),
  },
  {
    id: 'le-chatelier',
    chapter: '6',
    sections: [],
    title: 'Le Chateliers prinsipp',
    summary:
      'Forstyrr likevekten i ammoniakksyntesen, jern(III)tiocyanat og koboltklorid: tilsett eller fjern et stoff, endre volumet eller temperaturen, og se hvordan likevekten forskyves og fargen endres.',
    keywords: [
      'Le Chateliers prinsipp',
      'likevektsforskyvning',
      'konsentrasjon',
      'trykk',
      'volum',
      'temperatur',
      'katalysator',
      'Haber-Bosch',
      'ammoniakk',
      'tiocyanat',
      'koboltklorid',
      'eksoterm',
      'endoterm',
      'KM13',
    ],
    load: () => import('./LeChatelier'),
  },
];

export default viz;
