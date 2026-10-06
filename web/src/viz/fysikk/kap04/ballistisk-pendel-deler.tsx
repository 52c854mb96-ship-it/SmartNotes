/**
 * Egne gjenstander til eksempeloppgaven «Ballistisk pendel» (k4-eks-ballistisk-pendel), tegnet i scene-kit-stilen
 * (toninger fra core.tsx, SCENE-farger, kontur og myke skygger): fremre del av et luftgevær, diabolokule, stativ
 * med tverrstang, ringskrue, sandpute, et innfelt panel med zoomring, et forstørret snitt av klossen og
 * energistolper. Ingen av dem finnes i scene-kit-et.
 */
import type { ReactNode } from 'react';
import { TSub, Txt, VIZ, fmt, useTextScale } from '../../kit';
import {
  ContactShadow,
  Dimension,
  ForceArrow,
  LinearGradient,
  PAINTS,
  RadialGradient,
  SCENE,
  alpha,
  materialStops,
  mix,
  sceneRandom,
  shade,
  tint,
  useStrokeScale,
  useSvgId,
} from '../../kit/scene';

const r2 = (v: number) => (Number.isFinite(v) ? Math.round(v * 100) / 100 : 0);

/** Bly i diabolokula: litt varmere og mørkere enn stål. */
const LEAD = mix(SCENE.metal, SCENE.metalDark, 0.45);

/* ================================================================================================
 * Luftgevær
 * ============================================================================================== */

/** Målene til luftgeværet i meter, fra munningen (x = 0 på løpets akse) og bakover (negativ x). */
export const AIR_RIFLE = {
  /** Løpet fra knekkpunktet til munningsvekta. */
  barrelStart: -0.4,
  rBarrel: 0.0085,
  /** Munningsvekta med siktet. */
  muzzleLen: 0.036,
  rMuzzle: 0.0112,
  /** Knekkpunktet (låsblokka) og sylinderen bak. */
  breechStart: -0.448,
  rCylinder: 0.0175,
  /** Fremre ende av forskjeftet i tre. */
  forendFront: -0.465,
  /** Undersiden av forskjeftet (under aksen). */
  forendBottom: 0.05,
} as const;

/**
 * Fremre del av et luftgevær (knekkgevær) sett fra siden, munningen mot høyre: sylinder og forskjefte i tre, låsblokk
 * med skrue, løp, munningsvekt og tunnelsikte. Ankerpunktet (x, y) er munningen på løpets akse, `P` er piksler per
 * meter. Resten av geværet ligger utenfor figuren til venstre.
 */
export function Luftgevaer({ x, y, P, title }: { x: number; y: number; P: number; title?: string }) {
  const id = useSvgId('luftgevaer');
  const ss = useStrokeScale();
  const X = (m: number) => r2(x + m * P);
  const Y = (m: number) => r2(y + m * P);
  const A = AIR_RIFLE;
  const back = -1.2; // langt utenfor figuren
  const steel = shade(SCENE.metalDark, 0.12);
  return (
    <g>
      {title && <title>{title}</title>}
      <LinearGradient
        id={`${id}m`}
        stops={[
          [0, tint(steel, 0.32)],
          [0.28, steel],
          [0.62, shade(steel, 0.25)],
          [1, shade(steel, 0.55)],
        ]}
      />
      <LinearGradient
        id={`${id}w`}
        stops={[
          [0, tint(SCENE.wood, 0.2)],
          [0.45, SCENE.wood],
          [1, shade(SCENE.woodDark, 0.25)],
        ]}
      />
      {/* Sylinderen (stempel og fjær) bak knekkpunktet */}
      <rect
        x={X(back)}
        y={Y(-A.rCylinder)}
        width={r2((A.breechStart - back) * P)}
        height={r2(2 * A.rCylinder * P)}
        fill={`url(#${id}m)`}
        stroke={SCENE.outline}
        strokeWidth={0.9 * ss}
      />
      <line
        x1={X(back)}
        y1={Y(-A.rCylinder * 0.55)}
        x2={X(A.breechStart - 0.004)}
        y2={Y(-A.rCylinder * 0.55)}
        stroke={SCENE.highlight}
        strokeWidth={1 * ss}
        opacity={0.55}
      />
      {/* Forskjeftet i tre under sylinderen */}
      <path
        d={`M${X(back)},${Y(-0.002)} L${X(A.forendFront - 0.03)},${Y(-0.002)} Q${X(A.forendFront + 0.004)},${Y(0.0)} ${X(A.forendFront + 0.006)},${Y(0.022)} Q${X(A.forendFront + 0.004)},${Y(A.forendBottom - 0.004)} ${X(A.forendFront - 0.03)},${Y(A.forendBottom)} L${X(back)},${Y(A.forendBottom + 0.008)} Z`}
        fill={`url(#${id}w)`}
        stroke={SCENE.outline}
        strokeWidth={0.9 * ss}
        strokeLinejoin="round"
      />
      <path
        d={`M${X(back)},${Y(0.004)} L${X(A.forendFront - 0.035)},${Y(0.004)}`}
        stroke={SCENE.highlight}
        strokeWidth={1 * ss}
        opacity={0.45}
      />
      {/* Riller for grepet i forskjeftet */}
      <path
        d={Array.from({ length: 7 }, (_, i) => {
          const a = A.forendFront - 0.07 - i * 0.012;
          return `M${X(a)},${Y(0.016)} L${X(a - 0.008)},${Y(0.04)}`;
        }).join(' ')}
        stroke={shade(SCENE.woodDark, 0.2)}
        strokeWidth={0.8 * ss}
        opacity={0.55}
      />
      {/* Låsblokka ved knekkpunktet, med skruen løpet dreier om */}
      <rect
        x={X(A.breechStart)}
        y={Y(-0.0135)}
        width={r2((A.barrelStart - A.breechStart) * P)}
        height={r2(0.0285 * P)}
        rx={r2(0.004 * P)}
        fill={`url(#${id}m)`}
        stroke={SCENE.outline}
        strokeWidth={0.9 * ss}
      />
      <circle cx={X(A.breechStart + 0.016)} cy={Y(0.006)} r={r2(Math.max(1.8, 0.0045 * P))} fill={tint(steel, 0.25)} stroke={SCENE.outline} strokeWidth={0.7 * ss} />
      {/* Løpet */}
      <rect
        x={X(A.barrelStart - 0.002)}
        y={Y(-A.rBarrel)}
        width={r2((-A.barrelStart - A.muzzleLen + 0.004) * P)}
        height={r2(2 * A.rBarrel * P)}
        fill={`url(#${id}m)`}
        stroke={SCENE.outline}
        strokeWidth={0.9 * ss}
      />
      <line
        x1={X(A.barrelStart + 0.004)}
        y1={Y(-A.rBarrel * 0.45)}
        x2={X(-A.muzzleLen - 0.004)}
        y2={Y(-A.rBarrel * 0.45)}
        stroke={SCENE.highlight}
        strokeWidth={1 * ss}
        strokeLinecap="round"
        opacity={0.6}
      />
      {/* Munningsvekta med tunnelsikte (fremre sikte) */}
      <path
        d={`M${X(-A.muzzleLen + 0.004)},${Y(-A.rMuzzle - 0.002)} L${X(-A.muzzleLen + 0.008)},${Y(-A.rMuzzle - 0.016)} L${X(-0.006)},${Y(-A.rMuzzle - 0.016)} L${X(-0.004)},${Y(-A.rMuzzle - 0.002)} Z`}
        fill={shade(steel, 0.2)}
        stroke={SCENE.outline}
        strokeWidth={0.8 * ss}
        strokeLinejoin="round"
      />
      <rect
        x={X(-A.muzzleLen)}
        y={Y(-A.rMuzzle)}
        width={r2(A.muzzleLen * P)}
        height={r2(2 * A.rMuzzle * P)}
        rx={r2(0.003 * P)}
        fill={`url(#${id}m)`}
        stroke={SCENE.outline}
        strokeWidth={0.9 * ss}
      />
      <line x1={X(-A.muzzleLen + 0.004)} y1={Y(-A.rMuzzle * 0.5)} x2={X(-0.004)} y2={Y(-A.rMuzzle * 0.5)} stroke={SCENE.highlight} strokeWidth={1 * ss} opacity={0.5} />
      {/* Munningen: litt mørkere endeflate */}
      <rect x={X(-0.002)} y={Y(-A.rMuzzle + 0.001)} width={r2(Math.max(1.2, 0.002 * P))} height={r2((2 * A.rMuzzle - 0.002) * P)} fill={shade(steel, 0.45)} />
    </g>
  );
}

/**
 * Sandpute som geværet hviler på: en avlang pute i lerret med et søkk på toppen. (x, y) er midt på bunnen.
 */
export function Sandpute({ x, y, w, h }: { x: number; y: number; w: number; h: number }) {
  const id = useSvgId('sandpute');
  const ss = useStrokeScale();
  const c = mix(SCENE.woodLight, SCENE.grassDark, 0.42);
  const d = `M${r2(x - w / 2)},${r2(y)}Q${r2(x - w / 2 - w * 0.06)},${r2(y - h * 0.55)} ${r2(x - w * 0.42)},${r2(y - h)}Q${r2(x - w * 0.15)},${r2(y - h * 1.04)} ${r2(x)},${r2(y - h * 0.84)}Q${r2(x + w * 0.15)},${r2(y - h * 1.04)} ${r2(x + w * 0.42)},${r2(y - h)}Q${r2(x + w / 2 + w * 0.06)},${r2(y - h * 0.55)} ${r2(x + w / 2)},${r2(y)}Z`;
  return (
    <g aria-hidden>
      <ContactShadow cx={x} cy={y} rx={w * 0.56} ry={Math.max(2, h * 0.12)} />
      <LinearGradient id={id} stops={materialStops(c, 1.2)} />
      <path d={d} fill={`url(#${id})`} stroke={SCENE.outline} strokeWidth={0.8 * ss} strokeLinejoin="round" />
      <path
        d={`M${r2(x - w * 0.36)},${r2(y - h * 0.48)}Q${r2(x)},${r2(y - h * 0.34)} ${r2(x + w * 0.36)},${r2(y - h * 0.48)}`}
        fill="none"
        stroke={shade(c, 0.3)}
        strokeWidth={0.8 * ss}
        strokeDasharray={`${2.5 * ss} ${2 * ss}`}
        opacity={0.7}
      />
    </g>
  );
}

/* ================================================================================================
 * Kula
 * ============================================================================================== */

/**
 * Diabolokule (luftgeværkule i bly) sett fra siden, hodet mot høyre: rundt hode, smal midje og et skjørt som vider
 * seg ut bak. (x, y) er midten, `len` lengden i figurens enheter (diameteren blir 0,8 · len).
 */
export function Diabolokule({ x, y, len, title }: { x: number; y: number; len: number; title?: string }) {
  const id = useSvgId('diabolo');
  const ss = useStrokeScale();
  const L = Math.max(4, len);
  const D = 0.8 * L;
  const X = (k: number) => r2(x + k * L);
  const Yt = (k: number) => r2(y - k * D);
  const Yb = (k: number) => r2(y + k * D);
  const d = [
    `M${X(-0.5)},${Yt(0.5)}`,
    `L${X(-0.06)},${Yt(0.31)}`,
    `L${X(0.08)},${Yt(0.47)}`,
    `Q${X(0.5)},${Yt(0.47)} ${X(0.5)},${r2(y)}`,
    `Q${X(0.5)},${Yb(0.47)} ${X(0.08)},${Yb(0.47)}`,
    `L${X(-0.06)},${Yb(0.31)}`,
    `L${X(-0.5)},${Yb(0.5)}`,
    'Z',
  ].join(' ');
  return (
    <g>
      {title && <title>{title}</title>}
      <LinearGradient
        id={id}
        stops={[
          [0, tint(LEAD, 0.45)],
          [0.32, tint(LEAD, 0.12)],
          [0.7, LEAD],
          [1, shade(LEAD, 0.45)],
        ]}
      />
      <path d={d} fill={`url(#${id})`} stroke={shade(LEAD, 0.55)} strokeWidth={Math.min(1, 0.06 * L) * ss} strokeLinejoin="round" />
      {L >= 10 && (
        <>
          {/* Kanten mellom hodet og midjen, og det hule skjørtet bak */}
          <line x1={X(0.08)} y1={Yt(0.45)} x2={X(0.08)} y2={Yb(0.45)} stroke={shade(LEAD, 0.4)} strokeWidth={0.8 * ss} opacity={0.6} />
          <ellipse cx={X(-0.49)} cy={r2(y)} rx={r2(0.05 * L)} ry={r2(0.44 * D)} fill={shade(LEAD, 0.6)} opacity={0.8} />
          <path
            d={`M${X(0.14)},${Yt(0.32)} Q${X(0.38)},${Yt(0.34)} ${X(0.44)},${Yt(0.12)}`}
            fill="none"
            stroke={SCENE.highlight}
            strokeWidth={Math.max(0.8, 0.04 * L) * ss}
            strokeLinecap="round"
            opacity={0.75}
          />
        </>
      )}
    </g>
  );
}

/* ================================================================================================
 * Stativet og klossen
 * ============================================================================================== */

/**
 * Laboratoriestativ: tung fot på benken, loddrett stang, muffe og en vannrett tverrstang som peker mot venstre
 * (der pendelen henger). `rodX` er midten av stanga, `footY` benkeplata, `topY` toppen av stanga, `armY` midten av
 * tverrstanga og `armLeft` venstre ende av den. `P` er piksler per meter.
 */
export function Pendelstativ({
  rodX,
  footY,
  topY,
  armY,
  armLeft,
  P,
}: {
  rodX: number;
  footY: number;
  topY: number;
  armY: number;
  armLeft: number;
  P: number;
}) {
  const id = useSvgId('stativ');
  const ss = useStrokeScale();
  const rRod = Math.max(2.6, 0.0065 * P);
  const rArm = Math.max(2.2, 0.0055 * P);
  const footH = Math.max(6, 0.018 * P);
  const footL = rodX - 0.17 * P;
  const footR = rodX + 0.05 * P;
  const paint = shade(PAINTS.blaa, 0.25);
  const boss = { w: Math.max(12, 0.034 * P), h: Math.max(14, 0.04 * P) };
  return (
    <g aria-hidden>
      <LinearGradient
        id={`${id}r`}
        x2={1}
        y2={0}
        stops={[
          [0, shade(SCENE.metal, 0.15)],
          [0.3, tint(SCENE.metalLight, 0.2)],
          [0.65, SCENE.metal],
          [1, shade(SCENE.metal, 0.35)],
        ]}
      />
      <LinearGradient
        id={`${id}a`}
        stops={[
          [0, tint(SCENE.metalLight, 0.2)],
          [0.4, SCENE.metal],
          [1, shade(SCENE.metal, 0.35)],
        ]}
      />
      <LinearGradient id={`${id}f`} stops={materialStops(paint, 1)} />
      <LinearGradient id={`${id}b`} stops={materialStops(shade(SCENE.metalDark, 0.1), 1)} />
      {/* Foten */}
      <ContactShadow cx={(footL + footR) / 2} cy={footY} rx={(footR - footL) * 0.56} ry={3} />
      <path
        d={`M${r2(footL)},${r2(footY)} L${r2(footL + footH * 0.5)},${r2(footY - footH)} L${r2(footR - footH * 0.3)},${r2(footY - footH)} L${r2(footR)},${r2(footY)} Z`}
        fill={`url(#${id}f)`}
        stroke={SCENE.outline}
        strokeWidth={0.9 * ss}
        strokeLinejoin="round"
      />
      <line x1={footL + footH * 0.6} y1={footY - footH + 1.2 * ss} x2={footR - footH * 0.4} y2={footY - footH + 1.2 * ss} stroke={SCENE.highlight} strokeWidth={1 * ss} opacity={0.5} />
      {/* Stanga */}
      <rect x={r2(rodX - rRod)} y={r2(topY)} width={r2(2 * rRod)} height={r2(footY - footH - topY + 1)} rx={r2(rRod * 0.5)} fill={`url(#${id}r)`} stroke={SCENE.outline} strokeWidth={0.9 * ss} />
      {/* Tverrstanga med endelokk */}
      <rect x={r2(armLeft)} y={r2(armY - rArm)} width={r2(rodX - armLeft)} height={r2(2 * rArm)} rx={r2(rArm)} fill={`url(#${id}a)`} stroke={SCENE.outline} strokeWidth={0.9 * ss} />
      {/* Muffen med vingeskrue */}
      <rect
        x={r2(rodX - boss.w / 2)}
        y={r2(armY - boss.h / 2)}
        width={r2(boss.w)}
        height={r2(boss.h)}
        rx={2}
        fill={`url(#${id}b)`}
        stroke={SCENE.outline}
        strokeWidth={0.9 * ss}
      />
      <rect x={r2(rodX + boss.w / 2)} y={r2(armY - 1.5)} width={r2(boss.w * 0.35)} height={3} fill={shade(SCENE.metalDark, 0.2)} />
      <rect
        x={r2(rodX + boss.w * 0.85)}
        y={r2(armY - boss.h * 0.42)}
        width={r2(Math.max(3, boss.w * 0.22))}
        height={r2(boss.h * 0.84)}
        rx={1.5}
        fill={shade(SCENE.metalDark, 0.05)}
        stroke={SCENE.outline}
        strokeWidth={0.7 * ss}
      />
    </g>
  );
}

/** Ringskrue i klossen som snora er knyttet i. (x, y) er der skruen går inn i treet; ringen er over. */
export function Ringskrue({ x, y, r }: { x: number; y: number; r: number }) {
  const ss = useStrokeScale();
  return (
    <g aria-hidden>
      <line x1={x} y1={y + 1} x2={x} y2={y - r * 0.9} stroke={SCENE.metalDark} strokeWidth={Math.max(1.2, r * 0.5) * ss} strokeLinecap="round" />
      <circle cx={x} cy={y - r * 1.9} r={r} fill="none" stroke={SCENE.outline} strokeWidth={(r * 0.45 + 1.1) * ss} />
      <circle cx={x} cy={y - r * 1.9} r={r} fill="none" stroke={SCENE.metal} strokeWidth={r * 0.45 * ss} />
    </g>
  );
}

/* ================================================================================================
 * Innfelt panel og zoomring
 * ============================================================================================== */

/** Innfelt panel (kort) med tittel, til forstørrelser og diagrammer inne i scenen. (x, y) er øverste venstre hjørne. */
export function Innfelt({ x, y, w, h, title, children }: { x: number; y: number; w: number; h: number; title: ReactNode; children: ReactNode }) {
  const ss = useStrokeScale();
  const f = useTextScale();
  return (
    <g>
      <rect x={x + 3} y={y + 4} width={w} height={h} rx={10} fill={alpha(SCENE.shadow, 0.35)} />
      <rect x={x} y={y} width={w} height={h} rx={10} fill={VIZ.surface} opacity={0.97} stroke={SCENE.outline} strokeWidth={1 * ss} />
      <Txt x={x + 12} y={y + 8 + 15 * f} anchor="start" size={0.85} weight={700}>
        {title}
      </Txt>
      {children}
    </g>
  );
}

/** Høyden på tittellinja i et innfelt panel (figurens enheter). */
export const innfeltTittel = (f: number) => 16 + 17 * f;

/** Ring rundt det som er forstørret i panelet, med en strek til panelet. */
export function Zoomring({ cx, cy, r, tx, ty }: { cx: number; cy: number; r: number; tx: number; ty: number }) {
  const ss = useStrokeScale();
  const dx = tx - cx;
  const dy = ty - cy;
  const len = Math.hypot(dx, dy) || 1;
  const sx = cx + (dx / len) * r;
  const sy = cy + (dy / len) * r;
  return (
    <g aria-hidden>
      <line x1={sx} y1={sy} x2={tx} y2={ty} stroke={VIZ.surface} strokeWidth={4 * ss} opacity={0.8} />
      <line x1={sx} y1={sy} x2={tx} y2={ty} stroke={VIZ.ink} strokeWidth={1.4 * ss} strokeDasharray={`${4 * ss} ${3 * ss}`} />
      <circle cx={cx} cy={cy} r={r} fill="none" stroke={VIZ.surface} strokeWidth={4.5 * ss} opacity={0.8} />
      <circle cx={cx} cy={cy} r={r} fill="none" stroke={VIZ.ink} strokeWidth={1.8 * ss} />
    </g>
  );
}

/* ================================================================================================
 * Forstørret snitt: kula stopper i klossen
 * ============================================================================================== */

export type SnittVisning = 'kraft' | 'kraftpar' | 'impulser' | 'arbeid';

export interface SnittProps {
  /** Innholdsflaten i panelet (under tittelen). */
  x: number;
  y: number;
  w: number;
  h: number;
  /** Hvor langt kula trenger inn til slutt (m), og diameteren til kula (m). */
  depth: number;
  caliber: number;
  visning: SnittVisning;
  /** Tallene som vises: kraften (N), impulsene (kg·m/s), flyttingen av klossen (m). */
  F: number;
  dp: number;
  sBlock: number;
}

/**
 * Forstørret snitt gjennom venstre ende av klossen: kula borer seg inn i treet. «kraft»: kraften på kula, «kraftpar»:
 * også kraften på klossen, «impulser»: impulsene, «arbeid»: kula har stoppet, med inntrengningen d og varmen rundt
 * kanalen. Skalaen velges så hele inntrengningen får plass.
 */
export function KlossSnitt({ x, y, w, h, depth, caliber, visning, F, dp, sBlock }: SnittProps) {
  const id = useSvgId('snitt');
  const ss = useStrokeScale();
  const f = useTextScale();
  const face = x + 0.2 * w;
  // Plass til inntrengningen og en kraftpil etter kula
  const Q = (0.8 * w - 24) / (depth + 0.0045);
  const len = 1.25 * caliber * Q;
  const D = 0.8 * len;
  const done = visning === 'arbeid';
  const nose = face + (done ? depth : 0.56 * depth) * Q;
  const mid = nose - len / 2;
  const tail = nose - len;
  const axis = y + h * (done ? 0.5 : 0.42);
  const wood = mix(SCENE.wood, SCENE.woodLight, 0.4);

  // Fiberlinjer langs klossen (fast frø), og en kanal med frynsete kanter bak kula
  const rnd = sceneRandom(7);
  const lines: string[] = [];
  for (let yy = y + 6; yy < y + h; yy += 7 + rnd() * 5) {
    let d = `M${r2(face + 2)},${r2(yy)}`;
    const steps = 6;
    for (let i = 1; i <= steps; i++) {
      const xx = face + 2 + ((x + w - face - 2) * i) / steps;
      d += ` L${r2(xx)},${r2(yy + (rnd() - 0.5) * 2.2)}`;
    }
    lines.push(d);
  }
  const end = tail + len * 0.12;
  const jag = (sign: 1 | -1): [number, number][] => {
    const r = sceneRandom(sign > 0 ? 3 : 5);
    const n = Math.max(4, Math.round((end - face) / 7));
    return Array.from({ length: n + 1 }, (_, i) => [face + ((end - face) * i) / n, axis + sign * (D * 0.5 + 1 + r() * D * 0.12)]);
  };
  const pts = [...jag(-1), ...jag(1).reverse()];
  const channel = `${pts.map(([px, py], i) => `${i === 0 ? 'M' : 'L'}${r2(px)},${r2(py)}`).join(' ')} Z`;

  const arrowLen = Math.min(0.22 * w, 92);
  const arrowY = axis;
  const labelY = axis - D / 2 - 10 * f;
  return (
    <g>
      <defs>
        <clipPath id={`${id}c`}>
          <rect x={x} y={y} width={w} height={h} rx={6} />
        </clipPath>
      </defs>
      <LinearGradient id={`${id}w`} stops={materialStops(wood, 0.7)} />
      <RadialGradient
        id={`${id}h`}
        stops={[
          [0, SCENE.hot, 0.55],
          [0.55, SCENE.warm, 0.35],
          [1, SCENE.warm, 0],
        ]}
      />
      <g clipPath={`url(#${id}c)`}>
        {/* Lufta foran klossen */}
        <rect x={x} y={y} width={face - x} height={h} fill={alpha(SCENE.wall, 0.6)} />
        {/* Treverket i snitt */}
        <rect x={face} y={y} width={x + w - face} height={h} fill={`url(#${id}w)`} />
        <path d={lines.join(' ')} fill="none" stroke={shade(wood, 0.38)} strokeWidth={0.9 * ss} opacity={0.45} />
        {done && <ellipse cx={(face + nose) / 2} cy={axis} rx={(nose - face) / 2 + D * 0.9} ry={D * 1.35} fill={`url(#${id}h)`} />}
        {/* Kanalen kula har boret, med opprevne fibrer */}
        <path d={channel} fill={shade(wood, 0.62)} stroke={shade(wood, 0.75)} strokeWidth={0.8 * ss} strokeLinejoin="round" />
        <rect x={face - 1.5} y={y} width={3} height={h} fill={shade(wood, 0.3)} />
        <Diabolokule x={mid} y={axis} len={len} />
      </g>
      <Txt x={x + (face - x) / 2} y={y + h - 8} size={0.72} muted>
        luft
      </Txt>
      <Txt x={x + w - 8} y={y + h - 8} anchor="end" size={0.72} muted>
        treverket i klossen
      </Txt>

      {!done && (
        <>
          {/* Kraften fra klossen på kula, mot venstre */}
          <ForceArrow x1={mid} y1={arrowY} x2={mid - arrowLen} y2={arrowY} color={VIZ.applied} width={6} label="F" labelX={mid - arrowLen / 2} labelY={labelY} labelAnchor="middle" origin />
          <Txt x={mid - arrowLen / 2} y={axis + D / 2 + 20 * f} size={0.72} weight={650} color={VIZ.applied}>
            på kula
          </Txt>
        </>
      )}
      {(visning === 'kraftpar' || visning === 'impulser') && (
        <>
          {/* Kraften fra kula på klossen, mot høyre (Newtons 3. lov) */}
          <ForceArrow x1={nose} y1={arrowY} x2={nose + arrowLen} y2={arrowY} color={VIZ.applied} width={6} label="F" labelX={nose + arrowLen / 2} labelY={labelY} labelAnchor="middle" />
          <Txt x={nose + arrowLen / 2} y={axis + D / 2 + 20 * f} size={0.72} weight={650} color={VIZ.applied}>
            på klossen
          </Txt>
        </>
      )}
      {visning === 'kraft' && (
        <Txt x={x + w - 10} y={y + 18 * f} anchor="end" size={0.78} weight={650}>
          F = {fmt(F, 0)} N
        </Txt>
      )}
      {visning === 'kraftpar' && (
        <Txt x={x + w - 10} y={y + 18 * f} anchor="end" size={0.78} weight={650}>
          Klossen flytter seg {fmt(sBlock * 1000, 2)} mm
        </Txt>
      )}
      {visning === 'impulser' && (
        <>
          <Txt x={x + 10} y={y + 18 * f} anchor="start" size={0.76} weight={650}>
            Kula: Δp = {fmt(-Math.abs(dp), 4)} kg·m/s
          </Txt>
          <Txt x={x + 10} y={y + 40 * f} anchor="start" size={0.76} weight={650}>
            Klossen: Δp = +{fmt(Math.abs(dp), 4)} kg·m/s
          </Txt>
        </>
      )}
      {done && (
        <>
          <Dimension x1={face} y1={axis - D / 2 - 6} x2={nose} y2={axis - D / 2 - 6} offset={6 + 4 * f} label={<>d = {fmt(depth * 100, 1)} cm</>} />
          <Txt x={(face + nose) / 2} y={axis + D * 1.35 + 14 * f} size={0.74} weight={650} color={shade(SCENE.hot, 0.1)}>
            varme og opprevet treverk
          </Txt>
        </>
      )}
    </g>
  );
}

/* ================================================================================================
 * Energistolper
 * ============================================================================================== */

/**
 * To liggende stolper for kinetisk energi før og etter støtet. Med `tapt` vises energien som er omdannet, skravert,
 * så «etter»-stolpen blir like lang som «før»-stolpen. (x, y, w, h) er innholdsflaten i panelet.
 */
export function EnergiStolper({ x, y, w, h, before, after, tapt }: { x: number; y: number; w: number; h: number; before: number; after: number; tapt: boolean }) {
  const hatch = useSvgId('pendel-tapt');
  const ss = useStrokeScale();
  const f = useTextScale();
  const line = 17 * f;
  const labelW = 54 * f;
  const valueW = 70 * f;
  const x0 = x + labelW;
  const x1 = x + w - valueW;
  const k = before > 0 ? (x1 - x0) / before : 0;
  const barH = Math.round(18 + 4 * f);
  const gap = Math.max(14, h * 0.1);
  const y1 = y + 6;
  const y2 = y1 + barH + gap;
  const wAfter = Math.max(2.5, after * k);
  const lost = before - after;
  const share = before > 0 ? lost / before : 0;
  const row = (yy: number, label: string) => (
    <Txt x={x} y={yy + barH / 2 + line * 0.3} anchor="start" size={0.82} muted>
      {label}
    </Txt>
  );
  const value = (yy: number, text: string) => (
    <Txt x={x1 + 8} y={yy + barH / 2 + line * 0.3} anchor="start" size={0.82} weight={700}>
      {text}
    </Txt>
  );
  const ly = y2 + barH + 10 + line * 0.8;
  const sw = 10 * f;
  return (
    <g>
      <defs>
        <pattern id={hatch} width={8} height={8} patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <rect width={8} height={8} fill={alpha(VIZ.muted, 0.08)} />
          <line x1={0} y1={0} x2={0} y2={8} stroke={VIZ.muted} strokeWidth={2.2} opacity={0.6} />
        </pattern>
      </defs>
      {row(y1, 'Før')}
      <rect x={x0} y={y1} width={r2(before * k)} height={barH} fill={VIZ.velocity} stroke={SCENE.outline} strokeWidth={1 * ss} />
      {value(y1, `${fmt(before, 2)} J`)}
      {row(y2, 'Etter')}
      {tapt && (
        <g>
          <rect x={x0 + wAfter} y={y2} width={r2(Math.max(0, x1 - x0 - wAfter))} height={barH} fill={`url(#${hatch})`} />
          <rect
            x={x0 + wAfter + 0.75}
            y={y2 + 0.75}
            width={r2(Math.max(0, x1 - x0 - wAfter - 1.5))}
            height={barH - 1.5}
            fill="none"
            stroke={VIZ.muted}
            strokeWidth={1.3 * ss}
            strokeDasharray="5 3"
          />
        </g>
      )}
      <rect x={x0} y={y2} width={r2(wAfter)} height={barH} fill={VIZ.velocity} stroke={SCENE.outline} strokeWidth={1 * ss} />
      {value(y2, `${fmt(after, after < 0.1 ? 3 : 2)} J`)}
      {/* Forklaring under stolpene */}
      <circle cx={x0 + sw / 2} cy={ly - line * 0.3} r={sw / 2} fill={VIZ.velocity} stroke={SCENE.outline} strokeWidth={1 * ss} />
      <Txt x={x0 + sw + 6} y={ly} anchor="start" size={0.78}>
        kinetisk energi E<TSub>k</TSub>
      </Txt>
      {tapt && (
        <>
          <rect x={x0} y={ly + line * 0.95 - sw * 0.8} width={sw} height={sw} fill={`url(#${hatch})`} stroke={VIZ.muted} strokeWidth={1 * ss} />
          <Txt x={x0 + sw + 6} y={ly + line * 0.95} anchor="start" size={0.78} weight={650}>
            omdannet: {fmt(lost, 2)} J ({fmt(share * 100, 1)} %)
          </Txt>
        </>
      )}
    </g>
  );
}
