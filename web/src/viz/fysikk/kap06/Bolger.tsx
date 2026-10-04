import { useState, type ReactNode } from 'react';
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
import { crestPositions, maxLongitudinalAmplitude, particleVelocity, period, waveDisplacement, waveSpeed } from './model';
import { ColorDot, Tag, useNarrow } from './marks';

type Kind = 'transversal' | 'longitudinal';

const KINDS: { value: Kind; label: string }[] = [
  { value: 'transversal', label: 'Transversal bølge' },
  { value: 'longitudinal', label: 'Longitudinal bølge' },
];

const X_MAX = 6;
/** Den markerte partikkelen. */
const XP = 3;
const T_WINDOW = 10;
const L_MIN = 0.5;
const L_MAX = 4;
const F_MIN = 0.2;
const F_MAX = 2;
const WAVE = VIZ.series[0];
const MARK = VIZ.series[1];

const clampTo = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export default function Bolger() {
  const [kind, setKind] = useState<Kind>('transversal');
  const [A, setA] = useState(0.3);
  const [wave, setWave] = useState({ lambda: 2, f: 0.5 });
  const [lock, setLock] = useState(true);
  const clock = useSimClock({ tMax: T_WINDOW, loop: true });
  const [graphRef, narrow] = useNarrow<HTMLDivElement>();
  const { lambda, f } = wave;
  const v = waveSpeed(lambda, f);
  const T = period(f);

  // Med fast bølgefart (samme medium) endrer λ og f seg sammen, så v = λf ikke endres.
  const changeLambda = (l: number) =>
    setWave((w) => {
      if (!lock) return { ...w, lambda: l };
      const speed = w.lambda * w.f;
      const nf = clampTo(speed / l, F_MIN, F_MAX);
      return { lambda: clampTo(speed / nf, L_MIN, L_MAX), f: nf };
    });
  const changeF = (nf: number) =>
    setWave((w) => {
      if (!lock) return { ...w, f: nf };
      const speed = w.lambda * w.f;
      const l = clampTo(speed / nf, L_MIN, L_MAX);
      return { lambda: l, f: clampTo(speed / l, F_MIN, F_MAX) };
    });

  const longi = kind === 'longitudinal';
  const Amax = maxLongitudinalAmplitude(lambda);
  const Aeff = longi ? Math.min(A, Amax) : A;
  const clipped = longi && A > Amax + 1e-9;
  const snapH = narrow ? 460 : 300;
  const graphH = narrow ? 400 : 280;

  return (
    <VizLayout>
      <Toolbar>
        <Segmented label="Velg type bølge" options={KINDS} value={kind} onChange={setKind} />
      </Toolbar>
      <Controls>
        <Slider label="Amplitude A" value={A} onChange={setA} min={0.05} max={0.5} step={0.01} unit="m" decimals={2} />
        <Slider label="Bølgelengde λ" value={lambda} onChange={changeLambda} min={L_MIN} max={L_MAX} step={0.05} unit="m" decimals={2} />
        <Slider label="Frekvens f" value={f} onChange={changeF} min={F_MIN} max={F_MAX} step={0.05} unit="Hz" decimals={2} />
      </Controls>
      <Toolbar>
        <Toggle label="Samme medium (fast bølgefart)" checked={lock} onChange={setLock} />
        <PlayControls clock={clock} decimals={1} />
      </Toolbar>

      <div ref={graphRef}>
        <Figure
          viewBox={`0 0 800 ${snapH}`}
          label={`Øyeblikksbilde av en ${kind} bølge med bølgelengde ${fmt(lambda, 2)} m og amplitude ${fmt(Aeff, 2)} m.`}
        >
          <Snapshot kind={kind} t={clock.t} A={Aeff} lambda={lambda} f={f} v={v} height={snapH} />
        </Figure>
      </div>
      <Figure
        viewBox={`0 0 800 ${graphH}`}
        label={`Graf over utslaget til den markerte partikkelen som funksjon av tiden. Perioden er ${fmt(T, 2)} s.`}
      >
        <TimeGraph kind={kind} t={clock.t} A={Aeff} lambda={lambda} f={f} height={graphH} />
      </Figure>
      <Legend
        items={[
          { color: WAVE, label: longi ? 'Partiklene i mediet' : 'Tauet (øyeblikksbilde)' },
          { color: MARK, label: 'Den markerte partikkelen og grafen for den' },
        ]}
      />

      <Readouts>
        <Readout label="Bølgefart v = λf" value={fmt(v, 2)} unit="m/s" tone={VIZ.velocity} />
        <Readout label="Periode T = 1/f" value={fmt(T, 2)} unit="s" />
        <Readout label="Bølgen flytter seg per periode" value={fmt(lambda, 2)} unit="m" tone={WAVE} />
        <Readout label="Partikkelen går per periode, 4A" value={fmt(4 * Aeff, 2)} unit="m" tone={MARK} />
      </Readouts>

      <Formula label="Bølgefart og periode">
        <FormulaLine>
          v = λ · f = {fmt(lambda, 2)} m · {fmt(f, 2)} Hz = {fmt(v, 2)} m/s
        </FormulaLine>
        <FormulaLine>
          T = 1 / f = 1 / {fmt(f, 2)} Hz = {fmt(T, 2)} s
        </FormulaLine>
      </Formula>

      <Explain>{explanation(kind, v, T, lambda, Aeff, lock, clipped)}</Explain>
    </VizLayout>
  );
}

function Snapshot({
  kind,
  t,
  A,
  lambda,
  f,
  v,
  height,
}: {
  kind: Kind;
  t: number;
  A: number;
  lambda: number;
  f: number;
  v: number;
  height: number;
}) {
  const s = useTextScale();

  const longi = kind === 'longitudinal';
  const y = (x: number) => waveDisplacement(x, t, A, lambda, f);
  return (
    <Plot
      x={{ min: 0, max: X_MAX, label: 'Posisjon x (m)' }}
      y={
        longi
          ? { min: -0.95, max: 0.8, label: '', ticks: [] }
          : { min: -0.95, max: 0.8, label: 'Utslag y (m)', ticks: [-0.5, 0, 0.5], decimals: 1 }
      }
      width={800}
      height={height}
    >
      {({ sx, sy }) => {
        // Fartspil for bølgen øverst til venstre
        const vArrow = (
          <g>
            <Arrow x1={sx(0.25)} y1={sy(0.66)} x2={sx(0.25) + 70} y2={sy(0.66)} color={VIZ.velocity} width={3.5} />
            <Tag x={sx(0.25) + 82} y={sy(0.66) + 6} anchor="start" color={VIZ.velocity}>
              v = {fmt(v, 2)} m/s
            </Tag>
          </g>
        );
        if (longi) {
          const rows = [-0.45, -0.225, 0, 0.225, 0.45];
          // Minst 12 partikler per bølgelengde, så fortetningene synes også når λ er kort
          const n = Math.round(X_MAX / Math.min(0.1, lambda / 12));
          const dx = X_MAX / n;
          // Litt større prikker på mobil, så fortetningene synes også når λ er kort
          const r = clampTo(0.32 * dx * (sx(1) - sx(0)), 1.8, 4.5) * Math.min(s, 1.6);
          const dots: ReactNode[] = [];
          for (const ry of rows)
            for (let i = 0; i <= n; i++) {
              const xe = i * dx;
              const xx = xe + y(xe);
              if (xx < 0 || xx > X_MAX) continue;
              const marked = ry === 0 && Math.abs(xe - XP) < dx / 2;
              if (!marked) dots.push(<circle key={`${ry}-${i}`} cx={sx(xx)} cy={sy(ry)} r={r} fill={WAVE} opacity={0.85} />);
            }
          // Fortetning der fasen f·t − x/λ er et heltall, fortynning en halv bølgelengde unna
          const comp = crestPositions(t, lambda, f, -lambda, X_MAX + lambda)
            .map((c) => c + lambda / 4)
            .filter((c) => c > 0.9 && c < X_MAX - 0.9);
          const c0 = comp[0];
          // Fortynningen som står langt nok unna etiketten for fortetningen
          const rare =
            c0 === undefined
              ? undefined
              : Array.from({ length: 24 }, (_, k) => c0 + (Math.floor(k / 2) + 0.5) * lambda * (k % 2 === 0 ? 1 : -1)).find(
                  (x) => x > 0.9 && x < X_MAX - 0.9 && Math.abs(sx(x) - sx(c0)) > 130 * s,
                );
          const showRare = rare !== undefined;
          return (
            <g>
              {dots}
              <line x1={sx(XP - A)} x2={sx(XP + A)} y1={sy(0)} y2={sy(0)} stroke={MARK} strokeWidth={3} strokeDasharray="4 4" />
              <ColorDot x={sx(XP + y(XP))} y={sy(0)} r={9} color={MARK} />
              {c0 !== undefined && (
                <Tag x={sx(c0)} y={sy(-0.62)} muted>
                  fortetning
                </Tag>
              )}
              {showRare && (
                <Tag x={sx(rare!)} y={sy(-0.62)} muted>
                  fortynning
                </Tag>
              )}
              {vArrow}
            </g>
          );
        }
        const pts = sample(y, 0, X_MAX, 360);
        // Minst 8 partikler per bølgelengde
        const nb = Math.round(X_MAX / Math.min(0.2, lambda / 8));
        const beads: ReactNode[] = [];
        for (let i = 0; i <= nb; i++) {
          const xe = (i * X_MAX) / nb;
          if (Math.abs(xe - XP) < X_MAX / nb / 2) continue;
          beads.push(<circle key={i} cx={sx(xe)} cy={sy(y(xe))} r={nb > 40 ? 3 : 4} fill={WAVE} />);
        }
        // λ mellom to bølgedaler (eller topper) nederst, A ved en topp eller dal nær venstre kant
        const crests = crestPositions(t, lambda, f, 0, X_MAX);
        const troughs = crestPositions(t + 0.5 / f, lambda, f, 0, X_MAX);
        // Mellom to daler, eller mellom to topper når ingen dal har plass (lange bølger), så målet ikke blinker under avspillingen
        const start = troughs.find((p) => p + lambda <= X_MAX + 1e-9) ?? crests.find((p) => p + lambda <= X_MAX + 1e-9);
        const dimY = sy(-A - 0.14);
        const aAt = [...crests.map((c) => ({ x: c, up: true })), ...troughs.map((c) => ({ x: c, up: false }))]
          .filter((p) => p.x > 0.25 && p.x < 2.6)
          .sort((p, q) => p.x - q.x)[0];
        const u = particleVelocity(XP, t, A, lambda, f);
        const uMax = 2 * Math.PI * f * A;
        const uLen = uMax > 0 ? (u / uMax) * 46 : 0;
        return (
          <g>
            <path d={linePath(pts, sx, sy)} fill="none" stroke={WAVE} strokeWidth={3} strokeLinejoin="round" />
            {beads}
            {start !== undefined && (
              <g>
                <line x1={sx(start)} x2={sx(start)} y1={sy(y(start)) + 4} y2={dimY + 8} className="viz-guide" />
                <line x1={sx(start + lambda)} x2={sx(start + lambda)} y1={sy(y(start + lambda)) + 4} y2={dimY + 8} className="viz-guide" />
                <Arrow x1={sx(start + lambda / 2)} y1={dimY} x2={sx(start) + 1} y2={dimY} color={VIZ.ink} width={1.8} head={9} />
                <Arrow x1={sx(start + lambda / 2)} y1={dimY} x2={sx(start + lambda) - 1} y2={dimY} color={VIZ.ink} width={1.8} head={9} />
                <Tag x={sx(start + lambda / 2)} y={dimY + 22 * s}>
                  λ
                </Tag>
              </g>
            )}
            {aAt && Math.abs(sy(A) - sy(0)) > 16 && (
              <g>
                <Arrow x1={sx(aAt.x)} y1={sy(0)} x2={sx(aAt.x)} y2={sy(aAt.up ? A : -A)} color={VIZ.ink} width={1.8} head={9} />
                <Tag x={sx(aAt.x) - 10} y={sy(aAt.up ? A / 2 : -A / 2) + 6} anchor="end">
                  A
                </Tag>
              </g>
            )}
            {/* Den markerte partikkelen beveger seg bare opp og ned langs den stiplede streken */}
            <line x1={sx(XP)} x2={sx(XP)} y1={sy(A)} y2={sy(-A)} stroke={MARK} strokeWidth={3} strokeDasharray="4 4" />
            {Math.abs(uLen) > 8 && (
              <Arrow x1={sx(XP) + 18} y1={sy(y(XP))} x2={sx(XP) + 18} y2={sy(y(XP)) - uLen} color={MARK} width={3} head={11} />
            )}
            <ColorDot x={sx(XP)} y={sy(y(XP))} r={9} color={MARK} />
            {vArrow}
          </g>
        );
      }}
    </Plot>
  );
}

function TimeGraph({ kind, t, A, lambda, f, height }: { kind: Kind; t: number; A: number; lambda: number; f: number; height: number }) {
  const s = useTextScale();
  const yp = (tt: number) => waveDisplacement(XP, tt, A, lambda, f);
  const T = period(f);
  // Første topp: f·t − x/λ = 1/4 + n
  const n0 = Math.ceil(XP / lambda - 0.25 - 1e-9);
  let tPeak = (0.25 + n0 - XP / lambda) / f;
  while (tPeak < 0) tPeak += T;
  const dimY = A + 0.13;
  return (
    <Plot
      x={{ min: 0, max: T_WINDOW, label: 'Tid t (s)' }}
      y={{ min: -0.65, max: 0.8, label: kind === 'longitudinal' ? 'Forskyvning (m)' : 'Utslag y (m)', ticks: [-0.5, 0, 0.5], decimals: 1 }}
      width={800}
      height={height}
    >
      {({ sx, sy }) => (
        <g>
          <path d={linePath(sample(yp, 0, T_WINDOW, 800), sx, sy)} fill="none" stroke={MARK} strokeWidth={3} />
          {tPeak + T <= T_WINDOW && (
            <g>
              <line x1={sx(tPeak)} x2={sx(tPeak)} y1={sy(A) - 4} y2={sy(dimY) - 8} className="viz-guide" />
              <line x1={sx(tPeak + T)} x2={sx(tPeak + T)} y1={sy(A) - 4} y2={sy(dimY) - 8} className="viz-guide" />
              <Arrow x1={sx(tPeak + T / 2)} y1={sy(dimY)} x2={sx(tPeak) + 1} y2={sy(dimY)} color={VIZ.ink} width={1.8} head={9} />
              <Arrow x1={sx(tPeak + T / 2)} y1={sy(dimY)} x2={sx(tPeak + T) - 1} y2={sy(dimY)} color={VIZ.ink} width={1.8} head={9} />
              <Tag x={sx(tPeak + T) + 8} y={sy(dimY) + 6} anchor="start">
                T
              </Tag>
            </g>
          )}
          <line x1={sx(t)} x2={sx(t)} y1={sy(-0.65)} y2={sy(0.8)} stroke={VIZ.ink} strokeWidth={1.5} opacity={0.4} />
          <ColorDot x={sx(t)} y={sy(yp(t))} r={8 * Math.min(s, 1.2)} color={MARK} />
        </g>
      )}
    </Plot>
  );
}

function explanation(kind: Kind, v: number, T: number, lambda: number, A: number, lock: boolean, clipped: boolean): ReactNode {
  const first =
    kind === 'transversal' ? (
      <p>
        <strong>Bølgen flytter seg, partiklene gjør det ikke.</strong> Formen går mot høyre med v = {fmt(v, 2)} m/s, men den markerte
        partikkelen svinger bare opp og ned. På én periode, T = {fmt(T, 2)} s, flytter bølgen seg én bølgelengde ({fmt(lambda, 2)} m), mens
        partikkelen går en strekning 4A = {fmt(4 * A, 2)} m og er tilbake der den startet.
      </p>
    ) : (
      <p>
        <strong>Longitudinal bølge.</strong> Partiklene svinger fram og tilbake langs fartsretningen til bølgen, så det blir fortetninger og
        fortynninger. Det er mønsteret som flytter seg med v = {fmt(v, 2)} m/s, ikke partiklene. Lyd i luft er en slik bølge.
        {clipped ? ` Amplituden er begrenset til ${fmt(A, 2)} m her, ellers ville nabopartiklene passert hverandre.` : ''}
      </p>
    );
  // I øyeblikksbildet av en longitudinal bølge er det fortetningene (ikke toppene) som ligger λ fra hverandre
  const distance =
    kind === 'transversal'
      ? 'Avstanden mellom to topper er λ i øyeblikksbildet, men T i grafen for én partikkel.'
      : 'Avstanden mellom to fortetninger er λ i øyeblikksbildet, mens avstanden mellom to topper i grafen for én partikkel er T.';
  const second = lock ? (
    <p>
      Bølgefarten bestemmes av mediet, så den er fast her. Øker du frekvensen, blir bølgelengden kortere, og v = λf er den samme. {distance}
    </p>
  ) : (
    <p>
      Nå kan λ og f endres hver for seg, som om du byttet til et annet medium med en annen bølgefart. {distance}
    </p>
  );
  return (
    <>
      {first}
      {second}
    </>
  );
}
