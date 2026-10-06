/**
 * Grafen til «Vekt i heis»: normalkraften N fra vekta gjennom hele turen, med tyngden G = mg stiplet. Fasene står
 * øverst, avstanden mellom N og G er kraftsummen ΣF = ma (fylt), og aksen til høyre viser det samme i kilo, slik
 * vekta viser det (N/g).
 */
import { Dot, Figure, Plot, Txt, VIZ, fmt, linePath, niceTicks, useTextScale } from '../../kit';
import { alpha, useStrokeScale } from '../../kit/scene';
import { G_EARTH } from '../../kit/format';
import { LIFT_T_END, scaleForce, type LiftPhase, type LiftPhaseKind, type LiftTrip } from './model';
import { useNarrow } from './useNarrow';

const PHASE_SHORT: Record<LiftPhaseKind, string> = {
  ro: 'I ro',
  akselererer: 'Starter',
  konstant: 'Jevn fart',
  bremser: 'Bremser',
  'fritt-fall': 'Fritt fall',
  nodbrems: 'Nødbrems',
};

/** Kraftaksen: et pent steg og en øvre grense som er et helt antall steg, så toppen også får et tall. */
function forceAxis(maxValue: number, count: number): { max: number; ticks: number[] } {
  const raw = Math.max(1, maxValue);
  const t = niceTicks(0, raw, count);
  const step = (t[1] ?? raw) - (t[0] ?? 0) || raw;
  const n = Math.ceil(raw / step - 1e-9);
  return { max: n * step, ticks: Array.from({ length: n + 1 }, (_, i) => i * step) };
}

export interface HeisGrafProps {
  phases: LiftPhase[];
  trip: LiftTrip;
  t: number;
  m: number;
  N: number;
  G: number;
}

export function HeisGraf(props: HeisGrafProps) {
  const [ref, narrow] = useNarrow<HTMLDivElement>();
  const gh = narrow ? 600 : 340;
  return (
    <div ref={ref}>
      <Figure viewBox={`0 0 800 ${gh}`} label="Graf over normalkraften fra vekta og tyngden gjennom heisturen" maxHeight={420}>
        <GraphInner {...props} height={gh} narrow={narrow} />
      </Figure>
    </div>
  );
}

function GraphInner({ phases, t, m, N, G, height, narrow }: HeisGrafProps & { height: number; narrow: boolean }) {
  const f = useTextScale();
  const ss = useStrokeScale();
  const nMax = Math.max(...phases.map((p) => scaleForce(m, p.a)));
  const axis = forceAxis(Math.max(nMax, G) * 1.12, narrow ? 3 : 5);
  const yMax = axis.max;
  const margin = { top: 34 * f, right: 66 * f, bottom: 56 * f, left: 86 * f };
  const pts: [number, number][] = [];
  for (const p of phases) {
    const n = scaleForce(m, p.a);
    pts.push([p.t0, n], [p.t1, n]);
  }
  const current = phases.find((p) => t >= p.t0 && t < p.t1) ?? phases[phases.length - 1];
  const kgTicks = niceTicks(0, yMax / G_EARTH, 4).filter((kg) => kg * G_EARTH <= yMax + 1e-9);
  return (
    <Plot x={{ min: 0, max: LIFT_T_END, label: 'Tid t (s)' }} y={{ min: 0, max: yMax, label: 'Kraft (N)', ticks: axis.ticks }} width={800} height={height} margin={margin}>
      {({ sx, sy, x0, x1, y0, y1 }) => {
        const gy = sy(G);
        const ny = sy(N);
        const xt = sx(t);
        // Klammen for ΣF ved tiden t, til høyre for streken når det er plass, ellers til venstre.
        const sumText = 'ΣF = ma';
        const sumW = sumText.length * 9.6 * f;
        const showSum = Math.abs(ny - gy) > 24 * f;
        const sumRight = xt + 16 + sumW < x1 - 4;
        const bx = sumRight ? xt + 10 : xt - 10;
        return (
          <g>
            {/* Fasene: den vi er i nå, er markert */}
            {phases.map((p) => {
              const a = sx(p.t0);
              const b = sx(p.t1);
              const text = PHASE_SHORT[p.kind];
              const fits = b - a > text.length * 9.2 * f + 8;
              return (
                <g key={p.t0}>
                  {p === current && <rect x={a} y={y1} width={b - a} height={y0 - y1} fill={VIZ.grid} opacity={0.75} />}
                  {p.t0 > 0 && <line x1={a} y1={y1 - 26 * f} x2={a} y2={y0} stroke={VIZ.grid} strokeWidth={1.2 * ss} />}
                  {fits && (
                    <Txt x={(a + b) / 2} y={y1 - 10 * f} size={0.78} weight={p === current ? 700 : 520} muted={p !== current}>
                      {text}
                    </Txt>
                  )}
                </g>
              );
            })}
            {/* Kraftsummen ΣF = N − G = ma der akselerasjonen ikke er null */}
            {phases.map((p) => {
              const n = sy(scaleForce(m, p.a));
              if (Math.abs(n - gy) < 0.5) return null;
              return <rect key={`s${p.t0}`} x={sx(p.t0)} y={Math.min(n, gy)} width={sx(p.t1) - sx(p.t0)} height={Math.abs(n - gy)} fill={alpha(VIZ.acceleration, 0.16)} />;
            })}
            <line x1={x0} y1={gy} x2={x1} y2={gy} stroke={VIZ.gravity} strokeWidth={2.4 * ss} strokeDasharray={`${8 * ss} ${6 * ss}`} />
            <path d={linePath(pts, sx, sy)} fill="none" stroke={VIZ.surface} strokeWidth={8 * ss} strokeLinejoin="round" opacity={0.85} />
            <path d={linePath(pts, sx, sy)} fill="none" stroke={VIZ.normal} strokeWidth={3.6 * ss} strokeLinejoin="round" />

            {/* Aksen til høyre: det vekta viser, N/g */}
            <line x1={x1} y1={y0} x2={x1} y2={y1} className="viz-axis" />
            {kgTicks.map((kg) => (
              <g key={kg}>
                <line x1={x1} y1={sy(kg * G_EARTH)} x2={x1 + 6} y2={sy(kg * G_EARTH)} className="viz-axis" />
                <text x={x1 + 10} y={sy(kg * G_EARTH) + 5 * f} className="viz-tick">
                  {fmt(kg, 0)}
                </text>
              </g>
            ))}
            <text
              x={800 - 14 * f}
              y={(y0 + y1) / 2}
              textAnchor="middle"
              className="viz-axis-label"
              transform={`rotate(90 ${800 - 14 * f} ${(y0 + y1) / 2})`}
            >
              Vekta viser (kg)
            </text>

            {/* Tiden nå */}
            <line x1={xt} y1={y0} x2={xt} y2={y1} className="viz-guide" />
            {showSum && (
              <g>
                <line x1={bx} y1={gy} x2={bx} y2={ny} stroke={VIZ.acceleration} strokeWidth={2.2 * ss} />
                <line x1={bx - 5} y1={gy} x2={bx + 5} y2={gy} stroke={VIZ.acceleration} strokeWidth={2.2 * ss} />
                <line x1={bx - 5} y1={ny} x2={bx + 5} y2={ny} stroke={VIZ.acceleration} strokeWidth={2.2 * ss} />
                <Txt x={sumRight ? bx + 8 : bx - 8} y={(gy + ny) / 2 + 6 * f} anchor={sumRight ? 'start' : 'end'} size={0.85} color={VIZ.acceleration} weight={700}>
                  {sumText}
                </Txt>
              </g>
            )}
            <Dot x={xt} y={ny} color={VIZ.normal} />
          </g>
        );
      }}
    </Plot>
  );
}
