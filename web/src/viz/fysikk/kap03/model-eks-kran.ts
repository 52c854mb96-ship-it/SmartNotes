/**
 * Eksempeloppgaven «Byggekran løfter en last» (k3-eks-kran, 3A–3F).
 *
 * En tårnkran løfter en last med massen m rett opp fra bakken til det øverste dekket på et bygg, h over bakken, med
 * jevn fart v. Heisemotoren med gir og vinsj har virkningsgraden η. Etterpå senkes lasta ned igjen med jevn fart, og
 * motoren virker da som generator: andelen η_g av den mekaniske energien lasta mister, går tilbake til strømnettet.
 *
 *   Jevn fart (Newtons 1. lov):      S = G = mg
 *   Arbeidet snordraget gjør:        W_S = S · h · cos 0° = mgh      (tyngden: W_G = −mgh, totalt 0 = ΔE_k)
 *   Økningen i potensiell energi:    ΔE_p = mgh = W_S                 (W_S = ΔE = ΔE_p, fordi ΔE_k = 0)
 *   Tid og effekt:                   t = h / v,  P = W / t = S · v
 *   Elektrisk energi:                E_el = W / η   (varme i motor, gir og vinsj: E_el − W)
 *   Senking med jevn fart:           W_S = S · h · cos 180° = −mgh = ΔE,  tilbake til nettet η_g · mgh
 *   Netto for turen opp og ned:      E_el − η_g · mgh = all varmen (lasta er tilbake der den startet)
 */
import { G_EARTH } from '../../kit/format';

/** Hva kranen løfter. Bestemmer tegningen av lasta og ordene i oppgaveteksten. */
export type CraneLoad = 'murstein' | 'stalbjelker' | 'gips';

export interface CraneTask {
  load: CraneLoad;
  /** Massen til lasta (kg). */
  m: number;
  /** Høyden lasta løftes, fra bakken til det øverste dekket (m). */
  h: number;
  /** Den jevne farten under løftet og senkingen (m/s). */
  v: number;
  /** Virkningsgraden for heisemotoren med gir og vinsj under løftet (0–1). */
  eta: number;
  /** Andelen av den mekaniske energien lasta mister ved senkingen som går tilbake til nettet (0–1). */
  etaBack: number;
}

/** Ordene om lasta i oppgaveteksten («en pall med murstein» …). */
export const LOAD_TEXT: Record<CraneLoad, { what: string; it: string; short: string }> = {
  murstein: { what: 'en pall med murstein', it: 'pallen', short: 'pallen med murstein' },
  stalbjelker: { what: 'en bunt med stålbjelker', it: 'bunten', short: 'bunten med stålbjelker' },
  gips: { what: 'en pall med gipsplater', it: 'pallen', short: 'pallen med gipsplater' },
};

/**
 * Tre tallsett. Massene passer for det kranen faktisk løfter (en pall murstein er 800–1 000 kg, fem stålbjelker på
 * 6 m rundt 1,2 tonn, en pall gipsplater 600–700 kg), høydene for blokker på 6–10 etasjer, og fartene for vinsjen på
 * en tårnkran med tung last (0,6–1,2 m/s). Virkningsgraden ved løft er 70–80 %, og en frekvensstyrt motor sender
 * 65–70 % tilbake ved senking (aldri mer enn ved løft). Snordraget i «Vis at» ligger godt unna grensen mellom to
 * avrundinger, og tida er under ett minutt, så stoppeklokka i figuren ikke går rundt.
 */
export const CRANE_TASKS: CraneTask[] = [
  { load: 'murstein', m: 850, h: 24, v: 0.8, eta: 0.75, etaBack: 0.7 },
  { load: 'stalbjelker', m: 1200, h: 31.5, v: 0.6, eta: 0.8, etaBack: 0.7 },
  { load: 'gips', m: 640, h: 18, v: 1.2, eta: 0.7, etaBack: 0.65 },
];

/** Strømprisen i tipset om hva løftet koster (kr/kWh). */
export const POWER_PRICE = 1.5;

/** Joule per kilowattime: 1 kWh = 1 000 W · 3 600 s. */
export const J_PER_KWH = 3.6e6;

export interface CraneSolution {
  /** Tyngden G = mg (N). */
  G: number;
  /** Snordraget fra kroken på lasta ved jevn fart (N): S = G. */
  S: number;
  /** Snordraget avrundet til to gjeldende siffer i kN, til «Vis at …» i a). */
  SkNShown: number;
  /** Desimaler i SkNShown. */
  SkNDecimals: number;
  /** Arbeidet snordraget gjør under løftet (J): W_S = S · h. */
  W: number;
  /** Arbeidet tyngden gjør under løftet (J): W_G = −mgh. */
  WG: number;
  /** Det totale arbeidet på lasta under løftet (J): W_S + W_G = ΔE_k = 0. */
  Wtot: number;
  /** Økningen i potensiell energi (J): ΔE_p = mgh. */
  dEp: number;
  /** Tida løftet tar (s): t = h / v. */
  t: number;
  /** Effekten kranen yter på lasta (W): P = W / t. */
  P: number;
  /** Den samme effekten regnet som P = S · v (W). */
  PFv: number;
  /** Elektrisk energi brukt under løftet (J): E_el = W / η. */
  Eel: number;
  /** E_el i kWh. */
  EelKWh: number;
  /** Elektrisk effekt under løftet (W): P / η. */
  Pel: number;
  /** Termisk energi i motor, gir og vinsj under løftet (J): E_el − W. */
  heatUp: number;
  /** Det gale svaret W · η (ganget i stedet for å dele), til den vanlige feilen i d). */
  wrongEel: number;
  /** Hva den elektriske energien til løftet koster med POWER_PRICE (øre). */
  costOre: number;
  /** Arbeidet snordraget gjør når lasta senkes (J): W_S = S · h · cos 180° = −mgh. */
  WSDown: number;
  /** Endringen i mekanisk energi når lasta senkes (J): ΔE = −mgh. */
  dEDown: number;
  /** Elektrisk energi tilbake til nettet ved senkingen (J): η_g · mgh. */
  Eback: number;
  /** Termisk energi under senkingen (J): mgh − E_back. */
  heatDown: number;
  /** Elektrisk energi brukt netto på turen opp og ned (J): E_el − E_back. */
  net: number;
  /** All termisk energi på turen (J): heatUp + heatDown (= net, fordi lasta er tilbake der den startet). */
  heatTotal: number;
}

/** Avrunder til `sig` gjeldende siffer: 8 338 → 8 300 (sig = 2). */
export function roundSig(x: number, sig: number): number {
  if (!Number.isFinite(x) || x === 0) return x;
  const e = Math.floor(Math.log10(Math.abs(x))) - sig + 1;
  const f = 10 ** e;
  return Math.round(x / f) * f;
}

/** Hvor mange desimaler et tall avrundet til `sig` gjeldende siffer trenger: 12 → 0, 8,3 → 1, 0,45 → 2. */
export function sigDecimals(x: number, sig: number): number {
  if (!Number.isFinite(x) || x === 0) return 0;
  return Math.max(0, sig - 1 - Math.floor(Math.log10(Math.abs(roundSig(x, sig)))));
}

/** Løser hele oppgaven for ett tallsett. Alle tall i teksten, utregningen og figuren kommer herfra. */
export function solveCraneTask({ m, h, v, eta, etaBack }: CraneTask, g = G_EARTH): CraneSolution {
  const G = m * g;
  const S = G;
  const W = S * h;
  const WG = -G * h;
  const t = v > 0 ? h / v : Infinity;
  const P = t > 0 && Number.isFinite(t) ? W / t : 0;
  const Eel = eta > 0 ? W / eta : Infinity;
  const Eback = etaBack * G * h;
  const heatUp = Eel - W;
  const heatDown = G * h - Eback;
  const SkN = S / 1000;
  return {
    G,
    S,
    SkNShown: roundSig(SkN, 2),
    SkNDecimals: sigDecimals(SkN, 2),
    W,
    WG,
    Wtot: W + WG,
    dEp: m * g * h,
    t,
    P,
    PFv: S * v,
    Eel,
    EelKWh: Eel / J_PER_KWH,
    Pel: eta > 0 ? P / eta : Infinity,
    heatUp,
    wrongEel: W * eta,
    costOre: (Eel / J_PER_KWH) * POWER_PRICE * 100,
    WSDown: -S * h,
    dEDown: -m * g * h,
    Eback,
    heatDown,
    net: Eel - Eback,
    heatTotal: heatUp + heatDown,
  };
}
