import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  BIO,
  Controls,
  Explain,
  Figure,
  Fisk,
  Forvalg,
  Formula,
  FormulaLine,
  Legend,
  PlayBar,
  Plot,
  Readout,
  Readouts,
  Segmented,
  Slider,
  Toggle,
  Toolbar,
  Txt,
  VIZ,
  VizLayout,
  fmt,
  fmtPct,
  jiggle,
  linePath,
  logisticRate,
  niceTicks,
  placeParticles,
  sample,
  useContainerTextScale,
  useSimClock,
  useTextScale,
} from '../kit';
import {
  HARVEST_YEARS,
  REOPEN_ABOVE,
  SILD,
  STOP_BELOW,
  analyseHarvest,
  niceAxis,
  runAt,
  simulateHarvest,
  type HarvestAnalysis,
  type HarvestMode,
  type HarvestParams,
  type HarvestRun,
} from './model';

const MODES: { value: HarvestMode; label: string }[] = [
  { value: 'kvote', label: 'Fast kvote' },
  { value: 'andel', label: 'Fast andel' },
];

type PresetId = 'baerekraftig' | 'sild' | 'fiskestopp' | 'andel';

const PRESETS: { value: PresetId; label: string; detail: string; p: Partial<HarvestParams> }[] = [
  { value: 'baerekraftig', label: 'Bærekraftig kvote', detail: '1,2 mill. tonn', p: { mode: 'kvote', H: 1.2, moratorium: false } },
  { value: 'sild', label: 'Silda på 1960-tallet', detail: '2 mill. tonn', p: { mode: 'kvote', H: 2, moratorium: false } },
  { value: 'fiskestopp', label: 'Kollaps og fiskestopp', detail: '2 mill. tonn', p: { mode: 'kvote', H: 2, moratorium: true } },
  { value: 'andel', label: 'Fast andel', detail: '25 % per år', p: { mode: 'andel', h: 0.25, moratorium: false } },
];

/** Farger: bestanden (fisk), fangsten (høsting), bæreevnen og tilveksten. */
const C_STOCK = BIO.fisk.line;
const C_CATCH = BIO.hosting;
const C_GROWTH = BIO.byttedyr;

export default function BaerekraftigHosting() {
  const [mode, setMode] = useState<HarvestMode>('kvote');
  const [r, setR] = useState<number>(SILD.r);
  const [K, setK] = useState<number>(SILD.K);
  const [H, setH] = useState(1.2);
  const [h, setHFrac] = useState(0.25);
  const [moratorium, setMoratorium] = useState(false);
  const params: HarvestParams = { r, K, mode, H, h, moratorium };
  const run = useMemo(() => simulateHarvest({ r, K, mode, H, h, moratorium }), [r, K, mode, H, h, moratorium]);
  const a = analyseHarvest(params);
  const clock = useSimClock({ tMax: HARVEST_YEARS, speed: HARVEST_YEARS / 14 });
  const { setT, pause } = clock;
  // Vis hele forløpet når siden åpnes og når noe endres (trykk «Spill av» for å se det år for år)
  useEffect(() => {
    pause();
    setT(HARVEST_YEARS);
  }, [run, pause, setT]);
  const t = Math.min(HARVEST_YEARS, clock.t);
  const N = runAt(run, run.N, t);
  const catchNow = runAt(run, run.catchRate, t);
  const closedNow = runAt(run, run.closed, t);
  const total = run.cumulative[run.cumulative.length - 1] ?? 0;
  const [ref, f] = useContainerTextScale<HTMLDivElement>();
  const preset =
    Math.abs(r - SILD.r) < 1e-9 && Math.abs(K - SILD.K) < 1e-9
      ? (PRESETS.find((p) =>
          p.p.mode === 'kvote'
            ? mode === 'kvote' && Math.abs(H - p.p.H!) < 1e-9 && moratorium === p.p.moratorium
            : mode === 'andel' && Math.abs(h - p.p.h!) < 1e-9 && moratorium === p.p.moratorium,
        )?.value ?? null)
      : null;
  const pick = (id: PresetId) => {
    const p = PRESETS.find((x) => x.value === id)!.p;
    setR(SILD.r);
    setK(SILD.K);
    if (p.mode) setMode(p.mode);
    if (p.H !== undefined) setH(p.H);
    if (p.h !== undefined) setHFrac(p.h);
    setMoratorium(!!p.moratorium);
  };
  // Til sammenligning: samlet fangst over 40 år med en kvote på 90 % av MSY
  const safeTotal = useMemo(
    () => simulateHarvest({ r, K, mode: 'kvote', H: 0.9 * (r * K) / 4, h, moratorium: false }).cumulative.at(-1) ?? 0,
    [r, K, h],
  );

  return (
    <VizLayout>
      <Toolbar>
        <Segmented label="Hvordan fangsten bestemmes" options={MODES} value={mode} onChange={setMode} />
        <Toggle label={`Fiskestopp under ${fmtPct(STOP_BELOW)} av K`} checked={moratorium} onChange={setMoratorium} />
      </Toolbar>
      <Toolbar>
        <Forvalg label="Eksempel" options={PRESETS.map(({ value, label, detail }) => ({ value, label, detail }))} value={preset} onPick={pick} />
      </Toolbar>
      <Controls>
        <Slider label="Vekstrate r" value={r} onChange={setR} min={0.1} max={1} step={0.05} decimals={2} unit="per år" />
        <Slider label="Bæreevne K" value={K} onChange={setK} min={2} max={20} step={1} unit="mill. tonn" />
        {mode === 'kvote' ? (
          <Slider label="Kvote H" value={H} onChange={setH} min={0} max={5} step={0.05} decimals={2} unit="mill. tonn/år" />
        ) : (
          <Slider
            label="Fangstandel h"
            value={Math.round(h * 100)}
            onChange={(v) => setHFrac(v / 100)}
            min={0}
            max={100}
            step={1}
            unit="% per år"
          />
        )}
        <Slider
          label="Tid"
          ariaLabel="År siden fisket startet"
          value={t}
          onChange={(v) => {
            pause();
            setT(v);
          }}
          min={0}
          max={HARVEST_YEARS}
          step={0.5}
          format={(v) => `år ${fmt(v, 0)}`}
        />
      </Controls>
      <Toolbar>
        <PlayBar clock={clock} time={`år ${fmt(t, 0)}`} />
      </Toolbar>

      <div ref={ref}>
        <Sea N={N} K={K} catchNow={catchNow} closed={closedNow} t={t} f={f} collapsed={N < 0.05 * K} />
      </div>

      <StockPlot run={run} t={t} K={K} f={f} />
      <Legend
        items={[
          { color: C_STOCK, label: 'Bestand N (mill. tonn)' },
          { color: C_CATCH, label: 'Fangst (mill. tonn per år)' },
          { color: BIO.baereevne, label: 'Bæreevne K', dashed: true },
          { color: VIZ.muted, label: 'K/2: størst tilvekst', dashed: true },
          ...(moratorium ? [{ color: VIZ.muted, label: 'Grått felt: fiskestopp' }] : []),
        ]}
      />

      <GrowthPlot params={params} a={a} N={N} f={f} closed={closedNow} />
      <Legend
        items={[
          { color: C_GROWTH, label: 'Tilvekst rN(1 − N/K)' },
          { color: C_CATCH, label: mode === 'kvote' ? 'Fangst: fast kvote H' : 'Fangst: fast andel hN' },
          { color: VIZ.ink, label: 'Fylt prikk: stabil likevekt' },
        ]}
      />

      <Readouts>
        <Readout label={`Bestand år ${fmt(t, 0)}`} value={fmt(N, 1)} unit="mill. tonn" tone={C_STOCK} />
        <Readout label={`Fangst år ${fmt(t, 0)}`} value={closedNow ? 'Stopp' : fmt(catchNow, 2)} unit={closedNow ? undefined : 'mill. tonn/år'} tone={C_CATCH} />
        <Readout label="Maksimalt bærekraftig utbytte" value={fmt(a.msy, 2)} unit="mill. tonn/år" tone={C_GROWTH} />
        <Readout label={`Samlet fangst på ${HARVEST_YEARS} år`} value={fmt(total, 0)} unit="mill. tonn" />
      </Readouts>

      <Formula label="Maksimalt bærekraftig utbytte og likevekt">
        <FormulaLine>
          MSY = r · K / 4 = {fmt(r, 2)} · {fmt(K, 0)} / 4 = {fmt(a.msy, 2)} mill. tonn per år, ved N = K/2 = {fmt(K / 2, 1)} mill. tonn
        </FormulaLine>
        {mode === 'kvote' ? (
          a.unstable !== null && a.outcome !== 'msy' ? (
            <>
              <FormulaLine>
                Likevekt der tilvekst = kvote: N* = K/2 · (1 + √(1 − 4H/(rK))) = {fmt(a.equilibrium, 1)} mill. tonn
              </FormulaLine>
              <FormulaLine>Ustabil likevekt (under den kollapser bestanden): {fmt(a.unstable, 1)} mill. tonn</FormulaLine>
            </>
          ) : a.outcome === 'urort' ? (
            <FormulaLine>Uten fangst blir bestanden stående på K = {fmt(K, 0)} mill. tonn.</FormulaLine>
          ) : a.outcome === 'msy' ? (
            <FormulaLine>Kvoten er lik MSY: den eneste likevekten er N = K/2 = {fmt(K / 2, 1)} mill. tonn.</FormulaLine>
          ) : (
            <FormulaLine>
              H = {fmt(H, 2)} &gt; MSY = {fmt(a.msy, 2)}: fangsten er større enn tilveksten for alle N, så det finnes ingen likevekt.
            </FormulaLine>
          )
        ) : (
          h >= r ? (
            <FormulaLine>
              h = {fmt(h, 2)} ≥ r = {fmt(r, 2)}: fangsten hN er større enn tilveksten for alle N, så bestanden går mot null.
            </FormulaLine>
          ) : (
            <>
              <FormulaLine>
                Likevekt: N* = K(1 − h/r) = {fmt(K, 0)} · (1 − {fmt(h, 2)}/{fmt(r, 2)}) = {fmt(a.equilibrium, 1)} mill. tonn
              </FormulaLine>
              <FormulaLine>
                Fangst i likevekt: h · N* = {fmt(h, 2)} · {fmt(a.equilibrium, 1)} = {fmt(a.equilibriumYield, 2)} mill. tonn per år
              </FormulaLine>
            </>
          )
        )}
      </Formula>

      <Explain>{explanation(params, a, run, total, safeTotal)}</Explain>
    </VizLayout>
  );
}

/* ---------- Havet med fiskestimen ---------- */

const MAX_FISH = 36;

function Sea({ N, K, catchNow, closed, t, f, collapsed }: { N: number; K: number; catchNow: number; closed: boolean; t: number; f: number; collapsed: boolean }) {
  const k = Math.max(1, f * 0.85);
  const top = 44 * f;
  const H = Math.round(top + 210 + 120 * (f - 1));
  const water = { x: 20, y: top, w: 760, h: H - top - 10 };
  const fishBox = { x: water.x + 20, y: water.y + 30 * k, w: water.w * 0.62, h: water.h - 40 * k };
  const unit = useMemo(() => placeParticles({ x: 0, y: 0, w: 1000, h: 600 }, [{ n: MAX_FISH, r: 40 }], 12, 8), []);
  const n = Math.max(0, Math.min(MAX_FISH, Math.round((MAX_FISH * N) / K)));
  const shown = n === 0 && N > 0.001 * K ? 1 : n;
  const boatX = water.x + water.w * 0.85;
  const netDepth = water.y + water.h * 0.55;
  const share = K > 0 ? N / K : 0;
  return (
    <Figure
      viewBox={`0 0 800 ${H}`}
      maxHeight={H}
      label={`Havet: bestanden er ${fmt(N, 1)} millioner tonn (${fmtPct(share)} av bæreevnen). ${closed ? 'Fiskestopp.' : `Fangst ${fmt(catchNow, 2)} millioner tonn per år.`}`}
      caption={`Hver fisk er ca. ${fmt(K / MAX_FISH, 2)} mill. tonn. Bæreevnen K er ${fmt(K, 0)} mill. tonn.`}
    >
      <Txt x={water.x + 4} y={22 * f} anchor="start" weight={700} color={C_STOCK}>
        Bestand {fmt(N, 1)} mill. tonn{f > 1.3 ? '' : ` (${fmtPct(share)} av K)`}
      </Txt>
      <rect x={water.x} y={water.y} width={water.w} height={water.h} rx={14} fill={BIO.vannFyll} />
      <line x1={water.x} x2={water.x + water.w} y1={water.y} y2={water.y} stroke={BIO.vann} strokeWidth={2} />
      {unit.slice(0, shown).map((p, i) => {
        const j = jiggle(p, t * 0.6, 18);
        const x = fishBox.x + (fishBox.w * Math.min(1000, Math.max(0, j.x))) / 1000;
        const y = fishBox.y + (fishBox.h * Math.min(600, Math.max(0, j.y))) / 600;
        const right = i % 3 !== 0;
        return (
          <g key={i} transform={right ? undefined : `translate(${2 * x} 0) scale(-1 1)`}>
            <Fisk x={x} y={y} size={34 * k} />
          </g>
        );
      })}
      {collapsed && (
        <Txt x={fishBox.x + fishBox.w / 2} y={fishBox.y + fishBox.h / 2} muted size={1.05}>
          {N <= 0 ? 'Bestanden er borte' : 'Bestanden har kollapset'}
        </Txt>
      )}
      <Boat x={boatX} y={water.y} k={k} />
      {closed ? (
        <Txt x={boatX} y={water.y + 40 * k} weight={700} color={VIZ.muted} size={0.9}>
          Fiskestopp
        </Txt>
      ) : catchNow > 0.005 ? (
        <g>
          <line x1={boatX - 20 * k} y1={water.y} x2={boatX - 40 * k} y2={netDepth} stroke={VIZ.muted} strokeWidth={1.5} />
          <line x1={boatX + 20 * k} y1={water.y} x2={boatX + 40 * k} y2={netDepth} stroke={VIZ.muted} strokeWidth={1.5} />
          <path
            d={`M${boatX - 40 * k},${netDepth} Q${boatX},${netDepth + 34 * k} ${boatX + 40 * k},${netDepth}`}
            fill="none"
            stroke={C_CATCH}
            strokeWidth={2.5}
            strokeDasharray="5 4"
          />
          <Txt x={water.x + water.w - 10} y={water.y + water.h - 12} anchor="end" weight={700} color={C_CATCH} size={0.9}>
            Fangst {fmt(catchNow, 2)} mill. tonn/år
          </Txt>
        </g>
      ) : (
        <Txt x={boatX} y={water.y + 40 * k} muted size={0.9}>
          Ingen fangst
        </Txt>
      )}
    </Figure>
  );
}

/** Enkel fiskebåt sett fra siden, med skroget i vannflaten. */
function Boat({ x, y, k }: { x: number; y: number; k: number }) {
  const w = 74 * k;
  const hh = 16 * k;
  return (
    <g>
      <path
        d={`M${x - w / 2},${y - hh} H${x + w / 2} L${x + w / 2 - 12 * k},${y + 4 * k} H${x - w / 2 + 8 * k} Z`}
        fill={VIZ.bodyStrong}
        stroke={VIZ.ink}
        strokeWidth={1.5}
        strokeLinejoin="round"
      />
      <rect x={x - w * 0.32} y={y - hh - 14 * k} width={w * 0.3} height={14 * k} rx={2} fill={VIZ.body} stroke={VIZ.ink} strokeWidth={1.2} />
      <line x1={x + w * 0.18} y1={y - hh} x2={x + w * 0.18} y2={y - hh - 26 * k} stroke={VIZ.ink} strokeWidth={1.5} />
    </g>
  );
}

/** Desimaler som trengs for at akseverdiene skal bli forskjellige (0,5-steg gir én desimal). */
function tickDecimals(ticks: readonly number[]): number {
  const step = ticks.length > 1 ? Math.abs(ticks[1]! - ticks[0]!) : 1;
  return step >= 1 - 1e-9 ? 0 : step >= 0.1 - 1e-9 ? 1 : 2;
}

/* ---------- Bestand og fangst over tid ---------- */

function StockPlot({ run, t, K, f }: { run: HarvestRun; t: number; K: number; f: number }) {
  const H = Math.round(320 + 260 * (f - 1));
  const yAxis = niceAxis(K * 1.08, 5);
  const N = runAt(run, run.N, t);
  const c = runAt(run, run.catchRate, t);
  // Perioder med fiskestopp som felt
  const bands: [number, number][] = [];
  let start: number | null = null;
  run.closed.forEach((cl, i) => {
    if (cl && start === null) start = run.t[i]!;
    if (!cl && start !== null) {
      bands.push([start, run.t[i]!]);
      start = null;
    }
  });
  if (start !== null) bands.push([start, run.t[run.t.length - 1]!]);
  const stock = run.t.map((x, i) => [x, run.N[i]!] as [number, number]);
  const catches = run.t.map((x, i) => [x, run.catchRate[i]!] as [number, number]);
  return (
    <Figure viewBox={`0 0 800 ${H}`} label={`Bestand og fangst over ${HARVEST_YEARS} år. År ${fmt(t, 0)}: bestand ${fmt(N, 1)} og fangst ${fmt(c, 2)} millioner tonn.`}>
      <Plot
        x={{ min: 0, max: HARVEST_YEARS, label: 'Tid (år)' }}
        y={{ min: 0, max: yAxis.max, label: 'Millioner tonn', ticks: yAxis.ticks, decimals: tickDecimals(yAxis.ticks) }}
        width={800}
        height={H}
      >
        {({ sx, sy, y0, y1, x1 }) => (
          <g>
            {bands.map(([a, b], i) => (
              <rect key={i} x={sx(a)} y={y1} width={Math.max(1, sx(b) - sx(a))} height={y0 - y1} fill={VIZ.muted} opacity={0.14} />
            ))}
            <line x1={sx(0)} x2={x1} y1={sy(K)} y2={sy(K)} stroke={BIO.baereevne} strokeWidth={2} strokeDasharray="8 6" />
            <line x1={sx(0)} x2={x1} y1={sy(K / 2)} y2={sy(K / 2)} className="viz-guide" />
            <Txt x={x1 - 6} y={sy(K) - 8} anchor="end" size={0.8} color={BIO.baereevne}>
              K
            </Txt>
            <path d={`${linePath(catches, sx, sy)} L${sx(HARVEST_YEARS)},${sy(0)} L${sx(0)},${sy(0)} Z`} fill={C_CATCH} opacity={0.14} />
            <path d={linePath(catches, sx, sy)} fill="none" stroke={C_CATCH} strokeWidth={2.5} />
            <path d={linePath(stock, sx, sy)} fill="none" stroke={C_STOCK} strokeWidth={3.5} />
            <line x1={sx(t)} x2={sx(t)} y1={y0} y2={y1} className="viz-guide" />
            <circle cx={sx(t)} cy={sy(c)} r={6} fill={C_CATCH} stroke={VIZ.surface} strokeWidth={2.5} />
            <circle cx={sx(t)} cy={sy(N)} r={7} fill={C_STOCK} stroke={VIZ.surface} strokeWidth={2.5} />
          </g>
        )}
      </Plot>
    </Figure>
  );
}

/* ---------- Tilvekst og fangst mot bestanden ---------- */

function GrowthPlot({ params, a, N, f, closed }: { params: HarvestParams; a: HarvestAnalysis; N: number; f: number; closed: boolean }) {
  const { r, K, mode, H: quota, h } = params;
  const Hh = Math.round(320 + 260 * (f - 1));
  const msyY = (r * K) / 4;
  const harvestAt = (n: number) => (closed ? 0 : mode === 'kvote' ? (n > 0 ? quota : 0) : h * n);
  const yTop = Math.max(msyY * 1.35, mode === 'kvote' ? quota * 1.15 : 0);
  const { max: yMax, ticks } = niceAxis(yTop, 5);
  const dec = yMax < 1 ? 2 : yMax < 4 ? 1 : 0;
  const growth = sample((n) => logisticRate(n, r, K), 0, K, 160);
  const g = logisticRate(N, r, K);
  const hv = harvestAt(N);
  const dir = Math.abs(g - hv) < 1e-3 * Math.max(msyY, 1e-9) ? 0 : g > hv ? 1 : -1;
  // Linja for fast andel klippes i toppen av grafen
  const lineEnd = mode === 'andel' ? Math.min(K, h > 0 ? yMax / h : K) : K;
  return (
    <Figure
      viewBox={`0 0 800 ${Hh}`}
      label={`Tilvekst og fangst som funksjon av bestanden. Størst tilvekst ${fmt(msyY, 2)} millioner tonn per år ved N = ${fmt(K / 2, 1)}.`}
    >
      <Plot
        x={{ min: 0, max: K, label: 'Bestand N (mill. tonn)', ticks: niceTicks(0, K, 5), decimals: tickDecimals(niceTicks(0, K, 5)) }}
        y={{ min: 0, max: yMax, label: 'Mill. tonn per år', decimals: dec, ticks }}
        width={800}
        height={Hh}
      >
        {({ sx, sy, y0, y1 }) => (
          <GrowthLines
            sx={sx}
            sy={sy}
            y0={y0}
            y1={y1}
            growth={growth}
            mode={mode}
            quota={quota}
            h={h}
            lineEnd={lineEnd}
            K={K}
            msyY={msyY}
            a={a}
            N={N}
            g={g}
            hv={hv}
            dir={dir}
            dec={dec}
          />
        )}
      </Plot>
    </Figure>
  );
}

function GrowthLines({
  sx,
  sy,
  y0,
  growth,
  mode,
  quota,
  h,
  lineEnd,
  K,
  msyY,
  a,
  N,
  g,
  hv,
  dir,
}: {
  sx: (v: number) => number;
  sy: (v: number) => number;
  y0: number;
  y1: number;
  growth: [number, number][];
  mode: HarvestMode;
  quota: number;
  h: number;
  lineEnd: number;
  K: number;
  msyY: number;
  a: HarvestAnalysis;
  N: number;
  g: number;
  hv: number;
  dir: number;
  dec: number;
}) {
  const f = useTextScale();
  const eqs: { n: number; stable: boolean }[] = [];
  if (a.outcome !== 'kollaps' && a.outcome !== 'fiskestopp') {
    if (a.unstable !== null && a.outcome !== 'msy') eqs.push({ n: a.unstable, stable: false });
    eqs.push({ n: a.equilibrium, stable: true });
  }
  const arrowY = y0 - 16 * f;
  return (
    <g>
      <path d={linePath(growth, sx, sy)} fill="none" stroke={C_GROWTH} strokeWidth={3.5} />
      <circle cx={sx(K / 2)} cy={sy(msyY)} r={5} fill={C_GROWTH} />
      <Txt x={sx(K / 2)} y={sy(msyY) - 12} size={0.85} color={C_GROWTH} weight={700}>
        MSY
      </Txt>
      {mode === 'kvote' ? (
        quota > 0 && <line x1={sx(0)} x2={sx(K)} y1={sy(quota)} y2={sy(quota)} stroke={C_CATCH} strokeWidth={3} />
      ) : (
        h > 0 && <line x1={sx(0)} y1={sy(0)} x2={sx(lineEnd)} y2={sy(h * lineEnd)} stroke={C_CATCH} strokeWidth={3} />
      )}
      {/* Nåværende bestand: tilvekst og fangst ved N */}
      <line x1={sx(N)} x2={sx(N)} y1={y0} y2={sy(Math.max(g, hv))} className="viz-guide" />
      {N > 0 && (
        <g>
          <circle cx={sx(N)} cy={sy(g)} r={6} fill={C_GROWTH} stroke={VIZ.surface} strokeWidth={2} />
          {hv > 0 && <circle cx={sx(N)} cy={sy(hv)} r={6} fill={C_CATCH} stroke={VIZ.surface} strokeWidth={2} />}
        </g>
      )}
      {eqs.map((e, i) => (
        <circle
          key={i}
          cx={sx(e.n)}
          cy={sy(mode === 'kvote' ? quota : h * e.n)}
          r={8}
          fill={e.stable ? VIZ.ink : VIZ.surface}
          stroke={VIZ.ink}
          strokeWidth={2.5}
        />
      ))}
      {/* Pil langs N-aksen: hvilken vei bestanden endrer seg */}
      {dir !== 0 && N > 0 && (
        <g>
          <line x1={sx(N)} x2={sx(N) + dir * 46} y1={arrowY} y2={arrowY} stroke={dir > 0 ? C_GROWTH : C_CATCH} strokeWidth={3} />
          <path
            d={`M${sx(N) + dir * 56},${arrowY} l${-dir * 12},-7 v14 Z`}
            fill={dir > 0 ? C_GROWTH : C_CATCH}
          />
        </g>
      )}
    </g>
  );
}

/* ---------- Forklaring ---------- */

function explanation(p: HarvestParams, a: HarvestAnalysis, run: HarvestRun, total: number, safeTotal: number): ReactNode {
  const surplus = (
    <p>
      Det vi kan høste uten å tære på bestanden, er <strong>tilveksten</strong>: det som fødes og vokser til, minus det som dør. Tilveksten er
      liten når bestanden er liten (få gytefisk) og når den er nær bæreevnen (lite mat og plass), og størst ved K/2. Derfor gir ikke den
      største bestanden det største fisket.
    </p>
  );
  const model = (
    <p>
      Modellen er logistisk vekst med samme r og K hvert år. I virkeligheten varierer gytingen mye fra år til år, og r og K er usikre. Derfor
      setter forvaltningen kvotene lavere enn MSY og bruker føre-var-grenser.
    </p>
  );
  if (a.outcome === 'urort')
    return (
      <>
        <p>
          <strong>Ingen fangst.</strong> Bestanden blir stående på bæreevnen K = {fmt(p.K, 0)} mill. tonn, der like mye dør som vokser til.
          Tilveksten er da null, så en urørt bestand gir ikke noe overskudd å høste av. Øk kvoten eller andelen.
        </p>
        {surplus}
      </>
    );
  if (p.mode === 'andel') {
    if (a.outcome === 'kollaps' || a.outcome === 'fiskestopp')
      return (
        <>
          <p>
            <strong>Andelen er for høy.</strong> Vi tar {fmtPct(p.h)} av bestanden hvert år, men bestanden kan bare vokse med høyst r ={' '}
            {fmtPct(p.r)} i året (når den er liten). Da minker den hele tida.{' '}
            {a.outcome === 'fiskestopp'
              ? `Føre-var-regelen stopper fisket under ${fmtPct(STOP_BELOW)} av K til bestanden er over halvparten igjen, så bestanden svinger opp og ned i stedet for å forsvinne.`
              : 'Fangsten blir mindre etter hvert som bestanden minker, men bestanden går likevel mot null.'}
          </p>
          {surplus}
        </>
      );
    return (
      <>
        <p>
          <strong>Fast andel.</strong> Vi tar {fmtPct(p.h)} av bestanden hvert år, så fangsten blir mindre når bestanden blir mindre. Det gjør
          fast andel tryggere enn fast kvote: bestanden går mot N* = {fmt(a.equilibrium, 1)} mill. tonn, der tilveksten er like stor som fangsten (
          {fmt(a.equilibriumYield, 2)} mill. tonn per år).{' '}
          {a.outcome === 'msy'
            ? 'Med h = r/2 ligger likevekten på K/2, og fangsten blir den største mulige (MSY).'
            : a.overfished
              ? `Andelen er høyere enn r/2 = ${fmtPct(p.r / 2)}: både bestanden og fangsten blir mindre enn ved MSY. Vi fisker mer og får mindre.`
              : `Med en litt høyere andel (r/2 = ${fmtPct(p.r / 2)}) kunne fangsten vært opptil ${fmt(a.msy, 2)} mill. tonn per år.`}
        </p>
        {surplus}
        {model}
      </>
    );
  }
  if (a.outcome === 'baerekraftig' || a.outcome === 'msy')
    return (
      <>
        <p>
          <strong>{a.outcome === 'msy' ? 'Kvoten er lik MSY.' : 'Bærekraftig kvote.'}</strong> Kvoten H = {fmt(p.H, 2)} mill. tonn per år er{' '}
          {a.outcome === 'msy' ? 'akkurat like stor som' : 'mindre enn'} den største tilveksten bestanden kan gi (MSY = {fmt(a.msy, 2)}). Bestanden
          minker til N* = {fmt(a.equilibrium, 1)} mill. tonn, der tilveksten er like stor som fangsten, og så kan vi fiske like mye år etter år.
        </p>
        {a.outcome === 'msy' ? (
          <p>
            Å fiske på MSY er risikabelt: ett dårlig gyteår som presser bestanden under K/2, og kvoten blir større enn tilveksten. Da kollapser
            bestanden hvis kvoten ikke settes ned.
          </p>
        ) : (
          <p>
            Men en fast kvote har en svakhet: faller bestanden under {fmt(a.unstable ?? 0, 1)} mill. tonn (den åpne prikken), for eksempel etter
            noen dårlige gyteår, blir kvoten større enn tilveksten og bestanden kollapser, selv om kvoten er under MSY.
          </p>
        )}
        {surplus}
        {model}
      </>
    );
  const years = run.collapseTime;
  if (a.outcome === 'fiskestopp')
    return (
      <>
        <p>
          <strong>Kollaps og fiskestopp.</strong> Kvoten ({fmt(p.H, 2)} mill. tonn) er større enn MSY ({fmt(a.msy, 2)}), så bestanden minker.
          Under {fmtPct(STOP_BELOW)} av K stoppes fisket, og bestanden vokser til den er over {fmtPct(REOPEN_ABOVE)} av K igjen. Slik gikk det med
          norsk vårgytende sild: bestanden kollapset rundt 1970, fisket ble nesten stoppet, og det tok rundt 20 år før silda var tilbake.
        </p>
        <p>
          Men åpnes fisket med den samme kvoten, kollapser bestanden igjen. Fiskestopp redder bestanden, men en bærekraftig forvaltning krever
          en kvote under MSY. Ikke alle bestander kommer tilbake: torsken ved Newfoundland kollapset i 1992 og har ikke tatt seg opp igjen, blant
          annet fordi økosystemet endret seg mens torsken var borte.
        </p>
        {model}
      </>
    );
  return (
    <>
      <p>
        <strong>Overfiske.</strong> Kvoten H = {fmt(p.H, 2)} mill. tonn per år er større enn den største tilveksten bestanden kan gi (MSY ={' '}
        {fmt(a.msy, 2)}). Da er fangsten større enn tilveksten uansett hvor stor bestanden er, og bestanden minker for hvert år
        {years !== null ? ` til den har kollapset etter ca. ${fmt(years, 0)} år` : ''}. Slik gikk det med norsk vårgytende sild: med ny teknikk
        ble det fisket nesten 2 millioner tonn i året midt på 1960-tallet, og rundt 1970 var bestanden nesten borte.
      </p>
      <p>
        Overfisket ga store fangster de første årene, men samlet fangst over {HARVEST_YEARS} år ble bare {fmt(total, 0)} mill. tonn. Med en
        kvote på 90 % av MSY ville den blitt {fmt(safeTotal, 0)} mill. tonn, og bestanden ville fortsatt vært der. Slå på fiskestopp for å se
        hvordan bestanden kan bygges opp igjen.
      </p>
      {surplus}
    </>
  );
}
