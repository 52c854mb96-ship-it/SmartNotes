/**
 * Scenen «ta imot en fotball» i visualiseringen «impuls»: en keeper på en fotballbane tar imot et skudd med stive
 * armer eller myke hender. Ballen stopper helt i hendene, så impulsen er den samme; med myke hender følger keeperen
 * ballen inn mot brystet, så bremselengden s og støttiden blir lange og kraften liten. Alt er tegnet i én skala
 * (190 px/m: keeperen er 1,75 m og ballen 22 cm), og s er strekningen ballens sentrum flytter seg mens den bremses.
 * Målstanga med nett finnes ikke i scene-kit-et, så den er laget lokalt i samme stil (toninger fra core,
 * SCENE- og PAINTS-farger, kontur).
 */
import { memo } from 'react';
import { VIZ, fmt } from '../../kit';
import {
  Ball,
  ContactShadow,
  Dimension,
  ForceArrow,
  Himmel,
  Landskap,
  LinearGradient,
  PAINTS,
  Person,
  SCENE,
  SpeedLines,
  Underlag,
  ValueTag,
  alpha,
  personPunkter,
  shade,
  tint,
  useStrokeScale,
  useSvgId,
} from '../../kit/scene';
import { FOOTBALL, ballSquash, catchPose } from './impuls-form';
import { impactAt, impact, type ImpactResult } from './model';

/** Piksler per meter i ballscenen. */
export const BALL_PX_PER_M = 190;
const K = BALL_PX_PER_M;
export const BALL_W = 800;
export const BALL_H = 380;
const GROUND_Y = 354;
const HORIZON = GROUND_Y - 44;
/** Keeperen (ankerpunktet midt mellom føttene) og målstanga bak ham. */
const KEEPER_X = 205;
const POST_X = 92;
const SIZE = 1.75 * K;
const R = FOOTBALL.r * K;
/** Overkroppens helning (grader) når keeperen venter på ballen, og når hendene har fulgt ballen S_REF meter inn. */
const READY = 8;
const BACK = -3;
const S_REF = 0.42;

/** Utsnittet på mobil: keeperen fra ryggen og ballen med kraftpila foran. */
const NARROW = { x: 118, w: 492 };

export function ballViewBox(narrow: boolean): string {
  return narrow ? `${NARROW.x} 0 ${NARROW.w} ${BALL_H}` : `0 0 ${BALL_W} ${BALL_H}`;
}

/** Leddvinklene: litt bøyde knær (klar til å ta imot), overkroppen lener seg, og hodet holder blikket på ballen. */
const leddFor = (rygg: number) => ({ rygg, nakke: 6 - rygg, venstreHofte: 20, hoyreHofte: 4, venstreKne: 22, hoyreKne: 16 });

/** Skulderen når keeperen venter, og der ballens sentrum er når den treffer hendene (litt under skulderhøyde). */
const READY_PTS = personPunkter('staa', SIZE, leddFor(READY), { x: KEEPER_X, y: GROUND_Y });
const CONTACT_X = READY_PTS.skulder.x + 0.68 * K;
const BALL_Y = READY_PTS.skulder.y + 0.1 * K;

export type CatchId = 'stiv' | 'litt' | 'myk';

interface CatchSpec {
  name: string;
  /** I en setning: «med stive armer». */
  phrase: string;
}

export const CATCHES: Record<CatchId, CatchSpec> = {
  stiv: { name: 'Stive armer', phrase: 'med stive armer' },
  litt: { name: 'Armene gir litt etter', phrase: 'med armer som gir litt etter' },
  myk: { name: 'Myke hender: følger ballen inn', phrase: 'med myke hender som følger ballen inn mot brystet' },
};

/** Måten keeperen tar imot på, ut fra støttiden (samme grenser som i forklaringen). */
export function catchFor(dtMs: number): CatchId {
  return dtMs < 16 ? 'stiv' : dtMs < 35 ? 'litt' : 'myk';
}

export interface BallSceneProps {
  r: ImpactResult;
  m: number;
  v0: number;
  dtMs: number;
  /** Tiden i støtet (ms): 0 når ballen treffer hendene. */
  tMs: number;
  /** Den korteste støttiden på glidebryteren (ms): gir den største kraften, og dermed skalaen for kraftpila. */
  dtMinMs: number;
  showForces: boolean;
  narrow: boolean;
}

export function BallScene({ r, m, v0, dtMs, tMs, dtMinMs, showForces, narrow }: BallSceneProps) {
  const ss = useStrokeScale();
  const spec = CATCHES[catchFor(dtMs)];
  const st = impactAt(m, v0, dtMs / 1000, tMs / 1000);
  const squash = ballSquash(st.F);
  const pose = catchPose(st.s, squash, READY, BACK, S_REF);
  // Ballens sentrum: kommer inn fra høyre før støtet (st.s < 0), og bremses s meter etter at den treffer hendene.
  const cx = CONTACT_X - st.s * K;
  const sx = 1 - squash / FOOTBALL.r;
  const sy = 1 + (0.5 * squash) / FOOTBALL.r;
  // Baksiden av ballen, der hendene holder (hendene står stille før ballen kommer).
  const rear = st.s > 0 ? cx - R * sx : CONTACT_X - R;
  const handX = CONTACT_X - R - pose.hands * K;
  // Hendene ligger bak på ballen: den nære litt under midten, den bortre over.
  const fest = {
    hoyreHand: { x: handX - 0.12 * R, y: BALL_Y + 0.3 * R },
    venstreHand: { x: handX + 0.05 * R, y: BALL_Y - 0.55 * R },
  };
  const stopX = CONTACT_X - r.stopDist * K;

  // Synlig utsnitt (smalere på mobil), så skilt og piler holder seg innenfor.
  const left = narrow ? NARROW.x : 0;
  const right = narrow ? NARROW.x + NARROW.w : BALL_W;
  // Kraftpila: én skala i hele figuren, valgt så den største mulige kraften (korteste støttid) får plass foran ballen.
  const Fbig = impact(m, v0, dtMinMs / 1000).Fmax;
  const kF = (right - 24 - (CONTACT_X - R)) / Fbig;
  const fLen = st.F * kF;
  // Fartspila over ballen: 5,5 px per m/s, så den ikke når fram til hodet.
  const vLen = st.v * 5.5;
  const vy = BALL_Y - R - 24;
  const dimY = BALL_Y + R + 58;

  const clipId = useSvgId('impuls-ball-utsnitt');
  return (
    <g>
      <clipPath id={clipId}>
        <rect x={left} y={0} width={right - left} height={BALL_H} />
      </clipPath>
      <g clipPath={`url(#${clipId})`}>
        <Bakgrunn />

        {/* Ballen, presset flat mot hendene, med fartsstreker bak når den er i fart */}
        {st.v > 0.3 && (
          <SpeedLines x={cx + R * sx} y={BALL_Y} length={Math.min(120, st.v * 7)} spread={R * 1.1} dir={-1} color={alpha(SCENE.outline, 0.7)} />
        )}
        <ContactShadow cx={cx} cy={GROUND_Y + 2} rx={R * 0.8} ry={3} opacity={0.35} />
        <g transform={`translate(${r2(cx)} ${r2(BALL_Y)}) scale(${r2(sx, 4)} ${r2(sy, 4)})`}>
          <Ball x={0} y={0} r={R} type="fotball" spinn={-st.s * 180} />
        </g>

        <Person
          x={KEEPER_X}
          y={GROUND_Y}
          size={SIZE}
          pose="staa"
          ledd={leddFor(pose.rygg)}
          fest={fest}
          jakke="gronn"
          bukse={PAINTS.svart}
          har="svart"
          hud="middels"
          sko="hvit"
        />

        {/* Der ballen treffer hendene og der den stopper (sentrum), og bremselengden s mellom */}
        <g stroke={VIZ.ink} strokeWidth={1.2 * ss} strokeDasharray="5 4" opacity={0.6}>
          <line x1={CONTACT_X} y1={BALL_Y + R * 0.4} x2={CONTACT_X} y2={dimY + 6} />
          <line x1={stopX} y1={BALL_Y + R * 0.4} x2={stopX} y2={dimY + 6} />
        </g>
        <Dimension x1={stopX} y1={dimY} x2={CONTACT_X} y2={dimY} />
        <DimLabel x={(stopX + CONTACT_X) / 2} y={dimY} text={`s = ${fmt(r.stopDist * 100, 1)} cm`} />

        {/* Fartspila over ballen, og kraften fra hendene på baksiden av ballen */}
        {st.v > 0.02 && (
          <>
            <ForceArrow x1={cx} y1={vy} x2={cx - vLen} y2={vy} color={VIZ.velocity} width={5.5} minLength={6} origin />
            <ValueTag x={cx + 14} y={vy} anchor="start" text={`v = ${fmt(st.v, 1)} m/s`} color={VIZ.velocity} size={0.85} />
          </>
        )}
        {showForces && st.F > 0.5 && (
          <>
            <ForceArrow x1={rear} y1={BALL_Y} x2={rear + fLen} y2={BALL_Y} color={VIZ.applied} origin minLength={6} />
            <ValueTag
              x={Math.max(rear + fLen, cx + R + 70)}
              y={BALL_Y + R + 20}
              anchor="end"
              text={`F = ${fmt(st.F, 0)} N`}
              color={VIZ.applied}
              size={0.85}
            />
          </>
        )}

        <ValueTag x={right - 14} y={28} anchor="end" text={spec.name} size={0.9} />
      </g>
    </g>
  );
}

/** Teksten til mållinja: et skilt midt under linja (over den står kraften), så det får plass også når s er kort. */
function DimLabel({ x, y, text }: { x: number; y: number; text: string }) {
  return <ValueTag x={x} y={y + 22} text={text} size={0.85} />;
}

const r2 = (v: number, d = 2) => Math.round(v * 10 ** d) / 10 ** d;

/* ---------- Bakgrunn: fotballbane med målstang og nett ---------- */

const Bakgrunn = memo(function Bakgrunn() {
  return (
    <g aria-hidden>
      <Himmel w={BALL_W} h={HORIZON + 4} sol={{ x: 690, y: 70 }} skyer={2} seed={5} />
      <Landskap x={0} y={HORIZON} w={BALL_W} h={110} type="by" seed={4} />
      <Underlag x1={0} x2={BALL_W} y={GROUND_Y} depth={BALL_H - GROUND_Y} type="gress" horisont={HORIZON} seed={6} />
      <Maalstang x={POST_X} y={GROUND_Y} />
    </g>
  );
});

/**
 * Den nære målstanga sett fra siden (hvit, 12 cm bred, går ut av bildet oppe) med sidenettet bak og en stang langs
 * bakken bakover. (x, y) er foten av stanga.
 */
function Maalstang({ x, y }: { x: number; y: number }) {
  const id = useSvgId('impuls-maal');
  const ss = useStrokeScale();
  const w = 0.12 * K;
  const white = tint(PAINTS.hvit, 0.1);
  const netColor = alpha(PAINTS.hvit, 0.75);
  // Sidenettet: et rutenett av tynne snorer (10 cm masker) fra stanga og bakover ut av bildet.
  const mesh = 0.12 * K;
  const lines: string[] = [];
  for (let gx = x - w / 2 - mesh; gx > -mesh; gx -= mesh) lines.push(`M${r2(gx)},0 L${r2(gx)},${y}`);
  for (let gy = y - mesh; gy > 0; gy -= mesh) lines.push(`M0,${r2(gy)} L${r2(x - w / 2)},${r2(gy)}`);
  return (
    <g>
      <LinearGradient
        id={id}
        x2={1}
        y2={0}
        stops={[
          [0, shade(white, 0.12)],
          [0.35, white],
          [0.6, tint(white, 0.3)],
          [1, shade(white, 0.22)],
        ]}
      />
      <path d={lines.join(' ')} stroke={netColor} strokeWidth={1 * ss} fill="none" />
      {/* Bunnstanga bak langs bakken */}
      <rect x={-4} y={y - 0.04 * K} width={x} height={0.04 * K} fill={shade(white, 0.15)} stroke={SCENE.outline} strokeWidth={0.6 * ss} />
      <ContactShadow cx={x} cy={y + 1} rx={w * 1.2} ry={3} />
      <rect x={x - w / 2} y={-4} width={w} height={y + 6} fill={`url(#${id})`} stroke={SCENE.outline} strokeWidth={0.9 * ss} />
    </g>
  );
}
