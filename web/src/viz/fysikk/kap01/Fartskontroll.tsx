import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  Controls,
  Explain,
  Figure,
  Formula,
  FormulaLine,
  Legend,
  PlayControls,
  Plot,
  Readout,
  Readouts,
  Segmented,
  Slider,
  Sub,
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
  BIL_MAAL,
  Bil,
  ForceArrow,
  Himmel,
  Landskap,
  PAINTS,
  SCENE,
  SpeedLines,
  ValueTag,
  Vei,
  alpha,
  hjulvinkelFraStrekning,
  useStrokeScale,
  useSvgId,
} from '../../kit/scene';
import { AtkKamera, Fartsskilt, Instrumentpanel, Kantstolpe, instrumentpanelSize } from './fartskontroll-deler';
import {
  ATK_LENGTH,
  CAMERA_A_CLOCK,
  QUEUE_END,
  QUEUE_START,
  SITUATION_SLIDERS,
  SPEED_LIMIT_KMH,
  arithmeticMean,
  averageSpeed,
  buildTrip,
  clockText,
  getsFine,
  kmhToMs,
  minLegalTime,
  msToKmh,
  situationProfile,
  sliderBMax,
  speedRange,
  speedingIntervals,
  speedingTime,
  timeAtPosition,
  tripAcceleration,
  tripAverage,
  tripPosition,
  tripVelocity,
  type Situation,
  type Trip,
} from './model-fartskontroll';
import { boxPoints, distToBox, placeAlongSegment, segmentPoints, textBox, type Area, type LabelBox, type Pt } from './fartskontroll-etiketter';
import { useNarrow } from './useNarrow';

/** Snittfarten og sekanten. */
const SNITT = VIZ.series[1];
/** Posisjonen s. */
const POS = VIZ.series[0];
/** Over fartsgrensen (skravert i v-t-grafen). */
const OVER = alpha(PAINTS.rod, 0.28);
const LIMIT_MS = kmhToMs(SPEED_LIMIT_KMH);
const T_MIN = minLegalTime();
/** Toppen av s-aksen: litt over kamera B (4 000 m), så den stiplede linja for kamera B ikke faller sammen med rammen. */
const S_MAX = ATK_LENGTH * 1.1;

const SITUATIONS: { value: Situation; label: string }[] = [
  { value: 'brems', label: 'Bremser før kameraene' },
  { value: 'halvdeler', label: 'To halvdeler' },
  { value: 'ko', label: 'Kø på strekningen' },
];

type Values = Record<Situation, [number, number]>;

const START_VALUES: Values = {
  brems: [SITUATION_SLIDERS.brems.a.value, SITUATION_SLIDERS.brems.b.value],
  halvdeler: [SITUATION_SLIDERS.halvdeler.a.value, SITUATION_SLIDERS.halvdeler.b.value],
  ko: [SITUATION_SLIDERS.ko.a.value, SITUATION_SLIDERS.ko.b.value],
};

/**
 * Streknings-ATK (1B, 1C): en bil kjører gjennom en strekning på 4,0 km med fartskamera i hver ende. Eleven velger
 * situasjon og fartsprofil og ser speedometeret (momentanfarten) og kjørecomputeren (snittfarten), og i s-t-grafen
 * sekanten (snittfart) og tangenten (momentanfart). Får sjåføren bot?
 */
export default function Fartskontroll() {
  const [situation, setSituation] = useState<Situation>('brems');
  const [values, setValues] = useState<Values>(START_VALUES);
  const [va, vb] = values[situation];
  const sliders = SITUATION_SLIDERS[situation];
  const setValue = (i: 0 | 1) => (v: number) =>
    setValues((old) => {
      const next: [number, number] = [...old[situation]];
      next[i] = v;
      // «Bremser før kameraene»: farten forbi kameraene er høyst farten mellom dem
      next[1] = Math.min(next[1], sliderBMax(situation, next[0]));
      return { ...old, [situation]: next };
    });
  const bMax = sliderBMax(situation, va);

  const trip = useMemo(() => buildTrip(situationProfile(situation, va, vb)), [situation, va, vb]);
  const T = trip.T;
  const clock = useSimClock({ tMax: T, speed: Math.min(20, Math.max(7, T / 16)) });
  const { setT } = clock;
  // Start ved kamera B (hele turen er kjørt). Står klokka ved slutten når fartsprofilen endres, blir den der.
  const prevT = useRef(0);
  const clockT = useRef(0);
  // Oppdateres etter hver tegning (før effekten under), så effekten ser tiden fra før fartsprofilen ble endret.
  useEffect(() => {
    clockT.current = clock.t;
  });
  useEffect(() => {
    if (clockT.current >= prevT.current - 1e-6 || clockT.current > T) setT(T);
    prevT.current = T;
  }, [T, setT]);
  const t = Math.min(Math.max(clock.t, 0), T);
  const { ref, narrow } = useNarrow();

  const s = tripPosition(trip, t);
  const v = tripVelocity(trip, t);
  const avgNow = averageSpeed(trip, t);
  const avg = tripAverage(trip);
  const avgK = msToKmh(avg);
  const fine = getsFine(avgK);

  return (
    <VizLayout>
      <Toolbar>
        <Segmented label="Velg situasjon" options={SITUATIONS} value={situation} onChange={setSituation} />
      </Toolbar>
      <Controls>
        <Slider label={sliders.a.label} value={va} onChange={setValue(0)} min={sliders.a.min} max={sliders.a.max} step={5} unit="km/h" decimals={0} />
        <Slider label={sliders.b.label} value={Math.min(vb, bMax)} onChange={setValue(1)} min={sliders.b.min} max={bMax} step={5} unit="km/h" decimals={0} />
        {/* Maks rundes opp til et helt steg, så glidebryteren når helt fram til kamera B (t = T). */}
        <Slider label="Tid etter kamera A" value={t} onChange={(x) => setT(x >= T - 0.1 ? T : x)} min={0} max={Math.ceil(T * 10) / 10} step={0.1} unit="s" decimals={1} />
      </Controls>
      <Toolbar>
        <PlayControls clock={clock} decimals={1} />
      </Toolbar>

      <div ref={ref}>
        <Figure
          viewBox={narrow ? `0 0 ${SCENE_NARROW.W} ${SCENE_NARROW.H}` : `0 0 ${SCENE_WIDE.W} ${SCENE_WIDE.H}`}
          label={`Bil på en vei med streknings-ATK, ${fmt(s / 1000, 2)} km etter kamera A. Speedometeret viser ${fmt(msToKmh(v), 0)} km/h.`}
          maxHeight={narrow ? 560 : 360}
        >
          <Scene trip={trip} t={t} narrow={narrow} situation={situation} />
        </Figure>
        <Figure
          viewBox={`0 0 800 ${graphHeights(narrow).reduce((a, b) => a + b, 0)}`}
          label="To grafer med felles tidsakse: posisjon s som funksjon av tiden med sekant og tangent, og fart v som funksjon av tiden."
          maxHeight={narrow ? 1100 : 640}
        >
          <Graphs trip={trip} t={t} narrow={narrow} />
        </Figure>
      </div>
      <Legend
        items={[
          { color: POS, label: 'Posisjon s' },
          { color: VIZ.velocity, label: 'Momentanfart v og tangenten' },
          { color: SNITT, label: 'Snittfart fra kamera A og sekanten', dashed: true },
          { color: VIZ.muted, label: `Fartsgrensen ${SPEED_LIMIT_KMH} km/h`, dashed: true },
          { color: OVER, label: 'Over fartsgrensen' },
        ]}
      />

      <Readouts>
        <Readout label="Speedometeret (momentanfart)" value={fmt(msToKmh(v), 0)} unit="km/h" tone={VIZ.velocity} />
        <Readout label="Snittfart hittil (Δs/Δt)" value={t > 0 ? fmt(msToKmh(avgNow), 1) : '–'} unit="km/h" tone={SNITT} />
        <Readout label="Snittfart A → B (målt av ATK)" value={fmt(avgK, 1)} unit="km/h" tone={SNITT} />
        <Readout label="Får sjåføren bot?" value={fine ? 'Ja' : 'Nei'} />
      </Readouts>

      <Calculation trip={trip} t={t} />

      <Explain>{explanation(situation, va, vb, trip, t)}</Explain>
    </VizLayout>
  );
}

/* ---------- Scenen ---------- */

interface SceneLayout {
  /** Bredden og høyden på viewBox. På mobil er viewBox smalere, så bilen og speedometeret blir større på skjermen. */
  W: number;
  H: number;
  /** Der hjulene står, bredden på veibanen og horisonten. */
  road: number;
  B: number;
  horizon: number;
  landH: number;
  sun: { x: number; y: number };
  /** Bilen står i ro i bildet her (midt mellom hjulene); veien ruller. */
  carX: number;
  /** Piksler per meter for bilen, kameraene og skiltene. */
  m: number;
  /** Instrumentpanelet: øverste venstre hjørne og radien på speedometeret. */
  panelX: number;
  panelY: number;
  R: number;
  /** Strekningslinja øverst. */
  rail: { x1: number; x2: number; y: number };
  /** Piksler per m/s for fartspila. */
  kv: number;
}

const SCENE_WIDE: SceneLayout = {
  W: 800,
  H: 320,
  road: 274,
  B: 46,
  horizon: 198,
  landH: 96,
  sun: { x: 724, y: 132 },
  carX: 470,
  m: 34,
  panelX: 12,
  panelY: 12,
  R: 68,
  rail: { x1: 268, x2: 770, y: 40 },
  kv: 4.2,
};

const SCENE_NARROW: SceneLayout = {
  W: 480,
  H: 470,
  road: 420,
  B: 46,
  horizon: 334,
  landH: 100,
  sun: { x: 432, y: 116 },
  carX: 290,
  m: 32,
  panelX: 12,
  panelY: 86,
  // Så lite at instrumentpanelet slutter over fartsskiltet ved kamera A (toppen av skiltet er ca. 297)
  R: 70,
  rail: { x1: 26, x2: 454, y: 42 },
  kv: 3.0,
};

/**
 * Bakgrunnen (vei, landskap, stolper og skilt) ruller med EPS ganger den virkelige strekningen, så den ikke flimrer
 * når avspillingen går mange ganger fortere enn virkeligheten. Bilen, kameraene og skiltene har ekte mål.
 */
const EPS = 0.2;
/** Kantstolper langs veien (m mellom dem). */
const POST_SPACING = 50;
/** Skilt med fartsgrensen 25 m før kamera A (med ATK-skilt under) og så hver kilometer. */
const SIGNS = [-25, 975, 1975, 2975];
/** Avstanden mellom bilene i køen (fra midt på den ene til midt på den neste), m. */
const QUEUE_SPACING = 6.6;

function Scene({ trip, t, narrow, situation }: { trip: Trip; t: number; narrow: boolean; situation: Situation }) {
  const f = useTextScale();
  const ss = useStrokeScale();
  const lay = narrow ? SCENE_NARROW : SCENE_WIDE;
  const { W, road, B, horizon, carX, m } = lay;
  const s = tripPosition(trip, t);
  const v = tripVelocity(trip, t);
  const braking = tripAcceleration(trip, t) < -0.05;
  const scroll = s * m * EPS;
  /** Skjermposisjonen til en gjenstand ved siden av veien, s meter etter kamera A. */
  const sx = (sObj: number) => carX + (sObj - s) * m * EPS;
  const visible = (x: number, margin = 60) => x > -margin && x < W + margin;
  const farY = road - 0.7 * B - 3;
  const carLen = BIL_MAAL.lengde * m;

  const posts: number[] = [];
  const reach = (W + 100) / (m * EPS);
  for (let p = Math.ceil((s - reach) / POST_SPACING) * POST_SPACING; p <= s + reach; p += POST_SPACING) {
    if (visible(sx(p), 20) && !SIGNS.some((q) => Math.abs(q - p) < 8) && Math.abs(p) > 6 && Math.abs(p - trip.L) > 6) posts.push(p);
  }
  const cameras = [
    { name: 'A', at: 0, clock: CAMERA_A_CLOCK },
    { name: 'B', at: trip.L, clock: CAMERA_A_CLOCK + trip.T },
  ].filter((c) => visible(sx(c.at), 80));

  // Køen: bilene foran og bak følger samme fartsprofil, med et tidsforsprang som gir QUEUE_SPACING mellom bilene i køen.
  const queue: { dt: number; lakk: 'blaa' | 'hvit' | 'graa' }[] = [];
  if (situation === 'ko') {
    const vQueue = tripVelocity(trip, timeAtPosition(trip, (QUEUE_START + QUEUE_END) / 2));
    const lead = QUEUE_SPACING / vQueue;
    queue.push({ dt: lead, lakk: 'blaa' }, { dt: -lead, lakk: 'graa' }, { dt: 2 * lead, lakk: 'hvit' }, { dt: -2 * lead, lakk: 'blaa' });
  }

  const panel = instrumentpanelSize(lay.R);
  const arrowY = road - BIL_MAAL.hoyde * m - 16 * f;
  const railBottom = lay.rail.y + 12 + 17 * 0.8 * f;

  return (
    <g>
      <Himmel w={W} h={horizon + 2} sol={lay.sun} skyer={2} seed={3} forskyvning={scroll} />
      <Landskap x={0} y={horizon} w={W} h={lay.landH} type="aaser" seed={5} forskyvning={scroll} />
      <Vei x1={0} x2={W} y={road} bredde={B} horisont={horizon} depth={lay.H - road} forskyvning={scroll} />

      {cameras.map((c) => (
        <AtkKamera key={c.name} x={sx(c.at)} y={farY} m={m} blits={Math.abs(s - c.at) < 12} />
      ))}
      {SIGNS.filter((q) => visible(sx(q))).map((q) => (
        <Fartsskilt key={q} x={sx(q)} y={farY} m={m} grense={SPEED_LIMIT_KMH} atk={q < 0} />
      ))}
      {posts.map((p) => (
        <Kantstolpe key={p} x={sx(p)} y={farY + 1} m={m} />
      ))}

      {queue.map((q, i) => {
        const qs = tripPosition(trip, t + q.dt);
        const x = carX + (qs - s) * m;
        if (!visible(x, carLen)) return null;
        return (
          <Bil
            key={i}
            x={x}
            y={road}
            size={carLen}
            lakk={q.lakk}
            type={i % 2 ? 'stasjonsvogn' : 'personbil'}
            hjulvinkel={hjulvinkelFraStrekning(qs * EPS)}
            bremselys={tripAcceleration(trip, t + q.dt) < -0.05}
          />
        );
      })}
      <SpeedLines x={carX - BIL_MAAL.bak * m} y={road - 0.62 * m} length={v * (narrow ? 1.1 : 1.4)} spread={0.55 * m} />
      <Bil x={carX} y={road} size={carLen} lakk="rod" hjulvinkel={hjulvinkelFraStrekning(s * EPS)} bremselys={braking} />
      <ForceArrow x1={carX - 0.3 * m} y1={arrowY} x2={carX - 0.3 * m + v * lay.kv} y2={arrowY} color={VIZ.velocity} label="v" width={6} />

      {cameras.map((c) => {
        const passed = s >= c.at - 1e-6;
        const text = passed ? `Kamera ${c.name} · ${clockText(c.clock)}` : `Kamera ${c.name}`;
        const fs = 17 * f * 0.85;
        const w = text.length * fs * 0.6 + 16 * f;
        const h = fs * 1.55;
        const cx = sx(c.at);
        const top = farY - 4.75 * m;
        const above = top - 12 * f - h / 2;
        if (above - h / 2 > railBottom + 4) {
          const x = Math.min(W - w / 2 - 6, Math.max(lay.panelX + panel.w + w / 2 + 8, cx));
          // Spissen peker på kamerahuset, også når skiltet er skjøvet til siden for instrumentpanelet
          const px = Math.min(x + w / 2 - 10 * ss, Math.max(x - w / 2 + 10 * ss, cx - 0.55 * m));
          return (
            <g key={c.name}>
              <polygon
                points={`${px - 6 * ss},${above + h / 2 - 1} ${px + 6 * ss},${above + h / 2 - 1} ${px},${above + h / 2 + 8 * f}`}
                fill={VIZ.surface}
                stroke={SCENE.outline}
                strokeWidth={ss}
              />
              <ValueTag x={x} y={above} text={text} size={0.85} />
            </g>
          );
        }
        // Ikke plass over kameraet (strekningslinja er der): skiltet ved siden av kamerahuset
        const y = farY - 4.45 * m;
        const right = cx + 0.3 * m + 10 + w < W - 4;
        return <ValueTag key={c.name} x={right ? cx + 0.3 * m + 10 : cx - 1.4 * m - 10} y={y} text={text} size={0.85} anchor={right ? 'start' : 'end'} />;
      })}

      <Instrumentpanel
        x={lay.panelX}
        y={lay.panelY}
        R={lay.R}
        fart={msToKmh(v)}
        snitt={t > 0 ? msToKmh(averageSpeed(trip, t)) : NaN}
        grense={SPEED_LIMIT_KMH}
        snittFarge={SNITT}
      />
      <Rail lay={lay} s={s} L={trip.L} queue={situation === 'ko'} />
    </g>
  );
}

/** Strekningen fra kamera A til kamera B øverst i bildet, med kilometermerker og bilen som et punkt. */
function Rail({ lay, s, L, queue }: { lay: SceneLayout; s: number; L: number; queue: boolean }) {
  const f = useTextScale();
  const ss = useStrokeScale();
  const { x1, x2, y } = lay.rail;
  const X = (d: number) => x1 + ((x2 - x1) * Math.min(L, Math.max(0, d))) / L;
  const kms = Array.from({ length: Math.floor(L / 1000) + 1 }, (_, i) => i * 1000);
  return (
    <g>
      <line x1={x1} x2={x2} y1={y} y2={y} stroke={VIZ.surface} strokeWidth={9 * ss} strokeLinecap="round" opacity={0.9} />
      <line x1={x1} x2={x2} y1={y} y2={y} stroke={VIZ.muted} strokeWidth={3 * ss} strokeLinecap="round" />
      <line x1={x1} x2={X(s)} y1={y} y2={y} stroke={POS} strokeWidth={5 * ss} strokeLinecap="round" />
      {queue && (
        <g>
          <rect
            x={X(QUEUE_START)}
            y={y - 6 * ss}
            width={X(QUEUE_END) - X(QUEUE_START)}
            height={12 * ss}
            rx={3 * ss}
            fill={alpha(PAINTS.oransje, 0.45)}
            stroke={PAINTS.oransje}
            strokeWidth={1.2 * ss}
          />
          <Txt x={(X(QUEUE_START) + X(QUEUE_END)) / 2} y={y - 12 * ss} size={0.78} weight={650}>
            kø
          </Txt>
        </g>
      )}
      {kms.map((d) => (
        <g key={d}>
          <line x1={X(d)} x2={X(d)} y1={y - 5 * ss} y2={y + 5 * ss} stroke={VIZ.muted} strokeWidth={1.4 * ss} />
          <Txt x={X(d)} y={y + 10 * ss + 13 * f} size={0.78} muted>
            {d === L ? `${fmt(d / 1000, 0)} km` : fmt(d / 1000, 0)}
          </Txt>
        </g>
      ))}
      <Txt x={x1 - 2} y={y - 12 * ss} anchor="start" size={0.82} weight={650}>
        Kamera A
      </Txt>
      <Txt x={x2 + 2} y={y - 12 * ss} anchor="end" size={0.82} weight={650}>
        Kamera B
      </Txt>
      <circle cx={X(s)} cy={y} r={7 * ss} fill={PAINTS.rod} stroke={VIZ.surface} strokeWidth={2.4 * ss} />
    </g>
  );
}

/* ---------- Grafene ---------- */

function graphHeights(narrow: boolean): [number, number] {
  return narrow ? [470, 400] : [320, 250];
}

/** Største verdi på aksen: et helt antall steg over `v`. */
function axisMax(v: number, step: number): number {
  return Math.max(step, Math.ceil(v / step - 1e-9) * step);
}

function Graphs({ trip, t, narrow }: { trip: Trip; t: number; narrow: boolean }) {
  const f = useTextScale();
  const clip = useSvgId('fk-klipp');
  const [h0, h1] = graphHeights(narrow);
  const margin = (last: boolean) => ({ top: 34 * f, right: 26 * f, bottom: (last ? 56 : 30) * f, left: 74 * f });
  const T = trip.T;
  const tEnd = Math.max(T, T_MIN);
  const tStep = niceTicks(0, tEnd, narrow ? 4 : 6);
  const step = (tStep[1] ?? 50) - (tStep[0] ?? 0);
  const tMax = axisMax(tEnd * 1.02, step);
  const tTicks = niceTicks(0, tMax, narrow ? 4 : 6);
  const s = tripPosition(trip, t);
  const v = tripVelocity(trip, t);
  const avgNow = averageSpeed(trip, t);
  const [, hi] = speedRange(trip);
  const vStep = narrow ? 40 : 20;
  const vMax = axisMax(Math.max(msToKmh(hi), SPEED_LIMIT_KMH) * 1.08, vStep);
  const vTicks = Array.from({ length: Math.floor(vMax / vStep) + 1 }, (_, i) => i * vStep);
  const dot = Math.min(1.5, f);
  const intervals = speedingIntervals(trip, LIMIT_MS);
  const n = Math.max(60, Math.round(T));

  return (
    <>
      {/* s-t */}
      <Plot
        x={{ min: 0, max: tMax, label: '', ticks: tTicks }}
        y={{ min: 0, max: S_MAX, label: 'Posisjon s (m)', ticks: [0, 1000, 2000, 3000, 4000] }}
        width={800}
        height={h0}
        margin={margin(false)}
      >
        {({ sx, sy, x0, x1, y0, y1 }) => {
          const P = { x: sx(t), y: sy(s) };
          const O = { x: sx(0), y: sy(0) };
          const area = { x0: x0 + 4, x1: x1 - 4, top: y1 + 2, bottom: y0 - 4 };
          // Tangenten: retningen (1 s, v · 1 s) i skjermkoordinater, klippet til grafområdet
          const tx = sx(1) - sx(0);
          const ty = sy(v) - sy(0);
          const tl = Math.hypot(tx, ty) || 1;
          const u = { x: tx / tl, y: ty / tl };
          const half = (narrow ? 130 : 105) * Math.min(1.2, f);
          const [ta, tb] = clipSegment({ x: P.x - u.x * half, y: P.y - u.y * half }, { x: P.x + u.x * half, y: P.y + u.y * half }, area);
          // Fartsgrenselinja: stigningstall 80 km/h, når kamera B etter 180 s
          const G = { x: sx(T_MIN), y: sy(ATK_LENGTH) };
          const curve = sample((x) => tripPosition(trip, x), 0, T, 120).map(([a, b]) => ({ x: sx(a), y: sy(b) }));
          const secPts = t > 0 ? segmentPoints(O, P) : [];
          const limPts = segmentPoints(O, G);
          const tanPts = segmentPoints(ta, tb, 16);
          // Den loddrette hjelpelinja ved tiden t
          const guidePts = segmentPoints({ x: P.x, y: y1 }, { x: P.x, y: y0 }, 30);
          const fs = 17 * f * 0.85;
          // «Kamera B» over den stiplede linja ved s = 4 000 m, til venstre
          const kamFs = 17 * f * 0.78;
          const kamSize = textBox(8, kamFs);
          const yB = sy(ATK_LENGTH);
          const kamB = { cx: x0 + 8 + kamSize.w / 2, cy: yB - 5 * f - kamSize.h / 2, ...kamSize };
          const tanBox = placeAlongSegment(ta, tb, textBox(7, fs).w, textBox(7, fs).h, 6 * f, [...curve, ...secPts, ...limPts, ...boxPoints(kamB)], area, {
            fractions: [0.04, 0.12, 0.88, 0.96],
            prefer: 0.96,
          });
          const secBox = placeAlongSegment(O, P, textBox(6, fs).w, textBox(6, fs).h, 6 * f, [...curve, ...limPts, ...tanPts, ...guidePts, ...boxPoints(tanBox), ...boxPoints(kamB)], area);
          const limFs = 17 * f * 0.78;
          const limBox = placeAlongSegment(
            O,
            G,
            textBox(7, limFs).w,
            textBox(7, limFs).h,
            6 * f,
            [...curve, ...secPts, ...tanPts, ...guidePts, ...boxPoints(tanBox), ...(t > 0 && Math.hypot(P.x - O.x, P.y - O.y) > 90 * f ? boxPoints(secBox) : []), ...boxPoints(kamB)],
            area,
            { prefer: 0.7 },
          );
          return (
            <g>
              <clipPath id={clip}>
                <rect x={x0} y={y1} width={x1 - x0} height={y0 - y1} />
              </clipPath>
              <Txt x={x0} y={y1 - 12 * f} anchor="start" size={0.9} weight={700}>
                s-t-graf: sekant og tangent
              </Txt>
              {/* Kamera B: s = 4 000 m */}
              <line x1={x0} x2={x1} y1={yB} y2={yB} stroke={VIZ.muted} strokeWidth={1.4} strokeDasharray="4 4" />
              <Txt x={x0 + 8} y={kamB.cy + kamFs * 0.33} anchor="start" size={0.78} weight={650} muted>
                Kamera B
              </Txt>
              <line x1={P.x} x2={P.x} y1={y1} y2={y0} className="viz-guide" />
              <line x1={O.x} y1={O.y} x2={G.x} y2={G.y} stroke={VIZ.muted} strokeWidth={2.2} strokeDasharray="8 6" />
              <Txt x={limBox.cx} y={limBox.cy + limFs * 0.33} size={0.78} color={VIZ.muted} weight={650}>
                {SPEED_LIMIT_KMH} km/h
              </Txt>
              <path d={linePath(sample((x) => tripPosition(trip, x), 0, T, n), sx, sy)} fill="none" stroke={POS} strokeWidth={2.2} opacity={0.35} />
              {t > 0 && <path d={linePath(sample((x) => tripPosition(trip, x), 0, t, n), sx, sy)} fill="none" stroke={POS} strokeWidth={3.5} />}
              {t > 0 && (
                <>
                  {/* Sekanten tynnere enn s-grafen og med store mellomrom, så grafen synes også der de ligger oppå hverandre */}
                  <line x1={O.x} y1={O.y} x2={P.x} y2={P.y} stroke={SNITT} strokeWidth={2.2} strokeDasharray="9 8" />
                  <circle cx={O.x} cy={O.y} r={5 * dot} fill={SNITT} stroke={VIZ.surface} strokeWidth={2} />
                  {Math.hypot(P.x - O.x, P.y - O.y) > 90 * f && (
                    <Txt x={secBox.cx} y={secBox.cy + fs * 0.33} size={0.85} color={SNITT} weight={700}>
                      sekant
                    </Txt>
                  )}
                </>
              )}
              <g clipPath={`url(#${clip})`}>
                <line x1={P.x - u.x * half} y1={P.y - u.y * half} x2={P.x + u.x * half} y2={P.y + u.y * half} stroke={VIZ.velocity} strokeWidth={3.2} strokeLinecap="round" />
              </g>
              <Txt x={tanBox.cx} y={tanBox.cy + fs * 0.33} size={0.85} color={VIZ.velocity} weight={700}>
                tangent
              </Txt>
              <circle cx={P.x} cy={P.y} r={7 * dot} fill={POS} stroke={VIZ.surface} strokeWidth={2.5} />
            </g>
          );
        }}
      </Plot>

      {/* v-t */}
      <g transform={`translate(0 ${h0})`}>
        <Plot
          x={{ min: 0, max: tMax, label: 'Tid t etter kamera A (s)', ticks: tTicks }}
          y={{ min: 0, max: vMax, label: 'Fart v (km/h)', ticks: vTicks }}
          width={800}
          height={h1}
          margin={margin(true)}
        >
          {({ sx, sy, x0, x1, y0, y1 }) => {
            const vk = (x: number) => msToKmh(tripVelocity(trip, x));
            const avgK = msToKmh(avgNow);
            const area = { x0: x0 + 4, x1: x1 - 4, top: y1 + 2, bottom: y0 - 4 };
            const vCurve = sample(vk, 0, T, 120).map(([a, b]) => ({ x: sx(a), y: sy(b) }));
            const limitPts = segmentPoints({ x: x0, y: sy(SPEED_LIMIT_KMH) }, { x: x1, y: sy(SPEED_LIMIT_KMH) }, 40);
            const avgText = `snittfart ${fmt(avgK, 0)} km/h`;
            const avgFs = 17 * f * 0.82;
            const avgSize = textBox(avgText.length, avgFs);
            const avgBox = placeAvgLabel({
              a: { x: sx(0), y: sy(avgK) },
              b: { x: sx(t), y: sy(avgK) },
              size: avgSize,
              gap: 5 * f,
              obstacles: [...vCurve, ...limitPts],
              dot: { x: sx(t), y: sy(vk(t)), r: 7 * dot + 3 },
              area,
            });
            return (
              <g>
                <Txt x={x0} y={y1 - 12 * f} anchor="start" size={0.9} weight={700}>
                  v-t-graf: momentanfart og snittfart
                </Txt>
                {intervals.map(([a, b], i) => {
                  const pts = sample(vk, a, b, Math.max(8, Math.round((b - a) / 2)));
                  const d = `${linePath(pts, sx, sy)}L${sx(b)},${sy(SPEED_LIMIT_KMH)}L${sx(a)},${sy(SPEED_LIMIT_KMH)}Z`;
                  return <path key={i} d={d} fill={OVER} />;
                })}
                <line x1={sx(t)} x2={sx(t)} y1={y1} y2={y0} className="viz-guide" />
                <line x1={x0} x2={x1} y1={sy(SPEED_LIMIT_KMH)} y2={sy(SPEED_LIMIT_KMH)} stroke={VIZ.muted} strokeWidth={2.2} strokeDasharray="8 6" />
                <path d={linePath(sample(vk, 0, T, n), sx, sy)} fill="none" stroke={VIZ.velocity} strokeWidth={2.2} opacity={0.35} />
                {t > 0 && <path d={linePath(sample(vk, 0, t, n), sx, sy)} fill="none" stroke={VIZ.velocity} strokeWidth={3.5} />}
                {/* Snittfartlinja tynnere enn fartsgrafen og stiplet, så momentanfarten synes også når de nesten er like */}
                {t > 0 && <line x1={sx(0)} x2={sx(t)} y1={sy(avgK)} y2={sy(avgK)} stroke={SNITT} strokeWidth={2.2} strokeDasharray="9 8" />}
                {t > 0 && avgBox && (
                  <Txt x={avgBox.cx} y={avgBox.cy + avgFs * 0.33} size={0.82} color={SNITT} weight={700}>
                    {avgText}
                  </Txt>
                )}
                <circle cx={sx(t)} cy={sy(vk(t))} r={7 * dot} fill={VIZ.velocity} stroke={VIZ.surface} strokeWidth={2.5} />
              </g>
            );
          }}
        </Plot>
      </g>
    </>
  );
}

/** Linjestykket a → b klippet til området (Liang–Barsky). Ligger det helt utenfor, blir det et punkt. */
function clipSegment(a: Pt, b: Pt, area: Area): [Pt, Pt] {
  let t0 = 0;
  let t1 = 1;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const edges: [number, number][] = [
    [-dx, a.x - area.x0],
    [dx, area.x1 - a.x],
    [-dy, a.y - area.top],
    [dy, area.bottom - a.y],
  ];
  for (const [p, q] of edges) {
    if (p === 0) {
      if (q < 0) return [a, a];
    } else {
      const r = q / p;
      if (p < 0) t0 = Math.max(t0, r);
      else t1 = Math.min(t1, r);
    }
  }
  if (t0 > t1) return [a, a];
  return [
    { x: a.x + dx * t0, y: a.y + dy * t0 },
    { x: a.x + dx * t1, y: a.y + dy * t1 },
  ];
}

/**
 * Etiketten til snittfartlinja i v-t-grafen: langs linja der det er ledig, ellers rett etter enden av linja (til høyre
 * for tidsmarkøren, der grafen ennå ikke er tegnet sterkt). Er det trangt begge steder (f.eks. snittfart 91 km/h klemt
 * mellom fartsgrafen på 100 km/h og fartsgrensen på 80 km/h), sløyfes etiketten. Linja er forklart i tegnforklaringen.
 */
function placeAvgLabel({
  a,
  b,
  size,
  gap,
  obstacles,
  dot,
  area,
}: {
  a: Pt;
  b: Pt;
  size: { w: number; h: number };
  gap: number;
  obstacles: Pt[];
  dot: { x: number; y: number; r: number };
  area: Area;
}): LabelBox | null {
  const ring = Array.from({ length: 12 }, (_, i) => ({ x: dot.x + dot.r * Math.cos((i * Math.PI) / 6), y: dot.y + dot.r * Math.sin((i * Math.PI) / 6) }));
  const all = [...obstacles, ...ring];
  const clear = (box: LabelBox) => all.reduce((m, p) => Math.min(m, distToBox(p, box)), Infinity);
  const inside = (box: LabelBox) => box.cx - box.w / 2 >= area.x0 && box.cx + box.w / 2 <= area.x1 && box.cy - box.h / 2 >= area.top && box.cy + box.h / 2 <= area.bottom;
  const MIN = 3;
  if (b.x - a.x > size.w * 0.8) {
    const along = placeAlongSegment(a, b, size.w, size.h, gap, all, area, { prefer: 0.5 });
    if (inside(along) && clear(along) >= MIN) return along;
  }
  const end = { cx: b.x + gap + 4 + size.w / 2, cy: b.y, ...size };
  if (inside(end) && clear(end) >= MIN) return end;
  return null;
}

/* ---------- Utregning ---------- */

function Calculation({ trip, t }: { trip: Trip; t: number }) {
  const T = trip.T;
  const avg = tripAverage(trip);
  const fine = getsFine(msToKmh(avg));
  // Viser 180,0 s når tiden er litt under 180 s, får den to desimaler, så sammenligningen stemmer.
  const tDec = fine && T > T_MIN - 0.05 ? 2 : 1;
  const v = tripVelocity(trip, t);
  return (
    <Formula label="Utregning av snittfarten fra klokkeslettene til kameraene">
      <FormulaLine>
        Δt = t<Sub>B</Sub> − t<Sub>A</Sub> = {clockText(CAMERA_A_CLOCK + T)} − {clockText(CAMERA_A_CLOCK)} = {fmt(T, 1)} s
      </FormulaLine>
      <FormulaLine>
        v<Sub>snitt</Sub> = Δs / Δt = {fmt(trip.L, 0)} m / {fmt(T, 1)} s = {fmt(avg, 2)} m/s = {fmt(msToKmh(avg), 1)} km/h
      </FormulaLine>
      <FormulaLine>
        Minste lovlige tid: Δt<Sub>min</Sub> = Δs / v<Sub>grense</Sub> = {fmt(trip.L, 0)} m / {fmt(LIMIT_MS, 2)} m/s = {fmt(T_MIN, 0)} s.{' '}
        {fine ? (
          <>
            {fmt(T, tDec)} s &lt; {fmt(T_MIN, 0)} s ⇒ bot
          </>
        ) : (
          <>
            {fmt(T, 1)} s ≥ {fmt(T_MIN, 0)} s ⇒ ingen bot
          </>
        )}
      </FormulaLine>
      <FormulaLine>
        Momentanfart ved t = {fmt(t, 1)} s: v = {fmt(v, 1)} m/s = {fmt(msToKmh(v), 0)} km/h (stigningstallet til tangenten)
      </FormulaLine>
    </Formula>
  );
}

/* ---------- Forklaring ---------- */

function explanation(situation: Situation, va: number, vb: number, trip: Trip, t: number): ReactNode {
  const T = trip.T;
  const avgK = msToKmh(tripAverage(trip));
  const fine = getsFine(avgK);
  const hi = msToKmh(speedRange(trip)[1]);
  const over = speedingTime(trip, LIMIT_MS);
  const atEnd = t >= T - 0.05;
  const k0 = (x: number) => `${fmt(x, 0)} km/h`;
  const k1 = (x: number) => `${fmt(x, 1)} km/h`;

  const verdict = fine ? (
    <p>
      <strong>Sjåføren får bot.</strong> Bilen brukte {fmt(T, 1)} s fra kamera A til kamera B. For å holde {k0(SPEED_LIMIT_KMH)} i snitt på{' '}
      {fmt(trip.L / 1000, 1)} km må den bruke minst {fmt(T_MIN, 0)} s, så snittfarten ble {k1(avgK)}. (Politiet trekker fra en liten
      sikkerhetsmargin for måleusikkerheten, men den ser vi bort fra her.)
    </p>
  ) : (
    <p>
      <strong>Ingen bot fra streknings-ATK.</strong> Bilen brukte {fmt(T, 1)} s fra kamera A til kamera B, og det er minst {fmt(T_MIN, 0)}{' '}
      s, så snittfarten ble {k1(avgK)}, ikke over {k0(SPEED_LIMIT_KMH)}.
    </p>
  );

  let story: ReactNode;
  if (situation === 'brems') {
    if (hi <= SPEED_LIMIT_KMH + 1e-9) story = <>Bilen holdt seg på eller under fartsgrensen hele veien. Da kan heller ikke snittfarten bli over grensen.</>;
    else if (Math.min(va, vb) > SPEED_LIMIT_KMH)
      story = (
        <>
          Her kjørte bilen over fartsgrensen hele veien, også forbi kameraene ({k0(vb)}). Da blir snittfarten også over grensen: den
          ligger alltid mellom den laveste og den høyeste farten.
        </>
      );
    else if (va > vb && fine)
      story = (
        <>
          Speedometeret viste bare {k0(vb)} da bilen passerte kameraene, men det hjelper ikke. Streknings-ATK måler ikke momentanfarten ved kameraet, men tiden
          mellom kameraene. Nedbremsingen tar bare noen få sekunder av {fmt(T, 0)} s, så snittfarten blir nesten like høy som farten mellom
          kameraene ({k0(va)}). Mange tror det holder å bremse før kameraet. Det gjelder punkt-ATK, som måler farten der kameraet står.
        </>
      );
    else if (!fine)
      story = (
        <>
          Bilen kjørte fortere enn {k0(SPEED_LIMIT_KMH)} i {fmt(over, 0)} s, men saktere resten av tiden, så snittfarten ble ikke over
          grensen.
        </>
      );
    else story = <>Bilen kjørte {k0(vb)} forbi kameraene og {k0(va)} mellom dem. Snittfarten ligger alltid mellom den laveste og den høyeste farten.</>;
  } else if (situation === 'halvdeler') {
    const tHalf = timeAtPosition(trip, trip.L / 2);
    const tFirst = tHalf;
    const tSecond = T - tHalf;
    const naive = arithmeticMean(va, vb);
    if (Math.abs(va - vb) < 1e-9) story = <>Begge halvdelene har samme fart, så snittfarten er lik farten.</>;
    else
      story = (
        <>
          Mange regner snittfarten som gjennomsnittet av de to fartene: ({fmt(va, 0)} + {fmt(vb, 0)}) / 2 = {k0(naive)}. Det er feil, fordi
          bilen bruker lengre tid på den langsomme halvdelen ({fmt(Math.max(tFirst, tSecond), 0)} s mot {fmt(Math.min(tFirst, tSecond), 0)}{' '}
          s). Snittfarten er hele strekningen delt på hele tiden, og blir {k1(avgK)}, nærmere den laveste farten. I v-t-grafen er arealet
          under grafen strekningen, og snittfartlinja lager et rektangel med like stort areal. Den langsomme delen er bredest, så den
          trekker snittfarten ned.
          {getsFine(naive) !== fine && ` Her ville gjennomsnittet av fartene gitt feil svar på om sjåføren får bot.`}
        </>
      );
  } else {
    const tq = timeAtPosition(trip, QUEUE_END) - timeAtPosition(trip, QUEUE_START);
    story = (
      <>
        I køen kjører bilen bare {k0(vb)} og bruker {fmt(tq, 0)} s på {fmt((QUEUE_END - QUEUE_START) / 1000, 1)} km.{' '}
        {hi <= SPEED_LIMIT_KMH + 1e-9
          ? 'Resten av veien holder bilen fartsgrensen.'
          : fine
            ? `Resten av veien kjører sjåføren ${k0(va)}, og det er nok til at snittfarten blir over grensen likevel.`
            : `Etterpå kjører sjåføren ${k0(va)} for å ta igjen tiden, men snittfarten blir bare ${k1(avgK)}. Streknings-ATK gir ingen bot, men bilen kjørte over fartsgrensen i ${fmt(over, 0)} s. Det er like ulovlig, og en vanlig fartskontroll med laser måler momentanfarten.`}
      </>
    );
  }

  const avgNow = msToKmh(averageSpeed(trip, t));
  const graph = (
    <>
      I s-t-grafen er snittfarten stigningstallet til sekanten fra kamera A {atEnd ? 'til kamera B' : 'til der bilen er nå'}, og
      momentanfarten er stigningstallet til tangenten. Den stiplede linja har stigningstallet {k0(SPEED_LIMIT_KMH)}: er sekanten fra A til B
      brattere enn den, blir det bot.
      {fine &&
        ' Er snittfarten over grensen, må tangenten ha vært brattere enn den stiplede linja et sted (det skraverte feltet i v-t-grafen). Derfor beviser strekningsmålingen at bilen har kjørt for fort.'}
      {!atEnd &&
        t > 0 &&
        ` Bilen er ikke fram til kamera B ennå: snittfarten hittil er ${k1(avgNow)}, mens speedometeret viser ${k0(msToKmh(tripVelocity(trip, t)))}.`}
      {t <= 0 && ' Bilen står ved kamera A: snittfarten er ikke definert ennå, for Δt = 0.'}
    </>
  );

  return (
    <>
      {verdict}
      <p>{story}</p>
      <p>{graph}</p>
    </>
  );
}
