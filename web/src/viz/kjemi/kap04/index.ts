import type { VizMeta } from '../../types';

/** Kapittel 4 Termokjemi (Kjemi 1). Delkapitlene er ikke bekreftet ennå, så visualiseringene vises under kapittelet. */
const viz: VizMeta[] = [
  {
    id: 'entalpidiagram',
    chapter: '4',
    sections: [],
    title: 'Entalpidiagram og aktiveringsenergi',
    summary: 'Følg en eksoterm eller endoterm reaksjon over toppen i entalpidiagrammet, og se at en katalysator senker aktiveringsenergien uten å endre ΔH.',
    keywords: ['entalpi', 'ΔH', 'eksoterm', 'endoterm', 'aktiveringsenergi', 'katalysator', 'overgangstilstand', 'system', 'omgivelser'],
    load: () => import('./Entalpidiagram'),
  },
  {
    id: 'bindingsentalpi',
    chapter: '4',
    sections: [],
    title: 'ΔH fra bindingsentalpier',
    summary: 'Bryt bindingene i reaktantene og dann nye i produktene, og regn ut ΔH som energi inn minus energi ut. Sammenlign med tabellverdien.',
    keywords: ['bindingsentalpi', 'bindingsenergi', 'ΔH', 'brudd', 'dannelse', 'eksoterm', 'endoterm', 'gjennomsnittsverdier'],
    load: () => import('./Bindingsentalpi'),
  },
  {
    id: 'kalorimetri',
    chapter: '4',
    sections: [],
    title: 'Kalorimetri: mål ΔH med et kaffekoppkalorimeter',
    summary: 'Løs salter eller nøytraliser saltsyre med natronlut, les av temperaturendringen og regn ut ΔH med q = m · c · ΔT. Se hvordan varmetap gir feil.',
    keywords: ['kalorimeter', 'q = mcΔT', 'varmekapasitet', 'løsningsentalpi', 'nøytralisering', 'feilkilder', 'varmetap', 'temperatur'],
    load: () => import('./Kalorimetri'),
  },
  {
    id: 'hess',
    chapter: '4',
    sections: [],
    title: "Hess' lov",
    summary: 'Snu og gang kjente reaksjonslikninger til summen blir målreaksjonen, og se i energitrappa at ΔH er den samme uansett vei.',
    keywords: ["Hess' lov", 'ΔH', 'energitrapp', 'snu likning', 'forbrenningsentalpi', 'dannelsesentalpi', 'karbonmonoksid'],
    load: () => import('./Hess'),
  },
];

export default viz;
