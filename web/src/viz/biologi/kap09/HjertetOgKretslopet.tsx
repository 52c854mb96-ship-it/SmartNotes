import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  BIO,
  Controls,
  Explain,
  Figure,
  Forvalg,
  Formula,
  FormulaLine,
  Legend,
  PlayBar,
  Plot,
  Readout,
  Readouts,
  Slider,
  Toggle,
  Toolbar,
  Txt,
  VIZ,
  VizLayout,
  fmt,
  linePath,
  mixColor,
  roundedRectPath,
  useContainerTextScale,
  useLineScale,
  useSimClock,
} from '../kit';
import {
  BLOOD_VOLUME,
  HEART_PHASE_NAMES,
  HEART_PRESETS,
  cardiacOutput,
  circulationTime,
  cycleTiming,
  ejectedVolume,
  endSystolicVolume,
  heartAt,
  type HeartPhase,
  type HeartState,
} from './model';

const RED = BIO.oksygenrikt;
const BLUE = BIO.oksygenfattig;
/** Klaffene: grønne når de er åpne, mørke når de er lukket (ikke rødt, som er oksygenrikt blod). */
const VALVE_OPEN = BIO.sir.R;
const VALVE_SHUT = VIZ.ink;
/** Blod (mL) som flytter prikkene én runde rundt i figuren (ikke i målestokk: i virkeligheten 5 L). */
const LAP_ML = 900;

export default function HjertetOgKretslopet() {
  const [HR, setHR] = useState(70);
  const [SV, setSV] = useState(70);
  const [realtime, setRealtime] = useState(false);
  const clock = useSimClock({ tMax: 60, speed: realtime ? 1 : 0.3, loop: true });
  const { setT, pause } = clock;
  const timing = cycleTiming(HR);
  // Start midt i hjertekammersystolen, så klaffene og blodstrømmen synes før man trykker «Spill av»
  useEffect(() => setT(0.25), [setT]);
  const t = clock.t;
  const st = heartAt(t, HR, SV);
  const co = cardiacOutput(HR, SV);
  const preset = HEART_PRESETS.find((p) => p.HR === HR && p.SV === SV)?.id ?? null;
  const jump = (phase: HeartPhase) => {
    pause();
    const start = st.beat * timing.T;
    const mid =
      phase === 'forkammersystole'
        ? timing.atrial / 2
        : phase === 'hjertekammersystole'
          ? timing.atrial + timing.systole * 0.45
          : timing.atrial + timing.systole + timing.diastole * 0.5;
    setT(start + mid);
  };

  return (
    <VizLayout>
      <Toolbar>
        <Forvalg
          label="Situasjon"
          options={HEART_PRESETS.map((p) => ({ value: p.id, label: p.name, detail: `${fmt(cardiacOutput(p.HR, p.SV), 1)} L/min` }))}
          value={preset}
          onPick={(id) => {
            const p = HEART_PRESETS.find((x) => x.id === id)!;
            setHR(p.HR);
            setSV(p.SV);
          }}
        />
      </Toolbar>
      <Controls>
        <Slider label="Puls" value={HR} onChange={setHR} min={40} max={200} step={1} unit="slag/min" />
        <Slider label="Slagvolum" value={SV} onChange={setSV} min={40} max={150} step={1} unit="mL" />
      </Controls>
      <Toolbar>
        <PlayBar clock={clock} time={`t = ${fmt(t, 2)} s`} />
        <Toggle label="Sanntid (ellers sakte film)" checked={realtime} onChange={setRealtime} />
      </Toolbar>
      <Toolbar>
        <Forvalg
          label="Gå til"
          options={[
            { value: 'forkammersystole' as const, label: 'Forkammersystole' },
            { value: 'hjertekammersystole' as const, label: 'Systole' },
            { value: 'diastole' as const, label: 'Diastole' },
          ]}
          value={st.phase}
          onPick={jump}
        />
      </Toolbar>

      <CirculationFigure st={st} t={t} HR={HR} SV={SV} />
      <Legend
        items={[
          { color: RED, label: 'Oksygenrikt blod' },
          { color: BLUE, label: 'Oksygenfattig blod' },
          { color: VALVE_OPEN, label: 'Klaff åpen' },
          { color: VALVE_SHUT, label: 'Klaff lukket' },
        ]}
      />

      <VolumePlot HR={HR} SV={SV} t={t} />
      <Legend
        items={[
          { color: BIO.dna, label: 'Volum i hjertekammeret' },
          { color: RED, label: 'Systole (hjertekamrene trekker seg sammen)' },
        ]}
      />

      <Readouts>
        <Readout label="Minuttvolum" value={fmt(co, 1)} unit="L/min" tone={RED} />
        <Readout label="Tid per hjerteslag" value={fmt(timing.T, 2)} unit="s" />
        <Readout label="Diastolen varer" value={fmt(timing.diastole, 2)} unit="s" />
        <Readout label="Hele blodet rundt på" value={fmt(circulationTime(HR, SV) * 60, 0)} unit="s" />
      </Readouts>

      <Formula label="Minuttvolum">
        <FormulaLine>
          Minuttvolum = puls · slagvolum = {fmt(HR, 0)} /min · {fmt(SV, 0)} mL = {fmt(HR * SV, 0)} mL/min ≈ {fmt(co, 1)} L/min
        </FormulaLine>
        <FormulaLine>
          Blodvolum {fmt(BLOOD_VOLUME, 0)} L / {fmt(co, 1)} L/min = {fmt(circulationTime(HR, SV), 2)} min for én runde
        </FormulaLine>
      </Formula>

      <Explain>{explanation(st, HR, SV, co)}</Explain>
    </VizLayout>
  );
}

/* ====================================================================== */
/* Det doble kretsløpet med hjertet                                         */
/* ====================================================================== */

interface Pt {
  x: number;
  y: number;
}

function polyLength(pts: readonly Pt[]): number[] {
  const acc = [0];
  for (let i = 1; i < pts.length; i++) acc.push(acc[i - 1]! + Math.hypot(pts[i]!.x - pts[i - 1]!.x, pts[i]!.y - pts[i - 1]!.y));
  return acc;
}

function pointAt(pts: readonly Pt[], acc: readonly number[], s: number): Pt {
  const L = acc[acc.length - 1]!;
  const d = (((s % 1) + 1) % 1) * L;
  let i = 1;
  while (i < acc.length - 1 && acc[i]! < d) i++;
  const a = pts[i - 1]!;
  const b = pts[i]!;
  const seg = acc[i]! - acc[i - 1]!;
  const u = seg > 0 ? (d - acc[i - 1]!) / seg : 0;
  return { x: a.x + (b.x - a.x) * u, y: a.y + (b.y - a.y) * u };
}

function CirculationFigure({ st, t, HR, SV }: { st: HeartState; t: number; HR: number; SV: number }) {
  const [ref, f] = useContainerTextScale<HTMLDivElement>();
  const lw = useLineScale();
  const narrow = f > 1.3;
  const k = Math.max(1, f * 0.85);
  const H0 = Math.round(600 + 60 * (f - 1));
  // På mobil forstørres tegningen litt (kretsløpet har plass i bredden), så kamrene og etikettene blir lesbare
  const zoom = narrow ? 1.12 : 1;
  const H = Math.round(H0 * zoom);
  const yLung = 70;
  const yBody = H0 - 70;
  // Kamrene (sett forfra: hjertets høyre side til venstre i figuren)
  const aSq = 1 - 0.14 * st.atrialSqueeze;
  const vSq = 1 - 0.16 * st.ventricularSqueeze;
  const RA = { x: 285, y: 240, w: 150 * aSq, h: 96 * aSq };
  const LA = { x: 515, y: 240, w: 150 * aSq, h: 96 * aSq };
  const RV = { x: 318, y: 368, w: 150 * vSq, h: 150 * vSq };
  const LV = { x: 482, y: 368, w: 150 * vSq, h: 150 * vSq };
  const yValveAV = 292;
  const path: Pt[] = [
    { x: 285, y: 240 },
    { x: 300, y: yValveAV },
    { x: 318, y: 368 },
    { x: 378, y: 312 },
    { x: 378, y: 150 },
    { x: 250, y: 150 },
    { x: 250, y: yLung + 20 },
    { x: 330, y: yLung - 6 },
    { x: 400, y: yLung + 14 },
    { x: 470, y: yLung - 6 },
    { x: 550, y: yLung + 20 },
    { x: 550, y: 150 },
    { x: 530, y: 196 },
    { x: 515, y: 240 },
    { x: 500, y: yValveAV },
    { x: 482, y: 368 },
    { x: 422, y: 312 },
    { x: 422, y: 125 },
    { x: 720, y: 125 },
    { x: 720, y: yBody },
    { x: 640, y: yBody },
    { x: 560, y: yBody + 16 },
    { x: 480, y: yBody - 14 },
    { x: 400, y: yBody + 16 },
    { x: 320, y: yBody - 14 },
    { x: 240, y: yBody + 16 },
    { x: 160, y: yBody },
    { x: 80, y: yBody },
    { x: 80, y: 240 },
    { x: 210, y: 240 },
    { x: 285, y: 240 },
  ];
  const acc = polyLength(path);
  const L = acc[acc.length - 1]!;
  const sAt = (i: number) => acc[i]! / L;
  // Fargen langs banen: blått fra midt i kroppen til lungene, rødt fra lungene til kroppen
  const lungIn = sAt(6);
  const lungOut = sAt(10);
  const bodyIn = sAt(20);
  const bodyOut = sAt(26);
  const colorAt = (s: number) => {
    const x = ((s % 1) + 1) % 1;
    if (x >= lungIn && x <= lungOut) return mixColor(BLUE, RED, (x - lungIn) / (lungOut - lungIn));
    if (x >= bodyIn && x <= bodyOut) return mixColor(RED, BLUE, (x - bodyIn) / (bodyOut - bodyIn));
    if (x > lungOut && x < bodyIn) return RED;
    return BLUE;
  };
  const N = 64;
  const flow = ejectedVolume(t, HR, SV) / LAP_ML;
  const r = 5.2 * k;
  const vessel = (from: number, to: number, color: string, w = 16) => (
    <path
      d={linePath(
        path.slice(from, to + 1).map((p) => [p.x, p.y] as [number, number]),
        (v) => v,
        (v) => v,
      )}
      fill="none"
      stroke={color}
      strokeOpacity={0.28}
      strokeWidth={w}
      strokeLinejoin="round"
      strokeLinecap="round"
    />
  );
  const chamber = (c: { x: number; y: number; w: number; h: number }, color: string, thick = 2) => (
    <path
      d={roundedRectPath(c.x - c.w / 2, c.y - c.h / 2, c.w, c.h, Math.min(c.w, c.h) * 0.32)}
      fill={mixColor(BIO.cytoplasma, color, 0.32)}
      stroke={BIO.membran}
      strokeWidth={thick * lw}
    />
  );
  // Klaffer: to flapper som henger ned i hjertekammeret når de er åpne, og møtes når de er lukket
  const valve = (x: number, y: number, open: boolean, dir: 1 | -1, key: string) => {
    const len = 20;
    const a = open ? 70 : 0;
    const rad = (a * Math.PI) / 180;
    const col = open ? VALVE_OPEN : VALVE_SHUT;
    return (
      <g key={key}>
        <line
          x1={x - len - 4}
          y1={y}
          x2={x - 4 - len + len * Math.cos(rad)}
          y2={y + dir * len * Math.sin(rad)}
          stroke={col}
          strokeWidth={5 * lw}
          strokeLinecap="round"
        />
        <line
          x1={x + len + 4}
          y1={y}
          x2={x + 4 + len - len * Math.cos(rad)}
          y2={y + dir * len * Math.sin(rad)}
          stroke={col}
          strokeWidth={5 * lw}
          strokeLinecap="round"
        />
      </g>
    );
  };
  const label = (x: number, y: number, text: string, anchor: 'start' | 'middle' | 'end' = 'middle', color?: string, size = 0.75) => (
    <Txt x={x} y={y} anchor={anchor} size={size} weight={650} color={color}>
      {text}
    </Txt>
  );
  return (
    <div ref={ref}>
      <Figure
        viewBox={`0 0 800 ${H}`}
        maxHeight={narrow ? 900 : 600}
        label={`Hjertet og det doble kretsløpet. ${HEART_PHASE_NAMES[st.phase]}. Volum i hvert hjertekammer ${fmt(st.volume, 0)} mL.`}
        caption="Sett forfra: hjertets høyre side er til venstre i figuren. Blodmengden og farten i figuren er ikke i målestokk."
      >
        <g transform={zoom === 1 ? undefined : `translate(400 0) scale(${zoom}) translate(-400 0)`}>
          {/* Lungene og kroppen */}
          <path
            d={roundedRectPath(220, yLung - 44, 360, 92, 30)}
            fill={mixColor(BIO.vannFyll, RED, 0.08)}
            stroke={VIZ.grid}
            strokeWidth={1.5}
          />
          <path
            d={roundedRectPath(130, yBody - 40, 620, 84, 30)}
            fill={mixColor(BIO.cytoplasma, BLUE, 0.06)}
            stroke={VIZ.grid}
            strokeWidth={1.5}
          />
          {label(400, yLung - 22, 'Lungene (lungekapillærer)', 'middle', undefined, 0.8)}
          {label(
            narrow ? 420 : 400,
            yBody + 34 + 6 * (f - 1),
            narrow ? 'Kroppen' : 'Kroppen (kapillærer i organene)',
            'middle',
            undefined,
            0.8,
          )}
          {/* Blodårene */}
          {vessel(0, 2, BLUE, 20)}
          {vessel(3, 6, BLUE)}
          {vessel(6, 10, mixColor(BLUE, RED, 0.5), 10)}
          {vessel(10, 13, RED)}
          {vessel(13, 15, RED, 20)}
          {vessel(16, 20, RED, 18)}
          {vessel(20, 26, mixColor(RED, BLUE, 0.5), 10)}
          {vessel(26, 30, BLUE, 18)}
          {/* Hjertet */}
          {chamber(RA, BLUE)}
          {chamber(RV, BLUE, 2.2)}
          {chamber(LA, RED)}
          {chamber(LV, RED, 4.5)}
          <line x1={400} x2={400} y1={318} y2={440} stroke={BIO.membran} strokeWidth={6 * lw} strokeLinecap="round" />
          {/* Klaffene */}
          {valve(300, yValveAV, st.avOpen, 1, 'avh')}
          {valve(500, yValveAV, st.avOpen, 1, 'avv')}
          {valve(378, 308, st.semilunarOpen, -1, 'pulm')}
          {valve(422, 308, st.semilunarOpen, -1, 'aorta')}
          {/* Blodet */}
          {Array.from({ length: N }, (_, i) => {
            const s = i / N + flow;
            const p = pointAt(path, acc, s);
            return <circle key={i} cx={p.x} cy={p.y} r={r} fill={colorAt(s)} stroke={VIZ.surface} strokeWidth={1.1 * lw} />;
          })}
          {/* Etiketter */}
          {[
            [RA, 'Høyre', 'forkammer'],
            [LA, 'Venstre', 'forkammer'],
            [RV, 'Høyre', 'hjertekammer'],
            [LV, 'Venstre', 'hjertekammer'],
          ].map(([c, a, b]) => {
            const box = c as typeof RA;
            return (
              <g key={`${a}${b}`}>
                <Txt x={box.x} y={box.y - 2} size={narrow ? 0.62 : 0.7} weight={650}>
                  {a as string}
                </Txt>
                <Txt x={box.x} y={box.y + (narrow ? 14 : 16) * f} size={narrow ? 0.62 : 0.7} weight={650}>
                  {b as string}
                </Txt>
              </g>
            );
          })}
          {!narrow && (
            <g>
              {label(240, 170, 'Lungearterien', 'end', BLUE)}
              {label(562, 172, 'Lungevenene', 'start', RED)}
              {label(574, 116, 'Aorta', 'start', RED)}
              {label(92, 340, 'Hulvenene', 'start', BLUE)}
              {label(258, yValveAV + 6, 'seilklaff', 'end')}
              {label(542, yValveAV + 6, 'seilklaff', 'start')}
              {label(400, 268, 'lommeklaffer', 'middle', undefined, 0.65)}
              {label(740, 300, 'Kropps-', 'start', undefined, 0.72)}
              {label(740, 320, 'kretsløpet', 'start', undefined, 0.72)}
              {label(600, 40, 'Lungekretsløpet', 'start', undefined, 0.72)}
            </g>
          )}
        </g>
        {/* Fasen */}
        <Txt x={20} y={narrow ? H - 10 : 128} anchor="start" size={0.85} weight={700}>
          {st.phase === 'hjertekammersystole' ? 'Systole' : st.phase === 'diastole' ? 'Diastole' : 'Forkammersystole'}
        </Txt>
      </Figure>
    </div>
  );
}

/* ====================================================================== */
/* Volumet i hjertekammeret                                                 */
/* ====================================================================== */

function VolumePlot({ HR, SV, t }: { HR: number; SV: number; t: number }) {
  const [ref, f] = useContainerTextScale<HTMLDivElement>();
  const H = Math.round(300 + 240 * (f - 1));
  const c = cycleTiming(HR);
  const span = 3 * c.T;
  const pts = useMemo(() => {
    const out: [number, number][] = [];
    for (let s = 0; s <= span + 1e-9; s += span / 300) out.push([s, heartAt(s, HR, SV).volume]);
    return out;
  }, [HR, SV, span]);
  const tt = t % span;
  const esv = endSystolicVolume(SV);
  const edv = esv + SV;
  const ticks = Array.from({ length: Math.floor(span / 0.5) + 1 }, (_, i) => i * 0.5).filter((v) => v <= span + 1e-9);
  return (
    <div ref={ref}>
      <Figure viewBox={`0 0 800 ${H}`} label={`Volumet i hjertekammeret over tre hjerteslag: fra ${fmt(edv, 0)} til ${fmt(esv, 0)} mL.`}>
        <Plot
          x={{ min: 0, max: span, label: 'Tid (s)', ticks, decimals: 1 }}
          y={{ min: 0, max: 220, label: 'Volum (mL)', ticks: [0, 50, 100, 150, 200] }}
          width={800}
          height={H}
        >
          {({ sx, sy, x0, x1, y0, y1 }) => (
            <g>
              {[0, 1, 2].map((b) => (
                <rect
                  key={b}
                  x={sx(b * c.T + c.atrial)}
                  y={y1}
                  width={sx(b * c.T + c.atrial + c.systole) - sx(b * c.T + c.atrial)}
                  height={y0 - y1}
                  fill={RED}
                  opacity={0.1}
                />
              ))}
              <line x1={x0} x2={x1} y1={sy(edv)} y2={sy(edv)} stroke={VIZ.muted} strokeWidth={1.2} strokeDasharray="4 5" />
              <line x1={x0} x2={x1} y1={sy(esv)} y2={sy(esv)} stroke={VIZ.muted} strokeWidth={1.2} strokeDasharray="4 5" />
              <Txt x={x1 - 6} y={sy(edv) - 8} anchor="end" size={0.8} weight={650}>
                {`slagvolum = ${fmt(edv, 0)} − ${fmt(esv, 0)} = ${fmt(SV, 0)} mL`}
              </Txt>
              <path d={linePath(pts, sx, sy)} fill="none" stroke={BIO.dna} strokeWidth={3.2} />
              <line x1={sx(tt)} x2={sx(tt)} y1={y0} y2={y1} className="viz-guide" />
              <circle cx={sx(tt)} cy={sy(heartAt(tt, HR, SV).volume)} r={7} fill={BIO.dna} stroke={VIZ.surface} strokeWidth={2.5} />
            </g>
          )}
        </Plot>
      </Figure>
    </div>
  );
}

/* ====================================================================== */
/* Forklaring                                                               */
/* ====================================================================== */

function explanation(st: HeartState, HR: number, SV: number, co: number): ReactNode {
  let phase: ReactNode;
  if (st.phase === 'forkammersystole')
    phase = (
      <p>
        <strong>Forkamrene trekker seg sammen.</strong> Seilklaffene mellom forkamrene og hjertekamrene er åpne, og forkamrene presser det
        siste blodet ned i hjertekamrene. Det meste av blodet har allerede rent ned av seg selv i diastolen. Lommeklaffene er lukket, så
        blodet i aorta og lungearterien renner ikke tilbake.
      </p>
    );
  else if (st.phase === 'hjertekammersystole')
    phase = (
      <p>
        <strong>Systole: hjertekamrene trekker seg sammen.</strong> Trykket stiger, og seilklaffene smekker igjen (den første hjertelyden),
        så blodet ikke går tilbake til forkamrene.{' '}
        {st.semilunarOpen ? 'Lommeklaffene er åpne, og' : 'Når trykket er høyt nok, åpnes lommeklaffene, og'} {fmt(SV, 0)} mL blod presses
        ut fra hvert hjertekammer: fra høyre hjertekammer til lungearterien og fra venstre til aorta.
      </p>
    );
  else
    phase = (
      <p>
        <strong>Diastole: hjertet slapper av.</strong> Lommeklaffene lukkes (den andre hjertelyden), og blod fra hulvenene og lungevenene
        renner gjennom forkamrene og de åpne seilklaffene ned i hjertekamrene. Ved høy puls blir diastolen kort, så det blir mindre tid til
        å fylle hjertet.
      </p>
    );
  const circuits = (
    <p>
      <strong>Dobbelt kretsløp.</strong> Høyre side av hjertet pumper oksygenfattig blod til lungene (lungekretsløpet), der det tar opp O₂
      og avgir CO₂. Venstre side pumper det oksygenrike blodet ut i kroppen (kroppskretsløpet). Begge sider pumper like mye blod per slag,
      men venstre hjertekammer har tykkere vegg fordi trykket må være mye høyere for å presse blodet gjennom hele kroppen. Legg merke til at
      lungearterien fører oksygenfattig blod: arterier fører blod fra hjertet, vener fører blod til hjertet.
    </p>
  );
  const output =
    co < 3.5 ? (
      <p>
        Minuttvolumet er bare {fmt(co, 1)} L/min, mye mindre enn de ca. 5 L/min kroppen trenger i hvile.{' '}
        {HR < 60 && SV < 60 ? 'Med så lav puls og så lite slagvolum' : HR < 60 ? 'Med så lav puls' : 'Med så lite slagvolum'} får organene
        for lite blod og oksygen. Hos friske øker pulsen eller slagvolumet automatisk; ved hjertesvikt klarer ikke hjertet å pumpe nok.
      </p>
    ) : co < 6 ? (
      <p>
        Minuttvolumet er {fmt(co, 1)} L/min, omtrent som i hvile (ca. 5 L/min).{' '}
        {HR < 60 && SV > 85 ? 'En godt trent person har stort slagvolum og kan derfor ha lav hvilepuls.' : ''}
      </p>
    ) : (
      <p>
        Minuttvolumet er {fmt(co, 1)} L/min, {fmt(co / 5, 1)} ganger så mye som i hvile. Under arbeid trenger musklene mer O₂, og hjertet
        øker både pulsen og slagvolumet. Godt trente utholdenhetsutøvere kan komme over 30 L/min.
      </p>
    );
  return (
    <>
      {phase}
      {circuits}
      {output}
    </>
  );
}
