/**
 * Søylediagrammet til «Sentrale støt»: bevegelsesmengde og kinetisk energi før og etter støtet, for vogn 1, vogn 2
 * og summen. Søylene har samme farger som vognene i scenen, en stiplet linje viser summen før støtet, og gruppen
 * som passer med avspillingen («Før» eller «Etter») er uthevet.
 */
import type { ReactNode } from 'react';
import { Txt, VIZ, fmt, niceTicks, useTextScale } from '../../kit';
import { LinearGradient, alpha, shade, tint, useStrokeScale, useSvgId } from '../../kit/scene';

export interface StotBar {
  value: number;
  color: string;
  /** Kort navn under søylen: «1», «2» eller «Σ». */
  name: string;
  /** Summen: tallet vises alltid (de andre bare når det er plass). */
  sum?: boolean;
  /** Stiplet omriss opp til denne verdien (energien før støtet, så tapet synes). */
  ghost?: number;
}

export interface StotGroup {
  label: string;
  bars: StotBar[];
}

/** Antall desimaler etter størrelsen på tallene. */
export function barDecimals(values: number[]): number {
  const big = Math.max(...values.map(Math.abs));
  return big >= 10 ? 1 : big < 0.1 ? 3 : 2;
}

/**
 * Ett panel med to grupper søyler (før og etter) for én størrelse, tegnet fra x til x + width. `level` er summen før
 * støtet (stiplet linje fra summen før til summen etter), `active` gruppen som er uthevet (eller null).
 */
export function StotPanel({
  x,
  width,
  height,
  title,
  groups,
  decimals,
  level,
  active,
}: {
  x: number;
  width: number;
  height: number;
  title: ReactNode;
  groups: StotGroup[];
  decimals: number;
  level: number;
  active: number | null;
}) {
  const f = useTextScale();
  const ss = useStrokeScale();
  const id = useSvgId('stot-sooyle');
  const values = groups.flatMap((g) => g.bars.flatMap((b) => [b.value, b.ghost ?? 0]));
  const lo0 = Math.min(0, ...values);
  let hi0 = Math.max(0, ...values);
  if (hi0 - lo0 < 1e-9) hi0 = 1;
  const hasNeg = lo0 < -1e-9;
  const ticks = niceTicks(lo0, hi0, height > 340 ? 5 : 4);

  // Plass til tittel, tall over (og under) søylene, navnene under søylene og gruppenavnene.
  const tickFs = 17 * f * 0.72;
  const valueRoom = 22 * f;
  const plotTop = 30 * f + 12 + valueRoom;
  const groupLabelY = height - 8;
  const nameY = groupLabelY - 20 * f - 2;
  const plotBottom = nameY - 14 * f - 6 - (hasNeg ? valueRoom : 0);
  const scale = (plotBottom - plotTop) / (hi0 - lo0);
  const zeroY = plotTop + hi0 * scale;
  const sy = (v: number) => zeroY - v * scale;

  // Aksetall til venstre, søylene i resten av panelet
  const tickW = Math.max(...ticks.map((t) => fmt(t, tickDecimals(ticks)).length)) * tickFs * 0.6;
  const left = x + 10 + tickW + 8;
  const right = x + width - 8;
  const n = Math.max(...groups.map((g) => g.bars.length));
  const gap = 6;
  const groupGap = 38 + 6 * f;
  const avail = right - left - 16;
  const bw = Math.min(50, (avail - groupGap * (groups.length - 1) - gap * (n - 1) * groups.length) / (n * groups.length));
  const groupW = n * bw + (n - 1) * gap;
  const totalW = groups.length * groupW + (groups.length - 1) * groupGap;
  const x0 = left + (right - left - totalW) / 2;
  const gx = (gi: number) => x0 + gi * (groupW + groupGap);
  const bx = (gi: number, bi: number) => gx(gi) + bi * (bw + gap);

  // Tallene over hver søyle når det er plass (PC), ellers bare summen.
  const room = (text: string) => text.length * 17 * f * 0.72 * 0.58 < bw + gap - 2;
  const colors = [...new Set(groups.flatMap((g) => g.bars.map((b) => b.color)))];
  const gradId = (c: string) => `${id}-${colors.indexOf(c)}`;

  // Den stiplede linja: fra summen før til summen etter (siste søyle i hver gruppe).
  const sumIndex = (g: StotGroup) => g.bars.findIndex((b) => b.sum);
  const g0 = groups[0];
  const g1 = groups[groups.length - 1];
  const levelLine =
    g0 && g1 && sumIndex(g0) >= 0 && sumIndex(g1) >= 0
      ? { x1: bx(0, sumIndex(g0)) + bw / 2, x2: bx(groups.length - 1, sumIndex(g1)) + bw, y: sy(level) }
      : null;

  return (
    <g>
      {colors.map((c) => (
        <LinearGradient
          key={c}
          id={gradId(c)}
          x2={1}
          y2={0}
          stops={[
            [0, tint(c, 0.22)],
            [0.45, c],
            [1, shade(c, 0.16)],
          ]}
        />
      ))}
      <Txt x={x + 10} y={22 * f} anchor="start" weight={700}>
        {title}
      </Txt>

      {/* Uthevet gruppe (følger avspillingen) */}
      {active !== null && groups[active] && (
        <rect
          x={gx(active) - 12}
          y={plotTop - valueRoom - 4}
          width={groupW + 24}
          height={groupLabelY + 6 - (plotTop - valueRoom - 4)}
          rx={10}
          fill={alpha(VIZ.velocity, 0.09)}
          stroke={alpha(VIZ.velocity, 0.35)}
          strokeWidth={1 * ss}
        />
      )}

      {/* Rutenett og aksetall */}
      {ticks.map((t) => (
        <g key={t}>
          <line x1={left} y1={sy(t)} x2={right} y2={sy(t)} stroke={VIZ.grid} strokeWidth={1 * ss} />
          <Txt x={left - 8} y={sy(t) + tickFs * 0.35} anchor="end" size={0.72} muted halo={false}>
            {fmt(t, tickDecimals(ticks))}
          </Txt>
        </g>
      ))}
      <line x1={left} y1={zeroY} x2={right} y2={zeroY} stroke={VIZ.muted} strokeWidth={1.6 * ss} />

      {/* Summen før støtet */}
      {levelLine && (
        <line
          x1={levelLine.x1}
          y1={levelLine.y}
          x2={levelLine.x2}
          y2={levelLine.y}
          stroke={VIZ.ink}
          strokeWidth={1.4 * ss}
          strokeDasharray={`${5 * ss} ${4 * ss}`}
          opacity={0.55}
        />
      )}

      {groups.map((g, gi) => (
        <g key={g.label}>
          {g.bars.map((b, bi) => {
            const x1 = bx(gi, bi);
            const y = sy(b.value);
            const top = Math.min(y, zeroY);
            const h = Math.max(1.5, Math.abs(y - zeroY));
            const text = fmt(b.value, decimals);
            const showValue = (b.sum || (room(text) && f < 1.3)) && Math.abs(b.value) >= 0.5 * 10 ** -decimals;
            const neg = b.value < 0;
            const ghostTop = b.ghost !== undefined ? sy(b.ghost) : zeroY;
            const ghost = b.ghost !== undefined && Math.abs(b.ghost - b.value) > 1e-9;
            const lostH = ghost ? Math.abs(y - ghostTop) : 0;
            const vy = neg ? Math.max(zeroY, y) + 17 * f * (b.sum ? 1 : 0.72) + 2 : Math.min(zeroY, y, ghostTop) - 6;
            return (
              <g key={bi}>
                {ghost && (
                  <>
                    <rect
                      x={x1}
                      y={Math.min(ghostTop, zeroY)}
                      width={bw}
                      height={Math.abs(ghostTop - zeroY)}
                      rx={3}
                      fill={alpha(b.color, 0.06)}
                      stroke={b.color}
                      strokeWidth={1.5 * ss}
                      strokeDasharray={`${5 * ss} ${4 * ss}`}
                    />
                    {lostH > 20 * f && (
                      <Txt x={x1 + bw / 2} y={(y + ghostTop) / 2 + 5 * f} size={0.72} muted halo={false}>
                        tapt
                      </Txt>
                    )}
                  </>
                )}
                <rect x={x1} y={top} width={bw} height={h} rx={3} fill={`url(#${gradId(b.color)})`} />
                {showValue && (
                  <Txt
                    x={Math.min(Math.max(x1 + bw / 2, x + 30 * f), x + width - 30 * f)}
                    y={vy}
                    size={b.sum ? 1 : 0.72}
                    weight={b.sum ? 700 : 600}
                    color={b.sum ? undefined : b.color}
                  >
                    {text}
                  </Txt>
                )}
                <Txt x={x1 + bw / 2} y={nameY} size={0.72} muted weight={650} halo={false}>
                  {b.name}
                </Txt>
              </g>
            );
          })}
          <Txt x={gx(gi) + groupW / 2} y={groupLabelY} weight={active === gi ? 700 : 560} muted={active !== gi}>
            {g.label}
          </Txt>
        </g>
      ))}
    </g>
  );
}

function tickDecimals(ticks: number[]): number {
  const step = ticks.length > 1 ? Math.abs((ticks[1] ?? 0) - (ticks[0] ?? 0)) : 1;
  return step >= 1 ? 0 : step >= 0.1 ? 1 : step >= 0.01 ? 2 : 3;
}
