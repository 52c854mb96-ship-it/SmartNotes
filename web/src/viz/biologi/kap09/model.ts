/**
 * Transportsystemer i mennesket (Bi 1 kapittel 9, KM3): ren modell uten React.
 *
 * 1. Hjertet og kretsløpet: hjertesyklusen (forkammersystole, hjertekammersystole, diastole) med tider som avhenger
 *    av pulsen, volumet i hjertekammeret, klaffene og minuttvolumet (puls · slagvolum, ca. 5 L/min i hvile).
 *    Tider: ved 75 slag/min varer en syklus 0,8 s, forkammersystolen ca. 0,1 s og hjertekammersystolen ca. 0,3 s
 *    (vanlige lærebokverdier). Ved høy puls blir særlig diastolen kortere.
 * 2. Gassutveksling: partialtrykk i alveolene og blodet, hemoglobinets metningskurve (Hill-modell med P50 = 3,5 kPa
 *    og n = 2,7) og Bohr-effekten (lav pH og høy temperatur flytter kurven mot høyre: Δlog P50 = −0,48 · ΔpH +
 *    0,024 · ΔT, Severinghaus 1979). Partialtrykk i kPa (1 kPa = 7,5 mmHg). I høyden: lavere lufttrykk, mer pusting
 *    (lavere CO₂ og basisk blod, delvis kompensert av nyrene) og samme O₂-forbruk i vevet (Fick-prinsippet).
 * 3. Fordøyelse og enzymer: hvor næringsstoffene brytes ned og tas opp, og enzymaktivitet som funksjon av pH og
 *    temperatur (optimumskurver: amylase pH 7, pepsin pH 2, trypsin og lipase pH 8; denaturering over ca. 45 °C).
 */

/* ====================================================================== */
/* 1. Hjertet                                                               */
/* ====================================================================== */

export type HeartPhase = 'forkammersystole' | 'hjertekammersystole' | 'diastole';

export const HEART_PHASE_NAMES: Record<HeartPhase, string> = {
  forkammersystole: 'Forkamrene trekker seg sammen',
  hjertekammersystole: 'Hjertekamrene trekker seg sammen (systole)',
  diastole: 'Hjertet slapper av (diastole)',
};

export interface CycleTiming {
  /** Tid for ett hjerteslag (s). */
  T: number;
  /** Forkammersystole (s). */
  atrial: number;
  /** Hjertekammersystole (s). */
  systole: number;
  /** Diastole (s). */
  diastole: number;
}

/** Tidene i hjertesyklusen ved pulsen HR (slag/min). */
export function cycleTiming(HR: number): CycleTiming {
  const T = 60 / Math.max(20, HR);
  const atrial = 0.04 + 0.08 * T;
  const systole = 0.16 + 0.18 * T;
  return { T, atrial, systole, diastole: Math.max(0, T - atrial - systole) };
}

export interface HeartState {
  phase: HeartPhase;
  /** Hvor langt i fasen (0–1). */
  u: number;
  /** Tid i det nåværende hjerteslaget (s). */
  inBeat: number;
  /** Hjerteslag nr. (0, 1, 2 …). */
  beat: number;
  /** Volum i hvert hjertekammer (mL). */
  volume: number;
  /** Seilklaffene (mellom forkammer og hjertekammer) og lommeklaffene (ut til aorta og lungearterien) er åpne. */
  avOpen: boolean;
  semilunarOpen: boolean;
  /** Hvor mye forkamrene og hjertekamrene er trukket sammen (0 = avslappet, 1 = mest sammentrukket). */
  atrialSqueeze: number;
  ventricularSqueeze: number;
}

/** Restvolumet i hjertekammeret etter systolen (mL): mindre når slagvolumet er stort (sterkere sammentrekning). */
export function endSystolicVolume(SV: number): number {
  return Math.min(80, Math.max(25, 50 - 0.25 * (SV - 70)));
}

/** Andel av systolen der begge klaffene er lukket før blodet presses ut (isovolumetrisk sammentrekning). */
const ISOVOLUMETRIC = 0.15;
/** Andel av fyllingen som skjer passivt i diastolen (resten når forkamrene trekker seg sammen). */
const PASSIVE_FILL = 0.8;

const ease = (u: number) => (1 - Math.cos(Math.PI * Math.min(1, Math.max(0, u)))) / 2;

/** Tilstanden i hjertet ved tiden t (s) med puls HR og slagvolum SV. Hvert slag starter med forkammersystolen. */
export function heartAt(t: number, HR: number, SV: number): HeartState {
  const c = cycleTiming(HR);
  const beat = Math.floor(Math.max(0, t) / c.T);
  const inBeat = Math.max(0, t) - beat * c.T;
  const esv = endSystolicVolume(SV);
  const edv = esv + SV;
  const filled = esv + PASSIVE_FILL * SV;
  if (inBeat < c.atrial) {
    const u = inBeat / c.atrial;
    return {
      phase: 'forkammersystole',
      u,
      inBeat,
      beat,
      volume: filled + (edv - filled) * ease(u),
      avOpen: true,
      semilunarOpen: false,
      atrialSqueeze: Math.sin(Math.PI * u),
      ventricularSqueeze: 0,
    };
  }
  if (inBeat < c.atrial + c.systole) {
    const u = (inBeat - c.atrial) / c.systole;
    const ejecting = u >= ISOVOLUMETRIC;
    const v = ejecting ? edv - SV * ease((u - ISOVOLUMETRIC) / (1 - ISOVOLUMETRIC)) : edv;
    return {
      phase: 'hjertekammersystole',
      u,
      inBeat,
      beat,
      volume: v,
      avOpen: false,
      semilunarOpen: ejecting && u < 0.98,
      atrialSqueeze: 0,
      ventricularSqueeze: Math.sin(Math.PI * Math.min(1, u * 1.1)) ** 0.7,
    };
  }
  const u = c.diastole > 0 ? (inBeat - c.atrial - c.systole) / c.diastole : 1;
  // Passiv fylling: raskest i begynnelsen av diastolen
  const fill = 1 - (1 - Math.min(1, u)) ** 2.2;
  return {
    phase: 'diastole',
    u,
    inBeat,
    beat,
    volume: esv + (filled - esv) * fill,
    avOpen: u > 0.06,
    semilunarOpen: false,
    atrialSqueeze: 0,
    ventricularSqueeze: 0,
  };
}

/** Minuttvolum (L/min) = puls · slagvolum. */
export function cardiacOutput(HR: number, SV: number): number {
  return (HR * SV) / 1000;
}

/** Blodvolumet i kroppen (L) for en voksen. */
export const BLOOD_VOLUME = 5;

/** Tida (min) det tar å pumpe hele blodvolumet rundt én gang. */
export function circulationTime(HR: number, SV: number): number {
  const co = cardiacOutput(HR, SV);
  return co > 0 ? BLOOD_VOLUME / co : Number.POSITIVE_INFINITY;
}

/**
 * Hvor mye blod (mL) hvert hjertekammer har pumpet ut fra t = 0 til t: slagvolumet for hvert fullførte slag, og en
 * del av det i slaget som pågår (bare mens lommeklaffene er åpne). Brukes til å flytte blodet rundt i figuren.
 */
export function ejectedVolume(t: number, HR: number, SV: number): number {
  const s = heartAt(t, HR, SV);
  const esv = endSystolicVolume(SV);
  const inCurrent = s.phase === 'hjertekammersystole' ? esv + SV - s.volume : 0;
  const done = s.beat * SV + (s.phase === 'diastole' ? SV : 0);
  return done + inCurrent;
}

export interface HeartPreset {
  id: string;
  name: string;
  HR: number;
  SV: number;
}

export const HEART_PRESETS: readonly HeartPreset[] = [
  { id: 'hvile', name: 'Hvile', HR: 70, SV: 70 },
  { id: 'trent', name: 'Trent, i hvile', HR: 48, SV: 105 },
  { id: 'gange', name: 'Gange', HR: 110, SV: 95 },
  { id: 'trening', name: 'Hard trening', HR: 180, SV: 115 },
];

/* ====================================================================== */
/* 2. Gassutveksling                                                        */
/* ====================================================================== */

/** P50 (kPa) ved pH 7,4 og 37 °C: partialtrykket der hemoglobinet er halvt mettet. */
export const P50_STANDARD = 3.5;
/** Hill-koeffisient for hemoglobin (sigmoid kurve fordi de fire hemgruppene samarbeider). */
export const HILL_N = 2.7;
/** Hemoglobin i blodet (g/L) og O₂ per gram hemoglobin (mL/g, Hüfners tall). */
export const HB = 150;
export const O2_PER_G_HB = 1.34;
/** Løst O₂ i plasma (mL O₂ per liter blod per kPa). */
const O2_DISSOLVED = 0.225;
/** Lufttrykk ved havet (kPa) og vanndamptrykket i lungene ved 37 °C (kPa). */
export const P_SEA = 101.3;
const P_H2O = 6.3;

/** Hemoglobinets metning (0–1) ved partialtrykket P (kPa): S = Pⁿ / (Pⁿ + P50ⁿ). */
export function saturation(P: number, p50 = P50_STANDARD, n = HILL_N): number {
  if (P <= 0) return 0;
  const a = P ** n;
  return a / (a + p50 ** n);
}

/** P50 (kPa) ved pH og temperatur (°C): Bohr-effekten og temperatureffekten flytter kurven. */
export function p50At(pH: number, T: number): number {
  return P50_STANDARD * 10 ** (-0.48 * (pH - 7.4) + 0.024 * (T - 37));
}

/** CO₂-trykket (kPa) som gir denne pH-en med normal bikarbonat (24 mmol/L), etter Henderson–Hasselbalch. */
export function pco2FromPh(pH: number): number {
  return 24 / (0.23 * 10 ** (pH - 6.1));
}

/** Oksygeninnhold i blodet (mL O₂ per liter blod) ved metning S og partialtrykk P. */
export function o2Content(S: number, P: number): number {
  return O2_PER_G_HB * HB * S + O2_DISSOLVED * P;
}

/** Lufttrykket (kPa) i høyden h (m over havet). */
export function airPressure(h: number): number {
  return P_SEA * Math.exp(-h / 8400);
}

/** CO₂ i alveolene (kPa): 5,3 ved havet, lavere i høyden fordi vi puster mer (hyperventilering). */
export function alveolarPCO2(h: number): number {
  return 5.3 * (airPressure(h) / P_SEA) ** 1.15;
}

/** O₂ i alveolene (kPa) etter alveolegasslikningen: P_AO₂ = 0,21 · (P − P_H₂O) − P_ACO₂ / 0,8. */
export function alveolarPO2(h: number): number {
  return Math.max(0.5, 0.2095 * (airPressure(h) - P_H2O) - alveolarPCO2(h) / 0.8);
}

/** Forskjellen mellom alveolene og blodet som forlater lungene hos friske (kPa). */
export const A_A_GRADIENT = 0.7;

/**
 * pH i arterieblodet i høyden h. Vi puster mer i høyden, CO₂ faller og blodet blir basisk (respiratorisk alkalose).
 * Nyrene skiller ut bikarbonat og tar igjen omtrent halvparten av endringen: pH = 7,4 + 0,5 · lg(P_ACO₂(0) / P_ACO₂(h)).
 * Gir ca. 7,47 på Galdhøpiggen og ca. 7,66 på toppen av Mount Everest (målt ca. 7,7).
 */
export function arterialPH(h: number): number {
  return 7.4 + 0.5 * Math.log10(alveolarPCO2(0) / alveolarPCO2(h));
}

/** Laveste O₂-trykk i blodet ut fra vevet (kPa): lavere enn dette får ikke mitokondriene nok oksygen. */
export const PV_MIN = 1;

export interface TissueCondition {
  /** O₂-trykket i blodet når det forlater vevet (kPa). */
  PO2: number;
  pH: number;
  /** Temperatur (°C). */
  T: number;
}

export const TISSUE_PRESETS: Record<'hvile' | 'arbeid', TissueCondition & { name: string }> = {
  hvile: { name: 'Hvilende vev', PO2: 5.3, pH: 7.38, T: 37 },
  arbeid: { name: 'Arbeidende muskel', PO2: 2.5, pH: 7.2, T: 39.5 },
};

export interface GasExchange {
  /** pH i arterieblodet (7,4 ved havet, høyere i høyden). */
  pHa: number;
  /** pH i blodet i vevet: vevets pH ved havet pluss den samme økningen som i arterieblodet i høyden. */
  pHt: number;
  /** O₂ og CO₂ i alveolene (kPa). */
  PAO2: number;
  PACO2: number;
  /** Blodet som forlater lungene (arterieblod). */
  PaO2: number;
  SaO2: number;
  /** Blodet som forlater vevet (veneblod). */
  PvO2: number;
  SvO2: number;
  /** CO₂ i vevet (kPa) ut fra pH. */
  PvCO2: number;
  /** P50 i lungene og i vevet (kPa). */
  p50Lung: number;
  p50Tissue: number;
  /** Oksygeninnhold (mL/L blod) i arterie- og veneblod, og hvor mye som er avgitt til vevet. */
  CaO2: number;
  CvO2: number;
  released: number;
  /** Andelen av oksygenet som ble avgitt (O₂-utnyttelse). */
  extraction: number;
  /** Hvor mye som ville vært avgitt uten Bohr-effekten (samme kurve som i lungene). */
  releasedNoBohr: number;
  /** Oksygenet vevet trenger (mL per liter blod), regnet ut fra vevets O₂-trykk ved havet. */
  demand: number;
  /** Blodet har for lite oksygen til å dekke behovet, selv om O₂-trykket i vevet er så lavt som mulig. */
  limited: boolean;
}

/** Oksygeninnholdet (mL/L) i blod som forlater vevet med O₂-trykket P og vevets P50. */
function venousContent(P: number, p50: number): number {
  return o2Content(saturation(P, p50), P);
}

/**
 * Gassutvekslingen i lungene (høyde h over havet) og i vevet.
 *
 * `tissue` beskriver vevet ved havet. I høyden blir alt blodet like mye mer basisk som arterieblodet (pH i vevet =
 * tissue.pH + pHa − 7,4), og CO₂-trykket faller i samme forhold som i alveolene.
 *
 * `tissue.PO2` er O₂-trykket i blodet som forlater vevet ved havet. Det bestemmer hvor mye oksygen vevet bruker
 * (behovet, mL per liter blod). I høyden inneholder arterieblodet mindre oksygen, så O₂-trykket i vevet må falle for at
 * vevet skal få det samme (Fick-prinsippet med samme blodstrøm): her finner vi det trykket. Kan ikke behovet dekkes
 * selv ved det laveste trykket (PV_MIN), er vevet begrenset av oksygentilførselen (`limited`).
 */
export function gasExchange(h: number, tissue: TissueCondition): GasExchange {
  const PAO2 = alveolarPO2(h);
  const PACO2 = alveolarPCO2(h);
  const PaO2 = Math.max(0.3, PAO2 - A_A_GRADIENT);
  const pHa = arterialPH(h);
  const p50Lung = p50At(pHa, 37);
  const SaO2 = saturation(PaO2, p50Lung);
  const CaO2 = o2Content(SaO2, PaO2);
  const pHt = tissue.pH + (pHa - 7.4);
  const p50Tissue = p50At(pHt, tissue.T);
  // Behovet: det vevet tar ut av blodet ved havet med dette O₂-trykket
  const PaSea = alveolarPO2(0) - A_A_GRADIENT;
  const CaSea = o2Content(saturation(PaSea, p50At(7.4, 37)), PaSea);
  const demand = Math.max(0, CaSea - venousContent(Math.min(tissue.PO2, PaSea), p50At(tissue.pH, tissue.T)));
  // O₂-trykket i blodet ut fra vevet: likt vevets trykk ved havet, lavere i høyden (aldri høyere enn i arterieblodet)
  const pMax = Math.min(tissue.PO2, PaO2);
  const target = CaO2 - demand;
  let PvO2: number;
  let limited = false;
  if (h <= 0 || venousContent(pMax, p50Tissue) <= target) PvO2 = pMax;
  else if (venousContent(Math.min(PV_MIN, pMax), p50Tissue) >= target) {
    PvO2 = Math.min(PV_MIN, pMax);
    limited = true;
  } else {
    // Halveringsmetoden: innholdet øker med trykket
    let lo = Math.min(PV_MIN, pMax);
    let hi = pMax;
    for (let i = 0; i < 60; i++) {
      const mid = (lo + hi) / 2;
      if (venousContent(mid, p50Tissue) > target) hi = mid;
      else lo = mid;
    }
    PvO2 = (lo + hi) / 2;
  }
  const SvO2 = saturation(PvO2, p50Tissue);
  const CvO2 = o2Content(SvO2, PvO2);
  const noBohr = o2Content(saturation(PvO2, p50Lung), PvO2);
  return {
    pHa,
    pHt,
    PAO2,
    PACO2,
    PaO2,
    SaO2,
    PvO2,
    SvO2,
    PvCO2: pco2FromPh(tissue.pH) * (PACO2 / alveolarPCO2(0)),
    p50Lung,
    p50Tissue,
    CaO2,
    CvO2,
    released: Math.max(0, CaO2 - CvO2),
    extraction: CaO2 > 0 ? Math.max(0, CaO2 - CvO2) / CaO2 : 0,
    releasedNoBohr: Math.max(0, CaO2 - noBohr),
    demand,
    limited,
  };
}

/**
 * O₂-trykket i blodet langs en lungekapillær (x = 0 ved inngangen, 1 ved utgangen): blodet kommer inn med Pv og
 * nærmer seg alveoletrykket PA eksponentielt. I hvile er det i likevekt etter ca. en tredjedel av kapillæren.
 */
export function capillaryPO2(x: number, Pv: number, PA: number, lambda = 0.12): number {
  return PA - (PA - Pv) * Math.exp(-Math.max(0, x) / lambda);
}

/* ====================================================================== */
/* 3. Fordøyelse og enzymer                                                 */
/* ====================================================================== */

export type EnzymeId = 'amylase' | 'pepsin' | 'trypsin' | 'lipase';

export interface Enzyme {
  id: EnzymeId;
  name: string;
  /** Hvor enzymet lages og virker. */
  source: string;
  where: string;
  substrate: string;
  product: string;
  /** pH-optimum og bredde (standardavvik i pH-enheter). */
  optPH: number;
  widthPH: number;
}

export const ENZYMES: Record<EnzymeId, Enzyme> = {
  amylase: {
    id: 'amylase',
    name: 'Amylase',
    source: 'spyttkjertlene og bukspyttkjertelen',
    where: 'munnen og tynntarmen',
    substrate: 'stivelse',
    product: 'maltose (to glukoseenheter)',
    optPH: 7,
    widthPH: 1.1,
  },
  pepsin: {
    id: 'pepsin',
    name: 'Pepsin',
    source: 'magesekken',
    where: 'magesekken',
    substrate: 'proteiner',
    product: 'peptider (korte kjeder av aminosyrer)',
    optPH: 2,
    widthPH: 0.9,
  },
  trypsin: {
    id: 'trypsin',
    name: 'Trypsin',
    source: 'bukspyttkjertelen',
    where: 'tynntarmen',
    substrate: 'proteiner og peptider',
    product: 'kortere peptider',
    optPH: 8,
    widthPH: 1,
  },
  lipase: {
    id: 'lipase',
    name: 'Lipase',
    source: 'bukspyttkjertelen',
    where: 'tynntarmen',
    substrate: 'fett (triglyserider)',
    product: 'fettsyrer og glyserol',
    optPH: 8,
    widthPH: 1.2,
  },
};

/** Aktivitet (0–1) som funksjon av pH: klokkeformet kurve rundt optimum. */
export function activityPH(e: Enzyme, pH: number): number {
  return Math.exp(-(((pH - e.optPH) / e.widthPH) ** 2) / 2);
}

/** Temperaturen der halvparten av enzymmolekylene er denaturert (°C), og hvor brått det skjer. */
export const T_DENATURE = 44;
const DENATURE_WIDTH = 2.5;
/** Reaksjonsfarten dobles omtrent for hver 10 °C (Q10 ≈ 2) så lenge enzymet ikke er denaturert. */
export const Q10 = 2;

/** Andelen enzymmolekyler som har riktig form (ikke denaturert) ved temperaturen T. */
export function nativeFraction(T: number): number {
  return 1 / (1 + Math.exp((T - T_DENATURE) / DENATURE_WIDTH));
}

function rawT(T: number): number {
  return Q10 ** ((T - 37) / 10) * nativeFraction(T);
}

/** Temperaturen med høyest aktivitet (°C). */
export const T_OPT =
  T_DENATURE + DENATURE_WIDTH * Math.log((DENATURE_WIDTH * Math.log(Q10)) / 10 / (1 - (DENATURE_WIDTH * Math.log(Q10)) / 10));

const RAW_MAX = rawT(T_OPT);

/** Aktivitet (0–1) som funksjon av temperaturen: øker med temperaturen til enzymet denatureres. */
export function activityT(T: number): number {
  return rawT(T) / RAW_MAX;
}

/** Samlet aktivitet ved pH og temperatur; `heated` = enzymet har vært varmet over 60 °C (denaturering er varig). */
export function activity(e: Enzyme, pH: number, T: number, heated = false): number {
  if (heated) return 0;
  return activityPH(e, pH) * activityT(T);
}

export type EnzymeState = 'aktivt' | 'kaldt' | 'denaturert' | 'feil-ph' | 'varmet';

export function enzymeState(e: Enzyme, pH: number, T: number, heated = false): EnzymeState {
  if (heated) return 'varmet';
  if (nativeFraction(T) < 0.5) return 'denaturert';
  if (activityPH(e, pH) < 0.3) return 'feil-ph';
  if (T < 25) return 'kaldt';
  return 'aktivt';
}

/* ---------- Fordøyelseskanalen ---------- */

export type Nutrient = 'stivelse' | 'protein' | 'fett';
export type StationId = 'munn' | 'magesekk' | 'tynntarm' | 'tykktarm';

export interface Station {
  id: StationId;
  name: string;
  pH: number;
  /** Andel av hvert næringsstoff som er brutt ned når maten forlater stedet (samlet). */
  digested: Record<Nutrient, number>;
  /** Enzymer som virker her, per næringsstoff. */
  enzymes: Record<Nutrient, string[]>;
  /** Tas næringsstoffene opp her? */
  absorbs: boolean;
}

/**
 * Hvor mye som er brutt ned etter hvert sted (forenklet etter lærebøkene): litt stivelse i munnen og i magesekken
 * (spyttamylasen virker til maten blir sur), litt protein og fett i magesekken, og resten i tynntarmen, der
 * næringsstoffene også tas opp. I tykktarmen tas vann og salter opp.
 */
export const STATIONS: readonly Station[] = [
  {
    id: 'munn',
    name: 'Munnen',
    pH: 7,
    digested: { stivelse: 0.08, protein: 0, fett: 0 },
    enzymes: { stivelse: ['amylase (spytt)'], protein: [], fett: [] },
    absorbs: false,
  },
  {
    id: 'magesekk',
    name: 'Magesekken',
    pH: 2,
    digested: { stivelse: 0.3, protein: 0.2, fett: 0.1 },
    // Spyttamylasen virker en stund inne i matklumpen til magesyren trenger inn; magesaften har litt lipase
    enzymes: { stivelse: ['amylase (fra spyttet, til maten blir sur)'], protein: ['pepsin'], fett: ['magelipase'] },
    absorbs: false,
  },
  {
    id: 'tynntarm',
    name: 'Tynntarmen',
    pH: 8,
    digested: { stivelse: 1, protein: 1, fett: 1 },
    enzymes: {
      stivelse: ['amylase (bukspytt)', 'maltase (tarmveggen)'],
      protein: ['trypsin', 'peptidaser (tarmveggen)'],
      fett: ['galle (emulgerer)', 'lipase'],
    },
    absorbs: true,
  },
  {
    id: 'tykktarm',
    name: 'Tykktarmen',
    pH: 7,
    digested: { stivelse: 1, protein: 1, fett: 1 },
    enzymes: { stivelse: [], protein: [], fett: [] },
    absorbs: false,
  },
];

export const NUTRIENTS: Record<Nutrient, { name: string; product: string; to: string; units: number }> = {
  stivelse: { name: 'Stivelse', product: 'glukose', to: 'blodet', units: 12 },
  protein: { name: 'Proteiner', product: 'aminosyrer', to: 'blodet', units: 10 },
  fett: { name: 'Fett', product: 'fettsyrer og glyserol', to: 'lymfen', units: 3 },
};

/**
 * Bitene en kjede med `units` enheter er delt i når andelen `d` er brutt ned: lengdene på bitene, fra den lengste.
 * d = 0 gir én hel kjede, d = 1 gir bare enkeltenheter. Antall enheter er alltid det samme (massen er bevart).
 */
export function fragments(units: number, d: number): number[] {
  const n = Math.max(1, Math.round(units));
  const raw = Math.min(1, Math.max(0, d)) * n;
  // Enzymene klipper først av biter på to enheter (maltose, dipeptider), så det frigjorte er et partall til slutt
  const free = d >= 0.95 ? Math.round(raw) : 2 * Math.ceil(raw / 2 - 1e-9);
  if (free >= n) return Array.from({ length: n }, () => 1);
  // Den gjenværende kjeden og de frigjorte bitene (to og to, som maltose og dipeptider, til slutt enkle)
  const rest = n - free;
  const pieces: number[] = [rest];
  let left = free;
  while (left > 0) {
    const size = left >= 2 && d < 0.95 ? 2 : 1;
    pieces.push(size);
    left -= size;
  }
  return pieces;
}
