/**
 * Egne deler til eksempeloppgaven «Akebrett ned bakken»: akeren på brettet (scene-kit-ets Akebrett og Person),
 * punktmerkene A, B og C, varmen langs sporet, vinkelbuen og energipanelet («energiregnskapet»). Samme stil som
 * scene-kit-et: VIZ-farger for fysikken, SCENE-farger for gjenstandene, glorie rundt tekst.
 */
import { useEffect, useRef, useState } from 'react';
import { TSub, Txt, VIZ, fmt } from '../../kit';
import { Akebrett, Person, SCENE, alpha, mix, useStrokeScale, type PaintName } from '../../kit/scene';
import { PERSON_HEIGHT, SLED_LENGTH, framePoint, ledgerHeight, type Box, type Frame, type LedgerKind, type LedgerRow } from './eks-akebakke-scene';

/* ---------- Skalaen før figuren tegnes ---------- */

/**
 * Tekstskalaen figuren vil få (samme regel som i <Figure>) og om figuren er smal (mobil), målt på beholderen, så
 * utsnittet og høyden på figuren kan velges før den tegnes. Legg `ref` på en <div> rundt figuren.
 */
export function useFigureScale<T extends HTMLElement = HTMLDivElement>(vbWidth = 800) {
  const ref = useRef<T>(null);
  const [f, setF] = useState(1);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const update = () => {
      // Figurens innerkant (viz.css: 8 px på PC, 4 px på mobil) og kantlinje
      const w = el.getBoundingClientRect().width - (window.innerWidth <= 600 ? 10 : 18);
      if (w <= 0) return;
      setF(Math.round(Math.max(1, 12.5 / 17 / (w / vbWidth)) * 20) / 20);
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [vbWidth]);
  return { ref, f, narrow: f > 1.25, k: Math.max(1, 0.85 * f) };
}

/* ---------- Akeren ---------- */

export interface RiderLook {
  brett: PaintName;
  jakke: PaintName;
  lue: PaintName;
}

/**
 * Person som sitter på et akebrett med beina fram, langs sporet i rammen `fr` (nesa mot høyre). `rppm` er
 * figurenheter per meter for akeren. Med `ghost` er hun nedtonet (der hun har vært).
 */
export function Aker({ fr, rppm, look, ghost }: { fr: Frame; rppm: number; look: RiderLook; ghost?: boolean }) {
  const size = SLED_LENGTH * rppm;
  const k = size / 80;
  const at = (lx: number, ly: number) => framePoint(fr, lx * k, ly * k);
  const seat = at(-10, 3.5);
  return (
    <g opacity={ghost ? 0.4 : 1}>
      <Akebrett x={fr.x} y={fr.y} size={size} rotate={fr.rotate} lakk={look.brett} />
      <Person
        x={seat.x}
        y={seat.y}
        size={PERSON_HEIGHT * rppm}
        rotate={fr.rotate}
        pose="sitte"
        jakke={look.jakke}
        lue={look.lue}
        bukse={SCENE.denim}
        fest={{ hoyreFot: at(38, 16), venstreFot: at(36, 17) }}
      />
    </g>
  );
}

/* ---------- Punktene og sporet ---------- */

/** Punkt på sporet: liten prikk og en bokstav (A, B, C) like ved. */
export function PointMark({ x, y, lx, ly, label, anchor = 'start', muted }: { x: number; y: number; lx: number; ly: number; label: string; anchor?: 'start' | 'middle' | 'end'; muted?: boolean }) {
  const ss = useStrokeScale();
  return (
    <g opacity={muted ? 0.55 : 1}>
      <circle cx={x} cy={y} r={3.6 * ss} fill={VIZ.ink} stroke={VIZ.surface} strokeWidth={1.5 * ss} />
      <Txt x={lx} y={ly} anchor={anchor} size={0.95} weight={760}>
        {label}
      </Txt>
    </g>
  );
}

/**
 * Termisk energi langs sporet: et mykt, lilla bånd i snøen der friksjonen har virket (samme farge som friksjonen og
 * termisk energi i energipanelet). `points` er overflaten i figurens enheter.
 */
export function HeatTrack({ points }: { points: [number, number][] }) {
  const ss = useStrokeScale();
  if (points.length < 2) return null;
  const d = points.map(([x, y], i) => `${i ? 'L' : 'M'}${Math.round(x * 10) / 10},${Math.round(y * 10) / 10}`).join('');
  return (
    <g aria-hidden transform={`translate(0 ${2.5 * ss})`}>
      <path d={d} fill="none" stroke={alpha(VIZ.friction, 0.14)} strokeWidth={9 * ss} strokeLinecap="round" strokeLinejoin="round" />
      <path d={d} fill="none" stroke={alpha(VIZ.friction, 0.42)} strokeWidth={3 * ss} strokeLinecap="round" strokeLinejoin="round" />
    </g>
  );
}

/**
 * Vinkelbue for helningen α ved B: mellom den vannrette linja gjennom B (stiplet, inn i bakken mot venstre) og
 * bakken (opp mot venstre). Bokstaven står inni vinkelen.
 */
export function SlopeAngle({ x, y, alphaDeg, r }: { x: number; y: number; alphaDeg: number; r: number }) {
  const ss = useStrokeScale();
  const a = (alphaDeg * Math.PI) / 180;
  const ex = x - r * Math.cos(a);
  const ey = y - r * Math.sin(a);
  const mid = a / 2;
  const lr = r * 0.72;
  return (
    <g>
      <line x1={x} y1={y} x2={x - r - 24 * ss} y2={y} stroke={VIZ.ink} strokeWidth={1.4 * ss} strokeDasharray={`${6 * ss} ${4 * ss}`} opacity={0.75} />
      <path d={`M${x - r},${y} A${r},${r} 0 0 1 ${ex},${ey}`} fill="none" stroke={VIZ.ink} strokeWidth={2 * ss} />
      <Txt x={x - lr * Math.cos(mid)} y={y - lr * Math.sin(mid) + 6 * ss} anchor="middle" size={0.95} weight={700}>
        α
      </Txt>
    </g>
  );
}

/* ---------- Energipanelet ---------- */

const COLORS: Record<LedgerKind, string> = {
  Ep: VIZ.gravity,
  Ek: VIZ.velocity,
  heat: VIZ.friction,
  // Termisk energi fra flaten: lysere i lyst tema og mørkere i mørkt, med blekkfarget tekst
  heatFlat: mix(VIZ.friction, VIZ.surface, 0.32),
  unknown: 'none',
};

/** Ord inni feltene når det er plass (ellers bare tallet). */
const WORDS: Partial<Record<LedgerKind, string>> = { heat: 'termisk', heatFlat: 'termisk' };

/** Omtrentlig bredde på tekst med relativ størrelse `size` og tekstskalaen f (figurenheter). */
function textW(text: string, size: number, f: number): number {
  return text.length * 17 * f * size * 0.57;
}

/**
 * Energipanelet: én rad per punkt (A, B, C) med energien som liggende, stablede stolper. Alle radene er like lange,
 * fordi energien er bevart; den skifter bare form fra potensiell og kinetisk energi til termisk energi. Radene som
 * ikke er regnet ut ennå, står tomme. `rows` er radene som er regnet ut, `EA` energien i A (hele lengden).
 */
export function EnergyLedger({ box, rows, EA, f, card = true }: { box: Box; rows: LedgerRow[]; EA: number; f: number; card?: boolean }) {
  const ss = useStrokeScale();
  const pad = 12 * f;
  const labelW = 98 * f;
  const rightW = 46 * f;
  const x0 = box.x + pad + labelW;
  const x1 = box.x + box.w - pad - rightW;
  const k = EA > 0 ? (x1 - x0) / EA : 0;
  const barH = 21 * f;
  const rowTop = (i: number) => box.y + 34 * f + i * 32 * f;
  const ids = ['A', 'B', 'C'] as const;
  const words: Record<(typeof ids)[number], string> = { A: 'toppen', B: 'nederst', C: 'stopp' };
  const legendY = rowTop(3) + 12 * f;
  const legend: { kind: LedgerKind; text: string }[] = [
    { kind: 'Ep', text: 'potensiell' },
    { kind: 'Ek', text: 'kinetisk' },
    { kind: 'heat', text: 'termisk' },
  ];
  let lx = box.x + pad;
  return (
    <g>
      {card && <rect x={box.x} y={box.y} width={box.w} height={ledgerHeight(f)} rx={10 * f} fill={VIZ.surface} opacity={0.94} stroke={VIZ.grid} strokeWidth={1 * ss} />}
      <Txt x={box.x + pad} y={box.y + 22 * f} anchor="start" size={0.85} weight={700}>
        Energi (J)
      </Txt>
      <Txt x={x1} y={box.y + 22 * f} anchor="end" size={0.78} muted>
        E<TSub>A</TSub> = {fmt(EA, 0)} J
      </Txt>
      {ids.map((id, i) => {
        const row = rows.find((r) => r.id === id);
        const y = rowTop(i);
        let x = x0;
        return (
          <g key={id}>
            <Txt x={box.x + pad} y={y + barH * 0.74} anchor="start" size={0.9} weight={760}>
              {id}
              <tspan dx={6 * f} style={{ fill: VIZ.muted, fontWeight: 500 }} fontSize="0.86em">
                {words[id]}
              </tspan>
            </Txt>
            {/* Tom plass for raden */}
            <rect x={x0} y={y} width={x1 - x0} height={barH} rx={3 * f} fill={alpha(VIZ.muted, 0.1)} stroke={alpha(VIZ.muted, 0.35)} strokeWidth={1 * ss} />
            {row?.segments.map((seg, j) => {
              const w = Math.max(0, seg.E * k);
              const sx = x;
              x += w;
              const value = fmt(seg.E, 0);
              const word = WORDS[seg.kind];
              const full = word ? `${word} ${value}` : value;
              const inner = textW(full, 0.78, f) + 10 * f < w ? full : textW(value, 0.78, f) + 10 * f < w ? value : null;
              if (seg.kind === 'unknown')
                return (
                  <g key={j}>
                    <rect x={sx + 1} y={y + 1} width={Math.max(0, w - 2)} height={barH - 2} rx={3 * f} fill="none" stroke={VIZ.friction} strokeWidth={1.6 * ss} strokeDasharray={`${5 * ss} ${4 * ss}`} />
                    <Txt x={sx + w / 2} y={y + barH * 0.74} size={0.85} weight={760} color={VIZ.friction}>
                      ?
                    </Txt>
                  </g>
                );
              return (
                <g key={j}>
                  <rect x={sx} y={y} width={w} height={barH} fill={COLORS[seg.kind]} stroke={VIZ.surface} strokeWidth={1.2 * ss} />
                  {inner ? (
                    <Txt x={sx + w / 2} y={y + barH * 0.72} size={0.78} weight={700} color={seg.kind === 'heatFlat' ? VIZ.ink : VIZ.surface} halo={false}>
                      {inner}
                    </Txt>
                  ) : (
                    // Feltet er for smalt (E_k i A): tallet står like til høyre for stolpen
                    <Txt x={x1 + 5 * f} y={y + barH * 0.72} anchor="start" size={0.74} weight={700} color={COLORS[seg.kind]}>
                      +{' '}
                      {value}
                    </Txt>
                  )}
                </g>
              );
            })}
          </g>
        );
      })}
      {/* Hele energien E_A: alle radene ender her */}
      <line x1={x1} x2={x1} y1={box.y + 28 * f} y2={rowTop(2) + barH + 4 * f} stroke={VIZ.ink} strokeWidth={1.3 * ss} strokeDasharray={`${4 * ss} ${3 * ss}`} opacity={0.7} />
      {legend.map(({ kind, text }) => {
        const x = lx;
        lx += 14 * f + textW(text, 0.75, f) + 16 * f;
        return (
          <g key={kind}>
            <rect x={x} y={legendY - 10 * f} width={10 * f} height={10 * f} rx={2 * f} fill={COLORS[kind]} />
            <Txt x={x + 14 * f} y={legendY} anchor="start" size={0.75} muted>
              {text}
            </Txt>
          </g>
        );
      })}
    </g>
  );
}
