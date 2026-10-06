/**
 * Scenen i «Forbikjøring på landeveien» (k1-forbikjoring): et utsnitt av landeveien sett fra siden, der kameraet
 * følger lastebilen, og over det hele strekningen sett ovenfra med målene s, s_M og D.
 *
 * Vi ser veien fra veikanten på motsatt side, så bilen og lastebilen kjører mot venstre. Da er motgående felt
 * nærmest oss, og bilen som kjører forbi, er ikke skjult bak lastebilen. Positiv retning (kjøreretningen til
 * bilen) er derfor mot venstre i begge tegningene.
 */
import type { ReactNode } from 'react';
import { TSub, Txt, VIZ, fmt, useTextScale } from '../../kit';
import {
  BIL_MAAL,
  Bil,
  ForceArrow,
  Himmel,
  Landskap,
  LinearGradient,
  PAINTS,
  SCENE,
  SpeedLines,
  ValueTag,
  Vei,
  alpha,
  hjulvinkelFraStrekning,
  shade,
  tint,
  useStrokeScale,
  useSvgId,
} from '../../kit/scene';
import { Smell } from './bremselengde-deler';
import { Kantstolpe } from './fartskontroll-deler';
import { BilOvenfra, LASTEBIL_MAAL, Lastebil, LastebilOvenfra, lastebilHjulvinkel } from './forbikjoring-deler';
import {
  CAR_LENGTH,
  GAP_AHEAD,
  GAP_BEHIND,
  carAcceleration,
  carFront,
  carVelocity,
  laneOffset,
  msToKmh,
  TRUCKS,
  oncomingFront,
  truckRear,
  type Overtake,
  type TruckId,
} from './model-forbikjoring';

/** Fargene til de tre kjøretøyene, både i scenen (lakk) og i grafene (serie). */
export const CAR_PAINT = 'blaa';
export const TRUCK_PAINT = 'oransje';
export const ONCOMING_PAINT = 'gronn';
export const C_CAR = VIZ.series[0];
export const C_TRUCK = VIZ.series[1];
export const C_ONCOMING = VIZ.series[2];
export const C_CRASH = PAINTS.rod;

/** Bredden på utsnittet av veien (m): plass til bilen før og etter forbikjøringen og det lengste vogntoget. */
const WINDOW_M = 62;
/** Kameraet går over fra å følge lastebilen til å følge bilen fra bilen er forbi fronten av lastebilen til så lenge etter T (s). */
const FOLLOW_AFTER = 1.2;
/** Målene i forhold til lastebilen tones ut så lenge etter T (s). */
const DIMS_FADE = 0.8;
/** Når kameraet følger bilen, står bilen så mye bak midten av utsnittet (andel av bredden), så vi ser hva som kommer. */
const FOLLOW_AHEAD = 0.16;
/** Kantstolper langs veien (m mellom dem). */
const POST_SPACING = 50;

const smooth = (x: number) => {
  const c = Math.min(1, Math.max(0, x));
  return c * c * (3 - 2 * c);
};

export interface SceneLayout {
  W: number;
  H: number;
  narrow: boolean;
  /** Oversikten øverst (y-verdier i figuren). */
  map: { titleY: number; lineS: number; roadTop: number; roadBottom: number; lineM: number; lineD: number; x0: number; x1: number };
  /** Toppen av scenen fra siden. Verdiene under er i forhold til den. */
  top: number;
  sceneH: number;
  horizon: number;
  landH: number;
  /** Der hjulene står i det nærmeste feltet (motgående felt), og bredden på veibanen i perspektiv. */
  road: number;
  B: number;
  /** Piksler per meter, per m/s (fartspiler) og per m/s² (akselerasjonspil). */
  m: number;
  kv: number;
  ka: number;
  /** Mållinjene i veikanten. */
  dim1: number;
  dim2: number;
  sun: { x: number; y: number };
}

/** Plassen i figuren, regnet ut fra tekstskaleringen f (figuren må ha plass til teksten på mobil). */
export function sceneLayout(narrow: boolean, f: number): SceneLayout {
  const W = narrow ? 480 : 800;
  const fs = 17 * f * 0.85;
  const asc = 0.75 * fs;
  const gap = 6 * f;
  // Oversikten: tittel, s og luka over veien, s_M og D under.
  const titleY = 6 + 0.75 * 17 * f * 0.8;
  const lineS = titleY + 6 + asc + gap;
  const roadTop = lineS + 7;
  const roadBottom = roadTop + 30;
  const lineM = roadBottom + 7;
  const lineD = lineM + gap + asc + 0.25 * fs + 9;
  const mapH = lineD + gap + asc + 0.25 * fs + 8;
  // Scenen: himmel, landskap, vei og to rader med mål i veikanten.
  const horizon = narrow ? 80 : 90;
  const road = narrow ? 150 : 166;
  const B = narrow ? 40 : 44;
  const dim1 = road + 0.3 * B + 8 + asc + gap;
  const dim2 = dim1 + 5 + asc + gap;
  const sceneH = dim2 + 10;
  return {
    W,
    H: Math.round(mapH + sceneH),
    narrow,
    map: { titleY, lineS, roadTop, roadBottom, lineM, lineD, x0: 14, x1: W - 14 },
    top: mapH,
    sceneH,
    horizon,
    landH: narrow ? 50 : 58,
    road,
    B,
    m: W / WINDOW_M,
    kv: narrow ? 1.7 : 2.6,
    ka: narrow ? 9 : 14,
    dim1,
    dim2,
    sun: { x: W - (narrow ? 60 : 96), y: narrow ? 30 : 34 },
  };
}

/** Kameraet (midten av utsnittet, posisjon i m): følger lastebilen under forbikjøringen, så bilen etterpå. */
export function cameraCenter(o: Overtake, t: number): number {
  const truckFrame = truckRear(o, t) + o.truckLength / 2;
  const w = followWeight(o, t);
  if (w <= 0) return truckFrame;
  const follow = carFront(o, t) - CAR_LENGTH / 2 + FOLLOW_AHEAD * WINDOW_M;
  return (1 - w) * truckFrame + w * follow;
}

/** 0 under forbikjøringen, 1 når kameraet følger bilen. */
function followWeight(o: Overtake, t: number): number {
  if (!Number.isFinite(o.T) || !(o.a > 0)) return 0;
  // Fra bakenden av bilen passerer fronten av lastebilen: ½at² = GAP_BEHIND + L + CAR_LENGTH
  const t0 = Math.min(o.T, Math.sqrt((2 * (GAP_BEHIND + o.truckLength + CAR_LENGTH)) / o.a));
  const t1 = o.T + FOLLOW_AFTER;
  return t > t0 ? smooth((t - t0) / (t1 - t0)) : 0;
}

/* ------------------------------------------------------------------ Hele figuren */

export function OvertakeScene({ o, t, truck, lay, showArrows }: { o: Overtake; t: number; truck: TruckId; lay: SceneLayout; showArrows: boolean }) {
  return (
    <g>
      <Overview o={o} t={t} truck={truck} lay={lay} />
      <SideView o={o} t={t} truck={truck} lay={lay} showArrows={showArrows} />
    </g>
  );
}

/* ------------------------------------------------------------------ Mållinje */

/**
 * Vannrett mållinje med piler i begge ender og etikett over (eller under) midten, med hjelpelinjer fra `ext`.
 * Etiketten byttes til `short` eller sløyfes når målet er for kort. `chars` er antall tegn i etiketten.
 */
function HDim({
  xa,
  xb,
  y,
  color,
  label,
  chars,
  short,
  shortChars = 0,
  below = false,
  ext,
  size = 0.85,
  weight = 700,
}: {
  xa: number;
  xb: number;
  y: number;
  color: string;
  label?: ReactNode;
  chars?: number;
  short?: ReactNode;
  shortChars?: number;
  below?: boolean;
  ext?: number;
  size?: number;
  weight?: number;
}) {
  const f = useTextScale();
  const ss = useStrokeScale();
  const a = Math.min(xa, xb);
  const b = Math.max(xa, xb);
  if (!Number.isFinite(a) || !Number.isFinite(b) || b - a < 1) return null;
  const fs = 17 * f * size;
  const room = b - a - 6;
  const fits = (n: number) => n * fs * 0.58 + 6 * f <= room;
  const text = label !== undefined && chars !== undefined && fits(chars) ? label : short !== undefined && fits(shortChars) ? short : undefined;
  const h = Math.min(7 * ss, (b - a) / 3);
  const head = (x: number, dir: 1 | -1) => `${x},${y} ${x + dir * h},${y - h * 0.45} ${x + dir * h},${y + h * 0.45}`;
  const ly = below ? y + 6 * f + 0.75 * fs : y - 6 * f;
  return (
    <g>
      {ext !== undefined && (
        <g stroke={color} strokeWidth={1 * ss} strokeDasharray={`${3 * ss} ${3 * ss}`} opacity={0.6}>
          <line x1={a} x2={a} y1={ext} y2={ext < y ? y + 4 : y - 4} />
          <line x1={b} x2={b} y1={ext} y2={ext < y ? y + 4 : y - 4} />
        </g>
      )}
      <line x1={a} x2={b} y1={y} y2={y} stroke={VIZ.surface} strokeWidth={4.2 * ss} opacity={0.85} />
      <line x1={a} x2={b} y1={y} y2={y} stroke={color} strokeWidth={1.6 * ss} />
      {b - a > 3 * h && <polygon points={head(a, 1)} fill={color} />}
      {b - a > 3 * h && <polygon points={head(b, -1)} fill={color} />}
      {text !== undefined && (
        <Txt x={(a + b) / 2} y={ly} size={size} color={color} weight={weight}>
          {text}
        </Txt>
      )}
    </g>
  );
}

/* ------------------------------------------------------------------ Oversikten ovenfra */

/** Strekningen oversikten viser (m): fra litt bak bilen til forbi den møtende bilen, med hele planen for T. */
function overviewRange(o: Overtake): { lo: number; hi: number } {
  const lo = Math.min(-CAR_LENGTH - 6, oncomingFront(o, o.tEnd), o.D - o.sOncoming, carFront(o, 0)) - 8;
  const hi = Math.max(o.D + CAR_LENGTH, carFront(o, o.tEnd), o.s) + 10;
  return { lo, hi };
}

function Overview({ o, t, truck, lay }: { o: Overtake; t: number; truck: TruckId; lay: SceneLayout }) {
  const f = useTextScale();
  const ss = useStrokeScale();
  const id = useSvgId('fk-oversikt');
  const { x0, x1, titleY, lineS, roadTop, roadBottom, lineM, lineD } = lay.map;
  const { lo, hi } = overviewRange(o);
  const k = (x1 - x0) / (hi - lo);
  /** Positiv retning er mot venstre, som i scenen under. */
  const xs = (p: number) => x1 - (p - lo) * k;
  const shoulder = 4;
  const laneUp = roadTop + shoulder + 5.5;
  const laneDown = roadBottom - shoulder - 5.5;
  const midY = (roadTop + roadBottom) / 2;
  const lane = laneOffset(o, t);
  const L = o.truckLength;
  const crash = o.verdict === 'kollisjon';
  const sEnd = o.s;
  const mEnd = o.D - o.sOncoming;
  const C = cameraCenter(o, t);
  const camL = xs(C + WINDOW_M / 2);
  const camR = xs(C - WINDOW_M / 2);
  const dashLen = Math.max(4, 3 * k);

  return (
    <g>
      <Txt x={x0} y={titleY} anchor="start" size={0.8} weight={650} muted>
        Hele strekningen sett ovenfra
      </Txt>
      <Txt x={x1} y={titleY} anchor="end" size={0.8} weight={650} muted>
        ← positiv retning
      </Txt>

      {/* Veien ovenfra: gress, asfalt, kantlinjer og gul midtlinje */}
      <LinearGradient id={id} stops={[[0, tint(SCENE.asphalt, 0.08)], [1, shade(SCENE.asphalt, 0.06)]]} />
      <rect x={x0 - 8} y={roadTop - 3} width={x1 - x0 + 16} height={roadBottom - roadTop + 6} rx={3} fill={SCENE.grass} />
      <rect x={x0 - 8} y={roadTop + shoulder - 1} width={x1 - x0 + 16} height={roadBottom - roadTop - 2 * shoulder + 2} fill={`url(#${id})`} />
      <g stroke={SCENE.roadLine} strokeWidth={0.9 * ss} opacity={0.85}>
        <line x1={x0 - 8} x2={x1 + 8} y1={roadTop + shoulder + 0.8} y2={roadTop + shoulder + 0.8} />
        <line x1={x0 - 8} x2={x1 + 8} y1={roadBottom - shoulder - 0.8} y2={roadBottom - shoulder - 0.8} />
      </g>
      <line x1={x0 - 8} x2={x1 + 8} y1={midY} y2={midY} stroke={PAINTS.gul} strokeWidth={1.1 * ss} strokeDasharray={`${dashLen} ${dashLen * 1.6}`} />

      {/* Det som mangler (kollisjon) eller luka (rekker det) mellom der bilen og den møtende bilen er ved tiden T */}
      {crash ? (
        <rect x={Math.min(xs(sEnd), xs(mEnd))} y={roadTop + shoulder} width={Math.abs(xs(sEnd) - xs(mEnd))} height={roadBottom - roadTop - 2 * shoulder} fill={alpha(C_CRASH, 0.4)} />
      ) : (
        <rect x={Math.min(xs(sEnd), xs(mEnd))} y={roadTop + shoulder} width={Math.abs(xs(sEnd) - xs(mEnd))} height={roadBottom - roadTop - 2 * shoulder} fill={alpha(SCENE.highlight, 0.18)} />
      )}

      {/* Utsnittet som scenen under viser */}
      <rect
        x={Math.max(x0 - 8, camL)}
        y={roadTop - 1.5}
        width={Math.max(0, Math.min(x1 + 8, camR) - Math.max(x0 - 8, camL))}
        height={roadBottom - roadTop + 3}
        rx={2}
        fill="none"
        stroke={VIZ.ink}
        strokeWidth={1 * ss}
        strokeDasharray={`${3 * ss} ${2.5 * ss}`}
        opacity={0.45}
      />

      {/* Kjøretøyene ved tiden t (lengdene i målestokk, men minst et lite ikon) */}
      <LastebilOvenfra x={xs(truckRear(o, t) + L / 2)} y={laneUp} len={Math.max(L * k, 15)} wid={7.5} type={truck} lakk={TRUCK_PAINT} flip />
      <BilOvenfra x={xs(carFront(o, t) - CAR_LENGTH / 2)} y={laneUp + (laneDown - laneUp) * lane} len={Math.max(CAR_LENGTH * k, 13)} wid={6.5} lakk={CAR_PAINT} flip />
      <BilOvenfra x={xs(oncomingFront(o, t) + CAR_LENGTH / 2)} y={laneDown} len={Math.max(CAR_LENGTH * k, 13)} wid={6.5} lakk={ONCOMING_PAINT} />
      {crash && t >= o.tMeet - 1e-9 && <Smell x={xs(o.xMeet)} y={midY} r={9 * Math.min(1.3, f)} />}

      {/* Målene for tiden T: bilen kjører s, den møtende bilen s_M, og D er avstanden ved start */}
      <HDim
        xa={xs(0)}
        xb={xs(sEnd)}
        y={lineS}
        color={C_CAR}
        chars={10 + fmt(sEnd, 0).length}
        label={<>bilen: s = {fmt(sEnd, 0)} m</>}
        short={`${fmt(sEnd, 0)} m`}
        shortChars={2 + fmt(sEnd, 0).length}
      />
      {!crash && o.margin > 0.5 && (
        <HDim
          xa={xs(sEnd)}
          xb={xs(mEnd)}
          y={lineS}
          color={VIZ.muted}
          chars={7 + fmt(o.margin, 0).length}
          label={`luke ${fmt(o.margin, 0)} m`}
          short={`${fmt(o.margin, 0)} m`}
          shortChars={2 + fmt(o.margin, 0).length}
          weight={650}
        />
      )}
      <HDim
        xa={xs(o.D)}
        xb={xs(mEnd)}
        y={lineM}
        below
        color={C_ONCOMING}
        chars={16 + fmt(o.sOncoming, 0).length}
        label={
          <>
            møtende bil: s<TSub>M</TSub> = {fmt(o.sOncoming, 0)} m
          </>
        }
        short={
          <>
            s<TSub>M</TSub> = {fmt(o.sOncoming, 0)} m
          </>
        }
        shortChars={6 + fmt(o.sOncoming, 0).length}
      />
      <HDim
        xa={xs(0)}
        xb={xs(o.D)}
        y={lineD}
        below
        color={VIZ.ink}
        ext={roadBottom - shoulder}
        chars={24 + fmt(o.D, 0).length + (crash ? 15 + fmt(o.needed, 0).length : 0)}
        label={
          <>
            avstand ved start: D = {fmt(o.D, 0)} m{crash && <tspan style={{ fill: C_CRASH }}>, men trenger {fmt(o.needed, 0)} m</tspan>}
          </>
        }
        short={
          <>
            D = {fmt(o.D, 0)} m{crash && <tspan style={{ fill: C_CRASH }}> &lt; {fmt(o.needed, 0)} m</tspan>}
          </>
        }
        shortChars={6 + fmt(o.D, 0).length + (crash ? 5 + fmt(o.needed, 0).length : 0)}
        weight={650}
      />
    </g>
  );
}

/* ------------------------------------------------------------------ Scenen fra siden */

function SideView({ o, t, truck, lay, showArrows }: { o: Overtake; t: number; truck: TruckId; lay: SceneLayout; showArrows: boolean }) {
  const f = useTextScale();
  const clip = useSvgId('fk-scene');
  const { W, top, sceneH, horizon, landH, road, B, m } = lay;
  const L = o.truckLength;
  const C = cameraCenter(o, t);
  /** Skjermposisjonen til en posisjon p langs veien (positiv retning mot venstre). */
  const X = (p: number) => W / 2 + (C - p) * m;
  const scroll = -C * m;
  const yFar = road - 0.43 * B;
  const yNear = road;
  const lane = laneOffset(o, t);
  const yCar = yFar + (yNear - yFar) * lane;
  const crashNow = o.verdict === 'kollisjon' && t >= o.tMeet - 1e-9;
  const dimsOpacity = Number.isFinite(o.T) ? 1 - smooth((t - o.T) / DIMS_FADE) : 1;

  const front = carFront(o, t);
  const v = carVelocity(o, t);
  const acc = carAcceleration(o, t);
  const xM = oncomingFront(o, t);
  const rear = truckRear(o, t);
  const carLen = BIL_MAAL.lengde * m;
  const carH = BIL_MAAL.hoyde * m;
  const truckTop = yFar - LASTEBIL_MAAL.hoyde * m;

  // Kantstolper bak veien hver 50. meter
  const posts: number[] = [];
  const half = WINDOW_M / 2 + 4;
  for (let p = Math.ceil((C - half) / POST_SPACING) * POST_SPACING; p <= C + half; p += POST_SPACING) posts.push(p);

  // Den møtende bilen: synlig når fronten er inne i bildet
  const oncomingX = X(xM);
  const oncomingVisible = oncomingX > -carLen - 4 && oncomingX < W + 4;
  const gap = xM - front;

  // Pilene: én skala for fart (px per m/s) og én for akselerasjon
  const kv = lay.kv;
  const arrowCarY = yCar - carH - 11 * f;
  const arrowAccY = arrowCarY - 19 * f;
  const arrowTruckY = truckTop - 13 * f;
  const xCar = X(front - CAR_LENGTH / 2);
  const xTruck = X(rear + L / 2);
  const xOnc = X(xM + CAR_LENGTH / 2);
  const kmh = (x: number) => `${fmt(msToKmh(x), 0)} km/h`;

  return (
    <g transform={`translate(0 ${top})`}>
      <defs>
        <clipPath id={clip}>
          <rect x={0} y={0} width={W} height={sceneH} rx={4} />
        </clipPath>
      </defs>
      <g clipPath={`url(#${clip})`}>
        <Himmel w={W} h={horizon + 2} sol={lay.sun} skyer={2} seed={11} forskyvning={scroll} />
        <Landskap x={0} y={horizon} w={W} h={landH} type="aaser" seed={4} forskyvning={scroll} />
        <Vei x1={0} x2={W} y={road} bredde={B} horisont={horizon} depth={sceneH - road} forskyvning={scroll} seed={3} />
        {posts.map((p) => (
          <Kantstolpe key={p} x={X(p)} y={road - 0.7 * B - 1} m={m} />
        ))}

        {/* Målene i forhold til lastebilen: luke bak, lastebilen, luke foran og bilen. Følger lastebilen. */}
        {dimsOpacity > 0 && <RelativeDims o={o} X={X} rear={rear} lay={lay} yFar={yFar} opacity={dimsOpacity} name={TRUCKS[truck].name} />}

        {/* Lastebilen i sitt felt (det bakre), bilen og den møtende bilen i det nære feltet */}
        <SpeedLines x={X(rear)} y={yFar - 2.2 * m} length={o.v0 * 1.1 * Math.min(1.4, m / 8)} spread={1.6 * m} dir={-1} />
        <Lastebil x={X(rear)} y={yFar} m={m} type={truck} lakk={TRUCK_PAINT} hjulvinkel={lastebilHjulvinkel(rear)} flip title={truck === 'vogntog' ? 'Vogntog' : 'Lastebil'} />
        <SpeedLines x={X(front - CAR_LENGTH)} y={yCar - 0.62 * m} length={v * 1.1 * Math.min(1.4, m / 8)} spread={0.55 * m} dir={-1} />
        <Bil x={X(front - BIL_MAAL.foran)} y={yCar} size={carLen} lakk={CAR_PAINT} hjulvinkel={hjulvinkelFraStrekning(front)} flip title="Bilen som kjører forbi" />
        {oncomingVisible && (
          <>
            <SpeedLines x={X(xM + CAR_LENGTH)} y={yNear - 0.62 * m} length={o.u * 1.1 * Math.min(1.4, m / 8)} spread={0.55 * m} dir={1} />
            <Bil x={X(xM + BIL_MAAL.foran)} y={yNear} size={carLen} lakk={ONCOMING_PAINT} type="stasjonsvogn" hjulvinkel={hjulvinkelFraStrekning(o.u * t)} title="Møtende bil" />
          </>
        )}
        {crashNow && <Smell x={X(o.xMeet)} y={yNear - 0.8 * m} r={Math.max(12 * f, 1.3 * m)} />}

        {showArrows && (
          <g>
            <ForceArrow x1={xTruck} y1={arrowTruckY} x2={xTruck - o.v0 * kv} y2={arrowTruckY} color={VIZ.velocity} width={5.5} label={kmh(o.v0)} labelSize={0.82} />
            {!crashNow && (
              <ForceArrow x1={xCar} y1={arrowCarY} x2={xCar - v * kv} y2={arrowCarY} color={VIZ.velocity} width={5.5} label={kmh(v)} labelSize={0.82} origin={acc > 0} />
            )}
            {!crashNow && acc > 0 && (
              <ForceArrow x1={xCar} y1={arrowAccY} x2={xCar - acc * lay.ka} y2={arrowAccY} color={VIZ.acceleration} width={4.5} label="a" labelSize={0.82} />
            )}
            {oncomingVisible && !crashNow && (
              <ForceArrow x1={xOnc} y1={yNear - carH - 11 * f} x2={xOnc + o.u * kv} y2={yNear - carH - 11 * f} color={VIZ.velocity} width={5.5} label={kmh(o.u)} labelSize={0.82} />
            )}
          </g>
        )}

        {/* Den møtende bilen er utenfor bildet: hvor langt unna er den? */}
        {!oncomingVisible && gap > 0 && oncomingX < 0 && (
          <ValueTag x={8} y={yNear - 2} text={`← møtende bil om ${fmt(gap, 0)} m`} color={C_ONCOMING} anchor="start" size={0.8} />
        )}
      </g>
    </g>
  );
}

/** Mållinjene i veikanten: 15 m bak, lastebilens lengde, 15 m foran og bilens lengde, og summen Δs_rel. */
function RelativeDims({
  o,
  X,
  rear,
  lay,
  yFar,
  opacity,
  name,
}: {
  o: Overtake;
  X: (p: number) => number;
  rear: number;
  lay: SceneLayout;
  yFar: number;
  opacity: number;
  name: string;
}) {
  const L = o.truckLength;
  const pStart = rear - GAP_BEHIND;
  const pTR = rear;
  const pTF = rear + L;
  const pTgtRear = pTF + GAP_AHEAD;
  const pTgtFront = pTgtRear + CAR_LENGTH;
  const ext = yFar + 1;
  return (
    <g opacity={opacity}>
      <HDim xa={X(pStart)} xb={X(pTR)} y={lay.dim1} color={VIZ.ink} ext={ext} chars={4} label={`${fmt(GAP_BEHIND, 0)} m`} weight={650} size={0.8} />
      <HDim
        xa={X(pTR)}
        xb={X(pTF)}
        y={lay.dim1}
        color={C_TRUCK}
        ext={ext}
        chars={4 + (L % 1 ? 2 : 0)}
        label={`${fmt(L, L % 1 ? 1 : 0)} m`}
        weight={700}
        size={0.8}
      />
      <HDim xa={X(pTF)} xb={X(pTgtRear)} y={lay.dim1} color={VIZ.ink} ext={ext} chars={4} label={`${fmt(GAP_AHEAD, 0)} m`} weight={650} size={0.8} />
      <HDim xa={X(pTgtRear)} xb={X(pTgtFront)} y={lay.dim1} color={C_CAR} ext={ext} chars={5} label={`${fmt(CAR_LENGTH, 1)} m`} weight={700} size={0.8} />
      <HDim
        xa={X(pStart)}
        xb={X(pTgtFront)}
        y={lay.dim2}
        color={VIZ.ink}
        chars={30 + name.length}
        label={
          <>
            bilen må flytte seg Δs<TSub>rel</TSub> = {fmt(o.rel, 1)} m forbi {name}
          </>
        }
        short={
          <>
            Δs<TSub>rel</TSub> = {fmt(o.rel, 1)} m
          </>
        }
        shortChars={14}
        weight={700}
        size={0.8}
      />
    </g>
  );
}
