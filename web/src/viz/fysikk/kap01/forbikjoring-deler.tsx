/**
 * Egne gjenstander til «Forbikjøring på landeveien» (k1-forbikjoring), i samme stil som scene-kit-et: toninger fra
 * core.tsx, SCENE- og PAINTS-farger, kontur og myk skygge. Bare dette kapittelet trenger dem.
 *
 *   <Lastebil x={xBak} y={veiY} m={12} type="vogntog" hjulvinkel={vinkel} flip />   lastebil eller vogntog fra siden
 *   <BilOvenfra x={x} y={y} len={10} wid={5} lakk="blaa" flip />                   personbil sett ovenfra (ikon)
 *   <LastebilOvenfra x={x} y={y} len={20} wid={6} type="lastebil" flip />           lastebil sett ovenfra (ikon)
 *
 * Lastebilen har ekte mål (`LASTEBIL_MAAL`, `m` = piksler per meter, samme skala som Bil). Ikonene ovenfra er til
 * oversiktskartet, der (x, y) er midten og lengden er i figurens enheter.
 */
import {
  ContactShadow,
  LinearGradient,
  PAINTS,
  RadialGradient,
  SCENE,
  materialStops,
  paint,
  shade,
  tint,
  useStrokeScale,
  useSvgId,
  type PaintName,
} from '../../kit/scene';

/** Farger fra kjoretoy.css i scene-kit-et (samme glass, lykter og svart plast som på bilen). */
const KC = {
  window: 'var(--sc-kjoretoy-window)',
  windowSky: 'var(--sc-kjoretoy-window-sky)',
  tail: 'var(--sc-kjoretoy-tail)',
  headlight: 'var(--sc-kjoretoy-headlight)',
  trim: 'var(--sc-kjoretoy-trim)',
} as const;

const r3 = (v: number) => Math.round(v * 1000) / 1000;
const fin = (v: number, fallback: number) => (Number.isFinite(v) ? v : fallback);

/** Mål i meter. Lastebilen har skap (kassebil); vogntoget er en kortere lastebil med tilhenger. */
export const LASTEBIL_MAAL = {
  /** Totalhøyde (toppen av skapet). */
  hoyde: 3.95,
  /** Hjulradius. */
  hjulradius: 0.52,
  /** Lengden på førerhuset. */
  forerhus: 2.5,
  lengde: { lastebil: 12, vogntog: 19.5 },
} as const;

/** Lengden på tilhengeren og avstanden fra tilhengeren til lastebilen i et vogntog (m). */
const TRAILER_LEN = 8.6;
const TRAILER_GAP = 0.9;
const R = LASTEBIL_MAAL.hjulradius;
const BOX_TOP = -LASTEBIL_MAAL.hoyde;
const BOX_BOTTOM = -1.12;

type Sw = (px: number) => number;

/** Hjul med dekk, stålfelg og hull som roterer (vinkel i grader, med klokka = framover). */
function Hjul({ x, spin, ids, sw }: { x: number; spin: number; ids: string; sw: Sw }) {
  const holes = Array.from({ length: 6 }, (_, i) => {
    const a = (i * Math.PI) / 3;
    return `M${r3(0.2 * Math.cos(a) + 0.045)},${r3(0.2 * Math.sin(a))}a0.045,0.045 0 1,0 -0.09,0a0.045,0.045 0 1,0 0.09,0Z`;
  }).join('');
  return (
    <g transform={`translate(${r3(x)} ${-R})`}>
      <circle r={R} fill={`url(#${ids}-dekk)`} stroke={SCENE.outline} strokeWidth={sw(1)} />
      <path d={`M${r3(-0.36)},${r3(-0.33)}A0.49,0.49 0 0 1 ${r3(0.12)},${r3(-0.47)}`} fill="none" stroke={SCENE.highlight} strokeWidth={sw(1.1)} strokeLinecap="round" opacity={0.55} />
      <circle r={0.31} fill={`url(#${ids}-felg)`} stroke={shade(SCENE.metalDark, 0.3)} strokeWidth={sw(0.7)} />
      <circle r={0.25} fill="none" stroke={shade(SCENE.metalDark, 0.2)} strokeWidth={sw(0.6)} opacity={0.7} />
      <g transform={spin ? `rotate(${r3(spin % 360)})` : undefined}>
        <path d={holes} fill={shade(SCENE.metalDark, 0.45)} />
        <circle r={0.1} fill={SCENE.metalLight} stroke={SCENE.metalDark} strokeWidth={sw(0.6)} />
      </g>
    </g>
  );
}

/** Skapet (kassen) med topp- og bunnlist, skjøter, stripe i førerhusfargen og baklykt. Fra x0 til x1. */
function Skap({ x0, x1, ids, stripe, sw }: { x0: number; x1: number; ids: string; stripe: string; sw: Sw }) {
  const len = x1 - x0;
  const n = Math.max(2, Math.round(len / 1.2));
  let seams = '';
  for (let i = 1; i < n; i++) {
    const x = r3(x0 + (i * len) / n);
    seams += `M${x},${BOX_TOP + 0.14}V${BOX_BOTTOM - 0.16}`;
  }
  return (
    <g>
      <rect x={x0} y={BOX_TOP} width={len} height={BOX_BOTTOM - BOX_TOP} rx={0.06} fill={`url(#${ids}-skap)`} stroke={SCENE.outline} strokeWidth={sw(1)} />
      <path d={seams} stroke={shade(PAINTS.hvit, 0.16)} strokeWidth={sw(0.7)} />
      <rect x={x0} y={BOX_TOP} width={len} height={0.13} rx={0.04} fill={shade(PAINTS.hvit, 0.14)} />
      <rect x={x0} y={BOX_BOTTOM - 0.15} width={len} height={0.15} fill={shade(PAINTS.hvit, 0.28)} />
      <rect x={x0 + 0.06} y={BOX_BOTTOM - 0.42} width={len - 0.12} height={0.1} fill={stripe} opacity={0.9} />
      <path d={`M${r3(x0 + 0.08)},${BOX_TOP + 0.2}H${r3(x1 - 0.08)}`} stroke={SCENE.highlight} strokeWidth={sw(1.1)} strokeLinecap="round" opacity={0.8} />
      <rect x={x0} y={BOX_TOP} width={0.09} height={BOX_BOTTOM - BOX_TOP} fill={shade(PAINTS.hvit, 0.2)} />
    </g>
  );
}

/** Understellet: ramme, skjermer, sprutlapp, sidebeskyttelse og (valgfritt) dieseltank. Aksler i `axles`. */
function Understell({
  x0,
  x1,
  axles,
  tank,
  guard,
  ids,
  sw,
}: {
  x0: number;
  x1: number;
  axles: number[];
  tank?: [number, number];
  guard?: [number, number];
  ids: string;
  sw: Sw;
}) {
  const rear = axles.filter((a) => a < (x0 + x1) / 2 + 2);
  const a0 = Math.min(...rear);
  const a1 = Math.max(...rear);
  return (
    <g>
      <rect x={x0} y={BOX_BOTTOM} width={x1 - x0} height={0.3} fill={KC.trim} stroke={SCENE.outline} strokeWidth={sw(0.7)} />
      {/* Skjerm over boggien og sprutlapp bak */}
      <rect x={a0 - 0.7} y={BOX_BOTTOM - 0.02} width={a1 - a0 + 1.4} height={0.13} rx={0.06} fill={shade(KC.trim, 0.1)} stroke={SCENE.outline} strokeWidth={sw(0.6)} />
      <rect x={a0 - 0.8} y={BOX_BOTTOM + 0.08} width={0.08} height={0.82} fill={KC.trim} stroke={SCENE.outline} strokeWidth={sw(0.5)} />
      {guard && guard[1] - guard[0] > 0.4 && (
        <g fill={`url(#${ids}-metall)`} stroke={SCENE.outline} strokeWidth={sw(0.5)}>
          <rect x={guard[0]} y={-1.0} width={guard[1] - guard[0]} height={0.09} rx={0.03} />
          <rect x={guard[0]} y={-0.72} width={guard[1] - guard[0]} height={0.09} rx={0.03} />
          <rect x={guard[0]} y={-1.0} width={0.06} height={0.37} />
          <rect x={guard[1] - 0.06} y={-1.0} width={0.06} height={0.37} />
        </g>
      )}
      {tank && (
        <g>
          <rect x={tank[0]} y={-1.08} width={tank[1] - tank[0]} height={0.54} rx={0.14} fill={`url(#${ids}-metall)`} stroke={SCENE.outline} strokeWidth={sw(0.7)} />
          <path d={`M${r3(tank[0] + 0.12)},-0.98H${r3(tank[1] - 0.12)}`} stroke={SCENE.highlight} strokeWidth={sw(1)} strokeLinecap="round" />
          <rect x={tank[0] + 0.3} y={-1.1} width={0.06} height={0.56} fill={shade(SCENE.metalDark, 0.2)} opacity={0.6} />
          <rect x={tank[1] - 0.36} y={-1.1} width={0.06} height={0.56} fill={shade(SCENE.metalDark, 0.2)} opacity={0.6} />
        </g>
      )}
    </g>
  );
}

/** Førerhus (frontstyrt, med soveplass og takspoiler) fra c0 til cf, med forhjulet i fa. */
function Forerhus({ c0, cf, fa, color, ids, sw }: { c0: number; cf: number; fa: number; color: string; ids: string; sw: Sw }) {
  const body =
    `M${r3(c0)},-0.95L${r3(c0)},-3.12Q${r3(c0)},-3.3 ${r3(c0 + 0.18)},-3.3L${r3(cf - 0.3)},-3.3Q${r3(cf - 0.06)},-3.3 ${r3(cf - 0.05)},-3.06` +
    `L${r3(cf)},-1.3L${r3(cf)},-0.95L${r3(fa + 0.5)},-0.95A0.66,0.66 0 0 0 ${r3(fa - 0.5)},-0.95Z`;
  const spoiler = `M${r3(c0 + 0.08)},-3.28L${r3(c0 + 0.16)},-3.9L${r3(c0 + 0.95)},-3.94C${r3(cf - 1.2)},-3.86 ${r3(cf - 0.72)},-3.56 ${r3(cf - 0.42)},-3.28Z`;
  const win = `M${r3(cf - 1.36)},-2.22L${r3(cf - 1.36)},-2.88Q${r3(cf - 1.36)},-2.98 ${r3(cf - 1.26)},-2.98L${r3(cf - 0.22)},-2.98L${r3(cf - 0.17)},-2.22Z`;
  return (
    <g>
      <path d={spoiler} fill={`url(#${ids}-hus)`} stroke={SCENE.outline} strokeWidth={sw(0.9)} strokeLinejoin="round" />
      <path d={body} fill={`url(#${ids}-hus)`} stroke={SCENE.outline} strokeWidth={sw(1)} strokeLinejoin="round" />
      {/* Svart skjørt under døra og støtfanger */}
      <path d={`M${r3(c0)},-1.18L${r3(cf)},-1.18L${r3(cf)},-0.95L${r3(fa + 0.5)},-0.95A0.66,0.66 0 0 0 ${r3(fa - 0.5)},-0.95L${r3(c0)},-0.95Z`} fill={KC.trim} opacity={0.85} />
      <rect x={cf - 0.62} y={-1.08} width={0.66} height={0.42} rx={0.06} fill={KC.trim} stroke={SCENE.outline} strokeWidth={sw(0.7)} />
      <rect x={cf - 0.1} y={-1.36} width={0.12} height={0.17} rx={0.03} fill={KC.headlight} stroke={SCENE.outline} strokeWidth={sw(0.5)} />
      {/* Frontruta som en smal stripe, sidevindu, soveplassvindu og dør */}
      <path d={`M${r3(cf - 0.12)},-3.02L${r3(cf - 0.04)},-3.02L${r3(cf - 0.005)},-2.18L${r3(cf - 0.09)},-2.18Z`} fill={KC.window} />
      <path d={win} fill={`url(#${ids}-glass)`} stroke={shade(color, 0.45)} strokeWidth={sw(1)} strokeLinejoin="round" />
      <path d={`M${r3(cf - 0.95)},-2.24L${r3(cf - 0.62)},-2.96L${r3(cf - 0.48)},-2.96L${r3(cf - 0.81)},-2.24Z`} fill={SCENE.highlight} opacity={0.55} />
      <rect x={c0 + 0.22} y={-2.86} width={0.5} height={0.2} rx={0.05} fill={KC.window} stroke={shade(color, 0.4)} strokeWidth={sw(0.6)} />
      <path
        d={`M${r3(cf - 1.46)},-3.06L${r3(cf - 1.46)},-1.2M${r3(cf - 0.12)},-2.1L${r3(cf - 0.1)},-1.2M${r3(c0 + 0.04)},-2.06H${r3(cf - 0.04)}`}
        fill="none"
        stroke={shade(color, 0.42)}
        strokeWidth={sw(0.8)}
        opacity={0.85}
      />
      <rect x={cf - 0.62} y={-1.92} width={0.22} height={0.06} rx={0.03} fill={shade(color, 0.4)} />
      {/* Høylys langs taket */}
      <path d={`M${r3(c0 + 0.2)},-3.2H${r3(cf - 0.32)}`} stroke={SCENE.highlight} strokeWidth={sw(1.2)} strokeLinecap="round" opacity={0.8} />
      {/* Trinn og speil */}
      <rect x={cf - 0.92} y={-0.88} width={0.32} height={0.06} fill={SCENE.metal} />
      <rect x={cf - 0.92} y={-0.62} width={0.32} height={0.06} fill={SCENE.metal} />
      <path d={`M${r3(cf - 0.04)},-2.72L${r3(cf + 0.24)},-2.84`} stroke={KC.trim} strokeWidth={sw(1.6)} strokeLinecap="round" />
      <rect x={cf + 0.18} y={-3.06} width={0.12} height={0.7} rx={0.04} fill={KC.trim} stroke={SCENE.outline} strokeWidth={sw(0.5)} />
    </g>
  );
}

/**
 * Lastebil med skap, eller vogntog (lastebil med tilhenger), sett fra siden. Kjører mot høyre; `flip` speilvender
 * (kjører mot venstre). Ankerpunktet (x, y) er bakenden på bakken: kjøretøyet er LASTEBIL_MAAL.lengde[type] meter
 * langt framover fra x. `m` er piksler per meter (samme skala som Bil: size = BIL_MAAL.lengde · m).
 */
export function Lastebil({
  x,
  y,
  m,
  type = 'lastebil',
  lakk = 'oransje',
  hjulvinkel = 0,
  flip = false,
  title,
}: {
  x: number;
  y: number;
  m: number;
  type?: 'lastebil' | 'vogntog';
  lakk?: PaintName | (string & {});
  hjulvinkel?: number;
  flip?: boolean;
  title?: string;
}) {
  const ss = useStrokeScale();
  const ids = useSvgId('lastebil');
  const k = Math.max(0.5, fin(m, 12));
  const sw: Sw = (px) => (px * ss) / k;
  const color = paint(lakk);
  const L = LASTEBIL_MAAL.lengde[type];
  const spin = fin(hjulvinkel, 0);
  // Lastebilen (motorvognen) står foran; i et vogntog er tilhengeren bak.
  const u0 = type === 'vogntog' ? TRAILER_LEN + TRAILER_GAP : 0;
  const boxLen = L - u0 - LASTEBIL_MAAL.forerhus - 0.15;
  const c0 = u0 + boxLen + 0.15;
  const cf = L;
  const fa = cf - 1.45;
  const a1 = u0 + Math.max(1.6, boxLen * 0.27);
  const a2 = a1 + 1.35;
  const tank: [number, number] = [fa - 0.75 - Math.min(1.35, fa - 0.75 - (a2 + 1.2)), fa - 0.75];
  const guard: [number, number] = [a2 + 0.68, tank[0] - 0.15];
  const trailerAxles = [1.5, 2.85, TRAILER_LEN - 1.3];
  const axles = [a1, a2, fa, ...(type === 'vogntog' ? trailerAxles : [])];
  return (
    <g transform={`translate(${r3(x)} ${r3(y)}) scale(${r3(flip ? -k : k)} ${r3(k)})`} role={title ? 'img' : undefined} aria-hidden={title ? undefined : true}>
      {title && <title>{title}</title>}
      <ContactShadow cx={L / 2} cy={0} rx={L / 2 + 0.4} ry={0.22} />
      <LinearGradient id={`${ids}-skap`} stops={materialStops(PAINTS.hvit, 0.7)} />
      <LinearGradient id={`${ids}-hus`} stops={materialStops(color, 1.15)} />
      <LinearGradient id={`${ids}-glass`} stops={[[0, KC.windowSky], [0.5, KC.window], [1, shade(KC.window, 0.18)]]} />
      <LinearGradient id={`${ids}-metall`} stops={[[0, SCENE.metalLight], [0.55, SCENE.metal], [1, SCENE.metalDark]]} />
      <LinearGradient id={`${ids}-felg`} x2={1} y2={1} stops={[[0, SCENE.metalLight], [0.55, SCENE.metal], [1, SCENE.metalDark]]} />
      <RadialGradient id={`${ids}-dekk`} stops={[[0.6, SCENE.rubberLight], [0.8, SCENE.rubber], [1, shade(SCENE.rubber, 0.25)]]} />

      {type === 'vogntog' && (
        <g>
          {/* Draget fra tilhengeren til koplingen bak på lastebilen */}
          <path d={`M${TRAILER_LEN - 0.7},-0.74L${u0 + 0.15},-0.66`} stroke={KC.trim} strokeWidth={sw(4)} strokeLinecap="round" />
          <Understell x0={0.15} x1={TRAILER_LEN - 0.15} axles={trailerAxles} guard={[3.55, TRAILER_LEN - 2.05]} ids={ids} sw={sw} />
          <Skap x0={0} x1={TRAILER_LEN} ids={ids} stripe={color} sw={sw} />
          <rect x={0} y={-1.06} width={0.1} height={0.18} fill={KC.tail} stroke={SCENE.outline} strokeWidth={sw(0.5)} />
          <rect x={0.05} y={-0.62} width={0.32} height={0.14} fill={SCENE.metalDark} />
        </g>
      )}
      <Understell x0={u0 + 0.2} x1={cf - 0.3} axles={[a1, a2, fa]} tank={tank} guard={guard} ids={ids} sw={sw} />
      <Skap x0={u0} x1={u0 + boxLen} ids={ids} stripe={color} sw={sw} />
      <rect x={u0} y={-1.06} width={0.1} height={0.18} fill={KC.tail} stroke={SCENE.outline} strokeWidth={sw(0.5)} />
      {type === 'lastebil' && <rect x={0.05} y={-0.62} width={0.32} height={0.14} fill={SCENE.metalDark} />}
      <Forerhus c0={c0} cf={cf} fa={fa} color={color} ids={ids} sw={sw} />
      {axles.map((ax) => (
        <Hjul key={ax} x={ax} spin={spin} ids={ids} sw={sw} />
      ))}
    </g>
  );
}

/** Hjulvinkelen (grader) til lastebilen etter strekningen s (m). */
export function lastebilHjulvinkel(s: number): number {
  return Number.isFinite(s) ? (s / R) * (180 / Math.PI) : 0;
}

/* ------------------------------------------------------------------ Ikoner ovenfra (oversiktskartet) */

/**
 * Personbil sett ovenfra, sentrert i (x, y), med fronten mot høyre (`flip`: mot venstre). `len` og `wid` er lengden
 * og bredden i figurens enheter. Lakk, frontrute, tak og bakrute.
 */
export function BilOvenfra({ x, y, len, wid, lakk = 'blaa', flip = false }: { x: number; y: number; len: number; wid: number; lakk?: PaintName | (string & {}); flip?: boolean }) {
  const ss = useStrokeScale();
  const id = useSvgId('bil-ovenfra');
  const color = paint(lakk);
  if (!Number.isFinite(x) || !Number.isFinite(y) || !(len > 0) || !(wid > 0)) return null;
  const h = len / 2;
  const w = wid / 2;
  return (
    <g transform={`translate(${r3(x)} ${r3(y)})${flip ? ' scale(-1 1)' : ''}`} aria-hidden>
      <LinearGradient id={id} stops={materialStops(color, 1)} />
      <rect x={-h} y={-w} width={len} height={wid} rx={Math.min(w, len * 0.16)} fill={`url(#${id})`} stroke={SCENE.outline} strokeWidth={0.8 * ss} />
      <path d={`M${r3(h * 0.22)},${r3(-w * 0.78)}L${r3(h * 0.5)},${r3(-w * 0.86)}L${r3(h * 0.5)},${r3(w * 0.86)}L${r3(h * 0.22)},${r3(w * 0.78)}Z`} fill={KC.window} />
      <rect x={-h * 0.6} y={-w * 0.76} width={h * 0.82} height={wid * 0.76} rx={w * 0.2} fill={tint(color, 0.18)} />
      <path d={`M${r3(-h * 0.62)},${r3(-w * 0.72)}L${r3(-h * 0.8)},${r3(-w * 0.66)}L${r3(-h * 0.8)},${r3(w * 0.66)}L${r3(-h * 0.62)},${r3(w * 0.72)}Z`} fill={KC.window} />
    </g>
  );
}

/**
 * Lastebil eller vogntog sett ovenfra, sentrert i (x, y), med fronten mot høyre (`flip`: mot venstre). Hvitt skap
 * (og tilhenger) og førerhus i lakkfargen, i riktige proporsjoner langs lengden `len`.
 */
export function LastebilOvenfra({
  x,
  y,
  len,
  wid,
  type = 'lastebil',
  lakk = 'oransje',
  flip = false,
}: {
  x: number;
  y: number;
  len: number;
  wid: number;
  type?: 'lastebil' | 'vogntog';
  lakk?: PaintName | (string & {});
  flip?: boolean;
}) {
  const ss = useStrokeScale();
  const id = useSvgId('lastebil-ovenfra');
  const color = paint(lakk);
  if (!Number.isFinite(x) || !Number.isFinite(y) || !(len > 0) || !(wid > 0)) return null;
  const L = LASTEBIL_MAAL.lengde[type];
  const k = len / L;
  const h = len / 2;
  const w = wid / 2;
  const u0 = type === 'vogntog' ? TRAILER_LEN + TRAILER_GAP : 0;
  const cab = LASTEBIL_MAAL.forerhus * k;
  const X = (u: number) => -h + u * k;
  return (
    <g transform={`translate(${r3(x)} ${r3(y)})${flip ? ' scale(-1 1)' : ''}`} aria-hidden>
      <LinearGradient id={`${id}-s`} stops={materialStops(PAINTS.hvit, 0.8)} />
      <LinearGradient id={`${id}-h`} stops={materialStops(color, 1)} />
      {type === 'vogntog' && (
        <>
          <line x1={X(TRAILER_LEN)} x2={X(u0)} y1={0} y2={0} stroke={KC.trim} strokeWidth={Math.max(1, wid * 0.2)} />
          <rect x={X(0)} y={-w} width={TRAILER_LEN * k} height={wid} rx={wid * 0.08} fill={`url(#${id}-s)`} stroke={SCENE.outline} strokeWidth={0.8 * ss} />
        </>
      )}
      <rect x={X(u0)} y={-w} width={h - cab - X(u0) - 0.12 * k} height={wid} rx={wid * 0.08} fill={`url(#${id}-s)`} stroke={SCENE.outline} strokeWidth={0.8 * ss} />
      <rect x={h - cab} y={-w * 0.94} width={cab} height={wid * 0.94} rx={Math.min(wid * 0.22, cab * 0.25)} fill={`url(#${id}-h)`} stroke={SCENE.outline} strokeWidth={0.8 * ss} />
      <rect x={h - cab * 0.35} y={-w * 0.8} width={cab * 0.22} height={wid * 0.8} fill={KC.window} opacity={0.85} />
    </g>
  );
}
