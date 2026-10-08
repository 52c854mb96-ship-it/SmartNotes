/**
 * Egne deler til «Blanding og termisk likevekt» (scene-kit-et har dem ikke): et kalorimeter av isopor i snitt med
 * lokk, et tynt metallbeger, en metallbit (sylinder) og en målemugge i glass. Samme stil som kit-et: toninger fra
 * core.tsx, SCENE-farger, kontur og myk skygge. Ingen filtre og ingen bilder.
 *
 * Snittet: den fremre halvdelen av karet (og begeret) er skåret bort, så vi ser vannet, begeret og termometrene.
 * Vi ser litt ovenfra, så bunnen og vannflatene er halve ellipser (forholdet E mellom høyde og bredde).
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Txt, useTextScale } from '../../kit';
import {
  ContactShadow,
  LinearGradient,
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
  type GradientStop,
} from '../../kit/scene';
import type { CalorimeterGeo, MetalId } from './blanding-scene';
import { THERMO_LENGTH } from './blanding-scene';

/** Høyde/bredde for ellipsene (vi ser litt ovenfra). */
const E = 0.16;
const r1 = (v: number) => Math.round(v * 10) / 10;

/** Om elementet er smalere enn `limit` piksler (mobil eller smal kolonne). */
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

/** Fargen på metallene (scene-farger, ikke VIZ: det er gjenstander). */
export function metalColor(metal: MetalId): string {
  switch (metal) {
    case 'aluminium':
      return tint(SCENE.metal, 0.28);
    case 'jern':
      return shade(SCENE.metal, 0.34);
    case 'kobber':
      return SCENE.copper;
    case 'bly':
      return mix(shade(SCENE.metal, 0.42), SCENE.waterDeep, 0.18);
  }
}

/** Vannfarge som blir varmere med `warm` (0–1), så begge vannmengdene får samme farge i likevekt. */
function waterStops(warm: number): GradientStop[] {
  const t = 0.3 * Math.min(1, Math.max(0, warm));
  return [
    [0, mix(SCENE.waterLight, SCENE.hot, t)],
    [0.35, mix(SCENE.water, SCENE.hot, t)],
    [1, mix(SCENE.waterDeep, SCENE.hot, t * 0.8)],
  ];
}
export function waterColor(warm: number): string {
  return mix(SCENE.water, SCENE.hot, 0.3 * Math.min(1, Math.max(0, warm)));
}

/** Kuler i isoporen: små ringer spredt med fast frø i et rektangel (figurens enheter). */
function beads(seed: number, x0: number, y0: number, w: number, h: number, r: number): string {
  if (!(w > 2 * r) || !(h > 2 * r)) return '';
  const rnd = sceneRandom(seed);
  const n = Math.min(160, Math.round((w * h) / (r * r * 14)));
  let d = '';
  for (let i = 0; i < n; i++) {
    const cx = x0 + r + rnd() * (w - 2 * r);
    const cy = y0 + r + rnd() * (h - 2 * r);
    const rr = r * (0.7 + 0.5 * rnd());
    d += `M${r1(cx - rr)},${r1(cy)}a${r1(rr)},${r1(rr)} 0 1 0 ${r1(2 * rr)},0a${r1(rr)},${r1(rr)} 0 1 0 ${r1(-2 * rr)},0`;
  }
  return d;
}

/** Halv ellipse (bakre halvdel) over linja y, fra x − r til x + r: fylt form for vannflater og bunner. */
function backHalf(x: number, y: number, r: number): string {
  return `M${r1(x - r)},${r1(y)}A${r1(r)},${r1(E * r)} 0 0 1 ${r1(x + r)},${r1(y)}Z`;
}
/** Vannsøyle i snitt: rektangelet i snittflaten pluss den bakre halvdelen av vannflaten. */
function waterBody(x: number, yTop: number, yBottom: number, r: number): string {
  return `M${r1(x - r)},${r1(yTop)}A${r1(r)},${r1(E * r)} 0 0 1 ${r1(x + r)},${r1(yTop)}V${r1(yBottom)}H${r1(x - r)}Z`;
}

export interface ThermoSpec {
  /** cm fra midten av karet. */
  x: number;
  /** Bunnen av kula, cm over bunnen av karet. */
  lift: number;
  temp: number;
  skala: 'hoyre' | 'venstre';
}

export interface KalorimeterProps {
  /** Midt på bunnen av karet, på benken. */
  x: number;
  y: number;
  /** Piksler per centimeter. */
  k: number;
  geo: CalorimeterGeo;
  /** Vannet i karet (metallforsøket) eller i ringen rundt begeret (vannforsøket): stand i cm og varme 0–1. */
  water: { level: number; warm: number };
  /** Begeret med varmt vann (vannforsøket). */
  cup?: { level: number; warm: number };
  /** Metallbiten (metallforsøket): midten i cm fra midten av karet, diameter og høyde i cm. */
  block?: { x: number; d: number; h: number; metal: MetalId };
  thermometers: ThermoSpec[];
}

/**
 * Kalorimeter av isopor i snitt, med lokk: vannet, begeret eller metallbiten og termometrene inni. Alt følger én
 * skala (k px/cm). Termometrene går gjennom gummiproppene i lokket.
 */
export function Kalorimeter({ x, y, k, geo, water, cup, block, thermometers }: KalorimeterProps) {
  const ss = useStrokeScale();
  const f = useTextScale();
  const id = useSvgId('kalorimeter');
  const Ro = geo.innerR * k;
  const Rw = (geo.innerR + geo.wall) * k;
  const yF = y - geo.base * k;
  const yR = yF - geo.innerH * k;
  const yL = yR - geo.lid * k;
  const foam = SCENE.plastic;
  const yW = yF - Math.max(0, water.level) * k;

  // Begeret: ytre radius Ri, indre Rii (veggen minst 2 px, så den synes), bunnen 0,2 cm
  const Ri = cup && geo.cup ? geo.cup.r * k : 0;
  const Rii = cup && geo.cup ? Ri - Math.max(2.2 * ss, geo.cup.wall * k) : 0;
  const yCF = yF - Math.max(2.2 * ss, 0.2 * k);
  const yCR = cup && geo.cup ? yF - geo.cup.h * k : yF;
  const yW1 = cup ? yCF - Math.max(0, cup.level) * k : yCF;

  const beadR = Math.max(1.6, 0.22 * k);
  const texture = useMemo(
    () =>
      beads(11, x - Rw, yR, Rw - Ro, y - yR, beadR) +
      beads(12, x + Ro, yR, Rw - Ro, y - yR, beadR) +
      beads(13, x - Ro, yF, 2 * Ro, y - yF, beadR) +
      beads(14, x - Rw, yL, 2 * Rw, yR - yL, beadR),
    [x, y, Rw, Ro, yR, yF, yL, beadR],
  );

  // Metallbiten står på bunnen like bak snittflaten (forkanten av bunnen i yF)
  const b = block
    ? (() => {
        const bx = x + block.x * k;
        const rb = (block.d / 2) * k;
        const y0 = yF - E * rb;
        const yT = y0 - block.h * k;
        return { bx, rb, y0, yT };
      })()
    : null;

  const cutFaces = `M${r1(x - Rw)},${r1(yR)}H${r1(x - Ro)}V${r1(yF)}H${r1(x + Ro)}V${r1(yR)}H${r1(x + Rw)}V${r1(y - 4)}Q${r1(x + Rw)},${r1(y)} ${r1(x + Rw - 4)},${r1(y)}H${r1(x - Rw + 4)}Q${r1(x - Rw)},${r1(y)} ${r1(x - Rw)},${r1(y - 4)}Z`;
  const lidSlab = `M${r1(x - Rw)},${r1(yL)}H${r1(x + Rw)}V${r1(yR)}H${r1(x - Rw)}Z`;

  const veil = (x0: number, x1: number, top: number, bottom: number, warm: number, key: string) =>
    bottom - top > 0.5 ? <rect key={key} x={r1(x0)} y={r1(top)} width={r1(x1 - x0)} height={r1(bottom - top)} fill={alpha(waterColor(warm), 0.24)} /> : null;
  const surfaceLine = (x0: number, x1: number, yy: number, warm: number, key: string) => (
    <path key={key} d={`M${r1(x0)},${r1(yy)}H${r1(x1)}`} stroke={tint(waterColor(warm), 0.45)} strokeWidth={1.4 * ss} />
  );

  const H = THERMO_LENGTH * k;
  const tw = Math.max(7, H * 0.06);

  return (
    <g>
      <ContactShadow cx={x} cy={y} rx={Rw * 1.04} ry={E * Rw * 0.9} />
      <LinearGradient id={`${id}-bak`} x2={1} y2={0} stops={[[0, shade(foam, 0.3)], [0.55, shade(foam, 0.13)], [1, shade(foam, 0.04)]]} />
      <LinearGradient id={`${id}-snitt`} stops={materialStops(foam, 0.5)} />
      <LinearGradient id={`${id}-vann`} stops={waterStops(water.warm)} />
      {cup && <LinearGradient id={`${id}-vann1`} stops={waterStops(cup.warm)} />}
      <LinearGradient id={`${id}-metall`} x2={1} y2={0} stops={[[0, shade(SCENE.metal, 0.42)], [0.55, shade(SCENE.metal, 0.18)], [1, tint(SCENE.metal, 0.12)]]} />
      {block && (
        <LinearGradient
          id={`${id}-bit`}
          x2={1}
          y2={0}
          stops={[
            [0, shade(metalColor(block.metal), 0.25)],
            [0.18, tint(metalColor(block.metal), 0.35)],
            [0.42, metalColor(block.metal)],
            [1, shade(metalColor(block.metal), 0.35)],
          ]}
        />
      )}

      {/* Innsiden av karet: bakveggen og bunnen */}
      <rect x={r1(x - Ro)} y={r1(yR - E * Ro)} width={r1(2 * Ro)} height={r1(yF - yR + E * Ro)} fill={`url(#${id}-bak)`} />
      <path d={backHalf(x, yF, Ro)} fill={shade(foam, 0.08)} />

      {/* Vannet i karet (eller i ringen rundt begeret) */}
      {water.level > 0.01 && (
        <>
          <path d={waterBody(x, yW, yF, Ro)} fill={`url(#${id}-vann)`} opacity={0.95} />
          <path d={backHalf(x, yW, Ro)} fill={tint(waterColor(water.warm), 0.3)} opacity={0.55} />
        </>
      )}

      {/* Metallbegeret med varmt vann */}
      {cup && geo.cup && (
        <g>
          <path d={`M${r1(x - Rii)},${r1(yCR)}A${r1(Rii)},${r1(E * Rii)} 0 0 1 ${r1(x + Rii)},${r1(yCR)}V${r1(yCF)}H${r1(x - Rii)}Z`} fill={`url(#${id}-metall)`} />
          <path d={backHalf(x, yCF, Rii)} fill={tint(SCENE.metal, 0.12)} />
          {cup.level > 0.01 && (
            <>
              <path d={waterBody(x, yW1, yCF, Rii)} fill={`url(#${id}-vann1)`} opacity={0.95} />
              <path d={backHalf(x, yW1, Rii)} fill={tint(waterColor(cup.warm), 0.3)} opacity={0.55} />
            </>
          )}
          {/* Snittflatene i begeret: to tynne vegger og bunnen */}
          <path
            d={`M${r1(x - Ri)},${r1(yCR)}H${r1(x - Rii)}V${r1(yCF)}H${r1(x + Rii)}V${r1(yCR)}H${r1(x + Ri)}V${r1(yF)}H${r1(x - Ri)}Z`}
            fill={tint(SCENE.metal, 0.4)}
            stroke={SCENE.outline}
            strokeWidth={0.8 * ss}
            strokeLinejoin="round"
          />
          <path d={`M${r1(x - Ri)},${r1(yCR)}A${r1(Ri)},${r1(E * Ri)} 0 0 1 ${r1(x + Ri)},${r1(yCR)}`} fill="none" stroke={tint(SCENE.metal, 0.35)} strokeWidth={2.2 * ss} />
          <path d={`M${r1(x - Ri)},${r1(yCR)}A${r1(Ri)},${r1(E * Ri)} 0 0 1 ${r1(x + Ri)},${r1(yCR)}`} fill="none" stroke={SCENE.outline} strokeWidth={0.8 * ss} />
        </g>
      )}

      {/* Metallbiten på bunnen */}
      {block && b && (
        <g>
          <path
            d={`M${r1(b.bx - b.rb)},${r1(b.yT)}V${r1(b.y0)}A${r1(b.rb)},${r1(E * b.rb)} 0 0 0 ${r1(b.bx + b.rb)},${r1(b.y0)}V${r1(b.yT)}Z`}
            fill={`url(#${id}-bit)`}
            stroke={SCENE.outline}
            strokeWidth={0.9 * ss}
          />
          <ellipse cx={r1(b.bx)} cy={r1(b.yT)} rx={r1(b.rb)} ry={r1(E * b.rb)} fill={tint(metalColor(block.metal), 0.3)} stroke={SCENE.outline} strokeWidth={0.9 * ss} />
          <path d={`M${r1(b.bx - b.rb * 0.62)},${r1(b.yT + E * b.rb + 2)}V${r1(b.y0 - 2)}`} stroke={SCENE.highlight} strokeWidth={Math.max(1.2, b.rb * 0.12)} strokeLinecap="round" />
          {/* Liten krok på toppen (biten ble senket ned med den) */}
          <path
            d={`M${r1(b.bx - b.rb * 0.22)},${r1(b.yT)}V${r1(b.yT - b.rb * 0.42)}A${r1(b.rb * 0.22)},${r1(b.rb * 0.22)} 0 0 1 ${r1(b.bx + b.rb * 0.22)},${r1(b.yT - b.rb * 0.42)}V${r1(b.yT)}`}
            fill="none"
            stroke={shade(metalColor(block.metal), 0.15)}
            strokeWidth={Math.max(1.4, b.rb * 0.1) * ss}
            strokeLinecap="round"
          />
        </g>
      )}

      {/* Snittflatene i isoporen og lokket */}
      <path d={cutFaces} fill={`url(#${id}-snitt)`} />
      <path d={backHalf(x, yL, Rw)} fill={tint(foam, 0.1)} stroke={SCENE.outline} strokeWidth={0.8 * ss} />
      <path d={lidSlab} fill={`url(#${id}-snitt)`} />
      <path d={texture} fill="none" stroke={shade(foam, 0.16)} strokeWidth={0.7 * ss} opacity={0.75} />
      <path d={cutFaces} fill="none" stroke={SCENE.outline} strokeWidth={1 * ss} strokeLinejoin="round" />
      <path d={lidSlab} fill="none" stroke={SCENE.outline} strokeWidth={1 * ss} strokeLinejoin="round" />
      <path d={`M${r1(x - Rw + 3)},${r1(yL + 2.5 * ss)}H${r1(x + Rw - 3)}`} stroke={SCENE.highlight} strokeWidth={1.6 * ss} strokeLinecap="round" />
      {/* «Isopor» langs den venstre snittflaten, som i en lærebokfigur */}
      <g transform={`rotate(-90 ${r1(x - (Rw + Ro) / 2)} ${r1((yR + y) / 2)})`}>
        <Txt x={r1(x - (Rw + Ro) / 2)} y={r1((yR + y) / 2 + 5.5 * f)} size={0.72} weight={600} muted>
          Isopor
        </Txt>
      </g>

      {/* Gummipropper i lokket og termometrene */}
      {thermometers.map((t, i) => (
        <rect
          key={`p${i}`}
          x={r1(x + t.x * k - tw * 0.95)}
          y={r1(yL - 2 * ss)}
          width={r1(tw * 1.9)}
          height={r1(yR - yL + 2 * ss)}
          rx={r1(tw * 0.3)}
          fill={SCENE.rubber}
          stroke={SCENE.outline}
          strokeWidth={0.8 * ss}
        />
      ))}
      {thermometers.map((t, i) => (
        <Termometer key={`t${i}`} x={x + t.x * k} y={yF - t.lift * k} h={H} temp={t.temp} min={0} max={100} skala={t.skala} />
      ))}

      {/* Vannet foran det som står i det (litt blått over kula og metallbiten), og kanten av vannflata */}
      {cup ? (
        <>
          {veil(x - Rii, x + Rii, yW1, yCF, cup.warm, 'v1')}
          {veil(x - Ro, x - Ri, yW, yF, water.warm, 'v2')}
          {veil(x + Ri, x + Ro, yW, yF, water.warm, 'v3')}
          {cup.level > 0.01 && surfaceLine(x - Rii, x + Rii, yW1, cup.warm, 's1')}
          {water.level > 0.01 && surfaceLine(x - Ro, x - Ri, yW, water.warm, 's2')}
          {water.level > 0.01 && surfaceLine(x + Ri, x + Ro, yW, water.warm, 's3')}
        </>
      ) : (
        <>
          {veil(x - Ro, x + Ro, yW, yF, water.warm, 'v1')}
          {water.level > 0.01 && surfaceLine(x - Ro, x + Ro, yW, water.warm, 's1')}
        </>
      )}
    </g>
  );
}

/**
 * Målemugge i glass med kaldt vann: tut til venstre, hank til høyre og målestreker. (x, y) er midt på bunnen,
 * `size` er høyden. `vann` er vannstanden (0–1).
 */
export function Mugge({ x, y, size, vann = 0.55 }: { x: number; y: number; size: number; vann?: number }) {
  const ss = useStrokeScale();
  const id = useSvgId('mugge');
  const s = size;
  const wb = 0.27 * s;
  const wt = 0.31 * s;
  const top = y - s;
  const body = `M${r1(x - wt)},${r1(top)}L${r1(x - wb)},${r1(y - 0.05 * s)}Q${r1(x - wb + 0.005 * s)},${r1(y)} ${r1(x - wb + 0.05 * s)},${r1(y)}H${r1(x + wb - 0.05 * s)}Q${r1(x + wb - 0.005 * s)},${r1(y)} ${r1(x + wb)},${r1(y - 0.05 * s)}L${r1(x + wt)},${r1(top)}`;
  const lvl = Math.min(0.92, Math.max(0, vann));
  const yw = y - 0.04 * s - lvl * 0.9 * s;
  const at = (yy: number) => wb + ((wt - wb) * (y - yy)) / s;
  const inset = 0.022 * s;
  const ww = at(yw) - inset;
  const water = `M${r1(x - ww)},${r1(yw)}L${r1(x - wb + inset)},${r1(y - 0.05 * s)}Q${r1(x - wb + inset)},${r1(y - inset)} ${r1(x - wb + 0.06 * s)},${r1(y - inset)}H${r1(x + wb - 0.06 * s)}Q${r1(x + wb - inset)},${r1(y - inset)} ${r1(x + wb - inset)},${r1(y - 0.05 * s)}L${r1(x + ww)},${r1(yw)}Z`;
  const marks = [0.25, 0.5, 0.75].map((f) => {
    const yy = y - 0.04 * s - f * 0.9 * s;
    const xl = x - at(yy) + 0.05 * s;
    return `M${r1(xl)},${r1(yy)}h${r1(f === 0.5 ? 0.13 * s : 0.08 * s)}`;
  });
  return (
    <g>
      <ContactShadow cx={x} cy={y} rx={wb * 1.25} ry={0.04 * s} />
      <LinearGradient id={`${id}-g`} x2={1} y2={0} stops={[[0, SCENE.glassEdge, 0.55], [0.22, SCENE.glass, 0.2], [0.7, SCENE.glass, 0.3], [1, SCENE.glassEdge, 0.65]]} />
      <LinearGradient id={`${id}-w`} stops={waterStops(0)} />
      {/* Hanken */}
      <path
        d={`M${r1(x + wt - 0.02 * s)},${r1(top + 0.14 * s)}C${r1(x + wt + 0.2 * s)},${r1(top + 0.1 * s)} ${r1(x + wt + 0.2 * s)},${r1(top + 0.62 * s)} ${r1(x + wb + 0.04 * s)},${r1(top + 0.72 * s)}`}
        fill="none"
        stroke={SCENE.outline}
        strokeWidth={r1(0.075 * s + 2 * ss)}
        strokeLinecap="round"
      />
      <path
        d={`M${r1(x + wt - 0.02 * s)},${r1(top + 0.14 * s)}C${r1(x + wt + 0.2 * s)},${r1(top + 0.1 * s)} ${r1(x + wt + 0.2 * s)},${r1(top + 0.62 * s)} ${r1(x + wb + 0.04 * s)},${r1(top + 0.72 * s)}`}
        fill="none"
        stroke={tint(SCENE.glass, 0.25)}
        strokeWidth={r1(0.075 * s)}
        strokeLinecap="round"
      />
      <path d={water} fill={`url(#${id}-w)`} opacity={0.9} />
      <ellipse cx={r1(x)} cy={r1(yw)} rx={r1(ww)} ry={r1(E * ww)} fill={tint(SCENE.waterLight, 0.2)} opacity={0.7} />
      <path d={`${body}Z`} fill={`url(#${id}-g)`} />
      <path d={marks.join('')} stroke={SCENE.outline} strokeWidth={1 * ss} opacity={0.7} />
      {/* Tuten og kanten */}
      <path
        d={`M${r1(x - wt + 0.03 * s)},${r1(top)}Q${r1(x - wt - 0.06 * s)},${r1(top - 0.02 * s)} ${r1(x - wt - 0.09 * s)},${r1(top - 0.045 * s)}Q${r1(x - wt - 0.04 * s)},${r1(top + 0.03 * s)} ${r1(x - wt + 0.005 * s)},${r1(top + 0.06 * s)}`}
        fill={alpha(SCENE.glass, 0.4)}
        stroke={SCENE.outline}
        strokeWidth={0.9 * ss}
        strokeLinejoin="round"
      />
      <ellipse cx={r1(x)} cy={r1(top)} rx={r1(wt)} ry={r1(E * wt)} fill={alpha(SCENE.glass, 0.25)} stroke={SCENE.outline} strokeWidth={0.9 * ss} />
      <path d={body} fill="none" stroke={SCENE.outline} strokeWidth={1 * ss} strokeLinejoin="round" />
      <path d={`M${r1(x - wt + 0.06 * s)},${r1(top + 0.1 * s)}L${r1(x - wb + 0.06 * s)},${r1(y - 0.1 * s)}`} stroke={SCENE.highlight} strokeWidth={r1(0.025 * s)} strokeLinecap="round" />
    </g>
  );
}
