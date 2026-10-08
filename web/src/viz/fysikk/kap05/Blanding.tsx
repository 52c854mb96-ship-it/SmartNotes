import { useEffect, useState, type ReactNode } from 'react';
import {
  Controls,
  Explain,
  Formula,
  FormulaLine,
  Legend,
  PlayControls,
  Readout,
  Readouts,
  Segmented,
  Slider,
  Sub,
  Toggle,
  Toolbar,
  VIZ,
  VizLayout,
  fmt,
  useSimClock,
} from '../../kit';
import { MATERIALS, mixState, type MixInput, type MixState } from './model';
import { CAL_METAL, levelWithBlock, metalBlock, type MetalId } from './blanding-scene';
import { useNarrow } from './blanding-deler';
import { BlandingGraf, BlandingScene, COLD, HOT, T_END, type Body } from './blanding-figur';

type Mode = 'vann' | 'metall';

const MODES: { value: Mode; label: string }[] = [
  { value: 'vann', label: 'Varmt og kaldt vann' },
  { value: 'metall', label: 'Metallbit i vann' },
];
const METALS: { value: MetalId; label: string }[] = (['aluminium', 'jern', 'kobber', 'bly'] as const).map((id) => ({
  value: id,
  label: MATERIALS[id].name,
}));

const C_WATER = MATERIALS.vann.c;

export default function Blanding() {
  const [mode, setMode] = useState<Mode>('vann');
  const [hotW, setHotW] = useState<Body>({ m: 0.5, T: 80 });
  const [coldW, setColdW] = useState<Body>({ m: 1, T: 20 });
  const [metal, setMetal] = useState<MetalId>('jern');
  const [hotM, setHotM] = useState<Body>({ m: 0.5, T: 100 });
  const [coldM, setColdM] = useState<Body>({ m: 0.5, T: 20 });
  const [showFlow, setShowFlow] = useState(true);
  const clock = useSimClock({ tMax: T_END, speed: 4 });
  const { setT } = clock;
  useEffect(() => setT(5), [setT]);
  const [sceneRef, narrow] = useNarrow<HTMLDivElement>();

  const water = mode === 'vann';
  const hot = water ? hotW : hotM;
  const cold = water ? coldW : coldM;
  const setHot = water ? setHotW : setHotM;
  const setCold = water ? setColdW : setColdM;
  const c1 = water ? C_WATER : MATERIALS[metal].c;
  const input: MixInput = { c1, m1: hot.m, T1: hot.T, c2: C_WATER, m2: cold.m, T2: cold.T };
  const st = mixState(input, clock.t);
  const end = mixState(input, Infinity);
  const name1 = water ? 'Varmt vann' : MATERIALS[metal].name;
  const name2 = water ? 'Kaldt vann' : 'Vann';
  const covered = water || levelWithBlock(cold.m, metalBlock(metal, hot.m), CAL_METAL.innerR).covered;

  const sceneLabel = water
    ? `Kalorimeter av isopor i snitt på en labbenk. ${fmt(hot.m, 2)} kg varmt vann på ${fmt(hot.T, 0)} °C står i et tynt metallbeger inne i ${fmt(cold.m, 2)} kg kaldt vann på ${fmt(cold.T, 0)} °C, med et termometer i hver. Nå viser de ${fmt(st.T1, 1)} °C og ${fmt(st.T2, 1)} °C, og sluttemperaturen blir ${fmt(end.Ts, 1)} °C.`
    : `Kalorimeter av isopor i snitt på en labbenk. En bit ${name1.toLowerCase()} på ${fmt(hot.m, 2)} kg og ${fmt(hot.T, 0)} °C ligger i ${fmt(cold.m, 2)} kg vann på ${fmt(cold.T, 0)} °C. Nå er metallet ${fmt(st.T1, 1)} °C og vannet ${fmt(st.T2, 1)} °C, og sluttemperaturen blir ${fmt(end.Ts, 1)} °C.`;

  return (
    <VizLayout>
      <Toolbar>
        <Segmented label="Velg forsøk" options={MODES} value={mode} onChange={setMode} />
        {!water && <Segmented label="Velg metall" options={METALS} value={metal} onChange={setMetal} />}
      </Toolbar>
      <Controls>
        <Slider
          label={
            <>
              {water ? 'Varmt vann' : 'Metall'} m<Sub>1</Sub>
            </>
          }
          ariaLabel={water ? 'Masse varmt vann' : 'Masse metall'}
          value={hot.m}
          onChange={(m) => setHot({ ...hot, m })}
          min={water ? 0.1 : 0.05}
          max={water ? 2 : 1}
          step={0.05}
          unit="kg"
          decimals={2}
        />
        <Slider
          label={
            <>
              {water ? 'Varmt vann' : 'Metall'} T<Sub>1</Sub>
            </>
          }
          ariaLabel={water ? 'Temperatur varmt vann' : 'Temperatur metall'}
          value={hot.T}
          onChange={(T) => setHot({ ...hot, T })}
          min={40}
          max={100}
          step={1}
          unit="°C"
        />
        <Slider
          label={
            <>
              {name2} m<Sub>2</Sub>
            </>
          }
          ariaLabel={`Masse ${name2.toLowerCase()}`}
          value={cold.m}
          onChange={(m) => setCold({ ...cold, m })}
          min={0.1}
          max={water ? 2 : 1}
          step={0.05}
          unit="kg"
          decimals={2}
        />
        <Slider
          label={
            <>
              {name2} T<Sub>2</Sub>
            </>
          }
          ariaLabel={`Temperatur ${name2.toLowerCase()}`}
          value={cold.T}
          onChange={(T) => setCold({ ...cold, T })}
          min={0}
          max={35}
          step={1}
          unit="°C"
        />
      </Controls>
      <Toolbar>
        <PlayControls clock={clock} decimals={1} />
        <Toggle label="Vis energistrømmen" checked={showFlow} onChange={setShowFlow} />
      </Toolbar>

      <div ref={sceneRef}>
        <BlandingScene
          water={water}
          metal={metal}
          hot={hot}
          cold={cold}
          st={st}
          t={clock.t}
          showFlow={showFlow}
          narrow={narrow}
          label={sceneLabel}
        />
      </div>

      <BlandingGraf
        input={input}
        st={st}
        t={clock.t}
        narrow={narrow}
        label={`Graf over temperaturene som funksjon av tiden: T₁ synker og T₂ stiger mot sluttemperaturen ${fmt(end.Ts, 1)} °C. Søyler viser at energien som er avgitt, er lik energien som er mottatt.`}
      />
      <Legend
        items={[
          { color: HOT, label: `${name1}, T₁` },
          { color: COLD, label: `${name2}, T₂` },
          { color: VIZ.muted, label: 'Sluttemperatur', dashed: true },
        ]}
      />

      <Readouts>
        <Readout label="Sluttemperatur" value={fmt(end.Ts, 1)} unit="°C" />
        <Readout label={`Avgitt av ${name1.toLowerCase()}`} value={fmt(end.Qtotal / 1000, 1)} unit="kJ" tone={HOT} />
        <Readout label={`Mottatt av ${name2.toLowerCase()}`} value={fmt(end.Qtotal / 1000, 1)} unit="kJ" tone={COLD} />
        <Readout
          label={
            <>
              Endring ΔT<Sub>1</Sub> / ΔT<Sub>2</Sub>
            </>
          }
          value={`${fmt(end.Ts - hot.T, 1)} / +${fmt(end.Ts - cold.T, 1)}`}
          unit="K"
        />
      </Readouts>

      <Formula label="Energien som avgis, er lik energien som mottas">
        <FormulaLine>
          c<Sub>1</Sub>m<Sub>1</Sub>(T<Sub>1</Sub> − T) = c<Sub>2</Sub>m<Sub>2</Sub>(T − T<Sub>2</Sub>)
        </FormulaLine>
        <FormulaLine>
          c<Sub>1</Sub>m<Sub>1</Sub> = {fmt(c1, 0)} J/(kg·K) · {fmt(hot.m, 2)} kg = {fmt(c1 * hot.m, 0)} J/K, &nbsp; c<Sub>2</Sub>m
          <Sub>2</Sub> = {fmt(C_WATER, 0)} J/(kg·K) · {fmt(cold.m, 2)} kg = {fmt(C_WATER * cold.m, 0)} J/K
        </FormulaLine>
        <FormulaLine>
          T = ({fmt(c1 * hot.m, 0)} · {fmt(hot.T, 0)} + {fmt(C_WATER * cold.m, 0)} · {fmt(cold.T, 0)}) / ({fmt(c1 * hot.m, 0)} +{' '}
          {fmt(C_WATER * cold.m, 0)}) °C = {fmt(end.Ts, 1)} °C
        </FormulaLine>
      </Formula>

      <Explain>{explanation(input, end, st, water, name1, name2, covered)}</Explain>
    </VizLayout>
  );
}

function explanation(input: MixInput, end: MixState, st: MixState, water: boolean, name1: string, name2: string, covered: boolean): ReactNode {
  const C1 = input.c1 * input.m1;
  const C2 = input.c2 * input.m2;
  const d1 = input.T1 - end.Ts;
  const d2 = end.Ts - input.T2;
  const calm = st.T1 - st.T2 < 0.01 * (input.T1 - input.T2);
  const first = (
    <p>
      <strong>Energien går fra varmt til kaldt.</strong> {name1} avgir Q = {fmt(end.Qtotal / 1000, 1)} kJ, og {name2.toLowerCase()} mottar
      like mye (energien er bevart når vi ser bort fra varmetap og fra energien som varmer opp selve karet). Overføringen stopper i termisk
      likevekt ved {fmt(end.Ts, 1)} °C, når termometrene viser det samme.{' '}
      {calm
        ? 'Det er der vi er nå: temperaturene er like, og pilene for energistrømmen er borte.'
        : 'Pilene for energistrømmen blir tynnere etter hvert, fordi energien går fortere jo større temperaturforskjellen er.'}{' '}
      Varme er energien som overføres, ikke noe et legeme har.
    </p>
  );
  const setup = water ? (
    <p>
      Det varme vannet står i et tynt metallbeger inne i det kalde vannet, så vi kan måle begge temperaturene mens energien går gjennom
      metallveggen. Isoporen rundt isolerer, så nesten ingen energi slipper ut. Heller du vannet rett sammen, går det på noen sekunder, men
      sluttemperaturen blir den samme. Hvor fort det går, avhenger av omrøring og kontaktflate (tidsaksen er bare en illustrasjon).
    </p>
  ) : (
    <p>
      Metallbiten er varmet opp i vannbadet på kokeplata og senket ned i kaldt vann i et kalorimeter av isopor, som isolerer.{' '}
      {covered
        ? 'Hvor fort det går, avhenger av omrøring og kontaktflate (tidsaksen er bare en illustrasjon), men sluttemperaturen gjør det ikke.'
        : 'Med så lite vann er ikke metallbiten helt dekket. Da går det tregere, men sluttemperaturen blir den samme (tidsaksen er bare en illustrasjon).'}
    </p>
  );
  let second: ReactNode;
  if (Math.abs(C1 - C2) / C2 < 0.02) {
    second = (
      <p>
        Med like stor c·m for begge ender temperaturen midt mellom: ({fmt(input.T1, 0)} °C + {fmt(input.T2, 0)} °C)/2 ={' '}
        {fmt((input.T1 + input.T2) / 2, 1)} °C.
      </p>
    );
  } else if (water) {
    const avg = (input.T1 + input.T2) / 2;
    const hotBigger = C1 > C2;
    second = (
      <p>
        Sluttemperaturen er ikke gjennomsnittet ({fmt(avg, 1)} °C). Det er {fmt(Math.max(C1, C2) / Math.min(C1, C2), 1)} ganger så mye{' '}
        {hotBigger ? 'varmt' : 'kaldt'} vann, og den største vannmengden trenger minst temperaturendring for den samme energien: det varme
        vannet blir {fmt(d1, 1)} K kaldere, mens det kalde blir {fmt(d2, 1)} K varmere. Sluttemperaturen havner derfor nærmest
        starttemperaturen til det {hotBigger ? 'varme' : 'kalde'} vannet.
      </p>
    );
  } else {
    // Metallet har som regel mye mindre c·m enn vannet, men ikke alltid (f.eks. 1 kg aluminium i 0,1 kg vann)
    const metalSmaller = C1 < C2;
    second = (
      <p>
        {name1} blir {fmt(d1, 1)} K kaldere, mens vannet blir {fmt(d2, 1)} K varmere. Det er fordi c·m er {fmt(C1, 0)} J/K for metallet mot{' '}
        {fmt(C2, 0)} J/K for vannet: {metalSmaller ? 'vannet' : 'metallet'} trenger mest energi per kelvin, så det endrer temperaturen minst.
        Måler vi sluttemperaturen, kan vi regne ut c for metallet på denne måten.
      </p>
    );
  }
  const practical = water ? (
    <p>
      Det er derfor du kan blande badevannet til riktig temperatur: én bøtte på 70 °C og to bøtter på 10 °C gir (70 + 2 · 10)/3 = 30 °C,
      fordi det kalde vannet har dobbelt så stor c·m.
    </p>
  ) : (
    <p>
      Det er derfor smeden kjøler varmt jern i en bøtte med vann: vannet har mye større c·m enn jernet, så det tar opp energien uten å bli
      særlig varmere.
    </p>
  );
  return (
    <>
      {first}
      {setup}
      {second}
      {practical}
    </>
  );
}
