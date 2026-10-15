/**
 * Modellen bak «Grunnvann: grunnvannsspeil, brønn og Darcys lov» (k6-grunnvann): et vannførende lag av grus, sand,
 * silt, leire eller oppsprukket fjell med et grunnvannsspeil som faller mot ei elv, en brønn som pumper, og to kilder
 * oppstrøms: en lekk kloakkledning (smittestoffer) og en gjødslet åker (nitrat). Ren logikk uten React.
 *
 * Bygger på hydrologi.ts i geofag-kit-et: MATERIALER (K og effektiv porøsitet), darcy (q = K · i), porefart (v = q/nₑ),
 * reisetidDarcy (t = L/v uten pumping), senkning (Thiem) og paavirkningsradius (Cooper og Jacob). Forenklinger: ett homogent lag med fast mettet tykkelse,
 * en brønn som går gjennom hele laget, og tida i den umettede sonen er ikke med (den gir bare ekstra margin).
 * Ugyldige tall gir null, aldri NaN eller Infinity.
 */
import { fmt } from '../../kit/format';
import {
  MATERIALER,
  SEK_PER_AAR,
  SEK_PER_DOGN,
  darcy,
  paavirkningsradius,
  porefart,
  senkning,
  transmissivitet,
  type Grunnmateriale,
  type MaterialId,
} from '../kit/hydrologi';
import type { MonsterId } from '../kit/typer';

const endelig = (x: number): number | null => (Number.isFinite(x) ? x : null);

// ---------------------------------------------------------------------------------------------------------------------
// Materialene eleven kan velge

/** Materialene i knappene: fire løsmasser og oppsprukket fjell. */
export type MaterialValg = Extract<MaterialId, 'grus' | 'sand' | 'silt' | 'leire' | 'oppsprukket-fjell'>;

/** Materialene i fast rekkefølge, fra mest til minst gjennomtrengelig blant løsmassene og fjell til slutt. */
export const MATERIAL_VALG: readonly MaterialValg[] = ['grus', 'sand', 'silt', 'leire', 'oppsprukket-fjell'];

/** Tekst på knappene. */
export const MATERIAL_KNAPP: Readonly<Record<MaterialValg, string>> = {
  grus: 'Grus',
  sand: 'Sand',
  silt: 'Silt',
  leire: 'Leire',
  'oppsprukket-fjell': 'Oppsprukket fjell',
};

/** Mønsteret laget tegnes med: løsmassemønstrene i kit-et, og oppsprukket fjell som gneis. */
export const MATERIAL_MONSTER: Readonly<Record<MaterialValg, MonsterId>> = {
  grus: 'grus',
  sand: 'sand',
  silt: 'silt',
  leire: 'leire',
  'oppsprukket-fjell': 'gneis',
};

/** Materialet fra MATERIALER (K, porøsitet og effektiv porøsitet). */
export function materiale(id: MaterialValg): Grunnmateriale {
  return MATERIALER.find((m) => m.id === id) ?? MATERIALER[0]!;
}

// ---------------------------------------------------------------------------------------------------------------------
// Faste tall i scenen

/** Den hydrauliske gradienten mot elva: grunnvannsspeilet faller 0,5 m per 100 m (eget, typisk tall for en dal). */
export const GRADIENT = 0.005;
/** Tykkelsen på den mettede sonen i m (eget tall). */
export const TYKKELSE_M = 20;
/** Radien til brønnen i m (et borehull på 20 cm). */
export const BRONN_RADIUS_M = 0.1;
/**
 * Hvor mye vannstanden i brønnen kan senkes (m) før den når pumpen: omtrent 60 % av den mettede tykkelsen. I et åpent
 * magasin gir mer senkning lite ekstra vann (tommelfingerregel, forenklet).
 */
export const MAKS_SENKNING_M = 12;
/** Pumpetiden påvirkningsradien regnes for (døgn). */
export const PUMPETID_DOGN = 30;

/*
 * Kilde for kravet: Mattilsynets veiledning til drikkevannsforskriften (om hygieniske barrierer for grunnvann) og NGUs
 * veiledning om grunnvannsforsyning og sikringssoner: grunnvann fra løsmasser med minst 60 døgns oppholdstid i grunnen
 * kan regnes som en hygienisk barriere, fordi bakterier og virus dør eller holdes tilbake underveis. Grensen for 60 døgn
 * brukes også til å avgrense det nære tilsigsområdet (sikringssone 1) rundt et grunnvannsverk. Kravet gjelder ikke
 * grunnvann i fjell: der går vannet i noen få åpne sprekker og kan komme mye fortere fram enn snittfarten tilsier, så
 * en fjellbrønn regnes ikke som en hygienisk barriere ut fra oppholdstiden og må ha en annen barriere (for eksempel
 * UV-behandling eller desinfeksjon med klor).
 */
/** Kravet til oppholdstid i grunnen før vannet når brønnen (døgn). */
export const KRAV_OPPHOLDSTID_DOGN = 60;

/** Pumperatene på glidebryteren (liter per sekund). */
export const PUMPERATER_LS: readonly number[] = [0, 0.1, 0.2, 0.5, 1, 2, 5, 10, 15, 20];
/** Avstanden fra den lekke kloakkledningen til brønnen (m): minst, størst og steget på glidebryteren. */
export const AVSTAND_MIN_M = 20;
export const AVSTAND_MAKS_M = 170;
export const AVSTAND_STEG_M = 10;
/** Avstanden fra midten av den gjødslede åkeren til brønnen (m). */
export const AKER_AVSTAND_M = 240;

/** Nitrat i sigevannet under den gjødslede åkeren, mg nitrat per liter (eget, omtrentlig tall). */
export const NITRAT_UNDER_AKER = 40;
/**
 * Hvor mange ganger nitratet blir fortynnet før det når brønnen: brønnen henter også rent grunnvann fra skog og utmark
 * rundt åkeren (eget tall).
 */
export const NITRAT_FORTYNNING = 4;
/** Grenseverdien for nitrat i drikkevann, mg NO₃⁻ per liter (drikkevannsforskriften, vedlegg 1). */
export const NITRAT_GRENSEVERDI = 50;

/**
 * Bare til figuren: hvor lenge (døgn) det tar før nesten alle smittestoffene i et merke har dødd eller satt seg fast.
 * Andelen som er igjen, faller jevnt fra 1 til 0 over denne tida (forenklet, ikke målte tall), så ved kravet på
 * 60 døgn er det bare en liten rest igjen.
 */
export const SMITTE_LEVETID_DOGN = 75;

// ---------------------------------------------------------------------------------------------------------------------
// Darcys lov, porefart og reisetid uten pumping

/** Darcy-hastigheten q og porefarten v (begge m/s) i et materiale med gradienten i. */
export interface Strom {
  /** Darcy-hastigheten q = K · i (m/s): vannmengden per areal av hele tverrsnittet. */
  q: number;
  /** Porefarten v = q/nₑ (m/s): hvor fort vannet går i porene. */
  v: number;
}

/** Darcys lov og porefarten i et materiale (uten pumping). Null når farten ikke kan regnes ut. */
export function strom(id: MaterialValg, i = GRADIENT): Strom | null {
  const m = materiale(id);
  const q = darcy(m.K, i);
  if (q === null) return null;
  const v = porefart(q, m.effektivPorositet);
  return v === null ? null : { q, v };
}

/**
 * Hva oppholdstiden betyr for smittestoffene: 'barriere' (løsmasser med minst 60 døgn: grunnen er en hygienisk
 * barriere), 'for-kort' (løsmasser med under 60 døgn) eller 'fjell' (60-døgnskravet gjelder ikke grunnvann i fjell, så
 * brønnen trenger en annen barriere uansett hvor lang den beregnede reisetiden er).
 */
export type BarriereStatus = 'barriere' | 'for-kort' | 'fjell';

/** Om oppholdstiden holder som hygienisk barriere. */
export interface Smittebarriere {
  /** Grunnen regnes som en hygienisk barriere: løsmasser og minst 60 døgn i grunnen. Aldri i fjell. */
  oppfylt: boolean;
  status: BarriereStatus;
  /** Den beregnede reisetiden er minst 60 døgn (også i fjell, der det ikke er nok). */
  langNok: boolean;
  /** Kravet i døgn (60). */
  krav: number;
  /** Reisetiden minus kravet (døgn): positiv = margin, negativ = for kort. */
  margin: number;
}

/**
 * Om reisetiden (døgn) i materialet `valg` oppfyller kravet om minst 60 døgns oppholdstid i grunnen (se kilden ved
 * `KRAV_OPPHOLDSTID_DOGN`). Kravet gjelder løsmasser: i oppsprukket fjell er grunnen aldri en hygienisk barriere ut fra
 * oppholdstiden alene (status 'fjell'), fordi vannet kan gå raskt i noen få åpne sprekker. Null når reisetiden mangler
 * (null, negativ eller ugyldig).
 */
export function smittebarriere(reisetidDogn: number | null, valg: MaterialValg): Smittebarriere | null {
  if (reisetidDogn === null || !Number.isFinite(reisetidDogn) || reisetidDogn < 0) return null;
  const langNok = reisetidDogn >= KRAV_OPPHOLDSTID_DOGN;
  const status: BarriereStatus = valg === 'oppsprukket-fjell' ? 'fjell' : langNok ? 'barriere' : 'for-kort';
  return { oppfylt: status === 'barriere', status, langNok, krav: KRAV_OPPHOLDSTID_DOGN, margin: reisetidDogn - KRAV_OPPHOLDSTID_DOGN };
}

/**
 * Nitratet (mg/l) som når brønnen: nitrat brytes ikke ned i oksygenrikt grunnvann, så det kommer fram uansett hvor lang
 * reisetiden er, bare fortynnet: c₀/fortynning. Fortynning under 1, negativ c₀ eller ugyldige tall gir null.
 */
export function nitratVedBronn(c0: number, fortynning: number): number | null {
  if (!Number.isFinite(c0) || !Number.isFinite(fortynning) || c0 < 0 || fortynning < 1) return null;
  return c0 / fortynning;
}

/** Andelen (0–1) av smittestoffene i et merke som er igjen etter `alder` døgn i grunnen (bare til figuren). */
export function smitteIgjen(alderDogn: number): number {
  if (!Number.isFinite(alderDogn)) return 0;
  return Math.min(1, Math.max(0, 1 - alderDogn / SMITTE_LEVETID_DOGN));
}

// ---------------------------------------------------------------------------------------------------------------------
// Brønnen: senkningstrakt og hvor mye den kan gi

/** Brønnen med en gitt pumperate i et materiale. */
export interface Bronnstatus {
  /** Transmissiviteten T = K · b (m²/s). */
  T: number;
  /** Påvirkningsradien R (m) etter 30 døgns pumping. */
  R: number;
  /** Den største pumperaten (m³/s) som ikke senker vannet i brønnen mer enn `MAKS_SENKNING_M`. */
  Qmaks: number;
  /** Pumperaten eleven ba om (m³/s). */
  Qonsket: number;
  /** Pumperaten brønnen faktisk gir (m³/s): den minste av Qonsket og Qmaks. */
  Q: number;
  /** Senkningen i brønnen (m). */
  senkning: number;
  /** Brønnen klarer ikke å gi det eleven ba om (den ville gått tørr). */
  torr: boolean;
}

/**
 * Brønnen i materialet `id` med pumperaten `qLs` (liter per sekund): transmissivitet, påvirkningsradius (Cooper og
 * Jacob etter 30 døgn), største pumperate, senkningen i brønnen (Thiem) og om den går tørr. Null for ugyldige tall.
 */
export function bronnstatus(id: MaterialValg, qLs: number): Bronnstatus | null {
  if (!Number.isFinite(qLs)) return null;
  const m = materiale(id);
  const T = transmissivitet(m.K, TYKKELSE_M);
  if (T === null || !(T > 0)) return null;
  const R = paavirkningsradius(T, m.effektivPorositet, PUMPETID_DOGN * SEK_PER_DOGN);
  if (R === null || !(R > BRONN_RADIUS_M * 1.01)) return null;
  const Qmaks = (2 * Math.PI * T * MAKS_SENKNING_M) / Math.log(R / BRONN_RADIUS_M);
  if (!Number.isFinite(Qmaks)) return null;
  const Qonsket = Math.max(0, qLs / 1000);
  const Q = Math.min(Qonsket, Qmaks);
  const s = senkning(BRONN_RADIUS_M, Q, T, R, BRONN_RADIUS_M);
  return { T, R, Qmaks, Qonsket, Q, senkning: s ?? 0, torr: Qonsket > Qmaks * (1 + 1e-9) };
}

/** Senkningen (m) av grunnvannsspeilet i avstanden r (m) fra brønnen: størst ved brønnen, 0 ved påvirkningsradien. */
export function senkningVed(b: Bronnstatus, r: number): number {
  return senkning(r, b.Q, b.T, b.R, BRONN_RADIUS_M) ?? 0;
}

// ---------------------------------------------------------------------------------------------------------------------
// Reisetid mot en brønn som pumper

/** Det reisetiden mot brønnen avhenger av. */
export interface Strommodell {
  /** Hydraulisk ledningsevne (m/s). */
  K: number;
  /** Effektiv porøsitet (0–1). */
  ne: number;
  /** Gradienten mot brønnen uten pumping. */
  i: number;
  /** Mettet tykkelse (m). */
  b: number;
  /** Pumperaten (m³/s). */
  Q: number;
  /** Påvirkningsradien (m): utenfor den merkes ikke pumpingen. */
  R: number;
  /** Brønnradien (m). */
  rb: number;
}

/** Strømmodellen for et materiale og en brønn (gradienten mot elva og brønnens pumperate og påvirkningsradius). */
export function strommodell(id: MaterialValg, b: Bronnstatus | null): Strommodell {
  const m = materiale(id);
  return { K: m.K, ne: m.effektivPorositet, i: GRADIENT, b: TYKKELSE_M, Q: b?.Q ?? 0, R: b?.R ?? BRONN_RADIUS_M, rb: BRONN_RADIUS_M };
}

/**
 * Porefarten (m/s) mot brønnen i avstanden r (m) oppstrøms: strømmen mot elva pluss tilstrømningen til brønnen innenfor
 * påvirkningsradien, v = (K · i + Q/(2π b r))/nₑ. Tilstrømningen følger av at hele pumperaten må passere en sylinder med
 * radius r. Null for ugyldige tall.
 */
export function porefartVed(m: Strommodell, r: number): number | null {
  if (![m.K, m.ne, m.i, m.b, m.Q, m.R, r].every(Number.isFinite) || m.ne <= 0 || m.b <= 0) return null;
  const rr = Math.max(m.rb, Math.abs(r));
  const pump = rr < m.R ? m.Q / (2 * Math.PI * m.b * rr) : 0;
  return endelig((m.K * m.i + pump) / m.ne);
}

/** Tida (s) fra avstanden r2 inn til r1 (r1 < r2 ≤ R) med Simpson i ln r, der farten endrer seg raskt nær brønnen. */
function tidInnenfor(m: Strommodell, r1: number, r2: number, n = 120): number {
  if (!(r2 > r1)) return 0;
  const a = m.K * m.i;
  const c = m.Q / (2 * Math.PI * m.b);
  const u1 = Math.log(r1);
  const u2 = Math.log(r2);
  const h = (u2 - u1) / n;
  // dt = nₑ dr / (a + c/r) = nₑ r² du / (a r + c)
  const f = (u: number) => {
    const r = Math.exp(u);
    return (m.ne * r * r) / (a * r + c);
  };
  let sum = f(u1) + f(u2);
  for (let j = 1; j < n; j++) sum += (j % 2 ? 4 : 2) * f(u1 + j * h);
  return (sum * h) / 3;
}

/** Tida (s) fra avstanden r inn til brønnen, eller Infinity når vannet aldri kommer fram. */
function tidTilBronn(m: Strommodell, r: number): number {
  const a = m.K * m.i;
  const c = m.Q / (2 * Math.PI * m.b);
  if (!(a > 0) && !(c > 0)) return Infinity;
  const rr = Math.max(m.rb, r);
  const indre = Math.min(rr, m.R);
  let t = c > 0 ? tidInnenfor(m, m.rb, indre) : (m.ne * (indre - m.rb)) / a;
  if (rr > m.R) t += a > 0 ? (m.ne * (rr - m.R)) / a : Infinity;
  return t;
}

/**
 * Reisetiden (døgn) for vann og smittestoffer fra avstanden L (m) oppstrøms inn til en brønn som pumper: strømmen mot
 * elva og tilstrømningen til brønnen trekker i samme retning, så pumping gir kortere reisetid. Uten pumping er den
 * L/v (minus brønnradien). L ≤ brønnradien gir 0. Null når vannet aldri kommer fram (ingen gradient og ingen pumping
 * eller K = 0) eller for ugyldige tall.
 */
export function reisetidMotBronn(L: number, m: Strommodell): number | null {
  if (!Number.isFinite(L) || ![m.K, m.ne, m.i, m.b, m.Q, m.R, m.rb].every(Number.isFinite) || m.ne <= 0 || m.b <= 0 || m.K < 0 || m.Q < 0) return null;
  if (L <= m.rb) return 0;
  return endelig(tidTilBronn(m, L) / SEK_PER_DOGN);
}

/**
 * Avstanden (m) fra brønnen der reisetiden er `tDogn` døgn (f.eks. 60-døgnsgrensen). Null når vannet aldri kommer fram,
 * når avstanden er større enn `maks` (m) eller for ugyldige tall.
 */
export function avstandForReisetid(tDogn: number, m: Strommodell, maks = 100_000): number | null {
  if (!Number.isFinite(tDogn) || tDogn < 0) return null;
  const mal = tDogn * SEK_PER_DOGN;
  if (mal === 0) return m.rb;
  const tMaks = tidTilBronn(m, maks);
  if (!Number.isFinite(tMaks) || tMaks < mal) return null;
  let lo = Math.log(m.rb);
  let hi = Math.log(maks);
  for (let j = 0; j < 60; j++) {
    const mid = (lo + hi) / 2;
    if (tidTilBronn(m, Math.exp(mid)) < mal) lo = mid;
    else hi = mid;
  }
  return endelig(Math.exp((lo + hi) / 2));
}

/** Tabell over reisetiden til brønnen fra avstander mellom brønnradien og L, til å flytte merker langs veien. */
export interface ReiseTabell {
  /** Avstandene (m), stigende fra brønnradien til L. */
  r: number[];
  /** Tida (døgn) fra hver avstand inn til brønnen. */
  t: number[];
}

/** Lager en `ReiseTabell` fra avstanden L inn til brønnen (n trinn, jevnt i ln r). Null når vannet aldri kommer fram. */
export function reiseTabell(L: number, m: Strommodell, n = 120): ReiseTabell | null {
  const total = reisetidMotBronn(L, m);
  if (total === null || !(L > m.rb)) return null;
  const r: number[] = [];
  const t: number[] = [];
  const u1 = Math.log(m.rb);
  const u2 = Math.log(L);
  let forrige = m.rb;
  let sum = 0;
  for (let j = 0; j <= n; j++) {
    const rj = j === 0 ? m.rb : j === n ? L : Math.exp(u1 + ((u2 - u1) * j) / n);
    if (j > 0) {
      const a = m.K * m.i;
      const c = m.Q / (2 * Math.PI * m.b);
      const inn = Math.min(rj, m.R);
      let dt = 0;
      if (inn > forrige) dt += c > 0 ? tidInnenfor(m, forrige, inn, 8) : (m.ne * (inn - forrige)) / a;
      if (rj > m.R) dt += (m.ne * (rj - Math.max(forrige, m.R))) / a;
      sum += dt / SEK_PER_DOGN;
    }
    r.push(rj);
    t.push(Number.isFinite(sum) ? sum : 0);
    forrige = rj;
  }
  return { r, t };
}

/**
 * Hvor langt (m) fra brønnen et merke er etter `alder` døgn når det startet i enden av tabellen (avstanden L).
 * Gir brønnradien når merket har kommet fram.
 */
export function avstandEtter(tab: ReiseTabell, alderDogn: number): number {
  const n = tab.t.length;
  const total = tab.t[n - 1] ?? 0;
  const rest = total - (Number.isFinite(alderDogn) ? Math.max(0, alderDogn) : 0);
  if (rest <= 0) return tab.r[0] ?? 0;
  if (rest >= total) return tab.r[n - 1] ?? 0;
  let lo = 0;
  let hi = n - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if ((tab.t[mid] ?? 0) <= rest) lo = mid;
    else hi = mid;
  }
  const t0 = tab.t[lo] ?? 0;
  const t1 = tab.t[hi] ?? t0;
  const r0 = tab.r[lo] ?? 0;
  const r1 = tab.r[hi] ?? r0;
  const s = t1 > t0 ? (rest - t0) / (t1 - t0) : 0;
  return Math.exp(Math.log(r0) + s * (Math.log(r1) - Math.log(r0)));
}

// ---------------------------------------------------------------------------------------------------------------------
// Tekst

/** Antall desimaler for to gjeldende siffer (0,17 → 2, 17 → 0). */
function desimaler2(v: number): number {
  if (!(v > 0)) return 0;
  return Math.max(0, 1 - Math.floor(Math.log10(v) + 1e-9));
}

/** To gjeldende siffer, rundet som teksten viser dem (7 649 → 7 600). */
function sig2(v: number): number {
  if (!(v > 0)) return 0;
  const e = Math.floor(Math.log10(v) + 1e-9) - 1;
  return Math.round(v / 10 ** e) * 10 ** e;
}

/**
 * Fart (m/s) i en enhet eleven kjenner: «17 m/døgn», «0,17 m/døgn», «2,0 m/år», «7,9 mm/år». Ugyldige tall gir «–»,
 * og 0 gir «0 m/døgn».
 */
export function fmtFart(v: number | null): string {
  if (v === null || !Number.isFinite(v) || v < 0) return '–';
  if (v === 0) return '0 m/døgn';
  const perDogn = v * SEK_PER_DOGN;
  if (perDogn >= 0.1) return `${fmt(sig2(perDogn), desimaler2(perDogn))} m/døgn`;
  const perAar = v * SEK_PER_AAR;
  if (perAar >= 1) return `${fmt(sig2(perAar), desimaler2(perAar))} m/år`;
  if (perAar >= 0.01) return `${fmt(sig2(perAar * 100), desimaler2(perAar * 100))} cm/år`;
  return `${fmt(sig2(perAar * 1000), desimaler2(perAar * 1000))} mm/år`;
}

/**
 * En varighet i døgn som tekst: «1,2 døgn», «88 døgn», «3,4 år», «7 600 år». Over to år skrives den i år. Null og
 * ugyldige tall gir «–».
 */
export function fmtVarighet(dogn: number | null): string {
  if (dogn === null || !Number.isFinite(dogn) || dogn < 0) return '–';
  if (dogn < 10) return `${fmt(dogn, 1)} døgn`;
  if (dogn < 730) return `${fmt(dogn, 0)} døgn`;
  const aar = (dogn * SEK_PER_DOGN) / SEK_PER_AAR;
  if (aar < 10) return `${fmt(aar, 1)} år`;
  if (aar < 1000) return `${fmt(aar, 0)} år`;
  return `${fmt(sig2(aar), 0)} år`;
}

/** Pumperate (m³/s) i liter per sekund: «5 l/s», «0,25 l/s», «0,0005 l/s». */
export function fmtLs(Q: number): string {
  if (!Number.isFinite(Q) || Q < 0) return '–';
  const ls = Q * 1000;
  if (ls === 0) return '0 l/s';
  if (ls >= 1) return `${fmt(ls, Number.isInteger(Math.round(ls * 10) / 10) ? 0 : 1)} l/s`;
  return `${fmt(sig2(ls), desimaler2(ls))} l/s`;
}

/** Avstand i m eller km: «60 m», «1,0 km», «12 km». */
export function fmtAvstand(m: number | null): string {
  if (m === null || !Number.isFinite(m) || m < 0) return '–';
  if (m < 1000) return `${fmt(m < 100 ? m : sig2(m), 0)} m`;
  const km = m / 1000;
  return `${fmt(sig2(km), desimaler2(km))} km`;
}
