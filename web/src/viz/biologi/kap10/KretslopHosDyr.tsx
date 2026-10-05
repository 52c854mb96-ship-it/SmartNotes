import { useMemo, useState, type ReactNode } from 'react';
import {
  BIO,
  Controls,
  Explain,
  Figure,
  Formula,
  FormulaLine,
  Legend,
  PlayBar,
  Plot,
  Readout,
  Readouts,
  Segmented,
  Slider,
  Toolbar,
  Txt,
  Etikett,
  Fisk,
  VIZ,
  VizLayout,
  fmt,
  fmtPct,
  linePath,
  mixColor,
  useContainerTextScale,
  useSimClock,
  useSvgId,
  useTextScale,
} from '../kit';
import {
  ANIMALS,
  chamberText,
  circuit,
  getAnimal,
  locate,
  pointAlong,
  polylineLength,
  pressureProfile,
  saturations,
  segmentSpans,
  type Animal,
  type AnimalId,
  type Pt,
  type Saturations,
  type Segment,
} from './model';

/** Hvor mange sekunder blodet bruker på én runde i hvile (animasjonen, ikke virkeligheten). */
const LAP_SECONDS = 14;
const T_MAX = 600;

/** Fast fargeskala for O₂: fra det mest oksygenfattige (blått) til det mest oksygenrike (rødt) blodet i dyret. */
function satColorScale(s: Saturations, insect: boolean): (v: number) => string {
  if (insect) return () => BIO.insekt.line;
  const lo = s.venous;
  const hi = s.gasOut;
  return (v: number) => mixColor(BIO.oksygenfattig, BIO.oksygenrikt, hi > lo ? (v - lo) / (hi - lo) : 1);
}

export default function KretslopHosDyr() {
  const [id, setId] = useState<AnimalId>('amfibie');
  const [activity, setActivity] = useState(0.2);
  const animal = getAnimal(id);
  const segs = useMemo(() => circuit(animal, activity), [animal, activity]);
  const sat = saturations(animal, activity);
  const clock = useSimClock({ tMax: T_MAX, loop: true });
  const [ref, f] = useContainerTextScale<HTMLDivElement>();
  const insect = animal.system === 'åpent';
  const color = satColorScale(sat, insect);
  // Én runde tar kortere tid når hjertet slår fortere (aktivitet)
  const laps = (clock.t / LAP_SECONDS) * (1 + 1.5 * activity);
  // Blodcellen vi følger rundt (vises også i trykkgrafen)
  const tracked = laps % 1;

  return (
    <VizLayout>
      <Toolbar>
        <Segmented label="Velg dyregruppe" options={ANIMALS.map((a) => ({ value: a.id, label: a.name }))} value={id} onChange={setId} />
      </Toolbar>
      <Controls>
        <Slider
          label="Aktivitet"
          value={Math.round(activity * 100)}
          onChange={(v) => setActivity(v / 100)}
          min={0}
          max={100}
          step={5}
          format={(v) => (v === 0 ? 'hvile' : v === 100 ? 'hardt arbeid' : `${fmt(v, 0)} %`)}
        />
      </Controls>
      <Toolbar>
        <PlayBar clock={clock} time={`runde ${fmt(Math.floor(laps) + 1, 0)}`} />
      </Toolbar>

      <div ref={ref}>
        <Scene animal={animal} segs={segs} sat={sat} f={f} laps={laps} color={color} />
      </div>
      <Legend
        items={
          insect
            ? [
                { color: BIO.insekt.line, label: 'Hemolymfe (frakter næring, ikke O₂)' },
                { color: VIZ.muted, label: 'Trakeer (luftrør som frakter O₂)', dashed: true },
              ]
            : [
                { color: BIO.oksygenrikt, label: 'Oksygenrikt blod' },
                ...(animal.mixing > 0 ? [{ color: mixColor(BIO.oksygenfattig, BIO.oksygenrikt, 0.5), label: 'Blandet blod' }] : []),
                { color: BIO.oksygenfattig, label: 'Oksygenfattig blod' },
              ]
        }
      />

      <PressureFigure segs={segs} animal={animal} tracked={tracked} color={color} />
      <Legend
        items={[
          { color: VIZ.ink, label: 'Blodtrykk langs kretsløpet' },
          { color: VIZ.muted, label: 'Grått felt: hjertet (pumpe)' },
        ]}
      />

      <Readouts>
        <Readout
          label="Hjerterom"
          value={insect ? 'Rør' : String(animal.atria + animal.ventricles)}
          unit={insect ? '(ryggkaret)' : `(${chamberText(animal)})`}
        />
        <Readout
          label="O₂-metning i blodet ut til kroppen"
          value={insect ? 'Trakeene frakter O₂' : fmtPct(sat.arterial)}
          tone={insect ? undefined : color(sat.arterial)}
        />
        <Readout label="Blodtrykk ut til kroppen" value={fmt(animal.pBody, 0)} unit="mmHg" />
        <Readout
          label="Kroppstemperatur"
          value={animal.endotherm ? 'Endoterm' : 'Ektoterm'}
          tone={animal.endotherm ? BIO.oksygenrikt : undefined}
        />
      </Readouts>

      <Formula label="O₂-metningen i blodet">
        {insect ? (
          <FormulaLine>Hemolymfen har ikke hemoglobin og frakter nesten ikke O₂. Trykket i kroppshulen er bare ca. 1–5 mmHg.</FormulaLine>
        ) : animal.system === 'enkelt' ? (
          <>
            <FormulaLine>
              O₂-metning ut fra gjellene: {fmtPct(sat.gasOut)} · tilbake fra kroppen: {fmtPct(sat.venous)} (kroppen tok ut{' '}
              {fmt(sat.extracted * 100, 0)} prosentpoeng)
            </FormulaLine>
            <FormulaLine>
              Trykk: {fmt(animal.pGas, 0)} mmHg ut av hjertet, bare {fmt(animal.pBody, 0)} mmHg etter gjellene
            </FormulaLine>
          </>
        ) : animal.mixing > 0 ? (
          <>
            <FormulaLine>
              Til kroppen: (1 − m) · O₂ fra lungene + m · O₂ fra kroppen = {fmt(1 - animal.mixing, 2)} · {fmtPct(sat.gasOut)} +{' '}
              {fmt(animal.mixing, 2)} · {fmtPct(sat.venous)} = {fmtPct(sat.arterial)}
            </FormulaLine>
            <FormulaLine>
              Blanding m = {fmtPct(animal.mixing)} · til {animal.id === 'amfibie' ? 'lunger og hud' : 'lungene'}:{' '}
              {fmtPct(sat.toGas)} i stedet for {fmtPct(sat.venous)}
            </FormulaLine>
          </>
        ) : (
          <>
            <FormulaLine>
              Ingen blanding (m = 0): blodet til kroppen kommer bare fra lungene, {fmtPct(sat.arterial)} mettet · tilbake fra kroppen:{' '}
              {fmtPct(sat.venous)}
            </FormulaLine>
            <FormulaLine>
              Trykk: {fmt(animal.pBody, 0)} mmHg ut til kroppen og bare {fmt(animal.pGas, 0)} mmHg ut til lungene
            </FormulaLine>
          </>
        )}
      </Formula>

      <Explain>{explanation(animal, sat, activity)}</Explain>
    </VizLayout>
  );
}

/* ====================================================================== */
/* Scenen                                                                   */
/* ====================================================================== */

interface SceneProps {
  animal: Animal;
  segs: Segment[];
  sat: Saturations;
  f: number;
  laps: number;
  color: (v: number) => string;
}

function Scene(props: SceneProps) {
  return props.animal.system === 'åpent' ? <InsectScene {...props} /> : <CircuitScene {...props} />;
}

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Geometrien til et lukket kretsløp: kapillærnett, hjerterom og blodets vei (én brutt linje per del i `circuit`). */
interface CircuitGeometry {
  H: number;
  gas: Box;
  body: Box;
  /** Hjerterommene med navn (`tx`, `ty` = midten av teksten, som står unna blodets vei). */
  chambers: { id: string; box: Box; lines: string[]; tx: number; ty: number; sat: number | [number, number] }[];
  paths: Pt[][];
  septum?: { x: number; y1: number; y2: number };
  vesselLabels: { x: number; y: number; text: string; anchor: 'start' | 'end' }[];
  /** Krysning der lungearterien går over venen (tegnes med et lite brudd). */
  crossing?: Pt;
}

function circuitGeometry(animal: Animal, f: number, sat: Saturations): CircuitGeometry {
  const narrow = f > 1.3;
  const s = narrow ? 1.25 : 1;
  const bh = Math.round(48 + 30 * (f - 1));
  // Navnet på kapillærnettet står over det øverste og under det nederste feltet
  const titleH = Math.round(26 * f);
  const gasY = titleH + 4;
  const gasMid = gasY + bh / 2;
  const cw = narrow ? 178 : 122;
  const gap = 10;
  const ah = Math.round(76 * s + 8 * (f - 1));
  const vh = Math.round(96 * s + 8 * (f - 1));
  const heartTop = gasY + bh + Math.round(58 * s);
  const bedX0 = narrow ? 215 : 245;
  const bedX1 = 800 - bedX0;
  const gas: Box = { x: bedX0, y: gasY, w: bedX1 - bedX0, h: bh };
  // Tekstblokk i et hjerterom: ca. 2,5 linjer høy
  const fs = 17 * f * 0.72;

  if (animal.system === 'enkelt') {
    // Fisk: hjertet til venstre (forkammer under hjertekammeret), gjellene øverst, kroppen nederst, med klokka rundt.
    // Blodet går langs venstre side av hjerterommene, så navnene får plass til høyre.
    const hx = narrow ? 112 : 130;
    const px = hx - cw / 2 + 20;
    const vTop = heartTop;
    const vBot = vTop + vh;
    const aTop = vBot + gap;
    const aBot = aTop + ah;
    const bodyY = aBot + Math.round(54 * s);
    const body: Box = { x: bedX0, y: bodyY, w: bedX1 - bedX0, h: bh };
    const bodyMid = bodyY + bh / 2;
    const xR = narrow ? 750 : 708;
    const tx = hx + 16;
    return {
      H: Math.round(bodyY + bh + titleH + 10),
      gas,
      body,
      chambers: [
        { id: 'kammer', box: { x: hx - cw / 2, y: vTop, w: cw, h: vh }, lines: ['hjerte-', 'kammer'], tx, ty: vTop + vh / 2, sat: sat.venous },
        { id: 'forkammer', box: { x: hx - cw / 2, y: aTop, w: cw, h: ah }, lines: narrow ? ['forkam-', 'mer'] : ['forkammer'], tx, ty: aTop + ah / 2, sat: sat.venous },
      ],
      paths: [
        [
          [px, vBot - 6],
          [px, vTop + 6],
        ],
        [
          [px, vTop + 6],
          [px, gasMid],
          [bedX0, gasMid],
        ],
        [
          [bedX0, gasMid],
          [bedX1, gasMid],
        ],
        [
          [bedX1, gasMid],
          [xR, gasMid],
          [xR, bodyMid],
          [bedX1, bodyMid],
        ],
        [
          [bedX1, bodyMid],
          [bedX0, bodyMid],
        ],
        [
          [bedX0, bodyMid],
          [px, bodyMid],
          [px, aBot - 6],
        ],
        [
          [px, aBot - 6],
          [px, vBot - 6],
        ],
      ],
      vesselLabels: narrow
        ? []
        : [
            { x: px + 14, y: (vTop + gasMid) / 2 + 12, text: 'bukaorta', anchor: 'start' },
            { x: xR - 12, y: (gasMid + bodyMid) / 2, text: 'ryggaorta', anchor: 'end' },
          ],
    };
  }

  // Dobbelt kretsløp. Hjertet sett forfra: dyrets høyre side til venstre i figuren.
  const two = animal.ventricles === 2;
  const left = 400 - gap / 2 - cw;
  const right = 400 + gap / 2;
  const raC = left + cw / 2;
  const laC = right + cw / 2;
  const aTop = heartTop;
  const aBot = aTop + ah;
  // Blodet går inn i forkamrene i nedre del; navnene står øverst
  const aPath = aBot - Math.round(16 * s);
  const aText = aTop + 6 + 1.25 * fs;
  const vTop = aBot + gap;
  const vBot = vTop + vh;
  // … og ut av hjertekamrene i øvre del; navnene står nederst
  const vPath = vTop + Math.round(0.3 * vh);
  const vText = vTop + 0.7 * vh;
  const bodyY = vBot + Math.round(60 * s);
  const body: Box = { x: bedX0, y: bodyY, w: bedX1 - bedX0, h: bh };
  const bodyMid = bodyY + bh / 2;
  const xVein = narrow ? 50 : 92;
  const xPa = narrow ? 132 : 168;
  const xPv = narrow ? 668 : 632;
  const xAo = narrow ? 750 : 708;
  const vRight = right + cw;
  const lungs = animal.id === 'amfibie' ? 'lunger og hud' : 'lungene';
  const chambers: CircuitGeometry['chambers'] = [
    { id: 'forkammerH', box: { x: left, y: aTop, w: cw, h: ah }, lines: ['høyre', 'forkammer'], tx: raC, ty: aText, sat: sat.venous },
    { id: 'forkammerV', box: { x: right, y: aTop, w: cw, h: ah }, lines: ['venstre', 'forkammer'], tx: laC, ty: aText, sat: sat.gasOut },
  ];
  if (two) {
    chambers.push(
      { id: 'kammerH', box: { x: left, y: vTop, w: cw, h: vh }, lines: ['høyre', 'hjertekammer'], tx: raC, ty: vText, sat: sat.venous },
      { id: 'kammerV', box: { x: right, y: vTop, w: cw, h: vh }, lines: ['venstre', 'hjertekammer'], tx: laC, ty: vText, sat: sat.arterial },
    );
  } else {
    chambers.push({
      id: 'kammer',
      box: { x: left, y: vTop, w: 2 * cw + gap, h: vh },
      lines: ['hjertekammer'],
      tx: 400,
      ty: vText,
      sat: [sat.toGas, sat.arterial],
    });
  }
  return {
    H: Math.round(bodyY + bh + titleH + 10),
    gas,
    body,
    chambers,
    septum: animal.septum === 'delvis' ? { x: 400, y1: vBot, y2: vBot - vh * 0.5 } : undefined,
    paths: [
      // kammerV: fra venstre forkammer ned i (venstre del av) hjertekammeret og ut til høyre
      [
        [laC, vTop + 6],
        [laC, vPath],
        [vRight, vPath],
      ],
      // aorta/arterier til kroppen
      [
        [vRight, vPath],
        [xAo, vPath],
        [xAo, bodyMid],
        [bedX1, bodyMid],
      ],
      // kroppens kapillærer (fra høyre mot venstre)
      [
        [bedX1, bodyMid],
        [bedX0, bodyMid],
      ],
      // vener tilbake til høyre forkammer
      [
        [bedX0, bodyMid],
        [xVein, bodyMid],
        [xVein, aPath],
        [left, aPath],
      ],
      // høyre forkammer
      [
        [left, aPath],
        [raC, aPath],
        [raC, aBot],
      ],
      // kammerH: ned i (høyre del av) hjertekammeret og ut til venstre
      [
        [raC, vTop + 6],
        [raC, vPath],
        [left, vPath],
      ],
      // lungearterie
      [
        [left, vPath],
        [xPa, vPath],
        [xPa, gasMid],
        [bedX0, gasMid],
      ],
      // lungene
      [
        [bedX0, gasMid],
        [bedX1, gasMid],
      ],
      // lungevener
      [
        [bedX1, gasMid],
        [xPv, gasMid],
        [xPv, aPath],
        [vRight, aPath],
      ],
      // venstre forkammer
      [
        [vRight, aPath],
        [laC, aPath],
        [laC, aBot],
      ],
    ],
    vesselLabels: narrow
      ? []
      : [
          { x: xVein - 10, y: (aPath + bodyMid) / 2 + 30, text: two ? 'hulvene' : 'vene', anchor: 'end' },
          { x: xPa + 10, y: (gasMid + aTop) / 2 + 6, text: two ? 'lungearterie' : `til ${lungs}`, anchor: 'start' },
          { x: xPv - 10, y: (gasMid + aTop) / 2 + 6, text: two ? 'lungevene' : `fra ${lungs}`, anchor: 'end' },
          { x: xAo - 10, y: (vPath + bodyMid) / 2 + 16, text: two ? 'aorta' : 'arterie', anchor: 'end' },
        ],
    crossing: [xPa, aPath],
  };
}

function CircuitScene({ animal, segs, sat, f, laps, color }: SceneProps) {
  const g = circuitGeometry(animal, f, sat);
  const k = Math.max(1, f * 0.85);
  const gradId = useSvgId('kretslop');
  const gasSeg = segs.find((s) => s.kind === 'gass')!;
  const bodySeg = segs.find((s) => s.kind === 'kropp')!;
  const gasLabel = animal.id === 'fisk' ? 'Gjellene' : animal.id === 'amfibie' ? 'Lungene og huden' : 'Lungene';
  const narrow = f > 1.3;
  const vesselW = 9 * Math.min(1.4, k);
  const label = `${animal.name}: ${chamberText(animal).toLowerCase()}. ${
    animal.system === 'enkelt' ? 'Enkelt kretsløp' : 'Dobbelt kretsløp'
  }. Blodet ut til kroppen er ${fmtPct(sat.arterial)} mettet med O₂.`;

  return (
    <Figure viewBox={`0 0 800 ${g.H}`} maxHeight={narrow ? 1100 : g.H} label={label}>
      <defs>
        {/* Kapillærnettene: fargen går fra blodet inn til blodet ut (gjellene/lungene venstre → høyre, kroppen høyre → venstre) */}
        <linearGradient id={`${gradId}-gas`} x1="0" x2="1" y1="0" y2="0">
          <stop offset="0.1" style={{ stopColor: color(gasSeg.s0) }} />
          <stop offset="0.9" style={{ stopColor: color(gasSeg.s1) }} />
        </linearGradient>
        <linearGradient id={`${gradId}-body`} x1="1" x2="0" y1="0" y2="0">
          <stop offset="0.1" style={{ stopColor: color(bodySeg.s0) }} />
          <stop offset="0.9" style={{ stopColor: color(bodySeg.s1) }} />
        </linearGradient>
        {g.chambers.map((c) =>
          Array.isArray(c.sat) ? (
            <linearGradient key={c.id} id={`${gradId}-${c.id}`} x1="0" x2="1" y1="0" y2="0">
              <stop offset="0.12" style={{ stopColor: color(c.sat[0]) }} />
              <stop offset="0.88" style={{ stopColor: color(c.sat[1]) }} />
            </linearGradient>
          ) : null,
        )}
      </defs>

      {animal.system === 'enkelt' && (
        <Fisk x={(g.gas.x + g.gas.x + g.gas.w) / 2 + 20} y={(g.gas.y + g.body.y + g.body.h) / 2} size={narrow ? 150 : 190} dim title="Fisk" />
      )}
      <Bed box={g.gas} fill={`url(#${gradId}-gas)`} title={gasLabel} sub={animal.system === 'dobbelt' ? 'lille kretsløp' : undefined} f={f} />
      <Bed
        box={g.body}
        fill={`url(#${gradId}-body)`}
        title="Kroppen"
        sub={animal.system === 'dobbelt' ? 'store kretsløp' : undefined}
        f={f}
        below
      />

      {/* Blodårene (unntatt kapillærnettene og hjerterommene) */}
      {segs.map((s, i) =>
        s.kind === 'arterie' || s.kind === 'vene' ? (
          <Vessel key={s.id} pts={g.paths[i]!} color={color((s.s0 + s.s1) / 2)} width={vesselW} />
        ) : null,
      )}
      {/* Lungearterien går over venen: lite brudd i venen */}
      {g.crossing && (
        <g>
          <circle cx={g.crossing[0]} cy={g.crossing[1]} r={vesselW * 1.25} fill={VIZ.surface} />
          <Vessel
            pts={[
              [g.crossing[0], g.crossing[1] + vesselW * 1.6],
              [g.crossing[0], g.crossing[1] - vesselW * 1.6],
            ]}
            color={color(segs.find((s) => s.id === 'lungearterie')!.s0)}
            width={vesselW}
            arrow={false}
          />
        </g>
      )}

      {/* Hjertet */}
      {g.chambers.map((c) => {
        const fill = Array.isArray(c.sat) ? `url(#${gradId}-${c.id})` : color(c.sat);
        const ts = narrow ? 0.66 : 0.72;
        const lh = 19 * f * ts;
        return (
          <g key={c.id}>
            <rect x={c.box.x} y={c.box.y} width={c.box.w} height={c.box.h} rx={18} fill={VIZ.surface} />
            <rect x={c.box.x} y={c.box.y} width={c.box.w} height={c.box.h} rx={18} style={{ fill }} opacity={0.3} />
            <rect
              x={c.box.x}
              y={c.box.y}
              width={c.box.w}
              height={c.box.h}
              rx={18}
              fill="none"
              stroke={VIZ.ink}
              strokeOpacity={0.55}
              strokeWidth={2}
            />
            {c.lines.map((t, j) => (
              <Txt key={j} x={c.tx} y={c.ty + (j - (c.lines.length - 1) / 2) * lh + 6 * f * ts} size={ts} weight={600}>
                {t}
              </Txt>
            ))}
          </g>
        );
      })}
      {g.septum && (
        <line x1={g.septum.x} x2={g.septum.x} y1={g.septum.y1} y2={g.septum.y2} stroke={VIZ.ink} strokeOpacity={0.55} strokeWidth={4} strokeLinecap="round" />
      )}

      {g.vesselLabels.map((l) => (
        <Txt key={l.text} x={l.x} y={l.y} anchor={l.anchor} size={0.72} muted>
          {l.text}
        </Txt>
      ))}

      <BloodDots paths={g.paths} segs={segs} laps={laps} color={color} r={5.2 * k} n={narrow ? 30 : 42} />
    </Figure>
  );
}

/** Kapillærnett: avrundet felt med fargeovergang og tynne kapillærer. */
function Bed({ box, fill, title, sub, f, below }: { box: Box; fill: string; title: string; sub?: string; f: number; below?: boolean }) {
  const lines = [0.22, 0.5, 0.78].map((u) => {
    const y = box.y + box.h * u;
    let d = `M${box.x + 8},${y}`;
    for (let x = box.x + 8; x < box.x + box.w - 8; x += 24) d += ` q6,${u === 0.5 ? 5 : -5} 12,0 t12,0`;
    return d;
  });
  const narrow = f > 1.3;
  // Navnet står over (gjeller/lunger) eller under (kroppen) feltet, så blodcellene ikke dekker det
  const ty = below ? box.y + box.h + 21 * f : box.y - 8;
  return (
    <g>
      <rect x={box.x} y={box.y} width={box.w} height={box.h} rx={14} style={{ fill }} opacity={0.22} />
      {lines.map((d, i) => (
        <path key={i} d={d} fill="none" style={{ stroke: fill }} strokeWidth={2.4} opacity={0.75} />
      ))}
      <rect x={box.x} y={box.y} width={box.w} height={box.h} rx={14} fill="none" stroke={VIZ.muted} strokeWidth={1.5} />
      <Txt x={box.x + 4} y={ty} anchor="start" weight={700} size={0.9}>
        {title}
      </Txt>
      {sub && (
        <Txt x={narrow ? 792 : box.x + box.w - 4} y={ty} anchor="end" muted size={0.78}>
          {sub}
        </Txt>
      )}
    </g>
  );
}

/** Blodåre som tykk strek med en liten pilspiss midt på som viser retningen. */
function Vessel({ pts, color, width, arrow = true }: { pts: readonly Pt[]; color: string; width: number; arrow?: boolean }) {
  const d = `M${pts.map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' L')}`;
  const L = polylineLength(pts);
  const u = 0.5;
  const a = pointAlong(pts, u - 4 / Math.max(1, L));
  const b = pointAlong(pts, u + 4 / Math.max(1, L));
  const ang = (Math.atan2(b[1] - a[1], b[0] - a[0]) * 180) / Math.PI;
  const m = pointAlong(pts, u);
  const h = width * 0.95;
  return (
    <g>
      <path d={d} fill="none" style={{ stroke: color }} strokeWidth={width} strokeLinejoin="round" strokeLinecap="round" opacity={0.55} />
      {arrow && L > 40 && (
        <polygon
          points={`${h},0 ${-h * 0.7},${-h} ${-h * 0.7},${h}`}
          transform={`translate(${m[0].toFixed(1)} ${m[1].toFixed(1)}) rotate(${ang.toFixed(1)})`}
          fill={VIZ.ink}
          opacity={0.6}
        />
      )}
    </g>
  );
}

/** Blodceller som går rundt i kretsløpet med fargen til O₂-innholdet der de er. Én av dem følges (større, med ring). */
function BloodDots({
  paths,
  segs,
  laps,
  color,
  r,
  n,
}: {
  paths: Pt[][];
  segs: Segment[];
  laps: number;
  color: (v: number) => string;
  r: number;
  n: number;
}) {
  // Tida blodet bruker i hver del følger `len` i modellen: raskt i arteriene, langsomt i kapillærene
  const lengths = segs.map((s) => s.len);
  const dots = Array.from({ length: n }, (_, i) => {
    const u = (i / n + laps) % 1;
    const { index, local } = locate(lengths, u);
    const sg = segs[index]!;
    const p = pointAlong(paths[index]!, local);
    return { p, s: sg.s0 + (sg.s1 - sg.s0) * local, tracked: i === 0 };
  });
  return (
    <g>
      {dots.map((d, i) =>
        d.tracked ? null : <circle key={i} cx={d.p[0]} cy={d.p[1]} r={r} style={{ fill: color(d.s) }} stroke={VIZ.surface} strokeWidth={1.4} />,
      )}
      {dots[0] && (
        <g>
          <circle cx={dots[0].p[0]} cy={dots[0].p[1]} r={r * 1.9} fill="none" stroke={VIZ.ink} strokeWidth={2} />
          <circle cx={dots[0].p[0]} cy={dots[0].p[1]} r={r * 1.25} style={{ fill: color(dots[0].s) }} stroke={VIZ.surface} strokeWidth={1.6} />
        </g>
      )}
    </g>
  );
}

/* ---------- Insekt: åpent kretsløp ---------- */

function InsectScene({ segs, f, laps, color }: SceneProps) {
  const narrow = f > 1.3;
  const k = Math.max(1, f * 0.85);
  const sy = narrow ? 1.35 : 1;
  const top = 30 * f;
  const midY = top + 92 * sy;
  const H = Math.round(midY + 112 * sy + 34 * f);
  const ab = { cx: 540, cy: midY + 6 * sy, rx: 205, ry: 72 * sy };
  const th = { cx: 296, cy: midY, rx: 74, ry: 54 * sy };
  const hd = { cx: 180, cy: midY - 4 * sy, r: 40 * Math.min(sy, 1.2) };
  const dvY = midY - 44 * sy;
  const venY = midY + 48 * sy;
  const paths: Pt[][] = [
    [
      [708, dvY + 4],
      [380, dvY],
    ],
    [
      [380, dvY],
      [300, dvY + 2],
      [208, midY - 18 * sy],
    ],
    [
      [208, midY - 18 * sy],
      [190, midY + 8 * sy],
      [250, midY + 36 * sy],
      [400, venY],
      [690, venY - 4],
    ],
    [
      [690, venY - 4],
      [724, midY + 8 * sy],
      [708, dvY + 4],
    ],
  ];
  const spiracles = [450, 530, 610];
  const segLines = [430, 480, 530, 580, 630, 680];
  const bottom = H - 12 * f;
  return (
    <Figure
      viewBox={narrow ? `100 0 692 ${H}` : `0 0 800 ${H}`}
      maxHeight={narrow ? 900 : H}
      label="Insekt sett fra siden: ryggkaret pumper hemolymfe fram mot hodet og ut i kroppshulen, der den strømmer fritt bakover og tilbake inn i ryggkaret gjennom ostier. Trakeer frakter luft til cellene."
      caption="Skjematisk tegning av en gresshoppe. Trakeene er bare tegnet på bakkroppen."
    >
      {/* Bein */}
      {[262, 300, 338].map((x, i) => (
        <path
          key={x}
          d={`M${x},${midY + 42 * sy} l${-18 + i * 14},${36 * sy} l${-8 + i * 6},${24 * sy}`}
          fill="none"
          stroke={BIO.insekt.line}
          strokeWidth={3}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ))}
      {/* Kroppen: hode, bryst og bakkropp */}
      <ellipse cx={ab.cx} cy={ab.cy} rx={ab.rx} ry={ab.ry} fill={BIO.insekt.fill} stroke={BIO.insekt.line} strokeWidth={2} />
      {segLines.map((x) => {
        const dy = ab.ry * Math.sqrt(Math.max(0, 1 - ((x - ab.cx) / ab.rx) ** 2));
        return <line key={x} x1={x} x2={x} y1={ab.cy - dy} y2={ab.cy + dy} stroke={BIO.insekt.line} strokeOpacity={0.3} strokeWidth={1.2} />;
      })}
      <ellipse cx={th.cx} cy={th.cy} rx={th.rx} ry={th.ry} fill={BIO.insekt.fill} stroke={BIO.insekt.line} strokeWidth={2} />
      <circle cx={hd.cx} cy={hd.cy} r={hd.r} fill={BIO.insekt.fill} stroke={BIO.insekt.line} strokeWidth={2} />
      <circle cx={hd.cx - 16} cy={hd.cy - 8} r={7} fill={BIO.insekt.line} opacity={0.75} />
      <path d={`M${hd.cx - 6},${hd.cy - hd.r + 4} q-26,-30 -64,-36`} fill="none" stroke={BIO.insekt.line} strokeWidth={2.2} strokeLinecap="round" />
      {/* Kroppshulen (hemolymfen bader organene) */}
      <path
        d={`M${250},${midY + 30 * sy} Q${470},${midY + 76 * sy} ${700},${midY + 32 * sy}`}
        fill="none"
        stroke={BIO.insekt.line}
        strokeOpacity={0.16}
        strokeWidth={34 * sy}
        strokeLinecap="round"
      />
      {/* Trakeer fra åndehullene */}
      {spiracles.map((x) => (
        <g key={x}>
          <path
            d={`M${x},${midY + 14 * sy} q-14,-30 -6,-50 M${x},${midY + 14 * sy} q18,-16 30,-6 M${x},${midY + 14 * sy} q-4,20 12,32`}
            fill="none"
            stroke={VIZ.muted}
            strokeWidth={2}
            strokeDasharray="5 4"
          />
          <ellipse cx={x} cy={midY + 14 * sy} rx={5 * k} ry={3.5 * k} fill={VIZ.surface} stroke={VIZ.ink} strokeWidth={1.6} />
        </g>
      ))}
      {/* Ryggkaret (hjertet) med ostier, og aorta fram til hodet */}
      <path
        d={`M${710},${dvY + 4} L${380},${dvY} L${300},${dvY + 2} L${208},${midY - 18 * sy}`}
        fill="none"
        stroke={BIO.insekt.line}
        strokeWidth={14 * Math.min(1.3, k)}
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={0.35}
      />
      {[470, 550, 630].map((x) => (
        <path key={x} d={`M${x - 7},${dvY + 9} l7,-6 l7,6`} fill="none" stroke={VIZ.ink} strokeWidth={1.8} opacity={0.7} />
      ))}
      <BloodDots paths={paths} segs={segs} laps={laps} color={color} r={5.2 * k} n={narrow ? 22 : 30} />

      <Etikett x={600} y={dvY} lx={narrow ? 790 : 770} ly={top - 6 * f} anchor="end" size={0.8}>
        ryggkar (hjerte) med ostier
      </Etikett>
      <Etikett x={300} y={dvY + 2} lx={narrow ? 108 : 250} ly={top - 6 * f} anchor={narrow ? 'start' : 'middle'} size={0.8}>
        aorta
      </Etikett>
      <Etikett x={420} y={venY} lx={narrow ? 108 : 300} ly={bottom} anchor="start" size={0.8}>
        kroppshulen
      </Etikett>
      <Etikett x={610} y={midY + 14 * sy} lx={narrow ? 790 : 770} ly={bottom} anchor="end" size={0.8}>
        åndehull og trakeer
      </Etikett>
    </Figure>
  );
}

/* ====================================================================== */
/* Trykkgrafen                                                              */
/* ====================================================================== */

function PressureFigure({
  segs,
  animal,
  tracked,
  color,
}: {
  segs: Segment[];
  animal: Animal;
  tracked: number;
  color: (v: number) => string;
}) {
  const [ref, f] = useContainerTextScale<HTMLDivElement>();
  const H = Math.round(300 + 250 * (f - 1));
  const pts = pressureProfile(segs);
  const spans = segmentSpans(segs);
  // Blodcellen vi følger: samme andel av kretsløpet som i scenen, men delene har andre lengder i grafen
  const { index, local } = locate(
    segs.map((g) => g.len),
    tracked,
  );
  const span = spans[index]!;
  const sg = segs[index]!;
  const x = span.start + (span.end - span.start) * local;
  const p = sg.p0 + (sg.p1 - sg.p0) * local;
  const s = sg.s0 + (sg.s1 - sg.s0) * local;
  return (
    <div ref={ref}>
      <Figure
        viewBox={`0 0 800 ${H}`}
        label={`Blodtrykket langs kretsløpet hos ${animal.name.toLowerCase()}. Høyest ${fmt(Math.max(animal.pBody, animal.pGas), 0)} mmHg.`}
      >
        <Plot
          x={{ min: 0, max: 1, label: 'Blodets vei gjennom kretsløpet →', ticks: [] }}
          y={{ min: 0, max: 100, label: 'Blodtrykk (mmHg)', ticks: [0, 25, 50, 75, 100] }}
          width={800}
          height={H}
        >
          {({ sx, sy, y0, y1 }) => (
            <PressureLines segs={segs} spans={spans} pts={pts} sx={sx} sy={sy} y0={y0} y1={y1} marker={{ x, p, s }} color={color} insect={animal.system === 'åpent'} />
          )}
        </Plot>
      </Figure>
    </div>
  );
}

function PressureLines({
  segs,
  spans,
  pts,
  sx,
  sy,
  y0,
  y1,
  marker,
  color,
  insect,
}: {
  segs: Segment[];
  spans: { start: number; end: number; mid: number }[];
  pts: [number, number][];
  sx: (v: number) => number;
  sy: (v: number) => number;
  y0: number;
  y1: number;
  marker: { x: number; p: number; s: number };
  color: (v: number) => string;
  insect: boolean;
}) {
  const f = useTextScale();
  // Etiketter over feltene for gassutveksling og kroppen (og hjertet på PC)
  const named = segs
    .map((s, i) => ({ s, span: spans[i]! }))
    .filter(({ s }) => s.kind === 'gass' || s.kind === 'kropp' || s.kind === 'kroppshule');
  return (
    <g>
      {segs.map((s, i) => {
        const sp = spans[i]!;
        if (s.kind === 'pumpe')
          return <rect key={s.id} x={sx(sp.start)} width={sx(sp.end) - sx(sp.start)} y={y1} height={y0 - y1} fill={VIZ.muted} opacity={0.16} />;
        if (s.kind === 'gass' || s.kind === 'kropp' || s.kind === 'kroppshule')
          return (
            <rect
              key={s.id}
              x={sx(sp.start)}
              width={sx(sp.end) - sx(sp.start)}
              y={y1}
              height={y0 - y1}
              style={{ fill: insect ? BIO.insekt.fill : color(s.kind === 'gass' ? s.s1 : s.s0) }}
              opacity={insect ? 0.5 : 0.1}
            />
          );
        return null;
      })}
      {named.map(({ s, span }) => (
        <Txt key={s.id} x={sx(span.mid)} y={y1 + 22 * f} size={0.78} weight={650}>
          {bandName(s)}
        </Txt>
      ))}
      <path d={linePath(pts, sx, sy)} fill="none" stroke={VIZ.ink} strokeWidth={3} strokeLinejoin="round" />
      <line x1={sx(marker.x)} x2={sx(marker.x)} y1={y0} y2={y1} className="viz-guide" />
      <circle cx={sx(marker.x)} cy={sy(marker.p)} r={8} style={{ fill: insect ? BIO.insekt.line : color(marker.s) }} stroke={VIZ.surface} strokeWidth={2.5} />
      <Txt x={sx(marker.x) + (marker.x > 0.6 ? -12 : 12)} y={sy(marker.p) - 16} anchor={marker.x > 0.6 ? 'end' : 'start'} size={0.8} weight={650}>
        {fmt(marker.p, 0)} mmHg{insect ? '' : ` · ${fmtPct(marker.s)} O₂`}
      </Txt>
    </g>
  );
}

function bandName(s: Segment): string {
  if (s.kind === 'kroppshule') return 'kroppshulen';
  if (s.kind === 'kropp') return 'kroppen';
  return s.label === 'gjellene' ? 'gjeller' : s.label === 'lungene' ? 'lunger' : 'lunger, hud';
}

/* ====================================================================== */
/* Forklaring                                                               */
/* ====================================================================== */

function explanation(a: Animal, s: Saturations, activity: number): ReactNode {
  const colours = (
    <p>
      Blått i figuren er bare en tegnekonvensjon: oksygenfattig blod er mørkt rødt, ikke blått. Fargene viser O₂-innholdet fra det mest
      oksygenfattige til det mest oksygenrike blodet i dette dyret. Den store prikken er én blodcelle du kan følge rundt; trykkgrafen viser
      hvor den er.
    </p>
  );
  const high = activity >= 0.6;
  switch (a.id) {
    case 'insekt':
      return (
        <>
          <p>
            <strong>Åpent kretsløp.</strong> Insektet har ikke blodårer ut til organene. Et rørformet hjerte langs ryggen (ryggkaret) pumper
            hemolymfe fram mot hodet, og der renner den ut i kroppshulen og bader organene direkte. Den siver sakte bakover og suges inn i
            ryggkaret igjen gjennom små åpninger (ostier). Trykket er bare noen få mmHg.
          </p>
          <p>
            Det går bra fordi hemolymfen ikke trenger å frakte O₂: <strong>trakeene</strong> leder luft fra åndehullene helt inn til cellene.
            Hemolymfen frakter næring, hormoner, avfallsstoffer og immunceller. Insekter er altså ikke «uten blod», de har bare et annet
            transportsystem.
          </p>
        </>
      );
    case 'fisk':
      return (
        <>
          <p>
            <strong>Enkelt kretsløp.</strong> Fiskehjertet har ett forkammer og ett hjertekammer etter hverandre, og pumper bare oksygenfattig
            blod. Blodet går først gjennom gjellene og så videre ut i kroppen uten å komme tilbake til hjertet. I de trange kapillærene i
            gjellene faller trykket fra ca. {fmt(a.pGas, 0)} til {fmt(a.pBody, 0)} mmHg, så blodet når kroppen med lavt trykk og strømmer
            langsomt.
          </p>
          <p>
            Det holder for et ektotermt dyr med lavt stoffskifte, men kroppen kan ikke få mer O₂ enn gjellene og det lave trykket gir.
            {high ? ` Når fisken svømmer fort, tar musklene ut så mye O₂ at blodet tilbake til hjertet bare er ${fmtPct(s.venous)} mettet.` : ''}
          </p>
          {colours}
        </>
      );
    case 'amfibie':
      return (
        <>
          <p>
            <strong>Dobbelt kretsløp, men bare ett hjertekammer.</strong> Frosken har to forkamre: det høyre får oksygenfattig blod fra
            kroppen og det venstre oksygenrikt blod fra lungene. I det felles hjertekammeret blandes de delvis, så blodet ut til kroppen er
            bare {fmtPct(s.arterial)} mettet, mens blodet fra lungene og huden er {fmtPct(s.gasOut)} mettet.
          </p>
          <p>
            Fordelen med to kretsløp er at blodet pumpes på nytt etter lungene, så det får høyere trykk ut til kroppen enn hos fisk. Blandingen
            er ikke så dum som den høres ut: frosken tar også opp O₂ gjennom den fuktige huden, og når den dykker, kan blodet sendes forbi
            lungene. Et ektotermt dyr med lavt stoffskifte klarer seg godt med litt blandet blod.
            {high ? ` Ved høy aktivitet blir veneblodet mer oksygenfattig (${fmtPct(s.venous)}), og da drar blandingen ned O₂-innholdet til kroppen enda mer.` : ''}
          </p>
          {colours}
        </>
      );
    case 'krypdyr':
      return (
        <>
          <p>
            <strong>Delvis skillevegg i hjertekammeret.</strong> Hos øgler, slanger og skilpadder deler en ufullstendig skillevegg
            hjertekammeret, så det blir mindre blanding enn hos amfibier (her ca. {fmtPct(a.mixing)}). Blodet til kroppen er {fmtPct(s.arterial)}{' '}
            mettet, og trykket ut til kroppen ({fmt(a.pBody, 0)} mmHg) kan bli høyere enn trykket til lungene ({fmt(a.pGas, 0)} mmHg).
          </p>
          <p>
            Krokodiller har en hel skillevegg og fire hjerterom, som fugler og pattedyr. Krypdyr er likevel ektoterme: de har lavt
            stoffskifte og varmes opp av sola, så de trenger mye mindre O₂ enn en fugl eller et pattedyr av samme størrelse.
          </p>
          {colours}
        </>
      );
    case 'pattedyr':
      return (
        <>
          <p>
            <strong>To pumper etter hverandre.</strong> Fugler og pattedyr har fire hjerterom og en hel skillevegg, så oksygenrikt og
            oksygenfattig blod blandes aldri. Høyre halvdel pumper oksygenfattig blod til lungene med lavt trykk (ca. {fmt(a.pGas, 0)} mmHg,
            som skåner de tynne lungekapillærene), og venstre halvdel pumper oksygenrikt blod ({fmtPct(s.arterial)} mettet) ut i kroppen med
            høyt trykk (ca. {fmt(a.pBody, 0)} mmHg). Lungearterien er en arterie selv om blodet er oksygenfattig: arterier fører blod bort fra
            hjertet.
          </p>
          <p>
            <strong>Hvorfor trenger endoterme dyr dette?</strong> Fugler og pattedyr lager kroppsvarmen sin selv ved celleånding, og bruker i
            hvile 5–10 ganger så mye O₂ som et krypdyr av samme størrelse. Da må mye blod med full O₂-metning fram til cellene raskt, og det
            krever høyt trykk og ingen blanding. Fugler og pattedyr har utviklet firedelt hjerte hver for seg (konvergent evolusjon).
            {high ? ` Nå arbeider dyret hardt: kroppen tar ut ${fmtPct(s.extracted)} av O₂-et, og hjertet slår raskere.` : ''}
          </p>
          {colours}
        </>
      );
  }
}
