/**
 * Lupen i «Arbeid og effekt i trappa»: et forstørret utsnitt av løperen i trappa med kreftene på henne, og ringen
 * med to streker som viser hvor i scenen utsnittet er tatt. Lupen har sin egen skala (px/m og px/N), fast for
 * hele glidebryteren, så pilene vokser med massen.
 */
import { memo } from 'react';
import { G_EARTH, VIZ } from '../../kit';
import {
  ForceArrow,
  Himmel,
  Person,
  SCENE,
  Stoppeklokke,
  alpha,
  Terreng,
  personPunkter,
  useStrokeScale,
  useSvgId,
  type Leddvinkler,
  type PaintName,
} from '../../kit/scene';
import { Rekkverk, Steintrapp, Varde } from './trappelop-deler';
import {
  RUNNER_HEIGHT,
  lupeForces,
  lupeMap,
  outerTangents,
  type Circle,
  type RunnerPlace,
  type RunnerPose,
  type StairGeom,
} from './trappelop-scene';

/** Utseendet til en person, likt i scenen og i lupen. */
export interface Look {
  jakke: PaintName | string;
  bukse?: PaintName | string;
  sko?: PaintName | string;
  har?: string;
  frisyre?: 'kort' | 'lang' | 'hestehale';
}

/** Venninnen som tar tida: hvor hun står (m), positur og utseende. */
export interface Friend {
  x: number;
  size: number;
  ledd: Partial<Leddvinkler>;
  look: Look;
}

const ORIGIN = { xs: 0, yBot: 0 };

/**
 * Det som står stille i lupen (terrenget, trappa, rekkverket og varden), tegnet med origo ved foten av trappa og
 * skalaen Z (px/m). Lupen flytter gruppen med en transform, så dette tegnes bare når trappa endres.
 */
const LupeVerden = memo(function LupeVerden({ g, Z, cairnX }: { g: StairGeom; Z: number; cairnX: number }) {
  const ground: [number, number][] = [
    [-6 * Z, 0],
    [0, 0],
    [g.L * Z, -g.h * Z],
    [(g.L + 6) * Z, -g.h * Z],
  ];
  return (
    <g>
      <Terreng points={ground} bottom={4 * Z} type="gress" seed={4} />
      <Rekkverk g={g} lay={ORIGIN} S={Z} />
      <Steintrapp g={g} lay={ORIGIN} S={Z} />
      <Varde x={cairnX * Z} y={-g.h * Z} size={1.3 * Z} />
    </g>
  );
});

export interface LupeProps {
  g: StairGeom;
  lupe: Circle;
  place: RunnerPlace;
  rp: RunnerPose;
  look: Look;
  /** Masse (kg): lengden på pilene. */
  m: number;
  /** Varden og venninnen (m), så de også synes i lupen når løperen er nær dem. */
  cairnX: number;
  friend: Friend;
  /** Tiden på venninnens stoppeklokke (s). */
  tau: number;
}

/**
 * Ringen rundt løperen og strekene ut til lupen. Tegnes før lupen, så strekene går inn under kanten.
 */
export function LupeRing({ ring, lupe }: { ring: Circle; lupe: Circle }) {
  const ss = useStrokeScale();
  const t = outerTangents(ring, lupe);
  return (
    <g aria-hidden>
      {t?.map(([p, q], i) => (
        <g key={i}>
          <line x1={p.x} y1={p.y} x2={q.x} y2={q.y} stroke={VIZ.surface} strokeWidth={3.2 * ss} strokeLinecap="round" opacity={0.6} />
          <line x1={p.x} y1={p.y} x2={q.x} y2={q.y} stroke={VIZ.ink} strokeWidth={1 * ss} strokeLinecap="round" opacity={0.5} />
        </g>
      ))}
      <circle cx={ring.x} cy={ring.y} r={ring.r} fill="none" stroke={VIZ.surface} strokeWidth={4 * ss} opacity={0.75} />
      <circle cx={ring.x} cy={ring.y} r={ring.r} fill="none" stroke={VIZ.ink} strokeWidth={1.4 * ss} opacity={0.75} />
    </g>
  );
}

/**
 * Forstørret utsnitt av løperen med tyngden G og kraften oppover: F fra beina mens hun løper (i snitt like stor som
 * G når farten er jevn), og normalkraften N når hun står stille nederst eller på toppen. Som i læreboka virker G i
 * tyngdepunktet og F eller N der føttene står, så pilene ikke dekker ansiktet.
 */
export function Lupe({ g, lupe, place, rp, look, m, cairnX, friend, tau }: LupeProps) {
  const ss = useStrokeScale();
  const clip = useSvgId('tr-lupe');
  const { x: cx, y: cy, r: R } = lupe;
  const map = lupeMap(lupe, place, rp);
  const { Z } = map;
  const size = RUNNER_HEIGHT * Z;
  const arrows = lupeForces(lupe, place, rp, m, G_EARTH);
  const climbing = place.phase === 'climb';
  const up = climbing ? { color: VIZ.applied, label: 'F' } : { color: VIZ.normal, label: 'N' };
  // Venninnen synes i lupen bare når løperen står nederst eller er på vei opp de første trinnene.
  const fx = map.ox + friend.x * Z;
  const showFriend = Math.abs(fx - cx) < R + 0.6 * Z;
  const fSize = (friend.size / RUNNER_HEIGHT) * size;
  const watch = showFriend ? personPunkter('staa', fSize, friend.ledd, { x: fx, y: map.oy }).hoyreHand : null;
  const { G, up: U } = arrows;

  return (
    <g>
      {/* Myk skygge under lupen, så den ligger oppå scenen */}
      <circle cx={cx + 2.5} cy={cy + 4} r={R + 3} fill={SCENE.shadow} opacity={0.22} />
      <defs>
        <clipPath id={clip}>
          <circle cx={cx} cy={cy} r={R} />
        </clipPath>
      </defs>
      <g clipPath={`url(#${clip})`}>
        <Himmel x={cx - R} y={cy - R} w={2 * R} h={2 * R} />
        <g transform={`translate(${r2(map.ox)} ${r2(map.oy)})`}>
          <LupeVerden g={g} Z={Z} cairnX={cairnX} />
        </g>
        {showFriend && (
          <>
            <Person x={fx} y={map.oy} size={fSize} pose="staa" ledd={friend.ledd} {...friend.look} />
            {watch && <Stoppeklokke x={watch.x + 0.03 * Z} y={watch.y - 0.05 * Z} r={0.07 * Z} t={tau} digital={false} />}
          </>
        )}
        <Person x={map.anchor.x} y={map.anchor.y} size={size} pose={rp.pose} ledd={rp.ledd} fase={place.fase} skraaning={rp.skraaning} {...look} />
      </g>
      {/* Kanten: glorie, kontur og en tynn lys ring innenfor, som glass */}
      <circle cx={cx} cy={cy} r={R} fill="none" stroke={VIZ.surface} strokeWidth={6 * ss} />
      <circle cx={cx} cy={cy} r={R + 3 * ss} fill="none" stroke={alpha(VIZ.ink, 0.45)} strokeWidth={1.3 * ss} />
      <circle cx={cx} cy={cy} r={R - 3 * ss} fill="none" stroke={SCENE.outline} strokeWidth={0.8 * ss} opacity={0.6} />
      {/* F (eller N) virker der føttene treffer trinnet, G i tyngdepunktet. Pilene står side om side, så du ser at de er like lange. */}
      <ForceArrow x1={U.x1} y1={U.y1} x2={U.x2} y2={U.y2} color={up.color} label={up.label} labelX={U.x2 + 11 * ss} labelY={U.y2 + 15} labelAnchor="start" />
      <ForceArrow x1={G.x1} y1={G.y1} x2={G.x2} y2={G.y2} color={VIZ.gravity} label="G" labelX={G.x2 - 11 * ss} labelY={G.y2 - 2} labelAnchor="end" origin />
    </g>
  );
}

const r2 = (v: number) => Math.round(v * 100) / 100;
