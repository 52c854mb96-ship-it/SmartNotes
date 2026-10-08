/**
 * Figuren til eksempeloppgaven «Aktivitet og halveringstid i medisin»: til venstre (øverst på mobil) en scene, til
 * høyre (under på mobil) grafen over aktiviteten A(t) fra målingen. Begge bygger seg opp med stegene:
 *   a) (steg 1–2) aktivitetsmåleren viser aktiviteten etter én og to halveringstider, og grafen får hjelpelinjene,
 *   b) (steg 3–4) måleren viser aktiviteten ved innsprøytingen, og punktet kommer på grafen,
 *   c) (steg 5–6) pasienten på benken ved innsprøytingen og når aktiviteten er nede i andelen p, og linja for p i grafen,
 *   d) (steg 7–8) to pasienter etter tida tD: det medisinske stoffet og det tenkte stoffet, og kurven for det tenkte
 *      stoffet og arealene under kurvene (antall henfall).
 * Med «Vis hele løsningen» vises laben ved innsprøytingen og alt i grafen.
 */
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Figure, Plot, Txt, VIZ, fmt, linePath, useTextScale, type FigureState } from '../../kit';
import { Rom, Underlag, ValueTag, alpha, useStrokeScale, useSvgId } from '../../kit/scene';
import { AVLESER, Avleser, BENK, Bronnkammer, KAMMER, Kabel, PasientPaaBenk, type Opptak } from './aktivitet-deler';
import { Varselskilt } from './halveringstid-deler';
import { activity, decayCurve, sig, type ActivitySolution, type ActivityTask } from './model-eks-aktivitet';

/** Det medisinske stoffet (oransje som morkjernene i «Halveringstid»), det tenkte stoffet og linja for andelen p. */
export const COLOR_ACT = VIZ.series[1]!;
export const COLOR_LONG = VIZ.series[0]!;
export const COLOR_P = VIZ.series[2]!;

const DIM = {
  wide: { W: 800, H: 330, scene: { x: 0, y: 0, w: 300, h: 330 }, graph: { x: 310, y: 0, w: 490, h: 330 } },
  narrow: { W: 480, H: 650, scene: { x: 0, y: 0, w: 480, h: 260 }, graph: { x: 0, y: 270, w: 480, h: 380 } },
};

type Box = { x: number; y: number; w: number; h: number };

const OPPTAK: Record<ActivityTask['id'], Opptak> = { tc: 'skjelett', jod: 'skjoldbrusk', fluor: 'kropp' };

/** Om figuren er smal (mobil): da står scenen over grafen. */
function useNarrow<T extends HTMLElement>(limit = 560) {
  const ref = useRef<T>(null);
  const [narrow, setNarrow] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const update = () => {
      const w = el.getBoundingClientRect().width;
      if (w > 0) setNarrow(w < limit);
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [limit]);
  return [ref, narrow] as const;
}

/** Tallet med n gjeldende siffer og desimalkomma. */
export function fmtSig(v: number, n: number): string {
  if (!Number.isFinite(v)) return '–';
  if (v === 0) return '0';
  const r = sig(v, n);
  const e = Math.floor(Math.log10(Math.abs(r)));
  return fmt(r, Math.max(0, n - 1 - e));
}

/** Tid med enheten til oppgaven: «6,0 h», «8,0 døgn», «110 min». */
export function tText(task: ActivityTask, t: number, dec = task.dec): string {
  return `${fmt(t, dec)} ${task.unit}`;
}

/** Prosent med to gjeldende siffer: 0,0625 → «6,3 %». */
export function pctText(v: number): string {
  return `${fmtSig(v * 100, 2)} %`;
}

const range = (a: number, b: number, step: number) => {
  const out: number[] = [];
  for (let v = a; v <= b + step * 1e-6; v += step) out.push(Math.round(v * 1e6) / 1e6);
  return out;
};

/* ---------- Scenen ---------- */

/** Ramme med avrundede hjørner rundt en scene, og innholdet klippet til rammen. */
function Card({ box, children }: { box: Box; children: ReactNode }) {
  const ss = useStrokeScale();
  const id = useSvgId('ak-kort');
  return (
    <g transform={`translate(${box.x} ${box.y})`}>
      <clipPath id={id}>
        <rect x={0} y={0} width={box.w} height={box.h} rx={12} />
      </clipPath>
      <g clipPath={`url(#${id})`}>{children}</g>
      <rect x={0.5} y={0.5} width={box.w - 1} height={box.h - 1} rx={12} fill="none" stroke={VIZ.grid} strokeWidth={1.2 * ss} />
    </g>
  );
}

/** Laben: aktivitetsmåleren på benken. Avleseren viser aktiviteten `A` ved tida `t` etter målingen. */
function LabScene({ task, w, h, t, A, heading }: { task: ActivityTask; w: number; h: number; t: number; A: number; heading: string }) {
  const f = useTextScale();
  const benchY = Math.round(h * 0.81);
  const depth = h - benchY;
  const head = 30 * f + 6;
  const gap = 0.07;
  const groupW = KAMMER.w + gap + AVLESER.w;
  const P = Math.min((w - 36) / groupW, (benchY - head) / 0.45);
  const left = (w - groupW * P) / 2;
  const cx = left + (KAMMER.w / 2) * P;
  const rx = left + (KAMMER.w + gap + AVLESER.w / 2) * P;
  const verdi = fmtSig(A, 3);
  return (
    <g>
      <Rom x={0} y={0} w={w} h={h} gulvY={benchY + 0.8 * depth} gulv="betong" />
      <Underlag x1={0} x2={w} y={benchY} depth={depth} type="labbenk" />
      <Varselskilt x={rx + (AVLESER.w / 2) * P - 0.05 * P} y={benchY - (AVLESER.h + 0.15) * P} P={P * 1.15} />
      <Kabel x1={cx + (KAMMER.w / 2) * P - 2} y1={benchY - 0.03 * P} x2={rx - (AVLESER.w / 2) * P + 2} y2={benchY - 0.04 * P} bench={benchY} P={P} />
      <Bronnkammer x={cx} y={benchY} P={P} kilde={task.id === 'jod' ? 'flaske' : 'sproyte'} />
      <Avleser x={rx} y={benchY} P={P} nuklide={task.short} verdi={verdi} />
      <Txt x={12} y={20 * f} anchor="start" size={0.85} weight={650} color={COLOR_ACT}>
        {heading}
      </Txt>
      <ValueTag x={w - 10} y={18 * f} anchor="end" text={t === 0 ? 't = 0' : `t = ${tText(task, t)}`} />
    </g>
  );
}

/** Én pasient på benken med en etikett øverst og aktiviteten over pasienten. */
function PatientBay({
  task,
  box,
  niva,
  heading,
  value,
  color,
  seed,
}: {
  task: ActivityTask;
  box: Box;
  niva: number;
  heading: string;
  value: string;
  color?: string;
  seed?: number;
}) {
  const f = useTextScale();
  const floorY = box.y + box.h - Math.max(10, box.h * 0.05);
  const room = Math.max(24, 22 * f) + 8;
  const P = Math.min((box.w - 24) / BENK.L, (floorY - box.y - room) / 1.42);
  const x = box.x + (box.w - BENK.L * P) / 2;
  return (
    <g>
      <PasientPaaBenk x={x} y={floorY} P={P} niva={niva} opptak={OPPTAK[task.id]} seed={seed} />
      <Txt x={box.x + 12} y={box.y + 20 * f} anchor="start" size={0.85} weight={650} color={color}>
        {heading}
      </Txt>
      <ValueTag x={box.x + box.w - 10} y={box.y + 18 * f} anchor="end" text={value} color={color} />
    </g>
  );
}

/* ---------- Grafen ---------- */

/** Vannrett og loddrett hjelpelinje fra aksene til et punkt på kurven, med et punkt der de møtes. */
function Guide({ x, y, x0, y0, color = VIZ.muted, dot = true }: { x: number; y: number; x0: number; y0: number; color?: string; dot?: boolean }) {
  const ss = useStrokeScale();
  return (
    <g>
      <path d={`M${x0},${y} L${x},${y} L${x},${y0}`} fill="none" stroke={color} strokeWidth={1.6 * ss} strokeDasharray={`${5 * ss} ${4 * ss}`} />
      {dot && <circle cx={x} cy={y} r={4.5 * ss} fill={color} stroke={VIZ.surface} strokeWidth={1.5 * ss} />}
    </g>
  );
}

/** Dobbeltpil (mål) mellom to x-verdier i høyden y, med teksten over midten. */
function Span({ xa, xb, y, label, color = VIZ.ink }: { xa: number; xb: number; y: number; label: string; color?: string }) {
  const ss = useStrokeScale();
  const f = useTextScale();
  const a = 6 * ss;
  if (!(xb - xa > 2 * a)) return null;
  return (
    <g>
      <line x1={xa + 1} y1={y} x2={xb - 1} y2={y} stroke={color} strokeWidth={1.8 * ss} />
      <path d={`M${xa},${y} l${a},${-a * 0.6} l0,${a * 1.2} Z M${xb},${y} l${-a},${-a * 0.6} l0,${a * 1.2} Z`} fill={color} />
      <Txt x={(xa + xb) / 2} y={y - 7 * f} size={0.85} weight={650} color={color}>
        {label}
      </Txt>
    </g>
  );
}

function Graph({ task, s, step, all, w, h }: { task: ActivityTask; s: ActivitySolution; step: number; all: boolean; w: number; h: number }) {
  const ss = useStrokeScale();
  const f = useTextScale();
  const g = task.graph;
  const yTop = g.yMax + g.yStep * 0.5;
  const xt = range(0, g.xMax, g.xStep);
  const yt = range(0, g.yMax, g.yStep);
  const on = (from: number, to = 99) => all || (step >= from && step <= to);
  const main = decayCurve(task.A0, 0, g.xMax, task.T);
  const tD = task.tB + task.tD;
  const long = decayCurve(s.Ab, task.tB, g.xMax, task.TLong);
  const after = decayCurve(s.Ab, task.tB, g.xMax, task.T);
  const decTick = g.xStep < 1 ? 1 : 0;
  return (
    <Plot
      x={{ min: 0, max: g.xMax, label: `tid t etter målingen (${task.unit})`, ticks: xt, decimals: decTick }}
      y={{ min: 0, max: yTop, label: 'aktivitet A (MBq)', ticks: yt }}
      width={w}
      height={h}
    >
      {({ sx, sy, x0, x1, y0, y1 }) => {
        const minorX = range(0, g.xMax, g.xMinor).filter((v) => Math.abs(v / g.xStep - Math.round(v / g.xStep)) > 1e-6);
        const minorY = range(0, g.yMax, g.yMinor).filter((v) => Math.abs(v / g.yStep - Math.round(v / g.yStep)) > 1e-6);
        const area = (pts: [number, number][]) => {
          const first = pts[0];
          const last = pts.at(-1);
          if (!first || !last) return '';
          return `${linePath(pts, sx, sy)} L${sx(last[0])},${sy(0)} L${sx(first[0])},${sy(0)} Z`;
        };
        const half = s.halvings;
        const legendY = y1 + 16 * f;
        const legendX = x1 - 8;
        return (
          <g>
            {/* Små ruter (svake), så tida og aktiviteten kan leses av */}
            {minorX.map((v) => (
              <line key={`mx${v}`} x1={sx(v)} x2={sx(v)} y1={y0} y2={y1} stroke={VIZ.grid} strokeWidth={0.6 * ss} opacity={0.55} />
            ))}
            {minorY.map((v) => (
              <line key={`my${v}`} x1={x0} x2={x1} y1={sy(v)} y2={sy(v)} stroke={VIZ.grid} strokeWidth={0.6 * ss} opacity={0.55} />
            ))}

            {/* d) Arealene under kurvene: antall henfall etter innsprøytingen */}
            {on(8, 8) && !all && (
              <>
                <path d={area(long)} fill={alpha(COLOR_LONG, 0.13)} />
                <path d={area(after)} fill={alpha(COLOR_ACT, 0.3)} />
                <Txt x={sx((task.tB + g.xMax) / 2)} y={sy((activity(s.Ab, (g.xMax - task.tB) / 2, task.TLong) + activity(s.Ab, (g.xMax - task.tB) / 2, task.T)) / 2) + 6 * f} size={0.8} color={COLOR_LONG} weight={650}>
                  areal = antall henfall
                </Txt>
              </>
            )}

            {/* d) Det tenkte stoffet */}
            {on(7) && (
              <path d={linePath(long, sx, sy)} fill="none" stroke={COLOR_LONG} strokeWidth={2.6 * ss} strokeDasharray={`${9 * ss} ${6 * ss}`} />
            )}

            {/* Kurven for stoffet */}
            <path d={linePath(main, sx, sy)} fill="none" stroke={COLOR_ACT} strokeWidth={3 * ss} strokeLinejoin="round" />

            {/* a) Halv og en firedel av startaktiviteten */}
            {on(1, 4) && <Guide x={sx(half[1]!.t)} y={sy(half[1]!.A)} x0={x0} y0={y0} />}
            {on(2, 4) && <Guide x={sx(half[2]!.t)} y={sy(half[2]!.A)} x0={x0} y0={y0} />}
            {on(1, 4) && (
              <Txt x={sx(half[1]!.t) + 8} y={sy(half[1]!.A) - 8} anchor="start" size={0.8} weight={650}>
                {`${fmt(half[1]!.A, 0)} MBq`}
              </Txt>
            )}
            {on(2, 4) && (
              <Txt x={sx(half[2]!.t) + 8} y={sy(half[2]!.A) - 8} anchor="start" size={0.8} weight={650}>
                {`${fmt(half[2]!.A, 0)} MBq`}
              </Txt>
            )}
            {!all && step >= 1 && step <= 4 && (
              <>
                <Span xa={sx(0)} xb={sx(task.T)} y={y0 - 12 * f} label="T½" />
                {step >= 2 && <Span xa={sx(task.T)} xb={sx(2 * task.T)} y={y0 - 12 * f} label="T½" />}
              </>
            )}

            {/* b) Innsprøytingen */}
            {on(3) && (
              <g>
                <line x1={sx(task.tB)} x2={sx(task.tB)} y1={y0} y2={y1 + 4} stroke={VIZ.ink} strokeWidth={1.3 * ss} strokeDasharray={`${3 * ss} ${4 * ss}`} opacity={0.75} />
                <Txt x={sx(task.tB) + 6} y={y1 + 14 * f} anchor="start" size={0.78} weight={600} muted>
                  innsprøyting
                </Txt>
              </g>
            )}
            {on(4, 6) && (
              <>
                <Guide x={sx(task.tB)} y={sy(s.Ab)} x0={x0} y0={y0} color={COLOR_ACT} />
                <ValueTag x={sx(task.tB) + 12} y={sy(s.Ab) - 4} anchor="start" text={`${fmtSig(s.Ab, 3)} MBq`} color={COLOR_ACT} size={0.8} />
              </>
            )}

            {/* c) Andelen p av aktiviteten ved innsprøytingen */}
            {on(5, 6) && (
              <g>
                <line x1={x0} x2={x1} y1={sy(s.Ac)} y2={sy(s.Ac)} stroke={COLOR_P} strokeWidth={1.8 * ss} strokeDasharray={`${7 * ss} ${5 * ss}`} />
                <Txt x={x0 + 6} y={sy(s.Ac) - 7 * f} anchor="start" size={0.8} weight={650} color={COLOR_P}>
                  {`${fmtSig(task.p * 100, 2)} %: ${fmtSig(s.Ac, 2)} MBq`}
                </Txt>
              </g>
            )}
            {on(6, 6) && (
              <g>
                <line x1={sx(s.tCross)} x2={sx(s.tCross)} y1={sy(s.Ac)} y2={y0} stroke={COLOR_P} strokeWidth={1.6 * ss} strokeDasharray={`${4 * ss} ${4 * ss}`} />
                <Span xa={sx(task.tB)} xb={sx(s.tCross)} y={sy(s.Ac)} label={tText(task, sig(s.tC, 3), task.unit === 'min' ? 0 : 1)} color={COLOR_P} />
                <circle cx={sx(s.tCross)} cy={sy(s.Ac)} r={4.5 * ss} fill={COLOR_P} stroke={VIZ.surface} strokeWidth={1.5 * ss} />
              </g>
            )}

            {/* d) Andelen som er igjen etter tD */}
            {on(7) && (
              <g>
                <line x1={sx(tD)} x2={sx(tD)} y1={y0} y2={sy(s.ADLong) - 4} stroke={VIZ.ink} strokeWidth={1.3 * ss} strokeDasharray={`${3 * ss} ${4 * ss}`} opacity={0.75} />
                <circle cx={sx(tD)} cy={sy(s.ADLong)} r={4.5 * ss} fill={COLOR_LONG} stroke={VIZ.surface} strokeWidth={1.5 * ss} />
                <circle cx={sx(tD)} cy={sy(s.AD)} r={4.5 * ss} fill={COLOR_ACT} stroke={VIZ.surface} strokeWidth={1.5 * ss} />
                <ValueTag x={sx(tD) - 10} y={sy(s.ADLong) - 16 * f} anchor="end" text={`${pctText(s.fDLong)} igjen`} color={COLOR_LONG} size={0.8} />
                {!all && <ValueTag x={sx(tD) - 10} y={sy(s.AD) - 16 * f} anchor="end" text={`${pctText(s.fD)} igjen`} color={COLOR_ACT} size={0.8} />}
              </g>
            )}

            {/* Forklaring øverst til høyre */}
            <g>
              <line x1={legendX - 26} x2={legendX} y1={legendY - 5 * f} y2={legendY - 5 * f} stroke={COLOR_ACT} strokeWidth={3 * ss} />
              <Txt x={legendX - 32} y={legendY} anchor="end" size={0.8} weight={650} color={COLOR_ACT}>
                {task.short}
              </Txt>
              {on(7) && (
                <>
                  <line x1={legendX - 26} x2={legendX} y1={legendY + 17 * f} y2={legendY + 17 * f} stroke={COLOR_LONG} strokeWidth={2.6 * ss} strokeDasharray={`${7 * ss} ${4 * ss}`} />
                  <Txt x={legendX - 32} y={legendY + 22 * f} anchor="end" size={0.8} weight={650} color={COLOR_LONG}>
                    {`tenkt stoff, T½ = ${fmt(task.TLongText.value, task.TLongText.dec)} ${task.TLongText.unit}`}
                  </Txt>
                </>
              )}
            </g>
          </g>
        );
      }}
    </Plot>
  );
}

/* ---------- Hele figuren ---------- */

export function ActivityFigure({ task, s, state }: { task: ActivityTask; s: ActivitySolution; state: FigureState }) {
  const [ref, narrow] = useNarrow<HTMLDivElement>();
  const { step, showAll } = state;
  const d = narrow ? DIM.narrow : DIM.wide;
  const sc = d.scene;
  const gr = d.graph;
  const part = showAll ? 'b' : step <= 2 ? 'a' : step <= 4 ? 'b' : step <= 6 ? 'c' : 'd';

  let scene: ReactNode;
  let label: string;
  if (part === 'a' || part === 'b') {
    const t = part === 'a' ? (step === 0 ? 0 : step * task.T) : task.tB;
    const A = activity(task.A0, t, task.T);
    const heading = part === 'b' ? (task.id === 'jod' ? 'Ved behandlingen' : 'Ved innsprøytingen') : t === 0 ? 'Ved målingen' : `Etter ${tText(task, t)}`;
    scene = <LabScene task={task} w={sc.w} h={sc.h} t={t} A={A} heading={heading} />;
    label = `Aktivitetsmåleren viser ${fmtSig(A, 3)} MBq for ${task.short} ${t === 0 ? 'ved målingen' : `${tText(task, t)} etter målingen`}.`;
  } else if (part === 'c') {
    const later = step >= 6;
    scene = (
      <>
        <Rom x={0} y={0} w={sc.w} h={sc.h} gulvY={sc.h * 0.6} gulv="fliser" />
        <PatientBay
          task={task}
          box={{ x: 0, y: 0, w: sc.w, h: sc.h }}
          niva={later ? task.p : 1}
          heading={later ? `${tText(task, sig(s.tC, 3), task.unit === 'min' ? 0 : 1)} senere` : 'Ved innsprøytingen'}
          value={`A = ${later ? fmtSig(s.Ac, 2) : fmtSig(s.Ab, 3)} MBq`}
          color={later ? COLOR_P : COLOR_ACT}
        />
      </>
    );
    label = later
      ? `Pasienten ${tText(task, sig(s.tC, 3))} etter innsprøytingen: aktiviteten er ${fmtSig(s.Ac, 2)} MBq, og bare litt stråling kommer ut av kroppen.`
      : `Pasienten ved innsprøytingen: aktiviteten er ${fmtSig(s.Ab, 3)} MBq, og mye stråling kommer ut av kroppen.`;
  } else {
    const halfBox: [Box, Box] = narrow
      ? [
          { x: 0, y: 0, w: sc.w / 2, h: sc.h },
          { x: sc.w / 2, y: 0, w: sc.w / 2, h: sc.h },
        ]
      : [
          { x: 0, y: 0, w: sc.w, h: sc.h / 2 },
          { x: 0, y: sc.h / 2, w: sc.w, h: sc.h / 2 },
        ];
    scene = (
      <>
        <Rom x={0} y={0} w={sc.w} h={sc.h} gulvY={narrow ? sc.h * 0.6 : sc.h * 0.3} gulv="fliser" />
        {!narrow && <Rom x={0} y={sc.h / 2} w={sc.w} h={sc.h / 2} gulvY={sc.h / 2 + sc.h * 0.3} gulv="fliser" />}
        <PatientBay task={task} box={halfBox[0]} niva={s.fD} heading={task.short} value={`${pctText(s.fD)} igjen`} color={COLOR_ACT} />
        <PatientBay task={task} box={halfBox[1]} niva={s.fDLong} heading="Tenkt stoff" value={`${pctText(s.fDLong)} igjen`} color={COLOR_LONG} seed={9} />
        {narrow ? (
          <line x1={sc.w / 2} x2={sc.w / 2} y1={0} y2={sc.h} stroke={VIZ.grid} strokeWidth={1.5} />
        ) : (
          <line x1={0} x2={sc.w} y1={sc.h / 2} y2={sc.h / 2} stroke={VIZ.grid} strokeWidth={1.5} />
        )}
      </>
    );
    label = `To pasienter ${task.tDText.words ?? tText(task, task.tD)} etter innsprøytingen: med ${task.short} er ${pctText(s.fD)} av aktiviteten igjen, med det tenkte stoffet ${pctText(s.fDLong)}.`;
  }

  return (
    <div ref={ref}>
      <Figure viewBox={`0 0 ${d.W} ${d.H}`} label={`${label} Grafen viser aktiviteten som funksjon av tida.`} maxHeight={narrow ? 760 : 460}>
        <Card box={sc}>
          {scene}
        </Card>
        <g transform={`translate(${gr.x} ${gr.y})`}>
          <Graph task={task} s={s} step={step} all={showAll} w={gr.w} h={gr.h} />
        </g>
      </Figure>
    </div>
  );
}
