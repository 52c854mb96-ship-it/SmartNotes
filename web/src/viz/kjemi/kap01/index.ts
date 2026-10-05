import type { VizMeta } from '../../types';

/** Kapittel 1 Kjemiske bindinger (Kjemi 1). Rekkefølgen følger delkapitlene. */
const viz: VizMeta[] = [
  {
    id: 'elektronkonfigurasjon',
    chapter: '1',
    sections: ['1.2', '1.3'],
    title: 'Elektronkonfigurasjon og periodesystemet',
    summary:
      'Velg et grunnstoff og se hvordan elektronene fyller skall og orbitaler, og hvordan konfigurasjonen bestemmer perioden og gruppa i periodesystemet.',
    keywords: ['elektronkonfigurasjon', 'skall', 'orbital', 'Hunds regel', 'oppbyggingsprinsippet', 'valenselektroner', 'periode', 'gruppe', 'krom', 'kobber'],
    load: () => import('./Elektronkonfigurasjon'),
  },
  {
    id: 'bindingstype',
    chapter: '1',
    sections: ['1.4'],
    title: 'Bindingstype og elektronegativitet',
    summary: 'Velg to grunnstoffer og se om bindingen blir upolar kovalent, polar kovalent eller ionisk ut fra forskjellen i elektronegativitet.',
    keywords: ['elektronegativitet', 'ΔEN', 'polar', 'upolar', 'kovalent binding', 'ionebinding', 'metallbinding', 'delladning', 'dipol'],
    load: () => import('./Bindingstype'),
  },
  {
    id: 'molekylform',
    chapter: '1',
    sections: ['1.4'],
    title: 'Molekylform og polaritet (VSEPR)',
    summary:
      'Se hvordan bindinger og frie elektronpar rundt sentralatomet bestemmer formen og bindingsvinkelen, og om bindingsdipolene opphever hverandre.',
    keywords: ['VSEPR', 'molekylform', 'Lewisstruktur', 'bindingsvinkel', 'frie elektronpar', 'tetraedrisk', 'vinklet', 'polart molekyl', 'dipol'],
    load: () => import('./Molekylform'),
  },
  {
    id: 'svake-bindinger',
    chapter: '1',
    sections: ['1.5'],
    title: 'Svake bindinger og kokepunkt',
    summary:
      'Sammenlign kokepunktene til hydridene i gruppe 14–17 og alkanene, slå London-krefter, dipol-dipol-krefter og hydrogenbindinger av og på, og se hvorfor vann koker ved 100 °C.',
    keywords: ['svake bindinger', 'hydrogenbinding', 'London-krefter', 'dipol-dipol', 'van der Waals', 'kokepunkt', 'hydrider', 'alkaner', 'vann'],
    load: () => import('./SvakeBindinger'),
  },
];

export default viz;
