import type { VizMeta } from '../../types';

/**
 * Kapittel 8 Miljøanalyse (Kjemi 1). Delkapitlene er ikke bekreftet ennå, så visualiseringene vises under kapittelet.
 * Rekkefølgen: konsentrasjonsenheter og grenseverdier, gravimetri, emisjonsspektre (kvalitativ analyse) og
 * spektrofotometri (kvantitativ analyse).
 */
const viz: VizMeta[] = [
  {
    id: 'vannkvalitet',
    chapter: '8',
    sections: [],
    title: 'Konsentrasjonsenheter og grenseverdier',
    summary:
      'Regn om mellom mol/L, mg/L, ppm, ppb og µg/m³ for nitrat, bly, NO₂, svevestøv og andre stoffer, og se på en logaritmisk skala hvor langt en måling er fra grenseverdien.',
    keywords: ['ppm', 'ppb', 'mg/L', 'µg/m³', 'konsentrasjon', 'grenseverdi', 'drikkevann', 'luftkvalitet', 'nitrat', 'svevestøv', 'nitrogendioksid', 'molvolum', 'KM9'],
    load: () => import('./Vannkvalitet'),
  },
  {
    id: 'gravimetri',
    chapter: '8',
    sections: [],
    title: 'Gravimetrisk analyse',
    summary:
      'Bestem klorid, sulfat eller kalsium i en vannprøve ved å felle ut et tungtløselig salt og veie det. Gå gjennom stegene fra masse bunnfall til konsentrasjon, og se hva feilkilder gjør med resultatet.',
    keywords: ['gravimetri', 'gravimetrisk analyse', 'felling', 'bunnfall', 'sølvklorid', 'bariumsulfat', 'kalsiumoksalat', 'feilkilder', 'stoffmengde', 'molforhold', 'KM10', 'KM2'],
    load: () => import('./Gravimetri'),
  },
  {
    id: 'emisjonsspektre',
    chapter: '8',
    sections: [],
    title: 'Flammefarger og emisjonsspektre',
    summary:
      'Se flammefargen og linjespekteret til litium, natrium, kalium, kalsium, strontium, barium og kobber, koble linjene til elektronoverganger mellom energinivåer, og identifiser en ukjent prøve.',
    keywords: ['emisjonsspekter', 'linjespekter', 'flammeprøve', 'flammefarge', 'energinivå', 'eksitert', 'foton', 'bølgelengde', 'spektroskopi', 'kvalitativ analyse', 'KM11'],
    load: () => import('./Emisjonsspektre'),
  },
  {
    id: 'spektrofotometri',
    chapter: '8',
    sections: [],
    title: 'Spektrofotometri og Beer–Lamberts lov',
    summary:
      'Send lys gjennom en farget løsning og se hvor mye som absorberes. Finn absorpsjonsmaksimum, lag en standardkurve og les av konsentrasjonen i en ukjent prøve.',
    keywords: ['spektrofotometri', 'kolorimetri', 'Beer–Lamberts lov', 'absorbans', 'transmittans', 'standardkurve', 'absorpsjonsspekter', 'kaliumpermanganat', 'KM11', 'KM9'],
    load: () => import('./Spektrofotometri'),
  },
];

export default viz;
