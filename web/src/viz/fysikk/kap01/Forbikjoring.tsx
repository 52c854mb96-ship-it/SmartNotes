import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  Controls,
  Explain,
  Figure,
  Formula,
  FormulaLine,
  Legend,
  PlayControls,
  Plot,
  Readout,
  Readouts,
  Segmented,
  Slider,
  Sub,
  TSub,
  Toggle,
  Toolbar,
  Txt,
  VIZ,
  VizLayout,
  fmt,
  linePath,
  sample,
  useSimClock,
  useTextScale,
} from '../../kit';
import { alpha, useSvgId } from '../../kit/scene';
import { boxPoints, distToBox, placeAlongSegment, segmentPoints, textBox, type Area, type Pt } from './fartskontroll-etiketter';
import { C_CAR, C_CRASH, C_ONCOMING, C_TRUCK, OvertakeScene, sceneLayout } from './forbikjoring-scene';
import {
  CAR_LENGTH,
  GAP_AHEAD,
  GAP_BEHIND,
  ONCOMING_KMH,
  SPEED_LIMIT_KMH,
  TIGHT_MARGIN,
  TRUCKS,
  carFront,
  carVelocity,
  graphDuration,
  kmhToMs,
  legalAcceleration,
  msToKmh,
  oncomingFront,
  overtakePhase,
  relativeGain,
  relativeVelocity,
  solveOvertake,
  targetFront,
  truckFront,
  truckRear,
  type Overtake,
  type TruckId,
} from './model-forbikjoring';

const LIMIT = kmhToMs(SPEED_LIMIT_KMH);

/** Tekstskaleringen figuren får (samme regel som i <Figure>), målt på beholderen før figuren tegnes, og om den er smal. */
function useFigureScale() {
  const ref = useRef<HTMLDivElement>(null);
  const [state, setState] = useState({ narrow: false, f: 1 });
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const update = () => {
      const w = el.getBoundingClientRect().width;
      if (!(w > 0)) return;
      const narrow = w < 560;
      const W = narrow ? 480 : 800;
      const f = Math.round(Math.max(1, 12.5 / 17 / (w / W)) * 20) / 20;
      setState((s) => (s.narrow === narrow && s.f === f ? s : { narrow, f }));
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return { ref, ...state };
}

/**
 * Forbikjøring på landeveien (1B, 1C, 1D): en bil ligger bak en lastebil og akselererer forbi med konstant
 * akselerasjon mens en bil kommer imot. Eleven velger farten til lastebilen, akselerasjonen og avstanden til den
 * møtende bilen og ser hvor lang tid og strekning forbikjøringen trenger, om bilen rekker det, og s-t- og v-t-grafene
 * til alle tre kjøretøyene.
 */
export default function Forbikjoring() {
  const [kmh, setKmh] = useState(60);
  const [a, setA] = useState(2);
  const [D, setD] = useState(450);
  const [truck, setTruck] = useState<TruckId>('lastebil');
  const [arrows, setArrows] = useState(true);
  const o = useMemo(() => solveOvertake({ v0: kmhToMs(kmh), a, D, truckLength: TRUCKS[truck].length }), [kmh, a, D, truck]);
  const clock = useSimClock({ tMax: o.tEnd, speed: 1 });
  const { setT } = clock;
  useEffect(() => {
    if (clock.t > o.tEnd) setT(o.tEnd);
  }, [o.tEnd, clock.t, setT]);
  const t = Math.min(Math.max(clock.t, 0), o.tEnd);
  const { ref, narrow, f } = useFigureScale();
  const lay = sceneLayout(narrow, f);
  const tMaxSlider = Math.ceil(o.tEnd * 10) / 10;
  const name = TRUCKS[truck].name;

  return (
    <VizLayout>
      <Controls>
        <Slider
          label={
            <>
              Farten til {name} v<Sub>0</Sub>
            </>
          }
          ariaLabel={`Farten til ${name}`}
          value={kmh}
          onChange={setKmh}
          min={30}
          max={80}
          step={5}
          unit="km/h"
          decimals={0}
        />
        {/* Høyst 3,0 m/s²: mer klarer bare sportsbiler i landeveisfart */}
        <Slider label="Akselerasjonen til bilen a" value={a} onChange={setA} min={0.3} max={3} step={0.1} unit="m/s²" decimals={1} />
        <Slider label="Avstand til møtende bil D" value={D} onChange={setD} min={100} max={1000} step={10} unit="m" decimals={0} />
        <Slider label="Tid t" value={t} onChange={(x) => setT(x >= o.tEnd - 0.05 ? o.tEnd : x)} min={0} max={tMaxSlider} step={0.1} unit="s" decimals={1} />
      </Controls>
      <Toolbar>
        <Segmented<TruckId>
          label="Velg kjøretøy foran"
          options={(Object.keys(TRUCKS) as TruckId[]).map((id) => ({ value: id, label: TRUCKS[id].label }))}
          value={truck}
          onChange={setTruck}
        />
        <Toggle label="Vis fart og akselerasjon" checked={arrows} onChange={setArrows} />
      </Toolbar>
      <Toolbar>
        <PlayControls clock={clock} decimals={1} />
      </Toolbar>

      <div ref={ref}>
        <Figure viewBox={`0 0 ${lay.W} ${lay.H}`} label={sceneLabel(o, t, truck)} maxHeight={narrow ? 620 : 420}>
          <OvertakeScene o={o} t={t} truck={truck} lay={lay} showArrows={arrows} />
        </Figure>
        <Figure
          viewBox={`0 0 800 ${graphHeights(narrow).reduce((x, y) => x + y, 0)}`}
          label="To grafer med felles tidsakse: posisjonen s til bilen, lastebilen og den møtende bilen, og farten v til de tre kjøretøyene."
          maxHeight={narrow ? 1100 : 640}
        >
          <Graphs o={o} t={t} narrow={narrow} truck={truck} />
        </Figure>
      </div>
      <Legend
        items={[
          { color: C_CAR, label: 'Bilen som kjører forbi' },
          { color: C_TRUCK, label: truck === 'vogntog' ? 'Vogntoget (bånd fra bakenden til fronten)' : 'Lastebilen (bånd fra bakenden til fronten)' },
          { color: C_TRUCK, label: `Mål: bilen ${fmt(GAP_AHEAD, 0)} m foran`, dashed: true },
          { color: C_ONCOMING, label: `Møtende bil, ${ONCOMING_KMH} km/h` },
          { color: VIZ.muted, label: `Fartsgrensen ${SPEED_LIMIT_KMH} km/h`, dashed: true },
          { color: alpha(VIZ.ink, 0.22), label: 'Grått felt: bilen er i motgående felt (fra 0 til T)' },
        ]}
      />

      <Readouts>
        <Readout label="Tid for forbikjøringen T" value={fmt(o.T, 1)} unit="s" tone={C_CAR} />
        <Readout label="Strekning for bilen s" value={fmt(o.s, 0)} unit="m" tone={C_CAR} />
        <Readout
          label={
            <>
              Fri vei som trengs, s + s<Sub>M</Sub>
            </>
          }
          value={fmt(o.needed, 0)}
          unit="m"
        />
        <Readout
          label="Rekker den det?"
          value={o.verdict === 'trygt' ? 'Ja' : o.verdict === 'knepent' ? 'Knepent' : 'Nei'}
          unit={o.verdict === 'kollisjon' ? `mangler ${fmt(-o.margin, 0)} m` : `${fmt(o.timeMargin, 1)} s margin`}
          tone={o.verdict === 'kollisjon' ? C_CRASH : undefined}
        />
      </Readouts>

      <Calculation o={o} truck={truck} />

      <Explain>{explanation(o, t, truck)}</Explain>
    </VizLayout>
  );
}

function sceneLabel(o: Overtake, t: number, truck: TruckId): string {
  const name = TRUCKS[truck].name;
  return (
    `Landevei sett fra siden og ovenfra. En bil kjører forbi ${name} i ${fmt(msToKmh(o.v0), 0)} km/h med akselerasjonen ${fmt(o.a, 1)} m/s², ` +
    `mens en bil kommer imot ${fmt(o.D, 0)} m unna. Forbikjøringen tar ${fmt(o.T, 1)} s og ${fmt(o.s, 0)} m. ` +
    (o.verdict === 'kollisjon' ? `Bilene møtes etter ${fmt(o.tMeet, 1)} s, før forbikjøringen er ferdig.` : `Bilen er tilbake i feltet sitt ${fmt(o.timeMargin, 1)} s før bilene møtes.`) +
    ` Tiden er ${fmt(t, 1)} s.`
  );
}

/* ---------- Grafene ---------- */

/** Fet skrift er bredere enn textBox regner med (vanlig skrift). */
const BOLD = 1.12;

function graphHeights(narrow: boolean): [number, number] {
  return narrow ? [540, 520] : [340, 290];
}

/** Steget mellom akseverdiene: 1, 2 eller 5 ganger en tierpotens, så det blir omtrent `n` steg opp til `max`. */
function niceStep(max: number, n: number): number {
  const raw = Math.max(1e-9, max / n);
  const p = 10 ** Math.floor(Math.log10(raw));
  const m = raw / p;
  return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 5 ? 5 : 10) * p;
}

function ticks(min: number, max: number, step: number): number[] {
  const out: number[] = [];
  for (let v = Math.ceil(min / step - 1e-9) * step; v <= max + 1e-9; v += step) out.push(Math.round(v / step) * step);
  return out;
}

function Graphs({ o, t, narrow, truck }: { o: Overtake; t: number; narrow: boolean; truck: TruckId }) {
  const f = useTextScale();
  const clipS = useSvgId('fb-st');
  const clipV = useSvgId('fb-vt');
  const [h0, h1] = graphHeights(narrow);
  const margin = (last: boolean) => ({ top: 34 * f, right: 26 * f, bottom: (last ? 56 : 30) * f, left: 74 * f });
  const dur = graphDuration(o);
  const tStep = niceStep(dur * 1.02, narrow ? 4 : 7);
  const tMax = Math.ceil((dur * 1.02) / tStep - 1e-9) * tStep;
  const tTicks = ticks(0, tMax, tStep);
  const T = o.T;
  const crash = o.verdict === 'kollisjon';
  const dot = Math.min(1.5, f);
  const fs = 17 * f * 0.85;
  const name = truck === 'vogntog' ? 'vogntog' : 'lastebil';

  // s-t: fra 0 til det høyeste av D og der bilen og mållinja er til slutt
  const sTop = Math.max(o.D, carFront(o, tMax), targetFront(o, tMax));
  const sStep = niceStep(sTop * 1.04, narrow ? 4 : 5);
  const sMax = Math.ceil((sTop * 1.04) / sStep - 1e-9) * sStep;

  // v-t: fra under −u til over sluttfarten og fartsgrensen
  const vStep = 10;
  const vMin = Math.floor((-o.u - 3) / vStep) * vStep;
  const vMax = Math.ceil((Math.max(o.vEnd, LIMIT) * 1.08) / vStep) * vStep;

  const n = 160;
  const carEnd = crash ? o.tMeet : tMax;
  const tNow = Math.min(t, tMax);

  return (
    <>
      {/* s-t */}
      <Plot
        x={{ min: 0, max: tMax, label: '', ticks: tTicks, decimals: tStep < 1 ? 1 : 0 }}
        y={{ min: 0, max: sMax, label: 'Posisjon s (m)', ticks: ticks(0, sMax, sStep) }}
        width={800}
        height={h0}
        margin={margin(false)}
      >
        {({ sx, sy, x0, x1, y0, y1 }) => {
          const area: Area = { x0: x0 + 4, x1: x1 - 4, top: y1 + 2, bottom: y0 - 4 };
          const P = (tt: number, s: number): Pt => ({ x: sx(tt), y: sy(s) });
          const carPts = sample((x) => carFront(o, x), 0, tMax, n).map(([a, b]) => P(a, b));
          const rearPts = [P(0, truckRear(o, 0)), P(tMax, truckRear(o, tMax))];
          const frontPts = [P(0, truckFront(o, 0)), P(tMax, truckFront(o, tMax))];
          const tgtA = P(0, targetFront(o, 0));
          const tgtB = P(tMax, targetFront(o, tMax));
          const onc0 = P(0, o.D);
          const tZero = o.D / o.u;
          const onc1 = tZero < tMax ? P(tZero, 0) : P(tMax, oncomingFront(o, tMax));
          const band = `M${rearPts[0]!.x},${rearPts[0]!.y}L${rearPts[1]!.x},${rearPts[1]!.y}L${frontPts[1]!.x},${frontPts[1]!.y}L${frontPts[0]!.x},${frontPts[0]!.y}Z`;
          const meet = P(o.tMeet, o.xMeet);
          const done = P(T, o.s);
          const xT = sx(Math.min(T, tMax));

          // Etikettene der det er ledig plass
          const oncSeg = segmentPoints(onc0, onc1, 40);
          const tgtSeg = segmentPoints(tgtA, tgtB, 30);
          const bandSeg = [...segmentPoints(rearPts[0]!, rearPts[1]!, 30), ...segmentPoints(frontPts[0]!, frontPts[1]!, 30)];
          const ring = (c: Pt, r: number): Pt[] => Array.from({ length: 12 }, (_, i) => ({ x: c.x + r * Math.cos((i * Math.PI) / 6), y: c.y + r * Math.sin((i * Math.PI) / 6) }));
          const markers = [...ring(meet, 9 * dot), ...ring(done, 6 * dot), ...segmentPoints({ x: xT, y: y0 }, { x: xT, y: done.y }, 20)];
          const fixed = [...carPts, ...oncSeg, ...tgtSeg, ...bandSeg, ...markers];
          const lab = (chars: number) => textBox(chars * BOLD, fs);
          // Møtepunktet først (viktigst), så de andre etikettene rundt det
          const meetText = crash ? 'kollisjon' : 'møtes';
          const meetBox = placeAround(meet, lab(meetText.length).w, lab(meetText.length).h, 9 * dot + 5 * f, fixed, area);
          const placed = boxPoints(meetBox);
          const meetLeader = leader(meet, 9 * dot, meetBox, 8 * f);
          const oncBox = placeAlongSegment(onc0, onc1, lab(11).w, lab(11).h, 6 * f, [...fixed, ...placed], area, { fractions: [0.1, 0.18, 0.26, 0.34, 0.42], prefer: 0.18 });
          placed.push(...boxPoints(oncBox));
          const truckBox = placeAlongSegment(rearPts[0]!, rearPts[1]!, lab(name.length).w, lab(name.length).h, 6 * f, [...fixed, ...placed], area, {
            fractions: [0.55, 0.65, 0.75, 0.85, 0.92],
            prefer: 0.85,
          });
          placed.push(...boxPoints(truckBox));
          const tgtBox = placeAlongSegment(tgtA, tgtB, lab(3).w, lab(3).h, 5 * f, [...fixed, ...placed], area, {
            fractions: [0.04, 0.1, 0.16, 0.24, 0.35, 0.5, 0.65, 0.78, 0.85, 0.92],
            prefer: 0.1,
          });
          placed.push(...boxPoints(tgtBox));
          // Ved kollisjon kan etiketten også stå ved den stiplede fortsettelsen fram til T
          const tB = crash ? Math.min(T, tMax) : carEnd;
          const tA = Math.min(T, tB) * 0.4;
          const carA = P(tA, carFront(o, tA));
          const carB = P(tB, carFront(o, tB));
          const carBox = placeAlongSegment(carA, carB, lab(3).w, lab(3).h, 6 * f, [...fixed, ...placed], area, {
            fractions: [0.2, 0.35, 0.5, 0.65, 0.8, 0.9],
            prefer: 0.65,
          });
          const txt = (b: { cx: number; cy: number }, children: ReactNode, color: string) => (
            <Txt x={b.cx} y={b.cy + fs * 0.33} size={0.85} color={color} weight={700}>
              {children}
            </Txt>
          );
          return (
            <g>
              <defs>
                <clipPath id={clipS}>
                  <rect x={x0} y={y1} width={x1 - x0} height={y0 - y1} />
                </clipPath>
              </defs>
              <Txt x={x0} y={y1 - 12 * f} anchor="start" size={0.9} weight={700}>
                s-t-graf for de tre kjøretøyene
              </Txt>
              {/* Bilen er i motgående felt fra 0 til T */}
              <rect x={x0} y={y1} width={Math.max(0, xT - x0)} height={y0 - y1} fill={alpha(VIZ.ink, 0.05)} />
              <g clipPath={`url(#${clipS})`}>
                <path d={band} fill={alpha(C_TRUCK, 0.3)} stroke={C_TRUCK} strokeWidth={1.6} strokeLinejoin="round" />
                <line x1={tgtA.x} y1={tgtA.y} x2={tgtB.x} y2={tgtB.y} stroke={C_TRUCK} strokeWidth={2} strokeDasharray="8 6" />
                <line x1={onc0.x} y1={onc0.y} x2={onc1.x} y2={onc1.y} stroke={C_ONCOMING} strokeWidth={2.4} opacity={0.35} />
                {t > 0 && <line x1={onc0.x} y1={onc0.y} x2={sx(tNow)} y2={sy(oncomingFront(o, tNow))} stroke={C_ONCOMING} strokeWidth={3.5} strokeLinecap="round" />}
                <path d={linePath(sample((x) => carFront(o, x), 0, carEnd, n), sx, sy)} fill="none" stroke={C_CAR} strokeWidth={2.4} opacity={0.35} />
                {crash && (
                  <path
                    d={linePath(sample((x) => carFront(o, x), o.tMeet, Math.min(T, tMax), 60), sx, sy)}
                    fill="none"
                    stroke={C_CAR}
                    strokeWidth={2}
                    strokeDasharray="5 6"
                    opacity={0.5}
                  />
                )}
                {t > 0 && <path d={linePath(sample((x) => carFront(o, x), 0, tNow, n), sx, sy)} fill="none" stroke={C_CAR} strokeWidth={3.5} />}
              </g>
              {/* T: bilen når mållinja */}
              {T <= tMax && (
                <g>
                  <line x1={xT} x2={xT} y1={y0} y2={done.y} stroke={C_CAR} strokeWidth={1.6} strokeDasharray="4 4" />
                  <Txt
                    x={xT + 5 * f + textBox(9, 17 * f * 0.8).w > x1 ? xT - 5 * f : xT + 5 * f}
                    y={y0 - 8 * f}
                    anchor={xT + 5 * f + textBox(9, 17 * f * 0.8).w > x1 ? 'end' : 'start'}
                    size={0.8}
                    color={C_CAR}
                    weight={700}
                  >
                    T = {fmt(T, 1)} s
                  </Txt>
                  <circle cx={done.x} cy={done.y} r={5.5 * dot} fill={VIZ.surface} stroke={C_CAR} strokeWidth={2.5} />
                </g>
              )}
              <line x1={sx(tNow)} x2={sx(tNow)} y1={y1} y2={y0} className="viz-guide" />
              {/* Møtet, med strek til etiketten når den måtte stå et stykke unna */}
              <circle cx={meet.x} cy={meet.y} r={9 * dot} fill="none" stroke={crash ? C_CRASH : VIZ.ink} strokeWidth={2.6} />
              {meetLeader && (
                <line x1={meetLeader.x1} y1={meetLeader.y1} x2={meetLeader.x2} y2={meetLeader.y2} stroke={crash ? C_CRASH : VIZ.ink} strokeWidth={1.4} />
              )}
              {txt(meetBox, meetText, crash ? C_CRASH : VIZ.ink)}
              {txt(oncBox, 'møtende bil', C_ONCOMING)}
              {txt(truckBox, name, C_TRUCK)}
              {txt(tgtBox, 'mål', C_TRUCK)}
              {txt(carBox, 'bil', C_CAR)}
              <circle cx={sx(tNow)} cy={sy(truckFront(o, tNow))} r={4.5 * dot} fill={C_TRUCK} stroke={VIZ.surface} strokeWidth={2} />
              <circle cx={sx(tNow)} cy={sy(truckRear(o, tNow))} r={4.5 * dot} fill={C_TRUCK} stroke={VIZ.surface} strokeWidth={2} />
              {oncomingFront(o, tNow) >= 0 && <circle cx={sx(tNow)} cy={sy(oncomingFront(o, tNow))} r={6 * dot} fill={C_ONCOMING} stroke={VIZ.surface} strokeWidth={2.5} />}
              <circle cx={sx(tNow)} cy={sy(carFront(o, tNow))} r={6.5 * dot} fill={C_CAR} stroke={VIZ.surface} strokeWidth={2.5} />
            </g>
          );
        }}
      </Plot>

      {/* v-t */}
      <g transform={`translate(0 ${h0})`}>
        <Plot
          x={{ min: 0, max: tMax, label: 'Tid t (s)', ticks: tTicks, decimals: tStep < 1 ? 1 : 0 }}
          y={{ min: vMin, max: vMax, label: 'Fart v (m/s)', ticks: ticks(vMin, vMax, vStep) }}
          width={800}
          height={h1}
          margin={margin(true)}
        >
          {({ sx, sy, x0, x1, y0, y1 }) => {
            const area: Area = { x0: x0 + 4, x1: x1 - 4, top: y1 + 2, bottom: y0 - 4 };
            const P = (tt: number, v: number): Pt => ({ x: sx(tt), y: sy(v) });
            const Tc = Math.min(T, tMax);
            const carPts: [number, number][] = [
              [0, o.v0],
              [Tc, carVelocity(o, Tc)],
              [carEnd, carVelocity(o, carEnd)],
            ];
            const tri = `M${sx(0)},${sy(o.v0)}L${sx(Tc)},${sy(carVelocity(o, Tc))}L${sx(Tc)},${sy(o.v0)}Z`;
            const truckLine = [P(0, o.v0), P(tMax, o.v0)];
            const oncLine = [P(0, -o.u), P(tMax, -o.u)];
            const limLine = [P(0, LIMIT), P(tMax, LIMIT)];
            const carCurve = carPts.map(([a, b]) => P(a, b));
            const obstacles = [
              ...segmentPoints(carCurve[0]!, carCurve[1]!, 30),
              ...segmentPoints(carCurve[1]!, carCurve[2]!, 20),
              ...segmentPoints(truckLine[0]!, truckLine[1]!, 30),
              ...segmentPoints(oncLine[0]!, oncLine[1]!, 30),
              ...segmentPoints(limLine[0]!, limLine[1]!, 30),
            ];
            const lab = (chars: number) => textBox(chars * BOLD, fs);
            // Arealet mellom bilen og lastebilen (trekanten): inni trekanten hvis det er plass, ellers under lastebilens linje
            const areaSize = lab(14);
            const triW = sx(Tc) - sx(0);
            const triH = sy(o.v0) - sy(carVelocity(o, Tc));
            const triC = { x: sx(0) + (2 / 3) * triW, y: sy(o.v0) - triH / 3 };
            const insideTri = (b: { cx: number; cy: number; w: number; h: number }) => {
              const yAB = (x: number) => sy(o.v0) - ((x - sx(0)) / Math.max(1e-9, triW)) * triH;
              const corners = [
                [b.cx - b.w / 2, b.cy - b.h / 2],
                [b.cx + b.w / 2, b.cy - b.h / 2],
                [b.cx - b.w / 2, b.cy + b.h / 2],
                [b.cx + b.w / 2, b.cy + b.h / 2],
              ] as const;
              return corners.every(([x, y]) => x <= sx(Tc) - 3 && y <= sy(o.v0) - 3 && y >= yAB(x) + 3);
            };
            const limPts = segmentPoints(limLine[0]!, limLine[1]!, 60);
            const clearOf = (b: { cx: number; cy: number; w: number; h: number }, pts: Pt[]) => pts.every((p) => distToBox(p, b) > 3);
            const inner = { cx: triC.x, cy: triC.y, ...areaSize };
            const below = { cx: Math.min(x1 - areaSize.w / 2 - 4, Math.max(x0 + areaSize.w / 2 + 4, triC.x)), cy: sy(o.v0) + 7 * f + areaSize.h / 2, ...areaSize };
            const belowFits = below.cy + below.h / 2 < sy(0) - 3 && clearOf(below, limPts);
            // På mobil er trekanten trang, så etiketten står helst under linja til lastebilen
            const areaBox = !narrow && insideTri(inner) && clearOf(inner, limPts) ? inner : belowFits ? below : insideTri(inner) && clearOf(inner, limPts) ? inner : null;
            const areaInside = areaBox === inner;
            const showArea = areaBox !== null && triW > 8;
            const limText = narrow ? `${SPEED_LIMIT_KMH} km/h` : `fartsgrensen ${SPEED_LIMIT_KMH} km/h`;
            const limBox = placeAlongSegment(limLine[0]!, limLine[1]!, lab(limText.length).w, lab(limText.length).h, 5 * f, [...obstacles, ...(areaBox ? boxPoints(areaBox) : [])], area, {
              fractions: [0.05, 0.12, 0.2, 0.5, 0.7, 0.85],
              prefer: 0.12,
            });
            const truckBox = placeAlongSegment(truckLine[0]!, truckLine[1]!, lab(name.length).w, lab(name.length).h, 5 * f, [...obstacles, ...boxPoints(limBox), ...(areaBox ? boxPoints(areaBox) : [])], area, {
              fractions: [0.15, 0.3, 0.45, 0.6, 0.75, 0.9],
              prefer: 0.9,
            });
            const oncText = 'møtende bil (negativ fart)';
            const oncBox = placeAlongSegment(oncLine[0]!, oncLine[1]!, lab(oncText.length).w, lab(oncText.length).h, 5 * f, obstacles, area, {
              fractions: [0.2, 0.5, 0.75],
              prefer: 0.75,
            });
            const carBox = placeAlongSegment(carCurve[1]!, carCurve[2]!, lab(3).w, lab(3).h, 5 * f, [...obstacles, ...boxPoints(limBox), ...boxPoints(truckBox)], area, {
              fractions: [0.3, 0.5, 0.7, 0.9],
              prefer: 0.7,
            });
            const txt = (b: { cx: number; cy: number }, children: ReactNode, color: string, weight = 700) => (
              <Txt x={b.cx} y={b.cy + fs * 0.33} size={0.85} color={color} weight={weight}>
                {children}
              </Txt>
            );
            return (
              <g>
                <defs>
                  <clipPath id={clipV}>
                    <rect x={x0} y={y1} width={x1 - x0} height={y0 - y1} />
                  </clipPath>
                </defs>
                <Txt x={x0} y={y1 - 12 * f} anchor="start" size={0.9} weight={700}>
                  {narrow ? 'v-t-graf for de tre kjøretøyene' : `v-t-graf: arealet mellom bil og ${name} er forspranget`}
                </Txt>
                <rect x={x0} y={y1} width={Math.max(0, sx(Tc) - x0)} height={y0 - y1} fill={alpha(VIZ.ink, 0.05)} />
                <path d={tri} fill={alpha(C_CAR, 0.2)} />
                <line x1={limLine[0]!.x} x2={limLine[1]!.x} y1={limLine[0]!.y} y2={limLine[1]!.y} stroke={VIZ.muted} strokeWidth={2} strokeDasharray="8 6" />
                <g clipPath={`url(#${clipV})`}>
                  <line x1={truckLine[0]!.x} x2={truckLine[1]!.x} y1={truckLine[0]!.y} y2={truckLine[1]!.y} stroke={C_TRUCK} strokeWidth={3} />
                  <line x1={oncLine[0]!.x} x2={oncLine[1]!.x} y1={oncLine[0]!.y} y2={oncLine[1]!.y} stroke={C_ONCOMING} strokeWidth={3} />
                  <path d={linePath(carPts, sx, sy)} fill="none" stroke={C_CAR} strokeWidth={2.4} opacity={0.35} />
                  {t > 0 && <path d={linePath(sample((x) => carVelocity(o, x), 0, tNow, 80), sx, sy)} fill="none" stroke={C_CAR} strokeWidth={3.5} />}
                </g>
                {/* Tidsmarkøren under etikettene, så glorien rundt teksten skjuler den der de krysser */}
                <line x1={sx(tNow)} x2={sx(tNow)} y1={y1} y2={y0} className="viz-guide" />
                {showArea && areaBox && !areaInside && (
                  <line x1={areaBox.cx} y1={areaBox.cy - areaBox.h / 2 - 1} x2={triC.x} y2={Math.min(triC.y, sy(o.v0) - 4)} stroke={C_CAR} strokeWidth={1.4} />
                )}
                {showArea && areaBox && (
                  <Txt x={areaBox.cx} y={areaBox.cy + fs * 0.33} size={0.85} color={C_CAR} weight={700}>
                    Δs<TSub>rel</TSub> = {fmt(o.rel, 1)} m
                  </Txt>
                )}
                {txt(limBox, limText, VIZ.muted, 650)}
                {txt(truckBox, name, C_TRUCK)}
                {txt(oncBox, oncText, C_ONCOMING)}
                {txt(carBox, 'bil', C_CAR)}
                <circle cx={sx(tNow)} cy={sy(o.v0)} r={5 * dot} fill={C_TRUCK} stroke={VIZ.surface} strokeWidth={2} />
                <circle cx={sx(tNow)} cy={sy(-o.u)} r={5 * dot} fill={C_ONCOMING} stroke={VIZ.surface} strokeWidth={2} />
                <circle cx={sx(tNow)} cy={sy(carVelocity(o, tNow))} r={6.5 * dot} fill={C_CAR} stroke={VIZ.surface} strokeWidth={2.5} />
              </g>
            );
          }}
        </Plot>
      </g>
    </>
  );
}

/**
 * Strek fra kanten av en sirkel (sentrum p, radius r) til nærmeste punkt på kanten av en etikett, når etiketten står
 * mer enn `min` fra sirkelen. Ellers null.
 */
function leader(p: Pt, r: number, b: { cx: number; cy: number; w: number; h: number }, min: number) {
  const qx = Math.min(Math.max(p.x, b.cx - b.w / 2), b.cx + b.w / 2);
  const qy = Math.min(Math.max(p.y, b.cy - b.h / 2), b.cy + b.h / 2);
  const d = Math.hypot(qx - p.x, qy - p.y);
  if (!(d > r + min)) return null;
  const ux = (qx - p.x) / d;
  const uy = (qy - p.y) / d;
  return { x1: p.x + ux * (r + 2), y1: p.y + uy * (r + 2), x2: qx - ux * 3, y2: qy - uy * 3 };
}

/**
 * Etikett rundt et punkt (f.eks. møtepunktet): prøver åtte retninger med avstanden `r` fra punktet til kanten av
 * etiketten (og litt lenger ut når det er trangt) og velger den med størst klaring til hindringene, helst nær
 * punktet, over eller til høyre.
 */
function placeAround(p: Pt, w: number, h: number, r: number, obstacles: Pt[], area: Area) {
  let best = { cx: p.x, cy: p.y - r - h / 2, w, h };
  let bestScore = -Infinity;
  for (const extra of [0, 0.9 * h, 1.8 * h]) {
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4 - Math.PI / 2;
      const ux = Math.cos(a);
      const uy = Math.sin(a);
      const d = r + extra;
      const box = { cx: p.x + ux * (d + w / 2), cy: p.y + uy * (d + h / 2), w, h };
      let clear = Infinity;
      for (const q of obstacles) clear = Math.min(clear, distToBox(q, box));
      const out =
        Math.max(0, area.x0 - (box.cx - w / 2)) + Math.max(0, box.cx + w / 2 - area.x1) + Math.max(0, area.top - (box.cy - h / 2)) + Math.max(0, box.cy + h / 2 - area.bottom);
      const score = (out > 0 ? -1000 - out : Math.min(Number.isFinite(clear) ? clear : 1000, 14)) - (uy > 0.5 ? 2 : 0) - (ux < -0.5 ? 1 : 0) - extra / 4;
      if (score > bestScore) {
        bestScore = score;
        best = box;
      }
    }
  }
  return best;
}

/* ---------- Utregning ---------- */

function Calculation({ o, truck }: { o: Overtake; truck: TruckId }) {
  const L = o.truckLength;
  const Ltxt = fmt(L, L % 1 ? 1 : 0);
  const crash = o.verdict === 'kollisjon';
  const vM = (
    <>
      v<Sub>M</Sub>
    </>
  );
  const sM = (
    <>
      s<Sub>M</Sub>
    </>
  );
  const rel = (
    <>
      Δs<Sub>rel</Sub>
    </>
  );
  return (
    <Formula label="Utregning av tiden, strekningen og avstanden som trengs for forbikjøringen">
      <FormulaLine>
        {rel} = {fmt(GAP_BEHIND, 0)} m + {Ltxt} m + {fmt(CAR_LENGTH, 1)} m + {fmt(GAP_AHEAD, 0)} m = {fmt(o.rel, 1)} m{' '}
        <span style={{ color: VIZ.muted }}>(i forhold til {TRUCKS[truck].name})</span>
      </FormulaLine>
      <FormulaLine>
        ½aT² = {rel} ⇒ T = √(2{rel} / a) = √(2 · {fmt(o.rel, 1)} m / {fmt(o.a, 1)} m/s²) = {fmt(o.T, 2)} s
      </FormulaLine>
      <FormulaLine>
        s = v<Sub>0</Sub>T + ½aT² = {fmt(o.v0, 1)} m/s · {fmt(o.T, 2)} s + {fmt(o.rel, 1)} m = {fmt(o.s, 1)} m
      </FormulaLine>
      <FormulaLine>
        v = v<Sub>0</Sub> + aT = {fmt(o.v0, 1)} m/s + {fmt(o.a, 1)} m/s² · {fmt(o.T, 2)} s = {fmt(o.vEnd, 1)} m/s = {fmt(msToKmh(o.vEnd), 0)} km/h
      </FormulaLine>
      <FormulaLine>
        {sM} = {vM}T = {fmt(o.u, 1)} m/s · {fmt(o.T, 2)} s = {fmt(o.sOncoming, 1)} m
      </FormulaLine>
      <FormulaLine>
        s + {sM} = {fmt(o.s, 1)} m + {fmt(o.sOncoming, 1)} m = {fmt(o.needed, 1)} m {crash ? '>' : '≤'} D = {fmt(o.D, 0)} m ⇒{' '}
        {crash ? `mangler ${fmt(-o.margin, 1)} m` : `${fmt(o.margin, 1)} m til overs`}
      </FormulaLine>
      {crash ? (
        <FormulaLine>
          Møtet: ½at² + (v<Sub>0</Sub> + {vM})t = D ⇒ t = {fmt(o.tMeet, 2)} s, før T
        </FormulaLine>
      ) : (
        <FormulaLine>
          Møtet: t = T + {fmt(o.margin, 1)} m / (v + {vM}) = {fmt(o.T, 2)} s + {fmt(o.margin, 1)} m / {fmt(o.vEnd + o.u, 1)} m/s = {fmt(o.tMeet, 2)} s
        </FormulaLine>
      )}
    </Formula>
  );
}

/* ---------- Forklaring ---------- */

/** Hva eleven ser i scenen akkurat nå (endres under avspillingen). */
function nowText(o: Overtake, t: number, truck: TruckId): ReactNode {
  const name = TRUCKS[truck].name;
  const m1 = (x: number) => `${fmt(x, 1)} m`;
  const s1 = (x: number) => `${fmt(x, 1)} s`;
  const rel = m1(o.rel);
  switch (overtakePhase(o, t)) {
    case 'start':
      return (
        <p>
          <strong>Ved start</strong> har bilen samme fart som {name}, så i forhold til {name} står den stille. Nå svinger den ut og akselererer. Den skal
          flytte seg Δs<sub>rel</sub> = {rel} i forhold til {name}, og den blå stripa under veien viser hvor langt den har kommet.
        </p>
      );
    case 'bak':
      return (
        <p>
          <strong>Ved t = {s1(t)}</strong> er bilen ute i motgående felt, men fortsatt bak {name}. I forhold til {name} har den flyttet seg ½at² ={' '}
          {m1(relativeGain(o, t))} av {rel}. Den relative farten startet på null, så bilen bruker lang tid her: etter halve tiden har den bare kommet en
          fjerdedel av veien.
        </p>
      );
    case 'ved siden':
      return (
        <p>
          <strong>Ved t = {s1(t)}</strong> er bilen ved siden av {name}. Den har flyttet seg {m1(relativeGain(o, t))} av {rel} i forhold til {name}, og
          den kjører nå a·t = {fmt(relativeVelocity(o, t), 1)} m/s = {fmt(msToKmh(relativeVelocity(o, t)), 0)} km/h fortere enn {name}.
        </p>
      );
    case 'foran':
      return (
        <p>
          <strong>Ved t = {s1(t)}</strong> er hele bilen forbi {name}, og den svinger inn igjen når luka er {fmt(GAP_AHEAD, 0)} m. Den har flyttet seg{' '}
          {m1(relativeGain(o, t))} av {rel} i forhold til {name}, og den kjører nå {fmt(relativeVelocity(o, t), 1)} m/s ={' '}
          {fmt(msToKmh(relativeVelocity(o, t)), 0)} km/h fortere enn {name}.
        </p>
      );
    case 'kollisjon':
      return (
        <p>
          <strong>Ved t = {s1(o.tMeet)}</strong> møtes bilene mens bilen fortsatt er i motgående felt. Den har bare flyttet seg {m1(relativeGain(o, o.tMeet))}{' '}
          av {rel} i forhold til {name}.
        </p>
      );
    case 'ferdig':
      return (
        <p>
          <strong>Ved t = {s1(t)}</strong> er bilen forbi og tilbake i feltet sitt. Forbikjøringen tok T = {s1(o.T)}
          {t >= o.tMeet - 1e-9 ? `, og bilene passerte hverandre ved t = ${s1(o.tMeet)}.` : '. Spill av videre for å se bilene passere hverandre.'}
        </p>
      );
  }
}

function explanation(o: Overtake, t: number, truck: TruckId): ReactNode {
  const name = TRUCKS[truck].name;
  const Name = name.charAt(0).toUpperCase() + name.slice(1);
  const m0 = (x: number) => `${fmt(x, 0)} m`;
  const s1 = (x: number) => `${fmt(x, 1)} s`;
  const vEndK = msToKmh(o.vEnd);
  const v0K = msToKmh(o.v0);

  const verdict =
    o.verdict === 'kollisjon' ? (
      <p>
        <strong>Bilen rekker det ikke.</strong> Den trenger {m0(o.needed)} fri vei, men den møtende bilen er bare {m0(o.D)} unna. Bilene møtes etter{' '}
        {s1(o.tMeet)}, mens forbikjøringen først er ferdig etter {s1(o.T)}. Her skulle sjåføren ikke ha begynt å kjøre forbi.
      </p>
    ) : o.verdict === 'knepent' ? (
      <p>
        <strong>Bilen rekker det, men det er knepent.</strong> Den trenger {m0(o.needed)} fri vei og har {m0(o.D)}, men er tilbake i feltet sitt bare{' '}
        {s1(o.timeMargin)} før bilene møtes. Det er vanskelig å anslå farten og avstanden til en bil som kommer imot, så med under{' '}
        {fmt(TIGHT_MARGIN, 0)} s margin burde sjåføren latt være.
      </p>
    ) : (
      <p>
        <strong>Bilen rekker det.</strong> Forbikjøringen tar {s1(o.T)}, og bilen kjører {m0(o.s)}. På samme tid kjører den møtende bilen {m0(o.sOncoming)} mot
        den, så bilen trenger {m0(o.needed)} fri vei. Med {m0(o.D)} er den tilbake i feltet sitt {s1(o.timeMargin)} før bilene møtes.
      </p>
    );

  const relative = (
    <p>
      Mange tror bilen bare må kjøre forbi lengden av {name}. Men i forhold til {name} må den flytte seg Δs<sub>rel</sub> = {fmt(o.rel, 1)} m: luka bak,{' '}
      {name}, sin egen lengde og luka foran. Og {name} kjører også, {m0(o.sTruck)} mens forbikjøringen pågår. Derfor kjører bilen {m0(o.s)},{' '}
      {fmt(o.s / o.truckLength, 0)} ganger lengden av {name}. Tiden avhenger ikke av farten til {name}, for ½aT² = Δs<sub>rel</sub> gir T = √(2Δs
      <sub>rel</sub>/a). Dobbelt så stor akselerasjon gir ikke halve tiden, bare 1/√2 ≈ 0,71 av tiden.
    </p>
  );

  const aLegal = legalAcceleration(o.v0, o.rel);
  const dv = o.vEnd - o.v0;
  // Ved kollisjon kommer bilen aldri forbi, så farten «når den er forbi» skrives i kondisjonalis.
  const crash = o.verdict === 'kollisjon';
  const whenPast = crash ? (
    <>Hadde bilen kommet forbi, ville den kjørt {fmt(vEndK, 0)} km/h.</>
  ) : (
    <>Når bilen er forbi, kjører den {fmt(vEndK, 0)} km/h.</>
  );
  let limit: ReactNode;
  if (vEndK > SPEED_LIMIT_KMH + 0.5) {
    if (aLegal > 0) {
      const legal = solveOvertake({ v0: o.v0, a: aLegal, D: o.D, truckLength: o.truckLength, u: o.u });
      limit = (
        <p>
          {whenPast} Fartsgrensen er {SPEED_LIMIT_KMH} km/h, og den gjelder også når du kjører forbi. Bilen startet med samme fart som {name}, så
          fartsforskjellen til slutt er dobbelt så stor som i snitt: 2 · {fmt(o.rel, 1)} m / {s1(o.T)} = {fmt(dv, 1)} m/s = {fmt(msToKmh(dv), 0)} km/h.
          Skal bilen holde seg under {SPEED_LIMIT_KMH} km/h, kan akselerasjonen være høyst {fmt(aLegal, 2)} m/s². Da tar forbikjøringen {s1(legal.T)}, og
          bilen trenger {m0(legal.needed)} fri vei.
        </p>
      );
    } else
      limit = (
        <p>
          {whenPast} {Name} kjører allerede {fmt(v0K, 0)} km/h, så det er umulig å kjøre forbi uten å bryte fartsgrensen på {SPEED_LIMIT_KMH} km/h.
          Fartsgrensen gjelder også når du kjører forbi.
        </p>
      );
  } else
    limit = crash ? (
      <p>
        Bilen ville holdt seg innenfor fartsgrensen og kjørt {fmt(vEndK, 0)} km/h når den var forbi. Prisen er at forbikjøringen tar lang tid, og da trengs mye
        fri vei.
      </p>
    ) : (
      <p>
        Bilen holder seg innenfor fartsgrensen og kjører {fmt(vEndK, 0)} km/h når den er forbi. Prisen er at forbikjøringen tar lang tid, og da trengs mye fri
        vei.
      </p>
    );

  const graphs = (
    <p>
      I s-t-grafen er stigningstallet farten. {Name} er et bånd med konstant stigningstall, og den loddrette avstanden mellom kantene av båndet er lengden
      av {name}. Bilen er en parabel som blir
      brattere fordi farten øker, og den møtende bilen har negativt stigningstall fordi den kjører i negativ retning. Bilen er forbi når parabelen når den
      stiplede mållinja ved t = T.{' '}
      {o.verdict === 'kollisjon'
        ? `Her krysser grafen til den møtende bilen bilens graf ved t = ${s1(o.tMeet)}, før T, mens bilen fortsatt er i motgående felt (det grå feltet).`
        : `Her krysser grafene ved t = ${s1(o.tMeet)}, etter T, så bilene passerer hverandre i hvert sitt felt.`}{' '}
      I v-t-grafen er arealet mellom grafen til bilen og grafen til {name} lik Δs<sub>rel</sub> = {fmt(o.rel, 1)} m.
    </p>
  );

  return (
    <>
      {nowText(o, t, truck)}
      {verdict}
      {relative}
      {limit}
      {graphs}
    </>
  );
}
