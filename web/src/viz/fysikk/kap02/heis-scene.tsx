/**
 * Scenen til «Vekt i heis» (2E): heissjakta i en boligblokk i snitt. Kameraet følger heisstolen, så sjaktveggen,
 * etasjene og vinduene i trapperommet glir forbi når heisen kjører. Inne står en person på en badevekt. Alle lengder
 * i én skala (PX_PER_M), kreftene i én skala (G-pila har fast lengde, så px/N følger massen), fart og akselerasjon i
 * hver sin skala som følger turen. Til venstre et lite kart over hele blokka.
 */
import { useMemo } from 'react';
import { Figure, Txt, VIZ, fmt, useTextScale } from '../../kit';
import { Badevekt, ForceArrow, Heis, Person, SCENE, ValueTag, personPunkter, useStrokeScale } from '../../kit/scene';
import { LIFT_CAR } from './model-heis';
import { Bygningssnitt, Byggkart, Etasjeviser, Fanger, Taklys, Vaierbrudd, VektLupe, type SnittGeometri } from './heis-deler';
import { useNarrow } from './useNarrow';

const W = 800;
const H = 460;
/** Piksler per meter for alle lengder i scenen (person 1,75 m, heisstol 1,1 m × 2,2 m). */
const PX_PER_M = 135;
/** Gulvet i heisen (forkanten) og i etasjen heisen står ved. */
const FLOOR_Y = 418;
const CX = 292;
const CAR_W = LIFT_CAR.width * PX_PER_M;
const CAR_H = LIFT_CAR.height * PX_PER_M;
/** Kit-heisen: gulvet er en trapes i perspektiv, og (x, y) er midt på det. */
const CAR_E = CAR_W * 0.08;
const CAR_T = CAR_W * 0.05;
const CAR_Y = FLOOR_Y - CAR_E / 2;
const CAR_CEIL = FLOOR_Y - CAR_H;
const CAR_TOP = CAR_CEIL - 2.4 * CAR_T;
/** Badevekta (36 cm) og personen (1,75 m). */
const SCALE_W = 0.36 * PX_PER_M;
const SCALE_TOP = CAR_Y - 0.16 * SCALE_W;
const PERSON = 1.75 * PX_PER_M;
/** Lengden på G-pila (piksler). N tegnes i samme skala. */
const G_LEN = 92;
/** Lengden på fart- og akselerasjonspila når de er størst på turen. */
const MOTION_LEN = 100;

const SNITT: SnittGeometri = {
  px: PX_PER_M,
  left: -20,
  right: W + 20,
  shaftL: CX - 118,
  shaftR: CX + 118,
  wall: 27,
  cx: CX,
  railDx: CAR_W / 2 + CAR_T + 11,
  windowL: 680,
  windowR: 782,
  signX: 486,
};

/** Høyre del av figuren (trapperommet): fart og akselerasjon, status og den forstørrede vekta. */
const INFO = { vX: 562, aX: 624, arrowY: 238, statusX: 618, statusY: 32, lupe: { x: 698, y: 392, w: 172, h: 84 } };
const MAP = { x: 10, y: 10, w: 124, h: H - 20 };
/** På mobil: bare sjakta og en smal stripe av trapperommet. */
const NARROW_X = SNITT.shaftL - SNITT.wall - 6;
const NARROW_W = 500;
const INFO_NARROW = { vX: 538, aX: 604, arrowY: 238, statusX: NARROW_X + NARROW_W / 2, statusY: 28, lupe: { x: 548, y: 392, w: 172, h: 84 } };

export interface HeisSceneProps {
  /** Høyden til heisgulvet over 1. etasje (m). */
  h: number;
  hStart: number;
  hEnd: number;
  /** Etasjen heisen er nærmest (til etasjeviseren), og teksten for hvor heisen er («9. etasje», «1.–2. etasje»). */
  floor: number;
  floorText: string;
  /** Fart og akselerasjon (positiv oppover) og de største verdiene på turen (til skalaene). */
  v: number;
  a: number;
  vMax: number;
  aMax: number;
  G: number;
  N: number;
  reading: number;
  status: string;
  showForces: boolean;
  /** Vaierne har røket, nødbremsen griper nå, eller den har grepet. */
  broken: boolean;
  braking: boolean;
  braked: boolean;
  label: string;
}

export function HeisScene(props: HeisSceneProps) {
  const [ref, narrow] = useNarrow<HTMLDivElement>();
  // På mobil: bare sjakta og trapperommet (kartet blir for lite), så heisen og pilene blir store nok.
  const vb = narrow ? `${NARROW_X} 0 ${NARROW_W} ${H}` : `0 0 ${W} ${H}`;
  return (
    <div ref={ref}>
      <Figure viewBox={vb} label={props.label} maxHeight={480}>
        <SceneContent {...props} narrow={narrow} />
      </Figure>
    </div>
  );
}

function SceneContent({
  h,
  hStart,
  hEnd,
  floor,
  floorText,
  v,
  a,
  vMax,
  aMax,
  G,
  N,
  reading,
  status,
  showForces,
  broken,
  braking,
  braked,
  narrow,
}: HeisSceneProps & { narrow: boolean }) {
  const f = useTextScale();
  const ss = useStrokeScale();
  const pp = useMemo(() => personPunkter('staa', PERSON, undefined, { x: CX, y: SCALE_TOP }), []);
  const k = G > 0 ? G_LEN / G : 0;
  const nLen = N * k;
  const dir: -1 | 0 | 1 = Math.abs(v) < 1e-6 ? 0 : v > 0 ? 1 : -1;
  const cables = [-0.45, 0, 0.45].map((u) => CX + u * CAR_T);
  const readingText = `${fmt(reading, 1)} kg`;
  const info = narrow ? INFO_NARROW : INFO;
  const lupe = info.lupe;
  // Displayet på badevekta (mål fra Badevekt i scene-kit-et)
  const disp = { x: CX, y: CAR_Y + (-0.14 * SCALE_W - 0.02 * SCALE_W) / 2, w: SCALE_W * 0.46, h: SCALE_W * 0.085 };

  return (
    <g>
      {/* Blokka i snitt: flyttes så etasjen h står ved heisgulvet */}
      <g transform={`translate(0 ${Math.round((FLOOR_Y + h * PX_PER_M) * 100) / 100})`}>
        <Bygningssnitt g={SNITT} />
      </g>

      {/* Vaierne opp til drivmaskinen, eller stumpene når de har røket */}
      {broken &&
        cables.map((x) => (
          <g key={x}>
            <line x1={x} y1={CAR_TOP - 22} x2={x} y2={CAR_TOP} stroke={SCENE.outline} strokeWidth={2.6 * ss} strokeLinecap="round" />
            <line x1={x} y1={CAR_TOP - 22} x2={x} y2={CAR_TOP} stroke={SCENE.metal} strokeWidth={1.4 * ss} strokeLinecap="round" />
            <Vaierbrudd x={x} y={CAR_TOP - 22} />
          </g>
        ))}

      {/* Føringssko oppe og fangeren (nødbremsen) nede ved hver skinne */}
      {[-1, 1].map((side) => (
        <rect
          key={side}
          x={CX + side * SNITT.railDx - 9}
          y={CAR_CEIL - CAR_T - 2}
          width={18}
          height={11}
          rx={2}
          fill={SCENE.metalDark}
          stroke={SCENE.outline}
          strokeWidth={0.8 * ss}
        />
      ))}
      {([-1, 1] as const).map((side) => (
        <Fanger key={side} x={CX + side * SNITT.railDx} y={FLOOR_Y + 1.1 * CAR_T - 5} side={side} active={braking} engaged={braked} seed={side + 2} />
      ))}

      <Heis x={CX} y={CAR_Y} w={CAR_W} h={CAR_H} tau={!broken} tauTopp={-10} title="Heisstol i snitt med en person på en badevekt">
        <Taklys x={CX} y={CAR_CEIL + CAR_E} w={CAR_W - 2 * CAR_E} h={CAR_H * 0.55} />
        <Etasjeviser x={CX - 42} y={CAR_CEIL + CAR_E + 17} floor={floor} dir={dir} />
        <Badevekt x={CX} y={CAR_Y} w={SCALE_W} visning={readingText} />
        <Person x={CX} y={SCALE_TOP} size={PERSON} jakke="gronn" har="brun" />
      </Heis>

      {/* Kreftene på personen: G fra tyngdepunktet, N fra vekta opp i fotsålene */}
      {showForces && (
        <g>
          <ForceArrow
            x1={pp.tyngdepunkt.x}
            y1={pp.tyngdepunkt.y}
            x2={pp.tyngdepunkt.x}
            y2={pp.tyngdepunkt.y + G_LEN}
            color={VIZ.gravity}
            label="G"
            labelAnchor="end"
            labelX={pp.tyngdepunkt.x - 12}
            labelY={pp.tyngdepunkt.y + G_LEN - 4}
            origin
          />
          {nLen > 3 ? (
            <ForceArrow x1={CX + 24} y1={SCALE_TOP} x2={CX + 24} y2={SCALE_TOP - nLen} color={VIZ.normal} label="N" labelX={CX + 36} labelY={SCALE_TOP - nLen + 16 * f} />
          ) : (
            <ValueTag x={CX + 30} y={SCALE_TOP - 56 * f} text="N = 0" color={VIZ.normal} anchor="start" size={0.8} />
          )}
        </g>
      )}

      {/* Status, fart og akselerasjon i trapperommet ved siden av sjakta */}
      <ValueTag x={info.statusX} y={info.statusY} text={status} size={0.92} />
      {narrow && <ValueTag x={info.statusX} y={info.statusY + 34 * f} text={`${floorText}, h = ${fmt(h, 1)} m`} size={0.8} />}
      <MotionArrow x={info.vX} y={info.arrowY} len={vMax > 0 ? (v / vMax) * MOTION_LEN : 0} color={VIZ.velocity} name="v" />
      <MotionArrow x={info.aX} y={info.arrowY} len={aMax > 0 ? (a / aMax) * MOTION_LEN : 0} color={VIZ.acceleration} name="a" />

      <VektLupe x={lupe.x} y={lupe.y} w={lupe.w} h={lupe.h} text={readingText} caption="Vekta viser" sx={disp.x} sy={disp.y} sw={disp.w} sh={disp.h} />

      {!narrow && (
        <Byggkart x={MAP.x} y={MAP.y} w={MAP.w} h={MAP.h} hNow={h} hStart={hStart} hEnd={hEnd} title={floorText} footer={`h = ${fmt(h, 1)} m`} broken={broken} />
      )}
    </g>
  );
}

/** Loddrett pil for fart eller akselerasjon. `len` er i piksler, positiv oppover. */
function MotionArrow({ x, y, len, color, name }: { x: number; y: number; len: number; color: string; name: string }) {
  const f = useTextScale();
  const ss = useStrokeScale();
  if (Math.abs(len) < 4)
    return (
      <g>
        <circle cx={x} cy={y} r={4.5 * ss} fill={color} stroke={VIZ.surface} strokeWidth={1.6 * ss} />
        <Txt x={x} y={y - 14 * f} size={0.85} color={color} weight={700}>
          {name} = 0
        </Txt>
      </g>
    );
  return (
    <ForceArrow
      x1={x}
      y1={y}
      x2={x}
      y2={y - len}
      color={color}
      width={6}
      label={name}
      labelX={x + 11 * f}
      labelY={len > 0 ? y - len + 14 * f : y - len - 2}
    />
  );
}

