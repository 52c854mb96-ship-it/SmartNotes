import { useEffect, useState, type ReactNode } from 'react';
import {
  Arrow,
  Controls,
  Explain,
  Figure,
  Formula,
  FormulaLine,
  Readout,
  Readouts,
  Segmented,
  Slider,
  Toolbar,
  VIZ,
  VizLayout,
  fmt,
  useSimClock,
  useTextScale,
} from '../kit';
import { AIR_HEAT_CAPACITY, firstLaw, temperatureAfter } from './model';
import { PlayToggle, Tag, Thermometer, useGasSim, useNarrow } from './marks';

type Preset = 'oppvarming' | 'kompresjon' | 'utvidelse' | 'isoterm';

const PRESETS: { value: Preset; label: string; W: number; Q: number }[] = [
  { value: 'oppvarming', label: 'Oppvarming', W: 0, Q: 600 },
  { value: 'kompresjon', label: 'Kompresjon', W: 600, Q: 0 },
  { value: 'utvidelse', label: 'Utvidelse', W: -600, Q: 0 },
  { value: 'isoterm', label: 'Varme inn, arbeid ut', W: -600, Q: 600 },
];

const COLOR_W = VIZ.series[0];
const COLOR_Q = VIZ.series[1];
const COLOR_U = VIZ.series[3];
/** Starttemperatur (K). */
const T0 = 293;
/** Lengden på prosessen i animasjonen (s). */
const T_ANIM = 3;
/** Piksler per joule for pilene (W og Q i samme skala). */
const PX_PER_J = 0.12;
/** Hvor langt stempelet flyttes per joule arbeid (bare en skisse). */
const PISTON_PER_J = 0.05;

const signed = (v: number, d = 0) => (Math.abs(v) < 0.5 * 10 ** -d ? fmt(0, d) : v > 0 ? `+${fmt(v, d)}` : fmt(v, d));

export default function ForsteLov() {
  const [W, setW] = useState(500);
  const [Q, setQ] = useState(-200);
  const clock = useSimClock({ tMax: T_ANIM });
  const { setT } = clock;
  // Vis sluttilstanden når siden åpnes; «Spill av» viser prosessen fra start.
  useEffect(() => setT(T_ANIM), [setT]);
  const [sceneRef, narrow] = useNarrow<HTMLDivElement>();

  const p = Math.min(1, clock.t / T_ANIM);
  const dU = firstLaw(W, Q);
  const T1 = temperatureAfter(T0, dU);
  const Tnow = temperatureAfter(T0, p * dU);
  const sceneLabel = `Gass i en sylinder med stempel. Arbeid på gassen ${signed(W)} joule, tilført varme ${signed(Q)} joule, endring i indre energi ${signed(dU)} joule.`;
  const preset = PRESETS.find((x) => x.W === W && x.Q === Q)?.value ?? ('egen' as Preset);

  const choose = (v: Preset) => {
    const x = PRESETS.find((y) => y.value === v);
    if (!x) return;
    setW(x.W);
    setQ(x.Q);
    setT(T_ANIM);
  };

  return (
    <VizLayout>
      <Toolbar>
        <Segmented label="Velg en prosess" options={PRESETS} value={preset} onChange={choose} />
      </Toolbar>
      <Controls>
        <Slider label="Arbeid på gassen W" value={W} onChange={setW} min={-1000} max={1000} step={50} format={(v) => `${signed(v)} J`} />
        <Slider label="Tilført varme Q" value={Q} onChange={setQ} min={-1000} max={1000} step={50} format={(v) => `${signed(v)} J`} />
      </Controls>
      <Toolbar>
        <PlayToggle clock={clock} resetLabel="Til start" />
      </Toolbar>

      {/* På smale skjermer får sylinderen og søylene hver sin figur, så begge blir store nok */}
      <div ref={sceneRef} style={{ display: 'grid', gap: 12 }}>
        {narrow ? (
          <>
            <Figure viewBox="0 0 545 470" label={sceneLabel} maxHeight={520}>
              <Cylinder cx={260} thermoX={50} t={clock.t} p={p} W={W} Q={Q} T={Tnow} />
            </Figure>
            <Figure viewBox="0 0 800 440" label="Søylediagram: W pluss Q er lik ΔU">
              <Waterfall x0={40} w={720} h={440} W={W} Q={Q} p={p} />
            </Figure>
          </>
        ) : (
          <Figure viewBox="0 0 800 470" label={sceneLabel} maxHeight={470}>
            <Cylinder cx={230} thermoX={50} t={clock.t} p={p} W={W} Q={Q} T={Tnow} />
            <Waterfall x0={470} w={320} h={470} W={W} Q={Q} p={p} />
          </Figure>
        )}
      </div>

      <Readouts>
        <Readout label="Arbeid på gassen W" value={signed(W)} unit="J" tone={COLOR_W} />
        <Readout label="Tilført varme Q" value={signed(Q)} unit="J" tone={COLOR_Q} />
        <Readout label="Endring i indre energi ΔU" value={signed(dU)} unit="J" tone={COLOR_U} />
        <Readout label="Temperatur etter" value={fmt(T1, 0)} unit="K" />
      </Readouts>

      <Formula label="Termofysikkens første lov">
        <FormulaLine>
          ΔU = W + Q = ({signed(W)} J) + ({signed(Q)} J) = {signed(dU)} J
        </FormulaLine>
        <FormulaLine>
          ΔT = ΔU / C = {signed(dU)} J / {fmt(AIR_HEAT_CAPACITY, 1)} J/K = {signed(T1 - T0, 1)} K, &nbsp;så T = {fmt(T1, 0)} K &nbsp;(C for
          1,0 mol luft)
        </FormulaLine>
      </Formula>

      <Explain>{explanation(W, Q, dU, T1)}</Explain>
    </VizLayout>
  );
}

function Cylinder({ cx, thermoX, t, p, W, Q, T }: { cx: number; thermoX: number; t: number; p: number; W: number; Q: number; T: number }) {
  const f = useTextScale();
  const half = 110;
  const wall = 8;
  const top = 60;
  const bottom = 360;
  const pistonH = 20;
  const y0 = 190;
  const yp = y0 + PISTON_PER_J * W * p;
  const gasTop = yp + pistonH;
  const gasLeft = cx - half + wall;
  const gasW = 2 * (half - wall);
  const gasH = bottom - wall - gasTop;
  const r = f > 1.3 ? 8 : 6;
  const sim = useGasSim(t * 0.6, {
    count: 26,
    seed: 77,
    speed: 100,
    scale: Math.sqrt(Math.max(0, T) / T0),
    width: gasW - 2 * r,
    height: gasH - 2 * r,
  });
  const wLen = Math.abs(W) * PX_PER_J;
  const qLen = Math.abs(Q) * PX_PER_J;
  const wx = cx + 46;
  const plateY = 408;
  const qy = 400;
  return (
    <g>
      <Thermometer
        x={thermoX}
        yTop={90}
        yBottom={346}
        min={150}
        max={450}
        value={T}
        color={VIZ.series[1]}
        right={[200, 300, 400].map((v) => ({ value: v, label: `${v} K` }))}
      />

      {/* Gassen og partiklene */}
      <rect x={gasLeft} y={gasTop} width={gasW} height={gasH} fill={COLOR_U} opacity={0.08} />
      {sim.particles.map((pt, i) => (
        <circle key={i} cx={gasLeft + r + pt.u * (gasW - 2 * r)} cy={gasTop + r + pt.w * (gasH - 2 * r)} r={r} fill={COLOR_U} />
      ))}

      <Tag x={cx - 16} y={top - 18} anchor="end" muted>
        1,0 mol luft
      </Tag>

      {/* Sylinder med åpen topp */}
      <path
        d={`M ${cx - half + wall / 2} ${top} V ${bottom - wall / 2} H ${cx + half - wall / 2} V ${top}`}
        fill="none"
        stroke={VIZ.muted}
        strokeWidth={wall}
        strokeLinejoin="round"
        opacity={0.6}
      />
      {Math.abs(W) > 1 && (
        <>
          <line x1={cx - half + wall} x2={cx + half - wall} y1={y0 + pistonH / 2} y2={y0 + pistonH / 2} className="viz-guide" />
          <Tag x={cx - half + wall + 8} y={y0 + pistonH / 2 - 8} anchor="start" muted>
            før
          </Tag>
        </>
      )}
      <rect x={cx - half + wall} y={yp} width={gasW} height={pistonH} rx={3} fill={VIZ.bodyStrong} className="viz-block" />
      <rect x={cx - 7} y={20} width={14} height={yp - 20} fill={VIZ.body} className="viz-block" />

      {/* Arbeid: kraft inn på stempelet (W > 0) eller gassen som skyver stempelet ut (W < 0) */}
      {wLen > 2 &&
        (W > 0 ? (
          <Arrow x1={wx} y1={yp - 6 - wLen} x2={wx} y2={yp - 6} color={COLOR_W} width={5} head={16} />
        ) : (
          <Arrow x1={wx} y1={yp - 6} x2={wx} y2={yp - 6 - wLen} color={COLOR_W} width={5} head={16} />
        ))}
      <Tag x={wx + 16} y={Math.max(30 + 10 * f, yp - 14 - (W > 0 ? wLen / 2 : 0))} anchor="start" color={COLOR_W}>
        W = {signed(W)} J
      </Tag>

      {/* Varme gjennom bunnen */}
      <rect
        x={cx - half}
        y={plateY}
        width={2 * half}
        height={12}
        rx={4}
        fill={Q > 0 ? VIZ.series[4] : Q < 0 ? VIZ.series[0] : VIZ.bodyStrong}
        opacity={Q === 0 ? 1 : 0.85}
      />
      {qLen > 2 &&
        [-60, 0, 60].map((dx) =>
          Q > 0 ? (
            <Arrow key={dx} x1={cx + dx} y1={qy} x2={cx + dx} y2={qy - qLen} color={COLOR_Q} width={5} head={16} />
          ) : (
            <Arrow key={dx} x1={cx + dx} y1={qy - qLen} x2={cx + dx} y2={qy} color={COLOR_Q} width={5} head={16} />
          ),
        )}
      <Tag x={cx + half + 14} y={bottom + 4} anchor="start" color={COLOR_Q}>
        Q = {signed(Q)} J
      </Tag>
      <Tag x={cx} y={plateY + 12 + 22 * f} muted>
        {Q > 0 ? 'varmeplate' : Q < 0 ? 'kald plate' : 'isolert bunn'}
      </Tag>
    </g>
  );
}

/** Fossefallsdiagram: W, så Q oppå, og summen ΔU = W + Q. Stiplet omriss = hele prosessen. */
function Waterfall({ x0, w, h, W, Q, p }: { x0: number; w: number; h: number; W: number; Q: number; p: number }) {
  const f = useTextScale();
  const dU = W + Q;
  let lo = Math.min(0, W, dU);
  let hi = Math.max(0, W, dU);
  const span = Math.max(hi - lo, 500);
  const extra = span - (hi - lo);
  if (hi > 0 && lo < 0) {
    hi += extra / 2;
    lo -= extra / 2;
  } else if (lo < 0) lo -= extra;
  else hi += extra;
  const plotTop = 40 + 30 * f;
  const plotBottom = h - 26 - 30 * f - 26 * f;
  const k = (plotBottom - plotTop) / span;
  const sy = (v: number) => plotTop + (hi - v) * k;
  const zero = sy(0);
  const bw = Math.min(72, w * 0.2);
  const cols = [0.2, 0.5, 0.8].map((c) => x0 + c * w);
  const bars = [
    { from: 0, to: W, color: COLOR_W, name: 'W' },
    { from: W, to: dU, color: COLOR_Q, name: '+ Q' },
    { from: 0, to: dU, color: COLOR_U, name: '= ΔU' },
  ];
  return (
    <g>
      <Tag x={x0 + w / 2} y={34}>
        Energi inn i gassen (J)
      </Tag>
      <line x1={x0} x2={x0 + w} y1={zero} y2={zero} stroke={VIZ.muted} strokeWidth={1.5} />
      {bars.map((b, i) => {
        const x = cols[i]!;
        const a = sy(b.from * p);
        const z = sy(b.to * p);
        const ga = sy(b.from);
        const gz = sy(b.to);
        const value = (b.to - b.from) * p;
        const up = b.to - b.from >= 0;
        const next = cols[i + 1];
        return (
          <g key={b.name}>
            <rect
              x={x - bw / 2}
              y={Math.min(ga, gz)}
              width={bw}
              height={Math.abs(gz - ga)}
              fill="none"
              stroke={b.color}
              strokeWidth={1.5}
              strokeDasharray="5 4"
            />
            <rect x={x - bw / 2} y={Math.min(a, z)} width={bw} height={Math.max(1.5, Math.abs(z - a))} rx={3} fill={b.color} />
            {/* Hjelpelinje fra enden av denne søyla til starten av den neste */}
            {i < 2 && next !== undefined && <line x1={x + bw / 2} x2={next - bw / 2} y1={z} y2={z} className="viz-guide" />}
            <Tag x={x} y={up ? Math.min(z, a) - 10 : Math.max(z, a) + 22 * f} color={b.color}>
              {signed(value)}
            </Tag>
            <Tag x={x} y={h - 16} weight={700}>
              {b.name}
            </Tag>
          </g>
        );
      })}
    </g>
  );
}

function explanation(W: number, Q: number, dU: number, T1: number): ReactNode {
  const wText =
    W > 0
      ? `Stempelet presses inn, så omgivelsene gjør arbeid på gassen: W = ${signed(W)} J.`
      : W < 0
        ? `Gassen utvider seg og skyver stempelet ut. Da gjør gassen arbeid på omgivelsene, så arbeidet på gassen er negativt: W = ${signed(W)} J.`
        : 'Stempelet står i ro, så det gjøres ikke noe arbeid: W = 0.';
  const qText =
    Q > 0
      ? `Gassen får tilført varme fra plata: Q = ${signed(Q)} J.`
      : Q < 0
        ? `Gassen avgir varme til den kalde plata: Q = ${signed(Q)} J.`
        : 'Sylinderen er isolert, så ingen varme går inn eller ut: Q = 0.';
  let uText: string;
  if (W === 0 && Q === 0) uText = 'Ingen energi går inn eller ut, så den indre energien er uendret.';
  else if (dU > 0)
    uText = `Den indre energien øker med ΔU = W + Q = ${signed(dU)} J. I en gass er den indre energien bevegelsesenergien til partiklene, så de beveger seg raskere, og temperaturen stiger til ${fmt(T1, 0)} K.`;
  else if (dU < 0)
    uText = `Den indre energien minker med ${fmt(-dU, 0)} J (ΔU = W + Q = ${signed(dU)} J). Partiklene beveger seg langsommere, og temperaturen synker til ${fmt(T1, 0)} K.`;
  else uText = 'Det som kommer inn som den ene formen, går ut som den andre: ΔU = 0, og temperaturen er uendret.';
  let example = '';
  if (Q === 0 && W > 0) example = ' Slik blir en sykkelpumpe varm når du pumper raskt.';
  if (Q === 0 && W < 0) example = ' Slik avkjøles luft som stiger og utvider seg i atmosfæren.';
  if (W === 0 && Q > 0) example = ' Med fast volum går all varmen til indre energi.';
  return (
    <>
      <p>
        <strong>W og Q er positive når energi går inn i gassen.</strong> {wText} {qText}
      </p>
      <p>
        {uText}
        {example}
      </p>
    </>
  );
}
