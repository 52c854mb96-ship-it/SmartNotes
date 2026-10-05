import type { VizMeta } from '../../types';

/** Kapittel 1 Liv (Bi 1). Delkapitlene er ikke bekreftet ennå, så `sections` er tom. */
const viz: VizMeta[] = [
  {
    id: 'organisasjonsnivaer',
    chapter: '1',
    sections: [],
    title: 'Organisasjonsnivåer fra molekyl til biosfære',
    summary:
      'Zoom fra et DNA-molekyl via celle, vev, organ og organisme til populasjon, økosystem og hele jorda, med ekte størrelser på en logaritmisk skala og eksempler fra kroppen og skogen.',
    keywords: [
      'organisasjonsnivå',
      'molekyl',
      'organell',
      'celle',
      'vev',
      'organ',
      'organsystem',
      'organisme',
      'populasjon',
      'samfunn',
      'økosystem',
      'biosfære',
      'emergente egenskaper',
      'logaritmisk skala',
      'mikroskop',
      'KM3',
      'KM5',
    ],
    load: () => import('./Organisasjonsnivaer'),
  },
  {
    id: 'hva-er-liv',
    chapter: '1',
    sections: [],
    title: 'Hva er liv?',
    summary:
      'Velg hvilke kjennetegn på liv som skal gjelde, og se hvorfor bakterier er levende, frø er levende i hvile, og virus, ild og krystaller er grensetilfeller eller ikke levende.',
    keywords: [
      'kjennetegn på liv',
      'livsprosesser',
      'celle',
      'stoffskifte',
      'vekst',
      'formering',
      'reproduksjon',
      'homeostase',
      'arv',
      'evolusjon',
      'virus',
      'prion',
      'bjørnedyr',
      'tardigrad',
      'latent liv',
      'KM3',
    ],
    load: () => import('./HvaErLiv'),
  },
];

export default viz;
