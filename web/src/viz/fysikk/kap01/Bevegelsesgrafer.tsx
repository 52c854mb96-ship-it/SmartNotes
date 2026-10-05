import { useEffect, useId, useState, type ReactNode } from 'react';
import {
  Controls,
  Explain,
  Figure,
  Formula,
  FormulaLine,
  Legend,
  PlayControls,
  Plot,
  Readout,
  Readouts,
  Slider,
  Sub,
  Toggle,
  Toolbar,
  VIZ,
  VizLayout,
  fmt,
  linePath,
  sample,
  useSimClock,
  useTextScale,
} from '../../kit';
import {
  displacement,
  facingDirection,
  isReversing,
  niceAxis,
  pathLength,
  position,
  positionExtent,
  secondMarks,
  speedTrend,
  turnTime,
  velocity,
  type Motion,
} from './model';
import { useNarrow } from './useNarrow';
import { ColorDot, Label } from './marks';
import { VeiScene } from './bevegelsesgrafer-scene';

/** Lengden på tidsaksen (s). */
const T_END = 6;
/** Høyden på hver av de tre grafene (s-t, v-t, a-t) i figurens enheter. */
const HEIGHTS = { wide: [235, 235, 170], narrow: [390, 390, 310] } as const;

export default function Bevegelsesgrafer() {
  const [s0, setS0] = useState(-5);
  const [v0, setV0] = useState(6);
  const [a, setA] = useState(-2);
  const [showArrows, setShowArrows] = useState(true);
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
  const sAxis = niceAxis(Math.min(0, pLo), Math.max(0, pHi), 4, 4);
  const vEnd = velocity(m, T_END);
  const vAxis = niceAxis(Math.min(0, v0, vEnd), Math.max(0, v0, vEnd), 4, 2);
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
        <Toggle label="Vis piler for v og a" checked={showArrows} onChange={setShowArrows} />
      </Toolbar>

      <VeiScene m={m} t={t} tEnd={T_END} sAxis={sAxis} showArrows={showArrows} />

      <div ref={ref}>
        <Figure
          viewBox={`0 0 800 ${total}`}
          label="Tre grafer over hverandre med samme tidsakse: posisjon, fart og akselerasjon som funksjon av tiden."
          maxHeight={narrow ? 1400 : 760}
        >
          <Graphs m={m} t={t} sAxis={sAxis} vAxis={vAxis} heights={heights} />
        </Figure>
      </div>
      <Legend
        items={[
          { color: VIZ.series[0], label: 'Posisjon s, med merker hvert hele sekund' },
          { color: VIZ.velocity, label: 'Fart v og tangenten i s-t-grafen' },
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

type Axis = ReturnType<typeof niceAxis>;

/* ---------- Tre grafer med felles tidsakse ---------- */

function Graphs({
  m,
  t,
  sAxis,
  vAxis,
  heights,
}: {
  m: Motion;
  t: number;
  sAxis: Axis;
  vAxis: Axis;
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
  // Punktene vokser litt på mobil, der grafen skaleres ned
  const dotK = Math.min(1.5, f);

  return (
    <>
      {/* s-t */}
      <Plot
        x={{ min: 0, max: T_END, label: '' }}
        y={{ min: sAxis.min, max: sAxis.max, label: 's (m)', ticks: sAxis.ticks }}
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
              {/* Avlesning av posisjonen på s-aksen, som pekeren på målebåndet i scenen */}
              <line x1={x0} x2={sx(t)} y1={sy(s)} y2={sy(s)} stroke={VIZ.series[0]} strokeWidth={1.5} strokeDasharray="3 5" opacity={0.7} />
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
              {/* Samme merker som på veien: posisjonen hvert hele sekund */}
              {secondMarks(m, t).map((p) => (
                <circle key={p.t} cx={sx(p.t)} cy={sy(p.s)} r={4.2 * dotK} fill={VIZ.surface} stroke={VIZ.series[0]} strokeWidth={2.4 * dotK} />
              ))}
              <ColorDot x={sx(t)} y={sy(s)} r={7 * dotK} color={VIZ.series[0]} />
            </g>
          );
        }}
      </Plot>

      {/* v-t */}
      <g transform={`translate(0 ${h0})`}>
        <Plot
          x={{ min: 0, max: T_END, label: '' }}
          y={{ min: vAxis.min, max: vAxis.max, label: 'v (m/s)', ticks: vAxis.ticks }}
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
                      <Label x={p.cx} y={p.cy + 7 * f} color={VIZ.velocity}>
                        {p.positive ? '+' : '−'}
                      </Label>
                    )}
                  </g>
                ))}
                <line x1={sx(t)} x2={sx(t)} y1={y1} y2={y0} className="viz-guide" />
                <path d={linePath(sample((x) => velocity(m, x), 0, T_END, 2), sx, sy)} fill="none" stroke={VIZ.velocity} strokeWidth={2} opacity={0.35} />
                <path d={linePath(sample((x) => velocity(m, x), 0, t, 2), sx, sy)} fill="none" stroke={VIZ.velocity} strokeWidth={3.5} />
                {tt !== null && tt <= T_END && <circle cx={sx(tt)} cy={sy(0)} r={5 * dotK} fill={VIZ.surface} stroke={VIZ.velocity} strokeWidth={2 * dotK} />}
                <ColorDot x={sx(t)} y={sy(v)} r={7 * dotK} color={VIZ.velocity} />
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
              <ColorDot x={sx(t)} y={sy(m.a)} r={7 * dotK} color={VIZ.acceleration} />
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
  const dirName = (sign: number) => (sign > 0 ? 'positiv' : 'negativ');
  let state: ReactNode;
  switch (trend) {
    case 'ro':
      state = (
        <>
          <strong>Bilen står i ro.</strong> Både v og a er null, så s-t-grafen er en vannrett linje, og alle merkene ligger på samme sted.
        </>
      );
      break;
    case 'konstant':
      state = (
        <>
          <strong>Konstant fart.</strong> Med a = 0 er v-t-grafen en vannrett linje (ikke skrå), og s-t-grafen er en rett linje med
          stigningstall v = {fmt(v, 1)} m/s. Merkene på veien ligger like langt fra hverandre, fordi bilen kjører like langt hvert sekund.
        </>
      );
      break;
    case 'starter':
      state = (
        <>
          <strong>Bilen starter fra ro.</strong> Farten er null akkurat nå, så tangenten i s-t-grafen er vannrett. Men akselerasjonen er a ={' '}
          {a}, så bilen begynner å kjøre i {dirName(m.a)} retning.
        </>
      );
      break;
    case 'snur':
      state = (
        <>
          <strong>Bilen snur akkurat nå.</strong> Farten er null, så tangenten i s-t-grafen er vannrett (et {m.a < 0 ? 'toppunkt' : 'bunnpunkt'}),
          og v-t-grafen krysser t-aksen. Men akselerasjonen er fortsatt a = {a}, så bilen blir ikke stående i ro: den begynner å rygge.
        </>
      );
      break;
    case 'øker':
      state =
        m.a < 0 ? (
          <>
            <strong>Bilen går fortere, selv om a er negativ.</strong> Både v og a er negative, så bilen kjører fortere og fortere i negativ
            retning. Negativ akselerasjon betyr altså ikke alltid at bilen bremser.
          </>
        ) : (
          <>
            <strong>Bilen går fortere</strong> fordi v og a har samme fortegn. s-t-grafen blir brattere og brattere, og avstanden mellom
            merkene på veien blir større for hvert sekund.
          </>
        );
      break;
    case 'avtar':
      state =
        m.a < 0 ? (
          <>
            <strong>Bilen bremser</strong> fordi v og a har motsatt fortegn, og bremselysene lyser. v-t-grafen går nedover, men bilen kjører
            fortsatt i positiv retning så lenge v er positiv: grafen viser farten, ikke hvor bilen er. Merkene på veien kommer tettere og
            tettere.
          </>
        ) : (
          <>
            <strong>Bilen bremser, selv om a er positiv.</strong> Bilen kjører i negativ retning (v &lt; 0), og akselerasjonen peker motsatt
            vei. Det er fortegnet til v sammenlignet med a som avgjør om bilen går fortere eller saktere.
          </>
        );
      break;
  }
  const facing = facingDirection(m);
  const reversing = trend !== 'snur' && isReversing(m, t);
  const turned = tt !== null && tt < t - 0.05;
  return (
    <p>
      {state}
      {reversing && (
        <>
          {' '}
          Fronten på bilen peker i {dirName(facing)} retning, men v er {dirName(-facing)}: bilen rygger.
        </>
      )}{' '}
      Arealet under v-t-grafen fra 0 til t er forflytningen Δs = {fmt(ds, 1)} m.
      {turned && (
        <>
          {' '}
          Areal under t-aksen teller negativt, så forflytningen er mindre i tallverdi enn strekningen bilen faktisk har kjørt,{' '}
          {fmt(dist, 1)} m. Det er derfor tripptelleren i en bil viser strekningen og ikke forflytningen: den teller opp også når bilen
          rygger.
        </>
      )}
    </p>
  );
}
