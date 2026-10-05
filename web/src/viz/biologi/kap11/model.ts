/**
 * Transportsystemer i planter (Bi 1 kapittel 11, KM3): ren modell uten React.
 *
 * 1. Transpirasjon: spalteåpninger, vannets vei fra jord til luft (kohesjon og spenning) og byttet mellom CO₂-opptak og
 *    vanntap. Stomatakonduktans etter Jarvis (1976), grenselaget etter Campbell og Norman (1998), vanndamptrykk etter Tetens.
 * 2. Floemtransport: kilder og sluk i en potetplante, trykkstrømmodellen (Münch) og ringbarking.
 * 3. Vann og mineraler: opptak i rota (osmose og aktiv transport), rottrykk og guttasjon, og mangel på N, P, K og Mg.
 */

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/* ====================================================================== */
/* Felles fysikk                                                            */
/* ====================================================================== */

/** RT/V_w ved 20 °C (MPa): vannpotensialet til luft er RT/V_w · ln(RF). */
export const RT_OVER_VW = (8.314 * 293.15) / 18.0e-6 / 1e6;
/** RT i L · MPa/mol ved 20 °C (til osmotisk potensial: ψ = −RT · c). */
export const RT_L_MPA = 0.008314 * 293.15;

/** Metningstrykket for vanndamp (kPa) ved temperaturen T (°C), Tetens' formel. 20 °C: 2,34 kPa. */
export function saturationVaporPressure(T: number): number {
  return 0.6108 * Math.exp((17.27 * T) / (T + 237.3));
}

/** Vanndampunderskuddet (VPD, kPa): hvor mye «tørrere» lufta er enn mettet luft inne i bladet. */
export function vpd(T: number, rh: number): number {
  return saturationVaporPressure(T) * (1 - clamp(rh, 0, 100) / 100);
}

/** Vannpotensialet i lufta (MPa): ψ = RT/V_w · ln(RF). 50 % gir ca. −94 MPa; 100 % gir 0. */
export function airWaterPotential(rh: number): number {
  const r = clamp(rh, 0.1, 100) / 100;
  return RT_OVER_VW * Math.log(r);
}

/**
 * Vannpotensialet i jorda (MPa) ut fra vanninnholdet som andel av feltkapasitet (Campbell 1974): ψ = ψ_fk · θ^(−b).
 * Feltkapasitet (θ = 1): −0,033 MPa. Visnegrensen (−1,5 MPa) nås ved θ = 0,3. Begrenset til −10 MPa.
 */
export const PSI_FIELD = -0.033;
export const WILTING_THETA = 0.3;
export const PSI_WILTING = -1.5;
const B_SOIL = Math.log(PSI_WILTING / PSI_FIELD) / Math.log(1 / WILTING_THETA);
export function soilWaterPotential(theta: number): number {
  const t = clamp(theta, 0.01, 1);
  return Math.max(-10, PSI_FIELD * t ** -B_SOIL);
}

/* ====================================================================== */
/* 1. Transpirasjon                                                         */
/* ====================================================================== */

export interface Weather {
  /** Lys i prosent av full sol (100 % ≈ 2000 µmol fotoner per m² per s). */
  light: number;
  /** Relativ luftfuktighet (%). */
  rh: number;
  /** Lufttemperatur (°C); bladet regnes like varmt som lufta. */
  T: number;
  /** Vindstyrke (m/s). */
  wind: number;
  /** Vann i jorda (prosent av feltkapasitet). */
  soil: number;
}

/** Største stomatakonduktans (mol/(m² · s)) for en urt med helt åpne spalteåpninger, og kutikulaens lekkasje. */
export const G_MAX = 0.4;
export const G_CUTICLE = 0.008;
/** Lufttrykk (kPa). */
export const P_AIR = 101.3;
/** CO₂ i lufta (µmol/mol) og laveste CO₂ inne i bladet. */
export const CA = 420;
export const CI_MIN = 120;
/** Vannpotensial i bladet der spalteåpningene er helt åpne og helt lukket (MPa), og der bladet mister turgor (visner). */
export const PSI_OPEN = -0.5;
export const PSI_CLOSED = -1.6;
export const PSI_TURGOR_LOSS = -1.5;
export const PSI_FULL_TURGOR = -0.3;

/** Grenselagskonduktansen for vanndamp (mol/(m² · s)) for et blad 5 cm bredt: 0,147 · √(u/d). Vindstille regnes som 0,1 m/s. */
export function boundaryConductance(wind: number, width = 0.05): number {
  return 0.147 * Math.sqrt(Math.max(0.1, wind) / width);
}

/** Lysrespons for spalteåpningene (0–1): lukket i mørke, nesten helt åpne i sterk sol. */
export function lightFactor(light: number): number {
  const par = 20 * clamp(light, 0, 100);
  return par / (par + 150);
}

/** Temperaturrespons (0–1) med optimum ved 25 °C. */
export function temperatureFactor(T: number): number {
  return clamp(1 - ((T - 25) / 25) ** 2, 0.05, 1);
}

/** Respons på tørr luft (0–1): spalteåpningene lukker seg delvis når VPD er stor. */
export function vpdFactor(D: number): number {
  return 1 / (1 + Math.max(0, D) / 4);
}

/** Respons på vannpotensialet i bladet (0–1): åpne ved −0,5 MPa, lukket ved −1,6 MPa (signalstoffet abscisinsyre). */
export function waterFactor(psiLeaf: number): number {
  return clamp((psiLeaf - PSI_CLOSED) / (PSI_OPEN - PSI_CLOSED), 0, 1);
}

/** Hydraulisk motstand fra jord til blad (MPa per mmol/(m² · s)). Øker når jorda tørker, fordi jord–rot-kontakten blir dårligere. */
export function hydraulicResistance(theta: number): number {
  return 0.15 + 0.03 / clamp(theta, 0.05, 1) ** 2;
}

/** Transpirasjon (mmol vann per m² bladflate per s) gjennom spalteåpninger med konduktans gs: E = g · VPD / p. */
export function transpirationAt(gs: number, w: Weather): number {
  const gb = boundaryConductance(w.wind);
  const g = 1 / (1 / (gs + G_CUTICLE) + 1 / gb);
  return (g * vpd(w.T, w.rh) * 1000) / P_AIR;
}

/**
 * Netto CO₂-opptak (µmol per m² per s) med konduktans gs: det minste av lysbegrenset fotosyntese og CO₂-tilførselen
 * gjennom spalteåpningene (gs/1,6 · (Ca − Ci)), myk overgang, minus celleånding. Negativt i mørke (bladet frigjør CO₂).
 */
export function photosynthesisAt(gs: number, w: Weather): number {
  const fT = temperatureFactor(w.T);
  const par = 20 * clamp(w.light, 0, 100);
  const Alight = (28 * fT * par) / (par + 350);
  const Aco2 = (gs / 1.6) * (CA - CI_MIN);
  const s = Alight + Aco2;
  const theta = 0.95;
  const A = (s - Math.sqrt(Math.max(0, s * s - 4 * theta * Alight * Aco2))) / (2 * theta);
  const Rd = 1.0 * 2 ** ((w.T - 25) / 10);
  return A - Rd;
}

export interface PlantState {
  /** Stomatakonduktans (mol/(m² · s)) og spalteåpning i prosent av helt åpen. */
  gs: number;
  opening: number;
  /** Transpirasjon (mmol/(m² · s)). */
  E: number;
  /** Netto CO₂-opptak (µmol/(m² · s)). */
  A: number;
  /** Vannutnyttelse: µmol CO₂ per mmol vann. */
  wue: number;
  /** Vannpotensial (MPa) langs veien: jord, rot, stengel, blad og luft. */
  psi: { soil: number; root: number; stem: number; leaf: number; air: number };
  /** Turgor i bladene (0 = visnet, 1 = helt spent). */
  turgor: number;
  /** Hva som begrenser spalteåpningene mest. */
  limit: 'lys' | 'vann' | 'luft' | 'temperatur' | 'ingen';
}

/**
 * Likevekt for planten: spalteåpningene avhenger av vannpotensialet i bladet, som avhenger av transpirasjonen
 * (ψ_blad = ψ_jord − E · R), som igjen avhenger av spalteåpningene. Løses med halveringsmetoden.
 */
export function plantState(w: Weather): PlantState {
  const theta = clamp(w.soil, 0, 100) / 100;
  const psiSoil = soilWaterPotential(theta);
  const R = hydraulicResistance(theta);
  const D = vpd(w.T, w.rh);
  const base = G_MAX * lightFactor(w.light) * vpdFactor(D) * temperatureFactor(w.T);
  const leafPsi = (gs: number) => psiSoil - transpirationAt(gs, w) * R;
  // F(g) = g − base · f_vann(ψ_blad(g)) øker med g
  let lo = 0;
  let hi = G_MAX;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    if (mid - base * waterFactor(leafPsi(mid)) < 0) lo = mid;
    else hi = mid;
  }
  const gs = (lo + hi) / 2;
  const E = transpirationAt(gs, w);
  const A = photosynthesisAt(gs, w);
  const psiLeaf = psiSoil - E * R;
  const factors = {
    lys: lightFactor(w.light),
    vann: waterFactor(psiLeaf),
    luft: vpdFactor(D),
    temperatur: temperatureFactor(w.T),
  };
  const [name, value] = (Object.entries(factors) as [PlantState['limit'], number][]).reduce((a, b) => (b[1] < a[1] ? b : a));
  return {
    gs,
    opening: gs / G_MAX,
    E,
    A,
    wue: E > 1e-6 ? A / E : 0,
    psi: {
      soil: psiSoil,
      root: psiSoil - E * R * 0.35,
      stem: psiSoil - E * R * 0.7,
      leaf: psiLeaf,
      air: airWaterPotential(w.rh),
    },
    turgor: clamp((psiLeaf - PSI_TURGOR_LOSS) / (PSI_FULL_TURGOR - PSI_TURGOR_LOSS), 0, 1),
    limit: value > 0.7 ? 'ingen' : name,
  };
}

/** Transpirasjon i gram vann per m² bladflate per time (1 mmol/(m² · s) = 64,8 g/(m² · h)). */
export function gramsPerHour(E: number): number {
  return E * 0.018 * 3600;
}

/* ====================================================================== */
/* 2. Floemtransport: kilder og sluk                                        */
/* ====================================================================== */

export type OrganId = 'skudd' | 'blomster' | 'blader' | 'knoll' | 'rot';
export type Role = 'kilde' | 'sluk' | 'av';

export interface Organ {
  id: OrganId;
  name: string;
  /** Hvor mye sukker organet kan levere som kilde, og hvor sterkt det trekker som sluk (relative tall). */
  source: number;
  sink: number;
}

/** Organene i potetplanten (Solanum tuberosum). Styrkene er anslag (relative), ikke målte verdier. */
export const ORGANS: readonly Organ[] = [
  { id: 'skudd', name: 'Skuddspiss og unge blader', source: 0.2, sink: 0.6 },
  { id: 'blomster', name: 'Blomster og bær', source: 0, sink: 0.5 },
  { id: 'blader', name: 'Fullt utvokste blader', source: 1, sink: 0.4 },
  { id: 'knoll', name: 'Knoller', source: 0.8, sink: 1 },
  { id: 'rot', name: 'Røtter', source: 0.15, sink: 0.35 },
];

export function getOrgan(id: OrganId): Organ {
  return ORGANS.find((o) => o.id === id)!;
}

/**
 * Plantens floem som et tre: hver node har en forelder (mot stengelfoten). Organene sitter på noder; stengelen går
 * skudd – blomster – blader – foten; under jorda går stolonen til knollene og røttene fra foten.
 */
export const NODES = ['skudd', 'blomster', 'blader', 'fot', 'knoll', 'rot'] as const;
export type NodeId = (typeof NODES)[number];
export const PARENT: Record<NodeId, NodeId | null> = {
  skudd: 'blomster',
  blomster: 'blader',
  blader: 'fot',
  fot: null,
  knoll: 'fot',
  rot: 'fot',
};
/** Motstand i hver gren (fra noden til forelderen), relativ. Stolonen og stengelen er lange. */
export const RESISTANCE: Record<NodeId, number> = { skudd: 0.6, blomster: 0.5, blader: 0.9, fot: 0, knoll: 0.8, rot: 0.5 };

export type Roles = Record<OrganId, Role>;

export interface Season {
  id: 'var' | 'sommer' | 'host';
  name: string;
  detail: string;
  roles: Roles;
}

export const SEASONS: readonly Season[] = [
  {
    id: 'var',
    name: 'Vår',
    detail: 'settepotet spirer',
    roles: { skudd: 'sluk', blomster: 'av', blader: 'sluk', knoll: 'kilde', rot: 'sluk' },
  },
  {
    id: 'sommer',
    name: 'Sommer',
    detail: 'blomstring',
    roles: { skudd: 'sluk', blomster: 'sluk', blader: 'kilde', knoll: 'sluk', rot: 'sluk' },
  },
  {
    id: 'host',
    name: 'Sensommer',
    detail: 'knollene fylles',
    roles: { skudd: 'av', blomster: 'av', blader: 'kilde', knoll: 'sluk', rot: 'sluk' },
  },
];

export function matchSeason(roles: Roles): Season['id'] | null {
  return SEASONS.find((s) => ORGANS.every((o) => s.roles[o.id] === roles[o.id]))?.id ?? null;
}

export interface PhloemResult {
  /** Netto sukker inn i floemet ved hvert organ (positivt = lastes inn i en kilde, negativt = lastes ut i et sluk). */
  net: Record<OrganId, number>;
  /** Strømmen i grenen fra noden mot forelderen (positivt = mot stengelfoten, negativt = bort fra foten). */
  flow: Record<NodeId, number>;
  /** Trykket i silrørene ved hver node (relativt, MPa over det laveste). */
  pressure: Record<NodeId, number>;
  /** Total sukkerstrøm fra kilder til sluk. */
  total: number;
  /** Sukker som hoper seg opp over ringbarkingen (kilder uten sluk i samme del), eller som mangler under. */
  surplus: number;
  deficit: number;
}

/** Noden et organ sitter på. */
const NODE_OF: Record<OrganId, NodeId> = { skudd: 'skudd', blomster: 'blomster', blader: 'blader', knoll: 'knoll', rot: 'rot' };

/** Delene av planten som henger sammen når grenen fra `cut` (bladnoden → foten) er fjernet ved ringbarking. */
function component(node: NodeId, girdled: boolean): 'over' | 'under' {
  if (!girdled) return 'under';
  let n: NodeId | null = node;
  while (n) {
    if (n === 'blader') return 'over';
    n = PARENT[n];
  }
  return 'under';
}

/**
 * Trykkstrømmodellen (Münch) på planten: kildene laster sukker inn i silrørene, slukene tar det ut. Sukkeret som
 * leveres totalt, er det minste av hva kildene kan levere og hva slukene kan ta imot, og fordeles etter styrke.
 * Med ringbarking (floemet i stengelen under bladene fjernet) regnes delen over og under hver for seg.
 * Strømmen i hver gren følger av bevaring (sum i deltreet); trykkfallet i en gren er motstand · strøm.
 */
export function phloem(roles: Roles, girdled = false, leafLight = 1): PhloemResult {
  const net = { skudd: 0, blomster: 0, blader: 0, knoll: 0, rot: 0 } as Record<OrganId, number>;
  let total = 0;
  let surplus = 0;
  let deficit = 0;
  for (const part of ['over', 'under'] as const) {
    const organs = ORGANS.filter((o) => component(NODE_OF[o.id], girdled) === part);
    const src = (o: Organ) => (roles[o.id] === 'kilde' ? o.source * (o.id === 'blader' ? leafLight : 1) : 0);
    const snk = (o: Organ) => (roles[o.id] === 'sluk' ? o.sink : 0);
    const S = organs.reduce((s, o) => s + src(o), 0);
    const D = organs.reduce((s, o) => s + snk(o), 0);
    const Q = Math.min(S, D);
    total += Q;
    if (girdled) {
      surplus += part === 'over' ? S - Q : 0;
      deficit += part === 'under' ? D - Q : 0;
    }
    for (const o of organs) net[o.id] = (S > 0 ? (src(o) * Q) / S : 0) - (D > 0 ? (snk(o) * Q) / D : 0);
  }
  // Strøm i grenene: summen av netto innlasting i deltreet under noden
  const flow = {} as Record<NodeId, number>;
  const subtree = (n: NodeId): number => {
    const own = (Object.keys(NODE_OF) as OrganId[]).filter((o) => NODE_OF[o] === n).reduce((s, o) => s + net[o], 0);
    const children = NODES.filter((c) => PARENT[c] === n);
    return own + children.reduce((s, c) => s + subtree(c), 0);
  };
  for (const n of NODES) flow[n] = PARENT[n] ? subtree(n) : 0;
  if (girdled) flow.blader = 0;
  // Trykk: P(node) = P(forelder) + R · strøm (strøm mot forelderen krever høyere trykk i noden)
  const raw = {} as Record<NodeId, number>;
  const pressureOf = (n: NodeId): number => {
    if (raw[n] !== undefined) return raw[n]!;
    const p = PARENT[n];
    const v = p === null ? 0 : pressureOf(p) + RESISTANCE[n] * flow[n];
    raw[n] = v;
    return v;
  };
  for (const n of NODES) pressureOf(n);
  // Med ringbarking er delen over et eget system: lav strøm, men trykket bygger seg opp der sukkeret hoper seg opp
  if (girdled) {
    const over = NODES.filter((n) => component(n, true) === 'over');
    const minOver = Math.min(...over.map((n) => raw[n]!));
    for (const n of over) raw[n] = raw[n]! - minOver + 0.4 * surplus;
  }
  const minP = Math.min(...NODES.map((n) => raw[n]!));
  const pressure = {} as Record<NodeId, number>;
  for (const n of NODES) pressure[n] = 0.6 * (raw[n]! - minP);
  return { net, flow, pressure, total, surplus, deficit };
}

/** Retningen sukkeret går i stengelen over bakken (grenen fra bladene til foten). */
export function stemDirection(r: PhloemResult): 'ned' | 'opp' | 'ingen' {
  const q = r.flow.blader;
  if (Math.abs(q) < 1e-6) return 'ingen';
  return q > 0 ? 'ned' : 'opp';
}

/* ====================================================================== */
/* 3. Vann og mineraler: opptak i rota                                      */
/* ====================================================================== */

export interface RootParams {
  /** Ioner (næringssalter) i jordvannet (mmol/L). */
  ions: number;
  /** O₂ i jorda (prosent av godt luftet jord). Vannmettet jord har lite O₂. */
  o2: number;
  /** NaCl i jordvannet (mmol/L), f.eks. etter veisalting eller sjøsprøyt. */
  salt: number;
}

/** Aktivt ioneopptak (Michaelis–Menten): Vmax · c / (Km + c), i prosent av største opptak. Km ≈ 2 mmol/L (anslag). */
export const KM_IONS = 2;
/** Konsentrasjonen av oppløste stoffer inne i rotcellene uten aktivt opptak (osmol/L), og hvor mye ionepumpene kan legge til. */
export const ROOT_BASE_OSM = 0.12;
export const ROOT_PUMP_OSM = 0.25;

export interface RootResult {
  /** Aktivt opptak av ioner (0–1 av maks). */
  uptake: number;
  /** Andelen av ionepumpene som får nok ATP (celleånding krever O₂). */
  atp: number;
  /** Osmotisk konsentrasjon (osmol/L) ute i jordvannet og inne i rota. */
  osmOut: number;
  osmIn: number;
  /** Vannpotensial (MPa) i jordvannet og i rota (bare det osmotiske bidraget, jorda er fuktig). */
  psiOut: number;
  psiIn: number;
  /** Netto vannstrøm inn i rota (relativ; negativ = vann går ut av rota). */
  water: number;
}

/** Celleånding i rota trenger O₂: andel ATP (0–1), halvparten ved ca. 15 % av vanlig O₂. */
export function atpSupply(o2: number): number {
  const x = clamp(o2, 0, 100);
  return (x * (100 + 15)) / (100 * (x + 15));
}

export function rootUptake({ ions, o2, salt }: RootParams): RootResult {
  const c = Math.max(0, ions);
  const atp = atpSupply(o2);
  const uptake = (atp * c) / (KM_IONS + c);
  // Hvert salt gir to ioner (osmol/L = 2 · mol/L)
  const osmOut = (2 * (c + Math.max(0, salt))) / 1000;
  const osmIn = ROOT_BASE_OSM + ROOT_PUMP_OSM * uptake;
  const psiOut = -RT_L_MPA * osmOut;
  const psiIn = -RT_L_MPA * osmIn;
  return { uptake, atp, osmOut, osmIn, psiOut, psiIn, water: (psiOut - psiIn) / (RT_L_MPA * 0.3) };
}

/* ---------- Rottrykk og guttasjon ---------- */

export interface GuttationParams {
  /** Natt (ingen lys) eller dag. */
  night: boolean;
  /** Relativ luftfuktighet (%). */
  rh: number;
  /** Vann i jorda (prosent av feltkapasitet). */
  soil: number;
}

/** Største rottrykk (MPa) i fuktig, varm jord: typisk 0,1–0,2 MPa (Taiz og Zeiger, Plant Physiology). */
export const ROOT_PRESSURE_MAX = 0.15;

export interface GuttationResult {
  /** Transpirasjon (mmol/(m² · s)) med en mild dag (20 °C, 1 m/s vind) eller natt. */
  E: number;
  /** Rottrykket (MPa) ionepumpene i rota gir. */
  rootPressure: number;
  /** Trykket i xylemet i bladene (MPa): positivt = rottrykk presser vann ut, negativt = spenning (sug) fra transpirasjonen. */
  xylem: number;
  /** Guttasjon (relativ, 0–1): vanndråper presses ut gjennom hydatoder i bladkanten. */
  guttation: number;
}

/**
 * Hvor mye vann rottrykket kan presse opp (mmol/(m² · s) per MPa): rottrykk gir bare en liten vannstrøm, langt mindre enn
 * transpirasjonen en vanlig dag (anslag).
 */
export const ROOT_CONDUCTANCE = 0.6;

export function guttation({ night, rh, soil }: GuttationParams): GuttationResult {
  const w: Weather = { light: night ? 0 : 60, rh, T: 18, wind: 1, soil };
  const s = plantState(w);
  const E = s.E;
  const theta = clamp(soil, 0, 100) / 100;
  // Rottrykk krever fuktig jord: avtar mot null når jordvannet nærmer seg visnegrensen
  const rootPressure = ROOT_PRESSURE_MAX * clamp((theta - WILTING_THETA) / (0.8 - WILTING_THETA), 0, 1);
  const Jr = rootPressure * ROOT_CONDUCTANCE;
  // Når transpirasjonen er mindre enn det rottrykket presser opp, blir det overtrykk i xylemet; ellers spenning (sug)
  const xylem = Jr > 0 && E < Jr ? rootPressure * (1 - E / Jr) : Math.min(0, s.psi.stem);
  return { E, rootPressure, xylem, guttation: Jr > 0 ? clamp((Jr - E) / Jr, 0, 1) : 0 };
}

/* ---------- Næringsmangel ---------- */

export type NutrientId = 'N' | 'P' | 'K' | 'Mg';

export interface Nutrient {
  id: NutrientId;
  name: string;
  /** Formen planten tar opp næringsstoffet i (som ioner fra jordvannet). */
  ions: string;
  /** Hva planten bruker det til. */
  role: string;
  /** Typisk mangelsymptom. */
  symptom: string;
}

/**
 * Mangelsymptomer som i lærebøker og hos NIBIO/Norsk Landbruksrådgiving. Alle fire er mobile i planten: de flyttes fra
 * eldre til yngre blader ved mangel, så symptomene viser seg først på de eldste (nederste) bladene.
 */
export const NUTRIENTS: readonly Nutrient[] = [
  {
    id: 'N',
    name: 'Nitrogen',
    ions: 'NO₃⁻ og NH₄⁺',
    role: 'proteiner, DNA og klorofyll',
    symptom: 'lysegrønne til gule eldre blader, små og spinkle planter',
  },
  { id: 'P', name: 'Fosfor', ions: 'H₂PO₄⁻', role: 'ATP, DNA og fosfolipider i membranene', symptom: 'mørkegrønne til rødlilla eldre blader, svak rotvekst' },
  { id: 'K', name: 'Kalium', ions: 'K⁺', role: 'turgor, spalteåpningene og mange enzymer', symptom: 'gule og brune, svidde bladkanter på eldre blader' },
  { id: 'Mg', name: 'Magnesium', ions: 'Mg²⁺', role: 'midt i klorofyllmolekylet', symptom: 'gult mellom grønne bladnerver på eldre blader' },
];

/** Under denne tilgangen (prosent av behovet) får planten mangelsymptomer. */
export const DEFICIENCY_LIMIT = 70;

export type NutrientLevels = Record<NutrientId, number>;

/** Hvor sterk mangelen er (0–1): 0 over grensen, 1 når næringsstoffet mangler helt. */
export function deficiency(level: number): number {
  return clamp((DEFICIENCY_LIMIT - level) / DEFICIENCY_LIMIT, 0, 1);
}

/**
 * Liebigs minimumslov: veksten begrenses av det næringsstoffet det er minst av i forhold til behovet. Vekst (0–1) =
 * minste tilgang / 100 (over 100 % gir ingen ekstra vekst).
 */
export function growth(levels: NutrientLevels): { growth: number; limiting: NutrientId | null } {
  const entries = (Object.keys(levels) as NutrientId[]).map((k) => [k, clamp(levels[k], 0, 100)] as const);
  const [k, v] = entries.reduce((a, b) => (b[1] < a[1] ? b : a));
  return { growth: v / 100, limiting: v < 100 ? k : null };
}

/**
 * Symptomstyrken på et blad med alder `age` (1 = eldste nederst, 0 = yngste øverst) for et mobilt næringsstoff:
 * eldre blader først, de yngste får symptomer bare ved sterk mangel.
 */
export function leafSymptom(def: number, age: number): number {
  return clamp(def * (0.3 + 1.1 * clamp(age, 0, 1)) - 0.12, 0, 1);
}
