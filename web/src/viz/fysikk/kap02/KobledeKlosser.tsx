import { useState, type ReactNode } from 'react';
import {
  Arrow,
  Block,
  Boundary,
  Controls,
  Explain,
  Figure,
  Formula,
  FormulaLine,
  Ground,
  Label,
  Readout,
  Readouts,
  Segmented,
  Slider,
  Sub,
  Toggle,
  Toolbar,
  VIZ,
  VizLayout,
  fmt,
  G_EARTH,
} from '../../kit';
import { coupled } from './model';

type View = 'system' | 'A' | 'B';

const VIEWS: { value: View; label: string }[] = [
  { value: 'system', label: 'Hele systemet' },
  { value: 'A', label: 'Kloss A' },
  { value: 'B', label: 'Kloss B' },
];

/** Piksler per newton for vannrette krefter. */
const K = 5;
/** Piksler per newton for G og N (lengre krefter, mindre skala). */
const KV = 0.9;
const FLOOR = 200;
const ROPE = 110;

export default function KobledeKlosser() {
  const [view, setView] = useState<View>('system');
  const [mA, setMA] = useState(2);
  const [mB, setMB] = useState(4);
  const [F, setF] = useState(9);
  const [vertical, setVertical] = useState(false);
  const r = coupled(mA, mB, F);

  const wA = 80 + mA * 8;
  const wB = 80 + mB * 8;
  const h = 80;
  const total = wA + ROPE + wB;
  const xA = Math.max(24, (800 - total - 150) / 2);
  const xB = xA + wA + ROPE;
  const top = FLOOR - h;
  const cy = top + h / 2;
  const sLen = r.S * K;
  const pad = 16;

  const boundary =
    view === 'system'
      ? { x: xA - pad, y: top - pad - 26, w: total + 2 * pad, h: h + 2 * pad + 26 }
      : view === 'A'
        ? { x: xA - pad, y: top - pad - 26, w: wA + 2 * pad, h: h + 2 * pad + 26 }
        : { x: xB - pad, y: top - pad - 26, w: wB + 2 * pad, h: h + 2 * pad + 26 };

  const sOnA = view !== 'B';
  const sOnB = view !== 'A';
  const internal = view === 'system';
  const showF = view !== 'A';

  return (
    <VizLayout>
      <Controls>
        <Slider
          label={
            <>
              Masse A, m<Sub>A</Sub>
            </>
          }
          ariaLabel="Masse til kloss A"
          value={mA}
          onChange={setMA}
          min={0.5}
          max={10}
          step={0.5}
          unit="kg"
          decimals={1}
        />
        <Slider
          label={
            <>
              Masse B, m<Sub>B</Sub>
            </>
          }
          ariaLabel="Masse til kloss B"
          value={mB}
          onChange={setMB}
          min={0.5}
          max={10}
          step={0.5}
          unit="kg"
          decimals={1}
        />
        <Slider label="Kraft F på B" value={F} onChange={setF} min={0} max={30} step={0.5} unit="N" decimals={1} />
      </Controls>
      <Toolbar>
        <Segmented label="Velg hva som er systemet" options={VIEWS} value={view} onChange={setView} />
        <Toggle label="Vis tyngde og normalkraft" checked={vertical} onChange={setVertical} />
      </Toolbar>

      <Figure
        viewBox="0 0 800 300"
        label={`To klosser bundet sammen med en snor på et glatt underlag. Kraften F drar i kloss B. Valgt system: ${VIEWS.find((v) => v.value === view)?.label}.`}
        maxHeight={360}
      >
        <Ground x1={20} x2={780} y={FLOOR} />
        <line x1={xA + wA} y1={cy} x2={xB} y2={cy} stroke={VIZ.tension} strokeWidth={2.5} />
        <Block x={xA} y={top} w={wA} h={h} label="A" strong={view === 'A'} />
        <Block x={xB} y={top} w={wB} h={h} label="B" strong={view === 'B'} />
        <Boundary {...boundary} label={view === 'system' ? 'Systemet: A + B' : `Systemet: kloss ${view}`} />

        {/* Snordraget: på A mot høyre (litt over snora), på B mot venstre (litt under) */}
        {sOnA && (
          <g opacity={internal ? 0.45 : 1}>
            <Arrow x1={xA + wA} y1={cy - 12} x2={xA + wA + sLen} y2={cy - 12} color={VIZ.tension} dashed={internal} width={internal ? 2.5 : 3} />
            <Label x={xA + wA + Math.max(sLen, 10) + 4} y={cy - 18} anchor="start" color={VIZ.tension}>
              S
            </Label>
          </g>
        )}
        {sOnB && (
          <g opacity={internal ? 0.45 : 1}>
            <Arrow x1={xB} y1={cy + 12} x2={xB - sLen} y2={cy + 12} color={VIZ.tension} dashed={internal} width={internal ? 2.5 : 3} />
            <Label x={xB - Math.max(sLen, 10) - 4} y={cy + 30} anchor="end" color={VIZ.tension}>
              S
            </Label>
          </g>
        )}
        {internal && r.S > 0 && (
          <Label x={xA + wA + ROPE / 2} y={FLOOR + 44} muted>
            indre krefter faller ut
          </Label>
        )}

        {showF && (
          <Arrow x1={xB + wB} y1={cy} x2={xB + wB + F * K} y2={cy} color={VIZ.applied} label="F" labelX={xB + wB + F * K + 8} labelY={cy + 6} labelAnchor="start" />
        )}

        {vertical && (
          <>
            {view !== 'B' && <VerticalForces x={xA + wA / 2} cy={cy} m={mA} />}
            {view !== 'A' && <VerticalForces x={xB + wB / 2} cy={cy} m={mB} />}
          </>
        )}

        {r.a > 0 && (
          <Arrow
            x1={xA}
            y1={24}
            x2={xA + Math.min(200, 30 + r.a * 25)}
            y2={24}
            color={VIZ.acceleration}
            width={2.5}
            label="a"
            labelX={xA + Math.min(200, 30 + r.a * 25) + 8}
            labelY={30}
            labelAnchor="start"
          />
        )}
      </Figure>

      <Formula label="Newtons 2. lov for det valgte systemet">{formula(view, mA, mB, F, r.a, r.S)}</Formula>

      <Readouts>
        <Readout label="Akselerasjon a" value={fmt(r.a, 2)} unit="m/s²" tone={VIZ.acceleration} />
        <Readout label="Snordrag S" value={fmt(r.S, 2)} unit="N" tone={VIZ.tension} />
        <Readout label="Kraftsum på A" value={fmt(r.netA, 2)} unit="N" />
        <Readout label="Kraftsum på B" value={fmt(r.netB, 2)} unit="N" />
      </Readouts>

      <Explain>{explanation(view, vertical)}</Explain>
    </VizLayout>
  );
}

function VerticalForces({ x, cy, m }: { x: number; cy: number; m: number }) {
  const len = m * G_EARTH * KV;
  return (
    <>
      <Arrow x1={x - 10} y1={cy} x2={x - 10} y2={cy + len} color={VIZ.gravity} width={2.5} label="G" labelX={x - 18} labelY={cy + len} labelAnchor="end" />
      <Arrow x1={x + 10} y1={FLOOR} x2={x + 10} y2={FLOOR - len} color={VIZ.normal} width={2.5} label="N" labelX={x + 18} labelY={FLOOR - len + 12} labelAnchor="start" />
    </>
  );
}

function formula(view: View, mA: number, mB: number, F: number, a: number, S: number): ReactNode {
  const kg = (v: number) => `${fmt(v, 1)} kg`;
  const n = (v: number) => `${fmt(v, 1)} N`;
  if (view === 'system')
    return (
      <>
        <FormulaLine>
          ΣF = F = (m<Sub>A</Sub> + m<Sub>B</Sub>) · a
        </FormulaLine>
        <FormulaLine>
          a = {n(F)} / {kg(mA + mB)} = {fmt(a, 2)} m/s²
        </FormulaLine>
      </>
    );
  if (view === 'A')
    return (
      <>
        <FormulaLine>
          ΣF = S = m<Sub>A</Sub> · a
        </FormulaLine>
        <FormulaLine>
          S = {kg(mA)} · {fmt(a, 2)} m/s² = {fmt(S, 2)} N
        </FormulaLine>
      </>
    );
  return (
    <>
      <FormulaLine>
        ΣF = F − S = m<Sub>B</Sub> · a
      </FormulaLine>
      <FormulaLine>
        S = F − m<Sub>B</Sub> · a = {n(F)} − {kg(mB)} · {fmt(a, 2)} m/s² = {fmt(S, 2)} N
      </FormulaLine>
    </>
  );
}

function explanation(view: View, vertical: boolean): ReactNode {
  const vert = vertical ? ' Tyngden og normalkraften er like store og opphever hverandre, så de påvirker ikke bevegelsen.' : '';
  switch (view) {
    case 'system':
      return (
        <p>
          Ser vi på A og B som <strong>ett system</strong>, er snordraget en indre kraft: snora drar A fremover og B bakover med like
          stor kraft, så de to S-ene faller ut av kraftsummen. Bare den ytre kraften F er igjen, og den akselererer hele massen.{vert}
        </p>
      );
    case 'A':
      return (
        <p>
          For <strong>kloss A</strong> alene er snordraget en ytre kraft, og den eneste vannrette kraften. Det er S som gir A den samme
          akselerasjonen som resten av systemet.{vert}
        </p>
      );
    case 'B':
      return (
        <p>
          For <strong>kloss B</strong> virker både F fremover og S bakover. Kraftsummen F − S gir B akselerasjonen a. Du får samme S som
          når du regner på kloss A, og det er en fin kontroll.{vert}
        </p>
      );
  }
}
