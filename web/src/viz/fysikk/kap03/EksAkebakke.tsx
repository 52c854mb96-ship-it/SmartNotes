import { Fragment, useState, type ReactNode } from 'react';
import { Figure, Sub, TSub, Txt, VIZ, WorkedExample, fmt, type ExampleStep, type FigureState } from '../../kit';
import { Callout, Dimension, ForceArrow, Gran, Himmel, Landskap, Terreng, ValueTag } from '../../kit/scene';
import { Aker, EnergyLedger, HeatTrack, PointMark, SlopeAngle, useFigureScale, type RiderLook } from './eks-akebakke-deler';
import {
  COM_HEIGHT,
  SLED_LENGTH,
  figureSpec,
  framePoint,
  ledgerHeight,
  ledgerRows,
  sceneLayout,
  speedArrow,
  speedMid,
  speedOnFlat,
  spotFrame,
  tagCenter,
  terrainPoints,
  type FigureSpec,
  type SceneLayout,
  type Spot,
} from './eks-akebakke-scene';
import { SLED_TASKS, sigDecimals, solveSledTask, type SledSolution, type SledTask } from './model-eks-akebakke';

/** Utseendet til akeren i hvert tallsett (ingen farger som ligner på VIZ-fargene for E_p, E_k og friksjon). */
const LOOKS: RiderLook[] = [
  { brett: 'rod', jakke: 'gul', lue: 'blaa' },
  { brett: 'blaa', jakke: 'rod', lue: 'graa' },
  { brett: 'gronn', jakke: 'blaa', lue: 'rod' },
];

/**
 * Eksempeloppgave (3B–3F): en aker på et akebrett ned en bakke og ut på flaten. Energibevaring uten friksjon, den
 * målte farten og energien som er blitt termisk energi, gjennomsnittlig friksjonskraft fra W = ΔE = −R · s,
 * glidestrekningen på flaten og en vurdering av luftmotstanden. Oppgaven er laget for appen (egen tekst og egne tall)
 * i samme stil som eksamensoppgaver.
 */
export default function EksAkebakke() {
  const [variant, setVariant] = useState(0);
  const task = SLED_TASKS[variant] ?? SLED_TASKS[0]!;
  const look = LOOKS[variant] ?? LOOKS[0]!;
  const s = solveSledTask(task);
  const { name, pronoun, m, h, s: len, v0, vB, mu } = task;
  const vShown = fmt(s.vIdealShown, sigDecimals(s.vIdeal, 2));
  const J = (E: number) => `${fmt(E, 0)} J`;
  const pct = (x: number) => `${fmt(x * 100, 0)} %`;
  const deg = `${fmt(s.alphaDeg, 1)}°`;

  const steps: ExampleStep[] = [
    {
      part: 'a',
      title: 'Velg nullnivå og finn den mekaniske energien i A',
      body: (
        <p>
          Vi legger nullnivået for potensiell energi på flaten, i høyde med B. På toppen har {name} da potensiell energi mgh, og fordi{' '}
          {pronoun} allerede har fart, har {pronoun} også kinetisk energi. Den mekaniske energien er summen av de to.
        </p>
      ),
      math: [
        <>
          E<Sub>pA</Sub> = mgh = {fmt(m, 0)} kg · 9,81 m/s² · {fmt(h, 1)} m = {J(s.EpA)}
        </>,
        <>
          E<Sub>kA</Sub> = ½mv<Sub>0</Sub>² = ½ · {fmt(m, 0)} kg · ({fmt(v0, 1)} m/s)² = {J(s.EkA)}
        </>,
        <>
          E<Sub>A</Sub> = E<Sub>pA</Sub> + E<Sub>kA</Sub> = {J(s.EpA)} + {J(s.EkA)} = {J(s.EA)}
        </>,
      ],
      tip: (
        <>
          Nullnivået kan velges fritt, men det lønner seg å legge det i det laveste punktet. Da er E<Sub>p</Sub> = 0 i B, og ingen høyder blir
          negative.
        </>
      ),
    },
    {
      part: 'a',
      title: 'Bruk bevaring av mekanisk energi fra A til B',
      body: (
        <p>
          Uten friksjon og luftmotstand er det bare tyngden som gjør arbeid. Normalkraften står vinkelrett på bevegelsen hele veien og gjør
          ikke arbeid. Da er den mekaniske energien bevart, og i B, der E<Sub>p</Sub> = 0, er all energien kinetisk.
        </p>
      ),
      math: [
        withRoot(
          <>
            ½mv² = E<Sub>A</Sub> ⇒ v ={' '}
          </>,
          <>
            (2E<Sub>A</Sub> / m)
          </>,
        ),
        withRoot(<>v = </>, <>(2 · {J(s.EA)} / {fmt(m, 0)} kg) = {fmt(s.vIdeal, 1)} m/s</>),
      ],
      answer: (
        <>
          v = {fmt(s.vIdeal, 1)} m/s ≈ {vShown} m/s
        </>
      ),
      tip: (
        <>
          Med symboler: ½mv² = mgh + ½mv<Sub>0</Sub>² gir v = √(v<Sub>0</Sub>² + 2gh). Massen forkortes bort, så farten blir den samme for en
          lett og en tung aker.
        </>
      ),
      pitfall: (
        <>
          Ikke legg sammen fartene: v<Sub>0</Sub> + √(2gh) = {fmt(v0, 1)} m/s + {fmt(s.vDrop, 1)} m/s = {fmt(s.vWrongSum, 1)} m/s er feil. Det
          er energiene som legges sammen, ikke fartene.
        </>
      ),
    },
    {
      part: 'b',
      title: 'Finn den mekaniske energien i B med den målte farten',
      body: (
        <p>
          I B er {name} på nullnivået, så E<Sub>p</Sub> = 0. Den mekaniske energien er bare kinetisk energi, og den regner vi ut med farten
          klokka målte.
        </p>
      ),
      math: [
        <>
          E<Sub>B</Sub> = E<Sub>kB</Sub> = ½mv<Sub>B</Sub>² = ½ · {fmt(m, 0)} kg · ({fmt(vB, 1)} m/s)² = {J(s.EkB)}
        </>,
      ],
      tip: (
        <>
          Kinetisk energi går som v². Farten ble {fmt(vB, 1)} m/s i stedet for {fmt(s.vIdeal, 1)} m/s, så E<Sub>k</Sub> er bare (
          {fmt(vB, 1)} / {fmt(s.vIdeal, 1)})² = {pct(s.EkB / s.EA)} av E<Sub>A</Sub>.
        </>
      ),
    },
    {
      part: 'b',
      title: 'Den mekaniske energien som mangler, er blitt termisk energi',
      body: (
        <p>
          Energi forsvinner ikke. Friksjonen mellom brettet og snøen og luftmotstanden har gjort om en del av den mekaniske energien til
          termisk energi (varme) i brettet, snøen og lufta. Det er forskjellen mellom energien i A og i B.
        </p>
      ),
      math: [
        <>
          E<Sub>A</Sub> − E<Sub>B</Sub> = {J(s.EA)} − {J(s.EkB)} = {J(s.Q)}
        </>,
        <>
          {J(s.Q)} / {J(s.EA)} = {fmt(s.QShare, 2)} = {pct(s.QShare)}
        </>,
      ],
      answer: (
        <>
          {fmt(s.Q / 1000, 1)} kJ ({pct(s.QShare)} av den mekaniske energien i A) ble termisk energi.
        </>
      ),
      pitfall: (
        <>
          Husk den kinetiske energien i A. Med bare mgh blir svaret {J(s.EpA)} − {J(s.EkB)} = {J(s.EpA - s.EkB)}, som er {J(s.EkA)} for lite.
        </>
      ),
    },
    {
      part: 'c',
      title: 'Friksjonsarbeidet er lik endringen i mekanisk energi',
      body: (
        <>
          <p>
            Når andre krefter enn tyngden gjør arbeid, endres den mekaniske energien like mye som arbeidet de gjør: W<Sub>R</Sub> = ΔE.
          </p>
          <p>
            Friksjonskraften R virker mot bevegelsen, så vinkelen mellom R og forflytningen er 180°, og arbeidet er negativt. Forflytningen er
            lengden av bakken, s = {fmt(len, 0)} m.
          </p>
        </>
      ),
      math: [
        <>
          W<Sub>R</Sub> = ΔE = E<Sub>B</Sub> − E<Sub>A</Sub> = {J(s.EkB)} − {J(s.EA)} = −{J(s.Q)}
        </>,
        <>W<Sub>R</Sub> = R · s · cos 180° = −R · s</>,
        <>
          R = −W<Sub>R</Sub> / s = {J(s.Q)} / {fmt(len, 0)} m = {fmt(s.R, 1)} N
        </>,
      ],
      answer: <>R = {fmt(s.R, 0)} N</>,
      tip: 'Dette er en gjennomsnittsverdi. Luftmotstanden øker med farten, så motkraften er minst øverst og størst nederst i bakken.',
      pitfall: 'Bruk strekningen langs bakken, ikke høyden h eller den vannrette lengden. Arbeid er kraft ganger forflytningen langs kraften.',
    },
    {
      part: 'd',
      title: 'Finn friksjonen på flaten',
      body: (
        <p>
          På flaten er det ingen akselerasjon loddrett, så normalkraften er like stor som tyngden: N = G = mg. Friksjonen er glidefriksjonstallet
          ganger normalkraften. Tyngden og normalkraften står vinkelrett på bevegelsen og gjør ikke arbeid, så det er bare friksjonen som
          bremser {name}.
        </p>
      ),
      math: [
        <>
          N = mg = {fmt(m, 0)} kg · 9,81 m/s² = {fmt(s.Nflat, 0)} N
        </>,
        <>
          R = μN = {fmt(mu, 2)} · {fmt(s.Nflat, 0)} N = {fmt(s.Rflat, 1)} N
        </>,
      ],
      pitfall: 'N = mg gjelder bare på flaten. I bakken er normalkraften mindre, mg cos α.',
    },
    {
      part: 'd',
      title: 'All kinetisk energi blir termisk energi',
      body: (
        <p>
          {name} stopper i C, så den kinetiske energien går fra E<Sub>kB</Sub> til null. Høyden er den samme, så E<Sub>p</Sub> endres ikke.
          Friksjonsarbeidet på strekningen d er derfor lik endringen i kinetisk energi.
        </p>
      ),
      math: [
        <>
          W<Sub>R</Sub> = ΔE<Sub>k</Sub> ⇒ −R · d = 0 − ½mv<Sub>B</Sub>²
        </>,
        <>
          d = ½mv<Sub>B</Sub>² / R = {J(s.EkB)} / {fmt(s.Rflat, 1)} N = {fmt(s.d, 1)} m
        </>,
      ],
      answer: <>d = {fmt(s.d, 0)} m</>,
      tip: (
        <>
          Med symboler blir d = v<Sub>B</Sub>² / (2μg), så massen forkortes bort. Kontroll med bevegelseslikningene: a = μg ={' '}
          {fmt(s.aFlat, 2)} m/s², og v<Sub>B</Sub>² = 2ad gir d = ({fmt(vB, 1)} m/s)² / (2 · {fmt(s.aFlat, 2)} m/s²) = {fmt(s.d, 1)} m.
        </>
      ),
    },
    {
      part: 'e',
      title: 'Hvor stor er friksjonen fra snøen i bakken?',
      body: (
        <p>
          Bakken har jevn helning, så vinkelen α finner vi fra høyden og lengden: sin α = h/s. Normalkraften i bakken er like stor som
          komponenten av tyngden vinkelrett på bakken, og friksjonen fra snøen er μ ganger den.
        </p>
      ),
      math: [
        <>
          sin α = h / s = {fmt(h, 1)} m / {fmt(len, 0)} m = {fmt(s.sinA, 3)} ⇒ α = {deg}
        </>,
        <>
          N = mg cos α = {fmt(s.G, 0)} N · cos {deg} = {fmt(s.Nslope, 0)} N
        </>,
        <>
          μN = {fmt(mu, 2)} · {fmt(s.Nslope, 0)} N = {fmt(s.muN, 1)} N
        </>,
      ],
    },
    {
      part: 'e',
      title: 'Resten av friksjonskraften er luftmotstand',
      body: (
        <p>
          Friksjonskraften R = {fmt(s.R, 1)} N fra c) er summen av friksjonen fra snøen og luftmotstanden. Det som er igjen når vi trekker fra
          μN, må være luftmotstanden L.
        </p>
      ),
      math: [
        <>
          L = R − μN = {fmt(s.R, 1)} N − {fmt(s.muN, 1)} N = {fmt(s.L, 1)} N
        </>,
        <>
          L / R = {fmt(s.L, 1)} N / {fmt(s.R, 1)} N = {fmt(s.airShare, 2)} = {pct(s.airShare)}
        </>,
      ],
      answer: (
        <>
          Luftmotstanden var om lag {fmt(s.L, 0)} N i gjennomsnitt, omtrent {pct(s.airShare)} av friksjonskraften.
        </>
      ),
    },
    {
      part: 'e',
      title: 'Vurder svaret i d)',
      body: (
        <p>
          I d) så vi bort fra luftmotstanden, men den bremser {name} på flaten også. Luftmotstanden avhenger av farten. I bakken økte farten
          fra {fmt(v0, 1)} m/s til {fmt(vB, 1)} m/s, og på flaten avtar den fra {fmt(vB, 1)} m/s til 0, så farten er omtrent like stor i snitt.
          Da er det rimelig å regne med omtrent like stor luftmotstand på flaten, og vi kan gjøre et overslag.
        </p>
      ),
      math: [
        <>
          d′ ≈ ½mv<Sub>B</Sub>² / (μmg + L) = {J(s.EkB)} / ({fmt(s.Rflat, 1)} N + {fmt(s.L, 1)} N) = {fmt(s.dEst, 1)} m
        </>,
      ],
      answer: (
        <>
          Svaret i d) er for stort. Luftmotstanden bremser også på flaten, så {name} stopper trolig etter om lag {fmt(s.dEst, 0)} m, ikke{' '}
          {fmt(s.d, 0)} m.
        </>
      ),
      tip: 'Et overslag trenger ikke være nøyaktig. Det viktige er retningen: en ekstra kraft mot bevegelsen gjør alltid strekningen kortere.',
    },
  ];

  return (
    <WorkedExample
      variants={{ labels: ['Tallsett 1', 'Tallsett 2', 'Tallsett 3'], value: variant, onChange: setVariant }}
      intro={
        <p>
          {name} aker ned en bakke på et akebrett av plast. {name} og brettet har til sammen massen {fmt(m, 0)} kg. Bakken har jevn helning og
          er {fmt(len, 0)} m lang, målt langs bakken, og toppen A ligger {fmt(h, 1)} m over flaten nedenfor. {name} skyver fra og har farten{' '}
          {fmt(v0, 1)} m/s i A. Sportsklokka {pronoun === 'hun' ? 'hennes' : 'hans'} måler farten med GPS og viser {fmt(vB, 1)} m/s nederst i
          bakken, i B. På flaten glir brettet rett fram til det stopper i C. Glidefriksjonstallet mellom brettet og snøen på flaten er{' '}
          {fmt(mu, 2)}.
        </p>
      }
      given={[
        <>m = {fmt(m, 0)} kg</>,
        <>h = {fmt(h, 1)} m</>,
        <>s = {fmt(len, 0)} m</>,
        <>
          v<Sub>0</Sub> = {fmt(v0, 1)} m/s
        </>,
        <>
          v<Sub>B</Sub> = {fmt(vB, 1)} m/s
        </>,
        <>μ = {fmt(mu, 2)}</>,
      ]}
      parts={[
        { id: 'a', text: `Vis at farten i B ville vært om lag ${vShown} m/s dersom vi ser bort fra friksjon og luftmotstand.` },
        { id: 'b', text: 'Hvor mye mekanisk energi ble omdannet til termisk energi på vei ned bakken?' },
        {
          id: 'c',
          text: `Bestem den gjennomsnittlige friksjonskraften R på ${name} og brettet i bakken. Regn luftmotstanden som en del av friksjonskraften.`,
        },
        { id: 'd', text: `Hvor langt glir ${name} på flaten før ${pronoun} stopper? Se bort fra luftmotstanden.` },
        {
          id: 'e',
          text: `Anta at glidefriksjonstallet er like stort i bakken som på flaten. Hvor stor var luftmotstanden i gjennomsnitt i bakken? Vurder om svaret i d) er for stort eller for lite.`,
        },
      ]}
      steps={steps}
      figure={(state) => <SledFigure task={task} s={s} look={look} state={state} />}
    />
  );
}

/**
 * En formellinje med rottegn: utregningen viser √ med vanlig skrift (som FormulaLine) bare når tegnet står som egen
 * tekst i linja, så linja deles i delen før og etter rottegnet.
 */
function withRoot(before: ReactNode, after: ReactNode): ReactNode {
  return [<Fragment key="a">{before}</Fragment>, '√', <Fragment key="b">{after}</Fragment>];
}

/* ---------- Figuren ---------- */

function SledFigure({ task, s, look, state }: { task: SledTask; s: SledSolution; look: RiderLook; state: FigureState }) {
  const { ref, f, narrow, k } = useFigureScale<HTMLDivElement>();
  const spec = figureSpec(state.step, state.showAll);
  const L = sceneLayout(task, s, { narrow, camera: spec.camera, f, k });
  const rows = spec.ledger ? ledgerRows(s, spec.ledger) : [];
  const ledgerH = ledgerHeight(f);
  return (
    <div ref={ref} style={{ display: 'grid', gap: 10 }}>
      <Figure viewBox={`0 0 ${L.W} ${L.H}`} label={figureLabel(task, s, spec)} maxHeight={460}>
        <Scene task={task} s={s} look={look} spec={spec} L={L} />
        {L.panel && spec.ledger && <EnergyLedger box={L.panel} rows={rows} EA={s.EA} f={f} />}
      </Figure>
      {narrow && spec.ledger && (
        <Figure viewBox={`0 0 800 ${ledgerH}`} label={`Energien underveis: ${rows.map((r) => r.id).join(', ')}.`}>
          <EnergyLedger box={{ x: 0, y: 0, w: 800, h: ledgerH }} rows={rows} EA={s.EA} f={f} card={false} />
        </Figure>
      )}
    </div>
  );
}

function figureLabel(task: SledTask, s: SledSolution, spec: FigureSpec): string {
  const where: Record<Spot, string> = {
    A: 'på toppen A',
    mid: 'midt i bakken',
    B: 'nederst i bakken, i B',
    flat: 'på flaten',
    C: `i C, ${fmt(s.d, 0)} m ut på flaten`,
    Cest: `etter om lag ${fmt(s.dEst, 0)} m på flaten`,
  };
  return `${task.name} på akebrett ${where[spec.rider]}. Bakken er ${fmt(task.s, 0)} m lang og ${fmt(task.h, 1)} m høy, med en vannrett flate nedenfor.`;
}

function Scene({ task, s, look, spec, L }: { task: SledTask; s: SledSolution; look: RiderLook; spec: FigureSpec; L: SceneLayout }) {
  const { f, X, Y, groundY, W, H } = L;
  const terrain = terrainPoints(L, task.h);
  const xA = X(0);
  const yA = Y(task.h);
  const xB = X(L.run);
  const xC = X(L.xC);
  const xCe = X(L.xCest);
  const fr = (spot: Spot) => spotFrame(L, task, s, spot);
  const rider = fr(spec.rider);
  // Varmen langs sporet: bakken fra A til B, flaten fra B til der akeren stopper
  const slopeHeat = terrain.filter(([x]) => x >= xA - 4 && x <= xB + 4);
  const flatEnd = spec.rider === 'Cest' ? xCe : xC;
  const flatHeat: [number, number][] = [
    [xB, groundY],
    [flatEnd, groundY],
  ];
  const tagY = (spot: Spot) => tagCenter(L, fr(spot));

  return (
    <g>
      <Himmel w={W} h={groundY + 4} sol={{ x: 0.36 * W, y: 40 * f, r: 16 * f }} skyer={2} seed={6} />
      <Landskap x={0} y={L.horizon} w={W} h={Math.min(0.34 * groundY, 110)} type="skog" seed={4} />
      <Terreng points={terrain} bottom={H + 2} type="sno" seed={9} title="Akebakke i snø med en vannrett flate nedenfor" />
      {/* Snødekte graner bak toppen, i bakkens skala */}
      {L.camera !== 'flate' && (
        <>
          <Gran x={20} y={yA + 2} size={4.2 * L.ppm} sno seed={3} />
          <Gran x={50} y={yA + 2} size={3.1 * L.ppm} sno seed={5} />
        </>
      )}

      {spec.heatSlope && <HeatTrack points={slopeHeat} />}
      {spec.heatFlat && <HeatTrack points={flatHeat} />}

      {/* Nullnivået gjennom B */}
      {spec.zero && (
        <g>
          <line x1={0} x2={xB} y1={groundY} y2={groundY} stroke={VIZ.ink} strokeWidth={1.4} strokeDasharray="7 5" opacity={0.75} />
          <Txt x={6} y={groundY + 22 * f} anchor="start" size={0.8} muted>
            nullnivå
          </Txt>
        </g>
      )}

      {/* Mål */}
      {spec.dims.h !== 'off' && (
        <Dimension
          x1={8 + 14 * f}
          y1={yA}
          x2={8 + 14 * f}
          y2={groundY}
          // Etiketten høyt oppe, så den ikke kolliderer med starten av s-målet under A
          labelOffset={Math.min(0, 20 * f - (groundY - yA) / 2)}
          label={`h = ${fmt(task.h, 1)} m`}
          color={spec.dims.h === 'strong' ? VIZ.ink : VIZ.muted}
          labelSize={spec.dims.h === 'strong' ? 0.95 : 0.85}
        />
      )}
      {spec.dims.s !== 'off' && (
        <Dimension
          x1={xA}
          y1={yA}
          x2={xB}
          y2={groundY}
          offset={-36 * f}
          label={`s = ${fmt(task.s, 0)} m`}
          color={spec.dims.s === 'strong' ? VIZ.ink : VIZ.muted}
          labelSize={spec.dims.s === 'strong' ? 0.95 : 0.85}
        />
      )}
      {spec.dims.d !== 'off' && (
        <Dimension x1={xB} y1={groundY} x2={xC} y2={groundY} offset={-38 * f} label={`d = ${fmt(s.d, 0)} m`} color={spec.dims.d === 'strong' ? VIZ.ink : VIZ.muted} labelSize={0.95} />
      )}
      {spec.dims.dEst !== 'off' && (
        <Dimension x1={xB} y1={groundY} x2={xCe} y2={groundY} offset={-38 * f} label={`d′ ≈ ${fmt(s.dEst, 0)} m`} color={VIZ.ink} labelSize={0.95} />
      )}
      {/* Vinkelen ved B, med bokstaven mellom B og etiketten til s-målet (midt på bakken) */}
      {spec.angle && <SlopeAngle x={xB} y={groundY} alphaDeg={s.alphaDeg} r={Math.min(130 * f, (L.narrow ? 0.22 : 0.3) * (xB - xA))} />}

      {/* Punktene */}
      <PointMark x={xA} y={yA} lx={xA + 9 * f} ly={yA - 8 * f} label="A" />
      <PointMark x={xB} y={groundY} lx={xB - 9 * f} ly={groundY + 24 * f} label="B" anchor="end" />
      {spec.pointC && <PointMark x={xC} y={groundY} lx={xC + 8 * f} ly={groundY + 24 * f} label="C" muted={spec.pointCest} />}
      {spec.pointCest && <PointMark x={xCe} y={groundY} lx={xCe + 8 * f} ly={groundY + 24 * f} label="C′" />}

      {/* Etikett til varmen første gang den vises (på mobil står fargeforklaringen rett under figuren) */}
      {spec.heatSlope && !spec.heatFlat && spec.speedB === 'measured' && !L.narrow && <HeatCallout L={L} task={task} s={s} />}

      {/* Akeren og der hun har vært */}
      {spec.ghosts.map((g) => (
        <Aker key={g} fr={fr(g)} rppm={L.rppm} look={look} ghost />
      ))}
      <Aker fr={rider} rppm={L.rppm} look={look} />

      {/* Fart */}
      {spec.v0 && <SpeedArrow L={L} fr={fr('A')} v={task.v0} />}
      {spec.speedB !== 'off' && <SpeedAtB L={L} task={task} s={s} spec={spec} />}
      {spec.rider === 'mid' && spec.slopeForces === 'R' && <SpeedArrow L={L} fr={rider} v={speedMid(task)} label="v" />}
      {spec.flatForces && <SpeedArrow L={L} fr={rider} v={speedOnFlat(task, s, 0.42 * s.d)} label="v" />}

      {/* Krefter */}
      {spec.slopeForces === 'R' && <SlopeR L={L} fr={rider} R={s.R} />}
      {spec.slopeForces === 'split' && <SlopeSplit L={L} fr={rider} muN={s.muN} Lair={s.L} />}
      {spec.flatForces && (
        <ForceArrow
          x1={rider.x}
          y1={rider.y - COM_HEIGHT * L.rppm}
          x2={rider.x - s.Rflat * L.kF}
          y2={rider.y - COM_HEIGHT * L.rppm}
          color={VIZ.friction}
          label="R"
          origin
        />
      )}

      {/* Verdiskilt over akeren */}
      {spec.v0 && <ValueTag {...tagY('A')} text={`v₀ = ${fmt(task.v0, 1)} m/s`} color={VIZ.velocity} pointer={6 * f} />}
      {(spec.rider === 'C' || spec.rider === 'Cest') && <ValueTag {...tagY(spec.rider)} text="v = 0" color={VIZ.velocity} pointer={6 * f} />}
      {spec.speedB === 'ideal' && <ValueTag {...tagY('B')} text={`v = ${fmt(s.vIdeal, 1)} m/s`} color={VIZ.velocity} pointer={6 * f} />}
      {(spec.speedB === 'measured' || spec.speedB === 'measured-only') && (
        <ValueTag {...tagY('B')} text={`v = ${fmt(task.vB, 1)} m/s`} color={VIZ.velocity} pointer={6 * f} />
      )}
    </g>
  );
}

/** Fartspil langs sporet fra fronten av akeren. */
function SpeedArrow({ L, fr, v, label }: { L: SceneLayout; fr: ReturnType<typeof spotFrame>; v: number; label?: string }) {
  const a = speedArrow(L, fr, v);
  // En kort pil (v₀ på toppen) blir bare en pilspiss: da står farten bare på skiltet.
  return <ForceArrow {...a} color={VIZ.velocity} width={6} label={label} minLength={18} />;
}

/**
 * Farten i B: uten friksjon (heltrukket), eller målt (heltrukket) med farten uten friksjon stiplet like over, så de
 * to lengdene kan sammenlignes.
 */
function SpeedAtB({ L, task, s, spec }: { L: SceneLayout; task: SledTask; s: SledSolution; spec: FigureSpec }) {
  const fr = spotFrame(L, task, s, 'B');
  const ideal = speedArrow(L, fr, s.vIdeal);
  const meas = speedArrow(L, fr, task.vB);
  const f = L.f;
  if (spec.speedB === 'ideal') return <ForceArrow {...ideal} color={VIZ.velocity} width={6} label="v" />;
  // Den stiplede pila går like over snøen, under den målte, med etiketten under seg i snøen.
  const drop = COM_HEIGHT * L.rppm - 6 * f;
  return (
    <g>
      {spec.speedB === 'measured' && (
        <ForceArrow
          x1={ideal.x1}
          y1={ideal.y1 + drop}
          x2={ideal.x2}
          y2={ideal.y2 + drop}
          color={VIZ.velocity}
          width={6}
          dashed
          label="uten friksjon"
          labelSize={0.72}
          labelAnchor="start"
          labelX={fr.x + 0.1 * SLED_LENGTH * L.rppm}
          labelY={L.groundY + 22 * f}
        />
      )}
      <ForceArrow {...meas} color={VIZ.velocity} width={6} label={<>v<TSub>B</TSub></>} labelX={meas.x2 + 4 * f} labelY={meas.y2 - 9 * f} labelAnchor="start" />
    </g>
  );
}

/** Den gjennomsnittlige friksjonskraften R midt i bakken, fra tyngdepunktet og opp langs bakken. */
function SlopeR({ L, fr, R }: { L: SceneLayout; fr: ReturnType<typeof spotFrame>; R: number }) {
  const c = framePoint(fr, 0, COM_HEIGHT * L.rppm);
  return <ForceArrow x1={c.x} y1={c.y} x2={c.x - fr.tx * R * L.kF} y2={c.y - fr.ty * R * L.kF} color={VIZ.friction} label="R" origin />;
}

/**
 * R delt i friksjonen fra snøen (μN, virker i kontaktflaten under brettet) og luftmotstanden (L, virker på kroppen),
 * begge opp langs bakken, mot bevegelsen.
 */
function SlopeSplit({ L, fr, muN, Lair }: { L: SceneLayout; fr: ReturnType<typeof spotFrame>; muN: number; Lair: number }) {
  const sled = SLED_LENGTH * L.rppm;
  const c = framePoint(fr, -0.36 * sled, 0.03 * L.rppm);
  const b = framePoint(fr, -0.22 * L.rppm, 0.62 * L.rppm);
  return (
    <g>
      <ForceArrow x1={c.x} y1={c.y} x2={c.x - fr.tx * muN * L.kF} y2={c.y - fr.ty * muN * L.kF} color={VIZ.friction} label="μN" />
      <ForceArrow x1={b.x} y1={b.y} x2={b.x - fr.tx * Lair * L.kF} y2={b.y - fr.ty * Lair * L.kF} color={VIZ.friction} label="L" />
    </g>
  );
}

/** Etikett til varmen i sporet første gang den vises (over bakken, i himmelen). */
function HeatCallout({ L, task, s }: { L: SceneLayout; task: SledTask; s: SledSolution }) {
  const u = 0.4 * task.s;
  const x = L.X(u * s.cosA);
  const y = L.Y(task.h - u * s.sinA) + 2;
  // Teksten (ca. 125 enheter bred) skal ikke gå inn i energipanelet
  const lx = Math.min(x + 24 * L.f, (L.panel ? L.panel.x - 10 : L.W) - 125 * L.f);
  return (
    <Callout x={x} y={y} lx={lx} ly={y - 34 * L.f} anchor="start" color={VIZ.friction} strong>
      termisk energi
    </Callout>
  );
}
