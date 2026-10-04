/** Ren fysikk for kapittel 9 Astrofysikk (ingen React), så den kan testes for seg. */

/* ---------- Konstanter (verdiene i ERGO Fysikk 1) ---------- */

/** Lysfarten (m/s). */
export const C_LIGHT = 3.0e8;
/** Én astronomisk enhet, middelavstanden jorda–sola (m). */
export const AU = 1.496e11;
/** Ett lysår: strekningen lyset går på ett år (m). */
export const LIGHT_YEAR = 9.46e15;
/** Én parsec (m), 3,26 lysår. */
export const PARSEC = 3.086e16;
/** Ett år i sekunder (365,25 døgn). */
export const YEAR = 3.156e7;
/** Stefan–Boltzmann-konstanten (W/(m²·K⁴)). */
export const SIGMA = 5.67e-8;
/** Konstanten i Wiens forskyvningslov (m·K). */
export const WIEN_B = 2.9e-3;
/** Sola: luminositet (W), radius (m) og overflatetemperatur (K). */
export const SUN_L = 3.85e26;
export const SUN_R = 6.96e8;
export const SUN_T = 5778;
/** Universets alder (år). */
export const UNIVERSE_AGE = 1.38e10;

/* ---------- 9A Avstander i verdensrommet ---------- */

export interface SpaceObject {
  id: string;
  /** Navnet i figuren (kort). */
  label: string;
  /** Avstand fra oss (m). */
  d: number;
  /** Hvor lenge lyset har vært underveis (år) når det ikke er d/c (fordi universet utvider seg). */
  lookbackYears?: number;
  /** Én setning til forklaringen. */
  fact: string;
}

/** Objekter fra nærmest til fjernest. Planetene, Voyager 1 og Oorts sky: middelavstand fra sola (på denne skalaen nesten det samme som fra jorda). */
export const SPACE_OBJECTS: SpaceObject[] = [
  {
    id: 'iss',
    label: 'ISS',
    d: 4.0e5,
    fact: 'Romstasjonen ISS går i bane ca. 400 km over bakken. Det er omtrent like langt som fra Oslo til Trondheim.',
  },
  {
    id: 'manen',
    label: 'Månen',
    d: 3.844e8,
    fact: 'Månen er ca. 384 400 km unna. Det er den lengste reisen mennesker har gjort.',
  },
  {
    id: 'sola',
    label: 'Sola',
    d: AU,
    fact: 'Middelavstanden mellom jorda og sola er definert som 1 astronomisk enhet (AE), enheten vi bruker for avstander i solsystemet.',
  },
  {
    id: 'jupiter',
    label: 'Jupiter',
    d: 5.2 * AU,
    fact: 'Jupiter, den største planeten, går i bane 5,2 AE fra sola. Fra jorda er den mellom ca. 4,2 og 6,2 AE unna, alt etter hvor planetene står i banene sine.',
  },
  {
    id: 'neptun',
    label: 'Neptun',
    d: 30 * AU,
    fact: 'Neptun er den ytterste planeten, ca. 30 AE fra sola. Radiosignaler til en sonde der bruker over fire timer hver vei.',
  },
  {
    id: 'voyager',
    label: 'Voyager 1',
    d: 170 * AU,
    fact: 'Romsonden Voyager 1 ble skutt opp i 1977 og er det fjerneste menneskelagde objektet, nesten ett lysdøgn unna.',
  },
  {
    id: 'oort',
    label: 'Oorts sky',
    d: 5.0e4 * AU,
    fact: 'Oorts sky er et skall av iskalde kometkjerner langt utenfor planetene, og regnes som yttergrensen av solsystemet.',
  },
  {
    id: 'proxima',
    label: 'Proxima Centauri',
    d: 4.24 * LIGHT_YEAR,
    fact: 'Proxima Centauri er den nærmeste stjernen etter sola. Selv med farten til Voyager 1 ville reisen tatt over 70 000 år.',
  },
  {
    id: 'sirius',
    label: 'Sirius',
    d: 8.6 * LIGHT_YEAR,
    fact: 'Sirius er den klareste stjernen på nattehimmelen, 8,6 lysår unna.',
  },
  {
    id: 'orion',
    label: 'Orion-tåken',
    d: 1340 * LIGHT_YEAR,
    fact: 'Orion-tåken er en gass- og støvsky der nye stjerner blir til akkurat nå. Du kan se den i stjernebildet Orion.',
  },
  {
    id: 'sentrum',
    label: 'Melkeveiens sentrum',
    d: 2.6e4 * LIGHT_YEAR,
    fact: 'Melkeveien er ca. 100 000 lysår i diameter, og vi ligger ca. 26 000 lysår fra sentrum, der det er et supermassivt svart hull.',
  },
  {
    id: 'magellan',
    label: 'Store magellanske sky',
    d: 1.6e5 * LIGHT_YEAR,
    fact: 'Den store magellanske skyen er en liten nabogalakse som går i bane rundt Melkeveien.',
  },
  {
    id: 'andromeda',
    label: 'Andromeda',
    d: 2.5e6 * LIGHT_YEAR,
    fact: 'Andromedagalaksen er et av de fjerneste objektene du kan se med bare øyet. Lyset som treffer øyet ditt i natt, ble sendt ut lenge før det fantes moderne mennesker.',
  },
  {
    id: 'virgo',
    label: 'Virgohopen',
    d: 5.4e7 * LIGHT_YEAR,
    fact: 'Virgohopen er en galaksehop med over tusen galakser. Den lokale gruppen vår er en del av en enda større superhop rundt den.',
  },
  {
    id: 'univers',
    label: 'Observerbart univers',
    d: 4.65e10 * LIGHT_YEAR,
    lookbackYears: UNIVERSE_AGE,
    fact: 'Lenger kan vi ikke se. Den kosmiske bakgrunnsstrålingen har vært underveis i 13,8 milliarder år, men universet har utvidet seg mens lyset var på vei, så stedet den kom fra, er nå ca. 46 milliarder lysår unna.',
  },
];

export const toKm = (d: number): number => d / 1000;
export const toAU = (d: number): number => d / AU;
export const toLightYears = (d: number): number => d / LIGHT_YEAR;
export const toParsec = (d: number): number => d / PARSEC;

/** Tiden lyset bruker på strekningen d (s): t = d/c. */
export const lightTime = (d: number): number => d / C_LIGHT;

export type TimeUnit = 'ms' | 's' | 'min' | 'timer' | 'døgn' | 'år';

/**
 * Hvor lenge lyset er underveis, i en enhet som passer. Over ett år brukes lysår-definisjonen direkte
 * (d i lysår = tid i år), så «4,24 lysår» alltid blir «4,24 år».
 */
export function lightTravel(d: number): { value: number; unit: TimeUnit } {
  const t = lightTime(d);
  if (t < 1) return { value: t * 1000, unit: 'ms' };
  if (t < 60) return { value: t, unit: 's' };
  if (t < 3600) return { value: t / 60, unit: 'min' };
  if (t < 2 * 86400) return { value: t / 3600, unit: 'timer' };
  if (d < LIGHT_YEAR) return { value: t / 86400, unit: 'døgn' };
  return { value: d / LIGHT_YEAR, unit: 'år' };
}

/** Objektet som ligger nærmest avstanden 10^logD på en logaritmisk skala, og hvor mange tierpotenser unna det er. */
export function nearestObject(logD: number, objects: SpaceObject[] = SPACE_OBJECTS): { obj: SpaceObject; decades: number } {
  let best = objects[0]!;
  let bestDist = Infinity;
  for (const o of objects) {
    const dist = Math.abs(Math.log10(o.d) - logD);
    if (dist < bestDist) {
      best = o;
      bestDist = dist;
    }
  }
  return { obj: best, decades: bestDist };
}

/** Skalamodell: avstanden d når jorda–sola krympes til `ref` meter. */
export const scaleModel = (d: number, ref = 0.01): number => (d / AU) * ref;

/* ---------- 9B/9C Stjerner og HR-diagrammet ---------- */

export type StarClass = 'hovedserie' | 'kjempe' | 'superkjempe' | 'hvit-dverg';

export interface Star {
  id: string;
  name: string;
  /** Overflatetemperatur (K). */
  T: number;
  /** Luminositet i solluminositeter L☉. */
  L: number;
  cls: StarClass;
  fact: string;
  /** Vis navnet i figuren også når stjernen ikke er valgt (på PC). */
  tag?: 'left' | 'right' | 'above' | 'below';
}

/** Kjente stjerner (omtrentlige verdier fra stjernekataloger; flere av dem er usikre med 10–30 %). */
export const STARS: Star[] = [
  { id: 'sola', name: 'Sola', T: 5778, L: 1, cls: 'hovedserie', tag: 'right', fact: 'Sola har fusjonert hydrogen til helium i ca. 4,6 milliarder år og er omtrent halvveis i livet på hovedserien.' },
  { id: 'proxima', name: 'Proxima Centauri', T: 3040, L: 0.0017, cls: 'hovedserie', tag: 'left', fact: 'Proxima Centauri er den nærmeste stjernen etter sola, men så lyssvak at du ikke ser den uten teleskop.' },
  { id: 'barnard', name: 'Barnards stjerne', T: 3130, L: 0.0035, cls: 'hovedserie', fact: 'Barnards stjerne er en rød dverg bare 6 lysår unna.' },
  { id: 'cyg61a', name: '61 Cygni A', T: 4530, L: 0.15, cls: 'hovedserie', fact: '61 Cygni A var en av de første stjernene som fikk avstanden målt med parallakse (1838).' },
  { id: 'acenb', name: 'Alfa Centauri B', T: 5260, L: 0.5, cls: 'hovedserie', fact: 'Alfa Centauri A og B er en dobbeltstjerne 4,4 lysår unna, i samme system som Proxima Centauri.' },
  { id: 'acena', name: 'Alfa Centauri A', T: 5790, L: 1.52, cls: 'hovedserie', fact: 'Alfa Centauri A ligner sola, men er litt tyngre og derfor litt varmere og lyssterkere.' },
  { id: 'procyona', name: 'Procyon A', T: 6530, L: 6.9, cls: 'hovedserie', fact: 'Procyon A er i ferd med å bruke opp hydrogenet i kjernen og begynner å forlate hovedserien.' },
  { id: 'altair', name: 'Altair', T: 7700, L: 10.6, cls: 'hovedserie', fact: 'Altair roterer så raskt at den er flattrykt ved polene.' },
  { id: 'siriusa', name: 'Sirius A', T: 9940, L: 25.4, cls: 'hovedserie', tag: 'right', fact: 'Sirius A er den klareste stjernen på nattehimmelen, 8,6 lysår unna.' },
  { id: 'vega', name: 'Vega', T: 9600, L: 40, cls: 'hovedserie', fact: 'Vega er en av de klareste stjernene på nordhimmelen og ble lenge brukt som nullpunkt for lysstyrke.' },
  { id: 'regulus', name: 'Regulus', T: 12460, L: 290, cls: 'hovedserie', fact: 'Regulus er den klareste stjernen i stjernebildet Løven.' },
  { id: 'achernar', name: 'Achernar', T: 15000, L: 3150, cls: 'hovedserie', fact: 'Achernar er en blå stjerne på sørhimmelen som roterer nesten så raskt at den rives i stykker.' },
  { id: 'spica', name: 'Spica', T: 22400, L: 20500, cls: 'hovedserie', tag: 'right', fact: 'Spica er en varm, blå stjerne med ca. 11 solmasser. Den vil ende som supernova.' },
  { id: 'siriusb', name: 'Sirius B', T: 25000, L: 0.026, cls: 'hvit-dverg', tag: 'right', fact: 'Sirius B går i bane rundt Sirius A. Den er varmere enn Sirius A, men lyser nesten tusen ganger svakere.' },
  { id: 'eri40b', name: '40 Eridani B', T: 16500, L: 0.013, cls: 'hvit-dverg', fact: '40 Eridani B var en av de første hvite dvergene som ble oppdaget.' },
  { id: 'procyonb', name: 'Procyon B', T: 7740, L: 0.00049, cls: 'hvit-dverg', fact: 'Procyon B er en hvit dverg som går i bane rundt Procyon A.' },
  { id: 'vanmaanen', name: 'Van Maanens stjerne', T: 6220, L: 0.00017, cls: 'hvit-dverg', fact: 'Van Maanens stjerne er en gammel hvit dverg som har kjølt seg ned i flere milliarder år.' },
  { id: 'pollux', name: 'Pollux', T: 4590, L: 43, cls: 'kjempe', fact: 'Pollux er en oransje kjempe i Tvillingene, og den nærmeste kjempestjernen til sola.' },
  { id: 'capella', name: 'Capella', T: 4970, L: 79, cls: 'kjempe', fact: 'Capella er egentlig to gule kjemper som går i bane rundt hverandre.' },
  { id: 'arcturus', name: 'Arcturus', T: 4290, L: 170, cls: 'kjempe', fact: 'Arcturus er en rød kjempe med omtrent samme masse som sola. Slik vil sola se ut om ca. 5 milliarder år.' },
  { id: 'aldebaran', name: 'Aldebaran', T: 3900, L: 440, cls: 'kjempe', fact: 'Aldebaran er det røde «øyet» i stjernebildet Tyren.' },
  { id: 'polaris', name: 'Polaris', T: 6000, L: 1260, cls: 'superkjempe', fact: 'Polaris (Nordstjerna) står nesten rett over nordpolen, så den ser ut til å stå i ro mens himmelen dreier.' },
  { id: 'canopus', name: 'Canopus', T: 7350, L: 10700, cls: 'superkjempe', fact: 'Canopus er den nest klareste stjernen på himmelen, men kan ikke ses fra Norge.' },
  { id: 'rigel', name: 'Rigel', T: 12100, L: 120000, cls: 'superkjempe', tag: 'right', fact: 'Rigel er den blå superkjempen i foten til Orion.' },
  { id: 'deneb', name: 'Deneb', T: 8500, L: 196000, cls: 'superkjempe', fact: 'Deneb er så lyssterk at vi ser den tydelig selv om den er over 2 000 lysår unna.' },
  { id: 'betelgeuse', name: 'Betelgeuse', T: 3600, L: 126000, cls: 'superkjempe', tag: 'left', fact: 'Betelgeuse er den røde superkjempen i skulderen til Orion. Den vil eksplodere som supernova, kanskje i løpet av de neste 100 000 årene.' },
  { id: 'antares', name: 'Antares', T: 3570, L: 76000, cls: 'superkjempe', fact: 'Antares betyr «rival til Mars» fordi den er like rød som planeten.' },
];

/** Radius i solradier fra L = 4πR²σT⁴ (relativt til sola): R/R☉ = √(L/L☉)·(T☉/T)². */
export function radiusFromLT(L: number, T: number): number {
  return Math.sqrt(L) * (SUN_T / T) ** 2;
}

/** Luminositet i L☉ for en stjerne med radius R (R☉) og temperatur T. */
export function luminosityFromRT(R: number, T: number): number {
  return R * R * (T / SUN_T) ** 4;
}

/** Stefan–Boltzmanns lov for hele stjernen: L = 4πR²σT⁴ (W), R i meter. */
export function luminosityWatts(R: number, T: number): number {
  return 4 * Math.PI * R * R * SIGMA * T ** 4;
}

/** Wiens forskyvningslov: bølgelengden med mest stråling (m). */
export const wienPeak = (T: number): number => WIEN_B / T;

/**
 * Hovedserien i HR-diagrammet: [T (K), log L/L☉] for vanlige hovedseriestjerner fra varme O-stjerner til
 * kalde røde dverger (middelverdier for spektralklassene O3 V–M8 V).
 */
export const MAIN_SEQUENCE: [number, number][] = [
  [45000, 5.8],
  [41000, 5.45],
  [36000, 5.0],
  [32000, 4.6],
  [26000, 3.9],
  [20600, 3.4],
  [17000, 2.9],
  [15500, 2.65],
  [12500, 2.1],
  [9700, 1.5],
  [8100, 1.1],
  [7200, 0.7],
  [6500, 0.45],
  [5900, 0.12],
  [SUN_T, 0],
  [5280, -0.35],
  [4440, -0.8],
  [3850, -1.15],
  [3560, -1.6],
  [3210, -2.2],
  [3060, -2.6],
  [2810, -3.0],
  [2570, -3.4],
  [2400, -3.7],
];

/** Temperaturen til en hovedseriestjerne med luminositet L (L☉), interpolert i tabellen (log–log). */
export function msTemperatureForL(L: number): number {
  const y = Math.log10(L);
  const first = MAIN_SEQUENCE[0]!;
  const last = MAIN_SEQUENCE[MAIN_SEQUENCE.length - 1]!;
  if (y >= first[1]) return first[0];
  if (y <= last[1]) return last[0];
  for (let i = 1; i < MAIN_SEQUENCE.length; i++) {
    const [Ta, La] = MAIN_SEQUENCE[i - 1]!;
    const [Tb, Lb] = MAIN_SEQUENCE[i]!;
    if (y <= La && y >= Lb) {
      const u = (y - La) / (Lb - La);
      return 10 ** (Math.log10(Ta) + u * (Math.log10(Tb) - Math.log10(Ta)));
    }
  }
  return last[0];
}

/** Hovedserien: L/L☉ = (M/M☉)^3,5. */
export const msLuminosity = (M: number): number => M ** 3.5;

/** Overflatetemperaturen til en hovedseriestjerne med masse M: den ligger på hovedserien med L = M^3,5. */
export const msTemperature = (M: number): number => msTemperatureForL(msLuminosity(M));

/** Radius (R☉) på hovedserien, fra L og T med Stefan–Boltzmanns lov. */
export const msRadius = (M: number): number => radiusFromLT(msLuminosity(M), msTemperature(M));

/** Levetid på hovedserien (år): drivstoff ∝ M, forbruk ∝ L ∝ M^3,5, så t ≈ 10¹⁰ år·(M/M☉)^−2,5. */
export const msLifetime = (M: number): number => 1e10 * M ** -2.5;

/* ---------- 9B/9C Livsløpet til en stjerne ---------- */

/** Over ca. 8 M☉ ender stjernen som supernova. */
export const M_SUPERNOVA = 8;
/** Over ca. 20–25 M☉ blir restkjernen et svart hull (vi bruker 20). */
export const M_BLACK_HOLE = 20;
/** Under ca. 0,5 M☉ blir stjernen aldri en rød kjempe (rød dverg). */
export const M_RED_DWARF = 0.5;
/** Chandrasekhar-grensen: en hvit dverg kan ikke ha større masse enn ca. 1,4 M☉. */
export const CHANDRASEKHAR = 1.4;

export type Fate = 'hvit-dverg-helium' | 'hvit-dverg' | 'noytronstjerne' | 'svart-hull';

export function fate(M: number): Fate {
  if (M < M_RED_DWARF) return 'hvit-dverg-helium';
  if (M < M_SUPERNOVA) return 'hvit-dverg';
  if (M < M_BLACK_HOLE) return 'noytronstjerne';
  return 'svart-hull';
}

export type StageId =
  | 'protostjerne'
  | 'hovedserie'
  | 'rod-kjempe'
  | 'planetarisk-take'
  | 'hvit-dverg'
  | 'rod-superkjempe'
  | 'supernova'
  | 'noytronstjerne'
  | 'svart-hull';

/** Grunnstoff i et lag inne i stjerna (fra ytterst til innerst). «CO» er karbon og oksygen, «n» er nøytroner. */
export type Element = 'H' | 'He' | 'CO' | 'C' | 'O' | 'Si' | 'Fe' | 'n';

export interface Stage {
  id: StageId;
  /** Varighet (år). Infinity betyr at stadiet varer «for alltid». */
  years: number;
  /** Veien i HR-diagrammet: punkter [log T, log L]. Tom når stjernen ikke er i diagrammet. */
  track: [number, number][];
  /** Lagene inne i stjerna, fra ytterst til innerst. */
  layers: Element[];
  /** Fusjonsreaksjonene som går (tom liste = ingen fusjon). */
  fusion: string[];
  /** Stadiet ligger i framtiden for alle stjerner (universet er for ungt). */
  future?: boolean;
}

const lg = Math.log10;
const pt = (T: number, L: number): [number, number] => [lg(T), lg(L)];

/** Hvite dverger har omtrent jordas størrelse: R ≈ 0,012 R☉. Kurven en hvit dverg følger når den avkjøles. */
export const WD_RADIUS = 0.012;

/**
 * Stadiene i livet til en stjerne med masse M (i solmasser), med en forenklet vei i HR-diagrammet.
 * Varighetene er grove anslag: kjempefasen varer ca. 10 % av tiden på hovedserien.
 */
export function lifeStages(M: number): Stage[] {
  const tMS = msLifetime(M);
  const Tms = msTemperature(M);
  const Lms = msLuminosity(M);
  const zams = pt(Tms * 1.03, Lms * 0.75);
  const tams = pt(Tms * 0.97, Lms * 1.3);
  // Lette protostjerner kommer ovenfra (de er store og lyssterke før de krymper), tunge kommer nedenfra og
  // blir lyssterkere på vei mot hovedserien. Da ligger ikke veien oppå den røde superkjempens vei senere.
  const protoStart = pt(Math.min(3500, Tms * 0.95), Lms * (10 / M ** 1.5));
  const knee = pt(Math.min(4025, Tms * 0.97), Lms * (M < 2 ? 0.8 : Math.min(0.8, Math.max(0.3, 0.8 - 0.5 * Math.log10(M / 2)))));
  // Sammentrekningen tar ca. 50 millioner år for sola, kortere for tunge og lengre for lette stjerner.
  const tProto = 5e7 * M ** (M < 1 ? -1.3 : -2.5);
  const proto: Stage = { id: 'protostjerne', years: tProto, track: [protoStart, knee, zams], layers: ['H'], fusion: [] };
  const ms: Stage = { id: 'hovedserie', years: tMS, track: [zams, tams], layers: ['H', 'He'], fusion: ['H → He i kjernen'] };
  const f = fate(M);

  if (f === 'hvit-dverg-helium') {
    // Rød dverg: blander hele stjerna, blir aldri kjempe og ender (i framtiden) som hvit dverg av helium.
    const wdHot = pt(9000, luminosityFromRT(0.02, 9000));
    const wdCold = pt(4500, luminosityFromRT(0.02, 4500));
    return [
      proto,
      ms,
      { id: 'hvit-dverg', years: Infinity, track: [tams, pt(7000, Lms * 3), wdHot, wdCold], layers: ['He'], fusion: [], future: true },
    ];
  }

  if (f === 'hvit-dverg') {
    const Lrg = 2000 * M ** 0.6;
    const rgTip = pt(3600, Lrg);
    const wdHot = pt(30000, luminosityFromRT(WD_RADIUS, 30000));
    const wdCold = pt(6000, luminosityFromRT(WD_RADIUS, 6000));
    return [
      proto,
      ms,
      {
        id: 'rod-kjempe',
        years: 0.1 * tMS,
        track: [tams, pt(4800, Lms * 1.6), pt(4300, Math.max(Lms * 3, 30)), rgTip],
        layers: ['H', 'He', 'CO'],
        fusion: ['H → He i et skall', 'He → C og O i kjernen'],
      },
      {
        id: 'planetarisk-take',
        years: 1e4,
        track: [rgTip, pt(50000, Lrg * 0.7), pt(45000, Lrg * 0.05), wdHot],
        layers: ['CO'],
        fusion: [],
      },
      { id: 'hvit-dverg', years: Infinity, track: [wdHot, wdCold], layers: ['CO'], fusion: [] },
    ];
  }

  const Lrsg = Math.max(1.5 * Lms * 1.3, 2e4);
  const rsg = pt(3600, Lrsg);
  return [
    proto,
    ms,
    {
      id: 'rod-superkjempe',
      years: 0.1 * tMS,
      track: [tams, pt(Tms * 0.5, Lrsg * 0.8), pt(6000, Lrsg * 0.9), rsg],
      layers: ['H', 'He', 'C', 'O', 'Si', 'Fe'],
      fusion: ['H → He', 'He → C og O', 'C → Ne og Mg', 'O → Si', 'Si → Fe'],
    },
    { id: 'supernova', years: 0.3, track: [rsg], layers: ['Fe'], fusion: [] },
    f === 'noytronstjerne'
      ? { id: 'noytronstjerne', years: Infinity, track: [], layers: ['n'], fusion: [] }
      : { id: 'svart-hull', years: Infinity, track: [], layers: [], fusion: [] },
  ];
}

/** Total levetid som stjerne (fram til restkjernen), i år. */
export function starLifetime(M: number): number {
  return lifeStages(M)
    .filter((s) => Number.isFinite(s.years))
    .reduce((sum, s) => sum + s.years, 0);
}

/** Punktet en andel `frac` (0–1) langs en vei av punkter, målt etter lengde. */
export function alongTrack(track: [number, number][], frac: number): [number, number] | null {
  const first = track[0];
  if (!first) return null;
  if (track.length === 1) return first;
  const seg: number[] = [];
  let total = 0;
  for (let i = 1; i < track.length; i++) {
    const a = track[i - 1]!;
    const b = track[i]!;
    const len = Math.hypot(b[0] - a[0], (b[1] - a[1]) / 4);
    seg.push(len);
    total += len;
  }
  let target = Math.min(1, Math.max(0, frac)) * total;
  for (let i = 1; i < track.length; i++) {
    const len = seg[i - 1]!;
    const a = track[i - 1]!;
    const b = track[i]!;
    if (target <= len || i === track.length - 1) {
      const u = len > 0 ? Math.min(1, target / len) : 1;
      return [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u];
    }
    target -= len;
  }
  return track[track.length - 1]!;
}

/**
 * Omtrentlig farge (sRGB 0–255) på et svart legeme med temperaturen T, slik øyet ser den.
 * Tilpasset kurve (Tanner Helland) som stemmer godt mellom 1000 K og 40 000 K.
 */
export function blackbodyRgb(T: number): [number, number, number] {
  const t = Math.min(40000, Math.max(1000, T)) / 100;
  const clamp = (v: number) => Math.round(Math.min(255, Math.max(0, v)));
  const r = t <= 66 ? 255 : 329.698727446 * (t - 60) ** -0.1332047592;
  const g = t <= 66 ? 99.4708025861 * Math.log(t) - 161.1195681661 : 288.1221695283 * (t - 60) ** -0.0755148492;
  const b = t >= 66 ? 255 : t <= 19 ? 0 : 138.5177312231 * Math.log(t - 10) - 305.0447927307;
  return [clamp(r), clamp(g), clamp(b)];
}

export const starColor = (T: number): string => {
  const [r, g, b] = blackbodyRgb(T);
  return `rgb(${r}, ${g}, ${b})`;
};
