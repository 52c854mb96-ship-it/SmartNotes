import { useState, type ReactNode } from 'react';
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
  Segmented,
  Slider,
  Sub,
  TSub,
  Toggle,
  Toolbar,
  VIZ,
  VizLayout,
  fmt,
  niceTicks,
  scaleLinear,
  useSimClock,
  useTextScale,
} from '../../kit';
import { BRAKE_PRESETS, kmhToMs, niceRange, stopPosition, stopVelocity, stopping, type StopInput, type StopResult } from './model';
import { useNarrow } from './useNarrow';
import { ColorDot, Label } from './marks';

type Surface = 'torr' | 'vat' | 'is' | 'egen';

const SURFACES: { value: Surface; label: string }[] = [
  { value: 'torr', label: 'Tørr asfalt' },
  { value: 'vat', label: 'Våt asfalt' },
  { value: 'is', label: 'Is' },
];

const C_REACT = VIZ.series[0];
const C_BRAKE = VIZ.series[1];

/** Halv fart som tekst, med desimal når farten er et oddetall (25 km/h → «12,5 km/h»). */
const halfText = (kmh: number): string => `${fmt(kmh / 2, kmh % 2 === 0 ? 0 : 1)} km/h`;

function surfaceOf(a: number): Surface {
  if (a === BRAKE_PRESETS.torr) return 'torr';
  if (a === BRAKE_PRESETS.vat) return 'vat';
  if (a === BRAKE_PRESETS.is) return 'is';
  return 'egen';
}

export default function Bremselengde() {
  const [kmh, setKmh] = useState(80);
  const [tr, setTr] = useState(1.0);
  const [a, setA] = useState<number>(BRAKE_PRESETS.torr);
  const [compare, setCompare] = useState(true);
  const { ref, narrow } = useNarrow();

  const main: StopInput = { v0: kmhToMs(kmh), tr, a };
  const half: StopInput = { v0: main.v0 / 2, tr, a };
  const r = stopping(main);
  const rh = stopping(half);
  const clock = useSimClock({ tMax: r.tStop });
  const t = Math.min(clock.t, r.tStop);

  return (
    <VizLayout>
      <Controls>
        <Slider label="Fart" value={kmh} onChange={setKmh} min={20} max={130} step={5} unit="km/h" decimals={0} />
        <Slider
          label={
            <>
              Reaksjonstid t<Sub>r</Sub>
            </>
          }
          ariaLabel="Reaksjonstid"
          value={tr}
          onChange={setTr}
          min={0.5}
          max={2.5}
          step={0.1}
          unit="s"
          decimals={1}
        />
        <Slider label="Bremseakselerasjon a" value={a} onChange={setA} min={1} max={10} step={0.5} unit="m/s²" decimals={1} />
      </Controls>
      <Toolbar>
        <Segmented
          label="Velg underlag"
          options={SURFACES}
          value={surfaceOf(a)}
          onChange={(s) => {
            if (s !== 'egen') setA(BRAKE_PRESETS[s]);
          }}
        />
        <Toggle label={`Sammenlign med halv fart (${halfText(kmh)})`} checked={compare} onChange={setCompare} />
      </Toolbar>
      <Toolbar>
        <PlayControls clock={clock} />
      </Toolbar>

      <div ref={ref}>
        <Figure
          viewBox={`0 0 800 ${roadHeight(narrow, compare)}`}
          label={`Vei sett fra siden. Bilen kjører i ${fmt(kmh, 0)} km/h og stopper etter ${fmt(r.total, 1)} m: ${fmt(r.sr, 1)} m reaksjonslengde og ${fmt(r.sb, 1)} m bremselengde.`}
          maxHeight={narrow ? 420 : 300}
        >
          <Road main={main} r={r} half={compare ? half : null} rh={rh} t={t} kmh={kmh} narrow={narrow} />
        </Figure>
      </div>

      <Figure
        viewBox={`0 0 800 ${narrow ? 520 : 360}`}
        label="Fart-tid-graf for oppbremsingen: et rektangel for reaksjonstiden og en trekant for bremsingen."
        maxHeight={narrow ? 560 : 400}
      >
        <SpeedGraph main={main} r={r} half={compare ? half : null} rh={rh} t={t} height={narrow ? 520 : 360} />
      </Figure>
      <Legend
        items={[
          { color: C_REACT, label: 'Reaksjonslengde (konstant fart)' },
          { color: C_BRAKE, label: 'Bremselengde (farten avtar)' },
          ...(compare ? [{ color: VIZ.velocity, label: `Halv fart, ${halfText(kmh)}`, dashed: true }] : []),
        ]}
      />

      <Readouts>
        <Readout
          label={
            <>
              Fart v<Sub>0</Sub>
            </>
          }
          value={fmt(main.v0, 1)}
          unit="m/s"
          tone={VIZ.velocity}
        />
        <Readout
          label={
            <>
              Reaksjonslengde s<Sub>r</Sub>
            </>
          }
          value={fmt(r.sr, 1)}
          unit="m"
          tone={C_REACT}
        />
        <Readout
          label={
            <>
              Bremselengde s<Sub>b</Sub>
            </>
          }
          value={fmt(r.sb, 1)}
          unit="m"
          tone={C_BRAKE}
        />
        <Readout label="Stopplengde" value={fmt(r.total, 1)} unit="m" />
      </Readouts>

      <Formula label="Utregning av reaksjonslengde og bremselengde">
        <FormulaLine>
          v<Sub>0</Sub> = {fmt(kmh, 0)} km/h : 3,6 = {fmt(main.v0, 1)} m/s
        </FormulaLine>
        <FormulaLine>
          s<Sub>r</Sub> = v<Sub>0</Sub> · t<Sub>r</Sub> = {fmt(main.v0, 1)} m/s · {fmt(tr, 1)} s = {fmt(r.sr, 1)} m
        </FormulaLine>
        <FormulaLine>
          Bremsing: v² − v<Sub>0</Sub>² = 2 · (−a) · s<Sub>b</Sub> med v = 0 gir s<Sub>b</Sub> = v<Sub>0</Sub>² / (2a)
        </FormulaLine>
        <FormulaLine>
          s<Sub>b</Sub> = ({fmt(main.v0, 1)} m/s)² / (2 · {fmt(a, 1)} m/s²) = {fmt(r.sb, 1)} m
        </FormulaLine>
      </Formula>

      <Explain>{explanation(kmh, tr, a, r, rh, compare)}</Explain>
    </VizLayout>
  );
}

/* ---------- Veien ---------- */

function roadHeight(narrow: boolean, compare: boolean): number {
  if (compare) return narrow ? 374 : 258;
  return narrow ? 202 : 142;
}

function Road({
  main,
  r,
  half,
  rh,
  t,
  kmh,
  narrow,
}: {
  main: StopInput;
  r: StopResult;
  half: StopInput | null;
  rh: StopResult;
  t: number;
  kmh: number;
  narrow: boolean;
}) {
  const f = useTextScale();
  const H = roadHeight(narrow, half !== null);
  const [, dMax] = niceRange(0, r.total, 5, 10);
  // Plass til bilen (som står bak 0 m ved start) og den siste akseverdien («200 m»), også med stor tekst og bil på mobil
  const xs = scaleLinear([0, dMax], narrow ? [92, 730] : [70, 760]);
  const ticks = niceTicks(0, dMax, narrow ? 4 : 6);
  const axisY = H - 10;
  // Større bil og tykkere stolper på mobil, der figuren skaleres ned
  const k = narrow ? 1.5 : 1;
  const laneH = 34 + 40 * k + 42 * f;
  const lanes = [{ input: main, res: r, label: `${fmt(kmh, 0)} km/h`, strong: true }];
  if (half) lanes.push({ input: half, res: rh, label: halfText(kmh), strong: false });

  return (
    <g>
      {ticks.map((d) => (
        <g key={d}>
          <line x1={xs(d)} x2={xs(d)} y1={8} y2={axisY - 18 * f} className="viz-gridline" />
          <text x={xs(d)} y={axisY} textAnchor="middle" className="viz-tick">
            {fmt(d, 0)} m
          </text>
        </g>
      ))}
      {lanes.map((lane, i) => {
        const top = 6 + i * laneH;
        const yLabel = top + 18 * f;
        const yRoad = yLabel + 8 + 32 * k;
        const pos = stopPosition(lane.input, t);
        const front = xs(pos);
        const xr = xs(lane.res.sr);
        const xe = xs(lane.res.total);
        const charW = 9.6 * f;
        const srText = `${fmt(lane.res.sr, 1)} m`;
        const sbText = `${fmt(lane.res.sb, 1)} m`;
        return (
          <g key={i}>
            <Label x={xs(0)} y={yLabel} anchor="start" muted={!lane.strong}>
              {lane.label}
            </Label>
            <line x1={20} x2={780} y1={yRoad} y2={yRoad} className="viz-ground" />
            <rect x={xs(0)} y={yRoad + 6} width={Math.max(0, xr - xs(0))} height={12 * k} fill={C_REACT} opacity={lane.strong ? 0.85 : 0.55} />
            <rect x={xr} y={yRoad + 6} width={Math.max(0, xe - xr)} height={12 * k} fill={C_BRAKE} opacity={lane.strong ? 0.85 : 0.55} />
            <line x1={xe} x2={xe} y1={yRoad - 34 * k} y2={yRoad + 6 + 12 * k} stroke={VIZ.ink} strokeWidth={2} strokeDasharray="4 4" />
            {xr - xs(0) > srText.length * charW && (
              <text x={(xs(0) + xr) / 2} y={yRoad + 10 + 12 * k + 14 * f} textAnchor="middle" className="viz-tick" style={{ fill: C_REACT }}>
                {srText}
              </text>
            )}
            {xe - xr > sbText.length * charW && (
              <text x={(xr + xe) / 2} y={yRoad + 10 + 12 * k + 14 * f} textAnchor="middle" className="viz-tick" style={{ fill: C_BRAKE }}>
                {sbText}
              </text>
            )}
            <Car front={front} y={yRoad} strong={lane.strong} k={k} />
          </g>
        );
      })}
    </g>
  );
}

function Car({ front, y, strong, k }: { front: number; y: number; strong: boolean; k: number }) {
  const fill = strong ? VIZ.bodyStrong : VIZ.body;
  return (
    <g transform={`translate(${front} ${y}) scale(${k}) translate(${-front} ${-y})`}>
      <CarShape front={front} y={y} fill={fill} />
    </g>
  );
}

function CarShape({ front, y, fill }: { front: number; y: number; fill: string }) {
  const L = 54;
  const x = front - L;
  return (
    <g>
      <path
        d={`M${x + 2},${y - 9} L${x + 2},${y - 20} L${x + 12},${y - 22} L${x + 18},${y - 32} L${x + 38},${y - 32} L${x + 46},${y - 22} L${x + L - 1},${y - 19} L${x + L - 1},${y - 9} Z`}
        fill={fill}
        className="viz-block"
      />
      <circle cx={x + 13} cy={y - 7} r={6.5} fill={VIZ.muted} />
      <circle cx={x + 42} cy={y - 7} r={6.5} fill={VIZ.muted} />
    </g>
  );
}

/* ---------- v-t-graf ---------- */

function SpeedGraph({
  main,
  r,
  half,
  rh,
  t,
  height,
}: {
  main: StopInput;
  r: StopResult;
  half: StopInput | null;
  rh: StopResult;
  t: number;
  height: number;
}) {
  const f = useTextScale();
  const [, tMax] = niceRange(0, r.tStop, 5, 1);
  const [, vMax] = niceRange(0, main.v0 * 1.08, 4, 5);
  return (
    <Plot x={{ min: 0, max: tMax, label: 'Tid etter at faren oppdages (s)', decimals: tMax < 4 ? 1 : 0 }} y={{ min: 0, max: vMax, label: 'v (m/s)' }} width={800} height={height}>
      {({ sx, sy, y0 }) => {
        const rectW = sx(main.tr) - sx(0);
        const rectH = sy(0) - sy(main.v0);
        const triW = sx(r.tStop) - sx(main.tr);
        // Med sammenligningen på går den stiplede grafen under v₀/2, så etiketten for s_b legges over v₀/2,
        // til venstre for den skrå linja.
        let brake = { x: sx(main.tr) + triW * 0.26, y: sy(main.v0 * 0.42) + 6, w: triW * 0.5, h: rectH / 3 };
        if (half) {
          const y = sy(main.v0 * 0.5) - 10;
          const vTop = main.v0 * Math.min(1, (sy(0) - (y - 14 * f)) / rectH);
          const xDiag = sx(main.tr) + triW * (1 - vTop / main.v0);
          brake = { x: (sx(main.tr) + xDiag) / 2, y, w: xDiag - sx(main.tr) - 16, h: rectH / 2 - 10 };
        }
        return (
          <g>
            <rect x={sx(0)} y={sy(main.v0)} width={rectW} height={rectH} fill={C_REACT} opacity={0.26} />
            <path d={`M${sx(main.tr)},${sy(0)} L${sx(main.tr)},${sy(main.v0)} L${sx(r.tStop)},${sy(0)} Z`} fill={C_BRAKE} opacity={0.26} />
            <polyline
              points={`${sx(0)},${sy(main.v0)} ${sx(main.tr)},${sy(main.v0)} ${sx(r.tStop)},${sy(0)}`}
              fill="none"
              stroke={VIZ.ink}
              strokeWidth={3}
              strokeLinejoin="round"
            />
            {/* Etikettene ligger der den stiplede grafen for halv fart ikke går */}
            <AreaLabel x={sx(0) + rectW / 2} y={sy(main.v0 * 0.75) + 6} w={rectW} h={rectH / 2} color={C_REACT} sub="r" value={r.sr} f={f} />
            <AreaLabel {...brake} color={C_BRAKE} sub="b" value={r.sb} f={f} />
            {half && (
              <polyline
                points={`${sx(0)},${sy(half.v0)} ${sx(half.tr)},${sy(half.v0)} ${sx(rh.tStop)},${sy(0)}`}
                fill="none"
                stroke={VIZ.velocity}
                strokeWidth={2.5}
                strokeDasharray="7 6"
                strokeLinejoin="round"
              />
            )}
            {t > 0 && <line x1={sx(t)} x2={sx(t)} y1={sy(vMax)} y2={y0} className="viz-guide" />}
            {half && t > 0 && <ColorDot x={sx(t)} y={sy(stopVelocity(half, t))} color={VIZ.velocity} r={6} />}
            <ColorDot x={sx(t)} y={sy(stopVelocity(main, t))} color={VIZ.ink} />
          </g>
        );
      }}
    </Plot>
  );
}

/** «s_r = 22,2 m» i et område av grafen, eller bare «s_r» når det er trangt. */
function AreaLabel({ x, y, w, h, color, sub, value, f }: { x: number; y: number; w: number; h: number; color: string; sub: string; value: number; f: number }) {
  if (h < 24 * f) return null;
  const long = `s${sub} = ${fmt(value, 1)} m`;
  if (w > long.length * 10 * f)
    return (
      <Label x={x} y={y} color={color}>
        s<TSub>{sub}</TSub> = {fmt(value, 1)} m
      </Label>
    );
  if (w < 3 * 10 * f) return null;
  return (
    <Label x={x} y={y} color={color}>
      s<TSub>{sub}</TSub>
    </Label>
  );
}

/* ---------- Forklaring ---------- */

function explanation(kmh: number, tr: number, a: number, r: StopResult, rh: StopResult, compare: boolean): ReactNode {
  const dryRatio = BRAKE_PRESETS.torr / a;
  const reactionShare = r.sr / r.total;
  return (
    <>
      <p>
        <strong>Reaksjonslengden er proporsjonal med farten, men bremselengden er proporsjonal med kvadratet av farten:</strong> dobbel fart gir
        fire ganger så lang bremselengde. Ved halv fart ({halfText(kmh)}) blir reaksjonslengden halvparten ({fmt(rh.sr, 1)} m), men
        bremselengden bare en fjerdedel ({fmt(rh.sb, 1)} m).{' '}
        {compare
          ? 'I v-t-grafen ser du hvorfor: trekanten blir både halvparten så høy og halvparten så bred, så arealet blir en fjerdedel.'
          : 'Slå på sammenligningen med halv fart for å se hvorfor i v-t-grafen.'}
      </p>
      <p>
        {a < BRAKE_PRESETS.torr
          ? `Med bremseakselerasjon ${fmt(a, 1)} m/s² blir bremselengden ${fmt(dryRatio, 1)} ganger så lang som på tørr asfalt (8,0 m/s²).`
          : reactionShare > 0.5
            ? `Her er reaksjonslengden mer enn halvparten av stopplengden.${kmh <= 50 && tr < 1.8 ? ' Ved lav fart betyr reaksjonstiden mest.' : ''}`
            : `Her er bremselengden ${fmt(r.sb / r.sr, 1)} ganger så lang som reaksjonslengden.`}
        {tr >= 1.8 ? ` En reaksjonstid på ${fmt(tr, 1)} s er lang, og typisk når sjåføren er uoppmerksom, for eksempel ser på mobilen.` : ''}
      </p>
    </>
  );
}
