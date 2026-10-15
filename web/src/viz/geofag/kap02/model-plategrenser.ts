/**
 * Modellen bak «Platene beveger seg: rygg, grop og fjellkjede» (k2-plategrenser): hvor langt platene flytter seg,
 * havbunnens alder og dyp, de magnetiske stripene, hvor dypt jordskjelvene skjer, hvor mantelen smelter, plata i en
 * subduksjonssone (i målestokk), fjellkjeden ved en kollisjon og fakta om hver type plategrense.
 *
 * Ren logikk uten React. Ugyldige tall gir null (eller en tom liste), aldri NaN eller Infinity. Kurvene for
 * smeltepunkt og temperatur er forenklede og omtrentlige; kilden står ved hver tabell.
 */
import { MAGNETISK_POLARITET, TETTHETER, havbunnsalder, seededRandom, type PlategrenseType, type PolaritetsIntervall, type SubduksjonVariant } from '../kit';

const ok = (...v: number[]): boolean => v.every(Number.isFinite);
const klemme = (v: number, a: number, b: number): number => Math.min(b, Math.max(a, v));

/* =====================================================================================================================
 * Platebevegelse og havbunnens alder
 * ================================================================================================================== */

/** 1 cm per år er 10 km per million år (1 cm · 1 000 000 = 10 km). */
export const KM_PER_MA = 10;

/**
 * Hvor langt (km) en plate med fart `v` (cm per år) flytter seg på `t` millioner år: s = v · t, der 1 cm/år =
 * 10 km per million år. 2 cm/år i 100 millioner år gir 2000 km. Null for negative eller ugyldige tall.
 */
export function plateavstand(v: number, t: number): number | null {
  if (!ok(v, t) || v < 0 || t < 0) return null;
  return v * t * KM_PER_MA;
}

/*
 * Havbunnens alder: bruk kit-ets `havbunnsalder(avstand, spredningsfart)`. Alle funksjonene her tar den fulle
 * spredningsfarten (cm per år mellom platene, som `Plategrense.fart` og `magnetiskeStriper`); hver plate flytter seg
 * med halvparten.
 */

/** Havdypet over ryggen (m) i dybdemodellen. */
export const RYGG_DYP = 2500;
/** Hvor raskt havbunnen synker: meter per kvadratrot av alderen i millioner år. */
export const DYP_KOEFFISIENT = 350;
/** Alderen (millioner år) der kvadratrotloven slutter å gjelde og havbunnen flater ut. */
export const DYP_KNEKK = 70;
/** Dypet (m) havbunnen nærmer seg når den blir svært gammel. */
export const DYP_MAKS = 6400;

/**
 * Havdypet (m) over havbunn som er `alder` millioner år gammel: d = 2500 + 350 · √alder fram til ca. 70 millioner
 * år, og deretter en kurve som flater ut mot ca. 6400 m (samme helning i knekkpunktet, så kurven er glatt). Havbunnen
 * synker fordi plata blir kaldere, tettere og tykkere med alderen. Ved ryggen 2500 m, ved 50 millioner år ca. 5000 m.
 * Null for negative og ugyldige aldre.
 *
 * Kilde: Parsons og Sclater (1977), «An analysis of the variation of ocean floor bathymetry and heat flow with age»,
 * J. Geophys. Res. 82: d = 2500 + 350 √t m for t < 70 millioner år, og d nærmer seg 6400 m for gammel havbunn.
 * Utflatingen her er forenklet (eksponentiell med samme helning ved 70 millioner år), så den er omtrentlig.
 */
export function havdybde(alder: number): number | null {
  if (!ok(alder) || alder < 0) return null;
  if (alder <= DYP_KNEKK) return RYGG_DYP + DYP_KOEFFISIENT * Math.sqrt(alder);
  const d70 = RYGG_DYP + DYP_KOEFFISIENT * Math.sqrt(DYP_KNEKK);
  const helning = DYP_KOEFFISIENT / (2 * Math.sqrt(DYP_KNEKK));
  const tau = (DYP_MAKS - d70) / helning;
  return DYP_MAKS - (DYP_MAKS - d70) * Math.exp(-(alder - DYP_KNEKK) / tau);
}

/**
 * Havdypet (m) `x` km fra ryggen når platene sprer seg med `spredningsfart` cm per år (full fart, hver plate flytter
 * seg med halvparten). Null som kit-ets `havbunnsalder`.
 */
export function havdybdeVed(x: number, spredningsfart: number): number | null {
  const a = havbunnsalder(x, spredningsfart);
  return a === null ? null : havdybde(a);
}

/* =====================================================================================================================
 * Magnetiske striper (de siste 5 millioner årene)
 * ================================================================================================================== */

/** Hvor langt tilbake (millioner år) stripene i visualiseringen går. Eldre havbunn tegnes uten striper. */
export const STRIPER_MAKS = 5;

/**
 * Jordas magnetfelt de siste 5 millioner årene: intervaller med normal (som i dag) og omvendt polaritet, yngst
 * først. Grensen Brunhes–Matuyama (det siste skiftet) er 0,781 millioner år siden.
 *
 * Kilde: kit-ets `MAGNETISK_POLARITET` (den astronomisk kalibrerte polaritetsskalaen ATNTS2004, Lourens mfl. 2004,
 * som Geologic Time Scale 2012 bruker), kuttet ved 5 millioner år.
 */
export const POLARITET: readonly PolaritetsIntervall[] = MAGNETISK_POLARITET.filter((p) => p.fra < STRIPER_MAKS).map((p) => ({
  ...p,
  til: Math.min(p.til, STRIPER_MAKS),
}));

/** Polariteten for en alder (millioner år): true = normal, false = omvendt, null utenfor 0–5 millioner år. */
export function polaritet(alder: number): boolean | null {
  if (!ok(alder) || alder < 0 || alder >= STRIPER_MAKS) return null;
  const p = POLARITET.find((q) => alder >= q.fra && alder < q.til);
  return p ? p.normal : null;
}

/** Én magnetisk stripe på havbunnen. */
export interface Stripe {
  /** Avstand fra ryggen (km) med fortegn, fra < til (venstre side har negative tall). */
  fra: number;
  til: number;
  normal: boolean;
  /** Kronen eller episoden stripa ble dannet i: «Brunhes», «Jaramillo» … */
  navn: string;
  /** Alderen på havbunnen i stripa (millioner år), yngst først. */
  alderFra: number;
  alderTil: number;
}

/**
 * De magnetiske stripene på begge sider av ryggen slik havbunnen ser ut i dag, for havbunn som er inntil `tMax`
 * millioner år gammel (høyst 5). `spredningsfart` er den fulle farten mellom platene (cm per år, som
 * `magnetiskeStriper` i kit-et): hver side flytter seg med halvparten, så hver stripe er spredningsfart/2 · varighet
 * · 10 km bred, og stripene på venstre side speiler dem på høyre. Eldre havbunn får ingen striper her (tom utenfor 5
 * millioner år). Tom liste når farten eller `tMax` er 0, negativ eller ugyldig.
 */
export function striper(spredningsfart: number, tMax: number = STRIPER_MAKS): Stripe[] {
  if (!ok(spredningsfart, tMax) || spredningsfart <= 0 || tMax <= 0) return [];
  const T = Math.min(tMax, STRIPER_MAKS);
  const kmPerMa = (spredningsfart / 2) * KM_PER_MA;
  const ut: Stripe[] = [];
  for (const p of POLARITET) {
    if (p.fra >= T) break;
    const a = p.fra * kmPerMa;
    const b = Math.min(p.til, T) * kmPerMa;
    if (!(b > a)) continue;
    const felles = { normal: p.normal, navn: p.navn, alderFra: p.fra, alderTil: Math.min(p.til, T) };
    ut.push({ fra: a, til: b, ...felles }, { fra: -b, til: -a, ...felles });
  }
  return ut;
}

/**
 * Stripa havbunnen `x` km fra ryggen ligger i (dagens mønster, full `spredningsfart` som i `striper`), eller null når
 * havbunnen er eldre enn 5 millioner år.
 */
export function stripeVed(x: number, spredningsfart: number): Stripe | null {
  if (!ok(x, spredningsfart)) return null;
  return striper(spredningsfart).find((s) => x >= s.fra && x < s.til) ?? null;
}

/* =====================================================================================================================
 * Jordskjelv
 * ================================================================================================================== */

export type SkjelvKlasse = 'grunne' | 'middels' | 'dype';

/**
 * Jordskjelv etter dyp: grunne (0–70 km), middels dype (70–300 km) og dype (300–700 km).
 * Kilde: den vanlige inndelingen i seismologien (f.eks. USGS: shallow, intermediate og deep earthquakes).
 */
export const SKJELV_KLASSER: readonly { id: SkjelvKlasse; navn: string; fra: number; til: number }[] = [
  { id: 'grunne', navn: 'grunne', fra: 0, til: 70 },
  { id: 'middels', navn: 'middels dype', fra: 70, til: 300 },
  { id: 'dype', navn: 'dype', fra: 300, til: 700 },
];

/** Hvor dypt jordskjelvene skjer ved en type plategrense. */
export interface Skjelvdyp {
  /** De dypeste skjelvene (km, omtrent). */
  maks: number;
  /** Der de fleste skjer (km, omtrent). */
  typisk: number;
  /** Klassene skjelvene faller i. */
  klasser: readonly SkjelvKlasse[];
  /** Kort tekst til forklaringen. */
  tekst: string;
}

/**
 * Hvor dypt jordskjelvene skjer ved hver type (omtrentlige, avrundede verdier). Bare i subduksjonssoner går de
 * dypere enn ca. 100 km, langs den skrå sonen i plata som går ned (Wadati–Benioff-sonen), helt ned til ca. 700 km.
 * Kilde: lærebokverdier og USGS: skjelv ved midthavsrygger er grunne (mest under 10 km), ved transformforkastninger
 * under ca. 20 km, og de dypeste skjelvene i subduksjonssoner er ca. 700 km. Ved Hawaii skjer noen skjelv på ca. 40 km
 * dyp (f.eks. Kiholo Bay 2006), der vekten av øya bøyer plata.
 */
const SKJELVDYP: Readonly<Record<PlategrenseType, Skjelvdyp>> = {
  spredning: { maks: 10, typisk: 5, klasser: ['grunne'], tekst: 'grunne, mest under 10 km dyp' },
  subduksjon: {
    maks: 700,
    typisk: 40,
    klasser: ['grunne', 'middels', 'dype'],
    tekst: 'fra grunne ved havgropa til ca. 700 km dyp langs den skrå sonen i plata',
  },
  kollisjon: { maks: 100, typisk: 20, klasser: ['grunne', 'middels'], tekst: 'mest grunne (i skorpa), noen ned mot ca. 100 km under fjellkjeden' },
  transform: { maks: 20, typisk: 10, klasser: ['grunne'], tekst: 'grunne, mest under 20 km dyp, men de kan bli kraftige' },
  'varmt-punkt': { maks: 40, typisk: 10, klasser: ['grunne'], tekst: 'mest grunne ved vulkanen, noen ned mot ca. 40 km der vekten av øya bøyer plata' },
};

/** Hvor dypt jordskjelvene skjer ved en type plategrense (se `SKJELVDYP`). Ukjent type gir spredning. */
export function skjelvdybder(type: PlategrenseType): Skjelvdyp {
  return SKJELVDYP[type] ?? SKJELVDYP.spredning;
}

/** Klassen et skjelv på `dyp` km hører til, eller null utenfor 0–700 km. */
export function skjelvKlasse(dyp: number): SkjelvKlasse | null {
  if (!ok(dyp) || dyp < 0 || dyp > 700) return null;
  return dyp < 70 ? 'grunne' : dyp < 300 ? 'middels' : 'dype';
}

/* =====================================================================================================================
 * Hvor smelter mantelen? Smeltepunkt (solidus) og temperatur mot dypet
 * ================================================================================================================== */

/** Trykket (GPa) ved et dyp (km) i mantelen: p = ρ g z med ρ = 3,3 g/cm³ og g = 9,81 m/s² (ca. 1 GPa per 31 km). */
export function trykk(z: number): number | null {
  if (!ok(z) || z < 0) return null;
  return (3300 * 9.81 * z * 1000) / 1e9;
}

/**
 * Vannmettet (våt) solidus for peridotitt: dyp (km) og temperatur (°C). Omtrentlige, forenklede verdier: med vann
 * begynner mantelen å smelte ved ca. 800–1000 °C, flere hundre grader lavere enn uten vann.
 * Kilde: forenklet etter Grove mfl. (2006), «The influence of H₂O on mantle wedge melting», Earth Planet. Sci. Lett.
 * 249, og Kawamoto og Holloway (1997); målingene spriker, så kurven er avrundet.
 */
const VAAT_SOLIDUS: readonly (readonly [number, number])[] = [
  [0, 1050],
  [30, 1000],
  [60, 930],
  [100, 850],
  [150, 820],
  [200, 840],
  [300, 900],
];

function interp(tabell: readonly (readonly [number, number])[], x: number): number {
  const forste = tabell[0]!;
  const siste = tabell[tabell.length - 1]!;
  if (x <= forste[0]) return forste[1];
  if (x >= siste[0]) return siste[1];
  for (let i = 1; i < tabell.length; i++) {
    const [x1, y1] = tabell[i]!;
    const [x0, y0] = tabell[i - 1]!;
    if (x <= x1) return y0 + ((y1 - y0) * (x - x0)) / (x1 - x0);
  }
  return siste[1];
}

/**
 * Smeltepunktet (solidus, °C) til mantelstein (peridotitt) ved et dyp `z` (km): temperaturen der den første smelten
 * dannes. Uten vann (`vann` = false) stiger det med trykket, fra ca. 1120 °C ved overflaten til ca. 1500 °C ved
 * 100 km (p ≈ 3,2 GPa). Med vann (`vann` = true) ligger det flere hundre grader lavere (se `VAAT_SOLIDUS`). Null for negative og
 * ugyldige dyp.
 *
 * Kilde (tørr): Hirschmann (2000), «Mantle solidus: Experimental constraints and the effects of peridotite
 * composition», Geochem. Geophys. Geosyst. 1: T = −5,104 p² + 132,899 p + 1120,661 (p i GPa). Omtrentlig.
 */
export function solidus(z: number, vann = false): number | null {
  const p = trykk(z);
  if (p === null) return null;
  if (vann) return interp(VAAT_SOLIDUS, z);
  return -5.104 * p * p + 132.899 * p + 1120.661;
}

/** Mantelens potensielle temperatur (°C): temperaturen mantelen ville hatt ved overflaten uten å smelte. */
export const POTENSIELL_TEMPERATUR = 1350;
/** En mantelplume under et varmt punkt er omtrent 200 °C varmere. */
export const PLUME_TEMPERATUR = 1550;
/** Hvor mye temperaturen i mantelen øker med dypet (°C per km) når den stiger eller synker uten å utveksle varme. */
export const ADIABAT_GRADIENT = 0.3;

/**
 * Temperaturen (°C) i mantel som stiger (eller synker) uten å utveksle varme med omgivelsene (adiabatisk): T = Tp +
 * 0,3 °C/km · z. Under en rygg stiger mantelen og følger denne linja oppover; den krysser smeltepunktet ved ca. 60 km.
 * Null for negative og ugyldige tall.
 *
 * Kilde: omtrentlige lærebokverdier: potensiell temperatur ca. 1300–1400 °C og adiabatisk gradient ca. 0,3 °C per km
 * i den øvre mantelen (Turcotte og Schubert, «Geodynamics»; McKenzie og Bickle 1988).
 */
export function adiabat(z: number, tp: number = POTENSIELL_TEMPERATUR): number | null {
  if (!ok(z, tp) || z < 0) return null;
  return tp + ADIABAT_GRADIENT * z;
}

/**
 * Temperaturen (°C) ved et dyp `z` (km) under en plate med litosfære `litosfaere` km tykk: i den kalde, stive
 * litosfæren øker den jevnt fra 0 °C ved overflaten (varmeledning, forenklet til en rett linje), og under den følger
 * den adiabaten. Null for ugyldige tall.
 */
export function geoterm(z: number, litosfaere: number, tp: number = POTENSIELL_TEMPERATUR): number | null {
  if (!ok(z, litosfaere, tp) || z < 0 || litosfaere < 0) return null;
  if (z >= litosfaere || litosfaere === 0) return adiabat(z, tp);
  const bunn = adiabat(litosfaere, tp);
  return bunn === null ? null : (bunn * z) / litosfaere;
}

/** Hvordan mantelen under en type plategrense varmes, avkjøles og får vann (forenklet). */
export interface SmelteOppsett {
  /** Potensiell temperatur (°C). */
  tp: number;
  /** Tykkelsen på den kalde litosfæren over (km). */
  litosfaere: number;
  /** Får mantelen vann fra en plate som går ned? */
  vann: boolean;
  /** Dypene (km) der plata slipper vannet (bare med vann). */
  vannFra?: number;
  vannTil?: number;
  /** Stiger mantelen (dekompresjon)? */
  stiger: boolean;
}

/**
 * Oppsettet for smeltediagrammet per type: under ryggen stiger mantelen helt opp under en tynn litosfære; i en
 * subduksjonssone får mantelkilen vann fra plata mellom ca. 80 og 150 km dyp (der vulkanene ligger over); under et
 * varmt punkt stiger en varmere plume under en tykkere plate; ved kollisjon og transformforkastninger stiger ikke
 * mantelen, og ingen plate tar vann ned. Omtrentlige tall.
 */
export const SMELTING: Readonly<Record<PlategrenseType, SmelteOppsett>> = {
  spredning: { tp: POTENSIELL_TEMPERATUR, litosfaere: 6, vann: false, stiger: true },
  subduksjon: { tp: POTENSIELL_TEMPERATUR, litosfaere: 70, vann: true, vannFra: 80, vannTil: 150, stiger: false },
  kollisjon: { tp: POTENSIELL_TEMPERATUR, litosfaere: 150, vann: false, stiger: false },
  transform: { tp: POTENSIELL_TEMPERATUR, litosfaere: 70, vann: false, stiger: false },
  'varmt-punkt': { tp: PLUME_TEMPERATUR, litosfaere: 90, vann: false, stiger: true },
};

const SMELTE_STEG = 0.25;

/**
 * Dypet (km) der mantel som stiger langs adiabaten med potensiell temperatur `tp` først når smeltepunktet: det
 * største dypet (ned til `zMaks`) der temperaturen er over solidus. Under en rygg (tørr, 1350 °C) ca. 60 km; under
 * et varmt punkt (1550 °C) dypere. Null når den aldri smelter.
 */
export function smeltestart(tp: number = POTENSIELL_TEMPERATUR, vann = false, zMaks = 300): number | null {
  if (!ok(tp, zMaks) || zMaks <= 0) return null;
  for (let z = zMaks; z >= 0; z -= SMELTE_STEG) {
    const T = adiabat(z, tp);
    const s = solidus(z, vann);
    if (T !== null && s !== null && T > s) return z;
  }
  return null;
}

/**
 * Dypintervallet (km) der mantelen smelter delvis under en type plategrense: der temperaturen (`geoterm`) er over
 * smeltepunktet (`solidus`, med vann bare der plata slipper vannet). Null når den ikke smelter (kollisjon og
 * transform).
 */
export function smeltesone(o: SmelteOppsett, zMaks = 300): { fra: number; til: number } | null {
  if (!ok(o.tp, o.litosfaere, zMaks)) return null;
  let fra: number | null = null;
  let til: number | null = null;
  for (let z = 0; z <= zMaks + 1e-9; z += SMELTE_STEG) {
    if (o.vann && (z < (o.vannFra ?? 0) || z > (o.vannTil ?? zMaks))) continue;
    const T = geoterm(z, o.litosfaere, o.tp);
    const s = solidus(z, o.vann);
    if (T !== null && s !== null && T > s) {
      if (fra === null) fra = z;
      til = z;
    }
  }
  return fra === null || til === null ? null : { fra, til };
}

/* =====================================================================================================================
 * Subduksjon i målestokk: plata, vulkanene og jordskjelvene
 * ================================================================================================================== */

/** Hvor bratt plata går ned til slutt (grader): slakt under et kontinent (som Andes), bratt under en øybue (som Marianene). */
export const PLATE_FALL: Readonly<Record<SubduksjonVariant, number>> = { 'hav-kontinent': 30, 'hav-hav': 60 };
/** Hvor langt (km langs plata) den bøyer seg fra nesten flat ved havgropa til full helning. */
const BOY_LENGDE = 260;
/** Dypet (km) havgropa ligger på (under havflaten). */
export const GROP_DYP = 8;

/** Et punkt på oversiden av plata: avstand fra havgropa (km), dyp under havflaten (km) og lengden langs plata (km). */
export interface PlatePunkt {
  x: number;
  z: number;
  s: number;
}

/**
 * Oversiden av havbunnsplata i en subduksjonssone, i målestokk: fra havgropa (x = 0) og ned til 700 km dyp.
 * Helningen øker jevnt fra ca. 5° ved havgropa til `PLATE_FALL` over de første 260 km. Forenklet, men i riktig
 * størrelsesorden: vulkanene ligger der plata er ca. 100 km dyp, 150–300 km fra havgropa.
 */
export function plateProfil(variant: SubduksjonVariant, zMaks = 700, steg = 5): PlatePunkt[] {
  const fall = ((PLATE_FALL[variant] ?? 30) * Math.PI) / 180;
  const start = (5 * Math.PI) / 180;
  const ut: PlatePunkt[] = [{ x: 0, z: GROP_DYP, s: 0 }];
  let x = 0;
  let z = GROP_DYP;
  let s = 0;
  while (z < zMaks && s < 5000) {
    const u = klemme(s / BOY_LENGDE, 0, 1);
    const th = start + (fall - start) * u * u * (3 - 2 * u);
    x += steg * Math.cos(th);
    z += steg * Math.sin(th);
    s += steg;
    ut.push({ x, z: Math.min(z, zMaks), s });
  }
  return ut;
}

/** Punktet på oversiden av plata `s` km langs plata fra havgropa (null for negative og ugyldige tall). Etter 700 km dyp: enden. */
export function platePunktVed(variant: SubduksjonVariant, s: number): PlatePunkt | null {
  if (!ok(s) || s < 0) return null;
  const p = plateProfil(variant);
  for (let i = 1; i < p.length; i++) {
    const b = p[i]!;
    if (b.s >= s) {
      const a = p[i - 1]!;
      const u = (s - a.s) / (b.s - a.s || 1);
      return { x: a.x + u * (b.x - a.x), z: a.z + u * (b.z - a.z), s };
    }
  }
  return p[p.length - 1] ?? null;
}

/** Avstanden (km) fra havgropa til der oversiden av plata er `dyp` km dyp. Null når plata ikke når så dypt. */
export function avstandVedDyp(variant: SubduksjonVariant, dyp: number): number | null {
  if (!ok(dyp) || dyp < GROP_DYP) return null;
  const p = plateProfil(variant);
  for (let i = 1; i < p.length; i++) {
    const b = p[i]!;
    if (b.z >= dyp) {
      const a = p[i - 1]!;
      return a.x + ((dyp - a.z) / (b.z - a.z || 1)) * (b.x - a.x);
    }
  }
  return null;
}

/** Lengden (km) langs plata fra havgropa ned til `dyp` km. Null når plata ikke når så dypt. */
export function lengdeTilDyp(variant: SubduksjonVariant, dyp: number): number | null {
  if (!ok(dyp) || dyp < GROP_DYP) return null;
  const p = plateProfil(variant);
  for (let i = 1; i < p.length; i++) {
    const b = p[i]!;
    if (b.z >= dyp) {
      const a = p[i - 1]!;
      return a.s + ((dyp - a.z) / (b.z - a.z || 1)) * (b.s - a.s);
    }
  }
  return null;
}

/** Vulkanene ligger over stedet der oversiden av plata er omtrent så dyp (km). Kilde: Syracuse og Abers (2006), ca. 70–170 km, typisk ca. 100 km. */
export const VULKAN_PLATEDYP = 100;

/**
 * Hvor mange millioner år det tar før havbunn som går inn i havgropa, når dypet `dyp` (standard 660 km, grensen mot
 * den nedre mantelen) når platene møtes med `fart` cm per år. Null når farten er 0 eller ugyldig.
 */
export function tidTilDyp(variant: SubduksjonVariant, fart: number, dyp = 660): number | null {
  if (!ok(fart) || fart <= 0) return null;
  const L = lengdeTilDyp(variant, dyp);
  return L === null ? null : L / (fart * KM_PER_MA);
}

/** Et jordskjelv i snittet: avstand fra havgropa og dyp (km), når det skjer (andel av avspillingen, 0–1) og størrelse (0–1). */
export interface Skjelv {
  x: number;
  z: number;
  tid: number;
  styrke: number;
}

/**
 * Jordskjelv i en subduksjonssone (tenkte, men med fordelingen som i ekte data): de fleste er grunne, langs grensen
 * mellom platene og i den øverste delen av plata som går ned; antallet avtar mot ca. 300 km og øker litt igjen
 * mellom ca. 450 og 650 km, og ingen er dypere enn ca. 700 km. Noen få er grunne skjelv i overplata. Fast frø, så
 * figuren blir lik hver gang.
 */
export function skjelvKatalog(variant: SubduksjonVariant, n = 130, seed = 23): Skjelv[] {
  const rnd = seededRandom(seed);
  const profil = plateProfil(variant);
  const ut: Skjelv[] = [];
  const nPlate = Math.max(0, Math.round(n * 0.88));
  for (let i = 0; i < nPlate; i++) {
    const u = rnd();
    // Mest grunne (eksponentiell fordeling), en del dype (450–680 km)
    const z = u < 0.82 ? GROP_DYP + 4 - 95 * Math.log(1 - rnd() * (1 - Math.exp(-440 / 95))) : 450 + rnd() * 230;
    let p: PlatePunkt | undefined;
    for (let j = 1; j < profil.length; j++) {
      if (profil[j]!.z >= z) {
        p = profil[j]!;
        break;
      }
    }
    if (!p) continue;
    const q = profil[Math.max(0, profil.indexOf(p) - 1)]!;
    const tx = p.x - q.x;
    const tz = p.z - q.z;
    const L = Math.hypot(tx, tz) || 1;
    // Normalen inn i plata (nedover og bakover): (−tz, tx) / L
    const d = z < 60 ? rnd() * 12 : 4 + rnd() * 22;
    ut.push({ x: p.x + (-tz / L) * d, z: Math.min(700, p.z + (tx / L) * d), tid: rnd(), styrke: rnd() });
  }
  const nOver = n - nPlate;
  const xv = avstandVedDyp(variant, VULKAN_PLATEDYP) ?? 200;
  for (let i = 0; i < nOver; i++) {
    const x = 30 + rnd() * (xv + 60);
    ut.push({ x, z: 4 + rnd() * 30, tid: rnd(), styrke: rnd() * 0.6 });
  }
  return ut;
}

/* =====================================================================================================================
 * Kollisjon: skorpa blir tykkere, og fjellkjeden løftes (isostasi)
 * ================================================================================================================== */

/** Vanlig tykkelse på kontinentalskorpe (km). */
export const SKORPE_NORMAL = 35;
/** Hvor mye tykkere skorpa kan bli (km): omtrent dobbelt så tykk, ca. 70 km, som under Tibet. */
export const FORTYKNING_MAKS = 35;
/** Sammenskyving (km) som gir ca. 63 % av den største fortykningen. Forenklet. */
export const FORTYKNING_SKALA = 500;
/**
 * Hvor mye tykkere (km) skorpa blir når kontinentene skyves `sammenskyving` km sammen: øker raskt i starten og flater
 * ut mot ca. 35 km (omtrent dobbel tykkelse). Etter det sprer fjellkjeden seg heller utover. Forenklet modell. Null
 * for negative og ugyldige tall.
 */
export function skorpefortykning(sammenskyving: number): number | null {
  if (!ok(sammenskyving) || sammenskyving < 0) return null;
  return FORTYKNING_MAKS * (1 - Math.exp(-sammenskyving / FORTYKNING_SKALA));
}

/**
 * Isostasi (Airy): når skorpa blir `fortykning` km tykkere, flyter den høyere i mantelen, som et tykkere isfjell.
 * Skorpa regnes med gjennomsnittstettheten i hele kontinentalskorpa (`TETTHETER.skorpeKontinentSnitt`, 2,8 g/cm³,
 * litt over de øverste lagene fordi den nedre skorpa er tyngre; 70 km skorpe gir da ca. 5 km høyde, som Tibet).
 * Bare ca. 15 % blir fjell over bakken (høyde = Δ · (ρ_mantel − ρ_skorpe) / ρ_mantel); resten blir en rot som
 * stikker ned i mantelen (rot = Δ · ρ_skorpe / ρ_mantel). Høyde + rot = fortykningen. Null for ugyldige tall.
 */
export function isostasi(
  fortykning: number,
  skorpe: number = TETTHETER.skorpeKontinentSnitt,
  mantel: number = TETTHETER.mantel,
): { hoyde: number; rot: number } | null {
  if (!ok(fortykning, skorpe, mantel) || fortykning < 0 || mantel <= 0 || skorpe <= 0 || skorpe >= mantel) return null;
  return { hoyde: (fortykning * (mantel - skorpe)) / mantel, rot: (fortykning * skorpe) / mantel };
}

/** Fjellkjeden ved en kollisjon etter en tid. */
export interface Fjellkjede {
  /** Hvor langt kontinentene er skjøvet sammen (km). */
  sammenskyving: number;
  /** Skorpetykkelsen under fjellkjeden (km). */
  tykkelse: number;
  /** Middelhøyden over havet (m). */
  hoyde: number;
  /** Hvor dypt fjellroten stikker ned under vanlig skorpe (km). */
  rot: number;
  /** Bredden på fjellkjeden (km), forenklet. */
  bredde: number;
}

/**
 * Fjellkjeden `t` millioner år etter at to kontinenter møttes med `fart` cm per år: sammenskyving, skorpetykkelse,
 * middelhøyde (isostasi) og fjellrot. Forenklet: Himalaya og Tibet (ca. 50 millioner år, ca. 4–5 cm/år) får ca. 70 km
 * skorpe og ca. 5 km middelhøyde. Null for negative og ugyldige tall.
 */
export function fjellkjede(fart: number, t: number): Fjellkjede | null {
  const S = plateavstand(fart, t);
  if (S === null) return null;
  const dT = skorpefortykning(S);
  if (dT === null) return null;
  const iso = isostasi(dT);
  if (!iso) return null;
  return {
    sammenskyving: S,
    tykkelse: SKORPE_NORMAL + dT,
    hoyde: iso.hoyde * 1000,
    rot: iso.rot,
    bredde: Math.min(1300, 250 + 0.35 * S),
  };
}

/* =====================================================================================================================
 * Varmt punkt: vulkankjeden
 * ================================================================================================================== */

/**
 * Alderen (millioner år) til en vulkan `avstand` km fra det varme punktet når plata flytter seg med `fart` cm per år
 * over det: alder = avstand / fart. Slik måler geologene platefarten over varme punkter. Null når farten er 0.
 */
export function vulkanAlder(avstand: number, fart: number): number | null {
  if (!ok(avstand, fart) || fart <= 0 || avstand < 0) return null;
  return avstand / (fart * KM_PER_MA);
}

/* =====================================================================================================================
 * Fakta om hver type
 * ================================================================================================================== */

/** Fakta om én type plategrense (eller et varmt punkt, som ikke er en plategrense). */
export interface GrenseInfo {
  navn: string;
  /** Kort navn til knapper. */
  kort: string;
  /** False for et varmt punkt: det er ikke en plategrense. */
  plategrense: boolean;
  /** Etiketten over figuren, med begge sett fagord: «Konstruktiv (divergerende) plategrense». */
  etikett: string;
  /** Fagordene i begge sett (konstruktiv eller divergerende …). */
  fagord: readonly string[];
  bevegelse: string;
  drivkraft: string;
  landformer: readonly string[];
  vulkanisme: string;
  smelting: string;
  skjelvdyp: string;
  eksempler: readonly string[];
}

/** Fakta om hver type (bokmål, til forklaringen og søkeordene). */
export const GRENSE_TYPER: Readonly<Record<PlategrenseType, GrenseInfo>> = {
  spredning: {
    navn: 'Spredningsrygg',
    kort: 'Spredningsrygg',
    plategrense: true,
    etikett: 'Konstruktiv (divergerende) plategrense',
    fagord: ['konstruktiv plategrense', 'divergerende plategrense'],
    bevegelse: 'Platene beveger seg fra hverandre, og ny havbunn dannes i ryggen.',
    drivkraft:
      'Ryggskyv: plata ligger høyt ved den varme ryggen og glir ned og bort fra den. Platetrekk der platene går ned i en subduksjonssone langt unna, drar også.',
    landformer: ['midthavsrygg', 'riftdal', 'ny havbunn', 'magnetiske striper'],
    vulkanisme: 'Tynnflytende basaltlava renner rolig ut langs ryggen, mest under havet (putelava). På Island står ryggen over havet.',
    smelting: 'Dekompresjonssmelting: mantelen stiger under ryggen, trykket faller, og en liten del av steinen smelter.',
    skjelvdyp: SKJELVDYP.spredning.tekst,
    eksempler: ['Den midtatlantiske ryggen', 'Island (Tingvellir)', 'Øst-Stillehavsryggen', 'Den østafrikanske riftdalen (på land)'],
  },
  subduksjon: {
    navn: 'Subduksjonssone',
    kort: 'Subduksjon',
    plategrense: true,
    etikett: 'Destruktiv (konvergerende) plategrense',
    fagord: ['destruktiv plategrense', 'konvergerende plategrense'],
    bevegelse: 'Platene beveger seg mot hverandre, og havbunnsplata, som er tyngst, går ned i mantelen.',
    drivkraft: 'Platetrekk: den kalde, tunge plata synker og trekker resten av plata etter seg. Det er trolig den største drivkraften.',
    landformer: ['havgrop', 'vulkansk fjellkjede (hav mot kontinent)', 'vulkansk øybue (hav mot hav)', 'akkresjonskile'],
    vulkanisme: 'Seig, gassrik magma gir eksplosive stratovulkaner i en rekke parallelt med havgropa.',
    smelting: 'Vann fra plata senker smeltepunktet i mantelkilen over den, der plata er ca. 100 km dyp.',
    skjelvdyp: SKJELVDYP.subduksjon.tekst,
    eksempler: ['Andesfjellene (Nazcaplata under Sør-Amerika)', 'Japan', 'Marianegropa (hav mot hav)'],
  },
  kollisjon: {
    navn: 'Kollisjon mellom kontinenter',
    kort: 'Kollisjon',
    plategrense: true,
    etikett: 'Konvergerende plategrense: kollisjon',
    fagord: ['konvergerende plategrense', 'kollisjonssone'],
    bevegelse: 'Platene beveger seg mot hverandre, men kontinentalskorpa er for lett til å synke: den presses sammen, foldes og blir tykkere.',
    drivkraft: 'Platene drives av krefter andre steder: ryggskyv bak og trekk fra havbunnsplata som gikk ned før kontinentene møttes.',
    landformer: ['høy fjellkjede', 'folder og skyveforkastninger', 'fjellrot', 'høyslette'],
    vulkanisme: 'Lite eller ingen. Noe granitt kan dannes når den tykke skorpa smelter dypt nede.',
    smelting: 'Lite: mantelen stiger ikke, og ingen plate tar vann ned.',
    skjelvdyp: SKJELVDYP.kollisjon.tekst,
    eksempler: ['Himalaya (India mot Eurasia, fra ca. 50 millioner år siden)', 'Alpene', 'Den kaledonske fjellkjeden (ca. 430–400 millioner år siden)'],
  },
  transform: {
    navn: 'Transformforkastning',
    kort: 'Transform',
    plategrense: true,
    etikett: 'Konservativ plategrense',
    fagord: ['konservativ plategrense', 'transformforkastning'],
    bevegelse: 'Platene glir forbi hverandre. Ingen plate dannes eller forsvinner.',
    drivkraft:
      'Ingen egen drivkraft: platene drives av ryggskyv og platetrekk andre steder. Friksjonen holder dem fast til spenningen utløses i et jordskjelv.',
    landformer: ['forkastning', 'bruddsone', 'forskjøvne rygger og elveløp'],
    vulkanisme: 'Ingen.',
    smelting: 'Ingen: mantelen stiger ikke, og ingen plate tar vann ned.',
    skjelvdyp: SKJELVDYP.transform.tekst,
    eksempler: ['San Andreas-forkastningen i California', 'Transformforkastningene i Den midtatlantiske ryggen', 'Jan Mayen-bruddsonen'],
  },
  'varmt-punkt': {
    navn: 'Varmt punkt',
    kort: 'Varmt punkt',
    plategrense: false,
    etikett: 'Varmt punkt: ikke en plategrense',
    fagord: ['ikke en plategrense', 'mantelplume'],
    bevegelse: 'Plata glir over et varmt punkt som ligger nesten i ro i mantelen, så vulkanene blir eldre jo lenger de er fra det.',
    drivkraft: 'Plata drives av platetrekk og ryggskyv andre steder; det varme punktet flytter den ikke.',
    landformer: ['vulkansk øykjede', 'skjoldvulkaner', 'eroderte, synkne øyer (guyoter)'],
    vulkanisme: 'Tynnflytende basaltlava bygger store, slake skjoldvulkaner.',
    smelting: 'En varm plume stiger fra dypet, trykket faller, og en liten del av den smelter (dekompresjonssmelting, som under en rygg).',
    skjelvdyp: SKJELVDYP['varmt-punkt'].tekst,
    eksempler: ['Hawaii', 'Island (både rygg og varmt punkt)', 'Yellowstone'],
  },
};

/* =====================================================================================================================
 * Krefter og tid i visualiseringen
 * ================================================================================================================== */

/**
 * Lengden på kraftpilene i forhold til hverandre (bare til tegningen): platetrekket regnes som den største
 * drivkraften, ryggskyvet som mindre. Omtrentlig forhold (Forsyth og Uyeda 1975 fant at plater som er festet til en
 * plate som går ned, beveger seg raskest).
 */
export const KRAFT_FORHOLD = { platetrekk: 2, ryggskyv: 1 } as const;

/** Hvor mange millioner år avspillingen dekker for hver type. Spredning og transform: de siste 5 millioner årene (stripene). */
export const AVSPILLING: Readonly<Record<PlategrenseType, number>> = {
  spredning: STRIPER_MAKS,
  transform: STRIPER_MAKS,
  subduksjon: 10,
  kollisjon: 50,
  'varmt-punkt': 20,
};
