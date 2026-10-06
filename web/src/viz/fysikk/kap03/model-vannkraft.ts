/**
 * Ren fysikk for «Vannkraftverk» (3A, 3C, 3E, 3F): effekten fra vann som faller fra et magasin gjennom en rørgate
 * til en turbin, og hvor mange husstander kraftverket kan forsyne. Ingen React, så alt kan testes.
 *
 * Modell: hvert sekund renner volumet Q (m³) gjennom turbinen. Massen er m = ρQ, og vannet faller fallhøyden h fra
 * vannflata i magasinet ned til turbinen. Vannet mister da den potensielle energien ΔE_p = mgh = ρQgh hvert sekund,
 * som er effekten kraftverket får tilført: P_inn = ρ·g·Q·h. Turbinen og generatoren gjør andelen η (virkningsgraden)
 * om til elektrisk energi:
 *   P = η·ρ·g·Q·h.
 * Resten, (1 − η)·P_inn, blir varme og lyd (friksjon i røret, turbinen og generatoren, og litt fart i vannet som
 * renner ut). Magasinet er så stort at vi regner vannstanden og dermed h som fast.
 */
import { G_EARTH } from '../../kit/format';

/* ---------- Konstanter ---------- */

/** Massetettheten til vann (kg/m³). */
export const RHO_WATER = 1000;
/** En norsk husstand bruker omtrent 16 000 kWh strøm i året (i snitt). */
export const HOUSEHOLD_KWH_PER_YEAR = 16000;
export const HOURS_PER_YEAR = 365 * 24;
/** Gjennomsnittlig effekt for én husstand: 16 000 kWh / 8 760 h ≈ 1,83 kW (i watt). */
export const HOUSEHOLD_POWER = (HOUSEHOLD_KWH_PER_YEAR * 1000) / HOURS_PER_YEAR;
/** Et mobilbatteri rommer omtrent 15 Wh. */
export const PHONE_CHARGE_WH = 15;
export const PHONE_CHARGE_J = PHONE_CHARGE_WH * 3600;

/** Virkningsgraden i hele kraftverket (glidebryteren). */
export const ETA_MIN = 0.4;
export const ETA_MAX = 0.95;

/* ---------- Glidebrytere med «pene» tall ---------- */

const MANTISSAS = [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8];

/**
 * Pene tall fra `min` til `max` (begge med), tett i hver tierpotens: 1 · 1,2 · 1,5 · 2 · 2,5 · 3 · 4 · 5 · 6 · 8.
 * Glidebryteren går i indekser i denne lista, så den blir logaritmisk: like stor plass til 0,01–0,1 m³/s som 10–100 m³/s.
 */
export function niceSteps(min: number, max: number): number[] {
  if (!(min > 0) || !(max >= min)) return [];
  const out: number[] = [];
  const lo = Math.floor(Math.log10(min));
  const hi = Math.ceil(Math.log10(max));
  for (let k = lo; k <= hi; k++) {
    for (const m of MANTISSAS) {
      const v = Number((m * 10 ** k).toPrecision(6));
      if (v >= min * (1 - 1e-9) && v <= max * (1 + 1e-9)) out.push(v);
    }
  }
  return out;
}

/** Fallhøyden h (m): fra en lav elveterskel til de høyeste fjellkraftverkene i Norge. */
export const HEAD_STEPS = niceSteps(5, 1000);
/** Vannføringen Q (m³/s): fra en liten bekk ved hytta til en stor elv. */
export const FLOW_STEPS = niceSteps(0.01, 300);

/** Indeksen til verdien i lista som ligger nærmest `v` (målt i forhold, siden lista er logaritmisk). */
export function nearestIndex(steps: readonly number[], v: number): number {
  let best = 0;
  let bestD = Infinity;
  steps.forEach((s, i) => {
    const d = Math.abs(Math.log(s / v));
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  });
  return best;
}

/* ---------- Kraftverket ---------- */

export interface HydroPlant {
  /** Fallhøyden (m): fra vannflata i magasinet ned til turbinen. */
  h: number;
  /** Vannføringen (m³/s): volumet som renner gjennom turbinen hvert sekund. */
  Q: number;
  /** Virkningsgraden (0–1). */
  eta: number;
}

export interface HydroResult {
  /** Massen vann som renner gjennom turbinen hvert sekund (kg/s): m = ρQ. */
  massPerSecond: number;
  /** Tilført effekt (W): den potensielle energien vannet mister hvert sekund, ρgQh. */
  inputPower: number;
  /** Elektrisk effekt (W): P = η·ρgQh. */
  power: number;
  /** Tapt effekt (W): (1 − η)·ρgQh, blir varme og lyd. */
  loss: number;
  /** Potensiell energi én kilo (én liter) vann mister på vei ned (J/kg): gh. */
  energyPerKg: number;
  /** Elektrisk energi fra én liter vann (J): η·gh. */
  electricPerLitre: number;
  /** Liter vann som må gjennom turbinen for å lade én mobil. */
  litresPerPhone: number;
  /** Hvor mange husstander effekten holder til i snitt: P / 1,83 kW. */
  households: number;
  /** Farten vannet ville fått i fritt fall fra vannflata ned til turbinen (m/s): v = √(2gh). */
  freeFallSpeed: number;
  /** Elektrisk energi på ett år med full effekt (kWh): P · 8 760 h. */
  energyPerYearKWh: number;
}

export function hydroPower({ h, Q, eta }: HydroPlant): HydroResult {
  const H = Math.max(0, h);
  const q = Math.max(0, Q);
  const e = Math.min(1, Math.max(0, eta));
  const massPerSecond = RHO_WATER * q;
  const energyPerKg = G_EARTH * H;
  const inputPower = massPerSecond * energyPerKg;
  const power = e * inputPower;
  const electricPerLitre = e * energyPerKg;
  return {
    massPerSecond,
    inputPower,
    power,
    loss: inputPower - power,
    energyPerKg,
    electricPerLitre,
    litresPerPhone: electricPerLitre > 0 ? PHONE_CHARGE_J / electricPerLitre : Infinity,
    households: power / HOUSEHOLD_POWER,
    freeFallSpeed: Math.sqrt(2 * G_EARTH * H),
    energyPerYearKWh: (power * HOURS_PER_YEAR) / 1000,
  };
}

/* ---------- Størrelser og sammenligninger ---------- */

/** NVEs inndeling etter effekt: mikro under 100 kW, mini 0,1–1 MW, små 1–10 MW. */
export type PlantSize = 'mikro' | 'mini' | 'smaa' | 'stort';

export const PLANT_SIZE_NAMES: Record<PlantSize, string> = {
  mikro: 'mikrokraftverk',
  mini: 'minikraftverk',
  smaa: 'småkraftverk',
  stort: 'stort kraftverk',
};

export function plantSize(P: number): PlantSize {
  if (P < 100e3) return 'mikro';
  if (P < 1e6) return 'mini';
  if (P < 10e6) return 'smaa';
  return 'stort';
}

/** Omtrent så mange husstander som i …, til forklaringen. Grensene er grove og bare for å gi et bilde. */
export function settlementName(households: number): string {
  if (households < 1) return 'mindre enn det én husstand bruker';
  if (households < 10) return 'noen få hus';
  if (households < 200) return 'en grend';
  if (households < 2000) return 'en bygd';
  if (households < 20000) return 'en småby';
  if (households < 200000) return 'en by';
  return 'en storby';
}

/**
 * Hvor mange husstander ett symbol i bildediagrammet står for: 1, 2 eller 5 · 10ⁿ, så det blir høyst `max` symboler.
 * Minst 1 (da kan det bli under ett symbol).
 */
export function pictogramUnit(households: number, max = 20): number {
  if (!(households > max)) return 1;
  const need = households / max;
  const k = Math.floor(Math.log10(need));
  for (const m of [1, 2, 5, 10]) {
    const u = Number((m * 10 ** k).toPrecision(6));
    if (u >= need * (1 - 1e-9)) return u;
  }
  return 10 ** (k + 1);
}

/* ---------- Tall til tekst ---------- */

/** Rund av til `sig` gjeldende siffer: 145 016 → 145 000 (sig = 3). */
export function roundSig(v: number, sig = 3): number {
  if (!Number.isFinite(v) || v === 0) return v;
  const k = Math.floor(Math.log10(Math.abs(v))) - sig + 1;
  const f = 10 ** k;
  return Number((Math.round(v / f) * f).toPrecision(15));
}

/** Antall desimaler som gir `sig` gjeldende siffer (minst 0): 4,17 → 2, 44,1 → 1, 265 → 0. */
export function decimalsFor(v: number, sig = 3): number {
  if (!Number.isFinite(v) || v === 0) return 0;
  return Math.max(0, sig - 1 - Math.floor(Math.log10(Math.abs(v))));
}

const PREFIXES: { f: number; p: string }[] = [
  { f: 1e9, p: 'G' },
  { f: 1e6, p: 'M' },
  { f: 1e3, p: 'k' },
  { f: 1, p: '' },
];

/**
 * Verdi med SI-prefiks og tre gjeldende siffer: 264 870 000 W → { value: 264,87, unit: 'MW', decimals: 0 } (vises som
 * «265 MW»). Går over til neste prefiks når avrundingen gir 1000 (999 600 W → «1,00 MW»).
 */
export function withPrefix(v: number, unit: string, sig = 3): { value: number; unit: string; decimals: number } {
  if (!Number.isFinite(v)) return { value: v, unit, decimals: 0 };
  const a = Math.abs(v);
  for (let i = 0; i < PREFIXES.length; i++) {
    const { f, p } = PREFIXES[i]!;
    if (a >= f * (1 - 5e-4) || i === PREFIXES.length - 1) {
      const scaled = v / f;
      const d = decimalsFor(scaled, sig);
      const rounded = Number(Math.abs(scaled).toFixed(d));
      if (rounded >= 1000 && i > 0) {
        const up = PREFIXES[i - 1]!;
        const s2 = v / up.f;
        return { value: s2, unit: `${up.p}${unit}`, decimals: decimalsFor(s2, sig) };
      }
      return { value: scaled, unit: `${p}${unit}`, decimals: d };
    }
  }
  return { value: v, unit, decimals: 0 };
}

/* ---------- Forhåndsvalg ---------- */

export type PresetId = 'hytte' | 'smaa' | 'elv' | 'fjell';

export interface Preset extends HydroPlant {
  id: PresetId;
  label: string;
}

/** Typiske norske kraftverk (egne tall, ikke ekte anlegg). Alle verdiene ligger i lista til glidebryterne. */
export const PRESETS: Preset[] = [
  { id: 'hytte', label: 'Bekken ved hytta', h: 40, Q: 0.02, eta: 0.7 },
  { id: 'smaa', label: 'Småkraftverk', h: 200, Q: 2.5, eta: 0.85 },
  { id: 'elv', label: 'Elvekraftverk', h: 20, Q: 250, eta: 0.9 },
  { id: 'fjell', label: 'Fjellkraftverk', h: 600, Q: 50, eta: 0.9 },
];

/** Forhåndsvalget som har akkurat disse tallene, eller null. */
export function matchPreset(p: HydroPlant): PresetId | null {
  const hit = PRESETS.find(
    (s) => Math.abs(s.h - p.h) < 1e-9 && Math.abs(s.Q - p.Q) < 1e-9 * Math.max(1, s.Q) && Math.abs(s.eta - p.eta) < 1e-9,
  );
  return hit?.id ?? null;
}
