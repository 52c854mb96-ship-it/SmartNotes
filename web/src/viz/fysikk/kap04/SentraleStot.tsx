import { useMemo, useState, type ReactNode } from 'react';
import {
  Controls,
  Explain,
  Figure,
  Formula,
  FormulaLine,
  G_EARTH,
  Legend,
  PlayControls,
  Readout,
  Readouts,
  Segmented,
  Slider,
  Sub,
  TSub,
  Toggle,
  Toolbar,
  VIZ,
  VizLayout,
  fmt,
  useSimClock,
} from '../../kit';
import { elasticityForLossShare, maxLoss, type CollisionResult } from './model';
import { planRun, playDuration, playback, rateAt, runAt, simTimeAt, type Bumper, type RunSpec } from './model-sentrale-stot';
import { StotPanel, barDecimals } from './sentrale-stot-diagram';
import { StotScene, cartReach, sceneLayout, useSceneFrame } from './sentrale-stot-scene';
import { useNarrow } from './useNarrow';

type Kind = 'elastisk' | 'uelastisk' | 'fullstendig';

const KINDS: { value: Kind; label: string }[] = [
  { value: 'elastisk', label: 'Elastisk' },
  { value: 'uelastisk', label: 'Uelastisk' },
  { value: 'fullstendig', label: 'Fullstendig uelastisk' },
];

/** Støtfangeren som gir hver type støt: fjær, gummidemper eller borrelås. */
const BUMPER: Record<Kind, Bumper> = { elastisk: 'fjaer', uelastisk: 'gummi', fullstendig: 'borrelaas' };
const BUMPER_TEXT: Record<Kind, string> = { elastisk: 'fjær', uelastisk: 'gummidempere', fullstendig: 'borrelås' };

/** Fargene til vogn 1 og 2 i diagrammet (samme fargetone som lakken på vognene i scenen). */
const C1 = VIZ.series[0] ?? VIZ.velocity;
const C2 = VIZ.series[1] ?? VIZ.gravity;

interface State {
  m1: number;
  m2: number;
  v1: number;
  v2: number;
  kind: Kind;
  share: number;
}

export default function SentraleStot() {
  const [s, setS] = useState<State>({ m1: 1, m2: 2, v1: 2, v2: 0, kind: 'elastisk', share: 0.5 });
  const [showForces, setShowForces] = useState(true);
  const set = (patch: Partial<State>) => setS((prev) => ({ ...prev, ...patch }));
  const [sceneRef, frame] = useSceneFrame<HTMLDivElement>();
  const [barsRef, narrow] = useNarrow<HTMLDivElement>();
  const layout = sceneLayout(frame.f, frame.narrow);

  const e = s.kind === 'elastisk' ? 1 : s.kind === 'fullstendig' ? 0 : elasticityForLossShare(s.share);
  const bumper = BUMPER[s.kind];
  const spec: RunSpec = useMemo(
    () => ({
      m1: s.m1,
      v1: s.v1,
      m2: s.m2,
      v2: s.v2,
      e,
      bumper,
      length: layout.length,
      w1: cartReach(bumper),
      w2: cartReach(bumper),
      margin: 0.03,
    }),
    [s.m1, s.v1, s.m2, s.v2, e, bumper, layout.length],
  );
  const run = useMemo(() => planRun(spec), [spec]);
  const r = run.result;
  const pb = useMemo(() => playback(run), [run]);

  // Avspillingen går i sakte film når farten er stor, og enda saktere rundt selve støtet. Klokka teller hvor langt
  // vi er kommet i avspillingen (0–1), så vi beholder stedet når tallene endres, og simTimeAt gir tiden i forsøket.
  const duration = playDuration(pb, run);
  const clock = useSimClock({ tMax: 1, speed: 1 / duration });
  const u = Math.min(1, Math.max(0, clock.t));
  const t = simTimeAt(pb, run, u * duration);
  /** Klokka slik PlayControls viser den: tiden i forsøket. */
  const shown = { ...clock, t };
  const rate = rateAt(pb, t);
  const st = runAt(spec, run, t);
  const slowFactor = clock.playing && rate < 0.95 ? 1 / rate : null;
  const Fpeak = peakForce(spec, run);
  const Gsum = (s.m1 + s.m2) * G_EARTH;

  const lossPct = r.EkBefore > 0 ? (100 * r.lost) / r.EkBefore : 0;
  // Flere desimaler når energiene er små (lave farter), så tallene ikke rundes til 0,01 J.
  const eDec = r.EkBefore < 0.1 ? 3 : 2;
  const active = !r.collides ? null : st.phase === 'for' ? 0 : st.phase === 'etter' ? 1 : null;

  return (
    <VizLayout>
      <Controls>
        <Slider
          label={
            <>
              Masse m<Sub>1</Sub>
            </>
          }
          ariaLabel="Masse til vogn 1"
          value={s.m1}
          onChange={(m1) => set({ m1 })}
          min={0.5}
          max={5}
          step={0.1}
          unit="kg"
          decimals={1}
        />
        <Slider
          label={
            <>
              Fart v<Sub>1</Sub>
            </>
          }
          ariaLabel="Fart til vogn 1"
          value={s.v1}
          onChange={(v1) => set({ v1 })}
          min={-3}
          max={3}
          step={0.1}
          unit="m/s"
          decimals={1}
        />
        <Slider
          label={
            <>
              Masse m<Sub>2</Sub>
            </>
          }
          ariaLabel="Masse til vogn 2"
          value={s.m2}
          onChange={(m2) => set({ m2 })}
          min={0.5}
          max={5}
          step={0.1}
          unit="kg"
          decimals={1}
        />
        <Slider
          label={
            <>
              Fart v<Sub>2</Sub>
            </>
          }
          ariaLabel="Fart til vogn 2"
          value={s.v2}
          onChange={(v2) => set({ v2 })}
          min={-3}
          max={3}
          step={0.1}
          unit="m/s"
          decimals={1}
        />
        {s.kind === 'uelastisk' && (
          <Slider
            label="Energitap i støtet"
            ariaLabel="Hvor stor del av det størst mulige energitapet som går tapt"
            value={s.share}
            onChange={(share) => set({ share })}
            min={0.05}
            max={0.95}
            step={0.05}
            format={() => `${fmt(lossPct, 0)} %`}
          />
        )}
        <Slider
          label="Tidspunkt"
          ariaLabel="Tidspunkt i forsøket, med sakte film rundt støtet"
          value={u}
          onChange={(v) => {
            clock.pause();
            clock.setT(v);
          }}
          min={0}
          max={1}
          step={0.002}
          format={() => `${fmt(t, 3)} s`}
        />
      </Controls>
      <Toolbar>
        <Segmented label="Velg type støt" options={KINDS} value={s.kind} onChange={(kind) => set({ kind })} />
        <Toggle label="Vis krefter" checked={showForces} onChange={setShowForces} />
        <PlayControls clock={shown} decimals={3} />
      </Toolbar>

      <div ref={sceneRef}>
        <Figure viewBox={`0 0 800 ${layout.H}`} label={sceneLabel(s, r)} maxHeight={440}>
          <StotScene spec={spec} run={run} t={t} layout={layout} showForces={showForces} slowFactor={slowFactor} />
        </Figure>
      </div>

      <div ref={barsRef}>
        <Figure
          viewBox={`0 0 800 ${narrow ? 2 * BARS_STACKED : BARS_WIDE}`}
          label="Søylediagram over bevegelsesmengde og kinetisk energi før og etter støtet, for vogn 1, vogn 2 og summen"
          maxHeight={narrow ? 640 : 360}
        >
          <Bars s={s} r={r} stacked={narrow} active={active} />
        </Figure>
      </div>
      <Legend
        items={[
          { color: C1, label: 'Vogn 1 (blå)' },
          { color: C2, label: 'Vogn 2 (oransje)' },
          { color: VIZ.ink, label: 'Sum for begge (Σ)' },
          { color: VIZ.ink, dashed: true, label: 'Summen før støtet' },
        ]}
      />

      <Readouts>
        <Readout
          label={
            <span>
              Fart etter, v<Sub>1</Sub>′
            </span>
          }
          value={fmt(r.u1, 2)}
          unit="m/s"
          tone={C1}
        />
        <Readout
          label={
            <span>
              Fart etter, v<Sub>2</Sub>′
            </span>
          }
          value={fmt(r.u2, 2)}
          unit="m/s"
          tone={C2}
        />
        <Readout label="Σp før = Σp etter" value={fmt(r.pBefore, 2)} unit="kg·m/s" />
        <Readout
          label={
            <span>
              Tap av E<Sub>k</Sub>
            </span>
          }
          value={fmt(r.lost, eDec)}
          unit={`J (${fmt(lossPct, 0)} %)`}
        />
      </Readouts>

      <Formula label="Bevaring av bevegelsesmengde">
        <FormulaLine>
          Før: m<Sub>1</Sub>v<Sub>1</Sub> + m<Sub>2</Sub>v<Sub>2</Sub> = {fmt(s.m1, 1)} kg · {speed2(s.v1)} + {fmt(s.m2, 1)} kg ·{' '}
          {speed2(s.v2)} = {fmt(r.pBefore, 2)} kg·m/s
        </FormulaLine>
        <FormulaLine>
          Etter: m<Sub>1</Sub>v<Sub>1</Sub>′ + m<Sub>2</Sub>v<Sub>2</Sub>′ = {fmt(s.m1, 1)} kg · {speed2(r.u1)} + {fmt(s.m2, 1)} kg ·{' '}
          {speed2(r.u2)} = {fmt(r.pAfter, 2)} kg·m/s
        </FormulaLine>
        <FormulaLine>
          E<Sub>k</Sub> før = {fmt(r.EkBefore, eDec)} J, E<Sub>k</Sub> etter = {fmt(r.EkAfter, eDec)} J
        </FormulaLine>
      </Formula>

      <Explain>
        {explanation(s, r, lossPct)}
        {r.collides && showForces && (
          <p>
            <strong>Kraftparet under støtet.</strong> Mens støtfangerne er presset sammen, dytter vogn 2 på vogn 1 med kraften F
            <Sub>1</Sub>, og vogn 1 dytter like hardt tilbake på vogn 2 med F<Sub>2</Sub> = −F<Sub>1</Sub> (Newtons 3. lov). Kreftene virker
            like lenge, så impulsene er like store og motsatt rettet: Δp<Sub>1</Sub> = −Δp<Sub>2</Sub>. Det vogn 1 mister av
            bevegelsesmengde, får vogn 2, og Σp endrer seg ikke, heller ikke midt i støtet. Dra «Tidspunkt» sakte gjennom støtet (eller
            spill av) og se på Σp øverst i figuren. I modellen varer støtet ca. {fmt(run.tau * 1000, 0)} ms, og den største kraften blir ca.{' '}
            {fmt(Fpeak, 0)} N
            {Fpeak > 2 * Gsum ? `, mye større enn tyngden av begge vognene til sammen (${fmt(Gsum, 0)} N)` : ''}.
          </p>
        )}
      </Explain>
    </VizLayout>
  );
}

/** Høyden på søylediagrammet: to paneler ved siden av hverandre, eller over hverandre på mobil. */
const BARS_WIDE = 310;
const BARS_STACKED = 380;

/** Største kraft mellom vognene i støtet (N): toppen av den halve sinusbuen, F_maks = (π/2) · J/τ. */
function peakForce(spec: RunSpec, run: { tau: number; result: CollisionResult }): number {
  if (!run.result.collides || !(run.tau > 0)) return 0;
  return (Math.PI / 2) * ((spec.m1 * (spec.v1 - run.result.u1)) / run.tau);
}

/** Fart i en utregning: negative tall i parentes, «1,0 kg · (−0,67 m/s)». */
function speed2(v: number): string {
  const t = `${fmt(v, 2)} m/s`;
  return v < -0.005 ? `(${t})` : t;
}

function sceneLabel(s: State, r: CollisionResult): string {
  return `To dynamikkvogner på en bane med målebånd i fysikklaben, med ${BUMPER_TEXT[s.kind]} der de møtes. Vogn 1 (blå): ${fmt(s.m1, 1)} kg med ${fmt(s.v1, 1)} m/s. Vogn 2 (oransje): ${fmt(s.m2, 1)} kg med ${fmt(s.v2, 1)} m/s. ${
    r.collides
      ? `Etter støtet: v₁′ = ${fmt(r.u1, 2)} m/s og v₂′ = ${fmt(r.u2, 2)} m/s.`
      : 'Vognene treffer ikke hverandre.'
  }`;
}

function Bars({ s, r, stacked, active }: { s: State; r: CollisionResult; stacked: boolean; active: number | null }) {
  const ek = (m: number, v: number) => 0.5 * m * v * v;
  const pVals = [s.m1 * s.v1, s.m2 * s.v2, s.m1 * r.u1, s.m2 * r.u2, r.pBefore];
  // På mobil står panelene over hverandre i full bredde, ellers ved siden av hverandre.
  const height = stacked ? BARS_STACKED : BARS_WIDE;
  const width = stacked ? 800 : 392;
  return (
    <>
      <StotPanel
        x={0}
        width={width}
        height={height}
        maxBar={stacked ? 84 : 50}
        decimals={barDecimals(pVals)}
        level={r.pBefore}
        active={active}
        title={<>Bevegelsesmengde p (kg·m/s)</>}
        groups={[
          {
            label: 'Før',
            bars: [
              { value: s.m1 * s.v1, color: C1, name: '1' },
              { value: s.m2 * s.v2, color: C2, name: '2' },
              { value: r.pBefore, color: VIZ.ink, name: 'Σ', sum: true },
            ],
          },
          {
            label: 'Etter',
            bars: [
              { value: s.m1 * r.u1, color: C1, name: '1' },
              { value: s.m2 * r.u2, color: C2, name: '2' },
              { value: r.pAfter, color: VIZ.ink, name: 'Σ', sum: true },
            ],
          },
        ]}
      />
      {stacked ? (
        <line x1={16} y1={height} x2={784} y2={height} stroke={VIZ.grid} strokeWidth={2} />
      ) : (
        <line x1={400} y1={16} x2={400} y2={height - 16} stroke={VIZ.grid} strokeWidth={2} />
      )}
      <g transform={stacked ? `translate(0 ${height})` : undefined}>
        <StotPanel
          x={stacked ? 0 : 408}
          width={width}
          height={height}
          maxBar={stacked ? 84 : 50}
          decimals={barDecimals([r.EkBefore])}
          level={r.EkBefore}
          active={active}
          title={
            <>
              Kinetisk energi E<TSub>k</TSub> (J)
            </>
          }
          groups={[
            {
              label: 'Før',
              bars: [
                { value: ek(s.m1, s.v1), color: C1, name: '1' },
                { value: ek(s.m2, s.v2), color: C2, name: '2' },
                { value: r.EkBefore, color: VIZ.ink, name: 'Σ', sum: true },
              ],
            },
            {
              label: 'Etter',
              bars: [
                { value: ek(s.m1, r.u1), color: C1, name: '1' },
                { value: ek(s.m2, r.u2), color: C2, name: '2' },
                { value: r.EkAfter, color: VIZ.ink, name: 'Σ', sum: true, ghost: r.EkBefore },
              ],
            },
          ]}
        />
      </g>
    </>
  );
}

function explanation(s: State, r: CollisionResult, lossPct: number): ReactNode {
  const p = `${fmt(r.pBefore, 2)} kg·m/s`;
  const eDec = r.EkBefore < 0.1 ? 3 : 2;
  const vector =
    s.v1 < 0 || s.v2 < 0 || r.u1 < -1e-9 || r.u2 < -1e-9
      ? ' Husk at p er en vektor: fart mot venstre regnes negativ, og da er også bevegelsesmengden negativ.'
      : '';
  const isolated = (
    <>
      {' '}
      Banen er vannrett og nesten uten friksjon, så tyngden og normalkraften opphever hverandre: summen av de ytre kreftene er null, og
      da er Σp bevart.
    </>
  );
  if (!r.collides)
    return (
      <p>
        <strong>Ingen støt.</strong>{' '}
        {Math.abs(s.v1 - s.v2) < 1e-9 ? (
          <>
            Vognene har samme fart, v<Sub>1</Sub> = v<Sub>2</Sub>, så avstanden mellom dem holder seg den samme, og vogn 1 tar aldri igjen
            vogn 2.
          </>
        ) : (
          <>
            Vogn 1 tar aldri igjen vogn 2 fordi v<Sub>1</Sub> &lt; v<Sub>2</Sub>, så avstanden mellom dem bare øker.
          </>
        )}{' '}
        Gjør v<Sub>1</Sub> større enn v<Sub>2</Sub>, for eksempel ved å la vogn 2 kjøre mot venstre. Uten støt virker ingen krefter mellom
        vognene, og hver vogn beholder sin egen bevegelsesmengde.
      </p>
    );
  if (s.kind === 'elastisk') {
    const swap = Math.abs(s.m1 - s.m2) < 1e-9;
    const atRest = Math.abs(s.v2) < 1e-9;
    const bounce = atRest && s.m1 < s.m2;
    const kick = atRest && s.m1 > s.m2;
    return (
      <>
        <p>
          <strong>Elastisk støt.</strong> Fjærene presses sammen og skyver vognene fra hverandre igjen, og nesten ingen energi går tapt.
          Både bevegelsesmengden og den kinetiske energien er bevart: Σp = {p} og E<Sub>k</Sub> = {fmt(r.EkBefore, eDec)} J både før og
          etter. Midt i støtet er en del av energien lagret i fjærene, så ΣE<Sub>k</Sub> er lavere en kort stund.{isolated}
          {vector}
        </p>
        <p>
          {swap
            ? 'Med like masser bytter vognene fart. Det er derfor støtkula i biljard kan stoppe helt når den treffer en annen kule rett forfra.'
            : bounce
              ? 'Vogn 1 er lettest, så den spretter tilbake, mens vogn 2 får fart framover. Det er derfor en lett ball spretter tilbake når den treffer en tung ball som ligger stille.'
              : kick
                ? 'Vogn 1 er tyngst og fortsetter framover, og den lette vogn 2 får større fart enn vogn 1 hadde. Det er derfor en golfkølle, som er mye tyngre enn ballen, kan sende ballen av sted med større fart enn køllehodet har.'
                : 'Farten etter finner vi ved å bruke begge bevaringslovene sammen.'}
        </p>
      </>
    );
  }
  if (s.kind === 'uelastisk')
    return (
      <>
        <p>
          <strong>Uelastisk støt.</strong> Gummidemperne presses sammen og retter seg bare delvis ut igjen. Bevegelsesmengden er bevart, Σp
          = {p}, men {fmt(r.lost, eDec)} J ({fmt(lossPct, 0)} %) av den kinetiske energien går over til andre energiformer, mest indre
          energi: gummien blir deformert og litt varmere, og noe blir lyd. Σp er alltid bevart i et støt fordi kreftene mellom vognene er
          indre krefter, men E<Sub>k</Sub> er bare bevart i elastiske støt.{isolated}
          {vector}
        </p>
        <p>
          De fleste støt i hverdagen er slik: en fotball som blir sparket, to biler som støter sammen i lav fart, eller en ball som spretter
          lavere for hvert sprett.
        </p>
      </>
    );
  const allLost = Math.abs(r.pBefore) < 1e-9;
  return (
    <>
      <p>
        <strong>Fullstendig uelastisk støt.</strong> Borrelåsen gjør at vognene henger sammen og får felles fart v′ = (m<Sub>1</Sub>v
        <Sub>1</Sub> + m<Sub>2</Sub>v<Sub>2</Sub>)/(m<Sub>1</Sub> + m<Sub>2</Sub>) = {fmt(r.u1, 2)} m/s. Det gir størst mulig tap av
        kinetisk energi: {fmt(maxLoss(s.m1, s.v1, s.m2, s.v2), eDec)} J ({fmt(lossPct, 0)} %).
        {allLost ? ' Her er Σp = 0, så vognene stopper helt, og all den kinetiske energien går over til andre energiformer.' : ''}
        {vector}
      </p>
      <p>
        Det er slik ulykkesgranskere regner seg bakover etter en kollisjon der bilene hang sammen: farten rett etter finner de fra
        bremsesporene, og bevaring av bevegelsesmengde gir farten bilene hadde før.
      </p>
    </>
  );
}
