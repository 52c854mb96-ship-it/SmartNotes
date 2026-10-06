import { useMemo, useState, type ReactNode } from 'react';
import {
  Controls,
  Explain,
  Figure,
  Formula,
  FormulaLine,
  Legend,
  PlayControls,
  Readout,
  Readouts,
  Segmented,
  Slider,
  Sub,
  Toggle,
  Toolbar,
  Txt,
  VIZ,
  VizLayout,
  fmt,
  G_EARTH,
  useSimClock,
  useTextScale,
} from '../../kit';
import {
  BIL_MAAL,
  Bil,
  ForceArrow,
  Gran,
  Himmel,
  Landskap,
  Lauvtre,
  Underlag,
  ValueTag,
  Vei,
  hjulvinkelFraStrekning,
  paint,
  useStrokeScale,
  useSvgId,
} from '../../kit/scene';
import { BOUNDARY, HENGER_MAAL, HengerLupe, Hengerfeste, KULE, Systemgrense, Tilhenger, hengerTopp } from './koblede-deler';
import { Frilegemediagram, fmtSig } from './koblede-frilegeme';
import { useNarrow } from './useNarrow';
import { TOW_RANGES, towDuration, towMotion, towSystem, trailerLoad, type TowSystem, type TowView } from './model-koblede-klosser';

const VIEWS: { value: TowView; label: string }[] = [
  { value: 'system', label: 'Hele vogntoget' },
  { value: 'henger', label: 'Hengeren' },
  { value: 'bil', label: 'Bilen' },
];

const VIEW_TEXT: Record<TowView, string> = { system: 'hele vogntoget', henger: 'hengeren', bil: 'bilen' };

/**
 * Koblede legemer (2E): en bil trekker en tilhenger med storsekker med ved. Eleven velger hva som er systemet
 * (hele vogntoget, bare hengeren eller bare bilen) og ser at kraften S i hengerfestet er en indre kraft som faller
 * ut av kraftsummen når begge er med, men en ytre kraft når vi ser på én av dem. Avspillingen viser vogntoget som
 * starter fra ro med konstant akselerasjon. F og S har én skala i scenen; G og N er mye større og vises i et eget
 * frilegemediagram under scenen, med egen målestokk.
 */
export default function KobledeKlosser() {
  const RG = TOW_RANGES;
  const [view, setView] = useState<TowView>('system');
  const [mH, setMH] = useState<number>(RG.mH.start);
  const [mB, setMB] = useState<number>(RG.mB.start);
  const [F, setF] = useState<number>(RG.F.start);
  const [showForces, setShowForces] = useState(true);
  const [showFbd, setShowFbd] = useState(false);
  const sys = towSystem(view, mH, mB, F);
  const tEnd = towDuration(sys.a);
  const clock = useSimClock({ tMax: tEnd });
  const motion = towMotion(sys.a, clock.t);
  const [ref, narrow] = useNarrow<HTMLDivElement>();
  const box = narrow ? NARROW_VIEW : WIDE_VIEW;

  return (
    <VizLayout>
      <Controls>
        <Slider
          label={
            <>
              Masse henger med last, m<Sub>H</Sub>
            </>
          }
          ariaLabel="Masse til hengeren med last"
          value={mH}
          onChange={setMH}
          min={RG.mH.min}
          max={RG.mH.max}
          step={RG.mH.step}
          unit="kg"
        />
        <Slider
          label={
            <>
              Masse bil med fører, m<Sub>B</Sub>
            </>
          }
          ariaLabel="Masse til bilen med fører"
          value={mB}
          onChange={setMB}
          min={RG.mB.min}
          max={RG.mB.max}
          step={RG.mB.step}
          unit="kg"
        />
        <Slider label="Drivkraft F fra veien" value={F} onChange={setF} min={RG.F.min} max={RG.F.max} step={RG.F.step} unit="N" />
      </Controls>
      <Toolbar>
        <Segmented label="Velg hva som er systemet" options={VIEWS} value={view} onChange={setView} />
      </Toolbar>
      <Toolbar>
        <PlayControls clock={{ ...clock, t: motion.t }} decimals={1} />
        <Toggle label="Vis krefter" checked={showForces} onChange={setShowForces} />
        <Toggle label="Vis frilegemediagram" checked={showFbd} onChange={setShowFbd} />
      </Toolbar>

      <div ref={ref}>
        <Figure viewBox={`${box.x} ${box.y} ${box.w} ${box.h}`} label={sceneLabel(sys, mH, mB, F, motion.v)} maxHeight={500}>
          <TowScene sys={sys} mH={mH} mB={mB} F={F} v={motion.v} s={motion.s} showForces={showForces} box={box} narrowView={narrow} />
        </Figure>
      </div>

      {showFbd && <Frilegemediagram sys={sys} />}

      {(showForces || showFbd) && <Legend items={legendItems(view, showFbd)} />}

      <Formula label="Newtons 2. lov for det valgte systemet">{formula(sys, mH, mB, F)}</Formula>

      <Readouts>
        <Readout label="Akselerasjon a" value={fmt(sys.a, 2)} unit="m/s²" tone={VIZ.acceleration} />
        <Readout label="Kraft i hengerfestet S" value={fmt(sys.S, 0)} unit="N" tone={VIZ.tension} />
        <Readout label="Kraftsum på hengeren" value={fmt(sys.netA, 0)} unit="N" />
        <Readout label="Kraftsum på bilen" value={fmt(sys.netB, 0)} unit="N" />
      </Readouts>

      <Explain>{explanation(sys, mH, mB, F, showFbd)}</Explain>
    </VizLayout>
  );
}

/* ---------- Scenen: vogntoget på en landevei, kameraet følger med ---------- */

const W = 800;
/**
 * Utsnittet på PC (uten den øverste, tomme delen av himmelen) og på mobil (smalere, så vogntoget blir større, og
 * høyere, så skiltene, pilene og lupen får plass når teksten vokser).
 */
type Box = { x: number; y: number; w: number; h: number };
const WIDE_VIEW: Box = { x: 0, y: 60, w: W, h: 392 };
const NARROW_VIEW: Box = { x: 32, y: 36, w: 672, h: 452 };
const HORIZON = 212;
/** Himmelen tegnes fra like over utsnittet, så skyene havner i den synlige delen. */
const SKY_Y = 30;
/** Der hjulene står (midt i det nærmeste feltet), og hvor bred veibanen ser ut i perspektiv (som i Vei). */
const ROAD_Y = 318;
const ROAD_W = 56;
const ROAD_BOT = ROAD_Y + 0.3 * ROAD_W;
const NEAR_EDGE = ROAD_BOT + 0.18 * ROAD_W;
/** Én skala for hele scenen: 60 px per meter (bilen er 4,4 m lang). */
const PX_PER_M = 60;
const CAR_SIZE = BIL_MAAL.lengde * PX_PER_M;
/** Akslingen på hengeren, kula i hengerfestet og midten av bilen (ankerpunktene). */
const TRAILER_X = 48 + (HENGER_MAAL.kasse / 2) * PX_PER_M;
const HITCH_X = TRAILER_X + HENGER_MAAL.kobling * PX_PER_M;
const HITCH_Y = ROAD_Y - KULE.hoyde * PX_PER_M;
const CAR_X = HITCH_X + KULE.bak * PX_PER_M;
const TRAILER_REAR = TRAILER_X - (HENGER_MAAL.kasse / 2) * PX_PER_M;
const CAR_FRONT = CAR_X + BIL_MAAL.foran * PX_PER_M;
const CAR_TOP = ROAD_Y - BIL_MAAL.hoyde * PX_PER_M;
/** Drivhjulene (forhjulsdrift): der drivkraften fra veien virker, langs veibanen like under kontaktflaten. */
const DRIVE_X = CAR_X + (BIL_MAAL.akselavstand / 2) * PX_PER_M;
const F_Y = ROAD_Y + 4;
/**
 * Én skala for F og S i hele scenen. På PC blir den største drivkraften (5 000 N) 260 px, så S er ca. 60 px ved
 * standardverdiene. Mobilutsnittet er smalere, så der blir den største drivkraften 185 px (det som er plass til foran
 * bilen). G og N (ca. 2 000–35 000 N) får ikke plass i samme skala og vises i frilegemediagrammet under scenen.
 */
const PX_PER_N_WIDE = 260 / TOW_RANGES.F.max;
const PX_PER_N_NARROW = 185 / TOW_RANGES.F.max;
/** S-pilene står litt over kula, i hver sin høyde, så de ikke ser ut som én dobbelpil: på hengeren (fremover) og på bilen (bakover). */
const S_Y_TRAILER = HITCH_Y - 12;
const S_Y_CAR = HITCH_Y - 31;
/** Fart og akselerasjon (egne skalaer): 5 px per m/s og 24 px per m/s². */
const PX_PER_V = 5;
const PX_PER_A = 24;
const TRAILER_WHEEL_R = HENGER_MAAL.hjulradius;
const LAKK = 'rod';
/** Lupen på hengerfestet, i gresset rett under kula (større på mobil). */
const LUPE_WIDE = { x: HITCH_X, y: 398, r: 50 };
const LUPE_NARROW = { x: HITCH_X, y: 424, r: 60 };

function sceneLabel(sys: TowSystem, mH: number, mB: number, F: number, v: number): string {
  const what = `En bil på ${fmt(mB, 0)} kg trekker en tilhenger med ved på ${fmt(mH, 0)} kg. Drivkraften fra veien er ${fmt(F, 0)} N, og kraften i hengerfestet er ${fmt(sys.S, 0)} N.`;
  const now = v > 0.05 ? ` Farten er nå ${fmt(v * 3.6, 0)} km/h.` : '';
  return `${what} Valgt system: ${VIEW_TEXT[sys.view]}.${now}`;
}

interface SceneProps {
  sys: TowSystem;
  mH: number;
  mB: number;
  F: number;
  v: number;
  s: number;
  showForces: boolean;
  box: Box;
  /** Mobilutsnittet (smal beholder). */
  narrowView: boolean;
}

function TowScene({ sys, mH, mB, F, v, s, showForces, box, narrowView }: SceneProps) {
  const f = useTextScale();
  // Store tekster (mobil): bare symbolene på pilene, verdiene står under figuren.
  const narrow = f > 1.3;
  const lupe = narrowView ? LUPE_NARROW : LUPE_WIDE;
  const k = narrowView ? PX_PER_N_NARROW : PX_PER_N_WIDE;
  const clip = useSvgId('vogntog-utsnitt');
  const camera = s * PX_PER_M;
  const fill = trailerLoad(mH).fill;
  const withH = sys.view !== 'bil';
  const withB = sys.view !== 'henger';
  const internal = withH && withB;

  // Systemgrensen: rundt det som er med, og gjennom hengerfestet når bare én av delene er med.
  const loadTop = ROAD_Y - hengerTopp(fill) * PX_PER_M;
  const pad = 10;
  const left = withH ? TRAILER_REAR - pad : HITCH_X - 4;
  const right = withB ? CAR_FRONT + pad : HITCH_X + 4;
  const top = Math.min(withH ? loadTop : Infinity, withB ? CAR_TOP : Infinity) - pad - 2;
  const bottom = ROAD_Y + 12;

  const tagY = box.y + 24 * Math.max(1, f * 0.9);
  const boxRight = box.x + box.w;
  const speedText = `${fmt(v * 3.6, 0)} km/h`;
  const distText = `s = ${fmt(s, s < 100 ? 1 : 0)} m`;
  const sysText = narrow ? `System: ${sys.view === 'system' ? 'vogntoget' : VIEW_TEXT[sys.view]}` : `Systemet: ${VIEW_TEXT[sys.view]}`;
  // Drivkraften virker der forhjulet står på veien. Etiketten står bak spissen, men aldri utenfor figuren.
  const fTip = DRIVE_X + F * k;
  const fText = narrow ? 'F' : `F = ${fmt(F, 0)} N`;
  const fLabelX = Math.min(fTip + 8, boxRight - 10 - fText.length * 17 * f * 0.62);

  return (
    <g>
      <defs>
        <clipPath id={clip}>
          <rect x={box.x} y={box.y} width={box.w} height={box.h} />
        </clipPath>
      </defs>
      <g clipPath={`url(#${clip})`}>
        <Backdrop camera={camera} bottom={box.y + box.h} />

        <Hengerfeste x={CAR_X} y={ROAD_Y} pxPerM={PX_PER_M} dim={!withB} />
        <Bil
          x={CAR_X}
          y={ROAD_Y}
          size={CAR_SIZE}
          lakk={LAKK}
          type="stasjonsvogn"
          hjulvinkel={hjulvinkelFraStrekning(s)}
          dim={!withB}
          title={`Bil med fører, ${fmt(mB, 0)} kg`}
        />
        <Tilhenger
          x={TRAILER_X}
          y={ROAD_Y}
          pxPerM={PX_PER_M}
          fill={fill}
          hjulvinkel={hjulvinkelFraStrekning(s, TRAILER_WHEEL_R)}
          dim={!withH}
          title={`Tilhenger med ved, ${fmt(mH, 0)} kg`}
        />

        <Systemgrense x={left} y={top} w={right - left} h={bottom - top} />

        {showForces && (
          <g>
            <HitchForces S={sys.S} k={k} onH={withH} onB={withB} internal={internal} narrow={narrow} />
            {withB && F > 0 && (
              <ForceArrow
                x1={DRIVE_X}
                y1={F_Y}
                x2={fTip}
                y2={F_Y}
                color={VIZ.applied}
                minLength={0.5}
                label={fText}
                labelAnchor="start"
                labelX={fLabelX}
                labelY={fLabelX > fTip ? F_Y + 6 * f : F_Y - 9 * f}
              />
            )}
            <Kinematics a={sys.a} v={v} x={kinX(sys.view)} y={top} narrow={narrow} />
          </g>
        )}

        <HengerLupe
          cx={lupe.x}
          cy={lupe.y}
          r={lupe.r}
          tx={HITCH_X}
          ty={HITCH_Y}
          tr={9}
          lakk={paint(LAKK)}
          withH={withH}
          withB={withB}
          showForces={showForces && sys.S > 0}
        />
        <LupeText view={sys.view} S={sys.S} lupe={lupe} />

        <ValueTag x={box.x + 14} y={tagY} anchor="start" text={speedText} color={v > 0.05 ? VIZ.velocity : undefined} />
        <ValueTag x={box.x + 14 + tagWidth(speedText, f) + 8 * f} y={tagY} anchor="start" text={distText} />
        <ValueTag x={boxRight - 14} y={tagY} anchor="end" text={sysText} color={BOUNDARY} />
      </g>
    </g>
  );
}

/** Teksten ved lupen: hva den viser, og hva kraften i hengerfestet er for det valgte systemet. */
function LupeText({ view, S, lupe }: { view: TowView; S: number; lupe: { x: number; y: number; r: number } }) {
  const f = useTextScale();
  const x = lupe.x + lupe.r + 12;
  const y = lupe.y - 10 * f;
  const [l1, l2] = !(S > 0)
    ? ['ingen kraft', 'når F = 0']
    : view === 'system'
      ? ['indre krefter:', 'sum null for systemet']
      : view === 'henger'
        ? ['bilen drar hengeren', 'fremover med S']
        : ['hengeren drar bilen', 'bakover med S'];
  return (
    <g>
      <Txt x={x} y={y} anchor="start" size={0.85} weight={720}>
        Hengerfestet
      </Txt>
      <Txt x={x} y={y + 17 * f} anchor="start" size={0.8} weight={600}>
        {l1}
      </Txt>
      <Txt x={x} y={y + 33 * f} anchor="start" size={0.8} weight={600}>
        {l2}
      </Txt>
    </g>
  );
}

/** Der fart- og akselerasjonspilene begynner: over midten av systemet. */
function kinX(view: TowView): number {
  if (view === 'henger') return TRAILER_X - 40;
  if (view === 'bil') return CAR_X - 40;
  return (TRAILER_REAR + CAR_FRONT) / 2 - 40;
}

/** Bredden på et ValueTag (samme regel som i scene-kit-et), så to skilt kan stå ved siden av hverandre. */
function tagWidth(text: string, f: number, size = 0.9): number {
  const fs = 17 * f * size;
  return Math.max(fs * 1.6, text.length * fs * 0.6 + 16 * f);
}

/** Himmel, åser, landeveien og noen trær. Alt ruller med kameraet (forskyvning i piksler). */
function Backdrop({ camera, bottom }: { camera: number; bottom: number }) {
  // Kameraet flytter seg bare synlig når bilen kjører; runder av så bakgrunnen ikke tegnes på nytt for småting.
  const cam = Math.round(camera * 4) / 4;
  return useMemo(
    () => (
      <g>
        <Himmel y={SKY_Y} w={W} h={HORIZON + 2 - SKY_Y} sol={{ x: 640, y: 122, r: 22 }} skyer={2} seed={7} forskyvning={cam} />
        <Landskap x={0} y={HORIZON} w={W} h={104} type="aaser" seed={3} forskyvning={cam} />
        <Vei x1={0} x2={W} y={ROAD_Y} bredde={ROAD_W} type="asfalt" horisont={HORIZON} depth={0.5 * ROAD_W} forskyvning={cam} seed={4} />
        <Underlag x1={0} x2={W} y={bottom - 1} depth={2} type="gress" horisont={NEAR_EDGE} forskyvning={cam} seed={5} />
        <Trees camera={cam} />
      </g>
    ),
    [cam, bottom],
  );
}

/**
 * Trær et stykke bak veien, på åsene like under horisonten. De er små og står så høyt at krona havner over lasten på
 * hengeren og over bilen, så den ikke ser ut som en del av lasten når trærne ruller forbi. De står lenger unna enn
 * veien, så de ruller saktere (parallakse).
 */
const TREES = [
  { u: 700, y: 226, size: 46, kind: 'gran' },
  { u: 790, y: 224, size: 38, kind: 'lauv' },
  { u: 1180, y: 227, size: 52, kind: 'gran' },
  { u: 1420, y: 224, size: 40, kind: 'lauv' },
] as const;
const TREE_PERIOD = 1500;
const TREE_PARALLAX = 0.4;

function Trees({ camera }: { camera: number }) {
  const shift = camera * TREE_PARALLAX;
  return (
    <g>
      {TREES.map((tr, i) => {
        const x = ((((tr.u - shift) % TREE_PERIOD) + TREE_PERIOD) % TREE_PERIOD) - 120;
        if (x < -80 || x > W + 80) return null;
        return tr.kind === 'gran' ? <Gran key={i} x={x} y={tr.y} size={tr.size} seed={i + 1} /> : <Lauvtre key={i} x={x} y={tr.y} size={tr.size} seed={i + 1} />;
      })}
    </g>
  );
}

/**
 * Kraften i hengerfestet: på hengeren fremover og på bilen bakover, begge med angrepspunkt i kula. Pilene står i hver
 * sin høyde litt over kula, med en stiplet strek ned til den, så de ikke ser ut som én dobbelpil.
 */
function HitchForces({ S, k, onH, onB, internal, narrow }: { S: number; k: number; onH: boolean; onB: boolean; internal: boolean; narrow: boolean }) {
  const f = useTextScale();
  const ss = useStrokeScale();
  if (!(S > 0)) return null;
  const len = S * k;
  const label = internal || narrow ? 'S' : `S = ${fmt(S, 0)} N`;
  const top = onB ? S_Y_CAR : S_Y_TRAILER;
  // Etiketten står forbi spissen av hver pil, så det er tydelig hvilken pil den hører til.
  const place = (y: number, dir: 1 | -1) => ({
    labelAnchor: dir > 0 ? ('start' as const) : ('end' as const),
    labelX: HITCH_X + dir * (len + 6),
    labelY: y + 6 * f,
  });
  return (
    <g>
      <line x1={HITCH_X} y1={top} x2={HITCH_X} y2={HITCH_Y} stroke={VIZ.surface} strokeWidth={3.6 * ss} strokeLinecap="round" />
      <line x1={HITCH_X} y1={top} x2={HITCH_X} y2={HITCH_Y} stroke={VIZ.tension} strokeWidth={1.8 * ss} strokeDasharray={`${3 * ss} ${2.5 * ss}`} />
      {onH && (
        <ForceArrow x1={HITCH_X} y1={S_Y_TRAILER} x2={HITCH_X + len} y2={S_Y_TRAILER} color={VIZ.tension} minLength={0.5} label={label} {...place(S_Y_TRAILER, 1)} />
      )}
      {onB && <ForceArrow x1={HITCH_X} y1={S_Y_CAR} x2={HITCH_X - len} y2={S_Y_CAR} color={VIZ.tension} minLength={0.5} label={label} {...place(S_Y_CAR, -1)} />}
      <circle cx={HITCH_X} cy={HITCH_Y} r={3 * ss} fill={VIZ.ink} stroke={VIZ.surface} strokeWidth={1.4 * ss} />
    </g>
  );
}

/** Akselerasjonen og farten til systemet (samme for bilen og hengeren), over systemgrensen. */
function Kinematics({ a, v, x, y, narrow }: { a: number; v: number; x: number; y: number; narrow: boolean }) {
  const f = useTextScale();
  const aY = y - 22 * f;
  const vY = aY - 26 * f;
  return (
    <g>
      {a > 0 && (
        <ForceArrow
          x1={x}
          y1={aY}
          x2={x + a * PX_PER_A}
          y2={aY}
          color={VIZ.acceleration}
          width={5}
          minLength={0.5}
          label={narrow ? 'a' : `a = ${fmt(a, 2)} m/s²`}
          labelAnchor="start"
          labelX={x + a * PX_PER_A + 8}
          labelY={aY + 6 * f}
        />
      )}
      {v > 0.05 && (
        <ForceArrow
          x1={x}
          y1={vY}
          x2={x + v * PX_PER_V}
          y2={vY}
          color={VIZ.velocity}
          width={6}
          minLength={0.5}
          label="v"
          labelAnchor="start"
          labelX={x + v * PX_PER_V + 8}
          labelY={vY + 6 * f}
        />
      )}
    </g>
  );
}

function legendItems(view: TowView, fbd: boolean): { color: string; label: ReactNode; dashed?: boolean }[] {
  const items: { color: string; label: ReactNode; dashed?: boolean }[] = [];
  if (view !== 'henger') items.push({ color: VIZ.applied, label: 'F: drivkraft fra veien på bilen' });
  items.push({
    color: VIZ.tension,
    label: view === 'system' ? 'S: kreftene i hengerfestet (indre krefter, sum null)' : view === 'henger' ? 'S: bilen drar hengeren fremover' : 'S: hengeren drar bilen bakover',
  });
  if (fbd) {
    items.push({ color: VIZ.gravity, label: 'G: tyngde (i frilegemediagrammet)' });
    items.push({ color: VIZ.normal, label: 'N: normalkraft (i frilegemediagrammet)' });
  }
  items.push({ color: VIZ.acceleration, label: 'a: akselerasjon' }, { color: VIZ.velocity, label: 'v: fart' });
  items.push({ color: BOUNDARY, label: 'Systemgrense', dashed: true });
  return items;
}

function formula(sys: TowSystem, mH: number, mB: number, F: number): ReactNode {
  const kg = (v: number) => `${fmt(v, 0)} kg`;
  const n = (v: number) => `${fmt(v, 0)} N`;
  // a er et mellomsvar når vi regner videre til S, så den vises med ett siffer mer der.
  const a2 = `${fmt(sys.a, 2)} m/s²`;
  const a3 = `${fmt(sys.a, 3)} m/s²`;
  const aLine = (
    <FormulaLine>
      a = F/(m<Sub>H</Sub> + m<Sub>B</Sub>) = {n(F)}/{kg(mH + mB)} = {sys.view === 'system' ? a2 : a3}
      {sys.view !== 'system' && ' (fra hele vogntoget)'}
    </FormulaLine>
  );
  if (sys.view === 'system')
    return (
      <>
        <FormulaLine>
          ΣF = F = (m<Sub>H</Sub> + m<Sub>B</Sub>) · a
        </FormulaLine>
        {aLine}
      </>
    );
  if (sys.view === 'henger')
    return (
      <>
        <FormulaLine>
          ΣF = S = m<Sub>H</Sub> · a
        </FormulaLine>
        {aLine}
        <FormulaLine>
          S = {kg(mH)} · {a3} = {n(sys.S)}
        </FormulaLine>
      </>
    );
  return (
    <>
      <FormulaLine>
        ΣF = F − S = m<Sub>B</Sub> · a
      </FormulaLine>
      {aLine}
      <FormulaLine>
        S = F − m<Sub>B</Sub> · a = {n(F)} − {kg(mB)} · {a3} = {n(sys.S)}
      </FormulaLine>
    </>
  );
}

function explanation(sys: TowSystem, mH: number, mB: number, F: number, fbd: boolean): ReactNode {
  // G og N for systemet eleven ser på, sammenlignet med den største vannrette kraften (F, eller S for hengeren).
  const onTrailer = sys.view === 'henger';
  const G = sys.mass * G_EARTH;
  const other = onTrailer ? sys.S : F;
  const vert = fbd ? (
    <p>
      I frilegemediagrammet er alle kreftene på {VIEW_TEXT[sys.view]} tegnet i samme målestokk. Tyngden G og normalkraften N er like store og
      motsatt rettet, så de opphever hverandre og påvirker ikke bevegelsen. De er mye større enn de vannrette kreftene: G = {fmtSig(G)} N
      {other > 0 ? <>, {fmt(G / other, 1)} ganger så stor som {onTrailer ? 'S' : 'F'}.</> : '.'} Derfor får de ikke plass i bildet over, der
      F og S er tegnet i en større målestokk.
    </p>
  ) : null;
  if (!(F > 0))
    return (
      <>
        <p>
          Uten drivkraft står vogntoget stille: a = 0, og det er ingen kraft i hengerfestet. Dra i glidebryteren for drivkraften, og se
          hvordan F deles mellom bilen og hengeren.
        </p>
        {vert}
      </>
    );
  const main = (() => {
    switch (sys.view) {
      case 'system':
        return (
          <p>
            Ser vi på bilen og hengeren som <strong>ett system</strong>, er kreftene i hengerfestet indre krefter: bilen drar hengeren
            fremover med S, og hengeren drar bilen bakover med like stor kraft (Newtons 3. lov). De to kreftene er et kraftpar inne i
            systemet. Summen av dem er null, så de faller ut av kraftsummen for systemet. Bare den ytre kraften F fra veien er igjen, og den akselererer hele massen på {fmt(mH + mB, 0)} kg. Det er derfor
            bilen blir merkbart tregere med full henger: den samme drivkraften skal gi fart til mer masse.
          </p>
        );
      case 'henger':
        return (
          <p>
            For <strong>hengeren</strong> alene er S en ytre kraft, og den eneste vannrette kraften. Hengerfestet må gi hengeren den
            samme akselerasjonen som bilen, så S = m<Sub>H</Sub> · a = {fmt(sys.S, 0)} N. Jo tyngre hengeren er og jo kraftigere du
            gir gass, desto større blir S. Det er en av grunnene til at hengerfestet og bilen har en grense for hvor tung henger de
            kan trekke.
          </p>
        );
      case 'bil':
        return (
          <p>
            For <strong>bilen</strong> alene virker både F fremover og S bakover, fra hengeren. Kraftsummen F − S = {fmt(sys.netB, 0)} N gir
            bilen akselerasjonen a. Drivkraften er friksjonen fra veien på drivhjulene, men bare {fmt((1 - sys.S / F) * 100, 0)} % av
            den går til å akselerere selve bilen. Du får samme S som når du regner på hengeren, og det er en fin kontroll.
          </p>
        );
    }
  })();
  return (
    <>
      {main}
      {vert}
      <p>
        Trykk «Spill av» for å se vogntoget starte fra ro. Farten øker like mye hvert sekund, og bilen og hengeren har hele tiden samme fart
        og akselerasjon. Vi ser bort fra luftmotstand og rullemotstand.
      </p>
    </>
  );
}
