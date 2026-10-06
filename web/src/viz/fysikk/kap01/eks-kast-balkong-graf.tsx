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
import { placePassLabel } from './eks-kast-balkong-etiketter';
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
  padBelow,
}: {
  task: BalconyThrowTask;
  sol: BalconyThrowSolution;
  view: ThrowView;
  width: number;
  height: number;
  margin: { top: number; right: number; bottom: number; left: number };
  tStep: number;
  /** Plassen under plenen (m) til tekstene om løsningene; se graphAxes. */
  padBelow?: number;
}) {
  const f = useTextScale();
  const ss = useStrokeScale();
  const ax = graphAxes(sol, task.h0, tStep, padBelow);
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
        // Teksten under den negative løsningen: sentrert under punktet, men skjøvet mot venstre så den slutter før
        // t-aksen (t = 0). Under plenen er det ingen akseverdier, så teksten kan gå litt inn i margen.
        const negText = `t = ${fmtSig(sol.tNeg)} s`;
        const negW = 1.1 * Math.max(textWidth(negText, 0.8, f), textWidth('før kastet', 0.72, f));
        const negX = Math.max(negW / 2 + 4, Math.min(sx(sol.tNeg), sx(0) - 8 * f - negW / 2));
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

/** Utsnittet i steg 9 viser de siste ZOOM_S sekundene før landingen. */
export const ZOOM_S = 0.25;

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
      {({ sx, sy, x0, x1, y1 }) => {
        const v0 = fmtSig(task.v0);
        const pass = placePassLabel({
          px: sx(tPass),
          py: sy(-task.v0),
          x0,
          x1,
          f,
          text: `forbi hånda: −${v0} m/s`,
          head: 'forbi hånda:',
          tail: `−${v0} m/s`,
          size: 0.78,
        });
        return (
          <g>
            {/* Uten luftmotstand: rett linje med stigningstall −g */}
            <line
              x1={sx(0)}
              y1={sy(task.v0)}
              x2={sx(sol.tLand)}
              y2={sy(sol.vLand)}
              stroke={VIZ.velocity}
              strokeWidth={(drag ? 4.5 : 3.5) * ss}
              strokeLinecap="round"
              opacity={drag ? 0.4 : 1}
            />
            <ColorDot x={sx(0)} y={sy(task.v0)} color={VIZ.velocity} r={5.5} />
            <Txt x={sx(0) + 10 * f} y={sy(task.v0) - 8 * f} anchor="start" size={0.8} weight={700} color={VIZ.velocity}>
              v<TSub>0</TSub> = {v0} m/s
            </Txt>

            {/* Toppunktet: v = 0 */}
            <circle cx={sx(sol.tTop)} cy={sy(0)} r={5} fill={VIZ.surface} stroke={VIZ.velocity} strokeWidth={2.2} />

            {/* Forbi hånda på vei ned: v = −v₀. Etiketten står der v-t-linja går utenom (se placePassLabel). */}
            {view === 'kontroll' && (
              <g>
                <line x1={sx(0)} x2={sx(tPass)} y1={sy(-task.v0)} y2={sy(-task.v0)} className="viz-guide" />
                <ColorDot x={sx(tPass)} y={sy(-task.v0)} color={VIZ.velocity} r={5.5} />
                {pass.lines.map((line, i) => (
                  <Txt key={i} x={pass.x} y={pass.ys[i]!} anchor={pass.anchor} size={0.78} weight={700} color={VIZ.velocity}>
                    {line}
                  </Txt>
                ))}
              </g>
            )}

            {/* Farten ved plenen (før simuleringen, så kurven med luftmotstand ligger øverst) */}
            <circle cx={sx(sol.tLand)} cy={sy(sol.vLand)} r={drag ? 5 : 7} fill={VIZ.velocity} stroke={VIZ.surface} strokeWidth={2.5} />
            <Txt x={Math.min(x1 - 4, sx(sol.tLand) + 4 * f)} y={sy(sol.vLand) + 24 * f} anchor="end" size={0.8} weight={750} color={VIZ.velocity}>
              {drag ? 'uten: ' : 'v = '}
              {fmtSig(sol.vLand)} m/s
            </Txt>

            {/* Med luftmotstand (simulering): stiplet fartskurve, og et forstørret utsnitt av slutten */}
            {drag && (
              <g>
                <path
                  d={linePath(dragPts, sx, sy)}
                  fill="none"
                  stroke={VIZ.velocity}
                  strokeWidth={2.6 * ss}
                  strokeDasharray={`${7 * ss} ${5 * ss}`}
                  strokeLinecap="round"
                />
                <DragZoom task={task} sol={sol} dragPts={dragPts} sx={sx} sy={sy} x0={x0} x1={x1} y1={y1} />
              </g>
            )}

            {/* Stigningstallet */}
            {view === 'fart' && <SlopeTriangle sx={sx} sy={sy} t1={0.25 * sol.tLand} v={(t) => velocityAt(task, t)} f={f} />}
          </g>
        );
      }}
    </Plot>
  );
}

/**
 * Forstørret utsnitt av de siste ZOOM_S sekundene i v-t-grafen: kurvene med og uten luftmotstand ligger nesten oppå
 * hverandre i hele grafen, men her ser eleven at de skilles, og hvor mye (Δv ved landingen). Utsnittet står i det tomme
 * hjørnet oppe til høyre (over linja), og en stiplet ramme i grafen viser hvor det er hentet fra.
 */
function DragZoom({
  task,
  sol,
  dragPts,
  sx,
  sy,
  x0,
  x1,
  y1,
}: {
  task: BalconyThrowTask;
  sol: BalconyThrowSolution;
  dragPts: [number, number][];
  sx: (t: number) => number;
  sy: (v: number) => number;
  x0: number;
  x1: number;
  /** Toppen av grafområdet. */
  y1: number;
}) {
  const f = useTextScale();
  const ss = useStrokeScale();
  const tB = Math.max(sol.tLand, sol.drag.tLand);
  const tA = tB - ZOOM_S;
  const vFree = (t: number) => velocityAt(task, Math.min(t, sol.tLand));
  const dragAt = (t: number) => {
    const p = sol.drag.points;
    let i = p.findIndex((q) => q.t >= t);
    if (i <= 0) i = 1;
    const a = p[i - 1]!;
    const b = p[Math.min(i, p.length - 1)]!;
    return b.t > a.t ? a.v + ((t - a.t) / (b.t - a.t)) * (b.v - a.v) : a.v;
  };
  const vHi = Math.max(vFree(tA), dragAt(tA));
  const vLo = Math.min(sol.vLand, sol.drag.vLand);
  const pad = 0.12 * (vHi - vLo);
  // Rammen i grafen rundt det som forstørres
  const r = { x: sx(tA) - 3, y: sy(vHi + pad), w: sx(tB) - sx(tA) + 6, h: sy(vLo - pad) - sy(vHi + pad) };

  // Utsnittet: øverste høyre hjørne av grafen, med nedre venstre hjørne over linja (linja går skrått ned mot høyre, så
  // resten av utsnittet er også over den).
  const bx0 = x0 + 0.42 * (x1 - x0);
  const bx1 = x1 - 4;
  const tAt = (x: number) => (x - sx(0)) / (sx(1) - sx(0));
  const by1 = sy(velocityAt(task, tAt(bx0))) - 12 * f;
  const box = { x: bx0, y: y1 + 4, w: bx1 - bx0, h: by1 - (y1 + 4) };
  if (!(box.w > 120) || !(box.h > 80)) return null;

  // Inni utsnittet: tittel, kurvene og Δv-klammen med «med» og «uten» til høyre
  const fs = 17 * 0.72 * f;
  const titleY = box.y + 6 + fs;
  const labW = 4 * fs * 0.62;
  const ix0 = box.x + 10;
  const ix1 = box.x + box.w - 18 - labW;
  const iy0 = titleY + 10 * f;
  const iy1 = box.y + box.h - 14 - fs;
  const zx = (t: number) => ix0 + ((t - tA) / (tB - tA)) * (ix1 - ix0);
  const zy = (v: number) => iy1 - ((v - (vLo - pad * 0.3)) / (vHi + pad * 0.3 - (vLo - pad * 0.3))) * (iy1 - iy0);
  const zDrag = dragPts.filter(([t]) => t >= tA - 0.02);
  const free: [number, number][] = [
    [tA, vFree(tA)],
    [sol.tLand, sol.vLand],
  ];
  const yMed = zy(sol.drag.vLand);
  const yUten = zy(sol.vLand);
  // «med» og «uten» ved hver sin ende av klammen, men aldri nærmere hverandre enn én linje
  const sep = fs * 1.1;
  const midY = (yMed + yUten) / 2 + fs * 0.35;
  const yMedText = Math.min(yMed + fs * 0.35, midY - sep / 2);
  const yUtenText = Math.max(yUten + fs * 0.35, midY + sep / 2);
  const bx = zx(tB) + 7;
  const dv = Math.abs(sol.vLand - sol.drag.vLand);
  return (
    <g>
      {/* Hvor utsnittet er hentet fra */}
      <rect x={r.x} y={r.y} width={r.w} height={r.h} rx={3} fill="none" stroke={VIZ.muted} strokeWidth={1.2 * ss} strokeDasharray={`${4 * ss} ${3 * ss}`} />
      <line x1={r.x + r.w / 2} x2={r.x + r.w / 2} y1={r.y} y2={box.y + box.h} stroke={VIZ.muted} strokeWidth={1 * ss} strokeDasharray={`${4 * ss} ${3 * ss}`} />
      <rect x={box.x} y={box.y} width={box.w} height={box.h} rx={6} fill={VIZ.surface} stroke={VIZ.muted} strokeWidth={1.2 * ss} />
      <Txt x={box.x + 8} y={titleY} anchor="start" size={0.72} weight={650} muted>
        Forstørret utsnitt
      </Txt>
      {/* Uten luftmotstand: rett linje; med: stiplet */}
      <path d={linePath(free, zx, zy)} fill="none" stroke={VIZ.velocity} strokeWidth={3 * ss} strokeLinecap="round" opacity={0.55} />
      <path d={linePath(zDrag, zx, zy)} fill="none" stroke={VIZ.velocity} strokeWidth={2.4 * ss} strokeDasharray={`${6 * ss} ${4 * ss}`} />
      <circle cx={zx(sol.tLand)} cy={yUten} r={3.5} fill={VIZ.velocity} stroke={VIZ.surface} strokeWidth={1.5} />
      <circle cx={zx(sol.drag.tLand)} cy={yMed} r={3.5} fill={VIZ.velocity} stroke={VIZ.surface} strokeWidth={1.5} />
      {/* Klammen mellom endepunktene */}
      <g stroke={VIZ.ink} strokeWidth={1.2 * ss}>
        <line x1={bx} x2={bx} y1={yMed} y2={yUten} />
        <line x1={bx - 3} x2={bx + 3} y1={yMed} y2={yMed} />
        <line x1={bx - 3} x2={bx + 3} y1={yUten} y2={yUten} />
      </g>
      <Txt x={bx + 6} y={yMedText} anchor="start" size={0.72} weight={700} color={VIZ.velocity}>
        med
      </Txt>
      <Txt x={bx + 6} y={yUtenText} anchor="start" size={0.72} weight={700} color={VIZ.velocity}>
        uten
      </Txt>
      <Txt x={box.x + box.w - 8} y={box.y + box.h - 8} anchor="end" size={0.72} weight={700}>
        Δv = {fmt(dv, 2)} m/s
      </Txt>
    </g>
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
  // Ballen er liten nok til at L-pila (bare 13–17 % av G) stikker godt ut av den, selv om begge starter i midten.
  const rBall = 13 * k;
  const titleY = y + 26 * f;
  const cx = x + Math.min(w * 0.4, 150 * f);
  const LG = Math.max(60, Math.min(250, y + h - 84 * f - (titleY + 74 * f)));
  const scale = LG / sol.weight;
  const LL = sol.dragMax * scale;
  // Plass over ballen til L-pila og etiketten dens
  const cy = titleY + 34 * f + Math.max(LL, rBall) + 14 * f;
  const vx = cx - rBall - 34 * k;
  const vLen = Math.min(LG * 0.55, 5 * sol.speedLand * k);
  return (
    <g>
      <Txt x={x + 8} y={titleY} anchor="start" weight={700} size={0.95}>
        Kreftene like før ballen lander
      </Txt>
      <Ball x={cx} y={cy} r={rBall} type="golf" spinn={30} title="Golfballen, forstørret" />
      {/* Begge kreftene tegnes fra midten av ballen, i samme skala (px per N) */}
      <ForceArrow x1={cx} y1={cy} x2={cx} y2={cy + LG} color={VIZ.gravity} origin label={<>G = mg = {fmtSig(sol.weight)} N</>} labelSize={0.85} />
      <ForceArrow
        x1={cx}
        y1={cy}
        x2={cx}
        y2={cy - LL}
        color={VIZ.friction}
        width={6}
        minLength={2}
        origin
        label={<>L = kv² = {fmtSig(sol.dragMax)} N</>}
        labelSize={0.85}
        labelY={cy - LL + 4 * f}
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
