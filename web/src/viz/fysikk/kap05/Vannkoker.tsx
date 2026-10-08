import { useEffect, useState, type ReactNode } from 'react';
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
  Slider,
  Sub,
  Toggle,
  Toolbar,
  VIZ,
  VizLayout,
  fmt,
  useSimClock,
} from '../../kit';
import {
  BOILING_POINT,
  C_WATER,
  KETTLE,
  boilRun,
  heatState,
  idealBoilTime,
  minSec,
  potHeater,
  timeAxisEnd,
  toKWh,
  waterMass,
  type BoilRun,
  type HeatState,
} from './model-vannkoker';
import { useNarrow } from './marks';
import { EnergyBars, TempGraph, barsHeight, type EnergyRow, type GraphLine } from './vannkoker-graf';
import { KETTLE_COLOR, KitchenScene, LOSS_COLOR, POT_COLOR, P_MAX, SCENE_NARROW, SCENE_WIDE, WATER_COLOR } from './vannkoker-scene';

/** Hvor mange sekunder avspillingen varer, uansett hvor lang tid oppkokingen tar. */
const PLAY_SECONDS = 10;

const minSecText = (t: number) => {
  const { min, s } = minSec(t);
  return min > 0 ? `${min} min ${s} s` : `${s} s`;
};

export default function VannkokerViz() {
  const [P, setP] = useState(2000);
  const [liters, setLiters] = useState(1);
  const [T0, setT0] = useState(10);
  const [compare, setCompare] = useState(true);
  const [lid, setLid] = useState(false);
  const [sceneRef, narrow] = useNarrow<HTMLDivElement>();

  const input = { P, liters, T0 };
  const m = waterMass(liters);
  const k = boilRun(input, KETTLE);
  const p = compare ? boilRun(input, potHeater(lid)) : null;
  const tIdeal = idealBoilTime(input);
  const tEnd = timeAxisEnd(Math.max(k.t, p?.t ?? 0));

  const clock = usePlayClock(tEnd);
  const t = Math.min(clock.t, tEnd);
  const kState = heatState(P, k.heater.eta, m, T0, t);
  const pState = p ? heatState(P, p.heater.eta, m, T0, t) : null;
  const anim = (t / tEnd) * PLAY_SECONDS;

  const lay = narrow ? SCENE_NARROW : SCENE_WIDE;
  const lines: GraphLine[] = [{ run: k, state: kState, color: KETTLE_COLOR }];
  if (p && pState) lines.push({ run: p, state: pState, color: POT_COLOR });
  const rows: EnergyRow[] = [{ name: 'Vannkoker', short: 'Vannkoker', color: KETTLE_COLOR, run: k, state: kState }];
  if (p && pState) rows.push({ name: 'Kasserolle', short: 'Kasserolle', color: POT_COLOR, run: p, state: pState });

  return (
    <VizLayout>
      <Controls>
        <Slider label="Effekt P" value={P} onChange={setP} min={500} max={P_MAX} step={100} unit="W" />
        <Slider label="Vannmengde V" value={liters} onChange={setLiters} min={0.25} max={1.75} step={0.05} unit="L" decimals={2} />
        <Slider label={<>Starttemperatur T<Sub>0</Sub></>} ariaLabel="Starttemperatur T0" value={T0} onChange={setT0} min={0} max={90} step={1} unit="°C" />
      </Controls>
      <Toolbar>
        <PlayControls clock={clock} decimals={0} />
        <Toggle label="Sammenlign med kokeplate" checked={compare} onChange={setCompare} />
        {compare && <Toggle label="Lokk på kasserollen" checked={lid} onChange={setLid} />}
      </Toolbar>

      <div ref={sceneRef}>
        <Figure
          viewBox={`0 0 ${lay.W} ${lay.H}`}
          label={sceneLabel(liters, T0, P, t, k, kState, p, pState)}
          maxHeight={narrow ? 560 : 470}
        >
          <KitchenScene
            lay={lay}
            kettle={{ run: k, state: kState }}
            pot={p && pState ? { run: p, state: pState } : null}
            P={P}
            liters={liters}
            lid={lid}
            anim={anim}
          />
        </Figure>
      </div>

      <GraphFigure narrow={narrow} T0={T0} lines={lines} tIdeal={tIdeal} tEnd={tEnd} t={t} />
      <Legend
        items={[
          { color: KETTLE_COLOR, label: `Vannkoker, η = ${fmt(k.heater.eta * 100, 0)} %` },
          ...(p ? [{ color: POT_COLOR, label: `Kasserolle ${lid ? 'med' : 'uten'} lokk, η = ${fmt(p.heater.eta * 100, 0)} %` }] : []),
          { color: VIZ.muted, label: 'Uten varmetap, η = 100 %', dashed: true },
        ]}
      />

      <EnergyFigure narrow={narrow} rows={rows} t={t} />
      <Legend
        items={[
          { color: WATER_COLOR, label: 'Varme til vannet Q' },
          { color: LOSS_COLOR, label: 'Varmetap til kjøkkenet' },
          { color: VIZ.muted, label: 'Elektrisk energi E = P · t til vannet koker', dashed: true },
        ]}
      />

      <Readouts>
        <Readout label="Vannet trenger Q = c · m · ΔT" value={fmt(k.Q / 1000, k.Q < 1e5 ? 1 : 0)} unit="kJ" tone={WATER_COLOR} />
        <Readout label="Vannkokeren koker etter" value={fmt(k.t, 0)} unit="s" tone={KETTLE_COLOR} />
        {p && <Readout label="Kasserollen koker etter" value={fmt(p.t, 0)} unit="s" tone={POT_COLOR} />}
        <Readout label="Uten varmetap ville det tatt" value={fmt(tIdeal, 0)} unit="s" />
      </Readouts>

      <Formula label="Energien vannet trenger, og tiden det tar">
        <FormulaLine>
          Q = c · m · ΔT = {fmt(C_WATER, 0)}&nbsp;J/(kg·K) · {fmt(m, 2)}&nbsp;kg · ({fmt(BOILING_POINT, 0)} − {fmt(T0, 0)})&nbsp;K = {fmt(k.Q, 0)}&nbsp;J
        </FormulaLine>
        <FormulaLine>
          η · P · t = Q &nbsp;⇒&nbsp; t = Q / (η · P)
        </FormulaLine>
        <FormulaLine>
          Vannkoker: t = {fmt(k.Q, 0)}&nbsp;J / ({fmt(k.heater.eta, 2)} · {fmt(P, 0)}&nbsp;W) = {fmt(k.t, 0)}&nbsp;s
        </FormulaLine>
        {p && (
          <FormulaLine>
            Kasserolle: t = {fmt(p.Q, 0)}&nbsp;J / ({fmt(p.heater.eta, 2)} · {fmt(P, 0)}&nbsp;W) = {fmt(p.t, 0)}&nbsp;s
          </FormulaLine>
        )}
        <FormulaLine>
          Strøm til vannkokeren: E = P · t = {fmt(P, 0)}&nbsp;W · {fmt(k.t, 0)}&nbsp;s = {fmt(k.E / 1000, 0)}&nbsp;kJ = {fmt(toKWh(k.E), 3)}&nbsp;kWh
        </FormulaLine>
      </Formula>

      <Explain>{explanation({ P, liters, T0, lid, t, k, kState, p, pState })}</Explain>
    </VizLayout>
  );
}

/** Klokka: avspillingen varer like lenge uansett oppkokingstid, og starter midt i oppvarmingen. */
function usePlayClock(tEnd: number) {
  const clock = useSimClock({ tMax: tEnd, speed: tEnd / PLAY_SECONDS });
  const { setT } = clock;
  // Start etter 160 s: vannkokeren er nesten ferdig, og kasserollen henger etter (standardverdiene).
  useEffect(() => setT(160), [setT]);
  // Kortere oppkoking enn tiden som er spilt av: hopp til slutten, så tidsvisningen stemmer.
  const over = clock.t > tEnd;
  useEffect(() => {
    if (over) setT(tEnd);
  }, [over, tEnd, setT]);
  return clock;
}

function GraphFigure({ narrow, T0, lines, tIdeal, tEnd, t }: { narrow: boolean; T0: number; lines: GraphLine[]; tIdeal: number; tEnd: number; t: number }) {
  const W = narrow ? 560 : 800;
  const H = narrow ? 400 : 330;
  return (
    <Figure
      viewBox={`0 0 ${W} ${H}`}
      label={`Temperaturen i vannet som funksjon av tiden. ${lines.map((l) => `${l.run.heater.name} koker etter ${fmt(l.run.t, 0)} s`).join('. ')}. Uten varmetap ville det tatt ${fmt(tIdeal, 0)} s.`}
      maxHeight={narrow ? 460 : 380}
    >
      <TempGraph T0={T0} lines={lines} tIdeal={tIdeal} tEnd={tEnd} t={t} width={W} height={H} />
    </Figure>
  );
}

function EnergyFigure({ narrow, rows, t }: { narrow: boolean; rows: EnergyRow[]; t: number }) {
  const W = narrow ? 560 : 800;
  return (
    <Figure
      viewBox={`0 0 ${W} ${energyHeight(rows.length, narrow)}`}
      label={`Energiregnskap etter ${fmt(t, 0)} s: ${rows
        .map((r) => `${r.name.toLowerCase()} har brukt ${fmt(r.state.E / 1000, 0)} kJ, ${fmt(r.state.Q / 1000, 0)} kJ til vannet og ${fmt(r.state.loss / 1000, 0)} kJ varmetap`)
        .join('; ')}.`}
      maxHeight={narrow ? 340 : 270}
    >
      <EnergyBars rows={rows} lay={{ W, stacked: narrow }} t={t} />
    </Figure>
  );
}

/** Høyden på energifiguren (tekstskaleringen er ukjent før figuren er tegnet; smal figur regner med 1,25). */
function energyHeight(n: number, narrow: boolean): number {
  return barsHeight(n, narrow, narrow ? 1.25 : 1);
}

function sceneLabel(liters: number, T0: number, P: number, t: number, k: BoilRun, ks: HeatState, p: BoilRun | null, ps: HeatState | null): string {
  const base = `Kjøkkenbenk. ${fmt(liters, 2)} L vann fra ${fmt(T0, 0)} °C varmes med ${fmt(P, 0)} W. Etter ${fmt(t, 0)} s er vannet i vannkokeren ${fmt(ks.T, 0)} °C`;
  if (!p || !ps) return `${base}. Vannkokeren koker etter ${fmt(k.t, 0)} s.`;
  return `${base}, og i kasserollen på kokeplata ${fmt(ps.T, 0)} °C. Vannkokeren koker etter ${fmt(k.t, 0)} s, kasserollen etter ${fmt(p.t, 0)} s.`;
}

/* ---------- Forklaring ---------- */

interface ExplainInput {
  P: number;
  liters: number;
  T0: number;
  lid: boolean;
  t: number;
  k: BoilRun;
  kState: HeatState;
  p: BoilRun | null;
  pState: HeatState | null;
}

function explanation({ P, liters, T0, lid, t, k, kState, p, pState }: ExplainInput): ReactNode {
  const m = waterMass(liters);
  const kJ = (j: number) => `${fmt(j / 1000, j < 1e5 ? 1 : 0)} kJ`;
  const W = (w: number) => `${fmt(w, 0)} W`;
  const s = (sec: number) => `${fmt(sec, 0)} s`;
  const ek = fmt(k.heater.eta * 100, 0);

  const intro = (
    <p>
      <strong>Energien vannet trenger, er den samme uansett apparat.</strong> For å varme {fmt(liters, 2)}&nbsp;L vann ({fmt(m, 2)}&nbsp;kg) fra{' '}
      {fmt(T0, 0)}&nbsp;°C til 100&nbsp;°C trengs Q = c · m · ΔT = {kJ(k.Q)}. Effekten P = {W(P)} betyr at apparatet får {fmt(P, 0)}&nbsp;J
      elektrisk energi hvert sekund, men bare en del av den, virkningsgraden η, havner i vannet. Derfor blir tiden t = Q / (η · P).
    </p>
  );

  let race: ReactNode;
  if (!p || !pState) {
    race = kState.done ? (
      <p>
        Vannkokeren slo seg av etter {s(k.t)} ({minSecText(k.t)}). Den brukte E = P · t = {kJ(k.E)} strøm, og av det gikk {kJ(k.Q)} ({ek}&nbsp;%) til
        vannet. De siste {kJ(k.loss)} varmet opp selve vannkokeren og lufta rundt.
      </p>
    ) : (
      <p>
        Etter {s(t)} har vannkokeren fått {kJ(kState.E)} elektrisk energi. {ek}&nbsp;% av den, {kJ(kState.Q)}, er gått til vannet, som nå er{' '}
        {fmt(kState.T, 0)}&nbsp;°C. Temperaturen stiger like mye hvert sekund ({fmt(k.rate, 2)}&nbsp;°C/s), så grafen er en rett linje. Slå på
        sammenligningen for å se hvordan det går med en kasserolle på kokeplata.
      </p>
    );
  } else if (t <= 0) {
    race = (
      <p>
        Begge er nettopp slått på, med samme effekt og like mye vann. Trykk «Spill av» og se hvem som koker først.
      </p>
    );
  } else if (!kState.done) {
    race = (
      <p>
        Begge får like mye elektrisk energi hvert sekund, {W(P)}. I vannkokeren går {W(k.usefulPower)} inn i vannet, men i kasserollen bare{' '}
        {W(p.usefulPower)}. Derfor er vannkokeren allerede kommet til {fmt(kState.T, 0)}&nbsp;°C, mens kasserollen er på {fmt(pState.T, 0)}&nbsp;°C. Resten,{' '}
        {W(k.lossPower)} og {W(p.lossPower)}, er varmetap: de bølgete pilene.
      </p>
    );
  } else if (!pState.done) {
    race = (
      <p>
        Vannkokeren slo seg av etter {s(k.t)} ({minSecText(k.t)}). Kasserollen har fått akkurat like mye strøm, E = P · t = {kJ(pState.E)}, men vannet er bare{' '}
        {fmt(pState.T, 0)}&nbsp;°C. Av energien er bare {kJ(pState.Q)} gått til vannet, og {kJ(pState.loss)} er tapt. Den trenger {s(p.t - t)} til.
      </p>
    );
  } else {
    race = (
      <p>
        Kasserollen kokte etter {s(p.t)} ({minSecText(p.t)}), {s(p.t - k.t)} senere enn vannkokeren, og brukte {kJ(p.E - k.E)} mer strøm: {kJ(p.E)} mot {kJ(k.E)}. Varmen til vannet var den
        samme, {kJ(k.Q)}. Forskjellen er varmetapet: {kJ(p.loss)} fra kasserollen og plata mot {kJ(k.loss)} fra vannkokeren.
      </p>
    );
  }

  const why = p ? (
    <p>
      <strong>Hvorfor taper kasserollen mer?</strong> I vannkokeren sitter varmeelementet i bunnen, i direkte kontakt med vannet, og veggene holder på
      varmen. På kokeplata må varmen først varme opp selve plata og kasserollen, og den varme plata og sidene på kasserollen gir fra seg mye varme til
      lufta. {lid ? 'Lokket holder på varm damp og luft, så mindre varme slipper ut, og virkningsgraden blir høyere.' : 'Slå på lokket: da slipper mindre varm damp og luft ut, og kasserollen koker raskere.'}
    </p>
  ) : null;

  const tips: ReactNode[] = [];
  tips.push(
    P <= 1500 ? (
      <>
        Mer effekt gir ikke varmere vann, for vannet koker ved 100&nbsp;°C uansett. Effekten avgjør bare hvor fort energien kommer inn: med{' '}
        {W(2 * P)} ville vannkokeren brukt halve tiden, {s(k.t / 2)}.
      </>
    ) : (
      <>
        Mer effekt gir ikke varmere vann, for vannet koker ved 100&nbsp;°C uansett. Effekten avgjør bare hvor fort energien kommer inn: med {W(P / 2)} ville
        vannkokeren brukt dobbelt så lang tid, {s(2 * k.t)}.
      </>
    ),
  );
  if (liters >= 0.75) {
    const cup = boilRun({ P, liters: 0.25, T0 }, KETTLE);
    tips.push(
      <>
        Kok bare så mye vann som du trenger: én kopp (0,25&nbsp;L) tar {s(cup.t)} og {kJ(cup.E)} med vannkokeren, mot {s(k.t)} og {kJ(k.E)} for{' '}
        {fmt(liters, 2)}&nbsp;L. Både tiden og energien er proporsjonale med massen.
      </>,
    );
  } else {
    tips.push(<>Med lite vann går det fort: tiden og energien er proporsjonale med massen, så dobbelt så mye vann tar dobbelt så lang tid.</>);
  }
  if (T0 >= 40) tips.push(<>Vannet starter varmt, så ΔT er bare {fmt(100 - T0, 0)}&nbsp;K, og det trengs mindre energi.</>);
  tips.push(
    <>
      Varmetapet forsvinner ikke: energien varmer opp lufta og tingene på kjøkkenet (energien er bevart). Den er bare ikke nyttig for oss, og derfor er
      virkningsgraden under 100&nbsp;%.
    </>,
  );

  return (
    <>
      {intro}
      {race}
      {why}
      <ul>
        {tips.map((tip, i) => (
          <li key={i}>{tip}</li>
        ))}
      </ul>
    </>
  );
}
