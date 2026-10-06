/**
 * Scenen i eksempeloppgaven «Golfball kastet rett opp fra en balkong» (k1-eks-kast-balkong): en boligblokk sett fra
 * gavlen, med kasteren på balkongen i øverste etasje, plenen under og ballen der den er i steget. Fysikken legges
 * oppå: fartspil og akselerasjonspil, nullnivået s = 0 ved hånda, positiv retning og mål for h₀, s_topp og H.
 *
 * Alt i scenen har ekte mål i meter med én skala `p` (figurenheter per meter), og høyden følger samme skala som
 * s-aksen i s-t-grafen ved siden av (på PC), så toppunktet og plenen ligger i samme høyde i scenen og i grafen.
 *
 * Egen gjenstand (bare denne scenen trenger den): `Leilighetsblokk` med balkonger og rekkverk med spiler, i samme stil
 * som scene-kit-et (toninger fra core.tsx, SCENE-farger, tynn kontur, lys fra øvre venstre, myk skygge).
 */
import { memo } from 'react';
import { Txt, TSub, VIZ, useTextScale } from '../../kit';
import {
  Ball,
  Callout,
  ContactShadow,
  Dimension,
  ForceArrow,
  Himmel,
  Landskap,
  Lauvtre,
  LinearGradient,
  PAINTS,
  Person,
  SCENE,
  Underlag,
  ValueTag,
  alpha,
  materialStops,
  mix,
  personPunkter,
  shade,
  tint,
  useSceneScale,
  useStrokeScale,
  useSvgId,
  type Leddvinkler,
  type PaintName,
} from '../../kit/scene';
import {
  BASE_HEIGHT,
  FLOOR_HEIGHT,
  HAND_OVER_FLOOR,
  buildingFloors,
  floorLevel,
  fmtSig,
  positionAt,
  roofLevel,
  timeAtPositionDown,
  velocityAt,
  type BalconyThrowSolution,
  type BalconyThrowTask,
} from './model-eks-kast-balkong';

/** Hva figuren viser i hvert steg (se EksKastBalkong.tsx). */
export type ThrowView =
  | 'oppgave'
  | 'retning'
  | 'topp'
  | 'hoyde'
  | 'likning'
  | 'losninger'
  | 'fart'
  | 'kontroll'
  | 'krefter'
  | 'simulering'
  | 'alle';

/** Mål på blokka (m). */
export const BLOKK = {
  /** Hvor langt balkongen stikker ut fra veggen. */
  balkong: 1.4,
  /** Tykkelsen på balkongplata. */
  plate: 0.22,
  /** Rekkverket over balkonggulvet. */
  rekkverk: 1.1,
  /** Avstanden mellom spilene i rekkverket (tegnes glissent nok til å synes). */
  spile: 0.2,
  /** Brystningen rundt det flate taket. */
  brystning: 0.45,
  /** Vinduene på gavlen. */
  vinduB: 1.1,
  vinduH: 1.4,
  /** Vinduspost over gulvet. */
  vinduOver: 0.9,
} as const;

/** Fra ytterkanten av balkongen til ballbanen (m): kasteren rekker armen litt ut over rekkverket. */
export const KLARING = 0.35;

/** Fargen på veggen: lys puss. */
const WALL = mix(SCENE.concrete, PAINTS.hvit, 0.5);
/** Vindusglass: blått i dagslys, tent (varmt) i skumringen (variabelen kommer fra scene-kit-et). */
const WINDOW_LIT = `var(--sc-bakgrunn-vindu, ${SCENE.glass})`;
/** Rammer, rekkverk og beslag: mørk grå metall. */
const FRAME = mix(PAINTS.svart, PAINTS.graa, 0.35);

const r2 = (v: number) => Math.round(v * 100) / 100;

/* ---------- Kasteren ---------- */

/**
 * Kasteren lener seg litt fram mot rekkverket med den nære armen strekt skrått opp og fram, så ballen slippes utenfor
 * rekkverket, og den andre hånda på håndlista. Hånda med ballen er HAND_OVER_FLOOR over gulvet: størrelsen på
 * personen regnes ut fra det (ca. 1,8 m).
 */
const THROW_POSE: Partial<Leddvinkler> = { rygg: 6, hoyreSkulder: 140, hoyreAlbue: 8, venstreSkulder: 34, venstreAlbue: 58 };
/** Grepet i den løftede hånda for en person med size = 100, relativt til ankerpunktet (x fram, y ned). */
const HAND_100 = personPunkter('armer-opp', 100, THROW_POSE).hoyreHand;

export const PERSONS: { jakke: PaintName; har: 'blond' | 'brun' | 'svart'; frisyre: 'kort' | 'lang' | 'hestehale'; hud?: 'lys' | 'middels' | 'mork' }[] = [
  { jakke: 'blaa', har: 'brun', frisyre: 'kort' },
  { jakke: 'rod', har: 'blond', frisyre: 'hestehale' },
  { jakke: 'gronn', har: 'svart', frisyre: 'kort', hud: 'middels' },
];

/* ---------- Geometri som scenen og grafen deler ---------- */

export interface SceneGeometry {
  /** Rammen rundt scenen. */
  x: number;
  y: number;
  w: number;
  h: number;
  /** Figurenheter per meter, og y for en posisjon s (m, positiv oppover fra hånda). */
  p: number;
  sy: (s: number) => number;
  /** Der ballen går opp og ned. */
  pathX: number;
}

/** Ballens radius i figuren. En golfball er 2,1 cm, så den tegnes mye større enn i virkeligheten. */
export function ballRadius(k: number): number {
  return 6.5 * k;
}

/** Tidspunktet scenen viser i hvert steg. */
export function viewTime(task: BalconyThrowTask, sol: BalconyThrowSolution, view: ThrowView): number {
  switch (view) {
    case 'oppgave':
    case 'retning':
      return 0;
    case 'topp':
    case 'hoyde':
    case 'alle':
      return sol.tTop;
    default:
      // Ballen er på plenen (eller akkurat i ferd med å treffe den).
      return timeAtPositionDown(task, -task.h0);
  }
}

/** Om ballen er nede på plenen i steget. */
export function atGround(view: ThrowView): boolean {
  return view !== 'oppgave' && view !== 'retning' && view !== 'topp' && view !== 'hoyde' && view !== 'alle';
}

/* ---------- Scenen ---------- */

export function ThrowScene({
  task,
  sol,
  view,
  geo,
  variant,
}: {
  task: BalconyThrowTask;
  sol: BalconyThrowSolution;
  view: ThrowView;
  geo: SceneGeometry;
  variant: number;
}) {
  const f = useTextScale();
  const k = useSceneScale();
  const ss = useStrokeScale();
  const clip = useSvgId('kb-scene');
  const { x: PL, y: PT, w: W, h: Hh, p, sy, pathX } = geo;
  const PR = PL + W;
  const PB = PT + Hh;
  const { h0, v0 } = task;

  const groundY = sy(-h0);
  const handY = sy(0);
  const floorY = sy(-HAND_OVER_FLOOR);
  const topY = sy(sol.sTop);
  // Plenen sett litt ovenfra: blokka står på en linje midt på plenen, og plenen fortsetter fram mot oss.
  const horizon = groundY - 24 * k;
  const frontY = PB - 8;
  const rBall = ballRadius(k);

  const railX = pathX - Math.max(KLARING * p, rBall + 3 * k);
  const wallX = railX - BLOKK.balkong * p;

  // Kasteren: hånda med ballen i (pathX, handY) ved t = 0.
  const size = (HAND_OVER_FLOOR * p * 100) / -HAND_100.y;
  const personX = pathX - (HAND_100.x * size) / 100;
  const look = PERSONS[variant % PERSONS.length]!;

  // Ballen ved tiden i steget. På plenen ligger den oppå gresset.
  const t = viewTime(task, sol, view);
  const landed = atGround(view);
  const sBall = landed ? -h0 + rBall / p : positionAt(task, t);
  const vBall = landed ? sol.vLand : velocityAt(task, t);
  const ballY = sy(sBall);
  const inHand = t === 0;

  // Hva som vises
  const all = view === 'alle';
  // Nullnivået vises også i oppgaven (uten etikett), så det er tydelig at h₀ er høyden til hånda, ikke til balkonggulvet.
  const showZero = true;
  const showZeroLabel = view !== 'oppgave';
  const showPlus = view === 'retning';
  const showV = view === 'oppgave' || view === 'retning' || view === 'fart' || view === 'kontroll';
  const showA = view === 'retning' || view === 'topp';
  const showTopDim = view === 'topp' || view === 'hoyde' || all;
  const showH = view === 'hoyde' || all;
  const showPath = view !== 'oppgave' && view !== 'retning';
  const showGround = view === 'likning' || view === 'losninger';
  const showGhostHand = !inHand;
  const showGhostTop = view === 'likning' || view === 'losninger' || view === 'fart' || view === 'kontroll' || view === 'krefter' || view === 'simulering';

  // Piler: fartspila i en egen kolonne til høyre for ballen, akselerasjonen til høyre for den. I toppunktet er v = 0, så
  // fartskolonnen er ledig: der står a-pila, fra ballen og nedover, til venstre for målet s_topp (ikke oppå etiketten).
  const vx = pathX + rBall + 16 * k;
  const aInVColumn = view === 'topp';
  const ax = aInVColumn ? vx : vx + 44 * k;
  const kv = 4.6 * k; // figurenheter per m/s
  const vLen = vBall * kv;
  const aLen = 42 * k;
  /** Midten av en loddrett pil ved ballen, flyttet så den holder seg over plenen og under toppen av scenen. */
  const mid = (len: number) => {
    const half = Math.abs(len) / 2;
    let c = ballY;
    if (c + half > groundY - 6) c = groundY - 6 - half;
    if (c - half < PT + 8) c = PT + 8 + half;
    return c;
  };
  const cv = mid(vLen);
  const ca = mid(aLen);
  const aY1 = aInVColumn ? ballY - 2 * k : ca - aLen / 2;
  const aY2 = aInVColumn ? ballY - 2 * k + aLen : ca + aLen / 2;

  // Målene: h₀ på gavlen, s_topp (tekst til høyre) og H (tekst til venstre) til høyre for banen. s_topp står så langt ut
  // at etiketten «a» til a-pila i fartskolonnen får plass mellom pila og mållinja.
  const dimTopX = pathX + rBall + 16 * k + 22 * f + 12 * k;
  const dimHX = pathX + 180 * k;

  // Etiketten til h₀ står på gavlen. Legg den i båndet mellom to vinduer (ved et etasjeskille nær midten), ikke oppå et vindu.
  const hLabelAt = nearestWallBand(task.floor, h0 / 2);
  const hLabelOffset = (hLabelAt - h0 / 2) * p;

  // «v = 0» over ballen i toppunktet (der er det bare himmel), eller til venstre når det ikke er plass over.
  const vZeroAbove = topY - rBall - 22 * f >= PT + 2;

  const vText = `v = ${fmtSig(vBall)} m/s`;
  const tagX = Math.min(PR - 6, vx + 12 * k);

  return (
    <g>
      <defs>
        <clipPath id={clip}>
          <rect x={PL} y={PT} width={W} height={Hh} rx={6} />
        </clipPath>
      </defs>
      <g clipPath={`url(#${clip})`}>
        <Himmel x={PL} y={PT} w={W} h={horizon - PT + 6} skyer={2} seed={7} sol={{ x: PR - 34 * k, y: PT + 30 * k, r: 13 * k }} />
        <Landskap x={PL} y={horizon} w={W} h={Math.min(46 * k, Math.max(20, (horizon - PT) * 0.22))} type="aaser" seed={5} />
        <Underlag x1={PL - 4} x2={PR + 4} y={frontY} depth={PB - frontY + 6} type="gress" horisont={horizon} seed={3} />
        <Busker x1={PR - 120 * k} x2={PR + 10} y={horizon + 3} k={k} />
        {PR - (pathX + 180 * k) > 40 * k && <Lauvtre x={PR - 6 * k} y={horizon + 9 * k} size={80 * k} seed={4} />}

        <Leilighetsblokk wallX={wallX} left={PL - 2} groundY={groundY} p={p} floor={task.floor} />

        {/* Banen ballen følger, og ballen i toppunktet som et svakt omriss */}
        {showPath && (
          <line x1={pathX} x2={pathX} y1={topY} y2={groundY - 1} stroke={VIZ.muted} strokeWidth={1.3 * ss} strokeDasharray={`${2 * ss} ${5 * ss}`} opacity={0.85} />
        )}
        {showGhostTop && <GhostBall x={pathX} y={topY} r={rBall} />}
        {showGhostHand && <GhostBall x={pathX} y={handY} r={rBall} />}

        {/* Kasteren og rekkverket foran henne/ham */}
        <Person
          x={personX}
          y={floorY}
          size={size}
          pose="armer-opp"
          ledd={THROW_POSE}
          jakke={look.jakke}
          har={look.har}
          frisyre={look.frisyre}
          hud={look.hud}
          bukse="svart"
          skygge={false}
          fest={{ venstreHand: { x: railX - 0.06 * p, y: floorY - BLOKK.rekkverk * p } }}
          title={task.name}
        />
        <Rekkverk wallX={wallX} floorY={floorY} p={p} />

        {/* Nullnivået ved hånda */}
        {showZero && (
          <g>
            <line x1={PL} x2={PR} y1={handY} y2={handY} stroke={VIZ.ink} strokeWidth={1.1 * ss} strokeDasharray={`${6 * ss} ${4 * ss}`} opacity={0.6} />
            {showZeroLabel && (
              <Txt x={PL + 8} y={handY - 7 * f} anchor="start" size={0.8} weight={700}>
                s = 0
              </Txt>
            )}
          </g>
        )}

        {/* Plenen er s = −h₀ */}
        {showGround && (
          <Txt x={PL + 8} y={groundY + 22 * f} anchor="start" size={0.8} weight={700}>
            plenen
          </Txt>
        )}

        {/* h₀ langs gavlen */}
        <Dimension
          x1={wallX - 30 * k}
          y1={groundY}
          x2={wallX - 30 * k}
          y2={handY}
          labelSize={0.85}
          labelOffset={hLabelOffset}
          label={
            <>
              h<TSub>0</TSub> = {fmtSig(h0)} m
            </>
          }
        />

        <Ball x={pathX} y={ballY} r={rBall} type="golf" spinn={t * 220} bakke={groundY} title="Golfball" />

        {/* Forflytningen fra hånda til plenen (b) */}
        {showGround && (
          <ForceArrow
            x1={dimTopX}
            y1={handY}
            x2={dimTopX}
            y2={groundY - 2}
            color={VIZ.series[0]}
            width={2.6}
            label={<>s = −{fmtSig(h0)} m</>}
            labelSize={0.85}
            labelY={(handY + groundY) / 2}
          />
        )}

        {/* Positiv retning: opp */}
        {showPlus && (
          <g>
            <ForceArrow x1={pathX + 110 * k} y1={handY + 30 * k} x2={pathX + 110 * k} y2={handY - 44 * k} color={VIZ.ink} width={2.6} label="+" labelSize={1.1} />
          </g>
        )}

        {showTopDim && (
          <Dimension
            x1={dimTopX}
            y1={topY}
            x2={dimTopX}
            y2={handY}
            labelSize={0.85}
            label={
              <>
                s<TSub>topp</TSub> = {fmtSig(sol.sTop)} m
              </>
            }
          />
        )}
        {showH && (
          <Dimension x1={dimHX} y1={groundY} x2={dimHX} y2={topY} labelSize={0.85} color={VIZ.series[0]} label={<>H = {fmtSig(sol.H)} m</>} />
        )}

        {/* Fart og akselerasjon */}
        {showV && Math.abs(vLen) > 3 && (
          <ForceArrow x1={vx} y1={cv + vLen / 2} x2={vx} y2={cv - vLen / 2} color={VIZ.velocity} width={6} label={inHand ? <>v<TSub>0</TSub></> : 'v'} />
        )}
        {(view === 'topp' || view === 'hoyde' || all) && (
          <Txt
            x={vZeroAbove ? pathX : pathX - rBall - 6 * k}
            y={vZeroAbove ? topY - rBall - 8 * f : topY + 5 * f}
            anchor={vZeroAbove ? 'middle' : 'end'}
            size={0.85}
            weight={750}
            color={VIZ.velocity}
          >
            v = 0
          </Txt>
        )}
        {showA && <ForceArrow x1={ax} y1={aY1} x2={ax} y2={aY2} color={VIZ.acceleration} width={5} label="a" />}
        {(view === 'fart' || view === 'kontroll') && (
          <ValueTag x={tagX} y={cv - Math.abs(vLen) / 2 - 18 * f} anchor="start" text={vText} color={VIZ.velocity} size={0.8} />
        )}
        {view === 'oppgave' && <ValueTag x={tagX} y={cv - Math.abs(vLen) / 2 - 18 * f} anchor="start" text={`v₀ = ${fmtSig(v0)} m/s`} color={VIZ.velocity} size={0.8} />}
        {(view === 'krefter' || view === 'simulering') && (
          <Callout x={pathX + rBall * 0.7} y={ballY - rBall * 0.7} lx={pathX + 36 * k} ly={ballY - 46 * k} anchor="start">
            L er størst her
          </Callout>
        )}
      </g>
      <rect x={PL} y={PT} width={W} height={Hh} rx={6} fill="none" stroke={VIZ.grid} strokeWidth={1} />
    </g>
  );
}

/**
 * Høyden over plenen (m) midt i det tomme båndet på gavlen mellom vinduene i to etasjer (ved et etasjeskille), nærmest
 * `target`. Vinduene går fra BLOKK.vinduOver til BLOKK.vinduOver + BLOKK.vinduH over hvert gulv.
 */
export function nearestWallBand(floor: number, target: number): number {
  const bands = buildingFloors(floor)
    .slice(1)
    .map((lvl) => lvl + BLOKK.vinduOver + (BLOKK.vinduH - FLOOR_HEIGHT) / 2);
  if (bands.length === 0) return target;
  return bands.reduce((best, b) => (Math.abs(b - target) < Math.abs(best - target) ? b : best));
}

/** Ballen et annet sted i banen: svakt, stiplet omriss. */
function GhostBall({ x, y, r }: { x: number; y: number; r: number }) {
  const ss = useStrokeScale();
  if (!Number.isFinite(y)) return null;
  return <circle cx={x} cy={y} r={r} fill="none" stroke={VIZ.muted} strokeWidth={1.2 * ss} strokeDasharray={`${2.5 * ss} ${2.5 * ss}`} opacity={0.8} />;
}

/* ---------- Leilighetsblokka ---------- */

interface BlokkProps {
  /** Veggen der balkongene sitter (x). Gavlen går mot venstre herfra. */
  wallX: number;
  /** Venstre kant av det som skal tegnes (gavlen klippes her). */
  left: number;
  groundY: number;
  /** Figurenheter per meter. */
  p: number;
  /** Kasterens etasje, som er den øverste. Rekkverket der tegnes for seg med <Rekkverk> etter personen. */
  floor: number;
}

/**
 * Leilighetsblokk sett fra gavlen: vegg i lys puss med vinduer i hver etasje, smale bånd ved etasjeskillene,
 * grunnmur, flatt tak med brystning og beslag, nedløpsrør på hjørnet og balkonger med rekkverk av stålspiler ut mot
 * høyre. Kasteren bor i øverste etasje. Ankerpunkt: (wallX, groundY) er hjørnet ved bakken.
 */
export const Leilighetsblokk = memo(function Leilighetsblokk({ wallX, left, groundY, p, floor }: BlokkProps) {
  const ss = useStrokeScale();
  const wallId = useSvgId('kb-vegg');
  const sideId = useSvgId('kb-side');
  const slabId = useSvgId('kb-plate');
  const baseId = useSvgId('kb-mur');
  const capId = useSvgId('kb-beslag');
  const Y = (m: number) => groundY - m * p;
  const L = Math.max(left, wallX - 14 * p);
  const w = wallX - L;
  if (!(w > 1) || !(p > 0)) return null;
  const floors = buildingFloors(floor);
  const roof = roofLevel(floor);
  const top = Y(roof + BLOKK.brystning);
  const detail = p >= 14;

  // Vinduer: én rad per etasje, i kolonner fra hjørnet og innover (3,0 m mellom). I skumringen lyser noen.
  const windows: { x: number; y: number; ww: number; wh: number; lit: boolean }[] = [];
  floors.forEach((lvl, i) => {
    for (let j = 0; j < 6; j++) {
      const cx = wallX - (1.7 + j * 3.0) * p;
      const ww = BLOKK.vinduB * p;
      if (cx - ww / 2 < L + 0.2 * p) break;
      windows.push({ x: cx - ww / 2, y: Y(lvl + BLOKK.vinduOver + BLOKK.vinduH), ww, wh: BLOKK.vinduH * p, lit: (i + j) % 2 === 0 });
    }
  });
  const slabT = Math.max(2, BLOKK.plate * p);
  const band = Math.max(1.2, 0.2 * p);
  const depth = BLOKK.balkong * p;
  const pipeX = wallX - 0.18 * p;
  const pipeW = Math.max(2, 0.11 * p);

  return (
    <g aria-hidden>
      <LinearGradient id={wallId} stops={materialStops(WALL, 0.55)} />
      {/* Lys fra venstre: veggen blir litt mørkere inn mot hjørnet */}
      <LinearGradient
        id={sideId}
        x2={1}
        y2={0}
        stops={[
          [0, SCENE.highlight, 0.22],
          [0.65, SCENE.highlight, 0],
          [1, SCENE.shadow, 0.3],
        ]}
      />
      <LinearGradient id={slabId} stops={materialStops(SCENE.concrete, 0.8)} />
      <LinearGradient id={baseId} stops={materialStops(SCENE.concreteDark, 0.6)} />
      <LinearGradient id={capId} stops={materialStops(FRAME, 0.7)} />

      <ContactShadow cx={L + w / 2} cy={groundY + 1} rx={w / 2 + 8} ry={Math.max(3, 0.28 * p)} opacity={0.7} />
      {/* Gavlveggen */}
      <rect x={L} y={top} width={w} height={Math.max(0, Y(BASE_HEIGHT) - top)} fill={`url(#${wallId})`} />
      {/* Etasjeskiller */}
      {floors.slice(1).map((lvl) => (
        <rect key={lvl} x={L} y={Y(lvl) - band / 2} width={w} height={band} fill={shade(WALL, 0.08)} opacity={0.8} />
      ))}
      {/* Grunnmur */}
      <rect x={L} y={Y(BASE_HEIGHT)} width={w} height={BASE_HEIGHT * p} fill={`url(#${baseId})`} />
      <rect x={L} y={top} width={w} height={groundY - top} fill={`url(#${sideId})`} stroke={SCENE.outline} strokeWidth={0.8 * ss} />

      {windows.map((win, i) => (
        <Vindu key={i} {...win} detail={detail} ss={ss} />
      ))}

      {/* Brystning med beslag på taket */}
      <rect
        x={L - 0.1 * p}
        y={top - Math.max(2, 0.16 * p)}
        width={w + 0.2 * p}
        height={Math.max(2, 0.16 * p)}
        rx={Math.min(1.5, 0.04 * p)}
        fill={`url(#${capId})`}
        stroke={SCENE.outline}
        strokeWidth={0.8 * ss}
      />
      {/* Nedløpsrør fra taket ned langs hjørnet */}
      <rect x={pipeX - pipeW / 2} y={top} width={pipeW} height={groundY - top - 0.15 * p} fill={tint(FRAME, 0.15)} stroke={SCENE.outline} strokeWidth={0.6 * ss} />
      <line x1={pipeX - pipeW * 0.15} x2={pipeX - pipeW * 0.15} y1={top + 2} y2={groundY - 0.2 * p} stroke={SCENE.highlight} strokeWidth={Math.max(0.6, pipeW * 0.25)} opacity={0.6} />
      {Array.from({ length: Math.max(0, Math.floor((groundY - top) / (2.4 * p))) }, (_, i) => (
        <rect key={i} x={pipeX - pipeW * 0.75} y={top + (1.2 + i * 2.4) * p} width={pipeW * 1.5} height={Math.max(1, 0.06 * p)} fill={FRAME} />
      ))}

      {/* Balkongene: plate i betong og rekkverk (det øverste tegnes etter kasteren) */}
      {floors.slice(1).map((lvl) => {
        const y = Y(lvl);
        const own = lvl === floorLevel(floor);
        return (
          <g key={lvl}>
            <ContactShadow cx={wallX + depth / 2} cy={y + slabT + 1.5} rx={depth / 2} ry={Math.max(1.5, 0.08 * p)} opacity={0.5} />
            <rect x={wallX - 0.5} y={y} width={depth + 0.5} height={slabT} fill={`url(#${slabId})`} stroke={SCENE.outline} strokeWidth={0.8 * ss} />
            {!own && <Rekkverk wallX={wallX} floorY={y} p={p} />}
          </g>
        );
      })}
    </g>
  );
});

/** Ett vindu med mørk karm, glass med refleks og en lys vinduspost under. */
function Vindu({ x, y, ww, wh, lit, detail, ss }: { x: number; y: number; ww: number; wh: number; lit: boolean; detail: boolean; ss: number }) {
  const frame = Math.max(0.9, ww * 0.075);
  const glass = lit ? WINDOW_LIT : SCENE.glass;
  if (!detail) return <rect x={x} y={y} width={ww} height={wh} fill={glass} stroke={SCENE.outline} strokeWidth={0.5 * ss} />;
  const gx = x + frame;
  const gy = y + frame;
  const gw = ww - 2 * frame;
  const gh = wh - 2 * frame;
  return (
    <g>
      <rect x={x} y={y} width={ww} height={wh} fill={FRAME} stroke={SCENE.outline} strokeWidth={0.6 * ss} />
      <rect x={gx} y={gy} width={gw} height={gh} fill={glass} />
      <path d={`M${r2(gx)},${r2(gy + gh * 0.5)} L${r2(gx + gw * 0.5)},${r2(gy)} L${r2(gx + gw * 0.78)},${r2(gy)} L${r2(gx)},${r2(gy + gh * 0.82)} Z`} fill={SCENE.highlight} opacity={0.42} />
      <line x1={gx} y1={gy + gh * 0.32} x2={gx + gw} y2={gy + gh * 0.32} stroke={FRAME} strokeWidth={frame * 0.7} />
      <rect x={x - frame * 0.7} y={y + wh} width={ww + frame * 1.4} height={Math.max(1, frame * 0.9)} fill={tint(SCENE.concrete, 0.2)} stroke={SCENE.outline} strokeWidth={0.5 * ss} />
    </g>
  );
}

/**
 * Rekkverk på en balkong sett fra siden: håndlist og bunnlist i stål med loddrette spiler, og en stolpe ytterst.
 * Tegnes etter personen som står på balkongen, så hun eller han synes mellom spilene. (wallX, floorY) er der
 * balkonggulvet møter veggen.
 */
export function Rekkverk({ wallX, floorY, p }: { wallX: number; floorY: number; p: number }) {
  const ss = useStrokeScale();
  const depth = BLOKK.balkong * p;
  const h = BLOKK.rekkverk * p;
  const rail = Math.max(1.6, 0.07 * p);
  const bar = Math.max(0.8, 0.025 * p);
  const x2 = wallX + depth;
  const n = Math.max(3, Math.round(BLOKK.balkong / BLOKK.spile));
  const bars = Array.from({ length: n - 1 }, (_, i) => wallX + ((i + 1) * depth) / n);
  return (
    <g aria-hidden>
      {bars.map((bx) => (
        <line key={bx} x1={bx} y1={floorY - 0.06 * p} x2={bx} y2={floorY - h} stroke={FRAME} strokeWidth={bar} />
      ))}
      {/* Bunnlist, stolpe og håndlist med glans */}
      <line x1={wallX} y1={floorY - 0.1 * p} x2={x2} y2={floorY - 0.1 * p} stroke={FRAME} strokeWidth={rail * 0.7} />
      <line x1={x2 - rail / 2} y1={floorY} x2={x2 - rail / 2} y2={floorY - h} stroke={SCENE.outline} strokeWidth={rail + 1 * ss} strokeLinecap="round" />
      <line x1={x2 - rail / 2} y1={floorY} x2={x2 - rail / 2} y2={floorY - h} stroke={FRAME} strokeWidth={rail} strokeLinecap="round" />
      <line x1={wallX} y1={floorY - h} x2={x2} y2={floorY - h} stroke={SCENE.outline} strokeWidth={rail + 1 * ss} strokeLinecap="round" />
      <line x1={wallX} y1={floorY - h} x2={x2} y2={floorY - h} stroke={FRAME} strokeWidth={rail} strokeLinecap="round" />
      <line x1={wallX} y1={floorY - h - rail * 0.22} x2={x2} y2={floorY - h - rail * 0.22} stroke={SCENE.metalLight} strokeWidth={rail * 0.3} strokeLinecap="round" opacity={0.6} />
    </g>
  );
}

/** Lav hekk langs plenen i bakgrunnen (runde busker i to toner). */
function Busker({ x1, x2, y, k }: { x1: number; x2: number; y: number; k: number }) {
  const id = useSvgId('kb-busk');
  const ss = useStrokeScale();
  const r = 9 * k;
  const n = Math.max(2, Math.floor((x2 - x1) / (1.5 * r)));
  let d = '';
  for (let i = 0; i < n; i++) {
    const cx = x1 + (i + 0.5) * ((x2 - x1) / n);
    const rr = r * (0.85 + 0.3 * (((i * 37) % 10) / 10));
    d += `M${r2(cx - rr)},${r2(y)} A${r2(rr)},${r2(rr)} 0 0 1 ${r2(cx + rr)},${r2(y)} Z`;
  }
  return (
    <g aria-hidden>
      <LinearGradient id={id} stops={materialStops(SCENE.foliage, 0.9)} />
      <path d={d} fill={`url(#${id})`} stroke={alpha(SCENE.foliageDark, 0.9)} strokeWidth={0.7 * ss} />
    </g>
  );
}

