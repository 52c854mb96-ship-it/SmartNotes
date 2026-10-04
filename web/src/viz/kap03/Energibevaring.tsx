import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  Arrow,
  Controls,
  Explain,
  Figure,
  Formula,
  FormulaLine,
  G_EARTH,
  Label,
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
  linePath,
  sample,
  useSimClock,
  useTextScale,
} from '../kit';
import { makeTrack, niceCeil, sampleAt, simulateTrack, type Track, type TrackKind, type TrackSample, type TrackSim } from './model';
import { ColorDot } from './marks';
import { useNarrow } from './useNarrow';

/** Friksjonstallet når friksjon er slått på (R = μmg). */
const MU = 0.06;
const T_SIM = 45;

const KINDS: { value: TrackKind; label: string }[] = [
  { value: 'rampe', label: 'U-rampe' },
  { value: 'bakke', label: 'Bakke med topp' },
];

const C_EP = VIZ.gravity;
const C_EK = VIZ.velocity;
const C_E = VIZ.ink;
const C_Q = VIZ.friction;

export default function Energibevaring() {
  const [kind, setKind] = useState<TrackKind>('rampe');
  const [h0, setH0] = useState(4);
  const [m, setM] = useState(50);
  const [friction, setFriction] = useState(false);
  const { ref, narrow } = useNarrow();

  const track = useMemo(() => makeTrack(kind), [kind]);
  const sim = useMemo(() => simulateTrack({ track, h0, m, mu: friction ? MU : 0, tMax: T_SIM }), [track, h0, m, friction]);
  const tMax = sim.stopTime !== null ? Math.min(T_SIM, sim.stopTime + 1) : T_SIM;
  const clock = useSimClock({ tMax });
  const { setT, reset } = clock;
  // Start på vei ned, så både E_p og E_k synes før du trykker på «Spill av».
  const [startT] = useState(() => sim.samples.find((p) => p.h <= 0.55 * h0)?.t ?? 0);
  useEffect(() => setT(startT), [setT, startT]);

  const t = Math.min(clock.t, tMax);
  const p = sampleAt(sim, t);
  const stopped = sim.stopTime !== null && t >= sim.stopTime;

  const change = (fn: () => void) => {
    fn();
    reset();
  };

  return (
    <VizLayout>
      <Controls>
        <Slider
          label={
            <>
              Starthøyde h<Sub>0</Sub>
            </>
          }
          ariaLabel="Starthøyde"
          value={h0}
          onChange={(v) => change(() => setH0(v))}
          min={0.5}
          max={5.5}
          step={0.1}
          unit="m"
          decimals={1}
        />
        <Slider label="Masse m" value={m} onChange={setM} min={20} max={100} step={1} unit="kg" decimals={0} />
      </Controls>
      <Toolbar>
        <Segmented label="Velg bane" options={KINDS} value={kind} onChange={(k) => change(() => setKind(k))} />
        <Toggle label={`Med friksjon (μ = ${fmt(MU, 2)})`} checked={friction} onChange={(on) => change(() => setFriction(on))} />
      </Toolbar>
      <Toolbar>
        <PlayControls clock={clock} decimals={1} />
      </Toolbar>

      <div ref={ref}>
        <Figure
          viewBox={`0 0 800 ${sceneHeight(track, narrow)}`}
          label={`Kule på en ${kind === 'rampe' ? 'U-rampe' : 'bakke med en topp i midten'}, startet i ${fmt(h0, 1)} m høyde, med søyler for potensiell, kinetisk og mekanisk energi${friction ? ' og varme' : ''}.`}
          maxHeight={narrow ? 480 : 440}
        >
          <Scene track={track} sim={sim} p={p} h0={h0} m={m} friction={friction} narrow={narrow} />
        </Figure>
      </div>
      <Legend
        items={[
          { color: C_EP, label: 'Potensiell energi Ep' },
          { color: C_EK, label: 'Kinetisk energi Ek' },
          { color: C_E, label: 'Mekanisk energi E = Ep + Ek' },
          ...(friction ? [{ color: C_Q, label: 'Varme Q (fra friksjonsarbeidet)' }] : []),
        ].map((it) => ({ ...it, label: <LegendText text={it.label} /> }))}
      />

      <Figure viewBox={`0 0 800 ${narrow ? 460 : 320}`} label="Energi som funksjon av posisjonen langs banen." maxHeight={narrow ? 500 : 360}>
        <EnergyPlot track={track} sim={sim} t={t} p={p} m={m} height={narrow ? 460 : 320} />
      </Figure>

      <Readouts>
        <Readout
          label={
            <>
              Potensiell E<Sub>p</Sub>
            </>
          }
          value={fmt(p.Ep, 0)}
          unit="J"
          tone={C_EP}
        />
        <Readout
          label={
            <>
              Kinetisk E<Sub>k</Sub>
            </>
          }
          value={fmt(p.Ek, 0)}
          unit="J"
          tone={C_EK}
        />
        <Readout label="Mekanisk E" value={fmt(p.E, 0)} unit="J" />
        {friction ? <Readout label="Varme Q" value={fmt(p.heat, 0)} unit="J" tone={C_Q} /> : <Readout label="Fart v" value={fmt(Math.abs(p.v), 1)} unit="m/s" tone={C_EK} />}
      </Readouts>

      <Formula label="Energien akkurat nå">
        <FormulaLine>
          E<Sub>p</Sub> = mgh = {fmt(m, 0)} kg · 9,81 m/s² · {fmt(p.h, 2)} m = {fmt(p.Ep, 0)} J
        </FormulaLine>
        <FormulaLine>
          E<Sub>k</Sub> = ½mv² = ½ · {fmt(m, 0)} kg · ({fmt(Math.abs(p.v), 2)} m/s)² = {fmt(p.Ek, 0)} J
        </FormulaLine>
        <FormulaLine>
          E = E<Sub>p</Sub> + E<Sub>k</Sub> = {fmt(p.E, 0)} J
          {friction && (
            <>
              {' '}
              = E<Sub>0</Sub> + W<Sub>R</Sub> = {fmt(sim.E0, 0)} J − {fmt(p.heat, 0)} J
            </>
          )}
        </FormulaLine>
      </Formula>

      <Explain>{explanation({ track, sim, p, t, h0, m, friction, stopped })}</Explain>
    </VizLayout>
  );
}

/** «Ep» og «Ek» med senket skrift i fargeforklaringen. */
function LegendText({ text }: { text: string }) {
  const parts = text.split(/(E[pk])/);
  return (
    <span>
      {parts.map((part, i) =>
        part === 'Ep' || part === 'Ek' ? (
          <span key={i}>
            E<Sub>{part[1]}</Sub>
          </span>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </span>
  );
}

/* ---------- Bane, kule og energisøyler ---------- */

/** Banen tegnes uten fortegning (like mange piksler per meter loddrett og vannrett). */
function sceneScale(track: Track, narrow: boolean) {
  const left = 24;
  // Søylene trenger mer plass til etikettene på mobil
  const right = narrow ? 490 : 556;
  return { left, right, ppm: (right - left) / (track.xMax - track.xMin) };
}

/** Høyden på figuren: plass til overskrift, banen og etikettene under søylene (tekstskala ca. 1,8 på mobil). */
function sceneHeight(track: Track, narrow: boolean): number {
  const f = narrow ? 1.84 : 1;
  return Math.round(50 + 24 * f + track.top * sceneScale(track, narrow).ppm + 16 + 28 * f);
}

function Scene({ track, sim, p, h0, m, friction, narrow }: { track: Track; sim: TrackSim; p: TrackSample; h0: number; m: number; friction: boolean; narrow: boolean }) {
  const f = useTextScale();
  const H = sceneHeight(track, narrow);
  // Plass til etikettene under søylene, som er større på mobil
  const groundY = H - 16 - 28 * f;
  const { left, ppm } = sceneScale(track, narrow);
  const X = (x: number) => left + (x - track.xMin) * ppm;
  const Y = (h: number) => groundY - h * ppm;
  const pts = sample(track.height, track.xMin, track.xMax, 160);
  const surface = pts.map(([x, h], i) => `${i ? 'L' : 'M'}${X(x).toFixed(1)},${Y(h).toFixed(1)}`).join('');
  const k = narrow ? 1.35 : 1;
  const r = 13 * k;
  const hp = track.slope(p.x);
  const len = Math.sqrt(1 + hp * hp);
  // Normalvektor (opp fra banen) og tangent i SVG-koordinater
  const nx = -hp / len;
  const ny = -1 / len;
  const tx = 1 / len;
  const ty = -hp / len;
  const bx = X(p.x) + nx * r;
  const by = Y(p.h) + ny * r;
  const vLen = p.v * 10 * k;

  // Søylene
  const bars = [
    { label: 'p', value: p.Ep, color: C_EP },
    { label: 'k', value: p.Ek, color: C_EK },
    { label: '', value: p.E, color: C_E },
    { label: 'Q', value: p.heat, color: C_Q },
  ];
  const bLeft = narrow ? 540 : 600;
  const bRight = 784;
  const slot = (bRight - bLeft) / bars.length;
  const bw = Math.min(34 * k, slot * 0.62);
  const bBase = groundY;
  // Søylene har samme høydeskala som banen: E_p-søylen er like høy som kula ligger, og E₀ står på linja for h₀.
  const scale = (E: number) => (E / (m * G_EARTH)) * ppm;

  return (
    <g>
      {/* Banen */}
      <path d={`${surface}L${X(track.xMax)},${groundY + 40 * f}L${X(track.xMin)},${groundY + 40 * f}Z`} fill={VIZ.body} />
      <path d={surface} fill="none" stroke={VIZ.muted} strokeWidth={3} />
      {/* Starthøyden */}
      <line x1={X(track.xMin)} x2={bLeft - 6} y1={Y(h0)} y2={Y(h0)} stroke={C_EP} strokeWidth={1.5} strokeDasharray="6 6" opacity={0.8} />
      <Label x={X(track.xMax) - 4} y={Y(h0) - 8} anchor="end" color={C_EP}>
        h<TSub>0</TSub> = {fmt(h0, 1)} m
      </Label>
      <Label x={X(track.xBottom)} y={Y(0) + 22 * f} anchor="middle" muted>
        nullnivå, h = 0
      </Label>
      {track.hump && (
        <Label x={X(track.hump.x) + 18 * k} y={Y(track.hump.h) - 14} anchor="start" muted>
          topp {fmt(track.hump.h, 1)} m
        </Label>
      )}
      {/* Kula med fartspil langs banen */}
      <circle cx={bx} cy={by} r={r} fill={VIZ.bodyStrong} className="viz-block" />
      <Arrow
        x1={bx + nx * (r + 8)}
        y1={by + ny * (r + 8)}
        x2={bx + nx * (r + 8) + tx * vLen}
        y2={by + ny * (r + 8) + ty * vLen}
        color={C_EK}
        width={3 * k}
        head={11 * k}
        label="v"
        minLength={6}
      />

      {/* Energisøyler */}
      <line x1={bLeft - 6} x2={bRight + 4} y1={bBase} y2={bBase} className="viz-axis" />
      <line x1={bLeft - 6} x2={bRight + 4} y1={bBase - scale(sim.E0)} y2={bBase - scale(sim.E0)} stroke={VIZ.ink} strokeWidth={1.5} strokeDasharray="5 5" />
      <Label x={bRight + 4} y={bBase - scale(sim.E0) - 8} anchor="end" muted>
        E<TSub>0</TSub>
      </Label>
      {bars.map((b, i) => {
        const cx = bLeft + slot * (i + 0.5);
        const hgt = scale(b.value);
        return (
          <g key={i}>
            {i === 2 ? (
              <>
                <rect x={cx - bw / 2} y={bBase - scale(p.Ep)} width={bw} height={scale(p.Ep)} fill={C_EP} opacity={0.85} />
                <rect x={cx - bw / 2} y={bBase - hgt} width={bw} height={Math.max(0, hgt - scale(p.Ep))} fill={C_EK} opacity={0.85} />
                <rect x={cx - bw / 2} y={bBase - hgt} width={bw} height={hgt} fill="none" stroke={C_E} strokeWidth={2} />
              </>
            ) : (
              <rect x={cx - bw / 2} y={bBase - hgt} width={bw} height={hgt} fill={b.color} opacity={i === 3 && !friction ? 0.3 : 0.85} />
            )}
            <Label x={cx} y={bBase + 24 * f} anchor="middle" color={b.color}>
              {b.label === 'Q' ? 'Q' : b.label ? <>E<TSub>{b.label}</TSub></> : 'E'}
            </Label>
          </g>
        );
      })}
      <Label x={left} y={24 * f} anchor="start" muted>
        {fmt(m, 0)} kg{friction ? `, friksjon μ = ${fmt(MU, 2)}` : ', uten friksjon'}
      </Label>
    </g>
  );
}

/* ---------- Energi som funksjon av posisjon ---------- */

function EnergyPlot({ track, sim, t, p, m, height }: { track: Track; sim: TrackSim; t: number; p: TrackSample; m: number; height: number }) {
  const f = useTextScale();
  const yMax = niceCeil(m * G_EARTH * track.top * 1.02, 4);
  const upto = sim.samples.slice(0, Math.round(t / sim.every) + 1);
  return (
    <Plot
      x={{ min: track.xMin, max: track.xMax, label: 'Posisjon x (m)' }}
      y={{ min: 0, max: yMax, label: 'Energi (J)' }}
      width={800}
      height={height}
      margin={{ top: 46 * f, right: 24 * f, bottom: 56 * f, left: 84 * f }}
    >
      {({ sx, sy, x0, y1 }) => (
          <g>
            <Label x={x0 - 76 * f} y={y1 - 20 * f} anchor="start" muted>
              Fra E<TSub>p</TSub>-kurven opp til E-linja: E<TSub>k</TSub>
            </Label>
            <path d={linePath(sample((x) => m * G_EARTH * track.height(x), track.xMin, track.xMax, 160), sx, sy)} fill="none" stroke={C_EP} strokeWidth={3} />
            <line x1={sx(track.xMin)} x2={sx(track.xMax)} y1={sy(sim.E0)} y2={sy(sim.E0)} stroke={C_E} strokeWidth={1.5} strokeDasharray="6 6" opacity={0.6} />
            {sim.R > 0 && <path d={linePath(upto.map((q) => [q.x, q.E]), sx, sy)} fill="none" stroke={C_E} strokeWidth={2} opacity={0.75} />}
            {/* Søyle i posisjonen: E_p nederst, E_k oppå */}
            <line x1={sx(p.x)} x2={sx(p.x)} y1={sy(0)} y2={sy(p.Ep)} stroke={C_EP} strokeWidth={9} />
            <line x1={sx(p.x)} x2={sx(p.x)} y1={sy(p.Ep)} y2={sy(p.E)} stroke={C_EK} strokeWidth={9} />
            <ColorDot x={sx(p.x)} y={sy(p.E)} color={C_E} r={6} />
          </g>
      )}
    </Plot>
  );
}

/* ---------- Forklaring ---------- */

function explanation({
  track,
  sim,
  p,
  t,
  h0,
  m,
  friction,
  stopped,
}: {
  track: Track;
  sim: TrackSim;
  p: TrackSample;
  t: number;
  h0: number;
  m: number;
  friction: boolean;
  stopped: boolean;
}): ReactNode {
  const speed = Math.abs(p.v);
  // dh/dt = h′(x) · dx/dt, og dx/dt har samme fortegn som v
  const goingDown = track.slope(p.x) * p.v < 0;
  let phase: ReactNode;
  if (stopped)
    phase = (
      <>
        <strong>Kula har stoppet.</strong> Friksjonen har gjort om {fmt(p.heat, 0)} J av den mekaniske energien til varme.
      </>
    );
  else if (t === 0)
    phase = (
      <>
        <strong>Kula ligger i ro i høyden h<Sub>0</Sub> = {fmt(h0, 1)} m.</strong> All energien er potensiell: E<Sub>p</Sub> = mgh<Sub>0</Sub> ={' '}
        {fmt(sim.E0, 0)} J. Høyden måles fra nullnivået i bunnen av banen; et annet nullnivå ville endret E<Sub>p</Sub>, men ikke
        endringene i energi.
      </>
    );
  else if (speed < 0.3)
    phase = (
      <>
        <strong>Vendepunkt:</strong> farten er null, så all den mekaniske energien er potensiell.
        {friction && p.h < h0 - 0.05 ? ' Vendepunktet ligger lavere enn startpunktet, fordi en del av energien er blitt varme.' : ''}
      </>
    );
  else
    phase = goingDown ? (
      <>
        <strong>På vei ned</strong> blir potensiell energi til kinetisk energi, og farten øker (nå {fmt(speed, 1)} m/s).
      </>
    ) : (
      <>
        <strong>På vei opp</strong> blir kinetisk energi til potensiell energi, og farten avtar (nå {fmt(speed, 1)} m/s).
      </>
    );

  const balance = friction ? (
    <>
      Friksjonen gjør negativt arbeid, W<Sub>R</Sub> = −R·s = −{fmt(p.heat, 0)} J, så den mekaniske energien har minket like mye: ΔE = W
      <Sub>R</Sub>. Energien forsvinner ikke, men blir varme Q.
    </>
  ) : (
    <>
      Bare tyngdekraften gjør arbeid, så den mekaniske energien er bevart: E = E<Sub>p</Sub> + E<Sub>k</Sub> = {fmt(sim.E0, 0)} J hele tiden.
    </>
  );

  let extra: ReactNode = null;
  if (track.hump) {
    const need = m * G_EARTH * track.hump.h;
    extra =
      p.E <= need ? (
        <>
          {' '}
          Kula kommer ikke over toppen i midten: da måtte E vært større enn mg · {fmt(track.hump.h, 1)} m = {fmt(need, 0)} J.
        </>
      ) : (
        <>
          {' '}
          Kula kommer over toppen i midten fordi E er større enn mg · {fmt(track.hump.h, 1)} m = {fmt(need, 0)} J.
        </>
      );
  } else if (!friction) {
    extra = <> Farten er uavhengig av massen, fordi både E<Sub>p</Sub> og E<Sub>k</Sub> er proporsjonale med m.</>;
  }

  // Ved start holder det med starttilstanden og nullnivået (og eventuelt toppen i midten)
  if (t === 0 && !stopped)
    return (
      <p>
        {phase}
        {track.hump ? extra : null}
      </p>
    );
  return (
    <p>
      {phase} {balance}
      {extra}
    </p>
  );
}
