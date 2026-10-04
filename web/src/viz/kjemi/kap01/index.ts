import type { VizMeta } from '../../types';

/** Kapittel 1 Kjemiske bindinger (Kjemi 1). */
const viz: VizMeta[] = [
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
