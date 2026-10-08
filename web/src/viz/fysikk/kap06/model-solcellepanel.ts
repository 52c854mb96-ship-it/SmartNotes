/**
 * Solcellepanel (k6-solcellepanel): effekten fra et solcellepanel midt på dagen en klar dag, avhengig av hvor høyt
 * sola står (stedet og årstiden) og hvor bratt panelet står.
 *
 *   P = η · I · A · cos θ
 *
 * η er virkningsgraden, I innstrålingen vinkelrett på sollyset (W/m²), A arealet til panelet og θ vinkelen mellom
 * sollyset og normalen til panelet. Panelet vender mot sør, og midt på dagen står sola i sør med solhøyden
 * h = 90° − φ + δ (φ = breddegraden, δ = +23,4° ved sommersolverv, 0 ved jevndøgn og −23,4° ved vintersolverv).
 * Da er θ = |90° − h − β| når β er vinkelen mellom panelet og vannrett.
 *
 * Innstrålingen I avtar når sola står lavt, fordi lyset går gjennom mer luft. Vi bruker en enkel modell for en klar
 * dag (Meinel og Meinel): I = S · 0,7^(m^0,678), der S er solarkonstanten og m er luftmassen (hvor mange ganger så
 * mye luft lyset går gjennom som når sola står rett over oss, etter Kasten og Young). Bare det direkte sollyset er
 * med; spredt lys fra himmelen og skyer er ikke med.
 */

/** Solarkonstanten (W/m²): innstrålingen fra sola øverst i atmosfæren, vinkelrett på strålene (som i strålingsbalansen). */
export const SOLARKONSTANT = 1361;
/** Hvor mye jordaksen heller (grader). Det gir solas deklinasjon ved solvervene. */
export const JORDAKSE = 23.4;
/** Andelen av sollyset som når fram gjennom én luftmasse i modellen (Meinel). */
const TRANSMISJON = 0.7;
/** Eksponenten på luftmassen i modellen (Meinel). */
const LUFTMASSE_EKSPONENT = 0.678;
/** Solhøyden (grader) når den øvre kanten av sola er i horisonten, med lysbrytning i lufta: soloppgang og solnedgang. */
const SOLOPPGANG_HOYDE = -0.833;

/** Ett vanlig solcellepanel: 1,7 m langt og 1,0 m bredt. */
export const PANEL = { lengde: 1.7, bredde: 1.0, areal: 1.7 } as const;

/** Glidebryterne: panelvinkelen β i grader og virkningsgraden η i prosent. */
export const SLIDERS = {
  vinkel: { min: 0, max: 90, step: 1, start: 40 },
  virkningsgrad: { min: 10, max: 25, step: 1, start: 20 },
} as const;

/** Største effekt på grafen (W): rommer det beste panelet midt på sommeren i Kristiansand. */
export const P_AKSE_MAKS = 400;

export type StedId = 'kristiansand' | 'oslo' | 'trondheim' | 'tromso';
export type Arstid = 'sommer' | 'jevndogn' | 'vinter';
export type LandskapType = 'kyst' | 'aaser' | 'fjell';

export interface Sted {
  navn: string;
  /** Breddegraden φ (grader nord). */
  breddegrad: number;
  /** Bakgrunnen i scenen. */
  landskap: LandskapType;
}

export const STEDER: Record<StedId, Sted> = {
  kristiansand: { navn: 'Kristiansand', breddegrad: 58.1, landskap: 'kyst' },
  oslo: { navn: 'Oslo', breddegrad: 59.9, landskap: 'aaser' },
  trondheim: { navn: 'Trondheim', breddegrad: 63.4, landskap: 'aaser' },
  tromso: { navn: 'Tromsø', breddegrad: 69.6, landskap: 'fjell' },
};
export const STED_IDS: StedId[] = ['kristiansand', 'oslo', 'trondheim', 'tromso'];

export interface ArstidInfo {
  navn: string;
  /** Datoen solhøyden gjelder for. */
  dato: string;
  /** Måneden, til tekster som «i desember». */
  maaned: string;
  /** Solas deklinasjon δ (grader): + når nordpolen heller mot sola. */
  deklinasjon: number;
}

export const ARSTIDER: Record<Arstid, ArstidInfo> = {
  sommer: { navn: 'Sommer', dato: '21. juni', maaned: 'juni', deklinasjon: JORDAKSE },
  jevndogn: { navn: 'Vår og høst', dato: 'jevndøgn i mars og september', maaned: 'mars og september', deklinasjon: 0 },
  vinter: { navn: 'Vinter', dato: '21. desember', maaned: 'desember', deklinasjon: -JORDAKSE },
};
export const ARSTID_IDS: Arstid[] = ['sommer', 'jevndogn', 'vinter'];

const RAD = Math.PI / 180;
const fin = (v: number, fallback: number) => (Number.isFinite(v) ? v : fallback);
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Solhøyden h (grader) midt på dagen på breddegraden φ når solas deklinasjon er δ: h = 90° − φ + δ. Negativ = under horisonten. */
export function noonAltitude(breddegrad: number, deklinasjon: number): number {
  return 90 - breddegrad + deklinasjon;
}

/**
 * Luftmassen m: hvor mange ganger så mye luft sollyset går gjennom som når sola står rett over oss (h = 90°).
 * Omtrent 1 / sin h, men endelig ved horisonten (ca. 38) etter Kasten og Young. Uendelig når sola er under horisonten.
 */
export function airMass(h: number): number {
  if (!(h > 0)) return Infinity;
  const hh = Math.min(90, h);
  return 1 / (Math.sin(hh * RAD) + 0.50572 * Math.pow(hh + 6.07995, -1.6364));
}

/** Innstrålingen I (W/m²) vinkelrett på sollyset ved bakken en klar dag med solhøyden h. 0 når sola er under horisonten. */
export function beamIrradiance(h: number, S = SOLARKONSTANT): number {
  const m = airMass(h);
  if (!Number.isFinite(m)) return 0;
  return S * Math.pow(TRANSMISJON, Math.pow(m, LUFTMASSE_EKSPONENT));
}

/**
 * Vinkelen θ (grader) mellom sollyset og normalen til et panel som vender mot sør og står med vinkelen β mot
 * vannrett, midt på dagen med solhøyden h: θ = |90° − h − β|.
 */
export function incidenceAngle(h: number, beta: number): number {
  return Math.abs(90 - h - beta);
}

/** Den beste panelvinkelen β (grader) midt på dagen: normalen peker rett mot sola, β = 90° − h. null når sola er under horisonten. */
export function bestTilt(h: number): number | null {
  if (!(h > 0)) return null;
  return clamp(90 - h, 0, 90);
}

/** Effekten P = η · I · A · cos θ (W). Ingen effekt når lyset kommer fra baksiden (θ ≥ 90°). */
export function panelPower(eta: number, I: number, A: number, theta: number): number {
  if (!(theta < 90) || !(I > 0) || !(eta > 0) || !(A > 0)) return 0;
  return eta * I * A * Math.cos(theta * RAD);
}

/**
 * Hvor lenge sola er over horisonten (timer) på breddegraden φ med deklinasjonen δ, regnet fra den øvre kanten av
 * sola og med lysbrytningen i lufta (som almanakken). 24 ved midnattssol og 0 i mørketiden.
 */
export function dayLength(breddegrad: number, deklinasjon: number): number {
  const p = breddegrad * RAD;
  const d = deklinasjon * RAD;
  const c = (Math.sin(SOLOPPGANG_HOYDE * RAD) - Math.sin(p) * Math.sin(d)) / (Math.cos(p) * Math.cos(d));
  if (c >= 1) return 0;
  if (c <= -1) return 24;
  return (2 * Math.acos(c)) / RAD / 15;
}

export interface SolarPanelState {
  /** Breddegraden φ og deklinasjonen δ (grader). */
  lat: number;
  decl: number;
  /** Solhøyden midt på dagen (grader). */
  h: number;
  /** Sola er over horisonten midt på dagen. */
  sunUp: boolean;
  /** Luftmassen (Infinity når sola er under horisonten). */
  airMass: number;
  /** Innstrålingen vinkelrett på sollyset (W/m²). */
  I: number;
  /** Panelvinkelen β og virkningsgraden η (andel, 0–1). */
  beta: number;
  eta: number;
  /** Vinkelen mellom sollyset og normalen (grader) og cos θ. */
  theta: number;
  cosTheta: number;
  /** Arealet A (m²) og tverrsnittet av lysbuntet panelet fanger, A · cos θ (m²). */
  A: number;
  effectiveArea: number;
  /** Strålingseffekten som treffer panelet, I · A · cos θ (W), og den elektriske effekten P (W). */
  incident: number;
  P: number;
  /** Den beste vinkelen og effekten der (null og 0 i mørketiden). */
  best: number | null;
  Pbest: number;
  /** Effekten om panelet ligger flatt (β = 0). */
  Pflat: number;
  /** Innstrålingen på vannrett mark, I · sin h (W/m²). */
  groundI: number;
  /** Timer med sol over horisonten den dagen. */
  dayLength: number;
}

/**
 * Hele tilstanden for et sted, en årstid, en panelvinkel β (grader) og en virkningsgrad η (prosent). Ugyldige tall
 * klemmes til glidebryterne, så resultatet alltid er endelig.
 */
export function solarPanel(sted: StedId, arstid: Arstid, betaDeg: number, etaPct: number, A: number = PANEL.areal): SolarPanelState {
  const lat = STEDER[sted].breddegrad;
  const decl = ARSTIDER[arstid].deklinasjon;
  const beta = clamp(fin(betaDeg, SLIDERS.vinkel.start), 0, 90);
  const eta = clamp(fin(etaPct, SLIDERS.virkningsgrad.start), 0, 100) / 100;
  const h = noonAltitude(lat, decl);
  const sunUp = h > 0;
  const I = beamIrradiance(h);
  const theta = incidenceAngle(h, beta);
  const cosTheta = theta < 90 ? Math.cos(theta * RAD) : 0;
  const P = sunUp ? panelPower(eta, I, A, theta) : 0;
  const best = bestTilt(h);
  const Pbest = best === null ? 0 : panelPower(eta, I, A, incidenceAngle(h, best));
  const Pflat = sunUp ? panelPower(eta, I, A, incidenceAngle(h, 0)) : 0;
  return {
    lat,
    decl,
    h,
    sunUp,
    airMass: airMass(h),
    I,
    beta,
    eta,
    theta,
    cosTheta,
    A,
    effectiveArea: A * cosTheta,
    incident: sunUp ? I * A * cosTheta : 0,
    P,
    best,
    Pbest,
    Pflat,
    groundI: sunUp ? I * Math.sin(h * RAD) : 0,
    dayLength: dayLength(lat, decl),
  };
}

/** Effekten P (W) som funksjon av panelvinkelen β fra 0° til 90° (punkter [β, P]) for et sted og en årstid. */
export function powerCurve(sted: StedId, arstid: Arstid, etaPct: number, n = 91): [number, number][] {
  const pts: [number, number][] = [];
  const N = Math.max(2, Math.round(n));
  for (let i = 0; i < N; i++) {
    const beta = (90 * i) / (N - 1);
    pts.push([beta, solarPanel(sted, arstid, beta, etaPct).P]);
  }
  return pts;
}

/** Forholdet a / b, eller null når b er (nesten) 0, så teksten ikke viser «uendelig mange ganger». */
export function ratio(a: number, b: number): number | null {
  if (!(b > 1e-9) || !Number.isFinite(a)) return null;
  return a / b;
}
