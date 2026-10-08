import { useEffect, useRef, useState, type ReactNode } from 'react';
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
  Sup,
  Toolbar,
  VIZ,
  VizLayout,
  fmt,
  fmtSci,
  useSimClock,
} from '../../kit';
import { C14Scene, SCENE_W, c14Layout } from './c14-scene';
import { MainGraph, ZoomGraph, ageText, type GraphState } from './c14-graf';
import {
  C14_SAMPLES,
  HALF_LIFE,
  MEASURED_PCT,
  T_AXIS_MAX,
  UNCERTAINTY_PCT,
  activityPerGram,
  c14AtomsPerGram,
  ageInterval,
  datingLimit,
  decaysPerHour,
  fractionLeft,
  getSample,
  halfLives,
  playbackAge,
  remainingOf,
  roundAge,
  sampleForPercent,
  samplePercent,
  type AgeInterval,
  type SampleId,
} from './model-c14';
import { PlayBar } from './PlayBar';

const READ = VIZ.series[0]!;
const CURVE = VIZ.series[1]!;

/** Avspillingen «fra døden til i dag» tar ca. 6 s. */
const PLAY_SECONDS = 6;

/** Om elementet er smalere enn `limit` piksler (mobil): da står lupa over benken og forstørrelsen får egen graf. */
function useNarrow<T extends HTMLElement>(limit = 560) {
  const ref = useRef<T>(null);
  const [narrow, setNarrow] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const update = () => {
      const w = el.getBoundingClientRect().width;
      if (w > 0) setNarrow(w < limit);
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [limit]);
  return [ref, narrow] as const;
}

/** Tall med n gjeldende siffer: 0,5266 → «0,527», 0,0265 → «0,0265», 0,9240 → «0,924». */
function sig(v: number, n = 3): string {
  if (!Number.isFinite(v)) return '–';
  if (v === 0) return '0';
  const d = Math.max(0, n - 1 - Math.floor(Math.log10(Math.abs(v))));
  return fmt(v, d);
}

const pctText = (p: number) => `${fmt(p * 100, 1)}\u00a0%`;
/** «± 0,3 %» med harde mellomrom, så det ikke brytes over to linjer. */
const pmText = (u: number) => `±\u00a0${fmt(u * 100, 1)}\u00a0%`;

/**
 * Karbon-14-datering (8A, 8B): levende organismer har samme C-14-andel som lufta. Etter døden henfaller C-14 med
 * halveringstid 5730 år. Eleven velger en prøve (eller flytter målingen selv), leser av alderen i grafen og ser i
 * forstørrelsen hvorfor metoden ikke virker for veldig gamle prøver.
 */
export default function C14Datering() {
  const [sampleId, setSampleId] = useState<SampleId>('otzi');
  const [pct, setPct] = useState(() => samplePercent(getSample('otzi')));
  const [uPct, setUPct] = useState<number>(UNCERTAINTY_PCT.initial);
  // Klokka går fra 0 (organismen dør) til 1 (i dag, når prøven måles). Siden åpner med målingen.
  const clock = useSimClock({ tMax: 1, speed: 1 / PLAY_SECONDS });
  const { setT, pause } = clock;
  useEffect(() => setT(1), [setT]);
  const [sceneRef, narrow] = useNarrow<HTMLDivElement>();

  const shown = sampleForPercent(sampleId, pct);
  const p = pct / 100;
  const u = uPct / 100;
  const iv = ageInterval(p, u);
  const done = clock.t >= 1 - 1e-9;
  const ageNow = done ? (Number.isFinite(iv.age) ? iv.age : T_AXIS_MAX) : playbackAge(clock.t, p);
  const pNow = done ? p : fractionLeft(ageNow);
  const measuring = done && !clock.playing;
  const state: GraphState = { p, u, ageNow, pNow, showReading: done };

  const pick = (id: SampleId | 'egen') => {
    if (id === 'egen') return;
    setSampleId(id);
    setPct(samplePercent(getSample(id)));
    pause();
    setT(1);
  };
  const changePct = (v: number) => {
    setPct(Math.round(v * 10) / 10);
    pause();
    setT(1);
  };

  const timeText = done ? (iv.datable ? ageText(iv.age) : `mer enn ${ageText(iv.young)}`) : ageText(ageNow);
  const L = c14Layout(narrow);
  const graphH = narrow ? 560 : 400;
  const name = shown ? getSample(shown).name.toLocaleLowerCase('nb') : 'en ukjent prøve';
  const left = remainingOf(100, pNow);

  const sceneLabel =
    `Labbenk med ${name} og en C-14-måler som viser ${pctText(pNow)}. ` +
    `En lupe viser 100 av C-14-atomene i prøven da den døde: ${left} er fortsatt C-14, resten har henfalt til nitrogen-14.`;
  const graphLabel =
    `Graf over andelen C-14 som er igjen mot tida siden døden. Kurven halveres for hver 5730 år. ` +
    (iv.datable
      ? `Målt andel ${pctText(p)} gir en alder på ${ageText(iv.age)}, mellom ${ageText(iv.young)} og ${ageText(iv.old)}.`
      : `Målt andel ${pctText(p)} er mindre enn måleusikkerheten, så prøven er eldre enn ${ageText(iv.young)}.`);

  return (
    <VizLayout>
      <Toolbar>
        <Segmented
          label="Velg prøve"
          options={C14_SAMPLES.map((s) => ({ value: s.id, label: s.label }))}
          value={shown ?? 'egen'}
          onChange={pick}
        />
      </Toolbar>
      <Controls>
        <Slider
          label={
            <span>
              Målt C-14-andel N/N<Sub>0</Sub>
            </span>
          }
          ariaLabel="Målt C-14-andel"
          value={pct}
          onChange={changePct}
          min={MEASURED_PCT.min}
          max={MEASURED_PCT.max}
          step={MEASURED_PCT.step}
          format={(v) => `${fmt(v, 1)} %`}
        />
        <Slider
          label="Måleusikkerhet"
          value={uPct}
          onChange={(v) => setUPct(Math.round(v * 10) / 10)}
          min={UNCERTAINTY_PCT.min}
          max={UNCERTAINTY_PCT.max}
          step={UNCERTAINTY_PCT.step}
          format={(v) => `± ${fmt(v, 1)} %`}
        />
      </Controls>
      <Toolbar>
        <PlayBar clock={clock} time={timeText} />
      </Toolbar>

      <div ref={sceneRef}>
        <Figure viewBox={`0 0 ${SCENE_W} ${L.h}`} label={sceneLabel}>
          <C14Scene sample={shown} p={pNow} narrow={narrow} measuring={measuring} />
        </Figure>
      </div>

      <Figure viewBox={`0 0 800 ${graphH}`} label={graphLabel}>
        <MainGraph state={state} height={graphH} inset={!narrow} />
      </Figure>
      {narrow && (
        <Figure
          viewBox="0 0 800 470"
          label={`Forstørret utsnitt av grafen fra 20 000 til 60 000 år og fra 0 til 10 prosent. Grensen for metoden er ca. ${ageText(datingLimit(u))}.`}
          caption="Forstørret: de siste 10 prosentene, der kurven er nesten flat."
        >
          <ZoomGraph state={state} width={800} height={470} />
        </Figure>
      )}
      <Legend
        items={[
          { color: CURVE, label: 'C-14 igjen (atomer i lupa og kurven)' },
          { color: VIZ.muted, label: 'Henfalt til N-14' },
          { color: READ, label: 'Målingen ± usikkerhet, og alderen den gir' },
        ]}
      />

      <Readouts>
        <Readout
          label={
            <span>
              C-14 igjen N/N<Sub>0</Sub>
            </span>
          }
          value={fmt(pNow * 100, 1)}
          unit="%"
          tone={CURVE}
        />
        <Readout label="Halveringstider n" value={done && !iv.datable ? `> ${fmt(halfLives(p + u), 1)}` : fmt(halfLives(pNow), 2)} />
        <Readout
          label="Alder t"
          value={done ? (iv.datable ? fmt(roundAge(iv.age), 0) : `> ${fmt(roundAge(iv.young), 0)}`) : fmt(roundAge(ageNow), 0)}
          unit="år"
          tone={READ}
        />
        <Readout label="Aktivitet per gram karbon" value={sig(activityPerGram(pNow), 3)} unit="Bq" />
      </Readouts>

      <Formula label="Henfallsloven med levende tall">
        <Calculation p={done ? p : pNow} u={u} iv={done ? iv : ageInterval(pNow, 0)} showUncertainty={done} />
      </Formula>

      <Explain>{explanation({ sample: shown, p, u, iv, done, ageNow, pNow })}</Explain>
    </VizLayout>
  );
}

/* ---------- Utregningen ---------- */

function Calculation({ p, u, iv, showUncertainty }: { p: number; u: number; iv: AgeInterval; showUncertainty: boolean }) {
  const n = halfLives(p);
  const A = activityPerGram(p);
  const A0 = activityPerGram(1);
  const first = (
    <FormulaLine>
      N = N<Sub>0</Sub> · (½)
      <Sup>t/T</Sup> gir N/N<Sub>0</Sub> = {pctText(p)} = {sig(p, 3)}
    </FormulaLine>
  );
  const activity = (
    <FormulaLine>
      A = A<Sub>0</Sub> · N/N<Sub>0</Sub> = {sig(A0, 3)} Bq · {sig(p, 3)} = {sig(A, 3)} Bq i hvert gram karbon
    </FormulaLine>
  );
  if (p <= 0) {
    return (
      <>
        {first}
        <FormulaLine>
          n = lg(N<Sub>0</Sub>/N) / lg 2 kan ikke regnes ut når N = 0: det er ikke noe C-14 igjen å måle.
        </FormulaLine>
        <FormulaLine>
          Med usikkerheten {pmText(u)} kan andelen være opptil {pctText(u)}, så t &gt; {ageText(iv.young)}.
        </FormulaLine>
        {activity}
      </>
    );
  }
  return (
    <>
      {first}
      <FormulaLine>
        n = lg(N<Sub>0</Sub>/N) / lg 2 = lg(1/{sig(p, 3)}) / lg 2 = {sig(n, 3)}
      </FormulaLine>
      <FormulaLine>
        t = n · T = {sig(n, 3)} · {fmt(HALF_LIFE, 0)} år = {fmt(n * HALF_LIFE, 0)} år ≈ {ageText(iv.age)}
      </FormulaLine>
      {showUncertainty &&
        (iv.datable ? (
          <FormulaLine>
            {pctText(p)} {pmText(u)} betyr mellom {pctText(p - u)} og {pctText(Math.min(1, p + u))}, og det gir t mellom {ageText(iv.young)} og{' '}
            {ageText(iv.old)}
          </FormulaLine>
        ) : (
          <FormulaLine>
            {pctText(p)} {pmText(u)} kan være 0, så vi vet bare at t &gt; {ageText(iv.young)}
          </FormulaLine>
        ))}
      {activity}
    </>
  );
}

/* ---------- Forklaringen ---------- */

function explanation({
  sample,
  p,
  u,
  iv,
  done,
  ageNow,
  pNow,
}: {
  sample: SampleId | null;
  p: number;
  u: number;
  iv: AgeInterval;
  done: boolean;
  ageNow: number;
  pNow: number;
}): ReactNode {
  const width = iv.datable ? roundAge(iv.old) - roundAge(iv.young) : Number.POSITIVE_INFINITY;
  const limit = datingLimit(u);
  const nLimit = halfLives(u);

  const principle = (
    <p>
      <strong>Mens en organisme lever, har den like stor C-14-andel som lufta.</strong> C-14 dannes hele tiden høyt oppe i atmosfæren, når nøytroner
      fra kosmisk stråling treffer nitrogen. Planter tar det opp som CO<Sub>2</Sub> ved fotosyntesen, og dyr og mennesker får det i seg gjennom maten.{' '}
      <strong>Når organismen dør, stopper opptaket</strong>, men C-14 fortsetter å henfalle (β<Sup>−</Sup>): <sup>14</sup>C → <sup>14</sup>N + e
      <Sup>−</Sup> + antinøytrino. C-14 dannes altså ikke når organismen dør. Det som skjer, er at det ikke kommer nytt C-14 inn.
    </p>
  );

  let main: ReactNode;
  if (!done) {
    const lost = 100 - remainingOf(100, pNow);
    main = (
      <p>
        <strong>Prøven eldes:</strong> {ageText(ageNow)} etter døden er {pctText(pNow)} av C-14 igjen, og {lost} av de 100 atomene i lupa har blitt
        til N-14. Legg merke til at det er en fast <em>andel</em> som henfaller, ikke et fast antall: de første {fmt(HALF_LIFE, 0)} årene forsvinner halvparten (50
        atomer), de neste {fmt(HALF_LIFE, 0)} årene halvparten av resten (25 atomer). Hvilke atomer som henfaller, er tilfeldig.
      </p>
    );
  } else if (sample === 'dinosaur') {
    main = (
      <p>
        <strong>Dinosaurer kan ikke dateres med C-14.</strong> De døde ut for 66 millioner år siden, og det er over 11 500 halveringstider. Da er
        andelen (½)<Sup>11 500</Sup>, et tall med over 3 400 nuller etter kommaet: ikke ett eneste C-14-atom er igjen. Fossilet er dessuten blitt til
        stein, så det er knapt noe av det opprinnelige karbonet igjen heller. Målingen viser 0 % {pmText(u)}, og det eneste vi kan si, er at prøven er
        eldre enn ca. {ageText(iv.young)}. Fossiler dateres i stedet med radioaktive stoffer med mye lengre halveringstid, for eksempel uran-238
        (4,47 milliarder år), i vulkanske lag over og under fossilet.
      </p>
    );
  } else if (p >= 1) {
    main = (
      <p>
        <strong>100 % betyr at prøven har like mye C-14 som en levende organisme.</strong> Den er helt ny, eller organismen lever. Med usikkerheten
        {pmText(u)} kan den likevel være opptil {ageText(iv.old)} gammel: de første årene henfaller så lite at vi ikke kan måle forskjellen.
      </p>
    );
  } else if (!iv.datable) {
    main = (
      <p>
        <strong>{pctText(p)} er mindre enn måleusikkerheten {pmText(u)}.</strong> Målingen kan ikke skilles fra en prøve uten C-14, så alt vi kan si,
        er at prøven er eldre enn ca. {ageText(iv.young)}. Pila langs tidsaksen viser at alderen kan være hva som helst over det.
        {p > 0 && (
          <>
            {' '}
            Lupa viser bare 100 atomer, så der er alle borte. I hvert gram karbon er det likevel ca. {fmtSci(c14AtomsPerGram(p), 1)} C-14-atomer
            igjen, men de henfaller så sjelden at det bare blir ca. {fmt(Math.max(1, Math.round(decaysPerHour(p))), 0)} henfall i timen.
          </>
        )}
      </p>
    );
  } else {
    const n = halfLives(p);
    const where =
      n < 1
        ? 'Det har gått mindre enn én halveringstid, så mer enn halvparten er igjen.'
        : n < 2
          ? 'Det er mellom én og to halveringstider: mellom halvparten og en fjerdedel er igjen.'
          : `Det har gått ${sig(n, 2)} halveringstider. Etter to halveringstider er det fortsatt 25 % igjen, ikke null, og etter tre er det 12,5 %.`;
    const intro: Record<SampleId, ReactNode> = {
      vikingskip: (
        <>
          <strong>Vikingskipet:</strong> eika ble hogd da skipet ble bygd, for ca. {ageText(iv.age)} siden. Bare {pctText(1 - p)} av C-14 har henfalt.
          Klinknaglene i jern kan ikke dateres med C-14, for jern har aldri vært levende og tatt opp karbon. Det er treverket som dateres.{' '}
        </>
      ),
      otzi: (
        <>
          <strong>Ötzi</strong> ble funnet i en isbre i Alpene i 1991. Beinet hans har {pctText(p)} av C-14-andelen i en levende person, så han døde
          for ca. {ageText(iv.age)} siden, i slutten av steinalderen.{' '}
        </>
      ),
      ildsted: (
        <>
          <strong>Trekull</strong> er en av de vanligste prøvene i arkeologien: bålet ble tent på en boplass i steinalderen, for ca. {ageText(iv.age)}{' '}
          siden. Det er alderen til veden vi måler, altså når treet sluttet å ta opp karbon.{' '}
        </>
      ),
      mammut: (
        <>
          <strong>Mammuten</strong> døde for ca. {ageText(iv.age)} siden, i siste istid. Nå er bare {pctText(p)} igjen, og kurven er nesten flat:
          se forstørrelsen.{' '}
        </>
      ),
      dinosaur: null,
    };
    main = (
      <p>
        {sample ? intro[sample] : <strong>Din prøve har {pctText(p)} igjen. </strong>}
        {where} Les av grafen: gå vannrett fra {pctText(p)} til kurven og loddrett ned til tidsaksen. Usikkerheten {pmText(u)} gir alderen{' '}
        {ageText(iv.young)}–{ageText(iv.old)}, et intervall på {fmt(width, 0)} år.
      </p>
    );
  }

  const young = ageInterval(fractionLeft(1200), u);
  const youngWidth = roundAge(young.old) - roundAge(young.young);
  const limitActivity = decaysPerHour(u);
  const old = (
    <p>
      <strong>Hvorfor virker ikke metoden for veldig gamle prøver?</strong> Kurven blir nesten flat. For en prøve på {ageText(1200)} gir usikkerheten {pmText(u)}
      et intervall på bare ca. {fmt(youngWidth, 0)} år, men jo mindre som er igjen, jo bredere blir intervallet. Ved ca. {ageText(limit)} ({sig(nLimit, 2)}{' '}
      halveringstider) er det like lite C-14 igjen som usikkerheten i målingen, og eldre prøver kan ikke skilles fra en prøve uten C-14. Da er
      aktiviteten bare ca. {fmt(Math.round(limitActivity), 0)} henfall i timen per gram karbon, mot {fmt(Math.round(decaysPerHour(1) / 10) * 10, 0)} i en levende
      organisme, og det drukner i bakgrunnsstrålingen. En dobbelt så nøyaktig måling flytter grensen bare én halveringstid ({fmt(HALF_LIFE, 0)} år)
      lenger tilbake, fordi andelen halveres for hver halveringstid.
    </p>
  );

  return (
    <>
      {principle}
      {main}
      {old}
      <p>
        Modellen antar at C-14-andelen i lufta har vært den samme hele tiden. Den har variert litt, så laboratoriene justerer alderen ved hjelp av
        årringer i gamle trær. Ekte laboratorier teller enten henfallene i prøven eller C-14-atomene direkte, i et massespektrometer.
      </p>
    </>
  );
}

