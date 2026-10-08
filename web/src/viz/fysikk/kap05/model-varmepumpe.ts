/**
 * Modellen bak «Varmepumpe eller panelovn» (5E og 5F): en luft-til-luft-varmepumpe flytter varme fra kald uteluft
 * inn i et hus. Energien er bevart (første lov): Q_v = Q_k + W. Varme går ikke av seg selv fra kaldt til varmt
 * (andre lov), så flyttingen krever arbeid W, og jo større temperaturforskjellen er, desto mer arbeid trengs per joule.
 *
 * Varmefaktoren (COP) er ε = Q_v / W. Den ideelle (teoretisk største) varmefaktoren mellom temperaturene T_v og T_k
 * er T_v / (T_v − T_k) i kelvin. En ekte varmepumpe arbeider mellom temperaturene i kuldemediet: fordamperen i utedelen
 * er kaldere enn uteluften og kondensatoren i innedelen varmere enn inneluften, ellers ville ikke varmen gått av
 * seg selv inn og ut av kuldemediet. Den oppnår i tillegg bare en del av den ideelle verdien (tap i kompressor,
 * vifter og varmevekslere). Tallene er valgt så kurven ligner en god, moderne luft-til-luft-varmepumpe.
 *
 * Huset (den delen varmepumpa varmer) taper varme proporsjonalt med temperaturforskjellen mellom inne og ute.
 * For å holde temperaturen inne konstant må det tilføres like mye varme som huset taper. En panelovn gjør all den
 * elektriske energien om til varme: Q = W (ε = 1).
 */

/** T = t + 273,15. */
export const KELVIN = 273.15;
/** Varmetapet fra huset: 100 W for hver grad forskjell mellom inne og ute (W/K). */
export const HOUSE_LOSS = 100;
/** Så mye kaldere enn uteluften kuldemediet er i fordamperen i utedelen (K). */
export const EVAPORATOR_DT = 8;
/** Så mye varmere enn inneluften kuldemediet er i kondensatoren i innedelen (K). */
export const CONDENSER_DT = 20;
/** Andelen av den ideelle varmefaktoren (mellom temperaturene i kuldemediet) varmepumpa oppnår. */
export const QUALITY = 0.55;
export const HOURS_PER_DAY = 24;

/** Glidebryterne (°C). */
export const T_OUT_MIN = -25;
export const T_OUT_MAX = 15;
export const T_IN_MIN = 18;
export const T_IN_MAX = 24;

export const toKelvin = (t: number): number => t + KELVIN;

/**
 * Den ideelle (teoretisk største) varmefaktoren for en varmepumpe mellom T_v og T_k (kelvin): ε_maks = T_v / (T_v − T_k).
 * Uendelig når temperaturene er like (da trengs ikke arbeid for å flytte varmen).
 */
export function idealCop(Tv: number, Tk: number): number {
  if (!(Tv > Tk)) return Infinity;
  return Tv / (Tv - Tk);
}

/** Temperaturen i kuldemediet (°C): i fordamperen ute (kaldere enn lufta) og i kondensatoren inne (varmere enn lufta). */
export function refrigerantTemps(tIn: number, tOut: number): { evap: number; cond: number } {
  return { evap: tOut - EVAPORATOR_DT, cond: tIn + CONDENSER_DT };
}

/** Varmefaktoren ε = Q_v / W til varmepumpa i modellen, med inne- og utetemperatur i °C. */
export function heatPumpCop(tIn: number, tOut: number): number {
  const { evap, cond } = refrigerantTemps(tIn, tOut);
  return QUALITY * idealCop(toKelvin(cond), toKelvin(evap));
}

/** Varmen huset taper per sekund (W), som må tilføres for å holde temperaturen inne: P = 100 W/K · (t_inne − t_ute). */
export function heatNeed(tIn: number, tOut: number): number {
  return HOUSE_LOSS * Math.max(0, tIn - tOut);
}

/** Energi per døgn (kWh) når effekten er P (W): E = P · 24 h. */
export function kWhPerDay(P: number): number {
  return (P * HOURS_PER_DAY) / 1000;
}

/** Energistrømmene inn og ut av et oppvarmingsapparat: varme til huset, elektrisk energi og varme hentet ute. */
export interface HeatFlows {
  /** Varme til huset. */
  Qv: number;
  /** Elektrisk energi (arbeid). */
  W: number;
  /** Varme hentet fra uteluften (0 for en panelovn). */
  Qk: number;
}

/** Varmepumpa: Q_v er gitt, W = Q_v / ε og Q_k = Q_v − W (energibevaring). */
export function pumpFlows(Qv: number, cop: number): HeatFlows {
  const W = Qv / cop;
  return { Qv, W, Qk: Qv - W };
}

/** Panelovnen: all elektrisk energi blir varme, W = Q_v og Q_k = 0. */
export function panelFlows(Qv: number): HeatFlows {
  return { Qv, W: Qv, Qk: 0 };
}

const perDay = (f: HeatFlows): HeatFlows => ({ Qv: kWhPerDay(f.Qv), W: kWhPerDay(f.W), Qk: kWhPerDay(f.Qk) });

export interface HeatPumpState {
  tIn: number;
  tOut: number;
  /** Temperaturforskjellen inne − ute (K). */
  dT: number;
  /** Varmen huset trenger per sekund (W). */
  need: number;
  /** Varmefaktoren til varmepumpa. */
  cop: number;
  /** Den ideelle varmefaktoren mellom inne- og utetemperaturen (andre lov sin øvre grense). */
  ideal: number;
  /** Temperaturen i kuldemediet (°C). */
  refrigerant: { evap: number; cond: number };
  /** Effektene (W). */
  pump: HeatFlows;
  panel: HeatFlows;
  /** Energi per døgn (kWh). */
  day: { pump: HeatFlows; panel: HeatFlows };
  /** Strøm spart per døgn med varmepumpe i stedet for panelovner (kWh). */
  saved: number;
  /** Andelen av strømmen til panelovnene varmepumpa sparer: 1 − 1/ε. */
  savedShare: number;
}

export function heatPumpState(tIn: number, tOut: number): HeatPumpState {
  const need = heatNeed(tIn, tOut);
  const cop = heatPumpCop(tIn, tOut);
  const pump = pumpFlows(need, cop);
  const panel = panelFlows(need);
  const day = { pump: perDay(pump), panel: perDay(panel) };
  return {
    tIn,
    tOut,
    dT: tIn - tOut,
    need,
    cop,
    ideal: idealCop(toKelvin(tIn), toKelvin(tOut)),
    refrigerant: refrigerantTemps(tIn, tOut),
    pump,
    panel,
    day,
    saved: day.panel.W - day.pump.W,
    savedShare: 1 - 1 / cop,
  };
}
