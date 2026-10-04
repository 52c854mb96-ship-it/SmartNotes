import { useId, useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import {
  Controls,
  Explain,
  Figure,
  Formula,
  FormulaLine,
  G_EARTH,
  Legend,
  Plot,
  Readout,
  Readouts,
  Slider,
  Sub,
  TSub,
  Toggle,
  Toolbar,
  VIZ,
  VizLayout,
  fmt,
  linePath,
  sample,
  useTextScale,
} from '../kit';
import { eulerFall, exactVelocity, maxVelocityError, niceRange, terminalVelocity, type DragFall, type EulerRow } from './model';
import { useNarrow } from './useNarrow';
import { ColorDot, Label } from './marks';

const C_EXACT = VIZ.velocity;
// Ikke oransje: den fargen er tyngden (fritt fall-linja).
const C_EULER = VIZ.series[0];
const TABLE_ROWS = 6;
const DT_MIN = 0.1;
const DT_MAX = 2.5;

/** Desimaler på strekningen s (små tidssteg gir små tall i de første stegene). */
const sDecimals = (dt: number): number => (dt < 0.5 ? 3 : 1);

/** Hvor lenge vi simulerer: omtrent til farten har nådd terminalfarten, avrundet til hele 5 s. */
function simTime(vT: number): number {
  return Math.min(40, Math.max(10, Math.ceil((3.2 * vT) / G_EARTH / 5) * 5));
}

export default function Simulering() {
  const [m, setM] = useState(80);
  const [k, setK] = useState(0.25);
  const [dt, setDt] = useState(1);
  const [free, setFree] = useState(false);
  const { ref, narrow } = useNarrow();

  const p: DragFall = { m, k };
  const vT = terminalVelocity(p);
  const tEnd = simTime(vT);
  const rows = useMemo(() => eulerFall({ m, k }, dt, tEnd), [m, k, dt, tEnd]);
  const err = maxVelocityError(p, rows);
  const overshoot = rows.some((r) => r.v > vT * 1.001);
  const errorCurve = useMemo(() => {
    const pts: [number, number][] = [];
    for (let d = DT_MIN; d <= DT_MAX + 1e-9; d += 0.05) pts.push([d, maxVelocityError({ m, k }, eulerFall({ m, k }, d, tEnd))]);
    return pts;
  }, [m, k, tEnd]);
  const step = rows[1];
  const next = rows[2];
  const sDec = sDecimals(dt);

  return (
    <VizLayout>
      <Controls>
        <Slider label="Tidssteg Δt" value={dt} onChange={setDt} min={DT_MIN} max={DT_MAX} step={0.1} unit="s" decimals={1} />
        <Slider label="Luftmotstandstall k" value={k} onChange={setK} min={0.1} max={0.5} step={0.01} unit="kg/m" decimals={2} />
        <Slider label="Masse m" value={m} onChange={setM} min={50} max={120} step={1} unit="kg" decimals={0} />
      </Controls>
      <Toolbar>
        <Toggle label="Vis fritt fall uten luftmotstand" checked={free} onChange={setFree} />
      </Toolbar>

      <div ref={ref}>
        <Figure
          viewBox={`0 0 800 ${narrow ? 560 : 400}`}
          label={`Fart-tid-graf for et fall med luftmotstand. Eulers metode med tidssteg ${fmt(dt, 1)} s sammenlignet med den eksakte løsningen. Terminalfarten er ${fmt(vT, 1)} m/s.`}
          maxHeight={narrow ? 600 : 440}
        >
          <VelocityPlot p={p} rows={rows} tEnd={tEnd} vT={vT} free={free} height={narrow ? 560 : 400} />
        </Figure>
      </div>
      <Legend
        items={[
          {
            color: C_EXACT,
            label: (
              <span>
                Eksakt løsning v = v<Sub>T</Sub> · tanh(gt/v<Sub>T</Sub>)
              </span>
            ),
          },
          { color: C_EULER, label: `Eulers metode, Δt = ${fmt(dt, 1)} s` },
          { color: VIZ.muted, label: 'Terminalfart', dashed: true },
          ...(free ? [{ color: VIZ.gravity, label: 'Uten luftmotstand: v = gt', dashed: true }] : []),
        ]}
      />

      <StepTable rows={rows.slice(0, TABLE_ROWS)} p={p} dt={dt} />

      <Figure viewBox={`0 0 800 ${narrow ? 400 : 260}`} label="Største avvik mellom Euler og eksakt løsning som funksjon av tidssteget." maxHeight={narrow ? 440 : 300}>
        <ErrorPlot curve={errorCurve} dt={dt} err={err} height={narrow ? 400 : 260} />
      </Figure>

      <Readouts>
        <Readout
          label={
            <>
              Terminalfart v<Sub>T</Sub> = √(mg/k)
            </>
          }
          value={fmt(vT, 1)}
          unit="m/s"
          tone={C_EXACT}
        />
        <Readout label={`Antall steg til t = ${fmt(tEnd, 0)} s`} value={fmt(rows.length - 1, 0)} />
        <Readout label="Største avvik i farten" value={fmt(err, 2)} unit="m/s" tone={C_EULER} />
      </Readouts>

      {step && next && (
        <Formula label="Ett steg i Eulers metode med tall">
          <FormulaLine>
            a = g − (k/m) · v² = 9,81 − ({fmt(k, 2)}/{fmt(m, 0)}) · {fmt(step.v, 2)}² = {fmt(step.a, 2)} m/s²
          </FormulaLine>
          <FormulaLine>
            v = v + a · Δt = {fmt(step.v, 2)} + {fmt(step.a, 2)} · {fmt(dt, 1)} = {fmt(next.v, 2)} m/s
          </FormulaLine>
          <FormulaLine>
            s = s + v · Δt = {fmt(step.s, sDec)} + {fmt(next.v, 2)} · {fmt(dt, 1)} = {fmt(next.s, sDec)} m
          </FormulaLine>
        </Formula>
      )}

      <Explain>{explanation(dt, err, vT, overshoot)}</Explain>
    </VizLayout>
  );
}

/* ---------- v-t-graf ---------- */

function VelocityPlot({ p, rows, tEnd, vT, free, height }: { p: DragFall; rows: EulerRow[]; tEnd: number; vT: number; free: boolean; height: number }) {
  const f = useTextScale();
  const vPeak = Math.max(vT, ...rows.map((r) => r.v));
  const [, vMax] = niceRange(0, Math.min(vPeak, vT * 1.6) * 1.12, 5, 5);
  const clip = `${useId().replace(/[^a-zA-Z0-9_-]/g, '')}-clip`;
  return (
    <Plot x={{ min: 0, max: tEnd, label: 'Tid t (s)' }} y={{ min: 0, max: vMax, label: 'v (m/s)' }} width={800} height={height}>
      {({ sx, sy, x0, x1, y0, y1 }) => (
        <g>
          <clipPath id={clip}>
            <rect x={x0} y={y1 - 8} width={x1 - x0 + 8} height={y0 - y1 + 16} />
          </clipPath>
          <line x1={x0} x2={x1} y1={sy(vT)} y2={sy(vT)} stroke={VIZ.muted} strokeWidth={2} strokeDasharray="8 6" />
          {/* Til høyre over linja, høyt nok til at den senkede T-en ikke treffer Euler-punktene som ligger på linja */}
          <Label x={x1 - 6} y={sy(vT) - 16 * f} anchor="end" muted>
            v<TSub>T</TSub> = {fmt(vT, 1)} m/s
          </Label>
          <g clipPath={`url(#${clip})`}>
            {free && <line x1={sx(0)} y1={sy(0)} x2={sx(tEnd)} y2={sy(G_EARTH * tEnd)} stroke={VIZ.gravity} strokeWidth={2} strokeDasharray="6 6" />}
            <path d={linePath(sample((t) => exactVelocity(p, t), 0, tEnd, 200), sx, sy)} fill="none" stroke={C_EXACT} strokeWidth={3} />
            <path d={linePath(rows.map((r) => [r.t, r.v]), sx, sy)} fill="none" stroke={C_EULER} strokeWidth={2} />
            {/* Med veldig mange steg blir punktene en tett rekke, så da vises bare linja */}
            {rows.length <= 80 && rows.map((r) => <ColorDot key={r.n} x={sx(r.t)} y={sy(r.v)} r={rows.length > 40 ? 4 : 5.5} color={C_EULER} />)}
          </g>
        </g>
      )}
    </Plot>
  );
}

/* ---------- Feil mot tidssteg ---------- */

function ErrorPlot({ curve, dt, err, height }: { curve: [number, number][]; dt: number; err: number; height: number }) {
  const f = useTextScale();
  const peak = Math.max(...curve.map(([, e]) => e), 0.1);
  const [, yMax] = niceRange(0, peak * 1.05, 4, 0.5);
  return (
    <Plot
      x={{ min: 0, max: DT_MAX, label: 'Tidssteg Δt (s)', decimals: 1, ticks: [0, 0.5, 1, 1.5, 2, 2.5] }}
      y={{ min: 0, max: yMax, label: 'Avvik (m/s)', decimals: yMax < 2 ? 1 : 0 }}
      width={800}
      height={height}
      margin={{ top: 34 * f, right: 24 * f, bottom: 56 * f, left: 72 * f }}
    >
      {({ sx, sy, x0, y1 }) => (
        <g>
          <Label x={x0} y={y1 - 12} anchor="start" muted>
            Største avvik fra den eksakte farten
          </Label>
          <path d={linePath(curve, sx, sy)} fill="none" stroke={C_EULER} strokeWidth={3} />
          <ColorDot x={sx(dt)} y={sy(err)} color={C_EULER} />
        </g>
      )}
    </Plot>
  );
}

/* ---------- Tabell ---------- */

const cell: CSSProperties = { padding: '6px 4px 6px 10px', textAlign: 'right', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' };
const head: CSSProperties = { ...cell, color: 'var(--text-2)', fontWeight: 600 };

function StepTable({ rows, p, dt }: { rows: EulerRow[]; p: DragFall; dt: number }) {
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14, fontVariantNumeric: 'tabular-nums', color: 'var(--text)' }}>
        <caption style={{ captionSide: 'top', textAlign: 'left', padding: '0 0 8px', fontSize: 14, color: 'var(--text-2)', fontWeight: 600 }}>
          De første stegene med Δt = {fmt(dt, 1)} s
        </caption>
        <thead>
          <tr>
            <th style={head}>t (s)</th>
            <th style={{ ...head, color: C_EULER }}>v (m/s)</th>
            <th style={{ ...head, color: C_EXACT }}>v eksakt</th>
            <th style={head}>a (m/s²)</th>
            <th style={head}>s (m)</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.n} style={r.n === 1 ? { background: 'var(--surface-2)' } : undefined}>
              <td style={cell}>{fmt(r.t, 1)}</td>
              <td style={cell}>{fmt(r.v, 2)}</td>
              <td style={{ ...cell, color: 'var(--text-2)' }}>{fmt(exactVelocity(p, r.t), 2)}</td>
              <td style={cell}>{fmt(r.a, 2)}</td>
              <td style={cell}>{fmt(r.s, sDecimals(dt))}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ---------- Forklaring ---------- */

function explanation(dt: number, err: number, vT: number, overshoot: boolean): ReactNode {
  const rel = err / vT;
  let accuracy: ReactNode;
  if (overshoot)
    accuracy = (
      <>
        Med Δt = {fmt(dt, 1)} s er tidssteget så stort at simuleringen <strong>skyter over terminalfarten</strong> og svinger rundt den før den
        roer seg. Gjør Δt mindre, så forsvinner svingningene.
      </>
    );
  else if (rel < 0.01)
    accuracy = (
      <>
        Med Δt = {fmt(dt, 1)} s ligger punktene nesten oppå den eksakte kurven: største avvik er bare {fmt(err, 2)} m/s. Prisen er mange steg å
        regne, men det gjør datamaskinen raskt.
      </>
    );
  else
    accuracy = (
      <>
        Punktene ligger <strong>over</strong> den eksakte kurven fordi akselerasjonen i starten av hvert steg er større enn gjennomsnittet i
        steget. Halverer du Δt, blir avviket omtrent halvparten så stort (nå {fmt(err, 1)} m/s).
      </>
    );
  return (
    <>
      <p>
        <strong>Eulers metode</strong> regner ut akselerasjonen a = g − (k/m)v² fra farten nå og later som den er konstant i et helt tidssteg:
        først blir v = v + a·Δt, så blir s = s + v·Δt. {accuracy}
      </p>
      <p>
        Tenk deg en fallskjermhopper før skjermen er utløst. Etter hvert som farten øker, nærmer luftmotstanden L = kv² seg tyngden G, så
        akselerasjonen går mot null og farten mot terminalfarten v<Sub>T</Sub> = √(mg/k) = {fmt(vT, 1)} m/s, der L = G.
      </p>
    </>
  );
}
