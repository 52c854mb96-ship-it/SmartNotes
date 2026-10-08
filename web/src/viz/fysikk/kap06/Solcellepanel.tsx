import { useState, type ReactNode } from 'react';
import { Controls, Explain, Formula, FormulaLine, Legend, Readout, Readouts, Segmented, Slider, Toolbar, VizLayout, fmt } from '../../kit';
import {
  ARSTIDER,
  ARSTID_IDS,
  JORDAKSE,
  PANEL,
  SLIDERS,
  STEDER,
  STED_IDS,
  ratio,
  solarPanel,
  type Arstid,
  type SolarPanelState,
  type StedId,
} from './model-solcellepanel';
import { EffektGraf, POWER, SEASON_COLOR, SolScene, useContainerScale } from './solcellepanel-figur';

const deg = (v: number, d = 1) => `${fmt(v, d)}°`;
/** «2,9» under 10, ellers «20». */
const times = (r: number) => fmt(r, r < 9.95 ? 1 : 0);

export default function Solcellepanel() {
  const [sted, setSted] = useState<StedId>('oslo');
  const [arstid, setArstid] = useState<Arstid>('sommer');
  const [beta, setBeta] = useState<number>(SLIDERS.vinkel.start);
  const [eta, setEta] = useState<number>(SLIDERS.virkningsgrad.start);
  const { ref, f, s, W } = useContainerScale();

  const st = solarPanel(sted, arstid, beta, eta);
  const sommer = solarPanel(sted, 'sommer', beta, eta);
  const vinter = solarPanel(sted, 'vinter', beta, eta);

  return (
    <VizLayout>
      <Toolbar>
        <Segmented<StedId> label="Sted" options={STED_IDS.map((id) => ({ value: id, label: STEDER[id].navn }))} value={sted} onChange={setSted} />
        <Segmented<Arstid> label="Årstid" options={ARSTID_IDS.map((id) => ({ value: id, label: ARSTIDER[id].navn }))} value={arstid} onChange={setArstid} />
      </Toolbar>
      <Controls>
        <Slider
          label="Panelvinkel β"
          value={beta}
          onChange={setBeta}
          min={SLIDERS.vinkel.min}
          max={SLIDERS.vinkel.max}
          step={SLIDERS.vinkel.step}
          format={(v) => deg(v, 0)}
        />
        <Slider
          label="Virkningsgrad η"
          value={eta}
          onChange={setEta}
          min={SLIDERS.virkningsgrad.min}
          max={SLIDERS.virkningsgrad.max}
          step={SLIDERS.virkningsgrad.step}
          format={(v) => `${fmt(v, 0)} %`}
        />
      </Controls>

      <div ref={ref}>
        <SolScene st={st} sted={sted} arstid={arstid} f={f} s={s} W={W} />
        <EffektGraf sted={sted} arstid={arstid} etaPct={eta} st={st} f={f} W={W} />
      </div>
      <Legend
        items={ARSTID_IDS.map((a) => {
          const sa = a === arstid ? st : solarPanel(sted, a, beta, eta);
          return {
            color: SEASON_COLOR[a],
            label: (
              <span>
                {ARSTIDER[a].navn} ({a === 'jevndogn' ? 'jevndøgn' : ARSTIDER[a].dato}){sa.sunUp ? '' : ': mørketid'}
              </span>
            ),
          };
        })}
      />

      <Readouts>
        <Readout label="Solhøyde h" value={deg(st.h)} />
        <Readout label="Vinkel θ mot normalen" value={st.sunUp ? deg(st.theta) : '–'} />
        <Readout label="Innstråling I" value={fmt(st.I, 0)} unit="W/m²" tone={SEASON_COLOR[arstid]} />
        <Readout label="Effekt P" value={fmt(st.P, 0)} unit="W" tone={POWER} />
      </Readouts>

      <Formula label="Utregning midt på dagen">
        <FormulaLine>
          h = 90° − φ{altitudeTerm(arstid)} = 90° − {deg(st.lat)}
          {altitudeValue(arstid)} = {deg(st.h)}
        </FormulaLine>
        <FormulaLine>{arstid === 'jevndogn' ? 'φ = breddegraden' : 'φ = breddegraden, 23,4° = helningen til jordaksen'}</FormulaLine>
        {st.sunUp ? (
          <>
            <FormulaLine>
              θ = |90° − h − β| = |90° − {deg(st.h)} − {deg(st.beta, 0)}| = {deg(st.theta)}
            </FormulaLine>
            <FormulaLine>
              P = η · I · A · cos θ = {fmt(st.eta, 2)} · {fmt(st.I, 0)} W/m² · {fmt(PANEL.areal, 2)} m² · cos {deg(st.theta)} = {fmt(st.P, 0)} W
            </FormulaLine>
          </>
        ) : (
          <FormulaLine>Sola er under horisonten: I = 0, så P = 0 W</FormulaLine>
        )}
      </Formula>

      <Explain>{explain(st, sted, arstid, sommer, vinter, eta)}</Explain>
    </VizLayout>
  );
}

function altitudeTerm(a: Arstid): string {
  return a === 'sommer' ? ' + 23,4°' : a === 'vinter' ? ' − 23,4°' : '';
}

function altitudeValue(a: Arstid): string {
  return a === 'sommer' ? ` + ${fmt(JORDAKSE, 1)}°` : a === 'vinter' ? ` − ${fmt(JORDAKSE, 1)}°` : '';
}

function explain(st: SolarPanelState, sted: StedId, arstid: Arstid, sommer: SolarPanelState, vinter: SolarPanelState, eta: number): ReactNode {
  const place = STEDER[sted].navn;
  const A = ARSTIDER[arstid];
  const best = st.best ?? 0;
  const nearlyBest = st.theta < 10;
  const pct = Math.round(st.cosTheta * 100);

  // 1. Hva du ser
  let what: ReactNode;
  if (!st.sunUp) {
    what = (
      <p>
        Midt på dagen {A.dato} står sola {deg(-st.h)} under horisonten i {place}. Det er mørketid, så panelet får ikke direkte sollys, uansett hvordan du
        stiller det. Velg en annen årstid eller et sted lenger sør.
      </p>
    );
  } else if (st.theta < 0.5) {
    what = (
      <p>
        Panelet står vinkelrett på sollyset: normalen peker rett mot sola, så θ ≈ 0° og cos θ ≈ 1. Panelet fanger hele lysbuntet, og effekten er så stor
        som den kan bli her. Dette er den beste vinkelen midt på dagen: β = 90° − h = {deg(best)}.
      </p>
    );
  } else if (nearlyBest) {
    what = (
      <p>
        Panelet står nesten vinkelrett på sollyset (θ = {deg(st.theta)}), så cos θ = {fmt(st.cosTheta, 3)} og panelet fanger nesten hele lysbuntet. Den beste
        vinkelen er β = 90° − h = {deg(best)}, men noen grader fra den betyr lite: cos θ endrer seg sakte nær 0°, og grafen er flat på toppen.
      </p>
    );
  } else {
    const flatter = st.beta < best;
    what = (
      <p>
        Panelet står {flatter ? 'flatere' : 'brattere'} enn den beste vinkelen. Lyset treffer {deg(st.theta)} fra normalen, så lysbuntet panelet fanger, har
        bare tverrsnittet A · cos θ = {fmt(st.effectiveArea, 2)} m², {pct} % av panelet. Vipp panelet {flatter ? 'brattere' : 'flatere'}, mot β ={' '}
        {deg(best)}, så normalen peker mot sola.
      </p>
    );
  }

  // 2. Sommer mot vinter
  let compare: ReactNode = null;
  if (arstid === 'vinter') {
    compare = st.sunUp ? (
      <p>
        Den lave vintersola gir to tap. Lyset går gjennom {fmt(st.airMass, 0)} ganger så mye luft som når sola står rett over oss, så innstrålingen er bare{' '}
        {fmt(st.I, 0)} W/m² (mot {fmt(sommer.I, 0)} W/m² i juni). Og lyset treffer skrått: flat mark får bare {fmt(st.groundI, 0)} W/m². Et bratt panel tar
        igjen det siste tapet, men ikke det første. Dagen er dessuten kort, ca. {fmt(st.dayLength, 0)} timer.
      </p>
    ) : (
      <p>
        I juni er det motsatt: midnattssol, og sola står {deg(sommer.h)} over horisonten midt på dagen. Da gir panelet {fmt(sommer.P, 0)} W med denne vinkelen.
      </p>
    );
  } else if (arstid === 'sommer') {
    const r = ratio(st.P, vinter.P);
    const rBest = ratio(st.Pbest, vinter.Pbest);
    compare = !vinter.sunUp ? (
      <p>
        Om vinteren gir panelet ingenting her, for i desember er det mørketid. Til gjengjeld er det midnattssol nå i juni: sola er oppe hele døgnet.
      </p>
    ) : (
      <p>
        Med samme vinkel gir panelet {fmt(vinter.P, 0)} W midt på dagen i desember{r !== null ? <>, altså {times(r)} ganger mindre</> : null}.
        {rBest !== null && (
          <>
            {' '}
            Stiller du panelet mot sola begge gangene, er forskjellen {times(rBest)} ganger.
          </>
        )}{' '}
        {sted === 'tromso'
          ? 'Og i juni er det midnattssol: sola er oppe hele døgnet.'
          : `Dagen er også mye kortere i desember: ca. ${fmt(vinter.dayLength, 0)} timer mot ${fmt(sommer.dayLength, 0)} timer i juni.`}
      </p>
    );
  } else {
    compare = (
      <p>
        Ved jevndøgn står sola {deg(st.h)} over horisonten midt på dagen, så den beste vinkelen er lik breddegraden, {deg(st.lat)}. Et fast panel kan bare ha
        én vinkel hele året, så den blir et kompromiss mellom sommer (beste {deg(sommer.best ?? 0, 0)}) og vinter
        {vinter.best !== null ? ` (beste ${deg(vinter.best, 0)})` : ' (mørketid)'}.
      </p>
    );
  }

  // 3. Misforståelser og begreper
  let tip: ReactNode;
  if (arstid === 'vinter') {
    tip = (
      <p>
        Vanlig misforståelse: vinteren kommer ikke av at jorda er lenger fra sola. Jorda er faktisk nærmest sola i begynnelsen av januar. Det er solhøyden
        som avgjør hvor mye energi som treffer hver kvadratmeter.
      </p>
    );
  } else if (!nearlyBest) {
    tip = (
      <p>
        Pass på: θ er vinkelen mellom sollyset og normalen (den stiplede linja vinkelrett på panelet), ikke vinkelen mellom sollyset og selve panelet. Bruker
        du vinkelen mot panelet ({deg(90 - st.theta)} her), må du bruke sinus i stedet for cosinus.
      </p>
    );
  } else {
    tip = (
      <p>
        Virkningsgraden η = {fmt(eta, 0)} % betyr at {fmt(eta, 0)} % av strålingsenergien som treffer panelet, blir elektrisk energi. Her treffer{' '}
        {fmt(st.incident, 0)} W panelet, og {fmt(st.P, 0)} W blir elektrisk. Resten blir for det meste varme i panelet.
      </p>
    );
  }

  return (
    <>
      {what}
      {compare}
      {tip}
    </>
  );
}
