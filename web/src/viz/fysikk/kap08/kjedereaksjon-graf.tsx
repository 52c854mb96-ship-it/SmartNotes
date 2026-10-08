/**
 * Grafen i «Fisjon og kjedereaksjon» (k8-kjedereaksjon): antall fisjoner i hver generasjon. Søylene er treet i
 * figuren over (generasjon 0–5), og kurven er gjennomsnittet N₀ · kᵍ over 10 generasjoner.
 */
import { Plot, TSup, Txt, VIZ, fmt, linePath, niceTicks, useTextScale } from '../../kit';
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
      {({ sx, sy, x0, x1, y0, y1 }) => {
        const bw = Math.min(34, (sx(1) - sx(0)) * 0.56);
        const endY = sy(Math.min(yMax, end));
        const oneY = sy(1);
        const flat = Math.abs(end - 1) < 1e-9;
        // Etiketten til kurven: under enden når den går ut på toppen, ellers over.
        const curveLabelY = flat ? oneY - 34 * f : endY < y1 + 34 * f ? endY + 26 * f : endY - 12 * f;
        // Etiketten til k = 1-linja: på motsatt side av kurven.
        const below = oneY + 22 * f;
        const refLabelY = end > 1 && below < y0 - 6 * f ? below : oneY - 10 * f;
        return (
          <g>
            {/* x-aksen starter litt før 0 for søylene: dekk aksen Plot tegner ved g = 0, og tegn y-aksen til venstre. */}
            <line x1={sx(0)} x2={sx(0)} y1={y0} y2={y1} stroke={VIZ.surface} strokeWidth={3 * ss} />
            <line x1={sx(0)} x2={sx(0)} y1={y0} y2={y1} className="viz-gridline" />
            <line x1={x0} x2={x0} y1={y0} y2={y1} className="viz-axis" />
            {/* k = 1: like mange fisjoner hele tida */}
            <line x1={x0} x2={x1} y1={oneY} y2={oneY} stroke={VIZ.muted} strokeWidth={1.4 * ss} strokeDasharray="6 5" />
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
                </g>
              );
            })}
            <path d={linePath(pts, sx, sy)} fill="none" stroke={CURVE_COLOR} strokeWidth={3 * ss} strokeLinejoin="round" />
            {pts.map(([g, v]) => (
              <circle key={g} cx={sx(g)} cy={sy(v)} r={3.6 * ss} fill={CURVE_COLOR} stroke={VIZ.surface} strokeWidth={1.2 * ss} />
            ))}
            {counts.map((n, g) => (
              <Txt key={g} x={sx(g)} y={Math.max(y1 + 14 * f, sy(n) - 9 * f)} size={0.78} color={BAR_COLOR} weight={700}>
                {String(n)}
              </Txt>
            ))}
            <Txt x={sx(G) + 2} y={curveLabelY} anchor="end" size={0.84} color={CURVE_COLOR} weight={700}>
              {fmt(k, 2)}
              <TSup>{G}</TSup> = {sigText(end)}
              {flat ? (f > 1.3 ? ': jevnt' : ': like mange hele tida') : ''}
            </Txt>
            {!flat && (
              <Txt x={sx(G) + 2} y={refLabelY} anchor="end" size={0.74} muted>
                {f > 1.3 ? 'k = 1' : 'k = 1: like mange hele tida'}
              </Txt>
            )}
          </g>
        );
      }}
    </Plot>
  );
}
