/**
 * Energiregnskapet i «Termofysikkens første lov»: liggende fossefallsdiagram med W, så Q fra enden av W, og
 * summen ΔU = W + Q fra null. Høyre for nullstreken er energi inn i gassen, venstre er energi ut.
 * Stiplet omriss viser hele prosessen mens avspillingen går.
 */
import { Txt, VIZ, fmt, useTextScale } from '../../kit';
import { LinearGradient, alpha, shade, tint, useStrokeScale, useSvgId } from '../../kit/scene';
import { diagramRange } from './forstelov-prosess';
import { COLOR_Q, COLOR_U, COLOR_W, signed } from './forstelov-scene';

/** Høyden på viewBox-en (bredden er 800): høyere på mobil, der teksten er større. */
export function diagramHeight(narrow: boolean): number {
  return narrow ? 470 : 268;
}

export function Energiregnskap({ W, Q, p, narrow }: { W: number; Q: number; p: number; narrow: boolean }) {
  const f = useTextScale();
  const ss = useStrokeScale();
  const id = useSvgId('energiregnskap');
  const H = diagramHeight(narrow);
  const M = diagramRange(W, Q);
  const dU = W + Q;

  const labelW = narrow ? 30 + 64 * f : 250;
  const x0 = labelW + 16;
  const x1 = 800 - 12 - 14 * f;
  const zero = (x0 + x1) / 2;
  const half = (x1 - x0) / 2;
  const sx = (v: number) => zero + (v / M) * half;

  const headY = 22 * f;
  const axisY = H - 30 * f;
  const rowTop = headY + 18 * f;
  const rowGap = (axisY - 10 - rowTop) / 3;
  const barH = Math.min(30, 0.46 * rowGap);
  const rows = [
    { key: 'W', from: 0, to: W, color: COLOR_W, symbol: 'W', name: 'arbeid på gassen' },
    { key: 'Q', from: W, to: dU, color: COLOR_Q, symbol: '+ Q', name: 'tilført varme' },
    { key: 'U', from: 0, to: dU, color: COLOR_U, symbol: '= ΔU', name: 'endring i indre energi' },
  ];
  const step = M <= 1000 ? 250 : 500;
  const ticks: number[] = [];
  for (let v = -M; v <= M + 1e-9; v += step) ticks.push(v);
  const fs = 17 * f * 0.9;

  return (
    <g>
      {rows.map((r) => (
        <LinearGradient key={r.key} id={`${id}${r.key}`} stops={[[0, tint(r.color, 0.18)], [0.55, r.color], [1, shade(r.color, 0.12)]]} />
      ))}
      {/* Rutenett og nullstrek */}
      <g aria-hidden>
        {ticks.map((v) => (
          <line key={v} x1={sx(v)} x2={sx(v)} y1={rowTop - 4} y2={axisY} stroke={VIZ.grid} strokeWidth={1 * ss} />
        ))}
        <rect x={zero} y={rowTop - 4} width={half} height={axisY - rowTop + 4} fill={alpha(COLOR_U, 0.035)} />
        <line x1={x0} x2={x1} y1={axisY} y2={axisY} stroke={VIZ.muted} strokeWidth={1.2 * ss} />
        <line x1={zero} x2={zero} y1={headY + 6 * f} y2={axisY + 5} stroke={VIZ.ink} strokeWidth={1.6 * ss} />
      </g>
      <Txt x={zero - 10} y={headY} anchor="end" size={0.8} muted>
        {narrow ? '← ut' : '← energi ut av gassen'}
      </Txt>
      <Txt x={zero + 10} y={headY} anchor="start" size={0.8} muted>
        {narrow ? 'inn →' : 'energi inn i gassen →'}
      </Txt>
      {ticks.map((v) => (
        <Txt key={v} x={sx(v)} y={axisY + 20 * f} size={0.75} muted>
          {fmt(v, 0)}
        </Txt>
      ))}
      <Txt x={x1} y={axisY - 6 * f} anchor="end" size={0.75} muted>
        J
      </Txt>

      {rows.map((r, i) => {
        const yc = rowTop + (i + 0.5) * rowGap;
        const y = yc - barH / 2;
        const a = sx(r.from * p);
        const b = sx(r.to * p);
        const ga = sx(r.from);
        const gb = sx(r.to);
        const value = (r.to - r.from) * p;
        const len = Math.abs(b - a);
        const right = r.to - r.from >= 0;
        // Verdien utenfor enden av søyla, eller inni den når søyla går nesten ut til kanten
        const room = right ? x1 - Math.max(a, b) : Math.min(a, b) - x0;
        const textW = (signed(value).length + 2) * fs * 0.6;
        const inside = room < textW + 10 && len > textW + 12;
        const tx = inside ? (right ? Math.max(a, b) - 8 : Math.min(a, b) + 8) : right ? Math.max(a, b) + 8 : Math.min(a, b) - 8;
        const anchor = inside ? (right ? 'end' : 'start') : right ? 'start' : 'end';
        const next = rows[i + 1];
        const nextY = rowTop + (i + 1.5) * rowGap - barH / 2;
        return (
          <g key={r.key}>
            <Txt x={narrow ? 16 : 20} y={yc + 6 * f - (narrow ? 0 : 0)} anchor="start" color={r.color} weight={720} size={1.05}>
              {r.symbol}
            </Txt>
            {!narrow && (
              <Txt x={84} y={yc + 6 * f} anchor="start" size={0.85} muted>
                {r.name}
              </Txt>
            )}
            {/* Hele prosessen (stiplet) og så langt (fylt) */}
            {Math.abs(gb - ga) > 1 && (
              <rect x={Math.min(ga, gb)} y={y} width={Math.abs(gb - ga)} height={barH} rx={4} fill="none" stroke={r.color} strokeWidth={1.4 * ss} strokeDasharray={`${5 * ss} ${4 * ss}`} />
            )}
            {len > 0.5 && (
              <g>
                <rect x={Math.min(a, b)} y={y} width={Math.max(1.5, len)} height={barH} rx={4} fill={`url(#${id}${r.key})`} stroke={shade(r.color, 0.25)} strokeWidth={0.8 * ss} />
                <line x1={Math.min(a, b) + 3} x2={Math.max(a, b) - 3} y1={y + 2.2 * ss} y2={y + 2.2 * ss} stroke="var(--sc-highlight)" strokeWidth={1.2 * ss} strokeLinecap="round" opacity={len > 8 ? 0.45 : 0} />
              </g>
            )}
            <Txt x={tx} y={yc + 6 * f} anchor={anchor} color={inside ? VIZ.surface : r.color} weight={720} size={0.9} halo={!inside}>
              {`${signed(value)} J`}
            </Txt>
            {/* Hjelpelinje fra enden av denne søyla til starten av den neste */}
            {next && (i === 0 ? Math.abs(W) > 0 : true) && (
              <line x1={b} x2={b} y1={y + barH} y2={nextY} stroke={VIZ.muted} strokeWidth={1.2 * ss} strokeDasharray={`${3 * ss} ${3 * ss}`} />
            )}
          </g>
        );
      })}
    </g>
  );
}
