/**
 * Utsnitt av periodesystemet i «Bygg et atom» (7A): hovedgruppene i periode 1–4 (gruppe 1, 2 og 13–18), med Z = 1–20
 * som kan velges og Ga–Kr som fullfører periode 4. Raden (perioden) er antall elektronskall, og det valgte grunnstoffet,
 * raden og kolonnen er fremhevet. Et rent diagram i samme stil som scenen.
 */
import type { KeyboardEvent } from 'react';
import { Txt, VIZ, useTextScale } from '../../kit';
import { SCENE, mix, useStrokeScale } from '../../kit/scene';
import { TABLE_CELLS, groupOfColumn } from './model-atomets-oppbygning';
import { PARTICLE } from './parts';

export interface TableLayout {
  H: number;
  x0: number;
  w: number;
  h: number;
  gap: number;
  /** Ekstra luft mellom gruppe 2 og 13 (der overgangsmetallene står i det fulle periodesystemet). */
  extra: number;
  headerY: number;
  top: number;
  rowGap: number;
  /** Navnet får plass i cellene (ikke på mobil). */
  names: boolean;
}

/** Plasseringen av tabellen med tekstskaleringen f (1 på PC, ca. 1,8 på mobil). */
export function tableLayout(f: number): TableLayout {
  const narrow = f > 1.3;
  const labelW = narrow ? 98 : 110;
  const gap = narrow ? 5 : 6;
  const extra = narrow ? 12 : 16;
  const right = 12;
  const w = Math.floor((800 - right - labelW - 7 * gap - extra) / 8);
  const x0 = 800 - right - (8 * w + 7 * gap + extra);
  const headerY = 6 + 15 * f;
  const top = headerY + 9;
  const h = narrow ? 86 : 62;
  const rowGap = 6;
  return { H: top + 4 * h + 3 * rowGap + 6, x0, w, h, gap, extra, headerY, top, rowGap, names: !narrow };
}

export function PeriodicExcerpt({ Z, onPick }: { Z: number; onPick: (Z: number) => void }) {
  const f = useTextScale();
  const ss = useStrokeScale();
  const L = tableLayout(f);
  const colX = (c: number) => L.x0 + c * (L.w + L.gap) + (c >= 2 ? L.extra : 0);
  const rowY = (p: number) => L.top + (p - 1) * (L.h + L.rowGap);
  const sel = TABLE_CELLS.find((c) => c.Z === Z);
  const right = colX(7) + L.w;
  const bottom = rowY(4) + L.h;
  const key = (z: number) => (e: KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onPick(z);
    }
  };
  return (
    <g>
      {/* Raden og kolonnen til det valgte grunnstoffet */}
      {sel && (
        <g aria-hidden>
          <rect x={L.x0 - 6} y={rowY(sel.period) - 4} width={right - L.x0 + 12} height={L.h + 8} rx={11} fill={VIZ.ink} fillOpacity={0.05} />
          <rect x={colX(sel.col) - 4} y={L.top - 5} width={L.w + 8} height={bottom - L.top + 10} rx={11} fill={VIZ.ink} fillOpacity={0.05} />
        </g>
      )}

      {/* Gruppenumrene over kolonnene */}
      <Txt x={L.x0 - 14} y={L.headerY} anchor="end" size={0.72} muted>
        Gruppe
      </Txt>
      {Array.from({ length: 8 }, (_, c) => (
        <Txt key={c} x={colX(c) + L.w / 2} y={L.headerY} size={0.78} weight={sel?.col === c ? 750 : 550} muted={sel?.col !== c}>
          {groupOfColumn(c)}
        </Txt>
      ))}

      {/* Periodene: antall skall */}
      {[1, 2, 3, 4].map((p) => {
        const mid = rowY(p) + L.h / 2;
        const on = sel?.period === p;
        return (
          <g key={p}>
            <Txt x={L.x0 - 14} y={L.names ? mid - 1 : mid + 6 * f} anchor="end" size={L.names ? 0.85 : 0.75} weight={on ? 750 : 600} muted={!on}>
              {p} skall
            </Txt>
            {L.names && (
              <Txt x={L.x0 - 14} y={mid + 15 * f} anchor="end" size={0.66} muted>
                periode {p}
              </Txt>
            )}
          </g>
        );
      })}

      {/* Cellene. Symbolet tegnes sist i hver celle, så «Na» ikke står rett foran et ord som begynner på N. */}
      {TABLE_CELLS.map((c) => {
        const x = colX(c.col);
        const y = rowY(c.period);
        const on = c.Z === Z;
        const fill = on ? mix(VIZ.surface, PARTICLE.proton, 0.16) : c.selectable ? mix(VIZ.surface, VIZ.grid, 0.3) : 'none';
        const symY = y + (L.names ? 40 : 66);
        return (
          <g
            key={c.Z}
            role={c.selectable ? 'button' : undefined}
            tabIndex={c.selectable ? 0 : undefined}
            aria-label={c.selectable ? `${c.name}, Z = ${c.Z}` : undefined}
            aria-pressed={c.selectable ? on : undefined}
            onClick={c.selectable ? () => onPick(c.Z) : undefined}
            onKeyDown={c.selectable ? key(c.Z) : undefined}
            style={c.selectable ? { cursor: 'pointer' } : undefined}
            opacity={c.selectable ? 1 : 0.5}
          >
            {on && <rect x={x + 1} y={y + 4} width={L.w} height={L.h} rx={8} fill={SCENE.shadow} opacity={0.45} aria-hidden />}
            <rect
              x={x}
              y={y}
              width={L.w}
              height={L.h}
              rx={8}
              fill={fill}
              stroke={on ? PARTICLE.proton : VIZ.grid}
              strokeWidth={(on ? 2.6 : 1.1) * ss}
              strokeDasharray={c.selectable ? undefined : '4 4'}
            />
            <Txt x={x + 6} y={y + 14 * f} anchor="start" size={L.names ? 0.64 : 0.58} weight={on ? 700 : 500} muted={!on}>
              {c.Z}
            </Txt>
            {L.names && (
              <Txt x={x + L.w / 2} y={y + L.h - 7} size={0.55} muted>
                {c.name}
              </Txt>
            )}
            <Txt x={x + L.w / 2} y={symY} size={1.3} weight={on ? 750 : 620} muted={!c.selectable}>
              {c.symbol}
            </Txt>
          </g>
        );
      })}
    </g>
  );
}
