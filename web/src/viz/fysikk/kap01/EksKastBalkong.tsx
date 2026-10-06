import { useState } from 'react';
import { Figure, Sub, VIZ, WorkedExample, fmt, fmtSci, useTextScale, type ExampleStep, type FigureState } from '../../kit';
import { atGround, ballRadius, ThrowScene, viewTime, type SceneGeometry, type ThrowView } from './eks-kast-balkong-scene';
import { ForceDiagram, PositionGraph, VelocityGraph, graphKind } from './eks-kast-balkong-graf';
import {
  BALCONY_THROW_TASKS,
  BEACH_BALL,
  G,
  equalForceSpeed,
  fmtPercent,
  fmtSig,
  graphAxes,
  positionAt,
  solveBalconyThrow,
  type BalconyThrowSolution,
  type BalconyThrowTask,
} from './model-eks-kast-balkong';
import { useNarrow } from './useNarrow';

type Step = ExampleStep & { view: ThrowView };

/**
 * Eksempeloppgave (1D, 1E): en golfball kastes rett opp fra en balkong og lander på plenen. Oppgaven er laget for
 * appen (egen tekst og egne tall) i samme stil som eksamensoppgaver: toppunktet med den tidløse formelen,
 * andregradslikning for tiden (og hvorfor den negative løsningen forkastes), farten ved plenen og en drøfting av
 * luftmotstanden med L = kv² og en simulering som i 1E.
 */
export default function EksKastBalkong() {
  const [variant, setVariant] = useState(0);
  const task = BALCONY_THROW_TASKS[variant] ?? BALCONY_THROW_TASKS[0]!;
  const sol = solveBalconyThrow(task);
  const steps = buildSteps(task, sol);
  const { name, floor, h0, v0, m } = task;

  return (
    <WorkedExample
      variants={{ labels: ['Tallsett 1', 'Tallsett 2', 'Tallsett 3'], value: variant, onChange: setVariant }}
      intro={
        <>
          <p>
            {name} står på balkongen i {floor}. etasje i en boligblokk og kaster en golfball rett opp. Ballen forlater hånda{' '}
            {fmt(h0, 1)} m over plenen nedenfor, med farten {fmt(v0, 1)} m/s. På vei ned går ballen så vidt klar av balkongen og lander på
            plenen. Golfballen har massen {fmt(m * 1000, 0)} g.
          </p>
          <p>Se bort fra luftmotstanden i a)–c).</p>
        </>
      }
      given={[
        <>
          h<Sub>0</Sub> = {fmt(h0, 1)} m
        </>,
        <>
          v<Sub>0</Sub> = {fmt(v0, 1)} m/s (rett opp)
        </>,
        <>m = {fmt(m * 1000, 0)} g</>,
        <>g = 9,81 m/s²</>,
      ]}
      parts={[
        { id: 'a', text: 'Hvor høyt over plenen kommer ballen?' },
        { id: 'b', text: `Vis at ballen lander på plenen ca. ${fmt(sol.tLand, 1)} s etter at den forlot hånda.` },
        { id: 'c', text: 'Hvor stor fart har ballen når den treffer plenen?' },
        {
          id: 'd',
          text: (
            <>
              Luftmotstanden på golfballen kan skrives L = kv², der k = {fmtSci(task.k, 1)} kg/m. Drøft om det var rimelig å se bort fra
              luftmotstanden i a)–c).
            </>
          ),
        },
      ]}
      steps={steps}
      figure={(state) => <ThrowFigures task={task} sol={sol} state={state} steps={steps} variant={variant} />}
    />
  );
}

/* ---------- Figuren: scenen og grafen ved siden av hverandre (PC) eller under hverandre (mobil) ---------- */

function viewOf(state: FigureState, steps: Step[]): ThrowView {
  if (state.showAll) return 'alle';
  if (state.step === 0) return 'oppgave';
  return steps[state.step - 1]?.view ?? 'oppgave';
}

function ThrowFigures({ task, sol, state, steps, variant }: { task: BalconyThrowTask; sol: BalconyThrowSolution; state: FigureState; steps: Step[]; variant: number }) {
  const { ref, narrow } = useNarrow<HTMLDivElement>();
  const view = viewOf(state, steps);
  return (
    <div ref={ref} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {narrow ? (
        <>
          <Figure viewBox={`0 0 ${NARROW.W} ${NARROW.H}`} label={sceneLabel(task, sol, view)} maxHeight={640}>
            <NarrowScene task={task} sol={sol} view={view} variant={variant} />
          </Figure>
          <Figure viewBox={`0 0 ${NARROW.W} ${NARROW.GH}`} label={graphLabel(task, sol, view)} maxHeight={460}>
            <NarrowGraph task={task} sol={sol} view={view} />
          </Figure>
        </>
      ) : (
        <Figure viewBox={`0 0 ${WIDE.W} ${WIDE.H}`} label={`${sceneLabel(task, sol, view)} ${graphLabel(task, sol, view)}`} maxHeight={560}>
          <WideFigure task={task} sol={sol} view={view} variant={variant} />
        </Figure>
      )}
    </div>
  );
}

const WIDE = { W: 800, H: 480, SW: 416, GX: 424, top: 24, bottom: 64, pathX: 192 };
const NARROW = { W: 440, H: 540, GH: 380, top: 26, bottom: 34, pathX: 222 };

/**
 * y for posisjonen s når s-aksen går fra sMin (bunnen y0) til sMax (toppen y1). Uten `range` brukes aksene i
 * s-t-grafen, så scenen og grafen ved siden av får samme høydeskala (PC).
 */
function verticalMap(task: BalconyThrowTask, sol: BalconyThrowSolution, y1: number, y0: number, range?: [number, number]) {
  const ax = graphAxes(sol, task.h0);
  const [lo, hi] = range ?? [ax.sMin, ax.sMax];
  const p = (y0 - y1) / (hi - lo);
  return { p, sy: (s: number) => y0 - (s - lo) * p };
}

function WideFigure({ task, sol, view, variant }: { task: BalconyThrowTask; sol: BalconyThrowSolution; view: ThrowView; variant: number }) {
  const f = useTextScale();
  const { W, H, SW, GX, top, bottom, pathX } = WIDE;
  const y1 = top;
  const y0 = H - bottom;
  const { p, sy } = verticalMap(task, sol, y1, y0);
  const geo: SceneGeometry = { x: 4, y: 4, w: SW - 4, h: H - 8, p, sy, pathX };
  const kind = graphKind(view);
  const margin = { top: y1, right: 14, bottom: H - y0, left: 64 * f };
  const t = viewTime(task, sol, view);
  const s = atGround(view) ? -task.h0 : positionAt(task, t);
  const ax = graphAxes(sol, task.h0);
  const gx = (tt: number) => GX + margin.left + ((tt - ax.tMin) / (ax.tMax - ax.tMin)) * (W - GX - margin.left - margin.right);
  // Hjelpelinje fra ballen i toppunktet til toppunktet i grafen
  const guide = kind === 'st' && (view === 'topp' || view === 'hoyde' || view === 'alle');
  return (
    <g>
      <ThrowScene task={task} sol={sol} view={view} geo={geo} variant={variant} />
      <g transform={`translate(${GX} 0)`}>
        {kind === 'st' && <PositionGraph task={task} sol={sol} view={view} width={W - GX} height={H} margin={margin} tStep={1} />}
        {kind === 'vt' && <VelocityGraph task={task} sol={sol} view={view} width={W - GX} height={H} margin={margin} tStep={1} />}
        {kind === 'krefter' && <ForceDiagram sol={sol} x={8} y={4} w={W - GX - 8} h={H - 8} />}
      </g>
      {guide && (
        <line
          x1={pathX + ballRadius(1) + 4}
          x2={gx(t) - 8}
          y1={sy(s)}
          y2={sy(s)}
          stroke={VIZ.series[0]}
          strokeWidth={1.5}
          strokeDasharray="3 5"
          opacity={0.75}
        />
      )}
    </g>
  );
}

function NarrowScene({ task, sol, view, variant }: { task: BalconyThrowTask; sol: BalconyThrowSolution; view: ThrowView; variant: number }) {
  const { W, H, top, bottom, pathX } = NARROW;
  // På mobil står scenen for seg, så den får sin egen, litt større skala (mindre plen foran).
  const { p, sy } = verticalMap(task, sol, top, H - bottom, [-task.h0 - 1.2, sol.sTop + 1.1]);
  const geo: SceneGeometry = { x: 4, y: 4, w: W - 8, h: H - 8, p, sy, pathX };
  return <ThrowScene task={task} sol={sol} view={view} geo={geo} variant={variant} />;
}

function NarrowGraph({ task, sol, view }: { task: BalconyThrowTask; sol: BalconyThrowSolution; view: ThrowView }) {
  const f = useTextScale();
  const { W, GH } = NARROW;
  const kind = graphKind(view);
  const tStep = 1;
  // v-t-grafen har bredere akseverdier (−15, −20), så aksetittelen trenger mer plass.
  const margin = { top: 22 * f, right: 12, bottom: 58 * f, left: (kind === 'vt' ? 74 : 60) * f };
  if (kind === 'krefter') return <ForceDiagram sol={sol} x={4} y={4} w={W - 8} h={GH - 8} />;
  if (kind === 'vt') return <VelocityGraph task={task} sol={sol} view={view} width={W} height={GH} margin={margin} tStep={tStep} />;
  // Mer plass under plenen enn på PC: teksten er større i forhold til grafen, og tidsaksen står rett under.
  return <PositionGraph task={task} sol={sol} view={view} width={W} height={GH} margin={margin} tStep={tStep} padBelow={2.2} />;
}

function sceneLabel(task: BalconyThrowTask, sol: BalconyThrowSolution, view: ThrowView): string {
  const start = `${task.name} står på balkongen i ${task.floor}. etasje og kaster en golfball rett opp fra ${fmt(task.h0, 1)} m over plenen med farten ${fmt(task.v0, 1)} m/s.`;
  switch (view) {
    case 'oppgave':
    case 'retning':
      return `${start} Positiv retning er opp, og s = 0 ved hånda.`;
    case 'topp':
    case 'hoyde':
    case 'alle':
      return `${start} Ballen er i toppunktet ${fmtSig(sol.sTop)} m over hånda, ${fmtSig(sol.H)} m over plenen, med farten 0.`;
    case 'likning':
    case 'losninger':
      return `${start} Ballen har landet på plenen, i s = −${fmt(task.h0, 1)} m.`;
    default:
      return `${start} Ballen er like over plenen med farten ${fmtSig(sol.speedLand)} m/s nedover.`;
  }
}

function graphLabel(task: BalconyThrowTask, sol: BalconyThrowSolution, view: ThrowView): string {
  const kind = graphKind(view);
  if (kind === 'krefter')
    return `Kraftdiagram for ballen like før den lander: tyngden ${fmt(sol.weight, 3)} N nedover og luftmotstanden ${fmt(sol.dragMax, 3)} N oppover, ${fmtPercent(sol.dragRatio)} av tyngden.`;
  if (kind === 'vt')
    return `v-t-graf: en rett linje fra ${fmt(task.v0, 1)} m/s ved t = 0 til ${fmt(sol.vLand, 1)} m/s ved t = ${fmtSig(sol.tLand)} s.${view === 'simulering' ? ` Med luftmotstand bøyer kurven av og ender på −${fmtSig(sol.dragSpeed)} m/s.` : ''}`;
  return `s-t-graf: parabelen s = v₀t − ½gt² med toppunkt i ${fmtSig(sol.sTop)} m og plenen i s = −${fmt(task.h0, 1)} m, som parabelen krysser ved t = ${fmtSig(sol.tLand)} s og t = ${fmtSig(sol.tNeg)} s.`;
}

/* ---------- Løsningen ---------- */

function buildSteps(task: BalconyThrowTask, sol: BalconyThrowSolution): Step[] {
  const { name, h0, v0, m, k } = task;
  const q = sol.quad;
  // Hardt mellomrom før enheten, så tall og enhet ikke deles på to linjer på mobil.
  const h = `${fmt(h0, 1)}\u00a0m`;
  const v0s = `${fmt(v0, 1)}\u00a0m/s`;
  const tRounded = Math.round(sol.tLand * 10) / 10;
  const vRounded = v0 - G * tRounded;
  const beach = equalForceSpeed(BEACH_BALL.m, BEACH_BALL.k);
  const golfEqual = equalForceSpeed(m, k);
  const pct = (x: number) => fmtPercent(x);

  return [
    /* ---------- a) ---------- */
    {
      part: 'a',
      view: 'retning',
      title: 'Velg positiv retning og nullpunkt',
      body: (
        <>
          <p>
            Vi velger <strong>positiv retning oppover</strong> og måler posisjonen s fra hånda, der ballen slippes. Da er s = 0 ved hånda, og
            startfarten er positiv.
          </p>
          <p>
            Når ballen har forlatt hånda, er det bare tyngden som virker på den (vi ser bort fra luftmotstanden). Akselerasjonen er derfor −g
            hele tiden: på vei opp, i toppunktet og på vei ned. Den er negativ fordi den peker nedover.
          </p>
        </>
      ),
      math: [
        <>
          v<Sub>0</Sub> = +{v0s}
        </>,
        <>a = −g = −9,81 m/s²</>,
      ],
      pitfall: (
        <>
          Akselerasjonen er ikke null i toppunktet. Der er farten null, men ballen trekkes fortsatt nedover. Var a = 0 der, ville ballen
          blitt hengende i lufta.
        </>
      ),
    },
    {
      part: 'a',
      view: 'topp',
      title: 'Finn hvor høyt over hånda ballen stiger',
      body: (
        <p>
          I toppunktet snur ballen, og der er farten v = 0. Vi kjenner v<Sub>0</Sub>, v og a og skal finne s, men vi kjenner ikke tiden. Da
          passer den tidløse formelen.
        </p>
      ),
      math: [
        <>
          v² − v<Sub>0</Sub>² = 2as ⇒ s = (v² − v<Sub>0</Sub>²) / (2a)
        </>,
        <>
          s<Sub>topp</Sub> = (0 − ({v0s})²) / (2 · (−9,81 m/s²)) = {fmtSig(sol.sTop)} m
        </>,
      ],
      tip: 'Fortegnene sjekker seg selv: både telleren og nevneren er negative, så s blir positiv. Toppunktet er over hånda, og opp er positiv retning.',
    },
    {
      part: 'a',
      view: 'hoyde',
      title: 'Legg til høyden til hånda',
      body: (
        <p>
          s<Sub>topp</Sub> er høyden over hånda. Hånda er h<Sub>0</Sub> = {h} over plenen, så høyden over plenen er summen.
        </p>
      ),
      math: [
        <>
          H = h<Sub>0</Sub> + s<Sub>topp</Sub> = {h} + {fmtSig(sol.sTop)} m = {fmt(sol.H, 2)} m
        </>,
      ],
      answer: <>Ballen kommer {fmtSig(sol.H)} m over plenen.</>,
      pitfall: (
        <>
          Ikke svar {fmtSig(sol.sTop)} m. Det er høyden over hånda, men spørsmålet gjelder høyden over plenen.
        </>
      ),
    },

    /* ---------- b) ---------- */
    {
      part: 'b',
      view: 'likning',
      title: 'Sett opp likningen for når ballen er på plenen',
      body: (
        <p>
          Vi bruker posisjonslikningen s = v<Sub>0</Sub>t + ½at². Plenen er {h} under hånda, og positiv retning er opp, så ballen er på plenen
          når s = −{h}. Vi setter inn tallene og samler alle leddene på én side. Da får vi en andregradslikning i t.
        </p>
      ),
      math: [
        <>
          s = v<Sub>0</Sub>t + ½at²
        </>,
        <>
          −{fmt(h0, 1)} = {fmt(v0, 1)}t + ½ · (−9,81)t²
        </>,
        <>
          {fmt(q.a, 3)}t² − {fmt(v0, 1)}t − {fmt(h0, 1)} = 0
        </>,
      ],
      pitfall: (
        <>
          s er forflytningen fra hånda, ikke strekningen ballen går. Ballen går {fmtSig(sol.sTop)} m opp og {fmtSig(sol.H)} m ned, men
          forflytningen er −{h}. Setter du s = +{h}, spør du når ballen er {h} over hånda, og den likningen har ingen løsning.
        </>
      ),
    },
    {
      part: 'b',
      view: 'losninger',
      title: 'Løs andregradslikningen og velg riktig løsning',
      body: (
        <>
          <p>
            Vi bruker abc-formelen med a = {fmt(q.a, 3)}, b = −{fmt(v0, 1)} og c = −{fmt(h0, 1)}. Her er a, b og c tallene i likningen, ikke
            akselerasjonen.
          </p>
          <p>
            Likningen har to løsninger fordi parabelen s(t) krysser linja s = −{h} to ganger (se grafen). Den negative løsningen er et
            tidspunkt før {name} kastet ballen. Likningen «vet» ikke at bevegelsen startet ved t = 0, så den løsningen forkaster vi.
          </p>
        </>
      ),
      math: [
        // Linjene med rottegn er rene strenger, så WorkedExample kan vise √ med vanlig skrift (som i FormulaLine).
        't = (−b ± √(b² − 4ac)) / (2a)',
        <>
          b² − 4ac = {fmt(v0, 1)}² − 4 · {fmt(q.a, 3)} · (−{fmt(h0, 1)}) = {fmt(q.disc, 1)}
        </>,
        `t = (${fmt(v0, 1)} ± √${fmt(q.disc, 1)}) / (2 · ${fmt(q.a, 3)}) = (${fmt(v0, 1)} ± ${fmt(q.root, 2)}) / ${fmt(2 * q.a, 2)}`,
        <>
          t = {fmt(sol.tLand, 3)} s eller t = {fmt(sol.tNeg, 3)} s
        </>,
      ],
      answer: (
        <>
          t = {fmtSig(sol.tLand)} s ≈ {fmt(sol.tLand, 1)} s, som vi skulle vise. Den negative løsningen er før kastet og forkastes.
        </>
      ),
      tip: (
        <>
          Kontroller med to enklere steg: opp til toppunktet tar v<Sub>0</Sub>/g = {fmtSig(sol.tTop)} s, og fritt fall fra {fmtSig(sol.H)} m
          tar √(2H/g) = {fmtSig(sol.tFall)} s. Til sammen {fmtSig(sol.tTop + sol.tFall)} s.
        </>
      ),
    },

    /* ---------- c) ---------- */
    {
      part: 'c',
      view: 'fart',
      title: 'Bruk fartslikningen',
      body: (
        <p>
          Nå kjenner vi tiden fra b). Akselerasjonen er konstant, så farten endrer seg like mye hvert sekund: v = v<Sub>0</Sub> + at. I
          v-t-grafen er det en rett linje med stigningstall −9,81 m/s². Vi bruker den uavrundede tiden.
        </p>
      ),
      math: [
        <>
          v = v<Sub>0</Sub> + at = {v0s} + (−9,81 m/s²) · {fmt(sol.tLand, 3)} s = {fmt(sol.vLand, 2)} m/s
        </>,
      ],
      pitfall: (
        <>
          Bruker du den avrundede tiden {fmt(tRounded, 1)} s, får du {fmt(vRounded, 1)} m/s. Regn alltid videre med uavrundede mellomsvar.
        </>
      ),
    },
    {
      part: 'c',
      view: 'kontroll',
      title: 'Kontroller med den tidløse formelen',
      body: (
        <p>
          Vi kan også finne farten uten tiden. Fra hånda til plenen er forflytningen s = −{h}, og a = −9,81 m/s². Begge er negative, så
          produktet 2as blir positivt: ballen får mer fart på vei ned.
        </p>
      ),
      math: [
        <>
          v² = v<Sub>0</Sub>² + 2as = ({v0s})² + 2 · (−9,81 m/s²) · (−{h})
        </>,
        <>v² = {fmt(sol.vSquared, 1)} m²/s²</>,
        `|v| = √(${fmt(sol.vSquared, 1)} m²/s²)`,
        <>|v| = {fmt(sol.speedLand, 2)} m/s</>,
      ],
      answer: (
        <>
          Ballen treffer plenen med farten {fmtSig(sol.speedLand)} m/s ({fmt(sol.speedLandKmh, 0)} km/h). Farten er rettet nedover, og
          derfor er v = {fmt(sol.vLand, 1)} m/s negativ.
        </>
      ),
      tip: (
        <>
          Ballen passerer hånda på vei ned med {v0s}, like fort som den ble kastet opp (se grafen). Uten luftmotstand er bevegelsen
          symmetrisk om toppunktet.
        </>
      ),
    },

    /* ---------- d) ---------- */
    {
      part: 'd',
      view: 'krefter',
      title: 'Når er luftmotstanden størst?',
      body: (
        <p>
          Luftmotstanden L = kv² vokser med kvadratet av farten. Den er null i toppunktet og størst når farten er størst, like før ballen
          lander. Der sammenligner vi den med tyngden, som er like stor hele tiden. Vi bruker farten fra c) som overslag.
        </p>
      ),
      math: [
        <>
          G = mg = {fmt(m, 3)} kg · 9,81 m/s² = {fmt(sol.weight, 3)} N
        </>,
        <>
          L = kv² = {fmtSci(k, 1)} kg/m · ({fmt(sol.speedLand, 2)} m/s)² = {fmt(sol.dragMax, 3)} N
        </>,
        <>
          L / G = {fmt(sol.dragMax, 3)} N / {fmt(sol.weight, 3)} N = {fmt(sol.dragRatio, 3)} = {pct(sol.dragRatio)}
        </>,
      ],
      pitfall:
        'Luftmotstanden er ikke konstant. Den endrer seg med farten, så du må si hvilket tidspunkt du ser på. Her bruker vi det verste tilfellet: den største farten.',
    },
    {
      part: 'd',
      view: 'simulering',
      title: 'Hvor mye endrer luftmotstanden svarene?',
      body: (
        <>
          <p>
            Luftmotstanden virker alltid mot fartsretningen. På vei opp peker den nedover, som tyngden, så ballen bremser raskere og kommer
            ikke like høyt. På vei ned peker den oppover, mot tyngden, så ballen får mindre fart. Tiden i lufta endres nesten ikke: ballen
            bruker litt kortere tid opp og litt lengre tid ned.
          </p>
          <p>
            Hvor mye, kan vi finne med en simulering som i 1E: Eulers metode med a = −g − (k/m) · v · |v| og Δt = 0,001{' '}s. Leddet
            v · |v| har samme størrelse som v², men fortegnet til v, så luftmotstanden alltid peker mot farten. v-t-grafen er da ikke lenger
            en rett linje, fordi akselerasjonen endrer seg med farten.
          </p>
        </>
      ),
      math: [
        <>
          H = {fmtSig(sol.dragH)} m (uten luftmotstand {fmtSig(sol.H)} m), {pct(sol.dragChangeH)} lavere
        </>,
        <>
          |v| = {fmtSig(sol.dragSpeed)} m/s (uten luftmotstand {fmtSig(sol.speedLand)} m/s), {pct(sol.dragChangeSpeed)} mindre
        </>,
        <>
          t = {fmt(sol.drag.tLand, 3)} s (uten luftmotstand {fmt(sol.tLand, 3)} s)
        </>,
      ],
      answer: (
        <>
          Ja, det var rimelig. Golfballen er liten og tung i forhold til størrelsen, og farten er moderat, så luftmotstanden er høyst {pct(sol.dragRatio)}{' '}
          av tyngden, og bare like før ballen lander. Svarene i a) og c) blir litt for store, men bare noen få prosent.
        </>
      ),
      tip: (
        <>
          For en lett og stor ball er det annerledes. For en badeball er L like stor som G allerede ved ca. {fmt(beach, 0)} m/s, mens
          golfballen må opp i ca. {fmt(golfEqual, 0)} m/s. Kaster du en badeball fra balkongen, kan du ikke se bort fra luftmotstanden.
        </>
      ),
    },
  ];
}

