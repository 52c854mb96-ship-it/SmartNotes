/**
 * Egne deler til eksempeloppgaven «Luft i en sylinder med stempel» (k5-eks-gass). Scene-kit-et har ikke et vannbad,
 * en glassylinder med stempel eller et manometer, så de lages her i samme stil: toninger fra core.tsx, SCENE-farger,
 * kontur og myk skygge, ingen filtre og ingen bilder.
 *
 * - Vannbad: begerglass sett litt ovenfra. Bakveggen tegnes før sylinderen, vannet og forveggen etter, så sylinderen
 *   står i vannet. Vannflaten har et hull der sylinderen går gjennom den.
 * - Glassylinder med bunnplate i stål, luft, partikler med fartshaler, stempel med stang og en splint gjennom veggen.
 * - Manometer på stativ, digitalt termometer, slange og ledning.
 * - Bølgete pil for varme (Q) og damp over vannet.
 *
 * Runde flater er sett litt ovenfra: ellipser med høyde/bredde E. Front-buene går gjennom den nederste delen av
 * ellipsen.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Txt, VIZ, useTextScale } from '../../kit';
import {
  ContactShadow,
  LinearGradient,
  PAINTS,
  RadialGradient,
  SCENE,
  alpha,
  materialStops,
  mix,
  sceneRandom,
  shade,
  sphereStops,
  tint,
  useStrokeScale,
  useSvgId,
  type GradientStop,
} from '../../kit/scene';

/** Høyde/bredde for ellipsene (vi ser litt ovenfra). */
export const E = 0.14;
const r2 = (v: number) => Math.round(v * 100) / 100;

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

/** Metall sett fra siden (rund stang eller sylinder) med lys fra venstre. */
function roundStops(color: string, strength = 1): GradientStop[] {
  return [
    [0, shade(color, 0.28 * strength)],
    [0.28, tint(color, 0.4 * strength)],
    [0.62, color],
    [1, shade(color, 0.38 * strength)],
  ];
}

/** Sidebåndet på en sylinder sett litt ovenfra: fra toppellipsen (y1) ned til bunnellipsen (y2). */
export function sideBand(cx: number, r: number, ry: number, y1: number, y2: number): string {
  return `M${r2(cx - r)},${r2(y1)}L${r2(cx - r)},${r2(y2)}A${r2(r)},${r2(ry)} 0 0 0 ${r2(cx + r)},${r2(y2)}L${r2(cx + r)},${r2(y1)}A${r2(r)},${r2(ry)} 0 0 1 ${r2(cx - r)},${r2(y1)}Z`;
}

/** Glass sett fra siden: kantene litt tettere enn midten. */
const GLASS_STOPS: GradientStop[] = [
  [0, SCENE.glassEdge, 0.45],
  [0.1, SCENE.glass, 0.22],
  [0.45, SCENE.glass, 0.08],
  [0.9, SCENE.glass, 0.2],
  [1, SCENE.glassEdge, 0.5],
];

/* ------------------------------------------------------------------ Vannbadet */

export interface BathGeo {
  /** Midten av bunnen innvendig (der sylinderen står) og innvendig radius. */
  cx: number;
  floor: number;
  R: number;
  /** Tykkelsen på glasset (vegg og bunn). */
  t: number;
  /** Overkanten av glasset og vannflaten. */
  rim: number;
  water: number;
}

/** Bakveggen av vannbadet: glasset bak og bakkanten av åpningen. Tegnes før sylinderen. */
export function VannbadBak({ g }: { g: BathGeo }) {
  const ss = useStrokeScale();
  const id = useSvgId('bad-bak');
  const ro = g.R + g.t;
  return (
    <g aria-hidden>
      <ContactShadow cx={g.cx} cy={g.floor + g.t + ro * E * 0.6} rx={ro * 1.02} />
      <LinearGradient id={`${id}g`} x2={1} y2={0} stops={GLASS_STOPS} />
      <path d={sideBand(g.cx, ro, ro * E, g.rim, g.floor + g.t)} fill={`url(#${id}g)`} />
      <path d={`M${r2(g.cx - g.R)},${r2(g.rim)}A${r2(g.R)},${r2(g.R * E)} 0 0 1 ${r2(g.cx + g.R)},${r2(g.rim)}`} fill="none" stroke={SCENE.glassEdge} strokeWidth={1.1 * ss} opacity={0.75} />
      {/* Bunnen innvendig */}
      <ellipse cx={g.cx} cy={g.floor} rx={g.R} ry={g.R * E} fill={alpha(SCENE.glass, 0.25)} stroke={SCENE.glassEdge} strokeWidth={0.8 * ss} opacity={0.8} />
    </g>
  );
}

/** Punktet på bakkanten av en ellipse (sentrum cx, cy, radier R, ry) ved x. */
function backArcY(cx: number, cy: number, R: number, ry: number, x: number): number {
  const u = Math.max(-1, Math.min(1, (x - cx) / R));
  return cy - ry * Math.sqrt(1 - u * u);
}

/**
 * Vannet foran sylinderen og forveggen av glasset, med bobler når vannet koker. `hull` er sylinderen som går gjennom
 * vannflaten (sentrum og ytre radius). `koker` 0–1: bobler og uro på flaten.
 */
export function VannbadForan({
  g,
  hull,
  koker,
  varme,
  seed = 7,
}: {
  g: BathGeo;
  hull: { cx: number; r: number };
  /** 0 = stille vann, 1 = full koking. */
  koker: number;
  /** 0 = romtemperatur, 1 = 100 °C (vannet blir litt varmere i fargen). */
  varme: number;
  seed?: number;
}) {
  const ss = useStrokeScale();
  const id = useSvgId('bad');
  const ro = g.R + g.t;
  const ry = g.R * E;
  const hx1 = hull.cx - hull.r;
  const hx2 = hull.cx + hull.r;
  const yb1 = backArcY(g.cx, g.water, g.R, ry, hx1);
  const yb2 = backArcY(g.cx, g.water, g.R, ry, hx2);
  // Vannflaten med hull: bakkanten fram til sylinderen, ned og rundt forsiden av sylinderen, opp igjen og videre.
  const surface =
    `M${r2(g.cx - g.R)},${r2(g.water)}` +
    `A${r2(g.R)},${r2(ry)} 0 0 1 ${r2(hx1)},${r2(yb1)}` +
    `L${r2(hx1)},${r2(g.water)}` +
    `A${r2(hull.r)},${r2(hull.r * E)} 0 0 0 ${r2(hx2)},${r2(g.water)}` +
    `L${r2(hx2)},${r2(yb2)}` +
    `A${r2(g.R)},${r2(ry)} 0 0 1 ${r2(g.cx + g.R)},${r2(g.water)}` +
    `A${r2(g.R)},${r2(ry)} 0 0 1 ${r2(g.cx - g.R)},${r2(g.water)}Z`;
  const waterColor = mix(SCENE.water, SCENE.warm, 0.12 * varme);

  const bubbles = useMemo(() => {
    const rnd = sceneRandom(seed);
    return Array.from({ length: 46 }, () => ({ u: rnd(), v: rnd(), s: 0.5 + rnd(), side: rnd() }));
  }, [seed]);
  const nB = Math.round(bubbles.length * Math.max(0, Math.min(1, koker)));
  const depth = g.floor - g.water;

  return (
    <g aria-hidden>
      <LinearGradient
        id={`${id}w`}
        stops={[
          [0, tint(waterColor, 0.25), 0.42],
          [0.5, waterColor, 0.4],
          [1, shade(waterColor, 0.15), 0.5],
        ]}
      />
      <LinearGradient id={`${id}s`} x2={1} y2={0} stops={[[0, tint(waterColor, 0.45), 0.55], [0.5, tint(waterColor, 0.65), 0.45], [1, tint(waterColor, 0.4), 0.55]]} />
      <LinearGradient id={`${id}g`} x2={1} y2={0} stops={[[0, SCENE.highlight, 0], [0.12, SCENE.highlight, 1], [0.85, SCENE.highlight, 0.8], [1, SCENE.highlight, 0]]} />
      {/* Vannet foran sylinderen */}
      <path d={sideBand(g.cx, g.R, ry, g.water, g.floor)} fill={`url(#${id}w)`} />
      <path d={surface} fill={`url(#${id}s)`} stroke={tint(waterColor, 0.5)} strokeWidth={0.9 * ss} />
      {/* Lysstripe langs forkanten av flaten */}
      <path d={`M${r2(g.cx - g.R * 0.85)},${r2(g.water + ry * 0.5)}A${r2(g.R)},${r2(ry)} 0 0 0 ${r2(g.cx - g.R * 0.2)},${r2(g.water + ry * 0.98)}`} fill="none" stroke={SCENE.highlight} strokeWidth={1.4 * ss} strokeLinecap="round" opacity={0.7} />
      {/* Bobler som stiger fra bunnen og fra sylinderen */}
      {nB > 0 && (
        <g fill={alpha(SCENE.highlight, 0.55)} stroke={alpha(SCENE.glassEdge, 0.9)} strokeWidth={0.7 * ss}>
          {bubbles.slice(0, nB).map((b, i) => {
            const x = g.cx - g.R * 0.92 + b.u * g.R * 1.84;
            if (x > hx1 - 2 && x < hx2 + 2 && b.side < 0.5) return null; // bak sylinderen
            const y = g.floor - 3 - (b.v ** 1.3) * (depth - 8);
            const r = (1.2 + 2.2 * b.s * (1 - 0.4 * b.v)) * ss;
            return <circle key={i} cx={r2(x)} cy={r2(y)} r={r2(r)} />;
          })}
        </g>
      )}
      {/* Forveggen: refleksstriper og kanter */}
      <rect x={g.cx - ro * 0.82} y={g.rim + ry} width={ro * 0.06} height={g.floor - g.rim - ry} rx={ro * 0.03} fill={`url(#${id}g)`} opacity={0.75} />
      <rect x={g.cx + ro * 0.56} y={g.rim + ry} width={ro * 0.14} height={g.floor - g.rim - ry} fill={`url(#${id}g)`} opacity={0.3} />
      <g stroke={SCENE.glassEdge} strokeWidth={1.4 * ss} fill="none">
        <line x1={g.cx - ro} y1={g.rim} x2={g.cx - ro} y2={g.floor + g.t} />
        <line x1={g.cx + ro} y1={g.rim} x2={g.cx + ro} y2={g.floor + g.t} />
        <path d={`M${r2(g.cx - ro)},${r2(g.floor + g.t)}A${r2(ro)},${r2(ro * E)} 0 0 0 ${r2(g.cx + ro)},${r2(g.floor + g.t)}`} />
      </g>
      <path d={`M${r2(g.cx - g.R)},${r2(g.floor)}A${r2(g.R)},${r2(ry)} 0 0 0 ${r2(g.cx + g.R)},${r2(g.floor)}`} fill="none" stroke={SCENE.glassEdge} strokeWidth={0.9 * ss} opacity={0.6} />
      {/* Åpningen: en ring i glass */}
      <path
        d={`M${r2(g.cx - ro)},${r2(g.rim)}A${r2(ro)},${r2(ro * E)} 0 1 0 ${r2(g.cx + ro)},${r2(g.rim)}A${r2(ro)},${r2(ro * E)} 0 1 0 ${r2(g.cx - ro)},${r2(g.rim)}ZM${r2(g.cx - g.R)},${r2(g.rim)}A${r2(g.R)},${r2(ry)} 0 1 1 ${r2(g.cx + g.R)},${r2(g.rim)}A${r2(g.R)},${r2(ry)} 0 1 1 ${r2(g.cx - g.R)},${r2(g.rim)}Z`}
        fill={alpha(SCENE.glassEdge, 0.4)}
        fillRule="evenodd"
        stroke={SCENE.glassEdge}
        strokeWidth={1.1 * ss}
      />
      {/* Skala på glasset, som på et begerglass */}
      <g stroke={alpha(SCENE.glassEdge, 0.9)} strokeWidth={0.9 * ss}>
        {[0.2, 0.4, 0.6, 0.8].map((q) => {
          const y = g.floor - q * (g.floor - g.rim) * 0.9;
          return <line key={q} x1={g.cx + ro * 0.74} y1={y} x2={g.cx + ro * 0.9} y2={y + ro * E * 0.25} />;
        })}
      </g>
    </g>
  );
}

/** Damp som stiger fra vannflaten (0–1). Myke, gjennomsiktige skyer, ingen filtre. */
export function Damp({ x, y, w, mengde, seed = 3 }: { x: number; y: number; w: number; mengde: number; seed?: number }) {
  const id = useSvgId('damp');
  const puffs = useMemo(() => {
    const rnd = sceneRandom(seed);
    return Array.from({ length: 7 }, () => ({ u: rnd(), v: rnd(), s: 0.6 + 0.6 * rnd() }));
  }, [seed]);
  if (!(mengde > 0.02)) return null;
  return (
    <g aria-hidden>
      <RadialGradient id={id} stops={[[0, SCENE.highlight, 0.5], [0.6, SCENE.highlight, 0.18], [1, SCENE.highlight, 0]]} />
      {puffs.slice(0, Math.max(2, Math.round(puffs.length * mengde))).map((p, i) => {
        const px = x - w / 2 + p.u * w;
        const py = y - 8 - p.v * 46;
        const r = (12 + 10 * p.v) * p.s;
        return <ellipse key={i} cx={r2(px + 10 * p.v)} cy={r2(py)} rx={r2(r)} ry={r2(r * 0.72)} fill={`url(#${id})`} opacity={0.5 + 0.5 * mengde} />;
      })}
    </g>
  );
}

/* ------------------------------------------------------------------ Sylinderen */

export interface CylGeo {
  cx: number;
  /** Innvendig og ytre radius. */
  r: number;
  ro: number;
  /** Overkanten av glasset og bunnen av lufta (oversiden av bunnplata). */
  rim: number;
  bottom: number;
}

/** Bunnplate i stål som glassylinderen står i, med nipler på sidene (slange og ledning). */
export function Bunnplate({ c, h, nippel, sider }: { c: CylGeo; h: number; nippel: number; sider: ('venstre' | 'hoyre')[] }) {
  const ss = useStrokeScale();
  const id = useSvgId('bunnplate');
  const R = c.ro + 5;
  const top = c.bottom;
  return (
    <g aria-hidden>
      <LinearGradient id={`${id}s`} x2={1} y2={0} stops={roundStops(SCENE.metal, 0.9)} />
      <LinearGradient id={`${id}n`} stops={materialStops(SCENE.metal, 1.2)} />
      <path d={sideBand(c.cx, R, R * E, top, top + h)} fill={`url(#${id}s)`} stroke={SCENE.outline} strokeWidth={0.9 * ss} />
      <ellipse cx={c.cx} cy={top} rx={R} ry={R * E} fill={tint(SCENE.metal, 0.35)} stroke={SCENE.outline} strokeWidth={0.8 * ss} />
      {sider.map((side) => (
        <rect
          key={side}
          x={side === 'venstre' ? c.cx - R - nippel : c.cx + R - 2}
          y={top + h * 0.25}
          width={nippel + 2}
          height={h * 0.5}
          rx={1.5}
          fill={`url(#${id}n)`}
          stroke={SCENE.outline}
          strokeWidth={0.8 * ss}
        />
      ))}
    </g>
  );
}

/** Den bakre delen av glasset. Tegnes før lufta og stempelet. */
export function SylinderBak({ c }: { c: CylGeo }) {
  const ss = useStrokeScale();
  const id = useSvgId('syl-bak');
  return (
    <g aria-hidden>
      <LinearGradient id={`${id}g`} x2={1} y2={0} stops={GLASS_STOPS} />
      <rect x={c.cx - c.ro} y={c.rim} width={2 * c.ro} height={c.bottom - c.rim} fill={`url(#${id}g)`} />
      <path d={`M${r2(c.cx - c.r)},${r2(c.rim)}A${r2(c.r)},${r2(c.r * E)} 0 0 1 ${r2(c.cx + c.r)},${r2(c.rim)}`} fill="none" stroke={SCENE.glassEdge} strokeWidth={1.2 * ss} opacity={0.8} />
    </g>
  );
}

/** Lufta i sylinderen: en svak farge som blir varmere med `varme` (0–1). Fra undersiden av stempelet til bunnen. */
export function Luft({ c, top, varme }: { c: CylGeo; top: number; varme: number }) {
  const v = Math.max(0, Math.min(1, varme));
  const color = mix(SCENE.glass, SCENE.warm, 0.85 * v);
  return <path d={sideBand(c.cx, c.r, c.r * E, top, c.bottom)} fill={alpha(color, 0.16 + 0.14 * v)} aria-hidden />;
}

/**
 * Luftpartikler med fartshaler. Plasseringen er fast (frø), så bildet er likt hver gang; halene blir lengre med
 * temperaturen (farten er proporsjonal med √T). `halelengde` er lengden ved T = 300 K.
 */
export function Partikler({ c, top, T, halelengde, k, seed = 11 }: { c: CylGeo; top: number; T: number; halelengde: number; k: number; seed?: number }) {
  const ss = useStrokeScale();
  const id = useSvgId('partikkel');
  const pts = useMemo(() => {
    const rnd = sceneRandom(seed);
    // Rutenett med 5 × 5 ruter og én partikkel et tilfeldig sted i hver, så de fyller hele lufta jevnt.
    return Array.from({ length: 25 }, (_, i) => ({
      u: (Math.floor(i / 5) + 0.12 + 0.76 * rnd()) / 5,
      v: ((i % 5) + 0.12 + 0.76 * rnd()) / 5,
      a: rnd() * 2 * Math.PI,
      s: 0.7 + 0.6 * rnd(),
    }));
  }, [seed]);
  const h = c.bottom - top;
  const tail = halelengde * Math.sqrt(Math.max(0, T) / 300);
  const pr = 3.4 * k;
  return (
    <g aria-hidden>
      <RadialGradient id={id} fx={0.35} fy={0.3} stops={sphereStops(PAINTS.blaa)} />
      {pts.map((p, i) => {
        const x = c.cx - c.r + pr + 2 + p.u * (2 * c.r - 2 * pr - 4);
        const y = top + pr + 3 + p.v * Math.max(0, h - 2 * pr - 6);
        const L = tail * p.s;
        const tx = x - Math.cos(p.a) * L;
        const ty = y - Math.sin(p.a) * L * 0.8;
        return (
          <g key={i}>
            <line x1={r2(tx)} y1={r2(ty)} x2={r2(x)} y2={r2(y)} stroke={alpha(PAINTS.blaa, 0.45)} strokeWidth={1.6 * ss} strokeLinecap="round" />
            <circle cx={r2(x)} cy={r2(y)} r={r2(pr)} fill={`url(#${id})`} stroke={shade(PAINTS.blaa, 0.45)} strokeWidth={0.6 * ss} />
          </g>
        );
      })}
    </g>
  );
}

/**
 * Stempel i aluminium med tetningsring, stang og knott. `top` er oversiden, `bottom` undersiden (toppen av lufta).
 * Stanga går opp til `rodTop`.
 */
export function Stempel({ c, top, bottom, rodTop, rodW }: { c: CylGeo; top: number; bottom: number; rodTop: number; rodW: number }) {
  const ss = useStrokeScale();
  const id = useSvgId('stempel');
  const ry = c.r * E;
  const h = bottom - top;
  const ringY = top + h * 0.32;
  const ringH = Math.max(3, h * 0.22);
  const knob = rodW * 0.95;
  return (
    <g aria-hidden>
      <LinearGradient id={`${id}s`} x2={1} y2={0} stops={roundStops(SCENE.metal)} />
      <LinearGradient id={`${id}r`} x2={1} y2={0} stops={roundStops(SCENE.metal, 1.1)} />
      <LinearGradient id={`${id}t`} stops={[[0, tint(SCENE.metal, 0.45)], [1, tint(SCENE.metal, 0.12)]]} />
      <RadialGradient id={`${id}k`} fx={0.35} fy={0.3} stops={sphereStops(SCENE.rubberLight)} />
      <path d={sideBand(c.cx, c.r, ry, top, bottom)} fill={`url(#${id}s)`} stroke={SCENE.outline} strokeWidth={0.9 * ss} />
      <path d={sideBand(c.cx, c.r, ry, ringY, ringY + ringH)} fill={SCENE.rubber} />
      <path d={`M${r2(c.cx - c.r)},${r2(ringY + 1)}A${r2(c.r)},${r2(ry)} 0 0 0 ${r2(c.cx + c.r)},${r2(ringY + 1)}`} fill="none" stroke={SCENE.highlight} strokeWidth={0.9 * ss} opacity={0.55} />
      <ellipse cx={c.cx} cy={top} rx={c.r} ry={ry} fill={`url(#${id}t)`} stroke={SCENE.outline} strokeWidth={0.9 * ss} />
      <ellipse cx={c.cx} cy={top} rx={rodW * 1.4} ry={rodW * 1.4 * E} fill={shade(SCENE.metal, 0.12)} stroke={SCENE.outline} strokeWidth={0.8 * ss} />
      <rect x={c.cx - rodW / 2} y={rodTop} width={rodW} height={top - rodTop} fill={`url(#${id}r)`} stroke={SCENE.outline} strokeWidth={0.8 * ss} />
      <ellipse cx={c.cx} cy={rodTop} rx={knob * 1.2} ry={knob} fill={`url(#${id}k)`} stroke={SCENE.outline} strokeWidth={0.9 * ss} />
    </g>
  );
}

/** Stiplet kontur av stempelet der det sto før (oversiden og undersiden), med en liten tekst. */
export function StempelSpor({ c, top, bottom, tekst }: { c: CylGeo; top: number; bottom: number; tekst?: string }) {
  const ss = useStrokeScale();
  const ry = c.r * E;
  return (
    <g aria-hidden>
      <path
        d={`M${r2(c.cx - c.r)},${r2(top)}A${r2(c.r)},${r2(ry)} 0 0 0 ${r2(c.cx + c.r)},${r2(top)}A${r2(c.r)},${r2(ry)} 0 0 0 ${r2(c.cx - c.r)},${r2(top)}M${r2(c.cx - c.r)},${r2(top)}L${r2(c.cx - c.r)},${r2(bottom)}A${r2(c.r)},${r2(ry)} 0 0 0 ${r2(c.cx + c.r)},${r2(bottom)}L${r2(c.cx + c.r)},${r2(top)}`}
        fill="none"
        stroke={SCENE.outline}
        strokeWidth={1.1 * ss}
        strokeDasharray={`${4 * ss} ${3 * ss}`}
        opacity={0.7}
      />
      {tekst && (
        <Txt x={c.cx - c.r * 0.55} y={(top + bottom) / 2 + 5} size={0.72} muted>
          {tekst}
        </Txt>
      )}
    </g>
  );
}

/** Forsiden av glasset: refleksstriper, kantene og åpningen øverst. Tegnes etter partiklene og stempelet. */
export function SylinderForan({ c, hull }: { c: CylGeo; hull?: number }) {
  const ss = useStrokeScale();
  const id = useSvgId('syl-foran');
  const ry = c.ro * E;
  const h = c.bottom - c.rim;
  return (
    <g aria-hidden>
      <LinearGradient id={`${id}s`} stops={[[0, SCENE.highlight, 0], [0.12, SCENE.highlight, 1], [0.85, SCENE.highlight, 0.8], [1, SCENE.highlight, 0]]} />
      <rect x={c.cx - c.ro * 0.8} y={c.rim + ry} width={c.ro * 0.08} height={h - ry - 4} rx={c.ro * 0.04} fill={`url(#${id}s)`} />
      <rect x={c.cx - c.ro * 0.66} y={c.rim + ry} width={c.ro * 0.03} height={h - ry - 4} fill={`url(#${id}s)`} opacity={0.6} />
      <rect x={c.cx + c.ro * 0.5} y={c.rim + ry} width={c.ro * 0.18} height={h - ry - 4} fill={`url(#${id}s)`} opacity={0.32} />
      <g stroke={SCENE.glassEdge} strokeWidth={1.4 * ss}>
        <line x1={c.cx - c.ro} y1={c.rim} x2={c.cx - c.ro} y2={c.bottom} />
        <line x1={c.cx + c.ro} y1={c.rim} x2={c.cx + c.ro} y2={c.bottom} />
      </g>
      <g stroke={SCENE.glassEdge} strokeWidth={0.9 * ss} opacity={0.55}>
        <line x1={c.cx - c.r} y1={c.rim} x2={c.cx - c.r} y2={c.bottom} />
        <line x1={c.cx + c.r} y1={c.rim} x2={c.cx + c.r} y2={c.bottom} />
      </g>
      {/* Hullene for splinten i veggen */}
      {hull !== undefined && (
        <g fill={alpha(SCENE.outline, 0.35)} stroke={SCENE.glassEdge} strokeWidth={0.8 * ss}>
          <ellipse cx={c.cx - c.ro * 0.86} cy={hull} rx={2.2 * ss} ry={3.4 * ss} />
          <ellipse cx={c.cx + c.ro * 0.86} cy={hull} rx={2.2 * ss} ry={3.4 * ss} />
        </g>
      )}
      <path
        d={`M${r2(c.cx - c.ro)},${r2(c.rim)}A${r2(c.ro)},${r2(ry)} 0 1 0 ${r2(c.cx + c.ro)},${r2(c.rim)}A${r2(c.ro)},${r2(ry)} 0 1 0 ${r2(c.cx - c.ro)},${r2(c.rim)}ZM${r2(c.cx - c.r)},${r2(c.rim)}A${r2(c.r)},${r2(c.r * E)} 0 1 1 ${r2(c.cx + c.r)},${r2(c.rim)}A${r2(c.r)},${r2(c.r * E)} 0 1 1 ${r2(c.cx - c.r)},${r2(c.rim)}Z`}
        fill={alpha(SCENE.glassEdge, 0.45)}
        fillRule="evenodd"
        stroke={SCENE.glassEdge}
        strokeWidth={1.1 * ss}
      />
      <path d={`M${r2(c.cx - c.ro * 0.75)},${r2(c.rim + ry * 0.62)}A${r2(c.ro)},${r2(ry)} 0 0 0 ${r2(c.cx - c.ro * 0.1)},${r2(c.rim + ry * 0.99)}`} fill="none" stroke={SCENE.highlight} strokeWidth={1.6 * ss} strokeLinecap="round" />
    </g>
  );
}

/* ------------------------------------------------------------------ Splinten */

/**
 * Splint i stål: en rett pinne med en ring i enden. (x1, y) er spissen og (x2, y) enden ved ringen; ringen henger
 * utenfor x2. Gjennom sylinderen ligger den på en korde foran stanga, rett over stempelet.
 */
export function Splint({ x1, x2, y, d, fremhev }: { x1: number; x2: number; y: number; d: number; fremhev?: boolean }) {
  const ss = useStrokeScale();
  const id = useSvgId('splint');
  const dir = x2 >= x1 ? 1 : -1;
  const ringR = d * 1.9;
  return (
    <g aria-hidden>
      <LinearGradient id={`${id}p`} stops={[[0, tint(SCENE.metalDark, 0.35)], [0.4, SCENE.metalDark], [1, shade(SCENE.metalDark, 0.4)]]} />
      {fremhev && (
        <rect x={Math.min(x1, x2) - 5} y={y - d / 2 - 5} width={Math.abs(x2 - x1) + 10} height={d + 10} rx={(d + 10) / 2} fill={alpha(VIZ.normal, 0.18)} stroke={VIZ.normal} strokeWidth={1.6 * ss} />
      )}
      <path
        d={`M${r2(x1)},${r2(y - d / 2)}L${r2(x2)},${r2(y - d / 2)}L${r2(x2)},${r2(y + d / 2)}L${r2(x1)},${r2(y + d / 2)}Q${r2(x1 - dir * d * 0.7)},${r2(y)} ${r2(x1)},${r2(y - d / 2)}Z`}
        fill={`url(#${id}p)`}
        stroke={SCENE.outline}
        strokeWidth={0.8 * ss}
      />
      <circle cx={x2 + dir * ringR * 0.92} cy={y + ringR * 0.25} r={ringR} fill="none" stroke={SCENE.metalDark} strokeWidth={Math.max(1.8, d * 0.42) * ss} />
      <circle cx={x2 + dir * ringR * 0.92} cy={y + ringR * 0.25} r={ringR} fill="none" stroke={tint(SCENE.metal, 0.4)} strokeWidth={0.7 * ss} opacity={0.8} />
    </g>
  );
}

/* ------------------------------------------------------------------ Instrumentene */

/** Manometer på stativ: rund skive med skala 0–`maks` kPa og viser. (x, y) er sentrum av skiva; foten står på `benk`. */
export function Manometer({ x, y, r, verdi, maks, benk }: { x: number; y: number; r: number; verdi: number; maks: number; benk: number }) {
  const ss = useStrokeScale();
  const f = useTextScale();
  const id = useSvgId('manometer');
  // Skalaen går fra −135° til +135° (0 nede til venstre, maks nede til høyre).
  const ang = (v: number) => ((-135 + 270 * Math.max(0, Math.min(1.04, v / maks))) * Math.PI) / 180;
  const pt = (v: number, rr: number) => ({ x: x + Math.sin(ang(v)) * rr, y: y - Math.cos(ang(v)) * rr });
  const major = [0, 100, 200].filter((v) => v <= maks);
  const minor = Array.from({ length: Math.floor(maks / 10) + 1 }, (_, i) => i * 10);
  const needle = pt(verdi, r * 0.78);
  const poleW = Math.max(5, r * 0.13);
  const fs = Math.min(0.66, (r * 0.32) / (17 * f));
  return (
    <g aria-hidden>
      <LinearGradient id={`${id}p`} x2={1} y2={0} stops={roundStops(SCENE.metal)} />
      <LinearGradient id={`${id}f`} stops={materialStops(shade(PAINTS.blaa, 0.3), 1.2)} />
      <RadialGradient id={`${id}r`} fx={0.35} fy={0.3} stops={sphereStops(SCENE.metal)} />
      <RadialGradient id={`${id}d`} cx={0.45} cy={0.4} r={0.7} stops={[[0, SCENE.highlight], [1, mix(SCENE.highlight, SCENE.glass, 0.35)]]} />
      {/* Stativ */}
      <ContactShadow cx={x} cy={benk} rx={r * 1.15} />
      <rect x={x - poleW / 2} y={y + r * 0.8} width={poleW} height={benk - y - r * 0.8 - 6} fill={`url(#${id}p)`} stroke={SCENE.outline} strokeWidth={0.8 * ss} />
      <path d={`M${r2(x - r * 1.05)},${r2(benk)}L${r2(x - r * 0.95)},${r2(benk - 8)}L${r2(x + r * 0.95)},${r2(benk - 8)}L${r2(x + r * 1.05)},${r2(benk)}Z`} fill={`url(#${id}f)`} stroke={SCENE.outline} strokeWidth={0.9 * ss} />
      {/* Huset og skiva */}
      <circle cx={x} cy={y} r={r} fill={`url(#${id}r)`} stroke={SCENE.outline} strokeWidth={1 * ss} />
      <circle cx={x} cy={y} r={r * 0.86} fill={`url(#${id}d)`} stroke={shade(SCENE.metal, 0.3)} strokeWidth={0.9 * ss} />
      <g stroke={SCENE.outline} strokeLinecap="round">
        {minor.map((v) => {
          const a = pt(v, r * 0.8);
          const b = pt(v, r * (major.includes(v) ? 0.66 : 0.72));
          return <line key={v} x1={r2(a.x)} y1={r2(a.y)} x2={r2(b.x)} y2={r2(b.y)} strokeWidth={(major.includes(v) ? 1.3 : 0.7) * ss} />;
        })}
      </g>
      {major.map((v) => {
        const p = pt(v, r * 0.5);
        return (
          <Txt key={v} x={p.x} y={p.y + 4 * fs * f} size={fs} color={SCENE.outline} halo={false}>
            {String(v)}
          </Txt>
        );
      })}
      <Txt x={x} y={y + r * 0.62} size={fs * 0.9} color={SCENE.outline} halo={false}>
        kPa
      </Txt>
      <line x1={x} y1={y} x2={r2(needle.x)} y2={r2(needle.y)} stroke={PAINTS.rod} strokeWidth={1.8 * ss} strokeLinecap="round" />
      <circle cx={x} cy={y} r={r * 0.08} fill={SCENE.outline} />
      {/* Stussen nederst, der slangen festes */}
      <rect x={x - r * 0.1} y={y + r * 0.96} width={r * 0.2} height={r * 0.2} fill={`url(#${id}p)`} stroke={SCENE.outline} strokeWidth={0.8 * ss} />
    </g>
  );
}

/** Hvor slangen festes på manometeret. */
export function manometerStuss(x: number, y: number, r: number) {
  return { x, y: y + r * 1.16 };
}

/** Digitalt termometer på benken med display. (x, y) er midt på bunnen; ledningen går ut på toppen. */
export function DigitalTermometer({ x, y, w, h, tekst }: { x: number; y: number; w: number; h: number; tekst: string }) {
  const ss = useStrokeScale();
  const f = useTextScale();
  const id = useSvgId('digterm');
  const left = x - w / 2;
  const top = y - h;
  const dispH = h * 0.26;
  const fs = Math.min(0.62, (dispH * 0.62) / (17 * f), (w * 0.6) / (Math.max(4, tekst.length) * 17 * f * 0.56));
  return (
    <g aria-hidden>
      <LinearGradient id={`${id}b`} stops={materialStops(PAINTS.gul, 1.1)} />
      <ContactShadow cx={x} cy={y} rx={w * 0.6} />
      <rect x={left} y={top} width={w} height={h} rx={w * 0.14} fill={`url(#${id}b)`} stroke={SCENE.outline} strokeWidth={1 * ss} />
      <rect x={left + w * 0.1} y={top + h * 0.08} width={w * 0.8} height={h * 0.84} rx={w * 0.09} fill={shade(SCENE.plastic, 0.7)} />
      <rect x={left + w * 0.18} y={top + h * 0.16} width={w * 0.64} height={dispH} rx={2} fill={SCENE.display} stroke={SCENE.outline} strokeWidth={0.7 * ss} />
      <Txt x={x} y={top + h * 0.16 + dispH * 0.7} size={fs} color={SCENE.displayText} halo={false} weight={700}>
        {tekst}
      </Txt>
      <circle cx={x - w * 0.16} cy={top + h * 0.6} r={w * 0.08} fill={shade(SCENE.plastic, 0.45)} />
      <circle cx={x + w * 0.16} cy={top + h * 0.6} r={w * 0.08} fill={shade(SCENE.plastic, 0.45)} />
      <circle cx={x} cy={top + h * 0.8} r={w * 0.1} fill={PAINTS.rod} stroke={SCENE.outline} strokeWidth={0.7 * ss} />
      <rect x={x - w * 0.07} y={top - h * 0.06} width={w * 0.14} height={h * 0.07} rx={1.5} fill={SCENE.rubber} />
    </g>
  );
}

/** Slange (manometer) eller ledning (termometer) langs en sti. */
export function Slange({ d, width, color }: { d: string; width: number; color: string }) {
  const ss = useStrokeScale();
  return (
    <g aria-hidden fill="none" strokeLinecap="round" strokeLinejoin="round">
      <path d={d} stroke={shade(color, 0.35)} strokeWidth={(width + 1.6) * ss} />
      <path d={d} stroke={color} strokeWidth={width * ss} />
      <path d={d} stroke={tint(color, 0.35)} strokeWidth={Math.max(0.8, width * 0.25) * ss} opacity={0.7} transform={`translate(${-width * 0.18},${-width * 0.18})`} />
    </g>
  );
}

/* ------------------------------------------------------------------ Varme */

/**
 * Bølgete pil for varme (Q) fra (x1, y1) til spissen i (x2, y2): tykk strek med kontur, så den synes oppå vann og
 * glass. `width` er tykkelsen.
 */
export function VarmePil({ x1, y1, x2, y2, color, width = 5 }: { x1: number; y1: number; x2: number; y2: number; color: string; width?: number }) {
  const ss = useStrokeScale();
  const dx = x2 - x1;
  const dy = y2 - y1;
  const L = Math.hypot(dx, dy);
  if (!(L > 6)) return null;
  const ux = dx / L;
  const uy = dy / L;
  const w = width * ss;
  const head = Math.min(L * 0.45, w * 2.6);
  const bodyL = L - head;
  const waves = Math.max(1, Math.round(bodyL / 18));
  const amp = Math.min(4.5 * ss, bodyL / 6);
  const pts: string[] = [];
  const N = waves * 12;
  for (let i = 0; i <= N; i++) {
    const s = (i / N) * bodyL;
    const off = Math.sin((i / N) * waves * 2 * Math.PI) * amp * (i < N ? 1 : 0);
    pts.push(`${r2(x1 + ux * s - uy * off)},${r2(y1 + uy * s + ux * off)}`);
  }
  const d = `M${pts.join('L')}`;
  const bx = x1 + ux * bodyL;
  const by = y1 + uy * bodyL;
  const hw = w * 1.35;
  const tri = `M${r2(x2)},${r2(y2)}L${r2(bx - uy * hw)},${r2(by + ux * hw)}L${r2(bx + uy * hw)},${r2(by - ux * hw)}Z`;
  return (
    <g aria-hidden>
      <path d={d} fill="none" stroke={VIZ.surface} strokeWidth={w + 4 * ss} strokeLinecap="round" strokeLinejoin="round" opacity={0.9} />
      <path d={tri} fill={VIZ.surface} stroke={VIZ.surface} strokeWidth={4 * ss} strokeLinejoin="round" opacity={0.9} />
      <path d={d} fill="none" stroke={color} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" />
      <path d={tri} fill={color} stroke={shade(color, 0.3)} strokeWidth={0.9 * ss} strokeLinejoin="round" />
    </g>
  );
}
