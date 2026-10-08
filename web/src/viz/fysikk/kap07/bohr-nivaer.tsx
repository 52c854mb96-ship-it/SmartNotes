/**
 * Energinivådiagrammet i «Bohrs atommodell»: nivåene i hydrogen i riktig skala, med en forstørrelse av nivåene nær
 * null (n ≥ 3 ligger så tett at de ellers ikke kan skilles). Den valgte overgangen er en tykk pil i seriefargen,
 * elektronet sitter på nivået det ender på (og et blekt spor på nivået det kom fra), og fotonet har riktig farge.
 */
import { useId } from 'react';
import { Txt, VIZ, fmt, useTextScale } from '../../kit';
import { Elektron, Foton, alpha, shade, useSceneScale, useStrokeScale } from '../../kit/scene';
import type { Mode } from './bohr-atom';
import { levelEnergyEV, sigDecimals, transitionPhoton } from './model';

/** Høyeste nivå i figuren. */
export const N_TOP = 6;

interface Panel {
  x: number;
  y: number;
  w: number;
  h: number;
  eMin: number;
  eMax: number;
  /** Nivålinjene går fra lineX0 til lineX1. */
  lineX0: number;
  lineX1: number;
}

function yOf(pn: Panel, E: number): number {
  return pn.y + pn.h - ((E - pn.eMin) / (pn.eMax - pn.eMin)) * pn.h;
}

/** Høyden på diagrammet (viewBox) for smal og bred figur. */
export function levelsHeight(narrow: boolean): number {
  return narrow ? 920 : 450;
}

/** Tykk pil for den valgte overgangen, med mørk kant så den synes i begge temaer. */
function TransitionArrow({ x, y1, y2, color }: { x: number; y1: number; y2: number; color: string }) {
  const ss = useStrokeScale();
  const hl = 14 * ss;
  const hw = 7.5 * ss;
  const dir = y2 > y1 ? 1 : -1;
  if (Math.abs(y2 - y1) < hl + 2) return null;
  const by = y2 - dir * hl;
  const edge = shade(color, 0.45);
  return (
    <g>
      <line x1={x} y1={y1} x2={x} y2={by} stroke={edge} strokeWidth={6.6 * ss} strokeLinecap="round" opacity={0.85} />
      <line x1={x} y1={y1} x2={x} y2={by} stroke={color} strokeWidth={4.2 * ss} strokeLinecap="round" />
      <path d={`M${x} ${y2}L${x - hw} ${by}L${x + hw} ${by}Z`} fill={color} stroke={edge} strokeWidth={1.2 * ss} strokeLinejoin="round" />
    </g>
  );
}

/** Tynn, stiplet pil for de andre overgangene i samme serie. */
function SeriesArrow({ x, y1, y2, color }: { x: number; y1: number; y2: number; color: string }) {
  const ss = useStrokeScale();
  const hl = 9 * ss;
  const hw = 4.8 * ss;
  const dir = y2 > y1 ? 1 : -1;
  if (Math.abs(y2 - y1) < hl + 2) return null;
  const by = y2 - dir * hl;
  return (
    <g opacity={0.75}>
      <line x1={x} y1={y1} x2={x} y2={by} stroke={color} strokeWidth={1.8 * ss} strokeDasharray={`${5 * ss} ${4 * ss}`} />
      <path d={`M${x} ${y2}L${x - hw} ${by}L${x + hw} ${by}Z`} fill={color} />
    </g>
  );
}

export function LevelDiagram({
  upper,
  lower,
  mode,
  narrow,
  height,
  color,
}: {
  upper: number;
  lower: number;
  mode: Mode;
  narrow: boolean;
  height: number;
  /** Fargen til serien (nederste nivå). */
  color: string;
}) {
  const f = useTextScale();
  const k = useSceneScale();
  const ss = useStrokeScale();
  const clipId = `bohr-clip-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const head = 34 * Math.min(f, 1.5);
  const re = 6 * k;

  const main: Panel = narrow
    ? { x: 0, y: 24, w: 800, h: 380, eMin: -14.2, eMax: 0.4, lineX0: 200, lineX1: 520 }
    : { x: 0, y: 24, w: 440, h: 396, eMin: -14.2, eMax: 0.4, lineX0: 116, lineX1: 300 };
  const zoom: Panel = narrow
    ? { x: 0, y: 480 + head, w: 800, h: height - 480 - head - 24, eMin: -1.68, eMax: 0.12, lineX0: 200, lineX1: 540 }
    : { x: 470, y: 24 + head, w: 330, h: height - 48 - head, eMin: -1.68, eMax: 0.12, lineX0: 512, lineX1: 680 };

  // Rammen rundt området som er forstørret
  const zTop = yOf(main, zoom.eMax);
  const zBot = yOf(main, zoom.eMin);

  // Overgangene i samme serie (samme nederste nivå) tegnes svakt ved siden av den valgte
  const seriesUppers: number[] = [];
  for (let n = lower + 1; n <= N_TOP; n++) seriesUppers.push(n);
  const nm = transitionPhoton(upper, lower).lambda * 1e9;

  const arrowX = (pn: Panel, n: number) => {
    const span = pn.lineX1 - pn.lineX0;
    const count = N_TOP - lower;
    return pn.lineX0 + span * 0.16 + (n - lower - 1) * Math.min(36, (span * 0.6) / Math.max(1, count - 1));
  };

  const transitions = (pn: Panel, clip: boolean) => (
    <g clipPath={clip ? `url(#${clipId})` : undefined}>
      {seriesUppers.map((n) => {
        const x = arrowX(pn, n);
        const [a, b] = mode === 'emisjon' ? [n, lower] : [lower, n];
        const y1 = yOf(pn, levelEnergyEV(a));
        const y2 = yOf(pn, levelEnergyEV(b));
        return n === upper ? <TransitionArrow key={n} x={x} y1={y1} y2={y2} color={color} /> : <SeriesArrow key={n} x={x} y1={y1} y2={y2} color={color} />;
      })}
    </g>
  );

  // Elektronet sitter på nivået det ender på, og et blekt spor står på nivået det kom fra. Hvert av dem tegnes i
  // panelet der nivået synes best: n ≤ 2 i hovedfiguren, n ≥ 3 i forstørrelsen.
  const [from, to] = mode === 'emisjon' ? [upper, lower] : [lower, upper];
  const electronOn = (n: number, ghost: boolean) => {
    const pn = n >= 3 ? zoom : main;
    const x = arrowX(pn, upper) - re - 12 * k;
    const y = yOf(pn, levelEnergyEV(n)) - re - 1.5 * ss;
    return <Elektron key={`${n}-${ghost}`} x={x} y={y} r={re} dim={ghost} />;
  };

  // Fotonet tegnes der overgangen synes best: i forstørrelsen når begge nivåene er med der. Det starter til høyre for
  // den siste pilen i serien, så bølgen ikke krysser de stiplede overgangene.
  const inZoom = lower >= 3;
  const pn = inZoom ? zoom : main;
  const ax = arrowX(pn, N_TOP);
  const eTop = inZoom ? levelEnergyEV(upper) : Math.min(levelEnergyEV(upper), zoom.eMin - 0.1);
  const yPh = (yOf(pn, levelEnergyEV(lower)) + yOf(pn, eTop)) / 2;
  const phEnd = inZoom ? pn.lineX1 - 4 : pn.lineX1 + (narrow ? 200 : 128);
  const [px0, px1] = [ax + 18, Math.max(ax + 70, phEnd)];

  const lineFor = (pnl: Panel, n: number) => {
    const on = n === upper || n === lower;
    const y = yOf(pnl, levelEnergyEV(n));
    return (
      <line
        key={n}
        x1={pnl.lineX0}
        x2={pnl.lineX1}
        y1={y}
        y2={y}
        stroke={on ? VIZ.ink : VIZ.muted}
        strokeWidth={(on ? 2.8 : 1.6) * ss}
        strokeLinecap="round"
        opacity={on ? 1 : 0.85}
      />
    );
  };
  const levelLabel = (pnl: Panel, n: number, text: string) => {
    const y = yOf(pnl, levelEnergyEV(n));
    const on = n === upper || n === lower;
    return (
      <Txt x={pnl.lineX0 - 12} y={y + 6 * f} anchor="end" weight={on ? 700 : 500} muted={!on} size={0.9}>
        {text}
      </Txt>
    );
  };

  return (
    <>
      <defs>
        <clipPath id={clipId}>
          <rect x={zoom.x} y={zoom.y - 8} width={zoom.w} height={zoom.h + 16} />
        </clipPath>
      </defs>

      {/* Energiakse */}
      <line x1={22} y1={main.y + main.h} x2={22} y2={main.y + 10} stroke={VIZ.muted} strokeWidth={1.5 * ss} />
      <path d={`M22 ${main.y}L${22 - 5 * ss} ${main.y + 11 * ss}L${22 + 5 * ss} ${main.y + 11 * ss}Z`} fill={VIZ.muted} />
      <Txt x={36} y={main.y + 14} anchor="start" muted size={0.9}>
        E
      </Txt>

      {/* Hovedfiguren i riktig skala */}
      {[1, 2, 3, 4, 5, 6].map((n) => lineFor(main, n))}
      <line x1={main.lineX0} x2={main.lineX1} y1={yOf(main, 0)} y2={yOf(main, 0)} className="viz-guide" />
      {[1, 2].map((n) => (
        <g key={n}>
          {levelLabel(main, n, `n = ${n}`)}
          <Txt x={main.lineX0 - 12} y={yOf(main, levelEnergyEV(n)) + 6 * f + 21 * f} anchor="end" muted size={0.85}>
            {fmt(levelEnergyEV(n), sigDecimals(levelEnergyEV(n)))} eV
          </Txt>
        </g>
      ))}
      {lower === 1 && (
        <Txt x={main.lineX1 + 10} y={yOf(main, levelEnergyEV(1)) + 6 * f} anchor="start" muted size={0.78}>
          grunntilstand
        </Txt>
      )}
      <rect
        x={main.lineX0 - 6}
        y={zTop}
        width={main.lineX1 - main.lineX0 + 12}
        height={zBot - zTop}
        fill={alpha(VIZ.grid, 0.18)}
        stroke={VIZ.muted}
        strokeDasharray={`${4 * ss} ${4 * ss}`}
        strokeWidth={1.2 * ss}
        rx={4}
      />
      <Txt x={main.lineX0 - 12} y={(zTop + zBot) / 2 + 6 * f} anchor="end" muted size={0.9}>
        n ≥ 3
      </Txt>
      {/* Strekene viser at rammen er forstørret i panelet til høyre */}
      {!narrow && (
        <g stroke={VIZ.muted} strokeWidth={1 * ss} opacity={0.55}>
          <line x1={main.lineX1 + 6} y1={zTop} x2={zoom.x + 4} y2={zoom.y - head} />
          <line x1={main.lineX1 + 6} y1={zBot} x2={zoom.x + 4} y2={zoom.y + zoom.h + 10} />
        </g>
      )}
      {transitions(main, false)}

      {/* Forstørrelse av nivåene nær null */}
      <rect
        x={zoom.x + 4}
        y={zoom.y - head}
        width={zoom.w - 8}
        height={zoom.h + head + 10}
        rx={12}
        fill={alpha(VIZ.grid, 0.18)}
        stroke={VIZ.grid}
        strokeWidth={1.5 * ss}
      />
      <Txt x={zoom.x + 18} y={zoom.y - head + 24 * Math.min(f, 1.5)} anchor="start" muted size={0.9}>
        Forstørret: n = 3 til ∞
      </Txt>
      {[7, 8, 9, 10, 12, 15].map((n) => (
        <line
          key={n}
          x1={zoom.lineX0}
          x2={zoom.lineX1}
          y1={yOf(zoom, levelEnergyEV(n))}
          y2={yOf(zoom, levelEnergyEV(n))}
          stroke={VIZ.grid}
          strokeWidth={1.5 * ss}
        />
      ))}
      {[3, 4, 5, 6].map((n) => (
        <g key={n}>
          {lineFor(zoom, n)}
          {levelLabel(zoom, n, narrow ? `n = ${n}` : String(n))}
          <Txt x={zoom.lineX1 + 8} y={yOf(zoom, levelEnergyEV(n)) + 6 * f} anchor="start" muted size={0.85}>
            {fmt(levelEnergyEV(n), sigDecimals(levelEnergyEV(n)))} eV
          </Txt>
        </g>
      ))}
      <line x1={zoom.lineX0} x2={zoom.lineX1} y1={yOf(zoom, 0)} y2={yOf(zoom, 0)} className="viz-guide" />
      <Txt x={zoom.lineX0 - 12} y={yOf(zoom, 0) + 6 * f} anchor="end" size={0.9}>
        {narrow ? 'n = ∞' : '∞'}
      </Txt>
      <Txt x={zoom.lineX1 + 8} y={yOf(zoom, 0) + 6 * f} anchor="start" muted size={0.85}>
        0 eV
      </Txt>
      {transitions(zoom, true)}

      {electronOn(from, true)}
      {electronOn(to, false)}

      {/* Fotonet: ut fra atomet ved emisjon, inn ved absorpsjon */}
      {mode === 'emisjon' ? (
        <Foton x1={px0} y1={yPh} x2={px1} y2={yPh} bolgelengde={nm} amplitude={7 * k} />
      ) : (
        <Foton x1={px1} y1={yPh} x2={px0} y2={yPh} bolgelengde={nm} amplitude={7 * k} />
      )}
    </>
  );
}
