import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  BIO,
  Controls,
  Explain,
  Figure,
  Formula,
  FormulaLine,
  Insekt,
  Legend,
  PlayBar,
  Plot,
  Readout,
  Readouts,
  Segmented,
  Slider,
  Toolbar,
  Txt,
  VIZ,
  VizLayout,
  fmt,
  fmtCount,
  linePath,
  mixColor,
  useContainerTextScale,
  useSimClock,
  useTextScale,
} from '../kit';
import {
  CAPACITY,
  CHANGE_START,
  GENERATIONS,
  GRADUAL_GENERATIONS,
  OFFSPRING_ASEX,
  OFFSPRING_SEX,
  START_TEMP,
  TOLERANCE,
  extinctionGeneration,
  generationsToCapacity,
  simulateReproduction,
  specimens,
  survival,
  traitQuantile,
  type ChangeKind,
  type PopulationState,
  type ReproductionRun,
} from './model';

const ASEX = BIO.serie[1];
const SEX = BIO.serie[0];
/** Største antall dyr som tegnes per bestand (ett dyr = K / MAX_GLYPHS individer). */
const MAX_GLYPHS = 30;
/** Generasjonen som vises når siden åpnes: like etter at miljøet er endret. */
const START_GEN = CHANGE_START + 1;
/** Temperaturområdet på x-aksen i figuren. */
const Z_MIN = 9;
const Z_MAX = 27;
/** Halv bredde på feltet der overlevelsen er over 50 % (w > 0,5 når |z − T| < σ√(2 ln 2)). */
const HALF_BAND = TOLERANCE * Math.sqrt(2 * Math.LN2);

const KINDS: { value: ChangeKind; label: string }[] = [
  { value: 'bra', label: 'Brå endring' },
  { value: 'gradvis', label: 'Gradvis endring' },
];

export default function KjonnetOgUkjonnet() {
  const [kind, setKind] = useState<ChangeKind>('bra');
  const [dT, setDT] = useState(5);
  const run = useMemo(() => simulateReproduction(dT, kind), [dT, kind]);
  const clock = useSimClock({ tMax: GENERATIONS, speed: GENERATIONS / 16 });
  const { setT, pause } = clock;
  useEffect(() => setT(START_GEN), [setT]);
  const gen = Math.min(GENERATIONS, Math.max(0, Math.floor(clock.t + 1e-9)));
  const T = run.temp[gen]!;
  const a = run.asex[gen]!;
  const s = run.sex[gen]!;
  const toKa = generationsToCapacity(run.asex);
  const toKs = generationsToCapacity(run.sex);
  const extA = extinctionGeneration(run.asex);
  const extS = extinctionGeneration(run.sex);
  const [sceneRef, f] = useContainerTextScale<HTMLDivElement>();
  const [plotRef, fp] = useContainerTextScale<HTMLDivElement>();
  const plotH = Math.round(320 + 260 * (fp - 1));

  return (
    <VizLayout>
      <Toolbar>
        <Segmented label="Hvordan miljøet endres" options={KINDS} value={kind} onChange={setKind} />
      </Toolbar>
      <Controls>
        <Slider label="Temperaturen stiger med" value={dT} onChange={setDT} min={0} max={8} step={0.5} unit="°C" decimals={1} />
        <Slider
          label="Generasjon"
          value={gen}
          onChange={(v) => {
            pause();
            setT(v);
          }}
          min={0}
          max={GENERATIONS}
          step={1}
        />
      </Controls>
      <Toolbar>
        <PlayBar clock={clock} time={`generasjon ${gen}`} />
      </Toolbar>

      <div ref={sceneRef}>
        <PopulationScene a={a} s={s} T={T} gen={gen} f={f} extA={extA} extS={extS} />
      </div>
      <Legend
        items={[
          { color: ASEX, label: 'Ukjønnet formering: kloner' },
          { color: SEX, label: 'Kjønnet formering: variasjon' },
          { color: BIO.plante.line, label: 'Grønt felt: overlevelse over 50 % ved temperaturen nå' },
        ]}
      />

      <div ref={plotRef}>
        <Figure
          viewBox={`0 0 800 ${plotH}`}
          label={`Antall individer i de to bestandene over ${GENERATIONS} generasjoner. Generasjon ${gen}: ukjønnet ${fmtCount(a.N)}, kjønnet ${fmtCount(s.N)}.`}
        >
          <Plot
            x={{ min: 0, max: GENERATIONS, label: 'Generasjon', ticks: [0, 10, 20, 30, 40, 50, 60, 70, 80] }}
            y={{ min: 0, max: 1100, label: 'Antall individer', ticks: [0, 250, 500, 750, 1000] }}
            width={800}
            height={plotH}
          >
            {(sc) => <GrowthLines run={run} gen={gen} dT={dT} kind={kind} extA={extA} extS={extS} {...sc} />}
          </Plot>
        </Figure>
      </div>
      <Legend
        items={[
          { color: ASEX, label: 'Ukjønnet' },
          { color: SEX, label: 'Kjønnet' },
          { color: BIO.baereevne, label: `Bæreevne K = ${fmtCount(CAPACITY)}`, dashed: true },
        ]}
      />

      <Readouts>
        <Readout label="Temperatur i miljøet" value={fmt(T, 1)} unit="°C" />
        <Readout label="Ukjønnet bestand" value={a.N > 0 ? fmtCount(a.N) : 'utdødd'} unit={a.N > 0 ? 'individer' : undefined} tone={ASEX} />
        <Readout label="Kjønnet bestand" value={s.N > 0 ? fmtCount(s.N) : 'utdødd'} unit={s.N > 0 ? 'individer' : undefined} tone={SEX} />
        <Readout
          label="Generasjoner til bæreevnen"
          value={`${toKa ?? '–'} og ${toKs ?? '–'}`}
          unit="(ukjønnet og kjønnet)"
        />
      </Readouts>

      <Formula label="Avkom per individ">
        <FormulaLine>Avkom per individ som blir voksne: λ = avkom · gjennomsnittlig overlevelse (λ &lt; 1: bestanden minker)</FormulaLine>
        <FormulaLine>
          {a.N > 0 ? (
            <>
              Ukjønnet: λ = {OFFSPRING_ASEX} · {fmt(a.wbar, 2)} = {fmt(a.lambda, 2)}
              {a.lambda < 1 ? ' (minker)' : ''}
            </>
          ) : (
            'Ukjønnet: utdødd'
          )}
        </FormulaLine>
        <FormulaLine>
          {s.N > 0 ? (
            <>
              Kjønnet: λ = {OFFSPRING_SEX} · {fmt(s.wbar, 2)} = {fmt(s.lambda, 2)}
              {s.lambda < 1 ? ' (minker)' : ''} · bare hunnene føder, derfor {OFFSPRING_SEX} og ikke {OFFSPRING_ASEX}
            </>
          ) : (
            'Kjønnet: utdødd'
          )}
        </FormulaLine>
      </Formula>

      <Explain>{explanation({ run, gen, dT, kind, extA, toKa, toKs })}</Explain>
    </VizLayout>
  );
}

/* ---------- Bestandene: hvert dyr plassert etter temperaturen det er best tilpasset ---------- */

function PopulationScene({
  a,
  s,
  T,
  gen,
  f,
  extA,
  extS,
}: {
  a: PopulationState;
  s: PopulationState;
  T: number;
  gen: number;
  f: number;
  extA: number | null;
  extS: number | null;
}) {
  const k = Math.max(1, 0.85 * f);
  const X0 = 24;
  const X1 = 776;
  const sx = (z: number) => X0 + ((z - Z_MIN) / (Z_MAX - Z_MIN)) * (X1 - X0);
  const head = 30 * f;
  const title = 26 * f;
  const body = Math.round(132 + 300 * (k - 1));
  const rowH = title + body;
  const top = head;
  const axisY = top + 2 * rowH + 10;
  const H = Math.round(axisY + 30 * f + 26 * f);
  const ticks = f > 1.3 ? [9, 13, 17, 21, 25] : [9, 11, 13, 15, 17, 19, 21, 23, 25, 27];
  const lo = sx(Math.max(Z_MIN, T - HALF_BAND));
  const hi = sx(Math.min(Z_MAX, T + HALF_BAND));
  const rows: { st: PopulationState; color: string; name: string; seed: number; ext: number | null }[] = [
    { st: a, color: ASEX, name: f > 1.3 ? 'Ukjønnet (kloner)' : 'Ukjønnet formering (kloner)', seed: 3, ext: extA },
    { st: s, color: SEX, name: f > 1.3 ? 'Kjønnet' : 'Kjønnet formering', seed: 8, ext: extS },
  ];
  return (
    <Figure
      viewBox={`0 0 800 ${H}`}
      maxHeight={Math.round(H * 1.25)}
      label={`De to bestandene i generasjon ${gen}. Hvert dyr står ved temperaturen det er best tilpasset. Temperaturen i miljøet er ${fmt(T, 1)} °C.`}
      caption={`Hvert dyr i figuren er ${fmt(CAPACITY / MAX_GLYPHS, 0)} individer. Blekere dyr har liten sjanse til å overleve ved temperaturen nå.`}
    >
      {/* Feltet der dyrene trives, gjennom begge radene */}
      <rect x={lo} y={top + title - 6} width={Math.max(0, hi - lo)} height={axisY - top - title + 6} fill={mixColor(VIZ.surface, BIO.plante.line, 0.13)} />
      <line x1={sx(T)} x2={sx(T)} y1={top + title - 6} y2={axisY} stroke={BIO.plante.line} strokeWidth={2} strokeDasharray="6 5" />
      <Txt x={Math.min(X1 - 4, Math.max(X0 + 4, sx(T)))} y={head - 9} anchor={sx(T) > X1 - 120 ? 'end' : sx(T) < X0 + 120 ? 'start' : 'middle'} color={BIO.plante.line} weight={650} size={0.85}>
        miljøet nå: {fmt(T, 1)} °C
      </Txt>
      {rows.map((r, i) => (
        <PopulationRow
          key={r.name}
          y={top + i * rowH}
          title={title}
          body={body}
          st={r.st}
          color={r.color}
          name={r.name}
          seed={r.seed}
          T={T}
          sx={sx}
          k={k}
          ext={r.ext}
          gen={gen}
        />
      ))}
      <line x1={X0} x2={X1} y1={axisY} y2={axisY} className="viz-axis" />
      {ticks.map((z) => (
        <g key={z}>
          <line x1={sx(z)} x2={sx(z)} y1={axisY} y2={axisY + 6} className="viz-axis" />
          <Txt x={sx(z)} y={axisY + 24 * f} size={0.8} muted>
            {fmt(z, 0)}
          </Txt>
        </g>
      ))}
      <Txt x={400} y={H - 8} size={0.85} muted>
        {f > 1.3 ? 'Best tilpasset temperatur (°C)' : 'Temperaturen dyret er best tilpasset (°C)'}
      </Txt>
    </Figure>
  );
}

function PopulationRow({
  y,
  title,
  body,
  st,
  color,
  name,
  seed,
  T,
  sx,
  k,
  ext,
  gen,
}: {
  y: number;
  title: number;
  body: number;
  st: PopulationState;
  color: string;
  name: string;
  seed: number;
  T: number;
  sx: (z: number) => number;
  k: number;
  ext: number | null;
  gen: number;
}) {
  const sp = useMemo(() => specimens(MAX_GLYPHS, seed), [seed]);
  const shown = st.N > 0 ? Math.max(1, Math.round((st.N / CAPACITY) * MAX_GLYPHS)) : 0;
  const size = (k > 1.2 ? 34 : 30) * k;
  const pad = size * 0.6;
  const paint = { fill: mixColor(VIZ.surface, color, 0.28), line: color };
  return (
    <g>
      <Txt x={24} y={y + title - 10} anchor="start" weight={700} color={color} size={0.95}>
        {name}
      </Txt>
      <Txt x={776} y={y + title - 10} anchor="end" weight={650} size={0.85}>
        {st.N > 0 ? `${fmtCount(st.N)} individer` : `utdødd${ext !== null && ext <= gen && k < 1.2 ? ` (generasjon ${ext})` : ''}`}
      </Txt>
      <rect x={24} y={y + title} width={752} height={body} rx={10} fill="none" stroke={VIZ.grid} strokeWidth={1.5} />
      {sp.slice(0, shown).map((p, i) => {
        const z = traitQuantile(st.n, p.u);
        const x = Math.min(776 - pad, Math.max(24 + pad, sx(z) + p.jitter * 12));
        const yy = y + title + pad + p.y * (body - 2 * pad);
        const w = survival(z, T);
        return (
          <g key={i} opacity={0.3 + 0.7 * w}>
            <Insekt x={x} y={yy} size={size} paint={paint} rotate={(p.jitter * 40) % 30} />
          </g>
        );
      })}
      {st.N === 0 && (
        <Txt x={400} y={y + title + body / 2 + 6} size={1} muted>
          Ingen individer igjen
        </Txt>
      )}
    </g>
  );
}

/* ---------- Antall individer over tid ---------- */

function GrowthLines({
  run,
  gen,
  dT,
  kind,
  extA,
  extS,
  sx,
  sy,
  x1,
  y0,
  y1,
}: {
  run: ReproductionRun;
  gen: number;
  dT: number;
  kind: ChangeKind;
  extA: number | null;
  extS: number | null;
  sx: (v: number) => number;
  sy: (v: number) => number;
  x1: number;
  y0: number;
  y1: number;
}) {
  const f = useTextScale();
  const ptsA = run.asex.map((st, g): [number, number] => [g, st.N]);
  const ptsS = run.sex.map((st, g): [number, number] => [g, st.N]);
  const changeEnd = kind === 'bra' ? CHANGE_START : CHANGE_START + GRADUAL_GENERATIONS;
  const a = run.asex[gen]!;
  const s = run.sex[gen]!;
  return (
    <g>
      {dT > 0 && (
        <g>
          <rect
            x={sx(CHANGE_START)}
            y={y1}
            width={Math.max(0, sx(changeEnd) - sx(CHANGE_START))}
            height={y0 - y1}
            fill={mixColor(VIZ.surface, BIO.atp, 0.12)}
          />
          <rect x={sx(changeEnd)} y={y1} width={Math.max(0, x1 - sx(changeEnd))} height={y0 - y1} fill={mixColor(VIZ.surface, BIO.atp, 0.18)} />
          <line x1={sx(CHANGE_START)} x2={sx(CHANGE_START)} y1={y0} y2={y1} className="viz-guide" />
          <Txt x={sx(CHANGE_START) + 8} y={sy(CAPACITY) + 24 * f} anchor="start" size={0.8} color={BIO.atp} weight={650}>
            {kind === 'bra' ? `+${fmt(dT, 1)} °C` : `+${fmt(dT, 1)} °C over ${GRADUAL_GENERATIONS} generasjoner`}
          </Txt>
        </g>
      )}
      <line x1={sx(0)} x2={x1} y1={sy(CAPACITY)} y2={sy(CAPACITY)} stroke={BIO.baereevne} strokeWidth={2} strokeDasharray="7 6" />
      <path d={linePath(ptsS, sx, sy)} fill="none" stroke={SEX} strokeWidth={3.2} strokeLinejoin="round" />
      <path d={linePath(ptsA, sx, sy)} fill="none" stroke={ASEX} strokeWidth={3.2} strokeLinejoin="round" />
      {[
        { ext: extA, color: ASEX },
        { ext: extS, color: SEX },
      ].map(
        ({ ext, color }, i) =>
          ext !== null && (
            <g key={i}>
              <path
                d={`M${sx(ext) - 6},${sy(0) - 6 - i * 14} l12,12 m0,-12 l-12,12`}
                stroke={color}
                strokeWidth={3}
                strokeLinecap="round"
              />
            </g>
          ),
      )}
      <line x1={sx(gen)} x2={sx(gen)} y1={y0} y2={y1} className="viz-guide" />
      <circle cx={sx(gen)} cy={sy(s.N)} r={6} fill={SEX} stroke={VIZ.surface} strokeWidth={2.5} />
      <circle cx={sx(gen)} cy={sy(a.N)} r={6} fill={ASEX} stroke={VIZ.surface} strokeWidth={2.5} />
    </g>
  );
}

/* ---------- Forklaring ---------- */

function explanation({
  run,
  gen,
  dT,
  kind,
  extA,
  toKa,
  toKs,
}: {
  run: ReproductionRun;
  gen: number;
  dT: number;
  kind: ChangeKind;
  extA: number | null;
  toKa: number | null;
  toKs: number | null;
}): ReactNode {
  const a = run.asex[gen]!;
  const s = run.sex[gen]!;
  const T = run.temp[gen]!;
  const costs = (
    <p>
      <strong>Fordeler og ulemper.</strong> Ukjønnet formering (deling, knopping, utløpere, jomfrufødsel hos bladlus) er rask og billig:
      én forelder er nok, og alt avkommet kan få nye avkom. Kjønnet formering koster mer: det trengs to foreldre, partneren må finnes, og
      halvparten av avkommet er hanner som ikke føder selv. Til gjengjeld gir meiose og befruktning nye kombinasjoner av gener, så
      bestanden har variasjon når miljøet endrer seg, f.eks. når klimaet blir varmere eller en ny parasitt eller sykdom dukker opp.
    </p>
  );
  const model = (
    <p>
      Modellen er forenklet: én arvelig egenskap (hvilken temperatur dyret tåler best), like mange avkom hos alle hunner, ingen mutasjoner
      og ingen konkurranse mellom de to bestandene. Tallene er valgt for å vise prinsippet.
    </p>
  );
  const misconception = (
    <p>
      Legg merke til at det ikke er de enkelte dyrene som tilpasser seg: hvert dyr har de genene det har. Det er bestanden som endrer seg,
      fordi de som tåler varmen best, overlever og får flest avkom (naturlig utvalg).
    </p>
  );
  let main: ReactNode;
  if (gen < CHANGE_START || dT === 0) {
    const grow = (toKa === null || gen < toKa) && (toKs === null || gen < toKs);
    if (grow)
      main = (
        <p>
          <strong>Begge bestandene vokser.</strong> Den ukjønnede bestanden vokser omtrent dobbelt så fort per generasjon: alle individene er
          hunner som får avkom alene, mens bare halvparten av individene i den kjønnede bestanden kan føde. Det kalles den doble prisen for
          kjønnet formering.
        </p>
      );
    else
      main = (
        <p>
          <strong>Stabilt miljø ({fmt(T, 0)} °C).</strong> Klonene nådde bæreevnen etter {toKa} generasjoner, den kjønnede bestanden etter{' '}
          {toKs}. Alle klonene er like og godt tilpasset, så i et miljø som ikke endrer seg, er ukjønnet formering best. I den kjønnede
          bestanden gir hver ny generasjon variasjon, og noen avkom blir alltid litt dårligere tilpasset.
          {dT === 0 ? ' Flytt glidebryteren for å la temperaturen stige.' : ` Om ${CHANGE_START - gen} generasjoner blir det varmere.`}
        </p>
      );
    return (
      <>
        {main}
        {costs}
        {model}
      </>
    );
  }
  const changing = kind === 'gradvis' && gen < CHANGE_START + GRADUAL_GENERATIONS;
  const aliveA = a.N > 0;
  const aliveS = s.N > 0;
  const shift = s.N > 0 ? s.mean - START_TEMP : 0;
  if (!aliveA && !aliveS)
    main = (
      <p>
        <strong>Begge bestandene døde ut.</strong> Temperaturen steg med {fmt(dT, 1)} °C på én gang. Det var for mye og for fort: selv de best
        tilpassede i den kjønnede bestanden fikk for få avkom til at bestanden kunne følge med. Variasjon gir bare en sjanse, ingen garanti.
        Prøv en gradvis endring med samme temperaturøkning.
      </p>
    );
  else if (!aliveA)
    main = (
      <p>
        <strong>Klonene døde ut{extA !== null ? ` i generasjon ${extA}` : ''}, den kjønnede bestanden overlevde.</strong> Alle klonene er
        genetisk like, så da temperaturen steg, var alle like dårlig tilpasset, og ingen fikk nok avkom. I den kjønnede bestanden fantes det
        individer som tålte varmen bedre. De overlevde og fikk flest avkom, så gjennomsnittet har flyttet seg {fmt(shift, 1)} °C mot den nye
        temperaturen{s.N < 0.9 * CAPACITY ? ', og bestanden er i ferd med å bygge seg opp igjen' : ''}.
      </p>
    );
  else if (!aliveS)
    main = (
      <p>
        <strong>Den kjønnede bestanden døde ut, klonene lever.</strong> Klonene har dobbelt så mange avkom per individ, og det kan holde dem
        i live når endringen er liten, selv om de er dårlig tilpasset.
      </p>
    );
  else if (a.lambda < 1 && extA !== null)
    main = (
      <p>
        <strong>Klonene er i ferd med å dø ut.</strong> Temperaturen er nå {fmt(T, 1)} °C. Alle klonene er like og har samme lave sjanse til
        å overleve, så hvert individ får i snitt bare λ = {fmt(a.lambda, 2)} voksne avkom, færre enn ett. I den kjønnede bestanden er det
        variasjon: noen individer tåler varmen bedre (dyrene inne i det grønne feltet), og de får flest avkom.
      </p>
    );
  else
    main = (
      <p>
        <strong>{changing ? 'Miljøet blir gradvis varmere.' : `Temperaturen steg med ${fmt(dT, 1)} °C.`}</strong> Begge bestandene lever.
        Klonene kan ikke endre seg, så de er like dårlig tilpasset som før endringen og blir varig færre ({fmtCount(a.N)} individer). Den
        kjønnede bestanden har variasjon: de som tåler varmen best, får flest avkom, så gjennomsnittet har flyttet seg {fmt(shift, 1)} °C
        mot den nye temperaturen.
        {changing ? ' Når endringen skjer gradvis, rekker den kjønnede bestanden å følge med.' : ''}
      </p>
    );
  return (
    <>
      {main}
      {misconception}
      {costs}
      {model}
    </>
  );
}
