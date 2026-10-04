/**
 * Diffusjon og osmose (Bi 1 kapittel 6, KM5): ren modell uten React.
 *
 * Diffusjon: oppløste partikler krysser en gjennomtrengelig membran mellom to like store rom. Hver partikkel krysser
 * tilfeldig med samme sannsynlighet per tid i begge retninger (transport.ts), så konsentrasjonsforskjellen avtar
 * eksponentielt: Δc(t) = Δc₀ · e^(−2kt).
 *
 * Osmose: en halvgjennomtrengelig membran slipper gjennom vann, men ikke sukker. Vannet strømmer mot siden med høyest
 * konsentrasjon av oppløst stoff til trykket fra vannsøylen veier opp for forskjellen i osmotisk trykk.
 *
 * Celle i løsning: rødt blodlegeme og plantecelle i en saltløsning (Boyle–van 't Hoff for volumet).
 */
import { planCrossings, solveOde, valueAt, type CrossingSpec, type OdeSolution } from '../kit';

/* ---------- Diffusjon ---------- */

/** Partikler i figuren per mmol/L (40 partikler = 20 mmol/L). */
export const PARTICLES_PER_MMOL = 2;
/** Sannsynlighet per sekund for at én partikkel krysser membranen (samme i begge retninger). */
export const CROSS_RATE = 0.05;
/** Hvor lenge diffusjonsforsøket varer (s). */
export const DIFFUSION_T_MAX = 60;
/** Antall kanalproteiner når stoffet må gjennom kanaler (fasilitert diffusjon). */
export const CHANNELS = 3;

/** Planen for partiklene: like rater begge veier, med eller uten kanalproteiner. */
export function diffusionSpec(cLeft: number, cRight: number, channels: boolean, seed = 6): CrossingSpec {
  return {
    n: [Math.round(cLeft * PARTICLES_PER_MMOL), Math.round(cRight * PARTICLES_PER_MMOL)],
    rates: [CROSS_RATE, CROSS_RATE],
    tMax: DIFFUSION_T_MAX,
    seed,
    gates: channels ? CHANNELS : 0,
    transit: 0.6,
  };
}

export function makeDiffusionTracks(cLeft: number, cRight: number, channels: boolean, seed = 6) {
  return planCrossings(diffusionSpec(cLeft, cRight, channels, seed));
}

/**
 * Forventede konsentrasjoner (gjennomsnittet av mange forsøk) ved tiden t: likevektskonsentrasjonen er snittet, og
 * forskjellen avtar med e^(−2kt).
 */
export function diffusionConcentrations(cLeft0: number, cRight0: number, t: number, k = CROSS_RATE): { left: number; right: number } {
  const eq = (cLeft0 + cRight0) / 2;
  const f = Math.exp(-2 * k * t);
  return { left: eq + (cLeft0 - eq) * f, right: eq + (cRight0 - eq) * f };
}

/** Tida det tar før konsentrasjonsforskjellen er halvert: ln 2 / (2k). */
export function diffusionHalfTime(k = CROSS_RATE): number {
  return Math.LN2 / (2 * k);
}

/** Forventet antall kryssinger per sekund fra et rom med N partikler: k · N. */
export function crossingsPerSecond(N: number, k = CROSS_RATE): number {
  return k * N;
}

/* ---------- Osmose ---------- */

/** Startvolum på hver side (mL). */
export const OSMOSIS_V0 = 100;
/** Hvor lenge osmoseforsøket varer (s, forenklet tidsskala). */
export const OSMOSIS_T_MAX = 60;
/** Vanngjennomtrengelighet (relativ volumendring per s per mol/L). */
const LP = 0.035;
/**
 * Trykket fra vannsøylen, regnet om til «konsentrasjonsenheter» per relativ volumforskjell. Valgt så nivåforskjellen
 * synes i figuren; i virkeligheten gir 0,1 mol/L sukker et osmotisk trykk som kan løfte vann ca. 25 m.
 */
const ALPHA = 1;

export interface OsmosisResult {
  sol: OdeSolution;
  /** Sukker (mmol) på hver side: endres aldri, sukkeret går ikke gjennom membranen. */
  nLeft: number;
  nRight: number;
  /** Volumet på venstre side i likevekt (relativt, 1 = start). */
  eqLeft: number;
}

/** Relative volumer: venstre V og høyre 2 − V. dV/dt = Lp · [(c_v − c_h) − α(V_v − V_h)]. */
function osmosisRate(nL: number, nR: number) {
  return (V: number) => {
    const VL = Math.max(1e-6, V);
    const VR = Math.max(1e-6, 2 - V);
    return LP * (nL / VL - nR / VR - ALPHA * (VL - VR));
  };
}

/** Volumet på venstre side (relativt) i likevekt, der osmotisk trykk og trykket fra vannsøylen er i balanse. */
export function osmosisEquilibrium(cLeft: number, cRight: number): number {
  const f = osmosisRate(cLeft, cRight);
  let lo = 1e-4;
  let hi = 2 - 1e-4;
  for (let i = 0; i < 100; i++) {
    const mid = (lo + hi) / 2;
    if (f(mid) > 0) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

/** Volumet på hver side over tid (RK4). Konsentrasjonene c i mol/L sukker ved start. */
export function osmosis(cLeft: number, cRight: number): OsmosisResult {
  const f = osmosisRate(cLeft, cRight);
  const sol = solveOde((_t, [V]) => [f(V!)], [1], { tMax: OSMOSIS_T_MAX, dt: 0.1 });
  return { sol, nLeft: cLeft, nRight: cRight, eqLeft: osmosisEquilibrium(cLeft, cRight) };
}

export interface OsmosisState {
  /** Volum (mL) på venstre og høyre side. */
  VLeft: number;
  VRight: number;
  /** Sukkerkonsentrasjon nå (mol/L). */
  cLeft: number;
  cRight: number;
  /** Netto vannstrøm (mL/s), positiv mot høyre. */
  flow: number;
}

export function osmosisAt(r: OsmosisResult, t: number): OsmosisState {
  const V = valueAt(r.sol, t)[0] ?? 1;
  const f = osmosisRate(r.nLeft, r.nRight);
  return {
    VLeft: V * OSMOSIS_V0,
    VRight: (2 - V) * OSMOSIS_V0,
    cLeft: r.nLeft / V,
    cRight: r.nRight / (2 - V),
    // dV_v/dt > 0 betyr vann inn i venstre side, altså strøm mot venstre
    flow: -f(V) * OSMOSIS_V0,
  };
}

/** Osmotisk trykk Π = cRT (bar) for en løsning med c mol/L partikler ved temperaturen T (K). */
export function osmoticPressure(cOsm: number, T = 293): number {
  return cOsm * 0.08314 * T;
}

/** Høyden en vannsøyle må ha for å gi trykket p (bar): h = p/(ρg). */
export function waterColumn(pBar: number): number {
  return (pBar * 1e5) / (1000 * 9.81);
}

/* ---------- Celle i løsning ---------- */

/** Saltløsningen som er isoton med blodet og cellesaften i modellen: fysiologisk saltvann, 0,9 % NaCl. */
export const C_ISO = 0.9;
/** Andelen av blodcellens volum som ikke tar opp eller gir fra seg vann (hemoglobin og annet), Boyle–van 't Hoff. */
export const RBC_INACTIVE = 0.4;
/** Blodcellen sprekker når volumet er ca. 1,6 ganger normalt (skjer ved ca. 0,45 % NaCl). */
export const RBC_LYSIS_VOLUME = 1.6;
/** Plantecellens protoplast: andel som ikke er vann (vakuolen er nesten bare vann). */
export const PLANT_INACTIVE = 0.1;

export type Tonicity = 'hypoton' | 'isoton' | 'hyperton';

/** Saltløsning i masseprosent NaCl → osmolaritet (osmol/L): x g/100 mL, to ioner per NaCl, osmotisk koeffisient 0,93. */
export function osmolarity(pctNaCl: number): number {
  return ((pctNaCl * 10) / 58.44) * 2 * 0.93;
}

export function tonicity(pctNaCl: number): Tonicity {
  if (Math.abs(pctNaCl - C_ISO) < 0.05) return 'isoton';
  return pctNaCl < C_ISO ? 'hypoton' : 'hyperton';
}

/** Volumet til et rødt blodlegeme (1 = normalt) i en saltløsning: V = b + (1 − b) · c_iso / c. Uendelig i rent vann. */
export function rbcVolume(pctNaCl: number): number {
  if (!(pctNaCl > 0)) return Number.POSITIVE_INFINITY;
  return RBC_INACTIVE + ((1 - RBC_INACTIVE) * C_ISO) / pctNaCl;
}

/** Konsentrasjonen der blodcellen sprekker (hemolyse): V = 1,6 gir c = 0,45 % med b = 0,4. */
export function lysisConcentration(): number {
  return ((1 - RBC_INACTIVE) * C_ISO) / (RBC_LYSIS_VOLUME - RBC_INACTIVE);
}

export interface CellResult {
  tonicity: Tonicity;
  rbc: { volume: number; burst: boolean; state: 'hemolyse' | 'svulmer' | 'normal' | 'skrumper' };
  plant: { volume: number; turgor: number; state: 'turgid' | 'slapp' | 'plasmolyse' };
  /** Netto vannstrøm: inn i cellene, ut av cellene eller ingen. */
  water: 'inn' | 'ut' | 'ingen';
}

/**
 * Likevekten for begge cellene i en saltløsning (masseprosent NaCl).
 * - Blodcellen har ingen cellevegg: den sveller (og sprekker ved V ≥ 1,6) eller skrumper.
 * - Plantecellen har cellevegg: i hypoton løsning presses protoplasten mot veggen, og turgortrykket blir
 *   forskjellen i osmotisk trykk (bar, ved 20 °C). I hyperton løsning slipper membranen veggen (plasmolyse).
 */
export function cellInSolution(pctNaCl: number): CellResult {
  const ton = tonicity(pctNaCl);
  const V = rbcVolume(pctNaCl);
  const burst = V >= RBC_LYSIS_VOLUME;
  const rbcState = burst ? 'hemolyse' : ton === 'hypoton' ? 'svulmer' : ton === 'hyperton' ? 'skrumper' : 'normal';
  const plantFree = pctNaCl > 0 ? PLANT_INACTIVE + ((1 - PLANT_INACTIVE) * C_ISO) / pctNaCl : Number.POSITIVE_INFINITY;
  const plantVolume = Math.min(1, plantFree);
  const turgor = Math.max(0, osmoticPressure(osmolarity(C_ISO) - osmolarity(pctNaCl)));
  const plantState = ton === 'hypoton' ? 'turgid' : ton === 'isoton' ? 'slapp' : 'plasmolyse';
  return {
    tonicity: ton,
    rbc: { volume: V, burst, state: rbcState },
    plant: { volume: ton === 'isoton' ? 1 : plantVolume, turgor: ton === 'hypoton' ? turgor : 0, state: plantState },
    water: ton === 'hypoton' ? 'inn' : ton === 'hyperton' ? 'ut' : 'ingen',
  };
}
