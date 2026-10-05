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

/* ====================================================================== */
/* Membrantransport (KM5)                                                   */
/* ====================================================================== */

/**
 * Hvor lett stoffer kommer gjennom selve lipiddobbeltlaget. Rekkefølgen følger målte permeabilitetskoeffisienter for
 * rene lipiddobbeltlag (Alberts mfl., Molecular Biology of the Cell): små upolare molekyler (O₂, CO₂) går lett
 * gjennom, vann sakte, glukose nesten ikke (ca. 10⁵ ganger saktere enn vann) og ioner praktisk talt ikke (ca. 10⁹–10¹⁰
 * ganger saktere enn vann). `rel` er en forenklet, relativ fart brukt i figuren (O₂ = 1).
 */
export type Substance = 'O2' | 'CO2' | 'steroid' | 'vann' | 'glukose' | 'Na';

export interface SubstanceInfo {
  navn: string;
  formel: string;
  /** Hva slags partikkel det er (forklarer hvorfor den går eller ikke går gjennom lipidene). */
  slag: string;
  /** Relativ fart gjennom lipiddobbeltlaget per konsentrasjonsforskjell (O₂ = 1). */
  rel: number;
  passasje: 'lett' | 'sakte' | 'nesten ikke' | 'ikke';
}

export const SUBSTANCES: Record<Substance, SubstanceInfo> = {
  O2: { navn: 'Oksygen', formel: 'O₂', slag: 'lite, upolart molekyl', rel: 1, passasje: 'lett' },
  CO2: { navn: 'Karbondioksid', formel: 'CO₂', slag: 'lite, upolart molekyl', rel: 0.8, passasje: 'lett' },
  steroid: { navn: 'Steroidhormon', formel: 'kortisol', slag: 'fettløselig molekyl', rel: 0.5, passasje: 'lett' },
  vann: { navn: 'Vann', formel: 'H₂O', slag: 'lite, polart molekyl', rel: 0.08, passasje: 'sakte' },
  glukose: { navn: 'Glukose', formel: 'C₆H₁₂O₆', slag: 'stort, polart molekyl', rel: 0, passasje: 'nesten ikke' },
  Na: { navn: 'Natriumion', formel: 'Na⁺', slag: 'ion med ladning', rel: 0, passasje: 'ikke' },
};

/** Partikler i figuren per mmol/L i membranbildene. */
export const MT_PARTICLES_PER_MMOL = 1.5;
/** Kryssingssannsynlighet per s for O₂ (rel = 1) i figuren. */
export const MT_BASE_RATE = 0.06;
export const MT_T_MAX = 60;

/** Netto transport inn i cellen gjennom lipidlaget (partikler per s i figuren): k · rel · (N_ute − N_inne). */
export function passiveNetRate(sub: Substance, cOut: number, cIn: number): number {
  return MT_BASE_RATE * SUBSTANCES[sub].rel * MT_PARTICLES_PER_MMOL * (cOut - cIn);
}

/* ---------- Fasilitert diffusjon ---------- */

/**
 * Glukosetransportør (GLUT1, som finnes i de fleste celler, f.eks. røde blodlegemer og hjernen): bæreprotein som veksler
 * mellom å være åpent mot utsiden og mot innsiden. Km ≈ 2 mmol/L (GLUT1 ca. 1–3; GLUT4 i muskel- og fettceller ca. 5;
 * GLUT2 i leveren ca. 15–20) og ca. 1000 molekyler per sekund per bæreprotein (størrelsesorden). Blodsukkeret er normalt
 * ca. 4–6 mmol/L.
 */
export const GLUT = { Km: 2, kcat: 1000 } as const;

/** Andelen av bæreproteinene som har bundet glukose fra én side ved konsentrasjonen c: c/(c + Km). */
export function carrierOccupancy(c: number, Km: number = GLUT.Km): number {
  return c > 0 ? c / (c + Km) : 0;
}

/**
 * Netto glukose inn (molekyler per s) gjennom n bæreproteiner (symmetrisk bærer): n · kcat · (c_ute/(c_ute + Km) −
 * c_inne/(c_inne + Km)). Mettes når alle bæreproteinene er opptatt: aldri mer enn n · kcat.
 */
export function carrierFlux(cOut: number, cIn: number, n: number, Km: number = GLUT.Km, kcat: number = GLUT.kcat): number {
  return Math.max(0, n) * kcat * (carrierOccupancy(cOut, Km) - carrierOccupancy(cIn, Km));
}

/** Høyeste fart med n bæreproteiner (metning): n · kcat. */
export function carrierVmax(n: number, kcat: number = GLUT.kcat): number {
  return Math.max(0, n) * kcat;
}

/**
 * Det netto glukose inn flater ut mot når det er svært mye glukose ute: n · kcat · (1 − c_inne/(c_inne + Km)). Når det
 * er glukose inne, frakter noen av bæreproteinene glukose ut igjen, så nettoen når aldri helt opp til n · kcat.
 */
export function carrierNetMax(cIn: number, n: number, Km: number = GLUT.Km, kcat: number = GLUT.kcat): number {
  return carrierVmax(n, kcat) * (1 - carrierOccupancy(cIn, Km));
}

/**
 * Kaliumkanal: en åpen kanal slipper gjennom ca. 10⁶–10⁸ ioner per sekund (Hille, Ion Channels of Excitable
 * Membranes). Her: 10⁵ ioner per s per mmol/L forskjell, så 136 mmol/L gir ca. 1,4 · 10⁷ per s. Spenningen over
 * membranen er ikke tatt med.
 */
export const K_CHANNEL = { g: 1e5 } as const;

/** Netto ioner ut av cellen (per s) gjennom n åpne kanaler: n · g · (c_inne − c_ute). Rett linje, ingen metning. */
export function channelFlux(cIn: number, cOut: number, n: number, g: number = K_CHANNEL.g): number {
  return Math.max(0, n) * g * (cIn - cOut);
}

/* ---------- Aktiv transport: natrium-kalium-pumpa ---------- */

/** Typiske konsentrasjoner (mmol/L) utenfor og inne i en dyrecelle (lærebokverdier). */
export const ION = { naOut: 145, naIn: 12, kOut: 4, kIn: 140 } as const;
/** Na⁺ inne (mmol/L) som gir halv pumpefart. */
export const PUMP_KM = 10;
/** Lekkasje av Na⁺ inn og K⁺ ut gjennom kanaler (relative konstanter, regnet ut så full ATP gir verdiene i ION). */
const LEAK_NA = 1;
const J_FULL = (LEAK_NA * (ION.naOut - ION.naIn)) / 3;
const PUMP_JMAX = (J_FULL * (ION.naIn + PUMP_KM)) / ION.naIn;
const LEAK_K = (2 * J_FULL) / (ION.kIn - ION.kOut);

/** Pumperunder per sekund for én pumpe ved full ATP-tilgang (størrelsesorden ca. 100 per s ved 37 °C). */
export const PUMP_CYCLES_PER_S = 100;

export interface PumpState {
  /** Na⁺ og K⁺ inne i cellen i likevekt (mmol/L). */
  naIn: number;
  kIn: number;
  /** Pumpefart som andel av farten ved full ATP-tilgang (1 = normalt). */
  rate: number;
  /** ATP brukt per sekund per pumpe (én ATP per runde). */
  atpPerS: number;
}

/**
 * Likevekten med pumpeaktivitet a (0–1, ATP-tilgang): lekkasjen av Na⁺ inn er lik 3 · pumpefarten, og lekkasjen av
 * K⁺ ut er lik 2 · pumpefarten. Pumpefarten J = Jmax · a · Na/(Na + Km). Uten ATP (a = 0) blir konsentrasjonene like
 * på begge sider. Spenningen over membranen og osmosen (cellen sveller) er ikke tatt med.
 */
export function pumpSteadyState(a: number): PumpState {
  const act = Math.min(1, Math.max(0, a));
  const g = (x: number) => LEAK_NA * (ION.naOut - x) - 3 * PUMP_JMAX * act * (x / (x + PUMP_KM));
  let lo = 0;
  let hi: number = ION.naOut;
  for (let i = 0; i < 80; i++) {
    const mid = (lo + hi) / 2;
    if (g(mid) > 0) lo = mid;
    else hi = mid;
  }
  const naIn = (lo + hi) / 2;
  const J = PUMP_JMAX * act * (naIn / (naIn + PUMP_KM));
  const kIn = ION.kOut + (2 * J) / LEAK_K;
  const rate = J / J_FULL;
  return { naIn, kIn, rate, atpPerS: rate * PUMP_CYCLES_PER_S };
}

export interface PumpStep {
  tittel: string;
  tekst: string;
  /** Formen på pumpa: 0 = åpen mot utsiden, 1 = åpen mot cytoplasmaet (som <NaKPumpe state>). */
  state: number;
  /** Fosfatgruppen fra ATP sitter på pumpa. */
  fosfat: boolean;
  /** Antall Na⁺ og K⁺ som sitter i pumpa ved slutten av steget. */
  na: number;
  k: number;
}

/** De seks stegene i én runde av natrium-kalium-pumpa (Post–Albers-syklusen, forenklet). */
export const PUMP_STEPS: readonly PumpStep[] = [
  { tittel: '3 Na⁺ binder seg', tekst: 'Pumpa er åpen mot cytoplasmaet, og tre Na⁺ fra innsiden binder seg.', state: 1, fosfat: false, na: 3, k: 0 },
  { tittel: 'ATP spaltes', tekst: 'ATP spaltes til ADP og fosfat. Fosfatgruppen binder seg til pumpa.', state: 1, fosfat: true, na: 3, k: 0 },
  { tittel: 'Na⁺ slippes ut', tekst: 'Pumpa skifter form, åpner seg mot utsiden og slipper ut de tre Na⁺.', state: 0, fosfat: true, na: 0, k: 0 },
  { tittel: '2 K⁺ binder seg', tekst: 'To K⁺ fra utsiden binder seg til pumpa.', state: 0, fosfat: true, na: 0, k: 2 },
  { tittel: 'Fosfatet slipper', tekst: 'Fosfatgruppen løsner, og pumpa skifter tilbake til formen som er åpen mot cytoplasmaet.', state: 1, fosfat: false, na: 0, k: 2 },
  { tittel: 'K⁺ slippes inn', tekst: 'De to K⁺ slippes inn i cellen. Pumpa er klar for en ny runde.', state: 1, fosfat: false, na: 0, k: 0 },
];

/** Per runde: 3 Na⁺ ut, 2 K⁺ inn og én ATP. Netto flyttes én positiv ladning ut (pumpa er elektrogen). */
export function pumpPerCycle(cycles: number): { naOut: number; kIn: number; atp: number; charge: number } {
  return { naOut: 3 * cycles, kIn: 2 * cycles, atp: cycles, charge: 3 * cycles - 2 * cycles };
}

/* ---------- Endo- og eksocytose ---------- */

export type VesicleKind = 'endo' | 'ekso';

export interface VesiclePhase {
  /** Fasen starter ved denne andelen av forløpet (0–1). */
  from: number;
  tittel: string;
}

/**
 * Fasene i endo- og eksocytose. Eksocytose er geometrisk det samme som endocytose spilt baklengs: en vesikkel smelter
 * sammen med cellemembranen i stedet for å snøres av fra den.
 */
export const VESICLE_PHASES: Record<VesicleKind, readonly VesiclePhase[]> = {
  endo: [
    { from: 0, tittel: 'Stoffet fester seg til membranen' },
    { from: 0.15, tittel: 'Membranen buler innover og omslutter stoffet' },
    { from: 0.6, tittel: 'Vesikkelen snøres av' },
    { from: 0.72, tittel: 'Vesikkelen fraktes inn i cellen' },
  ],
  ekso: [
    { from: 0, tittel: 'Vesikkelen fraktes til membranen' },
    { from: 0.28, tittel: 'Vesikkelen smelter sammen med membranen' },
    { from: 0.4, tittel: 'Innholdet slippes ut' },
    { from: 0.85, tittel: 'Vesikkelmembranen er blitt en del av cellemembranen' },
  ],
};

/** Indeksen til fasen ved andelen p av forløpet. */
export function vesiclePhase(kind: VesicleKind, p: number): number {
  const phases = VESICLE_PHASES[kind];
  let i = 0;
  for (let j = 0; j < phases.length; j++) if (p >= phases[j]!.from) i = j;
  return i;
}

/**
 * Hvor dypt lomma i membranen er (relativt til vesikkelradien, −1 = flat membran, 1 = helt lukket) og hvor langt
 * vesikkelen har flyttet seg (0 = ved membranen, 1 = helt inne) ved andelen p av en endocytose. Eksocytose: bruk 1 − p.
 */
export function endocytosisShape(p: number): { depth: number; detached: boolean; travel: number } {
  const q = Math.min(1, Math.max(0, p));
  if (q < 0.15) return { depth: -1, detached: false, travel: 0 };
  if (q < 0.6) {
    const u = (q - 0.15) / 0.45;
    return { depth: -1 + 1.92 * (u * u * (3 - 2 * u)), detached: false, travel: 0 };
  }
  if (q < 0.72) return { depth: 0.92 + 0.08 * ((q - 0.6) / 0.12), detached: q >= 0.66, travel: 0 };
  const u = (q - 0.72) / 0.28;
  return { depth: 1, detached: true, travel: u * u * (3 - 2 * u) };
}

/** Overflaten (µm²) av en vesikkel med diameter d (nm): πd². En vanlig vesikkel (100 nm) har ca. 0,03 µm². */
export function vesicleArea(dNm: number): number {
  return Math.PI * (dNm / 1000) ** 2;
}

/* ====================================================================== */
/* Cellesignalering (KM5, KM4)                                              */
/* ====================================================================== */

export type HormoneKind = 'vannloselig' | 'fettloselig';

export interface CascadeLevel {
  /** Navn på trinnet (det som blir aktivt eller laget). */
  navn: string;
  /** Kort navn til trange figurer. */
  kort: string;
  /** Hvor mange ganger flere som blir aktive eller laget på dette trinnet enn på trinnet før. */
  gain: number;
}

export interface Cascade {
  levels: readonly CascadeLevel[];
  /** Tidskonstant per trinn (i `unit`). */
  tau: number;
  unit: 's' | 'min';
  /** Hvor lenge forløpet vises (i `unit`). */
  tMax: number;
}

/**
 * Signalkjedene, med forsterkning i størrelsesorden som i lærebøkene (Campbell Biology, figuren om adrenalin og
 * glykogennedbrytning i en levercelle):
 * - Vannløselig hormon (adrenalin, glukagon): reseptor i membranen → G-protein og adenylatsyklase (ca. 10²) → cAMP
 *   (sekundært budbringerstoff, ca. 10⁴) → proteinkinase A (ca. 10⁴) → fosforylase (ca. 10⁶) → glukose fra glykogen
 *   (ca. 10⁸). Respons på sekunder.
 * - Fettløselig hormon (kortisol, østrogen, testosteron): går gjennom membranen, binder seg til en reseptor inne i
 *   cellen → kompleks som binder seg til DNA → mRNA (ca. 10 per kompleks) → proteiner (ca. 1000 per mRNA). Respons
 *   på timer, men varer lenger.
 * Tallene er størrelsesordener; tidene er forenklet til et fast tidsforløp per trinn.
 */
export const CASCADES: Record<HormoneKind, Cascade> = {
  vannloselig: {
    levels: [
      { navn: 'Hormon bundet til reseptoren', kort: 'Hormon på reseptor', gain: 1 },
      { navn: 'Aktive G-proteiner og adenylatsyklase', kort: 'G-protein og enzym', gain: 100 },
      { navn: 'cAMP (sekundært budbringerstoff)', kort: 'cAMP', gain: 100 },
      { navn: 'Aktive proteinkinaser', kort: 'Proteinkinase', gain: 1 },
      { navn: 'Aktive enzymer (fosforylase)', kort: 'Fosforylase', gain: 100 },
      { navn: 'Glukose fra glykogen', kort: 'Glukose', gain: 100 },
    ],
    tau: 1,
    unit: 's',
    tMax: 20,
  },
  fettloselig: {
    levels: [
      { navn: 'Hormon bundet til reseptoren i cellen', kort: 'Hormon på reseptor', gain: 1 },
      { navn: 'Hormon–reseptor-kompleks på DNA', kort: 'Kompleks på DNA', gain: 1 },
      { navn: 'mRNA (avskrift av genet)', kort: 'mRNA', gain: 10 },
      { navn: 'Nye proteiner (enzymer)', kort: 'Proteiner', gain: 1000 },
    ],
    tau: 15,
    unit: 'min',
    tMax: 180,
  },
};

/** Forsterkningen i hele kjeden: produktet av alle trinnene (10⁸ for adrenalin, 10⁴ for kortisol). */
export function amplification(kind: HormoneKind): number {
  return CASCADES[kind].levels.reduce((p, l) => p * l.gain, 1);
}

/** Antall molekyler på hvert trinn når hele kjeden er i gang, med `hormones` hormonmolekyler bundet. */
export function cascadeTotals(kind: HormoneKind, hormones: number): number[] {
  let acc = Math.max(0, hormones);
  return CASCADES[kind].levels.map((l) => (acc *= l.gain));
}

/**
 * Hvor langt trinn i (0, 1, …) har kommet ved tiden t (0–1): trinnene følger etter hverandre som en kjede av
 * forsinkelser med tidskonstanten τ (Erlang-fordeling av orden i + 1): 1 − e^(−x) · Σ_{n ≤ i} xⁿ/n!, x = t/τ.
 */
export function cascadeProgress(kind: HormoneKind, i: number, t: number): number {
  const { tau } = CASCADES[kind];
  if (!(t > 0)) return 0;
  const x = t / tau;
  let term = 1;
  let sum = 1;
  for (let n = 1; n <= i; n++) {
    term *= x / n;
    sum += term;
  }
  return Math.min(1, Math.max(0, 1 - Math.exp(-x) * sum));
}

/** Antall molekyler på hvert trinn ved tiden t. Uten reseptor skjer det ingenting. */
export function cascadeAt(kind: HormoneKind, hormones: number, t: number, receptor = true): number[] {
  const totals = cascadeTotals(kind, receptor ? hormones : 0);
  return totals.map((n, i) => n * cascadeProgress(kind, i, t));
}

/** Tida (i kjedens enhet) før siste trinn har nådd andelen q (standard 90 %) av full respons. */
export function responseTime(kind: HormoneKind, q = 0.9): number {
  const last = CASCADES[kind].levels.length - 1;
  let lo = 0;
  let hi = CASCADES[kind].tau * 100;
  for (let k = 0; k < 80; k++) {
    const mid = (lo + hi) / 2;
    if (cascadeProgress(kind, last, mid) < q) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}
