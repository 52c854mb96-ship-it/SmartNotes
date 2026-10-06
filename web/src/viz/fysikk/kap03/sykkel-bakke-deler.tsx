/**
 * Egne gjenstander til «Sykle opp bakken», tegnet i samme stil som scene-kit-et (toninger fra core.tsx,
 * SCENE-farger, tynn kontur og lys fra øvre venstre): steinmuren langs fjellveien (som i Trollstigen),
 * stålrekkverket langs en vanlig vei og dalbunnen bak veien.
 *
 * Muren og rekkverket tegnes i «veirammen» (gruppen som er dreid med veien, x langs veien og y ned), og ruller
 * med forskyvningen `shift` (px), så de står fast i verden mens syklisten kommer forbi.
 */
import { memo } from 'react';
import { LinearGradient, SCENE, mix, sceneRandom, shade, tint, useStrokeScale, useSvgId } from '../../kit/scene';
import { wrapShift } from './sykkel-bakke-scene';

const r2 = (v: number) => Math.round(v * 100) / 100;

/** Lengden (m) på ett mønster av steiner i muren; mønsteret gjentar seg. */
const WALL_PERIOD = 7.2;

interface WallStone {
  x0: number;
  x1: number;
  top: number;
  c: number;
}

/** Steinene i ett mønster (meter, x fra 0 til WALL_PERIOD; top er hvor mye lavere toppen er, 0–1 av høyden). */
const WALL_STONES: WallStone[] = (() => {
  const rnd = sceneRandom(41);
  const out: WallStone[] = [];
  let x = 0;
  while (x < WALL_PERIOD - 0.3) {
    const w = Math.min(WALL_PERIOD - x, 0.7 + rnd() * 0.75);
    out.push({ x0: x, x1: x + w, top: rnd() * 0.16, c: rnd() });
    x += w;
  }
  return out;
})();

/**
 * Lav mur av store, grovhugde steinblokker langs bakkanten av en fjellvei (slik som i Trollstigen). I veirammen:
 * `base` er foten av muren (y), `height` høyden (px), `S` skalaen (px/m) og `shift` hvor langt veien har rullet (px).
 * Tegnes fra x = `from` til x = `to`.
 */
export const Steinmur = memo(function Steinmur({ from, to, base, height, S, shift }: { from: number; to: number; base: number; height: number; S: number; shift: number }) {
  const ss = useStrokeScale();
  const shadeId = useSvgId('sb-mur');
  const period = WALL_PERIOD * S;
  const start = from + wrapShift(shift, period) - period;
  const tiles: number[] = [];
  for (let x = start; x < to + period; x += period) tiles.push(x);
  const gap = Math.max(1.6, 0.025 * S);
  return (
    <g aria-hidden>
      <LinearGradient
        id={shadeId}
        x2={0.35}
        y2={1}
        stops={[
          [0, SCENE.highlight, 0.35],
          [0.4, SCENE.highlight, 0],
          [1, SCENE.shadow, 0.4],
        ]}
      />
      {/* Skyggen av muren på veikanten */}
      <rect x={from} y={base - 1} width={to - from} height={Math.max(3, height * 0.12)} fill={SCENE.shadow} opacity={0.35} />
      {tiles.map((tx) => (
        <g key={Math.round(tx * 10)} transform={`translate(${r2(tx)} 0)`}>
          {WALL_STONES.map((s, i) => {
            const x0 = s.x0 * S + gap / 2;
            const x1 = s.x1 * S - gap / 2;
            const yTop = base - height * (1 - s.top);
            const rr = Math.min(6, (x1 - x0) * 0.18, height * 0.25);
            const d = `M${r2(x0)},${r2(base)} L${r2(x0)},${r2(yTop + rr)} Q${r2(x0)},${r2(yTop)} ${r2(x0 + rr)},${r2(yTop)} L${r2(x1 - rr)},${r2(yTop)} Q${r2(x1)},${r2(yTop)} ${r2(x1)},${r2(yTop + rr)} L${r2(x1)},${r2(base)} Z`;
            const fill = mix(SCENE.stone, SCENE.stoneDark, 0.1 + s.c * 0.45);
            return (
              <g key={i}>
                <path d={d} fill={fill} />
                <path d={d} fill={`url(#${shadeId})`} stroke={SCENE.outline} strokeWidth={0.8 * ss} strokeLinejoin="round" />
                <path
                  d={`M${r2(x0 + rr)},${r2(yTop + 1.4)} L${r2(x1 - rr)},${r2(yTop + 1.4)}`}
                  stroke={tint(SCENE.stone, 0.55)}
                  strokeWidth={Math.max(1, height * 0.07) * ss}
                  strokeLinecap="round"
                  opacity={0.8}
                />
                {/* En sprekk eller lav i noen av steinene */}
                {s.c > 0.6 && (
                  <path
                    d={`M${r2(x0 + (x1 - x0) * 0.3)},${r2(yTop + height * 0.3)} l${r2((x1 - x0) * 0.12)},${r2(height * 0.22)} l${r2(-(x1 - x0) * 0.05)},${r2(height * 0.2)}`}
                    fill="none"
                    stroke={shade(SCENE.stoneDark, 0.2)}
                    strokeWidth={0.8 * ss}
                    opacity={0.55}
                  />
                )}
                {s.c < 0.22 && <ellipse cx={x0 + (x1 - x0) * 0.66} cy={yTop + height * 0.55} rx={(x1 - x0) * 0.12} ry={height * 0.08} fill={mix(SCENE.grass, SCENE.stone, 0.45)} opacity={0.7} />}
              </g>
            );
          })}
        </g>
      ))}
    </g>
  );
});

/**
 * Stålrekkverk (skinne med to riller på stolper hver 2. meter) langs bakkanten av en vanlig vei. I veirammen, som
 * Steinmur: `base` er der stolpene står, `height` høyden på toppen av skinna.
 */
export const Stalrekkverk = memo(function Stalrekkverk({ from, to, base, height, S, shift }: { from: number; to: number; base: number; height: number; S: number; shift: number }) {
  const ss = useStrokeScale();
  const railId = useSvgId('sb-skinne');
  const postId = useSvgId('sb-stolpe');
  const period = 2 * S;
  const start = from + wrapShift(shift, period) - period;
  const posts: number[] = [];
  for (let x = start; x < to + period; x += period) posts.push(x);
  const railH = height * 0.42;
  const railTop = base - height;
  const postW = Math.max(3, 0.06 * S);
  return (
    <g aria-hidden>
      <LinearGradient
        id={railId}
        stops={[
          [0, tint(SCENE.metalLight, 0.3)],
          [0.3, SCENE.metal],
          [0.5, shade(SCENE.metal, 0.12)],
          [0.7, SCENE.metal],
          [1, shade(SCENE.metalDark, 0.1)],
        ]}
      />
      <LinearGradient
        id={postId}
        x2={1}
        y2={0}
        stops={[
          [0, tint(SCENE.metal, 0.25)],
          [1, shade(SCENE.metalDark, 0.1)],
        ]}
      />
      {posts.map((x) => (
        <rect key={Math.round(x * 10)} x={r2(x - postW / 2)} y={r2(railTop + railH * 0.3)} width={postW} height={r2(base - railTop - railH * 0.3)} fill={`url(#${postId})`} stroke={SCENE.outline} strokeWidth={0.6 * ss} />
      ))}
      <rect x={from} y={railTop} width={to - from} height={railH} fill={`url(#${railId})`} stroke={SCENE.outline} strokeWidth={0.7 * ss} />
      <line x1={from} y1={railTop + railH * 0.5} x2={to} y2={railTop + railH * 0.5} stroke={shade(SCENE.metalDark, 0.15)} strokeWidth={0.9 * ss} opacity={0.6} />
    </g>
  );
});

/**
 * Dalbunnen bak veien, sett ovenfra fra fjellveien: fra horisonten og ned, med luftperspektiv (blek og blålig langt
 * borte, grønnere nærmere) og noen rader med granskog som blir større jo nærmere de er. I figurens koordinater.
 */
export const Dalbunn = memo(function Dalbunn({ w, top, bottom, seed = 3 }: { w: number; top: number; bottom: number; seed?: number }) {
  const id = useSvgId('sb-dal');
  const h = Math.max(1, bottom - top);
  const rows = [
    { at: 0.05, size: 5, haze: 0.62 },
    { at: 0.16, size: 8, haze: 0.48 },
    { at: 0.32, size: 12, haze: 0.34 },
  ];
  const rnd = sceneRandom(seed);
  const forest = rows.map((r) => {
    const y = top + h * r.at;
    let d = '';
    let x = -r.size * rnd();
    while (x < w + r.size) {
      // Granskog i klynger: noen trær tett, så en glenne
      const n = 3 + Math.floor(rnd() * 7);
      for (let i = 0; i < n && x < w + r.size; i++) {
        const s = r.size * (0.7 + rnd() * 0.6);
        d += `M${r2(x)},${r2(y)}L${r2(x + s * 0.32)},${r2(y - s)}L${r2(x + s * 0.64)},${r2(y)}Z`;
        x += s * (0.42 + rnd() * 0.2);
      }
      x += r.size * (1.5 + rnd() * 5);
    }
    return { d, color: mix(SCENE.foliageDark, SCENE.hillFar, r.haze) };
  });
  return (
    <g aria-hidden>
      <LinearGradient
        id={id}
        userSpace
        x1={0}
        y1={top}
        x2={0}
        y2={bottom}
        stops={[
          [0, mix(SCENE.hillFar, SCENE.skyBottom, 0.3)],
          [0.3, SCENE.hillFar],
          [1, mix(SCENE.hillNear, SCENE.grassDark, 0.4)],
        ]}
      />
      <rect x={0} y={top} width={w} height={h} fill={`url(#${id})`} />
      {forest.map((r, i) => (
        <path key={i} d={r.d} fill={r.color} />
      ))}
    </g>
  );
});

/** Lengden (m) på ett mønster av stein, tuer og busker i lia under veien. */
const SLOPE_PERIOD = 11;

type SlopeKind = 'stein' | 'tue' | 'busk';
interface SlopeItem {
  u: number;
  v: number;
  kind: SlopeKind;
  r: number;
}

const SLOPE_ITEMS: SlopeItem[] = (() => {
  const rnd = sceneRandom(77);
  const out: SlopeItem[] = [];
  for (let i = 0; i < 9; i++) {
    const k = rnd();
    out.push({
      u: ((i + rnd() * 0.8) / 9) * SLOPE_PERIOD,
      v: 0.12 + rnd() * 0.8,
      kind: k < 0.38 ? 'stein' : k < 0.8 ? 'tue' : 'busk',
      r: rnd(),
    });
  }
  // De som står lengst bak (høyest opp i lia) tegnes først
  return out.sort((a, b) => a.v - b.v);
})();

/**
 * Stein, gresstuer og små busker i lia under veien, i veirammen: fra y = `top` (rett under veikanten) og `depth`
 * px ned. De nærmeste (lengst ned) er størst. Ruller med veien (`shift` px), som muren.
 */
export const LiaDetaljer = memo(function LiaDetaljer({ from, to, top, depth, S, shift }: { from: number; to: number; top: number; depth: number; S: number; shift: number }) {
  const ss = useStrokeScale();
  const rockId = useSvgId('sb-stein');
  const bushId = useSvgId('sb-busk');
  const period = SLOPE_PERIOD * S;
  const start = from + wrapShift(shift, period) - period;
  const tiles: number[] = [];
  for (let x = start; x < to + period; x += period) tiles.push(x);
  const span = Math.min(depth, 3.2 * S);
  return (
    <g aria-hidden>
      <LinearGradient
        id={rockId}
        x2={0.4}
        y2={1}
        stops={[
          [0, SCENE.highlight, 0.4],
          [0.45, SCENE.highlight, 0],
          [1, SCENE.shadow, 0.45],
        ]}
      />
      <LinearGradient
        id={bushId}
        x2={0.3}
        y2={1}
        stops={[
          [0, tint(SCENE.foliage, 0.18)],
          [1, SCENE.foliageDark],
        ]}
      />
      {tiles.map((tx) => (
        <g key={Math.round(tx * 10)} transform={`translate(${r2(tx)} 0)`}>
          {SLOPE_ITEMS.map((it, i) => {
            const x = it.u * S;
            const y = top + it.v * span;
            const k = (0.16 + 0.22 * it.v) * S;
            if (it.kind === 'stein') {
              const w = k * (0.8 + it.r * 0.6);
              const h = w * 0.55;
              const d = `M${r2(x - w / 2)},${r2(y)} C${r2(x - w / 2)},${r2(y - h * 0.8)} ${r2(x - w * 0.15)},${r2(y - h)} ${r2(x + w * 0.1)},${r2(y - h)} C${r2(x + w * 0.4)},${r2(y - h)} ${r2(x + w / 2)},${r2(y - h * 0.5)} ${r2(x + w / 2)},${r2(y)} Z`;
              return (
                <g key={i}>
                  <ellipse cx={x + w * 0.08} cy={y} rx={w * 0.58} ry={h * 0.16} fill={SCENE.shadow} opacity={0.35} />
                  <path d={d} fill={mix(SCENE.stone, SCENE.stoneDark, 0.2 + it.r * 0.4)} />
                  <path d={d} fill={`url(#${rockId})`} stroke={SCENE.outline} strokeWidth={0.7 * ss} strokeLinejoin="round" />
                </g>
              );
            }
            if (it.kind === 'busk') {
              const w = k * 1.6;
              const blobs = [
                [-0.3, -0.32, 0.3],
                [0.05, -0.48, 0.34],
                [0.32, -0.3, 0.28],
              ];
              return (
                <g key={i}>
                  <ellipse cx={x} cy={y} rx={w * 0.55} ry={w * 0.08} fill={SCENE.shadow} opacity={0.35} />
                  {blobs.map(([bx, by, br], j) => (
                    <circle key={j} cx={x + bx! * w} cy={y + by! * w} r={br! * w} fill={`url(#${bushId})`} stroke={SCENE.outline} strokeWidth={0.6 * ss} />
                  ))}
                </g>
              );
            }
            // Gresstue: noen strå som bøyer seg litt
            const hh = k * 0.9;
            let d = '';
            for (let j = -2; j <= 2; j++) {
              const lean = j * 0.18 + (it.r - 0.5) * 0.2;
              d += `M${r2(x + j * k * 0.08)},${r2(y)} Q${r2(x + j * k * 0.08 + lean * hh * 0.4)},${r2(y - hh * 0.6)} ${r2(x + j * k * 0.08 + lean * hh)},${r2(y - hh * (0.75 + 0.25 * Math.cos(j)))}`;
            }
            return <path key={i} d={d} fill="none" stroke={mix(SCENE.grassDark, SCENE.grass, 0.25 + it.r * 0.3)} strokeWidth={Math.max(1.2, 0.022 * S) * ss} strokeLinecap="round" />;
          })}
        </g>
      ))}
    </g>
  );
});
