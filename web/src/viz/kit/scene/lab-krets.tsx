/**
 * Familien «lab», del 2: strømkretsen. Batteri, lyspære, motstand, multimeter, ledning og bryter.
 * Eksporteres videre fra lab.tsx.
 */
import { useMemo } from 'react';
import { useTextScale } from '../controls';
import { Txt } from '../txt';
import { ContactShadow, LinearGradient, RadialGradient, SCENE_DIM, alpha, mix, shade, sphereStops, tint, useStrokeScale, useSvgId } from './core';
import { PAINTS, SCENE, paint, type PaintName } from './palette';
import { LAB, ObjectFrame, ObjText, boxStops, circlePath, clamp01, cylinderStops, fin, localToFigure, r2, useLocalStroke, type Pt } from './lab-felles';

/* ------------------------------------------------------------------ Batteri */

export type BatteriType = 'aa' | '9v' | 'bil';

export interface BatteriProps {
  /** Midten av batteriet (ankerpunktet; `rotate` dreier om dette punktet). */
  x: number;
  y: number;
  /**
   * Lengden i figurens enheter. AA og bilbatteri ligger vannrett (size = bredden), 9 V-batteriet står med polene
   * opp (size = høyden). Standard 70 (AA, 9 V) og 170 (bil).
   */
  size?: number;
  /** AA (1,5 V, standard), 9 V-batteri eller bilbatteri (12 V). */
  type?: BatteriType;
  /** Teksten på batteriet (standard «1,5 V», «9 V» eller «12 V»). */
  spenning?: string;
  rotate?: number;
  dim?: boolean;
  title?: string;
}

const BATTERY_SIZE: Record<BatteriType, number> = { aa: 70, '9v': 70, bil: 170 };
const BATTERY_VOLTAGE: Record<BatteriType, string> = { aa: '1,5 V', '9v': '9 V', bil: '12 V' };
/** Polene i lokale enheter (lengden = 100). */
const BATTERY_POLES: Record<BatteriType, { pluss: [number, number]; minus: [number, number] }> = {
  aa: { pluss: [50, 0], minus: [-50, 0] },
  '9v': { pluss: [13, -50], minus: [-13, -50] },
  bil: { pluss: [36, -37.5], minus: [-36, -37.5] },
};

function batteryType(t: string | undefined): BatteriType {
  return t === '9v' || t === 'bil' ? t : 'aa';
}

/**
 * Hvor ledningene festes på et batteri (figurens enheter, med `rotate`): plusspolen og minuspolen.
 *   const p = batteriPoler({ x: 200, y: 150, size: 80 });
 *   <Ledning points={[[p.pluss.x, p.pluss.y], [300, 150], …]} />
 */
export function batteriPoler({ x, y, size, type, rotate }: BatteriProps): { pluss: Pt; minus: Pt } {
  const t = batteryType(type);
  const k = Math.max(4, fin(size, BATTERY_SIZE[t])) / 100;
  const p = BATTERY_POLES[t];
  return {
    pluss: localToFigure(p.pluss[0], p.pluss[1], x, y, k, rotate),
    minus: localToFigure(p.minus[0], p.minus[1], x, y, k, rotate),
  };
}

/**
 * Batteri: AA-celle (liggende, pluss til høyre), 9 V-batteri (stående, polene oppe, pluss til høyre) eller
 * bilbatteri (polene oppe, pluss til høyre med rød krage). (x, y) er midten.
 *   <Batteri x={160} y={200} size={90} />
 *   <Batteri x={160} y={200} size={180} type="bil" />
 * Koble ledninger til `batteriPoler(samme props)`.
 */
export function Batteri({ x, y, size, type, spenning, rotate, dim, title }: BatteriProps) {
  const t = batteryType(type);
  const S = Math.max(4, fin(size, BATTERY_SIZE[t]));
  const k = S / 100;
  const sw = useLocalStroke(k);
  const id = useSvgId('batteri');
  const text = spenning ?? BATTERY_VOLTAGE[t];
  const fitText = (base: number, room: number) => Math.min(base, room / Math.max(1, text.length * 0.6));
  const ol = { stroke: SCENE.outline, strokeWidth: sw(0.9) };
  if (t === 'aa') {
    return (
      <ObjectFrame x={x} y={y} k={k} rotate={rotate} dim={dim} title={title}>
        <LinearGradient id={`${id}-b`} stops={cylinderStops(PAINTS.svart, 1.3)} />
        <LinearGradient id={`${id}-c`} stops={cylinderStops(SCENE.copper)} />
        <LinearGradient id={`${id}-m`} stops={cylinderStops(SCENE.metal)} />
        <rect x={-50} y={-13.6} width={2.2} height={27.2} rx={0.9} fill={`url(#${id}-m)`} {...ol} />
        <rect x={45.6} y={-5.6} width={4.4} height={11.2} rx={1.5} fill={`url(#${id}-m)`} {...ol} />
        <rect x={-48.4} y={-14.4} width={66.4} height={28.8} rx={1.6} fill={`url(#${id}-b)`} />
        <path d="M18,-14.4H44.2Q46,-14.4 46,-12.6V12.6Q46,14.4 44.2,14.4H18Z" fill={`url(#${id}-c)`} />
        <path d="M44.4,-14V14" stroke={shade(SCENE.copper, 0.4)} strokeWidth={sw(0.8)} />
        <path d="M-45,-8.2H41" stroke={SCENE.highlight} strokeWidth={1.8} strokeLinecap="round" />
        <rect x={-48.4} y={-14.4} width={94.4} height={28.8} rx={1.8} fill="none" {...ol} />
        <ObjText x={-6} y={5} size={fitText(13.5, 44)} fill={PAINTS.hvit} weight={700}>
          {text}
        </ObjText>
        <ObjText x={-41.5} y={5.2} size={14} fill={PAINTS.hvit} weight={700}>
          −
        </ObjText>
        <ObjText x={32.5} y={5.8} size={17} fill={shade(SCENE.copper, 0.6)} weight={800}>
          +
        </ObjText>
      </ObjectFrame>
    );
  }
  if (t === '9v') {
    return (
      <ObjectFrame x={x} y={y} k={k} rotate={rotate} dim={dim} title={title}>
        <LinearGradient id={`${id}-b`} x2={1} y2={0} stops={boxStops(PAINTS.svart, 1.6)} />
        <LinearGradient id={`${id}-c`} x2={1} y2={0} stops={boxStops(SCENE.copper, 1.3)} />
        <LinearGradient id={`${id}-m`} x2={1} y2={0} stops={cylinderStops(SCENE.metal)} />
        <rect x={-26} y={-43.8} width={52} height={2.6} rx={1} fill={SCENE.metal} {...ol} />
        <rect x={9.4} y={-50} width={7.2} height={6.6} rx={1.5} fill={`url(#${id}-m)`} {...ol} />
        <path d="M-19.6,-43.2V-47L-17.6,-49.8H-8.4L-6.4,-47V-43.2Z" fill={`url(#${id}-m)`} {...ol} strokeLinejoin="round" />
        <path d="M-16,-47.4H-10" stroke={shade(SCENE.metal, 0.45)} strokeWidth={1.2} strokeLinecap="round" />
        <path d="M-27.3,-18H27.3V47Q27.3,50 24.3,50H-24.3Q-27.3,50 -27.3,47Z" fill={`url(#${id}-b)`} />
        <path d="M-27.3,-18V-39Q-27.3,-42 -24.3,-42H24.3Q27.3,-42 27.3,-39V-18Z" fill={`url(#${id}-c)`} />
        <path d="M-22.5,-37V44" stroke={SCENE.highlight} strokeWidth={2} strokeLinecap="round" />
        <path d="M-27.3,-39Q-27.3,-42 -24.3,-42H24.3Q27.3,-42 27.3,-39V47Q27.3,50 24.3,50H-24.3Q-27.3,50 -27.3,47Z" fill="none" {...ol} />
        <ObjText x={0} y={23} size={fitText(20, 48)} fill={PAINTS.hvit} weight={700}>
          {text}
        </ObjText>
        <ObjText x={13} y={-25} size={13} fill={shade(SCENE.copper, 0.6)} weight={800}>
          +
        </ObjText>
        <ObjText x={-13} y={-25.5} size={13} fill={shade(SCENE.copper, 0.6)} weight={800}>
          −
        </ObjText>
      </ObjectFrame>
    );
  }
  const caseColor = SCENE.rubberLight;
  return (
    <ObjectFrame x={x} y={y} k={k} rotate={rotate} dim={dim} title={title}>
      <LinearGradient id={`${id}-b`} x2={1} y2={0} stops={boxStops(caseColor, 1.4)} />
      <LinearGradient id={`${id}-l`} stops={[[0, tint(caseColor, 0.28)], [1, tint(caseColor, 0.1)]]} />
      <LinearGradient id={`${id}-m`} x2={1} y2={0} stops={cylinderStops(SCENE.metalDark)} />
      <path d="M31.4,-30.5L32.6,-37.6H39.4L40.6,-30.5ZM-40.6,-30.5L-39.4,-37.6H-32.6L-31.4,-30.5Z" fill={`url(#${id}-m)`} {...ol} strokeLinejoin="round" />
      <rect x={29.8} y={-33.2} width={12.4} height={2.8} rx={0.9} fill={PAINTS.rod} {...ol} />
      <rect x={-42.2} y={-33.2} width={12.4} height={2.8} rx={0.9} fill={PAINTS.svart} {...ol} />
      <path d="M-50,-24V33Q-50,36 -47,36H47Q50,36 50,33V-24Z" fill={`url(#${id}-b)`} />
      <path d="M-51,-24V-28Q-51,-30.5 -48.5,-30.5H48.5Q51,-30.5 51,-28V-24Z" fill={`url(#${id}-l)`} {...ol} />
      <path d="M-28,-27.2h6M-18,-27.2h6M-8,-27.2h6M2,-27.2h6M12,-27.2h6M22,-27.2h6" stroke={shade(caseColor, 0.35)} strokeWidth={1.6} strokeLinecap="round" />
      <path d="M-50,-24V33Q-50,36 -47,36H47Q50,36 50,33V-24" fill="none" {...ol} />
      <rect x={-37} y={-12} width={74} height={40} rx={2.5} fill={tint(caseColor, 0.12)} stroke={shade(caseColor, 0.3)} strokeWidth={sw(0.6)} />
      <rect x={-37} y={-7} width={74} height={3} fill={PAINTS.gul} />
      <path d="M-47,-21.6H47" stroke={SCENE.highlight} strokeWidth={1.2} strokeLinecap="round" />
      <ObjText x={0} y={16} size={fitText(19, 66)} fill={PAINTS.hvit} weight={700}>
        {text}
      </ObjText>
      <ObjText x={44} y={-13} size={10} fill={PAINTS.hvit} weight={800}>
        +
      </ObjText>
      <ObjText x={-44} y={-13.5} size={10} fill={PAINTS.hvit} weight={800}>
        −
      </ObjText>
    </ObjectFrame>
  );
}

/* ------------------------------------------------------------------ Lyspære */

export interface LyspaereProps {
  /** Bunnen av sokkelen (fotkontakten), eller bunnen av fatningen med `fatning` (ankerpunktet). */
  x: number;
  y: number;
  /** Høyden på pæra, glass og sokkel (standard 90). Fatningen kommer i tillegg (ca. 0,07 · size). */
  size?: number;
  /** 0–1: glødetråden går fra mørk til rødglødende til hvitgul, og pæra lyser opp rundt seg. */
  lysstyrke?: number;
  /** Pæra står i en fatning på en liten sokkel med to skruklemmer (som i skolelaben). */
  fatning?: boolean;
  rotate?: number;
  dim?: boolean;
  title?: string;
}

const BULB_H = 108;

/**
 * Hvor ledningene festes på lyspæra (figurens enheter). Med `fatning`: venstre (a) og høyre (b) skruklemme.
 * Uten: fotkontakten nederst (a) og gjengene på venstre side (b).
 *   const p = lyspaerePoler({ x: 400, y: 200, size: 90, fatning: true });
 */
export function lyspaerePoler({ x, y, size, fatning, rotate }: LyspaereProps): { a: Pt; b: Pt } {
  const k = Math.max(4, fin(size, 90)) / BULB_H;
  if (fatning) return { a: localToFigure(-28, -19.5, x, y, k, rotate), b: localToFigure(28, -19.5, x, y, k, rotate) };
  return { a: localToFigure(0, 0, x, y, k, rotate), b: localToFigure(-13.6, -17, x, y, k, rotate) };
}

const GLOBE = 'M-13.5,-27C-13.5,-38 -19,-51.8 -25.4,-62A30,30 0 1,1 25.4,-62C19,-51.8 13.5,-38 13.5,-27Z';
const THREAD =
  'M-13,-27H13Q14.7,-24.8 13,-22.6Q14.7,-20.4 13,-18.2Q14.7,-16 13,-13.8Q14.7,-11.6 13,-9.4L11.4,-8H-11.4L-13,-9.4Q-14.7,-11.6 -13,-13.8Q-14.7,-16 -13,-18.2Q-14.7,-20.4 -13,-22.6Q-14.7,-24.8 -13,-27Z';
const COIL = `M-9.5,-74${'a1.357,2.1 0 1,1 2.714,0'.repeat(7)}`;
/** Retningene til lysstrålene rundt en pære som lyser godt (radianer, 0 = mot høyre, ikke ned mot sokkelen). */
const RAYS = [-168, -138, -110, -90, -70, -42, -12, 18, 162].map((d) => (d * Math.PI) / 180);

/** Fargen på glødetråden: mørk metall → rødglødende → oransje → hvitgul. */
function filamentColor(l: number): string {
  if (l <= 0.005) return SCENE.metalDark;
  if (l < 0.18) return mix(SCENE.metalDark, SCENE.hot, l / 0.18);
  const c = mix(SCENE.hot, SCENE.glow, Math.min(1, (l - 0.18) / 0.55));
  return l > 0.75 ? tint(c, (l - 0.75) * 1.8) : c;
}

/**
 * Glødelampe med glass, glødetråd og E27-sokkel. `lysstyrke` (0–1) får glødetråden til å gløde og lyset til å spre
 * seg rundt pæra. (x, y) er bunnen av sokkelen, eller bunnen av fatningen med `fatning`.
 *   <Lyspaere x={400} y={220} size={100} lysstyrke={P / Pmaks} fatning />
 */
export function Lyspaere({ x, y, size = 90, lysstyrke = 0, fatning = false, rotate, dim, title }: LyspaereProps) {
  const S = Math.max(4, fin(size, 90));
  const k = S / BULB_H;
  const sw = useLocalStroke(k);
  const id = useSvgId('lyspaere');
  const L = clamp01(lysstyrke);
  const lit = L > 0.01;
  const off = fatning ? -8 : 0;
  const fil = filamentColor(L);
  const black = PAINTS.svart;
  return (
    <ObjectFrame x={x} y={y} k={k} rotate={rotate} dim={dim} title={title}>
      {fatning && <ContactShadow cx={0} cy={0} rx={40} ry={4} />}
      {lit && (
        <>
          <RadialGradient
            id={`${id}-h`}
            stops={[
              [0, SCENE.glow, 0.7 * L],
              [0.38, SCENE.glow, 0.32 * L],
              [0.62, SCENE.warm, 0.1 * L],
              [1, SCENE.warm, 0],
            ]}
          />
          <circle cx={0} cy={-76 + off} r={r2(36 + 56 * L)} fill={`url(#${id}-h)`} />
          {L > 0.3 && (
            <path
              d={RAYS.map((a) => {
                const c = Math.cos(a);
                const s = Math.sin(a);
                const r0 = 37;
                const r1 = 37 + 15 * Math.min(1, (L - 0.3) / 0.6);
                return `M${r2(c * r0)},${r2(-78 + off + s * r0)}L${r2(c * r1)},${r2(-78 + off + s * r1)}`;
              }).join('')}
              stroke={mix(SCENE.warm, SCENE.glow, 0.25)}
              strokeWidth={r2(Math.max(sw(2), 2.2))}
              strokeLinecap="round"
              opacity={r2(Math.min(1, (L - 0.3) / 0.4))}
            />
          )}
        </>
      )}
      <g transform={off ? `translate(0 ${off})` : undefined}>
        <RadialGradient
          id={`${id}-g`}
          cx={0.42}
          cy={0.36}
          r={0.62}
          stops={[
            [0, tint(SCENE.glass, 0.6), 0.22],
            [0.72, SCENE.glass, 0.34],
            [1, SCENE.glassEdge, 0.72],
          ]}
        />
        <LinearGradient id={`${id}-m`} x2={1} y2={0} stops={cylinderStops(SCENE.metal)} />
        <path d={GLOBE} fill={`url(#${id}-g)`} />
        <path d="M-6.5,-27C-5,-35 -4,-44 -3.6,-49.5H3.6C4,-44 5,-35 6.5,-27Z" fill={alpha(SCENE.glassEdge, 0.4)} stroke={alpha(SCENE.glassEdge, 0.8)} strokeWidth={sw(0.6)} />
        <path d="M-3.2,-49L-9.5,-74M3.2,-49L9.5,-74" stroke={SCENE.metalDark} strokeWidth={sw(1.1)} strokeLinecap="round" />
        {lit && <path d={COIL} fill="none" stroke={SCENE.glow} strokeWidth={r2(3 + 5 * L)} strokeLinecap="round" opacity={r2(0.35 + 0.45 * L)} />}
        <path d={COIL} fill="none" stroke={fil} strokeWidth={r2(Math.max(sw(1.2), 1.1))} strokeLinecap="round" />
        {lit && (
          <>
            <RadialGradient
              id={`${id}-i`}
              cx={0.5}
              cy={0.38}
              r={0.6}
              stops={[
                [0, SCENE.glow, 0.85 * L],
                [0.5, SCENE.glow, 0.45 * L],
                [1, SCENE.warm, 0.2 * L],
              ]}
            />
            <path d={GLOBE} fill={`url(#${id}-i)`} />
          </>
        )}
        <path d="M-19,-95Q-25,-87 -24.6,-76" fill="none" stroke={SCENE.highlight} strokeWidth={3} strokeLinecap="round" />
        <circle cx={-12} cy={-99} r={1.8} fill={SCENE.highlight} />
        <path d={GLOBE} fill="none" stroke={mix(SCENE.glassEdge, SCENE.outline, 0.55)} strokeWidth={sw(1)} />
        <path d={THREAD} fill={`url(#${id}-m)`} stroke={SCENE.outline} strokeWidth={sw(0.8)} strokeLinejoin="round" />
        <path
          d="M-13,-24.4L13,-22.8M-13,-20L13,-18.4M-13,-15.6L13,-14M-13,-11.2L13,-9.6"
          stroke={shade(SCENE.metal, 0.35)}
          strokeWidth={sw(0.8)}
          opacity={0.75}
        />
        <path d="M-11.4,-8H11.4L8,-4H-8Z" fill={SCENE.rubber} />
        <path d="M-5,-4H5Q4.6,0 0,0Q-4.6,0 -5,-4Z" fill={SCENE.gold} stroke={SCENE.outline} strokeWidth={sw(0.7)} />
      </g>
      {fatning && (
        <g>
          <LinearGradient id={`${id}-p`} x2={1} y2={0} stops={boxStops(black, 1.5)} />
          <LinearGradient id={`${id}-n`} x2={1} y2={0} stops={cylinderStops(SCENE.gold)} />
          <path d="M-36,-9H36V-2Q36,0 34,0H-34Q-36,0 -36,-2Z" fill={`url(#${id}-p)`} stroke={SCENE.outline} strokeWidth={sw(0.9)} />
          <path d="M-36,-9V-11.5Q-36,-13.5 -34,-13.5H34Q36,-13.5 36,-11.5V-9Z" fill={tint(black, 0.28)} stroke={SCENE.outline} strokeWidth={sw(0.9)} />
          <path d="M-30.2,-12V-18H-25.8V-12ZM25.8,-12V-18H30.2V-12Z" fill={`url(#${id}-n)`} stroke={SCENE.outline} strokeWidth={sw(0.7)} />
          <path d="M-32,-18V-21.6H-24V-18ZM24,-18V-21.6H32V-18Z" fill={`url(#${id}-n)`} stroke={SCENE.outline} strokeWidth={sw(0.7)} />
        </g>
      )}
      {fatning && (
        <g>
          <LinearGradient id={`${id}-s`} x2={1} y2={0} stops={cylinderStops(black, 1.4)} />
          <path d="M-16,-12V-31Q-16,-34 -13,-34H13Q16,-34 16,-31V-12Z" fill={`url(#${id}-s)`} stroke={SCENE.outline} strokeWidth={sw(0.9)} />
          <path d="M-14.4,-32.6H14.4" stroke={SCENE.highlight} strokeWidth={1} strokeLinecap="round" />
        </g>
      )}
    </ObjectFrame>
  );
}

/* ------------------------------------------------------------------ Motstand */

export interface MotstandProps {
  /** Endene på tilkoblingstrådene (der ledningene festes). */
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  /** Tekst ved motstanden, f.eks. «R₁» eller «220 Ω». Står over (eller til høyre for en loddrett motstand). */
  label?: string;
  /** Hvor etiketten står: «above» (standard: over, eller til høyre for en loddrett motstand) eller «below» (under, eller til venstre). */
  labelSide?: 'above' | 'below';
  /** Resistansen i ohm, som bestemmer fargeringene. Uten den leses verdien fra `label` («4,7 kΩ»), ellers 220 Ω. */
  ohm?: number;
  /** Lengden på kroppen (standard ca. 0,42 · avstanden, høyst 56). Tykkelsen er 0,36 · lengden. */
  size?: number;
  dim?: boolean;
  title?: string;
}

/** Fargeringene for en resistans: to sifre og en multiplikator (tierpotens fra −2 til 9). */
function resistorDigits(ohm: number): [number, number, number] {
  if (!(ohm > 0) || !Number.isFinite(ohm)) return [2, 2, 1];
  let e = Math.floor(Math.log10(ohm) + 1e-9) - 1;
  let sig = Math.round(ohm / 10 ** e);
  if (sig >= 100) {
    sig = Math.round(sig / 10);
    e += 1;
  }
  if (e < -2) return [Math.floor(sig / 10), sig % 10, -2];
  if (e > 9) return [9, 9, 9];
  return [Math.floor(sig / 10), sig % 10, e];
}

function parseOhm(label: string | undefined): number | undefined {
  if (!label) return undefined;
  const m = /(\d+(?:[.,]\d+)?)\s*([kM])?\s*Ω/.exec(label);
  if (!m) return undefined;
  const v = Number(m[1]!.replace(',', '.'));
  return v * (m[2] === 'k' ? 1e3 : m[2] === 'M' ? 1e6 : 1);
}

/**
 * Motstand (resistor) med fargeringer, liggende mellom to punkter med tilkoblingstrådene. Fargekoden følger
 * resistansen (`ohm`, eller tallet i `label`).
 *   <Motstand x1={300} y1={120} x2={460} y2={120} label="R₁ = 220 Ω" />
 */
export function Motstand({ x1, y1, x2, y2, label, labelSide = 'above', ohm, size, dim, title }: MotstandProps) {
  const ss = useStrokeScale();
  const f = useTextScale();
  const id = useSvgId('motstand');
  const ax = fin(x1, 0);
  const ay = fin(y1, 0);
  const bx = fin(x2, ax + 100);
  const by = fin(y2, ay);
  const len = Math.hypot(bx - ax, by - ay);
  if (!(len > 1)) return null;
  const ux = (bx - ax) / len;
  const uy = (by - ay) / len;
  let L = fin(size, Math.min(56, Math.max(24, len * 0.42)));
  if (L > len - 6) L = Math.max(6, len - 6);
  const D = L * 0.36;
  const mx = (ax + bx) / 2;
  const my = (ay + by) / 2;
  // Fargeringene leses fra venstre (eller ovenfra): snu vinkelen til (−90°, 90°].
  let ang = (Math.atan2(uy, ux) * 180) / Math.PI;
  if (ang > 90) ang -= 180;
  if (ang <= -90) ang += 180;
  const [d1, d2, mult] = resistorDigits(ohm ?? parseOhm(label) ?? 220);
  const bandColor = (d: number) => (d === -1 ? SCENE.gold : d === -2 ? SCENE.metal : (LAB.bands[d] ?? LAB.bands[0]!));
  const bands = [
    { at: 0.2, c: bandColor(d1) },
    { at: 0.34, c: bandColor(d2) },
    { at: 0.48, c: bandColor(mult) },
    { at: 0.79, c: SCENE.gold },
  ];
  const h = L / 2;
  const e = D * 0.62;
  const body = `M${r2(-h)},0C${r2(-h)},${r2(-D / 2)} ${r2(-h + e * 0.7)},${r2(-D / 2)} ${r2(-h + e)},${r2((-D / 2) * 0.84)}L${r2(h - e)},${r2((-D / 2) * 0.84)}C${r2(h - e * 0.7)},${r2(-D / 2)} ${r2(h)},${r2(-D / 2)} ${r2(h)},0C${r2(h)},${r2(D / 2)} ${r2(h - e * 0.7)},${r2(D / 2)} ${r2(h - e)},${r2((D / 2) * 0.84)}L${r2(-h + e)},${r2((D / 2) * 0.84)}C${r2(-h + e * 0.7)},${r2(D / 2)} ${r2(-h)},${r2(D / 2)} ${r2(-h)},0Z`;
  const ex = (L / 2 - D * 0.1) * ux;
  const ey = (L / 2 - D * 0.1) * uy;
  const leads = `M${r2(ax)},${r2(ay)}L${r2(mx - ex)},${r2(my - ey)}M${r2(mx + ex)},${r2(my + ey)}L${r2(bx)},${r2(by)}`;
  const horizontal = Math.abs(ux) >= Math.abs(uy);
  const below = labelSide === 'below';
  const tx = horizontal ? mx : below ? mx - D / 2 - 8 * f : mx + D / 2 + 8 * f;
  const ty = horizontal ? (below ? my + D / 2 + 20 * f : my - D / 2 - 9 * f) : my + 5.5 * f;
  return (
    <g opacity={dim ? SCENE_DIM : undefined}>
      {title && <title>{title}</title>}
      <path d={leads} stroke={shade(SCENE.metal, 0.45)} strokeWidth={r2(3 * ss)} strokeLinecap="round" fill="none" />
      <path d={leads} stroke={tint(SCENE.metal, 0.25)} strokeWidth={r2(1.6 * ss)} strokeLinecap="round" fill="none" />
      <g transform={`translate(${r2(mx)} ${r2(my)}) rotate(${r2(ang)})`}>
        <clipPath id={`${id}-c`}>
          <path d={body} />
        </clipPath>
        <LinearGradient
          id={`${id}-s`}
          stops={[
            [0, SCENE.shadow, 0.5],
            [0.22, SCENE.highlight, 0.95],
            [0.45, SCENE.highlight, 0],
            [0.72, SCENE.shadow, 0.12],
            [1, SCENE.shadow, 0.85],
          ]}
        />
        <path d={body} fill={LAB.resistor} />
        <g clipPath={`url(#${id}-c)`}>
          {bands.map((b, i) => (
            <rect key={i} x={r2(-h + L * b.at)} y={r2(-D)} width={r2(L * 0.075)} height={r2(2 * D)} fill={b.c} />
          ))}
        </g>
        <path d={body} fill={`url(#${id}-s)`} stroke={SCENE.outline} strokeWidth={r2(1 * ss)} />
      </g>
      {label && (
        <Txt x={r2(tx)} y={r2(ty)} anchor={horizontal ? 'middle' : below ? 'end' : 'start'} size={0.85} weight={650}>
          {label}
        </Txt>
      )}
    </g>
  );
}

/* ------------------------------------------------------------------ Multimeter */

export type MultimeterModus = 'A' | 'V' | 'Ω';

export interface MultimeterProps {
  /** Midten av multimeteret (ankerpunktet). */
  x: number;
  y: number;
  /** Høyden (standard 140). Bredden er 0,56 · size. Teksten i vinduet følger size, så gjør den større på mobil. */
  size?: number;
  /** Teksten i vinduet, f.eks. «0,52 A» eller «12,0 V». Enheten etter siste mellomrom skrives mindre. */
  visning: string;
  /** Hva bryteren står på: amperemeter (A), voltmeter (V) eller ohmmeter (Ω). Velger også inngangen. */
  modus: MultimeterModus;
  /** Fargen på gummikanten (standard «gul»). */
  lakk?: PaintName | string;
  /** Tegn pluggene i COM (svart) og den aktive inngangen (rød). Standard: ja. */
  plugger?: boolean;
  rotate?: number;
  dim?: boolean;
  title?: string;
}

/** Vinkelen (grader med klokka fra rett opp) til hver stilling på bryteren. */
const DIAL: { modus: MultimeterModus | 'av'; label: string; ang: number }[] = [
  { modus: 'av', label: 'AV', ang: -118 },
  { modus: 'V', label: 'V', ang: -52 },
  { modus: 'Ω', label: 'Ω', ang: 0 },
  { modus: 'A', label: 'A', ang: 52 },
];
const MM_H = 150;
const JACK_Y = 50;
const JACKS = [
  { x: -22, label: 'A' },
  { x: 0, label: 'COM' },
  { x: 22, label: 'VΩ' },
];

/**
 * Hvor ledningene festes på multimeteret (figurens enheter): COM (svart) og den aktive inngangen (rød):
 * A-inngangen når `modus` er «A», ellers VΩ-inngangen.
 *   const p = multimeterPunkter({ x: 600, y: 180, size: 140, visning: '', modus: 'A' });
 *   <Ledning points={[[p.inn.x, p.inn.y], …]} farge="rod" />
 */
export function multimeterPunkter({ x, y, size, modus, rotate }: MultimeterProps): { com: Pt; inn: Pt } {
  const k = Math.max(10, fin(size, 140)) / MM_H;
  return {
    com: localToFigure(0, JACK_Y, x, y, k, rotate),
    inn: localToFigure(modus === 'A' ? -22 : 22, JACK_Y, x, y, k, rotate),
  };
}

/**
 * Digitalt multimeter med vindu, dreiebryter (AV, V, Ω, A) og tre innganger. Vinduet viser `visning`.
 * (x, y) er midten. Koble ledningene til `multimeterPunkter(samme props)`.
 *   <Multimeter x={620} y={170} size={150} visning={`${fmt(I, 2)} A`} modus="A" />
 */
export function Multimeter({ x, y, size = 140, visning, modus, lakk = 'gul', plugger = true, rotate, dim, title }: MultimeterProps) {
  const S = Math.max(10, fin(size, 140));
  const k = S / MM_H;
  const sw = useLocalStroke(k);
  const id = useSvgId('multimeter');
  const shell = paint(lakk);
  const face = SCENE.rubberLight;
  const active = DIAL.find((d) => d.modus === modus) ?? DIAL[0]!;
  const raw = (visning ?? '').trim();
  const cut = raw.lastIndexOf(' ');
  const num = cut > 0 ? raw.slice(0, cut) : raw;
  const unit = cut > 0 ? raw.slice(cut + 1) : '';
  const right = 25;
  const fsMax = 18;
  const unitFs = fsMax * 0.72;
  const unitW = unit.length * unitFs * 0.62;
  const numRoom = right - (unit ? unitW + 2.5 : 0) + 25;
  const fs = Math.min(fsMax, numRoom / Math.max(1, num.length * 0.61));
  const inn = modus === 'A' ? -22 : 22;
  const ol = { stroke: SCENE.outline, strokeWidth: sw(0.9) };
  return (
    <ObjectFrame x={x} y={y} k={k} rotate={rotate} dim={dim} title={title}>
      <LinearGradient id={`${id}-h`} x2={1} y2={0} stops={boxStops(shell, 1.3)} />
      <LinearGradient id={`${id}-f`} stops={[[0, tint(face, 0.12)], [1, shade(face, 0.12)]]} />
      <LinearGradient id={`${id}-d`} x2={1} y2={1} stops={[[0, tint(SCENE.display, 0.1)], [1, SCENE.display]]} />
      <RadialGradient id={`${id}-k`} fx={0.36} fy={0.32} stops={sphereStops(SCENE.rubber)} />
      <rect x={-42} y={-75} width={84} height={150} rx={11} fill={`url(#${id}-h)`} {...ol} />
      <path d="M-36,-72.5H36" stroke={SCENE.highlight} strokeWidth={1.4} strokeLinecap="round" />
      <rect x={-35} y={-68} width={70} height={134} rx={6} fill={`url(#${id}-f)`} {...ol} />
      {/* Vindu */}
      <rect x={-29} y={-61} width={58} height={30} rx={3.5} fill={`url(#${id}-d)`} stroke={shade(face, 0.4)} strokeWidth={sw(1)} />
      <path d="M-26,-58.5L-6,-58.5L-16,-33.5L-26,-33.5Z" fill={SCENE.highlight} opacity={0.18} />
      {num && (
        <ObjText x={unit ? right - unitW - 2.5 : right} y={-39.5} size={r2(fs)} fill={SCENE.displayText} anchor="end" weight={700} mono>
          {num}
        </ObjText>
      )}
      {unit && (
        <ObjText x={right} y={-39.5} size={unitFs} fill={SCENE.displayText} anchor="end" weight={700}>
          {unit}
        </ObjText>
      )}
      <path d="M-23,-24h9M14,-24h9" stroke={shade(face, 0.35)} strokeWidth={4.2} strokeLinecap="round" />
      <path d="M-23,-25.1h9M14,-25.1h9" stroke={tint(face, 0.25)} strokeWidth={1.2} strokeLinecap="round" />
      {/* Dreiebryter */}
      <circle cx={0} cy={8} r={24.5} fill={shade(face, 0.22)} stroke={shade(face, 0.45)} strokeWidth={sw(0.8)} />
      <path
        d={DIAL.map((d) => {
          const t = (d.ang * Math.PI) / 180;
          return `M${r2(Math.sin(t) * 24.5)},${r2(8 - Math.cos(t) * 24.5)}L${r2(Math.sin(t) * 27.5)},${r2(8 - Math.cos(t) * 27.5)}`;
        }).join('')}
        stroke={tint(face, 0.5)}
        strokeWidth={sw(1)}
      />
      {DIAL.map((d) => {
        const t = (d.ang * Math.PI) / 180;
        const on = d === active;
        return (
          <ObjText
            key={d.label}
            x={Math.sin(t) * 31}
            y={8 - Math.cos(t) * 31 + 3}
            size={d.label.length > 1 ? 6.5 : 8.5}
            fill={on ? SCENE.plastic : alpha(SCENE.plastic, 0.62)}
            weight={on ? 800 : 600}
          >
            {d.label}
          </ObjText>
        );
      })}
      <circle cx={0} cy={8} r={17} fill={`url(#${id}-k)`} {...ol} />
      <g transform={`rotate(${active.ang} 0 8)`}>
        <rect x={-5.5} y={-9.5} width={11} height={35} rx={5.5} fill={tint(SCENE.rubber, 0.16)} {...ol} />
        <path d="M0,-7.5V-1" stroke={SCENE.plastic} strokeWidth={2.2} strokeLinecap="round" />
      </g>
      {/* Innganger */}
      <path
        d={JACKS.map((j) => circlePath(j.x, JACK_Y, 6.4)).join('')}
        fill={shade(face, 0.3)}
        stroke={SCENE.outline}
        strokeWidth={sw(0.8)}
      />
      <path d={JACKS.map((j) => circlePath(j.x, JACK_Y, 4.6)).join('')} fill="none" stroke={PAINTS.rod} strokeWidth={1.6} />
      <circle cx={0} cy={JACK_Y} r={4.6} fill="none" stroke={tint(face, 0.3)} strokeWidth={1.7} />
      <path d={JACKS.map((j) => circlePath(j.x, JACK_Y, 2.2)).join('')} fill={SCENE.rubber} />
      {JACKS.map((j) => (
        <ObjText key={j.label} x={j.x} y={JACK_Y - 9.5} size={j.label.length > 1 ? 5.6 : 6.6} fill={alpha(SCENE.plastic, 0.85)} weight={700}>
          {j.label}
        </ObjText>
      ))}
      {plugger && (
        <g>
          <RadialGradient id={`${id}-pr`} fx={0.36} fy={0.3} stops={sphereStops(PAINTS.rod)} />
          <RadialGradient id={`${id}-pb`} fx={0.36} fy={0.3} stops={sphereStops(PAINTS.svart)} />
          <circle cx={inn} cy={JACK_Y} r={6.8} fill={`url(#${id}-pr)`} {...ol} />
          <circle cx={0} cy={JACK_Y} r={6.8} fill={`url(#${id}-pb)`} {...ol} />
          <path d={`${circlePath(inn, JACK_Y, 3)}${circlePath(0, JACK_Y, 3)}`} fill="none" stroke={SCENE.highlight} strokeWidth={0.9} opacity={0.7} />
        </g>
      )}
    </ObjectFrame>
  );
}

/* ------------------------------------------------------------------ Ledning */

export type LedningFarge = 'rod' | 'svart' | 'blaa' | 'gul';

export interface LedningProps {
  /** Punktene ledningen går gjennom (figurens enheter). Er første og siste punkt like, er ledningen en lukket sløyfe. */
  points: [number, number][];
  /** Fargen på isolasjonen (standard «rod»). */
  farge?: LedningFarge;
  /** Radius i hjørnene (standard 12). */
  hjornerradius?: number;
  /** Tykkelsen (standard 5, litt tykkere på mobil). */
  bredde?: number;
  /**
   * Prikker (eller små piler) som viser strømretningen (konvensjonell strøm, fra + til −). `fase` styres av kapittelet:
   * 1 = prikkene har flyttet seg én avstand fremover (f.eks. fase = I · clock.t · 2). `retning` 1 = fra første mot siste
   * punkt, −1 = motsatt. `avstand` mellom prikkene (standard 26), `farge` (standard varmt gult lys).
   */
  strom?: { fase: number; retning?: 1 | -1; avstand?: number; farge?: string; form?: 'prikk' | 'pil' };
  dim?: boolean;
  title?: string;
}

interface WireSeg {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  /** Kontrollpunkt for en avrundet bit (kvadratisk Bézier). */
  cx?: number;
  cy?: number;
  len: number;
}

function quadPoint(s: WireSeg, t: number): [number, number] {
  const u = 1 - t;
  return [u * u * s.x0 + 2 * u * t * s.cx! + t * t * s.x1, u * u * s.y0 + 2 * u * t * s.cy! + t * t * s.y1];
}

/** Stien med avrundede hjørner og bitene (rette og buede) med lengder, til prikkene. */
function wireGeometry(points: [number, number][], r: number): { d: string; segs: WireSeg[]; total: number; closed: boolean } | null {
  let pts = points.filter((p) => Number.isFinite(p[0]) && Number.isFinite(p[1]));
  if (pts.length < 2) return null;
  const first = pts[0]!;
  const last = pts[pts.length - 1]!;
  const closed = pts.length >= 4 && Math.hypot(first[0] - last[0], first[1] - last[1]) < 0.5;
  if (closed) {
    // Start midt på første kant, så alle hjørnene (også det første) blir avrundet.
    const v = pts.slice(0, -1);
    const a = v[0]!;
    const b = v[1]!;
    const m: [number, number] = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    pts = [m, ...v.slice(1), a, m];
  }
  const segs: WireSeg[] = [];
  let cur = pts[0]!;
  let d = `M${r2(cur[0])},${r2(cur[1])}`;
  const line = (to: [number, number]) => {
    const len = Math.hypot(to[0] - cur[0], to[1] - cur[1]);
    if (len > 1e-6) segs.push({ x0: cur[0], y0: cur[1], x1: to[0], y1: to[1], len });
    d += `L${r2(to[0])},${r2(to[1])}`;
    cur = to;
  };
  for (let i = 1; i < pts.length; i++) {
    const p = pts[i]!;
    const next = pts[i + 1];
    if (!next) {
      line(p);
      break;
    }
    const prev = pts[i - 1]!;
    const l1 = Math.hypot(p[0] - prev[0], p[1] - prev[1]);
    const l2 = Math.hypot(next[0] - p[0], next[1] - p[1]);
    const rr = Math.max(0, Math.min(r, l1 / 2, l2 / 2));
    if (rr < 0.5 || l1 < 1e-6 || l2 < 1e-6) {
      line(p);
      continue;
    }
    const s: [number, number] = [p[0] - ((p[0] - prev[0]) / l1) * rr, p[1] - ((p[1] - prev[1]) / l1) * rr];
    const e: [number, number] = [p[0] + ((next[0] - p[0]) / l2) * rr, p[1] + ((next[1] - p[1]) / l2) * rr];
    line(s);
    const seg: WireSeg = { x0: s[0], y0: s[1], cx: p[0], cy: p[1], x1: e[0], y1: e[1], len: 0 };
    let qlen = 0;
    let q0: [number, number] = s;
    for (let j = 1; j <= 8; j++) {
      const q = quadPoint(seg, j / 8);
      qlen += Math.hypot(q[0] - q0[0], q[1] - q0[1]);
      q0 = q;
    }
    seg.len = qlen;
    segs.push(seg);
    d += `Q${r2(p[0])},${r2(p[1])} ${r2(e[0])},${r2(e[1])}`;
    cur = e;
  }
  const total = segs.reduce((sum, s) => sum + s.len, 0);
  return { d, segs, total, closed };
}

/**
 * Isolert ledning med avrundede hjørner gjennom punktene. Med `strom` viser prikker (eller små piler) strømretningen;
 * kapittelet flytter dem med `fase`. Tegn gjerne hele kretsen som én lukket ledning og komponentene oppå, så går
 * prikkene jevnt rundt.
 *   <Ledning points={[[100, 80], [400, 80], [400, 220], [100, 220], [100, 80]]} farge="rod" strom={{ fase: I * clock.t }} />
 */
export function Ledning({ points, farge = 'rod', hjornerradius = 12, bredde = 5, strom, dim, title }: LedningProps) {
  const ss = useStrokeScale();
  const key = points.map((p) => `${p[0]},${p[1]}`).join(';');
  const geo = useMemo(() => wireGeometry(points, Math.max(0, fin(hjornerradius, 12))), [key, hjornerradius]);
  if (!geo) return null;
  const color = paint(farge === 'rod' || farge === 'svart' || farge === 'blaa' || farge === 'gul' ? farge : 'rod');
  const w = Math.max(1, fin(bredde, 5)) * ss;
  let marks: { d: string; form: 'prikk' | 'pil'; fill: string } | null = null;
  if (strom && geo.total > 1) {
    const form = strom.form === 'pil' ? 'pil' : 'prikk';
    let gap = Math.max(6, fin(strom.avstand, 26));
    if (geo.closed) gap = geo.total / Math.max(1, Math.round(geo.total / gap));
    const phase = ((fin(strom.fase, 0) % 1) + 1) % 1;
    const dir = strom.retning === -1 ? -1 : 1;
    const parts: string[] = [];
    const rDot = w * 0.44;
    let si = 0;
    let acc = 0;
    const count = Math.floor(geo.total / gap) + 1;
    const positions: number[] = [];
    for (let i = 0; i < count; i++) {
      const s = (phase + i) * gap;
      if (s > geo.total) break;
      positions.push(dir === 1 ? s : geo.total - s);
    }
    positions.sort((p, q) => p - q);
    for (const s of positions) {
      while (si < geo.segs.length - 1 && acc + geo.segs[si]!.len < s) {
        acc += geo.segs[si]!.len;
        si++;
      }
      const seg = geo.segs[si];
      if (!seg) break;
      const t = Math.min(1, Math.max(0, (s - acc) / (seg.len || 1)));
      let px: number;
      let py: number;
      let tx: number;
      let ty: number;
      if (seg.cx === undefined) {
        px = seg.x0 + (seg.x1 - seg.x0) * t;
        py = seg.y0 + (seg.y1 - seg.y0) * t;
        tx = (seg.x1 - seg.x0) / seg.len;
        ty = (seg.y1 - seg.y0) / seg.len;
      } else {
        [px, py] = quadPoint(seg, t);
        const dxq = 2 * (1 - t) * (seg.cx - seg.x0) + 2 * t * (seg.x1 - seg.cx);
        const dyq = 2 * (1 - t) * (seg.cy! - seg.y0) + 2 * t * (seg.y1 - seg.cy!);
        const l = Math.hypot(dxq, dyq) || 1;
        tx = dxq / l;
        ty = dyq / l;
      }
      if (form === 'prikk') parts.push(circlePath(px, py, rDot));
      else {
        const a = w * 0.62 * dir;
        const nx = -ty;
        const ny = tx;
        parts.push(
          `M${r2(px - tx * a * 0.55 + nx * Math.abs(a) * 0.8)},${r2(py - ty * a * 0.55 + ny * Math.abs(a) * 0.8)}L${r2(px + tx * a * 0.6)},${r2(py + ty * a * 0.6)}L${r2(px - tx * a * 0.55 - nx * Math.abs(a) * 0.8)},${r2(py - ty * a * 0.55 - ny * Math.abs(a) * 0.8)}`,
        );
      }
    }
    marks = { d: parts.join(''), form, fill: strom.farge ?? SCENE.glow };
  }
  return (
    <g opacity={dim ? SCENE_DIM : undefined}>
      {title && <title>{title}</title>}
      <path d={geo.d} fill="none" stroke={shade(color, 0.5)} strokeWidth={r2(w + 1.8 * ss)} strokeLinecap="round" strokeLinejoin="round" />
      <path d={geo.d} fill="none" stroke={color} strokeWidth={r2(w)} strokeLinecap="round" strokeLinejoin="round" />
      <path d={geo.d} fill="none" stroke={tint(color, 0.5)} strokeWidth={r2(w * 0.28)} strokeLinecap="round" strokeLinejoin="round" opacity={0.55} />
      {marks &&
        marks.d &&
        (marks.form === 'prikk' ? (
          <path d={marks.d} fill={marks.fill} stroke={shade(marks.fill, 0.6)} strokeWidth={r2(0.9 * ss)} />
        ) : (
          <>
            <path d={marks.d} fill="none" stroke={shade(marks.fill, 0.6)} strokeWidth={r2(w * 0.42 + 1.4 * ss)} strokeLinecap="round" strokeLinejoin="round" />
            <path d={marks.d} fill="none" stroke={marks.fill} strokeWidth={r2(w * 0.42)} strokeLinecap="round" strokeLinejoin="round" />
          </>
        ))}
    </g>
  );
}

/* ------------------------------------------------------------------ Bryter */

export interface BryterProps {
  /** Midt på bunnen av sokkelen (ankerpunktet; bryteren står på bordet). */
  x: number;
  y: number;
  /** Lengden på sokkelen (standard 120). Høyden med åpen kniv er ca. 0,5 · size. */
  size?: number;
  /** Lukket: kniven ligger i klemmen og kretsen er sluttet. Åpen: kniven er løftet. */
  lukket: boolean;
  rotate?: number;
  dim?: boolean;
  title?: string;
}

/**
 * Hvor ledningene festes på bryteren (figurens enheter): venstre (a) og høyre (b) skruklemme.
 *   const p = bryterPoler({ x: 300, y: 260, size: 120, lukket });
 */
export function bryterPoler({ x, y, size, rotate }: BryterProps): { a: Pt; b: Pt } {
  const k = Math.max(4, fin(size, 120)) / 100;
  return { a: localToFigure(-42, -24.5, x, y, k, rotate), b: localToFigure(42, -24.5, x, y, k, rotate) };
}

/**
 * Knivbryter på sokkel, som i skolelaben: kobberkniv med rødt håndtak som legges ned i en klemme. Kniven glir
 * mykt mellom åpen og lukket. (x, y) er midt på bunnen; ledningene festes i `bryterPoler(samme props)`.
 *   <Bryter x={300} y={260} size={120} lukket={paa} />
 */
export function Bryter({ x, y, size = 120, lukket, rotate, dim, title }: BryterProps) {
  const S = Math.max(4, fin(size, 120));
  const k = S / 100;
  const sw = useLocalStroke(k);
  const id = useSvgId('bryter');
  const black = PAINTS.svart;
  const ol = { stroke: SCENE.outline, strokeWidth: sw(0.9) };
  return (
    <ObjectFrame x={x} y={y} k={k} rotate={rotate} dim={dim} title={title}>
      <ContactShadow cx={0} cy={0} rx={54} ry={4} />
      <LinearGradient id={`${id}-b`} x2={1} y2={0} stops={boxStops(black, 1.5)} />
      <LinearGradient id={`${id}-g`} x2={1} y2={0} stops={cylinderStops(SCENE.gold)} />
      <LinearGradient id={`${id}-c`} stops={cylinderStops(SCENE.copper)} />
      <LinearGradient id={`${id}-m`} x2={1} y2={0} stops={cylinderStops(SCENE.metal)} />
      <path d="M-50,-12H50V-2.5Q50,0 47.5,0H-47.5Q-50,0 -50,-2.5Z" fill={`url(#${id}-b)`} {...ol} />
      <path d="M-50,-12V-15.5Q-50,-18 -47.5,-18H47.5Q50,-18 50,-15.5V-12Z" fill={tint(black, 0.3)} {...ol} />
      <path d="M-44,-16.2H-22V-13.8H-44ZM22,-16.2H44V-13.8H22Z" fill={SCENE.copper} stroke={shade(SCENE.copper, 0.4)} strokeWidth={sw(0.5)} />
      {/* Skruklemmer */}
      <path d="M-45,-15V-22H-39V-15ZM39,-15V-22H45V-15Z" fill={`url(#${id}-g)`} {...ol} />
      <path d="M-46.5,-22V-27H-37.5V-22ZM37.5,-22V-27H46.5V-22Z" fill={`url(#${id}-g)`} {...ol} />
      <path d="M-45.5,-25.6H-38.5M38.5,-25.6H45.5" stroke={SCENE.highlight} strokeWidth={0.9} />
      {/* Hengsel og bakre klemme */}
      <path d="M-27,-15V-29A3,3 0 0 1 -21,-29V-15Z" fill={`url(#${id}-m)`} {...ol} />
      <rect x={23.5} y={-31} width={5.5} height={16} rx={1} fill={shade(SCENE.metal, 0.2)} {...ol} />
      {/* Kniven dreier om hengselet */}
      <g transform="translate(-24 -27.4)">
        <g className="sc-ease" style={{ transform: `rotate(${lukket ? 0 : -42}deg)` }}>
          <rect x={-2.5} y={-1.9} width={63} height={3.8} rx={1.2} fill={`url(#${id}-c)`} {...ol} />
          <rect x={54.5} y={-19} width={7} height={18.5} rx={3.2} fill={PAINTS.rod} {...ol} />
          <path d="M56.4,-16.5V-4" stroke={SCENE.highlight} strokeWidth={1.4} strokeLinecap="round" />
        </g>
      </g>
      <circle cx={-24} cy={-27.4} r={1.7} fill={tint(SCENE.metal, 0.4)} {...ol} />
      {/* Fremre klemme (kniven går inn mellom klemmene) */}
      <path d="M23.8,-15V-31.5L26.8,-28.6L29.8,-31.5V-15Z" fill={`url(#${id}-m)`} {...ol} strokeLinejoin="round" />
    </ObjectFrame>
  );
}
