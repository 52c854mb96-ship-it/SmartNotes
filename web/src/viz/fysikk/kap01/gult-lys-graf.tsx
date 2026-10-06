/**
 * Grafen i «Gult lys: stoppe eller kjøre?» (k1-gult-lys): avstanden til stopplinja når lyset blir gult, mot farten.
 * Over den blå kurven (stopplengden) kan bilen stoppe, under den grønne linja (v₀·t_g − 19,4 m) rekker den over
 * krysset. Mellom dem ligger dilemmasonen (oransje) eller området der begge deler går (lilla).
 */
import { useRef, useState, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent } from 'react';
import { Plot, Txt, VIZ, fmt, useTextScale } from '../../kit';
import { alpha, useStrokeScale, useSvgId } from '../../kit/scene';
import { ColorDot } from './marks';
import { dilemmaLength, pickValues, goLimit, graphTop, kmhToMs, situation, stopDistance, type Situation, type YellowInput } from './model-gult-lys';

/** Fargene til sonene, like i scenen, grafen og fargeforklaringen. */
export const ZONE_COLOR: Record<Situation, string> = {
  stopp: VIZ.series[0]!,
  kjor: VIZ.series[2]!,
  dilemma: VIZ.series[1]!,
  begge: VIZ.series[3]!,
};

const KMH_MAX = 100;

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

const overlaps = (a: Box, b: Box) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

/**
 * Grafen med sonene og punktet (v₀, D). Med `onPick` kan eleven klikke i grafen (og dra med mus) for å velge fart og
 * avstand; verdiene rundes til stegene på glidebryterne. På berøringsskjerm brukes bare klikk, så siden kan rulles.
 */
export function DilemmaGraph({
  input,
  kmh,
  D,
  height,
  onPick,
}: {
  input: YellowInput;
  kmh: number;
  D: number;
  height: number;
  onPick?: (kmh: number, D: number) => void;
}) {
  const f = useTextScale();
  const ss = useStrokeScale();
  const clip = useSvgId('gult-graf');
  const hatch = useSvgId('gult-skravur');
  // Mens eleven drar i grafen, står aksen stille (ellers flytter den seg under musa når D endres).
  const [frozenTop, setFrozenTop] = useState<number | null>(null);
  const top = frozenTop ?? graphTop(input, D);
  const at = (v: number): YellowInput => ({ ...input, v0: kmhToMs(v) });
  const N = 160;
  const vs = Array.from({ length: N + 1 }, (_, i) => (KMH_MAX * i) / N);
  const stopC = vs.map((v) => stopDistance(at(v)));
  const goC = vs.map((v) => goLimit(at(v)));
  const cap = (d: number) => Math.min(top * 1.05, Math.max(0, d));
  // Vokser dilemmasonen med farten i vanlige bytrafikkfarter (40 → 80 km/h)?
  const growing = dilemmaLength(at(80)) > dilemmaLength(at(40));

  return (
    <Plot
      x={{ min: 0, max: KMH_MAX, label: 'Fart v₀ når lyset blir gult (km/h)' }}
      y={{ min: 0, max: top, label: f > 1.3 ? 'Avstand D (m)' : 'Avstand til stopplinja D (m)' }}
      width={800}
      height={height}
      margin={{ top: 46 * f, right: 24 * f, bottom: 56 * f, left: 72 * f }}
    >
      {({ sx, sy, x0, x1, y0, y1 }) => {
        const band = (lower: (i: number) => number, upper: (i: number) => number) => {
          const up = vs.map((v, i) => `${sx(v).toFixed(1)},${sy(cap(Math.max(lower(i), upper(i)))).toFixed(1)}`);
          const lo = vs.map((v, i) => `${sx(v).toFixed(1)},${sy(cap(lower(i))).toFixed(1)}`).reverse();
          return `M${up.join('L')}L${lo.join('L')}Z`;
        };
        const g = (i: number) => goC[i]!;
        const s = (i: number) => stopC[i]!;
        const line = (ys: number[]) =>
          vs
            .map((v, i) => [sx(v), sy(Math.min(top * 1.2, ys[i]!))] as const)
            .map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`)
            .join('');

        // Søylen ved farten nå: sonene langs avstandsaksen, som malingen i kjørefeltet i scenen
        const xs = sx(kmh);
        const zs = stopDistance(input);
        const zg = goLimit(input);
        const col: { from: number; to: number; c: string }[] = [];
        const goTop = Math.max(0, Math.min(zg, zs));
        if (goTop > 0) col.push({ from: 0, to: goTop, c: ZONE_COLOR.kjor });
        if (zs > Math.max(0, zg)) col.push({ from: Math.max(0, zg), to: zs, c: ZONE_COLOR.dilemma });
        else col.push({ from: zs, to: zg, c: ZONE_COLOR.begge });
        col.push({ from: Math.max(zs, zg, 0), to: top, c: ZONE_COLOR.stopp });

        // Punktet (v₀, D) og etiketten «bilen»
        const dot = { x: xs, y: sy(Math.min(D, top)) };
        const carTxt = 'bilen';
        const cw = carTxt.length * 15.5 * f * 0.58;
        const carRight = dot.x + 12 + cw < x1 - 4;
        const carBox: Box = { x: carRight ? dot.x + 10 : dot.x - 12 - cw, y: dot.y - 14 * f, w: cw + 4, h: 18 * f };

        // Etikettene i områdene: prøv et rutenett av plasser og velg den nærmest ønsket plass som ligger helt inne i
        // området og ikke over punktet, søylen eller en annen etikett.
        const taken: Box[] = [carBox, { x: dot.x - 10, y: dot.y - 10, w: 20, h: 20 }, { x: xs - 6, y: y1, w: 12, h: y0 - y1 }];
        const fs = 15.5 * f;
        const inv = (px: number, py: number) => ({ v: ((px - x0) / (x1 - x0)) * KMH_MAX, d: ((y0 - py) / (y0 - y1)) * top });
        const place = (text: string, kind: Situation, want: { x: number; y: number }) => {
          const w = text.length * fs * 0.6 + 8;
          const h = fs * 1.15;
          let best: (Box & { cost: number }) | null = null;
          for (let gx = 0; gx <= 24; gx++)
            for (let gy = 0; gy <= 16; gy++) {
              const cx = x0 + 6 + w / 2 + ((x1 - x0 - 12 - w) * gx) / 24;
              const cy = y1 + 6 + h / 2 + ((y0 - y1 - 12 - h) * gy) / 16;
              const box: Box = { x: cx - w / 2, y: cy - h / 2, w, h };
              if (taken.some((b) => overlaps(b, box))) continue;
              let inside = true;
              for (let u = 0; u <= 4 && inside; u++)
                for (let q = 0; q <= 2 && inside; q++) {
                  const p = inv(box.x + (box.w * u) / 4, box.y + (box.h * q) / 2);
                  if (situation(at(p.v), p.d) !== kind) inside = false;
                }
              if (!inside) continue;
              const cost = Math.hypot(cx - want.x, (cy - want.y) * 1.5);
              if (!best || cost < best.cost) best = { ...box, cost };
            }
          if (best) taken.push(best);
          return best;
        };
        const labels: { text: string; kind: Situation; box: Box }[] = [];
        const tryLabel = (text: string, short: string, kind: Situation, want: { x: number; y: number }) => {
          const b = place(text, kind, want) ?? place(short, kind, want);
          if (b) labels.push({ text: b.w > short.length * fs * 0.6 + 9 ? text : short, kind, box: b });
        };
        tryLabel('Dilemmasone', 'Dilemma', 'dilemma', { x: (x0 + x1) / 2, y: sy(top * 0.45) });
        tryLabel('Kan stoppe', 'Stopp', 'stopp', { x: x0 + (x1 - x0) * 0.18, y: y1 + 20 });
        tryLabel('Rekker over', 'Kjør', 'kjor', { x: x1 - (x1 - x0) * 0.15, y: y0 - 20 });
        tryLabel('Begge går', 'Begge', 'begge', { x: (x0 + x1) / 2, y: sy(top * 0.5) });

        return (
          <g>
            <Txt x={x0} y={y1 - 20 * f} anchor="start" weight={700} size={0.95}>
              {f <= 1.3 && growing ? 'Dilemmasonen vokser med farten' : 'Dilemmasonen og farten'}
            </Txt>
            <defs>
              <clipPath id={clip}>
                <rect x={x0} y={y1} width={x1 - x0} height={y0 - y1} />
              </clipPath>
              <pattern id={hatch} width={9 * ss} height={9 * ss} patternUnits="userSpaceOnUse" patternTransform="rotate(-45)">
                <line x1={0} y1={0} x2={0} y2={9 * ss} stroke={ZONE_COLOR.dilemma} strokeWidth={2.4 * ss} opacity={0.55} />
              </pattern>
            </defs>
            <g clipPath={`url(#${clip})`}>
              {/* Områdene */}
              <path d={band(() => 0, (i) => Math.min(s(i), g(i)))} fill={alpha(ZONE_COLOR.kjor, 0.16)} />
              <path d={band((i) => Math.max(s(i), g(i), 0), () => top * 1.05)} fill={alpha(ZONE_COLOR.stopp, 0.13)} />
              <path d={band((i) => Math.max(0, g(i)), (i) => s(i))} fill={alpha(ZONE_COLOR.dilemma, 0.3)} />
              <path d={band((i) => Math.max(0, g(i)), (i) => s(i))} fill={`url(#${hatch})`} />
              <path d={band((i) => s(i), (i) => g(i))} fill={alpha(ZONE_COLOR.begge, 0.3)} />
              {/* Grensene */}
              <path d={line(goC)} fill="none" stroke={ZONE_COLOR.kjor} strokeWidth={3.2 * ss} strokeLinejoin="round" />
              <path d={line(stopC)} fill="none" stroke={ZONE_COLOR.stopp} strokeWidth={3.2 * ss} strokeLinejoin="round" />
              {/* Søylen ved farten nå */}
              <line x1={xs} x2={xs} y1={y0} y2={y1} stroke={VIZ.ink} strokeWidth={1.2} strokeDasharray="3 4" opacity={0.6} />
              {col.map((c, i) =>
                c.to > c.from ? (
                  <line key={i} x1={xs} x2={xs} y1={sy(Math.min(top * 1.05, c.from))} y2={sy(Math.min(top * 1.05, c.to))} stroke={c.c} strokeWidth={6 * ss} opacity={0.9} />
                ) : null,
              )}
            </g>
            {labels.map((l) => (
              <Txt key={l.kind} x={l.box.x + l.box.w / 2} y={l.box.y + l.box.h * 0.78} size={0.9} weight={700} color={ZONE_COLOR[l.kind]}>
                {l.text}
              </Txt>
            ))}
            {D > top && (
              <Txt x={dot.x} y={y1 - 4 * f} size={0.75} muted>
                D = {fmt(D, 0)} m ↑
              </Txt>
            )}
            {onPick && <PickArea x0={x0} x1={x1} y0={y0} y1={y1} top={top} onPick={onPick} onDrag={(on) => setFrozenTop(on ? top : null)} />}
            <g pointerEvents="none">
              <ColorDot x={dot.x} y={dot.y} r={7.5 * ss} color={VIZ.ink} />
            </g>
            <g pointerEvents="none">
              <Txt x={carRight ? dot.x + 12 : dot.x - 12} y={dot.y + 5 * f} anchor={carRight ? 'start' : 'end'} size={0.9} weight={700}>
                {carTxt}
              </Txt>
            </g>
          </g>
        );
      }}
    </Plot>
  );
}

/** Usynlig flate over grafen som tar imot klikk og drag. */
function PickArea({
  x0,
  x1,
  y0,
  y1,
  top,
  onPick,
  onDrag,
}: {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
  top: number;
  onPick: (kmh: number, D: number) => void;
  onDrag: (dragging: boolean) => void;
}) {
  const dragging = useRef(false);
  const lastType = useRef('');
  const pick = (e: ReactPointerEvent<SVGRectElement> | ReactMouseEvent<SVGRectElement>) => {
    const svg = e.currentTarget.ownerSVGElement;
    const m = svg?.getScreenCTM();
    if (!svg || !m) return;
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse());
    const v = ((p.x - x0) / (x1 - x0)) * KMH_MAX;
    const d = ((y0 - p.y) / (y0 - y1)) * top;
    const [k, dd] = pickValues(v, d);
    onPick(k, dd);
  };
  return (
    <rect
      x={x0}
      y={y1}
      width={Math.max(0, x1 - x0)}
      height={Math.max(0, y0 - y1)}
      fill="transparent"
      style={{ cursor: 'crosshair' }}
      onPointerDown={(e) => {
        lastType.current = e.pointerType;
        if (e.pointerType !== 'mouse') return;
        dragging.current = true;
        onDrag(true);
        e.currentTarget.setPointerCapture(e.pointerId);
        pick(e);
      }}
      onPointerMove={(e) => {
        if (dragging.current) pick(e);
      }}
      onPointerUp={() => {
        dragging.current = false;
        onDrag(false);
      }}
      onPointerCancel={() => {
        dragging.current = false;
        onDrag(false);
      }}
      onClick={(e) => {
        // Mus er allerede håndtert i pointerdown; klikk fra berøring og penn velger punktet her.
        if (lastType.current === 'mouse') return;
        pick(e);
      }}
    />
  );
}
