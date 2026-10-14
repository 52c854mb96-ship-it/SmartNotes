/**
 * Kornstørrelse i geofag: kornklassene (leire, silt, sand, grus, stein, blokk), φ-skalaen, Hjulströms diagram
 * (erosjon, transport og avsetning), synkefart, kornfordelingskurver fra sikteanalyse, persentiler (d10, d50, d60),
 * graderingstall, krumningstall og sortering etter Folk og Ward. Ren logikk uten React.
 *
 * Kornstørrelser er alltid diameter i **mm**, farter i **m/s** og andeler i **prosent** (0–100). Ugyldige tall (null,
 * negative diametre, persentiler utenfor kurven) gir `null`, aldri `NaN` eller `Infinity`.
 *
 *   kornklasse(0.3)                              // 'sand'
 *   kornTilstand(0.3, 0.5, false)                // 'eroderes'
 *   const kurve = kumulativKurve([16, 8, 4, 2, 1, 0.5, 0.25, 0.125, 0.063], masser, bunn);
 *   dPersentil(kurve!, 60)                       // d60 i mm, eller null når kurven ikke når 60 %
 *   sortering(kurve!)?.navn                      // 'dårlig sortert'
 */
import { normalKumulativ } from './statistikk';

// ---------------------------------------------------------------------------------------------------------------------
// Kornklasser

/** Kornklassene, fra finest til grovest. */
export type KornklasseId = 'leire' | 'silt' | 'sand' | 'grus' | 'stein' | 'blokk';

/** Én kornklasse med grenser i mm. */
export interface Kornklasse {
  id: KornklasseId;
  /** Navnet i løpende tekst: «sand». */
  navn: string;
  /** Tilleggsordet når klassen er en mindre del av massen: «sandig grus». */
  adjektiv: string;
  /** Nedre grense i mm (tatt med i klassen). */
  min: number;
  /** Øvre grense i mm (hører til neste klasse), eller null for blokk, som ikke har noen øvre grense. */
  max: number | null;
}

/*
 * Kilde: NGU, kornstørrelsestabellen i MAREANO (ngu.no/Mareano/Grainsize.html, oppdatert 28.09.2023): leire under
 * 0,002 mm, silt 0,002–0,063 mm, sand 0,063–2 mm, grus 2–64 mm, stein 64–256 mm og blokk over 256 mm. Geoteknikken
 * (NGF melding 2 etter NS-EN ISO 14688-1) bruker de samme grensene opp til sand, men 63 mm og 200/630 mm for grus,
 * stein og blokk; forskjellen syns ikke i figurene.
 */
/** Kornklassene etter NGU (grenser i mm), fra finest til grovest. */
export const KORNKLASSER: readonly Kornklasse[] = [
  { id: 'leire', navn: 'leire', adjektiv: 'leirig', min: 0, max: 0.002 },
  { id: 'silt', navn: 'silt', adjektiv: 'siltig', min: 0.002, max: 0.063 },
  { id: 'sand', navn: 'sand', adjektiv: 'sandig', min: 0.063, max: 2 },
  { id: 'grus', navn: 'grus', adjektiv: 'grusig', min: 2, max: 64 },
  { id: 'stein', navn: 'stein', adjektiv: 'steinig', min: 64, max: 256 },
  { id: 'blokk', navn: 'blokk', adjektiv: 'blokkrik', min: 256, max: null },
];

/** Grensen mellom finstoff (silt og leire) og sand i mm: det som går gjennom den minste sikten i en sikteanalyse. */
export const FINSTOFF_GRENSE = 0.063;

/**
 * Kornklassen til et korn med diameter `d` mm (grensene som i `KORNKLASSER`: 0,063 mm er sand, 2 mm er grus).
 * d ≤ 0 eller ugyldig gir null.
 *
 * @param d Korndiameter i mm.
 */
export function kornklasse(d: number): KornklasseId | null {
  if (!Number.isFinite(d) || d <= 0) return null;
  for (const k of KORNKLASSER) if (k.max === null || d < k.max) return k.id;
  return null;
}

/**
 * Kornstørrelsen på φ-skalaen (Krumbein): φ = −log₂(d i mm). Store korn har negativ φ (grus −1 til −6), fine korn
 * positiv (leire over 9). d ≤ 0 gir null.
 *
 * @param d Korndiameter i mm.
 */
export function phi(d: number): number | null {
  if (!Number.isFinite(d) || d <= 0) return null;
  return -Math.log2(d);
}

/**
 * Diameteren i mm for en φ-verdi: d = 2^(−φ). Ugyldig φ gir null.
 *
 * @param p φ-verdien.
 */
export function dFraPhi(p: number): number | null {
  if (!Number.isFinite(p)) return null;
  const d = 2 ** -p;
  return Number.isFinite(d) && d > 0 ? d : null;
}

// ---------------------------------------------------------------------------------------------------------------------
// Hjulströms diagram

/*
 * Kilde: Hjulström 1935 (Bull. Geol. Inst. Univ. Uppsala 25, fig. 18), avlest og avrundet: kvartskorn på plan bunn ved
 * omtrent 1 m vanndyp, middelfart i m/s. Verdiene ved 0,01, 1 og 10 mm er de samme som i Earle 2019 (Physical Geology,
 * 2. utg., kap. 13.3): erosjon ved 0,60, 0,20 og 1,05 m/s, avsetning ved 0,001, 0,10 og 0,80 m/s. Kurvene er bånd i
 * originalen, og erosjonsfarten for leire avhenger mye av hvor fast leira er, så verdiene er OMTRENTLIGE (±30 % eller mer
 * for de fineste kornene). Erosjonskurven har bunnen for fin og middels sand (ca. 0,3 mm, ca. 0,16 m/s).
 */
/** Punkter på erosjonskurven: [diameter i mm, fart i m/s] (omtrentlig, avlest fra Hjulström 1935). */
export const HJULSTROM_EROSJON: readonly (readonly [number, number])[] = [
  [0.001, 1.5],
  [0.002, 1.1],
  [0.005, 0.8],
  [0.01, 0.6],
  [0.02, 0.42],
  [0.05, 0.27],
  [0.1, 0.2],
  [0.2, 0.17],
  [0.3, 0.16],
  [0.5, 0.17],
  [1, 0.2],
  [2, 0.32],
  [5, 0.62],
  [10, 1.05],
  [20, 1.5],
  [50, 2.3],
  [100, 3.2],
  [200, 4.5],
  [500, 7],
  [1000, 10],
];

/** Punkter på avsetningskurven: [diameter i mm, fart i m/s] (omtrentlig, avlest fra Hjulström 1935). */
export const HJULSTROM_AVSETNING: readonly (readonly [number, number])[] = [
  [0.001, 0.0001],
  [0.01, 0.001],
  [0.1, 0.01],
  [1, 0.1],
  [10, 0.8],
  [100, 2.5],
  [1000, 8],
];

/** Kornstørrelsene diagrammet dekker, i mm. Korn utenfor behandles som endepunktene. */
export const HJULSTROM_D: readonly [number, number] = [0.001, 1000];

function loglogInterp(tabell: readonly (readonly [number, number])[], d: number): number | null {
  if (!Number.isFinite(d) || d <= 0) return null;
  const forste = tabell[0]!;
  const siste = tabell[tabell.length - 1]!;
  if (d <= forste[0]) return forste[1];
  if (d >= siste[0]) return siste[1];
  for (let i = 0; i < tabell.length - 1; i++) {
    const [d0, v0] = tabell[i]!;
    const [d1, v1] = tabell[i + 1]!;
    if (d >= d0 && d <= d1) {
      const t = (Math.log(d) - Math.log(d0)) / (Math.log(d1) - Math.log(d0));
      return Math.exp(Math.log(v0) + t * (Math.log(v1) - Math.log(v0)));
    }
  }
  return null;
}

/**
 * Erosjonsfarten fra Hjulströms diagram: vannfarten (m/s) som skal til for å rive løs et korn som ligger i ro på bunnen.
 * Log–log-interpolasjon i `HJULSTROM_EROSJON` (omtrentlig). Korn utenfor 0,001–1000 mm får verdien ved endepunktet;
 * d ≤ 0 gir null.
 *
 * @param d Korndiameter i mm.
 */
export function erosjonsfart(d: number): number | null {
  return loglogInterp(HJULSTROM_EROSJON, d);
}

/**
 * Avsetningsfarten fra Hjulströms diagram: under denne vannfarten (m/s) legger et korn som fraktes seg på bunnen.
 * Alltid lavere enn erosjonsfarten. Log–log-interpolasjon i `HJULSTROM_AVSETNING` (omtrentlig); d ≤ 0 gir null.
 *
 * @param d Korndiameter i mm.
 */
export function avsetningsfart(d: number): number | null {
  return loglogInterp(HJULSTROM_AVSETNING, d);
}

/**
 * Hva som skjer med et korn: `'ligger'` (blir liggende i ro), `'eroderes'` (rives løs), `'transporteres'` (fraktes
 * videre) eller `'avsettes'` (legger seg).
 */
export type KornTilstand = 'ligger' | 'eroderes' | 'transporteres' | 'avsettes';

/**
 * Tilstanden til et korn i Hjulströms diagram. Poenget med de to kurvene er at svaret avhenger av om kornet allerede
 * er i bevegelse:
 * - over erosjonskurven rives et korn i ro løs (`'eroderes'`), og et korn i bevegelse fraktes videre;
 * - mellom kurvene blir et korn i ro liggende, mens et korn i bevegelse fraktes videre;
 * - under avsetningskurven legger et korn i bevegelse seg (`'avsettes'`), og et korn i ro blir liggende.
 *
 * Farten akkurat på erosjonskurven regnes som erosjon, akkurat på avsetningskurven som transport. Ugyldig d eller
 * negativ fart gir null.
 *
 * @param d Korndiameter i mm.
 * @param v Vannfarten i m/s (middelfart, ca. 1 m dyp).
 * @param iBevegelse true når kornet allerede fraktes av vannet.
 */
export function kornTilstand(d: number, v: number, iBevegelse: boolean): KornTilstand | null {
  if (!Number.isFinite(v) || v < 0) return null;
  const vE = erosjonsfart(d);
  const vA = avsetningsfart(d);
  if (vE === null || vA === null) return null;
  if (v >= vE) return iBevegelse ? 'transporteres' : 'eroderes';
  if (v >= vA) return iBevegelse ? 'transporteres' : 'ligger';
  return iBevegelse ? 'avsettes' : 'ligger';
}

/** Valg til `synkefart`. */
export interface SynkefartValg {
  /** Kornets tetthet i kg/m³ (standard 2650, kvarts). */
  tetthet?: number;
  /** Vannets tetthet i kg/m³ (standard 1000). */
  vanntetthet?: number;
  /** Kinematisk viskositet i m²/s (standard 1,0 · 10⁻⁶, vann ved 20 °C; ved 5 °C omtrent 1,5 · 10⁻⁶). */
  viskositet?: number;
}

/*
 * Kilde: Ferguson og Church 2004 (J. Sediment. Res. 74, 933–937), w = R g d² / (C₁ ν + √(0,75 C₂ R g d³)) med C₁ = 18 og
 * C₂ = 1,0 for naturlige sandkorn. For fine korn blir formelen Stokes' lov, w = R g d²/(18 ν); for grove korn vokser
 * farten med √d.
 */
/**
 * Synkefarten (m/s) til et korn i stillestående vann: Stokes' lov for fine korn (silt og leire synker svært sakte),
 * overgang til √d-lov for grove korn (Ferguson og Church 2004). 0,01 mm silt synker ca. 0,09 mm/s, 1 mm sand
 * ca. 0,13 m/s. d ≤ 0 eller ugyldige valg gir null.
 *
 * @param d Korndiameter i mm.
 * @param valg Tetthet og viskositet (standard: kvarts i vann ved 20 °C).
 */
export function synkefart(d: number, valg: SynkefartValg = {}): number | null {
  const rs = valg.tetthet ?? 2650;
  const rw = valg.vanntetthet ?? 1000;
  const nu = valg.viskositet ?? 1.0e-6;
  if (!Number.isFinite(d) || d <= 0 || !(rw > 0) || !(nu > 0) || !Number.isFinite(rs)) return null;
  const R = (rs - rw) / rw;
  if (R <= 0) return 0;
  const D = d / 1000;
  const g = 9.81;
  const w = (R * g * D * D) / (18 * nu + Math.sqrt(0.75 * 1.0 * R * g * D * D * D));
  return Number.isFinite(w) ? w : null;
}

/** Hvordan et korn fraktes: svevende i vannet eller langs bunnen (ruller, glir og hopper). */
export type Transportform = 'svevende' | 'langs-bunnen';

/**
 * Om et korn som fraktes, holdes svevende eller går langs bunnen. Kornet svever når turbulensen (skjærhastigheten,
 * her forenklet til en tidel av vannfarten, omtrent riktig ved ca. 1 m dyp) er større enn synkefarten (Bagnolds
 * kriterium, forenklet). Leire og silt svever nesten alltid, grus og stein går langs bunnen. Ugyldige tall gir null.
 *
 * @param d Korndiameter i mm.
 * @param v Vannfarten i m/s.
 */
export function transportform(d: number, v: number): Transportform | null {
  if (!Number.isFinite(v) || v < 0) return null;
  const w = synkefart(d);
  if (w === null) return null;
  return 0.1 * v > w ? 'svevende' : 'langs-bunnen';
}

// ---------------------------------------------------------------------------------------------------------------------
// Kornfordeling

/** Ett punkt på en kornfordelingskurve. */
export interface KurvePunkt {
  /** Korndiameter (maskevidden til sikten) i mm. */
  d: number;
  /** Gjennomgang: hvor mange prosent av massen som er finere enn d (0–100). */
  gjennomgang: number;
}

/**
 * Kumulativ kornfordelingskurve fra en sikteanalyse: prosent gjennomgang for hver sikt, sortert fra fineste til
 * groveste sikt. Gjennomgangen ved en sikt er alt som ligger på de finere siktene og i bunnpannen, delt på total masse.
 * Kurven når 100 % ved den groveste sikten bare når ingenting ble liggende på den. Ugyldige data (ulik lengde, sikt
 * ≤ 0, samme sikt to ganger, negativ masse eller total masse 0) gir null.
 *
 * @param sikter Maskevidder i mm, i vilkårlig rekkefølge (f.eks. 16, 8, 4, 2, 1, 0,5, 0,25, 0,125, 0,063).
 * @param masser Massen som ble liggende på hver sikt (samme rekkefølge og enhet, f.eks. gram).
 * @param bunn Massen i bunnpannen (det som gikk gjennom den fineste sikten). Standard 0.
 */
export function kumulativKurve(sikter: readonly number[], masser: readonly number[], bunn = 0): KurvePunkt[] | null {
  if (sikter.length === 0 || sikter.length !== masser.length) return null;
  if (!Number.isFinite(bunn) || bunn < 0) return null;
  const par: [number, number][] = [];
  for (let i = 0; i < sikter.length; i++) {
    const d = sikter[i]!;
    const m = masser[i]!;
    if (!Number.isFinite(d) || d <= 0 || !Number.isFinite(m) || m < 0) return null;
    par.push([d, m]);
  }
  par.sort((a, b) => b[0] - a[0]);
  for (let i = 1; i < par.length; i++) if (par[i]![0] === par[i - 1]![0]) return null;
  const total = par.reduce((s, [, m]) => s + m, 0) + bunn;
  if (!(total > 0)) return null;
  let paaOgOver = 0;
  const kurve: KurvePunkt[] = [];
  for (const [d, m] of par) {
    paaOgOver += m;
    kurve.push({ d, gjennomgang: Math.min(100, Math.max(0, (100 * (total - paaOgOver)) / total)) });
  }
  return kurve.reverse();
}

/**
 * En kornfordeling som er normalfordelt på φ-skalaen (lognormal i mm), slik mange naturlige sedimenter er: `d50` er
 * mediankornet og `sortering` standardavviket σ i φ-enheter (0,3 = svært godt sortert strandsand, 1 = moderat sortert,
 * 2–3 = morene). Gir punkter jevnt fordelt i φ fra φ50 − 4σ til φ50 + 4σ, eller ved diametrene i `d` (f.eks. en
 * siktesats). Ugyldig d50 eller sortering ≤ 0 gir null.
 *
 * @param d50 Mediankornstørrelsen i mm.
 * @param sortering Standardavviket σ i φ-enheter.
 * @param d Diametrene kurven skal regnes ut for (mm). Standard: 41 punkter over ±4σ.
 */
export function lognormalKurve(d50: number, sortering: number, d?: readonly number[]): KurvePunkt[] | null {
  const p50 = phi(d50);
  if (p50 === null || !Number.isFinite(sortering) || sortering <= 0) return null;
  let diametre: number[];
  if (d) {
    diametre = [];
    for (const x of d) {
      if (!Number.isFinite(x) || x <= 0) return null;
      diametre.push(x);
    }
  } else {
    diametre = [];
    for (let i = 0; i <= 40; i++) diametre.push(2 ** -(p50 + sortering * (-4 + (8 * i) / 40)));
  }
  diametre.sort((a, b) => a - b);
  return diametre.map((x) => {
    // Finere enn x betyr φ > φ(x): Φ((φ50 − φx)/σ)
    const z = (p50 - -Math.log2(x)) / sortering;
    return { d: x, gjennomgang: 100 * (normalKumulativ(z) ?? 0) };
  });
}

function sortert(kurve: readonly KurvePunkt[]): KurvePunkt[] | null {
  if (kurve.length === 0) return null;
  for (const p of kurve) if (!Number.isFinite(p.d) || p.d <= 0 || !Number.isFinite(p.gjennomgang)) return null;
  return [...kurve].sort((a, b) => a.d - b.d);
}

/**
 * Kornstørrelsen (mm) der kurven krysser `p` % gjennomgang: d10, d30, d50, d60 … Interpolerer lineært i log d mellom
 * siktene, som når kurven tegnes på logaritmisk akse. Gir null når kurven ikke når p (f.eks. d10 når mer enn 10 % går
 * gjennom den fineste sikten: da kan d10 ikke bestemmes uten slemmeanalyse).
 *
 * @param kurve Kornfordelingskurven.
 * @param p Prosent gjennomgang (0–100).
 */
export function dPersentil(kurve: readonly KurvePunkt[], p: number): number | null {
  const k = sortert(kurve);
  if (!k || !Number.isFinite(p) || p < 0 || p > 100) return null;
  const forste = k[0]!;
  if (p < forste.gjennomgang) return null;
  if (p === forste.gjennomgang) return forste.d;
  for (let i = 0; i < k.length - 1; i++) {
    const a = k[i]!;
    const b = k[i + 1]!;
    if (p > a.gjennomgang && p <= b.gjennomgang) {
      const t = (p - a.gjennomgang) / (b.gjennomgang - a.gjennomgang);
      return Math.exp(Math.log(a.d) + t * (Math.log(b.d) - Math.log(a.d)));
    }
  }
  return null;
}

/**
 * Gjennomgangen (prosent finere) ved diameteren `d`, lest av kurven med interpolasjon i log d. Under den fineste sikten
 * er svaret bare kjent når kurven er 0 der, over den groveste bare når kurven er 100 der; ellers null.
 *
 * @param kurve Kornfordelingskurven.
 * @param d Diameter i mm.
 */
export function gjennomgangVed(kurve: readonly KurvePunkt[], d: number): number | null {
  const k = sortert(kurve);
  if (!k || !Number.isFinite(d) || d <= 0) return null;
  const forste = k[0]!;
  const siste = k[k.length - 1]!;
  if (d < forste.d) return forste.gjennomgang === 0 ? 0 : null;
  if (d > siste.d) return siste.gjennomgang >= 100 ? 100 : null;
  for (let i = 0; i < k.length - 1; i++) {
    const a = k[i]!;
    const b = k[i + 1]!;
    if (d >= a.d && d <= b.d) {
      if (b.d === a.d) return b.gjennomgang;
      const t = (Math.log(d) - Math.log(a.d)) / (Math.log(b.d) - Math.log(a.d));
      return a.gjennomgang + t * (b.gjennomgang - a.gjennomgang);
    }
  }
  return siste.gjennomgang;
}

/**
 * Graderingstallet Cu = d60/d10: hvor mange kornstørrelser massen spenner over. Nær 1 er ensgradert (alle korn like
 * store, godt sortert), over 15 er velgradert (mange størrelser, typisk morene). Null når d10 eller d60 ikke kan leses av.
 *
 * @param kurve Kornfordelingskurven.
 */
export function graderingstall(kurve: readonly KurvePunkt[]): number | null {
  const d10 = dPersentil(kurve, 10);
  const d60 = dPersentil(kurve, 60);
  if (d10 === null || d60 === null || d10 <= 0) return null;
  return d60 / d10;
}

/**
 * Krumningstallet Cc = d30² / (d10 · d60), som sier noe om formen på kurven (1–3 for en jevn, velgradert masse). Null når
 * en av persentilene ikke kan leses av.
 *
 * @param kurve Kornfordelingskurven.
 */
export function krumningstall(kurve: readonly KurvePunkt[]): number | null {
  const d10 = dPersentil(kurve, 10);
  const d30 = dPersentil(kurve, 30);
  const d60 = dPersentil(kurve, 60);
  if (d10 === null || d30 === null || d60 === null || d10 <= 0 || d60 <= 0) return null;
  return (d30 * d30) / (d10 * d60);
}

/** Graderingen etter graderingstallet, som i geoteknikken. */
export type Gradering = 'ensgradert' | 'mellomgradert' | 'velgradert';

/*
 * Kilde: NGF melding 2 (omtrent: ensgradert under 6, mellomgradert 6–15, velgradert over 15). NB: «velgradert» betyr at
 * massen har mange kornstørrelser, altså at den er DÅRLIG sortert i geologisk forstand.
 */
/**
 * Graderingen for et graderingstall Cu: `'ensgradert'` under 6, `'mellomgradert'` 6–15 og `'velgradert'` over 15
 * (geoteknikk; velgradert betyr dårlig sortert). Ugyldig Cu (under 1) gir null.
 *
 * @param cu Graderingstallet d60/d10.
 */
export function gradering(cu: number): Gradering | null {
  if (!Number.isFinite(cu) || cu < 1) return null;
  if (cu < 6) return 'ensgradert';
  if (cu <= 15) return 'mellomgradert';
  return 'velgradert';
}

// ---------------------------------------------------------------------------------------------------------------------
// Sortering (Folk og Ward)

/** Sorteringsklassene etter Folk og Ward, fra best til dårligst sortert. */
export type SorteringsklasseId =
  | 'svaert-godt'
  | 'godt'
  | 'moderat-godt'
  | 'moderat'
  | 'darlig'
  | 'svaert-darlig'
  | 'ekstremt-darlig';

/** Én sorteringsklasse: σ fra `min` (tatt med) til `max`. */
export interface Sorteringsklasse {
  id: SorteringsklasseId;
  /** «godt sortert». */
  navn: string;
  /** Nedre grense for σ i φ-enheter. */
  min: number;
  /** Øvre grense for σ i φ-enheter, eller null for den siste klassen. */
  max: number | null;
}

/*
 * Kilde: Folk og Ward 1957 (J. Sediment. Petrol. 27, 3–26), klassene for det inklusive grafiske standardavviket σI.
 */
/** Sorteringsklassene etter Folk og Ward 1957 (σ i φ-enheter). */
export const SORTERINGSKLASSER: readonly Sorteringsklasse[] = [
  { id: 'svaert-godt', navn: 'svært godt sortert', min: 0, max: 0.35 },
  { id: 'godt', navn: 'godt sortert', min: 0.35, max: 0.5 },
  { id: 'moderat-godt', navn: 'moderat godt sortert', min: 0.5, max: 0.71 },
  { id: 'moderat', navn: 'moderat sortert', min: 0.71, max: 1 },
  { id: 'darlig', navn: 'dårlig sortert', min: 1, max: 2 },
  { id: 'svaert-darlig', navn: 'svært dårlig sortert', min: 2, max: 4 },
  { id: 'ekstremt-darlig', navn: 'ekstremt dårlig sortert', min: 4, max: null },
];

/** Resultatet av `sortering`. */
export interface Sortering {
  /** Standardavviket σ i φ-enheter (0 = alle korn like store). */
  sigma: number;
  /** Sorteringsklassen. */
  klasse: SorteringsklasseId;
  /** «dårlig sortert». */
  navn: string;
  /** Grafisk middelkornstørrelse Mz = (φ16 + φ50 + φ84)/3 i φ-enheter. */
  middelPhi: number;
  /** Middelkornstørrelsen i mm. */
  middelD: number;
  /**
   * `'inklusiv'`: Folk og Wards σI = (φ84 − φ16)/4 + (φ95 − φ5)/6,6. `'enkel'`: (φ84 − φ16)/2, brukt når 5- eller
   * 95-persentilen ligger utenfor siktene (f.eks. mer enn 5 % finstoff).
   */
  metode: 'inklusiv' | 'enkel';
}

/**
 * Sorteringen av en kornfordeling etter Folk og Ward 1957: det inklusive grafiske standardavviket σI i φ-enheter og
 * klassenavnet («godt sortert», «dårlig sortert» …). Godt sortert tyder på vann eller vind (strandsand, breelvsand),
 * svært dårlig sortert på morene. Sorteringen er uavhengig av middelkornstørrelsen. φn er størrelsen der n % av massen
 * er grovere, altså d med (100 − n) % gjennomgang. Null når 16- eller 84-persentilen ikke kan leses av.
 *
 * @param kurve Kornfordelingskurven.
 */
export function sortering(kurve: readonly KurvePunkt[]): Sortering | null {
  const phiVed = (gjennomgang: number): number | null => {
    const d = dPersentil(kurve, gjennomgang);
    return d === null ? null : phi(d);
  };
  const p16 = phiVed(84);
  const p50 = phiVed(50);
  const p84 = phiVed(16);
  if (p16 === null || p50 === null || p84 === null) return null;
  const p5 = phiVed(95);
  const p95 = phiVed(5);
  const inklusiv = p5 !== null && p95 !== null;
  const sigma = inklusiv ? (p84 - p16) / 4 + (p95 - p5) / 6.6 : (p84 - p16) / 2;
  const s = Math.max(0, sigma);
  const klasse = sorteringsklasse(s)!;
  const middelPhi = (p16 + p50 + p84) / 3;
  return { sigma: s, klasse: klasse.id, navn: klasse.navn, middelPhi, middelD: 2 ** -middelPhi, metode: inklusiv ? 'inklusiv' : 'enkel' };
}

/**
 * Sorteringsklassen for et standardavvik σ i φ-enheter (Folk og Ward 1957). Negativ eller ugyldig σ gir null.
 *
 * @param sigma Standardavviket i φ-enheter.
 */
export function sorteringsklasse(sigma: number): Sorteringsklasse | null {
  if (!Number.isFinite(sigma) || sigma < 0) return null;
  for (const k of SORTERINGSKLASSER) if (k.max === null || sigma < k.max) return k;
  return null;
}

// ---------------------------------------------------------------------------------------------------------------------
// Fraksjoner og navn på løsmassen

/** En fraksjon i en løsmasse: en kornklasse, eller `'finstoff'` (silt og leire samlet) når de ikke kan skilles. */
export type Fraksjon = KornklasseId | 'finstoff';

/** Andelene (prosent av massen) i hver kornklasse, lest av en kornfordelingskurve. */
export interface Fraksjonsandeler {
  /** Prosent i hver kornklasse, eller null når kurven ikke dekker klassen (f.eks. leire og silt uten slemmeanalyse). */
  klasser: Record<KornklasseId, number | null>;
  /** Prosent finere enn 0,063 mm (silt og leire samlet), eller null. */
  finstoff: number | null;
}

/**
 * Hvor mange prosent av massen som er leire, silt, sand, grus, stein og blokk, lest av kurven ved klassegrensene.
 * Klasser som kurven ikke dekker, blir null: en sikteanalyse som slutter ved 0,063 mm gir finstoffet, men ikke
 * fordelingen på silt og leire.
 *
 * @param kurve Kornfordelingskurven.
 */
export function fraksjonsandeler(kurve: readonly KurvePunkt[]): Fraksjonsandeler | null {
  if (!sortert(kurve)) return null;
  // Gjennomgang ved en klassegrense: 0 under alt, 100 over alt (blokk har ingen øvre grense).
  const ved = (d: number | null): number | null => (d === null ? 100 : d === 0 ? 0 : gjennomgangVed(kurve, d));
  const klasser = {} as Record<KornklasseId, number | null>;
  for (const k of KORNKLASSER) {
    const lo = ved(k.min);
    const hi = ved(k.max);
    klasser[k.id] = lo === null || hi === null ? null : Math.max(0, hi - lo);
  }
  return { klasser, finstoff: gjennomgangVed(kurve, FINSTOFF_GRENSE) };
}

/** Resultatet av `klassifiserLosmasse`. */
export interface LosmasseNavn {
  /** Navnet i løpende tekst: «siltig sand», «sandig grus», «grus med mye finstoff». */
  navn: string;
  /** Hovedfraksjonen (substantivet). */
  hoved: Fraksjon;
  /** Tilleggsfraksjonene (adjektivene), med den største først. */
  tillegg: Fraksjon[];
  /** Merknad når finstoffet ikke kan deles i silt og leire. */
  merknad: string | null;
}

/** Fraksjoner som tas med som tilleggsord fra denne andelen (prosent). Leire allerede fra 10 %. */
const TILLEGG_FRA = 20;
const TILLEGG_LEIRE_FRA = 10;

/**
 * Et enkelt navn på en løsmasse fra kornfordelingen, forenklet etter norsk praksis (NGF melding 2): hovedordet er
 * fraksjonen med mest masse, og fraksjoner med minst 20 % (leire fra 10 %) blir tilleggsord, den største nærmest
 * hovedordet («siltig sandig grus»). Når silt og leire ikke kan skilles (sikteanalyse uten slemmeanalyse), kalles de
 * «finstoff», og navnet får en merknad. Null når kurven ikke gir noen andeler.
 *
 * @param kurve Kornfordelingskurven.
 */
export function klassifiserLosmasse(kurve: readonly KurvePunkt[]): LosmasseNavn | null {
  const a = fraksjonsandeler(kurve);
  if (!a) return null;
  const andeler: [Fraksjon, number][] = [];
  const fineKjent = a.klasser.leire !== null && a.klasser.silt !== null;
  let merknad: string | null = null;
  for (const k of KORNKLASSER) {
    const v = a.klasser[k.id];
    if ((k.id === 'leire' || k.id === 'silt') && !fineKjent) continue;
    if (v !== null) andeler.push([k.id, v]);
  }
  if (!fineKjent) {
    if (a.finstoff === null) return null;
    andeler.push(['finstoff', a.finstoff]);
    if (a.finstoff > 0) merknad = 'Finstoffet (under 0,063 mm) kan ikke deles i silt og leire uten slemmeanalyse.';
  }
  const positive = andeler.filter(([, v]) => v > 0);
  if (positive.length === 0) return null;
  positive.sort((x, y) => y[1] - x[1]);
  const hoved = positive[0]![0];
  const tillegg = positive
    .slice(1)
    .filter(([id, v]) => v >= (id === 'leire' ? TILLEGG_LEIRE_FRA : TILLEGG_FRA))
    .slice(0, 2)
    .map(([id]) => id);
  const ord = (f: Fraksjon): string => (f === 'finstoff' ? 'finstoff' : KORNKLASSER.find((k) => k.id === f)!.navn);
  const adj = (f: Fraksjon): string => KORNKLASSER.find((k) => k.id === f)?.adjektiv ?? '';
  const hovedNavn = hoved === 'finstoff' ? 'finstoff (silt eller leire)' : ord(hoved);
  const adjektiver = tillegg.filter((f) => f !== 'finstoff').map(adj);
  const medFinstoff = tillegg.includes('finstoff');
  const navn = [...[...adjektiver].reverse(), hovedNavn].join(' ') + (medFinstoff ? ' med mye finstoff' : '');
  return { navn, hoved, tillegg, merknad };
}
