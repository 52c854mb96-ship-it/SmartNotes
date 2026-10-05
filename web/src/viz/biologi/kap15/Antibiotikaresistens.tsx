import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  BIO,
  Bakterie,
  Controls,
  Explain,
  Figure,
  Legend,
  PlayBar,
  Plot,
  Readout,
  Readouts,
  Segmented,
  Slider,
  TSup,
  Toolbar,
  Txt,
  VIZ,
  VizLayout,
  fmt,
  linePath,
  mixColor,
  roundedRectPath,
  superscript,
  useContainerTextScale,
  useSimClock,
  useTextScale,
} from '../kit';
import {
  COURSE_DAYS,
  COURSE_PERIOD,
  RES_F0,
  RES_K,
  onAntibiotic,
  resistanceAt,
  sampleCounts,
  samplePositions,
  simulateResistance,
  type CourseKind,
  type ResistanceRun,
} from './model';

const KINDS: { value: CourseKind; label: string }[] = [
  { value: 'hele', label: 'Hele kuren' },
  { value: 'avbrutt', label: 'Avbrutt kur' },
  { value: 'unodvendig', label: 'Unødvendig bruk' },
];

const SENS = BIO.bakterie;
const RES = { fill: mixColor(VIZ.surface, BIO.antigen, 0.28), line: BIO.antigen };
const AB = BIO.atp;
const SLOTS = 120;

/** Andel som prosent med nok desimaler til å se små andeler: 0,001 %, 0,35 %, 4 %, 99,7 %. */
function shareText(share: number): string {
  if (!Number.isFinite(share)) return 'ingen bakterier';
  // Hardt mellomrom før «%», så tallet og prosenttegnet ikke deles på to linjer
  const pct = share * 100;
  if (pct === 0) return '0\u00a0%';
  if (pct < 0.01) return `${fmt(pct, 3)}\u00a0%`;
  if (pct < 1) return `${fmt(pct, 2)}\u00a0%`;
  if (pct >= 99.95 && pct < 100) return '>\u00a099,9\u00a0%';
  if (pct > 99 && pct < 100) return `${fmt(pct, 1)}\u00a0%`;
  return `${fmt(pct, 0)}\u00a0%`;
}

function countText(n: number): string {
  if (n < 1) return '0';
  return n < 1e4 ? fmt(Math.round(n), 0) : sciText(n);
}

/** Standardform med én desimal der avrundingen flyttes over i eksponenten: 9,99 · 10⁹ → «1,0 · 10¹⁰». */
function sciText(n: number): string {
  if (!(n > 0) || !Number.isFinite(n)) return '0';
  let exp = Math.floor(Math.log10(n));
  let m = Math.round((n / 10 ** exp) * 10) / 10;
  if (m >= 10) {
    m /= 10;
    exp += 1;
  }
  return `${fmt(m, 1)} · 10${superscript(exp)}`;
}

export default function Antibiotikaresistens() {
  const [kind, setKind] = useState<CourseKind>('avbrutt');
  const [courses, setCourses] = useState(3);
  const run = useMemo(() => simulateResistance(kind, courses), [kind, courses]);
  const tMax = courses * COURSE_PERIOD;
  const clock = useSimClock({ tMax, speed: tMax / 14 });
  const { setT, pause } = clock;
  // Åpner ved starten av andre kur
  useEffect(() => setT(COURSE_PERIOD + 1), [setT]);
  const t = Math.min(clock.t, tMax);
  const now = resistanceAt(run, t);
  const course = Math.min(courses, Math.floor(t / COURSE_PERIOD) + 1);
  const dosing = onAntibiotic(kind, t, courses);
  const dayInCourse = t - (course - 1) * COURSE_PERIOD;
  const [sceneRef, f] = useContainerTextScale<HTMLDivElement>();
  const [plotRef, fp] = useContainerTextScale<HTMLDivElement>();
  const plotH = Math.round(340 + 260 * (fp - 1));

  return (
    <VizLayout>
      <Toolbar>
        <Segmented label="Hvordan antibiotikaen brukes" options={KINDS} value={kind} onChange={setKind} />
      </Toolbar>
      <Controls>
        <Slider label="Antall kurer" value={courses} onChange={setCourses} min={1} max={4} step={1} />
        <Slider
          label="Tid"
          value={Math.round(t * 2) / 2}
          onChange={(v) => {
            pause();
            setT(v);
          }}
          min={0}
          max={tMax}
          step={0.5}
          format={(v) => `dag ${fmt(v, 0)}`}
        />
      </Controls>
      <Toolbar>
        <PlayBar clock={clock} time={`dag ${fmt(t, 0)} · kur ${course} av ${courses}`} />
      </Toolbar>

      <div ref={sceneRef}>
        <SampleFigure S={now.S} R={now.R} f={f} dosing={dosing} kind={kind} dayInCourse={dayInCourse} />
      </div>
      <Legend
        items={[
          { color: SENS.line, label: 'Følsomme bakterier' },
          { color: RES.line, label: 'Resistente bakterier' },
          { color: AB, label: 'Antibiotika' },
        ]}
      />

      <div ref={plotRef}>
        <Figure
          viewBox={`0 0 800 ${plotH}`}
          label={`Antall følsomme og resistente bakterier over ${tMax} døgn med ${courses} kurer. Dag ${fmt(t, 0)}: ${shareText(now.share)} resistente.`}
          caption="Logaritmisk skala: hver hjelpelinje oppover er hundre ganger flere bakterier."
        >
          <CountsPlot run={run} t={t} height={plotH} />
        </Figure>
      </div>
      <Legend
        items={[
          { color: SENS.line, label: 'Følsomme' },
          { color: RES.line, label: 'Resistente' },
          { color: mixColor(VIZ.surface, AB, 0.6), label: 'Dager med antibiotika' },
          { color: BIO.baereevne, label: 'Største mulige antall', dashed: true },
        ]}
      />

      <Readouts>
        <Readout label="Kur" value={`${course} av ${courses}`} unit={dosing ? `dag ${Math.floor(dayInCourse) + 1} med antibiotika` : 'ingen antibiotika nå'} />
        <Readout label={kind === 'unodvendig' ? 'Bakterier i tarmfloraen' : 'Bakterier i infeksjonen'} value={countText(now.S + now.R)} />
        <Readout label="Andel resistente" value={shareText(now.share)} tone={now.share > 0.1 ? RES.line : undefined} />
        <Readout
          label="Ved start av hver kur"
          value={run.shareAtStart.map((v) => shareText(v)).join(' → ')}
          tone={RES.line}
        />
      </Readouts>

      <Explain>{explanation(run, course, now.share, now.S + now.R)}</Explain>
    </VizLayout>
  );
}

/* ---------- Et utvalg av bakteriene ---------- */

function SampleFigure({
  S,
  R,
  f,
  dosing,
  kind,
  dayInCourse,
}: {
  S: number;
  R: number;
  f: number;
  dosing: boolean;
  kind: CourseKind;
  dayInCourse: number;
}) {
  const narrow = f > 1.3;
  const k = Math.max(1, 0.85 * f);
  const head = 30 * f;
  const box = { x: 20, y: head + 12, w: 760, h: Math.round(200 + 170 * (k - 1)) };
  const H = Math.round(box.y + box.h + 14);
  const pos = useMemo(() => samplePositions(SLOTS), []);
  const { shown, resistant } = sampleCounts(S, R, SLOTS);
  const size = 26 * k;
  const pad = size * 0.7;
  const N = S + R;
  const where = kind === 'unodvendig' ? 'tarmfloraen' : 'infeksjonen';
  return (
    <Figure
      viewBox={`0 0 800 ${H}`}
      maxHeight={Math.round(H * 1.25)}
      label={`Et utvalg av bakteriene i ${where}: ${shown} bakterier, ${resistant} av dem resistente.`}
      caption="Hvert symbol står for svært mange bakterier, og antall symboler følger en logaritmisk skala. Resistente vises alltid med minst ett symbol."
    >
      <Txt x={20} y={head - 4} anchor="start" size={0.9} weight={700}>
        {narrow ? (kind === 'unodvendig' ? 'Tarmfloraen' : 'Infeksjonen') : kind === 'unodvendig' ? 'Bakteriene i tarmfloraen (normalfloraen)' : 'Bakteriene i infeksjonen'}
      </Txt>
      <Txt x={780} y={head - 4} anchor="end" size={0.85} weight={650} color={dosing ? AB : VIZ.muted}>
        {dosing ? (narrow ? 'Antibiotika' : `Antibiotika, dag ${Math.floor(dayInCourse) + 1} av ${COURSE_DAYS[kind]}`) : 'Ingen antibiotika'}
      </Txt>
      <path
        d={roundedRectPath(box.x, box.y, box.w, box.h, 18)}
        fill={dosing ? mixColor(VIZ.surface, AB, 0.1) : mixColor(VIZ.surface, BIO.cytoplasma, 0.6)}
        stroke={dosing ? AB : VIZ.grid}
        strokeWidth={dosing ? 2.2 : 1.5}
        strokeDasharray={dosing ? '8 6' : undefined}
      />
      {pos.slice(0, shown).map((p, i) => {
        const res = i < resistant;
        return (
          <Bakterie
            key={i}
            x={box.x + pad + p.x * (box.w - 2 * pad)}
            y={box.y + pad + p.y * (box.h - 2 * pad)}
            size={size}
            rotate={p.a}
            paint={res ? RES : SENS}
          />
        );
      })}
      {N < 1 && (
        <Txt x={400} y={box.y + box.h / 2 + 6} size={1} muted>
          Ingen bakterier igjen: infeksjonen er borte
        </Txt>
      )}
    </Figure>
  );
}

/* ---------- Antall over tid (log-skala) ---------- */

function CountsPlot({ run, t, height }: { run: ResistanceRun; t: number; height: number }) {
  const f = useTextScale();
  const tMax = run.courses * COURSE_PERIOD;
  const lg = (n: number) => (n >= 1 ? Math.log10(n) : Number.NaN);
  const step = 10;
  const pts = (arr: number[]) => run.t.filter((_, i) => i % step === 0).map((d, i): [number, number] => [d, lg(arr[i * step]!)]);
  const xt = Array.from({ length: run.courses * 2 + 1 }, (_, i) => i * 7);
  return (
    <Plot x={{ min: 0, max: tMax, label: 'Tid (døgn)', ticks: xt }} y={{ min: 0, max: 11, label: 'Antall bakterier (log-skala)', ticks: [] }} width={800} height={height}>
      {({ sx, sy, x0, x1, y0, y1 }) => (
        <g>
          {run.doses.map(([a, b], i) => (
            <rect key={i} x={sx(a)} y={y1} width={sx(b) - sx(a)} height={y0 - y1} fill={mixColor(VIZ.surface, AB, 0.16)} />
          ))}
          {[0, 2, 4, 6, 8, 10].map((e) => (
            <g key={e}>
              <line x1={x0} x2={x1} y1={sy(e)} y2={sy(e)} className="viz-gridline" />
              <text x={x0 - 10} y={sy(e) + 5 * f} textAnchor="end" className="viz-tick">
                {e === 0 ? '1' : e === 2 ? '100' : <>10<TSup>{String(e)}</TSup></>}
              </text>
            </g>
          ))}
          {run.shareAtStart.map((share, i) => (
            // Øverst, over linja for største mulige antall: der går ingen kurver
            <Txt key={i} x={sx(i * COURSE_PERIOD) + 6} y={y1 + 16 * f} anchor="start" size={0.72} weight={650} color={AB}>
              {f > 1.3 ? `kur ${i + 1}` : `kur ${i + 1}: ${shareText(share)} res.`}
            </Txt>
          ))}
          <line x1={x0} x2={x1} y1={sy(Math.log10(RES_K))} y2={sy(Math.log10(RES_K))} stroke={BIO.baereevne} strokeWidth={1.6} strokeDasharray="6 5" />
          <path d={linePath(pts(run.S), sx, sy)} fill="none" stroke={SENS.line} strokeWidth={3} />
          <path d={linePath(pts(run.R), sx, sy)} fill="none" stroke={RES.line} strokeWidth={3} />
          <line x1={sx(t)} x2={sx(t)} y1={y0} y2={y1} className="viz-guide" />
          {(() => {
            const s = resistanceAt(run, t);
            return (
              <g>
                {s.S >= 1 && <circle cx={sx(t)} cy={sy(lg(s.S))} r={6} fill={SENS.line} stroke={VIZ.surface} strokeWidth={2.2} />}
                {s.R >= 1 && <circle cx={sx(t)} cy={sy(lg(s.R))} r={6} fill={RES.line} stroke={VIZ.surface} strokeWidth={2.2} />}
              </g>
            );
          })()}
        </g>
      )}
    </Plot>
  );
}

/* ---------- Forklaring ---------- */

function explanation(run: ResistanceRun, course: number, share: number, N: number): ReactNode {
  const misconception = (
    <p>
      <strong>Det er bakteriene som blir resistente, ikke du.</strong> Kroppen din blir ikke «immun mot antibiotika». Resistens oppstår ved
      mutasjoner eller ved at bakterier får resistensgener fra andre bakterier (f.eks. på plasmider). Antibiotikaen lager ikke resistensen,
      men den <em>velger ut</em> de resistente: de følsomme dør, og de resistente overlever og formerer seg (naturlig utvalg). Resistente
      bakterier kan smitte videre til andre mennesker.
    </p>
  );
  const model = (
    <p>
      Modellen er forenklet: én infeksjon med ca. en milliard bakterier, der 1 av {fmt(1 / RES_F0, 0)} er resistent ved
      start. De resistente tåler mye mer antibiotika og vokser litt saktere uten. Immunforsvaret klarer å fjerne små bakteriebestander, men
      ikke store.
    </p>
  );
  if (run.kind === 'hele')
    return (
      <>
        <p>
          <strong>Hele kuren.</strong> Antibiotikaen dreper de følsomme bakteriene raskt, og de få resistente drepes langsommere. Når
          bakteriebestanden er blitt liten, klarer immunforsvaret resten, også de resistente. Infeksjonen er borte, og det blir ingen
          resistente bakterier igjen som kan formere seg.{' '}
          {course < run.courses
            ? `Neste infeksjon (kur ${course + 1}) starter like følsom som den første.`
            : 'En ny infeksjon vil starte like følsom som den første.'}
        </p>
        <p>
          Men all bruk av antibiotika gir seleksjon, også i normalfloraen. Derfor skal antibiotika bare brukes når det trengs, med riktig
          dose og så lenge legen sier.
        </p>
        {misconception}
        {model}
      </>
    );
  if (run.kind === 'avbrutt') {
    const next = run.shareAtStart[Math.min(run.shareAtStart.length - 1, course)];
    return (
      <>
        <p>
          <strong>Avbrutt kur.</strong> Etter {COURSE_DAYS.avbrutt} dager føles det bedre fordi de fleste følsomme bakteriene er drept, og
          kuren stoppes. Men det er fortsatt mange bakterier igjen, og nå er en mye større andel av dem resistente. Immunforsvaret klarer
          ikke så mange, og infeksjonen blusser opp igjen.{' '}
          {course < run.courses
            ? `Ved neste kur er ${shareText(next ?? share)} av bakteriene resistente.`
            : share > 0.5
              ? `Nå er ${shareText(share)} av bakteriene resistente, og antibiotikaen virker nesten ikke lenger.`
              : `Nå er ${shareText(share)} av bakteriene resistente. Velg flere kurer for å se hva som skjer neste gang infeksjonen behandles.`}
        </p>
        {misconception}
        {model}
      </>
    );
  }
  return (
    <>
      <p>
        <strong>Unødvendig bruk.</strong> Personen har en virusinfeksjon, f.eks. forkjølelse, og antibiotika virker ikke på virus (se kapittel
        14). Antibiotikaen treffer i stedet de nyttige bakteriene i tarmfloraen (normalfloraen). De følsomme dør, og de resistente får plass til å formere
        seg. {N > 1e9 ? `Etter ${course} ${course === 1 ? 'kur' : 'kurer'} er ${shareText(share)} av bakteriene i tarmfloraen resistente.` : 'Tarmfloraen er kraftig redusert mens kuren pågår, og det kan gi diaré.'}{' '}
        Ingen nytte, bare ulemper: resistensgenene kan senere overføres til sykdomsbakterier.
      </p>
      {misconception}
      <p>
        Modellen er forenklet: den følger 10<sup>10</sup> av bakteriene i tarmen (i virkeligheten er det mange flere), og 1 av{' '}
        {fmt(1 / RES_F0, 0)} er resistent ved start. Vi antar at antibiotikaen virker svakere på tarmfloraen enn på en infeksjon, og
        immunforsvaret angriper ikke normalfloraen.
      </p>
    </>
  );
}
