/**
 * Interne hjelpere for familien «mekanikk» (mekanikk.tsx og mekanikk-*.tsx). Eksporteres ikke fra scene-kit-et.
 */
import { useTextScale } from '../controls';

/** Farger som bare familien «mekanikk» bruker (mekanikk.css, importert fra mekanikk.tsx). */
export const MEK = {
  papp: 'var(--sc-mekanikk-papp)',
  pappDark: 'var(--sc-mekanikk-papp-dark)',
  teip: 'var(--sc-mekanikk-teip)',
  paper: 'var(--sc-mekanikk-paper)',
  print: 'var(--sc-mekanikk-print)',
  dial: 'var(--sc-mekanikk-dial)',
  hamp: 'var(--sc-mekanikk-hamp)',
  nylon: 'var(--sc-mekanikk-nylon)',
  strikk: 'var(--sc-mekanikk-strikk)',
  tennis: 'var(--sc-mekanikk-tennis)',
  basket: 'var(--sc-mekanikk-basket)',
  maalebaand: 'var(--sc-mekanikk-maalebaand)',
  inkTre: 'var(--sc-mekanikk-ink-tre)',
  inkMetall: 'var(--sc-mekanikk-ink-metall)',
  inkStein: 'var(--sc-mekanikk-ink-stein)',
  inkGummi: 'var(--sc-mekanikk-ink-gummi)',
  inkIs: 'var(--sc-mekanikk-ink-is)',
  /** Baksiden av vindingene i en fjær (lys nok til å synes mot mørk bakgrunn). */
  coilBack: 'var(--sc-mekanikk-coil-back)',
} as const;

/** Tallet, eller `fallback` når det mangler eller ikke er endelig. */
export function num(v: number | undefined, fallback: number): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback;
}

export function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

/** Avrunding til to desimaler for path-strenger. */
export function r2(v: number): number {
  return Number.isFinite(v) ? Math.round(v * 100) / 100 : 0;
}

export const DEG = Math.PI / 180;

/** Punkt som tekst i en path: «12.5,7». */
export function pt(x: number, y: number): string {
  return `${r2(x)},${r2(y)}`;
}

/**
 * Skalasteg: stort steg (med tall) som gir omtrent `labels` tall over `range`, og et lite steg (streker) som ikke
 * kommer tettere enn `minGap` figurenheter når `unitsPerValue` er figurenheter per enhet på skalaen.
 */
export function scaleSteps(range: number, labels: number, unitsPerValue: number, minGap: number): { major: number; minor: number } {
  const span = Math.abs(range) > 0 ? Math.abs(range) : 1;
  const raw = span / Math.max(1, labels);
  const p = 10 ** Math.floor(Math.log10(raw));
  const m = raw / p;
  const lead = m <= 1.5 ? 1 : m <= 3.5 ? 2 : m <= 7.5 ? 5 : 10;
  const major = lead * p;
  const divisions = lead === 2 ? [10, 4, 2] : lead === 5 ? [10, 5] : [10, 5, 2];
  let minor = major;
  for (const d of divisions) {
    if ((major / d) * Math.abs(unitsPerValue) >= minGap) {
      minor = major / d;
      break;
    }
  }
  return { major, minor };
}

/** Antall desimaler som trengs for å skrive tall i steg på `step` (0,5 → 1, 0,25 → 2, 2 → 0). */
export function decimalsFor(step: number): number {
  for (let d = 0; d <= 4; d++) {
    if (Math.abs(Math.round(step * 10 ** d) - step * 10 ** d) < 1e-6) return d;
  }
  return 4;
}

/**
 * Tekst som står på en gjenstand (etikett på en kasse, tall på en skala): fast størrelse som får plass i boksen
 * `w` × `h` rundt (x, y), men som vokser litt på mobil så lenge den får plass.
 */
export function ObjectText({
  x,
  y,
  w,
  h,
  text,
  color,
  weight = 700,
  max = 15,
  anchor = 'middle',
  mirror,
}: {
  x: number;
  /** Midten av teksten i høyden. */
  y: number;
  w: number;
  h: number;
  text: string;
  color: string;
  weight?: number;
  /** Største størrelse på PC (figurenheter); ganges med tekstskaleringen på mobil. */
  max?: number;
  anchor?: 'start' | 'middle' | 'end';
  /** Speilvend teksten tilbake når gjenstanden er speilvendt (flip). */
  mirror?: boolean;
}) {
  const f = useTextScale();
  const len = Math.max(1.6, text.length);
  const px = Math.min(h * 0.72, w / (len * 0.6), max * f);
  if (!(px >= 3) || !text) return null;
  const node = (
    <text
      x={r2(x)}
      y={r2(y + px * 0.36)}
      fontSize={r2(px)}
      fill={color}
      fontWeight={weight}
      textAnchor={anchor}
      style={{ fontVariantNumeric: 'tabular-nums', letterSpacing: '0.01em' }}
    >
      {text}
    </text>
  );
  return mirror ? <g transform={`translate(${r2(2 * x)} 0) scale(-1 1)`}>{node}</g> : node;
}

/**
 * Skruefjær sett fra siden mellom (x1, y1) og (x2, y2): to path-strenger, forsiden og baksiden av vindingene.
 * Vindingene er litt skrå (som sett litt fra enden), så for- og bakside skilles. `lead` er rett tråd i hver ende.
 * `minPitch` er den minste avstanden mellom vindingene (tråden): presses fjæra kortere enn det, blir de rette endene
 * kortere først, og til slutt tegnes den som blokklengde (vindingene ligger inntil hverandre) fra (x1, y1).
 */
export function coilPaths(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  radius: number,
  turns: number,
  lead: number,
  tilt = 0.12,
  minPitch = 0,
): { front: string; back: string } {
  const L = Math.hypot(x2 - x1, y2 - y1);
  if (!(L > 0.5)) return { front: '', back: '' };
  const ux = (x2 - x1) / L;
  const uy = (y2 - y1) / L;
  const nx = -uy;
  const ny = ux;
  const block = turns * Math.max(0, minPitch);
  const ld = clamp((L - block) / 2, 0, Math.min(lead, L * 0.2));
  const a0 = ld;
  const pitch = Math.max(minPitch, (L - 2 * ld) / turns);
  // Blokklengde: enden følger vindingene, ikke (x2, y2)
  const endX = block > L ? x1 + ux * block : x2;
  const endY = block > L ? y1 + uy * block : y2;
  const map = (s: number, lat: number) => pt(x1 + ux * s + nx * lat, y1 + uy * s + ny * lat);
  const at = (phi: number) => map(a0 + (pitch * phi) / (2 * Math.PI) + tilt * radius * (Math.cos(phi) - 1), radius * Math.sin(phi));
  const end = 2 * Math.PI * turns;
  const front: string[] = [];
  const back: string[] = [];
  const SAMPLES = 7;
  for (let k = 0; k <= 2 * turns; k++) {
    const p0 = Math.max(0, -Math.PI / 2 + k * Math.PI);
    const p1 = Math.min(end, Math.PI / 2 + k * Math.PI);
    if (p1 <= p0) continue;
    const pts: string[] = [];
    for (let i = 0; i <= SAMPLES; i++) pts.push(at(p0 + ((p1 - p0) * i) / SAMPLES));
    const isFront = k % 2 === 0;
    let d = `M${pts.join(' L')}`;
    if (isFront && k === 0) d = `M${pt(x1, y1)} L${pts.join(' L')}`;
    if (isFront && k === 2 * turns) d += ` L${pt(endX, endY)}`;
    (isFront ? front : back).push(d);
  }
  return { front: front.join(' '), back: back.join(' ') };
}
