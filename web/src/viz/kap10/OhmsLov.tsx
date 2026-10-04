import { useState, type ReactNode, type RefObject } from 'react';
import {
  Arrow,
  Controls,
  Dot,
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
  Toolbar,
  VIZ,
  VizLayout,
  fmt,
  fmtSci,
  linePath,
  sample,
  useTextScale,
} from '../kit';
import { LAMP, MATERIALS, blackbodyRgb, glowStrength, lampCurrent, lampResistance, lampTemperature, ohmCurrent, resistance } from './model';
import { EL, Select, Tag, textWidth, useNarrow } from './parts';

type Mode = 'motstand' | 'lampe' | 'resistivitet';
const MODES: { value: Mode; label: string }[] = [
  { value: 'motstand', label: 'Motstand' },
  { value: 'lampe', label: 'Glødelampe' },
  { value: 'resistivitet', label: 'Resistivitet' },
];

const U_MAX = 12;
const I_MAX = 3;
const RES_COLOR = VIZ.series[0];
const LAMP_COLOR = VIZ.series[1];

export default function OhmsLov() {
  const [mode, setMode] = useState<Mode>('motstand');
  const [U, setU] = useState(6);
  const [R, setR] = useState(8);
  const [mat, setMat] = useState('kobber');
  const [L, setL] = useState(10);
  const [A, setA] = useState(1.5);
  const [graphRef, narrow] = useNarrow<HTMLDivElement>();

  return (
    <VizLayout>
      <Toolbar>
        <Segmented label="Velg hva du vil utforske" options={MODES} value={mode} onChange={setMode} />
      </Toolbar>
      {mode === 'resistivitet' ? (
        <Resistivity mat={mat} setMat={setMat} L={L} setL={setL} A={A} setA={setA} narrow={narrow} graphRef={graphRef} />
      ) : (
        <OhmView mode={mode} U={U} setU={setU} R={R} setR={setR} narrow={narrow} graphRef={graphRef} />
      )}
    </VizLayout>
  );
}

/* ---------- Ohms lov: motstand og glødelampe ---------- */

function OhmView({
  mode,
  U,
  setU,
  R,
  setR,
  narrow,
  graphRef,
}: {
  mode: 'motstand' | 'lampe';
  U: number;
  setU: (v: number) => void;
  R: number;
  setR: (v: number) => void;
  narrow: boolean;
  graphRef: RefObject<HTMLDivElement | null>;
}) {
  const lamp = mode === 'lampe';
  const Rnow = lamp ? lampResistance(U) : R;
  const I = lamp ? lampCurrent(U) : ohmCurrent(U, R);
  const temp = lampTemperature(U);
  const plotH = narrow ? 460 : 360;

  return (
    <>
      <Controls>
        <Slider label="Spenning U" value={U} onChange={setU} min={0} max={U_MAX} step={0.5} unit="V" decimals={1} />
        {!lamp && <Slider label="Resistans R" value={R} onChange={setR} min={4} max={40} step={1} unit="Ω" />}
      </Controls>

      <Figure
        viewBox={`0 0 800 ${narrow ? 300 : 250}`}
        label={`Krets med batteri på ${fmt(U, 1)} V og ${lamp ? 'en glødelampe' : `en motstand på ${fmt(R, 0)} Ω`}. Amperemeteret viser ${fmt(I, 2)} A.`}
        maxHeight={300}
      >
        <CircuitDrawing U={U} I={I} R={Rnow} lamp={lamp} temp={temp} H={narrow ? 300 : 250} />
      </Figure>

      <div ref={graphRef}>
        <Figure viewBox={`0 0 800 ${plotH}`} label="Graf av spenningen U som funksjon av strømmen I for motstanden og glødelampa" maxHeight={460}>
          <Graph R={R} lamp={lamp} U={U} I={I} H={plotH} />
        </Figure>
      </div>
      <Legend
        items={[
          { color: RES_COLOR, label: `Motstand, R = ${fmt(R, 0)} Ω (ohmsk)`, dashed: lamp },
          { color: LAMP_COLOR, label: 'Glødelampe 12 V, 24 W (ikke ohmsk)', dashed: !lamp },
          ...(lamp ? [{ color: VIZ.muted, label: 'Linje fra origo: R = U/I', dashed: true }] : []),
        ]}
      />

      <Readouts>
        <Readout label="Spenning U" value={fmt(U, 1)} unit="V" tone={EL.voltage} />
        <Readout label="Strøm I" value={fmt(I, 2)} unit="A" tone={EL.current} />
        <Readout label="Resistans R = U/I" value={U > 0 ? fmt(Rnow, lamp ? 2 : 0) : lamp ? fmt(LAMP.R0, 2) : fmt(R, 0)} unit="Ω" />
        {lamp ? (
          <Readout label="Temperatur i glødetråden" value={fmt(Math.round(temp / 10) * 10, 0)} unit="°C" />
        ) : (
          <Readout label="Effekt P = U·I" value={fmt(U * I, 1)} unit="W" />
        )}
      </Readouts>

      <Formula label="Ohms lov med tallene">
        {lamp ? (
          <>
            <FormulaLine>
              R = U/I = {fmt(U, 1)} V / {fmt(I, 2)} A = {U > 0 ? fmt(Rnow, 2) : '–'} Ω
            </FormulaLine>
            <FormulaLine>
              Kald glødetråd: R<sub>0</sub> = {fmt(LAMP.R0, 2)} Ω, så R har økt {fmt(Rnow / LAMP.R0, 1)} ganger
            </FormulaLine>
          </>
        ) : (
          <>
            <FormulaLine>U = R·I</FormulaLine>
            <FormulaLine>
              I = U/R = {fmt(U, 1)} V / {fmt(R, 0)} Ω = {fmt(I, 2)} A
            </FormulaLine>
          </>
        )}
      </Formula>

      <Explain>{lamp ? lampExplanation(U, I, Rnow, temp) : resistorExplanation(U, R, I)}</Explain>
    </>
  );
}

function CircuitDrawing({ U, I, R, lamp, temp, H }: { U: number; I: number; R: number; lamp: boolean; temp: number; H: number }) {
  const f = useTextScale();
  const left = 120;
  const right = 680;
  const top = 34 + 22 * f;
  const bottom = H - 30;
  const mid = (top + bottom) / 2;
  const cx = 400;
  const wire = { stroke: VIZ.ink, strokeWidth: 2.5 };
  const [gr, gg, gb] = blackbodyRgb(temp + 273);
  const glow = glowStrength(temp);
  const vY = top + (bottom - top) * 0.55;

  return (
    <g>
      {/* Hovedkretsen */}
      <line x1={left} y1={top} x2={cx - 70} y2={top} {...wire} />
      <line x1={cx + 70} y1={top} x2={right} y2={top} {...wire} />
      <line x1={right} y1={top} x2={right} y2={mid - 26} {...wire} />
      <line x1={right} y1={mid + 26} x2={right} y2={bottom} {...wire} />
      <line x1={right} y1={bottom} x2={left} y2={bottom} {...wire} />
      <line x1={left} y1={bottom} x2={left} y2={mid + 12} {...wire} />
      <line x1={left} y1={mid - 12} x2={left} y2={top} {...wire} />

      {/* Batteri: lang strek er plusspolen */}
      <line x1={left - 30} y1={mid - 12} x2={left + 30} y2={mid - 12} stroke={VIZ.ink} strokeWidth={3} />
      <line x1={left - 15} y1={mid + 12} x2={left + 15} y2={mid + 12} stroke={VIZ.ink} strokeWidth={8} />
      <Tag x={left - 38} y={mid - 8} anchor="end" weight={700}>
        +
      </Tag>
      <Tag x={left - 38} y={mid + 22} anchor="end" weight={700}>
        −
      </Tag>
      <Tag x={left + 42} y={mid + 6} anchor="start" color={EL.voltage} weight={700}>
        U = {fmt(U, 1)} V
      </Tag>

      {/* Komponenten */}
      {lamp ? (
        <g>
          <line x1={cx - 70} y1={top} x2={cx - 26} y2={top} {...wire} />
          <line x1={cx + 26} y1={top} x2={cx + 70} y2={top} {...wire} />
          {glow > 0 && <circle cx={cx} cy={top} r={26 + 16 * glow} fill={`rgb(${gr}, ${gg}, ${gb})`} opacity={0.35 * glow} />}
          <circle cx={cx} cy={top} r={26} fill={glow > 0 ? `rgb(${gr}, ${gg}, ${gb})` : VIZ.surface} fillOpacity={glow > 0 ? 0.25 + 0.6 * glow : 1} stroke={VIZ.ink} strokeWidth={2.5} />
          <line x1={cx - 18} y1={top - 18} x2={cx + 18} y2={top + 18} stroke={VIZ.ink} strokeWidth={2} />
          <line x1={cx - 18} y1={top + 18} x2={cx + 18} y2={top - 18} stroke={VIZ.ink} strokeWidth={2} />
        </g>
      ) : (
        <g>
          <line x1={cx - 70} y1={top} x2={cx - 55} y2={top} {...wire} />
          <line x1={cx + 55} y1={top} x2={cx + 70} y2={top} {...wire} />
          <rect x={cx - 55} y={top - 17} width={110} height={34} rx={4} fill={VIZ.body} stroke={VIZ.ink} strokeWidth={2.5} />
        </g>
      )}
      <Tag x={cx + 80} y={top - 12} anchor="start" weight={700}>
        {lamp ? `lampe, R = ${U > 0 ? fmt(R, 1) : fmt(LAMP.R0, 1)} Ω` : `R = ${fmt(R, 0)} Ω`}
      </Tag>

      {/* Voltmeter parallelt over komponenten */}
      <line x1={cx - 70} y1={top} x2={cx - 70} y2={vY} stroke={VIZ.muted} strokeWidth={1.8} />
      <line x1={cx + 70} y1={top} x2={cx + 70} y2={vY} stroke={VIZ.muted} strokeWidth={1.8} />
      <line x1={cx - 70} y1={vY} x2={cx - 22} y2={vY} stroke={VIZ.muted} strokeWidth={1.8} />
      <line x1={cx + 22} y1={vY} x2={cx + 70} y2={vY} stroke={VIZ.muted} strokeWidth={1.8} />
      <circle cx={cx - 70} cy={top} r={4} fill={VIZ.ink} />
      <circle cx={cx + 70} cy={top} r={4} fill={VIZ.ink} />
      <Meter x={cx} y={vY} letter="V" />
      <Tag x={cx + 32} y={vY + 6 * f} anchor="start" color={EL.voltage} weight={700}>
        {fmt(U, 1)} V
      </Tag>

      {/* Amperemeter i serie */}
      <Meter x={right} y={mid} letter="A" />
      <Tag x={right - 34} y={mid + 6 * f} anchor="end" color={EL.current} weight={700}>
        {fmt(I, 2)} A
      </Tag>

      {I > 0.005 && <Arrow x1={left + 40} y1={top - 14} x2={left + 110} y2={top - 14} color={EL.current} width={2.5} head={10} />}
      {I > 0.005 && (
        <Tag x={left + 75} y={top - 24} anchor="middle" color={EL.current} weight={700}>
          I
        </Tag>
      )}
    </g>
  );
}

function Meter({ x, y, letter }: { x: number; y: number; letter: string }) {
  return (
    <g>
      <circle cx={x} cy={y} r={22} fill={VIZ.surface} stroke={VIZ.ink} strokeWidth={2.5} />
      <text x={x} y={y + 6} textAnchor="middle" className="viz-block-label is-strong" style={{ fontSize: 18 }}>
        {letter}
      </text>
    </g>
  );
}

function Graph({ R, lamp, U, I, H }: { R: number; lamp: boolean; U: number; I: number; H: number }) {
  const lampPts = sample((u) => lampCurrent(u), 0, U_MAX, 120).map(([u, i]) => [i, u] as [number, number]);
  const iEnd = Math.min(I_MAX, U_MAX / R);
  return (
    <Plot x={{ min: 0, max: I_MAX, label: 'Strøm I (A)', decimals: 1 }} y={{ min: 0, max: U_MAX, label: 'Spenning U (V)' }} width={800} height={H}>
      {({ sx, sy }) => (
        <g>
          <path
            d={linePath([[0, 0], [iEnd, R * iEnd]], sx, sy)}
            fill="none"
            stroke={RES_COLOR}
            strokeWidth={lamp ? 2 : 3.5}
            strokeDasharray={lamp ? '7 6' : undefined}
            opacity={lamp ? 0.6 : 1}
          />
          <path
            d={linePath(lampPts, sx, sy)}
            fill="none"
            stroke={LAMP_COLOR}
            strokeWidth={lamp ? 3.5 : 2}
            strokeDasharray={lamp ? undefined : '7 6'}
            opacity={lamp ? 1 : 0.6}
          />
          {lamp && U > 0 && (
            <path d={linePath([[0, 0], [I_MAX, (U / I) * I_MAX]], sx, sy)} className="viz-guide" />
          )}
          <SlopeTag R={R} lamp={lamp} U={U} I={I} sx={sx} sy={sy} />
          <Dot x={sx(I)} y={sy(U)} color={lamp ? LAMP_COLOR : RES_COLOR} />
        </g>
      )}
    </Plot>
  );
}

function SlopeTag({ R, lamp, U, I, sx, sy }: { R: number; lamp: boolean; U: number; I: number; sx: (v: number) => number; sy: (v: number) => number }) {
  const f = useTextScale();
  if (lamp) {
    if (!(U > 0)) return null;
    const text = `R = U/I = ${fmt(U / I, 1)} Ω`;
    const x = sx(I) + 14;
    const w = textWidth(text.length, f);
    const right = x + w < sx(I_MAX);
    return (
      <Tag x={right ? x : sx(I) - 14} y={sy(U) + (right ? 22 * f : -14)} anchor={right ? 'start' : 'end'} color={LAMP_COLOR} weight={650}>
        {text}
      </Tag>
    );
  }
  // Etiketten for stigningstallet midt på linjen, litt til høyre for den.
  const iMid = Math.min(I_MAX, 12 / R) * 0.5;
  const text = `stigningstall R = ${fmt(R, 0)} Ω`;
  return (
    <Tag x={sx(iMid) + 16} y={sy(R * iMid) + 8} anchor="start" color={RES_COLOR} weight={650}>
      {text}
    </Tag>
  );
}

function resistorExplanation(U: number, R: number, I: number): ReactNode {
  if (U === 0)
    return (
      <p>
        <strong>Ingen spenning, ingen strøm.</strong> Spenningen er det som driver strømmen gjennom motstanden. Skru opp U og se at
        strømmen øker i samme takt.
      </p>
    );
  return (
    <p>
      <strong>Ohms lov: U = R·I.</strong> For en ohmsk motstand er R konstant, så grafen for U som funksjon av I er en rett linje gjennom
      origo med stigningstall R = {fmt(R, 0)} Ω. Dobler du spenningen, dobles strømmen. Nå driver {fmt(U, 1)} V en strøm på {fmt(I, 2)} A
      gjennom motstanden. {R >= 20 ? 'Stor resistans gir liten strøm og en bratt linje.' : 'Prøv en større resistans: da blir strømmen mindre og linjen brattere.'}
    </p>
  );
}

function lampExplanation(U: number, I: number, R: number, temp: number): ReactNode {
  if (U === 0)
    return (
      <p>
        <strong>Lampa er kald.</strong> Den kalde glødetråden har bare R<sub>0</sub> = {fmt(LAMP.R0, 2)} Ω. Skru opp spenningen og se hva
        som skjer med resistansen når tråden blir varm.
      </p>
    );
  return (
    <p>
      <strong>Glødelampa er ikke ohmsk.</strong> Strømmen varmer opp glødetråden til ca. {fmt(Math.round(temp / 10) * 10, 0)} °C, og
      resistansen i et metall øker med temperaturen. R = U/I har derfor økt fra {fmt(LAMP.R0, 2)} Ω (kald) til {fmt(R, 2)} Ω. Grafen
      krummer oppover og er ingen rett linje, så Ohms lov med konstant R gjelder ikke. Men R = U/I gjelder fortsatt som definisjon av
      resistansen i hvert punkt. {I > 0 && temp < 800 ? 'Tråden er ennå ikke varm nok til å gløde synlig.' : ''}
    </p>
  );
}

/* ---------- Resistivitet: R = ρL/A ---------- */

function Resistivity({
  mat,
  setMat,
  L,
  setL,
  A,
  setA,
  narrow,
  graphRef,
}: {
  mat: string;
  setMat: (v: string) => void;
  L: number;
  setL: (v: number) => void;
  A: number;
  setA: (v: number) => void;
  narrow: boolean;
  graphRef: RefObject<HTMLDivElement | null>;
}) {
  const m = MATERIALS.find((x) => x.id === mat) ?? MATERIALS[0]!;
  const R = resistance(m.rho, L, A);
  const barsH = narrow ? 70 + MATERIALS.length * 66 : 40 + MATERIALS.length * 40;

  return (
    <>
      <Toolbar>
        <Select label="Materiale" value={m.id} options={MATERIALS.map((x) => ({ value: x.id, label: x.name }))} onChange={setMat} />
      </Toolbar>
      <Controls>
        <Slider label="Lengde L" value={L} onChange={setL} min={0.5} max={20} step={0.5} unit="m" decimals={1} />
        <Slider label="Tverrsnitt A" value={A} onChange={setA} min={0.25} max={4} step={0.25} unit="mm²" decimals={2} />
      </Controls>

      <Figure viewBox={`0 0 800 ${narrow ? 230 : 180}`} label={`Ledning av ${m.name.toLowerCase()}, ${fmt(L, 1)} m lang med tverrsnitt ${fmt(A, 2)} mm².`} maxHeight={240}>
        <WireDrawing L={L} A={A} R={R} name={m.name} />
      </Figure>

      <div ref={graphRef}>
        <Figure viewBox={`0 0 800 ${barsH}`} label="Resistansen for samme ledning laget av ulike materialer" maxHeight={480}>
          <MaterialBars L={L} A={A} selected={m.id} narrow={narrow} />
        </Figure>
      </div>

      <Readouts>
        <Readout label="Resistivitet ρ" value={fmtSci(m.rho, 1)} unit="Ω·m" />
        <Readout label="Resistans R" value={fmtR(R)} unit="Ω" tone={RES_COLOR} />
        <Readout label="Strøm ved 1,5 V" value={fmtI(1.5 / R)} unit="A" tone={EL.current} />
      </Readouts>

      <Formula label="Resistansen til ledningen">
        <FormulaLine>
          R = ρ·L/A = {fmtSci(m.rho, 1)} Ω·m · {fmt(L, 1)} m / {fmtSci(A * 1e-6, 2)} m² = {fmtR(R)} Ω
        </FormulaLine>
      </Formula>

      <Explain>
        <p>
          <strong>R = ρL/A.</strong> Resistansen er proporsjonal med lengden og omvendt proporsjonal med tverrsnittet: dobbelt så lang
          ledning gir dobbelt så stor R, og dobbelt så stort tverrsnitt gir halvparten. Elektronene må gjennom mer materiale i en lang
          ledning, men har flere veier å gå i en tykk. {m.name} har ρ = {fmtSci(m.rho, 1)} Ω·m og {m.use}.
        </p>
      </Explain>
    </>
  );
}

const fmtR = (R: number) => (R < 0.1 ? fmt(R, 4) : R < 10 ? fmt(R, 3) : fmt(R, 1));
const fmtI = (I: number) => (I >= 100 ? fmt(I, 0) : I >= 1 ? fmt(I, 1) : fmt(I, 3));

function WireDrawing({ L, A, R, name }: { L: number; A: number; R: number; name: string }) {
  const f = useTextScale();
  const x0 = 60;
  const len = 40 + (L / 20) * 640;
  const d = 10 * Math.sqrt(A / 0.25);
  const cy = 30 + 24 * f + 40;
  return (
    <g>
      <rect x={x0} y={cy - d / 2} width={len} height={d} rx={d / 2} fill={VIZ.bodyStrong} className="viz-block" />
      <ellipse cx={x0 + d * 0.3} cy={cy} rx={d * 0.3} ry={d / 2} fill={VIZ.body} className="viz-block" />
      <Tag x={x0} y={30 + 6 * f} anchor="start" weight={700}>
        {name}, R = {fmtR(R)} Ω
      </Tag>
      {/* Målestrek for lengden */}
      <line x1={x0} y1={cy + 40} x2={x0 + len} y2={cy + 40} stroke={VIZ.muted} strokeWidth={1.5} />
      <line x1={x0} y1={cy + 32} x2={x0} y2={cy + 48} stroke={VIZ.muted} strokeWidth={1.5} />
      <line x1={x0 + len} y1={cy + 32} x2={x0 + len} y2={cy + 48} stroke={VIZ.muted} strokeWidth={1.5} />
      <Tag x={x0 + len / 2} y={cy + 40 + 24 * f} anchor="middle" muted>
        L = {fmt(L, 1)} m
      </Tag>
      <Tag x={Math.min(x0 + len + 14, 790)} y={cy + 6 * f} anchor={x0 + len + 14 + textWidth(12, f) > 800 ? 'end' : 'start'} muted>
        A = {fmt(A, 2)} mm²
      </Tag>
    </g>
  );
}

function MaterialBars({ L, A, selected, narrow }: { L: number; A: number; selected: string; narrow: boolean }) {
  const f = useTextScale();
  const values = MATERIALS.map((m) => resistance(m.rho, L, A));
  const max = Math.max(...values);
  const labelW = narrow ? 0 : textWidth(11, f) + 20;
  const x0 = 20 + labelW;
  const valueW = textWidth(9, f);
  const x1 = 800 - 20 - valueW;
  const rowH = narrow ? 66 : 40;
  return (
    <g>
      <Tag x={20} y={22 * f} anchor="start" muted>
        Samme ledning ({fmt(L, 1)} m, {fmt(A, 2)} mm²) av ulike materialer
      </Tag>
      {MATERIALS.map((m, k) => {
        const y = (narrow ? 60 : 40) + k * rowH;
        const w = Math.max(2, ((values[k] ?? 0) / max) * (x1 - x0));
        const on = m.id === selected;
        const barY = narrow ? y + 14 : y;
        return (
          <g key={m.id}>
            <Tag x={narrow ? 20 : x0 - 12} y={narrow ? y + 6 : y + 16} anchor={narrow ? 'start' : 'end'} weight={on ? 750 : 560} muted={!on}>
              {m.name}
            </Tag>
            <rect x={x0} y={barY} width={w} height={22} rx={4} fill={RES_COLOR} fillOpacity={on ? 0.85 : 0.3} />
            <Tag x={x0 + w + 10} y={barY + 17} anchor="start" weight={on ? 750 : 560} muted={!on}>
              {fmtR(values[k] ?? 0)} Ω
            </Tag>
          </g>
        );
      })}
    </g>
  );
}
