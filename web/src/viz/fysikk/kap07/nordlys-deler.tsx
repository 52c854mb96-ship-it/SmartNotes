/**
 * Egne scenedeler til «Nordlys» (bare dette kapittelet trenger dem): nordlysdraperiet, fjell og fjord om natta, ei
 * hytte med lys i vinduet, elektroner på vei ned og tekst som kan leses på nattehimmelen. Samme stil som scene-kit-et:
 * toninger fra core.tsx, SCENE-farger (blandet mot nattehimmelen), myke kanter og ingen filtre.
 */
import { useMemo, type CSSProperties, type ReactNode } from 'react';
import { VIZ, useTextScale } from '../../kit';
import {
  Elektron,
  LinearGradient,
  PAINTS,
  RadialGradient,
  SCENE,
  alpha,
  mix,
  sceneRandom,
  shade,
  tint,
  useSceneScale,
  useStrokeScale,
  useSvgId,
} from '../../kit/scene';
import { LINE_ORDER, mixLight, rgbText, type AuroraProfile, type LineId, type Rgb } from './model-nordlys';

type Pt = [number, number];

const r1 = (v: number) => (Number.isFinite(v) ? Math.round(v * 10) / 10 : 0);

/** Farger om natta: SCENE-fargene blandet mot nattehimmelen (mørk i begge temaer, litt mørkere i mørkt tema). */
export const NATT = {
  text: SCENE.star,
  textMuted: mix(SCENE.star, SCENE.space, 0.3),
  halo: SCENE.space,
  snow: mix(SCENE.space, SCENE.snow, 0.4),
  snowLit: mix(SCENE.space, SCENE.snow, 0.58),
  rock: mix(SCENE.space, SCENE.mountainShade, 0.28),
  forest: mix(SCENE.space, SCENE.foliageDark, 0.22),
  water: mix(SCENE.space, SCENE.waterDeep, 0.32),
  waterLight: mix(SCENE.space, SCENE.waterLight, 0.3),
  panel: alpha(SCENE.space, 0.7),
  rule: alpha(SCENE.star, 0.5),
  grid: alpha(SCENE.star, 0.14),
} as const;

/** Elektronets farge (samme som Elektron i scene-kit-et og i resten av kapittel 7). */
export const ELEKTRON_FARGE = VIZ.series[0]!;


/**
 * Tekst på nattehimmelen: lys tekst med mørk kant i begge temaer (vanlig <Txt> har mørk tekst med lys kant i lyst
 * tema, som blir skarpt mot den mørke himmelen). Vokser på mobil som annen tekst i figurene.
 */
export function HimmelTekst({
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
  const style = {
    fill: color ?? (muted ? NATT.textMuted : NATT.text),
    stroke: NATT.halo,
    fontWeight: weight,
    '--kj-fs': size,
  } as CSSProperties;
  return (
    <text x={r1(x)} y={r1(y)} textAnchor={anchor} className="kj-txt" style={style}>
      {children}
    </text>
  );
}

/* ---------- Nordlysdraperiet ---------- */

export interface DraperiProps {
  /** Venstre og høyre ende av draperiet. */
  x0: number;
  x1: number;
  /** Høyde (km) → y i figuren. */
  yOf: (h: number) => number;
  profile: AuroraProfile;
  /** Fargen (rgb) til hver linje. */
  colors: Record<LineId, Rgb>;
  /** Tid (s) fra klokka: foldene glir og strålene blafrer. */
  t: number;
  seed?: number;
  /** Id til gruppa, så den kan speiles i vannet med <use>. */
  id?: string;
}

/** Fargen og styrken (0–1) i hver høyde: additiv blanding av linjene, styrken komprimert (øyet ser svakt lys godt). */
export function curtainStops(profile: AuroraProfile, colors: Record<LineId, Rgb>): { h: number; rgb: Rgb; a: number }[] {
  const tot = profile.h.map((_, i) => LINE_ORDER.reduce((s, id) => s + (profile.I[id][i] ?? 0), 0));
  const max = Math.max(...tot);
  return profile.h.map((h, i) => {
    const rgb = mixLight(LINE_ORDER.map((id) => ({ rgb: colors[id], w: profile.I[id][i] ?? 0 })));
    const a = max > 0 ? Math.min(1, (tot[i]! / max) ** 0.72 * 1.15) : 0;
    return { h, rgb, a };
  });
}

/**
 * Nordlysdraperi sett på avstand: et bølgende forheng av loddrette stråler med skarp nedre kant. Fargen og
 * lysstyrken i hver høyde kommer fra modellen (samme høydeskala som aksen ved siden av), og hele draperiet tones ut
 * mot endene. Strålene er smale rektangler med samme toning i figurens koordinater, flyttet litt opp og ned.
 */
export function Draperi({ x0, x1, yOf, profile, colors, t, seed = 5, id }: DraperiProps) {
  const ss = useStrokeScale();
  const grad = useSvgId('nordlys-farge');
  const fade = useSvgId('nordlys-ender');
  const mask = useSvgId('nordlys-maske');
  const yTop = yOf(profile.h[profile.h.length - 1]!);
  const yBot = yOf(profile.h[0]!);
  const span = yBot - yTop;
  const stops = useMemo(() => curtainStops(profile, colors), [profile, colors]);
  const rays = useMemo(() => {
    const rnd = sceneRandom(seed * 101 + 7);
    const n = 70;
    return Array.from({ length: n }, (_, j) => ({
      s: (j + 0.5 + (rnd() - 0.5) * 0.8) / n,
      w: 5 + rnd() * 11,
      a: rnd() < 0.15 ? 0.3 + rnd() * 0.15 : 0.08 + rnd() * 0.2,
      ph: rnd() * Math.PI * 2,
      sp: 0.6 + rnd() * 1.4,
    }));
  }, [seed]);
  const W = x1 - x0;
  // Foldene: en langsom bølge langs draperiet (y-forskyvning) og en tettere (lysstyrke).
  const fold = (s: number) => 11 * Math.sin(2 * Math.PI * 1.15 * s + 0.35 * t + 0.6) + 5 * Math.sin(2 * Math.PI * 2.7 * s - 0.5 * t);
  const bright = (s: number) => 0.4 + 0.6 * (0.5 + 0.5 * Math.sin(2 * Math.PI * 1.9 * s + 0.45 * t + 1.3)) ** 2;
  if (!(W > 0) || !(span > 0)) return null;
  // Den skarpe, lyse nedre kanten av draperiet: der lyset først blir sterkt nedenfra.
  // Kanten får fargen der draperiet lyser sterkest (ellers blir blandingen av fiolett og grønt nesten hvit).
  const edgeStop = stops.find((st) => st.a >= 0.4) ?? stops[0];
  const peakStop = stops.reduce((best, st) => (st.a > best.a ? st : best), stops[0] ?? { h: 0, rgb: [255, 255, 255] as Rgb, a: 0 });
  const edgeY = edgeStop ? yOf(edgeStop.h) : yBot;
  const edgeCol = rgbText(peakStop.rgb);
  const ribbon = Array.from({ length: 61 }, (_, i) => {
    const u = i / 60;
    return `${i ? 'L' : 'M'}${r1(x0 + u * W)} ${r1(edgeY + 3 + fold(u))}`;
  }).join('');
  const gradStops = stops
    .map((st): [number, string, number] => [Math.round(((yOf(st.h) - yTop) / span) * 10000) / 10000, rgbText(st.rgb), st.a])
    .sort((a, b) => a[0] - b[0]);
  return (
    <g id={id} aria-hidden>
      <LinearGradient id={grad} userSpace x1={0} y1={yTop} x2={0} y2={yBot} stops={gradStops} />
      <LinearGradient
        id={fade}
        userSpace
        x1={x0}
        y1={0}
        x2={x1}
        y2={0}
        stops={[
          [0, 'white', 0],
          [0.16, 'white', 0.85],
          [0.5, 'white', 1],
          [0.84, 'white', 0.85],
          [1, 'white', 0],
        ]}
      />
      <defs>
        <mask id={mask} maskUnits="userSpaceOnUse" x={x0 - 20} y={yTop - 40} width={W + 40} height={span + 80}>
          <rect x={x0 - 20} y={yTop - 40} width={W + 40} height={span + 80} fill={`url(#${fade})`} />
        </mask>
      </defs>
      <g mask={`url(#${mask})`}>
        {/* Svak glød bak strålene */}
        {Array.from({ length: 12 }, (_, k) => {
          const s0 = k / 12;
          const dy = fold(s0 + 1 / 24);
          return (
            <rect
              key={`g${k}`}
              x={r1(x0 + s0 * W - 2)}
              y={r1(yTop - 20)}
              width={r1(W / 12 + 4)}
              height={r1(span + 40)}
              transform={`translate(0 ${r1(dy)})`}
              fill={`url(#${grad})`}
              opacity={0.34 * bright(s0 + 1 / 24) + 0.12}
            />
          );
        })}
        <path d={ribbon} fill="none" stroke={edgeCol} strokeWidth={7 * ss} strokeLinecap="round" opacity={0.1} />
        <path d={ribbon} fill="none" stroke={edgeCol} strokeWidth={2.2 * ss} strokeLinecap="round" opacity={0.26} />
        {rays.map((r, j) => {
          const dy = fold(r.s);
          const flick = 0.75 + 0.25 * Math.sin(t * r.sp + r.ph);
          const top = yTop - 20;
          return (
            <rect
              key={j}
              x={r1(x0 + r.s * W - (r.w * ss) / 2)}
              y={r1(top)}
              width={r1(r.w * ss)}
              height={r1(yBot - top + 20)}
              transform={`translate(0 ${r1(dy)})`}
              fill={`url(#${grad})`}
              opacity={Math.min(1, r.a * flick * (0.5 + bright(r.s)))}
            />
          );
        })}
      </g>
    </g>
  );
}

/* ---------- Fjell, fjord og strand om natta ---------- */

interface Peak {
  c: number;
  h: number;
  hw: number;
}

function ridge(w: number, base: number, peaks: Peak[], rnd: () => number, jag: number, step = 5): Pt[] {
  const pts: Pt[] = [];
  const p1 = rnd() * 6;
  const p2 = rnd() * 6;
  for (let x = -10; x <= w + 10; x += step) {
    let hgt = 0;
    for (const p of peaks) {
      const d = Math.abs(x - p.c) / p.hw;
      if (d < 1) hgt = Math.max(hgt, p.h * (1 - d) ** 1.3);
    }
    hgt += jag * (0.6 * Math.sin(x / 23 + p1) + 0.4 * Math.sin(x / 9 + p2) + (rnd() - 0.5) * 0.8);
    pts.push([x, base - Math.max(0, hgt)]);
  }
  return pts;
}

function fillPath(pts: Pt[], bottom: number): string {
  if (pts.length === 0) return '';
  const first = pts[0]!;
  const last = pts[pts.length - 1]!;
  return `M${r1(first[0])} ${r1(bottom)}${pts.map(([x, y]) => `L${r1(x)} ${r1(y)}`).join('')}L${r1(last[0])} ${r1(bottom)}Z`;
}

function yAt(pts: Pt[], x: number): number {
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1]!;
    const b = pts[i]!;
    if (x <= b[0]) return a[1] + ((b[1] - a[1]) * (x - a[0])) / Math.max(1e-9, b[0] - a[0]);
  }
  return pts[pts.length - 1]?.[1] ?? 0;
}

function sprucePath(cx: number, base: number, h: number): string {
  const w = h * 0.36;
  const tiers = 4;
  let d = `M${r1(cx)} ${r1(base - h)}`;
  for (let i = 1; i <= tiers; i++) {
    const y = base - h + (h * 0.9 * i) / tiers;
    const hw = (w / 2) * (0.35 + (0.65 * i) / tiers);
    d += `L${r1(cx + hw)} ${r1(y)}L${r1(cx + hw * 0.45)} ${r1(y - h * 0.05)}`;
  }
  d += `L${r1(cx + w * 0.06)} ${r1(base - h * 0.08)}L${r1(cx + w * 0.06)} ${r1(base)}L${r1(cx - w * 0.06)} ${r1(base)}L${r1(cx - w * 0.06)} ${r1(base - h * 0.08)}`;
  for (let i = tiers; i >= 1; i--) {
    const y = base - h + (h * 0.9 * i) / tiers;
    const hw = (w / 2) * (0.35 + (0.65 * i) / tiers);
    d += `L${r1(cx - hw * 0.45)} ${r1(y - h * 0.05)}L${r1(cx - hw)} ${r1(y)}`;
  }
  return `${d}Z`;
}

export interface NattlandskapProps {
  w: number;
  /** Horisonten: vannlinja i fjorden, der fjellene står. */
  horizon: number;
  /** Strandkanten nærmest (fjorden går fra horisonten ned hit). */
  shore: number;
  /** Bunnen av figuren. */
  bottom: number;
  /** Hvor høye fjellene er (px). */
  mountain: number;
  /** Fargen på lyset fra nordlyset (snøen og vannet får et skjær av det). */
  glow: Rgb;
  /** Id til nordlysdraperiet som skal speiles i fjorden. */
  reflect?: string;
  /** Speilingen: y-skalering rundt horisonten (standard 0,32). */
  reflectScale?: number;
  /** Hytta: x-posisjon (midt), eller null for ingen hytte. */
  hytte?: number | null;
  seed?: number;
}

/**
 * Nattlandskap i Nord-Norge: snødekte fjell med mørke renner og skyggesider, en lav skogås, en fjord som speiler
 * nordlyset og ei snødekt strand med granskog og ei hytte med lys i vinduet.
 */
export function Nattlandskap({ w, horizon, shore, bottom, mountain, glow, reflect, reflectScale = 0.32, hytte = null, seed = 3 }: NattlandskapProps) {
  const s = useSceneScale();
  const ss = useStrokeScale();
  const snowGrad = useSvgId('natt-sno');
  const waterGrad = useSvgId('natt-vann');
  const waterClip = useSvgId('natt-vann-klipp');
  const shoreGrad = useSvgId('natt-strand');
  const glowCol = rgbText(glow);
  const geo = useMemo(() => {
    const rnd = sceneRandom(seed * 977 + 31);
    const peaks: Peak[] = [];
    let x = -40;
    while (x < w + 60) {
      const hw = (70 + rnd() * 90) * (mountain / 60);
      peaks.push({ c: x, h: mountain * (0.45 + rnd() * 0.55), hw });
      x += hw * (0.75 + rnd() * 0.5);
    }
    const far = ridge(w, horizon, peaks, rnd, mountain * 0.05, 4);
    // Mørke renner og skyggesider på fjellene
    const gullies: string[] = [];
    for (let i = 0; i < Math.round(w / 14); i++) {
      const gx = rnd() * w;
      const gy = yAt(far, gx);
      const depth = horizon - gy;
      if (depth < mountain * 0.3) continue;
      const len = depth * (0.25 + rnd() * 0.45);
      const lean = (rnd() - 0.5) * 0.5;
      gullies.push(`M${r1(gx)} ${r1(gy + 3)}Q${r1(gx + lean * len * 0.4)} ${r1(gy + len * 0.5)} ${r1(gx + lean * len)} ${r1(gy + len)}`);
    }
    const shades = peaks.map((p) => {
      const top = yAt(far, p.c);
      const pts: Pt[] = [[p.c, top]];
      for (const q of far) if (q[0] > p.c && q[0] < p.c + p.hw * 0.7) pts.push(q);
      pts.push([p.c + p.hw * 0.42, horizon], [p.c + p.hw * 0.04, horizon]);
      return `M${pts.map(([a, b]) => `${r1(a)} ${r1(b)}`).join('L')}Z`;
    });
    const nearPeaks: Peak[] = [];
    x = -20;
    while (x < w + 40) {
      const hw = 90 + rnd() * 120;
      nearPeaks.push({ c: x, h: mountain * (0.12 + rnd() * 0.18), hw });
      x += hw * (0.8 + rnd() * 0.5);
    }
    const near = ridge(w, horizon + 2, nearPeaks, rnd, mountain * 0.012, 6);
    let trees = '';
    for (let tx = -6; tx < w + 6; tx += 5 + rnd() * 4) {
      const base = yAt(near, tx) + 3;
      trees += sprucePath(tx, base, (7 + rnd() * 8) * Math.max(1, s * 0.8));
    }
    // Strand: myke snøhauger
    const strand: Pt[] = [];
    for (let sx = -10; sx <= w + 10; sx += 10) strand.push([sx, shore - 5 * Math.sin(sx / 70 + 1.2) - 3 * Math.sin(sx / 23)]);
    const front: { x: number; h: number }[] = [];
    for (const [a, b] of [
      [w - 120, w + 10],
      [-10, 40],
    ] as const) {
      for (let tx = a; tx < b; tx += 16 + rnd() * 14) front.push({ x: tx, h: (38 + rnd() * 30) * s });
    }
    const ripples: string[] = [];
    for (let i = 0; i < 26; i++) {
      const ry = horizon + 4 + (shore - horizon - 8) * rnd() ** 1.4;
      const rx = rnd() * w;
      const rl = 20 + rnd() * 70;
      ripples.push(`M${r1(rx)} ${r1(ry)}h${r1(rl)}`);
    }
    return { far, gullies, shades, near, trees, strand, front, ripples };
  }, [w, horizon, shore, mountain, seed, s]);

  return (
    <g aria-hidden>
      <LinearGradient
        id={snowGrad}
        userSpace
        x1={0}
        y1={horizon - mountain}
        x2={0}
        y2={horizon}
        stops={[
          [0, mix(NATT.snowLit, glowCol, 0.16)],
          [0.55, mix(NATT.snow, glowCol, 0.08)],
          [1, shade(NATT.snow, 0.35)],
        ]}
      />
      <LinearGradient
        id={waterGrad}
        userSpace
        x1={0}
        y1={horizon}
        x2={0}
        y2={shore}
        stops={[
          [0, mix(NATT.waterLight, glowCol, 0.1)],
          [0.4, NATT.water],
          [1, shade(NATT.water, 0.3)],
        ]}
      />
      <LinearGradient
        id={shoreGrad}
        userSpace
        x1={0}
        y1={shore - 8}
        x2={0}
        y2={bottom}
        stops={[
          [0, mix(NATT.snowLit, glowCol, 0.12)],
          [1, shade(NATT.snow, 0.25)],
        ]}
      />
      <defs>
        <clipPath id={waterClip}>
          <rect x={0} y={horizon} width={w} height={Math.max(0, shore - horizon + 8)} />
        </clipPath>
      </defs>

      {/* Fjellene */}
      <path d={fillPath(geo.far, horizon + 1)} fill={`url(#${snowGrad})`} />
      {geo.shades.map((d, i) => (
        <path key={i} d={d} fill={NATT.rock} opacity={0.28} />
      ))}
      <path d={geo.gullies.join('')} fill="none" stroke={NATT.rock} strokeWidth={1.6 * ss} strokeLinecap="round" opacity={0.55} />
      <path d={geo.far.map(([x, y], i) => `${i ? 'L' : 'M'}${r1(x)} ${r1(y)}`).join('')} fill="none" stroke={tint(NATT.snowLit, 0.15)} strokeWidth={1 * ss} opacity={0.5} />
      {/* Skogåsen ved fjorden */}
      <path d={fillPath(geo.near, horizon + 2)} fill={NATT.forest} />
      <path d={geo.trees} fill={NATT.forest} />

      {/* Fjorden med speilbilde av nordlyset */}
      <rect x={0} y={horizon} width={w} height={Math.max(0, shore - horizon + 8)} fill={`url(#${waterGrad})`} />
      {reflect && (
        <g clipPath={`url(#${waterClip})`} opacity={0.6}>
          <use href={`#${reflect}`} transform={`translate(0 ${r1(horizon * (1 + reflectScale))}) scale(1 ${-reflectScale})`} />
        </g>
      )}
      <path d={geo.ripples.join('')} stroke={alpha(SCENE.star, 0.16)} strokeWidth={1.1 * ss} strokeLinecap="round" />

      {/* Stranda */}
      <path d={fillPath(geo.strand, bottom + 2)} fill={`url(#${shoreGrad})`} />
      <path
        d={geo.strand.map(([x, y], i) => `${i ? 'L' : 'M'}${r1(x)} ${r1(y)}`).join('')}
        fill="none"
        stroke={tint(NATT.snowLit, 0.2)}
        strokeWidth={1.2 * ss}
        opacity={0.6}
      />
      {hytte !== null && hytte !== undefined && <Hytte x={hytte} y={yAt(geo.strand, hytte) + 6 * s} size={58 * s} />}
      {geo.front.map((tr, i) => (
        <path key={i} d={sprucePath(tr.x, yAt(geo.strand, tr.x) + 8, tr.h)} fill={shade(NATT.forest, 0.25)} />
      ))}
    </g>
  );
}

/** Lita hytte med torvtak dekket av snø og varmt lys i vinduet. (x, y) er midt på bunnen; `size` er bredden. */
export function Hytte({ x, y, size }: { x: number; y: number; size: number }) {
  const ss = useStrokeScale();
  const glow = useSvgId('hytte-glod');
  const wall = useSvgId('hytte-vegg');
  const w = size;
  const h = size * 0.5;
  const roof = size * 0.32;
  const wallCol = mix(SCENE.space, PAINTS.rod, 0.42);
  const snow = NATT.snowLit;
  const win = { x: x - w * 0.18, y: y - h * 0.62, w: w * 0.2, h: h * 0.38 };
  return (
    <g aria-hidden>
      <RadialGradient
        id={glow}
        stops={[
          [0, SCENE.warm, 0.55],
          [0.4, SCENE.warm, 0.18],
          [1, SCENE.warm, 0],
        ]}
      />
      <LinearGradient id={wall} x1={0} y1={0} x2={1} y2={0} stops={[[0, tint(wallCol, 0.08)], [1, shade(wallCol, 0.25)]]} />
      {/* Lys på snøen foran vinduet */}
      <ellipse cx={win.x + win.w / 2} cy={y + size * 0.06} rx={w * 0.45} ry={w * 0.09} fill={`url(#${glow})`} />
      <rect x={x - w / 2} y={y - h} width={w} height={h} fill={`url(#${wall})`} stroke={NATT.halo} strokeWidth={0.8 * ss} />
      {/* Stavlaft: vannrette linjer */}
      {[0.25, 0.5, 0.75].map((f) => (
        <line key={f} x1={x - w / 2} x2={x + w / 2} y1={y - h * f} y2={y - h * f} stroke={shade(wallCol, 0.35)} strokeWidth={0.8 * ss} />
      ))}
      <circle cx={win.x + win.w / 2} cy={win.y + win.h / 2} r={w * 0.32} fill={`url(#${glow})`} />
      <rect x={win.x} y={win.y} width={win.w} height={win.h} fill={tint(SCENE.warm, 0.25)} stroke={shade(wallCol, 0.5)} strokeWidth={1.2 * ss} />
      <line x1={win.x + win.w / 2} x2={win.x + win.w / 2} y1={win.y} y2={win.y + win.h} stroke={shade(wallCol, 0.5)} strokeWidth={1 * ss} />
      <line x1={win.x} x2={win.x + win.w} y1={win.y + win.h / 2} y2={win.y + win.h / 2} stroke={shade(wallCol, 0.5)} strokeWidth={1 * ss} />
      {/* Dør */}
      <rect x={x + w * 0.16} y={y - h * 0.78} width={w * 0.16} height={h * 0.78} fill={shade(wallCol, 0.3)} />
      {/* Pipe og tak med snø */}
      <rect x={x + w * 0.2} y={y - h - roof * 0.95} width={w * 0.09} height={roof * 0.6} fill={shade(NATT.rock, 0.1)} />
      <path
        d={`M${r1(x - w / 2 - w * 0.08)} ${r1(y - h + 1)}L${r1(x)} ${r1(y - h - roof)}L${r1(x + w / 2 + w * 0.08)} ${r1(y - h + 1)}Z`}
        fill={shade(NATT.rock, 0.2)}
      />
      <path
        d={`M${r1(x - w / 2 - w * 0.1)} ${r1(y - h + 2)}L${r1(x)} ${r1(y - h - roof - 3 * ss)}L${r1(x + w / 2 + w * 0.1)} ${r1(y - h + 2)}L${r1(x + w / 2 + w * 0.02)} ${r1(y - h - 2)}L${r1(x)} ${r1(y - h - roof + 4 * ss)}L${r1(x - w / 2 - w * 0.02)} ${r1(y - h - 2)}Z`}
        fill={snow}
      />
      <rect x={x + w * 0.19} y={y - h - roof * 0.98} width={w * 0.11} height={3 * ss} rx={1.5 * ss} fill={snow} />
    </g>
  );
}

/* ---------- Elektroner på vei ned ---------- */

/**
 * Elektroner som kommer ovenfra langs svakt skrå baner (jordas magnetfelt leder dem ned) og stopper når de har gitt
 * fra seg energien. `stopY` er der de stopper; `t` flytter dem (uten avspilling står de på ulike steder i banen).
 */
export function Elektroner({ xs, top, stopY, t, period = 2.6 }: { xs: number[]; top: number; stopY: number; t: number; period?: number }) {
  const s = useSceneScale();
  const ss = useStrokeScale();
  const trail = useSvgId('elektron-spor');
  const offsets = [0.15, 0.62, 0.38, 0.85, 0.05, 0.5];
  return (
    <g aria-hidden>
      <LinearGradient
        id={trail}
        stops={[
          [0, tint(ELEKTRON_FARGE, 0.35), 0],
          [1, tint(ELEKTRON_FARGE, 0.35), 0.9],
        ]}
      />
      {xs.map((x0, i) => {
        const u = (((t / period + (offsets[i % offsets.length] ?? 0)) % 1) + 1) % 1;
        const y = top + u * (stopY - top);
        const x = x0 + (y - top) * 0.12;
        const fadeOut = u > 0.82 ? Math.max(0, 1 - (u - 0.82) / 0.18) : 1;
        const fadeIn = Math.min(1, u / 0.08);
        const op = fadeOut * fadeIn;
        if (op <= 0.02) return null;
        const len = 34 * s;
        const tx = x - len * 0.12;
        const ty = y - len;
        return (
          <g key={i} opacity={op}>
            <path
              d={`M${r1(tx - 2 * ss)} ${r1(ty)}L${r1(x - 4.2 * s)} ${r1(y - 1)}L${r1(x + 4.2 * s)} ${r1(y - 1)}L${r1(tx + 2 * ss)} ${r1(ty)}Z`}
              fill={`url(#${trail})`}
            />
            <Elektron x={x} y={y} r={5.2 * s} />
          </g>
        );
      })}
    </g>
  );
}

/* ---------- Grafen: lys fra hver høyde ---------- */

export interface HoydeGrafProps {
  /** Venstre og høyre kant av panelet. */
  x0: number;
  x1: number;
  yOf: (h: number) => number;
  profile: AuroraProfile;
  /** Fargen til hver linje (tekst, også for strek). */
  colors: Record<LineId, string>;
  selected: LineId;
  /** Halvparten av lyset fra den valgte linja kommer fra dette området (km). */
  range: [number, number];
  /** Andelen av lyset hver linje står for (gir fyllet). */
  shares: Record<LineId, number>;
  ticks: number[];
  title: string;
}

/**
 * Graf oppå himmelen med samme høydeakse som draperiet: hvor i høyden hver farge lyser (hver kurve skalert til
 * samme topp, fyllet sterkere jo mer av lyset fargen står for). Den valgte fargen er tykk og har en klamme langs aksen
 * som viser hvor halvparten av lyset kommer fra.
 */
export function HoydeGraf({ x0, x1, yOf, profile, colors, selected, range, shares, ticks, title }: HoydeGrafProps) {
  const f = useTextScale();
  const ss = useStrokeScale();
  const fs = 17 * f * 0.78;
  const labelW = fs * 3.5;
  const ax = x0 + labelW + 10;
  const right = x1 - 8;
  const top = yOf(profile.h[profile.h.length - 1]!);
  const bot = yOf(profile.h[0]!);
  const panelTop = top - fs * 1.9;
  const panelBot = bot + fs * 1.6;
  const curves = LINE_ORDER.map((id) => {
    const arr = profile.I[id];
    const m = Math.max(...arr);
    const pts = profile.h.map((h, i) => [ax + (m > 0 ? ((arr[i] ?? 0) / m) * (right - ax) : 0), yOf(h)] as Pt);
    const line = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${r1(x)} ${r1(y)}`).join('');
    const area = `${line}L${r1(ax)} ${r1(yOf(profile.h[profile.h.length - 1]!))}L${r1(ax)} ${r1(yOf(profile.h[0]!))}Z`;
    return { id, line, area };
  });
  const order = [...curves].sort((a, b) => (a.id === selected ? 1 : 0) - (b.id === selected ? 1 : 0));
  const [lo, hi] = range;
  const hasRange = Number.isFinite(lo) && Number.isFinite(hi);
  return (
    <g>
      <rect
        x={x0}
        y={panelTop}
        width={x1 - x0}
        height={panelBot - panelTop}
        rx={10}
        fill={NATT.panel}
        stroke={alpha(SCENE.star, 0.18)}
        strokeWidth={1 * ss}
      />
      <HimmelTekst x={(x0 + x1) / 2} y={panelTop + fs * 1.25} size={0.78} weight={650}>
        {title}
      </HimmelTekst>
      {ticks.map((h) => (
        <g key={h}>
          <line x1={ax} x2={right} y1={yOf(h)} y2={yOf(h)} stroke={NATT.grid} strokeWidth={1 * ss} />
          <HimmelTekst x={ax - 7} y={yOf(h) + fs * 0.35} anchor="end" size={0.72} weight={550} muted>
            {`${h} km`}
          </HimmelTekst>
        </g>
      ))}
      {order.map((c) => {
        const sel = c.id === selected;
        return (
          <g key={c.id}>
            <path d={c.area} fill={colors[c.id]} opacity={(sel ? 0.3 : 0.12) * Math.min(1, 0.4 + 2 * shares[c.id])} />
            <path
              d={c.line}
              fill="none"
              stroke={colors[c.id]}
              strokeWidth={(sel ? 3 : 1.6) * ss}
              strokeLinejoin="round"
              opacity={sel ? 1 : 0.7}
            />
          </g>
        );
      })}
      <line x1={ax} x2={ax} y1={top} y2={bot} stroke={NATT.rule} strokeWidth={1.3 * ss} />
      {hasRange && (
        <g>
          <line
            x1={ax}
            x2={ax}
            y1={yOf(hi)}
            y2={yOf(lo)}
            stroke={colors[selected]}
            strokeWidth={6 * ss}
            strokeLinecap="round"
          />
          <line x1={ax} x2={ax} y1={yOf(hi)} y2={yOf(lo)} stroke={NATT.halo} strokeWidth={1.2 * ss} opacity={0.5} />
        </g>
      )}
      <HimmelTekst x={(ax + right) / 2} y={bot + fs * 1.15} size={0.72} weight={550} muted>
        lysstyrke →
      </HimmelTekst>
    </g>
  );
}
