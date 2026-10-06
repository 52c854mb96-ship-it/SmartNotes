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
  brakeState,
  brakingDistance,
  frictionCoefficient,
  kmhToMs,
  msToKmh,
  playbackSpeed,
  sameDistanceSpeed,
  type BrakeResult,
  type BrakeState,
  type Bremser,
  type Dekk,
  type Fore,
} from './model-fore-og-bremsing';
import { useNarrow } from './useNarrow';

/**
 * Friksjon og føre (2C, 2E): en bil bremser fullt fra en gitt fart på tørr asfalt, våt asfalt, snø eller is, med
 * sommer- eller vinterdekk, med ABS eller med låste hjul. Friksjonen R = μN er hele kraftsummen, så a = μg og
 * bremselengden blir s = v₀²/(2μg). Scenen følger bilen, og stolpediagrammet sammenligner bremselengdene.
 */
export default function ForeOgBremsing() {
  const RG = BRAKE_RANGES;
  const [vKmh, setVKmh] = useState<number>(RG.v.start);
  const [m, setM] = useState<number>(RG.m.start);
  const [fore, setFore] = useState<Fore>('sno');
  const [dekk, setDekk] = useState<Dekk>('vinter');
  const [bremser, setBremser] = useState<Bremser>('abs');
  const [showForces, setShowForces] = useState(true);

  const v0 = kmhToMs(vKmh);
  const mu = frictionCoefficient(fore, dekk, bremser);
  const res = brake(v0, mu, m);
  const clock = useSimClock({ tMax: res.t, speed: playbackSpeed(res.t) });
  const { setT, pause } = clock;

  // Når siden åpnes, står bilen midt i oppbremsingen, så både bremsesporene og kreftene synes.
  const started = useRef(false);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    setT(0.4 * res.t);
  }, [res.t, setT]);
  // Ny fart, nytt føre eller nye dekk: bilen er like langt ut i oppbremsingen (samme andel av bremsetiden).
  const lastStop = useRef(res.t);
  const tNow = useRef(clock.t);
  tNow.current = clock.t;
  useLayoutEffect(() => {
    const prev = lastStop.current;
    if (prev === res.t) return;
    lastStop.current = res.t;
    setT(prev > 0 ? Math.min(1, tNow.current / prev) * res.t : 0);
  }, [res.t, setT]);

  const tStep = timeStep(res.t);
  const tSliderMax = Math.floor(res.t / tStep + 1e-9) * tStep;
  // Helt i enden av tidsbryteren står bilen stille.
  const t = clock.t >= tSliderMax - tStep / 2 ? res.t : Math.min(clock.t, res.t);
  const st = brakeState(v0, mu, m, t);
  const speed = playbackSpeed(res.t);

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
        <Slider
          label="Tid t"
          value={Math.min(t, tSliderMax)}
          onChange={(v) => {
            pause();
            setT(v >= tSliderMax - tStep / 2 ? res.t : v);
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
      </Toolbar>

      <div ref={ref}>
        <BrakeScene fore={fore} dekk={dekk} bremser={bremser} res={res} st={st} showForces={showForces} narrow={narrow} />
        <DistanceChart v0={v0} vKmh={vKmh} fore={fore} dekk={dekk} bremser={bremser} s={st.s} narrow={narrow} />
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
      </Formula>

      <Explain>
        <ExplainText fore={fore} dekk={dekk} bremser={bremser} vKmh={vKmh} m={m} v0={v0} res={res} st={st} sOther={sOther} />
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

/** Utsnittet på mobil: bilen, pilene og skiltene blir større. */
const NARROW_VIEW = { x: 160, y: 118, w: 500, h: H - 118 };
/** Lupen som forstørrer kontaktflaten under forhjulet (nede til høyre, i veikanten foran veien). */
const LUPE = { x: 596, y: 398, r: 58 };

const LANDSKAP: Record<Fore, LandskapType> = { torr: 'aaser', vaat: 'kyst', sno: 'skog', is: 'fjell' };

interface SceneProps {
  fore: Fore;
  dekk: Dekk;
  bremser: Bremser;
  res: BrakeResult;
  st: BrakeState;
  showForces: boolean;
  narrow: boolean;
}

function BrakeScene({ fore, dekk, bremser, res, st, showForces, narrow }: SceneProps) {
  const view = narrow ? NARROW_VIEW : { x: 0, y: 0, w: W, h: H };
  const kmh = msToKmh(st.v);
  const clip = useSvgId('fore-utsnitt');
  return (
    <Figure
      viewBox={`${view.x} ${view.y} ${view.w} ${view.h}`}
      label={`En bil bremser fullt på ${FORE_TEKST[fore]} ${bremser === 'abs' ? 'med ABS' : 'med låste hjul'}. ${
        st.stopped ? `Den står stille etter ${fmtLen(st.s)} m.` : `Etter ${fmtLen(st.s)} m er farten ${fmt(kmh, 0)} km/h.`
      }`}
      maxHeight={500}
    >
      {/* Alt klippes til utsnittet, så trær og bremsespor utenfor ikke synes ved siden av figuren. */}
      <defs>
        <clipPath id={clip}>
          <rect x={view.x} y={view.y} width={view.w} height={view.h} />
        </clipPath>
      </defs>
      <g clipPath={`url(#${clip})`}>
        <Backdrop fore={fore} camera={st.s * PX_PER_M} />
        <RoadContent fore={fore} dekk={dekk} bremser={bremser} res={res} st={st} showForces={showForces} view={view} />
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

function RoadContent({ fore, dekk, bremser, res, st, showForces, view }: Omit<SceneProps, 'narrow'> & { view: { x: number; y: number; w: number; h: number } }) {
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

  const kmh = msToKmh(st.v);
  const speedText = st.stopped ? 'Står stille' : `${fmt(kmh, 0)} km/h`;
  const distText = `s = ${fmtLen(s)} m`;
  const tagY = view.y + 24 * Math.max(1, f * 0.9);
  const tagX = view.x + 14;

  // Etiketten til R: tallet når det er plass mellom pilspissen og venstre kant, ellers bare symbolet.
  const rY = ROAD_Y + 9;
  const rTip = CAR_X - 6 - st.R * PX_PER_N;
  const rText = `R = ${fmt(st.R, 0)} N`;
  const rLabel = rTip - 4 - rText.length * 17 * f * 0.6 > view.x + 6 ? rText : 'R';

  return (
    <g>
      {posts.map((x) => (
        <Kantstolpe key={Math.round(x * 10)} x={x} y={ROAD_TOP - 1} h={0.95 * PX_PER_M * 0.82} />
      ))}

      {/* Kjeglene der bremsingen startet (den bakre står i veikanten bak veien) */}
      {startX > left && startX < right && <Trafikkjegle x={startX + 3} y={ROAD_TOP - 2} h={0.5 * PX_PER_M * 0.85} />}

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
              labelX={Math.min(rTip, CAR_X - 14) - 2}
              labelY={rY + 8 + 16 * f}
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
  narrow: boolean;
}

function DistanceChart(props: ChartProps) {
  const { v0, narrow } = props;
  const all = allDistances(v0);
  // Aksen er den samme for ABS og låste hjul, så stolpene kan sammenlignes når du bytter.
  let longest = 0;
  for (const f of FORE) for (const d of DEKK) longest = Math.max(longest, all[f][d].laast);
  const top = axisMax(longest / 0.86);
  const ch = narrow ? 640 : 340;
  return (
    <Figure viewBox={`0 0 800 ${ch}`} label={`Stolpediagram over bremselengden fra ${fmt(props.vKmh, 0)} km/h på fire føre, med sommer- og vinterdekk`} maxHeight={narrow ? 560 : 360}>
      <ChartContent {...props} all={all} top={top} ch={ch} />
    </Figure>
  );
}

function ChartContent({ vKmh, fore, dekk, bremser, s, narrow, all, top, ch }: ChartProps & { all: ReturnType<typeof allDistances>; top: number; ch: number }) {
  const f = useTextScale();
  const margin = narrow ? { top: 46 * f, right: 20 * f, bottom: 56 * f, left: 18 } : { top: 46 * f, right: 24 * f, bottom: 56 * f, left: 150 };
  const title = `Bremselengde fra ${fmt(vKmh, 0)} km/h ${bremser === 'abs' ? 'med ABS' : 'med låste hjul'}`;
  return (
    <>
      <Txt x={16} y={26 * f} anchor="start" weight={700} size={0.95}>
        {title}
      </Txt>
      <Plot x={{ min: 0, max: top, label: 'Bremselengde s (m)' }} y={{ min: 0, max: FORE.length, label: '', ticks: [] }} width={800} height={ch} margin={margin}>
        {({ sx, sy, x0 }) => (
          <g>
            {FORE.map((fr, i) => {
              const rowTop = sy(FORE.length - i);
              const rowBot = sy(FORE.length - i - 1);
              const selectedRow = fr === fore;
              // Mobil: navnet over stolpene. PC: navnet til venstre.
              const labelH = narrow ? 24 * f : 0;
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
                    const labelX = Math.max(end, selected ? sx(Math.min(lenOther, top)) : end) + 8;
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
                          {`${fmtLen(len)} m`}
                        </Txt>
                        {selected && <Dot x={sx(Math.min(Math.max(0, s), top))} y={cy} r={6.5} color={VIZ.ink} />}
                      </g>
                    );
                  })}
                </g>
              );
            })}
          </g>
        )}
      </Plot>
    </>
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
  st: BrakeState;
  sOther: number;
}

function ExplainText({ fore, dekk, bremser, vKmh, m, v0, res, st, sOther }: ExplainProps) {
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

  let moment: ReactNode;
  if (st.stopped) {
    moment = (
      <p>
        <strong>Bilen står stille etter {fmtLen(res.s)} m og {fmt(res.t, 1)} s.</strong> Nå er friksjonen null: på flat vei er det ingen kraft
        som prøver å flytte bilen langs veien, så veien trenger ikke å holde igjen. Friksjonen er ikke alltid μN, det er bare den
        største friksjonen veien kan gi.
      </p>
    );
  } else if (st.s < 0.05) {
    moment = (
      <p>
        <strong>Føreren tråkker bremsen helt ned ved kjeglene.</strong> Loddrett opphever G og N hverandre, så kraftsummen på bilen er
        friksjonen R fra veien på dekkene. Den peker bakover, og derfor peker akselerasjonen også bakover: farten avtar. Trykk «Spill av».
      </p>
    );
  } else {
    moment = (
      <p>
        <strong>
          Etter {fmt(st.t, 1)} s har bilen bremset {fmtLen(st.s)} m, og farten er {fmt(msToKmh(st.v), 0)} km/h.
        </strong>{' '}
        Kraftsummen er friksjonen R = μN, som er like stor hele tiden, så akselerasjonen er konstant og farten avtar like mye hvert sekund.
        Men den avtar ikke like mye per meter: halvveis i bremselengden er farten fortsatt {fmt(vKmh / Math.SQRT2, 0)} km/h (71 %),
        fordi bilen bruker kort tid på de første metrene mens den kjører fort.
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
        <strong>Låste hjul sklir.</strong> Dekkene glir bortover veien og lager bremsespor, så friksjonen er glidefriksjon, μ<Sub>k</Sub>N =
        {' '}
        {fmt(res.R, 0)} N. Den er mindre enn den største statiske friksjonen μ<Sub>s</Sub>N = {fmt(muS * res.N, 0)} N, så bremselengden blir
        {' '}
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

  return (
    <>
      {moment}
      {brakes}
      <p>
        {tyres} {fore !== 'torr' && Number.isFinite(vSame) && (
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
        <strong>Massen betyr ingenting:</strong> a = μmg/m = μg. En bil på {fmt(m, 0)} kg trenger større bremsekraft enn en lettere bil, men den
        får også større normalkraft og dermed større friksjon. (Vi ser bort fra luftmotstanden. Reaksjonslengden kommer i tillegg.)
      </p>
    </>
  );
}
