/**
 * Søylediagrammet til «Eksplosjon og rekyl»: bevegelsesmengde og kinetisk energi før og etter, for legeme 1, legeme 2
 * og summen. Søylene har samme farger som gjenstandene i scenen (blå og oransje) og samme stil som de andre
 * søylediagrammene i kapittel 4. Gruppen som passer med avspillingen («Før» eller «Etter»), er uthevet.
 */
import type { ReactNode } from 'react';
import { Txt, VIZ, fmt, niceTicks, useTextScale } from '../../kit';
import { LinearGradient, alpha, shade, tint, useStrokeScale, useSvgId } from '../../kit/scene';

export interface EBar {
  value: number;
  color: string;
  /** Kort navn under søylen: «1», «2» eller «Σ». */
  name: string;
  /** Summen: tallet vises alltid (de andre bare når det er plass). */
  sum?: boolean;
}

export interface EGroup {
  label: string;
  bars: EBar[];
}

/** Antall desimaler etter størrelsen på tallene. */
export function barDecimals(values: number[]): number {
  const big = Math.max(...values.map(Math.abs));
  return big >= 100 ? 0 : big >= 10 ? 1 : big < 0.1 ? 3 : 2;
}

/**
 * Ett panel med to grupper søyler (før og etter) for én størrelse, fra x til x + width. `active` er gruppen som er
 * uthevet (eller null). Tallene står over søylene (under når de er negative); null vises ikke, bortsett fra summen.
 */
export function EksPanel({
  x,
  width,
  height,
  title,
  groups,
  decimals,
  active,
  maxBar = 50,
  note,
}: {
  x: number;
  width: number;
  height: number;
  title: ReactNode;
  groups: EGroup[];
  decimals: number;
  active: number | null;
  maxBar?: number;
  /** Liten tekst over nullinja i en gruppe der alle søylene er null (f.eks. «alt i ro»). */
  note?: { group: number; text: string };
}) {
  const f = useTextScale();
  const ss = useStrokeScale();
  const id = useSvgId('eks-sooyle');
  const values = groups.flatMap((g) => g.bars.map((b) => b.value));
  const lo0 = Math.min(0, ...values);
  let hi0 = Math.max(0, ...values);
  if (hi0 - lo0 < 1e-9) hi0 = 1;
  const hasNeg = lo0 < -1e-9;
  const ticks = niceTicks(lo0, hi0, height > 340 ? 5 : 4);
  const tickFs = 17 * f * 0.72;
  const td = tickDecimals(ticks);

  const tickW = Math.max(...ticks.map((t) => fmt(t, td).length)) * tickFs * 0.6;
  const left = x + 10 + tickW + 8;
  const right = x + width - 8;
  const n = Math.max(...groups.map((g) => g.bars.length));
  const gap = 6;
  const groupGap = 38 + 6 * f;
  const avail = right - left - 16;
  const bw = Math.min(maxBar, (avail - groupGap * (groups.length - 1) - gap * (n - 1) * groups.length) / (n * groups.length));
  const groupW = n * bw + (n - 1) * gap;
  const totalW = groups.length * groupW + (groups.length - 1) * groupGap;
  const x0 = left + (right - left - totalW) / 2;
  const gx = (gi: number) => x0 + gi * (groupW + groupGap);
  const bx = (gi: number, bi: number) => gx(gi) + bi * (bw + gap);

  const room = (text: string) => text.length * 17 * f * 0.72 * 0.58 < bw + gap - 2;
  const shows = (b: EBar) => b.sum || (room(fmt(b.value, decimals)) && Math.abs(b.value) >= 0.5 * 10 ** -decimals);

  const valueRoom = 22 * f;
  const negLabel = hasNeg && groups.some((g) => g.bars.some((b) => b.value < 0 && shows(b)));
  const plotTop = 30 * f + 12 + valueRoom;
  const groupLabelY = height - 8;
  const nameY = groupLabelY - 20 * f - 2;
  const plotBottom = nameY - 14 * f - 6 - (negLabel ? valueRoom : 0);
  const scale = (plotBottom - plotTop) / (hi0 - lo0);
  const zeroY = plotTop + hi0 * scale;
  const sy = (v: number) => zeroY - v * scale;
  const colors = [...new Set(groups.flatMap((g) => g.bars.map((b) => b.color)))];
  const gradId = (c: string) => `${id}-${colors.indexOf(c)}`;
  /** Avrundingsfeil (10⁻¹⁵) vises som null. */
  const clean = (v: number) => (Math.abs(v) < 0.5 * 10 ** -decimals ? 0 : v);

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

      {ticks.map((t) => (
        <g key={t}>
          <line x1={left} y1={sy(t)} x2={right} y2={sy(t)} stroke={VIZ.grid} strokeWidth={1 * ss} />
          <Txt x={left - 8} y={sy(t) + tickFs * 0.35} anchor="end" size={0.72} muted halo={false}>
            {fmt(t, td)}
          </Txt>
        </g>
      ))}
      <line x1={left} y1={zeroY} x2={right} y2={zeroY} stroke={VIZ.muted} strokeWidth={1.6 * ss} />

      {groups.map((g, gi) => (
        <g key={g.label}>
          {g.bars.map((b, bi) => {
            const x1 = bx(gi, bi);
            const v = clean(b.value);
            const y = sy(v);
            const top = Math.min(y, zeroY);
            const h = Math.max(1.5, Math.abs(y - zeroY));
            const neg = v < 0;
            const vy = neg ? Math.max(zeroY, y) + 17 * f * (b.sum ? 1 : 0.72) + 2 : Math.min(zeroY, y) - 6;
            return (
              <g key={bi}>
                <rect x={x1} y={top} width={bw} height={h} rx={3} fill={`url(#${gradId(b.color)})`} />
                {shows(b) && (
                  <Txt
                    x={Math.min(Math.max(x1 + bw / 2, x + 30 * f), x + width - 30 * f)}
                    y={vy}
                    size={b.sum ? 1 : 0.72}
                    weight={b.sum ? 700 : 600}
                    color={b.sum ? undefined : b.color}
                  >
                    {fmt(v, decimals)}
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
      {note && groups[note.group] && (
        <Txt x={gx(note.group) + groupW / 2} y={zeroY - 30 * f} size={0.72} muted>
          {note.text}
        </Txt>
      )}
    </g>
  );
}

function tickDecimals(ticks: number[]): number {
  const step = ticks.length > 1 ? Math.abs((ticks[1] ?? 0) - (ticks[0] ?? 0)) : 1;
  return step >= 1 ? 0 : step >= 0.1 ? 1 : step >= 0.01 ? 2 : 3;
}
