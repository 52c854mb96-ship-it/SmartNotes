/**
 * Typer som flere deler av geofag-kit-et deler. Mønstrene (`monstre.tsx`) og bergartstabellen (`bergarter.ts`) bruker
 * samme liste, så de kan skrives hver for seg.
 */

/**
 * Ett mønster for en bergart, et sediment eller en løsmasse, som på geologiske kart og i PDF-malen «Atlas». Løsmassene
 * (morene, breelv, leire, kvikkleire, silt, sand, grus, torv, ur) har egne mønstre, adskilt fra de faste bergartene de
 * kan bli til (siltstein, sandstein, konglomerat): bruk `silt` for løs silt i jorda og `siltstein` for fast fjell.
 */
export type MonsterId =
  | 'granitt'
  | 'gneis'
  | 'basalt'
  | 'gabbro'
  | 'diabas'
  | 'sandstein'
  | 'siltstein'
  | 'leirskifer'
  | 'glimmerskifer'
  | 'kalkstein'
  | 'marmor'
  | 'kvartsitt'
  | 'konglomerat'
  | 'salt'
  | 'kull'
  | 'morene'
  | 'breelv'
  | 'leire'
  | 'kvikkleire'
  | 'silt'
  | 'sand'
  | 'grus'
  | 'torv'
  | 'ur'
  | 'aske'
  | 'malmsone';

/** Alle mønstrene i fast rekkefølge (til galleriet og testene). */
export const MONSTER_IDS: readonly MonsterId[] = [
  'granitt',
  'gneis',
  'basalt',
  'gabbro',
  'diabas',
  'sandstein',
  'siltstein',
  'leirskifer',
  'glimmerskifer',
  'kalkstein',
  'marmor',
  'kvartsitt',
  'konglomerat',
  'salt',
  'kull',
  'morene',
  'breelv',
  'leire',
  'kvikkleire',
  'silt',
  'sand',
  'grus',
  'torv',
  'ur',
  'aske',
  'malmsone',
];
