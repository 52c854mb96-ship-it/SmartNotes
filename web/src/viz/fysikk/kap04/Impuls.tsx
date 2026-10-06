import { useState, type ReactNode } from 'react';
import { Pause, Play, RotateCcw } from 'lucide-react';
import {
  Controls,
  Explain,
  Figure,
  G_EARTH,
  Formula,
  FormulaLine,
  Legend,
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
  linePath,
  sample,
  useSimClock,
  useTextScale,
  type SimClock,
} from '../../kit';
import { BallScene, CATCHES, ballViewBox, catchFor } from './impuls-ball';
import { EggScene, SURFACES, eggViewBox, surfaceFor } from './impuls-egg';
import { FOOTBALL } from './impuls-form';
import { dtForFmax, impact, impactAt, pulseForce, type ImpactResult } from './model';
import { useNarrow } from './useNarrow';

type ScenarioId = 'egg' | 'ball';

interface Scenario {
  label: string;
  /** Hva som gir kraften (graf og formel): «underlaget», «hendene». */
  source: string;
  /** Retningen til impulsen og kraften, motsatt av farten: «oppover», «bort fra keeperen». */
  against: string;
  /** Fartsretningen (positiv retning i utregningen): «nedover». */
  along: string;
  /** Masse (kg) og fart rett før støtet (m/s). */
  m: number;
  v: number;
  /** Støttid i millisekunder. */
  dtMin: number;
  dtMax: number;
  dtStep: number;
  dtDefault: number;
  /** Kraft vises i N eller kN. */
  unit: 'N' | 'kN';
  /** Største verdi på kraftaksen (i `unit`). */
  yMax: number;
  yTicks: number[];
  /** Hvor stor kraft legemet tåler (N), om det finnes en slik grense. */
  limit?: number;
  /** Sakte film: simulert tid (s) per sekund avspilling. */
  slowmo: number;
}

const SCENARIOS: Record<ScenarioId, Scenario> = {
  egg: {
    label: 'Egg som faller 1 m',
    source: 'underlaget',
    against: 'oppover',
    along: 'nedover',
    m: 0.06,
    v: Math.sqrt(2 * 9.81 * 1),
    dtMin: 3,
    dtMax: 30,
    dtStep: 0.5,
    dtDefault: 5,
    unit: 'N',
    yMax: 150,
    yTicks: [0, 50, 100, 150],
    limit: 35,
    slowmo: 0.005,
  },
  ball: {
    label: 'Keeper tar imot en fotball',
    source: 'hendene',
    against: 'bort fra keeperen',
    along: 'i fartsretningen til ballen',
    m: FOOTBALL.m,
    v: 15,
    dtMin: 8,
    dtMax: 60,
    dtStep: 1,
    dtDefault: 10,
    unit: 'N',
    yMax: 1400,
    yTicks: [0, 500, 1000],
    slowmo: 0.012,
  },
};

const OPTIONS: { value: ScenarioId; label: string }[] = [
  { value: 'egg', label: SCENARIOS.egg.label },
  { value: 'ball', label: SCENARIOS.ball.label },
];

/** Kraft i enheten scenariet viser (N eller kN). */
const inUnit = (sc: Scenario, F: number) => (sc.unit === 'kN' ? F / 1000 : F);
const forceText = (sc: Scenario, F: number) => {
  const v = inUnit(sc, F);
  return `${fmt(v, v < 10 ? 1 : 0)} ${sc.unit}`;
};
const impulseText = (I: number) => `${fmt(I, I < 1 ? 3 : 2)} N·s`;

export default function Impuls() {
  const [id, setId] = useState<ScenarioId>('egg');
  const [dts, setDts] = useState<Record<ScenarioId, number>>({
    egg: SCENARIOS.egg.dtDefault,
    ball: SCENARIOS.ball.dtDefault,
  });
  const [showForces, setShowForces] = useState(true);
  // Øyeblikksbildet viser toppen av kraften; «Spill av» viser hele støtet i sakte film.
  const [playing, setPlaying] = useState(false);
  const sc = SCENARIOS[id];
  const dtMs = dts[id];
  const r = impact(sc.m, sc.v, dtMs / 1000);
  const broken = sc.limit !== undefined && r.Fmax > sc.limit;
  const postMs = 0.12 * sc.dtMax;
  const clock = useSimClock({ tMax: (dtMs + postMs) / 1000, speed: sc.slowmo });
  const snapshot = !playing;
  const tMs = snapshot ? dtMs / 2 : clock.t * 1000;
  const [sceneRef, narrowScene] = useNarrow<HTMLDivElement>();
  const [graphRef, narrow] = useNarrow<HTMLDivElement>();
  const graphH = narrow ? 480 : 360;

  const stopPlayback = () => {
    clock.reset();
    setPlaying(false);
  };
  const onPlay = () => {
    if (!playing) {
      setPlaying(true);
      clock.setT(0);
      clock.play();
    } else clock.toggle();
  };

  const label =
    id === 'egg'
      ? `Et egg på 60 gram treffer ${SURFACES[surfaceFor(dtMs)].indefinite} på gulvet med ${fmt(sc.v, 1)} meter per sekund. Støttiden er ${fmt(dtMs, 1)} millisekunder og bremselengden ${fmt(r.stopDist * 100, 1)} centimeter.`
      : `En keeper på en fotballbane tar imot en fotball på 430 gram som kommer med ${fmt(sc.v, 0)} meter per sekund, ${CATCHES[catchFor(dtMs)].phrase}. Støttiden er ${fmt(dtMs, 0)} millisekunder, og ballen stopper over ${fmt(r.stopDist * 100, 1)} centimeter.`;

  return (
    <VizLayout>
      <Toolbar>
        <Segmented
          label="Velg situasjon"
          options={OPTIONS}
          value={id}
          onChange={(v) => {
            stopPlayback();
            setId(v);
          }}
        />
        <Toggle label="Vis krefter" checked={showForces} onChange={setShowForces} />
      </Toolbar>
      <Controls>
        <Slider
          label="Støttid Δt"
          value={dtMs}
          onChange={(v) => {
            stopPlayback();
            setDts((prev) => ({ ...prev, [id]: v }));
          }}
          min={sc.dtMin}
          max={sc.dtMax}
          step={sc.dtStep}
          unit="ms"
          decimals={sc.dtStep < 1 ? 1 : 0}
        />
      </Controls>
      <PlayBar
        clock={clock}
        active={playing}
        onPlay={onPlay}
        onReset={stopPlayback}
        time={
          snapshot ? (
            <>t = {fmt(tMs, Math.abs(tMs * 10 - Math.round(tMs * 10)) < 1e-9 ? 1 : 2)} ms (størst kraft)</>
          ) : (
            <>
              t = {fmt(tMs, id === 'egg' ? 1 : 0)} ms ({fmt(1 / sc.slowmo, 0)} ganger langsommere)
            </>
          )
        }
      />

      <div ref={sceneRef}>
        {id === 'egg' ? (
          <Figure viewBox={eggViewBox(narrowScene)} label={label} maxHeight={380}>
            <EggScene
              r={r}
              m={sc.m}
              v0={sc.v}
              dtMs={dtMs}
              tMs={tMs}
              limit={sc.limit ?? Infinity}
              showForces={showForces}
              snapshot={snapshot}
              narrow={narrowScene}
            />
          </Figure>
        ) : (
          <Figure viewBox={ballViewBox(narrowScene)} label={label} maxHeight={380}>
            <BallScene
              r={r}
              m={sc.m}
              v0={sc.v}
              dtMs={dtMs}
              tMs={tMs}
              dtMinMs={sc.dtMin}
              showForces={showForces}
              narrow={narrowScene}
            />
          </Figure>
        )}
      </div>

      <div ref={graphRef}>
        <Figure viewBox={`0 0 800 ${graphH}`} label="Graf over kraften under støtet. Arealet under grafen er impulsen.">
          <ForceGraph sc={sc} r={r} dtMs={dtMs} tMs={tMs} snapshot={snapshot} height={graphH} />
        </Figure>
      </div>
      <Legend
        items={[
          {
            color: VIZ.applied,
            label: `Kraften F fra ${sc.source} (arealet er impulsen |I|)`,
          },
          {
            color: VIZ.applied,
            dashed: true,
            label: (
              <span>
                Gjennomsnittskraft F<Sub>gj</Sub> (samme areal)
              </span>
            ),
          },
          ...(sc.limit !== undefined ? [{ color: VIZ.muted, dashed: true, label: 'Det egget tåler' }] : []),
        ]}
      />

      <Readouts>
        <Readout label="Impuls |I| = |Δp|" value={fmt(r.dp, r.dp < 1 ? 3 : 2)} unit="N·s" tone={VIZ.applied} />
        <Readout
          label={
            <span>
              Gjennomsnittskraft F<Sub>gj</Sub>
            </span>
          }
          value={fmt(inUnit(sc, r.Favg), inUnit(sc, r.Favg) < 10 ? 1 : 0)}
          unit={sc.unit}
        />
        <Readout
          label={
            <span>
              Største kraft F<Sub>maks</Sub>
            </span>
          }
          value={fmt(inUnit(sc, r.Fmax), inUnit(sc, r.Fmax) < 10 ? 1 : 0)}
          unit={sc.unit}
          tone={VIZ.applied}
        />
        <Readout
          label={
            <span>
              F<Sub>maks</Sub> tilsvarer tyngden av
            </span>
          }
          value={fmt(r.Fmax / G_EARTH, r.Fmax / G_EARTH < 10 ? 1 : 0)}
          unit="kg"
        />
      </Readouts>

      <Formula label={`Impulsloven (positiv retning ${sc.along})`}>
        <FormulaLine>
          I = Δp = m · v − m · v<Sub>0</Sub> = 0 − {fmt(sc.m, sc.m < 0.1 ? 3 : 2)} kg · {fmt(sc.v, 2)} m/s = −{impulseText(r.dp)}
        </FormulaLine>
        <FormulaLine>
          Minus betyr at impulsen fra {sc.source} er rettet {sc.against}: |I| = {impulseText(r.dp)}
        </FormulaLine>
        <FormulaLine>
          F<Sub>gj</Sub> = |I|/Δt = {impulseText(r.dp)} / {fmt(dtMs / 1000, 4)} s = {forceText(sc, r.Favg)}
        </FormulaLine>
        <FormulaLine>
          F<Sub>maks</Sub> = (π/2) · F<Sub>gj</Sub> = {forceText(sc, r.Fmax)}
        </FormulaLine>
      </Formula>

      <Explain>{explanation(id, sc, r, dtMs, broken)}</Explain>
    </VizLayout>
  );
}

/**
 * Som PlayControls i kit-et, men tida vises i millisekunder. Før avspillingen (og etter «Vis størst kraft») viser
 * scenen og grafen øyeblikket med størst kraft; «Spill av» viser hele støtet i sakte film.
 */
function PlayBar({
  clock,
  active,
  onPlay,
  onReset,
  time,
}: {
  clock: SimClock;
  active: boolean;
  onPlay: () => void;
  onReset: () => void;
  time: ReactNode;
}) {
  return (
    <div className="viz-play">
      <button type="button" className="btn btn-sm" onClick={onPlay} aria-pressed={clock.playing}>
        {clock.playing ? <Pause size={16} aria-hidden /> : <Play size={16} aria-hidden />}
        {clock.playing ? 'Pause' : active ? 'Spill av' : 'Spill av i sakte film'}
      </button>
      <button type="button" className="btn btn-sm btn-ghost" onClick={onReset} disabled={!active}>
        <RotateCcw size={16} aria-hidden />
        Vis størst kraft
      </button>
      <span className="viz-play-time" aria-live="off">
        {time}
      </span>
      {reducedMotion() && <span className="viz-play-note">Animasjoner er redusert i systeminnstillingene.</span>}
    </div>
  );
}

const reducedMotion = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

function ForceGraph({
  sc,
  r,
  dtMs,
  tMs,
  snapshot,
  height,
}: {
  sc: Scenario;
  r: ImpactResult;
  dtMs: number;
  tMs: number;
  snapshot: boolean;
  height: number;
}) {
  const f = useTextScale();
  const xMax = sc.dtMax * 1.1;
  const Fmax = inUnit(sc, r.Fmax);
  const Favg = inUnit(sc, r.Favg);
  const pts = sample((t) => inUnit(sc, pulseForce(r.Fmax, dtMs, t)), 0, dtMs, 160);
  const limit = sc.limit !== undefined ? inUnit(sc, sc.limit) : undefined;
  const st = impactAt(sc.m, sc.v, dtMs / 1000, tMs / 1000);
  const tc = Math.min(tMs, dtMs);
  const done = sample((t) => inUnit(sc, pulseForce(r.Fmax, dtMs, t)), 0, Math.max(tc, 1e-6), 120);
  const Fnow = inUnit(sc, st.F);
  const dec = (v: number) => (v < 10 ? 1 : 0);
  return (
    <Plot
      x={{ min: 0, max: xMax, label: 'Tid t (ms)' }}
      y={{
        min: 0,
        max: sc.yMax,
        label: `Kraft F fra ${sc.source} (${sc.unit})`,
        ticks: sc.yTicks,
      }}
      width={800}
      height={height}
    >
      {({ sx, sy, x1, y1 }) => {
        const gjRight = f < 1.3 && sx(dtMs) + 130 * f < x1;
        const nearLimit = limit !== undefined && Math.abs(sy(Favg) - sy(limit)) < 16 * f;
        const gjY = !nearLimit ? sy(Favg) + 6 : Favg < (limit ?? 0) ? sy(Favg) + 18 * f : sy(Favg) - 7;
        return (
          <g>
            <path
              d={`${linePath(pts, sx, sy)} L ${sx(dtMs)} ${sy(0)} L ${sx(0)} ${sy(0)} Z`}
              fill={VIZ.applied}
              opacity={snapshot ? 0.18 : 0.08}
            />
            {!snapshot && tc > 0 && (
              <path d={`${linePath(done, sx, sy)} L ${sx(tc)} ${sy(0)} L ${sx(0)} ${sy(0)} Z`} fill={VIZ.applied} opacity={0.3} />
            )}
            <rect
              x={sx(0)}
              y={sy(Favg)}
              width={sx(dtMs) - sx(0)}
              height={sy(0) - sy(Favg)}
              fill="none"
              stroke={VIZ.applied}
              strokeWidth={2}
              strokeDasharray="7 6"
            />
            {limit !== undefined && (
              <>
                <line x1={sx(0)} y1={sy(limit)} x2={x1} y2={sy(limit)} className="viz-guide" />
                {/* Over linja når toppen er under grensen (da står F_maks-etiketten under), ellers under linja */}
                <Txt x={x1 - 6} y={Fmax < limit ? sy(limit) - 10 : sy(limit) + 24 * f} anchor="end" size={0.9} muted>
                  egget tåler ca. {fmt(limit, 0)} {sc.unit}
                </Txt>
              </>
            )}
            <path d={linePath(pts, sx, sy)} fill="none" stroke={VIZ.applied} strokeWidth={3.5} strokeLinejoin="round" />
            {/* F_gj til høyre for det stiplete rektangelet når det er plass (ellers står den i forklaringen under grafen), og
                på motsatt side av grenselinja når de to linjene ligger tett */}
            {gjRight && (
              <Txt x={sx(dtMs) + 8} y={gjY} anchor="start" size={0.85} color={VIZ.applied} weight={650}>
                F<TSub>gj</TSub> = {fmt(Favg, dec(Favg))} {sc.unit}
              </Txt>
            )}
            {/* Tidspunktet scenen viser: loddrett strek og prikk på kurven */}
            <line x1={sx(tMs)} y1={sy(0)} x2={sx(tMs)} y2={y1} stroke={VIZ.ink} strokeWidth={1.3} strokeDasharray="3 4" opacity={0.6} />
            <circle cx={sx(tMs)} cy={sy(Fnow)} r={6.5} fill={VIZ.applied} stroke={VIZ.surface} strokeWidth={2.5} />
            <Txt x={sx(dtMs / 2) + 12} y={sy(Fmax) - 12} anchor="start" color={VIZ.applied} weight={700}>
              F<TSub>maks</TSub> = {fmt(Fmax, dec(Fmax))} {sc.unit}
            </Txt>
            {/* Øverst til høyre, men lenger ned når toppen av en kort puls ellers ville kollidert med F_maks-etiketten:
              mellom F_gj-etiketten og grenselinja (eller aksen) */}
            <Txt
              x={x1 - 6}
              y={Fmax > 0.6 * sc.yMax ? Math.max((sy(Favg) + sy(limit ?? 0)) / 2 + 6 * f, sy(Favg) + 6 + 28 * f) : y1 + 22 * f}
              anchor="end"
              weight={650}
            >
              {snapshot || tMs >= dtMs ? <>arealet = |I| = {impulseText(r.dp)}</> : <>arealet så langt = {impulseText(st.I)}</>}
            </Txt>
          </g>
        );
      }}
    </Plot>
  );
}

function explanation(id: ScenarioId, sc: Scenario, r: ImpactResult, dtMs: number, broken: boolean): ReactNode {
  const I = impulseText(r.dp);
  const area = (
    <p>
      Kraften er ikke konstant, men bygges opp og avtar. Det stiplete rektangelet har samme areal, og høyden er gjennomsnittskraften F
      <Sub>gj</Sub> = |Δp|/Δt; toppen av kurven (en halv sinusbue) er π/2 ≈ 1,6 ganger så høy. Spill av støtet i sakte film: arealet
      under grafen fylles opp mens farten avtar, for impulsen så langt er hele tiden lik endringen i bevegelsesmengde.
    </p>
  );
  const sign = (
    <>
      Impulsen er en vektor med samme retning som kraften, altså {sc.against}. Velger vi fartsretningen som positiv, blir Δp = 0 − m · v
      <Sub>0</Sub> = −{I}. Minustegnet viser at impulsen peker motsatt vei av farten, så bevegelsesmengden blir mindre.
    </>
  );
  if (id === 'egg') {
    const surface = SURFACES[surfaceFor(dtMs)];
    return (
      <>
        <p>
          <strong>{broken ? 'Egget knuses.' : 'Egget holder.'}</strong> Egget treffer {surface.indefinite} med {fmt(sc.v, 1)} m/s og stoppes
          helt, så impulsen fra underlaget er like stor uansett underlag: |I| = |Δp| = m · v<Sub>0</Sub> = {I}. Det er arealet under
          F-t-grafen. På {surface.definite} stopper egget på {fmt(dtMs, 1)} ms over s = {fmt(r.stopDist * 100, 1)} cm, og den største
          kraften blir {forceText(sc, r.Fmax)}
          {broken
            ? ` – mer enn egget tåler.${dtMs < 7 ? ' På et hardt gulv er støttiden under 1 ms, og kraften blir enda større.' : ''} Gjør støttiden lengre, så blir kraften mindre for samme areal: med denne modellen holder egget når støttiden er over ca. ${fmt(1000 * dtForFmax(r.dp, sc.limit ?? Infinity), 0)} ms.`
            : '. Et mykt underlag presses lenger sammen, så støttiden blir lang og kraften liten.'}
        </p>
        <p>
          {sign} Tyngden av egget ({fmt(sc.m * G_EARTH, 2)} N) er så liten mot kraften fra underlaget at vi ser bort fra den under
          støtet.
        </p>
        <p>
          Det er derfor du bøyer i knærne når du hopper ned fra noe høyt, og derfor sykkelhjelmer har skum som presses sammen: begge deler
          forlenger støttiden, så den samme impulsen gir mindre kraft.
        </p>
        {area}
      </>
    );
  }
  const cid = catchFor(dtMs);
  return (
    <>
      <p>
        <strong>{CATCHES[cid].name}.</strong> Ballen på {fmt(sc.m * 1000, 0)} g kommer med {fmt(sc.v, 0)} m/s og stoppes helt i
        hendene, så impulsen fra hendene er like stor uansett hvordan keeperen tar imot: |I| = |Δp| = m · v<Sub>0</Sub> = {I}. Med en
        støttid på {fmt(dtMs, 0)} ms bremses ballen over s = {fmt(r.stopDist * 100, 1)} cm, og den største kraften blir{' '}
        {forceText(sc, r.Fmax)}, like stor som tyngden av {fmt(r.Fmax / G_EARTH, 0)} kg.{' '}
        {cid === 'stiv'
          ? 'Med stive armer er det nesten bare ballen og hendene som gir etter, så ballen stopper på en kort strekning. Kraften blir stor, og det svir i hendene.'
          : cid === 'litt'
            ? 'Armene gir litt etter, så ballen bremses over en lengre strekning, og kraften blir mindre.'
            : 'Keeperen møter ballen med strake armer og følger den inn mot brystet, så ballen bremses over en lang strekning, og kraften blir liten.'}
      </p>
      <p>
        {sign} Hendene får like stor kraft fra ballen, motsatt rettet (Newtons 3. lov), og det er den keeperen kjenner. Tyngden av
        ballen virker loddrett, så den endrer ikke den vannrette farten.
      </p>
      <p>
        Det er derfor keepere demper ballen, og derfor du tar imot en hard pasning med myke hender: lengre støttid gir mindre kraft for
        den samme impulsen. Bilbeltet, knusesonen og kollisjonsputa i en bil virker på samme måte (se visualiseringen «Krasjtest»).
      </p>
      {area}
    </>
  );
}
