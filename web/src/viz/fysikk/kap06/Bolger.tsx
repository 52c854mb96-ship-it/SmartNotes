import { useState, type ReactNode } from 'react';
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
import { MARK, T_WINDOW, TimeGraph, WaveScene, graphHeight, markName, sceneHeight } from './bolger-figur';
import { type WaveKind } from './bolger-scene';
import { useNarrow } from './marks';
import { maxLongitudinalAmplitude, period, waveSpeed } from './model';

/**
 * Bølger (6A): en elev i fysikkrommet rister i et langt tau (transversal bølge) eller dytter enden av en lang
 * spiralfjær fram og tilbake på labbenken (longitudinal bølge). Bølgen går bortover med v = λf, mens det merkede
 * punktet (båndet på tauet eller den merkede vindingen) bare svinger om likevekt. Målebåndet på gulvet og mållinjene
 * viser λ og A, og grafen under viser utslaget til det merkede punktet over tid, med perioden T.
 */

const KINDS: { value: WaveKind; label: string }[] = [
  { value: 'transversal', label: 'Transversal (tau)' },
  { value: 'longitudinal', label: 'Longitudinal (fjær)' },
];

const L_MIN = 0.5;
const L_MAX = 4;
const F_MIN = 0.2;
const F_MAX = 2;

const clampTo = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export default function Bolger() {
  const [kind, setKind] = useState<WaveKind>('transversal');
  const [A, setA] = useState(0.3);
  const [wave, setWave] = useState({ lambda: 2, f: 0.5 });
  const [lock, setLock] = useState(true);
  const [show, setShow] = useState(true);
  const clock = useSimClock({ tMax: T_WINDOW, loop: true });
  const [graphRef, narrow] = useNarrow<HTMLDivElement>();
  const { lambda, f } = wave;
  const v = waveSpeed(lambda, f);
  const T = period(f);

  // Med fast bølgefart (samme medium) endrer λ og f seg sammen, så v = λf ikke endres.
  const changeLambda = (l: number) =>
    setWave((w) => {
      if (!lock) return { ...w, lambda: l };
      const speed = w.lambda * w.f;
      const nf = clampTo(speed / l, F_MIN, F_MAX);
      return { lambda: clampTo(speed / nf, L_MIN, L_MAX), f: nf };
    });
  const changeF = (nf: number) =>
    setWave((w) => {
      if (!lock) return { ...w, f: nf };
      const speed = w.lambda * w.f;
      const l = clampTo(speed / nf, L_MIN, L_MAX);
      return { lambda: l, f: clampTo(speed / l, F_MIN, F_MAX) };
    });

  const longi = kind === 'longitudinal';
  const Amax = maxLongitudinalAmplitude(lambda);
  const Aeff = longi ? Math.min(A, Amax) : A;
  const clipped = longi && A > Amax + 1e-9;
  const snapH = sceneHeight(narrow);
  const graphH = graphHeight(narrow);
  const medium = longi ? 'fjæra' : 'tauet';

  return (
    <VizLayout>
      <Toolbar>
        <Segmented label="Velg type bølge" options={KINDS} value={kind} onChange={setKind} />
      </Toolbar>
      <Controls>
        <Slider label="Amplitude A" value={A} onChange={setA} min={0.05} max={0.5} step={0.01} unit="m" decimals={2} />
        <Slider label="Bølgelengde λ" value={lambda} onChange={changeLambda} min={L_MIN} max={L_MAX} step={0.05} unit="m" decimals={2} />
        <Slider label="Frekvens f" value={f} onChange={changeF} min={F_MIN} max={F_MAX} step={0.05} unit="Hz" decimals={2} />
      </Controls>
      <Toolbar>
        <Toggle label="Samme medium (fast bølgefart)" checked={lock} onChange={setLock} />
        <Toggle label="Vis mål og fart" checked={show} onChange={setShow} />
        <PlayControls clock={clock} decimals={1} />
      </Toolbar>

      <div ref={graphRef}>
        <Figure
          viewBox={`0 0 800 ${snapH}`}
          label={
            longi
              ? `En elev dytter enden av en lang spiralfjær fram og tilbake på labbenken. Det blir fortetninger og fortynninger som går bortover med ${fmt(v, 2)} m/s. Bølgelengden er ${fmt(lambda, 2)} m og amplituden ${fmt(Aeff, 2)} m.`
              : `En elev rister enden av et langt tau opp og ned. Bølgen går bortover med ${fmt(v, 2)} m/s, mens båndet på tauet bare svinger opp og ned. Bølgelengden er ${fmt(lambda, 2)} m og amplituden ${fmt(Aeff, 2)} m.`
          }
        >
          <WaveScene kind={kind} t={clock.t} A={Aeff} lambda={lambda} f={f} H={snapH} show={show} />
        </Figure>
      </div>
      <Figure
        viewBox={`0 0 800 ${graphH}`}
        label={`Graf over ${longi ? 'forskyvningen til den merkede vindingen' : 'utslaget til båndet på tauet'} som funksjon av tiden. Perioden er ${fmt(T, 2)} s.`}
      >
        <TimeGraph kind={kind} t={clock.t} A={Aeff} lambda={lambda} f={f} height={graphH} />
      </Figure>
      <Legend
        items={[
          { color: MARK, label: markName(kind) },
          { color: VIZ.velocity, label: <span>Fart: bølgen (v) og det merkede punktet, i samme skala</span> },
        ]}
      />

      <Readouts>
        <Readout label="Bølgefart v = λf" value={fmt(v, 2)} unit="m/s" tone={VIZ.velocity} />
        <Readout label="Periode T = 1/f" value={fmt(T, 2)} unit="s" />
        <Readout label="Bølgen flytter seg per periode" value={fmt(lambda, 2)} unit="m" />
        <Readout label="Partikkelen går per periode, 4A" value={fmt(4 * Aeff, 2)} unit="m" tone={MARK} />
      </Readouts>

      <Formula label="Bølgefart og periode">
        <FormulaLine>
          v = λ · f = {fmt(lambda, 2)} m · {fmt(f, 2)} Hz = {fmt(v, 2)} m/s
        </FormulaLine>
        <FormulaLine>
          T = 1 / f = 1 / {fmt(f, 2)} Hz = {fmt(T, 2)} s
        </FormulaLine>
      </Formula>

      <Explain>{explanation(kind, v, T, lambda, Aeff, lock, clipped, medium)}</Explain>
    </VizLayout>
  );
}

function explanation(kind: WaveKind, v: number, T: number, lambda: number, A: number, lock: boolean, clipped: boolean, medium: string): ReactNode {
  const first =
    kind === 'transversal' ? (
      <p>
        <strong>Bølgen flytter seg, tauet gjør det ikke.</strong> Eleven rister enden opp og ned, og formen går bortover tauet med
        v = {fmt(v, 2)} m/s. Båndet på tauet svinger bare opp og ned langs den stiplede streken, på tvers av fartsretningen: en
        transversal bølge. På én periode, T = {fmt(T, 2)} s, flytter bølgen seg én bølgelengde ({fmt(lambda, 2)} m), mens båndet går
        4A = {fmt(4 * A, 2)} m og er tilbake der det startet. Det er derfor en badeball på sjøen bare vipper opp og ned når bølgene
        passerer under den.
      </p>
    ) : (
      <p>
        <strong>Longitudinal bølge.</strong> Eleven dytter enden av fjæra fram og tilbake, så vindingene svinger langs fartsretningen til
        bølgen. Der de står tett, er det en fortetning, og der de står glissent, en fortynning. Det er mønsteret som går bortover med
        v = {fmt(v, 2)} m/s, ikke vindingene: den merkede vindingen går bare fram og tilbake langs den stiplede streken. Lyd i luft
        er en slik bølge. Det er derfor lyd trenger et stoff å gå gjennom: luftmolekylene dytter på naboene sine, akkurat som
        vindingene i fjæra.
        {clipped ? ` Amplituden er begrenset til ${fmt(A, 2)} m her, ellers ville nabovindingene passert hverandre.` : ''}
      </p>
    );
  // I øyeblikksbildet av en longitudinal bølge er det fortetningene (ikke toppene) som ligger λ fra hverandre
  const distance =
    kind === 'transversal'
      ? 'Avstanden mellom to daler (eller topper) er λ i scenen, og du kan lese den av på målebåndet. I grafen for båndet er avstanden mellom to topper perioden T.'
      : 'Avstanden mellom to fortetninger er λ i scenen, mens avstanden mellom to topper i grafen for den merkede vindingen er perioden T.';
  const second = lock ? (
    <p>
      Bølgefarten bestemmes av mediet ({medium}), så den er fast her. Øker du frekvensen, blir bølgelengden kortere, og v = λf er den
      samme. {distance}
    </p>
  ) : (
    <p>
      Nå kan λ og f endres hver for seg, som om du byttet til et annet medium med en annen bølgefart (et strammere tau eller en
      stivere fjær). {distance}
    </p>
  );
  return (
    <>
      {first}
      {second}
    </>
  );
}
