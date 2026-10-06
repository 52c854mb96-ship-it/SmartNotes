/**
 * Kraftregnskapet til tautrekkingen: for hvert lag en stolpe med friksjonen fra bakken nå (fylt) og den største
 * statiske friksjonen laget kan få, μs · mg (stiplet). Én loddrett strek viser snordraget S, som er det samme for
 * begge lagene. Så lenge fyllet når akkurat til streken, er R = S og kraftsummen null. Når et lag glir, blir det et
 * gap mellom R og S: det er kraftsummen på laget, vist som en magenta stripe rett under stolpen (likt for begge lagene,
 * enten R er større eller mindre enn S).
 */
import { useEffect, useRef, useState } from 'react';
import { Figure, TSub, Txt, VIZ, fmt, niceTicks, useTextScale } from '../../kit';
import { alpha, useStrokeScale } from '../../kit/scene';
import { FESTE_NAVN, type Feste, type TugPlan, type TugState } from './model-tautrekking';

const W = 800;

/** Tekstskaleringen figuren vil få i denne beholderen (som Figure regner ut), så høyden kan velges før tegningen. */
function useContainerTextScale<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [f, setF] = useState(1);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const update = () => {
      const w = el.getBoundingClientRect().width - (window.innerWidth <= 600 ? 10 : 18);
      if (w > 0) setF(Math.round(Math.max(1, 12.5 / 17 / (w / W)) * 20) / 20);
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, f] as const;
}

/** Pen øvre grense for aksen (100, 120, 150, 200, 250, 300, 400, 500 …). */
function axisMax(v: number): number {
  const mag = 10 ** Math.floor(Math.log10(Math.max(v, 1e-9)));
  for (const n of [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10]) if (n * mag >= v - 1e-9) return n * mag;
  return 10 * mag;
}

/** Krefter med fornuftig antall siffer: 88,3 N og 706 N. */
export function fN(v: number): string {
  return fmt(v, Math.abs(v) < 99.95 ? 1 : 0);
}

/** Høyden på figuren for tekstskaleringen f (se Content). */
function heightFor(f: number): number {
  return Math.round(198 * f + 12);
}

export interface RegnskapProps {
  mA: number;
  mB: number;
  festeA: Feste;
  festeB: Feste;
  plan: TugPlan;
  state: TugState;
  /** Største kraft under hele dragkampen (aksen endres ikke under avspillingen). */
  peak: number;
}

export function Kraftregnskap(props: RegnskapProps) {
  const [ref, f] = useContainerTextScale<HTMLDivElement>();
  const h = heightFor(f);
  const { state } = props;
  return (
    <div ref={ref}>
      <Figure
        viewBox={`0 0 ${W} ${h}`}
        label={`Kraftregnskap langs bakken: snordraget er ${fN(state.S)} N på begge lagene, friksjonen fra bakken er ${fN(state.RA)} N på lag A og ${fN(state.RB)} N på lag B.`}
        maxHeight={400}
      >
        <Content {...props} />
      </Figure>
    </div>
  );
}

function Content({ mA, mB, festeA, festeB, plan, state, peak }: RegnskapProps) {
  const f = useTextScale();
  const ss = useStrokeScale();
  const top = axisMax(Math.max(peak, plan.RmaxA, plan.RmaxB) * 1.04);
  const x0 = 24;
  const x1 = W - 24;
  /** Bredden på etiketten «μsmg = 1 413 N» (omtrent), og plass til den til høyre for den lengste stolpen. */
  const maxLabelW = (n: number) => (10 + fN(n).length) * 17 * f * 0.78 * 0.6;
  const reserve = Math.max(maxLabelW(plan.RmaxA), maxLabelW(plan.RmaxB)) + 14;
  const xEnd = x1 - reserve;
  const sx = (v: number) => x0 + (Math.max(0, Math.min(top, v)) / top) * (xEnd - x0);
  const barH = 22 * f;
  const yS = 20 * f;
  const labelA = yS + 32 * f;
  const barA = labelA + 9 * f;
  const labelB = barA + barH + 28 * f;
  const barB = labelB + 9 * f;
  const axisY = barB + barH + 12 * f;
  const tickY = axisY + 20 * f;
  const titleY = tickY + 26 * f;

  const rows = [
    { side: 'A' as const, m: mA, feste: festeA, R: state.RA, Rmax: plan.RmaxA, sliding: state.slidingA, net: state.netA, labelY: labelA, barY: barA },
    { side: 'B' as const, m: mB, feste: festeB, R: state.RB, Rmax: plan.RmaxB, sliding: state.slidingB, net: state.netB, labelY: labelB, barY: barB },
  ];
  const xs = sx(state.S);
  /** Omtrentlig bredde på radetiketten «Lag A · 120 kg · gress · glir» (fet start, resten vanlig). */
  const rowLabelW = (r: (typeof rows)[number]) => {
    const rest = ` · ${fmt(r.m, 0)} kg · ${FESTE_NAVN[r.feste].toLowerCase()}${r.sliding ? ' · glir' : ''}`;
    return 5 * 17 * f * 0.9 * 0.62 + rest.length * 17 * f * 0.9 * 0.53;
  };
  const sText = `S = ${fN(state.S)} N`;
  const sW = sText.length * 17 * f * 0.9 * 0.58;
  const sLabelX = Math.min(x1 - sW / 2, Math.max(x0 + sW / 2, xs));

  return (
    <g>
      {/* Aksen */}
      {niceTicks(0, top, 5).map((v) => (
        <g key={v}>
          <line x1={sx(v)} x2={sx(v)} y1={barA - 4 * f} y2={axisY} stroke={VIZ.grid} strokeWidth={1} />
          <Txt x={sx(v)} y={tickY} size={0.82} muted halo={false}>
            {fmt(v, 0)}
          </Txt>
        </g>
      ))}
      <line x1={x0} x2={xEnd} y1={axisY} y2={axisY} stroke={VIZ.muted} strokeWidth={1.2 * ss} />
      <Txt x={(x0 + xEnd) / 2} y={titleY} size={0.86} muted weight={650} halo={false}>
        Kraft langs bakken (N)
      </Txt>

      {/* Stolpene: største statiske friksjon (stiplet), friksjonen nå (fylt) og kraftsummen (stripe under, fra R til S) */}
      {rows.map((r) => {
        const xR = sx(r.R);
        const xMax = sx(r.Rmax);
        const gap = Math.abs(r.net) > 0.05 && Math.abs(xR - xs) > 1;
        const stripeY = r.barY + barH + 1.5 * f;
        const stripeH = 5.5 * f;
        return (
          <g key={r.side}>
            <rect
              x={x0}
              y={r.barY}
              width={Math.max(0, xMax - x0)}
              height={barH}
              rx={5}
              fill={alpha(VIZ.friction, 0.1)}
              stroke={VIZ.friction}
              strokeWidth={1.4 * ss}
              strokeDasharray={`${5 * ss} ${4 * ss}`}
            />
            {xR - x0 > 0.5 && <rect x={x0} y={r.barY + 3 * f} width={xR - x0} height={barH - 6 * f} rx={3.5} fill={VIZ.friction} opacity={0.9} />}
            {gap && (
              <g>
                {/* Tynne merker i stolpen der R og S er, så eleven ser at stripa går fra den ene til den andre */}
                <rect x={Math.min(xR, xs)} y={stripeY} width={Math.abs(xs - xR)} height={stripeH} rx={2} fill={VIZ.acceleration} />
                <line x1={xR} x2={xR} y1={r.barY + 3 * f} y2={stripeY + stripeH} stroke={VIZ.acceleration} strokeWidth={1.4 * ss} />
              </g>
            )}
          </g>
        );
      })}

      {/* Snordraget: samme strek gjennom begge stolpene, tynn og stiplet mellom dem, med et opphold der streken ellers
          ville krysset radetiketten («Lag A · 120 kg · gress») */}
      {state.S > 0 && (
        <g strokeLinecap="round">
          {[
            [barA - 4 * f, barA + barH + 4 * f],
            [barB - 4 * f, barB + barH + 4 * f],
          ].map(([ya, yb], i) => (
            <g key={i}>
              <line x1={xs} x2={xs} y1={ya} y2={yb} stroke={VIZ.surface} strokeWidth={6.5 * ss} opacity={0.85} />
              <line x1={xs} x2={xs} y1={ya} y2={yb} stroke={VIZ.tension} strokeWidth={3 * ss} />
            </g>
          ))}
          {(
            [
              [yS + 8 * f, barA - 4 * f, rows[0]!],
              [barA + barH + 4 * f, barB - 4 * f, rows[1]!],
            ] as const
          )
            .flatMap(([ya, yb, r]): [number, number][] =>
              xs < x0 + rowLabelW(r) + 8 * f
                ? [
                    [ya, r.labelY - 16 * f],
                    [r.labelY + 6 * f, yb],
                  ]
                : [[ya, yb]],
            )
            .filter(([ya, yb]) => yb - ya > 2)
            .map(([ya, yb], i) => (
              <line
                key={i}
                x1={xs}
                x2={xs}
                y1={ya}
                y2={yb}
                stroke={VIZ.tension}
                strokeWidth={1.4 * ss}
                strokeDasharray={`${2 * ss} ${3 * ss}`}
                opacity={0.6}
              />
            ))}
        </g>
      )}

      {/* Etikettene */}
      {rows.map((r) => {
        const xR = sx(r.R);
        const xMax = sx(r.Rmax);
        // «μsmg = …» til høyre for stolpen, men etter S-streken når den ellers ville krysset teksten.
        const maxW = maxLabelW(r.Rmax);
        const crosses = state.S > 0 && xs > xMax - 2 && xs < xMax + 14 + maxW;
        const maxX = crosses ? xs + 9 : xMax + 8;
        const gap = Math.abs(r.net) > 0.05 && Math.abs(xR - xs) > 1;
        return (
          <g key={r.side}>
            <Txt x={x0} y={r.labelY} anchor="start" size={0.9} weight={740}>
              Lag {r.side}
              <tspan fontWeight={520} fill={VIZ.muted}>
                {` · ${fmt(r.m, 0)} kg · ${FESTE_NAVN[r.feste].toLowerCase()}${r.sliding ? ' · glir' : ''}`}
              </tspan>
            </Txt>
            <Txt x={x1} y={r.labelY} anchor="end" size={0.86} weight={700} color={gap ? VIZ.acceleration : VIZ.ink}>
              ΣF = {gap ? `${fN(Math.abs(r.net))} N` : '0'}
            </Txt>
            <Txt
              x={maxX}
              y={r.barY + barH / 2 + 5.5 * f}
              anchor="start"
              size={0.78}
              color={VIZ.friction}
              weight={700}
            >
              μ<TSub>s</TSub>mg = {fN(r.Rmax)} N
            </Txt>
          </g>
        );
      })}
      {state.S > 0 && (
        <Txt x={sLabelX} y={yS} size={0.9} weight={760} color={VIZ.tension}>
          {sText}
        </Txt>
      )}
    </g>
  );
}
