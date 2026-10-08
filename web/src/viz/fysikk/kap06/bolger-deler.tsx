/**
 * Gjenstander som bare «Bølger» trenger, i scene-kit-stil: en lang spiralfjær (som en slinky) der hver vinding kan stå
 * for seg (fortetninger og fortynninger), og et merkebånd som er knyttet rundt tauet.
 */
import { memo } from 'react';
import { ContactShadow, SCENE, shade, tint, useStrokeScale } from '../../kit/scene';

const r2 = (v: number) => Math.round(v * 100) / 100;

/**
 * Lang spiralfjær i stål sett fra siden, med vindingene der `coils` sier (x i figuren, fra hånda og utover). Hver
 * vinding går fra sin plass til den neste: forsiden (lys) skrått opp, baksiden (mørk) ned igjen, så fortetningene
 * blir tette og mørke og fortynningene glisne. `mark` er vindingen som er malt i fargen `markColor`.
 * (y er midtlinja; fjæra ligger på underlaget i y + r.)
 */
export function Spiralfjaer({
  coils,
  y,
  r,
  mark,
  markColor,
  maxX,
}: {
  coils: number[];
  y: number;
  r: number;
  mark?: number;
  markColor?: string;
  /** Vindinger lenger ut enn dette tegnes ikke (utenfor bildet). */
  maxX: number;
}) {
  const ss = useStrokeScale();
  const wire = Math.max(1.3 * ss, r * 0.15);
  let front = '';
  let back = '';
  let markFront = '';
  let markBack = '';
  const top = y - r;
  const bot = y + r;
  for (let i = 0; i + 1 < coils.length; i++) {
    const a = coils[i]!;
    const b = coils[i + 1]!;
    if (a > maxX) break;
    const h = (b - a) / 2;
    const m = a + h;
    // Halve omdreininger som cosinuskurver (vannrett tangent øverst og nederst).
    const c = 0.3642 * h;
    const f = `M${r2(a)},${r2(bot)} C${r2(a + c)},${r2(bot)} ${r2(m - c)},${r2(top)} ${r2(m)},${r2(top)} `;
    const k = `M${r2(m)},${r2(top)} C${r2(m + c)},${r2(top)} ${r2(b - c)},${r2(bot)} ${r2(b)},${r2(bot)} `;
    if (i === mark) {
      markFront = f;
      markBack = k;
    } else {
      front += f;
      back += k;
    }
  }
  const first = coils[0] ?? 0;
  const last = Math.min(maxX, coils[coils.length - 1] ?? 0);
  return (
    <g fill="none" strokeLinecap="round" aria-hidden>
      <ContactShadow cx={(first + last) / 2} cy={bot + 0.5} rx={(last - first) / 2 + r} ry={Math.max(2.5, r * 0.3)} opacity={0.6} />
      {/* Baksiden av vindingene: tynnere og mørkere, så forsiden ser ut til å ligge nærmest */}
      <path d={back} stroke={shade(SCENE.metal, 0.35)} strokeWidth={wire * 0.7} opacity={0.75} />
      <path d={front} stroke={SCENE.outline} strokeWidth={wire + 1.1 * ss} opacity={0.9} />
      <path d={front} stroke={SCENE.metal} strokeWidth={wire} />
      <path d={front} stroke={SCENE.metalLight} strokeWidth={wire * 0.38} transform={`translate(${r2(-wire * 0.22)} 0)`} />
      {mark !== undefined && markColor && (
        // Den merkede vindingen: malt (eller teipet) og tykkere, så den synes midt i fjæra.
        <g>
          <path d={markBack} stroke={SCENE.outline} strokeWidth={wire * 1.6 + 1.1 * ss} opacity={0.7} />
          <path d={markBack} stroke={shade(markColor, 0.3)} strokeWidth={wire * 1.6} />
          <path d={markFront} stroke={SCENE.outline} strokeWidth={wire * 2.6 + 1.4 * ss} />
          <path d={markFront} stroke={markColor} strokeWidth={wire * 2.6} />
          <path d={markFront} stroke={tint(markColor, 0.5)} strokeWidth={wire * 0.7} transform={`translate(${r2(-wire * 0.5)} 0)`} />
        </g>
      )}
    </g>
  );
}

/**
 * Merkebånd knyttet rundt tauet i (x, y): en hylse i fargen `color` med to korte ender som henger ned.
 * `size` er bredden på hylsa (standard 9).
 */
export const Tauband = memo(function Tauband({ x, y, color, size = 9 }: { x: number; y: number; color: string; size?: number }) {
  const ss = useStrokeScale();
  const w = size;
  const h = size * 1.25;
  const tail = size * 1.25;
  return (
    <g aria-hidden>
      {/* To smale ender som henger nesten rett ned fra knuten (ikke spredt, så de ikke ser ut som bein) */}
      <path
        d={`M${r2(x - w * 0.3)},${r2(y + h * 0.35)} q${r2(-w * 0.05)},${r2(tail * 0.5)} ${r2(-w * 0.32)},${r2(tail)} l${r2(w * 0.3)},${r2(w * 0.04)} q${r2(w * 0.06)},${r2(-tail * 0.45)} ${r2(w * 0.24)},${r2(-tail * 0.96)} Z M${r2(x + w * 0.05)},${r2(y + h * 0.35)} q${r2(w * 0.04)},${r2(tail * 0.45)} ${r2(w * 0.24)},${r2(tail * 0.8)} l${r2(w * 0.28)},${r2(-w * 0.06)} q${r2(-w * 0.14)},${r2(-tail * 0.35)} ${r2(-w * 0.2)},${r2(-tail * 0.76)} Z`}
        fill={shade(color, 0.18)}
        stroke={SCENE.outline}
        strokeWidth={0.8 * ss}
        strokeLinejoin="round"
      />
      <rect x={r2(x - w / 2)} y={r2(y - h / 2)} width={r2(w)} height={r2(h)} rx={r2(w * 0.25)} fill={color} stroke={SCENE.outline} strokeWidth={0.9 * ss} />
      <rect x={r2(x - w * 0.32)} y={r2(y - h * 0.4)} width={r2(w * 0.22)} height={r2(h * 0.8)} rx={r2(w * 0.1)} fill={tint(color, 0.4)} opacity={0.85} />
    </g>
  );
});
