/**
 * Familien «lab», del 1: varme. Termometer, vannkoker, kokeplate, kasserolle og isbit.
 * Eksporteres videre fra lab.tsx (les JSDoc der for oversikten).
 */
import { useMemo } from 'react';
import { useTextScale } from '../controls';
import { Txt } from '../txt';
import { fmt } from '../format';
import {
  ContactShadow,
  LinearGradient,
  RadialGradient,
  alpha,
  materialStops,
  mix,
  sceneRandom,
  shade,
  sphereStops,
  tint,
  useStrokeScale,
  useSvgId,
} from './core';
import { PAINTS, SCENE, paint, type PaintName } from './palette';
import { Damp, LAB, ObjectFrame, circlePath, clamp01, cylinderStops, fin, r2, roundedPolygon, useLocalStroke } from './lab-felles';

/* ------------------------------------------------------------------ Termometer */

export interface TermometerProps {
  /** Midt på bunnen av kula (ankerpunktet). */
  x: number;
  y: number;
  /** Hele lengden fra bunnen av kula til toppen av røret, i figurens enheter. Rørbredden følger lengden. */
  h: number;
  /** Temperaturen væska står på. Verdier utenfor skalaen stopper like under bunnen eller over toppen. */
  temp: number;
  /** Laveste og høyeste verdi på skalaen. */
  min: number;
  max: number;
  /** Enheten etter det øverste tallet på skalaen (standard «°C»). Tom tekst = ingen enhet. */
  enhet?: string;
  /** Hvor tallene står (standard til høyre for røret). «ingen» viser bare strekene. */
  skala?: 'hoyre' | 'venstre' | 'ingen';
  /** Avstand mellom tallene. Standard: velges etter plassen, så tallene ikke overlapper (også på mobil). */
  steg?: number;
  /** Farge på væska (standard rød sprit). */
  farge?: string;
  /** Grader med klokka rundt ankerpunktet (f.eks. skrått i et begerglass). */
  rotate?: number;
  dim?: boolean;
  title?: string;
}

/** «Pen» avstand mellom tallene på en skala (1, 2, 2,5 eller 5 ganger en tierpotens). */
function niceStep(range: number, maxCount: number): number {
  const raw = range / Math.max(1, maxCount);
  if (!(raw > 0) || !Number.isFinite(raw)) return 1;
  const mag = 10 ** Math.floor(Math.log10(raw));
  for (const m of [1, 2, 2.5, 5, 10]) if (m * mag >= raw - 1e-9) return m * mag;
  return 10 * mag;
}

function decimalsFor(step: number): number {
  let d = 0;
  while (d < 3 && Math.abs(Math.round(step * 10 ** d) - step * 10 ** d) > 1e-6) d++;
  return d;
}

/**
 * Væsketermometer i glass med skala og rød væske som står på `temp`. (x, y) er bunnen av kula.
 *   <Termometer x={420} y={300} h={220} temp={T} min={0} max={100} />
 * Tallene på skalaen vokser på mobil, og avstanden mellom dem velges så de ikke overlapper (`steg` overstyrer).
 */
export function Termometer({
  x,
  y,
  h,
  temp,
  min,
  max,
  enhet = '°C',
  skala = 'hoyre',
  steg,
  farge = LAB.thermo,
  rotate,
  dim,
  title,
}: TermometerProps) {
  const ss = useStrokeScale();
  const f = useTextScale();
  const id = useSvgId('termometer');
  const H = Math.max(40, fin(h, 200));
  const tw = Math.max(7, H * 0.06);
  const tr = tw / 2;
  const br = tw * 0.68;
  const bl = tw * 2.3;
  const cw = Math.max(2.2, tw * 0.3);
  const lo = fin(Math.min(min, max), 0);
  let hi = fin(Math.max(min, max), 100);
  if (hi - lo < 1e-9) hi = lo + 1;
  const neckTop = -bl - tw * 0.25;
  const neckBot = -bl + tw * 0.6;
  const yMin = -bl - tw * 0.9;
  const yMax = -H + tw * 1.3;
  const toY = (v: number) => yMin + (yMax - yMin) * ((v - lo) / (hi - lo));
  const frac = Math.min(1.03, Math.max(-0.035, (fin(temp, lo) - lo) / (hi - lo)));
  const yT = yMin + (yMax - yMin) * frac;
  const side = skala === 'venstre' ? -1 : 1;

  // Skala: tall med god avstand (også på mobil), korte streker mellom.
  const ticks = useMemo(() => {
    const span = yMin - yMax;
    const step = steg && steg > 0 ? steg : niceStep(hi - lo, Math.floor(span / (24 * f)));
    const pxPer = span / (hi - lo);
    const minor = [10, 5, 2].map((d) => step / d).find((m) => m * pxPer >= 3.6 * ss) ?? step;
    const first = Math.ceil(lo / minor - 1e-9);
    const last = Math.floor(hi / minor + 1e-9);
    const major: number[] = [];
    let dMajor = '';
    let dMinor = '';
    const inner = (cw / 2 + tw * 0.06) * side;
    for (let i = first; i <= last && i - first < 400; i++) {
      const v = i * minor;
      const ty = r2(toY(v));
      const isMajor = Math.abs(v / step - Math.round(v / step)) < 1e-6;
      if (isMajor) {
        major.push(v);
        dMajor += `M${r2(inner)},${ty}H${r2((tr + 2.5 * ss) * side)}`;
      } else {
        dMinor += `M${r2(inner)},${ty}H${r2((tr - tw * 0.08) * side)}`;
      }
    }
    return { major, dMajor, dMinor, dec: decimalsFor(step) };
  }, [yMin, yMax, hi, lo, steg, f, ss, cw, tw, tr, side]);

  const glass = `M${r2(-tr)},${r2(-H + tr)}A${r2(tr)},${r2(tr)} 0 0 1 ${r2(tr)},${r2(-H + tr)}L${r2(tr)},${r2(neckTop)}C${r2(tr)},${r2(neckTop + tw * 0.45)} ${r2(br)},${r2(neckBot - tw * 0.4)} ${r2(br)},${r2(neckBot)}L${r2(br)},${r2(-br)}A${r2(br)},${r2(br)} 0 0 1 ${r2(-br)},${r2(-br)}L${r2(-br)},${r2(neckBot)}C${r2(-br)},${r2(neckBot - tw * 0.4)} ${r2(-tr)},${r2(neckTop + tw * 0.45)} ${r2(-tr)},${r2(neckTop)}Z`;
  const g = tw * 0.14;
  const fs = 17 * f * 0.68;
  const lx = (tr + 4 * ss + 3 * f) * side;
  const top = ticks.major[ticks.major.length - 1];

  return (
    <ObjectFrame
      x={x}
      y={y}
      rotate={rotate}
      dim={dim}
      title={title}
      after={
        skala !== 'ingen' &&
        ticks.major.map((v) => (
          <g key={v} transform={rotate ? `rotate(${r2(-rotate)} ${r2(lx)} ${r2(toY(v))})` : undefined}>
            <Txt x={r2(lx)} y={r2(toY(v) + fs * 0.34)} anchor={side > 0 ? 'start' : 'end'} size={0.68} weight={600}>
              {fmt(v, ticks.dec)}
              {v === top && enhet ? ` ${enhet}` : ''}
            </Txt>
          </g>
        ))
      }
    >
      <LinearGradient
        id={`${id}-g`}
        x2={1}
        y2={0}
        stops={[
          [0, SCENE.glassEdge, 0.6],
          [0.25, SCENE.glass, 0.22],
          [0.7, SCENE.glass, 0.32],
          [1, SCENE.glassEdge, 0.7],
        ]}
      />
      <LinearGradient id={`${id}-v`} x2={1} y2={0} stops={cylinderStops(farge, 0.9)} />
      <path d={glass} fill={`url(#${id}-g)`} />
      <rect x={r2(-cw * 1.25)} y={r2(yMax - tw * 0.5)} width={r2(cw * 2.5)} height={r2(neckTop - yMax + tw * 0.5)} fill={SCENE.plastic} opacity={0.75} />
      <rect x={r2(-br + g)} y={r2(neckBot - tw * 0.55)} width={r2(2 * (br - g))} height={r2(-g - neckBot + tw * 0.55)} rx={r2(br - g)} fill={`url(#${id}-v)`} />
      <rect x={r2(-cw / 2)} y={r2(yT)} width={r2(cw)} height={r2(Math.max(0, neckBot - yT))} rx={r2(cw / 2)} fill={farge} />
      <path d={ticks.dMinor} stroke={LAB.ink} strokeWidth={r2(0.8 * ss)} opacity={0.8} />
      <path d={ticks.dMajor} stroke={LAB.ink} strokeWidth={r2(1.2 * ss)} />
      <path
        d={`M${r2(-tr * 0.5)},${r2(-H + tr * 1.4)}V${r2(neckTop - tw * 0.2)}`}
        stroke={SCENE.highlight}
        strokeWidth={r2(Math.max(1, tw * 0.15))}
        strokeLinecap="round"
      />
      <ellipse cx={r2(-br * 0.42)} cy={r2(-br * 1.15)} rx={r2(br * 0.16)} ry={r2(br * 0.42)} fill={SCENE.highlight} />
      <path d={glass} fill="none" stroke={SCENE.outline} strokeWidth={r2(1 * ss)} />
    </ObjectFrame>
  );
}

/* ------------------------------------------------------------------ Vannkoker */

export interface VannkokerProps {
  /** Midt på bunnen av sokkelen (ankerpunktet). */
  x: number;
  y: number;
  /** Høyden fra bunnen av sokkelen til toppen av lokket (standard 120). Bredden med hank og tut er ca. 0,82 · size. */
  size?: number;
  /** Bryteren er på: lampen på hanken lyser. */
  paa?: boolean;
  /** Vannstanden i vinduet, 0–1 (standard 0,6). */
  vann?: number;
  /** Damp fra tuten, 0–1 (0 = ingen). */
  damp?: number;
  /** Tid i sekunder (fra useSimClock): dampen stiger og boblene i vinduet beveger seg. Uten tid står de stille. */
  tid?: number;
  /** Lakk i stedet for børstet stål, f.eks. «hvit» eller «rod». */
  lakk?: PaintName | string;
  /** Tuten mot høyre i stedet for mot venstre. */
  flip?: boolean;
  rotate?: number;
  dim?: boolean;
  title?: string;
}

const KETTLE_BODY = 'M-31,-10.5Q-31,-6 -26.5,-6L26.5,-6Q31,-6 31,-10.5L25.2,-82L-25.2,-82Z';
const KETTLE_SKIRT = 'M-31,-10.5Q-31,-6 -26.5,-6L26.5,-6Q31,-6 31,-10.5L30.6,-15.5L-30.6,-15.5Z';
const KETTLE_HANDLE = 'M23,-77C38,-80.5 45,-76 45,-64L44.2,-36C44,-27 40,-22.5 31.5,-21.5';
const KETTLE_LID = 'M-25.4,-84.5C-24.4,-90.2 -14,-93.2 0,-93.2C14,-93.2 24.4,-90.2 25.4,-84.5Z';
const KETTLE_SPOUT = 'M-24.4,-80.5C-28.5,-82 -32.6,-85 -36,-88Q-38.6,-89.4 -38,-86.4C-36.4,-80 -32.4,-71.5 -27.2,-63Z';

/**
 * Elektrisk vannkoker på sokkel: tut til venstre, hank til høyre med bryter og lampe, vindu med vannstand.
 * (x, y) er midt på bunnen av sokkelen; `size` er høyden.
 *   <Vannkoker x={300} y={260} size={130} paa vann={0.7} damp={koker ? 1 : 0} tid={clock.t} />
 */
export function Vannkoker({ x, y, size = 120, paa = false, vann = 0.6, damp = 0, tid, lakk, flip, rotate, dim, title }: VannkokerProps) {
  const H = Math.max(10, fin(size, 120));
  const k = H / 100;
  const sw = useLocalStroke(k);
  const id = useSvgId('vannkoker');
  const body = lakk ? paint(lakk) : SCENE.metal;
  const plast = PAINTS.svart;
  const v = clamp01(vann);
  const dm = clamp01(damp);
  const wTop = -72;
  const wBot = -17;
  const level = wBot - 2 - v * (wBot - wTop - 4);
  const bubbles = useMemo(() => {
    const rnd = sceneRandom(41);
    return Array.from({ length: 4 }, () => ({ x: -15.2 + rnd() * 4.4, p: rnd(), r: 0.6 + rnd() * 0.7 }));
  }, []);
  let bubblePath = '';
  if (dm > 0.25 && v > 0.08) {
    for (const b of bubbles) {
      const p = tid === undefined || !Number.isFinite(tid) ? b.p : (((b.p + tid * 0.8) % 1) + 1) % 1;
      const by = wBot - 3 - p * (wBot - 3 - level);
      if (by > level + 1.5) bubblePath += circlePath(b.x, by, b.r);
    }
  }
  return (
    <ObjectFrame x={x} y={y} k={k} rotate={rotate} flip={flip} dim={dim} title={title}>
      <ContactShadow cx={0} cy={0} rx={42} ry={4.5} />
      <LinearGradient
        id={`${id}-b`}
        x2={1}
        y2={0}
        stops={
          lakk
            ? // Lakkert plast: myk toning uten den skarpe metallglansen.
              [
                [0, shade(body, 0.1)],
                [0.24, tint(body, 0.16)],
                [0.62, body],
                [1, shade(body, 0.2)],
              ]
            : cylinderStops(body)
        }
      />
      <LinearGradient id={`${id}-p`} stops={materialStops(plast, 1.4)} />
      <LinearGradient id={`${id}-w`} x2={1} y2={0} stops={[[0, SCENE.waterLight], [0.6, SCENE.water], [1, SCENE.waterDeep]]} />
      {/* Sokkel */}
      <rect x={-36} y={-6.5} width={72} height={6.5} rx={2.6} fill={`url(#${id}-p)`} stroke={SCENE.outline} strokeWidth={sw(1)} />
      <path d="M-33.5,-5.6H33.5" stroke={SCENE.highlight} strokeWidth={sw(1)} strokeLinecap="round" />
      {/* Hank (bak kroppen der den festes) */}
      <path d={KETTLE_HANDLE} fill="none" stroke={SCENE.outline} strokeWidth={r2(9 + sw(2))} strokeLinecap="round" strokeLinejoin="round" />
      <path d={KETTLE_HANDLE} fill="none" stroke={plast} strokeWidth={9} strokeLinecap="round" strokeLinejoin="round" />
      <path d="M27,-78.6C38,-80.8 42.4,-76 42.4,-66" fill="none" stroke={SCENE.highlight} strokeWidth={1.6} strokeLinecap="round" />
      {/* Tut og kropp */}
      <path d={KETTLE_SPOUT} fill={shade(body, 0.08)} stroke={SCENE.outline} strokeWidth={sw(1)} strokeLinejoin="round" />
      <path d={KETTLE_BODY} fill={`url(#${id}-b)`} stroke={SCENE.outline} strokeWidth={sw(1)} strokeLinejoin="round" />
      <path d={KETTLE_SKIRT} fill={`url(#${id}-p)`} />
      <path d="M-25.9,-81.2L25.9,-81.2L26.2,-84.8L-26.2,-84.8Z" fill={tint(SCENE.metal, 0.3)} stroke={SCENE.outline} strokeWidth={sw(0.8)} />
      {lakk ? (
        <path d="M-21.2,-76.5L-25.4,-22" stroke={SCENE.highlight} strokeWidth={5.6} strokeLinecap="round" opacity={0.32} />
      ) : (
        <path d="M-21.4,-78L-25.6,-20" stroke={SCENE.highlight} strokeWidth={2.4} strokeLinecap="round" />
      )}
      {/* Vindu med vannstand */}
      <rect x={-17} y={wTop} width={8} height={wBot - wTop} rx={4} fill={shade(SCENE.glassEdge, 0.42)} />
      {v > 0 && (
        <path
          d={`M-17,${r2(level)}H-9V${wBot - 4}A4,4 0 0 1 -17,${wBot - 4}Z`}
          fill={`url(#${id}-w)`}
        />
      )}
      {v > 0 && <path d={`M-16.4,${r2(level)}H-9.6`} stroke={SCENE.waterLight} strokeWidth={sw(1)} />}
      {bubblePath && <path d={bubblePath} fill="none" stroke={tint(SCENE.waterLight, 0.4)} strokeWidth={sw(0.8)} />}
      <rect x={-17} y={wTop} width={8} height={wBot - wTop} rx={4} fill="none" stroke={plast} strokeWidth={1.4} />
      <path d="M-7.4,-66h3.4M-7.4,-55.5h2M-7.4,-44.5h2M-7.4,-33.5h2M-7.4,-23h3.4" stroke={LAB.ink} strokeWidth={sw(0.9)} opacity={0.8} />
      {/* Lokk */}
      <path d={KETTLE_LID} fill={`url(#${id}-p)`} stroke={SCENE.outline} strokeWidth={sw(1)} />
      <rect x={8} y={-95.4} width={10} height={3.4} rx={1.6} fill={tint(SCENE.metal, 0.2)} stroke={SCENE.outline} strokeWidth={sw(0.7)} />
      <path d="M-18,-88.6Q-10,-91.4 0,-91.6" fill="none" stroke={SCENE.highlight} strokeWidth={1.3} strokeLinecap="round" />
      {/* Bryter med lampe på hanken */}
      {paa && (
        <>
          <RadialGradient id={`${id}-l`} stops={[[0, SCENE.glow, 0.95], [0.35, SCENE.warm, 0.45], [1, SCENE.warm, 0]]} />
          <circle cx={44.2} cy={-41} r={10} fill={`url(#${id}-l)`} />
        </>
      )}
      <rect
        x={41.6}
        y={-45.5}
        width={5.2}
        height={9}
        rx={1.8}
        fill={paa ? SCENE.warm : SCENE.rubberLight}
        stroke={paa ? shade(SCENE.warm, 0.35) : SCENE.outline}
        strokeWidth={sw(0.8)}
      />
      {paa && <rect x={42.6} y={-44.4} width={1.6} height={4.2} rx={0.8} fill={SCENE.glow} />}
      <Damp id={`${id}-d`} x={-38} y={-91} mengde={dm} tid={tid} bredde={20} hoyde={40} drift={-12} sw={sw} />
    </ObjectFrame>
  );
}

/* ------------------------------------------------------------------ Kokeplate */

export interface KokeplateProps {
  /** Midt på bunnen (under føttene, ankerpunktet). */
  x: number;
  y: number;
  /** Bredden på kokeplata (standard 160). Høyden er ca. 0,3 · w. */
  w?: number;
  /** Effekten, 0–1: plata gløder rødt, lampen lyser og bryteren dreies. */
  effekt?: number;
  rotate?: number;
  dim?: boolean;
  title?: string;
}

/**
 * Frittstående kokeplate med støpejernsplate, bryter og lampe. Plata gløder med `effekt`.
 * (x, y) er midt på bunnen. Midten av plata er i (x, y − 0,30 · w). En kasserolle med bredde b står midt på plata
 * når den settes i y − 0,30 · w + 0,08 · b (for en kasserolle like bred som plata, b ≈ 0,62 · w: y − 0,25 · w).
 *   <Kokeplate x={400} y={300} w={180} effekt={P / Pmaks} />
 *   <Kasserolle x={400} y={300 - 0.3 * 180 + 0.08 * 110} w={110} vann={0.7} />
 */
export function Kokeplate({ x, y, w = 160, effekt = 0, rotate, dim, title }: KokeplateProps) {
  const W = Math.max(10, fin(w, 160));
  const k = W / 100;
  const sw = useLocalStroke(k);
  const id = useSvgId('kokeplate');
  const e = clamp01(effekt);
  const ang = ((-135 + 270 * e) * Math.PI) / 180;
  const hotTop = mix(SCENE.rubberLight, SCENE.hot, 0.92 * e);
  const hotEdge = mix(SCENE.rubber, SCENE.hot, 0.62 * e);
  return (
    <ObjectFrame x={x} y={y} k={k} rotate={rotate} dim={dim} title={title}>
      <ContactShadow cx={0} cy={0} rx={55} ry={3.6} />
      <LinearGradient id={`${id}-f`} stops={materialStops(SCENE.plastic, 1.2)} />
      <LinearGradient id={`${id}-t`} stops={[[0, shade(SCENE.metal, 0.12)], [1, tint(SCENE.metal, 0.32)]]} />
      <RadialGradient id={`${id}-p`} cx={0.45} cy={0.42} r={0.62} stops={[[0, hotTop], [0.7, mix(SCENE.rubber, SCENE.hot, 0.8 * e)], [1, hotEdge]]} />
      <RadialGradient id={`${id}-k`} fx={0.35} fy={0.32} stops={sphereStops(SCENE.rubberLight)} />
      <path d="M-43,-3h8v3h-8ZM35,-3h8v3h-8Z" fill={SCENE.rubber} />
      {/* Kasse: forside og topp */}
      <path d="M-50,-21L50,-21L50,-6Q50,-3 47,-3L-47,-3Q-50,-3 -50,-6Z" fill={`url(#${id}-f)`} />
      <path d="M-50,-21L-50,-30Q-50,-33 -47,-33L47,-33Q50,-33 50,-30L50,-21Z" fill={`url(#${id}-t)`} />
      <path d="M-49.5,-21H49.5" stroke={SCENE.highlight} strokeWidth={sw(1.4)} />
      <path d="M-50,-30Q-50,-33 -47,-33L47,-33Q50,-33 50,-30L50,-6Q50,-3 47,-3L-47,-3Q-50,-3 -50,-6Z" fill="none" stroke={SCENE.outline} strokeWidth={sw(1)} />
      {/* Plata */}
      <ellipse cx={0} cy={-27.4} rx={34.5} ry={5.3} fill={tint(SCENE.metal, 0.35)} stroke={shade(SCENE.metal, 0.3)} strokeWidth={sw(0.8)} />
      <path d="M-31,-30.4A31,4.6 0 0 0 31,-30.4L31,-27.4A31,4.6 0 0 1 -31,-27.4Z" fill={hotEdge} stroke={SCENE.outline} strokeWidth={sw(0.8)} />
      <ellipse cx={0} cy={-30.4} rx={31} ry={4.6} fill={`url(#${id}-p)`} stroke={SCENE.outline} strokeWidth={sw(0.8)} />
      <path
        d="M-21,-30.4a21,3.1 0 1,0 42,0a21,3.1 0 1,0 -42,0M-11,-30.4a11,1.65 0 1,0 22,0a11,1.65 0 1,0 -22,0"
        fill="none"
        stroke={mix(shade(SCENE.rubber, 0.3), SCENE.glow, 0.7 * e)}
        strokeWidth={sw(1.1)}
        opacity={0.85}
      />
      <path d="M-27,-32.6Q-14,-35 4,-34.9" fill="none" stroke={SCENE.highlight} strokeWidth={sw(1.2)} strokeLinecap="round" opacity={1 - e} />
      {e > 0.02 && (
        <>
          <RadialGradient id={`${id}-g`} stops={[[0, SCENE.warm, 0.5 * e], [0.45, SCENE.hot, 0.26 * e], [1, SCENE.hot, 0]]} />
          <ellipse cx={0} cy={-33} rx={42} ry={15} fill={`url(#${id}-g)`} />
        </>
      )}
      {/* Lampe og bryter */}
      {e > 0 && (
        <>
          <RadialGradient id={`${id}-l`} stops={[[0, SCENE.glow, 0.9], [0.4, SCENE.warm, 0.4], [1, SCENE.warm, 0]]} />
          <circle cx={24} cy={-12} r={5} fill={`url(#${id}-l)`} />
        </>
      )}
      <circle cx={24} cy={-12} r={1.8} fill={e > 0 ? SCENE.warm : shade(SCENE.plastic, 0.35)} stroke={SCENE.outline} strokeWidth={sw(0.6)} />
      <circle cx={36} cy={-12} r={5.2} fill={`url(#${id}-k)`} stroke={SCENE.outline} strokeWidth={sw(0.8)} />
      <path
        d={`M${r2(36 + Math.sin(ang) * 1.2)},${r2(-12 - Math.cos(ang) * 1.2)}L${r2(36 + Math.sin(ang) * 4.3)},${r2(-12 - Math.cos(ang) * 4.3)}`}
        stroke={SCENE.plastic}
        strokeWidth={sw(1.4)}
        strokeLinecap="round"
      />
    </ObjectFrame>
  );
}

/* ------------------------------------------------------------------ Kasserolle */

export interface KasserolleProps {
  /** Laveste punkt på forkanten av bunnen (ankerpunktet). Vi ser kasserollen litt ovenfra. */
  x: number;
  y: number;
  /** Bredden på kasserollen uten skaft (standard 110). Høyden er ca. 0,6 · w, og skaftet stikker 0,8 · w ut. */
  w?: number;
  /** Vannstand 0–1 (standard 0,7). Uten `snitt` ser du vannet bare når kasserollen er nesten full. */
  vann?: number;
  /** Damp, 0–1. Med `snitt` koker vannet (bobler) når dampen er over 0,3. */
  damp?: number;
  /** Lokk med knott. */
  lokk?: boolean;
  /** Halve veggen er skåret bort, så du ser vannet inni (som en snittegning). */
  snitt?: boolean;
  /** Tid i sekunder (fra useSimClock): dampen stiger og boblene beveger seg. */
  tid?: number;
  /** Skaftet mot venstre. */
  flip?: boolean;
  rotate?: number;
  dim?: boolean;
  title?: string;
}

/**
 * Kasserolle i stål med langt skaft, valgfritt lokk, vann og damp. Med `snitt` er den fremre halvdelen av veggen
 * skåret bort, så vannstanden og boblene synes. (x, y) er det laveste punktet på forkanten av bunnen.
 *   <Kasserolle x={400} y={246} w={110} vann={0.7} damp={T >= 100 ? 1 : 0} snitt tid={clock.t} />
 */
export function Kasserolle({ x, y, w = 110, vann = 0.7, damp = 0, lokk = false, snitt = false, tid, flip, rotate, dim, title }: KasserolleProps) {
  const W = Math.max(10, fin(w, 110));
  const k = W / 100;
  const sw = useLocalStroke(k);
  const id = useSvgId('kasserolle');
  const v = clamp01(vann);
  const dm = clamp01(damp);
  const metal = SCENE.metal;
  // Geometri (lokale enheter, bredde 100): bunnen er en ellipse med sentrum i (0, −8), kanten øverst i y = −58.
  const RIM = -58;
  const FLOOR = -10.5;
  const yw = FLOOR - v * (FLOOR - RIM - 2.5);
  const waterVisible = v > 0 && yw - 7.8 < RIM + 7.6;
  const bubbles = useMemo(() => {
    const rnd = sceneRandom(77);
    return Array.from({ length: 8 }, () => ({ x: -40 + rnd() * 80, p: rnd(), r: 0.9 + rnd() * 1.6 }));
  }, []);
  let bubblePath = '';
  if (snitt && dm > 0.3 && v > 0.05) {
    for (const b of bubbles) {
      const p = tid === undefined || !Number.isFinite(tid) ? b.p : (((b.p + tid * 0.7) % 1) + 1) % 1;
      const by = FLOOR - 2 - p * (FLOOR - 2 - yw);
      if (by > yw + b.r + 0.5) bubblePath += circlePath(b.x, by, b.r * (0.7 + 0.5 * p));
    }
  }
  const outline = 'M-50,-58L-50,-8A50,8 0 0 0 50,-8L50,-58A50,8 0 0 0 -50,-58Z';
  const handle = (
    <g>
      <rect x={44.5} y={-55} width={7} height={10} rx={1.6} fill={tint(metal, 0.15)} stroke={SCENE.outline} strokeWidth={sw(0.8)} />
      <path d="M48.6,-52.6L127.4,-64A4,4 0 0 1 128.6,-56L49.4,-46.4Z" fill={`url(#${id}-h)`} stroke={SCENE.outline} strokeWidth={sw(1)} strokeLinejoin="round" />
      <ellipse cx={121.4} cy={-59.3} rx={2.7} ry={1.5} transform="rotate(-7.6 121.4 -59.3)" fill={SCENE.rubber} />
      <path d="M53,-51.4L118,-60.6" stroke={SCENE.highlight} strokeWidth={1.1} strokeLinecap="round" />
    </g>
  );
  // Med lokk slipper dampen ut mellom lokket og kanten (på siden uten skaft), ellers stiger den fra vannflata.
  const steamY = lokk ? -62 : snitt ? Math.min(-62, yw - 6) : -62;
  return (
    <ObjectFrame x={x} y={y} k={k} rotate={rotate} flip={flip} dim={dim} title={title}>
      <ContactShadow cx={4} cy={-7} rx={58} ry={9.5} />
      <LinearGradient id={`${id}-b`} x2={1} y2={0} stops={cylinderStops(metal)} />
      <LinearGradient id={`${id}-i`} x2={1} y2={0} stops={[[0, shade(metal, 0.42)], [0.55, shade(metal, 0.18)], [1, tint(metal, 0.12)]]} />
      <LinearGradient id={`${id}-w`} stops={[[0, SCENE.waterLight], [0.35, SCENE.water], [1, SCENE.waterDeep]]} />
      <LinearGradient id={`${id}-h`} x1={0} y1={0} x2={0.12} y2={1} stops={materialStops(PAINTS.svart, 1.5)} />
      {snitt ? (
        <>
          {/* Innsiden bak og bunnen foran */}
          <path d="M-48.5,-58A48.5,7.8 0 0 1 48.5,-58L48.5,-10.5L-48.5,-10.5Z" fill={`url(#${id}-i)`} />
          <path d="M-50,-8A50,8 0 0 0 50,-8L48.5,-10.5A48.5,7.8 0 0 1 -48.5,-10.5Z" fill={`url(#${id}-b)`} />
          <path d="M-48.5,-10.5A48.5,7.8 0 0 0 48.5,-10.5Z" fill={tint(metal, 0.18)} />
          {v > 0 && (
            <>
              <path d={`M-48.5,${r2(yw)}A48.5,7.8 0 0 1 48.5,${r2(yw)}L48.5,-10.5L-48.5,-10.5Z`} fill={`url(#${id}-w)`} opacity={0.94} />
              <path d={`M-48.5,${r2(yw)}A48.5,7.8 0 0 1 48.5,${r2(yw)}Z`} fill={SCENE.waterLight} opacity={0.55} />
              <path d={`M-48.5,${r2(yw)}H48.5`} stroke={tint(SCENE.waterLight, 0.35)} strokeWidth={sw(1.3)} />
            </>
          )}
          {bubblePath && <path d={bubblePath} fill={alpha(SCENE.waterLight, 0.35)} stroke={tint(SCENE.waterLight, 0.45)} strokeWidth={sw(0.9)} />}
          {/* Snittflatene i veggen */}
          <path
            d="M-50,-58L-48.5,-58L-48.5,-10.5L48.5,-10.5L48.5,-58L50,-58L50,-8L-50,-8Z"
            fill={tint(metal, 0.55)}
            stroke={SCENE.outline}
            strokeWidth={sw(0.8)}
            strokeLinejoin="round"
          />
          <path d="M-50,-58A50,8 0 0 1 50,-58" fill="none" stroke={tint(metal, 0.45)} strokeWidth={2} />
          <path d="M-50,-58A50,8 0 0 1 50,-58M-50,-58V-8A50,8 0 0 0 50,-8V-58" fill="none" stroke={SCENE.outline} strokeWidth={sw(1)} />
          {handle}
          {lokk && (
            <g>
              <path d="M-51.5,-58C-46,-66.5 -25,-70 0,-70C25,-70 46,-66.5 51.5,-58" fill="none" stroke={SCENE.outline} strokeWidth={r2(2.4 + sw(1.6))} strokeLinecap="round" />
              <path d="M-51.5,-58C-46,-66.5 -25,-70 0,-70C25,-70 46,-66.5 51.5,-58" fill="none" stroke={tint(metal, 0.4)} strokeWidth={2.4} strokeLinecap="round" />
              <rect x={-7} y={-76.5} width={14} height={6.5} rx={2.5} fill={`url(#${id}-h)`} stroke={SCENE.outline} strokeWidth={sw(0.8)} />
            </g>
          )}
        </>
      ) : (
        <>
          <path d={outline} fill={`url(#${id}-b)`} stroke={SCENE.outline} strokeWidth={sw(1)} />
          <path d="M-46,-50L-46.2,-16" stroke={SCENE.highlight} strokeWidth={2.6} strokeLinecap="round" />
          {!lokk && (
            <>
              <clipPath id={`${id}-c`}>
                <ellipse cx={0} cy={RIM} rx={48.6} ry={7.6} />
              </clipPath>
              <ellipse cx={0} cy={RIM} rx={48.6} ry={7.6} fill={`url(#${id}-i)`} />
              {waterVisible && (
                <g clipPath={`url(#${id}-c)`}>
                  <ellipse cx={0} cy={r2(yw)} rx={48.6} ry={7.6} fill={SCENE.water} />
                  <ellipse cx={-6} cy={r2(yw - 1.5)} rx={30} ry={3.4} fill={SCENE.waterLight} opacity={0.55} />
                </g>
              )}
            </>
          )}
          <ellipse cx={0} cy={RIM} rx={49.3} ry={7.9} fill="none" stroke={tint(metal, 0.45)} strokeWidth={1.8} />
          <path d="M-50,-58A50,8 0 0 0 50,-58" fill="none" stroke={SCENE.outline} strokeWidth={sw(1)} />
          {handle}
          {lokk && (
            <g>
              <RadialGradient id={`${id}-l`} cx={0.4} cy={0.3} r={0.75} fx={0.32} fy={0.2} stops={sphereStops(metal)} />
              <path
                d="M-51.5,-58A51.5,8.3 0 0 0 51.5,-58C46,-66.5 25,-70 0,-70C-25,-70 -46,-66.5 -51.5,-58Z"
                fill={`url(#${id}-l)`}
                stroke={SCENE.outline}
                strokeWidth={sw(1)}
              />
              <path d="M-51.2,-58A51.2,8.2 0 0 0 51.2,-58" fill="none" stroke={tint(metal, 0.5)} strokeWidth={1.4} />
              <path d="M-38,-63.6Q-26,-68 -12,-68.8" fill="none" stroke={SCENE.highlight} strokeWidth={1.8} strokeLinecap="round" />
              <rect x={-7} y={-76.5} width={14} height={7} rx={2.5} fill={`url(#${id}-h)`} stroke={SCENE.outline} strokeWidth={sw(0.8)} />
            </g>
          )}
        </>
      )}
      {lokk ? (
        <Damp id={`${id}-d`} x={-46} y={steamY} mengde={dm} tid={tid} bredde={22} hoyde={40} drift={-10} sw={sw} />
      ) : (
        <Damp id={`${id}-d`} x={0} y={steamY} mengde={dm} tid={tid} bredde={30} hoyde={46} drift={8} sw={sw} />
      )}
    </ObjectFrame>
  );
}

/* ------------------------------------------------------------------ Isbit */

export interface IsbitProps {
  /** Midt på forkanten av bunnen (ankerpunktet). */
  x: number;
  y: number;
  /** Kantlengden på isbiten før den smelter (standard 40). Med skrå sider er tegningen ca. 1,24 · size bred. */
  size?: number;
  /** Andel som har smeltet, 0–1: isbiten krymper, kantene rundes og vannpytten vokser. */
  smeltet?: number;
  rotate?: number;
  dim?: boolean;
  title?: string;
}

/**
 * Isbit sett litt ovenfra, gjennomskinnelig med melkehvit kjerne. Når den smelter, krymper den (volumet går ned med
 * `smeltet`) og ligger i en voksende vannpytt. (x, y) er midt på forkanten av bunnen.
 *   <Isbit x={300} y={240} size={46} smeltet={m} />
 */
export function Isbit({ x, y, size = 40, smeltet = 0, rotate, dim, title }: IsbitProps) {
  const S = Math.max(4, fin(size, 40));
  const k = S / 100;
  const sw = useLocalStroke(k);
  const id = useSvgId('isbit');
  const m = clamp01(smeltet);
  const s = Math.cbrt(1 - m);
  const E = 100 * s;
  const dx = 0.24 * E;
  const dy = -0.2 * E;
  const x0 = -(E + dx) / 2;
  const rc = E * (0.08 + 0.24 * m);
  const sil: [number, number][] = [
    [x0, 0],
    [x0 + E, 0],
    [x0 + E + dx, dy],
    [x0 + E + dx, -E + dy],
    [x0 + dx, -E + dy],
    [x0, -E],
  ];
  const silPath = roundedPolygon(sil, rc);
  const puddleRx = m > 0 ? 56 + 64 * Math.sqrt(m) : 0;
  const puddleRy = puddleRx * 0.13;
  const drop = m > 0.05 && m < 0.97 && E > 12;
  return (
    <ObjectFrame x={x} y={y} k={k} rotate={rotate} dim={dim} title={title}>
      {m > 0 && (
        <g>
          <ellipse
            cx={4}
            cy={r2(-puddleRy * 0.7)}
            rx={r2(puddleRx)}
            ry={r2(puddleRy)}
            fill={mix(alpha(SCENE.water, 0.32 + 0.2 * m), alpha(SCENE.waterLight, 0.4), 0.45)}
            stroke={alpha(SCENE.waterLight, 0.75)}
            strokeWidth={sw(1.1)}
          />
          <ellipse cx={r2(4 - puddleRx * 0.3)} cy={r2(-puddleRy * 1.05)} rx={r2(puddleRx * 0.4)} ry={r2(Math.max(puddleRy * 0.3, sw(1)))} fill={SCENE.highlight} opacity={0.85} />
        </g>
      )}
      {E > 2 && (
        <>
          <ContactShadow cx={r2(x0 + (E + dx) / 2)} cy={r2(dy / 2)} rx={r2(E * 0.62)} ry={r2(E * 0.14)} opacity={0.55} />
          <clipPath id={`${id}-c`}>
            <path d={silPath} />
          </clipPath>
          <LinearGradient id={`${id}-f`} x2={1} y2={1} stops={[[0, tint(SCENE.ice, 0.4), 0.9], [1, SCENE.ice, 0.88]]} />
          <RadialGradient id={`${id}-k`} stops={[[0, SCENE.iceShine, 0.75], [0.6, SCENE.iceShine, 0.3], [1, SCENE.iceShine, 0]]} />
          <g clipPath={`url(#${id}-c)`}>
            <path d={silPath} fill={`url(#${id}-f)`} />
            <path d={`M${r2(x0)},${r2(-E)}L${r2(x0 + E)},${r2(-E)}L${r2(x0 + E + dx)},${r2(-E + dy)}L${r2(x0 + dx)},${r2(-E + dy)}Z`} fill={SCENE.iceShine} opacity={0.75} />
            <path d={`M${r2(x0 + E)},0L${r2(x0 + E)},${r2(-E)}L${r2(x0 + E + dx)},${r2(-E + dy)}L${r2(x0 + E + dx)},${r2(dy)}Z`} fill={shade(SCENE.ice, 0.16)} opacity={0.85} />
            <ellipse cx={r2(x0 + E * 0.52 + dx * 0.3)} cy={r2(-E * 0.52)} rx={r2(E * 0.3)} ry={r2(E * 0.26)} fill={`url(#${id}-k)`} />
            <path
              d={`M${r2(x0 + rc)},${r2(-E + 0.6)}H${r2(x0 + E - rc * 0.5)}M${r2(x0 + 1.2)},${r2(-E + rc)}V${r2(-rc * 1.2)}`}
              stroke={SCENE.iceShine}
              strokeWidth={r2(Math.max(sw(1.4), E * 0.03))}
              strokeLinecap="round"
            />
            <path d={`M${r2(x0 + E)},${r2(-E + rc * 0.4)}V${r2(-rc * 0.6)}`} stroke={SCENE.iceShine} strokeWidth={sw(1)} opacity={0.6} />
            <path
              d={`M${r2(x0 + E * 0.16)},${r2(-E * 0.34)}L${r2(x0 + E * 0.5)},${r2(-E * 0.86)}L${r2(x0 + E * 0.62)},${r2(-E * 0.86)}L${r2(x0 + E * 0.28)},${r2(-E * 0.34)}Z`}
              fill={SCENE.iceShine}
              opacity={0.35}
            />
          </g>
          <ellipse cx={r2(x0 + dx * 0.9 + E * 0.3)} cy={r2(-E + dy * 0.5)} rx={r2(E * 0.09)} ry={r2(E * 0.03)} fill={SCENE.highlight} />
          {drop && (
            <path
              d={`M${r2(x0 + E * 0.78)},${r2(-E * 0.42)}q${r2(E * 0.045)},${r2(E * 0.08)} 0,${r2(E * 0.11)}q${r2(-E * 0.045)},${r2(-E * 0.03)} 0,${r2(-E * 0.11)}Z`}
              fill={alpha(SCENE.waterLight, 0.8)}
              stroke={alpha(SCENE.waterDeep, 0.6)}
              strokeWidth={sw(0.6)}
            />
          )}
          <path d={silPath} fill="none" stroke={mix(SCENE.glassEdge, SCENE.outline, 0.5)} strokeWidth={sw(1)} strokeLinejoin="round" />
        </>
      )}
    </ObjectFrame>
  );
}
