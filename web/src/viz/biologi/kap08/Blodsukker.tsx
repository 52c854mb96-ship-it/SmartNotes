import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  Arrow,
  BIO,
  Controls,
  Explain,
  Figure,
  Forvalg,
  Formula,
  FormulaLine,
  Legend,
  PlayBar,
  Plot,
  Readout,
  Readouts,
  Slider,
  Toggle,
  Toolbar,
  Txt,
  VIZ,
  VizLayout,
  fmt,
  linePath,
  mixColor,
  placeParticles,
  roundedRectPath,
  useContainerTextScale,
  useLineScale,
  useSimClock,
} from '../kit';
import {
  DIABETES_2H,
  DIABETES_FASTING,
  EXERCISE_HOURS,
  EXERCISE_START,
  HYPO,
  MEAL_PLANS,
  MEAL_TIMES,
  NORMAL_RANGE,
  PERSONS,
  RENAL_THRESHOLD,
  glucoseStats,
  mealsFrom,
  simulateGlucose,
  type GlucoseFluxes,
  type GlucoseRun,
  type MealPlan,
  type Person,
} from './model';

const GLUCOSE = BIO.sukker;
const INSULIN = BIO.serie[0];
const GLUCAGON = BIO.signal;
const MEAL_NAMES = ['Frokost', 'Lunsj', 'Middag'];

/** Klokkeslett som tekst: 8.5 → «kl. 08.30». */
function clockText(h: number): string {
  const total = Math.round(Math.min(24, Math.max(0, h)) * 60);
  const hh = Math.floor(total / 60) % 24;
  const mm = total % 60;
  return `kl. ${String(hh).padStart(2, '0')}.${String(mm).padStart(2, '0')}`;
}

export default function Blodsukker() {
  const [production, setProduction] = useState(1);
  const [sensitivity, setSensitivity] = useState(1);
  const [grams, setGrams] = useState<[number, number, number]>([...MEAL_PLANS.vanlig.grams]);
  const [exercise, setExercise] = useState(false);
  const [therapy, setTherapy] = useState(false);
  const diabetic1 = production < 0.5;
  const therapyOn = therapy && diabetic1;
  const params = { meals: mealsFrom(grams), production, sensitivity, exercise, insulinTherapy: therapyOn };
  const run = useMemo(
    () => simulateGlucose({ meals: mealsFrom(grams), production, sensitivity, exercise, insulinTherapy: therapyOn }),
    [grams, production, sensitivity, exercise, therapyOn],
  );
  const healthy = useMemo(
    () => simulateGlucose({ meals: mealsFrom(grams), production: 1, sensitivity: 1, exercise, insulinTherapy: false }),
    [grams, exercise],
  );
  const stats = glucoseStats(run);
  const clock = useSimClock({ tMax: 24, speed: 1.6 });
  const { setT, pause } = clock;
  // Vis tida like etter frokost når siden åpnes
  useEffect(() => setT(8.75), [setT]);
  const t = clock.t;
  const G = run.G(t);
  const ins = run.insulin(t);
  const glu = run.glucagon(t);
  const person = (Object.keys(PERSONS) as Person[]).find(
    (p) => Math.abs(PERSONS[p].production - production) < 1e-9 && Math.abs(PERSONS[p].sensitivity - sensitivity) < 1e-9,
  );
  const plan = (Object.keys(MEAL_PLANS) as MealPlan[]).find((p) => MEAL_PLANS[p].grams.every((g, i) => g === grams[i]));
  const outOfRange = G < NORMAL_RANGE[0] || G > NORMAL_RANGE[1];

  return (
    <VizLayout>
      <Toolbar>
        <Forvalg
          label="Person"
          options={(Object.keys(PERSONS) as Person[]).map((p) => ({ value: p, label: PERSONS[p].name }))}
          value={person ?? null}
          onPick={(p) => {
            setProduction(PERSONS[p].production);
            setSensitivity(PERSONS[p].sensitivity);
          }}
        />
      </Toolbar>
      <Controls>
        <Slider
          label="Insulinproduksjon (betaceller)"
          value={Math.round(production * 100)}
          onChange={(v) => setProduction(v / 100)}
          min={0}
          max={100}
          step={5}
          unit="%"
        />
        <Slider
          label="Insulinfølsomhet (muskler, lever)"
          value={Math.round(sensitivity * 100)}
          onChange={(v) => setSensitivity(v / 100)}
          min={10}
          max={100}
          step={5}
          unit="%"
        />
      </Controls>
      <Toolbar>
        <Forvalg
          label="Dagen"
          options={(Object.keys(MEAL_PLANS) as MealPlan[]).map((p) => ({ value: p, label: MEAL_PLANS[p].name }))}
          value={plan ?? null}
          onPick={(p) => setGrams([...MEAL_PLANS[p].grams])}
        />
      </Toolbar>
      <Controls>
        {MEAL_TIMES.map((at, i) => (
          <Slider
            key={at}
            label={`${MEAL_NAMES[i]} kl. ${at}`}
            value={grams[i]!}
            onChange={(v) => setGrams((g) => g.map((x, j) => (j === i ? v : x)) as [number, number, number])}
            min={0}
            max={150}
            step={5}
            unit="g karbohydrat"
          />
        ))}
        <Slider
          label="Klokkeslett"
          value={Math.round(t * 4) / 4}
          onChange={(v) => {
            pause();
            setT(v);
          }}
          min={0}
          max={24}
          step={0.25}
          format={(v) => clockText(v)}
        />
      </Controls>
      <Toolbar>
        <Toggle label={`Fysisk aktivitet (gåtur kl. ${EXERCISE_START})`} checked={exercise} onChange={setExercise} />
        {diabetic1 && <Toggle label="Insulin som medisin" checked={therapy} onChange={setTherapy} />}
        <PlayBar clock={clock} time={clockText(t)} />
      </Toolbar>

      <BodyFigure run={run} t={t} />
      <Legend
        items={[
          { color: GLUCOSE, label: 'Glukose' },
          { color: INSULIN, label: 'Insulin (fra betacellene)' },
          { color: GLUCAGON, label: 'Glukagon (fra alfacellene)' },
        ]}
      />

      <GlucosePlot run={run} healthy={person === 'frisk' ? null : healthy} t={t} exercise={exercise} ogtt={plan === 'glukosebelastning'} />
      <Legend
        items={[
          { color: GLUCOSE, label: 'Blodsukker' },
          ...(person !== 'frisk' ? [{ color: VIZ.muted, label: 'Frisk person, samme dag', dashed: true }] : []),
          { color: INSULIN, label: 'Insulin' },
          { color: GLUCAGON, label: 'Glukagon' },
        ]}
      />

      <Readouts>
        <Readout label={`Blodsukker ${clockText(t)}`} value={fmt(G, 1)} unit="mmol/L" tone={outOfRange ? BIO.sir.I : GLUCOSE} />
        <Readout label={`Høyeste (${clockText(stats.maxAt)})`} value={fmt(stats.max, 1)} unit="mmol/L" />
        <Readout
          label="Fastende (kl. 07)"
          value={fmt(stats.fasting, 1)}
          unit="mmol/L"
          tone={stats.fasting >= DIABETES_FASTING ? BIO.sir.I : undefined}
        />
        <Readout label="Insulin nå" value={fmt(ins, 1)} unit="× fastende" tone={INSULIN} />
      </Readouts>

      <Formula label="Negativ tilbakekobling">
        <FormulaLine>Høyt blodsukker → insulin → muskler og lever tar opp glukose → blodsukkeret synker</FormulaLine>
        <FormulaLine>Lavt blodsukker → glukagon → leveren bryter ned glykogen → blodsukkeret stiger</FormulaLine>
        <FormulaLine>
          Nå: {fmt(G, 1)} mmol/L · insulin {fmt(ins, 1)} og glukagon {fmt(glu, 1)} × fastenivået hos en frisk
        </FormulaLine>
      </Formula>

      <Explain>{explanation(params, run, stats, t, person ?? null, plan ?? null)}</Explain>
    </VizLayout>
  );
}

/* ====================================================================== */
/* Kroppen: tarm, bukspyttkjertel, lever, muskler, hjerne og nyrer          */
/* ====================================================================== */

function BodyFigure({ run, t }: { run: GlucoseRun; t: number }) {
  const [ref, f] = useContainerTextScale<HTMLDivElement>();
  const lw = useLineScale();
  const narrow = f > 1.3;
  const k = Math.max(1, f * 0.85);
  const fl: GlucoseFluxes = run.fluxes(t);
  const G = run.G(t);
  const ins = run.insulin(t);
  const glu = run.glucagon(t);
  const boxH = Math.round(64 + 40 * (f - 1));
  const rowTop = 16;
  const vesselY = rowTop + boxH + 70 * Math.min(1.4, f);
  const vesselH = Math.round(70 + 30 * (f - 1));
  const rowBottom = vesselY + vesselH + 70 * Math.min(1.4, f);
  const H = Math.round(rowBottom + boxH + 16);
  const cols = narrow ? [138, 400, 662] : [110, 400, 690];
  const bw = narrow ? 250 : 200;
  const width = (flux: number) => Math.min(18, 2 + flux / 12);
  const unit = useMemo(() => placeParticles({ x: 0, y: 0, w: 1000, h: 200 }, [{ n: 70, r: 16 }], 9, 4), []);
  const nDots = Math.min(unit.length, Math.round(G * 3.2));
  const r = 4.8 * k;
  const drift = (t * 120) % 1000;
  const organ = (x: number, y: number, title: string, sub: string, paint: { fill: string; line: string }, active = false) => (
    <g>
      <path d={roundedRectPath(x - bw / 2, y, bw, boxH, 14)} fill={paint.fill} stroke={paint.line} strokeWidth={(active ? 3 : 1.6) * lw} />
      <Txt x={x} y={narrow ? y + boxH / 2 + 6 * f : y + boxH / 2 - 2} weight={700} size={narrow ? 0.78 : 0.9}>
        {title}
      </Txt>
      {!narrow && (
        <Txt x={x} y={y + boxH / 2 + 18 * f} size={0.72} muted>
          {sub}
        </Txt>
      )}
    </g>
  );
  const vTop = vesselY;
  const vBot = vesselY + vesselH;
  const meal = fl.gut > 3;
  const urine = fl.urine > 0.5;
  // Insulinavhengig opptak fordelt på lever (glykogen) og muskler/fettvev
  const toLiver = fl.muscle / 3;
  const toMuscle = (2 * fl.muscle) / 3;
  return (
    <div ref={ref}>
      <Figure
        viewBox={`0 0 800 ${H}`}
        maxHeight={narrow ? 900 : 560}
        label={`Blodsukker ${fmt(G, 1)} mmol/L ${clockText(t)}. Insulin ${fmt(ins, 1)} og glukagon ${fmt(glu, 1)} ganger fastenivå.`}
        caption="Pilenes tykkelse viser hvor mye glukose (og hormon) som går hver vei akkurat nå."
      >
        {/* Blodet */}
        <rect
          x={20}
          y={vTop}
          width={760}
          height={vesselH}
          rx={vesselH / 2}
          fill={mixColor(BIO.vannFyll, BIO.oksygenrikt, 0.18)}
          stroke={BIO.oksygenrikt}
          strokeWidth={1.6 * lw}
        />
        {unit.slice(0, nDots).map((p, i) => {
          const x = 40 + (((p.x + drift) % 1000) / 1000) * 720;
          const y = vTop + 10 + ((vesselH - 20) * p.y) / 200;
          return <circle key={i} cx={x} cy={y} r={r} fill={GLUCOSE} stroke={VIZ.surface} strokeWidth={1 * lw} />;
        })}
        <Txt x={400} y={vTop + vesselH / 2 + 6} weight={700} size={0.9}>
          {narrow ? `Blod: ${fmt(G, 1)} mmol/L` : `Blod: ${fmt(G, 1)} mmol/L glukose`}
        </Txt>

        {/* Øverst: tarm, bukspyttkjertel, lever */}
        {organ(cols[0]!, rowTop, 'Tarmen', meal ? 'tar opp glukose fra maten' : 'ingen mat nå', BIO.sopp, meal)}
        {organ(cols[1]!, rowTop, 'Bukspyttkjertelen', 'alfaceller og betaceller', BIO.er)}
        {organ(cols[2]!, rowTop, 'Leveren', 'glykogenlager', BIO.mitokondrie)}
        {/* Nederst: hjerne, muskler/fett, nyrer */}
        {organ(cols[0]!, rowBottom, 'Hjernen', 'bruker glukose hele tida', BIO.kjerne)}
        {organ(
          cols[1]!,
          rowBottom,
          'Muskler og fettvev',
          'tar opp glukose med insulin',
          BIO.pattedyr,
          run.params.exercise && t >= EXERCISE_START && t < EXERCISE_START + EXERCISE_HOURS,
        )}
        {organ(cols[2]!, rowBottom, 'Nyrene', urine ? 'glukose i urinen' : 'ingen glukose i urinen', BIO.vakuole, urine)}

        {/* Glukose: fra tarmen og leveren inn i blodet */}
        {fl.gut > 0.5 && (
          <Arrow
            x1={cols[0]! - 30}
            y1={rowTop + boxH + 4}
            x2={cols[0]! - 30}
            y2={vTop - 4}
            color={GLUCOSE}
            width={width(fl.gut)}
            head={12}
          />
        )}
        <Arrow
          x1={cols[2]! + 40}
          y1={rowTop + boxH + 4}
          x2={cols[2]! + 40}
          y2={vTop - 4}
          color={GLUCOSE}
          width={width(fl.liver)}
          head={12}
        />
        {toLiver > 1 && (
          <Arrow
            x1={cols[2]! - 10}
            y1={vTop - 4}
            x2={cols[2]! - 10}
            y2={rowTop + boxH + 4}
            color={GLUCOSE}
            width={width(toLiver)}
            head={12}
            dashed
          />
        )}
        {/* Hormoner fra bukspyttkjertelen */}
        <Arrow
          x1={cols[1]! - 40}
          y1={rowTop + boxH + 4}
          x2={cols[1]! - 40}
          y2={vTop - 4}
          color={INSULIN}
          width={Math.min(14, 1.5 + ins * 2.2)}
          head={12}
        />
        <Arrow
          x1={cols[1]! + 40}
          y1={rowTop + boxH + 4}
          x2={cols[1]! + 40}
          y2={vTop - 4}
          color={GLUCAGON}
          width={Math.min(14, 1.5 + glu * 2.2)}
          head={12}
        />
        {!narrow && (
          <g>
            <Txt x={cols[1]! - 48} y={(rowTop + boxH + vTop) / 2 + 5} anchor="end" size={0.75} weight={650} color={INSULIN}>
              insulin
            </Txt>
            <Txt x={cols[1]! + 48} y={(rowTop + boxH + vTop) / 2 + 5} anchor="start" size={0.75} weight={650} color={GLUCAGON}>
              glukagon
            </Txt>
            <Txt x={cols[2]! + 52} y={(rowTop + boxH + vTop) / 2 + 5} anchor="start" size={0.72} muted>
              ut
            </Txt>
            <Txt x={cols[2]! - 22} y={(rowTop + boxH + vTop) / 2 + 5} anchor="end" size={0.72} muted>
              lagres
            </Txt>
          </g>
        )}
        {/* Opptak fra blodet */}
        <Arrow x1={cols[0]!} y1={vBot + 4} x2={cols[0]!} y2={rowBottom - 4} color={GLUCOSE} width={width(fl.brain)} head={12} />
        <Arrow x1={cols[1]!} y1={vBot + 4} x2={cols[1]!} y2={rowBottom - 4} color={GLUCOSE} width={width(toMuscle)} head={12} />
        {urine && <Arrow x1={cols[2]!} y1={vBot + 4} x2={cols[2]!} y2={rowBottom - 4} color={GLUCOSE} width={width(fl.urine)} head={12} />}
      </Figure>
    </div>
  );
}

/* ====================================================================== */
/* Blodsukker og hormoner gjennom døgnet                                    */
/* ====================================================================== */

function GlucosePlot({
  run,
  healthy,
  t,
  exercise,
  ogtt,
}: {
  run: GlucoseRun;
  healthy: GlucoseRun | null;
  t: number;
  exercise: boolean;
  ogtt: boolean;
}) {
  const [ref, f] = useContainerTextScale<HTMLDivElement>();
  const H1 = Math.round(330 + 260 * (f - 1));
  const H2 = Math.round(200 + 150 * (f - 1));
  const series = useMemo(() => {
    const g: [number, number][] = [];
    const h: [number, number][] = [];
    const i: [number, number][] = [];
    const a: [number, number][] = [];
    for (let s = 0; s <= 24 + 1e-9; s += 0.05) {
      g.push([s, run.G(s)]);
      if (healthy) h.push([s, healthy.G(s)]);
      i.push([s, run.insulin(s)]);
      a.push([s, run.glucagon(s)]);
    }
    return { g, h, i, a };
  }, [run, healthy]);
  const gMax = Math.max(...series.g.map(([, v]) => v));
  const yMax = gMax > 20 ? 35 : gMax > 14 ? 20 : 14;
  const yTicks = yMax === 35 ? [0, 5, 10, 15, 20, 25, 30, 35] : yMax === 20 ? [0, 4, 8, 12, 16, 20] : [0, 2, 4, 6, 8, 10, 12, 14];
  const iMax = Math.max(4, Math.ceil(Math.max(...series.i.map(([, v]) => v), ...series.a.map(([, v]) => v))));
  const x = { min: 0, max: 24, label: 'Klokkeslett (timer)', ticks: [0, 4, 8, 12, 16, 20, 24] };
  const head = 22 * f;
  const meals = run.params.meals;
  return (
    <div ref={ref}>
      <Figure
        viewBox={`0 0 800 ${H1 + H2 + 2 * head}`}
        maxHeight={f > 1.3 ? 1400 : Math.round((H1 + H2 + 2 * head) * 1.15)}
        label={`Blodsukker gjennom døgnet: høyest ${fmt(gMax, 1)} mmol/L.`}
      >
        <Txt x={20} y={head - 4} anchor="start" weight={650} size={0.9}>
          Blodsukker
        </Txt>
        <g transform={`translate(0 ${head})`}>
          <Plot x={x} y={{ min: 0, max: yMax, label: 'mmol/L', ticks: yTicks }} width={800} height={H1}>
            {({ sx, sy, x0, x1, y0, y1 }) => (
              <g>
                <rect
                  x={x0}
                  y={sy(NORMAL_RANGE[1])}
                  width={x1 - x0}
                  height={sy(NORMAL_RANGE[0]) - sy(NORMAL_RANGE[1])}
                  fill={BIO.sir.R}
                  opacity={0.1}
                />
                <rect x={x0} y={sy(HYPO)} width={x1 - x0} height={y0 - sy(HYPO)} fill={BIO.sir.I} opacity={0.07} />
                <Txt x={x0 + 8} y={sy(NORMAL_RANGE[1]) + 18 * f} anchor="start" size={0.72} color={BIO.sir.R}>
                  normalt 4–8
                </Txt>
                <Txt x={x0 + 8} y={sy(HYPO) + 16 * f} anchor="start" size={0.72} color={BIO.sir.I}>
                  for lavt (føling)
                </Txt>
                <line
                  x1={x0}
                  x2={x1}
                  y1={sy(RENAL_THRESHOLD)}
                  y2={sy(RENAL_THRESHOLD)}
                  stroke={VIZ.muted}
                  strokeWidth={1.4}
                  strokeDasharray="6 6"
                />
                <Txt x={x1 - 6} y={sy(RENAL_THRESHOLD) - 7} anchor="end" size={0.72} muted>
                  nyreterskel
                </Txt>
                {ogtt && (
                  <g>
                    <line
                      x1={x0}
                      x2={x1}
                      y1={sy(DIABETES_2H)}
                      y2={sy(DIABETES_2H)}
                      stroke={BIO.sir.I}
                      strokeWidth={1.4}
                      strokeDasharray="3 5"
                    />
                    <line x1={sx(10)} x2={sx(10)} y1={y0} y2={y1} stroke={BIO.sir.I} strokeWidth={1.2} strokeDasharray="3 5" />
                    <Txt x={sx(10) + 6} y={sy(DIABETES_2H) - 7} anchor="start" size={0.72} color={BIO.sir.I}>
                      2 timer etter: diabetes over 11,1
                    </Txt>
                  </g>
                )}
                {exercise && (
                  <rect
                    x={sx(EXERCISE_START)}
                    y={y1}
                    width={sx(EXERCISE_START + EXERCISE_HOURS) - sx(EXERCISE_START)}
                    height={y0 - y1}
                    fill={BIO.sir.R}
                    opacity={0.18}
                  />
                )}
                {healthy && <path d={linePath(series.h, sx, sy)} fill="none" stroke={VIZ.muted} strokeWidth={2} strokeDasharray="7 6" />}
                <path
                  d={linePath(
                    series.g.map(([a, b]) => [a, Math.min(yMax, b)] as [number, number]),
                    sx,
                    sy,
                  )}
                  fill="none"
                  stroke={GLUCOSE}
                  strokeWidth={3.4}
                />
                {meals.map((m, i) => (
                  <g key={i}>
                    <path d={`M${sx(m.at) - 7},${y0 - 2} L${sx(m.at)},${y0 - 14} L${sx(m.at) + 7},${y0 - 2} Z`} fill={GLUCOSE} />
                    {f <= 1.3 && (
                      <Txt x={sx(m.at)} y={y0 - 20} size={0.7} muted>
                        {`${m.grams} g`}
                      </Txt>
                    )}
                  </g>
                ))}
                <line x1={sx(t)} x2={sx(t)} y1={y0} y2={y1} className="viz-guide" />
                <circle cx={sx(t)} cy={sy(Math.min(yMax, run.G(t)))} r={7} fill={GLUCOSE} stroke={VIZ.surface} strokeWidth={2.5} />
              </g>
            )}
          </Plot>
        </g>
        <Txt x={20} y={H1 + 2 * head - 4} anchor="start" weight={650} size={0.9}>
          Insulin og glukagon (1 = fastenivå)
        </Txt>
        <g transform={`translate(0 ${H1 + 2 * head})`}>
          <Plot
            x={x}
            y={{
              min: 0,
              max: iMax,
              label: 'Relativt',
              ticks: Array.from({ length: iMax + 1 }, (_, i) => i).filter((v) => iMax <= 6 || v % 2 === 0),
            }}
            width={800}
            height={H2}
          >
            {({ sx, sy, y0, y1 }) => (
              <g>
                <path d={linePath(series.i, sx, sy)} fill="none" stroke={INSULIN} strokeWidth={3} />
                <path d={linePath(series.a, sx, sy)} fill="none" stroke={GLUCAGON} strokeWidth={3} />
                <line x1={sx(t)} x2={sx(t)} y1={y0} y2={y1} className="viz-guide" />
                <circle cx={sx(t)} cy={sy(run.insulin(t))} r={5.5} fill={INSULIN} stroke={VIZ.surface} strokeWidth={2} />
                <circle cx={sx(t)} cy={sy(run.glucagon(t))} r={5.5} fill={GLUCAGON} stroke={VIZ.surface} strokeWidth={2} />
              </g>
            )}
          </Plot>
        </g>
      </Figure>
    </div>
  );
}

/* ====================================================================== */
/* Forklaring                                                               */
/* ====================================================================== */

function explanation(
  p: { production: number; sensitivity: number; exercise: boolean; insulinTherapy: boolean },
  run: GlucoseRun,
  stats: ReturnType<typeof glucoseStats>,
  t: number,
  person: Person | null,
  plan: MealPlan | null,
): ReactNode {
  const G = run.G(t);
  const model = (
    <p>
      Modellen er forenklet og er ikke en medisinsk simulator: den viser hovedtrekkene i reguleringen med én «gjennomsnittsperson», og
      tallene er typiske verdier.
    </p>
  );
  const ins = run.insulin(t);
  const glu = run.glucagon(t);
  let now: ReactNode;
  if (G > 8 && ins < 0.5)
    now = (
      <p>
        <strong>Blodsukkeret er høyt ({fmt(G, 1)} mmol/L), men det kommer nesten ikke insulin.</strong> Uten insulin får ikke muskel- og
        fettcellene signal om å ta opp glukose, og leveren fortsetter å sende ut glukose. Den negative tilbakekoblingen virker ikke.
      </p>
    );
  else if (G > 7.5 || ins > 1.4)
    now = (
      <p>
        <strong>Etter et måltid stiger blodsukkeret ({fmt(G, 1)} mmol/L).</strong> Betacellene i de langerhanske øyene oppdager det og
        skiller ut insulin ({fmt(ins, 1)} ganger fastenivået). Insulin er et signal: det binder seg til reseptorer på muskel-, fett- og
        leverceller, som da tar opp glukose og lagrer den som glykogen og fett. Leveren slutter å sende ut glukose, og blodsukkeret går ned
        igjen: <strong>negativ tilbakekobling</strong>.
      </p>
    );
  else if (G < 4.6 || glu > 1.3)
    now = (
      <p>
        <strong>Blodsukkeret er lavt ({fmt(G, 1)} mmol/L).</strong> Alfacellene skiller ut glukagon, og insulinet faller. Glukagon får
        leveren til å bryte ned glykogen og sende glukose ut i blodet, så blodsukkeret går opp igjen.
        {G < HYPO ? ' Under ca. 4 mmol/L kan man få føling: svimmelhet, svette og skjelving. Hjernen trenger glukose hele tida.' : ''}
      </p>
    );
  else
    now = (
      <p>
        <strong>Blodsukkeret er {fmt(G, 1)} mmol/L.</strong> Mellom måltidene holder leveren blodsukkeret oppe ved å sende ut glukose fra
        glykogenlageret, mens hjernen og andre organer bruker glukose hele tida. Små mengder insulin og glukagon balanserer hverandre, så
        blodsukkeret holder seg omtrent konstant: homeostase.
      </p>
    );
  let who: ReactNode;
  if (p.production < 0.5)
    who = p.insulinTherapy ? (
      <p>
        <strong>Type 1-diabetes med insulin som medisin.</strong> Personen får langtidsvirkende insulin og hurtigvirkende insulin til hvert
        måltid, tilpasset karbohydratene. Da holder blodsukkeret seg stort sett mellom {fmt(stats.min, 1)} og {fmt(stats.max, 1)} mmol/L.
        {p.exercise
          ? ` Med fysisk aktivitet tar musklene opp mer glukose, og blodsukkeret faller til ${fmt(stats.min, 1)} mmol/L. Derfor må personer med diabetes ofte spise litt ekstra eller ta mindre insulin når de trener.`
          : ''}
      </p>
    ) : (
      <p>
        <strong>Type 1-diabetes uten behandling.</strong> Immunforsvaret har ødelagt betacellene, så kroppen lager{' '}
        {p.production > 0 ? 'nesten ' : ''}
        ikke insulin. Cellene tar da ikke opp glukose, og leveren fortsetter å sende ut glukose. Blodsukkeret blir svært høyt (opp til{' '}
        {fmt(stats.max, 0)} mmol/L), og over nyreterskelen (ca. 10 mmol/L) kommer det glukose i urinen. Type 1-diabetes skyldes ikke sukker
        i maten, og behandles med insulin. Slå på «Insulin som medisin».
      </p>
    );
  else if (p.sensitivity < 0.6)
    who = (
      <p>
        <strong>Insulinresistens (type 2-diabetes).</strong> Bukspyttkjertelen lager insulin, men muskler, fettvev og lever reagerer svakt
        på det. Blodsukkeret blir høyere og holder seg høyt lenger (topp {fmt(stats.max, 1)} mmol/L, fastende {fmt(stats.fasting, 1)}{' '}
        mmol/L). Risikoen øker med overvekt og lite fysisk aktivitet.{' '}
        {p.exercise
          ? 'Fysisk aktivitet hjelper: arbeidende muskler tar opp glukose uten insulin, og blir mer følsomme for insulin i timene etterpå.'
          : 'Prøv å slå på fysisk aktivitet, eller øk insulinfølsomheten: regelmessig aktivitet og vektnedgang gjør cellene mer følsomme.'}
      </p>
    );
  else
    who = (
      <p>
        <strong>{person === 'frisk' ? 'Frisk person.' : 'Normal regulering.'}</strong> Blodsukkeret holder seg mellom {fmt(stats.min, 1)} og{' '}
        {fmt(stats.max, 1)} mmol/L gjennom døgnet{plan === 'faste' ? ', selv uten mat: glukagon og leveren holder det oppe' : ''}.{' '}
        {plan === 'glukosebelastning'
          ? `I en glukosebelastning drikker man 75 g glukose og måler blodsukkeret to timer etter (${fmt(run.G(10), 1)} mmol/L her). Over 11,1 mmol/L tyder det på diabetes.`
          : p.exercise
            ? 'Turen etter middag gjør at musklene tar opp mer glukose, så toppen etter middag blir lavere.'
            : ''}
      </p>
    );
  return (
    <>
      {now}
      {who}
      {model}
    </>
  );
}
