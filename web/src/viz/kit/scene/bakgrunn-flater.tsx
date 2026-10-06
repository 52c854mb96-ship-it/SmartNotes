/**
 * Flatene til underlagene i scene-kit-et (brukes av Underlag og Vei i bakgrunn.tsx): toppflaten sett litt ovenfra,
 * forsiden (snittet) og bakkanten. Teksturen er sparsom og deterministisk (fast frø), og den ruller med
 * forskyvningen. Eksporteres ikke fra scene-kit-et.
 */
import { useMemo, type ReactNode, type SVGProps } from 'react';
import { LinearGradient, mix, sceneRandom, shade, tint, useSvgId, type GradientStop } from './core';
import { SCENE } from './palette';
import { type Pt, circle, clamp, edgeNoise, ellipse, hash01, mod, polygon, polyline, r1, r2, randomTable, seedFor } from './bakgrunn-geo';

/**
 * Underlagene i Underlag, Terreng og (delvis) Vei. Navnene til brukeren står i UNDERLAG_NAVN.
 *   const [type, setType] = useState<UnderlagType>('asfalt');
 */
export type UnderlagType = 'asfalt' | 'vaat-asfalt' | 'sno' | 'is' | 'gress' | 'grus' | 'betong' | 'tregulv' | 'jord' | 'labbenk';

/** Glitter i snø og blank is (lyst i begge temaer). */
export const GLITTER = 'var(--sc-bakgrunn-glitter)';
/** Blålig glimt i snø, synlig også på hvit snø i lyst tema. */
export const GLINT = mix(SCENE.iceShine, SCENE.cold, 0.45);

/** Fargen på toppflaten. */
export const TOP_COLOR: Record<UnderlagType, string> = {
  asfalt: SCENE.asphalt,
  'vaat-asfalt': SCENE.asphaltWet,
  sno: SCENE.snow,
  is: SCENE.ice,
  gress: SCENE.grass,
  grus: SCENE.gravel,
  betong: SCENE.concrete,
  tregulv: SCENE.floor,
  jord: SCENE.soil,
  labbenk: SCENE.bench,
};

/** Underlag som ligger ute (får dis mot horisonten). */
const OUTDOOR: Record<UnderlagType, boolean> = {
  asfalt: true,
  'vaat-asfalt': true,
  sno: true,
  is: true,
  gress: true,
  grus: true,
  betong: true,
  tregulv: false,
  jord: true,
  labbenk: false,
};

export interface FaceProps {
  type: UnderlagType;
  left: number;
  right: number;
  top: number;
  bottom: number;
  seed: number;
  /** Forskyvning: teksturen flytter seg mot venstre når den øker. */
  shift: number;
  /** useSceneScale() og useStrokeScale(). */
  k: number;
  ss: number;
}

function useTable(seed: number, key: string): Float64Array {
  return useMemo(() => randomTable(sceneRandom(seedFor(seed, key)), 2400), [seed, key]);
}

/** Merker spredt over en flate: u langs flaten og v på tvers (0–1), a og b til størrelse og variasjon. */
function scatter(t: Float64Array, start: number, count: number, f: (u: number, v: number, a: number, b: number) => string): string {
  const n = Math.max(0, Math.min(Math.round(count), 240));
  const m = t.length >> 2;
  let d = '';
  for (let i = 0; i < n; i++) {
    const j = ((start + i) % m) * 4;
    d += f(t[j]!, t[j + 1]!, t[j + 2]!, t[j + 3]!);
  }
  return d;
}

/** Liten gresstust (tre strå). */
function tuft(x: number, y: number, s: number): string {
  return `M${r2(x - s)},${r2(y)}l${r2(0.45 * s)},${r2(-1.7 * s)}l${r2(0.2 * s)},${r2(1.7 * s)}l${r2(0.4 * s)},${r2(-2.2 * s)}l${r2(0.25 * s)},${r2(2.2 * s)}l${r2(0.45 * s)},${r2(-1.5 * s)}`;
}

/**
 * Toppflaten mellom `top` (bakkanten) og `bottom` (forkanten). Dyp flate (opp mot horisonten) får perspektiv:
 * mindre og tettere merker bak, og med `haze` dis mot horisonten.
 */
export function TopFace({ type, left, right, top, bottom, seed, shift, k, ss, haze }: FaceProps & { haze?: boolean }) {
  const gid = useSvgId('sc-toppflate');
  const cid = useSvgId('sc-toppklipp');
  const sid = useSvgId('sc-toppdrag');
  const t = useTable(seed, `${type}:topp`);
  const L = right - left;
  const span = bottom - top;
  if (!(L > 0) || !(span > 0.2)) return null;
  const deep = span > 26;
  const X = (u: number) => left + mod(u * L - shift, L);
  const Y = (v: number) => top + span * (deep ? Math.pow(v, 1.3) : v);
  const P = (v: number) => (deep ? 0.4 + 0.6 * v : 0.85 + 0.15 * v);
  const cnt = (density: number) => (L * span) / (density * k * k);
  const c = TOP_COLOR[type];

  let stops: GradientStop[] = [
    [0, tint(c, 0.08)],
    [1, shade(c, 0.05)],
  ];
  if (type === 'sno')
    stops = [
      [0, tint(c, 0.3)],
      [1, mix(c, SCENE.snowShade, 0.42)],
    ];
  if (type === 'is')
    stops = [
      [0, SCENE.iceShine],
      [0.55, c],
      [1, shade(c, 0.06)],
    ];
  if (type === 'vaat-asfalt')
    stops = [
      [0, mix(c, SCENE.skyBottom, 0.25)],
      [1, shade(c, 0.08)],
    ];
  if (type === 'labbenk')
    stops = [
      [0, tint(c, 0.14)],
      [1, shade(c, 0.03)],
    ];
  if (haze && deep && OUTDOOR[type]) {
    const first = stops[0]!;
    stops = [[0, mix(first[1], SCENE.skyBottom, 0.45)], [0.35, first[1]], ...stops.slice(1)];
  }

  const tex: ReactNode[] = [];
  const add = (key: string, d: string, props: SVGProps<SVGPathElement>) => {
    if (d) tex.push(<path key={key} d={d} {...props} />);
  };

  switch (type) {
    case 'asfalt':
      add('l', scatter(t, 0, cnt(110), (u, v, a) => circle(X(u), Y(v), (0.45 + 0.5 * a) * k * P(v))), { fill: tint(SCENE.asphalt, 0.32), opacity: 0.6 });
      add('d', scatter(t, 200, cnt(75), (u, v, a) => circle(X(u), Y(v), (0.45 + 0.6 * a) * k * P(v))), { fill: SCENE.asphaltDark, opacity: 0.9 });
      break;
    case 'vaat-asfalt':
      add(
        's',
        scatter(t, 0, L / 46, (u, v, a, b) => ellipse(X(u), Y(0.12 + 0.8 * v), (8 + 26 * a) * P(v) * k, (0.45 + 0.55 * b) * P(v) * k)),
        { fill: SCENE.skyBottom, opacity: 0.34 },
      );
      {
        const puddles = scatter(t, 100, Math.max(1, L / 220), (u, v, a, b) =>
          ellipse(X(u), Y(0.35 + 0.35 * v), (14 + 22 * a) * P(v) * k, Math.max(1.1, span * (0.1 + 0.08 * b))),
        );
        add('p', puddles, { fill: mix(SCENE.skyBottom, SCENE.skyTop, 0.35), opacity: 0.6 });
        add('pr', puddles, { fill: 'none', stroke: GLITTER, strokeWidth: 0.6 * ss, opacity: 0.35 });
      }
      add('d', scatter(t, 300, cnt(120), (u, v, a) => circle(X(u), Y(v), (0.4 + 0.5 * a) * k * P(v))), { fill: shade(SCENE.asphaltWet, 0.3), opacity: 0.8 });
      break;
    case 'sno':
      add(
        'f',
        scatter(t, 0, (L * span) / (700 * k), (u, v, a, b) => ellipse(X(u), Y(0.1 + 0.85 * v), (10 + 24 * a) * P(v), (0.5 + 0.7 * b) * P(v))),
        { fill: SCENE.snowShade, opacity: 0.38 },
      );
      add(
        'g',
        scatter(t, 100, cnt(420), (u, v, a) => {
          const x = X(u);
          const y = Y(v);
          const s = (0.6 + 0.8 * a) * k * P(v);
          return `M${r2(x - s)},${r2(y)}h${r2(2 * s)}M${r2(x)},${r2(y - s * 0.8)}v${r2(1.6 * s)}`;
        }),
        { fill: 'none', stroke: GLINT, strokeWidth: 0.5 * ss, opacity: 0.6, strokeLinecap: 'round' },
      );
      add('p', scatter(t, 300, cnt(110), (u, v) => circle(X(u), Y(v), 0.5 * k * P(v))), { fill: GLITTER, opacity: 0.95 });
      break;
    case 'is': {
      add(
        's',
        scatter(t, 0, L / 55, (u, v, a, b) => ellipse(X(u), Y(0.15 + 0.7 * v), (12 + 32 * a) * P(v) * k, (0.4 + 0.5 * b) * P(v) * k)),
        { fill: GLITTER, opacity: 0.6 },
      );
      if (span > 4) {
        const y0 = top + span * 0.12;
        const y1 = bottom - span * 0.12;
        const sl = (y1 - y0) * 0.6;
        add(
          'g',
          scatter(t, 150, Math.max(1, L / 240), (u, _v, a) => {
            const x = X(u);
            const w1 = (3 + 4 * a) * k;
            const w2 = w1 * 0.45;
            const g = w1 * 0.7;
            return (
              polygon([
                [x, y0],
                [x + w1, y0],
                [x + w1 - sl, y1],
                [x - sl, y1],
              ]) +
              polygon([
                [x + w1 + g, y0],
                [x + w1 + g + w2, y0],
                [x + w1 + g + w2 - sl, y1],
                [x + w1 + g - sl, y1],
              ])
            );
          }),
          { fill: GLITTER, opacity: 0.55 },
        );
      }
      add(
        'r',
        scatter(t, 250, L / 130, (u, v, a, b) => {
          const x = X(u);
          const y = Y(0.2 + 0.6 * v);
          const len = (20 + 40 * a) * k;
          return `M${r2(x)},${r2(y)}q${r2(len / 2)},${r2(-(0.6 + 1.6 * b) * P(v))} ${r2(len)},${r2(0.4)}`;
        }),
        { fill: 'none', stroke: GLITTER, strokeWidth: 0.5 * ss, opacity: 0.55 },
      );
      break;
    }
    case 'gress': {
      // På en dyp flate blir tustene færre og mindre bakover (b avgjør hvilke som tegnes), og svake lyse og mørke
      // drag i dybden gjør enga rolig. På en smal flate er tustene jevnt fordelt.
      const keep = (v: number, b: number) => !deep || b < 0.12 + 0.88 * v * v;
      add('d', scatter(t, 0, cnt(deep ? 60 : 75), (u, v, a, b) => (keep(v, b) ? tuft(X(u), Y(v), (0.9 + 0.9 * a) * k * P(v)) : '')), {
        fill: 'none',
        stroke: SCENE.grassDark,
        strokeWidth: 0.7 * ss,
        strokeLinejoin: 'round',
        opacity: 0.9,
      });
      add('l', scatter(t, 200, cnt(deep ? 100 : 120), (u, v, a, b) => (keep(v, b) ? tuft(X(u), Y(v), (0.8 + 0.8 * a) * k * P(v)) : '')), {
        fill: 'none',
        stroke: tint(SCENE.grass, 0.28),
        strokeWidth: 0.6 * ss,
        strokeLinejoin: 'round',
        opacity: 0.7,
      });
      if (deep) {
        const lys = tint(SCENE.grass, 0.3);
        const mork = shade(SCENE.grassDark, 0.15);
        tex.unshift(
          <LinearGradient
            key="dg"
            id={sid}
            userSpace
            x1={0}
            y1={top}
            x2={0}
            y2={bottom}
            stops={[
              [0, lys, 0],
              [0.1, lys, 0.32],
              [0.22, lys, 0],
              [0.22, mork, 0],
              [0.36, mork, 0.2],
              [0.5, mork, 0],
              [0.5, lys, 0],
              [0.68, lys, 0.22],
              [0.86, lys, 0],
            ]}
          />,
          <rect key="dr" x={left} y={top} width={L} height={span} fill={`url(#${sid})`} />,
        );
      }
      break;
    }
    case 'grus':
      add(
        'd',
        scatter(t, 0, cnt(24), (u, v, a) => {
          const r = (0.55 + 0.9 * a) * k * P(v);
          return ellipse(X(u), Y(v), r, r * 0.62);
        }),
        { fill: SCENE.gravelDark },
      );
      add(
        'l',
        scatter(t, 150, cnt(32), (u, v, a) => {
          const r = (0.5 + 0.8 * a) * k * P(v);
          return ellipse(X(u), Y(v), r, r * 0.62);
        }),
        { fill: tint(SCENE.gravel, 0.42) },
      );
      add(
        's',
        scatter(t, 300, cnt(90), (u, v, a) => {
          const r = (0.9 + 1.0 * a) * k * P(v);
          return ellipse(X(u), Y(v), r, r * 0.6);
        }),
        { fill: SCENE.stone, opacity: 0.9 },
      );
      break;
    case 'betong': {
      add('p', scatter(t, 0, cnt(110), (u, v, a) => circle(X(u), Y(v), (0.3 + 0.35 * a) * k)), { fill: SCENE.concreteDark, opacity: 0.55 });
      const cx = (left + right) / 2;
      let j = '';
      let jl = '';
      for (let xx = left + mod(70 - shift, 180); xx < right; xx += 180) {
        const xb = cx + (xx - cx) * 0.94;
        j += `M${r1(xb)},${r1(top)}L${r1(xx)},${r1(bottom)}`;
        jl += `M${r1(xb + 1.1)},${r1(top)}L${r1(xx + 1.2)},${r1(bottom)}`;
      }
      add('j', j, { fill: 'none', stroke: SCENE.concreteDark, strokeWidth: 0.9 * ss, opacity: 0.85 });
      add('jl', jl, { fill: 'none', stroke: tint(SCENE.concrete, 0.45), strokeWidth: 0.7 * ss, opacity: 0.7 });
      break;
    }
    case 'tregulv': {
      const nb = Math.round(clamp(span / 5, 1, 14));
      const rowY = (j: number) => Y(j / nb);
      let alt = '';
      let seams = '';
      let joints = '';
      for (let j = 0; j < nb; j++) {
        const ya = rowY(j);
        const yb = rowY(j + 1);
        if (j % 2 === 1)
          alt += polygon([
            [left, ya],
            [right, ya],
            [right, yb],
            [left, yb],
          ]);
        if (j > 0) seams += `M${r1(left)},${r1(ya)}H${r1(right)}`;
        const sp = 150 + 100 * hash01(j, seed);
        for (let xx = left + mod(sp * hash01(j + 50, seed) - shift, sp); xx < right; xx += sp) joints += `M${r1(xx)},${r1(ya)}V${r1(yb)}`;
      }
      add('a', alt, { fill: SCENE.floorDark, opacity: 0.1 });
      add(
        'g',
        scatter(t, 0, (L * nb) / 110, (u, v, a) => {
          const row = Math.min(nb - 1, Math.floor(v * nb));
          const y = rowY(row) + (rowY(row + 1) - rowY(row)) * (0.3 + 0.4 * a);
          return `M${r1(X(u))},${r1(y)}h${r1(18 + 40 * a)}`;
        }),
        { fill: 'none', stroke: SCENE.floorDark, strokeWidth: 0.5 * ss, opacity: 0.35 },
      );
      add('s', seams, { fill: 'none', stroke: SCENE.floorDark, strokeWidth: 0.8 * ss, opacity: 0.7 });
      add('j', joints, { fill: 'none', stroke: SCENE.floorDark, strokeWidth: 0.8 * ss, opacity: 0.75 });
      break;
    }
    case 'jord':
      add(
        'c',
        scatter(t, 0, cnt(75), (u, v, a) => {
          const r = (0.7 + 1.3 * a) * k * P(v);
          return ellipse(X(u), Y(v), r, r * 0.6);
        }),
        { fill: SCENE.soilDark, opacity: 0.8 },
      );
      add('l', scatter(t, 150, cnt(110), (u, v, a) => circle(X(u), Y(v), (0.35 + 0.3 * a) * k * P(v))), { fill: tint(SCENE.soil, 0.35), opacity: 0.7 });
      add(
        's',
        scatter(t, 300, cnt(320), (u, v, a) => {
          const r = (0.8 + 0.9 * a) * k * P(v);
          return ellipse(X(u), Y(v), r, r * 0.62);
        }),
        { fill: SCENE.stone },
      );
      break;
    case 'labbenk':
      add(
        'r',
        polygon([
          [left, top + span * 0.18],
          [right, top + span * 0.18],
          [right, top + span * 0.4],
          [left, top + span * 0.4],
        ]),
        { fill: GLITTER, opacity: 0.2 },
      );
      add('s', scatter(t, 0, L / 170, (u, v, a) => `M${r1(X(u))},${r1(Y(0.55 + 0.35 * v))}h${r1(30 + 60 * a)}`), {
        fill: 'none',
        stroke: GLITTER,
        strokeWidth: 0.6 * ss,
        opacity: 0.28,
      });
      break;
  }

  return (
    <g>
      <LinearGradient id={gid} userSpace x1={0} y1={top} x2={0} y2={bottom} stops={stops} />
      <rect x={left} y={top} width={L} height={span} fill={`url(#${gid})`} />
      {tex.length > 0 && (
        <>
          <clipPath id={cid}>
            <rect x={left} y={top} width={L} height={span} />
          </clipPath>
          <g clipPath={`url(#${cid})`}>{tex}</g>
        </>
      )}
    </g>
  );
}

/** Forsiden (snittet) av underlaget fra `top` (forkanten av toppflaten) ned til `bottom`. */
export function FrontFace({ type, left, right, top, bottom, seed, shift, k, ss }: FaceProps) {
  const gid = useSvgId('sc-snitt');
  const cid = useSvgId('sc-snittklipp');
  const t = useTable(seed, `${type}:snitt`);
  const L = right - left;
  const fh = bottom - top;
  if (!(L > 0) || !(fh > 0.3)) return null;
  const X = (u: number) => left + mod(u * L - shift, L);
  const cnt = (density: number, h: number) => (L * Math.max(0, h)) / (density * k * k);
  const els: ReactNode[] = [];
  const defs: ReactNode[] = [];
  let gi = 0;
  /** Et lag i snittet fra y0 til y1 med vertikal toning. */
  const layer = (y0: number, y1: number, stops: GradientStop[]) => {
    if (!(y1 - y0 > 0.1)) return;
    const id = `${gid}-${gi++}`;
    defs.push(<LinearGradient key={id} id={id} userSpace x1={0} y1={y0} x2={0} y2={y1} stops={stops} />);
    els.push(<rect key={id} x={left} y={y0} width={L} height={y1 - y0} fill={`url(#${id})`} />);
  };
  const add = (key: string, d: string, props: SVGProps<SVGPathElement>) => {
    if (d) els.push(<path key={key} d={d} {...props} />);
  };
  /** Merker i et bånd fra y0 til y1. */
  const band = (start: number, density: number, y0: number, y1: number, rMin: number, rMax: number, flat = 0.68) =>
    scatter(t, start, cnt(density, y1 - y0), (u, v, a) => {
      const r = (rMin + (rMax - rMin) * a) * k;
      return ellipse(X(u), y0 + r + (y1 - y0 - 2 * r) * v, r, r * flat);
    });

  switch (type) {
    case 'asfalt':
    case 'vaat-asfalt': {
      const c1 = type === 'asfalt' ? SCENE.asphaltDark : shade(SCENE.asphaltWet, 0.15);
      const t1 = Math.min(fh, clamp(fh * 0.36, 3, 10));
      layer(top, top + t1, [
        [0, c1],
        [1, shade(c1, 0.18)],
      ]);
      add('g', band(0, 70, top, top + t1, 0.3, 0.6, 1), { fill: tint(c1, 0.3), opacity: 0.6 });
      if (fh > t1 + 0.5) {
        layer(top + t1, bottom, [
          [0, shade(SCENE.gravelDark, 0.12)],
          [1, shade(SCENE.gravelDark, 0.38)],
        ]);
        add('pd', band(100, 26, top + t1, bottom, 0.8, 2.2), { fill: shade(SCENE.gravelDark, 0.45) });
        add('pl', band(250, 34, top + t1, bottom, 0.6, 1.6), { fill: SCENE.gravel, opacity: 0.8 });
        add('s', `M${r1(left)},${r1(top + t1)}H${r1(right)}`, { stroke: shade(c1, 0.35), strokeWidth: 0.8 * ss, fill: 'none' });
      }
      break;
    }
    case 'sno': {
      const st = Math.min(fh, clamp(fh * 0.55, 3, 22));
      layer(top + st * 0.5, bottom, [
        [0, SCENE.soilDark],
        [1, shade(SCENE.soilDark, 0.3)],
      ]);
      add('s', band(0, 160, top + st, bottom, 0.8, 1.8), { fill: SCENE.stoneDark, opacity: 0.8 });
      // Snølaget med myk, ujevn underkant (bakken under snøen)
      const amp = Math.min(5, st * 0.4);
      const yb = top + st - (st < fh ? 1 : 0);
      let d = `M${r1(left)},${r1(top)}H${r1(right)}`;
      for (let x = right; x >= left - 0.01; x -= 4) {
        const xx = Math.max(x, left);
        d += `L${r1(xx)},${r1(yb + (edgeNoise(xx + shift, 38, seed + 11) - 0.5) * amp + (edgeNoise(xx + shift, 9, seed + 12) - 0.5) * amp * 0.3)}`;
      }
      d += 'Z';
      const id = `${gid}-sno`;
      defs.push(
        <LinearGradient
          key={id}
          id={id}
          userSpace
          x1={0}
          y1={top}
          x2={0}
          y2={top + st}
          stops={[
            [0, tint(SCENE.snow, 0.2)],
            [1, SCENE.snowShade],
          ]}
        />,
      );
      els.push(<path key="sno" d={d} fill={`url(#${id})`} />);
      add('sl', d, { fill: 'none', stroke: shade(SCENE.snowShade, 0.25), strokeWidth: 0.6 * ss, opacity: 0.6 });
      break;
    }
    case 'is': {
      layer(top, bottom, [
        [0, mix(SCENE.ice, SCENE.iceShine, 0.25)],
        [0.55, SCENE.ice],
        [1, shade(SCENE.ice, 0.42)],
      ]);
      add(
        'c',
        scatter(t, 0, clamp(L / 190, 1, 10), (u, _v, a, b) => {
          let x = X(u);
          let y = top + 0.6;
          const p: Pt[] = [[x, y]];
          for (let s = 0; s < 3; s++) {
            x += (hash01(s, Math.floor(u * 1e6)) - 0.5) * 7;
            y += fh * (0.12 + 0.2 * (s === 0 ? a : b));
            p.push([x, Math.min(bottom - 1, y)]);
          }
          return polyline(p);
        }),
        { fill: 'none', stroke: GLITTER, strokeWidth: 0.6 * ss, opacity: 0.5, strokeLinejoin: 'round' },
      );
      add(
        'b',
        scatter(t, 100, cnt(420, fh), (u, v, a) => circle(X(u), top + fh * (0.15 + 0.8 * v), (0.5 + 0.9 * a) * k)),
        { fill: 'none', stroke: GLITTER, strokeWidth: 0.5 * ss, opacity: 0.45 },
      );
      break;
    }
    case 'gress': {
      const turf = Math.min(fh, clamp(fh * 0.24, 3, 8));
      layer(top, bottom, [
        [0, SCENE.soil],
        [1, shade(SCENE.soilDark, 0.15)],
      ]);
      add('s', band(0, 240, top + turf + 1, bottom, 0.8, 2.2), { fill: SCENE.stone, opacity: 0.85 });
      add('d', band(200, 90, top + turf, bottom, 0.4, 0.8, 1), { fill: SCENE.soilDark, opacity: 0.7 });
      // Gressmatta med tagget underkant (røtter og strå)
      const sp = 2.6 * k;
      const i0 = Math.floor(shift / sp);
      const x0 = left - mod(shift, sp) - sp;
      const p: Pt[] = [[left - sp, top]];
      for (let i = 0; x0 + i * sp <= right + sp; i++) {
        const deep = (i0 + i) % 2 === 0;
        p.push([x0 + i * sp, top + turf * (deep ? 0.75 + 0.45 * hash01(i0 + i, seed) : 0.5 + 0.15 * hash01(i0 + i, seed + 1))]);
      }
      p.push([right + sp, top]);
      add('t', polygon(p), { fill: SCENE.grassDark });
      break;
    }
    case 'grus':
      layer(top, bottom, [
        [0, shade(SCENE.gravel, 0.08)],
        [1, shade(SCENE.gravel, 0.32)],
      ]);
      add('d', band(0, 22, top, bottom, 0.8, 2.2), { fill: SCENE.gravelDark });
      add('l', band(200, 30, top, bottom, 0.6, 1.8), { fill: tint(SCENE.gravel, 0.25) });
      add('s', band(400, 80, top, bottom, 1.2, 2.6), { fill: SCENE.stone });
      break;
    case 'betong':
      layer(top, bottom, [
        [0, SCENE.concreteDark],
        [1, shade(SCENE.concreteDark, 0.22)],
      ]);
      add('d', band(0, 60, top, bottom, 0.4, 0.9, 1), { fill: shade(SCENE.concreteDark, 0.3), opacity: 0.6 });
      add('l', band(200, 80, top, bottom, 0.4, 0.8, 1), { fill: tint(SCENE.concrete, 0.3), opacity: 0.6 });
      add('c', `M${r1(left)},${r1(top + Math.min(1.2, fh / 2))}H${r1(right)}`, {
        fill: 'none',
        stroke: tint(SCENE.concrete, 0.4),
        strokeWidth: 0.8 * ss,
        opacity: 0.7,
      });
      break;
    case 'tregulv': {
      const bt = Math.min(fh, clamp(fh * 0.38, 3, 8));
      layer(top, top + bt, [
        [0, SCENE.floorDark],
        [1, shade(SCENE.floorDark, 0.2)],
      ]);
      if (fh > bt + 0.5) {
        layer(top + bt, bottom, [
          [0, shade(SCENE.woodDark, 0.05)],
          [1, shade(SCENE.woodDark, 0.32)],
        ]);
        let j = '';
        for (let xx = left + mod(40 - shift, 110); xx < right; xx += 110) j += `M${r1(xx)},${r1(top + bt)}V${r1(bottom)}`;
        add('j', j, { fill: 'none', stroke: shade(SCENE.woodDark, 0.5), strokeWidth: 0.9 * ss, opacity: 0.6 });
        add('s', `M${r1(left)},${r1(top + bt)}H${r1(right)}`, { fill: 'none', stroke: shade(SCENE.floorDark, 0.4), strokeWidth: 0.8 * ss });
      }
      break;
    }
    case 'jord':
      layer(top, bottom, [
        [0, shade(SCENE.soil, 0.12)],
        [1, shade(SCENE.soilDark, 0.3)],
      ]);
      add('s', band(0, 120, top, bottom, 0.9, 2.0), { fill: SCENE.stone, opacity: 0.9 });
      add('d', band(200, 50, top, bottom, 0.5, 1.1), { fill: shade(SCENE.soilDark, 0.2), opacity: 0.8 });
      add('l', band(400, 70, top, bottom, 0.35, 0.7, 1), { fill: tint(SCENE.soil, 0.25), opacity: 0.8 });
      break;
    case 'labbenk': {
      const et = Math.min(fh, clamp(fh * 0.42, 4, 11));
      layer(top, top + et, [
        [0, tint(SCENE.benchEdge, 0.25)],
        [0.35, SCENE.benchEdge],
        [1, shade(SCENE.benchEdge, 0.18)],
      ]);
      if (fh > et + 1) {
        const gap = Math.min(2.5, fh - et);
        add(
          'gap',
          polygon([
            [left, top + et],
            [right, top + et],
            [right, top + et + gap],
            [left, top + et + gap],
          ]),
          { fill: shade(SCENE.benchEdge, 0.55), opacity: 0.85 },
        );
        const cab = top + et + gap;
        layer(cab, bottom, [
          [0, mix(SCENE.bench, SCENE.benchEdge, 0.55)],
          [1, shade(SCENE.benchEdge, 0.12)],
        ]);
        // Skapdører fordelt jevnt mellom endene (ca. 110 brede), med håndtaket midt på hver dør. Med forskyvning
        // ruller dørene med teksturen (perioden er hele bredden, så de passer sammen).
        let seams = '';
        let handles = '';
        const hw = Math.min(6 * k, L * 0.2);
        const hh = 1.1 * k;
        const nd = Math.max(1, Math.round(L / 110));
        const dw = L / nd;
        for (let i = 0; i < nd; i++) {
          const sx = left + mod(i * dw - shift, L);
          if (sx > left + 1 && sx < right - 1) seams += `M${r1(sx)},${r1(cab + 1.5)}V${r1(bottom)}`;
          const hx = left + mod((i + 0.5) * dw - shift, L);
          if (bottom - cab > 8)
            handles += polygon([
              [hx - hw, cab + 4],
              [hx + hw, cab + 4],
              [hx + hw, cab + 4 + 2 * hh],
              [hx - hw, cab + 4 + 2 * hh],
            ]);
        }
        add('s', seams, { fill: 'none', stroke: shade(SCENE.benchEdge, 0.35), strokeWidth: 0.9 * ss });
        add('h', handles, { fill: SCENE.metal, stroke: SCENE.outline, strokeWidth: 0.5 * ss });
      }
      break;
    }
  }

  return (
    <g>
      {defs}
      <clipPath id={cid}>
        <rect x={left} y={top} width={L} height={fh} />
      </clipPath>
      <g clipPath={`url(#${cid})`}>{els}</g>
    </g>
  );
}

/**
 * Bakkanten av toppflaten (silhuetten mot bakgrunnen): myke hauger i snø, strå i gress og rett ellers.
 * Gir punktene fra venstre til høyre (bruk dem både til fyll og kontur).
 */
export function backEdge(type: UnderlagType, left: number, right: number, top: number, shift: number, seed: number, k: number): Pt[] {
  if (type === 'sno') {
    const pts: Pt[] = [];
    const step = 4;
    for (let x = left; x <= right + 0.01; x += step) {
      pts.push([Math.min(x, right), top + 0.8 - (0.6 + 2.6 * edgeNoise(x + shift, 34, seed)) * Math.sqrt(k)]);
    }
    const last = pts[pts.length - 1];
    if (last && last[0] < right) pts.push([right, last[1]]);
    return pts;
  }
  if (type === 'gress') {
    // Strå i ujevn høyde og avstand, litt på skrå
    const sp = 1.7 * k;
    const i0 = Math.floor(shift / sp);
    const x0 = left - mod(shift, sp);
    const pts: Pt[] = [[left, top + 0.4]];
    for (let i = 0; x0 + i * sp <= right; i++) {
      const id = i0 + i;
      const x = x0 + i * sp + (hash01(id, seed + 3) - 0.5) * sp * 0.5;
      if (x < left || x > right) continue;
      if (id % 2 === 0) {
        const hgt = (0.3 + 2.2 * Math.pow(hash01(id, seed), 2)) * k;
        pts.push([x + (hash01(id, seed + 5) - 0.5) * hgt * 0.5, top - hgt]);
      } else pts.push([x, top + 0.4]);
    }
    pts.push([right, top + 0.4]);
    return pts;
  }
  return [
    [left, top],
    [right, top],
  ];
}
