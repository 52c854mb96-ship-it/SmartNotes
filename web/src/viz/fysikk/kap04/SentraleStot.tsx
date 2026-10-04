import { useState, type ReactNode } from 'react';
import {
  Controls,
  Explain,
  Figure,
  Formula,
  FormulaLine,
  Ground,
  Label,
  Legend,
  PlayControls,
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
  useSimClock,
  useTextScale,
} from '../../kit';
import { BarPanel } from './Bars';
import { CART_H, Cart, VelocityArrow, WHEEL_R, cartWidth } from './Cart';
import { collide, elasticityForLossShare, fitTrack, maxLoss, type CollisionResult } from './model';
import { useNarrow } from './useNarrow';

type Kind = 'elastisk' | 'uelastisk' | 'fullstendig';

const KINDS: { value: Kind; label: string }[] = [
  { value: 'elastisk', label: 'Elastisk' },
  { value: 'uelastisk', label: 'Uelastisk' },
  { value: 'fullstendig', label: 'Fullstendig uelastisk' },
];

/** Tidspunktet for støtet og lengden på animasjonen (s). */
const T_HIT = 1.5;
const T_END = 4;
const GROUND = 218;
/** Piksler per m/s for fartspilene. */
const PX_PER_MS = 34;
const C1 = VIZ.series[0] ?? VIZ.velocity;
const C2 = VIZ.series[1] ?? VIZ.gravity;

interface State {
  m1: number;
  m2: number;
  v1: number;
  v2: number;
  kind: Kind;
  share: number;
}

export default function SentraleStot() {
  const [s, setS] = useState<State>({ m1: 1, m2: 2, v1: 2, v2: 0, kind: 'elastisk', share: 0.5 });
  const set = (patch: Partial<State>) => setS((prev) => ({ ...prev, ...patch }));
  const clock = useSimClock({ tMax: T_END });
  const [barsRef, narrow] = useNarrow<HTMLDivElement>();

  const e = s.kind === 'elastisk' ? 1 : s.kind === 'fullstendig' ? 0 : elasticityForLossShare(s.share);
  const r = collide(s.m1, s.v1, s.m2, s.v2, e);
  const lossPct = r.EkBefore > 0 ? (100 * r.lost) / r.EkBefore : 0;
  // Flere desimaler når energiene er små (lave farter), så tallene ikke rundes til 0,01 J.
  const eDec = r.EkBefore < 0.1 ? 3 : 2;

  return (
    <VizLayout>
      <Controls>
        <Slider
          label={
            <>
              Masse m<Sub>1</Sub>
            </>
          }
          ariaLabel="Masse til vogn 1"
          value={s.m1}
          onChange={(m1) => set({ m1 })}
          min={0.5}
          max={5}
          step={0.1}
          unit="kg"
          decimals={1}
        />
        <Slider
          label={
            <>
              Fart v<Sub>1</Sub>
            </>
          }
          ariaLabel="Fart til vogn 1"
          value={s.v1}
          onChange={(v1) => set({ v1 })}
          min={-3}
          max={3}
          step={0.1}
          unit="m/s"
          decimals={1}
        />
        <Slider
          label={
            <>
              Masse m<Sub>2</Sub>
            </>
          }
          ariaLabel="Masse til vogn 2"
          value={s.m2}
          onChange={(m2) => set({ m2 })}
          min={0.5}
          max={5}
          step={0.1}
          unit="kg"
          decimals={1}
        />
        <Slider
          label={
            <>
              Fart v<Sub>2</Sub>
            </>
          }
          ariaLabel="Fart til vogn 2"
          value={s.v2}
          onChange={(v2) => set({ v2 })}
          min={-3}
          max={3}
          step={0.1}
          unit="m/s"
          decimals={1}
        />
        {s.kind === 'uelastisk' && (
          <Slider
            label="Energitap i støtet"
            ariaLabel="Hvor stor del av det størst mulige energitapet som går tapt"
            value={s.share}
            onChange={(share) => set({ share })}
            min={0.05}
            max={0.95}
            step={0.05}
            format={() => `${fmt(lossPct, 0)} %`}
          />
        )}
      </Controls>
      <Toolbar>
        <Segmented label="Velg type støt" options={KINDS} value={s.kind} onChange={(kind) => set({ kind })} />
        <PlayControls clock={clock} />
      </Toolbar>

      <Figure
        viewBox="0 0 800 242"
        label={`To vogner på en skinne. Vogn 1: ${fmt(s.m1, 1)} kg med ${fmt(s.v1, 1)} m/s. Vogn 2: ${fmt(s.m2, 1)} kg med ${fmt(s.v2, 1)} m/s. ${KINDS.find((k) => k.value === s.kind)?.label} støt.`}
        maxHeight={300}
      >
        <Scene s={s} r={r} t={clock.t} />
      </Figure>

      <div ref={barsRef}>
        <Figure
          viewBox={`0 0 800 ${narrow ? 380 : 300}`}
          label="Søylediagram over bevegelsesmengde og kinetisk energi før og etter støtet"
          maxHeight={340}
        >
          <Bars s={s} r={r} height={narrow ? 380 : 300} />
        </Figure>
      </div>
      <Legend
        items={[
          { color: C1, label: 'Vogn 1' },
          { color: C2, label: 'Vogn 2' },
          { color: VIZ.ink, label: 'Sum for begge' },
          ...(r.lost > 1e-6 ? [{ color: VIZ.ink, dashed: true, label: 'Kinetisk energi før støtet' }] : []),
        ]}
      />

      <Readouts>
        <Readout
          label={
            <span>
              Fart etter, v<Sub>1</Sub>′
            </span>
          }
          value={fmt(r.u1, 2)}
          unit="m/s"
          tone={C1}
        />
        <Readout
          label={
            <span>
              Fart etter, v<Sub>2</Sub>′
            </span>
          }
          value={fmt(r.u2, 2)}
          unit="m/s"
          tone={C2}
        />
        <Readout label="Σp før = Σp etter" value={fmt(r.pBefore, 2)} unit="kg·m/s" />
        <Readout
          label={
            <span>
              Tap av E<Sub>k</Sub>
            </span>
          }
          value={fmt(r.lost, eDec)}
          unit={`J (${fmt(lossPct, 0)} %)`}
        />
      </Readouts>

      <Formula label="Bevaring av bevegelsesmengde">
        <FormulaLine>
          Før: m<Sub>1</Sub>v<Sub>1</Sub> + m<Sub>2</Sub>v<Sub>2</Sub> = {fmt(s.m1, 1)} kg · {speed(s.v1)} + {fmt(s.m2, 1)} kg ·{' '}
          {speed(s.v2)} = {fmt(r.pBefore, 2)} kg·m/s
        </FormulaLine>
        <FormulaLine>
          Etter: m<Sub>1</Sub>v<Sub>1</Sub>′ + m<Sub>2</Sub>v<Sub>2</Sub>′ = {fmt(s.m1, 1)} kg · {speed(r.u1)} + {fmt(s.m2, 1)} kg ·{' '}
          {speed(r.u2)} = {fmt(r.pAfter, 2)} kg·m/s
        </FormulaLine>
        <FormulaLine>
          E<Sub>k</Sub> før = {fmt(r.EkBefore, eDec)} J, E<Sub>k</Sub> etter = {fmt(r.EkAfter, eDec)} J
        </FormulaLine>
      </Formula>

      <Explain>{explanation(s, r, lossPct)}</Explain>
    </VizLayout>
  );
}

/** Fart i en utregning: negative tall i parentes, «1,0 kg · (−0,67 m/s)». */
function speed(v: number): string {
  const t = `${fmt(v, 2)} m/s`;
  return v < -0.005 ? `(${t})` : t;
}

/** Posisjonen (m) til høyre kant av vogn 1 og venstre kant av vogn 2 ved tiden t. */
function positions(s: State, r: CollisionResult, t: number): [number, number] {
  if (!r.collides) return [s.v1 * t - 0.3, s.v2 * t + 0.3];
  const dt = t - T_HIT;
  return dt < 0 ? [s.v1 * dt, s.v2 * dt] : [r.u1 * dt, r.u2 * dt];
}

function Scene({ s, r, t }: { s: State; r: CollisionResult; t: number }) {
  const f = useTextScale();
  const w1 = cartWidth(s.m1);
  const w2 = cartWidth(s.m2);
  // Luft til fartspilene (fra midten av vogna) på utsiden av vognene
  const arrow = (v: number, w: number) => Math.max(34, Math.abs(v) * PX_PER_MS - w / 2 + 14);
  const pad1 = arrow(Math.max(Math.abs(s.v1), Math.abs(r.u1)), w1);
  const pad2 = arrow(Math.max(Math.abs(s.v2), Math.abs(r.u2)), w2);
  const samples = [0, T_HIT, T_END].map((tt) => positions(s, r, tt));
  const x1s = samples.map((p) => p[0]);
  const x2s = samples.map((p) => p[1]);
  const fit = fitTrack(
    [
      [Math.min(...x1s), Math.max(...x1s), w1 + pad1, pad1],
      [Math.min(...x2s), Math.max(...x2s), pad2, w2 + pad2],
    ],
    20,
    780,
    150,
  );
  const [p1, p2] = positions(s, r, t);
  const right1 = fit.origin + p1 * fit.scale;
  const left2 = fit.origin + p2 * fit.scale;
  const after = r.collides && t >= T_HIT;
  const stuck = after && s.kind === 'fullstendig';
  const top = GROUND - 2 * WHEEL_R - CART_H;
  const arrowY = top - 18;
  const c1 = right1 - w1 / 2;
  const c2 = left2 + w2 / 2;
  const prime = after ? '′' : '';
  return (
    <>
      <Ground x1={20} x2={780} y={GROUND} />
      <Cart x={right1 - w1} ground={GROUND} w={w1} color={C1} name="1" />
      <Cart x={left2} ground={GROUND} w={w2} color={C2} name="2" />
      {stuck && <rect x={right1 - 9} y={top + 24} width={18} height={18} rx={3} fill={VIZ.bodyStrong} className="viz-block" />}
      {stuck ? (
        <VelocityArrow cx={right1} y={arrowY} v={r.u1} pxPerMs={PX_PER_MS} name="v′" />
      ) : (
        <>
          <VelocityArrow
            cx={c1}
            y={arrowY}
            v={after ? r.u1 : s.v1}
            pxPerMs={PX_PER_MS}
            name={
              <>
                v<TSub>1</TSub>
                {prime}
              </>
            }
          />
          {/* Litt høyere enn pila til vogn 1, så pilene ikke ligger oppå hverandre når de peker samme vei */}
          <VelocityArrow
            cx={c2}
            y={arrowY - 12}
            v={after ? r.u2 : s.v2}
            pxPerMs={PX_PER_MS}
            name={
              <>
                v<TSub>2</TSub>
                {prime}
              </>
            }
          />
        </>
      )}
      <Label x={24} y={30 + 4 * f} anchor="start" muted>
        {!r.collides ? 'Vognene treffer ikke hverandre' : after ? 'Etter støtet' : 'Før støtet'}
      </Label>
    </>
  );
}

function Bars({ s, r, height }: { s: State; r: CollisionResult; height: number }) {
  const ek = (m: number, v: number) => 0.5 * m * v * v;
  const decimals = (vals: number[]) => {
    const big = Math.max(...vals.map(Math.abs));
    return big >= 10 ? 1 : big < 0.1 ? 3 : 2;
  };
  const pVals = [s.m1 * s.v1, s.m2 * s.v2, s.m1 * r.u1, s.m2 * r.u2, r.pBefore];
  return (
    <>
      <BarPanel
        x={0}
        width={390}
        height={height}
        decimals={decimals(pVals)}
        title={<>p (kg·m/s)</>}
        groups={[
          {
            label: 'Før',
            bars: [
              { value: s.m1 * s.v1, color: C1 },
              { value: s.m2 * s.v2, color: C2 },
              { value: r.pBefore, color: VIZ.ink, showValue: true },
            ],
          },
          {
            label: 'Etter',
            bars: [
              { value: s.m1 * r.u1, color: C1 },
              { value: s.m2 * r.u2, color: C2 },
              { value: r.pAfter, color: VIZ.ink, showValue: true },
            ],
          },
        ]}
      />
      <line x1={400} y1={20} x2={400} y2={height - 20} stroke={VIZ.grid} strokeWidth={2} />
      <BarPanel
        x={410}
        width={390}
        height={height}
        decimals={decimals([r.EkBefore])}
        title={
          <>
            E<TSub>k</TSub> (J)
          </>
        }
        groups={[
          {
            label: 'Før',
            bars: [
              { value: ek(s.m1, s.v1), color: C1 },
              { value: ek(s.m2, s.v2), color: C2 },
              { value: r.EkBefore, color: VIZ.ink, showValue: true },
            ],
          },
          {
            label: 'Etter',
            bars: [
              { value: ek(s.m1, r.u1), color: C1 },
              { value: ek(s.m2, r.u2), color: C2 },
              { value: r.EkAfter, color: VIZ.ink, showValue: true, ghost: r.EkBefore },
            ],
          },
        ]}
      />
    </>
  );
}

function explanation(s: State, r: CollisionResult, lossPct: number): ReactNode {
  const p = `${fmt(r.pBefore, 2)} kg·m/s`;
  const eDec = r.EkBefore < 0.1 ? 3 : 2;
  const vector =
    s.v1 < 0 || s.v2 < 0 || r.u1 < -1e-9 || r.u2 < -1e-9
      ? ' Husk at p er en vektor: fart mot venstre regnes negativ, og da er også bevegelsesmengden negativ.'
      : '';
  if (!r.collides)
    return (
      <p>
        <strong>Ingen støt.</strong> Vogn 1 tar aldri igjen vogn 2 fordi v<Sub>1</Sub> ≤ v<Sub>2</Sub>. Gjør v<Sub>1</Sub> større enn v
        <Sub>2</Sub>, for eksempel ved å la vogn 2 kjøre mot venstre.
      </p>
    );
  if (s.kind === 'elastisk') {
    const swap = Math.abs(s.m1 - s.m2) < 1e-9;
    const bounce = s.v2 === 0 && s.m1 < s.m2;
    return (
      <p>
        <strong>Elastisk støt.</strong> Både bevegelsesmengden og den kinetiske energien er bevart: Σp = {p} og E<Sub>k</Sub> ={' '}
        {fmt(r.EkBefore, eDec)} J både før og etter.{' '}
        {swap
          ? 'Med like masser bytter vognene fart.'
          : bounce
            ? 'Vogn 1 er lettest, så den spretter tilbake, mens vogn 2 får fart fremover.'
            : 'Farten etter finner vi ved å bruke begge bevaringslovene sammen.'}
        {vector}
      </p>
    );
  }
  if (s.kind === 'uelastisk')
    return (
      <p>
        <strong>Uelastisk støt.</strong> Bevegelsesmengden er bevart, Σp = {p}, men {fmt(r.lost, eDec)} J ({fmt(lossPct, 0)} %) av den
        kinetiske energien går over til andre energiformer, mest indre energi: vognene blir deformert og litt varmere, og noe blir lyd. Σp
        er alltid bevart i et støt fordi kreftene mellom vognene er indre krefter, men E<Sub>k</Sub> er bare bevart i elastiske støt.
        {vector}
      </p>
    );
  const allLost = Math.abs(r.pBefore) < 1e-9;
  return (
    <p>
      <strong>Fullstendig uelastisk støt.</strong> Vognene henger sammen og får felles fart v′ = (m<Sub>1</Sub>v<Sub>1</Sub> + m<Sub>2</Sub>
      v<Sub>2</Sub>)/(m<Sub>1</Sub> + m<Sub>2</Sub>) = {fmt(r.u1, 2)} m/s. Det gir størst mulig tap av kinetisk energi:{' '}
      {fmt(maxLoss(s.m1, s.v1, s.m2, s.v2), eDec)} J ({fmt(lossPct, 0)} %).
      {allLost ? ' Her er Σp = 0, så vognene stopper helt, og all den kinetiske energien går over til andre energiformer.' : ''}
      {vector}
    </p>
  );
}
