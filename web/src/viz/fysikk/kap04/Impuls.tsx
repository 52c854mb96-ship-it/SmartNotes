import { useState, type ReactNode } from 'react';
import {
  Arrow,
  Controls,
  Explain,
  Figure,
  Formula,
  FormulaLine,
  Ground,
  Label,
  Legend,
  Plot,
  Readout,
  Readouts,
  Segmented,
  Slider,
  Sub,
  TSub,
  Toolbar,
  VIZ,
  VizLayout,
  fmt,
  linePath,
  sample,
  useTextScale,
} from '../../kit';
import { dtForFmax, impact, pulseForce, type ImpactResult } from './model';
import { useNarrow } from './useNarrow';

type ScenarioId = 'egg' | 'bil';

interface Scenario {
  label: string;
  /** Masse (kg) og fart rett før støtet (m/s). */
  m: number;
  v: number;
  /** Støttid i millisekunder. */
  dtMin: number;
  dtMax: number;
  dtStep: number;
  dtDefault: number;
  /** Kraft vises i N eller kN. */
  unit: 'N' | 'kN';
  /** Største verdi på kraftaksen (i `unit`). */
  yMax: number;
  yTicks: number[];
  /** Hvor stor kraft legemet tåler (N), om det finnes en slik grense. */
  limit?: number;
  /** Piksler per meter i scenen. */
  pxPerM: number;
}

const SCENARIOS: Record<ScenarioId, Scenario> = {
  egg: {
    label: 'Egg som faller 1 m',
    m: 0.06,
    v: Math.sqrt(2 * 9.81 * 1),
    dtMin: 3,
    dtMax: 30,
    dtStep: 0.5,
    dtDefault: 5,
    unit: 'N',
    yMax: 150,
    yTicks: [0, 50, 100, 150],
    limit: 35,
    pxPerM: 1500,
  },
  bil: {
    label: 'Bilkollisjon i 50 km/h',
    m: 75,
    v: 50 / 3.6,
    dtMin: 10,
    dtMax: 150,
    dtStep: 1,
    dtDefault: 20,
    unit: 'kN',
    yMax: 175,
    yTicks: [0, 50, 100, 150],
    pxPerM: 200,
  },
};

const OPTIONS: { value: ScenarioId; label: string }[] = [
  { value: 'egg', label: SCENARIOS.egg.label },
  { value: 'bil', label: SCENARIOS.bil.label },
];

function surfaceName(id: ScenarioId, dtMs: number): string {
  if (id === 'egg') return dtMs < 7 ? 'Tynn matte' : dtMs < 15 ? 'Sammenbrettet håndkle' : 'Pute';
  return dtMs < 30 ? 'Uten bilbelte: treffer rattet' : dtMs < 90 ? 'Med bilbelte' : 'Bilbelte og kollisjonspute';
}

/** Kraft i enheten scenariet viser (N eller kN). */
const inUnit = (sc: Scenario, F: number) => (sc.unit === 'kN' ? F / 1000 : F);
const forceText = (sc: Scenario, F: number) => {
  const v = inUnit(sc, F);
  return `${fmt(v, v < 10 ? 1 : 0)} ${sc.unit}`;
};

export default function Impuls() {
  const [id, setId] = useState<ScenarioId>('egg');
  const [dts, setDts] = useState<Record<ScenarioId, number>>({ egg: SCENARIOS.egg.dtDefault, bil: SCENARIOS.bil.dtDefault });
  const sc = SCENARIOS[id];
  const dtMs = dts[id];
  const r = impact(sc.m, sc.v, dtMs / 1000);
  const broken = sc.limit !== undefined && r.Fmax > sc.limit;
  const [graphRef, narrow] = useNarrow<HTMLDivElement>();
  const graphH = narrow ? 480 : 360;

  return (
    <VizLayout>
      <Toolbar>
        <Segmented label="Velg situasjon" options={OPTIONS} value={id} onChange={setId} />
      </Toolbar>
      <Controls>
        <Slider
          label="Støttid Δt"
          value={dtMs}
          onChange={(v) => setDts((prev) => ({ ...prev, [id]: v }))}
          min={sc.dtMin}
          max={sc.dtMax}
          step={sc.dtStep}
          unit="ms"
          decimals={sc.dtStep < 1 ? 1 : 0}
        />
      </Controls>

      <Figure
        viewBox="0 0 800 280"
        label={`${sc.label}. ${surfaceName(id, dtMs)}. Støttiden er ${fmt(dtMs, 1)} millisekunder og bremselengden ${fmt(r.stopDist * 100, 1)} centimeter.`}
        maxHeight={300}
      >
        {id === 'egg' ? <EggScene sc={sc} r={r} dtMs={dtMs} broken={broken} /> : <CarScene sc={sc} r={r} dtMs={dtMs} />}
      </Figure>

      <div ref={graphRef}>
        <Figure viewBox={`0 0 800 ${graphH}`} label="Graf over kraften under støtet. Arealet under grafen er impulsen.">
          <ForceGraph sc={sc} r={r} dtMs={dtMs} height={graphH} />
        </Figure>
      </div>
      <Legend
        items={[
          { color: VIZ.applied, label: 'Kraft F under støtet (arealet er impulsen I)' },
          {
            color: VIZ.applied,
            dashed: true,
            label: (
              <span>
                Gjennomsnittskraft F<Sub>gj</Sub> (samme areal)
              </span>
            ),
          },
          ...(sc.limit !== undefined ? [{ color: VIZ.muted, dashed: true, label: 'Det egget tåler' }] : []),
        ]}
      />

      <Readouts>
        <Readout label="Impuls I = Δp" value={fmt(r.dp, r.dp < 10 ? 3 : 0)} unit="N·s" tone={VIZ.applied} />
        <Readout
          label={
            <span>
              Gjennomsnittskraft F<Sub>gj</Sub>
            </span>
          }
          value={fmt(inUnit(sc, r.Favg), inUnit(sc, r.Favg) < 10 ? 1 : 0)}
          unit={sc.unit}
        />
        <Readout
          label={
            <span>
              Største kraft F<Sub>maks</Sub>
            </span>
          }
          value={fmt(inUnit(sc, r.Fmax), inUnit(sc, r.Fmax) < 10 ? 1 : 0)}
          unit={sc.unit}
          tone={VIZ.applied}
        />
        <Readout
          label={
            <span>
              F<Sub>maks</Sub> i forhold til tyngden
            </span>
          }
          value={fmt(r.Gs, 0)}
          unit="· mg"
        />
      </Readouts>

      <Formula label="Impulsloven">
        <FormulaLine>
          I = Δp = m · v = {fmt(sc.m, sc.m < 1 ? 3 : 0)} kg · {fmt(sc.v, 2)} m/s = {fmt(r.dp, r.dp < 10 ? 3 : 0)} N·s
        </FormulaLine>
        <FormulaLine>
          F<Sub>gj</Sub> = I/Δt = {fmt(r.dp, r.dp < 10 ? 3 : 0)} N·s / {fmt(dtMs / 1000, 4)} s = {forceText(sc, r.Favg)}
        </FormulaLine>
        <FormulaLine>
          F<Sub>maks</Sub> = (π/2) · F<Sub>gj</Sub> = {forceText(sc, r.Fmax)}
        </FormulaLine>
      </Formula>

      <Explain>{explanation(id, sc, r, dtMs, broken)}</Explain>
    </VizLayout>
  );
}

/** Eggform: høyere over midtlinja enn under. */
function eggPath(cx: number, mid: number, w: number, up: number, down: number): string {
  return `M ${cx - w} ${mid} A ${w} ${up} 0 0 1 ${cx + w} ${mid} A ${w} ${down} 0 0 1 ${cx - w} ${mid} Z`;
}

function EggScene({ sc, r, dtMs, broken }: { sc: Scenario; r: ImpactResult; dtMs: number; broken: boolean }) {
  const f = useTextScale();
  const ground = 266;
  const sPx = r.stopDist * sc.pxPerM;
  const thick = Math.max(14, sPx / 0.72);
  const top = ground - thick;
  const cx = 290;
  const W = 38;
  const UP = 58;
  const DOWN = 44;
  const dent = W * 1.6;
  const left = cx - 170;
  const right = cx + 170;
  const cushion = `M ${left} ${ground} L ${left} ${top} L ${cx - dent} ${top} Q ${cx} ${top + 2 * sPx} ${cx + dent} ${top} L ${right} ${top} L ${right} ${ground} Z`;
  const midNow = top + sPx - DOWN;
  const midGhost = top - DOWN;
  const fLen = (inUnit(sc, r.Fmax) / sc.yMax) * 170;
  const dimX = right + 26;
  return (
    <>
      <Ground x1={left - 40} x2={right + 40} y={ground} />
      <path d={cushion} fill={VIZ.bodyStrong} className="viz-block" />
      <path d={eggPath(cx, midGhost, W, UP, DOWN)} fill="none" stroke={VIZ.muted} strokeWidth={1.5} strokeDasharray="5 4" />
      <path d={eggPath(cx, midNow, W, UP, DOWN)} fill={VIZ.body} className="viz-block" />
      {broken && (
        <polyline
          points={`${cx - W + 3},${midNow - 8} ${cx - 14},${midNow + 6} ${cx - 3},${midNow - 10} ${cx + 9},${midNow + 7} ${cx + W - 3},${midNow - 6}`}
          fill="none"
          stroke={VIZ.ink}
          strokeWidth={2.5}
          strokeLinejoin="round"
        />
      )}
      <Arrow
        x1={cx - W - 50}
        y1={midGhost - 64}
        x2={cx - W - 50}
        y2={midGhost}
        color={VIZ.velocity}
        label="v"
        labelAnchor="end"
        labelX={cx - W - 62}
        labelY={midGhost - 26}
      />
      <Arrow
        x1={cx}
        y1={midNow}
        x2={cx}
        y2={midNow - fLen}
        color={VIZ.applied}
        label="F"
        labelAnchor="start"
        labelX={cx + 12}
        labelY={midNow - fLen + 16}
        minLength={4}
      />
      {/* Bremselengden: fra der egget treffer til der det stopper */}
      <line x1={cx + W} y1={top} x2={dimX + 8} y2={top} className="viz-guide" />
      <line x1={cx + 4} y1={top + sPx} x2={dimX + 8} y2={top + sPx} className="viz-guide" />
      <line x1={dimX} y1={top} x2={dimX} y2={top + sPx} stroke={VIZ.muted} strokeWidth={2} />
      <Label x={dimX + 14} y={top + sPx / 2 + 6} anchor="start" muted>
        s = {fmt(r.stopDist * 100, 1)} cm
      </Label>

      <Label x={790} y={34} anchor="end" muted>
        {surfaceName('egg', dtMs)}
      </Label>
      <Label x={790} y={34 + 30 * f} anchor="end" weight={700}>
        {broken ? 'Egget knuses' : 'Egget holder'}
      </Label>
    </>
  );
}

function CarScene({ sc, r, dtMs }: { sc: Scenario; r: ImpactResult; dtMs: number }) {
  const f = useTextScale();
  const floor = 240;
  const wall = 700;
  const sPx = r.stopDist * sc.pxPerM;
  const thick = Math.max(12, sPx / 0.78);
  const face = wall - thick;
  const bw = 104;
  const bh = 120;
  const by = floor - bh - 6;
  const cy = by + bh / 2;
  const dent = 60;
  const cushion = `M ${wall} ${cy - 62} L ${face} ${cy - 62} L ${face} ${cy - dent} Q ${face + 2 * sPx} ${cy} ${face} ${cy + dent} L ${face} ${cy + 62} L ${wall} ${cy + 62} Z`;
  const ghostX = face - bw;
  const nowX = ghostX + sPx;
  const fLen = (inUnit(sc, r.Fmax) / sc.yMax) * 170;
  const dimY = floor + 16;
  return (
    <>
      <Ground x1={20} x2={780} y={floor} hatch={false} />
      <rect x={wall} y={by - 20} width={26} height={floor - by + 20} rx={4} fill={VIZ.bodyStrong} className="viz-block" />
      <path d={cushion} fill={VIZ.body} className="viz-block" />
      <rect x={ghostX} y={by} width={bw} height={bh} rx={8} fill="none" stroke={VIZ.muted} strokeWidth={1.5} strokeDasharray="5 4" />
      <rect x={nowX} y={by} width={bw} height={bh} rx={8} fill={VIZ.bodyStrong} className="viz-block" />
      <text x={nowX + bw / 2} y={cy - 12} textAnchor="middle" className="viz-block-label">
        fører
      </text>
      <Arrow
        x1={ghostX - 90}
        y1={by - 18}
        x2={ghostX - 20}
        y2={by - 18}
        color={VIZ.velocity}
        label="v"
        labelAnchor="end"
        labelX={ghostX - 102}
        labelY={by - 12}
      />
      <Arrow
        x1={nowX + bw / 2}
        y1={cy + 36}
        x2={nowX + bw / 2 - fLen}
        y2={cy + 36}
        color={VIZ.applied}
        label="F"
        labelAnchor="end"
        labelX={nowX + bw / 2 - fLen - 10}
        labelY={cy + 42}
        minLength={4}
      />
      {/* Bremselengden */}
      <line x1={ghostX + bw} y1={dimY - 8} x2={ghostX + bw} y2={dimY + 8} stroke={VIZ.muted} strokeWidth={1.5} />
      <line x1={nowX + bw} y1={dimY - 8} x2={nowX + bw} y2={dimY + 8} stroke={VIZ.muted} strokeWidth={1.5} />
      <line x1={ghostX + bw} y1={dimY} x2={nowX + bw} y2={dimY} stroke={VIZ.muted} strokeWidth={1.5} />
      <Label x={ghostX + bw - 10} y={dimY + 6 + 4 * f} anchor="end" muted>
        s = {fmt(r.stopDist * 100, 0)} cm
      </Label>
      <Label x={24} y={34} anchor="start" muted>
        {surfaceName('bil', dtMs)}
      </Label>
    </>
  );
}

function ForceGraph({ sc, r, dtMs, height }: { sc: Scenario; r: ImpactResult; dtMs: number; height: number }) {
  const f = useTextScale();
  const xMax = sc.dtMax * 1.1;
  const Fmax = inUnit(sc, r.Fmax);
  const Favg = inUnit(sc, r.Favg);
  const pts = sample((t) => inUnit(sc, pulseForce(r.Fmax, dtMs, t)), 0, dtMs, 160);
  const limit = sc.limit !== undefined ? inUnit(sc, sc.limit) : undefined;
  return (
    <Plot
      x={{ min: 0, max: xMax, label: 'Tid t (ms)' }}
      y={{ min: 0, max: sc.yMax, label: `Kraft F (${sc.unit})`, ticks: sc.yTicks }}
      width={800}
      height={height}
    >
      {({ sx, sy, x1, y1 }) => (
        <g>
          <path d={`${linePath(pts, sx, sy)} L ${sx(dtMs)} ${sy(0)} L ${sx(0)} ${sy(0)} Z`} fill={VIZ.applied} opacity={0.16} />
          <rect
            x={sx(0)}
            y={sy(Favg)}
            width={sx(dtMs) - sx(0)}
            height={sy(0) - sy(Favg)}
            fill="none"
            stroke={VIZ.applied}
            strokeWidth={2}
            strokeDasharray="7 6"
          />
          {limit !== undefined && (
            <>
              <line x1={sx(0)} y1={sy(limit)} x2={x1} y2={sy(limit)} className="viz-guide" />
              {/* Over linja når toppen er under grensen (da står F_maks-etiketten under), ellers under linja */}
              <Label x={x1 - 6} y={Fmax < limit ? sy(limit) - 10 : sy(limit) + 24 * f} anchor="end" muted>
                tåler ca. {fmt(limit, 0)} {sc.unit}
              </Label>
            </>
          )}
          <path d={linePath(pts, sx, sy)} fill="none" stroke={VIZ.applied} strokeWidth={3.5} strokeLinejoin="round" />
          <Label x={sx(dtMs / 2) + 10} y={sy(Fmax) - 10} anchor="start" color={VIZ.applied}>
            F<TSub>maks</TSub> = {fmt(Fmax, Fmax < 10 ? 1 : 0)} {sc.unit}
          </Label>
          {/* Øverst til høyre, men midt i grafen når toppen av en kort puls ellers ville kollidert med F_maks-etiketten */}
          <Label x={x1 - 6} y={Fmax > 0.6 * sc.yMax ? sy(0.55 * sc.yMax) : y1 + 22 * f} anchor="end">
            arealet = I = {fmt(r.dp, r.dp < 10 ? 3 : 0)} N·s
          </Label>
        </g>
      )}
    </Plot>
  );
}

function explanation(id: ScenarioId, sc: Scenario, r: ImpactResult, dtMs: number, broken: boolean): ReactNode {
  const I = `${fmt(r.dp, r.dp < 10 ? 3 : 0)} N·s`;
  const area = (
    <p>
      Kraften er ikke konstant, men bygges opp og avtar. Det stiplete rektangelet har samme areal, og høyden er gjennomsnittskraften F
      <Sub>gj</Sub> = Δp/Δt; toppen av kurven (en halv sinusbue) er π/2 ≈ 1,6 ganger så høy.
    </p>
  );
  if (id === 'egg')
    return (
      <>
        <p>
          <strong>{broken ? 'Egget knuses.' : 'Egget holder.'}</strong> Egget skal stoppes fra {fmt(sc.v, 1)} m/s til ro, så impulsen er den
          samme uansett underlag: I = Δp = {I}. Det er arealet under F-t-grafen. På {surfaceName('egg', dtMs).toLocaleLowerCase('nb')}{' '}
          stopper egget på {fmt(dtMs, 1)} ms over {fmt(r.stopDist * 100, 1)} cm, og den største kraften blir {forceText(sc, r.Fmax)}
          {broken
            ? ` – mer enn egget tåler.${dtMs < 7 ? ' På betong er støttiden under 1 ms, og kraften blir enda større.' : ''} Gjør støttiden lengre, så blir kraften mindre for samme areal: med denne modellen holder egget når støttiden er over ca. ${fmt(1000 * dtForFmax(r.dp, sc.limit ?? Infinity), 0)} ms.`
            : '. Lang støttid gir liten kraft. Samme idé brukes i sykkelhjelmer: skummet presses sammen og forlenger støttiden.'}
        </p>
        {area}
      </>
    );
  return (
    <>
      <p>
        <strong>{surfaceName('bil', dtMs)}.</strong> Føreren på {fmt(sc.m, 0)} kg skal fra 50 km/h til ro, så I = Δp = {I} uansett. Med en
        støttid på {fmt(dtMs, 0)} ms blir den største kraften {forceText(sc, r.Fmax)}, {fmt(r.Gs, 0)} ganger tyngden.{' '}
        {dtMs < 90
          ? 'Bilbelte og kollisjonspute forlenger bremselengden og støttiden, og da blir kraften mange ganger mindre.'
          : 'Bilbeltet og kollisjonsputa gir en lang bremselengde, så kraften fordeles over lang tid.'}
      </p>
      {area}
    </>
  );
}
