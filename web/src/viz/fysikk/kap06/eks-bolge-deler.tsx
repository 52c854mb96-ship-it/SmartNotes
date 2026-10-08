/**
 * Gjenstander til eksempeloppgaven «Bølger ved brygga» (k6-eks-bolge) som scene-kit-et ikke har: ei brygge på
 * pæler sett fra siden, en måke som flyter på vannet, og en båt langt ute på fjorden. Samme stil som scene-kit-et:
 * toninger fra core.tsx, SCENE- og PAINTS-farger, tynn kontur og myke skygger.
 */
import { memo } from 'react';
import { LinearGradient, PAINTS, SCENE, alpha, materialStops, shade, tint, useStrokeScale, useSvgId } from '../../kit/scene';

const r1 = (v: number) => Math.round(v * 10) / 10;

/**
 * Ei brygge på pæler, sett fra siden. Dekket ligger fra x1 til x2 med overflaten i `deckY`. Pælene står i
 * `posts` (x-verdier) og går ned til `bottom`. Tegn brygga før vannet, og vannet med `gjennomsiktig`, så pælene
 * synes svakt under vann. Den mørke stripa på pælene (tang og vått treverk) ligger rundt `waterY`.
 */
export const Brygge = memo(function Brygge({
  x1,
  x2,
  deckY,
  waterY,
  bottom,
  posts,
  postW,
  railH,
}: {
  x1: number;
  x2: number;
  deckY: number;
  waterY: number;
  bottom: number;
  posts: number[];
  /** Tykkelsen på pælene. */
  postW: number;
  /** Høyden på rekkverket over dekket (0 = uten rekkverk). */
  railH: number;
}) {
  const ss = useStrokeScale();
  const id = useSvgId('brygge');
  const deckH = postW * 1.25;
  const beamH = postW * 0.75;
  const under = deckY + deckH + beamH;
  const wetTop = waterY - postW * 1.6;
  return (
    <g aria-hidden>
      <LinearGradient
        id={`${id}p`}
        x1={0}
        y1={0}
        x2={1}
        y2={0}
        stops={[
          [0, tint(SCENE.woodDark, 0.12)],
          [0.35, SCENE.woodDark],
          [1, shade(SCENE.woodDark, 0.35)],
        ]}
      />
      <LinearGradient id={`${id}d`} stops={materialStops(SCENE.wood)} />
      {/* Pælene: runde stokker, mørke og våte nederst der tang og bølger når opp */}
      {posts.map((x) => (
        <g key={x}>
          <rect x={r1(x - postW / 2)} y={r1(under - 1)} width={r1(postW)} height={r1(bottom - under + 1)} fill={`url(#${id}p)`} />
          <rect x={r1(x - postW / 2)} y={r1(wetTop)} width={r1(postW)} height={r1(bottom - wetTop)} fill={alpha(shade(SCENE.grassDark, 0.55), 0.55)} />
          <rect
            x={r1(x - postW / 2)}
            y={r1(under - 1)}
            width={r1(postW)}
            height={r1(bottom - under + 1)}
            fill="none"
            stroke={SCENE.outline}
            strokeWidth={0.8 * ss}
            opacity={0.7}
          />
        </g>
      ))}
      {/* Bjelken under dekket */}
      <rect x={r1(x1)} y={r1(deckY + deckH)} width={r1(x2 - x1)} height={r1(beamH)} fill={shade(SCENE.woodDark, 0.15)} />
      <path d={`M${r1(x1)},${r1(under)}H${r1(x2)}`} stroke={SCENE.outline} strokeWidth={0.8 * ss} opacity={0.6} />
      {/* Rekkverket: stolper over pælene, håndlist og en list på midten */}
      {railH > 0 && (
        <g>
          {posts.map((x) => (
            <rect
              key={x}
              x={r1(x - postW * 0.28)}
              y={r1(deckY - railH)}
              width={r1(postW * 0.56)}
              height={r1(railH)}
              fill={SCENE.wood}
              stroke={SCENE.outline}
              strokeWidth={0.7 * ss}
            />
          ))}
          <rect x={r1(x1)} y={r1(deckY - railH * 0.55)} width={r1(x2 - x1)} height={r1(postW * 0.32)} fill={shade(SCENE.wood, 0.1)} />
          <rect
            x={r1(x1)}
            y={r1(deckY - railH - postW * 0.2)}
            width={r1(x2 - x1)}
            height={r1(postW * 0.5)}
            fill={`url(#${id}d)`}
            stroke={SCENE.outline}
            strokeWidth={0.7 * ss}
          />
        </g>
      )}
      {/* Dekket: kanten av plankene sett fra siden, med lys overkant */}
      <rect x={r1(x1)} y={r1(deckY)} width={r1(x2 - x1)} height={r1(deckH)} fill={`url(#${id}d)`} stroke={SCENE.outline} strokeWidth={0.8 * ss} />
      <path d={`M${r1(x1)},${r1(deckY + 1)}H${r1(x2)}`} stroke={SCENE.woodLight} strokeWidth={1.4 * ss} opacity={0.8} />
    </g>
  );
});

/**
 * En måke som ligger og flyter på vannet, sett fra siden og vendt mot venstre (mot bølgene som kommer).
 * (x, y) er vannlinja midt under kroppen, `size` er lengden fra nebb til vingespisser, og `angle` vipper måken
 * med vannflaten (grader, positiv = med klokka).
 */
export const Maake = memo(function Maake({ x, y, size, angle = 0 }: { x: number; y: number; size: number; angle?: number }) {
  const ss = useStrokeScale();
  const id = useSvgId('maake');
  const L = size;
  const white = PAINTS.hvit;
  const grey = PAINTS.graa;
  const s = (v: number) => r1(v * L);
  // Kroppen er tegnet vendt mot høyre og speilet, så nebbet peker mot venstre.
  const body = `M${s(-0.42)},${s(-0.2)} C${s(-0.3)},${s(-0.02)} ${s(-0.05)},${s(0.03)} ${s(0.2)},${s(0.02)} C${s(0.32)},${s(0.01)} ${s(0.36)},${s(-0.12)} ${s(0.33)},${s(-0.24)} C${s(0.2)},${s(-0.34)} ${s(-0.2)},${s(-0.32)} ${s(-0.42)},${s(-0.2)} Z`;
  const neck = `M${s(0.2)},${s(-0.28)} C${s(0.24)},${s(-0.4)} ${s(0.3)},${s(-0.48)} ${s(0.36)},${s(-0.5)} L${s(0.42)},${s(-0.4)} C${s(0.4)},${s(-0.3)} ${s(0.36)},${s(-0.22)} ${s(0.33)},${s(-0.18)} Z`;
  const wing = `M${s(0.22)},${s(-0.27)} C${s(0.1)},${s(-0.34)} ${s(-0.2)},${s(-0.33)} ${s(-0.4)},${s(-0.24)} L${s(-0.48)},${s(-0.22)} C${s(-0.3)},${s(-0.14)} ${s(0)},${s(-0.13)} ${s(0.2)},${s(-0.18)} Z`;
  const tips = `M${s(-0.36)},${s(-0.25)} L${s(-0.62)},${s(-0.3)} L${s(-0.58)},${s(-0.25)} L${s(-0.38)},${s(-0.18)} Z`;
  const beak = `M${s(0.46)},${s(-0.45)} L${s(0.62)},${s(-0.42)} L${s(0.6)},${s(-0.39)} L${s(0.45)},${s(-0.39)} Z`;
  return (
    <g transform={`translate(${r1(x)} ${r1(y)}) rotate(${r1(angle)}) scale(-1 1)`} aria-hidden>
      <LinearGradient
        id={`${id}b`}
        stops={[
          [0, white],
          [1, shade(white, 0.12)],
        ]}
      />
      <clipPath id={`${id}k`}>
        <rect x={s(-0.8)} y={s(-0.8)} width={s(1.6)} height={s(0.8) + 0.5} />
      </clipPath>
      {/* Myk skygge og en liten krusning på vannet rundt kroppen */}
      <ellipse cx={0} cy={s(0.01)} rx={s(0.46)} ry={Math.max(1.2, s(0.045))} fill={alpha(SCENE.shadow, 0.35)} />
      <g clipPath={`url(#${id}k)`} stroke={SCENE.outline} strokeWidth={0.7 * ss} strokeLinejoin="round">
        <path d={tips} fill={PAINTS.svart} />
        <path d={body} fill={`url(#${id}b)`} />
        <path d={neck} fill={white} stroke="none" />
        <circle cx={s(0.4)} cy={s(-0.44)} r={s(0.105)} fill={white} />
        <path d={wing} fill={grey} />
        <path d={beak} fill={PAINTS.gul} />
      </g>
      <circle cx={s(0.585)} cy={s(-0.405)} r={Math.max(0.6, s(0.018))} fill={PAINTS.rod} />
      <circle cx={s(0.43)} cy={s(-0.465)} r={Math.max(0.8, s(0.022))} fill={PAINTS.svart} />
      <path d={`M${s(-0.46)},${s(0.012)}H${s(0.38)}`} stroke={tint(SCENE.waterLight, 0.5)} strokeWidth={1.1 * ss} strokeLinecap="round" opacity={0.85} />
    </g>
  );
});

/**
 * En båt langt ute på fjorden (det som har laget bølgene). `type`: 'ferje' (lang, hvit overbygning med to dekk)
 * eller 'motorbaat' (liten, med styrehus). (x, y) er vannlinja midt under båten, `size` er lengden.
 */
export const Baat = memo(function Baat({ x, y, size, type }: { x: number; y: number; size: number; type: 'ferje' | 'motorbaat' }) {
  const ss = useStrokeScale();
  const L = size;
  const s = (v: number) => r1(v * L);
  const hull = type === 'ferje' ? PAINTS.blaa : PAINTS.hvit;
  return (
    <g transform={`translate(${r1(x)} ${r1(y)})`} aria-hidden opacity={0.9}>
      {type === 'ferje' ? (
        <g stroke={alpha(SCENE.outline, 0.7)} strokeWidth={0.6 * ss} strokeLinejoin="round">
          <path d={`M${s(-0.5)},${s(-0.12)} L${s(0.5)},${s(-0.12)} L${s(0.46)},0 L${s(-0.46)},0 Z`} fill={hull} />
          <rect x={s(-0.36)} y={s(-0.24)} width={s(0.72)} height={s(0.12)} fill={PAINTS.hvit} />
          <rect x={s(-0.2)} y={s(-0.33)} width={s(0.4)} height={s(0.09)} fill={PAINTS.hvit} />
          <rect x={s(0.02)} y={s(-0.43)} width={s(0.06)} height={s(0.1)} fill={PAINTS.rod} />
        </g>
      ) : (
        <g stroke={alpha(SCENE.outline, 0.7)} strokeWidth={0.6 * ss} strokeLinejoin="round">
          <path d={`M${s(-0.5)},${s(-0.16)} L${s(0.5)},${s(-0.2)} L${s(0.3)},0 L${s(-0.48)},0 Z`} fill={hull} />
          <path d={`M${s(-0.2)},${s(-0.17)} L${s(-0.14)},${s(-0.42)} L${s(0.12)},${s(-0.42)} L${s(0.2)},${s(-0.18)} Z`} fill={PAINTS.hvit} />
          <rect x={s(-0.1)} y={s(-0.37)} width={s(0.18)} height={s(0.09)} fill={alpha(SCENE.glass, 0.9)} />
        </g>
      )}
      {/* Kjølvannet: et lyst stripe bak båten */}
      <path d={`M${s(-0.5)},${s(0.02)} L${s(-1.3)},${s(0.06)}`} stroke={tint(SCENE.waterLight, 0.55)} strokeWidth={1.4 * ss} strokeLinecap="round" opacity={0.8} />
    </g>
  );
});
