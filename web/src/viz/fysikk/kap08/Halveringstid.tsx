import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Shuffle } from 'lucide-react';
import {
  Controls,
  Explain,
  Figure,
  Formula,
  FormulaLine,
  Legend,
  Plot,
  Readout,
  Readouts,
  Segmented,
  Slider,
  Sub,
  Sup,
  Toolbar,
  VIZ,
  VizLayout,
  fmt,
  fmtSci,
  linePath,
  sample,
  useSimClock,
  useTextScale,
} from '../../kit';
import { nuclideText, nuclideWords } from '../kap07/elements';
import { Txt } from '../kap07/parts';
import {
  activity,
  atomsInSample,
  countRemaining,
  decayConstant,
  decayTimes,
  HALF_LIFE_PRESETS,
  halfLifeSeconds,
  remaining,
  type HalfLifePreset,
} from './model';
import { PlayBar } from './PlayBar';
import { useNarrow } from '../kap07/useNarrow';

const N0 = 400;
/** Lengden på simuleringen, målt i halveringstider. */
const T_MAX = 6;
const MOTHER = VIZ.series[1]!;
const DAUGHTER = VIZ.muted;
const THEORY = VIZ.series[0]!;
/** Markering av kjerner som nettopp har henfalt. */
const FRESH = VIZ.series[4]!;

const PRESETS = HALF_LIFE_PRESETS.map((p) => ({ value: p.id, label: capitalize(nuclideWords(p.Z, p.A)) }));

function capitalize(s: string): string {
  return s.charAt(0).toLocaleUpperCase('nb') + s.slice(1);
}

/** Desimaler for tida i hver enhet. */
const DECIMALS: Record<string, number> = { c14: 0, i131: 2, rn222: 2, co60: 2, u238: 2 };

/** Tid målt i halveringstider → tekst i stoffets egen enhet, f.eks. 2 → «11 460 år». */
function timeText(k: number, p: HalfLifePreset): string {
  const v = k * p.T;
  if (v === 0) return `0 ${p.id === 'u238' ? 'år' : p.unit}`;
  if (p.id === 'u238') return `${fmt(v, 2)} · 10⁹ år`;
  return `${fmt(v, DECIMALS[p.id] ?? 1)} ${p.unit}`;
}

/** Tre gjeldende siffer: 6218,69 → «6 220», 1,65 · 10¹¹ → «1,65 · 10¹¹». */
function fmtSig3(v: number): string {
  if (!Number.isFinite(v) || v === 0) return fmt(v, 0);
  const exp = Math.floor(Math.log10(Math.abs(v)));
  if (exp >= 5 || exp < -2) return fmtSci(v, 2);
  const step = 10 ** (exp - 2);
  return fmt(Math.round(v / step) * step, Math.max(0, 2 - exp));
}

/** Halveringstida skrevet om til sekunder, f.eks. «5730 · 3,16 · 10⁷ s». */
function halfLifeInSeconds(p: HalfLifePreset): string {
  const T = p.id === 'u238' ? '4,47 · 10⁹' : fmt(p.T, p.T >= 100 ? 0 : 2);
  return p.unit === 'døgn' ? `${T} · 86 400 s` : `${T} · 3,16 · 10⁷ s`;
}

export default function Halveringstid() {
  const [presetId, setPresetId] = useState('c14');
  // Frø 24 gir et typisk forløp (avviker lite fra teorien) når siden åpnes. «Nytt tilfeldig forsøk» går videre.
  const [seed, setSeed] = useState(24);
  const clock = useSimClock({ tMax: T_MAX, speed: 0.5 });
  const { setT, pause } = clock;
  useEffect(() => setT(1), [setT]);
  const [ref, narrow] = useNarrow<HTMLDivElement>();

  const p = HALF_LIFE_PRESETS.find((x) => x.id === presetId) ?? HALF_LIFE_PRESETS[0]!;
  const k = clock.t; // tid i halveringstider
  const times = useMemo(() => decayTimes(N0, seed), [seed]);
  const nSim = countRemaining(times, k);
  const nTheory = remaining(N0, k, 1);
  const lambda = decayConstant(halfLifeSeconds(p));
  const N1g = atomsInSample(1e-3, p.A);
  const A1g = activity(lambda, remaining(N1g, k, 1));
  const iso = nuclideText(p.Z, p.A);

  const changePreset = (id: string) => {
    setPresetId(id);
    pause();
  };

  const gridH = narrow ? 540 : 236;
  const plotH = narrow ? 540 : 340;

  return (
    <VizLayout>
      <Toolbar>
        <Segmented label="Velg radioaktivt stoff" options={PRESETS} value={presetId} onChange={changePreset} />
      </Toolbar>
      <Controls>
        <Slider
          label="Tid t"
          value={Math.min(k, T_MAX)}
          onChange={(v) => {
            pause();
            setT(v);
          }}
          min={0}
          max={T_MAX}
          step={0.01}
          format={(v) => timeText(v, p)}
        />
      </Controls>
      <Toolbar>
        <PlayBar clock={clock} time={timeText(k, p)} />
        <button type="button" className="btn btn-sm" onClick={() => setSeed((s) => s + 1)}>
          <Shuffle size={16} aria-hidden />
          Nytt tilfeldig forsøk
        </button>
      </Toolbar>

      <div ref={ref}>
        <Figure
          viewBox={`0 0 800 ${gridH}`}
          label={`${N0} kjerner av ${nuclideWords(p.Z, p.A)}. Etter ${timeText(k, p)} er ${nSim} igjen.`}
          maxHeight={narrow ? 560 : 260}
        >
          <NucleusGrid times={times} t={k} narrow={narrow} height={gridH} />
        </Figure>
      </div>
      <Legend
        items={[
          { color: MOTHER, label: `${iso}, ikke henfalt` },
          { color: DAUGHTER, label: `${p.daughter}, henfalt (${p.decay})` },
          { color: FRESH, label: 'Akkurat henfalt' },
        ]}
      />

      <Figure
        viewBox={`0 0 800 ${plotH}`}
        label={`Graf over antall kjerner som er igjen. Teorien gir ${fmt(nTheory, 0)}, simuleringen ${nSim}.`}
      >
        <DecayPlot times={times} t={k} p={p} height={plotH} nSim={nSim} />
      </Figure>
      <Legend
        items={[
          {
            color: THEORY,
            label: (
              <span>
                Teori: N = N<Sub>0</Sub> · (1/2)<Sup>t/T½</Sup>
              </span>
            ),
          },
          { color: MOTHER, label: 'Simulering med 400 kjerner' },
        ]}
      />

      <Readouts>
        <Readout label="Antall halveringstider t/T½" value={fmt(k, 2)} />
        <Readout label="Kjerner igjen i simuleringen" value={String(nSim)} unit={`av ${N0}`} />
        <Readout
          label={
            <>
              Teori N<Sub>0</Sub> · (1/2)<Sup>t/T½</Sup>
            </>
          }
          value={fmt(nTheory, 1)}
        />
        <Readout label={`Aktivitet, startet med 1,00\u00a0g ${iso}`} value={fmtSig3(A1g)} unit="Bq" />
      </Readouts>

      <Formula label="Desintegrasjonskonstant og aktivitet">
        <FormulaLine>
          λ = ln 2 / T<Sub>½</Sub> = 0,693 / ({halfLifeInSeconds(p)}) = {fmtSci(lambda, 2)} s⁻¹
        </FormulaLine>
        <FormulaLine>
          1,00 g {iso} ved start: N<Sub>0</Sub> = m / m<Sub>atom</Sub> = 1,00 · 10⁻³ kg / ({p.A} · 1,66 · 10⁻²⁷ kg) = {fmtSci(N1g, 2)}
        </FormulaLine>
        <FormulaLine>
          A = λN = {fmtSci(lambda, 2)} s⁻¹ · {fmtSci(N1g, 2)} · (1/2)<Sup>{fmt(k, 2)}</Sup> = {fmtSig3(A1g)} Bq
        </FormulaLine>
      </Formula>

      <Explain>{explanation(p, k, nSim, nTheory)}</Explain>
    </VizLayout>
  );
}

function NucleusGrid({ times, t, narrow, height }: { times: number[]; t: number; narrow: boolean; height: number }) {
  const cols = narrow ? 25 : 40;
  const rows = Math.ceil(times.length / cols);
  const cell = 760 / cols;
  const y0 = (height - rows * cell) / 2;
  const r = cell * 0.36;
  return (
    <>
      {times.map((tau, i) => {
        const x = 20 + (i % cols) * cell + cell / 2;
        const y = y0 + Math.floor(i / cols) * cell + cell / 2;
        const alive = tau > t;
        const fresh = !alive && t - tau < 0.08;
        if (alive) return <circle key={i} cx={x} cy={y} r={r} fill={MOTHER} />;
        return (
          <g key={i}>
            <circle cx={x} cy={y} r={r * 0.62} fill={VIZ.surface} stroke={DAUGHTER} strokeWidth={1.5} />
            {fresh && <circle cx={x} cy={y} r={r * 1.05} fill="none" stroke={FRESH} strokeWidth={2.5} />}
          </g>
        );
      })}
    </>
  );
}

function DecayPlot({ times, t, p, height, nSim }: { times: number[]; t: number; p: HalfLifePreset; height: number; nSim: number }) {
  const f = useTextScale();
  const xMax = T_MAX * p.T;
  const sorted = useMemo(() => [...times].sort((a, b) => a - b), [times]);
  // Trappekurve for simuleringen fram til t
  const steps: [number, number][] = [[0, N0]];
  let n = N0;
  for (const tau of sorted) {
    if (tau > t) break;
    steps.push([tau * p.T, n]);
    n -= 1;
    steps.push([tau * p.T, n]);
  }
  steps.push([t * p.T, n]);
  const unitLabel = p.id === 'u238' ? '10⁹ år' : p.unit;
  return (
    <Plot
      x={{ min: 0, max: xMax, label: `Tid t (${unitLabel})` }}
      y={{ min: 0, max: N0, label: 'Antall kjerner N', ticks: [0, 100, 200, 300, 400] }}
      width={800}
      height={height}
    >
      {({ sx, sy, y0 }) => (
        <g>
          {[1, 2, 3].map((k) => (
            <g key={k}>
              <polyline
                points={`${sx(k * p.T)},${y0} ${sx(k * p.T)},${sy(N0 / 2 ** k)} ${sx(0)},${sy(N0 / 2 ** k)}`}
                className="viz-guide"
              />
              <Txt x={sx(k * p.T) + 6} y={y0 - 8} anchor="start" muted size={15 * f}>
                {k === 1 ? 'T½' : `${k}T½`}
              </Txt>
            </g>
          ))}
          <path
            d={linePath(
              sample((x) => remaining(N0, x, p.T), 0, xMax, 240),
              sx,
              sy,
            )}
            fill="none"
            stroke={THEORY}
            strokeWidth={3}
          />
          <path d={linePath(steps, sx, sy)} fill="none" stroke={MOTHER} strokeWidth={2.5} strokeLinejoin="round" />
          <circle cx={sx(t * p.T)} cy={sy(remaining(N0, t, 1))} r={6} fill={VIZ.surface} stroke={THEORY} strokeWidth={3} />
          <circle cx={sx(t * p.T)} cy={sy(nSim)} r={7} fill={MOTHER} stroke={VIZ.surface} strokeWidth={2.5} />
        </g>
      )}
    </Plot>
  );
}

function explanation(p: HalfLifePreset, k: number, nSim: number, nTheory: number): ReactNode {
  const iso = nuclideText(p.Z, p.A);
  const T = p.id === 'u238' ? '4,47 · 10⁹ år' : `${fmt(p.T, p.T >= 100 ? 0 : 2)} ${p.unit}`;
  if (k < 0.005)
    return (
      <p>
        Ingen av de {N0} kjernene av {iso} har henfalt ennå. Hver kjerne har like stor sannsynlighet for å henfalle i hvert tidsrom,
        uansett hvor lenge den har eksistert. Halveringstida T<Sub>½</Sub> = {T} er tida det tar før halvparten har henfalt. Trykk «Spill av».
      </p>
    );
  const later =
    k >= 2 ? (
      <>
        {' '}
        Legg merke til at det ikke er tomt etter to halveringstider: da er en firedel igjen, etter tre en åttedel, og slik fortsetter det.
      </>
    ) : null;
  return (
    <p>
      Etter {timeText(k, p)}, altså {fmt(k, 2)} halveringstider, er <strong>{nSim}</strong> av {N0} kjerner igjen. Teorien gir N = {N0} ·
      (1/2)<Sup>{fmt(k, 2)}</Sup> = {fmt(nTheory, 1)}. Vi kan ikke vite hvilken kjerne som henfaller neste gang, bare hvor mange som gjør
      det i gjennomsnitt, så simuleringen blir litt forskjellig hver gang.
      {later ?? ' Aktiviteten A = λN avtar i samme takt som antall kjerner.'}
    </p>
  );
}
