/**
 * Grafen i «Stråling fra svarte legemer» (k6-svart-legeme): Plancks strålingskurve for temperaturen T, med det synlige
 * området som regnbue, UV og IR svakt farget, toppen λ_maks (Wiens lov) og eventuelt Sola til sammenligning.
 * Intensiteten er målt i forhold til toppen for Sola. Bølgelengdeaksen går til 3 000, 6 000 eller 12 000 nm, så hele
 * toppen alltid får plass, og ved lave temperaturer skrives tallene på y-aksen på standardform.
 */
import { useId, type ReactNode } from 'react';
import { Plot, VIZ, fmt, linePath, niceTicks, useTextScale } from '../../kit';
import { RadialGradient, alpha, bolgelengdeFarge, useStrokeScale, useSvgId } from '../../kit/scene';
import { VISIBLE, planck, wavelengthRgb, wienPeak } from './model';
import { T_SUN, glodRgb, niceCeil, spekterMaksNm, yTickLabels, type Andeler } from './model-svart-legeme';
import { Tag } from './marks';
import { rgbText } from './svart-legeme-deler';

export const CURVE = VIZ.ink;
export const SUN = VIZ.series[1];
/** Toppen på kurven for Sola, som alle intensitetene måles i forhold til. */
export const SUN_PEAK = planck(wienPeak(T_SUN), T_SUN);

const nm = (v: number) => v * 1e9;

/** Prosent med passe mange desimaler: «44 %», «8,2 %», «0,11 %», «< 0,01 %», «0 %». */
export function prosent(v: number): string {
  const p = v * 100;
  if (!(p > 0)) return '0 %';
  if (p < 0.01) return '< 0,01 %';
  if (p < 1) return `${fmt(p, 2)} %`;
  if (p < 10) return `${fmt(p, 1)} %`;
  return `${fmt(p, 0)} %`;
}

/** Plassen under grafen til stolpen som viser fordelingen på UV, synlig lys og IR. */
export const fordelingHoyde = (narrow: boolean) => (narrow ? 146 : 66);

export function SpekterGraf({
  T,
  showSun,
  height,
  extra,
  andel,
}: {
  T: number;
  showSun: boolean;
  /** Hele høyden på figuren (viewBox). */
  height: number;
  /** Plassen nederst til fordelingsstolpen (fordelingHoyde). */
  extra: number;
  andel: Andeler;
}) {
  const f = useTextScale();
  const ss = useStrokeScale();
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const glowId = useSvgId('sl-farge');
  const L = spekterMaksNm(T);
  const peak = wienPeak(T);
  const rel = (lambdaNm: number, temp: number) => planck(lambdaNm * 1e-9, temp) / SUN_PEAK;
  const yMax = niceCeil(1.12 * rel(nm(peak), T));
  const yTicks = niceTicks(0, yMax, f > 1.3 ? 4 : 5);
  const yLabels = yTickLabels(yTicks);
  const longest = Math.max(...yLabels.map((t) => t.length));
  // Tallene på aksene er 14 i figurens enheter på PC og minst 11 px på skjermen (viz.css): ca. 15 · f på mobil.
  const tickFont = Math.max(14, 14.96 * f);
  const left = Math.max(72 * f, longest * tickFont * 0.58 + 14 + 30 * f);
  const pts: [number, number][] = [];
  const sunPts: [number, number][] = [];
  const N = 600;
  for (let i = 0; i <= N; i++) {
    const l = 2 + (i * (L - 2)) / N;
    pts.push([l, rel(l, T)]);
    sunPts.push([l, rel(l, T_SUN)]);
  }
  const stops: ReactNode[] = [];
  for (let l = 380; l <= 750; l += 10) {
    const [r, g, b] = wavelengthRgb(l);
    stops.push(<stop key={l} offset={(l - 380) / 370} stopColor={`rgb(${r},${g},${b})`} />);
  }
  const xTicks = f > 1.3 ? [0, L / 3, (2 * L) / 3, L] : niceTicks(0, L, 6);
  const glod = rgbText(glodRgb(T));
  return (
    <Plot
      x={{ min: 0, max: L, label: 'Bølgelengde λ (nm)', ticks: xTicks }}
      y={{ min: 0, max: yMax, label: f > 1.3 ? 'Intensitet (Sola = 1)' : 'Intensitet (toppen for Sola = 1)', ticks: [] }}
      width={800}
      height={height - extra}
      margin={{ top: 46 * f, right: Math.max(24 * f, (fmt(L, 0).length * tickFont * 0.58) / 2 + 6), bottom: 56 * f, left }}
    >
      {({ sx, sy, x0, x1, y0, y1 }) => {
        const px = sx(nm(peak));
        const peakY = sy(rel(nm(peak), T));
        const labelX = Math.min(x1 - 90 * f, Math.max(x0 + 90 * f, px));
        const area = `${linePath(pts, sx, sy)}L${sx(L)},${y0}L${sx(2)},${y0}Z`;
        const xv0 = sx(nm(VISIBLE[0]));
        const xv1 = sx(nm(VISIBLE[1]));
        // Fargeprøven øverst til høyre
        const sw = { x: x1 - 44 * f, y: y1 + 42 * f, r: 24 * f };
        // Etikettene for UV, synlig og IR står der de verken treffer kurven, den stiplede linja for toppen eller
        // fargeprøven: først prøves øverst i grafen, så nederst (under kurven), på noen få steder langs aksen.
        const font = 17 * f;
        const fits = (cx: number, base: number, text: string) => {
          const half = (text.length * 0.56 * font) / 2 + 6;
          const top = base - 0.8 * font - 3;
          const bottom = base + 0.25 * font + 3;
          if (cx - half < x0 + 4 || cx + half > x1 - 4) return false;
          if (px > cx - half - 4 && px < cx + half + 4 && bottom > peakY) return false;
          const atTop = base < (y0 + y1) / 2;
          if (atTop && cx + half > sw.x - sw.r - 8 && top < sw.y + sw.r + 22 * f) return false;
          for (let k = 0; k <= 12; k++) {
            const xx = cx - half + (2 * half * k) / 12;
            const cy = sy(rel(((xx - x0) / (x1 - x0)) * L, T));
            if (atTop ? cy < bottom : cy > top) return false;
          }
          return true;
        };
        // Helst helt inne i sitt eget område (UV til venstre for regnbuen, IR til høyre), ellers der det er plass.
        const inRegion = (cx: number, text: string, region: [number, number]) => {
          const half = (text.length * 0.56 * font) / 2 + 6;
          return cx - half >= region[0] && cx + half <= region[1];
        };
        const RegionLabel = ({ xs, text, region, strict }: { xs: number[]; text: string; region: [number, number]; strict?: boolean }) => {
          const spots = [y1 + 22 * f, y0 - 12].flatMap((base) => xs.map((x) => ({ x: sx(x), base })));
          // `strict`: bare inne i området (ellers ingen etikett; stolpen under grafen viser UV likevel)
          const spot =
            spots.find((p) => inRegion(p.x, text, region) && fits(p.x, p.base, text)) ??
            (strict ? null : (spots.find((p) => fits(p.x, p.base, text)) ?? spots[0]!));
          if (!spot) return null;
          return (
            <Tag x={spot.x} y={spot.base} muted>
              {text}
            </Tag>
          );
        };
        const irXs = [0.6, 0.75, 0.45, 0.85].map((u) => u * L);
        const uvXs = [190, 150, 230, 120, 290].map((u) => (u * L) / 3000);
        const plotH = height - extra;
        return (
          <g>
            <defs>
              <linearGradient id={`${uid}-rainbow`} x1="0" x2="1" y1="0" y2="0">
                {stops}
              </linearGradient>
              <clipPath id={`${uid}-clip`}>
                <rect x={x0} y={y1} width={x1 - x0} height={y0 - y1} />
              </clipPath>
            </defs>
            {/* y-aksen: rutenett og tall (på standardform når tallene er små) */}
            {yTicks.map((v, i) => (
              <g key={`y${i}`}>
                <line x1={x0} x2={x1} y1={sy(v)} y2={sy(v)} className="viz-gridline" />
                <text x={x0 - 10} y={sy(v) + 5 * f} textAnchor="end" className="viz-tick">
                  {yLabels[i]}
                </text>
              </g>
            ))}
            {/* UV og IR svakt farget, det synlige området som regnbue */}
            <rect x={x0} y={y1} width={Math.max(0, xv0 - x0)} height={y0 - y1} fill={alpha(bolgelengdeFarge(380, false), 0.1)} />
            <rect x={xv1} y={y1} width={Math.max(0, x1 - xv1)} height={y0 - y1} fill={alpha(bolgelengdeFarge(900, false), 0.07)} />
            <rect x={xv0} y={y1} width={xv1 - xv0} height={y0 - y1} fill={`url(#${uid}-rainbow)`} opacity={0.45} />
            <RegionLabel xs={uvXs} text="UV" region={[x0, xv0]} strict />
            <RegionLabel xs={irXs} text={f > 1.3 ? 'IR' : 'infrarødt (IR)'} region={[xv1, x1]} />

            <path d={area} fill={CURVE} opacity={0.08} clipPath={`url(#${uid}-clip)`} />
            {showSun && (
              <path
                d={linePath(sunPts, sx, sy)}
                fill="none"
                stroke={SUN}
                strokeWidth={2.5 * ss}
                strokeDasharray="7 6"
                clipPath={`url(#${uid}-clip)`}
              />
            )}
            <path d={linePath(pts, sx, sy)} fill="none" stroke={CURVE} strokeWidth={3.5 * ss} strokeLinejoin="round" clipPath={`url(#${uid}-clip)`} />

            {/* Wiens lov: toppen */}
            <line x1={px} x2={px} y1={y0} y2={peakY} className="viz-guide" />
            <circle cx={px} cy={peakY} r={5.5 * ss} fill={CURVE} stroke={VIZ.surface} strokeWidth={2 * ss} />
            <Tag x={labelX} y={y1 - 14}>
              λ
              <tspan dy="0.32em" fontSize="0.72em">
                maks
              </tspan>
              <tspan dy="-0.32em"> = {fmt(nm(peak), 0)} nm</tspan>
            </Tag>

            {/* Fargen legemet gløder med (samme som i scenen og på linjalen) */}
            <RadialGradient id={glowId} stops={[[0, glod, 0.55], [0.5, glod, 0.18], [1, glod, 0]]} />
            <circle cx={sw.x} cy={sw.y} r={sw.r * 1.7} fill={`url(#${glowId})`} />
            <circle cx={sw.x} cy={sw.y} r={sw.r} fill={glod} stroke={VIZ.muted} strokeWidth={1.5 * ss} />
            <Tag x={sw.x} y={sw.y + sw.r + 22 * f} muted>
              fargen
            </Tag>

            <Fordeling x0={x0} x1={x1} y={plotH} andel={andel} rainbow={`url(#${uid}-rainbow)`} />
          </g>
        );
      }}
    </Plot>
  );
}

/**
 * Stolpe under grafen: hele arealet under kurven (all strålingen) delt i UV, synlig lys og IR, like bred som grafen.
 * Tallene står i en fast rad under (UV til venstre, synlig i midten, IR til høyre), så de aldri overlapper.
 */
function Fordeling({ x0, x1, y, andel, rainbow }: { x0: number; x1: number; y: number; andel: Andeler; rainbow: string }) {
  const f = useTextScale();
  const ss = useStrokeScale();
  const clip = useSvgId('sl-fordeling');
  const uvC = bolgelengdeFarge(380, false);
  const irC = bolgelengdeFarge(900, false);
  const titleBase = y + 15 * f;
  const top = titleBase + 7;
  const h = 10 + 4 * f;
  const base = top + h + 6 + 13.5 * f;
  const W = x1 - x0;
  const xu = x0 + W * andel.uv;
  const xv = xu + W * andel.synlig;
  const sq = 11 * f;
  const fs = 17 * f * 0.8;
  const gap = 18 * f;
  const textW = (t: string) => t.length * fs * 0.6;
  const uvT = `UV: ${prosent(andel.uv)}`;
  const synT = `${f > 1.3 ? 'synlig' : 'synlig lys'}: ${prosent(andel.synlig)}`;
  const irT = `${f > 1.3 ? 'IR' : 'infrarødt (IR)'}: ${prosent(andel.ir)}`;
  // UV til venstre og IR til høyre; synlig midt mellom dem, eller på en egen rad under når det ikke er plass.
  const uvEnd = x0 + sq + 6 + textW(uvT);
  const irStart = x1 - textW(irT) - sq - 6;
  const synW = sq + 6 + textW(synT);
  const oneRow = irStart - uvEnd >= synW + 2 * gap;
  const synX = oneRow ? (uvEnd + irStart) / 2 : (x0 + x1) / 2;
  const synBase = oneRow ? base : base + fs * 1.45;
  const items: { c: string; text: string; left: number; y: number; key: string }[] = [
    { key: 'uv', c: uvC, text: uvT, left: x0 + sq + 6, y: base },
    { key: 'syn', c: rainbow, text: synT, left: synX - synW / 2 + sq + 6, y: synBase },
    { key: 'ir', c: irC, text: irT, left: x1 - textW(irT), y: base },
  ];
  return (
    <g>
      <text x={x0} y={titleBase} className="kj-txt is-muted" style={{ ['--kj-fs' as string]: 0.78 }}>
        Hele strålingen (arealet under kurven):
      </text>
      <defs>
        <clipPath id={clip}>
          <rect x={x0} y={top} width={W} height={h} rx={h / 2} />
        </clipPath>
      </defs>
      <g clipPath={`url(#${clip})`}>
        <rect x={x0} y={top} width={Math.max(0, xu - x0)} height={h} fill={uvC} />
        <rect x={xu} y={top} width={Math.max(0, xv - xu)} height={h} fill={rainbow} />
        <rect x={xv} y={top} width={Math.max(0, x1 - xv)} height={h} fill={irC} />
      </g>
      <rect x={x0} y={top} width={W} height={h} rx={h / 2} fill="none" stroke={VIZ.muted} strokeWidth={1.2 * ss} />
      {items.map((it) => (
        <g key={it.key}>
          <rect x={it.left - sq - 6} y={it.y - sq + 1} width={sq} height={sq} rx={2.5} fill={it.c} stroke={VIZ.muted} strokeWidth={ss} />
          <text x={it.left} y={it.y} className="kj-txt" style={{ ['--kj-fs' as string]: 0.8, fontWeight: 600 }}>
            {it.text}
          </text>
        </g>
      ))}
    </g>
  );
}
