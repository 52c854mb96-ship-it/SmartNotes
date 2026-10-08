import { useState, type ReactNode } from 'react';
import { Sub, WorkedExample, fmt, type ExampleStep } from '../../kit';
import { ActivityFigure, fmtSig, pctText, tText } from './aktivitet-figur';
import { ACTIVITY_TASKS, solveActivityTask, startTexts, type ActivityTask } from './model-eks-aktivitet';

/**
 * Eksempeloppgave (8A–8B): aktivitet og halveringstid for en medisinsk strålekilde. Les av halveringstiden på grafen,
 * regn ut aktiviteten når pasienten får stoffet, finn med logaritmer tida til aktiviteten har sunket til en gitt andel
 * (og kontroller på grafen), og vurder hvorfor kort halveringstid er en fordel ved å sammenligne med et tenkt stoff med
 * mye lengre halveringstid. Tre tallsett: technetium-99m til skjelettscintigrafi, jod-131 mot for høyt stoffskifte og
 * fluor-18 til PET.
 *
 * Oppgaven er laget for appen (egen tekst og egne tall). Alle tallene i teksten, utregningen og svarene kommer fra
 * solveActivityTask. Mellomsvar vises med ett siffer mer enn svaret (model-eks-aktivitet.test.ts sjekker at linjene går
 * opp med tallene som vises).
 */

/** T½ i teksten. */
const Th = () => (
  <>
    T<Sub>½</Sub>
  </>
);

/** (1/2) opphøyd i eksponenten. */
const halfPow = (exp: ReactNode) => (
  <>
    (1/2)<sup>{exp}</sup>
  </>
);

/** Andel som desimaltall med to gjeldende siffer: 0,10 og 0,050. */
const share = (p: number) => fmtSig(p, 2);

/** Prosent med alle siffer (for 1/8, 1/16 …): 0,125 → «12,5 %». */
const exactPct = (v: number) => `${String(Math.round(v * 1e5) / 1e3).replace('.', ',')} %`;

/** Situasjonen i hvert tallsett. */
const TEXT: Record<
  ActivityTask['id'],
  {
    about: ReactNode;
    source: string;
    gets: (given: string) => string;
    start: string;
    startAkt: string;
    partB: (given: string) => string;
    why: ReactNode;
    answerD: (fD: string, fL: string) => ReactNode;
    tipB?: (lost: string) => ReactNode;
  }
> = {
  tc: {
    about: (
      <p>
        Ved en skjelettscintigrafi får pasienten sprøytet inn et stoff som inneholder technetium-99m (Tc-99m). Stoffet samler seg i
        skjelettet, og gammastrålingen fra Tc-99m blir fanget opp av et gammakamera, så legen får et bilde av skjelettet.
      </p>
    ),
    source: 'sprøyta',
    gets: (given) => `Sprøyta settes ${given}.`,
    start: 'innsprøytingen',
    startAkt: 'aktiviteten ved innsprøytingen',
    partB: (given) => `Regn ut aktiviteten i sprøyta når den settes ${given}.`,
    why: (
      <>
        <p>
          Bildene tas noen timer etter innsprøytingen. Med Tc-99m skjer de fleste henfallene i løpet av disse timene, og etter et døgn er det
          meste borte. Pasienten, og de pasienten er sammen med, får derfor lite stråling etter at undersøkelsen er ferdig.
        </p>
        <p>
          Det tenkte stoffet ville gitt like gode bilder, men nesten all aktiviteten ville vært igjen dagen etter, og pasienten ville fått
          stråling i flere uker uten at det var til nytte. Halveringstiden kan likevel ikke være altfor kort: stoffet må rekke å bli laget,
          målt, sprøytet inn og tatt opp i skjelettet før bildene tas. Sykehuset lager Tc-99m selv i en generator, så det går fort.
        </p>
      </>
    ),
    answerD: (fD, fL) => (
      <>
        Etter ett døgn er bare {fD} av aktiviteten igjen med Tc-99m, mot {fL} med det tenkte stoffet. Den korte halveringstiden gir nok
        stråling til bildene mens undersøkelsen pågår, men liten stråledose etterpå.
      </>
    ),
  },
  jod: {
    about: (
      <p>
        Ved for høyt stoffskifte kan pasienten få behandling med jod-131 (I-131). Pasienten drikker en løsning med I-131, og jodet samler seg i
        skjoldbruskkjertelen. Betastrålingen fra I-131 ødelegger en del av kjertelen, så den lager mindre hormon.
      </p>
    ),
    source: 'flaska',
    gets: (given) => `Pasienten drikker løsningen ${given}.`,
    start: 'behandlingen',
    startAkt: 'aktiviteten pasienten fikk',
    partB: (given) => `Regn ut aktiviteten i flaska ${given}, når pasienten drikker løsningen.`,
    why: (
      <>
        <p>
          Strålingen skal virke på skjoldbruskkjertelen i noen uker. Etter fire uker er det meste av I-131 borte, så behandlingen stopper av
          seg selv, og pasienten slutter å stråle på familien og andre rundt seg.
        </p>
        <p>
          Med det tenkte stoffet ville det meste av aktiviteten vært igjen etter fire uker, og kjertelen og resten av kroppen ville fått
          stråling i mange måneder. Halveringstiden kan likevel ikke være altfor kort: løsningen må fraktes til sykehuset, og jodet må rekke
          å bli tatt opp i kjertelen før det meste har henfalt.
        </p>
      </>
    ),
    answerD: (fD, fL) => (
      <>
        Etter fire uker er {fD} av aktiviteten igjen med I-131, mot {fL} med det tenkte stoffet. Med kort halveringstid virker strålingen
        der den skal i noen uker og er så nesten borte, så pasienten og omgivelsene får mindre stråling til sammen.
      </>
    ),
  },
  fluor: {
    about: (
      <p>
        Ved en PET-undersøkelse får pasienten sprøytet inn sukker som er merket med fluor-18 (F-18). Kreftsvulster bruker mye sukker, så
        stoffet samler seg der. F-18 sender ut positroner, og gammastrålingen som oppstår når positronene møter elektroner, blir fanget opp
        av en PET-skanner.
      </p>
    ),
    source: 'sprøyta',
    gets: () => 'Sprøyta settes like etter at den har kommet fram.',
    start: 'innsprøytingen',
    startAkt: 'aktiviteten ved innsprøytingen',
    partB: () => 'Regn ut aktiviteten i sprøyta når den kommer fram til sykehuset.',
    why: (
      <>
        <p>
          PET-bildene tas omtrent en time etter innsprøytingen. Etter 8,0 h er nesten alt F-18 borte, så pasienten kan reise hjem samme dag
          uten å stråle særlig på andre, og stråledosen blir liten.
        </p>
        <p>
          Ulempen ser vi i b): over en tredel av aktiviteten forsvinner bare under transporten. F-18 må derfor lages i en syklotron i
          nærheten, sendes av gårde rett før undersøkelsen og bestilles med en aktivitet som tar høyde for tapet. Med det tenkte stoffet
          ville transporten vært enkel, men pasienten ville strålt i flere døgn.
        </p>
      </>
    ),
    answerD: (fD, fL) => (
      <>
        Etter 8,0 h er {fD} av aktiviteten igjen med F-18, mot {fL} med det tenkte stoffet. Den korte halveringstiden gir liten stråledose
        etter undersøkelsen, men krever rask transport fra en syklotron i nærheten.
      </>
    ),
    tipB: (lost) => <>Hele {lost} av aktiviteten forsvinner under transporten. Det er derfor sykehuset bestiller mer enn pasienten trenger.</>,
  },
};

export default function EksAktivitet() {
  const [variant, setVariant] = useState(0);
  const task = ACTIVITY_TASKS[variant] ?? ACTIVITY_TASKS[0]!;
  const s = solveActivityTask(task);
  const T = TEXT[task.id];
  const st = startTexts(task);
  const t = (v: number, dec?: number) => tText(task, v, dec);
  const A0 = `${fmt(task.A0, 0)} MBq`;
  const half = s.halvings;
  const tCdec = task.unit === 'min' ? 1 : 2;
  const tDwords = task.tDText.words ?? `${fmt(task.tDText.value, task.tDText.dec)} ${task.tDText.unit}`;
  const TLongText = `${fmt(task.TLongText.value, task.TLongText.dec)} ${task.TLongText.unit}`;
  const ratio = Number.isInteger(s.ratio) ? fmt(s.ratio, 0) : `ca. ${fmt(s.ratio, 0)}`;
  const k = s.between.k;

  // b) Tida fra målingen: «10.00 − 07.30 = 2 h 30 min = 2,5 h».
  const tBLine =
    task.when.kind === 'klokke'
      ? `t = ${st.given.replace('klokka ', '')} − ${st.measured.replace('klokka ', '')} = ${st.diff} = ${t(task.tB)}`
      : `t = ${st.diff} = ${t(task.tB)}`;

  // d) Tida og halveringstida til det tenkte stoffet i oppgavens enhet.
  const tDconv = task.tDText.unit === task.unit ? null : `t = ${tDwords} = ${t(task.tD, 0)}`;
  const TLconv = task.TLongText.unit === task.unit ? null : (
    <>
      <Th /> = {TLongText} = {t(task.TLong, 0)}
    </>
  );
  const fracLine = (n: number, f: number, exact: boolean): ReactNode =>
    exact ? (
      <>
        = 1/{fmt(2 ** n, 0)} = {String(f).replace('.', ',')} ≈ {pctText(f)}
      </>
    ) : (
      <>
        = {fmtSig(f, 4)} ≈ {pctText(f)}
      </>
    );

  const steps: ExampleStep[] = [
    {
      part: 'a',
      title: 'Les av når aktiviteten er halvert',
      body: (
        <p>
          Halveringstiden <Th /> er tida det tar før halvparten av de radioaktive kjernene har henfalt. Aktiviteten, antall henfall per
          sekund, er proporsjonal med antall kjerner som er igjen, så aktiviteten blir også halvert på én halveringstid. Vi leser av når
          grafen har sunket fra {A0} til halvparten.
        </p>
      ),
      math: [
        <>
          A<Sub>0</Sub> = {A0} ⇒ A<Sub>0</Sub>/2 = {fmt(half[1]!.A, 0)} MBq
        </>,
        <>
          Avlest: A = {fmt(half[1]!.A, 0)} MBq ved t = {t(half[1]!.t)}
        </>,
      ],
      tip: (
        <>
          Tegn en vannrett linje fra {fmt(half[1]!.A, 0)} MBq på aktivitetsaksen bort til grafen, og en loddrett linje derfra ned til
          tidsaksen.
        </>
      ),
    },
    {
      part: 'a',
      title: 'Kontroller med neste halvering',
      body: (
        <p>
          Halveringstiden er den samme uansett hvor mye som er igjen. Fra {fmt(half[1]!.A, 0)} MBq til {fmt(half[2]!.A, 0)} MBq skal det
          derfor også gå én halveringstid.
        </p>
      ),
      math: [
        <>
          Avlest: A = {fmt(half[2]!.A, 0)} MBq ved t = {t(half[2]!.t)}
        </>,
        <>
          {t(half[2]!.t)} − {t(half[1]!.t)} = {t(task.T)}
        </>,
      ],
      answer: (
        <>
          Aktiviteten halveres hver {t(task.T)}, så <Th /> = {t(task.T)} for {task.short}.
        </>
      ),
      pitfall: (
        <>
          Halveringstiden er ikke tida det tar før alt er borte. Etter to halveringstider er det fortsatt en firedel igjen ({fmt(half[2]!.A, 0)}{' '}
          MBq), og aktiviteten blir aldri helt null.
        </>
      ),
    },
    {
      part: 'b',
      title: 'Finn tida og antall halveringstider',
      body: (
        <p>
          Tida t regnes fra målingen. Den er ikke et helt antall halveringstider, så vi kan ikke bare halvere. Vi bruker i stedet formelen for
          radioaktiv halvering, A = A<Sub>0</Sub> · {halfPow('t/T½')}, og regner først ut eksponenten t/<Th />.
        </p>
      ),
      math: [
        tBLine,
        <>
          t/<Th /> = {t(task.tB)} / {t(task.T)} = {fmt(s.nB, 4)}
        </>,
      ],
      pitfall: <>t og <Th /> må ha samme enhet, ellers blir eksponenten feil. Her er begge i {task.unit}.</>,
    },
    {
      part: 'b',
      title: 'Sett inn i formelen for halvering',
      math: [
        <>
          A = A<Sub>0</Sub> · {halfPow('t/T½')} = {A0} · {halfPow(fmt(s.nB, 4))}
        </>,
        <>
          A = {A0} · {fmt(s.factorB, 4)} = {fmtSig(s.Ab, 3)} MBq
        </>,
      ],
      answer: (
        <>
          A ≈ {fmtSig(s.Ab, 2)} MBq {task.when.kind === 'klokke' || task.when.kind === 'dag' ? st.given : 'når sprøyta kommer fram'}
        </>
      ),
      pitfall: (
        <>
          Aktiviteten synker ikke like mye hver time. {fmt(s.nB, 2)} halveringstider gir ikke {fmt(s.nB, 2)} · {fmt(task.A0 / 2, 0)} MBq ={' '}
          {fmt((task.A0 / 2) * s.nB, 0)} MBq mindre ({fmt(s.linearWrong, 0)} MBq). Grafen er brattest i starten, så aktiviteten synker
          raskere enn det.
        </>
      ),
      tip: T.tipB ? T.tipB(pctText(s.lostB)) : <>Kontroller med grafen: ved t = {t(task.tB)} ligger grafen ved ca. {fmtSig(s.Ab, 2)} MBq.</>,
    },
    {
      part: 'c',
      title: 'Sett opp likningen og løs den med logaritmer',
      body: (
        <p>
          Nå starter vi ved {T.start}: andelen A/A<Sub>0</Sub> som er igjen, skal være {share(task.p)}, der A<Sub>0</Sub> er {T.startAkt}.
          Den ukjente tida står i eksponenten, så vi tar logaritmen (lg) på begge sider og bruker regelen lg(a<sup>x</sup>) = x · lg a.
        </p>
      ),
      math: [
        <>
          {halfPow('t/T½')} = {share(task.p)}
        </>,
        <>
          t/<Th /> · lg 0,5 = lg {share(task.p)}
        </>,
        <>
          t = <Th /> · lg {share(task.p)} / lg 0,5 = {t(task.T)} · ({fmt(s.lgP, 3)}) / ({fmt(s.lgHalf, 4)})
        </>,
        <>
          t = {t(task.T)} · {fmt(s.nC, 3)} = {t(s.tC, tCdec)}
        </>,
      ],
      pitfall: (
        <>
          Bruk andelen {share(task.p)}, ikke {fmtSig(task.p * 100, 2)}. Både lg {share(task.p)} og lg 0,5 er negative, så t blir positiv.
        </>
      ),
      tip: (
        <>
          Overslag: {exactPct(task.p)} ligger mellom 1/{fmt(2 ** k, 0)} = {exactPct(s.between.fracHigh)} ({k} halveringstider) og 1/
          {fmt(2 ** (k + 1), 0)} = {exactPct(s.between.fracLow)} ({k + 1} halveringstider). Svaret må altså ligge mellom {t(s.between.t1)} og{' '}
          {t(s.between.t2)}.
        </>
      ),
    },
    {
      part: 'c',
      title: 'Kontroller med grafen',
      body: (
        <p>
          Tida på grafen regnes fra målingen, men {T.start} var {t(task.tB)} senere. Vi finner aktiviteten vi leter etter, leser av når grafen
          kommer ned dit, og trekker fra {t(task.tB)}.
        </p>
      ),
      math: [
        <>
          {share(task.p)} · {fmtSig(s.Ab, 3)} MBq = {fmtSig(s.Ac, 3)} MBq
        </>,
        <>
          Avlest: A = {fmtSig(s.Ac, 2)} MBq ved t ≈ {t(s.tRead)} etter målingen
        </>,
        <>
          {t(s.tRead)} − {t(task.tB)} = {t(s.tReadDiff)}
        </>,
      ],
      answer: (
        <>
          Aktiviteten har sunket til {exactPct(task.p)} ca. {fmtSig(s.tC, task.sigC)} {task.unit} etter {T.start}
          {task.unit === 'min' ? <> (ca. {fmt(s.tC / 60, 1)} h)</> : null}. Avlesningen på grafen gir det samme.
        </>
      ),
      tip: 'Kroppen skiller også ut noe av stoffet, blant annet med urinen. I virkeligheten synker aktiviteten i pasienten derfor enda raskere.',
    },
    {
      part: 'd',
      title: `Regn ut andelen som er igjen etter ${tDwords}`,
      body: (
        <p>
          Andelen som er igjen, er {halfPow('t/T½')} for begge stoffene. Tida t regnes fra {T.start}, og t og <Th /> må ha samme enhet.
        </p>
      ),
      math: [
        ...(tDconv ? [tDconv] : []),
        <>
          {task.short}: {halfPow(`${t(task.tD, 0)} / ${t(task.T)}`)} = {halfPow(fmtSig(s.nD, 3))} {fracLine(s.nD, s.fD, Number.isInteger(s.nD))}
        </>,
        ...(TLconv ? [TLconv] : []),
        <>
          Tenkt stoff: {halfPow(`${t(task.tD, 0)} / ${t(task.TLong, 0)}`)} = {halfPow(fmtSig(s.nDLong, 3))} {fracLine(s.nDLong, s.fDLong, false)}
        </>,
      ],
      pitfall: (
        <>
          Kort halveringstid betyr ikke svakere stråling. Ved {T.start} har begge stoffene samme aktivitet, altså like mange henfall per
          sekund. Forskjellen er hvor lenge strålingen varer.
        </>
      ),
    },
    {
      part: 'd',
      title: 'Vurder fordelen med kort halveringstid',
      body: T.why,
      answer: T.answerD(pctText(s.fD), pctText(s.fDLong)),
      tip: (
        <>
          Arealet under grafen for aktiviteten er antall henfall. Med samme aktivitet ved {T.start} gir et stoff med {ratio} ganger så lang
          halveringstid {ratio} ganger så mange henfall i kroppen til sammen, og dermed en mye større stråledose.
        </>
      ),
    },
  ];

  const given: ReactNode[] = [
    <>
      A<Sub>0</Sub> = {A0} {st.measured}
    </>,
    task.when.kind === 'varighet' ? <>Transporttid: {st.diff}</> : <>Pasienten får stoffet {st.given}</>,
    <>
      Andel i c): {exactPct(task.p)}
    </>,
    <>
      Tenkt stoff i d): <Th /> = {TLongText}
    </>,
  ];

  return (
    <WorkedExample
      variants={{ labels: ['Tc-99m', 'I-131', 'F-18'], value: variant, onChange: setVariant }}
      intro={
        <>
          {T.about}
          <p>
            {task.when.kind === 'varighet' ? (
              <>
                Dosen lages i en syklotron på et annet sykehus. Ved utsending måles aktiviteten i {T.source} til {A0}, og transporten tar {st.diff}.{' '}
              </>
            ) : (
              <>
                {capitalize(st.measured)} måles aktiviteten i {T.source} til {A0} i en aktivitetsmåler. {T.gets(st.given)}{' '}
              </>
            )}
            {task.when.kind === 'varighet' ? T.gets(st.given) + ' ' : ''}
            Grafen viser hvordan aktiviteten endrer seg med tida etter målingen. Se bort fra at kroppen skiller ut noe av stoffet.
          </p>
        </>
      }
      given={given}
      parts={[
        {
          id: 'a',
          text: (
            <>
              Bruk grafen til å vise at halveringstiden til {task.short} er {t(task.T)}.
            </>
          ),
        },
        { id: 'b', text: T.partB(st.given) },
        {
          id: 'c',
          text: `Hvor lang tid etter ${T.start} har aktiviteten i pasienten sunket til ${exactPct(task.p)} av ${T.startAkt}? Bruk logaritmer, og kontroller svaret med grafen.`,
        },
        {
          id: 'd',
          text: `Hvor stor del av aktiviteten er igjen ${tDwords} etter ${T.start}? Sammenlign med et tenkt stoff som oppfører seg likt i kroppen, men har halveringstiden ${TLongText}, og vurder hvorfor kort halveringstid er en fordel i medisin.`,
        },
      ]}
      steps={steps}
      figure={(state) => <ActivityFigure task={task} s={s} state={state} />}
    />
  );
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}
