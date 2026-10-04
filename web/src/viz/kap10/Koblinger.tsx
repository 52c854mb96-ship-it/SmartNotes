import { useState, type ReactNode } from 'react';
import {
  Arrow,
  Controls,
  Explain,
  Figure,
  Formula,
  FormulaLine,
  Readout,
  Readouts,
  Segmented,
  Slider,
  Sub,
  TSub,
  Toggle,
  Toolbar,
  VIZ,
  VizLayout,
  fmt,
  useTextScale,
} from '../kit';
import { parallelCircuit, seriesCircuit, type Circuit } from './model';
import { EL, Tag, textWidth, useNarrow } from './parts';

type Kind = 'serie' | 'parallell';
const KINDS: { value: Kind; label: string }[] = [
  { value: 'serie', label: 'Seriekobling' },
  { value: 'parallell', label: 'Parallellkobling' },
];

const fU = (v: number) => fmt(v, v >= 100 ? 0 : v >= 10 ? 1 : 2);
const fI = (v: number) => fmt(v, v >= 10 ? 1 : v >= 1 ? 2 : 3);
const fR = (v: number) => fmt(v, v >= 100 ? 0 : v >= 10 ? 1 : 2);

export default function Koblinger() {
  const [kind, setKind] = useState<Kind>('serie');
  const [three, setThree] = useState(true);
  const [U, setU] = useState(12);
  const [R1, setR1] = useState(10);
  const [R2, setR2] = useState(20);
  const [R3, setR3] = useState(30);
  const Rs = three ? [R1, R2, R3] : [R1, R2];
  const c = kind === 'serie' ? seriesCircuit(Rs, U) : parallelCircuit(Rs, U);
  const [wrapRef, narrow] = useNarrow<HTMLDivElement>();
  const W = narrow ? 560 : 800;
  const n = Rs.length;
  const schemH = kind === 'serie' ? 250 : narrow ? 90 + n * 96 : 80 + n * 84;

  const rSlider = (k: number, value: number, set: (v: number) => void) => (
    <Slider
      key={k}
      label={
        <>
          Resistans R<Sub>{k}</Sub>
        </>
      }
      ariaLabel={`Resistans R${k}`}
      value={value}
      onChange={set}
      min={1}
      max={100}
      step={1}
      unit="Ω"
    />
  );

  return (
    <VizLayout>
      <Toolbar>
        <Segmented label="Velg kobling" options={KINDS} value={kind} onChange={setKind} />
        <Toggle label="Tre motstander" checked={three} onChange={setThree} />
      </Toolbar>
      <Controls>
        <Slider label="Spenning U" value={U} onChange={setU} min={0} max={24} step={0.5} unit="V" decimals={1} />
        {rSlider(1, R1, setR1)}
        {rSlider(2, R2, setR2)}
        {three && rSlider(3, R3, setR3)}
      </Controls>

      <div ref={wrapRef}>
        <Figure
          viewBox={`0 0 ${W} ${schemH}`}
          label={`${kind === 'serie' ? 'Seriekobling' : 'Parallellkobling'} av ${n} motstander på ${Rs.map((r) => `${r} Ω`).join(', ')} over ${fmt(U, 1)} V.`}
          maxHeight={420}
        >
          {kind === 'serie' ? <SeriesDrawing Rs={Rs} c={c} U={U} W={W} H={schemH} /> : <ParallelDrawing Rs={Rs} c={c} U={U} W={W} H={schemH} />}
        </Figure>
      </div>

      <Figure viewBox={`0 0 ${W} 190`} label="Hvordan spenningen og strømmen fordeler seg på motstandene" maxHeight={240}>
        <Bars kind={kind} c={c} U={U} W={W} />
      </Figure>

      <Readouts>
        <Readout label="Total resistans R" value={fR(c.Rtot)} unit="Ω" />
        <Readout label="Strøm fra batteriet I" value={fI(c.I)} unit="A" tone={EL.current} />
        {kind === 'serie' ? (
          <Readout label={sumLabel('U', n)} value={fU(c.U.reduce((s, v) => s + v, 0))} unit="V" tone={EL.voltage} />
        ) : (
          <Readout label={sumLabel('I', n)} value={fI(c.Ik.reduce((s, v) => s + v, 0))} unit="A" tone={EL.current} />
        )}
      </Readouts>

      <Formula label="Utregning og kontroll med Kirchhoffs lover">{formula(kind, Rs, c, U)}</Formula>

      <Explain>{explanation(kind, Rs, c, U)}</Explain>
    </VizLayout>
  );
}

function sumLabel(q: 'U' | 'I', n: number): ReactNode {
  return (
    <>
      {Array.from({ length: n }, (_, k) => (
        <span key={k}>
          {k > 0 && ' + '}
          {q}
          <Sub>{k + 1}</Sub>
        </span>
      ))}
    </>
  );
}

/* ---------- Koblingsskjema ---------- */

const wire = { stroke: VIZ.ink, strokeWidth: 2.5 };

function Battery({ x, y, U }: { x: number; y: number; U: number }) {
  const f = useTextScale();
  return (
    <g>
      <line x1={x - 28} y1={y - 10} x2={x + 28} y2={y - 10} stroke={VIZ.ink} strokeWidth={3} />
      <line x1={x - 14} y1={y + 10} x2={x + 14} y2={y + 10} stroke={VIZ.ink} strokeWidth={8} />
      <Tag x={x - 34} y={y - 4} anchor="end" weight={700}>
        +
      </Tag>
      <Tag x={x + 24} y={y + 30 + 14 * f} anchor="start" color={EL.voltage} weight={700}>
        {fmt(U, 1)} V
      </Tag>
    </g>
  );
}

function Resistor({ x, y, k, vertical }: { x: number; y: number; k: number; vertical?: boolean }) {
  const w = vertical ? 30 : 76;
  const h = vertical ? 76 : 30;
  return <rect x={x - w / 2} y={y - h / 2} width={w} height={h} rx={4} fill={VIZ.body} stroke={EL.resistors[k]} strokeWidth={3} />;
}

function SeriesDrawing({ Rs, c, U, W, H }: { Rs: number[]; c: Circuit; U: number; W: number; H: number }) {
  const f = useTextScale();
  const bx = W * 0.1;
  const right = W - 24;
  const top = 34 + 26 * f;
  const bottom = H - 34 - 10 * f;
  const mid = (top + bottom) / 2;
  const n = Rs.length;
  const span = right - bx;
  const xs = Rs.map((_, k) => bx + 70 + ((span - 70) * (k + 0.5)) / n);
  return (
    <g>
      <line x1={bx} y1={top} x2={right} y2={top} {...wire} />
      <line x1={right} y1={top} x2={right} y2={bottom} {...wire} />
      <line x1={right} y1={bottom} x2={bx} y2={bottom} {...wire} />
      <line x1={bx} y1={bottom} x2={bx} y2={mid + 10} {...wire} />
      <line x1={bx} y1={mid - 10} x2={bx} y2={top} {...wire} />
      <Battery x={bx} y={mid} U={U} />
      {xs.map((x, k) => (
        <g key={k}>
          <Resistor x={x} y={top} k={k} />
          <Tag x={x} y={top - 24} anchor="middle" weight={700}>
            R<TSub>{k + 1}</TSub> = {Rs[k]} Ω
          </Tag>
          <Tag x={x} y={top + 30 + 18 * f} anchor="middle" color={EL.voltage} weight={700}>
            U<TSub>{k + 1}</TSub> = {fU(c.U[k] ?? 0)} V
          </Tag>
        </g>
      ))}
      {c.I > 0 && (
        <g>
          <Arrow x1={(bx + right) / 2 + 50} y1={bottom - 16} x2={(bx + right) / 2 - 30} y2={bottom - 16} color={EL.current} width={2.5} head={10} />
          <Tag x={(bx + right) / 2 + 62} y={bottom - 16 + 6 * f} anchor="start" color={EL.current} weight={700}>
            I = {fI(c.I)} A
          </Tag>
        </g>
      )}
      <Tag x={(bx + right) / 2} y={bottom + 26 * f} anchor="middle" muted>
        samme strøm gjennom alle
      </Tag>
    </g>
  );
}

function ParallelDrawing({ Rs, c, U, W, H }: { Rs: number[]; c: Circuit; U: number; W: number; H: number }) {
  const f = useTextScale();
  const n = Rs.length;
  const bx = W * 0.1;
  const railL = W * 0.3;
  const railR = W - 24;
  const top = 30 + 26 * f;
  const gap = (H - top - 44 - 14 * f) / n;
  const ys = Rs.map((_, k) => top + k * gap);
  const yBot = H - 22;
  const cx = railL + (railR - railL) * 0.32;
  const lastY = ys[n - 1]!;
  const labelW = textWidth(11, f);
  return (
    <g>
      {/* Batteri med egen sløyfe: opp til første gren, ned fra høyre skinne */}
      <line x1={bx} y1={top} x2={railL} y2={top} {...wire} />
      <line x1={bx} y1={top} x2={bx} y2={(top + yBot) / 2 - 10} {...wire} />
      <line x1={bx} y1={(top + yBot) / 2 + 10} x2={bx} y2={yBot} {...wire} />
      <line x1={bx} y1={yBot} x2={railR} y2={yBot} {...wire} />
      <Battery x={bx} y={(top + yBot) / 2} U={U} />
      <line x1={railL} y1={top} x2={railL} y2={lastY} {...wire} />
      <line x1={railR} y1={top} x2={railR} y2={yBot} {...wire} />
      {ys.map((y, k) => (
        <g key={k}>
          <line x1={railL} y1={y} x2={railR} y2={y} {...wire} />
          <circle cx={railL} cy={y} r={4.5} fill={VIZ.ink} />
          <circle cx={railR} cy={y} r={4.5} fill={VIZ.ink} />
          <Resistor x={cx} y={y} k={k} />
          <Tag x={cx} y={y - 24} anchor="middle" weight={700}>
            R<TSub>{k + 1}</TSub> = {Rs[k]} Ω
          </Tag>
          {(c.Ik[k] ?? 0) > 0 && (
            <g>
              <Arrow x1={cx + 50} y1={y - 12} x2={cx + 50 + 40} y2={y - 12} color={EL.current} width={2.2} head={9} />
              <Tag x={Math.min(cx + 100, railR - 8 - labelW)} y={y - 12 + 6 * f} anchor="start" color={EL.current} weight={700}>
                I<TSub>{k + 1}</TSub> = {fI(c.Ik[k] ?? 0)} A
              </Tag>
            </g>
          )}
        </g>
      ))}
      {c.I > 0 && (
        <g>
          <Arrow x1={bx + 16} y1={top - 14} x2={railL - 20} y2={top - 14} color={EL.current} width={2.5} head={10} />
          <Tag x={bx - 8} y={top - 24} anchor="start" color={EL.current} weight={700}>
            I = {fI(c.I)} A
          </Tag>
        </g>
      )}
      <Tag x={(railL + railR) / 2} y={yBot - 14} anchor="middle" muted>
        samme spenning over alle
      </Tag>
    </g>
  );
}

/* ---------- Fordelingen av spenning og strøm ---------- */

function Bars({ kind, c, U, W }: { kind: Kind; c: Circuit; U: number; W: number }) {
  const f = useTextScale();
  const x0 = 20;
  const x1 = W - 20;
  const rows: { title: string; total: number; parts: number[] | null; unit: string; q: 'U' | 'I'; color: string }[] = [
    { title: `Spenning, U = ${fU(U)} V`, total: U, parts: kind === 'serie' ? c.U : null, unit: 'V', q: 'U', color: EL.voltage },
    { title: `Strøm, I = ${fI(c.I)} A`, total: c.I, parts: kind === 'parallell' ? c.Ik : null, unit: 'A', q: 'I', color: EL.current },
  ];
  const n = c.U.length;
  return (
    <g>
      {rows.map((r, ri) => {
        const y = 24 * f + ri * 88;
        const barY = y + 14;
        const fmtV = r.q === 'U' ? fU : fI;
        if (!(r.total > 0))
          return (
            <g key={r.title}>
              <Tag x={x0} y={y} anchor="start" weight={650}>
                {r.title}
              </Tag>
              <rect x={x0} y={barY} width={x1 - x0} height={36} rx={6} fill="none" stroke={VIZ.grid} strokeWidth={1.5} />
            </g>
          );
        if (!r.parts)
          return (
            <g key={r.title}>
              <Tag x={x0} y={y} anchor="start" weight={650}>
                {r.title}
              </Tag>
              <rect x={x0} y={barY} width={x1 - x0} height={36} rx={6} fill={r.color} fillOpacity={0.25} stroke={r.color} strokeWidth={2} />
              <Tag x={(x0 + x1) / 2} y={barY + 18 + 6 * f} anchor="middle" weight={650}>
                {Array.from({ length: n }, (_, k) => (
                  <tspan key={k}>
                    {r.q}
                    <TSub>{k + 1}</TSub> ={' '}
                  </tspan>
                ))}
                {fmtV(r.total)} {r.unit}
              </Tag>
            </g>
          );
        let acc = x0;
        return (
          <g key={r.title}>
            <Tag x={x0} y={y} anchor="start" weight={650}>
              {r.title} = {r.parts.map((_, k) => `${r.q}${['₁', '₂', '₃'][k]}`).join(' + ')}
            </Tag>
            {r.parts.map((v, k) => {
              const w = (v / r.total) * (x1 - x0);
              const xs = acc;
              acc += w;
              const label = `${r.q}${['₁', '₂', '₃'][k]} = ${fmtV(v)} ${r.unit}`;
              const short = `${r.q}${['₁', '₂', '₃'][k]}`;
              const fits = textWidth(label.length, f) + 24 < w;
              const fitsShort = textWidth(short.length, f) + 14 < w;
              return (
                <g key={k}>
                  <rect x={xs} y={barY} width={Math.max(0, w)} height={36} fill={EL.resistors[k]} fillOpacity={0.35} stroke={EL.resistors[k]} strokeWidth={2} />
                  {(fits || fitsShort) && (
                    <Tag x={xs + w / 2} y={barY + 18 + 6 * f} anchor="middle" weight={650}>
                      {fits ? label : short}
                    </Tag>
                  )}
                </g>
              );
            })}
          </g>
        );
      })}
    </g>
  );
}

/* ---------- Formler og forklaring ---------- */

function formula(kind: Kind, Rs: number[], c: Circuit, U: number): ReactNode {
  const idx = Rs.map((_, k) => k + 1);
  if (kind === 'serie')
    return (
      <>
        <FormulaLine>
          R = {idx.map((k, i) => <span key={k}>{i > 0 && ' + '}R<Sub>{k}</Sub></span>)} = {Rs.map((r) => `${r} Ω`).join(' + ')} = {fR(c.Rtot)} Ω
        </FormulaLine>
        <FormulaLine>
          I = U/R = {fmt(U, 1)} V / {fR(c.Rtot)} Ω = {fI(c.I)} A
        </FormulaLine>
        <FormulaLine>
          Kirchhoffs 2. lov: {idx.map((k, i) => <span key={k}>{i > 0 && ' + '}U<Sub>{k}</Sub></span>)} ={' '}
          {c.U.map((v) => `${fU(v)} V`).join(' + ')} = {fU(c.U.reduce((s, v) => s + v, 0))} V = U
        </FormulaLine>
      </>
    );
  return (
    <>
      <FormulaLine>
        1/R = {idx.map((k, i) => <span key={k}>{i > 0 && ' + '}1/R<Sub>{k}</Sub></span>)} = {Rs.map((r) => `1/${r} Ω`).join(' + ')}, så R ={' '}
        {fR(c.Rtot)} Ω
      </FormulaLine>
      <FormulaLine>
        I = U/R = {fmt(U, 1)} V / {fR(c.Rtot)} Ω = {fI(c.I)} A
      </FormulaLine>
      <FormulaLine>
        Kirchhoffs 1. lov: {idx.map((k, i) => <span key={k}>{i > 0 && ' + '}I<Sub>{k}</Sub></span>)} = {c.Ik.map((v) => `${fI(v)} A`).join(' + ')} ={' '}
        {fI(c.Ik.reduce((s, v) => s + v, 0))} A = I
      </FormulaLine>
    </>
  );
}

function explanation(kind: Kind, Rs: number[], c: Circuit, U: number): ReactNode {
  const maxK = Rs.indexOf(Math.max(...Rs)) + 1;
  const minK = Rs.indexOf(Math.min(...Rs)) + 1;
  const allSame = Rs.every((r) => r === Rs[0]);
  const zero = U === 0 ? ' Skru opp spenningen for å se strømmen.' : '';
  if (kind === 'serie')
    return (
      <p>
        <strong>Seriekobling: samme strøm, delt spenning.</strong> Strømmen har bare én vei, så den samme strømmen I = {fI(c.I)} A går
        gjennom alle motstandene. Spenningen fordeles i forhold til resistansen, U<Sub>k</Sub> = R<Sub>k</Sub>·I,{' '}
        {allSame ? 'og like motstander får like stor spenning.' : <>så R<Sub>{maxK}</Sub> får størst spenning.</>} Den totale resistansen
        er summen, {fR(c.Rtot)} Ω, større enn hver av motstandene. Spenningene summeres til batterispenningen (Kirchhoffs 2. lov).{zero}
      </p>
    );
  return (
    <p>
      <strong>Parallellkobling: samme spenning, delt strøm.</strong> Alle motstandene er koblet direkte til batteriet, så de har samme
      spenning, {fmt(U, 1)} V. Strømmen deler seg, I<Sub>k</Sub> = U/R<Sub>k</Sub>,{' '}
      {allSame ? 'og like motstander får like stor strøm.' : <>så den minste motstanden, R<Sub>{minK}</Sub>, får mest strøm.</>} Den totale
      resistansen {fR(c.Rtot)} Ω er mindre enn den minste motstanden, fordi hver gren gir strømmen en ekstra vei. Strømmen inn i
      forgreiningspunktet er lik summen av strømmene ut (Kirchhoffs 1. lov).{zero}
    </p>
  );
}
