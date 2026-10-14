/**
 * Hydrologi i geofag: vannets kretsløp globalt (magasiner, strømmer og oppholdstid), vannbalansen i et nedbørfelt,
 * grunnvann (materialer, Darcys lov, porefart, reisetid og senkningstrakt rundt en brønn) og flomfrekvens (sannsynlighet
 * i en periode, plotteposisjoner og Gumbel-fordelingen). Ren logikk uten React.
 *
 * Enheter: volum i km³, globale strømmer i km³ per år, nedbør og avrenning i mm per år, vannføring i m³/s, farter i
 * m/s (gjør om med `mPerDogn`), hydraulisk ledningsevne K i m/s, transmissivitet T i m²/s. Ugyldige tall gir `null`,
 * aldri `NaN` eller `Infinity`.
 *
 *   oppholdstid(12_900, 486_000) * 365.25                  // ca. 9,7 døgn i atmosfæren
 *   mPerDogn(porefart(darcy(4e-4, 0.006)!, 0.25)!)         // ca. 0,83 m per døgn
 *   sannsynlighetIPerioden(200, 50)                         // ca. 0,22
 *   flomMedGjentaksintervall(gumbelTilpasning(serie)!, 200) // 200-årsflommen i m³/s
 */
import type { MonsterId } from './typer';
import { middel, standardavvik } from './statistikk';

/** Sekunder i et døgn. */
export const SEK_PER_DOGN = 86_400;
/** Sekunder i et år (365,25 døgn). */
export const SEK_PER_AAR = 365.25 * SEK_PER_DOGN;

const endelig = (x: number): number | null => (Number.isFinite(x) ? x : null);

// ---------------------------------------------------------------------------------------------------------------------
// Vannets kretsløp globalt

/** Magasinene i vannets kretsløp. */
export type MagasinId =
  | 'hav'
  | 'is'
  | 'grunnvann'
  | 'permafrost'
  | 'innsjoer'
  | 'jordfuktighet'
  | 'atmosfaeren'
  | 'myr'
  | 'elver'
  | 'biosfaeren';

/** De tre boksene i det globale kretsløpet som strømmene går mellom. Alle magasinene på land hører til `'land'`. */
export type KretslopBoks = 'hav' | 'atmosfaeren' | 'land';

/** Ett magasin i vannets kretsløp. */
export interface Vannmagasin {
  id: MagasinId;
  /** Navnet i løpende tekst: «isbreer og snø». */
  navn: string;
  /** Volumet i km³. */
  volum: number;
  /** Hvor mye av volumet som er ferskvann, i km³ (0 for havet). */
  ferskt: number;
  /** Boksen magasinet hører til i `GLOBALE_STROMMER`. */
  boks: KretslopBoks;
  /** Typisk oppholdstid i år (omtrentlig), eller null når den ikke er oppgitt i kilden. */
  typiskOppholdstid: { min: number; max: number } | null;
}

/*
 * Kilde for volumene: Shiklomanov 1993 (i Gleick, «Water in Crisis»), slik USGS gjengir dem i «Where is Earth's water?»:
 * havet 1 338 000 000 km³, iskapper, isbreer og permanent snø 24 064 000, grunnvann 23 400 000 (10 530 000 ferskt),
 * jordfuktighet 16 500, bakkeis og permafrost 300 000, innsjøer 176 400 (91 000 ferske), atmosfæren 12 900, sump og myr
 * 11 470, elver 2 120 og levende organismer 1 120 km³; til sammen ca. 1 386 000 000 km³, der ferskvannet er ca. 2,5 %.
 * Typiske oppholdstider (omtrentlige): Pidwirny 2006 (Fundamentals of Physical Geography, tabell 8b-2): atmosfæren 9 døgn,
 * elver 2–6 måneder, jordfuktighet 1–2 måneder, innsjøer 50–100 år, grunnvann 100–200 år (grunt) til 10 000 år (dypt),
 * isbreer 20–100 år og Antarktis 20 000 år, havet 3200 år.
 */
/** Magasinene i vannets kretsløp etter Shiklomanov 1993 (volum i km³), fra størst til minst. */
export const GLOBALE_RESERVOARER: readonly Vannmagasin[] = [
  { id: 'hav', navn: 'havet', volum: 1_338_000_000, ferskt: 0, boks: 'hav', typiskOppholdstid: { min: 3200, max: 3200 } },
  { id: 'is', navn: 'isbreer og snø', volum: 24_064_000, ferskt: 24_064_000, boks: 'land', typiskOppholdstid: { min: 20, max: 20_000 } },
  { id: 'grunnvann', navn: 'grunnvann', volum: 23_400_000, ferskt: 10_530_000, boks: 'land', typiskOppholdstid: { min: 100, max: 10_000 } },
  { id: 'permafrost', navn: 'bakkeis og permafrost', volum: 300_000, ferskt: 300_000, boks: 'land', typiskOppholdstid: null },
  { id: 'innsjoer', navn: 'innsjøer', volum: 176_400, ferskt: 91_000, boks: 'land', typiskOppholdstid: { min: 50, max: 100 } },
  { id: 'jordfuktighet', navn: 'jordfuktighet', volum: 16_500, ferskt: 16_500, boks: 'land', typiskOppholdstid: { min: 1 / 12, max: 2 / 12 } },
  { id: 'atmosfaeren', navn: 'atmosfæren', volum: 12_900, ferskt: 12_900, boks: 'atmosfaeren', typiskOppholdstid: { min: 9 / 365.25, max: 9 / 365.25 } },
  { id: 'myr', navn: 'myr og sump', volum: 11_470, ferskt: 11_470, boks: 'land', typiskOppholdstid: null },
  { id: 'elver', navn: 'elver', volum: 2_120, ferskt: 2_120, boks: 'land', typiskOppholdstid: { min: 2 / 12, max: 6 / 12 } },
  { id: 'biosfaeren', navn: 'levende organismer', volum: 1_120, ferskt: 1_120, boks: 'land', typiskOppholdstid: null },
];

/** Magasinet med id-en, eller null. */
export function vannmagasin(id: MagasinId): Vannmagasin | null {
  return GLOBALE_RESERVOARER.find((m) => m.id === id) ?? null;
}

/** Strømmene i vannets kretsløp globalt. */
export type StromId = 'fordamping-hav' | 'nedbor-hav' | 'nedbor-land' | 'fordamping-land' | 'avrenning';

/** Én strøm i det globale kretsløpet. */
export interface Vannstrom {
  id: StromId;
  /** «fordampning fra havet». */
  navn: string;
  fra: KretslopBoks;
  til: KretslopBoks;
  /** km³ per år. */
  mengde: number;
}

/*
 * Kilde: Trenberth mfl. 2007 (J. Hydrometeorol. 8, 758–769, fig. 1), i tusen km³ per år: fordampning fra havet 413,
 * nedbør på havet 373, nedbør på land 113, fordampning og transpirasjon fra land 73, vanndamp som vinden fører fra havet
 * inn over land 40 og avrenning fra land til havet 40. Kretsløpet er i balanse: 413 − 373 = 113 − 73 = 40.
 */
/** Strømmene i vannets kretsløp etter Trenberth mfl. 2007 (km³ per år). */
export const GLOBALE_STROMMER: readonly Vannstrom[] = [
  { id: 'fordamping-hav', navn: 'fordampning fra havet', fra: 'hav', til: 'atmosfaeren', mengde: 413_000 },
  { id: 'nedbor-hav', navn: 'nedbør på havet', fra: 'atmosfaeren', til: 'hav', mengde: 373_000 },
  { id: 'nedbor-land', navn: 'nedbør på land', fra: 'atmosfaeren', til: 'land', mengde: 113_000 },
  { id: 'fordamping-land', navn: 'fordampning og transpirasjon fra land', fra: 'land', til: 'atmosfaeren', mengde: 73_000 },
  { id: 'avrenning', navn: 'avrenning til havet (elver og grunnvann)', fra: 'land', til: 'hav', mengde: 40_000 },
];

/**
 * Vanndamp som vinden fører fra lufta over havet til lufta over land, km³ per år (Trenberth mfl. 2007). Den går inne i
 * atmosfæren, så den er ikke med i `GLOBALE_STROMMER`, men den er like stor som avrenningen.
 */
export const VANNDAMP_TIL_LAND = 40_000;

/** Summen av strømmene inn til og ut av en boks (km³ per år). */
export function boksStrommer(boks: KretslopBoks): { inn: number; ut: number } {
  let inn = 0;
  let ut = 0;
  for (const s of GLOBALE_STROMMER) {
    if (s.til === boks) inn += s.mengde;
    if (s.fra === boks) ut += s.mengde;
  }
  return { inn, ut };
}

/**
 * Oppholdstiden i et magasin: volum delt på strømmen gjennom det (inn eller ut, som er like store i likevekt). Med volum
 * i km³ og strøm i km³ per år blir svaret i år. Strøm ≤ 0 gir null (vannet blir der for alltid); volum 0 gir 0.
 *
 * @param volum Hvor mye vann magasinet holder.
 * @param strom Hvor mye vann som strømmer gjennom per tidsenhet.
 */
export function oppholdstid(volum: number, strom: number): number | null {
  if (!Number.isFinite(volum) || volum < 0 || !Number.isFinite(strom) || strom <= 0) return null;
  return endelig(volum / strom);
}

/**
 * Oppholdstiden i år for en av de tre boksene i det globale kretsløpet: summen av magasinene i boksen delt på strømmen
 * ut. Atmosfæren gir ca. 9,7 døgn (0,027 år), havet ca. 3200 år.
 *
 * @param boks `'hav'`, `'atmosfaeren'` eller `'land'`.
 */
export function boksOppholdstid(boks: KretslopBoks): number | null {
  const volum = GLOBALE_RESERVOARER.filter((m) => m.boks === boks).reduce((s, m) => s + m.volum, 0);
  return oppholdstid(volum, boksStrommer(boks).ut);
}

// ---------------------------------------------------------------------------------------------------------------------
// Vannbalansen i et nedbørfelt

/** Inndata til `vannbalanse` (mm per år eller mm over samme periode). */
export interface VannbalanseInn {
  /** Nedbør P. */
  nedbor: number;
  /** Fordampning og transpirasjon E. */
  fordamping: number;
  /** Endring i lagret vann ΔS (snø, grunnvann, innsjøer); positiv når mer blir lagret. Standard 0 (et normalår). */
  lagringsendring?: number;
}

/** Resultatet av `vannbalanse`. */
export interface Vannbalanse {
  /** Avrenningen Q = P − E − ΔS i mm. Negativ betyr at feltet tørker ut (underskudd). */
  avrenning: number;
  /** Q/P: hvor stor del av nedbøren som renner av, eller null når nedbøren er 0. */
  avrenningsandel: number | null;
}

/**
 * Vannbalanselikningen for et nedbørfelt: P = E + Q + ΔS, løst for avrenningen Q. Ugyldige tall eller negativ nedbør
 * eller fordampning gir null.
 *
 * @param inn Nedbør, fordampning og lagringsendring i mm.
 */
export function vannbalanse(inn: VannbalanseInn): Vannbalanse | null {
  const { nedbor, fordamping } = inn;
  const ds = inn.lagringsendring ?? 0;
  if (![nedbor, fordamping, ds].every(Number.isFinite) || nedbor < 0 || fordamping < 0) return null;
  const avrenning = nedbor - fordamping - ds;
  return { avrenning, avrenningsandel: nedbor > 0 ? avrenning / nedbor : null };
}

/**
 * Middelvannføringen (m³/s) ved utløpet av et felt med avrenningen `mmPerAar` over arealet `arealKm2`: 1100 mm per år
 * over 85 km² gir ca. 2,96 m³/s. Areal ≤ 0 gir null.
 *
 * @param mmPerAar Avrenning i mm per år.
 * @param arealKm2 Feltets areal i km².
 */
export function vannforingFraAvrenning(mmPerAar: number, arealKm2: number): number | null {
  if (!Number.isFinite(mmPerAar) || !Number.isFinite(arealKm2) || arealKm2 <= 0) return null;
  return endelig(((mmPerAar / 1000) * arealKm2 * 1e6) / SEK_PER_AAR);
}

/**
 * Avrenningen i mm per år for en middelvannføring `q` (m³/s) fra et felt på `arealKm2` km². Areal ≤ 0 gir null.
 *
 * @param q Vannføring i m³/s.
 * @param arealKm2 Feltets areal i km².
 */
export function avrenningFraVannforing(q: number, arealKm2: number): number | null {
  if (!Number.isFinite(q) || !Number.isFinite(arealKm2) || arealKm2 <= 0) return null;
  return endelig(((q * SEK_PER_AAR) / (arealKm2 * 1e6)) * 1000);
}

/**
 * Spesifikk avrenning i liter per sekund per km² (l/(s·km²)), som NVE bruker for å sammenligne felt av ulik størrelse.
 * Areal ≤ 0 gir null.
 *
 * @param q Vannføring i m³/s.
 * @param arealKm2 Feltets areal i km².
 */
export function spesifikkAvrenning(q: number, arealKm2: number): number | null {
  if (!Number.isFinite(q) || !Number.isFinite(arealKm2) || arealKm2 <= 0) return null;
  return endelig((q * 1000) / arealKm2);
}

// ---------------------------------------------------------------------------------------------------------------------
// Grunnvann

/** Materialer grunnvannet kan strømme gjennom. */
export type MaterialId = 'grus' | 'sand' | 'silt' | 'leire' | 'morene' | 'oppsprukket-fjell' | 'tett-fjell';

/** Ett materiale med hydraulisk ledningsevne og porøsitet. */
export interface Grunnmateriale {
  id: MaterialId;
  /** Navnet i løpende tekst: «oppsprukket fjell». */
  navn: string;
  /** Typisk hydraulisk ledningsevne K i m/s. */
  K: number;
  /** Vanlig spenn for K i m/s (materialene varierer over flere tierpotenser). */
  kMin: number;
  kMax: number;
  /** Total porøsitet (andel av volumet som er porer, 0–1). */
  porositet: number;
  /** Effektiv porøsitet (andelen vannet kan strømme gjennom og som kan tappes, 0–1). */
  effektivPorositet: number;
  /** Mønsteret materialet tegnes med (`lagFyll`), eller null. */
  monster: MonsterId | null;
}

/*
 * Kilder (omtrentlige, typiske verdier): hydraulisk ledningsevne etter Freeze og Cherry 1979 (Groundwater, tabell 2.2)
 * og Fetter 2001 (Applied Hydrogeology, tabell 4.5); porøsitet etter Freeze og Cherry tabell 2.4; effektiv porøsitet
 * (spesifikt utbytte) etter Johnson 1967 (USGS Water-Supply Paper 1662-D). Oppsprukket fjell som i NGUs veiledning for
 * grunnvann i fjell (10⁻⁷–10⁻⁵ m/s, porøsitet omtrent 1 %). Morene er her en tett, norsk bunnmorene.
 */
/** Materialene for grunnvann (K i m/s, porøsitet 0–1), fra mest til minst gjennomtrengelig blant løsmassene. */
export const MATERIALER: readonly Grunnmateriale[] = [
  { id: 'grus', navn: 'grus', K: 1e-2, kMin: 1e-4, kMax: 1, porositet: 0.3, effektivPorositet: 0.25, monster: 'grus' },
  { id: 'sand', navn: 'sand', K: 1e-4, kMin: 1e-6, kMax: 1e-2, porositet: 0.35, effektivPorositet: 0.25, monster: 'sand' },
  { id: 'silt', navn: 'silt', K: 1e-6, kMin: 1e-9, kMax: 1e-5, porositet: 0.45, effektivPorositet: 0.08, monster: null },
  { id: 'leire', navn: 'leire', K: 1e-9, kMin: 1e-12, kMax: 1e-8, porositet: 0.5, effektivPorositet: 0.02, monster: 'leire' },
  { id: 'morene', navn: 'morene', K: 1e-7, kMin: 1e-10, kMax: 1e-5, porositet: 0.25, effektivPorositet: 0.05, monster: 'morene' },
  { id: 'oppsprukket-fjell', navn: 'oppsprukket fjell', K: 1e-6, kMin: 1e-7, kMax: 1e-5, porositet: 0.01, effektivPorositet: 0.005, monster: 'gneis' },
  { id: 'tett-fjell', navn: 'tett fjell', K: 1e-11, kMin: 1e-14, kMax: 1e-10, porositet: 0.005, effektivPorositet: 0.001, monster: 'granitt' },
];

/** Materialet med id-en, eller null. */
export function grunnmateriale(id: MaterialId): Grunnmateriale | null {
  return MATERIALER.find((m) => m.id === id) ?? null;
}

/**
 * Den hydrauliske gradienten i = (h₁ − h₂)/L: hvor mye grunnvannsspeilet faller per meter. To brønner 250 m fra
 * hverandre med speil på 162,4 og 160,9 m o.h. gir 0,006. L ≤ 0 gir null.
 *
 * @param h1 Høyden på grunnvannsspeilet oppstrøms (m o.h.).
 * @param h2 Høyden nedstrøms (m o.h.).
 * @param avstand Avstanden mellom målepunktene i m.
 */
export function hydrauliskGradient(h1: number, h2: number, avstand: number): number | null {
  if (![h1, h2, avstand].every(Number.isFinite) || avstand <= 0) return null;
  return (h1 - h2) / avstand;
}

/**
 * Darcys lov: Darcy-hastigheten (spesifikk vannføring) q = K · i i m/s, altså vannmengden per areal av hele tverrsnittet
 * (korn og porer). Vannet i porene går fortere, se `porefart`. Negativ gradient gir strøm motsatt vei. K < 0 eller
 * ugyldige tall gir null.
 *
 * @param K Hydraulisk ledningsevne i m/s.
 * @param gradient Hydraulisk gradient (dimensjonsløs).
 */
export function darcy(K: number, gradient: number): number | null {
  if (!Number.isFinite(K) || K < 0 || !Number.isFinite(gradient)) return null;
  return endelig(K * gradient);
}

/**
 * Porefarten v = q/nₑ (m/s): hvor fort vannet (og en forurensning) faktisk beveger seg gjennom porene. Alltid større enn
 * Darcy-hastigheten, fordi vannet bare går gjennom porene. Effektiv porøsitet ≤ 0 eller over 1 gir null.
 *
 * @param q Darcy-hastigheten i m/s.
 * @param effektivPorositet Effektiv porøsitet nₑ (0–1).
 */
export function porefart(q: number, effektivPorositet: number): number | null {
  if (!Number.isFinite(q) || !Number.isFinite(effektivPorositet) || effektivPorositet <= 0 || effektivPorositet > 1) return null;
  return endelig(q / effektivPorositet);
}

/**
 * Reisetiden t = L/v for vann (eller en forurensning som følger vannet) over avstanden L med farten v, i samme tidsenhet
 * som farten (m/s gir sekunder; del på `SEK_PER_DOGN` for døgn). L = 0 gir 0; v ≤ 0 gir null (vannet kommer aldri fram).
 *
 * @param avstand Avstand i m.
 * @param fart Porefart i m per tidsenhet.
 */
export function reisetid(avstand: number, fart: number): number | null {
  if (!Number.isFinite(avstand) || avstand < 0 || !Number.isFinite(fart)) return null;
  if (avstand === 0) return 0;
  if (fart <= 0) return null;
  return endelig(avstand / fart);
}

/** Fart i m/s omregnet til meter per døgn. Ugyldig tall gir null. */
export function mPerDogn(v: number): number | null {
  return Number.isFinite(v) ? endelig(v * SEK_PER_DOGN) : null;
}

/** Fart i m/s omregnet til meter per år. Ugyldig tall gir null. */
export function mPerAar(v: number): number | null {
  return Number.isFinite(v) ? endelig(v * SEK_PER_AAR) : null;
}

/**
 * Transmissiviteten T = K · b (m²/s): hvor lett vann strømmer gjennom hele tykkelsen b av det vannførende laget.
 * Negative eller ugyldige tall gir null.
 *
 * @param K Hydraulisk ledningsevne i m/s.
 * @param tykkelse Tykkelsen av den mettede sonen i m.
 */
export function transmissivitet(K: number, tykkelse: number): number | null {
  if (!Number.isFinite(K) || !Number.isFinite(tykkelse) || K < 0 || tykkelse < 0) return null;
  return endelig(K * tykkelse);
}

/*
 * Kilde: Thiem 1906, likevektsformelen for en brønn i et avgrenset magasin, s(r) = Q/(2πT) · ln(R/r) (forenklet: brukt
 * også for et åpent magasin når senkningen er liten sammenlignet med tykkelsen). Påvirkningsradien etter Cooper og
 * Jacob 1946: R = 1,5 · √(T t / S).
 */
/**
 * Senkningen (m) av grunnvannsspeilet i avstanden r fra en brønn som pumper Q (Thiem, forenklet): s = Q/(2πT) · ln(R/r).
 * Senkningen er 0 ved påvirkningsradien R og utenfor, og størst ved brønnen (r regnes som minst brønnradien). Tette
 * masser (liten T) gir en dyp, smal trakt; grus gir en grunn, vid trakt (se `paavirkningsradius`). Negativ r regnes som
 * avstand, så du kan sende inn x − xBrønn. Ugyldige tall, T ≤ 0 eller R ≤ brønnradien gir null.
 *
 * @param r Avstand fra brønnen i m.
 * @param Q Pumperate i m³/s.
 * @param T Transmissivitet i m²/s.
 * @param R Påvirkningsradius i m.
 * @param rBronn Brønnradien i m (standard 0,1).
 */
export function senkning(r: number, Q: number, T: number, R: number, rBronn = 0.1): number | null {
  if (![r, Q, T, R, rBronn].every(Number.isFinite) || Q < 0 || T <= 0 || rBronn <= 0 || R <= rBronn) return null;
  const avstand = Math.abs(r);
  if (avstand >= R) return 0;
  const rr = Math.max(rBronn, avstand);
  return endelig((Q / (2 * Math.PI * T)) * Math.log(R / rr));
}

/**
 * Påvirkningsradien (m) rundt en brønn etter pumpetiden t (Cooper og Jacob 1946): R = 1,5 · √(T t / S). Den vokser med
 * tiden og med transmissiviteten, så trakten blir vid i grus. Ugyldige tall eller S ≤ 0 gir null.
 *
 * @param T Transmissivitet i m²/s.
 * @param S Magasinkoeffisient (for et åpent magasin omtrent den effektive porøsiteten).
 * @param t Pumpetid i sekunder.
 */
export function paavirkningsradius(T: number, S: number, t: number): number | null {
  if (![T, S, t].every(Number.isFinite) || T < 0 || S <= 0 || t < 0) return null;
  return endelig(1.5 * Math.sqrt((T * t) / S));
}

// ---------------------------------------------------------------------------------------------------------------------
// Flomfrekvens

/**
 * Sannsynligheten for minst én hendelse med gjentaksintervall T (år) i løpet av n år: 1 − (1 − 1/T)ⁿ. En 200-årsflom har
 * 0,5 % sannsynlighet hvert år og ca. 22 % i løpet av 50 år; T = 100 og n = 100 gir 0,634. T < 1, negativ n eller
 * ugyldige tall gir null.
 *
 * @param T Gjentaksintervall i år (minst 1).
 * @param n Periodens lengde i år.
 */
export function sannsynlighetIPerioden(T: number, n: number): number | null {
  if (!Number.isFinite(T) || !Number.isFinite(n) || T < 1 || n < 0) return null;
  return 1 - (1 - 1 / T) ** n;
}

/** Plotteposisjonsformel: `'weibull'` m/(n + 1) (enklest å forklare) eller `'gringorten'` (m − 0,44)/(n + 0,12). */
export type Plottemetode = 'weibull' | 'gringorten';

/** Plotteposisjonen til én verdi i en årsmaksimumserie. */
export interface Plotteposisjon {
  /** Årlig overskridelsessannsynlighet (0–1). */
  overskridelse: number;
  /** Gjentaksintervallet T = 1/overskridelse i år. */
  gjentaksintervall: number;
}

/*
 * Kilde: Weibull 1939 og Gringorten 1963 (J. Geophys. Res. 68, 813–814); Gringorten er formelen som passer best til
 * Gumbel-fordelingen og brukes ofte av NVE.
 */
/**
 * Plotteposisjonen for den m-te største verdien i en serie på n år: overskridelsessannsynlighet og gjentaksintervall.
 * Med Weibull er T = (n + 1)/m, så den største flommen i en 60-årsserie plottes ved 61 år. Rang utenfor 1–n gir null.
 *
 * @param rang Rangen m (1 = største).
 * @param n Antall år i serien.
 * @param metode `'weibull'` (standard) eller `'gringorten'`.
 */
export function plotteposisjon(rang: number, n: number, metode: Plottemetode = 'weibull'): Plotteposisjon | null {
  if (!Number.isInteger(rang) || !Number.isInteger(n) || n < 1 || rang < 1 || rang > n) return null;
  const p = metode === 'weibull' ? rang / (n + 1) : (rang - 0.44) / (n + 0.12);
  return { overskridelse: p, gjentaksintervall: 1 / p };
}

/** Én verdi i en årsmaksimumserie med plotteposisjon. */
export interface PlottePunkt extends Plotteposisjon {
  verdi: number;
  /** Rang m (1 = største). */
  rang: number;
}

/**
 * Plotteposisjonene for en hel serie med årsmaksima (f.eks. årets største vannføring), sortert fra største til minste
 * verdi. Tom serie eller ugyldige tall gir null.
 *
 * @param serie Årsmaksimaene.
 * @param metode `'weibull'` (standard) eller `'gringorten'`.
 */
export function plotteposisjoner(serie: readonly number[], metode: Plottemetode = 'weibull'): PlottePunkt[] | null {
  if (serie.length === 0 || !serie.every(Number.isFinite)) return null;
  const s = [...serie].sort((a, b) => b - a);
  return s.map((verdi, i) => ({ verdi, rang: i + 1, ...plotteposisjon(i + 1, s.length, metode)! }));
}

/** Parameterne i en Gumbel-fordeling, F(x) = exp(−exp(−(x − u)/α)). */
export interface Gumbel {
  /** Plasseringsparameteren u (den mest sannsynlige årsflommen). */
  u: number;
  /** Skalaparameteren α (spredningen; 0 når alle verdiene i serien er like). */
  alfa: number;
  /** Middelverdien av serien. */
  middel: number;
  /** Standardavviket av serien (n − 1). */
  standardavvik: number;
  /** Antall år i serien. */
  n: number;
}

/*
 * Kilde: Gumbel 1958 (Statistics of Extremes), momentmetoden: α = √6 · s/π og u = x̄ − γ α, der γ = 0,5772 er Eulers
 * konstant. Gumbel-fordelingen er den klassiske fordelingen for flomfrekvensanalyse i læreverkene.
 */
/**
 * Tilpasser en Gumbel-fordeling til en serie med årsmaksima med momentmetoden (α = √6 · s/π, u = x̄ − 0,5772 · α).
 * Krever minst to år; ellers null.
 *
 * @param serie Årsmaksimaene (f.eks. m³/s).
 */
export function gumbelTilpasning(serie: readonly number[]): Gumbel | null {
  const m = middel(serie);
  const s = standardavvik(serie);
  if (m === null || s === null) return null;
  const alfa = (Math.sqrt(6) * s) / Math.PI;
  return { u: m - 0.5772156649 * alfa, alfa, middel: m, standardavvik: s, n: serie.length };
}

/**
 * Flommen (samme enhet som serien) med gjentaksintervall T år etter en Gumbel-fordeling: x_T = u − α · ln(−ln(1 − 1/T)).
 * Øker med T. T ≤ 1 gir null (ikke Infinity).
 *
 * @param gumbel Parameterne fra `gumbelTilpasning`.
 * @param T Gjentaksintervall i år (over 1).
 */
export function flomMedGjentaksintervall(gumbel: Pick<Gumbel, 'u' | 'alfa'>, T: number): number | null {
  if (!Number.isFinite(T) || T <= 1 || !Number.isFinite(gumbel.u) || !Number.isFinite(gumbel.alfa)) return null;
  return endelig(gumbel.u - gumbel.alfa * Math.log(-Math.log(1 - 1 / T)));
}

/**
 * Gjentaksintervallet (år) for en flom på `verdi` etter en Gumbel-fordeling: T = 1/(1 − F(verdi)). Brukes til å vise at
 * dagens 200-årsflom blir vanligere med klimapåslag. Null når T ikke er endelig (verdien er så stor at den praktisk talt
 * aldri overskrides, eller α = 0).
 *
 * @param gumbel Parameterne fra `gumbelTilpasning`.
 * @param verdi Flomstørrelsen.
 */
export function gjentaksintervall(gumbel: Pick<Gumbel, 'u' | 'alfa'>, verdi: number): number | null {
  if (!Number.isFinite(verdi) || !Number.isFinite(gumbel.u) || !Number.isFinite(gumbel.alfa) || gumbel.alfa <= 0) return null;
  const overskridelse = -Math.expm1(-Math.exp(-(verdi - gumbel.u) / gumbel.alfa));
  if (!(overskridelse > 0)) return null;
  return endelig(1 / overskridelse);
}

/*
 * Kilde: NVE (Lawrence 2016, «Klimaendring og framtidige flommer i Norge», NVE-rapport 81/2016): klimapåslag på 0, 20
 * eller 40 % på flomvannføringen, etter hvor mye flommene i nedbørfeltet ventes å øke fram mot 2100.
 */
/** Klimapåslagene NVE bruker på flomvannføringen, i prosent. */
export const KLIMAPASLAG: readonly number[] = [0, 20, 40];

/**
 * Flomvannføringen med klimapåslag: Q · (1 + prosent/100). Ugyldige tall gir null.
 *
 * @param q Flomvannføringen i dag.
 * @param prosent Klimapåslaget i prosent (0, 20 eller 40).
 */
export function medKlimapaslag(q: number, prosent: number): number | null {
  if (!Number.isFinite(q) || !Number.isFinite(prosent)) return null;
  return q * (1 + prosent / 100);
}
