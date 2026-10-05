import { useEffect, useState, type ReactNode } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import {
  BIO,
  Controls,
  Etikett,
  Explain,
  Figure,
  Insekt,
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
  fmtPct,
  mixColor,
  useContainerTextScale,
  useSimClock,
} from '../kit';
import { PLOIDY, SEXUAL_STEPS, VEGETATIVE_STEPS, fuse, ploidyText, sharedWithMother, type SexualStep, type VegetativeStep } from './model';

type Mode = 'kjonnet' | 'ukjonnet';
type Step = SexualStep | VegetativeStep;

const MODES: { value: Mode; label: string }[] = [
  { value: 'kjonnet', label: 'Kjønnet formering' },
  { value: 'ukjonnet', label: 'Ukjønnet formering' },
];

/* Farger: hunnlige deler og eggcelle varme (som kromosomer fra mor), hannlige deler og sædceller kalde (fra far). */
const FEMALE = BIO.kromosom.mor[0];
const MALE = BIO.kromosom.far[0];
const POLAR = BIO.kromosom.mor[1];
const MIXED = BIO.kromosom.far[2];
const PETAL = { fill: mixColor(VIZ.surface, BIO.signal, 0.24), line: BIO.signal };
const GREEN = BIO.plante;
const POLLEN = BIO.sukker;
const OVULE = { fill: BIO.cytoplasma, line: BIO.plante.line };
const SOIL = mixColor(VIZ.surface, BIO.ved, 0.22);
const FRUIT = BIO.oksygenrikt;

export default function PlantersFormering() {
  const [mode, setMode] = useState<Mode>('kjonnet');
  const [stepS, setStepS] = useState(1);
  const [stepV, setStepV] = useState(1);
  const clock = useSimClock({ tMax: 1, speed: 0.22 });
  const { setT, pause } = clock;
  // Vis hvert trinn ferdig (trykk «Spill av» for å se det skje)
  useEffect(() => setT(1), [setT]);
  const steps = mode === 'kjonnet' ? SEXUAL_STEPS : VEGETATIVE_STEPS;
  const n = mode === 'kjonnet' ? stepS : stepV;
  const step = steps[n - 1]!.id;
  const p = Math.min(1, Math.max(0, clock.t));
  const go = (i: number) => {
    const v = Math.min(steps.length, Math.max(1, Math.round(i)));
    if (mode === 'kjonnet') setStepS(v);
    else setStepV(v);
    pause();
    setT(1);
  };
  const [ref, f] = useContainerTextScale<HTMLDivElement>();

  return (
    <VizLayout>
      <Toolbar>
        <Segmented
          label="Formering"
          options={MODES}
          value={mode}
          onChange={(m) => {
            setMode(m);
            pause();
            setT(1);
          }}
        />
      </Toolbar>
      <Controls>
        <Slider
          label="Trinn"
          value={n}
          onChange={go}
          min={1}
          max={steps.length}
          step={1}
          format={(v) => `${fmt(v, 0)} av ${steps.length}: ${steps[Math.round(v) - 1]?.title ?? ''}`}
        />
      </Controls>
      <Toolbar>
        <div className="viz-play">
          <button type="button" className="btn btn-sm" onClick={() => go(n - 1)} disabled={n <= 1}>
            <ChevronLeft size={16} aria-hidden />
            Forrige
          </button>
          <button type="button" className="btn btn-sm" onClick={() => go(n + 1)} disabled={n >= steps.length}>
            Neste
            <ChevronRight size={16} aria-hidden />
          </button>
        </div>
        <PlayBar clock={clock} time={timeText(step, p)} />
      </Toolbar>

      <div ref={ref}>
        <StepFigure step={step} p={p} f={f} />
      </div>
      {mode === 'kjonnet' ? (
        <Legend
          items={[
            { color: MALE, label: 'Hannlig: støvbærer, pollen og sædceller (n)' },
            { color: FEMALE, label: 'Hunnlig: pistill, frøemne og eggcelle (n)' },
            { color: MIXED, label: 'Etter befruktning: zygote og kim (2n)' },
          ]}
        />
      ) : (
        <Legend
          items={[
            { color: GREEN.line, label: 'Morplanta og klonene har de samme genene' },
            { color: BIO.ved, label: 'Jord' },
          ]}
        />
      )}

      <Readouts>{readouts(step, p)}</Readouts>
      <Explain>{explanation(step, p)}</Explain>
    </VizLayout>
  );
}

function timeText(step: Step, p: number): string {
  switch (step) {
    case 'blomsten':
      return p < 1 / 3 ? 'hannlige deler' : p < 2 / 3 ? 'hunnlige deler' : 'hele blomsten';
    case 'pollinering':
      return p < 1 ? 'insektet flyr til neste blomst' : 'pollen på arret';
    case 'pollenslange':
      return `ca. ${fmt(p * 24, 0)} timer etter pollineringen`;
    case 'befruktning':
      return p < 0.5 ? 'sædcellene når fram' : 'to befruktninger';
    case 'fro-og-frukt':
      return `uke ${fmt(p * 8, 0)}`;
    case 'utlopere':
      return `dag ${fmt(p * 30, 0)}`;
    case 'knoller':
      return p < 0.3 ? 'forsommer' : p < 0.6 ? 'høst' : 'neste vår';
  }
}

/* ====================================================================== */
/* Figuren                                                                 */
/* ====================================================================== */

/** Felles for trinnene: midtpunkt, skala for formene (større på mobil) og tekstskala. */
interface Frame {
  cx: number;
  cy: number;
  g: number;
  f: number;
  /** Lokale koordinater (rundt midtpunktet, før skalering) → figurens koordinater. */
  P: (x: number, y: number) => [number, number];
  /** Venstre og høyre kant for etiketter. */
  L: number;
  R: number;
}

function StepFigure({ step, p, f }: { step: Step; p: number; f: number }) {
  const narrow = f > 1.3;
  const g = narrow ? 1.2 : 1;
  const H = Math.round(440 * g + 140 * (f - 1));
  const cx = 400;
  const cy = H / 2 + 6;
  const fr: Frame = { cx, cy, g, f, P: (x, y) => [cx + x * g, cy + y * g], L: 24, R: 776 };
  const content: Record<Step, ReactNode> = {
    blomsten: <FlowerStep fr={fr} p={p} />,
    pollinering: <PollinationStep fr={fr} p={p} />,
    pollenslange: <PollenTubeStep fr={fr} p={p} />,
    befruktning: <FertilizationStep fr={fr} p={p} />,
    'fro-og-frukt': <SeedFruitStep fr={fr} p={p} />,
    utlopere: <RunnerStep fr={fr} p={p} />,
    knoller: <TuberStep fr={fr} p={p} />,
  };
  const labels: Record<Step, string> = {
    blomsten: 'Lengdesnitt av en blomst med støvbærere og pistill.',
    pollinering: 'Et insekt fører pollen fra støvknappene i én blomst til arret i en annen blomst.',
    pollenslange: 'Pollenkornet på arret vokser en pollenslange ned gjennom griffelen til frøemnet.',
    befruktning: 'Inne i frøemnet: den ene sædcellen befrukter eggcellen, den andre smelter sammen med polkjernene.',
    'fro-og-frukt': 'Frøemnet blir til et frø med kim og frøhvite, og fruktknuten blir til en frukt.',
    utlopere: 'Jordbærplante med utløpere som danner nye datterplanter.',
    knoller: 'Potetplante med nye knoller under jorda.',
  };
  return (
    <Figure viewBox={`0 0 800 ${H}`} maxHeight={Math.round(H * 1.25)} label={labels[step]} caption="Skjematisk tegning, ikke i målestokk.">
      {content[step]}
    </Figure>
  );
}

/** Punkt langs en polylinje ved andelen u (0–1) av lengden. */
function pointAt(pts: readonly [number, number][], u: number): [number, number] {
  const seg: number[] = [];
  let total = 0;
  for (let i = 1; i < pts.length; i++) {
    const d = Math.hypot(pts[i]![0] - pts[i - 1]![0], pts[i]![1] - pts[i - 1]![1]);
    seg.push(d);
    total += d;
  }
  let target = Math.min(1, Math.max(0, u)) * total;
  for (let i = 0; i < seg.length; i++) {
    const d = seg[i]!;
    if (target <= d || i === seg.length - 1) {
      const t = d > 0 ? Math.min(1, target / d) : 0;
      const a = pts[i]!;
      const b = pts[i + 1]!;
      return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
    }
    target -= d;
  }
  return pts[pts.length - 1]!;
}

/** Glatt kurve gjennom punktene (midtpunkter forbundet med kvadratiske kurver), som tette punkter. */
function smoothSample(pts: readonly [number, number][], per = 16): [number, number][] {
  const out: [number, number][] = [pts[0]!];
  const mid = (a: readonly [number, number], b: readonly [number, number]): [number, number] => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  let start = mid(pts[0]!, pts[1]!);
  out.push(start);
  for (let i = 1; i < pts.length - 1; i++) {
    const c = pts[i]!;
    const end = i === pts.length - 2 ? pts[i + 1]! : mid(c, pts[i + 1]!);
    for (let k = 1; k <= per; k++) {
      const t = k / per;
      out.push([
        (1 - t) * (1 - t) * start[0] + 2 * (1 - t) * t * c[0] + t * t * end[0],
        (1 - t) * (1 - t) * start[1] + 2 * (1 - t) * t * c[1] + t * t * end[1],
      ]);
    }
    start = end;
  }
  return out;
}

const polyPath = (pts: readonly [number, number][]) => pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
const ease = (u: number) => {
  const x = Math.min(1, Math.max(0, u));
  return x * x * (3 - 2 * x);
};
/** Andel av et delintervall [a, b] av framdriften p. */
const span = (p: number, a: number, b: number) => ease((p - a) / (b - a));

/* ---------- Blomsten (lengdesnitt) ---------- */

/** Blomst i lengdesnitt rundt (0, 0) i lokale koordinater (ca. ±170 bredt, −150 til +190 høyt). */
function FlowerShape({
  dimMale,
  dimFemale,
  petals = 1,
  pollenOnStigma = 0,
  ovary = 1,
  pistil = 1,
  showOvules = true,
}: {
  dimMale?: boolean;
  dimFemale?: boolean;
  /** 1 = friske kronblad, 0 = visnet og falt av. */
  petals?: number;
  pollenOnStigma?: number;
  /** Fruktknutens størrelse (1 = vanlig). */
  ovary?: number;
  /** Griffel og arr (1 = friske, 0 = visnet). */
  pistil?: number;
  showOvules?: boolean;
}) {
  const fem = dimFemale ? 0.3 : 1;
  const mal = dimMale ? 0.3 : 1;
  const petal = (s: number) =>
    `M${s * 26},104 C${s * 80},96 ${s * 150},40 ${s * 160},-60 C${s * 120},-40 ${s * 70},10 ${s * 30},90 Z`;
  const filament = (s: number, tx: number, ty: number) => `M${s * 16},104 C${s * 24},40 ${s * (tx - 6)},${ty + 40} ${s * tx},${ty + 12}`;
  const anthers: [number, number, number][] = [
    [-62, -82, -18],
    [-40, -40, -8],
    [62, -82, 18],
    [40, -40, 8],
  ];
  return (
    <g>
      {/* Stilk og blomsterbunn */}
      <path d="M0,190 L0,112" stroke={GREEN.line} strokeWidth={10} strokeLinecap="round" />
      {[-1, 1].map((s) => (
        <path
          key={`b${s}`}
          d={`M${s * 26},112 Q${s * 70},120 ${s * 98},94 Q${s * 62},100 ${s * 26},104 Z`}
          fill={GREEN.fill}
          stroke={GREEN.line}
          strokeWidth={1.8}
          strokeLinejoin="round"
        />
      ))}
      {petals > 0.02 &&
        [-1, 1].map((s) => (
          <g key={`k${s}`} opacity={petals} transform={petals < 1 ? `rotate(${s * (1 - petals) * 40} ${s * 26} 104)` : undefined}>
            <path d={petal(s)} fill={PETAL.fill} stroke={PETAL.line} strokeWidth={2} strokeLinejoin="round" />
          </g>
        ))}
      <ellipse cx={0} cy={112} rx={36} ry={12} fill={GREEN.fill} stroke={GREEN.line} strokeWidth={1.8} />
      {/* Støvbærere: støvtråd og støvknapp med pollen */}
      <g opacity={mal * Math.max(0, petals)}>
        {anthers.map(([x, y, r]) => (
          <g key={`s${x}`}>
            <path d={filament(Math.sign(x), Math.abs(x), y)} fill="none" stroke={MALE} strokeWidth={2.2} opacity={0.8} />
            <ellipse cx={x} cy={y} rx={9} ry={15} transform={`rotate(${r} ${x} ${y})`} fill={mixColor(VIZ.surface, POLLEN, 0.55)} stroke={MALE} strokeWidth={1.8} />
            {[-6, 0, 6].map((d) => (
              <circle key={d} cx={x + d * 0.3} cy={y + d} r={2.2} fill={POLLEN} />
            ))}
          </g>
        ))}
      </g>
      {/* Pistill: fruktknute, griffel og arr */}
      <g opacity={fem * pistil}>
        <rect x={-5} y={-120} width={10} height={160} rx={5} fill={mixColor(VIZ.surface, GREEN.line, 0.25)} stroke={FEMALE} strokeWidth={1.8} />
        <path
          d="M-22,-120 Q-26,-140 -10,-138 Q0,-150 10,-138 Q26,-140 22,-120 Q0,-114 -22,-120 Z"
          fill={mixColor(VIZ.surface, GREEN.line, 0.35)}
          stroke={FEMALE}
          strokeWidth={1.8}
          strokeLinejoin="round"
        />
        {Array.from({ length: Math.round(pollenOnStigma) }, (_, i) => (
          <circle key={i} cx={-12 + i * 10} cy={-142 - (i % 2) * 4} r={4} fill={POLLEN} stroke={MALE} strokeWidth={1.2} />
        ))}
      </g>
      <g opacity={fem}>
        <ellipse cx={0} cy={72} rx={32 * ovary} ry={36 * ovary} fill={GREEN.fill} stroke={FEMALE} strokeWidth={2} />
        {showOvules &&
          [
            [-13, 58],
            [13, 74],
            [-11, 92],
          ].map(([x, y], i) => (
            <g key={i}>
              <ellipse cx={x! * ovary} cy={72 + (y! - 72) * ovary} rx={7} ry={9} fill={OVULE.fill} stroke={FEMALE} strokeWidth={1.4} />
              <circle cx={x! * ovary} cy={72 + (y! - 72) * ovary - 3} r={2.4} fill={FEMALE} />
            </g>
          ))}
      </g>
    </g>
  );
}

function FlowerStep({ fr, p }: { fr: Frame; p: number }) {
  const { cx, cy, g, P, L, R, f } = fr;
  const phase = p < 1 / 3 ? 'male' : p < 2 / 3 ? 'female' : 'all';
  const lx = cx - (f > 1.3 ? 192 : 210) * g;
  const rx = cx + (f > 1.3 ? 192 : 210) * g;
  const lab = (x: number, y: number, ly: number, side: 'l' | 'r', text: string, color: string, dim: boolean) => {
    const [px, py] = P(x, y);
    return (
      <g opacity={dim ? 0.35 : 1}>
        <Etikett x={px} y={py} lx={side === 'l' ? Math.max(L + 4, lx) : Math.min(R - 4, rx)} ly={cy + ly * g} anchor={side === 'l' ? 'end' : 'start'} color={color} strong>
          {text}
        </Etikett>
      </g>
    );
  };
  const narrow = f > 1.3;
  return (
    <g>
      <g transform={`translate(${cx} ${cy}) scale(${g})`}>
        <FlowerShape dimMale={phase === 'female'} dimFemale={phase === 'male'} />
      </g>
      {lab(-62, -88, -150, 'l', narrow ? 'Støvknapp' : 'Støvknapp (pollen)', MALE, phase === 'female')}
      {lab(-46, -6, -60, 'l', 'Støvtråd', MALE, phase === 'female')}
      {lab(-128, -18, 20, 'l', 'Kronblad', PETAL.line, phase !== 'all')}
      {lab(-74, 108, 110, 'l', 'Begerblad', GREEN.line, phase !== 'all')}
      {lab(16, -132, -150, 'r', 'Arr', FEMALE, phase === 'male')}
      {lab(5, -60, -70, 'r', 'Griffel', FEMALE, phase === 'male')}
      {lab(30, 60, 20, 'r', 'Fruktknute', FEMALE, phase === 'male')}
      {lab(13, 74, 85, 'r', narrow ? 'Frøemne' : 'Frøemne med eggcelle', FEMALE, phase === 'male')}
      <Txt x={L + 4} y={22 * f} anchor="start" size={0.85} weight={650} color={MALE} >
        {phase === 'female' ? '' : 'Støvbærer = støvtråd + støvknapp'}
      </Txt>
      <Txt x={R - 4} y={22 * f} anchor="end" size={0.85} weight={650} color={FEMALE}>
        {phase === 'male' ? '' : narrow ? 'Pistill' : 'Pistill = arr + griffel + fruktknute'}
      </Txt>
    </g>
  );
}

/* ---------- Pollinering ---------- */

function PollinationStep({ fr, p }: { fr: Frame; p: number }) {
  const { cx, cy, g, P, f } = fr;
  const narrow = f > 1.3;
  // Blomst A (avgir pollen) til venstre, blomst B (mottar) til høyre
  const A = { x: -230, y: 60, s: 0.62 };
  const B = { x: 170, y: 10, s: 0.9 };
  const from: [number, number] = [A.x + -62 * A.s, A.y + -82 * A.s];
  const to: [number, number] = [B.x + 0, B.y + -150 * B.s];
  const route: [number, number][] = [from, [from[0] + 40, from[1] - 120], [(from[0] + to[0]) / 2, -200], [to[0] - 60, to[1] - 80], to];
  const curve = smoothSample(route);
  const u = ease(p);
  const [bx, by] = pointAt(curve, u);
  const [ax, ay] = pointAt(curve, Math.min(1, u + 0.02));
  const angle = (Math.atan2(ay - by, ax - bx) * 180) / Math.PI + 90;
  const arrived = p >= 0.98;
  const [ix, iy] = P(bx, by - 18);
  const [sx0, sy0] = P(...to);
  return (
    <g>
      <g transform={`translate(${cx} ${cy}) scale(${g})`}>
        <g transform={`translate(${A.x} ${A.y}) scale(${A.s})`}>
          <FlowerShape />
        </g>
        <g transform={`translate(${B.x} ${B.y}) scale(${B.s})`}>
          <FlowerShape pollenOnStigma={arrived ? 3 : 0} />
        </g>
        <path d={polyPath(curve)} fill="none" stroke={VIZ.muted} strokeWidth={2} strokeDasharray="4 7" />
      </g>
      {!arrived && (
        <g>
          <Insekt x={ix} y={iy} size={46 * g} rotate={angle} paint={{ fill: mixColor(VIZ.surface, POLLEN, 0.5), line: VIZ.ink }} />
          {[-10, 0, 10].map((d) => (
            <circle key={d} cx={ix + d * g} cy={iy + 14 * g} r={4 * g} fill={POLLEN} stroke={MALE} strokeWidth={1.2} />
          ))}
        </g>
      )}
      {(() => {
        const [px, py] = P(from[0], from[1]);
        return (
          <Etikett x={px} y={py} lx={px - 34 * g} ly={py - 56 * g} anchor="middle" color={MALE} strong>
            Pollen
          </Etikett>
        );
      })()}
      <Etikett x={sx0} y={sy0} lx={sx0 + 64 * g} ly={sy0 - 58 * g} anchor="middle" color={FEMALE} strong>
        {arrived ? 'Pollen på arret' : 'Arret'}
      </Etikett>
      <Txt x={P(A.x, 0)[0]} y={P(0, 205)[1]} size={0.8} muted>
        {narrow ? 'Blomst 1' : 'Blomst 1 gir pollen'}
      </Txt>
      <Txt x={P(B.x, 0)[0]} y={P(0, 205)[1]} size={0.8} muted>
        {narrow ? 'Blomst 2' : 'Blomst 2 får pollen (krysspollinering)'}
      </Txt>
    </g>
  );
}

/* ---------- Pollenslangen ---------- */

function PollenTubeStep({ fr, p }: { fr: Frame; p: number }) {
  const { cx, cy, g, P, f } = fr;
  const narrow = f > 1.3;
  const tube: [number, number][] = [
    [8, -186],
    [4, -168],
    [0, -150],
    [0, 40],
    [0, 66],
  ];
  const u = ease(p);
  const tip = pointAt(tube, u);
  const s1 = pointAt(tube, Math.max(0, u - 0.06));
  const s2 = pointAt(tube, Math.max(0, u - 0.1));
  const nuc = pointAt(tube, Math.max(0, u - 0.02));
  const reached = u > 0.99;
  return (
    <g>
      <g transform={`translate(${cx} ${cy}) scale(${g})`}>
        {/* Fruktknute med ett stort frøemne */}
        <ellipse cx={0} cy={124} rx={120} ry={74} fill={GREEN.fill} stroke={FEMALE} strokeWidth={2.2} />
        <path d="M-50,124 C-50,70 50,70 50,124 C50,190 -50,190 -50,124 Z" fill={OVULE.fill} stroke={FEMALE} strokeWidth={2} />
        <path d="M-8,76 L0,90 L8,76" fill={GREEN.fill} stroke={FEMALE} strokeWidth={1.6} />
        <ellipse cx={0} cy={132} rx={28} ry={40} fill={mixColor(VIZ.surface, FEMALE, 0.08)} stroke={FEMALE} strokeWidth={1.2} strokeDasharray="4 3" />
        <circle cx={0} cy={106} r={10} fill={mixColor(VIZ.surface, FEMALE, 0.3)} stroke={FEMALE} strokeWidth={1.6} />
        <circle cx={0} cy={106} r={4} fill={FEMALE} />
        {/* Griffel og arr */}
        <path d="M-16,52 L-12,-150 L12,-150 L16,52 Z" fill={mixColor(VIZ.surface, GREEN.line, 0.18)} stroke={FEMALE} strokeWidth={1.8} />
        <path
          d="M-46,-150 Q-52,-176 -22,-174 Q0,-192 22,-174 Q52,-176 46,-150 Q0,-140 -46,-150 Z"
          fill={mixColor(VIZ.surface, GREEN.line, 0.35)}
          stroke={FEMALE}
          strokeWidth={1.8}
          strokeLinejoin="round"
        />
        {/* Pollenkorn på arret */}
        {[
          [-26, -184],
          [8, -192],
          [32, -182],
        ].map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r={8} fill={POLLEN} stroke={MALE} strokeWidth={1.6} />
        ))}
        {/* Pollenslangen vokser */}
        <path d={polyPath(tube)} fill="none" stroke={mixColor(VIZ.surface, MALE, 0.5)} strokeWidth={7} strokeLinecap="round" pathLength={1} strokeDasharray={`${u} 1`} />
        {u > 0.04 && (
          <g>
            <circle cx={nuc[0]} cy={nuc[1]} r={3.2} fill={VIZ.muted} />
            <ellipse cx={s1[0]} cy={s1[1]} rx={3.2} ry={5} fill={MALE} />
            <ellipse cx={s2[0]} cy={s2[1]} rx={3.2} ry={5} fill={MALE} />
          </g>
        )}
        {!reached && u > 0.02 && <circle cx={tip[0]} cy={tip[1]} r={4.5} fill="none" stroke={MALE} strokeWidth={1.5} />}
      </g>
      <Etikett x={P(8, -192)[0]} y={P(8, -192)[1]} lx={cx - 140 * g} ly={P(0, -205)[1]} anchor="end" color={MALE} strong>
        Pollenkorn ({ploidyText(PLOIDY.pollenkorn)})
      </Etikett>
      {u > 0.1 && (
        <Etikett x={P(0, -100)[0]} y={P(0, -100)[1]} lx={cx - 140 * g} ly={P(0, -110)[1]} anchor="end" color={MALE} strong>
          Pollenslange
        </Etikett>
      )}
      {u > 0.04 && (
        <Etikett x={P(s1[0], s1[1])[0]} y={P(s1[0], s1[1])[1]} lx={cx - 140 * g} ly={P(0, Math.min(40, s1[1] + 40))[1]} anchor="end" color={MALE} strong>
          {narrow ? 'Sædceller (n)' : `To sædceller (${ploidyText(PLOIDY.saedcelle)})`}
        </Etikett>
      )}
      <Etikett x={P(14, -40)[0]} y={P(14, -40)[1]} lx={cx + 140 * g} ly={P(0, -70)[1]} anchor="start" color={FEMALE} strong>
        Griffel
      </Etikett>
      <Etikett x={P(40, 150)[0]} y={P(40, 150)[1]} lx={cx + 140 * g} ly={P(0, 40)[1]} anchor="start" color={FEMALE} strong>
        Frøemne
      </Etikett>
      <Etikett x={P(4, 106)[0]} y={P(4, 106)[1]} lx={cx + 140 * g} ly={P(0, 110)[1]} anchor="start" color={FEMALE} strong>
        Eggcelle ({ploidyText(PLOIDY.eggcelle)})
      </Etikett>
      <Etikett x={P(-100, 150)[0]} y={P(-100, 150)[1]} lx={cx - 140 * g} ly={P(0, 185)[1]} anchor="end" color={FEMALE} strong>
        Fruktknute
      </Etikett>
    </g>
  );
}

/* ---------- Dobbel befruktning ---------- */

function FertilizationStep({ fr, p }: { fr: Frame; p: number }) {
  const { cx, cy, g, P, f } = fr;
  const narrow = f > 1.3;
  const travel = span(p, 0, 0.5);
  const fused = p >= 0.5;
  const tubeIn = span(p, 0, 0.15);
  const egg: [number, number] = [0, -70];
  const polar: [number, number] = [0, 22];
  const entry: [number, number] = [0, -128];
  const sperm1 = fused ? egg : (lerp2(entry, [egg[0] - 6, egg[1] - 4], travel) as [number, number]);
  const sperm2 = fused ? polar : (lerp2(entry, [polar[0] + 12, polar[1] - 16], travel) as [number, number]);
  const zyg = mixColor(FEMALE, MALE, 0.5);
  const endo = mixColor(POLAR, MALE, 0.34);
  return (
    <g>
      <g transform={`translate(${cx} ${cy}) scale(${g})`}>
        {/* Integumentene (blir frøskall) med åpning (mikropyle) øverst */}
        <path d="M-12,-166 C-120,-160 -152,-60 -150,20 C-148,120 -90,180 0,182 C90,180 148,120 150,20 C152,-60 120,-160 12,-166" fill={mixColor(VIZ.surface, GREEN.line, 0.16)} stroke={GREEN.line} strokeWidth={2.4} />
        <path d="M-12,-150 C-100,-142 -126,-60 -124,20 C-122,104 -76,156 0,158 C76,156 122,104 124,20 C126,-60 100,-142 12,-150" fill={OVULE.fill} stroke={GREEN.line} strokeWidth={1.6} />
        {/* Kimsekken */}
        <ellipse cx={0} cy={12} rx={92} ry={124} fill={mixColor(VIZ.surface, FEMALE, 0.06)} stroke={FEMALE} strokeWidth={1.8} />
        {/* Hjelpeceller og celler i motsatt ende */}
        {[-34, 34].map((x) => (
          <circle key={x} cx={x} cy={-96} r={16} fill={mixColor(VIZ.surface, FEMALE, 0.12)} stroke={FEMALE} strokeWidth={1.2} opacity={0.8} />
        ))}
        {[-26, 0, 26].map((x, i) => (
          <circle key={x} cx={x} cy={i === 1 ? 118 : 108} r={13} fill={mixColor(VIZ.surface, FEMALE, 0.12)} stroke={FEMALE} strokeWidth={1.2} opacity={0.8} />
        ))}
        {/* Eggcelle → zygote */}
        <circle cx={egg[0]} cy={egg[1]} r={28} fill={mixColor(VIZ.surface, fused ? zyg : FEMALE, 0.25)} stroke={fused ? zyg : FEMALE} strokeWidth={2.2} />
        <circle cx={egg[0]} cy={egg[1] + 4} r={10} fill={fused ? zyg : FEMALE} />
        {/* Polkjernene → frøhvite (3n) */}
        {fused ? (
          <circle cx={polar[0]} cy={polar[1]} r={14} fill={endo} stroke={VIZ.surface} strokeWidth={1.5} />
        ) : (
          [-13, 13].map((x) => <circle key={x} cx={x} cy={polar[1]} r={10} fill={POLAR} stroke={VIZ.surface} strokeWidth={1.5} />)
        )}
        {/* Pollenslangen kommer inn gjennom mikropylen */}
        <path d="M0,-205 L0,-128" stroke={mixColor(VIZ.surface, MALE, 0.5)} strokeWidth={9} strokeLinecap="round" pathLength={1} strokeDasharray={`${tubeIn} 1`} />
        {!fused && p > 0.02 && (
          <g>
            <ellipse cx={sperm1[0]} cy={sperm1[1]} rx={4.5} ry={7} fill={MALE} />
            <ellipse cx={sperm2[0]} cy={sperm2[1]} rx={4.5} ry={7} fill={MALE} />
          </g>
        )}
        {fused && <circle cx={polar[0]} cy={polar[1]} r={22} fill="none" stroke={endo} strokeWidth={2} strokeDasharray="3 4" />}
      </g>
      <Etikett x={P(0, -185)[0]} y={P(0, -185)[1]} lx={cx - 165 * g} ly={P(0, -190)[1]} anchor="end" color={MALE} strong>
        Pollenslange
      </Etikett>
      {!fused && p > 0.02 && (
        <Etikett x={P(...sperm2)[0]} y={P(...sperm2)[1]} lx={cx - 165 * g} ly={P(0, -40)[1]} anchor="end" color={MALE} strong>
          {narrow ? 'Sædcelle (n)' : `Sædceller (${ploidyText(PLOIDY.saedcelle)})`}
        </Etikett>
      )}
      <Etikett x={P(12, -160)[0]} y={P(12, -160)[1]} lx={cx + 165 * g} ly={P(0, -180)[1]} anchor="start" color={GREEN.line} strong>
        Mikropyle
      </Etikett>
      <Etikett x={P(24, -70)[0]} y={P(24, -70)[1]} lx={cx + 165 * g} ly={P(0, -110)[1]} anchor="start" color={fused ? zyg : FEMALE} strong>
        {fused ? `Zygote (${ploidyText(fuse('eggcelle', 'saedcelle'))})` : `Eggcelle (${ploidyText(PLOIDY.eggcelle)})`}
      </Etikett>
      <Etikett x={P(14, 22)[0]} y={P(14, 22)[1]} lx={cx + 165 * g} ly={P(0, 50)[1]} anchor="start" color={fused ? endo : POLAR} strong>
        {fused ? `Frøhvite (${ploidyText(fuse('polkjerne', 'polkjerne', 'saedcelle'))})` : narrow ? 'Polkjerner' : 'To polkjerner (n + n)'}
      </Etikett>
      <Etikett x={P(-140, 60)[0]} y={P(-140, 60)[1]} lx={cx - 165 * g} ly={P(0, 150)[1]} anchor="end" color={GREEN.line} strong>
        Integumenter
      </Etikett>
      <Etikett x={P(-80, 60)[0]} y={P(-80, 60)[1]} lx={cx - 165 * g} ly={P(0, 90)[1]} anchor="end" color={FEMALE} strong>
        Kimsekk
      </Etikett>
    </g>
  );
}

const lerp2 = (a: readonly [number, number], b: readonly [number, number], t: number) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];

/* ---------- Frø og frukt ---------- */

function SeedFruitStep({ fr, p }: { fr: Frame; p: number }) {
  const { cx, cy, g, P, f } = fr;
  const narrow = f > 1.3;
  const grow = ease(p);
  // Frøet (venstre): frøemnet vokser og blir frø med kim og frøhvite
  const seedR = 40 + 60 * grow;
  const S: [number, number] = [-180, 20];
  // Frukten (høyre): fruktknuten vokser, kronbladene visner
  const F: [number, number] = [170, 50];
  const fruitR = 34 + 86 * grow;
  const fruitColor = mixColor(GREEN.fill, mixColor(VIZ.surface, FRUIT, 0.35), grow);
  const fruitLine = mixColor(GREEN.line, FRUIT, grow);
  const petals = 1 - span(p, 0, 0.35);
  return (
    <g>
      <g transform={`translate(${cx} ${cy}) scale(${g})`}>
        {/* Frø i snitt */}
        <ellipse cx={S[0]} cy={S[1]} rx={seedR * 1.15} ry={seedR * 0.9} fill={mixColor(VIZ.surface, BIO.ved, 0.35)} stroke={BIO.ved} strokeWidth={2.4} />
        <ellipse cx={S[0]} cy={S[1]} rx={seedR * 1.15 - 9} ry={seedR * 0.9 - 9} fill={mixColor(VIZ.surface, POLLEN, 0.22)} stroke={mixColor(BIO.ved, POLLEN, 0.5)} strokeWidth={1.2} />
        {/* Kimen: kimrot og to kimblad */}
        <g transform={`translate(${S[0] + seedR * 0.28} ${S[1]}) scale(${0.25 + 0.75 * grow})`}>
          <path d="M-10,40 C-18,10 -16,-20 0,-36 C18,-22 22,6 10,40 Z" fill={mixColor(VIZ.surface, GREEN.line, 0.4)} stroke={MIXED} strokeWidth={2} />
          <path d="M0,40 C2,52 -4,62 -10,66" fill="none" stroke={MIXED} strokeWidth={5} strokeLinecap="round" />
          <path d="M-2,-28 C-30,-46 -50,-30 -44,-8 C-30,-12 -14,-18 -2,-28 Z" fill={mixColor(VIZ.surface, GREEN.line, 0.55)} stroke={MIXED} strokeWidth={1.6} />
        </g>
        {/* Blomsten som blir frukt */}
        <g transform={`translate(${F[0]} ${F[1] - 70})`}>
          <FlowerShape petals={petals} pistil={1 - span(p, 0.2, 0.6)} showOvules={false} />
        </g>
        <path d={`M${F[0]},${F[1] + 120} L${F[0]},${F[1] + fruitR * 0.9 - 4}`} stroke={GREEN.line} strokeWidth={8} strokeLinecap="round" />
        <ellipse cx={F[0]} cy={F[1] + 2} rx={fruitR} ry={fruitR * 0.92} fill={fruitColor} stroke={fruitLine} strokeWidth={2.4} />
        {grow > 0.25 &&
          [
            [-0.38, -0.2],
            [0.36, -0.25],
            [-0.3, 0.32],
            [0.32, 0.3],
          ].map(([u, v], i) => (
            <ellipse
              key={i}
              cx={F[0] + u! * fruitR}
              cy={F[1] + 2 + v! * fruitR}
              rx={7 + 5 * grow}
              ry={10 + 6 * grow}
              transform={`rotate(${u! * v! * 200} ${F[0] + u! * fruitR} ${F[1] + 2 + v! * fruitR})`}
              fill={mixColor(VIZ.surface, BIO.ved, 0.35)}
              stroke={BIO.ved}
              strokeWidth={1.6}
              opacity={span(p, 0.25, 0.5)}
            />
          ))}
      </g>
      <Txt x={P(S[0], 0)[0]} y={22 * f} size={0.9} weight={700}>
        {narrow ? 'Frøemne → frø' : 'Frøemnet blir et frø'}
      </Txt>
      <Txt x={P(F[0], 0)[0]} y={22 * f} size={0.9} weight={700}>
        {narrow ? 'Fruktknute → frukt' : 'Fruktknuten blir en frukt'}
      </Txt>
      <Etikett x={P(S[0], S[1] + seedR * 0.9 - 3)[0]} y={P(S[0], S[1] + seedR * 0.9 - 3)[1]} lx={P(S[0], 0)[0]} ly={P(0, S[1] + seedR * 0.9 + 46)[1]} anchor="middle" color={BIO.ved} strong>
        Frøskall
      </Etikett>
      <Etikett x={P(S[0] - seedR * 0.5, S[1] - seedR * 0.3)[0]} y={P(S[0] - seedR * 0.5, S[1] - seedR * 0.3)[1]} lx={P(S[0] - 40, 0)[0]} ly={P(0, S[1] - seedR * 0.9 - 30)[1]} anchor="middle" color={mixColor(BIO.ved, POLLEN, 0.5)} strong>
        Frøhvite ({ploidyText(PLOIDY.frohvite)})
      </Etikett>
      {grow > 0.2 && (
        <Etikett x={P(S[0] + seedR * 0.28, S[1])[0]} y={P(S[0] + seedR * 0.28, S[1])[1]} lx={P(S[0] + seedR * 1.15 + 14, 0)[0]} ly={P(0, S[1] - seedR * 0.9 - 6)[1]} anchor="start" color={MIXED} strong>
          Kim ({ploidyText(PLOIDY.kim)})
        </Etikett>
      )}
      {grow > 0.35 && (
        <Etikett x={P(F[0] + 0.36 * fruitR, F[1] + 2 - 0.25 * fruitR)[0]} y={P(F[0] + 0.36 * fruitR, F[1] + 2 - 0.25 * fruitR)[1]} lx={P(F[0] + 50, 0)[0]} ly={P(0, F[1] - fruitR - 24)[1]} anchor="middle" color={BIO.ved} strong>
          Frø
        </Etikett>
      )}
      <Etikett x={P(F[0], F[1] + fruitR * 0.92 - 4)[0]} y={P(F[0], F[1] + fruitR * 0.92 - 4)[1]} lx={P(F[0], 0)[0]} ly={P(0, Math.max(F[1] + fruitR + 34, 150))[1]} anchor="middle" color={fruitLine} strong>
        {grow > 0.5 ? (narrow ? 'Frukt' : 'Frukt (fruktveggen)') : 'Fruktknute'}
      </Etikett>
    </g>
  );
}

/* ---------- Ukjønnet: utløpere (jordbær) ---------- */

/** Jordbærplante: tre trekoplete blader på stilker, sentrert i (0, 0) ved jordoverflaten. `s` er størrelsen (0–1). */
function Strawberry({ s, roots, berry }: { s: number; roots: number; berry?: boolean }) {
  if (s <= 0.01) return null;
  const leaf = (angle: number, len: number) => {
    const a = (angle * Math.PI) / 180;
    const tx = Math.sin(a) * len;
    const ty = -Math.cos(a) * len;
    return (
      <g key={angle}>
        <path d={`M0,0 Q${tx * 0.3},${ty * 0.6} ${tx},${ty}`} fill="none" stroke={GREEN.line} strokeWidth={3} />
        {[-38, 0, 38].map((d) => {
          const b = a + (d * Math.PI) / 180;
          const lx = tx + Math.sin(b) * 22;
          const ly = ty - Math.cos(b) * 22;
          return (
            <ellipse key={d} cx={(tx + lx) / 2 + Math.sin(b) * 4} cy={(ty + ly) / 2 - Math.cos(b) * 4} rx={9} ry={16} transform={`rotate(${angle + d} ${(tx + lx) / 2 + Math.sin(b) * 4} ${(ty + ly) / 2 - Math.cos(b) * 4})`} fill={GREEN.fill} stroke={GREEN.line} strokeWidth={1.6} />
          );
        })}
      </g>
    );
  };
  return (
    <g transform={`scale(${s})`}>
      {roots > 0 &&
        [-24, -10, 6, 20].map((x, i) => (
          <path key={x} d={`M0,4 Q${x * 0.6},${20 + i * 3} ${x},${(40 + i * 6) * roots}`} fill="none" stroke={BIO.ved} strokeWidth={2} opacity={0.85} />
        ))}
      {[-42, 0, 42].map((a) => leaf(a, 46))}
      {berry && (
        <g>
          <path d="M8,-6 Q30,-10 38,8" fill="none" stroke={GREEN.line} strokeWidth={2} />
          <path d="M30,8 C42,6 50,16 44,28 C40,36 32,38 28,30 C24,22 22,12 30,8 Z" fill={mixColor(VIZ.surface, FRUIT, 0.5)} stroke={FRUIT} strokeWidth={1.6} />
        </g>
      )}
    </g>
  );
}

function RunnerStep({ fr, p }: { fr: Frame; p: number }) {
  const { cx, cy, g, P, f } = fr;
  const narrow = f > 1.3;
  const ground = 60;
  const runner: [number, number][] = [
    [-250, ground - 4],
    [-180, ground - 34],
    [-90, ground - 26],
    [-20, ground - 2],
    [60, ground - 30],
    [150, ground - 26],
    [220, ground - 2],
    [300, ground - 22],
    [340, ground - 18],
  ];
  const u = ease(p);
  const d1 = span(p, 0.32, 0.6);
  const d2 = span(p, 0.68, 0.95);
  return (
    <g>
      <g transform={`translate(${cx} ${cy}) scale(${g})`}>
        <rect x={-400 / g} y={ground} width={800 / g} height={200} fill={SOIL} />
        <line x1={-400 / g} x2={400 / g} y1={ground} y2={ground} stroke={BIO.ved} strokeWidth={2} />
        <path d={polyPath(smoothSample(runner, 10))} fill="none" stroke={GREEN.line} strokeWidth={3.5} strokeLinecap="round" pathLength={1} strokeDasharray={`${u} 1`} />
        <g transform={`translate(-250 ${ground})`}>
          <Strawberry s={1.15} roots={1} berry />
        </g>
        <g transform={`translate(-20 ${ground})`}>
          <Strawberry s={0.75 * d1} roots={span(p, 0.4, 0.7)} />
        </g>
        <g transform={`translate(220 ${ground})`}>
          <Strawberry s={0.6 * d2} roots={span(p, 0.78, 1)} />
        </g>
      </g>
      <Etikett x={P(-262, ground - 50)[0]} y={P(-262, ground - 50)[1]} lx={P(-262, 0)[0]} ly={P(0, -90)[1]} anchor="middle" color={GREEN.line} strong>
        Morplante
      </Etikett>
      {u > 0.15 && (
        <Etikett x={P(-120, ground - 30)[0]} y={P(-120, ground - 30)[1]} lx={P(-100, 0)[0]} ly={P(0, 150)[1]} anchor="middle" color={GREEN.line} strong>
          {narrow ? 'Utløper' : 'Utløper (stengel langs bakken)'}
        </Etikett>
      )}
      {d1 > 0.3 && (
        <Etikett x={P(-20, ground - 30)[0]} y={P(-20, ground - 30)[1]} lx={P(-20, 0)[0]} ly={P(0, -120)[1]} anchor="middle" color={GREEN.line} strong>
          {narrow ? 'Klon' : 'Datterplante (klon)'}
        </Etikett>
      )}
      {d1 > 0.6 && (
        <Etikett x={P(-6, ground + 30)[0]} y={P(-6, ground + 30)[1]} lx={P(80, 0)[0]} ly={P(0, 175)[1]} anchor="start" color={BIO.ved} strong>
          Egne røtter
        </Etikett>
      )}
      {d2 > 0.3 && (
        <Etikett x={P(220, ground - 26)[0]} y={P(220, ground - 26)[1]} lx={P(240, 0)[0]} ly={P(0, -90)[1]} anchor="middle" color={GREEN.line} strong>
          {narrow ? 'Ny klon' : 'Enda en klon'}
        </Etikett>
      )}
    </g>
  );
}

/* ---------- Ukjønnet: knoller (potet) ---------- */

/** Potetknoll med «øyne» (knopper). `sprout` (0–1) lar ett øye spire opp mot jordoverflaten `ground`. */
function Tuber({ x, y, r, sprout = 0, ground = 0 }: { x: number; y: number; r: number; sprout?: number; ground?: number }) {
  if (r <= 0.5) return null;
  const eye: [number, number] = [x + 0.3 * r, y - 0.6 * r];
  const top = ground - 46;
  const len = (eye[1] - top) * sprout;
  const tipY = eye[1] - len;
  const above = tipY < ground - 6;
  return (
    <g>
      {sprout > 0 && (
        <g>
          <path d={`M${eye[0]},${eye[1]} C${eye[0] + 10},${eye[1] - len * 0.4} ${eye[0] - 8},${eye[1] - len * 0.7} ${eye[0] + 4},${tipY}`} fill="none" stroke={GREEN.line} strokeWidth={3} strokeLinecap="round" />
          {above &&
            [-1, 1].map((sgn) => (
              <ellipse
                key={sgn}
                cx={eye[0] + 4 + sgn * 13}
                cy={tipY + 6}
                rx={13 * Math.min(1, (ground - tipY) / 40)}
                ry={6}
                transform={`rotate(${sgn * -25} ${eye[0] + 4 + sgn * 13} ${tipY + 6})`}
                fill={GREEN.fill}
                stroke={GREEN.line}
                strokeWidth={1.4}
              />
            ))}
        </g>
      )}
      <ellipse cx={x} cy={y} rx={r * 1.35} ry={r} fill={mixColor(VIZ.surface, POLLEN, 0.35)} stroke={BIO.ved} strokeWidth={2} />
      {[
        [0.3, -0.6],
        [-0.6, -0.4],
        [0.8, 0.1],
        [-0.2, 0.45],
      ].map(([u, v], i) => (
        <circle key={i} cx={x + u! * r} cy={y + v! * r} r={Math.max(1.6, r * 0.08)} fill={BIO.ved} />
      ))}
    </g>
  );
}

function TuberStep({ fr, p }: { fr: Frame; p: number }) {
  const { cx, cy, g, P, f } = fr;
  const narrow = f > 1.3;
  const ground = -40;
  // Sommer: planta vokser og lager knoller. Høst: planta visner. Neste vår: knollene spirer.
  const grow = span(p, 0, 0.45);
  const plant = 1 - span(p, 0.5, 0.62);
  const old = 1 - span(p, 0.1, 0.5);
  const spring = span(p, 0.62, 1);
  const tubers: [number, number, number][] = [
    [-230, 40, 30],
    [-120, 100, 26],
    [40, 80, 30],
    [-20, 150, 22],
    [160, 30, 24],
  ];
  const stem: [number, number] = [-80, ground];
  const tR = (r: number) => r * Math.max(0, Math.min(1, grow * 1.25 - 0.1));
  const show = tubers[2]!;
  const eye: [number, number] = [show[0] + 0.3 * tR(show[2]), show[1] - 0.6 * tR(show[2])];
  return (
    <g>
      <g transform={`translate(${cx} ${cy}) scale(${g})`}>
        <rect x={-400 / g} y={ground} width={800 / g} height={320} fill={SOIL} />
        <line x1={-400 / g} x2={400 / g} y1={ground} y2={ground} stroke={BIO.ved} strokeWidth={2} />
        {/* Settepoteten (morknollen) blir brukt opp */}
        {old > 0.05 && (
          <g opacity={old}>
            <Tuber x={stem[0]} y={ground + 46} r={14 + 10 * old} />
          </g>
        )}
        {/* Potetplanta over jorda, med jordutløpere */}
        {plant > 0.02 && (
          <g opacity={plant}>
            {tubers.map(([x, y], i) => (
              <path
                key={i}
                d={`M${stem[0]},${ground + 30} Q${(stem[0] + x) / 2},${ground + 40 + i * 12} ${x},${y}`}
                fill="none"
                stroke={mixColor(BIO.ved, VIZ.surface, 0.2)}
                strokeWidth={2.5}
                pathLength={1}
                strokeDasharray={`${Math.min(1, grow * 2)} 1`}
              />
            ))}
            <path d={`M${stem[0]},${ground + 30} L${stem[0]},${ground - 150}`} stroke={GREEN.line} strokeWidth={6} strokeLinecap="round" />
            {[
              [-60, -40],
              [55, -70],
              [-50, -110],
              [45, -130],
              [0, -165],
            ].map(([dx, dy], i) => (
              <ellipse
                key={i}
                cx={stem[0] + dx! * 0.7}
                cy={ground + dy!}
                rx={26}
                ry={12}
                transform={`rotate(${dx! > 0 ? -20 : 20} ${stem[0] + dx! * 0.7} ${ground + dy!})`}
                fill={GREEN.fill}
                stroke={GREEN.line}
                strokeWidth={1.6}
              />
            ))}
          </g>
        )}
        {/* De nye knollene blir liggende, og neste vår spirer de */}
        {tubers.map(([x, y, r], i) => (
          <Tuber key={i} x={x} y={y} r={tR(r)} sprout={spring} ground={ground} />
        ))}
      </g>
      {p < 0.5 && (
        <Etikett x={P(stem[0] - 30, ground - 110)[0]} y={P(stem[0] - 30, ground - 110)[1]} lx={P(stem[0] - 150, 0)[0]} ly={P(0, ground - 170)[1]} anchor="middle" color={GREEN.line} strong>
          Potetplante
        </Etikett>
      )}
      {old > 0.3 && (
        <Etikett x={P(stem[0] + 18, ground + 46)[0]} y={P(stem[0] + 18, ground + 46)[1]} lx={P(stem[0] + 60, 0)[0]} ly={P(0, ground - 30)[1]} anchor="start" color={BIO.ved} strong>
          {narrow ? 'Settepotet' : 'Settepotet (brukes opp)'}
        </Etikett>
      )}
      {grow > 0.4 && (
        <Etikett x={P(-230, 40 + 30)[0]} y={P(-230, 40 + 30)[1]} lx={P(-230, 0)[0]} ly={P(0, 185)[1]} anchor="middle" color={BIO.ved} strong>
          {narrow ? 'Nye knoller' : 'Nye knoller (fortykket stengel)'}
        </Etikett>
      )}
      {grow > 0.4 && (
        <Etikett x={P(...eye)[0]} y={P(...eye)[1]} lx={P(150, 0)[0]} ly={P(0, 175)[1]} anchor="start" color={BIO.ved} strong>
          {narrow ? 'Øye (knopp)' : 'Øye (knopp som kan spire)'}
        </Etikett>
      )}
      {spring > 0.5 && (
        <Etikett x={P(show[0] + 0.3 * show[2] + 4, ground - 30)[0]} y={P(show[0] + 0.3 * show[2] + 4, ground - 30)[1]} lx={P(130, 0)[0]} ly={P(0, ground - 140)[1]} anchor="middle" color={GREEN.line} strong>
          {narrow ? 'Nye planter (kloner)' : 'Neste vår: hver knoll blir en ny plante (klon)'}
        </Etikett>
      )}
    </g>
  );
}

/* ====================================================================== */
/* Avlesninger og forklaring                                               */
/* ====================================================================== */

function readouts(step: Step, p: number): ReactNode {
  switch (step) {
    case 'blomsten':
      return (
        <>
          <Readout label="Hannlig del" value="Støvbærer" tone={MALE} />
          <Readout label="Hunnlig del" value="Pistill" tone={FEMALE} />
          <Readout label="Morplanta" value={ploidyText(PLOIDY.morplante)} unit="(diploid)" />
        </>
      );
    case 'pollinering':
      return (
        <>
          <Readout label="Pollenkorn" value={ploidyText(PLOIDY.pollenkorn)} unit="(haploid)" tone={MALE} />
          <Readout label="Pollenet føres av" value="Insekter" unit="eller vind" />
          <Readout label="Befruktet ennå?" value="Nei" />
        </>
      );
    case 'pollenslange':
      return (
        <>
          <Readout label="Sædceller i slangen" value="2" unit={`(${ploidyText(PLOIDY.saedcelle)})`} tone={MALE} />
          <Readout label="Eggcelle" value={ploidyText(PLOIDY.eggcelle)} unit="(haploid)" tone={FEMALE} />
          <Readout label="Pollenslangen" value={fmtPct(ease(p))} unit="av veien" />
        </>
      );
    case 'befruktning':
      return (
        <>
          <Readout label="Eggcelle + sædcelle" value={p >= 0.5 ? ploidyText(fuse('eggcelle', 'saedcelle')) : 'n + n'} unit={p >= 0.5 ? 'zygote' : undefined} tone={p >= 0.5 ? MIXED : FEMALE} />
          <Readout
            label="Polkjerner + sædcelle"
            value={p >= 0.5 ? ploidyText(fuse('polkjerne', 'polkjerne', 'saedcelle')) : 'n + n + n'}
            unit={p >= 0.5 ? 'frøhvite' : undefined}
            tone={POLAR}
          />
          <Readout label="Befruktninger" value={p >= 0.5 ? '2' : '0'} />
        </>
      );
    case 'fro-og-frukt':
      return (
        <>
          <Readout label="Kim" value={ploidyText(PLOIDY.kim)} unit="fra zygoten" tone={MIXED} />
          <Readout label="Frøhvite" value={ploidyText(PLOIDY.frohvite)} unit="næring til kimen" />
          <Readout label="Gener felles med morplanta" value={fmtPct(sharedWithMother('fro'))} />
        </>
      );
    case 'utlopere':
    case 'knoller':
      return (
        <>
          <Readout label="Antall foreldre" value="1" />
          <Readout label="Gener felles med morplanta" value={fmtPct(sharedWithMother('klon'))} tone={GREEN.line} />
          <Readout label="Kromosomtall" value={ploidyText(PLOIDY.klon)} unit="som morplanta" />
        </>
      );
  }
}

function explanation(step: Step, p: number): ReactNode {
  switch (step) {
    case 'blomsten':
      return (
        <p>
          <strong>Blomsten er planteorganet for kjønnet formering.</strong> Støvbærerne er de hannlige delene: i støvknappene lages pollenkorn
          ved meiose. Pistillen er den hunnlige delen: arret fanger pollen, griffelen fører ned til fruktknuten, og inne i fruktknuten ligger
          frøemnene med hver sin eggcelle. Kronbladene lokker til seg insekter med farge, duft og nektar.
          {p < 2 / 3 ? ' Trykk «Spill av» for å se de hannlige og de hunnlige delene hver for seg.' : ''}
        </p>
      );
    case 'pollinering':
      return (
        <p>
          <strong>Pollinering</strong> er at pollen kommer fra en støvknapp til et arr. Her bærer en humle pollen fra én blomst til en annen
          (krysspollinering), så avkommet får gener fra to planter. Gress og mange trær blir pollinert av vinden og lager enorme mengder lett
          pollen. Pollinering er ikke det samme som befruktning: kjønnscellene har ennå ikke møttes.
        </p>
      );
    case 'pollenslange':
      return (
        <p>
          <strong>Pollenslangen.</strong> Pollenkornet spirer på arret og vokser en pollenslange ned gjennom griffelen til frøemnet. Gjennom
          slangen føres to sædceller (n). Hos mange arter tar dette fra noen timer til et døgn. Blomsterplantene trenger derfor ikke vann for
          at sædcellene skal komme fram, slik moser og bregner gjør.
        </p>
      );
    case 'befruktning':
      return (
        <p>
          <strong>Dobbel befruktning.</strong> Pollenslangen går inn gjennom mikropylen og slipper ut de to sædcellene. Den ene smelter
          sammen med eggcellen: n + n = 2n, en zygote som blir kimen (den nye planta). Den andre smelter sammen med de to polkjernene: n + n + n
          = 3n, som blir frøhviten, næringsvevet kimen bruker når frøet spirer. Dobbel befruktning finnes bare hos blomsterplantene.
        </p>
      );
    case 'fro-og-frukt':
      return (
        <p>
          <strong>Frø og frukt.</strong> Etter befruktningen blir frøemnet til et frø: zygoten deler seg ved mitose og blir kimen med
          kimrot og kimblad, frøhviten fyller frøet med næring, og integumentene blir frøskallet. Fruktknuten vokser og blir frukten rundt
          frøene, mens kronbladene og støvbærerne visner. Frukten hjelper frøene å spre seg, f.eks. når dyr spiser bær og legger igjen
          frøene et annet sted. Frøet har halvparten av genene fra hver forelder.
        </p>
      );
    case 'utlopere':
      return (
        <p>
          <strong>Utløpere</strong> er stengler som vokser bortover bakken. Der de berører jorda, slår de røtter og lager en ny plante.
          Datterplantene lages ved mitose, så de er kloner med nøyaktig de samme genene som morplanta. Jordbær formerer seg både slik og med
          frø (bærene). Ukjønnet formering er rask og trenger ingen pollinering, men alle klonene er like utsatt for de samme sykdommene og
          endringene i miljøet.
        </p>
      );
    case 'knoller':
      return (
        <p>
          <strong>Knoller.</strong> Potetknollen er ikke en rot, men en fortykket stengel under jorda som lagrer stivelse. «Øynene» er knopper
          som kan spire til nye planter neste vår, og derfor setter bonden poteter, ikke potetfrø. Alle plantene i åkeren blir kloner av
          samme sort. Det er praktisk, men gjør åkeren sårbar: på 1840-tallet ødela tørråte (<em>Phytophthora infestans</em>) nesten alle
          potetene i Irland, fordi plantene var genetisk like.
        </p>
      );
  }
}
