/**
 * Scenen i visualiseringen «ballspark»: nærbilde av treffet. Foten sparker en fotball som ligger på straffemerket,
 * racketen treffer en tennisball på toppen av kastet i en serve, eller kølla slår en golfball fra en tee. Hver scene
 * er tegnet i én skala (px/m), så ballen, foten og strekningene er i riktige proporsjoner (se målestokken).
 */
import { memo } from 'react';
import { VIZ, fmt, useTextScale } from '../../kit';
import {
  Ball,
  ContactShadow,
  Dimension,
  ForceArrow,
  Himmel,
  Landskap,
  SpeedLines,
  Underlag,
  ValueTag,
  useSvgId,
  type BallType,
} from '../../kit/scene';
import { ballPose, hitterPose, type Shot, type Swing } from './ballspark-anim';
import { ANKLE_HEIGHT, Driver, Fotballbein, Golfflagg, Racket, Straffemerke, Tee, kickPoint, legGeometry } from './ballspark-deler';
import { fDecimals } from './ballspark-graf';
import { kick, kickAt, maxSpeed, type SportId } from './model-ballspark';

export const SCENE_W = 800;
export const SCENE_H = 340;

interface Layout {
  /** Piksler per meter. */
  K: number;
  ball: BallType;
  /** Midten av ballen før treffet. */
  x0: number;
  y0: number;
  /** Bakken (fotball og golf). */
  ground?: number;
  horizon?: number;
  swing: Swing;
  /** Ballen etter treffet i øyeblikksbildet. */
  ghostX: number;
  /** Utsnittet på mobil. */
  narrow: { x: number; w: number };
  /** Målestokken: lengde (m) og tekst. */
  scale: { m: number; label: string; y: number };
  caption: string;
}

/** Fotballbeinet i treffet: foten peker ned og vristen treffer midt bak på ballen. */
const FOT_VINKEL = 70;
const LEGG_VINKEL = 8;

function footballLayout(): Layout {
  const K = 620;
  const ground = 296;
  const R = 0.11 * K;
  const x0 = 318;
  const y0 = ground - R;
  const contact = { x: x0 - R, y: y0 };
  const kp = kickPoint(K, FOT_VINKEL, LEGG_VINKEL);
  const ankle = { x: contact.x - kp.x, y: contact.y - kp.y };
  const knee = legGeometry(K, FOT_VINKEL, LEGG_VINKEL).shin(0.43, 0);
  return {
    K,
    ball: 'fotball',
    x0,
    y0,
    ground,
    horizon: 168,
    swing: { contact, pivot: { x: ankle.x + knee.x, y: ankle.y + knee.y } },
    ghostX: 628,
    narrow: { x: 120, w: 600 },
    scale: { m: 0.1, label: '10 cm', y: 324 },
    caption: 'Fotball på 430 g som ligger i ro på straffemerket',
  };
}

function tennisLayout(): Layout {
  const K = 900;
  const R = 0.0335 * K;
  const x0 = 380;
  const y0 = 176;
  const contact = { x: x0 - R, y: y0 };
  return {
    K,
    ball: 'tennis',
    x0,
    y0,
    swing: { contact, pivot: { x: contact.x - 0.15 * K, y: contact.y + 0.85 * K } },
    ghostX: 620,
    narrow: { x: 200, w: 560 },
    scale: { m: 0.05, label: '5 cm', y: 318 },
    caption: 'Tennisball på 57 g på toppen av kastet i en serve',
  };
}

function golfLayout(): Layout {
  const K = 1500;
  const ground = 300;
  const R = 0.02135 * K;
  const tee = 0.025 * K;
  const x0 = 380;
  const y0 = ground - tee - R + 0.002 * K;
  const contact = { x: x0 - R, y: y0 };
  return {
    K,
    ball: 'golf',
    x0,
    y0,
    ground,
    horizon: 150,
    swing: { contact, pivot: { x: contact.x - 0.06 * K, y: contact.y - 1.6 * K } },
    ghostX: 610,
    narrow: { x: 140, w: 580 },
    scale: { m: 0.05, label: '5 cm', y: 326 },
    caption: 'Golfball på 45,9 g som ligger på en tee',
  };
}

const LAYOUTS: Record<SportId, Layout> = { fotball: footballLayout(), tennis: tennisLayout(), golf: golfLayout() };

/** Teksten under scenen. */
export function sceneCaption(sport: SportId): string {
  const L = LAYOUTS[sport];
  return `${L.caption}. Målestokken nede til venstre viser ${L.scale.label}.`;
}

export function sceneViewBox(sport: SportId, narrow: boolean): string {
  const n = LAYOUTS[sport].narrow;
  return narrow ? `${n.x} 0 ${n.w} ${SCENE_H}` : `0 0 ${SCENE_W} ${SCENE_H}`;
}

/** Kraftpila: største kraft på glidebryteren blir 220 px; fartspila: største mulige fart blir 200 px. */
const F_MAX_PX = 220;
const V_MAX_PX = 200;

export interface BallsparkSceneProps {
  shot: Shot;
  sportId: SportId;
  /** Tiden (ms) etter at treffet begynner. */
  tMs: number;
  /** Øyeblikksbildet (størst kraft, med ballen etter treffet som et spøkelse) eller avspilling. */
  snapshot: boolean;
  narrow: boolean;
}

export function BallsparkScene({ shot, sportId, tMs, snapshot, narrow }: BallsparkSceneProps) {
  const f = useTextScale();
  const L = LAYOUTS[sportId];
  const { sport, Fmax, dtMs, shape } = shot;
  const K = L.K;
  const R = sport.r * K;
  const res = kick(sport.m, Fmax, dtMs / 1000, shape);
  const st = kickAt(sport.m, Fmax, dtMs / 1000, shape, tMs / 1000);
  const ball = ballPose(shot, K, L.x0, R, tMs);
  const hit = hitterPose(shot, K, L.x0, R, L.swing, res.v, tMs);
  const kF = F_MAX_PX / sport.F.max;
  const kV = V_MAX_PX / maxSpeed(sport);
  const left = narrow ? L.narrow.x : 0;
  const right = narrow ? L.narrow.x + L.narrow.w : SCENE_W;
  const clipId = useSvgId('bs-utsnitt');
  const ballTop = L.y0 - R * ball.sy;
  const cy = L.ground !== undefined && sportId === 'fotball' ? L.ground - R * ball.sy : L.y0;
  // Største kraft med samme antall desimaler som glidebryteren; underveis i avspillingen med én til.
  const forceText = (F: number, top: boolean) =>
    sport.forceUnit === 'kN' ? `${fmt(F / 1000, top ? fDecimals(sport) : 2)} kN` : `${fmt(F, 0)} N`;
  const vText = (v: number) => `v = ${fmt(v, v < 10 ? 2 : 1)} m/s`;

  const status = snapshot ? 'Midt i treffet' : st.phase === 'for' ? 'Før treffet' : st.phase === 'under' ? 'Under treffet' : 'Etter treffet: F = 0';
  const fTip = ball.back + st.F * kF;
  // Ballen etter treffet (øyeblikksbildet) står til høyre for kraftpila, men innenfor utsnittet.
  const ghostX = Math.min(right - R - 8, Math.max(L.ghostX, fTip + R + 26));
  // Fartspila over ballen (avspilling) eller over ballen etter treffet (øyeblikksbildet), alltid innenfor utsnittet
  const vx = snapshot ? ghostX : ball.cx;
  const vNow = snapshot ? res.v : st.v;
  const vLen = vNow * kV;
  const vy = (snapshot ? L.y0 - R : ballTop) - 16 * f;
  const vStart = snapshot ? Math.min(vx - Math.min(R * 0.6, 40), right - 14 - vLen) : vx - Math.min(R * 0.6, 40);
  const hitter = (
    <g transform={`translate(${r2(hit.dx)} 0) rotate(${r2(hit.angle, 3)} ${r2(hit.pivot.x)} ${r2(hit.pivot.y)})`}>
      <Hitter L={L} sport={sportId} />
    </g>
  );
  return (
    <g>
      <clipPath id={clipId}>
        <rect x={left} y={0} width={right - left} height={SCENE_H} />
      </clipPath>
      <g clipPath={`url(#${clipId})`}>
        <Bakgrunn sport={sportId} />
        {sportId === 'fotball' && <Standbein L={L} />}
        {sportId === 'golf' && <Tee x={L.x0} y={L.ground!} K={K} />}
        {L.ground !== undefined && (
          <ContactShadow
            cx={ball.cx}
            cy={L.ground}
            rx={R * (sportId === 'golf' ? 0.7 : 0.85)}
            ry={R * 0.12}
            opacity={sportId === 'golf' ? 0.55 : 0.9}
          />
        )}

        {/* Ballen etter treffet (øyeblikksbildet): svakere, med stiplet bane fra ballen i treffet */}
        {snapshot && (
          <g>
            <line
              x1={ball.cx + R * ball.sx + 6}
              y1={L.y0}
              x2={ghostX - R - 6}
              y2={L.y0}
              stroke={VIZ.velocity}
              strokeWidth={2}
              strokeDasharray="2 7"
              strokeLinecap="round"
              opacity={0.8}
            />
            {L.ground !== undefined && <ContactShadow cx={ghostX} cy={L.ground} rx={R * 0.8} ry={R * 0.1} opacity={0.5} />}
            <g opacity={0.55}>
              <Ball x={ghostX} y={L.y0} r={R} type={L.ball} />
            </g>
          </g>
        )}

        {/* Ballen, presset flat mot foten, racketen eller kølla. Tennisballen er foran strengene (vi ser racketen
            skrått forfra), fotballen og golfballen bak foten og kølla. */}
        {sportId === 'tennis' && hitter}
        <g transform={`translate(${r2(ball.cx)} ${r2(cy)}) scale(${r2(ball.sx, 4)} ${r2(ball.sy, 4)})`}>
          <Ball x={0} y={0} r={R} type={L.ball} />
        </g>
        {!snapshot && st.phase === 'etter' && (
          <SpeedLines x={ball.cx - R - 4} y={L.y0} length={Math.min(140, res.v * kV * 0.6)} spread={R * 0.9} />
        )}
        {sportId !== 'tennis' && hitter}

        {/* Kraften på ballen fra foten, racketen eller kølla (bare mens de er i kontakt) */}
        {st.F > 0 && (
          <ForceArrow
            x1={ball.back}
            y1={L.y0}
            x2={ball.back + st.F * kF}
            y2={L.y0}
            color={VIZ.applied}
            origin
            minLength={8}
            label={`F = ${forceText(st.F, snapshot)}`}
            labelX={Math.max(fTip, left + 70 * f)}
            labelY={L.y0 + R * ball.sy + 26 * f}
            labelAnchor="middle"
          />
        )}

        {/* Farten */}
        {vNow > 0.01 && (
          <>
            <ForceArrow x1={vStart} y1={vy} x2={vStart + vLen} y2={vy} color={VIZ.velocity} width={5.5} minLength={6} />
            <ValueTag
              x={snapshot ? right - 12 : vStart}
              y={vy - 22 * f}
              anchor={snapshot ? 'end' : 'start'}
              text={snapshot ? `${vText(res.v)} etter treffet` : vText(st.v)}
              color={VIZ.velocity}
              size={0.85}
            />
          </>
        )}

        <Dimension
          x1={left + 24}
          y1={L.scale.y}
          x2={left + 24 + L.scale.m * K}
          y2={L.scale.y}
          label={L.scale.label}
          color={VIZ.ink}
          labelSize={0.8}
        />
        <ValueTag x={right - 14} y={26 * f} anchor="end" text={status} size={0.85} />
      </g>
    </g>
  );
}

const r2 = (v: number, d = 2) => {
  const k = 10 ** d;
  return Math.round(v * k) / k;
};

/** Bakgrunnen står stille, så den tegnes én gang per ball. */
const Bakgrunn = memo(function Bakgrunn({ sport }: { sport: SportId }) {
  const L = LAYOUTS[sport];
  if (sport === 'tennis') {
    return (
      <g>
        <Himmel w={SCENE_W} h={SCENE_H} sol={{ x: 90, y: 60 }} skyer={2} seed={4} />
        <Landskap x={0} y={SCENE_H + 6} w={SCENE_W} h={64} type="skog" seed={2} />
      </g>
    );
  }
  const horizon = L.horizon!;
  const ground = L.ground!;
  return (
    <g>
      <Himmel w={SCENE_W} h={horizon + 2} sol={sport === 'golf' ? { x: 120, y: 54 } : undefined} skyer={2} seed={sport === 'golf' ? 7 : 3} />
      <Landskap x={0} y={horizon} w={SCENE_W} h={sport === 'golf' ? 60 : 52} type={sport === 'golf' ? 'aaser' : 'skog'} seed={sport === 'golf' ? 5 : 3} />
      {sport === 'golf' && <Golfflagg x={668} y={horizon + 4} h={26} />}
      <Underlag x1={0} x2={SCENE_W} y={ground} depth={SCENE_H - ground} type="gress" horisont={horizon} seed={sport === 'golf' ? 4 : 2} />
      {sport === 'fotball' && <Straffemerke x={L.x0} y={ground - 1} w={0.2 * L.K} />}
    </g>
  );
});

/**
 * Standbeinet står ved siden av ballen, litt lenger unna (mindre og mørkere), med knottene i gresset. Tåa er like
 * bak forkanten av ballen, så foten skjules av ballen til den er sparket.
 */
function Standbein({ L }: { L: Layout }) {
  const s = 0.93;
  const gx = L.x0 + 0.11 * L.K - 0.215 * L.K * s;
  const gy = L.ground! - 7;
  return (
    <g transform={`translate(${r2(gx)} ${r2(gy)}) scale(${s})`}>
      <ContactShadow cx={0.06 * L.K} cy={0} rx={0.15 * L.K} ry={6} opacity={0.7} />
      <Fotballbein x={0} y={-ANKLE_HEIGHT * L.K} K={L.K} fotvinkel={0} leggvinkel={-3} fjern knotter={false} />
    </g>
  );
}

/** Foten, racketen eller kølla i det treffet begynner (dreies og flyttes av hitterPose). */
const Hitter = memo(function Hitter({ L, sport }: { L: Layout; sport: SportId }) {
  const c = L.swing.contact;
  if (sport === 'fotball') {
    const kp = kickPoint(L.K, FOT_VINKEL, LEGG_VINKEL);
    return <Fotballbein x={c.x - kp.x} y={c.y - kp.y} K={L.K} fotvinkel={FOT_VINKEL} leggvinkel={LEGG_VINKEL} />;
  }
  if (sport === 'tennis') return <Racket x={c.x} y={c.y} K={L.K} />;
  return <Driver x={c.x} y={c.y} K={L.K} />;
});

/** Til skjermlesere: hva scenen viser. */
export function sceneLabel(sportId: SportId, shot: Shot): string {
  const r = kick(shot.sport.m, shot.Fmax, shot.dtMs / 1000, shot.shape);
  const what = sportId === 'fotball' ? 'En fot sparker en fotball' : sportId === 'tennis' ? 'En racket treffer en tennisball' : 'En golfkølle treffer en golfball';
  return `${what}. Kontakttiden er ${fmt(shot.dtMs, 2)} millisekunder, og ballen får farten ${fmt(r.v, 1)} meter per sekund.`;
}

