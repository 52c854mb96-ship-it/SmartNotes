/**
 * Egne deler til «Dekktrykk om vinteren» (scene-kit-et har dem ikke): en garasje i snitt med varmt lys, en liten
 * kompressor, et utetermometer på en stolpe og dekktrykkmåleren (manometeret) i en lupe. Samme stil som kit-et:
 * toninger fra core.tsx, SCENE-farger, kontur og myk skygge. Ingen filtre og ingen bilder.
 */
import { memo, useEffect, useRef, useState } from 'react';
import { Txt, VIZ, fmt } from '../../kit';
import {
  ContactShadow,
  LinearGradient,
  PAINTS,
  RadialGradient,
  SCENE,
  Termometer,
  alpha,
  materialStops,
  mix,
  shade,
  sphereStops,
  tint,
  useStrokeScale,
  useSvgId,
} from '../../kit/scene';

const r1 = (v: number) => Math.round(v * 10) / 10;
const pts = (list: [number, number][]) => list.map(([x, y]) => `${r1(x)},${r1(y)}`).join(' ');

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

/* ---------------------------------------------------------------- Garasjen */

export interface GarasjeGeo {
  /** Ytterkanten av venstre og høyre vegg. */
  x0: number;
  x1: number;
  /** Gulvet (samme høyde som bakken ute). */
  ground: number;
  /** Piksler per meter. */
  px: number;
  /** Nederste kant av figuren (betongen i snittet går hit). */
  bottom: number;
}

/** Målene på garasjen: veggtykkelse, takfot, port, møne og takvinkel. */
export function garasjeMaal(g: GarasjeGeo) {
  const wt = 0.22 * g.px;
  const eave = g.ground - 2.6 * g.px;
  const doorTop = g.ground - 2.15 * g.px;
  const overhang = 0.4 * g.px;
  const half = (g.x1 - g.x0) / 2;
  const slope = 0.42;
  const ridgeX = g.x0 + half;
  const ridgeY = eave - half * slope;
  const roof = 0.3 * g.px * Math.sqrt(1 + slope * slope);
  const snow = 0.2 * g.px;
  return { wt, eave, doorTop, overhang, slope, ridgeX, ridgeY, roof, snow };
}

/**
 * Garasje sett fra siden med frontveggen fjernet (snitt), så vi ser inn: varm bakvegg med panel, takbjelke og lampe,
 * betonggulv, hylle, åpen leddport under taket, rød kledning i snittet og snø på taket. Porten er i høyre vegg, så en
 * bil kan kjøre rett ut mot høyre. Lyset fra porten faller ut på snøen.
 */
export const Garasje = memo(function Garasje(g: GarasjeGeo) {
  const ss = useStrokeScale();
  const id = useSvgId('garasje');
  const m = garasjeMaal(g);
  const { x0, x1, ground, px, bottom } = g;
  const inL = x0 + m.wt;
  const inR = x1 - m.wt;
  const underAt = (x: number) => m.ridgeY + Math.abs(x - m.ridgeX) * m.slope;
  const interior: [number, number][] = [
    [inL, ground],
    [inL, underAt(inL)],
    [m.ridgeX, m.ridgeY],
    [inR, underAt(inR)],
    [inR, ground],
  ];
  const ex0 = x0 - m.overhang;
  const ex1 = x1 + m.overhang;
  const roofUnder: [number, number][] = [
    [ex0, underAt(ex0)],
    [m.ridgeX, m.ridgeY],
    [ex1, underAt(ex1)],
  ];
  const roofTop = roofUnder.map(([x, y]) => [x, y - m.roof] as [number, number]);
  const snowTop = roofTop.map(([x, y]) => [x, y - m.snow] as [number, number]);
  const lampY = m.eave + 0.42 * px;
  const shelfY = ground - 1.85 * px;
  const shelfX0 = inL + 0.95 * px;
  const shelfX1 = inL + 2.35 * px;
  const doorLen = 2.15 * px;
  const panelY = m.eave + 0.12 * px;
  const boardStep = 0.32 * px;
  const boards: number[] = [];
  for (let x = inL + boardStep; x < inR - 2; x += boardStep) boards.push(x);
  const foundation = 0.32 * px;
  const slab = 0.3 * px;
  const [l0, l1, l2] = [snowTop[0]!, snowTop[1]!, snowTop[2]!];
  const [t0, t2] = [roofTop[0]!, roofTop[2]!];
  const lip = m.snow * 0.9;
  const snowPath =
    `M${r1(t0[0] + 2)},${r1(t0[1])} Q${r1(l0[0] - lip * 0.6)},${r1(t0[1] - 1)} ${r1(l0[0] + lip * 0.4)},${r1(l0[1] + 1)} ` +
    `L${r1(l1[0])},${r1(l1[1])} L${r1(l2[0] - lip * 0.4)},${r1(l2[1] + 1)} Q${r1(l2[0] + lip * 0.6)},${r1(t2[1] - 1)} ${r1(t2[0] - 2)},${r1(t2[1])} ` +
    `L${r1(roofTop[1]![0])},${r1(roofTop[1]![1])} Z`;
  return (
    <g aria-hidden>
      <LinearGradient
        id={`${id}-vegg`}
        stops={[
          [0, shade(mix(SCENE.wall, SCENE.warm, 0.22), 0.1)],
          [0.55, mix(SCENE.wall, SCENE.warm, 0.18)],
          [1, shade(mix(SCENE.wall, SCENE.warm, 0.2), 0.12)],
        ]}
      />
      <RadialGradient
        id={`${id}-lys`}
        cx={m.ridgeX}
        cy={lampY + 0.2 * px}
        r={(x1 - x0) * 0.62}
        userSpace
        stops={[
          [0, SCENE.glow, 0.55],
          [0.45, SCENE.glow, 0.16],
          [1, SCENE.glow, 0],
        ]}
      />
      <LinearGradient id={`${id}-tak`} stops={materialStops(mix(SCENE.asphaltDark, SCENE.brick, 0.25), 1.2)} />
      <LinearGradient id={`${id}-bjelke`} stops={materialStops(SCENE.wood, 1.1)} />
      <LinearGradient id={`${id}-betong`} stops={[[0, SCENE.concrete], [1, shade(SCENE.concrete, 0.25)]]} />
      <LinearGradient id={`${id}-sno`} stops={[[0, tint(SCENE.snow, 0.3)], [1, SCENE.snowShade]]} />
      <clipPath id={`${id}-inne`}>
        <polygon points={pts(interior)} />
      </clipPath>

      {/* Lyset fra porten faller ut på snøen */}
      <polygon
        points={pts([
          [x1, ground - 3],
          [x1 + 1.9 * px, ground - 7],
          [x1 + 2.9 * px, ground + 5],
          [x1, ground + 4],
        ])}
        fill={alpha(SCENE.glow, 0.28)}
      />

      {/* Bakveggen med panel, mur nederst og lys fra lampa */}
      <polygon points={pts(interior)} fill={`url(#${id}-vegg)`} />
      <g clipPath={`url(#${id}-inne)`}>
        {boards.map((x) => (
          <line key={x} x1={x} y1={m.ridgeY} x2={x} y2={ground - foundation} stroke={shade(SCENE.wall, 0.3)} strokeWidth={0.9 * ss} opacity={0.35} />
        ))}
        <rect x={inL} y={ground - foundation} width={inR - inL} height={foundation} fill={mix(SCENE.concrete, SCENE.wall, 0.3)} />
        <line x1={inL} y1={ground - foundation} x2={inR} y2={ground - foundation} stroke={shade(SCENE.concrete, 0.3)} strokeWidth={1 * ss} />
        <rect x={x0} y={m.ridgeY - 4} width={x1 - x0} height={ground - m.ridgeY + 4} fill={`url(#${id}-lys)`} />
      </g>

      {/* Hylle med malingsspann og en eske */}
      <g>
        <rect x={shelfX0} y={shelfY} width={shelfX1 - shelfX0} height={0.07 * px} fill={`url(#${id}-bjelke)`} stroke={SCENE.outline} strokeWidth={0.8 * ss} />
        <path
          d={`M${r1(shelfX0 + 0.12 * px)},${r1(shelfY + 0.07 * px)} l${r1(0.18 * px)},${r1(0.22 * px)} M${r1(shelfX1 - 0.12 * px)},${r1(shelfY + 0.07 * px)} l${r1(-0.18 * px)},${r1(0.22 * px)}`}
          stroke={shade(SCENE.metal, 0.2)}
          strokeWidth={1.4 * ss}
        />
        {[
          { x: shelfX0 + 0.18 * px, w: 0.22 * px, h: 0.26 * px, c: PAINTS.blaa },
          { x: shelfX0 + 0.46 * px, w: 0.22 * px, h: 0.26 * px, c: PAINTS.gul },
        ].map((b) => (
          <g key={b.x}>
            <rect x={b.x} y={shelfY - b.h} width={b.w} height={b.h} rx={1.5} fill={b.c} stroke={SCENE.outline} strokeWidth={0.8 * ss} />
            <rect x={b.x} y={shelfY - b.h} width={b.w} height={b.h * 0.18} fill={SCENE.metalLight} stroke={SCENE.outline} strokeWidth={0.6 * ss} />
            <rect x={b.x + b.w * 0.15} y={shelfY - b.h * 0.62} width={b.w * 0.7} height={b.h * 0.3} fill={tint(b.c, 0.65)} />
          </g>
        ))}
        <rect
          x={shelfX0 + 0.8 * px}
          y={shelfY - 0.3 * px}
          width={0.5 * px}
          height={0.3 * px}
          fill={mix(SCENE.wood, SCENE.plastic, 0.35)}
          stroke={SCENE.outline}
          strokeWidth={0.8 * ss}
        />
        <line x1={shelfX0 + 0.8 * px} y1={shelfY - 0.2 * px} x2={shelfX0 + 1.3 * px} y2={shelfY - 0.2 * px} stroke={shade(SCENE.wood, 0.3)} strokeWidth={0.8 * ss} />
      </g>

      {/* Leddporten ligger åpen under taket, med skinne ned til åpningen */}
      <g>
        <line x1={inR - doorLen - 4} y1={panelY - 2} x2={inR} y2={panelY - 2} stroke={shade(SCENE.metal, 0.25)} strokeWidth={1.4 * ss} />
        <rect x={inR - doorLen} y={panelY} width={doorLen} height={0.11 * px} fill={tint(SCENE.metalLight, 0.25)} stroke={SCENE.outline} strokeWidth={0.8 * ss} />
        {[1, 2, 3].map((i) => (
          <line
            key={i}
            x1={inR - doorLen + (i * doorLen) / 4}
            y1={panelY}
            x2={inR - doorLen + (i * doorLen) / 4}
            y2={panelY + 0.11 * px}
            stroke={shade(SCENE.metal, 0.2)}
            strokeWidth={0.8 * ss}
          />
        ))}
      </g>

      {/* Takbjelke og lampe */}
      <rect x={inL} y={m.eave - 0.1 * px} width={inR - inL} height={0.14 * px} fill={`url(#${id}-bjelke)`} stroke={SCENE.outline} strokeWidth={0.8 * ss} />
      <line x1={m.ridgeX} y1={m.eave + 0.04 * px} x2={m.ridgeX} y2={lampY} stroke={SCENE.rubber} strokeWidth={1.1 * ss} />
      <circle cx={m.ridgeX} cy={lampY + 0.05 * px} r={0.08 * px} fill={SCENE.glow} />
      <path
        d={`M${r1(m.ridgeX - 0.22 * px)},${r1(lampY + 0.07 * px)} Q${r1(m.ridgeX)},${r1(lampY - 0.2 * px)} ${r1(m.ridgeX + 0.22 * px)},${r1(lampY + 0.07 * px)} Z`}
        fill={shade(PAINTS.gronn, 0.15)}
        stroke={SCENE.outline}
        strokeWidth={0.8 * ss}
      />

      {/* Veggene i snitt: rød kledning ute, panel inne */}
      {[
        { x: x0, top: underAt(x0) - 1, bot: ground, out: x0 },
        { x: inR, top: underAt(x1) - 1, bot: m.doorTop, out: x1 - 0.05 * px },
      ].map((w) => (
        <g key={w.x}>
          <rect x={w.x} y={w.top} width={m.wt} height={w.bot - w.top} fill={shade(SCENE.wood, 0.28)} stroke={SCENE.outline} strokeWidth={0.9 * ss} />
          <rect x={w.out} y={w.top} width={0.05 * px} height={w.bot - w.top} fill={PAINTS.rod} />
        </g>
      ))}
      {/* Karmen over porten */}
      <rect x={inR - 1} y={m.doorTop - 0.04 * px} width={m.wt + 2} height={0.06 * px} fill={tint(SCENE.wood, 0.2)} stroke={SCENE.outline} strokeWidth={0.6 * ss} />

      {/* Gulvet i snitt: betongplate på grunnmur, jorda under er underlaget utenfor */}
      <rect x={x0} y={ground - 2} width={x1 - x0} height={5} fill={tint(SCENE.concrete, 0.15)} />
      <rect x={x0} y={ground + 3} width={x1 - x0} height={Math.min(slab, Math.max(0, bottom - ground - 3))} fill={`url(#${id}-betong)`} />
      <line x1={x0} y1={ground + 3} x2={x1} y2={ground + 3} stroke={shade(SCENE.concrete, 0.3)} strokeWidth={1 * ss} />
      <line x1={x0} y1={ground + 3 + slab} x2={x1} y2={ground + 3 + slab} stroke={shade(SCENE.concrete, 0.45)} strokeWidth={1 * ss} />

      {/* Taket med snø */}
      <polygon points={pts([...roofUnder, ...[...roofTop].reverse()])} fill={`url(#${id}-tak)`} stroke={SCENE.outline} strokeWidth={1 * ss} strokeLinejoin="round" />
      <polyline points={pts(roofUnder)} fill="none" stroke={tint(SCENE.wood, 0.1)} strokeWidth={2 * ss} />
      <path d={snowPath} fill={`url(#${id}-sno)`} stroke={alpha(SCENE.snowShade, 0.9)} strokeWidth={0.8 * ss} strokeLinejoin="round" />
    </g>
  );
});

/* ---------------------------------------------------------------- Kompressor */

/**
 * Liten kompressor på gulvet: rød trykktank på to hjul med motor, manometer og en kveil med slange. (x, y) er midt
 * på bunnen; `size` er lengden.
 */
export function Kompressor({ x, y, size }: { x: number; y: number; size: number }) {
  const ss = useStrokeScale();
  const id = useSvgId('kompressor');
  const L = size;
  const th = 0.42 * L;
  const wr = 0.11 * L;
  const tankY = y - wr * 1.6 - th;
  return (
    <g aria-hidden>
      <LinearGradient id={`${id}-tank`} stops={materialStops(PAINTS.rod, 1.4)} />
      <LinearGradient id={`${id}-motor`} stops={materialStops(SCENE.metal, 1.2)} />
      <ContactShadow cx={x} cy={y} rx={L * 0.55} />
      {/* Slangekveil bak tanken */}
      <g fill="none" stroke={SCENE.rubber} strokeWidth={1.6 * ss}>
        <ellipse cx={x - 0.32 * L} cy={tankY + th * 0.35} rx={0.14 * L} ry={0.26 * L} />
        <ellipse cx={x - 0.36 * L} cy={tankY + th * 0.42} rx={0.13 * L} ry={0.24 * L} />
      </g>
      <rect x={x - L / 2} y={tankY} width={L} height={th} rx={th / 2} fill={`url(#${id}-tank)`} stroke={SCENE.outline} strokeWidth={0.9 * ss} />
      <rect x={x - 0.18 * L} y={tankY - 0.2 * L} width={0.36 * L} height={0.21 * L} rx={2} fill={`url(#${id}-motor)`} stroke={SCENE.outline} strokeWidth={0.8 * ss} />
      <line x1={x - 0.4 * L} y1={tankY - 0.02 * L} x2={x - 0.4 * L} y2={tankY - 0.3 * L} stroke={SCENE.metalDark} strokeWidth={1.6 * ss} strokeLinecap="round" />
      <line x1={x - 0.4 * L} y1={tankY - 0.3 * L} x2={x - 0.22 * L} y2={tankY - 0.3 * L} stroke={SCENE.metalDark} strokeWidth={1.6 * ss} strokeLinecap="round" />
      <circle cx={x + 0.3 * L} cy={tankY - 0.06 * L} r={0.085 * L} fill={VIZ.surface} stroke={SCENE.outline} strokeWidth={0.8 * ss} />
      <line x1={x + 0.3 * L} y1={tankY - 0.06 * L} x2={x + 0.35 * L} y2={tankY - 0.11 * L} stroke={SCENE.hot} strokeWidth={0.8 * ss} />
      {[x - 0.3 * L, x + 0.3 * L].map((cx) => (
        <g key={cx}>
          <line x1={cx} y1={tankY + th * 0.8} x2={cx} y2={y - wr} stroke={SCENE.metalDark} strokeWidth={1.4 * ss} />
          <circle cx={cx} cy={y - wr} r={wr} fill={SCENE.rubber} stroke={SCENE.outline} strokeWidth={0.8 * ss} />
          <circle cx={cx} cy={y - wr} r={wr * 0.4} fill={SCENE.metalLight} />
        </g>
      ))}
    </g>
  );
}

/* ---------------------------------------------------------------- Utetermometer */

/**
 * Utetermometer på en hvit plate skrudd fast på en trestolpe i snøen. (x, ground) er foten av stolpen; termometeret
 * går fra `bulb` (bunnen av kula) og `h` oppover.
 */
export function Utetermometer({ x, ground, bulb, h, temp }: { x: number; ground: number; bulb: number; h: number; temp: number }) {
  const ss = useStrokeScale();
  const id = useSvgId('utetermometer');
  const pw = Math.max(7, h * 0.06) * 2.4;
  const top = bulb - h - 6;
  return (
    <g aria-hidden>
      <LinearGradient id={`${id}-stolpe`} x2={1} y2={0} stops={materialStops(SCENE.wood, 1.2)} />
      <ContactShadow cx={x} cy={ground} rx={pw * 0.7} />
      <rect x={x - pw * 0.32} y={top - 4} width={pw * 0.64} height={ground - top + 4} fill={`url(#${id}-stolpe)`} stroke={SCENE.outline} strokeWidth={0.9 * ss} />
      <rect x={x - pw / 2} y={top} width={pw} height={bulb - top + 8} rx={3} fill={tint(SCENE.plastic, 0.3)} stroke={SCENE.outline} strokeWidth={0.9 * ss} />
      <Termometer x={x} y={bulb} h={h} temp={temp} min={-30} max={40} skala="ingen" />
      {/* Snø rundt foten */}
      <ellipse cx={x} cy={ground - 1} rx={pw * 0.9} ry={3.5} fill={SCENE.snow} />
    </g>
  );
}

/* ---------------------------------------------------------------- Dekktrykkmåleren i lupe */

/**
 * De to ytre tangentene fra en liten sirkel (det lupa forstørrer) til lupa, så det ser ut som en forstørrelse.
 * Gir to linjestykker [x1, y1, x2, y2].
 */
export function lupeKjegle(a: { x: number; y: number; r: number }, b: { x: number; y: number; r: number }): [number, number, number, number][] {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const d = Math.hypot(dx, dy);
  if (!(d > Math.abs(b.r - a.r))) return [];
  const ux = dx / d;
  const uy = dy / d;
  const s = (b.r - a.r) / d;
  const c = Math.sqrt(Math.max(0, 1 - s * s));
  return [1, -1].map((k) => {
    const mx = ux * s - k * uy * c;
    const my = uy * s + k * ux * c;
    return [a.x - a.r * mx, a.y - a.r * my, b.x - b.r * mx, b.y - b.r * my] as [number, number, number, number];
  });
}

export interface DekkmaalerProps {
  /** Midten og radien på lupa. */
  cx: number;
  cy: number;
  r: number;
  /** Det måleren viser nå, og det dekket ble fylt til (bar manometertrykk). */
  value: number;
  filled: number;
  /** Øverste tall på skalaen (bar). */
  max: number;
  /** Ventilen på hjulet lupa forstørrer. */
  target: { x: number; y: number; r: number };
}

/**
 * Lupe med en analog dekktrykkmåler (manometer) som er satt på ventilen: skala i bar, grønn viser for det den viser
 * nå, en stiplet viser og et merke for det dekket ble fylt til, og en kile mellom dem som viser endringen. Et lite
 * vindu viser tallet.
 */
export function Dekkmaaler({ cx, cy, r, value, filled, max, target }: DekkmaalerProps) {
  const ss = useStrokeScale();
  const id = useSvgId('dekkmaaler');
  const ang = (p: number) => ((-135 + (270 * Math.min(max * 1.02, Math.max(-0.02 * max, p))) / max) * Math.PI) / 180;
  const at = (p: number, rho: number): [number, number] => [cx + rho * Math.sin(ang(p)), cy - rho * Math.cos(ang(p))];
  const face = 0.85 * r;
  const tickOut = 0.78 * r;
  const ticks: { p: number; len: number; w: number }[] = [];
  for (let i = 0; i <= Math.round(max * 10); i++) {
    const p = i / 10;
    const major = i % 10 === 0;
    const half = i % 5 === 0;
    ticks.push({ p, len: major ? 0.13 * r : half ? 0.09 * r : 0.05 * r, w: major ? 2.2 : half ? 1.5 : 0.9 });
  }
  const numbers = Array.from({ length: Math.floor(max) + 1 }, (_, i) => i);
  const [nx, ny] = at(value, 0.72 * r);
  const [gx, gy] = at(filled, 0.7 * r);
  const [mx, my] = at(filled, 0.86 * r);
  const [mxa, mya] = at(filled - 0.06, 0.93 * r);
  const [mxb, myb] = at(filled + 0.06, 0.93 * r);
  // Kilen mellom fylt og nå
  const wedgeR = 0.66 * r;
  const a0 = ang(Math.min(value, filled));
  const a1 = ang(Math.max(value, filled));
  const showWedge = Math.abs(a1 - a0) > 0.01;
  const wedge = showWedge
    ? `M${r1(cx)},${r1(cy)} L${r1(cx + wedgeR * Math.sin(a0))},${r1(cy - wedgeR * Math.cos(a0))} A${r1(wedgeR)},${r1(wedgeR)} 0 0 1 ${r1(
        cx + wedgeR * Math.sin(a1),
      )},${r1(cy - wedgeR * Math.cos(a1))} Z`
    : '';
  const nw = 0.035 * r;
  const perp = ang(value) + Math.PI / 2;
  const needle = pts([
    [cx + nw * Math.sin(perp), cy - nw * Math.cos(perp)],
    [nx, ny],
    [cx - nw * Math.sin(perp), cy + nw * Math.cos(perp)],
    [cx - 0.16 * r * Math.sin(ang(value)), cy + 0.16 * r * Math.cos(ang(value))],
  ]);
  const cone = lupeKjegle(target, { x: cx, y: cy, r });
  const winW = 0.5 * r;
  const winH = 0.2 * r;
  const winY = cy + 0.53 * r;
  return (
    <g>
      <RadialGradient id={`${id}-ramme`} fx={0.35} fy={0.3} stops={sphereStops(SCENE.metal)} />
      <RadialGradient
        id={`${id}-glass`}
        cx={0.35}
        cy={0.3}
        r={0.7}
        stops={[
          [0, SCENE.highlight, 0.32],
          [0.5, SCENE.highlight, 0.06],
          [1, SCENE.highlight, 0],
        ]}
      />
      {/* Forstørrelsen: kjegle fra ventilen til lupa */}
      <g strokeLinecap="round">
        {cone.map(([x1, y1, x2, y2], i) => (
          <g key={i}>
            <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={VIZ.surface} strokeWidth={3.4 * ss} opacity={0.75} />
            <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={VIZ.muted} strokeWidth={1.2 * ss} strokeDasharray={`${4 * ss} ${3 * ss}`} />
          </g>
        ))}
      </g>
      <circle cx={target.x} cy={target.y} r={target.r} fill="none" stroke={VIZ.ink} strokeWidth={1.4 * ss} />

      {/* Lupa: skygge, metallramme og skive */}
      <circle cx={cx + 3} cy={cy + 5} r={r} fill={SCENE.shadow} opacity={0.55} />
      <circle cx={cx} cy={cy} r={r} fill={`url(#${id}-ramme)`} stroke={SCENE.outline} strokeWidth={1.2 * ss} />
      <circle cx={cx} cy={cy} r={face} fill={VIZ.surface} stroke={shade(SCENE.metal, 0.35)} strokeWidth={1.4 * ss} />
      {showWedge && <path d={wedge} fill={alpha(VIZ.series[2], 0.2)} />}
      {ticks.map((t) => {
        const [x1, y1] = at(t.p, tickOut);
        const [x2, y2] = at(t.p, tickOut - t.len);
        return <line key={t.p} x1={x1} y1={y1} x2={x2} y2={y2} stroke={VIZ.ink} strokeWidth={t.w * ss} strokeLinecap="round" />;
      })}
      {numbers.map((n) => {
        const [x, y] = at(n, 0.53 * r);
        return (
          <Txt key={n} x={x} y={y + 0.055 * r} px={0.15 * r} weight={650} halo={false}>
            {n}
          </Txt>
        );
      })}
      <Txt x={cx} y={cy + 0.31 * r} px={0.12 * r} weight={600} muted halo={false}>
        bar
      </Txt>
      {/* Det dekket ble fylt til: merke på kanten og stiplet viser */}
      <polygon points={pts([[mx, my], [mxa, mya], [mxb, myb]])} fill={VIZ.muted} />
      <line x1={cx} y1={cy} x2={gx} y2={gy} stroke={VIZ.muted} strokeWidth={1.6 * ss} strokeDasharray={`${4 * ss} ${3 * ss}`} strokeLinecap="round" />
      {/* Vinduet med tallet */}
      <rect x={cx - winW / 2} y={winY - winH / 2} width={winW} height={winH} rx={winH * 0.2} fill={SCENE.display} stroke={shade(SCENE.metal, 0.4)} strokeWidth={0.8 * ss} />
      <text
        x={cx}
        y={winY + 0.055 * r}
        textAnchor="middle"
        fontSize={r1(0.15 * r)}
        fontWeight={700}
        fill={SCENE.displayText}
        style={{ fontVariantNumeric: 'tabular-nums' }}
      >
        {fmt(value, 2)}
      </text>
      {/* Viseren */}
      <polygon points={needle} fill={VIZ.series[2]} stroke={shade(VIZ.series[2], 0.45)} strokeWidth={0.8 * ss} strokeLinejoin="round" />
      <circle cx={cx} cy={cy} r={0.075 * r} fill={`url(#${id}-ramme)`} stroke={SCENE.outline} strokeWidth={0.8 * ss} />
      {/* Glassrefleks */}
      <circle cx={cx} cy={cy} r={face} fill={`url(#${id}-glass)`} />
    </g>
  );
}
