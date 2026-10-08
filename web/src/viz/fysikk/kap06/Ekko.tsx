import { useState, type ReactNode } from 'react';
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
  Toolbar,
  VIZ,
  VizLayout,
  fmt,
  fmtSci,
  useSimClock,
} from '../../kit';
import { BolgelengdeFigur, bolgelengdeHeight, fmtLength } from './ekko-bolgelengde';
import { useContainerScale } from './ekko-deler';
import { LoddScene } from './ekko-lodd';
import { LIGHT, SOUND, TordenScene, fmtDistance } from './ekko-torden';
import {
  C_LYS,
  LYDFART,
  LYN_HOYDE,
  SLIDERS,
  V_LUFT,
  V_VANN,
  echoDepth,
  echoPulse,
  frequencyHz,
  lightTime,
  lightningDistance,
  playback,
  ruleOfThumbKm,
  rumbleDelay,
  wavelength,
  type Situasjon,
} from './model-ekko';

export default function Ekko() {
  const [sit, setSit] = useState<Situasjon>('torden');
  const [tTorden, setTTorden] = useState<number>(SLIDERS.torden.t.start);
  const [tLodd, setTLodd] = useState<number>(SLIDERS.ekkolodd.t.start);
  const [fTorden, setFTorden] = useState<number>(SLIDERS.torden.f.start);
  const [fLodd, setFLodd] = useState<number>(SLIDERS.ekkolodd.f.start);
  const { ref, f, s } = useContainerScale();

  const torden = sit === 'torden';
  const T = torden ? tTorden : tLodd;
  const fSlider = torden ? fTorden : fLodd;
  const fHz = frequencyHz(sit, fSlider);
  const { tEnd, speed } = playback(sit, T);
  const clock = useSimClock({ tMax: tEnd, speed });
  const tau = Math.min(clock.t, tEnd);
  const lam = wavelength(LYDFART[torden ? 'luft' : 'vann'], fHz);

  const changeSit = (v: Situasjon) => {
    setSit(v);
    clock.reset();
  };

  return (
    <VizLayout>
      <Toolbar>
        <Segmented<Situasjon>
          label="Situasjon"
          options={[
            { value: 'torden', label: 'Lyn og torden' },
            { value: 'ekkolodd', label: 'Ekkolodd på båten' },
          ]}
          value={sit}
          onChange={changeSit}
        />
      </Toolbar>
      <Controls>
        {torden ? (
          <Slider
            label="Tid fra lynet til tordenen t"
            value={tTorden}
            onChange={setTTorden}
            min={SLIDERS.torden.t.min}
            max={SLIDERS.torden.t.max}
            step={SLIDERS.torden.t.step}
            unit="s"
            decimals={1}
          />
        ) : (
          <Slider
            label="Tid til ekkoet er tilbake t"
            value={tLodd}
            onChange={setTLodd}
            min={SLIDERS.ekkolodd.t.min}
            max={SLIDERS.ekkolodd.t.max}
            step={SLIDERS.ekkolodd.t.step}
            unit="s"
            decimals={3}
          />
        )}
        {torden ? (
          <Slider
            label="Frekvens i tordenbrølet f"
            value={fTorden}
            onChange={setFTorden}
            min={SLIDERS.torden.f.min}
            max={SLIDERS.torden.f.max}
            step={SLIDERS.torden.f.step}
            unit="Hz"
          />
        ) : (
          <Slider
            label="Frekvens fra ekkoloddet f"
            value={fLodd}
            onChange={setFLodd}
            min={SLIDERS.ekkolodd.f.min}
            max={SLIDERS.ekkolodd.f.max}
            step={SLIDERS.ekkolodd.f.step}
            unit="kHz"
          />
        )}
      </Controls>
      <Toolbar>
        <PlayControls clock={clock} decimals={torden ? 1 : 3} label="Tid" />
      </Toolbar>

      <div ref={ref}>
        {torden ? <TordenScene T={T} tau={tau} f={f} s={s} speed={speed} /> : <LoddScene T={T} tau={tau} f={f} s={s} speed={speed} />}
        <BolgelengdeFigur sit={sit} fHz={fHz} height={bolgelengdeHeight(f)} />
      </div>
      <Legend
        items={[
          { color: SOUND, label: torden ? 'Lydbølgen (sterkest farge: fortetninger)' : 'Lydpulsen og ekkoet (sterkest farge: fortetninger)' },
          { color: VIZ.velocity, label: 'Lydfarten v' },
          ...(torden ? [{ color: LIGHT, label: 'Lyset fra lynet' }] : []),
        ]}
      />

      {torden ? <TordenTall T={T} lam={lam} /> : <LoddTall T={T} lam={lam} />}
      {torden ? <TordenFormel T={T} fHz={fHz} /> : <LoddFormel T={T} fHz={fHz} />}

      <Explain>{torden ? tordenText(T, tau, clock.playing, fHz) : loddText(T, tau, clock.playing, fHz)}</Explain>
    </VizLayout>
  );
}

/* ---------- Tall og utregning ---------- */

function TordenTall({ T, lam }: { T: number; lam: number }) {
  const d = lightningDistance(T);
  return (
    <Readouts>
      <Readout label="Målt tid t" value={fmt(T, 1)} unit="s" />
      <Readout label="Avstand d = v · t" value={fmt(d / 1000, 2)} unit="km" tone={SOUND} />
      <Readout
        label={
          <>
            Lyset bruker t<Sub>lys</Sub> = d / c
          </>
        }
        value={fmt(lightTime(d) * 1e6, 1)}
        unit="μs"
      />
      <Readout label="Bølgelengde i luft λ = v / f" value={fmtLength(lam)} tone={VIZ.ink} />
    </Readouts>
  );
}

function LoddTall({ T, lam }: { T: number; lam: number }) {
  const d = echoDepth(T);
  return (
    <Readouts>
      <Readout label="Målt tid t" value={fmt(T, 3)} unit="s" />
      <Readout label="Lydens vei 2d = v · t" value={fmt(2 * d, 0)} unit="m" />
      <Readout label="Dybde d = v · t / 2" value={fmt(d, 1)} unit="m" tone={SOUND} />
      <Readout label="Bølgelengde i vann λ = v / f" value={fmtLength(lam)} tone={VIZ.ink} />
    </Readouts>
  );
}

function TordenFormel({ T, fHz }: { T: number; fHz: number }) {
  const d = lightningDistance(T);
  return (
    <Formula label="Utregning av avstanden til lynet, tiden lyset bruker og bølgelengden">
      <FormulaLine>
        d = v · t = {fmt(V_LUFT, 0)} m/s · {fmt(T, 1)} s = {fmt(d, 0)} m = {fmt(d / 1000, 2)} km
      </FormulaLine>
      <FormulaLine>
        t<Sub>lys</Sub> = d / c = {fmt(d, 0)} m / ({fmtSci(C_LYS, 2)} m/s) = {fmtSci(lightTime(d), 1)} s, altså ingenting å regne med
      </FormulaLine>
      <FormulaLine>
        Tommelfingerregel: d ≈ t / 3 km = {fmt(T, 1)} / 3 km = {fmt(ruleOfThumbKm(T), 2)} km (lyden går ca. 1 km på 3 s)
      </FormulaLine>
      <FormulaLine>
        λ = v / f = {fmt(V_LUFT, 0)} m/s / {fmt(fHz, 0)} Hz = {fmtLength(wavelength(V_LUFT, fHz))}
      </FormulaLine>
    </Formula>
  );
}

function LoddFormel({ T, fHz }: { T: number; fHz: number }) {
  const d = echoDepth(T);
  return (
    <Formula label="Utregning av dybden og bølgelengden for ekkoloddet">
      <FormulaLine>Lyden går ned til bunnen og opp igjen: 2d = v · t</FormulaLine>
      <FormulaLine>
        d = v · t / 2 = {fmt(V_VANN, 0)} m/s · {fmt(T, 3)} s / 2 = {fmt(d, 1)} m
      </FormulaLine>
      <FormulaLine>
        λ = v / f = {fmt(V_VANN, 0)} m/s / {fmt(fHz, 0)} Hz = {fmt(wavelength(V_VANN, fHz), 4)} m = {fmtLength(wavelength(V_VANN, fHz))}
      </FormulaLine>
      <FormulaLine>
        Samme frekvens i luft: λ = {fmt(V_LUFT, 0)} m/s / {fmt(fHz, 0)} Hz = {fmtLength(wavelength(V_LUFT, fHz))}
      </FormulaLine>
    </Formula>
  );
}

/* ---------- Forklaring ---------- */

function tordenText(T: number, tau: number, playing: boolean, fHz: number): ReactNode {
  const d = lightningDistance(T);
  const dTxt = fmtDistance(d);
  let now: string;
  if (tau === 0 && !playing) {
    now = `Lynet slår ned ${dTxt} unna. Lyset bruker bare ${fmt(lightTime(d) * 1e6, 1)} μs på veien, så du ser glimtet med en gang og starter stoppeklokka. Trykk «Spill av» og se lyden komme etter.`;
  } else if (tau < T) {
    now = `Lydbølgen har gått ${fmt(V_LUFT * tau, 0)} m av ${fmt(d, 0)} m. Den brer seg ut som en halvkule rundt nedslaget med samme fart, 340 m/s, i alle retninger.`;
  } else {
    now = `Etter ${fmt(T, 1)} s når tordenen fram, og d = v · t = ${dTxt}. Tordenen ruller videre i flere sekunder fordi lyden fra høyere opp i lynet har lenger vei: fra ${fmt(LYN_HOYDE / 1000, 0)} km opp kommer den ${fmt(rumbleDelay(d), 1)} s senere.`;
  }
  const lamAir = wavelength(V_LUFT, fHz);
  const lamWater = wavelength(V_VANN, fHz);
  return (
    <>
      <p>{now}</p>
      <p>
        Vanlig feil: å tro at tordenen lages etter lynet. Lyn og torden skjer samtidig, men lys går nesten en million ganger raskere enn lyd. Del sekundene på 3, så
        får du omtrent kilometer. Er det under 30 s, er uværet så nær at du bør søke ly.
      </p>
      <p>
        Den dype rumlingen på {fmt(fHz, 0)} Hz har bølgelengden {fmtLength(lamAir)} i luft{lamAir > 1.8 ? ', lengre enn en person er høy' : ''}. Samme lyd i vann
        får {fmtLength(lamWater)}: frekvensen bestemmes av kilden, mens farten og dermed λ = v / f bestemmes av stoffet lyden går i.
      </p>
    </>
  );
}

function loddText(T: number, tau: number, playing: boolean, fHz: number): ReactNode {
  const d = echoDepth(T);
  const p = echoPulse(tau, d);
  let now: string;
  if (tau === 0 && !playing) {
    now = 'Ekkoloddet under båten sender en kort puls med ultralyd rett ned og måler tiden til ekkoet fra bunnen er tilbake. Trykk «Spill av» for å se pulsen i sakte film.';
  } else if (p.phase === 'ned') {
    now = `Pulsen er på vei ned, ${fmt(p.depth, 0)} m under båten. Den går ${fmt(V_VANN, 0)} m/s, over fire ganger raskere enn lyd i luft, fordi vann er mye vanskeligere å presse sammen enn luft.`;
  } else if (p.phase === 'opp') {
    now = `Pulsen har truffet bunnen og er på vei opp igjen som ekko. Den har gått ${fmt(p.travelled, 0)} m, og ekkoloddet venter fortsatt.`;
  } else {
    now = `Ekkoet er tilbake etter ${fmt(T, 3)} s. Lyden har gått ned og opp, 2d = v · t = ${fmt(2 * d, 0)} m, så dybden er d = ${fmt(d, 1)} m.`;
  }
  const lamWater = wavelength(V_VANN, fHz);
  return (
    <>
      <p>{now}</p>
      <p>
        Vanlig feil: å glemme å dele på 2. Da får du {fmt(2 * d, 0)} m, dobbelt så dypt som det egentlig er, fordi tiden t gjelder hele turen ned og opp.
      </p>
      <p>
        Ekkoloddet sender ultralyd på {fmt(fHz / 1000, 0)} kHz, over det mennesker kan høre (ca. 20 kHz). I vann blir λ = v / f = {fmtLength(lamWater)}. Den korte
        bølgelengden gjør at også små ting, som en fiskestim, gir et tydelig ekko.
      </p>
    </>
  );
}
