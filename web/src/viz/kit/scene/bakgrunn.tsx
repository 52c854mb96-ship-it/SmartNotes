/**
 * Scene-kit, familien «bakgrunn»: himmel, fjernt landskap, trær, underlag, terreng, vei, rom og vann.
 *
 *   <Himmel w={800} h={300} sol={{ x: 120, y: 60 }} skyer={2} />
 *   <Landskap x={0} y={190} w={800} h={130} type="fjell" />
 *   <Underlag x1={0} x2={800} y={230} depth={70} type="gress" horisont={190} />
 *   <Gran x={680} y={228} size={110} />
 *
 * Tegnerekkefølge: himmel, landskap, underlag/vei/terreng, trær, gjenstander, kraftpiler. Bakgrunnene er dempet og
 * naturlige, så VIZ-fargene i pilene står fram. Alle farger er CSS-variabler (SCENE og bakgrunn.css), så mørkt tema
 * blir skumring. Teksturene er deterministiske (fast frø) og ruller med `forskyvning`: gi samme tall (hvor langt
 * «kameraet» har flyttet seg) til Himmel, Landskap, Vei og Underlag, så får du riktig parallakse.
 */
import { memo, useMemo } from 'react';
import './bakgrunn.css';
import {
  ContactShadow,
  LinearGradient,
  Place,
  RadialGradient,
  SCENE_DIM,
  mix,
  sceneRandom,
  shade,
  sphereStops,
  tint,
  useSceneScale,
  useStrokeScale,
  useSvgId,
  type GradientStop,
  type SceneObjectProps,
} from './core';
import { PAINTS, SCENE } from './palette';
import {
  type Pt,
  circle,
  clamp,
  cleanPoints,
  fillDown,
  lerp,
  mod,
  polygon,
  polyline,
  r1,
  r2,
  seedFor,
  shiftPath,
  wavePoints,
  alongPolyline,
} from './bakgrunn-geo';
import { buildLandscape, type LandskapType } from './bakgrunn-landskap';
import { FrontFace, GLINT, GLITTER, TOP_COLOR, TopFace, backEdge, type UnderlagType } from './bakgrunn-flater';

export type { UnderlagType } from './bakgrunn-flater';
export type { LandskapType } from './bakgrunn-landskap';

const STJERNER = 'var(--sc-bakgrunn-stjerner)';
const MIDTLINJE = 'var(--sc-bakgrunn-midtlinje)';
const LIST = 'var(--sc-bakgrunn-list)';
const FLIS = 'var(--sc-bakgrunn-flis)';
const FUGE = 'var(--sc-bakgrunn-fuge)';
const LYSFLEKK = 'var(--sc-bakgrunn-lysflekk)';

/** Hvor mye landskapet flytter seg med forskyvningen (nærmeste lag); fjernere lag flytter seg mindre. */
const LANDSKAP_PARALLAKSE = 0.15;
/** Skyene ligger enda lenger unna. */
const SKY_PARALLAKSE = 0.04;

/**
 * Navn på underlagene til knapper og forklaringer (bokmål, stor forbokstav bare først).
 *   <Segmented value={type} onChange={setType} options={TYPER.map((t) => ({ value: t, label: UNDERLAG_NAVN[t] }))} />
 */
export const UNDERLAG_NAVN: Record<UnderlagType, string> = {
  asfalt: 'Tørr asfalt',
  'vaat-asfalt': 'Våt asfalt',
  sno: 'Snø',
  is: 'Is',
  gress: 'Gress',
  grus: 'Grus',
  betong: 'Betong',
  tregulv: 'Tregulv',
  jord: 'Jord',
  labbenk: 'Labbenk',
};

const a11y = (title?: string) => (title ? { role: 'img' as const } : { 'aria-hidden': true as const });

/* ---------------------------------------------------------------- Himmel */

interface HimmelProps {
  /** Øverste venstre hjørne (standard 0, 0). */
  x?: number;
  y?: number;
  w: number;
  h: number;
  /** Sola: midten (x, y) i figurens enheter og radius r (standard ca. 7 % av den minste siden). */
  sol?: { x: number; y: number; r?: number };
  /** Antall skyer, 0–4 (standard 0). */
  skyer?: number;
  /** Frø for plasseringen av skyene. */
  seed?: number;
  /** Hvor langt «kameraet» har flyttet seg mot høyre; skyene driver svært sakte mot venstre. */
  forskyvning?: number;
  title?: string;
}

interface Cloud {
  cx: number;
  cy: number;
  cw: number;
  d: string;
}

function planClouds(w: number, h: number, n: number, seed: number, sun?: { x: number; y: number; r: number }): Cloud[] {
  const rand = sceneRandom(seedFor(seed, 'skyer'));
  const out: Cloud[] = [];
  for (let i = 0; i < n; i++) {
    const cw = clamp(w * 0.17, 46, 190) * (0.75 + rand() * 0.5);
    const ch = cw / 2.6;
    let cx = (w / n) * (i + 0.2 + rand() * 0.6);
    const cy = h * (0.18 + rand() * 0.24) + ch * 0.5;
    if (sun && Math.abs(cx - sun.x) < cw * 0.55 + sun.r && Math.abs(cy - ch / 2 - sun.y) < ch * 0.6 + sun.r) {
      cx = mod(cx + cw * 0.7 + sun.r * 2, w);
    }
    // Haug-sky med flat bunn: fire «puter» og et rektangel, med klokka så de smelter sammen i én sti.
    const j = () => 0.88 + rand() * 0.24;
    const puffs: [number, number, number][] = [
      [-0.36 * cw, -0.3 * ch * j(), 0.3 * ch * j()],
      [-0.12 * cw, -0.5 * ch, 0.5 * ch * j()],
      [0.14 * cw, -0.44 * ch, 0.42 * ch * j()],
      [0.36 * cw, -0.27 * ch, 0.27 * ch * j()],
    ];
    let d = polygon([
      [-0.36 * cw, -0.3 * ch],
      [0.36 * cw, -0.27 * ch],
      [0.36 * cw, 0],
      [-0.36 * cw, 0],
    ]);
    for (const [px, py, pr] of puffs) d += circle(px, Math.min(py, -pr), pr);
    out.push({ cx, cy, cw, d });
  }
  return out;
}

function starPath(w: number, h: number, seed: number): string {
  const rand = sceneRandom(seedFor(seed, 'stjerner'));
  let d = '';
  const n = Math.round(clamp(w / 45, 6, 22));
  for (let i = 0; i < n; i++) d += circle(rand() * w, rand() * h * 0.42, 0.5 + rand() * 0.8);
  return d;
}

/**
 * Himmel med toning fra SCENE.skyTop øverst til skyBottom ved horisonten, valgfri sol med glød og noen få
 * haugskyer. I mørkt tema er det skumring, med et par svake stjerner.
 *   <Himmel w={800} h={260} sol={{ x: 140, y: 70 }} skyer={2} />
 * Tegnes først; landskap og underlag legges oppå.
 */
export const Himmel = memo(function Himmel({ x = 0, y = 0, w, h, sol, skyer = 0, seed = 1, forskyvning = 0, title }: HimmelProps) {
  const sky = useSvgId('sc-himmel');
  const clip = useSvgId('sc-himmelklipp');
  const glow = useSvgId('sc-solglod');
  const disc = useSvgId('sc-sol');
  const cloud = useSvgId('sc-sky');
  const n = Math.round(clamp(skyer, 0, 4));
  const R = sol ? (sol.r !== undefined && sol.r > 0 ? sol.r : clamp(Math.min(w, h) * 0.07, 8, 40)) : 0;
  const sx = sol ? sol.x - x : 0;
  const sy = sol ? sol.y - y : 0;
  const hasSun = !!sol;
  const clouds = useMemo(() => planClouds(w, h, n, seed, hasSun ? { x: sx, y: sy, r: R } : undefined), [w, h, n, seed, hasSun, sx, sy, R]);
  const stars = useMemo(() => starPath(w, h, seed), [w, h, seed]);
  if (!(w > 0) || !(h > 0)) return null;
  const drift = (Number.isFinite(forskyvning) ? forskyvning : 0) * SKY_PARALLAKSE;
  return (
    <g {...a11y(title)}>
      {title && <title>{title}</title>}
      <LinearGradient
        id={sky}
        userSpace
        x1={0}
        y1={y}
        x2={0}
        y2={y + h}
        stops={[
          [0, SCENE.skyTop],
          [1, SCENE.skyBottom],
        ]}
      />
      <clipPath id={clip}>
        <rect x={x} y={y} width={w} height={h} />
      </clipPath>
      <rect x={x} y={y} width={w} height={h} fill={`url(#${sky})`} />
      <g clipPath={`url(#${clip})`}>
        <path d={stars} transform={`translate(${r1(x)} ${r1(y)})`} fill={SCENE.star} style={{ opacity: STJERNER }} />
        {sol && Number.isFinite(sol.x) && Number.isFinite(sol.y) && (
          <g>
            <RadialGradient
              id={glow}
              stops={[
                [0, SCENE.sunGlow, 0.95],
                [0.28, SCENE.sunGlow, 0.55],
                [1, SCENE.sunGlow, 0],
              ]}
            />
            <circle cx={sol.x} cy={sol.y} r={R * 4.2} fill={`url(#${glow})`} />
            <RadialGradient
              id={disc}
              fx={0.4}
              fy={0.38}
              stops={[
                [0, tint(SCENE.sun, 0.55)],
                [0.7, SCENE.sun],
                [1, shade(SCENE.sun, 0.04)],
              ]}
            />
            <circle cx={sol.x} cy={sol.y} r={R} fill={`url(#${disc})`} />
          </g>
        )}
        {clouds.length > 0 && (
          <LinearGradient
            id={cloud}
            stops={[
              [0, tint(SCENE.cloud, 0.3)],
              [0.55, SCENE.cloud],
              [1, SCENE.cloudShade],
            ]}
          />
        )}
        {clouds.map((c, i) => {
          const cx = mod(c.cx - drift + c.cw, w + 2 * c.cw) - c.cw;
          return <path key={i} d={c.d} transform={`translate(${r1(x + cx)} ${r1(y + c.cy)})`} fill={`url(#${cloud})`} />;
        })}
      </g>
    </g>
  );
});

/* ---------------------------------------------------------------- Landskap */

interface LandskapProps {
  /** Venstre kant. */
  x: number;
  /** Horisontlinjen (foten av landskapet). Sett den der underlaget begynner, så det ikke blir glipe. */
  y: number;
  w: number;
  /** Høyden over horisonten landskapet får bruke (de høyeste toppene). */
  h: number;
  type: LandskapType;
  seed?: number;
  /** Hvor langt «kameraet» har flyttet seg mot høyre; lagene ruller sømløst mot venstre (de fjerne saktere). */
  forskyvning?: number;
  title?: string;
}

/**
 * Fjern bakgrunn med luftperspektiv: lagene blir blekere og blåere jo lenger unna de er.
 * `type`: «fjell» (snødekte topper og granskog i liene), «aaser» (åser med granholt og en gård), «skog»
 * (granskog i tre lag), «by» (blokker, trehus og kirke) eller «kyst» (fjord med fjell som speiler seg).
 *   <Landskap x={0} y={200} w={800} h={140} type="kyst" />
 * Ankerpunkt: (x, y) er venstre ende av horisontlinjen; landskapet fyller fra y og opp til y − h.
 */
export const Landskap = memo(function Landskap({ x, y, w, h, type, seed = 1, forskyvning = 0, title }: LandskapProps) {
  const shift = Number.isFinite(forskyvning) ? forskyvning : 0;
  const rolling = shift !== 0;
  // Når landskapet ruller, ligger to perioder etter hverandre i samme sti (ingen søm mellom kopier).
  const layers = useMemo(() => {
    const one = buildLandscape(type, w, h, seed);
    if (!rolling) return one;
    return one.map((L) => ({
      ...L,
      d: L.d + shiftPath(L.d, w),
      parts: L.parts.map((p) => ({ ...p, d: p.d + shiftPath(p.d, w) })),
    }));
  }, [type, w, h, seed, rolling]);
  const clip = useSvgId('sc-landskap');
  const base = useSvgId('sc-lag');
  if (!layers.length || !Number.isFinite(x) || !Number.isFinite(y)) return null;
  return (
    <g {...a11y(title)}>
      {title && <title>{title}</title>}
      <clipPath id={clip}>
        <rect x={x} y={y - h - 4} width={w} height={h + 5} />
      </clipPath>
      <g clipPath={`url(#${clip})`}>
        {layers.map((L, i) => {
          const id = `${base}-${i}`;
          const o = rolling ? -mod(shift * L.parallax * LANDSKAP_PARALLAKSE, w) : 0;
          return (
            <g key={i}>
              {/* Silhuetten står én gang i defs og brukes til fyll, klipp og dis (mindre stidata). */}
              <defs>
                <path id={`${id}s`} d={L.d} />
              </defs>
              <clipPath id={`${id}c`}>
                <use href={`#${id}s`} />
              </clipPath>
              <LinearGradient
                id={`${id}h`}
                userSpace
                x1={0}
                y1={L.top}
                x2={0}
                y2={0}
                stops={[
                  [0, SCENE.skyBottom, L.haze[0]],
                  [1, SCENE.skyBottom, L.haze[1]],
                ]}
              />
              <g transform={`translate(${r1(x + o)} ${r1(y)})`}>
                <use href={`#${id}s`} fill={L.fill} />
                <g clipPath={`url(#${id}c)`}>
                  {L.parts.map((p, k) =>
                    p.d ? (
                      <path key={k} d={p.d} fill={p.fill ?? 'none'} stroke={p.stroke} strokeWidth={p.strokeWidth} opacity={p.opacity} transform={p.transform} />
                    ) : null,
                  )}
                </g>
                <use href={`#${id}s`} fill={`url(#${id}h)`} />
              </g>
            </g>
          );
        })}
      </g>
    </g>
  );
});

/* ---------------------------------------------------------------- Trær */

interface GranProps extends SceneObjectProps {
  /** Snø på greinene (vinter). */
  sno?: boolean;
  /** Frø for små variasjoner i formen, så en rad med graner ikke blir like. */
  seed?: number;
}

function quad(a: Pt, c: Pt, b: Pt, t: number): Pt {
  const u = 1 - t;
  return [u * u * a[0] + 2 * u * t * c[0] + t * t * b[0], u * u * a[1] + 2 * u * t * c[1] + t * t * b[1]];
}

function granGeometry(H: number, seed: number) {
  const rand = sceneRandom(seedFor(seed, 'gran'));
  const n = H >= 70 ? 7 : H >= 36 ? 6 : 5;
  const top = -H;
  const bot = -0.09 * H;
  const len = bot - top;
  const W2 = 0.2 * H;
  const tiers: string[] = [];
  let light = '';
  let snow = '';
  for (let i = 0; i < n; i++) {
    const f0 = i === 0 ? 0 : (i / n) * 0.9;
    const f1 = (i + 1) / n;
    const ay = top + len * f0;
    const by = top + len * f1;
    const th = by - ay;
    const hwR = W2 * (0.22 + 0.78 * f1) * (0.94 + rand() * 0.12);
    const hwL = W2 * (0.22 + 0.78 * f1) * (0.94 + rand() * 0.12);
    const A: Pt = [0, ay];
    const R: Pt = [hwR, by + th * 0.05];
    const Lp: Pt = [-hwL, by + th * 0.05];
    const cR: Pt = [hwR * 0.6, ay + th * 0.42];
    const cL: Pt = [-hwL * 0.6, ay + th * 0.42];
    const under: Pt[] = [
      R,
      [hwR * 0.64, by - th * (0.1 + rand() * 0.08)],
      [hwR * 0.28, by + th * 0.02],
      [0, by - th * (0.12 + rand() * 0.06)],
      [-hwL * 0.28, by + th * 0.02],
      [-hwL * 0.64, by - th * (0.1 + rand() * 0.08)],
      Lp,
    ];
    let d = `M0,${r2(ay)}Q${r2(cR[0])},${r2(cR[1])} ${r2(R[0])},${r2(R[1])}`;
    for (let j = 1; j < under.length; j++) {
      const a = under[j - 1]!;
      const b = under[j]!;
      d += `Q${r2((a[0] + b[0]) / 2)},${r2(Math.max(a[1], b[1]) + th * 0.12)} ${r2(b[0])},${r2(b[1])}`;
    }
    d += `Q${r2(cL[0])},${r2(cL[1])} 0,${r2(ay)}Z`;
    tiers.push(d);

    // Lys kant langs venstre side av hver etasje
    const lp: Pt[] = [];
    for (let s = 0; s <= 4; s++) {
      const p = quad(A, cL, Lp, 0.08 + (s / 4) * 0.5);
      lp.push([p[0] + 1, p[1] + 0.6]);
    }
    light += polyline(lp);

    // Snø på oversiden av greinene
    const st = clamp(th * 0.3, 0.8, 7);
    const upper: Pt[] = [];
    const lower: Pt[] = [];
    const steps = 6;
    for (let s = steps; s >= 0; s--) {
      const t = 0.88 * (s / steps);
      upper.push(quad(A, cL, Lp, t));
    }
    for (let s = 1; s <= steps; s++) {
      const t = 0.88 * (s / steps);
      upper.push(quad(A, cR, R, t));
    }
    for (let s = upper.length - 1; s >= 0; s--) {
      const p = upper[s]!;
      const edge = Math.abs(s - steps) / steps;
      lower.push([p[0], p[1] + st * (0.45 + 0.55 * (1 - edge)) * (0.75 + rand() * 0.5)]);
    }
    snow += polygon([...upper.map((p): Pt => [p[0], p[1] - 0.3]), ...lower]);
  }
  const tw = 0.028 * H;
  const trunk = `M${r2(-tw * 1.35)},0Q${r2(-tw)},${r2(-0.02 * H)} ${r2(-tw * 0.85)},${r2(-0.16 * H)}L${r2(tw * 0.85)},${r2(-0.16 * H)}Q${r2(tw)},${r2(-0.02 * H)} ${r2(tw * 1.35)},0Z`;
  return { tiers: tiers.slice().reverse(), all: tiers.join(''), light, snow, trunk };
}

/**
 * Gran i forgrunnen: smal kjegle med greiner i etasjer, lys fra venstre og myk skygge på bakken.
 * `size` er høyden (bredden blir ca. 0,4 · høyden, som en frittstående gran).
 *   <Gran x={640} y={250} size={120} sno />
 * Ankerpunkt: foten av stammen (midt på bakken). Trær står loddrett, også i en bakke (ikke bruk `rotate` der).
 */
export const Gran = memo(function Gran({ x, y, size = 120, rotate, flip, dim, title, sno = false, seed = 1 }: GranProps) {
  const ss = useStrokeScale();
  const H = Math.max(8, size);
  const g = useMemo(() => granGeometry(H, seed), [H, seed]);
  const fill = useSvgId('sc-gran');
  const bark = useSvgId('sc-granstamme');
  const snowG = useSvgId('sc-gransno');
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  return (
    <Place x={x} y={y} rotate={rotate} flip={flip} opacity={dim ? SCENE_DIM : undefined}>
      <g {...a11y(title)}>
        {title && <title>{title}</title>}
        <ContactShadow cx={0} cy={0} rx={H * 0.22} ry={Math.max(2, H * 0.03)} />
        <LinearGradient
          id={bark}
          x2={1}
          y2={0}
          stops={[
            [0, tint(SCENE.trunk, 0.15)],
            [1, shade(SCENE.trunk, 0.35)],
          ]}
        />
        <path d={g.trunk} fill={`url(#${bark})`} stroke={SCENE.outline} strokeWidth={0.9 * ss} />
        <LinearGradient
          id={fill}
          x2={1}
          y2={1}
          stops={[
            [0, tint(SCENE.foliage, 0.16)],
            [0.5, SCENE.foliage],
            [1, shade(SCENE.foliageDark, 0.12)],
          ]}
        />
        <path d={g.all} fill={SCENE.outline} stroke={SCENE.outline} strokeWidth={2 * ss} strokeLinejoin="round" />
        {g.tiers.map((d, i) => (
          <path key={i} d={d} fill={`url(#${fill})`} stroke={shade(SCENE.foliageDark, 0.3)} strokeWidth={0.8 * ss} strokeLinejoin="round" />
        ))}
        <path d={g.light} fill="none" stroke={tint(SCENE.foliage, 0.42)} strokeWidth={1.2 * ss} strokeLinecap="round" opacity={0.55} />
        {sno && (
          <>
            <LinearGradient
              id={snowG}
              x2={1}
              y2={0}
              stops={[
                [0, tint(SCENE.snow, 0.3)],
                [1, SCENE.snowShade],
              ]}
            />
            <path d={g.snow} fill={`url(#${snowG})`} stroke={shade(SCENE.snowShade, 0.15)} strokeWidth={0.6 * ss} strokeLinejoin="round" />
          </>
        )}
      </g>
    </Place>
  );
});

interface LauvtreProps extends SceneObjectProps {
  /** «sommer» (grønn, standard), «host» (gult og oransje løv) eller «vinter» (bare greiner). */
  sesong?: 'sommer' | 'host' | 'vinter';
  /** Røde epler i krona (f.eks. til fritt fall). */
  epler?: boolean;
  /** Frø for små variasjoner i krona. */
  seed?: number;
}

interface Clump {
  cx: number;
  cy: number;
  r: number;
}

function lauvGeometry(H: number, seed: number) {
  const rand = sceneRandom(seedFor(seed, 'lauvtre'));
  const C = -0.635 * H;
  const j = () => (rand() - 0.5) * 0.024 * H;
  const mk = ([cx, cy, r]: [number, number, number]): Clump => ({ cx: cx * H + j(), cy: C + cy * H + j(), r: r * H * (0.94 + rand() * 0.12) });
  const back = (
    [
      [-0.2, 0.05, 0.15],
      [0.21, 0.03, 0.15],
      [0.03, -0.21, 0.155],
      [-0.12, -0.17, 0.13],
      [0.15, -0.15, 0.12],
    ] as [number, number, number][]
  ).map(mk);
  const front = (
    [
      [-0.02, -0.2, 0.13],
      [-0.14, -0.05, 0.17],
      [0.13, -0.08, 0.165],
      [-0.255, 0.1, 0.105],
      [0.255, 0.115, 0.1],
      [0.0, 0.09, 0.165],
    ] as [number, number, number][]
  ).map(mk);
  let all = '';
  for (const c of [...back, ...front]) all += circle(c.cx, c.cy, c.r);
  // Små buer som antyder løv: lyse oppe til venstre, mørke nede til høyre i hver klump foran
  let leafL = '';
  let leafD = '';
  const s = 0.022 * H;
  for (const c of front) {
    for (let k = 0; k < 2; k++) {
      const a = -2.4 + rand() * 0.9;
      const rr = c.r * (0.45 + rand() * 0.3);
      const lx = c.cx + Math.cos(a) * rr;
      const ly = c.cy + Math.sin(a) * rr;
      leafL += `M${r2(lx - s)},${r2(ly)}q${r2(s)},${r2(-s * 0.9)} ${r2(2 * s)},0`;
    }
    const a = 0.5 + rand() * 0.6;
    const rr = c.r * (0.5 + rand() * 0.25);
    leafD += `M${r2(c.cx + Math.cos(a) * rr - s)},${r2(c.cy + Math.sin(a) * rr)}q${r2(s)},${r2(-s * 0.9)} ${r2(2 * s)},0`;
  }
  // Epler
  const apples: Clump[] = [];
  for (let k = 0; k < 6; k++) {
    const c = front[k % front.length]!;
    const a = rand() * Math.PI * 2;
    const rr = c.r * (0.25 + rand() * 0.45);
    apples.push({ cx: c.cx + Math.cos(a) * rr, cy: c.cy + Math.sin(a) * rr, r: 0.03 * H });
  }
  // Stamme som deler seg i greiner inn i krona
  const bw = 0.04 * H;
  const tw = 0.026 * H;
  const fy = -0.4 * H;
  const trunk = `M${r2(-bw * 1.45)},0Q${r2(-bw)},${r2(-0.025 * H)} ${r2(-bw * 0.95)},${r2(-0.1 * H)}L${r2(-tw)},${r2(fy)}L${r2(tw)},${r2(fy)}L${r2(bw * 0.95)},${r2(-0.1 * H)}Q${r2(bw)},${r2(-0.025 * H)} ${r2(bw * 1.45)},0Z`;
  const branches =
    `M0,${r2(fy + 0.02 * H)}Q${r2(-0.04 * H)},${r2(fy - 0.08 * H)} ${r2(-0.13 * H)},${r2(fy - 0.2 * H)}` +
    `M0,${r2(fy + 0.01 * H)}Q${r2(0.05 * H)},${r2(fy - 0.1 * H)} ${r2(0.12 * H)},${r2(fy - 0.22 * H)}` +
    `M0,${r2(fy)}Q${r2(0.012 * H)},${r2(fy - 0.12 * H)} ${r2(-0.01 * H)},${r2(fy - 0.25 * H)}`;
  // Vinter: greiner som deler seg tre–fire ganger
  const twigs: [string, string, string] = ['', '', ''];
  const grow = (px: number, py: number, ang: number, l: number, depth: number) => {
    const ex = px + Math.sin(ang) * l;
    const ey = py - Math.cos(ang) * l;
    const bend = (rand() - 0.5) * l * 0.35;
    const cx = (px + ex) / 2 + Math.cos(ang) * bend;
    const cy = (py + ey) / 2 + Math.sin(ang) * bend;
    twigs[Math.min(2, depth)] += `M${r2(px)},${r2(py)}Q${r2(cx)},${r2(cy)} ${r2(ex)},${r2(ey)}`;
    if (depth >= 4) return;
    const spread = 0.34 + rand() * 0.24;
    grow(ex, ey, ang - spread, l * (0.66 + rand() * 0.12), depth + 1);
    grow(ex, ey, ang + spread, l * (0.66 + rand() * 0.12), depth + 1);
    if (depth === 0 && rand() < 0.7) grow(ex, ey, ang + (rand() - 0.5) * 0.3, l * 0.6, depth + 2);
  };
  grow(0, fy + 0.02 * H, -0.5, 0.22 * H, 0);
  grow(0, fy + 0.02 * H, 0.03, 0.24 * H, 0);
  grow(0, fy + 0.02 * H, 0.52, 0.21 * H, 0);
  return { back, front, all, leafL, leafD, apples, trunk, branches, twigs };
}

/**
 * Lauvtre i forgrunnen: rund, klumpete krone (lys fra øvre venstre) på en stamme som deler seg i greiner.
 * `size` er høyden (krona er ca. 0,7 · høyden bred, stammen synes nederste tredjedel).
 *   <Lauvtre x={120} y={250} size={140} epler />
 *   <Lauvtre x={300} y={250} size={110} sesong="host" />
 * Ankerpunkt: foten av stammen. Med `epler` sitter eplene ca. 0,4 · size – size over bakken.
 */
export const Lauvtre = memo(function Lauvtre({ x, y, size = 110, rotate, flip, dim, title, sesong = 'sommer', epler = false, seed = 1 }: LauvtreProps) {
  const ss = useStrokeScale();
  const H = Math.max(8, size);
  const g = useMemo(() => lauvGeometry(H, seed), [H, seed]);
  const fa = useSvgId('sc-lauv-a');
  const fb = useSvgId('sc-lauv-b');
  const fk = useSvgId('sc-lauv-bak');
  const bark = useSvgId('sc-lauvstamme');
  const apple = useSvgId('sc-eple');
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  const autumn = sesong === 'host';
  const winter = sesong === 'vinter';
  const f1 = autumn ? mix(SCENE.gold, PAINTS.oransje, 0.5) : SCENE.foliage;
  const f2 = autumn ? mix(SCENE.gold, SCENE.foliage, 0.22) : SCENE.foliage;
  const fBack = autumn ? mix(PAINTS.oransje, PAINTS.rod, 0.35) : SCENE.foliage;
  const front = (c: string): GradientStop[] => [
    [0, tint(c, 0.3)],
    [0.55, c],
    [1, shade(c, 0.24)],
  ];
  return (
    <Place x={x} y={y} rotate={rotate} flip={flip} opacity={dim ? SCENE_DIM : undefined}>
      <g {...a11y(title)}>
        {title && <title>{title}</title>}
        <ContactShadow cx={0} cy={0} rx={H * (winter ? 0.16 : 0.3)} ry={Math.max(2, H * 0.035)} />
        <LinearGradient
          id={bark}
          x2={1}
          y2={0}
          stops={[
            [0, tint(SCENE.trunk, 0.2)],
            [0.55, SCENE.trunk],
            [1, shade(SCENE.trunk, 0.32)],
          ]}
        />
        {winter ? (
          <>
            <path d={g.twigs[2]} fill="none" stroke={SCENE.trunk} strokeWidth={Math.max(0.7 * ss, 0.008 * H)} strokeLinecap="round" />
            <path d={g.twigs[1]} fill="none" stroke={SCENE.trunk} strokeWidth={Math.max(0.9 * ss, 0.016 * H)} strokeLinecap="round" />
            <path d={g.twigs[0]} fill="none" stroke={SCENE.outline} strokeWidth={0.028 * H + 1.6 * ss} strokeLinecap="round" />
            <path d={g.twigs[0]} fill="none" stroke={shade(SCENE.trunk, 0.1)} strokeWidth={0.028 * H} strokeLinecap="round" />
            <path d={g.trunk} fill={`url(#${bark})`} stroke={SCENE.outline} strokeWidth={0.9 * ss} />
          </>
        ) : (
          <>
            <path d={g.branches} fill="none" stroke={SCENE.outline} strokeWidth={0.034 * H + 1.6 * ss} strokeLinecap="round" />
            <path d={g.trunk} fill={`url(#${bark})`} stroke={SCENE.outline} strokeWidth={0.9 * ss} />
            <path d={g.branches} fill="none" stroke={shade(SCENE.trunk, 0.08)} strokeWidth={0.034 * H} strokeLinecap="round" />
            <RadialGradient id={fa} fx={0.36} fy={0.3} stops={front(f1)} />
            <RadialGradient id={fb} fx={0.36} fy={0.3} stops={front(f2)} />
            <RadialGradient
              id={fk}
              fx={0.4}
              fy={0.35}
              stops={[
                [0, shade(fBack, 0.04)],
                [0.6, shade(fBack, 0.16)],
                [1, shade(fBack, 0.32)],
              ]}
            />
            <path d={g.all} fill={SCENE.outline} stroke={SCENE.outline} strokeWidth={2 * ss} />
            {g.back.map((c, i) => (
              <circle key={`b${i}`} cx={c.cx} cy={c.cy} r={c.r} fill={`url(#${fk})`} />
            ))}
            {g.front.map((c, i) => (
              <circle key={`f${i}`} cx={c.cx} cy={c.cy} r={c.r} fill={`url(#${i % 2 ? fb : fa})`} />
            ))}
            <path d={g.leafD} fill="none" stroke={shade(f1, 0.35)} strokeWidth={0.9 * ss} strokeLinecap="round" opacity={0.55} />
            <path d={g.leafL} fill="none" stroke={tint(f1, 0.5)} strokeWidth={0.9 * ss} strokeLinecap="round" opacity={0.7} />
            {epler && (
              <>
                <RadialGradient id={apple} fx={0.35} fy={0.3} stops={sphereStops(PAINTS.rod)} />
                {g.apples.map((a, i) => (
                  <circle key={`e${i}`} cx={a.cx} cy={a.cy} r={a.r} fill={`url(#${apple})`} stroke={shade(PAINTS.rod, 0.4)} strokeWidth={0.6 * ss} />
                ))}
              </>
            )}
          </>
        )}
      </g>
    </Place>
  );
});

/* ---------------------------------------------------------------- Underlag */

interface UnderlagProps {
  /** Venstre og høyre ende. */
  x1: number;
  x2: number;
  /** Overflaten der ting står (ankerpunktet til gjenstandene og ContactShadow). */
  y: number;
  /** Hvor langt underlaget går ned under overflaten (figurens enheter, standard 40). */
  depth?: number;
  type: UnderlagType;
  seed?: number;
  /**
   * Bakkanten av toppflaten, f.eks. horisonten i Landskap. Da fyller underlaget helt opp til bakgrunnen, med
   * perspektiv (mindre tekstur bak) og dis. Uten: en smal toppflate rundt y.
   */
  horisont?: number;
  /** Hvor langt «kameraet» har flyttet seg mot høyre; teksturen ruller mot venstre (for ting som står stille i bildet). */
  forskyvning?: number;
  title?: string;
}

/**
 * Vannrett underlag sett litt ovenfra og fra siden: en lys toppflate og et snitt (forsiden) under, med subtil tekstur
 * som gjør typen gjenkjennelig (våt asfalt speiler himmelen, is er blank med glans, snø har myk kant og glitter,
 * gress har strå og torv over jord, labbenken har skapdører).
 *   <Underlag x1={0} x2={800} y={240} type="is" />
 *   <Underlag x1={0} x2={800} y={240} depth={60} type="gress" horisont={190} />
 * Ankerpunkt: overflaten y; toppflaten går litt over og under y (ca. ± 5), forsiden ned til y + depth.
 * Bruk UNDERLAG_NAVN[type] i knapper og forklaringer.
 */
export const Underlag = memo(function Underlag({ x1, x2, y, depth = 40, type, seed = 1, horisont, forskyvning = 0, title }: UnderlagProps) {
  const ss = useStrokeScale();
  const k = useSceneScale();
  const left = Math.min(x1, x2);
  const right = Math.max(x1, x2);
  if (!(right > left) || !Number.isFinite(y)) return null;
  const D = Math.max(2, Number.isFinite(depth) ? depth : 40);
  const T = clamp(D * 0.3, 5, 12);
  const deep = horisont !== undefined && Number.isFinite(horisont) && horisont < y - 1;
  const top = deep ? horisont : y - T * 0.45;
  const front = Math.min(y + T * 0.55, y + D);
  const bottom = y + D;
  const shift = Number.isFinite(forskyvning) ? forskyvning : 0;
  const edge = deep ? null : backEdge(type, left, right, top, shift, seed, k);
  const shiny = type === 'is' || type === 'vaat-asfalt' || type === 'labbenk';
  const face = { type, left, right, seed, shift, k, ss };
  return (
    <g {...a11y(title)}>
      {title && <title>{title}</title>}
      <TopFace {...face} top={top} bottom={front} haze={deep} />
      <FrontFace {...face} top={front} bottom={bottom} />
      {edge && edge.length > 2 && (
        <path d={`${polyline(edge)}L${r1(right)},${r1(top + 1.5)}L${r1(left)},${r1(top + 1.5)}Z`} fill={type === 'sno' ? tint(SCENE.snow, 0.3) : tint(TOP_COLOR[type], 0.08)} />
      )}
      <path d={`M${r1(left)},${r1(front)}H${r1(right)}`} stroke={shiny ? GLITTER : SCENE.highlight} strokeWidth={1.2 * ss} opacity={shiny ? 0.5 : 0.6} />
      <path d={`M${r1(left)},${r1(front + 1.1 * ss)}H${r1(right)}`} stroke={SCENE.outline} strokeWidth={0.7 * ss} opacity={0.35} />
      <path
        d={edge ? `M${r1(left)},${r1(bottom)}V${r1(edge[0]![1])}${polyline(edge).replace(/^M/, 'L')}V${r1(bottom)}` : `M${r1(left)},${r1(top)}V${r1(bottom)}M${r1(right)},${r1(top)}V${r1(bottom)}`}
        fill="none"
        stroke={SCENE.outline}
        strokeWidth={0.9 * ss}
        strokeLinejoin="round"
      />
    </g>
  );
});

/* ---------------------------------------------------------------- Terreng */

interface TerrengProps {
  /** Overflaten fra venstre til høyre, [x, y] i figurens enheter. Tåler bratte partier og mange punkter. */
  points: readonly (readonly [number, number])[];
  /** y for bunnen (fyllet går rett ned hit fra endepunktene). */
  bottom: number;
  type: UnderlagType;
  seed?: number;
  title?: string;
}

interface TerrainMaterial {
  body: [string, string];
  /** Tykkelsen på et lag langs overflaten (asfalt på en bakke, gulv på en rampe), 0 = ingen. */
  band: number;
  bandColor?: string;
  seam?: string;
  rim: string;
  rimOpacity: number;
}

const TERRAIN: Record<UnderlagType, TerrainMaterial> = {
  gress: { body: [tint(SCENE.grass, 0.04), SCENE.grassDark], band: 0, rim: tint(SCENE.grass, 0.4), rimOpacity: 0.9 },
  sno: { body: [tint(SCENE.snow, 0.2), SCENE.snowShade], band: 0, rim: GLITTER, rimOpacity: 1 },
  is: { body: [mix(SCENE.ice, SCENE.iceShine, 0.3), shade(SCENE.ice, 0.3)], band: 0, rim: GLITTER, rimOpacity: 0.95 },
  jord: { body: [SCENE.soil, SCENE.soilDark], band: 0, rim: tint(SCENE.soil, 0.3), rimOpacity: 0.8 },
  grus: { body: [SCENE.gravel, SCENE.gravelDark], band: 0, rim: tint(SCENE.gravel, 0.35), rimOpacity: 0.8 },
  asfalt: {
    body: [SCENE.grass, SCENE.grassDark],
    band: 6,
    bandColor: SCENE.asphalt,
    seam: SCENE.asphaltDark,
    rim: tint(SCENE.asphalt, 0.3),
    rimOpacity: 0.8,
  },
  'vaat-asfalt': {
    body: [SCENE.grass, SCENE.grassDark],
    band: 6,
    bandColor: SCENE.asphaltWet,
    seam: shade(SCENE.asphaltWet, 0.3),
    rim: SCENE.skyBottom,
    rimOpacity: 0.75,
  },
  betong: { body: [SCENE.concrete, SCENE.concreteDark], band: 5, bandColor: tint(SCENE.concrete, 0.12), seam: SCENE.concreteDark, rim: tint(SCENE.concrete, 0.4), rimOpacity: 0.8 },
  tregulv: { body: [SCENE.wood, SCENE.woodDark], band: 5, bandColor: SCENE.floor, seam: SCENE.floorDark, rim: tint(SCENE.floor, 0.35), rimOpacity: 0.8 },
  labbenk: { body: [SCENE.benchEdge, shade(SCENE.benchEdge, 0.2)], band: 5, bandColor: SCENE.bench, seam: shade(SCENE.benchEdge, 0.2), rim: GLITTER, rimOpacity: 0.6 },
};

/** Tekstur langs overflaten av et terreng: én sti per farge, inne i terrenget (klippes) eller over det. */
function terrainMarks(pts: Pt[], type: UnderlagType, seed: number, k: number) {
  const rand = sceneRandom(seedFor(seed, `terreng:${type}`));
  type Mark = { d: string; fill?: string; stroke?: string; width?: number; opacity: number };
  const inner: Mark[] = [];
  const outer: Mark[] = [];
  const at = (spacing: number) => alongPolyline(pts, spacing * k, rand);
  // Innover i terrenget (normalen ned/inn) og oppover (loddrett)
  const into = (p: { x: number; y: number; tx: number; ty: number }, dist: number): Pt => [p.x - p.ty * dist, p.y + p.tx * dist];
  const dots = (spacing: number, dMin: number, dMax: number, rMin: number, rMax: number, flat = 0.65) => {
    let d = '';
    for (const p of at(spacing)) {
      const r = (rMin + (rMax - rMin) * rand()) * k;
      const [cx, cy] = into(p, lerp(dMin, dMax, rand()) + r);
      d += `M${r2(cx - r)},${r2(cy)}a${r2(r)},${r2(r * flat)} 0 1,1 ${r2(2 * r)},0a${r2(r)},${r2(r * flat)} 0 1,1 ${r2(-2 * r)},0Z`;
    }
    return d;
  };
  switch (type) {
    case 'gress': {
      let dark = '';
      let light = '';
      for (const p of at(6)) {
        if (Math.abs(p.ty) > 0.8) continue;
        const s = (0.9 + rand() * 0.9) * k;
        const x = p.x;
        const y = p.y + 0.8;
        const t = `M${r2(x - s)},${r2(y)}l${r2(0.45 * s)},${r2(-1.8 * s)}l${r2(0.2 * s)},${r2(1.8 * s)}l${r2(0.4 * s)},${r2(-2.3 * s)}l${r2(0.25 * s)},${r2(2.3 * s)}l${r2(0.45 * s)},${r2(-1.6 * s)}`;
        if (rand() < 0.5) dark += t;
        else light += t;
      }
      outer.push({ d: dark, stroke: SCENE.grassDark, width: 0.8, opacity: 0.95 });
      outer.push({ d: light, stroke: tint(SCENE.grass, 0.15), width: 0.8, opacity: 0.95 });
      let v = '';
      for (const p of at(15)) {
        const s = (0.7 + rand() * 0.6) * k;
        const [x, y] = into(p, 4 + rand() * 14);
        v += `M${r2(x - s)},${r2(y - s)}l${r2(s)},${r2(1.6 * s)}l${r2(s)},${r2(-1.6 * s)}`;
      }
      inner.push({ d: v, stroke: SCENE.grassDark, width: 0.7, opacity: 0.4 });
      break;
    }
    case 'sno': {
      let gl = '';
      for (const p of at(24)) {
        const [x, y] = into(p, 2 + rand() * 12);
        const s = (0.6 + rand() * 0.7) * k;
        gl += `M${r2(x - s)},${r2(y)}h${r2(2 * s)}M${r2(x)},${r2(y - s * 0.8)}v${r2(1.6 * s)}`;
      }
      inner.push({ d: gl, stroke: GLINT, width: 0.5, opacity: 0.6 });
      inner.push({ d: dots(9, 1, 14, 0.35, 0.55, 1), fill: GLINT, opacity: 0.45 });
      inner.push({ d: dots(12, 1, 14, 0.4, 0.6, 1), fill: GLITTER, opacity: 0.95 });
      break;
    }
    case 'is': {
      let s = '';
      for (const p of at(42)) {
        const len = (6 + rand() * 14) * k;
        const [x, y] = into(p, 2.5 + rand() * 3);
        s += `M${r2(x)},${r2(y)}l${r2(p.tx * len)},${r2(p.ty * len)}`;
      }
      inner.push({ d: s, stroke: GLITTER, width: 1.1, opacity: 0.7 });
      break;
    }
    case 'grus':
      inner.push({ d: dots(3.6, 0, 10, 0.6, 1.5), fill: SCENE.gravelDark, opacity: 1 });
      inner.push({ d: dots(5, 0, 10, 0.5, 1.2), fill: tint(SCENE.gravel, 0.4), opacity: 1 });
      break;
    case 'jord':
      inner.push({ d: dots(5, 0, 12, 0.7, 1.6), fill: SCENE.soilDark, opacity: 0.9 });
      inner.push({ d: dots(9, 1, 14, 0.8, 1.5), fill: SCENE.stone, opacity: 0.9 });
      break;
    case 'asfalt':
      inner.push({ d: dots(5, 0.5, 4.5, 0.4, 0.7, 1), fill: SCENE.asphaltDark, opacity: 0.9 });
      inner.push({ d: dots(7, 0.5, 4.5, 0.4, 0.6, 1), fill: tint(SCENE.asphalt, 0.35), opacity: 0.8 });
      break;
    case 'vaat-asfalt': {
      let s = '';
      for (const p of at(26)) {
        const len = (8 + rand() * 18) * k;
        const [x, y] = into(p, 1.6 + rand() * 2.4);
        s += `M${r2(x)},${r2(y)}l${r2(p.tx * len)},${r2(p.ty * len)}`;
      }
      inner.push({ d: s, stroke: SCENE.skyBottom, width: 1, opacity: 0.45 });
      break;
    }
    case 'betong':
      inner.push({ d: dots(9, 1, 14, 0.3, 0.6, 1), fill: SCENE.concreteDark, opacity: 0.6 });
      break;
    case 'tregulv': {
      let gr = '';
      for (const p of at(22)) {
        const len = (10 + rand() * 20) * k;
        const [x, y] = into(p, 1.5 + rand() * 2.5);
        gr += `M${r2(x)},${r2(y)}l${r2(p.tx * len)},${r2(p.ty * len)}`;
      }
      inner.push({ d: gr, stroke: SCENE.floorDark, width: 0.5, opacity: 0.45 });
      let joints = '';
      for (const p of at(90)) {
        const [x, y] = into(p, 5);
        joints += `M${r2(p.x)},${r2(p.y)}L${r2(x)},${r2(y)}`;
      }
      inner.push({ d: joints, stroke: SCENE.floorDark, width: 0.8, opacity: 0.75 });
      break;
    }
    case 'labbenk':
      break;
  }
  return { inner, outer };
}

/**
 * Vilkårlig terrengprofil (bakke, akebakke, berg-og-dal-bane, skråplan) fylt ned til `bottom`, med teksturen langs
 * overflaten: strå i gress, glitter i snø, glans på is, et lag asfalt på en vei over en bakke, gulvbord på en rampe.
 *   <Terreng points={[[0, 120], [300, 120], [560, 250], [800, 250]]} bottom={300} type="sno" />
 * Et skråplan er to punkter: <Terreng points={[[100, 260], [600, 110]]} bottom={300} type="tregulv" />.
 * Ankerpunkt: punktene er selve overflaten. Gjenstander settes på den og dreies med helningen.
 */
export const Terreng = memo(function Terreng({ points, bottom, type, seed = 1, title }: TerrengProps) {
  const ss = useStrokeScale();
  const k = useSceneScale();
  const clip = useSvgId('sc-terreng');
  const grad = useSvgId('sc-terrengfyll');
  const pts = cleanPoints(points);
  const surface = polyline(pts);
  // Teksturen regnes ut på nytt bare når overflaten, typen, frøet eller mobilskaleringen endres.
  // (`surface` er punktene som tekst, så en ny matrise med samme punkter gir ikke ny tekstur.)
  const marks = useMemo(() => terrainMarks(pts, type, seed, k), [surface, type, seed, k]);
  if (pts.length < 2 || !Number.isFinite(bottom)) return null;
  let minY = Infinity;
  for (const p of pts) minY = Math.min(minY, p[1]);
  const first = pts[0]!;
  const last = pts[pts.length - 1]!;
  const body = fillDown(pts, bottom);
  const m = TERRAIN[type];
  return (
    <g {...a11y(title)}>
      {title && <title>{title}</title>}
      <LinearGradient
        id={grad}
        userSpace
        x1={0}
        y1={minY}
        x2={0}
        y2={Math.max(bottom, minY + 1)}
        stops={[
          [0, m.body[0]],
          [1, m.body[1]],
        ]}
      />
      <clipPath id={clip}>
        <path d={body} />
      </clipPath>
      <path d={body} fill={`url(#${grad})`} />
      <g clipPath={`url(#${clip})`}>
        {m.band > 0 && (
          <>
            <path d={surface} fill="none" stroke={m.seam} strokeWidth={2 * m.band + 2 * ss} strokeLinejoin="round" />
            <path d={surface} fill="none" stroke={m.bandColor} strokeWidth={2 * m.band} strokeLinejoin="round" />
          </>
        )}
        {marks.inner.map((mk, i) =>
          mk.d ? (
            <path
              key={i}
              d={mk.d}
              fill={mk.fill ?? 'none'}
              stroke={mk.stroke}
              strokeWidth={mk.width !== undefined ? mk.width * ss : undefined}
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity={mk.opacity}
            />
          ) : null,
        )}
        <path d={surface} fill="none" stroke={m.rim} strokeWidth={3 * ss} strokeLinejoin="round" opacity={m.rimOpacity} />
      </g>
      {marks.outer.map((mk, i) =>
        mk.d ? (
          <path
            key={i}
            d={mk.d}
            fill={mk.fill ?? 'none'}
            stroke={mk.stroke}
            strokeWidth={mk.width !== undefined ? mk.width * ss : undefined}
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity={mk.opacity}
          />
        ) : null,
      )}
      <path
        d={`M${r1(first[0])},${r1(bottom)}${surface.replace(/^M/, 'L')}L${r1(last[0])},${r1(bottom)}`}
        fill="none"
        stroke={SCENE.outline}
        strokeWidth={1 * ss}
        strokeLinejoin="round"
      />
    </g>
  );
});

/* ---------------------------------------------------------------- Vei */

interface VeiProps {
  x1: number;
  x2: number;
  /** Der hjulene står: midt i det nærmeste kjørefeltet. */
  y: number;
  /**
   * Hvor bred veibanen ser ut i perspektiv (figurens enheter, standard 26). Veibanen går fra y − 0,7 · bredde
   * (bakre kant) til y + 0,3 · bredde (forkant), med gul midtlinje ved y − 0,24 · bredde.
   */
  bredde?: number;
  type?: 'asfalt' | 'vaat-asfalt' | 'sno' | 'is';
  /** Underlaget langs veien (standard gress, snø om vinteren). */
  veikant?: 'gress' | 'sno' | 'grus' | 'jord';
  /** Hvor langt ned under y veien og veikanten tegnes (standard 0,75 · bredde). */
  depth?: number;
  /** Bakkanten av veikanten bak veien, f.eks. horisonten i Landskap. Uten: en smal stripe. */
  horisont?: number;
  /** Hvor langt «kameraet» har flyttet seg mot høyre; oppmerkingen og teksturen ruller mot venstre. */
  forskyvning?: number;
  seed?: number;
  title?: string;
}

/**
 * Vei sett fra siden med litt perspektiv: veibanen er et bånd med hvite kantlinjer og gul, stiplet midtlinje
 * (som på norske veier), hjulspor og veikant foran og bak. Bilen kjører i det nærmeste feltet.
 *   <Vei x1={0} x2={800} y={250} type="vaat-asfalt" horisont={205} forskyvning={kameraX} />
 * Ankerpunkt: y er der hjulene står. Med `forskyvning` ruller midtlinja, så en bil som står stille i bildet
 * ser ut til å kjøre.
 */
export const Vei = memo(function Vei({
  x1,
  x2,
  y,
  bredde = 26,
  type = 'asfalt',
  veikant,
  depth,
  horisont,
  forskyvning = 0,
  seed = 1,
  title,
}: VeiProps) {
  const ss = useStrokeScale();
  const k = useSceneScale();
  const gid = useSvgId('sc-vei');
  const cid = useSvgId('sc-veiklipp');
  const left = Math.min(x1, x2);
  const right = Math.max(x1, x2);
  if (!(right > left) || !Number.isFinite(y)) return null;
  const B = Math.max(8, Number.isFinite(bredde) ? bredde : 26);
  const L = right - left;
  const roadTop = y - 0.7 * B;
  const roadBot = y + 0.3 * B;
  const winter = type === 'sno' || type === 'is';
  const kant: UnderlagType = veikant ?? (winter ? 'sno' : 'gress');
  const deep = horisont !== undefined && Number.isFinite(horisont) && horisont < roadTop - 1;
  const backTop = deep ? horisont : roadTop - 0.22 * B;
  const nearBot = roadBot + 0.18 * B;
  const bottom = Math.max(nearBot + 1, y + (depth !== undefined && Number.isFinite(depth) ? depth : 0.75 * B));
  const shift = Number.isFinite(forskyvning) ? forskyvning : 0;
  const face = { left, right, seed, shift, k, ss };
  const X = (u: number) => left + mod(u * L - shift, L);
  const rand = sceneRandom(seedFor(seed, `vei:${type}`));

  const ice = mix(SCENE.asphalt, SCENE.ice, 0.55);
  const stops: GradientStop[] =
    type === 'asfalt'
      ? [
          [0, tint(SCENE.asphalt, 0.12)],
          [1, shade(SCENE.asphalt, 0.06)],
        ]
      : type === 'vaat-asfalt'
        ? [
            [0, mix(SCENE.asphaltWet, SCENE.skyBottom, 0.32)],
            [0.45, SCENE.asphaltWet],
            [1, shade(SCENE.asphaltWet, 0.1)],
          ]
        : type === 'sno'
          ? [
              [0, tint(SCENE.snow, 0.15)],
              [1, mix(SCENE.snow, SCENE.snowShade, 0.5)],
            ]
          : [
              [0, mix(ice, SCENE.iceShine, 0.35)],
              [1, ice],
            ];

  // Hjulspor: to i hvert felt (y-posisjon og høyde som andel av bredden)
  const tracks: [number, number][] = [
    [-0.58, 0.06],
    [-0.42, 0.06],
    [-0.15, 0.08],
    [0.03, 0.09],
  ];
  let trackD = '';
  for (const [ty, th] of tracks)
    trackD += polygon([
      [left, y + ty * B],
      [right, y + ty * B],
      [right, y + (ty + th) * B],
      [left, y + (ty + th) * B],
    ]);
  const trackColor =
    type === 'asfalt' ? shade(SCENE.asphalt, 0.3) : type === 'vaat-asfalt' ? SCENE.skyBottom : type === 'sno' ? mix(SCENE.snowShade, SCENE.asphalt, 0.5) : GLITTER;
  const trackOpacity = type === 'asfalt' ? 0.22 : type === 'vaat-asfalt' ? 0.2 : type === 'sno' ? 0.62 : 0.3;

  // Tekstur på veibanen
  let tex = '';
  let tex2 = '';
  const n = Math.round(L / (type === 'asfalt' ? 9 : 40));
  for (let i = 0; i < n; i++) {
    const u = rand();
    const v = rand();
    const a = rand();
    const yy = roadTop + (roadBot - roadTop) * (0.06 + 0.88 * v);
    const p = 0.75 + 0.25 * v;
    if (type === 'asfalt') {
      const r = (0.45 + 0.5 * a) * k;
      if (i % 2) tex += circle(X(u), yy, r);
      else tex2 += circle(X(u), yy, r);
    } else if (type === 'vaat-asfalt' || type === 'is') {
      const rx = (10 + 30 * a) * p * k;
      tex += `M${r2(X(u) - rx)},${r2(yy)}a${r2(rx)},${r2(0.7 * p * k)} 0 1,1 ${r2(2 * rx)},0a${r2(rx)},${r2(0.7 * p * k)} 0 1,1 ${r2(-2 * rx)},0Z`;
    } else {
      tex += circle(X(u), yy, 0.5 * k);
    }
  }
  const lineOpacity = type === 'is' ? 0.55 : type === 'vaat-asfalt' ? 0.85 : 1;
  const dash = `${r1(1.5 * B)} ${r1(3.5 * B)}`;
  const bumps = (base: number, height: number, sp: number, s: number) => {
    const pts: Pt[] = [[left, base + 1]];
    for (let xx = left; xx <= right + 0.01; xx += 4) {
      const t = (1 - Math.cos(Math.PI * mod((xx + shift) / sp, 1) * 2)) / 2;
      const hgt = height * (0.55 + 0.45 * t) * (0.8 + 0.4 * Math.sin((xx + shift) / (sp * 1.7) + s));
      pts.push([Math.min(xx, right), base - hgt]);
    }
    pts.push([right, base + 1]);
    return polygon(pts);
  };

  return (
    <g {...a11y(title)}>
      {title && <title>{title}</title>}
      <TopFace {...face} type={kant} top={backTop} bottom={roadTop + 0.5} haze={deep} />
      <TopFace {...face} seed={seed + 7} type={kant} top={roadBot - 0.5} bottom={nearBot} />
      <FrontFace {...face} type={kant} top={nearBot} bottom={bottom} />
      <LinearGradient id={gid} userSpace x1={0} y1={roadTop} x2={0} y2={roadBot} stops={stops} />
      <rect x={left} y={roadTop} width={L} height={roadBot - roadTop} fill={`url(#${gid})`} />
      <clipPath id={cid}>
        <rect x={left} y={roadTop} width={L} height={roadBot - roadTop} />
      </clipPath>
      <g clipPath={`url(#${cid})`}>
        <path d={trackD} fill={trackColor} opacity={trackOpacity} />
        {type === 'asfalt' && <path d={tex} fill={tint(SCENE.asphalt, 0.35)} opacity={0.7} />}
        {type === 'asfalt' && <path d={tex2} fill={SCENE.asphaltDark} opacity={0.85} />}
        {(type === 'vaat-asfalt' || type === 'is') && <path d={tex} fill={type === 'is' ? GLITTER : SCENE.skyBottom} opacity={type === 'is' ? 0.55 : 0.32} />}
        {type === 'sno' && <path d={tex} fill={GLITTER} opacity={0.9} />}
        {type !== 'sno' && (
          <g opacity={lineOpacity}>
            <path d={`M${r1(left)},${r1(y - 0.625 * B)}H${r1(right)}`} stroke={SCENE.roadLine} strokeWidth={0.035 * B} />
            <path d={`M${r1(left)},${r1(y + 0.215 * B)}H${r1(right)}`} stroke={SCENE.roadLine} strokeWidth={0.065 * B} />
            <path
              d={`M${r1(left)},${r1(y - 0.24 * B)}H${r1(right)}`}
              stroke={MIDTLINJE}
              strokeWidth={0.05 * B}
              strokeDasharray={dash}
              strokeDashoffset={r1(mod(shift + 0.6 * B, 5 * B))}
            />
          </g>
        )}
        {type === 'vaat-asfalt' && (
          <path d={`M${r1(left)},${r1(y + 0.215 * B + 0.06 * B)}H${r1(right)}`} stroke={SCENE.roadLine} strokeWidth={0.03 * B} opacity={0.25} />
        )}
      </g>
      {type === 'sno' && (
        <>
          <path d={bumps(roadTop + 0.5, 0.1 * B, 31, 0.3)} fill={tint(SCENE.snow, 0.2)} stroke={shade(SCENE.snowShade, 0.1)} strokeWidth={0.6 * ss} />
          <path d={bumps(roadBot + 0.6, 0.08 * B, 27, 1.7)} fill={tint(SCENE.snow, 0.25)} stroke={shade(SCENE.snowShade, 0.1)} strokeWidth={0.6 * ss} />
        </>
      )}
      {!winter && (
        <path
          d={polygon([
            [left, roadBot - 0.015 * B],
            [right, roadBot - 0.015 * B],
            [right, roadBot + 0.045 * B],
            [left, roadBot + 0.045 * B],
          ])}
          fill={SCENE.gravel}
          opacity={0.8}
        />
      )}
      <path d={`M${r1(left)},${r1(nearBot)}H${r1(right)}`} stroke={SCENE.highlight} strokeWidth={1.1 * ss} opacity={0.4} />
      <path
        d={`M${r1(left)},${r1(deep ? roadTop : backTop)}V${r1(bottom)}M${r1(right)},${r1(deep ? roadTop : backTop)}V${r1(bottom)}${deep ? '' : `M${r1(left)},${r1(backTop)}H${r1(right)}`}`}
        fill="none"
        stroke={SCENE.outline}
        strokeWidth={0.9 * ss}
      />
    </g>
  );
});

/* ---------------------------------------------------------------- Rom */

interface RomProps {
  /** Øverste venstre hjørne og størrelsen på hele rommet (vegg + gulv). */
  x: number;
  y: number;
  w: number;
  h: number;
  /** Der veggen møter gulvet (underkanten av fotlisten). Gulvet går fra gulvY ned til y + h. */
  gulvY: number;
  gulv: 'tre' | 'fliser' | 'betong';
  /** Vindu med himmel og sollys som faller inn på gulvet. */
  vindu?: boolean;
  /** Midten av vinduet (standard x + 0,72 · w). */
  vinduX?: number;
  title?: string;
}

/**
 * Innendørs bakgrunn for laboratorie- og hjemmescener: vegg med myk skygge i taket, hvit fotlist og gulv i
 * perspektiv (tregulv med bord mot betrakteren, fliser eller slipt betong), eventuelt med vindu.
 *   <Rom x={0} y={0} w={800} h={320} gulvY={230} gulv="tre" vindu />
 * Ankerpunkt: (x, y) er øverste venstre hjørne. Gjenstander på gulvet står mellom gulvY og y + h
 * (f.eks. gulvY + 0,5 · (y + h − gulvY)); en labbenk legges foran med <Underlag type="labbenk" />.
 */
export const Rom = memo(function Rom({ x, y, w, h, gulvY, gulv, vindu = false, vinduX, title }: RomProps) {
  const ss = useStrokeScale();
  const ids = useSvgId('sc-rom');
  if (!(w > 0) || !(h > 0) || !Number.isFinite(x) || !Number.isFinite(y)) return null;
  const fy = clamp(gulvY, y + 10, y + h);
  const wallH = fy - y;
  const floorH = y + h - fy;
  const bh = clamp(wallH * 0.055, 4, 12);
  const cx = x + w / 2;

  // Gulv i perspektiv: forsvinningspunktet over gulvet, midt i rommet.
  const vy = fy - Math.max(floorH, 1) * 2;
  const s = floorH > 0 ? (y + h - vy) / (fy - vy) : 1;
  const toFront = (xb: number) => cx + (xb - cx) * s;
  let floorLines = '';
  let floorAlt = '';
  let floorJoints = '';
  const floorFill = gulv === 'tre' ? SCENE.floor : gulv === 'fliser' ? FLIS : SCENE.concrete;
  if (floorH > 2) {
    if (gulv === 'tre' || gulv === 'fliser') {
      const pw = gulv === 'tre' ? clamp(w * 0.05, 14, 40) : clamp(w * 0.075, 22, 64);
      const xbMin = cx + (x - cx) / s - pw;
      const xbMax = cx + (x + w - cx) / s + pw;
      const i0 = Math.floor((xbMin - cx) / pw);
      const i1 = Math.ceil((xbMax - cx) / pw);
      const rand = sceneRandom(seedFor(Math.round(w + h), 'gulv'));
      for (let i = i0; i <= i1; i++) {
        const xa = cx + i * pw;
        const xb = xa + pw;
        floorLines += `M${r1(xa)},${r1(fy)}L${r1(toFront(xa))},${r1(y + h)}`;
        if (gulv === 'tre') {
          if (i % 2 === 0)
            floorAlt += polygon([
              [xa, fy],
              [xb, fy],
              [toFront(xb), y + h],
              [toFront(xa), y + h],
            ]);
          // Skjøter i bordene, forskjøvet fra bord til bord
          for (let d = rand() * 0.5; d < 1; d += 0.45 + rand() * 0.35) {
            const yy = fy + floorH * d;
            const t = (yy - fy) / floorH;
            const sc = 1 + (s - 1) * t;
            floorJoints += `M${r1(cx + (xa - cx) * sc)},${r1(yy)}L${r1(cx + (xb - cx) * sc)},${r1(yy)}`;
          }
        }
      }
      if (gulv === 'fliser') {
        // Rader med lik dybde blir høyere jo nærmere de er (1/z).
        const rows = Math.max(2, Math.round(floorH / (pw * 0.42)));
        for (let j = 1; j < rows; j++) {
          const z = 1 + (1 / s - 1) * (j / rows);
          const yy = vy + (fy - vy) / z;
          floorLines += `M${r1(x)},${r1(yy)}H${r1(x + w)}`;
        }
      }
    } else {
      // Betong: noen store, svake flekker og ett sagspor
      const rand = sceneRandom(seedFor(Math.round(w + h), 'betong'));
      for (let i = 0; i < 6; i++) {
        const ex = x + rand() * w;
        const ey = fy + floorH * (0.2 + rand() * 0.7);
        const er = (30 + rand() * 60) * (0.5 + (ey - fy) / floorH);
        floorAlt += `M${r1(ex - er)},${r1(ey)}a${r1(er)},${r1(er * 0.22)} 0 1,1 ${r1(2 * er)},0a${r1(er)},${r1(er * 0.22)} 0 1,1 ${r1(-2 * er)},0Z`;
      }
      floorLines += `M${r1(cx - w * 0.18)},${r1(fy)}L${r1(toFront(cx - w * 0.18))},${r1(y + h)}`;
      floorLines += `M${r1(x)},${r1(fy + floorH * 0.55)}H${r1(x + w)}`;
    }
  }

  // Vindu
  const win = (() => {
    if (!vindu || wallH < 40) return null;
    const wh = wallH * 0.48;
    const ww = clamp(wh * 0.82, 26, w * 0.3);
    const wx = clamp(vinduX ?? x + w * 0.72, x + ww / 2 + 10, x + w - ww / 2 - 10);
    const wt = y + wallH * 0.15;
    const f = clamp(ww * 0.07, 3, 8);
    return { wh, ww, wx, wt, f };
  })();

  return (
    <g {...a11y(title)}>
      {title && <title>{title}</title>}
      <clipPath id={`${ids}k`}>
        <rect x={x} y={y} width={w} height={h} />
      </clipPath>
      <LinearGradient
        id={`${ids}v`}
        userSpace
        x1={x}
        y1={0}
        x2={x + w}
        y2={0}
        stops={[
          [0, tint(SCENE.wall, 0.12)],
          [1, shade(SCENE.wall, 0.05)],
        ]}
      />
      <LinearGradient
        id={`${ids}t`}
        userSpace
        x1={0}
        y1={y}
        x2={0}
        y2={fy}
        stops={[
          [0, SCENE.shadow, 0.55],
          [0.16, SCENE.shadow, 0],
          [0.86, SCENE.shadow, 0],
          [1, SCENE.shadow, 0.35],
        ]}
      />
      <LinearGradient
        id={`${ids}g`}
        userSpace
        x1={0}
        y1={fy}
        x2={0}
        y2={y + h}
        stops={[
          [0, shade(floorFill, 0.12)],
          [0.3, floorFill],
          [1, tint(floorFill, 0.05)],
        ]}
      />
      <LinearGradient
        id={`${ids}o`}
        userSpace
        x1={0}
        y1={fy}
        x2={0}
        y2={fy + Math.min(14, floorH * 0.3)}
        stops={[
          [0, SCENE.shadow, 1],
          [1, SCENE.shadow, 0],
        ]}
      />
      <g clipPath={`url(#${ids}k)`}>
        <rect x={x} y={y} width={w} height={wallH} fill={`url(#${ids}v)`} />
        <rect x={x} y={y} width={w} height={wallH} fill={`url(#${ids}t)`} />
        {win && (
          <g>
            <LinearGradient
              id={`${ids}h`}
              userSpace
              x1={0}
              y1={win.wt}
              x2={0}
              y2={win.wt + win.wh}
              stops={[
                [0, SCENE.skyTop],
                [1, SCENE.skyBottom],
              ]}
            />
            {/* Skygge av karmen på veggen, karm, glass med himmel og ås, sprosser og vinduskarm */}
            <rect
              x={win.wx - win.ww / 2 - win.f + 2}
              y={win.wt - win.f + 3}
              width={win.ww + 2 * win.f}
              height={win.wh + 2 * win.f}
              rx={1.5}
              fill={SCENE.shadow}
              opacity={0.5}
            />
            <rect
              x={win.wx - win.ww / 2 - win.f}
              y={win.wt - win.f}
              width={win.ww + 2 * win.f}
              height={win.wh + 2 * win.f}
              rx={1.5}
              fill={LIST}
              stroke={SCENE.outline}
              strokeWidth={0.8 * ss}
            />
            <rect x={win.wx - win.ww / 2} y={win.wt} width={win.ww} height={win.wh} fill={`url(#${ids}h)`} />
            <path
              d={`M${r1(win.wx - win.ww / 2)},${r1(win.wt + win.wh)}L${r1(win.wx - win.ww / 2)},${r1(win.wt + win.wh * 0.78)}Q${r1(win.wx - win.ww * 0.1)},${r1(win.wt + win.wh * 0.6)} ${r1(win.wx + win.ww / 2)},${r1(win.wt + win.wh * 0.74)}L${r1(win.wx + win.ww / 2)},${r1(win.wt + win.wh)}Z`}
              fill={SCENE.hillFar}
            />
            <path
              d={polygon([
                [win.wx - win.ww * 0.3, win.wt],
                [win.wx - win.ww * 0.12, win.wt],
                [win.wx - win.ww * 0.42, win.wt + win.wh],
                [win.wx - win.ww * 0.5, win.wt + win.wh],
                [win.wx - win.ww * 0.5, win.wt + win.wh * 0.62],
              ])}
              fill={SCENE.highlight}
              opacity={0.6}
            />
            <rect x={win.wx - win.ww / 2} y={win.wt} width={win.ww} height={win.f * 0.6} fill={SCENE.shadow} opacity={0.5} />
            <rect x={win.wx - win.f * 0.4} y={win.wt} width={win.f * 0.8} height={win.wh} fill={LIST} stroke={SCENE.outline} strokeWidth={0.5 * ss} />
            <rect x={win.wx - win.ww / 2} y={win.wt + win.wh * 0.36} width={win.ww} height={win.f * 0.7} fill={LIST} stroke={SCENE.outline} strokeWidth={0.5 * ss} />
            <rect
              x={win.wx - win.ww / 2 - win.f * 2}
              y={win.wt + win.wh + win.f * 0.6}
              width={win.ww + win.f * 4}
              height={win.f * 1.1}
              rx={1}
              fill={LIST}
              stroke={SCENE.outline}
              strokeWidth={0.8 * ss}
            />
            <rect x={win.wx - win.ww / 2 - win.f * 2} y={win.wt + win.wh + win.f * 1.7} width={win.ww + win.f * 4} height={win.f * 1.2} fill={SCENE.shadow} opacity={0.45} />
          </g>
        )}
        <rect x={x} y={fy} width={w} height={floorH} fill={`url(#${ids}g)`} />
        {floorAlt && <path d={floorAlt} fill={gulv === 'betong' ? SCENE.concreteDark : SCENE.floorDark} opacity={gulv === 'betong' ? 0.12 : 0.1} />}
        {floorJoints && <path d={floorJoints} fill="none" stroke={SCENE.floorDark} strokeWidth={0.8 * ss} opacity={0.7} />}
        {floorLines && (
          <path
            d={floorLines}
            fill="none"
            stroke={gulv === 'fliser' ? FUGE : gulv === 'tre' ? SCENE.floorDark : SCENE.concreteDark}
            strokeWidth={(gulv === 'fliser' ? 1.3 : 0.8) * ss}
            opacity={gulv === 'tre' ? 0.6 : 0.8}
          />
        )}
        {win && floorH > 8 && (
          <path
            d={polygon([
              [win.wx - win.ww * 0.45, fy + floorH * 0.12],
              [win.wx + win.ww * 0.45, fy + floorH * 0.12],
              [win.wx + win.ww * 0.75 + floorH * 0.5, fy + floorH * 0.8],
              [win.wx - win.ww * 0.15 + floorH * 0.5, fy + floorH * 0.8],
            ])}
            fill={LYSFLEKK}
          />
        )}
        <rect x={x} y={fy} width={w} height={Math.min(14, floorH * 0.3)} fill={`url(#${ids}o)`} />
        <rect x={x} y={fy - bh} width={w} height={bh} fill={LIST} />
        <path d={`M${r1(x)},${r1(fy - bh + 0.8)}H${r1(x + w)}`} stroke={SCENE.highlight} strokeWidth={1.2 * ss} />
        <path d={`M${r1(x)},${r1(fy - bh)}H${r1(x + w)}M${r1(x)},${r1(fy)}H${r1(x + w)}`} stroke={SCENE.outline} strokeWidth={0.8 * ss} opacity={0.6} />
      </g>
    </g>
  );
});

/* ---------------------------------------------------------------- Vann */

interface VannProps {
  /** Venstre kant. */
  x: number;
  /** Overflaten (likevektslinja når det er bølger). */
  y: number;
  w: number;
  /** Dybden: vannet går fra y ned til y + h. */
  h: number;
  /**
   * Sinusbølge på overflaten: η(x) = amplitude · sin(2π (x − x0) / bølgelengde − fase), der x0 er venstre kant.
   * Amplitude og bølgelengde i figurens enheter, fase i radianer (styres av kapittelet; øker fasen, går bølgen mot høyre).
   */
  bolge?: { amplitude: number; bolgelengde: number; fase: number };
  /** Litt gjennomsiktig, så det som er tegnet før (bak), synes under vann. */
  gjennomsiktig?: boolean;
  title?: string;
}

/**
 * Vann (basseng, hav, magasin) med lys overflate, lysstriper under overflaten og dybdetoning (mørkere nedover).
 *   <Vann x={100} y={180} w={600} h={120} />
 *   <Vann x={0} y={150} w={800} h={150} bolge={{ amplitude: 12, bolgelengde: 200, fase: 2 * Math.PI * t / T }} />
 * Ankerpunkt: venstre ende av overflaten (likevektslinja). Tegn gjenstander som skal ligge under vann før
 * <Vann gjennomsiktig />.
 */
export const Vann = memo(function Vann({ x, y, w, h, bolge, gjennomsiktig = false, title }: VannProps) {
  const ss = useStrokeScale();
  const k = useSceneScale();
  const ids = useSvgId('sc-vann');
  if (!(w > 0) || !(h > 0) || !Number.isFinite(x) || !Number.isFinite(y)) return null;
  const A = bolge && Number.isFinite(bolge.amplitude) ? clamp(Math.abs(bolge.amplitude), 0, h * 0.9) * Math.sign(bolge.amplitude || 1) : 0;
  const lam = bolge?.bolgelengde ?? 0;
  const ph = bolge?.fase ?? 0;
  const pts = wavePoints(x, w, y, A, lam, ph);
  const surface = polyline(pts);
  const body = fillDown(pts, y + h);
  const sy = (xx: number) => (A && lam > 1 ? y - A * Math.sin((2 * Math.PI * (xx - x)) / lam - ph) : y);
  // Lyse striper like under overflaten og svake lyssøyler nedover (faste plasser, følger bølgen i høyden)
  const rand = sceneRandom(seedFor(Math.round(w), 'vann'));
  let sheen = '';
  const ns = Math.round(clamp(w / 45, 3, 24));
  for (let i = 0; i < ns; i++) {
    const xx = x + rand() * w;
    const len = Math.min((8 + rand() * 26) * k, x + w - xx);
    const dd = (3 + rand() * Math.min(14, h * 0.25)) * Math.sqrt(k);
    if (len > 2) sheen += `M${r1(xx)},${r1(sy(xx) + dd)}L${r1(xx + len)},${r1(sy(xx + len) + dd)}`;
  }
  let rays = '';
  const nr = Math.round(clamp(w / 160, 1, 6));
  for (let i = 0; i < nr; i++) {
    const xx = x + w * ((i + 0.25 + rand() * 0.5) / nr);
    const rw = (8 + rand() * 16) * k;
    const depth = h * (0.55 + rand() * 0.35);
    rays += polygon([
      [xx, sy(xx) + 2],
      [xx + rw, sy(xx + rw) + 2],
      [xx + rw * 1.4 + depth * 0.28, y + depth],
      [xx + depth * 0.28, y + depth],
    ]);
  }
  return (
    <g {...a11y(title)} opacity={gjennomsiktig ? 0.8 : undefined}>
      {title && <title>{title}</title>}
      <LinearGradient
        id={`${ids}d`}
        userSpace
        x1={0}
        y1={y - Math.abs(A)}
        x2={0}
        y2={y + h}
        stops={[
          [0, SCENE.waterLight],
          [0.22, SCENE.water],
          [1, SCENE.waterDeep],
        ]}
      />
      <LinearGradient
        id={`${ids}r`}
        stops={[
          [0, SCENE.highlight, 0.5],
          [1, SCENE.highlight, 0],
        ]}
      />
      <clipPath id={`${ids}k`}>
        <path d={body} />
      </clipPath>
      <path d={body} fill={`url(#${ids}d)`} />
      <g clipPath={`url(#${ids}k)`}>
        <path d={rays} fill={`url(#${ids}r)`} opacity={0.45} />
        <path d={sheen} fill="none" stroke={tint(SCENE.waterLight, 0.35)} strokeWidth={1.2 * ss} strokeLinecap="round" opacity={0.7} />
        <path d={surface} fill="none" stroke={tint(SCENE.waterLight, 0.45)} strokeWidth={4 * ss} strokeLinejoin="round" opacity={0.85} />
      </g>
      <path d={surface} fill="none" stroke={shade(SCENE.water, 0.25)} strokeWidth={1 * ss} strokeLinejoin="round" />
    </g>
  );
});
