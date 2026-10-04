import { useEffect, useState, type ReactNode } from 'react';
import {
  Arrow,
  Controls,
  Explain,
  Figure,
  Formula,
  FormulaLine,
  G_EARTH,
  Label,
  Legend,
  PlayControls,
  Plot,
  Readout,
  Readouts,
  Slider,
  Sub,
  Toolbar,
  VIZ,
  VizLayout,
  fmt,
  linePath,
  niceTicks,
  sample,
  useSimClock,
  useTextScale,
} from '../kit';
import { flightTime, impactSpeed, maxHeight, niceRange, throwHeight, throwVelocity, topTime, type Throw } from './model';
import { useNarrow } from './useNarrow';
import { ColorDot } from './marks';

/** Bredden på scenen til venstre for s-t-grafen (figurens enheter). */
const SCENE_W = 230;
const BALL_X = 96;

export default function LoddrettKast() {
  const [v0, setV0] = useState(12);
  const [h0, setH0] = useState(0);
  const th: Throw = { v0, h0 };
  const T = flightTime(th);
  const tTop = topTime(th);
  const clock = useSimClock({ tMax: T });
  const { setT, pause } = clock;
  // Start i toppunktet: der er v = 0, men a = −g.
  useEffect(() => setT(12 / G_EARTH), [setT]);
  const { ref, narrow } = useNarrow();

  const t = Math.min(Math.max(clock.t, 0), T);
  const s = throwHeight(th, t);
  const v = throwVelocity(th, t);
  const sMax = maxHeight(th);
  const vImp = impactSpeed(th);

  const update = (next: Throw) => {
    // En ball på bakken kan ikke kastes nedover
    const fixed = next.h0 <= 0 && next.v0 < 0 ? { ...next, v0: 0 } : next;
    setV0(fixed.v0);
    setH0(fixed.h0);
    pause();
    if (clock.t > flightTime(fixed)) setT(flightTime(fixed));
  };

  const heightA = narrow ? 620 : 420;
  const heightB = narrow ? 440 : 300;

  return (
    <VizLayout>
      <Controls>
        <Slider
          label={
            <>
              Startfart v<Sub>0</Sub> (opp er positiv)
            </>
          }
          ariaLabel="Startfart, positiv oppover"
          value={v0}
          onChange={(x) => update({ v0: x, h0 })}
          min={-10}
          max={25}
          step={0.5}
          unit="m/s"
          decimals={1}
        />
        <Slider label="Starthøyde" value={h0} onChange={(x) => update({ v0, h0: x })} min={0} max={40} step={1} unit="m" decimals={0} />
        {/* Største verdi rundet ned til et helt steg, ellers justerer nettleseren den */}
        <Slider
          label="Tidspunkt t"
          value={t}
          onChange={(x) => setT(x >= Math.floor(T * 100) / 100 ? T : x)}
          min={0}
          max={Math.floor(T * 100) / 100}
          step={0.01}
          unit="s"
          decimals={2}
        />
      </Controls>
      <Toolbar>
        <PlayControls clock={clock} />
        {tTop !== null && (
          <button
            type="button"
            className="btn btn-sm"
            onClick={() => {
              pause();
              setT(tTop);
            }}
          >
            Gå til toppunktet
          </button>
        )}
      </Toolbar>

      <div ref={ref}>
        <Figure
          viewBox={`0 0 800 ${heightA}`}
          label={`Ball som kastes loddrett med startfart ${fmt(v0, 1)} m/s fra ${fmt(h0, 0)} m høyde, og s-t-grafen for kastet. Ved t = ${fmt(t, 2)} s er høyden ${fmt(s, 1)} m.`}
          maxHeight={narrow ? 700 : 480}
        >
          <SceneAndPosition th={th} t={t} T={T} height={heightA} narrow={narrow} />
        </Figure>
      </div>

      <Figure viewBox={`0 0 800 ${heightB}`} label="Fart-tid-graf for kastet. Linja har stigningstall −9,81 m/s² hele veien." maxHeight={narrow ? 500 : 340}>
        <VelocityGraph th={th} t={t} T={T} height={heightB} />
      </Figure>
      <Legend
        items={[
          { color: VIZ.series[0], label: 'Høyde s' },
          { color: VIZ.velocity, label: 'Fart v' },
          { color: VIZ.acceleration, label: 'Akselerasjon a = −g' },
        ]}
      />

      <Readouts>
        <Readout label="Høyde s" value={fmt(s, 1)} unit="m" tone={VIZ.series[0]} />
        <Readout label="Fart v" value={fmt(v, 1)} unit="m/s" tone={VIZ.velocity} />
        <Readout label="Akselerasjon a" value={T > 0 ? fmt(-G_EARTH, 2) : '0,00'} unit="m/s²" tone={VIZ.acceleration} />
        <Readout label={tTop !== null ? 'Toppunkt' : 'Treffer bakken med'} value={tTop !== null ? fmt(sMax, 1) : fmt(vImp, 1)} unit={tTop !== null ? 'm' : 'm/s'} />
      </Readouts>

      {T > 0 && (
        <Formula label="Bevegelseslikningene med a = −g og tallene for tidspunktet t">
          <FormulaLine>a = −g = −9,81 m/s²</FormulaLine>
          <FormulaLine>
            v = v<Sub>0</Sub> + at = {q(v0, 1, 'm/s')} + (−9,81 m/s²) · {fmt(t, 2)} s = {fmt(v, 1)} m/s
          </FormulaLine>
          <FormulaLine>
            s = s<Sub>0</Sub> + v<Sub>0</Sub>t + ½at²
          </FormulaLine>
          <FormulaLine>
            s = {fmt(h0, 1)} m + {q(v0, 1, 'm/s')} · {fmt(t, 2)} s − ½ · 9,81 m/s² · ({fmt(t, 2)} s)² = {fmt(s, 1)} m
          </FormulaLine>
          {tTop !== null && (
            <FormulaLine>
              Toppunkt: v = 0 gir t = v<Sub>0</Sub>/g = {fmt(v0, 1)} m/s / 9,81 m/s² = {fmt(tTop, 2)} s
            </FormulaLine>
          )}
        </Formula>
      )}

      <Explain>{explanation(th, t, T, v, vImp)}</Explain>
    </VizLayout>
  );
}

function q(value: number, decimals: number, unit: string): string {
  const text = `${fmt(value, decimals)} ${unit}`;
  return value < 0 && fmt(value, decimals) !== fmt(0, decimals) ? `(${text})` : text;
}

/* ---------- Scene og s-t-graf med felles høydeakse ---------- */

function SceneAndPosition({ th, t, T, height, narrow }: { th: Throw; t: number; T: number; height: number; narrow: boolean }) {
  const f = useTextScale();
  const sMax = maxHeight(th);
  // Luft over toppunktet så ballen ikke kolliderer med overskriften
  const [, yMax] = niceRange(0, Math.max(sMax * 1.2, 2), 5, 2);
  const [, tMax] = niceRange(0, Math.max(T, 1), 5, 1);
  const s = throwHeight(th, t);
  const v = throwVelocity(th, t);
  const tTop = topTime(th);
  const atTop = tTop !== null && Math.abs(v) < 0.25;
  const vAbsMax = Math.max(1, Math.abs(th.v0), impactSpeed(th));
  const k = narrow ? 1.4 : 1;
  const vLen = (v / vAbsMax) * 100 * k;
  const aLen = T > 0 ? 56 * k : 0;
  const width = 800 - SCENE_W;

  return (
    <g transform={`translate(${SCENE_W} 0)`}>
      <Plot
        x={{ min: 0, max: tMax, label: 'Tid t (s)', decimals: tMax < 3 ? 1 : 0 }}
        y={{ min: 0, max: yMax, label: 'Høyde s (m)', decimals: yMax < 4 ? 1 : 0 }}
        width={width}
        height={height}
        margin={{ top: 48 * f, right: 20 * f, bottom: 56 * f, left: 72 * f }}
      >
        {({ sx, sy, x0, y1 }) => (
          <g>
            <Label x={8 - SCENE_W} y={y1 - 22 * f} anchor="start" color={atTop ? VIZ.acceleration : VIZ.muted}>
              {T === 0 ? 'Ballen ligger på bakken' : atTop ? 'Toppunkt: v = 0, men a = −9,81 m/s²' : 'a = −9,81 m/s² hele tiden'}
            </Label>
            {T > 0 && (
              <>
                <path d={linePath(sample((x) => throwHeight(th, x), 0, T, 120), sx, sy)} fill="none" stroke={VIZ.series[0]} strokeWidth={2} opacity={0.35} />
                <path d={linePath(sample((x) => throwHeight(th, x), 0, t, 120), sx, sy)} fill="none" stroke={VIZ.series[0]} strokeWidth={3.5} />
              </>
            )}
            {tTop !== null && <line x1={x0} x2={sx(tTop)} y1={sy(sMax)} y2={sy(sMax)} className="viz-guide" />}
            {/* Hjelpelinje fra ballen til punktet i grafen */}
            <line x1={BALL_X - SCENE_W + 16} x2={sx(t)} y1={sy(s)} y2={sy(s)} stroke={VIZ.series[0]} strokeWidth={1.5} strokeDasharray="3 5" opacity={0.7} />
            <ColorDot x={sx(t)} y={sy(s)} color={VIZ.series[0]} />

            {/* Scenen til venstre, i samme høydeskala */}
            <g transform={`translate(${-SCENE_W} 0)`}>
              <line x1={8} x2={SCENE_W - 8} y1={sy(0)} y2={sy(0)} className="viz-ground" />
              {th.h0 > 0 && <rect x={14} y={sy(th.h0)} width={BALL_X - 30} height={sy(0) - sy(th.h0)} fill={VIZ.body} className="viz-block" />}
              {/* Banen ballen følger */}
              {T > 0 && (
                <line x1={BALL_X} x2={BALL_X} y1={sy(Math.max(sMax, th.h0))} y2={sy(0)} stroke={VIZ.muted} strokeWidth={1.5} strokeDasharray="2 6" />
              )}
              <circle cx={BALL_X} cy={sy(s) - 10 * k} r={10 * k} fill={VIZ.bodyStrong} className="viz-block" />
              <Arrow
                x1={BALL_X + 34 * k}
                y1={sy(s) - 10 * k + vLen / 2}
                x2={BALL_X + 34 * k}
                y2={sy(s) - 10 * k - vLen / 2}
                color={VIZ.velocity}
                width={3 * k}
                head={11 * k}
                label="v"
                labelX={BALL_X + 34 * k + 10}
                labelY={sy(s) - 10 * k - vLen / 2 + (vLen >= 0 ? 12 : 4)}
                labelAnchor="start"
                minLength={4}
              />
              {Math.abs(vLen) < 4 && T > 0 && (
                <Label x={BALL_X} y={sy(s) - 20 * k - 10} color={VIZ.velocity}>
                  v = 0
                </Label>
              )}
              <Arrow
                x1={BALL_X + 72 * k}
                y1={sy(s) - 10 * k - aLen / 2}
                x2={BALL_X + 72 * k}
                y2={sy(s) - 10 * k + aLen / 2}
                color={VIZ.acceleration}
                width={2.5 * k}
                head={11 * k}
                label="a"
                labelX={BALL_X + 72 * k + 10}
                labelY={sy(s) - 10 * k + aLen / 2}
                labelAnchor="start"
              />
            </g>
          </g>
        )}
      </Plot>
    </g>
  );
}

/* ---------- v-t-graf ---------- */

function VelocityGraph({ th, t, T, height }: { th: Throw; t: number; T: number; height: number }) {
  const f = useTextScale();
  const vImp = impactSpeed(th);
  const [vLo, vHi] = niceRange(Math.min(0, -vImp), Math.max(0, th.v0), 6, 4);
  const [, tMax] = niceRange(0, Math.max(T, 1), 5, 1);
  const tTop = topTime(th);
  const v = throwVelocity(th, t);
  // Stigningstrekant over 1 s tidlig i bevegelsen, når det er plass
  const t1 = 0.12 * T;
  const showTriangle = T >= 1.6;
  return (
    <Plot
      x={{ min: 0, max: tMax, label: 'Tid t (s)', decimals: tMax < 3 ? 1 : 0 }}
      y={{ min: vLo, max: vHi, label: 'v (m/s)', ticks: niceTicks(vLo, vHi, 4) }}
      width={800}
      height={height}
      margin={{ top: 34 * f, right: 24 * f, bottom: 56 * f, left: 72 * f }}
    >
      {({ sx, sy, x0, y0, y1 }) => (
        <g>
          <Label x={x0} y={y1 - 12} anchor="start" color={VIZ.acceleration}>
            Stigningstall = a = −9,81 m/s²
          </Label>
          {T > 0 && (
            <>
              <line x1={sx(0)} y1={sy(th.v0)} x2={sx(T)} y2={sy(-vImp)} stroke={VIZ.velocity} strokeWidth={2} opacity={0.35} />
              <line x1={sx(0)} y1={sy(th.v0)} x2={sx(t)} y2={sy(v)} stroke={VIZ.velocity} strokeWidth={3.5} />
            </>
          )}
          {showTriangle && (
            <g>
              <polyline
                points={`${sx(t1)},${sy(throwVelocity(th, t1))} ${sx(t1 + 1)},${sy(throwVelocity(th, t1))} ${sx(t1 + 1)},${sy(throwVelocity(th, t1 + 1))}`}
                fill="none"
                stroke={VIZ.acceleration}
                strokeWidth={2}
              />
              <Label x={sx(t1 + 0.5)} y={sy(throwVelocity(th, t1)) - 10} color={VIZ.acceleration}>
                1 s
              </Label>
              <Label x={sx(t1 + 1) + 10} y={sy(throwVelocity(th, t1 + 0.5)) + 6} anchor="start" color={VIZ.acceleration}>
                −9,81 m/s
              </Label>
            </g>
          )}
          {tTop !== null && tTop <= tMax && <circle cx={sx(tTop)} cy={sy(0)} r={6} fill={VIZ.surface} stroke={VIZ.velocity} strokeWidth={2.5} />}
          {t > 0 && <line x1={sx(t)} x2={sx(t)} y1={y1} y2={y0} className="viz-guide" />}
          <ColorDot x={sx(t)} y={sy(v)} color={VIZ.velocity} />
        </g>
      )}
    </Plot>
  );
}

/* ---------- Forklaring ---------- */

function explanation(th: Throw, t: number, T: number, v: number, vImp: number): ReactNode {
  const tTop = topTime(th);
  if (T === 0)
    return (
      <p>
        <strong>Ballen ligger på bakken.</strong> Gi den startfart oppover, eller løft starthøyden for å slippe eller kaste den nedover.
      </p>
    );
  const sym = th.h0 === 0;
  if (t >= T - 1e-3)
    return (
      <p>
        <strong>Ballen treffer bakken</strong> etter {fmt(T, 2)} s med fart {fmt(-vImp, 1)} m/s (negativ fordi den er på vei ned).{' '}
        {sym
          ? 'Farten er like stor som startfarten, men motsatt rettet, og ballen brukte like lang tid ned som opp.'
          : `Fra en høyde blir farten større enn startfarten: v² = v₀² + 2gh₀.`}
      </p>
    );
  if (tTop !== null && Math.abs(v) < 0.25)
    return (
      <p>
        <strong>I toppunktet er v = 0, men akselerasjonen er fortsatt a = −9,81 m/s².</strong> Hadde a vært null her, ville ballen blitt
        hengende i lufta. I v-t-grafen krysser linja t-aksen her, men stigningstallet er det samme som før og etter.
      </p>
    );
  if (t < 0.005)
    return (
      <p>
        <strong>
          {th.v0 > 0 ? 'Ballen kastes oppover' : th.v0 < 0 ? 'Ballen kastes nedover' : 'Ballen slippes'} med v<Sub>0</Sub> ={' '}
          {fmt(th.v0, 1)} m/s.
        </strong>{' '}
        Vi velger positiv retning oppover, så a = −g = −9,81 m/s² hele tiden: på vei opp, i toppunktet og på vei ned.
      </p>
    );
  if (v > 0)
    return (
      <p>
        <strong>På vei opp</strong> er v positiv og a negativ, så farten avtar med 9,81 m/s for hvert sekund. Ballen når toppunktet etter t =
        v<Sub>0</Sub>/g = {fmt(tTop ?? 0, 2)} s.
      </p>
    );
  return (
    <p>
      <strong>På vei ned</strong> er både v og a negative, så farten øker med 9,81 m/s for hvert sekund.{' '}
      {tTop !== null
        ? 'Akselerasjonen er nøyaktig den samme som på vei opp og i toppunktet.'
        : 'Akselerasjonen er −9,81 m/s² hele veien, enten ballen slippes eller kastes nedover.'}
      {sym && tTop !== null ? ' Bevegelsen er symmetrisk om toppunktet.' : ''}
    </p>
  );
}
