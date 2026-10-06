/**
 * Kraftregnskapet til tautrekkingen: for hvert lag en stolpe med friksjonen fra bakken nå (fylt) og den største
 * statiske friksjonen laget kan få, μs · mg (stiplet). Én loddrett strek viser snordraget S, som er det samme for
 * begge lagene. Så lenge fyllet når akkurat til streken, er R = S og kraftsummen null. Når et lag glir, blir det et
 * gap mellom R og S: det er kraftsummen på laget.
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
  const top = axisMax(Math.max(peak, plan.RmaxA, plan.RmaxB) * 1.06);
  const x0 = 24;
  const x1 = W - 24;
  const sx = (v: number) => x0 + (Math.max(0, Math.min(top, v)) / top) * (x1 - x0);
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
  const sText = `S = ${fN(state.S)} N`;
  const sW = sText.length * 17 * f * 0.9 * 0.58;
  const sLabelX = Math.min(x1 - sW / 2, Math.max(x0 + sW / 2, xs));

  return (
    <g>
      {/* Aksen */}
      {niceTicks(0, top, 5).map((v) => (
        <g key={v}>
          <line x1={sx(v)} x2={sx(v)} y1={barA - 6 * f} y2={axisY} stroke={VIZ.grid} strokeWidth={1} />
          <Txt x={sx(v)} y={tickY} size={0.82} muted halo={false}>
            {fmt(v, 0)}
          </Txt>
        </g>
      ))}
      <line x1={x0} x2={x1} y1={axisY} y2={axisY} stroke={VIZ.muted} strokeWidth={1.2 * ss} />
      <Txt x={(x0 + x1) / 2} y={titleY} size={0.86} muted weight={650} halo={false}>
        Kraft langs bakken (N)
      </Txt>

      {rows.map((r) => {
        const xR = sx(r.R);
        const xMax = sx(r.Rmax);
        const maxText = `μs·mg = ${fN(r.Rmax)} N`;
        const maxW = maxText.length * 17 * f * 0.78 * 0.58;
        const maxOutside = xMax + 8 + maxW < x1;
        const gap = Math.abs(r.net) > 0.05 && Math.abs(xR - xs) > 1;
        return (
          <g key={r.side}>
            <Txt x={x0} y={r.labelY} anchor="start" size={0.9} weight={740} halo={false}>
              Lag {r.side}
              <tspan fontWeight={520} fill={VIZ.muted}>
                {' '}
                · {fmt(r.m, 0)} kg · {FESTE_NAVN[r.feste].toLowerCase()}
                {r.sliding ? ' · glir' : ''}
              </tspan>
            </Txt>
            <Txt x={x1} y={r.labelY} anchor="end" size={0.86} weight={700} halo={false} color={gap ? VIZ.acceleration : VIZ.ink}>
              ΣF = {gap ? `${fN(Math.abs(r.net))} N` : '0'}
            </Txt>
            {/* Største statiske friksjon: stiplet ramme */}
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
            {/* Friksjonen nå: fylt */}
            {xR - x0 > 0.5 && <rect x={x0} y={r.barY + 3 * f} width={xR - x0} height={barH - 6 * f} rx={3.5} fill={VIZ.friction} opacity={0.9} />}
            {/* Kraftsummen: gapet mellom R og S */}
            {gap && (
              <rect
                x={Math.min(xR, xs)}
                y={r.barY + 3 * f}
                width={Math.abs(xs - xR)}
                height={barH - 6 * f}
                fill={alpha(VIZ.acceleration, 0.28)}
                stroke={VIZ.acceleration}
                strokeWidth={1 * ss}
              />
            )}
            <Txt
              x={maxOutside ? xMax + 8 : xMax - 8}
              y={r.barY + barH / 2 + 5.5 * f}
              anchor={maxOutside ? 'start' : 'end'}
              size={0.78}
              color={VIZ.friction}
              weight={700}
            >
              μ<TSub>s</TSub>mg = {fN(r.Rmax)} N
            </Txt>
          </g>
        );
      })}

      {/* Snordraget: samme strek gjennom begge stolpene */}
      {state.S > 0 && (
        <g>
          <line x1={xs} x2={xs} y1={yS + 8 * f} y2={barB + barH + 5 * f} stroke={VIZ.surface} strokeWidth={6 * ss} strokeLinecap="round" opacity={0.85} />
          <line x1={xs} x2={xs} y1={yS + 8 * f} y2={barB + barH + 5 * f} stroke={VIZ.tension} strokeWidth={3 * ss} strokeLinecap="round" />
          <Txt x={sLabelX} y={yS} size={0.9} weight={760} color={VIZ.tension}>
            {sText}
          </Txt>
        </g>
      )}
    </g>
  );
}
