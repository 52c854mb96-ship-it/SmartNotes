/**
 * Egne gjenstander til scenen i «Bohrs atommodell»: spektralrøret med hydrogen i skolelaben (emisjon), sola med
 * solatmosfæren (absorpsjon), tekst på mørk bunn og lupen som viser ett atom. Samme stil som scene-kit-et: toninger
 * fra core.tsx, SCENE-farger, kontur og myk skygge.
 */
import { memo, type CSSProperties, type ReactNode } from 'react';
import { VIZ } from '../../kit';
import {
  ContactShadow,
  LinearGradient,
  Lysstraale,
  PAINTS,
  RadialGradient,
  SCENE,
  Sol,
  Stikkontakt,
  Stjernehimmel,
  alpha,
  materialStops,
  mix,
  shade,
  tint,
  useStrokeScale,
  useSvgId,
} from '../../kit/scene';
import { outerTangents, type Circle } from './bohr-scene';

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

/* ---------- Tekst på mørk bunn ---------- */

/**
 * Tekst på mørk bunn (lupen og rommet): lys skrift med mørk glorie i begge temaer. `size` er relativ som i kit-ets
 * Txt (1 = vanlig etikett) og vokser på mobil.
 */
export function NightTxt({
  x,
  y,
  children,
  anchor = 'middle',
  size = 0.85,
  weight = 600,
  color,
  muted,
}: {
  x: number;
  y: number;
  children: ReactNode;
  anchor?: 'start' | 'middle' | 'end';
  size?: number;
  weight?: number;
  color?: string;
  muted?: boolean;
}) {
  const style: CSSProperties & Record<'--kj-fs', number> = {
    fill: color ?? (muted ? mix(SCENE.star, SCENE.space, 0.32) : SCENE.star),
    stroke: SCENE.space,
    fontWeight: weight,
    '--kj-fs': size,
  };
  return (
    <text x={x} y={y} textAnchor={anchor} className="kj-txt" style={style}>
      {children}
    </text>
  );
}

/* ---------- Spektralrøret i laben ---------- */

/** Hvor ting står i lab-utsnittet (px). `S` er skalaen i px/m. */
export interface LabGeometry {
  S: number;
  /** Bredt utsnitt (mobil): plass til et stativ med flere spektralrør, og tittelen står til høyre. */
  wide: boolean;
  benchY: number;
  tubeX: number;
  /** Toppen og bunnen av selve glassrøret, og det smale kapillærrøret som lyser sterkest. */
  tubeTop: number;
  tubeBottom: number;
  capTop: number;
  capBottom: number;
  /** Stikkontakten på veggen (midten) og størrelsen på dekselet. */
  socket: Circle;
  /** Ringen rundt stedet lupen viser. */
  ring: Circle;
}

/** Spenningskilden er 0,085 m høy, søylen 0,36 m og røret 0,26 m langt (vanlige mål for spektralrør). */
const SUPPLY = { baseW: 0.24, baseH: 0.085, colW: 0.055, colH: 0.36, tube: 0.26, bulbW: 0.03, bulbH: 0.052, capW: 0.009, inset: 0.035 };

export function labGeometry(box: Box, k: number): LabGeometry {
  const wide = box.w > 500;
  const benchY = box.y + box.h - Math.max(34, box.h * 0.14);
  const room = benchY - box.y - (wide ? 18 : Math.max(46, box.h * 0.18));
  const S = room / (SUPPLY.baseH + SUPPLY.colH);
  const tubeX = box.x + (wide ? box.w * 0.2 : box.w * 0.42);
  const colTop = benchY - (SUPPLY.baseH + SUPPLY.colH) * S;
  const tubeTop = colTop + SUPPLY.inset * S;
  const tubeBottom = tubeTop + SUPPLY.tube * S;
  const capTop = tubeTop + SUPPLY.bulbH * S;
  const capBottom = tubeBottom - SUPPLY.bulbH * S;
  const sockR = 0.08 * S;
  const socket = { x: wide ? tubeX + 0.3 * S : box.x + box.w - sockR * 0.5 - 12, y: benchY - 0.2 * S, r: sockR };
  return { S, wide, benchY, tubeX, tubeTop, tubeBottom, capTop, capBottom, socket, ring: { x: tubeX, y: (capTop + capBottom) / 2, r: 11 * k } };
}

/** Spenningskilden: fot med kontrollampe, varselskilt og bryter, og søylen bak røret. (Røret tegnes for seg.) */
function Spenningskilde({ g, on }: { g: LabGeometry; on: boolean }) {
  const ss = useStrokeScale();
  const caseId = useSvgId('bohr-kasse');
  const colId = useSvgId('bohr-soyle');
  const { S, benchY: y, tubeX: x } = g;
  const baseW = SUPPLY.baseW * S;
  const baseH = SUPPLY.baseH * S;
  const colW = SUPPLY.colW * S;
  const baseTop = y - baseH;
  const colTop = baseTop - SUPPLY.colH * S;
  const casing = mix(PAINTS.graa, SCENE.rubber, 0.55);
  const bx = x - baseW * 0.42;
  const lamp = { x: bx + baseW * 0.13, y: baseTop + baseH * 0.52 };
  const tri = { x: bx + baseW * 0.36, y: baseTop + baseH * 0.56, s: 0.022 * S };
  const plug = { x: g.socket.x, y: g.socket.y + 0.75 * g.socket.r };
  return (
    <g>
      <ContactShadow cx={bx + baseW / 2} cy={y} rx={baseW * 0.56} />
      <LinearGradient id={caseId} stops={materialStops(casing, 1.2)} />
      <LinearGradient id={colId} x2={1} y2={0} stops={[[0, tint(casing, 0.12)], [0.5, casing], [1, shade(casing, 0.3)]]} />
      {/* Ledningen bak, opp til stikkontakten på veggen */}
      <path
        d={`M${bx + baseW - 4} ${baseTop + baseH * 0.55} C ${bx + baseW + 0.05 * S} ${baseTop + baseH * 0.55}, ${plug.x} ${y - 0.01 * S}, ${plug.x} ${plug.y}`}
        fill="none"
        stroke={SCENE.rubber}
        strokeWidth={0.009 * S}
        strokeLinecap="round"
      />
      <rect x={x - colW / 2} y={colTop} width={colW} height={SUPPLY.colH * S + 2} rx={colW * 0.18} fill={`url(#${colId})`} stroke={SCENE.outline} strokeWidth={0.9 * ss} />
      <rect x={bx} y={baseTop} width={baseW} height={baseH} rx={baseH * 0.16} fill={`url(#${caseId})`} stroke={SCENE.outline} strokeWidth={0.9 * ss} />
      <rect x={bx + 2} y={baseTop + 1.5} width={baseW - 4} height={baseH * 0.16} rx={baseH * 0.08} fill={SCENE.highlight} opacity={0.35} />
      {/* Bryter */}
      <rect x={bx + baseW * 0.64} y={baseTop + baseH * 0.3} width={baseW * 0.16} height={baseH * 0.42} rx={2} fill={shade(casing, 0.45)} stroke={SCENE.outline} strokeWidth={0.7 * ss} />
      <rect x={bx + baseW * 0.64 + 2} y={baseTop + baseH * 0.3 + 2} width={baseW * 0.16 - 4} height={baseH * 0.17} rx={1.5} fill={on ? tint(casing, 0.35) : shade(casing, 0.2)} />
      {/* Kontrollampe */}
      {on && <circle cx={lamp.x} cy={lamp.y} r={0.02 * S} fill={alpha(PAINTS.rod, 0.35)} />}
      <circle cx={lamp.x} cy={lamp.y} r={0.009 * S} fill={on ? tint(PAINTS.rod, 0.25) : shade(PAINTS.rod, 0.45)} stroke={SCENE.outline} strokeWidth={0.6 * ss} />
      {/* Varselskilt for høyspenning */}
      <path
        d={`M${tri.x} ${tri.y - tri.s} L${tri.x + tri.s * 0.95} ${tri.y + tri.s * 0.7} L${tri.x - tri.s * 0.95} ${tri.y + tri.s * 0.7} Z`}
        fill={PAINTS.gul}
        stroke={shade(PAINTS.gul, 0.6)}
        strokeWidth={0.8 * ss}
        strokeLinejoin="round"
      />
      <path
        d={`M${tri.x + tri.s * 0.12} ${tri.y - tri.s * 0.5} L${tri.x - tri.s * 0.2} ${tri.y + tri.s * 0.1} L${tri.x + tri.s * 0.12} ${tri.y + tri.s * 0.05} L${tri.x - tri.s * 0.12} ${tri.y + tri.s * 0.55}`}
        fill="none"
        stroke={shade(PAINTS.gul, 0.75)}
        strokeWidth={Math.max(0.9, 0.005 * S) * ss}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </g>
  );
}

/**
 * Et spektralrør av glass: to vide ender med elektroder og et smalt kapillærrør imellom. (x, top) er midt på toppen.
 * Med `glow` lyser gassen (sterkest i kapillærrøret), ellers er røret klart glass. `clamps` tegner klemmene i holderen.
 */
function Glassror({ x, top, S, glow, clamps }: { x: number; top: number; S: number; glow?: string; clamps?: boolean }) {
  const ss = useStrokeScale();
  const glassId = useSvgId('bohr-glass');
  const bulbW = SUPPLY.bulbW * S;
  const bulbH = SUPPLY.bulbH * S;
  const capW = SUPPLY.capW * S;
  const bottom = top + SUPPLY.tube * S;
  const capTop = top + bulbH;
  const capBottom = bottom - bulbH;
  const clampH = 0.026 * S;
  return (
    <g>
      <LinearGradient id={glassId} x2={1} y2={0} stops={[[0, alpha(SCENE.glass, 0.5)], [0.35, alpha(SCENE.highlight, 0.55)], [1, alpha(SCENE.glass, 0.35)]]} />
      {[top, capBottom].map((bt, i) => (
        <g key={i}>
          <rect x={x - bulbW / 2} y={bt} width={bulbW} height={bulbH} rx={bulbW * 0.45} fill={glow ? alpha(glow, 0.32) : `url(#${glassId})`} stroke={SCENE.glassEdge} strokeWidth={0.9 * ss} />
          <line
            x1={x}
            x2={x}
            y1={i === 0 ? bt + 2 : bt + bulbH * 0.35}
            y2={i === 0 ? bt + bulbH * 0.65 : bt + bulbH - 2}
            stroke={SCENE.metal}
            strokeWidth={Math.max(1.2, 0.004 * S) * ss}
            strokeLinecap="round"
          />
        </g>
      ))}
      <rect x={x - capW / 2} y={capTop - 1} width={capW} height={capBottom - capTop + 2} fill={glow ?? `url(#${glassId})`} stroke={SCENE.glassEdge} strokeWidth={0.8 * ss} />
      {glow && <rect x={x - capW * 0.18} y={capTop} width={capW * 0.36} height={capBottom - capTop} fill={tint(glow, 0.7)} />}
      {clamps &&
        [top - clampH * 0.45, bottom - clampH * 0.55].map((cy, i) => (
          <rect key={i} x={x - bulbW * 0.75} y={cy} width={bulbW * 1.5} height={clampH} rx={clampH * 0.3} fill={SCENE.metal} stroke={SCENE.outline} strokeWidth={0.8 * ss} />
        ))}
    </g>
  );
}

/** Trestativ med tre spektralrør som ikke er i bruk (andre gasser). (x, y) er midt under stativet. */
function Rorstativ({ x, y, S }: { x: number; y: number; S: number }) {
  const ss = useStrokeScale();
  const woodId = useSvgId('bohr-stativ');
  const w = 0.17 * S;
  const h = 0.035 * S;
  const tubes = [-0.05, 0, 0.05].map((dx) => x + dx * S);
  return (
    <g>
      <ContactShadow cx={x} cy={y} rx={w * 0.58} />
      {tubes.map((tx, i) => (
        <Glassror key={i} x={tx} top={y - h - SUPPLY.tube * S * 0.92} S={S} />
      ))}
      <LinearGradient id={woodId} stops={materialStops(SCENE.wood)} />
      <rect x={x - w / 2} y={y - h} width={w} height={h} rx={h * 0.18} fill={`url(#${woodId})`} stroke={SCENE.outline} strokeWidth={0.9 * ss} />
    </g>
  );
}

/** Skolelaben i mørket: vegg, labbenk og spektralrøret som lyser. Mørkt også i lyst tema (lyset er slått av). */
export const LabVignett = memo(function LabVignett({ box, g, glowRgb, k }: { box: Box; g: LabGeometry; glowRgb: string; k: number }) {
  const ss = useStrokeScale();
  const clip = useSvgId('bohr-lab');
  const wallId = useSvgId('bohr-vegg');
  const haloId = useSvgId('bohr-glod');
  const benchId = useSvgId('bohr-benk');
  const wall = mix(SCENE.wall, SCENE.space, 0.72);
  const tubeMid = (g.capTop + g.capBottom) / 2;
  const glowR = (g.tubeBottom - g.tubeTop) * 0.95;
  return (
    <g>
      <defs>
        <clipPath id={clip}>
          <rect x={box.x} y={box.y} width={box.w} height={box.h} rx={12} />
        </clipPath>
      </defs>
      <LinearGradient id={wallId} stops={[[0, shade(wall, 0.25)], [1, wall]]} />
      <RadialGradient
        id={haloId}
        userSpace
        cx={g.tubeX}
        cy={tubeMid}
        r={glowR}
        stops={[
          [0, glowRgb, 0.5],
          [0.35, glowRgb, 0.18],
          [1, glowRgb, 0],
        ]}
      />
      <LinearGradient id={benchId} stops={[[0, mix(SCENE.bench, SCENE.space, 0.35)], [1, mix(SCENE.benchEdge, SCENE.space, 0.65)]]} />
      <g clipPath={`url(#${clip})`}>
        <rect x={box.x} y={box.y} width={box.w} height={box.h} fill={`url(#${wallId})`} />
        <rect x={box.x} y={g.benchY} width={box.w} height={box.y + box.h - g.benchY} fill={`url(#${benchId})`} />
        <rect x={box.x} y={g.benchY} width={box.w} height={3 * ss} fill={alpha(SCENE.star, 0.12)} />
        <Stikkontakt x={g.socket.x} y={g.socket.y} size={g.socket.r} stopsel />
        {g.wide && <Rorstativ x={g.tubeX + 0.62 * g.S} y={g.benchY} S={g.S} />}
        <Spenningskilde g={g} on />
        {/* Mørkt rom: alt unntatt røret som lyser, ligger i halvmørke */}
        <rect x={box.x} y={box.y} width={box.w} height={box.h} fill={alpha(SCENE.space, 0.38)} />
        <Glassror x={g.tubeX} top={g.tubeTop} S={g.S} glow={glowRgb} clamps />
        {/* Gløden fra røret lyser opp veggen og benken */}
        <rect x={box.x} y={box.y} width={box.w} height={box.h} fill={`url(#${haloId})`} />
        <ellipse cx={g.tubeX} cy={g.benchY + 6 * k} rx={0.18 * g.S} ry={5 * k} fill={alpha(glowRgb, 0.28)} />
        <NightTxt x={g.wide ? box.x + box.w - 14 : box.x + 14} y={box.y + 26 * Math.min(1.6, k)} anchor={g.wide ? 'end' : 'start'} size={0.8}>
          Hydrogen i et spektralrør
        </NightTxt>
      </g>
      <rect x={box.x} y={box.y} width={box.w} height={box.h} rx={12} fill="none" stroke={SCENE.outline} strokeWidth={1 * ss} />
    </g>
  );
});

/* ---------- Sola og solatmosfæren ---------- */

export interface SunGeometry {
  sun: Circle;
  /** Tykkelsen på det kalde gasslaget utenfor solskiva (px). */
  layer: number;
  rayY: number;
  ring: Circle;
}

export function sunGeometry(box: Box, k: number): SunGeometry {
  const wide = box.w > 500;
  const r = wide ? box.h * 1.05 : box.h * 1.0;
  const sun = { x: box.x + (wide ? box.w * 0.16 : box.w * 0.42) - r, y: box.y + box.h * 0.56, r };
  const layer = Math.max(16, r * 0.075);
  const rayY = sun.y;
  return { sun, layer, rayY, ring: { x: sun.x + r + layer * 0.5, y: rayY, r: 11 * k } };
}

/** Sollys på vei ut gjennom solatmosfæren: et tynt lag kaldere gass utenfor solskiva, der hydrogenet tar opp lys. */
export const SolVignett = memo(function SolVignett({ box, g, layerRgb, k }: { box: Box; g: SunGeometry; layerRgb: string; k: number }) {
  const ss = useStrokeScale();
  const clip = useSvgId('bohr-sol');
  const layerId = useSvgId('bohr-lag');
  const { sun, layer } = g;
  return (
    <g>
      <defs>
        <clipPath id={clip}>
          <rect x={box.x} y={box.y} width={box.w} height={box.h} rx={12} />
        </clipPath>
      </defs>
      <RadialGradient
        id={layerId}
        userSpace
        cx={sun.x}
        cy={sun.y}
        r={sun.r + layer}
        stops={[
          [sun.r / (sun.r + layer) - 0.002, layerRgb, 0.55],
          [1, layerRgb, 0],
        ]}
      />
      <g clipPath={`url(#${clip})`}>
        <Stjernehimmel x={box.x} y={box.y} w={box.w} h={box.h} seed={5} melkevei={0.35} />
        <circle cx={sun.x} cy={sun.y} r={sun.r + layer} fill={`url(#${layerId})`} />
        <Sol x={sun.x} y={sun.y} r={sun.r} korona={0.25} flekker={1} seed={4} />
        <Lysstraale x1={sun.x + sun.r - 4} y1={g.rayY} x2={box.x + box.w + 4} y2={g.rayY} hvit bredde={3.2} />
        <NightTxt x={box.x + box.w - 14} y={box.y + 26 * Math.min(1.6, k)} anchor="end" size={0.8}>
          Sollys gjennom solatmosfæren
        </NightTxt>
      </g>
      <rect x={box.x} y={box.y} width={box.w} height={box.h} rx={12} fill="none" stroke={SCENE.outline} strokeWidth={1 * ss} />
    </g>
  );
});

/* ---------- Lupen ---------- */

/** Ringen rundt stedet i scenen og de to strekene ut til lupen. Tegnes før lupen. */
export function LupeStreker({ ring, lupe }: { ring: Circle; lupe: Circle }) {
  const ss = useStrokeScale();
  const t = outerTangents(ring, lupe);
  return (
    <g aria-hidden>
      {t?.map(([p, q], i) => (
        <g key={i}>
          <line x1={p.x} y1={p.y} x2={q.x} y2={q.y} stroke={VIZ.surface} strokeWidth={3.2 * ss} strokeLinecap="round" opacity={0.55} />
          <line x1={p.x} y1={p.y} x2={q.x} y2={q.y} stroke={VIZ.ink} strokeWidth={1 * ss} strokeLinecap="round" opacity={0.5} />
        </g>
      ))}
      <circle cx={ring.x} cy={ring.y} r={ring.r} fill="none" stroke={SCENE.star} strokeWidth={3.6 * ss} opacity={0.5} />
      <circle cx={ring.x} cy={ring.y} r={ring.r} fill="none" stroke={VIZ.ink} strokeWidth={1.3 * ss} opacity={0.8} />
    </g>
  );
}

/** Kanten på lupen: myk skygge under, glorie, kontur og en tynn lys ring innenfor, som glass. */
export function LupeKant({ c, shadow = true }: { c: Circle; shadow?: boolean }) {
  const ss = useStrokeScale();
  return (
    <g aria-hidden>
      {shadow && <circle cx={c.x + 2.5} cy={c.y + 4} r={c.r + 3} fill={SCENE.shadow} opacity={0.22} />}
      <circle cx={c.x} cy={c.y} r={c.r} fill="none" stroke={VIZ.surface} strokeWidth={6 * ss} />
      <circle cx={c.x} cy={c.y} r={c.r + 3 * ss} fill="none" stroke={alpha(VIZ.ink, 0.45)} strokeWidth={1.3 * ss} />
      <circle cx={c.x} cy={c.y} r={c.r - 3 * ss} fill="none" stroke={alpha(SCENE.star, 0.25)} strokeWidth={0.8 * ss} />
    </g>
  );
}
