/**
 * Scenen «egg som faller 1 m» i visualiseringen «impuls»: nærbilde av gulvet ved veggen, der egget treffer en tynn
 * matte, et sammenbrettet håndkle eller en pute. Alt er tegnet i én skala (1500 px/m), så eggets 5,7 cm og
 * bremselengden s er i riktige proporsjoner. Gjenstandene her finnes ikke i scene-kit-et, så de er laget lokalt i
 * samme stil (toninger fra core, SCENE- og PAINTS-farger, tynn kontur og myke skygger).
 */
import { memo } from 'react';
import { Txt, VIZ, fmt } from '../../kit';
import {
  Callout,
  ContactShadow,
  Dimension,
  ForceArrow,
  LinearGradient,
  PAINTS,
  RadialGradient,
  SCENE,
  ValueTag,
  materialStops,
  mix,
  shade,
  tint,
  useStrokeScale,
  useSvgId,
} from '../../kit/scene';
import { eggAt, eggPath, layerY, surfacePoints, surfaceY, type Dent, type EggShape } from './impuls-form';
import { impactAt, timeToForce, type ImpactResult } from './model';

/** Piksler per meter i eggescenen. */
export const EGG_PX_PER_M = 2000;
/** Kraftpilene: piksler per newton (fast i hele scenen, så pila er like lang som kraften). */
const F_PX_PER_N = 1.6;
/** Fartspila: piksler per m/s. */
const V_PX_PER_MS = 16;

export const EGG_W = 800;
export const EGG_H = 360;
/** Der underlagene står (forkanten av gulvet de står på). */
const FLOOR_Y = 336;
/** Der veggen møter gulvet bak, og toppen av fotlisten (6 cm høy). */
const WALL_Y = 262;
const LIST_TOP = WALL_Y - 0.06 * EGG_PX_PER_M;
/** Midten av egget (vannrett). */
export const EGG_CX = 400;
/** Utsnittet på mobil: bare området rundt egget, så egget og underlaget blir store nok. */
const NARROW = { x: EGG_CX - 215, w: 450 };

export function eggViewBox(narrow: boolean): string {
  return narrow ? `${NARROW.x} 0 ${NARROW.w} ${EGG_H}` : `0 0 ${EGG_W} ${EGG_H}`;
}

export type SurfaceId = 'matte' | 'haandkle' | 'pute';

interface SurfaceSpec {
  name: string;
  /** I en setning: «treffer en tynn matte», «på matta». */
  indefinite: string;
  definite: string;
  /** Minste tykkelse (m). Ellers er tykkelsen s/0,7, så underlaget aldri presses helt flatt. */
  minT: number;
  x1: number;
  x2: number;
  /** Hvor bredt bulken sprer seg (i halve eggbredder) og hvor mye materialet ved siden av trekkes med. */
  spread: number;
  shoulder: number;
}

export const SURFACES: Record<SurfaceId, SurfaceSpec> = {
  matte: {
    name: 'Tynn matte',
    indefinite: 'en tynn matte',
    definite: 'matta',
    minT: 0.01,
    x1: 96,
    x2: 840,
    spread: 1.15,
    shoulder: 0.5,
  },
  haandkle: {
    name: 'Sammenbrettet håndkle',
    indefinite: 'et sammenbrettet håndkle',
    definite: 'håndkleet',
    minT: 0.026,
    x1: 160,
    x2: 660,
    spread: 2,
    shoulder: 0.66,
  },
  pute: {
    name: 'Pute',
    indefinite: 'en pute',
    definite: 'puta',
    minT: 0.09,
    x1: 120,
    x2: 840,
    spread: 2.8,
    shoulder: 0.76,
  },
};

/** Underlaget som hører til en støttid (samme grenser som i forklaringen). */
export function surfaceFor(dtMs: number): SurfaceId {
  return dtMs < 7 ? 'matte' : dtMs < 15 ? 'haandkle' : 'pute';
}

export interface EggSceneProps {
  r: ImpactResult;
  m: number;
  v0: number;
  dtMs: number;
  /** Tiden i støtet (ms): 0 når egget treffer. */
  tMs: number;
  /** Hvor stor kraft egget tåler (N). */
  limit: number;
  showForces: boolean;
  /** Øyeblikksbildet (størst kraft) eller avspilling. */
  snapshot: boolean;
  /** Smal figur (mobil): utsnittet rundt egget. */
  narrow: boolean;
}

export function EggScene({ r, m, v0, dtMs, tMs, limit, showForces, snapshot, narrow }: EggSceneProps) {
  const K = EGG_PX_PER_M;
  const sid = surfaceFor(dtMs);
  const spec = SURFACES[sid];
  const T = Math.max(spec.minT, r.stopDist / 0.7) * K;
  const top = FLOOR_Y - T;
  const st = impactAt(m, v0, dtMs / 1000, tMs / 1000);
  const egg = eggAt(EGG_CX, top + Math.max(0, st.s) * K, K);
  const dent: Dent = {
    top,
    egg,
    spread: egg.w * spec.spread,
    shoulder: spec.shoulder,
  };
  // Det synlige utsnittet (smalere på mobil), så etikettene holder seg innenfor.
  const left = narrow ? NARROW.x : 0;
  const right = narrow ? NARROW.x + NARROW.w : EGG_W;

  // Egget sprekker når kraften første gang blir større enn det tåler.
  const tBreak = timeToForce(r.Fmax, dtMs, limit);
  const cracked = tBreak !== null && r.Fmax > limit && tMs >= tBreak;
  const yolk = cracked ? Math.min(1, (tMs - tBreak) / Math.max(0.5, dtMs - tBreak)) : 0;
  const status = cracked ? 'Egget knuses' : snapshot || st.v <= 0 ? 'Egget holder' : 'Egget bremses';

  const stopY = top + r.stopDist * K;
  const fLen = st.F * F_PX_PER_N;
  const vLen = st.v * V_PX_PER_MS;
  const dimX = EGG_CX + egg.w + 46;
  // Fartspila står ved siden av egget, så den ikke dekker kraftpila.
  const vx = EGG_CX - egg.w - 26;
  const vy = egg.mid - 24;
  // Navnet på underlaget står på gulvet foran det, til venstre i bildet.
  const calloutX = Math.max(spec.x1 + 40, left + 20);

  // Klipp scenen til utsnittet, så ingenting tegnes utenfor når figuren er bredere enn tegningen.
  const clipId = useSvgId('impuls-utsnitt');
  return (
    <g>
      <clipPath id={clipId}>
        <rect x={left} y={0} width={right - left} height={EGG_H} />
      </clipPath>
      <g clipPath={`url(#${clipId})`}>
        <Bakgrunn />
        <ContactShadow
          cx={(Math.max(spec.x1, 0) + Math.min(spec.x2, EGG_W)) / 2}
          cy={FLOOR_Y}
          rx={(Math.min(spec.x2, EGG_W) - Math.max(spec.x1, 0)) / 2 + 10}
          ry={7}
        />
        {sid === 'matte' && <Matte x1={spec.x1} x2={spec.x2} y={FLOOR_Y} dent={dent} />}
        {sid === 'haandkle' && <Haandkle x1={spec.x1} x2={spec.x2} y={FLOOR_Y} dent={dent} />}
        {sid === 'pute' && <Pute x1={spec.x1} x2={spec.x2} y={FLOOR_Y} dent={dent} />}

        {/* Overflaten før støtet og der egget stopper (stiplet), med bremselengden s */}
        <g stroke={VIZ.ink} strokeWidth={1.2} strokeDasharray="5 4" opacity={0.6} fill="none">
          <line x1={EGG_CX - egg.w - 34} y1={top} x2={dimX + 8} y2={top} />
          <line x1={EGG_CX + egg.w * 0.3} y1={stopY} x2={dimX + 8} y2={stopY} />
        </g>
        <Dimension x1={dimX} y1={top} x2={dimX} y2={stopY} label={`s = ${fmt(r.stopDist * 100, 1)} cm`} labelSize={0.85} />

        <Egg e={egg} cracked={cracked} yolk={yolk} />

        {st.v > 0.02 && (
          <>
            <ForceArrow x1={vx} y1={vy} x2={vx} y2={vy + vLen} color={VIZ.velocity} width={5.5} minLength={6} />
            <ValueTag
              x={vx - 12}
              y={vy + Math.max(vLen, 30) - 6}
              anchor="end"
              text={`v = ${fmt(st.v, 1)} m/s`}
              color={VIZ.velocity}
              size={0.85}
            />
          </>
        )}
        {showForces && (
          <>
            <ForceArrow x1={EGG_CX} y1={egg.mid} x2={EGG_CX} y2={egg.mid - fLen} color={VIZ.applied} origin minLength={6} />
            {st.F > 0.5 && (
              <ValueTag
                x={EGG_CX + 30}
                y={Math.min(egg.mid - fLen, egg.mid - egg.up) + 14}
                anchor="start"
                text={`F = ${fmt(st.F, st.F < 10 ? 1 : 0)} N`}
                color={VIZ.applied}
                size={0.85}
              />
            )}
          </>
        )}

        <Callout x={calloutX + 30} y={FLOOR_Y - Math.min(T * 0.35, 14)} lx={calloutX + 4} ly={FLOOR_Y + 19} anchor="start">
          {spec.name}
        </Callout>
        <Txt x={left + 16} y={30} anchor="start" size={0.85} muted>
          Egg på {fmt(m * 1000, 0)} g sluppet fra 1,0 m
        </Txt>
        <ValueTag x={right - 14} y={28} anchor="end" text={status} size={0.9} />
      </g>
    </g>
  );
}

/* ---------- Bakgrunn: vegg, fotlist og tregulv sett tett på ---------- */

/** Fotlisten: hvit i lyst tema, men ikke lysere enn veggen i mørkt tema (skumring). */
const LIST = mix(SCENE.wall, PAINTS.hvit, 0.5);

const Bakgrunn = memo(function Bakgrunn() {
  const id = useSvgId('impuls-rom');
  const ss = useStrokeScale();
  const floorH = EGG_H - WALL_Y;
  // Gulvbord parallelt med veggen; radene blir høyere jo nærmere de er.
  const seams = [0.18, 0.44, 0.8].map((f) => WALL_Y + floorH * f);
  return (
    <g aria-hidden>
      <LinearGradient
        id={`${id}v`}
        stops={[
          [0, tint(SCENE.wall, 0.08)],
          [1, SCENE.wallShade],
        ]}
      />
      <rect x={0} y={0} width={EGG_W} height={LIST_TOP + 2} fill={`url(#${id}v)`} />
      {/* Fotlist med profil øverst */}
      <LinearGradient
        id={`${id}l`}
        stops={[
          [0, tint(LIST, 0.35)],
          [0.1, LIST],
          [0.13, shade(LIST, 0.1)],
          [0.18, tint(LIST, 0.2)],
          [1, shade(LIST, 0.06)],
        ]}
      />
      <rect x={0} y={LIST_TOP} width={EGG_W} height={WALL_Y - LIST_TOP} fill={`url(#${id}l)`} />
      <line x1={0} y1={LIST_TOP} x2={EGG_W} y2={LIST_TOP} stroke={SCENE.outline} strokeWidth={0.8 * ss} opacity={0.6} />
      {/* Gulvet */}
      <LinearGradient
        id={`${id}g`}
        stops={[
          [0, shade(SCENE.floor, 0.12)],
          [0.5, SCENE.floor],
          [1, tint(SCENE.floor, 0.08)],
        ]}
      />
      <rect x={0} y={WALL_Y} width={EGG_W} height={floorH} fill={`url(#${id}g)`} />
      <LinearGradient
        id={`${id}s`}
        stops={[
          [0, SCENE.shadow, 0.7],
          [1, SCENE.shadow, 0],
        ]}
      />
      <rect x={0} y={WALL_Y} width={EGG_W} height={14} fill={`url(#${id}s)`} />
      <g stroke={SCENE.floorDark} strokeWidth={1.2 * ss} opacity={0.75}>
        {seams.map((y) => (
          <line key={y} x1={0} y1={y} x2={EGG_W} y2={y} />
        ))}
        <line x1={238} y1={seams[0]} x2={232} y2={seams[1]} />
        <line x1={620} y1={seams[1]} x2={628} y2={seams[2]} />
        <line x1={96} y1={seams[2]} x2={88} y2={EGG_H} />
      </g>
      <g stroke={SCENE.floorDark} strokeWidth={0.8 * ss} opacity={0.35} strokeLinecap="round">
        <path
          d={`M40,${WALL_Y + 8} h150 M420,${WALL_Y + 9} h120 M300,${seams[0]! + 10} h210 M660,${seams[0]! + 12} h100 M120,${seams[1]! + 12} h170 M480,${seams[2]! + 10} h190`}
        />
      </g>
    </g>
  );
});

/* ---------- Underlagene ---------- */

interface UnderlagProps {
  x1: number;
  x2: number;
  /** Gulvet underlaget står på. */
  y: number;
  dent: Dent;
}

const pts = (p: [number, number][]) => p.map(([x, y]) => `L${x},${Math.round(y * 100) / 100}`).join('');

/**
 * Tynn treningsmatte i skumgummi. Den venstre enden bretter seg litt opp (som en matte som har vært rullet sammen),
 * og matta går ut av bildet til høyre.
 */
function Matte({ x1, x2, y, dent }: UnderlagProps) {
  const id = useSvgId('impuls-matte');
  const ss = useStrokeScale();
  const T = y - dent.top;
  const color = mix(mix(PAINTS.rod, PAINTS.lilla, 0.45), PAINTS.graa, 0.3);
  // Oppbrettet ende: midtlinja løfter seg som en parabel de siste L enhetene.
  const L = 130;
  const lift = Math.max(14, T * 0.75);
  const liftAt = (x: number) => (x < x1 + L ? lift * ((x1 + L - x) / L) ** 2 : 0);
  const theta = Math.atan((2 * lift) / L);
  const curl: number[] = [];
  for (let x = x1; x < x1 + L; x += 6) curl.push(x);
  const top = curl.map((x) => [x, y - T - liftAt(x)] as [number, number]);
  const bottom = [...curl].reverse().map((x) => [x, y - liftAt(x)] as [number, number]);
  const surf = surfacePoints(x1 + L, x2, dent);
  const endTop: [number, number] = [x1 - T * Math.sin(theta), y - lift - T * Math.cos(theta)];
  const d = `M${x1},${y - lift} A${T / 2},${T / 2} 0 0 1 ${endTop[0]},${endTop[1]}${pts(top.slice(1))}${pts(surf)} L${x2},${y}${pts(bottom)} Z`;
  // En lysere stripe i det øverste laget og en mørk kant nederst, så matta ser ut som et flatt lag skumgummi.
  const inner = (f: number) => {
    const p = [
      ...top.slice(1).map(([x]) => [x, y - T * (1 - f) - liftAt(x)] as [number, number]),
      ...surf.map(([x]) => [x, layerY(x, dent, y, f)] as [number, number]),
    ];
    return `M${p[0]![0]},${p[0]![1]}${pts(p.slice(1))}`;
  };
  return (
    <g>
      <ContactShadow cx={x1 + L * 0.9} cy={y} rx={L * 0.5} ry={4} opacity={0.6} />
      <LinearGradient id={id} stops={materialStops(color, 1.1)} />
      <path d={d} fill={`url(#${id})`} stroke={SCENE.outline} strokeWidth={1 * ss} strokeLinejoin="round" />
      <path d={inner(0.18)} fill="none" stroke={SCENE.highlight} strokeWidth={1.4 * ss} />
      <path d={inner(0.82)} fill="none" stroke={shade(color, 0.3)} strokeWidth={1.2 * ss} opacity={0.7} />
    </g>
  );
}

/** Kjøkkenhåndkle brettet i fire lag: lagene bøyer seg mindre jo lenger ned de ligger, og endene viser brettene. */
function Haandkle({ x1, x2, y, dent }: UnderlagProps) {
  const id = useSvgId('impuls-haandkle');
  const ss = useStrokeScale();
  const T = y - dent.top;
  const q = T / 4;
  // Brettene i endene er flate buer (stoff, ikke rør): bredden er mindre enn høyden.
  const bx = Math.min(q * 0.9, 12);
  const color = mix(PAINTS.oransje, PAINTS.hvit, 0.42);
  const surf = surfacePoints(x1 + bx, x2 - bx, dent);
  const yr = (f: number) => layerY(x2 - bx, dent, y, f);
  // Venstre ende: bretten mellom lag 1–2 og mellom lag 3–4. Høyre ende: bretten mellom lag 2–3 og de løse kantene.
  const d =
    `M${x1 + bx},${y} A${bx},${q} 0 0 1 ${x1 + bx},${y - 2 * q} A${bx},${q} 0 0 1 ${x1 + bx},${dent.top}` +
    `${pts(surf)} L${x2 - bx * 0.4},${yr(0.04)} A${bx},${2 * q} 0 0 1 ${x2 - bx * 0.4},${yr(1)} Z`;
  const layer = (f: number) => {
    const p = surfacePoints(x1 + bx, x2 - bx, dent).map(([x]) => [x, layerY(x, dent, y, f)] as [number, number]);
    return `M${p[0]![0]},${p[0]![1]}${pts(p.slice(1))}`;
  };
  // Vevde striper nær endene (som på et kjøkkenhåndkle)
  const stripes = [x1 + bx + 22, x1 + bx + 31, x2 - bx - 31, x2 - bx - 22];
  return (
    <g>
      <LinearGradient id={id} stops={materialStops(color, 0.9)} />
      <clipPath id={`${id}c`}>
        <path d={d} />
      </clipPath>
      <path d={d} fill={`url(#${id})`} />
      <g clipPath={`url(#${id}c)`}>
        {stripes.map((x, i) => (
          <line
            key={i}
            x1={x}
            y1={dent.top - 4}
            x2={x}
            y2={y + 2}
            stroke={shade(PAINTS.rod, 0.05)}
            strokeWidth={(i % 3 === 0 ? 2 : 4.5) * ss}
            opacity={0.5}
          />
        ))}
        <path d={layer(0.25)} fill="none" stroke={shade(color, 0.25)} strokeWidth={1 * ss} opacity={0.7} />
        <path d={layer(0.5)} fill="none" stroke={shade(color, 0.38)} strokeWidth={1.3 * ss} opacity={0.85} />
        <path d={layer(0.75)} fill="none" stroke={shade(color, 0.25)} strokeWidth={1 * ss} opacity={0.7} />
        <path
          d={`M${x1},${dent.top + 1.5}${pts(surf.map(([x, yy]) => [x, yy + 1.5]))}`}
          fill="none"
          stroke={SCENE.highlight}
          strokeWidth={1.6 * ss}
        />
      </g>
      <path d={d} fill="none" stroke={SCENE.outline} strokeWidth={1 * ss} strokeLinejoin="round" />
    </g>
  );
}

/** Pute med fyllig, avrundet ende, kantebånd langs siden og myke rynker rundt bulken. Går ut av bildet til høyre. */
function Pute({ x1, x2, y, dent }: UnderlagProps) {
  const id = useSvgId('impuls-pute');
  const ss = useStrokeScale();
  const T = y - dent.top;
  const color = mix(PAINTS.blaa, PAINTS.hvit, 0.74);
  const xs = x1 + 0.62 * T;
  const surf = surfacePoints(xs, x2, dent);
  const d =
    `M${x1 + 0.55 * T},${y} C${x1 + 0.18 * T},${y} ${x1 + 0.04 * T},${y - 0.24 * T} ${x1},${y - 0.5 * T}` +
    ` C${x1 + 0.06 * T},${y - 0.8 * T} ${x1 + 0.24 * T},${surf[0]![1]} ${xs},${surf[0]![1]}${pts(surf.slice(1))} L${x2},${y} Z`;
  const depth = surfaceY(dent.egg?.cx ?? 0, dent) - dent.top;
  // Kantebåndet ligger midt på siden og bøyer seg bare litt ned under egget.
  const seam = surfacePoints(x1 + 0.08 * T, x2, dent).map(
    ([x]) => [x, y - 0.5 * T + (surfaceY(x, dent) - dent.top) * 0.18] as [number, number],
  );
  const seamD = `M${x1},${y - 0.5 * T} L${seam[0]![0]},${seam[0]![1]}${pts(seam.slice(1))}`;
  const cx = dent.egg?.cx ?? 0;
  const w = dent.egg?.w ?? 0;
  const rim = (sx: number) => surfaceY(cx + sx * w * 1.9, dent);
  return (
    <g>
      <LinearGradient
        id={id}
        stops={[
          [0, tint(color, 0.4)],
          [0.35, color],
          [1, shade(color, 0.24)],
        ]}
      />
      <RadialGradient
        id={`${id}r`}
        cx={0.1}
        cy={0.3}
        r={0.55}
        stops={[
          [0, SCENE.highlight, 0.9],
          [1, SCENE.highlight, 0],
        ]}
      />
      <clipPath id={`${id}c`}>
        <path d={d} />
      </clipPath>
      <path d={d} fill={`url(#${id})`} />
      <g clipPath={`url(#${id}c)`}>
        <rect x={x1} y={dent.top} width={T * 3} height={T} fill={`url(#${id}r)`} />
        <path d={seamD} fill="none" stroke={shade(color, 0.3)} strokeWidth={2.6 * ss} />
        <path d={seamD} fill="none" stroke={SCENE.highlight} strokeWidth={1 * ss} transform="translate(0 2)" />
        {/* Rynker som trekkes ned mot egget når puta presses sammen */}
        {depth > 6 && (
          <g fill="none" stroke={shade(color, 0.28)} strokeWidth={1.1 * ss} strokeLinecap="round" opacity={Math.min(0.75, depth / 50)}>
            {[-1, 1].map((sx) => (
              <g key={sx}>
                <path
                  d={`M${cx + sx * w * 2.6},${rim(1.37 * sx) + 6} Q${cx + sx * w * 1.8},${rim(sx) + depth * 0.25} ${cx + sx * w * 1.15},${dent.top + depth * 0.82}`}
                />
                <path
                  d={`M${cx + sx * w * 2.3},${rim(1.2 * sx) + T * 0.22} Q${cx + sx * w * 1.6},${rim(sx) + depth * 0.4} ${cx + sx * w * 1.05},${dent.top + depth + 4}`}
                />
              </g>
            ))}
          </g>
        )}
      </g>
      <path d={d} fill="none" stroke={SCENE.outline} strokeWidth={1 * ss} strokeLinejoin="round" />
      <path
        d={`M${xs},${surf[0]![1] + 2}${pts(surf.slice(1).map(([x, yy]) => [x, yy + 2]))}`}
        fill="none"
        stroke={SCENE.highlight}
        strokeWidth={1.6 * ss}
      />
    </g>
  );
}

/* ---------- Egget ---------- */

/** Hvitt hønseegg med lys fra øvre venstre. Sprukket: sprekk tvers over og litt eggeplomme som renner ut nederst. */
function Egg({ e, cracked, yolk }: { e: EggShape; cracked: boolean; yolk: number }) {
  const id = useSvgId('impuls-egg');
  const ss = useStrokeScale();
  const shell = mix(PAINTS.hvit, SCENE.woodLight, 0.22);
  const d = eggPath(e);
  const { cx, mid, w, up, down } = e;
  const bottom = mid + down;
  const crackY = mid + down * 0.12;
  const crack = `M${cx - w},${crackY - 2} L${cx - w * 0.62},${crackY + 7} L${cx - w * 0.3},${crackY - 5} L${cx + w * 0.02},${crackY + 8} L${cx + w * 0.34},${crackY - 4} L${cx + w * 0.66},${crackY + 6} L${cx + w},${crackY}`;
  const branch = `M${cx - w * 0.3},${crackY - 5} L${cx - w * 0.22},${crackY - 18} M${cx + w * 0.34},${crackY - 4} L${cx + w * 0.46},${crackY + 12}`;
  const yolkColor = mix(PAINTS.gul, PAINTS.oransje, 0.35);
  return (
    <g>
      {yolk > 0 && (
        <ellipse
          cx={cx + w * 0.7}
          cy={bottom - 3}
          rx={w * (0.35 + 0.55 * yolk)}
          ry={3 + 3.5 * yolk}
          fill={yolkColor}
          stroke={shade(yolkColor, 0.3)}
          strokeWidth={0.8 * ss}
        />
      )}
      <ContactShadow cx={cx} cy={bottom - 1} rx={w * 0.8} ry={4} />
      <RadialGradient
        id={id}
        cx={0.42}
        cy={0.4}
        r={0.62}
        fx={0.34}
        fy={0.28}
        stops={[
          [0, tint(shell, 0.7)],
          [0.5, shell],
          [1, shade(shell, 0.3)],
        ]}
      />
      <clipPath id={`${id}c`}>
        <path d={d} />
      </clipPath>
      <path d={d} fill={`url(#${id})`} />
      {/* Refleks fra underlaget nederst og glans øverst til venstre */}
      <ellipse cx={cx} cy={bottom} rx={w * 0.9} ry={down * 0.35} fill={shade(shell, 0.2)} opacity={0.35} clipPath={`url(#${id}c)`} />
      <ellipse
        cx={cx - w * 0.38}
        cy={mid - up * 0.42}
        rx={w * 0.2}
        ry={up * 0.2}
        transform={`rotate(-18 ${cx - w * 0.38} ${mid - up * 0.42})`}
        fill={SCENE.highlight}
      />
      {cracked && (
        <g clipPath={`url(#${id}c)`} fill="none" strokeLinejoin="round" strokeLinecap="round">
          <path d={crack} stroke={tint(shell, 0.6)} strokeWidth={3.4 * ss} transform="translate(0 1.5)" />
          <path d={crack} stroke={shade(shell, 0.62)} strokeWidth={2 * ss} />
          <path d={branch} stroke={shade(shell, 0.55)} strokeWidth={1.4 * ss} />
        </g>
      )}
      <path d={d} fill="none" stroke={SCENE.outline} strokeWidth={1 * ss} />
    </g>
  );
}
