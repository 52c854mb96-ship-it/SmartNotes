/**
 * Figurene i eksempeloppgaven «Sola som svart legeme» (k6-eks-sola): spekteret som satellitten måler (graf), og en
 * scene i verdensrommet som bygger seg opp med stegene.
 *
 *   Oversikt (a–d): Sola med radius R, planeten i avstanden r og satellitten. b) én kvadratmeter av soloverflaten,
 *   c) hele overflaten 4πR² og den totale effekten P, d) den tenkte kuleflaten 4πr² gjennom planeten og intensiteten S.
 *   Planeten (e): sollyset treffer tverrsnittet πR_p², en del reflekteres, og varmestrålingen går ut fra hele kula.
 *
 * Gjenstander som ikke finnes i scene-kit-et (satellitten og Venus) er laget her, i samme stil. Scenen er mørk i
 * begge temaene, så teksten oppå den er lys med mørk kant (NightTxt).
 */
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { Dot, Figure, Plot, TSub, TSup, Txt, VIZ, fmt, linePath } from '../../kit';
import {
  Foton,
  LinearGradient,
  Lysstraale,
  Planet,
  RadialGradient,
  SCENE,
  Sol,
  Stjernehimmel,
  ValueTag,
  alpha,
  bolgelengdeFarge,
  mix,
  shade,
  sphereStops,
  tint,
  useStrokeScale,
  useSvgId,
} from '../../kit/scene';
import {
  LAMBDA_PEAK_NM,
  fmtSigPlain,
  fmtStd,
  roundSig,
  spectrumAt,
  spectrumCurve,
  spectrumYMax,
  toCelsius,
  type PlanetId,
  type SunSolution,
  type SunTask,
} from './model-eks-sola';

/** Sollys og varmestråling i samme farger som i «Strålingsbalansen til jorda». */
const SUNLIGHT = VIZ.series[1];
const HEAT = VIZ.series[4];
const W = 800;
const RAD = Math.PI / 180;

/** Hva figuren viser: oppgaven, ett av stegene eller hele løsningen. */
export type SunView = 'oppgave' | 'a1' | 'a2' | 'b1' | 'c1' | 'c2' | 'd1' | 'd2' | 'e1' | 'e2' | 'e3' | 'alle';

const ORDER: SunView[] = ['oppgave', 'a1', 'a2', 'b1', 'c1', 'c2', 'd1', 'd2', 'e1', 'e2', 'e3'];
/** Om figuren er kommet til (eller forbi) steget `v`. «alle» viser alt. */
const reached = (view: SunView, v: SunView) => view === 'alle' || ORDER.indexOf(view) >= ORDER.indexOf(v);
const among = (view: SunView, list: SunView[]) => view === 'alle' || list.includes(view);

/** S med tre gjeldende siffer: «1,38 kW/m²» over 1 000 W/m², ellers «598 W/m²». */
export function fmtS(S: number): string {
  return S >= 1000 ? `${fmt(roundSig(S, 3) / 1000, 2)} kW/m²` : `${fmtSigPlain(S, 3)} W/m²`;
}

/* ---------- Tekststørrelsen før figuren tegnes ---------- */

/**
 * Tekstskaleringen figuren vil få (1 på PC, ca. 1,8 på mobil), målt på beholderen, så viewBox-høyden og plassen til
 * etikettene kan velges før figuren tegnes. Samme regel som i Figure.
 */
function useContainerTextScale<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [f, setF] = useState(1);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const update = () => {
      const w = el.getBoundingClientRect().width - (window.innerWidth <= 600 ? 10 : 18);
      if (w <= 0) return;
      setF(Math.round(Math.max(1, 12.5 / 17 / (w / W)) * 20) / 20);
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, f] as const;
}

/* ---------- Alle figurene ---------- */

export function SunFigures({ task, s, view }: { task: SunTask; s: SunSolution; view: SunView }) {
  const [ref, f] = useContainerTextScale<HTMLDivElement>();
  const planetView = view === 'e1' || view === 'e2' || view === 'e3';
  return (
    <div ref={ref} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {!planetView && <OverviewScene task={task} s={s} view={view} f={f} />}
      {(planetView || view === 'alle') && <PlanetScene task={task} s={s} view={view} f={f} />}
      <SpectrumGraph task={task} s={s} view={view} f={f} />
    </div>
  );
}

/* ---------- Felles tegning i verdensrommet ---------- */

/** Lys tekst med mørk kant, til etiketter oppå stjernehimmelen (mørk også i lyst tema). */
function NightTxt({
  x,
  y,
  children,
  anchor = 'middle',
  size = 0.9,
  weight = 650,
  color,
  muted,
}: {
  x: number;
  y: number;
  children: ReactNode;
  anchor?: 'start' | 'middle' | 'end';
  size?: number;
  weight?: number;
  color?: string;
  muted?: boolean;
}) {
  const style: CSSProperties & Record<'--kj-fs', number> = {
    fill: color ?? (muted ? mix(SCENE.star, SCENE.space, 0.32) : SCENE.star),
    stroke: SCENE.space,
    fontWeight: weight,
    '--kj-fs': size,
  };
  return (
    <text x={x} y={y} textAnchor={anchor} className="kj-txt" style={style}>
      {children}
    </text>
  );
}

/** Tynn strek fra et punkt til en etikett, i lys farge på mørk bunn. */
function NightLine({ x1, y1, x2, y2, dashed }: { x1: number; y1: number; x2: number; y2: number; dashed?: boolean }) {
  const ss = useStrokeScale();
  return (
    <line
      x1={x1}
      y1={y1}
      x2={x2}
      y2={y2}
      stroke={SCENE.star}
      strokeWidth={1.3 * ss}
      strokeDasharray={dashed ? `${5 * ss} ${4 * ss}` : undefined}
      opacity={0.8}
    />
  );
}

/** Vannrett mållinje med piler i begge ender og etiketten over midten (lys på mørk bunn). */
function NightDim({ x1, x2, y, label }: { x1: number; x2: number; y: number; label: ReactNode }) {
  const ss = useStrokeScale();
  const a = 9 * ss;
  return (
    <g>
      <line x1={x1 + 2} y1={y} x2={x2 - 2} y2={y} stroke={SCENE.star} strokeWidth={1.6 * ss} />
      <path d={`M${x1} ${y}l${a} ${-a * 0.45}v${a * 0.9}Z`} fill={SCENE.star} />
      <path d={`M${x2} ${y}l${-a} ${-a * 0.45}v${a * 0.9}Z`} fill={SCENE.star} />
      <NightTxt x={(x1 + x2) / 2} y={y - 9 * ss} size={0.95} weight={700}>
        {label}
      </NightTxt>
    </g>
  );
}

/** Planeten i oppgaven: Planet fra scene-kit-et for jorda og Mars, og en egen Venus (skydekket, uten kart). */
function PlanetBody({ id, x, y, r, fase = 0.62 }: { id: PlanetId; x: number; y: number; r: number; fase?: number }) {
  if (id === 'venus') return <Venus x={x} y={y} r={r} fase={fase} />;
  return <Planet x={x} y={y} r={r} type={id === 'mars' ? 'mars' : 'jorda'} rotate={id === 'jorda' ? 23.4 : 25} lysretning={180} fase={fase} />;
}

/**
 * Venus sett fra siden med lyset fra venstre: et tett, blekgult skydekke med svake bånd (ingen overflate synes),
 * en myk skillelinje mellom dag og natt og en tynn, lys dis i kanten. Ankerpunkt: sentrum.
 */
function Venus({ x, y, r, fase = 0.62 }: { x: number; y: number; r: number; fase?: number }) {
  const ss = useStrokeScale();
  const base = useSvgId('venus');
  const night = useSvgId('venus-natt');
  const haze = useSvgId('venus-dis');
  const clip = useSvgId('venus-klipp');
  const cloud = mix('var(--sc-rom-jupiter-sone)', 'var(--sc-rom-sol)', 0.28);
  const nightColor = 'var(--sc-rom-natt)';
  // Skillelinja mellom dag og natt: fase 0,5 = midt på skiva, større fase = mer dagside.
  const edge = Math.min(0.95, Math.max(0.05, fase));
  const bands = [-0.62, -0.34, -0.08, 0.2, 0.46, 0.7];
  return (
    <g transform={`translate(${x} ${y})`}>
      <defs>
        <clipPath id={clip}>
          <circle r={r} />
        </clipPath>
      </defs>
      <RadialGradient id={haze} stops={[[0.86, tint(cloud, 0.3), 0], [0.95, tint(cloud, 0.4), 0.55], [1, tint(cloud, 0.4), 0]]} />
      <circle r={r * 1.06} fill={`url(#${haze})`} />
      <RadialGradient id={base} fx={0.3} fy={0.42} stops={sphereStops(cloud)} />
      <circle r={r} fill={`url(#${base})`} />
      <g clipPath={`url(#${clip})`} opacity={0.5}>
        {bands.map((b, i) => (
          <path
            key={i}
            d={`M${-r * 1.1} ${r * b}C${-r * 0.4} ${r * (b - 0.1)} ${r * 0.3} ${r * (b + 0.12)} ${r * 1.1} ${r * (b + 0.02)}`}
            fill="none"
            stroke={i % 2 === 0 ? shade(cloud, 0.16) : tint(cloud, 0.35)}
            strokeWidth={r * (i % 2 === 0 ? 0.11 : 0.07)}
            strokeLinecap="round"
          />
        ))}
      </g>
      <LinearGradient
        id={night}
        x2={1}
        y2={0}
        stops={[
          [0, nightColor, 0],
          [Math.max(0, edge - 0.12), nightColor, 0],
          [edge, nightColor, 0.45],
          [Math.min(1, edge + 0.14), nightColor, 0.8],
          [1, nightColor, 0.85],
        ]}
      />
      <circle r={r} fill={`url(#${night})`} />
      <circle r={r} fill="none" stroke={SCENE.outline} strokeWidth={0.9 * ss} opacity={0.65} />
    </g>
  );
}

/**
 * Satellitt eller romsonde: kropp i gullfolie, to solcellepaneler og en parabolantenne, sett fra siden. `size` er
 * spennvidden over panelene. Ankerpunkt: midten av kroppen.
 */
function Satellitt({ x, y, size }: { x: number; y: number; size: number }) {
  const ss = useStrokeScale();
  const foil = useSvgId('sat-folie');
  const cell = useSvgId('sat-celle');
  const solar = 'var(--sc-lab-solar)';
  const b = size * 0.22;
  const pw = size * 0.36;
  const ph = size * 0.17;
  const panels = [-1, 1].map((side) => {
    const px = side < 0 ? -b / 2 - size * 0.06 - pw : b / 2 + size * 0.06;
    const cols = [1, 2].map((i) => px + (pw * i) / 3);
    return (
      <g key={side}>
        <line x1={(side * b) / 2} y1={0} x2={side < 0 ? px + pw : px} y2={0} stroke={SCENE.metal} strokeWidth={1.4 * ss} />
        <rect x={px} y={-ph / 2} width={pw} height={ph} fill={`url(#${cell})`} stroke={shade(solar, 0.4)} strokeWidth={0.8 * ss} />
        {cols.map((cx) => (
          <line key={cx} x1={cx} y1={-ph / 2} x2={cx} y2={ph / 2} stroke={tint(solar, 0.35)} strokeWidth={0.6 * ss} opacity={0.7} />
        ))}
        <line x1={px} y1={0} x2={px + pw} y2={0} stroke={tint(solar, 0.35)} strokeWidth={0.6 * ss} opacity={0.7} />
      </g>
    );
  });
  return (
    <g transform={`translate(${x} ${y})`}>
      <LinearGradient id={foil} x2={1} y2={1} stops={[[0, tint(SCENE.gold, 0.35)], [0.45, SCENE.gold], [1, shade(SCENE.gold, 0.35)]]} />
      <LinearGradient id={cell} x2={1} y2={1} stops={[[0, tint(solar, 0.2)], [0.5, solar], [1, shade(solar, 0.25)]]} />
      {panels}
      <rect x={-b / 2} y={-b / 2} width={b} height={b} rx={b * 0.12} fill={`url(#${foil})`} stroke={SCENE.outline} strokeWidth={0.8 * ss} />
      {/* Antenna mot venstre (mot jorda er ikke poenget her; den peker bort fra panelene) */}
      <line x1={0} y1={-b / 2} x2={0} y2={-b / 2 - size * 0.1} stroke={SCENE.metal} strokeWidth={1.2 * ss} />
      <ellipse cx={0} cy={-b / 2 - size * 0.12} rx={size * 0.1} ry={size * 0.035} fill={SCENE.metalLight} stroke={SCENE.outline} strokeWidth={0.6 * ss} />
    </g>
  );
}

/* ---------- Oversikten: Sola, kuleflaten og planeten ---------- */

interface OverviewLayout {
  H: number;
  k: number;
  rowA: number;
  rowB: number;
  cx: number;
  cy: number;
  sunR: number;
  px: number;
  pr: number;
  rDimY: number;
}

function overviewLayout(f: number): OverviewLayout {
  const k = Math.max(1, 0.85 * f);
  const rowA = 30 * f;
  const rowB = rowA + 36 * f;
  const sunR = 110;
  const cy = rowB + 16 * f + 14 + sunR;
  const rDimY = cy + sunR + 30 * f;
  return { H: rDimY + 22 * f, k, rowA, rowB, cx: 165, cy, sunR, px: 690, pr: 17 * k, rDimY };
}

/** Bredden på en ValueTag med teksten `text` (samme regel som i ValueTag). */
const tagWidth = (text: string, f: number, size = 0.9) => {
  const fs = 17 * f * size;
  return Math.max(fs * 1.6, text.length * fs * 0.6 + 16 * f);
};

function OverviewScene({ task, s, view, f }: { task: SunTask; s: SunSolution; view: SunView; f: number }) {
  const L = overviewLayout(f);
  const { H, k, rowA, rowB, cx, cy, sunR, px, pr, rDimY } = L;
  const showT = reached(view, 'a2');
  const showPatch = among(view, ['b1']);
  const showRing = among(view, ['c1', 'c2']);
  const showP = among(view, ['c2', 'd1', 'd2']);
  const allRays = reached(view, 'c2');
  const showSphere = among(view, ['d1', 'd2']);
  const showS = among(view, ['d2']);
  const Rs = px - cx;
  const sTag = `S = ${fmtS(s.S)}`;
  const sTagX = Math.min(px, W - 8 - tagWidth(sTag, f) / 2);

  // Kuleflaten med radius r: buen mellom toppen og bunnen av figuren.
  const arc = (() => {
    const top = Math.asin(Math.max(-1, (0 - cy) / Rs));
    const bot = Math.asin(Math.min(1, (H - cy) / Rs));
    const p = (a: number) => `${cx + Rs * Math.cos(a)} ${cy + Rs * Math.sin(a)}`;
    return `M${p(top)}A${Rs} ${Rs} 0 0 1 ${p(bot)}`;
  })();
  const arcLabelX = cx + Math.sqrt(Math.max(0, Rs * Rs - (cy - rowA) ** 2)) - 14;

  // Strålene i vifta mot planeten (den midterste treffer planeten).
  const fan = [-12, -6, 0, 6, 12].map((deg) => {
    const a = deg * RAD;
    const len = deg === 0 ? px - pr - cx - 2 : Rs + 50;
    return { x1: cx + (sunR + 6) * Math.cos(a), y1: cy + (sunR + 6) * Math.sin(a), x2: cx + len * Math.cos(a), y2: cy + len * Math.sin(a), deg };
  });
  // Stråler i alle retninger (c): Sola stråler fra hele overflaten.
  const around = [-160, -130, -50, 120, 155, 180].map((deg) => {
    const a = deg * RAD;
    return { x1: cx + (sunR + 8) * Math.cos(a), y1: cy + (sunR + 8) * Math.sin(a), x2: cx + (sunR + 46) * Math.cos(a), y2: cy + (sunR + 46) * Math.sin(a) };
  });

  // Én kvadratmeter av soloverflaten (b), oppe til høyre på skiva.
  const pa = -38 * RAD;
  const patch = { x: cx + (sunR - 9) * Math.cos(pa), y: cy + (sunR - 9) * Math.sin(pa) };
  const patchOut = { x: cx + (sunR + 30) * Math.cos(pa), y: cy + (sunR + 30) * Math.sin(pa) };
  const ringPt = { x: cx + (sunR + 5) * Math.cos(38 * RAD), y: cy + (sunR + 5) * Math.sin(38 * RAD) };
  const ringLabel = { x: cx + sunR + 36, y: cy + sunR - 8 };
  const rAngle = 148 * RAD;

  const label =
    view === 'oppgave'
      ? `Sola med radius R og ${task.name} i avstanden r, med en satellitt som måler sollyset. Ikke i målestokk.`
      : `Sola og ${task.name}. ${showSphere ? `Effekten fra Sola fordeler seg på en kuleflate med radius r, så intensiteten ved ${task.name} er ${fmtS(s.S)}.` : showP ? `Sola stråler ut ${fmtStd(s.P, 3)} W fra hele overflaten.` : `Overflatetemperaturen til Sola er ${fmt(s.T, 0)} K.`}`;

  return (
    <Figure viewBox={`0 0 ${W} ${H}`} label={label} maxHeight={480} caption="Avstandene og størrelsene er ikke i målestokk.">
      <Stjernehimmel x={-200} y={-100} w={W + 400} h={H + 200} seed={11} melkevei={0.35} />
      {showSphere && (
        <g>
          <path d={arc} fill="none" stroke={alpha(tint(SUNLIGHT, 0.45), 0.2)} strokeWidth={22} />
          <path d={arc} fill="none" stroke={SCENE.star} strokeWidth={1.6} strokeDasharray="7 6" opacity={0.85} />
        </g>
      )}
      {fan.map((r) => (
        <Lysstraale key={r.deg} x1={r.x1} y1={r.y1} x2={r.x2} y2={r.y2} hvit bredde={2.6} styrke={r.deg === 0 ? 1 : 0.75} pil={r.deg === 0 || Math.abs(r.deg) === 12} />
      ))}
      {allRays && around.map((r, i) => <Lysstraale key={i} x1={r.x1} y1={r.y1} x2={r.x2} y2={r.y2} hvit bredde={2.2} styrke={0.7} />)}
      <Sol x={cx} y={cy} r={sunR} korona={0.6} flekker={2} seed={9} />
      {showRing && (
        <circle cx={cx} cy={cy} r={sunR + 5} fill="none" stroke={SUNLIGHT} strokeWidth={4.5} strokeDasharray="12 7" />
      )}

      {/* Radien R, inne på skiva */}
      <line x1={cx} y1={cy} x2={cx + sunR * Math.cos(rAngle)} y2={cy + sunR * Math.sin(rAngle)} stroke={SCENE.space} strokeWidth={2.2} opacity={0.75} />
      <circle cx={cx} cy={cy} r={3.2} fill={SCENE.space} opacity={0.8} />
      <Txt x={cx + 0.5 * sunR * Math.cos(rAngle) + 6} y={cy + 0.5 * sunR * Math.sin(rAngle) + 24} anchor="middle" size={1} weight={700}>
        R
      </Txt>

      {/* Planeten med satellitten */}
      <PlanetBody id={task.planet} x={px} y={cy} r={pr} />
      <Satellitt x={px - 32 * k} y={cy + 34 * k} size={40 * k} />

      {/* Avstanden r fra sentrum av Sola til planeten */}
      <NightLine x1={cx} y1={cy + sunR * 0.55} x2={cx} y2={rDimY + 6} dashed />
      <NightLine x1={px} y1={cy + pr + 4} x2={px} y2={rDimY + 6} dashed />
      <NightDim x1={cx} x2={px} y={rDimY} label="r" />

      {showT && <ValueTag x={cx} y={rowB} text={`T = ${fmt(s.T, 0)} K`} pointer={Math.max(4, cy - sunR - 6 - (rowB + (17 * f * 0.9 * 1.55) / 2))} />}

      {showPatch && (
        <g>
          <g transform={`translate(${patch.x} ${patch.y}) rotate(${-38 + 90})`}>
            <rect x={-8 * k} y={-8 * k} width={16 * k} height={16 * k} fill={alpha(SUNLIGHT, 0.55)} stroke={SCENE.space} strokeWidth={1.6} />
          </g>
          {[-14, 0, 14].map((d) => {
            const a = pa + d * RAD * 0.6;
            return (
              <Lysstraale
                key={d}
                x1={patch.x + 10 * k * Math.cos(a)}
                y1={patch.y + 10 * k * Math.sin(a)}
                x2={patch.x + (34 + 6 * k) * Math.cos(a)}
                y2={patch.y + (34 + 6 * k) * Math.sin(a)}
                bolgelengde={590}
                bredde={2}
              />
            );
          })}
          <NightLine x1={patchOut.x + 4} y1={patchOut.y - 4} x2={300 - 6} y2={rowB + 4} />
          <NightTxt x={300} y={rowB + 6 * f} anchor="start" size={0.95}>
            Hver m²: {fmtStd(s.IShown, 2)} W
          </NightTxt>
        </g>
      )}

      {showRing && (
        <g>
          <NightLine x1={ringPt.x + 3} y1={ringPt.y + 3} x2={ringLabel.x - 6} y2={ringLabel.y - 6 * f} />
          <NightTxt x={ringLabel.x} y={ringLabel.y} anchor="start" size={0.95} color={tint(SUNLIGHT, 0.35)}>
            A = 4πR<TSup>2</TSup>
          </NightTxt>
        </g>
      )}

      {showP && <ValueTag x={cx} y={rowA} text={`P = ${fmtStd(s.P, 3)} W`} />}

      {showSphere && (
        <NightTxt x={arcLabelX} y={rowA + 6 * f} anchor="end" size={0.95} color={tint(SUNLIGHT, 0.35)}>
          A = 4πr<TSup>2</TSup>
        </NightTxt>
      )}
      {showS && <ValueTag x={sTagX} y={cy - pr - 26 * f} text={sTag} pointer={sTagX === px ? 8 : undefined} />}
    </Figure>
  );
}

/* ---------- Planeten: inn = ut ---------- */

function PlanetScene({ task, s, view, f }: { task: SunTask; s: SunSolution; view: SunView; f: number }) {
  const ss = useStrokeScale();
  const L = overviewLayout(f);
  const { H, rowA, rowB, cy } = L;
  const narrow = f > 1.3;
  const pcx = narrow ? 400 : 430;
  const PR = narrow ? 95 : 85;
  const showT = reached(view, 'e2');
  const showMeasured = reached(view, 'e3');
  const disk = useSvgId('tverrsnitt');
  const atmId = useSvgId('atmosfaere');

  // Innkommende sollys: parallelle stråler fra venstre som treffer planeten, og to som så vidt går forbi.
  const hits = [-0.72, -0.24, 0.24, 0.72].map((d) => {
    const y = cy + d * PR;
    const x2 = pcx - Math.sqrt(PR * PR - (d * PR) ** 2);
    return { y, x2, d };
  });
  // Reflektert lys (skyer, is og snø sprer lyset): fra de ytterste treffpunktene skrått tilbake mot Sola, midt
  // mellom normalen og retningen tilbake.
  const reflected = [hits[0]!, hits[3]!].map((h) => {
    const nx = (h.x2 - pcx) / PR - 1;
    const ny = (h.y - cy) / PR;
    const n = Math.hypot(nx, ny);
    const len = 72;
    return { x1: h.x2 - 2, y1: h.y, x2: h.x2 + (nx / n) * len, y2: h.y + (ny / n) * len };
  });
  // Varmestrålingen går ut fra hele kula.
  const ir = [22.5, 67.5, 112.5, 157.5, 202.5, 247.5, 292.5, 337.5].map((deg) => {
    const a = deg * RAD;
    const r1 = PR + 8;
    const r2 = PR + 8 + (narrow ? 44 : 48);
    return { x1: pcx + r1 * Math.cos(a), y1: cy + r1 * Math.sin(a), x2: pcx + r2 * Math.cos(a), y2: cy + r2 * Math.sin(a), deg };
  });

  const Tc = toCelsius(s.Teq);
  const tText = `T = ${fmtSigPlain(s.Teq, 3)} K (${fmtSignedC(Tc)})`;
  const mText = `Målt: ${fmt(s.measuredT, 0)} K (${fmtSignedC(task.measuredC)})`;
  const atm = ATMOSPHERE[task.planet];
  const atmTh = atm.thickness * PR;
  const atmPt = { x: pcx + (PR + atmTh * 0.6) * Math.cos(-128 * RAD), y: cy + (PR + atmTh * 0.6) * Math.sin(-128 * RAD) };

  return (
    <Figure
      viewBox={`0 0 ${W} ${H}`}
      label={`${task.Name} fanger sollys på tverrsnittet πR², reflekterer en del og stråler ut varme fra hele overflaten 4πR².${showT ? ` Likevektstemperaturen blir ${fmtSigPlain(s.Teq, 3)} K.` : ''}${showMeasured ? ` Målt middeltemperatur er ${fmt(s.measuredT, 0)} K.` : ''}`}
      maxHeight={480}
    >
      <Stjernehimmel x={-200} y={-100} w={W + 400} h={H + 200} seed={31} melkevei={0.2} />
      {hits.map((h) => (
        <Lysstraale key={h.d} x1={14} y1={h.y} x2={h.x2 - 1} y2={h.y} hvit bredde={3} styrke={0.95} />
      ))}
      {[-1, 1].map((side) => (
        <Lysstraale key={side} x1={14} y1={cy + side * (PR + 3)} x2={W - 10} y2={cy + side * (PR + 3)} hvit bredde={2} styrke={0.45} pil={false} />
      ))}
      {reflected.map((r, i) => (
        <Lysstraale key={i} x1={r.x1} y1={r.y1} x2={r.x2} y2={r.y2} hvit bredde={2.2} styrke={0.6} />
      ))}
      <NightTxt x={reflected[1]!.x2 + 4} y={reflected[1]!.y2 + 20 * f} anchor="end" size={0.78} muted>
        reflektert
      </NightTxt>

      {showMeasured && atm.thickness > 0 && (
        <g>
          <RadialGradient id={atmId} stops={[[PR / (PR + atmTh), atm.color, 0.75], [1, atm.color, 0]]} />
          <circle cx={pcx} cy={cy} r={PR + atmTh} fill={`url(#${atmId})`} />
        </g>
      )}
      <PlanetBody id={task.planet} x={pcx} y={cy} r={PR} fase={0.58} />

      {/* Tverrsnittet πR²: skiva som fanger like mye sollys som kula */}
      <LinearGradient id={disk} x2={1} y2={0} stops={[[0, SUNLIGHT, 0.12], [0.5, SUNLIGHT, 0.32], [1, SUNLIGHT, 0.12]]} />
      <ellipse cx={pcx} cy={cy} rx={PR * 0.2} ry={PR} fill={`url(#${disk})`} stroke={SUNLIGHT} strokeWidth={2.4 * ss} strokeDasharray="8 5" />

      {ir.map((a) => (
        <Foton key={a.deg} x1={a.x1} y1={a.y1} x2={a.x2} y2={a.y2} farge={HEAT} bolgelengde={10000} amplitude={5} svingninger={3} />
      ))}

      <NightTxt x={20} y={rowA + 6 * f} anchor="start" size={0.95} color={tint(SUNLIGHT, 0.35)}>
        Inn: (1 − α) · S · πR<TSub>p</TSub>
        <TSup>2</TSup>
      </NightTxt>
      <NightTxt x={W - 20} y={rowA + 6 * f} anchor="end" size={0.95} color={tint(HEAT, 0.4)}>
        Ut: σT<TSup>4</TSup> · 4πR<TSub>p</TSub>
        <TSup>2</TSup>
      </NightTxt>
      {/* Skiva: etiketten til venstre for planeten, mellom de to midterste strålene */}
      <NightLine x1={pcx - PR * 0.2} y1={cy} x2={pcx - PR - 8} y2={cy} />
      <NightTxt x={pcx - PR - 12} y={cy + 6 * f} anchor="end" size={0.9}>
        πR<TSub>p</TSub>
        <TSup>2</TSup>
      </NightTxt>

      {showMeasured && (
        <g>
          <NightLine x1={atmPt.x} y1={atmPt.y} x2={narrow ? 40 : 200} y2={rowB + 2} />
          <NightTxt x={narrow ? 20 : 180} y={rowB + 6 * f} anchor="start" size={0.85} muted>
            {atm.label}
          </NightTxt>
        </g>
      )}

      {showT &&
        (narrow ? (
          <ValueTag x={showMeasured ? pcx - 5 : pcx} y={H - 26 * f} text={tText} anchor={showMeasured ? 'end' : 'middle'} />
        ) : (
          <ValueTag x={W - 20} y={cy - 20} text={tText} anchor="end" />
        ))}
      {showMeasured &&
        (narrow ? (
          <ValueTag x={pcx + 5} y={H - 26 * f} text={mText} anchor="start" />
        ) : (
          <ValueTag x={W - 20} y={cy + 20} text={mText} anchor="end" />
        ))}
    </Figure>
  );
}

const fmtSignedC = (c: number) => `${c < 0 ? '−' : ''}${fmt(Math.abs(c), 0)} °C`;

/** Atmosfæren i e3: tykkelsen (andel av radien, bare for å synes), fargen og etiketten. */
const ATMOSPHERE: Record<PlanetId, { thickness: number; color: string; label: string }> = {
  jorda: { thickness: 0.1, color: 'var(--sc-rom-atmosfaere)', label: 'Atmosfære med drivhusgasser' },
  mars: { thickness: 0.04, color: 'var(--sc-rom-mars-lys)', label: 'Svært tynn atmosfære' },
  venus: { thickness: 0.22, color: tint('var(--sc-rom-jupiter-sone)', 0.2), label: 'Tykk atmosfære av CO₂' },
};

/* ---------- Grafen: spekteret som satellitten måler ---------- */

const X_MAX = 2500;
const VIS_MIN = 380;
const VIS_MAX = 750;

function SpectrumGraph({ task, s, view, f }: { task: SunTask; s: SunSolution; view: SunView; f: number }) {
  const H = Math.round(250 + 160 * Math.min(1, (f - 1) / 0.8));
  const peak = spectrumAt(LAMBDA_PEAK_NM, s.T, task.R, task.r);
  const yMax = spectrumYMax(peak);
  const yStep = yMax <= 1 ? 0.2 : yMax <= 2.5 ? 0.5 : 1;
  const yTicks = Array.from({ length: Math.round(yMax / yStep) + 1 }, (_, i) => roundSig(i * yStep, 3) || 0);
  const pts = spectrumCurve(s.T, task.R, task.r, 60, X_MAX, 300);
  const showPeak = reached(view, 'a1');
  const showArea = among(view, ['d2']);
  return (
    <Figure
      viewBox={`0 0 ${W} ${H}`}
      label={`Spekteret til sollyset ved ${task.name}: intensitet per nanometer mot bølgelengden. Toppen ligger ved ${LAMBDA_PEAK_NM} nm.`}
      maxHeight={420}
    >
      <Plot
        width={W}
        height={H}
        x={{ min: 0, max: X_MAX, label: 'Bølgelengde λ (nm)', ticks: [0, 500, 1000, 1500, 2000, 2500] }}
        y={{ min: 0, max: yMax, label: 'W/(m² · nm)', ticks: yTicks, decimals: yStep < 1 ? 1 : 0 }}
      >
        {({ sx, sy, x0, x1, y0, y1 }) => {
          const area = `M${sx(pts[0]![0])} ${y0}L${linePath(pts, sx, sy).slice(1)}L${sx(X_MAX)} ${y0}Z`;
          const slices: ReactNode[] = [];
          for (let nm = VIS_MIN; nm < VIS_MAX; nm += 5) {
            const a = spectrumAt(nm, s.T, task.R, task.r);
            const b = spectrumAt(nm + 5, s.T, task.R, task.r);
            slices.push(
              <path
                key={nm}
                d={`M${sx(nm)} ${y0}L${sx(nm)} ${sy(a)}L${sx(nm + 5) + 0.4} ${sy(b)}L${sx(nm + 5) + 0.4} ${y0}Z`}
                fill={bolgelengdeFarge(nm + 2.5, false)}
                opacity={0.55}
              />,
            );
          }
          const minor = Array.from({ length: X_MAX / 100 + 1 }, (_, i) => i * 100).filter((v) => v % 500 !== 0);
          const px = sx(LAMBDA_PEAK_NM);
          const py = sy(peak);
          return (
            <g>
              {minor.map((v) => (
                <line key={v} x1={sx(v)} x2={sx(v)} y1={y0} y2={y1} stroke={VIZ.grid} strokeWidth={0.8} opacity={0.5} />
              ))}
              <path d={area} fill={showArea ? alpha(SUNLIGHT, 0.3) : alpha(VIZ.muted, 0.16)} />
              {slices}
              <path d={linePath(pts, sx, sy)} fill="none" stroke={VIZ.ink} strokeWidth={2.6} strokeLinejoin="round" />
              <Txt x={(x0 + sx(VIS_MIN)) / 2} y={y0 - 10 * f} size={0.72} muted>
                UV
              </Txt>
              <Txt x={(sx(VIS_MIN) + sx(VIS_MAX)) / 2} y={y0 - 10 * f} size={0.72} muted>
                synlig
              </Txt>
              <Txt x={sx(VIS_MAX) + 10} y={y0 - 10 * f} anchor="start" size={0.72} muted>
                infrarødt
              </Txt>
              <Txt x={x1 - 8} y={y1 + 18 * f} anchor="end" size={0.9} weight={700}>
                Spekteret ved {task.name}
              </Txt>
              {showPeak && (
                <g>
                  <line x1={px} x2={px} y1={py} y2={y0} stroke={VIZ.ink} strokeWidth={1.8} strokeDasharray="6 5" />
                  <Dot x={px} y={py} r={6} color={VIZ.ink} />
                  <Txt x={px + 12} y={py - 10} anchor="start" size={0.9} weight={700}>
                    λ<TSub>maks</TSub> = {LAMBDA_PEAK_NM} nm
                  </Txt>
                </g>
              )}
              {showArea && (
                <g>
                  <line x1={sx(1180)} y1={sy(peak * 0.5)} x2={sx(1000)} y2={sy(peak * 0.18)} stroke={VIZ.ink} strokeWidth={1.4} />
                  <circle cx={sx(1000)} cy={sy(peak * 0.18)} r={3.5} fill={VIZ.ink} />
                  <Txt x={sx(1180) + 4} y={sy(peak * 0.5) - 4} anchor="start" size={0.88} weight={650}>
                    {f > 1.3 ? 'Arealet = S' : 'Arealet under kurven = S'}
                  </Txt>
                </g>
              )}
            </g>
          );
        }}
      </Plot>
    </Figure>
  );
}
