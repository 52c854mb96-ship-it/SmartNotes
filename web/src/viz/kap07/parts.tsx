/**
 * Små SVG-byggeklosser for atom- og kjernefysikk (kapittel 7 og 8): farget tekst, nuklidesymbol ᴬ_Z X og en kjerne
 * av protoner og nøytroner.
 */
import type { ReactNode } from 'react';
import { VIZ } from '../kit';
import { seededRandom } from './random';

/** Faste farger for partiklene i kapittel 7 og 8. */
export const PARTICLE = {
  proton: VIZ.series[1]!,
  neutron: VIZ.tension,
  electron: VIZ.series[0]!,
  positron: VIZ.series[4]!,
  photon: VIZ.series[3]!,
} as const;

/**
 * Tekst i figuren med egen farge og eventuelt fast størrelse. (Kit-ets <Label color> får blekkfarge fordi
 * .viz-label i viz.css overstyrer fill-attributtet, så fargen settes som stil her.)
 * Uten `size` følger teksten den vanlige størrelsen, som vokser på mobil.
 */
export function Txt({
  x,
  y,
  children,
  anchor = 'middle',
  color,
  size,
  weight,
  muted,
  halo = true,
}: {
  x: number;
  y: number;
  children: ReactNode;
  anchor?: 'start' | 'middle' | 'end';
  color?: string;
  size?: number;
  weight?: number;
  muted?: boolean;
  /** Lys kant rundt teksten (standard). Slå av for tekst på mørk bakgrunn. */
  halo?: boolean;
}) {
  return (
    <text
      x={x}
      y={y}
      textAnchor={anchor}
      className={`viz-label${muted ? ' is-muted' : ''}`}
      style={{ fill: color, fontSize: size, fontWeight: weight, strokeWidth: halo ? undefined : 0 }}
    >
      {children}
    </text>
  );
}

/** Omtrentlig bredde av en tekst i em (nok til å plassere symboler uten å måle). */
export function textWidthEm(s: string): number {
  let w = 0;
  for (const ch of s) {
    if (/[0-9]/.test(ch)) w += 0.64;
    else if (/[A-Z]/.test(ch)) w += 0.76;
    else if (/[a-z]/.test(ch)) w += 0.64;
    else if (ch === ' ') w += 0.28;
    else w += 0.6;
  }
  return w;
}

export interface NuclideSymbolProps {
  /** Plassering: venstre kant (`start`), midten eller høyre kant. */
  x: number;
  /** Grunnlinjen til symbolet. */
  y: number;
  /** Nukleontall (oppe til venstre). */
  A: number | string;
  /** Protontall eller ladning (nede til venstre). */
  Z: number | string;
  symbol: string;
  /** Hevet tekst etter symbolet, f.eks. «⁺», «²⁻» eller «*». */
  suffix?: string;
  /** Skriftstørrelse for symbolet i figurens enheter. */
  size: number;
  color?: string;
  anchor?: 'start' | 'middle' | 'end';
  /** Farger for nukleontallet og protontallet (f.eks. for å vise bevaring). */
  colorA?: string;
  colorZ?: string;
}

/** Bredden til et nuklidesymbol i figurens enheter. */
export function nuclideSymbolWidth(A: number | string, Z: number | string, symbol: string, size: number, suffix = ''): number {
  const idx = size * 0.56;
  const idxW = Math.max(textWidthEm(String(A)), textWidthEm(String(Z))) * idx;
  return idxW + size * 0.05 + textWidthEm(symbol) * size + (suffix ? textWidthEm(suffix) * size * 0.6 : 0);
}

/** Nuklidesymbol ᴬ_Z X med nukleontallet over protontallet til venstre for symbolet. */
export function NuclideSymbol({ x, y, A, Z, symbol, suffix, size, color, anchor = 'start', colorA, colorZ }: NuclideSymbolProps) {
  const idx = size * 0.56;
  const idxW = Math.max(textWidthEm(String(A)), textWidthEm(String(Z))) * idx;
  const total = nuclideSymbolWidth(A, Z, symbol, size, suffix);
  const x0 = anchor === 'start' ? x : anchor === 'middle' ? x - total / 2 : x - total;
  const xi = x0 + idxW;
  return (
    <g>
      <Txt x={xi} y={y - size * 0.4} anchor="end" size={idx} color={colorA ?? color}>
        {A}
      </Txt>
      <Txt x={xi} y={y + size * 0.16} anchor="end" size={idx} color={colorZ ?? color}>
        {Z}
      </Txt>
      <Txt x={xi + size * 0.05} y={y} anchor="start" size={size} color={color}>
        {symbol}
        {suffix && (
          <tspan dy={-size * 0.38} style={{ fontSize: size * 0.6 }}>
            {suffix}
          </tspan>
        )}
      </Txt>
    </g>
  );
}

/** Radius til en kjerne med `count` kuler med radius `r` (pakket som en solsikke). */
export function nucleusRadius(count: number, r: number): number {
  return count <= 1 ? r : r * 1.02 * Math.sqrt(count) + r * 0.6;
}

/**
 * Kjerne av protoner (med +) og nøytroner, pakket som en solsikke. Protonene og nøytronene blandes med en fast
 * tallgenerator, så samme kjerne alltid ser lik ut.
 */
export function Nucleus({ cx, cy, Z, N, r = 7, plus = true }: { cx: number; cy: number; Z: number; N: number; r?: number; plus?: boolean }) {
  const count = Math.max(0, Z + N);
  if (count === 0) return null;
  // Fordel protonene jevnt utover (ikke alle i midten): bland rekkefølgen med fast frø.
  const kinds: boolean[] = [];
  for (let i = 0; i < count; i++) kinds.push(i < Z);
  const rnd = seededRandom(1000 * count + Z);
  for (let i = count - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    const tmp = kinds[i]!;
    kinds[i] = kinds[j]!;
    kinds[j] = tmp;
  }
  const golden = Math.PI * (3 - Math.sqrt(5));
  const c = r * 1.02;
  const balls: ReactNode[] = [];
  // De ytterste tegnes først, så de innerste ligger «foran» og kjernen ser ut som en kule.
  for (let k = count - 1; k >= 0; k--) {
    const rad = count === 1 ? 0 : c * Math.sqrt(k + 0.5);
    const x = cx + rad * Math.cos(k * golden);
    const y = cy + rad * Math.sin(k * golden);
    const isP = kinds[k]!;
    balls.push(
      <g key={k}>
        <circle cx={x} cy={y} r={r} fill={isP ? PARTICLE.proton : PARTICLE.neutron} stroke={VIZ.surface} strokeWidth={Math.max(1, r * 0.18)} />
        {isP && plus && r >= 6 && (
          <path d={`M${x - r * 0.45},${y}h${r * 0.9}M${x},${y - r * 0.45}v${r * 0.9}`} stroke={VIZ.surface} strokeWidth={Math.max(1.2, r * 0.2)} />
        )}
      </g>,
    );
  }
  return <g>{balls}</g>;
}

/** Elektron (blått med minustegn) eller positron. */
export function Lepton({ x, y, r = 8, positron = false }: { x: number; y: number; r?: number; positron?: boolean }) {
  return (
    <g>
      <circle cx={x} cy={y} r={r} fill={positron ? PARTICLE.positron : PARTICLE.electron} stroke={VIZ.surface} strokeWidth={1.5} />
      <path d={`M${x - r * 0.5},${y}h${r}`} stroke={VIZ.surface} strokeWidth={Math.max(1.4, r * 0.22)} />
      {positron && <path d={`M${x},${y - r * 0.5}v${r}`} stroke={VIZ.surface} strokeWidth={Math.max(1.4, r * 0.22)} />}
    </g>
  );
}

/** Bølget fotonpil fra (x1, y1) til (x2, y2). */
export function PhotonWave({
  x1,
  y1,
  x2,
  y2,
  color,
  amplitude = 7,
  wavelength = 18,
  width = 2.5,
}: {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  color: string;
  amplitude?: number;
  wavelength?: number;
  width?: number;
}) {
  const len = Math.hypot(x2 - x1, y2 - y1);
  if (!(len > 12)) return null;
  const ux = (x2 - x1) / len;
  const uy = (y2 - y1) / len;
  const head = 11;
  const body = len - head;
  const pts: string[] = [];
  const n = Math.max(12, Math.round(body / 2));
  for (let i = 0; i <= n; i++) {
    const s = (body * i) / n;
    // Amplituden går mot null i endene så pilspissen sitter på linja
    const env = Math.min(1, s / 8, (body - s) / 8);
    const o = amplitude * env * Math.sin((2 * Math.PI * s) / wavelength);
    pts.push(`${(x1 + ux * s - uy * o).toFixed(1)},${(y1 + uy * s + ux * o).toFixed(1)}`);
  }
  const bx = x1 + ux * body;
  const by = y1 + uy * body;
  const hw = head * 0.5;
  return (
    <g>
      <polyline points={pts.join(' ')} fill="none" stroke={color} strokeWidth={width} strokeLinejoin="round" strokeLinecap="round" />
      <polygon points={`${x2},${y2} ${bx - uy * hw},${by + ux * hw} ${bx + uy * hw},${by - ux * hw}`} fill={color} />
    </g>
  );
}
