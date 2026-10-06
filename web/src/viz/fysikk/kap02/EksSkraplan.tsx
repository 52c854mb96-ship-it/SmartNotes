import { useState, type ReactNode } from 'react';
import { Figure, Sub, TSub, Txt, VIZ, WorkedExample, fmt, useTextScale, type ExampleStep, type FigureState } from '../../kit';
import {
  Dimension,
  ForceArrow,
  Himmel,
  Kasse,
  Landskap,
  LinearGradient,
  PAINTS,
  Rampe,
  SCENE,
  Underlag,
  materialStops,
  rampePunkt,
  shade,
  useStrokeScale,
  useSvgId,
} from '../../kit/scene';
import { RAMP_TASKS, solveRampTask, type RampSolution, type RampTask } from './model';
import { useNarrow } from './useNarrow';

const RAD = Math.PI / 180;

/**
 * Eksempeloppgave (2C, 2E): en kasse sklir ned en rampe fra en lasterampe. Oppgaven er laget for appen
 * (egen tekst og egne tall) i samme stil som eksamensoppgaver: krefter, dekomponering, Newtons 2. lov,
 * bevegelseslikning og grensevinkel.
 *
 * Tallene: kreftene vises med to desimaler, så hver linje i utregningen går opp med tallene fra linja over
 * (model.test.ts sjekker det for alle tallsettene). Alle tall kommer fra solveRampTask.
 */
export default function EksSkraplan() {
  const [variant, setVariant] = useState(0);
  const task = RAMP_TASKS[variant] ?? RAMP_TASKS[0]!;
  const s = solveRampTask(task);
  const { m, alphaDeg, muK, muS, L } = task;
  const deg = `${fmt(alphaDeg, 0)}°`;
  const F = (v: number) => `${fmt(v, 2)} N`;
  const ag = (
    <>
      α<Sub>g</Sub>
    </>
  );

  const steps: ExampleStep[] = [
    {
      part: 'a',
      title: 'Finn kreftene som virker på kassen',
      body: (
        <>
          <p>
            Bare to ting berører eller påvirker kassen: jorda (tyngden) og rampa. Rampa gir to krefter: normalkraften, som står vinkelrett ut
            fra rampa, og friksjonen, som virker langs rampa mot bevegelsen.
          </p>
          <p>
            <strong>Tyngden G</strong> peker loddrett ned. <strong>Normalkraften N</strong> peker vinkelrett ut fra rampa.{' '}
            <strong>Friksjonen R</strong> peker oppover langs rampa, fordi kassen sklir nedover.
          </p>
        </>
      ),
      answer: 'Tre krefter: tyngden G, normalkraften N og friksjonen R (se figuren).',
      pitfall: (
        <>
          Ikke tegn en egen «kraft nedover rampa». Den delen av tyngden som virker langs rampa (G<Sub>∥</Sub>) er en del av G, ikke en ny
          kraft.
        </>
      ),
    },
    {
      part: 'b',
      title: 'Del tyngden opp langs og vinkelrett på rampa',
      body: (
        <p>
          Kassen beveger seg langs rampa, så vi legger aksene langs og vinkelrett på rampa. Da må bare tyngden deles opp. Vinkelen mellom G og
          G<Sub>⊥</Sub> (normalen til rampa) er like stor som rampevinkelen α, se de to buene i figuren.
        </p>
      ),
      math: [
        <>
          G = mg = {fmt(m, 0)} kg · 9,81 m/s² = {F(s.G)}
        </>,
        <>
          G<Sub>∥</Sub> = G · sin α = {F(s.G)} · sin {deg} = {F(s.Gpar)}
        </>,
        <>
          G<Sub>⊥</Sub> = G · cos α = {F(s.G)} · cos {deg} = {F(s.Gperp)}
        </>,
      ],
      tip: 'Sjekk vinkelen: når rampa er flat (α = 0), skal hele G virke vinkelrett på rampa, og cos 0° = 1 gir nettopp det.',
    },
    {
      part: 'b',
      title: 'Finn normalkraften og friksjonen',
      body: (
        <p>
          Kassen beveger seg ikke vinkelrett på rampa, så kraftsummen i den retningen er null: N = G<Sub>⊥</Sub>. Glidefriksjonen er μ
          <Sub>k</Sub> ganger normalkraften.
        </p>
      ),
      math: [
        <>
          N = G<Sub>⊥</Sub> = {F(s.N)}
        </>,
        <>
          R = μ<Sub>k</Sub> · N = {fmt(muK, 2)} · {F(s.N)} = {F(s.R)}
        </>,
      ],
      pitfall: (
        <>
          N er ikke lik G på en skrå rampe. N = G gjelder bare på et vannrett underlag uten andre krefter på skrå.
        </>
      ),
    },
    {
      part: 'b',
      title: 'Bruk Newtons 2. lov langs rampa',
      body: (
        <p>
          Langs rampa virker G<Sub>∥</Sub> nedover og R oppover. Vi velger positiv retning nedover rampa, i fartsretningen.
        </p>
      ),
      math: [
        <>
          ΣF = G<Sub>∥</Sub> − R = {F(s.Gpar)} − {F(s.R)} = {F(s.sumF)}
        </>,
        <>
          a = ΣF / m = {F(s.sumF)} / {fmt(m, 0)} kg = {fmt(s.a, 2)} m/s²
        </>,
      ],
      answer: (
        <>
          a = {fmt(s.a, 2)} m/s² ≈ {fmt(s.a, 1)} m/s²
        </>
      ),
      tip: (
        <>
          Med symboler blir a = g(sin α − μ<Sub>k</Sub> cos α). Massen forkortes bort, så en tung og en lett kasse får samme akselerasjon.
        </>
      ),
    },
    {
      part: 'c',
      title: 'Velg en bevegelseslikning uten tid',
      body: (
        <p>
          Akselerasjonen er konstant, og kassen starter i ro (v<Sub>0</Sub> = 0). Vi kjenner strekningen s = {fmt(L, 1)} m og vil finne
          farten v, men kjenner ikke tiden. Da passer den tidløse likningen.
        </p>
      ),
      math: [
        <>
          v² − v<Sub>0</Sub>² = 2as ⇒ v = √(2as)
        </>,
        <>
          v = √(2 · {fmt(s.a, 2)} m/s² · {fmt(L, 1)} m) = {fmt(s.v, 2)} m/s
        </>,
      ],
      answer: (
        <>
          v = {fmt(s.v, 1)} m/s ({fmt(s.v * 3.6, 0)} km/h)
        </>
      ),
      tip: (
        <>
          Kontroller med tiden: t = v / a = {fmt(s.v, 2)} m/s / {fmt(s.a, 2)} m/s² = {fmt(s.t, 2)} s, og s = ½at² = ½ · {fmt(s.a, 2)} m/s² · (
          {fmt(s.t, 2)} s)² = {fmt(L, 1)} m.
        </>
      ),
    },
    {
      part: 'd',
      title: 'Når begynner kassen å gli av seg selv?',
      body: (
        <p>
          Kassen ligger i ro så lenge den statiske friksjonen klarer å holde igjen: G<Sub>∥</Sub> ≤ μ<Sub>s</Sub>N. Ved grensevinkelen {ag}{' '}
          er friksjonen så stor den kan bli, og akkurat like stor som G<Sub>∥</Sub>. Både G<Sub>∥</Sub> og N inneholder mg, som forkortes
          bort.
        </p>
      ),
      math: [
        <>
          mg · sin {ag} = μ<Sub>s</Sub> · mg · cos {ag} ⇒ tan {ag} = μ<Sub>s</Sub>
        </>,
        <>
          {ag} = tan⁻¹ {fmt(muS, 2)} = {fmt(s.critDeg, 1)}°
        </>,
      ],
      answer: (
        <>
          Rampa må være minst {fmt(s.critDeg, 1)}° bratt. Med {deg} glir kassen av seg selv, fordi tan {deg} ={' '}
          {fmt(Math.tan(alphaDeg * RAD), 2)} er større enn μ<Sub>s</Sub> = {fmt(muS, 2)}.
        </>
      ),
      tip: 'Figuren viser rampa med grensevinkelen. Den er lengre, fordi lasterampa er like høy.',
      pitfall: 'Her skal du bruke det statiske friksjonstallet, ikke glidefriksjonstallet: spørsmålet er når kassen begynner å gli.',
    },
  ];

  return (
    <WorkedExample
      variants={{ labels: ['Tallsett 1', 'Tallsett 2', 'Tallsett 3'], value: variant, onChange: setVariant }}
      intro={
        <p>
          På et lager skal en kasse med varer ned fra en lasterampe. En arbeider setter en skrå rampe av tre fra kanten av lasterampa ned til
          bakken og slipper kassen øverst på rampa. Kassen har massen {fmt(m, 0)} kg, rampa er {fmt(L, 1)} m lang og danner vinkelen {deg} med
          bakken. Glidefriksjonstallet mellom kassen og rampa er {fmt(muK, 2)}, og det statiske friksjonstallet er {fmt(muS, 2)}.
        </p>
      }
      given={[
        <>m = {fmt(m, 0)} kg</>,
        <>L = {fmt(L, 1)} m</>,
        <>α = {deg}</>,
        <>
          μ<Sub>k</Sub> = {fmt(muK, 2)}
        </>,
        <>
          μ<Sub>s</Sub> = {fmt(muS, 2)}
        </>,
      ]}
      parts={[
        { id: 'a', text: 'Tegn kreftene som virker på kassen mens den sklir nedover rampa.' },
        { id: 'b', text: `Vis at akselerasjonen til kassen er ${fmt(s.a, 1)} m/s².` },
        { id: 'c', text: 'Hvor stor fart har kassen når den når bakken?' },
        { id: 'd', text: 'Hvor bratt må rampa minst være for at kassen skal begynne å gli av seg selv?' },
      ]}
      steps={steps}
      figure={(state) => <RampFigure task={task} s={s} state={state} />}
    />
  );
}

/* ---------- Figuren ---------- */

/*
 * Én skala for hele scenen: 128 px per meter (rampa, kassen, lasterampa og porten). Kassen er 0,59 m × 0,45 m.
 * Kreftene har sin egen skala, G er alltid G_LEN lang. Kanten av lasterampa står fast (TOP_X), så lageret står likt i
 * alle tallsettene. I d) står rampa med grensevinkelen α_g; den er da lengre, fordi lasterampa er like høy.
 */
const W = 800;
const H = 440;
const GROUND = 392;
/** Piksler per meter. */
const PX_PER_M = 128;
/** Kanten av lasterampa, der rampa ligger an. */
const TOP_X = 560;
/** Lengden på G-pila (piksler); de andre kreftene tegnes i samme skala. */
const G_LEN = 190;
const BOX_W = 76;
const BOX_H = 58;
/** Radius på vinkelbuen ved foten av rampa og ved tyngdepunktet. */
const ARC_FOOT = 70;
const ARC_CM = 46;

/** Rampa med vinkelen `alphaDeg` fra bakken opp til kanten av lasterampa, som er `dockH` piksler høy. */
function rampGeom(alphaDeg: number, dockH: number) {
  const al = alphaDeg * RAD;
  const len = dockH / Math.sin(al);
  const x0 = TOP_X - len * Math.cos(al);
  const ramp = { x: x0, y: GROUND, lengde: len, vinkel: alphaDeg, retning: 'opp-hoyre' as const, materiale: 'tre' as const };
  return { alphaDeg, al, len, x0, ramp };
}
type RampGeom = ReturnType<typeof rampGeom>;

/** Kassen `sAlong` piksler opp langs rampa: punktet midt på bunnen, midten av kassen og enhetsvektorene. */
function boxOn(g: RampGeom, sAlong: number) {
  const p = rampePunkt(g.ramp, sAlong);
  // Normalen ut fra rampa (opp og til venstre) og retningen ned langs rampa (ned og til venstre).
  const nx = -Math.sin(g.al);
  const ny = -Math.cos(g.al);
  const dx = -Math.cos(g.al);
  const dy = Math.sin(g.al);
  return { p, cx: p.x + (nx * BOX_H) / 2, cy: p.y + (ny * BOX_H) / 2, nx, ny, dx, dy };
}

/** Øverst på rampa (oppgaven, a og b), litt lenger ned i d (så R-pila ikke stikker over kanten), og nederst i c. */
const sTop = (g: RampGeom) => g.len - BOX_W / 2 - 10;
const sLimit = (g: RampGeom) => g.len - BOX_W / 2 - 40;
const sBottom = () => BOX_W / 2 + 4;

function RampFigure({ task, s, state }: { task: RampTask; s: RampSolution; state: FigureState }) {
  const [ref, narrow] = useNarrow<HTMLDivElement>();
  return (
    <div ref={ref}>
      <RampScene task={task} s={s} state={state} narrow={narrow} />
    </div>
  );
}

function RampScene({ task, s, state, narrow }: { task: RampTask; s: RampSolution; state: FigureState; narrow: boolean }) {
  const { step, showAll } = state;
  const dockH = task.L * PX_PER_M * Math.sin(task.alphaDeg * RAD);
  const gTask = rampGeom(task.alphaDeg, dockH);
  const gLimit = rampGeom(s.critDeg, dockH);

  // d) handler om grensevinkelen: rampa står med α_g, og kassen ligger i ro med R = μs·N = G∥.
  const limit = !showAll && step === 6;
  const atBottom = !showAll && step === 5;
  const g = limit ? gLimit : gTask;
  const b = boxOn(g, limit ? sLimit(g) : atBottom ? sBottom() : sTop(g));
  const { cx, cy, nx, ny, dx, dy } = b;
  const f = limit
    ? { Gpar: s.limit.Gpar, Gperp: s.limit.Gperp, N: s.limit.N, R: s.limit.Rmax }
    : { Gpar: s.Gpar, Gperp: s.Gperp, N: s.N, R: s.R };

  const k = G_LEN / s.G;
  const showForces = showAll || (step >= 1 && step <= 4) || limit;
  const showParts = showAll || (step >= 2 && step <= 4);
  const showSum = !showAll && step === 4;
  const showFootAngle = showAll || step === 0 || step === 2 || limit;
  const showCmAngle = showAll || step === 2;
  // Kassen tones ned når komponentene (stiplet) er tegnet oppå den, så de synes.
  const dimBox = showParts || limit;

  // På mobil zoomes figuren inn på rampa og kassen. Utsnittet er det samme i alle stegene (også d).
  const tipY = (gg: RampGeom, sAlong: number, N: number) => {
    const bb = boxOn(gg, sAlong);
    return bb.cy + bb.ny * N * k;
  };
  const vbTop = Math.max(0, Math.min(tipY(gTask, sTop(gTask), s.N), tipY(gLimit, sLimit(gLimit), s.limit.N)) - 30);
  // Til venstre: foten av rampa i d), og mållinja og v-pila (med etikett) i oppgaven og c).
  const vbLeft = Math.min(gTask.x0 - 66, gLimit.x0 - 28);
  // Til høyre: etiketten på G⊥, som peker inn under kanten av lasterampa.
  const vbRight = TOP_X + 90;
  const vb = narrow ? `${vbLeft} ${vbTop} ${vbRight - vbLeft} ${H - vbTop}` : `0 0 ${W} ${H}`;
  // Vinkelen ved foten: verdien i oppgaven og i d), ellers bare symbolet (b1 viser at den samme vinkelen står ved G).
  const angleLabel = limit ? (
    <>
      α<TSub>g</TSub> = {fmt(s.critDeg, 1)}°
    </>
  ) : !showAll && step === 0 ? (
    `α = ${fmt(task.alphaDeg, 0)}°`
  ) : (
    'α'
  );

  return (
    <Figure
      viewBox={vb}
      label={
        limit
          ? `Rampa med grensevinkelen ${fmt(s.critDeg, 1)} grader: kassen på ${fmt(task.m, 0)} kg ligger så vidt i ro, og friksjonen er like stor som tyngdens komponent langs rampa.`
          : `En kasse på ${fmt(task.m, 0)} kg på en rampe som danner ${fmt(task.alphaDeg, 0)} grader med bakken, fra en lasterampe ned til bakken.`
      }
      maxHeight={460}
    >
      {/* Bakgrunnen er bredere enn utsnittet, så den fyller figuren også når den er bredere enn 800:440. */}
      <Himmel x={-300} y={0} w={W + 600} h={GROUND} skyer={2} seed={4} />
      <Landskap x={-300} y={GROUND} w={W + 600} h={120} type="aaser" seed={2} />
      <Underlag x1={-300} x2={W + 300} y={GROUND} depth={H - GROUND + 40} type="betong" />
      <Lasterampe x={TOP_X} y={GROUND - dockH} />
      <Rampe {...g.ramp} />
      <g opacity={dimBox ? 0.5 : 1}>
        <Kasse x={b.p.x} y={b.p.y} w={BOX_W} h={BOX_H} materiale="papp" rotate={b.p.rotate} />
        <Fraktlapp x={b.p.x} y={b.p.y} rotate={b.p.rotate} text={`${fmt(task.m, 0)} kg`} />
      </g>

      {showFootAngle && <AngleMark x={g.x0} y={GROUND} alphaDeg={g.alphaDeg} label={angleLabel} />}
      {!showAll && step === 0 && <RampDim g={gTask} text={`L = ${fmt(task.L, 1)} m`} />}
      {atBottom && (
        <>
          <RampDim g={gTask} text={`s = ${fmt(task.L, 1)} m`} />
          <ForceArrow x1={cx} y1={cy} x2={cx + dx * 22 * s.v} y2={cy + dy * 22 * s.v} color={VIZ.velocity} label="v" width={6} />
        </>
      )}

      {showForces && (
        <>
          {showCmAngle && <CmAngle x={cx} y={cy} alphaDeg={g.alphaDeg} />}
          {(showParts || limit) && (
            <ForceArrow
              x1={cx}
              y1={cy}
              x2={cx + dx * f.Gpar * k}
              y2={cy + dy * f.Gpar * k}
              color={VIZ.gravity}
              dashed
              width={10}
              label={
                <>
                  G<TSub>∥</TSub>
                </>
              }
            />
          )}
          {showParts && (
            <ForceArrow
              x1={cx}
              y1={cy}
              x2={cx - nx * f.Gperp * k}
              y2={cy - ny * f.Gperp * k}
              color={VIZ.gravity}
              dashed
              width={10}
              label={
                <>
                  G<TSub>⊥</TSub>
                </>
              }
            />
          )}
          <ForceArrow x1={cx} y1={cy} x2={cx} y2={cy + G_LEN} color={VIZ.gravity} label="G" origin />
          <ForceArrow x1={cx} y1={cy} x2={cx + nx * f.N * k} y2={cy + ny * f.N * k} color={VIZ.normal} label="N" />
          <ForceArrow x1={cx} y1={cy} x2={cx - dx * f.R * k} y2={cy - dy * f.R * k} color={VIZ.friction} label="R" />
          {showSum && (
            // Akselerasjonen (egen skala, 40 px per m/s²) foran kassen. Kraftsummen er bare G∥ − R, som er for kort å se.
            <ForceArrow
              x1={cx + dx * (BOX_W / 2 + 12) + nx * BOX_H * 0.62}
              y1={cy + dy * (BOX_W / 2 + 12) + ny * BOX_H * 0.62}
              x2={cx + dx * (BOX_W / 2 + 12 + 40 * s.a) + nx * BOX_H * 0.62}
              y2={cy + dy * (BOX_W / 2 + 12 + 40 * s.a) + ny * BOX_H * 0.62}
              color={VIZ.acceleration}
              width={5}
              label="a"
            />
          )}
        </>
      )}

    </Figure>
  );
}

/**
 * Lageret med lasterampa (betong) som rampa ligger an mot, og en leddport i veggen bak. (x, y) er hjørnet øverst
 * til venstre på lasterampa. Veggen og porten (2,6 m høy og 3 m bred) går ut over kanten av figuren, i samme skala
 * som resten av scenen.
 */
function Lasterampe({ x, y }: { x: number; y: number }) {
  const ss = useStrokeScale();
  const ramp = useSvgId('lasterampe');
  const wall = useSvgId('lagervegg');
  const door = useSvgId('lagerport');
  const right = W + 300;
  const top = -300;
  const wallX = x + 30;
  const doorX = wallX + 34;
  const doorW = 3 * PX_PER_M;
  const doorH = 2.6 * PX_PER_M;
  const doorTop = y - doorH;
  const slat = 0.16 * PX_PER_M;
  // Veggen er kledd med stående plater, ca. 1 m brede.
  const seams = Array.from({ length: Math.ceil((right - wallX) / PX_PER_M) }, (_, i) => wallX + (i + 1) * PX_PER_M).filter(
    (sx) => sx < doorX - 4 || sx > doorX + doorW + 4,
  );
  return (
    <g>
      <LinearGradient id={wall} stops={materialStops(PAINTS.graa, 0.6)} />
      <LinearGradient id={door} stops={materialStops(shade(SCENE.metal, 0.15), 0.8)} />
      <rect x={wallX} y={top} width={right - wallX} height={y - top} fill={`url(#${wall})`} stroke={SCENE.outline} strokeWidth={1 * ss} />
      {seams.map((sx) => (
        <line key={sx} x1={sx} x2={sx} y1={top} y2={y} stroke={shade(PAINTS.graa, 0.3)} strokeWidth={1 * ss} opacity={0.5} />
      ))}
      {/* Porten med karm og lameller */}
      <rect x={doorX - 5} y={doorTop - 5} width={doorW + 10} height={doorH + 5} fill={shade(PAINTS.graa, 0.35)} />
      <rect x={doorX} y={doorTop} width={doorW} height={doorH} fill={`url(#${door})`} stroke={SCENE.outline} strokeWidth={1 * ss} />
      {Array.from({ length: Math.floor(doorH / slat) }, (_, i) => (
        <line
          key={i}
          x1={doorX}
          x2={doorX + doorW}
          y1={y - (i + 1) * slat}
          y2={y - (i + 1) * slat}
          stroke={shade(SCENE.metal, 0.35)}
          strokeWidth={1 * ss}
          opacity={0.6}
        />
      ))}
      <rect x={doorX + doorW * 0.08} y={y - slat * 0.7} width={doorW * 0.1} height={slat * 0.3} rx={1} fill={shade(SCENE.metal, 0.5)} />
      <LinearGradient id={ramp} stops={materialStops(SCENE.concrete)} />
      <rect x={x} y={y} width={right - x} height={GROUND - y} fill={`url(#${ramp})`} stroke={SCENE.outline} strokeWidth={1 * ss} />
      <rect x={x} y={y} width={right - x} height={7} fill={shade(SCENE.concrete, 0.18)} />
    </g>
  );
}

/**
 * Mållinje langs hele rampa, et stykke over kassen, med etiketten så langt ut fra linja at den ikke krysser den
 * (Dimension setter etiketten rett over midten, og en skrå linje går da gjennom teksten).
 */
function RampDim({ g, text }: { g: RampGeom; text: string }) {
  const f = useTextScale();
  const off = BOX_H + 36;
  const nx = -Math.sin(g.al);
  const ny = -Math.cos(g.al);
  const fs = 17 * f * 0.9;
  const w = text.length * fs * 0.6;
  const h = fs * 0.75;
  // Avstanden fra linja til midten av teksten: nok til at hjørnet nærmest linja går klar.
  const d = (w / 2) * Math.sin(g.al) + (h / 2) * Math.cos(g.al) + 6 * f;
  const mx = (g.x0 + TOP_X) / 2 + nx * (off + d);
  const my = (GROUND + GROUND - g.len * Math.sin(g.al)) / 2 + ny * (off + d);
  return (
    <>
      <Dimension x1={g.x0} y1={GROUND} x2={TOP_X} y2={GROUND - g.len * Math.sin(g.al)} offset={off} />
      <Txt x={mx} y={my + h / 2} anchor="middle" size={0.9} weight={650}>
        {text}
      </Txt>
    </>
  );
}

/** Fraktlapp på kassen, nede til høyre på siden, der ingen kraftpiler går. (x, y, rotate) som for Kasse. */
function Fraktlapp({ x, y, rotate, text }: { x: number; y: number; rotate: number; text: string }) {
  const ss = useStrokeScale();
  const pw = BOX_W * 0.37;
  const ph = BOX_H * 0.26;
  const lx = BOX_W * 0.12;
  const ly = -BOX_H * 0.06 - ph;
  const fs = Math.min(ph * 0.72, pw / (Math.max(1.6, text.length) * 0.6));
  return (
    <g transform={`translate(${x} ${y}) rotate(${rotate})`}>
      <rect x={lx} y={ly} width={pw} height={ph} rx={1.5} fill={PAINTS.hvit} stroke={shade(PAINTS.hvit, 0.35)} strokeWidth={0.7 * ss} />
      <text x={lx + pw / 2} y={ly + ph / 2 + fs * 0.36} fontSize={fs} fontWeight={700} textAnchor="middle" fill={PAINTS.svart}>
        {text}
      </text>
    </g>
  );
}

/** Vinkelbue for rampevinkelen (eller grensevinkelen) i hjørnet nede til venstre, med glorie så den synes mot treverket. */
function AngleMark({ x, y, alphaDeg, label }: { x: number; y: number; alphaDeg: number; label: ReactNode }) {
  const ss = useStrokeScale();
  const al = alphaDeg * RAD;
  const r = ARC_FOOT;
  const d = `M${x + r},${y} A${r},${r} 0 0 0 ${x + r * Math.cos(al)},${y - r * Math.sin(al)}`;
  const mid = al / 2;
  return (
    <g>
      <path d={d} fill="none" stroke={VIZ.surface} strokeWidth={5 * ss} opacity={0.85} />
      <path d={d} fill="none" stroke={VIZ.ink} strokeWidth={2.2 * ss} />
      <Txt x={x + (r + 14) * Math.cos(mid)} y={y - (r + 14) * Math.sin(mid) + 6} anchor="start" size={1} weight={700}>
        {label}
      </Txt>
    </g>
  );
}

/** Vinkelen α mellom G (loddrett ned) og G⊥ (vinkelrett inn mot rampa), ved tyngdepunktet. */
function CmAngle({ x, y, alphaDeg }: { x: number; y: number; alphaDeg: number }) {
  const ss = useStrokeScale();
  const al = alphaDeg * RAD;
  const r = ARC_CM;
  // G peker rett ned (90° i SVG), G⊥ peker 90° − α (ned og mot høyre).
  const d = `M${x},${y + r} A${r},${r} 0 0 0 ${x + r * Math.sin(al)},${y + r * Math.cos(al)}`;
  const mid = Math.PI / 2 - al / 2;
  const lr = r + 13;
  return (
    <g>
      <path d={d} fill="none" stroke={VIZ.surface} strokeWidth={5 * ss} opacity={0.85} />
      <path d={d} fill="none" stroke={VIZ.ink} strokeWidth={2 * ss} />
      <Txt x={x + lr * Math.cos(mid)} y={y + lr * Math.sin(mid) + 6} anchor="middle" size={0.95} weight={700}>
        α
      </Txt>
    </g>
  );
}
