import { useEffect, useRef, useState, type ReactNode } from 'react';
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
  Sup,
  Toggle,
  Toolbar,
  VIZ,
  VizLayout,
  fmt,
  useSimClock,
} from '../../kit';
import { CurlingScene, RED_STONE, YELLOW_STONE, curlingLayout } from './curling-scene';
import { CurlingBars, barsLayout, decimalsFor } from './curling-stolper';
import {
  CONTACT_TIME,
  HIT_KINDS,
  LOSS,
  MU_ICE,
  SPEED,
  STONE_MASS,
  bounceBack,
  curlingHit,
  curlingTimeline,
  frictionImpulse,
  iceFriction,
  strobeInterval,
  type CurlingHit,
  type HitKind,
} from './model-curling';

/**
 * Bredden på figuren (px), så vi kan velge viewBox og tekstskalering før figurene tegnes. Vi måler SVG-en slik
 * <Figure> gjør (etiketter er minst 12,5 px på skjermen), og elementet rundt før SVG-en finnes.
 */
function useFrame<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const update = () => {
      const svg = el.querySelector('svg');
      setWidth((svg ?? el).getBoundingClientRect().width);
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const narrow = width > 0 && width < 560;
  const vb = narrow ? 520 : 800;
  const f = width > 0 ? Math.round(Math.max(1, 12.5 / 17 / (width / vb)) * 20) / 20 : 1;
  return [ref, narrow, f] as const;
}

/** Fart i teksten: «2,00 m/s». */
const ms = (v: number) => `${fmt(v, 2)}\u00a0m/s`;
/** Fart i utregningen: to desimaler når det er eksakt, ellers tre (mellomsvar med ett siffer mer). */
const msCalc = (v: number) => `${fmt(v, Math.abs(v * 100 - Math.round(v * 100)) < 1e-6 ? 2 : 3)}\u00a0m/s`;

/** Hardt mellomrom mellom tall og enhet, så de ikke deles på to linjer. */
const NB = '\u00a0';

/** Hvor lang tid avspillingen tar (s). */
const PLAY_SECONDS = 4;

/**
 * Curling (4A, 4C, 4D): en rød curlingstein treffer en like tung gul stein som ligger midt i huset. Eleven velger
 * farten og hvor elastisk støtet er, og ser farten etter støtet, bevegelsesmengden og den kinetiske energien før og
 * etter. I et elastisk støt stopper den røde helt, og den gule tar over hele farten.
 */
export default function Curling() {
  const [v, setV] = useState<number>(SPEED.initial);
  const [kind, setKind] = useState<HitKind>('elastisk');
  const [loss, setLoss] = useState<number>(LOSS.initial);
  const [strobe, setStrobe] = useState(true);
  const [ref, narrow, f] = useFrame<HTMLDivElement>();

  const hit = curlingHit(v, kind, loss);
  const L = curlingLayout(narrow, f);
  const tl = curlingTimeline(v, L.approach, L.after);
  const dt = strobeInterval(v, L.strobeSpacing);

  // Klokka teller hvor langt vi er i forløpet (0–1), så vi beholder stedet når farten (og tidslinja) endres.
  // Sakte film: hele forløpet tar 4 s å spille av, uansett fart. Figuren starter når alt er over, så
  // stroboskopbildet viser hele forløpet.
  const clock = useSimClock({ tMax: 1, speed: 1 / PLAY_SECONDS });
  const { setT } = clock;
  useEffect(() => setT(1), [setT]);
  const t = Math.min(1, Math.max(0, clock.t)) * tl.tEnd;
  /** Klokka slik PlayControls viser den: ekte tid i sekunder. */
  const shown = { ...clock, t };

  const B = barsLayout(narrow, f);
  const kindLabel = HIT_KINDS.find((k) => k.value === kind)?.label ?? '';
  const ed = decimalsFor(hit.Ek);
  const pd = decimalsFor(hit.p);
  const lossPct = 100 * hit.lossShare;
  const m = fmt(STONE_MASS, 0);

  const sceneLabel =
    `Curling sett fra siden: en rød stein på ${m} kg glir med ${ms(v)} rett inn i en like tung gul stein som ligger i ro midt i huset. ` +
    `${kindLabel} støt: etter støtet har den røde ${ms(hit.v1)} og den gule ${ms(hit.v2)}.`;

  return (
    <VizLayout>
      <Controls>
        <Slider
          label={
            <>
              Fart før støtet v<Sub>1</Sub>
            </>
          }
          ariaLabel="Farten til den røde steinen før støtet"
          value={v}
          onChange={setV}
          min={SPEED.min}
          max={SPEED.max}
          step={SPEED.step}
          unit="m/s"
          decimals={1}
        />
        {kind === 'uelastisk' && (
          <Slider
            label={
              <>
                Tap av E<Sub>k</Sub> i støtet
              </>
            }
            ariaLabel="Hvor stor del av den kinetiske energien som går tapt i støtet"
            value={loss}
            onChange={setLoss}
            min={LOSS.min}
            max={LOSS.max}
            step={LOSS.step}
            format={(x) => `${fmt(100 * x, 0)} %`}
          />
        )}
      </Controls>
      <Toolbar>
        <Segmented label="Velg type støt" options={HIT_KINDS} value={kind} onChange={setKind} />
        <PlayControls clock={shown} />
        <Toggle label="Vis stroboskopbilde" checked={strobe} onChange={setStrobe} />
      </Toolbar>

      <div ref={ref}>
        <Figure viewBox={`0 0 ${L.W} ${L.H}`} label={sceneLabel} maxHeight={narrow ? 520 : 400}>
          <CurlingScene L={L} hit={hit} tl={tl} t={t} strobe={strobe} dt={dt} />
        </Figure>
        <Figure
          viewBox={`0 0 ${B.W} ${B.H}`}
          label="Liggende søyler: bevegelsesmengde og kinetisk energi før og etter støtet, delt på den røde og den gule steinen."
          maxHeight={narrow ? 520 : 360}
        >
          <CurlingBars hit={hit} L={B} />
        </Figure>
      </div>
      <Legend
        items={[
          { color: RED_STONE, label: 'Rød stein (1)' },
          { color: YELLOW_STONE, label: 'Gul stein (2)' },
          { color: VIZ.muted, dashed: true, label: 'Omdannet til lyd og indre energi' },
          { color: VIZ.velocity, label: 'Fart v' },
        ]}
      />

      <Readouts>
        <Readout
          label={
            <span>
              Rød etter, v<Sub>1</Sub>′
            </span>
          }
          value={fmt(hit.v1, 2)}
          unit="m/s"
          tone={VIZ.velocity}
        />
        <Readout
          label={
            <span>
              Gul etter, v<Sub>2</Sub>′
            </span>
          }
          value={fmt(hit.v2, 2)}
          unit="m/s"
          tone={VIZ.velocity}
        />
        <Readout label="Σp før og etter" value={fmt(hit.p, pd)} unit="kg·m/s" />
        <Readout
          label={
            <span>
              Tap av E<Sub>k</Sub>
            </span>
          }
          value={fmt(hit.lost, ed)}
          unit={`J (${fmt(lossPct, 0)} %)`}
        />
      </Readouts>

      <Formula label="Bevaring av bevegelsesmengde og kinetisk energi med levende tall">
        <Calculation hit={hit} />
      </Formula>

      <Explain>{explanation(hit)}</Explain>
    </VizLayout>
  );
}

/* ---------- Utregningen ---------- */

const V1 = () => (
  <>
    v<Sub>1</Sub>
  </>
);
const V1p = () => (
  <>
    v<Sub>1</Sub>′
  </>
);
const V2p = () => (
  <>
    v<Sub>2</Sub>′
  </>
);
const Ek = () => (
  <>
    E<Sub>k</Sub>
  </>
);

function Calculation({ hit }: { hit: CurlingHit }) {
  const m = `${fmt(STONE_MASS, 0)} kg`;
  const m2 = `${fmt(2 * STONE_MASS, 0)} kg`;
  const ed = decimalsFor(hit.Ek);
  const pd = decimalsFor(hit.p);
  const v = `${fmt(hit.v, 1)} m/s`;
  const p = `${fmt(hit.p, pd)} kg·m/s`;
  const E = `${fmt(hit.Ek, ed)}\u00a0J`;

  if (hit.kind === 'elastisk')
    return (
      <>
        <FormulaLine>
          Σp bevart: m · <V1 /> + m · 0 = m · <V1p /> + m · <V2p />, så <V1p /> + <V2p /> = <V1 /> (like masser)
        </FormulaLine>
        <FormulaLine>
          <Ek /> bevart: ½m · <V1 />
          <Sup>2</Sup> = ½m · <V1p />
          <Sup>2</Sup> + ½m · <V2p />
          <Sup>2</Sup>, så <V1p />
          <Sup>2</Sup> + <V2p />
          <Sup>2</Sup> = <V1 />
          <Sup>2</Sup>
        </FormulaLine>
        <FormulaLine>
          Sett inn <V2p /> = <V1 /> − <V1p />: 2<V1p /> · (<V1p /> − <V1 />) = 0, så <V1p /> = 0 eller <V1p /> = <V1 />
        </FormulaLine>
        <FormulaLine>
          <V1p /> = <V1 /> ville betydd at steinene ikke traff hverandre, så <V1p /> = 0 og <V2p /> = <V1 /> = {v}
        </FormulaLine>
        <FormulaLine>
          Σp = {m} · {v} = {p} og <Ek /> = ½ · {m} · ({v})<Sup>2</Sup> = {E}, både før og etter
        </FormulaLine>
      </>
    );

  if (hit.kind === 'fullstendig')
    return (
      <>
        <FormulaLine>
          Σp bevart: m · <V1 /> + m · 0 = (m + m) · v′, så v′ = m · <V1 /> / (2m) = <V1 /> / 2
        </FormulaLine>
        <FormulaLine>
          v′ = {p} / {m2} = {ms(hit.v1)}
        </FormulaLine>
        <FormulaLine>
          <Ek /> før = ½ · {m} · ({v})<Sup>2</Sup> = {E}
        </FormulaLine>
        <FormulaLine>
          <Ek /> etter = ½ · {m2} · ({ms(hit.v1)})<Sup>2</Sup> = {fmt(hit.EkAfter, ed)}{NB}J
        </FormulaLine>
        <FormulaLine>
          Omdannet: {E} − {fmt(hit.EkAfter, ed)}{NB}J = {fmt(hit.lost, ed)}{NB}J, som er halvparten av <Ek /> før
        </FormulaLine>
      </>
    );

  return (
    <>
      <FormulaLine>
        Σp bevart: m · <V1 /> + m · 0 = m · <V1p /> + m · <V2p />
      </FormulaLine>
      <FormulaLine>
        {m} · {v} = {m} · {msCalc(hit.v1)} + {m} · {msCalc(hit.v2)} = {p}
      </FormulaLine>
      <FormulaLine>
        <Ek /> før = ½ · {m} · ({v})<Sup>2</Sup> = {E}
      </FormulaLine>
      <FormulaLine>
        <Ek /> etter = ½ · {m} · ({msCalc(hit.v1)})<Sup>2</Sup> + ½ · {m} · ({msCalc(hit.v2)})<Sup>2</Sup> = {fmt(hit.EkAfter, ed)}{NB}J
      </FormulaLine>
      <FormulaLine>
        Tap: {E} − {fmt(hit.EkAfter, ed)}{NB}J = {fmt(hit.lost, ed)}{NB}J, som er {fmt(100 * hit.lossShare, 0)}{NB}% av <Ek /> før
      </FormulaLine>
    </>
  );
}

/* ---------- Forklaringen ---------- */

function explanation(hit: CurlingHit): ReactNode {
  const ed = decimalsFor(hit.Ek);
  const pd = decimalsFor(hit.p);
  const p = `${fmt(hit.p, pd)}\u00a0kg·m/s`;
  const E = `${fmt(hit.Ek, ed)}\u00a0J`;
  const lossPct = fmt(100 * hit.lossShare, 0);

  let main: ReactNode;
  let myth: ReactNode;
  if (hit.kind === 'elastisk') {
    const back = Math.round(hit.v * 10) / 100; // 10 % av farten, rundet til hele cm/s
    const b = bounceBack(hit.v, back);
    main = (
      <p>
        <strong>Elastisk støt: den røde steinen stopper helt.</strong> Den gule glir videre med {ms(hit.v2)}, akkurat like fort som den røde
        kom. Hele bevegelsesmengden ({p}) og hele den kinetiske energien ({E}) går over til den gule. To like tunge steiner som støter rett og
        elastisk, bytter fart. Det ser du i stroboskopbildet: de røde prikkene stopper der de gule begynner, med samme avstand mellom
        prikkene.
      </p>
    );
    myth = (
      <p>
        <strong>Kunne den røde sprettet tilbake?</strong> Mange tror det. Spratt den tilbake med {ms(back)}, måtte den gule fått {ms(b.v2)}{' '}
        for at Σp skulle stemme. Da ville E<Sub>k</Sub> etter blitt {fmt(b.EkAfter, ed)}{NB}J, mer enn de {E} vi startet med, og energi oppstår
        ikke av ingenting. Fortsatte den røde framover, ville noe av E<Sub>k</Sub> blitt borte, og da er støtet ikke elastisk. Ekte
        curlingsteiner av granitt støter nesten elastisk, så etter et rett treff blir steinen som kom, liggende nesten der den traff.
      </p>
    );
  } else if (hit.kind === 'uelastisk') {
    main = (
      <p>
        <strong>Uelastisk støt: {lossPct}{NB}% av den kinetiske energien går tapt.</strong> {fmt(hit.lost, ed)}{NB}J blir til lyd (det smeller) og
        indre energi (steinene blir litt varmere). Den røde stopper ikke helt, men glir videre med {ms(hit.v1)}, og den gule får {ms(hit.v2)},
        litt mindre enn den røde hadde. Til sammen er v<Sub>1</Sub>′ + v<Sub>2</Sub>′ = {ms(hit.v)}, akkurat som før støtet.
      </p>
    );
    myth = (
      <p>
        <strong>Går bevegelsesmengde tapt når energi går tapt?</strong> Nei. Σp = {p} både før og etter, uansett hvor mye av E<Sub>k</Sub>{' '}
        som blir til andre energiformer. Jo mer som går tapt, desto likere blir farten til de to steinene (prøv glidebryteren). Ytterpunktet er
        et fullstendig uelastisk støt: samme fart, og halvparten av E<Sub>k</Sub> går tapt.
      </p>
    );
  } else {
    main = (
      <p>
        <strong>Fullstendig uelastisk støt: steinene henger sammen og får felles fart.</strong> Her har vi satt borrelås på steinene. Det er
        et tankeeksperiment, for ekte curlingsteiner henger ikke sammen. Σp = {p} er den samme, men massen som beveger seg, er dobbelt så
        stor, så farten blir halvparten: {ms(hit.v1)}. {fmt(hit.lost, ed)}{NB}J av {E} blir til lyd, deformasjon og indre energi.
      </p>
    );
    myth = (
      <p>
        <strong>Forsvinner all bevegelsen?</strong> Mange tror at all den kinetiske energien går tapt når steinene henger sammen. Men Σp må
        være bevart, så steinene må fortsatt bevege seg. Med like masser er halvparten av E<Sub>k</Sub> det meste som kan gå tapt.
      </p>
    );
  }

  const R = iceFriction();
  const I = frictionImpulse();
  return (
    <>
      {main}
      {myth}
      <p>
        <strong>Hvorfor er Σp bevart?</strong> I støtet dytter den røde på den gule, og den gule dytter like hardt tilbake på den røde (Newtons 3.
        lov). Kreftene virker like lenge, så impulsene er like store og motsatt rettet: det den røde mister av bevegelsesmengde, får den gule.
        Friksjonen fra isen er en ytre kraft, men den er liten, R = μmg ≈ {fmt(MU_ICE, 2)} · {fmt(STONE_MASS, 0)}{NB}kg · 9,81{NB}m/s² ≈ {fmt(R, 1)}
        {NB}N, og støtet varer bare rundt {fmt(CONTACT_TIME * 1000, 0)}{NB}ms. Impulsen fra friksjonen i støtet, R · Δt ≈ {fmt(I, 3)}{NB}N·s, er
        ingenting mot {p}. Etter støtet bremser friksjonen steinene sakte, men det ser vi bort fra i animasjonen.
      </p>
    </>
  );
}
