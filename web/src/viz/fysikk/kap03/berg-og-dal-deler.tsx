/**
 * Egne gjenstander til «Berg-og-dal-bane» (scene-kit-et har vogna, men ikke banen): stålbane med skinne, ryggrør og
 * sviller, støtter med avstivere, kjetting i heisebakken og bremser, og passasjerer i vogna.
 * Samme stil som scene-kit-et: SCENE-farger, toninger fra core.tsx, kontur og myke skygger.
 */
import { memo, useMemo } from 'react';
import { ContactShadow, LinearGradient, PAINTS, Place, SCENE, materialStops, mix, shade, tint, useStrokeScale, useSvgId } from '../../kit/scene';
import type { Coaster } from './model-berg-og-dal';

/** Lakken på skinnene. */
export const RAIL_PAINT = PAINTS.rod;

export interface TrackLayout {
  /** Figurkoordinat for vannrett posisjon x (m). */
  X: (x: number) => number;
  /** Figurkoordinat for høyden h (m). */
  Y: (h: number) => number;
  /** Piksler per meter. */
  ppm: number;
  /** Bakken (y i figuren). */
  groundY: number;
  /** Synlig område (m). */
  xLeft: number;
  xRight: number;
  /** Tykkelsen på skinnen (figurens enheter). Vogna står oppå den. */
  rail: number;
}

interface Pt {
  x: number;
  y: number;
}

const r1 = (v: number) => Math.round(v * 10) / 10;
const path = (pts: Pt[]) => pts.map((p, i) => `${i ? 'L' : 'M'}${r1(p.x)},${r1(p.y)}`).join('');

/** Punktet på oversiden av skinnen og normalen ned i figuren (y nedover). */
function railFrame(c: Coaster, L: TrackLayout, x: number) {
  const k = c.slope(x);
  const n = Math.sqrt(1 + k * k);
  return { x: L.X(x), y: L.Y(c.height(x)), dx: k / n, dy: 1 / n };
}

/** Geometrien til banen i figuren: skinne, ryggrør, sviller, støtter, kjetting og bremser. */
export function trackGeometry(c: Coaster, L: TrackLayout) {
  const gap = L.rail * 0.95;
  const spine = L.rail * 1.45;
  const railMid = L.rail / 2;
  const spineMid = L.rail + gap + spine / 2;
  const x0 = Math.max(c.xMin, L.xLeft - 2);
  const x1 = Math.min(c.xMax, L.xRight + 2);
  const rail: Pt[] = [];
  const back: Pt[] = [];
  const top: Pt[] = [];
  const chain: Pt[] = [];
  for (let x = x0; x <= x1 + 1e-9; x += 0.2) {
    const f = railFrame(c, L, x);
    top.push({ x: f.x, y: f.y });
    rail.push({ x: f.x + f.dx * railMid, y: f.y + f.dy * railMid });
    back.push({ x: f.x + f.dx * spineMid, y: f.y + f.dy * spineMid });
    if (x <= c.crest.x) chain.push({ x: f.x + f.dx * (L.rail + gap * 0.5), y: f.y + f.dy * (L.rail + gap * 0.5) });
  }
  // Sviller mellom skinnen og ryggrøret med fast avstand langs banen
  const ties: [Pt, Pt][] = [];
  const tieGap = 1.6;
  let next = Math.ceil(c.pathLength(x0) / tieGap) * tieGap;
  for (let x = x0; x <= x1; x += 0.05) {
    if (c.pathLength(x) < next) continue;
    next += tieGap;
    const f = railFrame(c, L, x);
    ties.push([
      { x: f.x + f.dx * L.rail, y: f.y + f.dy * L.rail },
      { x: f.x + f.dx * (spineMid + spine / 2), y: f.y + f.dy * (spineMid + spine / 2) },
    ]);
  }
  // Støtter hver 5. meter, fra undersiden av ryggrøret ned til bakken
  const supports: { x: number; top: number }[] = [];
  for (let x = Math.ceil(x0 / 5) * 5; x <= x1; x += 5) {
    const f = railFrame(c, L, x);
    const yTop = f.y + f.dy * (spineMid + spine / 2);
    if (L.groundY - yTop > 4) supports.push({ x: f.x + f.dx * spineMid, top: yTop });
  }
  // Bremser i bremsestrekningen etter D
  const brakes: Pt[] = [];
  for (let x = c.xEnd + 1.5; x <= x1; x += 0.5) {
    const f = railFrame(c, L, x);
    brakes.push({ x: f.x, y: f.y + L.rail + gap * 0.5 });
  }
  return {
    rail: path(rail),
    spine: path(back),
    top: path(top),
    chain: path(chain),
    ties,
    supports,
    brakes,
    spineWidth: spine,
    gap,
  };
}

export type TrackGeometry = ReturnType<typeof trackGeometry>;

/** Støttene med avstivere. Tegnes før banen (bak den). */
export const Stotter = memo(function Stotter({ geo, groundY, ppm }: { geo: TrackGeometry; groundY: number; ppm: number }) {
  const ss = useStrokeScale();
  const id = useSvgId('bob-stotte');
  const w = Math.max(2.4, 0.42 * ppm) * ss;
  const bay = 7 * ppm;
  const braces: string[] = [];
  const s = geo.supports;
  for (let i = 1; i < s.length; i++) {
    const a = s[i - 1]!;
    const b = s[i]!;
    // Avstivere i felt på 7 m mellom nabostøttene, så langt opp som den laveste av dem
    const lowTop = Math.max(a.top, b.top) + 3;
    for (let y = groundY; y - bay > lowTop - bay * 0.25; y -= bay) {
      const yTop = Math.max(lowTop, y - bay);
      braces.push(`M${r1(a.x)},${r1(y)}L${r1(b.x)},${r1(yTop)}M${r1(a.x)},${r1(yTop)}L${r1(b.x)},${r1(y)}`);
      braces.push(`M${r1(a.x)},${r1(yTop)}L${r1(b.x)},${r1(yTop)}`);
    }
  }
  return (
    <g aria-hidden>
      <LinearGradient id={id} x2={1} y2={0} stops={materialStops(SCENE.metalLight, 1.1)} />
      <path d={braces.join('')} fill="none" stroke={mix(SCENE.metal, SCENE.metalDark, 0.35)} strokeWidth={0.9 * ss} opacity={0.75} />
      {s.map((p) => (
        <g key={r1(p.x)}>
          <ContactShadow cx={p.x} cy={groundY} rx={w * 2.2} ry={w * 0.55} opacity={0.7} />
          <rect x={p.x - w / 2} y={p.top} width={w} height={Math.max(0, groundY - p.top)} fill={`url(#${id})`} stroke={SCENE.outline} strokeWidth={0.6 * ss} />
          <rect x={p.x - w * 1.2} y={groundY - w * 0.9} width={w * 2.4} height={w * 1.1} rx={w * 0.2} fill={SCENE.concrete} stroke={SCENE.outline} strokeWidth={0.5 * ss} />
        </g>
      ))}
    </g>
  );
});

/** Stålbanen: ryggrør, sviller, skinne med høylys, kjetting i heisebakken og bremser etter D. */
export const Skinner = memo(function Skinner({ geo, rail }: { geo: TrackGeometry; rail: number }) {
  const ss = useStrokeScale();
  const edge = SCENE.outline;
  return (
    <g aria-hidden>
      <path d={geo.spine} fill="none" stroke={edge} strokeWidth={geo.spineWidth + 1.6 * ss} strokeLinejoin="round" />
      <path d={geo.spine} fill="none" stroke={shade(RAIL_PAINT, 0.18)} strokeWidth={geo.spineWidth} strokeLinejoin="round" />
      <path d={geo.spine} fill="none" stroke={tint(RAIL_PAINT, 0.3)} strokeWidth={Math.max(0.8, geo.spineWidth * 0.22)} strokeLinejoin="round" transform={`translate(0 ${r1(-geo.spineWidth * 0.18)})`} opacity={0.7} />
      <path
        d={geo.ties.map(([a, b]) => `M${r1(a.x)},${r1(a.y)}L${r1(b.x)},${r1(b.y)}`).join('')}
        stroke={shade(SCENE.metalDark, 0.1)}
        strokeWidth={Math.max(1.2, rail * 0.42)}
        strokeLinecap="round"
      />
      {geo.brakes.length > 0 && (
        <path
          d={geo.brakes.map((p) => `M${r1(p.x - 1.4)},${r1(p.y - geo.gap * 0.45)}h2.8v${r1(geo.gap * 0.9)}h-2.8Z`).join('')}
          fill={SCENE.metalDark}
          stroke={edge}
          strokeWidth={0.4 * ss}
        />
      )}
      <path d={geo.chain} fill="none" stroke={SCENE.metalDark} strokeWidth={Math.max(1.4, rail * 0.5)} strokeDasharray={`${r1(1.6 * ss)} ${r1(1.2 * ss)}`} />
      <path d={geo.rail} fill="none" stroke={edge} strokeWidth={rail + 1.4 * ss} strokeLinejoin="round" />
      <path d={geo.rail} fill="none" stroke={RAIL_PAINT} strokeWidth={rail} strokeLinejoin="round" />
      <path d={geo.top} fill="none" stroke={tint(RAIL_PAINT, 0.45)} strokeWidth={Math.max(0.7, rail * 0.28)} strokeLinejoin="round" transform={`translate(0 ${r1(rail * 0.22)})`} />
    </g>
  );
});

/** Jakkefarger til passasjerene (ikke VIZ-fargene og ikke lakken på vogna eller skinnene). */
const JACKETS = [PAINTS.blaa, PAINTS.gronn, PAINTS.graa, PAINTS.hvit];

/**
 * Passasjerer i berg-og-dal-vogna (overkropp og hode bak siden av vogna), i vognas egne enheter (cm, fronten mot
 * høyre, skinnen i y = 0). Tegnes før Bergbanevogn med samme plassering, så setene, bøylene og skallet havner foran.
 * `lift` er hvor mye vognkassa er løftet over boggiene i kurver (samme som i Bergbanevogn).
 */
export function Passasjerer({ n, x, y, size, rotate, lift }: { n: number; x: number; y: number; size: number; rotate: number; lift: number }) {
  const ss = useStrokeScale();
  const k = size / 200;
  const sw = (w: number) => (w * ss) / k;
  // Plass 1 og 2 er de nære setene foran og bak, 3 og 4 de fjerne (litt forskjøvet og i skygge).
  const seats = [
    { dx: 0, far: false },
    { dx: -84, far: false },
    { dx: 0, far: true },
    { dx: -84, far: true },
  ].slice(0, Math.max(0, Math.min(4, Math.round(n))));
  const order = [...seats.keys()].sort((a, b) => Number(seats[b]!.far) - Number(seats[a]!.far));
  return (
    <Place x={x} y={y} rotate={rotate} scale={k}>
      <g transform={lift ? `translate(0 ${r1(-lift)})` : undefined}>
        {order.map((i) => {
          const s = seats[i]!;
          const jacket = JACKETS[i % JACKETS.length]!;
          const ox = s.dx + (s.far ? 7 : 0);
          const oy = s.far ? -3 : 0;
          const dim = s.far ? 0.22 : 0;
          return (
            <g key={i} transform={`translate(${ox} ${oy})`}>
              <path
                d="M8,-60L8,-86C8,-93 13,-97 19,-97C25,-97 29,-93 29,-86L30,-60Z"
                fill={shade(jacket, 0.08 + dim)}
                stroke={SCENE.outline}
                strokeWidth={sw(0.7)}
              />
              <circle cx={19} cy={-108} r={10.5} fill={shade(SCENE.skin, dim)} stroke={SCENE.outline} strokeWidth={sw(0.7)} />
              <path d="M8.6,-108C8.4,-116 13,-120 19.5,-120C25.5,-120 29.6,-116 29.4,-110C26,-113 21,-114 16,-112C13,-111 10.5,-109.6 8.6,-108Z" fill={shade(SCENE.hair, dim)} />
            </g>
          );
        })}
      </g>
    </Place>
  );
}

/**
 * Hvor mye Bergbanevogn løfter vognkassa over skinnen i en kurve (cm i vognas enheter), samme regel som i
 * scene-kit-et: boggiene står ±62 cm fra midten på en sirkel med krumningen `krumning` (1/R i figurens enheter).
 */
export function coasterBodyLift(size: number, krumning: number): number {
  const k = size / 200;
  const kap = krumning * k;
  if (!kap) return 0;
  const q = Math.min(0.9, Math.max(-0.9, kap * 62));
  return (1 - Math.sqrt(1 - q * q)) / kap;
}

/** Myk skygge av vogna på bakken rett under den (blekere jo høyere vogna er). */
export function CartShadow({ x, groundY, size, height }: { x: number; groundY: number; size: number; height: number }) {
  const fade = Math.max(0.15, 1 - height / 260);
  return <ContactShadow cx={x} cy={groundY} rx={size * 0.45 * (1 + height / 400)} ry={size * 0.07} opacity={0.55 * fade} />;
}

export function useTrackGeometry(c: Coaster, L: TrackLayout) {
  // Banen endres bare med h₀ og utformingen, ikke mens vogna kjører
  return useMemo(() => trackGeometry(c, L), [c, L]);
}
