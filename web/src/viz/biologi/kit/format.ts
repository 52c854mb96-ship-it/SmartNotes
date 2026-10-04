/** Tallformat for biologi i tillegg til kit-ets fmt/fmtSci og kjemiens fmtSig. */
import { fmt } from '../../kit/format';

/**
 * Andel (0–1) som prosent med hardt mellomrom: 0.456 → «46 %», med `decimals` = 1 → «45,6 %».
 * Svært små andeler som ikke er null vises som «< 1 %» (eller «< 0,1 %»), så de ikke ser ut som null.
 */
export function fmtPct(share: number, decimals = 0): string {
  if (!Number.isFinite(share)) return '–';
  const pct = share * 100;
  const min = 10 ** -decimals;
  if (pct > 0 && pct < min * 0.5) return `< ${fmt(min, decimals)} %`;
  return `${fmt(pct, decimals)} %`;
}

/** Store antall med mellomrom som tusenskille: 2097152 → «2 097 152». Over en milliard: standardform. */
export function fmtCount(n: number): string {
  if (!Number.isFinite(n)) return '–';
  if (Math.abs(n) >= 1e9) {
    const exp = Math.floor(Math.log10(Math.abs(n)));
    const sup = String(exp)
      .split('')
      .map((c) => '⁰¹²³⁴⁵⁶⁷⁸⁹'[Number(c)] ?? c)
      .join('');
    return `${fmt(n / 10 ** exp, 2)} · 10${sup}`;
  }
  return fmt(Math.round(n), 0);
}
