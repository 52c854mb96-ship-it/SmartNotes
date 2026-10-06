import { useState, type ReactNode } from 'react';
import { Sub, WorkedExample, fmt, type ExampleStep } from '../../kit';
import { TripGraphs, type TripView } from './eks-vt-graf-graf';
import { TripScene } from './eks-vt-graf-scene';
import { CITY_TRIP_TASKS, KMH_PER_MS, allMaxTimeText, fmtSig as sig, solveCityTrip, type CityTripSolution, type CityTripTask } from './model-eks-vt-graf';
import { useNarrow } from './useNarrow';

type Step = ExampleStep & { view: TripView };

/**
 * Eksempeloppgave (1B–1D): en bil kjører fra ett lyskryss til det neste i bytrafikk, og eleven får v-t-grafen.
 * Oppgaven er laget for appen (egen tekst og egne tall) i samme stil som eksamensoppgaver: lese av en graf,
 * akselerasjon som stigningstall, strekning som areal, gjennomsnittsfart og en kvalitativ s-t-graf.
 */
export default function EksVtGraf() {
  const [variant, setVariant] = useState(0);
  const task = CITY_TRIP_TASKS[variant] ?? CITY_TRIP_TASKS[0]!;
  const sol = solveCityTrip(task);
  const steps = buildSteps(task, sol);

  return (
    <WorkedExample
      variants={{ labels: ['Tallsett 1', 'Tallsett 2', 'Tallsett 3'], value: variant, onChange: setVariant }}
      intro={
        <>
          <p>
            En bil står i ro med fronten ved stopplinja i et lyskryss. Fartsgrensen i gata er {fmt(task.limitKmh, 0)} km/h. Når lyset blir
            grønt, kjører bilen rett fram til det neste lyskrysset. Der har lyset blitt rødt, og bilen stopper med fronten ved stopplinja.
          </p>
          <p>
            Grafen viser farten v til bilen som funksjon av tiden t, fra lyset blir grønt (t = 0) til bilen står stille igjen. Grafen
            består av tre rette linjestykker, del 1, 2 og 3.
          </p>
        </>
      }
      given={[
        <>
          v<Sub>0</Sub> = 0
        </>,
        <>fartsgrense: {fmt(task.limitKmh, 0)} km/h</>,
      ]}
      parts={[
        { id: 'a', text: 'Beskriv bevegelsen til bilen i hver av de tre delene. Holder bilen fartsgrensen?' },
        { id: 'b', text: 'Bestem akselerasjonen til bilen i hver av de tre delene.' },
        { id: 'c', text: `Vis at avstanden mellom de to stopplinjene er ${fmt(sol.s, 0)} m.` },
        { id: 'd', text: 'Bestem gjennomsnittsfarten for hele turen. Forklar hvorfor den er mindre enn den høyeste farten.' },
        { id: 'e', text: 'Skisser s-t-grafen for turen, og forklar formen på grafen i hver av de tre delene.' },
      ]}
      steps={steps}
      figure={(state) => {
        const view: TripView = state.showAll ? 'alle' : state.step === 0 ? 'oppgave' : (steps[state.step - 1]?.view ?? 'oppgave');
        return <TripFigures task={task} sol={sol} view={view} />;
      }}
    />
  );
}

function TripFigures({ task, sol, view }: { task: CityTripTask; sol: CityTripSolution; view: TripView }) {
  const { ref, narrow } = useNarrow<HTMLDivElement>();
  return (
    <div ref={ref} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <TripScene task={task} sol={sol} view={view} narrow={narrow} />
      <TripGraphs task={task} sol={sol} view={view} narrow={narrow} />
    </div>
  );
}

/* ---------- Løsningen ---------- */

function buildSteps(task: CityTripTask, sol: CityTripSolution): Step[] {
  const { vMax, t1, t2, t3, limitKmh } = task;
  const [p1, p2, p3] = sol.phases;
  const v = `${sig(vMax)} m/s`;
  const ts = (t: number) => `${sig(t)} s`;
  const m = (x: number) => `${fmt(x, 0)} m`;
  const acc = (a: number) => `${fmt(a, 1)} m/s²`;
  const vAvg3 = sig(sol.vAvg, 3);
  const vAvg2 = sig(sol.vAvg, 2);
  const avgRounded = Math.abs(Number(sol.vAvg.toPrecision(2)) - sol.vAvg) > 1e-9;
  const allMax = allMaxTimeText(task, sol.tAllMax);

  const limitAnswer: ReactNode = sol.withinLimit ? (
    <>
      Den høyeste farten er {v} = {sig(sol.vMaxKmh)} km/h, så bilen holder fartsgrensen på {fmt(limitKmh, 0)} km/h.
    </>
  ) : (
    <>
      Den høyeste farten er {v} = {sig(sol.vMaxKmh)} km/h. Det er {fmt(sol.overLimitKmh, 0)} km/h over fartsgrensen på {fmt(limitKmh, 0)} km/h,
      så bilen kjører for fort i del 2.
    </>
  );

  return [
    /* ---------- a) ---------- */
    {
      part: 'a',
      view: 'les',
      title: 'Les av grafen del for del',
      body: (
        <>
          <p>
            Grafen består av tre rette linjestykker. Stigningstallet til en v-t-graf er akselerasjonen, så et rett linjestykke betyr at
            akselerasjonen er konstant i den delen.
          </p>
          <p>
            <strong>Del 1</strong> (0–{ts(t1)}): grafen stiger jevnt fra 0 til {v}. Farten øker like mye hvert sekund, så bilen
            akselererer jevnt fra ro ved stopplinja.
          </p>
          <p>
            <strong>Del 2</strong> ({ts(t1)}–{ts(t2)}): grafen er vannrett. Bilen kjører med konstant fart {v}.
          </p>
          <p>
            <strong>Del 3</strong> ({ts(t2)}–{ts(t3)}): grafen synker jevnt til 0. Bilen bremser jevnt og står stille ved t = {ts(t3)}.
          </p>
        </>
      ),
      math: [
        <>
          v<Sub>maks</Sub> = {v} = {sig(vMax)} · {fmt(KMH_PER_MS, 1)} km/h = {fmt(sol.vMaxKmh, 1)} km/h
        </>,
      ],
      answer: (
        <>
          Bilen akselererer jevnt fra ro til {v}, kjører med konstant fart og bremser jevnt til den står stille. {limitAnswer}
        </>
      ),
      tip: 'Fra m/s til km/h ganger du med 3,6: 1 m/s er 3 600 m på en time, altså 3,6 km/h.',
      pitfall:
        'En vannrett linje i en v-t-graf betyr konstant fart, ikke at bilen står stille. Bilen står stille bare der grafen ligger på t-aksen (v = 0).',
    },

    /* ---------- b) ---------- */
    {
      part: 'b',
      view: 'a1',
      title: 'Akselerasjonen er stigningstallet til v-t-grafen',
      body: (
        <>
          <p>
            Akselerasjonen er hvor mye farten endrer seg per sekund, a = Δv/Δt. I en v-t-graf er det stigningstallet. Hver del er et rett
            linjestykke, så vi kan bruke endepunktene og lage en stigningstrekant (se figuren).
          </p>
          <p>
            I del 1 øker farten fra 0 til {v} mens tiden går fra 0 til {ts(t1)}.
          </p>
        </>
      ),
      math: [
        <>
          a<Sub>1</Sub> = Δv / Δt = ({v} − 0 m/s) / ({ts(t1)} − 0 s) = {acc(p1.a)}
        </>,
      ],
      tip: 'Bruk punkter der grafen krysser rutelinjene, så blir avlesningen nøyaktig. Her ligger alle hjørnene i grafen på rutelinjer.',
    },
    {
      part: 'b',
      view: 'a23',
      title: 'Akselerasjonen i del 2 og del 3',
      body: (
        <>
          <p>
            I del 2 er grafen vannrett. Farten endrer seg ikke, så Δv = 0 og akselerasjonen er null.
          </p>
          <p>
            I del 3 avtar farten fra {v} til 0. Da er Δv negativ, og akselerasjonen blir negativ: den peker motsatt vei av farten, og
            bilen bremser (se pilene i scenen).
          </p>
        </>
      ),
      math: [
        <>
          a<Sub>2</Sub> = Δv / Δt = 0 m/s / {ts(p2.dt)} = 0
        </>,
        <>
          a<Sub>3</Sub> = Δv / Δt = (0 m/s − {v}) / ({ts(t3)} − {ts(t2)}) = {fmt(p3.dv, 0)} m/s / {ts(p3.dt)} = {acc(p3.a)}
        </>,
      ],
      answer: (
        <>
          a<Sub>1</Sub> = {acc(p1.a)}, a<Sub>2</Sub> = 0 og a<Sub>3</Sub> = {acc(p3.a)}.
        </>
      ),
      pitfall: (
        <>
          Husk fortegnet. Δv = v − v<Sub>0</Sub> er sluttfarten minus startfarten, så når farten avtar, blir akselerasjonen negativ. Svarer
          du {acc(-p3.a)} i del 3, må du i alle fall skrive at bilen bremser.
        </>
      ),
    },

    /* ---------- c) ---------- */
    {
      part: 'c',
      view: 'areal',
      title: 'Strekningen er arealet under v-t-grafen',
      body: (
        <>
          <p>
            Med konstant fart er strekningen s = v · t. I v-t-grafen er det arealet av et rektangel med høyden v og bredden t.
          </p>
          <p>
            Når farten endrer seg, deler vi tiden i korte biter der farten nesten er konstant. I figuren er bitene ett sekund lange.
            Hver stolpe har arealet v · Δt, som er strekningen bilen kjører det sekundet. Summen av stolpene er arealet under grafen,
            og jo kortere bitene er, jo bedre stemmer det. Strekningen er altså arealet mellom grafen og t-aksen, også når farten
            endrer seg.
          </p>
        </>
      ),
      tip: 'Enhetene stemmer: arealet har enheten (m/s) · s = m, som en strekning.',
    },
    {
      part: 'c',
      view: 'deler',
      title: 'Del arealet i to trekanter og et rektangel',
      body: (
        <p>
          Arealet under grafen er en trekant i del 1, et rektangel i del 2 og en trekant i del 3. Vi regner ut hver del og legger sammen.
          Bilen starter og stopper med fronten ved stopplinjene, så hele strekningen er avstanden mellom dem.
        </p>
      ),
      math: [
        <>
          s<Sub>1</Sub> = ½ · {ts(p1.dt)} · {v} = {m(p1.s)}
        </>,
        <>
          s<Sub>2</Sub> = {ts(p2.dt)} · {v} = {m(p2.s)}
        </>,
        <>
          s<Sub>3</Sub> = ½ · {ts(p3.dt)} · {v} = {m(p3.s)}
        </>,
        <>
          s = s<Sub>1</Sub> + s<Sub>2</Sub> + s<Sub>3</Sub> = {m(p1.s)} + {m(p2.s)} + {m(p3.s)} = {m(sol.s)}
        </>,
      ],
      answer: (
        <>
          s = {m(sol.s)}, som er avstanden mellom stopplinjene. Bilen begynner å bremse {m(p3.s)} før stopplinja i lyskryss 2.
        </>
      ),
      tip: (
        <>
          Hele arealet er et trapes: s = ½ · ({ts(t3)} + {ts(p2.dt)}) · {v} = {m(sol.s)}. Del 1 kan du også kontrollere med s = ½at² = ½ ·{' '}
          {acc(p1.a)} · ({ts(t1)})² = {m(p1.s)}.
        </>
      ),
      pitfall: (
        <>
          Ikke regn s = v<Sub>maks</Sub> · t for hele turen: {v} · {ts(t3)} = {m(sol.sAllMax)} blir for mye, fordi bilen kjører saktere enn{' '}
          {v} mens den akselererer og bremser.
        </>
      ),
    },

    /* ---------- d) ---------- */
    {
      part: 'd',
      view: 'snitt',
      title: 'Gjennomsnittsfarten er hele strekningen delt på hele tiden',
      body: (
        <p>
          Gjennomsnittsfarten er den konstante farten som ville gitt samme strekning på samme tid. I grafen er det høyden på et rektangel
          fra 0 til {ts(t3)} med samme areal som arealet under grafen (den stiplede linja).
        </p>
      ),
      math: [
        <>
          v<Sub>snitt</Sub> = s / t = {m(sol.s)} / {ts(t3)} = {vAvg3} m/s{avgRounded ? ` ≈ ${vAvg2} m/s` : ''}
        </>,
        <>
          {vAvg3} m/s · {fmt(KMH_PER_MS, 1)} = {sig(sol.vAvgKmh)} km/h
        </>,
      ],
      pitfall: (
        <>
          Gjennomsnittsfarten er ikke gjennomsnittet av fartene i de tre delene, ({sig(p1.vAvg)} + {sig(p2.vAvg)} + {sig(p3.vAvg)}) m/s / 3 ={' '}
          {sig(sol.meanOfPhaseSpeeds)} m/s. Delene varer ikke like lenge: bilen kjører med {v} i {fmt(p2.dt, 0)} av de {fmt(t3, 0)} sekundene.
        </>
      ),
    },
    {
      part: 'd',
      view: 'hvorfor',
      title: `Hvorfor er gjennomsnittsfarten mindre enn ${v}?`,
      body: (
        <>
          <p>
            Bilen kjører med {v} bare i del 2. Mens den akselererer og bremser, kjører den saktere, i snitt bare {sig(p1.vAvg)} m/s.
          </p>
          <p>
            Med {v} hele tiden ville bilen kjørt lenger på samme tid. De skraverte trekantene i grafen er strekningen bilen «taper» på å
            starte og stoppe.
          </p>
        </>
      ),
      math: [
        <>
          v<Sub>maks</Sub> · t = {v} · {ts(t3)} = {m(sol.sAllMax)}
        </>,
        <>
          {m(sol.sAllMax)} − {m(sol.s)} = {m(sol.sMissing)}
        </>,
      ],
      answer: (
        <>
          v<Sub>snitt</Sub> = {vAvg2} m/s ({sig(sol.vAvgKmh)} km/h). Den er mindre enn {v} fordi bilen kjører saktere enn {v} mens den
          akselererer i del 1 og bremser i del 3.
        </>
      ),
      tip: (
        <>
          Med {v} hele veien ville turen tatt {m(sol.s)} / {v} = {allMax.tAll} s, altså {allMax.saved} s mindre enn {allMax.t3} s.
        </>
      ),
    },

    /* ---------- e) ---------- */
    {
      part: 'e',
      view: 'st1',
      title: 'Stigningstallet til s-t-grafen er farten',
      body: (
        <>
          <p>
            Farten er hvor raskt posisjonen endrer seg. I en s-t-graf er farten stigningstallet til tangenten: der farten er stor, er
            s-t-grafen bratt, og der farten er null, er den vannrett. Vi leser farten av v-t-grafen og tegner s-t-grafen del for del.
          </p>
          <p>
            <strong>Del 1:</strong> farten øker fra 0, så grafen starter vannrett i origo og blir brattere og brattere. Den krummer oppover
            (en parabel, s = ½at²).
          </p>
          <p>
            Prikkene på strekningen øverst i scenen viser hvor bilen er hvert sekund. I starten ligger de tett, og så sprer de seg mer og
            mer.
          </p>
        </>
      ),
      math: [
        <>
          s(t<Sub>1</Sub>) = ½ · a<Sub>1</Sub> · t<Sub>1</Sub>² = ½ · {acc(p1.a)} · ({ts(t1)})² = {m(p1.s)}
        </>,
      ],
    },
    {
      part: 'e',
      view: 'st2',
      title: 'Konstant fart og nedbremsing',
      body: (
        <>
          <p>
            <strong>Del 2:</strong> konstant fart gir konstant stigningstall, altså en rett linje med stigningstall {v}. Linja fortsetter i
            samme retning som kurven slutter i del 1, så det blir ingen knekk.
          </p>
          <p>
            <strong>Del 3:</strong> farten avtar mot null, så grafen blir slakere og slakere. Den krummer nedover og ender vannrett ved t ={' '}
            {ts(t3)}, der bilen står stille.
          </p>
        </>
      ),
      math: [
        <>
          s(t<Sub>2</Sub>) = {m(p1.s)} + {m(p2.s)} = {m(p3.start)}
        </>,
        <>
          s(t<Sub>3</Sub>) = {m(p3.start)} + {m(p3.s)} = {m(sol.s)}
        </>,
      ],
      answer:
        's-t-grafen krummer oppover i del 1, er en rett linje i del 2 og krummer nedover til den flater ut i del 3. Den stiger hele tiden, fordi bilen hele tiden kjører framover.',
      pitfall:
        'Ikke la s-t-grafen gå nedover når bilen bremser. Bilen kjører fortsatt framover, så s øker, bare langsommere. s-t-grafen synker bare når bilen kjører bakover.',
    },
  ];
}
