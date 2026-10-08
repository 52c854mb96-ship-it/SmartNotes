import { useState, type ReactNode } from 'react';
import { Sub, Sup, WorkedExample, fmt, type ExampleStep } from '../../kit';
import { SunFigures, fmtS, type SunView } from './eks-sola-figur';
import { SUN_TASKS, WIEN_B, fmtSigPlain, fmtStd, roundSig, solveSunTask, toCelsius, type SunSolution, type SunTask } from './model-eks-sola';

/**
 * Eksempeloppgave (6B, 6C): Sola som svart legeme. Fra toppen i spekteret (Wiens forskyvningslov) til
 * overflatetemperaturen, utstrålt effekt per kvadratmeter (Stefan–Boltzmann), total effekt og intensiteten ved
 * planeten (effekten fordelt på en kuleflate), og til slutt strålingsbalansen for planeten uten drivhuseffekt.
 * Oppgaven er laget for appen (egen tekst og egne tall) i samme stil som eksamensoppgaver.
 *
 * Alle tall kommer fra solveSunTask. Mellomsvarene vises med fire gjeldende siffer og svarene med tre, så hver linje
 * i utregningen går opp (model-eks-sola.test.ts sjekker det for alle tallsettene).
 */
export default function EksSola() {
  const [variant, setVariant] = useState(0);
  const task = SUN_TASKS[variant] ?? SUN_TASKS[0]!;
  const s = solveSunTask(task);
  const earth = solveSunTask(SUN_TASKS[0]!);
  const steps = buildSteps(task, s, earth);
  const isEarth = task.planet === 'jorda';
  const albedoPct = fmt(task.albedo * 100, 0);

  return (
    <WorkedExample
      variants={{ labels: ['Tallsett 1', 'Tallsett 2', 'Tallsett 3'], value: variant, onChange: setVariant }}
      intro={
        <>
          <p>
            {task.probe} måler sollyset{isEarth ? ' over atmosfæren' : ''}. Grafen viser spekteret den måler: hvor stor intensitet sollyset har
            per nanometer bølgelengde. Vi regner Sola som et svart legeme med radius {sci(task.R, 3)} m. Avstanden fra Sola til {task.name} er{' '}
            {sci(task.r, 3)} m.
          </p>
          <p>
            {task.Name} reflekterer {albedoPct} % av sollyset som treffer planeten, altså er albedoen {fmt(task.albedo, 2)}. Den målte
            middeltemperaturen ved overflaten er {signedC(task.measuredC)}.
          </p>
        </>
      }
      given={[
        <>R = {sci(task.R, 3)} m</>,
        <>r = {sci(task.r, 3)} m</>,
        <>α = {fmt(task.albedo, 2)}</>,
        <>
          t<Sub>målt</Sub> = {signedC(task.measuredC)}
        </>,
      ]}
      parts={[
        { id: 'a', text: 'Bruk grafen til å bestemme overflatetemperaturen til Sola.' },
        {
          id: 'b',
          text: <>Vis at hver kvadratmeter av overflaten til Sola stråler ut en effekt på om lag {sci(s.IShown, 2)} W.</>,
        },
        { id: 'c', text: 'Hvor stor effekt stråler Sola ut til sammen?' },
        {
          id: 'd',
          text: isEarth
            ? 'Bestem intensiteten til sollyset ved jorda. Denne intensiteten kalles solarkonstanten.'
            : `Bestem intensiteten til sollyset ved ${task.name}.`,
        },
        {
          id: 'e',
          text: `Anta at ${task.name} ikke hadde hatt noen drivhuseffekt. Bestem middeltemperaturen ${task.name} da ville fått, og sammenlign med den målte middeltemperaturen. Hva forteller sammenligningen?`,
        },
      ]}
      steps={steps}
      figure={(state) => {
        const view: SunView = state.showAll ? 'alle' : state.step === 0 ? 'oppgave' : (steps[state.step - 1]?.view ?? 'oppgave');
        return <SunFigures task={task} s={s} view={view} />;
      }}
    />
  );
}

type SunStep = ExampleStep & { view: SunView };

/** Tall på standardform med hevet eksponent i HTML: 6,96 · 10⁸. */
function sci(v: number, sig: number): string {
  return fmtStd(v, sig);
}

const signedC = (c: number) => `${c < 0 ? '−' : ''}${fmt(Math.abs(c), 0)} °C`;

/** Antall vannkokere på 2 000 W som gir like stor effekt som én kvadratmeter av Sola. */
const KETTLE_W = 2000;

function buildSteps(task: SunTask, s: SunSolution, earth: SunSolution): SunStep[] {
  const name = task.name;
  const isEarth = task.planet === 'jorda';
  const sig4 = (v: number) => sci(v, 4);
  const lambdaM = sci(s.lambda, 3);
  const Tshown = fmtSigPlain(s.Teq, 3);
  const TshownNum = roundSig(s.Teq, 3);
  const Tc = toCelsius(s.Teq);
  const absorbed = fmtSigPlain(s.absorbedAvg, 3);
  const dT = Math.round(s.measuredT - TshownNum);
  const sigma = (
    <>
      5,67 · 10<Sup>−8</Sup> W/(m² · K<Sup>4</Sup>)
    </>
  );
  const Rp = (
    <>
      R<Sub>p</Sub>
    </>
  );
  const lmax = (
    <>
      λ<Sub>maks</Sub>
    </>
  );

  const compare: Record<SunSolution['greenhouse'], { body: ReactNode; answer: ReactNode; tip: ReactNode }> = {
    stor: {
      body: (
        <p>
          Den målte middeltemperaturen er {dT} K høyere enn modellen gir. Forskjellen er drivhuseffekten: atmosfæren slipper sollyset gjennom,
          men drivhusgassene (vanndamp, CO₂ og metan) tar opp mye av varmestrålingen fra bakken og sender en del av den tilbake ned. Da blir
          bakken varmere enn den ville vært uten atmosfære.
        </p>
      ),
      answer: (
        <>
          Uten drivhuseffekt ville {name} hatt middeltemperaturen {Tshown} K ({signedC(Tc)}). Den målte er {fmt(s.measuredT, 0)} K, altså {dT} K
          høyere. Forskjellen skyldes drivhuseffekten.
        </>
      ),
      tip: 'Mer CO₂ i atmosfæren betyr at enda mer av varmestrålingen blir tatt opp og sendt tilbake, så temperaturen ved bakken stiger til det er balanse igjen.',
    },
    'nesten-ingen': {
      body: (
        <p>
          Den målte middeltemperaturen er nesten den samme som modellen gir (forskjellen er bare {Math.abs(dT)} K). Atmosfæren på {name} er
          nesten bare CO₂, men den er svært tynn: trykket ved bakken er under 1 % av trykket på jorda. Derfor blir lite av varmestrålingen tatt
          opp, og drivhuseffekten er svært liten.
        </p>
      ),
      answer: (
        <>
          Modellen gir {Tshown} K ({signedC(Tc)}), og den målte middeltemperaturen er {fmt(s.measuredT, 0)} K. De er nesten like, så {name} har
          nesten ingen drivhuseffekt fordi atmosfæren er så tynn.
        </>
      ),
      tip: `Den tynne atmosfæren holder også lite på varmen om natta, så forskjellen mellom dag og natt er mye større på ${name} enn på jorda.`,
    },
    enorm: {
      body: (
        <p>
          Den målte middeltemperaturen er hele {dT} K høyere enn modellen gir. {task.Name} har en svært tykk atmosfære som nesten bare er CO₂
          (trykket ved bakken er ca. 90 ganger trykket på jorda), og den tar opp nesten all varmestrålingen fra bakken. Drivhuseffekten er
          enorm.
        </p>
      ),
      answer: (
        <>
          Uten drivhuseffekt ville {name} hatt {Tshown} K ({signedC(Tc)}), men den målte middeltemperaturen er {fmt(s.measuredT, 0)} K (
          {signedC(task.measuredC)}). Drivhuseffekten gjør {name} over {fmt(Math.floor(dT / 100) * 100, 0)} K varmere.
        </>
      ),
      tip: (
        <>
          {task.Name} får nesten dobbelt så mye sollys per kvadratmeter som jorda, men skyene reflekterer {fmt(task.albedo * 100, 0)} %. Derfor
          tar {name} opp mindre sollys enn jorda ({absorbed} mot {fmtSigPlain(earth.absorbedAvg, 3)} W/m² i snitt), og er likevel den varmeste
          planeten.
        </>
      ),
    },
  };
  const cmp = compare[s.greenhouse];

  return [
    {
      part: 'a',
      view: 'a1',
      title: 'Les av toppen i spekteret',
      body: (
        <p>
          Toppen i grafen er bølgelengden der Sola stråler mest. Vi leser av at toppen ligger ved {task.lambdaNm} nm. I formlene må
          bølgelengden være i meter.
        </p>
      ),
      math: [
        <>
          {lmax} = {task.lambdaNm} nm = {task.lambdaNm} · 10<Sup>−9</Sup> m = {lambdaM} m
        </>,
      ],
      tip: 'Måler vi lenger unna Sola, blir hele kurven lavere, men toppen ligger ved samme bølgelengde. Den avhenger bare av temperaturen til Sola.',
    },
    {
      part: 'a',
      view: 'a2',
      title: 'Bruk Wiens forskyvningslov',
      body: (
        <p>
          Wiens forskyvningslov sier at toppen i spekteret til et svart legeme ligger ved kortere bølgelengde jo varmere legemet er: {lmax} · T
          = b, der b = {sci(WIEN_B, 3)} m · K. Vi løser for T.
        </p>
      ),
      math: [
        <>
          {lmax} · T = b ⇒ T = b / {lmax}
        </>,
        <>
          T = {sci(WIEN_B, 3)} m · K / {lambdaM} m = {fmt(s.T, 0)} K
        </>,
      ],
      answer: (
        <>
          Overflatetemperaturen til Sola er T = {sci(s.T, 3)} K, altså {fmt(s.T, 0)} K.
        </>
      ),
      pitfall: (
        <>
          Glemmer du å gjøre om fra nanometer til meter, blir temperaturen en milliard ganger for lav. Og temperaturen i strålingslovene er alltid
          i kelvin.
        </>
      ),
    },
    {
      part: 'b',
      view: 'b1',
      title: 'Bruk Stefan–Boltzmanns lov',
      body: (
        <p>
          Stefan–Boltzmanns lov gir effekten et svart legeme stråler ut per kvadratmeter av overflaten, I = σT<Sup>4</Sup>, med σ = {sigma}.
          Den gjelder for alle bølgelengdene til sammen.
        </p>
      ),
      math: [
        <>
          I = σT<Sup>4</Sup> = {sigma} · ({fmt(s.T, 0)} K)<Sup>4</Sup>
        </>,
        <>I = {sig4(s.I)} W/m²</>,
      ],
      answer: (
        <>
          I ≈ {sci(s.IShown, 2)} W/m², som var det vi skulle vise. Det er like mye som ca. {fmt(roundSig(s.I / KETTLE_W, 2), 0)} vannkokere
          på hver kvadratmeter.
        </>
      ),
      tip: (
        <>
          Bare T skal opphøyes i fjerde potens, ikke σ. Fjerde potens gjør loven svært følsom for temperaturen: dobbelt så høy temperatur gir
          2<Sup>4</Sup> = 16 ganger så stor utstråling per kvadratmeter.
        </>
      ),
    },
    {
      part: 'c',
      view: 'c1',
      title: 'Finn arealet av overflaten til Sola',
      body: <p>Sola er en kule, og den stråler fra hele overflaten. Arealet av en kuleflate med radius R er 4πR².</p>,
      math: [
        <>
          A = 4πR² = 4π · ({sci(task.R, 3)} m)² = {sig4(s.Asun)} m²
        </>,
      ],
      pitfall: 'πR² er arealet av en sirkelskive. Sola stråler fra hele kula, så vi trenger arealet av kuleflaten, 4πR².',
    },
    {
      part: 'c',
      view: 'c2',
      title: 'Gang effekten per kvadratmeter med arealet',
      body: (
        <p>
          Hver kvadratmeter stråler ut effekten I, så hele Sola stråler ut I ganger arealet. Vi regner videre med den uavrundede verdien av I
          fra b), ikke med {sci(s.IShown, 2)} W/m².
        </p>
      ),
      math: [
        <>
          P = I · A = {sig4(s.I)} W/m² · {sig4(s.Asun)} m²
        </>,
        <>P = {sci(s.P, 3)} W</>,
      ],
      answer: <>Sola stråler ut P = {sci(s.P, 3)} W.</>,
      tip: <>Det betyr at Sola sender ut {sci(s.P, 2)} J energi hvert sekund, i alle retninger.</>,
    },
    {
      part: 'd',
      view: 'd1',
      title: 'Tenk deg en stor kule rundt Sola',
      body: (
        <p>
          Strålingen går rett ut fra Sola i alle retninger, og ingenting tar den opp i det tomme rommet på veien. Derfor går hele effekten P
          gjennom en tenkt kuleflate med Sola i sentrum og radius r, akkurat der {name} er.
        </p>
      ),
      math: [
        <>
          A = 4πr² = 4π · ({sci(task.r, 3)} m)² = {sig4(s.Asphere)} m²
        </>,
      ],
      pitfall: <>Radien i kuleflaten er avstanden fra Sola til {name}, ikke radien til Sola eller til {name}.</>,
    },
    {
      part: 'd',
      view: 'd2',
      title: 'Fordel effekten på kuleflaten',
      body: (
        <p>
          Intensitet er effekt per kvadratmeter. Effekten fordeler seg jevnt på kuleflaten, så hver kvadratmeter der {name} er, får P / 4πr². Det
          er også arealet under hele kurven i grafen.
        </p>
      ),
      math: [
        <>
          S = P / A = {sig4(s.P)} W / {sig4(s.Asphere)} m²
        </>,
        <>
          S = {s.S >= 1000 ? `${sci(s.S, 3)} W/m²` : `${fmtSigPlain(s.S, 3)} W/m²`}
        </>,
      ],
      answer: (
        <>
          {isEarth ? 'Solarkonstanten' : `Intensiteten ved ${name}`} er S = {fmtS(s.S)}. Målinger gir {fmt(task.measuredS, 0)} W/m², så vi
          bommer med bare {fmt(s.SError * 100, 1)} %.
        </>
      ),
      tip: (
        <>
          Du kan også regne direkte: S = I · (R/r)² = {sig4(s.I)} W/m² · ({sci(task.R, 3)} m / {sci(task.r, 3)} m)² = {fmtS(s.S)}. Intensiteten
          avtar med kvadratet av avstanden. Avviket fra målingen kommer mest av at toppen i grafen er avrundet: T inngår i fjerde potens, så en liten
          feil i {lmax} gir fire ganger så stor prosentvis feil i S.
        </>
      ),
    },
    {
      part: 'e',
      view: 'e1',
      title: <>Sett opp strålingsbalansen for {name}</>,
      body: (
        <>
          <p>
            Når middeltemperaturen ikke endrer seg, stråler {name} ut like mye effekt som den tar opp. Sollyset kommer fra én retning, så{' '}
            {name} fanger like mye lys som en flat skive med samme radius, med arealet π{Rp}². Andelen α blir reflektert, så andelen (1 − α)
            blir tatt opp.
          </p>
          <p>Varmestrålingen går derimot ut fra hele kuleflaten, 4π{Rp}².</p>
        </>
      ),
      math: [
        <>
          (1 − α) · S · π{Rp}² = σT<Sup>4</Sup> · 4π{Rp}² ⇒ (1 − α) · S / 4 = σT<Sup>4</Sup>
        </>,
        <>
          (1 − α) · S / 4 = (1 − {fmt(task.albedo, 2)}) · {fmtSigPlain(s.S, 4)} W/m² / 4 = {absorbed} W/m²
        </>,
      ],
      tip: <>Radien {Rp} forkortes bort. Svaret blir det samme for en liten og en stor planet i samme avstand fra Sola.</>,
      pitfall: (
        <>
          Bruk ikke 4π{Rp}² for sollyset. Bare halve kula har dag, og der treffer lyset skrått. Til sammen fanger kula like mye lys som skiva π
          {Rp}².
        </>
      ),
    },
    {
      part: 'e',
      view: 'e2',
      title: 'Løs likningen for temperaturen',
      body: <p>Vi deler på σ og tar fjerderota. Til slutt gjør vi om til celsius, så vi kan sammenligne med målingen.</p>,
      math: [
        <>
          T = ({absorbed} W/m² / {sigma})<Sup>1/4</Sup> = {Tshown} K
        </>,
        <>
          t = {Tshown} − 273 = {signedC(Tc)}
        </>,
      ],
      tip: (
        <>
          Wiens lov gir toppen i varmestrålingen fra {name}: {lmax} = b / T = {sci(WIEN_B, 3)} m · K / {Tshown} K ≈ {fmt(roundSig(s.lambdaPlanet * 1e6, 2), 0)}{' '}
          µm, langt ute i infrarødt. Derfor kan drivhusgasser ta opp varmestrålingen, men slippe sollyset gjennom.
        </>
      ),
    },
    {
      part: 'e',
      view: 'e3',
      title: 'Sammenlign med den målte temperaturen',
      body: cmp.body,
      math: [
        <>
          T<Sub>målt</Sub> = t<Sub>målt</Sub> + 273 = {task.measuredC < 0 ? '−' : ''}
          {fmt(Math.abs(task.measuredC), 0)} + 273 = {fmt(s.measuredT, 0)} K
        </>,
        <>
          T<Sub>målt</Sub> − T = {fmt(s.measuredT, 0)} K − {Tshown} K = {dT < 0 ? '−' : ''}
          {fmt(Math.abs(dT), 0)} K
        </>,
      ],
      answer: cmp.answer,
      tip: cmp.tip,
    },
  ];
}
