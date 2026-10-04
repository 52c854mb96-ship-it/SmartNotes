import type { ReactNode } from 'react';
import { Label, VIZ, fmt, useTextScale } from '../kit';

export interface Bar {
  value: number;
  color: string;
  /** Vis tallverdien ved enden av søylen. */
  showValue?: boolean;
  /** Stiplet omriss opp til denne verdien (f.eks. energien før støtet, for å vise hva som gikk tapt). */
  ghost?: number;
}

export interface BarGroup {
  label: string;
  bars: Bar[];
}

/** Omtrent halve bredden av en etikett i figurens enheter (ca. 9,6 per tegn ved 17 px), så den kan holdes inne i panelet. */
function halfText(text: string, f: number): number {
  return (text.length * 9.6 * f) / 2 + 2;
}

/**
 * Søylediagram med grupper (f.eks. «Før» og «Etter») for én størrelse. Tegnes inne i en <Figure>,
 * forskjøvet til (x, 0). Søylene kan være negative (bevegelsesmengde mot venstre).
 */
export function BarPanel({
  x,
  width,
  height,
  title,
  groups,
  decimals = 2,
}: {
  x: number;
  width: number;
  height: number;
  title: ReactNode;
  groups: BarGroup[];
  decimals?: number;
}) {
  const f = useTextScale();
  const values = groups.flatMap((g) => g.bars.flatMap((b) => [b.value, b.ghost ?? 0]));
  const lo = Math.min(0, ...values);
  let hi = Math.max(0, ...values);
  if (hi - lo < 1e-9) hi = 1;
  const hasNeg = lo < -1e-9;
  const labelRoom = 26 * f;
  const plotTop = 30 * f + 12 + labelRoom;
  const plotBottom = height - 24 * f - 14 - (hasNeg ? labelRoom : 0);
  const scale = (plotBottom - plotTop) / (hi - lo);
  const zeroY = plotTop + hi * scale;
  const sy = (v: number) => zeroY - v * scale;

  const n = Math.max(...groups.map((g) => g.bars.length));
  const gap = 6;
  const groupGap = 46;
  const bw = Math.min(46, (width - 20 - groupGap * (groups.length - 1) - gap * (n - 1) * groups.length) / (n * groups.length));
  const groupW = n * bw + (n - 1) * gap;
  const totalW = groups.length * groupW + (groups.length - 1) * groupGap;
  const x0 = x + (width - totalW) / 2;

  // Tallet over (eller under) den høyeste (laveste) søylen i gruppen, så det ikke havner oppå nabosøylene.
  const groupTop = (g: BarGroup) => Math.min(zeroY, ...g.bars.flatMap((b) => [sy(b.value), sy(b.ghost ?? 0)]));
  const groupBottom = (g: BarGroup) => Math.max(zeroY, ...g.bars.map((b) => sy(b.value)));

  return (
    <g>
      <Label x={x + 6} y={22 * f} anchor="start">
        {title}
      </Label>
      <line x1={x0 - 14} y1={zeroY} x2={x0 + totalW + 14} y2={zeroY} stroke={VIZ.muted} strokeWidth={1.5} />
      {groups.map((g, gi) => {
        const gx = x0 + gi * (groupW + groupGap);
        return (
          <g key={g.label}>
            {g.bars.map((b, bi) => {
              const bx = gx + bi * (bw + gap);
              const y = sy(b.value);
              const top = Math.min(y, zeroY);
              const h = Math.max(1.5, Math.abs(y - zeroY));
              const neg = b.value < 0;
              return (
                <g key={bi}>
                  {b.ghost !== undefined && Math.abs(b.ghost - b.value) > 1e-9 && (
                    <rect
                      x={bx}
                      y={Math.min(sy(b.ghost), zeroY)}
                      width={bw}
                      height={Math.abs(sy(b.ghost) - zeroY)}
                      fill="none"
                      stroke={b.color}
                      strokeWidth={1.5}
                      strokeDasharray="5 4"
                    />
                  )}
                  <rect x={bx} y={top} width={bw} height={h} rx={3} fill={b.color} />
                  {b.showValue && (
                    <Label
                      x={Math.min(bx + bw / 2, x + width - halfText(fmt(b.value, decimals), f))}
                      y={neg ? groupBottom(g) + 20 * f : groupTop(g) - 8}
                      anchor="middle"
                    >
                      {fmt(b.value, decimals)}
                    </Label>
                  )}
                </g>
              );
            })}
            <Label x={gx + groupW / 2} y={height - 10} anchor="middle" muted>
              {g.label}
            </Label>
          </g>
        );
      })}
    </g>
  );
}
