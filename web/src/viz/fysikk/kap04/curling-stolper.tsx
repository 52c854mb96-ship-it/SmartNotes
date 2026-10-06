/**
 * Liggende, stablede søyler for «Curling: rett treff på en stein i ro»: bevegelsesmengde og kinetisk energi før og
 * etter støtet, delt opp på den røde og den gule steinen. Den kinetiske energien som blir til andre energiformer,
 * er skravert, så «etter»-søylen alltid er like lang som «før»-søylen. Til høyre for tittelen står det om størrelsen
 * er bevart, og under «etter»-søylen står verdien for hver stein.
 */
import type { ReactNode } from 'react';
import { TSub, Txt, VIZ, fmt, useTextScale } from '../../kit';
import { SCENE, alpha, useStrokeScale, useSvgId } from '../../kit/scene';
import { spreadLabels, textWidthEm } from './curling-plassering';
import { RED_STONE, YELLOW_STONE } from './curling-scene';
import type { CurlingHit } from './model-curling';

/** Desimaler som passer størrelsen på tallene (to desimaler under 10, ellers én). */
export function decimalsFor(v: number): number {
  return Math.abs(v) < 10 ? 2 : 1;
}

/* Tekststørrelser (relative, 1 = vanlig etikett) */
const TITLE = 0.92;
const ROW = 0.85;
const PART = 0.8;

export interface BarsLayout {
  W: number;
  H: number;
  /** Høyden på én seksjon (tittel, to søyler og tallene under). */
  section: number;
  barH: number;
  /** Om «Bevart»/«Ikke bevart» står på en egen linje under tittelen (smal figur). */
  verdictBelow: boolean;
}

/** Størrelsen på figuren: smalere på mobil, og høyere når teksten er stor. */
export function barsLayout(narrow: boolean, f: number): BarsLayout {
  const W = narrow ? 520 : 800;
  const barH = Math.round(20 + 4 * f);
  const titleW = textWidthEm('Bevegelsesmengde p (kg·m/s)') * 17 * TITLE * f;
  const verdictW = textWidthEm('Ikke bevart') * 17 * TITLE * f;
  const verdictBelow = titleW + verdictW + 40 > W;
  const line = 17 * f;
  const section = line * TITLE + (verdictBelow ? line * 1.15 : 0) + 12 + barH + 12 + barH + 6 + line * PART + 8;
  return { W, H: Math.round(8 + 2 * section + 16 + 4), section, barH, verdictBelow };
}

interface Seg {
  value: number;
  color: string;
  /** Skravert: energi som ikke lenger er kinetisk energi. */
  lost?: boolean;
  /** Tallet under segmentet («2,0», «3,8 omdannet»). */
  text: string;
}

export function CurlingBars({ hit, L }: { hit: CurlingHit; L: BarsLayout }) {
  const f = useTextScale();
  const ss = useStrokeScale();
  const hatch = useSvgId('curling-tapt');
  const { W, barH } = L;
  const line = 17 * f;
  const labelX = 10;
  const x0 = labelX + textWidthEm('Etter') * 17 * ROW * f + 14;
  const numW = textWidthEm('85,5') * 17 * ROW * f;
  const xMax = W - 10 - numW - 12;

  const pd = decimalsFor(hit.p);
  const ed = decimalsFor(hit.Ek);
  const bevart = (lost: number, total: number) => Math.abs(lost) <= 1e-9 * Math.max(1, total);

  /** Én søyle. Gir også segmentene med plassering, så tallene kan stå under. */
  const bar = (y: number, label: string, segs: Seg[], max: number, total: string, key: string) => {
    const k = max > 0 ? (xMax - x0) / max : 0;
    let x = x0;
    const parts = segs.map((sg) => {
      const w = Math.max(0, sg.value * k);
      const out = { ...sg, x, w };
      x += w;
      return out;
    });
    const shown = parts.filter((p) => p.w > 0.5);
    const node = (
      <g key={key}>
        <Txt x={labelX} y={y + barH / 2 + line * ROW * 0.35} anchor="start" size={ROW} muted>
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
        <Txt x={xMax + 12} y={y + barH / 2 + line * ROW * 0.35} anchor="start" size={ROW} weight={700}>
          {total}
        </Txt>
      </g>
    );
    return { node, parts };
  };

  /** Tallene under «etter»-søylen: en prikk (eller skravert rute) og verdien, midt under segmentet når det er plass. */
  const partLabels = (y: number, parts: (Seg & { x: number; w: number })[], key: string) => {
    const fs = line * PART;
    const sw = 9 * f; // prikken eller ruta
    const items = parts.map((p) => ({ ...p, lw: sw + 5 * f + textWidthEm(p.text) * fs }));
    const lefts = spreadLabels(
      items.map((it) => ({ x: it.x + it.w / 2, w: it.lw })),
      x0,
      W - 8,
      12 * f,
    );
    const base = y + fs * 0.95;
    return (
      <g key={key}>
        {items.map((it, i) => {
          const l = lefts[i] ?? x0;
          const cy = base - fs * 0.33;
          return (
            <g key={i}>
              {it.lost ? (
                <rect x={l} y={cy - sw / 2} width={sw} height={sw} fill={`url(#${hatch})`} stroke={VIZ.muted} strokeWidth={1 * ss} />
              ) : (
                <circle cx={l + sw / 2} cy={cy} r={sw / 2} fill={it.color} stroke={SCENE.outline} strokeWidth={1 * ss} />
              )}
              <Txt x={l + sw + 5 * f} y={base} anchor="start" size={PART} weight={it.lost ? 560 : 640} muted={it.lost}>
                {it.text}
              </Txt>
            </g>
          );
        })}
      </g>
    );
  };

  /** Én seksjon: tittel med «Bevart»/«Ikke bevart», søyla før, søyla etter og tallene under. */
  const section = (top: number, title: ReactNode, ok: boolean, before: Seg[], afterSegs: Seg[], max: number, totals: [string, string], key: string) => {
    const yTitle = top + line * TITLE;
    const verdict = ok ? 'Bevart' : 'Ikke bevart';
    const yVerdict = L.verdictBelow ? yTitle + line * 1.15 : yTitle;
    const yBar1 = yVerdict + 12;
    const yBar2 = yBar1 + barH + 12;
    const b1 = bar(yBar1, 'Før', before, max, totals[0], `${key}f`);
    const b2 = bar(yBar2, 'Etter', afterSegs, max, totals[1], `${key}e`);
    return (
      <g key={key}>
        <Txt x={labelX} y={yTitle} anchor="start" size={TITLE} weight={700}>
          {title}
        </Txt>
        <Txt x={L.verdictBelow ? labelX : W - 10} y={yVerdict} anchor={L.verdictBelow ? 'start' : 'end'} size={TITLE} weight={700}>
          {verdict}
        </Txt>
        {b1.node}
        {b2.node}
        {partLabels(yBar2 + barH + 6, b2.parts.filter((p) => !p.lost || p.value > 1e-9 * max), `${key}t`)}
      </g>
    );
  };

  const top1 = 8;
  const top2 = top1 + L.section + 16;
  const lostPct = fmt(100 * hit.lossShare, 0);

  return (
    <g>
      <defs>
        <pattern id={hatch} width={8} height={8} patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <rect width={8} height={8} fill={alpha(VIZ.muted, 0.08)} />
          <line x1={0} y1={0} x2={0} y2={8} stroke={VIZ.muted} strokeWidth={2.2} opacity={0.6} />
        </pattern>
      </defs>
      {section(
        top1,
        'Bevegelsesmengde p (kg·m/s)',
        true,
        [{ value: hit.p, color: RED_STONE, text: fmt(hit.p, pd) }],
        [
          { value: hit.p1, color: RED_STONE, text: fmt(hit.p1, pd) },
          { value: hit.p2, color: YELLOW_STONE, text: fmt(hit.p2, pd) },
        ],
        hit.p,
        [fmt(hit.p, pd), fmt(hit.pAfter, pd)],
        'p',
      )}
      <line x1={labelX} x2={W - 10} y1={top2 - 9} y2={top2 - 9} stroke={VIZ.grid} strokeWidth={1.5} />
      {section(
        top2,
        <>
          Kinetisk energi E<TSub>k</TSub> (J)
        </>,
        bevart(hit.lost, hit.Ek),
        [{ value: hit.Ek, color: RED_STONE, text: fmt(hit.Ek, ed) }],
        [
          { value: hit.Ek1, color: RED_STONE, text: fmt(hit.Ek1, ed) },
          { value: hit.Ek2, color: YELLOW_STONE, text: fmt(hit.Ek2, ed) },
          { value: hit.lost, color: VIZ.muted, lost: true, text: `${fmt(hit.lost, ed)} omdannet (${lostPct} %)` },
        ],
        hit.Ek,
        [fmt(hit.Ek, ed), fmt(hit.EkAfter, ed)],
        'e',
      )}
    </g>
  );
}
