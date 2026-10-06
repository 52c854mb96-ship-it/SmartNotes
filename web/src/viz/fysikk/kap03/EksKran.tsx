import { useState, type ReactNode } from 'react';
import { Figure, Sub, TSub, Txt, VIZ, WorkedExample, fmt, useTextScale, type ExampleStep, type FigureState } from '../../kit';
import {
  Callout,
  Dimension,
  ForceArrow,
  Himmel,
  Landskap,
  SCENE,
  Stoppeklokke,
  Underlag,
  ValueTag,
  alpha,
  useStrokeScale,
  useSvgId,
} from '../../kit/scene';
import { Bygg, Byggeplass, KrokOgLast, Stromvei, Taarnkran, useFigureScale } from './eks-kran-deler';
import { EnergyFlow, flowHeight, flowLabel, kJ3 } from './eks-kran-energi';
import {
  CRANE,
  FACADE_X,
  LIFT_X,
  LOAD_DIMS,
  craneLayout,
  figureSpec,
  hookHeights,
  jibBottom,
  loadBottom,
  lupeArrows,
  lupeMap,
  outerTangents,
  type Circle,
  type CraneLayout,
  type FigureSpec,
} from './eks-kran-scene';
import { CRANE_TASKS, LOAD_TEXT, POWER_PRICE, solveCraneTask, type CraneSolution, type CraneTask } from './model-eks-kran';

/**
 * Eksempeloppgave (3A–3F): en tårnkran løfter en last opp til det øverste dekket på en boligblokk. Kreftene ved jevn
 * fart, arbeidet snordraget gjør og økningen i potensiell energi, tid og effekt, elektrisk energi med virkningsgrad (i
 * kJ og kWh), og hva som skjer med energien når lasta senkes igjen og motoren går som generator. Oppgaven er laget for
 * appen (egen tekst og egne tall) i samme stil som eksamensoppgaver.
 */
export default function EksKran() {
  const [variant, setVariant] = useState(0);
  const task = CRANE_TASKS[variant] ?? CRANE_TASKS[0]!;
  const s = solveCraneTask(task);
  const { m, h, v, eta, etaBack, load } = task;
  const LT = LOAD_TEXT[load];
  const It = LT.it.charAt(0).toUpperCase() + LT.it.slice(1);
  const hTxt = `${fmt(h, h % 1 ? 1 : 0)} m`;
  const vTxt = `${fmt(v, 2)} m/s`;
  const kJ1 = (E: number) => `${fmt(E / 1000, 1)} kJ`;
  const pct = (x: number) => `${fmt(x * 100, 0)} %`;
  const SShown = `${fmt(s.SkNShown, s.SkNDecimals)} kN`;
  const Ep = (
    <>
      E<Sub>p</Sub>
    </>
  );

  const steps: ExampleStep[] = [
    {
      part: 'a',
      title: `Finn kreftene som virker på ${LT.it}`,
      body: (
        <p>
          Bare to ting virker på {LT.it}: jorda, som gir <strong>tyngden G</strong> rett ned, og kroken, som drar rett opp gjennom
          kjettingstroppene. Den kraften kaller vi <strong>snordraget S</strong>. Luftmotstanden er svært liten ved så lav fart, så den ser vi
          bort fra. Tegn G fra tyngdepunktet og S der stroppene drar i {LT.it}.
        </p>
      ),
      tip: 'Tegn bare lasta, og spør: hva berører den, og hva virker på avstand? Kroken berører den (via stroppene), og jorda virker på avstand.',
    },
    {
      part: 'a',
      title: 'Jevn fart betyr at kreftene er like store',
      body: (
        <p>
          {It} går oppover med jevn fart, altså med konstant fart langs en rett linje. Da er akselerasjonen null, og etter Newtons 1. lov er
          summen av kreftene null. Snordraget oppover er derfor like stort som tyngden nedover.
        </p>
      ),
      math: [
        <>ΣF = S − G = 0 ⇒ S = G = mg</>,
        <>
          S = {fmt(m, 0)} kg · 9,81 m/s² = {fmt(s.S, 0)} N = {fmt(s.S / 1000, 2)} kN
        </>,
      ],
      answer: (
        <>
          S = G = {fmt(s.S / 1000, 2)} kN ≈ {SShown}
        </>
      ),
      pitfall: 'Mange tror at S må være større enn G for at lasta skal gå oppover. Det trengs bare et ekstra trekk i starten, for å gi lasta fart. Når farten er jevn, er S = G.',
    },
    {
      part: 'b',
      title: 'Arbeidet snordraget gjør',
      body: (
        <p>
          Arbeid er kraft ganger forflytning langs kraften: W = F · s · cos α. Snordraget peker rett opp, og {LT.it} flytter seg rett opp
          strekningen h = {hTxt}. Vinkelen mellom kraften og forflytningen er da 0°. Tyngden peker motsatt vei av forflytningen, så vinkelen
          er 180°, og tyngden gjør negativt arbeid.
        </p>
      ),
      math: [
        <>
          W<Sub>S</Sub> = S · h · cos 0° = {fmt(s.S, 0)} N · {hTxt} · 1 = {kJ1(s.W)}
        </>,
        <>
          W<Sub>G</Sub> = G · h · cos 180° = −{kJ1(s.W)}
        </>,
      ],
      tip: (
        <>
          Det totale arbeidet er W<Sub>S</Sub> + W<Sub>G</Sub> = 0. Det stemmer med at den kinetiske energien ikke endres når farten er jevn.
        </>
      ),
      pitfall: `Bruk strekningen lasta flytter seg, h = ${hTxt}, ikke høyden på kranen (utliggeren er ${fmt(jibBottom(h), 0)} m over bakken).`,
    },
    {
      part: 'b',
      title: 'Økningen i potensiell energi',
      body: (
        <p>
          Vi legger nullnivået på bakken. Der har {LT.it} {Ep} = 0, og oppe ved dekket {Ep} = mgh. Den kinetiske energien er den samme hele
          veien, fordi farten er jevn. Arbeidet snordraget gjør, er lik endringen i mekanisk energi: W<Sub>S</Sub> = ΔE = Δ{Ep} + ΔE
          <Sub>k</Sub>. Med ΔE<Sub>k</Sub> = 0 blir hele arbeidet potensiell energi.
        </p>
      ),
      math: [
        <>
          Δ{Ep} = mgh − 0 = {fmt(m, 0)} kg · 9,81 m/s² · {hTxt} = {kJ1(s.dEp)}
        </>,
        <>
          W<Sub>S</Sub> = Δ{Ep} + ΔE<Sub>k</Sub> = {kJ1(s.dEp)} + 0 = {kJ1(s.W)}
        </>,
      ],
      answer: (
        <>
          Snordraget gjør arbeidet {kJ3(s.W)} på {LT.it}, og den potensielle energien øker like mye, med {kJ3(s.dEp)}.
        </>
      ),
      tip: `Når løpekatten etterpå kjører ${LT.it} vannrett inn over dekket, gjør snordraget ikke noe arbeid: kraften står da vinkelrett på forflytningen, og cos 90° = 0.`,
    },
    {
      part: 'c',
      title: 'Tida fra høyden og farten',
      body: (
        <p>
          Farten er jevn, så strekningen er fart ganger tid: h = v · t. {It} skal {hTxt} opp med farten {vTxt}.
        </p>
      ),
      math: [
        <>
          t = h / v = {hTxt} / {vTxt} = {fmt(s.t, 1)} s
        </>,
      ],
    },
    {
      part: 'c',
      title: 'Effekten er arbeid per tid',
      body: <p>Effekt er hvor fort arbeidet blir gjort: P = W / t. Arbeidet fant vi i b).</p>,
      math: [
        <>
          P = W / t = {kJ1(s.W)} / {fmt(s.t, 1)} s = {fmt(s.P / 1000, 2)} kW
        </>,
      ],
      answer: (
        <>
          Løftet tar {fmt(s.t, 0)} s, og kranen yter effekten {fmt(s.P / 1000, 1)} kW på {LT.it}.
        </>
      ),
      tip: (
        <>
          Når farten er jevn, kan du også bruke P = F · v: P = S · v = {fmt(s.S, 0)} N · {vTxt} = {fmt(s.PFv / 1000, 2)} kW. Da trenger du
          ikke tida.
        </>
      ),
      pitfall: 'Effekt er ikke arbeid ganger tid. Enheten W = J/s viser at du skal dele arbeidet på tida.',
    },
    {
      part: 'd',
      title: 'Bruk virkningsgraden',
      body: (
        <p>
          Virkningsgraden er andelen av den tilførte energien som blir nyttig: η = E<Sub>nyttig</Sub> / E<Sub>tilført</Sub>. Den nyttige
          energien er arbeidet på {LT.it}, altså økningen i potensiell energi. Den tilførte energien er den elektriske energien motoren bruker.
          Resten blir termisk energi (varme) i motoren, giret og vinsjen.
        </p>
      ),
      math: [
        <>
          E<Sub>el</Sub> = E<Sub>nyttig</Sub> / η = {kJ1(s.W)} / {fmt(eta, 2)} = {kJ1(s.Eel)}
        </>,
        <>
          Varme: E<Sub>el</Sub> − W = {kJ1(s.Eel)} − {kJ1(s.W)} = {kJ1(s.heatUp)}
        </>,
      ],
      pitfall: `Ikke gang med virkningsgraden: ${kJ1(s.W)} · ${fmt(eta, 2)} = ${kJ1(s.wrongEel)} er mindre enn arbeidet. Motoren må bruke mer energi enn den nyttige, ikke mindre.`,
    },
    {
      part: 'd',
      title: 'Gjør om til kilowattimer',
      body: (
        <p>
          Strømregningen regnes i kilowattimer. 1 kWh er energien som blir brukt når effekten 1 kW virker i én time: 1 kWh = 1 000 W · 3 600 s
          = 3,6 · 10⁶ J.
        </p>
      ),
      math: [
        <>
          E<Sub>el</Sub> = {fmt(s.Eel, 0)} J / (3,6 · 10⁶ J/kWh) = {fmt(s.EelKWh, 4)} kWh
        </>,
      ],
      answer: (
        <>
          Kranen bruker {kJ3(s.Eel)} ≈ {fmt(s.EelKWh, 3)} kWh elektrisk energi på løftet.
        </>
      ),
      tip: `Med en strømpris på ${fmt(POWER_PRICE, 2)} kr/kWh koster løftet bare om lag ${fmt(s.costOre, 0)} øre. Den elektriske effekten under løftet er P / η = ${fmt(s.Pel / 1000, 1)} kW.`,
      pitfall: 'kW og kWh er ikke det samme: kW er effekt (energi per tid), kWh er energi.',
    },
    {
      part: 'e',
      title: 'Den mekaniske energien avtar',
      body: (
        <p>
          Farten er jevn, så den kinetiske energien endres ikke. Høyden avtar med h, så den potensielle energien avtar med mgh. Den mekaniske
          energien er altså ikke bevart, den avtar. Årsaken er at snordraget fortsatt peker oppover (S = G, fordi farten er jevn), mens{' '}
          {LT.it} beveger seg nedover. Da gjør snordraget negativt arbeid, og det er lik endringen i mekanisk energi.
        </p>
      ),
      math: [
        <>
          ΔE = Δ{Ep} + ΔE<Sub>k</Sub> = (0 − mgh) + 0 = −{kJ1(s.dEp)}
        </>,
        <>
          W<Sub>S</Sub> = S · h · cos 180° = −{kJ1(s.W)} = ΔE
        </>,
      ],
      pitfall: (
        <>
          Tyngden gjør det positive arbeidet mgh når lasta går ned. Ikke regn med det i tillegg til {Ep}: arbeidet til tyngden er allerede
          med i endringen i potensiell energi.
        </>
      ),
    },
    {
      part: 'e',
      title: 'Hvor blir det av energien?',
      body: (
        <p>
          Energien forsvinner ikke. {It} drar wiren ut av vinsjen, og vinsjen driver motoren rundt. Da virker motoren som generator og lager
          elektrisk energi, som går tilbake til strømnettet. Resten blir termisk energi (varme) i motoren, giret og vinsjen.
        </p>
      ),
      math: [
        <>
          E<Sub>tilbake</Sub> = {fmt(etaBack, 2)} · mgh = {fmt(etaBack, 2)} · {kJ1(s.dEp)} = {kJ1(s.Eback)}
        </>,
        <>
          Varme: {kJ1(s.dEp)} − {kJ1(s.Eback)} = {kJ1(s.heatDown)}
        </>,
      ],
      tip: 'Kraner uten generator bremser lasta med en brems eller en motstand. Da blir hele mgh varme.',
    },
    {
      part: 'e',
      title: 'Netto for turen opp og ned',
      body: (
        <p>
          Kranen brukte E<Sub>el</Sub> fra strømnettet på løftet i d) og sendte E<Sub>tilbake</Sub> tilbake da {LT.it} ble senket. Forskjellen
          er det kranen har brukt netto.
        </p>
      ),
      math: [
        <>
          E<Sub>netto</Sub> = E<Sub>el</Sub> − E<Sub>tilbake</Sub> = {kJ1(s.Eel)} − {kJ1(s.Eback)} = {kJ1(s.net)}
        </>,
        <>
          Kontroll, all varmen: {kJ1(s.heatUp)} + {kJ1(s.heatDown)} = {kJ1(s.heatTotal)}
        </>,
      ],
      answer: (
        <>
          Den mekaniske energien til {LT.it} avtar med {kJ3(s.dEp)}, fordi snordraget gjør negativt arbeid. {pct(etaBack)} av energien,{' '}
          {kJ3(s.Eback)}, går tilbake til nettet, og resten blir varme. Netto har kranen brukt {kJ3(s.net)} på turen opp og ned.
        </>
      ),
      tip: `${It} er tilbake der den startet og har like mye mekanisk energi som før. Hele nettoforbruket er derfor blitt termisk energi (varme), og det viser kontrollen.`,
    },
  ];

  return (
    <WorkedExample
      variants={{ labels: ['Tallsett 1', 'Tallsett 2', 'Tallsett 3'], value: variant, onChange: setVariant }}
      intro={
        <p>
          På en byggeplass løfter en tårnkran {LT.what} fra bakken og opp til det øverste dekket på en ny boligblokk, {hTxt} over bakken.{' '}
          {It} har massen {fmt(m, 0)} kg, og kranen løfter med den jevne farten {vTxt}. En elektrisk heisemotor driver vinsjen som spoler inn
          wiren, og virkningsgraden for motoren, giret og vinsjen er til sammen {pct(eta)}. Se bort fra den korte tida {LT.it} akselererer i
          starten og bremser på toppen, og fra luftmotstanden.
        </p>
      }
      given={[
        <>m = {fmt(m, 0)} kg</>,
        <>h = {hTxt}</>,
        <>v = {vTxt}</>,
        <>η = {pct(eta)}</>,
      ]}
      parts={[
        { id: 'a', text: `Tegn kreftene som virker på ${LT.it} mens den løftes, og vis at snordraget S fra kroken er om lag ${SShown}.` },
        { id: 'b', text: `Hvor stort arbeid gjør snordraget på ${LT.it} under løftet? Hvor mye øker den potensielle energien til ${LT.it}?` },
        { id: 'c', text: `Hvor lang tid tar løftet, og hvor stor effekt yter kranen på ${LT.it}?` },
        { id: 'd', text: 'Hvor mye elektrisk energi bruker kranen på løftet? Gi svaret i kilojoule og i kilowattimer.' },
        {
          id: 'e',
          text: `Anta at ${LT.it} senkes ned til bakken igjen med jevn fart. Forklar hva som skjer med den mekaniske energien til ${LT.it}. Motoren virker da som generator og sender ${pct(etaBack)} av den mekaniske energien ${LT.it} mister, tilbake til strømnettet. Hvor mye elektrisk energi har kranen brukt netto på turen opp og ned?`,
        },
      ]}
      steps={steps}
      figure={(state) => <CraneFigure task={task} s={s} state={state} />}
    />
  );
}

/* ---------- Figuren ---------- */

function CraneFigure({ task, s, state }: { task: CraneTask; s: CraneSolution; state: FigureState }) {
  const { ref, f, narrow } = useFigureScale<HTMLDivElement>();
  const spec = figureSpec(state.step, state.showAll);
  const L = craneLayout(task, { narrow, f });
  const flowH = spec.energy ? flowHeight(spec.energy, f) : 0;
  return (
    <div ref={ref} style={{ display: 'grid', gap: 10 }}>
      <Figure viewBox={`0 0 ${L.W} ${Math.round(L.H)}`} label={sceneLabel(task, s, spec)} maxHeight={narrow ? 900 : 540}>
        <CraneScene task={task} s={s} spec={spec} L={L} />
      </Figure>
      {spec.energy && (
        <Figure viewBox={`0 0 800 ${Math.round(flowH)}`} label={flowLabel(s, spec.energy)} maxHeight={narrow ? 900 : 420}>
          <EnergyFlow task={task} s={s} stage={spec.energy} f={f} />
        </Figure>
      )}
    </div>
  );
}

function sceneLabel(task: CraneTask, s: CraneSolution, spec: FigureSpec): string {
  const what = LOAD_TEXT[task.load].short;
  const where =
    spec.spot === 'ground' ? 'står på bakken' : spec.spot === 'top' ? 'henger oppe ved dekket' : spec.dir === 'down' ? 'er på vei ned' : 'er på vei opp';
  const forces = spec.lupe ? ` Lupen viser kreftene på lasta: snordraget S opp og tyngden G ned, like store (${fmt(s.S / 1000, 2)} kN).` : '';
  return `En tårnkran på en byggeplass. ${what.charAt(0).toUpperCase() + what.slice(1)} ${where}. Dekket på bygget er ${fmt(task.h, task.h % 1 ? 1 : 0)} m over bakken.${forces}`;
}

function CraneScene({ task, s, spec, L }: { task: CraneTask; s: CraneSolution; spec: FigureSpec; L: CraneLayout }) {
  const ss = useStrokeScale();
  const { X, Y, ppm: p, groundY, W, H, f, k } = L;
  const dims = LOAD_DIMS[task.load];
  const halfW = dims.w / 2;
  const bottom = loadBottom(spec.spot, task.h);
  const jb = jibBottom(task.h);
  const xL = X(LIFT_X);
  const xDim = X(LIFT_X - halfW - 0.9);
  const centerY = Y(bottom + dims.h / 2);
  const ghostBottom = spec.ghost ? loadBottom(spec.ghost, task.h) : null;
  const ring: Circle = {
    x: xL,
    y: Y(bottom + dims.h / 2 + 0.35),
    r: Math.max(13 * k, (halfW + 0.45) * p),
  };
  // Vinsjen på motutliggeren (samme mål som i Taarnkran)
  const drum = { x: X(-4.1), y: Y(jb + 0.75 + 0.6) };
  const calloutX = X(-1.3);
  const vLen = 36 * k;
  const hTxt = `${fmt(task.h, task.h % 1 ? 1 : 0)} m`;
  // Etiketten til høyden står til venstre for mållinja når den får plass mellom tårnet og linja, ellers til høyre.
  const dimText = `h = ${hTxt}`;
  const dimLeft = xDim - 8 * f - dimText.length * 17 * f * 0.9 * 0.6 > X(CRANE.mastW / 2) + 6;
  // Skiltet over lupen: S = G i a) og e), P = S · v i c). Holdes innenfor figuren (teksten er stor på mobil).
  const tagText = spec.power ? `P = S · v = ${fmt(s.P / 1000, 2)} kW` : spec.values ? `S = G = ${fmt(s.S / 1000, 2)} kN` : null;
  const lupeTag = tagText ? { text: tagText, x: clampTag(L.lupeTag.x, tagText, f, W) } : null;

  return (
    <g>
      <Himmel x={0} y={0} w={W} h={L.horizonY + 2} skyer={2} seed={5} />
      <Landskap x={0} y={L.horizonY} w={W} h={narrow(L) ? 80 : 62} type="by" seed={3} />
      <Underlag x1={0} x2={W} y={groundY} depth={H - groundY} type="grus" horisont={L.horizonY} seed={2} />
      <Bygg L={L} h={task.h} />
      <Byggeplass L={L} load={task.load} />
      <Taarnkran L={L} h={task.h} trolleyX={LIFT_X} />
      {spec.supply && <Stromvei L={L} h={task.h} color={VIZ.applied} />}

      {/* Der lasta var, og banen den går */}
      {ghostBottom !== null && <KrokOgLast load={task.load} x={xL} bottom={ghostBottom} p={p} Ym={Y} ghost />}
      {spec.path && (
        <line
          x1={xL}
          x2={xL}
          y1={Y(dims.h + 0.2)}
          y2={Y(task.h - 0.2)}
          stroke={VIZ.muted}
          strokeWidth={1.4 * ss}
          strokeDasharray={`${5 * ss} ${4 * ss}`}
          opacity={0.8}
        />
      )}
      <KrokOgLast load={task.load} x={xL} bottom={bottom} p={p} Ym={Y} wireTop={jb - 0.55} shadow={bottom === 0} />

      {/* Høyden h fra bakken til dekket */}
      {spec.height && (
        <>
          <Dimension x1={xDim} y1={Y(0)} x2={xDim} y2={Y(task.h)} />
          <Txt x={dimLeft ? xDim - 8 * f : xDim + 8 * f} y={Y(0.72 * task.h) + 6 * f} anchor={dimLeft ? 'end' : 'start'} size={0.9} weight={650}>
            {dimText}
          </Txt>
        </>
      )}

      {/* Nullnivået og den potensielle energien */}
      {spec.ep && (
        <>
          <line
            x1={X(LIFT_X - halfW - 1.5)}
            x2={X(FACADE_X)}
            y1={groundY}
            y2={groundY}
            stroke={VIZ.ink}
            strokeWidth={1.4 * ss}
            strokeDasharray={`${6 * ss} ${4 * ss}`}
            opacity={0.75}
          />
          <Txt x={X(FACADE_X) + 5 * k} y={groundY - 5 * k} anchor="start" size={0.75} weight={650}>
            nullnivå
          </Txt>
          <EnergyTag x={X(LIFT_X + halfW + 0.8)} y={Y(task.h + 2.7)} anchor="start" color={VIZ.gravity}>
            E<TSub>p</TSub> = mgh = {kJ3(s.dEp)}
          </EnergyTag>
          {/* På mobil står lupen der skiltet ville stått, så da viser bare nullnivået at E_p = 0 ved bakken. */}
          {(spec.ghost === 'ground' || spec.spot === 'ground' || spec.dir === 'down') && !(L.narrow && spec.lupe) && (
            <EnergyTag x={X(LIFT_X + halfW + 0.8)} y={Y(3.4) - 4 * k} anchor="start" color={VIZ.gravity}>
              E<TSub>p</TSub> = 0
            </EnergyTag>
          )}
        </>
      )}

      {/* Farten og tida (c) */}
      {spec.velocity && spec.dir && !spec.lupe && (
        <ForceArrow
          x1={X(LIFT_X + halfW + 0.7)}
          y1={centerY + (spec.dir === 'up' ? vLen / 2 : -vLen / 2)}
          x2={X(LIFT_X + halfW + 0.7)}
          y2={centerY + (spec.dir === 'up' ? -vLen / 2 : vLen / 2)}
          color={VIZ.velocity}
          width={6}
          label="v"
        />
      )}
      {spec.clock && <ClockCard c={L.clock} t={s.t} v={task.v} narrow={L.narrow} />}

      {/* Vinsjen: effekten (c) og generatoren (e) */}
      {(spec.power || spec.generator) && (
        <Callout x={drum.x} y={drum.y} lx={calloutX} ly={Y(jb - 3.6)} anchor="end" strong>
          {spec.generator ? 'Generator' : 'Heisevinsj'}
        </Callout>
      )}

      {/* Strømmen kommer fra byggestrømskapet (d) */}
      {spec.supply && (
        <Callout x={X(-2.85)} y={Y(1.6)} lx={X(-1.6)} ly={Y(8.2)} anchor="end" strong color={VIZ.applied}>
          Byggestrøm
        </Callout>
      )}

      {/* Lupen med kreftene */}
      {spec.lupe && <Lupe lupe={L.lupe} ring={ring} task={task} dir={spec.dir} />}
      {spec.lupe && lupeTag && <ValueTag x={lupeTag.x} y={L.lupeTag.y} text={lupeTag.text} color={VIZ.ink} />}
    </g>
  );
}

const narrow = (L: CraneLayout) => L.narrow;

/** Midten av et ValueTag-skilt flyttes inn så hele skiltet er innenfor figuren (samme bredde som i ValueTag). */
function clampTag(x: number, text: string, f: number, W: number): number {
  const fs = 17 * f * 0.9;
  const w = Math.max(fs * 1.6, text.length * fs * 0.6 + 16 * f);
  return Math.min(Math.max(x, w / 2 + 8), W - w / 2 - 8);
}

/** Lite skilt med tekst som kan ha senket skrift (ValueTag tar bare ren tekst). Bredden anslås fra teksten. */
function EnergyTag({ x, y, anchor, color, children }: { x: number; y: number; anchor: 'start' | 'middle' | 'end'; color: string; children: ReactNode }) {
  const ss = useStrokeScale();
  const f = useTextScale();
  const chars = textLength(children);
  const fs = 17 * f * 0.9;
  const w = chars * fs * 0.58 + 18 * f;
  const h = fs * 1.6;
  const left = anchor === 'middle' ? x - w / 2 : anchor === 'start' ? x : x - w;
  return (
    <g>
      <rect x={left} y={y - h / 2} width={w} height={h} rx={h * 0.3} fill={VIZ.surface} stroke={SCENE.outline} strokeWidth={1 * ss} opacity={0.96} />
      <Txt x={left + w / 2} y={y + fs * 0.34} anchor="middle" size={0.9} weight={700} color={color} halo={false}>
        {children}
      </Txt>
    </g>
  );
}

/** Antall tegn i en tekst med <TSub> (omtrent). */
function textLength(node: ReactNode): number {
  if (node === null || node === undefined || typeof node === 'boolean') return 0;
  if (typeof node === 'string' || typeof node === 'number') return String(node).length;
  if (Array.isArray(node)) return node.reduce<number>((n, c) => n + textLength(c as ReactNode), 0);
  if (typeof node === 'object' && 'props' in node) return textLength((node.props as { children?: ReactNode }).children) * 0.8;
  return 0;
}

/**
 * Kort med stoppeklokka i c): farten v (oppgitt) og tida t = h / v. På PC står klokka til venstre for tallene, på
 * mobil over dem, så kortet får plass på fasaden.
 */
function ClockCard({ c, t, v, narrow }: { c: Circle; t: number; v: number; narrow: boolean }) {
  const ss = useStrokeScale();
  const f = useTextScale();
  const pad = 12 * f;
  const tText = `t = ${fmt(t, 1)} s`;
  const vText = `v = ${fmt(v, 2)} m/s`;
  const textW = Math.max(tText.length * 17 * f * 1.2 * 0.6, vText.length * 17 * f * 0.9 * 0.6);
  const r = c.r * 0.92;
  if (narrow) {
    const w = Math.max(2 * r, textW) + 2 * pad;
    const h = pad + 2.3 * r + 2 * 26 * f + pad;
    const top = c.y - h / 2;
    return (
      <g>
        <rect x={c.x - w / 2} y={top} width={w} height={h} rx={12} fill={VIZ.surface} opacity={0.95} stroke={SCENE.outline} strokeWidth={0.8 * ss} />
        <Stoppeklokke x={c.x} y={top + pad + 1.3 * r} r={r} t={t} digital={false} />
        <Txt x={c.x} y={top + pad + 2.3 * r + 22 * f} anchor="middle" size={0.9} weight={700} color={VIZ.velocity}>
          {vText}
        </Txt>
        <Txt x={c.x} y={top + pad + 2.3 * r + 48 * f} anchor="middle" size={1.2} weight={760} color={VIZ.ink}>
          {tText}
        </Txt>
      </g>
    );
  }
  const w = pad + 2 * r + pad + textW + pad;
  const h = 2.3 * r + 2 * pad;
  const left = c.x - w / 2;
  const tx = left + pad + 2 * r + pad;
  return (
    <g>
      <rect x={left} y={c.y - h / 2} width={w} height={h} rx={12} fill={VIZ.surface} opacity={0.95} stroke={SCENE.outline} strokeWidth={0.8 * ss} />
      <Stoppeklokke x={left + pad + r} y={c.y + 0.2 * r} r={r} t={t} digital={false} />
      <Txt x={tx} y={c.y - 6 * f} anchor="start" size={0.9} weight={700} color={VIZ.velocity}>
        {vText}
      </Txt>
      <Txt x={tx} y={c.y + 24 * f} anchor="start" size={1.2} weight={760} color={VIZ.ink}>
        {tText}
      </Txt>
    </g>
  );
}

/**
 * Lupen: et forstørret utsnitt av lasta med kroken og stroppene, tyngden G, snordraget S og farten v. Ringen rundt
 * lasta i scenen og to streker viser hvor utsnittet er tatt.
 */
function Lupe({ lupe, ring, task, dir }: { lupe: Circle; ring: Circle; task: CraneTask; dir: 'up' | 'down' | null }) {
  const ss = useStrokeScale();
  const clip = useSvgId('kran-lupe');
  const { Z, cx, cy } = lupeMap(lupe, task.load);
  const dims = LOAD_DIMS[task.load];
  const Ym = (m: number) => cy + (dims.h / 2 - m) * Z;
  const A = lupeArrows(lupe, task.load, dir);
  const t = outerTangents(ring, lupe);
  const hh = hookHeights(task.load, 0);
  return (
    <g>
      {/* Ringen rundt lasta og strekene ut til lupen */}
      <g aria-hidden>
        {t?.map(([a, b], i) => (
          <g key={i}>
            <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={VIZ.surface} strokeWidth={3.2 * ss} strokeLinecap="round" opacity={0.6} />
            <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={VIZ.ink} strokeWidth={1 * ss} strokeLinecap="round" opacity={0.5} />
          </g>
        ))}
        <circle cx={ring.x} cy={ring.y} r={ring.r} fill="none" stroke={VIZ.surface} strokeWidth={4 * ss} opacity={0.75} />
        <circle cx={ring.x} cy={ring.y} r={ring.r} fill="none" stroke={VIZ.ink} strokeWidth={1.4 * ss} opacity={0.75} />
      </g>
      <circle cx={lupe.x + 2.5} cy={lupe.y + 4} r={lupe.r + 3} fill={SCENE.shadow} opacity={0.22} />
      <defs>
        <clipPath id={clip}>
          <circle cx={lupe.x} cy={lupe.y} r={lupe.r} />
        </clipPath>
      </defs>
      <g clipPath={`url(#${clip})`}>
        <Himmel x={lupe.x - lupe.r} y={lupe.y - lupe.r} w={2 * lupe.r} h={2 * lupe.r} skyer={1} seed={9} />
        <KrokOgLast load={task.load} x={cx} bottom={0} p={Z} Ym={Ym} wireTop={hh.blockTop + 3} />
      </g>
      <circle cx={lupe.x} cy={lupe.y} r={lupe.r} fill="none" stroke={VIZ.surface} strokeWidth={6 * ss} />
      <circle cx={lupe.x} cy={lupe.y} r={lupe.r + 3 * ss} fill="none" stroke={alpha(VIZ.ink, 0.45)} strokeWidth={1.3 * ss} />
      <circle cx={lupe.x} cy={lupe.y} r={lupe.r - 3 * ss} fill="none" stroke={SCENE.outline} strokeWidth={0.8 * ss} opacity={0.6} />
      <ForceArrow {...A.S} color={VIZ.tension} label="S" labelX={A.S.x2 - 12 * ss} labelY={A.S.y2 + 16} labelAnchor="end" />
      <ForceArrow {...A.G} color={VIZ.gravity} label="G" labelX={A.G.x2 - 12 * ss} labelY={A.G.y2 - 2} labelAnchor="end" origin />
      {dir && <ForceArrow {...A.v} color={VIZ.velocity} width={5} label="v" />}
    </g>
  );
}
