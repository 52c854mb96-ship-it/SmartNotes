import { useState, type ReactNode } from 'react';
import {
  Arrow,
  BIO,
  Controls,
  Explain,
  Figure,
  Forvalg,
  Formula,
  FormulaLine,
  Legend,
  Plot,
  Readout,
  Readouts,
  Segmented,
  Slider,
  Sup,
  Toolbar,
  Txt,
  VIZ,
  VizLayout,
  fmt,
  fmtCount,
  fmtPct,
  fmtSig,
  blobPath,
  mixColor,
  placeParticles,
  roundedRectPath,
  seededRandom,
  useContainerTextScale,
  useSvgId,
  useTextScale,
} from '../kit';
import {
  D_O2,
  GUT,
  LUNG,
  OUTGROWTHS,
  ROOT_AREA,
  SIZE_REFERENCES,
  SIZE_STEPS,
  alveoliCount,
  compareArea,
  diffusionTime,
  formatArea,
  formatDuration,
  formatLength,
  formatVolume,
  gutArea,
  lungArea,
  lungAreaTwoSacs,
  maxSize,
  o2Profile,
  outgrowthFactor,
  splitCube,
  surfaceArea,
  surfaceToVolume,
  volume,
  type O2Profile,
  type Shape,
} from './model';

type Mode = 'celle' | 'deling' | 'flater';

const MODES: { value: Mode; label: string }[] = [
  { value: 'celle', label: 'Én celle' },
  { value: 'deling', label: 'Del opp' },
  { value: 'flater', label: 'Store overflater' },
];

/** Overflate og volum har faste farger: overflate (membranen) og volum (cytoplasma). */
const C_AREA = BIO.membran;
const C_RATIO = BIO.serie[0];
/** Oksygen: rødt som oksygenrikt blod; uten O₂: grått. */
const C_O2 = BIO.oksygenrikt;

export default function OverflateOgVolum() {
  const [mode, setMode] = useState<Mode>('celle');
  return (
    <VizLayout>
      <Toolbar>
        <Segmented label="Velg del" options={MODES} value={mode} onChange={setMode} />
      </Toolbar>
      {mode === 'celle' ? <EnCelle /> : mode === 'deling' ? <DelOpp /> : <StoreOverflater />}
    </VizLayout>
  );
}

/* ====================================================================== */
/* Felles tegning: kube og kule                                             */
/* ====================================================================== */

const C30 = Math.cos(Math.PI / 6);

/** Isometrisk projeksjon av et punkt (u, v, w) ∈ [0, 1]³ i en kube med side L sentrert i (cx, cy). */
function iso(cx: number, cy: number, L: number, u: number, v: number, w: number): string {
  return `${(cx + (u - v) * C30 * L).toFixed(2)},${(cy + (u + v) * 0.5 * L - w * L).toFixed(2)}`;
}

/** De tre synlige sidene av en boks [u0, u1] × [v0, v1] × [w0, w1] i en kube med side L. */
function IsoBox({ cx, cy, L, u0, u1, v0, v1, w0, w1, lw = 1.6 }: { cx: number; cy: number; L: number; u0: number; u1: number; v0: number; v1: number; w0: number; w1: number; lw?: number }) {
  const p = (u: number, v: number, w: number) => iso(cx, cy, L, u, v, w);
  const top = `${p(u0, v0, w1)} ${p(u1, v0, w1)} ${p(u1, v1, w1)} ${p(u0, v1, w1)}`;
  const left = `${p(u0, v1, w0)} ${p(u1, v1, w0)} ${p(u1, v1, w1)} ${p(u0, v1, w1)}`;
  const right = `${p(u1, v0, w0)} ${p(u1, v1, w0)} ${p(u1, v1, w1)} ${p(u1, v0, w1)}`;
  const face = { stroke: C_AREA, strokeWidth: lw, strokeLinejoin: 'round' as const };
  return (
    <g>
      <polygon points={top} fill={BIO.cytoplasma} {...face} />
      <polygon points={left} fill={mixColor(BIO.cytoplasma, C_AREA, 0.14)} {...face} />
      <polygon points={right} fill={mixColor(BIO.cytoplasma, C_AREA, 0.28)} {...face} />
    </g>
  );
}

/** Kule med skygge (radial gradient), sentrert i (cx, cy). */
function Ball({ cx, cy, r }: { cx: number; cy: number; r: number }) {
  const id = useSvgId('ball');
  return (
    <g>
      <defs>
        <radialGradient id={id} cx="38%" cy="34%" r="70%">
          <stop offset="0%" style={{ stopColor: BIO.cytoplasma }} />
          <stop offset="100%" style={{ stopColor: mixColor(BIO.cytoplasma, C_AREA, 0.35) }} />
        </radialGradient>
      </defs>
      <circle cx={cx} cy={cy} r={r} fill={`url(#${id})`} stroke={C_AREA} strokeWidth={2} />
      <ellipse cx={cx} cy={cy} rx={r} ry={r * 0.28} fill="none" stroke={C_AREA} strokeWidth={1.2} strokeDasharray="5 5" opacity={0.6} />
    </g>
  );
}

/* ====================================================================== */
/* Én celle                                                                 */
/* ====================================================================== */

const SHAPES: { value: Shape; label: string }[] = [
  { value: 'kube', label: 'Kube' },
  { value: 'kule', label: 'Kule' },
];

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** A/V med passende antall siffer: 6 → «6,0», 0,3 → «0,30», 0,003 → «0,0030». */
function fmtRatio(v: number): string {
  return fmtSig(v, 2);
}

function EnCelle() {
  const [shape, setShape] = useState<Shape>('kube');
  const [idx, setIdx] = useState(SIZE_STEPS.indexOf(20));
  const [ref, f] = useContainerTextScale<HTMLDivElement>();
  const d = SIZE_STEPS[idx] ?? 20;
  const A = surfaceArea(shape, d);
  const V = volume(shape, d);
  const ratio = surfaceToVolume(shape, d);
  const tC = diffusionTime(d / 2);
  const prof = o2Profile(shape, d);
  const dMax = maxSize(shape);
  const preset = SIZE_REFERENCES.find((r) => r.d === d)?.navn ?? null;
  const plotH = Math.round(320 + 260 * (f - 1));
  const word = shape === 'kube' ? 'side' : 'diameter';

  return (
    <>
      <Controls>
        <Slider
          label={`Størrelse (${word} d)`}
          value={idx}
          onChange={setIdx}
          min={0}
          max={SIZE_STEPS.length - 1}
          step={1}
          format={(i) => formatLength(SIZE_STEPS[i] ?? 20)}
        />
      </Controls>
      <Toolbar>
        <Segmented label="Velg form" options={SHAPES} value={shape} onChange={setShape} />
        <Forvalg
          label="Eksempel"
          options={SIZE_REFERENCES.map((r) => ({ value: r.navn, label: capitalize(r.navn), detail: formatLength(r.d) }))}
          value={preset}
          onPick={(navn) => {
            const r = SIZE_REFERENCES.find((x) => x.navn === navn);
            if (r) setIdx(Math.max(0, SIZE_STEPS.indexOf(r.d)));
          }}
        />
      </Toolbar>

      <div ref={ref}>
        <CellScene shape={shape} d={d} A={A} V={V} prof={prof} f={f} />
      </div>
      <Legend
        items={[
          { color: C_O2, label: 'Mye O₂ (tilføres gjennom overflaten)' },
          { color: BIO.dod, label: 'Ingen O₂' },
        ]}
      />

      <Figure
        viewBox={`0 0 800 ${plotH}`}
        label={`Forholdet mellom overflate og volum mot størrelsen, logaritmiske akser. Nå: d = ${formatLength(d)}, A/V = ${fmtRatio(ratio)} per µm.`}
        caption="Begge aksene er logaritmiske: hvert rutenettsteg er 10 ganger større enn det forrige."
      >
        <RatioPlot d={d} dMax={dMax} height={plotH} />
      </Figure>
      <Legend
        items={[
          { color: C_RATIO, label: 'A/V = 6/d (lik for kube og kule)' },
          { color: BIO.dod, label: 'Midten får ikke O₂ (aktiv celle)' },
        ]}
      />

      <Readouts>
        <Readout label="Overflate A" value={formatArea(A)} tone={C_AREA} />
        <Readout label="Volum V" value={formatVolume(V)} />
        <Readout label="A/V" value={fmtRatio(ratio)} unit="per µm" tone={C_RATIO} />
        <Readout label="Diffusjonstid til midten" value={formatDuration(tC)} />
      </Readouts>

      <Formula label="Overflate, volum og diffusjonstid">
        {shape === 'kube' ? (
          <FormulaLine>
            A = 6d<Sup>2</Sup> = 6 · {fmtLen(d)}<Sup>2</Sup> = {formatArea(A)} · V = d<Sup>3</Sup> = {formatVolume(V)} · A/V = 6/d ={' '}
            {fmtRatio(ratio)} per µm
          </FormulaLine>
        ) : (
          <FormulaLine>
            A = πd<Sup>2</Sup> = {formatArea(A)} · V = πd<Sup>3</Sup>/6 = {formatVolume(V)} · A/V = 6/d = {fmtRatio(ratio)} per µm
          </FormulaLine>
        )}
        <FormulaLine>
          Til midten: x = d/2 = {fmtLen(d / 2)} µm, t ≈ x<Sup>2</Sup>/(2D) = ({fmtLen(d / 2)} µm)<Sup>2</Sup> / (2 · {fmt(D_O2, 0)} µm
          <Sup>2</Sup>/s) = {formatDuration(tC)}
        </FormulaLine>
        <FormulaLine>Dobbel d: A · 4, V · 8, A/V · ½ og diffusjonstida · 4</FormulaLine>
      </Formula>

      <Explain>{cellText(d, ratio, tC, prof, dMax)}</Explain>
    </>
  );
}

/** Tall i µm uten enhet, med desimal bare for små verdier. */
function fmtLen(um: number): string {
  return fmt(um, um < 10 && um % 1 !== 0 ? 1 : 0);
}

function CellScene({ shape, d, A, V, prof, f }: { shape: Shape; d: number; A: number; V: number; prof: O2Profile; f: number }) {
  const narrow = f > 1.3;
  const k = Math.max(1, f * 0.85);
  const W = narrow ? 760 : 370;
  const titleH = 24 * f + 12;
  const PH = Math.round(narrow ? 400 : 270);
  const infoH = 30 * f + 26 * f;
  const block = titleH + PH + infoH;
  const panels = [
    { x: 20, y: 0, title: shape === 'kube' ? 'Kubeformet celle' : 'Kuleformet celle' },
    { x: narrow ? 20 : 410, y: narrow ? block + 14 : 0, title: 'Tverrsnitt: O₂ inne i cellen' },
  ];
  const H = Math.round(narrow ? 2 * block + 14 : block);
  // Cellen tegnes like stor uansett d (målestokken står i etiketten)
  const cx = panels[0]!.x + W / 2;
  const cy = panels[0]!.y + titleH + PH / 2;
  const S = Math.min(PH * (narrow ? 0.42 : 0.36), W * 0.24);
  const sx = panels[1]!.x + W / 2;
  const sy = panels[1]!.y + titleH + PH / 2;
  const SR = Math.min(PH * 0.36, W * 0.3);
  const N = 30;
  const rings: ReactNode[] = [];
  for (let i = N; i >= 1; i--) {
    const u = i / N;
    const c = prof.at(u - 0.5 / N);
    const fill = mixColor(BIO.cytoplasma, C_O2, 0.05 + 0.42 * c);
    rings.push(
      shape === 'kule' ? (
        <circle key={i} cx={sx} cy={sy} r={SR * u} fill={fill} />
      ) : (
        <path key={i} d={roundedRectPath(sx - SR * u, sy - SR * u, 2 * SR * u, 2 * SR * u, SR * u * 0.12)} fill={fill} />
      ),
    );
  }
  const core = prof.anoxic * SR;
  const nearest = SIZE_REFERENCES.reduce((a, b) => (Math.abs(Math.log(b.d / d)) < Math.abs(Math.log(a.d / d)) ? b : a));
  const centreText = prof.centre > 0 ? `O₂ i midten: ${fmtPct(prof.centre)}` : `Uten O₂: ${fmtPct(prof.anoxicVolume)} av volumet`;
  const arrowL = 30 * Math.min(1.4, k);
  return (
    <Figure
      viewBox={`0 0 800 ${H}`}
      maxHeight={narrow ? 1400 : H}
      label={`${panels[0]!.title} med d = ${formatLength(d)}. ${centreText}.`}
      caption="Cellen er tegnet like stor uansett d. O₂-profilen gjelder en aktiv celle med fast O₂-forbruk."
    >
      {panels.map((p) => (
        <Txt key={p.title} x={p.x + 8} y={p.y + 24 * f} anchor="start" weight={650} size={0.95}>
          {p.title}
        </Txt>
      ))}

      {/* Cellen i 3D */}
      {shape === 'kube' ? (
        <g>
          <IsoBox cx={cx} cy={cy} L={S} u0={0} u1={1} v0={0} v1={1} w0={0} w1={1} lw={2} />
          {/* Målestrek langs kanten nede til venstre */}
          {(() => {
            const a = iso(cx, cy, S, 0, 1, 0).split(',').map(Number);
            const b = iso(cx, cy, S, 1, 1, 0).split(',').map(Number);
            const off = 14;
            const ax = a[0]! - off * 0.5;
            const ay = a[1]! + off * C30;
            const bx = b[0]! - off * 0.5;
            const by = b[1]! + off * C30;
            return (
              <g>
                <line x1={ax} y1={ay} x2={bx} y2={by} stroke={VIZ.ink} strokeWidth={1.6} />
                <line x1={ax + 4} y1={ay - 7} x2={ax - 4} y2={ay + 7} stroke={VIZ.ink} strokeWidth={1.6} />
                <line x1={bx + 4} y1={by - 7} x2={bx - 4} y2={by + 7} stroke={VIZ.ink} strokeWidth={1.6} />
                <Txt x={(ax + bx) / 2 - 12 * f} y={(ay + by) / 2 + 24 * f} anchor="end" weight={700}>
                  d = {formatLength(d)}
                </Txt>
              </g>
            );
          })()}
        </g>
      ) : (
        <g>
          <Ball cx={cx} cy={cy} r={S * 0.95} />
          <line x1={cx - S * 0.95} x2={cx + S * 0.95} y1={cy + S * 0.95 + 16} y2={cy + S * 0.95 + 16} stroke={VIZ.ink} strokeWidth={1.6} />
          <line x1={cx - S * 0.95} x2={cx - S * 0.95} y1={cy + S * 0.95 + 9} y2={cy + S * 0.95 + 23} stroke={VIZ.ink} strokeWidth={1.6} />
          <line x1={cx + S * 0.95} x2={cx + S * 0.95} y1={cy + S * 0.95 + 9} y2={cy + S * 0.95 + 23} stroke={VIZ.ink} strokeWidth={1.6} />
          <Txt x={cx} y={cy + S * 0.95 + 16 + 24 * f} weight={700}>
            d = {formatLength(d)}
          </Txt>
        </g>
      )}
      <Txt x={cx} y={panels[0]!.y + titleH + PH + 26 * f} size={0.85} color={C_AREA} weight={650}>
        A = {formatArea(A)} · V = {formatVolume(V)}
      </Txt>
      <Txt x={cx} y={panels[0]!.y + titleH + PH + 52 * f} size={0.8} muted>
        {Math.abs(Math.log(nearest.d / d)) < 0.3 ? `Omtrent som: ${nearest.navn}` : neighbours(d)}
      </Txt>

      {/* Tverrsnitt med O₂ */}
      {rings}
      {core > 0.5 && (
        <g>
          {shape === 'kule' ? (
            <circle cx={sx} cy={sy} r={core} fill={BIO.dod} opacity={0.55} />
          ) : (
            <path d={roundedRectPath(sx - core, sy - core, 2 * core, 2 * core, core * 0.12)} fill={BIO.dod} opacity={0.55} />
          )}
        </g>
      )}
      {shape === 'kule' ? (
        <circle cx={sx} cy={sy} r={SR} fill="none" stroke={C_AREA} strokeWidth={2.5} />
      ) : (
        <path d={roundedRectPath(sx - SR, sy - SR, 2 * SR, 2 * SR, SR * 0.12)} fill="none" stroke={C_AREA} strokeWidth={2.5} />
      )}
      {[0, 90, 180, 270].map((deg) => {
        const a = ((deg + 45) * Math.PI) / 180;
        const r0 = (shape === 'kule' ? SR : SR * 1.2) + 6;
        const x2 = sx + Math.cos(a) * r0;
        const y2 = sy + Math.sin(a) * r0;
        return (
          <Arrow key={deg} x1={x2 + Math.cos(a) * arrowL} y1={y2 + Math.sin(a) * arrowL} x2={x2} y2={y2} color={C_O2} width={2.5} head={9} />
        );
      })}
      {(() => {
        const a = (225 * Math.PI) / 180;
        const r0 = (shape === 'kule' ? SR : SR * 1.2) + 6 + arrowL;
        return (
          <Txt x={sx + Math.cos(a) * r0 - 4} y={sy + Math.sin(a) * r0 - 4} anchor="end" color={C_O2} weight={700} size={0.85}>
            O₂ inn
          </Txt>
        );
      })()}
      <Txt x={sx} y={sy + 6 * f} weight={700} size={0.9}>
        {prof.centre > 0 ? `${fmtPct(prof.centre)} O₂` : 'Ingen O₂'}
      </Txt>
      <Txt x={sx} y={panels[1]!.y + titleH + PH + 26 * f} size={0.85} weight={650}>
        {prof.centre > 0 ? `O₂ i midten: ${fmtPct(prof.centre)} av O₂ ved overflaten` : `Uten O₂: ${fmtPct(prof.anoxicVolume)} av volumet`}
      </Txt>
    </Figure>
  );
}

/** «Mellom bakterie og rødt blodlegeme» for en størrelse mellom to kjente, ellers «Mindre enn …»/«Større enn …». */
function neighbours(d: number): string {
  const sorted = [...SIZE_REFERENCES].sort((a, b) => a.d - b.d);
  const lower = [...sorted].reverse().find((r) => r.d <= d);
  const upper = sorted.find((r) => r.d >= d);
  if (!lower) return `Mindre enn en vanlig ${upper?.navn ?? 'bakterie'}`;
  if (!upper) return `Større enn et ${lower.navn}`;
  return `Mellom ${lower.navn} og ${upper.navn}`;
}

const LOG_MAX = Math.log10(3000);

function RatioPlot({ d, dMax, height }: { d: number; dMax: number; height: number }) {
  return (
    <Plot x={{ min: 0, max: LOG_MAX, label: 'Størrelse d', ticks: [] }} y={{ min: -3, max: 1, label: 'A/V (per µm)', ticks: [] }} width={800} height={height}>
      {({ sx, sy, x0, x1, y0, y1 }) => <RatioPlotBody d={d} dMax={dMax} sx={sx} sy={sy} x0={x0} x1={x1} y0={y0} y1={y1} />}
    </Plot>
  );
}

function RatioPlotBody({
  d,
  dMax,
  sx,
  sy,
  x0,
  x1,
  y0,
  y1,
}: {
  d: number;
  dMax: number;
  sx: (v: number) => number;
  sy: (v: number) => number;
  x0: number;
  x1: number;
  y0: number;
  y1: number;
}) {
  const f = useTextScale();
  const xTicks = [
    { v: 0, t: '1 µm' },
    { v: 1, t: '10 µm' },
    { v: 2, t: '100 µm' },
    { v: 3, t: '1 mm' },
  ];
  const yTicks = [-3, -2, -1, 0, 1];
  const minor: number[] = [];
  for (let e = 0; e < 4; e++) for (let m = 2; m <= 9; m++) if (e + Math.log10(m) <= LOG_MAX) minor.push(e + Math.log10(m));
  const ratioAt = (lx: number) => Math.log10(6) - lx;
  const xd = Math.log10(d);
  const xm = Math.log10(dMax);
  const narrow = f > 1.3;
  return (
    <g>
      {minor.map((v) => (
        <line key={`m${v}`} x1={sx(v)} x2={sx(v)} y1={y0} y2={y1} className="viz-gridline" opacity={0.45} />
      ))}
      {xTicks.map((t) => (
        <g key={t.v}>
          <line x1={sx(t.v)} x2={sx(t.v)} y1={y0} y2={y1} className="viz-gridline" />
          <text x={sx(t.v)} y={y0 + 22 * f} textAnchor={t.v === 0 ? 'start' : 'middle'} className="viz-tick">
            {t.t}
          </text>
        </g>
      ))}
      {yTicks.map((v) => (
        <g key={v}>
          <line x1={x0} x2={x1} y1={sy(v)} y2={sy(v)} className="viz-gridline" />
          <text x={x0 - 10} y={sy(v) + 5 * f} textAnchor="end" className="viz-tick">
            {fmt(10 ** v, Math.max(0, -v))}
          </text>
        </g>
      ))}
      {/* For stor: midten får ikke O₂ */}
      <rect x={sx(xm)} y={y1} width={Math.max(0, x1 - sx(xm))} height={y0 - y1} fill={BIO.dod} opacity={0.18} />
      <line x1={sx(xm)} x2={sx(xm)} y1={y0} y2={y1} stroke={BIO.dod} strokeWidth={1.5} strokeDasharray="5 4" />
      <Txt x={sx(xm) - 8} y={y1 + 22 * f} anchor="end" size={0.78} muted>
        {narrow ? 'For stor' : 'For stor: midten får ikke O₂'}
      </Txt>
      <path
        d={`M${sx(0)},${sy(ratioAt(0))} L${sx(LOG_MAX)},${sy(ratioAt(LOG_MAX))}`}
        fill="none"
        stroke={C_RATIO}
        strokeWidth={3}
      />
      {SIZE_REFERENCES.map((r, i) => {
        const lx = Math.log10(r.d);
        const px = sx(lx);
        const py = sy(ratioAt(lx));
        // Linja faller mot høyre: over til høyre er ledig; den siste står under til venstre (nær kanten)
        const last = i === SIZE_REFERENCES.length - 1;
        const show = !narrow || r.d === d;
        return (
          <g key={r.navn}>
            <circle cx={px} cy={py} r={4.5} fill={VIZ.surface} stroke={C_RATIO} strokeWidth={2} />
            {show && (
              <Txt x={last ? px - 8 : px + 8} y={last ? py + 22 * f : py - 10} anchor={last ? 'end' : 'start'} size={0.75} muted>
                {r.navn}
              </Txt>
            )}
          </g>
        );
      })}
      <line x1={sx(xd)} x2={sx(xd)} y1={y0} y2={sy(ratioAt(xd))} className="viz-guide" />
      <circle cx={sx(xd)} cy={sy(ratioAt(xd))} r={8} fill={C_RATIO} stroke={VIZ.surface} strokeWidth={2.5} />
    </g>
  );
}

function cellText(d: number, ratio: number, tC: number, prof: O2Profile, dMax: number): ReactNode {
  const why = (
    <p>
      Cellen trenger O₂ og næring i hele volumet, men alt må inn gjennom overflaten. Behovet øker med volumet (d<Sup>3</Sup>), mens
      tilførselen øker med overflaten (d<Sup>2</Sup>). Derfor blir forholdet A/V = 6/d mindre jo større cellen er, uansett om den er en kube
      eller en kule.
    </p>
  );
  const misconception = (
    <p>
      Store dyr har ikke større celler enn små dyr: en elefant og en mus har omtrent like store celler, elefanten har bare mange flere av
      dem.
    </p>
  );
  if (prof.centre <= 0)
    return (
      <>
        <p>
          <strong>For stor celle.</strong> Med d = {formatLength(d)} er A/V bare {fmtRatio(ratio)} per µm, og O₂ bruker ca.{' '}
          {formatDuration(tC)} på å diffundere inn til midten. Cellen bruker opp oksygenet før det kommer fram, så{' '}
          {fmtPct(prof.anoxicVolume)} av volumet er uten O₂. Grensen for en aktiv celle er ca. {formatLength(Math.round(dMax / 100) * 100)}.
        </p>
        {d >= 1000 && (
          <p>
            Noen eggceller er likevel så store (et froskeegg er ca. 1,5 mm), men det meste av egget er plomme, opplagsnæring som ikke bruker
            O₂. Organismer som er større enn noen millimeter, trenger derfor transportsystemer (blod, gjeller, lunger) som bringer O₂ nær hver
            celle.
          </p>
        )}
        {why}
      </>
    );
  if (d <= 3)
    return (
      <>
        <p>
          <strong>Svært liten celle, som en bakterie.</strong> A/V er {fmtRatio(ratio)} per µm, og O₂ når midten på {formatDuration(tC)}.
          Små celler kan ta opp og skille ut stoffer svært raskt i forhold til volumet, og det er en grunn til at bakterier kan dele seg så
          ofte.
        </p>
        {why}
      </>
    );
  if (d <= 100)
    return (
      <>
        <p>
          <strong>Vanlig cellestørrelse.</strong> Med d = {formatLength(d)} er A/V {fmtRatio(ratio)} per µm, og diffusjonen inn til midten
          tar bare ca. {formatDuration(tC)}. Midten får nesten like mye O₂ som overflaten ({fmtPct(prof.centre)}). Diffusjon er rask over
          korte avstander, men tida øker med kvadratet av avstanden: t ∝ x<Sup>2</Sup>.
        </p>
        {why}
        {misconception}
      </>
    );
  return (
    <>
      <p>
        <strong>Stor celle.</strong> Med d = {formatLength(d)} er A/V bare {fmtRatio(ratio)} per µm, og O₂ bruker ca. {formatDuration(tC)}{' '}
        inn til midten. Midten får {fmtPct(prof.centre)} av O₂-konsentrasjonen ved overflaten. Ved ca. {formatLength(Math.round(dMax / 100) * 100)} når ikke O₂
        midten lenger.
      </p>
      {why}
      {misconception}
    </>
  );
}

/* ====================================================================== */
/* Del opp                                                                  */
/* ====================================================================== */

/** Side i den store kuben (µm). */
const BIG = 60;
const MAX_SPLIT = 6;

function DelOpp() {
  const [n, setN] = useState(2);
  const [ref, f] = useContainerTextScale<HTMLDivElement>();
  const s = splitCube(BIG, n);
  const one = splitCube(BIG, 1);
  const plotH = Math.round(300 + 240 * (f - 1));
  return (
    <>
      <Controls>
        <Slider
          label="Del hver kant i"
          value={n}
          onChange={setN}
          min={1}
          max={MAX_SPLIT}
          step={1}
          format={(v) => `${v} (${fmtCount(v ** 3)} ${v === 1 ? 'celle' : 'celler'})`}
        />
      </Controls>
      <div ref={ref}>
        <SplitScene n={n} f={f} />
      </div>
      <Figure
        viewBox={`0 0 800 ${plotH}`}
        label={`Samlet overflate når kuben deles i ${n} langs hver kant: ${formatArea(s.area)}.`}
      >
        <Plot
          x={{ min: 0.4, max: MAX_SPLIT + 0.6, label: 'Antall deler langs hver kant', ticks: [1, 2, 3, 4, 5, 6] }}
          y={{ min: 0, max: 140, label: 'Samlet overflate (1000 µm²)', ticks: [0, 35, 70, 105, 140] }}
          width={800}
          height={plotH}
        >
          {({ sx, sy }) => (
            <g>
              {Array.from({ length: MAX_SPLIT }, (_, i) => i + 1).map((k) => {
                const v = splitCube(BIG, k).area / 1000;
                const on = k === n;
                const w = 46;
                return (
                  <g key={k}>
                    <rect
                      x={sx(k) - w / 2}
                      y={sy(v)}
                      width={w}
                      height={sy(0) - sy(v)}
                      rx={4}
                      fill={on ? C_AREA : mixColor(VIZ.surface, C_AREA, 0.25)}
                    />
                    {on && (
                      <Txt x={sx(k)} y={sy(v) - 10} weight={700} size={0.85} color={C_AREA}>
                        {fmt(v, 1)}
                      </Txt>
                    )}
                  </g>
                );
              })}
            </g>
          )}
        </Plot>
      </Figure>

      <Readouts>
        <Readout label="Antall celler" value={fmtCount(s.count)} />
        <Readout label="Side i hver celle" value={fmt(s.side, s.side % 1 ? 1 : 0)} unit="µm" />
        <Readout label="Samlet overflate" value={formatArea(s.area)} tone={C_AREA} />
        <Readout label="A/V" value={fmtRatio(s.ratio)} unit="per µm" tone={C_RATIO} />
      </Readouts>

      <Formula label="Samme volum, større overflate">
        <FormulaLine>
          {fmtCount(s.count)} kuber med side {fmt(s.side, s.side % 1 ? 1 : 0)} µm: A = {fmtCount(s.count)} · 6 · ({fmt(s.side, s.side % 1 ? 1 : 0)} µm)
          <Sup>2</Sup> = {formatArea(s.area)} = {n} · {formatArea(one.area)}
        </FormulaLine>
        <FormulaLine>Volumet er det samme hele tida: V = ({BIG} µm)<Sup>3</Sup> = {formatVolume(s.volume)}</FormulaLine>
      </Formula>

      <Explain>
        {n === 1 ? (
          <p>
            <strong>Én stor celle</strong> med side {BIG} µm har overflaten {formatArea(one.area)} og A/V = {fmtRatio(one.ratio)} per µm. Dra i
            glidebryteren for å dele den opp i mindre celler med samme volum til sammen.
          </p>
        ) : (
          <p>
            <strong>
              Delt i {fmtCount(s.count)} celler blir overflaten {n} ganger så stor
            </strong>{' '}
            ({formatArea(s.area)}), mens volumet er det samme. Hver gang en kant deles i to, får hver celle sin egen overflate mot omgivelsene,
            og A/V øker fra {fmtRatio(one.ratio)} til {fmtRatio(s.ratio)} per µm.
          </p>
        )}
        <p>
          Derfor deler cellene seg i stedet for å vokse seg store, og derfor er store organismer bygd av mange små celler. I kroppen ligger
          cellene tett, men hver celle er omgitt av vevsvæske, og blodet i kapillærene bringer O₂ og næring fram til noen få cellelag fra hver
          celle.
        </p>
      </Explain>
    </>
  );
}

function SplitScene({ n, f }: { n: number; f: number }) {
  const narrow = f > 1.3;
  // På mobil står tekstene over kuben, på PC ved siden av
  const textH = narrow ? 30 * f + 28 * f + 10 : 0;
  const cubeH = narrow ? 440 : 330;
  const H = Math.round(textH + cubeH);
  // Hele kuben (også trukket fra hverandre) er 2L høy
  const L = (cubeH - 36) / 2;
  const cx = 400;
  const cy = textH + cubeH / 2 + 4;
  const gapRatio = 0.35;
  const s = 1 / (n + (n - 1) * gapRatio);
  const step = s * (1 + gapRatio);
  const cubes: { a: number; b: number; c: number }[] = [];
  for (let a = 0; a < n; a++) for (let b = 0; b < n; b++) for (let c = 0; c < n; c++) cubes.push({ a, b, c });
  cubes.sort((p, q) => p.a + p.b + p.c - (q.a + q.b + q.c));
  return (
    <Figure
      viewBox={`0 0 800 ${H}`}
      maxHeight={narrow ? 900 : H}
      label={`En kube med side ${BIG} µm delt i ${n ** 3} like små kuber.`}
      caption={`Den store kuben har side ${BIG} µm. Bitene er trukket fra hverandre så du ser alle sidene.`}
    >
      {cubes.map(({ a, b, c }) => (
        <IsoBox
          key={`${a}${b}${c}`}
          cx={cx}
          cy={cy}
          L={L}
          u0={a * step}
          u1={a * step + s}
          v0={b * step}
          v1={b * step + s}
          w0={c * step}
          w1={c * step + s}
          lw={n > 4 ? 1 : 1.6}
        />
      ))}
      <Txt x={40} y={30 * f} anchor="start" weight={700}>
        {fmtCount(n ** 3)} {n === 1 ? 'celle' : 'celler'}
      </Txt>
      <Txt x={40} y={30 * f + 28 * f} anchor="start" size={0.85} color={C_AREA} weight={650}>
        A = {formatArea(splitCube(BIG, n).area)}
      </Txt>
      <Txt x={760} y={30 * f} anchor="end" size={0.85} muted>
        V = {formatVolume(BIG ** 3)}
      </Txt>
    </Figure>
  );
}

/* ====================================================================== */
/* Store overflater i kroppen                                               */
/* ====================================================================== */

type Organ = 'tarm' | 'rot' | 'lunge';

const ORGANS: { value: Organ; label: string }[] = [
  { value: 'tarm', label: 'Tarmtotter' },
  { value: 'rot', label: 'Rothår' },
  { value: 'lunge', label: 'Lungeblærer' },
];

const LUNG_STEPS: readonly number[] = [0.1, 0.15, 0.2, 0.25, 0.3, 0.4, 0.5, 0.7, 1, 1.5, 2, 3, 5, 7, 10, 20];

function StoreOverflater() {
  const [organ, setOrgan] = useState<Organ>('tarm');
  const [villiL, setVilliL] = useState<number>(OUTGROWTHS.tarmtotter.length);
  const [villiN, setVilliN] = useState<number>(OUTGROWTHS.tarmtotter.density);
  const [hairL, setHairL] = useState<number>(OUTGROWTHS.rothar.length);
  const [hairN, setHairN] = useState<number>(OUTGROWTHS.rothar.density);
  const [lungIdx, setLungIdx] = useState(LUNG_STEPS.indexOf(LUNG.alveolus));
  const [ref, f] = useContainerTextScale<HTMLDivElement>();
  const T = OUTGROWTHS.tarmtotter;
  const R = OUTGROWTHS.rothar;
  const dAlv = LUNG_STEPS[lungIdx] ?? LUNG.alveolus;

  let factor: number;
  let total: number;
  if (organ === 'tarm') {
    factor = outgrowthFactor(villiN, T.radius, villiL);
    total = gutArea(factor);
  } else if (organ === 'rot') {
    factor = outgrowthFactor(hairN, R.radius, hairL);
    total = ROOT_AREA * factor;
  } else {
    total = lungArea(dAlv);
    factor = total / lungAreaTwoSacs();
  }
  const cmp = compareArea(total);

  return (
    <>
      <Toolbar>
        <Segmented label="Velg organ" options={ORGANS} value={organ} onChange={setOrgan} />
      </Toolbar>
      <Controls>
        {organ === 'tarm' && (
          <>
            <Slider label="Lengde på tarmtottene" value={villiL} onChange={setVilliL} min={0} max={T.maxLength} step={0.05} unit="mm" decimals={2} />
            <Slider label="Tarmtotter per mm²" value={villiN} onChange={setVilliN} min={5} max={T.maxDensity} step={1} />
          </>
        )}
        {organ === 'rot' && (
          <>
            <Slider label="Lengde på rothårene" value={hairL} onChange={setHairL} min={0} max={R.maxLength} step={0.05} unit="mm" decimals={2} />
            <Slider label="Rothår per mm²" value={hairN} onChange={setHairN} min={0} max={R.maxDensity} step={10} />
          </>
        )}
        {organ === 'lunge' && (
          <Slider
            label="Diameter på lungeblærene"
            value={lungIdx}
            onChange={setLungIdx}
            min={0}
            max={LUNG_STEPS.length - 1}
            step={1}
            format={(i) => `${fmt(LUNG_STEPS[i] ?? 0.25, (LUNG_STEPS[i] ?? 0.25) < 1 ? 2 : 0)} mm`}
          />
        )}
      </Controls>

      <div ref={ref}>
        {organ === 'tarm' && <VilliScene L={villiL} n={villiN} f={f} />}
        {organ === 'rot' && <RootScene L={hairL} n={hairN} f={f} />}
        {organ === 'lunge' && <LungScene d={dAlv} f={f} />}
      </div>

      <Readouts>
        {organ === 'lunge' ? (
          <>
            <Readout label="Antall lungeblærer" value={fmtMillions(alveoliCount(dAlv))} />
            <Readout label="Samlet overflate" value={fmt(total, total < 10 ? 1 : 0)} unit="m²" tone={C_AREA} />
            <Readout label="Mot to store sekker" value={fmt(factor, factor < 10 ? 1 : 0)} unit="ganger så stor" />
          </>
        ) : (
          <>
            <Readout label={organ === 'tarm' ? 'Tarmtottene gjør flaten' : 'Rothårene gjør flaten'} value={fmt(factor, 1)} unit="ganger så stor" tone={C_AREA} />
            <Readout
              label={organ === 'tarm' ? 'Hele tynntarmen' : 'Én rugplante'}
              value={fmt(total, total < 10 ? 1 : 0)}
              unit="m²"
            />
            <Readout
              label={organ === 'tarm' ? 'Uten tarmtotter' : 'Uten rothår'}
              value={fmt(total / factor, total / factor < 10 ? 1 : 0)}
              unit="m²"
            />
          </>
        )}
      </Readouts>

      <Formula label="Utregning av overflaten">
        {organ === 'tarm' && (
          <>
            <FormulaLine>
              Hver tarmtott er en sylinder (diameter {fmt(2 * T.radius, 1)} mm): faktor = 1 + n · 2πrL = 1 + {villiN} · 2π · {fmt(T.radius, 2)} ·{' '}
              {fmt(villiL, 2)} = {fmt(factor, 2)}
            </FormulaLine>
            <FormulaLine>
              Tynntarmen: {fmt(Math.PI * GUT.diameter * GUT.length, 2)} m² (glatt rør) · {fmt(GUT.folds, 1)} (folder) · {fmt(factor, 1)} (tarmtotter) ·{' '}
              {GUT.microvilli} (mikrovilli) = {fmt(total, 0)} m²
            </FormulaLine>
          </>
        )}
        {organ === 'rot' && (
          <>
            <FormulaLine>
              Hvert rothår er en sylinder (diameter {fmt(2 * R.radius * 1000, 0)} µm): faktor = 1 + n · 2πrL = 1 + {hairN} · 2π · {fmt(R.radius, 3)} ·{' '}
              {fmt(hairL, 2)} = {fmt(factor, 2)}
            </FormulaLine>
            <FormulaLine>
              Én rugplante: {ROOT_AREA} m² røtter · {fmt(factor, 2)} = {fmt(total, 0)} m²
            </FormulaLine>
          </>
        )}
        {organ === 'lunge' && (
          <>
            <FormulaLine>
              Lungeblærene fyller halve lungevolumet (V = {LUNG.volume} L): A = 6 · 0,5 · V / d = 6 · 0,5 · {LUNG.volume} L / {fmt(dAlv, 2)} mm ={' '}
              {fmt(total, total < 10 ? 1 : 0)} m²
            </FormulaLine>
            <FormulaLine>To sekker på 3 L hver ville hatt ca. {fmt(lungAreaTwoSacs(), 1)} m² overflate.</FormulaLine>
          </>
        )}
        <FormulaLine>
          {fmt(total, total < 10 ? 1 : 0)} m² ≈ {fmt(cmp.ratio, cmp.ratio < 10 ? 1 : 0)} · {cmp.navn} ({fmt(cmp.ratio > 0 ? total / cmp.ratio : 0, cmp.navn === 'et A4-ark' ? 3 : 0)} m²)
        </FormulaLine>
      </Formula>

      <Explain>{organText(organ, factor, total, dAlv)}</Explain>
    </>
  );
}

function fmtMillions(n: number): string {
  if (n >= 1e9) return `${fmt(n / 1e9, 1)} milliarder`;
  if (n >= 1e6) return `${fmt(n / 1e6, n >= 1e8 ? 0 : 1)} millioner`;
  return fmtCount(n);
}

function organText(organ: Organ, factor: number, total: number, dAlv: number): ReactNode {
  const principle = (
    <p>
      Prinsippet er det samme som for cellene: utveksling skjer gjennom en overflate, og jo større overflaten er i forhold til volumet, jo mer
      kan tas opp per tid. Folder og utposninger gir stor overflate uten at organet blir stort.
    </p>
  );
  if (organ === 'tarm')
    return (
      <>
        <p>
          <strong>Tarmtottene gjør tarmveggen {fmt(factor, 1)} ganger så stor.</strong> Inne i hver tarmtott ligger kapillærer som tar
          opp næringsstoffene. Hver celle i tarmtotten har i tillegg mikrovilli, små utposninger av cellemembranen som gjør flaten ca.{' '}
          {GUT.microvilli} ganger større. Til sammen blir tynntarmen ca. {fmt(total, 0)} m² på innsiden.
        </p>
        {factor < 1.5 && <p>Uten tarmtotter ville tarmen måtte være mange ganger lengre for å ta opp like mye næring.</p>}
        {principle}
      </>
    );
  if (organ === 'rot')
    return (
      <>
        <p>
          <strong>Rothårene gjør roten {fmt(factor, 1)} ganger så stor.</strong> Hvert rothår er en utvekst av én enkelt celle i rotas
          overhud, bare ca. 0,01 mm tykt, og tar opp vann og mineraler fra jorda. En rugplante som Dittmer målte i 1937, hadde ca. 14
          milliarder rothår.
        </p>
        {principle}
      </>
    );
  return (
    <>
      <p>
        <strong>
          {alveoliCount(dAlv) > 1e6 ? `${fmtMillions(alveoliCount(dAlv))} lungeblærer` : 'Lungeblærene'} gir {fmt(total, total < 10 ? 1 : 0)} m²
        </strong>
        , {fmt(factor, 0)} ganger så mye som to store sekker med samme volum. Jo mindre blærene er, jo flere får plass og jo større blir
        overflaten (A = 6φV/d, samme 6/d som for én celle). Veggen mellom luft og blod er bare ca. 0,5 µm tykk, så O₂ diffunderer over på
        under ett sekund.
      </p>
      {dAlv > 1 && <p>Med så store blærer ville du ikke fått nok O₂, selv i hvile. Frosker har enklere lunger med færre, større blærer, men de tar også opp O₂ gjennom huden.</p>}
      {principle}
    </>
  );
}

/* ---------- Tegninger ---------- */

function VilliScene({ L, n, f }: { L: number; n: number; f: number }) {
  const narrow = f > 1.3;
  const k = narrow ? 230 : 170; // px per mm
  const base = (narrow ? 430 : 330) - 20;
  const H = Math.round(base + 22 + 30 * f);
  const top = base - 1.5 * k - 6;
  const spacing = (1 / Math.sqrt(Math.max(1, n))) * k;
  const w = Math.min(spacing * 0.86, 2 * OUTGROWTHS.tarmtotter.radius * k * (narrow ? 1.25 : 1));
  const count = Math.floor(720 / spacing);
  const x0 = 400 - ((count - 1) * spacing) / 2;
  const h = L * k;
  const tissue = BIO.er;
  const villi: ReactNode[] = [];
  for (let i = 0; i < count; i++) {
    const x = x0 + i * spacing;
    if (h < 2) continue;
    villi.push(
      <g key={i}>
        <path
          d={`M${x - w / 2},${base} V${base - h + w / 2} A${w / 2},${w / 2} 0 0 1 ${x + w / 2},${base - h + w / 2} V${base} Z`}
          fill={tissue.fill}
          stroke={tissue.line}
          strokeWidth={1.4}
        />
        {h > w && (
          <path
            d={`M${x - w * 0.18},${base} V${base - h + w * 0.7} A${w * 0.18},${w * 0.18} 0 0 1 ${x + w * 0.18},${base - h + w * 0.7} V${base}`}
            fill="none"
            stroke={BIO.oksygenrikt}
            strokeWidth={1.4}
            opacity={0.8}
          />
        )}
      </g>,
    );
  }
  return (
    <Figure
      viewBox={`0 0 800 ${H}`}
      maxHeight={H}
      label={`Tverrsnitt av tarmveggen med tarmtotter som er ${fmt(L, 2)} mm lange.`}
      caption="Tverrsnitt av tarmveggen i målestokk (mikrovilliene er for små til å synes). Røde streker: kapillærer."
    >
      <rect x={20} y={top} width={760} height={base - top} rx={10} fill={mixColor(VIZ.surface, BIO.sukker, 0.1)} />
      <Txt x={36} y={top + 26 * f} anchor="start" size={0.85} muted>
        Tarminnhold med næringsstoffer
      </Txt>
      {villi}
      <rect x={20} y={base} width={760} height={H - base - 6} rx={6} fill={tissue.fill} stroke={tissue.line} strokeWidth={1.4} />
      <line x1={20} x2={780} y1={base} y2={base} stroke={tissue.line} strokeWidth={2} strokeDasharray="7 5" opacity={0.7} />
      <Txt x={40} y={base + (H - 6 - base) / 2 + 6 * f} anchor="start" size={0.8} weight={650} halo={false}>
        Tarmvegg
      </Txt>
      {/* Målestokk 1 mm */}
      <g>
        <line x1={760 - k} x2={760} y1={top + 18} y2={top + 18} stroke={VIZ.ink} strokeWidth={2.5} />
        <Txt x={760 - k / 2} y={top + 18 + 22 * f} size={0.8}>
          1 mm
        </Txt>
      </g>
    </Figure>
  );
}

function RootScene({ L, n, f }: { L: number; n: number; f: number }) {
  const narrow = f > 1.3;
  const k = narrow ? 230 : 170;
  const rootH = 0.3 * k;
  const H = Math.round(1.5 * k + rootH + (narrow ? 70 : 50) + 30 * f);
  const rootY = H - rootH - 16;
  const spacing = (1 / Math.sqrt(Math.max(1, n))) * k;
  const count = n > 0 ? Math.floor(740 / Math.max(2.5, spacing * 0.5)) : 0;
  const rnd = seededRandom(17);
  const hairs: ReactNode[] = [];
  const h = L * k;
  for (let i = 0; i < count; i++) {
    const x = 30 + (i + 0.5) * (740 / count) + (rnd() - 0.5) * 3;
    const len = h * (0.75 + 0.5 * rnd());
    const bend = (rnd() - 0.5) * 18;
    if (len < 2) continue;
    hairs.push(
      <path key={i} d={`M${x},${rootY} q${bend},${-len / 2} ${bend * 0.4},${-len}`} fill="none" stroke={BIO.ved} strokeWidth={1.3} strokeLinecap="round" opacity={0.85} />,
    );
  }
  // Jordkorn med en tynn vannfilm, mellom og over rothårene
  const soilTop = 24 * f + 50;
  const grains = placeParticles({ x: 24, y: soilTop, w: 752, h: rootY - soilTop - 4 }, [{ n: 70, r: 13 }, { n: 40, r: 8 }], 5, 6).filter(
    (g) => !(g.x > 760 - k - 30 && g.y < soilTop + 10),
  );
  const soil = grains.map((g, i) => (
    <path
      key={i}
      d={blobPath(g.x, g.y, g.r, g.r * 0.78, 0.16, 11 + i, 8)}
      fill={mixColor(VIZ.surface, BIO.ved, 0.22)}
      stroke={BIO.vann}
      strokeWidth={1.4}
      opacity={0.85}
    />
  ));
  return (
    <Figure
      viewBox={`0 0 800 ${H}`}
      maxHeight={H}
      label={`Utsnitt av en rot med rothår som er ${fmt(L, 2)} mm lange, ${n} per mm².`}
      caption="Utsnitt av en rot med rothår, i målestokk. Jordpartiklene har en tynn vannfilm (blå) som rothårene tar opp vann fra."
    >
      <Txt x={36} y={24 * f} anchor="start" size={0.85} muted>
        Jord med vann og mineraler
      </Txt>
      {soil}
      {hairs}
      <rect x={20} y={rootY} width={760} height={rootH} rx={rootH / 2} fill={BIO.cellevegg.fill} stroke={BIO.ved} strokeWidth={1.8} />
      <Txt x={40} y={rootY + rootH / 2 + 6 * f} anchor="start" size={0.8} weight={650} halo={false}>
        Rot
      </Txt>
      <line x1={760 - k} x2={760} y1={24 * f + 12} y2={24 * f + 12} stroke={VIZ.ink} strokeWidth={2.5} />
      <Txt x={760 - k / 2} y={24 * f + 12 + 22 * f} size={0.8}>
        1 mm
      </Txt>
    </Figure>
  );
}

function LungScene({ d, f }: { d: number; f: number }) {
  const narrow = f > 1.3;
  const H = Math.round(narrow ? 480 : 350);
  const top = 30 * f + 18;
  // Fire grener med hver sin drueklase av lungeblærer
  const Rc = narrow ? 92 : 78;
  const clusterY = H - Rc - 14;
  const xs = [100, 300, 500, 700].map((x) => (narrow ? 400 + (x - 400) * 0.98 : x));
  const split1 = top + (clusterY - Rc - top) * 0.35;
  const split2 = top + (clusterY - Rc - top) * 0.75;
  // Ikke i målestokk: tegnet diameter vokser langsommere enn d, så både små og store blærer får plass
  const px = Math.min(2 * Rc, 9 * (d / 0.1) ** 0.55 * (narrow ? 1.2 : 1));
  const pts: { x: number; y: number }[] = [];
  if (px >= 1.6 * Rc) pts.push({ x: 0, y: 0 });
  else {
    const rows = Math.ceil(Rc / (px * 0.866)) + 1;
    for (let j = -rows; j <= rows; j++)
      for (let i = -rows - 1; i <= rows + 1; i++) {
        const x = (i + (Math.abs(j) % 2) * 0.5) * px;
        const y = j * px * 0.866;
        if (Math.hypot(x, y) <= Rc - px / 2) pts.push({ x, y });
      }
  }
  const r = pts.length === 1 ? Math.min(Rc, px / 2) : px / 2 - 1;
  const airway = VIZ.muted;
  const tube = (d0: string, w: number) => (
    <path d={d0} fill="none" stroke={airway} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" opacity={0.75} />
  );
  return (
    <Figure
      viewBox={`0 0 800 ${H}`}
      maxHeight={H}
      label={`Luftveier som ender i lungeblærer på ${fmt(d, 2)} mm. ${fmtMillions(alveoliCount(d))} blærer gir ${fmt(lungArea(d), 0)} m².`}
      caption="De minste luftveiene ender i klaser av lungeblærer. Ikke i målestokk: blærene er tegnet større jo større d er."
    >
      <Txt x={24} y={24 * f} anchor="start" size={0.85} weight={650}>
        Lungeblærer på {fmt(d, d < 1 ? 2 : 0)} mm
      </Txt>
      <Txt x={776} y={24 * f} anchor="end" size={0.85} muted>
        {fmtMillions(alveoliCount(d))} i lungene
      </Txt>
      {/* Luftveiene: bronkiole som deler seg to ganger */}
      {tube(`M400,${top} V${split1}`, 14)}
      {[0, 1].map((h) => {
        const mx = (xs[2 * h]! + xs[2 * h + 1]!) / 2;
        return (
          <g key={h}>
            {tube(`M400,${split1} Q${mx},${split1} ${mx},${split2}`, 10)}
            {[0, 1].map((k) => {
              const x = xs[2 * h + k]!;
              return <g key={k}>{tube(`M${mx},${split2} Q${x},${split2} ${x},${clusterY - Rc * 0.6}`, 6)}</g>;
            })}
          </g>
        );
      })}
      {xs.map((x, ci) => (
        <g key={ci}>
          <circle cx={x} cy={clusterY} r={Rc + 4} fill={mixColor(VIZ.surface, C_O2, 0.1)} />
          {pts.map((p, i) => (
            <circle key={i} cx={x + p.x} cy={clusterY + p.y} r={Math.max(1.5, r)} fill={mixColor(VIZ.surface, C_O2, 0.05)} stroke={C_O2} strokeWidth={1.3} />
          ))}
        </g>
      ))}
      <Txt x={420} y={top + 22 * f} anchor="start" size={0.8} muted>
        Luft inn og ut
      </Txt>
    </Figure>
  );
}
