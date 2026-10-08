/**
 * Gjenstander som bare «Gassmodell» trenger, i samme stil som scene-kit-et (toninger fra core, SCENE-farger, kontur og
 * myk skygge): glassylinder med bunnplate, stempel med stang, stativ med klemme, manometer, digitalt termometer med
 * føler, slange og ledning, og rim på glasset.
 *
 * Runde flater er sett litt ovenfra (ellipser med forholdet `e`, som kokeplata). Front-buene går gjennom den nederste
 * delen av ellipsen: fra venstre til høyre med sweep 0, fra høyre til venstre med sweep 1.
 */
import { useMemo } from 'react';
import {
  ContactShadow,
  LinearGradient,
  PAINTS,
  RadialGradient,
  SCENE,
  alpha,
  materialStops,
  mix,
  sceneRandom,
  shade,
  sphereStops,
  tint,
  useStrokeScale,
  useSvgId,
  type GradientStop,
} from '../../kit/scene';

const r2 = (v: number) => Math.round(v * 100) / 100;

/** Metall sett fra siden (rund stang eller sylinder) med lys fra venstre. */
function roundStops(color: string, strength = 1): GradientStop[] {
  return [
    [0, shade(color, 0.28 * strength)],
    [0.28, tint(color, 0.4 * strength)],
    [0.62, color],
    [1, shade(color, 0.38 * strength)],
  ];
}

/** Sti for sidebåndet på en sylinder sett litt ovenfra: fra toppellipsen (y1) ned til bunnellipsen (y2). */
function sideBand(cx: number, r: number, ry: number, y1: number, y2: number): string {
  return `M${r2(cx - r)},${r2(y1)}L${r2(cx - r)},${r2(y2)}A${r2(r)},${r2(ry)} 0 0 0 ${r2(cx + r)},${r2(y2)}L${r2(cx + r)},${r2(y1)}A${r2(r)},${r2(ry)} 0 0 1 ${r2(cx - r)},${r2(y1)}Z`;
}

/* ------------------------------------------------------------------ Bunnplate */

/**
 * Bunnplate i stål som glassylinderen står i, med en nippel på høyre side (til manometerslangen) og en
 * gjennomføring foran (til termometerføleren). `heat` (0–1) gir en rødlig glød nederst når kokeplata står på.
 * (cx, top) er midten av oversiden.
 */
export function Bunnplate({ cx, top, R, thick, e, heat, portX }: { cx: number; top: number; R: number; thick: number; e: number; heat: number; portX: number }) {
  const ss = useStrokeScale();
  const id = useSvgId('bunnplate');
  const ry = R * e;
  const bot = top + thick;
  const side = sideBand(cx, R, ry, top, bot);
  return (
    <g aria-hidden>
      <LinearGradient id={`${id}s`} x2={1} y2={0} stops={roundStops(SCENE.metal)} />
      <LinearGradient id={`${id}h`} stops={[[0, SCENE.hot, 0], [1, SCENE.hot, 0.7 * heat]]} />
      <path d={side} fill={`url(#${id}s)`} />
      {heat > 0.02 && <path d={side} fill={`url(#${id}h)`} />}
      <path d={side} fill="none" stroke={SCENE.outline} strokeWidth={0.9 * ss} />
      <ellipse cx={cx} cy={top} rx={R} ry={ry} fill={tint(SCENE.metal, 0.3)} stroke={SCENE.outline} strokeWidth={0.9 * ss} />
      {/* Gjennomføring i gummi for ledningen til føleren (på forsiden) */}
      <ellipse cx={portX} cy={bot + ry * Math.sqrt(Math.max(0, 1 - ((portX - cx) / R) ** 2)) - thick * 0.5} rx={5} ry={4} fill={SCENE.rubber} stroke={SCENE.outline} strokeWidth={0.7 * ss} />
      {/* Nippel til slangen (høyre side) */}
      <rect x={cx + R - 1} y={top + thick * 0.18} width={11} height={thick * 0.64} rx={1.5} fill={shade(SCENE.metal, 0.08)} stroke={SCENE.outline} strokeWidth={0.8 * ss} />
    </g>
  );
}

/* ------------------------------------------------------------------ Glassylinderen */

export interface SylinderProps {
  cx: number;
  /** Innvendig og ytre radius. */
  r: number;
  rOuter: number;
  /** Overkanten av glasset og bunnen av gassen (oversiden av bunnplata). */
  rimY: number;
  bottom: number;
  e: number;
}

/** Den bakre delen av glasset (innsiden av bakveggen og bakkanten av åpningen). Tegnes før gassen og stempelet. */
export function SylinderBak({ cx, r, rOuter, rimY, bottom, e }: SylinderProps) {
  const ss = useStrokeScale();
  const id = useSvgId('glassbak');
  const ro = rOuter;
  return (
    <g aria-hidden>
      <LinearGradient
        id={`${id}g`}
        x2={1}
        y2={0}
        stops={[
          [0, SCENE.glassEdge, 0.5],
          [0.1, SCENE.glass, 0.24],
          [0.45, SCENE.glass, 0.1],
          [0.9, SCENE.glass, 0.22],
          [1, SCENE.glassEdge, 0.55],
        ]}
      />
      <rect x={cx - ro} y={rimY} width={2 * ro} height={bottom - rimY} fill={`url(#${id}g)`} />
      {/* Bakkanten av åpningen og bunnen innvendig */}
      <path d={`M${r2(cx - r)},${r2(rimY)}A${r2(r)},${r2(r * e)} 0 0 1 ${r2(cx + r)},${r2(rimY)}`} fill="none" stroke={SCENE.glassEdge} strokeWidth={1.2 * ss} opacity={0.8} />
      <path d={`M${r2(cx - r)},${r2(bottom)}A${r2(r)},${r2(r * e)} 0 0 1 ${r2(cx + r)},${r2(bottom)}`} fill="none" stroke={SCENE.glassEdge} strokeWidth={1 * ss} opacity={0.6} />
    </g>
  );
}

/**
 * Gassen i sylinderen: en svak farge fra kald (blå) via nøytral til varm (oransje), etter `warmth` (−1 til 1).
 * Fyller fra undersiden av stempelet (top) ned til bunnen.
 */
export function Gass({ cx, r, top, bottom, e, warmth }: { cx: number; r: number; top: number; bottom: number; e: number; warmth: number }) {
  const color = warmth >= 0 ? mix(SCENE.glass, SCENE.warm, Math.min(1, warmth) * 0.9) : mix(SCENE.glass, SCENE.cold, Math.min(1, -warmth));
  const a = 0.16 + 0.1 * Math.abs(warmth);
  return <path d={sideBand(cx, r, r * e, top, bottom)} fill={alpha(color, a)} aria-hidden />;
}

/** Forsiden av glasset: refleksstriper, kantene og åpningen øverst. Tegnes etter partiklene og stempelet. */
export function SylinderForan({ cx, r, rOuter, rimY, bottom, e }: SylinderProps) {
  const ss = useStrokeScale();
  const id = useSvgId('glassforan');
  const ro = rOuter;
  const ry = ro * e;
  const ri = r * e;
  const h = bottom - rimY;
  return (
    <g aria-hidden>
      <LinearGradient id={`${id}s`} stops={[[0, SCENE.highlight, 0], [0.12, SCENE.highlight, 1], [0.85, SCENE.highlight, 0.8], [1, SCENE.highlight, 0]]} />
      {/* Refleksene: en smal, klar stripe til venstre og en bred, svak til høyre */}
      <rect x={cx - ro * 0.8} y={rimY + ry} width={ro * 0.08} height={h - ry - 4} rx={ro * 0.04} fill={`url(#${id}s)`} />
      <rect x={cx - ro * 0.66} y={rimY + ry} width={ro * 0.03} height={h - ry - 4} fill={`url(#${id}s)`} opacity={0.6} />
      <rect x={cx + ro * 0.5} y={rimY + ry} width={ro * 0.2} height={h - ry - 4} fill={`url(#${id}s)`} opacity={0.35} />
      {/* Veggene: ytre og indre kant */}
      <g stroke={SCENE.glassEdge} strokeWidth={1.4 * ss}>
        <line x1={cx - ro} y1={rimY} x2={cx - ro} y2={bottom} />
        <line x1={cx + ro} y1={rimY} x2={cx + ro} y2={bottom} />
      </g>
      <g stroke={SCENE.glassEdge} strokeWidth={0.9 * ss} opacity={0.55}>
        <line x1={cx - r} y1={rimY} x2={cx - r} y2={bottom} />
        <line x1={cx + r} y1={rimY} x2={cx + r} y2={bottom} />
      </g>
      {/* Forkanten nederst, der glasset står i bunnplata */}
      <path d={`M${r2(cx - ro)},${r2(bottom)}A${r2(ro)},${r2(ry)} 0 0 0 ${r2(cx + ro)},${r2(bottom)}`} fill="none" stroke={SCENE.glassEdge} strokeWidth={1.4 * ss} />
      {/* Åpningen: en ring i glass */}
      <path
        d={`M${r2(cx - ro)},${r2(rimY)}A${r2(ro)},${r2(ry)} 0 1 0 ${r2(cx + ro)},${r2(rimY)}A${r2(ro)},${r2(ry)} 0 1 0 ${r2(cx - ro)},${r2(rimY)}ZM${r2(cx - r)},${r2(rimY)}A${r2(r)},${r2(ri)} 0 1 1 ${r2(cx + r)},${r2(rimY)}A${r2(r)},${r2(ri)} 0 1 1 ${r2(cx - r)},${r2(rimY)}Z`}
        fill={alpha(SCENE.glassEdge, 0.45)}
        fillRule="evenodd"
        stroke={SCENE.glassEdge}
        strokeWidth={1.1 * ss}
      />
      <path d={`M${r2(cx - ro * 0.75)},${r2(rimY + ry * 0.62)}A${r2(ro)},${r2(ry)} 0 0 0 ${r2(cx - ro * 0.1)},${r2(rimY + ry * 0.99)}`} fill="none" stroke={SCENE.highlight} strokeWidth={1.6 * ss} strokeLinecap="round" />
    </g>
  );
}

/** Rim på glasset når gassen er kaldere enn 0 °C: hvitt belegg langs kantene og iskrystaller (mer jo kaldere). */
export function Rim({ cx, rOuter, top, bottom, amount }: { cx: number; rOuter: number; top: number; bottom: number; amount: number }) {
  const ss = useStrokeScale();
  const id = useSvgId('rim');
  const specks = useMemo(() => {
    const rnd = sceneRandom(41);
    return Array.from({ length: 140 }, () => {
      const side = rnd() < 0.5 ? -1 : 1;
      // Tettest langs kantene og nederst
      const d = rnd() ** 2.2;
      const v = 1 - rnd() ** 1.6;
      return { side, d, v, s: 0.6 + rnd() * 1.4, rot: rnd() * 60 };
    });
  }, []);
  if (!(amount > 0.01)) return null;
  const n = Math.round(specks.length * amount);
  const w = rOuter * 0.42;
  const h = bottom - top;
  return (
    <g aria-hidden>
      <LinearGradient id={`${id}l`} x2={1} y2={0} stops={[[0, SCENE.snow, 0.75], [1, SCENE.snow, 0]]} />
      <LinearGradient id={`${id}r`} x2={1} y2={0} stops={[[0, SCENE.snow, 0], [1, SCENE.snow, 0.75]]} />
      <LinearGradient id={`${id}b`} stops={[[0, SCENE.snow, 0], [1, SCENE.snow, 0.8]]} />
      <g opacity={0.25 + 0.6 * amount}>
        <rect x={cx - rOuter} y={top + 4} width={w} height={h - 4} fill={`url(#${id}l)`} />
        <rect x={cx + rOuter - w} y={top + 4} width={w} height={h - 4} fill={`url(#${id}r)`} />
        <rect x={cx - rOuter} y={bottom - h * 0.3 * amount} width={2 * rOuter} height={h * 0.3 * amount} fill={`url(#${id}b)`} />
      </g>
      <g fill={SCENE.snow} stroke={alpha(SCENE.glassEdge, 0.7)} strokeWidth={0.4 * ss}>
        {specks.slice(0, n).map((p, i) => {
          const x = cx + p.side * rOuter * (1 - p.d * 0.9) - p.side * 2;
          const y = top + 6 + p.v * (h - 10);
          const s = p.s * 1.6 * ss;
          return <path key={i} d={`M${r2(x - s)},${r2(y)}L${r2(x)},${r2(y - s)}L${r2(x + s)},${r2(y)}L${r2(x)},${r2(y + s)}Z`} transform={`rotate(${r2(p.rot)} ${r2(x)} ${r2(y)})`} />;
        })}
      </g>
    </g>
  );
}

/* ------------------------------------------------------------------ Stempelet */

/**
 * Stempel i aluminium med tetningsring i gummi, og stempelstang med knott. (cx, top) er midten av oversiden,
 * `bottom` undersiden (toppen av gassen). Stanga går opp til `rodTop`.
 */
export function Stempel({ cx, r, top, bottom, e, rodTop, rodW }: { cx: number; r: number; top: number; bottom: number; e: number; rodTop: number; rodW: number }) {
  const ss = useStrokeScale();
  const id = useSvgId('stempel');
  const ry = r * e;
  const h = bottom - top;
  const ringY = top + h * 0.3;
  const ringH = Math.max(4, h * 0.2);
  const knob = rodW * 0.85;
  return (
    <g aria-hidden>
      <LinearGradient id={`${id}s`} x2={1} y2={0} stops={roundStops(SCENE.metal)} />
      <LinearGradient id={`${id}r`} x2={1} y2={0} stops={roundStops(SCENE.metal, 1.1)} />
      <LinearGradient id={`${id}t`} stops={[[0, tint(SCENE.metal, 0.45)], [1, tint(SCENE.metal, 0.12)]]} />
      <RadialGradient id={`${id}k`} fx={0.35} fy={0.3} stops={sphereStops(SCENE.rubberLight)} />
      {/* Sida med tetningsringen */}
      <path d={sideBand(cx, r, ry, top, bottom)} fill={`url(#${id}s)`} stroke={SCENE.outline} strokeWidth={0.9 * ss} />
      <path d={sideBand(cx, r, ry, ringY, ringY + ringH)} fill={SCENE.rubber} />
      <path d={`M${r2(cx - r)},${r2(ringY + 1)}A${r2(r)},${r2(ry)} 0 0 0 ${r2(cx + r)},${r2(ringY + 1)}`} fill="none" stroke={SCENE.highlight} strokeWidth={0.9 * ss} opacity={0.6} />
      {/* Oversiden og festet for stanga */}
      <ellipse cx={cx} cy={top} rx={r} ry={ry} fill={`url(#${id}t)`} stroke={SCENE.outline} strokeWidth={0.9 * ss} />
      <ellipse cx={cx} cy={top} rx={rodW * 1.3} ry={rodW * 1.3 * e} fill={shade(SCENE.metal, 0.12)} stroke={SCENE.outline} strokeWidth={0.8 * ss} />
      {/* Stanga og knotten */}
      <rect x={cx - rodW / 2} y={rodTop} width={rodW} height={top - rodTop} fill={`url(#${id}r)`} stroke={SCENE.outline} strokeWidth={0.8 * ss} />
      <ellipse cx={cx} cy={rodTop} rx={knob * 1.15} ry={knob} fill={`url(#${id}k)`} stroke={SCENE.outline} strokeWidth={0.9 * ss} />
    </g>
  );
}

/* ------------------------------------------------------------------ Stativet */

const STAND_PAINT = shade(PAINTS.blaa, 0.3);

/** Stativfot og stang (tegnes bak de andre gjenstandene). (poleX, benchY) er foten av stanga. */
export function StativBak({ poleX, benchY, topY, footL, footR }: { poleX: number; benchY: number; topY: number; footL: number; footR: number }) {
  const ss = useStrokeScale();
  const id = useSvgId('stativ');
  const footH = 9;
  const rRod = 5.5;
  return (
    <g aria-hidden>
      <LinearGradient id={`${id}r`} x2={1} y2={0} stops={roundStops(SCENE.metal)} />
      <LinearGradient id={`${id}f`} stops={materialStops(STAND_PAINT, 1)} />
      <ContactShadow cx={(footL + footR) / 2} cy={benchY} rx={(footR - footL) * 0.56} ry={3} />
      <path
        d={`M${r2(footL)},${r2(benchY)}L${r2(footL + footH * 0.5)},${r2(benchY - footH)}L${r2(footR - footH * 0.3)},${r2(benchY - footH)}L${r2(footR)},${r2(benchY)}Z`}
        fill={`url(#${id}f)`}
        stroke={SCENE.outline}
        strokeWidth={0.9 * ss}
        strokeLinejoin="round"
      />
      <line x1={footL + footH * 0.6} y1={benchY - footH + 1.2 * ss} x2={footR - footH * 0.4} y2={benchY - footH + 1.2 * ss} stroke={SCENE.highlight} strokeWidth={1 * ss} opacity={0.6} />
      <rect x={poleX - rRod} y={topY} width={2 * rRod} height={benchY - footH - topY + 1} rx={rRod * 0.5} fill={`url(#${id}r)`} stroke={SCENE.outline} strokeWidth={0.9 * ss} />
    </g>
  );
}

/**
 * Muffe på stativstanga med en arm og en klemme som låser stempelstanga (tegnes etter stanga, så kjevene ligger foran).
 * (poleX, y) er midten av muffen, rodX midten av stempelstanga.
 */
export function Klemme({ poleX, y, rodX, rodW }: { poleX: number; y: number; rodX: number; rodW: number }) {
  const ss = useStrokeScale();
  const id = useSvgId('klemme');
  const armR = 4.5;
  const jawW = rodW + 16;
  const jawH = 20;
  return (
    <g aria-hidden>
      <LinearGradient id={`${id}a`} stops={[[0, tint(SCENE.metalLight, 0.2)], [0.4, SCENE.metal], [1, shade(SCENE.metal, 0.35)]]} />
      <LinearGradient id={`${id}m`} stops={materialStops(shade(SCENE.metalDark, 0.15), 1)} />
      <LinearGradient id={`${id}j`} stops={materialStops(STAND_PAINT, 1)} />
      <RadialGradient id={`${id}k`} fx={0.35} fy={0.3} stops={sphereStops(SCENE.rubberLight)} />
      {/* Armen */}
      <rect x={rodX + jawW / 2 - 2} y={y - armR} width={poleX - rodX - jawW / 2 + 2} height={2 * armR} rx={armR} fill={`url(#${id}a)`} stroke={SCENE.outline} strokeWidth={0.9 * ss} />
      {/* Muffen med skrue */}
      <rect x={poleX - 11} y={y - 13} width={22} height={26} rx={3} fill={`url(#${id}m)`} stroke={SCENE.outline} strokeWidth={0.9 * ss} />
      <rect x={poleX + 11} y={y - 3} width={8} height={6} fill={shade(SCENE.metal, 0.1)} stroke={SCENE.outline} strokeWidth={0.7 * ss} />
      <ellipse cx={poleX + 22} cy={y} rx={4} ry={7} fill={`url(#${id}k)`} stroke={SCENE.outline} strokeWidth={0.8 * ss} />
      {/* Klemmen rundt stanga: to kjever med kork og en vingeskrue foran */}
      <rect x={rodX - jawW / 2} y={y - jawH / 2} width={jawW} height={jawH} rx={4} fill={`url(#${id}j)`} stroke={SCENE.outline} strokeWidth={0.9 * ss} />
      <rect x={rodX - rodW / 2 - 2} y={y - jawH / 2 - 1} width={rodW + 4} height={jawH + 2} rx={2} fill={SCENE.woodLight} stroke={SCENE.outline} strokeWidth={0.6 * ss} />
      <rect x={rodX - rodW / 2} y={y - jawH / 2 - 1} width={rodW} height={jawH + 2} fill={shade(SCENE.metal, 0.05)} opacity={0.9} />
      <ellipse cx={rodX} cy={y} rx={5} ry={5} fill={`url(#${id}k)`} stroke={SCENE.outline} strokeWidth={0.8 * ss} />
      <line x1={rodX + jawW / 2 - 3} y1={y - jawH / 2 + 3} x2={rodX + jawW / 2 - 3} y2={y + jawH / 2 - 3} stroke={SCENE.highlight} strokeWidth={1 * ss} opacity={0.5} />
    </g>
  );
}

/* ------------------------------------------------------------------ Manometer */

/**
 * Manometer (trykkmåler med viser) festet på stativstanga, med skala i kPa. (x, y) er midten av skiva, `angle` er
 * viserens vinkel i grader med klokka fra rett opp (fra gaugeAngle). Tilkoblingen er nederst, i (x, y + 1,22 · r).
 */
export function Manometer({ x, y, r, angle, max, title }: { x: number; y: number; r: number; angle: number; max: number; title?: string }) {
  const ss = useStrokeScale();
  const id = useSvgId('manometer');
  const face = r * 0.84;
  const ticks = useMemo(() => {
    let major = '';
    let minor = '';
    const labels: { x: number; y: number; v: number }[] = [];
    for (let v = 0; v <= max + 1e-9; v += max / 30) {
      const a = ((-135 + (270 * v) / max) * Math.PI) / 180;
      const isMajor = Math.abs(v / (max / 6) - Math.round(v / (max / 6))) < 1e-6;
      const r1 = face * (isMajor ? 0.74 : 0.82);
      const r0 = face * 0.92;
      const seg = `M${r2(x + Math.sin(a) * r1)},${r2(y - Math.cos(a) * r1)}L${r2(x + Math.sin(a) * r0)},${r2(y - Math.cos(a) * r0)}`;
      if (isMajor) {
        major += seg;
        if (Math.round(v / (max / 6)) % 2 === 0) labels.push({ x: x + Math.sin(a) * face * 0.55, y: y - Math.cos(a) * face * 0.55, v });
      } else minor += seg;
    }
    return { major, minor, labels };
  }, [x, y, face, max]);
  const a = (angle * Math.PI) / 180;
  const needle = face * 0.8;
  const fs = Math.max(8, r * 0.21);
  return (
    <g>
      {title && <title>{title}</title>}
      <RadialGradient id={`${id}b`} fx={0.35} fy={0.3} stops={sphereStops(SCENE.metal)} />
      <RadialGradient id={`${id}f`} cx={0.5} cy={0.42} r={0.6} stops={[[0, tint(PAINTS.hvit, 0.4)], [1, PAINTS.hvit]]} />
      {/* Tilkoblingen nederst */}
      <rect x={x - 4} y={y + r - 2} width={8} height={r * 0.24} fill={SCENE.copper} stroke={SCENE.outline} strokeWidth={0.8 * ss} />
      <rect x={x - 6} y={y + r * 1.08} width={12} height={6} rx={1} fill={shade(SCENE.copper, 0.1)} stroke={SCENE.outline} strokeWidth={0.8 * ss} />
      <ContactShadow cx={x + 3} cy={y + 4} rx={r * 1.02} ry={r * 1.02} opacity={0.35} />
      <circle cx={x} cy={y} r={r} fill={`url(#${id}b)`} stroke={SCENE.outline} strokeWidth={1 * ss} />
      <circle cx={x} cy={y} r={face} fill={`url(#${id}f)`} stroke={shade(SCENE.metal, 0.3)} strokeWidth={0.8 * ss} />
      <path d={ticks.minor} stroke={SCENE.rubber} strokeWidth={0.7 * ss} />
      <path d={ticks.major} stroke={SCENE.rubber} strokeWidth={1.3 * ss} />
      {ticks.labels.map((l) => (
        <text key={l.v} x={r2(l.x)} y={r2(l.y + fs * 0.35)} textAnchor="middle" style={{ fontSize: r2(fs), fontWeight: 650, fill: SCENE.rubber }} aria-hidden>
          {Math.round(l.v)}
        </text>
      ))}
      <text x={x} y={r2(y + face * 0.74)} textAnchor="middle" style={{ fontSize: r2(fs * 0.8), fontWeight: 600, fill: SCENE.rubber }} aria-hidden>
        kPa
      </text>
      {/* Viseren */}
      <path
        d={`M${r2(x - Math.sin(a) * face * 0.16 - Math.cos(a) * 1.6)},${r2(y + Math.cos(a) * face * 0.16 - Math.sin(a) * 1.6)}L${r2(x + Math.sin(a) * needle)},${r2(y - Math.cos(a) * needle)}L${r2(x - Math.sin(a) * face * 0.16 + Math.cos(a) * 1.6)},${r2(y + Math.cos(a) * face * 0.16 + Math.sin(a) * 1.6)}Z`}
        fill={PAINTS.rod}
        stroke={shade(PAINTS.rod, 0.4)}
        strokeWidth={0.5 * ss}
      />
      <circle cx={x} cy={y} r={r * 0.08} fill={SCENE.rubberLight} stroke={SCENE.outline} strokeWidth={0.6 * ss} />
      {/* Glasset */}
      <path d={`M${r2(x - face * 0.72)},${r2(y - face * 0.38)}A${r2(face * 0.82)},${r2(face * 0.82)} 0 0 1 ${r2(x + face * 0.2)},${r2(y - face * 0.8)}`} fill="none" stroke={SCENE.highlight} strokeWidth={2.4 * ss} strokeLinecap="round" />
    </g>
  );
}

/* ------------------------------------------------------------------ Digitalt termometer */

/**
 * Digitalt termometer (håndholdt, i gummihylster) som står på benken, med display. (x, y) er midt på bunnen.
 * Ledningen til føleren festes i toppen: (x + 0,25 · w, y − h).
 */
export function DigitalTermometer({ x, y, w, h, tekst, title }: { x: number; y: number; w: number; h: number; tekst: string; title?: string }) {
  const ss = useStrokeScale();
  const id = useSvgId('termometer');
  const body = shade(PAINTS.gul, 0.12);
  const pad = w * 0.12;
  const dispH = h * 0.26;
  const dispY = y - h + pad + 2;
  // Teksten skal få plass i displayet (også «−273 °C»)
  const fs = Math.min(dispH * 0.62, (w - 2 * pad - 8) / Math.max(4, tekst.length * 0.62));
  return (
    <g>
      {title && <title>{title}</title>}
      <LinearGradient id={`${id}b`} x2={1} y2={0} stops={[[0, tint(body, 0.15)], [0.5, body], [1, shade(body, 0.25)]]} />
      <LinearGradient id={`${id}p`} stops={materialStops(SCENE.rubberLight, 1)} />
      <ContactShadow cx={x} cy={y} rx={w * 0.62} ry={3.5} />
      {/* Kontakten for føleren */}
      <rect x={x + w * 0.25 - 4} y={y - h - 7} width={8} height={9} rx={1.5} fill={SCENE.rubber} stroke={SCENE.outline} strokeWidth={0.7 * ss} />
      <rect x={x - w / 2} y={y - h} width={w} height={h} rx={w * 0.16} fill={`url(#${id}b)`} stroke={SCENE.outline} strokeWidth={1 * ss} />
      <rect x={x - w / 2 + pad * 0.6} y={y - h + pad * 0.6} width={w - pad * 1.2} height={h - pad * 1.2} rx={w * 0.1} fill={`url(#${id}p)`} />
      {/* Displayet */}
      <rect x={x - w / 2 + pad} y={dispY} width={w - 2 * pad} height={dispH} rx={2.5} fill={SCENE.display} stroke={SCENE.outline} strokeWidth={0.7 * ss} />
      <text
        x={x + w / 2 - pad - 4}
        y={dispY + dispH * 0.5 + fs * 0.36}
        textAnchor="end"
        style={{ fontSize: r2(fs), fontWeight: 600, fill: SCENE.displayText, fontFamily: 'var(--mono)', letterSpacing: '-0.02em' }}
        aria-hidden
      >
        {tekst}
      </text>
      {/* Knapper */}
      {[-1, 1].map((s) => (
        <rect key={s} x={x + s * w * 0.18 - w * 0.13} y={dispY + dispH + h * 0.1} width={w * 0.26} height={h * 0.09} rx={h * 0.045} fill={shade(SCENE.rubberLight, 0.1)} stroke={SCENE.outline} strokeWidth={0.6 * ss} />
      ))}
      <circle cx={x} cy={dispY + dispH + h * 0.34} r={w * 0.13} fill={PAINTS.rod} stroke={SCENE.outline} strokeWidth={0.7 * ss} opacity={0.9} />
      <line x1={x - w / 2 + 3} y1={y - h + w * 0.2} x2={x - w / 2 + 3} y2={y - w * 0.2} stroke={SCENE.highlight} strokeWidth={1.4 * ss} strokeLinecap="round" />
    </g>
  );
}

/** Føleren inni sylinderen: et tynt stålrør som stikker opp fra bunnplata. (x, bottom) er der den går gjennom plata. */
export function Foler({ x, bottom, len }: { x: number; bottom: number; len: number }) {
  const ss = useStrokeScale();
  return (
    <g aria-hidden>
      <rect x={x - 2} y={bottom - len} width={4} height={len} rx={2} fill={tint(SCENE.metal, 0.15)} stroke={SCENE.outline} strokeWidth={0.6 * ss} />
      <rect x={x - 3.5} y={bottom - 4} width={7} height={4} fill={shade(SCENE.metal, 0.15)} stroke={SCENE.outline} strokeWidth={0.6 * ss} />
    </g>
  );
}

/** Slange (gummi) eller ledning langs en kubisk kurve, med en lys stripe som gir volum. */
export function Slange({ d, width, color }: { d: string; width: number; color: string }) {
  const ss = useStrokeScale();
  return (
    <g aria-hidden fill="none" strokeLinecap="round">
      <path d={d} stroke={SCENE.outline} strokeWidth={width + 1.6 * ss} />
      <path d={d} stroke={color} strokeWidth={width} />
      <path d={d} stroke={SCENE.highlight} strokeWidth={Math.max(1, width * 0.25)} transform="translate(-0.8 -1)" opacity={0.8} />
    </g>
  );
}
