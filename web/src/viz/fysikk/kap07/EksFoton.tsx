import { useState } from 'react';
import { Sub, WorkedExample, fmt, fmtSci, type ExampleStep } from '../../kit';
import { PhotonFigure } from './eks-foton-figur';
import { C_LIGHT, H_PLANCK, J_PER_EV, PHOTON_TASKS, UVB_MAX, UVB_MIN, VISIBLE_MIN, solvePhotonTask } from './model-eks-foton';

/**
 * Eksempeloppgave (7C): fotoner fra en rød og en grønn laserpeker. Fotonenergien fra bølgelengden (E = hf = hc/λ),
 * omregning til elektronvolt, antall fotoner per sekund fra effekten (N = P/E), sammenligning av rødt og grønt lys med
 * samme effekt, og hvorfor UV-B-stråling kan skade DNA i huden når synlig lys ikke kan: det er energien per foton som
 * avgjør. Oppgaven er laget for appen (egen tekst og egne tall) i samme stil som eksamensoppgaver i Fysikk 1.
 *
 * Alle tall kommer fra solvePhotonTask (model-eks-foton.ts). Fotonenergiene vises med tre gjeldende siffer i svarene og
 * fire i mellomregningene, så hver linje går opp med tallene fra linja over (testet for alle tallsettene).
 */

/** Energi i joule: tre gjeldende siffer (svar) eller fire (`d = 3`, mellomsvar). */
const J = (v: number, d = 2) => `${fmtSci(v, d)} J`;
const eV = (v: number) => `${fmt(v, 2)} eV`;
/** Antall fotoner per sekund: to gjeldende siffer (svar) eller fire (`d = 3`). */
const N = (v: number, d = 1) => fmtSci(v, d);
/** Bølgelengden i meter med tre gjeldende siffer: «6,50 · 10⁻⁷ m». */
const m = (lambda: number) => `${fmtSci(lambda, 2)} m`;

export default function EksFoton() {
  const [variant, setVariant] = useState(0);
  const task = PHOTON_TASKS[variant] ?? PHOTON_TASKS[0]!;
  const s = solvePhotonTask(task);
  const { red, green, uv } = s;
  const nmR = `${fmt(red.nm, 0)} nm`;
  const nmG = `${fmt(green.nm, 0)} nm`;
  const nmU = `${fmt(uv.nm, 0)} nm`;
  const mW = `${fmt(task.P * 1e3, task.P >= 1e-3 ? 1 : 2)} mW`;
  const PW = `${fmtSci(task.P, 1)} W`;
  const PJs = `${fmtSci(task.P, 1)} J/s`;
  const hc = `${fmtSci(H_PLANCK, 2)} J s · ${fmtSci(C_LIGHT, 2)} m/s`;
  const eVJ = `${fmtSci(J_PER_EV, 2)} J/eV`;
  const minEV = `${fmt(task.damageEV, 1)} eV`;
  const maxNm = `${fmt(s.maxNm, 0)} nm`;

  const E = (sub: string) => (
    <>
      E<Sub>{sub}</Sub>
    </>
  );
  const Nn = (sub: string) => (
    <>
      N<Sub>{sub}</Sub>
    </>
  );
  const lam = (sub: string) => (
    <>
      λ<Sub>{sub}</Sub>
    </>
  );

  const steps: ExampleStep[] = [
    {
      part: 'a',
      title: 'Fotonenergien fra bølgelengden',
      body: (
        <p>
          Laserlyset består av fotoner, små pakker med energi. Ett foton har energien E = hf. Vi kjenner bølgelengden, ikke frekvensen, men for
          lys er c = fλ, så f = c/λ. Setter vi det inn, får vi E = hc/λ. Bølgelengden må stå i meter: 1 nm = 10⁻⁹ m.
        </p>
      ),
      math: [
        <>E = hf = hc / λ</>,
        <>
          λ = {nmR} = {m(red.lambda)}
        </>,
        <>
          {E('rød')} = ({hc}) / ({m(red.lambda)}) = {J(red.E, 3)}
        </>,
      ],
      tip: (
        <>
          Produktet hc = {fmtSci(H_PLANCK * C_LIGHT, 3)} J m er det samme for alle fotoner. Regn det ut én gang, så går resten av oppgaven
          raskere.
        </>
      ),
      pitfall: `Glemt å gjøre nanometer om til meter. Setter du inn λ = ${fmt(red.nm, 0)}, blir energien en milliard ganger for liten.`,
    },
    {
      part: 'a',
      title: 'Gjør om til elektronvolt',
      body: (
        <p>
          Fotonenergier oppgis ofte i elektronvolt (eV), fordi tallene blir enkle å sammenligne. Ett elektronvolt er energien et elektron får
          når det akselereres gjennom en spenning på 1 V: 1 eV = {J(J_PER_EV)}. Vi deler derfor energien i joule på antall joule per
          elektronvolt.
        </p>
      ),
      math: [
        <>
          {E('rød')} = {J(red.E, 3)} / ({eVJ}) = {eV(red.eV)}
        </>,
      ],
      answer: (
        <>
          {E('rød')} = {J(red.E)}, som skulle vises. Det er {eV(red.eV)}.
        </>
      ),
      tip: 'Et elektron som går gjennom et vanlig AA-batteri på 1,5 V, får 1,5 eV. Ett foton med rødt lys har altså omtrent like mye energi.',
    },
    {
      part: 'b',
      title: 'Effekten er energi per sekund',
      body: (
        <p>
          Effekten forteller hvor mye energi laserpekeren sender ut hvert sekund: P = E/t. Med P = {mW} = {PW} sender den ut {fmtSci(task.P, 1)}{' '}
          J lysenergi hvert sekund. Hvert foton har energien fra a), så antall fotoner per sekund er effekten delt på energien til ett foton.
        </p>
      ),
      math: [
        <>
          P = {mW} = {PW} = {PJs}
        </>,
        <>
          {Nn('rød')} = P / {E('rød')} = ({PJs}) / ({J(red.E, 3)}) = {N(red.N, 3)} per sekund
        </>,
      ],
      answer: <>Den røde laserpekeren sender ut ca. {N(red.N)} fotoner per sekund.</>,
      tip: 'En billiard er 10¹⁵, så det er flere billiarder fotoner hvert sekund. Så mange små energipakker merker vi som en jevn lysstråle, og derfor ser vi ikke at lyset kommer i porsjoner.',
      pitfall: `${mW} er ${PW}, ikke ${fmt(task.P * 1e3, task.P >= 1e-3 ? 1 : 2)} W. Milli betyr tusendel.`,
    },
    {
      part: 'c',
      title: 'Regn ut det samme for den grønne laserpekeren',
      body: (
        <p>
          Grønt lys har kortere bølgelengde enn rødt. Siden E = hc/λ, har hvert grønt foton mer energi. Effekten er den samme, så den samme
          energien per sekund fordeles på færre fotoner.
        </p>
      ),
      math: [
        <>
          {E('grønn')} = ({hc}) / ({m(green.lambda)}) = {J(green.E, 3)} = {eV(green.eV)}
        </>,
        <>
          {Nn('grønn')} = P / {E('grønn')} = ({PJs}) / ({J(green.E, 3)}) = {N(green.N, 3)} per sekund
        </>,
      ],
    },
    {
      part: 'c',
      title: 'Sammenlign med forholdstall',
      body: (
        <p>
          Fordi E = hc/λ, er forholdet mellom fotonenergiene det omvendte av forholdet mellom bølgelengdene. Antallet er N = P/E, og P er den
          samme, så forholdet mellom antallene snur igjen.
        </p>
      ),
      math: [
        <>
          {E('grønn')} / {E('rød')} = {lam('rød')} / {lam('grønn')} = {nmR} / {nmG} = {fmt(s.ratioE, 3)}
        </>,
        <>
          {Nn('grønn')} / {Nn('rød')} = {lam('grønn')} / {lam('rød')} = {nmG} / {nmR} = {fmt(s.ratioN, 3)}
        </>,
      ],
      answer: (
        <>
          Hvert grønt foton har {s.morePct} % mer energi enn et rødt ({eV(green.eV)} mot {eV(red.eV)}). Med samme effekt sender den grønne
          laserpekeren derfor {s.fewerPct} % færre fotoner per sekund: {N(green.N)} mot {N(red.N)}.
        </>
      ),
      tip: 'Den grønne prikken ser likevel mye sterkere ut enn den røde. Det har ingenting med fotonenergien å gjøre: øyet er mest følsomt for grønt lys.',
      pitfall: (
        <>
          {s.morePct} % mer energi per foton gir ikke {s.morePct} % færre fotoner. Antallet blir 1 / {fmt(s.ratioE, 3)} = {fmt(1 / s.ratioE, 3)}{' '}
          av det røde, altså {s.fewerPct} % færre.
        </>
      ),
    },
    {
      part: 'd',
      title: 'Energien til ett UV-B-foton',
      body: (
        <p>
          Vi regner ut fotonenergien for UV-B-strålingen på samme måte og sammenligner med de {minEV} som trengs for å skade et DNA-molekyl.
          Det er energien til ett foton vi sammenligner, fordi hvert foton blir tatt opp av ett molekyl.
        </p>
      ),
      math: [
        <>
          {E('UV')} = ({hc}) / ({m(uv.lambda)}) = {J(uv.E, 3)}
        </>,
        <>
          {E('UV')} = {J(uv.E, 3)} / ({eVJ}) = {eV(uv.eV)}
        </>,
        <>
          {E('rød')} = {eV(red.eV)} &lt; {E('grønn')} = {eV(green.eV)} &lt; {minEV} &lt; {E('UV')} = {eV(uv.eV)}
        </>,
      ],
      tip: 'Vanlig vindusglass slipper gjennom synlig lys, men stopper nesten all UV-B. Derfor blir du ikke solbrent av å sitte inne bak et vindu.',
    },
    {
      part: 'd',
      title: 'Den største bølgelengden som kan skade DNA',
      body: (
        <p>
          Fotonenergien E = hc/λ blir mindre jo lengre bølgelengden er. Grensen går der fotonenergien er nøyaktig {minEV}. Vi gjør om til
          joule og løser E = hc/λ med hensyn på λ.
        </p>
      ),
      math: [
        <>
          {E('min')} = {minEV} · {eVJ} = {J(s.damageJ)}
        </>,
        <>
          {lam('maks')} = hc / {E('min')} = ({hc}) / ({J(s.damageJ)}) = {fmtSci(s.maxNm * 1e-9, 3)} m = {maxNm}
        </>,
      ],
      answer: (
        <>
          Et UV-B-foton på {nmU} har {eV(uv.eV)}, mer enn {minEV}, og kan skade DNA, mens fotonene fra laserpekerne bare har {eV(red.eV)} og{' '}
          {eV(green.eV)}, som skulle vises. Den største bølgelengden som kan gi skade, er {maxNm}. Det er ultrafiolett stråling.
        </>
      ),
      tip: `Grensen ${maxNm} ligger nesten nøyaktig der UV-B (${UVB_MIN}–${UVB_MAX} nm) går over i UV-A. Det er UV-B som gjør oss solbrent.`,
      pitfall: 'Grensen er en største bølgelengde, ikke en minste. Kortere bølgelengde gir mer energi per foton.',
    },
    {
      part: 'e',
      title: 'Ett foton gir energien sin til ett molekyl',
      body: (
        <p>
          Lys blir tatt opp ett foton om gangen, og hvert foton gir hele energien sin til ett molekyl. Et DNA-molekyl som tar opp et foton
          med synlig lys, får under {minEV}. Det er for lite til å bryte en binding, så energien blir bare til litt varme. Energien fra flere
          fotoner samler seg ikke i den samme bindingen.
        </p>
      ),
      math: [
        <>
          Synlig lys: {E('foton')} ≤ hc / {VISIBLE_MIN} nm = {eV(s.visibleMaxEV)} &lt; {minEV} ⇒ bare varme
        </>,
        <>
          UV-B: {E('foton')} = {eV(uv.eV)} &gt; {minEV} ⇒ kan bryte en binding
        </>,
      ],
      pitfall: (
        <>
          Det hjelper ikke at {s.redNeeded} røde fotoner til sammen har {s.redNeeded} · {eV(red.eV)} = {eV(s.redNeeded * red.eV)}. Hvert foton
          blir tatt opp alene, og ett rødt foton har bare {eV(red.eV)}.
        </>
      ),
    },
    {
      part: 'e',
      title: 'Mer lys gir flere fotoner, ikke større fotoner',
      body: (
        <p>
          Sterkere synlig lys betyr flere fotoner per sekund, men hvert foton har like lite energi som før. Da blir huden varmere, men ingen
          DNA-molekyler blir skadet. Selv en UV-B-kilde med samme effekt som laserpekeren sender ut færre fotoner enn den røde, men hvert av
          dem har nok energi til å skade et DNA-molekyl.
        </p>
      ),
      math: [
        <>
          {Nn('UV')} = P / {E('UV')} = ({PJs}) / ({J(uv.E, 3)}) = {N(uv.N)} per sekund
        </>,
        <>
          {Nn('UV')} &lt; {Nn('rød')} = {N(red.N)} per sekund
        </>,
      ],
      answer: (
        <>
          Det er energien per foton, ikke den totale energien, som avgjør om DNA kan bli skadet. Hvert UV-B-foton har over {minEV} og kan
          skade et DNA-molekyl. Fotonene i synlig lys har under {minEV}, og da hjelper det ikke hvor mange de er: mer synlig lys gjør bare
          huden varmere.
        </>
      ),
      tip: 'En laserpeker kan likevel skade øynene, men på en annen måte: linsen i øyet samler lyset i en bitte liten flekk på netthinnen, og flekken kan bli brent av varmen. Se aldri inn i en laser, og pek aldri mot andre.',
    },
  ];

  return (
    <WorkedExample
      variants={{ labels: ['Tallsett 1', 'Tallsett 2', 'Tallsett 3'], value: variant, onChange: setVariant }}
      intro={
        <>
          <p>
            En elevgruppe undersøker to laserpekere på fysikklaben. På den røde står det at bølgelengden er {nmR}, og på den grønne at den er{' '}
            {nmG}. Begge sender ut lys med effekten {mW}.
          </p>
          <p>
            Om sommeren blir mange solbrent. Det er ultrafiolett stråling av typen UV-B, med bølgelengder fra {UVB_MIN} nm til {UVB_MAX} nm,
            som gjør oss solbrent, fordi den kan skade DNA i hudcellene. Anta at ett foton må ha minst energien {minEV} for å skade et
            DNA-molekyl.
          </p>
        </>
      }
      given={[
        <>
          {lam('rød')} = {nmR}
        </>,
        <>
          {lam('grønn')} = {nmG}
        </>,
        <>P = {mW} (begge)</>,
        <>
          {lam('UV')} = {nmU}
        </>,
        <>
          {E('min')} = {minEV}
        </>,
        `h = ${fmtSci(H_PLANCK, 2)} J s`,
        `c = ${fmtSci(C_LIGHT, 2)} m/s`,
        `1 eV = ${J(J_PER_EV)}`,
      ]}
      parts={[
        { id: 'a', text: `Vis at et foton fra den røde laserpekeren har energien ${J(red.E)}. Hvor stor er energien i elektronvolt?` },
        { id: 'b', text: 'Hvor mange fotoner sender den røde laserpekeren ut per sekund?' },
        {
          id: 'c',
          text: 'Sammenlign energien per foton og antallet fotoner per sekund for den grønne og den røde laserpekeren. Oppgi forskjellene i prosent.',
        },
        {
          id: 'd',
          text: `Vis at et UV-B-foton med bølgelengden ${nmU} kan skade DNA, men at fotonene fra laserpekerne ikke kan det. Hva er den største bølgelengden som kan gi slik skade?`,
        },
        {
          id: 'e',
          text: 'Om sommeren treffer det mye mer energi fra synlig lys enn fra UV-B-stråling på huden. Forklar hvorfor det likevel er UV-B-strålingen som gjør oss solbrent.',
        },
      ]}
      steps={steps}
      figure={(state) => <PhotonFigure s={s} state={state} />}
    />
  );
}
