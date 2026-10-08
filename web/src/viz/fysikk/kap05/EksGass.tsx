import { useState, type ReactNode } from 'react';
import { Sub, Sup, WorkedExample, fmt, fmtSci, type ExampleStep } from '../../kit';
import { GassFigur } from './eks-gass-figur';
import { GAS_TASKS, PISTON_AREA, R_GAS, ZERO_CELSIUS, solveGasTask } from './model-eks-gass';

/**
 * Eksempeloppgave (5A, 5B, 5E): luft i en glassylinder med et låst stempel står i et vannbad som varmes opp. Eleven
 * finner stoffmengden og trykket med tilstandslikningen (i kelvin), kraften på splinten som låser stempelet, endringen
 * i indre energi med termofysikkens første lov (ΔU = W + Q, med fortegn) og volumet når stempelet har stoppet.
 * Oppgaven er laget for appen (egen tekst og egne tall) i samme stil som eksamensoppgaver.
 *
 * Alle tall i teksten, utregningen, svarene og figuren kommer fra solveGasTask (model-eks-gass.ts), så de stemmer
 * med hverandre i alle tallsettene.
 */
export default function EksGass() {
  const [variant, setVariant] = useState(0);
  const task = GAS_TASKS[variant] ?? GAS_TASKS[0]!;
  const s = solveGasTask(task);
  const { V1, t1, t2 } = task;

  /** Lufttrykket med tre gjeldende siffer: 101, 99,0, 102 kPa. */
  const p0kPa = `${fmt(task.p0, task.p0 >= 100 ? 0 : 1)} kPa`;
  const C = (t: number, d = 0) => `${fmt(t, d)} °C`;
  const K = (T: number, d = 2) => `${fmt(T, d)} K`;
  const L = (v: number) => `${fmt(v, 2)} L`;
  const J = (v: number) => `${fmt(v, 0)} J`;
  const N = (v: number) => `${fmt(v, 0)} N`;
  const Pa = (v: number, d = 2) => `${fmtSci(v, d)} Pa`;
  const m3 = (v: number) => (
    <>
      {fmtSci(v, 2)} m<Sup>3</Sup>
    </>
  );
  const area = (
    <>
      {fmt(PISTON_AREA * 100, 2)} · 10<Sup>−2</Sup> m<Sup>2</Sup>
    </>
  );
  const Ru = `${fmt(R_GAS, 2)} J/(mol·K)`;
  const mol = (v: number) => `${fmt(v, 4)} mol`;
  const boils = t2 >= 99.5;
  const kokTekst = boils ? `til vannet koker ved ${C(t2)}` : `til ${C(t2)}`;
  const zero = fmt(ZERO_CELSIUS, 2);

  const sub = (a: string, b: string): ReactNode => (
    <>
      {a}
      <Sub>{b}</Sub>
    </>
  );
  const sym = {
    p0: sub('p', '0'),
    p1: sub('p', '1'),
    p2: sub('p', '2'),
    p3: sub('p', '3'),
    V1: sub('V', '1'),
    V3: sub('V', '3'),
    T1: sub('T', '1'),
    T2: sub('T', '2'),
    T3: sub('T', '3'),
    t1: sub('t', '1'),
    t2: sub('t', '2'),
    Fin: sub('F', 'inne'),
    Fut: sub('F', 'ute'),
    Fs: sub('F', 's'),
  };

  const steps: ExampleStep[] = [
    {
      part: 'a',
      title: 'Skriv tallene i SI-enheter',
      body: (
        <p>
          Vi bruker tilstandslikningen for en ideell gass, pV = nRT. Den gjelder bare med absolutt temperatur, altså i kelvin. Med R ={' '}
          {Ru} må også trykket være i pascal og volumet i kubikkmeter.
        </p>
      ),
      math: [
        <>
          {sym.T1} = ({fmt(t1, 0)} + {zero}) K = {K(s.T1)}
        </>,
        <>
          {sym.V1} = {L(V1)} = {m3(s.V1)}
        </>,
        <>
          {sym.p1} = {p0kPa} = {Pa(s.p0)}
        </>,
      ],
      tip: (
        <>
          1 L = 1 dm<Sup>3</Sup> = 10<Sup>−3</Sup> m<Sup>3</Sup> og 1 kPa = 10<Sup>3</Sup> Pa.
        </>
      ),
      pitfall: (
        <>
          Setter du inn {fmt(t1, 0)} i stedet for {fmt(s.T1, 2)} for temperaturen, blir n = {fmt(s.nCelsius, 2)} mol, {fmt(s.nCelsius / s.n, 0)} ganger for
          mye. Tilstandslikningen gjelder bare med temperaturen i kelvin.
        </>
      ),
    },
    {
      part: 'a',
      title: 'Løs tilstandslikningen for n',
      body: <p>Vi deler begge sider av pV = nRT med RT.</p>,
      math: [
        <>
          n = {sym.p1}
          {sym.V1} / (R{sym.T1})
        </>,
        <>
          n = {Pa(s.p0)} · {m3(s.V1)} / ({Ru} · {K(s.T1)}) = {mol(s.n)}
        </>,
      ],
      answer: (
        <>
          n = {mol(s.n)} = {fmt(s.n * 100, 2)} · 10<Sup>−2</Sup> mol
        </>
      ),
      tip: (
        <>
          Sjekk enhetene: Pa · m<Sup>3</Sup> = (N/m<Sup>2</Sup>) · m<Sup>3</Sup> = N · m = J. Da blir J / (J/(mol·K) · K) = mol.
        </>
      ),
    },
    {
      part: 'b',
      title: 'Hva er konstant?',
      body: (
        <p>
          Sylinderen er tett, så stoffmengden n endrer seg ikke. Splinten holder stempelet fast, så volumet er også det samme. Da er nR/V
          konstant, og tilstandslikningen sier at trykket er proporsjonalt med den absolutte temperaturen.
        </p>
      ),
      math: [
        <>p = nRT / V ⇒ p / T = nR / V = konstant</>,
        <>
          {sym.p2} / {sym.T2} = {sym.p1} / {sym.T1} ⇒ {sym.p2} = {sym.p1} · {sym.T2} / {sym.T1}
        </>,
      ],
    },
    {
      part: 'b',
      title: 'Regn ut trykket',
      body: <p>Vi gjør om {C(t2)} til kelvin og setter inn. Her trenger vi ikke SI-enheter for trykket: kPa på begge sider går fint.</p>,
      math: [
        <>
          {sym.T2} = ({fmt(t2, 0)} + {zero}) K = {K(s.T2)}
        </>,
        <>
          {sym.p2} = {p0kPa} · {K(s.T2)} / {K(s.T1)} = {fmt(s.p2 / 1000, 1)} kPa
        </>,
      ],
      answer: (
        <>
          {sym.p2} = {fmt(s.p2 / 1000, 1)} kPa ≈ {fmt(s.p2Shown, 0)} kPa
        </>
      ),
      tip: (
        <>
          Kontroll med stoffmengden fra a): {sym.p2} = nR{sym.T2} / {sym.V1} = {mol(s.n)} · {Ru} · {K(s.T2)} / {m3(s.V1)} ={' '}
          {fmt((s.n * R_GAS * s.T2) / s.V1 / 1000, 1)} kPa.
        </>
      ),
      pitfall: (
        <>
          Med celsius får du {sym.p2} = {p0kPa} · {fmt(t2, 0)} / {fmt(t1, 0)} = {fmt(s.p2Celsius / 1000, 0)} kPa. Men den absolutte temperaturen
          øker bare med {fmt((s.T2 / s.T1 - 1) * 100, 0)} %, fra {K(s.T1, 0)} til {K(s.T2, 0)}, og det gjør trykket også.
        </>
      ),
    },
    {
      part: 'c',
      title: 'Kreftene fra lufta på hver side av stempelet',
      body: (
        <p>
          Trykk er kraft per areal, p = F/A, så F = pA. Lufta inni sylinderen presser stempelet oppover med kraften {sym.Fin}, og lufta
          utenfor presser det nedover med {sym.Fut}. Begge virker på hele arealet A.
        </p>
      ),
      math: [
        <>
          {sym.Fin} = {sym.p2}A = {Pa(s.p2, 3)} · {area} = {N(s.Fgas2)}
        </>,
        <>
          {sym.Fut} = {sym.p0}A = {Pa(s.p0)} · {area} = {N(s.Fair)}
        </>,
      ],
    },
    {
      part: 'c',
      title: 'Summen av kreftene er null',
      body: (
        <p>
          Stempelet står i ro, så etter Newtons første lov er summen av kreftene på det null. Kraften fra lufta inni er størst, så splinten
          må presse stempelet nedover med en kraft {sym.Fs}. Tyngden av stempelet ser vi bort fra.
        </p>
      ),
      math: [
        <>
          ΣF = 0: {sym.Fin} − {sym.Fut} − {sym.Fs} = 0
        </>,
        <>
          {sym.Fs} = {sym.Fin} − {sym.Fut} = {N(s.Fgas2)} − {N(s.Fair)} = {N(s.Fpin)}
        </>,
      ],
      answer: (
        <>
          Splinten presser på stempelet med {sym.Fs} = {N(s.Fpin)} ≈ {fmt(s.Fpin / 100, 1)} · 10<Sup>2</Sup> N, rettet nedover.
        </>
      ),
      pitfall: (
        <>
          Splinten må ikke holde igjen hele kraften fra lufta inni ({N(s.Fgas2)}). Lufta utenfor presser også på stempelet, så det er bare
          trykkforskjellen som teller: {sym.Fs} = ({sym.p2} − {sym.p0})A.
        </>
      ),
    },
    {
      part: 'd',
      title: 'Oppvarmingen: stempelet står fast',
      body: (
        <>
          <p>
            Termofysikkens første lov er ΔU = W + Q. Her er W arbeidet som blir gjort på lufta, og Q varmen som blir tilført lufta. Begge er
            positive når energien går inn i lufta.
          </p>
          <p>
            Arbeid krever at en kraft virker langs en strekning. Under oppvarmingen er stempelet låst og flytter seg ikke, så det blir ikke gjort
            noe arbeid, selv om trykket øker. All varmen går til indre energi.
          </p>
        </>
      ),
      math: [
        <>W = 0 (stempelet står stille)</>,
        <>
          ΔU = W + Q = 0 + {J(s.Qheat)} = {J(s.dUheat)}
        </>,
      ],
      pitfall: <>Trykket øker, men lufta gjør ikke arbeid på stempelet før det flytter seg. Høyt trykk alene er ikke arbeid.</>,
    },
    {
      part: 'd',
      title: 'Utvidelsen: fortegn på W og Q',
      body: (
        <p>
          Nå skyver lufta stempelet og lufta over det oppover. Lufta gjør et arbeid på {J(s.Wout)}, så den energien går ut av lufta: arbeidet
          på lufta er negativt. Varmen fra vannbadet går inn i lufta, så Q er positiv.
        </p>
      ),
      math: [
        <>W = −{J(s.Wout)} (lufta gjør arbeid, energi ut)</>,
        <>Q = +{J(s.Qexp)} (lufta får varme, energi inn)</>,
      ],
      pitfall: (
        <>
          Med W = +{J(s.Wout)} får du ΔU = +{J(s.Wout + s.Qexp)} og feil konklusjon: at lufta blir varmere. Spør alltid om energien går inn i lufta
          eller ut av den.
        </>
      ),
    },
    {
      part: 'd',
      title: 'Regn ut endringen i indre energi',
      body: (
        <p>
          Den indre energien i lufta er først og fremst den kinetiske energien til partiklene. Lufta gjør mer arbeid enn den får varme, og
          resten av energien tas fra den indre energien. Partiklene beveger seg da langsommere i gjennomsnitt, og temperaturen synker.
        </p>
      ),
      math: [
        <>
          ΔU = W + Q = −{J(s.Wout)} + {J(s.Qexp)} = {s.dUexp < 0 ? '−' : '+'}
          {J(Math.abs(s.dUexp))}
        </>,
      ],
      answer: (
        <>
          Under oppvarmingen øker den indre energien med {J(s.dUheat)}. Under utvidelsen {s.dUexp < 0 ? 'minker' : 'øker'} den med{' '}
          {J(Math.abs(s.dUexp))}, så lufta blir {s.dUexp < 0 ? 'kaldere, selv om den får varme' : 'varmere'}.
        </>
      ),
      tip: <>Det motsatte skjer i en sykkelpumpe: når du presser lufta raskt sammen, gjør du arbeid på den (W &gt; 0), og pumpa blir varm.</>,
    },
    {
      part: 'e',
      title: 'Kreftene på stempelet uten splint',
      body: (
        <p>
          Når stempelet har stoppet, er det i ro igjen. Nå virker bare to krefter på det: {sym.Fin} = {sym.p3}A oppover og {sym.Fut} ={' '}
          {sym.p0}A nedover. Etter Newtons første lov er de like store.
        </p>
      ),
      math: [
        <>
          ΣF = 0: {sym.p3}A − {sym.p0}A = 0
        </>,
        <>
          {sym.p3} = {sym.p0} = {p0kPa}
        </>,
      ],
      tip: <>Arealet forkorter seg bort. Et lett stempel uten friksjon stopper alltid der trykket inni er like stort som trykket utenfor.</>,
    },
    {
      part: 'e',
      title: 'Finn volumet med tilstandslikningen',
      body: <p>Det er den samme lufta, så n = {mol(s.n)} fra a). Nå kjenner vi både trykket og temperaturen.</p>,
      math: [
        <>
          {sym.T3} = ({fmt(s.t3, 1)} + {zero}) K = {K(s.T3)}
        </>,
        <>
          {sym.V3} = nR{sym.T3} / {sym.p3} = {mol(s.n)} · {Ru} · {K(s.T3)} / {Pa(s.p3)} = {m3(s.V3)}
        </>,
      ],
      answer: (
        <>
          Trykket er {p0kPa}, det samme som lufttrykket, fordi kreftene på stempelet må være like store. Volumet er {sym.V3} = {L(s.V3 * 1000)}.
        </>
      ),
      tip: (
        <>
          Uten n: {sym.p2}
          {sym.V1}/{sym.T2} = {sym.p3}
          {sym.V3}/{sym.T3} gir {sym.V3} = {sym.V1} · ({sym.p2}/{sym.p3}) · ({sym.T3}/{sym.T2}) = {L(V1)} · ({fmt(s.p2 / 1000, 1)}/
          {fmt(s.p3 / 1000, task.p0 >= 100 ? 0 : 1)}) · ({fmt(s.T3, 2)}/{fmt(s.T2, 2)}) = {L(((V1 * s.p2) / s.p3) * (s.T3 / s.T2))}.
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
            I et forsøk står en glassylinder med et tett stempel i et vannbad på en kokeplate. Stempelet har arealet {area}, glir uten friksjon
            og er så lett at vi ser bort fra tyngden. Et manometer viser det absolutte trykket i lufta i sylinderen, og et termometer viser
            temperaturen.
          </p>
          <p>
            Til å begynne med holder vannbadet romtemperatur, {C(t1)}. Det er {L(V1)} luft i sylinderen, og trykket er det samme som
            lufttrykket utenfor, {p0kPa}. En splint gjennom sylinderveggen like over stempelet hindrer det i å gli oppover. Så slås kokeplata
            på, og vannbadet varmes opp {kokTekst}. Lufta i sylinderen får samme temperatur som vannet.
          </p>
        </>
      }
      given={[
        <>
          {sym.V1} = {L(V1)}
        </>,
        <>
          {sym.t1} = {C(t1)}
        </>,
        <>
          {sym.p1} = {sym.p0} = {p0kPa}
        </>,
        <>
          {sym.t2} = {C(t2)}
        </>,
        <>A = {area}</>,
        <>R = {Ru}</>,
      ]}
      parts={[
        { id: 'a', text: 'Bestem stoffmengden av luft i sylinderen.' },
        { id: 'b', text: <>Vis at trykket i lufta blir omtrent {fmt(s.p2Shown, 0)} kPa når vannbadet holder {C(t2)}.</> },
        { id: 'c', text: 'Hvor stor kraft virker det da på stempelet fra splinten?' },
        {
          id: 'd',
          text: (
            <>
              Under oppvarmingen fikk lufta {J(s.Qheat)} varme fra vannbadet. Så trekkes splinten ut. Lufta skyver stempelet raskt oppover og gjør
              et arbeid på {J(s.Wout)}, mens den får {J(s.Qexp)} varme fra vannbadet. Bestem endringen i den indre energien til lufta under
              oppvarmingen og under utvidelsen. Blir lufta varmere eller kaldere når den utvider seg?
            </>
          ),
        },
        {
          id: 'e',
          text: (
            <>
              Rett etter at stempelet har stoppet, er temperaturen i lufta {C(s.t3, 1)}. Forklar hvorfor trykket i lufta nå er like stort som lufttrykket
              utenfor, og bestem volumet til lufta.
            </>
          ),
        },
      ]}
      steps={steps}
      figure={(state) => <GassFigur task={task} s={s} state={state} />}
    />
  );
}
