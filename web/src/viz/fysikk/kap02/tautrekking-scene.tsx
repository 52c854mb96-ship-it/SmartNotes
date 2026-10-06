/**
 * Scenen til tautrekkingen (2D): to lag med to personer hver drar i et tau. Lag A står til venstre, lag B til høyre,
 * og hvert lag står på sitt underlag (delt ved midtstreken). Kreftene langs bakken legges oppå: S fra tauet på lagene
 * (og S′ fra lagene på tauet), R fra bakken på lagene (og R′ fra lagene på bakken), og akselerasjonen når noen glir.
 *
 * Én fast skala for lengder (PX_PER_M) og én for krefter (k px/N). Kraftskalaen velges ut fra de største kreftene
 * under hele dragkampen med disse lagene (tugPeaks), så pilene alltid får plass, men den er den samme for alle kreftene.
 */
import { memo } from 'react';
import { TSub, Txt, VIZ, fmt, useTextScale } from '../../kit';
import {
  ForceArrow,
  Himmel,
  Landskap,
  Person,
  PAINTS,
  Rom,
  SCENE,
  Tau,
  ValueTag,
  alpha,
  mix,
  personPunkter,
  shade,
  tint,
  useStrokeScale,
  type PaintName,
  type PersonPose,
  Underlag,
} from '../../kit/scene';
import { leanAngle, type Feste, type TugPlan, type TugState } from './model-tautrekking';
import { G_EARTH } from '../../kit/format';

export type TugView = 'lag' | 'par' | 'system';

export const W = 800;
/** Bakken der lagene står, og horisonten (eller foten av veggen inne). */
export const GROUND = 330;
const HORIZON = 246;
/** Nederste kant av figuren: forsiden av underlaget har plass til to rader med piler (R og R′). */
export const H = 432;
/** Midtstreken. */
const CX = 400;
/** Piksler per meter. En person på 1,75 m blir 140 høy. */
export const PX_PER_M = 80;
/** Den fremste foten til den fremste personen står så langt fra midtstreken (m). */
const FRONT_FOOT_M = 1.15;
/** Avstanden mellom de to personene på et lag (m). */
const SPACING_M = 1.05;
/** Hvor langt taperlaget dras før det er over streken (m): den fremste foten når nesten streken. */
export const S_END = 1.0;
/** Akselerasjonspila: piksler per m/s². */
const PX_PER_A = 70;

/** Høyden (m) til en person på et lag med samlet masse m (to personer): skalert som massen opphøyd i 1/3. */
export function personHeight(mTeam: number): number {
  const mp = Math.max(1, mTeam) / 2;
  return Math.min(1.95, Math.max(1.4, 1.75 * Math.cbrt(mp / 70)));
}

/** Ryggvinkelen (grader, negativ = bakover) for en person som drar med S når laget veier G. */
function rygg(S: number, G: number): number {
  return -10 - 0.8 * leanAngle(S, G);
}

interface TeamLook {
  jakke: PaintName;
  har: 'blond' | 'brun' | 'svart' | 'rod' | 'graa';
  hud?: 'lys' | 'middels' | 'mork';
  frisyre?: 'kort' | 'lang' | 'hestehale';
}

const LOOK: Record<'A' | 'B', [TeamLook, TeamLook]> = {
  // [fremst, bakerst]
  A: [
    { jakke: 'blaa', har: 'brun' },
    { jakke: 'blaa', har: 'blond', frisyre: 'hestehale' },
  ],
  B: [
    { jakke: 'rod', har: 'svart', hud: 'mork' },
    { jakke: 'rod', har: 'rod', frisyre: 'lang' },
  ],
};

const GROUND_TYPE: Record<Feste, 'gress' | 'tregulv' | 'is'> = { gress: 'gress', sokker: 'tregulv', is: 'is' };

interface Pt {
  x: number;
  y: number;
}

interface PersonLayout {
  /** Ankerpunktet i 'dra' (midt mellom føttene). */
  x: number;
  size: number;
  flip: boolean;
  ledd: { rygg: number };
  pts: ReturnType<typeof personPunkter>;
}

interface TeamLayout {
  front: PersonLayout;
  rear: PersonLayout;
  /** Grepet til den fremste personen (der S angriper) og den fremste foten (der R tegnes fra). */
  grip: Pt;
  lead: Pt;
  /** Bakerste fot (for systemgrensen) og toppen av hodene. */
  backX: number;
  headTop: number;
  /** Midten av laget (for etiketten). */
  cx: number;
  /** Tauet gjennom hendene, fra midten og utover. */
  rope: [number, number][];
}

/** Hvor personene på et lag står, med forflytningen `shift` (px, positiv mot høyre) og lene etter S. */
function teamLayout(side: 'A' | 'B', mTeam: number, S: number, shift: number): TeamLayout {
  const s = personHeight(mTeam) * PX_PER_M;
  const dir = side === 'A' ? -1 : 1;
  const flip = side === 'B';
  const ledd = { rygg: rygg(S, mTeam * G_EARTH) };
  // Den fremste foten står fast (lenet flytter hofta, ikke føttene): finn ankerpunktet ut fra den.
  const rel = personPunkter('dra', s, ledd, { x: 0, y: 0 });
  const leadOffset = Math.max(rel.venstreFot.x, rel.hoyreFot.x);
  const frontX = CX + dir * (FRONT_FOOT_M * PX_PER_M + leadOffset) + shift;
  const rearX = frontX + dir * SPACING_M * PX_PER_M;
  const mk = (x: number): PersonLayout => ({ x, size: s, flip, ledd, pts: personPunkter('dra', s, ledd, { x, y: GROUND, flip }) });
  const front = mk(frontX);
  const rear = mk(rearX);
  const near = (p: PersonLayout) => p.pts.hoyreHand;
  const far = (p: PersonLayout) => p.pts.venstreHand;
  const leadX = frontX - dir * leadOffset;
  const rope: [number, number][] = [
    [near(front).x, near(front).y],
    [far(front).x, far(front).y],
    [near(rear).x, near(rear).y],
    [far(rear).x, far(rear).y],
  ];
  // Enden av tauet henger ned bak den bakerste og ligger på bakken.
  const e = far(rear);
  const drop = GROUND - 3 - e.y;
  const tail: [number, number][] = [
    [e.x + dir * 0.16 * PX_PER_M, e.y + drop * 0.08],
    [e.x + dir * 0.3 * PX_PER_M, e.y + drop * 0.32],
    [e.x + dir * 0.4 * PX_PER_M, e.y + drop * 0.7],
    [e.x + dir * 0.5 * PX_PER_M, GROUND - 3],
    [e.x + dir * 0.95 * PX_PER_M, GROUND - 2.5],
  ];
  const heads = [front, rear].map((p) => p.pts.hode.y - 0.075 * s);
  const backs = [rear.pts.venstreFot.x, rear.pts.hoyreFot.x, rear.pts.hode.x];
  return {
    front,
    rear,
    grip: near(front),
    lead: { x: leadX, y: GROUND },
    backX: dir < 0 ? Math.min(...backs) : Math.max(...backs),
    headTop: Math.min(...heads),
    cx: (frontX + rearX) / 2,
    rope: [...rope, ...tail],
  };
}

/** Geometrien i ro (ingen forflytning, ingen lening): brukes til å velge kraftskalaen. */
export function restGeometry(mA: number, mB: number) {
  const a = teamLayout('A', mA, 0, 0);
  const b = teamLayout('B', mB, 0, 0);
  return { gripGap: b.grip.x - a.grip.x, leadGap: b.lead.x - a.lead.x, leadA: a.lead.x, leadB: b.lead.x };
}

/* ---------- Bakgrunn ---------- */

/** Himmel og landskap (ute) eller et rom (inne, når begge lagene står i sokker på gulvet). Endres ikke under avspillingen. */
const Backdrop = memo(function Backdrop({ indoor, top, x0, x1 }: { indoor: boolean; top: number; x0: number; x1: number }) {
  if (indoor) return <Rom x={x0} y={top} w={x1 - x0} h={H - top} gulvY={HORIZON} gulv="tre" vindu vinduX={x0 + (x1 - x0) * 0.5} />;
  return (
    <>
      <Himmel x={x0} y={top} w={x1 - x0} h={HORIZON - top + 2} sol={{ x: 690, y: top + 62, r: 22 }} skyer={2} seed={5} />
      <Landskap x={x0} y={HORIZON} w={x1 - x0} h={120} type="skog" seed={2} />
    </>
  );
});

/** Underlaget: ett for hvert lag, delt ved midtstreken (ett helt når lagene står på det samme). */
const Grounds = memo(function Grounds({ a, b, indoor, x0, x1 }: { a: Feste; b: Feste; indoor: boolean; x0: number; x1: number }) {
  if (indoor) return null;
  const depth = H - GROUND;
  if (a === b) return <Underlag x1={x0} x2={x1} y={GROUND} depth={depth} type={GROUND_TYPE[a]} horisont={HORIZON} seed={3} />;
  return (
    <>
      <Underlag x1={x0} x2={CX} y={GROUND} depth={depth} type={GROUND_TYPE[a]} horisont={HORIZON} seed={3} />
      <Underlag x1={CX} x2={x1} y={GROUND} depth={depth} type={GROUND_TYPE[b]} horisont={HORIZON} seed={4} />
    </>
  );
});

/**
 * Midtstreken: en malt strek over underlaget, smal bak og bredere foran (perspektiv), som dekker skjøten mellom to
 * underlag.
 */
function Midtstrek({ indoor }: { indoor: boolean }) {
  const ss = useStrokeScale();
  const back = indoor ? HORIZON + 14 : GROUND - 34;
  const front = GROUND + 7;
  const paint = mix(PAINTS.hvit, indoor ? SCENE.floor : SCENE.snow, 0.15);
  return (
    <g aria-hidden>
      <path
        d={`M${CX - 1.6},${back} L${CX + 1.6},${back} L${CX + 3.6},${front} L${CX - 3.6},${front} Z`}
        fill={paint}
        stroke={alpha(SCENE.outline, 0.45)}
        strokeWidth={0.7 * ss}
      />
    </g>
  );
}

/** Rødt merke midt på tauet (knyttet bånd med to korte ender). */
function Tauband({ x, y }: { x: number; y: number }) {
  const ss = useStrokeScale();
  const red = PAINTS.rod;
  return (
    <g aria-hidden>
      <path
        d={`M${x - 2},${y + 2} q-3,9 -7,15 l4,1 q3,-6 5,-14 Z M${x + 2},${y + 2} q2,9 7,14 l3,-2 q-4,-5 -6,-13 Z`}
        fill={shade(red, 0.12)}
        stroke={SCENE.outline}
        strokeWidth={0.7 * ss}
        strokeLinejoin="round"
      />
      <rect x={x - 4} y={y - 5.5} width={8} height={11} rx={2} fill={red} stroke={SCENE.outline} strokeWidth={0.8 * ss} />
      <rect x={x - 2.6} y={y - 4.5} width={2} height={9} rx={1} fill={tint(red, 0.35)} opacity={0.8} />
    </g>
  );
}

/** Sklispor etter føttene som glir: fra der foten sto til der den er nå. */
function Sklispor({ x0, x1, feste }: { x0: number; x1: number; feste: Feste }) {
  const ss = useStrokeScale();
  if (!(Math.abs(x1 - x0) > 2)) return null;
  const color = feste === 'is' ? tint(SCENE.iceShine, 0.4) : feste === 'gress' ? SCENE.soil : shade(SCENE.wood, 0.15);
  const op = feste === 'sokker' ? 0.35 : 0.75;
  return (
    <g aria-hidden opacity={op}>
      <line x1={x0} x2={x1} y1={GROUND + 1.5} y2={GROUND + 1.5} stroke={color} strokeWidth={2.6 * ss} strokeLinecap="round" />
      <line x1={x0} x2={x1} y1={GROUND - 2.5} y2={GROUND - 2.5} stroke={color} strokeWidth={1.4 * ss} strokeLinecap="round" opacity={0.7} />
    </g>
  );
}

/* ---------- Scenen ---------- */

export interface TugSceneProps {
  mA: number;
  mB: number;
  festeA: Feste;
  festeB: Feste;
  plan: TugPlan;
  state: TugState;
  view: TugView;
  /** Kraftskala (px/N). */
  k: number;
  /** Utsnittet (viewBox). */
  box: { x: number; y: number; w: number; h: number };
  narrow: boolean;
}

export function TugScene({ mA, mB, festeA, festeB, plan, state, view, k, box, narrow }: TugSceneProps) {
  const f = useTextScale();
  const ss = useStrokeScale();
  const indoor = festeA === 'sokker' && festeB === 'sokker';
  const shift = state.x * PX_PER_M;
  const A = teamLayout('A', mA, state.S, shift);
  const B = teamLayout('B', mB, state.S, shift);
  const rest = { A: teamLayout('A', mA, state.S, 0), B: teamLayout('B', mB, state.S, 0) };
  const ropeY = (A.grip.y + B.grip.y) / 2;
  const moving = state.phase === 'glir' || state.phase === 'ferdig';
  const winner = plan.winner;
  const travel = Math.abs(shift);

  const x0 = box.x - 2;
  const x1 = box.x + box.w + 2;

  // Personene: taperlaget glir i 'dra', vinnerlaget går baklengs (føttene står fast i hvert steg).
  const persons = (side: 'A' | 'B', T: TeamLayout, feste: Feste) => {
    const walking = moving && winner === side;
    return ([T.front, T.rear] as const).map((p, i) => {
      const look = LOOK[side][i]!;
      const extra = { lue: feste === 'is' ? (side === 'A' ? 'gul' : 'hvit') : undefined, sko: feste === 'sokker' ? 'hvit' : 'svart' };
      if (walking) {
        const pose: PersonPose = 'gaa';
        const fase = (((0.04 - travel / (0.8 * p.size)) % 1) + 1) % 1;
        return (
          <Person
            key={i}
            x={p.pts.hofte.x}
            y={GROUND}
            size={p.size}
            pose={pose}
            fase={fase}
            flip={p.flip}
            ledd={{ rygg: p.ledd.rygg + 4 }}
            fest={{ hoyreHand: p.pts.hoyreHand, venstreHand: p.pts.venstreHand }}
            {...look}
            {...extra}
          />
        );
      }
      return <Person key={i} x={p.x} y={GROUND} size={p.size} pose="dra" flip={p.flip} ledd={p.ledd} {...look} {...extra} />;
    });
  };

  // Tauet fra enden bak lag A, gjennom hendene, til enden bak lag B.
  const rope: [number, number][] = [...[...A.rope].reverse(), ...B.rope];
  const ribbonX = CX + shift;
  const ribbonY = A.grip.y + ((B.grip.y - A.grip.y) * (ribbonX - A.grip.x)) / Math.max(1, B.grip.x - A.grip.x);

  // Kreftene
  const S = state.S * k;
  const sY = ropeY - 15 * ss;
  const s2Y = ropeY + 15 * ss;
  const rY = GROUND + 18;
  const r2Y = GROUND + 50 + 6 * (f - 1);
  const showPairs = view === 'par';
  const internal = view === 'system';
  const slide = (side: 'A' | 'B') => (side === 'A' ? state.slidingA : state.slidingB);

  // Etikettene til S står over pila, ved halen (grepet), så de to S-ene ikke møtes på midten.
  const sLabel = (T: TeamLayout, dir: number, prime: boolean) => (
    <Txt x={T.grip.x + dir * 12 * f} y={prime ? s2Y + 22 * f : sY - 9 * f} anchor={dir > 0 ? 'start' : 'end'} color={VIZ.tension} weight={740}>
      {prime ? 'S′' : 'S'}
    </Txt>
  );
  const rLabel = (side: 'A' | 'B', prime: boolean) => (
    <>
      R{prime ? '′' : ''}
      <TSub>{side}</TSub>
    </>
  );

  // Systemgrenser
  const pad = 10;
  const boxFor = (T: TeamLayout, side: 'A' | 'B') => {
    const outer = side === 'A' ? Math.min(T.backX, T.rope[T.rope.length - 1]![0]) - pad : Math.max(T.backX, T.rope[T.rope.length - 1]![0]) + pad;
    const inner = T.grip.x + (side === 'A' ? 1 : -1) * 16;
    return { x: Math.min(outer, inner), w: Math.abs(inner - outer), y: T.headTop - pad, h: GROUND + 7 - (T.headTop - pad) };
  };
  const bA = boxFor(A, 'A');
  const bB = boxFor(B, 'B');
  const bSys = { x: bA.x, y: Math.min(bA.y, bB.y), w: bB.x + bB.w - bA.x, h: GROUND + 7 - Math.min(bA.y, bB.y) };

  const status =
    state.phase === 'klar'
      ? 'Lagene står klare'
      : state.phase === 'drar'
        ? 'Ingen glir: ΣF = 0 på begge lag'
        : state.phase === 'uavgjort'
          ? 'Uavgjort: ingen glir'
          : state.phase === 'glir'
            ? `Lag ${plan.loser} glir mot midten`
            : `Lag ${plan.winner} vant`;

  // Akselerasjonspila over midten av tauet
  const aLen = Math.min(150, Math.abs(state.a) * PX_PER_A);
  const aDir = Math.sign(state.a);
  const aY = box.y + (narrow ? 104 : 74) * Math.max(1, f * 0.85);

  const teamLabel = (T: TeamLayout, side: 'A' | 'B', m: number, feste: Feste, mu: number) => {
    const y2 = T.headTop - 14;
    const y1 = y2 - 19 * f;
    return (
      <g>
        <Txt x={T.cx} y={y1} size={0.92} weight={740}>
          Lag {side} · {fmt(m, 0)} kg
        </Txt>
        <Txt x={T.cx} y={y2} size={0.8} muted weight={600}>
          {narrow ? '' : `${feste === 'gress' ? 'Gress' : feste === 'is' ? 'Is' : 'Sokker'} · `}μ<TSub>s</TSub> = {fmt(mu, 2)}
        </Txt>
      </g>
    );
  };

  return (
    <g>
      <Backdrop indoor={indoor} top={box.y - 2} x0={x0} x1={x1} />
      <Grounds a={festeA} b={festeB} indoor={indoor} x0={x0} x1={x1} />
      <Midtstrek indoor={indoor} />

      {/* Sklispor etter laget som glir */}
      {(['A', 'B'] as const).map((side) =>
        slide(side) ? (
          <g key={side}>
            {[rest[side].front, rest[side].rear].flatMap((p, i) =>
              [p.pts.venstreFot.x, p.pts.hoyreFot.x].map((fx, j) => <Sklispor key={`${i}${j}`} x0={fx} x1={fx + shift} feste={side === 'A' ? festeA : festeB} />),
            )}
          </g>
        ) : null,
      )}

      {/* Skyggene under føttene tegnes av Person. Tauet bak personene, så hendene griper rundt det. */}
      <Tau points={rope} tykkelse={5.5} />
      {persons('A', A, festeA)}
      {persons('B', B, festeB)}
      <Tauband x={ribbonX} y={ribbonY} />

      {/* Systemgrenser */}
      {view === 'lag' && (
        <g>
          <Grense {...bA} />
          <Grense {...bB} />
        </g>
      )}
      {view === 'system' && <Grense {...bSys} />}

      {/* Lagene */}
      {teamLabel(A, 'A', mA, festeA, festeA === 'gress' ? 0.6 : festeA === 'is' ? 0.1 : 0.25)}
      {teamLabel(B, 'B', mB, festeB, festeB === 'gress' ? 0.6 : festeB === 'is' ? 0.1 : 0.25)}

      {/* Kraftene fra tauet på lagene (S), og fra lagene på tauet (S′) */}
      {state.S > 0 && (
        <g opacity={internal ? 0.35 : 1}>
          <ForceArrow x1={A.grip.x} y1={sY} x2={A.grip.x + S} y2={sY} color={VIZ.tension} dashed={internal} />
          <ForceArrow x1={B.grip.x} y1={sY} x2={B.grip.x - S} y2={sY} color={VIZ.tension} dashed={internal} />
          {!internal && sLabel(A, 1, false)}
          {!internal && sLabel(B, -1, false)}
        </g>
      )}
      {internal && state.S > 0 && (
        <Txt x={(A.grip.x + B.grip.x) / 2} y={sY - 12 * f} size={0.78} muted weight={650}>
          S er indre kraft
        </Txt>
      )}
      {showPairs && state.S > 0 && (
        <g>
          <ForceArrow x1={A.grip.x} y1={s2Y} x2={A.grip.x - S} y2={s2Y} color={VIZ.tension} />
          <ForceArrow x1={B.grip.x} y1={s2Y} x2={B.grip.x + S} y2={s2Y} color={VIZ.tension} />
          {sLabel(A, 1, true)}
          {sLabel(B, -1, true)}
        </g>
      )}

      {/* Friksjonen fra bakken på lagene (R), og fra lagene på bakken (R′) */}
      {state.RA > 0 && (
        <ForceArrow x1={A.lead.x} y1={rY} x2={A.lead.x - state.RA * k} y2={rY} color={VIZ.friction} label={rLabel('A', false)} />
      )}
      {state.RB > 0 && (
        <ForceArrow x1={B.lead.x} y1={rY} x2={B.lead.x + state.RB * k} y2={rY} color={VIZ.friction} label={rLabel('B', false)} />
      )}
      {showPairs && state.RA > 0 && (
        <ForceArrow x1={A.lead.x} y1={r2Y} x2={A.lead.x + state.RA * k} y2={r2Y} color={VIZ.friction} label={rLabel('A', true)} />
      )}
      {showPairs && state.RB > 0 && (
        <ForceArrow x1={B.lead.x} y1={r2Y} x2={B.lead.x - state.RB * k} y2={r2Y} color={VIZ.friction} label={rLabel('B', true)} />
      )}

      {/* Akselerasjonen til hele systemet */}
      {moving && aLen > 3 && (
        <ForceArrow
          x1={ribbonX}
          y1={aY}
          x2={ribbonX + aDir * aLen}
          y2={aY}
          color={VIZ.acceleration}
          width={5}
          label={`a = ${fmt(Math.abs(state.a), 2)} m/s²`}
        />
      )}

      <ValueTag x={CX} y={box.y + 24 * Math.max(1, f * 0.9)} text={status} />
    </g>
  );
}

/** Stiplet systemgrense rundt et lag eller hele systemet. */
function Grense({ x, y, w, h }: { x: number; y: number; w: number; h: number }) {
  const ss = useStrokeScale();
  return (
    <rect x={x} y={y} width={w} height={h} rx={12} fill="none" stroke={VIZ.ink} strokeWidth={1.4 * ss} strokeDasharray={`${6 * ss} ${5 * ss}`} opacity={0.6} />
  );
}
