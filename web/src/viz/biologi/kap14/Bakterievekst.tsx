import { useEffect, useState, type ReactNode } from 'react';
import {
  BIO,
  Bakterie,
  Controls,
  Explain,
  Figure,
  Formula,
  FormulaLine,
  Forvalg,
  GROWTH_PHASE_NAMES,
  Legend,
  PlayBar,
  Plot,
  Readout,
  Readouts,
  Slider,
  Sub,
  Sup,
  TSup,
  Toggle,
  Toolbar,
  Txt,
  VIZ,
  VizLayout,
  fmt,
  fmtCount,
  fmtSci,
  linePath,
  mixColor,
  sample,
  superscript,
  useBioScale,
  useContainerTextScale,
  useSimClock,
  useTextScale,
} from '../kit';
import {
  DANGER,
  GROWTH_HOURS,
  N_MAX,
  T_MAX,
  T_MIN,
  countAt,
  generationTimeAt,
  generationsAfter,
  grows,
  phaseAt,
  phaseEndsAt,
  timeToCount,
  type Phase,
} from './model';

const PRESETS = [
  { value: 'kjoleskap', label: 'Kjøleskap', T: 4 },
  { value: 'varmt-kjoleskap', label: 'For varmt kjøleskap', T: 8 },
  { value: 'rom', label: 'Romtemperatur', T: 20 },
  { value: 'kropp', label: 'Kroppstemperatur', T: 37 },
] as const;
type Preset = (typeof PRESETS)[number]['value'];

const CURVE = BIO.bakterie.line;
const DANGER_COLOR = BIO.antigen;
const PHASE_COLOR: Record<Exclude<Phase, 'ingen'>, string> = {
  lag: mixColor(VIZ.surface, VIZ.muted, 0.14),
  log: mixColor(VIZ.surface, BIO.plante.line, 0.14),
  stasjonaer: mixColor(VIZ.surface, BIO.sukker, 0.18),
  dod: mixColor(VIZ.surface, BIO.dod, 0.3),
};

/** Varighet i timer som tekst: «20 min», «1 t 20 min», «2 døgn 3 t». */
function durationText(h: number): string {
  if (!Number.isFinite(h)) return 'aldri';
  const min = Math.round(h * 60);
  if (min < 60) return `${min} min`;
  if (h < 24) {
    const hh = Math.floor(min / 60);
    const mm = min % 60;
    return mm ? `${hh} t ${mm} min` : `${hh} t`;
  }
  const d = Math.floor(h / 24);
  const rest = Math.round(h - d * 24);
  return rest ? `${d} døgn ${rest} t` : `${d} døgn`;
}

/** Antall per gram som tekst: vanlige tall under en million, ellers standardform. */
function countText(n: number): string {
  return n < 1e6 ? fmtCount(n) : sciText(n);
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

export default function Bakterievekst() {
  const [T, setT] = useState(20);
  const [logN0, setLogN0] = useState(2);
  const [logScale, setLogScale] = useState(true);
  const N0 = 10 ** logN0;
  const clock = useSimClock({ tMax: GROWTH_HOURS, speed: GROWTH_HOURS / 16 });
  const { setT: setTime, pause } = clock;
  // Åpner etter 12 timer på kjøkkenbenken
  useEffect(() => setTime(12), [setTime]);
  const t = clock.t;
  const N = countAt(T, N0, t);
  const g = generationTimeAt(T);
  const phase = phaseAt(T, N0, t);
  const tDanger = timeToCount(T, N0, DANGER);
  const preset = PRESETS.find((p) => p.T === T)?.value ?? null;
  const [plotRef, fp] = useContainerTextScale<HTMLDivElement>();
  const [treeRef, ft] = useContainerTextScale<HTMLDivElement>();
  const plotH = Math.round(340 + 260 * (fp - 1));

  return (
    <VizLayout>
      <Toolbar>
        <Forvalg<Preset>
          label="Maten står i"
          options={PRESETS.map((p) => ({ value: p.value, label: p.label, detail: `${p.T} °C` }))}
          value={preset}
          onPick={(v) => setT(PRESETS.find((p) => p.value === v)!.T)}
        />
      </Toolbar>
      <Controls>
        <Slider label="Temperatur" value={T} onChange={setT} min={0} max={50} step={1} unit="°C" />
        <Slider
          label="Bakterier ved start"
          value={logN0}
          onChange={setLogN0}
          min={1}
          max={4}
          step={1}
          format={(v) => `${fmtCount(10 ** v)} per gram`}
        />
        <Slider
          label="Tid"
          value={t}
          onChange={(v) => {
            pause();
            setTime(v);
          }}
          min={0}
          max={GROWTH_HOURS}
          step={0.5}
          format={(v) => `${fmt(v, 1)} timer`}
        />
      </Controls>
      <Toolbar>
        <PlayBar clock={clock} time={`${fmt(t, 1)} timer`} />
        <Toggle label="Logaritmisk skala" checked={logScale} onChange={setLogScale} />
      </Toolbar>

      <div ref={plotRef}>
        <Figure
          viewBox={`0 0 800 ${plotH}`}
          label={`Vekstkurve ved ${T} °C fra ${fmtCount(N0)} bakterier per gram. Etter ${fmt(t, 1)} timer: ${countText(N)} per gram.`}
          caption={logScale ? 'Logaritmisk skala: hvert steg oppover er ti ganger flere bakterier.' : 'Vanlig skala: de første timene ser ut som null, selv om bakteriene vokser hele tiden.'}
        >
          <GrowthPlot T={T} N0={N0} t={t} logScale={logScale} height={plotH} tDanger={tDanger} />
        </Figure>
      </div>
      <Legend
        items={[
          { color: CURVE, label: `${T} °C` },
          { color: VIZ.muted, label: 'Andre temperaturer', dashed: true },
          { color: DANGER_COLOR, label: 'En million per gram', dashed: true },
          { color: BIO.plante.line, label: 'Felt: vekstfasene' },
        ]}
      />

      <div ref={treeRef}>
        <FissionFigure T={T} N0={N0} t={t} f={ft} />
      </div>

      <Readouts>
        <Readout label="Generasjonstid" value={grows(T) ? durationText(g) : 'ingen vekst'} />
        <Readout label="Bakterier nå" value={countText(N)} unit="per gram" tone={N >= DANGER ? DANGER_COLOR : CURVE} />
        <Readout label="Fase" value={phase === 'ingen' ? 'Ingen deling' : capitalize(GROWTH_PHASE_NAMES[phase]).replace('Eksponentiell', 'Eksponen\u00adtiell')} />
        <Readout
          label="Over en million per gram etter"
          value={tDanger === null ? 'aldri' : durationText(tDanger)}
          tone={tDanger !== null && tDanger <= GROWTH_HOURS ? DANGER_COLOR : undefined}
        />
      </Readouts>

      {grows(T) && (
        <Formula label="Eksponentiell vekst">
          <FormulaLine>
            N = N<Sub>0</Sub> · 2<Sup>n</Sup>, der n er antall generasjoner (delinger)
          </FormulaLine>
          <FormulaLine>
            Etter {fmt(t, 1)} timer: n = {fmt(generationsAfter(T, N0, t), 2)} generasjoner, N = {fmtCount(N0)} · 2
            <Sup>{fmt(generationsAfter(T, N0, t), 2)}</Sup> = {countText(N)} per gram
            {phase === 'stasjonaer' || phase === 'dod' ? ' (taket er nådd)' : ''}
          </FormulaLine>
        </Formula>
      )}

      <Explain>{explanation(T, t, phase, tDanger)}</Explain>
    </VizLayout>
  );
}

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/* ---------- Vekstkurven ---------- */

const GHOSTS = [4, 20, 37];

function GrowthPlot({
  T,
  N0,
  t,
  logScale,
  height,
  tDanger,
}: {
  T: number;
  N0: number;
  t: number;
  logScale: boolean;
  height: number;
  tDanger: number | null;
}) {
  const f = useTextScale();
  const y = logScale
    ? { min: 0, max: 10, label: 'Bakterier per gram (log-skala)', ticks: [] as number[] }
    : { min: 0, max: 1.1, label: 'Bakterier per gram (milliarder)', ticks: [0, 0.25, 0.5, 0.75, 1], decimals: 2 };
  const val = (n: number) => (logScale ? Math.log10(Math.max(1, n)) : n / 1e9);
  const ends = phaseEndsAt(T, N0);
  return (
    <Plot
      x={{ min: 0, max: GROWTH_HOURS, label: 'Tid (timer)', ticks: [0, 6, 12, 18, 24, 30, 36, 42, 48] }}
      y={y}
      width={800}
      height={height}
    >
      {({ sx, sy, x0, x1, y0, y1 }) => {
        const bands: [number, number, Exclude<Phase, 'ingen'>][] = ends
          ? [
              [0, ends.lag, 'lag'],
              [ends.lag, ends.log, 'log'],
              [ends.log, ends.stationary, 'stasjonaer'],
              [ends.stationary, Infinity, 'dod'],
            ]
          : [];
        return (
          <g>
            {bands.map(([a, b, ph]) => {
              const xa = sx(Math.min(GROWTH_HOURS, a));
              const xb = sx(Math.min(GROWTH_HOURS, b));
              if (xb - xa < 1) return null;
              const name = GROWTH_PHASE_NAMES[ph];
              const short = ph === 'log' ? 'eksp. fase' : ph === 'stasjonaer' ? 'stasjonær' : ph === 'lag' ? 'lag' : 'død';
              const w = xb - xa;
              const fits = w > name.length * 8.2 * f + 8;
              const fitsShort = w > short.length * 8.2 * f + 6;
              return (
                <g key={ph}>
                  <rect x={xa} y={y1} width={w} height={y0 - y1} fill={PHASE_COLOR[ph]} />
                  {(fits || fitsShort) && (
                    <Txt x={xa + w / 2} y={y1 + 18 * f} size={0.75} muted>
                      {fits ? name : short}
                    </Txt>
                  )}
                </g>
              );
            })}
            {logScale &&
              [0, 2, 4, 6, 8, 10].map((e) => (
                <g key={e}>
                  <line x1={x0} x2={x1} y1={sy(e)} y2={sy(e)} className="viz-gridline" />
                  <text x={x0 - 10} y={sy(e) + 5 * f} textAnchor="end" className="viz-tick">
                    {e === 0 ? '1' : e === 2 ? '100' : <>10<TSup>{String(e)}</TSup></>}
                  </text>
                </g>
              ))}
            {/* Andre temperaturer til sammenligning */}
            {GHOSTS.filter((G) => G !== T).map((G) => {
              const pts = sample((h) => val(countAt(G, N0, h)), 0, GROWTH_HOURS, 240);
              const last = pts[pts.length - 1]!;
              // Etiketten står til høyre for den stigende delen, over millionlinja så den ikke treffer markeringen der (ellers ved slutten)
              const labelAt = pts.find(([, v]) => v >= (logScale ? 7 : 0.5));
              const [lxh, lyv] = labelAt ?? last;
              return (
                <g key={G}>
                  <path d={linePath(pts, sx, sy)} fill="none" stroke={VIZ.muted} strokeWidth={1.8} strokeDasharray="6 5" />
                  <Txt x={labelAt ? sx(lxh) + 10 : x1 - 4} y={sy(lyv) - 8} anchor={labelAt ? 'start' : 'end'} size={0.75} muted>
                    {G} °C
                  </Txt>
                </g>
              );
            })}
            {/* En million per gram */}
            <line x1={x0} x2={x1} y1={sy(val(DANGER))} y2={sy(val(DANGER))} stroke={DANGER_COLOR} strokeWidth={2} strokeDasharray="7 5" />
            {logScale && (
              <Txt x={x1 - 6} y={sy(val(DANGER)) + 20 * f} anchor="end" size={0.78} color={DANGER_COLOR} weight={650}>
                {f > 1.3 ? '1 million per gram' : 'en million per gram: fare for matforgiftning'}
              </Txt>
            )}
            <path d={linePath(sample((h) => val(countAt(T, N0, h)), 0, GROWTH_HOURS, 320), sx, sy)} fill="none" stroke={CURVE} strokeWidth={3.4} />
            {tDanger !== null && tDanger <= GROWTH_HOURS && logScale && (
              <circle cx={sx(tDanger)} cy={sy(val(DANGER))} r={6} fill={VIZ.surface} stroke={DANGER_COLOR} strokeWidth={2.5} />
            )}
            <line x1={sx(t)} x2={sx(t)} y1={y0} y2={y1} className="viz-guide" />
            <circle cx={sx(t)} cy={sy(val(countAt(T, N0, t)))} r={7} fill={CURVE} stroke={VIZ.surface} strokeWidth={2.5} />
          </g>
        );
      }}
    </Plot>
  );
}

/* ---------- Termometer og todeling ---------- */

function FissionFigure({ T, N0, t, f }: { T: number; N0: number; t: number; f: number }) {
  const narrow = f > 1.3;
  const k = Math.max(1, 0.85 * f);
  const gens = narrow ? 4 : 5;
  const g = generationTimeAt(T);
  const done = generationsAfter(T, N0, t);
  const H = Math.round(250 + 120 * (f - 1));
  const top = 34 * f;
  const bottom = H - 34 * f - 26 * f;
  const thermoX = narrow ? 60 : 70;
  const colX0 = narrow ? 150 : 190;
  const colW = (780 - colX0) / gens;
  const size = (narrow ? 26 : 22) * k;
  return (
    <Figure
      viewBox={`0 0 800 ${H}`}
      maxHeight={Math.round(H * 1.25)}
      label={`Termometer på ${T} °C og bakterier som deler seg: 1, 2, 4, 8 og 16 celler. Én generasjon tar ${grows(T) ? durationText(g) : 'uendelig lang tid'}.`}
      caption={`Bakterier formerer seg ved todeling: én celle blir to, to blir fire. Så langt: ${fmt(done, 1)} generasjoner.`}
    >
      <Thermometer x={thermoX} top={top} bottom={bottom} T={T} f={f} />
      {Array.from({ length: gens }, (_, i) => {
        const n = 2 ** i;
        const cols = 2 ** Math.ceil(i / 2);
        const rows = n / cols;
        const cx = colX0 + colW * (i + 0.5);
        const cy = (top + bottom) / 2;
        const sp = size * 1.15;
        const reached = done >= i - 1e-9;
        return (
          <g key={i} opacity={reached ? 1 : 0.28}>
            {Array.from({ length: n }, (_, j) => {
              const c = j % cols;
              const r = Math.floor(j / cols);
              return (
                <Bakterie
                  key={j}
                  x={cx + (c - (cols - 1) / 2) * sp * (i % 2 ? 1 : 1.05)}
                  y={cy + (r - (rows - 1) / 2) * sp * 0.7}
                  size={size}
                />
              );
            })}
            <Txt x={cx} y={bottom + 30 * f} size={0.8} weight={650}>
              {n === 1 ? '1 celle' : `${n} celler`}
            </Txt>
            <Txt x={cx} y={bottom + 52 * f} size={0.75} muted>
              {i === 0 ? 'start' : grows(T) ? `+${durationText(i * g)}` : '–'}
            </Txt>
          </g>
        );
      })}
      <Txt x={colX0 + 4} y={top - 10} anchor="start" size={0.85} weight={650}>
        {grows(T) ? `Én generasjon ved ${T} °C: ${durationText(g)}` : `Ved ${T} °C deler bakteriene seg ikke`}
      </Txt>
    </Figure>
  );
}

function Thermometer({ x, top, bottom, T, f }: { x: number; top: number; bottom: number; T: number; f: number }) {
  const k = useBioScale();
  const w = 16 * k;
  const bulb = 15 * k;
  const yb = bottom - bulb;
  const y0 = top + 6;
  const scale = (v: number) => yb - bulb * 0.6 - ((v - 0) / 50) * (yb - bulb * 0.6 - y0);
  const color = mixColor(BIO.vann, BIO.oksygenrikt, Math.min(1, Math.max(0, T / 40)));
  return (
    <g>
      <rect x={x - w / 2} y={y0 - 4} width={w} height={yb - y0 + 4} rx={w / 2} fill={VIZ.surface} stroke={VIZ.muted} strokeWidth={2} />
      <rect x={x - w / 2 + 4} y={scale(T)} width={w - 8} height={Math.max(0, yb - scale(T))} rx={(w - 8) / 2} fill={color} />
      <circle cx={x} cy={yb + bulb * 0.4} r={bulb} fill={color} stroke={VIZ.muted} strokeWidth={2} />
      {(
        [
          [T_MIN, 'minimum'],
          [37, 'optimum'],
          [T_MAX, 'maksimum'],
        ] as const
      ).map(([v, l]) => (
        <g key={l}>
          <line x1={x + w / 2} x2={x + w / 2 + 8} y1={scale(v)} y2={scale(v)} stroke={VIZ.muted} strokeWidth={1.5} />
          {f <= 1.3 && (
            <Txt x={x + w / 2 + 12} y={scale(v) + 5} anchor="start" size={0.7} muted>
              {v} °C {l}
            </Txt>
          )}
        </g>
      ))}
      <Txt x={x} y={bottom + 30 * f} size={0.85} weight={700} color={color}>
        {T} °C
      </Txt>
    </g>
  );
}

/* ---------- Forklaring ---------- */

function explanation(T: number, t: number, phase: Phase, tDanger: number | null): ReactNode {
  const exp = (
    <p>
      Bakterier formerer seg ved todeling, så antallet <strong>dobles</strong> for hver generasjon: 100 blir 200, 400, 800 … Etter 20
      generasjoner er det over en million ganger så mange (2<Sup>20</Sup> ≈ 1 000 000). Derfor går det så fort til slutt, og derfor bruker
      vi logaritmisk skala.
    </p>
  );
  const model = (
    <p>
      Modellen er en typisk matforgiftningsbakterie (f.eks. <em>Salmonella</em> eller <em>Escherichia coli</em>) i mat med god næring.
      Fasene og tallene er forenklet; i virkeligheten avhenger de også av matvaren, fuktighet, pH og hvilke bakterier som er der.
    </p>
  );
  if (!grows(T) && T < 25)
    return (
      <>
        <p>
          <strong>For kaldt til å dele seg ({T} °C).</strong> Under ca. {T_MIN} °C står veksten nesten stille, og etter to døgn er det like
          mange bakterier som ved start. Men kulde dreper ikke bakteriene: de begynner å dele seg igjen når maten blir varm. Derfor anbefaler
          Mattilsynet at kjøleskapet holder 4 °C eller lavere. Noen bakterier, som <em>Listeria</em>, kan likevel vokse sakte i kjøleskapet.
        </p>
        {model}
      </>
    );
  if (!grows(T))
    return (
      <>
        <p>
          <strong>For varmt til å dele seg ({T} °C).</strong> Over ca. {T_MAX} °C ødelegges enzymene til denne bakterien, og den deler seg
          ikke. Ved enda høyere temperatur dør bakteriene: koking og gjennomsteking (minst ca. 70 °C inni maten) dreper de fleste. Men
          giftstoffer som noen bakterier allerede har laget, tåler ofte varme.
        </p>
        {model}
      </>
    );
  const dangerText =
    tDanger === null
      ? null
      : tDanger <= t
        ? `Etter ${durationText(tDanger)} var det over en million bakterier per gram. Da er risikoen for matforgiftning stor.`
        : tDanger <= GROWTH_HOURS
          ? `Ved ${T} °C passerer maten en million bakterier per gram etter ${durationText(tDanger)}.`
          : `Ved ${T} °C tar det ${durationText(tDanger)} før maten har en million bakterier per gram.`;
  const phases: Record<Exclude<Phase, 'ingen'>, ReactNode> = {
    lag: (
      <p>
        <strong>Lagfasen.</strong> Bakteriene tilpasser seg den nye maten: de lager enzymer og vokser i størrelse, men deler seg nesten
        ikke ennå. Lagfasen er lengre jo kaldere det er. {dangerText}
        {T <= 10
          ? ' Kulde dreper ikke bakteriene, men bremser dem: i et for varmt kjøleskap vokser de sakte, og derfor holder maten seg lenger ved 4 °C.'
          : ''}
      </p>
    ),
    log: (
      <p>
        <strong>Eksponentiell fase.</strong> Nå deler bakteriene seg så fort de kan ved {T} °C, én gang hver {durationText(generationTimeAt(T))}.
        Antallet dobles hele tiden, så kurven er en rett linje på logaritmisk skala. {dangerText}
      </p>
    ),
    stasjonaer: (
      <p>
        <strong>Stasjonær fase.</strong> Det er ca. {fmtSci(N_MAX, 0)} bakterier per gram. Næringen begynner å ta slutt, og avfallsstoffer hoper
        seg opp, så omtrent like mange dør som deles. Maten er nå full av bakterier og kanskje giftstoffer. {dangerText}
      </p>
    ),
    dod: (
      <p>
        <strong>Dødsfasen.</strong> Næringen er brukt opp og avfallsstoffene har hopet seg opp, så flere bakterier dør enn det blir dannet.
        At antallet synker, gjør ikke maten trygg: giftstoffene kan fortsatt være der.
      </p>
    ),
  };
  return (
    <>
      {phase === 'ingen' ? null : phases[phase]}
      {exp}
      {model}
    </>
  );
}

