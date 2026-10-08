import { useState, type ReactNode } from 'react';
import { Controls, Explain, Formula, FormulaLine, Readout, Readouts, Segmented, Slider, Sub, Toolbar, VizLayout, fmtSci } from '../../kit';
import { SpektrumBand } from './em-spekteret-band';
import { useContainerScale } from './em-spekteret-deler';
import { waveColor } from './em-spekteret-farger';
import { HverdagScene } from './em-spekteret-scener';
import {
  BINDING_EV,
  C,
  E_CHARGE,
  EXAMPLES,
  H,
  IONISERING_EV,
  P_OVN,
  P_RUTER,
  SLIDER,
  T_KROPP,
  WIEN_B,
  atExample,
  bandPos,
  colorName,
  energyEv,
  example,
  fmtEv,
  fmtFreq,
  fmtLambda,
  fmtSig,
  frequency,
  hotSpotSpacing,
  isIonizing,
  lambdaAtPos,
  nearestExample,
  photonEnergy,
  photonsPerBond,
  regionOf,
  sizeComparison,
  wavelength,
  type ExampleId,
} from './model-em-spekteret';

export default function EmSpekteret() {
  const [lambda, setLambda] = useState(example('mikro').lambda);
  const { ref, f, s } = useContainerScale();
  const ex = nearestExample(lambda);
  const reg = regionOf(lambda);
  const nm = lambda * 1e9;
  const tone = waveColor(reg.id, nm);

  return (
    <VizLayout>
      <Toolbar>
        <Segmented<ExampleId>
          label="Eksempel fra hverdagen"
          options={EXAMPLES.map((e) => ({ value: e.id, label: e.knapp }))}
          value={ex.id}
          onChange={(id) => setLambda(example(id).lambda)}
        />
      </Toolbar>
      <Controls>
        <Slider
          label="Bølgelengde λ"
          value={bandPos(lambda)}
          onChange={(p) => setLambda(lambdaAtPos(p))}
          min={SLIDER.min}
          max={SLIDER.max}
          step={SLIDER.step}
          format={() => fmtLambda(lambda)}
        />
      </Controls>

      <div ref={ref}>
        <SpektrumBand lambda={lambda} f={f} s={s} onLambda={setLambda} onExample={(id) => setLambda(example(id).lambda)} />
        <HverdagScene id={ex.id} lambda={lambda} f={f} s={s} />
      </div>

      <Readouts>
        <Readout label="Bølgelengde λ" value={fmtLambda(lambda)} tone={tone} />
        <Readout label="Frekvens f = c / λ" value={fmtFreq(frequency(lambda))} />
        <Readout label="Fotonenergi E = hf" value={fmtSci(photonEnergy(lambda), 2)} unit="J" />
        <Readout label="Fotonenergi i eV" value={fmtEv(energyEv(lambda))} tone={isIonizing(lambda) ? tone : undefined} />
      </Readouts>

      <Formula label="Utregning av frekvensen og fotonenergien">
        <FormulaLine>
          f = c / λ = {fmtSci(C, 2)} m/s / {sci3(lambda)} m = {fmtSci(frequency(lambda), 2)} Hz
        </FormulaLine>
        <FormulaLine>
          E = hf = {fmtSci(H, 2)} J s · {fmtSci(frequency(lambda), 2)} Hz = {fmtSci(photonEnergy(lambda), 2)} J
        </FormulaLine>
        <FormulaLine>
          E = {fmtSci(photonEnergy(lambda), 2)} J / ({fmtSci(E_CHARGE, 2)} J/eV) = {fmtEv(energyEv(lambda))}
          {isIonizing(lambda) ? `, over ca. ${IONISERING_EV} eV: ioniserende` : `, under ca. ${IONISERING_EV} eV: ikke ioniserende`}
        </FormulaLine>
      </Formula>

      <Explain>{explainText(lambda)}</Explain>
    </VizLayout>
  );
}

/** Tall med tre gjeldende siffer: vanlig form for 0,01–9999, ellers standardform («0,122», «9,35 · 10⁻⁶»). */
function sci3(v: number): string {
  const e = Math.floor(Math.log10(Math.abs(v)));
  return e >= -2 && e <= 3 ? fmtSig(v, 3) : fmtSci(v, 2);
}

/* ---------- Forklaring ---------- */

function explainText(lambda: number): ReactNode {
  const ex = nearestExample(lambda);
  const reg = regionOf(lambda);
  const at = atExample(lambda, ex);
  const ev = energyEv(lambda);
  const nm = lambda * 1e9;
  const where =
    reg.id === 'synlig'
      ? `synlig lys, som vi ser som ${colorName(nm)}`
      : reg.id === 'uv'
        ? 'ultrafiolett (UV)'
        : reg.id === 'gamma'
          ? 'gammastråling'
          : reg.id === 'rontgen'
            ? 'røntgenstråling'
            : reg.navn.toLowerCase();
  const first = (
    <p>
      λ = {fmtLambda(lambda)} er {where}. Bølgelengden er {sizeComparison(lambda)}. Frekvensen er f = c / λ = {fmtFreq(frequency(lambda))}, og hvert foton
      har energien E = hf = {fmtEv(ev)}.{at ? '' : ` Nærmeste eksempel fra hverdagen i bildet: ${ex.navn}.`}
    </p>
  );
  return (
    <>
      {first}
      <p>{exampleText(ex.id, lambda)}</p>
      <p>{misconception(lambda)}</p>
    </>
  );
}

function exampleText(id: ExampleId, lambda: number): ReactNode {
  const ex = example(id);
  switch (id) {
    case 'radio':
      return (
        <>
          DAB-radioen i bilen tar imot radiobølger på 200 MHz fra en sendermast. Bølgefrontene i bildet ligger én bølgelengde, {fmtLambda(ex.lambda)}, fra
          hverandre, i samme målestokk som bilen. Så lange bølger går gjennom vegger og bøyer seg rundt hindringer, så du har dekning nesten overalt.
        </>
      );
    case 'mobil':
      return (
        <>
          Mobilen snakker med mobilmasta på 800 MHz (4G), λ = {fmtLambda(ex.lambda)}. Masta sender i en vifte mot den delen av byen den dekker. Hjemme bruker
          mobilen wifi på 2,4 GHz eller 5 GHz, altså λ = {fmtLambda(wavelength(2.4e9))} og {fmtLambda(wavelength(5e9))}.
        </>
      );
    case 'mikro':
      return (
        <>
          Mikrobølgene på 2,45 GHz får vannmolekylene i maten til å vri seg fram og tilbake, og det blir varme. Bølgene reflekteres fra metallveggene, og der
          de forsterker hverandre mest, blir maten varmest. De varme flekkene ligger λ / 2 = {fmtLambda(hotSpotSpacing(ex.lambda), 2)} fra hverandre, derfor
          roterer tallerkenen. Uten tallerken smelter en sjokoladeplate i flekker, og c = λf = 2 · {fmtSig(hotSpotSpacing(ex.lambda), 3)} m · 2,45 · 10⁹ Hz = {fmtSci(2 * hotSpotSpacing(ex.lambda) * 2.45e9, 2)} m/s. Wifi-ruteren bruker nesten samme frekvens, men sender med ca.{' '}
          {fmtSig(P_RUTER, 1)} W ut i hele rommet i stedet for {P_OVN} W inne i en metallboks.
        </>
      );
    case 'varme':
      return (
        <>
          Alt som har en temperatur, sender ut varmestråling. Kroppen er ca. {T_KROPP} K, og etter Wiens lov stråler den mest ved λ<Sub>maks</Sub> = b / T ={' '}
          {fmtSci(WIEN_B, 2)} m K / {T_KROPP} K = {fmtLambda(ex.lambda)}. Varmekameraet er følsomt for ca. 8–14 µm og viser de varmeste delene lysest: ansiktet
          og hendene, mens klærne og håret er kaldere på utsiden.
        </>
      );
    case 'fjern':
      return (
        <>
          Lysdioden foran på fjernkontrollen blinker med infrarødt lys på 940 nm, rett utenfor det øyet kan se (750 nm). Mobilkameraet ser det: pek
          fjernkontrollen mot kameraet og trykk på en knapp, så ser du lyset blinke på skjermen. Hvert foton har {fmtEv(energyEv(ex.lambda))}, litt mindre enn
          rødt lys.
        </>
      );
    case 'synlig': {
      const nm = lambda * 1e9;
      return (
        <>
          Synlig lys er bare 380–750 nm, en smal stripe av hele spekteret. Regnbuen deler sollyset i farger fordi regndråpene bryter kort bølgelengde litt mer
          enn lang: rødt ({fmtLambda(700e-9)}) ytterst og fiolett ({fmtLambda(400e-9)}) innerst. Lys med {fmtLambda(Math.min(750e-9, Math.max(380e-9, lambda)))} ser
          vi som {colorName(nm)}. Du ser regnbuen bare når sola er bak deg.
        </>
      );
    }
    case 'uv':
      return (
        <>
          UV-B-fotonene (280–315 nm) har ca. {fmtEv(energyEv(ex.lambda))}, nok til å skade DNA-et i hudcellene direkte. Det er derfor du blir solbrent. Solkrem
          tar opp UV-fotonene i et tynt lag før de når huden. Snøen i påskefjellet reflekterer mesteparten av UV-strålingen, så huden får den både ovenfra og
          nedenfra.
        </>
      );
    case 'rontgen':
      return (
        <>
          Røntgenfotoner på {fmtLambda(ex.lambda)} har ca. {fmtEv(energyEv(ex.lambda))}. De går lett gjennom bløtvev, men blir oftere tatt opp i skjelettet, som
          inneholder tyngre atomer (kalsium). Derfor blir knoklene lyse på bildet, og bruddet i håndleddet etter en tur på glatta synes som en mørk strek.
          Røntgen er ioniserende, så bare den delen av kroppen som skal undersøkes, blir bestrålt.
        </>
      );
    case 'gamma':
      return (
        <>
          Gammastråling kommer fra atomkjerner. Strålekilden med cesium-137 i fysikklaben sender ut gammafotoner på 662 keV, λ = {fmtLambda(ex.lambda)}. Røntgen
          og gamma overlapper i spekteret: forskjellen er hvor fotonene kommer fra. Røntgen lages av elektroner som bremses opp, gamma kommer fra kjernen. GM-røret
          teller fotonene ett og ett.
        </>
      );
  }
}

function misconception(lambda: number): ReactNode {
  const ev = energyEv(lambda);
  const n = photonsPerBond(lambda);
  const reg = regionOf(lambda).id;
  if (isIonizing(lambda)) {
    return (
      <>
        Dette er ioniserende stråling: ett foton på {fmtEv(ev)} har nok energi til å rive løs elektroner fra atomer (over ca. {IONISERING_EV} eV) og kan
        bryte DNA. Vanlig misforståelse: at et bestrålt legeme blir radioaktivt. Kroppen, maten og utstyret blir ikke radioaktive av røntgen- eller
        gammastråling, på samme måte som du ikke lyser etter å ha vært i sola.
      </>
    );
  }
  if (reg === 'radio' || reg === 'mikro') {
    return (
      <>
        Vanlig misforståelse: at stråling fra mobilen, wifi eller mikrobølgeovnen er radioaktiv eller kan skade DNA. Det som avgjør, er energien til hvert
        enkelt foton, E = hf, og ett foton her har bare {fmtEv(ev)}. Det trengs ca. {BINDING_EV} eV for å bryte en kjemisk binding, altså energien til{' '}
        {fmtSci(n, 1)} slike fotoner samlet i ett. Sterkere stråling gir flere fotoner, ikke større fotoner. Det eneste mange fotoner kan gjøre, er å varme
        opp.
      </>
    );
  }
  if (reg === 'ir') {
    return (
      <>
        Vanlig misforståelse: at infrarødt er det samme som varme. IR er elektromagnetisk stråling, lys med for lang bølgelengde til at øyet ser det. Det blir
        varme først når strålingen tas opp, f.eks. i huden eller i sensoren i et varmekamera. Ett foton har {fmtEv(ev)}, for lite til å bryte en kjemisk
        binding (ca. {BINDING_EV} eV).
      </>
    );
  }
  return (
    <>
      Vanlig misforståelse: at høyere frekvens betyr raskere bølger. Alle elektromagnetiske bølger går med c = 3,00 · 10⁸ m/s i vakuum. Når f øker, blir λ
      tilsvarende kortere, så λ · f = c hele tiden. Det som øker, er energien per foton: her {fmtEv(ev)}
      {reg === 'synlig'
        ? ', nok til at synscellene i øyet reagerer, men for lite til å skade DNA.'
        : `, nok til å skade DNA, men for lite til å ionisere atomer (ca. ${IONISERING_EV} eV).`}
    </>
  );
}
