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
  Sub,
  Toggle,
  Toolbar,
  VIZ,
  VizLayout,
  fmt,
  G_EARTH,
  useSimClock,
} from '../../kit';
import { DRAG_RANGES, dragFall, dragTimeToFraction, terminalVelocity } from './model';
import { EULER_DT, LuftGraf } from './luftmotstand-graf';
import { POSTURE_PRESETS, posture, type PosturePreset } from './luftmotstand-positur';
import { LuftScene, sceneLayout } from './luftmotstand-scene';
import { useNarrow } from './useNarrow';

const R = DRAG_RANGES;
const T_END = R.tEnd;


/**
 * Fall med luftmotstand (2C, 2F): en fallskjermhopper hopper ut av et fly i 4 000 m høyde. Luftmotstanden L = kv²
 * vokser med farten til den er like stor som tyngden, og farten blir konstant (terminalfarten). Kroppsstillingen
 * bestemmer k. Grafene viser v(t) og a(t), og Eulers metode kan sammenlignes med den eksakte løsningen.
 */
export default function Luftmotstand() {
  const [m, setM] = useState<number>(R.m.start);
  const [k, setK] = useState<number>(R.k.start);
  const [compare, setCompare] = useState(true);
  const [euler, setEuler] = useState(false);
  const [showForces, setShowForces] = useState(true);
  const clock = useSimClock({ tMax: T_END, speed: 2 });
  const { setT, pause } = clock;
  // Vis et øyeblikk der både G og L er tydelige når siden åpnes.
  useEffect(() => setT(3), [setT]);

  const t = clock.t;
  const st = dragFall(m, k, t);
  const vT = terminalVelocity(m, k);
  const G = m * G_EARTH;
  const h = R.jumpHeight - st.s;
  const pose = posture(k);
  const preset = POSTURE_PRESETS.find((p) => Math.abs(p.k - k) < 0.005)?.value ?? ('egen' as PosturePreset);
  const [sceneRef, narrowScene] = useNarrow<HTMLDivElement>();
  const [graphRef, narrow] = useNarrow<HTMLDivElement>();
  const lay = sceneLayout(narrowScene);
  const plotH = narrow ? 380 : 280;

  return (
    <VizLayout>
      <Controls>
        <Slider label="Masse m (med utstyr)" value={m} onChange={setM} min={R.m.min} max={R.m.max} step={1} unit="kg" />
        <Slider
          label="Luftmotstandstall k"
          value={k}
          onChange={setK}
          min={R.k.min}
          max={R.k.max}
          step={0.01}
          format={(v) => `${fmt(v, 2)} kg/m`}
        />
        <Slider
          label="Tid t"
          value={t}
          onChange={(v) => {
            pause();
            setT(v);
          }}
          min={0}
          max={T_END}
          step={0.1}
          unit="s"
          decimals={1}
        />
      </Controls>
      <Toolbar>
        <PlayControls clock={clock} decimals={1} />
        <Segmented<PosturePreset>
          label="Kroppsstilling"
          value={preset}
          onChange={(v) => {
            const p = POSTURE_PRESETS.find((x) => x.value === v);
            if (p) setK(p.k);
          }}
          options={POSTURE_PRESETS.map((p) => ({ value: p.value, label: p.label }))}
        />
      </Toolbar>
      <Toolbar>
        <Toggle label="Vis krefter" checked={showForces} onChange={setShowForces} />
        <Toggle label="Sammenlign med fall uten luftmotstand" checked={compare} onChange={setCompare} />
        <Toggle label={`Vis Eulers metode (Δt = ${fmt(EULER_DT, 0)} s)`} checked={euler} onChange={setEuler} />
      </Toolbar>

      <div ref={sceneRef}>
        <Figure
          viewBox={`0 0 ${lay.W} ${lay.H}`}
          label={`Fallskjermhopper på ${fmt(m, 0)} kg som faller over et landskap før skjermen er løst ut, ${pose.name.toLowerCase()}. Etter ${fmt(t, 1)} s er hopperen ${fmt(h, 0)} m over bakken, farten er ${fmt(st.v, 1)} m/s og luftmotstanden ${fmt(st.L, 0)} N, mens tyngden er ${fmt(G, 0)} N.`}
          maxHeight={narrowScene ? 900 : 440}
        >
          <LuftScene m={m} k={k} t={t} st={st} vT={vT} showForces={showForces} narrow={narrowScene} />
        </Figure>
      </div>

      <div ref={graphRef}>
        <Figure viewBox={`0 0 800 ${2 * plotH}`} label="Fartsgraf og akselerasjonsgraf for fallet" maxHeight={620}>
          <LuftGraf m={m} k={k} t={t} v={st.v} a={st.a} vT={vT} compare={compare} euler={euler} plotH={plotH} />
        </Figure>
      </div>
      <Legend
        items={[
          ...(showForces
            ? [
                { color: VIZ.gravity, label: 'Tyngde G' },
                { color: VIZ.friction, label: 'Luftmotstand L' },
              ]
            : []),
          { color: VIZ.velocity, label: 'Fart v' },
          { color: VIZ.acceleration, label: 'Akselerasjon a' },
          ...(compare ? [{ color: VIZ.muted, label: 'Uten luftmotstand', dashed: true }] : []),
          ...(euler ? [{ color: VIZ.ink, label: `Eulers metode, Δt = ${fmt(EULER_DT, 0)} s` }] : []),
        ]}
      />

      <Readouts>
        <Readout label={<span>Fart v ({fmt(st.v * 3.6, 0)} km/h)</span>} value={fmt(st.v, 1)} unit="m/s" tone={VIZ.velocity} />
        <Readout label="Akselerasjon a" value={fmt(st.a, 2)} unit="m/s²" tone={VIZ.acceleration} />
        <Readout label="Luftmotstand L" value={fmt(st.L, 0)} unit="N" tone={VIZ.friction} />
        <Readout
          label={
            <span>
              Terminalfart v<Sub>T</Sub> ({fmt(vT * 3.6, 0)} km/h)
            </span>
          }
          value={fmt(vT, 1)}
          unit="m/s"
        />
      </Readouts>

      <Formula label="Kreftene og akselerasjonen ved tiden t (positiv retning nedover)">
        <FormulaLine>
          G = mg = {fmt(m, 0)} kg · 9,81 m/s² = {fmt(G, 0)} N
        </FormulaLine>
        <FormulaLine>
          L = k · v² = {fmt(k, 2)} kg/m · ({fmt(st.v, 1)} m/s)² = {fmt(st.L, 0)} N
        </FormulaLine>
        <FormulaLine>
          a = (G − L)/m = ({fmt(G, 0)} N − {fmt(st.L, 0)} N)/{fmt(m, 0)} kg = {fmt(st.a, 2)} m/s²
        </FormulaLine>
        <FormulaLine>
          L = G gir v<Sub>T</Sub> = √(mg/k) = √({fmt(m, 0)} kg · 9,81 m/s² / {fmt(k, 2)} kg/m) = {fmt(vT, 1)} m/s
        </FormulaLine>
      </Formula>

      <Explain>{explanation(m, k, t, st.v, st.a, st.L, st.s, G, vT, euler)}</Explain>
    </VizLayout>
  );
}

function explanation(m: number, k: number, t: number, v: number, a: number, L: number, s: number, G: number, vT: number, euler: boolean): ReactNode {
  const n = (x: number) => `${fmt(x, 0)} N`;
  const t95 = dragTimeToFraction(m, k, 0.95);
  const s95 = dragFall(m, k, t95).s;
  const main =
    t < 0.05 ? (
      <p>
        <strong>Hopperen slipper flyet.</strong> I starten er v = 0, så luftmotstanden L = kv² er null. Den eneste kraften er G, og a = g = 9,81
        m/s², akkurat som uten luftmotstand. Trykk «Spill av» og se hva som skjer med L når farten øker.
      </p>
    ) : v < 0.97 * vT ? (
      <p>
        <strong>Farten øker, men stadig saktere.</strong> Ved v = {fmt(v, 1)} m/s er L = kv² = {n(L)}. Kraftsummen G − L = {n(G - L)} er
        mindre enn G, så a = (G − L)/m = {fmt(a, 2)} m/s² er mindre enn g. Fordi a endrer seg hele tiden, gjelder ikke bevegelseslikningene
        for konstant akselerasjon – vi må regne i små tidssteg. Hopperen har falt s = {fmt(s, 0)} m, som er arealet under fartsgrafen.
      </p>
    ) : (
      <p>
        <strong>Terminalfart.</strong> Farten er nesten v<Sub>T</Sub> = √(mg/k) = {fmt(vT, 1)} m/s ({fmt(vT * 3.6, 0)} km/h). Da er L ≈ G ={' '}
        {n(G)}, kraftsummen er nesten null og a ≈ 0: hopperen faller med konstant fart (Newtons 1. lov), selv om tyngden fortsatt virker.
      </p>
    );
  return (
    <>
      {main}
      <p>
        Med {fmt(m, 0)} kg og k = {fmt(k, 2)} kg/m tar det {fmt(t95, 1)} s og {fmt(s95, 0)} m å nå 95 % av terminalfarten. Det er derfor
        fallskjermhoppere kan styre farten med kroppen: med hodet først vender lite av kroppen mot lufta, k blir liten og terminalfarten nær
        300 km/h (for 80 kg). Med magen ned blir den ca. 200 km/h, og med vingedrakt ca. 100 km/h. Når skjermen løses ut, blir k over hundre
        ganger større, og farten faller til ca. 5 m/s før landing.
      </p>
      {euler && (
        <p>
          Prikkene er regnet ut med Eulers metode: a = g − (k/m)v², så v<Sub>ny</Sub> = v + a · Δt. De ligger litt over den eksakte kurven
          fordi a regnes ut i starten av hvert steg, der den er størst. Mindre Δt gir bedre samsvar.
        </p>
      )}
    </>
  );
}
