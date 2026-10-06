/**
 * Grafene til «Fall med luftmotstand» (k2-luftmotstand): farten v(t) med terminalfarten og fallet uten
 * luftmotstand, og akselerasjonen a(t) fra g ned mot null. Eulers metode kan legges oppå fartsgrafen.
 * Samme farger og glorie som scenen, og tiden nå er markert i begge.
 */
import { Dot, Plot, Txt, TSub, VIZ, fmt, linePath, sample, useTextScale } from '../../kit';
import { G_EARTH } from '../../kit/format';
import { alpha, useStrokeScale } from '../../kit/scene';
import { DRAG_RANGES, dragFall, dragTimeToFraction, eulerFall } from './model';

export const V_AXIS = 120;
export const A_AXIS = 12;
export const EULER_DT = 1;
const T_END = DRAG_RANGES.tEnd;

export interface LuftGrafProps {
  m: number;
  k: number;
  t: number;
  v: number;
  a: number;
  vT: number;
  compare: boolean;
  euler: boolean;
  plotH: number;
}

export function LuftGraf({ m, k, t, v, a, vT, compare, euler, plotH }: LuftGrafProps) {
  const f = useTextScale();
  const ss = useStrokeScale();
  const sparse = f > 1.3;
  const vPts = sample((x) => dragFall(m, k, x).v, 0, T_END, 240);
  const aPts = sample((x) => dragFall(m, k, x).a, 0, T_END, 240);
  const ePts = euler ? eulerFall(m, k, EULER_DT, T_END) : [];
  const tFree = V_AXIS / G_EARTH;
  const t95 = dragTimeToFraction(m, k, 0.95);
  const s = dragFall(m, k, t).s;
  const sPts = sample((x) => dragFall(m, k, x).v, 0, Math.max(t, 1e-6), 80);
  // Plass til «s = … m» inne i arealet: bredt nok og høyt nok.
  const sFits = t > (sparse ? 7 : 4) && v > (sparse ? 30 : 22);
  const margin = { top: 26 * f, right: 24 * f, bottom: 56 * f, left: 76 * f };
  const halo = (d: string, w: number) => <path d={d} fill="none" stroke={VIZ.surface} strokeWidth={w + 4.5 * ss} strokeLinejoin="round" opacity={0.85} />;
  return (
    <>
      <Plot
        x={{ min: 0, max: T_END, label: 'Tid t (s)' }}
        y={{ min: 0, max: V_AXIS, label: 'Fart v (m/s)', ticks: sparse ? [0, 40, 80, 120] : [0, 20, 40, 60, 80, 100, 120] }}
        width={800}
        height={plotH}
        margin={margin}
      >
        {({ sx, sy, y0, y1, x1 }) => {
          const vd = linePath(vPts, sx, sy);
          // Etiketten til terminalfarten over linja, eller under når linja er helt øverst.
          const vtLabelY = sy(vT) - 10 * ss > y1 + 14 * f ? sy(vT) - 10 * ss : sy(vT) + 22 * f;
          // Merket for 95 % av terminalfarten: under kurven, eller over v_T-linja når det kolliderer med «s = … m».
          // Til venstre for punktet når teksten ellers går ut av plottet, og bort når den ikke får plass noe sted.
          const t95Mark = (() => {
            if (!(Number.isFinite(t95) && t95 < T_END - 1) || sparse) return null;
            const tw = 23 * 17 * f * 0.74 * 0.56;
            const left = sx(t95) + 6 + tw > x1 - 4;
            const x = left ? sx(t95) - 6 : sx(t95) + 6;
            const span: [number, number] = left ? [x - tw, x] : [x, x + tw];
            const below = sy(0.95 * vT) + 30 * f;
            const sw = `s = ${fmt(s, 0)} m`.length * 17 * f * 0.8 * 0.58;
            const sBox: [number, number, number] = [sx(t * 0.55) - sw / 2, sx(t * 0.55) + sw / 2, sy(0) - 12 * f];
            const hitsS = sFits && span[0] < sBox[1] && span[1] > sBox[0] && Math.abs(below - sBox[2]) < 18 * f;
            if (!hitsS && below < y0 - 8 * f) return { x, y: below, anchor: left ? ('end' as const) : ('start' as const), below: true };
            const above = sy(vT) - 10 * ss;
            const vtW = 15 * 17 * f * 0.9 * 0.58;
            const hitsVt = span[1] > x1 - 6 - vtW && Math.abs(above - vtLabelY) < 18 * f;
            if (hitsVt || above < y1 + 14 * f) return null;
            return { x, y: above, anchor: left ? ('end' as const) : ('start' as const), below: false };
          })();
          return (
            <g>
              {/* Arealet under fartsgrafen fram til nå er fallhøyden s */}
              {t > 0.05 && <path d={`${linePath(sPts, sx, sy)}L${sx(t)},${sy(0)}L${sx(0)},${sy(0)}Z`} fill={alpha(VIZ.velocity, 0.14)} />}
              {sFits && (
                <Txt x={sx(t * 0.55)} y={sy(0) - 12 * f} anchor="middle" size={0.8} weight={650} color={VIZ.ink}>
                  s = {fmt(s, 0)} m
                </Txt>
              )}
              {compare && (
                <g>
                  <line x1={sx(0)} y1={sy(0)} x2={sx(tFree)} y2={sy(V_AXIS)} stroke={VIZ.muted} strokeWidth={2.5 * ss} strokeDasharray={`${7 * ss} ${6 * ss}`} />
                  {/* Til venstre for den stiplede linja, der det alltid er tomt (over kurven og under v_T-etiketten) */}
                  <Txt x={sx(tFree * 0.72) - 10 * ss} y={sy(V_AXIS * 0.72) - 4 * ss} anchor="end" size={0.78} muted weight={600}>
                    {sparse ? 'v = gt' : 'Uten luftmotstand: v = gt'}
                  </Txt>
                </g>
              )}
              <line x1={sx(0)} y1={sy(vT)} x2={x1} y2={sy(vT)} stroke={VIZ.velocity} strokeWidth={1.6 * ss} strokeDasharray={`${4 * ss} ${5 * ss}`} opacity={0.85} />
              <Txt x={x1 - 6} y={vtLabelY} anchor="end" color={VIZ.velocity} size={0.9} weight={700}>
                v<TSub>T</TSub> = {fmt(vT, 1)} m/s
              </Txt>
              {halo(vd, 3.5 * ss)}
              <path d={vd} fill="none" stroke={VIZ.velocity} strokeWidth={3.5 * ss} strokeLinejoin="round" />
              {euler && (
                <g>
                  <path d={linePath(ePts, sx, sy)} fill="none" stroke={VIZ.ink} strokeWidth={1.5 * ss} opacity={0.6} />
                  {ePts.map(([et, ev]) => (
                    <circle key={et} cx={sx(et)} cy={sy(ev)} r={4.5 * ss} fill={VIZ.ink} stroke={VIZ.surface} strokeWidth={1.2 * ss} />
                  ))}
                </g>
              )}
              {t95Mark && (
                <g>
                  <line
                    x1={sx(t95)}
                    y1={sy(0.95 * vT) + (t95Mark.below ? 6 : -6) * ss}
                    x2={sx(t95)}
                    y2={t95Mark.y + (t95Mark.below ? -13 : 4) * f}
                    stroke={VIZ.velocity}
                    strokeWidth={1.2 * ss}
                  />
                  <circle cx={sx(t95)} cy={sy(0.95 * vT)} r={4 * ss} fill={VIZ.surface} stroke={VIZ.velocity} strokeWidth={2 * ss} />
                  <Txt x={t95Mark.x} y={t95Mark.y} anchor={t95Mark.anchor} size={0.74} color={VIZ.velocity} weight={600}>
                    95 % av v<TSub>T</TSub> etter {fmt(t95, 1)} s
                  </Txt>
                </g>
              )}
              <line x1={sx(t)} y1={y0} x2={sx(t)} y2={y1} className="viz-guide" />
              <Dot x={sx(t)} y={sy(v)} color={VIZ.velocity} />
            </g>
          );
        }}
      </Plot>
      <g transform={`translate(0 ${plotH})`}>
        <Plot
          x={{ min: 0, max: T_END, label: 'Tid t (s)' }}
          y={{ min: 0, max: A_AXIS, label: 'Akselerasjon a (m/s²)', ticks: sparse ? [0, 4, 8, 12] : [0, 2, 4, 6, 8, 10, 12] }}
          width={800}
          height={plotH}
          margin={margin}
        >
          {({ sx, sy, y0, y1, x1 }) => {
            const ad = linePath(aPts, sx, sy);
            return (
              <g>
                <line x1={sx(0)} y1={sy(G_EARTH)} x2={x1} y2={sy(G_EARTH)} stroke={VIZ.muted} strokeWidth={2 * ss} strokeDasharray={`${7 * ss} ${6 * ss}`} />
                <Txt x={x1 - 6} y={sy(G_EARTH) - 10 * ss} anchor="end" size={0.85} muted weight={650}>
                  {compare ? (sparse ? 'a = g' : 'Uten luftmotstand: a = g') : 'g = 9,81 m/s²'}
                </Txt>
                {halo(ad, 3.5 * ss)}
                <path d={ad} fill="none" stroke={VIZ.acceleration} strokeWidth={3.5 * ss} strokeLinejoin="round" />
                <line x1={sx(t)} y1={y0} x2={sx(t)} y2={y1} className="viz-guide" />
                <Dot x={sx(t)} y={sy(a)} color={VIZ.acceleration} />
              </g>
            );
          }}
        </Plot>
      </g>
    </>
  );
}
