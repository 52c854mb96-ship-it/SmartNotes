import { useEffect, useState, type ReactNode } from 'react';
import {
  Controls,
  Explain,
  Figure,
  Formula,
  FormulaLine,
  Readout,
  Readouts,
  Segmented,
  Slider,
  Toggle,
  Toolbar,
  VizLayout,
  fmt,
  useSimClock,
} from '../../kit';
import { AIR_HEAT_CAPACITY, toCelsius } from './model';
import { ENERGY_MAX, ENERGY_STEP, P_START, T_START, V_START, processState, sceneLayout, supportFor, type Support } from './forstelov-prosess';
import { COLOR_Q, COLOR_U, COLOR_W, ForsteLovScene, signed } from './forstelov-scene';
import { Energiregnskap, diagramHeight } from './forstelov-diagram';
import { PlayToggle, useNarrow } from './marks';

type Preset = 'oppvarming' | 'kompresjon' | 'utvidelse' | 'isoterm';

const PRESETS: { value: Preset; label: string; W: number; Q: number }[] = [
  { value: 'oppvarming', label: 'Oppvarming', W: 0, Q: 600 },
  { value: 'kompresjon', label: 'Kompresjon', W: 600, Q: 0 },
  { value: 'utvidelse', label: 'Utvidelse', W: -600, Q: 0 },
  { value: 'isoterm', label: 'Varme inn, arbeid ut', W: -600, Q: 600 },
];

const SUPPORT_TEXT: Record<Support, string> = {
  kokeplate: 'en kokeplate som står på',
  is: 'en isblokk',
  torris: 'en blokk med tørris',
  isopor: 'en isoporplate',
};

/** Lengden på prosessen i animasjonen (s). */
const T_ANIM = 3;

export default function ForsteLov() {
  const [W, setW] = useState(500);
  const [Q, setQ] = useState(-200);
  const [showArrows, setShowArrows] = useState(true);
  const clock = useSimClock({ tMax: T_ANIM });
  const { setT } = clock;
  // Vis sluttilstanden når siden åpnes; «Spill av» viser prosessen fra start.
  useEffect(() => setT(T_ANIM), [setT]);
  const [sceneRef, narrow] = useNarrow<HTMLDivElement>();
  const layout = sceneLayout(narrow);

  const p = Math.min(1, clock.t / T_ANIM);
  const now = processState(W, Q, p);
  const end = processState(W, Q, 1);
  const dU = end.dU;
  const T1 = end.T;
  const preset = PRESETS.find((x) => x.W === W && x.Q === Q)?.value ?? ('egen' as Preset);
  const support = supportFor(W, Q);
  const sceneLabel = `Glassylinder med 1,0 mol luft og et stempel, på ${SUPPORT_TEXT[support]}. Arbeid på gassen ${signed(W)} joule, tilført varme ${signed(Q)} joule, endring i indre energi ${signed(dU)} joule. Temperaturen er ${fmt(now.T, 0)} kelvin og volumet ${fmt(now.V * 1000, 1)} liter.`;

  const choose = (v: Preset) => {
    const x = PRESETS.find((y) => y.value === v);
    if (!x) return;
    setW(x.W);
    setQ(x.Q);
    setT(T_ANIM);
  };
  const energyFormat = (v: number) => `${signed(v)} J`;

  return (
    <VizLayout>
      <Toolbar>
        <Segmented label="Velg en prosess" options={PRESETS} value={preset} onChange={choose} />
      </Toolbar>
      <Controls>
        <Slider label="Arbeid på gassen W" value={W} onChange={setW} min={-ENERGY_MAX} max={ENERGY_MAX} step={ENERGY_STEP} format={energyFormat} />
        <Slider label="Tilført varme Q" value={Q} onChange={setQ} min={-ENERGY_MAX} max={ENERGY_MAX} step={ENERGY_STEP} format={energyFormat} />
      </Controls>
      <Toolbar>
        <PlayToggle clock={clock} resetLabel="Til start" />
        <Toggle label="Vis energipiler" checked={showArrows} onChange={setShowArrows} />
      </Toolbar>

      <div ref={sceneRef} style={{ display: 'grid', gap: 12 }}>
        <Figure viewBox={layout.viewBox} label={sceneLabel} maxHeight={narrow ? 720 : 640}>
          <ForsteLovScene layout={layout} t={clock.t} W={W} Q={Q} state={now} showArrows={showArrows} />
        </Figure>
        <Figure viewBox={`0 0 800 ${diagramHeight(narrow)}`} label={`Energiregnskap: W pluss Q er lik ΔU. ${signed(W)} J pluss ${signed(Q)} J er ${signed(dU)} J.`}>
          <Energiregnskap W={W} Q={Q} p={p} narrow={narrow} />
        </Figure>
      </div>

      <Readouts>
        <Readout label="Arbeid på gassen W" value={signed(W)} unit="J" tone={COLOR_W} />
        <Readout label="Tilført varme Q" value={signed(Q)} unit="J" tone={COLOR_Q} />
        <Readout label="Endring i indre energi ΔU" value={signed(dU)} unit="J" tone={COLOR_U} />
        <Readout label="Temperatur etter" value={fmt(T1, 0)} unit="K" />
      </Readouts>

      <Formula label="Termofysikkens første lov">
        <FormulaLine>
          ΔU = W + Q = ({signed(W)} J) + ({signed(Q)} J) = {signed(dU)} J
        </FormulaLine>
        <FormulaLine>
          ΔT = ΔU / C = {signed(dU)} J / {fmt(AIR_HEAT_CAPACITY, 1)} J/K = {signed(T1 - T_START, 1)} K, &nbsp;så T = {fmt(T_START, 0)} K{' '}
          {T1 - T_START < 0 ? '−' : '+'} {fmt(Math.abs(T1 - T_START), 1)} K = {fmt(T1, 0)} K &nbsp;(C for 1,0 mol luft)
        </FormulaLine>
        <FormulaLine>
          V = {fmt(V_START * 1000, 1)} L → {fmt(end.V * 1000, 1)} L, &nbsp;p = nRT / V = {fmt(P_START / 1000, 0)} kPa → {fmt(end.p / 1000, 0)} kPa
        </FormulaLine>
      </Formula>

      <Explain>{explanation(W, Q, dU, T1, end.V, end.p, support)}</Explain>
    </VizLayout>
  );
}

function explanation(W: number, Q: number, dU: number, T1: number, V1: number, p1: number, support: Support): ReactNode {
  const wText =
    W > 0
      ? `Du presser stempelet ned, så du gjør arbeid på gassen: W = ${signed(W)} J.`
      : W < 0
        ? `Gassen utvider seg og skyver stempelet opp. Da gjør gassen arbeid på omgivelsene, så arbeidet på gassen er negativt: W = ${signed(W)} J.`
        : 'Stempelet er låst, så volumet er fast, og det gjøres ikke noe arbeid: W = 0.';
  const qText =
    Q > 0
      ? `Kokeplata varmer bunnen, og gassen får tilført varme: Q = ${signed(Q)} J.`
      : Q < 0
        ? support === 'torris'
          ? `Sylinderen står på tørris (−78 °C), som er kaldere enn gassen hele tiden, så gassen avgir varme gjennom bunnen: Q = ${signed(Q)} J. (En isblokk på 0 °C ville ikke virket her: gassen blir kaldere enn isen.)`
          : `Isblokka (0 °C) er kaldere enn gassen, så gassen avgir varme gjennom bunnen: Q = ${signed(Q)} J.`
        : 'Sylinderen står på isopor, så ingen varme går inn eller ut: Q = 0. (Det stemmer best når prosessen går fort, så varmen ikke rekker å gå gjennom glasset.)';
  let uText: string;
  if (W === 0 && Q === 0) uText = 'Ingen energi går inn eller ut, så den indre energien er uendret.';
  else if (dU > 0)
    uText = `Den indre energien øker med ΔU = W + Q = ${signed(dU)} J. I en gass er den indre energien først og fremst den kinetiske energien til partiklene, så de beveger seg raskere (lengre haler), og temperaturen stiger til ${fmt(T1, 0)} K (${fmt(toCelsius(T1), 0)} °C).`;
  else if (dU < 0)
    uText = `Den indre energien minker med ${fmt(-dU, 0)} J (ΔU = W + Q = ${signed(dU)} J). Partiklene beveger seg langsommere, og temperaturen synker til ${fmt(T1, 0)} K (${fmt(toCelsius(T1), 0)} °C).`;
  else uText = 'Det som kommer inn som den ene formen, går ut som den andre: ΔU = 0, og temperaturen er uendret.';

  let example = '';
  if (Q === 0 && W > 0)
    example =
      'Det er derfor sykkelpumpa blir varm nederst når du pumper raskt, og derfor kan en dieselmotor tenne drivstoffet uten tennplugg: lufta blir så varm når den presses sammen.';
  else if (Q === 0 && W < 0) example = 'Det er derfor luft som stiger i atmosfæren, blir kaldere: trykket er lavere høyere opp, så lufta utvider seg og gjør arbeid.';
  else if (W === 0 && Q > 0) example = 'Med fast volum går all varmen til indre energi. Det er derfor trykket i et bildekk som står i sola, stiger.';
  else if (W === 0 && Q < 0) example = 'Det er derfor en lukket flaske med luft blir kald og får lavere trykk i kjøleskapet: volumet er fast, så all varmen som går ut, tas fra den indre energien.';
  else if (W < 0 && Q > 0)
    example =
      'Slik virker en varmekraftmaskin, for eksempel en bilmotor eller en dampturbin: gassen får varme og gjør arbeid. Termofysikkens andre lov sier at ikke all varmen kan bli til arbeid i en maskin som går rundt og rundt.';
  else if (W > 0 && Q < 0) example = 'Slik er det i kompressoren i et kjøleskap eller en varmepumpe: gassen presses sammen og avgir varme.';

  const vText =
    W === 0
      ? ''
      : ` Volumet går fra ${fmt(V_START * 1000, 1)} L til ${fmt(V1 * 1000, 1)} L, og trykket fra ${fmt(P_START / 1000, 0)} kPa til ${fmt(p1 / 1000, 0)} kPa. Hvor langt stempelet går, avhenger av hvordan prosessen skjer; her får gassen arbeidet og varmen jevnt og samtidig.`;
  return (
    <>
      <p>
        <strong>W og Q er positive når energi går inn i gassen.</strong> {wText} {qText}
      </p>
      <p>
        {uText}
        {vText}
      </p>
      {example && <p>{example}</p>}
    </>
  );
}
