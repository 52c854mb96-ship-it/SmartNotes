import { useEffect, useId, useState, type ReactNode } from 'react';
import {
  Arrow,
  Controls,
  Explain,
  Figure,
  Formula,
  FormulaLine,
  Label,
  Legend,
  PlayControls,
  Plot,
  Readout,
  Readouts,
  Slider,
  Sub,
  Toolbar,
  VIZ,
  VizLayout,
  fmt,
  linePath,
  niceTicks,
  sample,
  scaleLinear,
  useSimClock,
  useTextScale,
} from '../kit';
import { displacement, niceRange, pathLength, position, positionExtent, speedTrend, turnTime, velocity, type Motion } from './model';
import { useNarrow } from './useNarrow';
import { ColorDot } from './marks';

/** Lengden på tidsaksen (s). */
const T_END = 6;
/** Høyden på hver av de tre grafene (s-t, v-t, a-t) i figurens enheter. */
const HEIGHTS = { wide: [235, 235, 170], narrow: [390, 390, 310] } as const;

export default function Bevegelsesgrafer() {
  const [s0, setS0] = useState(-5);
  const [v0, setV0] = useState(6);
  const [a, setA] = useState(-2);
  const clock = useSimClock({ tMax: T_END });
  const { setT } = clock;
  // Start midt i bevegelsen, så tangenten og arealet synes før du trykker på «Spill av».
  useEffect(() => setT(2), [setT]);
  const { ref, narrow } = useNarrow();

  const m: Motion = { s0, v0, a };
  const t = Math.min(Math.max(clock.t, 0), T_END);
  const s = position(m, t);
  const v = velocity(m, t);
  const ds = displacement(m, t);
  const dist = pathLength(m, t);
  const [pLo, pHi] = positionExtent(m, T_END);
  const sRange = niceRange(Math.min(0, pLo), Math.max(0, pHi), 4, 4);
  const vEnd = velocity(m, T_END);
  const vRange = niceRange(Math.min(0, v0, vEnd), Math.max(0, v0, vEnd), 4, 2);
  const heights = narrow ? HEIGHTS.narrow : HEIGHTS.wide;
  const total = heights[0] + heights[1] + heights[2];

  return (
    <VizLayout>
      <Controls>
        <Slider
          label={
            <>
              Startposisjon s<Sub>0</Sub>
            </>
          }
          ariaLabel="Startposisjon"
          value={s0}
          onChange={setS0}
          min={-20}
          max={20}
          step={1}
          unit="m"
          decimals={0}
        />
        <Slider
          label={
            <>
              Startfart v<Sub>0</Sub>
            </>
          }
          ariaLabel="Startfart"
          value={v0}
          onChange={setV0}
          min={-10}
          max={10}
          step={0.5}
          unit="m/s"
          decimals={1}
        />
        <Slider label="Akselerasjon a" value={a} onChange={setA} min={-4} max={4} step={0.25} unit="m/s²" decimals={2} />
        <Slider label="Tidspunkt t" value={t} onChange={(v) => setT(v)} min={0} max={T_END} step={0.05} unit="s" decimals={2} />
      </Controls>
      <Toolbar>
        <PlayControls clock={clock} />
      </Toolbar>

      <div ref={ref}>
        <Figure
          viewBox={`0 0 800 ${narrow ? 240 : 170}`}
          label={`Vogn på en rett bane. Ved t = ${fmt(t, 2)} s er posisjonen ${fmt(s, 1)} m og farten ${fmt(v, 1)} m/s.`}
          maxHeight={narrow ? 320 : 220}
        >
          <Track m={m} t={t} sRange={sRange} narrow={narrow} />
        </Figure>
      </div>

      <Figure
        viewBox={`0 0 800 ${total}`}
        label="Tre grafer over hverandre med samme tidsakse: posisjon, fart og akselerasjon som funksjon av tiden."
        maxHeight={narrow ? 1400 : 760}
      >
        <Graphs m={m} t={t} sRange={sRange} vRange={vRange} heights={heights} />
      </Figure>
      <Legend
        items={[
          { color: VIZ.series[0], label: 'Posisjon s' },
          { color: VIZ.velocity, label: 'Fart v og tangenten i s-t-grafen', dashed: false },
          { color: VIZ.acceleration, label: 'Akselerasjon a' },
        ]}
      />

      <Readouts>
        <Readout label="Posisjon s" value={fmt(s, 1)} unit="m" tone={VIZ.series[0]} />
        <Readout label="Fart v" value={fmt(v, 1)} unit="m/s" tone={VIZ.velocity} />
        <Readout label="Akselerasjon a" value={fmt(a, 2)} unit="m/s²" tone={VIZ.acceleration} />
        <Readout label="Forflytning Δs" value={fmt(ds, 1)} unit="m" />
      </Readouts>

      <Formula label="Bevegelseslikningene med tallene for tidspunktet t">
        <FormulaLine>
          s = s<Sub>0</Sub> + v<Sub>0</Sub>t + ½at²
        </FormulaLine>
        <FormulaLine>
          s = {q(s0, 1, 'm')} + {q(v0, 1, 'm/s')} · {fmt(t, 2)} s + ½ · {q(a, 2, 'm/s²')} · ({fmt(t, 2)} s)² = {fmt(s, 1)} m
        </FormulaLine>
        <FormulaLine>
          v = v<Sub>0</Sub> + at = {q(v0, 1, 'm/s')} + {q(a, 2, 'm/s²')} · {fmt(t, 2)} s = {fmt(v, 1)} m/s
        </FormulaLine>
      </Formula>

      <Explain>{explanation(m, t, v, ds, dist)}</Explain>
    </VizLayout>
  );
}

/** Tall med enhet, i parentes når det er negativt: «(−2,0 m/s²)». */
function q(value: number, decimals: number, unit: string): string {
  const text = `${fmt(value, decimals)} ${unit}`;
  return value < 0 && fmt(value, decimals) !== fmt(0, decimals) ? `(${text})` : text;
}

/* ---------- Vogna på banen ---------- */

function Track({ m, t, sRange, narrow }: { m: Motion; t: number; sRange: [number, number]; narrow: boolean }) {
  const f = useTextScale();
  const H = narrow ? 240 : 170;
  const trackY = H - 22 - 26 * f;
  const xs = scaleLinear(sRange, [120, 680]);
  const ticks = niceTicks(sRange[0], sRange[1], narrow ? 4 : 6);
  // Større vogn og piler på mobil, der figuren skaleres ned
  const k = narrow ? 1.35 : 1;
  const s = position(m, t);
  const v = velocity(m, t);
  const cx = xs(s);
  // Fartspilen skaleres etter den største farten i bevegelsen, så den alltid får plass.
  const vMax = Math.max(1, Math.abs(m.v0), Math.abs(velocity(m, T_END)));
  const vLen = (v / vMax) * 110;
  const aLen = m.a * 20;
  const yV = trackY - 16 - 40 * k;
  const yA = yV - 26 * f;
  const strobe: number[] = [];
  for (let n = 0; n <= Math.floor(t + 1e-9); n++) strobe.push(n);

  return (
    <g>
      <line x1={100} x2={700} y1={trackY} y2={trackY} className="viz-ground" />
      {ticks.map((v) => (
        <g key={v}>
          <line x1={xs(v)} x2={xs(v)} y1={trackY} y2={trackY + 8} className="viz-axis" />
          <text x={xs(v)} y={trackY + 22 + 12 * f} textAnchor="middle" className="viz-tick" style={v === 0 ? { fontWeight: 700 } : undefined}>
            {fmt(v, 0)} m
          </text>
        </g>
      ))}
      {/* Posisjonen hvert hele sekund (som en tickertape) */}
      {strobe.map((n) => (
        <circle key={n} cx={xs(position(m, n))} cy={trackY + 12} r={4.5 * f} fill={VIZ.series[0]} opacity={0.75} />
      ))}
      {/* Vogna */}
      <rect x={cx - 32 * k} y={trackY - 14 * k - 26 * k} width={64 * k} height={26 * k} rx={6} fill={VIZ.body} className="viz-block" />
      <circle cx={cx - 18 * k} cy={trackY - 8 * k} r={7 * k} fill={VIZ.bodyStrong} className="viz-block" />
      <circle cx={cx + 18 * k} cy={trackY - 8 * k} r={7 * k} fill={VIZ.bodyStrong} className="viz-block" />
      <Arrow
        x1={cx}
        y1={yV}
        x2={cx + vLen}
        y2={yV}
        color={VIZ.velocity}
        width={3 * k}
        head={11 * k}
        label="v"
        labelX={cx + vLen + (vLen >= 0 ? 12 : -12)}
        labelY={yV + 6}
        labelAnchor={vLen >= 0 ? 'start' : 'end'}
        minLength={3}
      />
      {Math.abs(v) < 0.05 && (
        <Label x={cx} y={yV + 6} color={VIZ.velocity}>
          v = 0
        </Label>
      )}
      <Arrow
        x1={cx}
        y1={yA}
        x2={cx + aLen}
        y2={yA}
        color={VIZ.acceleration}
        width={2.5 * k}
        head={11 * k}
        label="a"
        labelX={cx + aLen + (aLen >= 0 ? 12 : -12)}
        labelY={yA + 6}
        labelAnchor={aLen >= 0 ? 'start' : 'end'}
        minLength={3}
      />
      {m.a === 0 && (
        <Label x={cx} y={yA + 6} color={VIZ.acceleration}>
          a = 0
        </Label>
      )}
    </g>
  );
}

/* ---------- Tre grafer med felles tidsakse ---------- */

function Graphs({
  m,
  t,
  sRange,
  vRange,
  heights,
}: {
  m: Motion;
  t: number;
  sRange: [number, number];
  vRange: [number, number];
  heights: readonly [number, number, number];
}) {
  const f = useTextScale();
  const clipBase = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const margin = (last: boolean) => ({ top: 30 * f, right: 24 * f, bottom: (last ? 56 : 34) * f, left: 72 * f });
  const v = velocity(m, t);
  const s = position(m, t);
  const ds = displacement(m, t);
  const dv = m.a * t;
  const tt = turnTime(m);
  const [h0, h1, h2] = heights;

  return (
    <>
      {/* s-t */}
      <Plot
        x={{ min: 0, max: T_END, label: '' }}
        y={{ min: sRange[0], max: sRange[1], label: 's (m)', ticks: niceTicks(sRange[0], sRange[1], 4) }}
        width={800}
        height={h0}
        margin={margin(false)}
      >
        {({ sx, sy, x0, x1, y0, y1 }) => {
          const half = 1.3;
          const ta = Math.max(0, t - half);
          const tb = Math.min(T_END, t + half);
          return (
            <g>
              <clipPath id={`${clipBase}-s`}>
                <rect x={x0} y={y1} width={x1 - x0} height={y0 - y1} />
              </clipPath>
              <Title x={x0} y={y1 - 10} color={VIZ.velocity}>
                Stigningstall = v = {fmt(v, 1)} m/s
              </Title>
              <line x1={sx(t)} x2={sx(t)} y1={y1} y2={y0} className="viz-guide" />
              <path d={linePath(sample((x) => position(m, x), 0, T_END, 120), sx, sy)} fill="none" stroke={VIZ.series[0]} strokeWidth={2} opacity={0.35} />
              <path d={linePath(sample((x) => position(m, x), 0, t, 80), sx, sy)} fill="none" stroke={VIZ.series[0]} strokeWidth={3.5} />
              <g clipPath={`url(#${clipBase}-s)`}>
                <line
                  x1={sx(ta)}
                  y1={sy(s + v * (ta - t))}
                  x2={sx(tb)}
                  y2={sy(s + v * (tb - t))}
                  stroke={VIZ.velocity}
                  strokeWidth={2.5}
                  strokeDasharray="8 6"
                />
              </g>
              <ColorDot x={sx(t)} y={sy(s)} color={VIZ.series[0]} />
            </g>
          );
        }}
      </Plot>

      {/* v-t */}
      <g transform={`translate(0 ${h0})`}>
        <Plot
          x={{ min: 0, max: T_END, label: '' }}
          y={{ min: vRange[0], max: vRange[1], label: 'v (m/s)', ticks: niceTicks(vRange[0], vRange[1], 4) }}
          width={800}
          height={h1}
          margin={margin(false)}
        >
          {({ sx, sy, x0, y0, y1 }) => {
            // Arealet fra 0 til t, delt der v skifter fortegn
            const cuts = [0, ...(tt !== null && tt < t ? [tt] : []), t];
            const parts: { d: string; positive: boolean; cx: number; cy: number; px: number }[] = [];
            for (let i = 0; i + 1 < cuts.length; i++) {
              const ta = cuts[i]!;
              const tb = cuts[i + 1]!;
              if (tb - ta < 1e-6) continue;
              const va = velocity(m, ta);
              const vb = velocity(m, tb);
              const d = `M${sx(ta)},${sy(0)} L${sx(ta)},${sy(va)} L${sx(tb)},${sy(vb)} L${sx(tb)},${sy(0)} Z`;
              const mid = (va + vb) / 2;
              const px = Math.abs(sx(tb) - sx(ta)) * Math.abs(sy(mid) - sy(0));
              parts.push({ d, positive: mid >= 0, cx: sx((ta + tb) / 2), cy: sy(mid / 2), px });
            }
            return (
              <g>
                <Title x={x0} y={y1 - 10} color={VIZ.velocity}>
                  Areal fra 0 til t = Δs = {fmt(ds, 1)} m
                </Title>
                {parts.map((p, i) => (
                  <g key={i}>
                    <path d={p.d} fill={VIZ.velocity} opacity={p.positive ? 0.24 : 0.14} />
                    {!p.positive && <path d={p.d} fill="none" stroke={VIZ.velocity} strokeWidth={1.5} strokeDasharray="4 4" opacity={0.8} />}
                    {p.px > 2400 * f * f && (
                      <text x={p.cx} y={p.cy + 7 * f} textAnchor="middle" className="viz-label" fill={VIZ.velocity}>
                        {p.positive ? '+' : '−'}
                      </text>
                    )}
                  </g>
                ))}
                <line x1={sx(t)} x2={sx(t)} y1={y1} y2={y0} className="viz-guide" />
                <path d={linePath(sample((x) => velocity(m, x), 0, T_END, 2), sx, sy)} fill="none" stroke={VIZ.velocity} strokeWidth={2} opacity={0.35} />
                <path d={linePath(sample((x) => velocity(m, x), 0, t, 2), sx, sy)} fill="none" stroke={VIZ.velocity} strokeWidth={3.5} />
                {tt !== null && tt <= T_END && <circle cx={sx(tt)} cy={sy(0)} r={5} fill={VIZ.surface} stroke={VIZ.velocity} strokeWidth={2} />}
                <ColorDot x={sx(t)} y={sy(v)} color={VIZ.velocity} />
              </g>
            );
          }}
        </Plot>
      </g>

      {/* a-t */}
      <g transform={`translate(0 ${h0 + h1})`}>
        <Plot
          x={{ min: 0, max: T_END, label: 'Tid t (s)' }}
          y={{ min: -5, max: 5, label: 'a (m/s²)', ticks: [-4, 0, 4] }}
          width={800}
          height={h2}
          margin={margin(true)}
        >
          {({ sx, sy, x0, y0, y1 }) => (
            <g>
              <Title x={x0} y={y1 - 10} color={VIZ.acceleration}>
                Areal fra 0 til t = Δv = {fmt(dv, 1)} m/s
              </Title>
              {t > 0 && m.a !== 0 && (
                <rect
                  x={sx(0)}
                  y={Math.min(sy(0), sy(m.a))}
                  width={sx(t) - sx(0)}
                  height={Math.abs(sy(m.a) - sy(0))}
                  fill={VIZ.acceleration}
                  opacity={0.16}
                />
              )}
              <line x1={sx(t)} x2={sx(t)} y1={y1} y2={y0} className="viz-guide" />
              <line x1={sx(0)} x2={sx(T_END)} y1={sy(m.a)} y2={sy(m.a)} stroke={VIZ.acceleration} strokeWidth={3.5} />
              <ColorDot x={sx(t)} y={sy(m.a)} color={VIZ.acceleration} />
            </g>
          )}
        </Plot>
      </g>
    </>
  );
}

function Title({ x, y, color, children }: { x: number; y: number; color: string; children: ReactNode }) {
  return (
    <Label x={x} y={y} anchor="start" color={color}>
      {children}
    </Label>
  );
}

/* ---------- Forklaring ---------- */

function explanation(m: Motion, t: number, v: number, ds: number, dist: number): ReactNode {
  const trend = speedTrend(m, t);
  const tt = turnTime(m);
  const a = `${fmt(m.a, 2)} m/s²`;
  let state: ReactNode;
  switch (trend) {
    case 'ro':
      state = (
        <>
          <strong>Vogna står i ro.</strong> Både v og a er null, så s-t-grafen er en vannrett linje.
        </>
      );
      break;
    case 'konstant':
      state = (
        <>
          <strong>Konstant fart.</strong> Med a = 0 er v-t-grafen en vannrett linje (ikke skrå), og s-t-grafen er en rett linje med
          stigningstall v = {fmt(v, 1)} m/s.
        </>
      );
      break;
    case 'snur':
      state = (
        <>
          <strong>Vogna snur akkurat nå.</strong> Farten er null, så tangenten i s-t-grafen er vannrett. Men akselerasjonen er fortsatt a ={' '}
          {a}, så vogna blir ikke stående i ro.
        </>
      );
      break;
    case 'øker':
      state =
        m.a < 0 ? (
          <>
            <strong>Farten øker, selv om a er negativ.</strong> Både v og a er negative, så vogna går fortere og fortere i negativ retning.
            Negativ akselerasjon betyr altså ikke alltid at vogna bremser.
          </>
        ) : (
          <>
            <strong>Farten øker</strong> fordi v og a har samme fortegn. s-t-grafen blir brattere og brattere.
          </>
        );
      break;
    case 'avtar':
      state =
        m.a < 0 ? (
          <>
            <strong>Vogna bremser</strong> fordi v og a har motsatt fortegn. v-t-grafen går nedover, men vogna kjører fortsatt framover så
            lenge v er positiv: grafen viser farten, ikke veien vogna kjører.
          </>
        ) : (
          <>
            <strong>Vogna bremser, selv om a er positiv.</strong> Vogna kjører i negativ retning (v &lt; 0), og akselerasjonen peker motsatt
            vei. Det er fortegnet til v sammenlignet med a som avgjør om farten øker eller avtar.
          </>
        );
      break;
  }
  const turned = tt !== null && tt < t - 0.05;
  return (
    <p>
      {state} Arealet under v-t-grafen fra 0 til t er forflytningen Δs = {fmt(ds, 1)} m.
      {turned && (
        <>
          {' '}
          Areal under t-aksen teller negativt, så forflytningen er mindre enn strekningen vogna har kjørt, {fmt(dist, 1)} m.
        </>
      )}
    </p>
  );
}
