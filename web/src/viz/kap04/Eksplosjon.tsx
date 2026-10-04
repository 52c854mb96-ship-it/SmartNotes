import { useEffect, useState, type ReactNode } from 'react';
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
  PlayControls,
  Readout,
  Readouts,
  Segmented,
  Slider,
  Spring,
  Sub,
  TSub,
  Toolbar,
  VIZ,
  VizLayout,
  fmt,
  useSimClock,
  useTextScale,
} from '../kit';
import { BarPanel } from './Bars';
import { CART_H, Cart, WHEEL_R, cartWidth } from './Cart';
import { explode, fitTrack, type ExplosionResult } from './model';
import { useNarrow } from './useNarrow';

type ScenarioId = 'fjaer' | 'gevaer';

const OPTIONS: { value: ScenarioId; label: string }[] = [
  { value: 'fjaer', label: 'Vogner med fjær' },
  { value: 'gevaer', label: 'Gevær og kule' },
];

/** Utløsning og slutt på animasjonen (s), og hvor fort klokka går (simulert tid per sekund). */
const TIMING: Record<ScenarioId, { release: number; end: number; speed: number; decimals: number }> = {
  fjaer: { release: 0.5, end: 3, speed: 1, decimals: 2 },
  gevaer: { release: 0.0005, end: 0.003, speed: 0.001, decimals: 4 },
};

const C1 = VIZ.series[0] ?? VIZ.velocity;
const C2 = VIZ.series[1] ?? VIZ.gravity;
const GROUND = 196;
const SPRING_SHORT = 26;
const SPRING_LONG = 74;
const RIFLE_W = 280;
const BULLET_W = 30;

interface Inputs {
  /** Masser i kg og energi i J. */
  m1: number;
  m2: number;
  E: number;
}

export default function Eksplosjon() {
  const [id, setId] = useState<ScenarioId>('fjaer');
  const [carts, setCarts] = useState<Inputs>({ m1: 1, m2: 3, E: 6 });
  const [rifle, setRifle] = useState<Inputs>({ m1: 4, m2: 0.01, E: 3500 });
  const timing = TIMING[id];
  const clock = useSimClock({ tMax: timing.end, speed: timing.speed });
  const { setT, pause } = clock;
  // Vis situasjonen etter utløsningen når siden åpnes og når situasjonen byttes. «Spill av» starter fra ro.
  useEffect(() => {
    pause();
    setT(TIMING[id].end);
  }, [id, pause, setT]);
  const [barsRef, narrow] = useNarrow<HTMLDivElement>();

  const inp = id === 'fjaer' ? carts : rifle;
  const r = explode(inp.m1, inp.m2, inp.E);
  const released = clock.t >= timing.release;

  return (
    <VizLayout>
      <Toolbar>
        <Segmented label="Velg situasjon" options={OPTIONS} value={id} onChange={setId} />
      </Toolbar>
      {id === 'fjaer' ? (
        <Controls>
          <Slider
            label={
              <>
                Masse m<Sub>1</Sub>
              </>
            }
            ariaLabel="Masse til vogn 1"
            value={carts.m1}
            onChange={(m1) => setCarts((p) => ({ ...p, m1 }))}
            min={0.5}
            max={5}
            step={0.1}
            unit="kg"
            decimals={1}
          />
          <Slider
            label={
              <>
                Masse m<Sub>2</Sub>
              </>
            }
            ariaLabel="Masse til vogn 2"
            value={carts.m2}
            onChange={(m2) => setCarts((p) => ({ ...p, m2 }))}
            min={0.5}
            max={5}
            step={0.1}
            unit="kg"
            decimals={1}
          />
          <Slider
            label="Energi i fjæra"
            value={carts.E}
            onChange={(E) => setCarts((p) => ({ ...p, E }))}
            min={0.5}
            max={10}
            step={0.5}
            unit="J"
            decimals={1}
          />
        </Controls>
      ) : (
        <Controls>
          <Slider
            label="Masse til geværet"
            value={rifle.m1}
            onChange={(m1) => setRifle((p) => ({ ...p, m1 }))}
            min={2}
            max={8}
            step={0.1}
            unit="kg"
            decimals={1}
          />
          <Slider
            label="Masse til kula"
            value={rifle.m2 * 1000}
            onChange={(g) => setRifle((p) => ({ ...p, m2: g / 1000 }))}
            min={5}
            max={30}
            step={1}
            unit="g"
          />
          <Slider
            label="Energi fra kruttet"
            value={rifle.E / 1000}
            onChange={(kJ) => setRifle((p) => ({ ...p, E: kJ * 1000 }))}
            min={0.5}
            max={4}
            step={0.1}
            unit="kJ"
            decimals={1}
          />
        </Controls>
      )}
      <Toolbar>
        <PlayControls clock={clock} decimals={timing.decimals} />
      </Toolbar>

      <Figure
        viewBox="0 0 800 220"
        label={
          id === 'fjaer'
            ? `To vogner i ro med en sammenpresset fjær mellom seg. Etter utløsningen får vogn 1 farten ${fmt(r.v1, 2)} m/s og vogn 2 farten ${fmt(r.v2, 2)} m/s.`
            : `Gevær som skyter ut en kule. Kula får farten ${fmt(r.v2, 0)} m/s, og geværet får rekylfarten ${fmt(r.v1, 2)} m/s.`
        }
        maxHeight={300}
      >
        <Scene id={id} inp={inp} r={r} t={clock.t} />
      </Figure>

      <div ref={barsRef}>
        <Figure
          viewBox={`0 0 800 ${narrow ? 380 : 300}`}
          label="Søylediagram over bevegelsesmengde og kinetisk energi før og etter"
          maxHeight={340}
        >
          <Bars id={id} r={r} E={inp.E} height={narrow ? 380 : 300} />
        </Figure>
      </div>
      <Legend
        items={[
          { color: C1, label: id === 'fjaer' ? 'Vogn 1' : 'Geværet' },
          { color: C2, label: id === 'fjaer' ? 'Vogn 2' : 'Kula' },
          { color: VIZ.ink, label: 'Sum for begge' },
        ]}
      />

      <Readouts>
        <Readout
          label={
            <span>
              {id === 'fjaer' ? 'Fart til vogn 1' : 'Rekylfart'}, v<Sub>1</Sub>
            </span>
          }
          value={fmt(r.v1, 2)}
          unit="m/s"
          tone={C1}
        />
        <Readout
          label={
            <span>
              {id === 'fjaer' ? 'Fart til vogn 2' : 'Fart til kula'}, v<Sub>2</Sub>
            </span>
          }
          value={fmt(r.v2, id === 'fjaer' ? 2 : 0)}
          unit="m/s"
          tone={C2}
        />
        <Readout label="Σp etter" value={fmt(r.p1 + r.p2, 2)} unit="kg·m/s" />
        <Readout
          label={
            <span>
              Andel av E<Sub>k</Sub> til {id === 'fjaer' ? 'vogn 2' : 'kula'}
            </span>
          }
          value={fmt((100 * r.Ek2) / (r.Ek1 + r.Ek2), 1)}
          unit="%"
        />
      </Readouts>

      <Formula label="Bevaring av bevegelsesmengde">
        <FormulaLine>
          Σp = m<Sub>1</Sub>v<Sub>1</Sub> + m<Sub>2</Sub>v<Sub>2</Sub> = {mass(inp.m1)} · ({fmt(r.v1, 2)} m/s) + {mass(inp.m2)} ·{' '}
          {fmt(r.v2, id === 'fjaer' ? 2 : 0)} m/s = 0
        </FormulaLine>
        <FormulaLine>
          v<Sub>2</Sub>/|v<Sub>1</Sub>| = m<Sub>1</Sub>/m<Sub>2</Sub> = {fmt(inp.m1 / inp.m2, inp.m1 / inp.m2 >= 10 ? 0 : 2)}
        </FormulaLine>
        <FormulaLine>
          E<Sub>k</Sub> = p²/(2m) gir E<Sub>k1</Sub> = {energy(r.Ek1)} og E<Sub>k2</Sub> = {energy(r.Ek2)}
        </FormulaLine>
      </Formula>

      <Explain>{explanation(id, inp, r, released)}</Explain>
    </VizLayout>
  );
}

function mass(m: number): string {
  return m < 0.1 ? `${fmt(m * 1000, 0)} g` : `${fmt(m, 1)} kg`;
}

function energy(E: number): string {
  return E >= 1000 ? `${fmt(E / 1000, 2)} kJ` : E >= 100 ? `${fmt(E, 0)} J` : E >= 1 ? `${fmt(E, 2)} J` : `${fmt(E, 3)} J`;
}

function Scene({ id, inp, r, t }: { id: ScenarioId; inp: Inputs; r: ExplosionResult; t: number }) {
  const f = useTextScale();
  const { release, end } = TIMING[id];
  const rifle = id === 'gevaer';
  const w1 = rifle ? RIFLE_W : cartWidth(inp.m1);
  const w2 = rifle ? BULLET_W : cartWidth(inp.m2);
  // Avstanden mellom legemene i ro: fjæra er presset sammen, kula ligger inne i løpet.
  const gap = rifle ? -BULLET_W : SPRING_SHORT;
  // Fartspiler: samme skala for begge, så forskjellen i fart syns (geværets pil blir bitteliten).
  const vMax = Math.max(Math.abs(r.v1), Math.abs(r.v2), 1e-9);
  const pxPerMs = Math.min(rifle ? Infinity : 30, 130 / vMax);
  // Luft til fartspilene på utsiden av legemene
  const pad1 = Math.max(30, Math.abs(r.v1) * pxPerMs - (rifle ? 150 : w1 / 2) + 14);
  const pad2 = Math.max(30, Math.abs(r.v2) * pxPerMs - w2 / 2 + 14);
  const x1End = r.v1 * (end - release);
  const x2End = r.v2 * (end - release);
  const fit = fitTrack(
    [
      [Math.min(0, x1End), Math.max(0, x1End), w1 + gap / 2 + pad1, 30 - gap / 2],
      [Math.min(0, x2End), Math.max(0, x2End), 30 - gap / 2, w2 + gap / 2 + pad2],
    ],
    20,
    780,
    rifle ? 400 : 140,
  );
  const dt = Math.max(0, t - release);
  const released = t >= release;
  const right1 = fit.origin + r.v1 * dt * fit.scale - gap / 2;
  const left2 = fit.origin + r.v2 * dt * fit.scale + gap / 2;

  const top = GROUND - 2 * WHEEL_R - CART_H;
  const arrowY = rifle ? GROUND - 122 : top - 22;
  const labelY = arrowY - 16 - 8 * f;
  const c1 = rifle ? right1 - 150 : right1 - w1 / 2;
  const c2 = rifle ? left2 + w2 / 2 : left2 + w2 / 2;
  const unit2 = rifle ? 0 : 2;
  const half = 72 * f;
  const full = c2 - c1 > 2 * half + 12;
  const inside = (x: number) => Math.min(790 - half, Math.max(10 + half, x));

  return (
    <>
      <Ground x1={20} x2={780} y={GROUND} hatch={!rifle} />
      {rifle ? (
        <>
          <Rifle muzzle={right1} axis={GROUND - 82} />
          <Bullet x={left2} axis={GROUND - 82} />
          <Label x={right1 - 200} y={GROUND - 8} anchor="middle" muted>
            gevær, {mass(inp.m1)}
          </Label>
        </>
      ) : (
        <>
          {released ? (
            <Spring
              x1={right1}
              y1={top + CART_H / 2 + 4}
              x2={right1 + Math.min(SPRING_LONG, left2 - right1)}
              y2={top + CART_H / 2 + 4}
              coils={7}
              amplitude={9}
            />
          ) : (
            <>
              <Spring x1={right1} y1={top + CART_H / 2 + 4} x2={left2} y2={top + CART_H / 2 + 4} coils={7} amplitude={11} />
              <line x1={right1 - 14} y1={top + 4} x2={left2 + 14} y2={top + 4} stroke={VIZ.tension} strokeWidth={2} />
            </>
          )}
          <Cart x={right1 - w1} ground={GROUND} w={w1} color={C1} name="1" />
          <Cart x={left2} ground={GROUND} w={w2} color={C2} name="2" />
        </>
      )}

      {released ? (
        <>
          <Arrow x1={c1} y1={arrowY} x2={c1 + r.v1 * pxPerMs} y2={arrowY} color={VIZ.velocity} minLength={3} />
          <Arrow x1={c2} y1={arrowY} x2={c2 + r.v2 * pxPerMs} y2={arrowY} color={VIZ.velocity} minLength={3} />
          {/* Med tallverdi når det er plass, ellers bare navnet (rett etter utløsningen står legemene tett) */}
          <Label x={full ? inside(c1) : c1} y={labelY} anchor="middle" color={VIZ.velocity}>
            v<TSub>1</TSub>
            {full && ` = ${fmt(r.v1, 2)} m/s`}
          </Label>
          <Label x={full ? inside(c2) : c2} y={labelY} anchor="middle" color={VIZ.velocity}>
            v<TSub>2</TSub>
            {full && ` = ${fmt(r.v2, unit2)} m/s`}
          </Label>
        </>
      ) : (
        <Label x={400} y={rifle ? GROUND - 122 : top - 30} anchor="middle" muted>
          {rifle ? 'Kula ligger i løpet' : 'Snora holder fjæra sammenpresset'}
        </Label>
      )}
    </>
  );
}

function Rifle({ muzzle, axis }: { muzzle: number; axis: number }) {
  const x = muzzle;
  return (
    <g>
      <path
        d={`M ${x - 210} ${axis - 11} L ${x - 280} ${axis + 2} L ${x - 280} ${axis + 34} L ${x - 250} ${axis + 34} L ${x - 196} ${axis + 15} Z`}
        fill={VIZ.body}
        className="viz-block"
        strokeLinejoin="round"
      />
      <rect x={x - 212} y={axis - 12} width={92} height={27} rx={5} fill={VIZ.bodyStrong} className="viz-block" />
      <rect x={x - 160} y={axis - 6} width={160} height={12} rx={3} fill={VIZ.bodyStrong} className="viz-block" />
      <path d={`M ${x - 176} ${axis + 15} q 4 16 18 14`} fill="none" stroke={VIZ.muted} strokeWidth={2.5} />
    </g>
  );
}

function Bullet({ x, axis }: { x: number; axis: number }) {
  return (
    <path
      d={`M ${x} ${axis - 6} L ${x + BULLET_W - 11} ${axis - 6} Q ${x + BULLET_W} ${axis} ${x + BULLET_W - 11} ${axis + 6} L ${x} ${axis + 6} Z`}
      fill={C2}
    />
  );
}

function Bars({ id, r, E, height }: { id: ScenarioId; r: ExplosionResult; E: number; height: number }) {
  const big = id === 'gevaer';
  const pDec = Math.abs(r.p2) >= 10 ? 1 : 2;
  return (
    <>
      <BarPanel
        x={0}
        width={390}
        height={height}
        decimals={pDec}
        title={<>p (kg·m/s)</>}
        groups={[
          {
            label: 'Før',
            bars: [
              { value: 0, color: C1 },
              { value: 0, color: C2 },
              { value: 0, color: VIZ.ink, showValue: true },
            ],
          },
          {
            label: 'Etter',
            bars: [
              { value: r.p1, color: C1 },
              { value: r.p2, color: C2 },
              { value: r.p1 + r.p2, color: VIZ.ink, showValue: true },
            ],
          },
        ]}
      />
      <line x1={400} y1={20} x2={400} y2={height - 20} stroke={VIZ.grid} strokeWidth={2} />
      <BarPanel
        x={410}
        width={390}
        height={height}
        decimals={big ? 0 : E >= 10 ? 1 : 2}
        title={
          <>
            E<TSub>k</TSub> (J)
          </>
        }
        groups={[
          {
            label: 'Før',
            bars: [
              { value: 0, color: C1 },
              { value: 0, color: C2 },
              { value: 0, color: VIZ.ink, showValue: true },
            ],
          },
          {
            label: 'Etter',
            bars: [
              { value: r.Ek1, color: C1 },
              { value: r.Ek2, color: C2 },
              { value: r.Ek1 + r.Ek2, color: VIZ.ink, showValue: true },
            ],
          },
        ]}
      />
    </>
  );
}

function explanation(id: ScenarioId, inp: Inputs, r: ExplosionResult, released: boolean): ReactNode {
  const p = `${fmt(r.p2, 2)} kg·m/s`;
  const start = released ? null : (
    <p>
      Før utløsningen står alt i ro, så Σp = 0 og E<Sub>k</Sub> = 0. Trykk «Spill av» og se hva som skjer.
    </p>
  );
  if (id === 'gevaer') {
    const ratio = inp.m1 / inp.m2;
    return (
      <>
        {start}
        <p>
          <strong>Rekyl.</strong> Kruttgassen dytter kula fremover og geværet bakover med like store krefter i like lang tid (Newtons 3.
          lov), så de får like store og motsatt rettede bevegelsesmengder, p = {p}, og Σp = 0. Geværet har {fmt(ratio, 0)} ganger så stor
          masse, så rekylfarten blir bare {fmt(Math.abs(r.v1), 2)} m/s, og kula får {fmt((100 * r.Ek2) / (r.Ek1 + r.Ek2), 1)} % av energien.
          Når du holder geværet inntil skulderen, er det du og geværet sammen som får rekylen, og da blir farten enda mindre.
        </p>
      </>
    );
  }
  const equal = Math.abs(inp.m1 - inp.m2) < 1e-9;
  const light = inp.m1 < inp.m2 ? 'vogn 1' : 'vogn 2';
  return (
    <>
      {start}
      <p>
        <strong>Σp = 0 før og etter.</strong> Fjærkraften er en indre kraft, så den kan ikke endre den totale bevegelsesmengden. Vognene får
        like store og motsatt rettede bevegelsesmengder, p = {p}.{' '}
        {equal ? (
          'Massene er like, så vognene får like stor fart og deler energien likt.'
        ) : (
          <>
            Den letteste vogna ({light}) får størst fart, |v| = p/m, og mest energi, fordi E<Sub>k</Sub> = p²/(2m): {light} får{' '}
            {energy(inp.m1 < inp.m2 ? r.Ek1 : r.Ek2)} av {energy(inp.E)}.
          </>
        )}
      </p>
    </>
  );
}
