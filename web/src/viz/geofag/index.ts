import type { VizMeta } from '../types';
import kap01 from './kap01';
import kap02 from './kap02';
import kap03 from './kap03';
import kap04 from './kap04';
import kap05 from './kap05';
import kap06 from './kap06';
import kap07 from './kap07';
import kap08 from './kap08';
import kap09 from './kap09';

/**
 * Geofag 1 etter læreplanen (GFG01-03, LK20). Én mappe `kapNN/` per tema i SmartNotes' eget oppsett, med deltemaer
 * som i fysikk. Felles byggeklosser for geofag ligger i `kit/` (se README, avsnittet «Geofag»). Legg nye temaer inn i
 * temarekkefølge.
 */
const viz: VizMeta[] = [
  ...kap01,
  ...kap02,
  ...kap03,
  ...kap04,
  ...kap05,
  ...kap06,
  ...kap07,
  ...kap08,
  ...kap09,
];

export default viz;
