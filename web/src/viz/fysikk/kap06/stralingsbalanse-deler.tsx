/**
 * Gjenstandene i scenen for k6-stralingsbalanse, i samme stil som scene-kit-et (toninger fra core.tsx, SCENE-farger,
 * kontur og myke overganger): himmelen fra verdensrommet ned til bakken, drivhusgasslaget med molekyler, haugskyer,
 * kystlandskapet i snitt (hav med sjøis, lavland med skog og fjell med snø) og flytpiler der bredden viser strømmen.
 */
import { memo, useMemo } from 'react';
import {
  Gran,
  LinearGradient,
  PAINTS,
  RadialGradient,
  SCENE,
  Stjernehimmel,
  Vann,
  alpha,
  mix,
  shade,
  sphereStops,
  tint,
  useStrokeScale,
  useSvgId,
} from '../../kit/scene';
import {
  CLOUD_SLOTS,
  arrowPolygon,
  cloudCount,
  farProfile,
  landSnowX,
  moleculeCount,
  molecules,
  mountainBase,
  mountainProfile,
  seaIceX,
  snowLine,
  type Box,
  type Cover,
  type Pt,
  type StralingLayout,
} from './stralingsbalanse-scene';
import { Hytte } from './solcellepanel-deler';

const r1 = (v: number) => Math.round(v * 10) / 10;
const pts = (p: Pt[]) => p.map((q) => `${r1(q.x)},${r1(q.y)}`).join(' ');

/* ------------------------------------------------------------------ Flytpil */

/**
 * Tykk pil der bredden på skaftet er `w` (proporsjonal med energistrømmen), med glorie og tynn kontur som
 * ForceArrow i scene-kit-et, så den synes oppå himmel, skyer og snø.
 */
export function FlowArrow({ x1, y1, x2, y2, w, color }: { x1: number; y1: number; x2: number; y2: number; w: number; color: string }) {
  const ss = useStrokeScale();
  const poly = arrowPolygon(x1, y1, x2, y2, w, ss);
  if (poly.length === 0) return null;
  const d = `M${pts(poly)}Z`;
  return (
    <g className="viz-arrow">
      <path d={d} fill={color} className="sc-force" strokeWidth={3.6 * ss} />
      <path d={d} fill="none" stroke={shade(color, 0.32)} strokeWidth={1.1 * ss} strokeLinejoin="round" opacity={0.75} />
    </g>
  );
}

/* ------------------------------------------------------------------ Himmelen */

/** Verdensrommet øverst (mørkt i begge temaer) som går over i blå himmel og lys dis ved horisonten. */
export const Sky = memo(function Sky({ L }: { L: StralingLayout }) {
  const id = useSvgId('stb-himmel');
  const top = L.yToa - 40;
  const h = L.yG + 2 - top;
  const deep = mix(SCENE.skyTop, SCENE.space, 0.5);
  return (
    <g aria-hidden>
      <Stjernehimmel x={0} y={0} w={L.W} h={L.yToa + 30} seed={4} melkevei={0.3} />
      <LinearGradient
        id={id}
        stops={[
          [0, deep, 0],
          [0.07, deep, 0.55],
          [0.16, mix(deep, SCENE.skyTop, 0.45), 0.92],
          [0.38, SCENE.skyTop],
          [1, SCENE.skyBottom],
        ]}
      />
      <rect x={0} y={top} width={L.W} height={h} fill={`url(#${id})`} />
    </g>
  );
});

/* ------------------------------------------------------------------ Drivhusgasslaget */

/**
 * Laget med drivhusgasser: en svak dis som blir tettere med ε, og molekyler (CO₂ og H₂O) der antallet følger ε.
 * `glow` er fargen laget tones mot (varmestrålingen det tar opp).
 */
export function GreenhouseLayer({ L, eps, glow, avoid }: { L: StralingLayout; eps: number; glow: string; avoid?: Box }) {
  const id = useSvgId('stb-lag');
  const oId = useSvgId('stb-o');
  const cId = useSvgId('stb-c');
  const hId = useSvgId('stb-h');
  const ss = useStrokeScale();
  const all = useMemo(() => molecules(), []);
  const n = moleculeCount(eps);
  const pad = 16 * L.s;
  const top = L.yL1 - pad;
  const h = L.yL2 - L.yL1 + 2 * pad;
  const e = Math.min(1, Math.max(0, eps));
  const a = 0.1 + 0.5 * e;
  const haze = mix(SCENE.skyBottom, glow, 0.3);
  const k = L.s;
  const rO = 4.2 * k;
  const rC = 3.7 * k;
  const rH = 2.8 * k;
  const line = alpha(SCENE.outline, 0.6);
  const sw = 0.6 * ss;
  return (
    <g aria-hidden>
      <LinearGradient
        id={id}
        stops={[
          [0, haze, 0],
          [0.3, haze, a],
          [0.5, haze, a * 1.1],
          [0.7, haze, a],
          [1, haze, 0],
        ]}
      />
      <rect x={0} y={top} width={L.W} height={h} fill={`url(#${id})`} />
      {e > 0 &&
        [L.yL1, L.yL2].map((y) => (
          <line
            key={y}
            x1={0}
            x2={L.W}
            y1={y}
            y2={y}
            stroke={alpha(glow, 0.15 + 0.35 * e)}
            strokeWidth={1.2 * ss}
            strokeDasharray={`${7 * ss} ${6 * ss}`}
          />
        ))}
      <RadialGradient id={oId} stops={sphereStops(PAINTS.rod)} fx={0.35} fy={0.35} />
      <RadialGradient id={cId} stops={sphereStops(shade(PAINTS.graa, 0.35))} fx={0.35} fy={0.35} />
      <RadialGradient id={hId} stops={sphereStops(PAINTS.hvit)} fx={0.35} fy={0.35} />
      {all.slice(0, n).map((m, i) => {
        const x = r1(6 + m.u * (L.W - 12));
        const y = r1(L.yL1 + 6 * k + m.v * (L.yL2 - L.yL1 - 12 * k));
        if (avoid && x > avoid.l - 10 * k && x < avoid.r + 10 * k && y > avoid.t - 8 * k && y < avoid.b + 8 * k) return null;
        if (m.kind === 'co2') {
          const dOC = rO + rC - 1.4 * k;
          return (
            <g key={i} transform={`translate(${x} ${y}) rotate(${r1(m.rot)})`}>
              <circle cx={-dOC} r={rO} fill={`url(#${oId})`} stroke={line} strokeWidth={sw} />
              <circle r={rC} fill={`url(#${cId})`} stroke={line} strokeWidth={sw} />
              <circle cx={dOC} r={rO} fill={`url(#${oId})`} stroke={line} strokeWidth={sw} />
            </g>
          );
        }
        const dOH = rO + rH - 1.2 * k;
        const ang = (52.25 * Math.PI) / 180;
        return (
          <g key={i} transform={`translate(${x} ${y}) rotate(${r1(m.rot)})`}>
            <circle
              cx={r1(-dOH * Math.sin(ang))}
              cy={r1(dOH * Math.cos(ang))}
              r={rH}
              fill={`url(#${hId})`}
              stroke={line}
              strokeWidth={sw}
            />
            <circle cx={r1(dOH * Math.sin(ang))} cy={r1(dOH * Math.cos(ang))} r={rH} fill={`url(#${hId})`} stroke={line} strokeWidth={sw} />
            <circle r={rO} fill={`url(#${oId})`} stroke={line} strokeWidth={sw} />
          </g>
        );
      })}
    </g>
  );
}

/* ------------------------------------------------------------------ Skyer */

/** Midten av bunnen og bredden til sky nummer i (fra CLOUD_SLOTS). Skyene blir litt større når skydekket øker. */
export function cloudPlace(L: StralingLayout, i: number, clouds: number) {
  const slot = CLOUD_SLOTS[i]!;
  const w = (78 + 46 * clouds) * L.s * slot.w;
  const x = slot.x * L.W;
  const y = L.cloudTop + slot.y * (L.cloudBot - L.cloudTop) + w / 2.4 / 2;
  return { x, y, w, top: y - w / 2.4 };
}

function cloudPath(w: number, seed: number): string {
  const h = w / 2.4;
  const j = (n: number) => 0.9 + 0.2 * Math.abs(Math.sin(seed * 12.9898 + n * 78.233));
  // Puter langs en flat, avrundet bunn. Alt tegnes med klokka, så delene smelter sammen til én flate (nonzero).
  const puffs: [number, number, number][] = [
    [-0.42 * w, -0.17 * h, 0.17 * h * j(1)],
    [-0.28 * w, -0.3 * h * j(2), 0.27 * h * j(3)],
    [-0.1 * w, -0.5 * h * j(4), 0.4 * h * j(5)],
    [0.11 * w, -0.56 * h, 0.44 * h * j(6)],
    [0.29 * w, -0.36 * h * j(7), 0.3 * h * j(8)],
    [0.42 * w, -0.17 * h, 0.17 * h * j(9)],
  ];
  const c = (x: number, y: number, r: number) =>
    `M${r1(x - r)},${r1(y)}a${r1(r)},${r1(r)} 0 1,1 ${r1(2 * r)},0a${r1(r)},${r1(r)} 0 1,1 ${r1(-2 * r)},0Z`;
  const x0 = -0.44 * w;
  const x1 = 0.44 * w;
  const y0 = -0.3 * h;
  const rr = 0.15 * h;
  let d = `M${r1(x0 + rr)},${r1(y0)}H${r1(x1 - rr)}A${r1(rr)},${r1(rr)} 0 0,1 ${r1(x1)},${r1(y0 + rr)}V${r1(-rr)}A${r1(rr)},${r1(rr)} 0 0,1 ${r1(x1 - rr)},0H${r1(x0 + rr)}A${r1(rr)},${r1(rr)} 0 0,1 ${r1(x0)},${r1(-rr)}V${r1(y0 + rr)}A${r1(rr)},${r1(rr)} 0 0,1 ${r1(x0 + rr)},${r1(y0)}Z`;
  for (const [px, py, pr] of puffs) d += c(px, Math.min(py, -pr), pr);
  return d;
}

/** Haugskyene: like mange som skydekket sier, på faste plasser. */
export const Clouds = memo(function Clouds({ L, clouds }: { L: StralingLayout; clouds: number }) {
  const id = useSvgId('stb-sky');
  const n = cloudCount(clouds);
  if (n === 0) return null;
  return (
    <g aria-hidden>
      <LinearGradient
        id={id}
        stops={[
          [0, tint(SCENE.cloud, 0.3)],
          [0.55, SCENE.cloud],
          [1, SCENE.cloudShade],
        ]}
      />
      {Array.from({ length: n }, (_, i) => {
        const c = cloudPlace(L, i, clouds);
        return (
          <g key={i} transform={`translate(${r1(c.x)} ${r1(c.y)})`}>
            <path d={cloudPath(c.w, i + 1)} fill={`url(#${id})`} />
          </g>
        );
      })}
    </g>
  );
});

/* ------------------------------------------------------------------ Landskapet i snitt */

/** Grantrærne i skogen: faste plasser og størrelser (andeler), så skogen står likt hver gang. */
const TREES: readonly [number, number, number][] = [
  // [skog, andel av intervallet, størrelse]
  [0, 0.04, 0.8],
  [0, 0.16, 1],
  [0, 0.27, 0.75],
  [0, 0.4, 0.95],
  [0, 0.52, 0.85],
  [0, 0.66, 1],
  [0, 0.78, 0.8],
  [0, 0.92, 0.9],
  [1, 0.06, 0.9],
  [1, 0.22, 0.75],
  [1, 0.4, 1],
  [1, 0.6, 0.85],
  [1, 0.78, 0.95],
  [1, 0.95, 0.8],
];

/**
 * Kystlandskapet: fjerne åser, fjell med snø over snøgrensen, havet med sjøis langs land, lavlandet med skog og snø,
 * og snittet under bakken (sjøvann og fjell under et tynt jordlag).
 */
export const Landscape = memo(function Landscape({ L, cover }: { L: StralingLayout; cover: Cover }) {
  const ss = useStrokeScale();
  const mId = useSvgId('stb-fjell');
  const fId = useSvgId('stb-fjern');
  const clip = useSvgId('stb-fjellklipp');
  const snowId = useSvgId('stb-sno');
  const rockId = useSvgId('stb-berg');
  const iceId = useSvgId('stb-is');
  const edgeId = useSvgId('stb-snokant');
  const rockClip = useSvgId('stb-bergklipp');
  const soilId = useSvgId('stb-jord');
  const { W, H, yG, s } = L;
  const base = mountainBase(L);
  const ridge = mountainProfile(L);
  const far = farProfile(L);
  const ridgePoly = [{ x: ridge[0]!.x, y: yG }, ...ridge, { x: W + 4, y: yG }];
  const farPoly = [{ x: -4, y: yG }, ...far, { x: W + 4, y: yG }];
  const sl = snowLine(L, cover.snow);
  // Snøkanten bølger litt, så den ser ut som snø i fjellsider og renner
  const snowEdge: Pt[] = [];
  for (let x = ridge[0]!.x - 4; x <= W + 6; x += 6)
    snowEdge.push({
      x,
      y: sl + 3.5 * Math.sin(x / 9) + 2.5 * Math.sin(x / 23 + 1),
    });
  const snowPoly = [{ x: ridge[0]!.x - 4, y: base - L.mountainH - 10 }, ...snowEdge, { x: W + 6, y: base - L.mountainH - 10 }];
  // Skyggesida (til høyre for hver topp, lyset kommer fra sola oppe til venstre)
  const shadows: Pt[][] = [];
  for (let i = 1; i < ridge.length - 1; i++) {
    const p = ridge[i]!;
    const prev = ridge[i - 1]!;
    const next = ridge[i + 1]!;
    if (p.y < prev.y && p.y < next.y) shadows.push([p, next, { x: p.x + (next.x - p.x) * 0.25, y: base + 2 }]);
  }
  const iceX = seaIceX(L, cover.seaIce);
  const snowX = landSnowX(L, cover.land);
  const shoreFoot = L.xShore - 64 * s;
  const soil = 10 * s;
  const iceH = 9 * s;
  const fade = 50 * s;
  const landD = `M${r1(L.xShore - 4 * s)},${r1(yG)} L${W + 2},${r1(yG)} L${W + 2},${H + 2} L${r1(shoreFoot)},${H + 2} C${r1(shoreFoot + 20 * s)},${r1(yG + 40 * s)} ${r1(L.xShore - 26 * s)},${r1(yG + 6 * s)} ${r1(L.xShore - 4 * s)},${r1(yG)} Z`;
  // Steiner i berget og jordlaget (faste plasser)
  const stones = useMemo(() => {
    const out: { x: number; y: number; r: number }[] = [];
    for (let i = 0; i < 16; i++) {
      const u = (i + 0.5 + 0.4 * Math.sin(i * 7.3)) / 16;
      const v = 0.5 + 0.5 * Math.sin(i * 2.9 + 1);
      out.push({
        x: L.xShore + 10 * s + u * (W - L.xShore),
        y: yG + 12 * s + v * (H - yG - 20 * s),
        r: (2.2 + 1.8 * Math.abs(Math.sin(i * 5.1))) * s,
      });
    }
    return out;
  }, [L.xShore, W, H, yG, s]);
  // Hytta ved sjøen (rødmalt med torvtak), og granskogen rundt den
  const cabin = { x: L.cabinX, w: 46 * s };
  const trees = TREES.map(([fi, u, sz], i) => {
    const [a, b] = L.forest[fi]!;
    return { x: a + u * (b - a), size: (24 + 14 * sz) * s, seed: i + 3 };
  })
    .filter((t) => Math.abs(t.x - cabin.x) > cabin.w / 2 + 0.2 * t.size)
    .sort((p, q) => p.size - q.size);
  return (
    <g aria-hidden>
      {/* Fjerne åser (blekere og blåere) */}
      <LinearGradient
        id={fId}
        stops={[
          [0, mix(SCENE.mountain, SCENE.skyBottom, 0.55)],
          [1, mix(SCENE.mountainShade, SCENE.skyBottom, 0.4)],
        ]}
      />
      <polygon points={pts(farPoly)} fill={`url(#${fId})`} />

      {/* Fjellkjeden med snø over snøgrensen og skyggesider */}
      <LinearGradient
        id={mId}
        stops={[
          [0, tint(SCENE.mountain, 0.08)],
          [1, SCENE.mountainShade],
        ]}
      />
      <LinearGradient
        id={snowId}
        stops={[
          [0, tint(SCENE.snowcap, 0.3)],
          [1, SCENE.snowShade],
        ]}
      />
      <defs>
        <clipPath id={clip}>
          <polygon points={pts(ridgePoly)} />
        </clipPath>
      </defs>
      <polygon points={pts(ridgePoly)} fill={`url(#${mId})`} />
      <g clipPath={`url(#${clip})`}>
        {cover.snow > 0.02 && <polygon points={pts(snowPoly)} fill={`url(#${snowId})`} />}
        {shadows.map((t, i) => (
          <polygon key={i} points={pts(t)} fill={SCENE.mountainShade} opacity={0.45} />
        ))}
      </g>
      <polyline points={pts(ridge)} fill="none" stroke={alpha(SCENE.outline, 0.35)} strokeWidth={0.8 * ss} strokeLinejoin="round" />

      {/* Havet i snitt, med sjøis langs land */}
      <Vann x={0} y={yG} w={L.xShore + 20 * s} h={H - yG} />
      {iceX < L.xShore - 1 && (
        <g>
          <LinearGradient
            id={iceId}
            stops={[
              [0, SCENE.iceShine],
              [0.4, SCENE.ice],
              [1, shade(SCENE.ice, 0.12)],
            ]}
          />
          <rect
            x={iceX}
            y={yG - 2.5 * s}
            width={L.xShore - iceX + 4 * s}
            height={iceH}
            rx={2 * s}
            fill={`url(#${iceId})`}
            stroke={alpha(SCENE.outline, 0.45)}
            strokeWidth={0.7 * ss}
          />
          <rect x={iceX + 1} y={yG - 3.5 * s} width={L.xShore - iceX + 2 * s} height={2.6 * s} rx={1.3 * s} fill={SCENE.snow} />
          {/* Sprekker i isen */}
          {Array.from({ length: Math.floor((L.xShore - iceX) / (34 * s)) }, (_, i) => {
            const x = L.xShore - (i + 0.6) * 34 * s;
            return (
              <line
                key={i}
                x1={x}
                x2={x + 3 * s}
                y1={yG - 0.5 * s}
                y2={yG + iceH - 3.5 * s}
                stroke={alpha(SCENE.outline, 0.35)}
                strokeWidth={0.8 * ss}
              />
            );
          })}
        </g>
      )}

      {/* Lavlandet i snitt: fjell under et tynt jordlag, og stranda som skrår ned i sjøen */}
      <LinearGradient
        id={rockId}
        stops={[
          [0, SCENE.stone],
          [1, shade(SCENE.stoneDark, 0.15)],
        ]}
      />
      <defs>
        <clipPath id={rockClip}>
          <path d={landD} />
        </clipPath>
      </defs>
      <path d={landD} fill={`url(#${rockId})`} stroke={alpha(SCENE.outline, 0.5)} strokeWidth={0.8 * ss} />
      {/* Lagdeling i berget (svake, skrå sjikt) */}
      <g clipPath={`url(#${rockClip})`}>
        {[0.42, 0.7, 0.95].map((u, i) => {
          const y0 = yG + soil + u * (H - yG - soil);
          return (
            <path
              key={i}
              d={`M${r1(L.xShore - 60 * s)},${r1(y0 + 10 * s)} C${r1(W * 0.35)},${r1(y0 - 6 * s)} ${r1(W * 0.65)},${r1(y0 + 12 * s)} ${W + 4},${r1(y0 - 4 * s)}`}
              fill="none"
              stroke={alpha(shade(SCENE.stoneDark, 0.2), 0.6)}
              strokeWidth={1.4 * ss}
            />
          );
        })}
        {stones.map((p, i) => (
          <ellipse
            key={i}
            cx={p.x}
            cy={p.y}
            rx={p.r}
            ry={p.r * 0.7}
            fill={i % 2 ? SCENE.stoneDark : tint(SCENE.stone, 0.15)}
            stroke={alpha(SCENE.outline, 0.35)}
            strokeWidth={0.6 * ss}
          />
        ))}
        <LinearGradient
          id={soilId}
          stops={[
            [0, SCENE.soil],
            [1, SCENE.soilDark],
          ]}
        />
        <path
          d={`M${r1(L.xShore - 14 * s)},${r1(yG)} L${W + 2},${r1(yG)} L${W + 2},${r1(yG + soil)} C${r1(W * 0.6)},${r1(yG + soil + 3 * s)} ${r1(W * 0.4)},${r1(yG + soil - 2 * s)} ${r1(L.xShore + 6 * s)},${r1(yG + soil)} Q${r1(L.xShore - 8 * s)},${r1(yG + soil)} ${r1(L.xShore - 20 * s)},${r1(yG + 4 * s)} Z`}
          fill={`url(#${soilId})`}
        />
      </g>
      {/* Torv og lyng på toppen, og en lys sandstrand ned mot sjøen */}
      <line x1={L.xShore + 4 * s} x2={W + 2} y1={yG + 1 * s} y2={yG + 1 * s} stroke={SCENE.grassDark} strokeWidth={2.6 * ss} />
      <path
        d={`M${r1(L.xShore - 12 * s)},${r1(yG + 1.2 * s)} Q${r1(L.xShore - 4 * s)},${r1(yG - 0.6 * s)} ${r1(L.xShore + 8 * s)},${r1(yG + 0.4 * s)}`}
        fill="none"
        stroke={SCENE.gravel}
        strokeWidth={2.6 * ss}
        strokeLinecap="round"
      />

      {/* Snø på lavlandet, fra fjellet mot kysten */}
      {cover.land > 0.005 && (
        <g>
          <LinearGradient
            id={edgeId}
            x2={1}
            y2={0}
            stops={[
              [0, SCENE.snow, 0],
              [Math.min(0.9, fade / Math.max(fade, W - snowX)), SCENE.snow, 1],
              [1, SCENE.snow, 1],
            ]}
          />
          <rect x={snowX - 1} y={yG - 2.5 * s} width={W - snowX + 3} height={7 * s} rx={2 * s} fill={`url(#${edgeId})`} />
        </g>
      )}

      <Hytte x={cabin.x} y={yG} w={cabin.w} sesong={cabin.x > snowX ? 'vinter' : 'sommer'} />

      {/* Granskog */}
      {trees.map((t) => (
        <Gran key={t.seed} x={t.x} y={yG} size={t.size} seed={t.seed} sno={t.x > snowX + 8 * s} />
      ))}
    </g>
  );
});
