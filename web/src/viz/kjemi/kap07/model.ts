/**
 * Ren kjemi for kapittel 7 Syrer og baser (ingen React), så den kan testes for seg.
 *
 * Konstanter og data som i Kjemi 1 (Aschehoug) og vanlige norske tabeller (Aylward og Findlay, SI Chemical Data;
 * «Tabeller og formler i kjemi»): K_w = 1,0 · 10⁻¹⁴ ved 25 °C, K_a for eddiksyre 1,8 · 10⁻⁵, maursyre 1,8 · 10⁻⁴,
 * flussyre 6,8 · 10⁻⁴, benzosyre 6,3 · 10⁻⁵, ammoniumion 5,6 · 10⁻¹⁰, hydrogenkarbonation 4,7 · 10⁻¹¹,
 * hydrogensulfation 1,0 · 10⁻², K_b for ammoniakk 1,8 · 10⁻⁵.
 */

/** Vannets ioneprodukt ved 25 °C: [H₃O⁺] · [OH⁻] = K_w. */
export const KW = 1.0e-14;
/** pK_w = −lg K_w = 14,00, så pH + pOH = 14,00 ved 25 °C. */
export const PKW = 14;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/* ---------- pH, pOH og konsentrasjoner ---------- */

/** pH = −lg[H₃O⁺] ([H₃O⁺] i mol/L). */
export function pHFromH3O(h3o: number): number {
  return -Math.log10(h3o);
}

export interface AcidityState {
  pH: number;
  pOH: number;
  /** [H₃O⁺] i mol/L. */
  h3o: number;
  /** [OH⁻] i mol/L. */
  oh: number;
}

/** Alle fire størrelsene ut fra pH ved 25 °C: [H₃O⁺] = 10^(−pH), [OH⁻] = K_w/[H₃O⁺], pOH = 14 − pH. */
export function fromPH(pH: number): AcidityState {
  const h3o = 10 ** -pH;
  return { pH, pOH: PKW - pH, h3o, oh: KW / h3o };
}

/** Hvor mange ganger større [H₃O⁺] er ved pH a enn ved pH b: 10^(b − a). Én pH-enhet er en faktor 10. */
export function h3oRatio(pHa: number, pHb: number): number {
  return 10 ** (pHb - pHa);
}

export type Character = 'sur' | 'nøytral' | 'basisk';

/** Sur (pH < 7), nøytral (pH = 7) eller basisk (pH > 7) ved 25 °C. `tol` gir et lite nøytralt område. */
export function character(pH: number, tol = 0.05): Character {
  if (pH < 7 - tol) return 'sur';
  if (pH > 7 + tol) return 'basisk';
  return 'nøytral';
}

/* ---------- Stoffer fra hverdagen ---------- */

export interface Everyday {
  id: string;
  /** Norsk navn, små bokstaver. */
  name: string;
  /** Typisk pH. */
  pH: number;
  /** Vanlig variasjon. */
  range: [number, number];
}

/**
 * Typiske pH-verdier for kjente stoffer (lærebøker og Store norske leksikon, «pH»). Verdiene varierer med merke og
 * konsentrasjon, så de er avrundet. Natron er en løsning av natriumhydrogenkarbonat, salmiakk en ammoniakkløsning og
 * lut en natriumhydroksidløsning (avløpsåpner).
 */
export const EVERYDAY: Everyday[] = [
  { id: 'magesyre', name: 'magesyre', pH: 1.5, range: [1, 2] },
  { id: 'sitronsaft', name: 'sitronsaft', pH: 2.3, range: [2, 2.6] },
  { id: 'cola', name: 'cola', pH: 2.5, range: [2.4, 2.8] },
  { id: 'kaffe', name: 'kaffe', pH: 5.0, range: [4.8, 5.2] },
  { id: 'vann', name: 'rent vann', pH: 7.0, range: [7, 7] },
  { id: 'blod', name: 'blod', pH: 7.4, range: [7.35, 7.45] },
  { id: 'sjovann', name: 'sjøvann', pH: 8.1, range: [7.9, 8.3] },
  { id: 'natron', name: 'natron', pH: 8.3, range: [8.2, 8.4] },
  { id: 'sape', name: 'såpe', pH: 10, range: [9, 10.5] },
  { id: 'salmiakk', name: 'salmiakk', pH: 11.5, range: [11, 12] },
  { id: 'lut', name: 'lut', pH: 13.5, range: [13, 14] },
];

/** Stoffet med typisk pH nærmest `pH` (innenfor `tol`), ellers null. */
export function nearestEveryday(pH: number, tol = 0.25): Everyday | null {
  let best: Everyday | null = null;
  for (const s of EVERYDAY) if (Math.abs(s.pH - pH) <= tol && (!best || Math.abs(s.pH - pH) < Math.abs(best.pH - pH))) best = s;
  return best;
}

/* ---------- Indikatorer ---------- */

export type IndicatorId = 'metyloransje' | 'metylrodt' | 'lakmus' | 'bromtymolblatt' | 'fenolftalein';

export interface Indicator {
  id: IndicatorId;
  name: string;
  /** Omslagsområdet (pH): under `low` har indikatoren syrefargen, over `high` basefargen. */
  low: number;
  high: number;
  /** Fargeord for den sure formen, overgangen og den basiske formen. */
  acidColor: string;
  midColor: string;
  baseColor: string;
}

/**
 * Omslagsområder fra vanlige tabeller (Kjemi 1, «Tabeller og formler i kjemi»): metyloransje 3,1–4,4 (rød → gul),
 * metylrødt 4,4–6,2 (rød → gul), lakmus 4,5–8,3 (rød → blå), bromtymolblått 6,0–7,6 (gul → blå) og fenolftalein
 * 8,2–10,0 (fargeløs → rosa).
 */
export const INDICATORS: Record<IndicatorId, Indicator> = {
  metyloransje: { id: 'metyloransje', name: 'metyloransje', low: 3.1, high: 4.4, acidColor: 'rød', midColor: 'oransje', baseColor: 'gul' },
  metylrodt: { id: 'metylrodt', name: 'metylrødt', low: 4.4, high: 6.2, acidColor: 'rød', midColor: 'oransje', baseColor: 'gul' },
  lakmus: { id: 'lakmus', name: 'lakmus', low: 4.5, high: 8.3, acidColor: 'rød', midColor: 'fiolett', baseColor: 'blå' },
  bromtymolblatt: { id: 'bromtymolblatt', name: 'bromtymolblått', low: 6.0, high: 7.6, acidColor: 'gul', midColor: 'grønn', baseColor: 'blå' },
  fenolftalein: { id: 'fenolftalein', name: 'fenolftalein', low: 8.2, high: 10.0, acidColor: 'fargeløs', midColor: 'lyserosa', baseColor: 'rosa' },
};

/** Hvor langt indikatoren har skiftet farge (0 = syrefarge, 1 = basefarge), lineært gjennom omslagsområdet. */
export function indicatorShift(ind: Indicator, pH: number): number {
  return clamp((pH - ind.low) / (ind.high - ind.low), 0, 1);
}

/** Fargeordet ved en pH: syrefargen i den nederste femtedelen av omslagsområdet, basefargen i den øverste. */
export function indicatorColorWord(ind: Indicator, pH: number): string {
  const t = indicatorShift(ind, pH);
  return t < 0.2 ? ind.acidColor : t > 0.8 ? ind.baseColor : ind.midColor;
}

/** Midt i omslagsområdet (der vi sier at indikatoren slår om). */
export function indicatorMid(ind: Indicator): number {
  return (ind.low + ind.high) / 2;
}

/* ---------- Sterke og svake syrer og baser ---------- */

export interface WeakAcid {
  id: string;
  name: string;
  formula: string;
  /** Den korresponderende basen. */
  base: string;
  /** Syrekonstanten ved 25 °C. */
  Ka: number;
}

/** Svake syrer med K_a ved 25 °C (se kildene øverst i fila). */
export const WEAK_ACIDS: WeakAcid[] = [
  { id: 'eddiksyre', name: 'eddiksyre', formula: 'CH3COOH', base: 'CH3COO^-', Ka: 1.8e-5 },
  { id: 'maursyre', name: 'maursyre', formula: 'HCOOH', base: 'HCOO^-', Ka: 1.8e-4 },
  { id: 'flussyre', name: 'flussyre', formula: 'HF', base: 'F^-', Ka: 6.8e-4 },
  { id: 'benzosyre', name: 'benzosyre', formula: 'C6H5COOH', base: 'C6H5COO^-', Ka: 6.3e-5 },
];

/** K_b for ammoniakk ved 25 °C. */
export const KB_NH3 = 1.8e-5;

/**
 * [H₃O⁺] i en sterk syre (fullstendig protolysert) med konsentrasjon c, inkludert vannets eget bidrag:
 * [H₃O⁺] = c/2 + √(c²/4 + K_w). For c ≫ 10⁻⁷ mol/L blir dette bare c.
 */
export function strongAcidH3O(c: number): number {
  return c / 2 + Math.sqrt((c * c) / 4 + KW);
}

/**
 * Likevektskonsentrasjonen x av protolysert syre (eller base) fra K = x²/(c − x), dvs. den positive løsningen av
 * x² + K·x − K·c = 0: x = (−K + √(K² + 4K·c))/2. Skrevet om til 2Kc/(K + √(K² + 4Kc)), som er det samme tallet,
 * men regnes nøyaktig også når K er mye større enn c. Vannets eget bidrag er ikke tatt med (c ≥ 10⁻⁴ mol/L her).
 */
export function weakProtolysis(c: number, K: number): number {
  if (!(c > 0) || !(K > 0)) return 0;
  return (2 * K * c) / (K + Math.sqrt(K * K + 4 * K * c));
}

/** Tilnærmingen x ≈ √(K·c) som mange bruker når syra er svak og ikke for fortynnet. */
export function weakProtolysisApprox(c: number, K: number): number {
  return Math.sqrt(K * c);
}

export interface AcidSolution {
  /** Startkonsentrasjon av syra/basen (mol/L). */
  c: number;
  pH: number;
  h3o: number;
  oh: number;
  /** Protolysegrad: andelen av syre- eller basemolekylene som har reagert med vann (0–1). */
  alpha: number;
}

function solution(c: number, h3o: number, alpha: number): AcidSolution {
  return { c, pH: pHFromH3O(h3o), h3o, oh: KW / h3o, alpha };
}

/** Sterk syre (HCl): protolysegrad 100 %. */
export function strongAcid(c: number): AcidSolution {
  return solution(c, strongAcidH3O(c), 1);
}

/** Svak syre HA med syrekonstant K_a. */
export function weakAcid(c: number, Ka: number): AcidSolution {
  const x = weakProtolysis(c, Ka);
  return solution(c, x, x / c);
}

/** Sterk base (NaOH): [OH⁻] = c (med vannets bidrag). */
export function strongBase(c: number): AcidSolution {
  const oh = strongAcidH3O(c);
  return solution(c, KW / oh, 1);
}

/** Svak base B med basekonstant K_b: B + H₂O ⇌ HB⁺ + OH⁻. */
export function weakBase(c: number, Kb: number): AcidSolution {
  const oh = weakProtolysis(c, Kb);
  return solution(c, KW / oh, oh / c);
}

/** pK_a = −lg K_a. */
export function pKa(Ka: number): number {
  return -Math.log10(Ka);
}

/**
 * Hvor mange av `n` syremolekyler som skal tegnes som protolysert i et partikkelbilde: avrundet, men minst én når
 * protolysegraden er over null (ellers ser en svak syre ut som om den ikke protolyserer i det hele tatt).
 */
export function protolysedCount(alpha: number, n: number): number {
  if (!(alpha > 0)) return 0;
  return clamp(Math.round(alpha * n), 1, n);
}

/* ---------- Titrering ---------- */

export type TitrationAcid = 'HCl' | 'CH3COOH';

export interface TitrationSetup {
  acid: TitrationAcid;
  /** Syrens konsentrasjon (mol/L). */
  ca: number;
  /** Volum syre i kolben (mL). */
  Va: number;
  /** Konsentrasjonen av NaOH i byretten (mol/L). */
  cb: number;
}

/** K_a for eddiksyre (titrering). */
export const KA_ACETIC = 1.8e-5;

/**
 * pH etter at `Vb` mL NaOH er tilsatt, regnet eksakt fra ladningsbalansen
 *   [Na⁺] + [H₃O⁺] = [A⁻] + [OH⁻]
 * med [A⁻] = c(syre) for HCl og c(syre) · K_a/(K_a + [H₃O⁺]) for eddiksyre. Fortynningen tas med (V = V_a + V_b).
 * Samme formel gir startpunktet, bufferområdet, ekvivalenspunktet (acetat er en svak base) og overskuddet av OH⁻.
 */
export function titrationPH(s: TitrationSetup, Vb: number): number {
  const V = s.Va + Math.max(0, Vb);
  const CA = (s.ca * s.Va) / V;
  const CNa = (s.cb * Math.max(0, Vb)) / V;
  if (s.acid === 'HCl') {
    // h − K_w/h = CA − CNa
    const D = CA - CNa;
    const root = Math.sqrt((D * D) / 4 + KW);
    const h = D >= 0 ? D / 2 + root : KW / (-D / 2 + root);
    return pHFromH3O(h);
  }
  const Ka = KA_ACETIC;
  // g(h) = CNa + h − CA·Ka/(Ka + h) − Kw/h er strengt voksende i h: halvering på lg h.
  const g = (h: number) => CNa + h - (CA * Ka) / (Ka + h) - KW / h;
  let lo = -16;
  let hi = 1;
  for (let i = 0; i < 80; i++) {
    const mid = (lo + hi) / 2;
    if (g(10 ** mid) > 0) hi = mid;
    else lo = mid;
  }
  return -(lo + hi) / 2;
}

/** Ekvivalensvolumet (mL): n(NaOH) = n(syre), altså V_e = c_a · V_a / c_b (molforhold 1 : 1). */
export function equivalenceVolume(s: TitrationSetup): number {
  return (s.ca * s.Va) / s.cb;
}

/** Punkter (V, pH) på titrerkurven fra 0 til `Vmax` mL, tett rundt ekvivalenspunktet så spranget blir skarpt. */
export function titrationCurve(s: TitrationSetup, Vmax: number, n = 240): [number, number][] {
  const Ve = equivalenceVolume(s);
  const xs = new Set<number>();
  for (let i = 0; i <= n; i++) xs.add((Vmax * i) / n);
  // Ekstra punkter nær V_e (avstand fra 10⁻⁴ til 10⁻¹ av V_e på hver side)
  for (let e = -4; e <= -1; e += 0.25) {
    const d = Ve * 10 ** e;
    if (Ve - d > 0) xs.add(Ve - d);
    if (Ve + d < Vmax) xs.add(Ve + d);
  }
  if (Ve <= Vmax) xs.add(Ve);
  return [...xs].sort((a, b) => a - b).map((V) => [V, titrationPH(s, V)]);
}

/**
 * Volumet NaOH (mL) der pH når `pHTarget` (pH stiger hele veien, så vi kan halvere). Gir 0 hvis pH allerede er
 * høyere ved start, og `Vmax` hvis den aldri når så høyt innenfor `Vmax`.
 */
export function volumeAtPH(s: TitrationSetup, pHTarget: number, Vmax = 4 * equivalenceVolume(s)): number {
  if (titrationPH(s, 0) >= pHTarget) return 0;
  if (titrationPH(s, Vmax) < pHTarget) return Vmax;
  let lo = 0;
  let hi = Vmax;
  for (let i = 0; i < 70; i++) {
    const mid = (lo + hi) / 2;
    if (titrationPH(s, mid) < pHTarget) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

export type IndicatorVerdict = 'god' | 'brukbar' | 'dårlig';

export interface EndpointResult {
  /** Volumet der indikatoren slår om (midt i omslagsområdet), mL. */
  Vend: number;
  /** Titreringsfeil V_end − V_e (mL). */
  error: number;
  /** Relativ feil (V_end − V_e)/V_e. */
  relError: number;
  verdict: IndicatorVerdict;
  /** Indikatoren har allerede basefargen før titreringen starter. */
  alreadyShifted: boolean;
  /** Konsentrasjonen av syra regnet ut fra endepunktet: c = c_b · V_end / V_a (mol/L). */
  cFound: number;
}

/**
 * Endepunktet med en gitt indikator: volumet der pH når midten av omslagsområdet. Indikatoren er
 * «god» når feilen er under 0,5 % av V_e, «brukbar» under 2 % og ellers «dårlig».
 */
export function endpoint(s: TitrationSetup, ind: Indicator): EndpointResult {
  const Ve = equivalenceVolume(s);
  const mid = indicatorMid(ind);
  const alreadyShifted = titrationPH(s, 0) >= mid;
  const Vend = volumeAtPH(s, mid);
  const error = Vend - Ve;
  const relError = error / Ve;
  const a = Math.abs(relError);
  const verdict: IndicatorVerdict = alreadyShifted ? 'dårlig' : a <= 0.005 ? 'god' : a <= 0.02 ? 'brukbar' : 'dårlig';
  return { Vend, error, relError, verdict, alreadyShifted, cFound: (s.cb * Vend) / s.Va };
}

export type TitrationPhase = 'start' | 'før' | 'halv' | 'ekvivalens' | 'etter';

/** Hvor i titreringen vi er (med litt slingringsmonn rundt de spesielle punktene). */
export function titrationPhase(s: TitrationSetup, Vb: number): TitrationPhase {
  const Ve = equivalenceVolume(s);
  const tol = Math.max(0.02, Ve * 0.01);
  if (Vb < tol) return 'start';
  if (Math.abs(Vb - Ve) <= tol) return 'ekvivalens';
  if (s.acid === 'CH3COOH' && Math.abs(Vb - Ve / 2) <= Math.max(tol, Ve * 0.02)) return 'halv';
  return Vb < Ve ? 'før' : 'etter';
}

/* ---------- Protolyse (Brønsted) ---------- */

export interface ProtolysisSpecies {
  id: string;
  /** Formel med ^ for ladning. */
  formula: string;
  name: string;
  /** Tilstand i likningen: vann (l), resten (aq). */
  state: 'aq' | 'l';
}

export interface AcidOption extends ProtolysisSpecies {
  /** pK_a for syra (se kilder øverst; HCl er svært sterk, pK_a ≈ −6). */
  pKa: number;
  /** Den korresponderende basen (syra minus H⁺). */
  conj: ProtolysisSpecies;
}

export interface BaseOption extends ProtolysisSpecies {
  /** Den korresponderende syra (basen pluss H⁺). */
  conj: ProtolysisSpecies;
  /** pK_a for den korresponderende syra. */
  conjPKa: number;
}

const sp = (id: string, formula: string, name: string, state: 'aq' | 'l' = 'aq'): ProtolysisSpecies => ({ id, formula, name, state });

const H2O = sp('H2O', 'H2O', 'vann', 'l');
const H3O = sp('H3O', 'H3O^+', 'oksoniumion');
const OH = sp('OH', 'OH^-', 'hydroksidion');
const NH3 = sp('NH3', 'NH3', 'ammoniakk');
const NH4 = sp('NH4', 'NH4^+', 'ammoniumion');
const HAc = sp('CH3COOH', 'CH3COOH', 'eddiksyre');
const Ac = sp('CH3COO', 'CH3COO^-', 'acetation');

/**
 * Syrene eleven kan velge. Vann regnes som syre med K_a = K_w = 1,0 · 10⁻¹⁴ (pK_a 14) og H₃O⁺ med K_a = 1
 * (pK_a 0), slik syre-base-tabellen i Kjemi 1/2 gjør.
 */
export const PROTOLYSIS_ACIDS: AcidOption[] = [
  { ...sp('HCl', 'HCl', 'hydrogenklorid'), pKa: -6, conj: sp('Cl', 'Cl^-', 'kloridion') },
  { ...sp('HSO4', 'HSO4^-', 'hydrogensulfation'), pKa: 2.0, conj: sp('SO4', 'SO4^2-', 'sulfation') },
  { ...HAc, pKa: 4.74, conj: Ac },
  { ...NH4, pKa: 9.25, conj: NH3 },
  { ...H2O, pKa: 14, conj: OH },
];

export const PROTOLYSIS_BASES: BaseOption[] = [
  { ...H2O, conj: H3O, conjPKa: 0 },
  { ...NH3, conj: NH4, conjPKa: 9.25 },
  { ...OH, conj: H2O, conjPKa: 14 },
  { ...sp('CO3', 'CO3^2-', 'karbonation'), conj: sp('HCO3', 'HCO3^-', 'hydrogenkarbonation'), conjPKa: 10.33 },
  { ...Ac, conj: HAc, conjPKa: 4.74 },
];

export type ProtolysisKind = 'fullstendig' | 'mot høyre' | 'mot venstre' | 'svært lite' | 'ingen endring';

export interface ProtolysisResult {
  acid: AcidOption;
  base: BaseOption;
  /** lg K for HA + B ⇌ A⁻ + HB⁺: lg K = pK_a(HB⁺) − pK_a(HA). */
  logK: number;
  kind: ProtolysisKind;
  /** Reaksjonspil: → for (nesten) fullstendig, ellers ⇌. */
  arrow: '→' | '⇌';
  /** Likningen som tekst for kit-ets <Reaksjon>: syre 1 + base 2 → syre 2 + base 1. */
  equation: string;
  /** Begge partiklene er like før og etter (f.eks. NH₄⁺ + NH₃). */
  identity: boolean;
}

/** Likningen med tilstander: «HCl(aq) + H2O(l) → H3O^+(aq) + Cl^-(aq)». */
function term(s: ProtolysisSpecies): string {
  return `${s.formula}(${s.state})`;
}

/**
 * Protolysen mellom en syre og en base. Likevekten ligger mot den svakeste syra: K = K_a(syre)/K_a(korr. syre).
 * lg K ≥ 3 regnes som fullstendig (→); ellers skrives ⇌, og retningen sier hvor likevekten ligger.
 */
export function protolysis(acidId: string, baseId: string): ProtolysisResult {
  const acid = PROTOLYSIS_ACIDS.find((a) => a.id === acidId) ?? PROTOLYSIS_ACIDS[0]!;
  const base = PROTOLYSIS_BASES.find((b) => b.id === baseId) ?? PROTOLYSIS_BASES[0]!;
  const logK = base.conjPKa - acid.pKa;
  const identity = acid.conj.id === base.id;
  const kind: ProtolysisKind = identity ? 'ingen endring' : logK >= 3 ? 'fullstendig' : logK > 0 ? 'mot høyre' : logK > -3 ? 'mot venstre' : 'svært lite';
  const arrow = kind === 'fullstendig' ? '→' : '⇌';
  const equation = `${term(acid)} + ${term(base)} ${arrow} ${term(base.conj)} + ${term(acid.conj)}`;
  return { acid, base, logK, kind, arrow, equation, identity };
}

/** Partikler som kan være både syre og base (amfolytter) blant valgene. */
export const AMPHOLYTES = ['H2O', 'HSO4^-', 'HCO3^-'];
