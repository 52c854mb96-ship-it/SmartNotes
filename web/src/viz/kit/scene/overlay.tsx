/**
 * Det som legges oppå scenene for å forklare fysikken: tykke kraftpiler, mållinjer, etiketter med strek og skilt
 * med verdier. Alt har en glorie i flatefargen, så det kan leses oppå himmel, asfalt, snø og tre.
 *
 * Regel: scenen er dempet og naturlig, fysikken er sterk og tydelig. Bruk VIZ-fargene (VIZ.gravity, VIZ.normal …)
 * til piler og SCENE-fargene til gjenstandene.
 */
import type { ReactNode } from 'react';
import { VIZ } from '../colors';
import { useTextScale } from '../controls';
import { Txt } from '../txt';
import { alpha, shade, useStrokeScale } from './core';
import { SCENE } from './palette';

export interface ForceArrowProps {
  /** Angrepspunktet (halen). */
  x1: number;
  y1: number;
  /** Spissen. */
  x2: number;
  y2: number;
  color: string;
  /** Tykkelsen på skaftet i figurens enheter (standard 7, litt tykkere på mobil). */
  width?: number;
  label?: ReactNode;
  /** Plassering av etiketten (standard: like forbi spissen). */
  labelX?: number;
  labelY?: number;
  labelAnchor?: 'start' | 'middle' | 'end';
  /** Relativ tekststørrelse (1 = vanlig etikett). */
  labelSize?: number;
  /** Stiplet og halvgjennomsiktig: komponenter av en kraft (G∥, G⊥), ikke egne krefter. */
  dashed?: boolean;
  /** Prikk i angrepspunktet. */
  origin?: boolean;
  /** Tegn ingenting når pila er kortere enn dette (figurens enheter). */
  minLength?: number;
}

/**
 * Kraft-, fart- eller akselerasjonspil for scenene: tykk pil med kontur som synes oppå alt.
 *   <ForceArrow x1={cx} y1={cy} x2={cx} y2={cy + G * k} color={VIZ.gravity} label="G" origin />
 * Lengden skal være proporsjonal med størrelsen (fast skala px/N i hele figuren).
 */
export function ForceArrow({
  x1,
  y1,
  x2,
  y2,
  color,
  width = 7,
  label,
  labelX,
  labelY,
  labelAnchor,
  labelSize = 1,
  dashed,
  origin,
  minLength = 3,
}: ForceArrowProps) {
  const ss = useStrokeScale();
  const f = useTextScale();
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy);
  if (!Number.isFinite(len) || len < minLength) return null;
  const ux = dx / len;
  const uy = dy / len;
  const nx = -uy;
  const ny = ux;
  const w = (dashed ? width * 0.75 : width) * ss;
  const hl = Math.min(len * 0.62, Math.max(14 * ss, w * 2.5));
  const hh = Math.max(7 * ss, w * 1.45);
  const bx = x2 - ux * hl;
  const by = y2 - uy * hl;
  const p = (x: number, y: number) => `${r2(x)},${r2(y)}`;
  const d = [
    `M${p(x1 + (nx * w) / 2, y1 + (ny * w) / 2)}`,
    `L${p(bx + (nx * w) / 2, by + (ny * w) / 2)}`,
    `L${p(bx + nx * hh, by + ny * hh)}`,
    `L${p(x2, y2)}`,
    `L${p(bx - nx * hh, by - ny * hh)}`,
    `L${p(bx - (nx * w) / 2, by - (ny * w) / 2)}`,
    `L${p(x1 - (nx * w) / 2, y1 - (ny * w) / 2)}`,
    'Z',
  ].join(' ');

  // Etiketten like forbi spissen, til siden for loddrette piler så den ikke havner oppå pila.
  const vertical = Math.abs(uy) > 0.85;
  const anchor = labelAnchor ?? (vertical ? 'start' : ux > 0.3 ? 'start' : ux < -0.3 ? 'end' : 'middle');
  const lx = labelX ?? (vertical ? x2 + 10 * f : x2 + ux * 12 * f);
  const ly = labelY ?? (vertical ? (uy > 0 ? y2 - 4 * f : y2 + 14 * f) : y2 + uy * 14 * f + 6 * f);

  return (
    <g className="viz-arrow">
      {dashed ? (
        <>
          <path d={d} fill="none" stroke={VIZ.surface} strokeWidth={3.5 * ss} strokeLinejoin="round" opacity={0.85} />
          <path d={d} fill={alpha(color, 0.22)} stroke={color} strokeWidth={1.7 * ss} strokeDasharray={`${5 * ss} ${3.5 * ss}`} strokeLinejoin="round" />
        </>
      ) : (
        <>
          <path d={d} fill={color} className="sc-force" strokeWidth={4 * ss} />
          <path d={d} fill="none" stroke={shade(color, 0.32)} strokeWidth={1.1 * ss} strokeLinejoin="round" opacity={0.75} />
        </>
      )}
      {origin && <circle cx={x1} cy={y1} r={3.6 * ss} fill={VIZ.ink} stroke={VIZ.surface} strokeWidth={1.6 * ss} />}
      {label !== undefined && (
        <Txt x={lx} y={ly} anchor={anchor} color={color} weight={720} size={labelSize}>
          {label}
        </Txt>
      )}
    </g>
  );
}

const r2 = (v: number) => Math.round(v * 100) / 100;

/**
 * Mållinje mellom to punkter, som på en arbeidstegning: «s = 25 m», «h = 4,0 m».
 * `offset` flytter linja vinkelrett ut fra punktene (positiv = til venstre for retningen fra 1 til 2), og
 * hjelpelinjer viser hvor målene er tatt.
 */
export function Dimension({
  x1,
  y1,
  x2,
  y2,
  label,
  offset = 0,
  color = VIZ.ink,
  labelOffset = 0,
  labelSize = 0.9,
}: {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  label?: ReactNode;
  offset?: number;
  color?: string;
  /** Flytt etiketten langs linja (figurens enheter), f.eks. hvis noe står midt på. */
  labelOffset?: number;
  labelSize?: number;
}) {
  const ss = useStrokeScale();
  const f = useTextScale();
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy);
  if (!Number.isFinite(len) || len < 2) return null;
  const ux = dx / len;
  const uy = dy / len;
  const nx = uy;
  const ny = -ux;
  const ax = x1 + nx * offset;
  const ay = y1 + ny * offset;
  const bx = x2 + nx * offset;
  const by = y2 + ny * offset;
  const h = Math.min(9 * ss, len / 3);
  const head = (px: number, py: number, sx: number, sy: number) =>
    `${r2(px)},${r2(py)} ${r2(px + sx * h - sy * h * 0.42)},${r2(py + sy * h + sx * h * 0.42)} ${r2(px + sx * h + sy * h * 0.42)},${r2(py + sy * h - sx * h * 0.42)}`;
  const mx = (ax + bx) / 2 + ux * labelOffset;
  const my = (ay + by) / 2 + uy * labelOffset;
  const horizontal = Math.abs(uy) < 0.5;
  // Etiketten over vannrette linjer og ved siden av loddrette (på den siden linja er flyttet ut til).
  const side = offset === 0 ? 1 : Math.sign(offset);
  const lx = horizontal ? mx : mx + (nx >= 0 ? 1 : -1) * side * 8 * f;
  const ly = horizontal ? my - 9 * f : my + 6 * f;
  const anchor = horizontal ? 'middle' : (nx >= 0 ? 1 : -1) * side > 0 ? 'start' : 'end';
  return (
    <g className="sc-dimension" aria-hidden={label === undefined}>
      {offset !== 0 && (
        <g stroke={color} strokeWidth={1 * ss} opacity={0.55}>
          <line x1={x1} y1={y1} x2={ax + nx * 5 * Math.sign(offset)} y2={ay + ny * 5 * Math.sign(offset)} strokeDasharray="3 3" />
          <line x1={x2} y1={y2} x2={bx + nx * 5 * Math.sign(offset)} y2={by + ny * 5 * Math.sign(offset)} strokeDasharray="3 3" />
        </g>
      )}
      <line x1={ax} y1={ay} x2={bx} y2={by} stroke={VIZ.surface} strokeWidth={4 * ss} opacity={0.8} />
      <line x1={ax} y1={ay} x2={bx} y2={by} stroke={color} strokeWidth={1.4 * ss} />
      <polygon points={head(ax, ay, ux, uy)} fill={color} />
      <polygon points={head(bx, by, -ux, -uy)} fill={color} />
      {label !== undefined && (
        <Txt x={lx} y={ly} anchor={anchor} size={labelSize} color={color} weight={650}>
          {label}
        </Txt>
      )}
    </g>
  );
}

/**
 * Etikett med tynn strek til det den peker på, som i lærebokfigurer: <Callout x y lx ly>Knusesone</Callout>.
 * (x, y) er punktet, (lx, ly) grunnlinjen til teksten. Teksten vokser på mobil, så sett av plass.
 */
export function Callout({
  x,
  y,
  lx,
  ly,
  children,
  anchor,
  color,
  strong,
  size = 0.85,
  dot = true,
}: {
  x: number;
  y: number;
  lx: number;
  ly: number;
  children: ReactNode;
  anchor?: 'start' | 'middle' | 'end';
  color?: string;
  strong?: boolean;
  size?: number;
  dot?: boolean;
}) {
  const f = useTextScale();
  const ss = useStrokeScale();
  const a = anchor ?? (lx >= x ? 'start' : 'end');
  const ex = a === 'start' ? lx - 5 : a === 'end' ? lx + 5 : lx;
  const ey = a === 'middle' ? (ly > y ? ly - 15 * f * size : ly + 6) : ly - 5.5 * f * size;
  return (
    <g>
      <line x1={x} y1={y} x2={ex} y2={ey} stroke={VIZ.surface} strokeWidth={3.4 * ss} strokeLinecap="round" opacity={0.8} />
      <line x1={x} y1={y} x2={ex} y2={ey} stroke={color ?? VIZ.muted} strokeWidth={1.3 * ss} strokeLinecap="round" />
      {dot && <circle cx={x} cy={y} r={3 * ss} fill={color ?? VIZ.ink} stroke={VIZ.surface} strokeWidth={1.3 * ss} />}
      <Txt x={lx} y={ly} anchor={a} size={size} weight={strong ? 700 : 580} color={color}>
        {children}
      </Txt>
    </g>
  );
}

/**
 * Lite skilt med en verdi i scenen, f.eks. farten over bilen («80 km/h») eller temperaturen på en gryte.
 * Bredden beregnes fra teksten, så `text` må være ren tekst.
 */
export function ValueTag({
  x,
  y,
  text,
  color,
  anchor = 'middle',
  size = 0.9,
  pointer,
}: {
  x: number;
  /** Midten av skiltet i høyden. */
  y: number;
  text: string;
  /** Tekstfarge (f.eks. VIZ.velocity). */
  color?: string;
  anchor?: 'start' | 'middle' | 'end';
  size?: number;
  /** Liten spiss ned mot det skiltet hører til (høyden fra skiltets underkant). */
  pointer?: number;
}) {
  const f = useTextScale();
  const ss = useStrokeScale();
  const fs = 17 * f * size;
  const w = Math.max(fs * 1.6, text.length * fs * 0.6 + 16 * f);
  const h = fs * 1.55;
  const left = anchor === 'middle' ? x - w / 2 : anchor === 'start' ? x : x - w;
  const cx = left + w / 2;
  return (
    <g>
      {pointer !== undefined && pointer > 0 && (
        <polygon
          points={`${r2(cx - 6 * ss)},${r2(y + h / 2 - 1)} ${r2(cx + 6 * ss)},${r2(y + h / 2 - 1)} ${r2(cx)},${r2(y + h / 2 + pointer)}`}
          fill={VIZ.surface}
          stroke={SCENE.outline}
          strokeWidth={1 * ss}
        />
      )}
      <rect x={left} y={y - h / 2} width={w} height={h} rx={h * 0.32} fill={VIZ.surface} stroke={SCENE.outline} strokeWidth={1 * ss} opacity={0.96} />
      <Txt x={cx} y={y + fs * 0.34} anchor="middle" size={size} color={color} weight={700} halo={false}>
        {text}
      </Txt>
    </g>
  );
}

/**
 * Fartsstreker bak en gjenstand i bevegelse. (x, y) er bakkanten midt på, `dir` er fartsretningen
 * (1 = mot høyre). Lengden bør vokse med farten; ved 0 tegnes ingenting.
 */
export function SpeedLines({ x, y, length, spread = 30, dir = 1, color }: { x: number; y: number; length: number; spread?: number; dir?: 1 | -1; color?: string }) {
  const ss = useStrokeScale();
  if (!(length > 4)) return null;
  const rows = [
    { dy: -spread / 2, k: 0.7 },
    { dy: 0, k: 1 },
    { dy: spread / 2, k: 0.55 },
  ];
  return (
    <g stroke={color ?? SCENE.outline} strokeLinecap="round" aria-hidden>
      {rows.map((r, i) => (
        <line key={i} x1={x - dir * 6} y1={y + r.dy} x2={x - dir * (6 + length * r.k)} y2={y + r.dy} strokeWidth={2.2 * ss} opacity={0.55 - i * 0.1} />
      ))}
    </g>
  );
}
