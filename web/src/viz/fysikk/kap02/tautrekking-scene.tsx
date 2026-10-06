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
import { FESTE_MU, leanAngle, type Feste, type TugPlan, type TugState } from './model-tautrekking';
import { G_EARTH } from '../../kit/format';

export type TugView = 'lag' | 'par' | 'system';

export const W = 800;
/** Bakken der lagene står, og horisonten (eller foten av veggen inne). Underlaget fyller fra horisonten til bunnen. */
export const GROUND = 330;
const HORIZON = 250;
/** Nederste kant av figuren: foran lagene er det plass til to rader med piler langs bakken (R og R′). */
export const H = 440;
/** Midtstreken. */
export const CX = 400;
/** Piksler per meter. En person på 1,75 m blir 158 høy. */
export const PX_PER_M = 90;
/** Den fremste foten til den fremste personen står så langt fra midtstreken (m). */
const FRONT_FOOT_M = 1.15;
/** Avstanden mellom de to personene på et lag (m). */
const SPACING_M = 0.9;
/** Hvor langt taperlaget dras (m): da er den fremste foten (1,15 m fra streken) dratt litt over midtstreken. */
export const S_END = 1.25;
/** Akselerasjonspila: piksler per m/s², og den lengste pila. */
const PX_PER_A = 60;
const A_MAX_PX = 96;

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
const FESTE_KORT: Record<Feste, string> = { gress: 'Gress', sokker: 'Sokker', is: 'Is' };

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
    [e.x + dir * 0.8 * PX_PER_M, GROUND - 2.5],
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
      <Himmel x={x0} y={top} w={x1 - x0} h={HORIZON - top + 2} sol={{ x: 150, y: 82, r: 15 }} skyer={2} seed={5} />
      <Landskap x={x0} y={HORIZON} w={x1 - x0} h={120} type="skog" seed={2} />
    </>
  );
});

/** Underlaget: ett for hvert lag, delt ved midtstreken (ett helt når lagene står på det samme). */
const Grounds = memo(function Grounds({ a, b, indoor, x0, x1 }: { a: Feste; b: Feste; indoor: boolean; x0: number; x1: number }) {
  if (indoor) return null;
  // Lagene står på toppflaten, som fyller hele bildet ned til kanten (vi ser ikke et snitt av bakken).
  const y = H - 6;
  if (a === b) return <Underlag x1={x0} x2={x1} y={y} depth={8} type={GROUND_TYPE[a]} horisont={HORIZON} seed={3} />;
  return (
    <>
      <Underlag x1={x0} x2={CX} y={y} depth={8} type={GROUND_TYPE[a]} horisont={HORIZON} seed={3} />
      <Underlag x1={CX} x2={x1} y={y} depth={8} type={GROUND_TYPE[b]} horisont={HORIZON} seed={4} />
    </>
  );
});

/**
 * Midtstreken: en malt strek over underlaget, smal bak og bredere foran (perspektiv), som dekker skjøten mellom to
 * underlag.
 */
function Midtstrek({ indoor }: { indoor: boolean }) {
  const ss = useStrokeScale();
  // Streken går på tvers av tauet, innover i bildet: smal bak og bredere foran (perspektiv), helt ned til kanten.
  const back = GROUND - 44;
  const front = H;
  const paint = mix(PAINTS.hvit, indoor ? SCENE.floor : SCENE.snow, 0.15);
  return (
    <g aria-hidden>
      <path
        d={`M${CX - 1.6},${back} L${CX + 1.6},${back} L${CX + 5.5},${front} L${CX - 5.5},${front} Z`}
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

/** Øverste kant av bakgrunnen: dekker utsnittet både på PC og mobil (se SceneFigure). */
const SKY_TOP = 0;

export function TugScene({ mA, mB, festeA, festeB, plan, state, view, k, box, narrow }: TugSceneProps) {
  const f = useTextScale();
  const ss = useStrokeScale();
  const indoor = festeA === 'sokker' && festeB === 'sokker';
  const shift = state.x * PX_PER_M;
  const A = teamLayout('A', mA, state.S, shift);
  const B = teamLayout('B', mB, state.S, shift);
  const moving = state.phase === 'glir' || state.phase === 'ferdig';
  const winner = plan.winner;
  const travel = Math.abs(shift);

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
            ledd={{ rygg: p.ledd.rygg - 2 }}
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

  // Kreftene: S langs tauet over det (mot midten), S′ under det (utover), R og R′ langs bakken foran lagene.
  // Tauet kan helle litt når lagene er ulikt høye: u går langs tauet fra lag A til lag B, n er normalen opp.
  const S = state.S * k;
  const ux0 = B.grip.x - A.grip.x;
  const uy0 = B.grip.y - A.grip.y;
  const uL = Math.hypot(ux0, uy0) || 1;
  const u = { x: ux0 / uL, y: uy0 / uL };
  const n = { x: u.y, y: -u.x };
  const off = 15 * ss;
  /** Pil langs tauet fra grepet: `along` = +1 mot lag B, −1 mot lag A; `side` = +1 over tauet, −1 under. */
  const ropeArrow = (g: Pt, along: number, side: number) => {
    const x1 = g.x + n.x * off * side;
    const y1 = g.y + n.y * off * side;
    return { x1, y1, x2: x1 + u.x * S * along, y2: y1 + u.y * S * along };
  };
  const rY = GROUND + 20;
  const r2Y = GROUND + 30 + 24 * f;
  const showPairs = view === 'par';
  const internal = view === 'system';
  const slide = (side: 'A' | 'B') => (side === 'A' ? state.slidingA : state.slidingB);

  // Etikettene til S står midt over pila, og til S′ midt under pila.
  const sLabel = (g: Pt, along: number, prime: boolean) => {
    const a = ropeArrow(g, along, prime ? -1 : 1);
    const mx = (a.x1 + a.x2) / 2;
    const my = (a.y1 + a.y2) / 2;
    return (
      <Txt x={mx} y={prime ? my + 8 + 14 * f : my - 9 - 3 * f} color={VIZ.tension} weight={740}>
        {prime ? 'S′' : 'S'}
      </Txt>
    );
  };
  const rLabel = (side: 'A' | 'B', prime: boolean) => (
    <>
      R{prime ? '′' : ''}
      <TSub>{side}</TSub>
    </>
  );

  // Systemgrenser
  const pad = 10;
  const boxFor = (T: TeamLayout, side: 'A' | 'B') => {
    const end = T.rope[T.rope.length - 1]![0];
    const outer = side === 'A' ? Math.min(T.backX, end) - pad : Math.max(T.backX, end) + pad;
    const inner = T.grip.x + (side === 'A' ? 1 : -1) * 18;
    return { x: Math.min(outer, inner), w: Math.abs(inner - outer), y: T.headTop - pad, h: GROUND + 8 - (T.headTop - pad) };
  };
  // Grensene holder seg innenfor utsnittet (vinnerlaget kan gå nesten ut av bildet).
  const clampBox = (b: { x: number; y: number; w: number; h: number }) => {
    const l = Math.max(b.x, box.x + 5);
    const r = Math.min(b.x + b.w, box.x + box.w - 5);
    return { ...b, x: l, w: Math.max(0, r - l) };
  };
  const bA = clampBox(boxFor(A, 'A'));
  const bB = clampBox(boxFor(B, 'B'));
  const bSys = { x: bA.x, y: Math.min(bA.y, bB.y), w: bB.x + bB.w - bA.x, h: GROUND + 8 - Math.min(bA.y, bB.y) };

  const status =
    state.phase === 'klar'
      ? 'Lagene står klare'
      : state.phase === 'drar'
        ? 'Ingen glir'
        : state.phase === 'uavgjort'
          ? 'Uavgjort: ingen glir'
          : state.phase === 'glir'
            ? `Lag ${plan.loser} glir`
            : `Lag ${plan.winner} vant`;

  // Akselerasjonspila over midten av tauet, med etiketten over pila.
  const aLen = Math.min(A_MAX_PX, Math.abs(state.a) * PX_PER_A);
  const aDir = Math.sign(state.a);
  const tagY = box.y + 22 * Math.max(1, f * 0.9);
  const aY = tagY + 30 + 18 * f;

  // Lagetikettene står like høyt, over hodene.
  const labelY = Math.min(A.headTop, B.headTop) - 14;
  const teamLabel = (T: TeamLayout, side: 'A' | 'B', m: number, feste: Feste) => (
    <g>
      <Txt x={T.cx} y={labelY - 19 * f} size={0.92} weight={740}>
        Lag {side} · {fmt(m, 0)} kg
      </Txt>
      <Txt x={T.cx} y={labelY} size={0.8} muted weight={600}>
        {narrow ? '' : `${FESTE_KORT[feste]} · `}μ<TSub>s</TSub> = {fmt(FESTE_MU[feste].muS, 2)}
      </Txt>
    </g>
  );

  return (
    <g>
      <Backdrop indoor={indoor} top={SKY_TOP} x0={-2} x1={W + 2} />
      <Grounds a={festeA} b={festeB} indoor={indoor} x0={-2} x1={W + 2} />
      <Midtstrek indoor={indoor} />

      {/* Sklispor etter laget som glir */}
      {(['A', 'B'] as const).map((side) =>
        slide(side) ? (
          <g key={side}>
            {(() => {
              const r0 = teamLayout(side, side === 'A' ? mA : mB, state.S, 0);
              return [r0.front, r0.rear];
            })().flatMap((p, i) =>
              [p.pts.venstreFot.x, p.pts.hoyreFot.x].map((fx, j) => <Sklispor key={`${i}${j}`} x0={fx} x1={fx + shift} feste={side === 'A' ? festeA : festeB} />),
            )}
          </g>
        ) : null,
      )}

      {/* Tauet bak personene, så hendene griper rundt det */}
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

      {teamLabel(A, 'A', mA, festeA)}
      {teamLabel(B, 'B', mB, festeB)}

      {/* Kreftene fra tauet på lagene (S), og fra lagene på tauet (S′). I hele systemet er S indre krefter. */}
      {state.S > 0 && (
        <g opacity={internal ? 0.5 : 1}>
          <ForceArrow {...ropeArrow(A.grip, 1, 1)} color={VIZ.tension} dashed={internal} />
          <ForceArrow {...ropeArrow(B.grip, -1, 1)} color={VIZ.tension} dashed={internal} />
          {sLabel(A.grip, 1, false)}
          {sLabel(B.grip, -1, false)}
        </g>
      )}
      {internal && state.S > 0 && (
        <Txt x={ribbonX} y={Math.min(A.grip.y, B.grip.y) + 20 + 14 * f} size={0.78} muted weight={650}>
          Indre krefter
        </Txt>
      )}
      {showPairs && state.S > 0 && (
        <g>
          <ForceArrow {...ropeArrow(A.grip, -1, -1)} color={VIZ.tension} />
          <ForceArrow {...ropeArrow(B.grip, 1, -1)} color={VIZ.tension} />
          {sLabel(A.grip, -1, true)}
          {sLabel(B.grip, 1, true)}
        </g>
      )}

      {/* Friksjonen fra bakken på lagene (R), og fra lagene på bakken (R′) */}
      {state.RA > 0 && <ForceArrow x1={A.lead.x} y1={rY} x2={A.lead.x - state.RA * k} y2={rY} color={VIZ.friction} label={rLabel('A', false)} />}
      {state.RB > 0 && <ForceArrow x1={B.lead.x} y1={rY} x2={B.lead.x + state.RB * k} y2={rY} color={VIZ.friction} label={rLabel('B', false)} />}
      {/* R′ peker innover mot hverandre, så etikettene står under pilene (ikke ved spissene, som kan møtes på midten) */}
      {showPairs && state.RA > 0 && (
        <ForceArrow
          x1={A.lead.x}
          y1={r2Y}
          x2={A.lead.x + state.RA * k}
          y2={r2Y}
          color={VIZ.friction}
          label={rLabel('A', true)}
          labelX={A.lead.x + (state.RA * k) / 2}
          labelY={r2Y + 12 + 14 * f}
          labelAnchor="middle"
        />
      )}
      {showPairs && state.RB > 0 && (
        <ForceArrow
          x1={B.lead.x}
          y1={r2Y}
          x2={B.lead.x - state.RB * k}
          y2={r2Y}
          color={VIZ.friction}
          label={rLabel('B', true)}
          labelX={B.lead.x - (state.RB * k) / 2}
          labelY={r2Y + 12 + 14 * f}
          labelAnchor="middle"
        />
      )}

      {/* Akselerasjonen til hele systemet */}
      {moving && aLen > 3 && (
        <ForceArrow
          x1={ribbonX - (aDir * aLen) / 2}
          y1={aY}
          x2={ribbonX + (aDir * aLen) / 2}
          y2={aY}
          color={VIZ.acceleration}
          width={5}
          label={`a = ${fmt(Math.abs(state.a), 2)} m/s²`}
          labelX={ribbonX}
          labelY={aY - 12 - 2 * f}
          labelAnchor="middle"
        />
      )}

      <ValueTag x={box.x + box.w - 14} y={tagY} anchor="end" text={status} />
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
