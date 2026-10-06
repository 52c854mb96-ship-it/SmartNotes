import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  Controls,
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
  TSub,
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
  Dimension,
  ForceArrow,
  Himmel,
  Landskap,
  Maalebaand,
  SpeedLines,
  ValueTag,
  Vei,
  alpha,
  hjulvinkelFraStrekning,
  useStrokeScale,
  useSvgId,
} from '../../kit/scene';
import { BRAKE_PRESETS, kmhToMs, niceRange, stopVelocity, stopping, type StopInput, type StopResult } from './model';
import {
  SURFACES,
  carPosition,
  carVelocity,
  msToKmh,
  obstacle,
  roadFor,
  sceneRange,
  speedForStoppingDistance,
  surfaceOf,
  type ObstacleResult,
  type RoadType,
  type SurfaceId,
} from './model-bremselengde';
import { ELG_MAAL, Elg, Smell, Veikant } from './bremselengde-deler';
import { useNarrow } from './useNarrow';
import { ColorDot, Label } from './marks';

const C_REACT = VIZ.series[0];
const C_BRAKE = VIZ.series[1];

/** Halv fart som tekst, med desimal når farten er et oddetall (25 km/h → «12,5 km/h»). */
const halfText = (kmh: number): string => `${fmt(kmh / 2, kmh % 2 === 0 ? 0 : 1)} km/h`;
/** Fart i km/h som tekst, uten desimaler (avrundet fra m/s). */
const kmhText = (v: number): string => `${fmt(msToKmh(v), 0)} km/h`;

/** Én bil i scenen: farten den kjører i, utfallet med elgen og etiketten over stripen. */
interface Lane {
  input: StopInput;
  res: StopResult;
  obs: ObstacleResult;
  title: string;
  lakk: 'rod' | 'blaa';
}

export default function Bremselengde() {
  const [kmh, setKmh] = useState(80);
  const [tr, setTr] = useState(1.0);
  const [a, setA] = useState<number>(BRAKE_PRESETS.torr);
  const [D, setD] = useState(60);
  const [compare, setCompare] = useState(true);
  const [arrows, setArrows] = useState(true);
  const { ref, narrow } = useNarrow();

  const main: StopInput = { v0: kmhToMs(kmh), tr, a };
  const half: StopInput = { v0: main.v0 / 2, tr, a };
  const r = stopping(main);
  const rh = stopping(half);
  const o = obstacle(main, D);
  const oh = obstacle(half, D);
  const clock = useSimClock({ tMax: Math.max(o.tEnd, compare ? oh.tEnd : 0) });
  const t = clock.t;

  const lanes: Lane[] = [{ input: main, res: r, obs: o, title: `${fmt(kmh, 0)} km/h`, lakk: 'rod' }];
  if (compare) lanes.push({ input: half, res: rh, obs: oh, title: `Halv fart: ${halfText(kmh)}`, lakk: 'blaa' });
  const surface = surfaceOf(a);

  return (
    <VizLayout>
      <Controls>
        <Slider label="Fart" value={kmh} onChange={setKmh} min={20} max={130} step={5} unit="km/h" decimals={0} />
        <Slider
          label={
            <>
              Reaksjonstid t<Sub>r</Sub>
            </>
          }
          ariaLabel="Reaksjonstid"
          value={tr}
          onChange={setTr}
          min={0.5}
          max={2.5}
          step={0.1}
          unit="s"
          decimals={1}
        />
        <Slider label="Bremseakselerasjon a" value={a} onChange={setA} min={1} max={10} step={0.5} unit="m/s²" decimals={1} />
        <Slider label="Avstand til elgen" value={D} onChange={setD} min={10} max={100} step={5} unit="m" decimals={0} />
      </Controls>
      <Toolbar>
        <Segmented<SurfaceId | 'egen'>
          label="Velg føre"
          options={SURFACES.map((s) => ({ value: s.id, label: s.label }))}
          value={surface ?? 'egen'}
          onChange={(s) => {
            const p = SURFACES.find((x) => x.id === s);
            if (p) setA(p.a);
          }}
        />
      </Toolbar>
      <Toolbar>
        <Toggle label={`Sammenlign med halv fart (${halfText(kmh)})`} checked={compare} onChange={setCompare} />
        <Toggle label="Vis fart og akselerasjon" checked={arrows} onChange={setArrows} />
      </Toolbar>
      <Toolbar>
        <PlayControls clock={clock} />
      </Toolbar>

      <RoadScene lanes={lanes} D={D} t={t} road={roadFor(a)} showArrows={arrows} kmh={kmh} />

      <div ref={ref}>
        <Figure
          viewBox={`0 0 800 ${narrow ? 540 : 380}`}
          label="Fart-tid-graf for oppbremsingen: et rektangel for reaksjonstiden og en trekant for bremsingen. Arealene er reaksjonslengden og bremselengden."
          maxHeight={narrow ? 580 : 420}
        >
          <SpeedGraph lanes={lanes} D={D} t={t} height={narrow ? 540 : 380} />
        </Figure>
      </div>
      <Legend
        items={[
          { color: C_REACT, label: 'Reaksjonslengde (konstant fart)' },
          { color: C_BRAKE, label: 'Bremselengde (farten avtar)' },
          ...(compare ? [{ color: VIZ.velocity, label: `Halv fart, ${halfText(kmh)}`, dashed: true }] : []),
        ]}
      />

      <Readouts>
        <Readout
          label={
            <>
              Reaksjonslengde s<Sub>r</Sub>
            </>
          }
          value={fmt(r.sr, 1)}
          unit="m"
          tone={C_REACT}
        />
        <Readout
          label={
            <>
              Bremselengde s<Sub>b</Sub>
            </>
          }
          value={fmt(r.sb, 1)}
          unit="m"
          tone={C_BRAKE}
        />
        <Readout label="Stopplengde" value={fmt(r.total, 1)} unit="m" />
        {o.hits ? (
          <Readout label="Treffer elgen i" value={fmt(msToKmh(o.vHit), 0)} unit="km/h" />
        ) : (
          <Readout label="Stopper foran elgen" value={fmt(o.margin, 1)} unit="m" />
        )}
      </Readouts>

      <Formula label="Utregning av reaksjonslengde, bremselengde og farten ved elgen">
        <FormulaLine>
          v<Sub>0</Sub> = {fmt(kmh, 0)} km/h : 3,6 = {fmt(main.v0, 1)} m/s
        </FormulaLine>
        <FormulaLine>
          s<Sub>r</Sub> = v<Sub>0</Sub> · t<Sub>r</Sub> = {fmt(main.v0, 1)} m/s · {fmt(tr, 1)} s = {fmt(r.sr, 1)} m
        </FormulaLine>
        <FormulaLine>
          Bremsing: v² − v<Sub>0</Sub>² = 2 · (−a) · s<Sub>b</Sub> med v = 0 gir s<Sub>b</Sub> = v<Sub>0</Sub>² / (2a)
        </FormulaLine>
        <FormulaLine>
          s<Sub>b</Sub> = ({fmt(main.v0, 1)} m/s)² / (2 · {fmt(a, 1)} m/s²) = {fmt(r.sb, 1)} m
        </FormulaLine>
        <ElkFormula input={main} r={r} o={o} D={D} />
      </Formula>

      <Explain>{explanation(kmh, tr, a, D, r, rh, o, oh, compare)}</Explain>
    </VizLayout>
  );
}

function ElkFormula({ input, r, o, D }: { input: StopInput; r: StopResult; o: ObstacleResult; D: number }) {
  if (!o.hits)
    return (
      <FormulaLine>
        Elgen: {fmt(D, 0)} m − {fmt(r.total, 1)} m = {fmt(o.margin, 1)} m igjen når bilen står
      </FormulaLine>
    );
  if (o.beforeBraking)
    return (
      <FormulaLine>
        Elgen: {fmt(D, 0)} m &lt; s<Sub>r</Sub>, så bilen treffer i full fart, {fmt(input.v0, 1)} m/s = {kmhText(input.v0)}
      </FormulaLine>
    );
  return (
    <>
      <FormulaLine>
        Elgen: bilen bremser bare s = {fmt(D, 0)} m − {fmt(r.sr, 1)} m = {fmt(o.braked, 1)} m før den treffer
      </FormulaLine>
      <FormulaLine>
        v = √(v<Sub>0</Sub>² − 2as) = √(({fmt(input.v0, 1)} m/s)² − 2 · {fmt(input.a, 1)} m/s² · {fmt(o.braked, 1)} m) = {fmt(o.vHit, 1)} m/s ={' '}
        {kmhText(o.vHit)}
      </FormulaLine>
    </>
  );
}

/* ---------- Scenen: en skogsvei med en elg ---------- */

const W = 800;
const PAD = 12;

/** Tekstskaleringen figuren vil få (samme regel som i <Figure>), målt på beholderen før figuren tegnes. */
function useContainerTextScale() {
  const ref = useRef<HTMLDivElement>(null);
  const [f, setF] = useState(1);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const update = () => {
      const w = el.getBoundingClientRect().width;
      if (w > 0) setF(Math.round(Math.max(1, 12.5 / 17 / (w / W)) * 20) / 20);
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return { ref, f };
}

/**
 * Plassen til én stripe (én bil) i scenen, regnet ut fra tekstskaleringen f og skalaen p (figurenheter per meter).
 * Øverst står tittelen (når to biler sammenlignes), så skiltet med farten med pilene for a og v på hver side, så
 * plass til elgen (2,5 m med gevir), veien, mållinjene og til slutt målebåndet i den nederste stripen.
 */
function stripLayout(f: number, p: number, opts: { titled: boolean; tape: boolean }) {
  const k = Math.max(1, f * 0.85);
  const ss = Math.max(1, f * 0.75);
  // Gjenstandene vokser på mobil (som useSceneScale), ellers blir bil og elg bare noen få piksler store.
  const obj = k;
  let y = 6;
  const titleY = y + 17 * f;
  y += opts.titled ? 24 * f : 8 * f;
  const tagH = 17 * f * 0.9 * 1.55;
  const tagY = y + 2 + tagH / 2;
  y += tagH + 6;
  const roadY = y + ELG_MAAL.hoyde * p * obj + 8 * ss;
  const B = 34 * k;
  const roadTop = roadY - 0.7 * B;
  const horizon = roadTop - 9 * k;
  const vergeY = roadY + 0.48 * B;
  const laneTop = roadY - 0.2 * B;
  const laneBot = roadY + 0.19 * B;
  const dimY = vergeY + 8 + 21 * f;
  const tapeY = dimY + 12 * ss;
  const tapeH = 11.5 * f * 1.75;
  const H = Math.round(opts.tape ? tapeY + tapeH + 8 : dimY + 12);
  return { f, k, ss, obj, titleY, tagY, tagH, roadY, B, roadTop, horizon, vergeY, laneTop, laneBot, dimY, tapeY, H };
}

type StripLayout = ReturnType<typeof stripLayout>;

function RoadScene({ lanes, D, t, road, showArrows, kmh }: { lanes: Lane[]; D: number; t: number; road: RoadType; showArrows: boolean; kmh: number }) {
  const { ref, f } = useContainerTextScale();
  const view = sceneRange(D, lanes[0]!.res.total, ELG_MAAL.bak + 3.5);
  const p = (W - 2 * PAD) / (view.max - view.min);
  const titled = lanes.length > 1;
  const layouts = lanes.map((_, i) => stripLayout(f, p, { titled, tape: i === lanes.length - 1 }));
  const GAP = 6;
  const tops: number[] = [];
  let H = 0;
  for (const L of layouts) {
    tops.push(H);
    H += L.H + GAP;
  }
  H -= GAP;
  const m = lanes[0]!;
  const label =
    `Skogsvei sett fra siden. En bil i ${fmt(kmh, 0)} km/h ser en elg ${fmt(D, 0)} m foran seg. ` +
    `Reaksjonslengden er ${fmt(m.res.sr, 1)} m og bremselengden ${fmt(m.res.sb, 1)} m, til sammen ${fmt(m.res.total, 1)} m. ` +
    (m.obs.hits ? `Bilen treffer elgen i ${kmhText(m.obs.vHit)}.` : `Bilen stopper ${fmt(m.obs.margin, 1)} m foran elgen.`);
  return (
    <div ref={ref}>
      <Figure viewBox={`0 0 ${W} ${H}`} label={label} maxHeight={titled ? 560 : 360}>
        {lanes.map((lane, i) => (
          <g key={i} transform={`translate(0 ${tops[i]})`}>
            <Strip
              lane={lane}
              L={layouts[i]!}
              view={view}
              p={p}
              D={D}
              t={t}
              road={road}
              showArrows={showArrows}
              titled={titled}
              tape={i === lanes.length - 1}
              first={i === 0}
              vMax={m.input.v0}
            />
          </g>
        ))}
      </Figure>
    </div>
  );
}

function Strip({
  lane,
  L,
  view,
  p,
  D,
  t,
  road,
  showArrows,
  titled,
  tape,
  first,
  vMax,
}: {
  lane: Lane;
  L: StripLayout;
  view: { min: number; max: number };
  p: number;
  D: number;
  t: number;
  road: RoadType;
  showArrows: boolean;
  titled: boolean;
  tape: boolean;
  first: boolean;
  vMax: number;
}) {
  const f = useTextScale();
  const ss = useStrokeScale();
  const clip = useSvgId('brems-stripe');
  const X = (s: number) => PAD + (s - view.min) * p;
  const { input, res, obs } = lane;
  const winter = road === 'sno' || road === 'is';
  const q = p * L.obj; // skalaen til bil og elg (større på mobil)

  // Bilen ved tiden t: fronten er posisjonen s, ankerpunktet midt mellom hjulene.
  const s = carPosition(input, D, t);
  const v = carVelocity(input, D, t);
  const crashed = obs.hits && t >= obs.tEnd - 1e-9;
  const braking = t > input.tr && !crashed && v > 0;
  const stopped = !obs.hits && t >= obs.tEnd - 1e-9;
  const carH = BIL_MAAL.hoyde * q;
  const front = X(s);
  const mid = front - (BIL_MAAL.lengde / 2) * q;

  // Skiltet over bilen med farten nå (eller farten i treffet), med a-pila til venstre og v-pila til høyre.
  // Bredden er fast for hele bevegelsen, så pilene ikke hopper når tallet får færre sifre.
  const tagText = crashed ? `Treff i ${kmhText(obs.vHit)}` : stopped ? 'Står stille' : kmhText(v);
  const fs = 17 * f * 0.9;
  const widthOf = (txt: string) => Math.max(fs * 1.6, txt.length * fs * 0.6 + 16 * f);
  const tagW = Math.max(widthOf(kmhText(input.v0)), widthOf('Står stille'), obs.hits ? widthOf(`Treff i ${kmhText(obs.vHit)}`) : 0);
  const tagX = Math.min(W - tagW / 2 - 6, Math.max(tagW / 2 + 6, mid));
  const pointer = Math.max(0, L.roadY - carH - 3 - (L.tagY + L.tagH / 2));
  // Pilene: én skala for farten (px per m/s) og én for akselerasjonen (px per m/s²), like i begge stripene.
  const kk = Math.min(L.k, 1.15);
  const vx = tagX + tagW / 2 + 5;
  const ax = tagX - tagW / 2 - 5;
  const room = 16 * f;
  const vLen = Math.max(0, Math.min((v * 95 * kk) / Math.max(1, vMax), W - 4 - room - vx));
  const aLen = braking ? Math.max(0, Math.min(input.a * 7 * kk, ax - 4 - room)) : 0;

  // Mål under veien. Etikettene forkortes eller sløyfes når målet er for kort.
  const edge = X(view.max) + 3;
  const xr = Math.min(X(res.sr), edge);
  const xe = X(res.total);
  const charW = 17 * 0.9 * f * 0.58;
  const fits = (w: number, text: string) => w > text.length * charW + 14 * f;
  const laneY = (L.laneTop + L.laneBot) / 2;

  // Siktelinja fra sjåføren til øyet på elgen mens sjåføren reagerer
  const eye = { x: X(D) + (ELG_MAAL.bryst - 1.42) * q, y: L.roadY - 1.71 * q };
  const driver = { x: front - 2.35 * q, y: L.roadY - 1.12 * q };
  const showSight = t < input.tr && !crashed && eye.x - driver.x > 30;

  return (
    <g>
      <defs>
        <clipPath id={clip}>
          <rect x={0} y={0} width={W} height={L.H} rx={4} />
        </clipPath>
      </defs>
      <g clipPath={`url(#${clip})`}>
        <Himmel w={W} h={L.horizon + 4} skyer={2} seed={first ? 3 : 4} sol={first ? { x: 700, y: Math.max(24, L.horizon * 0.4) } : undefined} />
        <Landskap x={0} y={L.horizon} w={W} h={Math.max(44 * L.k, L.horizon * 0.5)} type="skog" seed={7} />
        <Vei x1={0} x2={W} y={L.roadY} bredde={L.B} type={road} horisont={L.horizon} depth={0.48 * L.B + 1} seed={2} />
        <Veikant y={L.vergeY} h={L.H - L.vergeY} w={W} type={winter ? 'sno' : 'gress'} />

        {/* Reaksjonslengden og bremselengden malt i kjørefeltet, fram til der bilen ender */}
        <rect x={X(0)} y={L.laneTop} width={Math.max(0, Math.min(X(res.sr), X(obs.sEnd)) - X(0))} height={L.laneBot - L.laneTop} fill={alpha(C_REACT, 0.62)} />
        {obs.sEnd > res.sr && <rect x={X(res.sr)} y={L.laneTop} width={Math.max(0, X(obs.sEnd) - X(res.sr))} height={L.laneBot - L.laneTop} fill={alpha(C_BRAKE, 0.62)} />}
        {/* Ved et treff: strekningen bilen ville ha trengt for å stoppe, stiplet bak elgen */}
        {obs.hits && <WouldBe x0={X(obs.sEnd)} xr={X(res.sr)} xe={Math.min(xe, edge + 6)} top={L.laneTop} bot={L.laneBot} />}

        {/* Elgen står i kjørefeltet med brystet D meter foran bilen og ser mot den */}
        <Elg x={X(D) + ELG_MAAL.bryst * q} y={L.roadY} m={q} flip title="Elg" />

        {showSight && (
          <g>
            <line x1={driver.x} y1={driver.y} x2={eye.x} y2={eye.y} stroke={VIZ.surface} strokeWidth={3.2 * ss} opacity={0.6} />
            <line x1={driver.x} y1={driver.y} x2={eye.x} y2={eye.y} stroke={VIZ.ink} strokeWidth={1.3 * ss} strokeDasharray={`${4 * ss} ${4 * ss}`} opacity={0.8} />
            {first && fits(eye.x - driver.x, 'Sjåføren ser elgen') && (
              <Txt x={(driver.x + eye.x) / 2} y={(driver.y + eye.y) / 2 - 7 * ss} size={0.75} weight={600}>
                Sjåføren ser elgen
              </Txt>
            )}
          </g>
        )}

        {/* Bilen, med bremselys når sjåføren bremser */}
        {v > 0.3 && <SpeedLines x={front - BIL_MAAL.lengde * q} y={L.roadY - carH * 0.45} length={Math.min(60 * L.k, (6 + 2.2 * v) * L.k)} spread={carH * 0.55} />}
        <Bil
          x={front - BIL_MAAL.foran * q}
          y={L.roadY}
          size={BIL_MAAL.lengde * q}
          lakk={lane.lakk}
          hjulvinkel={hjulvinkelFraStrekning(s)}
          bremselys={t > input.tr}
          title={crashed ? 'Bilen har truffet elgen' : braking ? 'Bilen bremser' : 'Bil'}
        />
        {crashed && <Smell x={X(D)} y={L.roadY - 0.85 * q} r={Math.max(8 * L.k, 0.85 * q)} />}

        <ValueTag x={tagX} y={L.tagY} text={tagText} color={crashed ? VIZ.ink : VIZ.velocity} pointer={pointer} />
        {showArrows && vLen > 3 && <ForceArrow x1={vx} y1={L.tagY} x2={vx + vLen} y2={L.tagY} color={VIZ.velocity} width={6} label="v" />}
        {showArrows && aLen > 3 && <ForceArrow x1={ax} y1={L.tagY} x2={ax - aLen} y2={L.tagY} color={VIZ.acceleration} width={5} label="a" />}

        {/* Målene under veien */}
        <MeasureRow
          x0={X(0)}
          xr={xr}
          xe={xe}
          xD={X(D)}
          edge={edge}
          laneY={laneY}
          offset={-(L.dimY - laneY)}
          fits={fits}
          srTxt={`${fmt(res.sr, 1)} m`}
          sbTxt={`${fmt(res.sb, 1)} m`}
          mTxt={`${fmt(obs.margin, 1)} m`}
          obs={obs}
        />

        {titled && (
          <Txt x={PAD + 4} y={L.titleY} anchor="start" weight={700} size={0.9}>
            {lane.title}
          </Txt>
        )}
        {tape && <Maalebaand x1={X(0)} x2={X(view.max)} y={L.tapeY} til={view.max} />}
      </g>
    </g>
  );
}

/** Resten av stopplengden etter et treff (fra elgen til der bilen ville ha stått): svak farge og stiplet kant. */
function WouldBe({ x0, xr, xe, top, bot }: { x0: number; xr: number; xe: number; top: number; bot: number }) {
  const ss = useStrokeScale();
  if (!(xe - x0 > 2)) return null;
  const h = bot - top;
  const split = Math.min(Math.max(xr, x0), xe);
  return (
    <g>
      {split > x0 && <rect x={x0} y={top} width={split - x0} height={h} fill={alpha(C_REACT, 0.2)} />}
      {xe > split && <rect x={split} y={top} width={xe - split} height={h} fill={alpha(C_BRAKE, 0.2)} />}
      <rect
        x={x0}
        y={top}
        width={xe - x0}
        height={h}
        fill="none"
        stroke={split >= xe ? C_REACT : C_BRAKE}
        strokeWidth={1.3 * ss}
        strokeDasharray={`${5 * ss} ${4 * ss}`}
        opacity={0.9}
      />
    </g>
  );
}

/** Mållinjene under veien: s_r, s_b og avstanden som er igjen til elgen. */
function MeasureRow({
  x0,
  xr,
  xe,
  xD,
  edge,
  laneY,
  offset,
  fits,
  srTxt,
  sbTxt,
  mTxt,
  obs,
}: {
  x0: number;
  xr: number;
  xe: number;
  xD: number;
  edge: number;
  laneY: number;
  offset: number;
  fits: (w: number, text: string) => boolean;
  srTxt: string;
  sbTxt: string;
  mTxt: string;
  obs: ObstacleResult;
}) {
  const f = useTextScale();
  const ss = useStrokeScale();
  const label = (w: number, sub: string, value: string): ReactNode =>
    fits(w, `s${sub} = ${value}`) ? (
      <>
        s<TSub>{sub}</TSub> = {value}
      </>
    ) : fits(w, value) ? (
      value
    ) : undefined;
  const open = xe > edge;
  const xbEnd = Math.min(xe, edge);
  const dimY = laneY - offset;
  // Reaksjonslengden går ut av bildet: da er hele bremselengden utenfor også.
  if (xr >= edge - 0.5)
    return <OpenDimension x1={x0} x2={edge} y={dimY} laneY={laneY} color={C_REACT} label={label(edge - x0, 'r', srTxt)} f={f} ss={ss} />;
  return (
    <g>
      <Dimension x1={x0} y1={laneY} x2={xr} y2={laneY} offset={offset} color={C_REACT} label={label(xr - x0, 'r', srTxt)} />
      {open ? (
        <OpenDimension x1={xr} x2={xbEnd} y={dimY} laneY={laneY} color={C_BRAKE} label={label(xbEnd - xr, 'b', sbTxt)} f={f} ss={ss} />
      ) : (
        <Dimension x1={xr} y1={laneY} x2={xe} y2={laneY} offset={offset} color={C_BRAKE} label={label(xe - xr, 'b', sbTxt)} />
      )}
      {!obs.hits && obs.margin > 0.05 && (
        <Dimension x1={xe} y1={laneY} x2={xD} y2={laneY} offset={offset} color={VIZ.muted} label={fits(xD - xe, mTxt) ? mTxt : undefined} labelSize={0.8} />
      )}
    </g>
  );
}

/** Mållinje som fortsetter ut av bildet (stopplengden er lengre enn utsnittet): pil i høyre ende. */
function OpenDimension({ x1, x2, y, laneY, color, label, f, ss }: { x1: number; x2: number; y: number; laneY: number; color: string; label: ReactNode; f: number; ss: number }) {
  if (!(x2 - x1 > 4)) return null;
  const h = 9 * ss;
  return (
    <g>
      <line x1={x1} y1={laneY} x2={x1} y2={y + 5} stroke={color} strokeWidth={1 * ss} opacity={0.55} strokeDasharray="3 3" />
      <line x1={x1} y1={y} x2={x2} y2={y} stroke={VIZ.surface} strokeWidth={4 * ss} opacity={0.8} />
      <line x1={x1} y1={y} x2={x2 - 2} y2={y} stroke={color} strokeWidth={1.4 * ss} strokeDasharray={`${8 * ss} ${4 * ss}`} />
      <polygon points={`${x1},${y} ${x1 + h},${y - h * 0.42} ${x1 + h},${y + h * 0.42}`} fill={color} />
      <polygon points={`${x2},${y} ${x2 - h * 1.3},${y - h * 0.6} ${x2 - h * 1.3},${y + h * 0.6}`} fill={color} />
      {label !== undefined && (
        <Txt x={(x1 + x2) / 2} y={y - 9 * f} size={0.9} color={color} weight={650}>
          {label}
        </Txt>
      )}
    </g>
  );
}

/* ---------- v-t-graf ---------- */

function SpeedGraph({ lanes, D, t, height }: { lanes: Lane[]; D: number; t: number; height: number }) {
  const f = useTextScale();
  const m = lanes[0]!;
  const h = lanes[1];
  const { input: main, res: r, obs: o } = m;
  const [, tMax] = niceRange(0, r.tStop, 5, 1);
  // Luft over v₀ til etiketten «Treffer elgen …» øverst i grafen
  const [, vMax] = niceRange(0, main.v0 * 1.25, 5, 5);
  return (
    <Plot
      x={{ min: 0, max: tMax, label: 'Tid t etter at sjåføren ser elgen (s)', decimals: tMax < 4 ? 1 : 0 }}
      y={{ min: 0, max: vMax, label: 'Fart v (m/s)' }}
      width={800}
      height={height}
      margin={{ top: 46 * f, right: 24 * f, bottom: 56 * f, left: 72 * f }}
    >
      {({ sx, sy, x0, x1, y0, y1 }) => {
        const rectW = sx(main.tr) - sx(0);
        const rectH = sy(0) - sy(main.v0);
        const triW = sx(r.tStop) - sx(main.tr);
        // Med sammenligningen på går den stiplede grafen under v₀/2, så etiketten for s_b legges over v₀/2,
        // til venstre for den skrå linja.
        let brake = { x: sx(main.tr) + triW * 0.26, y: sy(main.v0 * 0.42) + 6, w: triW * 0.5, h: rectH / 3 };
        if (h) {
          const y = sy(main.v0 * 0.5) - 10;
          const vTop = main.v0 * Math.min(1, (sy(0) - (y - 14 * f)) / rectH);
          const xDiag = sx(main.tr) + triW * (1 - vTop / main.v0);
          brake = { x: (sx(main.tr) + xDiag) / 2, y, w: xDiag - sx(main.tr) - 16, h: rectH / 2 - 10 };
        }
        // Ved et treff kjører bilen bare fram til tHit: arealet etter treffet er det bilen ikke rakk å kjøre.
        const tCut = o.hits ? o.tEnd : r.tStop;
        const tc = Math.max(main.tr, tCut);
        const vc = stopVelocity(main, tc);
        const driven = `M${sx(main.tr)},${sy(0)} L${sx(main.tr)},${sy(main.v0)} L${sx(tc)},${sy(vc)} L${sx(tc)},${sy(0)} Z`;
        const rest = `M${sx(tc)},${sy(0)} L${sx(tc)},${sy(vc)} L${sx(r.tStop)},${sy(0)} Z`;
        const rectCut = o.hits && o.beforeBraking ? sx(o.tEnd) : sx(main.tr);
        // Stigningstallet på bremselinja er −a: etiketten står over midten av den delen bilen kjører.
        const slopeT = main.tr + (tc - main.tr) * 0.5;
        const segLen = Math.hypot(sx(tc) - sx(main.tr), sy(vc) - sy(main.v0));
        const aTxt = `−${fmt(main.a, 1)} m/s²`;
        const slopeText = [`stigningstall = −a = ${aTxt}`, `stigningstall ${aTxt}`, aTxt].find((txt) => txt.length * 15 * f * 0.6 + 24 * f < segLen);
        const ang = (Math.atan2(sy(0) - sy(main.v0), sx(r.tStop) - sx(main.tr)) * 180) / Math.PI;
        const sxp = sx(slopeT);
        const syp = sy(stopVelocity(main, slopeT));
        const nOff = 14 * f;
        const rad = (ang * Math.PI) / 180;
        const lx = sxp - Math.sin(rad) * nOff;
        const ly = syp - Math.cos(rad) * nOff;
        return (
          <g>
            <text x={x0} y={y1 - 20 * f} className="viz-label" style={{ fontWeight: 700 }}>
              {f > 1.3 ? 'v-t-graf: areal = strekning' : 'v-t-graf: arealet under grafen er strekningen'}
            </text>
            {/* Reaksjonstiden: rektangel (konstant fart) */}
            <rect x={sx(0)} y={sy(main.v0)} width={Math.max(0, rectCut - sx(0))} height={rectH} fill={C_REACT} opacity={0.28} />
            {o.hits && o.beforeBraking && <rect x={rectCut} y={sy(main.v0)} width={Math.max(0, sx(main.tr) - rectCut)} height={rectH} fill={C_REACT} opacity={0.1} />}
            {/* Bremsingen: trekant (farten avtar jevnt) */}
            {!(o.hits && o.beforeBraking) && <path d={driven} fill={C_BRAKE} opacity={0.28} />}
            <path d={o.hits && o.beforeBraking ? `M${sx(main.tr)},${sy(0)} L${sx(main.tr)},${sy(main.v0)} L${sx(r.tStop)},${sy(0)} Z` : rest} fill={C_BRAKE} opacity={o.hits ? 0.1 : 0.28} />
            {/* Grafen: hel strek der bilen faktisk kjører, stiplet der den ville ha kjørt uten elgen */}
            <polyline
              points={o.hits ? actualPoints(main, o, sx, sy) : `${sx(0)},${sy(main.v0)} ${sx(main.tr)},${sy(main.v0)} ${sx(r.tStop)},${sy(0)}`}
              fill="none"
              stroke={VIZ.ink}
              strokeWidth={3}
              strokeLinejoin="round"
            />
            {o.hits && (
              <polyline
                points={plannedAfter(main, o, sx, sy)}
                fill="none"
                stroke={VIZ.ink}
                strokeWidth={2}
                strokeDasharray="5 5"
                strokeLinejoin="round"
                opacity={0.55}
              />
            )}
            <AreaLabel x={sx(0) + rectW / 2} y={sy(main.v0 * 0.75) + 6} w={rectW} h={rectH / 2} color={C_REACT} sub="r" value={r.sr} f={f} />
            <AreaLabel {...brake} color={C_BRAKE} sub="b" value={r.sb} f={f} />
            {slopeText && !(o.hits && o.beforeBraking) && (
              <text
                x={lx}
                y={ly}
                textAnchor="middle"
                className="viz-label"
                transform={`rotate(${ang} ${lx} ${ly})`}
                style={{ fill: VIZ.acceleration, fontSize: 15 * f, fontWeight: 700 }}
              >
                {slopeText}
              </text>
            )}
            {o.hits && <HitMarker x={sx(o.tEnd)} y={sy(vMax) + 16 * f} y0={y0} yTop={sy(vMax)} xMin={x0} xMax={x1} vHit={o.vHit} f={f} />}
            {h && (
              <polyline
                points={h.obs.hits ? actualPoints(h.input, h.obs, sx, sy) : `${sx(0)},${sy(h.input.v0)} ${sx(h.input.tr)},${sy(h.input.v0)} ${sx(h.res.tStop)},${sy(0)}`}
                fill="none"
                stroke={VIZ.velocity}
                strokeWidth={2.5}
                strokeDasharray="7 6"
                strokeLinejoin="round"
              />
            )}
            {t > 0 && <line x1={sx(Math.min(t, tMax))} x2={sx(Math.min(t, tMax))} y1={sy(vMax)} y2={y0} className="viz-guide" />}
            {h && t > 0 && <ColorDot x={sx(Math.min(t, tMax))} y={sy(carVelocity(h.input, D, t))} color={VIZ.velocity} r={6} />}
            <ColorDot x={sx(Math.min(t, tMax))} y={sy(carVelocity(main, D, t))} color={VIZ.ink} />
          </g>
        );
      }}
    </Plot>
  );
}

/**
 * Loddrett strek der bilen treffer elgen, med etikett på den siden det er plass (helst til høyre). Får ikke hele
 * teksten plass, brukes en kortere.
 */
function HitMarker({ x, y, y0, yTop, xMin, xMax, vHit, f }: { x: number; y: number; y0: number; yTop: number; xMin: number; xMax: number; vHit: number; f: number }) {
  const texts = [`Treffer elgen i ${kmhText(vHit)}`, `Treff i ${kmhText(vHit)}`, 'Treff'];
  const width = (txt: string) => txt.length * 17 * f * 0.58;
  const right = xMax - (x + 8);
  const left = x - 8 - (xMin + 6);
  let pick: { text: string; side: 'start' | 'end' } | null = null;
  for (const text of texts) {
    if (width(text) <= right) pick = { text, side: 'start' };
    else if (width(text) <= left) pick = { text, side: 'end' };
    if (pick) break;
  }
  return (
    <g>
      <line x1={x} x2={x} y1={yTop} y2={y0} stroke={VIZ.ink} strokeWidth={1.2} strokeDasharray="2 4" opacity={0.6} />
      {pick && (
        <Label x={pick.side === 'start' ? x + 8 : x - 8} y={y} anchor={pick.side}>
          {pick.text}
        </Label>
      )}
    </g>
  );
}

/** Punktene i v-t-grafen fram til treffet, og loddrett ned til v = 0 (bilen stanser brått i elgen). */
function actualPoints(input: StopInput, o: ObstacleResult, sx: (v: number) => number, sy: (v: number) => number): string {
  const pts: [number, number][] = [[0, input.v0]];
  if (o.beforeBraking) pts.push([o.tEnd, input.v0]);
  else pts.push([input.tr, input.v0], [o.tEnd, o.vHit]);
  pts.push([o.tEnd, 0]);
  return pts.map(([tt, vv]) => `${sx(tt)},${sy(vv)}`).join(' ');
}

/** Resten av grafen uten elgen: fra treffet til bilen ville ha stått stille. */
function plannedAfter(input: StopInput, o: ObstacleResult, sx: (v: number) => number, sy: (v: number) => number): string {
  const r = stopping(input);
  const pts: [number, number][] = [[o.tEnd, o.vHit]];
  if (o.beforeBraking) pts.push([input.tr, input.v0]);
  pts.push([r.tStop, 0]);
  return pts.map(([tt, vv]) => `${sx(tt)},${sy(vv)}`).join(' ');
}

/** «s_r = 22,2 m» i et område av grafen, eller bare «s_r» når det er trangt. */
function AreaLabel({ x, y, w, h, color, sub, value, f }: { x: number; y: number; w: number; h: number; color: string; sub: string; value: number; f: number }) {
  if (h < 24 * f) return null;
  const long = `s${sub} = ${fmt(value, 1)} m`;
  if (w > long.length * 10 * f)
    return (
      <Label x={x} y={y} color={color}>
        s<TSub>{sub}</TSub> = {fmt(value, 1)} m
      </Label>
    );
  if (w < 3 * 10 * f) return null;
  return (
    <Label x={x} y={y} color={color}>
      s<TSub>{sub}</TSub>
    </Label>
  );
}

/* ---------- Forklaring ---------- */

function explanation(kmh: number, tr: number, a: number, D: number, r: StopResult, rh: StopResult, o: ObstacleResult, oh: ObstacleResult, compare: boolean): ReactNode {
  const dryRatio = BRAKE_PRESETS.torr / a;
  const reactionShare = r.sr / r.total;
  const cars = r.total / BIL_MAAL.lengde;
  const dry = stopping({ v0: kmhToMs(kmh), tr, a: BRAKE_PRESETS.torr });
  const safeKmh = msToKmh(speedForStoppingDistance(dry.total, tr, a));
  const safeD = msToKmh(speedForStoppingDistance(D, tr, a));
  const s30 = stopping({ v0: kmhToMs(30), tr, a }).total;
  const s50 = stopping({ v0: kmhToMs(50), tr, a }).total;
  return (
    <>
      <p>
        <strong>Reaksjonslengden er proporsjonal med farten, men bremselengden er proporsjonal med kvadratet av farten:</strong> dobbel fart gir
        dobbelt så lang reaksjonslengde, men fire ganger så lang bremselengde. Ved halv fart ({halfText(kmh)}) blir reaksjonslengden halvparten (
        {fmt(rh.sr, 1)} m), men bremselengden bare en fjerdedel ({fmt(rh.sb, 1)} m).{' '}
        {compare
          ? 'I v-t-grafen ser du hvorfor: trekanten blir både halvparten så høy og halvparten så bred, så arealet blir en fjerdedel.'
          : 'Slå på sammenligningen med halv fart for å se hvorfor i v-t-grafen.'}{' '}
        Under bremsingen peker akselerasjonen motsatt vei av farten, så farten avtar med {fmt(a, 1)} m/s hvert sekund: stigningstallet i v-t-grafen
        er −a.
      </p>
      <p>
        {o.hits ? (
          o.beforeBraking ? (
            <>
              <strong>Bilen treffer elgen før sjåføren rekker å bremse.</strong> Elgen står {fmt(D, 0)} m unna, men bilen kjører{' '}
              {fmt(r.sr, 1)} m bare i reaksjonstiden.
            </>
          ) : (
            <>
              <strong>Bilen rekker ikke å stoppe og treffer elgen i {kmhText(o.vHit)}.</strong> Etter reaksjonstiden er det bare{' '}
              {fmt(o.braked, 1)} m igjen å bremse på, men bilen trenger {fmt(r.sb, 1)} m.
            </>
          )
        ) : (
          <>
            <strong>Bilen stopper {fmt(o.margin, 1)} m foran elgen.</strong> Stopplengden er {fmt(r.total, 1)} m, like langt som{' '}
            {fmt(cars, 0)} biler etter hverandre.
          </>
        )}{' '}
        {compare &&
          (oh.hits
            ? `Med halv fart treffer bilen også elgen, men bare i ${kmhText(oh.vHit)}.`
            : o.hits
              ? `Med halv fart ville bilen ha stoppet ${fmt(oh.margin, 1)} m foran elgen.`
              : `Med halv fart stopper bilen allerede etter ${fmt(rh.total, 1)} m.`)}{' '}
        {o.hits && safeD >= 1 && `For å stoppe før elgen måtte farten ha vært høyst ${fmt(Math.floor(safeD), 0)} km/h.`}
      </p>
      <p>
        {a < BRAKE_PRESETS.torr
          ? `Med bremseakselerasjon ${fmt(a, 1)} m/s² blir bremselengden ${fmt(dryRatio, 1)} ganger så lang som på tørr asfalt (8,0 m/s²). Det er derfor du må senke farten på glatt føre: for å stoppe like kort som i ${fmt(kmh, 0)} km/h på tørr asfalt, må farten ned til ${fmt(safeKmh, 0)} km/h.`
          : reactionShare > 0.5
            ? `Her er reaksjonslengden mer enn halvparten av stopplengden.${kmh <= 50 && tr < 1.8 ? ' Ved lav fart betyr reaksjonstiden mest.' : ''}`
            : `Her er bremselengden ${fmt(r.sb / r.sr, 1)} ganger så lang som reaksjonslengden.`}
        {a >= BRAKE_PRESETS.torr &&
          tr < 1.8 &&
          ` Det er derfor fartsgrensen ofte er 30 km/h ved skoler: med samme reaksjonstid og bremser stopper bilen på ${fmt(s30, 1)} m fra 30 km/h, men trenger ${fmt(s50, 1)} m fra 50 km/h.`}
        {tr >= 1.8
          ? ` En reaksjonstid på ${fmt(tr, 1)} s er lang, og typisk når sjåføren er uoppmerksom, for eksempel ser på mobilen. Det er derfor det er farlig å bruke mobilen når du kjører: bilen kjører ${fmt(r.sr, 0)} m før du i det hele tatt begynner å bremse.`
          : ''}
      </p>
    </>
  );
}
