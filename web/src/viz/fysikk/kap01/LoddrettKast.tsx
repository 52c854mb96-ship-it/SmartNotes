import { useEffect, useState, type ReactNode } from 'react';
import {
  Controls,
  Explain,
  Figure,
  Formula,
  FormulaLine,
  G_EARTH,
  Legend,
  PlayControls,
  Plot,
  Readout,
  Readouts,
  Slider,
  Sub,
  TSub,
  Toggle,
  Toolbar,
  Txt,
  VIZ,
  VizLayout,
  fmt,
  linePath,
  niceTicks,
  sample,
  useSimClock,
  useTextScale,
} from '../../kit';
import {
  Ball,
  Dimension,
  ForceArrow,
  Himmel,
  Landskap,
  Person,
  Stoppeklokke,
  Underlag,
  personPunkter,
  useSceneScale,
  useStrokeScale,
  useSvgId,
  type Leddvinkler,
} from '../../kit/scene';
import {
  flightTime,
  impactSpeed,
  maxHeight,
  minAxisTopForGround,
  niceAxis,
  niceRange,
  throwAxisTop,
  throwBuilding,
  throwHeight,
  throwPhase,
  throwVelocity,
  topTime,
  type Throw,
  type ThrowPhase,
} from './model';
import { BLOKK_MAAL, Boligblokk, Rekkverk } from './loddrett-kast-deler';
import { useNarrow } from './useNarrow';
import { ColorDot } from './marks';

/** Startfarten ved oppstart (m/s). Figuren åpner i toppunktet, t = v₀/g. */
const V0_START = 12;

/**
 * Positur for begge personene: armene fram med håndflatene opp, klar til å kaste eller ta imot. Mia og Jonas har
 * hendene like høyt over der de står, så balkonggulvet ligger nøyaktig h₀ over bakken når ballen starter i s = h₀.
 */
const HENDER: Partial<Leddvinkler> = { hoyreSkulder: 75, hoyreAlbue: 40, venstreSkulder: 75, venstreAlbue: 40 };
/** Høyden til en person (m). */
const PERSON_M = 1.75;
/** Hånda (grepet) i meter fra ankerpunktet (midt mellom føttene): x fram, y opp. */
const HAND = (() => {
  const h = personPunkter('staa', PERSON_M, HENDER).hoyreHand;
  return { fram: h.x, opp: -h.y };
})();
/** Fra ballen til ytterkanten av balkongene (m), så ballen går klar av rekkverket. */
const KLARING = 0.45;

/** Desimaler på akseverdiene: 0 når alle verdiene er hele tall («1», ikke «1,0»). */
const tickDecimals = (lo: number, hi: number, count?: number): number => (niceTicks(lo, hi, count).every(Number.isInteger) ? 0 : 1);

export default function LoddrettKast() {
  const [v0, setV0] = useState(V0_START);
  const [h0, setH0] = useState(0);
  const [arrows, setArrows] = useState(true);
  const th: Throw = { v0, h0 };
  const T = flightTime(th);
  const tTop = topTime(th);
  const clock = useSimClock({ tMax: T });
  const { setT, pause } = clock;
  // Start i toppunktet: der er v = 0, men a = −g.
  useEffect(() => setT(V0_START / G_EARTH), [setT]);
  const { ref, narrow } = useNarrow();

  const t = Math.min(Math.max(clock.t, 0), T);
  const s = throwHeight(th, t);
  const v = throwVelocity(th, t);
  const sMax = maxHeight(th);
  const vImp = impactSpeed(th);
  const phase = throwPhase(th, t);

  const update = (next: Throw) => {
    // Fra s = 0 kan ballen ikke kastes nedover: den er der den skal tas imot.
    const fixed = next.h0 <= 0 && next.v0 < 0 ? { ...next, v0: 0 } : next;
    setV0(fixed.v0);
    setH0(fixed.h0);
    pause();
    if (clock.t > flightTime(fixed)) setT(flightTime(fixed));
  };

  const heightA = narrow ? 820 : 480;
  const heightB = narrow ? 470 : 300;
  const gap = narrow ? 16 : 10;

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
        <Slider
          label={
            <>
              Starthøyde h<Sub>0</Sub> (balkongen)
            </>
          }
          ariaLabel="Starthøyde, høyden til balkongen over bakken"
          value={h0}
          onChange={(x) => update({ v0, h0: x })}
          min={0}
          max={40}
          step={1}
          unit="m"
          decimals={0}
        />
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
        <Toggle label="Vis fart og akselerasjon" checked={arrows} onChange={setArrows} />
      </Toolbar>
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
          viewBox={`0 0 800 ${heightA + gap + heightB}`}
          label={figureLabel(th, t, s, v, T)}
          maxHeight={narrow ? 1400 : 900}
        >
          <ThrowFigure th={th} t={t} T={T} heightA={heightA} heightB={heightB} gap={gap} narrow={narrow} arrows={arrows} phase={phase} />
        </Figure>
      </div>
      <Legend
        items={[
          { color: VIZ.series[0], label: 'Høyde s' },
          { color: VIZ.velocity, label: 'Fart v' },
          { color: VIZ.velocity, label: 'Tangent i s-t-grafen: stigningstall = v', dashed: true },
          { color: VIZ.acceleration, label: 'Akselerasjon a = −g' },
        ]}
      />

      <Readouts>
        <Readout label="Høyde s" value={fmt(s, 1)} unit="m" tone={VIZ.series[0]} />
        <Readout label="Fart v" value={fmt(v, 1)} unit="m/s" tone={VIZ.velocity} />
        <Readout label="Akselerasjon a" value={T > 0 ? fmt(-G_EARTH, 2) : '0,00'} unit="m/s²" tone={VIZ.acceleration} />
        {tTop !== null ? (
          <Readout label="Høyde i toppunktet" value={fmt(sMax, 1)} unit="m" />
        ) : T > 0 ? (
          <Readout label="Fart når ballen tas imot" value={fmt(-vImp, 1)} unit="m/s" />
        ) : (
          <Readout label="Tid i lufta" value={fmt(T, 2)} unit="s" />
        )}
      </Readouts>

      {T > 0 && (
        <Formula label="Bevegelseslikningene med a = −g og tallene for tidspunktet t">
          <FormulaLine>a = −g = −9,81 m/s²</FormulaLine>
          <FormulaLine>
            v = v<Sub>0</Sub> + at = {q(v0, 1, 'm/s')} + (−9,81 m/s²) · {fmt(t, 2)} s = {fmt(v, 1)} m/s
          </FormulaLine>
          <FormulaLine>
            s = s<Sub>0</Sub> + v<Sub>0</Sub>t + ½at², med s<Sub>0</Sub> = h<Sub>0</Sub>
          </FormulaLine>
          <FormulaLine>
            s = {fmt(h0, 1)} m + {q(v0, 1, 'm/s')} · {fmt(t, 2)} s − ½ · 9,81 m/s² · ({fmt(t, 2)} s)² = {fmt(s, 1)} m
          </FormulaLine>
          {tTop !== null && (
            <FormulaLine>
              Toppunkt: v = 0 gir t = v<Sub>0</Sub>/g = {fmt(v0, 1)} m/s / 9,81 m/s² = {fmt(tTop, 2)} s
            </FormulaLine>
          )}
          {phase === 'slutt' && (
            <FormulaLine>
              Når ballen tas imot: v² = v<Sub>0</Sub>² + 2gh<Sub>0</Sub> gir |v| = √(({fmt(v0, 1)} m/s)² + 2 · 9,81 m/s² · {fmt(h0, 0)} m) ={' '}
              {fmt(vImp, 1)} m/s
            </FormulaLine>
          )}
        </Formula>
      )}

      <Explain>{explanation(th, T, v, vImp, phase)}</Explain>
    </VizLayout>
  );
}

function q(value: number, decimals: number, unit: string): string {
  const text = `${fmt(value, decimals)} ${unit}`;
  return value < 0 && fmt(value, decimals) !== fmt(0, decimals) ? `(${text})` : text;
}

function figureLabel(th: Throw, t: number, s: number, v: number, T: number): string {
  const where = th.h0 > 0 ? `fra en balkong ${fmt(th.h0, 0)} m over der Jonas tar imot ballen i skolegården` : 'i skolegården og tar den igjen';
  if (T === 0) return 'Mia står i skolegården med ballen i hendene. Under scenen er s-t-grafen og v-t-grafen.';
  return (
    `Mia kaster en tennisball rett opp med startfart ${fmt(th.v0, 1)} m/s ${where}. Ved t = ${fmt(t, 2)} s er høyden ` +
    `${fmt(s, 1)} m og farten ${fmt(v, 1)} m/s. Til høyre er s-t-grafen og under v-t-grafen, med samme tidsakse.`
  );
}

/* ---------- Hele figuren: scenen og s-t-grafen med felles høydeakse, stoppeklokke og v-t-graf ---------- */

function ThrowFigure({
  th,
  t,
  T,
  heightA,
  heightB,
  gap,
  narrow,
  arrows,
  phase,
}: {
  th: Throw;
  t: number;
  T: number;
  heightA: number;
  heightB: number;
  gap: number;
  narrow: boolean;
  arrows: boolean;
  phase: ThrowPhase;
}) {
  const f = useTextScale();
  const k = useSceneScale();
  const SW = narrow ? 320 : 300;
  const margin = { top: 48 * f, right: 22 * f, bottom: 74 * f, left: 72 * f };
  const y1 = margin.top;
  const y0 = heightA - margin.bottom;
  const plotH = y0 - y1;
  // Ballen er tegnet større enn i virkeligheten (en tennisball er 6,6 cm), ellers ville den ikke synes.
  const rBall = 7 * Math.max(1, 0.9 * k);
  const rOff = rBall * 0.8;
  const panelBottom = heightA - 3;
  // Bakken ligger HAND.opp under s = 0 (hendene til Jonas): høydeaksen må være så lang at den får plass.
  const minTop = Math.max(9, minAxisTopForGround(HAND.opp, plotH, panelBottom - 6 * k - y0 - rOff));
  const yMax = throwAxisTop(th, minTop);
  const [, tMax] = niceRange(0, Math.max(T, 1), 5, 1);
  const p = plotH / yMax;
  const sy = (s: number) => y0 - s * p;
  const x0 = SW + margin.left;
  const x1 = 800 - margin.right;
  const sx = (tt: number) => x0 + (tt / tMax) * (x1 - x0);
  const s = throwHeight(th, t);
  const tTop = topTime(th);
  const sMax = maxHeight(th);
  const catcher = th.h0 > 0;
  const pathX = ballX(SW, f, k, p, rBall, catcher);
  const header =
    phase === 'ro' ? 'Ballen ligger i ro i hendene' : phase === 'topp' ? 'Toppunkt: v = 0, men a = −9,81 m/s²' : 'a = −9,81 m/s² hele tiden';

  return (
    <g>
      <ThrowScene th={th} t={t} T={T} SW={SW} pathX={pathX} y0={y0} y1={y1} p={p} sy={sy} heightA={heightA} rBall={rBall} rOff={rOff} arrows={arrows} />

      <Txt x={8} y={y1 - 22 * f} anchor="start" weight={700} color={phase === 'topp' ? VIZ.acceleration : phase === 'ro' ? VIZ.muted : VIZ.ink}>
        {header}
      </Txt>

      {/* s-t-grafen, i samme høydeskala som scenen */}
      <g transform={`translate(${SW} 0)`}>
        <Plot
          x={{ min: 0, max: tMax, label: 'Tid t (s)', decimals: tickDecimals(0, tMax) }}
          y={{ min: 0, max: yMax, label: 'Høyde s (m)', decimals: tickDecimals(0, yMax) }}
          width={800 - SW}
          height={heightA}
          margin={margin}
        >
          {(sc) => <PositionGraph th={th} t={t} T={T} tMax={tMax} yMax={yMax} {...sc} />}
        </Plot>
      </g>
      {/* Hjelpelinje fra ballen i scenen til punktet i grafen */}
      {T > 0 && sx(t) - (pathX + rBall + 3) > 4 && (
        <line
          x1={pathX + rBall + 3}
          x2={sx(t) - 6}
          y1={sy(s)}
          y2={sy(s)}
          stroke={VIZ.series[0]}
          strokeWidth={1.5}
          strokeDasharray="3 5"
          opacity={0.75}
        />
      )}
      {tTop !== null && <line x1={pathX} x2={x0} y1={sy(sMax)} y2={sy(sMax)} className="viz-guide" opacity={0.7} />}

      {/* Stoppeklokka og v-t-grafen med samme tidsakse som s-t-grafen */}
      <g transform={`translate(0 ${heightA + gap})`}>
        <Clock t={t} T={T} SW={SW} height={heightB} top={narrow ? 44 * f : 12} />
        <g transform={`translate(${SW} 0)`}>
          <VelocityGraph
            th={th}
            t={t}
            T={T}
            tMax={tMax}
            width={800 - SW}
            height={heightB}
            margin={{ ...margin, top: 40 * f, bottom: 56 * f }}
            headerX={narrow ? 8 - SW : undefined}
          />
        </g>
      </g>
    </g>
  );
}

/** Der ballen går opp og ned (x i figuren): så langt til høyre at Jonas og pilene for v og a får plass. */
function ballX(SW: number, f: number, k: number, p: number, rBall: number, catcher: boolean): number {
  return SW - 8 - arrowColumns(0, f, k, p, rBall, catcher).ax - 4 * k - 22 * f;
}

/**
 * Plassen til pilene for v og a, målt fra ballens x: forbi ryggen til Jonas (når han er med) og med litt luft mellom
 * pilene, så etiketten «v» får plass.
 */
function arrowColumns(pathX: number, f: number, k: number, p: number, rBall: number, catcher: boolean): { vx: number; ax: number } {
  const back = catcher ? (HAND.fram + 0.22) * p + 9 : 0; // ryggen til Jonas når han står vendt mot ballen
  const vx = pathX + Math.max(rBall + 14 * k, back + 4 * k);
  return { vx, ax: vx + 32 * k + 6 * (f - 1) };
}

/* ---------- Scenen: skolegård og boligblokk, med Mia som kaster og Jonas som tar imot ---------- */

function ThrowScene({
  th,
  t,
  T,
  SW,
  pathX,
  y0,
  y1,
  p,
  sy,
  heightA,
  rBall,
  rOff,
  arrows,
}: {
  th: Throw;
  t: number;
  T: number;
  SW: number;
  /** Der ballen går opp og ned (x). */
  pathX: number;
  y0: number;
  y1: number;
  p: number;
  sy: (s: number) => number;
  heightA: number;
  rBall: number;
  rOff: number;
  arrows: boolean;
}) {
  const f = useTextScale();
  const k = useSceneScale();
  const ss = useStrokeScale();
  const clip = useSvgId('lk-scene');
  const PL = 4;
  const PR = SW - 8;
  const PT = y1 - 10 * f;
  const PB = heightA - 3;
  const W = PR - PL;

  const groundY = y0 + rOff + HAND.opp * p;
  const horizon = groundY - Math.max(10, 0.5 * (PB - groundY) + 4);
  const { vx, ax } = arrowColumns(pathX, f, k, p, rBall, th.h0 > 0);
  const size = PERSON_M * p;
  const reach = HAND.fram * p;
  const railX = pathX - Math.max(KLARING * p, rBall + 3);
  const wallX = railX - BLOKK_MAAL.balkong * p;
  const building = throwBuilding(th.h0);
  const floorY = groundY - th.h0 * p;
  // Mia står med brystet bak rekkverket; hånda er der ballen starter.
  const miaX = th.h0 > 0 ? Math.min(pathX - reach, railX - 0.1 * p) : pathX - reach;
  const jonasX = pathX + reach;

  const s = throwHeight(th, t);
  const v = throwVelocity(th, t);
  const sMax = maxHeight(th);
  const vImp = impactSpeed(th);
  const ballY = sy(s);
  const vAbsMax = Math.max(1, Math.abs(th.v0), vImp);
  const LV = 92 * k;
  const vLen = T > 0 ? (v / vAbsMax) * LV : 0;
  const aLen = T > 0 ? 50 * k : 0;
  /** Midten av en loddrett pil ved ballen, flyttet så den holder seg over bakken og under toppen av scenen. */
  const mid = (len: number) => {
    const half = Math.abs(len) / 2;
    let c = ballY;
    if (c + half > groundY - 4) c = groundY - 4 - half;
    if (c - half < PT + 6) c = PT + 6 + half;
    return c;
  };
  const cv = mid(vLen);
  const ca = mid(aLen);
  const atTop = T > 0 && Math.abs(vLen) < 4;

  // Sola øverst til venstre, bare når blokka ikke står foran den
  const sun = { x: PL + W * 0.16, y: PT + 34 * k, r: 16 * k };
  const gableLeft = Math.max(PL, wallX - BLOKK_MAAL.gavl * p);
  const sunVisible = sun.x + sun.r * 2.2 < gableLeft || groundY - (building.roof + 0.3) * p > sun.y + sun.r * 2.2;

  // Høydemålet h₀ på gavlen, når det er plass til etiketten
  const h0Text = `h0 = ${fmt(th.h0, 0)} m`;
  const gableW = wallX - gableLeft;
  const showH0 = th.h0 >= 2 && gableW > h0Text.length * 17 * 0.85 * f * 0.6 + 26 * f;

  return (
    <g>
      <defs>
        <clipPath id={clip}>
          <rect x={PL} y={PT} width={W} height={PB - PT} rx={6} />
        </clipPath>
      </defs>
      <g clipPath={`url(#${clip})`}>
        <Himmel x={PL} y={PT} w={W} h={horizon - PT + 6} skyer={1} seed={5} sol={sunVisible ? sun : undefined} />
        <Landskap x={PL} y={horizon} w={W} h={Math.min(56 * k, Math.max(24, (horizon - PT) * 0.3))} type="by" seed={3} />
        <Underlag x1={PL - 4} x2={PR + 4} y={groundY} depth={PB - groundY + 6} type="asfalt" horisont={horizon} seed={4} />

        <Boligblokk wallX={wallX} left={PL - 2} groundY={groundY} p={p} building={building} ownFloor={th.h0 > 0 ? th.h0 : undefined} />

        {/* Banen ballen følger */}
        {T > 0 && (
          <line x1={pathX} x2={pathX} y1={sy(Math.max(sMax, th.h0))} y2={sy(0)} stroke={VIZ.muted} strokeWidth={1.3 * ss} strokeDasharray={`${2 * ss} ${5 * ss}`} opacity={0.8} />
        )}
        {/* Toppunktet: et svakt omriss av ballen */}
        {topTime(th) !== null && T > 0 && (
          <circle cx={pathX} cy={sy(sMax)} r={rBall} fill="none" stroke={VIZ.muted} strokeWidth={1.2 * ss} strokeDasharray={`${2.5 * ss} ${2.5 * ss}`} opacity={0.75} />
        )}

        {/* Mia på balkongen (eller i skolegården) og Jonas som tar imot */}
        <Person x={miaX} y={floorY} size={size} pose="staa" ledd={HENDER} jakke="rod" har="blond" frisyre="hestehale" bukse="svart" title="Mia" />
        {th.h0 > 0 && <Rekkverk wallX={wallX} floorY={floorY} p={p} />}
        {th.h0 > 0 && <Person x={jonasX} y={groundY} size={size} pose="staa" ledd={HENDER} flip jakke="gronn" har="brun" title="Jonas" />}

        {/* Nullnivået: hendene til den som tar imot */}
        <line x1={PL} x2={PR} y1={sy(0)} y2={sy(0)} stroke={VIZ.ink} strokeWidth={1.1 * ss} strokeDasharray={`${6 * ss} ${4 * ss}`} opacity={0.55} />
        <Txt x={PL + 6} y={sy(0) - 6 * f} anchor="start" size={0.8} weight={700}>
          s = 0
        </Txt>
        {showH0 && (
          <Dimension
            x1={wallX - 10 * f}
            y1={groundY}
            x2={wallX - 10 * f}
            y2={floorY}
            labelSize={0.85}
            label={
              <>
                h<TSub>0</TSub> = {fmt(th.h0, 0)} m
              </>
            }
          />
        )}

        <Ball x={pathX} y={ballY} r={rBall} type="tennis" spinn={t * 160} bakke={groundY} title="Tennisball" />

        {arrows && T > 0 && (
          <g>
            <ForceArrow x1={vx} y1={cv + vLen / 2} x2={vx} y2={cv - vLen / 2} color={VIZ.velocity} width={6 * Math.min(k, 1.2)} label="v" minLength={4} />
            {atTop && (
              <Txt x={pathX - rBall - 6} y={ballY + 6 * f} color={VIZ.velocity} weight={750} anchor="end" size={0.9}>
                v = 0
              </Txt>
            )}
            <ForceArrow x1={ax} y1={ca - aLen / 2} x2={ax} y2={ca + aLen / 2} color={VIZ.acceleration} width={5 * Math.min(k, 1.2)} label="a" />
          </g>
        )}
      </g>
      <rect x={PL} y={PT} width={W} height={PB - PT} rx={6} fill="none" stroke={VIZ.grid} strokeWidth={1} />
    </g>
  );
}

/* ---------- s-t-grafen ---------- */

function PositionGraph({
  th,
  t,
  T,
  tMax,
  yMax,
  sx,
  sy,
  x0,
  x1,
  y0,
  y1,
}: {
  th: Throw;
  t: number;
  T: number;
  tMax: number;
  yMax: number;
  sx: (v: number) => number;
  sy: (v: number) => number;
  x0: number;
  x1: number;
  y0: number;
  y1: number;
}) {
  const f = useTextScale();
  const s = throwHeight(th, t);
  const v = throwVelocity(th, t);
  const tTop = topTime(th);
  const sMax = maxHeight(th);
  // Tangenten i punktet: stigningstallet er farten v. Kortes av så den holder seg inne i grafen.
  let tangent: [number, number] | null = null;
  if (T > 0) {
    const d = 0.17 * tMax;
    let a = Math.max(0, t - d);
    let b = Math.min(tMax, t + d);
    if (Math.abs(v) > 1e-9) {
      const lo = t + (0 - s) / v;
      const hi = t + (yMax - s) / v;
      a = Math.max(a, Math.min(lo, hi));
      b = Math.min(b, Math.max(lo, hi));
    }
    if (b - a > 1e-6) tangent = [a, b];
  }
  return (
    <g>
      {T > 0 && (
        <>
          <path d={linePath(sample((x) => throwHeight(th, x), 0, T, 160), sx, sy)} fill="none" stroke={VIZ.series[0]} strokeWidth={2} opacity={0.32} />
          <path d={linePath(sample((x) => throwHeight(th, x), 0, t, 160), sx, sy)} fill="none" stroke={VIZ.series[0]} strokeWidth={3.5} strokeLinecap="round" />
        </>
      )}
      {tTop !== null && <line x1={x0} x2={sx(tTop)} y1={sy(sMax)} y2={sy(sMax)} className="viz-guide" />}
      {tTop !== null && tTop <= tMax && (
        <>
          <circle cx={sx(tTop)} cy={sy(sMax)} r={5.5} fill={VIZ.surface} stroke={VIZ.series[0]} strokeWidth={2.2} />
          {sx(tTop) + 60 * f < x1 && (
            <Txt x={sx(tTop)} y={sy(sMax) - 12 * f} size={0.8} color={VIZ.muted} weight={650}>
              toppunkt
            </Txt>
          )}
        </>
      )}
      {t > 0 && <line x1={sx(t)} x2={sx(t)} y1={y1} y2={y0} className="viz-guide" />}
      {tangent && (
        <line
          x1={sx(tangent[0])}
          y1={sy(s + v * (tangent[0] - t))}
          x2={sx(tangent[1])}
          y2={sy(s + v * (tangent[1] - t))}
          stroke={VIZ.velocity}
          strokeWidth={2.5}
          strokeDasharray="7 5"
          strokeLinecap="round"
        />
      )}
      <ColorDot x={sx(t)} y={sy(s)} color={VIZ.series[0]} />
    </g>
  );
}

/* ---------- Stoppeklokka til venstre for v-t-grafen ---------- */

function Clock({ t, T, SW, height, top }: { t: number; T: number; SW: number; height: number; top: number }) {
  const f = useTextScale();
  const r = Math.min((SW - 16) * 0.28, (height - top - 96 * f) / 2.7);
  const cx = SW / 2 - 4;
  const cy = top + 8 + 1.55 * r;
  return (
    <g>
      <Stoppeklokke x={cx} y={cy} r={r} t={t} title="Stoppeklokke" />
      <Txt x={cx} y={cy + r + 30 * f} weight={750} size={1.05}>
        t = {fmt(t, 2)} s
      </Txt>
      {T > 0 && (
        <Txt x={cx} y={cy + r + 56 * f} size={0.8} muted weight={600}>
          Tid i lufta: {fmt(T, 2)} s
        </Txt>
      )}
    </g>
  );
}

/* ---------- v-t-graf ---------- */

function VelocityGraph({
  th,
  t,
  T,
  tMax,
  width,
  height,
  margin,
  headerX,
}: {
  th: Throw;
  t: number;
  T: number;
  tMax: number;
  width: number;
  height: number;
  margin: { top: number; right: number; bottom: number; left: number };
  /** Der overskriften begynner (standard: venstre kant av grafen). */
  headerX?: number;
}) {
  const f = useTextScale();
  const vImp = impactSpeed(th);
  const vAxis = niceAxis(Math.min(0, -vImp), Math.max(0, th.v0), 5, 4);
  const tTop = topTime(th);
  const v = throwVelocity(th, t);
  // Stigningstrekant over 1 s tidlig i bevegelsen, når det er plass
  const t1 = 0.12 * T;
  const showTriangle = T >= 1.6;
  return (
    <Plot
      x={{ min: 0, max: tMax, label: 'Tid t (s)', decimals: tickDecimals(0, tMax) }}
      y={{ min: vAxis.min, max: vAxis.max, label: 'Fart v (m/s)', ticks: vAxis.ticks }}
      width={width}
      height={height}
      margin={margin}
    >
      {({ sx, sy, x0, y0, y1 }) => (
        <g>
          <Txt x={headerX ?? x0} y={y1 - 14 * f} anchor="start" weight={700} color={T > 0 ? VIZ.acceleration : VIZ.muted}>
            {T > 0 ? 'Stigningstall = a = −9,81 m/s²' : 'Ballen ligger i ro: v = 0 og a = 0'}
          </Txt>
          {T > 0 && (
            <>
              <line x1={sx(0)} y1={sy(th.v0)} x2={sx(T)} y2={sy(-vImp)} stroke={VIZ.velocity} strokeWidth={2} opacity={0.32} />
              <line x1={sx(0)} y1={sy(th.v0)} x2={sx(t)} y2={sy(v)} stroke={VIZ.velocity} strokeWidth={3.5} strokeLinecap="round" />
            </>
          )}
          {showTriangle && (
            <g>
              <polyline
                points={`${sx(t1)},${sy(throwVelocity(th, t1))} ${sx(t1 + 1)},${sy(throwVelocity(th, t1))} ${sx(t1 + 1)},${sy(throwVelocity(th, t1 + 1))}`}
                fill="none"
                stroke={VIZ.acceleration}
                strokeWidth={2}
                strokeLinejoin="round"
              />
              <Txt x={sx(t1 + 0.5)} y={sy(throwVelocity(th, t1)) - 8 * f} color={VIZ.acceleration} size={0.85} weight={700}>
                1 s
              </Txt>
              <Txt x={sx(t1 + 1) + 8 * f} y={slopeLabelY(sy(throwVelocity(th, t1 + 0.5)), sy(0), f)} anchor="start" color={VIZ.acceleration} size={0.85} weight={700}>
                −9,81 m/s
              </Txt>
            </g>
          )}
          {tTop !== null && tTop <= tMax && (
            <>
              <circle cx={sx(tTop)} cy={sy(0)} r={5.5} fill={VIZ.surface} stroke={VIZ.velocity} strokeWidth={2.2} />
              <Txt x={sx(tTop) - 8 * f} y={sy(0) + 20 * f} anchor="end" size={0.8} color={VIZ.muted} weight={650}>
                toppunkt
              </Txt>
            </>
          )}
          {t > 0 && <line x1={sx(t)} x2={sx(t)} y1={y1} y2={y0} className="viz-guide" />}
          <ColorDot x={sx(t)} y={sy(v)} color={VIZ.velocity} />
        </g>
      )}
    </Plot>
  );
}

/** Etiketten «−9,81 m/s» ved stigningstrekanten, flyttet opp eller ned så den ikke ligger oppå t-aksen (v = 0). */
function slopeLabelY(y: number, yZero: number, f: number): number {
  const base = y + 6 * f;
  if (Math.abs(base - 5 * f - yZero) > 11 * f) return base;
  return y <= yZero ? yZero - 9 * f : yZero + 21 * f;
}

/* ---------- Forklaring ---------- */

function explanation(th: Throw, T: number, v: number, vImp: number, phase: ThrowPhase): ReactNode {
  const tTop = topTime(th);
  const fromBalcony = th.h0 > 0;
  const kmh = (ms: number) => fmt(ms * 3.6, 0);
  if (phase === 'ro')
    return (
      <p>
        <strong>Mia står i skolegården med ballen i hendene.</strong> Gi ballen startfart oppover, eller flytt Mia opp på en balkong (starthøyde
        h<Sub>0</Sub>) for å slippe eller kaste ballen ned til Jonas. Vi måler høyden s fra hendene til den som tar imot ballen, så s = 0 er der
        ballen tas imot.
      </p>
    );
  if (phase === 'slutt')
    return fromBalcony ? (
      <p>
        <strong>Jonas tar imot ballen</strong> etter {fmt(T, 2)} s med fart {fmt(-vImp, 1)} m/s (negativ fordi den er på vei ned).{' '}
        {th.v0 > 0
          ? `Ballen passerer Mia på vei ned med like stor fart som startfarten, ${fmt(th.v0, 1)} m/s, og blir raskere de siste ${fmt(th.h0, 0)} m. `
          : th.v0 < 0
            ? `Ballen ble kastet ned med ${fmt(-th.v0, 1)} m/s og blir raskere hele veien ned. `
            : `Ballen falt fritt fra ro ${fmt(th.h0, 0)} m. `}
        Den tidløse formelen v² − v<Sub>0</Sub>² = 2aΔs med a = −g og Δs = −h<Sub>0</Sub> gir v² = v<Sub>0</Sub>² + 2gh<Sub>0</Sub>. Det er derfor du aldri skal slippe eller kaste ting ned fra en balkong: bare et slipp
        fra {fmt(th.h0, 0)} m gir {kmh(impactSpeed({ v0: 0, h0: th.h0 }))} km/h når det treffer.
      </p>
    ) : (
      <p>
        <strong>Mia tar imot ballen igjen</strong> etter {fmt(T, 2)} s med fart {fmt(-vImp, 1)} m/s (negativ fordi den er på vei ned). Farten er like
        stor som startfarten, men motsatt rettet, og ballen brukte like lang tid ned som opp. Det er derfor du kan måle hvor høyt du kaster med bare en
        stoppeklokke: halve tiden i lufta er tiden opp, og høyden blir ½ · g · ({fmt(T / 2, 2)} s)² = {fmt(maxHeight(th), 1)} m.
      </p>
    );
  if (phase === 'topp')
    return (
      <p>
        <strong>I toppunktet er v = 0, men akselerasjonen er fortsatt a = −9,81 m/s².</strong> Hadde a vært null her, ville ballen blitt hengende i
        lufta. I s-t-grafen er tangenten vannrett, og i v-t-grafen krysser linja t-aksen, men stigningstallet er det samme som før og etter. Det er
        derfor ballen ser ut til å stoppe et øyeblikk på toppen: farten er nesten null en liten stund.
      </p>
    );
  if (phase === 'start')
    return (
      <p>
        <strong>
          Mia {th.v0 > 0 ? 'kaster ballen rett opp' : th.v0 < 0 ? 'kaster ballen rett ned' : 'slipper ballen'} med v<Sub>0</Sub> = {fmt(th.v0, 1)} m/s
          {fromBalcony ? `, ${fmt(th.h0, 0)} m over hendene til Jonas.` : '.'}
        </strong>{' '}
        Vi velger positiv retning oppover og måler høyden s fra der ballen tas imot (s = 0 ved hendene)
        {fromBalcony ? (
          <>
            , så ballen starter i s<Sub>0</Sub> = h<Sub>0</Sub>
          </>
        ) : (
          ''
        )}
        . Da er a = −g = −9,81 m/s² hele tiden: på vei opp, i toppunktet og på vei ned.
      </p>
    );
  if (phase === 'opp')
    return (
      <p>
        <strong>På vei opp</strong> er v positiv og a negativ, så v blir 9,81 m/s mindre for hvert sekund, og ballen går saktere: v-pila krymper. Den
        når toppunktet etter t = v<Sub>0</Sub>/g = {fmt(tTop ?? 0, 2)} s og har da steget v<Sub>0</Sub>²/(2g) over startpunktet. Det er derfor du må
        kaste dobbelt så fort for å komme fire ganger så høyt.
      </p>
    );
  return (
    <p>
      <strong>På vei ned</strong> er både v og a negative. v blir fortsatt 9,81 m/s mindre (mer negativ) for hvert sekund, så nå går ballen fortere,
      og v-pila vokser nedover.{' '}
      {tTop !== null
        ? 'Akselerasjonen er nøyaktig den samme som på vei opp og i toppunktet.'
        : 'Akselerasjonen er −9,81 m/s² hele veien, enten ballen slippes eller kastes nedover.'}
      {!fromBalcony && tTop !== null ? ' Bevegelsen er symmetrisk om toppunktet: ballen passerer hver høyde med samme fart opp som ned.' : ''}
      {v < -0.5 && fromBalcony ? ` Nå er farten ${kmh(-v)} km/h.` : ''}
    </p>
  );
}
