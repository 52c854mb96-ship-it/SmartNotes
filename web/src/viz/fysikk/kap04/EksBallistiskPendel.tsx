import { useState } from 'react';
import { Figure, Sub, WorkedExample, fmt, fmtSci, type ExampleStep, type FigureState } from '../../kit';
import { PendelScene, pendelLayout } from './ballistisk-pendel-scene';
import { PENDULUM_TASKS, roundSig, solvePendulumTask, type PendulumSolution, type PendulumTask } from './model-eks-ballistisk-pendel';
import { useNarrow } from './useNarrow';

/**
 * Eksempeloppgave (4A–4D): ballistisk pendel. En luftgeværkule skytes inn i en trekloss som henger i to snorer.
 * Bevegelsesmengden er bevart i støtet, og mekanisk energi er bevart i svingningen etterpå. Oppgaven er laget for
 * appen (egen tekst og egne tall) i samme stil som eksamensoppgaver: energibevaring, bevaring av bevegelsesmengde,
 * energitap i et fullstendig uelastisk støt, impulsloven og en forklaring av hvorfor energien går tapt.
 */
export default function EksBallistiskPendel() {
  const [variant, setVariant] = useState(0);
  const task = PENDULUM_TASKS[variant] ?? PENDULUM_TASKS[0]!;
  const s = solvePendulumTask(task);
  const { m, M, h, dt } = task;

  // Tallene slik de står i teksten
  const mG = fmt(m * 1000, 2);
  const MG = fmt(M * 1000, 0);
  const mKg = `${mG} · 10⁻³ kg`;
  const hCm = fmt(h * 100, 1);
  const hM = fmt(h, 3);
  const dtMs = fmt(dt * 1000, 2);
  const dtS = `${dtMs} · 10⁻³ s`;
  const V3 = fmt(s.V, 3);
  const v1 = fmt(s.v, 1);
  const vShown = fmt(s.vShown, 0);
  const dp4 = fmt(Math.abs(s.dpBullet), 4);
  const sBlockM = fmtSci(s.sBlock, 1);
  const sBlockMm = fmt(s.sBlock * 1000, 2);

  const steps: ExampleStep[] = [
    {
      part: 'a',
      title: 'Hvilke krefter virker mens klossen svinger opp?',
      body: (
        <>
          <p>
            Etter støtet sitter kula fast i klossen, så de beveger seg som ett legeme med massen m + M. To krefter virker på dem: tyngden G og
            snordraget S fra snorene. Luftmotstanden ser vi bort fra.
          </p>
          <p>
            Klossen følger en sirkelbue rundt festet, så farten peker alltid langs buen. Snordraget virker langs snorene og står derfor
            vinkelrett på farten hele veien. En kraft som står vinkelrett på bevegelsen, gjør ikke arbeid. Bare tyngden gjør arbeid, og da er den
            mekaniske energien bevart.
          </p>
        </>
      ),
      math: [
        <>
          W<Sub>S</Sub> = S · s · cos 90° = 0
        </>,
      ],
      tip: 'Snordraget endrer seg underveis, men det spiller ingen rolle: det gjør ikke arbeid noe sted på buen.',
    },
    {
      part: 'a',
      title: 'Bruk bevaring av mekanisk energi fra bunnen til toppen',
      body: (
        <p>
          Vi legger nullnivået for potensiell energi der klossen henger i ro. Like etter støtet har klossen bare kinetisk energi. I det øverste
          punktet snur den, så farten er null, og all energien er potensiell energi.
        </p>
      ),
      math: [
        <>
          E<Sub>k</Sub> i bunnen = E<Sub>p</Sub> i toppen
        </>,
        <>½(m + M)V² = (m + M)gh ⇒ V = √(2gh)</>,
        <>
          V = √(2 · 9,81 m/s² · {hM} m) = {V3} m/s
        </>,
      ],
      answer: <>V = {fmt(s.V, 2)} m/s</>,
      tip: 'Massen forkortes bort, så farten etter støtet avhenger bare av hvor høyt klossen stiger.',
      pitfall: (
        <>
          Gjør om høyden til meter: {hCm} cm = {hM} m.
        </>
      ),
    },
    {
      part: 'b',
      title: 'Bevegelsesmengden er bevart i støtet',
      body: (
        <>
          <p>
            Vi ser på kula og klossen som ett system. Kreftene mellom dem i støtet er indre krefter. Støtet er over på en brøkdel av et
            millisekund, og i den tiden henger klossen fortsatt rett under festet. De ytre kreftene, tyngden og snordraget, er da loddrette og gir
            ingen impuls vannrett. Den vannrette bevegelsesmengden er derfor bevart.
          </p>
          <p>Vi velger positiv retning i fartsretningen til kula. Klossen henger i ro før støtet.</p>
        </>
      ),
      math: [
        <>Før: p = m · v + M · 0 = m · v</>,
        <>Etter: p′ = (m + M) · V</>,
        <>p = p′ ⇒ m · v = (m + M) · V</>,
      ],
    },
    {
      part: 'b',
      title: 'Løs likningen for farten til kula',
      body: <p>Vi løser for v og setter inn V fra a). Massene står i en brøk, så enheten forkortes, og vi kan regne med gram.</p>,
      math: [
        <>v = (m + M) · V / m</>,
        <>
          v = ({mG} g + {MG} g) · {V3} m/s / {mG} g = {fmt(s.ratio, 1)} · {V3} m/s = {v1} m/s
        </>,
      ],
      answer: (
        <>
          v = {v1} m/s, altså om lag {vShown} m/s
        </>
      ),
      pitfall: (
        <>
          Ikke bruk energibevaring fra kula til toppen. ½mv² = (m + M)gh gir v = {fmt(s.vWrong, 1)} m/s, altfor lite. I støtet går nesten all
          den kinetiske energien over til andre energiformer (se c og e).
        </>
      ),
    },
    {
      part: 'c',
      title: 'Kinetisk energi før og etter støtet',
      body: (
        <p>
          Nå trengs massene i kilogram, fordi 1 J = 1 kg · m²/s². Vi regner med de uavrundede fartene fra a) og b).
        </p>
      ),
      math: [
        <>
          E<Sub>k, før</Sub> = ½mv² = ½ · {mKg} · ({v1} m/s)² = {fmt(s.EkBefore, 2)} J
        </>,
        <>
          E<Sub>k, etter</Sub> = ½(m + M)V² = ½ · {fmt(s.mTot, 5)} kg · ({V3} m/s)² = {fmt(s.EkAfter, 4)} J
        </>,
      ],
      tip: (
        <>
          E<Sub>k, etter</Sub> er den samme energien som klossen har i toppen: (m + M)gh = {fmt(s.mTot, 5)} kg · 9,81 m/s² · {hM} m ={' '}
          {fmt(s.EkAfter, 4)} J.
        </>
      ),
    },
    {
      part: 'c',
      title: 'Hvor mye ble omdannet?',
      body: <p>Forskjellen mellom energien før og etter er omdannet til andre energiformer i selve støtet.</p>,
      math: [
        <>
          ΔE = E<Sub>k, før</Sub> − E<Sub>k, etter</Sub> = {fmt(s.EkBefore, 2)} J − {fmt(s.EkAfter, 4)} J = {fmt(s.lost, 2)} J
        </>,
        <>
          ΔE / E<Sub>k, før</Sub> = {fmt(s.lost, 2)} J / {fmt(s.EkBefore, 2)} J = {fmt(s.lossShare, 3)} = {fmt(s.lossShare * 100, 1)} %
        </>,
      ],
      answer: (
        <>
          {fmt(s.lost, 1)} J ble omdannet, det vil si {fmt(s.lossShare * 100, 1)} % av den kinetiske energien til kula.
        </>
      ),
      tip: (
        <>
          Med symboler blir andelen M/(m + M) = {MG} g / {fmt((m + M) * 1000, 2)} g = {fmt(s.lossShare, 3)}. Jo tyngre klossen er i forhold
          til kula, desto større del går tapt.
        </>
      ),
    },
    {
      part: 'd',
      title: 'Bruk impulsloven på kula',
      body: (
        <p>
          Impulsen på kula er lik endringen i bevegelsesmengden til kula: F · Δt = Δp. Kula bremses fra v til V, fordi den følger med klossen
          etterpå. Med positiv retning i fartsretningen blir Δp negativ.
        </p>
      ),
      math: [
        <>
          Δp = m(V − v) = {mKg} · ({V3} m/s − {v1} m/s) = {fmt(s.dpBullet, 4)} kg·m/s
        </>,
        <>
          F = Δp / Δt = {fmt(s.dpBullet, 4)} kg·m/s / ({dtS}) = {fmt(s.Fbullet, 0)} N
        </>,
      ],
      tip: (
        <>
          Kraften er om lag {fmt(roundSig(s.forceRatio, 2), 0)} ganger tyngden til kula (mg = {fmt(s.Gbullet, 4)} N). Tyngden og snordraget
          betyr altså ingenting under støtet.
        </>
      ),
      pitfall: (
        <>
          Gjør om til SI-enheter: {mG} g = {mKg} og {dtMs} ms = {dtS}.
        </>
      ),
    },
    {
      part: 'd',
      title: 'Hvor langt flytter klossen seg under støtet?',
      body: (
        <p>
          Etter Newtons 3. lov virker kula på klossen med en like stor kraft framover, og klossen får farten V i løpet av Δt. Hvis kraften er
          omtrent konstant, øker farten jevnt fra 0 til V, så gjennomsnittsfarten er V/2.
        </p>
      ),
      math: [
        <>
          s = (0 + V)/2 · Δt = ½ · {V3} m/s · {dtS} = {sBlockM} m ≈ {sBlockMm} mm
        </>,
      ],
      answer: (
        <>
          Gjennomsnittskraften på kula er om lag {fmt(roundSig(s.F, 2), 0)} N, mot fartsretningen. Klossen flytter seg bare om lag {sBlockMm} mm
          mens kula stopper.
        </>
      ),
      tip: 'Dette bekrefter antakelsen i b): klossen henger praktisk talt rett under festet under hele støtet, så snordraget er loddrett.',
    },
    {
      part: 'e',
      title: 'Hvorfor er bevegelsesmengden bevart?',
      body: (
        <p>
          Kula og klossen virker på hverandre med et kraftpar (Newtons 3. lov): like store krefter i motsatt retning, i nøyaktig like lang tid.
          Da blir impulsene like store og motsatt rettet. Det kula mister av bevegelsesmengde, får klossen, og ingen andre krefter virker
          vannrett.
        </p>
      ),
      math: [
        <>
          Δp<Sub>kule</Sub> = {fmt(s.dpBullet, 4)} kg·m/s
        </>,
        <>
          Δp<Sub>kloss</Sub> = M · V = {fmt(M, 3)} kg · {V3} m/s = +{fmt(s.dpBlock, 4)} kg·m/s
        </>,
        <>
          Δp<Sub>kule</Sub> + Δp<Sub>kloss</Sub> = 0
        </>,
      ],
    },
    {
      part: 'e',
      title: 'Hvorfor går den kinetiske energien tapt?',
      body: (
        <>
          <p>
            Kraftparet virker like lenge på begge, men ikke over like lang strekning. Mens kula borer seg {fmt(s.depth * 100, 1)} cm inn i
            treet, flytter klossen seg bare {sBlockMm} mm. Kraften gjør derfor et stort negativt arbeid på kula og bare et lite positivt arbeid
            på klossen.
          </p>
          <p>
            Forskjellen blir indre energi: treverket rives opp og presses sammen, kula deformeres, og begge blir litt varmere. Litt blir lyd. Et
            støt der legemene henger sammen etterpå, er fullstendig uelastisk, og da går mest mulig kinetisk energi tapt.
          </p>
        </>
      ),
      math: [
        <>
          s<Sub>kule</Sub> = (v + V)/2 · Δt = {fmt((s.v + s.V) / 2, 1)} m/s · {dtS} = {fmt(s.sBullet, 4)} m
        </>,
        <>
          W<Sub>kule</Sub> = −F · s<Sub>kule</Sub> = −{fmt(s.F, 0)} N · {fmt(s.sBullet, 4)} m = {fmt(s.Wbullet, 2)} J
        </>,
        <>
          W<Sub>kloss</Sub> = F · s<Sub>kloss</Sub> = {fmt(s.F, 0)} N · {sBlockM} m = {fmt(s.Wblock, 3)} J
        </>,
        <>
          W<Sub>kule</Sub> + W<Sub>kloss</Sub> = {fmt(s.Wbullet + s.Wblock, 2)} J = −ΔE
        </>,
      ],
      answer: (
        <>
          Bevegelsesmengden er bevart fordi kreftene mellom kula og klossen er indre krefter med like store og motsatt rettede impulser. Den
          kinetiske energien er ikke bevart, fordi kraftparet gjør mye mer arbeid på kula enn på klossen. Om lag {fmt(s.lost, 1)} J blir indre
          energi (varme og deformasjon i treverket og kula) og litt lyd.
        </>
      ),
      tip: 'Del forløpet i to: i støtet er bevegelsesmengden bevart, og i svingningen etterpå er den mekaniske energien bevart. Bruk riktig lov i hver del.',
    },
  ];

  return (
    <WorkedExample
      variants={{ labels: ['Tallsett 1', 'Tallsett 2', 'Tallsett 3'], value: variant, onChange: setVariant }}
      intro={
        <p>
          En fysikkgruppe vil finne farten til kulene fra et luftgevær. De henger en trekloss i to like lange, lette snorer fra et stativ, slik
          at klossen kan svinge fram og tilbake uten å vri seg. Læreren skyter en kule vannrett inn i klossen fra kort hold, og kula blir
          sittende fast. En video viser at klossen med kula svinger ut og stiger {hCm} cm før den snur. Kula har massen {mG} g, og klossen har
          massen {MG} g. Se bort fra luftmotstand.
        </p>
      }
      given={[
        <>m = {mG} g</>,
        <>M = {MG} g</>,
        <>h = {hCm} cm</>,
        <>Δt = {dtMs} ms (i d)</>,
      ]}
      parts={[
        { id: 'a', text: 'Bestem farten til klossen med kula like etter støtet.' },
        { id: 'b', text: `Vis at kula hadde en fart på om lag ${vShown} m/s like før den traff klossen.` },
        {
          id: 'c',
          text: 'Hvor mye kinetisk energi ble omdannet til andre energiformer i støtet? Hvor stor andel av den kinetiske energien til kula er det?',
        },
        {
          id: 'd',
          text: `Et høyhastighetskamera viser at kula bruker ${dtMs} ms på å stoppe inne i klossen. Bestem gjennomsnittskraften på kula under støtet, og anslå hvor langt klossen flytter seg i denne tiden.`,
        },
        { id: 'e', text: 'Forklar hvorfor bevegelsesmengden er bevart i støtet, mens nesten all den kinetiske energien går tapt.' },
      ]}
      steps={steps}
      figure={(state) => <PendelFigure task={task} s={s} state={state} />}
    />
  );
}

function PendelFigure({ task, s, state }: { task: PendulumTask; s: PendulumSolution; state: FigureState }) {
  const [ref, narrow] = useNarrow<HTMLDivElement>();
  const layout = pendelLayout(narrow);
  return (
    <div ref={ref}>
      <Figure
        viewBox={layout.viewBox}
        label={`Ballistisk pendel: en luftgeværkule på ${fmt(task.m * 1000, 2)} gram skytes inn i en trekloss på ${fmt(task.M * 1000, 0)} gram som henger i to snorer. Klossen med kula svinger opp ${fmt(task.h * 100, 1)} centimeter.`}
        maxHeight={narrow ? 720 : 440}
      >
        <PendelScene task={task} s={s} state={state} layout={layout} />
      </Figure>
    </div>
  );
}
