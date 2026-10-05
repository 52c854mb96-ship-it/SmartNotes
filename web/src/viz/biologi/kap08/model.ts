/**
 * Kommunikasjonssystemer i mennesket (Bi 1 kapittel 8, KM3 og KM4): ren modell uten React.
 *
 * 1. Nerveimpulsen: membranpotensialet i en nervecelle etter et stimulus. Hvilepotensial −70 mV, terskel −55 mV,
 *    alt-eller-ingenting-aksjonspotensial med topp +30 mV, repolarisering, hyperpolarisering ned mot −80 mV og
 *    refraktærperiode. Modellen er en forenklet beskrivelse med lærebokverdiene (ikke Hodgkin–Huxley): et stimulus
 *    depolariserer membranen med S mV; når potensialet når terskelen, følger aksjonspotensialet alltid samme form.
 *    Ledningshastighet: med myelin ca. 6 m/s per µm aksondiameter (Hursh 1939), uten myelin ca. 1,1 · √d m/s
 *    (0,5–2 m/s i tynne C-fibre, ca. 25 m/s i blekksprutens kjempeakson på 0,5 mm).
 * 2. Synapsen: signalstoff som frigjøres når aksjonspotensialer kommer til endeknappen, fjernes ved reopptak og
 *    nedbryting, og binder seg til reseptorer på neste celle (EPSP, summering og eventuelt nytt aksjonspotensial).
 * 3. Blodsukkeret: en enkel modell av glukose, insulin og glukagon gjennom et døgn med negativ tilbakekobling.
 *    Tallene er valgt så de ligner virkelige forløp (fastende ca. 5 mmol/L, topp ca. 7–8 mmol/L etter et måltid hos
 *    friske), men modellen er ikke en medisinsk simulator.
 */
import { solveOde, valueAt, type OdeSolution } from '../kit';

/* ====================================================================== */
/* 1. Nerveimpulsen                                                         */
/* ====================================================================== */

/** Hvilepotensial (mV). */
export const V_REST = -70;
/** Terskelverdi (mV). */
export const V_THRESHOLD = -55;
/** Toppen av aksjonspotensialet (mV). */
export const V_PEAK = 30;
/** Bunnen av hyperpolariseringen (mV). */
export const V_AHP = -80;

/** Tid fra terskel til topp (ms) når aksjonspotensialet starter ved terskelen. */
const T_RISE = 0.45;
/** Tid fra toppen ned til bunnen av hyperpolariseringen (ms). */
const T_FALL = 1.6;
/** Tidskonstant for at potensialet går tilbake til hvilepotensialet etter hyperpolariseringen (ms). */
const T_RECOVER = 2;
/** Tid stimuluset bruker på å depolarisere membranen (ms). */
export const STIM_RAMP = 0.2;
/** Tidskonstant for at en lokal (gradert) depolarisering under terskelen dør ut (ms). */
export const TAU_LOCAL = 1.5;
/** Absolutt refraktærperiode: fra terskelen er nådd til natriumkanalene kan åpnes igjen (ms). */
export const ABS_REFRACTORY = 2;
/** Slutten av den relative refraktærperioden (ms etter terskelen). */
export const REL_REFRACTORY = 6;

/** Tidspunktet i malen der aksjonspotensialet er på toppen. */
export function riseTime(v0 = V_THRESHOLD): number {
  return (T_RISE * (V_PEAK - v0)) / (V_PEAK - V_THRESHOLD);
}

const ease = (u: number) => (1 - Math.cos(Math.PI * Math.min(1, Math.max(0, u)))) / 2;

/**
 * Aksjonspotensialet som funksjon av tida τ (ms) etter at terskelen ble nådd, med startverdi v0 (vanligvis
 * terskelen). Formen er alltid den samme: alt eller ingenting.
 */
export function apTemplate(tau: number, v0 = V_THRESHOLD): number {
  if (tau < 0) return v0;
  const tr = riseTime(v0);
  if (tau < tr) return v0 + (V_PEAK - v0) * ease(tau / tr);
  const tf = tr + T_FALL;
  if (tau < tf) return V_PEAK + (V_AHP - V_PEAK) * ease((tau - tr) / T_FALL);
  return V_REST + (V_AHP - V_REST) * Math.exp(-(tau - tf) / T_RECOVER);
}

/** Når potensialet krysser hvilepotensialet på vei ned (ms etter terskelen): slutten av repolariseringen. */
export function repolarisedAt(v0 = V_THRESHOLD): number {
  const tr = riseTime(v0);
  // ease(u) = (V_PEAK − V_REST) / (V_PEAK − V_AHP)
  const target = (V_PEAK - V_REST) / (V_PEAK - V_AHP);
  const u = Math.acos(1 - 2 * target) / Math.PI;
  return tr + u * T_FALL;
}

/** Den effektive terskelen τ ms etter forrige aksjonspotensial: uendelig i den absolutte, høyere i den relative. */
export function effectiveThreshold(tau: number): number {
  if (tau < 0 || tau >= REL_REFRACTORY + 6) return V_THRESHOLD;
  if (tau < ABS_REFRACTORY) return Number.POSITIVE_INFINITY;
  return V_THRESHOLD + 30 * Math.exp(-(tau - ABS_REFRACTORY) / 1.3);
}

export type Refractory = 'absolutt' | 'relativ' | null;

export function refractoryAt(tau: number): Refractory {
  if (tau < 0) return null;
  if (tau < ABS_REFRACTORY) return 'absolutt';
  if (tau < REL_REFRACTORY) return 'relativ';
  return null;
}

/** Lokal depolarisering fra et stimulus på S mV som ikke gir aksjonspotensial: stiger i 0,2 ms og dør så ut. */
export function localResponse(dt: number, S: number): number {
  if (dt < 0) return 0;
  if (dt < STIM_RAMP) return (S * dt) / STIM_RAMP;
  return S * Math.exp(-(dt - STIM_RAMP) / TAU_LOCAL);
}

/**
 * Hvor mye av et stimulus som virker i den absolutte refraktærperioden: mange ionekanaler er åpne (særlig K⁺), så
 * membranen har lav motstand og det meste av strømmen lekker ut. Depolariseringen blir derfor bare en liten bump, ikke
 * en ny topp.
 */
export function shuntFactor(tau: number): number {
  return 1 / (1 + 6 * (naOpen(tau) + kOpen(tau)));
}

export interface Stimulus {
  /** Tidspunkt (ms). */
  t: number;
  /** Hvor mange mV stimuluset depolariserer membranen. */
  S: number;
}

export interface StimulusResult extends Stimulus {
  fired: boolean;
  /** Når terskelen ble nådd (ms), eller null. */
  crossing: number | null;
  /** Potensialet rett før stimuluset (mV). */
  vBefore: number;
  /** Terskelen da stimuluset kom (mV; uendelig i den absolutte refraktærperioden). */
  threshold: number;
  refractory: Refractory;
}

export interface NeuronRun {
  stimuli: StimulusResult[];
  /** Membranpotensialet (mV) ved tiden t (ms). */
  V: (t: number) => number;
  /** Tidspunktene der terskelen ble nådd (aksjonspotensialer). */
  spikes: number[];
}

/**
 * Membranpotensialet etter ett eller flere stimuli (i tidsrekkefølge). Et stimulus gir aksjonspotensial bare hvis
 * potensialet når den effektive terskelen og cellen ikke er i den absolutte refraktærperioden.
 */
export function simulateNeuron(input: readonly Stimulus[]): NeuronRun {
  const sorted = [...input].sort((a, b) => a.t - b.t);
  type Part = { kind: 'local'; t: number; S: number } | { kind: 'spike'; t: number; S: number; crossing: number; v0: number };
  const parts: Part[] = [];
  const spikes: number[] = [];
  // Potensialet fra delene før tidspunkt t
  const evalParts = (t: number, list: Part[]): number => {
    let v = V_REST;
    let lastSpike: Extract<Part, { kind: 'spike' }> | null = null;
    for (const p of list) if (p.kind === 'spike' && p.crossing <= t) lastSpike = p;
    if (lastSpike) v = apTemplate(t - lastSpike.crossing, lastSpike.v0);
    for (const p of list) {
      if (p.kind === 'local') v += localResponse(t - p.t, p.S);
      else if (t >= p.t && t < p.crossing) v += localResponse(t - p.t, p.S);
    }
    return v;
  };
  const stimuli: StimulusResult[] = [];
  for (const s of sorted) {
    const vBefore = evalParts(s.t, parts);
    const last = spikes.length ? spikes[spikes.length - 1]! : null;
    const tau = last === null ? Number.POSITIVE_INFINITY : s.t - last;
    const threshold = last === null ? V_THRESHOLD : effectiveThreshold(tau);
    const refractory = last === null ? null : refractoryAt(tau);
    const fired = s.S > 0 && vBefore + s.S >= threshold;
    if (fired) {
      const crossing = s.t + (STIM_RAMP * Math.max(0, threshold - vBefore)) / s.S;
      parts.push({ kind: 'spike', t: s.t, S: s.S, crossing, v0: threshold });
      spikes.push(crossing);
      stimuli.push({ ...s, fired, crossing, vBefore, threshold, refractory });
    } else {
      // I den absolutte refraktærperioden lekker det meste av stimuluset ut gjennom de åpne kanalene
      const S = refractory === 'absolutt' ? s.S * shuntFactor(tau) : s.S;
      parts.push({ kind: 'local', t: s.t, S });
      stimuli.push({ ...s, fired, crossing: null, vBefore, threshold, refractory });
    }
  }
  return { stimuli, spikes, V: (t: number) => evalParts(t, parts) };
}

/** Andel åpne natriumkanaler (0–1) τ ms etter terskelen: åpner raskt og blir inaktivert etter ca. 0,7 ms. */
export function naOpen(tau: number): number {
  if (tau < -0.15 || tau > 2) return 0;
  return Math.exp(-(((tau - 0.28) / 0.24) ** 2));
}

/** Andel åpne kaliumkanaler (0–1) τ ms etter terskelen: åpner senere og lukkes sakte (gir hyperpolariseringen). */
export function kOpen(tau: number): number {
  if (tau < 0.1) return 0;
  if (tau < 1.2) return Math.exp(-(((tau - 1.2) / 0.55) ** 2));
  return Math.exp(-(tau - 1.2) / 1.1);
}

export type NaState = 'lukket' | 'åpen' | 'inaktivert';

export interface MembraneState {
  V: number;
  na: number;
  k: number;
  naState: NaState;
  kState: 'lukket' | 'åpen';
  phase: Phase;
  refractory: Refractory;
}

export type Phase = 'hvile' | 'lokal' | 'depolarisering' | 'repolarisering' | 'hyperpolarisering';

export const PHASE_NAMES: Record<Phase, string> = {
  hvile: 'Hvilepotensial',
  lokal: 'Lokal depolarisering',
  depolarisering: 'Depolarisering',
  repolarisering: 'Repolarisering',
  hyperpolarisering: 'Hyperpolarisering',
};

/** Tilstanden i membranen ved tiden t: potensial, kanaler, fase og refraktærperiode. */
export function membraneAt(run: NeuronRun, t: number): MembraneState {
  const V = run.V(t);
  let last: number | null = null;
  for (const s of run.spikes) if (s <= t) last = s;
  const tau = last === null ? Number.POSITIVE_INFINITY : t - last;
  // Kanaler fra et aksjonspotensial som er i ferd med å starte (stimuluset er i gang)
  const upcoming = run.spikes.find((s) => s > t && s - t < 0.15);
  const na = Math.max(last === null ? 0 : naOpen(tau), upcoming === undefined ? 0 : naOpen(t - upcoming));
  const k = last === null ? 0 : kOpen(tau);
  const naState: NaState = na > 0.3 ? 'åpen' : tau < ABS_REFRACTORY ? 'inaktivert' : 'lukket';
  let phase: Phase = 'hvile';
  if (last !== null && tau < 15) {
    const v0 = V_THRESHOLD;
    if (tau < riseTime(v0)) phase = 'depolarisering';
    else if (tau < repolarisedAt(v0)) phase = 'repolarisering';
    else if (V < V_REST - 0.6) phase = 'hyperpolarisering';
  }
  if (phase === 'hvile' && V > V_REST + 0.6) phase = 'lokal';
  if (upcoming !== undefined && phase === 'lokal') phase = 'depolarisering';
  return { V, na, k, naState, kState: k > 0.25 ? 'åpen' : 'lukket', phase, refractory: last === null ? null : refractoryAt(tau) };
}

/** Minste stimulus (mV) som gir aksjonspotensial fra hvile. */
export function thresholdStimulus(): number {
  return V_THRESHOLD - V_REST;
}

/* ---------- Ledning langs aksonet ---------- */

/** Ledningshastighet med myelin (m/s) for aksondiameter d (µm): ca. 6 m/s per µm. */
export function speedMyelinated(d: number): number {
  return 6 * d;
}

/** Ledningshastighet uten myelin (m/s): ca. 1,1 · √d. */
export function speedUnmyelinated(d: number): number {
  return 1.1 * Math.sqrt(Math.max(0, d));
}

/** Avstanden mellom to Ranviers innsnøringer (µm): omtrent 100 ganger aksondiameteren. */
export function internodeLength(d: number): number {
  return 100 * d;
}

/** Tida (ms) signalet bruker på en strekning (m) med farten v (m/s). */
export function travelTimeMs(distance: number, v: number): number {
  return v > 0 ? (distance / v) * 1000 : Number.POSITIVE_INFINITY;
}

/**
 * Hvilken Ranviers innsnøring (0, 1, 2 …) som har aksjonspotensial ved tiden t (ms) i et myelinisert akson:
 * signalet hopper fra innsnøring til innsnøring (saltatorisk ledning).
 */
export function activeNode(t: number, d: number): number {
  if (t < 0) return -1;
  const hop = internodeLength(d) / 1000 / speedMyelinated(d); // ms per innsnøring
  return Math.floor(t / hop + 1e-9);
}

/* ====================================================================== */
/* 2. Synapsen                                                              */
/* ====================================================================== */

/** Tid mellom nerveimpulsene som kommer til endeknappen (ms). */
export const IMPULSE_INTERVAL = 4;
/** Første nerveimpuls (ms). */
export const FIRST_IMPULSE = 2;
/** Synapseforsinkelse: fra aksjonspotensialet når endeknappen til signalstoffet er frigjort (ms). */
export const SYNAPTIC_DELAY = 0.6;
/** Hvor lenge synapsemodellen går (ms). */
export const SYNAPSE_T_MAX = 36;
/** Reopptak (per ms) og nedbryting med enzym (per ms). */
export const K_REUPTAKE = 0.4;
export const K_ENZYME = 0.1;
/** Reopptakshemmeren blokkerer 90 % av transportproteinene. */
export const REUPTAKE_BLOCK = 0.9;
/** Reseptorblokkeren sitter i 85 % av reseptorene. */
export const RECEPTOR_BLOCK = 0.85;
/** Konsentrasjonen som gir halvparten av reseptorene bundet (samme enhet som signalstoffet i spalten). */
const KD = 0.5;
/** Membranens tidskonstant i neste celle (ms) og hvor mye full reseptoraktivering depolariserer. */
const TAU_POST = 5;
const GAIN = 40;

export interface SynapseOptions {
  impulses: number;
  reuptakeInhibitor: boolean;
  receptorBlocker: boolean;
  /** Kalibrering (for testene): depolarisering ved full reseptoraktivering (mV) og tidskonstant (ms). */
  gain?: number;
  tauPost?: number;
}

export interface SynapseRun {
  /** Tidspunktene nerveimpulsene når endeknappen (ms). */
  arrivals: number[];
  /** Signalstoff i synapsespalten (1 = det én impuls frigjør). */
  nt: (t: number) => number;
  /** Andel reseptorer som er aktivert (0–1). */
  receptors: (t: number) => number;
  /** Membranpotensialet i neste celle (mV). */
  post: (t: number) => number;
  /** Membranpotensialet i endeknappen (mV). */
  pre: (t: number) => number;
  /** Ca²⁺ som strømmer inn i endeknappen (0–1). */
  calcium: (t: number) => number;
  /** Aksjonspotensialer i neste celle (tidspunkt der terskelen ble nådd). */
  postSpikes: number[];
  /** Høyeste potensial i neste celle før et eventuelt aksjonspotensial (EPSP-toppen, mV). */
  epspPeak: number;
  /** Total fjerningsrate for signalstoffet (per ms). */
  clearance: number;
}

/** Fjerningsraten for signalstoffet i spalten (per ms). */
export function clearanceRate(reuptakeInhibitor: boolean): number {
  return K_REUPTAKE * (reuptakeInhibitor ? 1 - REUPTAKE_BLOCK : 1) + K_ENZYME;
}

/** Simulerer synapsen: frigjøring, fjerning, reseptorer og membranpotensialet i neste celle. */
export function simulateSynapse(o: SynapseOptions): SynapseRun {
  const n = Math.max(0, Math.round(o.impulses));
  const arrivals = Array.from({ length: n }, (_, i) => FIRST_IMPULSE + i * IMPULSE_INTERVAL);
  const k = clearanceRate(o.reuptakeInhibitor);
  const nt = (t: number) => {
    let c = 0;
    for (const a of arrivals) {
      const dt = t - a - SYNAPTIC_DELAY;
      if (dt > 0) c += (1 - Math.exp(-dt / 0.15)) * Math.exp(-k * dt);
    }
    return c;
  };
  const free = o.receptorBlocker ? 1 - RECEPTOR_BLOCK : 1;
  const receptors = (t: number) => {
    const c = nt(t);
    return (free * c) / (c + KD);
  };
  const calcium = (t: number) => arrivals.reduce((s, a) => s + Math.exp(-(((t - a - 0.35) / 0.3) ** 2)), 0);
  const pre = (t: number) => {
    let last: number | null = null;
    for (const a of arrivals) if (a <= t) last = a;
    return last === null ? V_REST : apTemplate(t - last);
  };
  // Neste celle: integrert med RK4 (fast steg), aksjonspotensial når terskelen nås
  const dt = 0.02;
  const steps = Math.round(SYNAPSE_T_MAX / dt);
  const ts: number[] = [];
  const vs: number[] = [];
  const postSpikes: number[] = [];
  let v = V_REST;
  let spikeAt: number | null = null;
  let epspPeak = V_REST;
  const gain = o.gain ?? GAIN;
  const tauPost = o.tauPost ?? TAU_POST;
  const dv = (t: number, x: number) => (-(x - V_REST) + gain * receptors(t)) / tauPost;
  for (let i = 0; i <= steps; i++) {
    const t = i * dt;
    let shown = v;
    if (spikeAt !== null) {
      const tau = t - spikeAt;
      if (tau < REL_REFRACTORY) {
        shown = apTemplate(tau);
        v = shown;
      } else spikeAt = null;
    }
    if (spikeAt === null && v >= V_THRESHOLD) {
      spikeAt = t;
      postSpikes.push(t);
      shown = V_THRESHOLD;
    }
    if (spikeAt === null) epspPeak = Math.max(epspPeak, v);
    ts.push(t);
    vs.push(shown);
    if (spikeAt === null) {
      const k1 = dv(t, v);
      const k2 = dv(t + dt / 2, v + (dt / 2) * k1);
      const k3 = dv(t + dt / 2, v + (dt / 2) * k2);
      const k4 = dv(t + dt, v + dt * k3);
      v += (dt / 6) * (k1 + 2 * k2 + 2 * k3 + k4);
    }
  }
  const post = (t: number) => {
    if (t <= 0) return vs[0]!;
    const i = Math.min(vs.length - 2, Math.floor(t / dt));
    const u = (t - i * dt) / dt;
    return vs[i]! + (vs[i + 1]! - vs[i]!) * Math.min(1, Math.max(0, u));
  };
  return { arrivals, nt, receptors, post, pre, calcium, postSpikes, epspPeak, clearance: k };
}

/* ====================================================================== */
/* 3. Blodsukkeret                                                          */
/* ====================================================================== */

/** Gram karbohydrat → mmol glukose (1 g glukose = 1/180 mol). */
export const MMOL_PER_GRAM = 1000 / 180;
/** Fordelingsvolum for glukose i kroppen (L) for en voksen på ca. 75 kg. */
export const VG = 15;
/** Glukoseproduksjon i leveren når vi faster (mmol/t), ca. 2 mg/kg/min. */
export const EGP_BASAL = 50;
/** Glukoseforbruk i hjernen og andre vev som ikke trenger insulin (mmol/t ved 5 mmol/L). */
export const U_BRAIN = 30;
/** Nyreterskelen: over ca. 10 mmol/L kommer det glukose i urinen. */
export const RENAL_THRESHOLD = 10;
/** Glomerulær filtrasjon (L/t), ca. 125 mL/min. */
const GFR = 7.5;
/** Normalt område for blodsukkeret hos friske (mmol/L). */
export const NORMAL_RANGE = [4, 8] as const;
/** Grense for diabetes: fastende ≥ 7,0 mmol/L og ≥ 11,1 mmol/L to timer etter glukosebelastning. */
export const DIABETES_FASTING = 7;
export const DIABETES_2H = 11.1;
/** Under ca. 4 mmol/L: lavt blodsukker (føling). */
export const HYPO = 4;

export interface Meal {
  /** Klokkeslett (timer, 0–24). */
  at: number;
  /** Gram karbohydrater. */
  grams: number;
}

export interface GlucoseParams {
  meals: readonly Meal[];
  /** Insulinproduksjonen i betacellene (0–1). Type 1-diabetes ≈ 0. */
  production: number;
  /** Insulinfølsomheten i muskler, fettvev og lever (0–1). Type 2-diabetes: lav (insulinresistens). */
  sensitivity: number;
  /** Fysisk aktivitet: en tur på 45 min etter middag (kl. 18). */
  exercise: boolean;
  /** Insulin som medisin (hurtigvirkende til måltidene og langtidsvirkende til natta). */
  insulinTherapy: boolean;
}

export const EXERCISE_START = 18;
export const EXERCISE_HOURS = 0.75;

/**
 * Kalibrering av modellen (valgt så forløpene ligner målte kurver, se testene): opptak fra tarmen (per time),
 * tidskonstanten for insulinvirkningen (timer), insulinavhengig opptak i muskler og fettvev (L/t per enhet insulin),
 * blodsukkeret der insulinutskillelsen er halvveis (mmol/L) og langtidsvirkende insulin som medisin (relativt).
 */
export interface GlucoseTuning {
  kAbs: number;
  tauX: number;
  kU: number;
  g50: number;
  basalTherapy: number;
  /** Gram karbohydrat per «enhet» hurtigvirkende insulin til måltidene (relativ skala). */
  gramsPerUnit: number;
}

export const TUNING: GlucoseTuning = { kAbs: 1.2, tauX: 0.25, kU: 2.5, g50: 7, basalTherapy: 0.92, gramsPerUnit: 18 };

const F_ABS = 0.9;

/** Insulin fra betacellene (relativt, 1 = fastende hos friske) som funksjon av blodsukkeret. */
export function insulinSecretion(G: number, production: number, g50 = TUNING.g50): number {
  const h = (g: number) => g ** 4 / (g ** 4 + g50 ** 4);
  return (production * h(Math.max(0, G))) / h(5);
}

/** Glukagon fra alfacellene (relativt): øker når blodsukkeret faller. Insulin fra betacellene demper det. */
export function glucagonSecretion(G: number, production: number): number {
  return 2 / (1 + Math.exp((production * (G - 5)) / 1.2));
}

export interface GlucoseRun {
  sol: OdeSolution;
  /** Blodsukker (mmol/L) ved klokkeslett t (0–24). */
  G: (t: number) => number;
  /** Insulin og glukagon (relativt til fastende hos friske). */
  insulin: (t: number) => number;
  glucagon: (t: number) => number;
  /** Strømmer av glukose (mmol/t) ved tiden t: fra tarmen, fra leveren, opptak i muskler/fett, hjernen og urin. */
  fluxes: (t: number) => GlucoseFluxes;
  params: GlucoseParams;
}

export interface GlucoseFluxes {
  gut: number;
  liver: number;
  muscle: number;
  brain: number;
  urine: number;
}

/** Hvor aktiv treningen er ved tiden t (0–1), og hvor mye bedre insulinfølsomheten er i timene etterpå. */
function exerciseAt(t: number, on: boolean): { active: number; after: number } {
  if (!on) return { active: 0, after: 0 };
  const day = ((t % 24) + 24) % 24;
  const active = day >= EXERCISE_START && day < EXERCISE_START + EXERCISE_HOURS ? 1 : 0;
  const since = day - EXERCISE_START;
  const after = since >= 0 ? Math.exp(-Math.max(0, since - EXERCISE_HOURS) / 6) : 0;
  return { active, after };
}

/**
 * Løser modellen fra kl. 0 dagen før til kl. 24 (så dagen vi viser starter i en realistisk fastetilstand).
 * Tilstand: [mage, tarm, G, insulin I, insulinvirkning X, glukagon A, insulin som medisin (depot), insulin som medisin (blod)].
 */
export function simulateGlucose(p: GlucoseParams, tune: GlucoseTuning = TUNING): GlucoseRun {
  const { kAbs: K_ABS, tauX, kU, g50 } = tune;
  const meals = [...p.meals.map((m) => ({ ...m, at: m.at - 24 })), ...p.meals];
  const derivs = (t: number, y: readonly number[]) => {
    const [, q2 = 0, G = 5, I = 1, X = 1, A = 1, D = 0, Ie = 0] = y;
    const ex = exerciseAt(t, p.exercise);
    const S = p.sensitivity * (1 + 0.6 * ex.after);
    const gut = F_ABS * K_ABS * q2;
    const Xtot = X;
    const liver = EGP_BASAL * A * Math.exp(-0.6 * (p.sensitivity * Xtot - 1)) * (1 + 0.5 * ex.active);
    const brain = (U_BRAIN * 1.2 * G) / (G + 1);
    const muscle = 4 * S * G * Math.max(0, 1 + kU * (Xtot - 1)) + 40 * ex.active * (G / 5);
    const urine = GFR * Math.max(0, G - RENAL_THRESHOLD);
    const dG = (gut + liver - brain - muscle - urine) / VG;
    const sec = insulinSecretion(G, p.production, g50);
    const dI = (sec + Ie - I) / 0.15;
    const dX = (I - X) / tauX;
    const dA = (glucagonSecretion(G, p.production) - A) / 0.2;
    const dD = -D / 0.6;
    const dIe = (D / 0.6 - Ie) / 0.4;
    return [-K_ABS * (y[0] ?? 0), K_ABS * (y[0] ?? 0) - K_ABS * q2, dG, dI, dX, dA, dD, dIe];
  };
  // Måltidene og insulin til måltidene legges til som «støt» ved hvert måltid: løs bit for bit
  const t0 = -24;
  let y: number[] = [0, 0, 5, 1, 1, 1, 0, 0];
  const events = meals.filter((m) => m.at >= t0 && m.at < 24).sort((a, b) => a.at - b.at);
  const ts: number[] = [];
  const ys: number[][] = [];
  let from = t0;
  const dose = (grams: number) => grams / tune.gramsPerUnit;
  const basal = p.insulinTherapy ? tune.basalTherapy : 0;
  const run = (to: number) => {
    if (to <= from) return;
    const seg = solveOde(
      (t, yy) => {
        const d = derivs(t, yy);
        // Langtidsvirkende insulin: jevnt tilskudd
        d[3] = (d[3] ?? 0) + basal / 0.15;
        return d;
      },
      y,
      { t0: from, tMax: to, dt: 0.01, nonNegative: true },
    );
    for (let i = ts.length ? 1 : 0; i < seg.t.length; i++) {
      ts.push(seg.t[i]!);
      ys.push(seg.y[i]!);
    }
    y = [...seg.y[seg.y.length - 1]!];
    from = to;
  };
  for (const m of events) {
    run(m.at);
    y[0] = (y[0] ?? 0) + m.grams * MMOL_PER_GRAM;
    if (p.insulinTherapy) y[6] = (y[6] ?? 0) + dose(m.grams);
  }
  run(24);
  const sol: OdeSolution = { t: ts, y: ys };
  const at = (t: number) => valueAt(sol, Math.min(24, Math.max(0, t)));
  const fluxes = (t: number): GlucoseFluxes => {
    const v = at(t);
    const [, q2 = 0, G = 5, , X = 1, A = 1] = v;
    const ex = exerciseAt(t, p.exercise);
    const S = p.sensitivity * (1 + 0.6 * ex.after);
    return {
      gut: F_ABS * K_ABS * q2,
      liver: EGP_BASAL * A * Math.exp(-0.6 * (p.sensitivity * X - 1)) * (1 + 0.5 * ex.active),
      muscle: 4 * S * G * Math.max(0, 1 + kU * (X - 1)) + 40 * ex.active * (G / 5),
      brain: (U_BRAIN * 1.2 * G) / (G + 1),
      urine: GFR * Math.max(0, G - RENAL_THRESHOLD),
    };
  };
  return {
    sol,
    G: (t) => at(t)[2] ?? 5,
    insulin: (t) => at(t)[3] ?? 1,
    glucagon: (t) => at(t)[5] ?? 1,
    fluxes,
    params: p,
  };
}

/** Høyeste og laveste blodsukker gjennom døgnet, og når toppen var. */
export function glucoseStats(run: GlucoseRun): { max: number; maxAt: number; min: number; fasting: number; timeOutside: number } {
  let max = -Infinity;
  let maxAt = 0;
  let min = Infinity;
  let outside = 0;
  const step = 0.05;
  for (let t = 0; t <= 24 + 1e-9; t += step) {
    const g = run.G(t);
    if (g > max) {
      max = g;
      maxAt = t;
    }
    min = Math.min(min, g);
    if (g < NORMAL_RANGE[0] || g > NORMAL_RANGE[1]) outside += step;
  }
  return { max, maxAt, min, fasting: run.G(7), timeOutside: Math.min(24, outside) };
}

export type Person = 'frisk' | 'type1' | 'type2';

/** Forhåndsvalg for personen: insulinproduksjon og insulinfølsomhet. */
export const PERSONS: Record<Person, { production: number; sensitivity: number; name: string }> = {
  frisk: { production: 1, sensitivity: 1, name: 'Frisk' },
  type1: { production: 0, sensitivity: 1, name: 'Type 1-diabetes' },
  type2: { production: 0.5, sensitivity: 0.3, name: 'Type 2-diabetes' },
};

export type MealPlan = 'vanlig' | 'sukkerrik' | 'glukosebelastning' | 'faste';

/** Måltider: frokost kl. 8, lunsj kl. 12 og middag kl. 17. Glukosebelastning = 75 g glukose kl. 8 (testen for diabetes). */
export const MEAL_TIMES = [8, 12, 17] as const;
export const MEAL_PLANS: Record<MealPlan, { name: string; grams: [number, number, number] }> = {
  vanlig: { name: 'Vanlig dag', grams: [50, 50, 80] },
  sukkerrik: { name: 'Mye sukker', grams: [100, 90, 140] },
  glukosebelastning: { name: 'Glukosebelastning', grams: [75, 0, 0] },
  faste: { name: 'Faste', grams: [0, 0, 0] },
};

export function mealsFrom(grams: readonly number[]): Meal[] {
  return MEAL_TIMES.map((at, i) => ({ at, grams: grams[i] ?? 0 })).filter((m) => m.grams > 0);
}
