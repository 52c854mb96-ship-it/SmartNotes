import { useState, type ReactNode } from 'react';
import { Figure, Sub, WorkedExample, fmt, type ExampleStep, type FigureState } from '../../kit';
import { G_EARTH } from '../../kit/format';
import { WAGON_TASKS, sigDecimals, solveWagonTask, type WagonLoad, type WagonSolution, type WagonTask } from './model-eks-vognstot';
import { useNarrow } from './useNarrow';
import { fmtPot } from './vognstot-deler';
import { VognScene, vognLayout } from './vognstot-scene';

/**
 * Eksempeloppgave (4A–4D): to godsvogner på en godsterminal støter sammen, og koblingene låser seg. Oppgaven er laget
 * for appen (egen tekst og egne tall) i samme stil som eksamensoppgaver: bevaring av bevegelsesmengde med fortegn,
 * energitap i prosent, typer støt, impulsloven og Newtons 3. lov, gjennomsnittskraft og akselerasjon (Newtons 2. lov).
 */
export default function EksVognstot() {
  const [variant, setVariant] = useState(0);
  const task = WAGON_TASKS[variant] ?? WAGON_TASKS[0]!;
  const s = solveWagonTask(task);
  const { mA, vA, mB, vB, dt } = task;

  // Tallene slik de står i teksten og utregningen
  const t = (m: number) => `${fmt(m / 1000, 0)} t`;
  const kg = (m: number) => `${fmt(m, 0)} kg`;
  const ms = (v: number) => `${fmt(v, 1)} m/s`;
  const msPar = (v: number) => (v < 0 ? `(${ms(v)})` : v === 0 ? '0 m/s' : ms(v));
  const V3 = `${fmt(s.V, 3)} m/s`;
  const VShown = fmt(s.VShown, sigDecimals(s.V, 2));
  const J = (e: number) => `${fmt(e, 0)} J`;
  const kJ = (e: number) => `${fmt(e / 1000, 1)} kJ`;
  const pct = `${fmt(s.lossShare * 100, 1)} %`;
  const Ns = (i: number) => `${fmt(i, 0)} N·s`;
  const pot = (i: number) => `${fmtPot(i, 2)} N·s`;
  const dtS = `${fmt(dt, 2)} s`;
  const bAtRest = vB === 0;
  const bTowards = vB < 0;
  const ratio = s.aB / s.aA;

  const describe = (load: WagonLoad) =>
    load === 'container40' ? 'en containervogn med en full 40-fots container' : load === 'container20' ? 'en containervogn med en 20-fots container' : 'en tom containervogn';

  const bSentence = bAtRest
    ? `Vogn B er ${describe(task.loadB)} og har massen ${t(mB)}. Den står i ro med bremsene løst lenger framme på sporet.`
    : bTowards
      ? `Vogn B er ${describe(task.loadB)} og har massen ${t(mB)}. Den har begynt å trille og kommer mot vogn A med farten ${ms(-vB)}.`
      : `Vogn B er ${describe(task.loadB)} og har massen ${t(mB)}. Den ble skjøvet ut litt tidligere og triller sakte i samme retning med farten ${ms(vB)}.`;

  const pBLine: ReactNode = bAtRest ? (
    <>
      p<Sub>B</Sub> = m<Sub>B</Sub>·v<Sub>B</Sub> = {kg(mB)} · 0 m/s = 0
    </>
  ) : (
    <>
      p<Sub>B</Sub> = m<Sub>B</Sub>·v<Sub>B</Sub> = {kg(mB)} · {msPar(vB)} = {fmt(s.pB, 0)} kg·m/s
    </>
  );

  const signNote: ReactNode = bAtRest ? (
    <>Vogn B står i ro, så den har ingen bevegelsesmengde før støtet.</>
  ) : bTowards ? (
    <>
      Vogn B triller mot positiv retning, så farten er negativ: v<Sub>B</Sub> = {ms(vB)}.
    </>
  ) : (
    <>
      Vogn B triller samme vei som A, så v<Sub>B</Sub> = +{ms(vB)}.
    </>
  );

  const steps: ExampleStep[] = [
    {
      part: 'a',
      title: 'Velg begge vognene som system',
      body: (
        <>
          <p>
            Vi ser på vogn A og vogn B som ett system. Kreftene mellom vognene i støtet, fra bufferne og koblingene, er da indre krefter. De
            kommer i par og kan ikke endre den samlede bevegelsesmengden.
          </p>
          <p>
            De ytre kreftene er tyngden G og normalkraften N fra skinnene. Sporet er vannrett, så de er loddrette, like store og opphever
            hverandre. Friksjon og luftmotstand ser vi bort fra. Summen av de ytre kreftene er null, og da er den samlede bevegelsesmengden
            bevart.
          </p>
        </>
      ),
      math: [
        <>
          ΣF<Sub>ytre</Sub> = 0 ⇒ Σp<Sub>før</Sub> = Σp<Sub>etter</Sub>
        </>,
      ],
      tip: 'Velg alltid systemet slik at kreftene i selve støtet blir indre krefter. Da trenger du ikke vite noe om dem.',
    },
    {
      part: 'a',
      title: 'Regn ut bevegelsesmengden før støtet',
      body: (
        <p>
          Bevegelsesmengden p = mv er en vektor, så vi velger positiv retning i fartsretningen til A (mot høyre i figuren). {signNote} Massene
          må være i kilogram: {t(mA)} = {kg(mA)}.
        </p>
      ),
      math: [
        <>
          p<Sub>A</Sub> = m<Sub>A</Sub>·v<Sub>A</Sub> = {kg(mA)} · {ms(vA)} = {fmt(s.pA, 0)} kg·m/s
        </>,
        pBLine,
        <>
          Σp = p<Sub>A</Sub> + p<Sub>B</Sub> = {fmt(s.p, 0)} kg·m/s
        </>,
      ],
      pitfall: bTowards ? (
        <>
          Glemmer du minustegnet på v<Sub>B</Sub>, får du Σp = {fmt(s.pA - s.pB, 0)} kg·m/s og en fart etter støtet på{' '}
          {fmt(s.vSignWrong, 2)} m/s, altfor mye. Fart mot den positive retningen er negativ.
        </>
      ) : bAtRest ? (
        <>Glem ikke å gjøre om tonn til kilogram (1 t = 1000 kg). Ellers får bevegelsesmengden feil enhet.</>
      ) : (
        <>
          B triller samme vei som A, så p<Sub>B</Sub> er positiv og skal legges til. Den skal ikke trekkes fra.
        </>
      ),
    },
    {
      part: 'a',
      title: 'Bevegelsesmengden er bevart i støtet',
      body: (
        <p>
          Etter støtet henger vognene sammen og har den samme farten V. Den samlede massen er m<Sub>A</Sub> + m<Sub>B</Sub> ={' '}
          {kg(s.M)}.
        </p>
      ),
      math: [
        <>
          (m<Sub>A</Sub> + m<Sub>B</Sub>)·V = Σp ⇒ V = Σp / (m<Sub>A</Sub> + m<Sub>B</Sub>)
        </>,
        <>
          V = {fmt(s.p, 0)} kg·m/s / {kg(s.M)} = {V3}
        </>,
      ],
      answer: (
        <>
          V = {fmt(s.V, 2)} m/s, altså om lag {VShown} m/s i fartsretningen til A.
        </>
      ),
      pitfall: (
        <>
          Ikke bruk bevaring av kinetisk energi her. Den gir V = {fmt(s.vEnergyWrong, 2)} m/s, som er for mye. Kinetisk energi er ikke bevart
          i dette støtet (se b).
        </>
      ),
    },
    {
      part: 'b',
      title: 'Kinetisk energi før og etter støtet',
      body: (
        <p>
          Kinetisk energi E<Sub>k</Sub> = ½mv² er en skalar, så fortegnet til farten spiller ingen rolle. Vi regner med den uavrundede farten
          fra a).
        </p>
      ),
      math: [
        <>
          E<Sub>k,A</Sub> = ½m<Sub>A</Sub>v<Sub>A</Sub>² = ½ · {kg(mA)} · ({ms(vA)})² = {J(s.EkA)}
        </>,
        bAtRest ? (
          <>
            E<Sub>k,B</Sub> = 0 (B står i ro)
          </>
        ) : (
          <>
            E<Sub>k,B</Sub> = ½m<Sub>B</Sub>v<Sub>B</Sub>² = ½ · {kg(mB)} · ({ms(vB)})² = {J(s.EkB)}
          </>
        ),
        <>
          E<Sub>k,før</Sub> = E<Sub>k,A</Sub> + E<Sub>k,B</Sub> = {J(s.EkBefore)}
        </>,
        <>
          E<Sub>k,etter</Sub> = ½(m<Sub>A</Sub> + m<Sub>B</Sub>)V² = ½ · {kg(s.M)} · ({V3})² = {J(s.EkAfter)}
        </>,
      ],
      tip: <>Energien etter støtet er mindre enn før, selv om bevegelsesmengden er den samme.</>,
    },
    {
      part: 'b',
      title: 'Hvor stor del av energien gikk tapt?',
      body: <p>Forskjellen mellom energien før og etter er omdannet til andre energiformer i støtet. Andelen finner vi ved å dele på energien før støtet.</p>,
      math: [
        <>
          ΔE = E<Sub>k,før</Sub> − E<Sub>k,etter</Sub> = {J(s.EkBefore)} − {J(s.EkAfter)} = {J(s.lost)}
        </>,
        <>
          ΔE / E<Sub>k,før</Sub> = {J(s.lost)} / {J(s.EkBefore)} = {fmt(s.lossShare, 4)} = {pct}
        </>,
      ],
      answer: (
        <>
          {pct} av den kinetiske energien går tapt, det vil si om lag {kJ(s.lost)}.
        </>
      ),
      tip: bAtRest ? (
        <>
          Når B står i ro, blir andelen m<Sub>B</Sub>/(m<Sub>A</Sub> + m<Sub>B</Sub>) = {t(mB)} / {t(s.M)} = {fmt(s.lossShare, 3)}. Jo tyngre B
          er i forhold til A, desto større del går tapt.
        </>
      ) : (
        <>
          Tapet avhenger bare av den relative farten v<Sub>A</Sub> − v<Sub>B</Sub> = {fmt(s.u, 1)} m/s: ΔE = ½ · m<Sub>A</Sub>m<Sub>B</Sub>/(m
          <Sub>A</Sub> + m<Sub>B</Sub>) · (v<Sub>A</Sub> − v<Sub>B</Sub>)².{' '}
          {bTowards
            ? 'Når vognene kommer mot hverandre, er den relative farten stor, og mye av energien går tapt.'
            : 'Når B triller samme vei, er den relative farten liten, og mindre av energien går tapt.'}
        </>
      ),
      pitfall: 'Prosenten skal regnes av energien før støtet, ikke av energien etter.',
    },
    {
      part: 'c',
      title: 'Hvilken type støt er det?',
      body: (
        <>
          <p>Vi skiller mellom tre typer sentrale støt. Bevegelsesmengden er bevart i alle tre.</p>
          <ul style={{ paddingLeft: '1.25em' }}>
            <li>
              <strong>Elastisk støt:</strong> den kinetiske energien er bevart.
            </li>
            <li>
              <strong>Uelastisk støt:</strong> noe av den kinetiske energien går over til andre energiformer.
            </li>
            <li>
              <strong>Fullstendig uelastisk støt:</strong> legemene henger sammen og har felles fart etter støtet.
            </li>
          </ul>
          <p>Her låser koblingene seg, og vognene ruller videre med felles fart. Det stemmer med b): kinetisk energi går tapt.</p>
        </>
      ),
      answer: 'Støtet er fullstendig uelastisk, fordi vognene henger sammen og har felles fart etter støtet.',
      tip: (
        <>
          I et fullstendig uelastisk støt går så mye kinetisk energi tapt som mulig når bevegelsesmengden skal være bevart. Det betyr ikke at
          all energien forsvinner: vognene ruller videre med {kJ(s.EkAfter)}.
        </>
      ),
    },
    {
      part: 'c',
      title: 'Hvor blir det av energien?',
      body: (
        <p>
          Energi kan ikke forsvinne, men kinetisk energi kan omdannes. Bufferne har kraftige fjærer og friksjonsringer som bremser bevegelsen, og
          koblingene og rammene deformeres litt. Det meste blir indre energi, så bufferne blir litt varmere. Noe blir lyd (et smell) og
          vibrasjoner i vognene og lasten.
        </p>
      ),
      answer: (
        <>
          Om lag {kJ(s.lost)} blir indre energi (varme i bufferne og deformasjon), lyd og vibrasjoner. Den samlede energien er bevart, men ikke
          den kinetiske energien.
        </>
      ),
    },
    {
      part: 'd',
      title: 'Bruk impulsloven på hver vogn',
      body: (
        <p>
          Impulsen på en vogn er lik endringen i bevegelsesmengden til vogna: I = Δp = m(v<Sub>etter</Sub> − v<Sub>før</Sub>). Vi bruker samme
          positive retning som i a) og den uavrundede farten V.
        </p>
      ),
      math: [
        <>
          I<Sub>A</Sub> = m<Sub>A</Sub>(V − v<Sub>A</Sub>) = {kg(mA)} · ({V3} − {ms(vA)}) = {Ns(s.IA)}
        </>,
        <>
          I<Sub>B</Sub> = m<Sub>B</Sub>(V − v<Sub>B</Sub>) = {kg(mB)} · ({V3} − {msPar(vB)}) = {Ns(s.IB)}
        </>,
      ],
      answer: (
        <>
          I<Sub>A</Sub> = {pot(s.IA)} (bakover, A bremses) og I<Sub>B</Sub> = {pot(s.IB)} (framover).
        </>
      ),
      tip: 'Enheten N·s er den samme som kg·m/s, fordi 1 N = 1 kg·m/s².',
      pitfall: bTowards ? (
        <>
          Pass på fortegnet: V − v<Sub>B</Sub> = {fmt(s.V, 3)} − ({fmt(vB, 1)}) = {fmt(s.dvB, 3)} m/s. B snur, så fartsendringen er større enn
          V.
        </>
      ) : (
        <>Fortegnet betyr noe: A bremses, så impulsen på A peker bakover og er negativ.</>
      ),
    },
    {
      part: 'd',
      title: 'Hvorfor er impulsene like store og motsatt rettet?',
      body: (
        <p>
          Under støtet virker A på B med kraften F<Sub>B</Sub> framover, og B virker på A med kraften F<Sub>A</Sub> bakover. Etter Newtons 3. lov
          er dette et kraftpar: like store og motsatt rettede krefter, F<Sub>A</Sub> = −F<Sub>B</Sub>. Kreftene virker bare så lenge vognene
          trykker mot hverandre, altså nøyaktig like lenge på begge. Da blir også impulsene like store og motsatt rettet.
        </p>
      ),
      math: [
        <>
          I<Sub>A</Sub> = F<Sub>A</Sub>·Δt = −F<Sub>B</Sub>·Δt = −I<Sub>B</Sub>
        </>,
        <>
          Δp<Sub>A</Sub> + Δp<Sub>B</Sub> = I<Sub>A</Sub> + I<Sub>B</Sub> = 0 ⇒ Σp er bevart
        </>,
      ],
      answer: (
        <>
          Kreftene mellom vognene er et kraftpar (Newtons 3. lov) som virker like lenge på begge, så I<Sub>A</Sub> = −I<Sub>B</Sub>. Det A mister
          av bevegelsesmengde, får B, og derfor er den samlede bevegelsesmengden bevart.
        </>
      ),
    },
    {
      part: 'e',
      title: 'Gjennomsnittskraften fra impulsloven',
      body: (
        <p>
          Kraften mellom vognene stiger og synker under støtet (se grafen). Gjennomsnittskraften F er den konstante kraften som gir den samme
          impulsen, altså det samme arealet under F-t-grafen: I = F·Δt.
        </p>
      ),
      math: [
        <>
          F = I<Sub>B</Sub> / Δt = {Ns(s.IB)} / {dtS} = {fmt(s.F, 0)} N ≈ {fmt(s.F / 1000, 0)} kN
        </>,
      ],
      tip: 'Den største kraften i støtet er større enn gjennomsnittskraften, fordi kraften er liten i starten og slutten.',
    },
    {
      part: 'e',
      title: 'Akselerasjonen til hver vogn',
      body: (
        <p>
          Begge vognene påvirkes av like store krefter, men massene er forskjellige. Newtons 2. lov, a = F/m, gir den største akselerasjonen til
          vogna med minst masse.
        </p>
      ),
      math: [
        <>
          a<Sub>A</Sub> = F / m<Sub>A</Sub> = {fmt(s.F, 0)} N / {kg(mA)} = {fmt(s.aA, 2)} m/s²
        </>,
        <>
          a<Sub>B</Sub> = F / m<Sub>B</Sub> = {fmt(s.F, 0)} N / {kg(mB)} = {fmt(s.aB, 2)} m/s²
        </>,
      ],
      answer: (
        <>
          F ≈ {fmt(s.F / 1000, 0)} kN. a<Sub>A</Sub> ≈ {fmt(s.aA, 1)} m/s² (A bremses) og a<Sub>B</Sub> ≈ {fmt(s.aB, 1)} m/s². Vogn B er
          lettest og får det kraftigste rykket, {fmt(ratio, 1)} ganger så stort som A.
        </>
      ),
      tip: (
        <>
          Kontroll med fartsendringen: a<Sub>A</Sub> = |V − v<Sub>A</Sub>| / Δt = {fmt(-s.dvA, 3)} m/s / {dtS} = {fmt(s.aA, 2)} m/s². Rykket i B
          er {fmt(s.aB / G_EARTH, 2)} g, så last som ikke er godt sikret, kan skli.
        </>
      ),
    },
  ];

  return (
    <WorkedExample
      variants={{ labels: ['Tallsett 1', 'Tallsett 2', 'Tallsett 3'], value: variant, onChange: setVariant }}
      intro={
        <>
          <p>
            På en godsterminal setter et skiftelokomotiv sammen et godstog. Lokomotivet skyver vogn A opp i fart og bremser, så vogna triller
            videre av seg selv på et rett og vannrett spor. Vogn A er {describe(task.loadA)} og har massen {t(mA)}. Den triller med farten{' '}
            {ms(vA)} mot vogn B. {bSentence}
          </p>
          <p>
            Vognene har automatiske koblinger som låser seg når bufferne møtes, så etter støtet ruller vognene videre sammen. Se bort fra
            friksjon og luftmotstand.
          </p>
        </>
      }
      given={[
        <>
          m<Sub>A</Sub> = {t(mA)}
        </>,
        <>
          v<Sub>A</Sub> = {ms(vA)}
        </>,
        <>
          m<Sub>B</Sub> = {t(mB)}
        </>,
        bAtRest ? (
          <>
            v<Sub>B</Sub> = 0
          </>
        ) : bTowards ? (
          <>
            v<Sub>B</Sub> = {ms(-vB)} mot A
          </>
        ) : (
          <>
            v<Sub>B</Sub> = {ms(vB)} samme vei
          </>
        ),
        <>Δt = {dtS}</>,
      ]}
      parts={[
        { id: 'a', text: `Vis at vognene har en fart på om lag ${VShown} m/s like etter støtet.` },
        { id: 'b', text: 'Hvor mange prosent av den kinetiske energien går tapt i støtet?' },
        { id: 'c', text: 'Hva slags støt er dette? Begrunn svaret, og forklar hva som skjer med den kinetiske energien som går tapt.' },
        { id: 'd', text: 'Bestem impulsen hver av vognene får i støtet. Forklar hvorfor impulsene er like store og motsatt rettet.' },
        {
          id: 'e',
          text: `Målinger viser at støtet varer i ${dtS}. Bestem gjennomsnittskraften mellom vognene og gjennomsnittsakselerasjonen til hver vogn under støtet. Hvilken vogn får det kraftigste rykket?`,
        },
      ]}
      steps={steps}
      figure={(state) => <VognFigure task={task} s={s} state={state} variant={variant} />}
    />
  );
}

function VognFigure({ task, s, state, variant }: { task: WagonTask; s: WagonSolution; state: FigureState; variant: number }) {
  const [ref, narrow] = useNarrow<HTMLDivElement>();
  const layout = vognLayout(narrow);
  return (
    <div ref={ref}>
      <Figure
        viewBox={layout.viewBox}
        label={`To godsvogner på et rett spor. Vogn A på ${fmt(task.mA / 1000, 0)} tonn triller med farten ${fmt(task.vA, 1)} meter per sekund mot vogn B på ${fmt(task.mB / 1000, 0)} tonn, og koblingene låser seg i støtet.`}
        maxHeight={narrow ? 520 : 440}
      >
        <VognScene task={task} s={s} state={state} layout={layout} variant={variant} />
      </Figure>
    </div>
  );
}
