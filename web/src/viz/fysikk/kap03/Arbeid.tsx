import { useState, type ReactNode } from 'react';
import {
  Block,
  Controls,
  Explain,
  Figure,
  Formula,
  FormulaLine,
  Ground,
  Legend,
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
  scaleLinear,
  useTextScale,
} from '../../kit';
import { SLED_MASS, niceCeil, sledWork, type SledResult } from './model';
import { Arrow, Label } from './marks';
import { useNarrow } from './useNarrow';

/** Piksler per newton for F, komponentene og R (F = 200 N rett opp gir 250 px). */
const K = 1.25;
/** Piksler per newton for G og N (lengre krefter, mindre skala). */
const KV = 0.32;

export default function Arbeid() {
  const [F, setF] = useState(150);
  const [alpha, setAlpha] = useState(30);
  const [s, setS] = useState(10);
  const [mu, setMu] = useState(0.1);
  const [vertical, setVertical] = useState(false);
  const { ref, narrow } = useNarrow();
  const r = sledWork({ F, alphaDeg: alpha, s, mu });

  return (
    <VizLayout>
      <Controls>
        <Slider label="Kraft F" value={F} onChange={setF} min={0} max={200} step={5} unit="N" decimals={0} />
        <Slider label="Vinkel α" value={alpha} onChange={setAlpha} min={0} max={180} step={5} format={(v) => `${fmt(v, 0)}°`} />
        <Slider label="Strekning s" value={s} onChange={setS} min={1} max={20} step={1} unit="m" decimals={0} />
        <Slider label="Friksjonstall μ" value={mu} onChange={setMu} min={0} max={0.5} step={0.01} decimals={2} />
      </Controls>
      <Toolbar>
        <Toggle label="Vis tyngde og normalkraft" checked={vertical} onChange={setVertical} />
      </Toolbar>

      <div ref={ref}>
        <Figure
          viewBox={sceneViewBox(narrow)}
          label={`Kjelke som dras ${fmt(s, 0)} m mot høyre med kraften ${fmt(F, 0)} N i vinkelen ${fmt(alpha, 0)} grader med bevegelsesretningen.`}
          maxHeight={narrow ? 540 : 470}
        >
          <Scene F={F} alpha={alpha} s={s} r={r} vertical={vertical} narrow={narrow} />
        </Figure>
      </div>
      <Legend
        items={[
          { color: VIZ.applied, label: 'Kraften F og komponentene' },
          { color: VIZ.friction, label: 'Friksjon R' },
          ...(vertical
            ? [
                { color: VIZ.gravity, label: 'Tyngde G' },
                { color: VIZ.normal, label: 'Normalkraft N' },
              ]
            : []),
        ]}
      />

      <Figure viewBox={`0 0 800 ${barsHeight(narrow)}`} label="Søylediagram over arbeidet hver kraft gjør, med fortegn." maxHeight={narrow ? 470 : 320}>
        <WorkBars r={r} height={barsHeight(narrow)} />
      </Figure>

      <Readouts>
        <Readout
          label={
            <>
              F<Sub>∥</Sub> = F cos α
            </>
          }
          value={fmt(r.Fpar, 1)}
          unit="N"
          tone={VIZ.applied}
        />
        <Readout
          label={
            <>
              Arbeid fra F, W<Sub>F</Sub>
            </>
          }
          value={fmt(r.WF, 0)}
          unit="J"
          tone={VIZ.applied}
        />
        <Readout
          label={
            <>
              Friksjonsarbeid W<Sub>R</Sub>
            </>
          }
          value={fmt(r.WR, 0)}
          unit="J"
          tone={VIZ.friction}
        />
        <Readout label="Totalt arbeid W" value={fmt(r.W, 0)} unit="J" />
      </Readouts>

      <Formula label="Arbeidet fra hver kraft">
        <FormulaLine>
          W<Sub>F</Sub> = F · s · cos α = {fmt(F, 0)} N · {fmt(s, 0)} m · cos {fmt(alpha, 0)}° = {fmt(r.WF, 0)} J
        </FormulaLine>
        <FormulaLine>
          W<Sub>R</Sub> = −R · s = −μ(mg − F sin α) · s = −{fmt(mu, 2)} · {fmt(r.N, 0)} N · {fmt(s, 0)} m = {fmt(r.WR, 0)} J
        </FormulaLine>
        <FormulaLine>
          W = W<Sub>F</Sub> + W<Sub>R</Sub> = {fmt(r.WF, 0)} J + ({fmt(r.WR, 0)} J) = {fmt(r.W, 0)} J
        </FormulaLine>
      </Formula>

      <Explain>{explanation(F, alpha, mu, r)}</Explain>
    </VizLayout>
  );
}

/* ---------- Scenen ---------- */

/**
 * Plassen i scenen. Høyden gir akkurat plass til F = 200 N rett opp. På mobil beskjæres sidene (ingenting tegnes
 * utenfor x = 60–740), så kjelken og pilene blir større.
 */
function sceneLayout(narrow: boolean) {
  return narrow ? { left: 60, right: 740, H: 445, groundY: 336 } : { left: 0, right: 800, H: 410, groundY: 330 };
}

function sceneViewBox(narrow: boolean): string {
  const { left, right, H } = sceneLayout(narrow);
  return `${left} 0 ${right - left} ${H}`;
}

const barsHeight = (narrow: boolean): number => (narrow ? 430 : 290);

function Scene({ F, alpha, s, r, vertical, narrow }: { F: number; alpha: number; s: number; r: SledResult; vertical: boolean; narrow: boolean }) {
  const f = useTextScale();
  const { left, right, H, groundY } = sceneLayout(narrow);
  const cx = 400;
  const boxW = 190;
  const boxH = 54;
  const boxTop = groundY - 18 - boxH;
  const cy = boxTop + boxH / 2;
  const a = (alpha * Math.PI) / 180;
  const tipX = cx + F * K * Math.cos(a);
  const tipY = cy - F * K * Math.sin(a);
  const parX = cx + r.Fpar * K;
  const perpY = cy - r.Fperp * K;
  const arcR = 58;
  const showComp = F > 0 && alpha % 180 !== 0 && alpha !== 90;
  const rLen = r.R * K;
  const sY = groundY + 30 + 26 * f;

  return (
    <g>
      <Ground x1={left + 16} x2={right - 16} y={groundY} />
      {/* Meier og last */}
      <path
        d={`M${cx - boxW / 2 - 14},${groundY - 3} L${cx + boxW / 2},${groundY - 3} Q${cx + boxW / 2 + 30},${groundY - 3} ${cx + boxW / 2 + 26},${groundY - 30}`}
        fill="none"
        stroke={VIZ.muted}
        strokeWidth={4}
        strokeLinecap="round"
      />
      <line x1={cx - 60} x2={cx - 60} y1={groundY - 3} y2={boxTop + boxH} stroke={VIZ.muted} strokeWidth={3} />
      <line x1={cx + 60} x2={cx + 60} y1={groundY - 3} y2={boxTop + boxH} stroke={VIZ.muted} strokeWidth={3} />
      <Block x={cx - boxW / 2} y={boxTop} w={boxW} h={boxH} />

      {/* Vinkelbue */}
      {F > 0 && <line x1={cx} x2={cx + arcR + 30} y1={cy} y2={cy} className="viz-guide" />}
      {F > 0 && alpha > 0 && (
        <>
          <path
            d={`M${cx + arcR},${cy} A${arcR},${arcR} 0 0 0 ${cx + arcR * Math.cos(a)},${cy - arcR * Math.sin(a)}`}
            fill="none"
            stroke={VIZ.ink}
            strokeWidth={1.5}
          />
          <Label x={cx + (arcR + 16 * f) * Math.cos(a / 2)} y={cy - (arcR + 16 * f) * Math.sin(a / 2) + 6} anchor="middle">
            α
          </Label>
        </>
      )}

      {/* Komponentene og parallellogrammet */}
      {showComp && (
        <g>
          <line x1={tipX} y1={tipY} x2={parX} y2={cy} className="viz-guide" />
          <line x1={tipX} y1={tipY} x2={cx} y2={perpY} className="viz-guide" />
          <Arrow x1={cx} y1={cy} x2={parX} y2={cy} color={VIZ.applied} dashed width={2.5} minLength={6} />
          <Arrow x1={cx} y1={cy} x2={cx} y2={perpY} color={VIZ.applied} dashed width={2.5} minLength={6} />
          <Label x={parX + (r.Fpar >= 0 ? 12 : -12)} y={cy + 7} anchor={r.Fpar >= 0 ? 'start' : 'end'} color={VIZ.applied}>
            F<TSub>∥</TSub>
          </Label>
          <Label x={cx + (alpha < 90 ? -12 : 12)} y={perpY + 6} anchor={alpha < 90 ? 'end' : 'start'} color={VIZ.applied}>
            F<TSub>⊥</TSub>
          </Label>
        </g>
      )}
      {vertical && (
        <g>
          <Arrow x1={cx - 22} y1={cy} x2={cx - 22} y2={cy + r.G * KV} color={VIZ.gravity} width={2.5} label="G" labelX={cx - 32} labelY={cy + r.G * KV} labelAnchor="end" />
          <Arrow
            x1={cx + 22}
            y1={groundY}
            x2={cx + 22}
            y2={groundY - r.N * KV}
            color={VIZ.normal}
            width={2.5}
            label="N"
            labelX={cx + 32}
            labelY={groundY - r.N * KV + 14}
            labelAnchor="start"
            minLength={4}
          />
        </g>
      )}
      <Arrow
        x1={cx}
        y1={cy}
        x2={tipX}
        y2={tipY}
        color={VIZ.applied}
        width={4}
        head={14}
        label="F"
        labelX={tipX + Math.cos(a) * 20}
        labelY={tipY - Math.sin(a) * 20 + 6}
        labelAnchor={Math.cos(a) < -0.3 ? 'end' : Math.cos(a) > 0.3 ? 'start' : 'middle'}
        minLength={4}
      />
      <Arrow
        x1={cx - 40}
        y1={groundY + 8}
        x2={cx - 40 - rLen}
        y2={groundY + 8}
        color={VIZ.friction}
        label="R"
        labelX={cx - 40 - rLen - 12}
        labelY={groundY + 14}
        labelAnchor="end"
        minLength={4}
      />

      {/* Forflytningen, til høyre under bakken */}
      <Arrow x1={right - 230} y1={sY} x2={right - 24} y2={sY} color={VIZ.ink} width={2.5} head={12} />
      <Label x={right - 127} y={sY - 12} anchor="middle">
        s = {fmt(s, 0)} m
      </Label>
      <Label x={left + 24} y={H - 14} anchor="start" muted>
        Kjelke med last, {SLED_MASS} kg
      </Label>
    </g>
  );
}

/* ---------- Søyler for arbeidet ---------- */

function WorkBars({ r, height: H }: { r: SledResult; height: number }) {
  const f = useTextScale();
  const rows: { label: ReactNode; value: number; color: string; note?: string }[] = [
    {
      label: (
        <>
          W<TSub>F</TSub>
        </>
      ),
      value: r.WF,
      color: VIZ.applied,
    },
    {
      label: (
        <>
          W<TSub>R</TSub>
        </>
      ),
      value: r.WR,
      color: VIZ.friction,
    },
    {
      label: (
        <>
          W<TSub>G</TSub>
        </>
      ),
      value: r.WG,
      color: VIZ.gravity,
      note: 'G står vinkelrett på bevegelsen',
    },
    {
      label: (
        <>
          W<TSub>N</TSub>
        </>
      ),
      value: r.WN,
      color: VIZ.normal,
      note: 'N står vinkelrett på bevegelsen',
    },
    { label: 'Totalt', value: r.W, color: VIZ.ink },
  ];
  const lo = Math.min(0, r.WF, r.WR, r.W);
  const hi = Math.max(0, r.WF, r.W);
  const lo2 = lo < 0 ? -niceCeil(-lo, 4) : 0;
  let hi2 = hi > 0 ? niceCeil(hi, 4) : 0;
  if (hi2 - lo2 < 1) hi2 = 100;
  const top = 34 * f;
  const rowH = (H - top - 12) / rows.length;
  const labelW = 80 * f;
  const valueW = 112 * f;
  const xs = scaleLinear([lo2, hi2], [24 + labelW, 800 - valueW - 16]);
  const x0 = xs(0);
  const bar = Math.min(28 * f, rowH * 0.62);

  return (
    <g>
      <Label x={24} y={22 * f} anchor="start" muted>
        Arbeid med fortegn (J)
      </Label>
      <line x1={x0} x2={x0} y1={top - 6} y2={H - 8} className="viz-axis" />
      {rows.map((row, i) => {
        const yc = top + rowH * (i + 0.5);
        const xv = xs(row.value);
        const zero = Math.abs(row.value) < 0.5;
        return (
          <g key={i}>
            <Label x={24} y={yc + 6} anchor="start" color={row.color}>
              {row.label}
            </Label>
            {!zero && <rect x={Math.min(x0, xv)} y={yc - bar / 2} width={Math.abs(xv - x0)} height={bar} rx={3} fill={row.color} opacity={i === rows.length - 1 ? 0.85 : 0.75} />}
            {zero && row.note && (
              <text x={x0 > 400 ? x0 - 10 : x0 + 10} y={yc + 5} textAnchor={x0 > 400 ? 'end' : 'start'} className="viz-tick">
                {row.note}
              </text>
            )}
            <Label x={800 - 16} y={yc + 6} anchor="end" color={row.color}>
              {fmt(row.value, 0)} J
            </Label>
          </g>
        );
      })}
    </g>
  );
}

/* ---------- Forklaring ---------- */

function explanation(F: number, alpha: number, mu: number, r: SledResult): ReactNode {
  let first: ReactNode;
  if (F === 0)
    first = (
      <>
        <strong>Ingen kraft, ikke noe arbeid fra F.</strong>{' '}
        {mu > 0
          ? 'Kjelken glir bare hvis den har fart fra før, og da bremser friksjonen den.'
          : 'Uten friksjon glir kjelken videre med konstant fart hvis den har fart fra før.'}
      </>
    );
  else if (alpha === 0)
    first = (
      <>
        <strong>Positivt arbeid.</strong> Kraften peker langs bevegelsen. Da er cos 0° = 1, så hele kraften gjør arbeid: W<Sub>F</Sub> = F · s ={' '}
        {fmt(r.WF, 0)} J.
      </>
    );
  else if (alpha < 90)
    first = (
      <>
        <strong>Positivt arbeid.</strong> Bare komponenten langs bevegelsen, F<Sub>∥</Sub> = F cos α = {fmt(r.Fpar, 1)} N, gjør arbeid. F
        <Sub>⊥</Sub> står vinkelrett på bevegelsen og gjør ikke arbeid
        {mu > 0 ? ', men den løfter litt i kjelken, så normalkraften og friksjonen blir mindre.' : '.'}
      </>
    );
  else if (alpha === 90)
    first = (
      <>
        <strong>Null arbeid.</strong> Kraften står vinkelrett på bevegelsen. Siden cos 90° = 0, gjør F ikke arbeid, selv om kraften er{' '}
        {fmt(F, 0)} N. Den løfter bare litt i kjelken{mu > 0 ? ', så friksjonen blir mindre' : ''}.
      </>
    );
  else
    first = (
      <>
        <strong>Negativt arbeid.</strong> Når α er større enn 90°, peker F<Sub>∥</Sub> mot bevegelsesretningen, og cos α er negativ. Da
        bremser kraften kjelken og tar energi fra den: W<Sub>F</Sub> = {fmt(r.WF, 0)} J.
      </>
    );
  const dEk =
    Math.abs(r.W) < 0.5
      ? 'farten er den samme'
      : r.W > 0
        ? 'kjelken får mer fart'
        : F > 0
          ? 'kjelken mister fart. Det går bare hvis den hadde nok fart fra før til å komme hele strekningen'
          : 'kjelken mister fart';
  return (
    <>
      <p>{first}</p>
      <p>
        {mu > 0
          ? 'Friksjonsarbeidet er alltid negativt fordi R peker mot bevegelsen. '
          : F > 0
            ? 'Uten friksjon er F den eneste kraften som gjør arbeid. '
            : ''}
        G og N står vinkelrett på bevegelsen og gjør ikke arbeid. Totalt arbeid er W = {fmt(r.W, 0)} J, og det er lik endringen i kinetisk
        energi, ΔE<Sub>k</Sub>: {dEk}.
      </p>
    </>
  );
}
