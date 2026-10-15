/**
 * Faste farger for geofagvisualiseringene. Verdiene er CSS-variabler (`--geo-*` i geofag.css, som kit-ets index.ts
 * laster) og fungerer i både lyst og mørkt tema, også med fagtemaet «Fjell». Bruk aldri egne fargekoder i komponentene.
 *
 * Flater (lag i jorda, bergarter, vann og is, olje og gass) har en fyllfarge og en kantfarge (`{ fill, line }`): lys fyll
 * med mettet kant i lyst tema, mørk fyll med lys kant i mørkt tema (som cellene i biologi). Linjer, piler og
 * fargeskalaer er vanlige strenger. Tekst oppå en fylt flate skrives med `VIZ.ink`.
 *
 * VIZ-fargene brukes aldri på bergarter eller landskap: farter og strømning (platebevegelse, grunnvann, isstrøm)
 * tegnes med `VIZ.velocity`, og krefter (tyngden i skråningen, platetrekk og ryggskyv) med VIZ som i fysikk.
 */
import { mix, tint, type GradientStop } from '../../kit/scene/core';
import { MONSTER_IDS, type MonsterId } from './typer';

/** Fyll og kant for en flate: et lag i jorda, en bergart, vann, is, olje eller gass. */
export interface GeoPaint {
  /** Fyllfarge (lys i lyst tema, mørk i mørkt tema). */
  fill: string;
  /** Kantfarge og farge på mønster og detaljer (mettet i lyst tema, lys i mørkt tema). */
  line: string;
}

const v = (name: string) => `var(--geo-${name})`;
const paint = (name: string): GeoPaint => ({ fill: v(name), line: v(`${name}-line`) });
const rock = (id: MonsterId): GeoPaint => paint(`rock-${id}`);

/**
 * Nøklene i `GEO.tid`: prekambrium, eoner, æraer, perioder (også de prekambriske) og epokene i kenozoikum, i små
 * bokstaver uten æ, ø og å, slik `GEOLOGISK_TID` i geotid.ts navngir dem (kvartaer, ikke kvartær).
 */
export type TidFarge =
  | 'prekambrium'
  | 'hadeikum'
  | 'arkeikum'
  | 'proterozoikum'
  | 'eoarkeikum'
  | 'paleoarkeikum'
  | 'mesoarkeikum'
  | 'neoarkeikum'
  | 'paleoproterozoikum'
  | 'mesoproterozoikum'
  | 'neoproterozoikum'
  | 'siderium'
  | 'rhyacium'
  | 'orosirium'
  | 'statherium'
  | 'calymmium'
  | 'ectasium'
  | 'stenium'
  | 'tonium'
  | 'kryogenium'
  | 'ediacara'
  | 'fanerozoikum'
  | 'paleozoikum'
  | 'mesozoikum'
  | 'kenozoikum'
  | 'kambrium'
  | 'ordovicium'
  | 'silur'
  | 'devon'
  | 'karbon'
  | 'perm'
  | 'trias'
  | 'jura'
  | 'kritt'
  | 'paleogen'
  | 'neogen'
  | 'kvartaer'
  | 'paleocen'
  | 'eocen'
  | 'oligocen'
  | 'miocen'
  | 'pliocen'
  | 'pleistocen'
  | 'holocen';

const TID_NOKLER: readonly TidFarge[] = [
  'prekambrium',
  'hadeikum',
  'arkeikum',
  'proterozoikum',
  'eoarkeikum',
  'paleoarkeikum',
  'mesoarkeikum',
  'neoarkeikum',
  'paleoproterozoikum',
  'mesoproterozoikum',
  'neoproterozoikum',
  'siderium',
  'rhyacium',
  'orosirium',
  'statherium',
  'calymmium',
  'ectasium',
  'stenium',
  'tonium',
  'kryogenium',
  'ediacara',
  'fanerozoikum',
  'paleozoikum',
  'mesozoikum',
  'kenozoikum',
  'kambrium',
  'ordovicium',
  'silur',
  'devon',
  'karbon',
  'perm',
  'trias',
  'jura',
  'kritt',
  'paleogen',
  'neogen',
  'kvartaer',
  'paleocen',
  'eocen',
  'oligocen',
  'miocen',
  'pliocen',
  'pleistocen',
  'holocen',
];

/**
 * Alle geofagfargene. Flater er `{ fill, line }` (GeoPaint), linjer og skalaer er strenger med `var(--geo-…)`:
 *   <path d={…} fill={GEO.magma.fill} stroke={GEO.magma.line} />
 *   <ForceArrow … color={GEO.nedbor} label="Nedbør" />
 *   <rect fill={GEO.tid.devon} />  ·  GEO.hoydelag[0..5]  ·  GEO.gehalt[0..4]  ·  GEO.fare[0..3]
 * Bergartene ligger i `GEO.bergart[id]` (samme farger som mønstrene i `LagMonstre`).
 */
export const GEO = {
  /* ---------- Jordas indre ---------- */
  /** Kontinental skorpe (granittisk, lys og tykk). */
  skorpeKontinent: paint('skorpe-kontinent'),
  /** Havbunnsskorpe (basaltisk, mørk og tynn). */
  skorpeHav: paint('skorpe-hav'),
  /** Den stive mantelen i litosfæren, under skorpa (tegn litosfæren som skorpe + denne). */
  litosfare: paint('litosfare'),
  /** Astenosfæren: den varme, plastiske delen av øvre mantel som platene glir på. */
  astenosfare: paint('astenosfare'),
  /** Hele mantelen i kjemisk inndeling (skorpe, mantel, kjerne). */
  mantel: paint('mantel'),
  /** Nedre mantel (mesosfæren), tettere og mørkere enn astenosfæren. */
  nedreMantel: paint('nedre-mantel'),
  /** Den flytende ytre kjernen (jern og nikkel). */
  ytreKjerne: paint('ytre-kjerne'),
  /** Den faste indre kjernen (lysest og varmest). */
  indreKjerne: paint('indre-kjerne'),
  /** Magma under bakken (magmakammer, ganger, smeltesoner): dyp karminrød, aldri oransje som G-pila. */
  magma: paint('magma'),
  /** Lava på overflaten: glødende rav med rød kant (`line` = størknende skorpe og kant på lavastrømmen). */
  lava: paint('lava'),
  /** Askesky og askeregn fra vulkaner. Askelag i en lagrekke tegnes med mønsteret `aske`. */
  aske: paint('aske'),

  /* ---------- Bergarter, sedimenter og løsmasser ---------- */
  /**
   * Én farge per mønster (`MonsterId`). `fill` er bakgrunnen i mønsteret og fargen på små flater der mønsteret ikke
   * synes (forklaringer, korn), `line` er fargen på mønsteret og konturen. Bruk `lagFyll(id)` for selve mønsteret.
   */
  bergart: Object.fromEntries(MONSTER_IDS.map((id) => [id, rock(id)])) as Record<MonsterId, GeoPaint>,

  /* ---------- Vann og is ---------- */
  /** Mettet sone og grunnvann (porene fylt med vann); også formasjonsvann under olje og gass. */
  grunnvann: paint('grunnvann'),
  /** Umettet sone (porer med luft og litt vann) over grunnvannsspeilet. */
  umettet: paint('umettet'),
  /** Breis (dalbre, innlandsis). */
  bre: paint('bre'),
  /** Firn og snø i akkumulasjonsområdet. */
  firn: paint('firn'),
  /** Havis (tynn, flytende). */
  havis: paint('havis'),
  /** Luft i porene (umettet sone, tørre korn): lys og nøytral i begge temaer, så den aldri ligner vann. */
  luft: paint('luft'),

  /* ---------- Kart ---------- */
  /** Koter (brune, som på norske topografiske kart). Hver femte kote tykkere. */
  kote: v('kote'),
  /** Høydelag fra lavland (0, grønt) til høyfjell (5, lys grå), som på et høydelagskart. */
  hoydelag: [v('hoyde-0'), v('hoyde-1'), v('hoyde-2'), v('hoyde-3'), v('hoyde-4'), v('hoyde-5')],
  /** Vannskille (stiplet linje mellom nedbørfelt). */
  vannskille: v('vannskille'),

  /* ---------- Prosesser (piler og strømmer i kretsløp) ---------- */
  nedbor: v('nedbor'),
  fordamping: v('fordamping'),
  avrenning: v('avrenning'),
  erosjon: v('erosjon'),
  avsetning: v('avsetning'),

  /* ---------- Ressurser ---------- */
  /** Olje (grønn) og gass (rød), som på kartene til Sokkeldirektoratet. Også i porene i Kornpakning. */
  olje: paint('olje'),
  gass: paint('gass'),
  /** CO₂ som lagres (sky i reservoaret, gass i porene): grå med et fiolett skjær, så den ikke forveksles med vann. */
  co2: paint('co2'),
  /**
   * Gehalt (metallinnhold i malm) som sekvensiell skala: 0 = lavest, 4 = høyest. Sterkere farge betyr høyere gehalt i
   * begge temaer (blek til mørk gull i lyst tema, dempet til lys gull i mørkt). Bruk `gehaltFarge(andel)`.
   */
  gehalt: [v('gehalt-0'), v('gehalt-1'), v('gehalt-2'), v('gehalt-3'), v('gehalt-4')],

  /* ---------- Forurensning (faner og skyer i grunnvann og jord) ---------- */
  /**
   * Smittestoffer (bakterier, virus, parasitter) fra avløp, gjødselkjeller eller beite: magenta. Tegn fanen gjerne
   * halvgjennomsiktig: `alpha(GEO.smitte.fill, 0.7)` med `GEO.smitte.line` som kant og prikker.
   */
  smitte: paint('smitte'),
  /** Kjemisk forurensning (sigevann fra deponi, olje- og drivstoffsøl på land): skitten oliven-brun. */
  forurensning: paint('forurensning'),
  /** Nitrat fra gjødsel og husdyrgjødsel: gulgrønn (ulik `GEO.olje`, som er mettet grønn). */
  nitrat: paint('nitrat'),

  /* ---------- Datering ---------- */
  /** Morisotop (f.eks. ²³⁸U, ⁴⁰K, ¹⁴C) som prikker i et mineral. */
  morIsotop: v('iso-mor'),
  /** Datterisotop (f.eks. ²⁰⁶Pb, ⁴⁰Ar, ¹⁴N). */
  datterIsotop: v('iso-datter'),
  /**
   * Magnetiske striper på havbunnen (flater med fyll og kant): normal polaritet sterk farge, omvendt lys og nøytral, i
   * begge temaer (som i lærebøkene). I mørkt tema er normal en mettet blå og omvendt en lys, varm grå, så begge synes
   * mot den mørke flaten. Tegn ruter i en forklaring med `FlateForklaring`, ikke `Legend` (som bare tegner streker).
   */
  polaritet: { normal: paint('pol-normal'), omvendt: paint('pol-omvendt') },

  /* ---------- Risiko ---------- */
  /**
   * Faregrad fra lav (0, blek gul) til svært høy (3, rød), som på faresonekart. Tegn sonene gjerne halvgjennomsiktig
   * over et kart: `alpha(GEO.fare[2], 0.55)`. Bruk `fareFarge(nivå)`.
   */
  fare: [v('fare-0'), v('fare-1'), v('fare-2'), v('fare-3')],

  /* ---------- Geologisk tid ---------- */
  /**
   * Dempede periodefarger etter ICS-kartet (versjon 2023/09): kambrium grønn, devon brun, perm rød, jura blå, kritt
   * grønn, kvartær gul … Tekst oppå skrives med `VIZ.ink`. Nøklene: `TidFarge`.
   */
  tid: Object.fromEntries(TID_NOKLER.map((k) => [k, v(`tid-${k}`)])) as Record<TidFarge, string>,
} as const;

/** Fyll og kant for et mønster eller en bergart (samme som `GEO.bergart[id]`). */
export function bergartFarge(id: MonsterId): GeoPaint {
  return GEO.bergart[id];
}

/** Farge for en andel 0–1 av høyeste gehalt (5 trinn). Ugyldige tall gir laveste trinn. */
export function gehaltFarge(andel: number): string {
  return trinn(GEO.gehalt, andel);
}

/** Farge for faregrad 0–3 (avrundet og begrenset). Ugyldige tall gir laveste grad. */
export function fareFarge(niva: number): string {
  const list = GEO.fare;
  const i = Number.isFinite(niva) ? Math.min(list.length - 1, Math.max(0, Math.round(niva))) : 0;
  return list[i]!;
}

/** Høydelagsfarge for en høyde i en skala fra `min` til `max` (6 like trinn). */
export function hoydelagFarge(hoyde: number, min: number, max: number): string {
  const span = max - min;
  return trinn(GEO.hoydelag, span > 0 ? (hoyde - min) / span : 0);
}

/** Fargen til en tidsenhet (`GEO.tid[navn]`), eller en nøytral farge når navnet ikke finnes. */
export function tidFarge(navn: string): string {
  return (GEO.tid as Record<string, string>)[navn] ?? 'var(--viz-body)';
}

function trinn(list: readonly string[], andel: number): string {
  const t = Number.isFinite(andel) ? Math.min(1, Math.max(0, andel)) : 0;
  return list[Math.min(list.length - 1, Math.floor(t * list.length))]!;
}

/**
 * Glødende magma uten oransje: den varmeste midten går mot lys karmin (`tint`), ikke mot lavaens rav, så magma aldri
 * ligner G-pila (`VIZ.gravity`) eller rustaksenten i «Fjell» (fargeavstand ΔE over 20 i begge temaer, testet).
 * - `kjerne`: midten i et magmakammer eller en diapir.
 * - `midt`: mellomtonen (karmin med en snev av lava, fargetone under ca. 8°).
 * - `kanal`: fyllet i kanaler og ganger (= `GEO.magma.fill`, med `GEO.magma.line` som kant).
 * Bruk `MAGMA_GLOD_STOPP` i en `RadialGradient` for kamre og diapirer:
 *   <RadialGradient id={id} fx={0.45} fy={0.4} stops={MAGMA_GLOD_STOPP} />
 */
export const MAGMA_GLOD = {
  kjerne: tint(GEO.magma.fill, 0.4),
  midt: mix(GEO.magma.fill, GEO.lava.fill, 0.15),
  kanal: GEO.magma.fill,
} as const;

/** Toningen i et glødende magmakammer til `RadialGradient`: lys karmin i midten, karmin ytterst (se `MAGMA_GLOD`). */
export const MAGMA_GLOD_STOPP: GradientStop[] = [
  [0, MAGMA_GLOD.kjerne],
  [0.45, MAGMA_GLOD.midt],
  [1, GEO.magma.fill],
];
