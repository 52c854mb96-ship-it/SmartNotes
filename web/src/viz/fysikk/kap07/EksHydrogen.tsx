import { useState, type ReactNode } from 'react';
import { Sub, WorkedExample, fmt, fmtSci, type ExampleStep } from '../../kit';
import { HydrogenFigure, nmText } from './eks-hydrogen-figur';
import { B_HYDROGEN, C_LIGHT, HYDROGEN_TASKS, H_PLANCK, J_PER_EV, VISIBLE_MAX, VISIBLE_MIN, levelEnergy, solveHydrogenTask } from './model-eks-hydrogen';

/**
 * Eksempeloppgave (7B, 7C): lys fra hydrogen i en stjernetåke. Energinivåene i Bohrs modell, fotonet ved et sprang
 * (energibevaring, E = hf = hc/λ), om lyset er synlig og hvilken farge det har, og ioniseringsenergien fra
 * grunntilstanden og fra et eksitert nivå. Oppgaven er laget for appen (egen tekst og egne tall) i samme stil som
 * eksamensoppgaver i Fysikk 1.
 *
 * Alle tall kommer fra solveHydrogenTask (model-eks-hydrogen.ts). Energiene vises med tre gjeldende siffer, og
 * mellomsvarene med fire, så hver linje går opp med tallene fra linja over (testet for alle tallsettene).
 */

/** Fargen som adjektiv i intetkjønn («lyset er rødt»). */
const NEUTER: Record<string, string> = {
  rød: 'rødt',
  oransje: 'oransje',
  gul: 'gult',
  grønn: 'grønt',
  blågrønn: 'blågrønt',
  blå: 'blått',
  blåfiolett: 'blåfiolett',
  fiolett: 'fiolett',
};

/** Fargen i bestemt form («i den røde delen av spekteret»). */
const DEFINITE: Record<string, string> = {
  rød: 'røde',
  oransje: 'oransje',
  gul: 'gule',
  grønn: 'grønne',
  blågrønn: 'blågrønne',
  blå: 'blå',
  blåfiolett: 'blåfiolette',
  fiolett: 'fiolette',
};

/** Energi i joule på standardform: «−5,45 · 10⁻¹⁹ J» (tre gjeldende siffer) eller med fire (`d = 3`). */
const J = (v: number, d = 2) => `${fmtSci(v, d)} J`;

export default function EksHydrogen() {
  const [variant, setVariant] = useState(0);
  const task = HYDROGEN_TASKS[variant] ?? HYDROGEN_TASKS[0]!;
  const s = solveHydrogenTask(task);
  const { upper: u, lower: l } = task;
  const ph = s.photon;
  const visible = s.region === 'synlig';
  const colorAdj = s.color ? (NEUTER[s.color] ?? s.color) : '';
  const lamM = fmtSci(ph.lambda, 3); // mellomsvaret i meter
  const hc = `${fmtSci(H_PLANCK, 2)} J s · ${fmtSci(C_LIGHT, 2)} m/s`;
  const Btxt = J(B_HYDROGEN);
  const eVtxt = `${fmtSci(J_PER_EV, 2)} J/eV`;

  const E = (n: number | string) => (
    <>
      E<Sub>{n}</Sub>
    </>
  );
  const Ef = (
    <>
      E<Sub>foton</Sub>
    </>
  );
  const Eion = (
    <>
      E<Sub>ion</Sub>
    </>
  );
  const lmax = (
    <>
      λ<Sub>maks</Sub>
    </>
  );

  const levelLine = (n: number) =>
    n === 1 ? (
      <>
        {E(1)} = −B / 1² = {J(levelEnergy(1))}
      </>
    ) : (
      <>
        {E(n)} = −B / {n}² = −{Btxt} / {n * n} = {J(levelEnergy(n))}
      </>
    );

  const tipC2: ReactNode =
    u === 3 && l === 2
      ? 'Det røde lyset fra spranget 3 → 2 er den sterkeste synlige linja fra hydrogen. Det er derfor tåker med mye hydrogen ser rosa og røde ut på bilder.'
      : l === 2
        ? 'Sprangene ned til n = 2 gir de synlige linjene fra hydrogen. Blandingen av rødt, blågrønt og litt fiolett lys gir tåkene den rosa fargen på bilder.'
        : 'Alle sprang ned til n = 3 gir infrarødt lys, og alle sprang ned til n = 1 gir ultrafiolett stråling. Det synlige lyset fra hydrogen kommer fra sprang ned til n = 2.';

  const steps: ExampleStep[] = [
    {
      part: 'a',
      title: 'Bruk Bohrs formel for hvert nivå',
      body: (
        <p>
          Vi setter n inn i E<Sub>n</Sub> = −B/n². Husk å kvadrere n: nivå {u} gir {u}² = {u * u} i nevneren.
        </p>
      ),
      math: s.asked.map((n) => levelLine(n)),
      pitfall: (
        <>
          Glemt kvadrat. {E(3)} = −B/9, ikke −B/3.
        </>
      ),
    },
    {
      part: 'a',
      title: 'Hva betyr minustegnet?',
      body: (
        <p>
          Nullpunktet for energien er valgt der elektronet er helt fritt, langt borte fra protonet (n → ∞, E = 0). Et elektron som er bundet i
          atomet, har mindre energi enn et fritt elektron, så energien blir negativ. Jo lavere nivå, desto sterkere er elektronet bundet, og
          desto mer energi må til for å rive det løs.
        </p>
      ),
      answer: (
        <>
          {s.asked.map((n, i) => (
            <span key={n}>
              {i > 0 && (i === s.asked.length - 1 ? ' og ' : ', ')}
              {E(n)} = {J(levelEnergy(n))}
            </span>
          ))}
          . Energiene er negative fordi elektronet er bundet: vi må tilføre energi for å få E opp til 0, der elektronet er fritt.
        </>
      ),
      tip: 'Nivåene ligger tettere og tettere jo høyere opp vi kommer, og nærmer seg 0 (se diagrammet). Diagrammet har et brudd mellom n = 1 og n = 2: i målestokk ville n = 1 ligget fire ganger så langt under null som n = 2.',
    },
    {
      part: 'b',
      title: 'Energibevaring: fotonet tar med seg energiforskjellen',
      body: (
        <p>
          Når elektronet faller fra n = {u} til n = {l}, går energien til atomet ned. Energien forsvinner ikke, men sendes ut som ett foton.
          Fotonenergien er derfor forskjellen mellom nivåene, øvre minus nedre, så den blir positiv. Vi kan bruke svarene fra a), eller sette inn formelen for nivåene og regne uten avrunding.
        </p>
      ),
      math: [
        <>
          {Ef} = {E(u)} − {E(l)} = ({J(s.Eupper)}) − ({J(s.Elower)}) = {J(ph.E)}
        </>,
        <>
          {Ef} = B(1/{l}² − 1/{u}²) = {Btxt} · (1/{l * l} − 1/{u * u}) = {J(ph.E, 3)}
        </>,
      ],
      answer: <>{Ef} = {J(ph.E)}, som skulle vises.</>,
      pitfall: (
        <>
          {E(l)} − {E(u)} gir et negativt tall. Ta alltid øvre minus nedre nivå: en fotonenergi er positiv.
        </>
      ),
    },
    {
      part: 'c',
      title: 'Finn bølgelengden fra fotonenergien',
      body: (
        <p>
          For et foton er E = hf, og for lys er c = fλ. Setter vi f = c/λ inn i den første, får vi E = hc/λ, og dermed λ = hc/E.
        </p>
      ),
      math: [
        <>
          λ = hc / {Ef} = ({hc}) / ({J(ph.E, 3)})
        </>,
        <>
          λ = {lamM} m {ph.nm >= 1000 ? '≈' : '='} {nmText(ph.nm)}
        </>,
      ],
      tip: (
        <>
          Du kan også gå via frekvensen: f = {Ef}/h = {fmtSci(ph.f, 2)} Hz, og λ = c/f gir det samme.
        </>
      ),
      pitfall: 'Bruk fotonenergien i joule sammen med h i J s. Med elektronvolt blir svaret helt feil.',
    },
    {
      part: 'c',
      title: 'Er lyset synlig?',
      body: (
        <p>
          Synlig lys har bølgelengder fra ca. {VISIBLE_MIN} nm (fiolett) til ca. {VISIBLE_MAX} nm (rødt). Kortere bølgelengder er
          ultrafiolett, og lengre er infrarødt.{' '}
          {visible
            ? `${nmText(ph.nm)} ligger mellom grensene, i den ${DEFINITE[s.color ?? ''] ?? s.color} delen av spekteret.`
            : `${nmText(ph.nm)} (ca. ${fmt(Math.round(ph.nm / 10) * 10, 0)} nm) er mye lengre enn ${VISIBLE_MAX} nm.`}
        </p>
      ),
      answer: visible ? (
        <>
          λ = {nmText(ph.nm)}. Lyset er synlig og {colorAdj}.
        </>
      ) : (
        <>
          λ = {nmText(ph.nm)}. Lyset er infrarødt og ikke synlig. Astronomen må bruke et kamera som registrerer infrarødt lys.
        </>
      ),
      tip: tipC2,
    },
    {
      part: 'd',
      title: 'Ioniseringsenergien løfter elektronet fra n = 1 til E = 0',
      body: (
        <p>
          Å ionisere atomet betyr å rive løs elektronet, så det blir fritt (n → ∞, E = 0). I grunntilstanden har atomet energien {E(1)}, så
          energien som må tilføres, er forskjellen opp til null.
        </p>
      ),
      math: [
        <>
          {Eion} = 0 − {E(1)} = 0 − ({J(s.E1)}) = {J(s.ionGround.E)}
        </>,
        <>
          {Eion} = {J(s.ionGround.E)} / ({eVtxt}) = {fmt(s.ionGround.eV, 1)} eV
        </>,
      ],
      pitfall: (
        <>
          Ioniseringsenergien er positiv. {E(1)} = −{fmt(s.ionGround.eV, 1)} eV er energien til atomet, mens {fmt(s.ionGround.eV, 1)} eV er
          energien som må tilføres.
        </>
      ),
    },
    {
      part: 'd',
      title: 'Hvilke fotoner har nok energi?',
      body: (
        <p>
          Et foton kan ionisere atomet hvis fotonenergien er minst like stor som ioniseringsenergien. Fotonenergien E = hc/λ blir mindre jo
          lengre bølgelengden er, så det finnes en største bølgelengde som klarer det.
        </p>
      ),
      math: [
        <>
          {lmax} = hc / {Eion} = ({hc}) / ({J(s.ionGround.E)})
        </>,
        <>
          {lmax} = {fmtSci(s.ionGround.maxNm * 1e-9, 3)} m = {nmText(s.ionGround.maxNm)}
        </>,
      ],
      answer: (
        <>
          {Eion} = {J(s.ionGround.E)} = {fmt(s.ionGround.eV, 1)} eV. Bare fotoner med λ ≤ {nmText(s.ionGround.maxNm)} kan ionisere atomet.
          Det er langt under {VISIBLE_MIN} nm, altså ultrafiolett stråling, som skulle vises.
        </>
      ),
      tip: 'Derfor lyser tåken rundt de unge, varme stjernene: bare de sender ut nok ultrafiolett stråling til å holde gassen ionisert, og lyset kommer når elektronene fanges inn igjen.',
    },
    {
      part: 'e',
      title: `Ioniseringsenergien fra nivå n = ${l}`,
      body: (
        <p>
          Nå starter elektronet i nivå {l}, som ligger mye nærmere E = 0 enn grunntilstanden. Da trengs mindre energi for å rive det løs.
        </p>
      ),
      math: [
        <>
          {Eion} = 0 − {E(l)} = 0 − ({J(s.Elower)}) = {J(s.ionLower.E)}
        </>,
        <>
          {Eion} = {J(s.ionLower.E, 3)} / ({eVtxt}) = {fmt(s.ionLower.eV, 2)} eV
        </>,
      ],
    },
    {
      part: 'e',
      title: 'Største bølgelengde, og vurder svaret',
      body: <p>Vi bruker λ = hc/E igjen, med den nye ioniseringsenergien.</p>,
      math: [
        <>
          {lmax} = hc / {Eion} = ({hc}) / ({J(s.ionLower.E, 3)})
        </>,
        <>
          {lmax} = {fmtSci(s.ionLower.maxNm * 1e-9, 3)} m = {nmText(s.ionLower.maxNm)}
        </>,
      ],
      answer:
        s.ionLower.region === 'uv' ? (
          <>
            {lmax} = {nmText(s.ionLower.maxNm)}. Det er ultrafiolett, litt kortere enn fiolett lys ({VISIBLE_MIN} nm). Synlig lys kan derfor
            ikke ionisere et atom i nivå {l}, men ultrafiolett stråling nær det synlige kan.
          </>
        ) : (
          <>
            {lmax} = {nmText(s.ionLower.maxNm)}, som er infrarødt. Alle fotoner med kortere bølgelengde har nok energi, så alt synlig lys kan
            ionisere et atom i nivå {l}.
          </>
        ),
      tip: 'Et foton med kortere bølgelengde enn grensen har mer energi enn det som trengs. Resten blir bevegelsesenergi til det frie elektronet.',
      pitfall: 'Grensen er en største bølgelengde, ikke en minste: kortere bølgelengde betyr mer energi.',
    },
  ];

  return (
    <WorkedExample
      variants={{ labels: ['Tallsett 1', 'Tallsett 2', 'Tallsett 3'], value: variant, onChange: setVariant }}
      intro={
        <>
          <p>
            Bilder av stjernetåker, som Orion-tåken, er ofte rosa og røde. Inne i tåken er det unge, svært varme stjerner som sender ut mye
            ultrafiolett stråling, og strålingen ioniserer hydrogenatomene i gassen rundt. Når et proton fanger inn et elektron igjen, faller
            elektronet ned gjennom energinivåene, og atomet sender ut ett foton for hvert sprang.
          </p>
          <p>
            En astronom studerer lyset fra spranget fra nivå n = {u} til nivå n = {l}. I Bohrs modell for hydrogenatomet er energinivåene gitt
            ved E<Sub>n</Sub> = −B/n², der B = {Btxt} og n = 1, 2, 3, …
          </p>
        </>
      }
      given={[
        `B = ${Btxt}`,
        `h = ${fmtSci(H_PLANCK, 2)} J s`,
        `c = ${fmtSci(C_LIGHT, 2)} m/s`,
        `1 eV = ${J(J_PER_EV)}`,
        `Sprang: n = ${u} → n = ${l}`,
      ]}
      parts={[
        {
          id: 'a',
          text: `Regn ut energien til hydrogenatomet i nivåene ${s.asked.map((n) => `n = ${n}`).join(', ').replace(/, ([^,]*)$/, ' og $1')}. Hva betyr det at energiene er negative?`,
        },
        { id: 'b', text: `Vis at fotonet som sendes ut ved spranget fra n = ${u} til n = ${l}, har energien ${J(ph.E)}.` },
        { id: 'c', text: 'Regn ut bølgelengden til fotonet. Er lyset synlig, og hvilken farge har det i så fall?' },
        {
          id: 'd',
          text: 'Hvor stor er ioniseringsenergien til hydrogen i grunntilstanden, i joule og i elektronvolt? Vis at bare ultrafiolett stråling kan ionisere hydrogenatomer i grunntilstanden.',
        },
        {
          id: 'e',
          text: `Noen av atomene i tåken er i nivå n = ${l}. Hva er den største bølgelengden et foton kan ha og likevel ionisere et slikt atom? Kan synlig lys gjøre det?`,
        },
      ]}
      steps={steps}
      figure={(state) => <HydrogenFigure s={s} state={state} />}
    />
  );
}
