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

const PHASE_NAME: Record<LiftPhaseKind, string> = {
  ro: 'I ro',
  akselererer: 'Starter',
  konstant: 'Jevn fart',
  bremser: 'Bremser',
  'fritt-fall': 'Fritt fall',
  nodbrems: 'Nødbrems',
};
/** Kortere navn når fasen er for smal til det vanlige (mobil). */
const PHASE_SHORT: Record<LiftPhaseKind, string> = {
  ro: 'Ro',
  akselererer: 'Start',
  konstant: 'Jevn fart',
  bremser: 'Brems',
  'fritt-fall': 'Fall',
  nodbrems: 'Nødbr.',
};

/** Omtrentlig bredde på fasenavnet (størrelse 0,78, halvfet til fet skrift) i figurens enheter. */
const phaseTextWidth = (text: string, f: number) => text.length * 8.2 * f;

/** Et vannrett eller loddrett linjestykke i grafen: x1, y1, x2, y2. */
type Seg = [number, number, number, number];

/** Om rektangelet [l, r] × [t, b] (med luft `pad`) treffer et av linjestykkene. */
function hitsAny(l: number, r: number, t: number, b: number, segs: Seg[], pad: number): boolean {
  return segs.some(([xa, ya, xb, yb]) => {
    const [sx0, sx1] = xa < xb ? [xa, xb] : [xb, xa];
    const [sy0, sy1] = ya < yb ? [ya, yb] : [yb, ya];
    return sx1 >= l - pad && sx0 <= r + pad && sy1 >= t - pad && sy0 <= b + pad;
  });
}

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
        // Klammen for ΣF ved tiden t, med etiketten ved siden av. Etiketten skal ikke krysse N-trappa eller G-linja:
        // først midt på klammen (til høyre, så til venstre), så like utenfor N-linja, så like utenfor G-linja. Er det
        // ikke plass, prøves bare «ΣF», og ellers står klammen alene (fargen forklares under grafen).
        const showSum = Math.abs(ny - gy) > 6;
        const segs: Seg[] = [[x0, gy, x1, gy]];
        phases.forEach((p, i) => {
          const yN = sy(scaleForce(m, p.a));
          segs.push([sx(p.t0), yN, sx(p.t1), yN]);
          const next = phases[i + 1];
          if (next) segs.push([sx(p.t1), yN, sx(p.t1), sy(scaleForce(m, next.a))]);
        });
        const halfH = 8 * f;
        const away = (from: number, other: number) => (from < other ? from - halfH - 5 : from + halfH + 5);
        const rows = [(gy + ny) / 2, away(ny, gy), away(gy, ny)];
        // Klammen står 10 px til siden for tidsstreken, men alltid inne i fasen vi er i (ikke over et sprang i N).
        const fits = (right: boolean) => !current || (right ? xt + 16 <= sx(current.t1) : xt - 16 >= sx(current.t0));
        let sum: { text: string; right: boolean; cy: number } | null = null;
        if (showSum)
          search: for (const text of ['ΣF = ma', 'ΣF'])
            for (const cy of rows)
              for (const right of [true, false]) {
                if (!fits(right)) continue;
                const w = text.length * 9.6 * f;
                const l = right ? xt + 18 : xt - 18 - w;
                const r = l + w;
                if (l < x0 + 4 || r > x1 - 4 || cy - halfH < y1 + 2 || cy + halfH > y0 - 2) continue;
                // Fra klammen til enden av etiketten: ingen linjer imellom
                if (hitsAny(right ? xt + 5 : l, right ? r : xt - 5, cy - halfH, cy + halfH, segs, 3)) continue;
                sum = { text, right, cy };
                break search;
              }
        const bx = (sum?.right ?? fits(true)) ? xt + 10 : xt - 10;
        return (
          <g>
            {/* Fasene: den vi er i nå, er markert */}
            {phases.map((p) => {
              const a = sx(p.t0);
              const b = sx(p.t1);
              // Det vanlige navnet, et kortere navn hvis fasen er for smal (mobil), eller ingenting.
              const room = b - a - 6;
              const text = [PHASE_NAME[p.kind], PHASE_SHORT[p.kind]].find((name) => phaseTextWidth(name, f) <= room) ?? '';
              const fits = text !== '';
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
                {sum && (
                  <Txt x={sum.right ? bx + 8 : bx - 8} y={sum.cy + 6 * f} anchor={sum.right ? 'start' : 'end'} size={0.85} color={VIZ.acceleration} weight={700}>
                    {sum.text}
                  </Txt>
                )}
              </g>
            )}
            <Dot x={xt} y={ny} color={VIZ.normal} />
          </g>
        );
      }}
    </Plot>
  );
}
