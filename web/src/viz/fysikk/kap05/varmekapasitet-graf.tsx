/**
 * Grafen i «Spesifikk varmekapasitet»: temperaturen som funksjon av tiden for de to stoffene, med ønsket
 * temperatur, når hvert stoff er ferdig, kokepunktet (der grafen flater ut) og tiden nå.
 * Samme farger som skiltene i scenen.
 */
import { Plot, Txt, VIZ, fmt, linePath, niceTicks, useTextScale } from '../../kit';
import { heating, type Material } from './model';
import { ColorDot } from './marks';

/** Starttemperatur (°C). */
export const T0 = 20;

export interface Run {
  mat: Material;
  color: string;
  /** Tiden det tar å nå ønsket temperatur (Infinity hvis væsken koker først). */
  tDone: number;
  /** Tiden det tar å nå kokepunktet (Infinity for metallene). */
  tBoil: number;
}

/** Temperaturen ved tiden t. Kokeplata slås av når ønsket temperatur er nådd. */
export function tempAt(run: Run, m: number, P: number, t: number): number {
  return heating(run.mat, m, P, T0, Math.min(t, run.tDone)).T;
}

export function TempGraph({
  runs,
  m,
  P,
  T1,
  t,
  tEnd,
  height,
}: {
  runs: Run[];
  m: number;
  P: number;
  T1: number;
  t: number;
  tEnd: number;
  height: number;
}) {
  const f = useTextScale();
  const same = runs.length === 2 && runs[0]!.mat.id === runs[1]!.mat.id;
  return (
    <Plot
      x={{ min: 0, max: tEnd, label: 'Tid t (s)', ticks: niceTicks(0, tEnd, f > 1.3 ? 4 : 6) }}
      y={{ min: 0, max: 110, label: 'Temperatur T (°C)', ticks: [0, 20, 40, 60, 80, 100] }}
      width={800}
      height={height}
    >
      {({ sx, sy, x0, x1, y0 }) => {
        // Når stoffene er ferdige: etiketter nede ved tidsaksen. Flytt den ene opp hvis de er for nær hverandre.
        const doneX = runs.map((r) => (Number.isFinite(r.tDone) ? sx(r.tDone) : NaN));
        const close = Math.abs((doneX[0] ?? 0) - (doneX[1] ?? 0)) < 80 * f;
        // Navnet på stoffet over punktet der det er ferdig (eller over enden av platået når væsken koker).
        // Står punktene for nær hverandre, flyttes det første navnet til venstre og det andre til høyre.
        const nameW = runs.map((r) => r.mat.name.length * 17 * 0.9 * f * 0.6);
        const ends = runs.map((r, i) =>
          Number.isFinite(doneX[i] ?? NaN) ? { x: doneX[i]!, y: sy(T1) } : { x: x1 - 8, y: sy(r.mat.boil ?? T1) },
        );
        const gap = Math.abs((ends[0]?.x ?? 0) - (ends[1]?.x ?? 0));
        const crowded = !same && gap < 0.5 * ((nameW[0] ?? 0) + (nameW[1] ?? 0)) + 12 && Math.abs((ends[0]?.y ?? 0) - (ends[1]?.y ?? 0)) < 24 * f;
        const first = (ends[0]?.x ?? 0) <= (ends[1]?.x ?? 0) ? 0 : 1;
        const names = runs.map((_, i) => {
          const end = ends[i]!;
          const w = nameW[i] ?? 0;
          let anchor: 'start' | 'middle' | 'end' = 'middle';
          let nx = end.x;
          if (crowded) {
            anchor = i === first ? 'end' : 'start';
            nx = end.x + (i === first ? -10 : 10);
          }
          if (anchor === 'middle' && nx + w / 2 > x1 - 2) {
            anchor = 'end';
            nx = Math.min(end.x + 8, x1 - 2);
          } else if (anchor === 'middle' && nx - w / 2 < x0 + 2) {
            anchor = 'start';
            nx = x0 + 2;
          }
          const left = anchor === 'start' ? nx : anchor === 'end' ? nx - w : nx - w / 2;
          return { x: nx, y: end.y - 14, anchor, left, right: left + w, show: !(same && i === 1) };
        });
        // «Mål 60 °C» over den stiplede linja, til venstre eller til høyre der det er ledig (ellers forklarer tegnforklaringen den)
        const goalW = (8 + String(Math.round(T1)).length) * 17 * 0.82 * f * 0.58;
        const goalSpots = [
          { x: x0 + 8, y: sy(T1) - 9, anchor: 'start' as const, left: x0 + 8 },
          { x: x1 - 8, y: sy(T1) - 9, anchor: 'end' as const, left: x1 - 8 - goalW },
        ];
        const goal = goalSpots.find((g) =>
          names.every((n) => !n.show || Math.abs(n.y - g.y) > 18 * f || n.right < g.left - 6 || n.left > g.left + goalW + 6),
        );
        return (
          <g>
            <line x1={x0} x2={x1} y1={sy(T1)} y2={sy(T1)} stroke={VIZ.muted} strokeWidth={1.6} strokeDasharray="7 5" />
            {goal && (
              <Txt x={goal.x} y={goal.y} anchor={goal.anchor} size={0.82} muted>
                Mål {fmt(T1, 0)} °C
              </Txt>
            )}
            {runs.map((r, i) => {
              const pts: [number, number][] = [];
              const stop = Number.isFinite(r.tDone) ? r.tDone : tEnd;
              const kink = Math.min(stop, r.tBoil);
              pts.push([0, T0], [kink, tempAt(r, m, P, kink)]);
              if (stop > kink) pts.push([stop, tempAt(r, m, P, stop)]);
              const x = doneX[i] ?? NaN;
              const later = i === 1 ? (doneX[1] ?? 0) >= (doneX[0] ?? 0) : (doneX[0] ?? 0) > (doneX[1] ?? 0);
              const labelY = y0 - 10 - (close && later ? 26 * f : 0);
              const name = names[i]!;
              return (
                <g key={i}>
                  {/* Kontur under linja så den skiller seg fra rutenettet og den andre linja */}
                  <path d={linePath(pts, sx, sy)} fill="none" stroke={VIZ.surface} strokeWidth={7} strokeLinejoin="round" strokeLinecap="round" opacity={0.9} />
                  <path d={linePath(pts, sx, sy)} fill="none" stroke={r.color} strokeWidth={3.6} strokeLinejoin="round" strokeLinecap="round" />
                  {name.show && (
                    <Txt x={name.x} y={name.y} anchor={name.anchor} size={0.9} weight={740} color={r.color}>
                      {r.mat.name}
                    </Txt>
                  )}
                  {Number.isFinite(x) && (
                    <>
                      <line x1={x} x2={x} y1={sy(T1)} y2={y0} className="viz-guide" />
                      <ColorDot x={x} y={sy(T1)} r={6} color={r.color} />
                      <Txt x={x > x1 - 90 * f ? x - 8 : x + 8} y={labelY} anchor={x > x1 - 90 * f ? 'end' : 'start'} size={0.85} weight={700} color={r.color}>
                        {fmt(r.tDone, 0)} s
                      </Txt>
                    </>
                  )}
                  {!Number.isFinite(r.tDone) && r.mat.boil !== undefined && (
                    <Txt x={x1 - 8} y={sy(r.mat.boil) + 24 * f} anchor="end" size={0.85} weight={650} color={r.color}>
                      Koker ved {fmt(r.mat.boil, 0)} °C
                    </Txt>
                  )}
                </g>
              );
            })}
            {/* Tiden nå */}
            <line x1={sx(t)} x2={sx(t)} y1={y0} y2={sy(106)} stroke={VIZ.ink} strokeWidth={1.5} opacity={0.45} />
            {runs.map((r, i) => (
              <ColorDot key={i} x={sx(t)} y={sy(tempAt(r, m, P, t))} r={8} color={r.color} />
            ))}
          </g>
        );
      }}
    </Plot>
  );
}
