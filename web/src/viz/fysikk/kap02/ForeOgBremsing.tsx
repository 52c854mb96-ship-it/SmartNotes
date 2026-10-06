import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import {
  Controls,
  Dot,
  Explain,
  Figure,
  Formula,
  FormulaLine,
  Legend,
  PlayControls,
  Plot,
  Readout,
  Readouts,
  Segmented,
  Slider,
  Sub,
  Sup,
  Toggle,
  Toolbar,
  Txt,
  VIZ,
  VizLayout,
  fmt,
  useSimClock,
  useTextScale,
} from '../../kit';
import {
  BIL_MAAL,
  Bil,
  Callout,
  Dimension,
  ForceArrow,
  Gran,
  Himmel,
  Landskap,
  Lauvtre,
  Underlag,
  ValueTag,
  Vei,
  hjulvinkelFraStrekning,
  useSvgId,
  type LandskapType,
} from '../../kit/scene';
import { Bremsespor, DekkLupe, HjulSpinn, Kantstolpe, Regn, Snofall, Trafikkjegle } from './fore-og-bremsing-deler';
import {
  BRAKE_RANGES,
  BREMSER,
  BREMSER_NAVN,
  DEKK,
  DEKK_NAVN,
  FORE,
  FORE_NAVN,
  FORE_TEKST,
  FORE_VEI,
  FRIKSJONSTALL,
  allDistances,
  brake,
  brakingDistance,
  frictionCoefficient,
  kmhToMs,
  maxStopSpeed,
  msToKmh,
  playbackSpeed,
  queueOutcome,
  queueState,
  sameDistanceSpeed,
  type BrakeResult,
  type Bremser,
  type Dekk,
  type Fore,
  type QueueOutcome,
  type QueueState,
} from './model-fore-og-bremsing';
import { useNarrow } from './useNarrow';

/**
 * Friksjon og føre (2C, 2E): en bil bremser fullt fra en gitt fart på tørr asfalt, våt asfalt, snø eller is, med
 * sommer- eller vinterdekk, med ABS eller med låste hjul. Friksjonen R = μN er hele kraftsummen, så a = μg og
 * bremselengden blir s = v₀²/(2μg). Scenen følger bilen, og stolpediagrammet sammenligner bremselengdene.
 * Hverdagssituasjonen: en bil står stille i kø d meter foran. Rekker bilen å stoppe, eller treffer den køen med
 * farten v = √(v₀² − 2ad)? Linja i stolpediagrammet viser hvilke føre, dekk og bremser som rekker det.
 */
export default function ForeOgBremsing() {
  const RG = BRAKE_RANGES;
  const [vKmh, setVKmh] = useState<number>(RG.v.start);
  const [m, setM] = useState<number>(RG.m.start);
  const [fore, setFore] = useState<Fore>('sno');
  const [dekk, setDekk] = useState<Dekk>('vinter');
  const [bremser, setBremser] = useState<Bremser>('abs');
  const [showForces, setShowForces] = useState(true);
  const [queueOn, setQueueOn] = useState(true);
  const [d, setD] = useState<number>(RG.d.start);

  const v0 = kmhToMs(vKmh);
  const mu = frictionCoefficient(fore, dekk, bremser);
  const res = brake(v0, mu, m);
  // Med bil i kø slutter bevegelsen når bilen står stille eller treffer køen.
  const queue = queueOn ? queueOutcome(v0, mu, d) : null;
  const tEnd = queue ? queue.tEnd : res.t;
  const clock = useSimClock({ tMax: tEnd, speed: playbackSpeed(tEnd) });
  const { setT, pause } = clock;

  // Når siden åpnes, står bilen midt i oppbremsingen, så både bremsesporene og kreftene synes.
  const started = useRef(false);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    setT(0.4 * tEnd);
  }, [tEnd, setT]);

  const tStep = timeStep(tEnd);
  const tSliderMax = Math.floor(tEnd / tStep + 1e-9) * tStep;
  // Helt i enden av tidsbryteren står bilen stille (eller har truffet køen).
  const t = clock.t >= tSliderMax - tStep / 2 ? tEnd : Math.min(clock.t, tEnd);

  // Når tiden bevegelsen tar endres: sto bilen stille (eller hadde truffet køen), blir den stående i enden. Er det
  // bare køen som er slått av eller på eller flyttet, fortsetter vi fra samme øyeblikk. Ny fart, nytt føre eller
  // nye dekk: bilen er like langt ut i oppbremsingen (samme andel av tiden).
  const prevView = useRef({ tEnd, tBrake: res.t, atEnd: false });
  const tNow = useRef(clock.t);
  tNow.current = clock.t;
  useLayoutEffect(() => {
    const prev = prevView.current;
    if (prev.tEnd !== tEnd) {
      const tn = tNow.current;
      if (prev.atEnd) setT(tEnd);
      else if (prev.tBrake === res.t) setT(Math.min(tn, tEnd));
      else setT(prev.tEnd > 0 ? Math.min(1, tn / prev.tEnd) * tEnd : 0);
    }
    prevView.current = { tEnd, tBrake: res.t, atEnd: prev.tEnd === tEnd && t >= tEnd };
  });
  const st = queueState(v0, mu, m, t, queueOn ? d : null);
  const speed = playbackSpeed(tEnd);

  const [ref, narrow] = useNarrow<HTMLDivElement>();
  const other: Bremser = bremser === 'abs' ? 'laast' : 'abs';
  const sOther = brakingDistance(v0, frictionCoefficient(fore, dekk, other));
  const muSym = bremser === 'abs' ? 's' : 'k';

  return (
    <VizLayout>
      <Controls>
        <Slider
          label={
            <>
              Fart v<Sub>0</Sub>
            </>
          }
          ariaLabel="Fart før bremsingen"
          value={vKmh}
          onChange={setVKmh}
          min={RG.v.min}
          max={RG.v.max}
          step={RG.v.step}
          unit="km/h"
        />
        <Slider label="Masse m (bil med fører)" value={m} onChange={setM} min={RG.m.min} max={RG.m.max} step={RG.m.step} unit="kg" />
        {queueOn && <Slider label="Avstand til bilen i kø d" value={d} onChange={setD} min={RG.d.min} max={RG.d.max} step={RG.d.step} unit="m" />}
        <Slider
          label="Tid t"
          value={Math.min(t, tSliderMax)}
          onChange={(v) => {
            pause();
            setT(v >= tSliderMax - tStep / 2 ? tEnd : v);
          }}
          min={0}
          max={tSliderMax}
          step={tStep}
          format={() => `${fmt(t, tStep < 0.1 ? 2 : 1)} s`}
        />
      </Controls>
      <Toolbar>
        <Segmented<Fore> label="Velg føre" options={FORE.map((f) => ({ value: f, label: FORE_NAVN[f] }))} value={fore} onChange={setFore} />
        <Segmented<Dekk> label="Velg dekk" options={DEKK.map((d) => ({ value: d, label: DEKK_NAVN[d] }))} value={dekk} onChange={setDekk} />
        <Segmented<Bremser> label="Velg bremser" options={BREMSER.map((b) => ({ value: b, label: BREMSER_NAVN[b] }))} value={bremser} onChange={setBremser} />
      </Toolbar>
      <Toolbar>
        <PlayControls clock={{ ...clock, t }} decimals={tStep < 0.1 ? 2 : 1} />
        {speed > 1.05 && <span className="viz-play-note">Spilles av {fmt(speed, 1)} ganger så fort</span>}
        <Toggle label="Vis krefter" checked={showForces} onChange={setShowForces} />
        <Toggle label="Bil i kø foran" checked={queueOn} onChange={setQueueOn} />
      </Toolbar>

      <div ref={ref}>
        <BrakeScene
          fore={fore}
          dekk={dekk}
          bremser={bremser}
          res={res}
          st={st}
          queue={queue && { d, ...queue }}
          showForces={showForces}
          narrow={narrow}
        />
        <DistanceChart v0={v0} vKmh={vKmh} fore={fore} dekk={dekk} bremser={bremser} s={st.s} d={queueOn ? d : null} narrow={narrow} />
      </div>
      <Legend
        items={[
          { color: VIZ.series[1], label: 'Sommerdekk' },
          { color: VIZ.series[0], label: 'Vinterdekk' },
          { color: VIZ.ink, label: bremser === 'abs' ? 'Med låste hjul (valgt føre og dekk)' : 'Med ABS (valgt føre og dekk)', dashed: true },
        ]}
      />

      <Readouts>
        <Readout
          label={
            <span>
              Friksjonstall μ<Sub>{muSym}</Sub>
            </span>
          }
          value={fmt(mu, 2)}
        />
        <Readout label="Bremsekraft R = μmg" value={fmt(res.R, 0)} unit="N" tone={VIZ.friction} />
        <Readout label="Bremseakselerasjon a = μg" value={fmt(res.a, 2)} unit="m/s²" tone={VIZ.acceleration} />
        <Readout label="Bremselengde s" value={fmtLen(res.s)} unit="m" />
      </Readouts>

      <Formula label="Utregning">
        <FormulaLine>
          v<Sub>0</Sub> = {fmt(vKmh, 0)} km/h = {fmt(vKmh, 0)}/3,6 m/s = {fmt(v0, 1)} m/s
        </FormulaLine>
        <FormulaLine>
          N = G = mg = {fmt(m, 0)} kg · 9,81 m/s² = {fmt(res.N, 0)} N
        </FormulaLine>
        <FormulaLine>
          ΣF = R = μ<Sub>{muSym}</Sub>N = {fmt(mu, 2)} · {fmt(res.N, 0)} N = {fmt(res.R, 0)} N
        </FormulaLine>
        <FormulaLine>
          a = ΣF/m = {fmt(res.R, 0)} N/{fmt(m, 0)} kg = {fmt(res.a, 2)} m/s² bakover (= μg)
        </FormulaLine>
        <FormulaLine>
          s = v<Sub>0</Sub>
          <Sup>2</Sup>/(2a) = ({fmt(v0, 1)} m/s)²/(2 · {fmt(res.a, 2)} m/s²) = {fmtLen(res.s)} m
        </FormulaLine>
        <FormulaLine>
          t = v<Sub>0</Sub>/a = ({fmt(v0, 1)} m/s)/({fmt(res.a, 2)} m/s²) = {fmt(res.t, 1)} s
        </FormulaLine>
        {queue &&
          (queue.stops ? (
            <FormulaLine>
              d − s = {fmt(d, 0)} m − {fmt(res.s, 1)} m = {fmt(d - res.s, 1)} m, så bilen stopper før køen
            </FormulaLine>
          ) : (
            <FormulaLine>
              s &gt; d: v = √(v<Sub>0</Sub>
              <Sup>2</Sup> − 2ad) = √(({fmt(v0, 1)} m/s)² − 2 · {fmt(res.a, 2)} m/s² · {fmt(d, 0)} m) = {fmt(queue.vHit, 1)} m/s ={' '}
              {fmt(msToKmh(queue.vHit), 0)} km/h i sammenstøtet
            </FormulaLine>
          ))}
      </Formula>

      <Explain>
        <ExplainText
          fore={fore}
          dekk={dekk}
          bremser={bremser}
          vKmh={vKmh}
          m={m}
          v0={v0}
          res={res}
          st={st}
          sOther={sOther}
          queue={queue && { d, ...queue }}
        />
      </Explain>
    </VizLayout>
  );
}

/** Steget på tidsbryteren: ca. 200 steg over bremsetiden, i pene verdier. */
function timeStep(tStop: number): number {
  const raw = tStop / 200;
  for (const s of [0.01, 0.02, 0.05, 0.1, 0.2, 0.5, 1]) if (s >= raw) return s;
  return 1;
}

/** Lengder: én desimal under 100 m, ellers hele meter. */
function fmtLen(s: number): string {
  return fmt(s, s < 100 ? 1 : 0);
}

/* ---------- Scenen: bilen på veien, kameraet følger bilen ---------- */

const W = 800;
const H = 460;
const HORIZON = 222;
/** Der hjulene står (midt i det nærmeste kjørefeltet), og hvor bred veibanen ser ut i perspektiv. */
const ROAD_Y = 334;
const ROAD_W = 56;
const ROAD_TOP = ROAD_Y - 0.7 * ROAD_W;
const ROAD_BOT = ROAD_Y + 0.3 * ROAD_W;
/** Der veikanten foran veien begynner (som i Vei: forkanten av veibanen pluss en smal stripe). */
const NEAR_EDGE = ROAD_BOT + 0.18 * ROAD_W;
const CAR_SIZE = 250;
/** Piksler per meter i scenen (bilen er 4,4 m lang). */
const PX_PER_M = CAR_SIZE / BIL_MAAL.lengde;
/** Midten av bilen (ankerpunktet) i figuren. Kameraet følger bilen, så den står her hele tiden. */
const CAR_X = 300;
const CG_Y = ROAD_Y - BIL_MAAL.tyngdepunkt * PX_PER_M;
/** Én skala for alle kreftene: den tyngste bilen får en G-pil på 126 px. */
const PX_PER_N = 126 / (BRAKE_RANGES.m.max * 9.81);
/** Fart og akselerasjon (egne skalaer): 8 px per m/s og 15 px per m/s². */
const PX_PER_V = 8;
const PX_PER_A = 15;
/** Der fart- og akselerasjonspilene begynner (litt til høyre for N-pila). */
const KIN_X = CAR_X + 50;
const V_Y = 200;
const A_Y = 228;
/** Hjulene: avstanden fra midten, høyden til navet og radiusen til felgen (som i Bil). */
const WHEEL_DX = (BIL_MAAL.akselavstand / 2) * PX_PER_M;
const WHEEL_R = BIL_MAAL.hjulradius * PX_PER_M;
const RIM_R = (20.5 / 440) * CAR_SIZE;

/** Utsnittet på PC (uten den øverste, tomme delen av himmelen) og på mobil (bilen, pilene og skiltene blir større). */
const WIDE_VIEW = { x: 0, y: 56, w: W, h: H - 56 };
const NARROW_VIEW = { x: 160, y: 118, w: 500, h: H - 118 };
/** Lupen som forstørrer kontaktflaten under forhjulet (nede til høyre, i veikanten foran veien). */
const LUPE = { x: 596, y: 398, r: 58 };

const LANDSKAP: Record<Fore, LandskapType> = { torr: 'aaser', vaat: 'kyst', sno: 'skog', is: 'fjell' };

/** Bilen i kø: avstanden d (m) fra der bremsingen starter, og hvordan det går. */
type Queue = QueueOutcome & { d: number };

interface SceneProps {
  fore: Fore;
  dekk: Dekk;
  bremser: Bremser;
  res: BrakeResult;
  st: QueueState;
  queue: Queue | null;
  showForces: boolean;
  narrow: boolean;
}

function sceneLabel(fore: Fore, bremser: Bremser, st: QueueState, queue: Queue | null): string {
  const what = `En bil bremser fullt på ${FORE_TEKST[fore]} ${bremser === 'abs' ? 'med ABS' : 'med låste hjul'}`;
  const where = queue ? `, og en bil står stille i kø ${fmt(queue.d, 0)} m foran.` : '.';
  const now = st.crashed
    ? `Den treffer bilen i køen i ${fmt(msToKmh(queue?.vHit ?? 0), 0)} km/h.`
    : st.stopped
      ? `Den står stille etter ${fmtLen(st.s)} m${queue ? `, ${fmtLen(queue.gap)} m før køen` : ''}.`
      : `Etter ${fmtLen(st.s)} m er farten ${fmt(msToKmh(st.v), 0)} km/h.`;
  return `${what}${where} ${now}`;
}

function BrakeScene({ fore, dekk, bremser, res, st, queue, showForces, narrow }: SceneProps) {
  const view = narrow ? NARROW_VIEW : WIDE_VIEW;
  const clip = useSvgId('fore-utsnitt');
  return (
    <Figure viewBox={`${view.x} ${view.y} ${view.w} ${view.h}`} label={sceneLabel(fore, bremser, st, queue)} maxHeight={500}>
      {/* Alt klippes til utsnittet, så trær og bremsespor utenfor ikke synes ved siden av figuren. */}
      <defs>
        <clipPath id={clip}>
          <rect x={view.x} y={view.y} width={view.w} height={view.h} />
        </clipPath>
      </defs>
      <g clipPath={`url(#${clip})`}>
        <Backdrop fore={fore} camera={st.s * PX_PER_M} />
        <RoadContent fore={fore} dekk={dekk} bremser={bremser} res={res} st={st} queue={queue} showForces={showForces} view={view} />
      </g>
    </Figure>
  );
}

/** Himmel, landskap, vei og trær. Alt ruller med kameraet (forskyvning i piksler). */
function Backdrop({ fore, camera }: { fore: Fore; camera: number }) {
  const winter = fore === 'sno' || fore === 'is';
  const sol = fore === 'torr' ? { x: 640, y: 74, r: 26 } : fore === 'is' ? { x: 690, y: 118, r: 24 } : undefined;
  const skyer = fore === 'vaat' ? 4 : fore === 'sno' ? 3 : fore === 'is' ? 1 : 2;
  return (
    <g>
      <Himmel w={W} h={HORIZON + 2} sol={sol} skyer={skyer} seed={fore === 'vaat' ? 6 : 3} forskyvning={camera} />
      <Landskap x={0} y={HORIZON} w={W} h={110} type={LANDSKAP[fore]} seed={2} forskyvning={camera} />
      {fore === 'vaat' && <Regn x={0} y={0} w={W} h={HORIZON + 40} forskyvning={camera} />}
      {fore === 'sno' && <Snofall x={0} y={0} w={W} h={HORIZON + 30} forskyvning={camera} />}
      <Vei x1={0} x2={W} y={ROAD_Y} bredde={ROAD_W} type={FORE_VEI[fore]} horisont={HORIZON} depth={0.5 * ROAD_W} forskyvning={camera} seed={4} />
      {/* Veikanten foran veien fortsetter helt ned til kanten av figuren (ikke et snitt ned i jorda). */}
      <Underlag x1={0} x2={W} y={H - 1} depth={2} type={winter ? 'sno' : 'gress'} horisont={NEAR_EDGE} forskyvning={camera} seed={5} />
      <Trees winter={winter} camera={camera} />
    </g>
  );
}

/** Trær på den bakre veikanten. De står lenger unna enn veien, så de ruller saktere (parallakse). */
const TREES = [
  { u: 40, y: 262, size: 104, kind: 'gran' },
  { u: 150, y: 252, size: 80, kind: 'lauv' },
  { u: 520, y: 266, size: 118, kind: 'gran' },
  { u: 600, y: 256, size: 92, kind: 'gran' },
  { u: 930, y: 260, size: 96, kind: 'lauv' },
  { u: 1180, y: 254, size: 84, kind: 'gran' },
] as const;
const TREE_PERIOD = 1400;
const TREE_PARALLAX = 0.65;

function Trees({ winter, camera }: { winter: boolean; camera: number }) {
  const shift = camera * TREE_PARALLAX;
  return (
    <g>
      {TREES.map((tr, i) => {
        const x = ((((tr.u - shift) % TREE_PERIOD) + TREE_PERIOD) % TREE_PERIOD) - 150;
        if (x < -80 || x > W + 80) return null;
        return winter || tr.kind === 'gran' ? (
          <Gran key={i} x={x} y={tr.y} size={tr.size} sno={winter} seed={i + 1} />
        ) : (
          <Lauvtre key={i} x={x} y={tr.y} size={tr.size} seed={i + 1} />
        );
      })}
    </g>
  );
}

/** Bredden på et ValueTag (samme regel som i scene-kit-et), så to skilt kan stå ved siden av hverandre. */
function tagWidth(text: string, f: number, size = 0.9): number {
  const fs = 17 * f * size;
  return Math.max(fs * 1.6, text.length * fs * 0.6 + 16 * f);
}

function RoadContent({ fore, dekk, bremser, res, st, queue, showForces, view }: Omit<SceneProps, 'narrow'> & { view: { x: number; y: number; w: number; h: number } }) {
  const f = useTextScale();
  const s = st.s;
  // Verdenskoordinat w (m): 0 er der fronten av bilen var da bremsingen startet.
  const X = (w: number) => CAR_X + (w - s + BIL_MAAL.foran) * PX_PER_M;
  const left = view.x - 20;
  const right = view.x + view.w + 20;
  const locked = bremser === 'laast';

  // Kantstolper hver 10. meter på den bakre veikanten.
  const posts: number[] = [];
  for (let k = Math.floor((s - 12) / 10); k <= Math.ceil((s + 12) / 10); k++) {
    const x = X(k * 10 - 5);
    if (x > left && x < right) posts.push(x);
  }
  const startX = X(0);

  // Hjulene: der de var da bremsingen startet, og der de er nå (verdenskoordinater).
  const front0 = -BIL_MAAL.foran + BIL_MAAL.akselavstand / 2;
  const rear0 = -BIL_MAAL.foran - BIL_MAAL.akselavstand / 2;

  // Punktet streken fra «Bremsespor» peker på: på sporet bak bakhjulet, når det er langt nok til å synes.
  const skidStart = Math.max(view.x + 30, X(rear0));
  const skidEnd = CAR_X - WHEEL_DX - WHEEL_R - 6;
  const skidCallout = skidEnd - skidStart > 60 ? Math.max(skidStart + 12, Math.min(skidEnd - 12, view.x + 70)) : null;

  // Skiltene øverst: farten og strekningen til venstre, køen til høyre.
  const speedText = st.crashed ? 'Kollisjon' : st.stopped ? 'Står stille' : `${fmt(msToKmh(st.v), 0)} km/h`;
  const distText = `s = ${fmtLen(s)} m`;
  const tagY = view.y + 24 * Math.max(1, f * 0.9);
  const tagX = view.x + 14;

  // Bilen i kø: bakenden står d meter foran der fronten vår var da bremsingen startet.
  const queueRear = queue ? X(queue.d) : null;
  const frontX = X(s);
  const gap = queue ? Math.max(0, queue.d - s) : 0;
  const queueVisible = queueRear !== null && queueRear < view.x + view.w - 26 * f;
  let queueText: string | null = null;
  if (queue) {
    if (st.crashed) queueText = `Traff i ${fmt(msToKmh(queue.vHit), 0)} km/h`;
    else if (st.stopped) queueText = queue.gap < 0.05 ? 'Stoppet akkurat i tide' : `Stoppet ${fmtLen(queue.gap)} m før`;
    else if (!queueVisible) queueText = `Bilen i kø: ${fmtLen(gap)} m →`;
  }
  const dimY = ROAD_Y - 0.62 * PX_PER_M;

  // Etiketten til R står på linje med pila, til venstre for spissen (bare symbolet når det ikke er plass til tallet).
  const rY = ROAD_Y + 9;
  const rTip = CAR_X - 6 - st.R * PX_PER_N;
  const rText = `R = ${fmt(st.R, 0)} N`;
  const rLabel = rTip - 8 - rText.length * 17 * f * 0.68 > view.x + 14 ? rText : 'R';

  return (
    <g>
      {posts.map((x) => (
        <Kantstolpe key={Math.round(x * 10)} x={x} y={ROAD_TOP - 1} h={0.95 * PX_PER_M * 0.82} />
      ))}

      {/* Kjeglene der bremsingen startet (den bakre står i veikanten bak veien) */}
      {startX > left && startX < right && <Trafikkjegle x={startX + 3} y={ROAD_TOP - 2} h={0.5 * PX_PER_M * 0.85} />}

      {/* Bilen som står stille i kø (med bremselysene på), når den er i bildet */}
      {queueRear !== null && queueRear < right && (
        <Bil
          x={queueRear + BIL_MAAL.bak * PX_PER_M}
          y={ROAD_Y}
          size={CAR_SIZE}
          lakk="blaa"
          type="stasjonsvogn"
          bremselys
          title="Bil som står stille i kø"
        />
      )}

      {/* Bremsespor fra låste hjul: fra der hjulene låste seg til der de er nå (bakhjulet går i sporet til forhjulet) */}
      {locked && s > 0.02 && (
        <g>
          <Bremsespor x1={Math.max(left, X(rear0))} x2={X(rear0 + s)} y={ROAD_Y - 1} w={6} type={FORE_VEI[fore]} />
          <Bremsespor x1={Math.max(left, X(front0))} x2={X(front0 + s)} y={ROAD_Y - 1} w={6} type={FORE_VEI[fore]} />
        </g>
      )}

      <Bil
        x={CAR_X}
        y={ROAD_Y}
        size={CAR_SIZE}
        lakk="rod"
        bremselys
        hjulvinkel={locked ? 0 : hjulvinkelFraStrekning(s)}
        title={locked ? 'Bil med låste hjul som sklir' : 'Bil med ABS: hjulene ruller mens den bremser'}
      />
      {!locked &&
        [-1, 1].map((side) => (
          <HjulSpinn key={side} cx={CAR_X + side * WHEEL_DX} cy={ROAD_Y - WHEEL_R} r={RIM_R} amount={Math.min(1, st.v / 6)} />
        ))}

      {startX > left && startX < right && <Trafikkjegle x={startX - 2} y={ROAD_BOT + 8} h={0.5 * PX_PER_M} />}

      <DekkLupe
        cx={LUPE.x}
        cy={LUPE.y}
        r={LUPE.r}
        tx={CAR_X + WHEEL_DX}
        ty={ROAD_Y - 1}
        tr={9}
        type={FORE_VEI[fore]}
        dekk={dekk}
        ruller={!locked}
        stille={st.stopped}
        vinkel={locked ? 0 : hjulvinkelFraStrekning(s)}
        tekst={st.stopped ? 'I ro' : locked ? 'Sklir' : 'Ruller'}
      />

      {/* Avstanden mellom støtfangerne når bilen i kø er i bildet */}
      {queueRear !== null && queueVisible && !st.crashed && gap > 0.15 && (
        <Dimension x1={frontX} y1={dimY} x2={queueRear} y2={dimY} label={`${fmt(gap, 1)} m`} labelSize={0.85} />
      )}

      {showForces && (
        <g>
          <ForceArrow
            x1={CAR_X}
            y1={CG_Y}
            x2={CAR_X}
            y2={CG_Y - res.N * PX_PER_N}
            color={VIZ.normal}
            label="N"
            labelAnchor="end"
            labelX={CAR_X - 10 * f}
            labelY={CG_Y - res.N * PX_PER_N + 14 * f}
          />
          <ForceArrow x1={CAR_X} y1={CG_Y} x2={CAR_X} y2={CG_Y + res.G * PX_PER_N} color={VIZ.gravity} label="G" origin />
          {st.R > 0 && (
            <ForceArrow
              x1={CAR_X - 6}
              y1={rY}
              x2={rTip}
              y2={rY}
              color={VIZ.friction}
              minLength={0.5}
              label={rLabel}
              labelAnchor="end"
              labelX={rTip - 8}
              labelY={rY + 6 * f}
            />
          )}
          {st.v > 0.05 && <ForceArrow x1={KIN_X} y1={V_Y} x2={KIN_X + st.v * PX_PER_V} y2={V_Y} color={VIZ.velocity} width={6} label="v" />}
          {st.a > 0 && (
            <ForceArrow
              x1={KIN_X + st.a * PX_PER_A}
              y1={A_Y}
              x2={KIN_X}
              y2={A_Y}
              color={VIZ.acceleration}
              width={5}
              minLength={0.5}
              label="a"
              labelAnchor="start"
              labelX={KIN_X + st.a * PX_PER_A + 10 * f}
              labelY={A_Y + 6 * f}
            />
          )}
        </g>
      )}

      {/* Navn på bremsesporet, når en del av det synes bak bilen */}
      {locked && skidCallout !== null && (
        <Callout x={skidCallout} y={ROAD_Y - 1} lx={view.x + 14} ly={view.y + view.h - 14} anchor="start" size={0.8}>
          Bremsespor
        </Callout>
      )}

      <ValueTag x={tagX} y={tagY} anchor="start" text={speedText} color={st.stopped ? undefined : VIZ.velocity} />
      <ValueTag x={tagX + tagWidth(speedText, f) + 8 * f} y={tagY} anchor="start" text={distText} />
      {queueText !== null && (
        <ValueTag x={view.x + view.w - 14} y={tagY} anchor="end" text={queueText} color={st.crashed ? VIZ.velocity : undefined} />
      )}
    </g>
  );
}

/* ---------- Stolpediagrammet: bremselengden på alle førene, med sommer- og vinterdekk ---------- */

/** Pen øvre grense for aksen (100, 120, 150, 200, 250, 300, 400, 500, 600, 800, 1000 …). */
function axisMax(v: number): number {
  const mag = 10 ** Math.floor(Math.log10(Math.max(v, 1e-9)));
  for (const n of [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10]) if (n * mag >= v - 1e-9) return n * mag;
  return 10 * mag;
}

const TYRE_COLOR: Record<Dekk, string> = { sommer: VIZ.series[1], vinter: VIZ.series[0] };

interface ChartProps {
  v0: number;
  vKmh: number;
  fore: Fore;
  dekk: Dekk;
  bremser: Bremser;
  /** Hvor langt bilen har bremset (m), som et punkt på den valgte stolpen. */
  s: number;
  /** Avstanden til bilen i kø (m), som en loddrett linje, eller null. */
  d: number | null;
  narrow: boolean;
}

function DistanceChart(props: ChartProps) {
  const { v0, narrow, d } = props;
  const all = allDistances(v0);
  // Aksen er den samme for ABS og låste hjul, så stolpene kan sammenlignes når du bytter. Køen er alltid med.
  let longest = d ?? 0;
  for (const f of FORE) for (const dk of DEKK) longest = Math.max(longest, all[f][dk].laast);
  const top = axisMax(longest / 0.86);
  const ch = narrow ? 640 : 340;
  return (
    <Figure viewBox={`0 0 800 ${ch}`} label={`Stolpediagram over bremselengden fra ${fmt(props.vKmh, 0)} km/h på fire føre, med sommer- og vinterdekk`} maxHeight={narrow ? 560 : 360}>
      <ChartContent {...props} all={all} top={top} ch={ch} />
    </Figure>
  );
}

function ChartContent({ vKmh, fore, dekk, bremser, s, d, narrow, all, top, ch }: ChartProps & { all: ReturnType<typeof allDistances>; top: number; ch: number }) {
  const f = useTextScale();
  // Med kø står navnet på linja mellom tittelen og plottet, så toppmargen er litt større.
  const mTop = (d !== null ? 62 : 46) * f;
  const margin = narrow ? { top: mTop, right: 20 * f, bottom: 56 * f, left: 18 } : { top: mTop, right: 24 * f, bottom: 56 * f, left: 150 };
  const title = `Bremselengde fra ${fmt(vKmh, 0)} km/h ${bremser === 'abs' ? 'med ABS' : 'med låste hjul'}`;
  return (
    <>
      <Txt x={16} y={26 * f} anchor="start" weight={700} size={0.95}>
        {title}
      </Txt>
      <Plot x={{ min: 0, max: top, label: 'Bremselengde s (m)' }} y={{ min: 0, max: FORE.length, label: '', ticks: [] }} width={800} height={ch} margin={margin}>
        {({ sx, sy, x0 }) => {
          const lineX = d !== null ? sx(d) : null;
          // Mobil: navnet på føret står over stolpene. Krysser linja for køen navnet, får linja et opphold der.
          const labelH = narrow ? 24 * f : 0;
          const skip: [number, number][] = [];
          if (narrow && lineX !== null) {
            for (const [i, fr] of FORE.entries()) {
              const w = FORE_NAVN[fr].length * 17 * f * 0.9 * 0.62;
              const base = sy(FORE.length - i) + 18 * f;
              if (lineX > x0 - 4 && lineX < x0 + w + 4) skip.push([base - 17 * f, base + 5 * f]);
            }
          }
          return (
            <g>
              {/* Linja for køen tegnes først: stolper som går forbi den, betyr sammenstøt, og tallene skal ligge oppå */}
              {d !== null && lineX !== null && <QueueLine x={lineX} y0={sy(FORE.length)} y1={sy(0)} d={d} xMin={x0} xMax={sx(top)} skip={skip} />}
              {FORE.map((fr, i) => {
                const rowTop = sy(FORE.length - i);
                const rowBot = sy(FORE.length - i - 1);
                const selectedRow = fr === fore;
                // Mobil: navnet over stolpene. PC: navnet til venstre.
                const bh = Math.min(narrow ? 24 * f : 18, (rowBot - rowTop - labelH) * 0.36);
                const mid = (rowTop + labelH + rowBot) / 2;
                return (
                  <g key={fr}>
                    <Txt
                      x={narrow ? x0 : x0 - 12}
                      y={narrow ? rowTop + 18 * f : mid + 6}
                      anchor={narrow ? 'start' : 'end'}
                      weight={selectedRow ? 720 : 560}
                      muted={!selectedRow}
                      size={0.9}
                    >
                      {FORE_NAVN[fr]}
                    </Txt>
                    {DEKK.map((dk, j) => {
                      const cy = mid + (j === 0 ? -1 : 1) * (bh / 2 + 3);
                      const len = all[fr][dk][bremser];
                      const lenOther = all[fr][dk][bremser === 'abs' ? 'laast' : 'abs'];
                      const selected = selectedRow && dk === dekk;
                      const end = sx(Math.min(len, top));
                      const text = `${fmtLen(len)} m`;
                      // Tallet står etter stolpen, men hopper forbi linja for køen hvis det ellers ville krysset den.
                      let labelX = Math.max(end, selected ? sx(Math.min(lenOther, top)) : end) + 8;
                      const textW = text.length * 17 * f * 0.8 * 0.62;
                      if (lineX !== null && labelX - 4 < lineX && labelX + textW + 4 > lineX) labelX = lineX + 8;
                      return (
                        <g key={dk} opacity={selectedRow ? 1 : 0.5}>
                          <rect x={x0} y={cy - bh / 2} width={Math.max(1.5, end - x0)} height={bh} rx={Math.min(4, bh / 3)} fill={TYRE_COLOR[dk]} />
                          {selected && (
                            <>
                              <rect
                                x={x0}
                                y={cy - bh / 2 - 2}
                                width={Math.max(1.5, sx(Math.min(lenOther, top)) - x0)}
                                height={bh + 4}
                                rx={Math.min(5, bh / 3)}
                                fill="none"
                                stroke={VIZ.ink}
                                strokeWidth={1.6}
                                strokeDasharray="6 4"
                              />
                              <rect x={x0} y={cy - bh / 2} width={Math.max(1.5, end - x0)} height={bh} rx={Math.min(4, bh / 3)} fill="none" stroke={VIZ.ink} strokeWidth={2} />
                            </>
                          )}
                          <Txt x={labelX} y={cy + 5.5 * f} anchor="start" size={0.8} weight={selected ? 720 : 600} muted={!selected}>
                            {text}
                          </Txt>
                          {selected && <Dot x={sx(Math.min(Math.max(0, s), top))} y={cy} r={6.5} color={VIZ.ink} />}
                        </g>
                      );
                    })}
                  </g>
                );
              })}
            </g>
          );
        }}
      </Plot>
    </>
  );
}

/**
 * Loddrett linje i stolpediagrammet der bilen i kø står. Stolper som går forbi linja, betyr sammenstøt.
 * Navnet står over plottet, midt over linja, men aldri utenfor plottet.
 */
function QueueLine({
  x,
  y0,
  y1,
  d,
  xMin,
  xMax,
  skip,
}: {
  x: number;
  y0: number;
  y1: number;
  d: number;
  xMin: number;
  xMax: number;
  /** Høyder (fra, til) der linja har et opphold, f.eks. der den ville krysset navnet på et føre. */
  skip: [number, number][];
}) {
  const f = useTextScale();
  const text = `Bilen i kø: ${fmt(d, 0)} m`;
  const half = (text.length * 17 * f * 0.85 * 0.58) / 2;
  const lx = Math.min(Math.max(x, xMin + half), xMax - half);
  // Linja som én sti med opphold
  let path = '';
  let from = y0 - 4 * f;
  for (const [a, b] of [...skip].sort((p, q) => p[0] - q[0])) {
    if (a > from) path += `M${x},${from}V${a}`;
    from = Math.max(from, b);
  }
  if (y1 > from) path += `M${x},${from}V${y1}`;
  return (
    <g>
      <path d={path} stroke={VIZ.surface} strokeWidth={5} opacity={0.85} />
      <path d={path} stroke={VIZ.ink} strokeWidth={2} />
      <Txt x={lx} y={y0 - 9 * f} anchor="middle" size={0.85} weight={700}>
        {text}
      </Txt>
    </g>
  );
}

/* ---------- Forklaringen ---------- */

interface ExplainProps {
  fore: Fore;
  dekk: Dekk;
  bremser: Bremser;
  vKmh: number;
  m: number;
  v0: number;
  res: BrakeResult;
  st: QueueState;
  sOther: number;
  queue: Queue | null;
}

function ExplainText({ fore, dekk, bremser, vKmh, m, v0, res, st, sOther, queue }: ExplainProps) {
  const winter = fore === 'sno' || fore === 'is';
  const muS = FRIKSJONSTALL[fore][dekk].muS;
  const muK = FRIKSJONSTALL[fore][dekk].muK;
  const otherTyre: Dekk = dekk === 'sommer' ? 'vinter' : 'sommer';
  const sOtherTyre = brakingDistance(v0, frictionCoefficient(fore, otherTyre, bremser));
  const muTorr = frictionCoefficient('torr', dekk, bremser);
  const mu = frictionCoefficient(fore, dekk, bremser);
  const vLow = vKmh - 20;
  const sLow = brakingDistance(kmhToMs(vLow), mu);
  const vSame = sameDistanceSpeed(vKmh, muTorr, mu);
  const setup = `på ${FORE_TEKST[fore]} med ${DEKK_NAVN[dekk].toLowerCase()} og ${bremser === 'abs' ? 'ABS' : 'låste hjul'}`;

  let moment: ReactNode;
  if (st.crashed && queue) {
    const vHit = msToKmh(queue.vHit);
    moment = (
      <p>
        <strong>Bilen treffer bilen i køen i {fmt(vHit, 0)} km/h.</strong> Bremselengden er {fmtLen(res.s)} m, men køen står bare{' '}
        {fmt(queue.d, 0)} m foran. Der har bilen fortsatt farten v = √(v<Sub>0</Sub>
        <Sup>2</Sup> − 2ad) = {fmt(vHit, 0)} km/h, {fmt((100 * vHit) / vKmh, 0)} % av farten den hadde.{' '}
        {res.s - queue.d < 0.25 * res.s ? (
          <>
            Bremselengden er bare {fmtLen(res.s - queue.d)} m for lang, men bilen mister mest fart på de siste metrene før den stopper, så
            farten i sammenstøtet blir likevel stor.
          </>
        ) : (
          <>Farten avtar lite på de første metrene, der bilen kjører fort og bruker kort tid, så den har mye fart igjen når den treffer.</>
        )}{' '}
        (Animasjonen stopper ved sammenstøtet.)
      </p>
    );
  } else if (st.stopped) {
    const where = queue ? (queue.gap < 0.05 ? ', akkurat ved køen' : `, ${fmtLen(queue.gap)} m før køen`) : '';
    moment = (
      <p>
        <strong>
          Bilen står stille etter {fmtLen(res.s)} m og {fmt(res.t, 1)} s{where}.
        </strong>{' '}
        Nå er friksjonen null: på flat vei er det ingen kraft som prøver å flytte bilen langs veien, så veien trenger ikke å holde
        igjen. Friksjonen er ikke alltid μN, det er bare den største friksjonen veien kan gi.
      </p>
    );
  } else if (st.s < 0.05) {
    moment = (
      <p>
        <strong>
          {queue ? `Føreren ser køen ${fmt(queue.d, 0)} m foran og tråkker bremsen helt ned ved kjeglene.` : 'Føreren tråkker bremsen helt ned ved kjeglene.'}
        </strong>{' '}
        Loddrett opphever G og N hverandre, så kraftsummen på bilen er friksjonen R fra veien på dekkene. Den peker bakover, og derfor
        peker akselerasjonen også bakover: farten avtar. Trykk «Spill av».
      </p>
    );
  } else {
    moment = (
      <p>
        <strong>
          Etter {fmt(st.t, 1)} s har bilen bremset {fmtLen(st.s)} m, og farten er {fmt(msToKmh(st.v), 0)} km/h.
        </strong>{' '}
        Farten v peker framover, men kraftsummen R og akselerasjonen a peker bakover: kraften trenger ikke å peke dit bilen kjører.
        {mu <= 0.1 && <> Her er friksjonen bare {fmt(100 * mu, 0)} % av tyngden, så R-pila er knapt synlig ved siden av G.</>} R = μN er
        like stor hele tiden, så farten avtar like mye hvert sekund. Men den avtar ikke like mye per meter: halvveis i
        bremselengden er farten fortsatt {fmt(vKmh / Math.SQRT2, 0)} km/h (71 %), fordi bilen bruker kort tid på de første metrene mens
        den kjører fort.
      </p>
    );
  }

  const brakes =
    bremser === 'abs' ? (
      <p>
        <strong>Med ABS ruller hjulene hele tiden.</strong> Den delen av dekket som er nede mot veien, står et øyeblikk stille mot veien (se
        lupen), så friksjonen er statisk og kan bli opptil μ<Sub>s</Sub>N. ABS letter litt på bremsen akkurat før hjulene låser seg, så friksjonen
        holder seg nær den største verdien, og du kan styre unna. Med låste hjul (μ<Sub>k</Sub> = {fmt(muK, 2)}) ville bremselengden
        blitt {fmtLen(sOther)} m, {fmtLen(sOther - res.s)} m lenger.
      </p>
    ) : (
      <p>
        <strong>Låste hjul sklir.</strong> Dekkene glir bortover veien og lager bremsespor, så friksjonen er glidefriksjon, μ<Sub>k</Sub>N ={' '}
        {fmt(res.R, 0)} N. Den er mindre enn den største statiske friksjonen μ<Sub>s</Sub>N = {fmt(muS * res.N, 0)} N, så bremselengden blir{' '}
        {fmtLen(res.s - sOther)} m lenger enn med ABS ({fmtLen(sOther)} m). Og du kan ikke styre: friksjonen på et dekk som sklir, virker
        alltid mot glideretningen, så det hjelper ikke å vri på rattet. Bilen sklir rett fram.
      </p>
    );

  let tyres: ReactNode;
  if (winter && dekk === 'sommer') {
    tyres = (
      <>
        <strong>Sommerdekk på {FORE_TEKST[fore]} er farlig.</strong> Friksjonstallet er bare {fmt(mu, 2)}, så bremselengden blir{' '}
        {fmtLen(res.s)} m. Med vinterdekk ville den blitt {fmtLen(sOtherTyre)} m, omtrent halvparten. Vinterdekk har mykere gummi og mange
        små spalter (lameller, se lupen) som griper i {fore === 'sno' ? 'snøen' : 'isen'}.
      </>
    );
  } else if (winter) {
    tyres = (
      <>
        <strong>Vinterdekk griper omtrent dobbelt så godt som sommerdekk på {FORE_TEKST[fore]}:</strong> med sommerdekk ville bremselengden
        blitt {fmtLen(sOtherTyre)} m.{' '}
        {fore === 'is' ? 'Piggdekk griper enda bedre på blank is.' : 'Mykere gummi og mange små spalter (lameller, se lupen) griper i snøen.'}
      </>
    );
  } else if (dekk === 'vinter') {
    tyres = (
      <>
        <strong>På bar asfalt er sommerdekk litt bedre</strong> ({fmtLen(sOtherTyre)} m mot {fmtLen(res.s)} m med vinterdekk), fordi den myke
        vintergummien gir etter. Derfor bytter vi tilbake til sommerdekk om våren.
      </>
    );
  } else if (fore === 'vaat') {
    tyres = (
      <>
        <strong>Vann mellom dekket og asfalten gir mindre friksjon:</strong> μ = {fmt(mu, 2)} mot {fmt(muTorr, 2)} på tørr asfalt, så
        bremselengden blir {fmt(muTorr / mu, 1)} ganger så lang. Ved mye vann kan dekket flyte opp på vannet (vannplaning), og da er
        friksjonen nesten borte.
      </>
    );
  } else {
    tyres = (
      <>
        <strong>Tørr asfalt gir det største friksjonstallet</strong>, rundt 0,8 med gode sommerdekk. Bytt føre og se hvor mye lenger
        bremselengden blir.
      </>
    );
  }

  const vMax = Math.floor(msToKmh(maxStopSpeed(mu, queue?.d ?? 0)) + 1e-9);
  return (
    <>
      {moment}
      {brakes}
      <p>
        {tyres}{' '}
        {fore !== 'torr' && Number.isFinite(vSame) && (
          <>
            For å stoppe like kort på {FORE_TEKST[fore]} som på tørr asfalt fra {fmt(vKmh, 0)} km/h, må du ned i {fmt(vSame, 0)} km/h.
          </>
        )}
      </p>
      <p>
        <strong>Farten betyr mye, og den bestemmer du selv.</strong> Bremselengden s = v<Sub>0</Sub>
        <Sup>2</Sup>/(2μg) vokser med kvadratet av farten
        {vLow >= 20 ? (
          <>
            : med {fmt(vLow, 0)} km/h i stedet for {fmt(vKmh, 0)} km/h blir den {fmtLen(sLow)} m, bare {fmt((100 * sLow) / res.s, 0)} % av{' '}
            {fmtLen(res.s)} m.
          </>
        ) : (
          <>, så dobbel fart gir fire ganger så lang bremselengde.</>
        )}{' '}
        {queue && (
          <>
            Skal du rekke å stoppe før køen {fmt(queue.d, 0)} m foran, kan du kjøre høyst {fmt(vMax, 0)} km/h {setup}: v<Sub>0</Sub> = √(2μgd).
          </>
        )}
      </p>
      <p>
        <strong>Massen betyr ingenting:</strong> en bil på {fmt(m, 0)} kg trenger større bremsekraft enn en lettere bil, men den får også
        større normalkraft og dermed større friksjon, så a = μmg/m = μg. (Vi ser bort fra luftmotstanden. Reaksjonslengden, strekningen
        bilen kjører før føreren rekker å bremse, kommer i tillegg.)
      </p>
    </>
  );
}
