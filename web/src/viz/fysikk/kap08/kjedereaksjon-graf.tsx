/**
 * Grafen i «Fisjon og kjedereaksjon» (k8-kjedereaksjon): antall fisjoner i hver generasjon. Søylene er treet i
 * figuren over (generasjon 0–5), og kurven er gjennomsnittet N₀ · kᵍ over 10 generasjoner.
 */
import { Plot, Txt, VIZ, fmt, linePath, niceTicks, useTextScale } from '../../kit';
import { alpha, useStrokeScale } from '../../kit/scene';
import { GRAPH_GENERATIONS, expectedFissions, graphMax } from './model-kjedereaksjon';

/** Søylene (treet) og kurven (gjennomsnittet). */
export const BAR_COLOR = VIZ.series[0]!;
export const CURVE_COLOR = VIZ.series[1]!;

/** Tall med 2–3 gjeldende siffer: 57,7 · 1,00 · 0,0282. */
export function sigText(v: number): string {
  if (!Number.isFinite(v)) return '–';
  if (v === 0) return '0';
  const d = Math.max(0, Math.min(6, 2 - Math.floor(Math.log10(Math.abs(v)))));
  return fmt(v, d);
}

export function KjedeGraf({
  k,
  counts,
  current,
  width,
  height,
}: {
  k: number;
  /** Fisjoner i treet, generasjon 0 … */
  counts: number[];
  /** Generasjonen som er i gang (−1 før første fisjon). */
  current: number;
  width: number;
  height: number;
}) {
  const f = useTextScale();
  const ss = useStrokeScale();
  const G = GRAPH_GENERATIONS;
  const yMax = graphMax(k, counts);
  const ticks = niceTicks(0, yMax, f > 1.3 ? 4 : 5);
  const pts: [number, number][] = [];
  for (let g = 0; g <= G; g++) pts.push([g, Math.min(yMax, expectedFissions(k, g))]);
  const end = expectedFissions(k, G);
  const ydec = yMax <= 2 ? 1 : 0;

  return (
    <Plot
      x={{ min: -0.6, max: G + 0.6, label: 'Generasjon g', ticks: Array.from({ length: G + 1 }, (_, i) => i).filter((g) => f < 1.3 || g % 2 === 0) }}
      y={{ min: 0, max: yMax, label: 'Fisjoner i generasjonen', ticks, decimals: ydec }}
      width={width}
      height={height}
    >
      {({ sx, sy, x1, y0, y1 }) => {
        const bw = Math.min(34, (sx(1) - sx(0)) * 0.56);
        const labelY = sy(Math.min(yMax, end));
        return (
          <g>
            {/* k = 1: like mange fisjoner hele tida */}
            <line x1={sx(-0.6)} x2={x1} y1={sy(1)} y2={sy(1)} stroke={VIZ.muted} strokeWidth={1.4 * ss} strokeDasharray="6 5" />
            {counts.map((n, g) => {
              const on = g === current;
              const top = sy(n);
              return (
                <g key={g}>
                  {n > 0 ? (
                    <rect
                      x={sx(g) - bw / 2}
                      y={top}
                      width={bw}
                      height={Math.max(0, y0 - top)}
                      rx={3}
                      fill={on ? BAR_COLOR : alpha(BAR_COLOR, 0.55)}
                      stroke={BAR_COLOR}
                      strokeWidth={(on ? 2 : 1) * ss}
                    />
                  ) : (
                    <line x1={sx(g) - bw / 2} x2={sx(g) + bw / 2} y1={y0 - 1} y2={y0 - 1} stroke={BAR_COLOR} strokeWidth={2.5 * ss} />
                  )}
                  <Txt x={sx(g)} y={Math.max(y1 + 14 * f, top - 7 * f)} size={0.78} color={BAR_COLOR} weight={700}>
                    {String(n)}
                  </Txt>
                </g>
              );
            })}
            <path d={linePath(pts, sx, sy)} fill="none" stroke={CURVE_COLOR} strokeWidth={3 * ss} strokeLinejoin="round" />
            {pts.map(([g, v]) => (
              <circle key={g} cx={sx(g)} cy={sy(v)} r={3.6 * ss} fill={CURVE_COLOR} stroke={VIZ.surface} strokeWidth={1.2 * ss} />
            ))}
            <Txt x={sx(G) - 4 * f} y={labelY < y1 + 40 * f ? labelY + 26 * f : labelY - 14 * f} anchor="end" size={0.82} color={CURVE_COLOR} weight={700}>
              {`kᵍ = ${sigText(end)} etter ${G} generasjoner`}
            </Txt>
            <Txt x={sx(G) - 4 * f} y={sy(1) + (Math.abs(labelY - sy(1)) < 30 * f && end <= 1 ? -10 * f : 20 * f)} anchor="end" size={0.74} muted>
              k = 1: like mange hele tida
            </Txt>
          </g>
        );
      }}
    </Plot>
  );
}
