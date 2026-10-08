/**
 * Ren modell for laboratoriescenen i «Halveringstid»: strålingen som kommer ut av prøven når en kjerne henfaller, og
 * klikkene i geigertelleren. Halveringen selv (decayTimes, countRemaining, remaining) ligger i model.ts.
 */
import { seededRandom } from '../kap07/random';
import { countRemaining } from './model';

/** Rekkevidden til α-partikler i luft (m): ca. 3–4 cm for energiene 4–6 MeV som U-238 og Rn-222 sender ut. */
export const ALPHA_RANGE_AIR = 0.035;

/** Hvor lenge (målt i halveringstider) en kjerne vises som «akkurat henfalt» mens strålingen er på vei ut. */
export const FRESH_WINDOW = 0.08;

/**
 * Tilfeldige tall for strålingen fra hver kjerne: `u` og `v` (0–1) velger hvor i prøven den kommer fra, og `w` (0–1)
 * hvilken retning den går. Fast frø, så figuren og skjermbildene blir like hver gang. Egen tallrekke, så retningene ikke
 * henger sammen med når kjernen henfaller.
 */
export interface EmissionDraw {
  u: number;
  v: number;
  w: number;
}

export function emissionDraws(n: number, seed: number): EmissionDraw[] {
  const rnd = seededRandom(seed * 7919 + 101);
  const out: EmissionDraw[] = [];
  for (let i = 0; i < n; i++) out.push({ u: rnd(), v: rnd(), w: rnd() });
  return out;
}

/**
 * Retningen (radianer, mot klokka fra positiv x-akse med y opp) for stråling som går ut av en overflate og oppover:
 * jevnt fordelt mellom `spread` grader på hver side av loddrett. 90° gir hele den øvre halvdelen.
 */
export function upwardAngle(w: number, spread = 80): number {
  const half = (Math.min(90, Math.max(0, spread)) * Math.PI) / 180;
  return Math.PI / 2 - half + 2 * half * clamp01(w);
}

/** Retning i alle retninger (radianer), for stråling inne i en beholder. */
export function anyAngle(w: number): number {
  return 2 * Math.PI * clamp01(w);
}

/**
 * Hvor langt en partikkel kommer fra (x, y) i retningen `angle` (y opp) før den har brukt opp rekkevidden `range`
 * eller treffer kanten av boksen (f.eks. glassveggen i en beholder). Starter den utenfor boksen, blir lengden 0.
 */
export function trackLength(
  x: number,
  y: number,
  angle: number,
  range: number,
  box?: { x0: number; y0: number; x1: number; y1: number },
): number {
  if (!(range > 0)) return 0;
  if (!box) return range;
  const { x0, y0, x1, y1 } = box;
  if (x < x0 || x > x1 || y < y0 || y > y1) return 0;
  const dx = Math.cos(angle);
  const dy = Math.sin(angle);
  let s = range;
  if (dx > 1e-12) s = Math.min(s, (x1 - x) / dx);
  if (dx < -1e-12) s = Math.min(s, (x0 - x) / dx);
  if (dy > 1e-12) s = Math.min(s, (y1 - y) / dy);
  if (dy < -1e-12) s = Math.min(s, (y0 - y) / dy);
  return Math.max(0, s);
}

/** Kjerner som har henfalt i løpet av det siste vinduet før t, med alder 0 (nettopp) til 1 (strålingen er borte). */
export function freshDecays(times: number[], t: number, window = FRESH_WINDOW): { i: number; age: number }[] {
  const out: { i: number; age: number }[] = [];
  if (!(window > 0)) return out;
  times.forEach((tau, i) => {
    const age = (t - tau) / window;
    if (age >= 0 && age < 1) out.push({ i, age });
  });
  return out;
}

/**
 * Antall henfall fram til t (målt i halveringstider). I modellen gir hvert henfall ett klikk i telleren; en ekte
 * geigerteller registrerer bare den delen av strålingen som treffer røret, men den delen er den samme hele tida.
 */
export function decayedCount(times: number[], t: number): number {
  return times.length - countRemaining(times, t);
}

/** Antall henfall i tidsrommet (t1, t2]: klikkene i telleren mellom to tidspunkter. */
export function decaysBetween(times: number[], t1: number, t2: number): number {
  return decayedCount(times, t2) - decayedCount(times, t1);
}

function clamp01(v: number): number {
  return Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0;
}
