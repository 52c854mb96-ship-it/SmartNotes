import { useState } from 'react';
import { Sub, WorkedExample, fmt, type ExampleStep } from '../../kit';
import { PULLEY_TASKS, solvePulleyTask } from './model-eks-trinse';
import { TrinseFigure, type TrinseFig } from './trinse-figur';

/** Svar med to gjeldende siffer (1,3 N, 0,92 N, 2,0 m/s²). */
function sig2(v: number): string {
  return fmt(v, v >= 10 ? 0 : v >= 1 ? 1 : 2);
}

/** «1,31 N ≈ 1,3 N», eller bare «0,92 N» når avrundingen ikke endrer noe. */
function approx(v: number, decimals: number, unit: string): string {
  const exact = fmt(v, decimals);
  const short = sig2(v);
  return exact === short ? `${exact} ${unit}` : `${exact} ${unit} ≈ ${short} ${unit}`;
}

const BARS = ['', 'ett ekstralodd', 'to ekstralodd', 'tre ekstralodd'];

/**
 * Eksempeloppgave (2B, 2C, 2E): en dynamikkvogn på et labbord trekkes av et lodd i en snor over en trinse. Kreftene
 * på hvert legeme, akselerasjonen til systemet, snordraget og hvorfor det er mindre enn tyngden til loddet, farten når
 * loddet lander, og hva som endres når vogna byttes med en trekloss med friksjon. Oppgaven er laget for appen (egen
 * tekst og egne tall) i samme stil som eksamensoppgaver.
 */
export default function EksTrinse() {
  const [variant, setVariant] = useState(0);
  const task = PULLEY_TASKS[variant] ?? PULLEY_TASKS[0]!;
  const s = solvePulleyTask(task);
  const { m1, m2, h, muK, bars } = task;
  const M = m1 + m2;
  const kg = (m: number) => `${fmt(m, 2)} kg`;

  const steps: (ExampleStep & { fig: TrinseFig })[] = [
    {
      part: 'a',
      fig: 'vogn',
      title: 'Finn kreftene på vogna',
      body: (
        <>
          <p>
            Vogna påvirkes av tre ting: jorda (tyngden G<Sub>1</Sub>), bordet (normalkraften N) og snora (snordraget S). Loddet
            berører ikke vogna, så det virker bare på vogna gjennom snora.
          </p>
          <p>
            Bordet er vannrett, og vogna beveger seg ikke opp eller ned. Da er kraftsummen loddrett null, så N er like stor som G
            <Sub>1</Sub>. Snora drar vogna vannrett mot trinsa.
          </p>
        </>
      ),
      math: [
        <>
          N = G<Sub>1</Sub> = m<Sub>1</Sub>g = {kg(m1)} · 9,81 m/s² = {fmt(s.G1, 2)} N
        </>,
      ],
      pitfall: (
        <>
          Ikke tegn tyngden til loddet på vogna. G<Sub>2</Sub> virker på loddet. Det er snora som drar i vogna, med kraften S.
        </>
      ),
    },
    {
      part: 'a',
      fig: 'lodd',
      title: 'Finn kreftene på loddet',
      body: (
        <p>
          Loddet påvirkes av jorda (tyngden G<Sub>2</Sub> nedover) og snora (snordraget S oppover). Snora og trinsa er masseløse, og
          trinsa er uten friksjon. Da drar snora like hardt i begge ender, så S er like stor på vogna og på loddet.
        </p>
      ),
      math: [
        <>
          G<Sub>2</Sub> = m<Sub>2</Sub>g = {kg(m2)} · 9,81 m/s² = {fmt(s.G2, 2)} N
        </>,
      ],
      answer: (
        <>
          Vogna: G<Sub>1</Sub>, N og S. Loddet: G<Sub>2</Sub> og S (se figuren).
        </>
      ),
      tip: (
        <>
          S-pila på loddet er kortere enn G<Sub>2</Sub>-pila. Hvorfor, finner du ut i c).
        </>
      ),
    },
    {
      part: 'b',
      fig: 'system',
      title: 'Se på vogna og loddet som ett system',
      body: (
        <>
          <p>
            Vogna og loddet henger sammen i en snor som ikke strekkes, så de får like stor akselerasjon. Vi velger positiv retning
            langs snora: mot høyre for vogna og nedover for loddet.
          </p>
          <p>
            Snora drar vogna fremover og loddet oppover, altså bakover langs snora, med like stor kraft. For hele systemet er S en
            indre kraft, og de to S-ene faller bort. G<Sub>1</Sub> og N opphever hverandre. Igjen står bare G<Sub>2</Sub>, som drar hele systemet
            fremover.
          </p>
        </>
      ),
      math: [
        <>
          ΣF = G<Sub>2</Sub> = m<Sub>2</Sub>g = {kg(m2)} · 9,81 m/s² = {fmt(s.G2, 2)} N
        </>,
      ],
    },
    {
      part: 'b',
      fig: 'aks',
      title: 'Bruk Newtons 2. lov på systemet',
      body: (
        <p>
          Kraftsummen G<Sub>2</Sub> skal gi akselerasjon til både vogna og loddet, så vi deler på hele massen m<Sub>1</Sub> + m
          <Sub>2</Sub>.
        </p>
      ),
      math: [
        <>
          a = ΣF / (m<Sub>1</Sub> + m<Sub>2</Sub>) = m<Sub>2</Sub>g / (m<Sub>1</Sub> + m<Sub>2</Sub>)
        </>,
        <>
          a = {kg(m2)} · 9,81 m/s² / {kg(M)} = {fmt(s.a, 2)} m/s²
        </>,
      ],
      answer: (
        <>
          a = {fmt(s.a, 2)} m/s² ≈ {fmt(s.a, 1)} m/s²
        </>
      ),
      tip: (
        <>
          Brøken m<Sub>2</Sub>/(m<Sub>1</Sub> + m<Sub>2</Sub>) er alltid mindre enn 1, så a er mindre enn g. Loddet faller saktere
          enn i fritt fall, fordi det må dra vogna med seg.
        </>
      ),
      pitfall: (
        <>
          Del på hele massen som akselererer, m<Sub>1</Sub> + m<Sub>2</Sub>. Deler du bare på m<Sub>2</Sub>, får du a = g, som om
          vogna ikke fantes.
        </>
      ),
    },
    {
      part: 'c',
      fig: 'S-vogn',
      title: 'Bruk Newtons 2. lov på vogna alene',
      body: (
        <p>
          Nå er systemet bare vogna. Da er S en ytre kraft, og den eneste vannrette kraften på vogna. Den gir vogna akselerasjonen a
          fra b).
        </p>
      ),
      math: [
        <>
          S = m<Sub>1</Sub>a = {kg(m1)} · {fmt(s.a, 2)} m/s² = {fmt(s.S, 2)} N
        </>,
      ],
    },
    {
      part: 'c',
      fig: 'S-lodd',
      title: (
        <>
          Kontroller med loddet, og forklar hvorfor S er mindre enn G<Sub>2</Sub>
        </>
      ),
      body: (
        <>
          <p>
            For loddet er positiv retning nedover. G<Sub>2</Sub> virker nedover og S oppover, så kraftsummen er G<Sub>2</Sub> − S.
          </p>
          <p>
            Hvis S var like stor som G<Sub>2</Sub>, ville kraftsummen på loddet vært null. Da ville loddet hengt i ro eller falt
            med konstant fart (Newtons 1. lov). Men loddet akselererer nedover, og da må G<Sub>2</Sub> være større enn S.
          </p>
        </>
      ),
      math: [
        <>
          G<Sub>2</Sub> − S = m<Sub>2</Sub>a ⇒ S = m<Sub>2</Sub>(g − a)
        </>,
        <>
          S = {kg(m2)} · (9,81 − {fmt(s.a, 2)}) m/s² = {fmt(s.S, 2)} N
        </>,
      ],
      answer: (
        <>
          S = {approx(s.S, 2, 'N')}. Det er mindre enn G<Sub>2</Sub> = {fmt(s.G2, 2)} N, fordi loddet akselererer nedover:
          kraftsummen G<Sub>2</Sub> − S = {fmt(s.netLodd, 2)} N gir loddet akselerasjonen a.
        </>
      ),
      tip: (
        <>
          Med symboler er S = G<Sub>2</Sub> · m<Sub>1</Sub>/(m<Sub>1</Sub> + m<Sub>2</Sub>) = {fmt(s.ratioS, 2)} · G<Sub>2</Sub>. Jo
          tyngre vogna er, jo nærmere kommer S tyngden til loddet.
        </>
      ),
      pitfall: (
        <>
          S = G<Sub>2</Sub> = m<Sub>2</Sub>g gjelder bare når loddet henger i ro eller har konstant fart. Når loddet akselererer, er
          snordraget mindre.
        </>
      ),
    },
    {
      part: 'd',
      fig: 'fart',
      title: 'Velg en bevegelseslikning uten tid',
      body: (
        <p>
          Snora strekkes ikke, så vogna ruller like langt som loddet faller: s = h = {fmt(h, 2)} m. Akselerasjonen er konstant, og vogna
          starter i ro (v<Sub>0</Sub> = 0). Vi kjenner ikke tiden, så den tidløse likningen passer.
        </p>
      ),
      math: [
        <>
          v² − v<Sub>0</Sub>² = 2as ⇒ v = √(2as)
        </>,
        <>
          v = √(2 · {fmt(s.a, 2)} m/s² · {fmt(h, 2)} m) = {fmt(s.v, 2)} m/s
        </>,
      ],
      answer: <>v = {sig2(s.v)} m/s</>,
      tip: (
        <>
          Når loddet har landet, blir snora slakk. Da virker ingen vannrett kraft på vogna, og den ruller videre med konstant fart{' '}
          {sig2(s.v)} m/s (Newtons 1. lov).
        </>
      ),
      pitfall: (
        <>
          Bruk akselerasjonen fra b), ikke g. Loddet faller ikke fritt, så v = √(2gh) = {fmt(Math.sqrt(2 * 9.81 * h), 2)} m/s blir for
          stort.
        </>
      ),
    },
    {
      part: 'e',
      fig: 'friksjon',
      title: 'Finn friksjonen på klossen',
      body: (
        <p>
          Klossen påvirkes av de samme kreftene som vogna, og i tillegg av friksjonen R fra bordet. Klossen glir mot høyre, så R
          virker mot venstre. Bordet er fortsatt vannrett, så N = G<Sub>1</Sub>.
        </p>
      ),
      math: [
        <>
          R = μ<Sub>k</Sub>N = μ<Sub>k</Sub>m<Sub>1</Sub>g = {fmt(muK, 2)} · {kg(m1)} · 9,81 m/s² = {fmt(s.R, 3)} N
        </>,
      ],
      pitfall: (
        <>
          Normalkraften på klossen er G<Sub>1</Sub> = m<Sub>1</Sub>g, ikke (m<Sub>1</Sub> + m<Sub>2</Sub>)g. Loddet henger i snora og
          trykker ikke på bordet.
        </>
      ),
    },
    {
      part: 'e',
      fig: 'aks-friksjon',
      title: 'Bruk Newtons 2. lov på systemet igjen',
      body: (
        <p>
          Langs snora virker nå G<Sub>2</Sub> fremover og R bakover. S er fortsatt en indre kraft som faller bort.
        </p>
      ),
      math: [
        <>
          ΣF = G<Sub>2</Sub> − R
        </>,
        <>
          a = ΣF / (m<Sub>1</Sub> + m<Sub>2</Sub>) = ({fmt(s.G2, 3)} N − {fmt(s.R, 3)} N) / {kg(M)} = {fmt(s.aF, 2)} m/s²
        </>,
      ],
      tip: (
        <>
          Med symboler blir a = (m<Sub>2</Sub> − μ<Sub>k</Sub>m<Sub>1</Sub>)g / (m<Sub>1</Sub> + m<Sub>2</Sub>). Med μ<Sub>k</Sub> = 0
          får du svaret fra b) igjen.
        </>
      ),
    },
    {
      part: 'e',
      fig: 'S-friksjon',
      title: 'Finn det nye snordraget og sammenlign',
      body: (
        <p>
          Vi bruker loddet, der friksjonen ikke er med. Loddet akselererer mindre enn før, så kraftsummen G<Sub>2</Sub> − S på loddet
          må være mindre. Da må S være nærmere G<Sub>2</Sub>: snordraget øker.
        </p>
      ),
      math: [
        <>
          S = m<Sub>2</Sub>(g − a) = {kg(m2)} · (9,81 − {fmt(s.aF, 2)}) m/s² = {fmt(s.SF, 2)} N
        </>,
        <>
          Kontroll med klossen: S − R = m<Sub>1</Sub>a ⇒ S = {kg(m1)} · {fmt(s.aF, 2)} m/s² + {fmt(s.R, 3)} N = {fmt(s.SF, 2)} N
        </>,
      ],
      answer: (
        <>
          Akselerasjonen blir mindre: a = {approx(s.aF, 2, 'm/s²')} (før {sig2(s.a)} m/s²). Snordraget blir større: S ={' '}
          {approx(s.SF, 2, 'N')} (før {sig2(s.S)} N).
        </>
      ),
      tip: (
        <>
          Farten når loddet treffer gulvet blir også mindre: v = √(2 · {fmt(s.aF, 2)} m/s² · {fmt(h, 2)} m) = {fmt(s.vF, 2)} m/s (før{' '}
          {fmt(s.v, 2)} m/s).
        </>
      ),
      pitfall: (
        <>
          Mange tror at snordraget blir mindre når det går tregere. Det er omvendt: for loddet er S = m<Sub>2</Sub>(g − a), så
          mindre akselerasjon gir større S. Står klossen helt i ro (a = 0), er S lik G<Sub>2</Sub>.
        </>
      ),
    },
  ];

  const cart =
    bars === 0
      ? `I fysikklaben står en dynamikkvogn med massen ${kg(m1)} på et vannrett bord.`
      : `I fysikklaben står en dynamikkvogn med ${BARS[bars] ?? 'ekstralodd'} oppå på et vannrett bord. Vogna og ${
          bars === 1 ? 'ekstraloddet' : 'ekstraloddene'
        } har til sammen massen ${kg(m1)}.`;

  return (
    <WorkedExample
      variants={{ labels: ['Tallsett 1', 'Tallsett 2', 'Tallsett 3'], value: variant, onChange: setVariant }}
      intro={
        <p>
          {cart} En lett snor er festet foran på vogna og går over en trinse på bordkanten ned til et lodd med massen {kg(m2)}. Vogna
          slippes fra ro mens loddet henger {fmt(h, 2)} m over gulvet. Se bort fra luftmotstand og friksjon, også i trinsa, og regn
          snora og trinsa som masseløse.
        </p>
      }
      given={[
        <>
          m<Sub>1</Sub> = {kg(m1)}
        </>,
        <>
          m<Sub>2</Sub> = {kg(m2)}
        </>,
        <>h = {fmt(h, 2)} m</>,
        <>
          μ<Sub>k</Sub> = {fmt(muK, 2)} (i e)
        </>,
      ]}
      parts={[
        { id: 'a', text: 'Tegn kreftene som virker på vogna og på loddet mens de er i bevegelse.' },
        { id: 'b', text: `Vis at akselerasjonen til vogna er ${fmt(s.a, 1)} m/s².` },
        { id: 'c', text: 'Bestem snordraget. Forklar hvorfor snordraget er mindre enn tyngden til loddet.' },
        { id: 'd', text: 'Hvor stor fart har vogna når loddet treffer gulvet?' },
        {
          id: 'e',
          text: (
            <>
              Vogna byttes med en trekloss med samme masse. Klossen glir når den slippes, og glidefriksjonstallet mellom klossen og
              bordet er {fmt(muK, 2)}. Hvordan endres akselerasjonen og snordraget? Regn ut de nye verdiene.
            </>
          ),
        },
      ]}
      steps={steps}
      figure={(state) => {
        const fig: TrinseFig = state.showAll ? 'alle' : state.step === 0 ? 'oppgave' : (steps[state.step - 1]?.fig ?? 'oppgave');
        return <TrinseFigure task={task} s={s} fig={fig} />;
      }}
    />
  );
}
