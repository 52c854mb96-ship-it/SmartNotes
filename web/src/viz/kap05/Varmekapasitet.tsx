import { useEffect, useState, type ReactNode } from 'react';
import {
  Controls,
  Explain,
  Figure,
  Formula,
  FormulaLine,
  Legend,
  PlayControls,
  Plot,
  Readout,
  Readouts,
  Segmented,
  Slider,
  Toolbar,
  VIZ,
  VizLayout,
  fmt,
  linePath,
  niceTicks,
  useSimClock,
  useTextScale,
} from '../kit';
import { MATERIALS, heating, timeToReach, type Material, type MaterialId } from './model';
import { ColorDot, Tag, Thermometer, useNarrow } from './marks';

/** Starttemperatur (°C). */
const T0 = 20;
const OPTIONS: { value: MaterialId; label: string }[] = (Object.keys(MATERIALS) as MaterialId[]).map((id) => ({ value: id, label: MATERIALS[id].name }));
const COLORS = [VIZ.series[0], VIZ.series[1]] as const;

interface Run {
  mat: Material;
  color: string;
  /** Tiden det tar å nå ønsket temperatur (Infinity hvis væsken koker først). */
  tDone: number;
  /** Tiden det tar å nå kokepunktet (Infinity for metallene). */
  tBoil: number;
}

function niceCeil(v: number): number {
  if (!(v > 0)) return 1;
  const mag = 10 ** Math.floor(Math.log10(v));
  for (const c of [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10]) if (c * mag >= v - 1e-9) return c * mag;
  return 10 * mag;
}

/** Temperaturen ved tiden t. Varmeelementet slås av når ønsket temperatur er nådd. */
function tempAt(run: Run, m: number, P: number, t: number): number {
  return heating(run.mat, m, P, T0, Math.min(t, run.tDone)).T;
}

export default function Varmekapasitet() {
  const [idA, setIdA] = useState<MaterialId>('vann');
  const [idB, setIdB] = useState<MaterialId>('aluminium');
  const [P, setP] = useState(1000);
  const [m, setM] = useState(1);
  const [T1, setT1] = useState(60);
  const [graphRef, narrow] = useNarrow<HTMLDivElement>();
  const [sceneRef, sceneNarrow] = useNarrow<HTMLDivElement>();

  const runs: Run[] = [idA, idB].map((id, i) => {
    const mat = MATERIALS[id];
    return {
      mat,
      color: COLORS[i]!,
      tDone: timeToReach(mat, m, P, T0, T1),
      tBoil: mat.boil !== undefined ? timeToReach(mat, m, P, T0, mat.boil) : Infinity,
    };
  });
  // Tidsaksen: til den siste er ferdig, eller lenge nok til å se at en kokende væske står stille
  const ends = runs.map((r) => (Number.isFinite(r.tDone) ? r.tDone : 1.6 * r.tBoil));
  const tEnd = niceCeil(Math.max(...ends) * 1.04);

  const clock = useSimClock({ tMax: tEnd, speed: tEnd / 8 });
  const { setT } = clock;
  useEffect(() => setT(60), [setT]);
  const t = Math.min(clock.t, tEnd);
  const graphH = narrow ? 440 : 340;

  return (
    <VizLayout>
      <Controls>
        <Slider label="Effekt P" value={P} onChange={setP} min={100} max={2000} step={50} unit="W" />
        <Slider label="Masse m" value={m} onChange={setM} min={0.1} max={2} step={0.05} unit="kg" decimals={2} />
        <Slider label="Varm opp til" value={T1} onChange={setT1} min={30} max={100} step={1} unit="°C" />
      </Controls>
      <div className="viz-toolbar">
        <span className="viz-slider-label">Stoff 1</span>
        <Segmented label="Velg stoff 1" options={OPTIONS} value={idA} onChange={setIdA} />
      </div>
      <div className="viz-toolbar">
        <span className="viz-slider-label">Stoff 2</span>
        <Segmented label="Velg stoff 2" options={OPTIONS} value={idB} onChange={setIdB} />
      </div>
      <Toolbar>
        <PlayControls clock={clock} decimals={0} />
      </Toolbar>

      {/* På smale skjermer står de to stoffene under hverandre, så figuren blir stor nok */}
      <div ref={sceneRef}>
        <Figure
          viewBox={sceneNarrow ? '0 0 800 660' : '0 0 800 330'}
          label={`${runs[0]!.mat.name} og ${runs[1]!.mat.name}, ${fmt(m, 2)} kg hver, varmes med ${fmt(P, 0)} W. Etter ${fmt(t, 0)} s er temperaturene ${fmt(tempAt(runs[0]!, m, P, t), 1)} °C og ${fmt(tempAt(runs[1]!, m, P, t), 1)} °C.`}
          maxHeight={sceneNarrow ? 640 : 380}
        >
          {runs.map((r, i) =>
            sceneNarrow ? (
              <g key={i} transform={`translate(0 ${330 * i})`}>
                <Station x0={0} w={800} run={r} m={m} P={P} t={t} T1={T1} />
              </g>
            ) : (
              <Station key={i} x0={400 * i} w={400} run={r} m={m} P={P} t={t} T1={T1} />
            ),
          )}
          {sceneNarrow ? (
            <line x1={20} x2={780} y1={330} y2={330} stroke={VIZ.grid} strokeWidth={2} />
          ) : (
            <line x1={400} x2={400} y1={20} y2={310} stroke={VIZ.grid} strokeWidth={2} />
          )}
        </Figure>
      </div>

      <div ref={graphRef}>
        <Figure viewBox={`0 0 800 ${graphH}`} label="Graf over temperaturen som funksjon av tiden for de to stoffene">
          <TempGraph runs={runs} m={m} P={P} T1={T1} t={t} tEnd={tEnd} height={graphH} />
        </Figure>
      </div>
      <Legend
        items={[
          ...runs.map((r) => ({ color: r.color, label: `${r.mat.name}, c = ${fmt(r.mat.c, 0)} J/(kg·K)` })),
          { color: VIZ.muted, label: `Ønsket temperatur ${fmt(T1, 0)} °C`, dashed: true },
        ]}
      />

      <Readouts>
        {runs.map((r, i) => (
          <TimeReadout key={`t${i}`} run={r} T1={T1} />
        ))}
        {runs.map((r, i) => (
          <Readout
            key={`s${i}`}
            label={`Stigning ΔT/Δt for ${r.mat.name.toLowerCase()}`}
            value={fmt(P / (r.mat.c * m), 2)}
            unit="K/s"
            tone={r.color}
          />
        ))}
      </Readouts>

      <Formula label="Tiden det tar å varme opp stoffene">
        <FormulaLine>Q = c · m · ΔT = P · t &nbsp;⇒&nbsp; t = c · m · ΔT / P</FormulaLine>
        {runs.map((r, i) => {
          const top = Number.isFinite(r.tDone) ? T1 : (r.mat.boil ?? T1);
          const time = Number.isFinite(r.tDone) ? r.tDone : r.tBoil;
          return (
            <FormulaLine key={i}>
              {r.mat.name}: t = {fmt(r.mat.c, 0)} J/(kg·K) · {fmt(m, 2)} kg · {fmt(top - T0, 0)} K / {fmt(P, 0)} W = {fmt(time, 0)} s
              {Number.isFinite(r.tDone) ? '' : ' (til kokepunktet)'}
            </FormulaLine>
          );
        })}
      </Formula>

      <Explain>{explanation(runs, m, P, T1)}</Explain>
    </VizLayout>
  );
}

function TimeReadout({ run, T1 }: { run: Run; T1: number }) {
  if (!Number.isFinite(run.tDone))
    return <Readout label={`${run.mat.name} når ikke ${fmt(T1, 0)} °C`} value="koker" unit={`ved ${fmt(run.mat.boil ?? 0, 0)} °C`} tone={run.color} />;
  return <Readout label={`Tid til ${fmt(T1, 0)} °C for ${run.mat.name.toLowerCase()}`} value={fmt(run.tDone, 0)} unit="s" tone={run.color} />;
}

/** Ett stoff på en varmeplate med termometer, tegnet i feltet x0 … x0 + w. */
function Station({ x0, w, run, m, P, t, T1 }: { x0: number; w: number; run: Run; m: number; P: number; t: number; T1: number }) {
  const f = useTextScale();
  const T = tempAt(run, m, P, t);
  const st = heating(run.mat, m, P, T0, Math.min(t, run.tDone));
  const on = t < run.tDone;
  const liquid = run.mat.boil !== undefined;
  const cx = x0 + w / 2;
  const vx = x0 + 0.4 * w;
  const top = 110;
  const bottom = 250;
  const halfW = Math.min(0.2 * w, 150);
  const blockW = 1.6 * halfW;
  // Litt lavere væskenivå når noe har fordampet
  const level = top + 22 + (st.evaporated / m) * (bottom - top - 22);
  const thermoX = x0 + 0.78 * w;
  const ticks = (f > 1.3 ? [0, 50, 100] : [0, 20, 40, 60, 80, 100]).map((v) => ({ value: v, label: fmt(v, 0) }));
  return (
    <g>
      <Tag x={cx} y={30} color={run.color} weight={700}>
        {run.mat.name}
      </Tag>
      <Tag x={cx} y={30 + 24 * f} muted>
        c = {fmt(run.mat.c, 0)} J/(kg·K)
      </Tag>

      {liquid ? (
        <>
          <rect x={vx - halfW + 3} y={level} width={2 * halfW - 6} height={bottom - level - 3} rx={4} fill={run.color} opacity={0.22} />
          <path d={`M ${vx - halfW} ${top} V ${bottom} H ${vx + halfW} V ${top}`} fill="none" stroke={VIZ.muted} strokeWidth={3} strokeLinejoin="round" />
          {st.boiling &&
            [0, 1, 2, 3, 4, 5].map((k) => {
              const phase = (t * 1.3 + k * 0.37) % 1;
              return (
                <circle
                  key={k}
                  cx={vx - halfW * 0.65 + k * halfW * 0.26}
                  cy={bottom - 12 - phase * (bottom - level - 24)}
                  r={4 + (k % 3)}
                  fill="none"
                  stroke={run.color}
                  strokeWidth={2}
                />
              );
            })}
        </>
      ) : (
        <rect x={vx - blockW / 2} y={bottom - 104} width={blockW} height={104} rx={6} fill={VIZ.bodyStrong} className="viz-block" />
      )}
      <Tag x={vx} y={liquid ? level + 52 : bottom - 58} weight={700} size={24 * f}>
        {fmt(T, 1)} °C
      </Tag>
      <Tag x={vx} y={liquid ? level + 52 + 26 * f : bottom - 58 + 26 * f} muted>
        Q = {fmt(st.Q / 1000, 1)} kJ
      </Tag>

      {/* Varmeplate */}
      <rect x={vx - halfW - 14} y={bottom + 4} width={2 * halfW + 28} height={14} rx={4} fill={VIZ.bodyStrong} className="viz-block" />
      {on && <rect x={vx - halfW - 8} y={bottom + 4} width={2 * halfW + 16} height={4} rx={2} fill={VIZ.series[4]} />}
      <Tag x={vx} y={bottom + 20 + 22 * f} muted>
        {on ? `P = ${fmt(P, 0)} W` : 'slått av'}
      </Tag>

      <Thermometer x={thermoX} yTop={top} yBottom={bottom - 20} min={0} max={100} value={T} color={run.color} right={ticks} marker={T1} />
    </g>
  );
}

function TempGraph({ runs, m, P, T1, t, tEnd, height }: { runs: Run[]; m: number; P: number; T1: number; t: number; tEnd: number; height: number }) {
  const f = useTextScale();
  return (
    <Plot
      x={{ min: 0, max: tEnd, label: 'Tid t (s)', ticks: niceTicks(0, tEnd, f > 1.3 ? 4 : 6) }}
      y={{ min: 0, max: 110, label: 'Temperatur (°C)', ticks: [0, 20, 40, 60, 80, 100] }}
      width={800}
      height={height}
    >
      {({ sx, sy, x0, x1, y0 }) => {
        // Etiketter for når stoffene er ferdige, nede ved tidsaksen. Flytt den ene opp hvis de er for nær hverandre.
        const doneX = runs.map((r) => (Number.isFinite(r.tDone) ? sx(r.tDone) : NaN));
        const close = Math.abs((doneX[0] ?? 0) - (doneX[1] ?? 0)) < 80 * f;
        return (
          <g>
            <line x1={x0} x2={x1} y1={sy(T1)} y2={sy(T1)} stroke={VIZ.muted} strokeWidth={1.5} strokeDasharray="6 5" />
            <Tag x={x0 + 8} y={sy(T1) - 10} anchor="start" muted>
              {fmt(T1, 0)} °C
            </Tag>
            {runs.map((r, i) => {
              const pts: [number, number][] = [];
              const stop = Number.isFinite(r.tDone) ? r.tDone : tEnd;
              const kink = Math.min(stop, r.tBoil);
              pts.push([0, T0], [kink, tempAt(r, m, P, kink)]);
              if (stop > kink) pts.push([stop, tempAt(r, m, P, stop)]);
              const x = doneX[i] ?? NaN;
              const later = i === 1 ? (doneX[1] ?? 0) >= (doneX[0] ?? 0) : (doneX[0] ?? 0) > (doneX[1] ?? 0);
              const labelY = y0 - 10 - (close && later ? 28 * f : 0);
              return (
                <g key={i}>
                  <path d={linePath(pts, sx, sy)} fill="none" stroke={r.color} strokeWidth={3.5} strokeLinejoin="round" strokeLinecap="round" />
                  {Number.isFinite(x) && (
                    <>
                      <line x1={x} x2={x} y1={sy(T1)} y2={y0} className="viz-guide" />
                      <ColorDot x={x} y={sy(T1)} r={6} color={r.color} />
                      <Tag x={x > x1 - 90 * f ? x - 8 : x + 8} y={labelY} anchor={x > x1 - 90 * f ? 'end' : 'start'} color={r.color}>
                        {fmt(r.tDone, 0)} s
                      </Tag>
                    </>
                  )}
                  {!Number.isFinite(r.tDone) && r.mat.boil !== undefined && (
                    <Tag x={x1 - 8} y={sy(r.mat.boil) - 12} anchor="end" color={r.color}>
                      koker ved {fmt(r.mat.boil, 0)} °C
                    </Tag>
                  )}
                </g>
              );
            })}
            {/* Tiden nå */}
            <line x1={sx(t)} x2={sx(t)} y1={y0} y2={sy(105)} stroke={VIZ.ink} strokeWidth={1.5} opacity={0.5} />
            {runs.map((r, i) => (
              <ColorDot key={i} x={sx(t)} y={sy(tempAt(r, m, P, t))} r={8} color={r.color} />
            ))}
          </g>
        );
      }}
    </Plot>
  );
}

function explanation(runs: Run[], m: number, P: number, T1: number): ReactNode {
  const [a, b] = runs as [Run, Run];
  const same = a.mat.id === b.mat.id;
  const [hi, lo] = a.mat.c >= b.mat.c ? [a, b] : [b, a];
  const ratio = hi.mat.c / lo.mat.c;
  const boiling = runs.filter((r) => !Number.isFinite(r.tDone));
  const waterAt100 = runs.some((r) => r.mat.id === 'vann') && T1 >= 100;
  const water = runs.some((r) => r.mat.id === 'vann');

  const main = same ? (
    <p>
      <strong>Samme stoff, samme kurve.</strong> Med samme c, masse og effekt stiger temperaturen like fort, {fmt(P / (a.mat.c * m), 2)} K
      hvert sekund. Velg et annet stoff for å sammenligne.
    </p>
  ) : (
    <p>
      <strong>Samme energi, ulik temperaturøkning.</strong> Begge får like mye energi hvert sekund (P = {fmt(P, 0)} W) og har samme
      masse. {hi.mat.name} har {fmt(ratio, 1)} ganger så stor spesifikk varmekapasitet som {lo.mat.name.toLowerCase()}, altså trengs{' '}
      {fmt(ratio, 1)} ganger så mye energi for hver kelvin, og temperaturen stiger {fmt(ratio, 1)} ganger så langsomt. Stigningstallet i
      grafen er ΔT/Δt = P/(c·m).
    </p>
  );

  let extra: ReactNode = null;
  if (boiling.length > 0) {
    const r = boiling[0]!;
    extra = (
      <p>
        {r.mat.name} koker ved {fmt(r.mat.boil ?? 0, 0)} °C. Da går all tilført energi med til å fordampe væsken, og temperaturen
        står stille selv om vi varmer videre. Den kommer derfor aldri opp i {fmt(T1, 0)} °C.
      </p>
    );
  } else if (waterAt100) {
    extra = <p>Ved 100 °C begynner vannet å koke. Varmer vi videre, går energien med til å fordampe vannet, og temperaturen stiger ikke mer.</p>;
  } else if (water) {
    extra = (
      <p>
        Den store varmekapasiteten er grunnen til at vann brukes i radiatorer og kjølesystemer: vannet kan ta opp og frakte mye
        energi uten at temperaturen endrer seg mye.
      </p>
    );
  }
  return (
    <>
      {main}
      {extra}
    </>
  );
}
