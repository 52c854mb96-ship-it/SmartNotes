/**
 * Cellestrukturer og cellefunksjon (Bi 1 kapittel 5, KM3, KM5): ren modell uten React, testet i model.test.ts.
 *
 * 1. Cellen: struktur og funksjon for celledelene (lærebokformuleringer), hvilke deler som finnes i dyre-, plante- og
 *    bakterieceller, typiske størrelser, og plassering av etiketter uten overlapp.
 * 2. Overflate og volum: areal, volum og forholdet A/V for kube og kule, diffusjonstid t ≈ x²/(2D), oppdeling i
 *    mindre kuber og utposninger (tarmtotter, rothår).
 * 3. Fotosyntese og celleånding: fotosyntesehastighet som funksjon av lys, CO₂ og temperatur (begrensende faktorer
 *    og metning), celleånding og netto O₂-produksjon, kompensasjonspunktet.
 */
import { CELL_PARTS, type Celletype, type OrganelleId } from '../kit';

/* ====================================================================== */
/* 1. Cellen                                                                */
/* ====================================================================== */

export interface PartInfo {
  /** Hvordan delen er bygd. */
  struktur: string;
  /** Hva den gjør. */
  funksjon: string;
  /** Ekstra poeng eller vanlig misoppfatning. */
  merk?: string;
}

/** Struktur og funksjon for hver celledel, med begreper som i norske Biologi 1-bøker. */
export const DELER: Record<OrganelleId, PartInfo> = {
  cellemembran: {
    struktur: 'Et dobbelt lag av fosfolipider (lipiddobbeltlag) med proteiner i, bare 7–10 nm tykt.',
    funksjon:
      'Avgrenser cellen og bestemmer hva som slipper inn og ut (den er selektivt gjennomtrengelig). Reseptorer i membranen tar imot signaler fra andre celler.',
    merk: 'Alle celler har cellemembran, også planteceller og bakterier som i tillegg har cellevegg.',
  },
  cytoplasma: {
    struktur: 'Geléaktig væske (cytosol) med oppløste stoffer, organeller og et nett av proteintråder (cytoskjelett).',
    funksjon: 'Her skjer mange av cellens kjemiske reaksjoner, for eksempel første del av celleåndingen (glykolysen) og proteinsyntesen på frie ribosomer.',
  },
  cellekjerne: {
    struktur: 'Omgitt av en dobbel kjernemembran med kjerneporer. Inneholder DNA (kromatin) og kjernelegemet.',
    funksjon:
      'Lagrer arvestoffet og styrer cellen ved å bestemme hvilke gener som brukes. Oppskriften på proteiner går ut gjennom kjerneporene som mRNA.',
  },
  kjernelegeme: {
    struktur: 'Et tett område inne i kjernen, uten egen membran.',
    funksjon: 'Her lages ribosomene, som så sendes ut i cytoplasmaet gjennom kjerneporene.',
  },
  mitokondrie: {
    struktur: 'Dobbel membran der den indre er foldet i cristae, som gir stor overflate. Har eget DNA og egne ribosomer.',
    funksjon:
      'Celleånding: bryter ned glukose med oksygen til CO₂ og vann og lagrer energien i ATP. Celler som bruker mye energi, som muskelceller, har mange mitokondrier.',
    merk: 'Planteceller har også mitokondrier og driver celleånding hele døgnet, ikke bare om natta.',
  },
  kloroplast: {
    struktur: 'Dobbel membran rundt stroma, med stabler av tylakoider (grana) som inneholder klorofyll. Har eget DNA.',
    funksjon: 'Fotosyntese: bruker lysenergi til å lage glukose av CO₂ og vann. O₂ er et biprodukt.',
    merk: 'Mitokondrier og kloroplaster har eget DNA og egne ribosomer fordi de stammer fra bakterier som ble tatt opp i en annen celle (endosymbioseteorien).',
  },
  kornetER: {
    struktur: 'Et nettverk av flate membransekker som henger sammen med kjernemembranen, med ribosomer på utsiden.',
    funksjon:
      'Lager proteiner som skal ut av cellen (som hormoner og fordøyelsesenzymer) eller inn i membraner, og sender dem videre til golgiapparatet i vesikler.',
  },
  glattER: {
    struktur: 'Membranrør og -sekker uten ribosomer.',
    funksjon: 'Lager lipider (som fosfolipider og steroidhormoner) og bryter ned giftstoffer, særlig i leverceller.',
  },
  golgi: {
    struktur: 'En stabel flate, buede membransekker med vesikler som snøres av i kantene.',
    funksjon:
      'Tar imot proteiner fra kornet ER, bearbeider, sorterer og pakker dem i vesikler som sendes ut av cellen (eksocytose) eller til lysosomene.',
  },
  ribosomer: {
    struktur: 'Små korn av RNA og protein, uten membran. Frie i cytoplasma eller festet til kornet ER. Bakterier har mindre ribosomer.',
    funksjon: 'Lager proteiner ved å sette sammen aminosyrer i den rekkefølgen mRNA bestemmer (translasjon).',
    merk: 'Alle celler har ribosomer, også bakterier: uten dem kan ingen celle lage proteiner.',
  },
  lysosom: {
    struktur: 'Liten blære med membran, full av fordøyelsesenzymer i et surt miljø.',
    funksjon: 'Bryter ned utslitte celledeler, avfall og bakterier som cellen har tatt inn (fagocytose).',
  },
  vakuole: {
    struktur: 'Stor blære med cellesaft, omgitt av en egen membran. Kan fylle opptil 90 % av plantecellen.',
    funksjon:
      'Lagrer vann, ioner, sukker og fargestoffer. Når vakuolen er full av vann, presser den cellen mot celleveggen (turgor), så planten står oppreist.',
  },
  cellevegg: {
    struktur: 'Stivt lag utenpå cellemembranen: cellulose hos planter, peptidoglykan hos bakterier (og kitin hos sopp).',
    funksjon: 'Gir form og støtte, og hindrer at cellen sprekker når den tar opp vann. Slipper gjennom vann og oppløste stoffer.',
    merk: 'Celleveggen erstatter ikke cellemembranen: det er membranen som bestemmer hva som kommer inn i cellen.',
  },
  kapsel: {
    struktur: 'Slimlag av sukkerstoffer utenpå celleveggen hos mange bakterier.',
    funksjon: 'Beskytter mot uttørking og mot immunforsvaret, og hjelper bakterien å feste seg.',
  },
  flagell: {
    struktur: 'Lang, tynn tråd av protein som roterer som en propell.',
    funksjon: 'Bakterien svømmer med den. Sædceller har også flagell, men den er bygd annerledes og svinger i stedet for å rotere.',
  },
  nukleoid: {
    struktur: 'Ett stort, ringformet DNA-molekyl (kromosomet) som ligger fritt i cytoplasmaet, uten kjernemembran.',
    funksjon: 'Inneholder genene bakterien trenger for å leve og formere seg.',
    merk: 'Prokaryot betyr «før kjerne» (gresk pro = før, karyon = kjerne): bakterier har arvestoff, men ingen cellekjerne.',
  },
  plasmid: {
    struktur: 'Små ringer av DNA ved siden av kromosomet.',
    funksjon: 'Har ekstra gener, for eksempel for antibiotikaresistens, og kan overføres mellom bakterier.',
  },
};

export type Forekomst = 'ja' | 'nei' | 'noen';

export interface CompareRow {
  navn: string;
  dyr: Forekomst;
  plante: Forekomst;
  bakterie: Forekomst;
  /** Delen som fremheves i cellefiguren for hver celletype (når den finnes). */
  part: Partial<Record<Celletype, OrganelleId>>;
}

/** Sammenligning av dyrecelle, plantecelle og bakteriecelle (prokaryot og eukaryot, plante og dyr). */
export const SAMMENLIGNING: readonly CompareRow[] = [
  { navn: 'Cellemembran', dyr: 'ja', plante: 'ja', bakterie: 'ja', part: { dyr: 'cellemembran', plante: 'cellemembran', bakterie: 'cellemembran' } },
  { navn: 'Ribosomer', dyr: 'ja', plante: 'ja', bakterie: 'ja', part: { dyr: 'ribosomer', plante: 'ribosomer', bakterie: 'ribosomer' } },
  { navn: 'Arvestoff (DNA)', dyr: 'ja', plante: 'ja', bakterie: 'ja', part: { dyr: 'cellekjerne', plante: 'cellekjerne', bakterie: 'nukleoid' } },
  { navn: 'Cellekjerne', dyr: 'ja', plante: 'ja', bakterie: 'nei', part: { dyr: 'cellekjerne', plante: 'cellekjerne' } },
  { navn: 'Mitokondrier', dyr: 'ja', plante: 'ja', bakterie: 'nei', part: { dyr: 'mitokondrie', plante: 'mitokondrie' } },
  { navn: 'Kloroplaster', dyr: 'nei', plante: 'ja', bakterie: 'nei', part: { plante: 'kloroplast' } },
  { navn: 'ER og golgiapparat', dyr: 'ja', plante: 'ja', bakterie: 'nei', part: { dyr: 'kornetER', plante: 'kornetER' } },
  { navn: 'Lysosomer', dyr: 'ja', plante: 'nei', bakterie: 'nei', part: { dyr: 'lysosom' } },
  { navn: 'Stor vakuole', dyr: 'nei', plante: 'ja', bakterie: 'nei', part: { plante: 'vakuole' } },
  { navn: 'Cellevegg', dyr: 'nei', plante: 'ja', bakterie: 'ja', part: { plante: 'cellevegg', bakterie: 'cellevegg' } },
  { navn: 'Plasmider', dyr: 'nei', plante: 'nei', bakterie: 'ja', part: { bakterie: 'plasmid' } },
  { navn: 'Flagell', dyr: 'noen', plante: 'nei', bakterie: 'noen', part: { bakterie: 'flagell' } },
];

export interface CellTypeInfo {
  navn: string;
  gruppe: 'eukaryot' | 'prokaryot';
  /** Typisk størrelse (µm): område og verdien som brukes i figuren. */
  min: number;
  max: number;
  typisk: number;
  eksempel: string;
}

/** Typiske størrelser (lærebokverdier): dyreceller 10–30 µm, planteceller 10–100 µm, bakterier 1–5 µm (E. coli ca. 2 µm). */
export const CELLETYPER: Record<Celletype, CellTypeInfo> = {
  dyr: { navn: 'Dyrecelle', gruppe: 'eukaryot', min: 10, max: 30, typisk: 20, eksempel: 'en levercelle' },
  plante: { navn: 'Plantecelle', gruppe: 'eukaryot', min: 10, max: 100, typisk: 50, eksempel: 'en bladcelle' },
  bakterie: { navn: 'Bakteriecelle', gruppe: 'prokaryot', min: 1, max: 5, typisk: 2, eksempel: 'tarmbakterien Escherichia coli' },
};

/** Delen som er valgt når du bytter celletype: kjernen for eukaryoter, arvestoffet for bakterier. */
export function defaultPart(type: Celletype): OrganelleId {
  return type === 'bakterie' ? 'nukleoid' : 'cellekjerne';
}

/** Finnes delen i celletypen? */
export function hasPart(type: Celletype, id: OrganelleId): boolean {
  return CELL_PARTS[type].includes(id);
}

/**
 * Fordeler etiketter langs én akse så de har minst `gap` mellom seg og holder seg mellom `min` og `max`, så nær de
 * ønskede plassene som mulig (rekkefølgen beholdes). Gir plassene i samme rekkefølge som `wanted`.
 */
export function spreadLabels(wanted: readonly number[], gap: number, min: number, max: number): number[] {
  const order = wanted.map((v, i) => ({ v, i })).sort((a, b) => a.v - b.v);
  const pos = order.map((o) => o.v);
  for (let i = 0; i < pos.length; i++) pos[i] = Math.max(pos[i]!, i === 0 ? min : pos[i - 1]! + gap);
  for (let i = pos.length - 1; i >= 0; i--) pos[i] = Math.min(pos[i]!, i === pos.length - 1 ? max : pos[i + 1]! - gap);
  // Er det ikke plass til alle, starter vi øverst og godtar at de går litt utenfor
  if (pos.length && pos[0]! < min) for (let i = 0; i < pos.length; i++) pos[i] = min + i * gap;
  const out = new Array<number>(wanted.length);
  order.forEach((o, k) => (out[o.i] = pos[k]!));
  return out;
}

/* ====================================================================== */
/* 2. Overflate og volum                                                    */
/* ====================================================================== */

export type Shape = 'kube' | 'kule';

/** Overflate (µm²) for en kube med side d eller en kule med diameter d (µm). */
export function surfaceArea(shape: Shape, d: number): number {
  return shape === 'kube' ? 6 * d * d : Math.PI * d * d;
}

/** Volum (µm³) for en kube med side d eller en kule med diameter d. */
export function volume(shape: Shape, d: number): number {
  return shape === 'kube' ? d ** 3 : (Math.PI / 6) * d ** 3;
}

/** Forholdet overflate/volum (per µm). Lik 6/d for både kube (side d) og kule (diameter d). */
export function surfaceToVolume(shape: Shape, d: number): number {
  return surfaceArea(shape, d) / volume(shape, d);
}

/** Diffusjonskoeffisienten til O₂ i vann ved ca. 25 °C: 2,0 · 10⁻⁹ m²/s = 2000 µm²/s (i cytoplasma noe lavere). */
export const D_O2 = 2000;

/** Omtrentlig tid (s) for å diffundere avstanden x (µm): t ≈ x²/(2D). Dobbel avstand gir fire ganger så lang tid. */
export function diffusionTime(x: number, D = D_O2): number {
  return (x * x) / (2 * D);
}

/** Hvor langt (µm) molekylene typisk kommer på tida t (s): x ≈ √(2Dt). */
export function diffusionReach(t: number, D = D_O2): number {
  return Math.sqrt(2 * D * Math.max(0, t));
}

/** Avstanden fra overflaten til midten: halve siden eller radien. */
export function centreDistance(d: number): number {
  return d / 2;
}

/** Tid som tekst med passende enhet: 0,0062 → «6,3 ms», 95 → «1,6 min», 7200 → «2,0 timer». */
export function formatDuration(s: number): string {
  const f = (v: number) => (v >= 100 ? fmtNo(v, 0) : v >= 10 ? fmtNo(v, 0) : fmtNo(v, 1));
  if (!Number.isFinite(s)) return '–';
  if (s < 1e-3) return `${f(s * 1e6)} µs`;
  if (s < 1) return `${f(s * 1e3)} ms`;
  if (s < 60) return `${f(s)} s`;
  if (s < 3600) return `${f(s / 60)} min`;
  if (s < 86400 * 2) return `${f(s / 3600)} timer`;
  return `${f(s / 86400)} døgn`;
}

/** Lengde i µm som tekst: 2 → «2 µm», 1500 → «1,5 mm», 10000 → «1 cm». */
export function formatLength(um: number): string {
  if (!Number.isFinite(um)) return '–';
  if (um < 1000) return `${fmtNo(um, um < 10 ? 1 : 0).replace(/,0$/, '')} µm`;
  if (um < 10000) return `${fmtNo(um / 1000, 1).replace(/,0$/, '')} mm`;
  return `${fmtNo(um / 10000, 1).replace(/,0$/, '')} cm`;
}

function fmtNo(v: number, d: number): string {
  return new Intl.NumberFormat('nb-NO', { minimumFractionDigits: d, maximumFractionDigits: d }).format(v);
}

/** Store tall i µm² eller µm³ med passende enhet. */
export function formatArea(um2: number): string {
  if (um2 < 1e6) return `${fmtNo(um2, um2 < 10 ? 1 : 0)} µm²`;
  if (um2 < 1e8) return `${fmtNo(um2 / 1e6, 2)} mm²`;
  return `${fmtNo(um2 / 1e8, 2)} cm²`;
}

export function formatVolume(um3: number): string {
  if (um3 < 1e9) return `${fmtNo(um3, um3 < 10 ? 1 : 0)} µm³`;
  if (um3 < 1e12) return `${fmtNo(um3 / 1e9, 2)} mm³`;
  return `${fmtNo(um3 / 1e12, 2)} cm³`;
}

/** Kjente ting langs størrelsesskalaen (µm), lærebokverdier. */
export const SIZE_REFERENCES: readonly { navn: string; d: number }[] = [
  { navn: 'bakterie', d: 2 },
  { navn: 'rødt blodlegeme', d: 8 },
  { navn: 'dyrecelle', d: 20 },
  { navn: 'plantecelle', d: 50 },
  { navn: 'amøbe', d: 500 },
  { navn: 'froskeegg', d: 1500 },
];

/**
 * En kube med side a delt i n · n · n like kuber: volumet er det samme, men overflaten blir n ganger så stor
 * (hver liten kube har overflate 6(a/n)², og det er n³ av dem: 6a² · n).
 */
export function splitCube(a: number, n: number): { count: number; side: number; area: number; volume: number; ratio: number } {
  const k = Math.max(1, Math.round(n));
  const side = a / k;
  const area = k ** 3 * 6 * side * side;
  return { count: k ** 3, side, area, volume: a ** 3, ratio: area / a ** 3 };
}

export type OutgrowthId = 'tarmtotter' | 'rothar';

export interface Outgrowth {
  navn: string;
  /** Radius (mm) til hver utposning (sylinder). */
  radius: number;
  /** Lengde (mm): standard og største verdi på glidebryteren. */
  length: number;
  maxLength: number;
  /** Antall per mm² underlag: standard og største verdi. */
  density: number;
  maxDensity: number;
}

/**
 * Utposninger modellert som sylindre på et flatt underlag (kit-et regner bare sideflatene; toppen erstatter flaten
 * under). Omtrentlige verdier fra lærebøker:
 * - Tarmtotter: 0,5–1 mm lange og ca. 0,1 mm tykke, 20–40 per mm² → ca. 7–10 ganger så stor overflate. Mikrovilli på
 *   hver tarmcelle gir ca. 20 ganger til.
 * - Rothår: ca. 0,01 mm tykke og opptil 1–1,5 mm lange, svært tette. Hos en rugplante (Dittmer 1937) var rotsystemet
 *   uten rothår ca. 240 m² og rothårene ca. 400 m².
 */
export const OUTGROWTHS: Record<OutgrowthId, Outgrowth> = {
  tarmtotter: { navn: 'Tarmtotter', radius: 0.05, length: 0.75, maxLength: 1.5, density: 25, maxDensity: 40 },
  rothar: { navn: 'Rothår', radius: 0.006, length: 0.6, maxLength: 1.5, density: 100, maxDensity: 300 },
};

/** Hvor mange ganger større overflaten blir med n utposninger per mm² (radius r, lengde L i mm): 1 + n · 2πrL. */
export function outgrowthFactor(density: number, radius: number, length: number): number {
  return 1 + Math.max(0, density) * 2 * Math.PI * radius * Math.max(0, length);
}

/* ====================================================================== */
/* 3. Fotosyntese og celleånding                                            */
/* ====================================================================== */

/**
 * Forenklet modell i relative enheter (som tellinger av O₂-bobler fra vannpest i et forsøk):
 * - Lysbegrenset fart a = φ · I (lysreaksjonene; nesten uavhengig av temperaturen).
 * - Enzymbegrenset fart b = Pmax · f(T) · C/(C + K_C) (Calvin-syklusen: CO₂ bindes av enzymet rubisco).
 * - Fotosyntesen er den minste av dem, glattet (ikke-rektangulær hyperbel med krumning θ): ved lite lys er lyset den
 *   begrensende faktoren, ved mye lys flater kurven ut (lysmetning), og da begrenser CO₂ eller temperaturen.
 * - f(T) er en enzymkurve (Yan og Hunt 1999) med optimum ved 27 °C og null ved 45 °C (enzymene denatureres).
 * - Celleånding R(T) = R₂₅ · Q₁₀^((T − 25)/10) med Q₁₀ = 2, uavhengig av lys.
 * Lys er i prosent av fullt sollys (ca. 2000 µmol fotoner per m² per s), CO₂ i ppm (luft i dag ca. 420 ppm).
 */
export const PS = {
  /** Brutto fotosyntese ved lysmetning, CO₂-metning og optimal temperatur. */
  Pmax: 100,
  /** Økning per prosent lys ved lite lys. */
  phi: 1.6,
  /** Krumning i overgangen fra lysbegrenset til metning (0–1). */
  theta: 0.95,
  /** CO₂-konsentrasjonen (ppm) som gir halv fart. */
  Kc: 300,
  Tmin: -5,
  Topt: 27,
  Tmax: 45,
  /** Celleånding ved 25 °C (samme relative enhet). */
  R25: 10,
  Q10: 2,
} as const;

/** CO₂ i lufta i dag (ppm). */
export const CO2_AIR = 420;

/** Enzymaktiviteten (0–1) ved temperaturen T: 0 ved Tmin og Tmax, 1 ved optimum. */
export function tempFactor(T: number): number {
  const { Tmin, Topt, Tmax } = PS;
  if (!(T > Tmin && T < Tmax)) return 0;
  const e = (Topt - Tmin) / (Tmax - Topt);
  return ((Tmax - T) / (Tmax - Topt)) * ((T - Tmin) / (Topt - Tmin)) ** e;
}

/** Lysbegrenset fart (lysreaksjonene). */
export function lightLimited(I: number): number {
  return PS.phi * Math.max(0, I);
}

/** Enzymbegrenset fart (CO₂ og temperatur). */
export function enzymeLimited(C: number, T: number): number {
  const c = Math.max(0, C);
  return PS.Pmax * tempFactor(T) * (c / (c + PS.Kc));
}

/** Glattet minimum av a og b (ikke-rektangulær hyperbel). */
export function smoothMin(a: number, b: number, theta: number = PS.theta): number {
  const s = a + b;
  const disc = s * s - 4 * theta * a * b;
  return (s - Math.sqrt(Math.max(0, disc))) / (2 * theta);
}

/** Brutto fotosyntese: O₂ som lages i kloroplastene (relative enheter). */
export function grossPhotosynthesis(I: number, C: number, T: number): number {
  return smoothMin(lightLimited(I), enzymeLimited(C, T));
}

/** Celleånding: O₂ som brukes i mitokondriene (hele døgnet, også i lyset). */
export function respiration(T: number): number {
  return PS.R25 * PS.Q10 ** ((T - 25) / 10);
}

/** Netto O₂-produksjon: det planten gir fra seg (negativ: den tar opp O₂). */
export function netO2(I: number, C: number, T: number): number {
  return grossPhotosynthesis(I, C, T) - respiration(T);
}

/**
 * Lyskompensasjonspunktet: lyset (%) der fotosyntesen lager like mye O₂ som celleåndingen bruker. Løst analytisk fra
 * θP² − (a + b)P + ab = 0 med P = R: I = R(b − θR) / (φ(b − R)). null når fotosyntesen aldri tar igjen celleåndingen.
 */
export function compensationLight(C: number, T: number): number | null {
  const b = enzymeLimited(C, T);
  const R = respiration(T);
  if (!(b > R)) return null;
  return (R * (b - PS.theta * R)) / (PS.phi * (b - R));
}

/** Lyset (%) der fotosyntesen er nær metning: der lysbegrenset og enzymbegrenset fart er like store. */
export function saturationLight(C: number, T: number): number {
  return enzymeLimited(C, T) / PS.phi;
}

export type Limiting = 'lys' | 'co2' | 'temperatur';

/**
 * Den begrensende faktoren (Blackman): den som gir størst økning i fotosyntesen hvis den økes litt (lys + 25 %,
 * CO₂ + 25 %, temperatur 3 °C nærmere optimum).
 */
export function limitingFactor(I: number, C: number, T: number): Limiting {
  const P = grossPhotosynthesis(I, C, T);
  const gainI = grossPhotosynthesis(Math.max(I * 1.25, I + 2), C, T) - P;
  const gainC = grossPhotosynthesis(I, Math.max(C * 1.25, C + 20), T) - P;
  const towards = T < PS.Topt ? Math.min(PS.Topt, T + 3) : Math.max(PS.Topt, T - 3);
  const gainT = grossPhotosynthesis(I, C, towards) - P;
  if (gainI >= gainC && gainI >= gainT) return 'lys';
  return gainT > gainC ? 'temperatur' : 'co2';
}
