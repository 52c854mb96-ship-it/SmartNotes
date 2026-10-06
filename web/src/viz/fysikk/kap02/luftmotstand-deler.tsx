/**
 * Egne gjenstander til «Fall med luftmotstand» (k2-luftmotstand), i samme stil som scene-kit-et: landskapet langt
 * under en fallskjermhopper sett i perspektiv (jorder, skog, vann og en elv), haugskyer sett ovenfra med skygge på
 * bakken, hoppflyet og en høydestripe. Toninger fra core.tsx, SCENE-farger, kontur og myke skygger.
 *
 * Perspektivet: et punkt på bakken med dybde D (avstand fra kameraet) ligger u = D₀/D under horisonten, der D₀ er
 * dybden ved nederste kant når hopperen er i 4 000 m. Høyden over bakken skalerer bare avstanden til horisonten
 * (y − horisont ∝ høyde), så hele bakken kan tegnes én gang og strekkes loddrett når hopperen faller.
 */
import { memo, useMemo } from 'react';
import { Txt, VIZ, fmt, useTextScale } from '../../kit';
import { LinearGradient, PAINTS, RadialGradient, SCENE, alpha, materialStops, mix, sceneRandom, shade, tint, useStrokeScale, useSvgId } from '../../kit/scene';

type Pt = [number, number];
const r1 = (v: number) => Math.round(v * 10) / 10;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const smoothPath = (pts: Pt[]): string => {
  // Lukket, glatt form gjennom midtpunktene mellom kontrollpunktene.
  const n = pts.length;
  if (n < 3) return '';
  const mid = (a: Pt, b: Pt): Pt => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  const m0 = mid(pts[n - 1]!, pts[0]!);
  let d = `M${r1(m0[0])},${r1(m0[1])}`;
  for (let i = 0; i < n; i++) {
    const p = pts[i]!;
    const m = mid(p, pts[(i + 1) % n]!);
    d += `Q${r1(p[0])},${r1(p[1])} ${r1(m[0])},${r1(m[1])}`;
  }
  return `${d}Z`;
};

/** Høyden bakken og skyene er tegnet for. Lavere høyde strekker bakken mindre ned fra horisonten. */
export const REF_HEIGHT = 4000;
/** Brennvidden i forhold til avstanden fra horisonten til nederste kant (større = flatere bakke). */
const FOCAL = 5.5;
/** Bakken tegnes ned til u = U_MAX, så den fyller bildet også når hopperen har falt 1 300 m (høyde 0,65 · REF). */
const U_MAX = 1.8;
const U_MIN = 0.03;

/* ---------------------------------------------------------------- Bakken sett fra lufta */

interface GroundGeo {
  /** Én sti per farge (indeks i GROUND_COLORS). */
  layers: string[];
  lakes: string;
  river: string;
}

// Litt dempet mot åsene i det fjerne, så mosaikken ikke blir for sterk.
const GROUND_COLORS = [
  mix(SCENE.foliageDark, SCENE.hillFar, 0.12), // granskog
  mix(SCENE.foliage, SCENE.foliageDark, 0.45), // blandingsskog
  mix(SCENE.grassDark, SCENE.hillNear, 0.2), // beite
  mix(SCENE.grass, SCENE.hillNear, 0.25), // eng
  mix(SCENE.grass, SCENE.gold, 0.32), // kornåker
  mix(SCENE.hillNear, SCENE.soil, 0.35), // pløyd jord og myr
];

function groundGeometry(x0: number, w: number, cx: number, hy: number, hpx: number, seed: number): GroundGeo {
  const F = FOCAL * hpx;
  const rand = sceneRandom(seed * 4099 + 17);
  const ph = [rand() * 6.28, rand() * 6.28, rand() * 6.28, rand() * 6.28];
  const P = (X: number, u: number): Pt => [cx + X * u * F, hy + hpx * u];
  // Store områder med skog eller jordbruk (glatt «støy» i verdenskoordinater X og D = 1/u).
  const region = (X: number, D: number) =>
    Math.sin(6.1 * X + 1.7 * D + ph[0]!) + Math.sin(-3.3 * X + 4.6 * D + ph[1]!) + 0.45 * Math.sin(11.3 * X - 7.1 * D + ph[2]!);
  const layers = GROUND_COLORS.map(() => '');
  const quad = (a: Pt, b: Pt, c: Pt, d: Pt) => `M${r1(a[0])},${r1(a[1])}L${r1(b[0])},${r1(b[1])}L${r1(c[0])},${r1(c[1])}L${r1(d[0])},${r1(d[1])}Z`;
  // Radene blir tynnere mot horisonten. Tre og tre rader deler grensene mellom jordene, så linjene peker mot
  // forsvinningspunktet som i et ekte flyfoto. Hjørnene inne i blokka er litt forskjøvet, så jordene ikke blir
  // rene rektangler.
  const ratio = 0.86;
  const rowsInBlock = 3;
  let u = U_MAX;
  while (u > U_MIN) {
    const us = [u];
    for (let i = 0; i < rowsInBlock; i++) us.push(us[us.length - 1]! * ratio);
    const uTop = us[us.length - 1]!;
    const uMid = Math.sqrt(u * uTop);
    const xLo = (x0 - 60 - cx) / (uTop * F);
    const xHi = (x0 + w + 60 - cx) / (uTop * F);
    const bounds: number[] = [xLo];
    while (bounds[bounds.length - 1]! < xHi) bounds.push(bounds[bounds.length - 1]! + (45 + rand() * 80) / (uMid * F));
    const verts: Pt[][] = us.map((uu, r) =>
      bounds.map((X, i) => {
        const inner = i > 0 && i < bounds.length - 1;
        const dx = inner ? (rand() - 0.5) * 0.4 * ((bounds[i + 1]! - bounds[i - 1]!) / 2) : 0;
        const du = r > 0 && r < rowsInBlock ? 1 + (rand() - 0.5) * 0.07 : 1;
        return P(X + dx, uu * du);
      }),
    );
    for (let r = 0; r < rowsInBlock; r++) {
      const ub = us[r]!;
      const ut = us[r + 1]!;
      for (let i = 0; i < bounds.length - 1; i++) {
        const n = region((bounds[i]! + bounds[i + 1]!) / 2, 2 / (ub + ut)) + (rand() - 0.5) * 0.55;
        const field = rand();
        const c = n > 0.55 ? 0 : n > -0.05 ? 1 : n > -0.65 ? (field < 0.45 ? 3 : field < 0.8 ? 2 : 4) : field < 0.4 ? 4 : field < 0.75 ? 3 : 5;
        layers[c] += quad(verts[r]![i]!, verts[r]![i + 1]!, verts[r + 1]![i + 1]!, verts[r + 1]![i]!);
      }
    }
    u = uTop;
  }

  // Innsjøer: uregelmessige former i bakkeplanet, projisert (blir flate langt unna).
  let lakes = '';
  const nLakes = 7;
  for (let i = 0; i < nLakes; i++) {
    const uc = 0.12 + Math.pow(rand(), 0.8) * 1.3;
    const sx = x0 + w * ((i + 0.15 + rand() * 0.7) / nLakes);
    const X = (sx - cx) / (uc * F);
    const D = 1 / uc;
    const R = (0.025 + rand() * 0.05) * D * 0.55;
    const stretch = 1.2 + rand() * 1.4;
    const pts: Pt[] = [];
    const m = 11;
    for (let j = 0; j < m; j++) {
      const th = (j / m) * Math.PI * 2;
      const rr = R * (0.7 + rand() * 0.55);
      pts.push(P(X + rr * stretch * Math.cos(th), 1 / (D + rr * Math.sin(th))));
    }
    lakes += smoothPath(pts);
  }

  // Ei elv som slynger seg fra nederste kant mot horisonten.
  const left: Pt[] = [];
  const right: Pt[] = [];
  const X0 = (x0 + w * (0.62 + rand() * 0.2) - cx) / (U_MAX * F);
  for (let i = 0; i <= 60; i++) {
    const uu = U_MAX * Math.pow(0.045 / U_MAX, i / 60);
    const D = 1 / uu;
    const Xc = X0 + 0.16 * Math.sin(D * 1.9 + ph[3]!) + 0.05 * D;
    const half = 0.006 * (1 + 0.25 * Math.sin(D * 5));
    left.push(P(Xc - half, uu));
    right.push(P(Xc + half, uu));
  }
  const river = `M${[...left, ...right.reverse()].map(([px, py]) => `${r1(px)},${r1(py)}`).join('L')}Z`;

  return { layers, lakes, river };
}

/**
 * Landskapet langt under en fallskjermhopper, sett skrått ovenfra mot horisonten: jorder, skog, innsjøer og ei elv
 * i perspektiv, med dis mot horisonten. `hoyde` (m over bakken) strekker bakken loddrett: jo lavere, jo nærmere
 * horisonten ligger alt (som når et fly går ned).
 *   <Flyfoto x={0} w={800} horisont={300} bunn={400} hoyde={h} />
 * Ankerpunkt: horisontlinjen (y = `horisont`) fra x til x + w; bakken fyller ned til `bunn`.
 */
export const Flyfoto = memo(function Flyfoto({
  x,
  w,
  horisont,
  bunn,
  hoyde,
  seed = 1,
}: {
  x: number;
  w: number;
  horisont: number;
  bunn: number;
  hoyde: number;
  seed?: number;
}) {
  const id = useSvgId('lm-bakke');
  const hpx = bunn - horisont;
  const cx = x + w / 2;
  const geo = useMemo(() => groundGeometry(x, w, cx, horisont, hpx, seed), [x, w, cx, horisont, hpx, seed]);
  const sc = clamp((Number.isFinite(hoyde) ? hoyde : REF_HEIGHT) / REF_HEIGHT, 0.6, 1.2);
  if (!(hpx > 0)) return null;
  return (
    <g aria-hidden>
      <LinearGradient
        id={`${id}h`}
        userSpace
        x1={0}
        y1={horisont}
        x2={0}
        y2={bunn}
        stops={[
          [0, SCENE.skyBottom, 0.96],
          [0.16, SCENE.skyBottom, 0.66],
          [0.5, SCENE.skyBottom, 0.38],
          [1, SCENE.skyBottom, 0.2],
        ]}
      />
      <LinearGradient
        id={`${id}w`}
        userSpace
        x1={0}
        y1={horisont}
        x2={0}
        y2={bunn}
        stops={[
          [0, SCENE.waterLight],
          [1, SCENE.water],
        ]}
      />
      <rect x={x} y={horisont} width={w} height={hpx} fill={GROUND_COLORS[1]} />
      <g transform={`translate(0 ${r1(horisont)}) scale(1 ${Math.round(sc * 1000) / 1000}) translate(0 ${r1(-horisont)})`}>
        {geo.layers.map((d, i) => (d ? <path key={i} d={d} fill={GROUND_COLORS[i]} /> : null))}
        <path d={geo.lakes} fill={`url(#${id}w)`} />
        <path d={geo.lakes} fill="none" stroke={tint(SCENE.waterLight, 0.3)} strokeWidth={0.8} opacity={0.6} vectorEffect="non-scaling-stroke" />
        <path d={geo.river} fill={`url(#${id}w)`} />
      </g>
      <rect x={x} y={horisont} width={w} height={hpx} fill={`url(#${id}h)`} />
    </g>
  );
});

/* ---------------------------------------------------------------- Fjell i horisonten */

/**
 * Fjell langt borte i horisonten, sett fra flyhøyde: to lave rygger med snø på toppene, blå og bleke av dis
 * (ingen trær, de er for små til å synes herfra). `h` er høyden på de høyeste toppene over horisonten.
 *   <FjerneFjell x={0} y={300} w={800} h={34} />
 * Ankerpunkt: (x, y) er venstre ende av horisontlinjen.
 */
export const FjerneFjell = memo(function FjerneFjell({ x, y, w, h, seed = 1 }: { x: number; y: number; w: number; h: number; seed?: number }) {
  const id = useSvgId('lm-fjell');
  const geo = useMemo(() => {
    const rand = sceneRandom(seed * 131 + 7);
    const p0 = rand() * 6;
    const ridge = (amp: number, n: number) => {
      const peaks = Array.from({ length: n }, () => ({ c: x + rand() * w, a: amp * (0.35 + rand() * 0.65), wd: w * (0.05 + rand() * 0.09) }));
      const pts: Pt[] = [];
      for (let px = x - 4; px <= x + w + 4; px += 3) {
        let hh = amp * 0.06;
        for (const p of peaks) hh = Math.max(hh, p.a * Math.pow(Math.max(0, 1 - Math.abs(px - p.c) / p.wd), 1.25));
        pts.push([px, y - hh - Math.sin(px * 0.21 + p0) * amp * 0.02]);
      }
      return `M${r1(x - 4)},${r1(y + 2)}L${pts.map(([a, b]) => `${r1(a)},${r1(b)}`).join('L')}L${r1(x + w + 4)},${r1(y + 2)}Z`;
    };
    return { far: ridge(h, 9), near: ridge(h * 0.55, 12) };
  }, [x, y, w, h, seed]);
  if (!(w > 0) || !(h > 0)) return null;
  const snowLine = y - h * 0.55;
  return (
    <g aria-hidden>
      <clipPath id={`${id}s`}>
        <rect x={x - 4} y={y - h - 4} width={w + 8} height={snowLine - (y - h - 4)} />
      </clipPath>
      <path d={geo.far} fill={mix(SCENE.mountain, SCENE.skyBottom, 0.45)} />
      <path d={geo.far} fill={mix(SCENE.snowcap, SCENE.skyBottom, 0.35)} clipPath={`url(#${id}s)`} />
      <path d={geo.near} fill={mix(SCENE.mountainShade, SCENE.skyBottom, 0.35)} />
    </g>
  );
});

/* ---------------------------------------------------------------- Skyer under hopperen */

interface CloudPlan {
  /** Plassering i bakkeplanet (X i enheter av D₀, u = D₀/D). */
  X: number;
  u: number;
  /** Bredde i enheter av D₀. */
  W: number;
  d: string;
  top: string;
  base: string;
}

function planClouds(x0: number, w: number, cx: number, hpx: number, n: number, seed: number): CloudPlan[] {
  const F = FOCAL * hpx;
  const rand = sceneRandom(seed * 7717 + 3);
  const out: CloudPlan[] = [];
  // Alle delene går med klokka, så de smelter sammen til én form (nonzero) uten hull der de overlapper.
  const r3 = (v: number) => Math.round(v * 1000) / 1000;
  const ell = (ex: number, ey: number, rx: number, ry: number) =>
    `M${r3(ex - rx)},${r3(ey)}a${r3(rx)},${r3(ry)} 0 1 1 ${r3(2 * rx)},0a${r3(rx)},${r3(ry)} 0 1 1 ${r3(-2 * rx)},0Z`;
  for (let i = 0; i < n; i++) {
    const u = 0.3 + rand() * 1.2;
    const sx = x0 + w * ((i + 0.1 + rand() * 0.8) / n);
    const X = (sx - cx) / (u * F);
    const W = (0.08 + rand() * 0.06) * (0.8 + 0.4 / u);
    // Haugsky sett skrått ovenfra: en flat, klumpete flate (ellipser i to rader), 1 bred og ca. 0,3 høy.
    const puffs: [number, number, number, number][] = [];
    const m = 6 + Math.floor(rand() * 3);
    for (let j = 0; j < m; j++) {
      const t = j / (m - 1);
      const rx = 0.1 + 0.08 * Math.sin(Math.PI * t) + rand() * 0.04;
      puffs.push([-0.4 + 0.8 * t + (rand() - 0.5) * 0.05, -0.06 - rand() * 0.05 - 0.05 * Math.sin(Math.PI * t), rx, rx * (0.55 + rand() * 0.15)]);
    }
    for (let j = 0; j < 3; j++) {
      const rx = 0.12 + rand() * 0.06;
      puffs.push([-0.22 + 0.22 * j + (rand() - 0.5) * 0.08, -0.16 - rand() * 0.05, rx, rx * 0.6]);
    }
    let d = ell(0, -0.02, 0.48, 0.07);
    for (const [px, py, rx, ry] of puffs) d += ell(px, py, rx, ry);
    // Den solbelyste toppen (mindre ellipser forskjøvet oppover til venstre) og skyggen langs bunnen.
    let top = '';
    for (const [px, py, rx, ry] of puffs) top += ell(px - rx * 0.12, py - ry * 0.3, rx * 0.6, ry * 0.5);
    out.push({ X, u, W, d, top, base: ell(0.02, -0.01, 0.44, 0.05) });
  }
  return out.sort((a, b) => a.u - b.u);
}

/**
 * Haugskyer under hopperen, sett skrått ovenfra, med skygge på bakken rett under. Skyene ligger i `skyhoyde` m over
 * bakken: når hopperen faller mot dem, glir de opp mot horisonten (og blir større i forhold til landskapet).
 * Bruk samme x, w, horisont og bunn som Flyfoto.
 *   <SkyerUnder x={0} w={800} horisont={300} bunn={400} hoyde={h} skyhoyde={1800} antall={5} />
 */
export const SkyerUnder = memo(function SkyerUnder({
  x,
  w,
  horisont,
  bunn,
  hoyde,
  skyhoyde = 1800,
  antall = 5,
  seed = 1,
}: {
  x: number;
  w: number;
  horisont: number;
  bunn: number;
  hoyde: number;
  skyhoyde?: number;
  antall?: number;
  seed?: number;
}) {
  const id = useSvgId('lm-sky');
  const hpx = bunn - horisont;
  const cx = x + w / 2;
  const F = FOCAL * hpx;
  const plans = useMemo(() => planClouds(x, w, cx, hpx, antall, seed), [x, w, cx, hpx, antall, seed]);
  if (!(hpx > 0) || !Number.isFinite(hoyde)) return null;
  const above = Math.max(0, hoyde - skyhoyde) / REF_HEIGHT;
  const ground = clamp(hoyde / REF_HEIGHT, 0.6, 1.2);
  return (
    <g aria-hidden>
      <LinearGradient
        id={id}
        stops={[
          [0, tint(SCENE.cloud, 0.35)],
          [0.5, SCENE.cloud],
          [1, mix(SCENE.cloudShade, SCENE.skyBottom, 0.2)],
        ]}
      />
      {/* Skyggene på bakken, litt til høyre for skyene (sola står til venstre). */}
      {plans.map((c, i) => {
        const sw = c.W * c.u * F;
        const gx = cx + c.X * c.u * F + sw * 0.2;
        const gy = horisont + hpx * c.u * ground;
        return (
          <ellipse
            key={`s${i}`}
            cx={gx}
            cy={gy}
            rx={sw * 0.44}
            ry={Math.max(0.6, ((sw * 0.44 * hpx * c.u) / F) * ground)}
            fill={SCENE.shadow}
            opacity={clamp(c.u, 0.2, 1) * 0.5}
          />
        );
      })}
      {plans.map((c, i) => {
        const sw = c.W * c.u * F;
        const sx = cx + c.X * c.u * F;
        const sy = horisont + hpx * c.u * above;
        // Langt unna og nær horisonten blir skyene blekere (dis).
        const haze = clamp(1 - (sy - horisont) / (hpx * 0.6), 0, 1);
        return (
          <g key={i} transform={`translate(${r1(sx)} ${r1(sy)}) scale(${r1(sw)} ${r1(sw * 0.8)})`} opacity={0.94 - 0.4 * haze}>
            <path d={c.base} fill={SCENE.shadow} opacity={0.35} transform="translate(0 0.03)" />
            <path d={c.d} fill={`url(#${id})`} />
            <path d={c.top} fill={tint(SCENE.cloud, 0.3)} opacity={0.75} />
          </g>
        );
      })}
    </g>
  );
});

/* ---------------------------------------------------------------- Hoppflyet */

/** Lengden på hoppflyet i meter (et enmotors turbopropfly med høye vinger, vanlig i norske fallskjermklubber). */
export const FLY_LENGDE = 12.7;

/**
 * Hoppfly sett fra siden, nesa mot høyre: enmotors turbopropfly med høye vinger og vingestag, faste hjul, åpen dør
 * bak og en propell som er en uskarp skive (den går rundt). `size` er lengden fra nesa til halen.
 *   <Hoppfly x={150} y={120} size={150} />
 * Ankerpunkt: midt på flykroppen.
 */
export function Hoppfly({ x, y, size = 150, lakk = 'rod' }: { x: number; y: number; size?: number; lakk?: keyof typeof PAINTS }) {
  const ss = useStrokeScale();
  const id = useSvgId('lm-fly');
  const k = size / 100;
  const ow = (0.9 * ss) / k;
  const body =
    'M48,-4.6Q47,-6.6 38,-7Q33,-7.4 27.5,-10.6L-12,-10.8Q-30,-9.6 -49,-6.4Q-51.5,-5.8 -51.5,-3.6Q-51.4,-1.8 -49,-1.4Q-30,1.6 -12,5.6L22,5.8Q38,5.4 45.5,3Q49.4,1.4 49.4,-1.4Q49.4,-3.4 48,-4.6Z';
  const fin = 'M-33,-9.6L-45.5,-24.5Q-47.5,-26 -50.5,-25.6L-52.2,-24.6L-51.2,-6Z';
  const rudder = 'M-46.2,-25.2Q-47.6,-26 -50.5,-25.6L-52.2,-24.6L-51.8,-16.5L-47,-16.5Z';
  const stab = 'M-38,-3.8Q-44,-6.4 -55,-4.8Q-56,-4 -55,-3.2Q-46,-2.4 -38,-3.8Z';
  const wing = 'M25.5,-11.2Q24.6,-14.6 19,-14.8L5,-13.4Q3.6,-13 3.8,-11.6L4.4,-10.9L24,-10.6Z';
  const stripe = 'M49,-2.2L-51,-4.6L-51,-3.2L49,0.4Z';
  return (
    <g transform={`translate(${r1(x)} ${r1(y)}) scale(${Math.round(k * 1000) / 1000})`} aria-hidden>
      <LinearGradient id={`${id}k`} stops={materialStops(PAINTS.hvit, 1.1)} />
      <LinearGradient id={`${id}v`} stops={materialStops(PAINTS.hvit, 1.4)} />
      <clipPath id={`${id}c`}>
        <path d={body} />
      </clipPath>
      {/* Bakerste hjul og stag (bak kroppen) */}
      <g stroke={SCENE.metalDark} strokeWidth={1.3} strokeLinecap="round">
        <path d="M6,5.4L3,12.6" />
        <path d="M40,4.4L40.6,12.4" />
      </g>
      <circle cx={2.6} cy={13.6} r={2.9} fill={SCENE.rubber} stroke={SCENE.outline} strokeWidth={ow} />
      <circle cx={2.6} cy={13.6} r={1.1} fill={SCENE.metal} />
      <circle cx={40.6} cy={13.2} r={2.3} fill={SCENE.rubber} stroke={SCENE.outline} strokeWidth={ow} />
      <circle cx={40.6} cy={13.2} r={0.9} fill={SCENE.metal} />
      <path d={stab} fill={`url(#${id}v)`} stroke={SCENE.outline} strokeWidth={ow} strokeLinejoin="round" />
      <path d={fin} fill={`url(#${id}v)`} stroke={SCENE.outline} strokeWidth={ow} strokeLinejoin="round" />
      <path d={rudder} fill={PAINTS[lakk]} />
      <path d={body} fill={`url(#${id}k)`} />
      <g clipPath={`url(#${id}c)`}>
        <path d={stripe} fill={PAINTS[lakk]} />
        {/* Motordeksel litt mørkere, og skygge under buken */}
        <path d="M36,-12L36,8L60,8L60,-12Z" fill={SCENE.shadow} opacity={0.18} />
        <path d="M-60,2L60,2L60,10L-60,10Z" fill={SCENE.shadow} opacity={0.25} />
        {/* Vinduene: cockpit og tre i kabinen */}
        <path d="M33.6,-7.1Q30,-8 27.2,-10L19.5,-10L19.5,-6.3Z" fill={mix(SCENE.skyTop, SCENE.metalDark, 0.6)} />
        {[11.5, 3.5, -4.5].map((wx) => (
          <rect key={wx} x={wx} y={-8.6} width={5.2} height={3.6} rx={1} fill={mix(SCENE.skyTop, SCENE.metalDark, 0.6)} />
        ))}
        {/* Den åpne døra bak: mørk åpning med karm */}
        <rect x={-21} y={-9.6} width={8.6} height={13.4} rx={1} fill={shade(SCENE.metalDark, 0.55)} stroke={SCENE.outline} strokeWidth={ow} />
        <rect x={-20} y={-8.4} width={2.4} height={11} fill={SCENE.metalDark} opacity={0.6} />
        {/* Høylys langs taket */}
        <path d="M27,-9.6L-12,-9.8Q-28,-8.8 -46,-5.8" fill="none" stroke={SCENE.highlight} strokeWidth={1.2} opacity={0.9} />
      </g>
      <path d={body} fill="none" stroke={SCENE.outline} strokeWidth={ow} strokeLinejoin="round" />
      {/* Vingen (sett fra siden: profilen ved roten) og vingestaget */}
      <path d="M10,5L17.5,-10.6" stroke={SCENE.metal} strokeWidth={1.4} strokeLinecap="round" />
      <path d="M10,5L17.5,-10.6" stroke={SCENE.outline} strokeWidth={0.4} strokeLinecap="round" opacity={0.6} />
      <path d={wing} fill={`url(#${id}v)`} stroke={SCENE.outline} strokeWidth={ow} strokeLinejoin="round" />
      {/* Propellen: nav og uskarp skive */}
      <ellipse cx={50.6} cy={-1.6} rx={1.3} ry={12.5} fill={SCENE.metalDark} opacity={0.18} />
      <ellipse cx={50.6} cy={-1.6} rx={1.3} ry={12.5} fill="none" stroke={SCENE.metalDark} strokeWidth={0.4} opacity={0.4} />
      <path d="M49,-4.4Q53.6,-3.2 53.6,-1.6Q53.6,0 49,1.2Z" fill={SCENE.metal} stroke={SCENE.outline} strokeWidth={ow} />
    </g>
  );
}

/* ---------------------------------------------------------------- Høydestripe */

/**
 * Loddrett stripe for høyden over bakken, fra 0 m nederst til `maks` øverst, med streker for hver 1 000 m og en
 * markør for hopperen med høyden på et skilt. Stripa er tonet fra himmel øverst til bakke nederst.
 * Ankerpunkt: (x, bunn) er 0 m og (x, topp) er `maks`. Tallene står til venstre for stripa.
 */
export function Hoydestripe({ x, topp, bunn, hoyde, maks }: { x: number; topp: number; bunn: number; hoyde: number; maks: number }) {
  const f = useTextScale();
  const ss = useStrokeScale();
  const id = useSvgId('lm-stripe');
  if (!(maks > 0) || !(bunn > topp)) return null;
  const pxm = (bunn - topp) / maks;
  const yh = bunn - clamp(hoyde, 0, maks) * pxm;
  const bw = 9 * ss;
  const tagH = 17 * f * 0.82 * 1.55;
  const tagY = clamp(yh, topp + tagH / 2, bunn - tagH / 2);
  const ticks: number[] = [];
  for (let h = 0; h <= maks + 1e-9; h += 1000) ticks.push(h);
  const label = `${fmt(hoyde, 0)} m`;
  return (
    <g>
      <LinearGradient
        id={id}
        userSpace
        x1={0}
        y1={topp}
        x2={0}
        y2={bunn}
        stops={[
          [0, SCENE.skyTop],
          [0.85, SCENE.skyBottom],
          [0.93, SCENE.grass],
          [1, SCENE.grassDark],
        ]}
      />
      <rect x={x - bw / 2 - 2 * ss} y={topp - 6} width={bw + 4 * ss} height={bunn - topp + 12} rx={(bw + 4 * ss) / 2} fill={VIZ.surface} opacity={0.75} />
      <rect x={x - bw / 2} y={topp} width={bw} height={bunn - topp} rx={bw / 2} fill={`url(#${id})`} stroke={SCENE.outline} strokeWidth={0.9 * ss} />
      {ticks.map((h) => {
        const y = bunn - h * pxm;
        const hidden = Math.abs(y - tagY) < tagH * 0.9;
        return (
          <g key={h}>
            <line x1={x - bw / 2 - 5 * ss} x2={x - bw / 2} y1={y} y2={y} stroke={VIZ.ink} strokeWidth={1.2 * ss} />
            {!hidden && (
              <Txt x={x - bw / 2 - 8 * ss} y={y + 5 * f * 0.78} anchor="end" size={0.72} weight={600} muted>
                {h === 0 ? '0 m' : `${fmt(h / 1000, 0)} km`}
              </Txt>
            )}
          </g>
        );
      })}
      {/* Hopperen: markør på stripa og høyden på et skilt til venstre */}
      <line x1={x - bw / 2 - 3 * ss} x2={x + bw / 2 + 3 * ss} y1={yh} y2={yh} stroke={VIZ.surface} strokeWidth={4.5 * ss} />
      <line x1={x - bw / 2 - 3 * ss} x2={x + bw / 2 + 3 * ss} y1={yh} y2={yh} stroke={VIZ.ink} strokeWidth={2.2 * ss} />
      <HeightTag x={x - bw / 2 - 8 * ss} y={tagY} text={label} />
      <Txt x={x} y={topp - 14 * ss} anchor="end" size={0.72} weight={650} muted>
        Høyde
      </Txt>
      {/* Et lite fly ved utspranget i 4 000 m */}
      <circle cx={x} cy={topp} r={2.4 * ss} fill={alpha(VIZ.ink, 0.8)} />
    </g>
  );
}

/** Skilt med høyden, festet til markøren på stripa (høyre kant ved x). */
function HeightTag({ x, y, text }: { x: number; y: number; text: string }) {
  const f = useTextScale();
  const ss = useStrokeScale();
  const fs = 17 * f * 0.82;
  const w = text.length * fs * 0.6 + 14 * f;
  const h = fs * 1.55;
  return (
    <g>
      <polygon points={`${r1(x - 1)},${r1(y - 5 * ss)} ${r1(x + 5 * ss)},${r1(y)} ${r1(x - 1)},${r1(y + 5 * ss)}`} fill={VIZ.surface} stroke={SCENE.outline} strokeWidth={0.9 * ss} />
      <rect x={x - w} y={y - h / 2} width={w} height={h} rx={h * 0.3} fill={VIZ.surface} stroke={SCENE.outline} strokeWidth={0.9 * ss} />
      <Txt x={x - w / 2} y={y + fs * 0.34} size={0.82} weight={700} halo={false}>
        {text}
      </Txt>
    </g>
  );
}

/* ---------------------------------------------------------------- Hopperen sett nedenfra */

type Limbs = { au: number; af: number; bt: number; bs: number; shin: number };
const LIMBS_HODE: Limbs = { au: -80, af: -86, bt: 3, bs: 3, shin: 1 };
const LIMBS_MAGE: Limbs = { au: 8, af: 84, bt: 24, bs: 32, shin: 0.55 };
const LIMBS_SPREDT: Limbs = { au: 22, af: 48, bt: 32, bs: 36, shin: 0.85 };
const LIMBS_VINGE: Limbs = { au: -10, af: -12, bt: 15, bs: 16, shin: 1 };
const lerpLimbs = (a: Limbs, b: Limbs, t: number): Limbs => ({
  au: a.au + (b.au - a.au) * t,
  af: a.af + (b.af - a.af) * t,
  bt: a.bt + (b.bt - a.bt) * t,
  bs: a.bs + (b.bs - a.bs) * t,
  shin: a.shin + (b.shin - a.shin) * t,
});

/**
 * Fallskjermhopperen sett rett nedenfra, i en rund ramme med himmel bak: silhuetten er arealet kroppen vender mot
 * lufta. `belly` 0 = hodet først (kroppen peker rett mot betrakteren, bare hjelmen og skuldrene synes), 1 = magen
 * ned; `spread` 0–1 = armer og bein spredt; `wings` 0–1 = vingedrakt med stoff mellom armer og kropp og mellom beina.
 * Skalaen er fast, så arealene kan sammenlignes.
 *   <Silhuett x={80} y={210} r={44} belly={1} spread={0} wings={0} />
 * Ankerpunkt: midten av sirkelen.
 */
export function Silhuett({
  x,
  y,
  r,
  belly,
  spread,
  wings,
  lakk = 'oransje',
}: {
  x: number;
  y: number;
  r: number;
  belly: number;
  spread: number;
  wings: number;
  lakk?: keyof typeof PAINTS;
}) {
  const ss = useStrokeScale();
  const id = useSvgId('lm-silhuett');
  let p = lerpLimbs(LIMBS_HODE, LIMBS_MAGE, belly);
  p = lerpLimbs(p, LIMBS_SPREDT, spread);
  p = lerpLimbs(p, LIMBS_VINGE, wings);
  // Kroppen er ca. 100 enheter lang; skalaen er fast (den største silhuetten fyller sirkelen).
  const k = (r * 1.72) / 108;
  // Forkorting langs kroppsaksen når hopperen stuper (cos av vinkelen mellom kroppen og bakken).
  const c = 0.2 + 0.8 * belly;
  const T = (px: number, py: number): Pt => [x + px * k, y + (py - 4) * c * k];
  const D2R = Math.PI / 180;
  const arm = (side: 1 | -1) => {
    const s: Pt = [side * 12, -24];
    const e: Pt = [s[0] + side * 16 * Math.cos(p.au * D2R), s[1] - 16 * Math.sin(p.au * D2R)];
    const w: Pt = [e[0] + side * 15 * Math.cos(p.af * D2R), e[1] - 15 * Math.sin(p.af * D2R)];
    return [s, e, w].map(([a, b]) => T(a, b));
  };
  const leg = (side: 1 | -1) => {
    const h: Pt = [side * 7, 11];
    const kn: Pt = [h[0] + side * 24 * Math.sin(p.bt * D2R), h[1] + 24 * Math.cos(p.bt * D2R)];
    const an: Pt = [kn[0] + side * 22 * p.shin * Math.sin(p.bs * D2R), kn[1] + 22 * p.shin * Math.cos(p.bs * D2R)];
    return [h, kn, an].map(([a, b]) => T(a, b));
  };
  const arms = [arm(1), arm(-1)];
  const legs = [leg(1), leg(-1)];
  const line = (pts: Pt[]) => `M${pts.map(([a, b]) => `${r1(a)},${r1(b)}`).join('L')}`;
  const torso = smoothPath(
    (
      [
        [-14, -27],
        [-14, -12],
        [-11, 6],
        [-12, 14],
        [0, 17],
        [12, 14],
        [11, 6],
        [14, -12],
        [14, -27],
        [0, -30],
      ] as Pt[]
    ).map(([a, b]) => T(a, b)),
  );
  const head = T(0, -37);
  const suit = PAINTS[lakk];
  const edge = shade(suit, 0.4);
  const ow = 1 * ss;
  const limb = (pts: Pt[], wd: number) => (
    <>
      <path d={line(pts)} fill="none" stroke={edge} strokeWidth={wd * k + 2 * ow} strokeLinecap="round" strokeLinejoin="round" />
      <path d={line(pts)} fill="none" stroke={suit} strokeWidth={wd * k} strokeLinecap="round" strokeLinejoin="round" />
    </>
  );
  // Vingene: fra skulderen langs armen til håndleddet og inn til hofta, og mellom beina.
  const wingArm = (a: Pt[], side: 1 | -1) => `${line([...a, T(side * 12, 12)])}Z`;
  const wingLeg = `${line([T(0, 15), legs[0]![1]!, legs[0]![2]!, legs[1]![2]!, legs[1]![1]!])}Z`;
  const armsEl = arms.map((a, i) => (
    <g key={`a${i}`}>
      {limb(a, 8)}
      <circle cx={a[2]![0]} cy={a[2]![1]} r={3.4 * k} fill={SCENE.skin} stroke={SCENE.outline} strokeWidth={ow * 0.8} />
    </g>
  ));
  return (
    <g>
      <RadialGradient
        id={id}
        cx={0.45}
        cy={0.4}
        r={0.65}
        stops={[
          [0, tint(SCENE.skyBottom, 0.2)],
          [1, SCENE.skyTop],
        ]}
      />
      <circle cx={x} cy={y} r={r + 3 * ss} fill={VIZ.surface} opacity={0.8} />
      <circle cx={x} cy={y} r={r} fill={`url(#${id})`} stroke={SCENE.outline} strokeWidth={0.9 * ss} />
      <g opacity={1}>
        {wings > 0.01 && (
          <g opacity={wings} fill={mix(suit, PAINTS.svart, 0.35)} stroke={edge} strokeWidth={ow} strokeLinejoin="round">
            <path d={wingArm(arms[0]!, 1)} />
            <path d={wingArm(arms[1]!, -1)} />
            <path d={wingLeg} />
          </g>
        )}
        {legs.map((l, i) => (
          <g key={`l${i}`}>
            {limb(l, 10)}
            <ellipse cx={l[2]![0]} cy={l[2]![1]} rx={4.2 * k} ry={Math.max(2.2, 5.5 * c) * k} fill={PAINTS.svart} />
          </g>
        ))}
        {/* Med hodet først henger armene langs kroppen, bak skuldrene sett nedenfra: tegn dem før kroppen. */}
        {belly < 0.5 && armsEl}
        <path d={torso} fill={suit} stroke={edge} strokeWidth={ow} />
        <path d={torso} fill={SCENE.highlight} opacity={0.25} transform={`translate(${r1(-2 * k)} ${r1(-2 * k * c)})`} />
        {belly >= 0.5 && armsEl}
        <circle cx={head[0]} cy={head[1]} r={8.5 * k} fill={PAINTS.svart} stroke={SCENE.outline} strokeWidth={ow} />
        <circle cx={head[0] - 2.4 * k} cy={head[1] - 2.4 * k} r={2.6 * k} fill={SCENE.highlight} opacity={0.6} />
      </g>
    </g>
  );
}
