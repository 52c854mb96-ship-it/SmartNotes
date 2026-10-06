/**
 * Gjenstander til visualiseringen «ballspark» som ikke finnes i scene-kit-et: et sparkebein med fotballsko (nærbilde),
 * standbeinet, en tennisracket sett nesten fra siden, en golfkølle (driver) sett fra tåa, en tee, et golfflagg langt
 * unna og straffemerket. Samme stil som kit-et: toninger fra core, SCENE- og PAINTS-farger, tynn kontur og myke skygger.
 *
 * Alle mål er i meter og ganges med `K` (piksler per meter), så gjenstandene får riktige proporsjoner mot ballene.
 * Koordinatene er figurens (x mot høyre, y nedover).
 */
import { memo } from 'react';
import {
  LinearGradient,
  PAINTS,
  SCENE,
  alpha,
  materialStops,
  mix,
  shade,
  tint,
  useStrokeScale,
  useSvgId,
} from '../../kit/scene';

type Pt = { x: number; y: number };
const DEG = Math.PI / 180;
const r2 = (v: number) => Math.round(v * 100) / 100;
const P = (p: Pt) => `${r2(p.x)},${r2(p.y)}`;

/** Glatt lukket eller åpen kurve gjennom punktene (Catmull-Rom som kubiske Bézier-kurver). */
export function smoothPath(pts: Pt[], closed: boolean): string {
  const n = pts.length;
  if (n < 2) return '';
  const at = (i: number): Pt => (closed ? pts[((i % n) + n) % n]! : pts[Math.min(n - 1, Math.max(0, i))]!);
  let d = `M${P(pts[0]!)}`;
  const last = closed ? n : n - 1;
  for (let i = 0; i < last; i++) {
    const p0 = at(i - 1);
    const p1 = at(i);
    const p2 = at(i + 1);
    const p3 = at(i + 2);
    const c1 = { x: p1.x + (p2.x - p0.x) / 6, y: p1.y + (p2.y - p0.y) / 6 };
    const c2 = { x: p2.x - (p3.x - p1.x) / 6, y: p2.y - (p3.y - p1.y) / 6 };
    d += ` C${P(c1)} ${P(c2)} ${P(p2)}`;
  }
  return closed ? `${d} Z` : d;
}

/* ================================================================================================
 * Fotballsko og legg
 * ============================================================================================== */

/**
 * Skoen i fotens koordinater (meter): a langs foten fra ankelleddet mot tærne, b vinkelrett mot sålen.
 * Rekkefølge: kragen bak, hælen, sålen, tåa, vristen og kragen foran.
 */
const BOOT: [number, number][] = [
  [-0.044, -0.054],
  [-0.068, -0.03],
  [-0.071, 0.02],
  [-0.06, 0.066],
  [-0.03, 0.074],
  [0.05, 0.073],
  [0.12, 0.069],
  [0.18, 0.061],
  [0.212, 0.044],
  [0.219, 0.022],
  [0.203, 0.006],
  [0.16, -0.008],
  [0.11, -0.021],
  [0.065, -0.033],
  [0.034, -0.05],
  [0.004, -0.066],
  [-0.024, -0.064],
];
/** Vristen (der lissene er og ballen treffes), fra tåa mot ankelen. */
const DORSUM: [number, number][] = [
  [0.203, 0.006],
  [0.16, -0.008],
  [0.11, -0.021],
  [0.065, -0.033],
  [0.034, -0.05],
];
/** Sålen fra hælen til tåa (b ved undersiden), til knottene. */
function soleB(a: number): number {
  if (a < -0.03) return 0.066 + ((a + 0.06) / 0.03) * 0.008;
  if (a < 0.05) return 0.074 - ((a + 0.03) / 0.08) * 0.001;
  if (a < 0.12) return 0.073 - ((a - 0.05) / 0.07) * 0.004;
  return 0.069 - ((a - 0.12) / 0.06) * 0.008;
}
const STUDS = [-0.05, -0.022, 0.055, 0.095, 0.135, 0.172];
/** Knottenes høyde (m). */
const STUD_H = 0.012;
/** Der ballen treffer vristen (fotens koordinater). */
export const KICK_POINT: [number, number] = [0.13, -0.016];

/** Leggen i leggens koordinater (meter): s oppover langs leggen fra ankelen, w fram (+) og bak (−). */
const SHIN_FRONT: [number, number][] = [
  [-0.01, 0.031],
  [0.08, 0.034],
  [0.2, 0.039],
  [0.34, 0.043],
  [0.52, 0.045],
];
const SHIN_BACK: [number, number][] = [
  [0.52, -0.056],
  [0.36, -0.07],
  [0.22, -0.064],
  [0.11, -0.044],
  [0.04, -0.034],
  [-0.01, -0.032],
];

export interface LegGeometry {
  /** Fra fotens koordinater (a, b) til figurens, relativt til ankelen. */
  foot: (a: number, b: number) => Pt;
  /** Fra leggens koordinater (s, w) til figurens, relativt til ankelen. */
  shin: (s: number, w: number) => Pt;
}

/**
 * Geometrien til et bein med ankelen i origo: `fotvinkel` er hvor mye foten peker ned fra vannrett (grader; 0 = flat
 * på bakken, 70 = strak vrist i et spark), `leggvinkel` hvor mye leggen heller fram fra loddrett.
 */
export function legGeometry(K: number, fotvinkel: number, leggvinkel: number): LegGeometry {
  const fa = fotvinkel * DEG;
  const u = { x: Math.cos(fa), y: Math.sin(fa) };
  const b = { x: -Math.sin(fa), y: Math.cos(fa) };
  const la = leggvinkel * DEG;
  const d = { x: Math.sin(la), y: -Math.cos(la) };
  const n = { x: Math.cos(la), y: Math.sin(la) };
  return {
    foot: (aa, bb) => ({ x: (aa * u.x + bb * b.x) * K, y: (aa * u.y + bb * b.y) * K }),
    shin: (s, w) => ({ x: (s * d.x + w * n.x) * K, y: (s * d.y + w * n.y) * K }),
  };
}

/** Treffpunktet på vristen relativt til ankelen (figurens enheter). */
export function kickPoint(K: number, fotvinkel: number, leggvinkel: number): Pt {
  return legGeometry(K, fotvinkel, leggvinkel).foot(KICK_POINT[0], KICK_POINT[1]);
}

export interface FotballbeinProps {
  /** Ankelleddet. */
  x: number;
  y: number;
  /** Piksler per meter. */
  K: number;
  fotvinkel?: number;
  leggvinkel?: number;
  /** Strømpefarge (navn fra PAINTS eller CSS-farge). */
  strompe?: string;
  sko?: string;
  /** Fargen på stripa langs siden av skoen. */
  stripe?: string;
  /** Beinet er lenger unna (standbeinet): litt mørkere. */
  fjern?: boolean;
  /** Knottene synes (false når foten står i gresset). */
  knotter?: boolean;
}

/**
 * Legg i fotballstrømpe og fotballsko med knotter, sett fra siden med tærne mot høyre. (x, y) er ankelleddet.
 * Leggen går opp mot kneet (ut av bildet i et nærbilde). Med `fotvinkel` ≈ 70 peker tærne ned og vristen fram, som i
 * et vristspark; med 0 står foten flatt (standbeinet).
 */
export const Fotballbein = memo(function Fotballbein({
  x,
  y,
  K,
  fotvinkel = 70,
  leggvinkel = 8,
  strompe = PAINTS.blaa,
  sko = PAINTS.svart,
  stripe = PAINTS.oransje,
  fjern = false,
  knotter = true,
}: FotballbeinProps) {
  const ss = useStrokeScale();
  const gSock = useSvgId('bs-strompe');
  const gBoot = useSvgId('bs-sko');
  const gShine = useSvgId('bs-glans');
  const g = legGeometry(K, fotvinkel, leggvinkel);
  const off = (p: Pt): Pt => ({ x: p.x + x, y: p.y + y });
  const F = (a: number, b: number) => off(g.foot(a, b));
  const S = (s: number, w: number) => off(g.shin(s, w));
  const dark = fjern ? 0.22 : 0;
  const cSock = shade(strompe, dark);
  const cBoot = shade(sko, dark);
  const cStripe = shade(stripe, dark + 0.05);
  const line = SCENE.outline;
  const sw = 1 * ss;

  const shinPath = smoothPath([...SHIN_FRONT.map(([s, w]) => S(s, w)), ...SHIN_BACK.map(([s, w]) => S(s, w))], true);
  const bootPath = smoothPath(
    BOOT.map(([a, b]) => F(a, b)),
    true,
  );
  // Sålen (en mørkere plate langs undersiden)
  const soleTop: Pt[] = [];
  const soleBot: Pt[] = [];
  for (let a = -0.064; a <= 0.205; a += 0.015) {
    soleBot.push(F(a, soleB(a) + 0.0015));
    soleTop.push(F(a, soleB(a) - 0.008));
  }
  const solePath = `${smoothPath(soleBot, false)} L${P(F(0.214, 0.036))} L${P(soleTop[soleTop.length - 1]!)} ${smoothPath([...soleTop].reverse(), false).replace(/^M/, 'L')} Z`;
  // Lissene: korte streker tvers over vristen
  const laces: string[] = [];
  for (let i = 0; i < 5; i++) {
    const t = 0.18 + i * 0.17;
    const p = along(DORSUM, t);
    const q = along(DORSUM, t + 0.04);
    const ta = { a: q[0] - p[0], b: q[1] - p[1] };
    const l = Math.hypot(ta.a, ta.b) || 1;
    const nb = { a: -ta.b / l, b: ta.a / l };
    const s = nb.b > 0 ? 1 : -1;
    const p1 = F(p[0] + nb.a * 0.002 * s, p[1] + nb.b * 0.002 * s);
    const p2 = F(p[0] + nb.a * 0.014 * s, p[1] + nb.b * 0.014 * s);
    laces.push(`M${P(p1)} L${P(p2)}`);
  }
  // Stripa langs siden av skoen (fra hælen mot tåa)
  const stripePath = smoothPath([F(-0.058, 0.026), F(0.0, 0.03), F(0.07, 0.024), F(0.15, 0.02), F(0.195, 0.022)], false);
  // Tapen rundt strømpa
  const tape = smoothPath([S(0.16, 0.04), S(0.16, -0.062)], false);
  const tape2 = smoothPath([S(0.185, 0.04), S(0.185, -0.064)], false);
  const collar = smoothPath([F(0.034, -0.05), F(0.004, -0.066), F(-0.024, -0.064), F(-0.044, -0.054)], false);

  return (
    <g>
      <LinearGradient id={gSock} x1={0} y1={0} x2={1} y2={0} stops={[[0, tint(cSock, 0.22)], [0.45, cSock], [1, shade(cSock, 0.3)]]} />
      <LinearGradient id={gBoot} stops={materialStops(cBoot, 1.4)} />
      <LinearGradient
        id={gShine}
        x1={0}
        y1={0}
        x2={1}
        y2={1}
        stops={[
          [0, SCENE.highlight, 0.55],
          [0.5, SCENE.highlight, 0.12],
          [1, SCENE.highlight, 0],
        ]}
      />
      {/* Leggen i strømpe, med tape rundt leggbeskytteren */}
      <path d={shinPath} fill={`url(#${gSock})`} stroke={line} strokeWidth={sw} strokeLinejoin="round" />
      <path d={tape} stroke={shade(PAINTS.hvit, dark + 0.04)} strokeWidth={0.016 * K} fill="none" opacity={0.92} />
      <path d={tape2} stroke={shade(PAINTS.hvit, dark + 0.12)} strokeWidth={0.004 * K} fill="none" opacity={0.6} />
      <path d={smoothPath([S(0.02, 0.026), S(0.15, 0.03), S(0.36, 0.034)], false)} stroke={tint(cSock, 0.35)} strokeWidth={0.006 * K} fill="none" opacity={0.5} strokeLinecap="round" />

      {/* Knottene under sålen */}
      {knotter &&
        STUDS.map((a) => {
          const b0 = soleB(a);
          const w = a < 0 ? 0.008 : 0.0065;
          const pts = [F(a - w, b0 - 0.002), F(a + w, b0 - 0.002), F(a + w * 0.65, b0 + STUD_H), F(a - w * 0.65, b0 + STUD_H)];
          return <polygon key={a} points={pts.map(P).join(' ')} fill={shade(SCENE.rubber, dark)} stroke={line} strokeWidth={0.8 * ss} strokeLinejoin="round" />;
        })}
      {/* Skoen */}
      <path d={bootPath} fill={`url(#${gBoot})`} stroke={line} strokeWidth={sw} strokeLinejoin="round" />
      <path d={solePath} fill={shade(cBoot, 0.35)} opacity={0.9} />
      <path d={stripePath} stroke={cStripe} strokeWidth={0.011 * K} fill="none" strokeLinecap="round" />
      <path d={stripePath} stroke={tint(cStripe, 0.35)} strokeWidth={0.003 * K} fill="none" strokeLinecap="round" opacity={0.7} />
      <path d={collar} stroke={tint(cBoot, 0.3)} strokeWidth={0.008 * K} fill="none" strokeLinecap="round" />
      <path d={laces.join(' ')} stroke={shade(PAINTS.hvit, dark + 0.05)} strokeWidth={0.0035 * K} strokeLinecap="round" />
      {/* Glans på overlæret */}
      <path
        d={smoothPath([F(-0.045, -0.035), F(0.02, -0.03), F(0.1, -0.006), F(0.18, 0.006)], false)}
        stroke={`url(#${gShine})`}
        strokeWidth={0.007 * K}
        fill="none"
        strokeLinecap="round"
      />
    </g>
  );
});

/** Punktet en andel t (0–1) langs en polylinje. */
function along(pts: [number, number][], t: number): [number, number] {
  const lens: number[] = [];
  let total = 0;
  for (let i = 1; i < pts.length; i++) {
    const l = Math.hypot(pts[i]![0] - pts[i - 1]![0], pts[i]![1] - pts[i - 1]![1]);
    lens.push(l);
    total += l;
  }
  let d = Math.min(Math.max(t, 0), 1) * total;
  for (let i = 1; i < pts.length; i++) {
    const l = lens[i - 1]!;
    if (d <= l || i === pts.length - 1) {
      const k = l > 0 ? Math.min(1, d / l) : 0;
      const a = pts[i - 1]!;
      const b = pts[i]!;
      return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k];
    }
    d -= l;
  }
  return pts[pts.length - 1]!;
}

/** Høyden fra bakken til ankelleddet når foten står flatt (sålen og knottene i gresset). */
export const ANKLE_HEIGHT = 0.074 + 0.004;

/* ================================================================================================
 * Tennisracket
 * ============================================================================================== */

export interface RacketProps {
  /** Midten av strengene (der ballen treffer). */
  x: number;
  y: number;
  K: number;
  /**
   * Hvor skrått vi ser racketen, i grader fra kanten (0 = rett på kanten, 90 = rett forfra). Strengene vender mot
   * høyre, så kraften fra dem på ballen (vinkelrett på strengeflaten) peker mot høyre.
   */
  skraa?: number;
  ramme?: string;
  stripe?: string;
}

/** Halvaksene til hodet (m): lengden (opp–ned) og bredden. */
const HEAD_A = 0.165;
const HEAD_B = 0.128;
/** Midten av hodet ligger litt over treffpunktet (m). */
const HEAD_DY = -0.012;
/** Rammen: tykkelsen (dybden, på tvers av strengeflaten) og bredden i strengeflaten (m). */
const FRAME_DEPTH = 0.024;
const FRAME_BEAM = 0.013;

/**
 * Tennisracket sett nesten fra siden, med strengeflaten vendt mot høyre (mot ballen). Hodet blir en smal, høy oval:
 * rammen har dybde, så den bakre og den fremre kanten av rammen ligger litt forskjøvet, og mellom dem synes siden av
 * rammen. Strengene synes gjennom åpningen. (x, y) er midten av strengene der ballen treffer; halsen og skaftet går
 * ned (ut av bildet i et nærbilde).
 */
export const Racket = memo(function Racket({ x, y, K, skraa = 13, ramme = PAINTS.svart, stripe = PAINTS.rod }: RacketProps) {
  const ss = useStrokeScale();
  const clipBack = useSvgId('bs-aapning-bak');
  const clipFront = useSvgId('bs-aapning-foran');
  const gFrame = useSvgId('bs-ramme');
  const k = Math.sin(skraa * DEG);
  const cy = y + HEAD_DY * K;
  const A = HEAD_A * K;
  const b = HEAD_B * K * k;
  const d = FRAME_DEPTH * K * Math.cos(skraa * DEG);
  const xb = x - d / 2;
  const xf = x + d / 2;
  const beamY = FRAME_BEAM * K;
  const ri = { x: Math.max(1, b - FRAME_BEAM * K * k - 0.6), y: A - beamY };
  const line = SCENE.outline;
  /** Omrisset av hele rammen: venstre halvdel av den bakre kanten, høyre halvdel av den fremre. */
  const silhouette = `M${r2(xb)},${r2(cy - A)} A${r2(b)},${r2(A)} 0 0 0 ${r2(xb)},${r2(cy + A)} L${r2(xf)},${r2(cy + A)} A${r2(b)},${r2(A)} 0 0 0 ${r2(xf)},${r2(cy - A)} Z`;

  // Strengene i midtplanet: 16 hovedstrenger (loddrette) og 19 tverrstrenger (vannrette), sett på skrå
  const mains: string[] = [];
  for (let i = 1; i < 16; i++) {
    const xx = x - ri.x + (2 * ri.x * i) / 16;
    mains.push(`M${r2(xx)},${r2(cy - ri.y)} L${r2(xx)},${r2(cy + ri.y)}`);
  }
  const crosses: string[] = [];
  for (let i = 1; i < 19; i++) {
    const yy = cy - ri.y + (2 * ri.y * i) / 19;
    crosses.push(`M${r2(x - ri.x)},${r2(yy)} L${r2(x + ri.x)},${r2(yy)}`);
  }

  // Halsen (en smal V sett fra siden) og skaftet, bak hodet
  const neckTop = cy + A * 0.78;
  const shaftTop = cy + A + 0.07 * K;
  const sw = 0.011 * K;
  const neck = `M${r2(xb - b * 0.62)},${r2(neckTop)} L${r2(xf + b * 0.62)},${r2(neckTop)} L${r2(x + sw)},${r2(shaftTop)} L${r2(x + sw)},${r2(shaftTop + 0.3 * K)} L${r2(x - sw)},${r2(shaftTop + 0.3 * K)} L${r2(x - sw)},${r2(shaftTop)} Z`;
  const neckGap = `M${r2(x - b * 0.42)},${r2(neckTop + 0.02 * K)} L${r2(x + b * 0.42)},${r2(neckTop + 0.02 * K)} L${r2(x)},${r2(shaftTop - 0.03 * K)} Z`;
  return (
    <g>
      <LinearGradient id={gFrame} x1={0} y1={0} x2={1} y2={0} stops={[[0, tint(ramme, 0.38)], [0.45, ramme], [1, shade(ramme, 0.3)]]} />
      <clipPath id={clipBack}>
        <ellipse cx={xb} cy={cy} rx={ri.x} ry={ri.y} />
      </clipPath>
      <clipPath id={clipFront}>
        <ellipse cx={xf} cy={cy} rx={ri.x} ry={ri.y} />
      </clipPath>
      {/* Halsen og skaftet */}
      <path d={`${neck} ${neckGap}`} fillRule="evenodd" fill={`url(#${gFrame})`} stroke={line} strokeWidth={1 * ss} strokeLinejoin="round" />
      {/* Rammen sett fra siden */}
      <path d={silhouette} fill={`url(#${gFrame})`} stroke={line} strokeWidth={1.1 * ss} strokeLinejoin="round" />
      {/* Åpningen der strengene synes (der både den bakre og den fremre kanten slipper gjennom) */}
      <g clipPath={`url(#${clipBack})`}>
        <g clipPath={`url(#${clipFront})`}>
          <rect x={x - b - d} y={cy - A} width={2 * (b + d)} height={2 * A} fill={alpha(SCENE.cloud, 0.14)} />
          <g stroke={mix(PAINTS.hvit, PAINTS.gul, 0.3)} strokeWidth={Math.max(0.9, 0.0022 * K) * ss} opacity={0.95}>
            <path d={mains.join(' ')} />
            <path d={crosses.join(' ')} />
          </g>
          {/* Skygge fra rammen langs kanten av åpningen */}
          <ellipse cx={xf} cy={cy} rx={ri.x} ry={ri.y} fill="none" stroke={SCENE.shadow} strokeWidth={2.4 * ss} opacity={0.35} />
        </g>
      </g>
      <ellipse cx={xb} cy={cy} rx={ri.x} ry={ri.y} fill="none" stroke={line} strokeWidth={0.8 * ss} opacity={0.55} />
      <ellipse cx={xf} cy={cy} rx={ri.x} ry={ri.y} fill="none" stroke={line} strokeWidth={0.8 * ss} opacity={0.55} />
      {/* Fargestripe langs den fremre kanten, lys kant langs den bakre, og kantbeskytteren øverst */}
      <path
        d={`M${r2(xf + b * 0.35)},${r2(cy - A * 0.94)} A${r2(b * 0.92)},${r2(A * 0.97)} 0 0 1 ${r2(xf + b * 0.35)},${r2(cy + A * 0.94)}`}
        fill="none"
        stroke={stripe}
        strokeWidth={0.004 * K}
        strokeDasharray={`${r2(A * 0.9)} ${r2(A * 0.4)}`}
        strokeLinecap="round"
        opacity={0.95}
      />
      <path
        d={`M${r2(xb - b * 0.55)},${r2(cy - A * 0.8)} A${r2(b * 0.97)},${r2(A * 0.99)} 0 0 0 ${r2(xb - b * 0.55)},${r2(cy + A * 0.8)}`}
        fill="none"
        stroke={SCENE.highlight}
        strokeWidth={0.003 * K}
        strokeLinecap="round"
        opacity={0.5}
      />
      <path
        d={`M${r2(xb - b * 0.45)},${r2(cy - A * 0.985)} Q${r2(x)},${r2(cy - A * 1.035)} ${r2(xf + b * 0.45)},${r2(cy - A * 0.985)}`}
        fill="none"
        stroke={shade(ramme, 0.2)}
        strokeWidth={beamY * 0.75}
        strokeLinecap="round"
      />
    </g>
  );
});

/* ================================================================================================
 * Golfkølle (driver) og tee
 * ============================================================================================== */

/** Kølle-hodet sett fra tåa (m): x mot høyre (slagretningen), y nedover, origo midt på slagflaten. */
const DRIVER: [number, number][] = [
  [0.0035, 0.028],
  [-0.02, 0.035],
  [-0.06, 0.035],
  [-0.098, 0.03],
  [-0.116, 0.014],
  [-0.118, -0.006],
  [-0.104, -0.022],
  [-0.075, -0.036],
  [-0.04, -0.043],
  [-0.014, -0.04],
  [-0.004, -0.031],
];
/** Der skaftet går inn i hosselen (m). */
const HOSEL: Pt = { x: -0.022, y: -0.04 };
const HOSEL_TOP: Pt = { x: -0.019, y: -0.088 };

export interface DriverProps {
  /** Midten av slagflaten (der ballen treffer). */
  x: number;
  y: number;
  K: number;
  /** Hvor mye skaftet heller fram (grader). */
  skaftvinkel?: number;
  /** Fargen på toppen av hodet. */
  lakk?: string;
}

/**
 * Golfkølle (driver) sett fra tåa: hodet med blank topp, metallsåle og slagflate mot høyre, hossel og skaft som går
 * opp (ut av bildet i et nærbilde). (x, y) er midten av slagflaten.
 */
export const Driver = memo(function Driver({ x, y, K, skaftvinkel = 4, lakk = PAINTS.svart }: DriverProps) {
  const ss = useStrokeScale();
  const gHead = useSvgId('bs-driver');
  const gSole = useSvgId('bs-saale');
  const gShaft = useSvgId('bs-skaft');
  const T = (px: number, py: number): Pt => ({ x: x + px * K, y: y + py * K });
  const line = SCENE.outline;
  const head = smoothPath(
    DRIVER.map(([a, b]) => T(a, b)),
    true,
  );
  const sole = `M${P(T(0.0035, 0.028))} ${smoothPath([T(0.0035, 0.028), T(-0.02, 0.035), T(-0.06, 0.035), T(-0.098, 0.03), T(-0.116, 0.014)], false).replace(/^M[^C]+/, '')} L${P(T(-0.108, 0.006))} ${smoothPath([T(-0.108, 0.006), T(-0.07, 0.019), T(-0.02, 0.02), T(0.002, 0.017)], false).replace(/^M[^C]+/, '')} Z`;
  const face = `M${P(T(-0.004, -0.031))} L${P(T(0.0035, 0.028))}`;
  const lean = skaftvinkel * DEG;
  const dir = { x: Math.sin(lean), y: -Math.cos(lean) };
  const top = T(HOSEL_TOP.x, HOSEL_TOP.y);
  const far = { x: top.x + dir.x * 1.2 * K, y: top.y + dir.y * 1.2 * K };
  const hose = T(HOSEL.x, HOSEL.y);
  const wShaft = 0.0085 * K;
  const nx = -dir.y;
  const ny = dir.x;
  const shaft = `M${r2(top.x - (nx * wShaft) / 2)},${r2(top.y - (ny * wShaft) / 2)} L${r2(far.x - nx * wShaft * 0.7)},${r2(far.y - ny * wShaft * 0.7)} L${r2(far.x + nx * wShaft * 0.7)},${r2(far.y + ny * wShaft * 0.7)} L${r2(top.x + (nx * wShaft) / 2)},${r2(top.y + (ny * wShaft) / 2)} Z`;
  const hoselW = 0.013 * K;
  const hosel = `M${r2(hose.x - hoselW / 2 - 0.004 * K)},${r2(hose.y + 0.006 * K)} L${r2(top.x - wShaft * 0.62)},${r2(top.y)} L${r2(top.x + wShaft * 0.62)},${r2(top.y)} L${r2(hose.x + hoselW / 2 + 0.004 * K)},${r2(hose.y + 0.006 * K)} Z`;
  return (
    <g>
      <LinearGradient id={gHead} x1={0} y1={0} x2={0.3} y2={1} stops={[[0, tint(lakk, 0.42)], [0.35, lakk], [1, shade(lakk, 0.35)]]} />
      <LinearGradient id={gSole} stops={materialStops(SCENE.metal, 1.4)} />
      <LinearGradient id={gShaft} x1={0} y1={0} x2={1} y2={0} stops={[[0, tint(SCENE.metalDark, 0.3)], [0.4, SCENE.metal], [1, shade(SCENE.metalDark, 0.3)]]} />
      {/* Skaftet og hosselen */}
      <path d={shaft} fill={`url(#${gShaft})`} stroke={line} strokeWidth={0.9 * ss} strokeLinejoin="round" />
      <path d={hosel} fill={shade(lakk, 0.1)} stroke={line} strokeWidth={0.9 * ss} strokeLinejoin="round" />
      <rect
        x={top.x - wShaft * 0.68}
        y={top.y - 0.007 * K}
        width={wShaft * 1.36}
        height={0.007 * K}
        rx={1.2}
        fill={PAINTS.svart}
        stroke={line}
        strokeWidth={0.7 * ss}
      />
      {/* Hodet: blank topp, metallsåle, slagflate */}
      <path d={head} fill={`url(#${gHead})`} stroke={line} strokeWidth={1 * ss} strokeLinejoin="round" />
      <path d={sole} fill={`url(#${gSole})`} opacity={0.95} />
      <path
        d={smoothPath([T(-0.1, -0.012), T(-0.07, -0.03), T(-0.035, -0.036)], false)}
        stroke={SCENE.highlight}
        strokeWidth={0.004 * K}
        fill="none"
        strokeLinecap="round"
        opacity={0.55}
      />
      <path d={face} stroke={tint(SCENE.metal, 0.25)} strokeWidth={0.0045 * K} strokeLinecap="round" />
      <path d={face} stroke={line} strokeWidth={0.8 * ss} strokeLinecap="round" opacity={0.6} />
    </g>
  );
});

export interface TeeProps {
  /** Der teen står i bakken. */
  x: number;
  y: number;
  K: number;
  /** Høyden over bakken (m). */
  hoyde?: number;
}

/** Tee i tre: en liten skål ballen ligger i, på en spiss pinne som står i gresset. (x, y) er der den står i bakken. */
export const Tee = memo(function Tee({ x, y, K, hoyde = 0.025 }: TeeProps) {
  const ss = useStrokeScale();
  const g = useSvgId('bs-tee');
  const h = hoyde * K;
  const cup = 0.0065 * K;
  const pin = 0.0028 * K;
  const d = `M${r2(x - cup)},${r2(y - h)} Q${r2(x - cup * 0.5)},${r2(y - h + 0.004 * K)} ${r2(x - pin)},${r2(y - h + 0.008 * K)} L${r2(x - pin * 0.8)},${r2(y + 1)} L${r2(x + pin * 0.8)},${r2(y + 1)} L${r2(x + pin)},${r2(y - h + 0.008 * K)} Q${r2(x + cup * 0.5)},${r2(y - h + 0.004 * K)} ${r2(x + cup)},${r2(y - h)} Z`;
  return (
    <g>
      <LinearGradient id={g} x1={0} y1={0} x2={1} y2={0} stops={[[0, tint(SCENE.woodLight, 0.25)], [0.5, SCENE.woodLight], [1, shade(SCENE.wood, 0.1)]]} />
      <path d={d} fill={`url(#${g})`} stroke={SCENE.outline} strokeWidth={0.8 * ss} strokeLinejoin="round" />
    </g>
  );
});

/* ================================================================================================
 * Bakgrunn: golfflagg langt unna og straffemerket
 * ============================================================================================== */

/** Golfflagg på en green langt unna. (x, y) er foten av flaggstanga; `h` er høyden. */
export const Golfflagg = memo(function Golfflagg({ x, y, h }: { x: number; y: number; h: number }) {
  const ss = useStrokeScale();
  return (
    <g aria-hidden>
      <ellipse cx={x} cy={y} rx={h * 0.9} ry={h * 0.06} fill={tint(SCENE.grass, 0.18)} />
      <line x1={x} y1={y} x2={x} y2={y - h} stroke={tint(PAINTS.hvit, 0.1)} strokeWidth={Math.max(1, h * 0.03) * ss} />
      <path d={`M${r2(x)},${r2(y - h)} L${r2(x + h * 0.42)},${r2(y - h * 0.86)} L${r2(x)},${r2(y - h * 0.72)} Z`} fill={PAINTS.rod} />
    </g>
  );
});

/** Straffemerket: en hvit kalket flekk i gresset (sett skrått ovenfra). (x, y) er midten. */
export function Straffemerke({ x, y, w }: { x: number; y: number; w: number }) {
  return (
    <g aria-hidden>
      <ellipse cx={x} cy={y} rx={w / 2} ry={w * 0.09} fill={alpha(PAINTS.hvit, 0.85)} />
      <ellipse cx={x + w * 0.05} cy={y + w * 0.01} rx={w * 0.38} ry={w * 0.05} fill={alpha(PAINTS.hvit, 0.5)} />
    </g>
  );
}
