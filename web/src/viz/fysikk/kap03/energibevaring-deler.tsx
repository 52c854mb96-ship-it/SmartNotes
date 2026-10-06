/**
 * Egne gjenstander til «Bevaring av mekanisk energi» (scene-kit-et har person, akebrett og terreng, men ikke
 * skateboard og halfpipe): skateboard, skater på brettet, aker på akebrettet og detaljene på halfpipen
 * (bindingsverk, coping og rekkverk). Samme stil som scene-kit-et: SCENE-farger, toninger fra core.tsx, kontur
 * og myke skygger. Alle mål er i meter gjennom `ppm` (figurenheter per meter), så alt står i samme skala.
 */
import { memo } from 'react';
import {
  Akebrett,
  ContactShadow,
  LinearGradient,
  Person,
  Place,
  RadialGradient,
  SCENE,
  materialStops,
  shade,
  sphereStops,
  tint,
  useStrokeScale,
  useSvgId,
  type Leddvinkler,
} from '../../kit/scene';
import { PERSON_HEIGHT, SKATEBOARD, SLED_LENGTH, framePoint, type RiderFrame, type SceneLayout } from './energibevaring-scene';
import type { Track } from './model';

const r1 = (v: number) => Math.round(v * 10) / 10;

/* ---------- Skateboard ---------- */

/**
 * Skateboard sett fra siden: brett i lønnefinér med kicktail i begge ender og grippetape oppå, truckene i metall og
 * fire hjul i lys uretan. Tegnes i centimeter (brettet er 80 cm langt), så 1 enhet = size/80.
 * Ankerpunktet (x, y) er på underlaget midt mellom hjulene; oversiden av brettet er SKATEBOARD.deck over det.
 */
export function Skateboard({ x, y, size, rotate, flip, hjulvinkel = 0 }: { x: number; y: number; size: number; rotate?: number; flip?: boolean; hjulvinkel?: number }) {
  const k = Math.max(0.01, size) / 80;
  const ss = useStrokeScale();
  const sw = (w: number) => (w * ss) / k;
  const id = useSvgId('skateboard');
  const top = -SKATEBOARD.deck * 100;
  const th = 1.7;
  // Oversiden: flat mellom truckene, kicktail opp i begge ender
  const deck =
    `M-40,${top - 4.6}C-38.6,${top - 1.6} -35.4,${top} -31,${top}L31,${top}C35.4,${top} 38.6,${top - 1.6} 40,${top - 4.6}` +
    `L40.6,${top - 3.4}C39,${top + th - 0.4} 35.6,${top + th} 31,${top + th}L-31,${top + th}C-35.6,${top + th} -39,${top + th - 0.4} -40.6,${top - 3.4}Z`;
  const wheelR = 2.9;
  return (
    <Place x={x} y={y} rotate={rotate} flip={flip} scale={k}>
      <ContactShadow cx={0} cy={0} rx={34} ry={2.2} />
      <LinearGradient id={`${id}-brett`} stops={materialStops(SCENE.woodLight, 1.1)} />
      <LinearGradient id={`${id}-truck`} stops={materialStops(SCENE.metal, 1.3)} />
      <RadialGradient id={`${id}-hjul`} fx={0.35} fy={0.3} stops={sphereStops(tint(SCENE.plastic, 0.1))} />
      {[-23, 23].map((cx) => (
        <g key={cx}>
          {/* Trucken: bunnplate under brettet og hengeren ned til akselen */}
          <rect x={cx - 5} y={top + th} width={10} height={1.5} rx={0.5} fill={`url(#${id}-truck)`} stroke={SCENE.outline} strokeWidth={sw(0.5)} />
          <path
            d={`M${cx - 4},${top + th + 1.5}L${cx + 4},${top + th + 1.5}L${cx + 2.2},${-wheelR - 0.6}L${cx - 2.2},${-wheelR - 0.6}Z`}
            fill={`url(#${id}-truck)`}
            stroke={SCENE.outline}
            strokeWidth={sw(0.5)}
            strokeLinejoin="round"
          />
          <circle cx={cx} cy={-wheelR} r={wheelR} fill={`url(#${id}-hjul)`} stroke={SCENE.outline} strokeWidth={sw(0.6)} />
          <circle cx={cx} cy={-wheelR} r={wheelR * 0.38} fill={shade(SCENE.plastic, 0.35)} />
          <line
            x1={cx}
            y1={-wheelR}
            x2={cx + Math.sin((hjulvinkel * Math.PI) / 180) * wheelR * 0.8}
            y2={-wheelR - Math.cos((hjulvinkel * Math.PI) / 180) * wheelR * 0.8}
            stroke={shade(SCENE.plastic, 0.3)}
            strokeWidth={sw(0.5)}
          />
        </g>
      ))}
      <path d={deck} fill={`url(#${id}-brett)`} stroke={SCENE.outline} strokeWidth={sw(0.7)} strokeLinejoin="round" />
      {/* Grippetape oppå */}
      <path
        d={`M-39.6,${top - 4.4}C-38.2,${top - 1.4} -35.2,${top + 0.2} -31,${top + 0.2}L31,${top + 0.2}C35.2,${top + 0.2} 38.2,${top - 1.4} 39.6,${top - 4.4}`}
        fill="none"
        stroke={SCENE.rubber}
        strokeWidth={sw(1)}
        strokeLinecap="round"
      />
    </Place>
  );
}

/* ---------- Skater og aker ---------- */

/** Skaterens stilling: på huk med det ene beinet foran det andre og armene ut for balansen. */
const SKATER_POSE: Partial<Leddvinkler> = {
  rygg: 18,
  nakke: -14,
  hoyreHofte: 70,
  hoyreKne: 70,
  hoyreSkulder: 58,
  hoyreAlbue: 28,
  venstreSkulder: -38,
  venstreAlbue: 18,
};

/** Hvor mye av høyden skaterens hode står over brettet på huk (andel av 1,75 m). */
export const SKATER_TOP = 0.11 + 0.82 * PERSON_HEIGHT;
/** Hodet til den som sitter på akebrettet (m over snøen). */
export const SLEDDER_TOP = 0.95;

/** Skater på skateboard, stående langs banen i rammen `fr`, med ansiktet i retningen `dir`. */
export function Skater({ fr, ppm, dir, d }: { fr: RiderFrame; ppm: number; dir: 1 | -1; d: number }) {
  const feet = framePoint(fr, 0, SKATEBOARD.deck * ppm);
  // Hjulene ruller strekningen d (radius 2,9 cm)
  const hjulvinkel = ((d / 0.029) * 180) / Math.PI;
  return (
    <g>
      <Skateboard x={fr.x} y={fr.y} size={SKATEBOARD.length * ppm} rotate={fr.rotate} flip={dir < 0} hjulvinkel={hjulvinkel * dir} />
      <Person
        x={feet.x}
        y={feet.y}
        size={PERSON_HEIGHT * ppm}
        rotate={fr.rotate}
        flip={dir < 0}
        pose="staa"
        ledd={SKATER_POSE}
        jakke="blaa"
        bukse={SCENE.denim}
        hjelm="svart"
        sko="graa"
        skygge={false}
      />
    </g>
  );
}

/** Punktet (lx, ly) i akebrettets egne enheter (80 = brettets lengde) når brettet står i rammen `fr`. */
function sledPoint(fr: RiderFrame, k: number, lx: number, ly: number) {
  return framePoint(fr, lx * k, -ly * k);
}

/** Person som sitter på et akebrett med beina fram, langs banen i rammen `fr`. Nesa peker alltid mot høyre. */
export function Aker({ fr, ppm }: { fr: RiderFrame; ppm: number }) {
  const size = SLED_LENGTH * ppm;
  const k = size / 80;
  const seat = sledPoint(fr, k, -10, -3.5);
  return (
    <g>
      <Akebrett x={fr.x} y={fr.y} size={size} rotate={fr.rotate} lakk="rod" />
      <Person
        x={seat.x}
        y={seat.y}
        size={PERSON_HEIGHT * ppm}
        rotate={fr.rotate}
        pose="sitte"
        jakke="gul"
        lue="blaa"
        bukse={SCENE.denim}
        fest={{ hoyreFot: sledPoint(fr, k, 38, -16), venstreFot: sledPoint(fr, k, 36, -17) }}
      />
    </g>
  );
}

/* ---------- Halfpipe ---------- */

/** Overflaten på halfpipen (m): plattform, U-rampe og plattform. Brukes som punkter til Terreng. */
export function halfpipeProfile(track: Track, L: Pick<SceneLayout, 'xLeft' | 'xRight'>): [number, number][] {
  const pts: [number, number][] = [[L.xLeft - 0.5, track.top]];
  for (let x = track.xMin; x <= track.xMax + 1e-9; x += 0.1) pts.push([x, track.height(Math.min(x, track.xMax))]);
  pts.push([L.xRight + 0.5, track.top]);
  return pts;
}

/**
 * Detaljene på halfpipen oppå Terreng-flaten: bindingsverket (stendere og svill) i siden, coping (stålrør) på
 * kantene og rekkverk bak plattformene. Statisk, så den tegnes én gang.
 */
export const HalfpipeDetaljer = memo(function HalfpipeDetaljer({ track, L }: { track: Track; L: SceneLayout }) {
  const ss = useStrokeScale();
  const id = useSvgId('halfpipe');
  const { X, Y, ppm, groundY } = L;
  const band = 0.16 * ppm;
  // Stendere hver 1,1 m fra undersiden av ridelaget ned til svillen
  const sill = groundY - Math.max(4, 0.14 * ppm);
  const studs: string[] = [];
  for (let x = L.xLeft + 0.35; x < L.xRight; x += 1.1) {
    const h = x < track.xMin || x > track.xMax ? track.top : track.height(x);
    const yTop = Y(h) + band + 2;
    if (sill - yTop > 6) studs.push(`M${r1(X(x))},${r1(yTop)}L${r1(X(x))},${r1(sill)}`);
  }
  // Ribbe langs undersiden av ridelaget (der platene er skrudd fast)
  let rib = '';
  for (let x = track.xMin; x <= track.xMax + 1e-9; x += 0.2) {
    const h = track.height(x);
    const k = track.slope(x);
    const n = Math.sqrt(1 + k * k);
    const px = X(x) + (k / n) * band;
    const py = Y(h) + (1 / n) * band;
    rib += `${rib ? 'L' : 'M'}${r1(px)},${r1(py)}`;
  }
  const copeR = Math.max(2.6 * ss, 0.07 * ppm);
  // Rekkverket bak plattformene: stolper ved enden og ved kanten, rør i 0,5 m og 1,0 m høyde
  const rails = [
    [L.xLeft + 0.12, track.xMin - 0.32],
    [track.xMax + 0.32, L.xRight - 0.12],
  ] as const;
  return (
    <g aria-hidden>
      <LinearGradient id={`${id}-cope`} stops={materialStops(SCENE.metal, 1.4)} />
      <path d={studs.join('')} stroke={shade(SCENE.wood, 0.42)} strokeWidth={1.6 * ss} opacity={0.5} />
      <path d={rib} fill="none" stroke={shade(SCENE.wood, 0.45)} strokeWidth={1.4 * ss} opacity={0.55} strokeLinejoin="round" />
      <rect x={X(L.xLeft) - 2} y={sill} width={X(L.xRight) - X(L.xLeft) + 4} height={groundY - sill} fill={shade(SCENE.wood, 0.3)} stroke={SCENE.outline} strokeWidth={0.8 * ss} />
      {rails.map(([a, b], i) => {
        const y0 = Y(track.top);
        const y1 = Y(track.top + 1);
        const ym = Y(track.top + 0.5);
        const posts = `M${r1(X(a))},${r1(y0)}L${r1(X(a))},${r1(y1)}M${r1(X(b))},${r1(y0)}L${r1(X(b))},${r1(y1)}`;
        const bars = `M${r1(X(a))},${r1(y1)}L${r1(X(b))},${r1(y1)}M${r1(X(a))},${r1(ym)}L${r1(X(b))},${r1(ym)}`;
        return (
          <g key={i} strokeLinecap="round">
            <path d={posts + bars} stroke={SCENE.outline} strokeWidth={3.4 * ss} fill="none" />
            <path d={posts + bars} stroke={SCENE.metal} strokeWidth={2 * ss} fill="none" />
            <path d={bars} stroke={SCENE.metalLight} strokeWidth={0.7 * ss} fill="none" transform={`translate(0 ${-0.5 * ss})`} />
          </g>
        );
      })}
      {[track.xMin, track.xMax].map((x) => (
        <circle key={x} cx={X(x) + (x < 6 ? 0.4 : -0.4) * copeR} cy={Y(track.top) + 0.35 * copeR} r={copeR} fill={`url(#${id}-cope)`} stroke={SCENE.outline} strokeWidth={0.8 * ss} />
      ))}
    </g>
  );
});
