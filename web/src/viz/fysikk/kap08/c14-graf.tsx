/**
 * Grafene i karbon-14-dateringen (k8-c14): andelen C-14 som er igjen mot tida siden døden, med avlesning av alderen,
 * halveringene (T, 2T, 3T …) og et forstørret utsnitt av de siste prosentene, der kurven er nesten flat. Utsnittet
 * viser hvorfor metoden ikke virker for veldig gamle prøver: den samme måleusikkerheten gir et stadig bredere
 * aldersintervall, og under grensen kan prøven ikke skilles fra en prøve uten C-14.
 */
import { Plot, Txt, VIZ, fmt, linePath, sample, useSvgId, useTextScale } from '../../kit';
import { alpha } from '../../kit/scene';
import { HALF_LIFE, T_AXIS_MAX, ZOOM, ageInterval, datingLimit, fractionLeft, roundAge } from './model-c14';

const READ = VIZ.series[0]!;
const CURVE = VIZ.series[1]!;

/** «5 300 år» (avrundet som i en dateringsrapport). */
export function ageText(t: number): string {
  return `${fmt(roundAge(t), 0)}\u00a0år`;
}

/** Kurven i prosent mot tusen år. */
function curvePoints(from: number, to: number, n = 240): [number, number][] {
  return sample((k) => 100 * fractionLeft(k * 1000), from, to, n);
}

/** Omtrentlig bredde av en tekst i figurens enheter (17 px vanlig skrift, ganger f på mobil). */
const textW = (s: string, f: number, size = 1) => s.length * 17 * f * size * 0.56;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export interface GraphState {
  /** Målt andel (0–1) og usikkerhet (andel, f.eks. 0,003). */
  p: number;
  u: number;
  /** Alder og andel akkurat nå under avspillingen. */
  ageNow: number;
  pNow: number;
  /** Vis avlesningen (når avspillingen er ferdig). */
  showReading: boolean;
}

/** Pil langs x-aksen mot høyre (intervall som fortsetter ut av grafen). */
function ArrowHead({ x, y, color, size = 9 }: { x: number; y: number; color: string; size?: number }) {
  return <polygon points={`${x},${y} ${x - size * 1.4},${y - size * 0.75} ${x - size * 1.4},${y + size * 0.75}`} fill={color} />;
}

/* ---------------------------------------------------------------- Hovedgrafen */

export function MainGraph({ state, height, inset }: { state: GraphState; height: number; inset: boolean }) {
  const f = useTextScale();
  const clipId = useSvgId('c14-graf');
  const { p, u, showReading } = state;
  const P = p * 100;
  const iv = ageInterval(p, u);
  const halvings = [1, 2, 3];
  return (
    <Plot
      x={{ min: 0, max: T_AXIS_MAX / 1000, label: 'Tid siden døden t (tusen år)', ticks: [0, 10, 20, 30, 40, 50, 60] }}
      y={{ min: 0, max: 100, label: f > 1.3 ? 'C-14 igjen (%)' : 'C-14 igjen (% av nivået i levende)', ticks: [0, 20, 40, 60, 80, 100] }}
      width={800}
      height={height}
    >
      {({ sx, sy, x0, x1, y0, y1 }) => {
        const ax = (t: number) => sx(t / 1000);
        // Utsnittet som forstørres
        const zx0 = ax(ZOOM.tMin);
        const zx1 = ax(ZOOM.tMax);
        const zy = sy(ZOOM.pMax * 100);
        // Innfelt forstørrelse oppe til høyre (PC): der kurven er nær null og plassen ellers står tom.
        const box = { x: ax(25000), y: y1 + 2, w: x1 - ax(25000), h: sy(31) - y1 - 2 };

        const ageOk = iv.datable && iv.age <= T_AXIS_MAX;
        const readX = ageOk ? ax(iv.age) : x1;
        // Gamle prøver: på mobil står alderen i forstørrelsen under (her er det for trangt).
        const oldSample = !iv.datable || iv.age > ZOOM.tMin;
        const showAgeLabel = inset || !oldSample;
        const readY = sy(P);
        const label = iv.datable ? `t ≈ ${ageText(iv.age)}` : `t > ${ageText(iv.young)}`;
        const lw = textW(label, f, 0.9);
        // Alderen står over x-aksen, ved siden av den loddrette streken. Gamle prøver: over utsnittet.
        let lx = readX + 8;
        let la: 'start' | 'end' | 'middle' = 'start';
        let ly = y0 - 10;
        if (oldSample) {
          lx = clamp(readX, x0 + lw / 2 + 4, x1 - lw / 2 - 2);
          la = 'middle';
          ly = zy - 12;
        } else if (lx + lw > x1) {
          lx = readX - 8;
          la = 'end';
        }
        const pctLabel = `${fmt(P, 1)}\u00a0%`;
        const ageBox = { x0: la === 'start' ? lx : la === 'end' ? lx - lw : lx - lw / 2, y0: ly - 15 * f, y1: ly + 3 };
        const ageBoxX1 = ageBox.x0 + lw;
        const hitsAge = (x: number, y: number, w: number) =>
          showReading && showAgeLabel && x < ageBoxX1 + 4 && x + w > ageBox.x0 - 4 && y > ageBox.y0 - 2 && y - 14 * f < ageBox.y1;
        const pctY = readY - 9 - 14 * f < y1 ? readY + 20 * f : readY - 9;
        // Andelen står ved y-aksen, eller til høyre for punktet når kurven er for nær aksen (unge prøver på mobil).
        const pctW = textW(pctLabel, f, 0.9);
        const pctX = !ageOk || readX - x0 > pctW + 20 ? x0 + 8 : readX + 12;
        const intEnd = iv.datable ? Math.min(ax(iv.old), x1) : x1;
        const intRuns = !iv.datable || iv.old > T_AXIS_MAX;
        const nowX = ax(state.ageNow);
        const nowY = sy(100 * state.pNow);
        return (
          <g>
            <defs>
              <clipPath id={clipId}>
                <rect x={x0} y={y1 - 2} width={x1 - x0} height={y0 - y1 + 4} />
              </clipPath>
            </defs>
            {/* Halveringene: etter T er 50 % igjen, etter 2T 25 % … */}
            {halvings.map((n) => {
              const hx = ax(n * HALF_LIFE);
              const hy = sy(100 / 2 ** n);
              return (
                <g key={n}>
                  <path d={`M${x0},${hy} L${hx},${hy} L${hx},${y0}`} fill="none" stroke={VIZ.muted} strokeWidth={1.2} strokeDasharray="2 4" opacity={0.8} />
                  <circle cx={hx} cy={hy} r={4} fill={VIZ.surface} stroke={VIZ.muted} strokeWidth={1.5} />
                  {!(showReading && P > 0 && Math.hypot(hx - readX, hy - readY) < 34 * f) && !hitsAge(hx + 7, hy - 7, textW(`${n}T`, f, 0.8)) && (
                    <Txt x={hx + 7} y={hy - 7} anchor="start" size={0.8} muted weight={600}>
                      {n === 1 ? 'T' : `${n}T`}
                    </Txt>
                  )}
                </g>
              );
            })}
            {/* Måleusikkerheten som et bånd */}
            {showReading && (
              <rect
                x={x0}
                width={x1 - x0}
                y={sy(Math.min(100, P + u * 100))}
                height={Math.max(1.5, sy(Math.max(0, P - u * 100)) - sy(Math.min(100, P + u * 100)))}
                fill={alpha(READ, 0.16)}
              />
            )}
            <rect x={zx0} y={zy} width={zx1 - zx0} height={y0 - zy} fill="none" stroke={VIZ.ink} strokeWidth={1.2} strokeDasharray="5 4" opacity={0.6} />
            <path d={linePath(curvePoints(0, T_AXIS_MAX / 1000), sx, sy)} fill="none" stroke={CURVE} strokeWidth={3.5} strokeLinejoin="round" clipPath={`url(#${clipId})`} />

            {showReading && (
              <g>
                {/* Aldersintervallet langs tidsaksen */}
                {Number.isFinite(iv.young) && (
                  <g>
                    <line x1={ax(iv.young)} y1={y0} x2={intEnd} y2={y0} stroke={READ} strokeWidth={7} strokeLinecap="round" opacity={0.45} />
                    {intRuns && <ArrowHead x={x1 + 8} y={y0} color={READ} />}
                  </g>
                )}
                {P > 0 && (
                  <g>
                    <line x1={x0} y1={readY} x2={readX} y2={readY} stroke={READ} strokeWidth={2.4} />
                    {ageOk ? (
                      <g>
                        <line x1={readX} y1={readY} x2={readX} y2={y0} stroke={READ} strokeWidth={2.4} />
                        <ArrowHead x={readX} y={y0 - 1} color={READ} size={7} />
                        <circle cx={readX} cy={readY} r={6.5} fill={READ} stroke={VIZ.surface} strokeWidth={2} />
                      </g>
                    ) : (
                      <ArrowHead x={x1 + 8} y={readY} color={READ} />
                    )}
                  </g>
                )}
                <Txt x={pctX} y={pctY} anchor="start" color={READ} weight={700} size={0.9}>
                  {pctLabel}
                </Txt>
                {showAgeLabel && (
                  <Txt x={lx} y={ly} anchor={la} color={READ} weight={700} size={0.9}>
                    {label}
                  </Txt>
                )}
              </g>
            )}

            {!showReading && (
              <g>
                <line x1={nowX} y1={nowY} x2={nowX} y2={y0} stroke={CURVE} strokeWidth={1.5} opacity={0.7} />
                <circle cx={nowX} cy={nowY} r={7.5} fill={CURVE} stroke={VIZ.surface} strokeWidth={2} />
              </g>
            )}

            {inset ? (
              <g>
                <line x1={zx0} y1={zy} x2={box.x} y2={box.y + box.h} stroke={VIZ.ink} strokeWidth={1} strokeDasharray="5 4" opacity={0.45} />
                <line x1={zx1} y1={zy} x2={box.x + box.w} y2={box.y + box.h} stroke={VIZ.ink} strokeWidth={1} strokeDasharray="5 4" opacity={0.45} />
                <g transform={`translate(${box.x} ${box.y})`}>
                  <rect x={0} y={0} width={box.w} height={box.h} rx={8} fill={VIZ.surface} stroke={VIZ.ink} strokeOpacity={0.35} strokeWidth={1.2} />
                  <ZoomGraph state={state} width={box.w} height={box.h} compact />
                </g>
              </g>
            ) : (
              <Txt x={zx1 - 4} y={zy - 8} anchor="end" size={0.8} muted weight={600}>
                forstørret under
              </Txt>
            )}
          </g>
        );
      }}
    </Plot>
  );
}

/* ---------------------------------------------------------------- Forstørrelsen */

/**
 * De siste prosentene (0–10 %) fra 20 000 til 60 000 år. `compact` er den innfelte utgaven i hovedgrafen på PC.
 */
export function ZoomGraph({ state, width, height, compact = false }: { state: GraphState; width: number; height: number; compact?: boolean }) {
  const f = useTextScale();
  const clipId = useSvgId('c14-zoom');
  const { p, u, showReading } = state;
  const P = p * 100;
  const U = u * 100;
  const iv = ageInterval(p, u);
  const limit = datingLimit(u);
  const margin = compact ? { top: 30, right: 14, bottom: 44, left: 48 } : undefined;
  return (
    <Plot
      x={{ min: ZOOM.tMin / 1000, max: ZOOM.tMax / 1000, label: compact ? 't (tusen år)' : 'Tid siden døden t (tusen år)', ticks: [20, 30, 40, 50, 60] }}
      y={{ min: 0, max: ZOOM.pMax * 100, label: compact ? '' : 'C-14 igjen (%)', ticks: compact || f > 1.3 ? [0, 5, 10] : [0, 2, 4, 6, 8, 10] }}
      width={width}
      height={height}
      margin={margin}
    >
      {({ sx, sy, x0, x1, y0, y1 }) => {
        const ax = (t: number) => sx(t / 1000);
        const lx = ax(limit);
        const inView = P <= ZOOM.pMax * 100;
        const bandTop = Math.min(ZOOM.pMax * 100, P + U);
        const bandBot = Math.max(0, P - U);
        const showBand = showReading && bandBot < ZOOM.pMax * 100;
        const ageX = Number.isFinite(iv.age) ? ax(clamp(iv.age, ZOOM.tMin, ZOOM.tMax)) : x1;
        const ageVisible = Number.isFinite(iv.age) && iv.age >= ZOOM.tMin && iv.age <= ZOOM.tMax;
        const youngX = ax(clamp(iv.young, ZOOM.tMin, ZOOM.tMax));
        const oldX = iv.datable ? ax(clamp(iv.old, ZOOM.tMin, ZOOM.tMax)) : x1;
        const limitText = `grense ≈ ${ageText(limit)}`;
        const limitW = textW(limitText, f, 0.8) * 1.05;
        // Grenseteksten står til venstre for streken, eller til høyre (inne i «for gammel») når den ikke får plass.
        const limitLeft = lx - 6 - limitW >= x0 + 4;
        const row = y1 + 18 * f + 4;
        const tooOldY = limitLeft ? row : row + 22 * f;
        const tooOldW = x1 - lx;
        const ageLabel = iv.datable ? `t ≈ ${ageText(iv.age)}` : `t > ${ageText(iv.young)}`;
        const ageW = textW(ageLabel, f, 0.9);
        const ageRight = ageX + 10 + ageW <= x1;
        const ageY = iv.datable ? Math.max(sy(Math.min(ZOOM.pMax * 100, P + U)) - 10, row + 26 * f) : Math.min(y0 - 14 - 12 * f, sy(P + U) - 8);
        const nowIn = state.ageNow >= ZOOM.tMin && 100 * state.pNow <= ZOOM.pMax * 100;
        return (
          <g>
            <defs>
              <clipPath id={clipId}>
                <rect x={x0} y={y1 - 2} width={x1 - x0} height={y0 - y1 + 4} />
              </clipPath>
            </defs>
            {compact && (
              <g>
                <Txt x={(x0 + x1) / 2} y={20} size={0.8} weight={700}>
                  Forstørret utsnitt
                </Txt>
                <Txt x={x0 - 8} y={y1 - 8} anchor="end" size={0.75} muted>
                  %
                </Txt>
              </g>
            )}
            {/* For gamle prøver: andelen er mindre enn måleusikkerheten */}
            <rect x={lx} y={y1} width={x1 - lx} height={y0 - y1} fill={alpha(VIZ.muted, 0.14)} />
            {tooOldW > textW('for gammel', f, 0.8) + 8 && (
              <Txt x={(lx + x1) / 2} y={tooOldY} size={0.8} muted weight={600}>
                for gammel
              </Txt>
            )}
            {showBand && (
              <rect x={x0} width={x1 - x0} y={sy(bandTop)} height={Math.max(1.5, sy(bandBot) - sy(bandTop))} fill={alpha(READ, 0.18)} />
            )}
            {/* Grensen: der kurven møter måleusikkerheten */}
            <path d={`M${x0},${sy(U)} L${lx},${sy(U)} L${lx},${y1}`} fill="none" stroke={VIZ.ink} strokeWidth={1.4} strokeDasharray="6 4" opacity={0.75} />
            <path d={linePath(curvePoints(ZOOM.tMin / 1000, ZOOM.tMax / 1000, 160), sx, sy)} fill="none" stroke={CURVE} strokeWidth={3.2} clipPath={`url(#${clipId})`} />
            <Txt x={limitLeft ? lx - 6 : lx + 6} y={row} anchor={limitLeft ? 'end' : 'start'} size={0.8} weight={650}>
              {limitText}
            </Txt>

            {showReading && inView && (
              <g>
                <line x1={youngX} y1={y0} x2={oldX} y2={y0} stroke={READ} strokeWidth={7} strokeLinecap="round" opacity={0.45} />
                {!iv.datable && <ArrowHead x={x1 + 8} y={y0} color={READ} />}
                {P > 0 && (
                  <g>
                    <line x1={x0} y1={sy(P)} x2={iv.datable ? ageX : x1} y2={sy(P)} stroke={READ} strokeWidth={2.2} />
                    {ageVisible && iv.datable && <line x1={ageX} y1={sy(P)} x2={ageX} y2={y0} stroke={READ} strokeWidth={2.2} />}
                    {ageVisible && iv.datable && <circle cx={ageX} cy={sy(P)} r={5.5} fill={READ} stroke={VIZ.surface} strokeWidth={2} />}
                  </g>
                )}
                {!compact && (ageVisible || !iv.datable) && (
                  <Txt
                    x={!iv.datable ? x1 - 6 : ageRight ? ageX + 10 : ageX - 10}
                    y={ageY}
                    anchor={!iv.datable || !ageRight ? 'end' : 'start'}
                    color={READ}
                    weight={700}
                    size={0.9}
                  >
                    {ageLabel}
                  </Txt>
                )}
              </g>
            )}
            {!showReading && nowIn && <circle cx={ax(state.ageNow)} cy={sy(100 * state.pNow)} r={6.5} fill={CURVE} stroke={VIZ.surface} strokeWidth={2} />}
          </g>
        );
      }}
    </Plot>
  );
}
