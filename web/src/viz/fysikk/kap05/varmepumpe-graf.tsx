/**
 * Grafen i «Varmepumpe eller panelovn»: varmefaktoren ε som funksjon av utetemperaturen, med panelovnen (ε = 1)
 * som stiplet linje og et punkt for temperaturen nå.
 */
import { Dot, Plot, Txt, VIZ, fmt, linePath, sample, useTextScale } from '../../kit';
import { useStrokeScale } from '../../kit/scene';
import { T_OUT_MAX, T_OUT_MIN, heatPumpCop } from './model-varmepumpe';
import { FLOW } from './varmepumpe-deler';

export const COP_MAX = 6;

export function CopGraf({ tIn, tOut, width, height }: { tIn: number; tOut: number; width: number; height: number }) {
  const f = useTextScale();
  const ss = useStrokeScale();
  const narrow = width < 700 || f > 1.3;
  const xTicks = narrow ? [-20, -10, 0, 10] : [-25, -20, -15, -10, -5, 0, 5, 10, 15];
  const pts = sample((t) => heatPumpCop(tIn, t), T_OUT_MIN, T_OUT_MAX, 120);
  const cop = heatPumpCop(tIn, tOut);
  return (
    <Plot
      x={{ min: T_OUT_MIN, max: T_OUT_MAX, label: 'Temperatur ute (°C)', ticks: xTicks }}
      y={{ min: 0, max: COP_MAX, label: 'Varmefaktor ε', ticks: [0, 1, 2, 3, 4, 5, 6] }}
      width={width}
      height={height}
    >
      {({ sx, sy, x0, x1, y0 }) => {
        const px = sx(tOut);
        const py = sy(cop);
        // Etiketten ved punktet: over og til venstre, men innenfor aksene
        const text = `ε = ${fmt(cop, 1)}`;
        const tw = text.length * 17 * f * 0.56;
        const lx = Math.max(x0 + 6, Math.min(x1 - tw - 4, px - tw / 2));
        const ly = py - 16 * f;
        // Kurvenavnet over kurven i den enden der punktet ikke er
        const nameLeft = tOut > 0;
        // Kurven stiger mot høyre: til venstre måles høyden der teksten slutter, så den ikke krysser kurven
        const nameW = 10 * 17 * 0.85 * 0.58 * f;
        const nameT = nameLeft ? T_OUT_MIN + ((nameW + 6) / (x1 - x0)) * (T_OUT_MAX - T_OUT_MIN) : T_OUT_MAX;
        const nameY = sy(heatPumpCop(tIn, nameT)) - 12 * f;
        // Teksten i det skraverte området står der punktet ikke er
        const areaT = tOut >= -4 ? -14 : 6;
        const areaY = (sy(1) + sy(Math.min(heatPumpCop(tIn, areaT), COP_MAX))) / 2 + 6 * f;
        return (
          <g>
            {/* Området mellom kurven og panelovnen: varmen varmepumpa henter gratis fra uteluften */}
            <path
              d={`${linePath(pts, sx, sy)}L${sx(T_OUT_MAX)},${sy(1)}L${sx(T_OUT_MIN)},${sy(1)}Z`}
              fill={FLOW.Qk}
              opacity={0.1}
            />
            <line x1={x0} x2={x1} y1={sy(1)} y2={sy(1)} stroke={FLOW.W} strokeWidth={2.4 * ss} strokeDasharray={`${7 * ss} ${5 * ss}`} />
            <Txt x={tOut > 5 ? x0 + 6 : x1 - 4} y={sy(1) + 22 * f} anchor={tOut > 5 ? 'start' : 'end'} color={FLOW.W} size={0.85} weight={650}>
              Panelovn: ε = 1
            </Txt>
            <path d={linePath(pts, sx, sy)} fill="none" stroke={FLOW.cop} strokeWidth={3.2 * ss} strokeLinejoin="round" />
            <Txt x={nameLeft ? x0 + 6 : x1 - 4} y={nameY} anchor={nameLeft ? 'start' : 'end'} color={FLOW.cop} size={0.85} weight={650}>
              Varmepumpe
            </Txt>
            {/* Tilstanden nå */}
            <line x1={px} x2={px} y1={y0} y2={py} className="viz-guide" />
            <line x1={x0} x2={px} y1={py} y2={py} className="viz-guide" />
            <Dot x={px} y={py} r={7 * ss} color={FLOW.cop} />
            <Txt x={lx} y={ly} anchor="start" color={FLOW.cop} weight={720}>
              {text}
            </Txt>
            <Txt x={sx(areaT)} y={areaY} anchor="middle" color={VIZ.muted} size={0.8}>
              hentet fra uteluften
            </Txt>
          </g>
        );
      }}
    </Plot>
  );
}

/** Teksten under grafen. */
export function copLegendItems() {
  return [
    { color: FLOW.cop, label: <span>Varmepumpa: ε = Q<sub>v</sub> / W</span> },
    { color: FLOW.W, label: 'Panelovn: ε = 1 (all strømmen blir varme, ikke mer)', dashed: true },
  ];
}

