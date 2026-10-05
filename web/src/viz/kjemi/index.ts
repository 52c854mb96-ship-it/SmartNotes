import type { VizMeta } from '../types';
import kap01 from './kap01';
import kap02 from './kap02';
import kap03 from './kap03';
import kap04 from './kap04';
import kap05 from './kap05';
import kap06 from './kap06';
import kap07 from './kap07';
import kap08 from './kap08';

/**
 * Kjemi 1 etter læreboka Kjemi 1 (Aschehoug). Ett kapittel per mappe `kapNN/`, som i fysikk.
 * Felles byggeklosser for kjemi ligger i `kit/` (se README, avsnittet «Kjemi»).
 */
const viz: VizMeta[] = [...kap01, ...kap02, ...kap03, ...kap04, ...kap05, ...kap06, ...kap07, ...kap08];

export default viz;
