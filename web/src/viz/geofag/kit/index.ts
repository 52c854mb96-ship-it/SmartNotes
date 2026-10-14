/**
 * Felles byggeklosser for geofagvisualiseringene. Importer alt herfra i geofag/kapNN:
 *   import { Slider, Figure, LagMonstre, lagFyll, GEO, useGeoScale } from '../kit';
 * Fila eksporterer også hele det felles kit-et (viz/kit) og de generelle hjelperne fra kjemi- og biologi-kit-et
 * (navngitt, så felles navn som useSvgId bare kommer én gang), så du trenger bare én import. Scene-kit-et importeres
 * for seg: `import { Himmel, Terreng, ForceArrow, SCENE } from '../../kit/scene';`.
 * De rene hjelperne (geotid, datering, mineraler, bergarter, jorda, kornstorrelse, hydrologi, risiko, akser, kart og
 * statistikk) kommer også herfra, så en model.ts kan skrive `import { fmtAlder, darcy } from '../kit';`. Ingen navn her
 * kolliderer med scene-kit-et, kjemi- eller biologi-kit-et (sjekket i kit.test.ts).
 */
import '../../kit/scene/scene.css';
import './geofag.css';

export * from '../../kit';

// Generelle hjelpere fra kjemi-kit-et (importeres, ikke kopieres). Txt kommer fra det felles kit-et.
export { seededRandom, placeParticles, jiggle, type Box, type PlacedParticle } from '../../kjemi/kit/random';
export { Select, useContainerTextScale } from '../../kjemi/kit/controls';
export { Formel, TFormel, Reaksjon, TReaksjon, type FormelProps, type ReaksjonProps } from '../../kjemi/kit/Formel';
export { Begerglass, type GlassProps } from '../../kjemi/kit/beger';
export { mixColor } from '../../kjemi/kit/colors';
export { fmtSig } from '../../kjemi/kit/format';

// Generelle hjelpere fra biologi-kit-et
export { Etikett, type EtikettProps } from '../../biologi/kit/felles';
export { Forvalg, PlayBar, type ForvalgOption } from '../../biologi/kit/controls';
export { fmtPct, fmtCount } from '../../biologi/kit/format';
export { solveOde, type Derivs, type OdeSolution, type SolveOptions } from '../../biologi/kit/modeller';

// Geofag: typer, farger, skalering og mønstre
export * from './typer';
export * from './colors';
export * from './felles';
export * from './monstre';

// Geofag: rene hjelpere med data (tabeller med kilde i en kommentar). Ugyldige tall gir null, aldri NaN eller Infinity.
export * from './geotid'; // GEOLOGISK_TID (ICS 2023/09), periodeVed, tilDognet, fmtAlder
export * from './datering'; // ISOTOPER (U–Pb, K–Ar, C-14), gjenvaerende, alderFraForhold, nullstilles
export * from './mineraler'; // MINERALER, SILIKATSTRUKTURER, RISSETESTER, MOHS_ABSOLUTT, muligeMineraler
export * from './bergarter'; // BERGARTER, MAGMATISKE, klassifiserMagmatisk, SEDIMENTARE, METAMORFE, SYKLUS
export * from './jorda'; // JORDAS_LAG, forenklet PREM (tetthetVed, gVed, trykkVed, vpVed, vsVed), TETTHETER

// Geofag: rene hjelpere med beregninger
export * from './kornstorrelse'; // KORNKLASSER, phi, Hjulström, kornTilstand, synkefart, kornkurver, sortering
export * from './hydrologi'; // vannets kretsløp, vannbalanse, Darcy, Thiem, flomfrekvens (Gumbel)
export * from './risiko'; // SIKKERHETSKLASSER (TEK17 § 7-2 og § 7-3), vurderTomt, risikoklasse, kvikkleire
export * from './akser'; // scaleLog, logTicks, tierpotens, logEtikett (til LogPlot)
export * from './kart'; // hoydefelt, koter, terrengprofil, helning, vannskille, målestokk (y mot sør, som i SVG)
export * from './statistikk'; // middel, median, standardavvik, lineaerRegresjon

// Geofag: byggeklossene per familie
export * from './diagram';
export * from './kotekart';
export * from './snitt';
export * from './tektonikk';
export * from './vann';
export * from './bygg';
export * from './landskap';
export * from './korn';
export * from './stein';
