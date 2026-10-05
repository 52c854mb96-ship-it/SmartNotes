/** Tallformatering for visualiseringene: norsk desimalkomma, ekte minustegn og hardt mellomrom før enhet. */
const cache = new Map<number, Intl.NumberFormat>();

function formatter(decimals: number): Intl.NumberFormat {
  let f = cache.get(decimals);
  if (!f) {
    f = new Intl.NumberFormat('nb-NO', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
    cache.set(decimals, f);
  }
  return f;
}

/** 24.53 → «24,5» (decimals = 1). Ugyldige tall vises som «–». */
export function fmt(value: number, decimals = 1): string {
  if (!Number.isFinite(value)) return '–';
  // Unngå «−0,0»
  const rounded = Math.abs(value) < 0.5 * 10 ** -decimals ? 0 : value;
  return formatter(decimals).format(rounded);
}

/** 24.53, 1, «N» → «24,5 N» (med hardt mellomrom). */
export function fmtUnit(value: number, decimals: number, unit: string): string {
  return unit ? `${fmt(value, decimals)} ${unit}` : fmt(value, decimals);
}

/** Tall på standardform: 6.63e-34 → «6,63 · 10⁻³⁴». */
export function fmtSci(value: number, decimals = 2): string {
  if (!Number.isFinite(value)) return '–';
  if (value === 0) return '0';
  let exp = Math.floor(Math.log10(Math.abs(value)));
  if (exp >= -2 && exp <= 4) return fmt(value, decimals);
  let mantissa = value / 10 ** exp;
  // 9,996 · 10³ med to desimaler skal bli 1,00 · 10⁴, ikke 10,00 · 10³
  const f = 10 ** decimals;
  if (Math.abs(Math.round(mantissa * f) / f) >= 10) {
    mantissa /= 10;
    exp += 1;
  }
  return `${fmt(mantissa, decimals)} · 10${superscript(exp)}`;
}

const SUP: Record<string, string> = { '-': '⁻', '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹' };

export function superscript(n: number): string {
  return String(n)
    .split('')
    .map((c) => SUP[c] ?? c)
    .join('');
}

/** Begrens verdi til [min, max]. */
export const clamp = (v: number, min: number, max: number): number => Math.min(max, Math.max(min, v));

/** Tyngdeakselerasjon som brukes i Fysikk 1. */
export const G_EARTH = 9.81;
