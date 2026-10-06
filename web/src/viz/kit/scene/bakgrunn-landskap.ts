/**
 * Lagene i Landskap (bakgrunn.tsx): fjell, åser, skog, by og kyst som silhuetter med detaljer, regnet ut én gang
 * per størrelse og frø. Alt er periodisk med perioden w, så landskapet kan rulle sømløst (forskyvning).
 * Koordinatene er lokale: x fra 0 til w, y = 0 er horisonten og høyden er negativ y.
 */
import { mix, sceneRandom, shade, tint } from './core';
import { PAINTS, SCENE } from './palette';
import {
  type Peak,
  type Pt,
  clamp,
  fillDown,
  lerp,
  mod,
  peakAt,
  peakShape,
  periodicNoise,
  periodicSteps,
  polygon,
  profile,
  r1,
  seedFor,
  spruceShadeSide,
  spruceSilhouette,
  topOf,
} from './bakgrunn-geo';

/**
 * Typene i Landskap: fjell, åser (aaser), skog, by og kyst.
 *   const [type, setType] = useState<LandskapType>('fjell');
 */
export type LandskapType = 'fjell' | 'aaser' | 'skog' | 'by' | 'kyst';

/** En detalj inne i et lag (klippes til silhuetten). */
export interface LandPart {
  d: string;
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  opacity?: number;
  transform?: string;
}

export interface LandLayer {
  /** Silhuetten: fylles med `fill` og klipper detaljene. */
  d: string;
  fill: string;
  parts: LandPart[];
  /** Dis (andel himmelfarge) øverst og nederst i laget: luftperspektiv. */
  haze: [number, number];
  /** Øverste punkt (negativ y). */
  top: number;
  /** Hvor mye laget flytter seg med forskyvningen (0–1). */
  parallax: number;
}

const VINDU = 'var(--sc-bakgrunn-vindu)';
/** Overlapp mellom kopiene når landskapet ruller. */
const MARGIN = 3;

type Rand = () => number;

/** Nærmeste partall (minst 2), så en sagtann med annenhver topp passer sammen når landskapet ruller. */
const even = (n: number): number => Math.max(2, 2 * Math.round(n / 2));

/** Fjellkjede: topper med snø over snøgrensa, skyggeside til høyre og skog i liene. */
function mountains(
  rand: Rand,
  w: number,
  peaks: Peak[],
  o: {
    base: number;
    jag: number;
    snow?: number;
    haze: [number, number];
    parallax: number;
    /** Granskog nederst i liene (høyde over foten). */
    forest?: number;
    shadeOpacity?: number;
  },
): LandLayer {
  const noise = periodicNoise(rand, [
    [7, 0.5],
    [13, 0.3],
    [23, 0.2],
  ]);
  const maxH = Math.max(1, ...peaks.map((p) => p.hgt));
  const height = (x: number) => {
    let m = 0;
    for (const p of peaks) m = Math.max(m, peakAt(x, w, p));
    return m + o.jag * noise(x / w) * Math.min(1, m / (maxH * 0.4));
  };
  const n = clamp(Math.round(w / 5), 40, 240);
  const pts = profile(w, n, height, o.base, MARGIN);
  const top = topOf(pts);
  const parts: LandPart[] = [];

  if (o.snow !== undefined) {
    // Alt over snøgrensa er snø; tunger av snø går ned i søkkene (ujevnt, de lange er sjeldne).
    const sn = o.snow;
    const line = periodicSteps(w, Math.max(8, Math.round(w / 10)), (i) =>
      i % 2 === 1 ? 0.02 + 0.15 * Math.pow(rand(), 1.6) : rand() * 0.03,
    ).map(([x, tongue]): Pt => [x, o.base - sn + tongue * maxH]);
    const first = line[0]!;
    const last = line[line.length - 1]!;
    parts.push({ d: polygon([[first[0], top - 8], [last[0], top - 8], ...line.reverse()]), fill: SCENE.snowcap });
  }

  // Skyggesiden: fra en rygg ned fra toppen og ut til høyre fot (lyset kommer fra øvre venstre). Ryggen går jevnt
  // nedover mot høyre (litt ujevn), så skyggesiden blir én sammenhengende fjellside og ikke brettede fasetter.
  // Ryggen trekkes én gang per topp, så kopiene ved kantene (±w) blir like.
  let sd = '';
  for (const p of peaks) {
    const jit = [0, 0, 0].map(() => (rand() - 0.5) * p.s * 0.04);
    for (const off of [-w, 0, w]) {
      const c = p.c + off;
      if (c + p.s < -MARGIN - 2 || c - p.s * 0.2 > w + MARGIN + 2) continue;
      const b = o.base;
      const H = p.hgt;
      const ridge: Pt[] = [
        [c, b - H - 8],
        [c + p.s * 0.02, b - H * 0.97],
        [c + p.s * 0.07 + jit[0]!, b - H * 0.72],
        [c + p.s * 0.12 + jit[1]!, b - H * 0.48],
        [c + p.s * 0.17 + jit[2]!, b - H * 0.24],
        [c + p.s * 0.2, b + 1],
      ];
      const flank: Pt[] = [];
      for (let i = 10; i >= 0; i--) {
        const d = (i / 10) * p.s;
        flank.push([c + d, b - peakShape(d, p) - o.jag * 1.4]);
      }
      sd += polygon([...ridge, [c + p.s, b + 1], ...flank]);
    }
  }
  parts.push({ d: sd, fill: shade(SCENE.mountainShade, 0.3), opacity: o.shadeOpacity ?? 0.42 });

  if (o.forest) {
    // Skogen i liene tegnes sist, så den dekker fjellets skyggeside nederst. Kanten er tretoppene: ujevne spisser
    // med ujevn avstand. Skogen har sin egen skygge (høyre side av hver krone, som et lite fall nedover), og
    // arver ikke fjellets.
    const fn = periodicNoise(rand, [
      [3, 0.5],
      [8, 0.3],
    ]);
    const f = o.forest;
    const m = even(Math.max(12, w / 3.4));
    const tipH: number[] = [];
    const tipX: number[] = [];
    for (let i = 0; i < m; i++) {
      const tip = i % 2 === 0;
      tipH.push(tip ? 0.2 + 0.6 * Math.pow(rand(), 0.8) : 0.04 * rand());
      tipX.push(tip ? (rand() - 0.5) * 0.6 : 0);
    }
    const edge: Pt[] = [];
    for (let i = -1; i <= m + 1; i++) {
      const j = mod(i, m);
      const x = ((i + tipX[j]!) / m) * w;
      edge.push([x, o.base - f * (0.75 + 0.35 * fn(x / w)) - tipH[j]! * f * 0.45]);
    }
    const first = edge[0]!;
    const last = edge[edge.length - 1]!;
    const fill = mix(SCENE.foliageDark, SCENE.mountainShade, 0.35);
    parts.push({ d: polygon([[first[0], o.base + 1], ...edge, [last[0], o.base + 1]]), fill });
    let fs = '';
    for (let i = 0; i < edge.length - 1; i++) {
      const a = edge[i]!;
      const b = edge[i + 1]!;
      if (a[1] < b[1] - 0.3) fs += polygon([a, b, [a[0] + (b[0] - a[0]) * 0.3, b[1] + f * 0.22]]);
    }
    parts.push({ d: fs, fill: shade(fill, 0.4), opacity: 0.5 });
  }

  return { d: fillDown(pts, 1), fill: SCENE.mountain, parts, haze: o.haze, top, parallax: o.parallax };
}

/** Topper spredt jevnt over bredden (med litt tilfeldig plassering). */
function spreadPeaks(rand: Rand, w: number, count: number, hMin: number, hMax: number, slope: [number, number], from = 0, to = 1): Peak[] {
  const peaks: Peak[] = [];
  for (let i = 0; i < count; i++) {
    const hgt = lerp(hMin, hMax, rand());
    const c = w * lerp(from, to, (i + 0.5 + (rand() - 0.5) * 0.7) / count);
    peaks.push({ c, hgt, s: hgt * lerp(slope[0], slope[1], rand()) });
  }
  return peaks;
}

/** Skogkledd bakke: en bølgende bakke med tette graner på toppen. */
function forest(
  rand: Rand,
  w: number,
  o: {
    base: number;
    ground: number;
    groundVar: number;
    tree: [number, number];
    spacing: number;
    fill: string;
    haze: [number, number];
    parallax: number;
    shadeOpacity?: number;
    /** Halve bredden på trærne som andel av høyden (standard ca. 0,23). */
    wide?: number;
  },
): LandLayer {
  const noise = periodicNoise(rand, [
    [1, 0.5],
    [3, 0.33],
    [7, 0.17],
  ]);
  const G = (x: number) => Math.max(0, o.ground + o.groundVar * noise(x / w));
  const gpts = profile(w, Math.max(16, Math.round(w / 10)), G, o.base, MARGIN);
  let d = fillDown(gpts, 1);
  let sd = '';
  let top = topOf(gpts);
  // Små graner blir til «hår»: minst 6 enheter høye og ikke for smale.
  const tMin = Math.max(6, o.tree[0]);
  const tMax = Math.max(tMin * 1.2, o.tree[1]);
  const spacing = Math.max(o.spacing, tMin * 0.3);
  let x = spacing * rand();
  let guard = 0;
  while (x < w && guard++ < 600) {
    const th = lerp(tMin, tMax, rand());
    const hw = Math.max(2.2, th * ((o.wide ?? 0.2) + rand() * 0.07));
    const gy = o.base - G(x) + th * 0.08;
    // Trær nær kantene tegnes også på den andre siden (±w), så skogen passer sammen når den ruller.
    const offs = [0];
    if (x < hw + MARGIN) offs.push(w);
    if (x > w - hw - MARGIN) offs.push(-w);
    for (const off of offs) {
      d += spruceSilhouette(x + off, gy, th, hw);
      sd += spruceShadeSide(x + off, gy, th, hw);
    }
    top = Math.min(top, gy - th);
    x += Math.max(1, spacing * (0.55 + rand() * 0.9));
  }
  return {
    d,
    fill: o.fill,
    parts: [{ d: sd, fill: shade(o.fill, 0.4), opacity: o.shadeOpacity ?? 0.55 }],
    haze: o.haze,
    top,
    parallax: o.parallax,
  };
}

/**
 * Fjern skogås: en myk ås med lav sagtann langs toppen (tretoppene), uten enkelttrær. Brukes når trærne ellers ville
 * blitt så små at kanten ser ut som pels.
 */
function woodedRidge(
  rand: Rand,
  w: number,
  o: { base: number; ground: number; groundVar: number; tooth: number; fill: string; haze: [number, number]; parallax: number },
): LandLayer {
  const noise = periodicNoise(rand, [
    [1, 0.5],
    [3, 0.33],
    [7, 0.17],
  ]);
  const G = (x: number) => Math.max(0, o.ground + o.groundVar * noise(x / w));
  const tips = periodicSteps(w, even(w / (o.tooth * 1.1)), (i) => (i % 2 === 0 ? o.tooth * (0.45 + 0.55 * rand()) : 0));
  const pts = tips.map(([x, t]): Pt => [x, o.base - G(x) - t]);
  return { d: fillDown(pts, 1), fill: o.fill, parts: [], haze: o.haze, top: topOf(pts), parallax: o.parallax };
}

/** Åsrygg: myk bølgende profil, eventuelt med små klynger av graner og en gård. */
function hills(
  rand: Rand,
  w: number,
  o: {
    base: number;
    mean: number;
    terms: [number, number][];
    min: number;
    fill: string;
    haze: [number, number];
    parallax: number;
    clusters?: number;
    tree?: number;
    farm?: number;
  },
): LandLayer {
  const noise = periodicNoise(rand, o.terms);
  const H = (x: number) => Math.max(o.min, o.mean + noise(x / w));
  const pts = profile(w, clamp(Math.round(w / 8), 24, 160), H, o.base, MARGIN);
  let d = fillDown(pts, 1);
  let top = topOf(pts);
  const parts: LandPart[] = [];
  let trees = '';
  let treeShade = '';
  for (let c = 0; c < (o.clusters ?? 0); c++) {
    const cx = w * ((c + 0.2 + rand() * 0.6) / (o.clusters ?? 1));
    const m = 3 + Math.floor(rand() * 5);
    const th0 = o.tree ?? 10;
    for (let i = 0; i < m; i++) {
      const th = th0 * (0.7 + rand() * 0.5) * (1 - Math.abs(i - m / 2) / m) * 1.3;
      const hw = th * 0.24;
      const x = cx + (i - m / 2) * th0 * 0.32 + (rand() - 0.5) * 2;
      const gy = o.base - H(x) + th * 0.1;
      const s = spruceSilhouette(x, gy, th, hw);
      d += s;
      trees += s;
      treeShade += spruceShadeSide(x, gy, th, hw);
      top = Math.min(top, gy - th);
    }
  }
  if (trees) {
    parts.push({ d: trees, fill: mix(SCENE.foliageDark, o.fill, 0.25) });
    parts.push({ d: treeShade, fill: shade(SCENE.foliageDark, 0.35), opacity: 0.5 });
  }
  if (o.farm) {
    // En liten gård: hvitt våningshus og rød låve.
    const s = o.farm;
    const fx = w * (0.15 + rand() * 0.7);
    const gy = o.base - H(fx) + s * 0.15;
    const house = polygon([
      [fx, gy],
      [fx, gy - s * 0.55],
      [fx + s * 0.45, gy - s * 0.95],
      [fx + s * 0.9, gy - s * 0.55],
      [fx + s * 0.9, gy],
    ]);
    const bx = fx + s * 1.15;
    const by = o.base - H(bx + s * 0.7) + s * 0.15;
    const barn = polygon([
      [bx, by],
      [bx, by - s * 0.7],
      [bx + s * 0.35, by - s * 1.05],
      [bx + s * 1.05, by - s * 1.05],
      [bx + s * 1.4, by - s * 0.7],
      [bx + s * 1.4, by],
    ]);
    d += house + barn;
    top = Math.min(top, gy - s, by - s * 1.1);
    parts.push({ d: house, fill: PAINTS.hvit });
    parts.push({ d: barn, fill: PAINTS.rod });
    parts.push({
      d:
        polygon([
          [fx - s * 0.06, gy - s * 0.52],
          [fx + s * 0.45, gy - s * 0.97],
          [fx + s * 0.96, gy - s * 0.52],
        ]) +
        polygon([
          [bx - s * 0.05, by - s * 0.68],
          [bx + s * 0.35, by - s * 1.07],
          [bx + s * 1.05, by - s * 1.07],
          [bx + s * 1.45, by - s * 0.68],
        ]),
      fill: shade(SCENE.stoneDark, 0.3),
    });
  }
  return { d, fill: o.fill, parts, haze: o.haze, top, parallax: o.parallax };
}

/** Byen: høye blokker langt borte og lave hus med saltak nærmere, en kirke og noen trær. */
function city(rand: Rand, w: number, h: number): LandLayer[] {
  // Blokker
  let bd = '';
  let bwin = '';
  let btop = 0;
  let x = -rand() * 12;
  let guard = 0;
  while (x < w && guard++ < 200) {
    const bw = clamp(w * lerp(0.03, 0.065, rand()), 16, 64);
    const bh = h * lerp(0.2, 0.62, Math.pow(rand(), 1.4));
    bd += polygon([
      [x, 1],
      [x, -bh],
      [x + bw, -bh],
      [x + bw, 1],
    ]);
    btop = Math.min(btop, -bh);
    if (bw > 14) {
      // Båndvinduer: én stripe per etasje
      const floor = clamp(h * 0.055, 5, 9);
      for (let fy = -bh + floor * 0.8; fy < -floor * 0.6; fy += floor) {
        if (rand() < 0.72) bwin += polygon([[x + 2.5, fy], [x + bw - 2.5, fy], [x + bw - 2.5, fy + floor * 0.38], [x + 2.5, fy + floor * 0.38]]);
      }
    }
    x += bw + (rand() < 0.3 ? 2 + rand() * 10 : -1);
  }
  const blocks: LandLayer = {
    d: bd,
    fill: mix(SCENE.concrete, SCENE.stone, 0.4),
    parts: [{ d: bwin, fill: VINDU, opacity: 0.55 }],
    haze: [0.42, 0.55],
    top: btop,
    parallax: 0.4,
  };

  // Hus
  const colors = [PAINTS.hvit, PAINTS.rod, PAINTS.gul, PAINTS.hvit, SCENE.brick];
  const walls: string[] = colors.map(() => '');
  let roofs = '';
  let roofsRed = '';
  let win = '';
  let trees = '';
  let hd = '';
  const ground = Math.max(2, h * 0.03);
  hd += polygon([
    [-2, -ground],
    [w + 2, -ground],
    [w + 2, 1],
    [-2, 1],
  ]);
  let htop = -ground;
  const church = Math.floor(rand() * 6) + 2;
  x = -rand() * 10;
  let i = 0;
  guard = 0;
  while (x < w && guard++ < 200) {
    if (i === church) {
      // Kirke: hvitt skip og tårn med spir
      const tw = clamp(h * 0.07, 6, 14);
      const nave = tw * 2.4;
      const wallH = h * 0.12;
      const towerH = h * 0.26;
      const spire = h * 0.2;
      const navePoly = polygon([
        [x + tw, 1],
        [x + tw, -wallH],
        [x + tw + nave, -wallH],
        [x + tw + nave, 1],
      ]);
      const tower = polygon([
        [x, 1],
        [x, -towerH],
        [x + tw, -towerH],
        [x + tw, 1],
      ]);
      const spirePoly = polygon([
        [x - 1, -towerH],
        [x + tw / 2, -towerH - spire],
        [x + tw + 1, -towerH],
      ]);
      const naveRoof = polygon([
        [x + tw, -wallH],
        [x + tw, -wallH - tw * 0.6],
        [x + tw + nave + 1.5, -wallH - tw * 0.6],
        [x + tw + nave + 3, -wallH],
      ]);
      hd += navePoly + tower + spirePoly + naveRoof;
      walls[0] += navePoly + tower;
      roofs += spirePoly + naveRoof;
      win += polygon([
        [x + tw * 0.35, -towerH * 0.72],
        [x + tw * 0.65, -towerH * 0.72],
        [x + tw * 0.65, -towerH * 0.6],
        [x + tw * 0.35, -towerH * 0.6],
      ]);
      htop = Math.min(htop, -towerH - spire);
      x += tw + nave + 6;
      i++;
      continue;
    }
    if (rand() < 0.28) {
      // Lauvtre mellom husene
      const r = clamp(h * lerp(0.05, 0.075, rand()), 4, 14);
      const cx = x + r;
      const t = `M${r1(cx - r)},${r1(-ground - r * 0.9)}a${r1(r)},${r1(r * 1.1)} 0 1,1 ${r1(2 * r)},0a${r1(r)},${r1(r * 1.1)} 0 1,1 ${r1(-2 * r)},0Z`;
      hd += t;
      trees += t;
      htop = Math.min(htop, -ground - r * 2);
      x += r * 2 + 2;
      continue;
    }
    const hw = clamp(w * lerp(0.032, 0.055, rand()), 16, 46);
    const wallH = h * lerp(0.075, 0.13, rand());
    const roofH = hw * lerp(0.28, 0.42, rand());
    const ci = Math.floor(rand() * colors.length);
    const wall = polygon([
      [x, 1],
      [x, -wallH],
      [x + hw, -wallH],
      [x + hw, 1],
    ]);
    const roof = polygon([
      [x - 2, -wallH + 0.5],
      [x + hw / 2, -wallH - roofH],
      [x + hw + 2, -wallH + 0.5],
    ]);
    hd += wall + roof;
    walls[ci] += wall;
    if (rand() < 0.3) roofsRed += roof;
    else roofs += roof;
    const ws = clamp(hw * 0.16, 2.5, 6);
    const nWin = hw > 26 ? 3 : 2;
    for (let k = 0; k < nWin; k++) {
      const wx = x + (hw * (k + 0.5)) / nWin - ws / 2;
      const wy = -wallH * 0.62;
      if (rand() < 0.85) win += polygon([[wx, wy], [wx + ws, wy], [wx + ws, wy + ws * 1.2], [wx, wy + ws * 1.2]]);
    }
    htop = Math.min(htop, -wallH - roofH);
    x += hw + 2 + rand() * 6;
    i++;
  }
  const near: LandLayer = {
    d: hd,
    fill: SCENE.hillNear,
    parts: [
      ...walls.map((d, k) => ({ d, fill: colors[k]! })),
      { d: roofs, fill: shade(SCENE.stoneDark, 0.35) },
      { d: roofsRed, fill: shade(SCENE.brick, 0.15) },
      { d: win, fill: VINDU, opacity: 0.85 },
      { d: trees, fill: SCENE.foliage },
    ],
    haze: [0.14, 0.24],
    top: htop,
    parallax: 1,
  };

  const far = hills(rand, w, {
    base: 0,
    mean: h * 0.36,
    terms: [
      [1, h * 0.09],
      [2, h * 0.06],
      [5, h * 0.02],
    ],
    min: h * 0.15,
    fill: SCENE.hillFar,
    haze: [0.5, 0.62],
    parallax: 0.2,
  });
  return [far, blocks, near];
}

/**
 * Lagene for en landskapstype, fra det fjerneste til det nærmeste. `w` og `h` er bredden og høyden over
 * horisonten det får bruke.
 */
export function buildLandscape(type: LandskapType, w: number, h: number, seed: number): LandLayer[] {
  if (!(w > 0) || !(h > 0)) return [];
  const rand = sceneRandom(seedFor(seed, type));
  switch (type) {
    case 'fjell': {
      const far = mountains(rand, w, spreadPeaks(rand, w, Math.max(3, Math.round(w / 150)), h * 0.42, h * 0.68, [1.6, 2.3]), {
        base: 0,
        jag: h * 0.025,
        snow: h * 0.5,
        haze: [0.5, 0.66],
        parallax: 0.2,
        shadeOpacity: 0.32,
      });
      const near = mountains(rand, w, spreadPeaks(rand, w, Math.max(2, Math.round(w / 230)), h * 0.55, h * 0.95, [1.35, 1.9]), {
        base: 0,
        jag: h * 0.03,
        snow: h * 0.68,
        haze: [0.1, 0.34],
        parallax: 0.45,
        forest: h * 0.14,
      });
      const foot = forest(rand, w, {
        base: 0,
        ground: h * 0.035,
        groundVar: h * 0.02,
        tree: [h * 0.08, h * 0.14],
        spacing: h * 0.03,
        fill: SCENE.foliageDark,
        haze: [0.12, 0.22],
        parallax: 1,
      });
      return [far, near, foot];
    }
    case 'aaser': {
      return [
        hills(rand, w, {
          base: 0,
          mean: h * 0.5,
          terms: [
            [1, h * 0.12],
            [2, h * 0.08],
            [3, h * 0.04],
          ],
          min: h * 0.2,
          fill: SCENE.hillFar,
          haze: [0.48, 0.62],
          parallax: 0.2,
        }),
        hills(rand, w, {
          base: 0,
          mean: h * 0.32,
          terms: [
            [2, h * 0.07],
            [3, h * 0.05],
            [5, h * 0.025],
          ],
          min: h * 0.12,
          fill: mix(SCENE.hillFar, SCENE.hillNear, 0.55),
          haze: [0.2, 0.36],
          parallax: 0.45,
          clusters: Math.max(1, Math.round(w / 400)),
          tree: h * 0.07,
        }),
        hills(rand, w, {
          base: 0,
          mean: h * 0.15,
          terms: [
            [2, h * 0.045],
            [3, h * 0.035],
            [6, h * 0.015],
          ],
          min: h * 0.05,
          fill: SCENE.hillNear,
          haze: [0.02, 0.12],
          parallax: 1,
          clusters: Math.max(1, Math.round(w / 300)),
          tree: h * 0.13,
          farm: clamp(h * 0.09, 5, 16),
        }),
      ];
    }
    case 'skog': {
      // Det fjerneste laget: store, glisne trær når det er plass, ellers en myk ås med lav sagtann (ikke «pels»).
      const tFar = h * 0.065;
      const far =
        tFar >= 8
          ? forest(rand, w, {
              base: 0,
              ground: h * 0.42,
              groundVar: h * 0.12,
              tree: [Math.max(9, tFar), Math.max(11.5, tFar * 1.3)],
              spacing: Math.max(9, tFar) * 0.5,
              fill: SCENE.hillFar,
              haze: [0.42, 0.6],
              parallax: 0.2,
              shadeOpacity: 0.3,
              wide: 0.26,
            })
          : woodedRidge(rand, w, {
              base: 0,
              ground: h * 0.42,
              groundVar: h * 0.12,
              tooth: Math.max(1.5, h * 0.03),
              fill: SCENE.hillFar,
              haze: [0.42, 0.6],
              parallax: 0.2,
            });
      return [
        far,
        forest(rand, w, {
          base: 0,
          ground: h * 0.2,
          groundVar: h * 0.08,
          tree: [h * 0.12, h * 0.2],
          spacing: Math.max(3.5, h * 0.05),
          fill: SCENE.foliage,
          haze: [0.26, 0.42],
          parallax: 0.45,
        }),
        forest(rand, w, {
          base: 0,
          ground: h * 0.05,
          groundVar: h * 0.03,
          tree: [h * 0.2, h * 0.34],
          spacing: Math.max(5, h * 0.075),
          fill: SCENE.foliageDark,
          haze: [0.03, 0.12],
          parallax: 1,
        }),
      ];
    }
    case 'by':
      return city(rand, w, h);
    case 'kyst': {
      const wH = Math.max(6, h * 0.12);
      const base = -wH;
      const far = mountains(rand, w, spreadPeaks(rand, w, 3, h * 0.3, h * 0.48, [1.8, 2.4], 0.28, 0.72), {
        base,
        jag: h * 0.02,
        snow: h * 0.36,
        haze: [0.5, 0.66],
        parallax: 0.2,
        shadeOpacity: 0.3,
      });
      const side = rand() < 0.5;
      const big = h * lerp(0.82, 0.95, rand());
      const nearPeaks: Peak[] = [
        { c: 0, hgt: big, s: Math.min(big * 1.6, w * 0.3) },
        { c: w * (side ? 0.8 : 0.2) + (rand() - 0.5) * w * 0.05, hgt: h * 0.55, s: Math.min(h * 0.95, w * 0.17) },
        { c: w * (0.5 + (rand() - 0.5) * 0.12), hgt: h * 0.05, s: Math.min(h * 0.4, w * 0.05) },
      ];
      const near = mountains(rand, w, nearPeaks, {
        base,
        jag: h * 0.025,
        snow: h * 0.62,
        haze: [0.08, 0.26],
        parallax: 0.45,
        forest: h * 0.16,
      });
      // Fjorden: vannflate med speilbilde av fjellene og noen lyse striper.
      let sheen = '';
      for (let k = 0; k < Math.max(3, Math.round(w / 120)); k++) {
        const sx = rand() * w;
        const sy = base + wH * (0.25 + rand() * 0.65);
        const len = 14 + rand() * 50;
        sheen += polygon([
          [sx, sy],
          [sx + len, sy],
          [sx + len, sy + 0.9],
          [sx, sy + 0.9],
        ]);
      }
      const water: LandLayer = {
        d: polygon([
          [-2, base],
          [w + 2, base],
          [w + 2, 1],
          [-2, 1],
        ]),
        fill: mix(SCENE.water, SCENE.waterLight, 0.4),
        parts: [
          { d: near.d, fill: shade(SCENE.mountain, 0.25), opacity: 0.38, transform: `translate(0 ${r1(base)}) scale(1 -0.42) translate(0 ${r1(-base)})` },
          { d: sheen, fill: tint(SCENE.waterLight, 0.6), opacity: 0.7 },
        ],
        haze: [0.5, 0.12],
        top: base,
        parallax: 0.45,
      };
      return [far, near, water];
    }
  }
}
