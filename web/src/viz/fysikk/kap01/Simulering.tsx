import { useEffect, useId, useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import {
  Controls,
  Explain,
  Figure,
  Formula,
  FormulaLine,
  G_EARTH,
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
  Txt,
  VIZ,
  VizLayout,
  fmt,
  linePath,
  sample,
  useSimClock,
  useTextScale,
} from '../../kit';
import { ForceArrow, Stoppeklokke, ValueTag, alpha, useSceneScale, useSvgId } from '../../kit/scene';
import { eulerFall, exactVelocity, maxVelocityError, niceRange, terminalVelocity, type DragFall, type EulerRow } from './model';
import {
  BODY_POSITIONS,
  DEPLOY_HEIGHT,
  EXIT_HEIGHT,
  SIM_DT_MAX,
  SIM_DT_MIN,
  PLANE_DEPTH,
  altitude,
  bodyPoseOf,
  bodyPositionOf,
  eulerStateAt,
  extremes,
  forceScale,
  labelSpot,
  planeRise,
  sDecimals,
  simTime,
  tableWindow,
  timeToFall,
  toKmh,
  type BodyPositionId,
  type EulerState,
} from './model-simulering';
import { FallHimmel, HOPPEFLY_DM, Hopper, Hoppefly, Hoydemaaler, Luftstrom, hopperOmriss } from './simulering-deler';
import { useNarrow } from './useNarrow';
import { ColorDot, Label } from './marks';

const C_EXACT = VIZ.velocity;
// Ikke oransje: den fargen er tyngden (linja for fritt fall uten luftmotstand).
const C_EULER = VIZ.series[0];
/** Ett steg i Eulers metode: stigningstallet i steget er akselerasjonen. */
const C_STEP = VIZ.acceleration;
const TABLE_ROWS = 6;
/** Figuren starter i steg 4 (med Δt = 1 s), der både L og a synes godt. */
const T_START = 4;
/** Hopperen er 1,75 m høy; i scenen på PC er det 150 figurenheter (86 per meter, se målestokken). */
const PERSON_M = 1.75;

/** Tall med enhet og hardt mellomrom i utregningen; negative tall i parentes: «(−1,76 m/s²)». */
function q(value: number, decimals: number, unit: string): string {
  const text = `${fmt(value, decimals)}\u00a0${unit}`;
  return value < 0 && fmt(value, decimals) !== fmt(0, decimals) ? `(${text})` : text;
}

export default function Simulering() {
  const [m, setM] = useState(80);
  const [k, setK] = useState(0.25);
  const [dt, setDt] = useState(1);
  const [free, setFree] = useState(false);
  const [forces, setForces] = useState(true);
  const { ref, narrow } = useNarrow();

  const p: DragFall = useMemo(() => ({ m, k }), [m, k]);
  const vT = terminalVelocity(p);
  const tEnd = simTime(vT);
  const rows = useMemo(() => eulerFall(p, dt, tEnd), [p, dt, tEnd]);
  const tLast = rows[rows.length - 1]?.t ?? tEnd;
  // Avspillingen tar 10–15 s uansett hvor lang simuleringen er.
  const clock = useSimClock({ tMax: tLast, speed: Math.max(1, tEnd / 15) });
  const { setT, pause } = clock;
  useEffect(() => setT(T_START), [setT]);
  const t = Math.min(Math.max(clock.t, 0), tLast);
  const st = eulerStateAt(p, rows, t);

  const err = maxVelocityError(p, rows);
  const overshoot = rows.some((r) => r.v > vT * 1.001);
  const errorCurve = useMemo(() => {
    const pts: [number, number][] = [];
    for (let d = SIM_DT_MIN; d <= SIM_DT_MAX + 1e-9; d += 0.05) pts.push([d, maxVelocityError(p, eulerFall(p, d, tEnd))]);
    return pts;
  }, [p, tEnd]);
  // Utregningen viser steget fra rad fn til fn + 1 (det siste steget når tiden står helt på slutten).
  const fn = Math.max(0, Math.min(st.n, rows.length - 2));
  const step = rows[fn];
  const next = rows[fn + 1];
  const sDec = sDecimals(dt);
  const body = bodyPositionOf(k);
  const deploy = timeToFall(p, EXIT_HEIGHT - DEPLOY_HEIGHT);

  const goStep = (n: number) => {
    pause();
    const r = rows[Math.max(0, Math.min(n, rows.length - 1))];
    if (r) setT(r.t);
  };
  const tMaxSlider = Math.floor(tLast * 10 + 1e-6) / 10;
  const geo = sceneLayout(narrow);

  return (
    <VizLayout>
      <Controls>
        <Slider label="Tidssteg Δt" value={dt} onChange={setDt} min={SIM_DT_MIN} max={SIM_DT_MAX} step={0.1} unit="s" decimals={1} />
        <Slider label="Luftmotstandstall k" value={k} onChange={setK} min={0.1} max={0.5} step={0.01} unit="kg/m" decimals={2} />
        <Slider label="Masse m (hopper med utstyr)" value={m} onChange={setM} min={50} max={120} step={1} unit="kg" decimals={0} />
        <Slider
          label="Tidspunkt t"
          value={Math.min(t, tMaxSlider)}
          onChange={(x) => setT(x >= tMaxSlider ? tLast : x)}
          min={0}
          max={tMaxSlider}
          step={0.1}
          unit="s"
          decimals={1}
        />
      </Controls>
      <Toolbar>
        <Segmented<BodyPositionId | 'egen'>
          label="Kroppsstilling"
          options={BODY_POSITIONS.map((b) => ({ value: b.id, label: `${b.label} (k = ${fmt(b.k, 2)})` }))}
          value={body ?? 'egen'}
          onChange={(id) => {
            const b = BODY_POSITIONS.find((x) => x.id === id);
            if (b) setK(b.k);
          }}
        />
      </Toolbar>
      <Toolbar>
        <Toggle label="Vis krefter" checked={forces} onChange={setForces} />
        <Toggle label="Vis fritt fall uten luftmotstand" checked={free} onChange={setFree} />
      </Toolbar>
      <Toolbar>
        <PlayControls clock={clock} decimals={1} />
        <div className="viz-play">
          <button type="button" className="btn btn-sm" onClick={() => goStep(t > st.tn + 1e-9 ? st.n : st.n - 1)} disabled={t <= 1e-9}>
            <ChevronLeft size={16} aria-hidden />
            Forrige steg
          </button>
          <button type="button" className="btn btn-sm" onClick={() => goStep(st.n + 1)} disabled={st.n >= rows.length - 1}>
            Neste steg
            <ChevronRight size={16} aria-hidden />
          </button>
        </div>
      </Toolbar>

      <div ref={ref}>
        <Figure viewBox={`0 0 800 ${geo.H}`} label={sceneLabel(p, st, rows.length - 1)} maxHeight={narrow ? 900 : 440}>
          <FallScene p={p} rows={rows} st={st} vT={vT} geo={geo} forces={forces} />
        </Figure>
      </div>

      <Figure
        viewBox={`0 0 800 ${narrow ? 560 : 400}`}
        label={`Fart-tid-graf for et fall med luftmotstand. Eulers metode med tidssteg ${fmt(dt, 1)} s sammenlignet med den eksakte løsningen. Terminalfarten er ${fmt(vT, 1)} m/s. Steg ${st.n} er markert.`}
        maxHeight={narrow ? 600 : 440}
      >
        {/* Tidsaksen går til siste rad, som kan ligge litt etter tEnd når Δt ikke går opp i den (f.eks. 29 · 0,7 s = 20,3 s) */}
        <VelocityPlot p={p} rows={rows} st={st} fn={fn} tEnd={Math.max(tEnd, tLast)} vT={vT} free={free} height={narrow ? 560 : 400} />
      </Figure>
      <Legend
        items={[
          {
            color: C_EXACT,
            label: (
              <span>
                Eksakt løsning v = v<Sub>T</Sub> · tanh(gt/v<Sub>T</Sub>)
              </span>
            ),
          },
          { color: C_EULER, label: `Eulers metode, Δt = ${fmt(dt, 1)} s` },
          { color: C_STEP, label: 'Ett steg: stigningstallet er a, så farten øker med a · Δt' },
          { color: VIZ.muted, label: 'Terminalfart', dashed: true },
          ...(free ? [{ color: VIZ.gravity, label: 'Uten luftmotstand: v = gt', dashed: true }] : []),
        ]}
      />

      <StepTable rows={rows} p={p} dt={dt} n={st.n} narrow={narrow} />

      <Figure viewBox={`0 0 800 ${narrow ? 400 : 260}`} label="Største avvik mellom Euler og eksakt løsning som funksjon av tidssteget." maxHeight={narrow ? 440 : 300}>
        <ErrorPlot curve={errorCurve} dt={dt} err={err} height={narrow ? 400 : 260} />
      </Figure>

      <Readouts>
        <Readout
          label={
            <>
              Terminalfart v<Sub>T</Sub> = √(mg/k)
            </>
          }
          value={fmt(vT, 1)}
          unit="m/s"
          tone={C_EXACT}
        />
        <Readout label={`Antall steg til t = ${fmt(tLast, Math.abs(tLast - Math.round(tLast)) < 1e-6 ? 0 : 1)} s`} value={fmt(rows.length - 1, 0)} />
        <Readout label="Største avvik i farten" value={fmt(err, 2)} unit="m/s" tone={C_EULER} />
      </Readouts>

      {step && next && (
        <Formula label={`Ett steg i Eulers metode med tall, fra steg ${fn} til steg ${fn + 1}`}>
          <FormulaLine>
            G = mg = {q(m, 0, 'kg')} · {q(G_EARTH, 2, 'm/s²')} = {q(m * G_EARTH, 1, 'N')}
          </FormulaLine>
          <FormulaLine>
            L<Sub>{fn}</Sub> = k · v<Sub>{fn}</Sub>² = {q(k, 2, 'kg/m')} · ({q(step.v, 2, 'm/s')})² = {q(k * step.v * step.v, 1, 'N')}
          </FormulaLine>
          <FormulaLine>
            a<Sub>{fn}</Sub> = (G − L<Sub>{fn}</Sub>) / m = ({q(m * G_EARTH, 1, 'N')} − {q(k * step.v * step.v, 1, 'N')}) / {q(m, 0, 'kg')} ={' '}
            {q(step.a, 2, 'm/s²')}
          </FormulaLine>
          <FormulaLine>
            v<Sub>{fn + 1}</Sub> = v<Sub>{fn}</Sub> + a<Sub>{fn}</Sub> · Δt = {q(step.v, 2, 'm/s')} + {q(step.a, 2, 'm/s²')} · {q(dt, 1, 's')} ={' '}
            {q(next.v, 2, 'm/s')}
          </FormulaLine>
          <FormulaLine>
            s<Sub>{fn + 1}</Sub> = s<Sub>{fn}</Sub> + v<Sub>{fn + 1}</Sub> · Δt = {q(step.s, sDec, 'm')} + {q(next.v, 2, 'm/s')} · {q(dt, 1, 's')} ={' '}
            {q(next.s, sDec, 'm')}
          </FormulaLine>
        </Formula>
      )}

      <Explain>{explanation({ p, dt, err, vT, overshoot, st, deploy, tEnd })}</Explain>
    </VizLayout>
  );
}

/* ---------- Scenen: hopperen før skjermen er ute ---------- */

interface SceneLayout {
  /** Mobil: scenen over hele bredden og instrumentene under (ellers instrumentene til høyre). */
  narrow: boolean;
  H: number;
  panel: { w: number; h: number; horizon: number };
  /** Tyngdepunktet til hopperen. */
  cx: number;
  cy: number;
  /** Hopperens høyde stående (1,75 m) på PC; ganges med useSceneScale på mobil. */
  size: number;
  /** Fart- og akselerasjonspila (x); skiltene står rett over (under for a < 0) der pilene starter. */
  vx: number;
  ax: number;
  /** Instrumentene: stoppeklokka og høydemåleren, med tekst under. */
  watch: { x: number; y: number; r: number; textY: number };
  alti: { x: number; y: number; r: number; textY: number };
}

function sceneLayout(narrow: boolean): SceneLayout {
  if (narrow)
    return {
      narrow: true,
      H: 820,
      panel: { w: 800, h: 520, horizon: 446 },
      cx: 400,
      cy: 250,
      size: 120,
      vx: 96,
      ax: 704,
      watch: { x: 205, y: 662, r: 70, textY: 804 },
      alti: { x: 595, y: 662, r: 76, textY: 804 },
    };
  return {
    narrow: false,
    H: 380,
    panel: { w: 588, h: 380, horizon: 316 },
    cx: 292,
    cy: 178,
    size: 150,
    vx: 96,
    ax: 490,
    watch: { x: 694, y: 92, r: 46, textY: 170 },
    alti: { x: 694, y: 262, r: 52, textY: 366 },
  };
}

function FallScene({ p, rows, st, vT, geo, forces }: { p: DragFall; rows: EulerRow[]; st: EulerState; vT: number; geo: SceneLayout; forces: boolean }) {
  const f = useTextScale();
  const sc = useSceneScale();
  const { panel, cx, cy, narrow } = geo;
  const size = geo.size * sc;
  const pxPerM = size / PERSON_M;
  const pose = bodyPoseOf(p.k);
  const headDown = pose === 'hode';
  const outline = useMemo(() => hopperOmriss(size, pose), [size, pose]);
  const clip = useSvgId('sim-scene');
  const ex = useMemo(() => extremes(p, rows), [p, rows]);

  const G = p.m * G_EARTH;
  // Kreftene: én skala (figurenheter per N) for G og L, med plass til den største kraften i simuleringen og
  // etiketten over L-pila. 1 180 N er tyngden til den tyngste hopperen (120 kg).
  const up = cy - 14 - 22 * f;
  const down = panel.h - 14 - cy;
  const kN = forceScale(G, ex.Lmax, up, down, Math.min(up, down) / 1180);
  const L = st.L;
  const lTip = cy - L * kN;
  // Fart og akselerasjon: egne skalaer, faste for tallsettet.
  const room = panel.h - 26 - cy;
  const vAxis = Math.max(ex.vMax, vT);
  const kv = room / vAxis;
  const ka = (0.62 * room) / G_EARTH;
  const tagAbove = cy - 24 * f;
  const tagBelow = cy + 24 * f;
  const vText = `v = ${fmt(st.v, 1)} m/s`;
  // Høyre kant og høyden av skiltet for v (samme mål som ValueTag med size 0,9)
  const tagFs = 17 * f * 0.9;
  const vTagW = Math.max(tagFs * 1.6, vText.length * tagFs * 0.6 + 16 * f);
  const vTagRight = narrow ? 16 + vTagW : geo.vx + vTagW / 2;
  const tagH = tagFs * 1.55;

  // L-etiketten ved spissen av pila. Med magen ned og i vid drakt midt over spissen, men aldri inne i kroppen (når
  // pila er kort). Med hodet ned ligger beina oppe til høyre og hodet nede til venstre, så der står den til venstre for
  // spissen, også når pila er kort; bare hvis den da kommer borti skiltet for v (mobil), flyttes den opp over skiltet.
  // G-etiketten ved siden av spissen, på motsatt side av hodet.
  const bodyTop = cy + outline.top - 8 * sc;
  const lText = `L = ${fmt(L, 0)} N`;
  const lFs = 17 * f;
  let lLabel: { x: number; y: number; anchor: 'middle' | 'end' };
  if (!headDown) lLabel = { x: cx, y: Math.min(lTip, bodyTop) - 8 * f, anchor: 'middle' };
  else {
    const x = cx - 10 * f;
    let y = Math.min(cy - 10 * f, lTip + 6 * f);
    const left = x - lText.length * 0.6 * lFs;
    const hitsTag = left < vTagRight + 6 * f && y + 0.25 * lFs > tagAbove - tagH / 2 - 4 * f && y - lFs < tagAbove + tagH / 2 + 4 * f;
    if (hitsTag) y = tagAbove - tagH / 2 - 6 * f;
    lLabel = { x, y, anchor: 'end' };
  }
  const lLabelTop = lLabel.y - lFs;

  const air = (narrow ? 90 : 64) * (st.v / vAxis);
  const nSteps = rows.length - 1;
  // Flyet hopperen kom fra: lenger inne i bildet (mindre per meter) og litt foran ham. Dørterskelen står så lavt at
  // hele halefinnen synes, men hjulene holder seg over skiltet for a og buken over etiketten for L (som er 0 N mens
  // flyet synes). Flyet glir oppover og ut av bildet i løpet av det første sekundet.
  const planeK = pxPerM * PLANE_DEPTH;
  const kd = planeK / 10;
  // Med hodet ned stikker beina høyt opp; der står de foran flyet (som er lenger inne i bildet), som om hopperen
  // akkurat har stupt ut av døra, så da er det bare L-etiketten flyet må holde seg over.
  const planeY0 = Math.min(
    -HOPPEFLY_DM.top * kd + 8,
    cy - 36 * f - 6 - HOPPEFLY_DM.bottom * kd,
    (headDown ? lLabelTop : bodyTop - 21 * f) - 6 - 2 * kd,
  );
  const planeY = planeY0 - planeRise(st.s, pxPerM);
  const planeVisible = planeY + HOPPEFLY_DM.bottom * kd > 0;

  return (
    <g>
      <FallHimmel w={panel.w} h={panel.h} horisont={panel.horizon} falt={st.s} parallakse={narrow ? 2.2 : 1.6} />
      {planeVisible && (
        <>
          <defs>
            <clipPath id={clip}>
              <rect x={0} y={0} width={panel.w} height={panel.h} rx={10} />
            </clipPath>
          </defs>
          <g clipPath={`url(#${clip})`}>
            <Hoppefly x={cx + (narrow ? 70 : 60) * sc} y={planeY} pxPerM={planeK} />
          </g>
        </>
      )}
      <Luftstrom
        xs={[cx + outline.left - 14 * sc, cx + outline.right + 14 * sc]}
        y={cy - 4 * sc}
        length={air}
        spread={(outline.right - outline.left) * 0.12}
      />
      <Hopper x={cx} y={cy} size={size} stilling={pose} />

      {forces && (
        <>
          <ForceArrow x1={cx} y1={cy} x2={cx} y2={lTip} color={VIZ.friction} />
          {/* Etiketten står også når pila er for kort til å synes (L = 0 N i starten) */}
          <Txt x={lLabel.x} y={lLabel.y} anchor={lLabel.anchor} color={VIZ.friction} weight={720}>
            {lText}
          </Txt>
          <ForceArrow
            x1={cx}
            y1={cy}
            x2={cx}
            y2={cy + G * kN}
            color={VIZ.gravity}
            label={`G = ${fmt(G, 0)} N`}
            labelX={headDown ? cx + 16 * f : cx - 10 * f}
            labelY={cy + G * kN - 4 * f}
            labelAnchor={headDown ? 'start' : 'end'}
            origin
          />
        </>
      )}

      {/* Fart og akselerasjon ved siden av hopperen, med verdien på et skilt der pila starter */}
      <ForceArrow x1={geo.vx} y1={cy} x2={geo.vx} y2={cy + st.v * kv} color={VIZ.velocity} label="v" width={6} />
      <ForceArrow x1={geo.ax} y1={cy} x2={geo.ax} y2={cy + st.a * ka} color={VIZ.acceleration} label="a" width={6} />
      <ValueTag
        x={narrow ? 16 : geo.vx}
        y={tagAbove}
        anchor={narrow ? 'start' : 'middle'}
        text={vText}
        color={VIZ.velocity}
      />
      <ValueTag
        x={narrow ? panel.w - 16 : geo.ax}
        y={st.a < -1e-6 ? tagBelow : tagAbove}
        anchor={narrow ? 'end' : 'middle'}
        text={`a = ${fmt(st.a, 2)} m/s²`}
        color={VIZ.acceleration}
      />
      {/* Målestokk nede til høyre (fartspila kan gå helt ned til venstre): hopperen er 1,75 m høy */}
      <ScaleBar x={panel.w - (narrow ? 70 : 46) - pxPerM} y={panel.h - 18} pxPerM={pxPerM} />

      <Stoppeklokke x={geo.watch.x} y={geo.watch.y} r={geo.watch.r} t={st.t} desimaler={1} />
      <Txt x={geo.watch.x} y={geo.watch.textY} size={0.9} weight={680}>
        Steg {st.n} av {nSteps}
      </Txt>
      <Hoydemaaler x={geo.alti.x} y={geo.alti.y} r={geo.alti.r} hoyde={altitude(st.s)} />
      <Txt x={geo.alti.x} y={geo.alti.textY} size={0.9} weight={680}>
        Falt s = {fmt(st.s, 1)} m
      </Txt>
    </g>
  );
}

/** Liten målestokk nederst i scenen: 1 m i samme skala som hopperen. */
function ScaleBar({ x, y, pxPerM }: { x: number; y: number; pxPerM: number }) {
  const f = useTextScale();
  return (
    <g>
      <line x1={x} y1={y} x2={x + pxPerM} y2={y} stroke={VIZ.surface} strokeWidth={5} strokeLinecap="round" opacity={0.85} />
      <line x1={x} y1={y} x2={x + pxPerM} y2={y} stroke={VIZ.ink} strokeWidth={2} />
      <line x1={x} y1={y - 5} x2={x} y2={y + 5} stroke={VIZ.ink} strokeWidth={2} />
      <line x1={x + pxPerM} y1={y - 5} x2={x + pxPerM} y2={y + 5} stroke={VIZ.ink} strokeWidth={2} />
      <Txt x={x + pxPerM + 8 * f} y={y + 5 * f} anchor="start" size={0.8} weight={650}>
        1 m
      </Txt>
    </g>
  );
}

function sceneLabel(p: DragFall, st: EulerState, nSteps: number): string {
  return (
    `Fallskjermhopper før skjermen er ute, simulert med Eulers metode. Steg ${st.n} av ${nSteps}, t = ${fmt(st.t, 1)} s. ` +
    `Farten er ${fmt(st.v, 1)} m/s og akselerasjonen ${fmt(st.a, 2)} m/s². Tyngden er ${fmt(p.m * G_EARTH, 0)} N og luftmotstanden ` +
    `${fmt(st.L, 0)} N. Høydemåleren viser ${fmt(altitude(st.s), 0)} m over bakken.`
  );
}

/* ---------- v-t-graf ---------- */

function VelocityPlot({
  p,
  rows,
  st,
  fn,
  tEnd,
  vT,
  free,
  height,
}: {
  p: DragFall;
  rows: EulerRow[];
  st: EulerState;
  fn: number;
  tEnd: number;
  vT: number;
  free: boolean;
  height: number;
}) {
  const f = useTextScale();
  const vPeak = Math.max(vT, ...rows.map((r) => r.v));
  const [, vMax] = niceRange(0, Math.min(vPeak, vT * 1.6) * 1.12, 5, 5);
  const clip = `${useId().replace(/[^a-zA-Z0-9_-]/g, '')}-clip`;
  const a = rows[fn];
  const b = rows[fn + 1];
  return (
    <Plot x={{ min: 0, max: tEnd, label: 'Tid t (s)' }} y={{ min: 0, max: vMax, label: 'v (m/s)' }} width={800} height={height}>
      {({ sx, sy, x0, x1, y0, y1 }) => {
        const tri =
          a && b
            ? {
                xa: sx(a.t),
                xb: sx(Math.min(b.t, tEnd)),
                ya: sy(a.v),
                yb: sy(b.v),
              }
            : null;
        return (
          <g>
            <clipPath id={clip}>
              <rect x={x0} y={y1 - 8} width={x1 - x0 + 8} height={y0 - y1 + 16} />
            </clipPath>
            {/* Steget simuleringen er i: akselerasjonen holdes fast i hele båndet */}
            {tri && <rect x={tri.xa} y={y1} width={Math.max(1, tri.xb - tri.xa)} height={y0 - y1} fill={alpha(C_STEP, 0.08)} />}
            <line x1={x0} x2={x1} y1={sy(vT)} y2={sy(vT)} stroke={VIZ.muted} strokeWidth={2} strokeDasharray="8 6" />
            {/* Til høyre over linja, høyt nok til at den senkede T-en ikke treffer Euler-punktene som ligger på linja */}
            <Label x={x1 - 6} y={sy(vT) - 16 * f} anchor="end" muted>
              v<TSub>T</TSub> = {fmt(vT, 1)} m/s
            </Label>
            <g clipPath={`url(#${clip})`}>
              {free && <line x1={sx(0)} y1={sy(0)} x2={sx(tEnd)} y2={sy(G_EARTH * tEnd)} stroke={VIZ.gravity} strokeWidth={2} strokeDasharray="6 6" />}
              <path d={linePath(sample((t) => exactVelocity(p, t), 0, tEnd, 200), sx, sy)} fill="none" stroke={C_EXACT} strokeWidth={3} />
              <path d={linePath(rows.map((r) => [r.t, r.v]), sx, sy)} fill="none" stroke={C_EULER} strokeWidth={2} />
              {tri && (
                <g>
                  <path
                    d={`M${tri.xa},${tri.ya}L${tri.xb},${tri.ya}L${tri.xb},${tri.yb}`}
                    fill="none"
                    stroke={C_STEP}
                    strokeWidth={1.6}
                    strokeDasharray="5 4"
                  />
                  <line x1={tri.xa} y1={tri.ya} x2={tri.xb} y2={tri.yb} stroke={VIZ.surface} strokeWidth={7} strokeLinecap="round" />
                  <line x1={tri.xa} y1={tri.ya} x2={tri.xb} y2={tri.yb} stroke={C_STEP} strokeWidth={4} strokeLinecap="round" />
                </g>
              )}
              {/* Med veldig mange steg blir punktene en tett rekke, så da vises bare linja */}
              {rows.length <= 80 && rows.map((r) => <ColorDot key={r.n} x={sx(r.t)} y={sy(r.v)} r={rows.length > 40 ? 4 : 5.5} color={C_EULER} />)}
            </g>
            {/* «Δt» på utsiden av trekanten: under den vannrette linja når farten øker, over når den avtar */}
            {tri && tri.xb - tri.xa > 30 * f && (
              <Txt x={(tri.xa + tri.xb) / 2} y={tri.yb > tri.ya + 1 ? tri.ya - 8 * f : tri.ya + 20 * f} size={0.85} color={C_STEP} weight={700}>
                Δt
              </Txt>
            )}
            {/* «a · Δt» ved den loddrette streken. Når farten avtar (overskyting), under enden av linjestykket: der er det
                tomt, mens Euler-punktene og terminalfarten ligger rett til høyre for streken. */}
            {tri && Math.abs(tri.ya - tri.yb) > 16 * f && (
              <Txt
                x={tri.xb + 7 * f}
                y={tri.yb > tri.ya ? tri.yb + 20 * f : (tri.ya + tri.yb) / 2 + 5 * f}
                anchor="start"
                size={0.85}
                color={C_STEP}
                weight={700}
              >
                a · Δt
              </Txt>
            )}
            {/* Tiden nå: den simulerte farten på Euler-linja og den eksakte farten på samme tid */}
            <line x1={sx(st.t)} x2={sx(st.t)} y1={y0} y2={y1} stroke={VIZ.muted} strokeWidth={1.5} strokeDasharray="3 4" />
            <ColorDot x={sx(st.t)} y={sy(exactVelocity(p, st.t))} r={5} color={C_EXACT} />
            <circle cx={sx(st.t)} cy={sy(st.v)} r={9} fill="none" stroke={C_EULER} strokeWidth={2.5} />
            <ColorDot x={sx(st.t)} y={sy(st.v)} r={5} color={C_EULER} />
          </g>
        );
      }}
    </Plot>
  );
}

/* ---------- Feil mot tidssteg ---------- */

function ErrorPlot({ curve, dt, err, height }: { curve: [number, number][]; dt: number; err: number; height: number }) {
  const f = useTextScale();
  const peak = Math.max(...curve.map(([, e]) => e), 0.1);
  const [, yMax] = niceRange(0, peak * 1.05, 4, 0.5);
  return (
    <Plot
      x={{ min: 0, max: SIM_DT_MAX, label: 'Tidssteg Δt (s)', decimals: 1, ticks: [0, 0.5, 1, 1.5, 2, 2.5] }}
      y={{ min: 0, max: yMax, label: 'Avvik (m/s)', decimals: yMax < 2 ? 1 : 0 }}
      width={800}
      height={height}
      margin={{ top: 34 * f, right: 24 * f, bottom: 56 * f, left: 72 * f }}
    >
      {({ sx, sy, x0, x1, y0, y1 }) => {
        const area = `${linePath(curve, sx, sy)}L${sx(curve[curve.length - 1]?.[0] ?? SIM_DT_MAX)},${y0}L${sx(curve[0]?.[0] ?? 0)},${y0}Z`;
        // Verdien står alltid inne i plottet, så nær punktet som mulig uten å krysse kurven (med en strek når den må
        // stå et stykke unna, f.eks. ved Δt = 2,5 s, der punktet ligger i hjørnet oppe til høyre).
        const spot = labelSpot(
          curve.map(([d, e]) => [sx(d), sy(e)]),
          sx(dt),
          sy(err),
          `${fmt(err, 2)} m/s`.length * 0.6 * 17 * 0.85 * f,
          17 * 0.85 * f,
          { x0, x1, top: y1 + 6 * f, bottom: y0 },
          10 * f,
          [
            [
              [sx(dt), sy(err)],
              [sx(dt), y0],
            ],
          ],
        );
        return (
          <g>
            <Label x={x0} y={y1 - 12} anchor="start" muted>
              Største avvik fra den eksakte farten
            </Label>
            <path d={area} fill={alpha(C_EULER, 0.08)} />
            <path d={linePath(curve, sx, sy)} fill="none" stroke={C_EULER} strokeWidth={3} />
            <line x1={sx(dt)} x2={sx(dt)} y1={y0} y2={sy(err)} stroke={C_EULER} strokeWidth={1.5} strokeDasharray="3 4" />
            {spot.leader && (
              <line x1={sx(dt)} y1={sy(err)} x2={spot.leader.x} y2={spot.leader.y} stroke={C_EULER} strokeWidth={1.5} opacity={0.8} />
            )}
            <ColorDot x={sx(dt)} y={sy(err)} color={C_EULER} />
            <Txt x={spot.x} y={spot.y} anchor={spot.anchor} size={0.85} color={C_EULER} weight={700}>
              {fmt(err, 2)} m/s
            </Txt>
          </g>
        );
      }}
    </Plot>
  );
}

/* ---------- Tabell ---------- */

const cell: CSSProperties = { padding: '6px 4px 6px 10px', textAlign: 'right', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' };
const head: CSSProperties = { ...cell, color: 'var(--text-2)', fontWeight: 600 };

/** Tabellen med stegene. På mobil er det ikke plass til kolonnen med stegnummer (t viser hvor vi er). */
function StepTable({ rows, p, dt, n, narrow }: { rows: EulerRow[]; p: DragFall; dt: number; n: number; narrow: boolean }) {
  const start = tableWindow(n, rows.length, TABLE_ROWS);
  const shown = rows.slice(start, start + TABLE_ROWS);
  const nNext = Math.min(n + 1, rows.length - 1);
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14, fontVariantNumeric: 'tabular-nums', color: 'var(--text)' }}>
        <caption style={{ captionSide: 'top', textAlign: 'left', padding: '0 0 8px', fontSize: 14, color: 'var(--text-2)', fontWeight: 600 }}>
          {start === 0 ? 'De første stegene' : `Stegene ${start}–${start + shown.length - 1}`} med Δt = {fmt(dt, 1)} s. Steg {n} (t = {fmt(rows[n]?.t ?? 0, 1)} s)
          {nNext !== n ? ' og neste rad er uthevet.' : ', det siste, er uthevet.'}
        </caption>
        <thead>
          <tr>
            {!narrow && <th style={head}>Steg</th>}
            <th style={head}>t (s)</th>
            <th style={{ ...head, color: C_EULER }}>v (m/s)</th>
            <th style={{ ...head, color: C_EXACT }}>v eksakt</th>
            <th style={{ ...head, color: C_STEP }}>a (m/s²)</th>
            <th style={head}>s (m)</th>
          </tr>
        </thead>
        <tbody>
          {shown.map((r) => (
            <tr
              key={r.n}
              style={
                r.n === n
                  ? { background: alpha(C_STEP, 0.13), fontWeight: 650 }
                  : r.n === nNext && nNext !== n
                    ? { background: alpha(C_STEP, 0.05) }
                    : undefined
              }
            >
              {!narrow && <td style={{ ...cell, color: 'var(--text-2)' }}>{r.n}</td>}
              <td style={cell}>{fmt(r.t, 1)}</td>
              <td style={cell}>{fmt(r.v, 2)}</td>
              <td style={{ ...cell, color: 'var(--text-2)' }}>{fmt(exactVelocity(p, r.t), 2)}</td>
              <td style={cell}>{fmt(r.a, 2)}</td>
              <td style={cell}>{fmt(r.s, sDecimals(dt))}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ---------- Forklaring ---------- */

function explanation({
  p,
  dt,
  err,
  vT,
  overshoot,
  st,
  deploy,
  tEnd,
}: {
  p: DragFall;
  dt: number;
  err: number;
  vT: number;
  overshoot: boolean;
  st: EulerState;
  deploy: number;
  tEnd: number;
}): ReactNode {
  const G = p.m * G_EARTH;
  const share = st.L / G;
  let now: ReactNode;
  if (st.n === 0 && st.v < 1e-9)
    now = (
      <>
        <strong>Steg 0:</strong> hopperen har akkurat forlatt flyet, så v = 0 og det er ingen luftmotstand. Da er a = g = 9,81 m/s², og det
        første steget blir et fritt fall: v<Sub>1</Sub> = g · Δt = {fmt(G_EARTH * dt, 2)} m/s.
      </>
    );
  else if (st.a < -1e-6)
    now = (
      <>
        <strong>Steg {st.n}:</strong> den simulerte farten var {fmt(st.vn, 1)} m/s i starten av steget, over terminalfarten. Da blir L ={' '}
        {fmt(st.L, 0)} N større enn G = {fmt(G, 0)} N, og akselerasjonen peker oppover (a = {fmt(st.a, 2)} m/s²). Det skjer ikke i virkeligheten: det
        er tidssteget som er for stort.
      </>
    );
  else if (share > 0.97)
    now = (
      <>
        <strong>Steg {st.n}:</strong> farten er nesten terminalfarten. Luftmotstanden L = {fmt(st.L, 0)} N er nesten like stor som tyngden G ={' '}
        {fmt(G, 0)} N, så kraftsummen og akselerasjonen er nesten null, og farten øker knapt lenger.
      </>
    );
  else
    now = (
      <>
        <strong>Steg {st.n}:</strong> i starten av steget er farten {fmt(st.vn, 1)} m/s, så luftmotstanden er L = kv² = {fmt(st.L, 0)} N,{' '}
        {fmt(share * 100, 0)} % av tyngden. Simuleringen regner ut a = (G − L)/m = {fmt(st.a, 2)} m/s² og{' '}
        <strong>later som a er konstant gjennom hele steget</strong>. Spill av eller trykk «Neste steg»: farten øker jevnt i steget, mens L og a står
        stille til neste steg begynner.
      </>
    );

  const rel = err / vT;
  let accuracy: ReactNode;
  if (overshoot)
    accuracy = (
      <>
        Med Δt = {fmt(dt, 1)} s er tidssteget så stort at simuleringen <strong>skyter over terminalfarten</strong> og svinger rundt den før den
        roer seg. Gjør Δt mindre, så forsvinner svingningene.
      </>
    );
  else if (rel < 0.01)
    accuracy = (
      <>
        Med Δt = {fmt(dt, 1)} s ligger punktene nesten oppå den eksakte kurven: største avvik er bare {fmt(err, 2)} m/s. Prisen er mange steg å
        regne, men det gjør datamaskinen raskt.
      </>
    );
  else
    accuracy = (
      <>
        Punktene ligger <strong>over</strong> den eksakte kurven fordi akselerasjonen i starten av hvert steg er større enn gjennomsnittet i
        steget. Halverer du Δt, blir avviket omtrent halvparten så stort (nå {fmt(err, 1)} m/s).
      </>
    );

  return (
    <>
      <p>{now}</p>
      <p>
        <strong>Eulers metode</strong> regner ut akselerasjonen a = g − (k/m)v² fra farten nå og later som den er konstant i et helt tidssteg:
        først blir v = v + a·Δt, så blir s = s + v·Δt. I v-t-grafen er det et lite rett linjestykke med stigningstall a for hvert steg. {accuracy}{' '}
        Slik regner også fysikken i dataspill: mange små steg, der kreftene regnes ut på nytt i hvert steg.
      </p>
      <p>
        Etter hvert som farten øker, nærmer luftmotstanden L = kv² seg tyngden G, så akselerasjonen går mot null og farten mot terminalfarten
        v<Sub>T</Sub> = √(mg/k) = {fmt(vT, 1)} m/s = {fmt(toKmh(vT), 0)} km/h, der L = G. Det er derfor en fallskjermhopper ikke faller fortere og
        fortere: med magen ned blir farten ca. 200 km/h, med hodet ned, der flaten mot lufta og dermed k er mindre, nærmere 300 km/h, og i
        vid drakt med armer og bein strukket ut bare ca. 160 km/h.{' '}
        {deploy <= tEnd ? (
          <>
            Med disse tallene er hopperen nede i {fmt(DEPLOY_HEIGHT, 0)} m allerede etter ca. {fmt(deploy, 0)} s, og der må skjermen ut. Resten av
            simuleringen er bare regning.
          </>
        ) : (
          <>
            Fallet fra {fmt(EXIT_HEIGHT, 0)} m ned til {fmt(DEPLOY_HEIGHT, 0)} m (med luftmotstand), der skjermen må ut, tar ca. {fmt(deploy, 0)} s.
          </>
        )}
      </p>
    </>
  );
}
