import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  BIO,
  Controls,
  Explain,
  Figure,
  Formula,
  FormulaLine,
  Kanalprotein,
  Legend,
  Membran,
  NaKPumpe,
  PlayBar,
  Plot,
  Readout,
  Readouts,
  Segmented,
  Slider,
  Toolbar,
  Txt,
  VIZ,
  VizLayout,
  fmt,
  jiggle,
  linePath,
  placeParticles,
  proteinSlot,
  useContainerTextScale,
  useLineScale,
  useSimClock,
  useTextScale,
  type Box,
} from '../kit';
import { KJEMI } from '../../kjemi/kit/colors';
import {
  ABS_REFRACTORY,
  PHASE_NAMES,
  REL_REFRACTORY,
  V_AHP,
  V_PEAK,
  V_REST,
  V_THRESHOLD,
  activeNode,
  internodeLength,
  membraneAt,
  riseTime,
  simulateNeuron,
  speedMyelinated,
  speedUnmyelinated,
  thresholdStimulus,
  travelTimeMs,
  type MembraneState,
  type NeuronRun,
} from './model';

type Mode = 'ap' | 'ledning';
const NA = BIO.natrium;
const K = BIO.kalium;
const T_MAX = 16;
/** Første stimulus (ms): litt ut i grafen, så det er plass til etiketten «depolarisering» foran aksjonspotensialet. */
const STIM1 = 3;
const T_TICKS = [0, 2, 4, 6, 8, 10, 12, 14, 16];

export default function Nerveimpuls() {
  const [mode, setMode] = useState<Mode>('ap');
  return (
    <VizLayout>
      <Toolbar>
        <Segmented
          label="Velg visning"
          options={[
            { value: 'ap', label: 'Aksjonspotensialet' },
            { value: 'ledning', label: 'Ledning langs aksonet' },
          ]}
          value={mode}
          onChange={setMode}
        />
      </Toolbar>
      {mode === 'ap' ? <ActionPotential /> : <Conduction />}
    </VizLayout>
  );
}

/* ====================================================================== */
/* Aksjonspotensialet                                                       */
/* ====================================================================== */

function ActionPotential() {
  const [S, setS] = useState(20);
  const [two, setTwo] = useState(false);
  const [interval, setStimGap] = useState(4);
  const run = useMemo(
    () =>
      simulateNeuron(
        two
          ? [
              { t: STIM1, S },
              { t: STIM1 + interval, S },
            ]
          : [{ t: STIM1, S }],
      ),
    [S, two, interval],
  );
  // Vis toppen av det første aksjonspotensialet når siden åpnes
  const clock = useSimClock({ tMax: T_MAX, speed: 1.2 });
  const { setT, pause } = clock;
  useEffect(() => setT(STIM1 + 0.75), [setT]);
  const t = clock.t;
  const st = membraneAt(run, t);
  const s1 = run.stimuli[0]!;
  const s2 = run.stimuli[1];

  return (
    <>
      <Controls>
        <Slider label="Stimulusstyrke" value={S} onChange={setS} min={0} max={40} step={1} unit="mV" />
        {two && (
          <Slider
            label="Tid mellom stimuliene"
            value={interval}
            onChange={setStimGap}
            min={1}
            max={10}
            step={0.5}
            unit="ms"
            decimals={1}
          />
        )}
        <Slider
          label="Tid"
          value={Math.round(t * 20) / 20}
          onChange={(v) => {
            pause();
            setT(v);
          }}
          min={0}
          max={T_MAX}
          step={0.05}
          unit="ms"
          decimals={2}
        />
      </Controls>
      <Toolbar>
        <Segmented
          label="Antall stimuli"
          options={[
            { value: 'en', label: 'Ett stimulus' },
            { value: 'to', label: 'To stimuli' },
          ]}
          value={two ? 'to' : 'en'}
          onChange={(v) => setTwo(v === 'to')}
        />
        <PlayBar clock={clock} time={`t = ${fmt(t, 2)} ms (sakte film)`} />
      </Toolbar>

      <MembraneScene st={st} t={t} />
      <Legend
        items={[
          { color: NA, label: 'Natriumioner (Na⁺)' },
          { color: K, label: 'Kaliumioner (K⁺)' },
          { color: KJEMI.plus, label: 'Overskudd av positiv ladning' },
          { color: KJEMI.minus, label: 'Overskudd av negativ ladning' },
        ]}
      />

      <PotentialPlot run={run} t={t} />
      <Legend
        items={[
          { color: BIO.dna, label: 'Membranpotensial' },
          { color: NA, label: 'Åpne Na⁺-kanaler' },
          { color: K, label: 'Åpne K⁺-kanaler' },
          { color: VIZ.muted, label: 'Terskel og hvilepotensial', dashed: true },
        ]}
      />

      <Readouts>
        <Readout label="Membranpotensial" value={fmt(st.V, 0)} unit="mV" tone={st.V > 0 ? KJEMI.plus : undefined} />
        <Readout
          label="Refraktærperiode"
          value={st.refractory === 'absolutt' ? 'Absolutt' : st.refractory === 'relativ' ? 'Relativ' : 'Nei'}
        />
        <Readout
          label="Na⁺-kanaler"
          value={st.naState === 'åpen' ? 'Åpne' : st.naState === 'inaktivert' ? 'Inaktiverte' : 'Lukket'}
          tone={st.naState === 'åpen' ? NA : undefined}
        />
        <Readout label="K⁺-kanaler" value={st.kState === 'åpen' ? 'Åpne' : 'Lukket'} tone={st.kState === 'åpen' ? K : undefined} />
      </Readouts>

      <Formula label="Når terskelen">
        <FormulaLine>
          Stimulus 1: {fmt(V_REST, 0)} mV + {fmt(S, 0)} mV = {fmt(V_REST + S, 0)} mV {V_REST + S >= V_THRESHOLD ? '≥' : '<'} terskelen{' '}
          {fmt(V_THRESHOLD, 0)} mV → {s1.fired ? 'aksjonspotensial' : S === 0 ? 'ingen depolarisering' : 'bare lokal depolarisering'}
        </FormulaLine>
        {s2 && (
          <FormulaLine>
            Stimulus 2 (etter {fmt(interval, 1)} ms):{' '}
            {s2.refractory === 'absolutt'
              ? 'absolutt refraktærperiode, ingen aksjonspotensial uansett styrke'
              : `${fmt(s2.vBefore, 0)} mV + ${fmt(S, 0)} mV = ${fmt(s2.vBefore + S, 0)} mV ${s2.fired ? '≥' : '<'} terskelen ${fmt(s2.threshold, 0)} mV → ${s2.fired ? 'aksjonspotensial' : 'ikke aksjonspotensial'}`}
          </FormulaLine>
        )}
      </Formula>

      <Explain>{apExplanation(run, st, S, two, interval)}</Explain>
    </>
  );
}

/* ---------- Membranen i nærbilde ---------- */

const NA_STATE: Record<MembraneState['naState'], string> = { lukket: 'lukket', åpen: 'åpen', inaktivert: 'inaktivert' };

function MembraneScene({ st, t }: { st: MembraneState; t: number }) {
  const [ref, f] = useContainerTextScale<HTMLDivElement>();
  const lw = useLineScale();
  const narrow = f > 1.3;
  const k = Math.max(1, f * 0.85);
  // På mobil: færre og større proteiner
  const naX = narrow ? [230] : [250, 540];
  const kX = narrow ? [570] : [395, 685];
  const pumpX = narrow ? null : 105;
  const T = Math.round(44 * Math.min(1.5, k));
  const head = 30 * f;
  const lab = 22 * f;
  const band = Math.round(96 + 60 * (f - 1));
  const yM = head + lab + band + T / 2;
  const H = Math.round(yM + T / 2 + lab + band + 26 * f);
  const outBox: Box = { x: 30, y: head + lab + 10, w: 740, h: band - 40 };
  const inBox: Box = { x: 30, y: yM + T / 2 + lab + 18, w: 740, h: band - 40 };
  const ions = useMemo(() => {
    const unit = { x: 0, y: 0, w: 1000, h: 300 };
    return {
      out: placeParticles(
        unit,
        [
          { n: 16, r: 34 },
          { n: 3, r: 34 },
        ],
        3,
        8,
      ),
      inn: placeParticles(
        unit,
        [
          { n: 3, r: 34 },
          { n: 16, r: 34 },
        ],
        7,
        8,
      ),
    };
  }, []);
  const r = 6.5 * k;
  const place = (p: { x: number; y: number }, box: Box) => ({ x: box.x + (box.w * p.x) / 1000, y: box.y + (box.h * p.y) / 300 });
  const slots = [
    ...naX.map((x) => proteinSlot(x, 'kanal', T)),
    ...kX.map((x) => proteinSlot(x, 'kanal', T)),
    ...(pumpX === null ? [] : [proteinSlot(pumpX, 'pumpe', T)]),
  ];
  // Ioner som går gjennom kanalene (bare når de er åpne)
  const phase = (t * 1.6) % 1;
  const flow = (x: number, open: number, down: boolean, color: string, key: string) =>
    open > 0.05
      ? [0, 1, 2].map((i) => {
          const u = (phase + i / 3) % 1;
          const y0 = yM - T / 2 - 30 * k;
          const y1 = yM + T / 2 + 30 * k;
          const y = down ? y0 + (y1 - y0) * u : y1 - (y1 - y0) * u;
          return (
            <circle
              key={`${key}${i}`}
              cx={x}
              cy={y}
              r={r}
              fill={color}
              stroke={VIZ.surface}
              strokeWidth={1.2 * lw}
              opacity={Math.min(1, open * 1.5)}
            />
          );
        })
      : null;
  const outsidePositive = st.V < 0;
  const strength = Math.min(1, Math.abs(st.V) / 70);
  const signXs = narrow ? [80, 400, 740] : [40, 170, 320, 465, 610, 755];
  const vColor = st.V > 0 ? KJEMI.plus : VIZ.ink;
  return (
    <div ref={ref}>
      <Figure
        viewBox={`0 0 800 ${H}`}
        maxHeight={narrow ? 800 : 560}
        label={`Membranen i en nervecelle ved ${fmt(t, 2)} ms: ${fmt(st.V, 0)} mV. Natriumkanalene er ${st.naState}, kaliumkanalene er ${st.kState}.`}
        caption="Hver prikk er mange ioner. Antallet som krysser membranen under ett aksjonspotensial er i virkeligheten svært lite."
      >
        <Txt x={20} y={head - 6} anchor="start" weight={700}>
          {PHASE_NAMES[st.phase]}
        </Txt>
        <Txt x={780} y={head - 6} anchor="end" weight={700} color={vColor}>
          {`${fmt(st.V, 0)} mV`}
        </Txt>
        <rect x={16} y={head + lab} width={768} height={yM - T / 2 - head - lab} rx={12} fill={BIO.vannFyll} opacity={0.6} />
        <rect x={16} y={yM + T / 2} width={768} height={H - 26 * f - yM - T / 2} rx={12} fill={BIO.cytoplasma} />
        <Txt x={24} y={head + lab - 6} anchor="start" muted size={0.8}>
          Utenfor cella
        </Txt>
        {ions.out.map((p, i) => {
          const q = place(jiggle(p, t * 2, 8), outBox);
          return <circle key={`o${i}`} cx={q.x} cy={q.y} r={r} fill={p.group === 0 ? NA : K} stroke={VIZ.surface} strokeWidth={1.2 * lw} />;
        })}
        {ions.inn.map((p, i) => {
          const q = place(jiggle(p, t * 2, 8), inBox);
          return <circle key={`i${i}`} cx={q.x} cy={q.y} r={r} fill={p.group === 0 ? NA : K} stroke={VIZ.surface} strokeWidth={1.2 * lw} />;
        })}
        <Membran x={400} y={yM} length={768} thickness={T} skip={slots} />
        {pumpX !== null && <NaKPumpe x={pumpX} y={yM} thickness={T} />}
        {naX.map((x) => (
          <g key={`na${x}`}>
            <Kanalprotein x={x} y={yM} thickness={T} open={st.naState === 'åpen'} />
            {st.naState === 'inaktivert' && (
              <g>
                <line
                  x1={x - T * 0.2}
                  y1={yM + T * 0.75}
                  x2={x}
                  y2={yM + T * 0.75 + T * 0.22}
                  stroke={BIO.protein.line}
                  strokeWidth={2 * lw}
                />
                <circle cx={x} cy={yM + T * 0.75 + T * 0.27} r={T * 0.16} fill={BIO.protein.line} />
              </g>
            )}
          </g>
        ))}
        {kX.map((x) => (
          <Kanalprotein key={`k${x}`} x={x} y={yM} thickness={T} open={st.kState === 'åpen'} />
        ))}
        {naX.map((x) => flow(x, st.na, true, NA, `fn${x}`))}
        {kX.map((x) => flow(x, st.k, false, K, `fk${x}`))}
        {/* Ladninger langs membranen */}
        {signXs.map((x) => (
          <g key={`s${x}`} opacity={0.25 + 0.75 * strength}>
            <Txt x={x} y={yM - T / 2 - 8} weight={800} color={outsidePositive ? KJEMI.plus : KJEMI.minus} size={1.1}>
              {outsidePositive ? '+' : '−'}
            </Txt>
            <Txt x={x} y={yM + T / 2 + 22 * f} weight={800} color={outsidePositive ? KJEMI.minus : KJEMI.plus} size={1.1}>
              {outsidePositive ? '−' : '+'}
            </Txt>
          </g>
        ))}
        {/* Navn og tilstand */}
        {naX.map((x) => (
          <g key={`ln${x}`}>
            <Txt x={x} y={yM - T * 0.75 - 10} size={0.8} weight={700} color={NA}>
              Na⁺-kanal
            </Txt>
            <Txt x={x} y={yM + T * 0.75 + 30 * f} size={0.75} muted>
              {NA_STATE[st.naState]}
            </Txt>
          </g>
        ))}
        {kX.map((x) => (
          <g key={`lk${x}`}>
            <Txt x={x} y={yM - T * 0.75 - 10} size={0.8} weight={700} color={K}>
              K⁺-kanal
            </Txt>
            <Txt x={x} y={yM + T * 0.75 + 30 * f} size={0.75} muted>
              {st.kState}
            </Txt>
          </g>
        ))}
        {pumpX !== null && (
          <Txt x={pumpX} y={yM - T * 0.75 - 10} size={0.8} weight={700} muted>
            Na⁺/K⁺-pumpe
          </Txt>
        )}
        <Txt x={24} y={H - 8} anchor="start" muted size={0.8}>
          Inne i cella (cytoplasma)
        </Txt>
      </Figure>
    </div>
  );
}

/* ---------- Grafene ---------- */

function PotentialPlot({ run, t }: { run: NeuronRun; t: number }) {
  const [ref, f] = useContainerTextScale<HTMLDivElement>();
  const H1 = Math.round(330 + 260 * (f - 1));
  const H2 = Math.round(190 + 150 * (f - 1));
  const pts = useMemo(() => {
    const out: [number, number][] = [];
    const na: [number, number][] = [];
    const kk: [number, number][] = [];
    for (let s = 0; s <= T_MAX + 1e-9; s += 0.02) {
      const m = membraneAt(run, s);
      out.push([s, m.V]);
      na.push([s, m.na * 100]);
      kk.push([s, m.k * 100]);
    }
    return { v: out, na, k: kk };
  }, [run]);
  const now = membraneAt(run, t);
  const first = run.spikes[0];
  const narrow = f > 1.3;
  return (
    <div ref={ref}>
      <Figure
        viewBox={`0 0 800 ${H1 + H2}`}
        label={`Membranpotensialet over ${T_MAX} ms. ${run.spikes.length} aksjonspotensial${run.spikes.length === 1 ? '' : 'er'}.`}
      >
        <Plot
          x={{ min: 0, max: T_MAX, label: 'Tid (ms)', ticks: T_TICKS }}
          y={{ min: -105, max: 40, label: 'Membranpotensial (mV)', ticks: [-100, -80, -60, -40, -20, 0, 20, 40] }}
          width={800}
          height={H1}
        >
          {({ sx, sy, x0, x1, y0, y1 }) => (
            <g>
              {run.spikes.map((s, i) => (
                <g key={i}>
                  <rect
                    x={sx(s)}
                    y={y1}
                    width={sx(Math.min(T_MAX, s + ABS_REFRACTORY)) - sx(s)}
                    height={y0 - y1}
                    fill={VIZ.muted}
                    opacity={0.16}
                  />
                  <rect
                    x={sx(Math.min(T_MAX, s + ABS_REFRACTORY))}
                    y={y1}
                    width={Math.max(0, sx(Math.min(T_MAX, s + REL_REFRACTORY)) - sx(Math.min(T_MAX, s + ABS_REFRACTORY)))}
                    height={y0 - y1}
                    fill={VIZ.muted}
                    opacity={0.07}
                  />
                  {!narrow && i === 0 && (
                    <g>
                      <Txt x={sx(s + ABS_REFRACTORY * 0.65)} y={y1 + 16} size={0.7} muted>
                        absolutt
                      </Txt>
                      <Txt x={sx(s + (ABS_REFRACTORY + REL_REFRACTORY) / 2)} y={y1 + 16} size={0.7} muted>
                        relativ refraktærperiode
                      </Txt>
                    </g>
                  )}
                </g>
              ))}
              <line x1={x0} x2={x1} y1={sy(V_THRESHOLD)} y2={sy(V_THRESHOLD)} stroke={VIZ.muted} strokeWidth={1.6} strokeDasharray="7 6" />
              <line x1={x0} x2={x1} y1={sy(V_REST)} y2={sy(V_REST)} stroke={VIZ.muted} strokeWidth={1.2} strokeDasharray="3 5" />
              <Txt x={x1 - 6} y={sy(V_THRESHOLD) - 8} anchor="end" size={0.8} muted>
                terskel −55 mV
              </Txt>
              <Txt x={x1 - 6} y={sy(V_REST) + 20 * f} anchor="end" size={0.8} muted>
                hvile −70 mV
              </Txt>
              <path d={linePath(pts.v, sx, sy)} fill="none" stroke={BIO.dna} strokeWidth={3.2} strokeLinejoin="round" />
              {first !== undefined && (
                <g>
                  {!narrow && (
                    <Txt x={sx(first) - 8} y={sy(-5)} anchor="end" size={0.8} weight={650}>
                      depolarisering
                    </Txt>
                  )}
                  <Txt x={sx(first + riseTime() + 0.9) + 8} y={sy(10)} anchor="start" size={0.8} weight={650}>
                    repolarisering
                  </Txt>
                  {!narrow && (
                    <Txt x={sx(first + 2.2) + 8} y={sy(V_AHP) + 20 * f} anchor="start" size={0.8} weight={650}>
                      hyperpolarisering
                    </Txt>
                  )}
                </g>
              )}
              {run.stimuli.map((s, i) => (
                <g key={`st${i}`}>
                  <line x1={sx(s.t)} x2={sx(s.t)} y1={y0} y2={y0 - 16} stroke={VIZ.ink} strokeWidth={2.5} />
                  <path d={`M${sx(s.t) - 6},${y0 - 12} L${sx(s.t)},${y0 - 22} L${sx(s.t) + 6},${y0 - 12} Z`} fill={VIZ.ink} />
                  <Txt x={sx(s.t) + 8} y={y0 - 8} anchor="start" size={0.75} muted>
                    {run.stimuli.length > 1 ? `${i + 1}` : 'stimulus'}
                  </Txt>
                </g>
              ))}
              <line x1={sx(t)} x2={sx(t)} y1={y0} y2={y1} className="viz-guide" />
              <circle cx={sx(t)} cy={sy(now.V)} r={7} fill={BIO.dna} stroke={VIZ.surface} strokeWidth={2.5} />
              <Txt x={x1 - 6} y={sy(V_PEAK) - 6} anchor="end" size={0.75} muted>
                {`topp +${V_PEAK} mV`}
              </Txt>
              <line x1={x0} x2={x1} y1={sy(V_PEAK)} y2={sy(V_PEAK)} stroke={VIZ.grid} strokeWidth={1} />
            </g>
          )}
        </Plot>
        <g transform={`translate(0 ${H1})`}>
          <Plot
            x={{ min: 0, max: T_MAX, label: 'Tid (ms)', ticks: T_TICKS }}
            y={{ min: 0, max: 100, label: 'Åpne (%)', ticks: [0, 50, 100] }}
            width={800}
            height={H2}
          >
            {({ sx, sy, y0, y1 }) => (
              <g>
                <path d={linePath(pts.na, sx, sy)} fill="none" stroke={NA} strokeWidth={2.8} />
                <path d={linePath(pts.k, sx, sy)} fill="none" stroke={K} strokeWidth={2.8} />
                <line x1={sx(t)} x2={sx(t)} y1={y0} y2={y1} className="viz-guide" />
                <circle cx={sx(t)} cy={sy(now.na * 100)} r={5.5} fill={NA} stroke={VIZ.surface} strokeWidth={2} />
                <circle cx={sx(t)} cy={sy(now.k * 100)} r={5.5} fill={K} stroke={VIZ.surface} strokeWidth={2} />
              </g>
            )}
          </Plot>
        </g>
      </Figure>
    </div>
  );
}

/* ---------- Forklaring ---------- */

function apExplanation(run: NeuronRun, st: MembraneState, S: number, two: boolean, interval: number): ReactNode {
  const s1 = run.stimuli[0]!;
  const s2 = run.stimuli[1];
  const ions = (
    <p>
      Bare en ørliten andel av ionene krysser membranen under ett aksjonspotensial, så konsentrasjonene inne og ute endres nesten ikke.
      Natrium-kalium-pumpa (Na⁺/K⁺-pumpa) bruker ATP til å holde forskjellene ved like over tid, men det er ikke pumpa som lager selve
      aksjonspotensialet.
    </p>
  );
  let phase: ReactNode;
  switch (st.phase) {
    case 'hvile':
      phase = (
        <p>
          <strong>Hvilepotensial ({fmt(st.V, 0)} mV).</strong> Innsiden av membranen er negativ i forhold til utsiden. Det er mye Na⁺
          utenfor og mye K⁺ inne. Natriumkanalene er lukket, og noen kaliumkanaler lekker K⁺ ut, slik at innsiden blir negativ.
        </p>
      );
      break;
    case 'lokal':
      phase = (
        <p>
          <strong>Lokal depolarisering ({fmt(st.V, 0)} mV).</strong> Stimuluset gjør innsiden mindre negativ, men så lenge potensialet er
          under terskelen (−55 mV), åpner ikke mange nok natriumkanaler seg. Depolariseringen dør ut, og det blir ingen nerveimpuls.
        </p>
      );
      break;
    case 'depolarisering':
      phase = (
        <p>
          <strong>Depolarisering.</strong> Terskelen er nådd, og spenningsstyrte natriumkanaler åpner seg. Na⁺ strømmer inn (ned
          konsentrasjonsgradienten og mot den negative innsiden), og innsiden blir positiv, opp til ca. +30 mV. Hver kanal som åpner, gjør
          at flere åpner: derfor går det så fort.
        </p>
      );
      break;
    case 'repolarisering':
      phase = (
        <p>
          <strong>Repolarisering.</strong> Natriumkanalene lukkes og blir inaktivert, og kaliumkanalene åpner seg. K⁺ strømmer ut, og
          innsiden blir negativ igjen. Mens natriumkanalene er inaktivert, kan ikke et nytt aksjonspotensial starte: absolutt
          refraktærperiode.
        </p>
      );
      break;
    case 'hyperpolarisering':
      phase = (
        <p>
          <strong>Hyperpolarisering ({fmt(st.V, 0)} mV).</strong> Kaliumkanalene lukkes sakte, så det strømmer ut litt for mye K⁺, og
          potensialet blir mer negativt enn hvilepotensialet (ned mot −80 mV). Nå trengs et sterkere stimulus for å nå terskelen: relativ
          refraktærperiode.
        </p>
      );
      break;
  }
  let first: ReactNode;
  if (S === 0) first = <p>Det er ikke noe stimulus. Øk stimulusstyrken for å depolarisere membranen.</p>;
  else if (!s1.fired && !(s2 && s2.fired))
    first = (
      <p>
        Stimuluset på {fmt(S, 0)} mV er for svakt: potensialet når bare {fmt(V_REST + S, 0)} mV, under terskelen. Det trengs minst{' '}
        {fmt(thresholdStimulus(), 0)} mV. Aksjonspotensialet følger <strong>alt-eller-ingenting-prinsippet</strong>: enten når potensialet
        terskelen og hele aksjonspotensialet går, eller så skjer det ingenting.
      </p>
    );
  else
    first = (
      <p>
        <strong>Alt eller ingenting.</strong> Så lenge terskelen nås, blir toppen alltid ca. +30 mV, uansett hvor sterkt stimuluset er. Et
        sterkere stimulus gir altså ikke et større aksjonspotensial; sterkere stimulering gir i stedet flere aksjonspotensialer per sekund.
      </p>
    );
  let second: ReactNode = null;
  if (two && s2) {
    if (!s1.fired && s2.fired)
      second = (
        <p>
          <strong>Summering.</strong> Hvert stimulus alene er for svakt, men det andre kommer før den lokale depolariseringen fra det første
          har dødd ut ({fmt(interval, 1)} ms etter). Til sammen når de terskelen.
        </p>
      );
    else if (s1.fired && s2.refractory === 'absolutt')
      second = (
        <p>
          Stimulus 2 kommer i den <strong>absolutte refraktærperioden</strong> (under {fmt(ABS_REFRACTORY, 0)} ms etter terskelen):
          natriumkanalene er inaktivert, så ingen stimulus, uansett styrke, kan gi et nytt aksjonspotensial. Dette gjør også at impulsen
          bare går én vei langs aksonet.
        </p>
      );
    else if (s1.fired && s2.refractory === 'relativ')
      second = s2.fired ? (
        <p>
          Stimulus 2 kommer i den <strong>relative refraktærperioden</strong>, men er sterkt nok til å nå den hevede terskelen (
          {fmt(s2.threshold, 0)} mV), så det blir et nytt aksjonspotensial.
        </p>
      ) : (
        <p>
          Stimulus 2 kommer i den <strong>relative refraktærperioden</strong>: membranen er hyperpolarisert og terskelen er hevet til{' '}
          {fmt(s2.threshold, 0)} mV, så {fmt(S, 0)} mV er ikke nok. Øk stimulusstyrken eller tida mellom stimuliene.
        </p>
      );
    else if (s1.fired)
      second = (
        <p>
          Stimulus 2 kommer etter refraktærperioden ({fmt(interval, 1)} ms etter), og cella{' '}
          {s2.fired ? 'fyrer et nytt, like stort aksjonspotensial' : 'reagerer ikke fordi stimuluset er for svakt'}.
        </p>
      );
  }
  return (
    <>
      {phase}
      {first}
      {second}
      {ions}
    </>
  );
}

/* ====================================================================== */
/* Ledning langs aksonet                                                    */
/* ====================================================================== */

const NODES = 8;

function Conduction() {
  const [d, setD] = useState(10);
  const vM = speedMyelinated(d);
  const vU = speedUnmyelinated(d);
  const L = (NODES * internodeLength(d)) / 1000; // mm
  const tCross = L / vM; // ms (mm / (m/s) = ms)
  const tMax = Math.round(tCross * 1.5 * 1000) / 1000;
  const clock = useSimClock({ tMax, speed: tMax / 7 });
  const { setT, pause } = clock;
  // Vis signalet halvveis når siden åpnes og når diameteren endres
  useEffect(() => {
    pause();
    setT(tCross * 0.55);
  }, [tCross, pause, setT]);
  const t = Math.min(clock.t, tMax);
  const xM = Math.min(L, vM * t);
  const xU = Math.min(L, vU * t);
  const node = Math.min(NODES, activeNode(t, d));
  const decimals = tMax < 0.5 ? 3 : 2;
  return (
    <>
      <Controls>
        <Slider label="Aksondiameter" value={d} onChange={setD} min={1} max={20} step={1} unit="µm" />
        <Slider
          label="Tid"
          value={Math.min(t, tMax)}
          onChange={(v) => {
            pause();
            setT(v);
          }}
          min={0}
          max={tMax}
          step={tMax / 100}
          unit="ms"
          decimals={decimals}
        />
      </Controls>
      <Toolbar>
        <PlayBar clock={clock} time={`t = ${fmt(t, decimals)} ms (sakte film)`} />
      </Toolbar>
      <AxonLanes d={d} t={t} L={L} xM={xM} xU={xU} node={node} />
      <Legend
        items={[
          { color: NA, label: 'Aksjonspotensial (Na⁺ strømmer inn)' },
          { color: VIZ.muted, label: 'Refraktær del (kan ikke fyre igjen ennå)' },
          { color: BIO.lipidHode, label: 'Myelinskjede (schwannske celler)' },
        ]}
      />
      <Readouts>
        <Readout label="Fart med myelin" value={fmt(vM, 0)} unit="m/s" tone={NA} />
        <Readout label="Fart uten myelin" value={fmt(vU, 1)} unit="m/s" />
        <Readout label="1 meter med myelin" value={fmt(travelTimeMs(1, vM), 0)} unit="ms" />
        <Readout label="1 meter uten myelin" value={fmt(travelTimeMs(1, vU), 0)} unit="ms" />
      </Readouts>
      <Formula label="Ledningshastighet">
        <FormulaLine>
          Med myelin: v ≈ 6 · d = 6 · {fmt(d, 0)} = {fmt(vM, 0)} m/s · uten myelin: v ≈ 1,1 · √d = 1,1 · √{fmt(d, 0)} = {fmt(vU, 1)} m/s
        </FormulaLine>
        <FormulaLine>
          Fra ryggmargen til tærne (ca. 1 m): {fmt(travelTimeMs(1, vM), 0)} ms med myelin og {fmt(travelTimeMs(1, vU), 0)} ms uten, altså{' '}
          {fmt(vM / vU, 0)} ganger så lang tid uten myelin.
        </FormulaLine>
      </Formula>
      <Explain>
        <p>
          <strong>Saltatorisk ledning.</strong> Myelinskjeden er lag på lag av cellemembranen til schwannske celler, og den isolerer
          aksonet. Spenningsstyrte natriumkanaler finnes nesten bare i de små åpningene mellom skjedene, Ranviers innsnøringer.
          Aksjonspotensialet oppstår derfor bare der, og strømmen «hopper» fra innsnøring til innsnøring. Uten myelin må aksjonspotensialet
          lages på nytt i hver eneste bit av membranen, og det går langt saktere.
        </p>
        <p>
          Et tykkere akson har mindre motstand inne i cella, så signalet går fortere både med og uten myelin. Delen bak impulsen er
          refraktær, og derfor går nerveimpulsen bare én vei. Ved sykdommen multippel sklerose (MS) skades myelinet, og nerveimpulsene går
          saktere eller stopper opp.
        </p>
      </Explain>
    </>
  );
}

function AxonLanes({ d, t, L, xM, xU, node }: { d: number; t: number; L: number; xM: number; xU: number; node: number }) {
  const [ref, f] = useContainerTextScale<HTMLDivElement>();
  const lw = useLineScale();
  const fs = useTextScale();
  const x0 = 40;
  const x1 = 760;
  const sx = (mm: number) => x0 + ((x1 - x0) * mm) / L;
  const laneH = Math.round(70 + 30 * (f - 1));
  const titleH = 30 * f;
  const y1 = titleH + 14;
  const y2 = y1 + laneH + titleH + 34 * f;
  const H = Math.round(y2 + laneH + 30 * f + 12);
  const axonR = laneH * 0.22;
  const nodeW = 10;
  const seg = (x1 - x0) / NODES;
  const vU = speedUnmyelinated(d);
  const arrived = xM >= L - 1e-9;
  const refrM = (k: number) => {
    // Innsnøringer som fyrte for under 2 ms siden er refraktære (her: alle bak den aktive i denne korte tida)
    return k < node;
  };
  const zoneU = 0.04 * L;
  const trailU = Math.min(xU, vU * ABS_REFRACTORY);
  return (
    <div ref={ref}>
      <Figure
        viewBox={`0 0 800 ${H}`}
        maxHeight={f > 1.3 ? 800 : Math.round(H * 1.15)}
        label={`To aksoner med diameter ${fmt(d, 0)} µm etter ${fmt(t, 3)} ms. Med myelin har signalet kommet ${fmt(xM, 1)} mm, uten myelin ${fmt(xU, 2)} mm.`}
        caption="Nærbilde av noen få millimeter akson. Hastighetene er i målestokk med hverandre."
      >
        {/* Med myelin */}
        <Txt x={x0} y={titleH} anchor="start" weight={700}>
          Med myelin
        </Txt>
        <Txt x={x1} y={titleH} anchor="end" muted size={0.85}>
          {arrived ? 'framme' : `${fmt(xM, 1)} mm`}
        </Txt>
        <rect
          x={x0}
          y={y1 + laneH / 2 - axonR}
          width={x1 - x0}
          height={2 * axonR}
          rx={axonR}
          fill={BIO.cytoplasma}
          stroke={BIO.membran}
          strokeWidth={1.6 * lw}
        />
        {Array.from({ length: NODES }, (_, k) => (
          <rect
            key={`m${k}`}
            x={x0 + k * seg + nodeW / 2}
            y={y1 + laneH / 2 - axonR - laneH * 0.2}
            width={seg - nodeW}
            height={2 * axonR + laneH * 0.4}
            rx={laneH * 0.2}
            fill={BIO.lipidHode}
            opacity={0.5}
            stroke={BIO.membran}
            strokeWidth={1.2 * lw}
          />
        ))}
        {Array.from({ length: NODES + 1 }, (_, k) => {
          const x = x0 + k * seg;
          const active = k === node && !arrived;
          const done = refrM(k) || (arrived && k <= NODES);
          return (
            <g key={`n${k}`}>
              <rect
                x={x - nodeW / 2}
                y={y1 + laneH / 2 - axonR - 3}
                width={nodeW}
                height={2 * axonR + 6}
                rx={3}
                fill={active ? NA : done ? VIZ.muted : BIO.cytoplasma}
                opacity={active ? 1 : done ? 0.55 : 1}
              />
              {active && <circle cx={x} cy={y1 + laneH / 2} r={axonR + 10} fill={NA} opacity={0.18} />}
            </g>
          );
        })}
        {!arrived && node < NODES && (
          <path
            d={`M${x0 + node * seg},${y1 + laneH / 2} Q${x0 + (node + 0.5) * seg},${y1 + laneH / 2 - laneH * 0.62} ${x0 + (node + 1) * seg},${y1 + laneH / 2}`}
            fill="none"
            stroke={NA}
            strokeWidth={2 * lw}
            strokeDasharray="6 5"
          />
        )}
        <Txt x={x0 + (Math.min(node, NODES - 1) + 0.5) * seg} y={y1 + laneH + 14 * fs} size={0.75} muted>
          {node < NODES && !arrived ? 'hopper til neste innsnøring' : ''}
        </Txt>

        {/* Uten myelin */}
        <Txt x={x0} y={y2 - 20} anchor="start" weight={700}>
          Uten myelin
        </Txt>
        <Txt x={x1} y={y2 - 20} anchor="end" muted size={0.85}>
          {xU >= L - 1e-9 ? 'framme' : `${fmt(xU, 2)} mm`}
        </Txt>
        <rect
          x={x0}
          y={y2 + laneH / 2 - axonR}
          width={x1 - x0}
          height={2 * axonR}
          rx={axonR}
          fill={BIO.cytoplasma}
          stroke={BIO.membran}
          strokeWidth={1.6 * lw}
        />
        {t > 0 && (
          <g>
            <rect
              x={sx(Math.max(0, xU - trailU))}
              y={y2 + laneH / 2 - axonR}
              width={Math.max(0, sx(xU) - sx(Math.max(0, xU - trailU)))}
              height={2 * axonR}
              fill={VIZ.muted}
              opacity={0.45}
            />
            <rect
              x={Math.max(x0, sx(xU) - 3)}
              y={y2 + laneH / 2 - axonR - 3}
              width={Math.max(6, sx(Math.min(L, xU + zoneU)) - sx(xU) + 3)}
              height={2 * axonR + 6}
              rx={4}
              fill={NA}
            />
          </g>
        )}
        <Txt x={x0} y={y2 + laneH + 22 * fs} anchor="start" size={0.75} muted>
          0 mm
        </Txt>
        <Txt x={x1} y={y2 + laneH + 22 * fs} anchor="end" size={0.75} muted>
          {`${fmt(L, 1)} mm`}
        </Txt>
      </Figure>
    </div>
  );
}
