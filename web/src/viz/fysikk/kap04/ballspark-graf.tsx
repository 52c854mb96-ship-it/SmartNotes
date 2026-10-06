/**
 * Grafene i visualiseringen «ballspark»: F-t-grafen for treffet (arealet er impulsen) og en sammenligning av
 * impuls, masse og fart for fotballen, tennisballen og golfballen (v = I/m).
 */
import { Plot, TSub, Txt, VIZ, fmt, linePath, sample, useTextScale } from '../../kit';
import { Ball, Dimension, type BallType } from '../../kit/scene';
import { SPORTS, SPORT_IDS, kick, pulseForce, pulseImpulse, typicalKick, type PulseShape, type SportId, type SportSpec } from './model-ballspark';

/** Kraft i enheten ballen viser (N eller kN). */
export const inUnit = (s: SportSpec, F: number) => (s.forceUnit === 'kN' ? F / 1000 : F);
/** Desimaler i kN for største kraft, som på glidebryteren. */
export function fDecimals(s: SportSpec): number {
  return s.forceUnit === 'kN' ? (s.F.step < 100 ? 2 : s.F.step < 1000 ? 1 : 0) : 0;
}
/** «0,95 kN», «700 N»; med `decimals` et fast antall desimaler (f.eks. som på glidebryteren). */
export function forceText(s: SportSpec, F: number, decimals?: number): string {
  const v = inUnit(s, F);
  return `${fmt(v, decimals ?? (s.forceUnit === 'kN' ? (v < 10 ? 2 : 1) : 0))} ${s.forceUnit}`;
}
/** «9,55 N·s», «2,23 N·s». */
export function impulseText(I: number): string {
  return `${fmt(I, I < 10 ? 2 : 1)} N·s`;
}
/** Tid i ms med passe mange desimaler for ballen. */
export function msText(s: SportSpec, tMs: number): string {
  return fmt(tMs, s.dtMs.def < 1 ? 2 : 1);
}

function pulsePoints(shape: PulseShape, Fmax: number, dtMs: number, to: number, unit: (F: number) => number): [number, number][] {
  const end = Math.max(0, Math.min(to, dtMs));
  if (shape === 'trekant') {
    const pts: [number, number][] = [[0, 0]];
    if (end <= dtMs / 2) pts.push([end, unit(pulseForce('trekant', Fmax, dtMs, end))]);
    else pts.push([dtMs / 2, unit(Fmax)], [end, unit(pulseForce('trekant', Fmax, dtMs, end))]);
    return pts;
  }
  return sample((t) => unit(pulseForce('bue', Fmax, dtMs, t)), 0, Math.max(end, 1e-9), 120);
}

export interface ForceGraphProps {
  sport: SportSpec;
  Fmax: number;
  dtMs: number;
  shape: PulseShape;
  /** Tiden (ms) som vises (strek og punkt), og om arealet så langt skal fremheves (avspilling). */
  tMs: number;
  playing: boolean;
  height: number;
}

/** F-t-grafen: pulsen, arealet (impulsen), gjennomsnittskraften og tidspunktet scenen viser. */
export function ForceGraph({ sport, Fmax, dtMs, shape, tMs, playing, height }: ForceGraphProps) {
  const f = useTextScale();
  const u = (F: number) => inUnit(sport, F) / 1; // kraftaksen i kN eller N
  // Pulsen regnes i ms og N; impulsen i N·s trenger sekunder.
  const res = kick(sport.m, Fmax, dtMs / 1000, shape);
  const full = pulsePoints(shape, Fmax, dtMs, dtMs, u);
  const tNow = Math.max(0, tMs);
  const done = pulsePoints(shape, Fmax, dtMs, tNow, u);
  const Inow = pulseImpulse(shape, Fmax, dtMs / 1000, tNow / 1000);
  const Fnow = pulseForce(shape, Fmax, dtMs, tNow);
  const yMax = inUnit(sport, sport.FAxis);
  const yTicks = sport.forceUnit === 'kN' ? (sport.FAxis > 10000 ? [0, 5, 10, 15, 20] : [0, 1, 2, 3, 4]) : [0, 400, 800, 1200, 1600];
  const dec = sport.dtMs.def < 1 ? 1 : 0;
  return (
    <Plot
      x={{ min: 0, max: sport.tAxisMs, label: 'Tid t (ms)', decimals: dec }}
      y={{ min: 0, max: yMax, label: `Kraft F (${sport.forceUnit})`, ticks: yTicks }}
      width={800}
      height={height}
    >
      {({ sx, sy, x1, y1 }) => {
        const base = sy(0);
        const area = (pts: [number, number][], end: number) =>
          pts.length > 1 ? `${linePath(pts, sx, sy)} L ${sx(end)} ${base} L ${sx(0)} ${base} Z` : '';
        const peakX = sx(dtMs / 2);
        const peakY = sy(u(Fmax));
        const favgY = sy(u(res.Favg));
        const right = sx(dtMs);
        // F_maks over toppen (til høyre for den, så den ikke dekker kurven), F_gj til høyre for rektangelet
        const labelRight = right + 10 + 150 * f < x1;
        const areaText = `arealet = I = ${impulseText(res.I)}`;
        const nowText = `arealet så langt = ${impulseText(Inow)}`;
        // F_maks-etiketten står til høyre for toppen, men til venstre for den (eller lenger ned) hvis den ville truffet
        // tekstene om arealet øverst til høyre. Bredden er anslått fra antall tegn (ca. 10 per tegn ved vanlig størrelse).
        const fmaxText = `Fmaks = ${forceText(sport, Fmax, fDecimals(sport))}`;
        const wF = fmaxText.length * 10.2 * f;
        const wA = Math.max(areaText.length, nowText.length) * 10.6 * f;
        const hitsArea = peakX + 10 + wF > x1 - 6 - wA && peakY - 10 - 17 * f < y1 + 54 * f;
        const peakLabel = !hitsArea
          ? { x: peakX + 10, y: peakY - 10, anchor: 'start' as const }
          : peakX - 10 - wF > sx(0) + 6
            ? { x: peakX - 10, y: peakY - 10, anchor: 'end' as const }
            : { x: peakX + 10, y: y1 + 54 * f + 24 * f, anchor: 'start' as const };
        return (
          <g>
            <path d={area(full, dtMs)} fill={VIZ.applied} opacity={playing ? 0.1 : 0.2} />
            {playing && tNow > 0 && <path d={area(done, Math.min(tNow, dtMs))} fill={VIZ.applied} opacity={0.32} />}
            <rect
              x={sx(0)}
              y={favgY}
              width={right - sx(0)}
              height={base - favgY}
              fill="none"
              stroke={VIZ.applied}
              strokeWidth={2}
              strokeDasharray="7 6"
            />
            <path d={linePath(full, sx, sy)} fill="none" stroke={VIZ.applied} strokeWidth={3.5} strokeLinejoin="round" />
            {/* Kontakttiden langs tidsaksen */}
            <Dimension x1={sx(0)} y1={base - 14 * f} x2={right} y2={base - 14 * f} label={`Δt = ${msText(sport, dtMs)} ms`} labelSize={0.8} color={VIZ.ink} />
            <Txt x={peakLabel.x} y={peakLabel.y} anchor={peakLabel.anchor} color={VIZ.applied} weight={700}>
              F<TSub>maks</TSub> = {forceText(sport, Fmax, fDecimals(sport))}
            </Txt>
            {labelRight ? (
              <Txt x={right + 8} y={favgY + 6} anchor="start" size={0.85} color={VIZ.applied} weight={650}>
                F<TSub>gj</TSub> = {forceText(sport, res.Favg)}
              </Txt>
            ) : null}
            {/* Tidspunktet scenen viser */}
            {(playing || tMs > 0) && (
              <>
                <line x1={sx(Math.min(tNow, sport.tAxisMs))} y1={base} x2={sx(Math.min(tNow, sport.tAxisMs))} y2={y1} stroke={VIZ.ink} strokeWidth={1.3} strokeDasharray="3 4" opacity={0.6} />
                <circle cx={sx(Math.min(tNow, sport.tAxisMs))} cy={sy(u(Fnow))} r={6.5} fill={VIZ.applied} stroke={VIZ.surface} strokeWidth={2.5} />
              </>
            )}
            <Txt x={x1 - 6} y={y1 + 22 * f} anchor="end" weight={650}>
              {playing && tNow < dtMs ? nowText : areaText}
            </Txt>
            <Txt x={x1 - 6} y={y1 + 48 * f} anchor="end" size={0.85} color={VIZ.velocity} weight={650}>
              v = I/m = {fmt(playing ? Inow / sport.m : res.v, 1)} m/s
            </Txt>
            {playing && tNow > dtMs && (
              <Txt x={x1 - 6} y={base - 40 * f} anchor="end" size={0.85} muted>
                {f > 1.3 ? 'F = 0 etter treffet' : 'F = 0: ballen har sluppet'}
              </Txt>
            )}
          </g>
        );
      }}
    </Plot>
  );
}

/* ---------- Sammenligning av de tre ballene ---------- */

const BALL: Record<SportId, BallType> = { fotball: 'fotball', tennis: 'tennis', golf: 'golf' };

interface Row {
  id: SportId;
  name: string;
  I: number;
  m: number;
  v: number;
  current: boolean;
}

interface Column {
  title: string;
  color: string;
  value: (r: Row) => number;
  text: (r: Row) => string;
}

const COLUMNS: Column[] = [
  { title: 'Impuls I', color: VIZ.applied, value: (r) => r.I, text: (r) => impulseText(r.I) },
  { title: 'Masse m', color: VIZ.muted, value: (r) => r.m, text: (r) => `${fmt(r.m * 1000, r.m < 0.1 ? 1 : 0)} g` },
  { title: 'Fart v = I/m', color: VIZ.velocity, value: (r) => r.v, text: (r) => `${fmt(r.v, 1)} m/s` },
];

/** Høyden på sammenligningen (figurens enheter), så viewBox-en kan settes før figuren tegnes. */
export function compareHeight(narrow: boolean): number {
  return narrow ? 3 * (64 + 3 * 62) + 20 : 52 + 3 * 54 + 14;
}

/**
 * Impuls, masse og fart for de tre ballene side om side: ballen eleven har valgt med sine verdier, de to andre med
 * typiske verdier. Søylene i hver kolonne har felles skala. På mobil står kolonnene under hverandre.
 */
export function Sammenligning({ sportId, Fmax, dtMs, shape, narrow }: { sportId: SportId; Fmax: number; dtMs: number; shape: PulseShape; narrow: boolean }) {
  const f = useTextScale();
  const rows: Row[] = SPORT_IDS.map((id) => {
    const s = SPORTS[id];
    const k = id === sportId ? kick(s.m, Fmax, dtMs / 1000, shape) : typicalKick(s, shape);
    return { id, name: s.label, I: k.I, m: s.m, v: k.v, current: id === sportId };
  });
  const groups = COLUMNS.map((c, i) => {
    const max = Math.max(...rows.map((r) => c.value(r)));
    const x = narrow ? 0 : 150 + i * 216;
    const y = narrow ? i * (64 + 3 * 62) : 0;
    return { c, max, x, y };
  });
  return (
    <g>
      {!narrow &&
        rows.map((r, j) => {
          const y = 52 + j * 54 + 27;
          return <RowLabel key={r.id} x={14} y={y} row={r} ballR={13} />;
        })}
      {groups.map(({ c, max, x, y }) => {
        const barX = narrow ? 230 : x;
        const barMax = narrow ? 380 : 120;
        return (
          <g key={c.title}>
            <Txt x={narrow ? 14 : x} y={y + 30 * Math.min(f, 1.2)} anchor="start" weight={700} size={0.9} color={c.color === VIZ.muted ? VIZ.ink : c.color}>
              {c.title}
            </Txt>
            {rows.map((r, j) => {
              const rowY = narrow ? y + 64 + j * 62 + 31 : 52 + j * 54 + 27;
              const w = Math.max(2, (c.value(r) / max) * barMax);
              return (
                <g key={r.id} opacity={r.current ? 1 : 0.62}>
                  {narrow && <RowLabel x={14} y={rowY} row={r} ballR={15} />}
                  <rect x={barX} y={rowY - 11} width={w} height={22} rx={4} fill={c.color} opacity={r.current ? 0.9 : 0.55} />
                  <Txt x={barX + w + 8} y={rowY + 6} anchor="start" size={0.85} weight={r.current ? 700 : 500}>
                    {c.text(r)}
                  </Txt>
                </g>
              );
            })}
          </g>
        );
      })}
    </g>
  );
}

function RowLabel({ x, y, row, ballR }: { x: number; y: number; row: Row; ballR: number }) {
  return (
    <g>
      <Ball x={x + ballR} y={y} r={ballR} type={BALL[row.id]} />
      <Txt x={x + 2 * ballR + 10} y={y + 6} anchor="start" size={0.9} weight={row.current ? 700 : 500} muted={!row.current}>
        {row.name}
      </Txt>
    </g>
  );
}
