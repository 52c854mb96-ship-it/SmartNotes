/** Tallformatering for astrofysikk, der tallene spenner over mange tierpotenser. */
import { fmt, fmtSci, superscript } from '../kit/format';

/**
 * Tall med `sig` gjeldende sifre: 384 400 → «384 400», 4.236 → «4,24», 2.37e22 → «2,37 · 10²²».
 * Vanlig skrivemåte mellom 0,001 og 999 999, ellers standardform.
 */
export function fmtSig(v: number, sig = 3): string {
  if (!Number.isFinite(v)) return '–';
  if (v === 0) return '0';
  const r = Number(v.toPrecision(sig));
  const exp = Math.floor(Math.log10(Math.abs(r)) + 1e-12);
  if (exp >= -3 && exp < 6) return fmt(r, Math.max(0, sig - 1 - exp));
  return fmtSci(r, sig - 1);
}

/** Store tall med ord: 2,5e6 → «2,5 millioner», 4,65e10 → «46,5 milliarder». */
export function fmtWords(v: number, sig = 3): string {
  if (!Number.isFinite(v)) return '–';
  const a = Math.abs(v);
  if (a >= 1e12) return `${fmtSig(v / 1e12, sig)} billioner`;
  if (a >= 1e9) return `${fmtSig(v / 1e9, sig)} milliarder`;
  if (a >= 1e6) return `${fmtSig(v / 1e6, sig)} millioner`;
  return fmtSig(v, sig);
}

/** Tierpotens som tekst: 5 → «10⁵», 0 → «1», 1 → «10», −2 → «0,01» (korte tall skrives vanlig). */
export function fmtPow10(n: number): string {
  if (n === 0) return '1';
  if (n === 1) return '10';
  if (n === 2) return '100';
  if (n === 3) return '1 000';
  if (n === -1) return '0,1';
  if (n === -2) return '0,01';
  return `10${superscript(n)}`;
}

/** Antall år med ord: 1e10 → «10 milliarder år», 5,6e11 → «560 milliarder år». */
export function fmtYears(y: number): string {
  if (!Number.isFinite(y)) return '–';
  if (y < 1) return `${fmtSig(y * 12, 2)} måneder`;
  return `${fmtWords(y, 2)} år`;
}
