import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  Controls,
  Explain,
  Figure,
  Formula,
  FormulaLine,
  Legend,
  PlayControls,
  Readout,
  Readouts,
  Segmented,
  Slider,
  Sub,
  Toolbar,
  VIZ,
  VizLayout,
  fmt,
  useSimClock,
  useTextScale,
} from '../../kit';
import { FESTER, FESTE_MU, FESTE_NAVN, FESTE_TEKST, lagFor, tugPeaks, tugPlan, tugState, type Feste, type Lag, type TugPlan, type TugState } from './model-tautrekking';
import { Kraftregnskap, fN } from './tautrekking-regnskap';
import { H, PX_PER_M, S_END, TugScene, W, restGeometry, type TugView } from './tautrekking-scene';
import { useNarrow } from './useNarrow';

/**
 * Tautrekking og Newtons 3. lov (2B–2E). To lag drar i et tau. Tauet drar like hardt i begge lagene (3. lov, og tauet
 * er lett), så det som avgjør, er friksjonen fra bakken på føttene: R ≤ μs · mg. Eleven velger masse og underlag for
 * hvert lag, spiller av dragkampen (lagene drar hardere og hardere til det ene laget glipper) og ser kreftene på hvert
 * lag, kraftparene og hele systemet. Målet er å rydde opp i at «den sterkeste drar hardest i tauet».
 */

const VIEWS: { value: TugView; label: string }[] = [
  { value: 'lag', label: 'Krefter på lagene' },
  { value: 'par', label: 'Kraftparene' },
  { value: 'system', label: 'Hele systemet' },
];

const M_MIN = 60;
const M_MAX = 240;
/** Tidspunktet figuren viser før avspilling: i dragkampen like før noen glipper (glippet skjer ved 2,5 s). */
const T_START = 2.2;
/** Største kraftskala (px/N), så små krefter på is ikke blir altfor lange piler. */
const K_MAX = 0.8;

const NB = '\u00a0';
/** Utsnittet på mobil (før lagene flytter seg). */
const NARROW_X = 100;
const NARROW_W = 600;

export default function Tautrekking() {
  const [view, setView] = useState<TugView>('lag');
  const [mA, setMA] = useState(120);
  const [mB, setMB] = useState(180);
  const [festeA, setFesteA] = useState<Feste>('gress');
  const [festeB, setFesteB] = useState<Feste>('is');

  const A = useMemo(() => lagFor(mA, festeA), [mA, festeA]);
  const B = useMemo(() => lagFor(mB, festeB), [mB, festeB]);
  const plan = useMemo(() => tugPlan(A, B, { sEnd: S_END }), [A, B]);
  const peaks = useMemo(() => tugPeaks(A, B, plan), [A, B, plan]);
  const clock = useSimClock({ tMax: plan.tEnd });

  const { t, setT } = clock;
  // Figuren starter i dragkampen like før noen glipper, så den gir mening uten avspilling.
  useLayoutEffect(() => setT(T_START), [setT]);
  // Nye lag kan gi en kortere dragkamp: hold tiden innenfor.
  useEffect(() => {
    if (t > plan.tEnd) setT(plan.tEnd);
  }, [t, plan.tEnd, setT]);

  // Første «Spill av» starter dragkampen fra begynnelsen (figuren står ellers like før glippet).
  const fresh = useRef(true);
  const playClock = {
    ...clock,
    toggle: () => {
      if (fresh.current && !clock.playing) clock.setT(0);
      fresh.current = false;
      clock.toggle();
    },
  };

  const state = tugState(A, B, plan, t);
  const moving = state.phase === 'glir' || state.phase === 'ferdig';

  return (
    <VizLayout>
      <Toolbar>
        <Segmented label="Velg hvilke krefter som vises" options={VIEWS} value={view} onChange={setView} />
      </Toolbar>
      <Toolbar>
        <span className="viz-slider-label">Lag A står på</span>
        <Segmented label="Underlag for lag A" options={FESTER.map((v) => ({ value: v, label: FESTE_NAVN[v] }))} value={festeA} onChange={setFesteA} />
      </Toolbar>
      <Toolbar>
        <span className="viz-slider-label">Lag B står på</span>
        <Segmented label="Underlag for lag B" options={FESTER.map((v) => ({ value: v, label: FESTE_NAVN[v] }))} value={festeB} onChange={setFesteB} />
      </Toolbar>
      <Controls>
        <Slider
          label={
            <>
              Masse lag A, m<Sub>A</Sub>
            </>
          }
          ariaLabel="Masse lag A"
          value={mA}
          onChange={setMA}
          min={M_MIN}
          max={M_MAX}
          step={5}
          unit="kg"
        />
        <Slider
          label={
            <>
              Masse lag B, m<Sub>B</Sub>
            </>
          }
          ariaLabel="Masse lag B"
          value={mB}
          onChange={setMB}
          min={M_MIN}
          max={M_MAX}
          step={5}
          unit="kg"
        />
        <Slider
          label="Tid t"
          value={t}
          onChange={(v) => {
            fresh.current = false;
            clock.pause();
            setT(v);
          }}
          min={0}
          // Et helt antall steg (ellers er maks ikke en gyldig verdi), og minst tEnd, så slutten kan nås.
          max={Math.ceil(plan.tEnd * 100 - 1e-6) / 100}
          step={0.01}
          format={(v) => `${fmt(v, 2)}${NB}s`}
        />
      </Controls>
      <Toolbar>
        <PlayControls clock={playClock} />
      </Toolbar>

      <SceneFigure mA={mA} mB={mB} festeA={festeA} festeB={festeB} plan={plan} state={state} view={view} peaks={peaks} />
      <Kraftregnskap mA={mA} mB={mB} festeA={festeA} festeB={festeB} plan={plan} state={state} peak={Math.max(peaks.S, peaks.R)} />
      <Legend
        items={[
          { color: VIZ.tension, label: view === 'par' ? 'S: tauet på laget · S′: laget på tauet' : 'Snordrag S: tauet på laget' },
          { color: VIZ.friction, label: view === 'par' ? 'R: bakken på laget · R′: laget på bakken' : 'Friksjon R: bakken på laget' },
          { color: VIZ.friction, label: 'Største statiske friksjon μs·mg', dashed: true },
          ...(moving ? [{ color: VIZ.acceleration, label: 'Akselerasjon a og kraftsum ΣF' }] : []),
        ]}
      />

      <Readouts>
        <Readout label="Snordrag S (på begge lag)" value={fN(state.S)} unit="N" tone={VIZ.tension} />
        <Readout
          label={
            <>
              Friksjon på lag A, R<Sub>A</Sub>
            </>
          }
          value={fN(state.RA)}
          unit="N"
          tone={VIZ.friction}
        />
        <Readout
          label={
            <>
              Friksjon på lag B, R<Sub>B</Sub>
            </>
          }
          value={fN(state.RB)}
          unit="N"
          tone={VIZ.friction}
        />
        <Readout label="Akselerasjon a" value={fmt(Math.abs(state.a), 2)} unit="m/s²" tone={VIZ.acceleration} />
      </Readouts>

      <Formula label="Utregning">{formulaLines(A, B, festeA, festeB, plan, state)}</Formula>

      <Explain>{explanation({ mA, mB, festeA, festeB, plan, state, view })}</Explain>
    </VizLayout>
  );
}

/* ---------- Scenen i en figur ---------- */

interface SceneFigureProps {
  mA: number;
  mB: number;
  festeA: Feste;
  festeB: Feste;
  plan: TugPlan;
  state: TugState;
  view: TugView;
  peaks: { S: number; R: number; Rsum: number };
}

function SceneFigure(props: SceneFigureProps) {
  const { mA, mB, festeA, festeB, state } = props;
  const [ref, narrow] = useNarrow<HTMLDivElement>();
  // På mobil et smalere utsnitt rundt lagene (så personene blir store nok), som følger tauet når lagene flytter seg.
  const box = narrow ? { x: NARROW_X + state.x * PX_PER_M, y: 30, w: NARROW_W, h: H - 30 } : { x: 0, y: 64, w: W, h: H - 64 };
  return (
    <div ref={ref}>
      <Figure
        viewBox={`${box.x} ${box.y} ${box.w} ${box.h}`}
        label={`Tautrekking. Lag A (${fmt(mA, 0)} kg) står ${FESTE_TEKST[festeA]} til venstre, lag B (${fmt(mB, 0)} kg) står ${FESTE_TEKST[festeB]} til høyre. Snordraget er ${fN(state.S)} N, friksjonen fra bakken er ${fN(state.RA)} N på lag A og ${fN(state.RB)} N på lag B.`}
        maxHeight={520}
      >
        <ScaledScene {...props} box={box} narrow={narrow} />
      </Figure>
    </div>
  );
}

/** Velger kraftskalaen (px/N) ut fra plassen i figuren og de største kreftene i hele dragkampen. */
function ScaledScene(props: SceneFigureProps & { box: { x: number; y: number; w: number; h: number }; narrow: boolean }) {
  const f = useTextScale();
  const { mA, mB, plan, peaks, narrow } = props;
  const geo = useMemo(() => restGeometry(mA, mB), [mA, mB]);
  const label = 16 + 40 * f;
  // R-pilene går utover fra den fremste foten. På PC flytter vinnerlaget seg `out` utover før dragkampen er slutt;
  // på mobil følger utsnittet lagene, så plassen er den samme hele tiden.
  const out = narrow ? 0 : S_END * PX_PER_M;
  const left = narrow ? NARROW_X : 0;
  const right = narrow ? NARROW_X + NARROW_W : W;
  const roomA = geo.leadA - left - label - (plan.winner === 'A' ? out : 0);
  const roomB = right - geo.leadB - label - (plan.winner === 'B' ? out : 0);
  const candidates = [
    K_MAX,
    // S-pilene fra de to grepene møtes ikke på midten
    (geo.gripGap - 26) / (2 * Math.max(peaks.S, 1e-9)),
    Math.min(roomA, roomB) / Math.max(peaks.R, 1e-9),
    // R′-pilene fra de to fremste føttene (i «Kraftparene») møtes ikke
    (geo.leadGap - 26) / Math.max(peaks.Rsum, 1e-9),
  ];
  const k = Math.max(0.01, Math.min(...candidates));
  return <TugScene {...props} k={k} />;
}

/* ---------- Utregningen ---------- */

function formulaLines(A: Lag, B: Lag, festeA: Feste, festeB: Feste, plan: TugPlan, s: TugState): ReactNode {
  const lines: ReactNode[] = [
    <FormulaLine key="a">
      R<Sub>A,maks</Sub> = μ<Sub>s</Sub>m<Sub>A</Sub>g = {fmt(FESTE_MU[festeA].muS, 2)} · {fmt(A.m, 0)}
      {NB}kg · 9,81{NB}m/s² = {fN(plan.RmaxA)}
      {NB}N
    </FormulaLine>,
    <FormulaLine key="b">
      R<Sub>B,maks</Sub> = μ<Sub>s</Sub>m<Sub>B</Sub>g = {fmt(FESTE_MU[festeB].muS, 2)} · {fmt(B.m, 0)}
      {NB}kg · 9,81{NB}m/s² = {fN(plan.RmaxB)}
      {NB}N
    </FormulaLine>,
  ];
  if (s.phase === 'glir' || s.phase === 'ferdig') {
    const L = plan.loser!;
    const Wn = plan.winner!;
    const mL = L === 'A' ? A.m : B.m;
    const muK = FESTE_MU[L === 'A' ? festeA : festeB].muK;
    const RL = L === 'A' ? s.RA : s.RB;
    const RW = Wn === 'A' ? s.RA : s.RB;
    const a = Math.abs(s.a);
    lines.push(
      <FormulaLine key="l">
        Lag {L} glir: R<Sub>{L}</Sub> = μ<Sub>k</Sub>m<Sub>{L}</Sub>g = {fmt(muK, 2)} · {fmt(mL, 0)}
        {NB}kg · 9,81{NB}m/s² = {fN(RL)}
        {NB}N
      </FormulaLine>,
      <FormulaLine key="sys">
        Hele systemet: a = (R<Sub>{Wn}</Sub> − R<Sub>{L}</Sub>)/(m<Sub>A</Sub> + m<Sub>B</Sub>) = ({fN(RW)}
        {NB}N − {fN(RL)}
        {NB}N)/{fmt(A.m + B.m, 0)}
        {NB}kg = {fmt(a, 2)}
        {NB}m/s²
      </FormulaLine>,
      <FormulaLine key="s">
        Lag {L} alene: S = R<Sub>{L}</Sub> + m<Sub>{L}</Sub>a = {fN(RL)}
        {NB}N + {fmt(mL, 0)}
        {NB}kg · {fmt(a, 2)}
        {NB}m/s² = {fN(s.S)}
        {NB}N
      </FormulaLine>,
    );
  } else if (s.phase === 'klar') {
    lines.push(<FormulaLine key="k">Ingen drar ennå: S = 0 og R = 0</FormulaLine>);
  } else {
    lines.push(
      <FormulaLine key="d">
        Ingen glir: R<Sub>A</Sub> = R<Sub>B</Sub> = S = {fN(s.S)}
        {NB}N, så ΣF = 0 på hvert lag
      </FormulaLine>,
    );
  }
  return lines;
}

/* ---------- Forklaringen ---------- */

interface ExplainProps {
  mA: number;
  mB: number;
  festeA: Feste;
  festeB: Feste;
  plan: TugPlan;
  state: TugState;
  view: TugView;
}

function explanation({ mA, mB, festeA, festeB, plan, state, view }: ExplainProps): ReactNode {
  const { S, RA, RB } = state;
  const W = plan.winner;
  const L = plan.loser;
  const RmaxL = L === 'A' ? plan.RmaxA : plan.RmaxB;
  const RmaxW = W === 'A' ? plan.RmaxA : plan.RmaxB;
  const muW = FESTE_MU[W === 'A' ? festeA : festeB].muS;
  const muL = FESTE_MU[L === 'A' ? festeA : festeB].muS;
  const feste = (side: 'A' | 'B') => FESTE_TEKST[side === 'A' ? festeA : festeB];
  const heavier = mA > mB ? 'A' : mB > mA ? 'B' : null;

  let lead: ReactNode;
  switch (state.phase) {
    case 'klar':
      lead = (
        <p>
          <strong>Lagene står klare.</strong> Ingen drar ennå, så tauet drar ikke i noen, og bakken trenger ikke å holde igjen: S = 0 og R = 0.
          Trykk «Spill av» for å se lagene dra hardere og hardere, eller dra i glidebryteren for tiden.
        </p>
      );
      break;
    case 'drar':
      lead = (
        <p>
          <strong>Ingen glir ennå.</strong> Tauet drar like hardt i begge lagene, S = {fN(S)} N. Hvert lag står i ro fordi bakken holder igjen
          med like stor friksjon, R<Sub>A</Sub> = R<Sub>B</Sub> = S, så kraftsummen på hvert lag er null (Newtons 1. lov). Men friksjonen kan
          ikke bli hvor stor som helst: lag A kan få høyst {fN(plan.RmaxA)} N fra bakken, lag B bare {fN(plan.RmaxB)} N.{' '}
          {L ? (
            <>
              Når S når {fN(RmaxL)} N, glipper lag {L}.
            </>
          ) : (
            <>Grensene er like store, så ingen av lagene glipper før det andre.</>
          )}{' '}
          Se også hvordan lagene lener seg bakover: jo hardere tauet drar, jo mer må de lene seg for ikke å bli dratt forover.
          {(festeA === 'is' || festeB === 'is') &&
            ' På is kan de nesten ikke lene seg: friksjonen er for liten til å holde igjen, så beina ville glidd fram.'}
        </p>
      );
      break;
    case 'uavgjort':
      lead = (
        <p>
          <strong>Uavgjort.</strong> Lagene har nøyaktig like godt feste: μ<Sub>s</Sub>mg = {fN(plan.RmaxA)} N for begge. Tauet drar nå så hardt
          som festet tillater, S = {fN(S)} N, men ingen av lagene får mer friksjon fra bakken enn det andre, så ingen flytter seg. I en ekte
          dragkamp er det den minste forskjell i masse, sko eller teknikk som avgjør.
        </p>
      );
      break;
    case 'glir':
      lead = (
        <p>
          <strong>Lag {L} glipper.</strong> Draget ble større enn den største statiske friksjonen lag {L} kan få, {fN(RmaxL)} N. Nå glir
          føttene, og friksjonen faller til glidefriksjonen, {fN(L === 'A' ? RA : RB)} N. Lag {W} står støtt og går baklengs, og bakken skyver
          på lag {W} med {fN(W === 'A' ? RA : RB)} N. Kraftsummen på hele systemet peker mot lag {W}, så alt akselererer den veien med a ={' '}
          {fmt(Math.abs(state.a), 2)} m/s². Legg merke til at tauet fortsatt drar like hardt i begge lagene, S = {fN(S)} N, også nå. Lag {W}{' '}
          drar ikke hardere i tauet enn lag {L}, men bakken skyver hardere på lag {W}.
        </p>
      );
      break;
    case 'ferdig':
      lead = (
        <p>
          <strong>Lag {W} vant</strong>
          {heavier === L ? `, selv om lag ${L} er ${fmt(Math.abs(mA - mB), 0)} kg tyngre` : heavier === W ? ', og det er også det tyngste laget' : ''}.
          Lag {L} står {feste(L!)} og kan få høyst {fN(RmaxL)} N fra bakken, mens lag {W} står {feste(W!)} og kan få {fN(RmaxW)} N.{' '}
          {heavier === L
            ? `Lag ${L} har kanskje sterkere armer, men det hjelper ikke når beina glir: laget kan aldri dra hardere enn bakken holder igjen.`
            : heavier === W
              ? muW > muL
                ? `Lag ${W} har både størst masse og best feste.`
                : muW === muL
                  ? `Lagene har like godt feste, så det tyngste laget får mest friksjon fra bakken.`
                  : `Lag ${W} har dårligere feste, men så mye større masse at μsmg likevel blir størst.`
              : 'Lagene er like tunge, så det er festet som avgjør.'}
        </p>
      );
      break;
  }

  let detail: ReactNode;
  if (view === 'par') {
    detail = (
      <p>
        <strong>Kraftparene.</strong> Tauet drar lag A mot midten (S), og lag A drar tauet bakover like hardt (S′). Bakken skyver lag A bakover
        (R<Sub>A</Sub>), og lag A skyver bakken mot midten (R′<Sub>A</Sub>). Det samme gjelder lag B. Kreftene i et par er like store, motsatt
        rettet og virker på hver sin gjenstand, så de opphever ikke hverandre. Tauet er så lett at kraftsummen på det er null: lag A og lag B
        drar like hardt i tauet, hele tiden. Det er feil at laget som vinner, drar hardest i tauet.
      </p>
    );
  } else if (view === 'system') {
    detail = (
      <p>
        <strong>Hele systemet.</strong> Når begge lagene og tauet er ett system, er S en indre kraft: tauet drar lag A mot høyre og lag B mot
        venstre like hardt, så de to kreftene opphever hverandre i kraftsummen. Bare friksjonen fra bakken er ytre kraft: ΣF = R<Sub>A</Sub> −
        R<Sub>B</Sub> = {fN(RA)} N − {fN(RB)} N = {fN(Math.abs(RA - RB))} N{Math.abs(RA - RB) > 0.05 ? ` mot lag ${RA > RB ? 'A' : 'B'}` : ''}.
        Det er derfor bakken, ikke tauet, avgjør hvem som vinner.
      </p>
    );
  } else {
    detail = (
      <p>
        <strong>Kreftene på hvert lag.</strong> Langs bakken virker to krefter på et lag: S fra tauet mot midten og friksjonen R fra bakken
        bakover. Tyngden G og normalkraften N er ikke tegnet: de er like store og motsatt rettet. Men N = mg bestemmer hvor stor friksjonen kan
        bli, R ≤ μ<Sub>s</Sub>N = μ<Sub>s</Sub>mg. Derfor vinner laget med størst μ<Sub>s</Sub>mg, altså stor masse og godt feste, og ikke laget
        med sterkest armer: tauet drar alltid like hardt i begge lagene.
      </p>
    );
  }
  return (
    <>
      {lead}
      {detail}
    </>
  );
}


