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
];

export default viz;
