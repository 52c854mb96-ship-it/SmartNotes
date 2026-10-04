/**
 * Laboratorieutstyr i SVG: begerglass, erlenmeyerkolbe og byrette med væske, og partikler (ioner, molekyler) i en
 * boks for partikkelbilder av løsninger. Alle partikkelplasseringer er deterministiske (fast frø).
 *
 *   <Begerglass x={80} y={60} w={200} h={240} level={0.6} liquid={btbColor(pH)}>
 *     {(box) => <Partikler box={box} groups={[{ n: 8, r: 9, fill: KJEMI.plus, label: '+' }, { n: 8, r: 11, fill: KJEMI.minus, label: '−' }]} />}
 *   </Begerglass>
 */
import { useId, useMemo, type ReactNode } from 'react';
import { VIZ, fmt } from '../../kit';
import { KJEMI } from './colors';
import { useAtomScale } from './molekyl';
import { jiggle, placeParticles, type Box, type PlacedParticle } from './random';
import { Txt } from './txt';

/** Gyldig id for clipPath (useId kan inneholde tegn som ikke passer i url(#…)). */
function useSvgId(prefix: string): string {
  return `${prefix}${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
}

type Inside = ReactNode | ((liquid: Box) => ReactNode);

export interface GlassProps {
  /** Øverste venstre hjørne av glasset. */
  x: number;
  y: number;
  w: number;
  h: number;
  /** Væskehøyde som andel av høyden (0–1). For erlenmeyerkolben: andel av den koniske delen. */
  level: number;
  /** Væskefarge (standard KJEMI.liquid, f.eks. btbColor(pH)). */
  liquid?: string;
  /** Innhold i væsken (klippes til væsken). Som funksjon får du boksen partiklene kan ligge i. */
  children?: Inside;
  /** Merker på glasset, f.eks. [{ level: 0.25, label: '50 mL' }, …]. */
  marks?: { level: number; label?: string }[];
  /** Etikett under glasset. */
  label?: ReactNode;
}

const clamp01 = (v: number) => (Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0);

/** Begerglass med tut, væske, menisk og eventuelle volummerker. */
export function Begerglass({ x, y, w, h, level, liquid = KJEMI.liquid, children, marks, label }: GlassProps) {
  const k = useAtomScale();
  const id = useSvgId('kj-beger');
  const r = Math.min(14, w * 0.08);
  const wall = 2;
  const surface = y + h - clamp01(level) * (h - 6);
  const outline = `M${x - 7},${y - 5} Q${x},${y - 1} ${x},${y + 10} L${x},${y + h - r} Q${x},${y + h} ${x + r},${y + h} L${x + w - r},${y + h} Q${x + w},${y + h} ${x + w},${y + h - r} L${x + w},${y + 4} Q${x + w},${y} ${x + w + 3},${y - 2}`;
  const inner = `M${x + wall},${y} L${x + wall},${y + h - r} Q${x + wall},${y + h - wall} ${x + r},${y + h - wall} L${x + w - r},${y + h - wall} Q${x + w - wall},${y + h - wall} ${x + w - wall},${y + h - r} L${x + w - wall},${y} Z`;
  const pad = 4 * k;
  const box: Box = { x: x + wall + pad, y: surface + pad, w: w - 2 * wall - 2 * pad, h: Math.max(0, y + h - wall - surface - 2 * pad) };
  return (
    <g>
      <clipPath id={id}>
        <path d={inner} />
      </clipPath>
      <path d={`${outline} Z`} fill={KJEMI.glassFill} stroke="none" />
      <g clipPath={`url(#${id})`}>
        {level > 0 && <rect x={x} y={surface} width={w} height={y + h - surface} fill={liquid} />}
        {level > 0 && <line x1={x} y1={surface} x2={x + w} y2={surface} stroke={KJEMI.liquidLine} strokeWidth={2} />}
        {typeof children === 'function' ? children(box) : children}
      </g>
      <rect x={x + w * 0.1} y={y + 12} width={Math.max(3, w * 0.035)} height={h * 0.62} rx={2} fill={KJEMI.glassShine} />
      {marks?.map((m) => {
        const my = y + h - clamp01(m.level) * (h - 6);
        return (
          <g key={m.level}>
            <line x1={x + w - 4} y1={my} x2={x + w - 4 - Math.min(26, w * 0.16)} y2={my} stroke={KJEMI.glass} strokeWidth={1.5} />
            {m.label && (
              <Txt x={x + w - 8 - Math.min(26, w * 0.16)} y={my + 5} anchor="end" size={0.7} muted>
                {m.label}
              </Txt>
            )}
          </g>
        );
      })}
      <path d={outline} fill="none" stroke={KJEMI.glass} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
      {label !== undefined && (
        <Txt x={x + w / 2} y={y + h + 24 * k} muted>
          {label}
        </Txt>
      )}
    </g>
  );
}

/** Halvbredden til erlenmeyerkolben i høyden yy. */
function flaskHalfWidth(yy: number, y: number, h: number, w: number, neckW: number, neckH: number): number {
  if (yy <= y + neckH) return neckW / 2;
  const t = (yy - (y + neckH)) / (h - neckH);
  return neckW / 2 + (w / 2 - neckW / 2) * Math.min(1, Math.max(0, t));
}

/** Erlenmeyerkolbe (titrerkolbe) med væske. `level` er andel av den koniske delen (0–1). */
export function Erlenmeyerkolbe({ x, y, w, h, level, liquid = KJEMI.liquid, children, marks, label }: GlassProps) {
  const k = useAtomScale();
  const id = useSvgId('kj-erlen');
  const cx = x + w / 2;
  const neckW = w * 0.3;
  const neckH = h * 0.3;
  const r = Math.min(12, w * 0.07);
  const body = h - neckH;
  const surface = y + h - clamp01(level) * body;
  const L = cx - neckW / 2;
  const R = cx + neckW / 2;
  const outline = `M${L - 4},${y} L${L},${y + 3} L${L},${y + neckH} L${x + r * 0.6},${y + h - r} Q${x},${y + h} ${x + r * 1.4},${y + h} L${x + w - r * 1.4},${y + h} Q${x + w},${y + h} ${x + w - r * 0.6},${y + h - r} L${R},${y + neckH} L${R},${y + 3} L${R + 4},${y}`;
  const hw = flaskHalfWidth(surface, y, h, w, neckW, neckH);
  const pad = 4 * k;
  const box: Box = { x: cx - hw + pad + 2, y: surface + pad, w: Math.max(0, 2 * hw - 2 * pad - 4), h: Math.max(0, y + h - surface - 2 * pad - 2) };
  return (
    <g>
      <clipPath id={id}>
        <path d={`${outline} Z`} />
      </clipPath>
      <path d={`${outline} Z`} fill={KJEMI.glassFill} stroke="none" />
      <g clipPath={`url(#${id})`}>
        {level > 0 && <rect x={x} y={surface} width={w} height={y + h - surface} fill={liquid} />}
        {level > 0 && <line x1={x} y1={surface} x2={x + w} y2={surface} stroke={KJEMI.liquidLine} strokeWidth={2} />}
        {typeof children === 'function' ? children(box) : children}
      </g>
      <path
        d={`M${L + neckW * 0.18},${y + 10} L${L + neckW * 0.18},${y + neckH} L${x + w * 0.2},${y + h * 0.82}`}
        fill="none"
        stroke={KJEMI.glassShine}
        strokeWidth={Math.max(3, w * 0.03)}
        strokeLinecap="round"
      />
      {marks?.map((m) => {
        const my = y + h - clamp01(m.level) * body;
        const mhw = flaskHalfWidth(my, y, h, w, neckW, neckH);
        return (
          <g key={m.level}>
            <line x1={cx + mhw - 6} y1={my} x2={cx + mhw - 6 - Math.min(22, mhw * 0.3)} y2={my} stroke={KJEMI.glass} strokeWidth={1.5} />
            {m.label && (
              <Txt x={cx + mhw + 8} y={my + 5} anchor="start" size={0.7} muted>
                {m.label}
              </Txt>
            )}
          </g>
        );
      })}
      <path d={outline} fill="none" stroke={KJEMI.glass} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
      {label !== undefined && (
        <Txt x={cx} y={y + h + 24 * k} muted>
          {label}
        </Txt>
      )}
    </g>
  );
}

export interface ByretteProps {
  /** Midten av røret. */
  x: number;
  /** Toppen av røret. */
  y: number;
  /** Lengden av det graderte røret (kranen og tuppen kommer under). */
  h: number;
  /** Rørbredde (standard 22 · skala). */
  w?: number;
  /** Volumet byretten rommer (mL), standard 50. */
  capacity?: number;
  /** Avlesning i mL: 0 er full byrette, `capacity` er tom ned til nederste merke. */
  reading: number;
  liquid?: string;
  /** Tall på skalaen hver `labelEvery` mL (standard 10). */
  labelEvery?: number;
  /** Vis avlesningen ved menisken, f.eks. «12,40 mL». */
  showReading?: boolean;
  /** Tegn en dråpe under tuppen (når kranen er åpen). */
  dripping?: boolean;
}

/** Høyden byretten tar under røret (kran og tupp), for å plassere en kolbe under. */
export function byretteTipLength(k = 1): number {
  return 52 * k;
}

/** Byrette med skala (0 øverst), menisk, kran og tupp. */
export function Byrette({ x, y, h, w, capacity = 50, reading, liquid = KJEMI.liquid, labelEvery = 10, showReading, dripping }: ByretteProps) {
  const k = useAtomScale();
  const W = w ?? 22 * k;
  const top = y + 14;
  const bottom = y + h - 20;
  const v = Math.min(capacity, Math.max(0, Number.isFinite(reading) ? reading : 0));
  const yv = top + ((bottom - top) * v) / capacity;
  const L = x - W / 2;
  const R = x + W / 2;
  const ticks: ReactNode[] = [];
  const perMl = (bottom - top) / capacity;
  const minorStep = perMl >= 3 ? 1 : perMl * 2 >= 3 ? 2 : 5;
  for (let ml = 0; ml <= capacity + 1e-9; ml += minorStep) {
    const ty = top + perMl * ml;
    const major = Math.abs(ml % labelEvery) < 1e-9;
    const mid = !major && Math.abs(ml % 5) < 1e-9;
    ticks.push(<line key={ml} x1={R} y1={ty} x2={R - (major ? W * 0.55 : mid ? W * 0.4 : W * 0.25)} y2={ty} stroke={KJEMI.glass} strokeWidth={major ? 1.6 : 1} />);
    if (major)
      ticks.push(
        <Txt key={`t${ml}`} x={L - 6} y={ty + 5} anchor="end" size={0.7} muted>
          {fmt(ml, 0)}
        </Txt>,
      );
  }
  const cock = y + h;
  const tipTop = cock + 18 * k;
  const tipEnd = tipTop + 30 * k;
  return (
    <g>
      <rect x={L} y={y} width={W} height={h} fill={KJEMI.glassFill} />
      {/* Væsken fra menisken og ned, gjennom kranen og tuppen */}
      <rect x={L + 2} y={yv} width={W - 4} height={cock - yv} fill={liquid} />
      <polygon points={`${x - 3 * k},${cock} ${x + 3 * k},${cock} ${x + 1.6 * k},${tipEnd} ${x - 1.6 * k},${tipEnd}`} fill={liquid} />
      <path d={`M${L + 2},${yv - 1} Q${x},${yv + 6} ${R - 2},${yv - 1}`} fill="none" stroke={KJEMI.liquidLine} strokeWidth={2} />
      {ticks}
      <rect x={L} y={y} width={W} height={h} fill="none" stroke={KJEMI.glass} strokeWidth={2.2} />
      {/* Kran */}
      <rect x={x - 7 * k} y={cock} width={14 * k} height={18 * k} rx={3} fill={VIZ.bodyStrong} stroke={KJEMI.glass} strokeWidth={1.5} />
      <rect x={x - 20 * k} y={cock + 6 * k} width={40 * k} height={6 * k} rx={3} fill={VIZ.body} stroke={KJEMI.glass} strokeWidth={1.5} />
      {/* Tupp */}
      <path d={`M${x - 4 * k},${tipTop} L${x - 1.8 * k},${tipEnd} M${x + 4 * k},${tipTop} L${x + 1.8 * k},${tipEnd}`} stroke={KJEMI.glass} strokeWidth={1.8} fill="none" />
      {dripping && <path d={`M${x},${tipEnd + 6 * k} q${4 * k},${7 * k} 0,${10 * k} q${-4 * k},${-3 * k} 0,${-10 * k} Z`} fill={liquid} stroke={KJEMI.liquidLine} strokeWidth={1} />}
      {showReading && (
        <g>
          <line x1={R + 4} y1={yv} x2={R + 16 * k} y2={yv} stroke={VIZ.ink} strokeWidth={1.5} />
          <Txt x={R + 20 * k} y={yv + 6} anchor="start" size={0.85}>
            {fmt(v, 2)} mL
          </Txt>
        </g>
      )}
    </g>
  );
}

export interface ParticleGroup {
  /** Antall partikler. */
  n: number;
  /** Radius i figurens enheter (ganges med useAtomScale). */
  r: number;
  fill?: string;
  /** Kantfarge (standard: ingen). */
  line?: string;
  /** Kort tekst midt i partikkelen, f.eks. «+», «−» eller «Na». */
  label?: string;
  /** Egen tegning i stedet for en sirkel, f.eks. <WaterMolecule>. */
  render?: (p: { x: number; y: number; r: number; index: number; angle: number }) => ReactNode;
}

/**
 * Mange små partikler spredt i en boks uten å overlappe (så langt det er plass), alltid likt for samme frø.
 * Med `t` (sekunder, fra useSimClock) beveger de seg litt, som varmebevegelse.
 */
export function Partikler({ box, groups, seed = 1, t, amplitude, gap = 3 }: { box: Box; groups: ParticleGroup[]; seed?: number; t?: number; amplitude?: number; gap?: number }) {
  const k = useAtomScale();
  const spec = groups.map((g) => ({ n: g.n, r: g.r * k }));
  const key = JSON.stringify([box, spec, seed, gap]);
  // Plasseringen regnes bare ut på nytt når boksen, gruppene eller frøet endres (ikke for hver ramme med t).
  const placed = useMemo<PlacedParticle[]>(() => placeParticles(box, spec, seed, gap), [key]);
  const amp = amplitude ?? 3 * k;
  return (
    <g>
      {placed.map((p) => {
        const g = groups[p.group]!;
        const pos = t === undefined ? p : jiggle(p, t, amp);
        const x = Math.min(box.x + box.w - p.r, Math.max(box.x + p.r, pos.x));
        const y = Math.min(box.y + box.h - p.r, Math.max(box.y + p.r, pos.y));
        if (g.render) return <g key={`${p.group}-${p.index}`}>{g.render({ x, y, r: p.r, index: p.index, angle: (p.phase * 180) / Math.PI })}</g>;
        return (
          <g key={`${p.group}-${p.index}`}>
            <circle cx={x} cy={y} r={p.r} fill={g.fill ?? KJEMI.molecule} stroke={g.line} strokeWidth={g.line ? 1.5 : undefined} />
            {g.label && (
              <text x={x} y={y + p.r * 0.38} textAnchor="middle" style={{ fill: VIZ.surface, fontSize: p.r * (g.label.length > 1 ? 0.95 : 1.3), fontWeight: 700 }}>
                {g.label}
              </text>
            )}
          </g>
        );
      })}
    </g>
  );
}
