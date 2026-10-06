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
 * Bredden på elementet (px), så vi kan velge viewBox og tekstskalering før figurene tegnes. Tekstskaleringen regnes
 * som i <Figure>: etiketter er minst 12,5 px på skjermen.
 */
function useFrame<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const update = () => setWidth(el.getBoundingClientRect().width);
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

/** Fart i en utregning: «2,00 m/s». */
const ms = (v: number) => `${fmt(v, 2)} m/s`;

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

  const sceneLabel =
    `Curling sett fra siden: en rød stein på ${fmt(STONE_MASS, 0)} kg glir med ${ms(v)} rett inn i en like tung gul stein som ligger i ro midt i huset. ` +
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
        <Figure viewBox={`0 0 ${B.W} ${B.H}`} label="Liggende søyler: bevegelsesmengde og kinetisk energi før og etter støtet, delt på den røde og den gule steinen." maxHeight={narrow ? 520 : 360}>
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
        <FormulaLine>
          Σp før = Σp etter: m · v<Sub>1</Sub> + m · 0 = m · v<Sub>1</Sub>′ + m · v<Sub>2</Sub>′
        </FormulaLine>
        <FormulaLine>
          {fmt(STONE_MASS, 0)} kg · {fmt(v, 1)} m/s = {fmt(STONE_MASS, 0)} kg · {ms(hit.v1)} + {fmt(STONE_MASS, 0)} kg · {ms(hit.v2)} ={' '}
          {fmt(hit.p, pd)} kg·m/s
        </FormulaLine>
        <FormulaLine>
          Like masser: v<Sub>1</Sub>′ + v<Sub>2</Sub>′ = v<Sub>1</Sub>, {ms(hit.v1)} + {ms(hit.v2)} = {ms(v)}
        </FormulaLine>
        <FormulaLine>
          E<Sub>k</Sub> før = ½ · {fmt(STONE_MASS, 0)} kg · ({fmt(v, 1)} m/s)² = {fmt(hit.Ek, ed)} J
        </FormulaLine>
        <FormulaLine>
          E<Sub>k</Sub> etter = ½ · {fmt(STONE_MASS, 0)} kg · ({ms(hit.v1)})² + ½ · {fmt(STONE_MASS, 0)} kg · ({ms(hit.v2)})² = {fmt(hit.EkAfter, ed)} J
        </FormulaLine>
      </Formula>

      <Explain>{explanation(hit)}</Explain>
    </VizLayout>
  );
}

/* ---------- Forklaringen ---------- */

function explanation(hit: CurlingHit): ReactNode {
  const ed = decimalsFor(hit.Ek);
  const pd = decimalsFor(hit.p);
  const p = `${fmt(hit.p, pd)} kg·m/s`;
  const E = `${fmt(hit.Ek, ed)} J`;
  const lossPct = fmt(100 * hit.lossShare, 0);

  let main: ReactNode;
  let myth: ReactNode;
  if (hit.kind === 'elastisk') {
    const back = Math.round(hit.v * 10) / 100; // 10 % av farten, rundet til hele cm/s
    const b = bounceBack(hit.v, back);
    main = (
      <p>
        <strong>Elastisk støt: den røde steinen stopper helt.</strong> Hele bevegelsesmengden ({p}) og hele den kinetiske energien ({E}) går
        over til den gule steinen, som glir videre med {ms(hit.v2)}, akkurat like fort som den røde kom. Når to like tunge legemer støter
        elastisk og det ene ligger i ro, bytter de fart. I stroboskopbildet tar den gule over avstanden mellom bildene der den røde slapp.
      </p>
    );
    myth = (
      <p>
        Mange tror at den røde må fortsette litt, eller sprette tilbake. Med like masser sier bevaring av bevegelsesmengde at v<Sub>1</Sub>′ +
        v<Sub>2</Sub>′ = v<Sub>1</Sub>, og bevaring av kinetisk energi at v<Sub>1</Sub>′² + v<Sub>2</Sub>′² = v<Sub>1</Sub>². Begge kan bare
        stemme når v<Sub>1</Sub>′ = 0. Spratt den røde tilbake med {ms(back)}, måtte den gule fått {ms(b.v2)} for at Σp skulle stemme, og E
        <Sub>k</Sub> etter ville blitt {fmt(b.EkAfter, ed)} J, mer enn de {E} vi startet med. Energi oppstår ikke av ingenting, så det går ikke.
        Ekte curlingsteiner av granitt støter nesten elastisk. Derfor kan en god curlingspiller slå en stein ut av huset og la sin egen bli
        liggende igjen omtrent der den andre lå.
      </p>
    );
  } else if (hit.kind === 'uelastisk') {
    main = (
      <p>
        <strong>Uelastisk støt: {lossPct} % av den kinetiske energien går tapt.</strong> {fmt(hit.lost, ed)} J blir til lyd (det smeller) og
        indre energi (steinene blir litt varmere). Bevegelsesmengden er likevel bevart, Σp = {p} både før og etter. Den røde stopper ikke helt,
        men glir videre med {ms(hit.v1)}, og den gule får {ms(hit.v2)}, litt mindre enn den røde hadde. Til sammen er v<Sub>1</Sub>′ + v
        <Sub>2</Sub>′ = {ms(hit.v)}, akkurat som før støtet.
      </p>
    );
    myth = (
      <p>
        Mange tror at bevegelsesmengde går tapt når energi går tapt. Men Σp er bevart i alle støt, uansett hvor mye av E<Sub>k</Sub> som blir
        til andre energiformer. Jo mer energi som går tapt, desto likere blir farten til de to steinene etter støtet. Ytterpunktet er et
        fullstendig uelastisk støt, der de får samme fart og halvparten av E<Sub>k</Sub> går tapt.
      </p>
    );
  } else {
    main = (
      <p>
        <strong>Fullstendig uelastisk støt: steinene henger sammen og får felles fart.</strong> Σp = {p} er den samme, men nå er massen dobbelt
        så stor: v′ = Σp / (2m) = {p} / {fmt(2 * STONE_MASS, 0)} kg = {ms(hit.v1)}, halvparten av farten før. Den kinetiske energien blir
        halvert: {fmt(hit.lost, ed)} J av {E} blir til lyd, deformasjon og indre energi.
      </p>
    );
    myth = (
      <p>
        Mange tror at all den kinetiske energien forsvinner i et fullstendig uelastisk støt. Men Σp må være bevart, og da må steinene fortsatt
        bevege seg. Med like masser er halvparten det meste som kan gå tapt. Ekte curlingsteiner henger ikke sammen, så dette er et
        tankeeksperiment: tenk deg at steinene var trukket med borrelås.
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
        Friksjonen fra isen er en ytre kraft, men den er liten, R = μmg ≈ {fmt(MU_ICE, 2)} · {fmt(STONE_MASS, 0)} kg · 9,81 m/s² ≈ {fmt(R, 1)}{' '}
        N, og støtet varer bare rundt {fmt(CONTACT_TIME * 1000, 0)} ms. Impulsen fra friksjonen i støtet blir R · Δt ≈ {fmt(I, 3)} N·s, mot{' '}
        {p}, så den kan vi se bort fra. Etter støtet bremser friksjonen steinene sakte; det ser vi bort fra i animasjonen.
      </p>
    </>
  );
}
