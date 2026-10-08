/**
 * Egne deler til eksempeloppgaven «Hvilket metall er det?» (k5-eks-kalorimeter). Scene-kit-et har ikke et
 * kalorimeter eller en metallbit, så de lages her i samme stil: toninger fra core.tsx, SCENE-farger, kontur og myk
 * skygge, ingen filtre og ingen bilder.
 *
 * - Kalorimeter: isoporbeger i snitt med lokk (den fremre halvdelen er skåret bort), vann, et hull i lokket for
 *   tråden og en gummipropp for termometeret.
 * - Metallbit: sylinder i metall med en liten øyekrok på toppen der tråden er festet.
 * - Tverrpinne: en blyant som ligger over kanten på kasserollen, med tråden knyttet rundt.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Txt, useTextScale } from '../../kit';
import {
  ContactShadow,
  LinearGradient,
  PAINTS,
  SCENE,
  Termometer,
  alpha,
  materialStops,
  mix,
  sceneRandom,
  shade,
  tint,
  useStrokeScale,
  useSvgId,
} from '../../kit/scene';
import type { MetalKey } from './model-eks-kalorimeter';

/** Høyde/bredde for ellipsene (vi ser litt ovenfra). */
const E = 0.16;
const r1 = (v: number) => Math.round(v * 10) / 10;

/** Om elementet er smalere enn `limit` piksler (mobil eller smal kolonne). */
export function useNarrowBox<T extends HTMLElement>(limit = 560) {
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

/** Fargen på metallene (scene-farger: det er gjenstander, ikke fysiske størrelser). */
export function metalPaint(metal: MetalKey): string {
  switch (metal) {
    case 'aluminium':
      return tint(SCENE.metal, 0.3);
    case 'titan':
      return mix(SCENE.metal, PAINTS.graa, 0.4);
    case 'jern':
      return shade(SCENE.metal, 0.36);
    case 'kobber':
      return SCENE.copper;
    case 'solv':
      return tint(SCENE.metal, 0.45);
    case 'bly':
      return mix(shade(SCENE.metal, 0.42), SCENE.waterDeep, 0.2);
  }
}

/** Kuler i isoporen: små ringer spredt med fast frø i et rektangel. */
function beads(seed: number, x0: number, y0: number, w: number, h: number, r: number): string {
  if (!(w > 2 * r) || !(h > 2 * r)) return '';
  const rnd = sceneRandom(seed);
  const n = Math.min(140, Math.round((w * h) / (r * r * 14)));
  let d = '';
  for (let i = 0; i < n; i++) {
    const cx = x0 + r + rnd() * (w - 2 * r);
    const cy = y0 + r + rnd() * (h - 2 * r);
    const rr = r * (0.7 + 0.5 * rnd());
    d += `M${r1(cx - rr)},${r1(cy)}a${r1(rr)},${r1(rr)} 0 1 0 ${r1(2 * rr)},0a${r1(rr)},${r1(rr)} 0 1 0 ${r1(-2 * rr)},0`;
  }
  return d;
}

/** Bakre halvdel av en ellipse over linja y (vannflate, bunn). */
function backHalf(x: number, y: number, r: number): string {
  return `M${r1(x - r)},${r1(y)}A${r1(r)},${r1(E * r)} 0 0 1 ${r1(x + r)},${r1(y)}Z`;
}

/* ------------------------------------------------------------------ Metallbit */

export interface MetallbitProps {
  /** Midt på forkanten av bunnen (ankerpunktet). */
  x: number;
  y: number;
  /** Diameter og høyde i figurens enheter. */
  d: number;
  h: number;
  metal: MetalKey;
  /** 0–1: biten er varm (svak rødlig glød i metallet, som etter kokingen). */
  warm?: number;
}

/** Sylinder i metall med en liten øyekrok på toppen (der tråden er festet). Toppen av kroken er i (x, y − h − 0,22 d). */
export function Metallbit({ x, y, d, h, metal, warm = 0 }: MetallbitProps) {
  const ss = useStrokeScale();
  const id = useSvgId('metallbit');
  const c = mix(metalPaint(metal), SCENE.hot, 0.18 * Math.min(1, Math.max(0, warm)));
  const rb = d / 2;
  const y0 = y - E * rb;
  const yT = y0 - h;
  const eye = Math.max(2.4, rb * 0.16);
  return (
    <g>
      <LinearGradient
        id={id}
        x2={1}
        y2={0}
        stops={[
          [0, shade(c, 0.28)],
          [0.18, tint(c, 0.32)],
          [0.42, c],
          [1, shade(c, 0.38)],
        ]}
      />
      <path
        d={`M${r1(x - rb)},${r1(yT)}V${r1(y0)}A${r1(rb)},${r1(E * rb)} 0 0 0 ${r1(x + rb)},${r1(y0)}V${r1(yT)}Z`}
        fill={`url(#${id})`}
        stroke={SCENE.outline}
        strokeWidth={0.9 * ss}
      />
      <ellipse cx={r1(x)} cy={r1(yT)} rx={r1(rb)} ry={r1(E * rb)} fill={tint(c, 0.28)} stroke={SCENE.outline} strokeWidth={0.9 * ss} />
      <path d={`M${r1(x - rb * 0.62)},${r1(yT + E * rb + 2)}V${r1(y0 - 2)}`} stroke={SCENE.highlight} strokeWidth={Math.max(1.2, rb * 0.1)} strokeLinecap="round" opacity={0.8} />
      {/* Øyekroken */}
      <circle cx={r1(x)} cy={r1(yT - eye * 1.1)} r={r1(eye)} fill="none" stroke={shade(c, 0.2)} strokeWidth={Math.max(1.4, eye * 0.55) * ss} />
    </g>
  );
}

/** Toppen av øyekroken på en metallbit (der tråden er festet). */
export function metallbitTop(y: number, d: number, h: number): number {
  const rb = d / 2;
  const eye = Math.max(2.4, rb * 0.16);
  return y - E * rb - h - eye * 2.1;
}

/**
 * Tynn tråd gjennom punktene (hvit bomullstråd med mørk kant, så den synes på lys og mørk bunn). Med `slakk` buer
 * hvert stykke litt nedover, som en tråd som ligger løst.
 */
export function Traad({ points, slakk = 0 }: { points: [number, number][]; slakk?: number }) {
  const ss = useStrokeScale();
  if (points.length < 2) return null;
  let d = `M${r1(points[0]![0])},${r1(points[0]![1])}`;
  for (let i = 1; i < points.length; i++) {
    const [ax, ay] = points[i - 1]!;
    const [bx, by] = points[i]!;
    d += slakk > 0 ? `Q${r1((ax + bx) / 2)},${r1((ay + by) / 2 + slakk)} ${r1(bx)},${r1(by)}` : `L${r1(bx)},${r1(by)}`;
  }
  return (
    <g fill="none" strokeLinecap="round" strokeLinejoin="round">
      <path d={d} stroke={SCENE.outline} strokeWidth={2.4 * ss} opacity={0.75} />
      <path d={d} stroke={PAINTS.hvit} strokeWidth={1.2 * ss} />
    </g>
  );
}

/* ------------------------------------------------------------------ Blyant over kasserollen */

/** Blyant som ligger over kanten på kasserollen, sett fra siden. (x, y) er midten; `len` er lengden. */
export function Blyant({ x, y, len }: { x: number; y: number; len: number }) {
  const ss = useStrokeScale();
  const id = useSvgId('blyant');
  const t = Math.max(5, len * 0.045);
  const x0 = x - len / 2;
  const x1 = x + len / 2;
  const tip = t * 2.2;
  return (
    <g>
      <LinearGradient id={id} stops={materialStops(PAINTS.gul, 1.4)} />
      <path d={`M${r1(x0)},${r1(y - t / 2)}H${r1(x1 - tip)}V${r1(y + t / 2)}H${r1(x0)}Z`} fill={`url(#${id})`} stroke={SCENE.outline} strokeWidth={0.8 * ss} />
      <path d={`M${r1(x1 - tip)},${r1(y - t / 2)}L${r1(x1)},${r1(y)}L${r1(x1 - tip)},${r1(y + t / 2)}Z`} fill={SCENE.woodLight} stroke={SCENE.outline} strokeWidth={0.8 * ss} strokeLinejoin="round" />
      <path d={`M${r1(x1 - tip * 0.3)},${r1(y - t * 0.15)}L${r1(x1)},${r1(y)}L${r1(x1 - tip * 0.3)},${r1(y + t * 0.15)}Z`} fill={SCENE.outline} />
      <rect x={r1(x0 - t * 0.9)} y={r1(y - t / 2)} width={r1(t * 0.9)} height={r1(t)} rx={r1(t * 0.3)} fill={PAINTS.rod} stroke={SCENE.outline} strokeWidth={0.8 * ss} />
      <path d={`M${r1(x0 + 2)},${r1(y - t * 0.22)}H${r1(x1 - tip - 2)}`} stroke={SCENE.highlight} strokeWidth={1 * ss} opacity={0.7} />
    </g>
  );
}

/* ------------------------------------------------------------------ Kalorimeter */

export interface CalGeo {
  /** Innvendig radius og høyde, og tykkelsen på veggen, bunnen og lokket (cm). */
  innerR: number;
  innerH: number;
  wall: number;
  base: number;
  lid: number;
}

/** Nøkkelpunkter i kalorimeteret (figurens enheter) for et kalorimeter med bunnen i y: radiene, bunnen, kanten og lokket. */
export function calPoints(y: number, k: number, geo: CalGeo) {
  const Ro = geo.innerR * k;
  const Rw = (geo.innerR + geo.wall) * k;
  const yF = y - geo.base * k;
  const yR = yF - geo.innerH * k;
  const yL = yR - geo.lid * k;
  return { Ro, Rw, yF, yR, yL };
}

export interface KalorimeterProps {
  /** Midt på bunnen, på benken. */
  x: number;
  y: number;
  /** Piksler per centimeter. */
  k: number;
  geo: CalGeo;
  /** Vannstanden (cm over bunnen) og hvor varmt vannet er (0–1, gir en svak varm tone). */
  level: number;
  warm?: number;
  /** Metallbiten på bunnen: midten i cm fra midten av karet, diameter og høyde i cm. */
  block?: { x: number; d: number; h: number; metal: MetalKey };
  /** Hullet i lokket for tråden (cm fra midten). */
  holeX: number;
  /** Tråden fra metallbiten opp gjennom hullet til denne høyden over lokket (figurens enheter). Uten: ingen tråd. */
  threadTop?: number;
  /** Termometeret: cm fra midten, lengde i cm, temperatur og skala. */
  thermo: { x: number; length: number; temp: number; min: number; max: number };
}

/**
 * Kalorimeter av isopor i snitt, med lokk: vannet, metallbiten og termometeret inni. Alt følger én skala (k px/cm).
 * Termometeret går gjennom en gummipropp i lokket, og tråden til metallbiten gjennom et lite hull.
 */
export function Kalorimeter({ x, y, k, geo, level, warm = 0, block, holeX, threadTop, thermo }: KalorimeterProps) {
  const ss = useStrokeScale();
  const f = useTextScale();
  const id = useSvgId('kal');
  const { Ro, Rw, yF, yR, yL } = calPoints(y, k, geo);
  const foam = SCENE.plastic;
  const yW = yF - Math.max(0, level) * k;
  const wt = 0.3 * Math.min(1, Math.max(0, warm));
  const water = mix(SCENE.water, SCENE.hot, wt);
  const beadR = Math.max(1.6, 0.2 * k);
  const texture = useMemo(
    () =>
      beads(21, x - Rw, yR, Rw - Ro, y - yR, beadR) +
      beads(22, x + Ro, yR, Rw - Ro, y - yR, beadR) +
      beads(23, x - Ro, yF, 2 * Ro, y - yF, beadR) +
      beads(24, x - Rw, yL, 2 * Rw, yR - yL, beadR),
    [x, y, Rw, Ro, yR, yF, yL, beadR],
  );
  const cutFaces = `M${r1(x - Rw)},${r1(yR)}H${r1(x - Ro)}V${r1(yF)}H${r1(x + Ro)}V${r1(yR)}H${r1(x + Rw)}V${r1(y - 4)}Q${r1(x + Rw)},${r1(y)} ${r1(x + Rw - 4)},${r1(y)}H${r1(x - Rw + 4)}Q${r1(x - Rw)},${r1(y)} ${r1(x - Rw)},${r1(y - 4)}Z`;
  const lidSlab = `M${r1(x - Rw)},${r1(yL)}H${r1(x + Rw)}V${r1(yR)}H${r1(x - Rw)}Z`;
  const H = thermo.length * k;
  const tw = Math.max(7, H * 0.06);
  const tx = x + thermo.x * k;
  const hx = x + holeX * k;
  const hole = Math.max(2.5, 0.3 * k);

  return (
    <g>
      <ContactShadow cx={x} cy={y} rx={Rw * 1.05} ry={E * Rw * 0.9} />
      <LinearGradient id={`${id}-bak`} x2={1} y2={0} stops={[[0, shade(foam, 0.3)], [0.55, shade(foam, 0.13)], [1, shade(foam, 0.04)]]} />
      <LinearGradient id={`${id}-snitt`} stops={materialStops(foam, 0.5)} />
      <LinearGradient
        id={`${id}-vann`}
        stops={[
          [0, mix(SCENE.waterLight, SCENE.hot, wt)],
          [0.35, water],
          [1, mix(SCENE.waterDeep, SCENE.hot, wt * 0.8)],
        ]}
      />

      {/* Innsiden: bakveggen og bunnen */}
      <rect x={r1(x - Ro)} y={r1(yR - E * Ro)} width={r1(2 * Ro)} height={r1(yF - yR + E * Ro)} fill={`url(#${id}-bak)`} />
      <path d={backHalf(x, yF, Ro)} fill={shade(foam, 0.08)} />

      {/* Vannet */}
      {level > 0.01 && (
        <>
          <path
            d={`M${r1(x - Ro)},${r1(yW)}A${r1(Ro)},${r1(E * Ro)} 0 0 1 ${r1(x + Ro)},${r1(yW)}V${r1(yF)}H${r1(x - Ro)}Z`}
            fill={`url(#${id}-vann)`}
            opacity={0.95}
          />
          <path d={backHalf(x, yW, Ro)} fill={tint(water, 0.3)} opacity={0.55} />
        </>
      )}

      {/* Metallbiten på bunnen, rett bak snittflaten */}
      {block && <Metallbit x={x + block.x * k} y={yF} d={block.d * k} h={block.h * k} metal={block.metal} />}
      {block && threadTop !== undefined && (
        <Traad points={[[x + block.x * k, metallbitTop(yF, block.d * k, block.h * k)], [hx, yR]]} />
      )}

      {/* Snittflatene i isoporen og lokket */}
      <path d={cutFaces} fill={`url(#${id}-snitt)`} />
      <path d={backHalf(x, yL, Rw)} fill={tint(foam, 0.1)} stroke={SCENE.outline} strokeWidth={0.8 * ss} />
      <path d={lidSlab} fill={`url(#${id}-snitt)`} />
      <path d={texture} fill="none" stroke={shade(foam, 0.16)} strokeWidth={0.7 * ss} opacity={0.75} />
      {/* Hullet for tråden */}
      <rect x={r1(hx - hole / 2)} y={r1(yL)} width={r1(hole)} height={r1(yR - yL)} fill={shade(foam, 0.45)} />
      <path d={cutFaces} fill="none" stroke={SCENE.outline} strokeWidth={1 * ss} strokeLinejoin="round" />
      <path d={lidSlab} fill="none" stroke={SCENE.outline} strokeWidth={1 * ss} strokeLinejoin="round" />
      <path d={`M${r1(x - Rw + 3)},${r1(yL + 2.5 * ss)}H${r1(x + Rw - 3)}`} stroke={SCENE.highlight} strokeWidth={1.6 * ss} strokeLinecap="round" />
      {/* Enden av tråden stikker opp av hullet og ligger løst bortover lokket */}
      {threadTop !== undefined && (
        <Traad points={[[hx, yR], [hx, threadTop], [hx - 0.35 * Rw, yL - 1.5 * ss], [hx - 0.7 * Rw, yL - 1 * ss]]} slakk={1.5} />
      )}
      {/* «Isopor» langs den venstre snittflaten, som i en lærebokfigur */}
      <g transform={`rotate(-90 ${r1(x - (Rw + Ro) / 2)} ${r1((yR + y) / 2)})`}>
        <Txt x={r1(x - (Rw + Ro) / 2)} y={r1((yR + y) / 2 + 5 * f)} size={0.68} weight={600} muted>
          Isopor
        </Txt>
      </g>

      {/* Gummiproppen og termometeret */}
      <rect
        x={r1(tx - tw * 0.95)}
        y={r1(yL - 2 * ss)}
        width={r1(tw * 1.9)}
        height={r1(yR - yL + 2 * ss)}
        rx={r1(tw * 0.3)}
        fill={SCENE.rubber}
        stroke={SCENE.outline}
        strokeWidth={0.8 * ss}
      />
      <Termometer x={tx} y={yF - 0.4 * k} h={H} temp={thermo.temp} min={thermo.min} max={thermo.max} />

      {/* Vannet foran det som står i det (en tynn, blå hinne) og kanten av vannflata */}
      {level > 0.01 && (
        <>
          <rect x={r1(x - Ro)} y={r1(yW)} width={r1(2 * Ro)} height={r1(yF - yW)} fill={alpha(water, 0.22)} />
          <path d={`M${r1(x - Ro)},${r1(yW)}H${r1(x + Ro)}`} stroke={tint(water, 0.45)} strokeWidth={1.4 * ss} />
        </>
      )}
    </g>
  );
}
