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
import kap10 from './kap10';
import kap11 from './kap11';
import kap12 from './kap12';
import kap13 from './kap13';
import kap14 from './kap14';
import kap15 from './kap15';

/**
 * Biologi 1 etter læreboka Bi 1 (Gyldendal). Ett kapittel per mappe `kapNN/`, som i fysikk og kjemi.
 * Felles byggeklosser for biologi ligger i `kit/` (se README, avsnittet «Biologi»). Legg nye kapitler inn i
 * kapittelrekkefølge.
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
  ...kap10,
  ...kap11,
  ...kap12,
  ...kap13,
  ...kap14,
  ...kap15,
];

export default viz;
