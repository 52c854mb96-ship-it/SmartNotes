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
  Segmented,
  Slider,
  Toggle,
  Toolbar,
  VIZ,
  VizLayout,
  fmt,
  useSimClock,
} from '../../kit';
import { MATERIALS, heating, timeToReach, type MaterialId } from './model';
import { useNarrow } from './marks';
import { HEAT_COLOR, HeatScene, SCENE_NARROW, SCENE_WIDE, type StationView } from './varmekapasitet-figur';
import { T0, TempGraph, type Run } from './varmekapasitet-graf';

const OPTIONS: { value: MaterialId; label: string }[] = (Object.keys(MATERIALS) as MaterialId[]).map((id) => ({
  value: id,
  label: MATERIALS[id].name,
}));
/** Fargene på de to stoffene (skiltene i scenen, linjene i grafen). Oransje er energien Q. */
const COLORS = [VIZ.series[0], VIZ.series[3]] as const;

function niceCeil(v: number): number {
  if (!(v > 0)) return 1;
  const mag = 10 ** Math.floor(Math.log10(v));
  for (const c of [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10]) if (c * mag >= v - 1e-9) return c * mag;
  return 10 * mag;
}

export default function Varmekapasitet() {
  const [idA, setIdA] = useState<MaterialId>('vann');
  const [idB, setIdB] = useState<MaterialId>('aluminium');
  const [P, setP] = useState(1000);
  const [m, setM] = useState(1);
  const [T1, setT1] = useState(60);
  const [showEnergy, setShowEnergy] = useState(true);
  const [graphRef, narrow] = useNarrow<HTMLDivElement>();
  const [sceneRef, sceneNarrow] = useNarrow<HTMLDivElement>();

  const runs: Run[] = [idA, idB].map((id, i) => {
    const mat = MATERIALS[id];
    return {
      mat,
      color: COLORS[i]!,
      tDone: timeToReach(mat, m, P, T0, T1),
      tBoil: mat.boil !== undefined ? timeToReach(mat, m, P, T0, mat.boil) : Infinity,
    };
  });
  // Tidsaksen: til den siste er ferdig, eller lenge nok til å se at en kokende væske står stille
  const ends = runs.map((r) => (Number.isFinite(r.tDone) ? r.tDone : 1.6 * r.tBoil));
  const tEnd = niceCeil(Math.max(...ends) * 1.04);

  const speed = tEnd / 8;
  const clock = useSimClock({ tMax: tEnd, speed });
  const { setT } = clock;
  useEffect(() => setT(60), [setT]);
  // Kortere forsøk enn tiden som er spilt av: hopp til slutten, så tidsvisningen stemmer
  const over = clock.t > tEnd;
  useEffect(() => {
    if (over) setT(tEnd);
  }, [over, tEnd, setT]);
  const t = Math.min(clock.t, tEnd);
  const graphH = narrow ? 440 : 340;
  const lay = sceneNarrow ? SCENE_NARROW : SCENE_WIDE;

  const stations = runs.map(
    (r): StationView => ({
      mat: r.mat,
      color: r.color,
      state: heating(r.mat, m, P, T0, Math.min(t, r.tDone)),
      on: t < r.tDone,
      tDone: r.tDone,
    }),
  ) as [StationView, StationView];

  return (
    <VizLayout>
      <Controls>
        <Slider label="Effekt P" value={P} onChange={setP} min={100} max={2000} step={50} unit="W" />
        <Slider label="Masse m" value={m} onChange={setM} min={0.1} max={2} step={0.05} unit="kg" decimals={2} />
        <Slider label="Varm opp til" value={T1} onChange={setT1} min={30} max={100} step={1} unit="°C" />
      </Controls>
      <div className="viz-toolbar">
        <span className="viz-slider-label">Stoff 1</span>
        <Segmented label="Velg stoff 1" options={OPTIONS} value={idA} onChange={setIdA} />
      </div>
      <div className="viz-toolbar">
        <span className="viz-slider-label">Stoff 2</span>
        <Segmented label="Velg stoff 2" options={OPTIONS} value={idB} onChange={setIdB} />
      </div>
      <Toolbar>
        <PlayControls clock={clock} decimals={0} />
        <Toggle label="Vis energi" checked={showEnergy} onChange={setShowEnergy} />
      </Toolbar>

      <div ref={sceneRef}>
        <Figure
          viewBox={`0 0 ${lay.W} ${lay.H}`}
          label={`To like kokeplater på en labbenk, begge på ${fmt(P, 0)} W. På den ene står ${fmt(m, 2)} kg ${runs[0]!.mat.name.toLowerCase()}, på den andre ${fmt(m, 2)} kg ${runs[1]!.mat.name.toLowerCase()}. Etter ${fmt(t, 0)} s viser termometrene ${fmt(stations[0].state.T, 1)} °C og ${fmt(stations[1].state.T, 1)} °C.`}
          maxHeight={sceneNarrow ? 640 : 500}
        >
          <HeatScene lay={lay} stations={stations} m={m} P={P} t={t} T1={T1} anim={t / speed} showEnergy={showEnergy} />
        </Figure>
      </div>

      <div ref={graphRef}>
        <Figure viewBox={`0 0 800 ${graphH}`} label="Graf over temperaturen som funksjon av tiden for de to stoffene">
          <TempGraph runs={runs} m={m} P={P} T1={T1} t={t} tEnd={tEnd} height={graphH} />
        </Figure>
      </div>
      <Legend
        items={[
          ...runs.map((r) => ({ color: r.color, label: `${r.mat.name}, c = ${fmt(r.mat.c, 0)} J/(kg·K)` })),
          ...(showEnergy ? [{ color: HEAT_COLOR, label: 'Energi Q = P · t fra kokeplata' }] : []),
          { color: VIZ.muted, label: `Ønsket temperatur ${fmt(T1, 0)} °C`, dashed: true },
        ]}
      />

      <Readouts>
        {runs.map((r, i) => (
          <TimeReadout key={`t${i}`} run={r} T1={T1} />
        ))}
        {runs.map((r, i) => (
          <Readout
            key={`s${i}`}
            label={`Stigning ΔT/Δt for ${r.mat.name.toLowerCase()}`}
            value={fmt(P / (r.mat.c * m), 2)}
            unit="K/s"
            tone={r.color}
          />
        ))}
      </Readouts>

      <Formula label="Tiden det tar å varme opp stoffene">
        <FormulaLine>Q = c · m · ΔT = P · t &nbsp;⇒&nbsp; t = c · m · ΔT / P</FormulaLine>
        {runs.map((r, i) => {
          const top = Number.isFinite(r.tDone) ? T1 : (r.mat.boil ?? T1);
          const time = Number.isFinite(r.tDone) ? r.tDone : r.tBoil;
          return (
            <FormulaLine key={i}>
              {r.mat.name}: t = {fmt(r.mat.c, 0)} J/(kg·K) · {fmt(m, 2)} kg · {fmt(top - T0, 0)} K / {fmt(P, 0)} W = {fmt(time, 0)} s
              {Number.isFinite(r.tDone) ? '' : ' (til kokepunktet)'}
            </FormulaLine>
          );
        })}
      </Formula>

      <Explain>{explanation(runs, m, P, T1)}</Explain>
    </VizLayout>
  );
}

function TimeReadout({ run, T1 }: { run: Run; T1: number }) {
  if (!Number.isFinite(run.tDone))
    return (
      <Readout
        label={`${run.mat.name} når ikke ${fmt(T1, 0)} °C`}
        value="koker"
        unit={`ved ${fmt(run.mat.boil ?? 0, 0)} °C`}
        tone={run.color}
      />
    );
  return (
    <Readout label={`Tid til ${fmt(T1, 0)} °C for ${run.mat.name.toLowerCase()}`} value={fmt(run.tDone, 0)} unit="s" tone={run.color} />
  );
}

function explanation(runs: Run[], m: number, P: number, T1: number): ReactNode {
  const [a, b] = runs as [Run, Run];
  const same = a.mat.id === b.mat.id;
  const [hi, lo] = a.mat.c >= b.mat.c ? [a, b] : [b, a];
  const ratio = hi.mat.c / lo.mat.c;
  const boiling = runs.filter((r) => !Number.isFinite(r.tDone));
  const waterAt100 = runs.some((r) => r.mat.id === 'vann') && T1 >= 100;
  const water = runs.some((r) => r.mat.id === 'vann');
  const metals = runs.filter((r) => r.mat.boil === undefined);

  const main = same ? (
    <p>
      <strong>Samme stoff, samme kurve.</strong> Med samme c, masse og effekt stiger temperaturen like fort, {fmt(P / (a.mat.c * m), 2)} K
      hvert sekund. Velg et annet stoff på den ene plata for å sammenligne.
    </p>
  ) : (
    <p>
      <strong>Samme energi, ulik temperaturøkning.</strong> Kokeplatene er like (P = {fmt(P, 0)} W), og stoffene har samme masse, så
      stoppeklokka viser at de får like mye energi Q = P · t. {hi.mat.name} har {fmt(ratio, 1)} ganger så stor spesifikk
      varmekapasitet som {lo.mat.name.toLowerCase()}: det trengs {fmt(ratio, 1)} ganger så mye energi for hver kelvin, og temperaturen
      stiger {fmt(ratio, 1)} ganger så langsomt. Stigningstallet i grafen er ΔT/Δt = P/(c · m).
    </p>
  );

  let extra: ReactNode = null;
  if (boiling.length > 0) {
    const r = boiling[0]!;
    extra = (
      <p>
        {r.mat.name} koker ved {fmt(r.mat.boil ?? 0, 0)} °C. Da går all energien fra plata med til å fordampe væska (du ser boblene og at
        nivået synker), og termometeret står stille selv om vi varmer videre. Det kommer derfor aldri opp i {fmt(T1, 0)} °C.
      </p>
    );
  } else if (waterAt100) {
    extra = (
      <p>Ved 100 °C begynner vannet å koke. Varmer vi videre, går energien med til å fordampe vannet, og temperaturen stiger ikke mer.</p>
    );
  } else if (water) {
    extra = (
      <p>
        Det er derfor vann brukes i radiatorer, varmtvannsberedere og kjølesystemer: vannet kan ta opp og frakte mye energi uten at
        temperaturen endrer seg mye. Og det er derfor sjøen er kald i juni, selv om sand og svaberg allerede er varme i sola.
      </p>
    );
  } else if (metals.length === 2 && !same) {
    extra = (
      <p>
        Legg merke til størrelsen: klossene veier like mye, men et tungt metall tar mindre plass. Det er c (energi per kilogram og
        kelvin) som avgjør, ikke hvor stor klossen er. I hverdagen teller både c og massen, for energien per kelvin er c · m. Det er
        derfor en tynn stekepanne i aluminium blir varm fortere enn en tung støpejernsgryte, selv om aluminium har størst c.
      </p>
    );
  }
  return (
    <>
      {main}
      {extra}
    </>
  );
}
