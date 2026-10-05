/**
 * Liv (Bi 1 kapittel 1, KM3 og KM5): organisasjonsnivåene fra molekyl til biosfære med ekte størrelser, og
 * kjennetegnene på liv brukt på grensetilfeller. Ren modell uten React.
 *
 * Kilder for størrelsene (avrundet, som i lærebøkene): DNA-dobbelthelixen er ca. 2 nm bred; mitokondrier er ca. 1–2 µm
 * lange og kloroplaster ca. 5–10 µm; en hjertemuskelcelle er ca. 0,1 mm lang; veggen i venstre hjertekammer er ca. 1 cm
 * tykk; hjertet er omtrent på størrelse med en knyttneve (ca. 12 cm); barnålene på gran er 1–2,5 cm; en voksen gran er
 * 20–35 m høy; tykktarmen er ca. 1,5 m lang; Jordas diameter er 12 742 km. Forenklinger: populasjonen, samfunnet og
 * økosystemet i eksemplene har samme utstrekning (det som skiller dem, er hva vi tar med, ikke hvor stort området er).
 */

/* ====================================================================== */
/* Organisasjonsnivåer                                                      */
/* ====================================================================== */

export type LevelId =
  | 'molekyl'
  | 'organell'
  | 'celle'
  | 'vev'
  | 'organ'
  | 'organsystem'
  | 'organisme'
  | 'populasjon'
  | 'samfunn'
  | 'okosystem'
  | 'biosfaere';

/** Ett eksempel på et nivå: hva det er, og hvor stort det er i virkeligheten. */
export interface LevelExample {
  /** Kort navn (figurtittel), f.eks. «Mitokondrie». Vitenskapelige navn står mellom stjerner (*E. coli*) og settes i kursiv. */
  name: string;
  /** Én setning om eksemplet. */
  detail: string;
  /** Ekte størrelse i meter (lengde, bredde eller diameter, se `measure`). */
  size: number;
  /** Hva størrelsen måler, f.eks. «bredde» eller «lengde». */
  measure: string;
}

export interface Level {
  id: LevelId;
  /** Navnet på nivået med stor forbokstav. */
  name: string;
  /** Kort definisjon som i Bi 1. */
  definition: string;
  /** Hva nivået er bygd opp av (enhetene fra nivået under). */
  consistsOf: string;
  human: LevelExample;
  forest: LevelExample;
  /** En ny egenskap som oppstår på dette nivået (emergent egenskap). */
  emergent: string;
  /** Er nivået levende i seg selv? Cellen er den minste levende enheten. */
  living: boolean;
  /** Økologisk nivå (populasjon og oppover). */
  ecological: boolean;
}

export const LEVELS: readonly Level[] = [
  {
    id: 'molekyl',
    name: 'Molekyl',
    definition: 'Atomer bundet sammen. De store biologiske molekylene er DNA, proteiner, karbohydrater og lipider.',
    consistsOf: 'atomer',
    human: { name: 'DNA', detail: 'Arvestoffet i cellekjernen, en dobbelthelix av to tråder.', size: 2e-9, measure: 'bredde' },
    forest: { name: 'Klorofyll', detail: 'Det grønne fargestoffet i granbaret, som fanger lys.', size: 1.5e-9, measure: 'bredde' },
    emergent: 'DNA lagrer informasjon i rekkefølgen av basene, og klorofyll fanger lysenergi. Men et molekyl er ikke levende.',
    living: false,
    ecological: false,
  },
  {
    id: 'organell',
    name: 'Organell',
    definition: 'En del av cellen med en bestemt oppgave, ofte omgitt av en membran.',
    consistsOf: 'molekyler (membraner, proteiner, DNA)',
    human: { name: 'Mitokondrie', detail: 'Lager ATP i celleåndingen. En hjertemuskelcelle har tusenvis.', size: 2e-6, measure: 'lengde' },
    forest: { name: 'Kloroplast', detail: 'Driver fotosyntesen i cellene i barnålene.', size: 5e-6, measure: 'lengde' },
    emergent:
      'Molekylene er ordnet i membraner og enzymer som samarbeider: mitokondrien omdanner energien i sukker til ATP. Men en organell kan ikke leve alene utenfor cellen.',
    living: false,
    ecological: false,
  },
  {
    id: 'celle',
    name: 'Celle',
    definition: 'Den minste enheten som er levende. Alle organismer er bygd av én eller flere celler.',
    consistsOf: 'organeller, cytoplasma og en cellemembran',
    human: { name: 'Hjertemuskelcelle', detail: 'Avlang celle med tverrstriper og mange mitokondrier.', size: 1e-4, measure: 'lengde' },
    forest: { name: 'Celle i en barnål', detail: 'Plantecelle med cellevegg, vakuole og kloroplaster.', size: 5e-5, measure: 'lengde' },
    emergent:
      'Her oppstår liv: cellen har stoffskifte, holder et stabilt indre miljø, vokser og kan dele seg. Ingen av organellene klarer det alene.',
    living: true,
    ecological: false,
  },
  {
    id: 'vev',
    name: 'Vev',
    definition: 'Mange like celler som samarbeider om én oppgave.',
    consistsOf: 'celler av samme type',
    human: { name: 'Hjertemuskelvev', detail: 'Muskelceller koblet i et nettverk. Hjerteveggen er ca. 1 cm tykk.', size: 1e-2, measure: 'tykkelse' },
    forest: { name: 'Fotosyntesevev', detail: 'Tett i tett med celler fulle av kloroplaster inne i barnåla.', size: 1e-3, measure: 'tykkelse' },
    emergent: 'Cellene er koblet sammen, så hjertemuskelvevet trekker seg sammen i takt. En enkelt celle kan ikke det.',
    living: true,
    ecological: false,
  },
  {
    id: 'organ',
    name: 'Organ',
    definition: 'Flere typer vev bygd sammen til en enhet med en bestemt funksjon.',
    consistsOf: 'flere typer vev (muskelvev, bindevev, nervevev, dekkvev)',
    human: { name: 'Hjertet', detail: 'Omtrent på størrelse med en knyttneve.', size: 0.12, measure: 'lengde' },
    forest: { name: 'Barnål', detail: 'Bladet til grana: dekkvev, fotosyntesevev og ledningsvev.', size: 0.02, measure: 'lengde' },
    emergent: 'Vevene sammen gir en ny funksjon: hjertet pumper blod, og barnåla tar opp CO₂ gjennom spalteåpningene og lager sukker.',
    living: true,
    ecological: false,
  },
  {
    id: 'organsystem',
    name: 'Organsystem',
    definition: 'Flere organer som samarbeider om en hovedoppgave.',
    consistsOf: 'organer',
    human: {
      name: 'Sirkulasjonssystemet',
      detail: 'Hjertet, blodårene og blodet. Blodårene er til sammen omtrent 100 000 km lange.',
      size: 1.7,
      measure: 'høyde',
    },
    forest: { name: 'Skuddsystemet', detail: 'Stammen, greinene og nålene (røttene er rotsystemet).', size: 25, measure: 'høyde' },
    emergent: 'Organene sammen frakter stoffer i hele kroppen: blodet bringer oksygen og næring til hver eneste celle.',
    living: true,
    ecological: false,
  },
  {
    id: 'organisme',
    name: 'Organisme',
    definition: 'Et helt individ, bygd av organsystemer (eller av én celle hos encellede).',
    consistsOf: 'organsystemer',
    human: { name: 'Et menneske', detail: 'Ca. 30 000 milliarder celler i ett individ.', size: 1.7, measure: 'høyde' },
    forest: { name: 'En gran', detail: 'Vanligste treslaget i norsk skog, *Picea abies*.', size: 25, measure: 'høyde' },
    emergent: 'Et helt individ kan regulere sitt indre miljø (homeostase), reagere på omgivelsene og formere seg.',
    living: true,
    ecological: false,
  },
  {
    id: 'populasjon',
    name: 'Populasjon',
    definition: 'Alle individene av samme art i et område på samme tid.',
    consistsOf: 'individer av samme art',
    human: { name: '*E. coli* i tarmen', detail: 'Alle bakteriene av arten *Escherichia coli* i tykktarmen din.', size: 1.5, measure: 'tykktarmens lengde' },
    forest: { name: 'Granene i skogen', detail: 'Alle granene i en skog, unge og gamle.', size: 1000, measure: 'bredde' },
    emergent:
      'En populasjon har egenskaper som ingen enkeltindivid har: tetthet, fødselstall, dødstall og genetisk variasjon.',
    living: true,
    ecological: true,
  },
  {
    id: 'samfunn',
    name: 'Samfunn',
    definition: 'Alle populasjonene av ulike arter som lever i samme område.',
    consistsOf: 'populasjoner av ulike arter',
    human: { name: 'Tarmfloraen', detail: 'Flere hundre arter av bakterier, arker og sopp i tarmen.', size: 1.5, measure: 'tykktarmens lengde' },
    forest: { name: 'Alle artene i skogen', detail: 'Gran, blåbær, moser, sopp, elg, maur, fugler og bakterier.', size: 1000, measure: 'bredde' },
    emergent: 'Artene påvirker hverandre: næringsnett, konkurranse og samarbeid, som sopp som lever i symbiose med granrøttene.',
    living: true,
    ecological: true,
  },
  {
    id: 'okosystem',
    name: 'Økosystem',
    definition: 'Samfunnet sammen med de abiotiske faktorene: lys, vann, temperatur, luft og jord.',
    consistsOf: 'samfunnet og det ikke-levende miljøet',
    human: { name: 'Tykktarmen', detail: 'Tarmfloraen sammen med maten, vannet, slimet og mangelen på oksygen.', size: 1.5, measure: 'lengde' },
    forest: { name: 'Granskogen', detail: 'Alle artene sammen med jord, bekker, luft, lys og klima.', size: 1000, measure: 'bredde' },
    emergent: 'Stoffer går i kretsløp og energi strømmer gjennom systemet: fra sollys via planter og dyr til nedbrytere.',
    living: true,
    ecological: true,
  },
  {
    id: 'biosfaere',
    name: 'Biosfære',
    definition: 'Alle økosystemene på jorda: det tynne laget der det finnes liv.',
    consistsOf: 'alle økosystemene',
    human: { name: 'Jorda', detail: 'Alt liv på jorda, også deg og bakteriene dine.', size: 12_742_000, measure: 'diameter' },
    forest: { name: 'Jorda', detail: 'Skogene dekker nesten en tredjedel av landjorda.', size: 12_742_000, measure: 'diameter' },
    emergent: 'Livet har forandret hele planeten: nesten alt oksygenet i lufta kommer fra fotosyntese.',
    living: true,
    ecological: true,
  },
];

export const LEVEL_COUNT = LEVELS.length;

export function level(id: LevelId): Level {
  const l = LEVELS.find((x) => x.id === id);
  if (!l) throw new Error(`Ukjent nivå: ${id}`);
  return l;
}

/** Nivået med indeks i (0 = molekyl), begrenset til gyldige indekser. */
export function levelAt(i: number): Level {
  const k = Math.min(LEVEL_COUNT - 1, Math.max(0, Math.round(i)));
  return LEVELS[k]!;
}

/** Hvor mange ganger større eksemplet er enn eksemplet på nivået under (samme kolonne). 1 når de er like store. */
export function ratioToPrevious(i: number, column: 'human' | 'forest'): number | null {
  if (i <= 0 || i >= LEVEL_COUNT) return null;
  return LEVELS[i]![column].size / LEVELS[i - 1]![column].size;
}

/* ---------- Lengder ---------- */

/** Tallformat med desimalkomma og mellomrom som tusenskille (uten avhengighet til React-kit-et). */
function numberNo(v: number, decimals: number): string {
  return new Intl.NumberFormat('nb-NO', { minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(v);
}

const UNITS: readonly { unit: string; m: number }[] = [
  { unit: 'nm', m: 1e-9 },
  { unit: 'µm', m: 1e-6 },
  { unit: 'mm', m: 1e-3 },
  { unit: 'cm', m: 1e-2 },
  { unit: 'm', m: 1 },
  { unit: 'km', m: 1e3 },
];

/**
 * Lengde i meter som lesbar tekst med passende enhet: 2e-9 → «2 nm», 1,5e-6 → «1,5 µm», 0,12 → «12 cm»,
 * 12 742 000 → «12 700 km». Tall under 10 får én desimal når det trengs, større tall avrundes til to–tre siffer.
 */
export function fmtLength(m: number): string {
  if (!Number.isFinite(m) || m <= 0) return '–';
  let u = UNITS[0]!;
  for (const c of UNITS) if (m >= c.m * 0.9999) u = c;
  const v = m / u.m;
  let text: string;
  if (v < 10) {
    const r = Math.round(v * 10) / 10;
    text = numberNo(r, Number.isInteger(r) ? 0 : 1);
  } else if (v < 1000) text = numberNo(Math.round(v), 0);
  else text = numberNo(Math.round(v / 100) * 100, 0);
  return `${text}\u00a0${u.unit}`;
}

/** Størrelsesskalaen i figuren: fra 1 nm til 100 000 km (10⁻⁹ til 10⁸ m). */
export const SCALE_MIN_EXP = -9;
export const SCALE_MAX_EXP = 8;

/** Plassering (0–1) på den logaritmiske størrelsesskalaen. */
export function scalePos(m: number): number {
  const e = Math.log10(Math.max(10 ** SCALE_MIN_EXP, m));
  return Math.min(1, Math.max(0, (e - SCALE_MIN_EXP) / (SCALE_MAX_EXP - SCALE_MIN_EXP)));
}

/** Hvor mange tierpotenser (størrelsesordener) det er mellom to størrelser. */
export const ordersOfMagnitude = (a: number, b: number): number => Math.abs(Math.log10(b / a));

/* ====================================================================== */
/* Hva er liv?                                                              */
/* ====================================================================== */

export type CriterionId = 'celler' | 'stoffskifte' | 'vekst' | 'formering' | 'reagerer' | 'homeostase' | 'arv';

export interface Criterion {
  id: CriterionId;
  /** Kjennetegnet slik det står i læreboka. */
  name: string;
  /** Kort navn til kolonneoverskrifter og brytere. */
  short: string;
  /** Hva kjennetegnet betyr. */
  meaning: string;
}

/** Kjennetegnene på liv i Bi 1 (rekkefølgen er rekkefølgen i figuren). */
export const CRITERIA: readonly Criterion[] = [
  { id: 'celler', name: 'Er bygd opp av celler', short: 'Celler', meaning: 'Alle levende organismer består av én eller flere celler.' },
  {
    id: 'stoffskifte',
    name: 'Har stoffskifte',
    short: 'Stoffskifte',
    meaning: 'Tar opp stoffer og energi og bygger om dem med enzymer (f.eks. celleånding og fotosyntese).',
  },
  { id: 'vekst', name: 'Vokser og utvikler seg', short: 'Vekst', meaning: 'Bygger nytt stoff av seg selv og går gjennom en livssyklus.' },
  { id: 'formering', name: 'Formerer seg', short: 'Formering', meaning: 'Lager nye individer, kjønnet eller ukjønnet.' },
  { id: 'reagerer', name: 'Reagerer på omgivelsene', short: 'Reagerer', meaning: 'Merker endringer (lys, temperatur, stoffer) og svarer på dem.' },
  { id: 'homeostase', name: 'Holder et stabilt indre miljø', short: 'Homeostase', meaning: 'Regulerer det indre miljøet (homeostase), f.eks. vann og pH.' },
  {
    id: 'arv',
    name: 'Har arvestoff og utvikler seg (evolusjon)',
    short: 'Arv og evolusjon',
    meaning: 'Har DNA (eller RNA) som føres videre til avkommet, så arten kan endre seg over generasjoner.',
  },
];

export const ALL_CRITERIA: readonly CriterionId[] = CRITERIA.map((c) => c.id);

/**
 * Hvordan en kandidat oppfyller et kjennetegn:
 * - `ja`: oppfyller det
 * - `delvis`: bare tilsynelatende, bare med hjelp (f.eks. inne i en vertscelle) eller bare noe av det
 * - `hvile`: ikke nå, men gjør det igjen når den våkner eller spirer (latent liv)
 * - `nei`: oppfyller det ikke
 */
export type Mark = 'ja' | 'delvis' | 'hvile' | 'nei';

export const MARK_NAMES: Record<Mark, string> = { ja: 'Ja', delvis: 'Delvis', hvile: 'Ikke nå (i hvile)', nei: 'Nei' };

export type CandidateId = 'bakterie' | 'gjaer' | 'fro' | 'tardigrad' | 'virus' | 'prion' | 'ild' | 'krystall';

export interface Candidate {
  id: CandidateId;
  /** Navn med stor forbokstav (figur og nedtrekksliste). */
  name: string;
  /** Vitenskapelig navn når det finnes (kursiv i visningen). */
  sci?: string;
  marks: Record<CriterionId, { mark: Mark; why: string }>;
  /** Hva biologene mener, kort. */
  consensus: string;
}

const m = (mark: Mark, why: string) => ({ mark, why });

/**
 * Kandidatene. Vurderingene følger Bi 1 og vanlige lærebøker; grensetilfellene er bevisst valgt fordi de deler
 * kjennetegnene på ulike måter. «Tardigrad i dvale» = bjørnedyr i tørkedvale (tun-stadium), der stoffskiftet er nede i
 * under 0,01 % av det normale (kryptobiose).
 */
export const CANDIDATES: readonly Candidate[] = [
  {
    id: 'bakterie',
    name: 'Bakterie',
    sci: 'Escherichia coli',
    marks: {
      celler: m('ja', 'Én prokaryot celle med cellemembran, cellevegg og ribosomer.'),
      stoffskifte: m('ja', 'Bryter ned sukker med enzymer og lager ATP.'),
      vekst: m('ja', 'Bygger nytt cellemateriale og blir større før den deler seg.'),
      formering: m('ja', 'Deler seg i to, under gode forhold omtrent hvert 20. minutt.'),
      reagerer: m('ja', 'Svømmer mot næring og bort fra giftstoffer.'),
      homeostase: m('ja', 'Regulerer vann, salter og pH inne i cellen.'),
      arv: m('ja', 'Har DNA, og arten endrer seg, f.eks. når den blir resistent mot antibiotika.'),
    },
    consensus: 'Bakterier er levende: de har alle kjennetegnene.',
  },
  {
    id: 'gjaer',
    name: 'Gjærcelle',
    sci: 'Saccharomyces cerevisiae',
    marks: {
      celler: m('ja', 'Én eukaryot celle med cellekjerne og mitokondrier.'),
      stoffskifte: m('ja', 'Gjærer sukker til CO₂ og etanol, eller driver celleånding med oksygen.'),
      vekst: m('ja', 'Vokser og danner knopper.'),
      formering: m('ja', 'Formerer seg ved knoppskyting.'),
      reagerer: m('ja', 'Skifter mellom gjæring og celleånding etter hvor mye oksygen det er.'),
      homeostase: m('ja', 'Regulerer vann og pH inne i cellen.'),
      arv: m('ja', 'Har DNA i cellekjernen og utvikler seg som alle andre arter.'),
    },
    consensus: 'Gjær er levende: en encellet sopp.',
  },
  {
    id: 'fro',
    name: 'Frø',
    marks: {
      celler: m('ja', 'Et lite plantefoster (kim) og opplagsnæring, bygd av celler.'),
      stoffskifte: m('hvile', 'Nesten ingen celleånding mens det er tørt. Starter igjen når frøet får vann.'),
      vekst: m('hvile', 'Vokser ikke i hvile, men spirer når det får vann og varme.'),
      formering: m('hvile', 'Frøet er selv resultatet av formering, og blir en plante som kan lage nye frø.'),
      reagerer: m('ja', 'Merker vann, temperatur og lys, og spirer når forholdene er riktige.'),
      homeostase: m('hvile', 'Tåler uttørking i hvile. Regulerer igjen når det spirer.'),
      arv: m('ja', 'Har DNA fra begge foreldrene.'),
    },
    consensus: 'Et frø er levende, men i hvile (latent liv). Noen frø kan spire etter flere hundre år.',
  },
  {
    id: 'tardigrad',
    name: 'Tardigrad i dvale',
    sci: 'Tardigrada',
    marks: {
      celler: m('ja', 'Et lite dyr (under 1 mm) bygd av celler.'),
      stoffskifte: m('hvile', 'I tørkedvale er stoffskiftet nede i under 0,01 % av det normale.'),
      vekst: m('hvile', 'Vokser ikke i dvale, men fortsetter når den får vann.'),
      formering: m('hvile', 'Kan ikke formere seg i dvale, men legger egg når den er aktiv.'),
      reagerer: m('hvile', 'Reagerer ikke på lys eller berøring i dvale, men våkner når den får vann.'),
      homeostase: m('hvile', 'Tørker nesten helt ut og beskytter cellene med spesielle sukker og proteiner.'),
      arv: m('ja', 'Har DNA og er en dyreart med egen evolusjon.'),
    },
    consensus:
      'En tardigrad i dvale regnes som levende, fordi den har alt som trengs og våkner igjen. Den har overlevd både tørke, kulde og verdensrommet.',
  },
  {
    id: 'virus',
    name: 'Virus',
    marks: {
      celler: m('nei', 'Bare arvestoff i en proteinkappe (kapsid). Ingen cellemembran, ingen ribosomer.'),
      stoffskifte: m('nei', 'Har ingen enzymer for å lage energi. Bruker vertscellens stoffskifte.'),
      vekst: m('nei', 'Vokser ikke: nye virus settes sammen av ferdige deler inne i vertscellen.'),
      formering: m('delvis', 'Formerer seg bare inne i en levende vertscelle, ved å bruke cellens maskineri.'),
      reagerer: m('nei', 'Utenfor en celle er viruset en «død» partikkel som ikke reagerer på noe.'),
      homeostase: m('nei', 'Har ikke noe indre miljø å regulere.'),
      arv: m('ja', 'Har DNA eller RNA og utvikler seg raskt, f.eks. nye varianter av influensa og koronavirus.'),
    },
    consensus:
      'Virus er det klassiske grensetilfellet. De har arvestoff og evolusjon, men ingen celler og intet eget stoffskifte, så de fleste lærebøker regner dem ikke som levende.',
  },
  {
    id: 'prion',
    name: 'Prion',
    marks: {
      celler: m('nei', 'Et feilfoldet protein, ikke en celle.'),
      stoffskifte: m('nei', 'Har ikke stoffskifte.'),
      vekst: m('nei', 'Vokser ikke, men feilfoldede proteiner kan klumpe seg sammen.'),
      formering: m('delvis', 'Får normale proteiner i hjernen til å folde seg feil, så antallet øker, uten arvestoff.'),
      reagerer: m('nei', 'Reagerer ikke på omgivelsene.'),
      homeostase: m('nei', 'Har ikke noe indre miljø.'),
      arv: m('nei', 'Har verken DNA eller RNA.'),
    },
    consensus: 'Prioner er ikke levende, men de er smittsomme og gir dødelige hjernesykdommer som skrantesjuke hos hjortedyr og kugalskap.',
  },
  {
    id: 'ild',
    name: 'Ild',
    marks: {
      celler: m('nei', 'Ingen celler: en kjemisk reaksjon mellom brensel og oksygen.'),
      stoffskifte: m('delvis', 'Bruker oksygen og frigjør energi, som celleånding, men uten enzymer og uten regulering.'),
      vekst: m('delvis', 'Blir større når det er mer brensel, men bygger ikke noe nytt stoff.'),
      formering: m('delvis', 'Gnister kan tenne nye bål, men det nye bålet arver ingenting.'),
      reagerer: m('delvis', 'Blusser opp i vind, men det er fysikk og kjemi, ikke en respons.'),
      homeostase: m('nei', 'Regulerer ingenting: brenner ukontrollert til brenselet er brukt opp.'),
      arv: m('nei', 'Har ikke arvestoff og kan ikke utvikle seg over generasjoner.'),
    },
    consensus: 'Ild ligner liv på flere punkter, men er en kjemisk reaksjon. Ingenting arves, så ild kan ikke utvikle seg.',
  },
  {
    id: 'krystall',
    name: 'Krystall',
    marks: {
      celler: m('nei', 'Atomer eller ioner i et fast mønster, f.eks. salt eller is.'),
      stoffskifte: m('nei', 'Har ikke stoffskifte.'),
      vekst: m('delvis', 'Vokser i en mettet løsning ved at flere like ioner fester seg på overflaten.'),
      formering: m('delvis', 'En bit som brekker av, kan bli starten på en ny krystall.'),
      reagerer: m('nei', 'Reagerer ikke på omgivelsene.'),
      homeostase: m('nei', 'Har ikke noe indre miljø.'),
      arv: m('nei', 'Har ikke arvestoff.'),
    },
    consensus: 'En krystall er ikke levende. Den kan vokse, men bare ved at like byggesteiner legger seg på utsiden.',
  },
];

export function candidate(id: CandidateId): Candidate {
  const c = CANDIDATES.find((x) => x.id === id);
  if (!c) throw new Error(`Ukjent kandidat: ${id}`);
  return c;
}

export type Verdict = 'levende' | 'grense' | 'ikke' | 'ingen';

export const VERDICT_NAMES: Record<Verdict, string> = {
  levende: 'Levende',
  grense: 'Grensetilfelle',
  ikke: 'Ikke levende',
  ingen: 'Ingen krav',
};

/**
 * Dom etter en definisjon (kjennetegnene som kreves): `ikke` når ett krav ikke er oppfylt, `levende` når alle er helt
 * oppfylt, ellers `grense` (noen krav bare delvis eller ikke nå). `ingen` når ingen kjennetegn er valgt.
 */
export function verdict(c: Candidate, required: readonly CriterionId[]): Verdict {
  if (required.length === 0) return 'ingen';
  const marks = required.map((r) => c.marks[r].mark);
  if (marks.includes('nei')) return 'ikke';
  if (marks.every((x) => x === 'ja')) return 'levende';
  return 'grense';
}

/** Kjennetegnene i definisjonen som kandidaten ikke oppfyller helt (i figurrekkefølge). */
export function failing(c: Candidate, required: readonly CriterionId[], kind: Mark): CriterionId[] {
  return ALL_CRITERIA.filter((r) => required.includes(r) && c.marks[r].mark === kind);
}

/** Hvor mange av alle sju kjennetegnene kandidaten oppfyller helt. */
export const fullCount = (c: Candidate): number => ALL_CRITERIA.filter((r) => c.marks[r].mark === 'ja').length;

/** Definisjoner å prøve. */
export const DEFINITIONS: readonly { id: string; label: string; detail: string; criteria: readonly CriterionId[] }[] = [
  { id: 'alle', label: 'Alle sju', detail: 'lærebokas liste', criteria: ALL_CRITERIA },
  { id: 'nasa', label: 'Stoffskifte og evolusjon', detail: 'som NASA', criteria: ['stoffskifte', 'arv'] },
  { id: 'formering', label: 'Formering og arv', detail: 'uten celler', criteria: ['formering', 'arv'] },
  { id: 'vekst', label: 'Vekst og formering', detail: 'ytre kjennetegn', criteria: ['vekst', 'formering'] },
];

/** Den forhåndsdefinerte definisjonen som har akkurat disse kjennetegnene, eller null. */
export function matchingDefinition(required: readonly CriterionId[]): string | null {
  const set = new Set(required);
  const d = DEFINITIONS.find((x) => x.criteria.length === set.size && x.criteria.every((c) => set.has(c)));
  return d?.id ?? null;
}

/* ---------- Tekst i figurer ---------- */

/** Teksten uten stjernene som markerer kursiv (til skjermlesere og nedtrekkslister). */
export const plain = (text: string): string => text.replace(/\*/g, '');

/**
 * Deler tekst med kursiv markert som *…* i biter: «*E. coli* i tarmen» → [{ text: 'E. coli', italic: true },
 * { text: ' i tarmen', italic: false }]. `startItalic` brukes når en kursiv del fortsetter fra forrige linje.
 */
export function italicSegments(text: string, startItalic = false): { segments: { text: string; italic: boolean }[]; endItalic: boolean } {
  const segments: { text: string; italic: boolean }[] = [];
  let italic = startItalic;
  for (const [i, part] of text.split('*').entries()) {
    if (i > 0) italic = !italic;
    if (part) segments.push({ text: part, italic });
  }
  return { segments, endItalic: italic };
}

/**
 * Deler en tekst i linjer på høyst `maxChars` tegn (ord brytes ikke). Ord som er lengre enn linja, står alene.
 */
export function wrapText(text: string, maxChars: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = '';
  for (const w of words) {
    if (!line) line = w;
    else if (line.length + 1 + w.length <= maxChars) line += ` ${w}`;
    else {
      lines.push(line);
      line = w;
    }
  }
  if (line) lines.push(line);
  return lines;
}
