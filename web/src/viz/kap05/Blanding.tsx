import { useEffect, useState, type ReactNode } from 'react';
import {
  Arrow,
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
  Toolbar,
  VIZ,
  VizLayout,
  fmt,
  linePath,
  sample,
  useSimClock,
  useTextScale,
} from '../kit';
import { MATERIALS, mixState, type MaterialId, type MixInput, type MixState } from './model';
import { ColorDot, Tag, Thermometer, useNarrow } from './marks';

type Mode = 'vann' | 'metall';
type Metal = Extract<MaterialId, 'aluminium' | 'jern' | 'kobber' | 'bly'>;

const MODES: { value: Mode; label: string }[] = [
  { value: 'vann', label: 'Varmt og kaldt vann' },
  { value: 'metall', label: 'Metallbit i vann' },
];
const METALS: { value: Metal; label: string }[] = (['aluminium', 'jern', 'kobber', 'bly'] as const).map((id) => ({ value: id, label: MATERIALS[id].name }));

const HOT = VIZ.series[1];
const COLD = VIZ.series[0];
const T_END = 40;
const C_WATER = MATERIALS.vann.c;

interface Body {
  m: number;
  T: number;
}

export default function Blanding() {
  const [mode, setMode] = useState<Mode>('vann');
  const [hotW, setHotW] = useState<Body>({ m: 0.5, T: 80 });
  const [coldW, setColdW] = useState<Body>({ m: 1, T: 20 });
  const [metal, setMetal] = useState<Metal>('jern');
  const [hotM, setHotM] = useState<Body>({ m: 0.5, T: 100 });
  const [coldM, setColdM] = useState<Body>({ m: 0.5, T: 20 });
  const clock = useSimClock({ tMax: T_END, speed: 4 });
  const { setT } = clock;
  useEffect(() => setT(5), [setT]);
  const [sceneRef, narrow] = useNarrow<HTMLDivElement>();

  const water = mode === 'vann';
  const hot = water ? hotW : hotM;
  const cold = water ? coldW : coldM;
  const setHot = water ? setHotW : setHotM;
  const setCold = water ? setColdW : setColdM;
  const c1 = water ? C_WATER : MATERIALS[metal].c;
  const input: MixInput = { c1, m1: hot.m, T1: hot.T, c2: C_WATER, m2: cold.m, T2: cold.T };
  const st = mixState(input, clock.t);
  const end = mixState(input, Infinity);
  const name1 = water ? 'Varmt vann' : MATERIALS[metal].name;
  const name2 = water ? 'Kaldt vann' : 'Vann';
  const graphH = narrow ? 440 : 330;

  return (
    <VizLayout>
      <Toolbar>
        <Segmented label="Velg forsøk" options={MODES} value={mode} onChange={setMode} />
        {!water && <Segmented label="Velg metall" options={METALS} value={metal} onChange={setMetal} />}
      </Toolbar>
      <Controls>
        <Slider
          label={
            <>
              {water ? 'Varmt vann' : 'Metall'} m<Sub>1</Sub>
            </>
          }
          ariaLabel={water ? 'Masse varmt vann' : 'Masse metall'}
          value={hot.m}
          onChange={(m) => setHot({ ...hot, m })}
          min={water ? 0.1 : 0.05}
          max={water ? 2 : 1}
          step={0.05}
          unit="kg"
          decimals={2}
        />
        <Slider
          label={
            <>
              {water ? 'Varmt vann' : 'Metall'} T<Sub>1</Sub>
            </>
          }
          ariaLabel={water ? 'Temperatur varmt vann' : 'Temperatur metall'}
          value={hot.T}
          onChange={(T) => setHot({ ...hot, T })}
          min={40}
          max={100}
          step={1}
          unit="°C"
        />
        <Slider
          label={
            <>
              {name2} m<Sub>2</Sub>
            </>
          }
          ariaLabel={`Masse ${name2.toLowerCase()}`}
          value={cold.m}
          onChange={(m) => setCold({ ...cold, m })}
          min={0.1}
          max={water ? 2 : 1}
          step={0.05}
          unit="kg"
          decimals={2}
        />
        <Slider
          label={
            <>
              {name2} T<Sub>2</Sub>
            </>
          }
          ariaLabel={`Temperatur ${name2.toLowerCase()}`}
          value={cold.T}
          onChange={(T) => setCold({ ...cold, T })}
          min={0}
          max={35}
          step={1}
          unit="°C"
        />
      </Controls>
      <Toolbar>
        <PlayControls clock={clock} decimals={1} />
      </Toolbar>

      <div ref={sceneRef}>
        <Figure
          viewBox={narrow ? '0 0 800 720' : '0 0 800 340'}
          label={`${name1} på ${fmt(hot.m, 2)} kg og ${fmt(hot.T, 0)} °C i kontakt med ${name2.toLowerCase()} på ${fmt(cold.m, 2)} kg og ${fmt(cold.T, 0)} °C. Sluttemperaturen blir ${fmt(end.Ts, 1)} °C.`}
          maxHeight={narrow ? 720 : 380}
        >
          <Bodies x0={0} w={narrow ? 800 : 540} st={st} hot={hot} cold={cold} metal={!water} name1={name1} name2={name2} />
          {narrow ? (
            <g transform="translate(0 340)">
              <EnergyBars x0={150} w={500} h={380} st={st} />
            </g>
          ) : (
            <EnergyBars x0={560} w={240} h={340} st={st} />
          )}
        </Figure>
      </div>

      <Figure viewBox={`0 0 800 ${graphH}`} label="Graf over temperaturene som funksjon av tiden">
        <MixGraph input={input} st={st} t={clock.t} height={graphH} />
      </Figure>
      <Legend
        items={[
          { color: HOT, label: `${name1}, T₁` },
          { color: COLD, label: `${name2}, T₂` },
          { color: VIZ.muted, label: 'Sluttemperatur', dashed: true },
        ]}
      />

      <Readouts>
        <Readout label="Sluttemperatur" value={fmt(end.Ts, 1)} unit="°C" />
        <Readout label={`Avgitt av ${name1.toLowerCase()}`} value={fmt(end.Qtotal / 1000, 1)} unit="kJ" tone={HOT} />
        <Readout label={`Mottatt av ${name2.toLowerCase()}`} value={fmt(end.Qtotal / 1000, 1)} unit="kJ" tone={COLD} />
        <Readout label="Temperaturendringer" value={`${fmt(end.Ts - hot.T, 1)} / +${fmt(end.Ts - cold.T, 1)}`} unit="K" />
      </Readouts>

      <Formula label="Energien som avgis, er lik energien som mottas">
        <FormulaLine>
          c<Sub>1</Sub>m<Sub>1</Sub>(T<Sub>1</Sub> − T) = c<Sub>2</Sub>m<Sub>2</Sub>(T − T<Sub>2</Sub>)
        </FormulaLine>
        <FormulaLine>
          c<Sub>1</Sub>m<Sub>1</Sub> = {fmt(c1, 0)} J/(kg·K) · {fmt(hot.m, 2)} kg = {fmt(c1 * hot.m, 0)} J/K, &nbsp; c<Sub>2</Sub>m<Sub>2</Sub> = {fmt(C_WATER, 0)}{' '}
          J/(kg·K) · {fmt(cold.m, 2)} kg = {fmt(C_WATER * cold.m, 0)} J/K
        </FormulaLine>
        <FormulaLine>
          T = ({fmt(c1 * hot.m, 0)} · {fmt(hot.T, 0)} + {fmt(C_WATER * cold.m, 0)} · {fmt(cold.T, 0)}) / ({fmt(c1 * hot.m, 0)} +{' '}
          {fmt(C_WATER * cold.m, 0)}) °C = {fmt(end.Ts, 1)} °C
        </FormulaLine>
      </Formula>

      <Explain>{explanation(input, end, water, name1, name2)}</Explain>
    </VizLayout>
  );
}

/** De to legemene med hvert sitt termometer, og energien Q som går fra det varme til det kalde. */
function Bodies({
  x0,
  w,
  st,
  hot,
  cold,
  metal,
  name1,
  name2,
}: {
  x0: number;
  w: number;
  st: MixState;
  hot: Body;
  cold: Body;
  metal: boolean;
  name1: string;
  name2: string;
}) {
  const f = useTextScale();
  const halfW = 0.17 * w;
  const cx1 = x0 + 0.22 * w;
  const cx2 = x0 + 0.78 * w;
  const top = 116;
  const bottom = 312;
  const gap = Math.max(1e-9, hot.T - cold.T);
  const flow = (st.T1 - st.T2) / gap;
  return (
    <g>
      <Vessel cx={cx1} halfW={halfW} top={top} bottom={bottom} fill={HOT} level={metal ? null : 0.25 + 0.35 * hot.m} T={st.T1} Ts={st.Ts} f={f} />
      <Vessel cx={cx2} halfW={halfW} top={top} bottom={bottom} fill={COLD} level={0.25 + (metal ? 0.7 : 0.35) * cold.m} T={st.T2} Ts={st.Ts} f={f} />
      <Tag x={cx1} y={34} color={HOT} weight={700}>
        {name1}
      </Tag>
      <Tag x={cx1} y={34 + 24 * f} muted>
        {fmt(hot.m, 2)} kg, {fmt(hot.T, 0)} °C
      </Tag>
      <Tag x={cx2} y={34} color={COLD} weight={700}>
        {name2}
      </Tag>
      <Tag x={cx2} y={34 + 24 * f} muted>
        {fmt(cold.m, 2)} kg, {fmt(cold.T, 0)} °C
      </Tag>
      {/* Energistrømmen er proporsjonal med temperaturforskjellen, så pila blir tynnere mot likevekt */}
      {flow > 0.01 ? (
        <Arrow x1={cx1 + halfW + 12} y1={214} x2={cx2 - halfW - 12} y2={214} color={VIZ.ink} width={2 + 10 * flow} head={16 + 14 * flow} />
      ) : null}
      <Tag x={(cx1 + cx2) / 2} y={214 - 14 - 6 * flow} weight={700}>
        Q
      </Tag>
      <Tag x={(cx1 + cx2) / 2} y={214 + 30 + 20 * (f - 1)} muted>
        {flow > 0.01 ? `${fmt(st.Q / 1000, 1)} kJ` : 'likevekt'}
      </Tag>
    </g>
  );
}

/** Beger med vann (level = andel fylt) eller en metallbit (level = null), med termometer. */
function Vessel({ cx, halfW, top, bottom, fill, level, T, Ts, f }: { cx: number; halfW: number; top: number; bottom: number; fill: string; level: number | null; T: number; Ts: number; f: number }) {
  const thermoX = cx + 0.62 * halfW;
  return (
    <g>
      {level === null ? (
        <rect x={cx - halfW} y={bottom - 120} width={2 * halfW} height={120} rx={8} fill={VIZ.bodyStrong} className="viz-block" />
      ) : (
        <>
          <rect x={cx - halfW + 3} y={bottom - level * (bottom - top)} width={2 * halfW - 6} height={level * (bottom - top) - 3} rx={4} fill={fill} opacity={0.22} />
          <path d={`M ${cx - halfW} ${top} V ${bottom} H ${cx + halfW} V ${top}`} fill="none" stroke={VIZ.muted} strokeWidth={3} strokeLinejoin="round" />
        </>
      )}
      <Thermometer x={thermoX} yTop={top - 30} yBottom={bottom - 44} min={0} max={100} value={T} color={fill} marker={Ts} />
      <Tag x={cx - 0.3 * halfW} y={bottom - 50} weight={700} size={22 * f}>
        {fmt(T, 1)} °C
      </Tag>
    </g>
  );
}

/** Søyler for energien som er avgitt og mottatt så langt. Stiplet omriss = all energien som overføres til slutt. */
function EnergyBars({ x0, w, h, st }: { x0: number; w: number; h: number; st: MixState }) {
  const f = useTextScale();
  const base = h - 18 - 22 * f;
  const topY = 34 + 56 * f;
  const k = (base - topY) / Math.max(1e-9, st.Qtotal);
  const bw = Math.min(70, w * 0.26);
  const bars = [
    { x: x0 + w * 0.3, color: HOT, label: 'avgitt' },
    { x: x0 + w * 0.7, color: COLD, label: 'mottatt' },
  ];
  return (
    <g>
      <Tag x={x0 + w / 2} y={34}>
        Energi Q (kJ)
      </Tag>
      <line x1={x0 + 10} x2={x0 + w - 10} y1={base} y2={base} stroke={VIZ.muted} strokeWidth={1.5} />
      {bars.map((b) => (
        <g key={b.label}>
          <rect x={b.x - bw / 2} y={base - st.Qtotal * k} width={bw} height={st.Qtotal * k} fill="none" stroke={b.color} strokeWidth={1.5} strokeDasharray="5 4" />
          <rect x={b.x - bw / 2} y={base - st.Q * k} width={bw} height={Math.max(1.5, st.Q * k)} rx={3} fill={b.color} />
          <Tag x={b.x} y={base - st.Q * k - 10}>
            {fmt(st.Q / 1000, 1)}
          </Tag>
          <Tag x={b.x} y={base + 22 * f} muted>
            {b.label}
          </Tag>
        </g>
      ))}
    </g>
  );
}

function MixGraph({ input, st, t, height }: { input: MixInput; st: MixState; t: number; height: number }) {
  const f = useTextScale();
  const T1 = sample((x) => mixState(input, x).T1, 0, T_END, 160);
  const T2 = sample((x) => mixState(input, x).T2, 0, T_END, 160);
  return (
    <Plot x={{ min: 0, max: T_END, label: 'Tid t (s)' }} y={{ min: 0, max: 100, label: 'Temperatur (°C)', ticks: [0, 20, 40, 60, 80, 100] }} width={800} height={height}>
      {({ sx, sy, x0, x1, y0 }) => {
        const tsY = sy(st.Ts);
        // Etiketten for sluttemperaturen står over linja, eller under når kurven for T₁ er i veien helt til høyre
        const labelY = tsY > sy(92) ? tsY - 12 : tsY + 26 * f;
        return (
          <g>
            <line x1={x0} x2={x1} y1={tsY} y2={tsY} stroke={VIZ.muted} strokeWidth={1.5} strokeDasharray="6 5" />
            <Tag x={x1 - 8} y={labelY} anchor="end" muted>
              T = {fmt(st.Ts, 1)} °C
            </Tag>
            <path d={linePath(T1, sx, sy)} fill="none" stroke={HOT} strokeWidth={3.5} />
            <path d={linePath(T2, sx, sy)} fill="none" stroke={COLD} strokeWidth={3.5} />
            <line x1={sx(t)} x2={sx(t)} y1={y0} y2={sy(100)} stroke={VIZ.ink} strokeWidth={1.5} opacity={0.5} />
            <ColorDot x={sx(t)} y={sy(st.T1)} r={8} color={HOT} />
            <ColorDot x={sx(t)} y={sy(st.T2)} r={8} color={COLD} />
          </g>
        );
      }}
    </Plot>
  );
}

function explanation(input: MixInput, end: MixState, water: boolean, name1: string, name2: string): ReactNode {
  const C1 = input.c1 * input.m1;
  const C2 = input.c2 * input.m2;
  const d1 = input.T1 - end.Ts;
  const d2 = end.Ts - input.T2;
  const first = (
    <p>
      <strong>Energien går fra varmt til kaldt.</strong> {name1} avgir Q = {fmt(end.Qtotal / 1000, 1)} kJ, og{' '}
      {name2.toLowerCase()} mottar like mye (energien er bevart når vi ser bort fra varmetap). Overføringen stopper i termisk likevekt
      ved {fmt(end.Ts, 1)} °C. Varme er energien som overføres, ikke noe et legeme har.
    </p>
  );
  let second: ReactNode;
  if (Math.abs(C1 - C2) / C2 < 0.02) {
    second = (
      <p>
        Med like stor c·m for begge ender temperaturen midt mellom: ({fmt(input.T1, 0)} °C + {fmt(input.T2, 0)} °C)/2 ={' '}
        {fmt((input.T1 + input.T2) / 2, 1)} °C.
      </p>
    );
  } else if (water) {
    const avg = (input.T1 + input.T2) / 2;
    const bigger = C1 > C2 ? 'varme' : 'kalde';
    second = (
      <p>
        Sluttemperaturen er ikke gjennomsnittet ({fmt(avg, 1)} °C). Det er {fmt(Math.max(C1, C2) / Math.min(C1, C2), 1)} ganger så mye{' '}
        {bigger} vann, og den største vannmengden trenger minst temperaturendring for den samme energien: {fmt(d1, 1)} K mot{' '}
        {fmt(d2, 1)} K.
      </p>
    );
  } else {
    second = (
      <p>
        {name1} avkjøles {fmt(d1, 1)} K, mens vannet bare blir {fmt(d2, 1)} K varmere, fordi c·m er {fmt(C1, 0)} J/K for metallet mot{' '}
        {fmt(C2, 0)} J/K for vannet. Måler vi sluttemperaturen, kan vi regne ut c for metallet på denne måten.
      </p>
    );
  }
  return (
    <>
      {first}
      {second}
    </>
  );
}
