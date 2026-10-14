/**
 * Mineraler for geofag: mineralgruppene etter aniongruppe, silikatstrukturene, egenskapene som brukes til å bestemme
 * et mineral i felt (hardhet, strek, glans, spalting, syre, magnet) og et filter som finner mulige mineraler fra
 * observasjonene. Ren logikk uten React.
 *
 *   MINERALER.kvarts.hardhet                         // [7, 7]
 *   hardhetFraRissetester([{ redskap: 'kniv', risses: false }])  // { min: 5,5, max: 10 }
 *   muligeMineraler({ glans: 'metall', strek: 'rodbrun' })        // [hematitt]
 */

/** Mineralgruppene etter aniongruppe (pluss rene grunnstoffer). */
export type MineralGruppeId = 'silikat' | 'karbonat' | 'oksid' | 'sulfid' | 'sulfat' | 'halogenid' | 'fosfat' | 'grunnstoff';

/** En mineralgruppe med aniongruppen som gir navnet. */
export interface MineralGruppe {
  id: MineralGruppeId;
  /** Flertall i løpende tekst: «silikater». */
  navn: string;
  /** Aniongruppen med senket og hevet skrift (Unicode): «SiO₄⁴⁻». Tom for rene grunnstoffer. */
  aniongruppe: string;
  /** Kort forklaring til elevene. */
  beskrivelse: string;
}

/*
 * Kilde: vanlig inndeling i mineralogien etter aniongruppe (Klein og Dutrow, «Manual of Mineral Science», og
 * Store norske leksikon «mineral»). Rekkefølgen følger hvor viktige gruppene er i jordskorpa.
 */
export const MINERALGRUPPER: Readonly<Record<MineralGruppeId, MineralGruppe>> = {
  silikat: {
    id: 'silikat',
    navn: 'silikater',
    aniongruppe: 'SiO₄⁴⁻',
    beskrivelse: 'Bygd av silisium–oksygen-tetraedre. Over 90 % av jordskorpa.',
  },
  karbonat: {
    id: 'karbonat',
    navn: 'karbonater',
    aniongruppe: 'CO₃²⁻',
    beskrivelse: 'Kalkspat og dolomitt. Bruser i saltsyre og danner kalkstein og marmor.',
  },
  oksid: {
    id: 'oksid',
    navn: 'oksider',
    aniongruppe: 'O²⁻',
    beskrivelse: 'Metall bundet til oksygen, f.eks. jernmalmene magnetitt og hematitt.',
  },
  sulfid: {
    id: 'sulfid',
    navn: 'sulfider',
    aniongruppe: 'S²⁻',
    beskrivelse: 'Metall bundet til svovel. De viktigste malmene for kobber, sink og bly.',
  },
  sulfat: {
    id: 'sulfat',
    navn: 'sulfater',
    aniongruppe: 'SO₄²⁻',
    beskrivelse: 'Gips og andre mineraler som felles ut når sjøvann fordamper.',
  },
  halogenid: {
    id: 'halogenid',
    navn: 'halogenider',
    aniongruppe: 'Cl⁻, F⁻',
    beskrivelse: 'Steinsalt (halitt) og flusspat.',
  },
  fosfat: {
    id: 'fosfat',
    navn: 'fosfater',
    aniongruppe: 'PO₄³⁻',
    beskrivelse: 'Apatitt, som gir fosfor til kunstgjødsel.',
  },
  grunnstoff: {
    id: 'grunnstoff',
    navn: 'rene grunnstoffer',
    aniongruppe: '',
    beskrivelse: 'Ett grunnstoff alene: gull, sølv, grafitt og diamant.',
  },
};

/** Hvordan SiO₄-tetraedrene er koblet sammen i et silikat. */
export type SilikatStrukturId = 'oy' | 'par' | 'ring' | 'enkeltkjede' | 'dobbeltkjede' | 'sjikt' | 'rammeverk';

/** En silikatstruktur: hvor mange oksygenatomer hvert tetraeder deler, og hva det gir. */
export interface SilikatStruktur {
  id: SilikatStrukturId;
  /** «øysilikater». */
  navn: string;
  /** Kort beskrivelse av koblingen: «enkle tetraedre bundet sammen av metallioner». */
  kobling: string;
  /** Antall oksygenatomer hvert tetraeder deler med naboer (dobbeltkjeder veksler mellom 2 og 3, i snitt 2,5). */
  delteO: number;
  /** Forholdet Si : O i den gjentatte enheten. */
  siO: string;
  /** Den gjentatte enheten: «SiO₄⁴⁻». */
  enhet: string;
  /** Mineral-id-er i `MINERALER` (og eventuelt andre kjente mineraler som tekst). */
  eksempler: readonly string[];
  /** Hva strukturen gir som kan sees i håndstykket. */
  kjennetegn: string;
}

/*
 * Kilde: silikatklassifikasjonen etter polymeriseringsgrad (Klein og Dutrow, «Manual of Mineral Science»): neso-,
 * soro-, syklo-, ino- (enkle og doble kjeder), fyllo- og tektosilikater. Norske navn som i lærebøkene i geofag.
 * Sortert fra minst til mest sammenkoblet.
 */
export const SILIKATSTRUKTURER: readonly SilikatStruktur[] = [
  {
    id: 'oy',
    navn: 'øysilikater',
    kobling: 'enkle tetraedre bundet sammen av metallioner',
    delteO: 0,
    siO: '1 : 4',
    enhet: 'SiO₄⁴⁻',
    eksempler: ['olivin', 'granat', 'zirkon', 'topas'],
    kjennetegn: 'Harde og tette, uten god spalting.',
  },
  {
    id: 'par',
    navn: 'parsilikater',
    kobling: 'to tetraedre som deler ett oksygen',
    delteO: 1,
    siO: '2 : 7',
    enhet: 'Si₂O₇⁶⁻',
    eksempler: ['epidot'],
    kjennetegn: 'Sjeldne i bergartene; epidot er vanlig i metamorfe bergarter.',
  },
  {
    id: 'ring',
    navn: 'ringsilikater',
    kobling: 'ringer av tre, fire eller seks tetraedre',
    delteO: 2,
    siO: '1 : 3',
    enhet: 'Si₆O₁₈¹²⁻',
    eksempler: ['beryll', 'turmalin'],
    kjennetegn: 'Lange sekskantede krystaller.',
  },
  {
    id: 'enkeltkjede',
    navn: 'kjedesilikater',
    kobling: 'enkle kjeder der hvert tetraeder deler to oksygen',
    delteO: 2,
    siO: '1 : 3',
    enhet: 'SiO₃²⁻',
    eksempler: ['augitt'],
    kjennetegn: 'Pyroksener: to spalteretninger nesten vinkelrett på hverandre (omtrent 87° og 93°).',
  },
  {
    id: 'dobbeltkjede',
    navn: 'dobbeltkjedesilikater',
    kobling: 'to kjeder bundet sammen, annethvert tetraeder deler tre oksygen',
    delteO: 2.5,
    siO: '4 : 11',
    enhet: 'Si₄O₁₁⁶⁻',
    eksempler: ['hornblende'],
    kjennetegn: 'Amfiboler: to spalteretninger på omtrent 56° og 124°.',
  },
  {
    id: 'sjikt',
    navn: 'sjiktsilikater',
    kobling: 'flate sjikt der hvert tetraeder deler tre oksygen',
    delteO: 3,
    siO: '2 : 5',
    enhet: 'Si₂O₅²⁻',
    eksempler: ['muskovitt', 'biotitt', 'kloritt', 'talk', 'kaolinitt'],
    kjennetegn: 'Spaltes i tynne flak i én retning (glimmer, leirmineraler).',
  },
  {
    id: 'rammeverk',
    navn: 'rammesilikater',
    kobling: 'tredimensjonalt nettverk der hvert tetraeder deler alle fire oksygen',
    delteO: 4,
    siO: '1 : 2',
    enhet: 'SiO₂',
    eksempler: ['kvarts', 'kalifeltspat', 'plagioklas', 'sanidin'],
    kjennetegn: 'Kvarts og feltspat: de vanligste mineralene i jordskorpa.',
  },
];

/** Glans slik den beskrives i felt. */
export type Glans = 'metall' | 'glass' | 'perlemor' | 'fett' | 'silke' | 'diamant' | 'matt';

/** Norske navn på glansen («metallglans»). */
export const GLANS_NAVN: Readonly<Record<Glans, string>> = {
  metall: 'metallglans',
  glass: 'glassglans',
  perlemor: 'perlemorglans',
  fett: 'fettglans',
  silke: 'silkeglans',
  diamant: 'diamantglans',
  matt: 'matt',
};

/** Fargen på streken (pulveret) på en strekplate. Mineraler hardere enn plata gir ingen strek og regnes som hvit. */
export type Strekfarge = 'hvit' | 'gra' | 'svart' | 'gronnsvart' | 'rodbrun' | 'gulbrun' | 'gull';

/** Norske navn på strekfargene. */
export const STREK_NAVN: Readonly<Record<Strekfarge, string>> = {
  hvit: 'hvit',
  gra: 'grå',
  svart: 'svart',
  gronnsvart: 'grønnsvart',
  rodbrun: 'rødbrun',
  gulbrun: 'gulbrun',
  gull: 'gullgul',
};

/**
 * Fargetone til tegningen av et mineral (`Krystall`, `Steinprove`). Bare en nøkkel: komponenten velger fargen fra
 * temaet, så mineralene virker i både lyst og mørkt tema.
 */
export type MineralTone =
  | 'fargelos'
  | 'hvit'
  | 'gra'
  | 'svart'
  | 'rosa'
  | 'rod'
  | 'brun'
  | 'gul'
  | 'gronn'
  | 'fiolett'
  | 'messing'
  | 'solv'
  | 'gull';

/** Alle tonene i fast rekkefølge (til galleriet). */
export const MINERAL_TONER: readonly MineralTone[] = [
  'fargelos',
  'hvit',
  'gra',
  'svart',
  'rosa',
  'rod',
  'brun',
  'gul',
  'gronn',
  'fiolett',
  'messing',
  'solv',
  'gull',
];

/** Krystallformene `Krystall` kan tegne. */
export type Krystallform = 'prisme' | 'rombeeder' | 'terning' | 'oktaeder' | 'tavle' | 'dodekaeder';

/** Id-ene til mineralene i `MINERALER` (ASCII: `solv` er sølv). */
export type MineralId =
  | 'kvarts'
  | 'kalifeltspat'
  | 'plagioklas'
  | 'sanidin'
  | 'muskovitt'
  | 'biotitt'
  | 'hornblende'
  | 'augitt'
  | 'olivin'
  | 'granat'
  | 'zirkon'
  | 'topas'
  | 'kloritt'
  | 'talk'
  | 'kaolinitt'
  | 'kalkspat'
  | 'dolomitt'
  | 'gips'
  | 'halitt'
  | 'flusspat'
  | 'apatitt'
  | 'korund'
  | 'magnetitt'
  | 'hematitt'
  | 'ilmenitt'
  | 'rutil'
  | 'pyritt'
  | 'kobberkis'
  | 'blyglans'
  | 'sinkblende'
  | 'molybdenglans'
  | 'gull'
  | 'solv'
  | 'grafitt'
  | 'diamant';

/** Ett mineral med egenskapene som brukes til å kjenne det igjen. */
export interface Mineral {
  id: MineralId;
  /** Norsk navn i løpende tekst: «kalkspat». */
  navn: string;
  /** Andre navn eleven kan møte: «kalsitt». */
  andreNavn?: readonly string[];
  /** Kjemisk formel med Unicode-senket skrift: «CaCO₃». Bruk `Formel`/`TFormel` når formelen står ved tekst. */
  formel: string;
  gruppe: MineralGruppeId;
  /** Aniongruppen i dette mineralet (som i gruppen, men pyritt har S₂²⁻). */
  aniongruppe: string;
  /** Silikatstrukturen, bare for silikater. */
  silikatstruktur?: SilikatStrukturId;
  /** Hardhet på Mohs' skala [min, maks]. */
  hardhet: readonly [number, number];
  /** Tetthet i g/cm³ [min, maks]. */
  tetthet: readonly [number, number];
  /** Glans; den første er den vanligste. */
  glans: readonly Glans[];
  /** Strekfarge; den første er den vanligste. */
  strek: readonly Strekfarge[];
  /** Streken med ord: «rødbrun». */
  strekTekst: string;
  /** Antall spalteretninger (0 = ingen god spalting, bare brudd). */
  spalting: 0 | 1 | 2 | 3 | 4 | 6;
  /** Spaltingen med ord: «tre retninger, ikke vinkelrett (rombeeder)». */
  spaltingTekst: string;
  /** Fargen med ord: «fargeløs, hvit, røykgrå». */
  fargeTekst: string;
  /** Fargetone til tegningen. */
  tone: MineralTone;
  /** Krystallform til `Krystall`, eller null når mineralet vanligvis er korn eller masse. */
  krystallform: Krystallform | null;
  /** Reaksjon med kald, fortynnet saltsyre: `'ja'`, `'pulver'` (bare når det er skrapt til pulver) eller `'nei'`. */
  bruser: 'ja' | 'pulver' | 'nei';
  /** Om en magnet trekker: `'sterkt'`, `'svakt'` eller `'nei'`. */
  magnetisk: 'sterkt' | 'svakt' | 'nei';
  /** Andre kjennetegn: «smaker salt», «bøyelige flak». */
  kjennetegn?: string;
  /** Kjent norsk forekomst, eller null. */
  norsk: string | null;
}

type M = Omit<Mineral, 'id' | 'aniongruppe'> & { aniongruppe?: string };

/*
 * Kilder: hardhet, tetthet, glans, strek og spalting fra mineraldatabasene Mindat og Webmineral og Klein og Dutrow,
 * «Manual of Mineral Science» (avrundet; tetthet i g/cm³). Mineraler med variabel sammensetning (biotitt, hornblende,
 * augitt, olivin, granat, kloritt) har intervaller som dekker de vanlige variantene. Norske forekomster etter NGU
 * og Store norske leksikon (Åheim, Tellnes, Engebø, Knaben, Løkken, Sydvaranger, Rana, Mofjellet, Skaland, Drag,
 * Kongsberg, Brønnøy).
 */
const DATA: Record<MineralId, M> = {
  kvarts: {
    navn: 'kvarts',
    formel: 'SiO₂',
    gruppe: 'silikat',
    silikatstruktur: 'rammeverk',
    hardhet: [7, 7],
    tetthet: [2.65, 2.65],
    glans: ['glass', 'fett'],
    strek: ['hvit'],
    strekTekst: 'hvit (risser strekplata)',
    spalting: 0,
    spaltingTekst: 'ingen spalting, skjellformet (muslig) brudd',
    fargeTekst: 'fargeløs, hvit, røykgrå, rosa eller fiolett',
    tone: 'fargelos',
    krystallform: 'prisme',
    bruser: 'nei',
    magnetisk: 'nei',
    kjennetegn: 'Risser glass. Sekskantede krystaller med spiss.',
    norsk: 'Drag i Tysfjord (svært ren kvarts)',
  },
  kalifeltspat: {
    navn: 'kalifeltspat',
    andreNavn: ['ortoklas', 'mikroklin'],
    formel: 'KAlSi₃O₈',
    gruppe: 'silikat',
    silikatstruktur: 'rammeverk',
    hardhet: [6, 6.5],
    tetthet: [2.55, 2.63],
    glans: ['glass'],
    strek: ['hvit'],
    strekTekst: 'hvit',
    spalting: 2,
    spaltingTekst: 'to retninger, vinkelrett',
    fargeTekst: 'rosa, laksefarget, hvit eller grå',
    tone: 'rosa',
    krystallform: null,
    bruser: 'nei',
    magnetisk: 'nei',
    kjennetegn: 'Gir granitt den rosa fargen.',
    norsk: 'pegmatitter i Evje og Iveland og i Østfold',
  },
  plagioklas: {
    navn: 'plagioklas',
    formel: 'NaAlSi₃O₈–CaAl₂Si₂O₈',
    gruppe: 'silikat',
    silikatstruktur: 'rammeverk',
    hardhet: [6, 6.5],
    tetthet: [2.62, 2.76],
    glans: ['glass', 'perlemor'],
    strek: ['hvit'],
    strekTekst: 'hvit',
    spalting: 2,
    spaltingTekst: 'to retninger, nesten vinkelrett',
    fargeTekst: 'hvit, grå eller blågrå',
    tone: 'hvit',
    krystallform: null,
    bruser: 'nei',
    magnetisk: 'nei',
    kjennetegn: 'Fine, parallelle striper på spalteflatene.',
    norsk: 'anortositt i Rogaland',
  },
  sanidin: {
    navn: 'sanidin',
    formel: '(K,Na)AlSi₃O₈',
    gruppe: 'silikat',
    silikatstruktur: 'rammeverk',
    hardhet: [6, 6],
    tetthet: [2.56, 2.62],
    glans: ['glass'],
    strek: ['hvit'],
    strekTekst: 'hvit',
    spalting: 2,
    spaltingTekst: 'to retninger, vinkelrett',
    fargeTekst: 'fargeløs eller hvit, ofte klar',
    tone: 'fargelos',
    krystallform: 'tavle',
    bruser: 'nei',
    magnetisk: 'nei',
    kjennetegn: 'Feltspat i lava og vulkansk aske; brukes til K–Ar-datering av utbrudd.',
    norsk: null,
  },
  muskovitt: {
    navn: 'muskovitt',
    andreNavn: ['lys glimmer'],
    formel: 'KAl₂(AlSi₃O₁₀)(OH)₂',
    gruppe: 'silikat',
    silikatstruktur: 'sjikt',
    hardhet: [2, 2.5],
    tetthet: [2.76, 2.88],
    glans: ['perlemor', 'glass'],
    strek: ['hvit'],
    strekTekst: 'hvit',
    spalting: 1,
    spaltingTekst: 'én retning, perfekt: tynne, bøyelige flak',
    fargeTekst: 'fargeløs, sølvaktig eller lys brun',
    tone: 'solv',
    krystallform: 'tavle',
    bruser: 'nei',
    magnetisk: 'nei',
    kjennetegn: 'Flakene er gjennomsiktige og spretter tilbake når de bøyes.',
    norsk: 'pegmatitter (tidligere glimmergruver)',
  },
  biotitt: {
    navn: 'biotitt',
    andreNavn: ['mørk glimmer'],
    formel: 'K(Mg,Fe)₃(AlSi₃O₁₀)(OH)₂',
    gruppe: 'silikat',
    silikatstruktur: 'sjikt',
    hardhet: [2.5, 3],
    tetthet: [2.7, 3.3],
    glans: ['glass', 'perlemor'],
    strek: ['hvit', 'gra'],
    strekTekst: 'hvit til grå',
    spalting: 1,
    spaltingTekst: 'én retning, perfekt: tynne, bøyelige flak',
    fargeTekst: 'svart eller mørk brun',
    tone: 'svart',
    krystallform: 'tavle',
    bruser: 'nei',
    magnetisk: 'nei',
    kjennetegn: 'Svarte, blanke flak i granitt og gneis.',
    norsk: null,
  },
  hornblende: {
    navn: 'hornblende',
    andreNavn: ['amfibol'],
    formel: 'Ca₂(Mg,Fe,Al)₅(Si,Al)₈O₂₂(OH)₂',
    gruppe: 'silikat',
    silikatstruktur: 'dobbeltkjede',
    hardhet: [5, 6],
    tetthet: [3.0, 3.4],
    glans: ['glass'],
    strek: ['hvit', 'gra'],
    strekTekst: 'hvit til grågrønn',
    spalting: 2,
    spaltingTekst: 'to retninger på omtrent 56° og 124°',
    fargeTekst: 'svart eller mørk grønn',
    tone: 'svart',
    krystallform: 'prisme',
    bruser: 'nei',
    magnetisk: 'nei',
    kjennetegn: 'Lange, mørke krystaller; skilles fra augitt på spaltevinkelen.',
    norsk: null,
  },
  augitt: {
    navn: 'augitt',
    andreNavn: ['pyroksen'],
    formel: '(Ca,Na)(Mg,Fe,Al)(Si,Al)₂O₆',
    gruppe: 'silikat',
    silikatstruktur: 'enkeltkjede',
    hardhet: [5.5, 6],
    tetthet: [3.2, 3.6],
    glans: ['glass'],
    strek: ['hvit', 'gra'],
    strekTekst: 'grågrønn til hvit',
    spalting: 2,
    spaltingTekst: 'to retninger, nesten vinkelrett (omtrent 87°)',
    fargeTekst: 'svart eller mørk grønn',
    tone: 'svart',
    krystallform: 'prisme',
    bruser: 'nei',
    magnetisk: 'nei',
    kjennetegn: 'Korte, mørke krystaller i basalt og gabbro.',
    norsk: null,
  },
  olivin: {
    navn: 'olivin',
    formel: '(Mg,Fe)₂SiO₄',
    gruppe: 'silikat',
    silikatstruktur: 'oy',
    hardhet: [6.5, 7],
    tetthet: [3.2, 4.4],
    glans: ['glass'],
    strek: ['hvit'],
    strekTekst: 'hvit',
    spalting: 0,
    spaltingTekst: 'dårlig spalting, skjellformet brudd',
    fargeTekst: 'olivengrønn til gulgrønn',
    tone: 'gronn',
    krystallform: null,
    bruser: 'nei',
    magnetisk: 'nei',
    kjennetegn: 'Grønne, glassaktige korn i basalt og peridotitt. Den magnesiumrike olivinen er lettest (omtrent 3,3 g/cm³).',
    norsk: 'Åheim på Sunnmøre (dunitt nesten bare av olivin)',
  },
  granat: {
    navn: 'granat',
    andreNavn: ['almandin'],
    formel: 'Fe₃Al₂(SiO₄)₃',
    gruppe: 'silikat',
    silikatstruktur: 'oy',
    hardhet: [6.5, 7.5],
    tetthet: [3.5, 4.3],
    glans: ['glass'],
    strek: ['hvit'],
    strekTekst: 'hvit',
    spalting: 0,
    spaltingTekst: 'ingen spalting',
    fargeTekst: 'mørk rød til rødbrun',
    tone: 'rod',
    krystallform: 'dodekaeder',
    bruser: 'nei',
    magnetisk: 'nei',
    kjennetegn: 'Runde, røde krystaller i glimmerskifer, gneis og eklogitt.',
    norsk: 'eklogitt i Engebøfjellet i Sunnfjord',
  },
  zirkon: {
    navn: 'zirkon',
    formel: 'ZrSiO₄',
    gruppe: 'silikat',
    silikatstruktur: 'oy',
    hardhet: [7.5, 7.5],
    tetthet: [4.6, 4.7],
    glans: ['diamant', 'glass'],
    strek: ['hvit'],
    strekTekst: 'hvit (risser strekplata)',
    spalting: 0,
    spaltingTekst: 'dårlig spalting',
    fargeTekst: 'brun, rødbrun eller fargeløs',
    tone: 'brun',
    krystallform: 'prisme',
    bruser: 'nei',
    magnetisk: 'nei',
    kjennetegn: 'Små, slitesterke korn; det viktigste mineralet for U–Pb-datering.',
    norsk: null,
  },
  topas: {
    navn: 'topas',
    formel: 'Al₂SiO₄(F,OH)₂',
    gruppe: 'silikat',
    silikatstruktur: 'oy',
    hardhet: [8, 8],
    tetthet: [3.49, 3.57],
    glans: ['glass'],
    strek: ['hvit'],
    strekTekst: 'hvit (risser strekplata)',
    spalting: 1,
    spaltingTekst: 'én retning, perfekt',
    fargeTekst: 'fargeløs, gul eller lyseblå',
    tone: 'gul',
    krystallform: 'prisme',
    bruser: 'nei',
    magnetisk: 'nei',
    kjennetegn: 'Nummer 8 på Mohs’ skala.',
    norsk: null,
  },
  kloritt: {
    navn: 'kloritt',
    formel: '(Mg,Fe)₅Al(AlSi₃O₁₀)(OH)₈',
    gruppe: 'silikat',
    silikatstruktur: 'sjikt',
    hardhet: [2, 2.5],
    tetthet: [2.6, 3.3],
    glans: ['glass', 'perlemor', 'matt'],
    strek: ['hvit'],
    strekTekst: 'hvit til blek grønn',
    spalting: 1,
    spaltingTekst: 'én retning, perfekt: bøyelige, men ikke spenstige flak',
    fargeTekst: 'grønn',
    tone: 'gronn',
    krystallform: 'tavle',
    bruser: 'nei',
    magnetisk: 'nei',
    kjennetegn: 'Gir grønnstein og fyllitt den grønne fargen.',
    norsk: null,
  },
  talk: {
    navn: 'talk',
    andreNavn: ['kleberstein (bergart med mye talk)'],
    formel: 'Mg₃Si₄O₁₀(OH)₂',
    gruppe: 'silikat',
    silikatstruktur: 'sjikt',
    hardhet: [1, 1],
    tetthet: [2.58, 2.83],
    glans: ['perlemor', 'fett'],
    strek: ['hvit'],
    strekTekst: 'hvit',
    spalting: 1,
    spaltingTekst: 'én retning, perfekt',
    fargeTekst: 'hvit, lys grønn eller grå',
    tone: 'hvit',
    krystallform: null,
    bruser: 'nei',
    magnetisk: 'nei',
    kjennetegn: 'Kjennes såpeglatt; risses med neglen. Nummer 1 på Mohs’ skala.',
    norsk: 'Altermark i Rana (talkgruve)',
  },
  kaolinitt: {
    navn: 'kaolinitt',
    andreNavn: ['leirmineral'],
    formel: 'Al₂Si₂O₅(OH)₄',
    gruppe: 'silikat',
    silikatstruktur: 'sjikt',
    hardhet: [2, 2.5],
    tetthet: [2.6, 2.65],
    glans: ['matt'],
    strek: ['hvit'],
    strekTekst: 'hvit',
    spalting: 1,
    spaltingTekst: 'én retning (bare synlig i mikroskop)',
    fargeTekst: 'hvit',
    tone: 'hvit',
    krystallform: null,
    bruser: 'nei',
    magnetisk: 'nei',
    kjennetegn: 'Jordaktig og myk; dannes når feltspat forvitrer.',
    norsk: null,
  },
  kalkspat: {
    navn: 'kalkspat',
    andreNavn: ['kalsitt'],
    formel: 'CaCO₃',
    gruppe: 'karbonat',
    hardhet: [3, 3],
    tetthet: [2.71, 2.71],
    glans: ['glass'],
    strek: ['hvit'],
    strekTekst: 'hvit',
    spalting: 3,
    spaltingTekst: 'tre retninger, ikke vinkelrett (rombeeder)',
    fargeTekst: 'hvit, fargeløs eller lys grå',
    tone: 'hvit',
    krystallform: 'rombeeder',
    bruser: 'ja',
    magnetisk: 'nei',
    kjennetegn: 'Bruser i saltsyre. Klare krystaller viser dobbeltbilder.',
    norsk: 'marmor i Brønnøy',
  },
  dolomitt: {
    navn: 'dolomitt',
    formel: 'CaMg(CO₃)₂',
    gruppe: 'karbonat',
    hardhet: [3.5, 4],
    tetthet: [2.84, 2.86],
    glans: ['glass', 'perlemor'],
    strek: ['hvit'],
    strekTekst: 'hvit',
    spalting: 3,
    spaltingTekst: 'tre retninger, ikke vinkelrett (rombeeder)',
    fargeTekst: 'hvit, grå eller lys rosa',
    tone: 'hvit',
    krystallform: 'rombeeder',
    bruser: 'pulver',
    magnetisk: 'nei',
    kjennetegn: 'Bruser bare svakt, og først når det er skrapt til pulver.',
    norsk: 'Hammerfall i Sørfold',
  },
  gips: {
    navn: 'gips',
    formel: 'CaSO₄ · 2H₂O',
    gruppe: 'sulfat',
    hardhet: [2, 2],
    tetthet: [2.31, 2.33],
    glans: ['glass', 'perlemor', 'silke'],
    strek: ['hvit'],
    strekTekst: 'hvit',
    spalting: 1,
    spaltingTekst: 'én retning, perfekt',
    fargeTekst: 'hvit eller fargeløs',
    tone: 'hvit',
    krystallform: 'tavle',
    bruser: 'nei',
    magnetisk: 'nei',
    kjennetegn: 'Risses med neglen. Nummer 2 på Mohs’ skala.',
    norsk: 'Billefjorden på Svalbard',
  },
  halitt: {
    navn: 'halitt',
    andreNavn: ['steinsalt'],
    formel: 'NaCl',
    gruppe: 'halogenid',
    aniongruppe: 'Cl⁻',
    hardhet: [2, 2.5],
    tetthet: [2.17, 2.17],
    glans: ['glass'],
    strek: ['hvit'],
    strekTekst: 'hvit',
    spalting: 3,
    spaltingTekst: 'tre retninger, vinkelrett (terning)',
    fargeTekst: 'fargeløs eller hvit',
    tone: 'fargelos',
    krystallform: 'terning',
    bruser: 'nei',
    magnetisk: 'nei',
    kjennetegn: 'Smaker salt og løses i vann.',
    norsk: 'saltlag under Nordsjøen og Barentshavet',
  },
  flusspat: {
    navn: 'flusspat',
    andreNavn: ['fluoritt'],
    formel: 'CaF₂',
    gruppe: 'halogenid',
    aniongruppe: 'F⁻',
    hardhet: [4, 4],
    tetthet: [3.18, 3.18],
    glans: ['glass'],
    strek: ['hvit'],
    strekTekst: 'hvit',
    spalting: 4,
    spaltingTekst: 'fire retninger (oktaeder)',
    fargeTekst: 'fiolett, grønn, gul eller fargeløs',
    tone: 'fiolett',
    krystallform: 'oktaeder',
    bruser: 'nei',
    magnetisk: 'nei',
    kjennetegn: 'Nummer 4 på Mohs’ skala.',
    norsk: null,
  },
  apatitt: {
    navn: 'apatitt',
    formel: 'Ca₅(PO₄)₃(F,Cl,OH)',
    gruppe: 'fosfat',
    hardhet: [5, 5],
    tetthet: [3.16, 3.22],
    glans: ['glass'],
    strek: ['hvit'],
    strekTekst: 'hvit',
    spalting: 0,
    spaltingTekst: 'dårlig spalting',
    fargeTekst: 'grønn, blågrønn eller brun',
    tone: 'gronn',
    krystallform: 'prisme',
    bruser: 'nei',
    magnetisk: 'nei',
    kjennetegn: 'Nummer 5 på Mohs’ skala; råstoff for fosforgjødsel.',
    norsk: 'Ødegården i Bamble (gammel apatittgruve)',
  },
  korund: {
    navn: 'korund',
    andreNavn: ['rubin', 'safir'],
    formel: 'Al₂O₃',
    gruppe: 'oksid',
    hardhet: [9, 9],
    tetthet: [3.95, 4.1],
    glans: ['glass', 'diamant'],
    strek: ['hvit'],
    strekTekst: 'hvit (risser strekplata)',
    spalting: 0,
    spaltingTekst: 'ingen spalting',
    fargeTekst: 'grå, brun, rød (rubin) eller blå (safir)',
    tone: 'gra',
    krystallform: 'prisme',
    bruser: 'nei',
    magnetisk: 'nei',
    kjennetegn: 'Nummer 9 på Mohs’ skala.',
    norsk: null,
  },
  magnetitt: {
    navn: 'magnetitt',
    andreNavn: ['magnetjernstein'],
    formel: 'Fe₃O₄',
    gruppe: 'oksid',
    hardhet: [5.5, 6.5],
    tetthet: [5.17, 5.18],
    glans: ['metall'],
    strek: ['svart'],
    strekTekst: 'svart',
    spalting: 0,
    spaltingTekst: 'ingen spalting',
    fargeTekst: 'svart',
    tone: 'svart',
    krystallform: 'oktaeder',
    bruser: 'nei',
    magnetisk: 'sterkt',
    kjennetegn: 'Trekkes sterkt av en magnet. Jernmalm.',
    norsk: 'Sydvaranger ved Kirkenes (jernmalm)',
  },
  hematitt: {
    navn: 'hematitt',
    andreNavn: ['blodstein', 'jernglans'],
    formel: 'Fe₂O₃',
    gruppe: 'oksid',
    hardhet: [5, 6],
    tetthet: [5.26, 5.3],
    glans: ['metall', 'matt'],
    strek: ['rodbrun'],
    strekTekst: 'rødbrun',
    spalting: 0,
    spaltingTekst: 'ingen spalting',
    fargeTekst: 'stålgrå, svart eller rødbrun',
    tone: 'gra',
    krystallform: null,
    bruser: 'nei',
    magnetisk: 'nei',
    kjennetegn: 'Den rødbrune streken skiller den fra magnetitt. Jernmalm.',
    norsk: 'Dunderlandsdalen i Rana (jernmalm)',
  },
  ilmenitt: {
    navn: 'ilmenitt',
    formel: 'FeTiO₃',
    gruppe: 'oksid',
    hardhet: [5, 6],
    tetthet: [4.68, 4.76],
    glans: ['metall'],
    strek: ['svart'],
    strekTekst: 'svart til brunsvart',
    spalting: 0,
    spaltingTekst: 'ingen spalting',
    fargeTekst: 'svart',
    tone: 'svart',
    krystallform: null,
    bruser: 'nei',
    magnetisk: 'svakt',
    kjennetegn: 'Titanmalm. Svakt magnetisk.',
    norsk: 'Tellnes i Sokndal (en av verdens største ilmenittforekomster)',
  },
  rutil: {
    navn: 'rutil',
    formel: 'TiO₂',
    gruppe: 'oksid',
    hardhet: [6, 6.5],
    tetthet: [4.2, 4.3],
    glans: ['diamant', 'metall'],
    strek: ['gulbrun'],
    strekTekst: 'lys brun',
    spalting: 2,
    spaltingTekst: 'to retninger, god',
    fargeTekst: 'rødbrun til svart',
    tone: 'brun',
    krystallform: 'prisme',
    bruser: 'nei',
    magnetisk: 'nei',
    kjennetegn: 'Titanmineral med sterk glans.',
    norsk: 'Engebøfjellet i Sunnfjord (rutil i eklogitt)',
  },
  pyritt: {
    navn: 'pyritt',
    andreNavn: ['svovelkis', 'kattegull'],
    formel: 'FeS₂',
    gruppe: 'sulfid',
    aniongruppe: 'S₂²⁻',
    hardhet: [6, 6.5],
    tetthet: [4.95, 5.1],
    glans: ['metall'],
    strek: ['gronnsvart', 'svart'],
    strekTekst: 'grønnsvart',
    spalting: 0,
    spaltingTekst: 'ingen spalting',
    fargeTekst: 'messinggul',
    tone: 'messing',
    krystallform: 'terning',
    bruser: 'nei',
    magnetisk: 'nei',
    kjennetegn: 'Hardere enn kobberkis og blekere gul; ofte terninger.',
    norsk: 'Løkken i Orkland (svovelkis)',
  },
  kobberkis: {
    navn: 'kobberkis',
    andreNavn: ['kalkopyritt'],
    formel: 'CuFeS₂',
    gruppe: 'sulfid',
    hardhet: [3.5, 4],
    tetthet: [4.1, 4.3],
    glans: ['metall'],
    strek: ['gronnsvart'],
    strekTekst: 'grønnsvart',
    spalting: 0,
    spaltingTekst: 'dårlig spalting',
    fargeTekst: 'messinggul, ofte med blå og fiolette anløpsfarger',
    tone: 'messing',
    krystallform: null,
    bruser: 'nei',
    magnetisk: 'nei',
    kjennetegn: 'Mykere enn pyritt (risses med kniv). Kobbermalm.',
    norsk: 'Løkken, Røros og Sulitjelma (gamle kobbergruver)',
  },
  blyglans: {
    navn: 'blyglans',
    andreNavn: ['galena'],
    formel: 'PbS',
    gruppe: 'sulfid',
    hardhet: [2.5, 2.75],
    tetthet: [7.4, 7.6],
    glans: ['metall'],
    strek: ['gra'],
    strekTekst: 'blygrå',
    spalting: 3,
    spaltingTekst: 'tre retninger, vinkelrett (terning)',
    fargeTekst: 'blygrå',
    tone: 'solv',
    krystallform: 'terning',
    bruser: 'nei',
    magnetisk: 'nei',
    kjennetegn: 'Svært tung for størrelsen. Blymalm.',
    norsk: 'Mofjellet i Mo i Rana (sink- og blymalm)',
  },
  sinkblende: {
    navn: 'sinkblende',
    andreNavn: ['sfaleritt'],
    formel: 'ZnS',
    gruppe: 'sulfid',
    hardhet: [3.5, 4],
    tetthet: [3.9, 4.1],
    glans: ['fett', 'diamant'],
    strek: ['gulbrun'],
    strekTekst: 'lys gulbrun',
    spalting: 6,
    spaltingTekst: 'seks retninger, perfekt',
    fargeTekst: 'brun, gulbrun eller svart',
    tone: 'brun',
    krystallform: null,
    bruser: 'nei',
    magnetisk: 'nei',
    kjennetegn: 'Harpiksaktig glans. Sinkmalm.',
    norsk: 'Mofjellet i Mo i Rana (sink- og blymalm)',
  },
  molybdenglans: {
    navn: 'molybdenglans',
    andreNavn: ['molybdenitt'],
    formel: 'MoS₂',
    gruppe: 'sulfid',
    hardhet: [1, 1.5],
    tetthet: [4.62, 4.73],
    glans: ['metall'],
    strek: ['gra', 'gronnsvart'],
    strekTekst: 'blågrå',
    spalting: 1,
    spaltingTekst: 'én retning, perfekt: bøyelige flak',
    fargeTekst: 'blygrå med et blått skjær',
    tone: 'solv',
    krystallform: 'tavle',
    bruser: 'nei',
    magnetisk: 'nei',
    kjennetegn: 'Myk og glatt som grafitt, men tyngre og med blåere farge.',
    norsk: 'Knaben i Agder (molybdengruve til 1973)',
  },
  gull: {
    navn: 'gull',
    formel: 'Au',
    gruppe: 'grunnstoff',
    hardhet: [2.5, 3],
    tetthet: [15.5, 19.3],
    glans: ['metall'],
    strek: ['gull'],
    strekTekst: 'gullgul',
    spalting: 0,
    spaltingTekst: 'ingen spalting, formbart',
    fargeTekst: 'gullgul',
    tone: 'gull',
    krystallform: null,
    bruser: 'nei',
    magnetisk: 'nei',
    kjennetegn: 'Svært tungt og mykt; bøyes i stedet for å knuses.',
    norsk: 'Bidjovagge i Finnmark (kobber- og gullgruve)',
  },
  solv: {
    navn: 'sølv',
    formel: 'Ag',
    gruppe: 'grunnstoff',
    hardhet: [2.5, 3],
    tetthet: [10.1, 11.1],
    glans: ['metall'],
    strek: ['hvit'],
    strekTekst: 'sølvhvit og skinnende',
    spalting: 0,
    spaltingTekst: 'ingen spalting, formbart',
    fargeTekst: 'sølvhvit, svartner i lufta',
    tone: 'solv',
    krystallform: null,
    bruser: 'nei',
    magnetisk: 'nei',
    kjennetegn: 'Ofte som tråder og blader.',
    norsk: 'Kongsberg (Sølvverket var i drift 1623–1958)',
  },
  grafitt: {
    navn: 'grafitt',
    formel: 'C',
    gruppe: 'grunnstoff',
    hardhet: [1, 2],
    tetthet: [2.09, 2.23],
    glans: ['metall', 'matt'],
    strek: ['svart', 'gra'],
    strekTekst: 'svart til grå',
    spalting: 1,
    spaltingTekst: 'én retning, perfekt',
    fargeTekst: 'svart til stålgrå',
    tone: 'gra',
    krystallform: null,
    bruser: 'nei',
    magnetisk: 'nei',
    kjennetegn: 'Smitter av på fingrene og papir (blyant).',
    norsk: 'Skaland på Senja',
  },
  diamant: {
    navn: 'diamant',
    formel: 'C',
    gruppe: 'grunnstoff',
    hardhet: [10, 10],
    tetthet: [3.51, 3.53],
    glans: ['diamant'],
    strek: ['hvit'],
    strekTekst: 'ingen (risser strekplata)',
    spalting: 4,
    spaltingTekst: 'fire retninger (oktaeder), perfekt',
    fargeTekst: 'fargeløs eller svakt gul',
    tone: 'fargelos',
    krystallform: 'oktaeder',
    bruser: 'nei',
    magnetisk: 'nei',
    kjennetegn: 'Det hardeste mineralet. Nummer 10 på Mohs’ skala.',
    norsk: null,
  },
};

/** Alle mineralene etter id, med gruppe, aniongruppe og egenskapene til mineralbestemmelse. */
export const MINERALER: Readonly<Record<MineralId, Mineral>> = Object.fromEntries(
  (Object.entries(DATA) as [MineralId, M][]).map(([id, m]) => [
    id,
    { ...m, id, aniongruppe: m.aniongruppe ?? MINERALGRUPPER[m.gruppe].aniongruppe },
  ]),
) as Record<MineralId, Mineral>;

/** Alle mineral-id-ene i fast rekkefølge (silikater først). */
export const MINERAL_IDS: readonly MineralId[] = Object.keys(DATA) as MineralId[];

/** Mineralet med denne id-en, eller null. */
export function mineral(id: string): Mineral | null {
  return (MINERALER as Record<string, Mineral | undefined>)[id] ?? null;
}

// ---------------------------------------------------------------------------------------------------------------
// Hardhet

/** Redskapene i en enkel rissetest. */
export type RisseId = 'negl' | 'kobbermynt' | 'kniv' | 'glass' | 'stalfil' | 'strekplate';

/** Et redskap med kjent hardhet på Mohs' skala. */
export interface Rissetest {
  id: RisseId;
  /** «fingernegl». */
  navn: string;
  /** Omtrentlig hardhet på Mohs' skala. */
  hardhet: number;
}

/*
 * Kilde: vanlige lærebokverdier (f.eks. Tarbuck og Lutgens, «Earth»): fingernegl 2,5, kobbermynt 3,5, glass 5,5,
 * kniv 5,5, stålfil 6,5 og strekplate (uglasert porselen) omtrent 6,5–7. Alle er omtrentlige; redskapene varierer.
 */
export const RISSETESTER: readonly Rissetest[] = [
  { id: 'negl', navn: 'fingernegl', hardhet: 2.5 },
  { id: 'kobbermynt', navn: 'kobbermynt', hardhet: 3.5 },
  { id: 'kniv', navn: 'kniv', hardhet: 5.5 },
  { id: 'glass', navn: 'glass', hardhet: 5.5 },
  { id: 'stalfil', navn: 'stålfil', hardhet: 6.5 },
  { id: 'strekplate', navn: 'strekplate', hardhet: 7 },
];

/** Et mineral på Mohs' skala med absolutt hardhet (kvarts = 100). */
export interface MohsTrinn {
  mohs: number;
  mineral: MineralId;
  /** Absolutt hardhet målt med sklerometer, omtrentlig. */
  absolutt: number;
}

/*
 * Kilde: Mohs' skala med absolutt hardhet målt med sklerometer, slik den gjengis i oppslagsverk (f.eks. engelsk
 * Wikipedia, «Mohs scale»): talk 1, gips 2, kalkspat 14, flusspat 21, apatitt 48, kalifeltspat (ortoklas) 72,
 * kvarts 100, topas 200, korund 400, diamant 1500. Omtrentlige tall; poenget er at trinnene ikke er like store.
 */
export const MOHS_ABSOLUTT: readonly MohsTrinn[] = [
  { mohs: 1, mineral: 'talk', absolutt: 1 },
  { mohs: 2, mineral: 'gips', absolutt: 2 },
  { mohs: 3, mineral: 'kalkspat', absolutt: 14 },
  { mohs: 4, mineral: 'flusspat', absolutt: 21 },
  { mohs: 5, mineral: 'apatitt', absolutt: 48 },
  { mohs: 6, mineral: 'kalifeltspat', absolutt: 72 },
  { mohs: 7, mineral: 'kvarts', absolutt: 100 },
  { mohs: 8, mineral: 'topas', absolutt: 200 },
  { mohs: 9, mineral: 'korund', absolutt: 400 },
  { mohs: 10, mineral: 'diamant', absolutt: 1500 },
];

/** Resultatet av én rissetest: risser redskapet mineralet? (Mineralet risser glasset = glasset risser ikke mineralet.) */
export interface RisseResultat {
  /** Et redskap fra `RISSETESTER`, eller en hardhet på Mohs' skala (f.eks. et annet mineral). */
  redskap: RisseId | number;
  /** `true` når redskapet lager en ripe i mineralet (mineralet er mykere). */
  risses: boolean;
}

/**
 * Hardhetsintervallet [min, maks] på Mohs' skala som passer med rissetestene. Risses mineralet, er det høyst like
 * hardt som redskapet; risses det ikke, er det minst like hardt. Like hardhet regnes som mulig begge veier. Null når
 * testene motsier hverandre eller et redskap er ukjent.
 */
export function hardhetFraRissetester(tester: readonly RisseResultat[]): { min: number; max: number } | null {
  let min = 1;
  let max = 10;
  for (const t of tester) {
    const h = typeof t.redskap === 'number' ? t.redskap : RISSETESTER.find((r) => r.id === t.redskap)?.hardhet;
    if (h === undefined || !Number.isFinite(h)) return null;
    if (t.risses) max = Math.min(max, h);
    else min = Math.max(min, h);
  }
  return min <= max ? { min, max } : null;
}

// ---------------------------------------------------------------------------------------------------------------
// Mineralbestemmelse

/** Det eleven har observert. Alt er valgfritt; bare det som er oppgitt, brukes. */
export interface MineralObservasjon {
  glans?: Glans;
  strek?: Strekfarge;
  /** Hardhetsintervall på Mohs' skala (f.eks. fra `hardhetFraRissetester`). */
  hardhet?: { min: number; max: number };
  /** Rissetester; slås sammen med `hardhet`. */
  rissetester?: readonly RisseResultat[];
  /** Antall spalteretninger. */
  spalting?: Mineral['spalting'];
  /** `true` = bruser i saltsyre (også som pulver), `false` = bruser ikke (heller ikke som pulver). */
  bruser?: boolean;
  /** `true` = en magnet trekker (sterkt eller svakt), `false` = magneten trekker ikke merkbart. */
  magnetisk?: boolean;
  /** Målt tetthet i g/cm³ (godtar ±0,15 g/cm³ målefeil). */
  tetthet?: number;
  /** Bare mineraler med denne krystallformen. */
  krystallform?: Krystallform;
  /** Bare mineraler i denne gruppen. */
  gruppe?: MineralGruppeId;
}

/** Målefeilen som godtas på tetthet i `muligeMineraler` (g/cm³), som med kjøkkenvekt og målesylinder. */
export const TETTHET_TOLERANSE = 0.15;

/**
 * Mineralene i `MINERALER` som passer med alle observasjonene, i fast rekkefølge. Tomme observasjoner gir alle
 * mineralene; motstridende rissetester gir en tom liste.
 */
export function muligeMineraler(obs: MineralObservasjon, kandidater: readonly MineralId[] = MINERAL_IDS): Mineral[] {
  let hMin = obs.hardhet?.min ?? 1;
  let hMax = obs.hardhet?.max ?? 10;
  if (obs.rissetester && obs.rissetester.length > 0) {
    const r = hardhetFraRissetester(obs.rissetester);
    if (!r) return [];
    hMin = Math.max(hMin, r.min);
    hMax = Math.min(hMax, r.max);
  }
  if (!(hMin <= hMax)) return [];
  return kandidater
    .map((id) => MINERALER[id])
    .filter((m) => {
      if (m.hardhet[1] < hMin || m.hardhet[0] > hMax) return false;
      if (obs.glans && !m.glans.includes(obs.glans)) return false;
      if (obs.strek && !m.strek.includes(obs.strek)) return false;
      if (obs.spalting !== undefined && m.spalting !== obs.spalting) return false;
      if (obs.bruser === true && m.bruser === 'nei') return false;
      if (obs.bruser === false && m.bruser !== 'nei') return false;
      if (obs.magnetisk === true && m.magnetisk === 'nei') return false;
      if (obs.magnetisk === false && m.magnetisk === 'sterkt') return false;
      if (obs.tetthet !== undefined && Number.isFinite(obs.tetthet)) {
        if (obs.tetthet < m.tetthet[0] - TETTHET_TOLERANSE || obs.tetthet > m.tetthet[1] + TETTHET_TOLERANSE) return false;
      }
      if (obs.krystallform && m.krystallform !== obs.krystallform) return false;
      if (obs.gruppe && m.gruppe !== obs.gruppe) return false;
      return true;
    });
}

// ---------------------------------------------------------------------------------------------------------------
// Jordskorpa og krystallisering

/** Andel av jordskorpa (volumprosent) for de vanligste mineralene. */
export interface SkorpeAndel {
  navn: string;
  /** Volumprosent, omtrentlig. */
  prosent: number;
  /** Om mineralene er silikater. */
  silikat: boolean;
  /** Mineral-id-er i `MINERALER` som hører til. */
  mineraler: readonly MineralId[];
}

/*
 * Kilde: Ronov og Yaroshevsky 1969, volumprosent av jordskorpa, slik tallene gjengis i lærebøker (f.eks. Klein og
 * Dutrow). Omtrentlige; summen er 100.
 */
export const SKORPAS_MINERALER: readonly SkorpeAndel[] = [
  { navn: 'plagioklas', prosent: 39, silikat: true, mineraler: ['plagioklas'] },
  { navn: 'kalifeltspat', prosent: 12, silikat: true, mineraler: ['kalifeltspat', 'sanidin'] },
  { navn: 'kvarts', prosent: 12, silikat: true, mineraler: ['kvarts'] },
  { navn: 'pyroksener', prosent: 11, silikat: true, mineraler: ['augitt'] },
  { navn: 'amfiboler', prosent: 5, silikat: true, mineraler: ['hornblende'] },
  { navn: 'glimmer', prosent: 5, silikat: true, mineraler: ['muskovitt', 'biotitt'] },
  { navn: 'leirmineraler', prosent: 5, silikat: true, mineraler: ['kaolinitt', 'kloritt'] },
  { navn: 'andre silikater', prosent: 3, silikat: true, mineraler: ['olivin', 'granat', 'zirkon'] },
  { navn: 'ikke-silikater', prosent: 8, silikat: false, mineraler: ['kalkspat', 'magnetitt', 'hematitt', 'pyritt'] },
];

/**
 * Bowens reaksjonsrekke: rekkefølgen mineralene krystalliserer i når magma kjøles ned, fra høy til lav temperatur.
 * Den diskontinuerlige grenen (olivin → pyroksen → amfibol → biotitt) og den kontinuerlige (kalsiumrik plagioklas →
 * natriumrik plagioklas) møtes i kalifeltspat, muskovitt og kvarts til slutt.
 *
 * Kilde: Bowen 1928, slik rekken gjengis i lærebøkene.
 */
export const BOWENS_REKKE: {
  readonly diskontinuerlig: readonly MineralId[];
  readonly kontinuerlig: readonly string[];
  readonly tilSlutt: readonly MineralId[];
} = {
  diskontinuerlig: ['olivin', 'augitt', 'hornblende', 'biotitt'],
  kontinuerlig: ['kalsiumrik plagioklas', 'natriumrik plagioklas'],
  tilSlutt: ['kalifeltspat', 'muskovitt', 'kvarts'],
};
