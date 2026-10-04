import type { VizMeta } from '../types';

/** Kapittel 8 Kjernefysikk. */
const viz: VizMeta[] = [
  {
    id: 'halveringstid',
    chapter: '8',
    sections: ['8A', '8B'],
    title: 'Halveringstid og radioaktivt henfall',
    summary: 'Se 400 kjerner henfalle tilfeldig og sammenlign med halveringsformelen for karbon-14, jod-131, radon-222, kobolt-60 og uran-238.',
    keywords: ['radioaktivitet', 'aktivitet', 'becquerel', 'desintegrasjonskonstant', 'henfallskonstant', 'karbondatering', 'tilfeldig', 'statistikk'],
    load: () => import('./Halveringstid'),
  },
  {
    id: 'bindingsenergi',
    chapter: '8',
    sections: ['8A', '8C', '8D'],
    title: 'Bindingsenergi per nukleon',
    summary: 'Se hvorfor jern er den mest stabile kjernen, og hvorfor både fisjon av uran og fusjon av hydrogen frigjør energi: E = Δm · c².',
    keywords: ['massedefekt', 'E = mc²', 'fisjon', 'fusjon', 'kjernekraft', 'sola', 'deuterium', 'tritium', 'uran', 'jern'],
    load: () => import('./Bindingsenergi'),
  },
  {
    id: 'kjernereaksjoner',
    chapter: '8',
    sections: ['8B'],
    title: 'Kjernereaksjoner: α, β og γ',
    summary: 'Velg en kjerne og en henfallstype, og se at nukleontall og ladning er bevart. Følg uranserien helt ned til stabilt bly.',
    keywords: ['alfastråling', 'betastråling', 'gammastråling', 'bevaringslover', 'nukleontall', 'ladning', 'datterkjerne', 'uranserien', 'positron', 'nøytrino'],
    load: () => import('./Kjernereaksjoner'),
  },
];

export default viz;
