import { useId, useState, type ReactNode } from 'react';
import {
  Controls,
  Dot,
  Explain,
  Figure,
  Formel,
  Formula,
  FormulaLine,
  KJEMI,
  Legend,
  Plot,
  Readout,
  Readouts,
  Select,
  Slider,
  TFormel,
  TSub,
  Toolbar,
  Txt,
  VIZ,
  VizLayout,
  fmt,
  fmtSig,
  formulaText,
  linePath,
  mixColor,
  useContainerTextScale,
  useTextScale,
} from '../kit';
import { SOLUTION_COLOR, colorStrength, spectrumColor } from './farger';
import {
  ABSORBERS,
  VIS_MAX,
  VIS_MIN,
  absorptionMax,
  beerLambert,
  colorWord,
  colorWordNeuter,
  epsilon,
  fitStandardCurve,
  getAbsorber,
  intensityAt,
  measureStandards,
  measuredAbsorbance,
  readSample,
  wavelengthSensitivity,
  type Absorber,
  type AbsorberId,
  type Measurement,
  type SampleReading,
  type StandardCurve,
} from './model';

/** Konsentrasjonene vises i mmol/L. */
const MM = 1000;

/** Steg og desimaler på konsentrasjonsglidebryteren for hvert stoff (mmol/L). */
const C_STEP: Record<AbsorberId, { step: number; decimals: number }> = {
  permanganat: { step: 0.01, decimals: 2 },
  kobberammin: { step: 0.5, decimals: 1 },
  jerntiocyanat: { step: 0.005, decimals: 3 },
};

export default function Spektrofotometri() {
  const [id, setId] = useState<AbsorberId>('permanganat');
  const a = getAbsorber(id);
  const peak = absorptionMax(a).nm;
  const [nm, setNm] = useState(Math.round(peak));
  const [cmm, setCmm] = useState(a.cDefault * MM);
  const [l, setL] = useState(1);
  const [ref, f] = useContainerTextScale<HTMLDivElement>();

  const c = cmm / MM;
  const standards = measureStandards(a, nm, l);
  const curve = fitStandardCurve(standards);
  const r = readSample(a, nm, l, c, curve);
  const eps = epsilon(a, nm);
  const sens = wavelengthSensitivity(a, nm);

  const choose = (v: AbsorberId) => {
    const next = getAbsorber(v);
    setId(v);
    setNm(Math.round(absorptionMax(next).nm));
    setCmm(next.cDefault * MM);
  };

  const sceneH = sceneHeight(f);
  const plotH = Math.round(300 + 250 * (f - 1));
  const step = C_STEP[id];

  return (
    <VizLayout>
      <Toolbar>
        <Select
          label="Løsning"
          value={id}
          onChange={choose}
          options={ABSORBERS.map((x) => ({ value: x.id, label: `${formulaText(x.formula)} (${x.short})` }))}
        />
        <button type="button" className="btn btn-sm" onClick={() => setNm(Math.round(peak))} disabled={nm === Math.round(peak)}>
          Mål ved absorpsjonsmaksimum
        </button>
      </Toolbar>
      <Controls>
        <Slider label="Bølgelengde λ" value={nm} onChange={setNm} min={VIS_MIN + 10} max={VIS_MAX - 10} step={1} unit="nm" />
        <Slider
          label="Konsentrasjon i prøven c"
          ariaLabel="Konsentrasjon i prøven"
          value={cmm}
          onChange={(v) => setCmm(Math.round(v / step.step) * step.step)}
          min={0}
          max={a.cMax * MM}
          step={step.step}
          unit="mmol/L"
          decimals={step.decimals}
        />
        <Slider label="Kyvettelengde l" value={l} onChange={setL} min={0.5} max={2} step={0.1} unit="cm" decimals={1} />
      </Controls>

      <div ref={ref}>
        <Figure
          viewBox={`0 0 800 ${sceneH}`}
          label={`Fotometer: lys med bølgelengde ${nm} nm går gjennom ${fmt(l, 1)} cm ${a.name}-løsning. Transmittans ${fmt(r.T * 100, 0)} %, absorbans ${fmt(r.A, 2)}.`}
          caption="Monokromatoren slipper bare gjennom lys med den valgte bølgelengden. Strålen blir svakere gjennom kyvetten fordi partiklene absorberer lys: intensiteten avtar med samme faktor for hver millimeter."
          maxHeight={sceneH}
        >
          <Scene a={a} nm={nm} c={c} l={l} r={r} f={f} H={sceneH} />
        </Figure>
      </div>

      <Figure
        viewBox={`0 0 800 ${plotH}`}
        label={`Absorpsjonsspekter for ${a.name}: maksimum ved ${fmt(peak, 0)} nm. Valgt bølgelengde ${nm} nm.`}
        caption="Absorpsjonsspekteret til prøven. Fargen under aksen er lyset med hver bølgelengde: løsningen absorberer lyset der kurven er høy og ser ut som fargen til lyset som slipper gjennom."
        maxHeight={plotH}
      >
        <SpectrumPlot a={a} nm={nm} c={c} l={l} H={plotH} />
      </Figure>

      <Figure
        viewBox={`0 0 800 ${plotH}`}
        label={`Standardkurve: absorbans mot konsentrasjon. Prøven har A = ${fmt(r.A, 2)}, som gir c = ${fmtSig(r.cFound * MM, 3)} mmol/L.`}
        maxHeight={plotH}
      >
        <CurvePlot a={a} nm={nm} l={l} c={c} standards={standards} curve={curve} r={r} H={plotH} />
      </Figure>
      <Legend
        items={[
          { color: VIZ.series[0]!, label: 'Standardløsninger og tilpasset linje' },
          { color: VIZ.series[1]!, label: 'Prøven (avlest konsentrasjon)' },
          { color: VIZ.muted, label: 'Det fotometeret egentlig måler (bøyer av ved høy c)', dashed: true },
        ]}
      />

      <Readouts>
        <Readout label="Absorbans A" value={fmt(r.A, 3)} tone={VIZ.series[1]} />
        <Readout label="Transmittans T" value={fmt(r.T * 100, r.T < 0.1 ? 1 : 0)} unit="%" />
        <Readout label="Stigningstall k = ε · l" value={r.status === 'ingen-absorpsjon' ? '≈ 0' : fmtSig(curve.slope, 3)} unit="L/mol" />
        <Readout
          label="c fra standardkurven"
          value={r.status === 'ingen-absorpsjon' ? '–' : fmtSig(r.cFound * MM, 3)}
          unit="mmol/L"
          tone={r.status === 'over' ? KJEMI.minus : VIZ.series[1]}
        />
      </Readouts>

      <Formula label="Utregning">
        <FormulaLine>
          A = −lg T = −lg {fmt(r.T, 3)} = {fmt(r.A, 3)}
        </FormulaLine>
        <FormulaLine>
          Beer–Lamberts lov: A = ε · l · c, der ε({nm} nm) = {fmtSig(eps, 3)} L/(mol·cm) og l = {fmt(l, 1)} cm
        </FormulaLine>
        {r.status !== 'ingen-absorpsjon' && (
          <FormulaLine>
            Standardkurven: A = k · c med k = {fmtSig(curve.slope, 3)} L/mol (teoretisk ε · l = {fmtSig(eps * l, 3)} L/mol)
          </FormulaLine>
        )}
        {r.status !== 'ingen-absorpsjon' && (
          <FormulaLine>
            c = A / k = {fmt(r.A, 3)} / {fmtSig(curve.slope, 3)} L/mol = {fmtSig(r.cFound, 3)} mol/L = {fmtSig(r.cFound * MM, 3)} mmol/L
          </FormulaLine>
        )}
      </Formula>

      <Explain>{explanation(a, nm, c, l, r, sens)}</Explain>
    </VizLayout>
  );
}

/* ---------- Figur 1: fotometeret ---------- */

function sceneHeight(f: number): number {
  return Math.round(f > 1.3 ? 250 + 120 * (f - 1) : 270);
}

function Scene({ a, nm, c, l, r, f, H }: { a: Absorber; nm: number; c: number; l: number; r: SampleReading; f: number; H: number }) {
  const k = Math.max(1, 0.85 * f);
  const narrow = f > 1.3;
  // Etikettene står over og under delene; strålen går midt imellom.
  const labelTop = 22 * f;
  const labelBottom = H - 12;
  const by = (labelTop + labelBottom) / 2 + 4;
  const bh = narrow ? 34 : 30;
  const light = spectrumColor(nm);
  const eps = epsilon(a, nm);
  // Kyvetten: bredden følger l
  const cw = 60 + l * 80;
  const cx = narrow ? 425 : 440;
  const cx0 = cx - cw / 2;
  const cx1 = cx + cw / 2;
  const ch = Math.min(170, labelBottom - labelTop - 40 * f - 20);
  const cTop = by - ch / 2 - 6;
  // Fargen på løsningen: hvor sterk den ser ut, ut fra absorbansen ved maksimum i en 1 cm kyvette
  const strength = colorStrength(beerLambert(a.epsMax, 1, c));
  const liquid = mixColor(KJEMI.liquid, SOLUTION_COLOR[a.id], strength);
  // Strålen gjennom væsken: høyden følger intensiteten (I/I₀)
  const N = 30;
  const top: string[] = [];
  const bottom: string[] = [];
  for (let i = 0; i <= N; i++) {
    const x = cx0 + (cw * i) / N;
    const I = intensityAt(eps, c, (l * i) / N);
    const h = Math.max(0.03, I) * (bh / 2);
    top.push(`${x},${by - h}`);
    bottom.unshift(`${x},${by + h}`);
  }
  const outH = Math.max(1.2, r.T * bh);
  const mono = narrow ? { x0: 92, x1: 250, y0: by - 50, y1: by + 50 } : { x0: 100, x1: 250, y0: by - 46, y1: by + 46 };
  const det = narrow ? { x0: 590, x1: 790, y0: by - 58, y1: by + 58 } : { x0: 640, x1: 785, y0: by - 52, y1: by + 52 };
  const lamp = { x: 44, y: by, r: 18 * k };
  // Prismet sprer det hvite lyset; den valgte bølgelengden treffer spalten midt på
  const prism = { x: mono.x0 + 48, y: by };
  const fan = [410, 460, 500, 540, 580, 620, 680];
  const nearest = fan.reduce((p, q) => (Math.abs(q - nm) < Math.abs(p - nm) ? q : p));
  const pct = (v: number) => `${fmt(v * 100, v < 0.1 ? 1 : 0)} %`;
  const clip = 'kj8-mono-clip';
  return (
    <g>
      {/* Lampe og hvitt lys */}
      <circle cx={lamp.x} cy={lamp.y} r={lamp.r} fill={mixColor(KJEMI.ph[2]!, VIZ.surface, 0.5)} stroke={VIZ.bodyStrong} strokeWidth={2} />
      <path d={`M${lamp.x - 7 * k},${lamp.y + 4 * k} q${3.5 * k},${-12 * k} ${7 * k},0 q${3.5 * k},${12 * k} ${7 * k},0`} fill="none" stroke={VIZ.ink} strokeWidth={1.5} />
      {RAINBOW_LINES.map((w, i) => (
        <line key={w} x1={lamp.x + lamp.r} y1={by - 6 + i * 3} x2={prism.x - 16} y2={by - 6 + i * 3} stroke={spectrumColor(w)} strokeWidth={2} />
      ))}

      {/* Monokromator med prisme og spalte */}
      <rect x={mono.x0} y={mono.y0} width={mono.x1 - mono.x0} height={mono.y1 - mono.y0} rx={10} fill={VIZ.body} stroke={VIZ.bodyStrong} strokeWidth={2} />
      <clipPath id={clip}>
        <rect x={mono.x0} y={mono.y0 + 3} width={mono.x1 - mono.x0} height={mono.y1 - mono.y0 - 6} />
      </clipPath>
      <g clipPath={`url(#${clip})`}>
        {fan.map((w) => (
          <line key={w} x1={prism.x + 8} y1={by} x2={mono.x1 - 4} y2={by + (nm - w) * 0.32} stroke={spectrumColor(w)} strokeWidth={w === nearest ? 2.5 : 1.5} opacity={0.8} />
        ))}
      </g>
      <polygon points={`${prism.x - 16},${by + 20} ${prism.x + 16},${by + 20} ${prism.x},${by - 22}`} fill={KJEMI.glassFill} stroke={KJEMI.glass} strokeWidth={2} />
      <line x1={mono.x1} y1={mono.y0 + 6} x2={mono.x1} y2={by - 6} stroke={VIZ.ink} strokeWidth={4} />
      <line x1={mono.x1} y1={by + 6} x2={mono.x1} y2={mono.y1 - 6} stroke={VIZ.ink} strokeWidth={4} />

      {/* Lyset inn i kyvetten (I₀) */}
      <rect x={mono.x1} y={by - bh / 2} width={cx0 - mono.x1} height={bh} fill={light} opacity={0.9} />
      <Txt x={(mono.x1 + cx0) / 2} y={by - bh / 2 - 10} size={0.85} weight={700}>
        I<TSub>0</TSub>
      </Txt>

      {/* Kyvetten */}
      <rect x={cx0} y={cTop} width={cw} height={ch + 10} rx={4} fill={KJEMI.glassFill} stroke={KJEMI.glass} strokeWidth={2.5} />
      <rect x={cx0 + 3} y={cTop + 16} width={cw - 6} height={ch - 9} fill={liquid} />
      <line x1={cx0 + 3} y1={cTop + 16} x2={cx1 - 3} y2={cTop + 16} stroke={KJEMI.liquidLine} strokeWidth={2} />
      <polygon points={[...top, ...bottom].join(' ')} fill={light} opacity={0.92} />

      {/* Lyset ut (I) og detektoren */}
      <rect x={cx1} y={by - outH / 2} width={det.x0 - cx1} height={outH} fill={light} opacity={0.9} />
      {!narrow && (
        <Txt x={(cx1 + det.x0) / 2} y={by - Math.max(outH / 2, 4) - 10} size={0.85} weight={700}>
          I
        </Txt>
      )}
      <rect x={det.x0} y={det.y0} width={det.x1 - det.x0} height={det.y1 - det.y0} rx={10} fill={VIZ.surface} stroke={VIZ.bodyStrong} strokeWidth={2} />
      <Txt x={(det.x0 + det.x1) / 2} y={by - 6 * f} size={0.95} weight={700} halo={false}>
        A = {fmt(r.A, 2)}
      </Txt>
      <Txt x={(det.x0 + det.x1) / 2} y={by + 24 * f} size={0.8} muted halo={false}>
        T = I/I<TSub>0</TSub> = {pct(r.T)}
      </Txt>

      {/* Navn over og under delene */}
      <Txt x={(mono.x0 + mono.x1) / 2} y={labelTop} size={0.8} weight={700}>
        λ = {nm} nm
      </Txt>
      <Txt x={cx} y={labelTop} size={0.8} muted>
        l = {fmt(l, 1)} cm
      </Txt>
      <line x1={cx0} y1={cTop - 10} x2={cx1} y2={cTop - 10} stroke={VIZ.muted} strokeWidth={1.5} />
      <line x1={cx0} y1={cTop - 16} x2={cx0} y2={cTop - 4} stroke={VIZ.muted} strokeWidth={1.5} />
      <line x1={cx1} y1={cTop - 16} x2={cx1} y2={cTop - 4} stroke={VIZ.muted} strokeWidth={1.5} />
      {!narrow && (
        <Txt x={lamp.x} y={labelBottom} size={0.8} muted>
          lampe
        </Txt>
      )}
      <Txt x={(mono.x0 + mono.x1) / 2} y={labelBottom} size={0.8} muted>
        monokromator
      </Txt>
      <Txt x={cx} y={labelBottom} size={0.8} muted>
        <TFormel f={a.formula} />
        (aq)
      </Txt>
      <Txt x={(det.x0 + det.x1) / 2} y={labelBottom} size={0.8} muted>
        detektor
      </Txt>
    </g>
  );
}

const RAINBOW_LINES = [680, 600, 560, 520, 470];

/* ---------- Figur 2: absorpsjonsspekteret ---------- */

function SpectrumPlot({ a, nm, c, l, H }: { a: Absorber; nm: number; c: number; l: number; H: number }) {
  const f = useTextScale();
  const gradId = `kj8-spekter-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const peak = absorptionMax(a).nm;
  const A = (w: number) => measuredAbsorbance(beerLambert(epsilon(a, w), l, c));
  const top = A(peak);
  const yMax = Math.min(2.5, Math.max(1, Math.ceil((top + 0.15) * 2) / 2));
  const pts: [number, number][] = [];
  for (let w = VIS_MIN; w <= VIS_MAX; w += 2) pts.push([w, A(w)]);
  return (
    <Plot
      x={{ min: VIS_MIN, max: VIS_MAX, label: 'Bølgelengde λ (nm)', ticks: f > 1.3 ? [400, 500, 600, 700] : [400, 450, 500, 550, 600, 650, 700, 750] }}
      y={{ min: 0, max: yMax, label: 'Absorbans A', decimals: 1 }}
      width={800}
      height={H}
    >
      {({ sx, sy, y0, y1, x0, x1 }) => {
        const stops: ReactNode[] = [];
        for (let w = VIS_MIN; w <= VIS_MAX; w += 10)
          stops.push(<stop key={w} offset={`${((w - VIS_MIN) / (VIS_MAX - VIS_MIN)) * 100}%`} style={{ stopColor: spectrumColor(w) }} />);
        const strips = (
          <g>
            <defs>
              <linearGradient id={gradId} x1="0" x2="1" y1="0" y2="0">
                {stops}
              </linearGradient>
            </defs>
            <rect x={x0} y={y1} width={x1 - x0} height={y0 - y1} fill={`url(#${gradId})`} opacity={0.13} />
            <rect x={x0} y={y0 + 2} width={x1 - x0} height={7} fill={`url(#${gradId})`} />
          </g>
        );
        const Anow = A(nm);
        const labelRight = sx(nm) < 560;
        return (
          <g>
            {strips}
            <path d={`${linePath(pts, sx, sy)} L${sx(VIS_MAX)},${sy(0)} L${sx(VIS_MIN)},${sy(0)} Z`} fill={SOLUTION_COLOR[a.id]} opacity={0.18} />
            <path d={linePath(pts, sx, sy)} fill="none" stroke={VIZ.series[1]} strokeWidth={3} />
            {/* λ_maks */}
            <line x1={sx(peak)} y1={sy(top)} x2={sx(peak)} y2={y1} stroke={VIZ.muted} strokeWidth={1.2} strokeDasharray="3 4" />
            {/* Valgt bølgelengde */}
            <line x1={sx(nm)} y1={y0} x2={sx(nm)} y2={y1} stroke={spectrumColor(nm)} strokeWidth={4} opacity={0.85} />
            <Dot x={sx(nm)} y={sy(Anow)} color={VIZ.ink} />
            <Txt x={labelRight ? sx(nm) + 12 : sx(nm) - 12} y={y1 + 20 * f} anchor={labelRight ? 'start' : 'end'} size={0.85} weight={700}>
              λ = {nm} nm ({colorWord(nm)})
            </Txt>
            <Txt x={labelRight ? sx(nm) + 12 : sx(nm) - 12} y={y1 + 42 * f} anchor={labelRight ? 'start' : 'end'} size={0.8} muted>
              A = {fmt(Anow, 2)}
            </Txt>
            {Math.abs(nm - peak) > 25 && (
              <Txt x={sx(peak)} y={y0 - 12} size={0.8} muted>
                λ<TSub>maks</TSub> = {fmt(peak, 0)} nm
              </Txt>
            )}
          </g>
        );
      }}
    </Plot>
  );
}

/* ---------- Figur 3: standardkurven ---------- */

function CurvePlot({
  a,
  nm,
  l,
  c,
  standards,
  curve,
  r,
  H,
}: {
  a: Absorber;
  nm: number;
  l: number;
  c: number;
  standards: Measurement[];
  curve: StandardCurve;
  r: SampleReading;
  H: number;
}) {
  const f = useTextScale();
  const cMax = a.cMax * MM;
  const eps = epsilon(a, nm);
  const real: [number, number][] = [];
  for (let i = 0; i <= 160; i++) {
    const cc = (cMax * i) / 160;
    const A = measuredAbsorbance(beerLambert(eps, l, cc / MM));
    real.push([cc, A]);
  }
  // Aksen tilpasses i steg på 0,5, så punktene ikke klemmes mot bunnen når absorbansen er liten
  const yMax = [0.5, 1, 1.5, 2, 2.5].find((v) => v >= Math.max(curve.maxA * 1.12, r.A * 1.08, 0.3)) ?? 2.5;
  const lastStd = Math.max(...a.standards) * MM;
  const k = curve.slope / MM;
  const lineEnd = Math.min(cMax, yMax / Math.max(k, 1e-12));
  const found = r.cFound * MM;
  const canRead = r.status !== 'ingen-absorpsjon' && Number.isFinite(found);
  const decimals = cMax >= 10 ? 0 : cMax >= 0.9 ? 1 : 2;
  return (
    <Plot x={{ min: 0, max: cMax, label: 'Konsentrasjon c (mmol/L)', decimals }} y={{ min: 0, max: yMax, label: 'Absorbans A', decimals: 1 }} width={800} height={H}>
      {({ sx, sy, x0, y0, x1 }) => {
        const yA = sy(Math.min(yMax, r.A));
        const xF = sx(Math.min(cMax, found));
        const outside = r.status === 'over';
        // Etiketten til prøven: over og til venstre for punktet (mellom aksen og linja), ellers under til høyre,
        // eller over til høyre når punktet ligger helt nede ved aksen.
        const labelW = 20 * 0.56 * 17 * f * 0.85;
        const labelPos =
          xF - x0 > labelW + 20
            ? { x: xF - 12, y: yA - 12, anchor: 'end' as const }
            : y0 - yA > 34 * f
              ? { x: xF + 12, y: yA + 24 * f, anchor: 'start' as const }
              : { x: xF + 16, y: yA - 18 * f, anchor: 'start' as const };
        return (
          <g>
            {/* Området standardene dekker */}
            <rect x={x0} y={sy(curve.maxA)} width={sx(lastStd) - x0} height={y0 - sy(curve.maxA)} fill={VIZ.series[0]} opacity={0.07} />
            <path d={linePath(real.filter(([, A]) => A <= yMax), sx, sy)} fill="none" stroke={VIZ.muted} strokeWidth={2} strokeDasharray="6 5" />
            <line x1={sx(0)} y1={sy(0)} x2={sx(lastStd)} y2={sy(k * lastStd)} stroke={VIZ.series[0]} strokeWidth={3} />
            <line x1={sx(lastStd)} y1={sy(k * lastStd)} x2={sx(lineEnd)} y2={sy(k * lineEnd)} stroke={VIZ.series[0]} strokeWidth={2} strokeDasharray="2 5" />
            {standards.map((s) => (
              <circle key={s.c} cx={sx(s.c * MM)} cy={sy(s.A)} r={6} fill={VIZ.series[0]} stroke={VIZ.surface} strokeWidth={2} />
            ))}
            {sy(curve.maxA) + 30 * f < y0 ? (
              <Txt x={sx(lastStd) + 10} y={sy(curve.maxA) + 22 * f} anchor="start" size={0.78} muted>
                standardene
              </Txt>
            ) : (
              <Txt x={sx(lastStd) + 10} y={sy(curve.maxA) - 12} anchor="start" size={0.78} muted>
                standardene
              </Txt>
            )}
            {canRead && r.A > 0.003 && (
              <g>
                <line x1={x0} y1={yA} x2={xF} y2={yA} stroke={VIZ.series[1]} strokeWidth={2} strokeDasharray="5 4" />
                <line x1={xF} y1={yA} x2={xF} y2={y0} stroke={VIZ.series[1]} strokeWidth={2} strokeDasharray="5 4" />
                <circle cx={xF} cy={yA} r={6} fill={VIZ.series[1]} stroke={VIZ.surface} strokeWidth={2} />
                {/* Der prøven egentlig ligger (konsentrasjonen er ukjent i en ekte analyse) */}
                {outside && <circle cx={sx(c * MM)} cy={yA} r={6} fill="none" stroke={KJEMI.minus} strokeWidth={2.5} />}
                {/* Etiketten står over og til venstre for punktet (mellom aksen og linja), eller under til høyre når det er trangt */}
                <Txt
                  x={labelPos.x}
                  y={labelPos.y}
                  anchor={labelPos.anchor}
                  size={0.85}
                  weight={700}
                  color={outside ? KJEMI.minus : VIZ.series[1]}
                >
                  prøven: {fmtSig(found, 3)} mmol/L
                </Txt>
                {outside && (
                  <Txt x={x1 - 6} y={sy(yMax * 0.14)} anchor="end" size={0.8} weight={700} color={KJEMI.minus}>
                    Utenfor standardkurven: fortynn prøven
                  </Txt>
                )}
              </g>
            )}
            {!canRead && (
              <Txt x={(x0 + x1) / 2} y={sy(yMax * 0.6)} size={0.9} weight={700} color={KJEMI.minus}>
                <TFormel f={a.formula} /> absorberer nesten ikke ved {nm} nm
              </Txt>
            )}
            <Txt x={x0 + 10} y={sy(yMax) + 22 * f} anchor="start" size={0.8} muted>
              {curve.r2 > 0 ? `R² = ${fmt(curve.r2, 4)}` : ''}
            </Txt>
          </g>
        );
      }}
    </Plot>
  );
}

/* ---------- Forklaring ---------- */

function explanation(a: Absorber, nm: number, c: number, l: number, r: SampleReading, sens: number): ReactNode {
  const peak = absorptionMax(a).nm;
  const eps = epsilon(a, nm);
  const rel = eps / a.epsMax;
  const ion = <Formel f={a.formula} />;
  const absorbed = colorWordNeuter(peak);
  const atPeak = Math.abs(nm - peak) <= 3;
  const lambdaText =
    r.status === 'ingen-absorpsjon' ? (
      <>
        Ved {nm} nm ({colorWordNeuter(nm)} lys) absorberer {ion} nesten ingenting, så alle standardene gir A ≈ 0 og konsentrasjonen kan ikke bestemmes. Velg en
        bølgelengde der løsningen absorberer, helst ved maksimum ({fmt(peak, 0)} nm).
      </>
    ) : atPeak ? (
      <>
        Du måler ved absorpsjonsmaksimum (λ<sub>maks</sub> ≈ {fmt(peak, 0)} nm). Der er ε størst, så standardkurven blir brattest og målingen mest følsom, og kurven
        er flat på toppen: står bølgelengden 2 nm feil, endres ε {sens < 0.001 ? 'nesten ikke (under 0,1 %)' : `bare ${fmt(sens * 100, 1)} %`}.
      </>
    ) : (
      <>
        Ved {nm} nm er ε bare {fmt(rel * 100, 0)} % av verdien ved maksimum ({fmt(peak, 0)} nm), så standardkurven blir slakere og målingen mindre følsom.
        {sens > 0.01 && Number.isFinite(sens) && <> Her er spekteret bratt: 2 nm feil i bølgelengden endrer ε med {fmt(sens * 100, 0)} %.</>} Derfor måler vi ved
        absorpsjonsmaksimum.
      </>
    );
  const readText =
    r.status === 'over' ? (
      <>
        <strong>Prøven er for sterk.</strong> A = {fmt(r.A, 2)} er høyere enn den sterkeste standarden. Ved høye konsentrasjoner bøyer kurven av: litt strølys
        når alltid detektoren, og partiklene påvirker hverandre. Avlest konsentrasjon blir derfor for lav ({fmtSig(r.cFound * MM, 3)} mmol/L, mens prøven egentlig
        har {fmtSig(c * MM, 3)} mmol/L). Fortynn prøven så A havner mellom 0,1 og 1, og gang svaret med fortynningsfaktoren.
      </>
    ) : r.status === 'for-svak' ? (
      <>
        Absorbansen er svært liten (A = {fmt(r.A, 3)}), så små målefeil gir stor relativ feil i konsentrasjonen. Bruk en lengre kyvette eller mål ved
        absorpsjonsmaksimum.
      </>
    ) : r.status === 'ingen-absorpsjon' ? null : c === 0 ? (
      <>Prøven er rent løsemiddel (blindprøve), så A = 0. Fotometeret nullstilles med blindprøven før standardene måles.</>
    ) : (
      <>
        Prøven ligger innenfor standardene, så du kan lese av standardkurven: c = A/k = {fmtSig(r.cFound * MM, 3)} mmol/L (prøven har egentlig{' '}
        {fmtSig(c * MM, 3)} mmol/L; forskjellen skyldes litt målestøy i standardene).
      </>
    );
  return (
    <>
      <p>
        <strong>
          {capital(a.name)} ser {a.seen} ut fordi {ion} absorberer {absorbed} lys.
        </strong>{' '}
        Lyset som slipper gjennom, gir fargen vi ser. Beer–Lamberts lov sier at absorbansen er proporsjonal med både konsentrasjonen og lengden lyset går
        gjennom løsningen: A = ε · l · c. Dobler du l (nå {fmt(l, 1)} cm) eller c, dobles A, mens transmittansen T = 10<sup>−A</sup> faller som en eksponentialfunksjon.
      </p>
      <p>{lambdaText}</p>
      {readText && <p>{readText}</p>}
    </>
  );
}

const capital = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
