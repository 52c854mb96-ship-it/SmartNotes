/**
 * Egne gjenstander i «Spesifikk varmekapasitet»: metallklossen (en dreid sylinder med hull til termometeret, som
 * klossene i fysikklaben) og varmepila som viser energien som går fra kokeplata inn i stoffet.
 * Samme stil som scene-kit-et: toninger fra core.tsx, SCENE-farger, kontur og myk skygge.
 */
import type { ReactNode } from 'react';
import { Txt, VIZ } from '../../kit';
import { ContactShadow, LinearGradient, SCENE, mix, shade, tint, useStrokeScale, useSvgId } from '../../kit/scene';
import type { MaterialId } from './model';

/** Ellipseforholdet (ry/rx) for sirkler sett litt ovenfra, som plata på kokeplata i scene-kit-et. */
export const ELLIPSE = 0.15;

/** Fargen på metallene (scene-farger, ikke VIZ: det er gjenstander). Samme som i «Blanding og termisk likevekt». */
export function metalColor(id: MaterialId): string {
  switch (id) {
    case 'aluminium':
      return tint(SCENE.metal, 0.28);
    case 'jern':
      return shade(SCENE.metal, 0.34);
    case 'kobber':
      return SCENE.copper;
    case 'bly':
      return mix(shade(SCENE.metal, 0.42), SCENE.waterDeep, 0.18);
    default:
      return SCENE.metal;
  }
}

function r1(v: number): number {
  return Math.round(v * 10) / 10;
}

export interface MetallklossProps {
  /** Midt på bunnen (kontaktflaten mot plata). */
  x: number;
  y: number;
  /** Diameter og høyde (figurens enheter). */
  d: number;
  h: number;
  color: string;
  /** Kjemisk symbol stemplet på siden (vises når klossen er stor nok), midt på `symbolX` (standard litt til venstre). */
  symbol?: string;
  symbolX?: number;
  /** Hullet til termometeret: midten i figurens x og radius. */
  hole?: { x: number; r: number };
  /** Det som står i hullet (termometeret). Delen under toppflaten skjules. */
  children?: ReactNode;
  title?: string;
}

/**
 * Metallkloss: dreid sylinder sett litt ovenfra, med lys fra venstre, svake dreiespor på toppen og et hull til
 * termometeret. Ankerpunkt: (x, y) er midten av bunnen, så den kan settes rett på en kokeplate.
 */
export function Metallkloss({ x, y, d, h, color, symbol, symbolX, hole, children, title }: MetallklossProps) {
  const ss = useStrokeScale();
  const id = useSvgId('metallkloss');
  const r = Math.max(2, d / 2);
  const ry = ELLIPSE * r;
  const top = y - h;
  const side = `M${r1(x - r)},${r1(top)}V${r1(y)}A${r1(r)},${r1(ry)} 0 0 0 ${r1(x + r)},${r1(y)}V${r1(top)}Z`;
  const hx = hole?.x ?? x;
  const hr = hole ? Math.min(hole.r, 0.8 * r) : 0;
  const hry = ELLIPSE * hr * 1.25;
  const fs = Math.min(0.34 * d, 0.36 * h, 17);
  return (
    <g>
      {title && <title>{title}</title>}
      <ContactShadow cx={x + 0.08 * r} cy={y + 0.3 * ry} rx={r * 1.18} ry={Math.max(2.5, ry * 1.5)} />
      <LinearGradient
        id={`${id}-s`}
        x2={1}
        y2={0}
        stops={[
          [0, shade(color, 0.22)],
          [0.14, tint(color, 0.3)],
          [0.32, tint(color, 0.12)],
          [0.7, shade(color, 0.18)],
          [1, shade(color, 0.42)],
        ]}
      />
      <LinearGradient
        id={`${id}-t`}
        x2={1}
        y2={1}
        stops={[
          [0, tint(color, 0.42)],
          [1, tint(color, 0.08)],
        ]}
      />
      <path d={side} fill={`url(#${id}-s)`} />
      {/* Toppflaten med dreiespor */}
      <ellipse cx={x} cy={top} rx={r} ry={ry} fill={`url(#${id}-t)`} />
      {r > 14 && (
        <path
          d={[0.38, 0.62, 0.84]
            .map((k) => `M${r1(x - k * r)},${r1(top)}a${r1(k * r)},${r1(k * ry)} 0 1,0 ${r1(2 * k * r)},0a${r1(k * r)},${r1(k * ry)} 0 1,0 ${r1(-2 * k * r)},0`)
            .join('')}
          fill="none"
          stroke={shade(color, 0.12)}
          strokeWidth={0.7 * ss}
          opacity={0.45}
        />
      )}
      {/* Fasen langs forkanten av toppen fanger lyset */}
      <path d={`M${r1(x - r)},${r1(top)}A${r1(r)},${r1(ry)} 0 0 0 ${r1(x + r)},${r1(top)}`} fill="none" stroke={SCENE.highlight} strokeWidth={1.3 * ss} opacity={0.7} />
      {symbol && d >= 34 && h >= 30 && (
        <Txt x={symbolX ?? x - 0.12 * r} y={top + 0.58 * h + fs * 0.35} px={fs} weight={700} color={shade(color, 0.5)} halo={false}>
          {symbol}
        </Txt>
      )}
      {hole && hr > 0 && (
        <>
          <ellipse cx={hx} cy={top} rx={hr} ry={hry} fill={shade(color, 0.72)} />
          <path d={`M${r1(hx - hr)},${r1(top)}A${r1(hr)},${r1(hry)} 0 0 1 ${r1(hx + hr)},${r1(top)}`} fill="none" stroke={shade(color, 0.5)} strokeWidth={0.9 * ss} />
        </>
      )}
      {children && (
        <>
          <clipPath id={`${id}-c`}>
            <rect x={x - 4000} y={top - 4000} width={8000} height={4000} />
          </clipPath>
          <g clipPath={`url(#${id}-c)`}>{children}</g>
        </>
      )}
      {hole && hr > 0 && (
        <path d={`M${r1(hx - hr)},${r1(top)}A${r1(hr)},${r1(hry)} 0 0 0 ${r1(hx + hr)},${r1(top)}`} fill="none" stroke={tint(color, 0.45)} strokeWidth={1.1 * ss} />
      )}
      <path d={side} fill="none" stroke={SCENE.outline} strokeWidth={1 * ss} strokeLinejoin="round" />
      <ellipse cx={x} cy={top} rx={r} ry={ry} fill="none" stroke={SCENE.outline} strokeWidth={1 * ss} />
    </g>
  );
}

/**
 * Varmepil: tykk, bølgete pil (som varmetapet i «Vannkoker eller kokeplate») fra (x, y) og `length` rett opp.
 * Lengden skal være proporsjonal med effekten (fast skala px/W i hele figuren).
 */
export function VarmePil({ x, y, length, color = VIZ.series[1], width = 5 }: { x: number; y: number; length: number; color?: string; width?: number }) {
  const ss = useStrokeScale();
  if (!(length > 2) || !Number.isFinite(x) || !Number.isFinite(y)) return null;
  const w = width * ss;
  const head = Math.min(length * 0.55, 3.2 * w);
  const shaft = Math.max(0, length - head * 0.85);
  const amp = Math.min(3.2 * ss, 0.08 * length + 0.6);
  const wl = 15 * ss;
  let d = `M${r1(x)},${r1(y)}`;
  const n = Math.max(2, Math.ceil(shaft / 2));
  for (let i = 1; i <= n; i++) {
    const s = (i / n) * shaft;
    // Bølgen dempes mot spissen, så pilhodet sitter rett
    const fade = Math.min(1, (shaft - s) / (0.6 * wl));
    d += `L${r1(x + amp * fade * Math.sin((2 * Math.PI * s) / wl))},${r1(y - s)}`;
  }
  const tip = y - length;
  const base = tip + head;
  const hw = 1.25 * w;
  const headPath = `M${r1(x - hw)},${r1(base)}L${r1(x)},${r1(tip)}L${r1(x + hw)},${r1(base)}Z`;
  return (
    <g aria-hidden>
      <path d={d} fill="none" stroke={VIZ.surface} strokeWidth={w + 4 * ss} strokeLinecap="round" strokeLinejoin="round" opacity={0.85} />
      <path d={headPath} fill={VIZ.surface} stroke={VIZ.surface} strokeWidth={4 * ss} strokeLinejoin="round" opacity={0.85} />
      <path d={d} fill="none" stroke={color} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" />
      <path d={headPath} fill={color} stroke={color} strokeWidth={1 * ss} strokeLinejoin="round" />
    </g>
  );
}
