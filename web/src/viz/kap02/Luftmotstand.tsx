import { useEffect, useState, type ReactNode } from 'react';
import {
  Arrow,
  Controls,
  Dot,
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
  TSub,
  Toggle,
  Toolbar,
  VIZ,
  VizLayout,
  fmt,
  G_EARTH,
  linePath,
  sample,
  useSimClock,
  useTextScale,
} from '../kit';
import { dragFall, eulerFall, terminalVelocity } from './model';
import { useNarrow } from './useNarrow';

const T_END = 20;
const V_AXIS = 120;
const A_AXIS = 12;
const K_MIN = 0.12;
const K_MAX = 1;
const EULER_DT = 1;

export default function Luftmotstand() {
  const [m, setM] = useState(80);
  const [k, setK] = useState(0.25);
  const [compare, setCompare] = useState(true);
  const [euler, setEuler] = useState(false);
  const clock = useSimClock({ tMax: T_END, speed: 2 });
  const { setT, pause } = clock;
  // Vis et øyeblikk der både G og L er tydelige når siden åpnes.
  useEffect(() => setT(3), [setT]);

  const t = clock.t;
  const st = dragFall(m, k, t);
  const vT = terminalVelocity(m, k);
  const G = m * G_EARTH;
  const [graphRef, narrow] = useNarrow<HTMLDivElement>();
  const plotH = narrow ? 380 : 280;

  return (
    <VizLayout>
      <Controls>
        <Slider label="Masse m" value={m} onChange={setM} min={40} max={120} step={1} unit="kg" />
        <Slider
          label="Luftmotstandstall k"
          value={k}
          onChange={setK}
          min={K_MIN}
          max={K_MAX}
          step={0.01}
          format={(v) => `${fmt(v, 2)} kg/m`}
        />
        <Slider
          label="Tid t"
          value={t}
          onChange={(v) => {
            pause();
            setT(v);
          }}
          min={0}
          max={T_END}
          step={0.1}
          unit="s"
          decimals={1}
        />
      </Controls>
      <Toolbar>
        <PlayControls clock={clock} decimals={1} />
        <Toggle label="Sammenlign med fall uten luftmotstand" checked={compare} onChange={setCompare} />
        <Toggle label={`Vis Eulers metode (Δt = ${fmt(EULER_DT, 0)} s)`} checked={euler} onChange={setEuler} />
      </Toolbar>

      <Figure
        viewBox="0 0 800 310"
        label={`Fallskjermhopper på ${fmt(m, 0)} kg uten utløst skjerm. Etter ${fmt(t, 1)} s er farten ${fmt(st.v, 1)} m/s og luftmotstanden ${fmt(st.L, 0)} N.`}
        maxHeight={380}
      >
        <Scene k={k} v={st.v} a={st.a} s={st.s} L={st.L} G={G} vT={vT} t={t} />
      </Figure>

      <div ref={graphRef}>
        <Figure viewBox={`0 0 800 ${2 * plotH}`} label="Fartsgraf og akselerasjonsgraf for fallet" maxHeight={620}>
          <Graphs m={m} k={k} t={t} v={st.v} a={st.a} vT={vT} compare={compare} euler={euler} plotH={plotH} />
        </Figure>
      </div>
      <Legend
        items={[
          { color: VIZ.velocity, label: 'Fart v' },
          { color: VIZ.acceleration, label: 'Akselerasjon a' },
          ...(compare ? [{ color: VIZ.muted, label: 'Uten luftmotstand', dashed: true }] : []),
          ...(euler ? [{ color: VIZ.ink, label: `Eulers metode, Δt = ${fmt(EULER_DT, 0)} s` }] : []),
        ]}
      />

      <Readouts>
        <Readout label="Fart v" value={fmt(st.v, 1)} unit="m/s" tone={VIZ.velocity} />
        <Readout label="Akselerasjon a" value={fmt(st.a, 2)} unit="m/s²" tone={VIZ.acceleration} />
        <Readout label="Luftmotstand L" value={fmt(st.L, 0)} unit="N" tone={VIZ.friction} />
        <Readout
          label={
            <span>
              Terminalfart v<Sub>T</Sub> ({fmt(vT * 3.6, 0)} km/h)
            </span>
          }
          value={fmt(vT, 1)}
          unit="m/s"
        />
      </Readouts>

      <Formula label="Kreftene og akselerasjonen ved tiden t">
        <FormulaLine>
          L = k · v² = {fmt(k, 2)} kg/m · ({fmt(st.v, 1)} m/s)² = {fmt(st.L, 0)} N
        </FormulaLine>
        <FormulaLine>
          a = (G − L)/m = ({fmt(G, 0)} N − {fmt(st.L, 0)} N)/{fmt(m, 0)} kg = {fmt(st.a, 2)} m/s²
        </FormulaLine>
        <FormulaLine>
          L = G gir v<Sub>T</Sub> = √(mg/k) = √({fmt(m, 0)} kg · 9,81 m/s² / {fmt(k, 2)} kg/m) = {fmt(vT, 1)} m/s
        </FormulaLine>
      </Formula>

      <Explain>{explanation(t, st.v, st.a, st.L, G, vT, euler)}</Explain>
    </VizLayout>
  );
}

const CX = 260;
const CY = 158;
/** Lengden på G-pila i piksler. L tegnes i samme skala. */
const LG = 120;
/** Piksler per meter for fartsstripene i bakgrunnen. */
const STREAK_PX_PER_M = 2.5;
const STREAKS = [
  { x: 92, y: 40 },
  { x: 128, y: 200 },
  { x: 392, y: 120 },
  { x: 432, y: 270 },
];
const SCENE_H = 310;

function Scene({ k, v, a, s, L, G, vT, t }: { k: number; v: number; a: number; s: number; L: number; G: number; vT: number; t: number }) {
  const spread = (k - K_MIN) / (K_MAX - K_MIN);
  const lLen = (L / G) * LG;
  const V_X = 560;
  const A_X = 680;
  const TOP = 80;
  const SPAN = 206;
  const vLen = (v / V_AXIS) * SPAN;
  const aLen = (a / A_AXIS) * SPAN;
  const near = v >= 0.97 * vT;
  return (
    <>
      {/* Luft som suser forbi: stripene flytter seg oppover i takt med fallet */}
      {v > 0.5 &&
        STREAKS.map((p, i) => {
          const y = (((p.y - s * STREAK_PX_PER_M) % SCENE_H) + SCENE_H) % SCENE_H;
          const len = 18 + Math.min(60, v * 0.9);
          return <line key={i} x1={p.x} y1={y} x2={p.x} y2={y + len} stroke={VIZ.grid} strokeWidth={3} strokeLinecap="round" />;
        })}

      <Skydiver cx={CX} cy={CY} spread={spread} />
      <Arrow x1={CX} y1={CY} x2={CX} y2={CY + LG} color={VIZ.gravity} label="G" labelAnchor="start" labelX={CX + 14} labelY={CY + LG} />
      <Arrow
        x1={CX}
        y1={CY}
        x2={CX}
        y2={CY - lLen}
        color={VIZ.friction}
        label="L"
        labelAnchor="start"
        labelX={CX + 14}
        labelY={CY - lLen + 14}
        minLength={4}
      />

      {/* Fart og akselerasjon (begge nedover) */}
      <line
        x1={V_X - 16}
        y1={TOP + (vT / V_AXIS) * SPAN}
        x2={V_X + 16}
        y2={TOP + (vT / V_AXIS) * SPAN}
        stroke={VIZ.velocity}
        strokeWidth={2}
        strokeDasharray="4 4"
      />
      <Label x={V_X - 22} y={TOP + (vT / V_AXIS) * SPAN + 6} anchor="end" color={VIZ.velocity}>
        v<TSub>T</TSub>
      </Label>
      <line
        x1={A_X - 16}
        y1={TOP + (G_EARTH / A_AXIS) * SPAN}
        x2={A_X + 16}
        y2={TOP + (G_EARTH / A_AXIS) * SPAN}
        stroke={VIZ.acceleration}
        strokeWidth={2}
        strokeDasharray="4 4"
      />
      <Label x={A_X - 22} y={TOP + (G_EARTH / A_AXIS) * SPAN + 6} anchor="end" color={VIZ.acceleration}>
        g
      </Label>
      <circle cx={V_X} cy={TOP} r={4} fill={VIZ.velocity} />
      <circle cx={A_X} cy={TOP} r={4} fill={VIZ.acceleration} />
      {vLen >= 4 ? (
        <Arrow
          x1={V_X}
          y1={TOP}
          x2={V_X}
          y2={TOP + vLen}
          color={VIZ.velocity}
          label="v"
          labelAnchor="start"
          labelX={V_X + 14}
          labelY={TOP + vLen}
        />
      ) : (
        <Label x={V_X + 12} y={TOP + 6} anchor="start" color={VIZ.velocity}>
          v = 0
        </Label>
      )}
      {aLen >= 4 ? (
        <Arrow
          x1={A_X}
          y1={TOP}
          x2={A_X}
          y2={TOP + aLen}
          color={VIZ.acceleration}
          label="a"
          labelAnchor="start"
          labelX={A_X + 14}
          labelY={TOP + aLen}
        />
      ) : (
        <Label x={A_X + 12} y={TOP + 6} anchor="start" color={VIZ.acceleration}>
          a ≈ 0
        </Label>
      )}

      <Label x={780} y={30} anchor="end" muted>
        {t < 0.05 ? 'Hopperen slipper' : near ? 'L ≈ G: konstant fart' : 'Farten øker, L øker'}
      </Label>
    </>
  );
}

/** Fallskjermhopper sett fra siden, magen ned. `spread` (0–1) er hvor mye armer og bein er spredt ut. */
function Skydiver({ cx, cy, spread }: { cx: number; cy: number; spread: number }) {
  const angle = 10 + spread * 64; // grader over kroppsaksen
  const limb = (x: number, y: number, len: number, deg: number, w: number) => {
    const rad = (deg * Math.PI) / 180;
    const mx = x + (len / 2) * Math.cos(rad);
    const my = y - (len / 2) * Math.sin(rad);
    return (
      <rect
        x={mx - len / 2}
        y={my - w / 2}
        width={len}
        height={w}
        rx={w / 2}
        fill={VIZ.body}
        className="viz-block"
        transform={`rotate(${-deg} ${mx} ${my})`}
      />
    );
  };
  return (
    <g>
      {/* bein bakover (til venstre), armer fremover (til høyre) */}
      {limb(cx - 52, cy - 6, 84, 180 - angle, 20)}
      {limb(cx - 52, cy + 4, 80, 180 - angle * 0.75, 19)}
      {limb(cx + 40, cy - 6, 66, angle, 16)}
      {limb(cx + 40, cy + 4, 62, angle * 0.75, 15)}
      <rect x={cx - 70} y={cy - 22} width={134} height={44} rx={22} fill={VIZ.bodyStrong} className="viz-block" />
      <circle cx={cx + 84} cy={cy - 6} r={20} fill={VIZ.body} className="viz-block" />
    </g>
  );
}

function Graphs({
  m,
  k,
  t,
  v,
  a,
  vT,
  compare,
  euler,
  plotH,
}: {
  m: number;
  k: number;
  t: number;
  v: number;
  a: number;
  vT: number;
  compare: boolean;
  euler: boolean;
  plotH: number;
}) {
  const f = useTextScale();
  const sparse = f > 1.3;
  const vPts = sample((x) => dragFall(m, k, x).v, 0, T_END, 240);
  const aPts = sample((x) => dragFall(m, k, x).a, 0, T_END, 240);
  const ePts = euler ? eulerFall(m, k, EULER_DT, T_END) : [];
  const tFree = V_AXIS / G_EARTH;
  return (
    <>
      <Plot
        x={{ min: 0, max: T_END, label: 'Tid t (s)' }}
        y={{ min: 0, max: V_AXIS, label: 'Fart v (m/s)', ticks: sparse ? [0, 40, 80, 120] : [0, 20, 40, 60, 80, 100, 120] }}
        width={800}
        height={plotH}
      >
        {({ sx, sy, y0, y1, x1 }) => (
          <g>
            {compare && (
              <line x1={sx(0)} y1={sy(0)} x2={sx(tFree)} y2={sy(V_AXIS)} stroke={VIZ.muted} strokeWidth={2.5} strokeDasharray="7 6" />
            )}
            <line x1={sx(0)} y1={sy(vT)} x2={x1} y2={sy(vT)} stroke={VIZ.velocity} strokeWidth={1.5} strokeDasharray="4 5" opacity={0.8} />
            <Label x={x1 - 6} y={sy(vT) - 10} anchor="end" color={VIZ.velocity}>
              v<TSub>T</TSub> = {fmt(vT, 1)} m/s
            </Label>
            {euler && (
              <>
                <path d={linePath(ePts, sx, sy)} fill="none" stroke={VIZ.ink} strokeWidth={1.5} opacity={0.6} />
                {ePts.map(([et, ev]) => (
                  <circle key={et} cx={sx(et)} cy={sy(ev)} r={4.5} fill={VIZ.ink} />
                ))}
              </>
            )}
            <path d={linePath(vPts, sx, sy)} fill="none" stroke={VIZ.velocity} strokeWidth={3.5} strokeLinejoin="round" />
            <line x1={sx(t)} y1={y0} x2={sx(t)} y2={y1} className="viz-guide" />
            <Dot x={sx(t)} y={sy(v)} color={VIZ.ink} />
          </g>
        )}
      </Plot>
      <g transform={`translate(0 ${plotH})`}>
        <Plot
          x={{ min: 0, max: T_END, label: 'Tid t (s)' }}
          y={{ min: 0, max: A_AXIS, label: 'Akselerasjon a (m/s²)', ticks: sparse ? [0, 4, 8, 12] : [0, 2, 4, 6, 8, 10, 12] }}
          width={800}
          height={plotH}
        >
          {({ sx, sy, y0, y1, x1 }) => (
            <g>
              {compare && (
                <>
                  <line x1={sx(0)} y1={sy(G_EARTH)} x2={x1} y2={sy(G_EARTH)} stroke={VIZ.muted} strokeWidth={2.5} strokeDasharray="7 6" />
                  <Label x={x1 - 6} y={sy(G_EARTH) + 24 * f} anchor="end" muted>
                    a = g
                  </Label>
                </>
              )}
              <path d={linePath(aPts, sx, sy)} fill="none" stroke={VIZ.acceleration} strokeWidth={3.5} strokeLinejoin="round" />
              <line x1={sx(t)} y1={y0} x2={sx(t)} y2={y1} className="viz-guide" />
              <Dot x={sx(t)} y={sy(a)} color={VIZ.ink} />
            </g>
          )}
        </Plot>
      </g>
    </>
  );
}

function explanation(t: number, v: number, a: number, L: number, G: number, vT: number, euler: boolean): ReactNode {
  const n = (x: number) => `${fmt(x, 0)} N`;
  const main =
    t < 0.05 ? (
      <p>
        <strong>Hopperen slipper.</strong> I starten er v = 0, så luftmotstanden L = kv² er null. Den eneste kraften er G, og a = g = 9,81
        m/s², akkurat som uten luftmotstand. Trykk «Spill av» og se hva som skjer med L når farten øker.
      </p>
    ) : v < 0.97 * vT ? (
      <p>
        <strong>Farten øker, men stadig saktere.</strong> Ved v = {fmt(v, 1)} m/s er L = kv² = {n(L)}. Kraftsummen G − L = {n(G - L)} er
        mindre enn G, så a = (G − L)/m = {fmt(a, 2)} m/s² er mindre enn g. Fordi a endrer seg hele tiden, gjelder ikke bevegelseslikningene
        for konstant akselerasjon – vi må regne i små tidssteg.
      </p>
    ) : (
      <p>
        <strong>Terminalfart.</strong> Farten er nesten v<Sub>T</Sub> = √(mg/k) = {fmt(vT, 1)} m/s ({fmt(vT * 3.6, 0)} km/h). Da er L ≈ G ={' '}
        {n(G)}, kraftsummen er nesten null og a ≈ 0: hopperen faller med konstant fart (Newtons 1. lov), selv om tyngden fortsatt virker.
        Spre armer og bein (større k), så blir terminalfarten lavere.
      </p>
    );
  return (
    <>
      {main}
      {euler && (
        <p>
          Prikkene er regnet ut med Eulers metode: a = g − (k/m)v², så v<Sub>ny</Sub> = v + a · Δt. De ligger litt over den eksakte kurven
          fordi a regnes ut i starten av hvert steg, der den er størst. Mindre Δt gir bedre samsvar.
        </p>
      )}
    </>
  );
}
