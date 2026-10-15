/**
 * Bergarter for geofag: de tre hovedgruppene med dannelse, tekstur, tetthet, mineraler, mønster og norske eksempler,
 * de ni rutene for magmatiske bergarter (kjemi × hvor de størknet), klassifisering og bergartenes kretsløp. Ren
 * logikk uten React.
 *
 *   BERGARTER.granitt.monster                         // 'granitt' (mønsteret i LagMonstre)
 *   klassifiserMagmatisk({ sio2: 49, kornMm: 0.2 })   // basalt
 *   klassifiserKlastisk(0.5)                          // sandstein
 *   SYKLUS.overganger                                 // piler i bergartenes kretsløp
 */
import type { MineralId } from './mineraler';
import type { MonsterId } from './typer';

/** De tre hovedgruppene. */
export type BergartGruppe = 'magmatisk' | 'sedimentar' | 'metamorf';

/** Undergruppe: hvor en magmatisk bergart størknet, hva en sedimentær er bygd av, om en metamorf er foliert. */
export type BergartUndergruppe =
  | 'dypbergart'
  | 'gangbergart'
  | 'dagbergart'
  | 'klastisk'
  | 'kjemisk'
  | 'biogen'
  | 'foliert'
  | 'ikke-foliert';

/** Kjemisk sammensetning av magmatiske bergarter etter innholdet av SiO₂. */
export type Kjemi = 'sur' | 'intermediaer' | 'basisk' | 'ultrabasisk';

/** Hvor magmaet størknet: dypt i skorpa, i en gang (sprekk) eller på overflaten. */
export type Forekomst = 'dyp' | 'gang' | 'dag';

/** Tekstur slik den sees i et håndstykke (til `Steinprove`). */
export type Tekstur =
  | 'grovkornet'
  | 'middelskornet'
  | 'finkornet'
  | 'porfyrisk'
  | 'glass'
  | 'blaerer'
  | 'klastisk'
  | 'lagdelt'
  | 'fossiler'
  | 'organisk'
  | 'krystallinsk'
  | 'foliert'
  | 'bandet';

/** Id-ene til bergartene i `BERGARTER`. For de 15 bergartsmønstrene er id-en lik `MonsterId`. */
export type BergartId =
  | 'granitt'
  | 'kvartsporfyr'
  | 'ryolitt'
  | 'dioritt'
  | 'porfyritt'
  | 'andesitt'
  | 'gabbro'
  | 'diabas'
  | 'basalt'
  | 'larvikitt'
  | 'rombeporfyr'
  | 'anortositt'
  | 'peridotitt'
  | 'obsidian'
  | 'tuff'
  | 'konglomerat'
  | 'breksje'
  | 'sandstein'
  | 'siltstein'
  | 'leirskifer'
  | 'salt'
  | 'kalkstein'
  | 'kull'
  | 'takskifer'
  | 'fyllitt'
  | 'glimmerskifer'
  | 'gneis'
  | 'kvartsitt'
  | 'marmor'
  | 'amfibolitt'
  | 'eklogitt';

/** Én bergart. */
export interface Bergart {
  id: BergartId;
  /** Navn i løpende tekst: «granitt». */
  navn: string;
  /** Andre navn eleven kan møte. */
  andreNavn?: readonly string[];
  gruppe: BergartGruppe;
  undergruppe: BergartUndergruppe;
  /** Hvordan bergarten dannes, én eller to setninger. */
  dannelse: string;
  /** Teksturen i håndstykket; den første er den viktigste. */
  tekstur: readonly Tekstur[];
  /** Teksturen med ord: «grovkornet: korn av kvarts, feltspat og glimmer som sees med det blotte øye». */
  teksturTekst: string;
  /** Tetthetsintervall i g/cm³ [min, maks] (omtrentlig; porøse prøver kan ligge under). */
  tetthet: readonly [number, number];
  /** Typisk tetthet i g/cm³. */
  tetthetTypisk: number;
  /** Mønsteret bergarten tegnes med (`LagMonstre`, `lagFyll`); det nærmeste når den ikke har sitt eget. */
  monster: MonsterId;
  /** De viktigste mineralene (id-er i `MINERALER`). */
  mineraler: readonly MineralId[];
  /** Norske eksempler (steder), tomt når det ikke finnes noe godt eksempel. */
  norske: readonly string[];
  /** Magmatiske: kjemisk sammensetning. */
  kjemi?: Kjemi;
  /** Magmatiske: hvor magmaet størknet. */
  forekomst?: Forekomst;
  /** Klastiske: kornstørrelsen i mm [min, maks]. */
  kornMm?: readonly [number, number];
  /** Metamorfe: bergartene den kan dannes fra. */
  fra?: readonly BergartId[];
  /** Metamorfe: metamorfosegrad. */
  grad?: 'lav' | 'middels' | 'hoy';
}

type B = Omit<Bergart, 'id'>;

/*
 * Kilder:
 * - Inndeling, dannelse og tekstur: lærebøker i geofag og Store norske leksikon («bergart», «dypbergart» osv.).
 *   Ni ruter for magmatiske bergarter som i norske lærebøker: granitt–kvartsporfyr–ryolitt, dioritt–porfyritt–andesitt,
 *   gabbro–diabas–basalt.
 * - SiO₂-grenser: IUGS (Le Maitre mfl. 2002): sur over 63 %, intermediær 52–63 %, basisk 45–52 %, ultrabasisk under
 *   45 %.
 * - Tetthet: avrundede intervaller fra Telford, Geldart og Sheriff 1990 («Applied Geophysics», tabell 6.1) og Schön
 *   2015; omtrentlige. Intervallene for sedimentære bergarter er brede fordi porøsiteten varierer.
 * - Kornstørrelse for klastiske sedimenter: grensene 0,002, 0,063 og 2 mm (NGU og Norsk geoteknisk forening).
 * - Norske eksempler: NGU og Store norske leksikon (larvikitt er Norges nasjonalbergart fra 2008).
 */
const DATA: Record<BergartId, B> = {
  // Magmatiske bergarter: de ni rutene
  granitt: {
    navn: 'granitt',
    gruppe: 'magmatisk',
    undergruppe: 'dypbergart',
    kjemi: 'sur',
    forekomst: 'dyp',
    dannelse: 'Sur magma som har størknet langsomt dypt i skorpa, ofte i store masser (batolitter).',
    tekstur: ['grovkornet', 'krystallinsk'],
    teksturTekst: 'grovkornet: korn av kvarts, feltspat og glimmer som sees med det blotte øye',
    tetthet: [2.5, 2.8],
    tetthetTypisk: 2.65,
    monster: 'granitt',
    mineraler: ['kvarts', 'kalifeltspat', 'plagioklas', 'biotitt', 'muskovitt'],
    norske: ['Iddefjordgranitten i Østfold', 'Drammensgranitten i Oslofeltet'],
  },
  kvartsporfyr: {
    navn: 'kvartsporfyr',
    andreNavn: ['granittporfyr'],
    gruppe: 'magmatisk',
    undergruppe: 'gangbergart',
    kjemi: 'sur',
    forekomst: 'gang',
    dannelse: 'Sur magma som har størknet i en sprekk (gang) nær overflaten: noen krystaller vokste før magmaet steg.',
    tekstur: ['porfyrisk'],
    teksturTekst: 'porfyrisk: store krystaller av kvarts og feltspat i en finkornet grunnmasse',
    tetthet: [2.5, 2.7],
    tetthetTypisk: 2.6,
    monster: 'granitt',
    mineraler: ['kvarts', 'kalifeltspat', 'plagioklas'],
    norske: ['ganger i Oslofeltet'],
  },
  ryolitt: {
    navn: 'ryolitt',
    gruppe: 'magmatisk',
    undergruppe: 'dagbergart',
    kjemi: 'sur',
    forekomst: 'dag',
    dannelse: 'Sur lava eller askestrømmer som har størknet raskt på overflaten. Seig magma gir ofte eksplosive utbrudd.',
    tekstur: ['finkornet', 'porfyrisk'],
    teksturTekst: 'finkornet, lys, ofte med enkelte synlige krystaller',
    tetthet: [2.35, 2.7],
    tetthetTypisk: 2.5,
    monster: 'granitt',
    mineraler: ['kvarts', 'sanidin', 'plagioklas', 'biotitt'],
    norske: ['kalderaene i Oslofeltet'],
  },
  dioritt: {
    navn: 'dioritt',
    gruppe: 'magmatisk',
    undergruppe: 'dypbergart',
    kjemi: 'intermediaer',
    forekomst: 'dyp',
    dannelse: 'Intermediær magma som har størknet langsomt dypt i skorpa, ofte over subduksjonssoner.',
    tekstur: ['grovkornet', 'krystallinsk'],
    teksturTekst: 'grovkornet, «salt og pepper»: hvit plagioklas og svart hornblende',
    tetthet: [2.7, 3.0],
    tetthetTypisk: 2.85,
    monster: 'gabbro',
    mineraler: ['plagioklas', 'hornblende', 'biotitt'],
    norske: [],
  },
  porfyritt: {
    navn: 'porfyritt',
    gruppe: 'magmatisk',
    undergruppe: 'gangbergart',
    kjemi: 'intermediaer',
    forekomst: 'gang',
    dannelse: 'Intermediær magma som har størknet i en gang.',
    tekstur: ['porfyrisk'],
    teksturTekst: 'porfyrisk: krystaller av plagioklas og hornblende i en finkornet grunnmasse',
    tetthet: [2.6, 2.9],
    tetthetTypisk: 2.75,
    monster: 'diabas',
    mineraler: ['plagioklas', 'hornblende'],
    norske: [],
  },
  andesitt: {
    navn: 'andesitt',
    gruppe: 'magmatisk',
    undergruppe: 'dagbergart',
    kjemi: 'intermediaer',
    forekomst: 'dag',
    dannelse: 'Intermediær lava fra stratovulkaner over subduksjonssoner (navnet kommer fra Andes).',
    tekstur: ['finkornet', 'porfyrisk'],
    teksturTekst: 'finkornet og grå, ofte med små krystaller av plagioklas',
    tetthet: [2.4, 2.8],
    tetthetTypisk: 2.6,
    monster: 'basalt',
    mineraler: ['plagioklas', 'hornblende', 'augitt'],
    norske: [],
  },
  gabbro: {
    navn: 'gabbro',
    gruppe: 'magmatisk',
    undergruppe: 'dypbergart',
    kjemi: 'basisk',
    forekomst: 'dyp',
    dannelse: 'Basisk magma som har størknet langsomt i dypet, f.eks. i den nedre delen av havbunnsskorpa.',
    tekstur: ['grovkornet', 'krystallinsk'],
    teksturTekst: 'grovkornet og mørk: grå plagioklas og svart pyroksen',
    tetthet: [2.8, 3.2],
    tetthetTypisk: 3.0,
    monster: 'gabbro',
    mineraler: ['plagioklas', 'augitt', 'olivin'],
    norske: ['Seiland i Finnmark'],
  },
  diabas: {
    navn: 'diabas',
    gruppe: 'magmatisk',
    undergruppe: 'gangbergart',
    kjemi: 'basisk',
    forekomst: 'gang',
    dannelse: 'Basisk magma som har størknet i ganger som skjærer gjennom eldre bergarter.',
    tekstur: ['middelskornet'],
    teksturTekst: 'middelskornet og mørk, mellom gabbro og basalt',
    tetthet: [2.8, 3.1],
    tetthetTypisk: 2.9,
    monster: 'diabas',
    mineraler: ['plagioklas', 'augitt'],
    norske: ['diabasganger i Oslofeltet'],
  },
  basalt: {
    navn: 'basalt',
    gruppe: 'magmatisk',
    undergruppe: 'dagbergart',
    kjemi: 'basisk',
    forekomst: 'dag',
    dannelse: 'Basisk lava som har størknet raskt: havbunnen, skjoldvulkaner og store lavaplatåer.',
    tekstur: ['finkornet', 'blaerer'],
    teksturTekst: 'finkornet og svart, ofte med små hulrom (blærer) etter gass',
    tetthet: [2.6, 3.1],
    tetthetTypisk: 2.9,
    monster: 'basalt',
    mineraler: ['plagioklas', 'augitt', 'olivin'],
    norske: ['de eldste lavaene i Oslofeltet', 'Jan Mayen'],
  },
  // Andre magmatiske bergarter (norske og spesielle)
  larvikitt: {
    navn: 'larvikitt',
    gruppe: 'magmatisk',
    undergruppe: 'dypbergart',
    kjemi: 'intermediaer',
    forekomst: 'dyp',
    dannelse: 'Dypbergart fra riftdannelsen i Oslofeltet i perm. Norges nasjonalbergart.',
    tekstur: ['grovkornet', 'krystallinsk'],
    teksturTekst: 'grovkornet og blågrå, med feltspat som skimrer i blått',
    tetthet: [2.65, 2.8],
    tetthetTypisk: 2.7,
    monster: 'gabbro',
    mineraler: ['kalifeltspat', 'plagioklas', 'augitt', 'biotitt', 'magnetitt'],
    norske: ['Larvik i Vestfold'],
  },
  rombeporfyr: {
    navn: 'rombeporfyr',
    gruppe: 'magmatisk',
    undergruppe: 'dagbergart',
    kjemi: 'intermediaer',
    forekomst: 'dag',
    dannelse: 'Lava fra riftdannelsen i Oslofeltet i perm, med store feltspatkrystaller som vokste i magmakammeret.',
    tekstur: ['porfyrisk', 'finkornet'],
    teksturTekst: 'porfyrisk: rombeformede feltspatkrystaller i en finkornet, mørk grunnmasse',
    tetthet: [2.6, 2.8],
    tetthetTypisk: 2.7,
    // Lava (dagbergart): samme mønster som de andre dagbergartene, ikke gangmønsteret
    monster: 'basalt',
    mineraler: ['kalifeltspat', 'plagioklas'],
    norske: ['Krokskogen og Vestfold (Oslofeltet)'],
  },
  anortositt: {
    navn: 'anortositt',
    gruppe: 'magmatisk',
    undergruppe: 'dypbergart',
    kjemi: 'basisk',
    forekomst: 'dyp',
    dannelse: 'Dypbergart nesten bare av plagioklas, regnes med i gabbrofamilien.',
    tekstur: ['grovkornet', 'krystallinsk'],
    teksturTekst: 'grovkornet og lys grå, nesten bare feltspat',
    tetthet: [2.65, 2.8],
    tetthetTypisk: 2.7,
    // Gabbrofamilien (basisk dypbergart): ikke de små kryssene, som betyr sur dypbergart på geologiske kart
    monster: 'gabbro',
    mineraler: ['plagioklas'],
    norske: ['Egersund og Sokndal i Rogaland'],
  },
  peridotitt: {
    navn: 'peridotitt',
    andreNavn: ['dunitt (nesten bare olivin)'],
    gruppe: 'magmatisk',
    undergruppe: 'dypbergart',
    kjemi: 'ultrabasisk',
    forekomst: 'dyp',
    dannelse: 'Bergarten i den øvre mantelen. Kommer til overflaten bare i fjellkjeder og ofiolitter.',
    tekstur: ['middelskornet', 'krystallinsk'],
    teksturTekst: 'middelskornet og grønn, mest olivin',
    tetthet: [3.1, 3.4],
    tetthetTypisk: 3.3,
    monster: 'gabbro',
    mineraler: ['olivin', 'augitt'],
    norske: ['Åheim og Almklovdalen på Sunnmøre'],
  },
  obsidian: {
    navn: 'obsidian',
    gruppe: 'magmatisk',
    undergruppe: 'dagbergart',
    kjemi: 'sur',
    forekomst: 'dag',
    dannelse: 'Sur lava som har stivnet så fort at det ikke ble krystaller: naturlig glass.',
    tekstur: ['glass'],
    teksturTekst: 'glass: svart og blank, med skarpe, skjellformede bruddflater',
    tetthet: [2.3, 2.6],
    tetthetTypisk: 2.4,
    monster: 'basalt',
    mineraler: [],
    norske: [],
  },
  tuff: {
    navn: 'tuff',
    andreNavn: ['askestein'],
    gruppe: 'magmatisk',
    undergruppe: 'dagbergart',
    forekomst: 'dag',
    dannelse: 'Vulkansk aske som har falt ned eller strømmet ut og blitt sammenkittet (pyroklastisk bergart).',
    tekstur: ['finkornet', 'klastisk', 'lagdelt'],
    teksturTekst: 'finkornet og lett, ofte lagdelt, med biter av pimpstein og krystaller',
    tetthet: [1.5, 2.4],
    tetthetTypisk: 1.9,
    monster: 'aske',
    mineraler: [],
    norske: ['tynne askelag i lagene fra ordovicium i Oslofeltet'],
  },
  // Sedimentære bergarter
  konglomerat: {
    navn: 'konglomerat',
    gruppe: 'sedimentar',
    undergruppe: 'klastisk',
    kornMm: [2, 1000],
    dannelse: 'Avrundet grus og stein avsatt av elver eller bølger og sementert sammen.',
    tekstur: ['klastisk'],
    teksturTekst: 'klastisk: runde steiner (over 2 mm) i en grunnmasse av sand',
    tetthet: [2.2, 2.7],
    tetthetTypisk: 2.5,
    monster: 'konglomerat',
    mineraler: ['kvarts'],
    norske: ['Hornelen og Kvamshesten i Sunnfjord (devon)'],
  },
  breksje: {
    navn: 'breksje',
    gruppe: 'sedimentar',
    undergruppe: 'klastisk',
    kornMm: [2, 1000],
    dannelse: 'Kantete stein som ikke har blitt fraktet langt (ur, skred, forkastninger), sementert sammen.',
    tekstur: ['klastisk'],
    teksturTekst: 'klastisk: kantete steinbiter i en finere grunnmasse',
    tetthet: [2.2, 2.7],
    tetthetTypisk: 2.5,
    monster: 'konglomerat',
    mineraler: [],
    norske: [],
  },
  sandstein: {
    navn: 'sandstein',
    gruppe: 'sedimentar',
    undergruppe: 'klastisk',
    kornMm: [0.063, 2],
    dannelse: 'Sand fra elver, strender, deltaer eller ørken som er begravd og sementert (diagenese).',
    tekstur: ['klastisk', 'lagdelt'],
    teksturTekst: 'klastisk: sandkorn som kjennes ru, ofte i lag og skråsjikt',
    tetthet: [2.0, 2.7],
    tetthetTypisk: 2.35,
    monster: 'sandstein',
    mineraler: ['kvarts', 'kalifeltspat', 'kalkspat'],
    norske: ['Ringerike (silur)', 'Brumunddal (perm)', 'reservoarene i Nordsjøen (jura)'],
  },
  siltstein: {
    navn: 'siltstein',
    gruppe: 'sedimentar',
    undergruppe: 'klastisk',
    kornMm: [0.002, 0.063],
    dannelse: 'Silt avsatt i rolig vann (innsjøer, elveslette, sjø) og sementert.',
    tekstur: ['klastisk', 'lagdelt', 'finkornet'],
    teksturTekst: 'finkornet: kornene sees ikke, men kjennes litt ru mot tennene',
    tetthet: [2.2, 2.7],
    tetthetTypisk: 2.45,
    monster: 'siltstein',
    mineraler: ['kvarts', 'muskovitt', 'kaolinitt'],
    norske: ['lagene fra kambrium og silur i Oslofeltet'],
  },
  leirskifer: {
    navn: 'leirskifer',
    gruppe: 'sedimentar',
    undergruppe: 'klastisk',
    kornMm: [0, 0.002],
    dannelse: 'Leire avsatt i stille vann og presset sammen. Mørk leirskifer med organisk stoff kan være kildebergart for olje og gass.',
    tekstur: ['lagdelt', 'finkornet', 'fossiler'],
    teksturTekst: 'svært finkornet og glatt, deler seg i tynne plater langs lagene',
    tetthet: [2.0, 2.8],
    tetthetTypisk: 2.4,
    monster: 'leirskifer',
    mineraler: ['kaolinitt', 'kvarts', 'muskovitt'],
    norske: ['alunskiferen i Oslofeltet (kambrium og ordovicium)'],
  },
  salt: {
    navn: 'steinsalt',
    gruppe: 'sedimentar',
    undergruppe: 'kjemisk',
    dannelse: 'Felles ut når sjøvann i et grunt, avstengt basseng fordamper. Saltet er lett og kan stige opp som saltdomer.',
    tekstur: ['krystallinsk', 'lagdelt'],
    teksturTekst: 'krystallinsk: klare eller hvite saltkrystaller',
    tetthet: [2.1, 2.3],
    tetthetTypisk: 2.17,
    monster: 'salt',
    mineraler: ['halitt', 'gips'],
    norske: ['saltlag og saltdomer under Nordsjøen (perm) og i Barentshavet'],
  },
  kalkstein: {
    navn: 'kalkstein',
    gruppe: 'sedimentar',
    undergruppe: 'biogen',
    dannelse: 'Skall og skjelett av kalk fra havdyr og alger (biogen), eller kalk som felles ut av sjøvann (kjemisk).',
    tekstur: ['fossiler', 'lagdelt', 'finkornet'],
    teksturTekst: 'grå og finkornet, ofte med fossiler. Bruser i saltsyre.',
    tetthet: [2.3, 2.7],
    tetthetTypisk: 2.55,
    monster: 'kalkstein',
    mineraler: ['kalkspat'],
    norske: ['lagene fra ordovicium og silur i Oslofeltet'],
  },
  kull: {
    navn: 'kull',
    andreNavn: ['steinkull'],
    gruppe: 'sedimentar',
    undergruppe: 'biogen',
    dannelse: 'Planterester fra sumper som er begravd uten oksygen og omdannet av trykk og varme (torv → brunkull → steinkull).',
    tekstur: ['organisk', 'lagdelt'],
    teksturTekst: 'svart og lett, smitter av, ofte i tynne lag',
    tetthet: [1.1, 1.8],
    tetthetTypisk: 1.35,
    monster: 'kull',
    mineraler: [],
    norske: ['Svalbard (paleogen)'],
  },
  // Metamorfe bergarter
  takskifer: {
    navn: 'takskifer',
    andreNavn: ['skifer'],
    gruppe: 'metamorf',
    undergruppe: 'foliert',
    grad: 'lav',
    fra: ['leirskifer'],
    dannelse: 'Leirskifer som er omdannet ved lav temperatur og trykk. Kløyves i tynne, glatte plater.',
    tekstur: ['foliert', 'finkornet'],
    teksturTekst: 'foliert og finkornet: tynne, plane plater uten synlige korn',
    tetthet: [2.7, 2.9],
    tetthetTypisk: 2.8,
    monster: 'leirskifer',
    mineraler: ['muskovitt', 'kloritt', 'kvarts'],
    norske: [],
  },
  fyllitt: {
    navn: 'fyllitt',
    gruppe: 'metamorf',
    undergruppe: 'foliert',
    grad: 'lav',
    fra: ['leirskifer', 'siltstein'],
    dannelse: 'Leirskifer omdannet litt sterkere enn takskifer; små glimmerkorn gir silkeglans.',
    tekstur: ['foliert', 'finkornet'],
    teksturTekst: 'foliert med silkeglans og ofte bølgete flater',
    tetthet: [2.68, 2.8],
    tetthetTypisk: 2.74,
    monster: 'glimmerskifer',
    mineraler: ['muskovitt', 'kloritt', 'kvarts'],
    norske: ['fjellkjeden i Trøndelag og indre Østlandet'],
  },
  glimmerskifer: {
    navn: 'glimmerskifer',
    gruppe: 'metamorf',
    undergruppe: 'foliert',
    grad: 'middels',
    fra: ['leirskifer', 'siltstein'],
    dannelse: 'Leirholdige sedimenter omdannet ved middels temperatur og trykk, f.eks. i en fjellkjede.',
    tekstur: ['foliert', 'middelskornet'],
    teksturTekst: 'foliert: glimmerflak som ligger parallelt og glitrer, ofte med røde granater',
    tetthet: [2.5, 2.9],
    tetthetTypisk: 2.7,
    monster: 'glimmerskifer',
    mineraler: ['muskovitt', 'biotitt', 'kvarts', 'granat'],
    norske: ['fjellkjeden i Nordland og Troms'],
  },
  gneis: {
    navn: 'gneis',
    gruppe: 'metamorf',
    undergruppe: 'foliert',
    grad: 'hoy',
    fra: ['granitt', 'sandstein', 'leirskifer'],
    dannelse: 'Bergarter omdannet ved høy temperatur og trykk dypt i skorpa; mineralene skilles i lyse og mørke bånd.',
    tekstur: ['bandet', 'foliert', 'grovkornet'],
    teksturTekst: 'båndet: lyse bånd av kvarts og feltspat og mørke bånd av glimmer og hornblende',
    tetthet: [2.6, 3.0],
    tetthetTypisk: 2.8,
    monster: 'gneis',
    mineraler: ['kvarts', 'kalifeltspat', 'plagioklas', 'biotitt', 'hornblende'],
    norske: ['Den vestlige gneisregionen (Vestlandet)', 'Lofoten'],
  },
  kvartsitt: {
    navn: 'kvartsitt',
    gruppe: 'metamorf',
    undergruppe: 'ikke-foliert',
    grad: 'middels',
    fra: ['sandstein'],
    dannelse: 'Kvartssandstein der kornene har vokst sammen ved metamorfose; brekker gjennom kornene.',
    tekstur: ['krystallinsk'],
    teksturTekst: 'krystallinsk og svært hard: risser glass og brekker gjennom kornene',
    tetthet: [2.5, 2.7],
    tetthetTypisk: 2.65,
    monster: 'kvartsitt',
    mineraler: ['kvarts'],
    norske: ['Altaskiferen (kvartsittskifer)', 'Tana i Finnmark'],
  },
  marmor: {
    navn: 'marmor',
    gruppe: 'metamorf',
    undergruppe: 'ikke-foliert',
    grad: 'middels',
    fra: ['kalkstein'],
    dannelse: 'Kalkstein omdannet ved metamorfose; kalkspaten krystalliserer på nytt i større korn.',
    tekstur: ['krystallinsk'],
    teksturTekst: 'krystallinsk og sukkeraktig, ofte med årer. Bruser i saltsyre.',
    tetthet: [2.6, 2.9],
    tetthetTypisk: 2.75,
    monster: 'marmor',
    mineraler: ['kalkspat', 'dolomitt'],
    norske: ['Fauske i Nordland', 'Brønnøy (kalkspatmarmor)'],
  },
  amfibolitt: {
    navn: 'amfibolitt',
    gruppe: 'metamorf',
    undergruppe: 'foliert',
    grad: 'middels',
    fra: ['basalt', 'gabbro', 'diabas'],
    dannelse: 'Basalt eller gabbro omdannet ved middels til høy temperatur.',
    tekstur: ['foliert', 'middelskornet'],
    teksturTekst: 'mørk og middelskornet, med parallelle hornblendekrystaller',
    tetthet: [2.9, 3.1],
    tetthetTypisk: 3.0,
    monster: 'gneis',
    mineraler: ['hornblende', 'plagioklas'],
    norske: [],
  },
  eklogitt: {
    navn: 'eklogitt',
    gruppe: 'metamorf',
    undergruppe: 'ikke-foliert',
    grad: 'hoy',
    fra: ['basalt', 'gabbro'],
    dannelse: 'Basalt eller gabbro omdannet ved svært høyt trykk, dypt nede i en subduksjonssone, og løftet opp igjen.',
    tekstur: ['krystallinsk', 'middelskornet'],
    teksturTekst: 'røde granatkorn i en grønn grunnmasse av pyroksen (omfasitt). Svært tung.',
    tetthet: [3.2, 3.55],
    tetthetTypisk: 3.4,
    monster: 'gabbro',
    mineraler: ['granat', 'rutil'],
    norske: ['Nordfjord og Sunnmøre', 'Engebøfjellet i Sunnfjord'],
  },
};

/** Alle bergartene etter id. For de 15 bergartsmønstrene er id-en lik mønsteret (`BERGARTER.gneis.monster === 'gneis'`). */
export const BERGARTER: Readonly<Record<BergartId, Bergart>> = Object.fromEntries(
  (Object.entries(DATA) as [BergartId, B][]).map(([id, b]) => [id, { ...b, id }]),
) as Record<BergartId, Bergart>;

/** Alle bergart-id-ene i fast rekkefølge (magmatiske, sedimentære, metamorfe). */
export const BERGART_IDS: readonly BergartId[] = Object.keys(DATA) as BergartId[];

/** Bergarten med denne id-en, eller null. */
export function bergart(id: string): Bergart | null {
  return (BERGARTER as Record<string, Bergart | undefined>)[id] ?? null;
}

// ---------------------------------------------------------------------------------------------------------------
// Magmatiske bergarter

/** En rute i tabellen over magmatiske bergarter. */
export interface MagmatiskRute {
  kjemi: Exclude<Kjemi, 'ultrabasisk'>;
  forekomst: Forekomst;
  id: BergartId;
}

/**
 * De ni rutene for magmatiske bergarter: kjemi (sur, intermediær, basisk) × hvor magmaet størknet (dyp, gang, dag).
 * Sortert rad for rad: dypbergartene først, fra sur til basisk.
 *
 * Kilde: inndelingen i norske lærebøker i geofag (granitt–kvartsporfyr–ryolitt, dioritt–porfyritt–andesitt,
 * gabbro–diabas–basalt).
 */
export const MAGMATISKE: readonly MagmatiskRute[] = [
  { kjemi: 'sur', forekomst: 'dyp', id: 'granitt' },
  { kjemi: 'intermediaer', forekomst: 'dyp', id: 'dioritt' },
  { kjemi: 'basisk', forekomst: 'dyp', id: 'gabbro' },
  { kjemi: 'sur', forekomst: 'gang', id: 'kvartsporfyr' },
  { kjemi: 'intermediaer', forekomst: 'gang', id: 'porfyritt' },
  { kjemi: 'basisk', forekomst: 'gang', id: 'diabas' },
  { kjemi: 'sur', forekomst: 'dag', id: 'ryolitt' },
  { kjemi: 'intermediaer', forekomst: 'dag', id: 'andesitt' },
  { kjemi: 'basisk', forekomst: 'dag', id: 'basalt' },
];

/** Magmatiske bergarter med norsk tilknytning utenom de ni rutene, med plassen de ville hatt i tabellen. */
export const NORSKE_MAGMATISKE: readonly BergartId[] = ['larvikitt', 'rombeporfyr', 'anortositt', 'peridotitt'];

/** Kjemi, SiO₂-intervall (vektprosent) og typiske egenskaper. */
export interface KjemiKlasse {
  kjemi: Kjemi;
  /** «sur», «intermediær» … */
  navn: string;
  /** SiO₂ i vektprosent [min, maks). */
  sio2: readonly [number, number];
  /** Kort beskrivelse: farge og seighet i magmaet. */
  beskrivelse: string;
}

/**
 * Kjemien i magmatiske bergarter etter SiO₂-innholdet (vektprosent): ultrabasisk under 45 %, basisk 45–52 %,
 * intermediær 52–63 % og sur over 63 %, med en kort beskrivelse av farge og hvor seigt magmaet er. Se `kjemiFraSiO2`.
 *
 * Kilde: IUGS (Le Maitre mfl. 2002), grensene 45, 52 og 63 % SiO₂.
 */
export const KJEMI_KLASSER: readonly KjemiKlasse[] = [
  { kjemi: 'ultrabasisk', navn: 'ultrabasisk', sio2: [35, 45], beskrivelse: 'Grønn til svart, mest olivin. Mantelen.' },
  { kjemi: 'basisk', navn: 'basisk', sio2: [45, 52], beskrivelse: 'Mørk; lettflytende magma, rolige utbrudd.' },
  {
    kjemi: 'intermediaer',
    navn: 'intermediær',
    sio2: [52, 63],
    beskrivelse: 'Grå; seigere magma, ofte eksplosive utbrudd.',
  },
  { kjemi: 'sur', navn: 'sur', sio2: [63, 80], beskrivelse: 'Lys; svært seig magma, kraftige utbrudd.' },
];

/** Kjemien fra SiO₂-innholdet (vektprosent), eller null utenfor 35–80 % og for ugyldige tall. */
export function kjemiFraSiO2(sio2: number): Kjemi | null {
  if (!Number.isFinite(sio2)) return null;
  const k = KJEMI_KLASSER.find((c, i) => sio2 >= c.sio2[0] && (sio2 < c.sio2[1] || (i === KJEMI_KLASSER.length - 1 && sio2 <= c.sio2[1])));
  return k?.kjemi ?? null;
}

/** Grensen i mm mellom finkornet (dagbergart) og grovkornet (dypbergart) i `klassifiserMagmatisk`. */
export const FINKORNET_GRENSE_MM = 1;

/** Det som er kjent om en magmatisk bergart (til `klassifiserMagmatisk`). Kjemi og forekomst må kunne avgjøres. */
export interface MagmatiskInndata {
  /** SiO₂ i vektprosent (brukes når `kjemi` mangler). */
  sio2?: number;
  kjemi?: Kjemi;
  forekomst?: Forekomst;
  /**
   * Typisk kornstørrelse i mm (brukes når `forekomst` mangler): under 1 mm regnes som dagbergart, ellers dypbergart.
   * Gangbergarter kan ikke skilles ut på kornstørrelsen alene og må gis som `forekomst: 'gang'`.
   */
  kornMm?: number;
  /** Naturlig glass (ingen krystaller): dagbergart, og obsidian når magmaet er surt. */
  glass?: boolean;
}

/**
 * Den magmatiske bergarten som passer med kjemi og forekomst: `klassifiserMagmatisk({ sio2: 72, kornMm: 4 })` gir
 * granitt. Ultrabasisk i dypet gir peridotitt. Null når noe mangler eller er ugyldig, eller når kombinasjonen ikke
 * har en bergart i tabellen (ultrabasisk lava).
 */
export function klassifiserMagmatisk(inn: MagmatiskInndata): Bergart | null {
  const kjemi = inn.kjemi ?? (inn.sio2 !== undefined ? kjemiFraSiO2(inn.sio2) : null);
  if (!kjemi) return null;
  let forekomst: Forekomst | null = inn.forekomst ?? null;
  if (!forekomst && inn.glass) forekomst = 'dag';
  if (!forekomst && inn.kornMm !== undefined) {
    if (!Number.isFinite(inn.kornMm) || inn.kornMm < 0) return null;
    forekomst = inn.kornMm < FINKORNET_GRENSE_MM ? 'dag' : 'dyp';
  }
  if (!forekomst) return null;
  if (kjemi === 'ultrabasisk') return forekomst === 'dyp' ? BERGARTER.peridotitt : null;
  if (inn.glass && kjemi === 'sur') return BERGARTER.obsidian;
  const rute = MAGMATISKE.find((r) => r.kjemi === kjemi && r.forekomst === forekomst);
  return rute ? BERGARTER[rute.id] : null;
}

// ---------------------------------------------------------------------------------------------------------------
// Sedimentære og metamorfe bergarter

/** Sedimentære bergarter: klastiske fra grov til fin, så kjemiske og biogene. */
export const SEDIMENTARE: readonly BergartId[] = [
  'konglomerat',
  'breksje',
  'sandstein',
  'siltstein',
  'leirskifer',
  'salt',
  'kalkstein',
  'kull',
];

/** Metamorfe bergarter: den folierte rekken fra leirskifer (lav til høy grad), så de ikke-folierte. */
export const METAMORFE: readonly BergartId[] = [
  'takskifer',
  'fyllitt',
  'glimmerskifer',
  'gneis',
  'amfibolitt',
  'kvartsitt',
  'marmor',
  'eklogitt',
];

/**
 * Den klastiske sedimentære bergarten for en kornstørrelse i mm: leirskifer under 0,002 mm, siltstein til 0,063 mm,
 * sandstein til 2 mm, og over det konglomerat (runde korn) eller breksje (`kantete`). Null for negative eller
 * ugyldige tall.
 */
export function klassifiserKlastisk(kornMm: number, kantete = false): Bergart | null {
  if (!Number.isFinite(kornMm) || kornMm < 0) return null;
  if (kornMm < 0.002) return BERGARTER.leirskifer;
  if (kornMm < 0.063) return BERGARTER.siltstein;
  if (kornMm < 2) return BERGARTER.sandstein;
  return kantete ? BERGARTER.breksje : BERGARTER.konglomerat;
}

/** Bergartene i en gruppe, i tabellens rekkefølge. */
export function bergarterIGruppe(gruppe: BergartGruppe): Bergart[] {
  return BERGART_IDS.map((id) => BERGARTER[id]).filter((b) => b.gruppe === gruppe);
}

// ---------------------------------------------------------------------------------------------------------------
// Bergartenes kretsløp

/** Et stadium i bergartenes kretsløp. */
export type SyklusStadium = 'magma' | 'magmatisk' | 'sediment' | 'sedimentar' | 'metamorf';

/** Prosessene som flytter stoff mellom stadiene. */
export type SyklusProsess = 'storkning' | 'forvitring' | 'diagenese' | 'metamorfose' | 'oppsmelting';

/** En pil i bergartenes kretsløp. */
export interface SyklusOvergang {
  fra: SyklusStadium;
  til: SyklusStadium;
  prosess: SyklusProsess;
  /** Etiketten på pila: «forvitring og erosjon». */
  navn: string;
  /** Forklaring i én setning. */
  beskrivelse: string;
}

const PROSESS_NAVN: Record<SyklusProsess, string> = {
  storkning: 'størkning',
  forvitring: 'hevning, forvitring og erosjon',
  diagenese: 'begravning og diagenese',
  metamorfose: 'metamorfose',
  oppsmelting: 'oppsmelting',
};

const PROSESS_TEKST: Record<SyklusProsess, string> = {
  storkning: 'Magmaet kjøles ned og krystalliserer: langsomt i dypet (dypbergart) eller raskt på overflaten (dagbergart).',
  forvitring:
    'Bergarten løftes til overflaten, brytes ned av vær, vann og is, og kornene fraktes bort og avsettes som sediment.',
  diagenese: 'Sedimentene begraves under nye lag, presses sammen og sementeres til fast stein.',
  metamorfose: 'Høy temperatur og høyt trykk, f.eks. i en fjellkjede, omdanner mineralene uten at bergarten smelter.',
  oppsmelting: 'Blir temperaturen høy nok, smelter bergarten til magma.',
};

function overgang(fra: SyklusStadium, til: SyklusStadium, prosess: SyklusProsess): SyklusOvergang {
  return { fra, til, prosess, navn: PROSESS_NAVN[prosess], beskrivelse: PROSESS_TEKST[prosess] };
}

/**
 * Bergartenes kretsløp: fem stadier og pilene mellom dem, med de store rundene først (magma → magmatisk → sediment →
 * sedimentær → metamorf → magma) og snarveiene etterpå.
 *
 * Kilde: den vanlige framstillingen i lærebøkene i geofag.
 */
export const SYKLUS: {
  readonly stadier: readonly { id: SyklusStadium; navn: string; beskrivelse: string }[];
  readonly overganger: readonly SyklusOvergang[];
} = {
  stadier: [
    { id: 'magma', navn: 'magma', beskrivelse: 'Smeltet stein under overflaten (lava når den kommer ut).' },
    { id: 'magmatisk', navn: 'magmatiske bergarter', beskrivelse: 'Størknet magma eller lava.' },
    { id: 'sediment', navn: 'sedimenter', beskrivelse: 'Løse korn av grus, sand, silt og leire, og kalk og planterester.' },
    { id: 'sedimentar', navn: 'sedimentære bergarter', beskrivelse: 'Sedimenter som er blitt til fast stein.' },
    { id: 'metamorf', navn: 'metamorfe bergarter', beskrivelse: 'Bergarter omdannet av varme og trykk.' },
  ],
  overganger: [
    overgang('magma', 'magmatisk', 'storkning'),
    overgang('magmatisk', 'sediment', 'forvitring'),
    overgang('sediment', 'sedimentar', 'diagenese'),
    overgang('sedimentar', 'metamorf', 'metamorfose'),
    overgang('metamorf', 'magma', 'oppsmelting'),
    overgang('magmatisk', 'metamorf', 'metamorfose'),
    overgang('sedimentar', 'sediment', 'forvitring'),
    overgang('metamorf', 'sediment', 'forvitring'),
    overgang('sedimentar', 'magma', 'oppsmelting'),
    overgang('magmatisk', 'magma', 'oppsmelting'),
  ],
};

/** Bergartsgruppen som hører til et stadium i kretsløpet, eller null for magma og sedimenter. */
export function gruppeForStadium(s: SyklusStadium): BergartGruppe | null {
  return s === 'magmatisk' ? 'magmatisk' : s === 'sedimentar' ? 'sedimentar' : s === 'metamorf' ? 'metamorf' : null;
}
