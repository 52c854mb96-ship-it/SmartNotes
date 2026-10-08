/**
 * Egne deler til «Varmepumpe eller panelovn» (scene-kit-et har dem ikke): utedel og innedel til en luft-til-luft-
 * varmepumpe, kabelkanal for rørene, vindu, et hus i snitt (isolert vegg og skrå himling under taket) og en bred
 * energipil der bredden er proporsjonal med effekten (bølgete for varme). Samme stil som kit-et: toninger fra
 * core.tsx, SCENE-farger, kontur og myk skygge. Ingen filtre og ingen bilder.
 */
import { memo, useEffect, useRef, useState, type ReactNode } from 'react';
import { VIZ } from '../../kit';
import {
  ContactShadow,
  LinearGradient,
  PAINTS,
  RadialGradient,
  Rom,
  SCENE,
  SCENE_DIM,
  alpha,
  materialStops,
  mix,
  shade,
  tint,
  useStrokeScale,
  useSvgId,
} from '../../kit/scene';

const r1 = (v: number) => Math.round(v * 10) / 10;
const pts = (list: [number, number][]) => list.map(([x, y]) => `${r1(x)},${r1(y)}`).join(' ');

/** Lakken på varmepumpa: hvit, litt grå (pulverlakkert stål ute, plast inne). */
const BODY = mix(PAINTS.hvit, SCENE.metalLight, 0.3);
const INNER = mix(PAINTS.hvit, SCENE.plastic, 0.15);

/** Om elementet er smalere enn `limit` piksler (mobil eller smal kolonne): da brukes de smale oppsettene. */
export function useNarrow<T extends HTMLElement>(limit = 560) {
  const ref = useRef<T>(null);
  const [narrow, setNarrow] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const update = () => {
      const w = el.getBoundingClientRect().width;
      if (w > 0) setNarrow(w < limit);
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [limit]);
  return [ref, narrow] as const;
}

/* ---------------------------------------------------------------- Utedelen */

/** Målene på utedelen: (x, y) er midt på bakken under stativet, `w` bredden på selve enheten. */
export function utedelMaal(x: number, y: number, w: number) {
  const h = 0.7 * w;
  const stand = 0.36 * w;
  const bottom = y - stand;
  const top = bottom - h;
  const left = x - w / 2;
  const right = x + w / 2;
  return {
    h,
    bottom,
    top,
    left,
    right,
    /** Viften (sentrum og radius). */
    fan: { cx: left + 0.36 * w, cy: top + 0.5 * h, r: 0.29 * w },
    /** Der rørene kommer ut på høyre side. */
    pipe: { x: right, y: top + 0.74 * h },
  };
}

/**
 * Utedelen til en luft-til-luft-varmepumpe sett forfra: hvit stålkasse med stor vifte bak en rist til venstre,
 * servicepanel med lameller til høyre, på et bakkestativ så snøen ikke tetter den. (x, y) er midt på bakken under
 * stativet; `w` er bredden (en vanlig utedel er ca. 0,85 m bred og 0,6 m høy, stativet ca. 0,3 m).
 */
export const Utedel = memo(function Utedel({
  x,
  y,
  w,
  sno = 0,
  vifte = 18,
  paa = true,
  dim,
}: {
  x: number;
  y: number;
  w: number;
  /** Snø på toppen, 0–1. */
  sno?: number;
  /** Vinkelen til viftebladene (grader). */
  vifte?: number;
  /** Viften går (bladene blir uskarpe). */
  paa?: boolean;
  dim?: boolean;
}) {
  const ss = useStrokeScale();
  const id = useSvgId('vp-ute');
  const m = utedelMaal(x, y, w);
  const { fan } = m;
  const R = fan.r;
  const post = 0.05 * w;
  const posts = [m.left + 0.14 * w, m.right - 0.14 * w];
  const rail = 0.045 * w;
  const blades = [0, 120, 240].map((a) => bladePath(fan.cx, fan.cy, R, a + vifte));
  const panelX = m.left + 0.72 * w;
  const vents: number[] = [];
  for (let i = 0; i < 6; i++) vents.push(m.top + 0.12 * m.h + i * 0.075 * m.h);
  const snowH = 0.075 * w * Math.max(0, Math.min(1, sno));
  const lip = 0.025 * w;
  return (
    <g aria-hidden opacity={dim ? SCENE_DIM : undefined}>
      <LinearGradient id={`${id}-b`} stops={materialStops(BODY, 1.1)} />
      <LinearGradient id={`${id}-s`} x2={1} y2={0} stops={[[0, tint(SCENE.metalDark, 0.15)], [1, shade(SCENE.metalDark, 0.25)]]} />
      <RadialGradient
        id={`${id}-hull`}
        stops={[
          [0, shade(SCENE.metalDark, 0.55)],
          [0.75, shade(SCENE.metalDark, 0.4)],
          [1, shade(SCENE.metalDark, 0.15)],
        ]}
      />
      <RadialGradient id={`${id}-nav`} fx={0.35} fy={0.35} stops={[[0, tint(SCENE.metal, 0.4)], [1, shade(SCENE.metal, 0.2)]]} />
      <LinearGradient id={`${id}-sno`} stops={[[0, tint(SCENE.snow, 0.3)], [1, SCENE.snowShade]]} />

      <ContactShadow cx={x} cy={y} rx={0.58 * w} ry={0.06 * w} />
      {/* Bakkestativet: to stolper med fotplate og en skinne under kassen */}
      {posts.map((px) => (
        <g key={px}>
          <rect x={px - post / 2} y={m.bottom} width={post} height={y - m.bottom} fill={`url(#${id}-s)`} stroke={SCENE.outline} strokeWidth={0.8 * ss} />
          <rect x={px - 1.6 * post} y={y - 0.025 * w} width={3.2 * post} height={0.025 * w} rx={0.008 * w} fill={shade(SCENE.metalDark, 0.2)} />
        </g>
      ))}
      <rect x={m.left + 0.05 * w} y={m.bottom} width={0.9 * w} height={rail} fill={`url(#${id}-s)`} stroke={SCENE.outline} strokeWidth={0.8 * ss} />

      {/* Kassen */}
      <rect x={m.left} y={m.top} width={w} height={m.h} rx={0.02 * w} fill={`url(#${id}-b)`} stroke={SCENE.outline} strokeWidth={1 * ss} />
      <rect x={m.left + 0.01 * w} y={m.top + 0.01 * w} width={0.98 * w} height={0.035 * w} rx={0.01 * w} fill={tint(BODY, 0.35)} opacity={0.8} />

      {/* Viften bak risten */}
      <circle cx={fan.cx} cy={fan.cy} r={R * 1.06} fill={shade(BODY, 0.12)} stroke={SCENE.outline} strokeWidth={0.7 * ss} />
      <circle cx={fan.cx} cy={fan.cy} r={R} fill={`url(#${id}-hull)`} />
      <g opacity={paa ? 0.55 : 1}>
        {blades.map((d, i) => (
          <path key={i} d={d} fill={mix(SCENE.metal, SCENE.plastic, 0.4)} stroke={shade(SCENE.metalDark, 0.3)} strokeWidth={0.6 * ss} />
        ))}
      </g>
      {paa && <circle cx={fan.cx} cy={fan.cy} r={R * 0.88} fill={alpha(SCENE.metal, 0.18)} />}
      <circle cx={fan.cx} cy={fan.cy} r={R * 0.17} fill={`url(#${id}-nav)`} stroke={shade(SCENE.metalDark, 0.2)} strokeWidth={0.6 * ss} />
      {/* Risten: ringer og eiker i lys stål */}
      <g fill="none" stroke={tint(SCENE.metal, 0.35)} strokeWidth={0.9 * ss} opacity={0.85}>
        {[0.38, 0.64, 0.88].map((k) => (
          <circle key={k} cx={fan.cx} cy={fan.cy} r={R * k} />
        ))}
        <path d={`M${r1(fan.cx - R)},${r1(fan.cy)}H${r1(fan.cx + R)}M${r1(fan.cx)},${r1(fan.cy - R)}V${r1(fan.cy + R)}`} />
      </g>

      {/* Servicepanelet med lameller og typeskilt */}
      <line x1={panelX} y1={m.top + 0.04 * w} x2={panelX} y2={m.bottom - 0.02 * w} stroke={shade(BODY, 0.25)} strokeWidth={0.9 * ss} />
      <g stroke={shade(BODY, 0.35)} strokeWidth={1.2 * ss} strokeLinecap="round">
        {vents.map((vy) => (
          <line key={vy} x1={panelX + 0.04 * w} y1={vy} x2={m.right - 0.04 * w} y2={vy} />
        ))}
      </g>
      <rect x={panelX + 0.05 * w} y={m.top + 0.64 * m.h} width={0.14 * w} height={0.09 * m.h} rx={0.005 * w} fill={tint(SCENE.metal, 0.3)} stroke={shade(BODY, 0.3)} strokeWidth={0.5 * ss} />
      {/* Rørtilkoblingene under et deksel på siden */}
      <rect x={m.right - 0.012 * w} y={m.pipe.y - 0.09 * w} width={0.03 * w} height={0.13 * w} rx={0.008 * w} fill={shade(BODY, 0.1)} stroke={SCENE.outline} strokeWidth={0.7 * ss} />

      {/* Snø på toppen */}
      {snowH > 0.5 && (
        <path
          d={`M${r1(m.left - lip)},${r1(m.top + 0.6)} Q${r1(m.left - lip)},${r1(m.top - snowH)} ${r1(m.left + 0.12 * w)},${r1(m.top - snowH)} L${r1(m.right - 0.1 * w)},${r1(m.top - snowH * 1.05)} Q${r1(m.right + lip)},${r1(m.top - snowH)} ${r1(m.right + lip)},${r1(m.top + 0.6)} Z`}
          fill={`url(#${id}-sno)`}
          stroke={alpha(SCENE.snowShade, 0.9)}
          strokeWidth={0.7 * ss}
        />
      )}
    </g>
  );
});

/** Ett vifteblad: bredt og buet, fra navet ut mot kanten, dreid `deg` grader. */
function bladePath(cx: number, cy: number, R: number, deg: number): string {
  const p = (r: number, a: number): [number, number] => {
    const t = ((a + deg) * Math.PI) / 180;
    return [cx + r * Math.cos(t), cy + r * Math.sin(t)];
  };
  const a = p(0.16 * R, -18);
  const b = p(0.9 * R, 8);
  const c = p(0.9 * R, 62);
  const d = p(0.16 * R, 48);
  const k1 = p(0.6 * R, -20);
  const k2 = p(0.5 * R, 52);
  return `M${r1(a[0])},${r1(a[1])}Q${r1(k1[0])},${r1(k1[1])} ${r1(b[0])},${r1(b[1])}A${r1(0.9 * R)},${r1(0.9 * R)} 0 0,1 ${r1(c[0])},${r1(c[1])}Q${r1(k2[0])},${r1(k2[1])} ${r1(d[0])},${r1(d[1])}Z`;
}

/* ---------------------------------------------------------------- Innedelen */

/** Målene på innedelen: (x, y) er midt på overkanten, `w` bredden. */
export function innedelMaal(x: number, y: number, w: number) {
  const h = 0.3 * w;
  return {
    h,
    left: x - w / 2,
    right: x + w / 2,
    top: y,
    bottom: y + h,
    /** Midt i luftutblåsningen nederst. */
    outlet: { x, y: y + h },
    /** Der rørene går ut bak, i venstre ende. */
    pipe: { x: x - w / 2, y: y + 0.55 * h },
  };
}

/**
 * Innedelen til en luft-til-luft-varmepumpe sett forfra: lang, hvit plastkasse høyt på veggen med luftinntak oppe,
 * glatt front, lampe og en lamell nederst som står åpen når den blåser varm luft ut. (x, y) er midt på overkanten;
 * `w` er bredden (en vanlig innedel er ca. 0,9 m bred og 0,3 m høy).
 */
export const Innedel = memo(function Innedel({ x, y, w, paa = true, dim }: { x: number; y: number; w: number; paa?: boolean; dim?: boolean }) {
  const ss = useStrokeScale();
  const id = useSvgId('vp-inne');
  const m = innedelMaal(x, y, w);
  const { h } = m;
  const rr = 0.2 * h;
  return (
    <g aria-hidden opacity={dim ? SCENE_DIM : undefined}>
      <LinearGradient id={`${id}-b`} stops={[[0, tint(INNER, 0.3)], [0.5, INNER], [1, shade(INNER, 0.14)]]} />
      {/* Skygge på veggen under og bak */}
      <rect x={m.left + 0.02 * w} y={m.top + 0.2 * h} width={w} height={h * 0.95} rx={rr} fill={SCENE.shadow} opacity={0.22} />
      <rect x={m.left} y={m.top} width={w} height={h} rx={rr} fill={`url(#${id}-b)`} stroke={SCENE.outline} strokeWidth={1 * ss} />
      {/* Luftinntaket oppe */}
      <g stroke={shade(INNER, 0.22)} strokeWidth={0.8 * ss} strokeLinecap="round">
        {[0.1, 0.18].map((k) => (
          <line key={k} x1={m.left + 0.06 * w} y1={m.top + k * h} x2={m.right - 0.06 * w} y2={m.top + k * h} />
        ))}
      </g>
      {/* Frontpanelet og lampa */}
      <line x1={m.left + 0.03 * w} y1={m.top + 0.66 * h} x2={m.right - 0.03 * w} y2={m.top + 0.66 * h} stroke={shade(INNER, 0.18)} strokeWidth={0.8 * ss} />
      <rect x={m.right - 0.17 * w} y={m.top + 0.36 * h} width={0.075 * w} height={0.16 * h} rx={0.03 * h} fill={shade(SCENE.metalDark, 0.35)} />
      <circle cx={m.right - 0.06 * w} cy={m.top + 0.44 * h} r={0.035 * h + 0.6} fill={paa ? tint(PAINTS.gronn, 0.25) : SCENE.metal} />
      {/* Utblåsningen nederst og lamellen */}
      <rect x={m.left + 0.07 * w} y={m.top + 0.74 * h} width={0.86 * w} height={0.14 * h} rx={0.05 * h} fill={shade(SCENE.metalDark, 0.4)} />
      {paa && (
        <polygon
          points={pts([
            [m.left + 0.075 * w, m.top + 0.86 * h],
            [m.right - 0.075 * w, m.top + 0.86 * h],
            [m.right - 0.09 * w, m.bottom + 0.14 * h],
            [m.left + 0.09 * w, m.bottom + 0.14 * h],
          ])}
          fill={shade(INNER, 0.06)}
          stroke={SCENE.outline}
          strokeWidth={0.7 * ss}
          strokeLinejoin="round"
        />
      )}
    </g>
  );
});

/* ---------------------------------------------------------------- Kabelkanal */

/** Hvit kabelkanal (med rørene og ledningen inni) langs en polylinje, med kontur og en svak skjøt i lokket. */
export function Kabelkanal({ points, bredde, dim }: { points: [number, number][]; bredde: number; dim?: boolean }) {
  const ss = useStrokeScale();
  if (points.length < 2) return null;
  const d = 'M' + points.map(([x, y]) => `${r1(x)},${r1(y)}`).join('L');
  return (
    <g aria-hidden fill="none" strokeLinejoin="miter" opacity={dim ? SCENE_DIM : undefined}>
      <path d={d} stroke={SCENE.outline} strokeWidth={bredde + 1.8 * ss} strokeLinecap="square" />
      <path d={d} stroke={INNER} strokeWidth={bredde} strokeLinecap="square" />
      <path d={d} stroke={shade(INNER, 0.18)} strokeWidth={0.7 * ss} opacity={0.8} />
    </g>
  );
}

/* ---------------------------------------------------------------- Vindu */

/**
 * Vindu i en vegg sett innenfra: hvit karm med midtpost, glass med himmel og et glimt av bakken utenfor (snø om
 * vinteren) og vindusbrett. (x, top) er midt på overkanten av karmen.
 */
export function Vindu({ x, top, w, h, sno }: { x: number; top: number; w: number; h: number; sno: boolean }) {
  const ss = useStrokeScale();
  const id = useSvgId('vp-vindu');
  const f = Math.max(3, 0.07 * w);
  const L = x - w / 2;
  const gx = L + f;
  const gy = top + f;
  const gw = w - 2 * f;
  const gh = h - 2 * f;
  const ground = gy + gh * 0.78;
  return (
    <g aria-hidden>
      <LinearGradient id={`${id}-h`} stops={[[0, SCENE.skyTop], [1, SCENE.skyBottom]]} />
      <rect x={L - 2} y={top - 2} width={w + 4} height={h + 4} fill={SCENE.shadow} opacity={0.18} />
      <rect x={L} y={top} width={w} height={h} fill={PAINTS.hvit} stroke={SCENE.outline} strokeWidth={0.9 * ss} />
      <rect x={gx} y={gy} width={gw} height={gh} fill={`url(#${id}-h)`} />
      <rect x={gx} y={ground} width={gw} height={gy + gh - ground} fill={sno ? SCENE.snow : SCENE.grass} />
      <path
        d={`M${r1(gx)},${r1(ground)} q${r1(gw * 0.25)},${r1(-gh * 0.06)} ${r1(gw * 0.5)},${r1(-gh * 0.03)} t${r1(gw * 0.5)},${r1(-gh * 0.02)} V${r1(ground)} Z`}
        fill={sno ? SCENE.snowShade : SCENE.grassDark}
        opacity={0.8}
      />
      {/* Refleks i glasset */}
      <polygon
        points={pts([
          [gx + gw * 0.12, gy],
          [gx + gw * 0.32, gy],
          [gx, gy + gh * 0.36],
          [gx, gy + gh * 0.16],
        ])}
        fill={SCENE.highlight}
        opacity={0.28}
      />
      <rect x={gx} y={gy} width={gw} height={gh} fill="none" stroke={shade(PAINTS.hvit, 0.25)} strokeWidth={0.8 * ss} />
      <rect x={x - f * 0.45} y={gy} width={f * 0.9} height={gh} fill={PAINTS.hvit} stroke={shade(PAINTS.hvit, 0.25)} strokeWidth={0.6 * ss} />
      {/* Vindusbrett */}
      <rect x={L - 0.08 * w} y={top + h - 1} width={w * 1.16} height={Math.max(3, 0.05 * w)} rx={1} fill={tint(PAINTS.hvit, 0.1)} stroke={SCENE.outline} strokeWidth={0.8 * ss} />
    </g>
  );
}

/* ---------------------------------------------------------------- Gulvlampe */

/**
 * Gulvlampe med stoffskjerm, tynn stang og rund fot. Lyset faller varmt på veggen rundt. (x, y) er midt under foten;
 * `h` er høyden (en vanlig gulvlampe er ca. 1,5 m).
 */
export function Gulvlampe({ x, y, h }: { x: number; y: number; h: number }) {
  const ss = useStrokeScale();
  const id = useSvgId('vp-lampe');
  const sw = 0.3 * h;
  const sh = 0.2 * h;
  const top = y - h;
  const bot = top + sh;
  const fabric = mix(PAINTS.hvit, SCENE.warm, 0.25);
  return (
    <g aria-hidden>
      <RadialGradient
        id={`${id}-g`}
        userSpace
        cx={x}
        cy={bot}
        r={0.95 * h}
        stops={[
          [0, SCENE.glow, 0.42],
          [0.4, SCENE.glow, 0.14],
          [1, SCENE.glow, 0],
        ]}
      />
      <LinearGradient id={`${id}-s`} x2={1} y2={0} stops={[[0, tint(fabric, 0.3)], [0.5, tint(fabric, 0.12)], [1, shade(fabric, 0.12)]]} />
      <LinearGradient id={`${id}-f`} stops={materialStops(SCENE.metalDark, 1.2)} />
      <circle cx={x} cy={bot} r={0.95 * h} fill={`url(#${id}-g)`} />
      <ContactShadow cx={x} cy={y} rx={0.14 * h} ry={0.025 * h} />
      <line x1={x} y1={bot - 0.02 * h} x2={x} y2={y - 0.02 * h} stroke={shade(SCENE.metalDark, 0.15)} strokeWidth={Math.max(1.2, 0.014 * h) * ss} />
      <ellipse cx={x} cy={y - 0.018 * h} rx={0.11 * h} ry={0.024 * h} fill={`url(#${id}-f)`} stroke={SCENE.outline} strokeWidth={0.7 * ss} />
      {/* Lyset under skjermen */}
      <ellipse cx={x} cy={bot} rx={sw / 2 - 1} ry={0.035 * h} fill={tint(SCENE.glow, 0.3)} />
      <polygon
        points={pts([
          [x - 0.32 * sw, top],
          [x + 0.32 * sw, top],
          [x + 0.5 * sw, bot],
          [x - 0.5 * sw, bot],
        ])}
        fill={`url(#${id}-s)`}
        stroke={SCENE.outline}
        strokeWidth={0.8 * ss}
        strokeLinejoin="round"
      />
    </g>
  );
}

/* ---------------------------------------------------------------- Huset i snitt */

export interface HusGeo {
  /** Bredden og høyden på figuren. */
  W: number;
  H: number;
  /** Ytterkanten av veggen. */
  wallX: number;
  /** Veggtykkelsen. */
  wt: number;
  /** Der bakveggen møter gulvet (gulvY i Rom). */
  gulvY: number;
  /** Forkanten av gulvet, som også er bakken ute. */
  ground: number;
  /** Himlingen ved innsiden av ytterveggen. */
  eave: number;
  /** Helningen på taket og himlingen (stigning per vannrett lengde). */
  slope: number;
  /** Piksler per meter. */
  px: number;
}

/** Himlingen (undersiden av taket) i x. */
export function ceilAt(g: HusGeo, x: number): number {
  return g.eave - g.slope * (x - (g.wallX + g.wt));
}

/**
 * Innsiden av huset: stua med vegg og tregulv (Rom), klippet under den skrå himlingen, med skygge under taket og
 * varmt lys fra en lampe. Tegnes før det som henger på veggen og før HusSnitt.
 */
export const HusInne = memo(function HusInne({ g, children }: { g: HusGeo; children?: ReactNode }) {
  const id = useSvgId('vp-inne-rom');
  const inL = g.wallX + g.wt;
  const topY = Math.min(0, ceilAt(g, g.W)) - 4;
  const poly: [number, number][] = [
    [inL, g.ground],
    [inL, g.eave],
    [g.W, ceilAt(g, g.W)],
    [g.W, g.ground],
  ];
  const band = 0.35 * g.px;
  return (
    <g aria-hidden>
      <clipPath id={`${id}-k`}>
        <polygon points={pts(poly)} />
      </clipPath>
      <RadialGradient
        id={`${id}-lys`}
        userSpace
        cx={inL + 0.62 * (g.W - inL)}
        cy={g.gulvY - 1.5 * g.px}
        r={0.75 * (g.W - inL)}
        stops={[
          [0, SCENE.glow, 0.28],
          [0.5, SCENE.glow, 0.1],
          [1, SCENE.glow, 0],
        ]}
      />
      <LinearGradient
        id={`${id}-tak`}
        userSpace
        x1={0}
        y1={0}
        x2={-g.slope * band}
        y2={band}
        stops={[
          [0, SCENE.shadow, 0.4],
          [1, SCENE.shadow, 0],
        ]}
      />
      <g clipPath={`url(#${id}-k)`}>
        <Rom x={inL} y={topY} w={g.W - inL} h={g.ground - topY} gulvY={g.gulvY} gulv="tre" />
        <rect x={inL} y={topY} width={g.W - inL} height={g.ground - topY} fill={`url(#${id}-lys)`} />
        {/* Skygge langs den skrå himlingen */}
        <polygon
          points={pts([
            [inL, g.eave],
            [g.W, ceilAt(g, g.W)],
            [g.W, ceilAt(g, g.W) + band],
            [inL, g.eave + band],
          ])}
          fill={SCENE.shadow}
          opacity={0.16}
        />
        {children}
      </g>
    </g>
  );
});

/**
 * Huset i snitt, oppå det som er inne: rød kledning, isolert yttervegg, tak med takfot, isolasjon og taktekking
 * (snø om vinteren), og gulvet på en isolert betongplate med grunnmur. Isolasjonen har vanlig sikksakkskravur.
 */
export const HusSnitt = memo(function HusSnitt({ g, sno }: { g: HusGeo; sno: boolean }) {
  const ss = useStrokeScale();
  const id = useSvgId('vp-snitt');
  const { px, wallX, wt, ground, H, W } = g;
  const inL = wallX + wt;
  const roofT = 0.3 * px;
  const overhang = 0.5 * px;
  const x0 = wallX - overhang;
  const xEnd = W + 4;
  const under = (x: number) => ceilAt(g, x);
  const top = (x: number) => under(x) - roofT;
  const insul = mix(SCENE.gold, PAINTS.hvit, 0.55);
  const clad = PAINTS.rod;
  const plinth = 0.32 * px;
  const cladBot = ground - plinth;
  const slabT = Math.min(0.32 * px, H - ground - 2);
  // Isolasjonen i veggen: sikksakk mellom innerpanelet og kledningen
  const wallIns0 = wallX + 0.055 * px;
  const wallIns1 = inL - 0.03 * px;
  const zig = (xa: number, xb: number, ya: number, yb: number) => {
    const step = Math.max(5, (xb - xa) * 0.9);
    let d = `M${r1(xa)},${r1(ya)}`;
    let left = true;
    for (let yy = ya + step / 2; yy <= yb; yy += step / 2) {
      d += `L${r1(left ? xb : xa)},${r1(yy)}`;
      left = !left;
    }
    return d;
  };
  // Isolasjonen i taket: sikksakk langs skråningen
  const roofIns = (() => {
    const t0 = 0.05 * px;
    const t1 = 0.22 * px;
    const step = 0.16 * px;
    let d = '';
    let up = true;
    for (let x = inL; x <= xEnd; x += step / 2) {
      const yy = under(x) - (up ? t0 : t1);
      d += `${d ? 'L' : 'M'}${r1(x)},${r1(yy)}`;
      up = !up;
    }
    return d;
  })();
  const roofPoly: [number, number][] = [
    [x0, under(x0)],
    [xEnd, under(xEnd)],
    [xEnd, top(xEnd)],
    [x0, top(x0)],
  ];
  const snowH = 0.2 * px;
  return (
    <g aria-hidden>
      <LinearGradient id={`${id}-tak`} stops={materialStops(mix(SCENE.asphaltDark, SCENE.brick, 0.25), 1.2)} />
      <LinearGradient id={`${id}-kl`} x2={1} y2={0} stops={[[0, shade(clad, 0.12)], [1, tint(clad, 0.06)]]} />
      <LinearGradient id={`${id}-bet`} stops={[[0, SCENE.concrete], [1, shade(SCENE.concrete, 0.25)]]} />
      <LinearGradient id={`${id}-sno`} stops={[[0, tint(SCENE.snow, 0.3)], [1, SCENE.snowShade]]} />

      {/* Gulvet i snitt: parkett på isolert betongplate */}
      <rect x={inL} y={ground} width={W - inL} height={0.04 * px} fill={SCENE.woodDark} />
      <rect x={inL} y={ground + 0.04 * px} width={W - inL} height={slabT * 0.45} fill={insul} />
      <path d={zigH(inL, W, ground + 0.04 * px, ground + 0.04 * px + slabT * 0.45)} fill="none" stroke={shade(insul, 0.3)} strokeWidth={0.7 * ss} />
      <rect x={inL} y={ground + 0.04 * px + slabT * 0.45} width={W - inL} height={H - ground} fill={`url(#${id}-bet)`} />
      <line x1={inL} y1={ground} x2={W} y2={ground} stroke={SCENE.outline} strokeWidth={0.9 * ss} />

      {/* Grunnmuren under veggen */}
      <rect x={wallX - 0.02 * px} y={cladBot} width={wt + 0.02 * px} height={H - cladBot + 2} fill={`url(#${id}-bet)`} stroke={SCENE.outline} strokeWidth={0.9 * ss} />

      {/* Ytterveggen: kledning, isolasjon og innerpanel */}
      <rect x={wallX} y={under(wallX) - 1} width={wt} height={cladBot - under(wallX) + 1} fill={insul} stroke={SCENE.outline} strokeWidth={0.9 * ss} />
      <path d={zig(wallIns0, wallIns1, under(wallX) + 2, cladBot - 2)} fill="none" stroke={shade(insul, 0.3)} strokeWidth={0.7 * ss} />
      <rect x={inL - 0.03 * px} y={under(inL) - 1} width={0.03 * px} height={cladBot - under(inL) + 1} fill={SCENE.woodLight} />
      <rect x={wallX} y={under(wallX) - 1} width={0.05 * px} height={cladBot - under(wallX) + 1} fill={`url(#${id}-kl)`} stroke={SCENE.outline} strokeWidth={0.7 * ss} />
      <line x1={inL} y1={under(inL)} x2={inL} y2={ground} stroke={SCENE.outline} strokeWidth={0.9 * ss} />

      {/* Taket: isolasjon, taktekking og takfot */}
      <polygon points={pts(roofPoly)} fill={insul} stroke={SCENE.outline} strokeWidth={0.9 * ss} strokeLinejoin="round" />
      <path d={roofIns} fill="none" stroke={shade(insul, 0.3)} strokeWidth={0.7 * ss} />
      <polygon
        points={pts([
          [x0, top(x0) + 0.07 * px],
          [xEnd, top(xEnd) + 0.07 * px],
          [xEnd, top(xEnd)],
          [x0, top(x0)],
        ])}
        fill={`url(#${id}-tak)`}
        stroke={SCENE.outline}
        strokeWidth={0.9 * ss}
        strokeLinejoin="round"
      />
      <line x1={inL} y1={under(inL)} x2={xEnd} y2={under(xEnd)} stroke={SCENE.woodLight} strokeWidth={0.03 * px} />
      {/* Vindskiet ved takfoten */}
      <rect x={x0 - 0.04 * px} y={top(x0) - 0.02 * px} width={0.05 * px} height={roofT + 0.06 * px} fill={PAINTS.hvit} stroke={SCENE.outline} strokeWidth={0.8 * ss} />
      {sno && (
        <path
          d={`M${r1(x0 - 0.06 * px)},${r1(top(x0))} Q${r1(x0 - 0.1 * px)},${r1(top(x0) - snowH)} ${r1(x0 + 0.15 * px)},${r1(top(x0 + 0.15 * px) - snowH)} L${r1(xEnd)},${r1(top(xEnd) - snowH)} L${r1(xEnd)},${r1(top(xEnd))} Z`}
          fill={`url(#${id}-sno)`}
          stroke={alpha(SCENE.snowShade, 0.9)}
          strokeWidth={0.8 * ss}
          strokeLinejoin="round"
        />
      )}
    </g>
  );
});

/** Vannrett sikksakk (isolasjon i en liggende plate). */
function zigH(xa: number, xb: number, ya: number, yb: number): string {
  const step = Math.max(5, (yb - ya) * 0.9);
  let d = '';
  let up = true;
  for (let x = xa; x <= xb; x += step / 2) {
    d += `${d ? 'L' : 'M'}${r1(x)},${r1(up ? ya + 1 : yb - 1)}`;
    up = !up;
  }
  return d;
}

/* ---------------------------------------------------------------- Energipila */

/**
 * Bred energipil fra (x1, y1) til spissen (x2, y2), der bredden er proporsjonal med effekten (som i et
 * energiflytdiagram). `boelger` > 0 gir en bølgete pil (varme); bølgen dør ut mot spissen. Glorie som ForceArrow.
 */
export function Energipil({
  x1,
  y1,
  x2,
  y2,
  bredde,
  farge,
  boelger = 0,
  dim,
}: {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  bredde: number;
  farge: string;
  /** Antall bølger langs pila (0 = rett). */
  boelger?: number;
  dim?: boolean;
}) {
  const ss = useStrokeScale();
  const dx = x2 - x1;
  const dy = y2 - y1;
  const L = Math.hypot(dx, dy);
  if (!Number.isFinite(L) || L < 8 || !Number.isFinite(bredde)) return null;
  const ux = dx / L;
  const uy = dy / L;
  const nx = -uy;
  const ny = ux;
  const w = Math.max(3 * ss, bredde);
  const hl = Math.min(L * 0.5, Math.max(12 * ss, 0.7 * w + 8 * ss));
  const hw = w / 2 + Math.max(6 * ss, 0.4 * w);
  const Ls = L - hl;
  const n = boelger > 0 ? 48 : 1;
  const amp = boelger > 0 ? Math.min(0.1 * Ls, 3 * ss + 0.25 * w) : 0;
  const centre: [number, number][] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const off = amp * Math.sin(2 * Math.PI * boelger * t) * (1 - t) * (1 - t);
    centre.push([x1 + ux * t * Ls + nx * off, y1 + uy * t * Ls + ny * off]);
  }
  const left: [number, number][] = [];
  const right: [number, number][] = [];
  centre.forEach(([cx, cy], i) => {
    const a = centre[Math.max(0, i - 1)]!;
    const b = centre[Math.min(n, i + 1)]!;
    let tx = b[0] - a[0];
    let ty = b[1] - a[1];
    const tl = Math.hypot(tx, ty) || 1;
    tx /= tl;
    ty /= tl;
    if (i === n) {
      tx = ux;
      ty = uy;
    }
    left.push([cx - ty * (w / 2), cy + tx * (w / 2)]);
    right.push([cx + ty * (w / 2), cy - tx * (w / 2)]);
  });
  const bx = x1 + ux * Ls;
  const by = y1 + uy * Ls;
  const outline: [number, number][] = [...left, [bx + nx * hw, by + ny * hw], [x2, y2], [bx - nx * hw, by - ny * hw], ...right.reverse()];
  const d = `M${pts(outline).replace(/ /g, 'L')}Z`;
  return (
    <g className="viz-arrow" aria-hidden opacity={dim ? SCENE_DIM : undefined}>
      <path d={d} fill={farge} className="sc-force" strokeWidth={4 * ss} />
      <path d={d} fill="none" stroke={shade(farge, 0.32)} strokeWidth={1.1 * ss} strokeLinejoin="round" opacity={0.75} />
    </g>
  );
}

/** Fargene på energistrømmene (samme i scenen, energiflytdiagrammet og forklaringen). */
export const FLOW = {
  /** Varme fra uteluften Q_k. */
  Qk: VIZ.series[0],
  /** Varme til huset Q_v. */
  Qv: VIZ.series[1],
  /** Elektrisk energi W. */
  W: VIZ.series[2],
  /** Varmefaktoren til varmepumpa i grafen. */
  cop: VIZ.series[3],
} as const;
