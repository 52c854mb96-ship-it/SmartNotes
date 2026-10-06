import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  Controls,
  Explain,
  Figure,
  Formula,
  FormulaLine,
  G_EARTH,
  PlayControls,
  Readout,
  Readouts,
  Slider,
  Sub,
  Toggle,
  Toolbar,
  Txt,
  VIZ,
  VizLayout,
  fmt,
  niceTicks,
  scaleLinear,
  useSimClock,
  useTextScale,
} from '../../kit';
import {
  Dimension,
  Gran,
  Himmel,
  Landskap,
  Lauvtre,
  Lyspaere,
  Person,
  SCENE,
  Stoppeklokke,
  Terreng,
  Vann,
  Vannkoker,
  alpha,
  personPunkter,
  useSceneScale,
  useStrokeScale,
  useSvgId,
  type Leddvinkler,
} from '../../kit/scene';
import {
  BREAD_SLICE_ENERGY,
  POWER_REFS,
  bodyEnergy,
  pace,
  stairProgress,
  stairRun,
  timeForEnergy,
  type StairProgress,
  type StairResult,
} from './model';
import { LedPaere, LiaDetaljer, Mikrobolgeovn, Rekkverk, Steintrapp, Stol, Varde } from './trappelop-deler';
import { Lupe, LupeRing, type Friend, type Look } from './trappelop-lupe';
import {
  LAYOUT_NARROW,
  LAYOUT_WIDE,
  RUNNER_HEIGHT,
  cameraLift,
  hillItems,
  panelBox,
  runnerPlace,
  runnerPose,
  runnerRing,
  stairGeometry,
  stairView,
  toScreen,
  type StairLayout,
} from './trappelop-scene';
import { useNarrow } from './useNarrow';

const KETTLE = 2000;
/** Effekten din i diagrammet og avlesningen (det du selv gjør). */
const C_YOU = VIZ.applied;
/** Løperen: rød treningsjakke, mørke tights og hvite joggesko (også i diagrammet). */
const RUNNER: Look = { jakke: 'rod', bukse: SCENE.rubber, sko: 'hvit', har: 'brun', frisyre: 'hestehale' };
/** Venninnen som tar tida, i gul regnjakke, holder stoppeklokka foran seg. */
const FRIEND_LOOK: Look = { jakke: 'gul', har: 'svart' };
const FRIEND_POSE: Partial<Leddvinkler> = { hoyreSkulder: 62, hoyreAlbue: 78, nakke: 8 };
const FRIEND_HEIGHT = 1.66;

export default function Trappelop() {
  const [m, setM] = useState(60);
  const [h, setH] = useState(9);
  const [time, setTime] = useState(10);
  const [forces, setForces] = useState(true);
  const { ref, narrow } = useNarrow();
  const input = { m, h, t: time };
  const r = stairRun(input);
  const clock = useSimClock({ tMax: time });
  const { setT } = clock;
  // Start midt i trappa
  useEffect(() => setT(6), [setT]);
  const tau = Math.min(clock.t, time);
  const prog = stairProgress(input, tau);
  const lay = narrow ? LAYOUT_NARROW : LAYOUT_WIDE;
  const chart = narrow ? CHART_NARROW : CHART_WIDE;
  const chartH = chart.top + chart.rowH * (POWER_REFS.length + 1) + chart.bottom;
  const phase = runnerPlace(stairGeometry(h), prog.u).phase;

  return (
    <VizLayout>
      <Controls>
        <Slider label="Masse m" value={m} onChange={setM} min={30} max={120} step={1} unit="kg" decimals={0} />
        <Slider label="Høyde h" value={h} onChange={setH} min={1} max={30} step={0.5} unit="m" decimals={1} />
        <Slider label="Tid t" value={time} onChange={setTime} min={2} max={60} step={0.5} unit="s" decimals={1} />
      </Controls>
      <Toolbar>
        <PlayControls clock={clock} decimals={1} />
        <Toggle label="Vis krefter" checked={forces} onChange={setForces} />
      </Toolbar>

      <div ref={ref}>
        <Figure
          viewBox={`0 0 ${lay.W} ${lay.H}`}
          label={`En elev på ${fmt(m, 0)} kg løper opp en steintrapp i lia, ${fmt(h, 1)} m opp til en varde, og venninnen tar tida: ${fmt(time, 1)} s. Etter ${fmt(tau, 1)} s er eleven ${fmt(prog.climbed, 1)} m oppe, og arbeidet så langt er ${fmt(prog.W, 0)} J.${forces ? ` Lupen viser tyngden G = ${fmt(m * G_EARTH, 0)} N nedover og like stor kraft oppover.` : ''}`}
          maxHeight={narrow ? 620 : 500}
        >
          <StairScene lay={lay} m={m} h={h} time={time} tau={tau} prog={prog} running={r.vertical >= 0.45} forces={forces} />
        </Figure>
      </div>

      <Figure viewBox={`0 0 ${chart.W} ${chartH}`} label={`Effekten din, ${fmt(r.P, 0)} W, sammenlignet med vanlige apparater.`} maxHeight={narrow ? 560 : 400}>
        <PowerChart P={r.P} lay={chart} />
      </Figure>

      <Readouts>
        <Readout label="Arbeid W = mgh" value={fmt(r.W, 0)} unit="J" tone={VIZ.gravity} />
        <Readout label="Effekt P = W/t" value={fmt(r.P, 0)} unit="W" tone={C_YOU} />
        <Readout label="Vannkokeren bruker like mye energi på" value={fmt(timeForEnergy(r.W, KETTLE), 1)} unit="s" />
      </Readouts>

      <Formula label="Kraft, arbeid og effekt">
        <FormulaLine>
          F = G = mg = {fmt(m, 0)} kg · 9,81 m/s² = {fmt(m * G_EARTH, 0)} N
        </FormulaLine>
        <FormulaLine>
          W = F · h = mgh = {fmt(m, 0)} kg · 9,81 m/s² · {fmt(h, 1)} m = {fmt(r.W, 0)} J
        </FormulaLine>
        <FormulaLine>
          P = W / t = {fmt(r.W, 0)} J / {fmt(time, 1)} s = {fmt(r.P, 0)} W
        </FormulaLine>
      </Formula>

      <Explain>{explanation(r, m, h, time, phase, forces)}</Explain>
    </VizLayout>
  );
}

/* ---------- Scenen: steintrappa opp lia fra fjorden ---------- */

function StairScene({
  lay,
  m,
  h,
  time,
  tau,
  prog,
  running,
  forces,
}: {
  lay: StairLayout;
  m: number;
  h: number;
  time: number;
  tau: number;
  prog: StairProgress;
  running: boolean;
  forces: boolean;
}) {
  const f = useTextScale();
  const ss = useStrokeScale();
  const k = useSceneScale();
  const clip = useSvgId('tr-ramme');
  const g = useMemo(() => stairGeometry(h), [h]);
  const view = useMemo(() => stairView(g, lay), [g, lay]);
  const items = useMemo(() => hillItems(g), [g]);
  const { S } = view;
  const { W, H } = lay;
  const tan = g.rise / g.run;
  // Kameraet følger løperen langs trappa når trappa ikke får plass selv med den minste skalaen.
  const c = cameraLift(view, prog.climbed);
  const camX = (c / tan) * S;
  const camY = c * S;
  /** Fra verden (m) til gruppen som kameraet flytter (kameraet nederst). */
  const B = (x: number, y: number) => toScreen(g, lay, S, 0, x, y);
  const foot = B(0, 0);
  const top = B(g.L, g.h);
  const horizon = lay.yBot - 26 + camY * 0.08;

  // Lia: flatt ved fjorden, steintrappa opp, og nesten flatt på toppen der varden står.
  const hill = useMemo(
    () =>
      [
        [-700, foot.y],
        [foot.x - 1, foot.y],
        [top.x + 1, top.y],
        [top.x + 7 * S, top.y],
        [top.x + 14 * S, top.y - 0.6 * S],
        [W + top.x + 40 * S, top.y - 1.2 * S],
      ] as const,
    [foot.x, foot.y, top.x, top.y, S, W],
  );
  // Varden står et stykke inn på toppen, men alltid inne i figuren når kameraet er ved toppen.
  const topEnd = toScreen(g, lay, S, view.cMax, g.L, g.h).x;
  const cairnX = g.L + Math.max(1.6, Math.min(3, (W - 14 - 0.35 * S - topEnd) / S));
  // Lauvtreet står helt ute til venstre i figuren, og venninnen ved foten av trappa (aldri utenfor figuren).
  const treeX = Math.min(-4.6, (4 - lay.xs) / S);
  const friendX = Math.max(-1.75, (34 - lay.xs) / S);
  const friend: Friend = { x: friendX, size: FRIEND_HEIGHT, ledd: FRIEND_POSE, look: FRIEND_LOOK };

  // Løperen
  const place = runnerPlace(g, prog.u);
  const size = RUNNER_HEIGHT * S;
  const rp = runnerPose(g, place, running);
  const p = B(place.x, place.y);
  const ring = runnerRing({ x: p.x - camX, y: p.y + camY }, S, rp, place.fase);

  // Høyden: målet h som loddrett katet under toppen av trappa (trappa er hypotenusen), og høyden så langt.
  // Målet tegnes utenfor kameraet, så det kan flyttes inn i figuren når toppen er utenfor (høyden er den samme).
  const y0 = foot.y + camY;
  const y1 = top.y + camY;
  const dimX = Math.min(top.x - camX, W - 34 * f);
  const climbY = B(0, prog.climbed).y + camY;
  const runnerX = p.x - camX;
  const stairXAt = (y: number) => foot.x - camX + (y0 - y) / tan;
  const visTop = Math.max(y1, 0);
  const visBot = Math.min(y0, H);
  const hText = `h = ${fmt(h, 1)} m`;
  const hW = hText.length * 0.6 * 17 * f * 0.95 + 8;
  // Etiketten for h står helst midt på målet, mellom trappa og mållinja. Er det for trangt der, flyttes den ned
  // (der trappa er lenger unna), så til høyre for linja, og til slutt nederst med glorie oppå trappa.
  const footX = foot.x - camX;
  const lowest = Math.min(visBot, H) - 12 * f;
  const tagText = `${fmt(prog.climbed, 1)} m`;
  const tagW = tagText.length * 0.6 * 17 * f * 0.9 + 6;
  const tagRight = dimX + 12 + tagW < W - 4;
  // Står høyden så langt (skiltet som følger løperen) på samme side, settes h litt under midten, så de to
  // møtes bare et øyeblikk under avspillingen og ikke i utgangspunktet (6 s av 10 s).
  let hY = visBot - (tagRight ? 0.5 : 0.36) * (visBot - visTop) + 6 * f;
  let hInside = dimX - stairXAt(hY - 6 * f) - 22 >= hW;
  if (!hInside) {
    const yNeeded = y0 + 6 * f - tan * (dimX - footX - 22 - hW);
    if (yNeeded <= lowest) {
      hY = Math.max(hY, yNeeded + 2);
      hInside = true;
    } else if (dimX + 10 + hW > W - 4) {
      hY = lowest;
      hInside = true;
    }
  }
  const sameSide = tagRight !== hInside;
  const showTag = prog.u > 0 && prog.u < 1 && climbY < y0 - 4 && !(sameSide && Math.abs(climbY + 6 * f - hY) < 24 * f);

  // Stoppeklokka og arbeidet så langt i et skilt øverst til venstre (står fast mens kameraet flytter seg).
  const panel = panelBox(f, k);
  const workText = `${fmt(prog.W, 0)} J`;

  const fp = B(friendX, 0);
  const friendSize = FRIEND_HEIGHT * S;
  const watch = personPunkter('staa', friendSize, FRIEND_POSE, { x: fp.x, y: fp.y }).hoyreHand;

  return (
    <g clipPath={`url(#${clip})`}>
      <defs>
        <clipPath id={clip}>
          <rect x={0} y={0} width={W} height={H} />
        </clipPath>
      </defs>
      <Himmel w={W} h={H} sol={{ x: W * 0.47, y: 40, r: 18 }} skyer={2} seed={6} forskyvning={camX} />
      <Vann x={0} y={horizon} w={W} h={H - horizon + 2} />
      <Landskap x={0} y={horizon} w={W} h={H * 0.3} type="kyst" seed={3} forskyvning={camX} />

      <g transform={`translate(${-camX} ${camY})`}>
        {/* Skog på toppen og et par unge graner ved siden av trappa (de står bak trappa) */}
        <Gran x={B(g.L + 9.5, 0).x} y={top.y - 0.4 * S} size={7.5 * S} seed={7} />
        <Gran x={B(g.L + 5.4, 0).x} y={top.y} size={5.8 * S} seed={3} />
        <Terreng points={hill} bottom={H + 40} type="gress" seed={4} />
        <LiaDetaljer items={items} lay={lay} S={S} />
        {g.L > 3 && <Gran x={B(0.3 * g.L, 0.3 * g.h).x} y={B(0.3 * g.L, 0.3 * g.h).y} size={2.6 * S} seed={11} />}
        {g.L > 6 && <Gran x={B(0.76 * g.L, 0.76 * g.h).x} y={B(0.76 * g.L, 0.76 * g.h).y} size={3.3 * S} seed={12} />}
        <Lauvtre x={B(treeX, 0).x} y={foot.y} size={4.4 * S} seed={2} />
        <Rekkverk g={g} lay={lay} S={S} />
        <Steintrapp g={g} lay={lay} S={S} />
        <Varde x={B(cairnX, 0).x} y={top.y} size={1.3 * S} />
        {/* Venninnen nederst tar tida */}
        <Person x={fp.x} y={fp.y} size={friendSize} pose="staa" ledd={FRIEND_POSE} {...FRIEND_LOOK} />
        <Stoppeklokke x={watch.x + 0.03 * S} y={watch.y - 0.05 * S} r={Math.max(2.4, 0.07 * S)} t={tau} digital={false} />
      </g>

      {/* Høyden h og høyden så langt */}
      <line x1={foot.x - camX} y1={y0} x2={dimX} y2={y0} stroke={VIZ.ink} strokeWidth={1.1 * ss} strokeDasharray={`${4 * ss} ${3.5 * ss}`} opacity={0.6} />
      {dimX < top.x - camX - 1 && (
        <line x1={dimX} y1={y1} x2={top.x - camX} y2={y1} stroke={VIZ.ink} strokeWidth={1.1 * ss} strokeDasharray={`${4 * ss} ${3.5 * ss}`} opacity={0.6} />
      )}
      {prog.u > 0 && <line x1={dimX} y1={y0} x2={dimX} y2={climbY} stroke={alpha(VIZ.gravity, 0.5)} strokeWidth={12 * ss} />}
      <Dimension x1={dimX} y1={y0} x2={dimX} y2={y1} />
      {prog.u > 0 && prog.u < 1 && (
        <g>
          <line
            x1={runnerX + 4}
            y1={climbY}
            x2={dimX}
            y2={climbY}
            stroke={VIZ.gravity}
            strokeWidth={1.6 * ss}
            strokeDasharray={`${5 * ss} ${4 * ss}`}
          />
          <circle cx={dimX} cy={climbY} r={4 * ss} fill={VIZ.gravity} stroke={VIZ.surface} strokeWidth={1.5 * ss} />
        </g>
      )}
      <Txt x={hInside ? dimX - 10 : dimX + 10} y={hY} anchor={hInside ? 'end' : 'start'} weight={700} size={0.95}>
        {hText}
      </Txt>
      {showTag && (
        <Txt x={tagRight ? dimX + 12 : dimX - 12} y={climbY + 6 * f} anchor={tagRight ? 'start' : 'end'} weight={720} size={0.9} color={VIZ.gravity}>
          {tagText}
        </Txt>
      )}

      {/* Løperen foran målet */}
      <g transform={`translate(${-camX} ${camY})`}>
        <Person x={p.x} y={p.y} size={size} pose={rp.pose} ledd={rp.ledd} fase={place.fase} skraaning={rp.skraaning} {...RUNNER} />
      </g>
      {forces && <LupeRing ring={ring} lupe={lay.lupe} />}

      {/* Skiltet med stoppeklokka og arbeidet så langt */}
      <rect x={panel.x} y={panel.y} width={panel.w} height={panel.h} rx={12} fill={VIZ.surface} opacity={0.92} stroke={SCENE.outline} strokeWidth={0.8 * ss} />
      <Stoppeklokke x={panel.clockX} y={panel.clockY} r={panel.clockR} t={tau} desimaler={1} title={`Stoppeklokke: ${fmt(tau, 1)} s av ${fmt(time, 1)} s`} />
      <Txt x={panel.textX} y={panel.y + panel.h * 0.4} anchor="start" size={0.82} muted halo={false}>
        Arbeid så langt
      </Txt>
      <Txt x={panel.textX} y={panel.y + panel.h * 0.4 + 30 * f} anchor="start" size={1.25} weight={760} color={VIZ.gravity} halo={false}>
        {workText}
      </Txt>

      {/* Lupen med kreftene */}
      {forces && (
        <Lupe g={g} lupe={lay.lupe} place={place} rp={rp} look={RUNNER} m={m} cairnX={cairnX} friend={friend} tau={tau} />
      )}
    </g>
  );
}

/* ---------- Effekt sammenlignet med apparater ---------- */

type Icon = 'led' | 'gloede' | 'hvile' | 'mikro' | 'koker' | 'du';
const ICONS: Record<string, Icon> = {
  'LED-pære': 'led',
  Glødepære: 'gloede',
  'Kroppen i hvile': 'hvile',
  Mikrobølgeovn: 'mikro',
  Vannkoker: 'koker',
};

interface ChartLayout {
  W: number;
  rowH: number;
  top: number;
  bottom: number;
  /** Navnet over søylen (smal figur) i stedet for til venstre. */
  stacked: boolean;
}
const CHART_WIDE: ChartLayout = { W: 800, rowH: 50, top: 46, bottom: 40, stacked: false };
const CHART_NARROW: ChartLayout = { W: 560, rowH: 78, top: 50, bottom: 48, stacked: true };

function PowerChart({ P, lay }: { P: number; lay: ChartLayout }) {
  const f = useTextScale();
  const ss = useStrokeScale();
  const { W, rowH, top, stacked } = lay;
  const rows = [...POWER_REFS.map((r) => ({ ...r, you: false })), { label: 'Du i trappa', P, you: true }].sort((a, b) => a.P - b.P);
  const iconW = stacked ? 54 : rowH * 0.95;
  const iconH = stacked ? 50 : rowH * 0.74;
  const labelX = 18 + iconW + 12;
  const valueW = 86 * f;
  const x0 = stacked ? labelX : labelX + 148 * f;
  const x1 = W - (stacked ? 14 : valueW + 14);
  const max = Math.max(KETTLE, P) * 1.04;
  const xs = scaleLinear([0, max], [x0, x1]);
  const ticks = niceTicks(0, max, stacked ? 3 : 4).filter((v) => v <= max);
  const yAxis = top + rowH * rows.length;
  const bar = stacked ? 16 * f : Math.min(24 * f, rowH * 0.46);
  const xYou = xs(P);
  return (
    <g>
      <Txt x={18} y={24 * f} anchor="start" weight={700} size={0.95}>
        Effekt (W)
      </Txt>
      {ticks.map((v) => (
        <g key={v}>
          <line x1={xs(v)} x2={xs(v)} y1={top - 4} y2={yAxis} stroke={VIZ.grid} strokeWidth={1 * ss} />
          <Txt x={xs(v)} y={yAxis + 22 * f} size={0.8} muted halo={false}>
            {fmt(v, 0)}
          </Txt>
        </g>
      ))}
      <line x1={x0} x2={x0} y1={top - 4} y2={yAxis} stroke={VIZ.muted} strokeWidth={1.2 * ss} />
      {rows.map((row, i) => {
        const y = top + rowH * i;
        const yc = y + rowH / 2;
        const barY = stacked ? y + rowH * 0.7 : yc;
        const textY = stacked ? y + rowH * 0.4 : yc + 6 * f;
        const w = Math.max(2, xs(row.P) - x0);
        return (
          <g key={row.label}>
            {row.you && <rect x={8} y={y + 2} width={W - 16} height={rowH - 4} rx={10} fill={alpha(C_YOU, 0.1)} />}
            <PowerIcon kind={row.you ? 'du' : (ICONS[row.label] ?? 'led')} x={18 + iconW / 2} y={yc + iconH / 2} size={iconH} />
            <Txt x={stacked ? x0 + 4 : labelX} y={textY} anchor="start" color={row.you ? C_YOU : undefined} weight={row.you ? 720 : 520} halo={false}>
              {row.label}
            </Txt>
            <rect x={x0} y={barY - bar / 2} width={w} height={bar} rx={4} fill={row.you ? C_YOU : VIZ.tension} opacity={row.you ? 0.92 : 0.5} />
            <Txt x={W - 14} y={textY} anchor="end" color={row.you ? C_YOU : VIZ.ink} weight={720} halo={false}>
              {fmt(row.P, 0)} W
            </Txt>
          </g>
        );
      })}
      {/* Effekten din som en strek gjennom alle søylene, så du ser hva som bruker mer og mindre enn deg. Når navnet
          står over søylen (mobil), går streken bare gjennom søylene, så den ikke krysser teksten. */}
      {stacked ? (
        rows.map((row, i) => {
          const barY = top + rowH * i + rowH * 0.7;
          return (
            <line
              key={row.label}
              x1={xYou}
              x2={xYou}
              y1={barY - bar / 2 - 5}
              y2={barY + bar / 2 + 5}
              stroke={C_YOU}
              strokeWidth={1.8 * ss}
              strokeDasharray={`${4 * ss} ${3 * ss}`}
              opacity={row.you ? 0 : 0.85}
            />
          );
        })
      ) : (
        <line x1={xYou} x2={xYou} y1={top - 4} y2={yAxis} stroke={C_YOU} strokeWidth={1.6 * ss} strokeDasharray={`${5 * ss} ${4 * ss}`} opacity={0.75} />
      )}
    </g>
  );
}

/** Små tegninger i diagrammet: (x, y) er midt på bunnen, `size` er høyden på plassen. */
function PowerIcon({ kind, x, y, size }: { kind: Icon; x: number; y: number; size: number }) {
  switch (kind) {
    case 'led':
      return <LedPaere x={x} y={y} size={size * 0.9} />;
    case 'gloede':
      return <Lyspaere x={x} y={y} size={size * 0.92} modell="e27" lysstyrke={0.45} />;
    case 'hvile': {
      const s = size * 1.02;
      const kk = s / 100;
      return (
        <g>
          <Stol x={x - 2 * kk} y={y - 0.23 * s} k={kk} floor={y} />
          <Person x={x - 2 * kk} y={y - 0.23 * s} size={s} pose="sitte" jakke="graa" skygge={false} />
        </g>
      );
    }
    case 'mikro':
      return <Mikrobolgeovn x={x} y={y} w={size * 1.05} />;
    case 'koker':
      return <Vannkoker x={x} y={y} size={size * 0.86} paa />;
    case 'du':
      return <Person x={x} y={y} size={size * 1.02} pose="loepe" {...RUNNER} />;
  }
}

/* ---------- Forklaring ---------- */

function explanation(r: StairResult, m: number, h: number, time: number, phase: 'start' | 'climb' | 'top', forces: boolean): ReactNode {
  const level = pace(r.vertical);
  const bulbs = r.P / 60;
  const g = stairGeometry(h);
  const body = bodyEnergy(r.W);
  const slices = BREAD_SLICE_ENERGY / body;
  const G = m * G_EARTH;
  const levelText: Record<typeof level, string> = {
    rolig: 'Det er en rolig tur opp trappa.',
    gange: `Det tilsvarer vanlig gange i trappa, omtrent like mye som ${fmt(bulbs, 0)} glødepærer.`,
    løping: `Det er løping i trappa, like mye som ${fmt(bulbs, 0)} glødepærer, og det klarer du bare en stund.`,
    sprint: 'Det er spurt på toppidrettsnivå, og kan bare holdes i noen få sekunder.',
    urealistisk: `Det er urealistisk: ingen mennesker løfter seg ${fmt(r.vertical, 1)} m per sekund opp en trapp.`,
  };
  const lupe: Record<typeof phase, string> = {
    start: `I lupen står du klar nederst. Du står stille, så normalkraften N fra bakken er like stor som tyngden G, ${fmt(G, 0)} N. Spill av, så ser du kraften F fra beina i trappa.`,
    climb: `I lupen ser du kreftene på deg i trappa: tyngden G nedover og kraften F fra beina oppover. Løper du med jevn fart, er F i snitt like stor som G, ${fmt(G, 0)} N. For hvert trinn (ca. ${fmt(g.rise * 100, 0)} cm opp) gjør F et arbeid på omtrent ${fmt(G * g.rise, 0)} J.`,
    top: `På toppen står du stille igjen, og normalkraften N er like stor som tyngden G, ${fmt(G, 0)} N. Arbeidet er gjort: ${g.n} trinn med omtrent ${fmt(G * g.rise, 0)} J hver, til sammen mgh = ${fmt(r.W, 0)} J.`,
  };
  return (
    <>
      <p>
        <strong>Arbeidet avhenger ikke av tiden.</strong> Steintrappa har {g.n} trinn og løfter deg {fmt(h, 1)} m. Beina må i snitt skyve deg opp med
        en kraft F like stor som tyngden G = mg = {fmt(G, 0)} N, så arbeidet er W = F · h = mgh = {fmt(r.W, 0)} J enten du går eller løper.
        Effekten forteller hvor fort arbeidet gjøres: P = W/t = {fmt(r.P, 0)} W. {levelText[level]}
      </p>
      {forces && <p>{lupe[phase]}</p>}
      <p>
        Bruker du dobbelt så lang tid ({fmt(2 * time, 1)} s), blir arbeidet det samme, men effekten halvparten ({fmt(r.P / 2, 0)} W). Under avspillingen
        vokser arbeidet så langt jevnt, med {fmt(r.P, 0)} J hvert sekund. På toppen er arbeidet lagret som potensiell energi: E<Sub>p</Sub> = mgh ={' '}
        {fmt(r.W, 0)} J høyere enn nede ved fjorden.
      </p>
      <p>
        Det er derfor trappeløp er god trening, men bruker lite av energien i maten: musklene har en virkningsgrad på rundt 25 %, så kroppen bruker
        omtrent fire ganger arbeidet, {fmt(body / 1000, 0)} kJ. En brødskive med ost gir rundt 700 kJ, så den holder til omtrent{' '}
        {fmt(slices, slices < 10 ? 1 : 0)} turer opp trappa.
      </p>
    </>
  );
}
