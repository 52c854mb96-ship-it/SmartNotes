/**
 * Scene-kit, familien «rom»: verdensrommet, atomkjerner og lys.
 *
 *   <Stjernehimmel x={0} y={0} w={800} h={420} />
 *   <Sol x={120} y={210} r={70} />
 *   <Planet x={520} y={210} r={60} type="jorda" />
 *   <Atomkjerne x={400} y={200} Z={6} N={6} r={9} />
 *   <Foton x1={100} y1={80} x2={300} y2={80} bolgelengde={656} label="hf" />
 *   <Spektrum x={60} y={300} w={680} h={46} type="emisjon" linjer={[410, 434, 486, 656]} skala />
 *
 * Verdensrommet er mørkt i begge temaer (SCENE.space). Gjenstandsfargene ligger i rom.css (--sc-rom-*); fargene på
 * lys (bølgelengde og stjernetemperatur) er fysiske og regnes ut her som rgb-tekst, like i begge temaer.
 * Proton, nøytron og elektron har samme farger som i fysikk kapittel 7–8.
 *
 * Planetene har grove, men ekte kart (rom-kart.ts) som projiseres på kula, så `dreining` gir døgnrotasjon og
 * `fase` månefaser. Alle tilfeldige teksturer (stjerner, tåker, granulering, kjerner) kommer fra sceneRandom med frø.
 * Gjenstandene vokser ikke på mobil (kapittelet styrer størrelsen), men strekene og de minste stjernene gjør det.
 */
import './rom.css';
import { useMemo, type ReactNode } from 'react';
import { VIZ } from '../colors';
import { useTextScale } from '../controls';
import { Txt } from '../txt';
import { LinearGradient, RadialGradient, SCENE_DIM, mix, sceneRandom, shade, tint, useSceneScale, useStrokeScale, useSvgId, type GradientStop } from './core';
import { SCENE } from './palette';
import {
  EARTH_CLOUDS_CORE,
  EARTH_CLOUDS_SOFT,
  EARTH_DESERT,
  EARTH_ICE,
  EARTH_LAND,
  EARTH_WATER,
  JUPITER_BELTS,
  MARS_CANYON,
  MARS_CAPS,
  MARS_DARK_CORE,
  MARS_DARK_SOFT,
  MARS_LIGHT,
  MOON_CRATERS,
  MOON_FRIGORIS,
  MOON_MARIA,
  MOON_MARIA_SOFT,
  MOON_RAYS,
  NEPTUNE_BANDS,
  bandRing,
  latStripe,
  projectFill,
  projectLines,
  projectPoint,
  sphereEllipse,
  type Ring,
} from './rom-kart';
import { packNucleus } from './rom-kjerne';

/** Fargene i rom.css. */
const ROM = {
  proton: 'var(--sc-rom-proton)',
  noytron: 'var(--sc-rom-noytron)',
  elektron: 'var(--sc-rom-elektron)',
  tegn: 'var(--sc-rom-tegn)',
  melkevei: 'var(--sc-rom-melkevei)',
  melkeveiKjerne: 'var(--sc-rom-melkevei-kjerne)',
  stov: 'var(--sc-rom-stov)',
  natt: 'var(--sc-rom-natt)',
  solKjerne: 'var(--sc-rom-sol-kjerne)',
  sol: 'var(--sc-rom-sol)',
  solKant: 'var(--sc-rom-sol-kant)',
  solKorona: 'var(--sc-rom-sol-korona)',
  solFlekk: 'var(--sc-rom-sol-flekk)',
  hav: 'var(--sc-rom-hav)',
  havDyp: 'var(--sc-rom-hav-dyp)',
  land: 'var(--sc-rom-land)',
  landMork: 'var(--sc-rom-land-mork)',
  orken: 'var(--sc-rom-orken)',
  is: 'var(--sc-rom-is)',
  sky: 'var(--sc-rom-sky)',
  atmosfaere: 'var(--sc-rom-atmosfaere)',
  mars: 'var(--sc-rom-mars)',
  marsMork: 'var(--sc-rom-mars-mork)',
  marsLys: 'var(--sc-rom-mars-lys)',
  jupiterSone: 'var(--sc-rom-jupiter-sone)',
  jupiterBelte: 'var(--sc-rom-jupiter-belte)',
  jupiterMork: 'var(--sc-rom-jupiter-mork)',
  jupiterFlekk: 'var(--sc-rom-jupiter-flekk)',
  maane: 'var(--sc-rom-maane)',
  maaneMare: 'var(--sc-rom-maane-mare)',
  maaneLys: 'var(--sc-rom-maane-lys)',
  neptun: 'var(--sc-rom-neptun)',
  neptunLys: 'var(--sc-rom-neptun-lys)',
  neptunMork: 'var(--sc-rom-neptun-mork)',
  taakeIndre: 'var(--sc-rom-taake-indre)',
  taakeKjerne: 'var(--sc-rom-taake-kjerne)',
  hvittLys: 'var(--sc-rom-hvitt-lys)',
  hvittGlod: 'var(--sc-rom-hvitt-glod)',
  spektrumBunn: 'var(--sc-rom-spektrum-bunn)',
} as const;

const TAAKE_FARGER = {
  rod: ['var(--sc-rom-taake-rod)', 'var(--sc-rom-taake-rod-2)'],
  blaa: ['var(--sc-rom-taake-blaa)', 'var(--sc-rom-taake-blaa-2)'],
  fiolett: ['var(--sc-rom-taake-fiolett)', 'var(--sc-rom-taake-fiolett-2)'],
} as const;

/* ---------- Hjelpere ---------- */

type Rgb = [number, number, number];

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, Number.isFinite(v) ? v : lo));
const r2 = (v: number) => Math.round(v * 100) / 100;
const rgbText = ([r, g, b]: Rgb) => `rgb(${Math.round(r)} ${Math.round(g)} ${Math.round(b)})`;
const c255 = (v: number) => clamp(v, 0, 255);

/** Sterkere (s > 1) eller svakere (s < 1) farge med samme lyshet. */
function saturate([r, g, b]: Rgb, s: number): Rgb {
  if (s === 1) return [r, g, b];
  const l = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  const out: Rgb = [Math.max(0, l + (r - l) * s), Math.max(0, l + (g - l) * s), Math.max(0, l + (b - l) * s)];
  const m = Math.max(...out);
  return m > 255 ? [(out[0] * 255) / m, (out[1] * 255) / m, (out[2] * 255) / m] : out;
}

/** Svart legeme (tilpasning av Tanner Helland til Mitchell Charitys tabell, CIE 1964 10°). */
function blackbody(temperatur: number): Rgb {
  const t = clamp(temperatur, 1000, 40000) / 100;
  if (t <= 66) {
    const g = 99.4708025861 * Math.log(t) - 161.1195681661;
    const b = t <= 19 ? 0 : 138.5177312231 * Math.log(t - 10) - 305.0447927307;
    return [255, c255(g), c255(b)];
  }
  return [c255(329.698727446 * Math.pow(t - 60, -0.1332047592)), c255(288.1221695283 * Math.pow(t - 60, -0.0755148492)), 255];
}

/**
 * Lys med bølgelengde nm (Dan Bruton, som fysikk kapittel 7). `floor` = minste lysstyrke mot kantene (0,3 = som øyet).
 * Under 400 nm holdes fargetonen fiolett (ultrafiolett blir fiolett, ikke magenta, som ikke er en spektralfarge), og
 * fra 700 nm blir rødt mørkere: infrarødt har høyst 0,55 lysstyrke, så det skiller seg fra synlig rødt også med høy
 * `floor`.
 */
function wavelengthRgb(nm: number, floor: number): Rgb {
  const l = clamp(Number.isFinite(nm) ? nm : 550, 380, 750);
  const h = Math.max(400, l);
  let r = 0;
  let g = 0;
  let b = 0;
  if (h < 440) {
    r = (440 - h) / 60;
    b = 1;
  } else if (h < 490) {
    g = (h - 440) / 50;
    b = 1;
  } else if (h < 510) {
    g = 1;
    b = (510 - h) / 20;
  } else if (h < 580) {
    r = (h - 510) / 70;
    g = 1;
  } else if (h < 645) {
    r = 1;
    g = (645 - h) / 65;
  } else r = 1;
  const eye = l < 420 ? 0.3 + (0.7 * (l - 380)) / 40 : l > 700 ? 0.3 + (0.7 * (750 - l)) / 50 : 1;
  const ir = l > 700 ? 1 - (0.45 * (l - 700)) / 50 : 1;
  const fade = Math.min(ir, Math.max(floor, eye));
  const c = (v: number) => (v <= 0 ? 0 : 255 * (v * fade) ** 0.8);
  return [c(r), c(g), c(b)];
}

/** Relativ lyshet 0–1 (sRGB, omtrentlig) for en farge fra wavelengthRgb eller blackbody. */
function lightness([r, g, b]: Rgb): number {
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
}

/**
 * Glimt rundt en stjerne: to smale, kryssende ellipser (vannrett og loddrett) med en toning som blir svakere ut mot
 * spissene. `L` = armlengden, `w` = halve bredden midt på. Toningen (`fill`) må være en RadialGradient (objektets
 * koordinater), så den følger hver ellipse.
 */
function glint(key: string, x: number, y: number, L: number, w: number, fill: string, opacity: number): ReactNode[] {
  return [
    <ellipse key={`${key}h`} cx={r2(x)} cy={r2(y)} rx={r2(L)} ry={r2(w)} fill={fill} opacity={opacity} aria-hidden />,
    <ellipse key={`${key}v`} cx={r2(x)} cy={r2(y)} rx={r2(w)} ry={r2(L)} fill={fill} opacity={opacity} aria-hidden />,
  ];
}

/** Toning for glimtet: sterkt i midten og ut langs armene, svakt ved spissene. */
function glintStops(c: string): GradientStop[] {
  return [
    [0, c, 1],
    [0.22, c, 0.6],
    [0.6, c, 0.18],
    [1, c, 0],
  ];
}

/** Sirkel som del av en sti (mange små prikker i én <path>). */
function dot(x: number, y: number, r: number): string {
  return `M${r2(x - r)} ${r2(y)}a${r2(r)} ${r2(r)} 0 1 0 ${r2(2 * r)} 0a${r2(r)} ${r2(r)} 0 1 0 ${r2(-2 * r)} 0`;
}

/** Normalfordelt tall (Box–Muller) fra en tallgenerator med frø. */
function gauss(rnd: () => number): number {
  return Math.sqrt(-2 * Math.log(Math.max(1e-9, rnd()))) * Math.cos(2 * Math.PI * rnd());
}

/** Toning for en blank kule med lys fra øvre venstre. */
function ballStops(color: string, dark = 0): GradientStop[] {
  return [
    [0, tint(shade(color, dark * 0.6), 0.55 - dark * 0.35)],
    [0.5, shade(color, dark)],
    [1, shade(color, 0.36 + dark * 0.3)],
  ];
}

/* ---------- Farger for lys ---------- */

/**
 * Fargen til en stjerne (et svart legeme) med overflatetemperatur `temperatur` i kelvin, som rgb-tekst (samme i lyst
 * og mørkt tema). Gyldig fra 2 500 K (røde dverger) til 40 000 K (O-stjerner); utenfor klemmes den til 1 000–40 000 K.
 * `metning` 1 gir fargen slik øyet ser den (sola nesten hvit); 1,5–2 gir tydeligere lærebokfarger, f.eks. i et
 * HR-diagram.
 *   stjerneFarge(3000)        // oransjerød
 *   stjerneFarge(5800)        // nesten hvit med et varmt skjær
 *   stjerneFarge(25000, 1.6)  // tydelig blå
 */
export function stjerneFarge(temperatur: number, metning = 1): string {
  return rgbText(saturate(blackbody(temperatur), clamp(metning, 0, 3)));
}

/**
 * Fargen til lys med bølgelengde `nm` (nanometer) som rgb-tekst (samme i begge temaer), etter samme tilnærming som
 * spektrene i fysikk kapittel 7. Synlig lys er 380–750 nm. Ultrafiolett (under 380 nm) får den fiolette grensefargen
 * og infrarødt (over 750 nm) en mørkerød, tydelig mørkere enn synlig rødt. Fargen blir svakere mot kantene, der øyet er
 * lite følsomt. Med `svekk = false` holder den seg nesten full styrke helt ut (til piler og stråler som må synes),
 * men infrarødt er fortsatt mørkerødt.
 *   bolgelengdeFarge(656)         // rød (Hα)
 *   bolgelengdeFarge(486)         // blågrønn (Hβ)
 *   bolgelengdeFarge(300, false)  // ultrafiolett: fiolett, rgb(154 0 213)
 *   bolgelengdeFarge(900, false)  // infrarødt: mørkerødt, rgb(158 0 0) (656 nm gir rgb(255 0 0))
 */
export function bolgelengdeFarge(nm: number, svekk = true): string {
  return rgbText(wavelengthRgb(nm, svekk ? 0.3 : 0.8));
}

/* ---------- Stjernehimmel ---------- */

interface SkyStar {
  x: number;
  y: number;
  r: number;
  tone: number;
  faint: boolean;
}

interface Sky {
  cx: number;
  cy: number;
  angle: number;
  len: number;
  thick: number;
  small: SkyStar[];
  bright: SkyStar[];
}

/** Stjerner og melkevei (regnes ut én gang per størrelse og frø). */
function makeSky(w: number, h: number, n: number, seed: number): Sky {
  const rnd = sceneRandom(seed * 7919 + 13);
  const angle = -32 + rnd() * 26;
  const a = (angle * Math.PI) / 180;
  const ux = Math.cos(a);
  const uy = Math.sin(a);
  const cx = w * (0.38 + rnd() * 0.24);
  const cy = h * (0.38 + rnd() * 0.24);
  const thick = Math.min(w, h) * 0.24 + Math.max(w, h) * 0.04;
  const len = Math.hypot(w, h) * 1.3;
  const small: SkyStar[] = [];
  const bright: SkyStar[] = [];
  for (let i = 0; i < n; i++) {
    let x = rnd() * w;
    let y = rnd() * h;
    if (rnd() < 0.45) {
      // Tettere langs melkeveien
      const s = (rnd() - 0.5) * len;
      const d = gauss(rnd) * thick * 0.3;
      const bx = cx + ux * s - uy * d;
      const by = cy + uy * s + ux * d;
      if (bx > 2 && bx < w - 2 && by > 2 && by < h - 2) {
        x = bx;
        y = by;
      }
    }
    const u = rnd();
    const q = rnd();
    const tone = q < 0.6 ? 0 : q < 0.79 ? 1 : q < 0.93 ? 2 : 3;
    if (u > 0.965 && bright.length < 6) bright.push({ x, y, r: 1.2 + rnd() * 0.9, tone, faint: false });
    else small.push({ x, y, r: 0.5 + 1.1 * u ** 5, tone, faint: rnd() < 0.45 });
  }
  return { cx, cy, angle, len, thick, small, bright };
}

const STAR_TONES = [SCENE.star, stjerneFarge(11000, 1.4), stjerneFarge(4700, 1.3), stjerneFarge(3300, 1.3)] as const;

export interface StjernehimmelProps {
  /** Øverste venstre hjørne. */
  x: number;
  y: number;
  /** Bredde og høyde i figurens enheter. Alt utenfor rektangelet klippes. */
  w: number;
  h: number;
  /** Antall stjerner (standard etter arealet, ca. én per 1 300 kvadratenheter). */
  antall?: number;
  /** Frø for plasseringen: samme frø gir samme himmel. */
  seed?: number;
  /** Hvor tydelig melkeveien er, 0–1 (0 = ingen). Standard 0,8. */
  melkevei?: number;
  /** Tid i sekunder (fra useSimClock): de klareste stjernene blinker svakt. Uten t står de stille. */
  t?: number;
  title?: string;
}

/**
 * Mørk himmel med stjerner i ulike størrelser og farger og en svak melkevei med et mørkt støvbånd. Mørk også i lyst
 * tema. Legg den bakerst; sol, planeter og tåker tegnes oppå.
 *   <Stjernehimmel x={0} y={0} w={800} h={400} seed={3} />
 */
export function Stjernehimmel({ x, y, w, h, antall, seed = 1, melkevei = 0.8, t, title }: StjernehimmelProps) {
  const ss = useStrokeScale();
  const clip = useSvgId('rom-himmel-klipp');
  const bg = useSvgId('rom-himmel');
  const band = useSvgId('rom-melkevei');
  const core = useSvgId('rom-melkevei-kjerne');
  const dust = useSvgId('rom-stov');
  const glow = [useSvgId('rom-glod-a'), useSvgId('rom-glod-b'), useSvgId('rom-glod-c'), useSvgId('rom-glod-d')];
  const spike = [useSvgId('rom-glimt-a'), useSvgId('rom-glimt-b'), useSvgId('rom-glimt-c'), useSvgId('rom-glimt-d')];
  const W = Math.max(1, w);
  const H = Math.max(1, h);
  const n = Math.round(clamp(antall ?? (W * H) / 1300, 0, 600));
  const sky = useMemo(() => makeSky(W, H, n, seed), [W, H, n, seed]);
  // Små stjerner samlet i én sti per farge og lysstyrke (få elementer). Litt større på mobil, så de synes.
  const paths = useMemo(() => {
    const d: string[] = Array.from({ length: 8 }, () => '');
    for (const s of sky.small) d[s.tone * 2 + (s.faint ? 1 : 0)] += dot(s.x, s.y, s.r * ss);
    return d;
  }, [sky, ss]);
  const mw = clamp(melkevei, 0, 1);
  if (!(w > 0 && h > 0)) return null;
  return (
    <g transform={`translate(${r2(x)} ${r2(y)})`}>
      {title && <title>{title}</title>}
      <defs>
        <clipPath id={clip}>
          <rect width={W} height={H} />
        </clipPath>
      </defs>
      <LinearGradient
        id={bg}
        stops={[
          [0, SCENE.space],
          [1, mix(SCENE.space, SCENE.spaceGlow, 0.6)],
        ]}
      />
      <g clipPath={`url(#${clip})`}>
        <rect width={W} height={H} fill={`url(#${bg})`} />
        {mw > 0 && (
          <g transform={`rotate(${r2(sky.angle)} ${r2(sky.cx)} ${r2(sky.cy)})`} opacity={mw} aria-hidden>
            <RadialGradient
              id={band}
              stops={[
                [0, ROM.melkevei, 0.34],
                [0.45, ROM.melkevei, 0.16],
                [1, ROM.melkevei, 0],
              ]}
            />
            <RadialGradient
              id={core}
              stops={[
                [0, ROM.melkeveiKjerne, 0.36],
                [0.55, ROM.melkeveiKjerne, 0.1],
                [1, ROM.melkeveiKjerne, 0],
              ]}
            />
            <RadialGradient
              id={dust}
              stops={[
                [0, ROM.stov, 0.42],
                [0.5, ROM.stov, 0.2],
                [1, ROM.stov, 0],
              ]}
            />
            <ellipse cx={sky.cx} cy={sky.cy} rx={sky.len / 2} ry={sky.thick} fill={`url(#${band})`} />
            <ellipse cx={sky.cx - sky.len * 0.14} cy={sky.cy + sky.thick * 0.12} rx={sky.len * 0.26} ry={sky.thick * 0.6} fill={`url(#${band})`} />
            <ellipse cx={sky.cx + sky.len * 0.06} cy={sky.cy - sky.thick * 0.05} rx={sky.len * 0.17} ry={sky.thick * 0.55} fill={`url(#${core})`} />
            <ellipse cx={sky.cx + sky.len * 0.02} cy={sky.cy + sky.thick * 0.06} rx={sky.len * 0.3} ry={sky.thick * 0.24} fill={`url(#${dust})`} />
            <ellipse
              cx={sky.cx - sky.len * 0.1}
              cy={sky.cy + sky.thick * 0.14}
              rx={sky.len * 0.18}
              ry={sky.thick * 0.16}
              transform={`rotate(4 ${r2(sky.cx - sky.len * 0.1)} ${r2(sky.cy + sky.thick * 0.14)})`}
              fill={`url(#${dust})`}
            />
          </g>
        )}
        {paths.map((d, i) =>
          d ? <path key={i} d={d} fill={STAR_TONES[i >> 1]} opacity={i & 1 ? 0.5 : 0.92} aria-hidden /> : null,
        )}
        {STAR_TONES.map((c, i) =>
          sky.bright.some((b) => b.tone === i) ? (
            <g key={i}>
              <RadialGradient
                id={glow[i]!}
                stops={[
                  [0, c, 0.6],
                  [0.16, c, 0.34],
                  [0.42, c, 0.08],
                  [1, c, 0],
                ]}
              />
              <RadialGradient id={spike[i]!} stops={glintStops(c)} />
            </g>
          ) : null,
        )}
        {sky.bright.map((s, i) => {
          const r = s.r * ss;
          const c = STAR_TONES[s.tone]!;
          const tw = t === undefined ? 1 : 0.82 + 0.18 * Math.sin(t * (1.7 + (i % 3) * 0.6) + i * 2.1);
          return [
            <circle key={`g${i}`} cx={s.x} cy={s.y} r={r * 5.5} fill={`url(#${glow[s.tone]})`} opacity={tw} aria-hidden />,
            ...glint(`s${i}`, s.x, s.y, r * 4.6, Math.max(0.42 * ss, r * 0.2), `url(#${spike[s.tone]})`, 0.5 * tw),
            <circle key={`c${i}`} cx={s.x} cy={s.y} r={r} fill={tint(c, 0.55)} aria-hidden />,
          ];
        })}
      </g>
    </g>
  );
}

/* ---------- Stjerne og sol ---------- */

export interface StjerneProps {
  /** Sentrum. */
  x: number;
  y: number;
  /** Radius til selve stjerna (skiva) i figurens enheter. Gløden går utenfor. */
  r: number;
  /** Overflatetemperatur i kelvin (2 500–40 000): gir fargen. */
  temperatur: number;
  /** Hvor sterk og stor gløden er, 0–1 (standard 0,6; 0 = ingen glød). */
  glod?: number;
  /** Fargemetning (1 = slik øyet ser det, standard 1,15; se stjerneFarge). */
  metning?: number;
  /** Glimt: to smale, kryssende stråler som blir svakere ut mot spissene (for klare stjerner). */
  glimt?: boolean;
  dim?: boolean;
  title?: string;
}

/**
 * Stjerne med farge fra temperaturen og glød (radiell toning, ikke filter). Skiva er nesten hvit i midten og har
 * stjernefargen ut mot kanten; gløden har en litt sterkere utgave av fargen, så fargeforskjellen synes også på små
 * stjerner. Ankerpunkt: sentrum.
 *   <Stjerne x={300} y={120} r={10} temperatur={3500} glod={0.8} />   // rød kjempe
 *   <Stjerne x={420} y={120} r={6} temperatur={20000} glimt />          // blå stjerne
 */
export function Stjerne({ x, y, r, temperatur, glod = 0.6, metning = 1.15, glimt = false, dim, title }: StjerneProps) {
  const ss = useStrokeScale();
  const gid = useSvgId('rom-stjerne-glod');
  const cid = useSvgId('rom-stjerne');
  const sid = useSvgId('rom-stjerne-glimt');
  const rr = Math.max(0.5, Number.isFinite(r) ? r : 0.5);
  const g = clamp(glod, 0, 1);
  const c = stjerneFarge(temperatur, metning);
  const cg = stjerneFarge(temperatur, metning * 1.7);
  const R = rr * (1.6 + 4.4 * g);
  const k = rr / R;
  return (
    <g opacity={dim ? SCENE_DIM : undefined}>
      {title && <title>{title}</title>}
      {g > 0 && (
        <>
          <RadialGradient
            id={gid}
            stops={[
              [0, cg, 0.85],
              [k, cg, 0.35 + 0.3 * g],
              [k + (1 - k) * 0.22, cg, 0.12 + 0.14 * g],
              [k + (1 - k) * 0.55, cg, 0.04 + 0.04 * g],
              [1, cg, 0],
            ]}
          />
          <circle cx={x} cy={y} r={R} fill={`url(#${gid})`} aria-hidden />
        </>
      )}
      {glimt && (
        <>
          <RadialGradient id={sid} stops={glintStops(tint(cg, 0.25))} />
          {glint('g', x, y, rr * (2.8 + 2.6 * g), Math.max(0.5 * ss, rr * 0.14), `url(#${sid})`, 0.5)}
        </>
      )}
      <RadialGradient
        id={cid}
        fx={0.42}
        fy={0.4}
        stops={[
          [0, tint(c, 0.75)],
          [0.55, tint(c, 0.3)],
          [0.88, c],
          [1, mix(c, cg, 0.5)],
        ]}
      />
      {/* Ingen mørk kontur: stjerna lyser selv, og kanten går over i gløden. */}
      <circle cx={x} cy={y} r={rr} fill={`url(#${cid})`} />
    </g>
  );
}

export interface SolProps {
  /** Sentrum. */
  x: number;
  y: number;
  /** Radius til sola (skiva) i figurens enheter. Koronaen går utenfor. */
  r: number;
  /** Hvor stor og sterk koronaen (gløden) er, 0–1 (standard 0,7). */
  korona?: number;
  /** Antall solflekker (standard 2). */
  flekker?: number;
  /** Frø for granulering og solflekker. */
  seed?: number;
  dim?: boolean;
  title?: string;
}

/**
 * Sola: gul skive som blir mørkere og mer oransje mot kanten (randfordunkling), antydet granulering (fine korn, bare
 * når r ≥ 30), solflekker og en lys korona tett rundt. Ankerpunkt: sentrum.
 *   <Sol x={120} y={200} r={80} />
 *   <Sol x={60} y={60} r={24} korona={0.4} flekker={0} />
 */
export function Sol({ x, y, r, korona = 0.7, flekker = 2, seed = 7, dim, title }: SolProps) {
  const gid = useSvgId('rom-korona');
  const did = useSvgId('rom-sol');
  const rr = Math.max(1, Number.isFinite(r) ? r : 1);
  const kk = clamp(korona, 0, 1);
  const spots = Math.round(clamp(flekker, 0, 6));
  const tex = useMemo(() => {
    const rnd = sceneRandom(seed * 92821 + 5);
    // Granulering: mange små, svake korn (0,6–1,2 % av radien), mindre mot randen der de sees på skrå.
    let gran = '';
    for (let i = 0; i < 250; i++) {
      const rho = Math.sqrt(rnd()) * 0.95;
      const a = rnd() * Math.PI * 2;
      const s = (0.006 + rnd() * 0.006) * Math.sqrt(Math.max(0.1, 1 - rho * rho));
      gran += dot(rho * Math.cos(a) * 100, rho * Math.sin(a) * 100, s * 100);
    }
    const sp: { x: number; y: number; rx: number; ry: number; rot: number }[] = [];
    for (let i = 0; i < spots; i++) {
      const lat = (rnd() < 0.5 ? -1 : 1) * (8 + rnd() * 22);
      const lon = -55 + rnd() * 110;
      const [px, py, z] = projectPoint(lon, lat, 0, 4);
      const s = 0.05 + rnd() * 0.045;
      sp.push({ x: px * 100, y: py * 100, rx: s * 100 * Math.max(0.25, z), ry: s * 100, rot: (Math.atan2(py, px) * 180) / Math.PI });
    }
    return { gran, sp };
  }, [seed, spots]);
  // Koronaen er lys: lys og tett inntil skiva, og den faller raskt (ingen dis langt ute).
  const R = rr * (1 + 1.5 * kk);
  const k = rr / R;
  const inner = mix(ROM.solKjerne, ROM.solKorona, 0.5);
  return (
    <g opacity={dim ? SCENE_DIM : undefined}>
      {title && <title>{title}</title>}
      {kk > 0 && (
        <>
          <RadialGradient
            id={gid}
            stops={[
              [0, inner, 0.85],
              [k, inner, 0.8],
              [k + (1 - k) * 0.08, inner, 0.42],
              [k + (1 - k) * 0.25, ROM.solKorona, 0.16],
              [k + (1 - k) * 0.5, ROM.solKorona, 0.04],
              [k + (1 - k) * 0.7, ROM.solKorona, 0],
            ]}
          />
          <circle cx={x} cy={y} r={R} fill={`url(#${gid})`} aria-hidden />
        </>
      )}
      <RadialGradient
        id={did}
        fx={0.45}
        fy={0.43}
        stops={[
          [0, ROM.solKjerne],
          [0.5, ROM.sol],
          [0.86, mix(ROM.sol, ROM.solKant, 0.6)],
          [1, ROM.solKant],
        ]}
      />
      <circle cx={x} cy={y} r={rr} fill={`url(#${did})`} />
      <g transform={`translate(${r2(x)} ${r2(y)}) scale(${r2(rr / 100)})`} aria-hidden>
        {rr >= 30 && <path d={tex.gran} fill={ROM.solKjerne} opacity={0.09} />}
        {tex.sp.map((s, i) => (
          <g key={i} transform={`translate(${r2(s.x)} ${r2(s.y)}) rotate(${r2(s.rot)})`}>
            <ellipse rx={s.rx} ry={s.ry} fill={mix(ROM.solKant, ROM.solFlekk, 0.45)} opacity={0.75} />
            <ellipse rx={s.rx * 0.5} ry={s.ry * 0.5} fill={ROM.solFlekk} opacity={0.9} />
          </g>
        ))}
      </g>
    </g>
  );
}

/* ---------- Planeter ---------- */

export type PlanetType = 'jorda' | 'mars' | 'jupiter' | 'maanen' | 'neptun';

export interface PlanetProps {
  /** Sentrum. */
  x: number;
  y: number;
  /** Radius i figurens enheter (ekvatorradius; Jupiter er 6,5 % flatere mellom polene). */
  r: number;
  type: PlanetType;
  /** Aksehelning i bildeplanet: grader med klokka (jordaksen: rotate={23.4}). Lyset kommer fortsatt fra `lysretning`. */
  rotate?: number;
  /** Planeten dreid om sin egen akse, i grader (østover; animer med tiden for døgnrotasjon). */
  dreining?: number;
  /** Retningen mot lyskilden (sola), grader med klokka fra høyre: 180 = fra venstre (standard), 0 = fra høyre. */
  lysretning?: number;
  /** Hvor mørk nattsida er, 0–1 (standard 0,8; 0 = ingen nattside). */
  natt?: number;
  /**
   * Hvor stor del av skiva som er belyst, 0–1: 0 = ny (helt mørk), 0,5 = halv (lyset kommer rett fra siden),
   * 1 = full. Standard 0,7 (som i lærebøkene: mest dagside). Gir også månefasene.
   */
  fase?: number;
  dim?: boolean;
  title?: string;
}

interface PlanetLayer {
  d: string;
  fill?: string;
  stroke?: string;
  sw?: number;
  op?: number;
  dx?: number;
  dy?: number;
}

interface PlanetSpec {
  lon0: number;
  lat0: number;
  flat: number;
  /** Halve bredden på den myke overgangen dag–natt (skumringen), i radier, ved ekvator med lyset fra siden. */
  soft: number;
  /** Tynn atmosfære som lyser i kanten på dagsida. */
  atm?: string;
  /** Dis mot randen (detaljene blekner ut mot kanten, som på ekte planeter med atmosfære). */
  haze?: [string, number];
  base: GradientStop[];
}

const PLANETS: Record<PlanetType, PlanetSpec> = {
  jorda: {
    lon0: 15,
    lat0: 14,
    flat: 1,
    soft: 0.12,
    atm: ROM.atmosfaere,
    haze: [ROM.atmosfaere, 0.55],
    base: [
      [0, tint(ROM.hav, 0.12)],
      [0.65, ROM.hav],
      [1, ROM.havDyp],
    ],
  },
  mars: {
    lon0: 40,
    lat0: 16,
    flat: 1,
    soft: 0.08,
    atm: ROM.marsLys,
    haze: [ROM.mars, 0.6],
    base: [
      [0, ROM.marsLys],
      [0.6, ROM.mars],
      [1, shade(ROM.mars, 0.18)],
    ],
  },
  jupiter: {
    lon0: 0,
    lat0: 3,
    flat: 0.935,
    soft: 0.1,
    haze: [ROM.jupiterBelte, 0.45],
    base: [
      [0, tint(ROM.jupiterSone, 0.1)],
      [0.7, ROM.jupiterSone],
      [1, shade(ROM.jupiterSone, 0.12)],
    ],
  },
  maanen: {
    lon0: 0,
    lat0: 0,
    flat: 1,
    soft: 0.045,
    base: [
      [0, ROM.maaneLys],
      [0.6, ROM.maane],
      [1, shade(ROM.maane, 0.12)],
    ],
  },
  neptun: {
    lon0: 0,
    lat0: 12,
    flat: 0.983,
    soft: 0.1,
    atm: ROM.neptunLys,
    haze: [ROM.neptunLys, 0.35],
    base: [
      [0, tint(ROM.neptun, 0.18)],
      [0.65, ROM.neptun],
      [1, ROM.neptunMork],
    ],
  },
};

/**
 * Overflaten (kontinenter, bånd, hav) projisert for en gitt dreining. Alt i enhetskoordinater (radius 1).
 * `detail` styrer småting etter størrelsen: 0 = liten (under 30), 1 = middels, 2 = stor (40 og mer).
 */
function planetSurface(type: PlanetType, dreining: number, light: [number, number], detail: 0 | 1 | 2): PlanetLayer[] {
  const spec = PLANETS[type];
  const lon0 = spec.lon0 - dreining;
  const lat0 = spec.lat0;
  const fill = (rings: readonly Ring[]) => projectFill(rings, lon0, lat0);
  switch (type) {
    case 'jorda':
      return [
        { d: fill(EARTH_LAND), fill: ROM.land },
        { d: fill(EARTH_DESERT), fill: ROM.orken, op: 0.92 },
        { d: fill(EARTH_WATER), fill: ROM.hav },
        { d: fill(EARTH_ICE), fill: ROM.is, op: 0.95 },
        // Skyfelt: en bred, myk del og en svak, mindre kjerne
        { d: fill(EARTH_CLOUDS_SOFT), fill: ROM.sky, op: 0.24 },
        { d: fill(EARTH_CLOUDS_CORE), fill: ROM.sky, op: 0.2 },
      ];
    case 'mars':
      return [
        { d: fill(MARS_DARK_SOFT), fill: ROM.marsMork, op: 0.3 },
        { d: fill(MARS_DARK_CORE), fill: ROM.marsMork, op: 0.45 },
        { d: fill(MARS_LIGHT), fill: ROM.marsLys, op: 0.35 },
        { d: projectLines(MARS_CANYON, lon0, lat0), stroke: ROM.marsMork, sw: 0.014, op: 0.5 },
        { d: fill(MARS_CAPS), fill: ROM.is, op: 0.92 },
      ];
    case 'jupiter': {
      const belts = JUPITER_BELTS.map(([s, n, tone], i) => ({ ring: bandRing(s, n, lon0, 0.35, i + 1), tone }));
      return [
        { d: fill([bandRing(42, 90, lon0, 0.5), bandRing(-90, -45, lon0, 0.5)]), fill: ROM.jupiterBelte, op: 0.4 },
        { d: fill(belts.filter((b) => b.tone === 0).map((b) => b.ring)), fill: ROM.jupiterBelte, op: 0.55 },
        { d: fill(belts.filter((b) => b.tone === 1).map((b) => b.ring)), fill: ROM.jupiterMork, op: 0.62 },
        // Den store røde flekken med lys kant, og noen hvite ovaler
        { d: fill([sphereEllipse(-28, -22, 12, 6.8, 18)]), fill: ROM.jupiterSone, op: 0.85 },
        { d: fill([sphereEllipse(-28, -22, 9.5, 5, 18)]), fill: ROM.jupiterFlekk, op: 0.8 },
        { d: fill([sphereEllipse(-60, -40, 3, 1.8, 10), sphereEllipse(-38, -41, 2.6, 1.6, 10), sphereEllipse(20, 33, 2.4, 1.4, 10)]), fill: ROM.jupiterSone, op: 0.7 },
      ];
    }
    case 'maanen': {
      // Små måner viser bare de tre kjente kraterne (Tycho, Copernicus, Plato), og strålene bare fra middels størrelse.
      const craters = (detail >= 2 ? MOON_CRATERS : MOON_CRATERS.slice(0, 3)).map(([lon, lat, rad]) => sphereEllipse(lon, lat, rad, rad, 12));
      // Kraterbunnen er belyst på sida bort fra lyset; skyggen ligger mot lyset.
      const shift = 0.008;
      return [
        { d: fill(MOON_MARIA_SOFT), fill: ROM.maaneMare, op: 0.32 },
        { d: fill(MOON_MARIA), fill: ROM.maaneMare, op: 0.72 },
        { d: fill(MOON_FRIGORIS), fill: ROM.maaneMare, op: 0.45 },
        ...(detail >= 1 ? [{ d: projectLines(MOON_RAYS, lon0, lat0), stroke: ROM.maaneLys, sw: 0.03, op: 0.15 }] : []),
        { d: fill(craters), fill: shade(ROM.maaneMare, 0.25), op: 0.22 },
        { d: fill(craters), fill: ROM.maaneLys, op: 0.45, dx: -light[0] * shift, dy: -light[1] * shift },
      ];
    }
    case 'neptun':
      return [
        { d: fill(NEPTUNE_BANDS.filter((b) => b[2] === 0).map(([s, n]) => bandRing(s, n, lon0, 1.5))), fill: ROM.neptunMork, op: 0.45 },
        { d: fill(NEPTUNE_BANDS.filter((b) => b[2] === 1).map(([s, n]) => bandRing(s, n, lon0, 1))), fill: ROM.neptunLys, op: 0.22 },
        { d: fill([sphereEllipse(-30, -20, 11, 6, 16)]), fill: ROM.neptunMork, op: 0.85 },
        { d: projectLines([latStripe(-38, -18, -30), latStripe(-15, 20, 26), latStripe(30, 60, -42)], lon0, lat0), stroke: ROM.sky, sw: 0.05, op: 0.22 },
        { d: projectLines([latStripe(-36, -22, -30), latStripe(-10, 14, 26)], lon0, lat0), stroke: ROM.sky, sw: 0.022, op: 0.42 },
      ];
  }
}

/**
 * Planet eller måne med belysning fra sola: dagside, myk overgang og mørk nattside. Overflaten er et grovt, men
 * riktig kart projisert på kula (jorda viser Europa og Afrika, Mars Syrtis Major og polkappen, Månen havene og
 * Tycho), så `dreining` kan animere døgnrotasjonen. Ankerpunkt: sentrum. `r` er radien.
 *   <Planet x={400} y={200} r={70} type="jorda" rotate={23.4} />
 *   <Planet x={600} y={200} r={18} type="maanen" lysretning={180} />
 *   <Planet x={300} y={150} r={60} type="jupiter" dreining={clock.t * 36} />
 */
export function Planet({ x, y, r, type, rotate = 0, dreining = 0, lysretning = 180, natt = 0.8, fase = 0.7, dim, title }: PlanetProps) {
  const ss = useStrokeScale();
  const clip = useSvgId('rom-planet-klipp');
  const baseId = useSvgId('rom-planet');
  const shadeId = useSvgId('rom-planet-skygge');
  const atmId = useSvgId('rom-planet-atm');
  const hazeId = useSvgId('rom-planet-dis');
  const nightId = useSvgId('rom-planet-natt');
  const kind: PlanetType = type in PLANETS ? type : 'jorda';
  const spec = PLANETS[kind];
  const rr = Math.max(1, Number.isFinite(r) ? r : 1);
  const th = (((lysretning - rotate) % 360) * Math.PI) / 180;
  const lx = Math.cos(th);
  const ly = Math.sin(th);
  // Avrundet lysretning, så små endringer i lyset ikke regner kartet på nytt.
  const lxr = r2(lx);
  const lyr = r2(ly);
  const detail: 0 | 1 | 2 = rr >= 40 ? 2 : rr >= 30 ? 1 : 0;
  const layers = useMemo(
    () => planetSurface(kind, Number.isFinite(dreining) ? dreining : 0, [lxr, lyr], detail),
    [kind, dreining, lxr, lyr, detail],
  );
  const nt = clamp(natt, 0, 1);
  const fs = clamp(fase, 0, 1);
  const night = nightShade(fs, spec.soft);
  // Atmosfæren lyser i kanten på dagsida: ringen er flyttet mot lyset, så den ligger skjult bak skiva på nattsida.
  // Ved full fase (lyset bakfra) lyser den hele veien rundt.
  const shift = 0.03 + 0.07 * clamp((1 - fs) / 0.2, 0, 1) * clamp(nt / 0.3, 0, 1);
  const peak = 1.02 - shift;
  const u = 1 / rr; // én enhet i figuren, målt i planetens enhetskoordinater
  return (
    <g
      transform={`translate(${r2(x)} ${r2(y)}) rotate(${r2(rotate)}) scale(${r2(rr)} ${r2(rr * spec.flat)})`}
      opacity={dim ? SCENE_DIM : undefined}
    >
      {title && <title>{title}</title>}
      <defs>
        <clipPath id={clip}>
          <circle r={1} />
        </clipPath>
      </defs>
      {spec.atm && (
        <>
          <RadialGradient
            id={atmId}
            stops={[
              [r4((peak - 0.07) / 1.1), spec.atm, 0],
              [r4(peak / 1.1), spec.atm, 0.6],
              [r4((peak + 0.05) / 1.1), spec.atm, 0.25],
              [1, spec.atm, 0],
            ]}
          />
          <circle cx={r4(lx * shift)} cy={r4(ly * shift)} r={1.1} fill={`url(#${atmId})`} opacity={kind === 'mars' ? 0.45 : 1} aria-hidden />
        </>
      )}
      <RadialGradient id={baseId} fx={0.5 + 0.22 * lx} fy={0.5 + 0.22 * ly} stops={spec.base} />
      <circle r={1} fill={`url(#${baseId})`} />
      <g clipPath={`url(#${clip})`} aria-hidden>
        {layers.map((l, i) =>
          l.d ? (
            <path
              key={i}
              d={l.d}
              fill={l.fill ?? 'none'}
              stroke={l.stroke}
              strokeWidth={l.sw !== undefined ? Math.max(l.sw, 1.2 * u * ss) : undefined}
              strokeLinecap={l.stroke ? 'round' : undefined}
              strokeLinejoin={l.stroke ? 'round' : undefined}
              opacity={l.op}
              transform={l.dx || l.dy ? `translate(${r2(l.dx ?? 0)} ${r2(l.dy ?? 0)})` : undefined}
            />
          ) : null,
        )}
      </g>
      {spec.haze && (
        <>
          <RadialGradient
            id={hazeId}
            stops={[
              [0, spec.haze[0], 0],
              [0.72, spec.haze[0], 0],
              [0.94, spec.haze[0], spec.haze[1] * 0.6],
              [1, spec.haze[0], spec.haze[1]],
            ]}
          />
          <circle r={1} fill={`url(#${hazeId})`} aria-hidden />
        </>
      )}
      <RadialGradient
        id={shadeId}
        cx={0.5 + 0.12 * lx}
        cy={0.5 + 0.12 * ly}
        r={0.72}
        fx={0.5 + 0.3 * lx}
        fy={0.5 + 0.3 * ly}
        stops={[
          [0, SCENE.highlight, 0.45],
          [0.38, SCENE.highlight, 0],
          [0.72, ROM.natt, 0.1],
          [1, ROM.natt, 0.32],
        ]}
      />
      <circle r={1} fill={`url(#${shadeId})`} aria-hidden />
      {nt > 0 && night.kind !== 'none' && (
        <g transform={`rotate(${r2((th * 180) / Math.PI - 180)})`} aria-hidden>
          {night.kind === 'full' ? (
            <circle r={1} fill={ROM.natt} opacity={nt} />
          ) : (
            <>
              <defs>
                {night.kind === 'linear' ? (
                  <linearGradient id={nightId} gradientUnits="userSpaceOnUse" x1={r4(night.x - night.w)} y1={0} x2={r4(night.x + night.w)} y2={0}>
                    {TWILIGHT.map(([t, k]) => (
                      <stop key={t} offset={(t + 1) / 2} style={{ stopColor: ROM.natt, stopOpacity: r4(nt * k) }} />
                    ))}
                  </linearGradient>
                ) : (
                  <radialGradient id={nightId} gradientUnits="userSpaceOnUse" cx={r4(night.cx)} cy={0} r={r4(night.R + night.w)}>
                    {TWILIGHT.map(([t, k]) => (
                      <stop
                        key={t}
                        offset={r4((night.R + t * night.w) / (night.R + night.w))}
                        style={{ stopColor: ROM.natt, stopOpacity: r4(nt * (night.inside ? 1 - k : k)) }}
                      />
                    ))}
                  </radialGradient>
                )}
              </defs>
              <circle r={1} fill={`url(#${nightId})`} />
            </>
          )}
        </g>
      )}
      <circle r={1} fill="none" stroke={SCENE.outline} strokeWidth={0.9 * u * ss} opacity={0.65} />
    </g>
  );
}

const r4 = (v: number) => Math.round(v * 10000) / 10000;

/** Skumringen: [t, mørke] fra dagsida (t = −1) til nattsida (t = 1), en myk S-kurve. */
const TWILIGHT: readonly (readonly [number, number])[] = [
  [-1, 0],
  [-0.5, 0.16],
  [0, 0.5],
  [0.5, 0.84],
  [1, 1],
];

type NightShade =
  | { kind: 'none' }
  | { kind: 'full' }
  /** Rett skillelinje i x (halv fase). */
  | { kind: 'linear'; x: number; w: number }
  /** Skillelinja som en sirkel med sentrum (cx, 0) og radius R; natt utenfor (mer enn halv) eller innenfor (sigd). */
  | { kind: 'radial'; cx: number; R: number; w: number; inside: boolean };

/**
 * Nattsida med lyset fra venstre (dreies etterpå mot lysretningen). Skillelinja dag–natt er en halv ellipse gjennom
 * polene (0, ±1) og (±e, 0) med e = |2 · fase − 1|. Den tilnærmes med sirkelen gjennom de samme tre punktene (avvik
 * under 3 % av diameteren), så hele nattsida blir én radiell toning over skiva: ingen skjøt ved polene, og den myke
 * sonen ligger midt på linja (±w), som skumring. Ved nesten halv fase er linja rett (lineær toning).
 */
function nightShade(fs: number, soft: number): NightShade {
  if (fs >= 0.995) return { kind: 'none' };
  if (fs <= 0.005) return { kind: 'full' };
  const gib = fs >= 0.5;
  const e = Math.abs(2 * fs - 1);
  // Skumringssonen er smalere når skillelinja ligger nær randen (sett på skrå).
  const w = soft * Math.max(0.35, Math.sqrt(1 - e * e));
  if (e < 0.03) return { kind: 'linear', x: gib ? e : -e, w };
  const c = (1 - e * e) / (2 * e);
  const R = (1 + e * e) / (2 * e);
  return gib ? { kind: 'radial', cx: -c, R, w, inside: false } : { kind: 'radial', cx: c, R, w, inside: true };
}

/* ---------- Tåke ---------- */

export type TaakeFarge = keyof typeof TAAKE_FARGER;

export interface TaakeProps {
  /** Øverste venstre hjørne av rektangelet tåka fyller. */
  x: number;
  y: number;
  w: number;
  h: number;
  /** Frø: samme frø gir samme form. */
  seed?: number;
  /** Rød (hydrogen, stjernedannelse), blå (refleksjonståke) eller fiolett. */
  farge?: TaakeFarge;
  /** «sky» = gass- og støvsky der stjerner dannes (standard), «ring» = planetarisk tåke rundt en hvit dverg. */
  form?: 'sky' | 'ring';
  /** Unge stjerner (sky) eller den hvite dvergen (ring) i midten. Standard på. */
  stjerner?: boolean;
  dim?: boolean;
  title?: string;
}

interface NebulaBlob {
  cx: number;
  cy: number;
  rx: number;
  ry: number;
  rot: number;
  tone: 0 | 1 | 2 | 3;
  op: number;
}

function makeNebula(w: number, h: number, seed: number, form: 'sky' | 'ring'): { blobs: NebulaBlob[]; stars: { x: number; y: number; r: number }[] } {
  const rnd = sceneRandom(seed * 4513 + (form === 'ring' ? 77 : 3));
  const blobs: NebulaBlob[] = [];
  const stars: { x: number; y: number; r: number }[] = [];
  if (form === 'ring') {
    // Klumper av ulik størrelse langs den indre kanten av ringen (der den er sterkest)
    for (let i = 0; i < 11; i++) {
      const a = (i / 11) * Math.PI * 2 + rnd() * 0.45;
      const rad = 0.215 + rnd() * 0.05;
      const big = rnd();
      blobs.push({
        cx: w * (0.5 + Math.cos(a) * rad),
        cy: h * (0.5 + Math.sin(a) * rad * 0.92),
        rx: w * (0.035 + big * 0.075),
        ry: h * (0.03 + big * 0.045 + rnd() * 0.02),
        rot: (a * 180) / Math.PI + 90,
        tone: i % 4 === 1 ? 1 : 0,
        op: 0.22 + rnd() * 0.3,
      });
    }
    stars.push({ x: w / 2, y: h / 2, r: 1 });
    return { blobs, stars };
  }
  const angle = -25 + rnd() * 50;
  const a = (angle * Math.PI) / 180;
  // Den lyse kjernen der de unge stjernene sitter
  const kx = 0.42 + rnd() * 0.16;
  const ky = 0.42 + rnd() * 0.16;
  const at = (sx: number, sy: number, spread: number): [number, number] => [
    w * clamp(kx + gauss(rnd) * spread * sx, 0.22, 0.78),
    h * clamp(ky + gauss(rnd) * spread * sy, 0.22, 0.78),
  ];
  // Gass i hovedfargen, så i bifargen
  for (let i = 0; i < 9; i++) {
    const [cx, cy] = at(1, 0.9, 0.11);
    blobs.push({ cx, cy, rx: w * (0.17 + rnd() * 0.14), ry: h * (0.14 + rnd() * 0.12), rot: angle + (rnd() - 0.5) * 70, tone: 0, op: 0.45 + rnd() * 0.3 });
  }
  for (let i = 0; i < 4; i++) {
    const [cx, cy] = at(1.2, 1, 0.15);
    blobs.push({ cx, cy, rx: w * (0.12 + rnd() * 0.12), ry: h * (0.1 + rnd() * 0.1), rot: angle + (rnd() - 0.5) * 60, tone: 1, op: 0.35 + rnd() * 0.3 });
  }
  // Myke slør langs hovedretningen
  for (let i = 0; i < 3; i++) {
    const [cx, cy] = at(1, 1, 0.12);
    blobs.push({ cx, cy, rx: w * (0.22 + rnd() * 0.1), ry: h * (0.06 + rnd() * 0.04), rot: angle + (rnd() - 0.5) * 30, tone: i % 2 ? 1 : 0, op: 0.22 + rnd() * 0.15 });
  }
  // Lys kjerne rundt de unge stjernene
  blobs.push({ cx: w * kx, cy: h * ky, rx: w * 0.17, ry: h * 0.14, rot: angle, tone: 2, op: 0.5 });
  blobs.push({ cx: w * (kx + 0.02), cy: h * (ky - 0.01), rx: w * 0.08, ry: h * 0.07, rot: angle, tone: 2, op: 0.65 });
  // Støvbånd (mørke, myke) som skjærer gjennom gassen ved siden av kjernen
  for (let i = 0; i < 3; i++) {
    const off = (i - 1) * 0.12 + (rnd() - 0.5) * 0.05;
    blobs.push({
      cx: w * clamp(kx - Math.sin(a) * off + (rnd() - 0.5) * 0.1, 0.25, 0.75),
      cy: h * clamp(ky + Math.cos(a) * off * 1.2 + 0.04, 0.25, 0.75),
      rx: w * (0.16 + rnd() * 0.12),
      ry: h * (0.06 + rnd() * 0.05),
      rot: angle + (rnd() - 0.5) * 30,
      tone: 3,
      op: 0.5 + rnd() * 0.2,
    });
  }
  // Ungt stjernehop i kjernen
  for (let i = 0; i < 5; i++) {
    stars.push({
      x: w * clamp(kx + gauss(rnd) * 0.06, 0.2, 0.8),
      y: h * clamp(ky + gauss(rnd) * 0.06, 0.2, 0.8),
      r: i === 0 ? 1.3 : 0.6 + rnd() * 0.5,
    });
  }
  return { blobs, stars };
}

/**
 * Tåke i verdensrommet: en gass- og støvsky der stjerner dannes (med mørke støvbånd og unge, blå stjerner), eller en
 * planetarisk tåke (`form="ring"`): et skall av gass rundt en hvit dverg. Bare toninger, ingen filtre.
 * Legg den oppå en Stjernehimmel.
 *   <Taake x={420} y={60} w={260} h={180} farge="rod" seed={2} />
 *   <Taake x={120} y={80} w={140} h={120} form="ring" farge="blaa" />
 */
export function Taake({ x, y, w, h, seed = 1, farge = 'rod', form = 'sky', stjerner = true, dim, title }: TaakeProps) {
  const ss = useStrokeScale();
  const ids = [useSvgId('rom-taake-a'), useSvgId('rom-taake-b'), useSvgId('rom-taake-c'), useSvgId('rom-taake-d')];
  const ringId = useSvgId('rom-taake-ring');
  const haloId = useSvgId('rom-taake-halo');
  const starId = useSvgId('rom-taake-stjerne');
  const W = Math.max(1, w);
  const H = Math.max(1, h);
  const neb = useMemo(() => makeNebula(W, H, seed, form), [W, H, seed, form]);
  const [main, second] = TAAKE_FARGER[farge] ?? TAAKE_FARGER.rod;
  const tones: [string, number][] = [
    [main, 1],
    [second, 1],
    [ROM.taakeKjerne, 0.8],
    [ROM.stov, 1],
  ];
  const young = stjerneFarge(16000, 1.5);
  const dwarf = stjerneFarge(30000, 1.3);
  if (!(w > 0 && h > 0)) return null;
  return (
    <g transform={`translate(${r2(x)} ${r2(y)})`} opacity={dim ? SCENE_DIM : undefined}>
      {title && <title>{title}</title>}
      {tones.map(([c, a], i) => (
        <RadialGradient
          key={i}
          id={ids[i]!}
          stops={
            i === 3
              ? [
                  [0, c, 0.8],
                  [0.4, c, 0.42],
                  [0.75, c, 0.12],
                  [1, c, 0],
                ]
              : [
                  [0, c, a * 0.9],
                  [0.3, c, a * 0.62],
                  [0.6, c, a * 0.26],
                  [0.85, c, a * 0.07],
                  [1, c, 0],
                ]
          }
        />
      ))}
      <RadialGradient
        id={starId}
        stops={[
          [0, form === 'ring' ? dwarf : young, 1],
          [0.2, form === 'ring' ? dwarf : young, 0.5],
          [1, form === 'ring' ? dwarf : young, 0],
        ]}
      />
      {form === 'ring' && (
        <>
          <RadialGradient
            id={haloId}
            stops={[
              [0, second, 0],
              [0.55, second, 0.08],
              [0.75, second, 0.16],
              [1, second, 0],
            ]}
          />
          {/* Lysende, blågrønn midte; ringen er smal og sterkest ved den indre kanten, og faller mykt utover. */}
          <RadialGradient
            id={ringId}
            stops={[
              [0, ROM.taakeIndre, 0.55],
              [0.38, ROM.taakeIndre, 0.42],
              [0.5, mix(ROM.taakeIndre, main, 0.6), 0.5],
              [0.58, main, 0.85],
              [0.68, main, 0.55],
              [0.82, main, 0.2],
              [1, main, 0],
            ]}
          />
          <ellipse cx={W / 2} cy={H / 2} rx={W * 0.49} ry={H * 0.47} fill={`url(#${haloId})`} aria-hidden />
          <ellipse cx={W / 2} cy={H / 2} rx={W * 0.4} ry={H * 0.37} fill={`url(#${ringId})`} aria-hidden />
        </>
      )}
      {neb.blobs.map((b, i) => (
        <ellipse
          key={i}
          cx={r2(b.cx)}
          cy={r2(b.cy)}
          rx={r2(b.rx)}
          ry={r2(b.ry)}
          transform={`rotate(${r2(b.rot)} ${r2(b.cx)} ${r2(b.cy)})`}
          fill={`url(#${ids[b.tone]})`}
          opacity={r2(b.op)}
          aria-hidden
        />
      ))}
      {stjerner &&
        neb.stars.map((s, i) => {
          const rr = s.r * 2.2 * ss;
          return (
            <g key={i} aria-hidden>
              <circle cx={s.x} cy={s.y} r={rr * 4} fill={`url(#${starId})`} />
              <circle cx={s.x} cy={s.y} r={rr * 0.7} fill={tint(form === 'ring' ? dwarf : young, 0.6)} />
            </g>
          );
        })}
    </g>
  );
}

/* ---------- Partikler ---------- */

export type NukleonType = 'proton' | 'noytron';

export interface NukleonProps {
  /** Sentrum. */
  x: number;
  y: number;
  /** Radius i figurens enheter (standard 10). I en figur 800 enheter bred bør r være minst 10, så plusstegnet kan leses på mobil. */
  r?: number;
  type: NukleonType;
  /** Plusstegn på protonet (standard når kula er stor nok til at tegnet kan leses, se Ball). */
  tegn?: boolean;
  dim?: boolean;
  title?: string;
}

/**
 * Blank kule med lys fra øvre venstre og eventuelt et tegn (+ eller −). Tegnet vises når kula er minst ca. 3,5 enheter
 * etter skaleringen for mobil (useSceneScale), og streken er aldri tynnere enn 1,4 · strekskala, så det ikke forsvinner.
 */
function Ball({ x, y, r, color, sign, dim, title }: { x: number; y: number; r: number; color: string; sign: '+' | '−' | null; dim?: boolean; title?: string }) {
  const ss = useStrokeScale();
  const sc = useSceneScale();
  const id = useSvgId('rom-kule');
  const rr = Math.max(0.5, Number.isFinite(r) ? r : 0.5);
  const s = rr * 0.5;
  const sw = Math.min(rr * 0.42, Math.max(1.4 * ss, rr * 0.2));
  return (
    <g opacity={dim ? SCENE_DIM : undefined}>
      {title && <title>{title}</title>}
      <RadialGradient id={id} fx={0.36} fy={0.32} stops={ballStops(color)} />
      <circle cx={x} cy={y} r={rr} fill={`url(#${id})`} stroke={SCENE.outline} strokeWidth={0.8 * ss} />
      {rr >= 6 && (
        <ellipse
          cx={x - rr * 0.36}
          cy={y - rr * 0.42}
          rx={rr * 0.26}
          ry={rr * 0.15}
          transform={`rotate(-35 ${r2(x - rr * 0.36)} ${r2(y - rr * 0.42)})`}
          fill={SCENE.highlight}
          aria-hidden
        />
      )}
      {sign && rr * sc >= 3.5 && (
        <path
          d={sign === '+' ? `M${r2(x - s)} ${r2(y)}h${r2(2 * s)}M${r2(x)} ${r2(y - s)}v${r2(2 * s)}` : `M${r2(x - s)} ${r2(y)}h${r2(2 * s)}`}
          stroke={ROM.tegn}
          strokeWidth={r2(sw)}
          strokeLinecap="round"
          aria-hidden
        />
      )}
    </g>
  );
}

/**
 * Proton (rødoransje, med +) eller nøytron (gråblått) som en blank kule med lys fra øvre venstre. Samme farger som i
 * fysikk kapittel 7–8. Ankerpunkt: sentrum.
 *   <Nukleon x={200} y={100} r={12} type="proton" />
 *   <Nukleon x={230} y={100} r={12} type="noytron" />
 */
export function Nukleon({ x, y, r = 10, type, tegn, dim, title }: NukleonProps) {
  const proton = type === 'proton';
  return <Ball x={x} y={y} r={r} color={proton ? ROM.proton : ROM.noytron} sign={proton && (tegn ?? true) ? '+' : null} dim={dim} title={title} />;
}

export interface ElektronProps {
  /** Sentrum. */
  x: number;
  y: number;
  /**
   * Radius i figurens enheter (standard 6). Tegnes mindre enn nukleonene, selv om elektronet egentlig er et punkt.
   * I en figur 800 enheter bred bør r være minst 8, så minustegnet kan leses på mobil.
   */
  r?: number;
  /** Minustegn (standard når kula er stor nok til at tegnet kan leses, se Ball). */
  tegn?: boolean;
  dim?: boolean;
  title?: string;
}

/**
 * Elektron: liten blå kule med minustegn, samme farge som i fysikk kapittel 7–8. Ankerpunkt: sentrum.
 *   <Elektron x={320} y={80} r={8} />
 */
export function Elektron({ x, y, r = 6, tegn, dim, title }: ElektronProps) {
  return <Ball x={x} y={y} r={r} color={ROM.elektron} sign={(tegn ?? true) ? '−' : null} dim={dim} title={title} />;
}

export interface AtomkjerneProps {
  /** Sentrum av kjernen. */
  x: number;
  y: number;
  /** Protontall (antall protoner). */
  Z: number;
  /** Nøytrontall (antall nøytroner). */
  N: number;
  /**
   * Radius til ett nukleon i figurens enheter (standard 7). Hele kjernen får radius ca. r · (1 + 1,1 · ∛A):
   * ca. 3,3 r for karbon-12, 5,1 r for jern-56 og 7,6 r for uran-238 (helium-4 er en rombe på ca. 2 r).
   */
  r?: number;
  /** Frø: annen dreining og plassering av protonene og nøytronene (kjerner med A ≤ 4 har en fast, lettlest form). */
  seed?: number;
  /** Plusstegn på protonene i det fremste laget (standard når r ≥ 7 og A ≤ 60). */
  tegn?: boolean;
  dim?: boolean;
  title?: string;
}

/**
 * Atomkjerne: tett pakket kule av protoner (rødoransje) og nøytroner (gråblå) med 3D-skygge. Plasseringen er fast for
 * samme Z, N og frø, protonene er spredt jevnt (ingen klynger), og størrelsen vokser som A^(1/3) (som ekte kjerner).
 * En mørk kule bak nukleonene gjør at mellomrommene ser ut som innsiden av kjernen. Bare nukleonene som kan synes,
 * tegnes, så også uran holder seg under ca. 95 elementer. Ankerpunkt: sentrum.
 *   <Atomkjerne x={200} y={150} Z={2} N={2} r={10} />       // alfapartikkel
 *   <Atomkjerne x={420} y={150} Z={92} N={146} r={5} />     // uran-238
 */
export function Atomkjerne({ x, y, Z, N, r = 7, seed = 1, tegn, dim, title }: AtomkjerneProps) {
  const ss = useStrokeScale();
  const ids = [
    useSvgId('rom-n0'),
    useSvgId('rom-n1'),
    useSvgId('rom-n2'),
    useSvgId('rom-p0'),
    useSvgId('rom-p1'),
    useSvgId('rom-p2'),
  ];
  const bgId = useSvgId('rom-kjerne-indre');
  const z = Math.round(clamp(Z, 0, 120));
  const n = Math.round(clamp(N, 0, 180));
  const sd = Math.round(Number.isFinite(seed) ? seed : 1);
  const pack = useMemo(() => packNucleus(z, n, sd), [z, n, sd]);
  const rr = Math.max(0.5, Number.isFinite(r) ? r : 0.5);
  const A = z + n;
  const showSign = tegn ?? (rr >= 7 && A <= 60);
  const signs = useMemo(() => {
    if (!showSign) return '';
    const s = 0.46;
    let d = '';
    for (const p of pack.list)
      if (p.proton && p.front) d += `M${r2((p.x - s) * rr + x)} ${r2(p.y * rr + y)}h${r2(2 * s * rr)}M${r2(p.x * rr + x)} ${r2((p.y - s) * rr + y)}v${r2(2 * s * rr)}`;
    return d;
  }, [pack, showSign, rr, x, y]);
  if (pack.list.length === 0) return null;
  // Innsiden av kjernen: en mørk blanding av proton- og nøytronfargen etter andelen protoner.
  const inner = shade(mix(ROM.noytron, ROM.proton, A > 0 ? z / A : 0), 0.45);
  return (
    <g opacity={dim ? SCENE_DIM : undefined}>
      {title && <title>{title}</title>}
      {[ROM.noytron, ROM.proton].map((c, k) =>
        [0, 0.14, 0.3].map((dark, j) => <RadialGradient key={`${k}${j}`} id={ids[k * 3 + j]!} fx={0.36} fy={0.32} stops={ballStops(c, dark)} />),
      )}
      {A > 4 && (
        <>
          <RadialGradient
            id={bgId}
            fx={0.38}
            fy={0.34}
            stops={[
              [0, inner],
              [0.6, shade(inner, 0.15)],
              [1, shade(inner, 0.4)],
            ]}
          />
          <circle cx={x} cy={y} r={r2((pack.core + 0.6) * rr)} fill={`url(#${bgId})`} aria-hidden />
        </>
      )}
      {pack.list.map((p, i) => (
        <circle
          key={i}
          cx={r2(x + p.x * rr)}
          cy={r2(y + p.y * rr)}
          r={rr}
          fill={`url(#${ids[(p.proton ? 3 : 0) + p.light]})`}
          stroke={SCENE.outline}
          strokeWidth={0.6 * ss}
        />
      ))}
      {signs && <path d={signs} stroke={ROM.tegn} strokeWidth={Math.max(1.2 * ss, rr * 0.18)} strokeLinecap="round" opacity={0.9} aria-hidden />}
    </g>
  );
}

/* ---------- Lys ---------- */

export interface FotonProps {
  /** Starten av bølgepakken. */
  x1: number;
  y1: number;
  /** Spissen av pila. */
  x2: number;
  y2: number;
  /** Bølgelengde i nm: gir fargen og hvor mange svingninger pakken har (kort bølgelengde = flere). Standard 550. */
  bolgelengde?: number;
  /** Utslaget til bølgen i figurens enheter (standard 8). */
  amplitude?: number;
  /** Etikett midt over pakken, f.eks. «hf» eller «γ». */
  label?: ReactNode;
  /** Egen farge i stedet for bølgelengdefargen (f.eks. for γ-stråling, som ikke er synlig lys). */
  farge?: string;
  /** Antall svingninger (standard etter bølgelengden: ca. 4 for rødt, 8 for fiolett, 12 for UV og γ). */
  svingninger?: number;
  /** Fase i radianer: animer for å få bølgen til å bevege seg inne i pakken. */
  fase?: number;
  dim?: boolean;
  title?: string;
}

/**
 * Foton: en bølgepakke med pil, farget etter bølgelengden. Rødt lys får få, lange svingninger og fiolett mange, korte
 * (antallet øker som 1/λ innenfor rimelige grenser), så to fotoner med samme lengde kan sammenlignes. Ultrafiolett og
 * infrarødt får grensefargene. Ankerpunkt: (x1, y1) er halen, (x2, y2) spissen.
 *   <Foton x1={120} y1={60} x2={300} y2={60} bolgelengde={656} label="hf" />
 *   <Foton x1={400} y1={200} x2={520} y2={120} bolgelengde={0.002} farge={VIZ.series[3]} label="γ" />
 */
export function Foton({ x1, y1, x2, y2, bolgelengde = 550, amplitude = 8, label, farge, svingninger, fase = 0, dim, title }: FotonProps) {
  const ss = useStrokeScale();
  const f = useTextScale();
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy);
  if (!Number.isFinite(len) || len < 16) return null;
  const ux = dx / len;
  const uy = dy / len;
  // Ugyldig bølgelengde gir 550 nm både for fargen og for antall svingninger.
  const nm = Number.isFinite(bolgelengde) && bolgelengde > 0 ? bolgelengde : 550;
  const color = farge ?? bolgelengdeFarge(nm, false);
  // Lyse farger (gult, grønt, cyan) får en tydeligere, mørk kant i samme fargetone, så de synes på lys bunn.
  const bright = farge === undefined && lightness(wavelengthRgb(nm, 0.8)) > 0.6;
  const edge = bright ? shade(color, 0.45) : SCENE.outline;
  const edgeOp = bright ? 0.8 : 0.45;
  const hl = Math.min(len * 0.3, 11 * ss);
  const hw = 5.5 * ss;
  const body = len - hl;
  const amp = Math.max(1, Number.isFinite(amplitude) ? amplitude : 8);
  const cyc = clamp(svingninger ?? 3000 / nm, 1.5, Math.max(1.5, Math.min(14, body / (7 * ss))));
  const lam = body / cyc;
  const step = Math.max(1, Math.min(2.5, lam / 10));
  const steps = Math.ceil(body / step);
  let d = '';
  for (let i = 0; i <= steps; i++) {
    const s = (body * i) / steps;
    const e = Math.exp(-(((s / body - 0.5) / 0.27) ** 2));
    const o = amp * e * Math.sin((2 * Math.PI * s) / lam - fase);
    d += `${i === 0 ? 'M' : 'L'}${r2(x1 + ux * s - uy * o)} ${r2(y1 + uy * s + ux * o)}`;
  }
  const bx = x1 + ux * body;
  const by = y1 + uy * body;
  const head = `M${r2(x2)} ${r2(y2)}L${r2(bx - uy * hw)} ${r2(by + ux * hw)}L${r2(bx + uy * hw)} ${r2(by - ux * hw)}Z`;
  // Etiketten på oversida (eller til høyre for loddrette fotoner).
  let nx = -uy;
  let ny = ux;
  if (ny > 0 || (Math.abs(ny) < 0.2 && nx < 0)) {
    nx = -nx;
    ny = -ny;
  }
  const mx = x1 + ux * body * 0.5;
  const my = y1 + uy * body * 0.5;
  const off = amp + 7 + 6 * f;
  return (
    <g opacity={dim ? SCENE_DIM : undefined}>
      {title && <title>{title}</title>}
      <path d={d} fill="none" stroke={color} strokeWidth={7 * ss} strokeLinecap="round" strokeLinejoin="round" opacity={0.18} aria-hidden />
      <path d={d} fill="none" stroke={edge} strokeWidth={3.8 * ss} strokeLinecap="round" strokeLinejoin="round" opacity={edgeOp} aria-hidden />
      <path d={d} fill="none" stroke={color} strokeWidth={2.4 * ss} strokeLinecap="round" strokeLinejoin="round" />
      <path d={head} fill={color} stroke={edge} strokeWidth={(bright ? 1 : 0.8) * ss} strokeLinejoin="round" />
      {label !== undefined && (
        <Txt x={mx + nx * off} y={my + ny * off + (ny < -0.5 ? 0 : 6 * f)} anchor={Math.abs(nx) > 0.5 ? (nx > 0 ? 'start' : 'end') : 'middle'} weight={700}>
          {label}
        </Txt>
      )}
    </g>
  );
}

export interface LysstraaleProps {
  /** Der strålen starter. */
  x1: number;
  y1: number;
  /** Der strålen slutter (eller treffer noe). */
  x2: number;
  y2: number;
  /** Bølgelengde i nm (farget lys). Uten bølgelengde blir strålen hvit. */
  bolgelengde?: number;
  /** Hvitt lys (overstyrer bølgelengden). */
  hvit?: boolean;
  /** Bredden på strålen i figurens enheter (standard 4). Gløden er ca. tre ganger så bred. */
  bredde?: number;
  /** Liten pil midt på som viser retningen (standard på). */
  pil?: boolean;
  /** Lysstyrke 0–1 (standard 1), f.eks. svakere stråle etter et filter. */
  styrke?: number;
  dim?: boolean;
  title?: string;
}

/**
 * Lysstråle: lysende stripe med glød og en liten retningspil, hvit eller farget etter bølgelengden. Tegn flere etter
 * hverandre for brytning og spredning i et prisme. Ankerpunkt: (x1, y1) er starten.
 *   <Lysstraale x1={40} y1={120} x2={200} y2={150} hvit />
 *   <Lysstraale x1={260} y1={160} x2={420} y2={210} bolgelengde={450} bredde={2.5} pil={false} />
 */
export function Lysstraale({ x1, y1, x2, y2, bolgelengde, hvit, bredde = 4, pil = true, styrke = 1, dim, title }: LysstraaleProps) {
  const ss = useStrokeScale();
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy);
  if (!Number.isFinite(len) || len < 2) return null;
  const ux = dx / len;
  const uy = dy / len;
  const nx = -uy;
  const ny = ux;
  const white = hvit || bolgelengde === undefined;
  const c = white ? ROM.hvittLys : bolgelengdeFarge(bolgelengde, false);
  const g = white ? ROM.hvittGlod : c;
  const k = clamp(styrke, 0, 1);
  const b = Math.max(0.8, Number.isFinite(bredde) ? bredde : 4) * Math.max(1, ss * 0.9);
  const W = b * 3.4 + 2 * ss;
  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2;
  const a = b * 1.5 + 5 * ss;
  const tip = [mx + ux * a * 0.6, my + uy * a * 0.6];
  const arrow = `M${r2(tip[0]!)} ${r2(tip[1]!)}L${r2(mx - ux * a * 0.4 + nx * a * 0.55)} ${r2(my - uy * a * 0.4 + ny * a * 0.55)}L${r2(mx - ux * a * 0.4 - nx * a * 0.55)} ${r2(my - uy * a * 0.4 - ny * a * 0.55)}Z`;
  const line = { x1, y1, x2, y2 };
  return (
    <g opacity={dim ? SCENE_DIM : undefined}>
      {title && <title>{title}</title>}
      {/* Gløden: to brede, svake streker med runde ender (myk kant og ingen firkantet slutt) */}
      <line {...line} stroke={g} strokeWidth={r2(W)} strokeLinecap="round" opacity={0.12 * k} aria-hidden />
      <line {...line} stroke={g} strokeWidth={r2(W * 0.58)} strokeLinecap="round" opacity={0.2 * k} aria-hidden />
      <line {...line} stroke={white ? g : shade(c, 0.18)} strokeWidth={b + 1.4 * ss} opacity={(white ? 0.55 : 0.6) * k} />
      <line {...line} stroke={c} strokeWidth={b} opacity={0.35 + 0.65 * k} />
      <line {...line} stroke={tint(c, 0.55)} strokeWidth={b * 0.32} opacity={0.75 * k} aria-hidden />
      {pil && len > a * 3 && <path d={arrow} fill={white ? g : c} stroke={shade(white ? g : c, 0.55)} strokeWidth={1.1 * ss} strokeLinejoin="round" />}
    </g>
  );
}

/* ---------- Spektrum ---------- */

export type SpektrumType = 'kontinuerlig' | 'emisjon' | 'absorpsjon';

/** En spektrallinje: bølgelengden i nm, eller med relativ styrke 0–1. */
export type Spektrallinje = number | { nm: number; styrke?: number };

export interface SpektrumProps {
  /** Øverste venstre hjørne av selve spekteret (skalaen kommer under). */
  x: number;
  y: number;
  w: number;
  h: number;
  /** Kontinuerlig (alle farger), emisjon (lyse linjer på mørk bunn) eller absorpsjon (mørke linjer i regnbuen). */
  type?: SpektrumType;
  /** Linjene i nm (emisjon og absorpsjon), f.eks. hydrogen [410, 434, 486, 656]. */
  linjer?: Spektrallinje[];
  /** Bølgelengden ved venstre kant i nm (standard 380). Under 380 nm tones spekteret ut mot mørkt (UV). */
  fra?: number;
  /** Bølgelengden ved høyre kant i nm (standard 750). Over 750 nm tones det ut (IR). */
  til?: number;
  /**
   * Tall i nm under spekteret. Tar ca. 6 · strekskala + 17 · tekstskala ekstra høyde under stripa: ca. 23 enheter på
   * PC, og opptil ca. 40 i en figur 800 enheter bred på mobil. Sett av plass i viewBox.
   */
  skala?: boolean;
  dim?: boolean;
  title?: string;
}

/**
 * Spektrum som en stripe: kontinuerlig (regnbue), emisjonsspektrum (fargede linjer på mørk bunn) eller
 * absorpsjonsspektrum (mørke linjer i regnbuen). Linjene sitter på riktig bølgelengde, så et emisjons- og et
 * absorpsjonsspektrum for samme stoff kan legges over hverandre. Ankerpunkt: øverste venstre hjørne.
 *   <Spektrum x={40} y={60} w={720} h={40} />
 *   <Spektrum x={40} y={130} w={720} h={40} type="emisjon" linjer={[410, 434, 486, 656]} skala />
 *   <Spektrum x={40} y={220} w={720} h={40} type="absorpsjon" linjer={[{ nm: 589, styrke: 1 }, 656]} />
 */
export function Spektrum({ x, y, w, h, type = 'kontinuerlig', linjer = [], fra = 380, til = 750, skala = false, dim, title }: SpektrumProps) {
  const ss = useStrokeScale();
  const f = useTextScale();
  const gid = useSvgId('rom-spektrum');
  const lo = Math.min(fra, til - 1);
  const hi = Math.max(til, fra + 1);
  const W = Math.max(1, w);
  const H = Math.max(1, h);
  const sx = (nm: number) => x + (W * (nm - lo)) / (hi - lo);
  const stops = useMemo(() => {
    // Knekkpunktene i fargemodellen og ca. hver 15. nm imellom (nok til at toningen blir jevn).
    const at = new Set<number>([lo, hi, 335, 380, 420, 440, 490, 510, 580, 645, 700, 750, 820]);
    const n = Math.max(8, Math.round((hi - lo) / 15));
    for (let i = 1; i < n; i++) at.add(lo + ((hi - lo) * i) / n);
    return [...at]
      .filter((nm) => nm >= lo && nm <= hi)
      .sort((a, b) => a - b)
      .map((nm): GradientStop => {
        const op = nm < 380 ? Math.max(0, 1 - (380 - nm) / 45) : nm > 750 ? Math.max(0, 1 - (nm - 750) / 70) : 1;
        return [Math.round(((nm - lo) / (hi - lo)) * 10000) / 10000, bolgelengdeFarge(nm), op];
      });
  }, [lo, hi]);
  const lines = linjer
    .map((l) => (typeof l === 'number' ? { nm: l, styrke: 1 } : { nm: l.nm, styrke: l.styrke ?? 1 }))
    .filter((l) => Number.isFinite(l.nm) && l.nm >= lo && l.nm <= hi);
  const lw = type === 'emisjon' ? Math.max(2 * ss, W / 170) : Math.max(1.8 * ss, W / 220);
  const ticks = useMemo(() => {
    if (!skala) return [];
    const minGap = 46 * f;
    const step = [10, 20, 25, 50, 100, 200, 500, 1000].find((s) => (s * W) / (hi - lo) >= minGap) ?? 1000;
    const out: number[] = [];
    for (let v = Math.ceil(lo / step) * step; v <= hi + 1e-6; v += step) out.push(v);
    return out;
  }, [skala, f, W, lo, hi]);
  const fs = 17 * f * 0.75;
  const ty = y + H + 6 * ss + fs * 1.05;
  const unitW = fs * 1.4;
  return (
    <g opacity={dim ? SCENE_DIM : undefined}>
      {title && <title>{title}</title>}
      <rect x={x} y={y} width={W} height={H} rx={2} fill={ROM.spektrumBunn} />
      {type !== 'emisjon' && (
        <>
          <LinearGradient id={gid} x1={0} y1={0} x2={1} y2={0} stops={stops} />
          <rect x={x} y={y} width={W} height={H} rx={2} fill={`url(#${gid})`} />
        </>
      )}
      {type === 'emisjon' &&
        lines.map((l, i) => {
          const c = rgbText(wavelengthRgb(l.nm, 0.45));
          const k = clamp(l.styrke, 0.1, 1);
          const lx = sx(l.nm);
          return (
            <g key={i}>
              <rect x={r2(lx - lw * 2.2)} y={y} width={r2(lw * 4.4)} height={H} fill={c} opacity={0.22 * k} aria-hidden />
              <rect x={r2(lx - lw / 2)} y={y} width={r2(lw)} height={H} fill={c} opacity={0.35 + 0.65 * k} />
              <rect x={r2(lx - lw * 0.18)} y={y} width={r2(lw * 0.36)} height={H} fill={tint(c, 0.55)} opacity={0.8 * k} aria-hidden />
            </g>
          );
        })}
      {type === 'absorpsjon' &&
        lines.map((l, i) => (
          <rect key={i} x={r2(sx(l.nm) - lw / 2)} y={y} width={r2(lw)} height={H} fill={ROM.spektrumBunn} opacity={0.25 + 0.65 * clamp(l.styrke, 0, 1)} />
        ))}
      <rect x={x} y={y} width={W} height={H} rx={2} fill="none" stroke={SCENE.outline} strokeWidth={1 * ss} />
      {ticks.length > 0 && (
        <g>
          {ticks.map((v) => (
            <line key={v} x1={r2(sx(v))} y1={y + H} x2={r2(sx(v))} y2={y + H + 5 * ss} stroke={VIZ.muted} strokeWidth={1.1 * ss} />
          ))}
          {ticks.map((v) => {
            const tx = sx(v);
            const half = (String(v).length * 0.58 * fs) / 2;
            // Plass til «nm» ytterst til høyre: hopp over tall som ville kollidert med den.
            if (tx + half > x + W - unitW - 4) return null;
            return (
              <Txt key={v} x={r2(tx)} y={r2(ty)} anchor="middle" size={0.75} muted>
                {v}
              </Txt>
            );
          })}
          <Txt x={x + W} y={r2(ty)} anchor="end" size={0.75} muted>
            nm
          </Txt>
        </g>
      )}
    </g>
  );
}
