/**
 * Grafene i «Vannkoker eller kokeplate»: temperaturen som funksjon av tiden (rette linjer med konstant
 * virkningsgrad) og energiregnskapet E = Q + varmetap som liggende søyler.
 */
import { Plot, Txt, VIZ, fmt, linePath, niceTicks, scaleLinear, useTextScale } from '../../kit';
import { useStrokeScale } from '../../kit/scene';
import { BOILING_POINT, type BoilRun, type HeatState } from './model-vannkoker';
import { LOSS_COLOR, WATER_COLOR } from './vannkoker-scene';

export interface GraphLine {
  run: BoilRun;
  state: HeatState;
  color: string;
}

/** Temperatur–tid-graf med kokepunktet, tiden uten varmetap og en strek for tiden nå. */
export function TempGraph({
  T0,
  lines,
  tIdeal,
  tEnd,
  t,
  width,
  height,
}: {
  T0: number;
  lines: GraphLine[];
  tIdeal: number;
  tEnd: number;
  t: number;
  width: number;
  height: number;
}) {
  const f = useTextScale();
  const ss = useStrokeScale();
  const xTicks = niceTicks(0, tEnd, width < 700 || f > 1.3 ? 4 : 6).filter((v) => v <= tEnd + 1e-9);
  return (
    <Plot
      x={{ min: 0, max: tEnd, label: 'Tid t (s)', ticks: xTicks }}
      y={{ min: 0, max: 112, label: 'Temperatur (°C)', ticks: [0, 20, 40, 60, 80, 100] }}
      width={width}
      height={height}
    >
      {({ sx, sy, x0, x1, y0 }) => {
        const yb = sy(BOILING_POINT);
        const curve = (tb: number): [number, number][] => [
          [0, T0],
          [Math.min(tb, tEnd), Math.min(BOILING_POINT, T0 + ((BOILING_POINT - T0) * tEnd) / tb)],
        ];
        // Tidene over prikkene: aldri utenfor aksen, og ikke oppå hverandre.
        const labels = lines.map((l) => ({ x: sx(l.run.t), text: `${fmt(l.run.t, 0)} s`, color: l.color }));
        const halfW = (s: string) => s.length * 0.3 * 17 * 0.85 * f + 4;
        for (const lb of labels) lb.x = Math.min(x1 - halfW(lb.text), Math.max(x0 + halfW(lb.text), lb.x));
        if (labels.length === 2) {
          const [a, b] = labels as [(typeof labels)[0], (typeof labels)[0]];
          const gap = halfW(a.text) + halfW(b.text) + 6;
          if (b.x - a.x < gap) {
            const mid = (a.x + b.x) / 2;
            a.x = mid - gap / 2;
            b.x = mid + gap / 2;
          }
        }
        const tx = sx(Math.min(t, tEnd));
        // «Kokepunktet» står over streken til venstre, eller under den hvis en tid står i veien.
        const boilRight = x0 + 10 + 'Kokepunktet'.length * 0.6 * 17 * 0.8 * f + 8;
        const boilBelow = labels.some((lb) => lb.x - halfW(lb.text) < boilRight);
        return (
          <g>
            {/* Kokepunktet */}
            <line x1={x0} x2={x1} y1={yb} y2={yb} stroke={VIZ.muted} strokeWidth={1.2 * ss} strokeDasharray={`${6 * ss} ${5 * ss}`} />
            <Txt x={x0 + 10} y={boilBelow ? yb + 24 * f : yb - 10 * f} anchor="start" size={0.8} muted>
              Kokepunktet
            </Txt>

            {/* Uten varmetap (η = 100 %) */}
            <path
              d={linePath([...curve(tIdeal), [tEnd, BOILING_POINT]], sx, sy)}
              fill="none"
              stroke={VIZ.muted}
              strokeWidth={2.2 * ss}
              strokeDasharray={`${7 * ss} ${6 * ss}`}
            />

            {lines.map((l) => (
              <g key={l.run.heater.id}>
                <path d={linePath(curve(l.run.t), sx, sy)} fill="none" stroke={l.color} strokeWidth={3.4 * ss} strokeLinecap="round" />
                {l.run.t < tEnd && (
                  <line x1={sx(l.run.t)} x2={x1} y1={yb} y2={yb} stroke={l.color} strokeWidth={2 * ss} opacity={0.4} />
                )}
                {/* Når vannet koker: loddrett hjelpelinje ned til tidsaksen */}
                <line
                  x1={sx(l.run.t)}
                  x2={sx(l.run.t)}
                  y1={yb}
                  y2={y0}
                  stroke={l.color}
                  strokeWidth={1.3 * ss}
                  strokeDasharray={`${3 * ss} ${4 * ss}`}
                  opacity={0.75}
                />
                <circle cx={sx(l.run.t)} cy={yb} r={5.5 * ss} fill={l.color} stroke={VIZ.surface} strokeWidth={2 * ss} />
              </g>
            ))}
            {labels.map((lb, i) => (
              <Txt key={i} x={lb.x} y={yb - 12 * f} size={0.85} weight={740} color={lb.color}>
                {lb.text}
              </Txt>
            ))}

            {/* Tiden nå */}
            {t > 0 && (
              <g>
                <line x1={tx} x2={tx} y1={y0} y2={sy(108)} stroke={VIZ.ink} strokeWidth={1.4 * ss} opacity={0.4} />
                {lines.map((l) => (
                  <circle key={l.run.heater.id} cx={tx} cy={sy(l.state.T)} r={6.5 * ss} fill={VIZ.surface} stroke={l.color} strokeWidth={3 * ss} />
                ))}
              </g>
            )}
          </g>
        );
      }}
    </Plot>
  );
}

export interface EnergyRow {
  name: string;
  /** Kort navn på smale skjermer. */
  short: string;
  color: string;
  run: BoilRun;
  state: HeatState;
}

export interface BarsLayout {
  W: number;
  /** Navnet over søylen (smal figur) i stedet for til venstre. */
  stacked: boolean;
}

export function barsHeight(rows: number, stacked: boolean, f: number): number {
  return stacked ? 40 * f + rows * 74 * f + 56 * f : 44 + rows * 64 + 52 * f;
}

/** Energiregnskapet så langt: elektrisk energi E = P·t delt i varme til vannet Q og varmetap. */
export function EnergyBars({ rows, lay, t }: { rows: EnergyRow[]; lay: BarsLayout; t: number }) {
  const f = useTextScale();
  const ss = useStrokeScale();
  const { W, stacked } = lay;
  const max = Math.max(1, ...rows.map((r) => r.run.E));
  const labelW = stacked ? 0 : 200;
  const x0 = stacked ? 16 : 18 + labelW;
  const valueW = stacked ? 0 : 118 * f;
  const x1 = W - 16 - valueW;
  const xs = scaleLinear([0, max / 1000], [x0, x1]);
  const ticks = niceTicks(0, max / 1000, stacked ? 4 : 6).filter((v) => v <= (max / 1000) * 1.001);
  const top = stacked ? 40 * f : 44;
  const rowH = stacked ? 74 * f : 64;
  const bar = stacked ? 22 * f : 26;
  const yAxis = top + rowH * rows.length + 4;
  return (
    <g>
      <Txt x={stacked ? 16 : 18} y={stacked ? 24 * f : 26} anchor="start" size={0.95} weight={720} halo={false}>
        Energiregnskap etter {fmt(t, 0)} s
      </Txt>
      {ticks.map((v) => (
        <g key={v}>
          <line x1={xs(v)} x2={xs(v)} y1={top} y2={yAxis} stroke={VIZ.grid} strokeWidth={1 * ss} />
          <Txt x={xs(v)} y={yAxis + 20 * f} size={0.8} muted halo={false}>
            {fmt(v, 0)}
          </Txt>
        </g>
      ))}
      <Txt x={x1} y={yAxis + 40 * f} anchor="end" size={0.8} muted halo={false}>
        energi (kJ)
      </Txt>
      {rows.map((r, i) => {
        const y = top + rowH * i;
        const barY = stacked ? y + rowH - bar - 10 * f : y + (rowH - bar) / 2;
        const wQ = xs(r.state.Q / 1000) - x0;
        const wL = xs(r.state.E / 1000) - x0 - wQ;
        const wAll = xs(r.run.E / 1000) - x0;
        const qText = `Q ${fmt(r.state.Q / 1000, 0)} kJ`;
        const lText = `${fmt(r.state.loss / 1000, 0)} kJ`;
        const fits = (w: number, s: string) => w > s.length * 0.6 * 17 * 0.8 * f + 12;
        const textY = barY + bar / 2 + 5 * f;
        const eText = `E = ${fmt(r.state.E / 1000, 0)} kJ`;
        return (
          <g key={r.run.heater.id}>
            {stacked ? (
              <>
                <Txt x={x0 + 2} y={barY - 9 * f} anchor="start" size={0.9} weight={740} color={r.color}>
                  {r.short}
                </Txt>
                <Txt x={W - 16} y={barY - 9 * f} anchor="end" size={0.9} weight={720}>
                  {eText}
                </Txt>
              </>
            ) : (
              <>
                <Txt x={18} y={barY + bar / 2 - 3} anchor="start" size={0.9} weight={740} color={r.color} halo={false}>
                  {r.name}
                </Txt>
                <Txt x={18} y={barY + bar / 2 + 17} anchor="start" size={0.78} muted halo={false}>
                  η = {fmt(r.run.heater.eta * 100, 0)} %
                </Txt>
                <Txt x={x1 + 12} y={textY} anchor="start" size={0.9} weight={720} halo={false}>
                  {eText}
                </Txt>
              </>
            )}
            {/* Hele energien ved oppkoking (stiplet ramme) */}
            <rect x={x0} y={barY} width={Math.max(0, wAll)} height={bar} rx={4} fill={VIZ.grid} opacity={0.35} />
            <rect
              x={x0}
              y={barY}
              width={Math.max(0, wAll)}
              height={bar}
              rx={4}
              fill="none"
              stroke={VIZ.muted}
              strokeWidth={1.2 * ss}
              strokeDasharray={`${4 * ss} ${3 * ss}`}
            />
            {wQ > 0 && <rect x={x0} y={barY} width={wQ} height={bar} rx={3} fill={WATER_COLOR} />}
            {wL > 0.5 && <rect x={x0 + wQ} y={barY} width={wL} height={bar} rx={3} fill={LOSS_COLOR} />}
            {fits(wQ, qText) && (
              <Txt x={x0 + 8} y={textY} anchor="start" size={0.8} weight={720} color={VIZ.surface} halo={false}>
                {qText}
              </Txt>
            )}
            {fits(wL, lText) && (
              <Txt x={x0 + wQ + wL - 8} y={textY} anchor="end" size={0.8} weight={720} color={VIZ.surface} halo={false}>
                {lText}
              </Txt>
            )}
          </g>
        );
      })}
      <line x1={x0} x2={x0} y1={top} y2={yAxis} stroke={VIZ.muted} strokeWidth={1.2 * ss} />
    </g>
  );
}
