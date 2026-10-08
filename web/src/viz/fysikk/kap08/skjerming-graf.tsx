/**
 * Grafen til «Skjerming»: hvor stor andel av α-, β- og γ-strålingen som slipper gjennom skjermen, som funksjon av
 * tykkelsen. Den valgte strålingen er tykk; de to andre er tynne, så de kan sammenlignes ved samme tykkelse.
 * For β og γ viser hjelpelinjer halveringstykkelsene, og for β den største rekkevidden.
 */
import { Fragment } from 'react';
import { Plot, Txt, VIZ, fmt, linePath, useTextScale } from '../../kit';
import { ValueTag } from '../../kit/scene';
import {
  ALPHA_STRAGGLING,
  RADIATIONS,
  RADIATION_IDS,
  alphaRangeLeft,
  halfThickness,
  maxThickness,
  stoppingThickness,
  transmission,
  type MaterialId,
  type RadiationId,
} from './model-skjerming';
import { RAD_COLOR } from './skjerming-scene';

/** Andel som prosent: «50 %», «3,1 %», «0,12 %», «0 %». */
export function fmtPct(T: number): string {
  if (!Number.isFinite(T)) return '–';
  const p = T * 100;
  if (p === 0) return '0 %';
  if (p < 0.01) return '< 0,01 %';
  if (p < 1) return `${fmt(p, 2)} %`;
  if (p < 10) return `${fmt(p, 1)} %`;
  return `${fmt(p, 0)} %`;
}

const MAT_GENITIVE: Record<MaterialId, string> = { papir: 'papiret', aluminium: 'aluminiumet', bly: 'blyet' };

/** Punktene på kurven fra 0 til xMax, med ekstra punkter der α stoppes (så det loddrette fallet blir skarpt). */
function curve(rad: RadiationId, mat: MaterialId, xMax: number): [number, number][] {
  const xs = new Set<number>();
  const n = 320;
  for (let i = 0; i <= n; i++) xs.add((xMax * i) / n);
  if (rad === 'alfa') {
    const R = alphaRangeLeft(mat);
    for (const k of [-1, -0.5, 0, 0.5, 1]) xs.add(Math.max(0, R * (1 + k * ALPHA_STRAGGLING * 1.2)));
  }
  return [...xs].sort((a, b) => a - b).map((x) => [x, 100 * transmission(rad, mat, x)]);
}

export function TransmissionPlot({ rad, mat, d, height }: { rad: RadiationId; mat: MaterialId; d: number; height: number }) {
  const f = useTextScale();
  const xMax = maxThickness(rad, mat);
  const T = transmission(rad, mat, d);
  const half = halfThickness(rad, mat);
  return (
    <Plot
      x={{ min: 0, max: xMax, label: `Tykkelse d på ${MAT_GENITIVE[mat]} (mm)`, decimals: xMax <= 5 ? 1 : 0, ticks: ticksFor(xMax) }}
      y={{ min: 0, max: 100, label: 'Slipper gjennom (%)', ticks: [0, 25, 50, 75, 100] }}
      width={800}
      height={height}
    >
      {({ sx, sy, y0, x1, y1 }) => {
        const px = sx(d);
        const py = sy(100 * T);
        // Hjelpelinjer for halveringstykkelsene til den valgte strålingen (når de ikke står for tett)
        const guides: number[] = [];
        if (half !== null && sx(half) - sx(0) >= 50 * f) for (let m = 1; m * half <= xMax + 1e-9 && m <= 3; m++) guides.push(m);
        const betaRange = rad === 'beta' ? stoppingThickness('beta', mat) : null;
        const tag = fmtPct(T);
        const tagW = tag.length * 17 * 0.85 * f * 0.6 + 16 * f;
        const tagH = 17 * 0.85 * f * 1.55;
        const right = px + 16 + tagW < x1;
        const above = py - 16 - tagH > y1;
        const ty = above ? py - 14 - tagH / 2 : Math.min(y0 - tagH / 2 - 4, py + 16 + tagH / 2);
        return (
          <g>
            {guides.map((m) => {
              const gx = sx(m * half!);
              const gy = sy(100 / 2 ** m);
              return (
                <g key={m}>
                  <polyline points={`${gx},${y0} ${gx},${gy} ${sx(0)},${gy}`} className="viz-guide" />
                  {y0 - gy > 30 * f && gx + 30 * f < x1 && (
                    <Txt x={gx + 5} y={y0 - 8} anchor="start" muted size={0.8}>
                      {m === 1 ? 'd½' : `${m}d½`}
                    </Txt>
                  )}
                </g>
              );
            })}
            {betaRange !== null && betaRange <= xMax && (
              <g>
                <line x1={sx(betaRange)} y1={y0} x2={sx(betaRange)} y2={sy(42)} stroke={RAD_COLOR.beta} strokeWidth={1.4} strokeDasharray="5 4" opacity={0.8} />
                <Txt x={sx(betaRange) + 6} y={sy(36)} anchor="start" size={0.8} color={RAD_COLOR.beta}>
                  {`rekkevidde ${fmt(betaRange, betaRange < 2 ? 1 : 0)} mm`}
                </Txt>
              </g>
            )}

            {/* De to andre strålingene, tynne */}
            {RADIATION_IDS.filter((r) => r !== rad).map((r) => (
              <path key={r} d={linePath(curve(r, mat, xMax), sx, sy)} fill="none" stroke={RAD_COLOR[r]} strokeWidth={2} opacity={0.5} strokeLinejoin="round" />
            ))}
            <path d={linePath(curve(rad, mat, xMax), sx, sy)} fill="none" stroke={RAD_COLOR[rad]} strokeWidth={3.6} strokeLinejoin="round" />

            {/* Navn på kurvene */}
            {RADIATION_IDS.map((r) => (
              <Fragment key={r}>
                <CurveLabel r={r} mat={mat} xMax={xMax} sx={sx} sy={sy} selected={r === rad} d={d} />
              </Fragment>
            ))}

            {/* Tykkelsen nå */}
            {d > 0 && <line x1={px} y1={y0} x2={px} y2={y1} stroke={VIZ.ink} strokeWidth={1.2} strokeDasharray="4 4" opacity={0.45} />}
            {RADIATION_IDS.filter((r) => r !== rad).map((r) => (
              <circle key={r} cx={px} cy={sy(100 * transmission(r, mat, d))} r={4.5} fill={VIZ.surface} stroke={RAD_COLOR[r]} strokeWidth={2} opacity={0.75} />
            ))}
            <circle cx={px} cy={py} r={7} fill={RAD_COLOR[rad]} stroke={VIZ.surface} strokeWidth={2.5} />
            <ValueTag x={right ? px + 14 : px - 14} y={ty} text={tag} color={RAD_COLOR[rad]} anchor={right ? 'start' : 'end'} size={0.85} />
          </g>
        );
      }}
    </Plot>
  );
}

/** Fine akseverdier: 0, 1, 2 … 5 mm, 0, 2 … 10 mm, 0, 10 … 50 mm. */
function ticksFor(xMax: number): number[] {
  const step = xMax <= 5 ? 1 : xMax <= 10 ? 2 : 10;
  const out: number[] = [];
  for (let v = 0; v <= xMax + 1e-9; v += step) out.push(Math.round(v * 100) / 100);
  return out;
}

/** Navnet på hver kurve der den er lett å se: α ved det loddrette fallet, β ved halvparten, γ ved høyre ende. */
function CurveLabel({
  r,
  mat,
  xMax,
  sx,
  sy,
  selected,
  d,
}: {
  r: RadiationId;
  mat: MaterialId;
  xMax: number;
  sx: (v: number) => number;
  sy: (v: number) => number;
  selected: boolean;
  /** Tykkelsen nå: γ-navnet flyttes bort fra skiltet med verdien når tykkelsen er nær høyre kant. */
  d: number;
}) {
  const f = useTextScale();
  const name = RADIATIONS[r].symbol;
  let x = 0;
  let y = 0;
  let anchor: 'start' | 'end' = 'start';
  if (r === 'alfa') {
    x = sx(Math.min(xMax, alphaRangeLeft(mat))) + 8;
    y = sy(22) + 6 * f;
  } else if (r === 'beta') {
    const h = halfThickness('beta', mat)!;
    x = sx(Math.min(h, xMax)) + 10;
    y = sy(100 * transmission('beta', mat, Math.min(h, xMax))) - 6;
  } else {
    const xe = d > 0.6 * xMax ? 0.45 * xMax : xMax;
    const Te = transmission('gamma', mat, xe);
    x = sx(xe) - 6;
    y = Te > 0.8 ? sy(100 * Te) + 22 * f : sy(100 * Te) - 10;
    anchor = 'end';
  }
  return (
    <Txt x={x} y={y} anchor={anchor} color={RAD_COLOR[r]} weight={selected ? 750 : 600} size={selected ? 1 : 0.9}>
      <tspan opacity={selected ? 1 : 0.85}>{name}</tspan>
    </Txt>
  );
}
