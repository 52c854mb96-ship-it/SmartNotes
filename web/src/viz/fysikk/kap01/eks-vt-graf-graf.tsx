/**
 * Grafene i eksempeloppgaven «Bil i bytrafikk» (k1-eks-vt-graf): v-t-grafen som oppgaven gir, og s-t-grafen som
 * eleven skal skissere i e). De har samme tidsakse og står under hverandre. Det som tegnes oppå (delene, stigningstrekanter,
 * arealer, gjennomsnittsfarten og s-t-kurven) styres av `view`, som følger stegene i løsningen.
 */
import type { ReactNode } from 'react';
import { Figure, Plot, TSub, Txt, VIZ, fmt, useTextScale } from '../../kit';
import { alpha, useStrokeScale, useSvgId } from '../../kit/scene';
import { ColorDot } from './marks';
import { fmtSig, phaseOf, positionAt, tripAxes, velocityAt, type CityTripSolution, type CityTripTask, type PhaseNo, type TripAxes } from './model-eks-vt-graf';

/** Det figurene viser i hvert steg. */
export type TripView =
  | 'oppgave'
  | 'les'
  | 'a1'
  | 'a23'
  | 'areal'
  | 'deler'
  | 'snitt'
  | 'hvorfor'
  | 'st1'
  | 'st2'
  | 'alle';

/** Fargen til hver del av turen, lik i v-t-grafen, s-t-grafen og strekningen øverst i scenen. */
export const PHASE_COLOR: Record<PhaseNo, string> = {
  1: VIZ.series[1]!,
  2: VIZ.series[2]!,
  3: VIZ.series[3]!,
};

/** Farge til gjennomsnittsfarten (stiplet linje). */
const AVG = VIZ.ink;

const PHASES: PhaseNo[] = [1, 2, 3];

/** Omtrentlig bredde av en tekst i figurens enheter (Txt med relativ størrelse `size`). */
const textW = (text: string, f: number, size = 0.9) => text.length * 17 * size * f * 0.58;

export function TripGraphs({ task, sol, view, narrow }: { task: CityTripTask; sol: CityTripSolution; view: TripView; narrow: boolean }) {
  const ax = tripAxes(task, sol.s);
  const Hv = narrow ? 520 : 300;
  const Hs = narrow ? 440 : 260;
  const stOn = view === 'st1' || view === 'st2' || view === 'alle';
  return (
    <Figure
      viewBox={`0 0 800 ${Hv + Hs}`}
      label={`v-t-graf for bilen: farten øker jevnt fra 0 til ${fmt(task.vMax, 0)} m/s på ${fmt(task.t1, 0)} s, er konstant til t = ${fmt(task.t2, 0)} s og avtar jevnt til 0 ved t = ${fmt(task.t3, 0)} s.${stOn ? ` Under den står s-t-grafen, som ender på ${fmt(sol.s, 0)} m.` : ''}`}
      maxHeight={narrow ? 900 : 620}
    >
      <VtPanel task={task} sol={sol} ax={ax} view={view} height={Hv} />
      <g transform={`translate(0 ${Hv})`}>
        <StPanel task={task} sol={sol} ax={ax} view={view} height={Hs} />
      </g>
    </Figure>
  );
}

interface PanelProps {
  task: CityTripTask;
  sol: CityTripSolution;
  ax: TripAxes;
  view: TripView;
  height: number;
}

/** Marger som gir plass til stripen med delene over grafen. */
function margins(f: number) {
  return { top: 40 * f, right: 26 * f, bottom: 54 * f, left: 70 * f };
}

/* ---------- v-t-grafen ---------- */

function VtPanel({ task, sol, ax, view, height }: PanelProps) {
  const f = useTextScale();
  const ss = useStrokeScale();
  const clip = useSvgId('vt-klipp');
  const hatch = useSvgId('vt-skravur');
  const { vMax, t1, t2, t3 } = task;
  const showAreas = view === 'areal' || view === 'deler' || view === 'snitt' || view === 'hvorfor' || view === 'alle';
  const splitAreas = view === 'deler' || view === 'alle';
  const showAvg = view === 'snitt' || view === 'hvorfor' || view === 'alle';
  // Gjennomsnittsfarten med to gjeldende siffer, som i svaret («≈» når tallet er avrundet).
  const avgLabel = `${Math.abs(Number(sol.vAvg.toPrecision(2)) - sol.vAvg) > 1e-9 ? '≈' : '='} ${fmtSig(sol.vAvg)}`;

  return (
    <Plot
      x={{ min: 0, max: ax.tMax, label: 'Tid t (s)', ticks: ax.tTicks }}
      y={{ min: 0, max: ax.vTop, label: 'Fart v (m/s)', ticks: ax.vTicks }}
      width={800}
      height={height}
      margin={margins(f)}
    >
      {({ sx, sy, x0, x1, y0, y1 }) => {
        const pts: [number, number][] = [
          [0, 0],
          [t1, vMax],
          [t2, vMax],
          [t3, 0],
        ];
        const d = pts.map(([t, v], i) => `${i ? 'L' : 'M'}${sx(t).toFixed(1)},${sy(v).toFixed(1)}`).join('');
        const areaPath = (n: PhaseNo) => {
          const p = phaseOf(sol, n);
          return `M${sx(p.from)},${sy(0)}L${sx(p.from)},${sy(p.v0)}L${sx(p.to)},${sy(p.v1)}L${sx(p.to)},${sy(0)}Z`;
        };

        return (
          <g>
            <defs>
              <clipPath id={clip}>
                <rect x={x0} y={y1} width={x1 - x0} height={y0 - y1} />
              </clipPath>
              <pattern id={hatch} width={8 * ss} height={8 * ss} patternUnits="userSpaceOnUse" patternTransform="rotate(-45)">
                <line x1={0} y1={0} x2={0} y2={8 * ss} stroke={VIZ.muted} strokeWidth={1.6 * ss} opacity={0.55} />
              </pattern>
            </defs>

            <MinorGrid ax={ax} sx={sx} sy={sy} x0={x0} x1={x1} y0={y0} y1={y1} yMax={ax.vTop} yMinor={ax.vMinor} />
            <PhaseStrip task={task} sx={sx} y1={y1} />
            <PhaseLines task={task} sx={sx} y0={y0} y1={y1} />

            <g clipPath={`url(#${clip})`}>
              {/* Arealet under grafen: strekningen */}
              {showAreas &&
                (splitAreas ? (
                  PHASES.map((n) => <path key={n} d={areaPath(n)} fill={alpha(PHASE_COLOR[n], 0.26)} />)
                ) : (
                  <path d={`${d}Z`} fill={alpha(VIZ.velocity, view === 'areal' ? 0.12 : 0.14)} />
                ))}
              {view === 'areal' && <Bars task={task} sx={sx} sy={sy} />}

              {/* Det som mangler på rektangelet v_maks · t₃ */}
              {view === 'hvorfor' && (
                <>
                  <path d={`M${sx(0)},${sy(0)}L${sx(0)},${sy(vMax)}L${sx(t1)},${sy(vMax)}Z`} fill={`url(#${hatch})`} />
                  <path d={`M${sx(t2)},${sy(vMax)}L${sx(t3)},${sy(vMax)}L${sx(t3)},${sy(0)}Z`} fill={`url(#${hatch})`} />
                  <path
                    d={`M${sx(0)},${sy(vMax)}L${sx(t1)},${sy(vMax)}M${sx(t2)},${sy(vMax)}L${sx(t3)},${sy(vMax)}L${sx(t3)},${sy(0)}`}
                    fill="none"
                    stroke={VIZ.muted}
                    strokeWidth={1.8 * ss}
                    strokeDasharray={`${6 * ss} ${4 * ss}`}
                  />
                </>
              )}

              {/* Gjennomsnittsfarten: rektangelet med samme areal */}
              {showAvg && (
                <path
                  d={`M${sx(0)},${sy(sol.vAvg)}L${sx(t3)},${sy(sol.vAvg)}L${sx(t3)},${sy(0)}`}
                  fill="none"
                  stroke={AVG}
                  strokeWidth={2.2 * ss}
                  strokeDasharray={`${8 * ss} ${5 * ss}`}
                />
              )}

              {/* Avlesning av den høyeste farten */}
              {view === 'les' && (
                <line x1={sx(0)} x2={sx(t1)} y1={sy(vMax)} y2={sy(vMax)} stroke={VIZ.velocity} strokeWidth={1.8 * ss} strokeDasharray={`${5 * ss} ${4 * ss}`} />
              )}
            </g>

            {/* Stigningstrekantene */}
            {(view === 'a1' || view === 'a23') && <SlopeTriangle n={1} sol={sol} sx={sx} sy={sy} dim={view === 'a23'} />}
            {view === 'a23' && <SlopeTriangle n={3} sol={sol} sx={sx} sy={sy} />}

            {/* Grafen */}
            <path d={d} fill="none" stroke={VIZ.velocity} strokeWidth={3.6 * ss} strokeLinejoin="round" strokeLinecap="round" />
            {pts.map(([t, v], i) => (
              <ColorDot key={i} x={sx(t)} y={sy(v)} r={4.2 * ss} color={VIZ.velocity} />
            ))}

            {/* Etiketter */}
            {view === 'les' && (
              <Txt x={sx((t1 + t2) / 2)} y={sy(vMax) - 9 * ss} size={0.9} weight={700} color={VIZ.velocity}>
                v<TSub>maks</TSub> = {fmtSig(vMax)} m/s
              </Txt>
            )}
            {view === 'a1' && <SlopeLabels n={1} sol={sol} sx={sx} sy={sy} level={0.62} />}
            {view === 'a23' && (
              <>
                <SlopeLabels n={1} sol={sol} sx={sx} sy={sy} level={0.66} />
                <SlopeLabels n={3} sol={sol} sx={sx} sy={sy} level={0.3} />
                <Txt x={sx((t1 + t2) / 2)} y={sy(vMax) + 22 * f} size={0.9} weight={700} color={VIZ.acceleration}>
                  a<TSub>2</TSub> = 0
                </Txt>
              </>
            )}
            {view === 'areal' && (
              <Txt x={sx((t1 + t2) / 2)} y={sy(vMax * 0.45)} size={1} weight={700} color={VIZ.ink}>
                s = arealet under grafen
              </Txt>
            )}
            {splitAreas && <AreaLabels sol={sol} sx={sx} sy={sy} />}
            {showAvg && (
              <Txt x={sx((t1 + t2) / 2)} y={sy(sol.vAvg) + 22 * f} size={0.9} weight={700} color={AVG}>
                v<TSub>snitt</TSub> {avgLabel} m/s
              </Txt>
            )}
            {view === 'hvorfor' && (
              <Txt x={sx((t1 + t2) / 2)} y={sy(vMax) - 9 * ss} size={0.85} weight={650} muted>
                v<TSub>maks</TSub> hele tiden: {fmt(sol.sAllMax, 0)} m
              </Txt>
            )}
            {view === 'snitt' && (
              <Txt x={sx((t1 + t2) / 2)} y={sy(sol.vAvg * 0.42)} size={0.9} weight={650} color={VIZ.ink}>
                {fmt(sol.s, 0)} m på {fmt(t3, 0)} s
              </Txt>
            )}
          </g>
        );
      }}
    </Plot>
  );
}

/**
 * Smale stolper på ett sekund under grafen, med høyden lik farten midt i sekundet. Hver stolpe har arealet v · Δt,
 * altså strekningen bilen kjører det sekundet. Fordi grafen er rett i hvert sekund, er summen nøyaktig lik arealet.
 */
function Bars({ task, sx, sy }: { task: CityTripTask; sx: (v: number) => number; sy: (v: number) => number }) {
  const ss = useStrokeScale();
  const n = Math.ceil(task.t3 - 1e-9);
  return (
    <g>
      {Array.from({ length: n }, (_, i) => {
        const a = i;
        const b = Math.min(task.t3, i + 1);
        const v = velocityAt(task, (a + b) / 2);
        return (
          <rect
            key={i}
            x={sx(a)}
            y={sy(v)}
            width={Math.max(0, sx(b) - sx(a))}
            height={Math.max(0, sy(0) - sy(v))}
            fill={alpha(VIZ.velocity, 0.2)}
            stroke={alpha(VIZ.velocity, 0.85)}
            strokeWidth={1 * ss}
          />
        );
      })}
    </g>
  );
}

/** Tynne rutelinjer for hvert tMinor sekund og hver yMinor enhet, så hjørnene kan leses av. */
function MinorGrid({
  ax,
  sx,
  sy,
  x0,
  x1,
  y0,
  y1,
  yMax,
  yMinor,
}: {
  ax: TripAxes;
  sx: (v: number) => number;
  sy: (v: number) => number;
  x0: number;
  x1: number;
  y0: number;
  y1: number;
  yMax: number;
  yMinor: number;
}) {
  const ss = useStrokeScale();
  let d = '';
  for (let t = ax.tMinor; t < ax.tMax - 1e-9; t += ax.tMinor) {
    if (ax.tTicks.some((k) => Math.abs(k - t) < 1e-9)) continue;
    d += `M${sx(t).toFixed(1)},${y0}L${sx(t).toFixed(1)},${y1}`;
  }
  const ticksY = new Set<number>();
  for (let v = yMinor; v < yMax - 1e-9; v += yMinor) ticksY.add(Math.round(v * 1000) / 1000);
  for (const v of ticksY) d += `M${x0},${sy(v).toFixed(1)}L${x1},${sy(v).toFixed(1)}`;
  return <path d={d} stroke={VIZ.grid} strokeWidth={0.9 * ss} opacity={0.75} fill="none" />;
}

/** Stripen over grafen med de tre delene («Del 1», «Del 2», «Del 3»). */
function PhaseStrip({ task, sx, y1 }: { task: CityTripTask; sx: (v: number) => number; y1: number }) {
  const f = useTextScale();
  const ss = useStrokeScale();
  const h = 22 * f;
  const top = y1 - h - 8 * f;
  const cells: { n: PhaseNo; a: number; b: number }[] = [
    { n: 1, a: 0, b: task.t1 },
    { n: 2, a: task.t1, b: task.t2 },
    { n: 3, a: task.t2, b: task.t3 },
  ];
  return (
    <g>
      {cells.map(({ n, a, b }) => {
        const xa = sx(a) + 1.5;
        const xb = sx(b) - 1.5;
        const w = xb - xa;
        const text = w > textW('Del 3', f, 0.8) + 8 ? `Del ${n}` : String(n);
        return (
          <g key={n}>
            <rect x={xa} y={top} width={Math.max(0, w)} height={h} rx={5 * ss} fill={alpha(PHASE_COLOR[n], 0.16)} stroke={PHASE_COLOR[n]} strokeWidth={1.3 * ss} />
            <Txt x={(xa + xb) / 2} y={top + h * 0.72} size={0.8} weight={700} color={PHASE_COLOR[n]} halo={false}>
              {text}
            </Txt>
          </g>
        );
      })}
    </g>
  );
}

/** Stiplede skillelinjer mellom delene (ved t₁ og t₂). */
function PhaseLines({ task, sx, y0, y1 }: { task: CityTripTask; sx: (v: number) => number; y0: number; y1: number }) {
  const ss = useStrokeScale();
  return (
    <g stroke={VIZ.muted} strokeWidth={1.1 * ss} strokeDasharray={`${3 * ss} ${4 * ss}`} opacity={0.7}>
      {[task.t1, task.t2].map((t) => (
        <line key={t} x1={sx(t)} x2={sx(t)} y1={y0} y2={y1} />
      ))}
    </g>
  );
}

/** Stigningstrekanten i del 1 eller 3: den loddrette kateten er Δv, den vannrette Δt. */
function SlopeTriangle({ n, sol, sx, sy, dim }: { n: 1 | 3; sol: CityTripSolution; sx: (v: number) => number; sy: (v: number) => number; dim?: boolean }) {
  const f = useTextScale();
  const ss = useStrokeScale();
  const p = phaseOf(sol, n);
  // Den loddrette kateten står der farten er størst (slutten av del 1, starten av del 3).
  const xv = n === 1 ? sx(p.to) : sx(p.from);
  const vTop = n === 1 ? p.v1 : p.v0;
  const xa = sx(p.from);
  const xb = sx(p.to);
  const full = `Δt = ${fmtSig(p.dt)} s`;
  const leg = Math.abs(xb - xa);
  const dtText = leg > textW(full, f) + 16 * f ? full : 'Δt';
  return (
    <g opacity={dim ? 0.55 : 1}>
      <path d={`M${xa},${sy(0)}L${xb},${sy(0)}M${xv},${sy(0)}L${xv},${sy(vTop)}`} stroke={VIZ.acceleration} strokeWidth={3 * ss} strokeLinecap="round" fill="none" />
      <path d={`M${xa},${sy(p.v0)}L${xb},${sy(p.v1)}L${xb},${sy(0)}L${xa},${sy(0)}Z`} fill={alpha(VIZ.acceleration, 0.1)} />
      <Txt x={n === 1 ? xv - 7 * f : xv + 7 * f} y={sy(0) - 8 * f} anchor={n === 1 ? 'end' : 'start'} size={0.85} weight={700} color={VIZ.acceleration}>
        {dtText}
      </Txt>
    </g>
  );
}

/** Δv og akselerasjonen ved siden av den loddrette kateten, i høyden `level` (andel av v_maks). */
function SlopeLabels({ n, sol, sx, sy, level }: { n: 1 | 3; sol: CityTripSolution; sx: (v: number) => number; sy: (v: number) => number; level: number }) {
  const f = useTextScale();
  const p = phaseOf(sol, n);
  const xv = n === 1 ? sx(p.to) + 9 * f : sx(p.from) - 9 * f;
  const anchor = n === 1 ? 'start' : 'end';
  const vTop = Math.max(p.v0, p.v1);
  const y = sy(vTop * level);
  return (
    <g>
      <Txt x={xv} y={y} anchor={anchor} size={0.85} weight={700} color={VIZ.acceleration}>
        Δv = {fmtSig(p.dv)} m/s
      </Txt>
      <Txt x={xv} y={y + 22 * f} anchor={anchor} size={0.95} weight={750} color={VIZ.acceleration}>
        a<TSub>{n}</TSub> = {fmt(p.a, 1)} m/s²
      </Txt>
    </g>
  );
}

/** Strekningen i hver del, skrevet i arealet. Lange etiketter forkortes når trekanten er smal (mobil). */
function AreaLabels({ sol, sx, sy }: { sol: CityTripSolution; sx: (v: number) => number; sy: (v: number) => number }) {
  const f = useTextScale();
  const p2 = phaseOf(sol, 2);
  const v = p2.v0;
  const lineH = 17 * 0.9 * f * 1.12;
  const pad = 6 * f;
  const base = sy(0);
  const legH = base - sy(v);

  /**
   * Etiketten i trekanten står nederst, inntil den høye kateten. Vi prøver «s₁ = 36 m» på én linje, så «s₁» over
   * «36 m», og til slutt bare «s₁» (smale trekanter på mobil). Den velges hvis det øverste ytre hjørnet av teksten
   * ligger under grafen.
   */
  const tri = (n: 1 | 3): ReactNode => {
    const p = phaseOf(sol, n);
    const sub = n === 1 ? '1' : '3';
    const value = `${fmt(p.s, 0)} m`;
    const leg = n === 1 ? sx(p.to) : sx(p.from);
    const w = Math.abs(sx(p.to) - sx(p.from));
    const fits = (tw: number, lines: number) => {
      const dist = w - pad - tw; // fra den spisse enden til ytterkanten av teksten
      return dist > 0 && (dist / w) * legH > pad + lines * lineH + 4 * f;
    };
    const dir = n === 1 ? -1 : 1;
    const anchor = n === 1 ? 'end' : 'start';
    const x = leg + dir * pad;
    const y = base - pad - 0.28 * lineH;
    const color = PHASE_COLOR[n];
    if (fits(textW(`s${sub} = ${value}`, f), 1))
      return (
        <Txt key={n} x={x} y={y} anchor={anchor} size={0.9} weight={750} color={color}>
          s<TSub>{sub}</TSub> = {value}
        </Txt>
      );
    if (fits(textW(value, f), 2))
      return (
        <g key={n}>
          <Txt x={x} y={y - lineH} anchor={anchor} size={0.9} weight={750} color={color}>
            s<TSub>{sub}</TSub>
          </Txt>
          <Txt x={x} y={y} anchor={anchor} size={0.9} weight={750} color={color}>
            {value}
          </Txt>
        </g>
      );
    return (
      <Txt key={n} x={x} y={y} anchor={anchor} size={0.9} weight={750} color={color}>
        s<TSub>{sub}</TSub>
      </Txt>
    );
  };
  return (
    <g>
      {tri(1)}
      <Txt x={sx((p2.from + p2.to) / 2)} y={sy(v / 2) + 6 * f} size={1} weight={750} color={PHASE_COLOR[2]}>
        s<TSub>2</TSub> = {fmt(p2.s, 0)} m
      </Txt>
      {tri(3)}
    </g>
  );
}

/* ---------- s-t-grafen ---------- */

function StPanel({ task, sol, ax, view, height }: PanelProps) {
  const f = useTextScale();
  const ss = useStrokeScale();
  const { t1, t2, t3 } = task;
  const upTo = view === 'st1' ? t1 : view === 'st2' || view === 'alle' ? t3 : 0;
  const empty = upTo === 0;

  return (
    <Plot
      x={{ min: 0, max: ax.tMax, label: 'Tid t (s)', ticks: ax.tTicks }}
      y={{ min: 0, max: ax.sTop, label: 'Posisjon s (m)', ticks: ax.sTicks }}
      width={800}
      height={height}
      margin={margins(f)}
    >
      {({ sx, sy, x0, x1, y0, y1 }) => {
        if (empty) {
          return (
            <g>
              <PhaseLines task={task} sx={sx} y0={y0} y1={y1} />
              <Txt x={(x0 + x1) / 2} y={(y0 + y1) / 2} size={0.95} weight={650} muted>
                s-t-grafen skisseres i e)
              </Txt>
            </g>
          );
        }
        const curve = (from: number, to: number) => {
          const n = Math.max(2, Math.ceil((to - from) * 6));
          let d = '';
          for (let i = 0; i <= n; i++) {
            const t = from + ((to - from) * i) / n;
            d += `${i ? 'L' : 'M'}${sx(t).toFixed(1)},${sy(positionAt(task, t)).toFixed(1)}`;
          }
          return d;
        };
        const segs: { n: PhaseNo; a: number; b: number }[] = [
          { n: 1 as PhaseNo, a: 0, b: t1 },
          { n: 2 as PhaseNo, a: t1, b: t2 },
          { n: 3 as PhaseNo, a: t2, b: t3 },
        ].filter((sg) => sg.a < upTo - 1e-9);
        const marks = [
          { t: t1, s: positionAt(task, t1) },
          { t: t2, s: positionAt(task, t2) },
          { t: t3, s: sol.s },
        ].filter((m) => m.t <= upTo + 1e-9);
        const fs = 17 * 0.85 * f;
        return (
          <g>
            <PhaseStrip task={task} sx={sx} y1={y1} />
            <PhaseLines task={task} sx={sx} y0={y0} y1={y1} />
            {/* Hjelpelinjer fra knekkpunktene til aksene */}
            <g stroke={VIZ.muted} strokeWidth={1.1 * ss} strokeDasharray={`${3 * ss} ${3 * ss}`} opacity={0.8}>
              {marks.map((m) => (
                <line key={m.t} x1={x0} x2={sx(m.t)} y1={sy(m.s)} y2={sy(m.s)} />
              ))}
            </g>
            {/* Vannrett tangent der bilen stopper */}
            {upTo >= t3 && (
              <line x1={sx(t3) - 60 * f} x2={sx(t3) + 22 * f} y1={sy(sol.s)} y2={sy(sol.s)} stroke={VIZ.ink} strokeWidth={1.8 * ss} />
            )}
            {segs.map((sg) => (
              <path key={sg.n} d={curve(sg.a, Math.min(sg.b, upTo))} fill="none" stroke={PHASE_COLOR[sg.n]} strokeWidth={3.6 * ss} strokeLinecap="round" strokeLinejoin="round" />
            ))}
            <ColorDot x={sx(0)} y={sy(0)} r={4.2 * ss} color={PHASE_COLOR[1]} />
            {marks.map((m, i) => {
              // 276 m under og til høyre for punktet (kurven stiger mot høyre), de andre over og til venstre.
              const right = i === 1;
              return (
                <g key={m.t}>
                  <ColorDot x={sx(m.t)} y={sy(m.s)} r={4.6 * ss} color={VIZ.ink} />
                  <Txt
                    x={right ? sx(m.t) + 8 * f : sx(m.t) - 9 * f}
                    y={right ? sy(m.s) + fs + 3 * f : Math.max(y1 + fs, sy(m.s) - 9 * f)}
                    anchor={right ? 'start' : 'end'}
                    size={0.85}
                    weight={700}
                    color={VIZ.ink}
                  >
                    {fmt(m.s, 0)} m
                  </Txt>
                </g>
              );
            })}
            {/* «v = 0» under tangenten, bare når den ikke kolliderer med etiketten ved t₂ (smale skjermer) */}
            {upTo >= t3 && sx(t3) - textW('v = 0', f, 0.78) / 2 > sx(t2) + 8 * f + textW(`${fmt(positionAt(task, t2), 0)} m`, f, 0.85) + 6 * f && (
              <Txt x={sx(t3) + 4 * f} y={sy(sol.s) + fs + 6 * f} anchor="middle" size={0.78} weight={650} muted>
                v = 0
              </Txt>
            )}
          </g>
        );
      }}
    </Plot>
  );
}
