import { useState } from 'react';
import { Sub, WorkedExample, fmt, type ExampleStep } from '../../kit';
import { KalorimeterFigur } from './eks-kalorimeter-figur';
import { CALORIMETER_TASKS, C_WATER, solveCalorimeterTask } from './model-eks-kalorimeter';

/**
 * Eksempeloppgave (5C, 5D): en varm metallbit senkes ned i vann i et kalorimeter av isopor. Fra
 * likevektstemperaturen finner eleven den spesifikke varmekapasiteten, sammenligner med tabellverdier og drøfter
 * hvordan varmetap til omgivelsene påvirker svaret. Oppgaven er laget for appen (egen tekst og egne tall) i samme
 * stil som eksamensoppgaver.
 *
 * Alle tall i teksten, utregningen, svarene og figuren kommer fra solveCalorimeterTask
 * (model-eks-kalorimeter.ts), så de stemmer med hverandre i alle tallsettene.
 */
export default function EksKalorimeter() {
  const [variant, setVariant] = useState(0);
  const task = CALORIMETER_TASKS[variant] ?? CALORIMETER_TASKS[0]!;
  const s = solveCalorimeterTask(task);
  const { mMetal, mWater, TWater, TMetal, TEnd } = task;

  const T = (v: number) => `${fmt(v, 1)} °C`;
  const K = (v: number) => `${fmt(v, 1)} K`;
  const kg = (v: number) => `${fmt(v, 3)} kg`;
  const J = (v: number) => `${fmt(v, 0)} J`;
  const cUnit = 'J/(kg·K)';
  const cw = `${fmt(C_WATER, 0)} ${cUnit}`;
  const pct = (v: number) => `${fmt(Math.abs(v) * 100, 1)} %`;
  const best = s.best.entry;
  const runner = s.runnerUp;
  const below = s.closeBelow;
  const bestName = best.name.toLowerCase();

  const sym = {
    cm: (
      <>
        c<Sub>m</Sub>
      </>
    ),
    cv: (
      <>
        c<Sub>v</Sub>
      </>
    ),
    mm: (
      <>
        m<Sub>m</Sub>
      </>
    ),
    mv: (
      <>
        m<Sub>v</Sub>
      </>
    ),
    Tm: (
      <>
        T<Sub>m</Sub>
      </>
    ),
    Tv: (
      <>
        T<Sub>v</Sub>
      </>
    ),
    Ts: (
      <>
        T<Sub>s</Sub>
      </>
    ),
    Qv: (
      <>
        Q<Sub>v</Sub>
      </>
    ),
  };

  const steps: ExampleStep[] = [
    {
      part: 'a',
      title: 'Bruk Q = cmΔT for vannet',
      body: (
        <p>
          Vannet varmes opp fra {T(TWater)} til likevektstemperaturen {T(TEnd)}. Energien det mottar, avhenger av hvor mye vann det er, hvor
          mye temperaturen stiger, og den spesifikke varmekapasiteten til vann. En temperaturendring på 1 °C er like stor som 1 K, så ΔT kan
          skrives i kelvin.
        </p>
      ),
      math: [
        <>
          ΔT<Sub>v</Sub> = {sym.Ts} − {sym.Tv} = {T(TEnd)} − {T(TWater)} = {K(s.dTWater)}
        </>,
        <>
          {sym.Qv} = {sym.cv} · {sym.mv} · ΔT<Sub>v</Sub> = {cw} · {kg(mWater)} · {K(s.dTWater)} = {J(s.Qw)}
        </>,
      ],
      answer: (
        <>
          Vannet tok opp {sym.Qv} = {fmt(s.Qw / 1000, 1)} kJ.
        </>
      ),
      pitfall: (
        <>
          ΔT er endringen i temperatur, ikke sluttemperaturen. Regn {T(TEnd)} − {T(TWater)}, ikke bare {T(TEnd)}.
        </>
      ),
    },
    {
      part: 'b',
      title: 'Energibevaring: det metallet avgir, mottar vannet',
      body: (
        <>
          <p>
            Metallbiten har ligget lenge i kokende vann og har fått samme temperatur som vannet: {T(TMetal)} ved vanlig lufttrykk. I
            kalorimeteret avgir biten energi til vannet helt til begge har samme temperatur {sym.Ts} = {T(TEnd)} (termisk likevekt).
          </p>
          <p>
            Kalorimeteret er isolert, og vi ser bort fra varmetap. Da er energien metallet avgir, like stor som energien vannet mottar.
            Metallet kjøles ned fra {T(TMetal)} til {T(TEnd)}.
          </p>
        </>
      ),
      math: [
        <>
          Q<Sub>avgitt</Sub> = Q<Sub>mottatt</Sub>
        </>,
        <>
          {sym.cm} · {sym.mm} · ({sym.Tm} − {sym.Ts}) = {sym.Qv}
        </>,
        <>
          ΔT<Sub>m</Sub> = {sym.Tm} − {sym.Ts} = {T(TMetal)} − {T(TEnd)} = {K(s.dTMetal)}
        </>,
      ],
      pitfall: <>Metallet og vannet har ikke samme ΔT. Vannet blir {K(s.dTWater)} varmere, men metallet blir {K(s.dTMetal)} kaldere.</>,
    },
    {
      part: 'b',
      title: 'Løs ut den spesifikke varmekapasiteten',
      body: <p>Den eneste ukjente i likningen er {sym.cm}. Vi deler energien på massen og temperaturfallet til metallet.</p>,
      math: [
        <>
          {sym.cm} = {sym.Qv} / ({sym.mm} · ΔT<Sub>m</Sub>)
        </>,
        <>
          {sym.cm} = {J(s.Qw)} / ({kg(mMetal)} · {K(s.dTMetal)}) = {fmt(s.c, 0)} {cUnit}
        </>,
      ],
      answer: (
        <>
          {sym.cm} = {fmt(s.c, 0)} {cUnit} ≈ {fmt(s.cRounded, 0)} {cUnit}
        </>
      ),
      tip: (
        <>
          Sjekk enheten: J / (kg · K) = J/(kg·K). Og sjekk størrelsen: alle metaller har mye lavere spesifikk varmekapasitet enn vann (
          {cw}), så svaret må være godt under det.
        </>
      ),
    },
    {
      part: 'c',
      title: 'Sammenlign med tabellen',
      body: (
        <p>
          Ingen måling er helt nøyaktig, så vi ser etter metallet med tabellverdi nærmest {fmt(s.c, 0)} {cUnit} og regner ut avviket i
          prosent av tabellverdien.
        </p>
      ),
      math: [
        <>
          {best.name}: ({fmt(s.c, 0)} − {best.c}) / {best.c} = {s.best.dev < 0 ? '−' : '+'}
          {pct(s.best.dev)}
        </>,
        <>
          {runner.entry.name}: ({fmt(s.c, 0)} − {runner.entry.c}) / {runner.entry.c} = {runner.dev < 0 ? '−' : '+'}
          {pct(runner.dev)}
        </>,
      ],
      answer: (
        <>
          Biten er trolig av {bestName} ({best.c} {cUnit}). Målingen ligger {pct(s.best.dev)} {s.best.dev < 0 ? 'under' : 'over'} tabellverdien.
        </>
      ),
      tip: below ? (
        <>
          {below.entry.name} ({below.entry.c} {cUnit}) ligger heller ikke langt unna. I d) ser vi at varmetapet gjør målingen for lav, og
          det avgjør saken.
        </>
      ) : (
        <>Tettheten kan bekrefte svaret: mål volumet med vannfortrengning og regn ut ρ = m/V.</>
      ),
    },
    {
      part: 'd',
      title: 'Varmetap fra kalorimeteret',
      body: (
        <>
          <p>
            Litt energi går gjennom isoporen og lokket til lufta, og litt varmer opp selve begeret og termometeret. Den energien kommer fra
            metallbiten, men havner ikke i vannet. Vannet blir derfor ikke så varmt som det ellers ville blitt, og vi måler en for lav
            {' '}
            {sym.Ts}.
          </p>
          <p>Se på formelen: en for lav {sym.Ts} gjør telleren mindre og nevneren større. Begge deler gir for liten {sym.cm}.</p>
        </>
      ),
      math: [
        <>
          {sym.cm} = {sym.cv} · {sym.mv} · ({sym.Ts} − {sym.Tv}) / ({sym.mm} · ({sym.Tm} − {sym.Ts}))
        </>,
        <>
          {sym.Ts} for lav ⇒ ({sym.Ts} − {sym.Tv}) for liten og ({sym.Tm} − {sym.Ts}) for stor ⇒ {sym.cm} for liten
        </>,
      ],
      tip: 'Derfor brukes isopor og lokk, og derfor rører vi om og leser av så snart temperaturen slutter å stige.',
    },
    {
      part: 'd',
      title: 'Varmetap på veien over',
      body: (
        <p>
          Mens biten løftes fra kasserollen til kalorimeteret, avgir den varme til lufta. Når den kommer ned i vannet, er den derfor litt
          kaldere enn {T(TMetal)}. Vi regnet med {T(TMetal)}, så ΔT<Sub>m</Sub> i nevneren ble for stor. Det gir også for liten {sym.cm}.
        </p>
      ),
      answer: (
        <>
          Begge typene varmetap gjør den målte verdien for liten. Den ekte spesifikke varmekapasiteten er litt større enn {fmt(s.c, 0)}{' '}
          {cUnit}. Det styrker konklusjonen: tabellverdien for {bestName} ({best.c}) er større enn målingen
          {below ? (
            <>
              , mens {below.entry.name.toLowerCase()} ({below.entry.c}) ligger under og passer dårligere
            </>
          ) : null}
          .
        </>
      ),
      pitfall: (
        <>
          Varmt vann som henger igjen på biten, trekker motsatt vei: det gir vannet ekstra energi og gjør {sym.cm} for stor. Rist av vannet før
          biten senkes ned.
        </>
      ),
    },
    {
      part: 'e',
      title: 'Likevektstemperaturen uten varmetap',
      body: (
        <p>
          Nå bruker vi tabellverdien {sym.cm} = {best.c} {cUnit} og lar likevektstemperaturen T være ukjent. Uten varmetap er energien
          metallet avgir, lik energien vannet mottar. Det er lurt å regne ut varmekapasiteten C = cm for hver del først.
        </p>
      ),
      math: [
        <>
          {sym.cm}
          {sym.mm} = {best.c} {cUnit} · {kg(mMetal)} = {fmt(s.CMetal, 0)} J/K og {sym.cv}
          {sym.mv} = {cw} · {kg(mWater)} = {fmt(s.CWater, 0)} J/K
        </>,
        <>
          {sym.cm}
          {sym.mm}({sym.Tm} − T) = {sym.cv}
          {sym.mv}(T − {sym.Tv}) ⇒ T = ({sym.cm}
          {sym.mm}
          {sym.Tm} + {sym.cv}
          {sym.mv}
          {sym.Tv}) / ({sym.cm}
          {sym.mm} + {sym.cv}
          {sym.mv})
        </>,
        <>
          T = ({fmt(s.CMetal, 0)} J/K · {T(TMetal)} + {fmt(s.CWater, 0)} J/K · {T(TWater)}) / ({fmt(s.CMetal, 0)} J/K + {fmt(s.CWater, 0)} J/K)
          = {fmt(s.TIdeal, 2)} °C
        </>,
      ],
      answer: (
        <>
          Uten varmetap hadde termometeret stoppet på omtrent {T(s.TIdeal)}, {K(s.TIdeal - TEnd)} over det eleven målte.
        </>
      ),
      pitfall: (
        <>
          Likevekten er ikke gjennomsnittet ({fmt(TMetal, 0)} + {fmt(TWater, 0)})/2. Vannet har mye større varmekapasitet ({fmt(s.CWater, 0)}{' '}
          J/K mot {fmt(s.CMetal, 0)} J/K), så likevekten havner nær temperaturen til vannet.
        </>
      ),
    },
    {
      part: 'e',
      title: 'Hvor mye av energien gikk tapt?',
      body: (
        <p>
          I det virkelige forsøket ble metallet kjølt fra {T(TMetal)} ned til {T(TEnd)}. Med tabellverdien kan vi regne ut hvor mye energi
          metallet da avga. Vannet fikk {J(s.Qw)} av den. Resten gikk til omgivelsene.
        </p>
      ),
      math: [
        <>
          Q<Sub>m</Sub> = {sym.cm} · {sym.mm} · ({sym.Tm} − {sym.Ts}) = {best.c} {cUnit} · {kg(mMetal)} · {K(s.dTMetal)} = {J(s.QMetal)}
        </>,
        <>
          Q<Sub>tap</Sub> = Q<Sub>m</Sub> − {sym.Qv} = {J(s.QMetal)} − {J(s.Qw)} = {J(s.QLoss)}
        </>,
        <>
          Q<Sub>tap</Sub> / Q<Sub>m</Sub> = {J(s.QLoss)} / {J(s.QMetal)} = {pct(s.lossFrac)}
        </>,
      ],
      answer: (
        <>
          Omtrent {fmt(s.lossFrac * 100, 0)} % av energien metallet avga ({fmt(s.QLoss / 1000, 1)} kJ), gikk tapt til omgivelsene.
        </>
      ),
      tip: (
        <>
          Andelen er den samme som avviket i c): 1 − {fmt(s.c, 0)}/{best.c} = {pct(s.lossFrac)}. Mangler {pct(s.lossFrac)} av energien, blir
          den målte {sym.cm} like mye for liten.
        </>
      ),
    },
  ];

  return (
    <WorkedExample
      variants={{ labels: ['Tallsett 1', 'Tallsett 2', 'Tallsett 3'], value: variant, onChange: setVariant }}
      intro={
        <p>
          En elev vil finne ut hva en ukjent metallbit er laget av. Biten har massen {kg(mMetal)}. Eleven henger den i en tynn tråd ned i en
          kasserolle med kokende vann og lar den ligge der i ti minutter. Så løfter hun biten raskt over i et kalorimeter av isopor med{' '}
          {kg(mWater)} vann som holder {T(TWater)}, og setter på lokket. Hun rører forsiktig om. Termometeret stiger og stopper på {T(TEnd)}. Se
          bort fra varmekapasiteten til selve kalorimeteret og termometeret. Tabellen under figuren viser spesifikk varmekapasitet for noen
          metaller.
        </p>
      }
      given={[
        <>
          {sym.mm} = {kg(mMetal)}
        </>,
        <>
          {sym.mv} = {kg(mWater)}
        </>,
        <>
          {sym.Tv} = {T(TWater)}
        </>,
        <>
          {sym.Ts} = {T(TEnd)}
        </>,
        <>
          {sym.cv} = {cw}
        </>,
      ]}
      parts={[
        { id: 'a', text: 'Hvor mye energi tok vannet i kalorimeteret opp?' },
        {
          id: 'b',
          text: (
            <>
              Vis at den spesifikke varmekapasiteten til metallet er omtrent {fmt(s.cRounded, 0)} {cUnit} når vi ser bort fra varmetap.
            </>
          ),
        },
        { id: 'c', text: 'Bruk tabellen til å avgjøre hvilket metall biten trolig er laget av.' },
        {
          id: 'd',
          text: 'Under forsøket går litt energi tapt til omgivelsene. Drøft hvordan varmetapet påvirker verdien du fant i b), og om det styrker eller svekker svaret i c).',
        },
        {
          id: 'e',
          text: 'Bruk tabellverdien. Hvilken likevektstemperatur ville eleven fått uten varmetap, og hvor stor andel av energien fra metallbiten gikk tapt?',
        },
      ]}
      steps={steps}
      figure={(state) => <KalorimeterFigur task={task} s={s} state={state} />}
    />
  );
}
