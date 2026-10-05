/** Tallformat for kjemi i tillegg til kit-ets fmt/fmtSci. */
import { fmt, fmtSci } from '../../kit/format';

/**
 * Tall med `sig` gjeldende siffer (standard 3), på standardform når det er veldig stort eller lite:
 * 0,555 · 18,0 · 100 · 3,34 · 10²³ · 1,66 · 10⁻⁴. Ugyldige tall gir «–».
 */
export function fmtSig(v: number, sig = 3): string {
  if (!Number.isFinite(v)) return '–';
  if (v === 0) return '0';
  // Rund av først, så 99,99 blir «100» og ikke «100,0»
  const r = Number(v.toPrecision(sig));
  const exp = Math.floor(Math.log10(Math.abs(r)));
  if (exp < -3 || exp >= 6) return fmtSci(r, sig - 1);
  return fmt(r, Math.max(0, sig - 1 - exp));
}
