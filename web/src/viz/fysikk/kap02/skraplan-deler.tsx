/**
 * Egne gjenstander til «Kloss på skråplan» (2A, 2C, 2E) som scene-kit-et ikke har: et vippbart skråplan fra
 * fysikklaben. En høvlet treplanke er hengslet til en bunnplate, og en gradskive i akryl med låseskrue holder
 * planken på vinkelen. Samme stil som scene-kit-et: toninger fra core, SCENE-farger, tynn kontur og myk skygge.
 */
import { Txt } from '../../kit';
import {
  ContactShadow,
  LinearGradient,
  Place,
  RadialGradient,
  SCENE,
  alpha,
  materialStops,
  mix,
  shade,
  sphereStops,
  tint,
  useStrokeScale,
  useSvgId,
} from '../../kit/scene';

const DEG = Math.PI / 180;
const r2 = (v: number) => (Number.isFinite(v) ? Math.round(v * 100) / 100 : 0);
const pt = (x: number, y: number) => `${r2(x)},${r2(y)}`;

export interface VippeplanProps {
  /** Hengselet: det nederste hjørnet av planken, oppå bunnplata. Planken stiger mot høyre herfra. */
  x: number;
  y: number;
  /** Lengden på planken (figurens enheter). */
  lengde: number;
  /** Tykkelsen på planken. */
  tykkelse: number;
  /** Vinkelen mellom planken og bunnplata (grader, 0–90). */
  vinkel: number;
  /** Radius på gradskiva (sentrum i hengselet). Låseskruen sitter i sporet, 0,9 · radius fra hengselet. */
  skive: number;
  /** Tykkelsen på bunnplata; benken er i y + bunn. */
  bunn: number;
  /** Stoppeklossen nederst på planken: bredde langs planken og høyde over plankeflaten. */
  stopp: { bredde: number; hoyde: number };
}

/** Hvor låseskruen sitter langs planken, som andel av radiusen på gradskiva. */
export const SLOT_FRACTION = 0.9;

/**
 * Vippbart skråplan: bunnplate, gradskive (bak), planke med stoppekloss, låseskrue og hengsel. Ankerpunkt: (x, y) er
 * hengselet. Tegn klossen etterpå, oppå planken.
 */
export function Vippeplan({ x, y, lengde, tykkelse, vinkel, skive, bunn, stopp }: VippeplanProps) {
  const ss = useStrokeScale();
  const id = useSvgId('vippeplan');
  const deg = Math.min(90, Math.max(0, Number.isFinite(vinkel) ? vinkel : 0));
  const th = deg * DEG;
  const u = { x: Math.cos(th), y: -Math.sin(th) };
  const n = { x: -Math.sin(th), y: -Math.cos(th) };
  const L = lengde;
  const t = tykkelse;
  const baseL = x - 18;
  const baseR = x + L + 14;
  const slotR = skive * SLOT_FRACTION;
  const knob = { x: x + u.x * slotR + n.x * (t / 2), y: y + u.y * slotR + n.y * (t / 2) };
  const plankWood = mix(SCENE.woodLight, SCENE.wood, 0.15);
  const grain = shade(plankWood, 0.32);

  return (
    <g>
      <ContactShadow cx={(baseL + baseR) / 2} cy={y + bunn} rx={(baseR - baseL) * 0.54} ry={5} opacity={0.75} />
      <Gradskive x={x} y={y} r={skive} slot={slotR} />

      {/* Bunnplata */}
      <LinearGradient id={`${id}b`} stops={materialStops(shade(SCENE.wood, 0.08), 0.8)} />
      <rect x={baseL} y={y} width={baseR - baseL} height={bunn} rx={1.5} fill={`url(#${id}b)`} stroke={SCENE.outline} strokeWidth={0.9 * ss} />
      <line x1={baseL + 2} y1={y + 0.8 * ss} x2={baseR - 2} y2={y + 0.8 * ss} stroke={SCENE.highlight} strokeWidth={1.1 * ss} strokeLinecap="round" />
      <path
        d={`M${pt(baseL + (baseR - baseL) * 0.08, y + bunn * 0.55)} q${r2((baseR - baseL) * 0.2)},${r2(-bunn * 0.15)} ${r2((baseR - baseL) * 0.42)},0 t${r2((baseR - baseL) * 0.42)},0`}
        fill="none"
        stroke={shade(SCENE.wood, 0.4)}
        strokeWidth={0.6 * ss}
        opacity={0.45}
      />

      {/* Planken med stoppekloss, dreid om hengselet */}
      <Place x={x} y={y} rotate={-deg}>
        <LinearGradient id={`${id}p`} stops={materialStops(plankWood, 0.7)} />
        <LinearGradient id={`${id}s`} stops={materialStops(shade(SCENE.wood, 0.12), 0.8)} />
        <rect x={0} y={-t} width={L} height={t} rx={1} fill={`url(#${id}p)`} />
        <path
          d={`M${pt(L * 0.05, -t * 0.42)} q${r2(L * 0.16)},${r2(-t * 0.14)} ${r2(L * 0.32)},0 t${r2(L * 0.32)},0 t${r2(L * 0.28)},0 M${pt(L * 0.22, -t * 0.72)} q${r2(L * 0.12)},${r2(t * 0.1)} ${r2(L * 0.24)},0 t${r2(L * 0.3)},0`}
          fill="none"
          stroke={grain}
          strokeWidth={0.6 * ss}
          opacity={0.5}
        />
        {/* Endeved øverst */}
        <rect x={L - 2.5} y={-t} width={2.5} height={t} fill={shade(plankWood, 0.18)} />
        <rect x={0} y={-t} width={L} height={t} rx={1} fill="none" stroke={SCENE.outline} strokeWidth={0.9 * ss} />
        <line x1={stopp.bredde + 2} y1={-t + 0.8 * ss} x2={L - 3} y2={-t + 0.8 * ss} stroke={SCENE.highlight} strokeWidth={1.2 * ss} strokeLinecap="round" />
        {/* Stoppeklossen */}
        <rect x={0} y={-t - stopp.hoyde} width={stopp.bredde} height={stopp.hoyde + t} rx={1} fill={`url(#${id}s)`} stroke={SCENE.outline} strokeWidth={0.8 * ss} />
        <line x1={1} y1={-t - stopp.hoyde + 0.8 * ss} x2={stopp.bredde - 1} y2={-t - stopp.hoyde + 0.8 * ss} stroke={SCENE.highlight} strokeWidth={1 * ss} />
      </Place>

      {/* Låseskruen i sporet på gradskiva */}
      <Laaseskrue x={knob.x} y={knob.y} r={6.2} />
      {/* Hengselet */}
      <Hengsel x={x} y={y} r={4.6} />
    </g>
  );
}

/**
 * Gradskive i akryl: en kvart sirkel med sentrum i hengselet, streker for hver 5. grad og tall for hver 30. grad,
 * og et buet spor der låseskruen går. (x, y) er sentrum.
 */
function Gradskive({ x, y, r, slot }: { x: number; y: number; r: number; slot: number }) {
  const ss = useStrokeScale();
  const id = useSvgId('gradskive');
  const edge = SCENE.glassEdge;
  const ticks = [];
  for (let d = 0; d <= 90; d += 5) {
    const big = d % 30 === 0;
    const mid = d % 15 === 0;
    const len = big ? 11 : mid ? 8 : 5;
    const c = Math.cos(d * DEG);
    const s = Math.sin(d * DEG);
    ticks.push(`M${pt(x + c * r, y - s * r)}L${pt(x + c * (r - len), y - s * (r - len))}`);
  }
  // Sporet: fra 2° til 88°
  const a0 = 2 * DEG;
  const a1 = 88 * DEG;
  const slotPath = `M${pt(x + Math.cos(a0) * slot, y - Math.sin(a0) * slot)} A${r2(slot)},${r2(slot)} 0 0 0 ${pt(x + Math.cos(a1) * slot, y - Math.sin(a1) * slot)}`;
  const labelR = r - 24;
  return (
    <g aria-hidden>
      <RadialGradient
        id={id}
        userSpace
        cx={x}
        cy={y}
        r={r}
        stops={[
          [0, SCENE.glass, 0.18],
          [0.85, SCENE.glass, 0.3],
          [1, tint(SCENE.glass, 0.2), 0.45],
        ]}
      />
      <path d={`M${pt(x, y)} L${pt(x + r, y)} A${r2(r)},${r2(r)} 0 0 0 ${pt(x, y - r)} Z`} fill={`url(#${id})`} stroke={edge} strokeWidth={1.1 * ss} strokeLinejoin="round" />
      {/* Lys kant langs buen (akrylen fanger lyset) */}
      <path d={`M${pt(x + r - 1.5, y)} A${r2(r - 1.5)},${r2(r - 1.5)} 0 0 0 ${pt(x, y - r + 1.5)}`} fill="none" stroke={SCENE.highlight} strokeWidth={1.2 * ss} />
      <path d={slotPath} fill="none" stroke={alpha(shade(edge, 0.35), 0.55)} strokeWidth={4.5 * ss} strokeLinecap="round" />
      <path d={ticks.join('')} stroke={shade(edge, 0.45)} strokeWidth={0.9 * ss} strokeLinecap="round" />
      {[30, 60, 90].map((d) => (
        <Txt key={d} x={x + Math.cos(d * DEG) * labelR} y={y - Math.sin(d * DEG) * labelR + 4} size={0.6} weight={650} color={shade(edge, 0.5)} halo={false}>
          {d}°
        </Txt>
      ))}
    </g>
  );
}

/** Låseskrue med stjernegrep i svart plast. (x, y) er sentrum. */
function Laaseskrue({ x, y, r }: { x: number; y: number; r: number }) {
  const ss = useStrokeScale();
  const id = useSvgId('laaseskrue');
  const lobes = [];
  for (let i = 0; i < 5; i++) {
    const a = (i * 72 - 90) * DEG;
    lobes.push(<circle key={i} cx={x + Math.cos(a) * r * 0.62} cy={y + Math.sin(a) * r * 0.62} r={r * 0.46} />);
  }
  return (
    <g aria-hidden>
      <RadialGradient id={id} fx={0.35} fy={0.3} stops={sphereStops(mix(SCENE.rubber, SCENE.rubberLight, 0.3))} />
      <g fill={`url(#${id})`} stroke={SCENE.outline} strokeWidth={0.8 * ss}>
        {lobes}
        <circle cx={x} cy={y} r={r * 0.72} />
      </g>
      <circle cx={x} cy={y} r={r * 0.28} fill={SCENE.metal} stroke={SCENE.outline} strokeWidth={0.6 * ss} />
    </g>
  );
}

/** Hengsel i stål: to blad og en knast med splint. (x, y) er aksen. */
function Hengsel({ x, y, r }: { x: number; y: number; r: number }) {
  const ss = useStrokeScale();
  const id = useSvgId('hengsel');
  return (
    <g aria-hidden>
      <RadialGradient id={id} fx={0.35} fy={0.3} stops={sphereStops(SCENE.metal)} />
      <rect x={x - 1} y={y - 1} width={r * 3.4} height={2.6} rx={1} fill={SCENE.metal} stroke={SCENE.outline} strokeWidth={0.6 * ss} />
      <circle cx={x} cy={y} r={r} fill={`url(#${id})`} stroke={SCENE.outline} strokeWidth={0.9 * ss} />
      <circle cx={x} cy={y} r={r * 0.32} fill={SCENE.metalDark} />
    </g>
  );
}
