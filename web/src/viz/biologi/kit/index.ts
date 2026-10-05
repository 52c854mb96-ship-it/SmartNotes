/**
 * Felles byggeklosser for biologivisualiseringene. Importer alt herfra i biologi/kapNN: `import { Slider, Celle, BIO } from '../kit';`
 * Fila eksporterer også hele det felles kit-et (viz/kit) og de generelle hjelperne fra kjemi-kit-et (tilfeldige tall
 * med frø, partikler, Txt, nedtrekksliste, begerglass), så du trenger bare én import.
 */
export * from '../../kit';

// Generelle hjelpere fra kjemi-kit-et (importeres, ikke kopieres)
export { seededRandom, placeParticles, jiggle, type Box, type PlacedParticle } from '../../kjemi/kit/random';
export { Txt, type TxtProps } from '../../kit/txt';
export { Select, useContainerTextScale } from '../../kjemi/kit/controls';
export { Partikler, Begerglass, type ParticleGroup, type GlassProps } from '../../kjemi/kit/beger';
export { mixColor } from '../../kjemi/kit/colors';
export { fmtSig } from '../../kjemi/kit/format';

// Biologi
export * from './colors';
export * from './format';
export * from './felles';
export * from './controls';
export * from './modeller';
export * from './transport';
export * from './kromosomer';
export * from './celle';
export * from './membran';
export * from './kromosom';
export * from './organismer';
