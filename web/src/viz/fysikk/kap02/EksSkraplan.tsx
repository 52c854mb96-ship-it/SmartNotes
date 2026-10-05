import { useState } from 'react';
import { Figure, Sub, TSub, Txt, VIZ, WorkedExample, fmt, useTextScale, type ExampleStep, type FigureState } from '../../kit';
import {
  Callout,
  Dimension,
  ForceArrow,
  Himmel,
  Kasse,
  Landskap,
  LinearGradient,
  Rampe,
  SCENE,
  Underlag,
  materialStops,
  rampePunkt,
  shade,
  useSvgId,
} from '../../kit/scene';
import { RAMP_TASKS, solveRampTask, type RampSolution, type RampTask } from './model';

const RAD = Math.PI / 180;

/**
 * Eksempeloppgave (2C, 2E): en kasse sklir ned en rampe fra en lasterampe. Oppgaven er laget for appen
 * (egen tekst og egne tall) i samme stil som eksamensoppgaver: krefter, dekomponering, Newtons 2. lov,
 * bevegelseslikning og grensevinkel.
 */
export default function EksSkraplan() {
  const [variant, setVariant] = useState(0);
  const task = RAMP_TASKS[variant] ?? RAMP_TASKS[0]!;
  const s = solveRampTask(task);
  const { m, alphaDeg, muK, muS, L } = task;
  const deg = `${fmt(alphaDeg, 0)}°`;

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
          normalen til rampa er like stor som rampevinkelen α.
        </p>
      ),
      math: [
        <>
          G = mg = {fmt(m, 0)} kg · 9,81 m/s² = {fmt(s.G, 0)} N
        </>,
        <>
          G<Sub>∥</Sub> = G · sin α = {fmt(s.G, 0)} N · sin {deg} = {fmt(s.Gpar, 0)} N
        </>,
        <>
          G<Sub>⊥</Sub> = G · cos α = {fmt(s.G, 0)} N · cos {deg} = {fmt(s.Gperp, 0)} N
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
          N = G<Sub>⊥</Sub> = {fmt(s.N, 0)} N
        </>,
        <>
          R = μ<Sub>k</Sub> · N = {fmt(muK, 2)} · {fmt(s.N, 0)} N = {fmt(s.R, 1)} N
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
          ΣF = G<Sub>∥</Sub> − R = {fmt(s.Gpar, 1)} N − {fmt(s.R, 1)} N = {fmt(s.sumF, 1)} N
        </>,
        <>
          a = ΣF / m = {fmt(s.sumF, 1)} N / {fmt(m, 0)} kg = {fmt(s.a, 2)} m/s²
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
          Kontroller med tiden: t = v / a = {fmt(s.v, 2)} / {fmt(s.a, 2)} = {fmt(s.t, 1)} s, og s = ½at² = ½ · {fmt(s.a, 2)} · {fmt(s.t, 2)}² ={' '}
          {fmt(L, 1)} m.
        </>
      ),
    },
    {
      part: 'd',
      title: 'Når begynner kassen å gli av seg selv?',
      body: (
        <p>
          Kassen ligger i ro så lenge den statiske friksjonen klarer å holde igjen: G<Sub>∥</Sub> ≤ μ<Sub>s</Sub>N. På grensen er de like store.
          Både G<Sub>∥</Sub> og N inneholder mg, som forkortes bort.
        </p>
      ),
      math: [
        <>
          mg · sin α = μ<Sub>s</Sub> · mg · cos α ⇒ tan α = μ<Sub>s</Sub>
        </>,
        <>
          α = tan⁻¹ {fmt(muS, 2)} = {fmt(s.critDeg, 1)}°
        </>,
      ],
      answer: (
        <>
          Rampa må være minst {fmt(s.critDeg, 0)}° bratt. Med {deg} glir kassen av seg selv, fordi tan {deg} = {fmt(Math.tan(alphaDeg * RAD), 2)}{' '}
          er større enn μ<Sub>s</Sub> = {fmt(muS, 2)}.
        </>
      ),
      pitfall: 'Her skal du bruke det statiske friksjonstallet, ikke glidefriksjonstallet: spørsmålet er når kassen begynner å gli.',
    },
  ];

  return (
    <WorkedExample
      variants={{ labels: ['Tallsett 1', 'Tallsett 2', 'Tallsett 3'], value: variant, onChange: setVariant }}
      intro={
        <p>
          På et lager skal en kasse med varer ned fra en lasterampe. En arbeider legger en planke fra kanten av lasterampa ned til bakken og
          slipper kassen øverst på planken. Kassen har massen {fmt(m, 0)} kg, planken er {fmt(L, 1)} m lang og danner vinkelen {deg} med bakken.
          Glidefriksjonstallet mellom kassen og planken er {fmt(muK, 2)}, og det statiske friksjonstallet er {fmt(muS, 2)}.
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
        { id: 'a', text: 'Tegn kreftene som virker på kassen mens den sklir nedover planken.' },
        { id: 'b', text: `Vis at akselerasjonen til kassen er ${fmt(s.a, 1)} m/s².` },
        { id: 'c', text: 'Hvor stor fart har kassen når den når bakken?' },
        { id: 'd', text: 'Hvor bratt må planken minst være for at kassen skal begynne å gli av seg selv?' },
      ]}
      steps={steps}
      figure={(state) => <RampFigure task={task} s={s} state={state} />}
    />
  );
}

/* ---------- Figuren ---------- */

const W = 800;
const GROUND = 372;
/** Piksler per meter langs rampa. */
const PX_PER_M = 128;
/** Lengden på G-pila (piksler); de andre kreftene tegnes i samme skala. */
const G_LEN = 118;

function RampFigure({ task, s, state }: { task: RampTask; s: RampSolution; state: FigureState }) {
  const f = useTextScale();
  const { step, showAll } = state;
  const al = task.alphaDeg * RAD;
  const len = task.L * PX_PER_M;
  // Rampa starter på bakken til venstre og går opp mot høyre til kanten av lasterampa.
  const x0 = 130;
  const ramp = { x: x0, y: GROUND, lengde: len, vinkel: task.alphaDeg, retning: 'opp-hoyre' as const, materiale: 'tre' as const };
  const topX = x0 + len * Math.cos(al);
  const topY = GROUND - len * Math.sin(al);

  // Kassen: øverst mens kreftene finnes (a, b), nederst i c, øverst igjen i d.
  const atBottom = !showAll && step === 5;
  const sAlong = atBottom ? 0.12 * len : 0.62 * len;
  const p = rampePunkt(ramp, sAlong);
  const boxW = 64;
  const boxH = 50;
  // Midten av kassen ligger en halv kassehøyde ut fra rampa (normalen peker opp og til venstre).
  const nx = -Math.sin(al);
  const ny = -Math.cos(al);
  const cx = p.x + (nx * boxH) / 2;
  const cy = p.y + (ny * boxH) / 2;
  // Retning ned langs rampa (mot venstre og ned) og opp langs rampa.
  const dx = -Math.cos(al);
  const dy = Math.sin(al);

  const k = G_LEN / s.G;
  const showForces = showAll || (step >= 1 && step <= 4) || step === 6;
  const showParts = showAll || (step >= 2 && step <= 4);
  const showSum = !showAll && step === 4;
  const showVelocity = atBottom;
  const showAngle = showAll || step === 2 || step === 6;

  return (
    <Figure
      viewBox={`0 0 ${W} 420`}
      label={`En kasse på ${fmt(task.m, 0)} kg på en planke som danner ${fmt(task.alphaDeg, 0)} grader med bakken, fra en lasterampe ned til bakken.`}
      maxHeight={440}
    >
      <Himmel x={0} y={0} w={W} h={GROUND} skyer={2} seed={4} />
      <Landskap x={0} y={GROUND} w={W} h={120} type="aaser" seed={2} />
      <Underlag x1={0} x2={W} y={GROUND} depth={48} type="betong" />
      <Lasterampe x={topX} y={topY} />
      <Rampe {...ramp} />
      <Kasse x={p.x} y={p.y} w={boxW} h={boxH} materiale="papp" rotate={p.rotate} label={`${fmt(task.m, 0)} kg`} />

      {showAngle && <AngleMark x={x0} y={GROUND} alphaDeg={task.alphaDeg} r={70} strong={step === 6} />}
      {showVelocity && (
        <>
          <ForceArrow x1={cx} y1={cy} x2={cx + dx * 22 * s.v} y2={cy + dy * 22 * s.v} color={VIZ.velocity} label="v" width={6} />
          <Dimension x1={x0} y1={GROUND} x2={topX} y2={topY} offset={-34} label={`s = ${fmt(task.L, 1)} m`} />
        </>
      )}

      {showForces && (
        <>
          {showParts && (
            <>
              <ForceArrow x1={cx} y1={cy} x2={cx + dx * s.Gpar * k} y2={cy + dy * s.Gpar * k} color={VIZ.gravity} dashed label={<>G∥</>} />
              <ForceArrow x1={cx} y1={cy} x2={cx - nx * s.Gperp * k} y2={cy - ny * s.Gperp * k} color={VIZ.gravity} dashed label={<>G⊥</>} />
            </>
          )}
          <ForceArrow x1={cx} y1={cy} x2={cx} y2={cy + G_LEN} color={VIZ.gravity} label="G" origin />
          <ForceArrow x1={cx} y1={cy} x2={cx + nx * s.N * k} y2={cy + ny * s.N * k} color={VIZ.normal} label="N" />
          <ForceArrow x1={cx} y1={cy} x2={cx - dx * s.R * k} y2={cy - dy * s.R * k} color={VIZ.friction} label="R" />
          {showSum && (
            <ForceArrow
              x1={cx + nx * 46}
              y1={cy + ny * 46}
              x2={cx + nx * 46 + dx * s.sumF * k}
              y2={cy + ny * 46 + dy * s.sumF * k}
              color={VIZ.acceleration}
              width={5}
              label="ΣF"
            />
          )}
        </>
      )}

      {step === 6 && !showAll && (
        <Callout x={x0 + 40} y={GROUND - 12} lx={x0 + 120} ly={GROUND + 30 * f}>
          tan α = μ<TSub>s</TSub> ⇒ α = {fmt(s.critDeg, 1)}°
        </Callout>
      )}
    </Figure>
  );
}

/** Kanten av lasterampa (betong) som planken ligger mot. (x, y) er hjørnet øverst til venstre. */
function Lasterampe({ x, y }: { x: number; y: number }) {
  const id = useSvgId('lasterampe');
  return (
    <g>
      <LinearGradient id={id} stops={materialStops(SCENE.concrete)} />
      <rect x={x} y={y} width={W - x + 2} height={GROUND - y} fill={`url(#${id})`} stroke={SCENE.outline} strokeWidth={1} />
      <rect x={x} y={y} width={W - x + 2} height={7} fill={shade(SCENE.concrete, 0.18)} />
    </g>
  );
}

/** Vinkelbue for rampevinkelen α i hjørnet nede til venstre. */
function AngleMark({ x, y, alphaDeg, r, strong }: { x: number; y: number; alphaDeg: number; r: number; strong?: boolean }) {
  const al = alphaDeg * RAD;
  const ex = x + r * Math.cos(al);
  const ey = y - r * Math.sin(al);
  const mid = al / 2;
  return (
    <g>
      <path d={`M${x + r},${y} A${r},${r} 0 0 0 ${ex},${ey}`} fill="none" stroke={strong ? VIZ.ink : VIZ.muted} strokeWidth={strong ? 2.4 : 1.6} />
      <Txt x={x + (r + 16) * Math.cos(mid)} y={y - (r + 16) * Math.sin(mid) + 6} anchor="start" size={strong ? 1 : 0.9} weight={700}>
        α
      </Txt>
    </g>
  );
}
