/**
 * Egne deler til eksempeloppgaven «Akebrett ned bakken»: akeren på brettet (scene-kit-ets Akebrett og Person),
 * punktmerkene A, B og C, varmen langs sporet, mål og vinkelbue på snøen, lupen med G og N på flaten, målestokken
 * for kreftene og energipanelet («energiregnskapet»). Samme stil som scene-kit-et: VIZ-farger for fysikken,
 * SCENE-farger for gjenstandene, glorie rundt tekst som står på himmelen, og mørk snøfarge uten glorie på snøen.
 */
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { TSub, Txt, VIZ, fmt, useTextScale } from '../../kit';
import { Akebrett, ForceArrow, Himmel, Landskap, Person, SCENE, Underlag, alpha, mix, shade, useStrokeScale, useSvgId, type PaintName } from '../../kit/scene';
import {
  PERSON_HEIGHT,
  SLED_LENGTH,
  flatLupeMap,
  framePoint,
  ledgerHeight,
  scaleBarTextW,
  type Box,
  type Circle,
  type Frame,
  type LedgerKind,
  type LedgerRow,
} from './eks-akebakke-scene';
import { outerTangents } from './trappelop-scene';

/**
 * Tekst og mål som står rett på snøen: mørk blågrå i begge temaer (snøen er lys også i skumringen), uten den mørke
 * glorien fra temaet, så etikettene ikke ser utskårne ut i mørkt tema.
 */
export const SNOW_INK = shade(SCENE.snowShade, 0.6);

/**
 * Tekst på snøen (som <Txt>, samme størrelser): mørk snøfarge med en glorie i snøens egen farge. Glorien synes ikke
 * mot snøen, men skjuler streker som går bak teksten (nullnivået, sporet).
 */
export function SnowTxt({ x, y, children, anchor = 'middle', size = 1, weight = 650, color = SNOW_INK }: { x: number; y: number; children: ReactNode; anchor?: 'start' | 'middle' | 'end'; size?: number; weight?: number; color?: string }) {
  const style: CSSProperties & Record<'--kj-fs', number> = { fill: color, stroke: SCENE.snow, fontWeight: weight, '--kj-fs': size };
  return (
    <text x={x} y={y} textAnchor={anchor} className="kj-txt" style={style}>
      {children}
    </text>
  );
}

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

/**
 * Punkt på sporet: liten prikk og en bokstav (A, B, C) like ved. Med `onSnow` står bokstaven på snøen (mørk snøfarge
 * uten glorie), ellers på himmelen.
 */
export function PointMark({
  x,
  y,
  lx,
  ly,
  label,
  anchor = 'start',
  muted,
  onSnow,
}: {
  x: number;
  y: number;
  lx: number;
  ly: number;
  label: string;
  anchor?: 'start' | 'middle' | 'end';
  muted?: boolean;
  onSnow?: boolean;
}) {
  const ss = useStrokeScale();
  const ink = onSnow ? SNOW_INK : VIZ.ink;
  return (
    <g opacity={muted ? 0.55 : 1}>
      <circle cx={x} cy={y} r={3.6 * ss} fill={ink} stroke={onSnow ? SCENE.snow : VIZ.surface} strokeWidth={1.5 * ss} />
      {onSnow ? (
        <SnowTxt x={lx} y={ly} anchor={anchor} size={0.95} weight={760}>
          {label}
        </SnowTxt>
      ) : (
        <Txt x={lx} y={ly} anchor={anchor} size={0.95} weight={760}>
          {label}
        </Txt>
      )}
    </g>
  );
}

/**
 * Mållinje på snøen («h = 7,5 m», «s = 30 m»), som scene-kit-ets Dimension, men i mørk snøfarge uten glorie og uten
 * lys kant under streken (den ser dobbel ut på snø i mørkt tema). `offset` flytter linja vinkelrett ut fra punktene
 * (positiv = til venstre for retningen fra 1 til 2). `strong` = målet deloppgaven handler om.
 */
export function SnowDimension({
  x1,
  y1,
  x2,
  y2,
  label,
  offset = 0,
  labelOffset = 0,
  strong,
}: {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  label: ReactNode;
  offset?: number;
  labelOffset?: number;
  strong?: boolean;
}) {
  const ss = useStrokeScale();
  const f = useTextScale();
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy);
  if (!Number.isFinite(len) || len < 2) return null;
  const ux = dx / len;
  const uy = dy / len;
  const nx = uy;
  const ny = -ux;
  const ax = x1 + nx * offset;
  const ay = y1 + ny * offset;
  const bx = x2 + nx * offset;
  const by = y2 + ny * offset;
  const h = Math.min(9 * ss, len / 3);
  const head = (px: number, py: number, sx: number, sy: number) =>
    `${r2(px)},${r2(py)} ${r2(px + sx * h - sy * h * 0.42)},${r2(py + sy * h + sx * h * 0.42)} ${r2(px + sx * h + sy * h * 0.42)},${r2(py + sy * h - sx * h * 0.42)}`;
  const mx = (ax + bx) / 2 + ux * labelOffset;
  const my = (ay + by) / 2 + uy * labelOffset;
  const horizontal = Math.abs(uy) < 0.5;
  const side = offset === 0 ? 1 : Math.sign(offset);
  const out = (nx >= 0 ? 1 : -1) * side;
  const lx = horizontal ? mx : mx + out * 8 * f;
  const ly = horizontal ? my - 9 * f : my + 6 * f;
  const anchor = horizontal ? 'middle' : out > 0 ? 'start' : 'end';
  const color = SNOW_INK;
  return (
    <g opacity={strong ? 1 : 0.85}>
      {offset !== 0 && (
        <g stroke={color} strokeWidth={1 * ss} opacity={0.6}>
          <line x1={x1} y1={y1} x2={ax + nx * 5 * Math.sign(offset)} y2={ay + ny * 5 * Math.sign(offset)} strokeDasharray="3 3" />
          <line x1={x2} y1={y2} x2={bx + nx * 5 * Math.sign(offset)} y2={by + ny * 5 * Math.sign(offset)} strokeDasharray="3 3" />
        </g>
      )}
      <line x1={ax} y1={ay} x2={bx} y2={by} stroke={color} strokeWidth={(strong ? 1.8 : 1.4) * ss} />
      <polygon points={head(ax, ay, ux, uy)} fill={color} />
      <polygon points={head(bx, by, -ux, -uy)} fill={color} />
      <SnowTxt x={lx} y={ly} anchor={anchor} size={strong ? 0.95 : 0.85} weight={strong ? 760 : 650}>
        {label}
      </SnowTxt>
    </g>
  );
}

const r2 = (v: number) => Math.round(v * 100) / 100;

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
 * Vinkelbue for helningen α ved B, på snøen: en liten bue med radius `r` nær B mellom den vannrette linja gjennom B
 * (stiplet, `leg` lang inn i bakken mot venstre) og bakken (opp mot venstre). Bokstaven står inne i vinkelen, `rho`
 * fra B langs midtlinja (se `angleMark`).
 */
export function SlopeAngle({ x, y, alphaDeg, r, rho, leg }: { x: number; y: number; alphaDeg: number; r: number; rho: number; leg: number }) {
  const ss = useStrokeScale();
  const f = useTextScale();
  const a = (alphaDeg * Math.PI) / 180;
  const ex = x - r * Math.cos(a);
  const ey = y - r * Math.sin(a);
  const mid = a / 2;
  return (
    <g>
      <line x1={x} y1={y} x2={x - leg} y2={y} stroke={SNOW_INK} strokeWidth={1.3 * ss} strokeDasharray={`${6 * ss} ${4 * ss}`} opacity={0.85} />
      <path d={`M${r2(x - r)},${r2(y)} A${r2(r)},${r2(r)} 0 0 1 ${r2(ex)},${r2(ey)}`} fill="none" stroke={SNOW_INK} strokeWidth={1.8 * ss} />
      <SnowTxt x={x - rho * Math.cos(mid)} y={y - rho * Math.sin(mid) + 0.36 * 17 * 0.95 * f} size={0.95} weight={720}>
        α
      </SnowTxt>
    </g>
  );
}

/* ---------- Lupen på flaten ---------- */

/**
 * Lupen med akeren på flaten i d): tyngden G fra tyngdepunktet og normalkraften N fra snøen under brettet, like
 * lange (egen skala i lupen, se `flatLupeMap`), med ringen rundt akeren i scenen og to streker ut til lupen.
 */
export function FlatLupe({ lupe, ring, G, look, f }: { lupe: Circle; ring: Circle; G: number; look: RiderLook; f: number }) {
  const ss = useStrokeScale();
  const clip = useSvgId('ake-lupe');
  const m = flatLupeMap(lupe, G, f);
  const t = outerTangents(ring, lupe);
  const { x: cx, y: cy, r: R } = lupe;
  // Snøjordet bak akeren går opp til midt i lupen, så hodet står mot skogen og himmelen og pilene mot snøen.
  const horizon = cy - 0.42 * R;
  return (
    <g>
      <g aria-hidden>
        {t?.map(([a, b], i) => (
          <g key={i}>
            <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={VIZ.surface} strokeWidth={3.2 * ss} strokeLinecap="round" opacity={0.6} />
            <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={VIZ.ink} strokeWidth={1 * ss} strokeLinecap="round" opacity={0.5} />
          </g>
        ))}
        <circle cx={ring.x} cy={ring.y} r={ring.r} fill="none" stroke={VIZ.surface} strokeWidth={4 * ss} opacity={0.75} />
        <circle cx={ring.x} cy={ring.y} r={ring.r} fill="none" stroke={VIZ.ink} strokeWidth={1.4 * ss} opacity={0.75} />
      </g>
      <circle cx={cx + 2.5} cy={cy + 4} r={R + 3} fill={SCENE.shadow} opacity={0.22} />
      <defs>
        <clipPath id={clip}>
          <circle cx={cx} cy={cy} r={R} />
        </clipPath>
      </defs>
      <g clipPath={`url(#${clip})`}>
        <Himmel x={cx - R} y={cy - R} w={2 * R} h={2 * R} />
        <Landskap x={cx - R} y={horizon} w={2 * R} h={0.36 * R} type="skog" seed={4} />
        {/* Snøjordet fra skogkanten og ned under lupen; akeren sitter på det */}
        <Underlag x1={cx - R - 4} x2={cx + R + 4} y={cy + R + 2} depth={2} type="sno" horisont={horizon} seed={9} />
        <Aker fr={m.fr} rppm={m.Z} look={look} />
      </g>
      <circle cx={cx} cy={cy} r={R} fill="none" stroke={VIZ.surface} strokeWidth={6 * ss} />
      <circle cx={cx} cy={cy} r={R + 3 * ss} fill="none" stroke={alpha(VIZ.ink, 0.45)} strokeWidth={1.3 * ss} />
      <circle cx={cx} cy={cy} r={R - 3 * ss} fill="none" stroke={SCENE.outline} strokeWidth={0.8 * ss} opacity={0.6} />
      {/* G i tyngdepunktet og N fra snøen under brettet, side om side, så du ser at de er like lange */}
      <ForceArrow {...m.N} color={VIZ.normal} label="N" labelX={m.N.x2 + 10 * ss} labelY={m.N.y2 + 14 * f} labelAnchor="start" />
      <ForceArrow {...m.G} color={VIZ.gravity} label="G" labelX={m.G.x2 - 10 * ss} labelY={m.G.y2 - 2 * f} labelAnchor="end" origin />
    </g>
  );
}

/* ---------- Målestokken ---------- */

/**
 * Målestokken for kreftene oppe til venstre: «20 N» og en strek som er like lang som en kraft på 20 N i figuren.
 * (x, y) er der teksten begynner og midten av streken i høyden.
 */
export function ScaleBar({ x, y, force, k }: { x: number; y: number; force: number; k: number }) {
  const ss = useStrokeScale();
  const f = useTextScale();
  const x0 = x + scaleBarTextW(f) + 8 * f;
  const x1 = x0 + force * k;
  return (
    <g>
      <Txt x={x} y={y + 5 * f} anchor="start" size={0.78} weight={640}>
        {fmt(force, 0)} N
      </Txt>
      <line x1={x0} y1={y} x2={x1} y2={y} stroke={VIZ.surface} strokeWidth={5 * ss} opacity={0.8} strokeLinecap="round" />
      <line x1={x0} y1={y} x2={x1} y2={y} stroke={VIZ.ink} strokeWidth={2 * ss} />
      <line x1={x0} y1={y - 5 * ss} x2={x0} y2={y + 5 * ss} stroke={VIZ.ink} strokeWidth={1.5 * ss} />
      <line x1={x1} y1={y - 5 * ss} x2={x1} y2={y + 5 * ss} stroke={VIZ.ink} strokeWidth={1.5 * ss} />
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
            {/* Termisk energi har to lilla toner: den mørke fra bakken og den lyse fra flaten (rad C) */}
            {kind === 'heat' && <rect x={x} y={legendY - 10 * f} width={5 * f} height={10 * f} rx={1 * f} fill={COLORS.heatFlat} />}
            <Txt x={x + 14 * f} y={legendY} anchor="start" size={0.75} muted>
              {text}
            </Txt>
          </g>
        );
      })}
    </g>
  );
}
