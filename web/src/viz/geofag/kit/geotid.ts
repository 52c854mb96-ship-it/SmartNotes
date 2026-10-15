/**
 * Geologisk tid: tidsskalaen etter ICS-kartet, oppslag (`periodeVed`), jordas historie som ett døgn (`tilDognet`)
 * og aldre skrevet på norsk (`fmtAlder`). Ren logikk uten React.
 *
 * Alle aldre er i **millioner år før nåtid** (positive tall, 0 = i dag). I løpende tekst skrives alltid
 * «millioner år» eller «milliarder år» (`fmtAlder`), aldri forkortelsen fra fagartiklene.
 *
 *   periodeVed(150)?.navn          // 'jura'
 *   fmtAlder(66, { siden: true })  // '66 millioner år siden'
 *   tilDognet(0.3)?.klokke         // 'kl. 23.59.54' (moderne mennesker de siste sekundene)
 */
import { fmtTall } from './akser';

/** Nivå i tidsskalaen, fra størst til minst. */
export type TidsNiva = 'eon' | 'era' | 'periode' | 'epoke';

/** Ett intervall i tidsskalaen (eon, era, periode eller epoke). */
export interface TidsIntervall {
  /** Stabil nøkkel (ASCII), f.eks. `'kambrium'`, `'kvartaer'`. Fargene `GEO.tid.*` bruker de samme nøklene. */
  id: string;
  /** Navnet i løpende tekst (liten forbokstav): «i kambrium». */
  navn: string;
  /** Navnet som etikett (stor forbokstav først): «Kambrium». */
  etikett: string;
  /** Kort norsk forkortelse til smale bånd (2–4 tegn). */
  kort: string;
  /** Internasjonalt symbol fra geologiske kart (Є, O, S …), når det finnes. */
  symbol?: string;
  niva: TidsNiva;
  /** Nedre grense (basen, eldst) i millioner år. */
  start: number;
  /** Øvre grense (yngst) i millioner år. */
  slutt: number;
  /** ± millioner år for basen, slik ICS-kartet oppgir den. */
  usikkerhet?: number;
  /** ICS-kartet skriver basen med «~» (omtrentlig, ikke fastsatt). */
  omtrent?: boolean;
  /** `id` til intervallet ett nivå opp (perioden til en epoke, eraen til en periode). */
  forelder?: string;
}

type Rad = [id: string, navn: string, kort: string, start: number, slutt: number, forelder?: string, ekstra?: Partial<TidsIntervall>];

function lag(niva: TidsNiva, rader: Rad[]): TidsIntervall[] {
  return rader.map(([id, navn, kort, start, slutt, forelder, ekstra]) => ({
    id,
    navn,
    etikett: navn.charAt(0).toUpperCase() + navn.slice(1),
    kort,
    niva,
    start,
    slutt,
    ...(forelder ? { forelder } : {}),
    ...ekstra,
  }));
}

/*
 * Kilde: International Chronostratigraphic Chart, International Commission on Stratigraphy (ICS), versjon 2023/09
 * (stratigraphy.org), basene i millioner år: karbon 358,86 ± 0,19, devon 419,62 ± 1,36, silur 443,1 ± 0,9,
 * ordovicium 486,85 ± 1,5, kambrium 538,8 ± 0,2, trias 251,902 ± 0,024, jura 201,4 ± 0,2, kritt ~143,1 (ikke
 * fastsatt), kryogenium ~720 og ediacara ~635. Basene i devon og karbon kom inn i kartet sammen (fra Geologic Time
 * Scale 2020); tidligere versjoner hadde 419,2 ± 3,2 og 358,9 ± 0,4. Silur og ordovicium er kontrollert mot
 * oppslagsverk som følger kartet. Holocen begynner 11 700 år før år 2000,
 * arkeikum 4031 ± 3, og hadeikum begynner med jordas dannelse, 4567 millioner år. Norske navn som i Store norske
 * leksikon (kambrium, ordovicium, silur, devon, karbon, perm, trias, jura, kritt, paleogen, neogen, kvartær).
 */
const EONER = lag('eon', [
  ['hadeikum', 'hadeikum', 'Had', 4567, 4031],
  ['arkeikum', 'arkeikum', 'Ark', 4031, 2500, undefined, { usikkerhet: 3 }],
  ['proterozoikum', 'proterozoikum', 'Prot', 2500, 538.8],
  ['fanerozoikum', 'fanerozoikum', 'Fan', 538.8, 0, undefined, { usikkerhet: 0.2 }],
]);

// Kortnavnene unngår «Ma» (forkortelsen for millioner år) og «Na» foran «N…» i teksten (se README).
const ERAER = lag('era', [
  ['eoarkeikum', 'eoarkeikum', 'Eoa', 4031, 3600, 'arkeikum', { usikkerhet: 3 }],
  ['paleoarkeikum', 'paleoarkeikum', 'Paa', 3600, 3200, 'arkeikum'],
  ['mesoarkeikum', 'mesoarkeikum', 'Mea', 3200, 2800, 'arkeikum'],
  ['neoarkeikum', 'neoarkeikum', 'Nea', 2800, 2500, 'arkeikum'],
  ['paleoproterozoikum', 'paleoproterozoikum', 'Pp', 2500, 1600, 'proterozoikum'],
  ['mesoproterozoikum', 'mesoproterozoikum', 'Mp', 1600, 1000, 'proterozoikum'],
  ['neoproterozoikum', 'neoproterozoikum', 'Np', 1000, 538.8, 'proterozoikum'],
  ['paleozoikum', 'paleozoikum', 'Pz', 538.8, 251.902, 'fanerozoikum', { usikkerhet: 0.2 }],
  ['mesozoikum', 'mesozoikum', 'Mz', 251.902, 66, 'fanerozoikum', { usikkerhet: 0.024 }],
  ['kenozoikum', 'kenozoikum', 'Kz', 66, 0, 'fanerozoikum'],
]);
const PERIODER = lag('periode', [
  ['siderium', 'siderium', 'Sid', 2500, 2300, 'paleoproterozoikum'],
  ['rhyacium', 'rhyacium', 'Rhy', 2300, 2050, 'paleoproterozoikum'],
  ['orosirium', 'orosirium', 'Oro', 2050, 1800, 'paleoproterozoikum'],
  ['statherium', 'statherium', 'Sta', 1800, 1600, 'paleoproterozoikum'],
  ['calymmium', 'calymmium', 'Cal', 1600, 1400, 'mesoproterozoikum'],
  ['ectasium', 'ectasium', 'Ect', 1400, 1200, 'mesoproterozoikum'],
  ['stenium', 'stenium', 'Ste', 1200, 1000, 'mesoproterozoikum'],
  ['tonium', 'tonium', 'Ton', 1000, 720, 'neoproterozoikum'],
  ['kryogenium', 'kryogenium', 'Kry', 720, 635, 'neoproterozoikum', { omtrent: true }],
  ['ediacara', 'ediacara', 'Edi', 635, 538.8, 'neoproterozoikum', { omtrent: true }],
  ['kambrium', 'kambrium', 'Kam', 538.8, 486.85, 'paleozoikum', { symbol: 'Є', usikkerhet: 0.2 }],
  ['ordovicium', 'ordovicium', 'Ord', 486.85, 443.1, 'paleozoikum', { symbol: 'O', usikkerhet: 1.5 }],
  ['silur', 'silur', 'Sil', 443.1, 419.62, 'paleozoikum', { symbol: 'S', usikkerhet: 0.9 }],
  ['devon', 'devon', 'Dev', 419.62, 358.86, 'paleozoikum', { symbol: 'D', usikkerhet: 1.36 }],
  ['karbon', 'karbon', 'Kar', 358.86, 298.9, 'paleozoikum', { symbol: 'C', usikkerhet: 0.19 }],
  ['perm', 'perm', 'Per', 298.9, 251.902, 'paleozoikum', { symbol: 'P', usikkerhet: 0.15 }],
  ['trias', 'trias', 'Tri', 251.902, 201.4, 'mesozoikum', { symbol: 'T', usikkerhet: 0.024 }],
  ['jura', 'jura', 'Jur', 201.4, 143.1, 'mesozoikum', { symbol: 'J', usikkerhet: 0.2 }],
  ['kritt', 'kritt', 'Kri', 143.1, 66, 'mesozoikum', { symbol: 'K', omtrent: true }],
  ['paleogen', 'paleogen', 'Pg', 66, 23.03, 'kenozoikum', { symbol: 'Pg' }],
  ['neogen', 'neogen', 'Ng', 23.03, 2.58, 'kenozoikum', { symbol: 'N' }],
  ['kvartaer', 'kvartær', 'Kv', 2.58, 0, 'kenozoikum', { symbol: 'Q' }],
]);

const EPOKER = lag('epoke', [
  ['paleocen', 'paleocen', 'Pal', 66, 56, 'paleogen'],
  ['eocen', 'eocen', 'Eoc', 56, 33.9, 'paleogen'],
  ['oligocen', 'oligocen', 'Oli', 33.9, 23.03, 'paleogen'],
  ['miocen', 'miocen', 'Mio', 23.03, 5.333, 'neogen'],
  ['pliocen', 'pliocen', 'Pli', 5.333, 2.58, 'neogen'],
  ['pleistocen', 'pleistocen', 'Ple', 2.58, 0.0117, 'kvartaer'],
  ['holocen', 'holocen', 'Hol', 0.0117, 0, 'kvartaer'],
]);

/**
 * Hele tidsskalaen etter ICS-kartet versjon 2023/09: eoner, eraer, perioder (også i proterozoikum) og epokene i
 * kenozoikum, hvert nivå sortert fra eldst til yngst. Aldre i millioner år. Hadeikum har ingen eraer, og arkeikum
 * har ingen perioder.
 */
export const GEOLOGISK_TID: readonly TidsIntervall[] = [...EONER, ...ERAER, ...PERIODER, ...EPOKER];

/** Jordas alder i millioner år (basen i hadeikum). */
export const JORDAS_ALDER = 4567;

/**
 * Prekambrium: den uformelle samlebetegnelsen på alt før kambrium (hadeikum, arkeikum og proterozoikum, omtrent
 * 88 % av jordas historie). Ikke med i `GEOLOGISK_TID`, så nivåene der er sammenhengende; bruk den til ett bredt bånd
 * på en tidslinje. Fargen er `GEO.tid.prekambrium`.
 */
export const PREKAMBRIUM: TidsIntervall = {
  id: 'prekambrium',
  navn: 'prekambrium',
  etikett: 'Prekambrium',
  kort: 'Prek',
  niva: 'eon',
  start: JORDAS_ALDER,
  slutt: 538.8,
};

/** Alle intervallene på ett nivå, fra eldst til yngst. */
export function intervaller(niva: TidsNiva): TidsIntervall[] {
  return GEOLOGISK_TID.filter((i) => i.niva === niva);
}

/** Intervallet med denne nøkkelen, eller null. */
export function tidsintervall(id: string): TidsIntervall | null {
  return GEOLOGISK_TID.find((i) => i.id === id) ?? null;
}

/**
 * Intervallet på nivået `niva` som alderen (millioner år) ligger i, eller null (negativ alder, eldre enn jorda,
 * ugyldig tall, eller ingen inndeling på det nivået, som perioder i arkeikum). En alder akkurat på en grense hører
 * til det yngre intervallet, fordi grensen er basen til det: 66 er paleogen, ikke kritt. Alder 0 er i dag.
 */
export function intervallVed(alder: number, niva: TidsNiva): TidsIntervall | null {
  if (!Number.isFinite(alder) || alder < 0 || alder > JORDAS_ALDER) return null;
  for (const i of GEOLOGISK_TID) {
    if (i.niva !== niva) continue;
    if (alder <= i.start && (alder > i.slutt || (i.slutt === 0 && alder >= 0))) return i;
  }
  return null;
}

/**
 * Perioden alderen (millioner år) ligger i: `periodeVed(150)` gir jura. Der ICS-kartet ikke har perioder
 * (arkeikum og hadeikum), gis eraen eller eonen i stedet, så det alltid finnes et bånd å vise. Null for alder
 * under 0, over jordas alder eller et ugyldig tall.
 */
export function periodeVed(alder: number): TidsIntervall | null {
  return intervallVed(alder, 'periode') ?? intervallVed(alder, 'era') ?? intervallVed(alder, 'eon');
}

/** Varigheten til et intervall i millioner år. */
export function varighet(i: TidsIntervall): number {
  return i.start - i.slutt;
}

// ---------------------------------------------------------------------------------------------------------------
// Hendelser

/** En hendelse i jordas historie, til merker på en tidslinje. */
export interface GeoHendelse {
  /** Alder i millioner år (starten når hendelsen varte lenge). */
  alder: number;
  /** Slutten i millioner år, når hendelsen varte over lang tid. */
  slutt?: number;
  /** Kort tekst med liten forbokstav i fagord, f.eks. «Den kaledonske fjellkjeden dannes». */
  tekst: string;
  /** Alderen er omtrentlig (forklaringen bør si «omtrent»). */
  omtrent: boolean;
  /** Hendelsen hører til norsk geologi. */
  norsk?: boolean;
}

/*
 * Kilde: avrundede lærebokverdier. Jordas dannelse 4567,3 (ICS), eldste zirkon fra Jack Hills omtrent 4400
 * (Wilde mfl. 2001), Acasta-gneisen omtrent 4030 (Bowring og Williams 1999), stromatolitter omtrent 3500, den store
 * oksygenhendelsen omtrent 2400, snøballjord 720–635 (kryogenium), masseutdøingene ved slutten av ordovicium
 * (omtrent 445), i sen devon (omtrent 372), ved perm–trias (251,9), trias–jura (201,4) og kritt–paleogen (66,0).
 * Norsk: den kaledonske fjellkjeden omtrent 430–400 (hovedfasen), Oslofeltet omtrent 300–245 (riftdannelse og
 * vulkanisme i karbon og perm), kildebergarten i Nordsjøen (sen jura) og Nord-Atlanteren som åpner seg omtrent 55.
 * Moderne mennesker omtrent 300 000 år, siste istids maksimum omtrent 20 000 år siden, holocen 11 700 år.
 */
/**
 * Viktige hendelser i jordas historie (alder i millioner år, eldst først), til hendelsesmerkene på en `GeoTidslinje`:
 * `<GeoTidslinje … hendelser={GEO_HENDELSER} />`. `omtrent` sier at alderen er omtrentlig, og `norsk` merker norsk geologi.
 */
export const GEO_HENDELSER: readonly GeoHendelse[] = [
  { alder: 4567, tekst: 'Jorda og solsystemet dannes', omtrent: false },
  { alder: 4400, tekst: 'Eldste kjente mineralkorn (zirkon)', omtrent: true },
  { alder: 4030, tekst: 'Eldste kjente bergarter', omtrent: true },
  { alder: 3500, tekst: 'Eldste sikre spor av liv (stromatolitter)', omtrent: true },
  { alder: 2400, tekst: 'Oksygen hoper seg opp i atmosfæren', omtrent: true },
  { alder: 720, slutt: 635, tekst: 'Snøballjord: is nesten helt til ekvator', omtrent: true },
  { alder: 538.8, tekst: 'Mange dyregrupper med skall og skjelett', omtrent: false },
  { alder: 445, tekst: 'Masseutdøing ved slutten av ordovicium', omtrent: true },
  { alder: 430, slutt: 400, tekst: 'Den kaledonske fjellkjeden dannes', omtrent: true, norsk: true },
  { alder: 372, tekst: 'Masseutdøing i sen devon', omtrent: true },
  { alder: 300, slutt: 245, tekst: 'Riftdannelse og vulkaner i Oslofeltet', omtrent: true, norsk: true },
  { alder: 251.902, tekst: 'Den største masseutdøingen (slutten av perm)', omtrent: false },
  { alder: 201.4, tekst: 'Masseutdøing ved slutten av trias', omtrent: false },
  { alder: 157, slutt: 145, tekst: 'Kildebergarten til mye av oljen i Nordsjøen avsettes', omtrent: true, norsk: true },
  { alder: 66, tekst: 'Masseutdøing: dinosaurene (unntatt fuglene) dør ut', omtrent: false },
  { alder: 55, tekst: 'Nord-Atlanteren åpner seg mellom Norge og Grønland', omtrent: true, norsk: true },
  { alder: 2.58, tekst: 'Kvartær: istider og mellomistider veksler', omtrent: false },
  { alder: 0.3, tekst: 'Moderne mennesker', omtrent: true },
  { alder: 0.02, tekst: 'Siste istid er på sitt største', omtrent: true },
  { alder: 0.0117, tekst: 'Holocen: siste istid er over', omtrent: false },
];

// ---------------------------------------------------------------------------------------------------------------
// Jordas historie som ett døgn

const SEK_PER_DOGN = 86_400;

/** Et tidspunkt i jordas historie gjort om til et klokkeslett i ett døgn (jorda dannes kl. 00.00, i dag er kl. 24.00). */
export interface Dognstid {
  /** Sekunder etter midnatt (0–86 400). */
  sekunder: number;
  timer: number;
  minutter: number;
  sek: number;
  /** Sekunder før neste midnatt (i dag). */
  forMidnatt: number;
  /** «kl. 21.10.05» (timer, minutter og sekunder med punktum, som Språkrådet anbefaler). */
  klokke: string;
  /** «kl. 21.10» uten sekunder. */
  klokkeKort: string;
}

const to = (n: number): string => String(n).padStart(2, '0');

/**
 * Jordas historie (`jordasAlder` millioner år, standard 4567) presset sammen til ett døgn. Alder 4567 gir
 * kl. 00.00.00, alder 0 gir kl. 24.00.00. Sekundene rundes av. Null for alder under 0, over jordas alder eller et
 * ugyldig tall.
 */
export function tilDognet(alder: number, jordasAlder = JORDAS_ALDER): Dognstid | null {
  if (!Number.isFinite(alder) || !Number.isFinite(jordasAlder) || jordasAlder <= 0) return null;
  if (alder < 0 || alder > jordasAlder) return null;
  const sekunder = Math.round(((jordasAlder - alder) / jordasAlder) * SEK_PER_DOGN);
  const timer = Math.floor(sekunder / 3600);
  const minutter = Math.floor((sekunder % 3600) / 60);
  const sek = sekunder % 60;
  return {
    sekunder,
    timer,
    minutter,
    sek,
    forMidnatt: SEK_PER_DOGN - sekunder,
    klokke: `kl. ${to(timer)}.${to(minutter)}.${to(sek)}`,
    klokkeKort: `kl. ${to(timer)}.${to(minutter)}`,
  };
}

/** Motsatt av `tilDognet`: sekunder etter midnatt (0–86 400) → alder i millioner år. Null utenfor døgnet. */
export function fraDognet(sekunder: number, jordasAlder = JORDAS_ALDER): number | null {
  if (!Number.isFinite(sekunder) || !Number.isFinite(jordasAlder) || jordasAlder <= 0) return null;
  if (sekunder < 0 || sekunder > SEK_PER_DOGN) return null;
  return jordasAlder * (1 - sekunder / SEK_PER_DOGN);
}

// ---------------------------------------------------------------------------------------------------------------
// Alder som tekst

/** Valg til `fmtAlder`. */
export interface FmtAlderValg {
  /** Legg til « siden»: «66 millioner år siden». Alder 0 blir da «i dag». */
  siden?: boolean;
  /** Fast antall desimaler. Uten: inntil tre gjeldende siffer, uten nuller på slutten (419,62 → «420»). */
  desimaler?: number;
  /** Tving en enhet. `'auto'` (standard): milliarder fra 1000 millioner år, år under 1 million år. */
  enhet?: 'auto' | 'milliarder' | 'millioner' | 'år';
  /** Forkortet til smale etiketter: «66 mill. år», «4,57 mrd. år». */
  kort?: boolean;
}

/** Runder til `sig` gjeldende siffer, men aldri bort heltallssifre, og gir antallet desimaler som trengs. */
function autoDesimaler(v: number, sig: number): number {
  if (v === 0) return 0;
  const maks = Math.max(0, sig - 1 - Math.floor(Math.log10(Math.abs(v))));
  const fast = Number(v.toFixed(maks));
  for (let d = 0; d < maks; d++) {
    if (Math.abs(Number(v.toFixed(d)) - fast) < 1e-9) return d;
  }
  return maks;
}

function rundSig(v: number, sig: number): number {
  if (v === 0) return 0;
  const e = Math.floor(Math.log10(Math.abs(v)));
  if (e < sig - 1) return v;
  const f = 10 ** (e - sig + 1);
  return Math.round(v / f) * f;
}

/**
 * En alder i millioner år som norsk tekst: `fmtAlder(66)` → «66 millioner år», `fmtAlder(4567)` → «4,57 milliarder
 * år», `fmtAlder(0.0117)` → «11 700 år», `fmtAlder(1)` → «1 million år». Skriver aldri forkortelsen «Ma» (bruk
 * `kort` for «mill. år» i smale etiketter). Enheten velges etter avrundingen (999,9 → «1 milliard år»), og tallet
 * skrives med `fmtTall`: tusenskille først fra fem sifre («3500 år», «11 700 år»). Negative og ugyldige tall gir «–».
 */
export function fmtAlder(millionerAar: number, valg: FmtAlderValg = {}): string {
  const { siden = false, desimaler, enhet = 'auto', kort = false } = valg;
  if (!Number.isFinite(millionerAar) || millionerAar < 0) return '–';
  if (millionerAar === 0 && siden) return 'i dag';
  const hale = siden ? ' siden' : '';
  const auto = enhet === 'auto';
  let valgt: 'milliarder' | 'millioner' | 'år' = !auto ? enhet : millionerAar >= 1000 ? 'milliarder' : millionerAar >= 1 ? 'millioner' : 'år';

  // Enheten velges etter avrundingen, så 999,9 millioner blir «1 milliard år» og 999 999,9 år «1 million år»
  if (valgt === 'år') {
    const aar = millionerAar * 1e6;
    const v = desimaler === undefined ? rundSig(aar, 3) : aar;
    const d = desimaler ?? autoDesimaler(v, 3);
    if (!(auto && Number(v.toFixed(d)) >= 1e6)) return `${fmtTall(v, d)} år${hale}`;
    valgt = 'millioner';
  }
  if (valgt === 'millioner' && auto) {
    const d = desimaler ?? autoDesimaler(millionerAar, 3);
    if (Number(millionerAar.toFixed(d)) >= 1000) valgt = 'milliarder';
  }
  const v = valgt === 'milliarder' ? millionerAar / 1000 : millionerAar;
  const d = desimaler ?? autoDesimaler(v, 3);
  const tekst = fmtTall(v, d);
  const en = tekst === '1';
  const ord =
    valgt === 'milliarder'
      ? kort
        ? 'mrd. år'
        : en
          ? 'milliard år'
          : 'milliarder år'
      : kort
        ? 'mill. år'
        : en
          ? 'million år'
          : 'millioner år';
  return `${tekst} ${ord}${hale}`;
}
