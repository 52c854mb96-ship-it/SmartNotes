import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Pause, Play, RotateCcw } from 'lucide-react';
import {
  Controls,
  Explain,
  Figure,
  Formula,
  FormulaLine,
  Legend,
  Plot,
  Readout,
  Readouts,
  Segmented,
  Slider,
  Toggle,
  Toolbar,
  Txt,
  VIZ,
  VizLayout,
  fmt,
  linePath,
  niceTicks,
  scaleLinear,
  useSimClock,
  useTextScale,
  type SimClock,
} from '../../kit';
import {
  ForceArrow,
  Gran,
  Himmel,
  Landskap,
  Lauvtre,
  Person,
  SCENE,
  SpeedLines,
  Stoppeklokke,
  Sykkel,
  Terreng,
  ValueTag,
  Vei,
  alpha,
  hjulvinkelFraStrekning,
  mix,
  personPunkter,
  sykkelPunkter,
  useStrokeScale,
  useSvgId,
} from '../../kit/scene';
import {
  AIR_K,
  BALANCE_SPEED,
  BIKE_MASS,
  GRADE_MAX,
  GRADE_MIN,
  GRADE_STEP,
  HEIGHT_STEPS,
  HILLS,
  MASS_MAX,
  MASS_MIN,
  POWER_MAX,
  POWER_MIN,
  ROLLING_COEFF,
  climb,
  climbAt,
  clockText,
  durationParts,
  durationText,
  forceScale,
  matchHill,
  nearestIndex,
  pedalRate,
  scaleBarForce,
  sceneryFor,
  speedCurve,
  steadySpeed,
  type Climb,
  type ClimbProgress,
  type HillId,
  type Scenery,
} from './model-sykkel-bakke';
import { ColorDot } from './marks';
import { Dalbunn, LiaDetaljer, Stalrekkverk, Steinmur } from './sykkel-bakke-deler';
import { BIKE_NARROW, BIKE_WIDE, fromRoad, gradeLabelLayout, gradeTriangle, hudLayout, roadSpan, roadsideItems, type BikeLayout, type Pt } from './sykkel-bakke-scene';
import { useNarrow } from './useNarrow';

/** Hele turen opp bakken spilles av på så mange sekunder (tidsforløp). */
const PLAY_SECONDS = 15;
/** Nærbildet ruller aldri fortere enn dette (m/s), så veien ikke flimrer ved urealistisk høy fart. */
const VISUAL_MAX = 14;
/** Syklisten: rød trøye, svart sykkelbukse, hvit hjelm. */
const RIDER = { jakke: 'rod', bukse: SCENE.rubber, hjelm: 'hvit', sko: 'svart', har: 'brun' } as const;

type Choice = HillId | 'egen';

/** Navn på bakken i teksten: «opp Trollstigen», «opp bakken». */
function hillName(choice: Choice): string {
  if (choice === 'egen') return 'bakken';
  if (choice === 'skole') return 'skolebakken';
  return HILLS.find((b) => b.id === choice)?.label ?? 'bakken';
}

/** Kilojoule med passe mange desimaler: 23,4 kJ, 704 kJ, 1 576 kJ. */
function kJ(J: number): string {
  const v = J / 1000;
  return fmt(v, v < 10 ? 2 : v < 100 ? 1 : 0);
}

/** Kraft i newton: én desimal under 100 N. */
function N(F: number): string {
  return fmt(F, F < 100 ? 1 : 0);
}

/** Lengde langs veien: meter under 1 km, ellers km. */
function lengthText(s: number): string {
  return s < 1000 ? `${fmt(s, 0)}\u00a0m` : `${fmt(s / 1000, s < 10000 ? 2 : 1)}\u00a0km`;
}

export default function SykkelBakke() {
  const start = HILLS.find((b) => b.id === 'trollstigen') ?? HILLS[0]!;
  const [m, setM] = useState(75);
  const [P, setP] = useState(200);
  const [grade, setGrade] = useState(start.grade);
  const [hi, setHi] = useState(() => nearestIndex(HEIGHT_STEPS, start.h));
  const [air, setAir] = useState(false);
  const [forces, setForces] = useState(true);
  const { ref, narrow } = useNarrow();

  const h = HEIGHT_STEPS[hi] ?? start.h;
  const c = useMemo(() => climb({ m, P, grade, h, air }), [m, P, grade, h, air]);
  const choice: Choice = matchHill(grade, h) ?? 'egen';
  const scenery = sceneryFor(h);

  // Hele turen spilles av på PLAY_SECONDS sekunder; klokka viser den ekte tida.
  const clock = useSimClock({ tMax: c.t, speed: c.t / PLAY_SECONDS });
  const { setT } = clock;
  const tRef = useRef(clock.t);
  tRef.current = clock.t;
  const prevTop = useRef<number | null>(null);
  useEffect(() => {
    // Start 40 % opp bakken. Når tallene endres, står syklisten like langt opp (samme andel av veien).
    const prev = prevTop.current;
    prevTop.current = c.t;
    if (prev === null) setT(0.4 * c.t);
    else if (prev > 0 && prev !== c.t) setT(Math.min(1, tRef.current / prev) * c.t);
  }, [c.t, setT]);
  const prog = climbAt(c, clock.t);
  const tVis = prog.frac * PLAY_SECONDS;

  const pick = (id: Choice) => {
    const b = HILLS.find((x) => x.id === id);
    if (!b) return;
    setGrade(b.grade);
    setHi(nearestIndex(HEIGHT_STEPS, b.h));
  };

  const lay = narrow ? BIKE_NARROW : BIKE_WIDE;
  const chart = narrow ? CHART_NARROW : CHART_WIDE;
  const time = durationParts(c.t);

  return (
    <VizLayout>
      <Controls>
        <Slider label="Masse m" ariaLabel="Masse, syklist og sykkel" value={m} onChange={setM} min={MASS_MIN} max={MASS_MAX} step={1} unit="kg" decimals={0} />
        <Slider label="Effekt P" ariaLabel="Effekt" value={P} onChange={setP} min={POWER_MIN} max={POWER_MAX} step={10} unit="W" decimals={0} />
        <Slider label="Stigning" value={grade} onChange={setGrade} min={GRADE_MIN} max={GRADE_MAX} step={GRADE_STEP} unit="%" decimals={1} />
        <Slider
          label="Høydeforskjell h"
          ariaLabel="Høydeforskjell"
          value={hi}
          onChange={setHi}
          min={0}
          max={HEIGHT_STEPS.length - 1}
          step={1}
          format={(i) => `${fmt(HEIGHT_STEPS[i] ?? h, 0)} m`}
        />
      </Controls>
      <Toolbar>
        <Segmented<Choice> label="Velg en bakke" options={HILLS.map((b) => ({ value: b.id, label: b.label }))} value={choice} onChange={pick} />
        <PlayBar clock={clock} time={`t = ${clockText(clock.t)}`} />
        <Toggle label="Vis krefter" checked={forces} onChange={setForces} />
        <Toggle label="Med luftmotstand" checked={air} onChange={setAir} />
      </Toolbar>

      <div ref={ref}>
        <Figure viewBox={`0 0 ${lay.W} ${lay.H}`} label={sceneLabel(c, prog, choice, forces)} maxHeight={narrow ? 680 : 470}>
          <Scene lay={lay} c={c} prog={prog} tVis={tVis} forces={forces} scenery={scenery} />
        </Figure>
      </div>

      <Figure viewBox={`0 0 ${chart.W} ${chart.H}`} label={chartLabel(c)} maxHeight={narrow ? 660 : 470}>
        <ForceBars c={c} lay={chart} />
        <SpeedPlot c={c} lay={chart} />
      </Figure>
      <Legend
        items={[
          { color: VIZ.velocity, label: air ? 'Farten med luftmotstand (valgt)' : 'Farten uten luftmotstand (valgt)' },
          { color: VIZ.muted, dashed: true, label: air ? 'Uten luftmotstand' : 'Med luftmotstand' },
        ]}
      />

      <Readouts>
        <Readout label="Fart v" value={fmt(c.kmh, 1)} unit="km/h" tone={VIZ.velocity} />
        <Readout label="Kraft fra veien F" value={N(c.F)} unit="N" tone={VIZ.applied} />
        <Readout label={`Tid opp ${hillName(choice)}`} value={time.value} unit={time.unit} />
        <Readout label="Arbeid W = F · s" value={kJ(c.W)} unit="kJ" />
      </Readouts>

      <Formula label="Kreftene langs veien, farten, tida og arbeidet">
        <FormulaLine>
          θ = arctan({fmt(grade / 100, 3)}) = {fmt(c.thetaDeg, 2)}°
        </FormulaLine>
        <FormulaLine>
          G∥ = mg · sin θ = {fmt(m, 0)}&nbsp;kg · 9,81&nbsp;m/s² · sin {fmt(c.thetaDeg, 2)}° = {N(c.Gpar)}&nbsp;N
        </FormulaLine>
        <FormulaLine>
          R = μN = μ · mg · cos θ = {fmt(ROLLING_COEFF, 3)} · {fmt(m, 0)}&nbsp;kg · 9,81&nbsp;m/s² · cos {fmt(c.thetaDeg, 2)}° = {fmt(c.R, 2)}&nbsp;N
        </FormulaLine>
        {air && (
          <FormulaLine>
            L = kv² = {fmt(AIR_K, 2)}&nbsp;kg/m · ({fmt(c.v, 2)}&nbsp;m/s)² = {fmt(c.L, 2)}&nbsp;N
          </FormulaLine>
        )}
        <FormulaLine>
          F = G∥ + R{air ? ' + L' : ''} = {N(c.F)}&nbsp;N &nbsp;(konstant fart: kreftene langs veien er i balanse)
        </FormulaLine>
        <FormulaLine>
          v = P / F = {fmt(P, 0)}&nbsp;W / {N(c.F)}&nbsp;N = {fmt(c.v, 2)}&nbsp;m/s = {fmt(c.kmh, 1)}&nbsp;km/h
        </FormulaLine>
        <FormulaLine>
          s = h / sin θ = {fmt(h, 0)}&nbsp;m / sin {fmt(c.thetaDeg, 2)}° = {fmt(c.s, 0)}&nbsp;m, &nbsp;t = s / v = {fmt(c.s, 0)}&nbsp;m / {fmt(c.v, 2)}&nbsp;m/s = {fmt(c.t, 0)}&nbsp;s ≈{' '}
          {durationText(c.t)}
        </FormulaLine>
        <FormulaLine>
          W = F · s = {N(c.F)}&nbsp;N · {fmt(c.s, 0)}&nbsp;m = {kJ(c.W)}&nbsp;kJ = mgh + {air ? '(R + L)' : 'R'} · s = {kJ(c.Wg)}&nbsp;kJ + {kJ(c.Wr + c.Wl)}&nbsp;kJ
        </FormulaLine>
      </Formula>

      <Explain>
        <ExplainText c={c} choice={choice} />
      </Explain>
    </VizLayout>
  );
}

/** Spill av, start på nytt og tida på klokka i minutter og sekunder (som PlayControls, men med egen tidstekst). */
function PlayBar({ clock, time }: { clock: SimClock; time: ReactNode }) {
  return (
    <div className="viz-play">
      <button type="button" className="btn btn-sm" onClick={clock.toggle} aria-pressed={clock.playing}>
        {clock.playing ? <Pause size={16} aria-hidden /> : <Play size={16} aria-hidden />}
        {clock.playing ? 'Pause' : 'Spill av'}
      </button>
      <button type="button" className="btn btn-sm btn-ghost" onClick={clock.reset}>
        <RotateCcw size={16} aria-hidden />
        Start på nytt
      </button>
      <span className="viz-play-time" aria-live="off">
        {time}
      </span>
      {reducedMotion() && <span className="viz-play-note">Animasjoner er redusert i systeminnstillingene.</span>}
    </div>
  );
}

const reducedMotion = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/** «Det er omtrent 3,9 brødskiver med ost.», eller en andel av én skive for små bakker. */
function slicesText(n: number): string {
  if (n >= 9.95) return `Det er omtrent ${fmt(n, 0)} brødskiver med ost.`;
  if (n >= 0.95) return `Det er omtrent ${fmt(n, 1)} brødskiver med ost.`;
  if (n >= 0.01) return `Det er omtrent ${fmt(n * 100, 0)}\u00a0% av en brødskive med ost.`;
  return 'Det er mindre enn 1\u00a0% av en brødskive med ost.';
}

function sceneLabel(c: Climb, prog: ClimbProgress, choice: Choice, forces: boolean): string {
  const { m, P, grade, h } = c.input;
  const where = choice === 'egen' ? 'en bakke' : hillName(choice);
  const f = forces
    ? ` Kraftpilene langs veien: kraften fra veien F = ${N(c.F)} N framover på bakhjulet, og bakover tyngden langs veien G∥ = ${N(c.Gpar)} N, rullefriksjonen R = ${fmt(c.R, 1)} N${c.input.air ? ` og luftmotstanden L = ${fmt(c.L, 1)} N` : ''}.`
    : '';
  return `Nærbilde av en syklist på ${fmt(m, 0)} kg (med sykkel) som sykler opp ${where} med stigning ${fmt(grade, 1)} % og høydeforskjell ${fmt(h, 0)} m. Med effekten ${fmt(P, 0)} W holder syklisten ${fmt(c.kmh, 1)} km/h. Etter ${clockText(prog.tau)} er syklisten ${fmt(prog.height, 0)} m oppe, og arbeidet så langt er ${kJ(prog.W)} kJ.${f}`;
}

function chartLabel(c: Climb): string {
  return `Kreftene langs veien: F = ${N(c.F)} N framover er like stor som G∥ + R${c.input.air ? ' + L' : ''} = ${N(c.F)} N bakover. Grafen viser farten mot stigningen for ${fmt(c.input.m, 0)} kg og ${fmt(c.input.P, 0)} W, med og uten luftmotstand. Ved ${fmt(c.input.grade, 1)} % er farten ${fmt(c.kmh, 1)} km/h.`;
}

/* ---------- Scenen: nærbilde av syklisten på fjellveien ---------- */

function Scene({ lay, c, prog, tVis, forces, scenery }: { lay: BikeLayout; c: Climb; prog: ClimbProgress; tVis: number; forces: boolean; scenery: Scenery }) {
  const f = useTextScale();
  const ss = useStrokeScale();
  const clip = useSvgId('sb-ramme');
  const { W, H, S, xc, yc, road } = lay;
  const th = c.theta;
  const deg = c.thetaDeg;
  const cos = Math.cos(th);
  const sin = Math.sin(th);
  const fw = { x: cos, y: -sin };

  // Veien ruller forbi i ekte fart (aldri over VISUAL_MAX), mens klokka går i tidsforløp.
  const vVis = Math.min(c.v, VISUAL_MAX);
  const dVis = vVis * tVis;
  const shift = dVis * S;
  const span = roadSpan(lay, th);
  const pedal = 360 * pedalRate(Math.min(c.v, VISUAL_MAX)) * tVis;
  const wheel = hjulvinkelFraStrekning(dVis, 0.34);

  // Syklisten på sykkelen, dreid med veien
  const bike = 1.72 * S;
  const sp = sykkelPunkter(bike, { x: xc, y: yc, rotate: -deg });
  const fest = { venstreHand: sp.styre, hoyreHand: sp.styre, venstreFot: sp.venstrePedal(pedal), hoyreFot: sp.hoyrePedal(pedal) };
  const pp = personPunkter('sykle', sp.rytterHoyde, undefined, { x: sp.sete.x, y: sp.sete.y, rotate: -deg, fest, fase: pedal / 360 });

  // Tyngdepunktet til syklist + sykkel (sykkelen har sitt omtrent 0,42 m over veien)
  const m = c.input.m;
  const mr = Math.max(1, m - BIKE_MASS);
  const bikeCm = fromRoad(lay, th, -0.04 * S, -0.42 * S);
  const cm = { x: (mr * pp.tyngdepunkt.x + BIKE_MASS * bikeCm.x) / m, y: (mr * pp.tyngdepunkt.y + BIKE_MASS * bikeCm.y) / m };
  // Kontaktpunktet til bakhjulet (kraften fra veien virker der), litt ned i veibanen så pila ikke dekker dekket
  const rear = fromRoad(lay, th, -0.52 * S, 5 * ss);

  const kN = forceScale(c.F, lay.maxArrow);
  const arrow = (p: Pt, dir: 1 | -1, F: number) => ({ x1: p.x, y1: p.y, x2: p.x + dir * fw.x * F * kN, y2: p.y + dir * fw.y * F * kN });
  const barN = scaleBarForce(kN, 80);

  // Trær bak muren (de står lenger ned i lia, så bare toppene stikker opp)
  const trees = roadsideItems(dVis, span.from / S - 4, span.to / S + 4, scenery === 'by' ? 7 : 4.2, scenery === 'fjell' ? 5 : 9);

  const hud = hudLayout(lay.hud, f);
  const tri = gradeTriangle(lay, th);
  const head = pp.hode;
  const tagY = head.y - 34 - 6 * f;
  const skyY = lay.narrow ? lay.hud.y + lay.hud.h - 10 : 0;

  return (
    <g clipPath={`url(#${clip})`}>
      <defs>
        <clipPath id={clip}>
          <rect x={0} y={0} width={W} height={H} />
        </clipPath>
      </defs>
      {/* På mobil står panelet øverst: himmelen (med skyene) begynner under det, og over er det bare blått. */}
      {skyY > 0 && <rect x={0} y={0} width={W} height={skyY + 1} fill={SCENE.skyTop} />}
      <Himmel
        y={skyY}
        w={W}
        h={lay.horizon + 4 - skyY}
        sol={lay.narrow ? { x: 96, y: lay.hud.y + lay.hud.h + 40, r: 17 } : { x: W * 0.6, y: 40, r: 17 }}
        skyer={2}
        seed={4}
        forskyvning={shift * 0.02}
      />
      <Landskap x={0} y={lay.horizon} w={W} h={scenery === 'by' ? 110 : 186} type={scenery} seed={scenery === 'fjell' ? 7 : 3} forskyvning={shift * 0.04} />
      <Dalbunn w={W} top={lay.horizon} bottom={H} />

      {trees.map((t) => {
        const p = fromRoad(lay, th, t.u * S, 0.3 * road);
        const size = (scenery === 'fjell' ? 1.6 + 1.4 * t.r : 1.4 + 1.2 * t.r) * S;
        return scenery === 'by' || (scenery === 'aaser' && t.r > 0.55) ? (
          <Lauvtre key={t.key} x={p.x} y={p.y} size={size * 0.95} seed={t.key} />
        ) : (
          <Gran key={t.key} x={p.x} y={p.y} size={size} seed={t.key} />
        );
      })}

      {/* Veien, muren og lia under, i veirammen (dreid med veien) */}
      <g transform={`translate(${xc} ${yc}) rotate(${-deg})`}>
        <Terreng
          points={[
            [span.from, 0.55 * road],
            [span.to, 0.55 * road],
          ]}
          bottom={span.depth}
          type="gress"
          seed={3}
        />
        <LiaDetaljer from={span.from} to={span.to} top={0.95 * road} depth={span.depth} S={S} shift={shift} />
        <Vei x1={span.from} x2={span.to} y={0} bredde={road} type="asfalt" veikant="grus" depth={0.62 * road} forskyvning={shift} seed={2} />
        {scenery === 'fjell' ? (
          <Steinmur from={span.from} to={span.to} base={-0.78 * road} height={lay.wall} S={S} shift={shift} />
        ) : (
          <Stalrekkverk from={span.from} to={span.to} base={-0.78 * road} height={lay.wall * 0.95} S={S} shift={shift} />
        )}
      </g>

      {/* Stigningstrekanten: så mye opp per så mye bortover */}
      <GradeMarks tri={tri} grade={c.input.grade} W={W} />

      {c.v > 8 && <SpeedLines x={sp.bakhjul.x - sp.hjulradius - 6} y={sp.bakhjul.y - 0.2 * S} length={Math.min(60, (c.v - 6) * 4)} spread={0.5 * S} dir={1} />}

      <Sykkel x={xc} y={yc} size={bike} rotate={-deg} lakk="blaa" hjulvinkel={wheel} pedalvinkel={pedal} />
      <Person x={sp.sete.x} y={sp.sete.y} size={sp.rytterHoyde} rotate={-deg} pose="sykle" fase={pedal / 360} fest={fest} {...RIDER} />

      {forces && (
        <g>
          <ForceArrow {...arrow(cm, -1, c.Gpar)} color={VIZ.gravity} label="G∥" dashed origin />
          {c.input.air && <ForceArrow {...arrow(pp.skulder, -1, c.L)} color={VIZ.friction} label="L" origin minLength={4} />}
          <ForceArrow {...arrow(rear, -1, c.R)} color={VIZ.friction} label="R" minLength={2} />
          <ForceArrow {...arrow(rear, 1, c.F)} color={VIZ.applied} label="F" origin />
        </g>
      )}

      <ValueTag x={head.x} y={tagY} text={`v = ${fmt(c.kmh, 1)} km/h`} color={VIZ.velocity} pointer={10} />

      <Hud lay={lay} hud={hud} c={c} prog={prog} />

      {forces && <ScaleBar x={lay.scaleBar.x} y={lay.scaleBar.y} len={barN * kN} text={`${fmt(barN, 0)} N`} note={lay.narrow ? undefined : 'Pilene: kreftene langs veien'} />}
    </g>
  );
}

/** Stigningstrekanten under veien: run meter bortover og rise meter opp, med veikanten som hypotenus. */
function GradeMarks({ tri, grade, W }: { tri: ReturnType<typeof gradeTriangle>; grade: number; W: number }) {
  const f = useTextScale();
  const ss = useStrokeScale();
  const { x0, y0, x1, y1 } = tri;
  // «0,19 m opp» står til høyre for den loddrette kateten, eller bare «0,19 m» når det er trangt.
  const rise = fmt(tri.rise, 2);
  const lab = gradeLabelLayout(tri, W, f, `${rise} m opp`.length, `${rise} m`.length);
  const corner = Math.min(9 * ss, Math.max(0, (y0 - y1) * 0.8));
  return (
    <g>
      <line x1={x0} y1={y0} x2={x1} y2={y1} stroke={VIZ.surface} strokeWidth={4.5 * ss} opacity={0.7} strokeLinecap="round" />
      <line x1={x0} y1={y0} x2={x1} y2={y1} stroke={VIZ.ink} strokeWidth={1.6 * ss} strokeLinecap="round" />
      <line x1={x0} y1={y0} x2={x1} y2={y0} stroke={VIZ.surface} strokeWidth={4 * ss} opacity={0.7} />
      <line x1={x0} y1={y0} x2={x1} y2={y0} stroke={VIZ.ink} strokeWidth={1.4 * ss} strokeDasharray={`${5 * ss} ${4 * ss}`} />
      <line x1={x1} y1={y0} x2={x1} y2={y1} stroke={VIZ.surface} strokeWidth={5 * ss} opacity={0.75} />
      <line x1={x1} y1={y0} x2={x1} y2={y1} stroke={VIZ.ink} strokeWidth={2.4 * ss} />
      {corner > 3 && <path d={`M${x1 - corner},${y0} L${x1 - corner},${y0 - corner} L${x1},${y0 - corner}`} fill="none" stroke={VIZ.ink} strokeWidth={1 * ss} />}
      <Txt x={lab.run.x} y={lab.run.y} size={0.82} weight={620}>
        {fmt(tri.run, 1)} m bortover
      </Txt>
      <Txt x={lab.rise.x} y={lab.rise.y} anchor={lab.rise.anchor} size={0.82} weight={620}>
        {lab.long ? `${rise} m opp` : `${rise} m`}
      </Txt>
      <Txt x={lab.ratio.x} y={lab.ratio.y} size={0.82} muted>
        stigning {rise} / {fmt(tri.run, 1)} = {fmt(grade, 1)} %
      </Txt>
    </g>
  );
}

/** Målestokk for kraftpilene: en strek like lang som en kraft på `text`. (x, y) er høyre ende. */
function ScaleBar({ x, y, len, text, note }: { x: number; y: number; len: number; text: string; note?: string }) {
  const ss = useStrokeScale();
  const f = useTextScale();
  const x0 = x - len;
  return (
    <g>
      <line x1={x0} y1={y} x2={x} y2={y} stroke={VIZ.surface} strokeWidth={5 * ss} opacity={0.8} />
      <line x1={x0} y1={y} x2={x} y2={y} stroke={VIZ.ink} strokeWidth={2 * ss} />
      <line x1={x0} y1={y - 5} x2={x0} y2={y + 5} stroke={VIZ.ink} strokeWidth={1.5 * ss} />
      <line x1={x} y1={y - 5} x2={x} y2={y + 5} stroke={VIZ.ink} strokeWidth={1.5 * ss} />
      <Txt x={x0 - 8} y={y + 5 * f} anchor="end" size={0.78} weight={620}>
        {text}
      </Txt>
      {note && (
        <Txt x={x} y={y + 24 * f} anchor="end" size={0.72} muted>
          {note}
        </Txt>
      )}
    </g>
  );
}

/** Panelet øverst: stoppeklokka, høyden og arbeidet så langt, og profilen av hele bakken med syklisten. */
function Hud({ lay, hud, c, prog }: { lay: BikeLayout; hud: ReturnType<typeof hudLayout>; c: Climb; prog: ClimbProgress }) {
  const ss = useStrokeScale();
  const box = lay.hud;
  const pr = hud.profile;
  const px = (fr: number) => pr.x + fr * pr.w;
  const py = (fr: number) => pr.y + pr.h - fr * pr.h;
  const here = { x: px(prog.frac), y: py(prog.frac) };
  const rows: [string, string, string?][] = [
    ['Tid', clockText(prog.tau)],
    ['Høyde', `${fmt(prog.height, 0)} av ${fmt(c.input.h, 0)} m`, VIZ.gravity],
    ['Arbeid så langt', `${kJ(prog.W)} kJ`, VIZ.applied],
  ];
  return (
    <g>
      <rect x={box.x} y={box.y} width={box.w} height={box.h} rx={12} fill={VIZ.surface} opacity={0.93} stroke={SCENE.outline} strokeWidth={0.8 * ss} />
      <Stoppeklokke x={hud.clock.x} y={hud.clock.y} r={hud.clock.r} t={prog.tau} digital={false} title={`Stoppeklokke: ${clockText(prog.tau)}`} />
      {rows.map(([label, value, color], i) => (
        <g key={label}>
          <Txt x={hud.textX} y={hud.rows[i]!} anchor="start" size={0.8} muted halo={false}>
            {label}
          </Txt>
          <Txt x={hud.valueX} y={hud.rows[i]!} anchor="end" size={0.9} weight={740} color={color} halo={false}>
            {value}
          </Txt>
        </g>
      ))}
      {/* Profilen av hele bakken (ikke i målestokk): syklisten som en prikk */}
      <path d={`M${px(0)},${py(0)} L${px(1)},${py(1)} L${px(1)},${py(0)} Z`} fill={mix(SCENE.grass, SCENE.hillFar, 0.4)} opacity={0.75} />
      <path d={`M${px(0)},${py(0)} L${here.x},${here.y} L${here.x},${py(0)} Z`} fill={alpha(VIZ.gravity, 0.28)} />
      <line x1={px(0)} y1={py(0)} x2={px(1)} y2={py(1)} stroke={SCENE.asphalt} strokeWidth={3 * ss} strokeLinecap="round" />
      <line x1={px(0)} y1={py(0)} x2={here.x} y2={here.y} stroke={VIZ.gravity} strokeWidth={3 * ss} strokeLinecap="round" />
      <circle cx={here.x} cy={here.y} r={5 * ss} fill={VIZ.velocity} stroke={VIZ.surface} strokeWidth={1.6 * ss} />
    </g>
  );
}

/* ---------- Kraftbalansen og farten mot stigningen ---------- */

interface ChartLayout {
  W: number;
  H: number;
  /** Høyden på området med søylene. */
  barsH: number;
  /** Navnet på raden over søylen (smal figur) i stedet for til venstre. */
  stacked: boolean;
}
const CHART_WIDE: ChartLayout = { W: 800, H: 470, barsH: 150, stacked: false };
const CHART_NARROW: ChartLayout = { W: 520, H: 600, barsH: 170, stacked: true };

function ForceBars({ c, lay }: { c: Climb; lay: ChartLayout }) {
  const f = useTextScale();
  const ss = useStrokeScale();
  const { W, stacked } = lay;
  const x0 = stacked ? 16 : 150;
  const x1 = W - (stacked ? 16 : 150);
  // Aksen går til den første pene verdien over F (med litt luft til teksten bak søylen)
  const ticks = niceTicks(0, c.F * 1.08, 4);
  const step = (ticks[1] ?? 1) - (ticks[0] ?? 0);
  const last = ticks[ticks.length - 1] ?? c.F;
  const max = last >= c.F * 1.04 ? last : last + step;
  if (max > last) ticks.push(max);
  const xs = scaleLinear([0, max], [x0, x1]);
  const bar = 24;
  const titleY = 24 * f;
  const row1 = stacked ? titleY + 52 * f : titleY + 36;
  const row2 = stacked ? row1 + 50 * f + bar / 2 : row1 + 40;
  const axisY = row2 + bar / 2 + 6;
  const segs = [
    { key: 'G', label: 'G∥', F: c.Gpar, fill: alpha(VIZ.gravity, 0.32), stroke: VIZ.gravity, dashed: true },
    { key: 'R', label: 'R', F: c.R, fill: VIZ.friction, stroke: VIZ.friction, dashed: false },
    ...(c.input.air ? [{ key: 'L', label: 'L', F: c.L, fill: alpha(VIZ.friction, 0.55), stroke: VIZ.friction, dashed: false }] : []),
  ];
  let acc = 0;
  const charW = 17 * f * 0.6 * 0.85;
  return (
    <g>
      <Txt x={16} y={titleY} anchor="start" weight={700} size={0.95}>
        Kreftene langs veien (N)
      </Txt>
      {ticks
        .filter((v) => v <= max)
        .map((v) => (
          <g key={v}>
            <line x1={xs(v)} x2={xs(v)} y1={row1 - bar / 2 - 6} y2={axisY} stroke={VIZ.grid} strokeWidth={1 * ss} />
            <Txt x={xs(v)} y={axisY + 18 * f} size={0.76} muted halo={false}>
              {fmt(v, 0)}
            </Txt>
          </g>
        ))}
      <line x1={x0} x2={x0} y1={row1 - bar / 2 - 6} y2={axisY} stroke={VIZ.muted} strokeWidth={1.2 * ss} />

      {/* Framover: kraften fra veien */}
      <Txt x={stacked ? x0 : x0 - 12} y={stacked ? row1 - bar / 2 - 8 : row1 + 6 * f} anchor={stacked ? 'start' : 'end'} size={0.85} weight={650} halo={false}>
        Framover
      </Txt>
      <rect x={x0} y={row1 - bar / 2} width={Math.max(1, xs(c.F) - x0)} height={bar} rx={4} fill={VIZ.applied} />
      <Txt x={stacked ? x1 : xs(c.F) + 10} y={stacked ? row1 - bar / 2 - 8 : row1 + 6 * f} anchor={stacked ? 'end' : 'start'} size={0.85} weight={720} color={VIZ.applied} halo={false}>
        F = {N(c.F)} N
      </Txt>

      {/* Bakover: tyngden langs veien, rullefriksjonen og luftmotstanden */}
      <Txt x={stacked ? x0 : x0 - 12} y={stacked ? row2 - bar / 2 - 8 : row2 + 6 * f} anchor={stacked ? 'start' : 'end'} size={0.85} weight={650} halo={false}>
        Bakover
      </Txt>
      {segs.map((s) => {
        const a = xs(acc);
        acc += s.F;
        const b = xs(acc);
        const w = Math.max(0, b - a);
        const fits = w > s.label.length * charW + 10;
        return (
          <g key={s.key}>
            <rect
              x={a}
              y={row2 - bar / 2}
              width={w}
              height={bar}
              fill={s.fill}
              stroke={s.stroke}
              strokeWidth={(s.dashed ? 1.6 : 0.8) * ss}
              strokeDasharray={s.dashed ? `${5 * ss} ${3 * ss}` : undefined}
            />
            {fits && (
              <Txt x={(a + b) / 2} y={row2 + 6 * f} size={0.82} weight={720} color={s.dashed ? VIZ.gravity : VIZ.surface} halo={false}>
                {s.label}
              </Txt>
            )}
          </g>
        );
      })}
      <Txt x={stacked ? x1 : xs(c.F) + 10} y={stacked ? row2 - bar / 2 - 8 : row2 + 6 * f} anchor={stacked ? 'end' : 'start'} size={0.85} weight={720} halo={false}>
        {c.input.air ? 'G∥ + R + L' : 'G∥ + R'} = {N(c.F)} N
      </Txt>
    </g>
  );
}

function SpeedPlot({ c, lay }: { c: Climb; lay: ChartLayout }) {
  const f = useTextScale();
  const ss = useStrokeScale();
  const clip = useSvgId('sb-graf');
  const { m, P, air, grade } = c.input;
  const top = lay.barsH * (lay.stacked ? f : 1);
  const height = lay.H - top;
  const now = speedCurve(m, P, air);
  const other = speedCurve(m, P, !air);
  // Aksen dekker kurven fra 2 % og punktet du står i (en urealistisk høy fart uten luftmotstand vises med en pil).
  const need = Math.max(steadySpeed(m, P, 2, air) * 3.6, c.kmh) * 1.1;
  const yMax = [10, 15, 20, 30, 40, 50, 60, 80].find((v) => v >= need) ?? 80;
  const xTicks = [0, 5, 10, 15, 20];
  return (
    <g transform={`translate(0 ${top})`}>
      <Plot x={{ min: 0, max: GRADE_MAX, label: 'stigning (%)', ticks: xTicks }} y={{ min: 0, max: yMax, label: 'fart v (km/h)' }} width={lay.W} height={height}>
        {({ sx, sy, x0, x1, y0, y1 }) => {
          const px = sx(grade);
          const pyRaw = sy(c.kmh);
          const above = pyRaw < y1;
          const py = Math.max(y1, pyRaw);
          const band = Math.max(y1, sy(BALANCE_SPEED * 3.6));
          return (
            <g>
              <defs>
                <clipPath id={clip}>
                  <rect x={x0} y={y1 - 2} width={x1 - x0} height={y0 - y1 + 4} />
                </clipPath>
              </defs>
              <rect x={x0} y={band} width={x1 - x0} height={y0 - band} fill={alpha(VIZ.muted, 0.14)} />
              {y0 - band > 15 * f && (
                <Txt x={x0 + 8} y={y0 - 6} anchor="start" size={0.72} muted>
                  under 5 km/h: vanskelig å holde balansen
                </Txt>
              )}
              <g clipPath={`url(#${clip})`}>
                <path d={linePath(other, sx, sy)} fill="none" stroke={VIZ.muted} strokeWidth={2 * ss} strokeDasharray={`${6 * ss} ${5 * ss}`} />
                <path d={linePath(now, sx, sy)} fill="none" stroke={VIZ.velocity} strokeWidth={3.2 * ss} strokeLinejoin="round" />
              </g>
              <line x1={px} y1={py} x2={px} y2={y0} stroke={VIZ.velocity} strokeWidth={1.2 * ss} strokeDasharray={`${4 * ss} ${3 * ss}`} opacity={0.8} />
              <line x1={x0} y1={py} x2={px} y2={py} stroke={VIZ.velocity} strokeWidth={1.2 * ss} strokeDasharray={`${4 * ss} ${3 * ss}`} opacity={0.8} />
              <ColorDot x={px} y={py} r={7 * ss} color={VIZ.velocity} />
              <Txt x={px + (grade > 14 ? -12 : 12)} y={py - 10 * f + (above ? 26 * f : 0)} anchor={grade > 14 ? 'end' : 'start'} weight={740} color={VIZ.velocity} size={0.9}>
                {above ? `↑ ${fmt(c.kmh, 0)} km/h` : `${fmt(c.kmh, 1)} km/h`}
              </Txt>
            </g>
          );
        }}
      </Plot>
    </g>
  );
}

/* ---------- Forklaring ---------- */

function ExplainText({ c, choice }: { c: Climb; choice: Choice }): ReactNode {
  const { m, P, grade, h, air } = c.input;
  const name = hillName(choice);
  const share = (c.Gpar / c.G) * 100;
  const steeper = Math.min(GRADE_MAX, grade * 2);
  const vSteep = steadySpeed(m, P, steeper, air) * 3.6;
  const gentleGrade = Math.max(GRADE_MIN, grade / 2);
  const gentle = climb({ ...c.input, grade: gentleGrade });
  const heat = c.Wr + c.Wl;
  const ideal = (P / (m * 9.81)) * 3600;
  const intro: Record<Choice, string> = {
    skole: 'Skolebakken er 300\u00a0m lang og stiger 30\u00a0m: en bratt bakke på 10\u00a0%, slik mange har på vei til skolen.',
    trollstigen: 'Trollstigen i Romsdalen stiger omtrent 850\u00a0m på 11\u00a0km, med 11 hårnålssvinger opp fjellsida.',
    alpe: "Alpe d'Huez i de franske Alpene er en kjent stigning i Tour de France: 21 svinger og omtrent 1\u00a0100 høydemeter på 13,8\u00a0km.",
    egen: `Bakken din er ${lengthText(c.s)} lang og stiger ${fmt(h, 0)}\u00a0m.`,
  };
  const slow = c.v < BALANCE_SPEED;
  const unreal = !air && c.kmh > 45;
  return (
    <>
      <p>
        {intro[choice]} <strong>Farten er konstant, så kreftene langs veien er i balanse.</strong> Bakhjulet skyver bakover på veien, og veien skyver
        like hardt framover på hjulet: det er kraften F = {N(c.F)}&nbsp;N som driver deg opp. Den er like stor som summen av kreftene bakover: tyngden langs
        veien G∥ = {N(c.Gpar)}&nbsp;N{air ? `, rullefriksjonen R = ${fmt(c.R, 1)}\u00a0N og luftmotstanden L = ${fmt(c.L, 1)}\u00a0N` : ` og rullefriksjonen R = ${fmt(c.R, 1)}\u00a0N`}. Effekten er P = F · v, så farten
        blir v = P / F = {fmt(P, 0)}&nbsp;W / {N(c.F)}&nbsp;N = {fmt(c.v, 2)}&nbsp;m/s, altså {fmt(c.kmh, 1)}&nbsp;km/h.
        {slow && ' Så sakte er det vanskelig å holde balansen, og de fleste går av og triller (gangfart er omtrent 5 km/h).'}
      </p>
      <p>
        <strong>Med samme effekt gir brattere bakke lavere fart.</strong> Bare en liten del av tyngden virker langs veien: ved {fmt(grade, 1)}&nbsp;% er
        G∥ = mg · sin θ bare {fmt(share, 1)}&nbsp;% av tyngden G = {fmt(c.G, 0)}&nbsp;N{grade <= 12 ? ' (nesten samme tall som stigningen, fordi sin θ ≈ tan θ for små vinkler)' : ''}.{' '}
        {grade * 2 <= GRADE_MAX
          ? `Dobler du stigningen til ${fmt(steeper, 1)}\u00a0%, blir G∥ nesten dobbelt så stor, og med samme effekt faller farten til ${fmt(vSteep, 1)}\u00a0km/h.`
          : `I en så bratt bakke er G∥ nesten hele kraften du må overvinne.`}{' '}
        Derfor gir du ned i motbakke: samme effekt ved lavere fart gir større kraft (F = P / v), mens beina tråkker like fort.
        {unreal &&
          ` Uten luftmotstand blir farten urealistisk høy i slake bakker (${fmt(c.kmh, 0)}\u00a0km/h). Slå på luftmotstand: på nesten flat vei er det lufta du kjemper mest mot.`}
        {air && c.L > c.Gpar && ` Nå er luftmotstanden større enn G∥: i så slake bakker kjemper du mest mot lufta.`}
      </p>
      <p>
        <strong>Arbeidet opp {name}</strong> er W = F · s = {N(c.F)}&nbsp;N · {fmt(c.s, 0)}&nbsp;m = {kJ(c.W)}&nbsp;kJ, det samme som P · t = {fmt(P, 0)}&nbsp;W ·{' '}
        {fmt(c.t, 0)}&nbsp;s. Av dette blir mgh = {kJ(c.Wg)}&nbsp;kJ ({fmt((c.Wg / c.W) * 100, 0)}&nbsp;%) potensiell energi. Resten, {kJ(heat)}&nbsp;kJ, går med til
        rullefriksjonen{air ? ' og luftmotstanden' : ''} og blir termisk energi i {air ? 'dekkene og lufta' : 'dekkene'}. Den kinetiske energien endres
        ikke, fordi farten er den samme hele veien.
      </p>
      <p>
        <strong>Hårnålssvingene gjør det lettere, men ikke mindre arbeid.</strong> En slakere vei til samme høyde er lengre.{' '}
        {gentleGrade < grade ? (
          <>
            Med {fmt(gentleGrade, 1)}&nbsp;% stigning ville veien vært {lengthText(gentle.s)}, kraften {N(gentle.F)}&nbsp;N og farten {fmt(gentle.kmh, 1)}&nbsp;km/h. Du
            må likevel løfte deg {fmt(h, 0)}&nbsp;m, så mgh er den samme, og turen tar {durationText(gentle.t)} i stedet for {durationText(c.t)}.{' '}
            {gentle.t / c.t < 1.12
              ? 'Det er nesten like lenge: med samme effekt løfter du deg nesten like mange meter i minuttet. Forskjellen kommer av at rullefriksjonen virker på en lengre vei.'
              : 'Det tar lengre tid fordi friksjonen og luftmotstanden virker på en lengre vei, og luftmotstanden øker med farten.'}
          </>
        ) : (
          'Med den minste stigningen er veien allerede svært lang for hver meter du kommer opp.'
        )}
      </p>
      <p>
        <strong>Watt per kilo bestemmer hvor fort du kommer til værs.</strong> Du kommer {fmt(c.vam, 0)} høydemeter opp i timen. Uten friksjon og
        luftmotstand ville det vært P / (mg) · 3&nbsp;600&nbsp;s = {fmt(ideal, 0)}&nbsp;m i timen, uansett stigning. Derfor sammenligner syklister W/kg: du yter{' '}
        {fmt(c.wPerKg, 1)}&nbsp;W/kg, mens proffene i Tour de France holder rundt 6&nbsp;W/kg i en halvtime.
        {choice === 'alpe' && ' Prøv m = 65\u00a0kg og P = 380\u00a0W med luftmotstand: da kommer du opp på rundt 38 minutter, nær rekorden på knapt 37 minutter.'}{' '}
        Kroppen bruker omtrent fire ganger arbeidet, {kJ(c.body)}&nbsp;kJ, fordi musklene har en virkningsgrad på rundt 25&nbsp;%. {slicesText(c.slices)}
      </p>
    </>
  );
}
