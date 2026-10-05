import { useEffect, useState, type ReactNode } from 'react';
import {
  Arrow,
  BIO,
  Controls,
  Explain,
  Figure,
  Formula,
  FormulaLine,
  Legend,
  Membran,
  PlayBar,
  Plot,
  Readout,
  Readouts,
  Reseptor,
  Segmented,
  Slider,
  Toggle,
  Toolbar,
  Txt,
  VIZ,
  VizLayout,
  fmt,
  fmtCount,
  linePath,
  proteinSlot,
  sample,
  useContainerTextScale,
  useSimClock,
  useTextScale,
  type BioPaint,
} from '../kit';
import {
  CASCADES,
  amplification,
  cascadeAt,
  cascadeProgress,
  cascadeTotals,
  responseTime,
  type HormoneKind,
} from './model';

const KINDS: { value: HormoneKind; label: string }[] = [
  { value: 'vannloselig', label: 'Vannløselig hormon (adrenalin)' },
  { value: 'fettloselig', label: 'Fettløselig hormon (kortisol)' },
];

/** Sekunder en hel avspilling tar. */
const PLAY_SECONDS = 12;
const MAX_HORMONES = 10;

type IconKind = 'hormon' | 'gprotein' | 'camp' | 'kinase' | 'enzym' | 'glukose' | 'kompleks' | 'mrna' | 'protein';

/** Ikon og farge for hvert trinn i kjedene (samme rekkefølge som CASCADES). */
const ICONS: Record<HormoneKind, IconKind[]> = {
  vannloselig: ['hormon', 'gprotein', 'camp', 'kinase', 'enzym', 'glukose'],
  fettloselig: ['hormon', 'kompleks', 'mrna', 'protein'],
};

const ICON_COLOR: Record<IconKind, string> = {
  hormon: BIO.signal,
  gprotein: BIO.protein.line,
  camp: BIO.atp,
  kinase: BIO.kjerne.line,
  enzym: BIO.lysosom.line,
  glukose: BIO.sukker,
  kompleks: BIO.protein.line,
  mrna: BIO.dna,
  protein: BIO.mitokondrie.line,
};

/** Store tall med ord: 1e8 → «100 millioner», 1e9 → «1 milliard», 2,5e9 → «2,5 milliarder» (tre gjeldende siffer). */
function fmtBig(n: number): string {
  const r = Math.round(n) < 1000 ? Math.round(n) : Number(Math.round(n).toPrecision(3));
  const word = (v: number, one: string, many: string) => (v === 1 ? `1 ${one}` : `${fmt(v, v < 10 && v % 1 ? 1 : 0)} ${many}`);
  if (r >= 1e9) return word(r / 1e9, 'milliard', 'milliarder');
  if (r >= 1e6) return word(r / 1e6, 'million', 'millioner');
  return fmtCount(r);
}

/** Antall molekyler i radene: tre gjeldende siffer når tallet er stort (99 992 809 → «100 000 000»), ord over en milliard. */
function fmtMolecules(n: number): string {
  const r = Math.round(n);
  if (r >= 1e9 - 5e6) return fmtBig(r);
  return fmtCount(r < 1000 ? r : Number(r.toPrecision(3)));
}

function timeText(kind: HormoneKind, t: number): string {
  if (CASCADES[kind].unit === 's') return `${fmt(t, 1)} s`;
  return t < 60 ? `${fmt(t, 0)} min` : `${fmt(t / 60, 1)} timer`;
}

export default function Cellesignalering() {
  const [kind, setKind] = useState<HormoneKind>('vannloselig');
  const [hormones, setHormones] = useState(1);
  const [receptor, setReceptor] = useState(true);
  const cas = CASCADES[kind];
  const clock = useSimClock({ tMax: cas.tMax, speed: cas.tMax / PLAY_SECONDS });
  const { setT, pause } = clock;
  // Vis hele responsen når siden åpnes og når du bytter hormon (trykk «Spill av» for å se forløpet)
  useEffect(() => {
    pause();
    setT(CASCADES[kind].tMax);
  }, [kind, pause, setT]);
  const t = Math.min(clock.t, cas.tMax);
  const counts = cascadeAt(kind, hormones, t, receptor);
  const totals = cascadeTotals(kind, receptor ? hormones : 0);
  const last = cas.levels.length - 1;
  const [ref, f] = useContainerTextScale<HTMLDivElement>();
  const plotH = Math.round(320 + 260 * (f - 1));
  const tResp = responseTime(kind);
  const product = kind === 'vannloselig' ? 'Glukose frigjort' : 'Nye proteiner';

  return (
    <VizLayout>
      <Toolbar>
        <Segmented label="Velg hormontype" options={KINDS} value={kind} onChange={setKind} />
      </Toolbar>
      <Controls>
        <Slider label="Hormonmolekyler som binder seg" value={hormones} onChange={setHormones} min={1} max={MAX_HORMONES} step={1} />
        <Slider
          label="Tid"
          value={t}
          onChange={(v) => {
            pause();
            setT(v);
          }}
          min={0}
          max={cas.tMax}
          step={cas.unit === 's' ? 0.1 : 1}
          format={(v) => timeText(kind, v)}
        />
      </Controls>
      <Toolbar>
        <PlayBar clock={clock} time={timeText(kind, t)} />
        <Toggle label="Cellen har reseptor for hormonet" checked={receptor} onChange={setReceptor} />
      </Toolbar>

      <div ref={ref}>
        <SignalCell kind={kind} hormones={hormones} t={t} receptor={receptor} counts={counts} f={f} />
      </div>

      <Figure
        viewBox={`0 0 800 ${plotH}`}
        label={`Antall molekyler på hvert trinn over tid, logaritmisk akse. ${product}: ${fmtMolecules(counts[last] ?? 0)}.`}
        caption="Loddrett akse: logaritmisk, hvert steg er 100 ganger mer. Hvert trinn kommer litt etter det forrige."
      >
        <CascadePlot kind={kind} hormones={hormones} receptor={receptor} t={t} height={plotH} f={f} />
      </Figure>
      <Legend items={cas.levels.map((l, i) => ({ color: ICON_COLOR[ICONS[kind][i]!], label: l.kort }))} />

      <Readouts>
        <Readout label="Hormonmolekyler" value={String(hormones)} tone={BIO.signal} />
        <Readout label={product} value={fmtBig(counts[last] ?? 0)} tone={ICON_COLOR[ICONS[kind][last]!]} />
        <Readout label="Forsterkning" value={fmtBig(amplification(kind))} unit="ganger" />
        <Readout label="Nesten full respons etter" value={`ca. ${timeText(kind, tResp)}`} />
      </Readouts>

      <Formula label="Forsterkning i signalkjeden">
        <FormulaLine>
          Forsterkning: {cas.levels.map((l) => fmtCount(l.gain)).join(' · ')} = {fmtCount(amplification(kind))}
        </FormulaLine>
        <FormulaLine>
          {hormones} {hormones === 1 ? 'hormonmolekyl' : 'hormonmolekyler'} · {fmtCount(amplification(kind))} = {fmtCount(totals[last] ?? 0)}{' '}
          {kind === 'vannloselig' ? 'glukosemolekyler' : 'proteinmolekyler'}
          {receptor ? '' : ' (uten reseptor: 0)'}
        </FormulaLine>
      </Formula>

      <Explain>{signalText(kind, t, hormones, receptor, counts)}</Explain>
    </VizLayout>
  );
}

/* ---------- Målcellen med signalkjeden ---------- */

/** Antall ikoner som vises for et antall molekyler (logaritmisk, så forsterkningen synes). */
function iconCount(n: number): number {
  if (!(n >= 0.5)) return 0;
  return Math.max(1, Math.round(1 + 17 * (Math.log10(Math.max(1, n)) / 9)));
}

function SignalCell({
  kind,
  hormones,
  t,
  receptor,
  counts,
  f,
}: {
  kind: HormoneKind;
  hormones: number;
  t: number;
  receptor: boolean;
  counts: number[];
  f: number;
}) {
  const narrow = f > 1.3;
  const k = Math.max(1, f * 0.85);
  const cas = CASCADES[kind];
  const icons = ICONS[kind];
  const water = kind === 'vannloselig';
  const T = 40;
  // På mobil står overskriften på en egen linje under «Blod og vevsvæske»
  const bloodTop = narrow ? 56 * f + 8 : 30 * f + 8;
  const bloodH = narrow ? 110 : 80;
  const memY = bloodTop + bloodH + T / 2;
  // Radene under membranen (trinn 1, 2, …); for fettløselige hormoner også trinn 0 (reseptor i cytoplasmaet)
  const firstRow = water ? 1 : 0;
  const rowH = narrow ? 30 * f + 40 : 52;
  const rowsTop = memY + T / 2 + (narrow ? 14 : 12);
  const nRows = cas.levels.length - firstRow;
  const H = Math.round(rowsTop + nRows * rowH + 14);
  const iconX0 = narrow ? 40 : 270;
  const iconX1 = narrow ? 600 : 610;
  const countX = X1R;
  const rowY = (i: number) => rowsTop + (i - firstRow) * rowH;
  // Hormonene: ved reseptorene i membranen (vannløselig) eller på vei inn i cellen (fettløselig)
  const p0 = receptor ? cascadeProgress(kind, 0, t) : 0;
  // Reseptorene (og hormonene) fordeles på membranen; plass til ti uten at de overlapper
  const rx0 = narrow ? 230 : 300;
  const rx1 = narrow ? 690 : 700;
  const receptorXs = Array.from({ length: hormones }, (_, i) => rx0 + (i * (rx1 - rx0)) / Math.max(1, MAX_HORMONES - 1));
  const hormoneEls: ReactNode[] = [];
  const sz = 9 * k;
  receptorXs.forEach((x, i) => {
    const drift = Math.sin(t * 1.3 + i) * 6;
    const yFree = bloodTop + 26 + (i % 3) * 14;
    if (water) {
      // Vannløselig: fra blodet ned til reseptoren (sitter i reseptoren når p0 er stor)
      if (receptor && p0 > 0.6) return;
      const y = receptor ? yFree + (memY - T * 0.95 - yFree) * Math.min(1, p0 / 0.6) : yFree;
      hormoneEls.push(<Diamond key={i} x={x + (receptor ? 0 : drift)} y={y} s={sz} />);
    } else {
      // Fettløselig: gjennom membranen og inn i cytoplasmaet
      const yEnd = rowY(0) + rowH / 2 + (narrow ? 12 : 0);
      const travel = Math.min(1, cascadeProgress(kind, 0, t * 1.6) * 1.15);
      const y = yFree + (yEnd - yFree) * travel;
      if (receptor && p0 > 0.5) return;
      hormoneEls.push(<Diamond key={i} x={x + (receptor ? 0 : drift)} y={y} s={sz} />);
    }
  });
  const rows: ReactNode[] = [];
  for (let lvl = firstRow; lvl < cas.levels.length; lvl++) {
    const y = rowY(lvl);
    const level = cas.levels[lvl]!;
    const n = counts[lvl] ?? 0;
    const show = iconCount(n);
    const iconY = narrow ? y + 24 * f + 18 : y + rowH / 2;
    const step = (iconX1 - iconX0) / 18;
    const items: ReactNode[] = [];
    if (!water && lvl === 1) items.push(<DnaStrand key="dna" x0={iconX0 - 4} x1={iconX1} y={iconY + 2} k={k} />);
    if (!water && lvl === 0) {
      // Reseptorene i cytoplasmaet tegnes for seg (med hormonet bundet)
    } else for (let j = 0; j < show; j++) items.push(<Icon key={j} kind={icons[lvl]!} x={iconX0 + step * (j + 0.5)} y={iconY + (j % 2 ? 4 : -4) * (lvl > 1 ? 1 : 0)} k={k} />);
    rows.push(
      <g key={lvl}>
        {(lvl - firstRow) % 2 === 1 && <rect x={X0L} y={y} width={X1R - X0L} height={rowH} fill={VIZ.grid} opacity={0.25} />}
        <Txt x={X0L + 8} y={narrow ? y + 24 * f : y + rowH / 2 + 6 * f} anchor="start" size={0.8} weight={650} color={ICON_COLOR[icons[lvl]!]}>
          {narrow ? level.navn : level.kort}
        </Txt>
        {items}
        <Txt x={countX - 8} y={narrow ? iconY + 7 * f : y + rowH / 2 + 6 * f} anchor="end" size={0.85} weight={700}>
          {fmtMolecules(n)}
        </Txt>
        {lvl > firstRow && !narrow && (
          <Arrow x1={iconX0 - 14} y1={y - rowH * 0.35} x2={iconX0 - 14} y2={y + (narrow ? 24 * f + 6 : rowH * 0.35)} color={VIZ.muted} width={2} head={8} />
        )}
      </g>,
    );
  }
  // Cellekjernen rundt trinnene som skjer der (fettløselig: kompleks på DNA og mRNA)
  const nucleus = !water ? { y: rowY(1) + 2, h: rowH * 2 - 4 } : null;
  const receptorY = memY;
  return (
    <Figure
      viewBox={`0 0 800 ${H}`}
      maxHeight={narrow ? 1200 : H}
      label={`Målcelle for et ${water ? 'vannløselig' : 'fettløselig'} hormon. ${receptor ? 'Cellen har reseptor.' : 'Cellen mangler reseptor og reagerer ikke.'}`}
      caption={
        water
          ? 'Hver rad er ett trinn i signalkjeden. Antall symboler øker logaritmisk; tallene til høyre er antall molekyler.'
          : 'Hver rad er ett trinn. Komplekset virker inne i cellekjernen; proteinene lages på ribosomer i cytoplasmaet.'
      }
    >
      <rect x={X0L} y={bloodTop} width={X1R - X0L} height={memY - bloodTop} fill={mixBlood} rx={12} />
      <rect x={X0L} y={memY} width={X1R - X0L} height={H - 6 - memY} fill={BIO.cytoplasma} rx={12} />
      <Txt x={X0L + 4} y={22 * f} anchor="start" size={0.85} muted>
        Blod og vevsvæske
      </Txt>
      <Txt x={narrow ? X0L + 4 : X1R - 4} y={narrow ? 48 * f : 22 * f} anchor={narrow ? 'start' : 'end'} size={0.85} weight={700}>
        {water ? (receptor ? 'Adrenalin binder seg til en reseptor i membranen' : 'Adrenalin i blodet') : 'Kortisol går gjennom membranen'}
      </Txt>
      {nucleus && (
        <g>
          <rect x={X0L + 4} y={nucleus.y} width={X1R - X0L - 8} height={nucleus.h} rx={18} fill={BIO.kjerne.fill} stroke={BIO.kjerne.line} strokeWidth={1.6} strokeDasharray="7 5" />
        </g>
      )}
      <Membran
        x={400}
        y={memY}
        length={X1R - X0L}
        thickness={T}
        skip={water && receptor ? receptorXs.map((x) => proteinSlot(x, 'reseptor', T)) : []}
      />
      {water &&
        receptor &&
        receptorXs.map((x, i) => <Reseptor key={i} x={x} y={receptorY} thickness={T} bound={p0 > 0.6} />)}
      {!water && receptor && (
        <g>
          {receptorXs.map((x, i) => (
            <ReceptorBlob key={i} x={x} y={rowY(0) + (narrow ? rowH - 22 : rowH / 2)} k={k} bound={p0 > 0.5} />
          ))}
        </g>
      )}
      {rows}
      {nucleus && (
        <Txt x={iconX1 + 10} y={nucleus.y + 18 * f} anchor="start" size={0.75} color={BIO.kjerne.line} weight={650}>
          Cellekjerne
        </Txt>
      )}
      {hormoneEls}
      {water && receptor && (
        <Txt x={X0L + 8} y={memY - T / 2 - 10} anchor="start" size={0.8} weight={650} color={BIO.protein.line}>
          {hormones === 1 ? 'Reseptor' : 'Reseptorer'}
        </Txt>
      )}
      {!receptor && (
        <Txt x={400} y={water ? memY - T / 2 - 14 : rowY(0) + 10} size={0.9} weight={700} color={BIO.signal}>
          Ingen reseptor: cellen reagerer ikke
        </Txt>
      )}
    </Figure>
  );
}

const X0L = 20;
const X1R = 780;
const mixBlood = BIO.vannFyll;

function Diamond({ x, y, s }: { x: number; y: number; s: number }) {
  return <path d={`M${x},${y - s} L${x + s * 0.8},${y} L${x},${y + s} L${x - s * 0.8},${y} Z`} fill={BIO.signal} stroke={VIZ.surface} strokeWidth={1.2} />;
}

/** DNA som dobbelt spiral (to bølgelinjer). */
function DnaStrand({ x0, x1, y, k }: { x0: number; x1: number; y: number; k: number }) {
  const a = 6 * k;
  const wave = (ph: number) => linePath(sample((x) => y + a * Math.sin((x - x0) / (9 * k) + ph), x0, x1, 120), (v) => v, (v) => v);
  return (
    <g opacity={0.8}>
      <path d={wave(0)} fill="none" stroke={BIO.dna} strokeWidth={1.6} />
      <path d={wave(Math.PI)} fill="none" stroke={BIO.dna} strokeWidth={1.6} />
    </g>
  );
}

function ReceptorBlob({ x, y, k, bound }: { x: number; y: number; k: number; bound: boolean }) {
  const r = 11 * k;
  return (
    <g>
      <path
        d={`M${x - r},${y + r * 0.6} Q${x - r},${y - r * 0.6} ${x - r * 0.3},${y - r * 0.6} L${x - r * 0.15},${y - r * 0.1} L${x + r * 0.15},${y - r * 0.1} L${x + r * 0.3},${y - r * 0.6} Q${x + r},${y - r * 0.6} ${x + r},${y + r * 0.6} Z`}
        fill={BIO.protein.fill}
        stroke={BIO.protein.line}
        strokeWidth={1.4}
      />
      {bound && <Diamond x={x} y={y - r * 0.5} s={r * 0.55} />}
    </g>
  );
}

function Icon({ kind, x, y, k }: { kind: IconKind; x: number; y: number; k: number }) {
  const s = 8 * k;
  const c = ICON_COLOR[kind];
  const paintOf = (p: BioPaint) => ({ fill: p.fill, stroke: p.line, strokeWidth: 1.3 });
  switch (kind) {
    case 'hormon':
      return <Diamond x={x} y={y} s={s} />;
    case 'kompleks':
      return (
        <g>
          <ellipse cx={x} cy={y + s * 0.3} rx={s} ry={s * 0.7} {...paintOf(BIO.protein)} />
          <Diamond x={x} y={y - s * 0.4} s={s * 0.6} />
        </g>
      );
    case 'gprotein':
      return <rect x={x - s * 0.8} y={y - s * 0.65} width={s * 1.6} height={s * 1.3} rx={s * 0.4} {...paintOf(BIO.protein)} />;
    case 'camp':
      return <circle cx={x} cy={y} r={s * 0.5} fill={c} stroke={VIZ.surface} strokeWidth={1} />;
    case 'kinase':
      return <ellipse cx={x} cy={y} rx={s * 0.8} ry={s * 0.6} {...paintOf(BIO.kjerne)} />;
    case 'enzym':
      return <ellipse cx={x} cy={y} rx={s * 0.8} ry={s * 0.6} {...paintOf(BIO.lysosom)} />;
    case 'glukose': {
      const r = s * 0.62;
      const pts = Array.from({ length: 6 }, (_, i) => {
        const a = (Math.PI / 3) * i + Math.PI / 6;
        return `${(x + r * Math.cos(a)).toFixed(1)},${(y + r * Math.sin(a)).toFixed(1)}`;
      }).join(' ');
      return <polygon points={pts} fill={c} stroke={VIZ.surface} strokeWidth={1} />;
    }
    case 'mrna':
      return (
        <path
          d={`M${x - s},${y} q${s * 0.25},${-s * 0.6} ${s * 0.5},0 t${s * 0.5},0 t${s * 0.5},0 t${s * 0.5},0`}
          fill="none"
          stroke={c}
          strokeWidth={2}
          strokeLinecap="round"
        />
      );
    case 'protein':
      return <path d={`M${x - s * 0.8},${y} q0,${-s * 0.8} ${s * 0.8},${-s * 0.6} q${s * 0.9},0 ${s * 0.7},${s * 0.6} q0,${s * 0.7} ${-s * 0.8},${s * 0.6} q${-s * 0.7},0 ${-s * 0.7},${-s * 0.6} Z`} {...paintOf(BIO.mitokondrie)} />;
  }
}

/* ---------- Graf: antall molekyler på hvert trinn over tid ---------- */

function CascadePlot({ kind, hormones, receptor, t, height, f }: { kind: HormoneKind; hormones: number; receptor: boolean; t: number; height: number; f: number }) {
  const cas = CASCADES[kind];
  const icons = ICONS[kind];
  const yMax = kind === 'vannloselig' ? 10 : 6;
  const unitLabel = cas.unit === 's' ? 'Tid (s)' : 'Tid (min)';
  return (
    <Plot
      x={{ min: 0, max: cas.tMax, label: unitLabel, ticks: cas.unit === 's' ? undefined : [0, 30, 60, 90, 120, 150, 180] }}
      y={{ min: 0, max: yMax, label: 'Antall molekyler', ticks: [] }}
      width={800}
      height={height}
      margin={{ top: 20 * f, right: 24 * f, bottom: 56 * f, left: 112 * f }}
    >
      {({ sx, sy, x0, x1, y0, y1 }) => (
        <PlotBody
          kind={kind}
          yMax={yMax}
          sx={sx}
          sy={sy}
          x0={x0}
          x1={x1}
          y0={y0}
          y1={y1}
          curves={cas.levels.map((_, i) => ({
            color: ICON_COLOR[icons[i]!],
            pts: sample((s) => Math.log10(1 + (cascadeAt(kind, hormones, s, receptor)[i] ?? 0)), 0, cas.tMax, 160),
          }))}
          t={t}
          now={cascadeAt(kind, hormones, t, receptor)}
        />
      )}
    </Plot>
  );
}

function PlotBody({
  yMax,
  sx,
  sy,
  x0,
  x1,
  y0,
  y1,
  curves,
  t,
  now,
}: {
  kind: HormoneKind;
  yMax: number;
  sx: (v: number) => number;
  sy: (v: number) => number;
  x0: number;
  x1: number;
  y0: number;
  y1: number;
  curves: { color: string; pts: [number, number][] }[];
  t: number;
  now: number[];
}) {
  const f = useTextScale();
  const ticks = [
    { v: 0, t: '0' },
    { v: 2, t: '100' },
    { v: 4, t: '10 000' },
    { v: 6, t: '1 mill.' },
    { v: 8, t: '100 mill.' },
    { v: 10, t: '10 mrd.' },
  ].filter((tk) => tk.v <= yMax);
  return (
    <g>
      {ticks.map((tk) => (
        <g key={tk.v}>
          <line x1={x0} x2={x1} y1={sy(tk.v)} y2={sy(tk.v)} className="viz-gridline" />
          <text x={x0 - 10} y={sy(tk.v) + 5 * f} textAnchor="end" className="viz-tick">
            {tk.t}
          </text>
        </g>
      ))}
      {curves.map((c, i) => (
        <path key={i} d={linePath(c.pts, sx, sy)} fill="none" stroke={c.color} strokeWidth={3} />
      ))}
      {t > 0 && <line x1={sx(t)} x2={sx(t)} y1={y0} y2={y1} className="viz-guide" />}
      {curves.map((c, i) => (
        <circle key={i} cx={sx(t)} cy={sy(Math.log10(1 + (now[i] ?? 0)))} r={5.5} fill={c.color} stroke={VIZ.surface} strokeWidth={2} />
      ))}
    </g>
  );
}

/* ---------- Forklaring ---------- */

function signalText(kind: HormoneKind, t: number, hormones: number, receptor: boolean, counts: number[]): ReactNode {
  const cas = CASCADES[kind];
  const last = cas.levels.length - 1;
  const water = kind === 'vannloselig';
  const done = cascadeProgress(kind, last, t);
  if (!receptor)
    return (
      <>
        <p>
          <strong>Cellen har ingen reseptor for hormonet</strong>, så ingenting skjer, selv om hormonet{' '}
          {water ? 'er i blodet rundt cellen' : 'kommer helt inn i cellen'}. Hormoner fraktes med blodet til alle cellene i kroppen, men bare{' '}
          <strong>målcellene</strong>, som har riktig reseptor, reagerer. Derfor kan ett hormon virke på leveren uten å påvirke huden.
        </p>
        <p>Reseptoren og hormonet passer sammen som nøkkel og lås.</p>
      </>
    );
  const amp = (
    <p>
      <strong>Forsterkning:</strong> hvert aktivt enzym lager eller aktiverer mange molekyler på neste trinn, så {hormones}{' '}
      {hormones === 1 ? 'hormonmolekyl' : 'hormonmolekyler'} gir til slutt ca. {fmtBig(cascadeTotals(kind, hormones)[last] ?? 0)}{' '}
      {water ? 'glukosemolekyler' : 'proteinmolekyler'}
      {done < 0.99 ? ` (så langt ${fmtBig(counts[last] ?? 0)})` : ''}. Derfor trengs det bare svært små mengder hormon i blodet.
    </p>
  );
  if (water)
    return (
      <>
        <p>
          <strong>
            {t < 0.05 ? 'Adrenalin er på vei til levercellen.' : done < 0.5 ? 'Signalet går nedover kjeden.' : 'Full respons etter noen sekunder.'}
          </strong>{' '}
          Adrenalin er vannløselig og kommer ikke gjennom lipidlaget. Det binder seg til en <strong>reseptor i cellemembranen</strong>, og
          reseptoren aktiverer et G-protein og enzymet adenylatsyklase på innsiden. Enzymet lager cAMP, et <strong>sekundært
          budbringerstoff</strong> som sender beskjeden videre inne i cellen: proteinkinaser aktiverer enzymer som bryter ned glykogen til
          glukose. Glukosen går ut i blodet, og du får energi til å flykte eller kjempe.
        </p>
        {amp}
        <p>
          Responsen kommer i løpet av sekunder og varer kort: når adrenalinet slipper reseptoren, bryter enzymer ned cAMP. Glukagon virker på
          samme måte når blodsukkeret er lavt (negativ tilbakekobling).
        </p>
      </>
    );
  return (
    <>
      <p>
        <strong>
          {t < 0.05 ? 'Kortisol er på vei inn i cellen.' : done < 0.5 ? 'Genet skrives av, og proteinene lages.' : 'Full respons etter et par timer.'}
        </strong>{' '}
        Kortisol er et steroidhormon (laget av kolesterol) og er fettløselig, så det går rett gjennom lipidlaget. Inne i cellen binder det seg
        til en <strong>reseptor i cytoplasmaet</strong>. Hormon–reseptor-komplekset går inn i cellekjernen og binder seg til DNA, slik at
        bestemte gener skrives av til mRNA. Ribosomene lager nye proteiner (enzymer) etter oppskriften i mRNA.
      </p>
      {amp}
      <p>
        Fordi nye proteiner må lages, tar responsen timer i stedet for sekunder, men den varer også lenger. Kortisol øker for eksempel
        produksjonen av enzymer som lager glukose i leveren ved langvarig stress. Østrogen og testosteron virker på samme måte.
      </p>
    </>
  );
}
