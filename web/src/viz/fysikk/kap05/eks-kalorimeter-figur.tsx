/**
 * Figurene til eksempeloppgaven «Hvilket metall er det?» (k5-eks-kalorimeter):
 * - KalorimeterScene: labbenken med kokeplata og kasserollen der metallbiten varmes i kokende vann, og
 *   isoporkalorimeteret i snitt med vannet og termometeret. Metallbiten flytter seg med stegene (i kasserollen, i
 *   lufta på vei over, på bunnen av kalorimeteret), og pilene for varmetap kommer i d) og e).
 * - Regnskap: energien metallet avgir og vannet mottar (søyler), og tabellen over spesifikk varmekapasitet med den
 *   målte verdien som en loddrett strek.
 *
 * Én skala (K_CM px per cm) for kasserollen, metallbiten og kalorimeteret. Tallene kommer fra solveCalorimeterTask.
 */
import type { ReactNode } from 'react';
import { Figure, TSub, Txt, VIZ, fmt, useTextScale, type FigureState } from '../../kit';
import {
  ForceArrow,
  Kasserolle,
  Kokeplate,
  Rom,
  SCENE,
  Underlag,
  ValueTag,
  alpha,
  useStrokeScale,
  useSvgId,
} from '../../kit/scene';
import {
  Blyant,
  Kalorimeter,
  Metallbit,
  Traad,
  calPoints,
  metallbitTop,
  useNarrowBox,
} from './eks-kalorimeter-deler';
import {
  CALORIMETER,
  METAL_TABLE,
  RHO_WATER,
  calorimeterFill,
  type CalorimeterSolution,
  type CalorimeterTask,
} from './model-eks-kalorimeter';

const HOT = VIZ.series[1];
const COLD = VIZ.series[0];
const MATCH = VIZ.series[2];

/** Stegene i løsningen (1 = første steg). Komponenten og figuren bruker de samme numrene. */
export const STEP = {
  qWater: 1,
  balance: 2,
  solveC: 3,
  table: 4,
  lossCal: 5,
  lossAir: 6,
  ideal: 7,
  lossFrac: 8,
} as const;

/** Hva figuren viser i et steg. */
export interface KalView {
  /** Hvor metallbiten er. */
  metalAt: 'kasserolle' | 'luft' | 'kalorimeter';
  /** Temperaturen på termometeret i kalorimeteret. */
  thermo: number;
  waterTag: string;
  metalTag: string | null;
  transfer: boolean;
  /** Piler for varmetap fra kalorimeteret, med etikett. */
  lossCal: ReactNode | null;
  /** Piler for varmetap fra metallbiten i lufta. */
  lossAir: boolean;
  /** Energisøylene. */
  energy: 'tom' | 'vann' | 'like' | 'tap' | 'ideal' | 'delt';
  measured: boolean;
  highlight: boolean;
  /** Pil som viser at den ekte verdien er større (d). */
  higher: boolean;
  /** Ton ned metallet like under målingen (d og e), som varmetapet gjør mindre sannsynlig. */
  fadeBelow: boolean;
}

export function viewFor(step: number, showAll: boolean, task: CalorimeterTask, s: CalorimeterSolution): KalView {
  const T = (v: number) => fmt(v, 1);
  const st = showAll ? STEP.lossFrac : step;
  const after = `${T(task.TWater)} → ${T(task.TEnd)} °C`;
  const base: KalView = {
    metalAt: 'kalorimeter',
    thermo: task.TEnd,
    waterTag: after,
    metalTag: null,
    transfer: false,
    lossCal: null,
    lossAir: false,
    energy: 'tom',
    measured: st >= STEP.solveC,
    highlight: st >= STEP.table,
    higher: st === STEP.lossCal || st === STEP.lossAir,
    fadeBelow: st >= STEP.lossCal,
  };
  if (st === 0) return { ...base, metalAt: 'kasserolle', thermo: task.TWater, waterTag: `${T(task.TWater)} °C`, transfer: true };
  if (st === STEP.lossAir)
    return { ...base, metalAt: 'luft', thermo: task.TWater, waterTag: `${T(task.TWater)} °C`, metalTag: 'Under 100 °C', lossAir: true, energy: 'tap' };
  if (st === STEP.ideal)
    return { ...base, thermo: s.TIdeal, waterTag: `Uten tap: ${T(s.TIdeal)} °C`, metalTag: `${T(task.TMetal)} → ${T(s.TIdeal)} °C`, energy: 'ideal' };
  if (st === STEP.lossCal) return { ...base, lossCal: 'Varmetap', energy: 'tap' };
  if (st === STEP.lossFrac)
    return {
      ...base,
      lossCal: (
        <>
          Q<TSub>tap</TSub> ≈ {fmt(s.QLoss / 1000, 1)} kJ
        </>
      ),
      energy: 'delt',
    };
  return {
    ...base,
    metalTag: `${T(task.TMetal)} → ${T(task.TEnd)} °C`,
    energy: st === STEP.qWater ? 'vann' : 'like',
  };
}

/* ---------------------------------------------------------------- Scenen */

const K_CM = 11;
const THERMO_LEN = 26;
/** Skalaen på termometeret: −20 til 50 °C, så 15–30 °C står over lokket og kan leses. */
const THERMO_MIN = -20;
const THERMO_MAX = 50;
/** Metallbiten står litt til venstre for midten av kalorimeteret, termometeret til høyre (cm fra midten). */
const BLOCK_X = -1.6;
const THERMO_X = 3.2;
/** Vannstanden i kasserollen (0–1, som i Kasserolle). Biten må dekkes også i den minste kasserollen. */
const POT_WATER = 0.95;

/**
 * Plasseringene. Kasserollen er 14,5 cm (13 cm på mobil) bred og står midt på kokeplata (Kokeplate-målene i
 * scene-kit-et: kasserollen er 0,62 · bredden på plata). Skaftet peker mot kalorimeteret.
 */
function sceneLayout(narrow: boolean) {
  const potW = (narrow ? 12 : 14.5) * K_CM;
  return narrow
    ? { W: 490, H: 470, bench: 380, potX: 108, potW, plateW: potW / 0.62, calX: 372 }
    : { W: 800, H: 440, bench: 360, potX: 172, potW, plateW: potW / 0.62, calX: 616 };
}

export function KalorimeterFigur({
  task,
  s,
  state,
}: {
  task: CalorimeterTask;
  s: CalorimeterSolution;
  state: FigureState;
}) {
  const [ref, narrow] = useNarrowBox<HTMLDivElement>();
  const view = viewFor(state.step, state.showAll, task, s);
  return (
    <div ref={ref}>
      <KalorimeterScene task={task} view={view} narrow={narrow} />
      <Regnskap s={s} view={view} narrow={narrow} />
    </div>
  );
}

function KalorimeterScene({ task, view, narrow }: { task: CalorimeterTask; view: KalView; narrow: boolean }) {
  const L = sceneLayout(narrow);
  const where =
    view.metalAt === 'kasserolle'
      ? 'Metallbiten henger i kokende vann i en kasserolle på kokeplata.'
      : view.metalAt === 'luft'
        ? 'Metallbiten løftes over fra kasserollen til kalorimeteret og avgir varme til lufta på veien.'
        : 'Metallbiten ligger på bunnen av kalorimeteret, og termometeret viser likevektstemperaturen.';
  return (
    <Figure
      viewBox={`0 0 ${L.W} ${L.H}`}
      label={`${where} Kalorimeteret er et isoporbeger med lokk og ${fmt(task.mWater, 3)} kg vann. Termometeret viser ${fmt(view.thermo, 1)} grader celsius.`}
      maxHeight={520}
    >
      <SceneBody task={task} view={view} L={L} />
    </Figure>
  );
}

function SceneBody({ task, view, L }: { task: CalorimeterTask; view: KalView; L: ReturnType<typeof sceneLayout> }) {
  const f = useTextScale();
  const ss = useStrokeScale();
  const k = K_CM;
  const fill = calorimeterFill(task);
  const block = { x: BLOCK_X, d: fill.block.d, h: fill.block.h, metal: task.metal };
  const inCal = view.metalAt === 'kalorimeter';
  const levelNoBlock = ((task.mWater / RHO_WATER) * 1e6) / (Math.PI * CALORIMETER.innerR ** 2);
  const level = inCal ? fill.level : levelNoBlock;
  const cp = calPoints(L.bench, k, CALORIMETER);
  const holeX = L.calX + BLOCK_X * k;
  const thermoX = L.calX + THERMO_X * k;
  const thermoBase = cp.yF - 0.4 * k;
  const thermoTop = thermoBase - THERMO_LEN * k;

  // Kasserollen på kokeplata (Kokeplate/Kasserolle-mål fra scene-kit-et)
  const potW = L.potW;
  const kp = potW / 100;
  const potY = L.bench - 0.25 * L.plateW;
  const rimY = potY - 58 * kp;
  const floorY = potY - 10.5 * kp;
  const waterY = potY + (-10.5 - POT_WATER * 45) * kp;
  const potInner = 48.5 * kp;
  const bd = block.d * k;
  const bh = block.h * k;

  // Metallbiten i kasserollen (henger like over bunnen) eller i lufta (på vei over, høyt over benken)
  const potBlockY = floorY - 4;
  const handleEnd = L.potX + 1.29 * potW;
  const airX = (handleEnd + L.calX - cp.Rw) / 2 - (narrow(L) ? 6 : 20);
  const airY = cp.yL - (narrow(L) ? 92 : 104);

  // Merkelappen for metallet: til venstre for kalorimeteret på bred skjerm, over det på mobil
  const tagFs = 17 * 0.9 * f;
  const tagW = (txt: string) => Math.max(tagFs * 1.6, txt.length * tagFs * 0.6 + 16 * f);
  const metalTag = view.metalTag;
  const mtW = metalTag ? tagW(metalTag) : 0;
  const metalAnchor = inCal
    ? { x: L.calX + BLOCK_X * k, y: metallbitTop(cp.yF, bd, bh) }
    : view.metalAt === 'luft'
      ? { x: airX, y: metallbitTop(airY, bd, bh) }
      : { x: L.potX, y: metallbitTop(potBlockY, bd, bh) };
  const mtPos = narrow(L)
    ? { x: Math.max(mtW / 2 + 6, Math.min(thermoX - 16 - mtW / 2, L.calX - 30)), y: cp.yL - 64 }
    : { x: L.calX - cp.Rw - 20 - mtW / 2, y: cp.yL - 44 };
  // I lufta: skiltet står under biten, under pilene for varmetap
  const mtAir = view.metalAt === 'luft' ? { x: airX, y: airY + 30 + tagFs } : null;

  const wtW = tagW(view.waterTag);
  const wtX = Math.min(L.W - wtW / 2 - 6, thermoX + 4);
  const wtY = thermoTop - 20 * f;

  // Pilene for varmetap fra kalorimeteret: ut gjennom veggene og lokket
  const lossY = cp.yF - 0.45 * level * k;
  const lossLen = Math.min(30 + 6 * f, L.W - (L.calX + cp.Rw + 3) - 4);

  return (
    <g>
      <Rom x={0} y={0} w={L.W} h={L.H} gulvY={L.H - 4} gulv="betong" />
      <Underlag x1={0} x2={L.W} y={L.bench} depth={L.H - L.bench} type="labbenk" />

      {/* Kokeplata med kasserollen og kokende vann */}
      <Kokeplate x={L.potX} y={L.bench} w={L.plateW} effekt={0.85} />
      <Kasserolle x={L.potX} y={potY} w={potW} vann={POT_WATER} damp={0.9} snitt />
      {view.metalAt === 'kasserolle' && (
        <g>
          <Metallbit x={L.potX} y={potBlockY} d={bd} h={bh} metal={task.metal} warm={1} />
          <Traad points={[[L.potX, metallbitTop(potBlockY, bd, bh)], [L.potX, rimY - 4]]} />
          {/* Vannet foran biten */}
          <rect x={L.potX - potInner} y={waterY} width={2 * potInner} height={floorY - waterY} fill={alpha(SCENE.water, 0.24)} />
        </g>
      )}
      <Blyant x={L.potX + 4} y={rimY - 4} len={potW * 1.12} />

      {/* Kalorimeteret */}
      <Kalorimeter
        x={L.calX}
        y={L.bench}
        k={k}
        geo={CALORIMETER}
        level={level}
        warm={(view.thermo - 10) / 60}
        block={inCal ? block : undefined}
        holeX={BLOCK_X}
        threadTop={inCal ? cp.yL - 10 : undefined}
        thermo={{ x: THERMO_X, length: THERMO_LEN, temp: view.thermo, min: THERMO_MIN, max: THERMO_MAX }}
      />

      {/* På vei over: biten henger i tråden, høyt over benken */}
      {view.metalAt === 'luft' && (
        <g>
          <Traad points={[[airX, metallbitTop(airY, bd, bh)], [airX, -4]]} />
          <Metallbit x={airX} y={airY} d={bd} h={bh} metal={task.metal} warm={0.7} />
        </g>
      )}
      {view.lossAir && (
        <g>
          {[
            [-1, 0],
            [1, 0],
            [-0.7, 0.75],
            [0.7, 0.75],
          ].map(([dx, dy], i) => {
            const cx = airX;
            const cy = airY - 0.08 * bd - bh / 2;
            const x1 = cx + dx! * (bd / 2 + 4);
            const y1 = cy + dy! * (bh / 2 + 4);
            return <ForceArrow key={i} x1={x1} y1={y1} x2={x1 + dx! * 24} y2={y1 + dy! * 24} color={HOT} width={4.5} />;
          })}
          <Txt x={airX - bd / 2 - 36} y={airY - 0.08 * bd - bh / 2 + 6 * f} anchor="end" size={0.85} weight={650} color={HOT}>
            Varmetap til lufta
          </Txt>
        </g>
      )}

      {/* Flyttes raskt over */}
      {view.transfer && <TransferArc x1={L.potX + 10} y1={rimY - 30} x2={holeX} y2={cp.yL - 22} narrow={narrow(L)} />}

      {/* Varmetap fra kalorimeteret: ut gjennom veggene og lokket */}
      {view.lossCal && (
        <g>
          <ForceArrow x1={L.calX - cp.Rw - 3} y1={lossY} x2={L.calX - cp.Rw - 3 - lossLen} y2={lossY} color={HOT} width={5} />
          <ForceArrow x1={L.calX + cp.Rw + 3} y1={lossY} x2={L.calX + cp.Rw + 3 + lossLen} y2={lossY} color={HOT} width={5} />
          <ForceArrow x1={L.calX - 0.62 * cp.Rw} y1={cp.yL - 3} x2={L.calX - 0.62 * cp.Rw - 10} y2={cp.yL - 3 - lossLen} color={HOT} width={5} />
          <Txt x={L.calX - 0.62 * cp.Rw - 16} y={cp.yL - 10 - lossLen} anchor="end" size={0.9} weight={700} color={HOT}>
            {view.lossCal}
          </Txt>
        </g>
      )}

      {/* Temperaturene */}
      <ValueTag x={L.potX} y={rimY - 84 - 6 * f} text={`${fmt(task.TMetal, 1)} °C`} color={HOT} pointer={10} />
      <ValueTag x={wtX} y={wtY} text={view.waterTag} color={COLD} pointer={view.waterTag.length < 9 ? 8 : undefined} />
      {metalTag && (inCal || view.metalAt === 'luft') && (
        <MetalTag
          text={metalTag}
          tag={mtAir ?? mtPos}
          to={mtAir ? null : metalAnchor}
          w={mtW}
          fs={tagFs}
          ss={ss}
        />
      )}
      {/* Liten lapp på kalorimeteret, bare før forsøket */}
      {view.transfer && (
        <Txt x={L.calX} y={L.bench + 26 * f} size={0.82} weight={600} muted>
          Kalorimeter
        </Txt>
      )}
    </g>
  );
}

/** Om oppsettet er det smale (mobil). */
function narrow(L: ReturnType<typeof sceneLayout>) {
  return L.W < 700;
}

/** Skilt med temperaturen til metallbiten, med en tynn strek ned til biten. */
function MetalTag({
  text,
  tag,
  to,
  w,
  fs,
  ss,
}: {
  text: string;
  tag: { x: number; y: number };
  to: { x: number; y: number } | null;
  w: number;
  fs: number;
  ss: number;
}) {
  const h = fs * 1.55;
  // Streken går fra kanten av skiltet nærmest biten
  const fromX = to ? Math.max(tag.x - w / 2 + 8, Math.min(tag.x + w / 2 - 8, to.x)) : 0;
  const fromY = to ? (to.y > tag.y ? tag.y + h / 2 : tag.y - h / 2) : 0;
  return (
    <g>
      {to && (
        <>
          <line x1={fromX} y1={fromY} x2={to.x} y2={to.y} stroke={VIZ.surface} strokeWidth={3.4 * ss} strokeLinecap="round" opacity={0.8} />
          <line x1={fromX} y1={fromY} x2={to.x} y2={to.y} stroke={HOT} strokeWidth={1.4 * ss} strokeLinecap="round" />
          <circle cx={to.x} cy={to.y} r={2.6 * ss} fill={HOT} stroke={VIZ.surface} strokeWidth={1.2 * ss} />
        </>
      )}
      <ValueTag x={tag.x} y={tag.y} text={text} color={HOT} />
    </g>
  );
}

/** Stiplet bue fra kasserollen til kalorimeteret med pil og teksten «Flyttes raskt over». */
function TransferArc({ x1, y1, x2, y2, narrow: nar }: { x1: number; y1: number; x2: number; y2: number; narrow: boolean }) {
  const ss = useStrokeScale();
  const top = Math.min(y1, y2) - (nar ? 70 : 90);
  const cx = (x1 + x2) / 2;
  const d = `M${x1},${y1}C${x1 + 0.1 * (x2 - x1)},${top} ${x2 - 0.15 * (x2 - x1)},${top} ${x2},${y2}`;
  // Retningen på slutten av kurven (fra siste kontrollpunkt)
  const ex = x2 - (x2 - 0.15 * (x2 - x1));
  const ey = y2 - top;
  const len = Math.hypot(ex, ey) || 1;
  const ux = ex / len;
  const uy = ey / len;
  const a = 11 * ss;
  const head = `${x2},${y2} ${x2 - ux * a - uy * a * 0.55},${y2 - uy * a + ux * a * 0.55} ${x2 - ux * a + uy * a * 0.55},${y2 - uy * a - ux * a * 0.55}`;
  return (
    <g>
      <path d={d} fill="none" stroke={VIZ.surface} strokeWidth={5 * ss} opacity={0.75} />
      <path d={d} fill="none" stroke={VIZ.ink} strokeWidth={2 * ss} strokeDasharray={`${7 * ss} ${5 * ss}`} />
      <polygon points={head} fill={VIZ.ink} />
      <Txt x={cx} y={top + 0.25 * (Math.min(y1, y2) - top) - 4} size={0.85} weight={650}>
        Flyttes raskt over
      </Txt>
    </g>
  );
}

/* ---------------------------------------------------------------- Energi og tabell */

function Regnskap({ s, view, narrow: nar }: { s: CalorimeterSolution; view: KalView; narrow: boolean }) {
  const W = nar ? 490 : 800;
  const H = nar ? 560 : 250;
  return (
    <Figure
      viewBox={`0 0 ${W} ${H}`}
      label={`Energien metallet avgir og vannet mottar, og spesifikk varmekapasitet for ${METAL_TABLE.map((m) => `${m.name.toLowerCase()} ${m.c}`).join(', ')} J/(kg·K)${view.measured ? `, og den målte verdien ${fmt(s.c, 0)}` : ''}.`}
      maxHeight={nar ? 620 : 300}
    >
      {nar ? (
        <>
          <EnergyBars s={s} view={view} x0={8} y0={0} w={474} h={232} />
          <TableBars s={s} view={view} x0={0} y0={246} w={486} h={300} narrow />
        </>
      ) : (
        <>
          <EnergyBars s={s} view={view} x0={10} y0={0} w={320} h={H} />
          <TableBars s={s} view={view} x0={366} y0={0} w={428} h={H} narrow={false} />
        </>
      )}
    </Figure>
  );
}

/**
 * Energiregnskapet som to søyler: det metallet avgir (oransje) og det vannet mottar (blått), i én skala (kJ).
 * - «vann»: bare vannet (a). «like»: like store uten varmetap (b, c). «tap»: metallet avgir mer enn vannet mottar,
 *   ukjent hvor mye (d). «ideal»: uten varmetap med tabellverdien (e). «delt»: metallet avgir Q_m, vannet får Q_v og
 *   resten er tap (e).
 */
function EnergyBars({ s, view, x0, y0, w, h }: { s: CalorimeterSolution; view: KalView; x0: number; y0: number; w: number; h: number }) {
  const f = useTextScale();
  const ss = useStrokeScale();
  const hatch = useSvgId('tap');
  const titleY = y0 + 20 * f;
  const base = y0 + h - 44 * f;
  const top = titleY + 34 * f;
  const qMax = s.QMetal * 1.06;
  const sy = (q: number) => ((base - top) * q) / qMax;
  const bw = Math.min(76, w * 0.22);
  // Metallet til venstre med plass til etiketten for tapet til høyre for søyla; vannet helt til høyre
  const xm = x0 + bw / 2 + 34;
  const xv = Math.min(x0 + w - bw / 2 - 14, xm + 240);
  const kJ = (q: number) => `${fmt(q / 1000, 1)} kJ`;
  const mode = view.energy;
  const water = mode === 'ideal' ? s.QIdeal : s.Qw;
  const metal = mode === 'delt' ? s.QMetal : mode === 'ideal' ? s.QIdeal : s.Qw;
  const showWater = mode !== 'tom';
  const showMetal = mode !== 'tom' && mode !== 'vann';
  const hW = sy(water);
  const hM = sy(metal);
  // Tapet: ukjent i d) (stiplet boks, litt høyere enn det egentlig er, så den synes), regnet ut i e)
  const lossH = mode === 'tap' ? Math.max(16, sy(s.QLoss)) : mode === 'delt' ? sy(s.QLoss) : 0;
  const metalTop = base - hM - (mode === 'tap' ? lossH : 0);
  const labelY = base + 20 * f;
  const lossLabelX = xm + bw / 2 + 6;
  return (
    <g>
      <defs>
        <pattern id={hatch} width={7} height={7} patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <rect width={7} height={7} fill={alpha(HOT, 0.18)} />
          <line x1={0} y1={0} x2={0} y2={7} stroke={HOT} strokeWidth={2.4} />
        </pattern>
      </defs>
      <Txt x={x0} y={titleY} anchor="start" size={0.9} weight={700}>
        {mode === 'ideal' ? 'Energi uten varmetap' : 'Energi'}
      </Txt>
      <line x1={x0} x2={x0 + w} y1={base} y2={base} stroke={VIZ.muted} strokeWidth={1.4 * ss} />

      {/* Metallet avgir */}
      {showMetal ? (
        <g>
          {mode === 'delt' ? (
            <>
              <rect x={xm - bw / 2} y={base - hM + lossH} width={bw} height={hM - lossH} fill={HOT} opacity={0.85} />
              <rect x={xm - bw / 2} y={base - hM} width={bw} height={lossH} fill={`url(#${hatch})`} stroke={HOT} strokeWidth={1.2 * ss} />
              <Txt x={lossLabelX} y={base - hM + lossH / 2 + 5 * f} anchor="start" size={0.78} weight={650} color={HOT}>
                tap {kJ(s.QLoss)}
              </Txt>
            </>
          ) : (
            <rect x={xm - bw / 2} y={base - hM} width={bw} height={hM} fill={HOT} opacity={0.85} />
          )}
          {mode === 'tap' && (
            <>
              <rect
                x={xm - bw / 2}
                y={base - hM - lossH}
                width={bw}
                height={lossH}
                fill={alpha(HOT, 0.12)}
                stroke={HOT}
                strokeWidth={1.6 * ss}
                strokeDasharray={`${4 * ss} ${3 * ss}`}
              />
              <Txt x={lossLabelX} y={base - hM - lossH / 2 + 5 * f} anchor="start" size={0.78} weight={650} color={HOT}>
                + tap
              </Txt>
            </>
          )}
          <Txt x={xm} y={metalTop - 8} size={0.9} weight={700} color={HOT}>
            {mode === 'tap' ? `> ${kJ(s.Qw)}` : kJ(metal)}
          </Txt>
        </g>
      ) : (
        <Txt x={xm} y={base - 10} size={0.9} weight={700} muted>
          ?
        </Txt>
      )}

      {/* Vannet mottar */}
      {showWater ? (
        <g>
          <rect x={xv - bw / 2} y={base - hW} width={bw} height={hW} fill={COLD} opacity={0.85} />
          <Txt x={xv} y={base - hW - 8} size={0.9} weight={700} color={COLD}>
            {kJ(water)}
          </Txt>
        </g>
      ) : (
        <Txt x={xv} y={base - 10} size={0.9} weight={700} muted>
          ?
        </Txt>
      )}
      {(mode === 'like' || mode === 'ideal') && (
        <Txt x={(xm + xv) / 2} y={base - hW / 2 + 8} size={1.4} weight={700}>
          =
        </Txt>
      )}

      <Txt x={xm} y={labelY} size={0.82} weight={600}>
        Metallet avgir
      </Txt>
      <Txt x={xv} y={labelY} size={0.82} weight={600}>
        Vannet mottar
      </Txt>
    </g>
  );
}

function TableBars({
  s,
  view,
  x0,
  y0,
  w,
  h,
  narrow: nar,
}: {
  s: CalorimeterSolution;
  view: KalView;
  x0: number;
  y0: number;
  w: number;
  h: number;
  narrow: boolean;
}) {
  const f = useTextScale();
  const ss = useStrokeScale();
  const gap = useSvgId('gap');
  const titleY = y0 + 20 * f;
  const tagY = titleY + 26 * f;
  const rowsTop = tagY + 20 * f;
  // Plass under radene til pila i d), også når den ikke vises, så tabellen står stille mellom stegene
  const rowsBottom = y0 + h - 32 * f;
  const n = METAL_TABLE.length;
  const rowH = (rowsBottom - rowsTop) / n;
  const ls = nar ? 0.92 : 0.82;
  const labelW = (nar ? 90 : 80) * f;
  const bx0 = x0 + labelW + 8;
  const valueW = (nar ? 122 : 112) * f;
  const bx1 = x0 + w - valueW;
  const cMax = 1000;
  const sx = (c: number) => bx0 + ((bx1 - bx0) * Math.min(c, cMax)) / cMax;
  const xc = sx(s.c);
  const barH = Math.min(18 * f, rowH * 0.62);
  const best = s.best.entry.id;
  const below = s.closeBelow?.entry.id;
  const pct = (v: number) => `${v < 0 ? '−' : '+'}${fmt(Math.abs(v) * 100, 1)} %`;
  const rows = METAL_TABLE.map((m, i) => ({
    m,
    cy: rowsTop + (i + 0.5) * rowH,
    isBest: view.highlight && m.id === best,
    faded: view.fadeBelow && m.id === below,
    x1: sx(m.c),
  }));
  return (
    <g>
      <defs>
        <pattern id={gap} width={6} height={6} patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <rect width={6} height={6} fill={alpha(MATCH, 0.2)} />
          <line x1={0} y1={0} x2={0} y2={6} stroke={MATCH} strokeWidth={2} />
        </pattern>
      </defs>
      <Txt x={x0} y={titleY} anchor="start" size={0.9} weight={700}>
        Spesifikk varmekapasitet (tabell)
      </Txt>
      <Txt x={x0 + w} y={titleY} anchor="end" size={0.78} muted>
        J/(kg·K)
      </Txt>
      {/* Søylene, så den målte verdien (stiplet strek), og tekstene øverst (med glorie), så streken ikke dekker tallene */}
      {rows.map(({ m, cy, isBest, faded, x1 }) => (
        <g key={m.id} opacity={faded ? 0.4 : 1}>
          {isBest ? (
            <>
              <rect x={bx0} y={cy - barH / 2} width={Math.max(0, Math.min(xc, x1) - bx0)} height={barH} fill={MATCH} opacity={0.85} />
              <rect x={Math.min(xc, x1)} y={cy - barH / 2} width={Math.abs(x1 - xc)} height={barH} fill={`url(#${gap})`} stroke={MATCH} strokeWidth={1 * ss} />
            </>
          ) : (
            <rect x={bx0} y={cy - barH / 2} width={x1 - bx0} height={barH} fill={VIZ.muted} opacity={0.35} />
          )}
        </g>
      ))}
      {view.measured && (
        <line
          x1={xc}
          x2={xc}
          y1={tagY + 10 * f}
          y2={rowsBottom + 2}
          stroke={VIZ.ink}
          strokeWidth={2 * ss}
          strokeDasharray={`${5 * ss} ${3.5 * ss}`}
        />
      )}
      {rows.map(({ m, cy, isBest, faded, x1 }) => (
        <g key={m.id} opacity={faded ? 0.4 : 1}>
          <Txt x={bx0 - 8} y={cy + 5.5 * f} anchor="end" size={ls} weight={isBest ? 700 : 520}>
            {m.name}
          </Txt>
          <Txt x={x1 + 7} y={cy + 5.5 * f} anchor="start" size={ls} weight={isBest ? 700 : 520} color={isBest ? MATCH : undefined}>
            {isBest ? `${m.c}  (${pct(s.best.dev)})` : String(m.c)}
          </Txt>
        </g>
      ))}
      {view.measured && (
        <ValueTag x={Math.min(x0 + w - 70 * f, Math.max(bx0 + 50 * f, xc))} y={tagY} text={`Målt: ${fmt(s.c, 0)}`} size={0.82} />
      )}
      {view.measured && view.higher && (
        <HigherArrow x={xc} y={rowsBottom + 16 * f} minX={bx0} />
      )}
    </g>
  );
}

/** Pil mot høyre fra den målte verdien: den ekte verdien er større (varmetapet gjør målingen for lav). */
function HigherArrow({ x, y, minX }: { x: number; y: number; minX: number }) {
  const f = useTextScale();
  const len = 42;
  const text = 'Ekte verdi er større';
  const tw = text.length * 17 * 0.8 * f * 0.56;
  // Teksten til venstre for streken når det er plass (over navnene i tabellen går greit), ellers etter pila
  const left = x - 10 - tw >= minX - 60;
  return (
    <g>
      <ForceArrow x1={x} y1={y} x2={x + len} y2={y} color={VIZ.ink} width={4} />
      <Txt x={left ? x - 10 : x + len + 12} y={y + 5 * f} anchor={left ? 'end' : 'start'} size={0.8} weight={650}>
        {text}
      </Txt>
    </g>
  );
}
