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
  Toggle,
  Toolbar,
  Txt,
  VIZ,
  VizLayout,
  fmt,
  fmtSci,
  linePath,
  sample,
  useSimClock,
  useTextScale,
} from '../../kit';
import { ValueTag, alpha } from '../../kit/scene';
import { nuclideText, nuclideWords } from '../kap07/elements';
import { useFigureTextScale } from '../kap07/useNarrow';
import { DAUGHTER, FRESH, LabScene, MOTHER, NucleusPanel, hlLayout, sampleFor, sceneLabel } from './halveringstid-scene';
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
import { decayedCount, emissionDraws } from './model-halveringstid';
import { PlayBar } from './PlayBar';

const N0 = 400;
/** Lengden på simuleringen, målt i halveringstider. */
const T_MAX = 6;
const THEORY = VIZ.series[0]!;

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
  const [showRadiation, setShowRadiation] = useState(true);
  const clock = useSimClock({ tMax: T_MAX, speed: 0.5 });
  const { setT, pause } = clock;
  useEffect(() => setT(1), [setT]);
  const [ref, f] = useFigureTextScale<HTMLDivElement>();
  const narrow = f > 1.05;

  const p = HALF_LIFE_PRESETS.find((x) => x.id === presetId) ?? HALF_LIFE_PRESETS[0]!;
  const k = clock.t; // tid i halveringstider
  const times = useMemo(() => decayTimes(N0, seed), [seed]);
  const draws = useMemo(() => emissionDraws(N0, seed), [seed]);
  const nSim = countRemaining(times, k);
  const nTheory = remaining(N0, k, 1);
  const lambda = decayConstant(halfLifeSeconds(p));
  const N1g = atomsInSample(1e-3, p.A);
  const A1g = activity(lambda, remaining(N1g, k, 1));
  const iso = nuclideText(p.Z, p.A);
  const L = hlLayout(narrow, f, N0);

  const changePreset = (id: string) => {
    setPresetId(id);
    pause();
  };

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
        <Toggle label="Vis strålingen" checked={showRadiation} onChange={setShowRadiation} />
      </Toolbar>

      <div ref={ref}>
        <Figure viewBox={`0 0 800 ${L.H}`} label={sceneLabel(p, N0, nSim, timeText(k, p))} maxHeight={narrow ? 1400 : 500}>
          <LabScene L={L} p={p} times={times} draws={draws} t={k} showRadiation={showRadiation} />
          <NucleusPanel L={L} p={p} times={times} draws={draws} t={k} showRadiation={showRadiation} />
        </Figure>
      </div>
      <Legend
        items={[
          { color: MOTHER, label: `${iso}, ikke henfalt` },
          { color: DAUGHTER, label: `${p.daughter}, henfalt (${p.decay})` },
          { color: FRESH, label: 'Akkurat henfalt: strålingen farer ut, og telleren klikker' },
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
        <Readout label={`Aktivitet, startet med 1,00 g ${iso}`} value={fmtSig3(A1g)} unit="Bq" />
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

      <Explain>{explanation(p, k, nSim, nTheory, decayedCount(times, k))}</Explain>
    </VizLayout>
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
  const tag = `${nSim} igjen`;
  return (
    <Plot
      x={{ min: 0, max: xMax, label: `Tid t (${unitLabel})` }}
      y={{ min: 0, max: N0, label: 'Antall kjerner N', ticks: [0, 100, 200, 300, 400] }}
      width={800}
      height={height}
    >
      {({ sx, sy, y0, x1, y1 }) => {
        const px = sx(t * p.T);
        const py = sy(nSim);
        // Skiltet med antallet: over til høyre for punktet, til venstre nær høyre kant, og aldri over grafen
        const tagW = tag.length * 17 * 0.85 * f * 0.6 + 16 * f;
        const tagH = 17 * 0.85 * f * 1.55;
        const right = px + 14 + tagW < x1;
        const ty = Math.max(y1 + tagH / 2 + 2, py - 16 - tagH / 2);
        return (
          <g>
            {/* Kjernene som er igjen i simuleringen, som en flate under trappekurven */}
            <path d={`${linePath(steps, sx, sy)} L${px},${y0} L${sx(0)},${y0} Z`} fill={alpha(MOTHER, 0.12)} stroke="none" />
            {[1, 2, 3].map((m) => (
              <g key={m}>
                <polyline
                  points={`${sx(m * p.T)},${y0} ${sx(m * p.T)},${sy(N0 / 2 ** m)} ${sx(0)},${sy(N0 / 2 ** m)}`}
                  className="viz-guide"
                />
                <circle cx={sx(m * p.T)} cy={sy(N0 / 2 ** m)} r={3.5} fill={THEORY} />
                <Txt x={sx(m * p.T) + 6} y={y0 - 8} anchor="start" muted size={0.85}>
                  {m === 1 ? 'T½' : `${m}T½`}
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
            {t > 0.005 && <line x1={px} y1={y0} x2={px} y2={py} stroke={MOTHER} strokeWidth={1.5} strokeDasharray="4 4" opacity={0.7} />}
            <circle cx={px} cy={sy(remaining(N0, t, 1))} r={6} fill={VIZ.surface} stroke={THEORY} strokeWidth={3} />
            <circle cx={px} cy={py} r={7} fill={MOTHER} stroke={VIZ.surface} strokeWidth={2.5} />
            <ValueTag x={right ? px + 14 : px - 14} y={ty} text={tag} color={MOTHER} anchor={right ? 'start' : 'end'} size={0.85} />
          </g>
        );
      }}
    </Plot>
  );
}

/** Det som er spesielt med hvert stoff: strålingen fra prøven og hvor halveringstida betyr noe i praksis. */
const PRACTICE: Record<string, { radiation: ReactNode; why: ReactNode }> = {
  c14: {
    radiation: <>Karbon-14 sender ut et elektron (β⁻), som kan gå opptil et par desimeter i luft.</>,
    why: (
      <>
        Det er derfor karbondatering virker: Når et tre dør, tar det ikke opp nytt karbon, og andelen ¹⁴C halveres hvert 5 730. år. Trekull
        med halvparten så mye ¹⁴C som levende ved, er omtrent 5 700 år gammelt.
      </>
    ),
  },
  i131: {
    radiation: (
      <>
        Elektronene (β⁻) fra jod-131 stoppes stort sett i glasset, men datterkjernen sender også ut γ-stråling, som går rett gjennom glasset
        og gir klikk i telleren.
      </>
    ),
    why: (
      <>
        Det er derfor jod-131 brukes mot sykdommer i skjoldbruskkjertelen: strålingen virker i noen uker, og etter åtte halveringstider (ca.
        to måneder) er under 0,4 % igjen.
      </>
    ),
  },
  rn222: {
    radiation: (
      <>α-partiklene fra radon stopper etter 3–4 cm i lufta, så de kommer ikke ut av glasset. Derfor måles radon med målere som står i rommet.</>
    ),
    why: (
      <>
        Det er derfor radon i kjelleren ikke forsvinner av seg selv: gassen henfaller på noen dager, men det siver hele tida inn ny radon fra
        berggrunnen. Lufting og tetting mot grunnen hjelper.
      </>
    ),
  },
  co60: {
    radiation: (
      <>
        Elektronene (β⁻) stoppes i stålkapselen, og blybeholderen skjermer det meste av γ-strålingen til sidene, så den kommer ut gjennom
        åpningen på toppen.
      </>
    ),
    why: (
      <>
        Det er derfor strålekilder med kobolt-60 på sykehus og i industrien må byttes etter noen år: etter 5,27 år gir kilden bare halvparten
        så mye stråling.
      </>
    ),
  },
  u238: {
    radiation: <>α-partiklene fra uran stopper etter noen få centimeter i lufta, så røret må være nær steinen.</>,
    why: (
      <>
        Det er derfor det fortsatt finnes uran i alunskiferen: halveringstida er omtrent like lang som jordas alder, så omtrent halvparten av
        uranet som fantes da jorda ble dannet, er igjen.
      </>
    ),
  },
};

function explanation(p: HalfLifePreset, k: number, nSim: number, nTheory: number, clicks: number): ReactNode {
  const iso = nuclideText(p.Z, p.A);
  const T = p.id === 'u238' ? '4,47 · 10⁹ år' : `${fmt(p.T, p.T >= 100 ? 0 : 2)} ${p.unit}`;
  const s = sampleFor(p);
  const practice = PRACTICE[p.id];
  if (k < 0.005)
    return (
      <>
        <p>
          {s.name} ligger under røret til en geigerteller. Ingen av de {N0} kjernene av {iso} i modellen har henfalt ennå, og telleren står på
          0. Hver kjerne har like stor sannsynlighet for å henfalle i hvert tidsrom, uansett hvor lenge den har eksistert. Halveringstida T
          <Sub>½</Sub> = {T} er tida det tar før halvparten har henfalt. Trykk «Spill av».
        </p>
        {practice && <p>{practice.why}</p>}
      </>
    );
  const later =
    k >= 2 ? (
      <>
        {' '}
        Legg merke til at det ikke er tomt etter to halveringstider: da er en firedel igjen, etter tre en åttedel, og slik fortsetter det.
      </>
    ) : null;
  return (
    <>
      <p>
        Etter {timeText(k, p)}, altså {fmt(k, 2)} halveringstider, er <strong>{nSim}</strong> av {N0} kjerner igjen. Teorien gir N = {N0} ·
        (1/2)<Sup>{fmt(k, 2)}</Sup> = {fmt(nTheory, 1)}. Vi kan ikke vite hvilken kjerne som henfaller neste gang, bare hvor mange som gjør
        det i gjennomsnitt, så simuleringen blir litt forskjellig hver gang.
        {later ?? ' Aktiviteten A = λN avtar i samme takt som antall kjerner.'}
      </p>
      <p>
        Telleren har klikket {clicks} ganger: i modellen gir hvert henfall ett klikk. En ekte geigerteller fanger bare opp den delen av
        strålingen som når fram til røret, men klikkene blir sjeldnere i samme takt som kjernene blir færre. {practice?.radiation}
      </p>
      {practice && <p>{practice.why}</p>}
    </>
  );
}
