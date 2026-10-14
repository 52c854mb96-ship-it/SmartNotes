/**
 * Fare og risiko i geofag: sikkerhetsklassene for flom (F1–F3) og skred (S1–S3) i byggteknisk forskrift (TEK17 § 7-2 og
 * § 7-3), om et bygg på en tomt i en faresone oppfyller kravet, forventet årlig skade (sannsynlighet × konsekvens) og en
 * enkel risikomatrise. Kvikkleire holdes utenfor de årlige klassene: der kreves geoteknisk utredning og dokumentert
 * stabilitet (NVEs veileder 1/2019), aldri en årlig sannsynlighet. Ren logikk uten React.
 *
 * Fare = hvor sannsynlig en hendelse er (sonen på kartet). Risiko = fare × konsekvens (hva som står der, og hvor mye
 * som går tapt).
 *
 *   oppfyller('bolig', { fare: 'skred', aarlig: 1 / 100 })   // false: S2 krever under 1/1000
 *   oppfyller('bolig', { fare: 'flom', aarlig: 1 / 1000 })   // true: utenfor 200-årsflommen
 *   oppfyller('bolig', { fare: 'kvikkleire' })               // null: geoteknisk utredning kreves
 *   risikoklasse(1 / 100, 4)?.navn                           // 'høy risiko'
 */

/** Faretypene i byggteknisk forskrift med årlige sikkerhetsklasser. */
export type Faretype = 'flom' | 'skred';

/** Konsekvensen i sikkerhetsklassene. */
export type Konsekvens = 'liten' | 'middels' | 'stor';

/** Sikkerhetsklassene for flom (F1–F3) og skred (S1–S3). */
export type SikkerhetsklasseId = 'F1' | 'F2' | 'F3' | 'S1' | 'S2' | 'S3';

/** Én sikkerhetsklasse. */
export interface Sikkerhetsklasse {
  id: SikkerhetsklasseId;
  fare: Faretype;
  konsekvens: Konsekvens;
  /** Største nominelle årlige sannsynlighet som er tillatt (1/20 …). */
  maksAarlig: number;
  /** Det samme som gjentaksintervall i år (20 …): bygget skal tåle en «T-årsflom». */
  gjentaksintervall: number;
  /** Eksempler på byggverk i klassen, som i veiledningen. */
  eksempler: string;
}

/*
 * Kilde: byggteknisk forskrift (TEK17) § 7-2 (flom og stormflo) og § 7-3 (skred), med veiledningen fra Direktoratet
 * for byggkvalitet (DiBK), lest oktober 2026:
 * - Flom: F1 liten konsekvens 1/20 (garasjer, lagerbygninger med lite personopphold), F2 middels 1/200 (boliger, hytter,
 *   kontorer, skoler, barnehager, industribygg), F3 stor 1/1000 (byggverk for særlig sårbare grupper, f.eks. sykehjem,
 *   og beredskapsfunksjoner og kritisk infrastruktur).
 * - Skred: S1 liten 1/100 (byggverk der personer normalt ikke oppholder seg: garasjer, uthus), S2 middels 1/1000
 *   (normalt opphold av inntil 25 personer, boliger med inntil 10 boenheter), S3 stor 1/5000 (flere enn 25 personer,
 *   boliger med flere enn 10 boenheter, skoler, barnehager og sykehjem).
 * - Første ledd i begge paragrafene: byggverk der konsekvensen er særlig stor (f.eks. regionsykehus og regionale eller
 *   nasjonale beredskapsinstitusjoner), skal ikke plasseres i fareområdet i det hele tatt.
 * Byggtypene i `BYGGTYPER` er forenklet etter disse eksemplene; i en ekte sak avgjør kommunen klassen.
 */
/** Sikkerhetsklassene i TEK17 § 7-2 (flom) og § 7-3 (skred). */
export const SIKKERHETSKLASSER: Readonly<Record<SikkerhetsklasseId, Sikkerhetsklasse>> = {
  F1: { id: 'F1', fare: 'flom', konsekvens: 'liten', maksAarlig: 1 / 20, gjentaksintervall: 20, eksempler: 'garasjer og lagerbygninger med lite personopphold' },
  F2: { id: 'F2', fare: 'flom', konsekvens: 'middels', maksAarlig: 1 / 200, gjentaksintervall: 200, eksempler: 'boliger, hytter, kontorer, skoler, barnehager og industribygg' },
  F3: { id: 'F3', fare: 'flom', konsekvens: 'stor', maksAarlig: 1 / 1000, gjentaksintervall: 1000, eksempler: 'byggverk for særlig sårbare grupper, f.eks. sykehjem, og beredskap og kritisk infrastruktur' },
  S1: { id: 'S1', fare: 'skred', konsekvens: 'liten', maksAarlig: 1 / 100, gjentaksintervall: 100, eksempler: 'byggverk der personer normalt ikke oppholder seg, f.eks. garasjer og uthus' },
  S2: { id: 'S2', fare: 'skred', konsekvens: 'middels', maksAarlig: 1 / 1000, gjentaksintervall: 1000, eksempler: 'boliger med inntil 10 boenheter og bygg for inntil 25 personer' },
  S3: { id: 'S3', fare: 'skred', konsekvens: 'stor', maksAarlig: 1 / 5000, gjentaksintervall: 5000, eksempler: 'boliger med flere enn 10 boenheter, bygg for flere enn 25 personer, skoler, barnehager og sykehjem' },
};

/** Byggtypene i risikovisualiseringene. */
export type ByggtypeId = 'garasje' | 'hytte' | 'bolig' | 'boligblokk' | 'skole' | 'sykehjem' | 'beredskap';

/** Én byggtype med sikkerhetsklasse for flom og skred. */
export interface Byggtype {
  id: ByggtypeId;
  /** «bolig» (løpende tekst). */
  navn: string;
  /** Med ubestemt artikkel: «en bolig», «et sykehjem». */
  ubestemt: string;
  /** Klassen for flom, eller null når bygget ikke skal stå i flomutsatt område i det hele tatt. */
  flom: 'F1' | 'F2' | 'F3' | null;
  /** Klassen for skred, eller null når bygget ikke skal stå i skredfareområde i det hele tatt. */
  skred: 'S1' | 'S2' | 'S3' | null;
}

/** Byggtypene, forenklet etter veiledningen til TEK17 (se kilden over `SIKKERHETSKLASSER`). */
export const BYGGTYPER: Readonly<Record<ByggtypeId, Byggtype>> = {
  garasje: { id: 'garasje', navn: 'garasje', ubestemt: 'en garasje', flom: 'F1', skred: 'S1' },
  hytte: { id: 'hytte', navn: 'hytte', ubestemt: 'en hytte', flom: 'F2', skred: 'S2' },
  bolig: { id: 'bolig', navn: 'bolig', ubestemt: 'en bolig', flom: 'F2', skred: 'S2' },
  boligblokk: { id: 'boligblokk', navn: 'boligblokk med flere enn 10 boenheter', ubestemt: 'en boligblokk med flere enn 10 boenheter', flom: 'F2', skred: 'S3' },
  skole: { id: 'skole', navn: 'skole', ubestemt: 'en skole', flom: 'F2', skred: 'S3' },
  sykehjem: { id: 'sykehjem', navn: 'sykehjem', ubestemt: 'et sykehjem', flom: 'F3', skred: 'S3' },
  beredskap: { id: 'beredskap', navn: 'regional beredskapsinstitusjon', ubestemt: 'en regional beredskapsinstitusjon', flom: null, skred: null },
};

/** Alle byggtypene i fast rekkefølge (til Select). */
export const BYGGTYPE_IDS: readonly ByggtypeId[] = ['garasje', 'hytte', 'bolig', 'boligblokk', 'skole', 'sykehjem', 'beredskap'];

/**
 * Sikkerhetsklassen en byggtype må oppfylle for en faretype, eller null når bygget ikke skal stå i fareområdet i det
 * hele tatt (første ledd i § 7-2 og § 7-3).
 *
 * @param bygg Byggtypen.
 * @param fare `'flom'` eller `'skred'`.
 */
export function sikkerhetsklasse(bygg: ByggtypeId, fare: Faretype): Sikkerhetsklasse | null {
  const id = BYGGTYPER[bygg][fare];
  return id ? SIKKERHETSKLASSER[id] : null;
}

/*
 * Faresonene på kartene (NVE): flomsoner for 20-, 200- og 1000-årsflom og skredfaresoner for 1/100, 1/1000 og 1/5000.
 */
/** De årlige sannsynlighetene faresonene tegnes for, fra mest til minst sannsynlig. */
export const FARESONER: readonly number[] = [1 / 20, 1 / 100, 1 / 200, 1 / 1000, 1 / 5000];

/**
 * En faresone på et kart: tomta ligger innenfor sonen med denne årlige sannsynligheten (og utenfor alle soner med høyere
 * sannsynlighet), eller i et område med kvikkleire, der det ikke gis noen årlig sannsynlighet.
 */
export type Faresone = { fare: Faretype; aarlig: number } | { fare: 'kvikkleire' };

/**
 * Om et bygg på en tomt oppfyller kravet i byggteknisk forskrift. En sone med årlig sannsynlighet p dekker området der
 * sannsynligheten er p eller høyere, så kravet er oppfylt bare når p er mindre enn klassens grense: en bolig (S2,
 * 1/1000) i 1/100-sonen for skred oppfyller ikke kravet, men i 1/5000-sonen gjør den det. `null` som sone betyr at tomta
 * ligger utenfor alle soner (oppfylt). Kvikkleire gir null: det kreves geoteknisk utredning og dokumentert stabilitet,
 * ikke en årlig sannsynlighet. Et bygg som ikke skal stå i fareområdet (beredskap), oppfyller aldri kravet i en sone.
 *
 * @param bygg Byggtypen.
 * @param sone Sonen tomta ligger i, eller null.
 */
export function oppfyller(bygg: ByggtypeId, sone: Faresone | null): boolean | null {
  if (sone === null) return true;
  if (sone.fare === 'kvikkleire') return null;
  if (!Number.isFinite(sone.aarlig) || sone.aarlig < 0) return null;
  if (sone.aarlig === 0) return true;
  const klasse = sikkerhetsklasse(bygg, sone.fare);
  if (!klasse) return false;
  return sone.aarlig < klasse.maksAarlig;
}

/** Hva en tomt krever for et bygg: resultatet av `vurderTomt`. */
export interface Tomtevurdering {
  /** `'ok'`, `'ikke-ok'` (kravet er ikke oppfylt), `'ikke-tillatt'` (bygget skal ikke stå i fareområdet) eller `'utredning'` (kvikkleire). */
  status: 'ok' | 'ikke-ok' | 'ikke-tillatt' | 'utredning';
  /** Klassene som ble sjekket (én per faretype tomta ligger i en sone for). */
  klasser: SikkerhetsklasseId[];
  /** Kort forklaring på bokmål til Readouts. */
  tekst: string;
}

/** Teksten for tomter med kvikkleire (NVEs veileder 1/2019). */
export const KVIKKLEIRE_KRAV =
  'Kvikkleire: det kreves geoteknisk utredning og dokumentert stabilitet før det kan bygges, eventuelt med sikring som erosjonssikring eller motfylling.';

/**
 * Vurderer et bygg på en tomt som kan ligge i flere soner samtidig (f.eks. både flom og kvikkleire). Kvikkleire gir alltid
 * `'utredning'`, og et bygg som ikke skal stå i fareområdet gir `'ikke-tillatt'`. Ellers `'ok'` når alle kravene er
 * oppfylt.
 *
 * @param bygg Byggtypen.
 * @param soner Sonene tomta ligger i (tom liste = utenfor alle soner).
 */
export function vurderTomt(bygg: ByggtypeId, soner: readonly Faresone[]): Tomtevurdering {
  const klasser: SikkerhetsklasseId[] = [];
  const navn = BYGGTYPER[bygg].ubestemt;
  if (soner.some((s) => s.fare === 'kvikkleire')) return { status: 'utredning', klasser, tekst: KVIKKLEIRE_KRAV };
  let ok = true;
  for (const s of soner) {
    if (s.fare === 'kvikkleire') continue;
    if (!(s.aarlig > 0)) continue;
    const k = sikkerhetsklasse(bygg, s.fare);
    if (!k) {
      const omraade = s.fare === 'flom' ? 'flomutsatt område' : 'skredfareområde';
      return { status: 'ikke-tillatt', klasser, tekst: `${stor(navn)} skal ikke plasseres i ${omraade} i det hele tatt.` };
    }
    klasser.push(k.id);
    if (!(s.aarlig < k.maksAarlig)) ok = false;
  }
  if (klasser.length === 0) return { status: 'ok', klasser, tekst: `Tomta ligger utenfor faresonene, så ${navn} kan bygges her.` };
  const krav = klasser.map((id) => `${id} (under 1/${SIKKERHETSKLASSER[id].gjentaksintervall} per år)`).join(' og ');
  return ok
    ? { status: 'ok', klasser, tekst: `Kravet ${krav} er oppfylt.` }
    : { status: 'ikke-ok', klasser, tekst: `Kravet ${krav} er ikke oppfylt.` };
}

function stor(tekst: string): string {
  return tekst.charAt(0).toUpperCase() + tekst.slice(1);
}

/** Én mulig hendelse i et risikoregnskap. */
export interface Skadehendelse {
  /** Årlig sannsynlighet (0–1). */
  aarlig: number;
  /** Konsekvensen, f.eks. skade i kroner. */
  konsekvens: number;
}

/**
 * Forventet årlig skade: summen av sannsynlighet × konsekvens for hendelsene (f.eks. 1/200 · 2 millioner kr = 10 000 kr
 * per år). Ingen bygg (tom liste) gir 0. Ugyldige tall eller sannsynlighet utenfor 0–1 gir null.
 *
 * @param hendelser Hendelsene med årlig sannsynlighet og konsekvens.
 */
export function forventetSkade(hendelser: readonly Skadehendelse[]): number | null {
  let sum = 0;
  for (const h of hendelser) {
    if (!Number.isFinite(h.aarlig) || !Number.isFinite(h.konsekvens) || h.aarlig < 0 || h.aarlig > 1 || h.konsekvens < 0) return null;
    sum += h.aarlig * h.konsekvens;
  }
  return Number.isFinite(sum) ? sum : null;
}

/**
 * Faregraden 0–3 for en årlig sannsynlighet, til fargene `GEO.fare[0..3]`/`fareFarge`: 3 fra 1/20, 2 fra 1/200, 1 fra
 * 1/1000, ellers 0. Ugyldige tall gir null.
 *
 * @param aarlig Årlig sannsynlighet.
 */
export function fareniva(aarlig: number): 0 | 1 | 2 | 3 | null {
  if (!Number.isFinite(aarlig) || aarlig < 0 || aarlig > 1) return null;
  if (aarlig >= 1 / 20) return 3;
  if (aarlig >= 1 / 200) return 2;
  if (aarlig >= 1 / 1000) return 1;
  return 0;
}

/** Trinnene i risikomatrisen: 1 (lavest) til 5. */
export type RisikoTrinn = 1 | 2 | 3 | 4 | 5;

/** Navnene på sannsynlighetstrinnene (indeks = trinn − 1). */
export const SANNSYNLIGHETSTRINN: readonly string[] = ['svært lite sannsynlig', 'lite sannsynlig', 'mulig', 'sannsynlig', 'svært sannsynlig'];

/** Navnene på konsekvenstrinnene (indeks = trinn − 1). */
export const KONSEKVENSTRINN: readonly string[] = ['ubetydelig', 'liten', 'middels', 'stor', 'svært stor'];

/*
 * Risikomatrisen er en forenklet 5 × 5-matrise som i kommunale risiko- og sårbarhetsanalyser (DSBs veileder for
 * helhetlig ROS-analyse i kommunen). Trinngrensene for sannsynlighet følger faresonene (1/20, 1/100, 1/1000, 1/5000), og
 * grensene for lav, middels og høy risiko er SmartNotes' egne.
 */
/**
 * Sannsynlighetstrinnet (1–5) for en årlig sannsynlighet: 5 fra 1/20, 4 fra 1/100, 3 fra 1/1000, 2 fra 1/5000, ellers 1.
 * Ugyldige tall gir null.
 *
 * @param aarlig Årlig sannsynlighet (0–1).
 */
export function sannsynlighetstrinn(aarlig: number): RisikoTrinn | null {
  if (!Number.isFinite(aarlig) || aarlig < 0 || aarlig > 1) return null;
  if (aarlig >= 1 / 20) return 5;
  if (aarlig >= 1 / 100) return 4;
  if (aarlig >= 1 / 1000) return 3;
  if (aarlig >= 1 / 5000) return 2;
  return 1;
}

/** En rute i risikomatrisen: resultatet av `risikoklasse`. */
export interface Risiko {
  /** `'lav'`, `'middels'` eller `'hoy'`. */
  klasse: 'lav' | 'middels' | 'hoy';
  /** «høy risiko». */
  navn: string;
  /** Sannsynlighetstrinn × konsekvenstrinn (1–25). */
  poeng: number;
  sannsynlighet: RisikoTrinn;
  konsekvens: RisikoTrinn;
  /** Faregraden som passer til fargen: `fareFarge(fargeNiva)` (lav 0, middels 2, høy 3). */
  fargeNiva: 0 | 2 | 3;
}

/**
 * Risikoen i en enkel 5 × 5-risikomatrise: sannsynlighetstrinnet (fra den årlige sannsynligheten) ganget med
 * konsekvenstrinnet 1–5. Lav under 5 poeng, middels 5–9, høy fra 10. Risikoen øker aldri når en av faktorene minker.
 * Ugyldig sannsynlighet eller konsekvens utenfor 1–5 gir null.
 *
 * @param aarlig Årlig sannsynlighet (0–1).
 * @param konsekvens Konsekvenstrinn 1 (ubetydelig) til 5 (svært stor); desimaler rundes av.
 */
export function risikoklasse(aarlig: number, konsekvens: number): Risiko | null {
  const s = sannsynlighetstrinn(aarlig);
  if (s === null || !Number.isFinite(konsekvens)) return null;
  const k = Math.round(konsekvens);
  if (k < 1 || k > 5) return null;
  const poeng = s * k;
  const klasse = poeng >= 10 ? 'hoy' : poeng >= 5 ? 'middels' : 'lav';
  const navn = klasse === 'hoy' ? 'høy risiko' : klasse === 'middels' ? 'middels risiko' : 'lav risiko';
  return { klasse, navn, poeng, sannsynlighet: s, konsekvens: k as RisikoTrinn, fargeNiva: klasse === 'hoy' ? 3 : klasse === 'middels' ? 2 : 0 };
}

/*
 * Kvikkleire: NGF melding 2 og NVEs veileder 1/2019 («Sikkerhet mot kvikkleireskred»): kvikkleire har omrørt
 * skjærfasthet under 0,5 kPa; materialer med sprøbruddegenskaper har omrørt skjærfasthet under 2 kPa (og høy
 * sensitivitet). Kravet er dokumentert stabilitet (sikkerhetsfaktor), ikke en årlig sannsynlighet.
 */
/** Grensen for kvikkleire: omrørt skjærfasthet under 0,5 kPa. */
export const KVIKKLEIRE_GRENSE_KPA = 0.5;
/** Grensen for sprøbruddmateriale: omrørt skjærfasthet under 2 kPa. */
export const SPROBRUDD_GRENSE_KPA = 2;

/** Resultatet av `vurderLeire`. */
export interface Leirevurdering {
  /** Omrørt skjærfasthet under 0,5 kPa. */
  kvikk: boolean;
  /** Omrørt skjærfasthet under 2 kPa (sprøbruddmateriale; kvikkleire er også det). */
  sprobrudd: boolean;
  /** Kort forklaring. */
  tekst: string;
}

/**
 * Om leira er kvikk (omrørt skjærfasthet under 0,5 kPa) eller sprøbruddmateriale (under 2 kPa), etter NVE og NGF. I
 * begge tilfellene kreves geoteknisk utredning og dokumentert stabilitet før det bygges. Ugyldig eller negativ verdi gir
 * null.
 *
 * @param omrortKPa Omrørt skjærfasthet i kPa (fra grunnboring).
 */
export function vurderLeire(omrortKPa: number): Leirevurdering | null {
  if (!Number.isFinite(omrortKPa) || omrortKPa < 0) return null;
  const kvikk = omrortKPa < KVIKKLEIRE_GRENSE_KPA;
  const sprobrudd = omrortKPa < SPROBRUDD_GRENSE_KPA;
  const tekst = kvikk
    ? 'Kvikkleire: leira blir flytende når den omrøres. ' + KVIKKLEIRE_KRAV
    : sprobrudd
      ? 'Sprøbruddmateriale: leira mister mye av styrken når den omrøres. Det kreves geoteknisk utredning og dokumentert stabilitet.'
      : 'Ikke kvikk: leira beholder styrken når den omrøres.';
  return { kvikk, sprobrudd, tekst };
}
