import type { VizMeta } from '../types';
import kap06 from './kap06';
import kap15 from './kap15';

/**
 * Biologi 1 etter læreboka Bi 1 (Gyldendal). Ett kapittel per mappe `kapNN/`, som i fysikk og kjemi.
 * Felles byggeklosser for biologi ligger i `kit/` (se README, avsnittet «Biologi»). Legg nye kapitler inn i
 * kapittelrekkefølge.
 */
const viz: VizMeta[] = [...kap06, ...kap15];

export default viz;
