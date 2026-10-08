import { Fragment, useState, type ReactNode } from 'react';
import { Sub, WorkedExample, fmt, fmtSci, type ExampleStep } from '../../kit';
import { elementName } from '../kap07/elements';
import { MassFigure } from './massedefekt-figur';
import { C_LIGHT, FUEL_KG, MASS_TASKS, MEV_J, PARTICLES, U_KG, U_MEV_TABLE, sig, solveMassTask, type MassTask, type Particle, type Term } from './model-eks-massedefekt';

/**
 * Eksempeloppgave (8A–8D): energi fra en kjernereaksjon. Finn den ukjente partikkelen med bevaring av nukleontall og
 * ladning, regn ut massedefekten fra tabellmasser, energien med E = Δm · c² (J og MeV), energien i 1,0 kg brensel og
 * hvor mye kull eller bensin som gir like mye. Tre tallsett: fisjon av uran-235 i et kjernekraftverk, fusjon av
 * deuterium og tritium i en fusjonsreaktor og det siste trinnet i proton–proton-kjeden i sola.
 *
 * Oppgaven er laget for appen (egen tekst og egne tall). Alle tallene i teksten, utregningen og svarene kommer fra
 * solveMassTask. Mellomsvar vises med ett siffer mer enn svaret (model-eks-massedefekt.test.ts sjekker at linjene går
 * opp med tallene som vises).
 */

/** Tallet med n gjeldende siffer og desimalkomma (bare for tall mellom 0,001 og 10 000). */
function fmtSig(v: number, n: number): string {
  const r = sig(v, n);
  const e = Math.floor(Math.log10(Math.abs(r)));
  return fmt(r, Math.max(0, n - 1 - e));
}

/** Tall på standardform med n gjeldende siffer: «2,962 · 10⁻¹¹». */
const sci = (v: number, n: number) => fmtSci(sig(v, n), n - 1);
const u6 = (v: number) => `${fmt(v, 6)} u`;

/** Partikkelen i teksten: ²³⁵U, ¹H, n eller p. */
function nuc(p: Particle, atom = false): ReactNode {
  if (p.kind === 'noytron') return 'n';
  if (p.kind === 'proton') return atom ? <><sup>1</sup>H</> : 'p';
  return (
    <>
      <sup>{p.A}</sup>
      {p.symbol}
    </>
  );
}

/** Ett ledd i likningen, med koeffisient: «2 n», «X». */
function termText(t: Term, revealed: boolean): ReactNode {
  const body = t.unknown && !revealed ? 'X' : nuc(t.p);
  return t.count > 1 ? (
    <>
      {t.count}
      {' '}
      {body}
    </>
  ) : (
    body
  );
}

function equation(task: MassTask, revealed: boolean): ReactNode {
  const side = (terms: Term[]) =>
    terms.map((t, i) => (
      <Fragment key={i}>
        {i > 0 && ' + '}
        {termText(t, revealed)}
      </Fragment>
    ));
  return (
    <>
      {side(task.reactants)} → {side(task.products)}
    </>
  );
}

/** «235 + 1» eller «2 · 3»: nukleontall eller ladning for leddene, med bokstaven for X. */
function sumText(terms: Term[], which: 'A' | 'Z'): string {
  return terms
    .map((t) => {
      const v = t.unknown ? which : String(which === 'A' ? t.p.A : t.p.Z);
      return t.count > 1 ? `${t.count} · ${v}` : v;
    })
    .join(' + ');
}

/** Massene i et sett ledd: «235,043930 u + 1,008665 u» og symbolene «m(²³⁵U) + m(n)». */
function massSum(terms: Term[]): { sym: ReactNode; num: string } {
  return {
    sym: terms.map((t, i) => (
      <Fragment key={i}>
        {i > 0 && ' + '}
        {t.count > 1 ? `${t.count} · ` : ''}m({nuc(t.p, true)})
      </Fragment>
    )),
    num: terms.map((t) => (t.count > 1 ? `${t.count} · ${u6(t.p.mass)}` : u6(t.p.mass))).join(' + '),
  };
}

/** Små tall med ord i teksten. */
const COUNT: readonly string[] = ['ingen', 'ett', 'to', 'tre'];

/** Situasjonen i hvert tallsett. */
const TEXT: Record<
  MassTask['id'],
  { before: ReactNode; after: ReactNode; partD: string; fuelWhy: ReactNode; burn: string }
> = {
  fisjon: {
    before: 'I reaktoren i et kjernekraftverk spaltes uran-235 når en kjerne fanger et langsomt nøytron. En av mange mulige spaltninger er',
    after: 'der X er en ukjent partikkel. Atommassene står under. Et kullkraftverk får til sammenligning ca. 30 MJ fra hvert kilogram kull som brenner.',
    partD: 'Hvor mye energi frigjøres når 1,0 kg uran-235 spaltes på denne måten?',
    fuelWhy: (
      <p>
        Hver spaltning bruker én uran-235-kjerne. Nøytronet regner vi ikke som brensel: det kommer fra en spaltning like før (en
        kjedereaksjon). Antall reaksjoner er massen av brenselet delt på massen av brenselet i én reaksjon, m<Sub>1</Sub>.
      </p>
    ),
    burn: 'kull',
  },
  fusjon: {
    before:
      'I en fusjonsreaktor av typen tokamak holdes en gass av deuterium og tritium så varm, over 100 millioner grader, at kjernene smelter sammen:',
    after: 'Massene står under. Til sammenligning gir bensin ca. 43 MJ per kilogram når den brenner i en bilmotor.',
    partD: 'Hvor mye energi frigjøres når 1,0 kg brensel med like mange deuterium- og tritiumatomer fusjonerer på denne måten?',
    fuelWhy: (
      <p>
        Hver reaksjon bruker ett deuteriumatom og ett tritiumatom. Brenselet har like mange av hver, så massen av brenselet i én
        reaksjon er m<Sub>1</Sub> = m(<sup>2</sup>H) + m(<sup>3</sup>H). Antall reaksjoner er massen av brenselet delt på m<Sub>1</Sub>.
      </p>
    ),
    burn: 'bensin',
  },
  sola: {
    before: 'I kjernen av sola blir hydrogen til helium i flere trinn. I det siste trinnet smelter to helium-3-kjerner sammen:',
    after: 'Atommassene står under. Til sammenligning gir kull ca. 30 MJ per kilogram når det brenner.',
    partD: 'Hvor mye energi frigjøres når 1,0 kg helium-3 smelter sammen på denne måten?',
    fuelWhy: (
      <p>
        Hver reaksjon bruker to helium-3-atomer, så massen av brenselet i én reaksjon er m<Sub>1</Sub> = 2 · m(<sup>3</sup>He). Antall
        reaksjoner er massen av brenselet delt på m<Sub>1</Sub>.
      </p>
    ),
    burn: 'kull',
  },
};

export default function EksMassedefekt() {
  const [variant, setVariant] = useState(0);
  const task = MASS_TASKS[variant] ?? MASS_TASKS[0]!;
  const s = solveMassTask(task);
  const T = TEXT[task.id];
  const fuel = task.compare;
  const X = s.X;
  const xTerm = task.products.find((t) => t.unknown)!;
  const knownProducts = task.products.filter((t) => !t.unknown);
  const E3 = fmtSig(s.EMeV, 3);
  const heatMJ = fmt(fuel.heat / 1e6, 0);
  const tonn = fmt(sig(s.compareKg / 1000, 2), 0);
  const ratio = fmt(sig(s.ratio / 1e6, 2), 1);
  const pct = (v: number) => fmtSig(v * 100, 2);
  const mb = massSum(task.reactants);
  const ma = massSum(task.products);
  const mf = massSum(task.fuel);
  const multi = task.products.find((t) => t.count > 1);
  const neutrons = (terms: Term[]) => terms.reduce((n, t) => n + (t.p.kind === 'noytron' ? t.count : 0), 0);

  // Bevaringslovene: «235 + 1 = 140 + A + 2 · 1» og løsningen.
  const solveLine = (which: 'A' | 'Z') => {
    const tot = which === 'A' ? s.A.before : s.Z.before;
    const known = which === 'A' ? s.A.knownAfter : s.Z.knownAfter;
    const v = which === 'A' ? s.A.X : s.Z.X;
    return s.countX > 1
      ? `${s.countX} · ${which} = ${tot} − ${known} = ${tot - known}  ⇒  ${which} = ${v}`
      : `${which} = ${tot} − ${known} = ${v}`;
  };

  const xName =
    X?.kind === 'noytron' ? 'et nøytron' : X?.kind === 'proton' ? 'et proton' : X ? `${elementName(X.Z)}\u2011${X.A}` : 'ukjent';

  const steps: ExampleStep[] = [
    {
      part: 'a',
      title: 'Bruk bevaring av nukleontall og ladning',
      body: (
        <p>
          I alle kjernereaksjoner er summen av nukleontallene (A, antall protoner og nøytroner) og summen av ladningene (Z) like store før
          og etter. Et nøytron har A = 1 og Z = 0. Vi kaller nukleontallet og ladningen til X for A og Z
          {s.countX > 1 ? <>, og husk at det står {s.countX} X på høyre side</> : null}.
        </p>
      ),
      math: [
        <>
          Nukleontall: {sumText(task.reactants, 'A')} = {sumText(task.products, 'A')}
        </>,
        solveLine('A'),
        <>
          Ladning: {sumText(task.reactants, 'Z')} = {sumText(task.products, 'Z')}
        </>,
        solveLine('Z'),
      ],
      pitfall: multi ? (
        multi.unknown ? (
          <>
            Gang med koeffisienten: {multi.count} X betyr {multi.count} partikler, så X teller {multi.count} ganger i begge summene.
          </>
        ) : (
          <>
            Gang med koeffisienten: {multi.count} n betyr {multi.count} nøytroner, så de teller {multi.count} ganger i nukleontallet.
          </>
        )
      ) : (
        'Ladningen Z er antall protoner. Nøytronet har ingen ladning, så det bidrar med 0 i ladningssummen, men med 1 i nukleontallet.'
      ),
    },
    {
      part: 'a',
      title: 'Finn ut hvilken partikkel X er',
      body:
        X?.kind === 'kjerne' ? (
          <p>
            Protontallet Z bestemmer grunnstoffet. I periodesystemet er Z = {s.Z.X} {elementName(s.Z.X)} ({X.symbol}). Med A = {s.A.X} er X
            altså {xName}, med {s.Z.X} protoner og {s.A.X} − {s.Z.X} = {s.A.X - s.Z.X} nøytroner.
          </p>
        ) : X?.kind === 'noytron' ? (
          <p>En partikkel med A = 1 og Z = 0 består av ett nukleon uten ladning. Det er et nøytron.</p>
        ) : (
          <p>
            En partikkel med A = 1 og Z = 1 består av ett nukleon med ladningen +1. Det er et proton, altså kjernen i et vanlig
            hydrogenatom (<sup>1</sup>H).
          </p>
        ),
      answer: (
        <>
          X er {X?.kind === 'kjerne' ? <>{nuc(X)} ({xName})</> : <>{xName} ({X ? nuc(X) : '?'})</>}. Reaksjonen er {equation(task, true)}.
        </>
      ),
      tip: (
        <>
          Kontroller: etter reaksjonen er nukleontallet {sumText(task.products, 'A').replace('A', String(s.A.X))} ={' '}
          {s.A.before} og ladningen {sumText(task.products, 'Z').replace('Z', String(s.Z.X))} = {s.Z.before}, akkurat som før.
        </>
      ),
    },
    {
      part: 'b',
      title: 'Legg sammen massene før og etter',
      body: (
        <>
          <p>
            Massedefekten Δm er hvor mye mindre den samlede massen er etter reaksjonen enn før. Massene i oppgaven er atommasser, altså med
            elektronene. Ladningen er bevart, så det er like mange elektroner før og etter ({s.electrons[0]}), og elektronmassene faller bort
            når vi trekker fra.
          </p>
          {xTerm.p.kind === 'proton' && (
            <p>
              For protonene bruker vi derfor massen til et <sup>1</sup>H-atom (et proton og et elektron).
            </p>
          )}
        </>
      ),
      math: [
        <>
          m<Sub>før</Sub> = {mb.sym} = {mb.num} = {u6(s.mBefore)}
        </>,
        <>
          m<Sub>etter</Sub> = {ma.sym} = {ma.num} = {u6(s.mAfter)}
        </>,
      ],
      pitfall:
        neutrons(task.reactants) !== neutrons(task.products) ? (
          <>
            Ta med nøytronene. Det er {COUNT[neutrons(task.reactants)]} nøytron{neutrons(task.reactants) === 1 ? '' : 'er'} før og{' '}
            {COUNT[neutrons(task.products)]} etter, så massene deres faller ikke bort.
          </>
        ) : (
          'Husk koeffisientene: to helium-3 før og to protoner etter. Begge skal ganges med 2.'
        ),
    },
    {
      part: 'b',
      title: 'Trekk massen etter fra massen før',
      math: [
        <>
          Δm = m<Sub>før</Sub> − m<Sub>etter</Sub> = {u6(s.mBefore)} − {u6(s.mAfter)} = {u6(s.dm)}
        </>,
      ],
      answer: <>Δm = {u6(s.dm)}</>,
      tip: 'Δm er positiv: massen etter reaksjonen er mindre enn før. Det er denne massen som blir til energi. Hadde Δm vært negativ, ville reaksjonen krevd energi i stedet.',
    },
    {
      part: 'c',
      title: 'Bruk E = Δm · c² med SI-enheter',
      body: (
        <p>
          Massen som forsvinner, blir til energi, mest som bevegelsesenergi til partiklene etter reaksjonen. I E = Δm · c² må massen være i
          kilogram og lysfarten i m/s. Da blir energien i joule.
        </p>
      ),
      math: [
        <>
          Δm = {u6(s.dm)} · 1,66 · 10⁻²⁷ kg/u = {sci(s.dmKg, 4)} kg
        </>,
        <>
          E = Δm · c² = {sci(s.dmKg, 4)} kg · (3,00 · 10⁸ m/s)² = {sci(s.EJ, 4)} J
        </>,
      ],
      pitfall: 'Bruk massen i kilogram, ikke i u, og husk å kvadrere lysfarten.',
    },
    {
      part: 'c',
      title: 'Gjør om til MeV',
      body: (
        <p>
          1 eV er energien et elektron får når det akselereres gjennom en spenning på 1 V: 1 eV = 1,60 · 10⁻¹⁹ J. Da er 1 MeV = 10⁶ eV =
          1,60 · 10⁻¹³ J.
        </p>
      ),
      math: [
        <>
          E = {sci(s.EJ, 4)} J / (1,60 · 10⁻¹³ J/MeV) = {fmtSig(s.EMeV, 4)} MeV
        </>,
      ],
      answer: (
        <>
          E = {sci(s.EJ, 3)} J ≈ {E3} MeV
        </>
      ),
      tip: (
        <>
          Snarvei med tabellverdien 1 u · c² = {fmt(U_MEV_TABLE, 1)} MeV: E = {fmt(s.dm, 6)} · {fmt(U_MEV_TABLE, 1)} MeV ={' '}
          {fmtSig(s.EMeVTable, 4)} MeV. Svaret blir litt annerledes fordi konstantene over er avrundet.
        </>
      ),
    },
    {
      part: 'd',
      title: `Finn antall reaksjoner i ${fmt(FUEL_KG, 1)} kg brensel`,
      body: T.fuelWhy,
      math: [
        <>
          m<Sub>1</Sub> = {mf.sym} = {task.fuel.length > 1 ? `(${mf.num})` : mf.num} · 1,66 · 10⁻²⁷ kg/u = {sci(s.fuelKgEach, 4)} kg
        </>,
        <>
          N = {fmt(FUEL_KG, 1)} kg / ({sci(s.fuelKgEach, 4)} kg) = {sci(s.N, 4)}
        </>,
      ],
      pitfall: 'Gjør massen i u om til kilogram før du deler. Ellers blir antallet helt feil.',
    },
    {
      part: 'd',
      title: 'Gang med energien fra én reaksjon',
      body: <p>Hver reaksjon gir energien fra c). Den totale energien er antall reaksjoner ganger energien fra én reaksjon.</p>,
      math: [
        <>
          E<Sub>tot</Sub> = N · E = {sci(s.N, 4)} · {sci(s.EJ, 4)} J = {sci(s.Etot, 4)} J
        </>,
      ],
      answer: (
        <>
          E<Sub>tot</Sub> ≈ {sci(s.Etot, 2)} J
        </>
      ),
      tip: `Svaret har to gjeldende siffer, som massen ${fmt(FUEL_KG, 1)} kg.`,
    },
    {
      part: 'e',
      title: `Hvor mye ${fuel.name} gir like mye energi?`,
      body: (
        <p>
          Brennverdien {heatMJ} MJ/kg sier hvor mye energi ett kilogram {fuel.name} gir når det brenner. Massen vi trenger, er den totale
          energien delt på brennverdien.
        </p>
      ),
      math: [
        <>
          m = E<Sub>tot</Sub> / brennverdien = {sci(s.Etot, 4)} J / ({sci(fuel.heat, 2)} J/kg) = {sci(s.compareKg, 3)} kg
        </>,
      ],
      answer: (
        <>
          Ca. {sci(s.compareKg, 2)} kg {fuel.name}, altså {tonn} tonn: omtrent {ratio} millioner ganger så mye masse som brenselet.
        </>
      ),
      tip:
        fuel.id === 'kull'
          ? `Med ca. ${fmt(fuel.density / 1000, 1)} tonn per kubikkmeter blir det en kullhaug som er ca. ${fmt(s.heap.h, 0)} m høy og ${fmt(2 * s.heap.r, 0)} m bred (se figuren).`
          : `Bensin har massetettheten ${fmt(fuel.density / 1000, 2)} kg/L, så det er ca. ${fmt(sig(s.volume, 2), 0)} m³: en tank som er ${fmt(s.tank.d, 0)} m bred og ${fmt(s.tank.h, 0)} m høy (se figuren).`,
    },
    {
      part: 'e',
      title: 'Forklar hvorfor forskjellen er så stor',
      body: (
        <p>
          Når {T.burn} brenner, er det en kjemisk reaksjon: bare elektronene ordner seg i nye bindinger mellom atomene, og hvert molekyl gir
          noen få eV. I en kjernereaksjon endres bindingene inne i kjernene. Den sterke kjernekraften er mye sterkere, så hver reaksjon gir
          flere MeV, altså millioner av ganger mer. Vi kan også sammenligne hvor stor del av massen som blir til energi:
        </p>
      ),
      math: [
        <>
          Kjernereaksjonen: Δm / m<Sub>1</Sub> = {u6(s.dm)} / {u6(s.fuelU)} = {sci(s.fraction, 3)} = {pct(s.fraction)} %
        </>,
        <>
          Forbrenningen: Δm / m = E / (mc²) = {sci(fuel.heat, 2)} J / (1 kg · (3,00 · 10⁸ m/s)²) = {sci(s.chemFraction, 2)}
        </>,
      ],
      answer: (
        <>
          Bare {pct(s.fraction)} % av massen blir til energi i kjernereaksjonen, men det er ca. {ratio} millioner ganger mer enn når {T.burn}{' '}
          brenner. Kjernekreftene er mye sterkere enn de kjemiske bindingene mellom atomene.
        </>
      ),
      tip: (
        <>
          Også når {T.burn} brenner, blir massen litt mindre: {sci(s.chemDmKg, 2)} kg per kilogram, altså ca.{' '}
          {fmtSig(s.chemDmKg * 1e9, 2)} mikrogram. Det er alt for lite til å måles med en vekt.
        </>
      ),
    },
  ];

  const given: ReactNode[] = [];
  const seen = new Set<string>();
  for (const t of [...task.reactants, ...knownProducts, xTerm]) {
    if (seen.has(t.p.key)) continue;
    seen.add(t.p.key);
    given.push(
      <>
        m({nuc(t.p, true)}) = {u6(t.p.mass)}
      </>,
    );
  }
  if (!seen.has('n')) given.push(<>m(n) = {u6(PARTICLES.n.mass)}</>);
  given.push(<>1 u = {sci(U_KG, 3)} kg</>, <>c = {sci(C_LIGHT, 3)} m/s</>, <>1 MeV = {sci(MEV_J, 3)} J</>, <>Brennverdi for {fuel.name}: {heatMJ} MJ/kg</>);

  return (
    <WorkedExample
      variants={{ labels: ['Fisjon', 'Fusjon', 'Sola'], value: variant, onChange: setVariant }}
      intro={
        <>
          <p>{T.before}</p>
          <p>
            <strong>{equation(task, false)}</strong>
          </p>
          <p>{T.after}</p>
        </>
      }
      given={given}
      parts={[
        { id: 'a', text: 'Bestem den ukjente partikkelen X.' },
        { id: 'b', text: 'Regn ut massedefekten Δm for reaksjonen i atommasseenheter.' },
        { id: 'c', text: `Vis at det frigjøres ca. ${E3} MeV i én reaksjon. Hvor mye er det i joule?` },
        { id: 'd', text: T.partD },
        { id: 'e', text: `Hvor mange kilogram ${fuel.name} må brennes for å gi like mye energi? Forklar kort hvorfor forskjellen er så stor.` },
      ]}
      steps={steps}
      figure={(state) => <MassFigure task={task} s={s} state={state} />}
    />
  );
}
