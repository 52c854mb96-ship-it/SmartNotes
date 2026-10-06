/**
 * Scenen til «Fall med luftmotstand» (k2-luftmotstand): en fallskjermhopper som faller over et norsk landskap før skjermen er løst ut,
 * sett fra en kameramann som følger hopperen. Hoppflyet forsvinner oppover, skyene under glir opp mot horisonten
 * og lufta suser forbi. Tyngden G og luftmotstanden L er tegnet med én fast skala (px/N), og farten v og
 * akselerasjonen a står i to søyler med terminalfarten og g som merker.
 */
import { useMemo, type ReactNode } from 'react';
import { Txt, TSub, VIZ, fmt, useTextScale } from '../../kit';
import { G_EARTH } from '../../kit/format';
import {
  ForceArrow,
  Himmel,
  PAINTS,
  Person,
  SCENE,
  ValueTag,
  alpha,
  mix,
  personPunkter,
  useStrokeScale,
} from '../../kit/scene';
import { DRAG_RANGES, type FallState } from './model';
import { posture, type Posture } from './luftmotstand-positur';
import { FLY_LENGDE, FjerneFjell, Flyfoto, Hoppfly, Hoydestripe, Silhuett, SkyerUnder } from './luftmotstand-deler';

/* ================================================================================================
 * Oppsettet: PC og mobil
 * ============================================================================================== */

interface Layout {
  W: number;
  H: number;
  /** Tyngdepunktet til hopperen. */
  cx: number;
  cy: number;
  /** Piksler per meter for hopperen. */
  P: number;
  /** Piksler per newton for G og L. */
  kN: number;
  horizon: number;
  /** Høydestripa (PC) eller bare et skilt med høyden øverst til høyre (mobil). */
  ribbon: { x: number; top: number; bottom: number } | null;
  v: { x: number; scale: number };
  a: { x: number; scale: number };
  plane: { dx: number; dy: number; size: number };
  mountains: number;
  /** Hopperen sett nedenfra: midten og radien til sirkelen. */
  inset: { x: number; y: number; r: number };
  clouds: number;
}

const G_MAX = DRAG_RANGES.m.max * G_EARTH;
const r1 = (v: number) => Math.round(v * 10) / 10;

export function sceneLayout(narrow: boolean): Layout {
  if (narrow) {
    const cy = 370;
    return {
      W: 800,
      H: 900,
      cx: 300,
      cy,
      P: 150,
      kN: 300 / G_MAX,
      horizon: 730,
      ribbon: null,
      v: { x: 600, scale: 2.8 },
      a: { x: 722, scale: 23 },
      plane: { dx: 165, dy: -200, size: 170 },
      mountains: 46,
      inset: { x: 148, y: 608, r: 82 },
      clouds: 4,
    };
  }
  const cy = 178;
  return {
    W: 800,
    H: 400,
    cx: 285,
    cy,
    P: 84,
    kN: 168 / G_MAX,
    horizon: 292,
    ribbon: { x: 768, top: 52, bottom: 372 },
    v: { x: 510, scale: 1.65 },
    a: { x: 605, scale: 12 },
    plane: { dx: 125, dy: -80, size: 150 },
    mountains: 26,
    inset: { x: 84, y: 210, r: 48 },
    clouds: 6,
  };
}

/* ================================================================================================
 * Scenen
 * ============================================================================================== */

export interface LuftSceneProps {
  m: number;
  k: number;
  t: number;
  st: FallState;
  vT: number;
  showForces: boolean;
  narrow: boolean;
}

/** Luftstriper rundt hopperen: sideveis plassering (i kroppslengder fra tyngdepunktet) og startfase (0–1). */
const STREAKS = [
  [-1.25, 0.05],
  [-0.85, 0.55],
  [-0.45, 0.3],
  [0.35, 0.8],
  [0.75, 0.15],
  [1.2, 0.62],
] as const;

export function LuftScene({ m, k, t, st, vT, showForces, narrow }: LuftSceneProps) {
  const f = useTextScale();
  const ss = useStrokeScale();
  const lay = sceneLayout(narrow);
  const { W, H, cx, cy, P, kN } = lay;
  const h = DRAG_RANGES.jumpHeight - st.s;
  const G = m * G_EARTH;
  const pose = posture(k);
  const size = 1.75 * P;
  const pts = personPunkter('falle', size, pose.ledd, { x: cx, y: cy, anker: 'tyngdepunkt', rotate: pose.rotate });

  // Himmel og fjell endres ikke; bakken og skyene endres bare med høyden (memoisert inne i komponentene).
  const sky = useMemo(
    () => (
      <>
        <Himmel x={0} y={0} w={W} h={lay.horizon + 1} skyer={0} seed={4} />
        <FjerneFjell x={0} y={lay.horizon + 1} w={W} h={lay.mountains} seed={5} />
      </>
    ),
    [W, lay.horizon, lay.mountains],
  );

  // Hoppflyet ligger lenger unna enn hopperen (mindre skala) og forsvinner oppover når hopperen faller.
  const q = lay.plane.size / FLY_LENGDE;
  const planeY = cy + lay.plane.dy - st.s * q;
  const showPlane = planeY > -lay.plane.size * 0.3;

  // Lufta som suser forbi: stripene flytter seg oppover i takt med fallet. De er et stykke bak hopperen (mindre skala),
  // så de flytter seg sakte nok til at øyet kan følge dem, og raskere jo større farten er.
  const streakLen = Math.min(narrow ? 170 : 95, st.v * (narrow ? 2.4 : 1.35));
  const streakSpan = narrow ? 380 : 230;

  const gLen = G * kN;
  const lLen = st.L * kN;
  const vLen = st.v * lay.v.scale;
  const aLen = st.a * lay.a.scale;
  const vTy = cy + vT * lay.v.scale;
  const gY = cy + G_EARTH * lay.a.scale;
  const near = st.v >= 0.97 * vT;
  const status = t < 0.05 ? 'Hopperen slipper flyet' : near ? 'L ≈ G: konstant fart' : 'Farten øker, og L øker';
  const kmh = `${fmt(st.v * 3.6, 0)} km/h`;

  return (
    <g>
      {sky}
      <Flyfoto x={0} w={W} horisont={lay.horizon} bunn={H} hoyde={h} seed={3} />
      <SkyerUnder x={0} w={W} horisont={lay.horizon} bunn={H} hoyde={h} skyhoyde={1600} antall={lay.clouds} seed={2} />

      {showPlane && <Hoppfly x={cx + lay.plane.dx} y={planeY} size={lay.plane.size} lakk="rod" />}

      {st.v > 0.5 &&
        STREAKS.map(([dx, y0], i) => {
          const x = cx + dx * size * 0.62;
          const u = (((y0 - (st.s * P * 0.07) / streakSpan) % 1) + 1) % 1;
          const y = cy - streakSpan * 0.55 + u * streakSpan;
          const len = streakLen * (0.75 + 0.25 * ((i * 5) % 3) / 2);
          // Svakere i endene av vinduet, så stripene ikke dukker opp brått.
          const fade = Math.min(1, u / 0.2, (1 - u) / 0.25);
          const w2 = 1.6 * ss;
          return (
            <path
              key={i}
              d={`M${(x - w2).toFixed(1)},${y.toFixed(1)}Q${x.toFixed(1)},${(y - w2 * 1.4).toFixed(1)} ${(x + w2).toFixed(1)},${y.toFixed(1)}L${x.toFixed(1)},${(y + len).toFixed(1)}Z`}
              fill={alpha(SCENE.cloud, 0.85)}
              opacity={Math.max(0, fade)}
            />
          );
        })}

      {pose.wings > 0.01 && (
        // Vingedrakten sett fra siden: stoffet mellom armen og kroppen og mellom beina (vingene er nesten på kant).
        <g opacity={pose.wings} fill={mix(PAINTS.oransje, PAINTS.svart, 0.4)} stroke={SCENE.outline} strokeWidth={0.9 * ss} strokeLinejoin="round">
          <path d={`M${r1(pts.skulder.x)},${r1(pts.skulder.y)}L${r1(pts.hoyreHand.x)},${r1(pts.hoyreHand.y)}L${r1(pts.sete.x)},${r1(pts.sete.y)}Z`} />
          <path d={`M${r1(pts.sete.x)},${r1(pts.sete.y)}L${r1(pts.venstreAnkel.x)},${r1(pts.venstreAnkel.y)}L${r1(pts.hoyreAnkel.x)},${r1(pts.hoyreAnkel.y)}Z`} />
        </g>
      )}
      <Person
        x={cx}
        y={cy}
        size={size}
        pose="falle"
        ledd={pose.ledd}
        anker="tyngdepunkt"
        rotate={pose.rotate}
        jakke="oransje"
        bukse="oransje"
        hjelm="svart"
        sekk="svart"
        sko="svart"
        skygge={false}
        title={`Fallskjermhopper, ${pose.name.toLowerCase()}`}
      />

      <PoseInset {...lay.inset} pose={pose} k={k} />

      {showForces && (
        <g>
          <ForceArrow x1={cx} y1={cy} x2={cx} y2={cy + gLen} color={VIZ.gravity} label="G" labelX={cx + 12 * ss} labelY={cy + gLen - 2} origin />
          <ForceArrow
            x1={cx}
            y1={cy}
            x2={cx}
            y2={cy - lLen}
            color={VIZ.friction}
            label="L"
            labelX={cx + 12 * ss}
            // Over ryggen når L er liten, så etiketten ikke havner oppå hopperen.
            labelY={Math.min(cy - lLen + 14 * f, cy - 0.2 * size)}
            minLength={4}
          />
        </g>
      )}

      {/* Fart og akselerasjon (begge nedover) med terminalfarten og g som merker */}
      <Column
        x={lay.v.x}
        top={cy}
        len={vLen}
        refY={vTy}
        color={VIZ.velocity}
        label="v"
        refLabel={
          <>
            v<TSub>T</TSub>
          </>
        }
      />
      <Column x={lay.a.x} top={cy} len={aLen} refY={gY} color={VIZ.acceleration} label="a" refLabel="g" zeroSide={narrow ? 'below' : 'right'} />
      <ValueTag x={lay.v.x} y={cy - 24 * f} text={kmh} color={VIZ.velocity} size={0.85} pointer={6 * ss} />

      {lay.ribbon ? (
        <Hoydestripe x={lay.ribbon.x} topp={lay.ribbon.top} bunn={lay.ribbon.bottom} hoyde={h} maks={DRAG_RANGES.jumpHeight} />
      ) : (
        <ValueTag x={W - 16} y={30 * f} text={`Høyde ${fmt(h, 0)} m`} anchor="end" size={0.85} />
      )}

      <Txt x={18} y={30 * f} anchor="start" size={0.95} weight={650}>
        {status}
      </Txt>
    </g>
  );
}

/** Hopperen sett nedenfra i en rund ramme, med kroppsstillingen og luftmotstandstallet under. */
function PoseInset({ x, y, r, pose, k }: { x: number; y: number; r: number; pose: Posture; k: number }) {
  const f = useTextScale();
  return (
    <g>
      <Txt x={x} y={y - r - 10 * f} size={0.72} weight={650} muted>
        Sett nedenfra
      </Txt>
      <Silhuett x={x} y={y} r={r} belly={pose.belly} spread={pose.spread} wings={pose.wings} />
      <Txt x={x} y={y + r + 20 * f} size={0.8} weight={700}>
        {pose.name}
      </Txt>
      <Txt x={x} y={y + r + 39 * f} size={0.8} weight={600}>
        k = {fmt(k, 2)} kg/m
      </Txt>
    </g>
  );
}

/**
 * Søyle for fart eller akselerasjon: pil nedover fra toppen, med et stiplet merke for grenseverdien. Når pila er for
 * kort til å være en tykk pil, tegnes en tynn pil med riktig lengde, og helt ned mot null står «≈ 0» i stedet.
 */
function Column({
  x,
  top,
  len,
  refY,
  color,
  label,
  refLabel,
  zeroSide = 'right',
}: {
  x: number;
  top: number;
  len: number;
  refY: number;
  color: string;
  label: string;
  refLabel: ReactNode;
  /** Hvor «≈ 0» står: til høyre for prikken, eller under den (når søyla står helt til høyre i figuren). */
  zeroSide?: 'right' | 'below';
}) {
  const f = useTextScale();
  const ss = useStrokeScale();
  // Etiketten til pila står litt til høyre for merket, så den ikke havner oppå streken når pila når grenseverdien.
  const lx = x + 22 * ss;
  const head = 6 * ss;
  return (
    <g>
      <line x1={x - 16 * ss} x2={x + 16 * ss} y1={refY} y2={refY} stroke={VIZ.surface} strokeWidth={4.5 * ss} opacity={0.75} />
      <line x1={x - 16 * ss} x2={x + 16 * ss} y1={refY} y2={refY} stroke={color} strokeWidth={2 * ss} strokeDasharray={`${5 * ss} ${4 * ss}`} />
      <Txt x={x - 22 * ss} y={refY + 6 * f} anchor="end" color={color} size={0.9} weight={700}>
        {refLabel}
      </Txt>
      <circle cx={x} cy={top} r={3.6 * ss} fill={VIZ.ink} stroke={VIZ.surface} strokeWidth={1.6 * ss} />
      {len >= 16 ? (
        <ForceArrow x1={x} y1={top} x2={x} y2={top + len} color={color} label={label} labelX={lx} labelY={top + len - 2} />
      ) : len >= 3 ? (
        <g>
          <line x1={x} y1={top} x2={x} y2={top + Math.max(0, len - head)} stroke={color} strokeWidth={2.4 * ss} />
          <polygon points={`${x - head * 0.75},${top + len - head} ${x + head * 0.75},${top + len - head} ${x},${top + len}`} fill={color} />
          <Txt x={lx} y={top + 6 * f} anchor="start" color={color} size={0.9} weight={700}>
            {label}
          </Txt>
        </g>
      ) : (
        <Txt x={zeroSide === 'right' ? x + 12 * ss : x} y={zeroSide === 'right' ? top + 6 * f : top + 26 * f} anchor={zeroSide === 'right' ? 'start' : 'middle'} color={color} size={0.9} weight={700}>
          {label} ≈ 0
        </Txt>
      )}
    </g>
  );
}
