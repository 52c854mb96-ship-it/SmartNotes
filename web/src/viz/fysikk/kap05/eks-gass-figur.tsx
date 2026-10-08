/**
 * Figurene til eksempeloppgaven «Luft i en sylinder med stempel» (k5-eks-gass):
 * - GassScene: labbenken med kokeplata, vannbadet og glassylinderen med stempel og splint. Til venstre et manometer
 *   (absolutt trykk) og et digitalt termometer for lufta, begge koblet til bunnplata. Vannbadet varmes opp i b),
 *   kreftene på stempelet kommer i c) og e), varmen og arbeidet i d), og stempelet glir opp når splinten tas ut.
 * - TilstandPanel: de tre tilstandene (start, oppvarmet, etter utvidelsen) med p, V, T og n, og energiregnskapet
 *   (W, Q, ΔU) for de to prosessene mellom dem. Det som ikke er regnet ut ennå, står som «?».
 *
 * Én skala (K px per cm) for vannbadet og sylinderen, og én skala (px per N) for kreftene. Tallene kommer fra
 * solveGasTask.
 */
import type { ReactNode } from 'react';
import { Figure, TSub, Txt, VIZ, fmt, useTextScale, type FigureState } from '../../kit';
import { Callout, ForceArrow, Kokeplate, Rom, SCENE, Underlag, ValueTag, useStrokeScale } from '../../kit/scene';
import {
  Bunnplate,
  Damp,
  DigitalTermometer,
  Luft,
  Manometer,
  Partikler,
  Slange,
  Splint,
  Stempel,
  StempelSpor,
  SylinderBak,
  SylinderForan,
  VannbadBak,
  VannbadForan,
  VarmePil,
  manometerStuss,
  useNarrowBox,
  type BathGeo,
  type CylGeo,
} from './eks-gass-deler';
import { RIG, columnHeight, type GasSolution, type GasTask } from './model-eks-gass';

/** Farger for energien, som i «Termofysikkens første lov» (k5-forste-lov). */
export const COLOR_W = VIZ.series[2];
export const COLOR_Q = VIZ.series[1];
export const COLOR_U = VIZ.series[3];
/** Farge for det som er ukjent eller nettopp regnet ut. */
const FOCUS = VIZ.acceleration;

/** Stegene i løsningen (1 = første steg). Komponenten og figuren bruker de samme numrene. */
export const STEP = {
  si: 1,
  n: 2,
  konstant: 3,
  p2: 4,
  krefter: 5,
  splint: 6,
  oppvarming: 7,
  fortegn: 8,
  dU: 9,
  likevekt: 10,
  volum: 11,
} as const;

/** Hva figuren viser i et steg. */
export interface GassView {
  /** Før oppvarmingen, oppvarmet med splinten i, eller etter utvidelsen (splinten ute). */
  phase: 'start' | 'varm' | 'utvidet';
  /** Kreftene på stempelet: ingen, trykkreftene, alle tre (med splinten) eller likevekt uten splint. */
  forces: 'ingen' | 'trykk' | 'splint' | 'likevekt';
  /** Varmepiler inn i lufta: under oppvarmingen eller under utvidelsen. */
  heat: 'ingen' | 'oppvarming' | 'utvidelse';
  /** «W = 0» ved det låste stempelet, eller arbeidspila ut av lufta. */
  work: 'ingen' | 'null' | 'ut';
  /** Stiplet kontur der stempelet var før utvidelsen. */
  ghost: boolean;
  /** Merk splinten (c). */
  pinFocus: boolean;
  /** Volumet er kjent (ellers «V = ?» i lufta). */
  volumeKnown: boolean;
  panel: PanelView;
}

/** Hva tilstandspanelet viser: hvilke tall som er kjent, og hvilket som er i fokus. */
export interface PanelView {
  n: boolean;
  V2: boolean;
  p2: boolean;
  proc1: boolean;
  state3: boolean;
  proc2: boolean;
  dU2: boolean;
  T3: boolean;
  p3: boolean;
  V3: boolean;
  focus: 'n' | 'p2' | 'V2' | 'dU1' | 'W2' | 'dU2' | 'p3' | 'V3' | null;
}

export function viewFor(step: number, showAll: boolean): GassView {
  const st = showAll ? STEP.volum : step;
  const panel: PanelView = {
    n: st >= STEP.n,
    V2: st >= STEP.konstant,
    p2: st >= STEP.p2,
    proc1: st >= STEP.oppvarming,
    state3: st >= STEP.fortegn,
    proc2: st >= STEP.fortegn,
    dU2: st >= STEP.dU,
    T3: st >= STEP.likevekt,
    p3: st >= STEP.likevekt,
    V3: st >= STEP.volum,
    focus: showAll
      ? null
      : st === STEP.si || st === STEP.n
        ? 'n'
        : st === STEP.konstant
          ? 'V2'
          : st === STEP.p2
            ? 'p2'
            : st === STEP.oppvarming
              ? 'dU1'
              : st === STEP.fortegn
                ? 'W2'
                : st === STEP.dU
                  ? 'dU2'
                  : st === STEP.likevekt
                    ? 'p3'
                    : st === STEP.volum
                      ? 'V3'
                      : null,
  };
  const phase: GassView['phase'] = st < STEP.konstant ? 'start' : st < STEP.fortegn ? 'varm' : 'utvidet';
  return {
    phase,
    forces: st === STEP.krefter ? 'trykk' : st === STEP.splint ? 'splint' : st >= STEP.likevekt ? 'likevekt' : 'ingen',
    heat: st === STEP.oppvarming ? 'oppvarming' : st === STEP.fortegn || st === STEP.dU ? 'utvidelse' : 'ingen',
    work: st === STEP.oppvarming ? 'null' : st === STEP.fortegn || st === STEP.dU ? 'ut' : 'ingen',
    ghost: st === STEP.fortegn || st === STEP.dU,
    pinFocus: st === STEP.splint,
    volumeKnown: phase !== 'utvidet' || st >= STEP.volum,
    panel,
  };
}

export function GassFigur({ task, s, state }: { task: GasTask; s: GasSolution; state: FigureState }) {
  const [ref, narrow] = useNarrowBox<HTMLDivElement>();
  const view = viewFor(state.step, state.showAll);
  return (
    <div ref={ref}>
      <GassScene task={task} s={s} view={view} narrow={narrow} />
      <TilstandPanel task={task} s={s} view={view.panel} narrow={narrow} />
    </div>
  );
}

/* ---------------------------------------------------------------- Scenen */

interface SceneLayout {
  W: number;
  H: number;
  bench: number;
  /** px per cm. */
  K: number;
  /** px per N for kreftene på stempelet. */
  KF: number;
  plateW: number;
  bathX: number;
  gauge: { x: number; y: number; r: number };
  thermo: { x: number; w: number; h: number };
  /** Hvilken side manometerslangen går over kanten av vannbadet (ledningen går alltid over venstre side). */
  tubeSide: 'venstre' | 'hoyre';
  /** Hvor «Vann: …»-etiketten står. */
  waterTag: 'venstre' | 'hoyre';
  /** Hvor splinten ligger når den er tatt ut (venstre ende). */
  pinRest: number;
}

/**
 * Plasseringene. På PC står termometeret til venstre og manometeret til høyre for vannbadet; på mobil står begge
 * til venstre (manometeret øverst), så etikettene for kreftene og energien får plass til høyre.
 */
function sceneLayout(narrow: boolean): SceneLayout {
  return narrow
    ? {
        W: 490,
        H: 500,
        bench: 452,
        K: 7.2,
        KF: 0.063,
        plateW: 214,
        bathX: 296,
        gauge: { x: 114, y: 118, r: 40 },
        thermo: { x: 40, w: 50, h: 80 },
        tubeSide: 'venstre',
        waterTag: 'venstre',
        pinRest: 150,
      }
    : {
        W: 800,
        H: 440,
        bench: 402,
        K: 8,
        KF: 0.07,
        plateW: 240,
        bathX: 352,
        gauge: { x: 690, y: 150, r: 50 },
        thermo: { x: 150, w: 60, h: 96 },
        tubeSide: 'hoyre',
        waterTag: 'hoyre',
        pinRest: 474,
      };
}

/**
 * Slange eller ledning fra et instrument (start) over kanten av vannbadet og ned langs innsiden av glasset til en
 * nippel på bunnplata. `inX` er der den går ned i badet, `side` hvilken side av badet det er.
 */
function routeOverRim(
  start: { x: number; y: number },
  side: 'venstre' | 'hoyre',
  inX: number,
  overY: number,
  rim: number,
  nipY: number,
  nipX: number,
): string {
  const o = side === 'venstre' ? -1 : 1;
  const rising = start.y > overY + 60;
  const c1 = rising ? `${start.x},${start.y - 70}` : `${start.x},${start.y + 60}`;
  const c2 = rising ? `${inX + o * 52},${overY - 6}` : `${inX + o * 90},${overY + 70}`;
  return (
    `M${start.x},${start.y}C${c1} ${c2} ${inX + o * 18},${overY + 2}` +
    `Q${inX + o * 4},${overY - 6} ${inX},${rim + 6}L${inX},${nipY - 10}Q${inX},${nipY} ${inX - o * 10},${nipY}L${nipX},${nipY}`
  );
}

function GassScene({ task, s, view, narrow }: { task: GasTask; s: GasSolution; view: GassView; narrow: boolean }) {
  const L = sceneLayout(narrow);
  const tGas = view.phase === 'start' ? task.t1 : view.phase === 'varm' ? task.t2 : s.t3;
  const tWater = view.phase === 'start' ? task.t1 : task.t2;
  const p = view.phase === 'varm' ? s.p2 : s.p0;
  const where =
    view.phase === 'start'
      ? `Sylinderen står i et vannbad som holder ${fmt(task.t1, 0)} grader, og splinten låser stempelet.`
      : view.phase === 'varm'
        ? `Vannbadet er varmet opp til ${fmt(task.t2, 0)} grader, og stempelet er fortsatt låst.`
        : 'Splinten er tatt ut, og lufta har skjøvet stempelet oppover.';
  return (
    <Figure
      viewBox={`0 0 ${L.W} ${L.H}`}
      label={`${where} Manometeret viser ${fmt(p / 1000, 0)} kilopascal, og termometeret i lufta viser ${fmt(tGas, 1)} grader celsius.`}
      maxHeight={520}
    >
      <SceneBody task={task} s={s} view={view} L={L} tGas={tGas} tWater={tWater} p={p} />
    </Figure>
  );
}

function SceneBody({
  task,
  s,
  view,
  L,
  tGas,
  tWater,
  p,
}: {
  task: GasTask;
  s: GasSolution;
  view: GassView;
  L: SceneLayout;
  tGas: number;
  tWater: number;
  p: number;
}) {
  const f = useTextScale();
  const ss = useStrokeScale();
  const k = Math.max(1, f * 0.85);
  const K = L.K;

  // Kokeplata og vannbadet (bunnen innvendig står midt på plata)
  const plateTop = L.bench - 0.3 * L.plateW;
  const bt = 3;
  const floor = plateTop - bt;
  const bath: BathGeo = { cx: L.bathX, floor, R: RIG.bathR * K, t: bt, rim: floor - RIG.bathH * K, water: floor - RIG.water * K };

  // Sylinderen på bunnplata
  const baseH = RIG.base * K;
  const r = RIG.r * K;
  const cyl: CylGeo = { cx: L.bathX, r, ro: r + RIG.wall * K, rim: floor - baseH - RIG.height * K, bottom: floor - baseH };
  const pistonH = RIG.piston * K;
  const V = view.phase === 'utvidet' ? s.V3 * 1000 : task.V1;
  const gasTop = cyl.bottom - columnHeight(V) * K;
  const pistonTop = gasTop - pistonH;
  const rodTop = pistonTop - 12.5 * K;
  const rodW = 1.1 * K;
  const gasTop1 = cyl.bottom - columnHeight(task.V1) * K;
  const pistonTop1 = gasTop1 - pistonH;

  // Splinten ligger på en korde foran stanga, rett over stempelet (når det er låst)
  const pinD = 0.8 * K;
  const pinY = pistonTop1 + r * 0.14 * 0.55 - pinD / 2;
  const pinIn = view.phase !== 'utvidet';

  // Varme og koking
  const hot = Math.max(0, Math.min(1, (tWater - task.t1) / (100 - task.t1)));
  const boiling = tWater >= 99.5 ? 1 : 0;
  const effekt = view.phase === 'start' ? 0 : boiling ? 0.85 : 0.55;
  const warmGas = Math.max(0, Math.min(1, (tGas - task.t1) / (100 - task.t1)));

  // Manometer og termometer, med slange og ledning over kanten av vannbadet og ned til bunnplata
  const g = L.gauge;
  const stuss = manometerStuss(g.x, g.y, g.r);
  const plateR = cyl.ro + 5;
  const nip = 0.8 * K;
  const gapIn = bath.R - plateR - nip;
  const overY = bath.rim - 12 * k;
  const nipY = cyl.bottom + baseH * 0.5;
  const nipXL = cyl.cx - plateR - nip;
  const nipXR = cyl.cx + plateR + nip;
  const th = L.thermo;
  const thTop = L.bench - th.h;
  const cableIn = bath.cx - bath.R + 0.42 * gapIn;
  const cableD = routeOverRim({ x: th.x, y: thTop - th.h * 0.06 }, 'venstre', cableIn, overY + 8, bath.rim + 8, nipY - 2, nipXL);
  const tubeIn = L.tubeSide === 'venstre' ? cableIn + 6 * k : bath.cx + bath.R - 0.42 * gapIn;
  const tubeD =
    L.tubeSide === 'venstre'
      ? routeOverRim(stuss, 'venstre', tubeIn, overY, bath.rim, nipY + 2, nipXL)
      : routeOverRim(stuss, 'hoyre', tubeIn, overY, bath.rim, nipY, nipXR);

  // Kreftene på stempelet: trykkraften fra lufta inni (opp) og utenfor (ned), og splinten (ned)
  const Fgas = view.forces === 'likevekt' ? s.Fgas3 : s.Fgas2;
  const fx = cyl.cx + rodW / 2 + 9 * ss;
  const sx = cyl.cx + r * 0.72;
  const N = (v: number) => `${fmt(v, 0)} N`;

  // Energi: arbeidspila opp fra stempelet og varmepiler inn gjennom glasset
  const qY = [gasTop + (cyl.bottom - gasTop) * 0.45, gasTop + (cyl.bottom - gasTop) * 0.78];
  const qLabel = view.heat === 'oppvarming' ? `Q = +${fmt(s.Qheat, 0)} J` : `Q = +${fmt(s.Qexp, 0)} J`;
  const wLen = Math.max(34, s.Wout * 1.6) * Math.min(1.2, k);

  const waterTag = `Vann: ${fmt(tWater, 0)} °C`;
  const gasTag = `Luft: ${fmt(tGas, 1)} °C`;
  const pTag = `p = ${fmt(p / 1000, p < 99950 ? 1 : 0)} kPa`;
  /** Omtrentlig bredde på en tekst i figuren (til plassering ved kanten). */
  const textW = (t: string, size: number) => t.length * 17 * f * size * 0.58;
  const gasTagW = textW(gasTag, 0.9) + 16 * f;
  const gasTagX = Math.max(gasTagW / 2 + 6, th.x);
  const vTag = view.volumeKnown ? `${fmt(V, 2)} L` : 'V = ?';

  const label = (sym: ReactNode, v: number) => (
    <>
      {sym} = {N(v)}
    </>
  );

  return (
    <g>
      <Rom x={0} y={0} w={L.W} h={L.H} gulvY={L.H - 4} gulv="betong" />
      <Underlag x1={0} x2={L.W} y={L.bench} depth={L.H - L.bench} type="labbenk" />

      {/* Manometer og digitalt termometer (manometerslangen bak manometeret) */}
      <Slange d={tubeD} width={3.6} color={SCENE.rubber} />
      <Manometer x={g.x} y={g.y} r={g.r} verdi={p / 1000} maks={200} benk={L.bench} />
      <DigitalTermometer x={th.x} y={L.bench} w={th.w} h={th.h} tekst={`${fmt(tGas, 1)} °C`} />

      {/* Kokeplata og vannbadet */}
      <Kokeplate x={L.bathX} y={L.bench} w={L.plateW} effekt={effekt} />
      <VannbadBak g={bath} />

      {/* Sylinderen */}
      <Slange d={cableD} width={2.6} color={SCENE.rubber} />
      <Bunnplate c={cyl} h={baseH} nippel={nip} sider={L.tubeSide === 'venstre' ? ['venstre'] : ['venstre', 'hoyre']} />
      <SylinderBak c={cyl} />
      <Luft c={cyl} top={gasTop} varme={warmGas} />
      <Partikler c={cyl} top={gasTop} T={tGas + 273.15} halelengde={9 * k} k={k} />
      {view.ghost && <StempelSpor c={cyl} top={pistonTop1} bottom={gasTop1} tekst="før" />}
      <Stempel c={cyl} top={pistonTop} bottom={gasTop} rodTop={rodTop} rodW={rodW} />
      {pinIn && <Splint x1={cyl.cx + cyl.ro + 5} x2={cyl.cx - cyl.ro - 6} y={pinY} d={pinD} fremhev={view.pinFocus} />}
      <SylinderForan c={cyl} hull={pinY} />

      {/* Vannet foran sylinderen, glasset og dampen */}
      <VannbadForan g={bath} hull={{ cx: cyl.cx, r: cyl.ro }} koker={boiling ? 0.9 : hot * 0.25} varme={hot} />
      <Damp x={bath.cx} y={bath.water - 4} w={bath.R * 1.6} mengde={view.phase === 'start' ? 0 : boiling ? 0.9 : 0.4} />
      {!pinIn && <Splint x1={L.pinRest} x2={L.pinRest + 2 * cyl.ro + 11} y={L.bench - pinD / 2 - 0.5} d={pinD} />}

      {/* Skilt: trykket, temperaturen i lufta og i vannet, volumet */}
      <ValueTag x={g.x} y={g.y - g.r - 18 * f} text={pTag} color={VIZ.normal} pointer={6} />
      <ValueTag x={gasTagX} y={thTop - 30 * f} text={gasTag} color={COLOR_Q} pointer={6} />
      {L.waterTag === 'hoyre' ? (
        <Callout x={bath.cx + bath.R - 6} y={bath.floor - 34} lx={bath.cx + bath.R + bath.t + 16} ly={bath.floor - 6} anchor="start">
          {waterTag}
        </Callout>
      ) : (
        <Callout x={bath.cx - bath.R + 5} y={bath.floor - 16} lx={6 + textW(waterTag, 0.85)} ly={thTop - 64 * f} anchor="end">
          {waterTag}
        </Callout>
      )}
      {view.heat === 'ingen' && (
      <ValueTag
        x={Math.min(cyl.cx - r * 0.42, fx - 3.5 * ss - 6 - (textW(vTag, 0.82) + 16 * f) / 2)}
        y={gasTop + (cyl.bottom - gasTop) * 0.5}
        text={vTag}
        color={view.volumeKnown ? VIZ.ink : FOCUS}
        size={0.82}
      />
      )}

      {/* c) og e): kreftene på stempelet */}
      {view.forces !== 'ingen' && (
        <g>
          <ForceArrow
            x1={fx}
            y1={gasTop + Fgas * L.KF}
            x2={fx}
            y2={gasTop}
            color={VIZ.applied}
            label={label(
              <>
                F<TSub>inne</TSub>
              </>,
              Fgas,
            )}
            labelX={fx + 10 * ss}
            labelY={gasTop + Fgas * L.KF * 0.5 + 6}
            labelAnchor="start"
            labelSize={0.85}
          />
          <ForceArrow
            x1={fx}
            y1={pistonTop - s.Fair * L.KF}
            x2={fx}
            y2={pistonTop}
            color={VIZ.applied}
            label={label(
              <>
                F<TSub>ute</TSub>
              </>,
              s.Fair,
            )}
            labelX={fx + 10 * ss}
            labelY={pistonTop - s.Fair * L.KF + 12}
            labelAnchor="start"
            labelSize={0.85}
          />
          {view.forces === 'splint' && (
            <ForceArrow
              x1={sx}
              y1={pistonTop - s.Fpin * L.KF}
              x2={sx}
              y2={pistonTop}
              color={VIZ.normal}
              label={label(
                <>
                  F<TSub>s</TSub>
                </>,
                s.Fpin,
              )}
              labelX={cyl.cx + cyl.ro + 12 * ss}
              labelY={pistonTop + 2}
              labelAnchor="start"
              labelSize={0.85}
            />
          )}
        </g>
      )}

      {/* d): varme inn gjennom glasset, arbeid ut gjennom stempelet */}
      {view.heat !== 'ingen' && (
        <g>
          {qY.map((y, i) => (
            <g key={i}>
              <VarmePil x1={bath.cx - bath.R + 6} y1={y} x2={cyl.cx - cyl.r + 16} y2={y} color={COLOR_Q} width={4.5} />
              <VarmePil x1={bath.cx + bath.R - 6} y1={y} x2={cyl.cx + cyl.r - 16} y2={y} color={COLOR_Q} width={4.5} />
            </g>
          ))}
          <Txt x={bath.cx + bath.R + bath.t + 12} y={qY[0]! + 6} anchor="start" color={COLOR_Q} weight={720} size={0.9}>
            {qLabel}
          </Txt>
          <Txt x={bath.cx + bath.R + bath.t + 12} y={qY[0]! + 6 + 19 * f} anchor="start" size={0.72} muted>
            varme til lufta
          </Txt>
        </g>
      )}
      {view.work === 'null' && (
        <Callout x={cyl.cx + cyl.ro + 8} y={pinY} lx={cyl.cx + cyl.ro + 30} ly={pinY - 26 * f} anchor="start" color={COLOR_W} strong>
          Låst: W = 0
        </Callout>
      )}
      {view.work === 'ut' && (
        <g>
          <ForceArrow
            x1={fx}
            y1={pistonTop}
            x2={fx}
            y2={pistonTop - wLen}
            color={COLOR_W}
            width={9}
            label={`W = −${fmt(s.Wout, 0)} J`}
            labelX={fx + 14 * ss}
            labelY={pistonTop - wLen + 12}
            labelAnchor="start"
          />
          <Txt x={fx + 14 * ss} y={pistonTop - wLen + 12 + 19 * f} anchor="start" size={0.72} muted>
            lufta gjør arbeid
          </Txt>
        </g>
      )}
    </g>
  );
}

/* ---------------------------------------------------------------- Tilstandspanelet */

interface Cell {
  sym: ReactNode;
  value: string | null;
  focus?: boolean;
}

function TilstandPanel({ task, s, view, narrow }: { task: GasTask; s: GasSolution; view: PanelView; narrow: boolean }) {
  const L = narrow ? { W: 490, H: 440 } : { W: 800, H: 186 };
  return (
    <Figure viewBox={`0 0 ${L.W} ${L.H}`} label="Tilstandene til lufta og energiregnskapet for oppvarmingen og utvidelsen." maxHeight={narrow ? 560 : 260}>
      <PanelBody task={task} s={s} view={view} W={L.W} H={L.H} narrow={narrow} />
    </Figure>
  );
}

function PanelBody({ task, s, view, W, H, narrow }: { task: GasTask; s: GasSolution; view: PanelView; W: number; H: number; narrow: boolean }) {
  const f = useTextScale();
  const ss = useStrokeScale();
  const kPa = (v: number) => `${fmt(v / 1000, v < 99950 ? 1 : 0)} kPa`;
  const L1 = (v: number) => `${fmt(v, 2)} L`;
  const K = (T: number) => `${fmt(T, 2)} K`;
  const nTxt = view.n ? `${fmt(s.n, 4)} mol` : null;
  const sub = (a: string, b: string) => (
    <>
      {a}
      <TSub>{b}</TSub>
    </>
  );

  const states: { title: string; cells: Cell[]; shown: boolean }[] = [
    {
      title: '1 Start',
      shown: true,
      cells: [
        { sym: sub('p', '1'), value: kPa(s.p0) },
        { sym: sub('V', '1'), value: L1(task.V1) },
        { sym: sub('T', '1'), value: K(s.T1) },
        { sym: 'n', value: nTxt, focus: view.focus === 'n' },
      ],
    },
    {
      title: '2 Oppvarmet',
      shown: true,
      cells: [
        { sym: sub('p', '2'), value: view.p2 ? `${fmt(s.p2 / 1000, 1)} kPa` : null, focus: view.focus === 'p2' },
        { sym: sub('V', '2'), value: view.V2 ? L1(task.V1) : null, focus: view.focus === 'V2' },
        { sym: sub('T', '2'), value: K(s.T2) },
      ],
    },
    {
      title: '3 Etter utvidelsen',
      shown: view.state3,
      cells: [
        { sym: sub('p', '3'), value: view.p3 ? kPa(s.p3) : null, focus: view.focus === 'p3' },
        { sym: sub('V', '3'), value: view.V3 ? L1(s.V3 * 1000) : null, focus: view.focus === 'V3' },
        { sym: sub('T', '3'), value: view.T3 ? K(s.T3) : null },
      ],
    },
  ];
  const sign = (v: number) => (v > 0 ? `+${fmt(v, 0)}` : v < 0 ? `−${fmt(-v, 0)}` : '0');
  const procs: { title: string; shown: boolean; rows: { sym: ReactNode; value: string | null; color: string; focus?: boolean }[] }[] = [
    {
      title: 'Oppvarming',
      shown: view.proc1,
      rows: [
        { sym: 'W', value: '0', color: COLOR_W },
        { sym: 'Q', value: `${sign(s.Qheat)} J`, color: COLOR_Q },
        { sym: 'ΔU', value: `${sign(s.dUheat)} J`, color: COLOR_U, focus: view.focus === 'dU1' },
      ],
    },
    {
      title: 'Utvidelse',
      shown: view.proc2,
      rows: [
        { sym: 'W', value: `${sign(s.Wexp)} J`, color: COLOR_W, focus: view.focus === 'W2' },
        { sym: 'Q', value: `${sign(s.Qexp)} J`, color: COLOR_Q, focus: view.focus === 'W2' },
        { sym: 'ΔU', value: view.dU2 ? `${sign(s.dUexp)} J` : null, color: COLOR_U, focus: view.focus === 'dU2' },
      ],
    },
  ];

  const lineH = 21 * f;
  const fs = 0.86;

  const box = (x: number, y: number, w: number, h: number, st: (typeof states)[number], cols: 1 | 2) => {
    const active = st.cells.some((c) => c.focus);
    return (
      <g key={st.title} opacity={st.shown ? 1 : 0.45}>
        <rect
          x={x}
          y={y}
          width={w}
          height={h}
          rx={10}
          fill={st.shown ? VIZ.surface : 'none'}
          stroke={active ? FOCUS : VIZ.grid}
          strokeWidth={(active ? 2 : 1.2) * ss}
          strokeDasharray={st.shown ? undefined : `${5 * ss} ${4 * ss}`}
        />
        <Txt x={x + 12} y={y + 8 + 15 * f} anchor="start" weight={700} size={0.82}>
          {st.title}
        </Txt>
        {st.shown &&
          st.cells.map((c, i) => {
            const col = cols === 2 ? i % 2 : 0;
            const row = cols === 2 ? Math.floor(i / 2) : i;
            const cx = x + 12 + col * (w / 2);
            const cy = y + 14 + 15 * f + (row + 1) * lineH;
            return (
              <Txt key={i} x={cx} y={cy} anchor="start" size={fs} color={c.value === null || c.focus ? FOCUS : VIZ.ink} weight={c.focus ? 700 : 500} halo={false}>
                {c.sym} = {c.value ?? '?'}
              </Txt>
            );
          })}
      </g>
    );
  };

  const arrow = (x1: number, y1: number, x2: number, y2: number, shown: boolean) => {
    const ux = Math.sign(x2 - x1);
    const uy = Math.sign(y2 - y1);
    const h = 9 * ss;
    return (
      <g opacity={shown ? 1 : 0.4}>
        <line x1={x1} y1={y1} x2={x2 - ux * h} y2={y2 - uy * h} stroke={VIZ.muted} strokeWidth={2.2 * ss} strokeDasharray={shown ? undefined : `${5 * ss} ${4 * ss}`} />
        <path
          d={`M${x2},${y2}L${x2 - ux * h - uy * h * 0.6},${y2 - uy * h - ux * h * 0.6}L${x2 - ux * h + uy * h * 0.6},${y2 - uy * h + ux * h * 0.6}Z`}
          fill={VIZ.muted}
        />
      </g>
    );
  };

  const procText = (x: number, y: number, pr: (typeof procs)[number], anchor: 'middle' | 'start', inline: boolean) => {
    if (!pr.shown) return null;
    if (inline) {
      // Mobil: én linje med W, Q og ΔU ved siden av pila
      return (
        <g>
          <Txt x={x} y={y} anchor="start" size={0.78} muted>
            {pr.title}
          </Txt>
          <Txt x={x} y={y + lineH} anchor="start" size={fs} halo={false}>
            {pr.rows.map((r, i) => (
              <tspan key={i} style={{ fill: r.value === null || r.focus ? FOCUS : r.color, fontWeight: 700 }}>
                {i > 0 ? '\u2003\u2003' : ''}
                {r.sym} = {r.value ?? '?'}
              </tspan>
            ))}
          </Txt>
        </g>
      );
    }
    return (
      <g>
        {pr.rows.map((r, i) => (
          <Txt key={i} x={x} y={y + i * lineH} anchor={anchor} size={fs} color={r.value === null || r.focus ? FOCUS : r.color} weight={700} halo={false}>
            {r.sym} = {r.value ?? '?'}
          </Txt>
        ))}
      </g>
    );
  };

  if (!narrow) {
    const m = 6;
    const bw = 196;
    const gap = (W - 2 * m - 3 * bw) / 2;
    const top = 30;
    const bh = H - top - 8;
    const xs = [m, m + bw + gap, m + 2 * (bw + gap)];
    const midY = top + 15 + 15 * f + 1.5 * lineH;
    return (
      <g>
        <Txt x={W / 2} y={18} size={0.78} muted>
          Samme luft hele tiden: n er konstant
        </Txt>
        {states.map((st, i) => box(xs[i]!, top, bw, bh, st, 1))}
        {procs.map((pr, i) => {
          const x1 = xs[i]! + bw + 6;
          const x2 = xs[i + 1]! - 6;
          const cx = (x1 + x2) / 2;
          return (
            <g key={pr.title}>
              <Txt x={cx} y={midY - 10} size={0.78} muted>
                {pr.title}
              </Txt>
              {arrow(x1, midY, x2, midY, pr.shown)}
              {procText(cx, midY + 8 + lineH, pr, 'middle', false)}
            </g>
          );
        })}
      </g>
    );
  }

  // Mobil: tilstandene under hverandre, prosessene mellom dem
  const m = 6;
  const bw = W - 2 * m;
  const bh = 22 + 15 * f + 2 * lineH;
  const ph = 18 + 2 * lineH;
  const ys = [8, 8 + bh + ph, 8 + 2 * (bh + ph)];
  return (
    <g>
      {states.map((st, i) => box(m, ys[i]!, bw, bh, st, 2))}
      {procs.map((pr, i) => {
        const y1 = ys[i]! + bh + 4;
        const y2 = ys[i + 1]! - 4;
        return (
          <g key={pr.title}>
            {arrow(m + 26, y1, m + 26, y2, pr.shown)}
            {procText(m + 46, y1 + 4 + 13 * f, pr, 'start', true)}
          </g>
        );
      })}
    </g>
  );
}
