/**
 * Ren fysikk for eksempeloppgaven «Fotoner fra laserpekere» (7C): fotonenergien fra bølgelengden (E = hf = hc/λ),
 * antall fotoner per sekund fra effekten (N = P/E), sammenligningen av en rød og en grønn laserpeker med samme effekt,
 * og hvorfor ultrafiolett stråling (UV-B) kan skade DNA i huden når synlig lys ikke kan (energien per foton avgjør).
 *
 * Tallene i oppgaveteksten, utregningen og svaret kommer alle fra solvePhotonTask, så de stemmer med hverandre.
 * Konstantene er de i ERGO Fysikk 1.
 */

/** Plancks konstant (J s). */
export const H_PLANCK = 6.63e-34;
/** Lysfarten i vakuum (m/s). */
export const C_LIGHT = 3.0e8;
/** 1 eV = 1,60 · 10⁻¹⁹ J. */
export const J_PER_EV = 1.6e-19;
/** Grensene for synlig lys (nm), de samme som i spektrene i kapittelet. */
export const VISIBLE_MIN = 380;
export const VISIBLE_MAX = 750;
/** UV-B: ultrafiolett stråling fra 280 nm til 315 nm, den delen av sollyset som gjør oss solbrent. */
export const UVB_MIN = 280;
export const UVB_MAX = 315;

/** Ett tallsett. */
export interface PhotonTask {
  /** Bølgelengden til den røde laserpekeren (nm). */
  redNm: number;
  /** Bølgelengden til den grønne laserpekeren (nm). */
  greenNm: number;
  /** Effekten til hver av laserpekerne (W). De har samme effekt, så bare bølgelengden skiller dem. */
  P: number;
  /** Bølgelengden til UV-B-strålingen i deloppgave d (nm). */
  uvNm: number;
  /** Energien ett foton minst må ha for å skade et DNA-molekyl (eV). Forenklet, men grensen havner i UV-B. */
  damageEV: number;
}

/**
 * Tallsettene: vanlige laserpekere (rød 635–670 nm, grønn 515–532 nm) med effekt på 1 mW eller mindre, og UV-B fra
 * sola. Med 4,0 eV går grensen for DNA-skade ved 311 nm, nesten nøyaktig ved overgangen mellom UV-B og UV-A (315 nm).
 */
export const PHOTON_TASKS: readonly PhotonTask[] = [
  { redNm: 650, greenNm: 532, P: 1.0e-3, uvNm: 300, damageEV: 4.0 },
  { redNm: 635, greenNm: 515, P: 0.8e-3, uvNm: 290, damageEV: 4.0 },
  { redNm: 670, greenNm: 520, P: 0.5e-3, uvNm: 305, damageEV: 4.0 },
];

/** Energien (J) til et foton med bølgelengden `nm`: E = hf = hc/λ. */
export function photonEnergy(nm: number): number {
  return (H_PLANCK * C_LIGHT) / (nm * 1e-9);
}

/** Bølgelengden (nm) til et foton med energien `E` (J): λ = hc/E. */
export function wavelengthNm(E: number): number {
  return ((H_PLANCK * C_LIGHT) / E) * 1e9;
}

/** Antall fotoner per sekund fra en lyskilde med effekten `P` (W) når hvert foton har energien `E` (J): N = P/E. */
export function photonsPerSecond(P: number, E: number): number {
  return P / E;
}

export type Region = 'uv' | 'synlig' | 'ir';

/** Hvilken del av spekteret bølgelengden (nm) hører til. */
export function regionOf(nm: number): Region {
  if (nm < VISIBLE_MIN) return 'uv';
  if (nm > VISIBLE_MAX) return 'ir';
  return 'synlig';
}

/** Ett foton (og strålen det hører til) i oppgaven. */
export interface Photon {
  nm: number;
  /** Bølgelengden i meter. */
  lambda: number;
  /** Frekvensen (Hz): f = c/λ. */
  f: number;
  /** Energien (J og eV). */
  E: number;
  eV: number;
  /** Fotoner per sekund når strålen har effekten P i tallsettet. */
  N: number;
  region: Region;
  /** Om ett foton har nok energi til å skade et DNA-molekyl (E ≥ damageEV). */
  canDamage: boolean;
}

function photon(nm: number, P: number, damageEV: number): Photon {
  const lambda = nm * 1e-9;
  const E = photonEnergy(nm);
  const eV = E / J_PER_EV;
  return { nm, lambda, f: C_LIGHT / lambda, E, eV, N: photonsPerSecond(P, E), region: regionOf(nm), canDamage: eV >= damageEV };
}

export interface PhotonSolution {
  task: PhotonTask;
  red: Photon;
  green: Photon;
  /** UV-B-fotonet. `N` er antallet per sekund fra en tenkt UV-B-kilde med samme effekt som laserpekerne (e). */
  uv: Photon;
  /** E_grønn / E_rød = λ_rød / λ_grønn (> 1). */
  ratioE: number;
  /** N_grønn / N_rød = λ_grønn / λ_rød (< 1). Produktet med ratioE er 1, fordi N · E = P er likt. */
  ratioN: number;
  /** Hvor mange prosent mer energi et grønt foton har enn et rødt (avrundet). */
  morePct: number;
  /** Hvor mange prosent færre fotoner per sekund den grønne sender ut (avrundet). */
  fewerPct: number;
  /** Grensen for DNA-skade i joule. */
  damageJ: number;
  /** Den største bølgelengden (nm) et foton kan ha og likevel skade DNA: λ = hc/E_min. */
  maxNm: number;
  /** Hvor mange røde fotoner som til sammen har minst damageEV (e: energien hoper seg likevel ikke opp). */
  redNeeded: number;
  /** Den største fotonenergien i synlig lys (eV): fiolett lys ved VISIBLE_MIN. */
  visibleMaxEV: number;
}

export function solvePhotonTask(task: PhotonTask): PhotonSolution {
  const { redNm, greenNm, P, uvNm, damageEV } = task;
  const red = photon(redNm, P, damageEV);
  const green = photon(greenNm, P, damageEV);
  const uv = photon(uvNm, P, damageEV);
  const ratioE = green.E / red.E;
  const ratioN = green.N / red.N;
  const damageJ = damageEV * J_PER_EV;
  return {
    task,
    red,
    green,
    uv,
    ratioE,
    ratioN,
    morePct: Math.round((ratioE - 1) * 100),
    fewerPct: Math.round((1 - ratioN) * 100),
    damageJ,
    maxNm: wavelengthNm(damageJ),
    redNeeded: Math.ceil(damageEV / red.eV),
    visibleMaxEV: photonEnergy(VISIBLE_MIN) / J_PER_EV,
  };
}
