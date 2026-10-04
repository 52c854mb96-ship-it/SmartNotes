import type { VizMeta } from '../types';
import kap01 from './kap01';

/**
 * Kjemi 1 etter læreboka Kjemi 1 (Aschehoug). Ett kapittel per mappe `kapNN/`, som i fysikk.
 * Felles byggeklosser for kjemi ligger i `kit/` (se README, avsnittet «Kjemi»).
 */
const viz: VizMeta[] = [...kap01];

export default viz;
