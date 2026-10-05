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
  Segmented,
  Select,
  Slider,
  Toolbar,
  Txt,
  VIZ,
  VizLayout,
  fmt,
  fmtPct,
  linePath,
  mixColor,
  sample,
  useContainerTextScale,
  useSimClock,
  useTextScale,
} from '../kit';
import {
  EXPERIMENTS,
  GRAVI_SHIFT,
  OPTIMUM,
  auxinResponse,
  bendAngle,
  elongationRatio,
  getExperiment,
  graviAngle,
  gravitropism,
  runExperiment,
  shadedShare,
  type Experiment,
  type Outcome,
} from './model';

type Mode = 'lys' | 'tyngde' | 'forsok';
const MODES: { value: Mode; label: string }[] = [
  { value: 'lys', label: 'Lys fra siden' },
  { value: 'tyngde', label: 'Tyngdekraft' },
  { value: 'forsok', label: 'Klassiske forsøk' },
];

const C_AUXIN = BIO.signal;
const C_LIGHT = BIO.sukker;

export default function Fototropisme() {
  const [mode, setMode] = useState<Mode>('lys');
  return (
    <VizLayout>
      <Toolbar>
        <Segmented label="Velg visning" options={MODES} value={mode} onChange={setMode} />
      </Toolbar>
      {mode === 'lys' ? <LysFraSiden /> : mode === 'tyngde' ? <Tyngdekraft /> : <Forsok />}
    </VizLayout>
  );
}

/* ====================================================================== */
/* Felles tegning: koleoptil (eller rot) som bøyer seg                      */
/* ====================================================================== */

type Pt = readonly [number, number];

interface ShootProps {
  x: number;
  y: number;
  /** Lengde og bredde (figurenheter). */
  L: number;
  W: number;
  /** Retning ved basis og i spissen (grader fra rett opp, med klokka). */
  base: number;
  tip: number;
  /** Andel auksin på venstre side (sett i vekstretningen) i vekstsonen. */
  leftShare: number;
  /** Hvor mye auksin som strømmer (0 = ingen). */
  auxin: number;
  t: number;
  paint?: { fill: string; line: string };
  /** Flat topp (spissen kuttet av). */
  flat?: boolean;
  k: number;
}

/** Midtlinja: retningen er `base` nederst, endres jevnt i vekstsonen og er `tip` i den øverste delen. */
function centerline(x: number, y: number, L: number, base: number, tip: number, n = 48): { p: Pt; a: number }[] {
  const out: { p: Pt; a: number }[] = [];
  let px = x;
  let py = y;
  const z0 = 0.3;
  const z1 = 0.8;
  for (let i = 0; i <= n; i++) {
    const s = i / n;
    const u = s < z0 ? 0 : s > z1 ? 1 : (s - z0) / (z1 - z0);
    const a = base + (tip - base) * u;
    out.push({ p: [px, py], a });
    const r = (a * Math.PI) / 180;
    px += (Math.sin(r) * L) / n;
    py -= (Math.cos(r) * L) / n;
  }
  return out;
}

function Shoot({ x, y, L, W, base, tip, leftShare, auxin, t, paint = BIO.plante, flat, k }: ShootProps) {
  const line = centerline(x, y, L, base, tip);
  const side = (q: { p: Pt; a: number }, s: 1 | -1, w = W / 2): Pt => {
    const r = (q.a * Math.PI) / 180;
    // Venstre normal i vekstretningen: (−cos a, −sin a)
    return [q.p[0] - s * Math.cos(r) * w, q.p[1] - s * Math.sin(r) * w];
  };
  const left = line.map((q) => side(q, 1));
  const right = line.map((q) => side(q, -1));
  const topR = right[right.length - 1]!;
  const d =
    `M${left.map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' L')}` +
    (flat ? ` L${topR[0].toFixed(1)},${topR[1].toFixed(1)}` : ` A${W / 2},${W / 2} 0 0 1 ${topR[0].toFixed(1)},${topR[1].toFixed(1)}`) +
    ` L${[...right]
      .reverse()
      .map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`)
      .join(' L')} Z`;
  // Celleveggene: lengre celler på siden med mest auksin (i vekstsonen)
  const n = line.length - 1;
  const walls: ReactNode[] = [];
  for (const s of [1, -1] as const) {
    const share = s === 1 ? leftShare : 1 - leftShare;
    let pos = 0.04;
    let i = 0;
    while (pos < 0.94 && i < 40) {
      const inZone = pos > 0.3 && pos < 0.85;
      const len = 0.065 * (inZone ? 0.55 + 0.9 * share : 0.8);
      pos += len;
      const q = line[Math.min(n, Math.round(pos * n))]!;
      const a = side(q, s, 0);
      const b = side(q, s, W / 2);
      walls.push(<line key={`${s}-${i}`} x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} stroke={paint.line} strokeWidth={1} opacity={0.55} />);
      i++;
    }
  }
  // Auksin strømmer nedover fra spissen, mest på siden med størst andel
  const dots: ReactNode[] = [];
  if (auxin > 0) {
    for (const s of [1, -1] as const) {
      const share = s === 1 ? leftShare : 1 - leftShare;
      const count = Math.round(14 * share * auxin);
      for (let i = 0; i < count; i++) {
        const u = 0.95 - ((i / Math.max(1, count) + 0.05 * t) % 1) * 0.9;
        const q = line[Math.min(n, Math.max(0, Math.round(u * n)))]!;
        const p = side(q, s, W / 4);
        dots.push(<circle key={`a${s}-${i}`} cx={p[0]} cy={p[1]} r={3 * k} fill={C_AUXIN} />);
      }
    }
  }
  return (
    <g>
      <path d={d} fill={paint.fill} stroke={paint.line} strokeWidth={2} strokeLinejoin="round" />
      <path d={`M${line.map((q) => `${q.p[0].toFixed(1)},${q.p[1].toFixed(1)}`).join(' L')}`} fill="none" stroke={paint.line} strokeWidth={1} opacity={0.4} />
      {walls}
      {dots}
    </g>
  );
}

/** Lampe med stråler mot et punkt. `angle` er retningen lyset kommer fra (grader fra rett opp, med klokka). */
function Lamp({ cx, cy, R, angle, intensity, k }: { cx: number; cy: number; R: number; angle: number; intensity: number; k: number }) {
  const r = (angle * Math.PI) / 180;
  const lx = cx + Math.sin(r) * R;
  const ly = cy - Math.cos(r) * R;
  const rays = [-0.12, 0, 0.12];
  const on = intensity > 0;
  return (
    <g>
      {on &&
        rays.map((da, i) => {
          const a2 = r + da;
          const x1 = cx + Math.sin(a2) * (R - 30);
          const y1 = cy - Math.cos(a2) * (R - 30);
          const x2 = cx + Math.sin(r + da * 0.3) * 60;
          const y2 = cy - Math.cos(r + da * 0.3) * 60;
          return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke={C_LIGHT} strokeWidth={3} strokeDasharray="10 8" opacity={0.25 + 0.6 * (intensity / 100)} />;
        })}
      <circle cx={lx} cy={ly} r={18 * k} fill={on ? C_LIGHT : VIZ.surface} stroke={C_LIGHT} strokeWidth={2.5} opacity={on ? 0.4 + 0.6 * (intensity / 100) : 1} />
    </g>
  );
}

function Soil({ x, y, w, h }: { x: number; y: number; w: number; h: number }) {
  return <rect x={x} y={y} width={w} height={h} rx={10} style={{ fill: mixColor(VIZ.surface, BIO.ved, 0.25) }} />;
}

/* ====================================================================== */
/* 1. Lys fra siden                                                         */
/* ====================================================================== */

const T_MAX = 180;

function LysFraSiden() {
  const [light, setLight] = useState(90);
  const [intensity, setIntensity] = useState(80);
  const clock = useSimClock({ tMax: T_MAX, speed: 30 });
  const { setT, pause } = clock;
  // Vis resultatet etter tre timer når siden åpnes og når du endrer lyset (trykk «Spill av» for å se forløpet)
  useEffect(() => {
    pause();
    setT(T_MAX);
  }, [light, intensity, pause, setT]);
  const t = clock.t;
  const tip = bendAngle(light, intensity, t);
  const share = shadedShare(light, tip, intensity);
  const [ref, f] = useContainerTextScale<HTMLDivElement>();
  const shadedLeft = light - tip > 0;
  return (
    <>
      <Controls>
        <Slider
          label="Lyset kommer fra"
          value={light}
          onChange={setLight}
          min={-90}
          max={90}
          step={5}
          format={(v) => (v === 0 ? 'rett ovenfra' : v < 0 ? `venstre, ${fmt(-v, 0)}°` : `høyre, ${fmt(v, 0)}°`)}
        />
        <Slider label="Lysstyrke" value={intensity} onChange={setIntensity} min={0} max={100} step={5} unit="%" />
        <Slider
          label="Tid"
          ariaLabel="Tid i minutter"
          value={Math.round(t)}
          onChange={(v) => {
            pause();
            setT(v);
          }}
          min={0}
          max={T_MAX}
          step={5}
          unit="min"
        />
      </Controls>
      <Toolbar>
        <PlayBar clock={clock} time={`${fmt(t, 0)} min`} />
      </Toolbar>
      <div ref={ref}>
        <LightScene light={light} intensity={intensity} tip={tip} share={share} shadedLeft={shadedLeft} f={f} t={t} />
      </div>
      <Legend
        items={[
          { color: C_AUXIN, label: 'Auksin fra spissen' },
          { color: C_LIGHT, label: 'Lys' },
          { color: BIO.plante.line, label: 'Celler: lengst der det er mest auksin' },
        ]}
      />
      <BendPlot light={light} intensity={intensity} t={t} />
      <Readouts>
        <Readout label="Auksin på skyggesiden" value={fmtPct(share)} tone={C_AUXIN} />
        <Readout label="Skyggesiden vokser" value={fmt(elongationRatio(share), 2)} unit="ganger så fort" />
        <Readout
          label="Bøyning"
          value={`${fmt(Math.abs(tip), 0)}°`}
          unit={Math.abs(tip) < 0.5 ? undefined : tip > 0 ? 'mot høyre' : 'mot venstre'}
        />
      </Readouts>
      <Formula label="Bøyningen">
        <FormulaLine>
          Auksin: skyggesiden {fmtPct(share)}, lyssiden {fmtPct(1 - share)} → skyggesiden vokser {fmt(elongationRatio(share), 2)} ganger så fort
        </FormulaLine>
        <FormulaLine>Bøyningen stopper når spissen peker mot lyset: da blir det like mye auksin på begge sider.</FormulaLine>
      </Formula>
      <Explain>{lightText(light, intensity, tip, share, t)}</Explain>
    </>
  );
}

function LightScene({
  light,
  intensity,
  tip,
  share,
  shadedLeft,
  f,
  t,
}: {
  light: number;
  intensity: number;
  tip: number;
  share: number;
  shadedLeft: boolean;
  f: number;
  t: number;
}) {
  const narrow = f > 1.3;
  const k = Math.max(1, f * 0.85);
  const sceneH = narrow ? 560 : 430;
  const groundY = sceneH - 50;
  const L = narrow ? 300 : 230;
  const W = narrow ? 64 : 46;
  // PC: koleoptilen til venstre og cellene forstørret til høyre. Mobil: cellene under.
  const cx = narrow ? 400 : 280;
  const zoom: ZoomBox = narrow ? { x: 20, y: sceneH + 10, w: 760, h: 420 } : { x: 548, y: 16, w: 232, h: groundY - 4 };
  const H = narrow ? zoom.y + zoom.h + 8 : sceneH;
  // Lampa går i en sirkel rundt midten av koleoptilen, så den alltid er inne i figuren
  const pivotY = groundY - L * 0.5;
  const lampR = Math.min(pivotY - 30, narrow ? 340 : 250);
  const leftShare = shadedLeft ? share : 1 - share;
  const lit = intensity > 0 && Math.abs(light) > 4;
  // Celleforlengelsen i vekstsonen så langt: like mye på begge sider i snitt, forskjellen gir bøyningen
  const tau = t / T_MAX;
  const delta = (0.3 * Math.abs(tip)) / 90;
  const bendsRight = tip > 0.5;
  const bendsLeft = tip < -0.5;
  const growLeft = 1 + 0.45 * tau + (bendsRight ? delta : bendsLeft ? -delta : 0);
  const growRight = 1 + 0.45 * tau + (bendsLeft ? delta : bendsRight ? -delta : 0);
  return (
    <Figure
      viewBox={`0 0 800 ${H}`}
      maxHeight={narrow ? 1100 : H}
      label={`Havrekoleoptil med lys fra ${light === 0 ? 'rett ovenfra' : light < 0 ? 'venstre' : 'høyre'}. Den har bøyd seg ${fmt(Math.abs(tip), 0)} grader. ${fmtPct(share)} av auksinet er på skyggesiden.`}
    >
      <Lamp cx={cx} cy={pivotY} R={lampR} angle={light} intensity={intensity} k={k} />
      <Soil x={20} y={groundY} w={narrow ? 760 : 510} h={sceneH - groundY - 6} />
      <ellipse cx={cx} cy={groundY + 16} rx={34} ry={14} style={{ fill: mixColor(VIZ.surface, BIO.ved, 0.5) }} stroke={BIO.ved} strokeWidth={1.5} />
      <Shoot x={cx} y={groundY + 4} L={L} W={W} base={0} tip={tip} leftShare={leftShare} auxin={1} t={t} k={k} />
      <Txt x={36} y={30 * f} anchor="start" weight={700} size={0.85}>
        Havrekoleoptil (<tspan fontStyle="italic">Avena sativa</tspan>)
      </Txt>
      {lit && (
        <g>
          <Txt x={shadedLeft ? cx - W - 28 : cx + W + 28} y={groundY - L * 0.32} anchor={shadedLeft ? 'end' : 'start'} size={0.78} weight={700} color={C_AUXIN}>
            skyggesiden
          </Txt>
          <Txt x={shadedLeft ? cx - W - 28 : cx + W + 28} y={groundY - L * 0.32 + 20 * f * 0.78} anchor={shadedLeft ? 'end' : 'start'} size={0.72} muted>
            mer auksin
          </Txt>
        </g>
      )}
      <Txt x={narrow ? 760 : 520} y={groundY - 12} anchor="end" size={0.75} muted>
        {fmt(t, 0)} min
      </Txt>
      <CellZoom box={zoom} growLeft={growLeft} growRight={growRight} leftShare={leftShare} lit={lit} shadedLeft={shadedLeft} />
    </Figure>
  );
}

interface ZoomBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Cellene i vekstsonen forstørret: én cellerad på hver side av koleoptilen. Begge sider vokser, men siden med mest
 * auksin får lengst celler, og koleoptilen bøyer seg mot den andre siden.
 */
function CellZoom({
  box,
  growLeft,
  growRight,
  leftShare,
  lit,
  shadedLeft,
}: {
  box: ZoomBox;
  growLeft: number;
  growRight: number;
  leftShare: number;
  lit: boolean;
  shadedLeft: boolean;
}) {
  const f = useTextScale();
  const k = Math.max(1, f * 0.85);
  const titleH = 30 * f;
  const footH = 2 * 20 * f + 8;
  const n = 4;
  const maxGrow = 1.8;
  const baseY = box.y + box.h - footH;
  const cellH = (baseY - box.y - titleH - 12 * f - 8) / (n * maxGrow);
  const colW = Math.min(box.w > 400 ? 120 : 76, box.w * 0.26);
  const gap = Math.min(box.w > 400 ? 70 : 40, box.w * 0.12);
  const cols = [
    { side: 'venstre', x: box.x + box.w / 2 - gap / 2 - colW, grow: growLeft, share: leftShare, shaded: shadedLeft },
    { side: 'høyre', x: box.x + box.w / 2 + gap / 2, grow: growRight, share: 1 - leftShare, shaded: !shadedLeft },
  ];
  return (
    <g>
      <rect x={box.x} y={box.y} width={box.w} height={box.h} rx={14} fill="none" stroke={VIZ.grid} strokeWidth={1.5} />
      <Txt x={box.x + box.w / 2} y={box.y + 22 * f} size={0.8} weight={700}>
        Cellene i vekstsonen
      </Txt>
      {cols.map((c) => {
        const h = cellH * c.grow;
        const dots = Math.max(1, Math.round(c.share * 8));
        return (
          <g key={c.side}>
            {Array.from({ length: n }, (_, i) => {
              const y = baseY - (i + 1) * h;
              return (
                <g key={i}>
                  <rect x={c.x} y={y} width={colW} height={h} rx={6} fill={BIO.plante.fill} stroke={BIO.plante.line} strokeWidth={1.5} />
                  {Array.from({ length: dots }, (_, j) => (
                    <circle
                      key={j}
                      cx={c.x + colW * (0.25 + 0.5 * ((j % 2) as number))}
                      cy={y + (h * (Math.floor(j / 2) + 0.7)) / (Math.ceil(dots / 2) + 0.4)}
                      r={3 * k}
                      fill={C_AUXIN}
                    />
                  ))}
                </g>
              );
            })}
            <Txt x={c.x + colW / 2} y={baseY - n * h - 8} size={0.75} weight={700}>
              ×{fmt(c.grow, 2)}
            </Txt>
            <Txt x={c.x + colW / 2} y={baseY + 20 * f} size={0.72} muted>
              {c.side}
            </Txt>
            {lit && (
              <Txt x={c.x + colW / 2} y={baseY + 40 * f} size={0.72} weight={700} color={c.shaded ? C_AUXIN : C_LIGHT}>
                {c.shaded ? 'skygge' : 'lys'}
              </Txt>
            )}
          </g>
        );
      })}
    </g>
  );
}

function BendPlot({ light, intensity, t }: { light: number; intensity: number; t: number }) {
  const [ref, f] = useContainerTextScale<HTMLDivElement>();
  const H = Math.round(300 + 250 * (f - 1));
  const sign = light < 0 ? -1 : 1;
  return (
    <div ref={ref}>
      <Figure viewBox={`0 0 800 ${H}`} label={`Bøyningen over tid. Etter ${fmt(t, 0)} minutter: ${fmt(Math.abs(bendAngle(light, intensity, t)), 0)} grader.`}>
        <Plot
          x={{ min: 0, max: T_MAX, label: 'Tid (min)', ticks: [0, 30, 60, 90, 120, 150, 180] }}
          y={{ min: 0, max: 90, label: 'Bøyning (grader)', ticks: [0, 30, 60, 90] }}
          width={800}
          height={H}
        >
          {({ sx, sy, y0, y1 }) => (
            <g>
              <line x1={sx(0)} x2={sx(T_MAX)} y1={sy(Math.abs(light))} y2={sy(Math.abs(light))} stroke={C_LIGHT} strokeWidth={2} strokeDasharray="6 5" />
              <path d={linePath(sample((x) => sign * bendAngle(light, intensity, x), 0, T_MAX, 120), sx, sy)} fill="none" stroke={BIO.plante.line} strokeWidth={3.5} />
              <line x1={sx(t)} x2={sx(t)} y1={y0} y2={y1} className="viz-guide" />
              <circle cx={sx(t)} cy={sy(sign * bendAngle(light, intensity, t))} r={7} fill={BIO.plante.line} stroke={VIZ.surface} strokeWidth={2.5} />
              <Txt x={sx(T_MAX) - 6} y={sy(Math.abs(light)) - 8} anchor="end" size={0.75} color={C_LIGHT} weight={650}>
                lysretningen
              </Txt>
            </g>
          )}
        </Plot>
      </Figure>
      <Legend
        items={[
          { color: BIO.plante.line, label: 'Bøyning av spissen' },
          { color: C_LIGHT, label: 'Retningen lyset kommer fra', dashed: true },
        ]}
      />
    </div>
  );
}

function lightText(light: number, intensity: number, tip: number, share: number, t: number): ReactNode {
  const how = (
    <p>
      <strong>Slik virker auksin.</strong> Spissen av koleoptilen lager plantehormonet auksin (IAA), som transporteres nedover. Lys fra siden
      registreres av fotoreseptorer i spissen, og auksin flyttes over til skyggesiden. Der stimulerer auksin cellene til å strekke seg
      (celleforlengelse), så skyggesiden vokser fortere enn lyssiden, og skuddet bøyer seg mot lyset. Det er altså ikke lyssiden som «trekker
      seg sammen»: begge sider vokser, men skyggesiden mest.
    </p>
  );
  if (intensity === 0)
    return (
      <>
        <p>
          <strong>Mørke.</strong> Uten lys fordeles auksinet likt, og koleoptilen vokser rett opp (i mørke styres den av tyngdekraften).
        </p>
        {how}
      </>
    );
  if (Math.abs(light) < 1)
    return (
      <>
        <p>
          <strong>Lys rett ovenfra.</strong> Begge sider får like mye lys, så auksinet fordeles likt (50 %) og koleoptilen vokser rett opp.
        </p>
        {how}
      </>
    );
  return (
    <>
      <p>
        {t < 1 ? (
          <>
            Lyset kommer fra {light < 0 ? 'venstre' : 'høyre'}. Trykk «Spill av» og se hva som skjer de neste tre timene. Allerede nå er{' '}
            {fmtPct(share)} av auksinet på skyggesiden.
          </>
        ) : (
          <>
            Etter {fmt(t, 0)} minutter har koleoptilen bøyd seg {fmt(Math.abs(tip), 0)}° mot lyset. Jo mer spissen peker mot lyset, jo
            likere blir lyset på de to sidene, så bøyningen går saktere og stopper når spissen peker rett mot lampa.
            {Math.abs(tip) > Math.abs(light) * 0.7 ? ' Nå er den nesten der.' : ''}
          </>
        )}
      </p>
      {how}
    </>
  );
}

/* ====================================================================== */
/* 2. Tyngdekraft                                                           */
/* ====================================================================== */

function Tyngdekraft() {
  const [tilt, setTilt] = useState(90);
  const clock = useSimClock({ tMax: T_MAX, speed: 30 });
  const { reset } = clock;
  useEffect(() => reset(), [tilt, reset]);
  const t = clock.t;
  const angle = graviAngle(tilt, t);
  // Hvor skrått stengelen og rota står nå (styrer omfordelingen av auksin)
  const shoot = gravitropism('stengel', angle);
  const root = gravitropism('rot', angle);
  const [ref, f] = useContainerTextScale<HTMLDivElement>();
  return (
    <>
      <Controls>
        <Slider label="Planten legges ned" value={tilt} onChange={setTilt} min={0} max={90} step={5} unit="° fra loddrett" />
      </Controls>
      <Toolbar>
        <PlayBar clock={clock} time={`${fmt(t, 0)} min`} />
      </Toolbar>
      <div ref={ref}>
        <GraviScene tilt={tilt} angle={angle} f={f} t={t} />
      </div>
      <Legend
        items={[
          { color: C_AUXIN, label: 'Auksin (samles på undersiden)' },
          { color: BIO.kloroplast.line, label: 'Statolitter (stivelseskorn som synker)' },
        ]}
      />
      <DosePlot shoot={shoot} root={root} />
      <Readouts>
        <Readout label="Skuddet" value={shoot.bend > 0 ? 'Bøyer seg opp' : 'Vokser rett'} tone={BIO.plante.line} />
        <Readout label="Rota" value={root.bend < 0 ? 'Bøyer seg ned' : 'Vokser rett'} tone={BIO.ved} />
        <Readout label="Vinkel fra loddrett nå" value={fmt(angle, 0)} unit="°" />
      </Readouts>
      <Formula label="Samme auksin, motsatt virkning">
        <FormulaLine>
          Stengel: undersiden vekst {fmt(shoot.growthLower, 2)} mot oversiden {fmt(shoot.growthUpper, 2)} → {shoot.bend > 0 ? 'undersiden vokser mest, bøyer seg opp' : 'lik vekst'}
        </FormulaLine>
        <FormulaLine>
          Rot: undersiden vekst {fmt(root.growthLower, 2)} mot oversiden {fmt(root.growthUpper, 2)} → {root.bend < 0 ? 'oversiden vokser mest, bøyer seg ned' : 'lik vekst'}
        </FormulaLine>
      </Formula>
      <Explain>{graviText(tilt, angle)}</Explain>
    </>
  );
}

function GraviScene({ tilt, angle, f, t }: { tilt: number; angle: number; f: number; t: number }) {
  const narrow = f > 1.3;
  const k = Math.max(1, f * 0.85);
  const H = narrow ? 600 : 430;
  const cx = 400;
  const cy = H / 2 + 10;
  const L = narrow ? 230 : 170;
  const W = narrow ? 44 : 34;
  const shoot = gravitropism('stengel', angle);
  const root = gravitropism('rot', angle);
  // Undersiden er venstre side for skuddet (sett i vekstretningen) når det peker mot høyre
  const shootLeft = 0.5 + (shoot.lower - shoot.upper) / (4 * GRAVI_SHIFT) * 0.3;
  const rootRight = 0.5 + (root.lower - root.upper) / (4 * GRAVI_SHIFT) * 0.3;
  // Statolittene i rotspissen synker mot undersiden
  const rootTipDir = 180 + angle;
  const rootLine = centerline(cx, cy, L, 180 + tilt, rootTipDir);
  const tipQ = rootLine[rootLine.length - 4]!;
  return (
    <Figure viewBox={`0 0 800 ${H}`} maxHeight={narrow ? 900 : H} label={`Kimplante lagt ${fmt(tilt, 0)} grader. Etter ${fmt(t, 0)} minutter peker skuddet ${fmt(angle, 0)} grader fra loddrett opp og rota ${fmt(angle, 0)} grader fra loddrett ned.`}>
      <rect x={20} y={10} width={760} height={H - 20} rx={14} fill="none" stroke={VIZ.grid} strokeWidth={1.5} />
      <line x1={70} x2={70} y1={40} y2={140} stroke={VIZ.muted} strokeWidth={2} />
      <polygon points={`70,${150} 63,${136} 77,${136}`} fill={VIZ.muted} />
      <Txt x={84} y={100} anchor="start" size={0.75} muted>
        tyngdekraft
      </Txt>
      <Shoot x={cx} y={cy} L={L} W={W} base={tilt} tip={angle} leftShare={tilt > 0 ? shootLeft : 0.5} auxin={1} t={t} k={k} />
      <Shoot x={cx} y={cy} L={L * 0.9} W={W * 0.75} base={180 + tilt} tip={rootTipDir} leftShare={tilt > 0 ? 1 - rootRight : 0.5} auxin={1} t={t} k={k} paint={{ fill: mixColor(VIZ.surface, BIO.ved, 0.25), line: BIO.ved }} />
      {/* Statolitter nederst i rotspissen */}
      {[0, 1, 2].map((i) => (
        <circle key={i} cx={tipQ.p[0] - 6 + i * 6} cy={tipQ.p[1] + 6} r={3.4 * k} fill={BIO.kloroplast.line} />
      ))}
      <circle cx={cx} cy={cy} r={20 * k} style={{ fill: mixColor(VIZ.surface, BIO.ved, 0.5) }} stroke={BIO.ved} strokeWidth={1.5} />
      <Txt x={cx + 26 * k} y={cy + 30 * k + 14 * f} anchor="start" size={0.75} muted>
        frø
      </Txt>
      <Txt x={760} y={H - 26} anchor="end" size={0.75} muted>
        {fmt(t, 0)} min
      </Txt>
    </Figure>
  );
}

/** Kurvene stopper ved −1 (bunnen av grafen). */
const clipped = (v: number) => (v < -1 ? NaN : v);

function DosePlot({ shoot, root }: { shoot: ReturnType<typeof gravitropism>; root: ReturnType<typeof gravitropism> }) {
  const [ref, f] = useContainerTextScale<HTMLDivElement>();
  const H = Math.round(320 + 260 * (f - 1));
  const C_ROOT = BIO.ved;
  const C_SHOOT = BIO.plante.line;
  return (
    <div ref={ref}>
      <Figure viewBox={`0 0 800 ${H}`} label="Vekst mot auksinkonsentrasjon for rot og stengel. Rota hemmes ved konsentrasjoner som får stengelen til å vokse.">
        <Plot
          x={{ min: -13, max: -3, label: 'Auksinkonsentrasjon (10ˣ mol/L)', ticks: [-13, -11, -9, -7, -5, -3] }}
          y={{ min: -1, max: 1, label: 'Vekst (relativ)', ticks: [-1, -0.5, 0, 0.5, 1], decimals: 1 }}
          width={800}
          height={H}
        >
          {({ sx, sy }) => (
            <g>
              <path d={linePath(sample((x) => clipped(auxinResponse('rot', x)), -13, -3, 200), sx, sy)} fill="none" stroke={C_ROOT} strokeWidth={3.5} />
              <path d={linePath(sample((x) => clipped(auxinResponse('stengel', x)), -13, -3, 200), sx, sy)} fill="none" stroke={C_SHOOT} strokeWidth={3.5} />
              <Txt x={sx(OPTIMUM.rot)} y={sy(1) - 10} size={0.78} weight={700} color={C_ROOT}>
                rot
              </Txt>
              <Txt x={sx(OPTIMUM.stengel)} y={sy(1) - 10} size={0.78} weight={700} color={C_SHOOT}>
                stengel
              </Txt>
              {[
                { x: root.upper, y: root.growthUpper, c: C_ROOT, l: 'over' },
                { x: root.lower, y: root.growthLower, c: C_ROOT, l: 'under' },
                { x: shoot.upper, y: shoot.growthUpper, c: C_SHOOT, l: 'over' },
                { x: shoot.lower, y: shoot.growthLower, c: C_SHOOT, l: 'under' },
              ].map((m, i) => (
                <g key={i}>
                  <circle cx={sx(m.x)} cy={sy(m.y)} r={m.l === 'under' ? 8 : 6} fill={m.l === 'under' ? C_AUXIN : VIZ.surface} stroke={m.c} strokeWidth={2.5} />
                  {Math.abs(root.lower - root.upper) > 0.2 && (
                    <Txt x={sx(m.x)} y={sy(m.y) + (m.l === 'under' ? 26 * f : -12)} size={0.7} weight={650}>
                      {m.l}
                    </Txt>
                  )}
                </g>
              ))}
            </g>
          )}
        </Plot>
      </Figure>
      <Legend
        items={[
          { color: BIO.plante.line, label: 'Stengel' },
          { color: BIO.ved, label: 'Rot' },
          { color: C_AUXIN, label: 'Fylt prikk: undersiden (mest auksin)' },
        ]}
      />
    </div>
  );
}

function graviText(tilt: number, angle: number): ReactNode {
  const general = (
    <p>
      <strong>Hvorfor hver sin vei?</strong> I rotspissen ligger stivelseskorn (statolitter) som synker mot undersiden og viser hvor «ned» er.
      Auksin samles da på undersiden i både skuddet og rota. Men cellene reagerer ulikt: i stengelen får mer auksin cellene til å strekke seg
      mer, så undersiden vokser mest og skuddet bøyer seg <strong>opp</strong> (negativ gravitropisme). Rota er mye mer følsom for auksin, så
      den høye konsentrasjonen på undersiden <strong>hemmer</strong> veksten der. Oversiden vokser mest, og rota bøyer seg <strong>ned</strong>{' '}
      (positiv gravitropisme). Grafen viser at det samme stoffet kan fremme veksten i én del av planten og hemme den i en annen.
    </p>
  );
  if (tilt === 0)
    return (
      <>
        <p>
          <strong>Planten står rett.</strong> Statolittene ligger i bunnen av cellene, auksinet er likt fordelt, og skudd og rot vokser rett opp og
          ned. Legg planten ned med glidebryteren.
        </p>
        {general}
      </>
    );
  return (
    <>
      <p>
        Planten er lagt {fmt(tilt, 0)}° ned. {angle < 3 ? 'Nå har skuddet og rota rettet seg opp igjen.' : `Skuddet og rota står nå ${fmt(angle, 0)}° fra loddrett og retter seg gradvis opp og ned.`}
      </p>
      {general}
    </>
  );
}

/* ====================================================================== */
/* 3. Klassiske forsøk                                                      */
/* ====================================================================== */

const OUTCOME_TEXT: Record<Outcome, string> = { venstre: 'bøyer seg mot venstre', rett: 'vokser rett opp', hoyre: 'bøyer seg mot høyre' };

function Forsok() {
  const [id, setId] = useState(EXPERIMENTS[0]!.id);
  const [guess, setGuess] = useState<Outcome | null>(null);
  const [shown, setShown] = useState(false);
  const clock = useSimClock({ tMax: 120, speed: 40 });
  const { reset, play } = clock;
  const e = getExperiment(id);
  const r = useMemo(() => runExperiment(e), [e]);
  const [ref, f] = useContainerTextScale<HTMLDivElement>();
  const choose = (v: string) => {
    setId(v);
    setGuess(null);
    setShown(false);
    reset();
  };
  const reveal = () => {
    setShown(true);
    reset();
    play();
  };
  const progress = shown ? 1 - Math.exp(-clock.t / 35) : 0;
  const finalAngle = r.outcome === 'hoyre' ? 40 : r.outcome === 'venstre' ? -40 : 0;
  return (
    <>
      <Toolbar>
        <Select label="Forsøk" value={id} options={EXPERIMENTS.map((x) => ({ value: x.id, label: `${x.who}: ${x.name}` }))} onChange={choose} />
      </Toolbar>
      <Toolbar>
        <Forvalg
          label="Hva tror du skjer"
          options={(['venstre', 'rett', 'hoyre'] as const).map((o) => ({ value: o, label: o === 'venstre' ? 'Mot venstre' : o === 'rett' ? 'Rett opp' : 'Mot høyre' }))}
          value={guess}
          onPick={(v) => {
            setGuess(v);
            setShown(false);
            reset();
          }}
        />
        <button type="button" className="btn btn-sm" onClick={reveal} disabled={shown && clock.playing}>
          Vis resultat
        </button>
      </Toolbar>
      <div ref={ref}>
        <ExperimentScene e={e} r={r} angle={finalAngle * progress} grow={r.grows ? progress : 0} shown={shown} f={f} t={clock.t} />
      </div>
      <Legend
        items={[
          { color: C_AUXIN, label: 'Auksin' },
          ...(e.light ? [{ color: C_LIGHT, label: 'Lys fra høyre' }] : []),
          ...(e.mica !== 'ingen' ? [{ color: VIZ.ink, label: 'Glimmerplate (slipper ikke gjennom)' }] : []),
          ...(e.tip === 'gelatin' || e.tip.startsWith('agar') ? [{ color: BIO.golgi.line, label: e.tip === 'gelatin' ? 'Gelatin' : 'Agarblokk' }] : []),
        ]}
      />
      <Readouts>
        <Readout label="Auksin på venstre side" value={shown ? fmtPct(r.left) : '?'} tone={C_AUXIN} />
        <Readout label="Auksin på høyre side" value={shown ? fmtPct(r.right) : '?'} tone={C_AUXIN} />
        <Readout label="Resultat" value={shown ? capitalize(OUTCOME_TEXT[r.outcome]) : 'Ikke vist ennå'} />
        <Readout
          label="Ditt svar"
          value={guess === null ? 'Ikke valgt' : shown ? (guess === r.outcome ? 'Riktig' : 'Feil') : capitalize(OUTCOME_TEXT[guess])}
          tone={shown && guess !== null ? (guess === r.outcome ? BIO.plante.line : BIO.sir.I) : undefined}
        />
      </Readouts>
      <Explain>{experimentText(e, r.outcome, guess, shown)}</Explain>
    </>
  );
}

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function ExperimentScene({
  e,
  r,
  angle,
  grow,
  shown,
  f,
  t,
}: {
  e: Experiment;
  r: ReturnType<typeof runExperiment>;
  angle: number;
  grow: number;
  shown: boolean;
  f: number;
  t: number;
}) {
  const narrow = f > 1.3;
  const k = Math.max(1, f * 0.85);
  const H = narrow ? 540 : 390;
  const groundY = H - 50;
  const W = narrow ? 64 : 48;
  const L0 = narrow ? 250 : 190;
  const cut = e.tip !== 'intakt';
  const L = L0 * (cut ? 0.85 : 1) * (1 + 0.15 * grow);
  const cx = 400;
  const line = centerline(cx, groundY + 4, L, 0, angle);
  const top = line[line.length - 1]!;
  const below = line[Math.round(line.length * 0.88)]!;
  // Hjelpere for ting som sitter på toppen (hette, gelatin, agar) og rett under (glimmer)
  const along = (q: { p: Pt; a: number }, dx: number, dy: number): Pt => {
    const a = (q.a * Math.PI) / 180;
    // dx på tvers (høyre), dy langs (opp)
    return [q.p[0] + Math.cos(a) * dx + Math.sin(a) * dy, q.p[1] + Math.sin(a) * dx - Math.cos(a) * dy];
  };
  const leftShare = r.left + r.right > 0 ? r.left / (r.left + r.right) : 0.5;
  const auxin = shown ? Math.min(1, r.left + r.right) : r.grows ? 1 : 0;
  const block = (q: { p: Pt; a: number }, x0: number, x1: number, h: number, fill: string, key: string) => {
    const pts = [along(q, x0, 0), along(q, x1, 0), along(q, x1, h), along(q, x0, h)];
    return <polygon key={key} points={pts.map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ')} fill={fill} stroke={BIO.golgi.line} strokeWidth={1.5} />;
  };
  const tipShape = (q: { p: Pt; a: number }, lift: number) => {
    // En liten spiss (avrundet) som sitter `lift` over punktet q
    return (
      <path
        d={`M${along(q, -W / 2, lift)[0]},${along(q, -W / 2, lift)[1]} L${along(q, -W / 2, lift + W * 0.35)[0]},${along(q, -W / 2, lift + W * 0.35)[1]} A${W / 2},${W / 2} 0 0 1 ${along(q, W / 2, lift + W * 0.35)[0]},${along(q, W / 2, lift + W * 0.35)[1]} L${along(q, W / 2, lift)[0]},${along(q, W / 2, lift)[1]} Z`}
        fill={BIO.plante.fill}
        stroke={BIO.plante.line}
        strokeWidth={2}
      />
    );
  };
  return (
    <Figure viewBox={`0 0 800 ${H}`} maxHeight={narrow ? 900 : H} label={`${e.who}: ${e.name}. ${shown ? `Resultat: koleoptilen ${OUTCOME_TEXT[r.outcome]}.` : 'Resultatet er ikke vist ennå.'}`}>
      {!e.light && <rect x={20} y={10} width={760} height={groundY - 10} rx={14} fill={VIZ.bodyStrong} opacity={0.35} />}
      {e.light && <Lamp cx={cx} cy={groundY - L0 * 0.8} R={narrow ? 320 : 300} angle={90} intensity={90} k={k} />}
      <Txt x={40} y={30 * f} anchor="start" weight={700} size={0.85}>
        {e.who}
      </Txt>
      <Txt x={40} y={30 * f + 22 * f * 0.8} anchor="start" size={0.8} muted>
        {e.light ? 'lys fra høyre' : 'i mørke'}
      </Txt>
      <Soil x={20} y={groundY} w={760} h={H - groundY - 6} />
      <Shoot x={cx} y={groundY + 4} L={L} W={W} base={0} tip={angle} leftShare={shown ? leftShare : 0.5} auxin={auxin} t={t} k={k} flat={cut} />
      {/* Rør rundt nedre del */}
      {e.sleeve && (
        <path
          d={`M${line
            .slice(0, Math.round(line.length * 0.72))
            .map((q) => `${q.p[0].toFixed(1)},${q.p[1].toFixed(1)}`)
            .join(' L')}`}
          fill="none"
          stroke={VIZ.ink}
          strokeWidth={W + 12}
          strokeOpacity={0.75}
          strokeLinecap="butt"
        />
      )}
      {/* Hette over spissen */}
      {e.cap !== 'ingen' && (
        <path
          d={`M${along(top, -W / 2 - 6, -W * 0.7)[0]},${along(top, -W / 2 - 6, -W * 0.7)[1]} L${along(top, -W / 2 - 6, W * 0.2)[0]},${along(top, -W / 2 - 6, W * 0.2)[1]} A${W / 2 + 6},${W / 2 + 6} 0 0 1 ${along(top, W / 2 + 6, W * 0.2)[0]},${along(top, W / 2 + 6, W * 0.2)[1]} L${along(top, W / 2 + 6, -W * 0.7)[0]},${along(top, W / 2 + 6, -W * 0.7)[1]}`}
          fill={e.cap === 'ugjennomsiktig' ? VIZ.ink : VIZ.surface}
          fillOpacity={e.cap === 'ugjennomsiktig' ? 0.85 : 0.25}
          stroke={VIZ.ink}
          strokeWidth={2}
          strokeDasharray={e.cap === 'gjennomsiktig' ? '5 4' : undefined}
        />
      )}
      {/* Spissen satt tilbake på gelatin */}
      {e.tip === 'gelatin' && (
        <g>
          {block(top, -W / 2, W / 2, 16, mixColor(VIZ.surface, BIO.golgi.fill, 0.9), 'gel')}
          {tipShape(top, 16)}
        </g>
      )}
      {/* Agarblokk på venstre halvdel av den avkuttede toppen */}
      {e.tip.startsWith('agar') && (
        <g>
          {block(top, -W / 2, 2, 22, mixColor(VIZ.surface, BIO.golgi.fill, 0.9), 'agar')}
          {e.tip === 'agar-auksin' &&
            [0, 1, 2, 3].map((i) => {
              const p = along(top, -W / 2 + 8 + (i % 2) * 12, 6 + Math.floor(i / 2) * 10);
              return <circle key={i} cx={p[0]} cy={p[1]} r={3 * k} fill={C_AUXIN} />;
            })}
        </g>
      )}
      {/* Den avkuttede spissen ligger ved siden av */}
      {e.tip === 'kuttet' && (
        <g transform={`translate(${cx + 150} ${groundY - 12}) rotate(80)`}>
          <path d={`M${-W / 2},0 L${-W / 2},${-W * 0.35} A${W / 2},${W / 2} 0 0 1 ${W / 2},${-W * 0.35} L${W / 2},0 Z`} fill={BIO.plante.fill} stroke={BIO.plante.line} strokeWidth={2} />
        </g>
      )}
      {/* Glimmerplate rett under spissen, på skyggesiden (venstre) eller lyssiden (høyre) */}
      {e.mica !== 'ingen' && (
        <line
          x1={along(below, e.mica === 'skygge' ? -W / 2 - 16 : W / 2 + 16, 0)[0]}
          y1={along(below, e.mica === 'skygge' ? -W / 2 - 16 : W / 2 + 16, 0)[1]}
          x2={along(below, 0, 0)[0]}
          y2={along(below, 0, 0)[1]}
          stroke={VIZ.ink}
          strokeWidth={5}
          strokeLinecap="round"
        />
      )}
      {shown && (
        <Txt x={760} y={groundY - 14} anchor="end" weight={700} size={0.85} color={BIO.plante.line}>
          {capitalize(OUTCOME_TEXT[r.outcome])}
        </Txt>
      )}
    </Figure>
  );
}

const STORY: Record<string, { setup: string; result: string; lesson: string }> = {
  intakt: {
    setup: 'En hel havrekoleoptil får lys fra høyre.',
    result: 'Koleoptilen bøyer seg mot lyset, og bøyningen skjer et stykke under spissen.',
    lesson: 'Charles Darwin og sønnen Francis lurte på hva som registrerer lyset, og hvordan beskjeden kommer fram til der bøyningen skjer.',
  },
  kuttet: {
    setup: 'Spissen er skåret av før lyset slås på.',
    result: 'Uten spissen bøyer koleoptilen seg ikke, og den vokser nesten ikke.',
    lesson: 'Spissen trengs. Men er det fordi den ser lyset, eller fordi den lager noe?',
  },
  hette: {
    setup: 'En ugjennomsiktig hette dekker spissen; resten får lys fra høyre.',
    result: 'Koleoptilen vokser, men bøyer seg ikke.',
    lesson: 'Det er spissen som registrerer lyset, selv om bøyningen skjer lenger ned.',
  },
  glasshette: {
    setup: 'En gjennomsiktig hette dekker spissen.',
    result: 'Koleoptilen bøyer seg mot lyset.',
    lesson: 'Dette er et kontrollforsøk: det var mørket under den ugjennomsiktige hetta, ikke selve hetta, som hindret bøyningen.',
  },
  ror: {
    setup: 'Et ugjennomsiktig rør dekker den nedre delen der bøyningen skjer; spissen får lys.',
    result: 'Koleoptilen bøyer seg mot lyset.',
    lesson:
      'Darwin konkluderte med at «en påvirkning» overføres fra spissen og ned til den delen som bøyer seg. Han visste ikke hva det var.',
  },
  gelatin: {
    setup: 'Spissen er skåret av og satt tilbake med en tynn gelatinblokk imellom.',
    result: 'Koleoptilen bøyer seg mot lyset.',
    lesson: 'Peter Boysen-Jensen viste at signalet går gjennom gelatin: det er et kjemisk stoff som kan diffundere, ikke en nerveimpuls eller lignende.',
  },
  'glimmer-skygge': {
    setup: 'En glimmerplate, som stoffer ikke kommer gjennom, er stukket inn under spissen på skyggesiden (venstre).',
    result: 'Koleoptilen bøyer seg ikke.',
    lesson: 'Stoffet må ned langs skyggesiden for at koleoptilen skal bøye seg. Det er skyggesiden som vokser mest.',
  },
  'glimmer-lys': {
    setup: 'Glimmerplata er stukket inn på lyssiden (høyre).',
    result: 'Koleoptilen bøyer seg mot lyset.',
    lesson: 'Det spiller liten rolle at stoffet stoppes på lyssiden: det er skyggesiden som trenger det for å strekke seg.',
  },
  went: {
    setup: 'Frits Went satte avkuttede spisser på en agarblokk og lot stoffet diffundere inn. Blokken settes på venstre halvdel av en avkuttet koleoptil, i mørke.',
    result: 'Koleoptilen bøyer seg mot høyre, bort fra siden med blokken, selv i mørke.',
    lesson:
      'Stoffet i agaren får cellene under seg til å strekke seg. Went kunne til og med måle mengden av stoffet ut fra hvor mye koleoptilen bøyde seg. Stoffet fikk navnet auksin, av gresk «auxein», å vokse.',
  },
  'went-tom': {
    setup: 'En agarblokk som ikke har hatt spisser på seg, settes på venstre side, i mørke.',
    result: 'Koleoptilen bøyer seg ikke.',
    lesson: 'Kontrollforsøket viser at det er stoffet fra spissene, ikke agaren, som gir bøyningen.',
  },
};

function experimentText(e: Experiment, outcome: Outcome, guess: Outcome | null, shown: boolean): ReactNode {
  const s = STORY[e.id]!;
  if (!shown)
    return (
      <>
        <p>
          <strong>{e.who}.</strong> {s.setup} Hva tror du skjer? Velg et svar og trykk «Vis resultat».
        </p>
        <p>Husk: auksin lages i spissen, går nedover og får cellene til å strekke seg. Siden med mest auksin vokser mest.</p>
      </>
    );
  return (
    <>
      <p>
        <strong>Resultat: {s.result}</strong>{' '}
        {guess === null ? '' : guess === outcome ? 'Du svarte riktig.' : `Du svarte «${OUTCOME_TEXT[guess]}».`}
      </p>
      <p>{s.lesson}</p>
    </>
  );
}
