/**
 * Faste farger for biologivisualiseringene. Verdiene er CSS-variabler (styles/viz.css, blokken «Biologi») og fungerer i
 * både lyst og mørkt tema, også med biologitemaet «Salvie». Bruk aldri egne fargekoder i komponentene.
 *
 * Celledeler og organismer har en fyllfarge og en kantfarge (`{ fill, line }`): lys fyll med mettet kant i lyst tema,
 * mørk fyll med lys kant i mørkt tema. Tekst oppå en fylt form skrives med `VIZ.ink`.
 */

export interface BioPaint {
  /** Fyllfarge (lys i lyst tema, mørk i mørkt tema). */
  fill: string;
  /** Kantfarge og farge på detaljer (mettet i lyst tema, lys i mørkt tema). */
  line: string;
}

const v = (name: string) => `var(--bio-${name})`;
const paint = (name: string): BioPaint => ({ fill: v(name), line: v(`${name}-line`) });

/** Foreldreopphav til et kromosom: fra mor eller fra far. */
export type Opphav = 'mor' | 'far';

export const BIO = {
  /* ---------- Cellen ---------- */
  /** Cytoplasma (fyll inne i cellemembranen). */
  cytoplasma: v('cytoplasm'),
  /** Cellemembranen (strek rundt cellen og i membranbildet). */
  membran: v('membrane'),
  /** Fosfolipidene i membranbildet: hydrofilt hode og hydrofobe haler. */
  lipidHode: v('lipid-head'),
  lipidHale: v('lipid-tail'),
  /** Cellekjernen (kjernemembran og karyoplasma), kjernelegemet og DNA/kromatin. */
  kjerne: paint('nucleus'),
  kjernelegeme: v('nucleolus'),
  dna: v('dna'),
  mitokondrie: paint('mito'),
  kloroplast: paint('chloro'),
  /** Grana/tylakoider, og ellers alt som står for klorofyll og fotosyntese. */
  klorofyll: v('chlorophyll'),
  cellevegg: paint('wall'),
  vakuole: paint('vacuole'),
  /** Endoplasmatisk nettverk (glatt og kornet). */
  er: paint('er'),
  golgi: paint('golgi'),
  ribosom: v('ribosome'),
  lysosom: paint('lysosome'),
  cytoskjelett: v('cytoskeleton'),
  /** Kapselen rundt en bakteriecelle (gjennomsiktig fyll). */
  kapsel: v('capsule'),

  /* ---------- Membrantransport ---------- */
  /** Proteiner i membranen (kanalprotein, bæreprotein, pumpe, akvaporin, reseptor): rolig grå, så partiklene synes. */
  protein: paint('protein'),
  /** ATP og energikrevende prosesser (aktiv transport). */
  atp: v('atp'),
  /** Signalstoff (hormon, nevrotransmitter) som binder seg til en reseptor. */
  signal: v('signal'),
  /** Oppløst stoff i diffusjon og osmose (partikler). */
  opplost: v('solute'),
  /** Ioner i natrium-kalium-pumpa. */
  natrium: v('na'),
  kalium: v('k'),
  /** Vann: vannmolekyler, xylem og vanntransport. */
  vann: v('water'),
  /** Svak vannfarge til fyll av løsninger og kar. */
  vannFyll: v('water-fill'),
  /** Sukker: glukose, sukrose i floem. */
  sukker: v('sugar'),

  /* ---------- Blod og immunforsvar ---------- */
  /** Oksygenrikt blod (arterieblod i det store kretsløpet). */
  oksygenrikt: v('blood-o2'),
  /** Oksygenfattig blod (veneblod i det store kretsløpet), tegnet blått som i lærebøkene. */
  oksygenfattig: v('blood-co2'),
  rodtBlodlegeme: paint('rbc'),
  /** Hvite blodlegemer og andre immunceller (lymfocytter, makrofager). */
  immuncelle: paint('immune'),
  antistoff: v('antibody'),
  /** Antigener på overflaten av virus og bakterier. */
  antigen: v('antigen'),

  /* ---------- Organismer og smittestoffer ---------- */
  bakterie: paint('bacterium'),
  virus: paint('virus'),
  sopp: paint('fungus'),
  plante: paint('plant'),
  /** Stamme og greiner. */
  ved: v('wood'),
  pattedyr: paint('animal'),
  fisk: paint('fish'),
  fugl: paint('bird'),
  insekt: paint('insect'),
  menneske: paint('human'),
  /** Døde celler og individer (dødsfasen i bakterievekst, døde individer). */
  dod: v('dead'),

  /* ---------- Kromosomer ---------- */
  /**
   * Homologe kromosompar: indeks 0–2 er paret (1, 2, 3). Kromosomer fra mor har varme farger (rød, oransje, magenta),
   * fra far kalde (blå, blågrønn, fiolett). Bruk `kromosomFarge(par, opphav)`.
   */
  kromosom: {
    mor: [v('chr-m1'), v('chr-m2'), v('chr-m3')],
    far: [v('chr-f1'), v('chr-f2'), v('chr-f3')],
  },

  /* ---------- Smitte (SIR-modellen) ---------- */
  /** S = mottakelige (friske), I = smittet (syke og smittsomme), R = immune etter sykdom, V = immune etter vaksine. */
  sir: { S: v('s'), I: v('i'), R: v('r'), V: v('v') },

  /* ---------- Populasjoner ---------- */
  byttedyr: v('prey'),
  rovdyr: v('predator'),
  /** Bæreevnen K (stiplet linje). */
  baereevne: v('capacity'),
  /** Høsting, fangst og fiske. */
  hosting: v('harvest'),
  /** Andre populasjonskurver i fast rekkefølge. */
  serie: [v('pop-1'), v('pop-2'), v('pop-3'), v('pop-4')],
} as const;

/** Fargen til kromosompar `par` (0, 1, 2; går rundt for flere) fra mor eller far. */
export function kromosomFarge(par: number, opphav: Opphav): string {
  const list = BIO.kromosom[opphav];
  const i = ((Math.round(par) % list.length) + list.length) % list.length;
  return list[i]!;
}
