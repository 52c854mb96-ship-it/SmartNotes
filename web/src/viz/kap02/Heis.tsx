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
  Segmented,
  Slider,
  Toolbar,
  VIZ,
  VizLayout,
  fmt,
  G_EARTH,
  linePath,
  useSimClock,
  useTextScale,
} from '../kit';
import { LIFT_T_END, liftPhases, liftState, scaleForce, type LiftPhase, type LiftTrip } from './model';
import { useNarrow } from './useNarrow';

const TRIPS: { value: LiftTrip; label: string }[] = [
  { value: 'opp', label: 'Tur opp' },
  { value: 'ned', label: 'Tur ned' },
  { value: 'fritt-fall', label: 'Kabelen ryker' },
];

/** Tidspunktet som vises når siden åpnes eller turen byttes (midt i første akselerasjon). */
const T_START = 2;

export default function Heis() {
  const [trip, setTrip] = useState<LiftTrip>('opp');
  const [m, setM] = useState(70);
  const [a0, setA0] = useState(2);
  const clock = useSimClock({ tMax: LIFT_T_END });
  const { setT, pause } = clock;
  useEffect(() => setT(T_START), [setT]);

  const changeTrip = (next: LiftTrip) => {
    setTrip(next);
    pause();
    setT(T_START);
  };

  const phases = liftPhases(trip, a0);
  const st = liftState(phases, clock.t);
  const G = m * G_EARTH;
  const N = scaleForce(m, st.a);
  const reading = N / G_EARTH;
  const [graphRef, narrow] = useNarrow<HTMLDivElement>();
  const graphH = narrow ? 440 : 340;

  return (
    <VizLayout>
      <Controls>
        <Slider label="Masse m" value={m} onChange={setM} min={40} max={120} step={1} unit="kg" />
        {trip !== 'fritt-fall' && (
          <Slider
            label="Akselerasjon ved start og stopp"
            value={a0}
            onChange={setA0}
            min={0.5}
            max={3}
            step={0.1}
            unit="m/s²"
            decimals={1}
          />
        )}
        <Slider
          label="Tid t"
          value={clock.t}
          onChange={(t) => {
            pause();
            setT(t);
          }}
          min={0}
          max={LIFT_T_END}
          step={0.1}
          unit="s"
          decimals={1}
        />
      </Controls>
      <Toolbar>
        <Segmented label="Velg heistur" options={TRIPS} value={trip} onChange={changeTrip} />
        <PlayControls clock={clock} decimals={1} />
      </Toolbar>

      <Figure
        viewBox="0 0 800 420"
        label={`Person på ${fmt(m, 0)} kg som står på en vekt i en heis. ${phaseName(st.phase, trip)}. Vekta viser ${fmt(reading, 1)} kg.`}
        maxHeight={420}
      >
        <Scene trip={trip} a0={a0} t={clock.t} phase={st.phase} a={st.a} v={st.v} y={st.y} G={G} N={N} reading={reading} />
      </Figure>

      <div ref={graphRef}>
        <Figure viewBox={`0 0 800 ${graphH}`} label="Graf over normalkraften fra vekta gjennom heisturen">
          <ForceGraph phases={phases} t={clock.t} m={m} N={N} G={G} height={graphH} />
        </Figure>
      </div>
      <Legend
        items={[
          { color: VIZ.normal, label: 'Normalkraft N fra vekta' },
          { color: VIZ.gravity, label: 'Tyngde G = mg', dashed: true },
        ]}
      />

      <Readouts>
        <Readout label="Akselerasjon a" value={fmt(st.a, 2)} unit="m/s²" tone={VIZ.acceleration} />
        <Readout label="Fart v" value={fmt(st.v, 1)} unit="m/s" tone={VIZ.velocity} />
        <Readout label="Normalkraft N" value={fmt(N, 0)} unit="N" tone={VIZ.normal} />
        <Readout label="Vekta viser" value={fmt(reading, 1)} unit="kg" />
      </Readouts>

      <Formula label="Newtons 2. lov for personen, med positiv retning oppover">
        <FormulaLine>ΣF = N − G = m · a</FormulaLine>
        <FormulaLine>
          N = m(g + a) = {fmt(m, 0)} kg · (9,81 m/s² {st.a < 0 ? '−' : '+'} {fmt(Math.abs(st.a), 2)} m/s²) = {fmt(N, 0)} N
        </FormulaLine>
        <FormulaLine>
          Vekta viser N/g = {fmt(N, 0)} N / 9,81 m/s² = {fmt(reading, 1)} kg
        </FormulaLine>
      </Formula>

      <Explain>
        {explanation(st.phase, trip, st.a, st.v, N, G, m, reading, clock.t)}
        {(st.a < -1e-9 || st.v < -1e-9) && (
          <p>Positiv retning er oppover, så fart og akselerasjon nedover har negativt fortegn.</p>
        )}
      </Explain>
    </VizLayout>
  );
}

function phaseName(phase: LiftPhase, trip: LiftTrip): string {
  const up = trip === 'opp';
  switch (phase.kind) {
    case 'ro':
      return 'Står i ro';
    case 'akselererer':
      return up ? 'Starter oppover' : 'Starter nedover';
    case 'konstant':
      return up ? 'Konstant fart oppover' : 'Konstant fart nedover';
    case 'bremser':
      return up ? 'Bremser på vei opp' : 'Bremser på vei ned';
    case 'fritt-fall':
      return 'Fritt fall';
    case 'nodbrems':
      return 'Nødbremsen tar tak';
  }
}

/** Høyden (m) heisen starter i, så hele turen og heisen (3 m) får plass i sjakten (0–44 m). */
function startHeight(trip: LiftTrip, a0: number): number {
  if (trip === 'opp') return 0;
  if (trip === 'ned') return 12 * a0;
  return 2 * G_EARTH * 2;
}

const SHAFT = { x: 40, w: 76, top: 20, bottom: 404, metres: 44 };
const CAR = { x: 168, w: 304, top: 46, floor: 394 };
const CX = CAR.x + CAR.w / 2;
const SCALE_TOP = CAR.floor - 24;
/** Lengden på G-pila i piksler. N tegnes i samme skala. */
const LG = 100;

function Scene({
  trip,
  a0,
  t,
  phase,
  a,
  v,
  y,
  G,
  N,
  reading,
}: {
  trip: LiftTrip;
  a0: number;
  t: number;
  phase: LiftPhase;
  a: number;
  v: number;
  y: number;
  G: number;
  N: number;
  reading: number;
}) {
  const f = useTextScale();
  const broken = trip === 'fritt-fall' && t >= 1;

  // Sjakten med en liten heis som viser hvor i bygningen heisen er
  const h = startHeight(trip, a0) + y;
  const perM = (SHAFT.bottom - SHAFT.top) / SHAFT.metres;
  const miniBottom = SHAFT.bottom - h * perM;
  const miniH = 3 * perM;
  const floors: number[] = [];
  for (let k = 0; k <= SHAFT.metres; k += 4) floors.push(SHAFT.bottom - k * perM);

  // Piler: v og a skaleres så den største verdien på turen blir ca. 120 px
  const vMax = trip === 'fritt-fall' ? 2 * G_EARTH : 2 * Math.max(a0, 1.5);
  const aMax = trip === 'fritt-fall' ? G_EARTH : Math.max(a0, 1.5);
  const vLen = (v / vMax) * 108;
  const aLen = (a / aMax) * 108;
  const ARROW_Y = 166;
  const k = LG / G;
  const nLen = N * k;

  // Personen
  const feet = SCALE_TOP;
  const cm = { x: CX, y: feet - 110 };

  return (
    <>
      {/* Sjakt */}
      <rect x={SHAFT.x} y={SHAFT.top} width={SHAFT.w} height={SHAFT.bottom - SHAFT.top} fill="none" stroke={VIZ.grid} strokeWidth={2} />
      {floors.map((fy) => (
        <line key={fy} x1={SHAFT.x} y1={fy} x2={SHAFT.x + 12} y2={fy} stroke={VIZ.muted} strokeWidth={1.5} />
      ))}
      {broken ? (
        <line
          x1={SHAFT.x + SHAFT.w / 2}
          y1={SHAFT.top}
          x2={SHAFT.x + SHAFT.w / 2}
          y2={SHAFT.top + 26}
          stroke={VIZ.tension}
          strokeWidth={2}
        />
      ) : (
        <line
          x1={SHAFT.x + SHAFT.w / 2}
          y1={SHAFT.top}
          x2={SHAFT.x + SHAFT.w / 2}
          y2={miniBottom - miniH}
          stroke={VIZ.tension}
          strokeWidth={2}
        />
      )}
      <rect
        x={SHAFT.x + 16}
        y={miniBottom - miniH}
        width={SHAFT.w - 24}
        height={miniH}
        rx={3}
        fill={VIZ.bodyStrong}
        className="viz-block"
      />
      <line x1={SHAFT.x + SHAFT.w} y1={miniBottom - miniH / 2} x2={CAR.x - 6} y2={CAR.top + 40} className="viz-guide" opacity={0.6} />

      {/* Heisen i snitt */}
      {broken ? (
        <>
          <line x1={CX} y1={0} x2={CX} y2={10} stroke={VIZ.tension} strokeWidth={3} />
          <line x1={CX} y1={CAR.top - 14} x2={CX} y2={CAR.top} stroke={VIZ.tension} strokeWidth={3} />
        </>
      ) : (
        <line x1={CX} y1={0} x2={CX} y2={CAR.top} stroke={VIZ.tension} strokeWidth={3} />
      )}
      <rect
        x={CAR.x}
        y={CAR.top}
        width={CAR.w}
        height={CAR.floor - CAR.top}
        rx={8}
        fill={VIZ.body}
        fillOpacity={0.35}
        className="viz-block"
      />
      <rect x={CAR.x} y={CAR.floor} width={CAR.w} height={10} rx={3} fill={VIZ.bodyStrong} className="viz-block" />

      {/* Vekt */}
      <rect x={CX - 70} y={SCALE_TOP} width={140} height={CAR.floor - SCALE_TOP} rx={6} fill={VIZ.bodyStrong} className="viz-block" />
      <rect x={CX - 26} y={SCALE_TOP + 6} width={52} height={12} rx={3} fill={VIZ.surface} stroke={VIZ.muted} strokeWidth={1} />

      <Person cx={CX} feet={feet} />

      {/* Krefter på personen, tegnet like ved siden av kroppen så de ikke skjules */}
      <Arrow
        x1={CX - 54}
        y1={cm.y}
        x2={CX - 54}
        y2={cm.y + LG}
        color={VIZ.gravity}
        label="G"
        labelAnchor="end"
        labelX={CX - 66}
        labelY={cm.y + LG - 4}
      />
      {nLen > 2 ? (
        <Arrow
          x1={CX + 54}
          y1={feet}
          x2={CX + 54}
          y2={feet - nLen}
          color={VIZ.normal}
          label="N"
          labelAnchor="start"
          labelX={CX + 66}
          labelY={feet - nLen + 14}
        />
      ) : (
        <Label x={CX + 50} y={feet - 12} anchor="start" color={VIZ.normal}>
          N = 0
        </Label>
      )}

      {/* Fart og akselerasjon */}
      <Label x={780} y={34} anchor="end" muted>
        {phaseName(phase, trip)}
      </Label>
      <MotionArrow x={572} y={ARROW_Y} len={-vLen} color={VIZ.velocity} name="v" f={f} />
      <MotionArrow x={718} y={ARROW_Y} len={-aLen} color={VIZ.acceleration} name="a" f={f} />

      <Label x={CAR.x + CAR.w + 34} y={CAR.floor - 44 * f} anchor="start" muted>
        vekta viser
      </Label>
      <Label x={CAR.x + CAR.w + 34} y={CAR.floor} anchor="start" size={34 * Math.min(f, 1.5)} weight={700}>
        {fmt(reading, 1)} kg
      </Label>
    </>
  );
}

/** Loddrett pil for fart eller akselerasjon. `len` er i piksler, negativ oppover. */
function MotionArrow({ x, y, len, color, name, f }: { x: number; y: number; len: number; color: string; name: string; f: number }) {
  if (Math.abs(len) < 3)
    return (
      <>
        <circle cx={x} cy={y} r={4} fill={color} />
        <Label x={x} y={y - 14} color={color}>
          {name} = 0
        </Label>
      </>
    );
  const up = len < 0;
  return (
    <Arrow
      x1={x}
      y1={y}
      x2={x}
      y2={y + len}
      color={color}
      label={name}
      labelAnchor="start"
      labelX={x + 12}
      labelY={up ? y + len + 6 * f + 4 : y + len}
    />
  );
}

function Person({ cx, feet }: { cx: number; feet: number }) {
  const legTop = feet - 84;
  const torsoTop = legTop - 92;
  return (
    <g>
      <rect x={cx - 19} y={legTop - 6} width={16} height={feet - legTop + 6} rx={7} fill={VIZ.body} className="viz-block" />
      <rect x={cx + 3} y={legTop - 6} width={16} height={feet - legTop + 6} rx={7} fill={VIZ.body} className="viz-block" />
      <rect x={cx - 37} y={torsoTop + 6} width={14} height={76} rx={7} fill={VIZ.body} className="viz-block" />
      <rect x={cx + 23} y={torsoTop + 6} width={14} height={76} rx={7} fill={VIZ.body} className="viz-block" />
      <rect x={cx - 24} y={torsoTop} width={48} height={96} rx={16} fill={VIZ.body} className="viz-block" />
      <circle cx={cx} cy={torsoTop - 24} r={21} fill={VIZ.body} className="viz-block" />
    </g>
  );
}

function niceCeil(v: number): number {
  if (!(v > 0)) return 1;
  const mag = 10 ** Math.floor(Math.log10(v));
  for (const c of [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10]) if (c * mag >= v - 1e-9) return c * mag;
  return 10 * mag;
}

function ForceGraph({ phases, t, m, N, G, height }: { phases: LiftPhase[]; t: number; m: number; N: number; G: number; height: number }) {
  const f = useTextScale();
  const nMax = Math.max(...phases.map((p) => scaleForce(m, p.a)));
  const yMax = niceCeil(Math.max(nMax, G) * 1.12);
  const pts: [number, number][] = [];
  for (const p of phases) {
    const n = scaleForce(m, p.a);
    pts.push([p.t0, n], [p.t1, n]);
  }
  const current = phases.find((p) => t >= p.t0 && t < p.t1) ?? phases[phases.length - 1];
  return (
    <Plot x={{ min: 0, max: LIFT_T_END, label: 'Tid t (s)' }} y={{ min: 0, max: yMax, label: 'Kraft (N)' }} width={800} height={height}>
      {({ sx, sy, y0, y1 }) => (
        <g>
          {current && (
            <rect x={sx(current.t0)} y={y1} width={sx(current.t1) - sx(current.t0)} height={y0 - y1} fill={VIZ.grid} opacity={0.7} />
          )}
          {phases.map((p) => {
            const w = sx(p.t1) - sx(p.t0);
            const text = p.a > 0 ? 'a > 0' : p.a < 0 ? 'a < 0' : 'a = 0';
            if (w < 95 * f * 0.9) return null;
            return (
              <Label key={p.t0} x={(sx(p.t0) + sx(p.t1)) / 2} y={y1 + 20 * f} muted>
                {text}
              </Label>
            );
          })}
          <line x1={sx(0)} y1={sy(G)} x2={sx(LIFT_T_END)} y2={sy(G)} stroke={VIZ.gravity} strokeWidth={2} strokeDasharray="7 6" />
          <path d={linePath(pts, sx, sy)} fill="none" stroke={VIZ.normal} strokeWidth={3.5} strokeLinejoin="round" />
          <line x1={sx(t)} y1={y0} x2={sx(t)} y2={y1 + 30 * f} className="viz-guide" />
          <Dot x={sx(t)} y={sy(N)} color={VIZ.ink} />
        </g>
      )}
    </Plot>
  );
}

function explanation(
  phase: LiftPhase,
  trip: LiftTrip,
  a: number,
  v: number,
  N: number,
  G: number,
  m: number,
  reading: number,
  t: number,
): ReactNode {
  const n = (x: number) => `${fmt(x, 0)} N`;
  const kg = `${fmt(reading, 1)} kg`;
  const up = trip === 'opp';
  switch (phase.kind) {
    case 'ro':
      return (
        <p>
          <strong>Heisen står i ro{t > 1 ? ' igjen' : ''}.</strong> Da er a = 0, og kraftsummen på deg er null: N = G = mg = {n(G)}. Vekta
          måler egentlig normalkraften og deler på g, så den viser massen din, {fmt(m, 0)} kg.
          {t < 1 &&
            ` Trykk «Spill av» for å se hva som skjer når ${trip === 'fritt-fall' ? 'kabelen ryker' : 'heisen setter i gang'}.`}
        </p>
      );
    case 'akselererer':
      return up ? (
        <p>
          <strong>Heisen øker farten oppover.</strong> Akselerasjonen peker oppover, så kraftsummen må også peke oppover: N må være større
          enn G. N = m(g + a) = {n(N)}, og vekta viser {kg}. Du føler deg tyngre – det vekta viser, kalles den tilsynelatende vekten.
        </p>
      ) : (
        <p>
          <strong>Heisen øker farten nedover.</strong> Akselerasjonen peker nedover, så kraftsummen peker nedover og N er mindre enn G: N =
          m(g − {fmt(Math.abs(a), 2)} m/s²) = {n(N)}. Vekta viser bare {kg}, og det kiler i magen.
        </p>
      );
    case 'konstant':
      return (
        <p>
          <strong>Konstant fart {up ? 'oppover' : 'nedover'}.</strong> Heisen beveger seg med {fmt(Math.abs(v), 1)} m/s, men farten endrer
          seg ikke, så a = 0 og N = G = {n(G)} (Newtons 1. lov). Vekta viser det samme som når heisen står stille. Det er akselerasjonen,
          ikke farten, som bestemmer hva vekta viser.
        </p>
      );
    case 'bremser':
      return up ? (
        <p>
          <strong>Heisen bremser på vei opp.</strong> Den beveger seg fortsatt oppover, men farten avtar, så akselerasjonen peker{' '}
          <em>nedover</em>. Da er N mindre enn G: N = {n(N)}, og vekta viser {kg}. Du føler deg lettere selv om du er på vei opp.
        </p>
      ) : (
        <p>
          <strong>Heisen bremser på vei ned.</strong> Farten nedover avtar, så akselerasjonen peker <em>oppover</em>, akkurat som når heisen
          starter oppover. N = m(g + a) = {n(N)} er større enn G, og vekta viser {kg}.
        </p>
      );
    case 'fritt-fall':
      return (
        <p>
          <strong>Fritt fall.</strong> Kabelen har røket, og både heisen og du faller med a = g = 9,81 m/s² nedover. Tyngden alene gir deg
          denne akselerasjonen, så vekta trenger ikke å dytte: N = m(g − g) = 0. Vekta viser 0 kg og du er vektløs, men tyngden G = {n(G)}{' '}
          virker fortsatt.
        </p>
      );
    case 'nodbrems':
      return (
        <p>
          <strong>Nødbremsen tar tak.</strong> Heisen bremser med a = g oppover mens den fortsatt faller ({fmt(Math.abs(v), 1)} m/s
          nedover). N = m(g + g) = 2mg = {n(N)}, så vekta viser dobbelt så mye som i ro: {kg}.
        </p>
      );
  }
}
