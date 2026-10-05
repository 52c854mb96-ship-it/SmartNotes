import type { VizMeta } from '../../types';

/**
 * Kapittel 7 Syrer og baser (Kjemi 1). Delkapitlene er ikke bekreftet ennå, så visualiseringene vises under kapittelet.
 * Rekkefølgen følger boka: protolyse, pH, sterke og svake syrer, titrering.
 */
const viz: VizMeta[] = [
  {
    id: 'protolyse',
    chapter: '7',
    sections: [],
    title: 'Protolyse og korresponderende syre-base-par',
    summary:
      'Velg en syre og en base og se protonet hoppe fra syra til basen. Finn de korresponderende syre-base-parene, og se om reaksjonen går fullstendig (→) eller er en likevekt (⇌).',
    keywords: ['protolyse', 'Brønsted', 'syre', 'base', 'proton', 'korresponderende syre-base-par', 'amfolytt', 'autoprotolyse', 'oksoniumion', 'pKa', 'KM15'],
    load: () => import('./Protolyse'),
  },
  {
    id: 'ph-skala',
    chapter: '7',
    sections: [],
    title: 'pH-skalaen og indikatorer',
    summary:
      'Skyv på pH, [H₃O⁺], [OH⁻] eller pOH og se de andre følge med. Kjente stoffer står på skalaen, og fem indikatorer viser fargen sin. Ett pH-steg er en faktor 10.',
    keywords: ['pH', 'pOH', 'oksoniumion', 'hydroksidion', 'Kw', 'logaritme', 'indikator', 'bromtymolblått', 'fenolftalein', 'metyloransje', 'lakmus', 'KM15'],
    load: () => import('./PhSkala'),
  },
  {
    id: 'sterk-og-svak-syre',
    chapter: '7',
    sections: [],
    title: 'Sterke og svake syrer og baser',
    summary:
      'Sammenlign HCl med en svak syre (eller NaOH med ammoniakk) ved samme konsentrasjon: protolysegrad, pH og partikkelbilde. Fortynn og se hva som skjer med hver av dem.',
    keywords: ['sterk syre', 'svak syre', 'protolysegrad', 'Ka', 'Kb', 'eddiksyre', 'saltsyre', 'ammoniakk', 'fortynning', 'likevekt', 'KM15'],
    load: () => import('./SterkOgSvakSyre'),
  },
  {
    id: 'titrering',
    chapter: '7',
    sections: [],
    title: 'Syre-base-titrering',
    summary:
      'Titrer saltsyre eller eddiksyre med NaOH fra byretten og følg pH-meteret og titrerkurven. Finn ekvivalenspunktet og halvtitrerpunktet, velg indikator, og regn ut den ukjente konsentrasjonen.',
    keywords: ['titrering', 'titrerkurve', 'ekvivalenspunkt', 'halvtitrerpunkt', 'endepunkt', 'pKa', 'indikator', 'byrette', 'titreranalyse', 'buffer', 'KM10', 'KM15'],
    load: () => import('./Titrering'),
  },
];

export default viz;
