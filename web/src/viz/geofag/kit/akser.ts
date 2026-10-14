/**
 * Logaritmiske akser til `LogPlot` og andre geofagdiagrammer (Hjulströms diagram, kornfordelingskurver, viskositet,
 * flomfrekvens): skala fra verdi til piksel og tilbake, akseverdier (hele tierpotenser og hjelpestreker) og
 * akseetiketter skrevet på norsk («0,01», «1000», «10⁶»). Ren logikk uten React.
 *
 * Funksjonene gir aldri `NaN` eller `Infinity`: verdier ≤ 0 legges på kanten av aksen, og et ugyldig område gir en
 * skala som legger alt midt på.
 *
 *   const sx = scaleLog([0.001, 1000], [60, 760]);
 *   sx(1)                      // midt på aksen
 *   logTicks(0.001, 1000)      // { major: [0,001, 0,01, …, 1000], minor: [0,002, 0,003, …] }
 *   logEtikett(0.01)           // '0,01'
 *   logEtikett(1e8)            // '10⁸'
 */
import { fmt, superscript } from '../../kit/format';

function gyldigDomene(domain: readonly [number, number]): boolean {
  const [a, b] = domain;
  return Number.isFinite(a) && Number.isFinite(b) && a > 0 && b > 0 && a !== b;
}

/**
 * Logaritmisk skala: gjør en verdi i `domain` om til en posisjon i `range`, lineært i log₁₀. Som `scaleLinear` i det
 * felles kit-et, og `domain` kan gå begge veier (f.eks. [1000, 0,001] for en akse som avtar mot høyre). Verdier ≤ 0 eller
 * ugyldige tall havner ved den minste enden av domenet. Ugyldig domene (≤ 0 eller like ender) legger alt midt i området.
 *
 * @param domain Verdiområdet [fra, til], begge > 0.
 * @param range Pikselområdet [fra, til].
 */
export function scaleLog(domain: readonly [number, number], range: readonly [number, number]): (v: number) => number {
  const [r0, r1] = range;
  if (!gyldigDomene(domain) || !Number.isFinite(r0) || !Number.isFinite(r1)) {
    const midt = Number.isFinite(r0) && Number.isFinite(r1) ? (r0 + r1) / 2 : 0;
    return () => midt;
  }
  const l0 = Math.log10(domain[0]);
  const l1 = Math.log10(domain[1]);
  const lMin = Math.min(l0, l1);
  return (v: number) => {
    const lv = Number.isFinite(v) && v > 0 ? Math.log10(v) : lMin;
    return r0 + ((lv - l0) / (l1 - l0)) * (r1 - r0);
  };
}

/**
 * Den omvendte av `scaleLog`: gjør en posisjon i `range` om til en verdi i `domain` (til peking og dra-punkter).
 * Ugyldig domene eller område gir en funksjon som gir den minste enden av domenet (eller 1).
 *
 * @param domain Verdiområdet [fra, til], begge > 0.
 * @param range Pikselområdet [fra, til].
 */
export function scaleLogInvert(domain: readonly [number, number], range: readonly [number, number]): (px: number) => number {
  const [r0, r1] = range;
  if (!gyldigDomene(domain) || !Number.isFinite(r0) || !Number.isFinite(r1) || r0 === r1) {
    const fallback = gyldigDomene(domain) ? Math.min(domain[0], domain[1]) : 1;
    return () => fallback;
  }
  const l0 = Math.log10(domain[0]);
  const l1 = Math.log10(domain[1]);
  return (px: number) => {
    const t = Number.isFinite(px) ? (px - r0) / (r1 - r0) : 0;
    const v = 10 ** (l0 + t * (l1 - l0));
    return Number.isFinite(v) && v > 0 ? v : Math.min(domain[0], domain[1]);
  };
}

/** Akseverdiene for en logaritmisk akse. */
export interface LogTicks {
  /** Verdier med etikett og rutenettlinje: hele tierpotenser (eller hver andre/tredje når aksen er lang), eller 1, 2, 5 når aksen spenner mindre enn to tierpotenser. */
  major: number[];
  /** Hjelpestreker uten etikett: 2, 3 … 9 ganger tierpotensene (tomt når aksen er svært lang). */
  minor: number[];
}

/** Runder bort flyttallsstøy: 0.30000000000000004 → 0,3. */
function ren(v: number): number {
  return Number(v.toPrecision(12));
}

/**
 * Akseverdier for en logaritmisk akse fra `min` til `max` (rekkefølgen spiller ingen rolle). Hele tierpotenser er
 * hovedverdier; spenner aksen over mer enn `maksMerker` tierpotenser, tas bare hver andre eller tredje (f.eks.
 * viskositet fra 10⁻³ til 10¹¹ Pa·s), og spenner den under to tierpotenser, legges 2 og 5 til. Ugyldig område gir tomme
 * lister.
 *
 * @param min Den ene enden av aksen (> 0).
 * @param max Den andre enden av aksen (> 0).
 * @param maksMerker Høyst så mange hovedverdier (standard 8).
 */
export function logTicks(min: number, max: number, maksMerker = 8): LogTicks {
  if (!Number.isFinite(min) || !Number.isFinite(max) || min <= 0 || max <= 0 || min === max) return { major: [], minor: [] };
  const lo = Math.min(min, max);
  const hi = Math.max(min, max);
  const eps = 1e-9;
  const k0 = Math.floor(Math.log10(lo) + eps);
  const k1 = Math.ceil(Math.log10(hi) - eps);
  if (k1 - k0 > 400) return { major: [], minor: [] };
  const inne = (v: number) => v >= lo * (1 - 1e-9) && v <= hi * (1 + 1e-9);
  const tiere: number[] = [];
  for (let k = k0; k <= k1; k++) tiere.push(ren(10 ** k));
  const antall = tiere.filter(inne).length;
  const maks = Math.max(2, Math.floor(maksMerker));
  const steg = antall > maks ? Math.ceil(antall / maks) : 1;
  const major: number[] = [];
  const minor: number[] = [];
  if (Math.log10(hi / lo) < 2) {
    // Kort akse: 1, 2 og 5 ganger tierpotensene som hovedverdier.
    for (let k = k0; k <= k1; k++) {
      for (const m of [1, 2, 5]) {
        const v = ren(m * 10 ** k);
        if (inne(v)) major.push(v);
      }
      for (const m of [3, 4, 6, 7, 8, 9]) {
        const v = ren(m * 10 ** k);
        if (inne(v)) minor.push(v);
      }
    }
    return { major, minor };
  }
  for (let k = k0; k <= k1; k++) {
    const v = ren(10 ** k);
    if (inne(v) && ((k % steg) + steg) % steg === 0) major.push(v);
    else if (inne(v)) minor.push(v);
    if (steg === 1) {
      for (let m = 2; m <= 9; m++) {
        const w = ren(m * 10 ** k);
        if (inne(w)) minor.push(w);
      }
    }
  }
  return { major, minor };
}

/**
 * Tierpotensen 10^k skrevet med hevet eksponent og ekte minus: `tierpotens(-3)` → «10⁻³». Ugyldig k gir «–».
 *
 * @param k Eksponenten (heltall).
 */
export function tierpotens(k: number): string {
  if (!Number.isFinite(k)) return '–';
  return `10${superscript(Math.round(k))}`;
}

/** Valg til `logEtikett`. */
export interface LogEtikettValg {
  /**
   * `'auto'` (standard): vanlige tall fra 0,001 til 10 000 («0,01», «1000», «10 000») og tierpotenser ellers («10⁻⁵»,
   * «2 · 10⁶»). `'potens'`: alltid tierpotens («10⁰», «10³»). `'desimal'`: alltid vanlig tall.
   */
  form?: 'auto' | 'potens' | 'desimal';
}

/**
 * Akseetikett for en verdi på en logaritmisk akse, skrevet på norsk: desimalkomma, mellomrom som tusenskille fra fem
 * sifre og tierpotenser med hevet eksponent og ekte minus. Sifrene etter komma følger verdien (0,002 → «0,002», 2 → «2»).
 * Verdier ≤ 0 eller ugyldige tall gir «–».
 *
 * @param v Verdien (> 0).
 * @param valg `{ form: 'potens' }` for å skrive alt som tierpotenser.
 */
export function logEtikett(v: number, valg: LogEtikettValg = {}): string {
  if (!Number.isFinite(v) || v <= 0) return '–';
  const form = valg.form ?? 'auto';
  let k = Math.floor(Math.log10(v) + 1e-9);
  let mantisse = ren(v / 10 ** k);
  if (mantisse >= 10) {
    mantisse = ren(mantisse / 10);
    k += 1;
  }
  const potens = form === 'potens' || (form === 'auto' && (k < -3 || k > 4));
  if (potens) {
    const m = mantisse === 1 ? '' : `${fmt(mantisse, desimaler(mantisse))} · `;
    return `${m}${tierpotens(k)}`;
  }
  const d = Math.max(0, desimaler(mantisse) - k);
  const tekst = fmt(v, Math.min(20, d));
  // Fire sifre uten mellomrom (1000, 2500), som i norsk sats; fem sifre og mer med mellomrom.
  return Math.abs(v) >= 1000 && Math.abs(v) < 10_000 ? tekst.replace(/\s/g, '') : tekst;
}

/** Antall desimaler et tall trenger (opptil 6): 2 → 0, 2,5 → 1, 1,25 → 2. */
function desimaler(x: number): number {
  for (let d = 0; d <= 6; d++) if (Math.abs(ren(x * 10 ** d) - Math.round(x * 10 ** d)) < 1e-9) return d;
  return 6;
}
