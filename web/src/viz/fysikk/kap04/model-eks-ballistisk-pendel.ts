/**
 * Eksempeloppgaven «Ballistisk pendel» (k4-eks-ballistisk-pendel, 4A–4D).
 *
 * En luftgeværkule med masse m skytes vannrett inn i en trekloss med masse M som henger i to like lange, parallelle
 * snorer (klossen svinger uten å vri seg). Kula blir sittende fast, og klossen med kula svinger ut og stiger h før den
 * snur. Forløpet deles i to:
 *
 *   Støtet (fullstendig uelastisk, bevegelsesmengden bevart):   m · v = (m + M) · V
 *   Svingningen (mekanisk energi bevart, S ⊥ fart):            ½(m + M)V² = (m + M)gh   ⇒  V = √(2gh)
 *
 *   Kinetisk energi før og etter støtet:   E_før = ½mv²,  E_etter = ½(m + M)V² = (m + M)gh
 *   Omdannet i støtet:                    ΔE = E_før − E_etter,  ΔE / E_før = M / (m + M)
 *
 * Impulsloven på kula mens den stopper inne i klossen (tiden Δt, konstant kraft):
 *   F · Δt = Δp = m(V − v)        (negativ: kraften virker mot fartsretningen til kula)
 *   Klossen får like stor og motsatt rettet impuls (Newtons 3. lov): M · V = m(v − V).
 *   Med konstant kraft øker farten til klossen jevnt fra 0 til V, så klossen flytter seg s = ½VΔt, og kula
 *   s_kule = ½(v + V)Δt. Kula trenger d = s_kule − s_kloss = ½vΔt inn i treet.
 *   Arbeidet kraftparet gjør til sammen, −F·s_kule + F·s_kloss = −F·d, er nøyaktig −ΔE.
 */
import { G_EARTH } from '../../kit/format';

export interface PendulumTask {
  /** Massen til kula (kg). */
  m: number;
  /** Massen til treklossen (kg). */
  M: number;
  /** Hvor høyt klossen med kula stiger før den snur (m). */
  h: number;
  /** Tiden kula bruker på å stoppe inne i klossen (s). */
  dt: number;
  /** Lengden av snorene (m). Bare til figuren (hvor langt klossen svinger ut); inngår ikke i regningen. */
  L: number;
}

/**
 * Tre tallsett med vanlige luftgeværkuler (diabolo, 4,5 mm og 5,5 mm) og små treklosser. Farten blir 157–179 m/s, som
 * for et vanlig luftgevær, og klossen stiger 4–6 cm, så det kan måles på en video. Tallene er valgt så «om lag»-verdien
 * i b) ikke ligger på grensen mellom to avrundinger.
 */
export const PENDULUM_TASKS: PendulumTask[] = [
  { m: 0.53e-3, M: 0.095, h: 0.044, dt: 0.2e-3, L: 0.3 },
  { m: 0.68e-3, M: 0.12, h: 0.052, dt: 0.18e-3, L: 0.3 },
  { m: 0.5e-3, M: 0.072, h: 0.06, dt: 0.25e-3, L: 0.3 },
];

export interface PendulumSolution {
  /** Den samlede massen m + M (kg). */
  mTot: number;
  /** Farten til klossen med kula like etter støtet (m/s): V = √(2gh). */
  V: number;
  /** Farten til kula like før støtet (m/s): v = (m + M)V / m. */
  v: number;
  /** v avrundet til to gjeldende siffer, til «Vis at …» i b). */
  vShown: number;
  /** (m + M)/m: hvor mange ganger større farten til kula er enn farten etter støtet. */
  ratio: number;
  /** Bevegelsesmengden (kg·m/s), lik før og etter støtet: mv = (m + M)V. */
  p: number;
  /** Kinetisk energi til kula før støtet (J). */
  EkBefore: number;
  /** Kinetisk energi til klossen med kula like etter støtet (J), lik (m + M)gh. */
  EkAfter: number;
  /** Kinetisk energi som blir omdannet til andre energiformer i støtet (J). */
  lost: number;
  /** Andelen som blir omdannet: lost / EkBefore = M / (m + M). */
  lossShare: number;
  /** Den gale farten fra energibevaring gjennom støtet, ½mv² = (m + M)gh (m/s). Altfor liten. */
  vWrong: number;
  /** Endringen i bevegelsesmengden til kula i støtet (kg·m/s), negativ: m(V − v). */
  dpBullet: number;
  /** Endringen i bevegelsesmengden til klossen i støtet (kg·m/s), positiv: MV = −dpBullet. */
  dpBlock: number;
  /** Gjennomsnittskraften på kula i støtet (N), med fortegn (negativ = mot fartsretningen til kula). */
  Fbullet: number;
  /** Størrelsen på kraften i kraftparet mellom kula og klossen (N). */
  F: number;
  /** Tyngden til kula (N). */
  Gbullet: number;
  /** Hvor mange ganger større kraften er enn tyngden til kula. */
  forceRatio: number;
  /** Tyngden til klossen (N). Snordraget før støtet er like stort, og det endrer seg lite i den korte tiden støtet varer. */
  Gblock: number;
  /** Hvor mange ganger større kraften er enn tyngden til klossen. */
  forceRatioBlock: number;
  /** Hvor langt klossen flytter seg mens kula stopper (m): ½VΔt. */
  sBlock: number;
  /** Hvor langt kula flytter seg mens den stopper (m): ½(v + V)Δt. */
  sBullet: number;
  /** Hvor langt kula trenger inn i klossen (m): ½vΔt. */
  depth: number;
  /** Arbeidet kraften gjør på kula (J), negativt: −F · sBullet = ½m(V² − v²). */
  Wbullet: number;
  /** Arbeidet kraften gjør på klossen (J), positivt: F · sBlock = ½MV². */
  Wblock: number;
  /** Den største utslagsvinkelen til snorene (rad): cos θ = 1 − h/L. */
  thetaMax: number;
}

/** Avrunder til `sig` gjeldende siffer: 167,5 → 170 (sig = 2). */
export function roundSig(x: number, sig: number): number {
  if (!Number.isFinite(x) || x === 0) return x;
  const e = Math.floor(Math.log10(Math.abs(x))) - sig + 1;
  const f = 10 ** e;
  return Math.round(x / f) * f;
}

/** Løser hele oppgaven for ett tallsett. Alle tall i teksten, utregningen og figuren kommer herfra. */
export function solvePendulumTask({ m, M, h, dt, L }: PendulumTask, g = G_EARTH): PendulumSolution {
  const mTot = m + M;
  const V = Math.sqrt(2 * g * Math.max(0, h));
  const ratio = m > 0 ? mTot / m : 0;
  const v = ratio * V;
  const p = m * v;
  const EkBefore = 0.5 * m * v * v;
  const EkAfter = 0.5 * mTot * V * V;
  const lost = EkBefore - EkAfter;
  const lossShare = EkBefore > 0 ? lost / EkBefore : 0;
  const vWrong = m > 0 ? Math.sqrt((2 * mTot * g * Math.max(0, h)) / m) : 0;
  const dpBullet = m * (V - v);
  const dpBlock = M * V;
  const Fbullet = dt > 0 ? dpBullet / dt : 0;
  const F = Math.abs(Fbullet);
  const Gbullet = m * g;
  const Gblock = M * g;
  const sBlock = 0.5 * V * dt;
  const sBullet = 0.5 * (v + V) * dt;
  const depth = sBullet - sBlock;
  const Wbullet = -F * sBullet;
  const Wblock = F * sBlock;
  const thetaMax = L > 0 ? Math.acos(Math.max(-1, Math.min(1, 1 - h / L))) : 0;
  return {
    mTot,
    V,
    v,
    vShown: roundSig(v, 2),
    ratio,
    p,
    EkBefore,
    EkAfter,
    lost,
    lossShare,
    vWrong,
    dpBullet,
    dpBlock,
    Fbullet,
    F,
    Gbullet,
    forceRatio: Gbullet > 0 ? F / Gbullet : 0,
    Gblock,
    forceRatioBlock: Gblock > 0 ? F / Gblock : 0,
    sBlock,
    sBullet,
    depth,
    Wbullet,
    Wblock,
    thetaMax,
  };
}

export interface SwingState {
  /** Utslagsvinkelen (rad). */
  phi: number;
  /** Hvor mye klossen er flyttet vannrett (m) og løftet (m) i forhold til bunnen. */
  dx: number;
  dy: number;
  /** Farten (m/s) langs banen: ½(m + M)u² = ½(m + M)V² − (m + M)g · dy. */
  u: number;
  /** Snordraget i de to snorene til sammen (N): S = (m + M)(g cos φ + u²/L). Bare til lengden på pila i figuren. */
  S: number;
  /** Tyngden til klossen med kula (N). */
  G: number;
}

/**
 * Klossen med kula når snorene står i vinkelen `phi` under svingningen opp (til figuren). Farten følger av
 * energibevaringen; snordraget (sirkelbevegelse, Fysikk 2) brukes bare til å tegne S-pila riktig lang.
 */
export function swingAt(task: PendulumTask, s: PendulumSolution, phi: number, g = G_EARTH): SwingState {
  const a = Math.max(0, Math.min(phi, s.thetaMax));
  const dx = task.L * Math.sin(a);
  const dy = task.L * (1 - Math.cos(a));
  const u = Math.sqrt(Math.max(0, s.V * s.V - 2 * g * dy));
  const G = s.mTot * g;
  const S = s.mTot * (g * Math.cos(a) + (task.L > 0 ? (u * u) / task.L : 0));
  return { phi: a, dx, dy, u, S, G };
}

/** Lengden av treklossen (m) når den er av furu (500 kg/m³) med tverrsnitt 4,5 cm × 4,5 cm. Bare til figuren. */
export function blockLength(M: number): number {
  return M / (500 * 0.045 * 0.045);
}
