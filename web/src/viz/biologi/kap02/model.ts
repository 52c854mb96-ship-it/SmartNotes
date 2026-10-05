/**
 * Systematikk (Bi 1 kapittel 2, KM2): klassifisering av 18 organismer i de åtte hovednivåene (domene → art) og tre
 * slektskapstrær for de samme organismene, bygd på ulike kriterier (ytre likhet, anatomi, DNA). Ren modell uten React.
 *
 * Kilder for klassifiseringen: Artsdatabanken/Artsnavnebasen og GBIF-ryggraden (2024), norske navn som i
 * Biologi 1-bøker og norsk Wikipedia. Forenklinger:
 * - Bakterier og arker har samme navn på domene og rike (seksrikesystemet i skolebøkene: bakterier, arker, protister,
 *   sopper, planter, dyr).
 * - Hvaler står som egen orden (Cetacea), som i de fleste skolebøker. Nyere systematikk plasserer hvalene inne i
 *   klovdyrene (Artiodactyla), fordi DNA viser at flodhesten er hvalenes nærmeste nålevende slektning.
 * - Proteobakteriene fikk det nye gyldige navnet Pseudomonadota i 2021; arkerekka står med det kjente navnet
 *   Euryarchaeota.
 * - Hunden er en tam underart av ulv (Canis lupus familiaris), så hund og ulv har samme art.
 * - Klassen krypdyr (Reptilia) er beholdt som i skolebøkene, selv om den ikke er en ekte slektskapsgruppe (se DNA-treet).
 */

/* ====================================================================== */
/* Klassifisering                                                           */
/* ====================================================================== */

export const RANKS = ['domene', 'rike', 'rekke', 'klasse', 'orden', 'familie', 'slekt', 'art'] as const;
export type Rank = (typeof RANKS)[number];

export const RANK_NAMES: Record<Rank, string> = {
  domene: 'Domene',
  rike: 'Rike',
  rekke: 'Rekke',
  klasse: 'Klasse',
  orden: 'Orden',
  familie: 'Familie',
  slekt: 'Slekt',
  art: 'Art',
};

/** Et takson: norsk navn (når det finnes et vanlig et) og vitenskapelig navn. */
export interface Taxon {
  no?: string;
  sci: string;
}

export type OrganismId =
  | 'menneske'
  | 'sjimpanse'
  | 'hund'
  | 'ulv'
  | 'katt'
  | 'blahval'
  | 'kongeorn'
  | 'krokodille'
  | 'firfisle'
  | 'frosk'
  | 'laks'
  | 'torsk'
  | 'eik'
  | 'gran'
  | 'fluesopp'
  | 'bakegjaer'
  | 'ecoli'
  | 'arke';

/** Symbolet som tegnes for organismen (se Glyfer.tsx). */
export type GlyphKind =
  | 'menneske'
  | 'ape'
  | 'hund'
  | 'katt'
  | 'hval'
  | 'fugl'
  | 'krokodille'
  | 'firfisle'
  | 'frosk'
  | 'fisk'
  | 'eik'
  | 'gran'
  | 'fluesopp'
  | 'gjaer'
  | 'bakterie'
  | 'arke';

export interface Organism {
  id: OrganismId;
  /** Norsk navn (liten forbokstav, som i løpende tekst). */
  name: string;
  /** Kort navn til trange etiketter (slektskapstreet). */
  short: string;
  /** Vitenskapelig navn (kursiv i visningen). */
  sci: string;
  glyph: GlyphKind;
  lineage: Record<Rank, Taxon>;
  /** Kort merknad, f.eks. om underart. */
  note?: string;
  /** Navnet er et vitenskapelig navn (E. coli) og skal stå i kursiv. */
  italic?: boolean;
}

/* ---------- Felles taksa (samme objekt = samme takson) ---------- */

const EUK: Taxon = { no: 'Eukaryoter', sci: 'Eukarya' };
const DYR: Taxon = { no: 'Dyr', sci: 'Animalia' };
const CHORDATA: Taxon = { no: 'Ryggstrengdyr', sci: 'Chordata' };
const MAMMALIA: Taxon = { no: 'Pattedyr', sci: 'Mammalia' };
const PRIMATES: Taxon = { no: 'Primater', sci: 'Primates' };
const HOMINIDAE: Taxon = { no: 'Menneskeaper', sci: 'Hominidae' };
const CARNIVORA: Taxon = { no: 'Rovdyr', sci: 'Carnivora' };
const CANIDAE: Taxon = { no: 'Hundefamilien', sci: 'Canidae' };
const CANIS: Taxon = { no: 'Hundeslekten', sci: 'Canis' };
const CANIS_LUPUS: Taxon = { no: 'ulv', sci: 'Canis lupus' };
const ACTINOPTERYGII: Taxon = { no: 'Strålefinnefisker', sci: 'Actinopterygii' };
const REPTILIA: Taxon = { no: 'Krypdyr', sci: 'Reptilia' };
const PLANTAE: Taxon = { no: 'Planter', sci: 'Plantae' };
const TRACHEOPHYTA: Taxon = { no: 'Karplanter', sci: 'Tracheophyta' };
const FUNGI: Taxon = { no: 'Sopper', sci: 'Fungi' };

function lineage(...taxa: [Taxon, Taxon, Taxon, Taxon, Taxon, Taxon, Taxon, Taxon]): Record<Rank, Taxon> {
  return Object.fromEntries(RANKS.map((r, i) => [r, taxa[i]!])) as Record<Rank, Taxon>;
}

export const ORGANISMS: readonly Organism[] = [
  {
    id: 'menneske',
    name: 'menneske',
    short: 'menneske',
    sci: 'Homo sapiens',
    glyph: 'menneske',
    lineage: lineage(EUK, DYR, CHORDATA, MAMMALIA, PRIMATES, HOMINIDAE, { sci: 'Homo' }, { no: 'menneske', sci: 'Homo sapiens' }),
  },
  {
    id: 'sjimpanse',
    name: 'sjimpanse',
    short: 'sjimpanse',
    sci: 'Pan troglodytes',
    glyph: 'ape',
    lineage: lineage(EUK, DYR, CHORDATA, MAMMALIA, PRIMATES, HOMINIDAE, { no: 'Sjimpanser', sci: 'Pan' }, { no: 'sjimpanse', sci: 'Pan troglodytes' }),
  },
  {
    id: 'hund',
    name: 'hund',
    short: 'hund',
    sci: 'Canis lupus familiaris',
    glyph: 'hund',
    lineage: lineage(EUK, DYR, CHORDATA, MAMMALIA, CARNIVORA, CANIDAE, CANIS, CANIS_LUPUS),
    note: 'Hunden er en tam underart av ulv: Canis lupus familiaris.',
  },
  {
    id: 'ulv',
    name: 'ulv',
    short: 'ulv',
    sci: 'Canis lupus',
    glyph: 'hund',
    lineage: lineage(EUK, DYR, CHORDATA, MAMMALIA, CARNIVORA, CANIDAE, CANIS, CANIS_LUPUS),
  },
  {
    id: 'katt',
    name: 'katt',
    short: 'katt',
    sci: 'Felis catus',
    glyph: 'katt',
    lineage: lineage(
      EUK,
      DYR,
      CHORDATA,
      MAMMALIA,
      CARNIVORA,
      { no: 'Kattefamilien', sci: 'Felidae' },
      { sci: 'Felis' },
      { no: 'katt', sci: 'Felis catus' },
    ),
  },
  {
    id: 'blahval',
    name: 'blåhval',
    short: 'blåhval',
    sci: 'Balaenoptera musculus',
    glyph: 'hval',
    lineage: lineage(
      EUK,
      DYR,
      CHORDATA,
      MAMMALIA,
      { no: 'Hvaler', sci: 'Cetacea' },
      { no: 'Finnhvaler', sci: 'Balaenopteridae' },
      { sci: 'Balaenoptera' },
      { no: 'blåhval', sci: 'Balaenoptera musculus' },
    ),
  },
  {
    id: 'kongeorn',
    name: 'kongeørn',
    short: 'kongeørn',
    sci: 'Aquila chrysaetos',
    glyph: 'fugl',
    lineage: lineage(
      EUK,
      DYR,
      CHORDATA,
      { no: 'Fugler', sci: 'Aves' },
      { no: 'Haukefugler', sci: 'Accipitriformes' },
      { no: 'Haukefamilien', sci: 'Accipitridae' },
      { sci: 'Aquila' },
      { no: 'kongeørn', sci: 'Aquila chrysaetos' },
    ),
  },
  {
    id: 'krokodille',
    name: 'nilkrokodille',
    short: 'krokodille',
    sci: 'Crocodylus niloticus',
    glyph: 'krokodille',
    lineage: lineage(
      EUK,
      DYR,
      CHORDATA,
      REPTILIA,
      { no: 'Krokodiller', sci: 'Crocodylia' },
      { no: 'Egentlige krokodiller', sci: 'Crocodylidae' },
      { sci: 'Crocodylus' },
      { no: 'nilkrokodille', sci: 'Crocodylus niloticus' },
    ),
  },
  {
    id: 'firfisle',
    name: 'nordfirfisle',
    short: 'firfisle',
    sci: 'Zootoca vivipara',
    glyph: 'firfisle',
    lineage: lineage(
      EUK,
      DYR,
      CHORDATA,
      REPTILIA,
      { no: 'Skjellkrypdyr', sci: 'Squamata' },
      { no: 'Egentlige øgler', sci: 'Lacertidae' },
      { sci: 'Zootoca' },
      { no: 'nordfirfisle', sci: 'Zootoca vivipara' },
    ),
  },
  {
    id: 'frosk',
    name: 'buttsnutet frosk',
    short: 'frosk',
    sci: 'Rana temporaria',
    glyph: 'frosk',
    lineage: lineage(
      EUK,
      DYR,
      CHORDATA,
      { no: 'Amfibier', sci: 'Amphibia' },
      { no: 'Froskedyr', sci: 'Anura' },
      { no: 'Egentlige frosker', sci: 'Ranidae' },
      { sci: 'Rana' },
      { no: 'buttsnutet frosk', sci: 'Rana temporaria' },
    ),
  },
  {
    id: 'laks',
    name: 'laks',
    short: 'laks',
    sci: 'Salmo salar',
    glyph: 'fisk',
    lineage: lineage(
      EUK,
      DYR,
      CHORDATA,
      ACTINOPTERYGII,
      { no: 'Laksefisker', sci: 'Salmoniformes' },
      { no: 'Laksefamilien', sci: 'Salmonidae' },
      { sci: 'Salmo' },
      { no: 'laks', sci: 'Salmo salar' },
    ),
  },
  {
    id: 'torsk',
    name: 'torsk',
    short: 'torsk',
    sci: 'Gadus morhua',
    glyph: 'fisk',
    lineage: lineage(
      EUK,
      DYR,
      CHORDATA,
      ACTINOPTERYGII,
      { no: 'Torskefisker', sci: 'Gadiformes' },
      { no: 'Torskefamilien', sci: 'Gadidae' },
      { sci: 'Gadus' },
      { no: 'torsk', sci: 'Gadus morhua' },
    ),
  },
  {
    id: 'eik',
    name: 'sommereik',
    short: 'eik',
    sci: 'Quercus robur',
    glyph: 'eik',
    lineage: lineage(
      EUK,
      PLANTAE,
      TRACHEOPHYTA,
      { no: 'Tofrøbladete', sci: 'Magnoliopsida' },
      { no: 'Bøkeordenen', sci: 'Fagales' },
      { no: 'Bøkefamilien', sci: 'Fagaceae' },
      { no: 'Eikeslekten', sci: 'Quercus' },
      { no: 'sommereik', sci: 'Quercus robur' },
    ),
  },
  {
    id: 'gran',
    name: 'gran',
    short: 'gran',
    sci: 'Picea abies',
    glyph: 'gran',
    lineage: lineage(
      EUK,
      PLANTAE,
      TRACHEOPHYTA,
      { no: 'Bartrær', sci: 'Pinopsida' },
      { no: 'Furuordenen', sci: 'Pinales' },
      { no: 'Furufamilien', sci: 'Pinaceae' },
      { no: 'Granslekten', sci: 'Picea' },
      { no: 'gran', sci: 'Picea abies' },
    ),
  },
  {
    id: 'fluesopp',
    name: 'rød fluesopp',
    short: 'fluesopp',
    sci: 'Amanita muscaria',
    glyph: 'fluesopp',
    lineage: lineage(
      EUK,
      FUNGI,
      { no: 'Stilksporesopper', sci: 'Basidiomycota' },
      { sci: 'Agaricomycetes' },
      { no: 'Skivesopper', sci: 'Agaricales' },
      { no: 'Fluesoppfamilien', sci: 'Amanitaceae' },
      { sci: 'Amanita' },
      { no: 'rød fluesopp', sci: 'Amanita muscaria' },
    ),
  },
  {
    id: 'bakegjaer',
    name: 'bakegjær',
    short: 'bakegjær',
    sci: 'Saccharomyces cerevisiae',
    glyph: 'gjaer',
    lineage: lineage(
      EUK,
      FUNGI,
      { no: 'Sekksporesopper', sci: 'Ascomycota' },
      { no: 'Gjærsopper', sci: 'Saccharomycetes' },
      { sci: 'Saccharomycetales' },
      { sci: 'Saccharomycetaceae' },
      { sci: 'Saccharomyces' },
      { no: 'bakegjær', sci: 'Saccharomyces cerevisiae' },
    ),
  },
  {
    id: 'ecoli',
    name: 'E. coli',
    italic: true,
    short: 'E. coli',
    sci: 'Escherichia coli',
    glyph: 'bakterie',
    lineage: lineage(
      { no: 'Bakterier', sci: 'Bacteria' },
      { no: 'Bakterier', sci: 'Bacteria' },
      { no: 'Proteobakterier', sci: 'Pseudomonadota' },
      { no: 'Gammaproteobakterier', sci: 'Gammaproteobacteria' },
      { sci: 'Enterobacterales' },
      { no: 'Enterobakterier', sci: 'Enterobacteriaceae' },
      { sci: 'Escherichia' },
      { sci: 'Escherichia coli' },
    ),
  },
  {
    id: 'arke',
    name: 'metanarke',
    short: 'arke',
    sci: 'Methanobrevibacter smithii',
    glyph: 'arke',
    lineage: lineage(
      { no: 'Arker', sci: 'Archaea' },
      { no: 'Arker', sci: 'Archaea' },
      { sci: 'Euryarchaeota' },
      { sci: 'Methanobacteria' },
      { sci: 'Methanobacteriales' },
      { sci: 'Methanobacteriaceae' },
      { sci: 'Methanobrevibacter' },
      { sci: 'Methanobrevibacter smithii' },
    ),
    note: 'Lever i tarmen hos mennesker og lager metan.',
  },
];

const BY_ID = new Map(ORGANISMS.map((o) => [o.id, o]));

export function organism(id: OrganismId): Organism {
  const o = BY_ID.get(id);
  if (!o) throw new Error(`Ukjent organisme: ${id}`);
  return o;
}

/** To taksa er det samme når de vitenskapelige navnene er like. */
export const sameTaxon = (a: Taxon, b: Taxon): boolean => a.sci === b.sci;

/**
 * Indeksen (0 = domene … 7 = art) til det laveste nivået de to organismene har felles, eller −1 når de hører til
 * ulike domener. Nivåene under et nivå der de er ulike, kan aldri være felles.
 */
export function lowestSharedRankIndex(a: Organism, b: Organism): number {
  let last = -1;
  for (let i = 0; i < RANKS.length; i++) {
    const r = RANKS[i]!;
    if (!sameTaxon(a.lineage[r], b.lineage[r])) break;
    last = i;
  }
  return last;
}

/** Forkortet artsnavn (slektsnavnet med forbokstav): «Methanobrevibacter smithii» → «M. smithii». */
export function abbreviateSpecies(sci: string): string {
  const [genus, ...rest] = sci.split(' ');
  if (!genus || rest.length === 0) return sci;
  return `${genus[0]}. ${rest.join(' ')}`;
}

/** Eksempelpar som viser ulike felles nivåer. */
export const PAIRS: readonly { id: string; label: string; a: OrganismId; b: OrganismId }[] = [
  { id: 'hund-ulv', label: 'Hund og ulv', a: 'hund', b: 'ulv' },
  { id: 'menneske-sjimpanse', label: 'Menneske og sjimpanse', a: 'menneske', b: 'sjimpanse' },
  { id: 'hund-katt', label: 'Hund og katt', a: 'hund', b: 'katt' },
  { id: 'hval-laks', label: 'Blåhval og laks', a: 'blahval', b: 'laks' },
  { id: 'eik-gran', label: 'Eik og gran', a: 'eik', b: 'gran' },
  { id: 'sopp-menneske', label: 'Fluesopp og menneske', a: 'fluesopp', b: 'menneske' },
  { id: 'ecoli-arke', label: 'E. coli og arke', a: 'ecoli', b: 'arke' },
];

/* ====================================================================== */
/* Slektskapstrær                                                           */
/* ====================================================================== */

/** Et knutepunkt i treet: en felles stamform (indre node) eller en nålevende organisme (blad). */
export type TreeNode = { leaf: OrganismId } | { name?: string; children: TreeNode[] };

export type TreeMode = 'utseende' | 'anatomi' | 'dna';

const L = (id: OrganismId): TreeNode => ({ leaf: id });
const N = (name: string | undefined, ...children: TreeNode[]): TreeNode => ({ name, children });

/**
 * Tre etter ytre likhet: grupper av det man ser med øynene (hvordan organismen ser ut og lever). Hvalen er en
 * «hvalfisk», soppen står stille og vokser opp av jorda som en plante, og alt som er for lite til å sees uten
 * mikroskop havner i én gruppe. Gruppene sier lite om slektskap, så treet har ingen indre struktur.
 */
const TREE_UTSEENDE: TreeNode = N(
  'Alt levende',
  N('Planter (står fast)', L('eik'), L('gran'), L('fluesopp')),
  N('Dyr med pels', L('menneske'), L('sjimpanse'), L('hund'), L('ulv'), L('katt')),
  N('Dyr som svømmer', L('blahval'), L('laks'), L('torsk')),
  N('Dyr som flyr', L('kongeorn')),
  N('Dyr som kryper', L('krokodille'), L('firfisle'), L('frosk')),
  N('Små organismer', L('bakegjaer'), L('ecoli'), L('arke')),
);

/**
 * Tre etter anatomi og mikroskop (morfologi), slik det så ut i skolebøkene før DNA-sekvensering (ca. 1970):
 * fem riker (Whittaker 1969), hvalene er pattedyr (lunger, melk, hår), sopper er et eget rike, og bakterier og arker
 * er én gruppe uten cellekjerne (prokaryoter). Krypdyr, fugler og pattedyr er tre likestilte klasser av amnioter
 * (dyr med fosterhinner), der krypdyrene er samlet fordi de har skjell og er vekselvarme. Rekkefølgen mellom klassene,
 * mellom pattedyrordenene og mellom planter, sopper og dyr er uavklart (flere greiner fra samme knutepunkt).
 */
const TREE_ANATOMI: TreeNode = N(
  'Alt levende',
  N('Prokaryoter (uten cellekjerne)', L('ecoli'), L('arke')),
  N(
    'Eukaryoter (med cellekjerne)',
    N('Planter', L('eik'), L('gran')),
    N('Sopper', L('fluesopp'), L('bakegjaer')),
    N(
      'Ryggstrengdyr',
      N('Fisker', L('laks'), L('torsk')),
      N(
        'Firfotinger',
        L('frosk'),
        N(
          'Amnioter',
          N('Krypdyr', L('krokodille'), L('firfisle')),
          N('Fugler', L('kongeorn')),
          N('Pattedyr', N('Primater', L('menneske'), L('sjimpanse')), N('Rovdyr', L('katt'), N('Hundeslekten', L('hund'), L('ulv'))), L('blahval')),
        ),
      ),
    ),
  ),
);

/**
 * Tre etter DNA (molekylære data), slik det ser ut i dag: tre domener der arkene er nærmere i slekt med eukaryotene enn
 * med bakteriene (Woese, rRNA, 1977–1990), sopper er nærmere i slekt med dyr enn med planter, fuglene hører til blant
 * krypdyrene med krokodillene som nærmeste nålevende slektninger (arkosaurer), og hvalene er nærmere i slekt med
 * rovdyrene enn med primatene (Laurasiatheria). Hund og ulv er samme art.
 */
const TREE_DNA: TreeNode = N(
  'Felles stamform for alt liv',
  N('Bakterier', L('ecoli')),
  N(
    'Arker og eukaryoter',
    N('Arker', L('arke')),
    N(
      'Eukaryoter',
      N('Planter', L('eik'), L('gran')),
      N(
        'Sopper og dyr',
        N('Sopper', L('fluesopp'), L('bakegjaer')),
        N(
          'Ryggstrengdyr',
          N('Strålefinnefisker', L('laks'), L('torsk')),
          N(
            'Firfotinger',
            L('frosk'),
            N(
              'Amnioter',
              N('Pattedyr', N('Primater', L('menneske'), L('sjimpanse')), N('Hvaler og rovdyr', L('blahval'), N('Rovdyr', L('katt'), N('Ulv og hund', L('ulv'), L('hund'))))),
              N('Krypdyr med fugler', L('firfisle'), N('Arkosaurer', L('krokodille'), L('kongeorn'))),
            ),
          ),
        ),
      ),
    ),
  ),
);

export const TREES: Record<TreeMode, TreeNode> = { utseende: TREE_UTSEENDE, anatomi: TREE_ANATOMI, dna: TREE_DNA };

export const TREE_MODE_NAMES: Record<TreeMode, string> = {
  utseende: 'Ytre likhet',
  anatomi: 'Anatomi (morfologi)',
  dna: 'DNA (molekylære data)',
};

export const isLeaf = (n: TreeNode): n is { leaf: OrganismId } => 'leaf' in n;

/** Bladene (organismene) i treet i rekkefølge ovenfra og ned. */
export function leaves(n: TreeNode): OrganismId[] {
  return isLeaf(n) ? [n.leaf] : n.children.flatMap(leaves);
}

/** Stien fra rota ned til bladet (liste av knutepunkter), eller null når organismen ikke er i treet. */
export function pathTo(root: TreeNode, id: OrganismId): TreeNode[] | null {
  if (isLeaf(root)) return root.leaf === id ? [root] : null;
  for (const c of root.children) {
    const p = pathTo(c, id);
    if (p) return [root, ...p];
  }
  return null;
}

/** Nærmeste felles stamform (det dypeste knutepunktet som har begge organismene under seg). */
export function mrca(root: TreeNode, a: OrganismId, b: OrganismId): TreeNode {
  const pa = pathTo(root, a);
  const pb = pathTo(root, b);
  if (!pa || !pb) throw new Error('Organismen finnes ikke i treet');
  let last: TreeNode = root;
  for (let i = 0; i < Math.min(pa.length, pb.length); i++) {
    if (pa[i] !== pb[i]) break;
    last = pa[i]!;
  }
  return last;
}

/** Dybden til et knutepunkt (rota = 0). */
export function depthOf(root: TreeNode, node: TreeNode): number {
  const walk = (n: TreeNode, d: number): number => {
    if (n === node) return d;
    if (isLeaf(n)) return -1;
    for (const c of n.children) {
      const r = walk(c, d + 1);
      if (r >= 0) return r;
    }
    return -1;
  };
  return walk(root, 0);
}

/**
 * Er x nærmere i slekt med y eller med z? Den som har den nyeste (dypeste) felles stamformen med x, er nærmest.
 * «lik» når x har den samme nærmeste felles stamformen med begge (for eksempel når flere greiner går ut fra samme
 * knutepunkt).
 */
export function closer(root: TreeNode, x: OrganismId, y: OrganismId, z: OrganismId): 'y' | 'z' | 'lik' {
  const dy = depthOf(root, mrca(root, x, y));
  const dz = depthOf(root, mrca(root, x, z));
  return dy > dz ? 'y' : dz > dy ? 'z' : 'lik';
}

/** Nærmeste felles stamform for en hel gruppe: det dypeste knutepunktet som har alle under seg. */
export function mrcaOfGroup(root: TreeNode, group: readonly OrganismId[]): TreeNode {
  const path = group.length ? pathTo(root, group[0]!) : null;
  if (!path) throw new Error('Tom gruppe eller ukjent organisme');
  for (let i = path.length - 1; i >= 0; i--) {
    const under = leaves(path[i]!);
    if (group.every((g) => under.includes(g))) return path[i]!;
  }
  return root;
}

/**
 * Er gruppen en klade (en felles stamform med alle etterkommerne) i treet? Krypdyr uten fugler er det ikke i DNA-treet:
 * den nærmeste felles stamformen til krokodillen og firfisla er også stamformen til fuglene.
 */
export function isClade(root: TreeNode, group: readonly OrganismId[]): boolean {
  return leaves(mrcaOfGroup(root, group)).length === new Set(group).size;
}

/* ---------- Plassering av treet (kladogram med rota til venstre) ---------- */

export interface PlacedNode {
  node: TreeNode;
  /** Dybde (rota = 0). Blad tegnes helt til høyre uansett dybde. */
  depth: number;
  /** Rad (0 = øverst); for indre knutepunkt midt mellom første og siste barn. */
  row: number;
  parent: PlacedNode | null;
  children: PlacedNode[];
}

/** Plasser alle knutepunktene: bladene får hver sin rad, indre knutepunkt midt mellom barna. */
export function layoutTree(root: TreeNode): { nodes: PlacedNode[]; maxDepth: number; rows: number } {
  const nodes: PlacedNode[] = [];
  let row = 0;
  let maxDepth = 0;
  const walk = (n: TreeNode, depth: number, parent: PlacedNode | null): PlacedNode => {
    const p: PlacedNode = { node: n, depth, row: 0, parent, children: [] };
    nodes.push(p);
    maxDepth = Math.max(maxDepth, depth);
    if (isLeaf(n)) p.row = row++;
    else {
      p.children = n.children.map((c) => walk(c, depth + 1, p));
      p.row = (p.children[0]!.row + p.children.at(-1)!.row) / 2;
    }
    return p;
  };
  walk(root, 0, null);
  return { nodes, maxDepth, rows: row };
}

/* ---------- Spørsmål om slektskap ---------- */

export interface Question {
  id: 'hval' | 'fugl' | 'sopp' | 'arke';
  label: string;
  x: OrganismId;
  y: OrganismId;
  z: OrganismId;
}

/** Klassiske eksempler på at kriteriene har endret seg. */
export const QUESTIONS: readonly Question[] = [
  { id: 'hval', label: 'Er hvalen en fisk?', x: 'blahval', y: 'laks', z: 'hund' },
  { id: 'fugl', label: 'Er fugler krypdyr?', x: 'kongeorn', y: 'krokodille', z: 'hund' },
  { id: 'sopp', label: 'Er sopp planter?', x: 'fluesopp', y: 'eik', z: 'menneske' },
  { id: 'arke', label: 'Er arker bakterier?', x: 'arke', y: 'ecoli', z: 'bakegjaer' },
];

/**
 * Myke bindestreker (U+00AD) i lange sammensatte ord, så de kan deles i trange avlesninger på mobil:
 * «Ryggstrengdyr» → «Rygg­streng­dyr». Synes bare når ordet faktisk deles.
 */
export function softHyphens(text: string): string {
  return text.replace(/\p{L}{11,}/gu, (w) =>
    w.replace(/(?<=\p{L}{3})(streng|dyr|fisker|finne|bakterier|aper|fugler|krokodiller|planter|sopper|tinger|kjerne|stamform|øgler)/gu, '\u00AD$1'),
  );
}
