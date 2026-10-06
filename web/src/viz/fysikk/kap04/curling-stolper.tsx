/**
 * Liggende, stablede søyler for «Curling: rett treff på en stein i ro»: bevegelsesmengde og kinetisk energi før og
 * etter støtet, delt opp på den røde og den gule steinen. Den kinetiske energien som blir til andre energiformer,
 * er skravert, så «etter»-søylen alltid er like lang som «før»-søylen.
 */
import type { ReactNode } from 'react';
import { TSub, Txt, VIZ, fmt, useTextScale } from '../../kit';
import { SCENE, alpha, useStrokeScale, useSvgId } from '../../kit/scene';
import { RED_STONE, YELLOW_STONE } from './curling-scene';
import type { CurlingHit } from './model-curling';

export interface BarsLayout {
  W: number;
  H: number;
}

/** Størrelsen på figuren: smalere på mobil, og høyere når teksten er stor. */
export function barsLayout(narrow: boolean, f: number): BarsLayout {
  const W = narrow ? 520 : 800;
  const block = 30 * f + 2 * (24 + 28 * f) + 8;
  return { W, H: Math.round(2 * block + 18 * f + 10) };
}

interface Seg {
  value: number;
  color: string;
  /** Skravert: energi som ikke lenger er kinetisk energi. */
  lost?: boolean;
  /** Tekst over segmentet (vises bare hvis den får plass). */
  text?: string;
}

/** Desimaler som passer størrelsen på tallene (to desimaler under 10, ellers én). */
export function decimalsFor(v: number): number {
  return Math.abs(v) < 10 ? 2 : 1;
}

export function CurlingBars({ hit, L }: { hit: CurlingHit; L: BarsLayout }) {
  const f = useTextScale();
  const ss = useStrokeScale();
  const hatch = useSvgId('curling-tapt');
  const { W } = L;
  const labelX = 10;
  const x0 = 10 + 62 * f;
  const totalChars = 18;
  const totalW = totalChars * 17 * f * 0.56;
  const xMax = W - 12 - totalW;
  const barH = 24;
  const rowH = barH + 28 * f;
  const charW = 17 * 0.78 * f * 0.58;

  const pd = decimalsFor(hit.p);
  const ed = decimalsFor(hit.Ek);
  const pTotal = (v: number) => `Σp = ${fmt(v, pd)} kg·m/s`;

  const row = (y: number, label: string, segs: Seg[], max: number, total: ReactNode, key: string) => {
    const k = max > 0 ? (xMax - x0) / max : 0;
    let x = x0;
    const parts = segs.map((sg) => {
      const w = Math.max(0, sg.value * k);
      const out = { ...sg, x, w };
      x += w;
      return out;
    });
    const shown = parts.filter((p) => p.w > 0.5);
    return (
      <g key={key}>
        <Txt x={labelX} y={y + barH / 2 + 6 * f} anchor="start" size={0.85} muted>
          {label}
        </Txt>
        {shown.map((p, i) =>
          p.lost ? (
            <g key={i}>
              <rect x={p.x} y={y} width={p.w} height={barH} fill={`url(#${hatch})`} />
              <rect x={p.x + 0.75} y={y + 0.75} width={Math.max(0, p.w - 1.5)} height={barH - 1.5} fill="none" stroke={VIZ.muted} strokeWidth={1.3 * ss} strokeDasharray="5 3" />
            </g>
          ) : (
            <rect key={i} x={p.x} y={y} width={p.w} height={barH} fill={p.color} stroke={SCENE.outline} strokeWidth={1 * ss} />
          ),
        )}
        {/* En tynn strek mellom segmentene, så grensen synes også når fargene ligner */}
        {shown.slice(1).map((p, i) => (
          <line key={`g${i}`} x1={p.x} x2={p.x} y1={y - 3} y2={y + barH + 3} stroke={VIZ.surface} strokeWidth={2 * ss} />
        ))}
        {shown.length > 1 &&
          shown.map((p, i) =>
            p.text && p.w > p.text.length * charW + 8 ? (
              <Txt key={`t${i}`} x={p.x + p.w / 2} y={y - 6} size={0.78} weight={620} color={p.lost ? VIZ.muted : undefined}>
                {p.text}
              </Txt>
            ) : null,
          )}
        <Txt x={xMax + 12} y={y + barH / 2 + 6 * f} anchor="start" size={0.85} weight={700}>
          {total}
        </Txt>
      </g>
    );
  };

  const titleH = 30 * f;
  const yP = titleH;
  const yE = yP + 2 * rowH + 8 + titleH + 6;
  const first = (y: number) => y + 18 * f;

  return (
    <g>
      <defs>
        <pattern id={hatch} width={8} height={8} patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <rect width={8} height={8} fill={alpha(VIZ.muted, 0.08)} />
          <line x1={0} y1={0} x2={0} y2={8} stroke={VIZ.muted} strokeWidth={2.2} opacity={0.6} />
        </pattern>
      </defs>
      <Txt x={labelX} y={yP - 8} anchor="start" size={0.95} weight={700}>
        Bevegelsesmengde p (kg·m/s)
      </Txt>
      {row(first(yP), 'Før', [{ value: hit.p, color: RED_STONE }], hit.p, pTotal(hit.p), 'pf')}
      {row(
        first(yP) + rowH,
        'Etter',
        [
          { value: hit.p1, color: RED_STONE, text: fmt(hit.p1, pd) },
          { value: hit.p2, color: YELLOW_STONE, text: fmt(hit.p2, pd) },
        ],
        hit.p,
        pTotal(hit.pAfter),
        'pe',
      )}

      <line x1={labelX} x2={W - 10} y1={yE - titleH - 2} y2={yE - titleH - 2} stroke={VIZ.grid} strokeWidth={1.5} />
      <Txt x={labelX} y={yE - 8} anchor="start" size={0.95} weight={700}>
        Kinetisk energi E<TSub>k</TSub> (J)
      </Txt>
      {row(
        first(yE),
        'Før',
        [{ value: hit.Ek, color: RED_STONE }],
        hit.Ek,
        <>
          ΣE<TSub>k</TSub> = {fmt(hit.Ek, ed)} J
        </>,
        'ef',
      )}
      {row(
        first(yE) + rowH,
        'Etter',
        [
          { value: hit.Ek1, color: RED_STONE, text: fmt(hit.Ek1, ed) },
          { value: hit.Ek2, color: YELLOW_STONE, text: fmt(hit.Ek2, ed) },
          { value: hit.lost, color: VIZ.muted, lost: true, text: `${fmt(hit.lost, ed)} omdannet` },
        ],
        hit.Ek,
        <>
          ΣE<TSub>k</TSub> = {fmt(hit.EkAfter, ed)} J
        </>,
        'ee',
      )}
    </g>
  );
}
