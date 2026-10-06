/**
 * Egne gjenstander til «Vekt i heis» (k2-heis), i samme stil som scene-kit-et (toninger fra core.tsx, SCENE-farger,
 * kontur og myke skygger):
 * - Bygningssnitt: heissjakta i en boligblokk i snitt, med føringsskinner, etasjeskiller og trapperommet ved siden av.
 *   Den tegnes én gang for hele bygget og flyttes når heisen kjører (kameraet følger heisen).
 * - Byggkart: lite kart over hele blokka med heisen, så eleven ser hvor i bygget heisen er.
 * - VektLupe: forstørret display på badevekta, med lupestreker ned til vekta.
 * - Etasjeviser, Fanger (nødbremsen på skinnene) og Vaierbrudd.
 */
import { memo, useMemo } from 'react';
import { Txt, VIZ, useTextScale } from '../../kit';
import { LinearGradient, Lauvtre, PAINTS, RadialGradient, SCENE, materialStops, mix, sceneRandom, shade, tint, useStrokeScale, useSvgId } from '../../kit/scene';
import { FLOORS, FLOOR_HEIGHT, floorHeight } from './model-heis';

const r1 = (v: number) => Math.round(v * 10) / 10;

/** Tykkelsen på dekkene mellom etasjene (m), med gulv. */
const SLAB = 0.26;
/** Taket på blokka (m over 1. etasje) og toppen av sjakta. */
const ROOF = FLOORS * FLOOR_HEIGHT;
const SHAFT_TOP = ROOF + 2.6;
const SHAFT_PIT = -1.6;

/* ---------------------------------------------------------------- Bygningssnitt */

export interface SnittGeometri {
  /** Piksler per meter. */
  px: number;
  /** Venstre og høyre kant av figuren som skal fylles. */
  left: number;
  right: number;
  /** Innsiden av sjaktveggene. */
  shaftL: number;
  shaftR: number;
  /** Tykkelsen på sjaktveggene (figurens enheter). */
  wall: number;
  /** Midten av heisen og avstanden fra midten til føringsskinnene. */
  cx: number;
  railDx: number;
  /** Vinduet i trapperommet til høyre: venstre og høyre kant. */
  windowL: number;
  windowR: number;
  /** Skiltet med etasjenummeret i trapperommet (midten). */
  signX: number;
}

/**
 * Heissjakta og trapperommet i snitt for hele blokka, i et eget koordinatsystem der y = −h · px (h i meter over
 * gulvet i 1. etasje). Flytt den med translate(0, gulvY + h · px), så står etasjen h ved gulvY.
 * Snittflatene (sjaktveggene og dekkene) er skravert som på en arkitekttegning.
 */
export const Bygningssnitt = memo(function Bygningssnitt({ g }: { g: SnittGeometri }) {
  const ss = useStrokeScale();
  const id = useSvgId('heis-snitt');
  const Y = (h: number) => -h * g.px;
  const geo = useMemo(() => {
    const floors = Array.from({ length: FLOORS }, (_, i) => i + 1);
    const slabs = [...floors, FLOORS + 1].map((k) => floorHeight(k));
    // Forskalingsskjøter og stagehull i betongen i sjakta (fast frø, så bildet er likt hver gang).
    const rand = sceneRandom(41);
    let joints = '';
    let ties = '';
    for (let h = SHAFT_PIT + 1.2; h < SHAFT_TOP; h += 1.2) {
      joints += `M${r1(g.shaftL)},${r1(Y(h))}H${r1(g.shaftR)}`;
      for (const u of [0.18, 0.5, 0.82]) {
        const x = g.shaftL + (g.shaftR - g.shaftL) * u + (rand() - 0.5) * 6;
        ties += `M${r1(x + 2)},${r1(Y(h + 0.6))}a2,2 0 1,1 -4,0a2,2 0 1,1 4,0Z`;
      }
    }
    let stains = '';
    for (let i = 0; i < 26; i++) {
      const x = g.shaftL + 10 + rand() * (g.shaftR - g.shaftL - 20);
      const h = SHAFT_PIT + rand() * (SHAFT_TOP - SHAFT_PIT);
      const len = 14 + rand() * 40;
      stains += `M${r1(x)},${r1(Y(h))}v${r1(len)}`;
    }
    // Brakettene som holder skinnene, ca. hver 2,5 m.
    const brackets: number[] = [];
    for (let h = SHAFT_PIT + 1; h < SHAFT_TOP - 0.5; h += 2.5) brackets.push(h);
    return { floors, slabs, joints, ties, stains, brackets };
  }, [g.px, g.shaftL, g.shaftR]);

  const yTop = Y(SHAFT_TOP);
  const yBottom = Y(SHAFT_PIT - 1);
  const wallLo = g.shaftL - g.wall;
  const wallRo = g.shaftR + g.wall;
  const slabH = SLAB * g.px;
  const railW = 0.055 * g.px;
  const winH0 = 0.9;
  const winH1 = 2.35;
  const hatch = `${id}-skravur`;
  return (
    <g aria-hidden>
      <LinearGradient id={`${id}-vegg`} stops={[[0, tint(SCENE.wall, 0.15)], [0.7, SCENE.wall], [1, SCENE.wallShade]]} />
      <LinearGradient
        id={`${id}-sjakt`}
        x2={1}
        y2={0}
        stops={[
          [0, shade(SCENE.concrete, 0.3)],
          [0.12, shade(SCENE.concrete, 0.12)],
          [0.5, shade(SCENE.concrete, 0.04)],
          [0.88, shade(SCENE.concrete, 0.12)],
          [1, shade(SCENE.concrete, 0.3)],
        ]}
      />
      <LinearGradient id={`${id}-skinne`} x2={1} y2={0} stops={materialStops(SCENE.metal, 1.2)} />
      <LinearGradient id={`${id}-himmel`} stops={[[0, SCENE.skyTop], [1, SCENE.skyBottom]]} />
      <defs>
        <pattern id={hatch} patternUnits="userSpaceOnUse" width={9} height={9} patternTransform="rotate(45)">
          <rect width={9} height={9} fill={SCENE.concrete} />
          <line x1={0} y1={0} x2={0} y2={9} stroke={SCENE.concreteDark} strokeWidth={1.6} />
        </pattern>
      </defs>

      {/* Himmel over taket og grunnen under 1. etasje */}
      <rect x={g.left} y={yTop - 200} width={g.right - g.left} height={Y(ROOF) - yTop + 200} fill={`url(#${id}-himmel)`} />
      <rect x={g.left} y={Y(-SLAB)} width={g.right - g.left} height={yBottom - Y(-SLAB) + 300} fill={SCENE.soil} />
      <rect x={g.left} y={Y(-SLAB)} width={g.right - g.left} height={6} fill={SCENE.soilDark} opacity={0.6} />

      {/* Trapperommet og rommene ved siden av sjakta: vegg, fotlist og vindu i hver etasje */}
      {geo.floors.map((k) => {
        const h = floorHeight(k);
        const top = Y(h + FLOOR_HEIGHT - SLAB);
        const floorY = Y(h);
        return (
          <g key={k}>
            <rect x={g.left} y={top} width={wallLo - g.left} height={floorY - top} fill={`url(#${id}-vegg)`} />
            <rect x={wallRo} y={top} width={g.right - wallRo} height={floorY - top} fill={`url(#${id}-vegg)`} />
            {/* Skygge i taket */}
            <rect x={g.left} y={top} width={g.right - g.left} height={10} fill={SCENE.shadow} opacity={0.35} />
            {/* Fotlist */}
            <rect x={g.left} y={floorY - 0.08 * g.px} width={wallLo - g.left} height={0.08 * g.px} fill={tint(SCENE.wall, 0.4)} stroke={SCENE.outline} strokeWidth={0.6 * ss} />
            <rect x={wallRo} y={floorY - 0.08 * g.px} width={g.right - wallRo} height={0.08 * g.px} fill={tint(SCENE.wall, 0.4)} stroke={SCENE.outline} strokeWidth={0.6 * ss} />
            <Vindu x0={g.windowL} x1={g.windowR} y0={Y(h + winH1)} y1={Y(h + winH0)} floor={k} skyId={`${id}-himmel`} />
            <Etasjeskilt x={g.signX} y={Y(h + 2.05)} floor={k} />
          </g>
        );
      })}

      {/* Dekkene (snitt): gulv på oversiden */}
      {geo.slabs.map((h) => (
        <g key={h}>
          <rect x={g.left} y={Y(h)} width={g.right - g.left} height={slabH} fill={`url(#${hatch})`} />
          <rect x={g.left} y={Y(h)} width={g.right - g.left} height={0.035 * g.px} fill={h >= ROOF ? SCENE.stoneDark : SCENE.floor} />
          <line x1={g.left} y1={Y(h)} x2={g.right} y2={Y(h)} stroke={SCENE.outline} strokeWidth={0.8 * ss} />
          <line x1={g.left} y1={Y(h) + slabH} x2={g.right} y2={Y(h) + slabH} stroke={SCENE.outline} strokeWidth={0.8 * ss} />
        </g>
      ))}
      {/* Rekkverk på taket */}
      <path d={`M${r1(g.left)},${r1(Y(ROOF + 1))}H${r1(g.right)}`} stroke={SCENE.metalDark} strokeWidth={2.4 * ss} />
      {Array.from({ length: Math.ceil((g.right - g.left) / 60) + 1 }, (_, i) => g.left + i * 60).map((x) => (
        <line key={x} x1={x} y1={Y(ROOF + 1)} x2={x} y2={Y(ROOF)} stroke={SCENE.metalDark} strokeWidth={2 * ss} />
      ))}

      {/* Sjakta: bakvegg i betong, mørkere ut mot hjørnene */}
      <rect x={g.shaftL} y={yTop} width={g.shaftR - g.shaftL} height={yBottom - yTop} fill={`url(#${id}-sjakt)`} />
      <path d={geo.joints} stroke={shade(SCENE.concrete, 0.28)} strokeWidth={0.9 * ss} opacity={0.6} />
      <path d={geo.ties} fill={shade(SCENE.concrete, 0.38)} opacity={0.55} />
      <path d={geo.stains} stroke={shade(SCENE.concrete, 0.2)} strokeWidth={3} strokeLinecap="round" opacity={0.18} />
      {/* Etasjenummeret er malt på sjaktveggen ved hvert stoppested */}
      {geo.floors.map((k) => (
        <text
          key={k}
          x={r1(g.shaftL + 0.12 * g.px)}
          y={r1(Y(floorHeight(k) + 0.45))}
          fontSize={r1(0.26 * g.px)}
          fontWeight={800}
          fill={shade(SCENE.concrete, 0.48)}
          opacity={0.8}
        >
          {k}
        </text>
      ))}
      {/* Bunnen av sjakta med støtdempere */}
      <rect x={g.shaftL} y={Y(SHAFT_PIT)} width={g.shaftR - g.shaftL} height={yBottom - Y(SHAFT_PIT)} fill={`url(#${hatch})`} />
      {[-0.3, 0.3].map((u) => (
        <g key={u}>
          <rect x={g.cx + u * g.px - 0.08 * g.px} y={Y(SHAFT_PIT + 0.7)} width={0.16 * g.px} height={0.7 * g.px} rx={3} fill={PAINTS.gul} stroke={SCENE.outline} strokeWidth={0.8 * ss} />
          <rect x={g.cx + u * g.px - 0.05 * g.px} y={Y(SHAFT_PIT + 0.9)} width={0.1 * g.px} height={0.2 * g.px} fill={SCENE.metalDark} />
        </g>
      ))}

      {/* Føringsskinnene med braketter inn i sideveggene */}
      {[-1, 1].map((side) => {
        const xr = g.cx + side * g.railDx;
        const wallX = side < 0 ? g.shaftL : g.shaftR;
        return (
          <g key={side}>
            {geo.brackets.map((h) => (
              <g key={h}>
                <rect
                  x={Math.min(xr, wallX)}
                  y={Y(h) - 0.035 * g.px}
                  width={Math.abs(wallX - xr)}
                  height={0.07 * g.px}
                  fill={SCENE.metalDark}
                  stroke={SCENE.outline}
                  strokeWidth={0.6 * ss}
                />
                <circle cx={(xr + wallX) / 2} cy={Y(h)} r={1.6 * ss} fill={shade(SCENE.metalDark, 0.4)} />
              </g>
            ))}
            <rect x={xr - railW / 2} y={yTop} width={railW} height={Y(SHAFT_PIT) - yTop} fill={`url(#${id}-skinne)`} stroke={SCENE.outline} strokeWidth={0.7 * ss} />
            <line x1={xr + (side < 0 ? 1 : -1) * (railW / 2 - 1.2)} y1={yTop} x2={xr + (side < 0 ? 1 : -1) * (railW / 2 - 1.2)} y2={Y(SHAFT_PIT)} stroke={SCENE.highlight} strokeWidth={1 * ss} />
          </g>
        );
      })}

      {/* Sjaktveggene (snitt) */}
      <rect x={wallLo} y={yTop} width={g.wall} height={yBottom - yTop} fill={`url(#${hatch})`} />
      <rect x={g.shaftR} y={yTop} width={g.wall} height={yBottom - yTop} fill={`url(#${hatch})`} />
      <g stroke={SCENE.outline} strokeWidth={0.9 * ss}>
        <line x1={wallLo} y1={yTop} x2={wallLo} y2={yBottom} />
        <line x1={g.shaftL} y1={yTop} x2={g.shaftL} y2={yBottom} />
        <line x1={g.shaftR} y1={yTop} x2={g.shaftR} y2={yBottom} />
        <line x1={wallRo} y1={yTop} x2={wallRo} y2={yBottom} />
      </g>
    </g>
  );
});

/** Vindu i trapperommet: hvit karm, himmel og et glimt av landskapet (trær i de nederste etasjene). */
function Vindu({ x0, x1, y0, y1, floor, skyId }: { x0: number; x1: number; y0: number; y1: number; floor: number; skyId: string }) {
  const ss = useStrokeScale();
  const w = x1 - x0;
  const h = y1 - y0;
  const frame = Math.max(4, w * 0.06);
  const ix0 = x0 + frame;
  const ix1 = x1 - frame;
  const iy0 = y0 + frame;
  const iy1 = y1 - frame;
  // Jo høyere opp, jo lenger ned i vinduet ligger åsene i det fjerne (vi ser ut over dem), og trærne forsvinner.
  const hillTop = iy1 - (iy1 - iy0) * Math.max(0.08, 0.42 - floor * 0.024);
  const hill = `M${r1(ix0)},${r1(hillTop + 6)}Q${r1(ix0 + (ix1 - ix0) * 0.3)},${r1(hillTop - 8)} ${r1(ix0 + (ix1 - ix0) * 0.55)},${r1(hillTop + 2)}T${r1(ix1)},${r1(hillTop - 2)}V${r1(iy1)}H${r1(ix0)}Z`;
  return (
    <g>
      <rect x={x0} y={y0} width={w} height={h} fill={tint(SCENE.plastic, 0.2)} stroke={SCENE.outline} strokeWidth={0.8 * ss} />
      <rect x={ix0} y={iy0} width={ix1 - ix0} height={iy1 - iy0} fill={`url(#${skyId})`} />
      <path d={hill} fill={SCENE.hillFar} opacity={0.9} />
      {floor <= 3 && (
        <g>
          <circle cx={ix0 + (ix1 - ix0) * 0.28} cy={iy1 - (iy1 - iy0) * (0.12 + floor * 0.04)} r={(ix1 - ix0) * 0.24} fill={SCENE.foliage} />
          <circle cx={ix0 + (ix1 - ix0) * 0.12} cy={iy1 - (iy1 - iy0) * (0.04 + floor * 0.04)} r={(ix1 - ix0) * 0.2} fill={SCENE.foliageDark} />
        </g>
      )}
      <path d={`M${r1(ix0)},${r1(iy0)}L${r1(ix0 + (ix1 - ix0) * 0.35)},${r1(iy0)}L${r1(ix0)},${r1(iy0 + (iy1 - iy0) * 0.45)}Z`} fill={SCENE.highlight} opacity={0.35} />
      {/* Midtpost og sprosse */}
      <rect x={(x0 + x1) / 2 - frame * 0.4} y={iy0} width={frame * 0.8} height={iy1 - iy0} fill={tint(SCENE.plastic, 0.2)} stroke={SCENE.outline} strokeWidth={0.5 * ss} />
      <rect x={ix0} y={iy0 + (iy1 - iy0) * 0.3} width={ix1 - ix0} height={frame * 0.7} fill={tint(SCENE.plastic, 0.2)} stroke={SCENE.outline} strokeWidth={0.5 * ss} />
      {/* Vinduskarm */}
      <rect x={x0 - 6} y={y1} width={w + 12} height={6} rx={1.5} fill={SCENE.plastic} stroke={SCENE.outline} strokeWidth={0.7 * ss} />
    </g>
  );
}

/** Skilt på veggen i trapperommet med etasjenummeret, som i en vanlig blokk. */
function Etasjeskilt({ x, y, floor }: { x: number; y: number; floor: number }) {
  const ss = useStrokeScale();
  const w = 80;
  const h = 30;
  return (
    <g>
      <rect x={x - w / 2} y={y - h / 2} width={w} height={h} rx={4} fill={SCENE.metalDark} stroke={SCENE.outline} strokeWidth={0.8 * ss} />
      <rect x={x - w / 2 + 2} y={y - h / 2 + 2} width={w - 4} height={3} rx={1.5} fill={SCENE.highlight} opacity={0.4} />
      <text x={x} y={y + 5.5} textAnchor="middle" fontSize={16} fontWeight={720} fill={SCENE.metalLight}>
        {floor}. etg.
      </text>
    </g>
  );
}

/* ---------------------------------------------------------------- Byggkart */

export interface ByggkartProps {
  /** Kortet: øverste venstre hjørne, bredde og høyde. */
  x: number;
  y: number;
  w: number;
  h: number;
  /** Høyden til heisgulvet nå (m over 1. etasje). */
  hNow: number;
  /** Der turen starter og slutter (m), vist som en stiplet strek i sjakta. */
  hStart: number;
  hEnd: number;
  /** Teksten øverst (etasjen) og nederst (høyden). */
  title: string;
  footer: string;
  /** Vaierne har røket. */
  broken?: boolean;
}

/**
 * Lite kart over blokka (15 etasjer) i et kort: fasade med vinduer, sjakta skåret opp på midten og heisen som en liten
 * stol med ring rundt. Teksten øverst sier etasjen, nederst høyden over 1. etasje.
 */
export function Byggkart({ x, y, w, h, hNow, hStart, hEnd, title, footer, broken }: ByggkartProps) {
  const ss = useStrokeScale();
  const f = useTextScale();
  const id = useSvgId('heis-kart');
  const top = y + 30 * f + 14;
  const ground = y + h - 26 * f - 10;
  const roofH = ROOF + 1.8; // med maskinrom på taket
  const k = (ground - top) / roofH;
  const Y = (m: number) => ground - m * k;
  const bw = Math.min(w * 0.62, 84);
  const bx0 = x + (w - bw) / 2 - w * 0.06;
  const bx1 = bx0 + bw;
  const cx = (bx0 + bx1) / 2;
  const sw = Math.max(12, 1.9 * k);
  const carW = Math.max(8, 1.25 * k);
  const carH = Math.max(10, 2.5 * k);
  const floors = Array.from({ length: FLOORS }, (_, i) => i + 1);
  const winW = (bw - sw) / 2 - 10;
  return (
    <g>
      <defs>
        <clipPath id={`${id}-kort`}>
          <rect x={x} y={y} width={w} height={h} rx={10} />
        </clipPath>
      </defs>
      <LinearGradient id={`${id}-himmel`} stops={[[0, SCENE.skyTop], [1, SCENE.skyBottom]]} />
      <LinearGradient id={`${id}-fasade`} x2={1} y2={0} stops={[[0, tint(SCENE.concrete, 0.25)], [0.6, tint(SCENE.concrete, 0.1)], [1, shade(SCENE.concrete, 0.12)]]} />
      <rect x={x + 2} y={y + 4} width={w} height={h} rx={10} fill={SCENE.shadow} opacity={0.5} />
      <g clipPath={`url(#${id}-kort)`}>
        <rect x={x} y={y} width={w} height={h} fill={`url(#${id}-himmel)`} />
        <rect x={x} y={ground} width={w} height={y + h - ground} fill={SCENE.soil} />
        <rect x={x} y={ground - 3} width={w} height={6} fill={SCENE.grass} />
        <rect x={x} y={y} width={w} height={30 * f + 8} fill={VIZ.surface} opacity={0.9} />
        <rect x={x} y={ground + 5} width={w} height={y + h - ground} fill={VIZ.surface} opacity={0.9} />
      </g>
      {/* Blokka */}
      <rect x={bx0} y={Y(ROOF)} width={bw} height={ground - Y(ROOF)} fill={`url(#${id}-fasade)`} stroke={SCENE.outline} strokeWidth={0.8 * ss} />
      <rect x={cx - sw * 0.9} y={Y(roofH)} width={sw * 1.8} height={Y(ROOF) - Y(roofH)} fill={shade(SCENE.concrete, 0.08)} stroke={SCENE.outline} strokeWidth={0.8 * ss} />
      <rect x={bx0 - 2} y={Y(ROOF) - 2} width={bw + 4} height={3} fill={SCENE.metalDark} />
      {floors.map((n) => {
        const y0 = Y(floorHeight(n) + FLOOR_HEIGHT);
        const y1 = Y(floorHeight(n));
        const wy = y0 + (y1 - y0) * 0.28;
        const wh = (y1 - y0) * 0.46;
        return (
          <g key={n}>
            <line x1={bx0} y1={y1} x2={bx1} y2={y1} stroke={shade(SCENE.concrete, 0.2)} strokeWidth={0.8 * ss} />
            {winW > 3 && (
              <>
                <rect x={bx0 + 5} y={wy} width={winW} height={wh} fill={SCENE.glass} stroke={SCENE.outline} strokeWidth={0.5 * ss} />
                <rect x={bx1 - 5 - winW} y={wy} width={winW} height={wh} fill={SCENE.glass} stroke={SCENE.outline} strokeWidth={0.5 * ss} />
              </>
            )}
          </g>
        );
      })}
      {/* Sjakta skåret opp, med turen stiplet og heisen */}
      <rect x={cx - sw / 2} y={Y(roofH - 0.4)} width={sw} height={ground - Y(roofH - 0.4) + 4} fill={shade(SCENE.concrete, 0.42)} stroke={SCENE.outline} strokeWidth={0.8 * ss} />
      {Math.abs(hEnd - hStart) > 0.5 && (
        <line x1={cx} y1={Y(hStart + 1.2)} x2={cx} y2={Y(hEnd + 1.2)} stroke={VIZ.surface} strokeWidth={1.6 * ss} strokeDasharray={`${3 * ss} ${3 * ss}`} opacity={0.85} />
      )}
      {!broken && <line x1={cx} y1={Y(roofH - 0.4)} x2={cx} y2={Y(hNow) - carH} stroke={SCENE.metalLight} strokeWidth={1 * ss} opacity={0.9} />}
      <rect x={cx - carW / 2 - 3} y={Y(hNow) - carH - 3} width={carW + 6} height={carH + 6} rx={3} fill="none" stroke={VIZ.surface} strokeWidth={3.4 * ss} />
      <rect x={cx - carW / 2 - 3} y={Y(hNow) - carH - 3} width={carW + 6} height={carH + 6} rx={3} fill="none" stroke={VIZ.ink} strokeWidth={1.6 * ss} />
      <rect x={cx - carW / 2} y={Y(hNow) - carH} width={carW} height={carH} rx={1.5} fill={SCENE.metal} stroke={SCENE.outline} strokeWidth={0.7 * ss} />
      <rect x={cx - carW / 2 + 1.5} y={Y(hNow) - carH + 2} width={carW - 3} height={carH * 0.35} fill={SCENE.glow} opacity={0.8} />
      <Lauvtre x={x + w - 15} y={ground} size={Math.min(48, w * 0.36)} seed={3} />
      <Txt x={x + w / 2} y={y + 22 * f + 2} size={0.82} weight={720}>
        {title}
      </Txt>
      <Txt x={x + w / 2} y={y + h - 12} size={0.78} weight={620}>
        {footer}
      </Txt>
      <rect x={x} y={y} width={w} height={h} rx={10} fill="none" stroke={SCENE.outline} strokeWidth={1 * ss} />
    </g>
  );
}

/* ---------------------------------------------------------------- Forstørret display */

/**
 * Forstørret display på badevekta: et skilt med LCD-skjerm og stort tall, med to lupestreker ned til displayet på
 * vekta i (sx, sy). (x, y) er midten av skiltet.
 */
export function VektLupe({
  x,
  y,
  w,
  h,
  text,
  caption,
  sx,
  sy,
  sw,
  sh,
}: {
  x: number;
  y: number;
  w: number;
  h: number;
  text: string;
  caption: string;
  /** Midten av displayet på vekta og størrelsen på det. */
  sx: number;
  sy: number;
  sw: number;
  sh: number;
}) {
  const ss = useStrokeScale();
  const f = useTextScale();
  const id = useSvgId('heis-lupe');
  const left = x - w / 2;
  const topY = y - h / 2;
  const pad = Math.max(8, h * 0.14);
  const capH = 20 * f;
  const lcdY = topY + pad + capH;
  const lcdH = h - 2 * pad - capH;
  const digits = Math.min(lcdH * 0.76, (w - 2 * pad - 10) / (Math.max(6, text.length) * 0.62));
  const lines = (
    <>
      <line x1={sx + sw / 2} y1={sy - sh / 2} x2={left} y2={topY + 6} />
      <line x1={sx + sw / 2} y1={sy + sh / 2} x2={left} y2={topY + h - 6} />
    </>
  );
  return (
    <g>
      <LinearGradient id={`${id}-kant`} stops={materialStops(SCENE.plastic, 1.3)} />
      <g strokeLinecap="round">
        <g stroke={VIZ.surface} strokeWidth={3.4 * ss} opacity={0.75}>
          {lines}
        </g>
        <g stroke={VIZ.muted} strokeWidth={1.2 * ss} strokeDasharray={`${4 * ss} ${3 * ss}`}>
          {lines}
        </g>
      </g>
      <rect x={sx - sw / 2 - 2} y={sy - sh / 2 - 2} width={sw + 4} height={sh + 4} rx={2} fill="none" stroke={VIZ.ink} strokeWidth={1.4 * ss} />
      <rect x={left + 2} y={topY + 4} width={w} height={h} rx={12} fill={SCENE.shadow} opacity={0.6} />
      <rect x={left} y={topY} width={w} height={h} rx={12} fill={`url(#${id}-kant)`} stroke={SCENE.outline} strokeWidth={1 * ss} />
      <Txt x={x} y={topY + pad + capH * 0.72} size={0.8} weight={650} halo={false} color={mix(SCENE.rubber, SCENE.plasticShade, 0.15)}>
        {caption}
      </Txt>
      <rect x={left + pad} y={lcdY} width={w - 2 * pad} height={lcdH} rx={5} fill={SCENE.display} stroke={shade(SCENE.plastic, 0.45)} strokeWidth={1 * ss} />
      <rect x={left + pad + 3} y={lcdY + 3} width={w - 2 * pad - 6} height={lcdH * 0.3} rx={3} fill={SCENE.highlight} opacity={0.08} />
      <text
        x={x}
        y={lcdY + lcdH / 2 + digits * 0.36}
        textAnchor="middle"
        fontSize={r1(digits)}
        fontWeight={700}
        fill={SCENE.displayText}
        style={{ fontVariantNumeric: 'tabular-nums' }}
      >
        {text}
      </text>
    </g>
  );
}

/* ---------------------------------------------------------------- Små deler i heisen */

/** Etasjeviser på bakveggen i heisen: etasjenummeret og en pil når heisen kjører. */
export function Etasjeviser({ x, y, floor, dir }: { x: number; y: number; floor: number; dir: -1 | 0 | 1 }) {
  const ss = useStrokeScale();
  const w = 34;
  const h = 17;
  const tri = dir === 0 ? '' : dir > 0 ? `M${x + 9},${y + 4}l4,-7l4,7Z` : `M${x + 9},${y - 3}l4,7l4,-7Z`;
  return (
    <g>
      <rect x={x - w / 2} y={y - h / 2} width={w} height={h} rx={3} fill={SCENE.display} stroke={SCENE.outline} strokeWidth={0.8 * ss} />
      <text x={dir === 0 ? x : x - 4} y={y + 4.6} textAnchor="middle" fontSize={13} fontWeight={700} fill={SCENE.displayText}>
        {floor}
      </text>
      {tri && <path d={tri} fill={SCENE.displayText} />}
    </g>
  );
}

/**
 * Fangeren (nødbremsen) under heisstolen: en kloss rundt hver føringsskinne. Når den griper (`active`), presses
 * kilene mot skinna og det spruter gnister; etterpå (`engaged`) sitter den fast.
 */
export function Fanger({ x, y, side, active, engaged, seed = 1 }: { x: number; y: number; side: -1 | 1; active: boolean; engaged: boolean; seed?: number }) {
  const ss = useStrokeScale();
  const id = useSvgId('heis-fanger');
  const w = 22;
  const h = 16;
  const sparks = useMemo(() => {
    const rand = sceneRandom(seed * 13 + 5);
    return Array.from({ length: 9 }, () => {
      const a = (Math.PI / 2) * (0.35 + rand() * 0.6);
      const len = 8 + rand() * 18;
      const dir = rand() < 0.5 ? -1 : 1;
      return { dx: Math.cos(a) * len * dir, dy: Math.sin(a) * len, o: 0.5 + rand() * 0.5 };
    });
  }, [seed]);
  const grip = active || engaged;
  return (
    <g>
      {active && (
        <>
          <RadialGradient id={`${id}-glod`} stops={[[0, SCENE.glow, 0.9], [0.5, SCENE.warm, 0.35], [1, SCENE.warm, 0]]} />
          <ellipse cx={x} cy={y + h} rx={26} ry={18} fill={`url(#${id}-glod)`} />
          <g strokeLinecap="round">
            {sparks.map((s, i) => (
              <line key={i} x1={x} y1={y + h} x2={x + s.dx} y2={y + h + s.dy} stroke={i % 3 === 0 ? SCENE.hot : SCENE.glow} strokeWidth={1.4 * ss} opacity={s.o} />
            ))}
          </g>
        </>
      )}
      <rect x={x - w / 2} y={y} width={w} height={h} rx={2} fill={shade(SCENE.metalDark, 0.2)} stroke={SCENE.outline} strokeWidth={0.8 * ss} />
      {/* Kilene på hver side av skinna: trukket ned og presset inn når fangeren griper */}
      {[-1, 1].map((s) => (
        <path
          key={s}
          d={`M${r1(x + s * (grip ? 3.6 : 5.5))},${r1(y + (grip ? 5 : 2))}l${s * 4},0l0,${h - 6}l${-s * 2},0Z`}
          fill={grip ? SCENE.metalLight : SCENE.metal}
          stroke={SCENE.outline}
          strokeWidth={0.5 * ss}
        />
      ))}
      <rect x={x - (side < 0 ? w / 2 + 6 : -w / 2)} y={y + 4} width={6} height={h - 8} fill={SCENE.metalDark} />
    </g>
  );
}

/** Enden av en vaier som har røket: noen trådender som spriker. (x, y) er der vaieren slutter. */
export function Vaierbrudd({ x, y }: { x: number; y: number }) {
  const ss = useStrokeScale();
  return (
    <g stroke={SCENE.metalDark} strokeWidth={1.1 * ss} strokeLinecap="round">
      <line x1={x} y1={y} x2={x - 4} y2={y - 7} />
      <line x1={x} y1={y} x2={x + 1} y2={y - 8} />
      <line x1={x} y1={y} x2={x + 5} y2={y - 6} />
    </g>
  );
}

/** Lys glød fra lampa i heistaket (tegnes over bakveggen). */
export function Taklys({ x, y, w, h }: { x: number; y: number; w: number; h: number }) {
  const id = useSvgId('heis-lys');
  return (
    <>
      <RadialGradient id={id} cx={0.5} cy={0} r={0.9} stops={[[0, SCENE.glow, 0.28], [1, SCENE.glow, 0]]} />
      <rect x={x - w / 2} y={y} width={w} height={h} fill={`url(#${id})`} />
    </>
  );
}

