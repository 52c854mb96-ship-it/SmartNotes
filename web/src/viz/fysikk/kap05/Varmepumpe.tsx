import { useState, type ReactNode } from 'react';
import {
  Controls,
  Explain,
  Figure,
  Formula,
  FormulaLine,
  Legend,
  Readout,
  Readouts,
  Segmented,
  Slider,
  Sub,
  Toggle,
  Toolbar,
  VizLayout,
  fmt,
} from '../../kit';
import {
  HOUSE_LOSS,
  T_IN_MAX,
  T_IN_MIN,
  T_OUT_MAX,
  T_OUT_MIN,
  heatPumpState,
  kWhPerDay,
  toKelvin,
  type HeatPumpState,
} from './model-varmepumpe';
import { FLOW, useNarrow } from './varmepumpe-deler';
import { EnergiFlyt, FLOW_NARROW, FLOW_WIDE, flowHeight } from './varmepumpe-flyt';
import { CopGraf, copLegendItems } from './varmepumpe-graf';
import { SCENE_NARROW, SCENE_WIDE, VarmepumpeScene, type Heater } from './varmepumpe-scene';

const kWh = (v: number) => `${fmt(v, 1)} kWh`;
/** Negative tall i parentes i utregninger: 21 − (−5). */
const paren = (v: number) => (v < 0 ? `(${fmt(v, 0)})` : fmt(v, 0));

export default function VarmepumpeViz() {
  const [tOut, setTOut] = useState(-5);
  const [tIn, setTIn] = useState(21);
  const [heater, setHeater] = useState<Heater>('pumpe');
  const [showRef, setShowRef] = useState(false);
  const [ref, narrow] = useNarrow<HTMLDivElement>();
  const s = heatPumpState(tIn, tOut);
  const geo = narrow ? SCENE_NARROW : SCENE_WIDE;
  const flowL = narrow ? FLOW_NARROW : FLOW_WIDE;
  const graphW = narrow ? 560 : 800;
  const graphH = narrow ? 400 : 320;

  return (
    <VizLayout>
      <Controls>
        <Slider label="Temperatur ute" value={tOut} onChange={setTOut} min={T_OUT_MIN} max={T_OUT_MAX} step={1} unit="°C" />
        <Slider label="Temperatur inne" value={tIn} onChange={setTIn} min={T_IN_MIN} max={T_IN_MAX} step={1} unit="°C" />
      </Controls>
      <Toolbar>
        <Segmented
          label="Oppvarming"
          value={heater}
          onChange={setHeater}
          options={[
            { value: 'pumpe', label: 'Varmepumpe' },
            { value: 'ovn', label: 'Panelovner' },
          ]}
        />
        {heater === 'pumpe' && <Toggle label="Vis temperaturen i kuldemediet" checked={showRef} onChange={setShowRef} />}
      </Toolbar>

      <div ref={ref}>
        <Figure viewBox={`0 0 ${geo.W} ${geo.H}`} label={sceneLabel(s, heater, showRef)} maxHeight={narrow ? 600 : 460}>
          <VarmepumpeScene geo={geo} s={s} heater={heater} showRefrigerant={showRef} />
        </Figure>
      </div>
      <Legend
        items={[
          { color: FLOW.Qk, label: <span>Q<sub>k</sub>: varme fra uteluften</span> },
          { color: FLOW.W, label: 'W: elektrisk energi fra strømnettet' },
          { color: FLOW.Qv, label: <span>Q<sub>v</sub>: varme til huset</span> },
        ]}
      />

      <Figure viewBox={`0 0 ${flowL.W} ${flowHeight(flowL)}`} label={flowLabel(s)} maxHeight={narrow ? 360 : 300}>
        <EnergiFlyt s={s} L={flowL} />
      </Figure>

      <Figure
        viewBox={`0 0 ${graphW} ${graphH}`}
        label={`Varmefaktoren til varmepumpa som funksjon av utetemperaturen med ${fmt(tIn, 0)} °C inne. Den synker fra ${fmt(heatPumpStateCop(tIn, T_OUT_MAX), 1)} ved ${T_OUT_MAX} °C til ${fmt(heatPumpStateCop(tIn, T_OUT_MIN), 1)} ved ${T_OUT_MIN} °C. Nå er den ${fmt(s.cop, 1)}. En panelovn har varmefaktor 1.`}
        maxHeight={narrow ? 440 : 360}
      >
        <CopGraf tIn={tIn} tOut={tOut} width={graphW} height={graphH} />
      </Figure>
      <Legend items={copLegendItems()} />

      <Readouts>
        <Readout label="Varmefaktor ε" value={fmt(s.cop, 1)} tone={FLOW.cop} />
        <Readout label={<>Varme til huset per døgn, Q<Sub>v</Sub></>} value={fmt(s.day.pump.Qv, 1)} unit="kWh" tone={FLOW.Qv} />
        <Readout label="Strøm med varmepumpe, W" value={fmt(s.day.pump.W, 1)} unit="kWh" tone={FLOW.W} />
        <Readout label="Strøm med panelovner" value={fmt(s.day.panel.W, 1)} unit="kWh" />
      </Readouts>

      <Formula label="Energi per døgn">
        <FormulaLine>
          Varmetapet: P = {fmt(HOUSE_LOSS, 0)}&nbsp;W/K · ({fmt(tIn, 0)} − {paren(tOut)})&nbsp;K = {fmt(s.need, 0)}&nbsp;W
        </FormulaLine>
        <FormulaLine>
          Q<Sub>v</Sub> = P · t = {fmt(s.need / 1000, 2)}&nbsp;kW · 24&nbsp;h = {kWh(s.day.pump.Qv)}
        </FormulaLine>
        <FormulaLine>
          ε = Q<Sub>v</Sub> / W &nbsp;⇒&nbsp; W = Q<Sub>v</Sub> / ε = {kWh(s.day.pump.Qv)} / {fmt(s.cop, 2)} = {kWh(s.day.pump.W)}
        </FormulaLine>
        <FormulaLine>
          Q<Sub>k</Sub> = Q<Sub>v</Sub> − W = {kWh(s.day.pump.Qv)} − {kWh(s.day.pump.W)} = {kWh(s.day.pump.Qk)}
        </FormulaLine>
        <FormulaLine>
          Panelovner (ε = 1): W = Q<Sub>v</Sub> = {kWh(s.day.panel.W)}. Varmepumpa sparer {kWh(s.saved)} ({fmt(s.savedShare * 100, 0)}&nbsp;%).
        </FormulaLine>
      </Formula>

      <Explain>{explanation(s, heater, showRef)}</Explain>
    </VizLayout>
  );
}

function heatPumpStateCop(tIn: number, tOut: number): number {
  return heatPumpState(tIn, tOut).cop;
}

function sceneLabel(s: HeatPumpState, heater: Heater, showRef: boolean): string {
  const base = `Et hus i snitt en kveld med ${fmt(s.tOut, 0)} °C ute og ${fmt(s.tIn, 0)} °C inne. Utedelen til en luft-til-luft-varmepumpe står ute, innedelen henger på veggen i stua, og under vinduet står en panelovn.`;
  if (heater === 'ovn')
    return `${base} Panelovnen er på: ${fmt(s.need / 1000, 2)} kW elektrisk energi W blir til like mye varme Q til stua.`;
  const ref = showRef ? ` Kuldemediet er ${fmt(s.refrigerant.evap, 0)} °C i utedelen og ${fmt(s.refrigerant.cond, 0)} °C i innedelen.` : '';
  return `${base} Varmepumpa er på: den henter ${fmt(s.pump.Qk / 1000, 2)} kW varme fra uteluften, bruker ${fmt(s.pump.W / 1000, 2)} kW elektrisk energi og gir ${fmt(s.need / 1000, 2)} kW varme til stua.${ref}`;
}

function flowLabel(s: HeatPumpState): string {
  return `Energiflytdiagram per døgn. Varmepumpe: ${kWh(s.day.pump.W)} strøm og ${kWh(s.day.pump.Qk)} fra uteluften blir ${kWh(s.day.pump.Qv)} varme til huset. Panelovner: ${kWh(s.day.panel.W)} strøm blir ${kWh(s.day.panel.Qv)} varme.`;
}

/* ---------- Forklaring ---------- */

function explanation(s: HeatPumpState, heater: Heater, showRef: boolean): ReactNode {
  const { tIn, tOut, cop } = s;
  const c = (v: number) => `${fmt(v, 0)} °C`;
  const day = s.day.pump;

  const intro =
    heater === 'pumpe' ? (
      <p>
        <strong>Varmepumpa flytter det meste av varmen inn fra uteluften.</strong> For å holde {c(tIn)} inne når det er {c(tOut)} ute, må huset få like mye varme
        som det taper: {fmt(s.need / 1000, 2)}&nbsp;kW, eller {kWh(day.Qv)} i døgnet. Av dette henter varmepumpa {kWh(day.Qk)} fra uteluften, og bare{' '}
        {kWh(day.W)} er strøm. Energien er bevart: Q<Sub>v</Sub> = Q<Sub>k</Sub> + W. Bredden på pilene er proporsjonal med effekten, så den oransje pila
        inne er like bred som den blå og den grønne til sammen.
      </p>
    ) : (
      <p>
        <strong>En panelovn gjør strøm om til varme, men aldri til mer varme enn strømmen den bruker.</strong> All den elektriske energien blir varme
        (virkningsgraden er 100&nbsp;%), så for å gi huset {kWh(day.Qv)} i døgnet bruker panelovnene {kWh(s.day.panel.W)} strøm. Varmefaktoren er ε = 1:
        den grønne og den oransje pila er like brede. Bytt til varmepumpe og se hvor mye smalere den grønne pila blir for den samme varmen.
      </p>
    );

  const law = (
    <p>
      <strong>Hvorfor trengs strøm i det hele tatt?</strong> Varme går av seg selv bare fra noe varmt til noe kaldere (termofysikkens andre lov).
      Varmepumpa flytter varme motsatt vei, fra {c(tOut)} ute til {c(tIn)} inne, og det krever arbeid W. Trikset er kuldemediet som går rundt i rørene.
      I utedelen er det enda kaldere enn lufta, {c(s.refrigerant.evap)}, så varmen går av seg selv fra lufta inn i kuldemediet. Kompressoren presser
      gassen sammen, så den blir {c(s.refrigerant.cond)}, varmere enn stua, og i innedelen går varmen av seg selv ut i rommet.
      {heater === 'pumpe' && !showRef ? ' Slå på «Vis temperaturen i kuldemediet» for å se temperaturene i bildet.' : ''}
    </p>
  );

  let weather: ReactNode;
  if (tOut >= 5) {
    weather = (
      <p>
        Mildt vær: varmepumpa trenger bare å løfte varmen fra {c(s.refrigerant.evap)} til {c(s.refrigerant.cond)}, så hver kWh strøm gir hele{' '}
        {fmt(cop, 1)}&nbsp;kWh varme (ε = {fmt(cop, 1)}). Dra utetemperaturen ned og se at varmefaktoren synker.
      </p>
    );
  } else if (tOut > -10) {
    weather = (
      <p>
        Varmefaktoren er {fmt(cop, 1)}: for hver kWh strøm får huset {fmt(cop, 1)}&nbsp;kWh varme, og {fmt(cop - 1, 1)}&nbsp;kWh av den kommer fra
        uteluften. Jo kaldere det er ute, desto større temperaturforskjell må varmepumpa løfte varmen over, og desto mer arbeid trengs for hver kWh.
        Derfor synker kurven i grafen mot venstre.
      </p>
    );
  } else {
    weather = (
      <p>
        Kaldt: varmepumpa må løfte varmen fra {c(s.refrigerant.evap)} til {c(s.refrigerant.cond)}, en forskjell på{' '}
        {fmt(s.refrigerant.cond - s.refrigerant.evap, 0)}&nbsp;K, så varmefaktoren har sunket til {fmt(cop, 1)}. Samtidig taper huset mer varme. Derfor
        stiger strømforbruket mye de kaldeste dagene. Mange varmepumper klarer heller ikke å gi så mye varme som huset trenger når det er så kaldt, og
        da må panelovnene hjelpe til. Men selv nå gir hver kWh strøm {fmt(cop, 1)}&nbsp;kWh varme.
      </p>
    );
  }

  const tips: ReactNode[] = [];
  tips.push(
    <>
      «Kald luft har ingen varme å gi.» Jo: {c(tOut)} er {fmt(toKelvin(tOut), 0)}&nbsp;K, langt over det absolutte nullpunktet, så molekylene i lufta har
      mye indre energi. Varmepumpa tar litt av den, og lufta som blåser ut av utedelen, er noen grader kaldere enn lufta rundt.
    </>,
  );
  tips.push(
    <>
      «Varmepumpa har en virkningsgrad på {fmt(cop * 100, 0)}&nbsp;%.» Nei, energien er bevart. Varmefaktoren er ikke en virkningsgrad: varmepumpa
      flytter varme som allerede finnes, og strømmen den bruker, blir også varme inne.
    </>,
  );
  tips.push(
    <>
      Andre lov setter en øvre grense: selv en perfekt varmepumpe kan ikke ha høyere varmefaktor enn ε<Sub>maks</Sub> = T<Sub>v</Sub> / (T
      <Sub>v</Sub> − T<Sub>k</Sub>), med temperaturene i kelvin. Nå er grensen {fmt(toKelvin(tIn), 0)}&nbsp;K / {fmt(s.dT, 0)}&nbsp;K ={' '}
      {fmt(s.ideal, 1)}. En ekte varmepumpe når mye kortere, fordi kuldemediet må være kaldere enn lufta ute og varmere enn lufta inne, og fordi
      kompressoren og viftene har tap.
    </>,
  );
  if (tIn > T_IN_MIN) {
    const cooler = heatPumpState(tIn - 1, tOut);
    tips.push(
      <>
        Én grad lavere inne ({c(tIn - 1)}) gir mindre varmetap og litt høyere varmefaktor: varmepumpa bruker da {kWh(cooler.day.pump.W)} i døgnet, {kWh(day.W - cooler.day.pump.W)}{' '}
        mindre.
      </>,
    );
  }
  tips.push(
    <>
      Med en strømpris på for eksempel 1&nbsp;kr per kWh sparer varmepumpa {fmt(s.saved, 0)}&nbsp;kr i døgnet sammenlignet med panelovner (
      {fmt(kWhPerDay(s.need), 1)}&nbsp;kWh mot {fmt(day.W, 1)}&nbsp;kWh strøm).
    </>,
  );

  return (
    <>
      {intro}
      {law}
      {weather}
      <ul>
        {tips.map((tip, i) => (
          <li key={i}>{tip}</li>
        ))}
      </ul>
    </>
  );
}
