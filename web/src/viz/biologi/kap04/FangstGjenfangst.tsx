import { useMemo, useState, type ReactNode } from 'react';
import { RefreshCw, RotateCcw } from 'lucide-react';
import {
  BIO,
  Controls,
  Explain,
  Figure,
  Fisk,
  Formula,
  FormulaLine,
  Legend,
  Plot,
  Readout,
  Readouts,
  Segmented,
  Select,
  Slider,
  Toolbar,
  Txt,
  VIZ,
  VizLayout,
  fmt,
  fmtPct,
  useContainerTextScale,
  useSvgId,
  useTextScale,
} from '../kit';
import {
  SCENARIOS,
  chapman,
  expectedRecaptures,
  markRecaptureTrial,
  niceAxis,
  recaptureDistribution,
  summarizeEstimates,
  type McScenario,
  type McTrial,
  type PondFish,
} from './model';

type Step = 'merking' | 'utsetting' | 'gjenfangst';

const STEPS: { value: Step; label: string }[] = [
  { value: 'merking', label: '1 Merking' },
  { value: 'utsetting', label: '2 Utsetting' },
  { value: 'gjenfangst', label: '3 Gjenfangst' },
];

const SCENARIO_OPTIONS = (Object.keys(SCENARIOS) as McScenario[]).map((value) => ({ value, label: SCENARIOS[value].label }));

/** Merket fisk (merket er en farget lapp på ryggfinnen). */
const C_MARK = BIO.signal;
const C_EST = BIO.hosting;

export default function FangstGjenfangst() {
  const [N, setN] = useState(150);
  const [M, setM] = useState(30);
  const [C, setC] = useState(40);
  const [scenario, setScenario] = useState<McScenario>('ideell');
  const [step, setStep] = useState<Step>('gjenfangst');
  // Frøene til forsøkene som er gjort med disse innstillingene (det siste vises)
  const [seeds, setSeeds] = useState<number[]>([1]);
  const seed = seeds[seeds.length - 1]!;
  const m = Math.min(M, N);
  const c = Math.min(C, N);
  const trial = useMemo(() => markRecaptureTrial({ N, M: m, C: c, seed, scenario }), [N, m, c, seed, scenario]);
  const history = useMemo(
    () => seeds.map((s) => markRecaptureTrial({ N, M: m, C: c, seed: s, scenario })),
    [seeds, N, m, c, scenario],
  );
  const dist = useMemo(() => recaptureDistribution(N, m, c, scenario), [N, m, c, scenario]);
  const summary = summarizeEstimates(dist, m, c);
  const [ref, f] = useContainerTextScale<HTMLDivElement>();
  // Nye innstillinger: begynn på nytt med ett forsøk
  const change = (fn: () => void) => {
    fn();
    setSeeds((s) => [s[s.length - 1]!]);
  };
  const newTrial = () => {
    setSeeds((s) => [...s, Math.max(...s) + 1]);
    setStep('gjenfangst');
  };
  const estimates = history.map((t) => t.estimate).filter((e): e is number => e !== null);
  const meanEst = estimates.length ? estimates.reduce((a, b) => a + b, 0) / estimates.length : null;

  return (
    <VizLayout>
      <Controls>
        <Slider
          label="Fisk i dammen (fasit)"
          value={N}
          onChange={(v) =>
            change(() => {
              setN(v);
              setM((x) => Math.min(x, v));
              setC((x) => Math.min(x, v));
            })
          }
          min={50}
          max={250}
          step={10}
        />
        <Slider label="Fisk som merkes M" value={m} onChange={(v) => change(() => setM(v))} min={5} max={Math.min(80, N)} step={1} />
        <Slider label="Fisk i gjenfangsten C" value={c} onChange={(v) => change(() => setC(v))} min={5} max={Math.min(100, N)} step={1} />
      </Controls>
      <Toolbar>
        <Segmented label="Steg i forsøket" options={STEPS} value={step} onChange={setStep} />
        <button type="button" className="btn btn-sm" onClick={newTrial}>
          <RefreshCw size={16} aria-hidden />
          Nytt forsøk
        </button>
        <button type="button" className="btn btn-sm btn-ghost" onClick={() => setSeeds([seed])} disabled={seeds.length < 2}>
          <RotateCcw size={16} aria-hidden />
          Nullstill forsøkene
        </button>
      </Toolbar>
      <Toolbar>
        <Select label="Feilkilde" value={scenario} options={SCENARIO_OPTIONS} onChange={(v) => change(() => setScenario(v))} />
      </Toolbar>

      <div ref={ref}>
        <Pond trial={trial} step={step} scenario={scenario} f={f} M={m} C={c} />
      </div>
      <Legend
        items={[
          { color: BIO.fisk.line, label: 'Fisk uten merke' },
          { color: C_MARK, label: 'Merket fisk' },
          ...(scenario === 'merkeTap' ? [{ color: C_MARK, label: 'Merket, men merket har falt av', dashed: true }] : []),
          { color: C_EST, label: 'Garn', dashed: true },
        ]}
      />

      <SpreadPlot dist={dist} M={m} C={c} N={N} history={history} f={f} pNone={summary.pNone} />
      <Legend
        items={[
          { color: C_EST, label: 'Sannsynlighet for hvert mulig estimat' },
          { color: C_MARK, label: `Dine forsøk (${history.length})` },
          { color: VIZ.ink, label: 'Virkelig antall', dashed: true },
        ]}
      />

      <Readouts>
        <Readout label="Merkede i gjenfangsten R" value={`${trial.R} av ${c}`} tone={C_MARK} />
        <Readout label="Estimert bestand" value={trial.estimate === null ? 'Kan ikke beregnes' : fmt(trial.estimate, 0)} unit={trial.estimate === null ? undefined : 'fisk'} tone={C_EST} />
        <Readout label="Virkelig antall" value={fmt(N, 0)} unit="fisk" />
        <Readout
          label={history.length > 1 ? `Snitt av ${history.length} forsøk` : 'Forventet R'}
          value={history.length > 1 ? (meanEst === null ? '–' : fmt(meanEst, 0)) : fmt(expectedRecaptures(N, m, c), 1)}
          unit={history.length > 1 ? 'fisk' : 'merkede'}
        />
      </Readouts>

      <Formula label="Lincoln–Petersen-estimatet">
        <FormulaLine>
          Andelen merkede i fangsten = andelen merkede i dammen: R / C = M / N, altså N ≈ M · C / R
        </FormulaLine>
        {trial.estimate === null ? (
          <FormulaLine>R = 0: M · C / R kan ikke regnes ut (deling med null).</FormulaLine>
        ) : (
          <FormulaLine>
            N ≈ {m} · {c} / {trial.R} = {fmt(trial.estimate, 0)} fisk (andel merkede i fangsten {fmtPct(trial.R / c)}, i dammen {fmtPct(m / N)})
          </FormulaLine>
        )}
        <FormulaLine>
          Korrigert (Chapman): (M + 1)(C + 1)/(R + 1) − 1 = {fmt(chapman(m, c, trial.R), 0)} fisk
        </FormulaLine>
      </Formula>

      <Explain>{explanation({ N, M: m, C: c, trial, scenario, summary, history })}</Explain>
    </VizLayout>
  );
}

/* ---------- Dammen ---------- */

function Pond({ trial, step, scenario, f, M, C }: { trial: McTrial; step: Step; scenario: McScenario; f: number; M: number; C: number }) {
  const clip = useSvgId('dam');
  const k = Math.max(1, f * 0.85);
  const titleH = 30 * f;
  const RX = 372;
  const RY = Math.round(185 + 130 * (f - 1));
  const cx = 400;
  const cy = titleH + 14 + RY;
  const H = Math.round(cy + RY + 12);
  const n = trial.before.length;
  const spacing = Math.sqrt((Math.PI * RX * RY) / Math.max(1, n));
  const size = Math.min(32 * k, Math.max(14, spacing * 0.72));
  const pos: PondFish[] = step === 'merking' ? trial.before : step === 'utsetting' ? trial.after : trial.atCatch;
  const net = step === 'merking' ? trial.net1 : step === 'gjenfangst' ? trial.net2 : null;
  const map = (p: { u: number; v: number }) => ({ x: cx + p.u * (RX - size * 0.4), y: cy + p.v * (RY - size * 0.3) });
  const title =
    step === 'merking'
      ? `Første fangst: ${M} fisk fanges og merkes`
      : step === 'utsetting'
        ? scenario === 'ikkeBlandet'
          ? 'Utsatt: de merkede blir der de ble fanget'
          : 'Utsatt: de merkede blander seg med resten'
        : `Gjenfangst: ${C} fisk, ${trial.R} av dem merket`;
  const shortTitle = step === 'merking' ? `Fang og merk ${M}` : step === 'utsetting' ? 'Sett ut igjen' : `Fang ${C}: ${trial.R} merket`;
  return (
    <Figure
      viewBox={`0 0 800 ${H}`}
      maxHeight={Math.max(H, 420)}
      label={`Dam med ${n} fisk. ${title}.`}
      caption={
        step === 'gjenfangst'
          ? 'Fisken som ikke ble fanget i gjenfangsten, er tonet ned.'
          : step === 'merking'
            ? 'Fisken i garnet får en farget lapp (merke) før den slippes ut igjen.'
            : scenario === 'ikkeBlandet'
              ? 'De merkede er satt tilbake, men har ikke spredt seg i dammen ennå.'
              : 'De merkede er satt tilbake i dammen og svømmer fritt.'
      }
    >
      <Txt x={24} y={22 * f} anchor="start" weight={700}>
        {f > 1.3 ? shortTitle : title}
      </Txt>
      <defs>
        <clipPath id={clip}>
          <ellipse cx={cx} cy={cy} rx={RX} ry={RY} />
        </clipPath>
      </defs>
      <ellipse cx={cx} cy={cy} rx={RX} ry={RY} fill={BIO.vannFyll} stroke={BIO.vann} strokeWidth={2} />
      {net && (
        <ellipse
          clipPath={`url(#${clip})`}
          cx={cx + net.u * (RX - size * 0.4)}
          cy={cy + net.v * (RY - size * 0.3)}
          rx={net.r * RX}
          ry={net.r * RY}
          fill={C_EST}
          fillOpacity={0.08}
          stroke={C_EST}
          strokeWidth={2.5}
          strokeDasharray="7 5"
        />
      )}
      {pos.map((p, i) => {
        const { x, y } = map(p);
        const marked = trial.marked.has(i);
        // Merket synes etter første fangst; i gjenfangsten ser vi bare merker som sitter på
        const lost = trial.lostTag.has(i) && step === 'gjenfangst';
        const showTag = marked;
        const dim = step === 'gjenfangst' ? !trial.caught.has(i) : step === 'merking' ? !marked : false;
        return (
          <g key={i} opacity={dim ? 0.3 : 1}>
            <g transform={p.right ? undefined : `translate(${2 * x} 0) scale(-1 1)`}>
              <Fisk x={x} y={y} size={size} />
            </g>
            {showTag && (
              <circle
                cx={x + (p.right ? -1 : 1) * size * 0.02}
                cy={y - size * 0.3}
                r={Math.max(3.2, size * 0.13)}
                fill={lost ? VIZ.surface : C_MARK}
                stroke={C_MARK}
                strokeWidth={1.6}
                strokeDasharray={lost ? '2.5 2' : undefined}
              />
            )}
          </g>
        );
      })}
    </Figure>
  );
}

/* ---------- Spredningen i estimatet ---------- */

function SpreadPlot({
  dist,
  M,
  C,
  N,
  history,
  f,
  pNone,
}: {
  dist: number[];
  M: number;
  C: number;
  N: number;
  history: McTrial[];
  f: number;
  pNone: number;
}) {
  const H = Math.round(320 + 260 * (f - 1));
  const { max: xMax, ticks: xTicks } = niceAxis(3 * N, 5);
  // Estimater over xMax samles i én pinne helt til høyre
  const sticks: { x: number; p: number; r: number[]; over: boolean }[] = [];
  let overP = 0;
  const overR: number[] = [];
  dist.forEach((p, r) => {
    if (r === 0) return;
    const est = (M * C) / r;
    if (est > xMax) {
      overP += p;
      overR.push(r);
    } else if (p >= 0.0005) sticks.push({ x: est, p, r: [r], over: false });
  });
  if (overP > 0.0005) sticks.push({ x: xMax, p: overP, r: overR, over: true });
  const pMax = Math.max(0.01, ...sticks.map((s) => s.p));
  const { max: yMax, ticks: yTicks } = niceAxis(pMax * 100 * 1.2, 4);
  // Hvor mange av forsøkene som ga hver R
  const hits = new Map<number, number>();
  for (const t of history) hits.set(t.R, (hits.get(t.R) ?? 0) + 1);
  const noneHits = hits.get(0) ?? 0;
  return (
    <Figure
      viewBox={`0 0 800 ${H}`}
      label={`Sannsynligheten for hvert mulig estimat når forsøket gjentas mange ganger, med M = ${M}, C = ${C} og ${N} fisk i dammen.`}
      caption={
        pNone >= 0.005
          ? `Med sannsynlighet ${fmtPct(pNone)} blir R = 0, og da gir metoden ikke noe estimat${noneHits ? ` (${noneHits} av dine forsøk)` : ''}.`
          : 'Hver pinne er ett mulig resultat: R merkede i gjenfangsten gir estimatet M · C / R.'
      }
    >
      <Plot
        x={{ min: 0, max: xMax, label: 'Estimert antall fisk', ticks: xTicks }}
        y={{ min: 0, max: yMax, label: 'Sannsynlighet (%)', ticks: yTicks }}
        width={800}
        height={H}
      >
        {({ sx, sy, y0, y1 }) => <Sticks sticks={sticks} hits={hits} sx={sx} sy={sy} y0={y0} y1={y1} N={N} xMax={xMax} />}
      </Plot>
    </Figure>
  );
}

function Sticks({
  sticks,
  hits,
  sx,
  sy,
  y0,
  y1,
  N,
  xMax,
}: {
  sticks: { x: number; p: number; r: number[]; over: boolean }[];
  hits: Map<number, number>;
  sx: (v: number) => number;
  sy: (v: number) => number;
  y0: number;
  y1: number;
  N: number;
  xMax: number;
}) {
  const f = useTextScale();
  const dot = 4.5 * Math.max(1, f * 0.85);
  return (
    <g>
      <line x1={sx(N)} x2={sx(N)} y1={y0} y2={y1} stroke={VIZ.ink} strokeWidth={2} strokeDasharray="7 5" />
      {sticks.map((s, i) => {
        const count = s.r.reduce((a, r) => a + (hits.get(r) ?? 0), 0);
        const x = sx(s.x);
        const y = sy(s.p * 100);
        const shown = Math.min(count, 8);
        return (
          <g key={i}>
            <line x1={x} x2={x} y1={y0} y2={y} stroke={count ? C_MARK : C_EST} strokeWidth={count ? 3 : 2.2} strokeDasharray={s.over ? '4 3' : undefined} />
            <circle cx={x} cy={y} r={4} fill={count ? C_MARK : C_EST} />
            {Array.from({ length: shown }, (_, j) => (
              <circle key={j} cx={x} cy={y - (j + 1) * (2 * dot + 2) - 2} r={dot} fill={C_MARK} stroke={VIZ.surface} strokeWidth={1.2} />
            ))}
            {count > shown && (
              <Txt x={x} y={y - (shown + 1) * (2 * dot + 2) - 4} size={0.7} color={C_MARK}>
                +{count - shown}
              </Txt>
            )}
            {s.over && (
              <Txt x={x - 6} y={y - 10 * f} anchor="end" size={0.75} muted>
                over {fmt(xMax, 0)}
              </Txt>
            )}
          </g>
        );
      })}
    </g>
  );
}

/* ---------- Forklaring ---------- */

function explanation({
  N,
  M,
  C,
  trial,
  scenario,
  summary,
  history,
}: {
  N: number;
  M: number;
  C: number;
  trial: McTrial;
  scenario: McScenario;
  summary: ReturnType<typeof summarizeEstimates>;
  history: McTrial[];
}): ReactNode {
  const err = trial.estimate === null ? null : (trial.estimate - N) / N;
  const idea = (
    <p>
      <strong>Ideen:</strong> etter utsettingen er {M} av de {N} fiskene merket ({fmtPct(M / N)}). Hvis de merkede har blandet seg jevnt, er
      andelen merkede i en ny, tilfeldig fangst omtrent den samme. Da kan vi regne baklengs fra andelen i fangsten (R/C) til hele bestanden.
    </p>
  );
  const assumptions = (
    <p>
      Metoden forutsetter at bestanden er lukket (ingen fødes, dør, kommer til eller drar mellom fangstene), at merkene ikke faller av og
      ikke skader fisken, at de merkede blander seg jevnt, og at alle fisk er like lette å fange.
    </p>
  );
  const spread = (
    <p>
      Resultatet avhenger av tilfeldighetene i hvilke fisk som havner i garnet. Med disse tallene{' '}
      {summary.pNone >= 0.01
        ? `gir ${fmtPct(summary.pNone)} av forsøkene R = 0 (ikke noe estimat), og 95 % av de andre gir`
        : 'gir 95 % av forsøkene'}{' '}
      et estimat mellom {fmt(summary.low, 0)} og {fmt(summary.high, 0)}. Merk og fang flere fisk for å få et sikrere estimat, og trykk
      «Nytt forsøk» for å se spredningen
      {history.length > 1 ? ` (du har gjort ${history.length} forsøk)` : ''}.
    </p>
  );
  const result =
    trial.estimate === null ? (
      <p>
        <strong>Ingen merkede i gjenfangsten (R = 0).</strong> Da kan vi ikke regne ut M · C / R. Det betyr ikke at det er uendelig mange
        fisk, bare at utvalget er for lite. Merk flere fisk eller fang flere i gjenfangsten.
      </p>
    ) : (
      <p>
        I gjenfangsten var {trial.R} av {C} fisk merket ({fmtPct(trial.R / C)}). Estimatet blir {M} · {C} / {trial.R} ={' '}
        <strong>{fmt(trial.estimate, 0)} fisk</strong>, mens det virkelige antallet er {N}
        {err !== null && Math.abs(err) < 0.1 ? ', altså ganske nær.' : err !== null && err > 0 ? ', altså for høyt.' : ', altså for lavt.'}
      </p>
    );
  if (scenario === 'ideell')
    return (
      <>
        {result}
        {idea}
        {spread}
        {assumptions}
      </>
    );
  const bias: Record<Exclude<McScenario, 'ideell'>, ReactNode> = {
    ikkeBlandet: (
      <p>
        <strong>De merkede har ikke blandet seg.</strong> De holder seg der de ble fanget (se steg 2), mens gjenfangsten skjer et annet sted. Da
        blir det for få merkede i gjenfangsten, R blir for liten, og estimatet blir <strong>for høyt</strong>. I praksis venter man lenge nok
        til at de merkede rekker å spre seg, og fanger flere steder.
      </p>
    ),
    merkeTap: (
      <p>
        <strong>Noen merker har falt av</strong> (stiplet ring). Fisken ble merket i første fangst, men nå kan vi ikke se det, så vi teller for
        få merkede. R blir for liten, og estimatet blir <strong>for høyt</strong>. Derfor bruker forskere merker som sitter godt, og noen ganger
        to merker på samme fisk for å finne ut hvor mange som faller av.
      </p>
    ),
    fellelyst: (
      <p>
        <strong>Merkede fisk fanges lettere</strong>, for eksempel fordi de lærte at det var mat (agn) der de ble fanget første gang. Da blir
        det for mange merkede i gjenfangsten, R blir for stor, og estimatet blir <strong>for lavt</strong>. Det motsatte (fisk som har lært å
        unngå redskapet) gir for høye estimater. Derfor bruker man gjerne en annen fangstmetode i gjenfangsten.
      </p>
    ),
  };
  return (
    <>
      {result}
      {bias[scenario]}
      <p>
        Over mange forsøk blir estimatet i snitt ca. {fmt(summary.mean, 0)} fisk med denne feilen, mot {N} i virkeligheten. Flere forsøk hjelper
        ikke mot en systematisk feil: alle forsøkene blir skjeve i samme retning.
      </p>
      {assumptions}
    </>
  );
}
