/**
 * Grafene i eksempeloppgaven «Golfball kastet rett opp fra en balkong» (k1-eks-kast-balkong):
 * - s-t-grafen (a, b): parabelen s = v₀t − ½gt², toppunktet, plenen s = −h₀ og begge løsningene av
 *   andregradslikningen (den negative stiplet, før kastet).
 * - v-t-grafen (c, d): rett linje med stigningstall −g, farten ved plenen og simuleringen med luftmotstand.
 * - Kraftdiagrammet (d): tyngden og luftmotstanden på ballen like før den lander, i samme skala.
 */
import { Plot, TSub, Txt, VIZ, fmt, linePath, sample, useTextScale } from '../../kit';
import { Ball, ForceArrow, useSceneScale, useStrokeScale } from '../../kit/scene';
import type { ThrowView } from './eks-kast-balkong-scene';
import { ColorDot } from './marks';
import {
  G,
  fmtPercent,
  fmtSig,
  graphAxes,
  positionAt,
  velocityAt,
  type BalconyThrowSolution,
  type BalconyThrowTask,
} from './model-eks-kast-balkong';

export type GraphKind = 'st' | 'vt' | 'krefter';

/** Hvilken graf som vises i hvert steg. */
export function graphKind(view: ThrowView): GraphKind {
  if (view === 'fart' || view === 'kontroll' || view === 'simulering') return 'vt';
  if (view === 'krefter') return 'krefter';
  return 'st';
}

/** Omtrentlig bredde av en tekst i figuren (17 · size · f per tegn ganger 0,6). */
function textWidth(text: string, size: number, f: number): number {
  return text.length * 17 * size * f * 0.6;
}

/** Desimaler på tidsaksen: 1 når det er halve sekunder. */
const tDecimals = (ticks: number[]) => (ticks.every(Number.isInteger) ? 0 : 1);

/* ---------- s-t-grafen ---------- */

export function PositionGraph({
  task,
  sol,
  view,
  width,
  height,
  margin,
  tStep,
}: {
  task: BalconyThrowTask;
  sol: BalconyThrowSolution;
  view: ThrowView;
  width: number;
  height: number;
  margin: { top: number; right: number; bottom: number; left: number };
  tStep: number;
}) {
  const f = useTextScale();
  const ss = useStrokeScale();
  const ax = graphAxes(sol, task.h0, tStep);
  const all = view === 'alle';
  const upTo = view === 'topp' || view === 'hoyde' ? sol.tTop : view === 'oppgave' || view === 'retning' ? 0 : sol.tLand;
  const showTop = upTo >= sol.tTop - 1e-9;
  const showLand = upTo >= sol.tLand - 1e-9;
  const showNeg = view === 'losninger' || all;
  const strongGround = view === 'likning' || view === 'losninger';

  return (
    <Plot
      x={{ min: ax.tMin, max: ax.tMax, label: 'Tid t (s)', ticks: ax.tTicks, decimals: tDecimals(ax.tTicks) }}
      y={{ min: ax.sMin, max: ax.sMax, label: 'Posisjon s (m)', ticks: ax.sTicks }}
      width={width}
      height={height}
      margin={margin}
    >
      {({ sx, sy, x0, x1 }) => {
        const gy = sy(-task.h0);
        // Teksten under den negative løsningen: sentrert under punktet, men innenfor grafen.
        const negText = `t = ${fmtSig(sol.tNeg)} s`;
        const negX = Math.max(sx(sol.tNeg), x0 + textWidth(negText, 0.8, f) / 2 + 3);
        return (
          <g>
            {/* Plenen: s = −h₀ */}
            <line x1={x0} x2={x1} y1={gy} y2={gy} stroke={VIZ.series[2]} strokeWidth={(strongGround ? 2.6 : 1.8) * ss} opacity={strongGround ? 1 : 0.75} />
            <Txt x={sx(0) + 8 * f} y={gy - 8 * f} anchor="start" size={0.78} weight={700} color={VIZ.series[2]}>
              plenen
            </Txt>

            {/* Parabelen før kastet (den negative løsningen) */}
            {showNeg && (
              <path
                d={linePath(sample((t) => positionAt(task, t), sol.tNeg, 0, 80), sx, sy)}
                fill="none"
                stroke={VIZ.muted}
                strokeWidth={2.2 * ss}
                strokeDasharray={`${6 * ss} ${5 * ss}`}
              />
            )}
            {/* Bevegelsen */}
            {upTo > 0 && (
              <path d={linePath(sample((t) => positionAt(task, t), 0, upTo, 160), sx, sy)} fill="none" stroke={VIZ.series[0]} strokeWidth={3.5 * ss} strokeLinecap="round" />
            )}

            {/* Toppunktet med vannrett tangent */}
            {showTop && (
              <g>
                <line x1={sx(sol.tTop - 0.32)} x2={sx(sol.tTop + 0.32)} y1={sy(sol.sTop)} y2={sy(sol.sTop)} stroke={VIZ.velocity} strokeWidth={2.2 * ss} strokeDasharray={`${6 * ss} ${4 * ss}`} />
                <ColorDot x={sx(sol.tTop)} y={sy(sol.sTop)} color={VIZ.series[0]} r={6} />
                <Txt x={sx(sol.tTop)} y={sy(sol.sTop) - 14 * f} size={0.8} weight={700} color={VIZ.series[0]}>
                  toppunkt, s = {fmtSig(sol.sTop)} m
                </Txt>
              </g>
            )}

            {/* Startpunktet */}
            <ColorDot x={sx(0)} y={sy(0)} color={VIZ.series[0]} r={5.5} />

            {/* Landingen: den positive løsningen */}
            {showLand && (
              <g>
                <line x1={sx(sol.tLand)} x2={sx(sol.tLand)} y1={gy} y2={sy(ax.sMin)} stroke={VIZ.ink} strokeWidth={1.2 * ss} strokeDasharray="3 3" opacity={0.6} />
                <circle cx={sx(sol.tLand)} cy={gy} r={7} fill={VIZ.series[0]} stroke={VIZ.surface} strokeWidth={2.5} />
                <Txt x={sx(sol.tLand) - 10 * f} y={gy + 20 * f} anchor="end" size={0.8} weight={750} color={VIZ.ink}>
                  {view === 'likning' ? 't = ?' : `t = ${fmtSig(sol.tLand)} s`}
                </Txt>
              </g>
            )}

            {/* Den negative løsningen: før kastet, forkastes */}
            {showNeg && (
              <g>
                <circle cx={sx(sol.tNeg)} cy={gy} r={7} fill={VIZ.surface} stroke={VIZ.muted} strokeWidth={2.2 * ss} />
                <path
                  d={`M${sx(sol.tNeg) - 5},${gy - 5}L${sx(sol.tNeg) + 5},${gy + 5}M${sx(sol.tNeg) - 5},${gy + 5}L${sx(sol.tNeg) + 5},${gy - 5}`}
                  stroke={VIZ.muted}
                  strokeWidth={1.8 * ss}
                />
                <Txt x={negX} y={gy + 20 * f} size={0.8} weight={700} muted>
                  {negText}
                </Txt>
                <Txt x={negX} y={gy + 37 * f} size={0.72} weight={600} muted>
                  før kastet
                </Txt>
              </g>
            )}
          </g>
        );
      }}
    </Plot>
  );
}

/* ---------- v-t-grafen ---------- */

export function VelocityGraph({
  task,
  sol,
  view,
  width,
  height,
  margin,
  tStep,
}: {
  task: BalconyThrowTask;
  sol: BalconyThrowSolution;
  view: ThrowView;
  width: number;
  height: number;
  margin: { top: number; right: number; bottom: number; left: number };
  tStep: number;
}) {
  const f = useTextScale();
  const ss = useStrokeScale();
  const ax = graphAxes(sol, task.h0, tStep);
  const tTicks = ax.tTicks.filter((t) => t >= 0);
  const vMin = -Math.ceil((sol.speedLand + 1.5) / 5) * 5;
  const vMax = Math.ceil((task.v0 + 2.5) / 5) * 5;
  const vTicks: number[] = [];
  for (let v = vMin; v <= vMax + 1e-9; v += 5) vTicks.push(v);
  const tPass = (2 * task.v0) / G;
  const drag = view === 'simulering';
  const dragPts: [number, number][] = sol.drag.points.filter((_, i) => i % 10 === 0).map((q) => [q.t, q.v]);
  const last = sol.drag.points.at(-1);
  if (last) dragPts.push([last.t, last.v]);

  return (
    <Plot
      x={{ min: 0, max: ax.tMax, label: 'Tid t (s)', ticks: tTicks, decimals: tDecimals(tTicks) }}
      y={{ min: vMin, max: vMax, label: 'Fart v (m/s)', ticks: vTicks }}
      width={width}
      height={height}
      margin={margin}
    >
      {({ sx, sy, x1 }) => (
        <g>
          {/* Uten luftmotstand: rett linje med stigningstall −g */}
          <line
            x1={sx(0)}
            y1={sy(task.v0)}
            x2={sx(sol.tLand)}
            y2={sy(sol.vLand)}
            stroke={VIZ.velocity}
            strokeWidth={(drag ? 5 : 3.5) * ss}
            strokeLinecap="round"
            opacity={drag ? 0.45 : 1}
          />
          <ColorDot x={sx(0)} y={sy(task.v0)} color={VIZ.velocity} r={5.5} />
          <Txt x={sx(0) + 10 * f} y={sy(task.v0) - 8 * f} anchor="start" size={0.8} weight={700} color={VIZ.velocity}>
            v<TSub>0</TSub> = {fmt(task.v0, 1)} m/s
          </Txt>

          {/* Toppunktet: v = 0 */}
          <circle cx={sx(sol.tTop)} cy={sy(0)} r={5} fill={VIZ.surface} stroke={VIZ.velocity} strokeWidth={2.2} />

          {/* Forbi hånda på vei ned: v = −v₀ */}
          {view === 'kontroll' && (
            <g>
              <line x1={sx(0)} x2={sx(tPass)} y1={sy(-task.v0)} y2={sy(-task.v0)} className="viz-guide" />
              <ColorDot x={sx(tPass)} y={sy(-task.v0)} color={VIZ.velocity} r={5.5} />
              <Txt x={sx(tPass) - 10 * f} y={sy(-task.v0) - 10 * f} anchor="end" size={0.78} weight={700} color={VIZ.velocity}>
                forbi hånda: −{fmt(task.v0, 1)} m/s
              </Txt>
            </g>
          )}

          {/* Med luftmotstand (simulering) */}
          {drag && (
            <g>
              <path d={linePath(dragPts, sx, sy)} fill="none" stroke={VIZ.friction} strokeWidth={2.4 * ss} strokeLinecap="round" />
              {['Kurvene skilles først', 'mot slutten, der farten', 'og L er størst.'].map((line, i) => (
                <Txt key={i} x={x1 - 6} y={sy(0) - (52 - 18 * i) * f} anchor="end" size={0.75} weight={600} muted>
                  {line}
                </Txt>
              ))}
              <circle cx={sx(sol.drag.tLand)} cy={sy(sol.drag.vLand)} r={6} fill={VIZ.friction} stroke={VIZ.surface} strokeWidth={2.5} />
              <Txt x={sx(sol.drag.tLand) - 12 * f} y={sy(sol.drag.vLand) - 16 * f} anchor="end" size={0.78} weight={700} color={VIZ.friction}>
                med luftmotstand: −{fmtSig(sol.dragSpeed)} m/s
              </Txt>
            </g>
          )}

          {/* Farten ved plenen */}
          <circle cx={sx(sol.tLand)} cy={sy(sol.vLand)} r={7} fill={VIZ.velocity} stroke={VIZ.surface} strokeWidth={2.5} />
          <Txt x={Math.min(x1 - 4, sx(sol.tLand) + 4 * f)} y={sy(sol.vLand) + 24 * f} anchor="end" size={0.8} weight={750} color={VIZ.velocity}>
            {drag ? 'uten: ' : 'v = '}
            {fmt(sol.vLand, 1)} m/s
          </Txt>

          {/* Stigningstallet */}
          {view === 'fart' && <SlopeTriangle sx={sx} sy={sy} t1={0.25 * sol.tLand} v={(t) => velocityAt(task, t)} f={f} />}
        </g>
      )}
    </Plot>
  );
}

/** Stigningstrekant over 1 s: −9,81 m/s per sekund. */
function SlopeTriangle({ sx, sy, t1, v, f }: { sx: (t: number) => number; sy: (v: number) => number; t1: number; v: (t: number) => number; f: number }) {
  const a = v(t1);
  const b = v(t1 + 1);
  return (
    <g>
      <polyline points={`${sx(t1)},${sy(a)} ${sx(t1 + 1)},${sy(a)} ${sx(t1 + 1)},${sy(b)}`} fill="none" stroke={VIZ.acceleration} strokeWidth={2} strokeLinejoin="round" />
      <Txt x={sx(t1 + 0.5)} y={sy(a) - 8 * f} size={0.8} weight={700} color={VIZ.acceleration}>
        1 s
      </Txt>
      <Txt x={sx(t1 + 1) + 8 * f} y={sy((a + b) / 2) + 6 * f} anchor="start" size={0.8} weight={700} color={VIZ.acceleration}>
        −9,81 m/s
      </Txt>
    </g>
  );
}

/* ---------- Kraftdiagrammet ---------- */

/**
 * Kreftene på ballen like før den lander: tyngden G og luftmotstanden L = kv² i samme skala, og fartspila. Ballen
 * er tegnet mye større enn i scenen. (x, y, w, h) er rammen.
 */
export function ForceDiagram({ sol, x, y, w, h }: { sol: BalconyThrowSolution; x: number; y: number; w: number; h: number }) {
  const f = useTextScale();
  const k = useSceneScale();
  const rBall = 24 * k;
  const titleY = y + 26 * f;
  const cx = x + Math.min(w * 0.4, 150 * f);
  const cy = titleY + 74 * f + rBall;
  const LG = Math.max(60, Math.min(240, y + h - 84 * f - cy));
  const scale = LG / sol.weight;
  const LL = sol.dragMax * scale;
  const vx = cx - rBall - 28 * k;
  const vLen = Math.min(LG * 0.55, 5 * sol.speedLand * k);
  return (
    <g>
      <Txt x={x + 8} y={titleY} anchor="start" weight={700} size={0.95}>
        Kreftene like før ballen lander
      </Txt>
      <Ball x={cx} y={cy} r={rBall} type="golf" spinn={30} title="Golfballen, forstørret" />
      <ForceArrow x1={cx} y1={cy} x2={cx} y2={cy + LG} color={VIZ.gravity} origin label={<>G = mg = {fmt(sol.weight, 3)} N</>} labelSize={0.85} />
      <ForceArrow
        x1={cx}
        y1={cy - rBall}
        x2={cx}
        y2={cy - rBall - LL}
        color={VIZ.friction}
        width={6}
        minLength={2}
        label={<>L = kv² = {fmt(sol.dragMax, 3)} N</>}
        labelSize={0.85}
        labelY={cy - rBall - LL + 4 * f}
      />
      <ForceArrow x1={vx} y1={cy - vLen / 2} x2={vx} y2={cy + vLen / 2} color={VIZ.velocity} width={5} label="v" labelSize={0.85} />
      <Txt x={x + 8} y={cy + LG + 38 * f} anchor="start" size={0.9} weight={750} color={VIZ.friction}>
        L er {fmtPercent(sol.dragRatio)} av G
      </Txt>
      <Txt x={x + 8} y={cy + LG + 60 * f} anchor="start" size={0.75} weight={600} muted>
        I toppunktet er v = 0, og da er L = 0.
      </Txt>
    </g>
  );
}
