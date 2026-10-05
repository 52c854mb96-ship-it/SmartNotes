import { useEffect, useState, type ReactNode } from 'react';
import {
  Arrow,
  BIO,
  Controls,
  Explain,
  Figure,
  Legend,
  PlayBar,
  Readout,
  Readouts,
  Segmented,
  Slider,
  Toolbar,
  Txt,
  VIZ,
  VizLayout,
  fmt,
  linePath,
  mixColor,
  roundedRectPath,
  sample,
  useContainerTextScale,
  useSimClock,
} from '../kit';
import {
  CYCLE_DAYS,
  FERTILIZATION_DAY,
  IMPLANTATION_DAY,
  OVULATION_DAY,
  PHASE_NAMES,
  PILL_DAYS,
  bleeding,
  endometrium,
  feedbackAt,
  hormonesAt,
  lastDay,
  ovaryAt,
  peakDay,
  phaseAt,
  phaseBands,
  type CycleScenario,
  type CyclePhase,
  type Feedback,
  type Hormones,
  type OvaryStage,
} from './model';

const SCENARIOS: { value: CycleScenario; label: string }[] = [
  { value: 'vanlig', label: 'Vanlig syklus' },
  { value: 'graviditet', label: 'Graviditet' },
  { value: 'p-piller', label: 'P-piller' },
];

/** Fargene på hormonkurvene (samme i figuren, fargeforklaringen og tilbakekoblingsfiguren). */
const COL: Record<'fsh' | 'lh' | 'ostrogen' | 'progesteron' | 'hcg', string> = {
  fsh: VIZ.series[0],
  lh: VIZ.series[2],
  ostrogen: VIZ.series[4],
  progesteron: VIZ.series[1],
  hcg: VIZ.series[3],
};
const BLOOD = BIO.oksygenrikt;
const PILL = VIZ.muted;

const PHASE_COLOR: Record<CyclePhase, string> = {
  menstruasjon: mixColor(VIZ.surface, BLOOD, 0.22),
  follikkelfase: mixColor(VIZ.surface, COL.fsh, 0.14),
  eggløsning: mixColor(VIZ.surface, COL.lh, 0.35),
  gulelegemefase: mixColor(VIZ.surface, COL.progesteron, 0.16),
  graviditet: mixColor(VIZ.surface, COL.hcg, 0.18),
  pille: mixColor(VIZ.surface, PILL, 0.16),
  pillefri: mixColor(VIZ.surface, BLOOD, 0.16),
};

const FEEDBACK_TEXT: Record<Feedback, string> = {
  'negativ-ostrogen': 'Negativ',
  positiv: 'Positiv',
  'negativ-progesteron': 'Negativ',
  svekkes: 'Svekkes',
  hcg: 'Negativ',
  pille: 'Negativ',
};

/** Toppen i østrogenkurven (for «… % av toppen» i forklaringen). */
const OSTROGEN_PEAK = hormonesAt(peakDay('ostrogen', 'vanlig', 1, OVULATION_DAY + 2), 'vanlig').ostrogen;

/** Myk bindestrek i lange ord, så de kan deles i de smale avlesningsboksene på mobil. */
function hyphenate(s: string): string {
  return s.replace('Gulelegemefase', 'Gulelegeme\u00adfase').replace('Follikkelfase', 'Follikkel\u00adfase').replace('Menstruasjon', 'Menstrua\u00adsjon');
}

export default function Menstruasjonssyklusen() {
  const [scenario, setScenario] = useState<CycleScenario>('vanlig');
  const last = lastDay(scenario);
  const clock = useSimClock({ tMax: last - 1, speed: 2 });
  const { setT, pause } = clock;
  // Åpner på dag 12: østrogenet er høyt, og den positive tilbakekoblingen er i gang
  useEffect(() => setT(11), [setT]);
  const day = Math.min(last, Math.max(1, Math.floor(clock.t + 1 + 1e-9)));
  const h = hormonesAt(day, scenario);
  const phase = phaseAt(day, scenario);
  const fb = feedbackAt(day, scenario);
  const lining = endometrium(day, scenario);
  const [ref, f] = useContainerTextScale<HTMLDivElement>();
  const [fbRef, ff] = useContainerTextScale<HTMLDivElement>();
  const pick = (s: CycleScenario) => {
    setScenario(s);
    if (day > lastDay(s)) setT(lastDay(s) - 1);
  };

  return (
    <VizLayout>
      <Toolbar>
        <Segmented label="Situasjon" options={SCENARIOS} value={scenario} onChange={pick} />
      </Toolbar>
      <Controls>
        <Slider
          label="Dag i syklusen"
          value={day}
          onChange={(v) => {
            pause();
            setT(v - 1);
          }}
          min={1}
          max={last}
          step={1}
          format={(v) => `dag ${fmt(v, 0)}`}
        />
      </Controls>
      <Toolbar>
        <PlayBar clock={clock} time={`dag ${day}`} />
      </Toolbar>

      <div ref={ref}>
        <CycleFigure scenario={scenario} day={day} f={f} />
      </div>
      <Legend
        items={[
          { color: COL.fsh, label: 'FSH (hypofysen)' },
          { color: COL.lh, label: 'LH (hypofysen)' },
          { color: COL.ostrogen, label: 'Østrogen (follikkelen)' },
          { color: COL.progesteron, label: 'Progesteron (gulelegemet)' },
          ...(scenario === 'graviditet' ? [{ color: COL.hcg, label: 'hCG (embryoet)' }] : []),
          ...(scenario === 'p-piller' ? [{ color: PILL, label: 'Hormoner fra p-pillen (østrogen og gestagen)', dashed: true }] : []),
        ]}
      />

      <div ref={fbRef}>
        <FeedbackFigure scenario={scenario} day={day} h={h} fb={fb} lining={lining} f={ff} />
      </div>

      <Readouts>
        <Readout label="Dag" value={String(day)} unit={scenario === 'graviditet' && day > CYCLE_DAYS ? `uke ${Math.ceil(day / 7)} av svangerskapet` : `av ${CYCLE_DAYS}`} />
        <Readout label="Fase" value={hyphenate(PHASE_NAMES[phase])} />
        <Readout label="Livmorslimhinnen" value={fmt(lining, 0)} unit={bleeding(day, scenario) ? 'mm, blør' : 'mm tykk'} tone={BLOOD} />
        <Readout
          label="Tilbakekobling på hypofysen"
          value={FEEDBACK_TEXT[fb]}
          tone={fb === 'positiv' ? COL.lh : fb === 'svekkes' ? VIZ.muted : undefined}
        />
      </Readouts>

      <Explain>{explanation(scenario, day, h)}</Explain>
    </VizLayout>
  );
}

/* ====================================================================== */
/* Syklusen: fase, eggstokken, hormonene og livmorslimhinnen på samme tidsakse */
/* ====================================================================== */

/** Dagene der eggstokken tegnes. */
function ovaryDays(s: CycleScenario): number[] {
  if (s === 'graviditet') return [3, 9, 14, 20, 27, 34, 41];
  return [2, 6, 10, 14, 18, 22, 26];
}

function CycleFigure({ scenario, day, f }: { scenario: CycleScenario; day: number; f: number }) {
  const last = lastDay(scenario);
  const X0 = 24;
  const X1 = 776;
  const sx = (d: number) => X0 + ((d - 1) / (last - 1)) * (X1 - X0);
  const k = Math.max(1, 0.85 * f);
  const title = 24 * f;
  // Faser
  const yPhase = 6;
  const phaseH = 26 * f;
  // Eggstokken
  const yOvT = yPhase + phaseH + 10 + title;
  const ovH = Math.round(62 * k + 30 * (k - 1));
  // Hormonene
  const yHT = yOvT + ovH + 8 + title;
  const hormH = Math.round(190 + 300 * (f - 1));
  // Livmorslimhinnen
  const yET = yHT + hormH + 8 + title;
  const endoH = Math.round(84 + 120 * (f - 1));
  const yAxis = yET + endoH;
  const H = Math.round(yAxis + 26 * f + 26 * f);
  const hy = (v: number) => yHT + hormH - (v / 1.12) * hormH;
  const ey = (mm: number) => yAxis - (mm / 15) * endoH;
  const keys: (keyof typeof COL)[] = ['fsh', 'lh', 'ostrogen', 'progesteron', ...(scenario === 'graviditet' ? (['hcg'] as const) : [])];
  const curves = keys.map((key) => ({
    key,
    d: linePath(
      sample((d) => hormonesAt(d, scenario)[key], 1, last, last * 8),
      sx,
      hy,
    ),
  }));
  const ticks = scenario === 'graviditet' ? [1, 7, 14, 21, 28, 35, 42] : [1, 7, 14, 21, 28];
  const lining = sample((d) => endometrium(d, scenario), 1, last, last * 6);
  const liningPath = `${linePath(lining, sx, ey)} L${sx(last)},${yAxis} L${sx(1)},${yAxis} Z`;
  const cx = sx(day);
  const ovDays = ovaryDays(scenario);
  const activeOv = ovDays.reduce((best, d) => (Math.abs(d - day) < Math.abs(best - day) ? d : best), ovDays[0]!);
  const h = hormonesAt(day, scenario);
  // Blødningen som et mørkere felt under slimhinnekurven
  const bleedPaths: string[] = [];
  let runStart: number | null = null;
  for (let d = 1; d <= last + 1e-9; d += 0.125) {
    const on = d < last && bleeding(d, scenario);
    if (on && runStart === null) runStart = d;
    if (!on && runStart !== null) {
      const pts = sample((x) => endometrium(x, scenario), runStart, d, 24);
      bleedPaths.push(`${linePath(pts, sx, ey)} L${sx(d)},${yAxis} L${sx(runStart)},${yAxis} Z`);
      runStart = null;
    }
  }
  return (
    <Figure
      viewBox={`0 0 800 ${H}`}
      maxHeight={Math.round(H * 1.25)}
      label={`Menstruasjonssyklusen: faser, eggstokken, hormonene FSH, LH, østrogen og progesteron og livmorslimhinnen dag 1 til ${last}. Valgt dag ${day}.`}
      caption="Skjematiske kurver: nivåene er relative og viser formen, ikke målte verdier. Syklusen varierer fra person til person."
    >
      {/* Faser */}
      {phaseBands(scenario).map(([a, b, p]) => {
        const x0 = sx(Math.max(1, a - 0.5));
        const x1 = sx(Math.min(last, b - 0.5));
        const w = Math.max(0, x1 - x0);
        const label = PHASE_NAMES[p];
        const fits = w > label.length * 9.4 * f + 10;
        const short = p === 'gulelegemefase' ? 'Gulelegeme' : p === 'follikkelfase' ? 'Follikkel' : p === 'menstruasjon' ? 'Mens.' : label;
        const fitsShort = w > short.length * 9.4 * f + 8;
        return (
          <g key={`${a}-${p}`}>
            <rect x={x0} y={yPhase} width={w} height={phaseH} fill={PHASE_COLOR[p]} />
            {p !== 'eggløsning' && (fits || fitsShort) && (
              <Txt x={x0 + w / 2} y={yPhase + phaseH / 2 + 6 * f} size={0.8} weight={600}>
                {fits ? label : short}
              </Txt>
            )}
          </g>
        );
      })}
      {/* Eggløsningen som linje gjennom hele figuren */}
      {scenario !== 'p-piller' && (
        <line x1={sx(OVULATION_DAY)} x2={sx(OVULATION_DAY)} y1={yPhase} y2={yAxis} stroke={COL.lh} strokeWidth={1.5} strokeDasharray="3 4" opacity={0.8} />
      )}

      {/* Eggstokken */}
      <Txt x={X0} y={yOvT - 6} anchor="start" size={0.85} weight={650}>
        Eggstokken
      </Txt>
      {ovDays.map((d) => {
        const st = ovaryAt(d, scenario);
        return (
          <g key={d} opacity={d === activeOv ? 1 : 0.42}>
            <OvaryIcon x={sx(d)} y={yOvT + ovH / 2} stage={st.stage} size={st.size} k={k} />
          </g>
        );
      })}

      {/* Hormonene */}
      <Txt x={X0} y={yHT - 6} anchor="start" size={0.85} weight={650}>
        Hormoner i blodet
      </Txt>
      <rect x={X0} y={yHT} width={X1 - X0} height={hormH} fill="none" stroke={VIZ.grid} strokeWidth={1.2} />
      {scenario === 'p-piller' && (
        <g>
          <rect x={sx(1)} y={hy(0.7)} width={sx(PILL_DAYS + 0.5) - sx(1)} height={hy(0) - hy(0.7)} fill={mixColor(VIZ.surface, PILL, 0.16)} />
          <line x1={sx(1)} x2={sx(PILL_DAYS + 0.5)} y1={hy(0.7)} y2={hy(0.7)} stroke={PILL} strokeWidth={2.5} strokeDasharray="7 5" />
          <Txt x={sx(11)} y={hy(0.7) - 8} size={0.8} muted>
            hormoner fra p-pillen
          </Txt>
        </g>
      )}
      {curves.map((c) => (
        <path key={c.key} d={c.d} fill="none" stroke={COL[c.key]} strokeWidth={c.key === 'lh' ? 3.2 : 2.8} strokeLinejoin="round" />
      ))}
      {scenario !== 'p-piller' && (
        <Txt x={sx(13.4) + 12} y={hy(1.0) + 6 * f} anchor="start" size={0.78} color={COL.lh} weight={650}>
          {f > 1.3 || scenario === 'graviditet' ? 'LH-topp' : 'LH-topp → eggløsning'}
        </Txt>
      )}
      {scenario === 'graviditet' && (
        <g>
          <line x1={sx(FERTILIZATION_DAY)} x2={sx(FERTILIZATION_DAY)} y1={yHT} y2={yAxis} stroke={COL.hcg} strokeWidth={1.3} strokeDasharray="2 4" />
          <line x1={sx(IMPLANTATION_DAY)} x2={sx(IMPLANTATION_DAY)} y1={yHT} y2={yAxis} stroke={COL.hcg} strokeWidth={1.3} strokeDasharray="2 4" />
          <Txt x={f > 1.3 ? sx(IMPLANTATION_DAY) + 4 : sx(FERTILIZATION_DAY) + 4} y={yHT - 6} anchor="start" size={0.75} color={COL.hcg} weight={600}>
            {f > 1.3 ? 'innfesting' : 'befruktning (dag 15) og innfesting (dag 21)'}
          </Txt>
        </g>
      )}

      {/* Livmorslimhinnen */}
      <Txt x={X0} y={yET - 6} anchor="start" size={0.85} weight={650}>
        Livmorslimhinnen
      </Txt>
      <path d={liningPath} fill={mixColor(VIZ.surface, BLOOD, 0.22)} />
      {bleedPaths.map((d, i) => (
        <path key={i} d={d} fill={BLOOD} opacity={0.55} />
      ))}
      <LiningVessels scenario={scenario} sx={sx} ey={ey} yAxis={yAxis} last={last} />
      <path d={linePath(lining, sx, ey)} fill="none" stroke={BLOOD} strokeWidth={2.2} />

      {/* Akse */}
      <line x1={X0} x2={X1} y1={yAxis} y2={yAxis} className="viz-axis" />
      {ticks.map((d) => (
        <g key={d}>
          <line x1={sx(d)} x2={sx(d)} y1={yAxis} y2={yAxis + 6} className="viz-axis" />
          <Txt x={Math.min(X1 - 8, Math.max(X0 + 8, sx(d)))} y={yAxis + 24 * f} size={0.8} muted>
            {d}
          </Txt>
        </g>
      ))}
      <Txt x={400} y={H - 8} size={0.85} muted>
        Dag i syklusen
      </Txt>

      {/* Valgt dag */}
      <line x1={cx} x2={cx} y1={yPhase} y2={yAxis} stroke={VIZ.ink} strokeWidth={1.6} strokeDasharray="5 4" />
      {keys.map((key) => (
        <circle key={key} cx={cx} cy={hy(h[key])} r={5.5} fill={COL[key]} stroke={VIZ.surface} strokeWidth={2.2} />
      ))}
      <circle cx={cx} cy={ey(endometrium(day, scenario))} r={5.5} fill={BLOOD} stroke={VIZ.surface} strokeWidth={2.2} />
    </Figure>
  );
}

/** Spiralarterier i slimhinnen: korte bølgestreker som følger tykkelsen. */
function LiningVessels({
  scenario,
  sx,
  ey,
  yAxis,
  last,
}: {
  scenario: CycleScenario;
  sx: (d: number) => number;
  ey: (mm: number) => number;
  yAxis: number;
  last: number;
}) {
  const days: number[] = [];
  for (let d = 1.5; d < last; d += 1.5) days.push(d);
  return (
    <g>
      {days.map((d) => {
        const top = ey(endometrium(d, scenario)) + 6;
        const len = yAxis - top - 4;
        if (len < 12 || bleeding(d, scenario)) return null;
        const x = sx(d);
        const n = Math.max(1, Math.floor(len / 10));
        const seg = len / n;
        let path = `M${x},${yAxis - 2}`;
        for (let i = 0; i < n; i++) path += ` q${i % 2 ? -4 : 4},${-seg / 2} 0,${-seg}`;
        return <path key={d} d={path} fill="none" stroke={BLOOD} strokeWidth={1.2} opacity={0.55} />;
      })}
    </g>
  );
}

/** Eggstokken på én dag: follikkel med eggcelle, eggløsning, gulelegeme eller små hvilende follikler. */
function OvaryIcon({ x, y, stage, size, k }: { x: number; y: number; stage: OvaryStage; size: number; k: number }) {
  const r = (4 + size * 0.95) * Math.min(k, 1.6);
  const egg = 3.6 * Math.min(k, 1.6);
  const follicle = { fill: mixColor(VIZ.surface, BIO.signal, 0.14), line: BIO.signal };
  const luteum = { fill: mixColor(VIZ.surface, BIO.sukker, 0.45), line: BIO.sukker };
  if (stage === 'hvilende')
    return (
      <g>
        {[-1, 0, 1].map((i) => (
          <circle key={i} cx={x + i * r * 1.4} cy={y + (i === 0 ? -3 : 3)} r={r * 0.5} fill={follicle.fill} stroke={follicle.line} strokeWidth={1.4} />
        ))}
      </g>
    );
  if (stage === 'follikkel')
    return (
      <g>
        <circle cx={x} cy={y} r={r} fill={follicle.fill} stroke={follicle.line} strokeWidth={1.8} />
        {size > 9 && <circle cx={x + r * 0.15} cy={y - r * 0.1} r={r * 0.62} fill={mixColor(VIZ.surface, BIO.vann, 0.12)} stroke={follicle.line} strokeWidth={0.9} opacity={0.9} />}
        <circle cx={x - r * 0.55} cy={y + r * 0.35} r={egg} fill={BIO.kjerne.fill} stroke={BIO.kjerne.line} strokeWidth={1.4} />
      </g>
    );
  if (stage === 'eggløsning')
    return (
      <g>
        <path
          d={`M${x + r * 0.5},${y - r * 0.85} A${r},${r} 0 1 0 ${x + r * 0.95},${y - r * 0.2}`}
          fill={follicle.fill}
          stroke={follicle.line}
          strokeWidth={1.8}
        />
        <circle cx={x + r * 1.25} cy={y - r * 0.95} r={egg * 1.2} fill={BIO.kjerne.fill} stroke={BIO.kjerne.line} strokeWidth={1.6} />
      </g>
    );
  const fading = stage === 'tilbakedannes';
  return (
    <g>
      <circle
        cx={x}
        cy={y}
        r={r}
        fill={fading ? mixColor(luteum.fill, BIO.dod, 0.5) : luteum.fill}
        stroke={fading ? BIO.dod : luteum.line}
        strokeWidth={1.8}
      />
      {[0.3, 0.55].map((u) => (
        <circle key={u} cx={x} cy={y} r={r * u} fill="none" stroke={fading ? BIO.dod : luteum.line} strokeWidth={0.8} opacity={0.5} />
      ))}
    </g>
  );
}

/* ====================================================================== */
/* Tilbakekobling: hypofysen, eggstokken og livmoren                       */
/* ====================================================================== */

interface Node {
  x: number;
  y: number;
  w: number;
  h: number;
}

function FeedbackFigure({
  scenario,
  day,
  h,
  fb,
  lining,
  f,
}: {
  scenario: CycleScenario;
  day: number;
  h: Hormones;
  fb: Feedback;
  lining: number;
  f: number;
}) {
  const narrow = f > 1.3;
  const k = Math.max(1, 0.85 * f);
  const ov = ovaryAt(day, scenario);
  // Plassering: vannrett på PC, loddrett på mobil
  const W = 800;
  let pit: Node;
  let ovary: Node;
  let uterus: Node;
  let H: number;
  if (!narrow) {
    const bh = 150;
    const top = 84;
    pit = { x: 30, y: top, w: 172, h: bh };
    ovary = { x: 314, y: top, w: 172, h: bh };
    uterus = { x: 598, y: top, w: 172, h: bh };
    H = top + bh + 110;
  } else {
    const bw = 380;
    const bh = 150 * k;
    const gap = 150 * k;
    // Boksene litt til venstre, så hCG-buen på høyre side får plass ved siden av etiketten «progesteron»
    const left = 260;
    pit = { x: left, y: 30 * f + 40, w: bw, h: bh * 0.8 };
    ovary = { x: left, y: pit.y + pit.h + gap, w: bw, h: bh };
    uterus = { x: left, y: ovary.y + ovary.h + gap, w: bw, h: bh };
    H = uterus.y + uterus.h + 30;
  }
  const width = (v: number) => (2 + 11 * Math.min(1.1, v)) * (narrow ? k : 1);
  const sign = fb === 'positiv' ? '+' : fb === 'svekkes' ? '±' : '−';
  const fbColor = fb === 'positiv' ? COL.lh : fb === 'svekkes' ? VIZ.muted : COL.progesteron;
  const fbHormone =
    fb === 'negativ-ostrogen' || fb === 'positiv' ? 'østrogen' : fb === 'pille' ? 'p-pillen' : fb === 'svekkes' ? 'lite progesteron' : 'progesteron';
  const fbLine =
    fb === 'positiv'
      ? 'mye østrogen gir LH-topp'
      : fb === 'svekkes'
        ? scenario === 'p-piller'
          ? 'pillefri: FSH stiger litt'
          : 'gulelegemet går til grunne'
        : fb === 'pille'
          ? 'hemmer FSH og LH'
          : fb === 'hcg'
            ? 'progesteron hemmer FSH og LH'
            : fb === 'negativ-ostrogen'
              ? 'østrogen hemmer FSH'
              : 'progesteron hemmer FSH og LH';
  const mid = (n: Node) => ({ x: n.x + n.w / 2, y: n.y + n.h / 2 });
  const P = mid(pit);
  const O = mid(ovary);
  const U = mid(uterus);
  const pill = scenario === 'p-piller';
  const pillOn = pill && h.pille > 0;
  const preg = scenario === 'graviditet' && day >= IMPLANTATION_DAY;
  const box = (n: Node, title: string, sub: string, children?: ReactNode) => (
    <g>
      <path d={roundedRectPath(n.x, n.y, n.w, n.h, 14)} fill={VIZ.surface} stroke={VIZ.muted} strokeWidth={1.6} />
      <Txt x={n.x + n.w / 2} y={n.y + 24 * f} weight={700} size={0.95}>
        {title}
      </Txt>
      <Txt x={n.x + n.w / 2} y={n.y + n.h - 12} size={0.75} muted>
        {sub}
      </Txt>
      {children}
    </g>
  );
  // Piler mellom boksene (to ved siden av hverandre)
  const pair = (from: Node, to: Node, a: { v: number; c: string; label: string }, b: { v: number; c: string; label: string }) => {
    if (!narrow) {
      const x1 = from.x + from.w + 6;
      const x2 = to.x - 6;
      return (
        <g>
          {[
            { ...a, y: from.y + from.h * 0.36 },
            { ...b, y: from.y + from.h * 0.7 },
          ].map((p) => (
            <g key={p.label}>
              <Arrow x1={x1} y1={p.y} x2={x2} y2={p.y} color={p.c} width={width(p.v)} head={10 + width(p.v)} />
              <Txt x={(x1 + x2) / 2} y={p.y - width(p.v) / 2 - 7} size={0.8} color={p.c} weight={650}>
                {p.label}
              </Txt>
            </g>
          ))}
        </g>
      );
    }
    const y1 = from.y + from.h + 6;
    const y2 = to.y - 6;
    return (
      <g>
        {/* Etiketten til den venstre pilen står til venstre for den, den høyre til høyre, så de ikke møter den andre pilen */}
        {[
          { ...a, x: from.x + from.w * 0.3, side: -1 },
          { ...b, x: from.x + from.w * 0.7, side: 1 },
        ].map((p) => (
          <g key={p.label}>
            <Arrow x1={p.x} y1={y1} x2={p.x} y2={y2} color={p.c} width={width(p.v)} head={10 + width(p.v)} />
            <Txt
              x={p.x + p.side * (width(p.v) / 2 + 8)}
              y={(y1 + y2) / 2 + 6}
              anchor={p.side < 0 ? 'end' : 'start'}
              size={0.8}
              color={p.c}
              weight={650}
            >
              {p.label}
            </Txt>
          </g>
        ))}
      </g>
    );
  };
  // Tilbakekoblingspilen fra eggstokken (eller p-pillen) tilbake til hypofysen
  const fbPath = !narrow
    ? `M${O.x},${ovary.y + ovary.h + 6} C${O.x},${ovary.y + ovary.h + 70} ${P.x},${pit.y + pit.h + 70} ${P.x},${pit.y + pit.h + 10}`
    : `M${ovary.x - 6},${O.y} C${ovary.x - 150},${O.y} ${pit.x - 150},${P.y} ${pit.x - 10},${P.y}`;
  const fbLabelX = !narrow ? (O.x + P.x) / 2 : 30;
  const fbLabelY = !narrow ? pit.y + pit.h + 66 : (O.y + P.y) / 2 - 30 * f;
  const ovaryScale = narrow ? 1.6 * k : 1.6;
  return (
    <Figure
      viewBox={`0 0 ${W} ${Math.round(H)}`}
      maxHeight={Math.round(H * 1.25)}
      label={`Hormonsignalene dag ${day}: hypofysen skiller ut FSH og LH til eggstokken, eggstokken skiller ut østrogen og progesteron til livmoren. Tilbakekoblingen er ${FEEDBACK_TEXT[fb].toLowerCase()}.`}
      caption="Pilenes tykkelse viser hvor mye av hormonet som skilles ut akkurat nå."
    >
      {!narrow && (
        <Txt x={W / 2} y={26} size={0.9} weight={650} muted>
          Dag {day}: hvem styrer hvem?
        </Txt>
      )}
      {box(pit, 'Hypofysen', 'styres av hypothalamus', <PituitaryIcon x={P.x} y={narrow ? P.y + 24 : P.y + 4} k={narrow ? 0.95 * k : 1} />)}
      {box(
        ovary,
        'Eggstokken',
        ov.stage === 'follikkel'
          ? 'follikkelen vokser'
          : ov.stage === 'eggløsning'
            ? 'eggløsning'
            : ov.stage === 'gulelegeme'
              ? 'gulelegemet'
              : ov.stage === 'tilbakedannes'
                ? 'gulelegemet går til grunne'
                : 'ingen follikkel modnes',
        <g transform={`translate(${O.x} ${O.y + 4}) scale(${ovaryScale}) translate(${-O.x} ${-O.y - 4})`}>
          <OvaryIcon x={O.x} y={O.y + 4} stage={ov.stage} size={Math.min(ov.size, 22) * 0.75} k={1} />
        </g>,
      )}
      {box(
        uterus,
        'Livmoren',
        bleeding(day, scenario) ? 'slimhinnen støtes ut' : `slimhinnen ${fmt(lining, 0)} mm`,
        <UterusMini n={uterus} lining={lining} bleed={bleeding(day, scenario)} f={f} preg={preg} />,
      )}
      {pair(pit, ovary, { v: h.fsh, c: COL.fsh, label: 'FSH' }, { v: h.lh, c: COL.lh, label: 'LH' })}
      {pair(ovary, uterus, { v: h.ostrogen, c: COL.ostrogen, label: 'østrogen' }, { v: h.progesteron, c: COL.progesteron, label: 'progesteron' })}
      {/* Tilbakekobling */}
      {!pill && (
        <g>
          <path d={fbPath} fill="none" stroke={fbColor} strokeWidth={3} strokeDasharray={fb === 'svekkes' ? '6 6' : undefined} />
          <FbHead path={fbPath} color={fbColor} narrow={narrow} pit={pit} />
          <circle cx={!narrow ? (O.x + P.x) / 2 : pit.x - 120} cy={!narrow ? pit.y + pit.h + 52 : (O.y + P.y) / 2} r={15 * Math.min(f, 1.4)} fill={VIZ.surface} stroke={fbColor} strokeWidth={2.4} />
          <Txt x={!narrow ? (O.x + P.x) / 2 : pit.x - 120} y={(!narrow ? pit.y + pit.h + 52 : (O.y + P.y) / 2) + 7 * Math.min(f, 1.4)} size={1.2} weight={800} color={fbColor} halo={false}>
            {sign}
          </Txt>
          {!narrow && (
            <Txt x={fbLabelX} y={fbLabelY + 30} size={0.8} color={fbColor} weight={650}>
              {FEEDBACK_TEXT[fb]} tilbakekobling: {fbLine}
            </Txt>
          )}
        </g>
      )}
      {pill && (
        <PillNode pit={pit} narrow={narrow} on={pillOn} f={f} />
      )}
      {/* hCG fra embryoet holder gulelegemet i live */}
      {preg && (
        <g>
          <path
            d={
              !narrow
                ? `M${U.x},${uterus.y - 6} C${U.x},${uterus.y - 46} ${O.x + 40},${ovary.y - 46} ${O.x + 40},${ovary.y - 10}`
                : `M${uterus.x + uterus.w + 6},${U.y} C${uterus.x + uterus.w + 110},${U.y} ${ovary.x + ovary.w + 110},${O.y} ${ovary.x + ovary.w + 10},${O.y}`
            }
            fill="none"
            stroke={COL.hcg}
            strokeWidth={(2 + 8 * h.hcg) * (narrow ? k : 1)}
          />
          {!narrow ? (
            <polygon points={`${O.x + 40},${ovary.y - 2} ${O.x + 31},${ovary.y - 16} ${O.x + 49},${ovary.y - 16}`} fill={COL.hcg} />
          ) : (
            <polygon points={`${ovary.x + ovary.w + 2},${O.y} ${ovary.x + ovary.w + 18},${O.y - 10} ${ovary.x + ovary.w + 18},${O.y + 10}`} fill={COL.hcg} />
          )}
          {/* Etiketten ved starten av pilen (fra livmoren), ved siden av buen og ikke oppå den */}
          <Txt
            x={!narrow ? U.x + 12 : uterus.x + uterus.w + 10}
            y={!narrow ? uterus.y - 16 : U.y + 12 + 22 * f}
            size={0.8}
            color={COL.hcg}
            weight={700}
            anchor="start"
          >
            hCG
          </Txt>
        </g>
      )}
      {narrow && (
        <Txt x={W / 2} y={30 * f} size={0.85} weight={650} muted>
          {pill ? (pillOn ? 'P-pillen hemmer hypofysen' : 'Pillefri uke: hemmingen svekkes') : `${sign === '+' ? 'Positiv' : sign === '±' ? 'Svekket' : 'Negativ'} tilbakekobling: ${fbHormone}`}
        </Txt>
      )}
    </Figure>
  );
}

/** Hypofysen: en liten kjertel som henger i en stilk under hypothalamus. */
function PituitaryIcon({ x, y, k }: { x: number; y: number; k: number }) {
  const s = 1.1 * k;
  const paint = { fill: mixColor(VIZ.surface, COL.fsh, 0.16), line: COL.fsh };
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <path d="M-26,-26 Q0,-36 26,-26" fill="none" stroke={VIZ.muted} strokeWidth={2} strokeLinecap="round" />
      <path d="M-3,-28 C-4,-16 -6,-12 -6,-6 M3,-28 C4,-16 6,-12 6,-6" fill="none" stroke={paint.line} strokeWidth={1.8} />
      <path d="M-20,2 C-22,-10 -8,-8 0,-6 C8,-8 22,-10 20,2 C18,16 -18,16 -20,2 Z" fill={paint.fill} stroke={paint.line} strokeWidth={1.8} />
      <line x1={0} y1={-4} x2={0} y2={12} stroke={paint.line} strokeWidth={1} opacity={0.6} />
    </g>
  );
}

/** Pilspiss i enden av tilbakekoblingspilen (mot hypofysen). */
function FbHead({ path, color, narrow, pit }: { path: string; color: string; narrow: boolean; pit: Node }) {
  const end = path.split(' ').slice(-1)[0]!.split(',').map(Number);
  const [x, y] = [end[0] ?? 0, end[1] ?? 0];
  void pit;
  const pts = narrow ? `${x + 4},${y} ${x - 12},${y - 8} ${x - 12},${y + 8}` : `${x},${y - 4} ${x - 8},${y + 12} ${x + 8},${y + 12}`;
  return <polygon points={pts} fill={color} />;
}

/** P-pillen som egen kilde til hormoner som hemmer hypofysen. */
function PillNode({ pit, narrow, on, f }: { pit: Node; narrow: boolean; on: boolean; f: number }) {
  const w = narrow ? 180 : 160;
  const h = 46 * Math.min(f, 1.5);
  const x = narrow ? 24 : pit.x + pit.w / 2 - w / 2;
  const y = narrow ? pit.y + pit.h / 2 - h / 2 : pit.y + pit.h + 50;
  const c = on ? PILL : mixColor(VIZ.surface, PILL, 0.5);
  return (
    <g>
      <path d={roundedRectPath(x, y, w, h, h / 2)} fill={mixColor(VIZ.surface, PILL, 0.16)} stroke={c} strokeWidth={2} strokeDasharray={on ? undefined : '6 5'} />
      <Txt x={x + w / 2} y={y + h / 2 + 6 * Math.min(f, 1.5)} size={0.85} weight={650}>
        {on ? 'P-pille' : 'Pillefri'}
      </Txt>
      {on &&
        (narrow ? (
          <Arrow x1={x + w + 4} y1={y + h / 2} x2={pit.x - 6} y2={y + h / 2} color={PILL} width={4} head={13} label="−" labelY={y + h / 2 - 12} labelX={(x + w + pit.x) / 2} />
        ) : (
          <Arrow x1={x + w / 2} y1={y - 4} x2={x + w / 2} y2={pit.y + pit.h + 6} color={PILL} width={4} head={13} label="−  hemmer FSH og LH" labelX={x + w / 2 + 14} labelY={y - 14} labelAnchor="start" />
        ))}
    </g>
  );
}

/** Liten livmor: slimhinnen som et bånd med tykkelse, blødning som dråper, og embryoet når det har festet seg. */
function UterusMini({ n, lining, bleed, f, preg }: { n: Node; lining: number; bleed: boolean; f: number; preg: boolean }) {
  const cx = n.x + n.w / 2;
  const top = n.y + 34 * f + 4;
  const bottom = n.y + n.h - 26 * Math.min(f, 1.4);
  const avail = bottom - top;
  const w = Math.min(n.w * 0.7, 150);
  const muscle = Math.min(14, avail * 0.2);
  const t = Math.max(3, (lining / 14) * (avail - muscle - 6));
  const y0 = top + (avail - muscle - t) / 2;
  return (
    <g>
      <rect x={cx - w / 2} y={y0 + t} width={w} height={muscle} rx={4} fill={mixColor(VIZ.surface, BLOOD, 0.4)} />
      <rect x={cx - w / 2} y={y0} width={w} height={t} rx={3} fill={mixColor(VIZ.surface, BLOOD, bleed ? 0.55 : 0.22)} stroke={BLOOD} strokeWidth={1.2} />
      {bleed &&
        [0.2, 0.45, 0.7].map((u) => (
          <path key={u} d={`M${cx - w / 2 + w * u},${y0 - 4} q4,-8 0,-12 q-4,4 0,12 z`} fill={BLOOD} />
        ))}
      {preg && <circle cx={cx + w * 0.2} cy={y0 + Math.min(t * 0.4, 8)} r={6} fill={BIO.kjerne.fill} stroke={COL.hcg} strokeWidth={2} />}
    </g>
  );
}

/* ====================================================================== */
/* Forklaring                                                              */
/* ====================================================================== */

function explanation(s: CycleScenario, day: number, h: Hormones): ReactNode {
  const phase = phaseAt(day, s);
  const schematic = (
    <p>
      Kurvene er skjematiske, som i læreboka. Hos mange varer syklusen mellom 21 og 35 dager, og det er tiden fra eggløsningen til neste
      menstruasjon (ca. 14 dager) som varierer minst.
    </p>
  );
  if (s === 'p-piller') {
    if (phase === 'pille')
      return (
        <>
          <p>
            <strong>Aktive piller (dag 1–{PILL_DAYS}).</strong> Kombinasjonspillen inneholder syntetisk østrogen og gestagen (et
            progesteronlignende hormon). De gir negativ tilbakekobling på hypofysen hele tiden, så FSH og LH holder seg lave: ingen follikkel
            modnes, det kommer ingen LH-topp, og derfor ingen eggløsning. I tillegg blir slimet i livmorhalsen tykt, og livmorslimhinnen
            holder seg tynn.
          </p>
          {schematic}
        </>
      );
    return (
      <>
        <p>
          <strong>Pillefri uke.</strong> Når hormonene fra pillen faller bort, støtes den tynne slimhinnen ut. Det er en bortfallsblødning,
          ikke en vanlig menstruasjon, fordi det ikke har vært noen eggløsning. FSH stiger litt i denne uka, og derfor er det viktig å ikke
          gjøre den pillefrie perioden lengre enn sju dager.
        </p>
        {schematic}
      </>
    );
  }
  if (s === 'graviditet' && day >= FERTILIZATION_DAY) {
    if (day < IMPLANTATION_DAY)
      return (
        <>
          <p>
            <strong>Befruktning.</strong> Egget ble befruktet i egglederen. Zygoten deler seg mens den føres mot livmoren, og etter ca. en
            uke fester embryoet seg i den tykke livmorslimhinnen (innfesting). Til da er hormonene som i en vanlig syklus: gulelegemet lager
            progesteron, som holder slimhinnen klar.
          </p>
          {schematic}
        </>
      );
    return (
      <>
        <p>
          <strong>Graviditet (dag {day}).</strong> Embryoet (og senere morkaken) lager hormonet hCG. hCG holder gulelegemet i live, så
          progesteron og østrogen forblir høye. Da støtes ikke slimhinnen ut, og menstruasjonen uteblir. Høyt progesteron gir negativ
          tilbakekobling, så FSH og LH holder seg lave, og ingen nye egg modnes. Det trengs bare litt hCG i starten. Nivået dobles omtrent
          annenhver dag og er høyest i uke 8–10 av svangerskapet, etter tiden i figuren. En graviditetstest påviser hCG i urinen.
        </p>
        {schematic}
      </>
    );
  }
  const t = day;
  let main: ReactNode;
  if (t < 6)
    main = (
      <p>
        <strong>Menstruasjon.</strong> Progesteronet falt da gulelegemet gikk til grunne, og uten progesteron støtes den ytterste delen av
        livmorslimhinnen ut sammen med litt blod. Samtidig stiger FSH litt, fordi den negative tilbakekoblingen fra progesteron og østrogen er
        borte, og nye follikler begynner å vokse.
      </p>
    );
  else if (t < 11.5)
    main = (
      <p>
        <strong>Follikkelfasen.</strong> FSH fra hypofysen får folliklene i eggstokken til å vokse, og én av dem blir størst. Follikkelen lager
        østrogen, som bygger opp livmorslimhinnen igjen. Østrogenet gir også negativ tilbakekobling: det hemmer FSH, så bare den største
        follikkelen fortsetter å vokse.
      </p>
    );
  else if (t < OVULATION_DAY)
    main = (
      <p>
        <strong>Positiv tilbakekobling.</strong> Østrogenet er nå høyt ({fmt((h.ostrogen / OSTROGEN_PEAK) * 100, 0)} % av toppen). Når mye østrogen har vært i
        blodet en stund, snur virkningen: hypofysen skiller ut mye LH i løpet av kort tid. Denne LH-toppen er signalet som utløser eggløsningen
        omtrent et døgn senere. Positiv tilbakekobling forsterker en endring, mens negativ tilbakekobling motvirker den.
      </p>
    );
  else if (t < OVULATION_DAY + 1)
    main = (
      <p>
        <strong>Eggløsning (dag {OVULATION_DAY}).</strong> LH-toppen får follikkelen til å sprekke, og egget slippes ut i egglederen, der det
        kan befruktes i ca. ett døgn. Det er LH, ikke østrogen, som utløser eggløsningen. Restene av follikkelen blir til gulelegemet.
      </p>
    );
  else if (t < 25)
    main = (
      <p>
        <strong>Gulelegemefasen.</strong> Gulelegemet lager progesteron (og østrogen). Progesteron gjør livmorslimhinnen tykk, med mange
        blodårer og kjertler, klar til å ta imot et befruktet egg. Progesteron og østrogen gir negativ tilbakekobling på hypofysen, så FSH og
        LH er lave og ingen nye follikler modnes nå. Velg «Graviditet» for å se hva som skjer hvis egget blir befruktet.
      </p>
    );
  else
    main = (
      <p>
        <strong>Slutten av syklusen.</strong> Egget ble ikke befruktet, og uten hCG går gulelegemet til grunne etter ca. 10–12 dager.
        Progesteron og østrogen faller. Da kan ikke slimhinnen holdes ved like, og den støtes ut: en ny menstruasjon begynner (dag 1).
        Hemmingen av hypofysen svekkes, og FSH begynner å stige igjen.
      </p>
    );
  return (
    <>
      {main}
      {schematic}
    </>
  );
}
