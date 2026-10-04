import type { VizMeta } from '../../types';

/** Kapittel 1 Rettlinjet bevegelse. */
const viz: VizMeta[] = [
  {
    id: 'bevegelsesgrafer',
    chapter: '1',
    sections: ['1C'],
    title: 'Bevegelsesgrafer: s-t, v-t og a-t',
    summary: 'Styr startposisjon, startfart og akselerasjon og se de tre grafene henge sammen: stigningstall er fart, og areal under v-t-grafen er forflytning.',
    keywords: ['posisjon', 'fart', 'akselerasjon', 'stigningstall', 'tangent', 'areal', 'forflytning', 'grafisk framstilling'],
    load: () => import('./Bevegelsesgrafer'),
  },
  {
    id: 'bremselengde',
    chapter: '1',
    sections: ['1D'],
    title: 'Reaksjonslengde og bremselengde',
    summary: 'Endre fart, reaksjonstid og underlag og se hvor bilen stopper. Dobbel fart gir fire ganger så lang bremselengde.',
    keywords: ['stopplengde', 'reaksjonstid', 'bremseakselerasjon', 'konstant akselerasjon', 'trafikk', 'v-t-graf'],
    load: () => import('./Bremselengde'),
  },
  {
    id: 'loddrett-kast',
    chapter: '1',
    sections: ['1D'],
    title: 'Loddrett kast',
    summary: 'Kast en ball rett opp og følg høyde og fart i grafene. I toppunktet er farten null, men akselerasjonen er fortsatt −g.',
    keywords: ['fritt fall', 'toppunkt', 'tyngdeakselerasjon', 'konstant akselerasjon', 'fortegn', 's-t-graf', 'v-t-graf'],
    load: () => import('./LoddrettKast'),
  },
  {
    id: 'simulering',
    chapter: '1',
    sections: ['1E'],
    title: 'Simulering av fall med luftmotstand',
    summary: 'Se Eulers metode regne seg fram steg for steg mot terminalfarten, og hvordan feilen vokser når tidssteget blir større.',
    keywords: ['eulers metode', 'tidssteg', 'luftmotstand', 'terminalfart', 'numerisk', 'programmering', 'python'],
    load: () => import('./Simulering'),
  },
];

export default viz;
