/**
 * Gjenstander og bakgrunn til scenen i k1-simulering (fallskjermhopper før skjermen er ute), i samme stil som scene-kit-et:
 * toninger fra core.tsx, SCENE-farger, tynn kontur og myke overganger.
 *
 *   <FallHimmel w={588} h={380} horisont={318} falt={s} />      // himmel, skyer som glir oppover og dalen langt nede
 *   <Hopper x={cx} y={cy} size={112} stilling="mage" />          // ankerpunkt i tyngdepunktet
 *   <Hoppefly x={cx} y={90} size={300} />                        // hoppfly, ankerpunkt i dørterskelen
 *   <Hoydemaaler x={700} y={262} r={54} hoyde={3866} />          // armbåndshøydemåler (0–4 000 m)
 */
import { memo, useMemo } from 'react';
import {
  LinearGradient,
  Landskap,
  PAINTS,
  Person,
  RadialGradient,
  SCENE,
  SpeedLines,
  alpha,
  materialStops,
  mix,
  paint,
  personPunkter,
  sceneRandom,
  shade,
  tint,
  useStrokeScale,
  useSvgId,
  type Leddvinkler,
  type PaintName,
} from '../../kit/scene';
import { MEK, ObjectText } from '../../kit/scene/mekanikk-felles';
import { VIZ, fmt } from '../../kit';

const r2 = (v: number) => Math.round(v * 100) / 100;
const mod = (a: number, n: number) => ((a % n) + n) % n;

/* ---------------------------------------------------------------- Himmel med skyer som glir forbi */

interface CloudSpec {
  x: number;
  y: number;
  w: number;
  d: string;
}

/** Haugsky med flat bunn (fire «puter» og et rektangel) som i Himmel, sentrert på bunnen i (0, 0). */
function cloudPath(w: number, rand: () => number): string {
  const h = w / 2.6;
  const j = () => 0.88 + rand() * 0.24;
  const c = (cx: number, cy: number, r: number) =>
    // Med klokka, som rektangelet, så putene smelter sammen med det (nonzero) i stedet for å bli hull.
    `M${r2(cx - r)},${r2(cy)}a${r2(r)},${r2(r)} 0 1,1 ${r2(2 * r)},0a${r2(r)},${r2(r)} 0 1,1 ${r2(-2 * r)},0Z`;
  const puffs: [number, number, number][] = [
    [-0.36 * w, -0.3 * h * j(), 0.3 * h * j()],
    [-0.12 * w, -0.5 * h, 0.5 * h * j()],
    [0.14 * w, -0.44 * h, 0.42 * h * j()],
    [0.36 * w, -0.27 * h, 0.27 * h * j()],
  ];
  let d = `M${r2(-0.36 * w)},${r2(-0.3 * h)}L${r2(0.36 * w)},${r2(-0.27 * h)}L${r2(0.36 * w)},0L${r2(-0.36 * w)},0Z`;
  for (const [px, py, pr] of puffs) d += c(px, Math.min(py, -pr), pr);
  return d;
}

function planLayer(w: number, h: number, n: number, size: number, seed: number): CloudSpec[] {
  const rand = sceneRandom(seed);
  const out: CloudSpec[] = [];
  for (let i = 0; i < n; i++) {
    const cw = size * (0.7 + rand() * 0.6);
    // Jevnt fordelt i høyden (så det alltid er skyer i bildet), litt tilfeldig sidelengs
    out.push({ x: w * (0.08 + 0.84 * rand()), y: (h / n) * (i + 0.3 + rand() * 0.4), w: cw, d: cloudPath(cw, rand) });
  }
  return out;
}

interface FallHimmelProps {
  /** Øverste venstre hjørne. */
  x?: number;
  y?: number;
  w: number;
  h: number;
  /** Horisonten (figurens y): fjellene står på den, og dalen langt nede fyller under den. */
  horisont: number;
  /** Hvor langt hopperen har falt (m). Skyene glir oppover når kameraet følger hopperen ned. */
  falt: number;
  /** Hvor mange figurenheter de nære skyene flytter seg per meter fall (de fjerne mindre). */
  parallakse?: number;
  /** Skystørrelse (standard etter bredden). */
  sky?: number;
}

/**
 * Himmel sett fra ca. 3–4 km høyde: lys toning, fjell langt borte i dis på horisonten, dalen med fjord og jorder
 * langt nede under horisonten, og to lag haugskyer som glir oppover når kameraet følger hopperen ned (de nære
 * raskere enn de fjerne). Klippes til rammen med avrundede hjørner.
 */
export const FallHimmel = memo(function FallHimmel({ x = 0, y = 0, w, h, horisont, falt, parallakse = 1.6, sky }: FallHimmelProps) {
  const clip = useSvgId('sim-himmel');
  const skyGrad = useSvgId('sim-luft');
  const dal = useSvgId('sim-dal');
  const dis = useSvgId('sim-dis');
  const cloudG = useSvgId('sim-sky');
  const ss = useStrokeScale();
  const cw = sky ?? Math.max(90, w * 0.24);
  const near = useMemo(() => planLayer(w, h, 3, cw, 11), [w, h, cw]);
  const far = useMemo(() => planLayer(w, h, 4, cw * 0.55, 23), [w, h, cw]);
  const fields = useMemo(() => {
    // Jorder og skog i dalen: flate firkanter som blir smalere og tettere mot horisonten (perspektiv).
    const rand = sceneRandom(7);
    const out: { d: string; fill: string; o: number }[] = [];
    const depth = y + h - horisont;
    for (let row = 0; row < 7; row++) {
      const t0 = (row / 7) ** 1.7;
      const t1 = ((row + 1) / 7) ** 1.7;
      const y0 = horisont + 2 + t0 * depth;
      const y1 = horisont + 2 + t1 * depth;
      const n = 9 - row;
      for (let i = 0; i < n; i++) {
        if (rand() < 0.35) continue;
        const span = w / n;
        const xa = x + span * (i + 0.1 + rand() * 0.2);
        const xb = xa + span * (0.45 + rand() * 0.35);
        const skew = (rand() - 0.5) * span * 0.25;
        const fill = rand() < 0.45 ? SCENE.foliageDark : rand() < 0.6 ? SCENE.grass : SCENE.grassDark;
        out.push({
          d: `M${r2(xa)},${r2(y0)}L${r2(xb)},${r2(y0)}L${r2(xb + skew)},${r2(y1 - 1)}L${r2(xa + skew)},${r2(y1 - 1)}Z`,
          fill,
          o: 0.35 + 0.4 * (row / 7),
        });
      }
    }
    return out;
  }, [x, y, w, h, horisont]);
  const fjord = useMemo(() => {
    // Fjorden snor seg fra horisonten mot oss og blir bredere nærmere.
    const depth = y + h - horisont;
    const pts: [number, number, number][] = [];
    for (let i = 0; i <= 8; i++) {
      const t = i / 8;
      const yy = horisont + 1 + t ** 1.5 * depth;
      const cx = x + w * (0.62 - 0.22 * t + 0.06 * Math.sin(t * 5));
      pts.push([cx, yy, 3 + t * t * w * 0.11]);
    }
    const left = pts.map(([cx, yy, hw]) => `${r2(cx - hw)},${r2(yy)}`);
    const right = pts
      .slice()
      .reverse()
      .map(([cx, yy, hw]) => `${r2(cx + hw)},${r2(yy)}`);
    return `M${left.join('L')}L${right.join('L')}Z`;
  }, [x, y, w, h, horisont]);
  if (!(w > 0) || !(h > 0)) return null;
  const s = Number.isFinite(falt) ? Math.max(0, falt) : 0;
  const layer = (clouds: CloudSpec[], k: number, opacity: number) =>
    clouds.map((c, i) => {
      const span = h + c.w;
      // Skyene glir oppover (mot mindre y) når hopperen faller, og kommer inn igjen nedenfra.
      const cy = y + mod(c.y - s * k + c.w * 0.5, span) - c.w * 0.25;
      return <path key={i} d={c.d} transform={`translate(${r2(x + c.x)} ${r2(cy)})`} fill={`url(#${cloudG})`} opacity={opacity} />;
    });
  return (
    <g aria-hidden>
      <defs>
        <clipPath id={clip}>
          <rect x={x} y={y} width={w} height={h} rx={10} />
        </clipPath>
      </defs>
      <LinearGradient
        id={skyGrad}
        userSpace
        x1={0}
        y1={y}
        x2={0}
        y2={horisont}
        stops={[
          [0, SCENE.skyTop],
          [0.75, mix(SCENE.skyTop, SCENE.skyBottom, 0.6)],
          [1, SCENE.skyBottom],
        ]}
      />
      <LinearGradient
        id={dal}
        userSpace
        x1={0}
        y1={horisont}
        x2={0}
        y2={y + h}
        stops={[
          [0, mix(SCENE.hillFar, SCENE.skyBottom, 0.55)],
          [1, mix(SCENE.grassDark, SCENE.hillFar, 0.45)],
        ]}
      />
      <LinearGradient
        id={dis}
        userSpace
        x1={0}
        y1={horisont}
        x2={0}
        y2={y + h}
        stops={[
          [0, SCENE.skyBottom, 0.85],
          [0.5, SCENE.skyBottom, 0.35],
          [1, SCENE.skyBottom, 0.12],
        ]}
      />
      <LinearGradient
        id={cloudG}
        stops={[
          [0, tint(SCENE.cloud, 0.3)],
          [0.55, SCENE.cloud],
          [1, SCENE.cloudShade],
        ]}
      />
      <g clipPath={`url(#${clip})`}>
        <rect x={x} y={y} width={w} height={h} fill={`url(#${skyGrad})`} />
        {/* Dalen langt nede: jorder, skog og en fjord, med dis over */}
        <rect x={x} y={horisont} width={w} height={y + h - horisont} fill={`url(#${dal})`} />
        {fields.map((f, i) => (
          <path key={i} d={f.d} fill={f.fill} opacity={f.o} />
        ))}
        <path d={fjord} fill={mix(SCENE.waterDeep, SCENE.skyBottom, 0.3)} />
        <path d={fjord} fill="none" stroke={tint(SCENE.water, 0.4)} strokeWidth={0.8 * ss} opacity={0.6} />
        <rect x={x} y={horisont} width={w} height={y + h - horisont} fill={`url(#${dis})`} />
        <Landskap x={x} y={horisont + 1} w={w} h={Math.min(46, (horisont - y) * 0.16)} type="fjell" seed={4} />
        {layer(far, parallakse * 0.35, 0.7)}
        {layer(near, parallakse, 0.95)}
      </g>
      <rect x={x} y={y} width={w} height={h} rx={10} fill="none" stroke={alpha(SCENE.outline, 0.35)} strokeWidth={1 * ss} />
    </g>
  );
});

/* ---------------------------------------------------------------- Hopperen */

/** Leddene for hodet ned (stuping): strak kropp, armene over hodet (mot bakken) og beina samlet, så flaten er liten. */
const HODE_NED: Partial<Leddvinkler> = {
  rygg: 0,
  nakke: -6,
  venstreSkulder: 166,
  hoyreSkulder: 176,
  venstreAlbue: 10,
  hoyreAlbue: 6,
  venstreHofte: 4,
  hoyreHofte: -2,
  venstreKne: 12,
  hoyreKne: 6,
  venstreAnkel: 30,
  hoyreAnkel: 26,
};

/**
 * Leddene for vid drakt (magen ned): armene strake fram og litt ut, og beina nesten strake og spredt, så kroppen
 * strekker seg lenger ut enn i den vanlige magen ned-stillingen (større flate mot lufta).
 */
const VID: Partial<Leddvinkler> = {
  rygg: -8,
  nakke: -24,
  venstreSkulder: 132,
  hoyreSkulder: 146,
  venstreAlbue: 14,
  hoyreAlbue: 22,
  venstreHofte: 16,
  hoyreHofte: -12,
  venstreKne: 26,
  hoyreKne: 36,
  venstreAnkel: 44,
  hoyreAnkel: 38,
};

/** Stillingen hopperen tegnes i (samme navn som forhåndsvalgene i modellen). */
export type HopperStilling = 'hode' | 'mage' | 'vid';

/**
 * Hvordan hopperen er dreid: magen ned (liggende, hodet mot høyre), vid drakt (liggende, armer og bein strukket ut)
 * eller hodet ned, ca. 35° på skrå (hodet nede til venstre, beina oppe til høyre), så de loddrette kraftpilene fra
 * tyngdepunktet går forbi hodet og beina i stedet for langs kroppen.
 */
function placement(stilling: HopperStilling) {
  if (stilling === 'hode') return { rotate: 215, ledd: HODE_NED };
  return { rotate: 90, ledd: stilling === 'vid' ? VID : undefined };
}

/**
 * Fallskjermhopper før skjermen er ute, med ankerpunktet (x, y) i tyngdepunktet (der G angriper). Gul hoppdress, svart hjelm
 * og fallskjermsekken på ryggen. Magen ned er den vanlige stillingen; med hodet ned er flaten mot lufta mye mindre,
 * og i vid drakt med armer og bein strukket ut er den større. `size` er høyden stående (1,75 m i scenens skala).
 */
export function Hopper({ x, y, size, stilling }: { x: number; y: number; size: number; stilling: HopperStilling }) {
  const { rotate, ledd } = placement(stilling);
  return (
    <Person
      x={x}
      y={y}
      size={size}
      pose="falle"
      anker="tyngdepunkt"
      rotate={rotate}
      ledd={ledd}
      jakke="gul"
      bukse="gul"
      hjelm="svart"
      sekk="svart"
      sko="svart"
      skygge={false}
    />
  );
}

/** Hvor langt kroppen når opp og til sidene fra tyngdepunktet (til fartsstrekene og plasseringen av pilene). */
export function hopperOmriss(size: number, stilling: HopperStilling): { top: number; left: number; right: number } {
  const { rotate, ledd } = placement(stilling);
  const p = personPunkter('falle', size, ledd, { x: 0, y: 0, anker: 'tyngdepunkt', rotate });
  const pts = Object.values(p);
  return {
    top: Math.min(...pts.map((q) => q.y)),
    left: Math.min(...pts.map((q) => q.x)),
    right: Math.max(...pts.map((q) => q.x)),
  };
}

/**
 * Luft som strømmer forbi hopperen: fartsstreker som går oppover fra (x, y) (hopperen faller nedover, så lufta går
 * oppover i forhold til ham). Legg dem like utenfor endene av kroppen, så de ikke kommer borti kraftpilene og
 * etikettene over tyngdepunktet. `length` bør være proporsjonal med farten; ved 0 tegnes ingenting.
 */
export function Luftstrom({ xs, y, length, spread }: { xs: number[]; y: number; length: number; spread: number }) {
  if (!(length > 4)) return null;
  return (
    <g opacity={0.9}>
      {xs.map((x, i) => (
        <g key={i} transform={`rotate(90 ${r2(x)} ${r2(y)})`}>
          <SpeedLines x={x} y={y} length={length * (i ? 0.85 : 1)} spread={spread} color={VIZ.muted} />
        </g>
      ))}
    </g>
  );
}

/* ---------------------------------------------------------------- Hoppflyet */

// Flyet tegnes i desimeter (0,1 m) med ankerpunktet midt i dørterskelen og nesen mot høyre: et enmotors turbopropfly
// med høye vinger og fast understell, slik mange hoppklubber bruker (ca. 12,7 m langt og 4,7 m høyt).
const PLANE_BODY =
  'M50,-12.5L42,-17L-12,-17C-26,-17 -44,-14.5 -58,-12L-60,-8.5C-46,-6 -24,1.5 -10,2L54,2C61,2 66,-1 66.5,-5C66,-9.5 60,-12.5 50,-12.5Z';
const PLANE_STRIPE = 'M68,-5.6L-10,-5.6C-26,-5.6 -44,-8.6 -62,-11.6L-62,-9.2C-44,-6 -26,-2.6 -10,-2.6L68,-2.6Z';
const PLANE_FIN = 'M-38,-16.4C-45,-22.5 -51,-31 -53.5,-36L-61,-36C-61.6,-28 -61,-18 -59.4,-11.4Z';
const PLANE_FIN_TOP = 'M-50,-30L-64,-30L-64,-38L-50,-38Z';
const PLANE_TAILPLANE = 'M-45,-10.8L-62.5,-10.6C-64,-10.4 -64,-8.6 -62.5,-8.4L-45,-8.8Z';
/** Vingeprofilen der vingen sitter på taket: avrundet forkant rett over frontruta og spiss bakkant. */
const PLANE_WING = 'M44.6,-15.5C44,-19.6 40.6,-22 35.4,-22C29,-22 21,-20.6 13.5,-17.6L13.5,-16.6L42,-16.6Z';
const PLANE_COCKPIT = 'M48.4,-12.6L42.4,-16.1L37,-16.1L37,-10L48.4,-10Z';
const PLANE_WINDOWS: readonly number[] = [31, 25, -14, -21.5];
const PLANE_SPINNER = 'M66.4,-9.4C70.8,-8.6 73.2,-6.6 73.2,-5C73.2,-3.4 70.8,-1.4 66.4,-0.6Z';
const PLANE_HIGHLIGHT = 'M41,-16L-12,-16C-26,-16 -42,-13.6 -55,-11.4';
const PLANE_GEAR = 'M12,1.5L8,10M57,1.5L58.5,10.5';
/** Vingestaget fra buken opp til vingen, mellom vinduene. */
const PLANE_STRUT = 'M16,1.5L21.6,-17';
const PLANE_WHEELS: readonly { x: number; y: number; r: number }[] = [
  { x: 8, y: 10.8, r: 3.1 },
  { x: 58.5, y: 11.2, r: 2.6 },
];
/** Halv bredde og høyde på døråpningen (dm). */
const DOOR_HW = 6.5;
const DOOR_H = 13;

/**
 * Hoppfly sett fra siden med døra åpen, nesen mot høyre. Ankerpunktet (x, y) er midt i dørterskelen. `pxPerM` er
 * skalaen (figurenheter per meter) der flyet står: lenger inne i bildet enn hopperen tegnes det mindre (se
 * PLANE_DEPTH i modellen). Propellen er en uskarp skive, som når den går rundt.
 */
export function Hoppefly({ x, y, pxPerM, lakk = 'rod' }: { x: number; y: number; pxPerM: number; lakk?: PaintName | string }) {
  const id = useSvgId('sim-fly');
  const ss = useStrokeScale();
  const k = Math.max(0.01, Number.isFinite(pxPerM) ? pxPerM : 10) / 10;
  const sw = (w: number) => (w * ss) / k;
  const body = PAINTS.hvit;
  const stripe = paint(lakk);
  const window = 'var(--sc-kjoretoy-window)';
  const windowSky = 'var(--sc-kjoretoy-window-sky)';
  return (
    <g transform={`translate(${r2(x)} ${r2(y)}) scale(${r2(k * 1000) / 1000})`} aria-hidden>
      <LinearGradient id={`${id}k`} stops={materialStops(body, 1.25)} />
      <LinearGradient id={`${id}s`} stops={materialStops(stripe, 1.1)} />
      <LinearGradient id={`${id}g`} stops={[[0, windowSky], [0.55, window], [1, shade(window, 0.2)]]} />
      <LinearGradient id={`${id}d`} x2={1} y2={0} stops={[[0, shade(SCENE.metalDark, 0.62)], [1, shade(SCENE.metalDark, 0.4)]]} />
      <RadialGradient id={`${id}m`} fx={0.35} fy={0.3} stops={[[0, SCENE.metalLight], [0.6, SCENE.metal], [1, SCENE.metalDark]]} />
      <clipPath id={`${id}c`}>
        <path d={PLANE_BODY} />
      </clipPath>
      <clipPath id={`${id}f`}>
        <path d={PLANE_FIN} />
      </clipPath>
      {/* Understellet bak kroppen: fjærbein og hjul */}
      <path d={PLANE_GEAR} fill="none" stroke={SCENE.metalDark} strokeWidth={sw(2.2)} strokeLinecap="round" />
      {PLANE_WHEELS.map((w) => (
        <g key={w.x}>
          <circle cx={w.x} cy={w.y} r={w.r} fill={SCENE.rubber} stroke={SCENE.outline} strokeWidth={sw(0.8)} />
          <circle cx={w.x} cy={w.y} r={w.r * 0.45} fill={`url(#${id}m)`} />
        </g>
      ))}
      {/* Haleflata og halefinnen */}
      <path d={PLANE_TAILPLANE} fill={`url(#${id}k)`} stroke={SCENE.outline} strokeWidth={sw(0.8)} strokeLinejoin="round" />
      <path d={PLANE_FIN} fill={`url(#${id}k)`} stroke={SCENE.outline} strokeWidth={sw(0.9)} strokeLinejoin="round" />
      <path d={PLANE_FIN_TOP} fill={`url(#${id}s)`} clipPath={`url(#${id}f)`} />
      {/* Kroppen med stripe, vinduer og høylys */}
      <path d={PLANE_BODY} fill={`url(#${id}k)`} />
      <g clipPath={`url(#${id}c)`}>
        <path d={PLANE_STRIPE} fill={`url(#${id}s)`} />
        <path d="M50,-13C49,-6 49,-2 50,3" fill="none" stroke={shade(body, 0.3)} strokeWidth={sw(0.7)} />
        <path d={PLANE_HIGHLIGHT} fill="none" stroke={SCENE.highlight} strokeWidth={sw(1.4)} strokeLinecap="round" opacity={0.75} />
      </g>
      <path d={PLANE_BODY} fill="none" stroke={SCENE.outline} strokeWidth={sw(1)} strokeLinejoin="round" />
      <path d={PLANE_COCKPIT} fill={`url(#${id}g)`} stroke={shade(body, 0.45)} strokeWidth={sw(0.7)} strokeLinejoin="round" />
      {PLANE_WINDOWS.map((wx) => (
        <rect key={wx} x={wx - 2.4} y={-14.6} width={4.8} height={4.8} rx={1.4} fill={`url(#${id}g)`} stroke={shade(body, 0.45)} strokeWidth={sw(0.6)} />
      ))}
      {/* Den åpne døra: mørkt inni, med karm og håndtak over */}
      <rect x={-DOOR_HW} y={-DOOR_H} width={2 * DOOR_HW} height={DOOR_H} rx={1} fill={`url(#${id}d)`} stroke={SCENE.outline} strokeWidth={sw(0.8)} />
      <path
        d={`M${-DOOR_HW + 1.2},${-DOOR_H + 1.6}L${DOOR_HW - 1.2},${-DOOR_H + 1.6}`}
        stroke={SCENE.metal}
        strokeWidth={sw(1.1)}
        strokeLinecap="round"
        opacity={0.8}
      />
      {/* Vingen og vingestaget */}
      <path d={PLANE_STRUT} stroke={shade(SCENE.metal, 0.1)} strokeWidth={sw(1.8)} strokeLinecap="round" />
      <path d={PLANE_STRUT} stroke={SCENE.outline} strokeWidth={sw(0.5)} strokeLinecap="round" opacity={0.5} />
      <path d={PLANE_WING} fill={`url(#${id}k)`} stroke={SCENE.outline} strokeWidth={sw(0.9)} strokeLinejoin="round" />
      {/* Nesen: spinner og propellen som en uskarp skive */}
      <path d={PLANE_SPINNER} fill={`url(#${id}m)`} stroke={SCENE.outline} strokeWidth={sw(0.8)} strokeLinejoin="round" />
      <ellipse cx={69.5} cy={-5} rx={1.8} ry={15.5} fill={alpha(SCENE.metalDark, 0.22)} />
      <ellipse cx={69.5} cy={-5} rx={0.8} ry={15.5} fill="none" stroke={alpha(SCENE.metalDark, 0.35)} strokeWidth={sw(0.6)} />
    </g>
  );
}

/** Hvor høyt flyet når over og under dørterskelen (dm), til plasseringen i scenen: halefinnen og hjulene. */
export const HOPPEFLY_DM = { top: -38, bottom: 14, left: -64, right: 74 } as const;

/* ---------------------------------------------------------------- Høydemåler */

const DEG = Math.PI / 180;

/**
 * Analog høydemåler for fallskjermhopping (på armen): svart urskive med én runde = 4 000 m (tallene er km),
 * rødt felt under 1 000 m der skjermen skal være ute, hvit viser og et lite digitalt vindu med høyden i meter.
 * Ankerpunkt: sentrum. Remmen går ut 0,3 · r over og under.
 */
export function Hoydemaaler({ x, y, r, hoyde, runde = 4000, rodt = 1000 }: { x: number; y: number; r: number; hoyde: number; runde?: number; rodt?: number }) {
  const id = useSvgId('sim-hoyde');
  const ss = useStrokeScale();
  const R = Math.max(10, r);
  const h = Math.max(0, Number.isFinite(hoyde) ? hoyde : 0);
  const dial = R * 0.84;
  // Viseren: 0 m rett opp, med klokka; ved 4 000 m er den en hel runde rundt (rett opp igjen).
  const ang = (h >= runde ? 360 : (h / runde) * 360) - 90;
  const pt = (a: number, rr: number) => `${r2(Math.cos(a * DEG) * rr)},${r2(Math.sin(a * DEG) * rr)}`;
  let major = '';
  let minor = '';
  const n = Math.round(runde / 100);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * 360 - 90;
    const big = i % 5 === 0;
    const seg = `M${pt(a, dial * 0.97)}L${pt(a, dial * (big ? (i % 10 === 0 ? 0.78 : 0.84) : 0.9))}`;
    if (big) major += seg;
    else minor += seg;
  }
  const redEnd = (Math.min(rodt, runde) / runde) * 360 - 90;
  const redArc = `M${pt(-90, dial * 0.94)}A${r2(dial * 0.94)},${r2(dial * 0.94)} 0 0,1 ${pt(redEnd, dial * 0.94)}`;
  const npx = R * 0.24;
  const nums = [0, 1, 2, 3].map((k) => {
    const a = (k / 4) * 360 - 90;
    // «2» nederst flyttes litt ned, så det ikke rører det digitale vinduet
    const rr = dial * (k === 2 ? 0.7 : 0.6);
    return { k, x: Math.cos(a * DEG) * rr, y: Math.sin(a * DEG) * rr };
  });
  const face = shade(PAINTS.svart, 0.15);
  const ink = tint(PAINTS.hvit, 0.15);
  const hand = `M${pt(ang - 90, R * 0.05)}L${pt(ang, dial * 0.86)}L${pt(ang + 90, R * 0.05)}L${pt(ang + 180, R * 0.18)}Z`;
  const dW = dial * 1.02;
  const dH = R * 0.3;
  const dY = R * 0.28;
  const strapW = R * 0.95;
  const strapL = R * 0.3;
  return (
    <g transform={`translate(${r2(x)} ${r2(y)})`}>
      <title>{`Høydemåler: ${fmt(h, 0)} m over bakken`}</title>
      <LinearGradient id={`${id}s`} x1={0} x2={1} y1={0} y2={0} stops={materialStops(SCENE.rubber, 1.4)} />
      <RadialGradient
        id={`${id}k`}
        fx={0.34}
        fy={0.3}
        stops={[
          [0, SCENE.metalLight],
          [0.55, SCENE.metal],
          [1, SCENE.metalDark],
        ]}
      />
      <RadialGradient
        id={`${id}f`}
        cx={0.45}
        cy={0.4}
        r={0.7}
        stops={[
          [0, tint(face, 0.12)],
          [1, shade(face, 0.25)],
        ]}
      />
      {/* Remmen over og under */}
      {[-1, 1].map((sgn) => (
        <rect
          key={sgn}
          x={-strapW / 2}
          y={sgn < 0 ? -R - strapL : R - R * 0.1}
          width={strapW}
          height={strapL + R * 0.1}
          rx={R * 0.08}
          fill={`url(#${id}s)`}
          stroke={SCENE.outline}
          strokeWidth={0.8 * ss}
        />
      ))}
      <circle r={R} fill={`url(#${id}k)`} stroke={SCENE.outline} strokeWidth={1 * ss} />
      <circle r={dial} fill={`url(#${id}f)`} stroke={shade(SCENE.metal, 0.45)} strokeWidth={1 * ss} />
      <path d={redArc} fill="none" stroke={PAINTS.rod} strokeWidth={dial * 0.1} />
      <path d={minor} stroke={ink} strokeWidth={Math.max(0.5, R * 0.012) * ss} opacity={0.7} />
      <path d={major} stroke={ink} strokeWidth={Math.max(0.9, R * 0.03) * ss} />
      <g fill={ink} fontWeight={700} fontSize={r2(npx)} textAnchor="middle" style={{ fontVariantNumeric: 'tabular-nums' }}>
        {nums.map((q) => (
          <text key={q.k} x={r2(q.x)} y={r2(q.y + npx * 0.36)}>
            {q.k}
          </text>
        ))}
      </g>
      {/* Tallene er kilometer. Oppe til høyre (0–1 000 m) kommer viseren sjelden, for i fallet går den fra 4 000 m mot klokka */}
      <text x={r2(dial * 0.3)} y={r2(-dial * 0.24)} textAnchor="middle" fill={ink} fontSize={r2(R * 0.15)} fontWeight={650} opacity={0.85}>
        km
      </text>
      <path d={hand} fill={PAINTS.hvit} stroke={shade(PAINTS.svart, 0.2)} strokeWidth={0.6 * ss} strokeLinejoin="round" />
      <circle r={R * 0.07} fill={SCENE.metal} stroke={SCENE.outline} strokeWidth={0.6 * ss} />
      {/* Vinduet ligger over viseren, så høyden alltid kan leses */}
      <rect x={-dW / 2} y={dY - dH / 2} width={dW} height={dH} rx={dH * 0.2} fill={SCENE.display} stroke={shade(SCENE.metal, 0.35)} strokeWidth={0.7 * ss} />
      <ObjectText x={0} y={dY} w={dW * 0.9} h={dH * 0.95} text={`${fmt(h, 0)} m`} color={SCENE.displayText} weight={650} max={15} />
      {/* Glasset */}
      <path
        d={`M${pt(195, dial * 0.88)}A${r2(dial * 0.88)},${r2(dial * 0.88)} 0 0,1 ${pt(250, dial * 0.88)}`}
        fill="none"
        stroke={alpha(SCENE.metalLight, 0.9)}
        strokeWidth={Math.max(0.8 * ss, R * 0.05)}
        strokeLinecap="round"
        opacity={0.55}
      />
      <circle r={dial} fill="none" stroke={MEK.print} strokeWidth={0.4 * ss} opacity={0.4} />
    </g>
  );
}
