/**
 * Egne gjenstander til friksjonsscenen (2C) som scene-kit-et ikke har: en garasjeport på bakveggen, så rommet med
 * betonggulv blir en garasje. Samme stil som scene-kit-et: toninger fra core, SCENE-farger, tynn kontur.
 */
import { LinearGradient, SCENE, materialStops, mix, shade, tint, useStrokeScale, useSvgId } from '../../kit/scene';

/**
 * Leddport i stål (seksjoner med vannrette ribber og et håndtak), sett rett forfra i bakveggen.
 * Ankerpunkt: (x, y) er nederste venstre hjørne (der porten møter gulvet), w og h er bredden og høyden.
 */
export function Garasjeport({ x, y, w, h }: { x: number; y: number; w: number; h: number }) {
  const ss = useStrokeScale();
  const door = useSvgId('garasjeport');
  const frame = useSvgId('garasjekarm');
  if (!(w > 20) || !(h > 20)) return null;
  const top = y - h;
  const sections = 4;
  const sh = h / sections;
  const karm = Math.max(5, w * 0.025);
  // Lys stålport, litt tonet mot veggen, så den ikke lyser opp i skumringen (mørkt tema).
  const base = mix(SCENE.metalLight, SCENE.wallShade, 0.35);
  return (
    <g aria-hidden>
      <LinearGradient id={frame} stops={materialStops(SCENE.wallShade, 0.8)} />
      <LinearGradient
        id={door}
        stops={[
          [0, tint(base, 0.2)],
          [0.5, base],
          [1, shade(base, 0.12)],
        ]}
      />
      {/* Karmen rundt åpningen */}
      <rect x={x - karm} y={top - karm} width={w + 2 * karm} height={h + karm} fill={`url(#${frame})`} stroke={SCENE.outline} strokeWidth={0.8 * ss} />
      <rect x={x} y={top} width={w} height={h} fill={`url(#${door})`} stroke={SCENE.outline} strokeWidth={0.9 * ss} />
      {Array.from({ length: sections }, (_, i) => {
        const sy = top + i * sh;
        return (
          <g key={i}>
            {/* Skjøten mellom seksjonene: mørk fuge med lys kant under */}
            {i > 0 && <line x1={x} x2={x + w} y1={sy} y2={sy} stroke={shade(base, 0.35)} strokeWidth={1.4 * ss} />}
            {i > 0 && <line x1={x} x2={x + w} y1={sy + 1.4 * ss} y2={sy + 1.4 * ss} stroke={SCENE.highlight} strokeWidth={0.8 * ss} opacity={0.5} />}
            {/* To svake ribber i hver seksjon */}
            {[0.36, 0.68].map((t) => (
              <line key={t} x1={x + 3} x2={x + w - 3} y1={sy + sh * t} y2={sy + sh * t} stroke={shade(base, 0.16)} strokeWidth={0.8 * ss} opacity={0.7} />
            ))}
          </g>
        );
      })}
      {/* Håndtak midt nede og en gummilist mot gulvet */}
      <rect x={x + w / 2 - 14} y={y - sh * 0.55} width={28} height={5} rx={2.5} fill={shade(SCENE.metal, 0.35)} stroke={SCENE.outline} strokeWidth={0.6 * ss} />
      <rect x={x} y={y - 3} width={w} height={3} fill={SCENE.rubber} />
    </g>
  );
}
