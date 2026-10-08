import { useState, type ReactNode } from 'react';
import { Sub, WorkedExample, fmt, type ExampleStep } from '../../kit';
import { WaveFigures, pos, sig, type WaveView } from './eks-bolge-figur';
import { POST_SPACING, WAVE_TASKS, solveWaveTask, type WaveSolution, type WaveTask } from './model-eks-bolge';

/**
 * Eksempeloppgave (6A): bølger ved ei brygge. Grafen viser vannflaten i to bilder fra en film. Eleven leser av
 * amplituden og bølgelengden, finner farten fra hvor langt en bølgetopp har flyttet seg, deretter frekvensen og
 * perioden, avgjør om måken i P er på vei opp eller ned, og finner når måken er på en bølgetopp.
 * Oppgaven er laget for appen (egen tekst og egne tall) i samme stil som eksamensoppgaver.
 *
 * Alle tall kommer fra solveWaveTask. Mellomsvarene vises med tre gjeldende siffer (farten med fire, fordi den
 * brukes videre) og svarene med to.
 */
export default function EksBolge() {
  const [variant, setVariant] = useState(0);
  const task = WAVE_TASKS[variant] ?? WAVE_TASKS[0]!;
  const s = solveWaveTask(task);
  const steps = buildSteps(task, s);
  const sourceKind = SOURCE_KIND[variant] ?? null;

  return (
    <WorkedExample
      variants={{ labels: ['Tallsett 1', 'Tallsett 2', 'Tallsett 3'], value: variant, onChange: setVariant }}
      intro={
        <>
          <p>
            {task.source}, og bølgene ruller inn mot land langs ei lang brygge. Sara filmer vannflaten langs brygga fra siden. Grafen viser
            vannflaten i to bilder fra filmen: den heltrukne linja i bilde 1 (t = 0) og den stiplede linja i bilde 2, {sig(task.dt, 2)} s
            senere.
          </p>
          <p>
            Bølgene går mot høyre i grafen, og tiden mellom bildene er kortere enn en halv periode. En måke ligger og flyter på vannet i
            punktet P. Vi regner bølgene som transversale: vannflaten beveger seg bare opp og ned.
          </p>
        </>
      }
      given={[
        <>Δt = {sig(task.dt, 2)} s</>,
        <>bølgene går mot høyre</>,
      ]}
      parts={[
        { id: 'a', text: 'Bestem amplituden og bølgelengden til bølgene.' },
        { id: 'b', text: <>Vis at farten til bølgene er om lag {sig(s.vShown, 2)} m/s.</> },
        { id: 'c', text: 'Bestem frekvensen og perioden til bølgene.' },
        { id: 'd', text: 'Er måken på vei opp eller ned i bilde 1? Forklar.' },
        { id: 'e', text: 'Hvor lang tid etter bilde 1 er måken på en bølgetopp for første gang?' },
      ]}
      steps={steps}
      figure={(state) => {
        const view: WaveView = state.showAll ? 'alle' : state.step === 0 ? 'oppgave' : (steps[state.step - 1]?.view ?? 'oppgave');
        return <WaveFigures task={task} s={s} view={view} sourceKind={sourceKind} />;
      }}
    />
  );
}

/** Båten langt ute i scenen (dønningene kommer fra havet, så der er det ingen båt). */
const SOURCE_KIND: ('ferje' | 'motorbaat' | null)[] = ['ferje', null, 'motorbaat'];

type WaveStep = ExampleStep & { view: WaveView };

const m = (x: number) => `${pos(x)} m`;
/** Høyder med to desimaler, eller tre når det trengs: −0,40 m, 0,00 m, −0,125 m. */
const yM = (y: number) => `${fmt(y, Math.abs(y * 100 - Math.round(y * 100)) < 1e-6 ? 2 : 3)} m`;

function fractionText(fr: WaveSolution['fraction']): string | null {
  if (!fr) return null;
  if (fr.den === 1) return fr.num === 1 ? '' : `${fr.num}`;
  return `${fr.num}/${fr.den}`;
}

function buildSteps(task: WaveTask, s: WaveSolution): WaveStep[] {
  const vLong = `${sig(s.v, 4)} m/s`;
  const lam = sig(task.lambda, 2);
  const fMid = sig(s.f, 3);
  const TMid = sig(s.T, 3);
  const [c1 = task.crest0, c2 = task.crest0 + task.lambda] = s.crests0;
  const [d1 = 0, d2 = 0] = s.troughs0;
  const wrongFrom = c2;
  const wrongDist = c2 - s.crestMoved;
  const xP = <>x<Sub>P</Sub></>;
  const yP = <>y<Sub>P</Sub></>;
  const postsPerLambda = Math.round(task.lambda / POST_SPACING);
  const ext = s.leftExtreme;
  const down = s.direction === 'ned';
  const fr = fractionText(s.fraction);
  const yP0 = yM(s.yP0);
  const yP1 = yM(s.yP1);
  const rightCrest = s.crests0.find((x) => x > task.xP);

  const dirAnswer: ReactNode = down ? 'Måken er på vei ned i bilde 1.' : 'Måken er på vei opp i bilde 1.';
  const eTip: ReactNode =
    fr !== null ? (
      <>
        Kontroll: d = {fr} λ, så t = {fr} T = {fr} · {TMid} s = {sig((s.d / task.lambda) * s.T, 3)} s.{' '}
        {down
          ? 'Måken er på vei ned, så den må først ned i en dal og opp igjen. Det tar mer enn en halv periode.'
          : 'Måken er på vei opp, så den når toppen før det har gått en halv periode.'}
      </>
    ) : null;

  return [
    {
      part: 'a',
      view: 'a1',
      title: 'Les av amplituden',
      body: (
        <p>
          Amplituden er det største utslaget fra likevektslinja y = 0, der vannflaten ligger når det ikke er bølger. Toppene ligger på y ={' '}
          {yM(task.A)} og dalene på y = {yM(-task.A)}.
        </p>
      ),
      math: [<>A = {sig(task.A, 2)} m</>],
      pitfall: (
        <>
          Avstanden fra dal til topp, {sig(2 * task.A, 2)} m, er bølgehøyden. Amplituden er bare halvparten, målt fra likevektslinja.
        </>
      ),
    },
    {
      part: 'a',
      view: 'a2',
      title: 'Les av bølgelengden',
      body: (
        <p>
          Bølgelengden er avstanden mellom to nabotopper i det samme bildet. Vi bruker den heltrukne linja (bilde 1). Avstanden mellom to
          nabodaler er like stor.
        </p>
      ),
      math: [
        <>
          λ = {m(c2)} − {m(c1)} = {m(c2 - c1)}
        </>,
        <>
          mellom to daler: {m(d2)} − {m(d1)} = {m(d2 - d1)}
        </>,
      ],
      answer: (
        <>
          A = {sig(task.A, 2)} m og λ = {lam} m.
        </>
      ),
      tip: (
        <>
          Du kan også telle pælene under brygga i tegningen. De står {fmt(POST_SPACING, 1)} m fra hverandre, og én bølgelengde er{' '}
          {postsPerLambda} mellomrom: {postsPerLambda} · {fmt(POST_SPACING, 1)} m = {lam} m.
        </>
      ),
      pitfall: 'Mål ikke fra en topp på den heltrukne linja til en topp på den stiplede. Det er to ulike tidspunkter.',
    },
    {
      part: 'b',
      view: 'b1',
      title: 'Følg én bølgetopp fra bilde 1 til bilde 2',
      body: (
        <p>
          Bølgen går mot høyre, så toppen ved x = {m(task.crest0)} i bilde 1 har flyttet seg mot høyre. Tiden mellom bildene er kortere enn en
          halv periode, så toppen har flyttet seg mindre enn en halv bølgelengde ({m(task.lambda / 2)}). Da er det toppen ved x ={' '}
          {m(s.crestMoved)} i bilde 2.
        </p>
      ),
      math: [
        <>
          Δx = {m(s.crestMoved)} − {m(task.crest0)} = {m(task.dx)}
        </>,
      ],
      pitfall: (
        <>
          Det kan se ut som om toppen ved {m(wrongFrom)} har gått {m(wrongDist)} til venstre til {m(s.crestMoved)}. Men bølgene går mot
          høyre, så den toppen er kommet til {m(wrongFrom + task.dx)}.
        </>
      ),
    },
    {
      part: 'b',
      view: 'b2',
      title: 'Regn ut farten',
      body: <p>Farten til bølgen er hvor langt toppen har flyttet seg, delt på tiden det tok.</p>,
      math: [
        <>
          v = Δx / Δt = {m(task.dx)} / {sig(task.dt, 2)} s = {vLong}
        </>,
      ],
      answer: (
        <>
          v = {vLong} ≈ {sig(s.vShown, 2)} m/s, som var det vi skulle vise.
        </>
      ),
      tip: 'Hele bølgeformen flytter seg like langt. Følger du en dal i stedet for en topp, får du den samme Δx.',
    },
    {
      part: 'c',
      view: 'c1',
      title: 'Bruk bølgeformelen v = λf',
      body: (
        <p>
          På én periode T går bølgen nøyaktig én bølgelengde, så v = λ / T = λf. Vi løser for frekvensen f og bruker den uavrundede farten fra
          b).
        </p>
      ),
      math: [
        <>v = λf ⇒ f = v / λ</>,
        <>
          f = {vLong} / {lam} m = {fMid} Hz
        </>,
      ],
      pitfall: <>Regner du med {sig(s.vShown, 2)} m/s i stedet for {vLong}, kan det siste sifferet i svaret bli feil.</>,
    },
    {
      part: 'c',
      view: 'c2',
      title: 'Finn perioden',
      body: <p>Perioden er tiden én hel svingning tar, altså den omvendte av frekvensen.</p>,
      math: [
        <>
          T = 1 / f = 1 / {fMid} Hz = {TMid} s
        </>,
      ],
      answer: (
        <>
          f = {sig(s.f, 2)} Hz og T = {sig(s.T, 2)} s.
        </>
      ),
      tip: (
        <>
          Kontroll: T = λ / v = {lam} m / {vLong} = {TMid} s. Måken går opp og ned én gang på {sig(s.T, 2)} s.
        </>
      ),
    },
    {
      part: 'd',
      view: 'd1',
      title: 'Bølgeformen flytter seg mot høyre',
      body: (
        <p>
          Bølgeformen flytter seg mot høyre, men vannet og måken beveger seg bare opp og ned. Litt senere har P derfor fått den høyden som
          vannet rett til venstre for P har nå. Den tynne linja viser vannflaten litt etter bilde 1. Nærmest til venstre for P ligger en{' '}
          {ext.kind} (ved x = {m(ext.x)}), og den er på vei mot P.
        </p>
      ),
      math: [
        <>
          {ext.kind === 'dal' ? 'dalen' : 'toppen'} ved x = {m(ext.x)} nærmer seg P ⇒ vannet i P {down ? 'synker' : 'stiger'}
        </>,
      ],
      pitfall: (
        <>
          Om P går opp eller ned, avhenger av hvilken vei bølgen går. Hadde bølgene gått mot venstre, ville måken vært på vei{' '}
          {down ? 'opp' : 'ned'}.
        </>
      ),
    },
    {
      part: 'd',
      view: 'd2',
      title: 'Sjekk med bilde 2',
      body: (
        <p>
          I bilde 2 ser vi hvor vannet i P er {sig(task.dt, 2)} s senere. Det er {down ? 'lavere' : 'høyere'} enn i bilde 1.
        </p>
      ),
      math: [
        <>
          {yP}(0) = {yP0}
        </>,
        <>
          {yP}({sig(task.dt, 2)} s) = {yP1}
        </>,
      ],
      answer: dirAnswer,
      tip: 'Sammenligningen med bilde 2 virker bare når måken ikke passerer en topp eller en dal mellom bildene. Metoden med å skyve bølgeformen litt mot høyre virker alltid.',
      pitfall: 'Mange tror at måken følger med bølgen inn mot land. Bølgen fører energi mot høyre, men vannet og måken blir stort sett der de er.',
    },
    {
      part: 'e',
      view: 'e1',
      title: 'Hvilken topp kommer først til P?',
      body: (
        <p>
          Toppene flytter seg mot høyre med farten v. Den første toppen som når måken, er den nærmeste toppen til venstre for P i bilde 1, ved x
          = {m(s.crestLeftOfP)}. Den må gå avstanden d.
        </p>
      ),
      math: [
        <>
          d = {xP} − x<Sub>topp</Sub> = {m(task.xP)} − {m(s.crestLeftOfP)} = {m(s.d)}
        </>,
      ],
      pitfall:
        rightCrest !== undefined
          ? `Toppen ved ${m(rightCrest)} er til høyre for P. Den går bort fra måken og kommer aldri tilbake.`
          : 'Toppene til høyre for P går bort fra måken og kommer aldri tilbake.',
    },
    {
      part: 'e',
      view: 'e2',
      title: 'Finn tiden',
      body: <p>Toppen går med konstant fart, så tiden er avstanden delt på farten.</p>,
      math: [
        <>
          t = d / v = {m(s.d)} / {vLong} = {sig(s.tCrest, 3)} s
        </>,
      ],
      answer: <>Måken er på en bølgetopp for første gang {sig(s.tCrest, 2)} s etter bilde 1.</>,
      tip: eTip ?? undefined,
    },
  ];
}
