import { useState, type ReactNode } from 'react';
import {
  Begerglass,
  Controls,
  Erlenmeyerkolbe,
  Explain,
  Figure,
  Formel,
  Formula,
  FormulaLine,
  KJEMI,
  Readout,
  Readouts,
  Reaksjon,
  Segmented,
  Select,
  Slider,
  TFormel,
  TReaksjon,
  TSub,
  Toolbar,
  Txt,
  VIZ,
  VizLayout,
  atomColors,
  fmt,
  fmtSig,
  formulaText,
  molarMassTerms,
  placeParticles,
  useContainerTextScale,
} from '../kit';
import { GRAV, GRAV_ERRORS, gravError, gravimetry, reagentNeeded, type GravAnalysis, type GravError, type GravId, type GravResult } from './model';

type Step = '1' | '2' | '3' | '4';

const STEPS: { value: Step; label: string; title: string }[] = [
  { value: '1', label: '1 Felling', title: 'Felling' },
  { value: '2', label: '2 Filtrering', title: 'Filtrering og tørking' },
  { value: '3', label: '3 Veiing', title: 'Veiing' },
  { value: '4', label: '4 Utregning', title: 'Utregning' },
];

/** Hvitt bunnfall som er lyst i begge temaer (samme farge som hydrogenatomer). */
const SOLID = atomColors('H');

export default function Gravimetri() {
  const [id, setId] = useState<GravId>('klorid');
  const a = GRAV[id];
  const [V, setV] = useState(a.V);
  const [m, setM] = useState(a.m);
  const [step, setStep] = useState<Step>('4');
  const [err, setErr] = useState<GravError>('ingen');
  const [ref, f] = useContainerTextScale<HTMLDivElement>();

  const res = gravimetry(a, m, V);
  const e = gravError(err, m);
  const truth = gravimetry(a, e.mTrue, V);
  const narrow = f > 1.3;

  const choose = (v: GravId) => {
    setId(v);
    setV(GRAV[v].V);
    setM(GRAV[v].m);
  };

  const labH = labHeight(f);
  const chainH = chainHeight(f);

  return (
    <VizLayout>
      <Toolbar>
        <Segmented
          label="Analyse"
          options={(Object.keys(GRAV) as GravId[]).map((k) => ({
            value: k,
            label: (
              <>
                {capital(GRAV[k].analyte.name)} som <Formel f={GRAV[k].precipitate.formula} />
              </>
            ),
          }))}
          value={id}
          onChange={choose}
        />
      </Toolbar>
      <Controls>
        <Slider label="Prøvevolum V" value={V} onChange={setV} min={25} max={250} step={5} unit="mL" />
        <Slider
          label="Masse tørt bunnfall m"
          ariaLabel="Masse tørt bunnfall"
          value={m}
          onChange={(v) => setM(Math.round(v * 10000) / 10000)}
          min={0.005}
          max={0.5}
          step={0.0005}
          unit="g"
          decimals={4}
        />
      </Controls>
      <Toolbar>
        <Segmented label="Steg i analysen" options={STEPS.map((s) => ({ value: s.value, label: s.label }))} value={step} onChange={setStep} />
        <Select label="Feilkilde" value={err} onChange={setErr} options={(Object.keys(GRAV_ERRORS) as GravError[]).map((k) => ({ value: k, label: GRAV_ERRORS[k].text }))} />
      </Toolbar>

      <div ref={ref}>
        <Figure
          viewBox={`0 0 800 ${labH}`}
          label={`Gravimetrisk bestemmelse av ${a.analyte.name}: ${formulaText(a.precipitate.formula)} felles ut, filtreres, tørkes og veies. Vekta viser ${fmt(m, 4)} g.`}
          caption={narrow ? `Steg ${step} av 4. Velg steg over figuren.` : undefined}
          maxHeight={labH}
        >
          <Lab a={a} m={m} V={V} step={step} err={err} f={f} H={labH} />
        </Figure>
      </div>

      <Figure
        viewBox={`0 0 800 ${chainH}`}
        label={`Utregningen: ${fmt(m, 4)} g ${formulaText(a.precipitate.formula)} er ${fmtSig(res.nP, 3)} mol, som gir ${fmtSig(res.mgPerL, 3)} mg/L ${a.analyte.name}.`}
        maxHeight={chainH}
      >
        <Chain a={a} res={res} V={V} m={m} step={step} f={f} />
      </Figure>

      <Readouts>
        <Readout label={<>n(<Formel f={a.precipitate.formula} />)</>} value={fmtSig(res.nP, 3)} unit="mol" />
        <Readout label={<>c(<Formel f={a.analyte.formula} />)</>} value={fmtSig(res.c, 3)} unit="mol/L" />
        <Readout
          label={<>Massekonsentrasjon {a.analyte.name}</>}
          value={fmtSig(res.mgPerL, 3)}
          unit="mg/L"
          tone={a.limit !== null && res.mgPerL > a.limit ? KJEMI.minus : VIZ.series[0]}
        />
        {err !== 'ingen' ? (
          <Readout label="Riktig verdi (uten feilkilden)" value={fmtSig(truth.mgPerL, 3)} unit="mg/L" tone={VIZ.series[1]} />
        ) : a.limit !== null ? (
          <Readout label="Grenseverdi i drikkevann" value={fmt(a.limit, 0)} unit="mg/L" />
        ) : (
          <Readout label="Masseandel (1,00 g/mL)" value={fmtSig(res.ppm, 3)} unit="ppm" />
        )}
      </Readouts>

      <Formula label="Utregning">
        <FormulaLine>
          M(<Formel f={a.precipitate.formula} state={false} />) ={' '}
          {molarMassTerms(a.precipitate.formula)
            .map((t) => (t.count === 1 ? fmt(t.M, t.M < 10 ? 3 : 2) : `${t.count} · ${fmt(t.M, t.M < 10 ? 3 : 2)}`))
            .join(' + ')}{' '}
          = {fmt(res.M, 2)} g/mol
        </FormulaLine>
        <FormulaLine>
          n(<Formel f={a.precipitate.formula} state={false} />) = m / M = {fmt(m, 4)} g / {fmt(res.M, 2)} g/mol = {fmtSig(res.nP, 3)} mol
        </FormulaLine>
        <FormulaLine>
          n(<Formel f={a.analyte.formula} />) = n(<Formel f={a.precipitate.formula} state={false} />) = {fmtSig(res.nA, 3)} mol (1 : 1 etter likningen)
        </FormulaLine>
        <FormulaLine>
          c(<Formel f={a.analyte.formula} />) = n / V = {fmtSig(res.nA, 3)} mol / {fmt(V / 1000, 3)} L = {fmtSig(res.c, 3)} mol/L
        </FormulaLine>
        <FormulaLine>
          m(<Formel f={a.analyte.formula} />) = n · M = {fmtSig(res.nA, 3)} mol · {fmt(res.Ma, 2)} g/mol = {fmtSig(res.mA * 1000, 3)} mg
        </FormulaLine>
        <FormulaLine>
          Massekonsentrasjon = {fmtSig(res.mA * 1000, 3)} mg / {fmt(V / 1000, 3)} L = {fmtSig(res.mgPerL, 3)} mg/L
        </FormulaLine>
        {err !== 'ingen' && (
          <FormulaLine>
            Uten feilkilden: m = {fmt(e.mTrue, 4)} g, som gir {fmtSig(truth.mgPerL, 3)} mg/L (resultatet blir {fmt(Math.abs(e.relError) * 100, 0)} %{' '}
            {e.relError > 0 ? 'for høyt' : 'for lavt'})
          </FormulaLine>
        )}
      </Formula>

      <Explain>{explanation(a, res, truth, V, m, step, err)}</Explain>
    </VizLayout>
  );
}

/* ---------- Figur 1: laboratoriet ---------- */

/** Skalaen til tegningen når bare én stasjon vises (mobil). */
const ONE_SCALE = 2;

function labHeight(f: number): number {
  const top = 48 * f + 4;
  return Math.round(f > 1.3 ? top + 222 * ONE_SCALE + 46 * f : 340);
}

interface StationProps {
  a: GravAnalysis;
  m: number;
  V: number;
  err: GravError;
  /** Midten av stasjonen og toppen av tegningen. */
  cx: number;
  top: number;
  /** Skala for tegningen (1 på PC, større når bare én stasjon vises). */
  s: number;
  k: number;
}

function Lab({ a, m, V, step, err, f, H }: { a: GravAnalysis; m: number; V: number; step: Step; err: GravError; f: number; H: number }) {
  const k = Math.max(1, 0.85 * f);
  const narrow = f > 1.3;
  const titleY = 26 * f;
  const top = titleY + 22 * f;
  const capY = H - 14;
  const stations = [
    { n: '1', title: 'Felling', cap: <TReaksjon r={a.equation} />, draw: Precipitation },
    { n: '2', title: 'Filtrering og tørking', cap: <>tørket ved {a.dry}</>, draw: Filtration },
    { n: '3', title: 'Veiing', cap: <>vekta viser massen av bunnfallet</>, draw: Weighing },
  ];
  if (narrow) {
    // Mobil: bare steget som er valgt (utregningen viser vekta), større
    const i = step === '4' ? 2 : Number(step) - 1;
    const st = stations[i]!;
    const Draw = st.draw;
    return (
      <g>
        <StepBadge x={40} y={titleY} n={st.n} on f={f} />
        <Txt x={40 + 26 * f} y={titleY + 7 * f} anchor="start" weight={700}>
          {st.title}
        </Txt>
        <Draw a={a} m={m} V={V} err={err} cx={400} top={top + 4} s={ONE_SCALE} k={k} />
        <Txt x={400} y={capY} size={0.85} muted>
          {st.cap}
        </Txt>
      </g>
    );
  }
  const xs = [135, 400, 665];
  return (
    <g>
      {stations.map((st, i) => {
        const on = st.n === step || (step === '4' && i === 2);
        const Draw = st.draw;
        return (
          <g key={st.n} opacity={on ? 1 : 0.5}>
            <StepBadge x={xs[i]! - 70} y={titleY} n={st.n} on={on} f={f} />
            <Txt x={xs[i]! - 70 + 20} y={titleY + 6} anchor="start" weight={on ? 700 : 600} size={0.9}>
              {st.title}
            </Txt>
            <Draw a={a} m={m} V={V} err={err} cx={xs[i]!} top={top} s={1} k={k} />
            <Txt x={xs[i]!} y={capY} size={i === 0 ? 0.72 : 0.78} muted>
              {st.cap}
            </Txt>
          </g>
        );
      })}
      {[0, 1].map((i) => (
        <g key={i} opacity={0.6}>
          <line x1={xs[i]! + 105} y1={top + 120} x2={xs[i + 1]! - 110} y2={top + 120} stroke={VIZ.muted} strokeWidth={2} />
          <polygon points={`${xs[i + 1]! - 104},${top + 120} ${xs[i + 1]! - 114},${top + 114} ${xs[i + 1]! - 114},${top + 126}`} fill={VIZ.muted} />
        </g>
      ))}
    </g>
  );
}

function StepBadge({ x, y, n, on, f }: { x: number; y: number; n: string; on: boolean; f: number }) {
  return (
    <g>
      <circle cx={x} cy={y} r={12 * f} fill={on ? VIZ.series[0] : VIZ.body} stroke={on ? VIZ.series[0] : VIZ.bodyStrong} strokeWidth={2} />
      <text x={x} y={y + 5 * f} textAnchor="middle" style={{ fill: on ? VIZ.surface : VIZ.ink, fontSize: 14 * f, fontWeight: 700 }}>
        {n}
      </text>
    </g>
  );
}

/** Bunnfallsfnugg: faste posisjoner i en boks, flere når massen er større. */
function Flakes({ box, n, seed, r }: { box: { x: number; y: number; w: number; h: number }; n: number; seed: number; r: number }) {
  if (box.w <= 2 * r || box.h <= 2 * r || n <= 0) return null;
  const pts = placeParticles(box, [{ n, r }], seed, 1);
  return (
    <g>
      {pts.map((p) => (
        <circle key={p.index} cx={p.x} cy={p.y} r={p.r} fill={SOLID.fill} stroke={SOLID.line} strokeWidth={1} />
      ))}
    </g>
  );
}

/** Antall fnugg i figuren: vokser med massen (men med grenser, så det alltid synes og aldri fyller alt). */
const flakeCount = (m: number) => Math.round(6 + 40 * Math.sqrt(Math.min(1, m / 0.5)));

function Precipitation({ a, m, err, cx, top, s, k }: StationProps) {
  const w = 130 * s;
  const h = 150 * s;
  const x = cx - w / 2;
  const y = top + 60 * s;
  const n = flakeCount(m) * (err === 'underskudd' ? 0.8 : 1);
  return (
    <g>
      {/* Dråpeteller med fellingsreagens */}
      <rect x={cx + 14 * s - 5 * k} y={top} width={10 * k} height={44 * s} rx={3} fill={KJEMI.glassFill} stroke={KJEMI.glass} strokeWidth={1.5} />
      <ellipse cx={cx + 14 * s} cy={top - 4} rx={9 * k} ry={10 * k} fill={VIZ.bodyStrong} stroke={KJEMI.glass} strokeWidth={1.5} />
      <path d={`M${cx + 14 * s},${top + 52 * s} q${4 * k},${7 * k} 0,${10 * k} q${-4 * k},${-3 * k} 0,${-10 * k} Z`} fill={KJEMI.liquid} stroke={KJEMI.liquidLine} strokeWidth={1} />
      <Txt x={cx + 14 * s + 14 * k} y={top + 18 * s} anchor="start" size={0.72} muted>
        <TFormel f={a.reagent.formula} />
      </Txt>
      <Begerglass x={x} y={y} w={w} h={h} level={0.62}>
        {(box) => (
          <g>
            <Flakes box={{ x: box.x, y: box.y + box.h * 0.2, w: box.w, h: box.h * 0.8 }} n={Math.round(n * 0.55)} seed={3} r={2.6 * k} />
            <Flakes box={{ x: box.x, y: box.y + box.h * 0.78, w: box.w, h: box.h * 0.22 }} n={Math.round(n * 0.6)} seed={5} r={3 * k} />
            {err === 'underskudd' &&
              placeParticles({ x: box.x, y: box.y, w: box.w, h: box.h * 0.7 }, [{ n: 5, r: 6 * k }], 9, 4).map((p) => (
                <g key={p.index}>
                  <circle cx={p.x} cy={p.y} r={p.r} fill={KJEMI.minus} />
                  <text x={p.x} y={p.y + p.r * 0.4} textAnchor="middle" style={{ fill: VIZ.surface, fontSize: p.r * 1.3, fontWeight: 700 }}>
                    {a.id === 'kalsium' ? '+' : '−'}
                  </text>
                </g>
              ))}
          </g>
        )}
      </Begerglass>
    </g>
  );
}

function Filtration({ m, err, cx, top, s, k }: StationProps) {
  const fw = 120 * s;
  const fh = 80 * s;
  const fy = top + 20 * s;
  const stemY = fy + fh + 40 * s;
  const paper = `M${cx - fw / 2 + 8 * s},${fy + 6 * s} L${cx},${fy + fh + 4 * s} L${cx + fw / 2 - 8 * s},${fy + 6 * s} Z`;
  // Bunnfallet ligger nederst i filterkjeglen; høyden følger massen
  const heap = Math.min(0.75, 0.3 + m * 1.2);
  const tip = fy + fh + 4 * s;
  const hy = tip - fh * heap;
  const hw = ((fw / 2 - 8 * s) * (tip - hy)) / (fh - 2 * s);
  const flask = { w: 110 * s, h: 90 * s };
  const fx = cx - flask.w / 2;
  const fly = stemY - 10 * s;
  return (
    <g>
      <Erlenmeyerkolbe x={fx} y={fly} w={flask.w} h={flask.h} level={0.35}>
        {err === 'tap' && <Flakes box={{ x: cx - 30 * s, y: fly + flask.h - 26 * s, w: 60 * s, h: 18 * s }} n={6} seed={11} r={2.6 * k} />}
      </Erlenmeyerkolbe>
      {/* Trakt med filterpapir og bunnfall */}
      <path
        d={`M${cx - fw / 2},${fy} L${cx - 7 * s},${fy + fh} L${cx - 5 * s},${stemY} M${cx + fw / 2},${fy} L${cx + 7 * s},${fy + fh} L${cx + 5 * s},${stemY}`}
        fill="none"
        stroke={KJEMI.glass}
        strokeWidth={2.5}
        strokeLinejoin="round"
      />
      <path d={paper} fill={VIZ.body} stroke={VIZ.bodyStrong} strokeWidth={1.5} />
      <path d={`M${cx - hw},${hy} Q${cx},${hy - 8 * s} ${cx + hw},${hy} L${cx},${tip} Z`} fill={SOLID.fill} stroke={KJEMI.glass} strokeWidth={1.5} />
      <Flakes box={{ x: cx - hw * 0.7, y: hy - 2 * s, w: hw * 1.4, h: (tip - hy) * 0.55 }} n={Math.round(4 + heap * 14)} seed={21} r={2.3 * k} />
      <path d={`M${cx},${stemY + 6 * s} q${3.5 * k},${6 * k} 0,${9 * k} q${-3.5 * k},${-3 * k} 0,${-9 * k} Z`} fill={KJEMI.liquid} stroke={KJEMI.liquidLine} strokeWidth={1} />
      {err === 'tap' && (
        <Txt x={cx + flask.w / 2 + 6} y={fly + flask.h - 8 * s} anchor="start" size={0.72} weight={700} color={KJEMI.minus}>
          tap
        </Txt>
      )}
    </g>
  );
}

function Weighing({ m, err, cx, top, s, k }: StationProps) {
  const bw = 190 * s;
  const by = top + 150 * s;
  const panY = top + 112 * s;
  const shown = m;
  const heap = 12 + 30 * Math.min(1, Math.sqrt(m / 0.5));
  return (
    <g>
      {/* Vindskjerm */}
      <rect x={cx - bw / 2 + 10 * s} y={top + 10 * s} width={bw - 20 * s} height={by - top - 10 * s} rx={6} fill={KJEMI.glassFill} stroke={KJEMI.glass} strokeWidth={1.5} />
      {/* Skål med filterdigel og bunnfall */}
      <line x1={cx} y1={panY + 6 * s} x2={cx} y2={by} stroke={VIZ.bodyStrong} strokeWidth={6 * s} />
      <ellipse cx={cx} cy={panY + 6 * s} rx={56 * s} ry={8 * s} fill={VIZ.bodyStrong} stroke={KJEMI.glass} strokeWidth={1.5} />
      <path
        d={`M${cx - 27 * s},${panY - 4 * s} Q${cx},${panY - (4 + heap) * s} ${cx + 27 * s},${panY - 4 * s} Z`}
        fill={SOLID.fill}
        stroke={KJEMI.glass}
        strokeWidth={1.5}
      />
      <Flakes box={{ x: cx - 18 * s, y: panY - (4 + heap * 0.45) * s, w: 36 * s, h: heap * 0.4 * s }} n={Math.round(4 + heap / 3)} seed={31} r={2.2 * k} />
      <path d={`M${cx - 32 * s},${panY - 34 * s} L${cx - 24 * s},${panY} L${cx + 24 * s},${panY} L${cx + 32 * s},${panY - 34 * s}`} fill="none" stroke={KJEMI.glass} strokeWidth={2.2} />
      {err === 'fuktig' &&
        [-14, 0, 13].map((dx, i) => (
          <path
            key={dx}
            d={`M${cx + dx * s},${panY - (14 + heap * 0.5 + (i % 2) * 6) * s} q${3 * k},${5 * k} 0,${7.5 * k} q${-3 * k},${-2.5 * k} 0,${-7.5 * k} Z`}
            fill={KJEMI.liquid}
            stroke={KJEMI.liquidLine}
            strokeWidth={1.2}
          />
        ))}
      {/* Vekta med display */}
      <rect x={cx - bw / 2} y={by} width={bw} height={50 * s} rx={8} fill={VIZ.body} stroke={VIZ.bodyStrong} strokeWidth={2} />
      <rect x={cx - 70 * s} y={by + 9 * s} width={140 * s} height={32 * s} rx={4} fill={VIZ.surface} stroke={VIZ.bodyStrong} strokeWidth={1.5} />
      <Txt x={cx} y={by + 32 * s} size={s > 1.2 ? 1.1 : 0.9} weight={700} halo={false}>
        {fmt(shown, 4)} g
      </Txt>
    </g>
  );
}

/* ---------- Figur 2: utregningskjeden ---------- */

function chainHeight(f: number): number {
  return Math.round(f > 1.3 ? 5 * 58 * f + 4 * 40 * f + 20 : 150 + 40 * (f - 1));
}

function Chain({ a, res, V, m, step, f }: { a: GravAnalysis; res: GravResult; V: number; m: number; step: Step; f: number }) {
  const narrow = f > 1.3;
  const boxes: { title: ReactNode; value: string }[] = [
    {
      title: (
        <>
          m(<TFormel f={a.precipitate.formula} state={false} />)
        </>
      ),
      value: `${fmt(m, 4)} g`,
    },
    {
      title: (
        <>
          n(<TFormel f={a.precipitate.formula} state={false} />)
        </>
      ),
      value: `${fmtSig(res.nP, 3)} mol`,
    },
    {
      title: (
        <>
          n(<TFormel f={a.analyte.formula} />)
        </>
      ),
      value: `${fmtSig(res.nA, 3)} mol`,
    },
    {
      title: (
        <>
          c(<TFormel f={a.analyte.formula} />)
        </>
      ),
      value: `${fmtSig(res.c, 3)} mol/L`,
    },
    { title: <>masse per liter</>, value: `${fmtSig(res.mgPerL, 3)} mg/L` },
  ];
  const ops: { op: ReactNode; detail: string }[] = [
    { op: <>÷ M</>, detail: `${fmt(res.M, 2)} g/mol` },
    { op: <>· 1</>, detail: '1 : 1' },
    { op: <>÷ V</>, detail: `${fmt(V / 1000, 3)} L` },
    {
      op: (
        <>
          · M<TSub>a</TSub>
        </>
      ),
      detail: `${fmt(res.Ma, 2)} g/mol`,
    },
  ];
  // Hvilke deler av kjeden som hører til steget
  const hot = (i: number) => (step === '4' ? true : step === '3' ? i === 0 : step === '1' ? i === 2 : false);
  const hotOp = (i: number) => step === '4' || (step === '1' && i === 1);
  if (!narrow) {
    const w = 124;
    const gap = (800 - 5 * w - 8) / 4;
    const y = 30;
    const h = 92;
    return (
      <g>
        {boxes.map((b, i) => {
          const x = 4 + i * (w + gap);
          return (
            <g key={i} opacity={hot(i) ? 1 : 0.55}>
              <rect x={x} y={y} width={w} height={h} rx={12} fill={VIZ.surface} stroke={hot(i) ? VIZ.series[0] : VIZ.muted} strokeWidth={hot(i) ? 2.5 : 1.5} />
              <Txt x={x + w / 2} y={y + 28} size={0.8} muted>
                {b.title}
              </Txt>
              <Txt x={x + w / 2} y={y + 64} size={0.82} weight={700} color={i === 4 ? VIZ.series[0] : undefined}>
                {b.value}
              </Txt>
            </g>
          );
        })}
        {ops.map((o, i) => {
          const x1 = 4 + i * (w + gap) + w + 4;
          const x2 = x1 + gap - 8;
          const yy = y + h / 2;
          return (
            <g key={i} opacity={hotOp(i) ? 1 : 0.55}>
              <line x1={x1} y1={yy} x2={x2 - 8} y2={yy} stroke={VIZ.ink} strokeWidth={2} />
              <polygon points={`${x2},${yy} ${x2 - 10},${yy - 6} ${x2 - 10},${yy + 6}`} fill={VIZ.ink} />
              <Txt x={(x1 + x2) / 2} y={yy - 10} size={0.8} weight={700}>
                {o.op}
              </Txt>
              <Txt x={(x1 + x2) / 2} y={y + h + 24} size={0.68} muted>
                {o.detail}
              </Txt>
            </g>
          );
        })}
      </g>
    );
  }
  const bh = 58 * f;
  const gap = 40 * f;
  const x = 40;
  const w = 600;
  return (
    <g>
      {boxes.map((b, i) => {
        const y = 10 + i * (bh + gap);
        return (
          <g key={i} opacity={hot(i) ? 1 : 0.55}>
            <rect x={x} y={y} width={w} height={bh} rx={12} fill={VIZ.surface} stroke={hot(i) ? VIZ.series[0] : VIZ.muted} strokeWidth={hot(i) ? 2.5 : 1.5} />
            <Txt x={x + 16} y={y + bh / 2 + 6 * f} anchor="start" size={0.8} muted>
              {b.title}
            </Txt>
            <Txt x={x + w - 16} y={y + bh / 2 + 6 * f} anchor="end" size={0.9} weight={700} color={i === 4 ? VIZ.series[0] : undefined}>
              {b.value}
            </Txt>
          </g>
        );
      })}
      {ops.map((o, i) => {
        const y1 = 10 + i * (bh + gap) + bh + 4;
        const y2 = y1 + gap - 8;
        const xx = x + 60;
        return (
          <g key={i} opacity={hotOp(i) ? 1 : 0.55}>
            <line x1={xx} y1={y1} x2={xx} y2={y2 - 8} stroke={VIZ.ink} strokeWidth={2} />
            <polygon points={`${xx},${y2} ${xx - 6},${y2 - 10} ${xx + 6},${y2 - 10}`} fill={VIZ.ink} />
            <Txt x={xx + 20} y={(y1 + y2) / 2 + 6 * f} anchor="start" size={0.8} weight={700}>
              {o.op}
            </Txt>
            <Txt x={xx + 90 * f} y={(y1 + y2) / 2 + 6 * f} anchor="start" size={0.75} muted>
              {o.detail}
            </Txt>
          </g>
        );
      })}
    </g>
  );
}

/* ---------- Forklaring ---------- */

function explanation(a: GravAnalysis, res: GravResult, truth: GravResult, V: number, m: number, step: Step, err: GravError): ReactNode {
  const P = <Formel f={a.precipitate.formula} />;
  const X = <Formel f={a.analyte.formula} />;
  const R = <Formel f={a.reagent.formula} />;
  const need = reagentNeeded(a, res.nA);
  let now: ReactNode;
  if (step === '1')
    now = (
      <>
        <strong>Felling:</strong> Til {fmt(V, 0)} mL vannprøve tilsettes {a.reagent.name} ({R}). Ionene danner et tungtløselig salt som felles ut som et{' '}
        {a.precipitate.look} bunnfall: <Reaksjon r={a.equation} />. Likningen gir molforholdet: ett mol {P} for hvert mol {X}. Reagenset må tilsettes i
        overskudd, så all analytten felles: her trengs minst {fmtSig(need, 2)} mL {fmt(a.reagent.c, 2)} mol/L {R}.
      </>
    );
  else if (step === '2')
    now = (
      <>
        <strong>Filtrering og tørking:</strong> Bunnfallet samles på et filter og vaskes med litt vann, så løste salter ikke blir med i massen. Så tørkes det
        ved {a.dry} til massen ikke endrer seg mer (konstant masse). Bunnfallet må være rent og tørt før det veies.
      </>
    );
  else if (step === '3')
    now = (
      <>
        <strong>Veiing:</strong> Vekta viser {fmt(m, 4)} g {P}. En analysevekt måler med fire desimaler (0,1 mg), så massen er det sikreste tallet i hele
        analysen. Først veies den tomme filterdigelen, så digelen med bunnfall; forskjellen er massen av bunnfallet.
      </>
    );
  else
    now = (
      <>
        <strong>Utregning:</strong> Massen gjøres om til stoffmengde med den molare massen, n = m/M = {fmtSig(res.nP, 3)} mol {P}. Molforholdet 1 : 1 gir
        like mange mol {X}. Delt på volumet gir det c = {fmtSig(res.c, 3)} mol/L, og ganget med den molare massen til {a.analyte.name} ({fmt(res.Ma, 2)} g/mol){' '}
        {fmtSig(res.mgPerL, 3)} mg/L. Legg merke til at det er M(bunnfall) du deler på, ikke M({a.analyte.name}).
      </>
    );
  const limit =
    a.limit === null ? (
      <>Kalsium har ingen grenseverdi i drikkevannsforskriften, men mye kalsium gir hardt vann og kalkbelegg.</>
    ) : res.mgPerL > a.limit ? (
      <>
        Dette er over grenseverdien for drikkevann ({fmt(a.limit, 0)} mg/L), så vannet bør ikke brukes som drikkevann uten videre behandling.
      </>
    ) : (
      <>
        Grenseverdien for {a.analyte.name} i drikkevann er {fmt(a.limit, 0)} mg/L, så prøven er {res.mgPerL > 0.8 * a.limit ? 'like under' : 'under'}{' '}
        grensen.
      </>
    );
  const errText: Record<GravError, ReactNode> = {
    ingen: null,
    fuktig: (
      <>
        <strong>Feilkilde:</strong> Er bunnfallet ikke helt tørt, veier du også vann. Massen blir for stor, og resultatet for høyt: {fmtSig(res.mgPerL, 3)} mg/L i
        stedet for {fmtSig(truth.mgPerL, 3)} mg/L. Tørk til konstant masse.
      </>
    ),
    tap: (
      <>
        <strong>Feilkilde:</strong> Går noe av bunnfallet gjennom filteret eller blir igjen i begeret, veier du for lite, og resultatet blir for lavt:{' '}
        {fmtSig(res.mgPerL, 3)} mg/L i stedet for {fmtSig(truth.mgPerL, 3)} mg/L. Bruk tett filter og skyll begeret.
      </>
    ),
    underskudd: (
      <>
        <strong>Feilkilde:</strong> Med for lite {R} blir ikke all {a.analyte.name} felt ut (ionene som er igjen i løsningen, ser du i begeret). Massen og
        resultatet blir for lave: {fmtSig(res.mgPerL, 3)} mg/L i stedet for {fmtSig(truth.mgPerL, 3)} mg/L. Tilsett reagens til det ikke dannes mer bunnfall.
      </>
    ),
  };
  return (
    <>
      <p>{now}</p>
      <p>
        Prøven inneholder {fmtSig(res.mgPerL, 3)} mg/L {a.analyte.name}. {limit}
      </p>
      {err !== 'ingen' && <p>{errText[err]}</p>}
    </>
  );
}

const capital = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
