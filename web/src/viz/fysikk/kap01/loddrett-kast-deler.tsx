/**
 * Egne gjenstander til «Loddrett kast», tegnet i samme stil som scene-kit-et (toninger fra core.tsx, SCENE-farger,
 * tynn kontur, lys fra øvre venstre): boligblokka sett fra gavlen, med balkonger, glassrekkverk og vinduer.
 *
 * Alle mål er i meter og tegnes med én skala `p` (figurenheter per meter) fra bakken `groundY`, så blokka, personene
 * og høydeaksen i s-t-grafen henger sammen.
 */
import { memo } from 'react';
import { ContactShadow, LinearGradient, PAINTS, SCENE, alpha, materialStops, mix, shade, tint, useStrokeScale, useSvgId } from '../../kit/scene';
import type { ThrowBuilding } from './model';

const r2 = (v: number) => Math.round(v * 100) / 100;

/** Fargen på gavlveggen: dempet teglstein. */
const WALL = mix(SCENE.brick, SCENE.concrete, 0.42);
/** Vindusglass: blått i dagslys, tent (varmt) i skumringen (variabelen kommer fra scene-kit-et). */
const WINDOW_LIT = `var(--sc-bakgrunn-vindu, ${SCENE.glass})`;

/** Mål på blokka (m). */
export const BLOKK_MAAL = {
  /** Hvor langt balkongen stikker ut fra fasaden. */
  balkong: 1.4,
  /** Tykkelsen på balkongplata. */
  plate: 0.2,
  /** Høyden på rekkverket over balkonggulvet (TEK17: minst 1,0 m). */
  rekkverk: 1.05,
  /** Hvor bred gavlen er (dybden på blokka). */
  gavl: 13,
} as const;

interface BlokkProps {
  /** Fasaden der balkongene sitter (x). Gavlveggen går mot venstre herfra. */
  wallX: number;
  /** Venstre kant av det som skal tegnes (gavlen klippes her). */
  left: number;
  groundY: number;
  /** Figurenheter per meter. */
  p: number;
  building: ThrowBuilding;
  /** Gulvet til den som kaster (m). Rekkverket der tegnes for seg med <Rekkverk> etter personen. */
  ownFloor?: number;
}

/**
 * Boligblokk sett fra gavlen: teglvegg med vinduer i hver etasje, betongbånd ved etasjeskillene, grunnmur, flatt
 * tak med beslag og balkonger med glassrekkverk ut mot høyre (den vi står vinkelrett på). Med `ownFloor` under
 * 2,4 m blir den øverste balkongen en terrasse på en mur. Ankerpunkt: (wallX, groundY) er hjørnet ved bakken.
 */
export const Boligblokk = memo(function Boligblokk({ wallX, left, groundY, p, building, ownFloor }: BlokkProps) {
  const ss = useStrokeScale();
  const wallId = useSvgId('lk-vegg');
  const sideId = useSvgId('lk-side');
  const slabId = useSvgId('lk-plate');
  const baseId = useSvgId('lk-mur');
  const Y = (m: number) => groundY - m * p;
  const L = Math.max(left, wallX - BLOKK_MAAL.gavl * p);
  const w = wallX - L;
  if (!(w > 1) || !(p > 0)) return null;
  const top = Y(building.roof);
  const detail = p >= 14; // teglfuger, vinduskryss og karmer bare når det er plass

  // Vinduer: én rad per etasje, i kolonner fra fasaden og innover (3,4 m mellom).
  // I skumringen (mørkt tema) lyser omtrent hvert tredje vindu, i et fast mønster.
  const windows: { x: number; y: number; ww: number; wh: number; lit: boolean }[] = [];
  const ww = 1.1 * p;
  const wh = 1.3 * p;
  building.floors.forEach((floor, i) => {
    for (let j = 0; j < 8; j++) {
      const cx = wallX - (1.9 + j * 3.4) * p;
      if (cx - ww / 2 < L + 0.3 * p) break;
      windows.push({ x: cx - ww / 2, y: Y(floor + 0.9) - wh, ww, wh, lit: (i * 2 + j * 4 + 1) % 3 === 0 });
    }
  });
  // Teglfuger: vannrette linjer hver 0,3 m (bare når de ikke blir for tette).
  let courses = '';
  if (detail) {
    for (let m = 0.3; m < building.roof - 0.2; m += 0.3) {
      if (m < building.base) continue;
      courses += `M${r2(L)},${r2(Y(m))}H${r2(wallX)}`;
    }
  }
  const slabT = Math.max(1.6, BLOKK_MAAL.plate * p);
  const band = Math.max(1.2, 0.22 * p);
  const depth = BLOKK_MAAL.balkong * p;

  return (
    <g aria-hidden>
      <LinearGradient id={wallId} stops={materialStops(WALL, 0.7)} />
      {/* Lys fra venstre: veggen blir litt mørkere inn mot hjørnet ved fasaden */}
      <LinearGradient
        id={sideId}
        x2={1}
        y2={0}
        stops={[
          [0, SCENE.highlight, 0.18],
          [0.7, SCENE.highlight, 0],
          [1, SCENE.shadow, 0.35],
        ]}
      />
      <LinearGradient id={slabId} stops={materialStops(SCENE.concrete, 0.8)} />
      <LinearGradient id={baseId} stops={materialStops(SCENE.concreteDark, 0.6)} />

      <ContactShadow cx={L + w / 2} cy={groundY + 1} rx={w / 2 + 6} ry={Math.max(3, 0.25 * p)} opacity={0.7} />
      {/* Gavlveggen */}
      <rect x={L} y={top} width={w} height={Math.max(0, Y(building.base) - top)} fill={`url(#${wallId})`} />
      {courses && <path d={courses} stroke={shade(WALL, 0.25)} strokeWidth={0.6 * ss} opacity={0.35} />}
      {/* Etasjeskiller (betongbånd) */}
      {building.floors
        .filter((f) => f > building.base + 0.01)
        .map((f) => (
          <rect key={f} x={L} y={Y(f) - band / 2} width={w} height={band} fill={tint(SCENE.concrete, 0.1)} opacity={0.75} />
        ))}
      {/* Grunnmur */}
      {building.base > 0.01 && <rect x={L} y={Y(building.base)} width={w} height={building.base * p} fill={`url(#${baseId})`} />}
      <rect x={L} y={top} width={w} height={groundY - top} fill={`url(#${sideId})`} stroke={SCENE.outline} strokeWidth={0.8 * ss} />

      {windows.map((win, i) => (
        <Vindu key={i} {...win} detail={detail} ss={ss} />
      ))}

      {/* Flatt tak med beslag */}
      <rect
        x={L - 0.12 * p}
        y={top - Math.max(2, 0.28 * p)}
        width={w + 0.24 * p}
        height={Math.max(2, 0.28 * p)}
        rx={Math.min(2, 0.05 * p)}
        fill={SCENE.metalDark}
        stroke={SCENE.outline}
        strokeWidth={0.8 * ss}
      />

      {/* Balkonger og terrasse */}
      {building.balconies.map((f) => {
        const own = ownFloor !== undefined && Math.abs(f - ownFloor) < 1e-6;
        const y = Y(f);
        return (
          <g key={f}>
            {/* Lav terrasse: muren under plata går helt ned til bakken */}
            {own && f < 2.4 && <rect x={wallX} y={y + slabT} width={depth} height={Math.max(0, groundY - y - slabT)} fill={`url(#${baseId})`} stroke={SCENE.outline} strokeWidth={0.8 * ss} />}
            <rect x={wallX - 0.5} y={y} width={depth + 0.5} height={slabT} fill={`url(#${slabId})`} stroke={SCENE.outline} strokeWidth={0.8 * ss} />
            {!own && <Rekkverk wallX={wallX} floorY={y} p={p} />}
          </g>
        );
      })}
    </g>
  );
});

/** Ett vindu med hvit karm, glass med refleks og vinduskryss, og en lys vinduspost under. */
function Vindu({ x, y, ww, wh, lit, detail, ss }: { x: number; y: number; ww: number; wh: number; lit: boolean; detail: boolean; ss: number }) {
  const frame = Math.max(0.8, ww * 0.07);
  const glass = lit ? WINDOW_LIT : SCENE.glass;
  if (!detail) return <rect x={x} y={y} width={ww} height={wh} fill={glass} stroke={SCENE.outline} strokeWidth={0.5 * ss} />;
  const gx = x + frame;
  const gy = y + frame;
  const gw = ww - 2 * frame;
  const gh = wh - 2 * frame;
  return (
    <g>
      <rect x={x} y={y} width={ww} height={wh} fill={PAINTS.hvit} stroke={SCENE.outline} strokeWidth={0.7 * ss} />
      <rect x={gx} y={gy} width={gw} height={gh} fill={glass} />
      {/* Refleks på glasset (lys fra øvre venstre) */}
      <path d={`M${r2(gx)},${r2(gy + gh * 0.55)} L${r2(gx + gw * 0.55)},${r2(gy)} L${r2(gx + gw * 0.8)},${r2(gy)} L${r2(gx)},${r2(gy + gh * 0.85)} Z`} fill={SCENE.highlight} opacity={0.45} />
      <rect x={gx} y={gy} width={gw} height={gh} fill="none" stroke={shade(SCENE.glassEdge, 0.1)} strokeWidth={0.5 * ss} opacity={0.6} />
      {/* Vinduskryss */}
      <line x1={x + ww / 2} y1={gy} x2={x + ww / 2} y2={gy + gh} stroke={PAINTS.hvit} strokeWidth={frame * 0.8} />
      <line x1={gx} y1={gy + gh * 0.36} x2={gx + gw} y2={gy + gh * 0.36} stroke={PAINTS.hvit} strokeWidth={frame * 0.7} />
      {/* Vinduspost (utvendig sålbenk) */}
      <rect x={x - frame * 0.6} y={y + wh} width={ww + frame * 1.2} height={Math.max(1, frame * 0.9)} fill={tint(SCENE.concrete, 0.25)} stroke={SCENE.outline} strokeWidth={0.5 * ss} />
    </g>
  );
}

/**
 * Glassrekkverk på en balkong sett fra siden: glassplate med stålstolpe ytterst og håndlist på toppen. Tegnes etter
 * personen som står på balkongen, så hun synes gjennom glasset. (wallX, floorY) er der balkonggulvet møter veggen.
 */
export function Rekkverk({ wallX, floorY, p }: { wallX: number; floorY: number; p: number }) {
  const ss = useStrokeScale();
  const depth = BLOKK_MAAL.balkong * p;
  const h = BLOKK_MAAL.rekkverk * p;
  const post = Math.max(1.2, 0.06 * p);
  const rail = Math.max(1.4, 0.07 * p);
  const x2 = wallX + depth;
  return (
    <g aria-hidden>
      <rect x={wallX} y={floorY - h} width={depth} height={h} fill={alpha(SCENE.glass, 0.42)} stroke={alpha(SCENE.glassEdge, 0.9)} strokeWidth={0.7 * ss} />
      {/* Refleks i glasset */}
      <path
        d={`M${r2(wallX + depth * 0.18)},${r2(floorY - h * 0.08)} L${r2(wallX + depth * 0.42)},${r2(floorY - h * 0.92)} L${r2(wallX + depth * 0.52)},${r2(floorY - h * 0.92)} L${r2(wallX + depth * 0.28)},${r2(floorY - h * 0.08)} Z`}
        fill={SCENE.highlight}
        opacity={0.35}
      />
      <line x1={x2 - post / 2} y1={floorY} x2={x2 - post / 2} y2={floorY - h} stroke={SCENE.outline} strokeWidth={post + 1.1 * ss} strokeLinecap="round" />
      <line x1={x2 - post / 2} y1={floorY} x2={x2 - post / 2} y2={floorY - h} stroke={SCENE.metal} strokeWidth={post} strokeLinecap="round" />
      <line x1={wallX} y1={floorY - h} x2={x2} y2={floorY - h} stroke={SCENE.outline} strokeWidth={rail + 1.1 * ss} strokeLinecap="round" />
      <line x1={wallX} y1={floorY - h} x2={x2} y2={floorY - h} stroke={SCENE.metal} strokeWidth={rail} strokeLinecap="round" />
      <line x1={wallX} y1={floorY - h - rail * 0.25} x2={x2} y2={floorY - h - rail * 0.25} stroke={SCENE.metalLight} strokeWidth={rail * 0.35} strokeLinecap="round" opacity={0.8} />
    </g>
  );
}
