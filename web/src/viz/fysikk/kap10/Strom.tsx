import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  Arrow,
  Controls,
  Explain,
  Figure,
  Formula,
  FormulaLine,
  PlayControls,
  Readout,
  Readouts,
  Slider,
  Toggle,
  Toolbar,
  VIZ,
  VizLayout,
  fmt,
  fmtSci,
  useSimClock,
  useTextScale,
} from '../../kit';
import { E_CHARGE, N_COPPER, carrierPosition, crossings, currentFrom, driftSpeed, electronsPerSecond, makeCarriers } from './model';
import { EL, Tag, useNarrow } from './parts';

/** Utsnittet av ledningen i figuren (px) og målestokken: ca. 612 px per mm, så utsnittet er ca. 1 mm langt. */
const X0 = 90;
const LEN = 620;
const PX_PER_MM = 612;
/** Hver prikk står for 10¹⁸ frie elektroner. */
const DOT_ELECTRONS = 1e18;
const DOT_Q = DOT_ELECTRONS * E_CHARGE;
/** Tykkelsen i figuren er proporsjonal med tverrsnittet: 40 px per mm². */
const PX_PER_MM2 = 40;
/** Prikker per px² slik at prikkene har samme tetthet som de frie elektronene i kobber. */
const DOTS_PER_PX2 = (N_COPPER * 1e-9) / (PX_PER_MM * PX_PER_MM2) / DOT_ELECTRONS;
const T_MAX = 60;

export default function Strom() {
  const [I, setI] = useState(1);
  const [A, setA] = useState(1.5);
  const [showDir, setShowDir] = useState(true);
  const clock = useSimClock({ tMax: T_MAX });
  const { setT } = clock;
  // Vis et øyeblikk der noen elektroner allerede har passert.
  useEffect(() => setT(5), [setT]);
  const t = clock.t;

  const h = PX_PER_MM2 * A;
  const count = Math.round(DOTS_PER_PX2 * h * LEN);
  const carriers = useMemo(() => makeCarriers(count, LEN, 11), [count]);
  // Farten i figuren er valgt slik at prikkene som passerer per sekund, svarer nøyaktig til strømmen.
  const vPx = (I * LEN) / (DOT_Q * count);
  const shift = vPx * t;
  const plane = LEN / 2;
  const nCross = useMemo(() => crossings(carriers.map((c) => c.u0), plane, LEN, shift), [carriers, plane, shift]);
  const Q = nCross * DOT_Q;
  const Imeasured = currentFrom(Q, t);
  const v = driftSpeed(I, A);
  const [wrapRef, narrow] = useNarrow<HTMLDivElement>();

  return (
    <VizLayout>
      <Controls>
        <Slider label="Strøm I" value={I} onChange={setI} min={0} max={3} step={0.1} unit="A" decimals={1} />
        <Slider label="Tverrsnitt A" value={A} onChange={setA} min={0.75} max={2.5} step={0.25} unit="mm²" decimals={2} />
      </Controls>
      <Toolbar>
        <PlayControls clock={clock} decimals={1} />
        <Toggle label="Vis strømretning og elektronenes retning" checked={showDir} onChange={setShowDir} />
      </Toolbar>

      <div ref={wrapRef}>
        <Figure
          viewBox={`0 0 800 ${narrow ? 520 : 356}`}
          label={`Frie elektroner i en kobberledning. Strømmen er ${fmt(I, 1)} A, og ${nCross} prikker har passert tverrsnittet etter ${fmt(t, 1)} s.`}
          maxHeight={400}
        >
          <Wire t={t} h={h} carriers={carriers} shift={shift} showDir={showDir} I={I} nCross={nCross} Q={Q} H={narrow ? 520 : 356} />
        </Figure>
      </div>

      <Readouts>
        <Readout label="Ladning som har passert, Q" value={fmt(Q, 2)} unit="C" tone={EL.electron} />
        <Readout label="Målt strøm I = Q/t" value={fmt(Imeasured, 2)} unit="A" tone={EL.current} />
        <Readout label="Elektroner per sekund" value={fmtSci(electronsPerSecond(I), 2)} />
        <Readout label="Driftsfart v" value={fmt(v * 1000, 3)} unit="mm/s" />
      </Readouts>

      <Formula label="Strøm og driftsfart">
        {t > 0 ? (
          <FormulaLine>
            I = Q/t = {fmt(Q, 2)} C / {fmt(t, 1)} s = {fmt(Imeasured, 2)} A
          </FormulaLine>
        ) : (
          <FormulaLine>I = Q/t: trykk «Spill av» for å telle ladningen som passerer</FormulaLine>
        )}
        <FormulaLine>
          v = I/(n·e·A) = {fmt(I, 1)} A / ({fmtSci(N_COPPER, 1)} m⁻³ · {fmtSci(E_CHARGE, 2)} C · {fmtSci(A * 1e-6, 2)} m²) ={' '}
          {fmtSci(v, 1)} m/s
        </FormulaLine>
      </Formula>

      <Explain>{explanation(I, A, v, t, nCross)}</Explain>
    </VizLayout>
  );
}

function Wire({
  t,
  h,
  carriers,
  shift,
  showDir,
  I,
  nCross,
  Q,
  H,
}: {
  t: number;
  h: number;
  carriers: ReturnType<typeof makeCarriers>;
  shift: number;
  showDir: boolean;
  I: number;
  nCross: number;
  Q: number;
  H: number;
}) {
  const f = useTextScale();
  const yBat = 46 * f;
  // Midtlinjen ligger fast, så bare tykkelsen endres når tverrsnittet endres (største tykkelse er 100 px).
  // Avstandene vokser med tekstskalaen, så pilene og etikettene ikke havner oppå ledningen på mobil.
  const cy = 120 + 74 * f;
  const yI = cy - 50 - 14 - 16 * f;
  const yE = cy + 50 + 14 + 16 * f;
  const top = cy - h / 2;
  const bottom = cy + h / 2;
  const xPlane = X0 + LEN / 2;
  const ions: [number, number][] = [];
  const rows = Math.max(1, Math.round(h / 26));
  for (let x = X0 + 16; x < X0 + LEN - 8; x += 31) for (let r = 0; r < rows; r++) ions.push([x + (r % 2) * 15, top + ((r + 0.5) * h) / rows]);

  return (
    <g>
      {/* Batteriet og ledningene rundt (pluss til venstre) */}
      <line x1={40} y1={yBat} x2={388} y2={yBat} stroke={VIZ.ink} strokeWidth={2} />
      <line x1={412} y1={yBat} x2={760} y2={yBat} stroke={VIZ.ink} strokeWidth={2} />
      <line x1={40} y1={yBat} x2={40} y2={cy} stroke={VIZ.ink} strokeWidth={2} />
      <line x1={760} y1={yBat} x2={760} y2={cy} stroke={VIZ.ink} strokeWidth={2} />
      <line x1={40} y1={cy} x2={X0} y2={cy} stroke={VIZ.ink} strokeWidth={2} />
      <line x1={760} y1={cy} x2={X0 + LEN} y2={cy} stroke={VIZ.ink} strokeWidth={2} />
      <line x1={388} y1={yBat - 24} x2={388} y2={yBat + 24} stroke={VIZ.ink} strokeWidth={3} />
      <line x1={412} y1={yBat - 12} x2={412} y2={yBat + 12} stroke={VIZ.ink} strokeWidth={7} />
      <Tag x={372} y={yBat - 14} anchor="end" weight={700}>
        +
      </Tag>
      <Tag x={428} y={yBat - 14} anchor="start" weight={700}>
        −
      </Tag>
      <Tag x={400} y={yBat + 30 + 14 * f} anchor="middle" muted>
        batteri
      </Tag>

      {/* Ledningen: faste positive ioner og frie elektroner */}
      <rect x={X0} y={top} width={LEN} height={h} rx={8} fill={VIZ.body} className="viz-block" />
      {ions.map(([x, y], k) => (
        <g key={k} opacity={0.55}>
          <line x1={x - 4} y1={y} x2={x + 4} y2={y} stroke={VIZ.muted} strokeWidth={1.5} />
          <line x1={x} y1={y - 4} x2={x} y2={y + 4} stroke={VIZ.muted} strokeWidth={1.5} />
        </g>
      ))}
      {carriers.map((c, k) => {
        const u = carrierPosition(c.u0, shift, LEN);
        const jx = 2.5 * Math.sin(2 * Math.PI * c.freq * t + c.phase);
        const jy = 2.5 * Math.cos(2 * Math.PI * c.freq * 1.3 * t + c.phase);
        const x = X0 + Math.min(LEN - 5, Math.max(5, u + jx));
        const y = top + 6 + c.v * (h - 12) + jy;
        return <circle key={k} cx={x} cy={Math.min(bottom - 4, Math.max(top + 4, y))} r={4.2} fill={EL.electron} />;
      })}

      {/* Tverrsnittet der vi teller */}
      <ellipse cx={xPlane} cy={cy} rx={9} ry={h / 2 + 10} fill="none" stroke={VIZ.ink} strokeWidth={2} strokeDasharray="5 4" />
      <Tag x={xPlane} y={yE + 24 + 20 * f} anchor="middle" weight={650}>
        {nCross} prikker = {fmt(Q, 2)} C har passert
      </Tag>

      {showDir && I > 0 && (
        <g>
          <Arrow x1={X0 + 20} y1={yI} x2={X0 + 150} y2={yI} color={EL.current} />
          <Tag x={X0 + 162} y={yI + 6 * f} anchor="start" color={EL.current} weight={650}>
            strømretning I: fra + til −
          </Tag>
          <Arrow x1={X0 + LEN - 20} y1={yE} x2={X0 + LEN - 150} y2={yE} color={EL.electron} />
          <Tag x={X0 + LEN - 162} y={yE + 6 * f} anchor="end" color={EL.electron} weight={650}>
            elektronene: fra − mot +
          </Tag>
        </g>
      )}
      {f > 1.3 ? (
        <>
          <Tag x={400} y={H - 12 - 22 * f} anchor="middle" muted>
            utsnitt på ca. 1 mm av ledningen
          </Tag>
          <Tag x={400} y={H - 12} anchor="middle" muted>
            1 prikk = 10¹⁸ elektroner
          </Tag>
        </>
      ) : (
        <Tag x={X0} y={H - 12} anchor="start" muted>
          utsnitt på ca. 1 mm av ledningen · 1 prikk = 10¹⁸ elektroner
        </Tag>
      )}
    </g>
  );
}

function explanation(I: number, A: number, v: number, t: number, n: number): ReactNode {
  if (I === 0)
    return (
      <p>
        <strong>Ingen strøm.</strong> De frie elektronene farer hele tiden tilfeldig omkring, men like mange går hver vei gjennom
        tverrsnittet. Netto ladning som passerer, er null, så I = 0. Skru opp strømmen for å se elektronene drive.
      </p>
    );
  return (
    <>
      <p>
        <strong>Elektronene går motsatt vei av strømretningen.</strong> Elektronene er negative og trekkes mot plusspolen, mot venstre.
        Strømretningen er bestemt som den veien positive ladninger ville gått: fra + til − gjennom ledningen. Strømmen er ladningen som
        passerer tverrsnittet per sekund, I = Q/t: {fmt(I, 1)} A betyr {fmtSci(electronsPerSecond(I), 2)} elektroner per sekund.
        {t > 0 && n > 0 && ` Etter ${fmt(t, 1)} s har ${n} prikker passert.`}
      </p>
      <p>
        Elektronene driver bare {fmt(v * 1000, 3)} mm/s. Animasjonen går i sanntid, så det du ser, er den virkelige driftsfarten. Likevel
        lyser en lampe med en gang du slår på bryteren, fordi elektronene i hele kretsen begynner å bevege seg nesten samtidig.{' '}
        {A > 1.6 ? 'En tykkere ledning har flere frie elektroner per lengde, så de trenger å drive saktere for å gi samme strøm.' : 'Gjør ledningen tykkere: samme strøm gir da lavere driftsfart.'}
      </p>
    </>
  );
}
