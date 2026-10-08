/**
 * Gjenstandene i karbon-14-dateringen (k8-c14): prøvene på labbenken (eikeplanke med klinknagler, bein og trekull i
 * petriskål, støttann fra en mammut, fossilt dinosaurbein og et prøveglass), C-14-måleren og lupa med C-14-atomene.
 * De finnes ikke i scene-kit-et, så de er laget her i samme stil: toninger fra core, SCENE-farger, tynn kontur og
 * myk skygge. Ankerpunktet er midt under gjenstanden, på benken, og `size` er lengden (eller høyden for glasset).
 */
import { memo, useMemo } from 'react';
import { VIZ } from '../../kit';
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
} from '../../kit/scene';

const r1 = (v: number) => Math.round(v * 10) / 10;
const pts = (list: [number, number][]) => list.map(([a, b]) => `${r1(a)},${r1(b)}`).join(' ');

/** Punktet på prøven som lupa forstørrer, relativt til ankerpunktet (i figurens enheter). */
export interface ZoomSpot {
  dx: number;
  dy: number;
  /** Radien til den lille ringen på prøven. */
  r: number;
}

/* ---------------------------------------------------------------- Eikeplanke fra et vikingskip */

/** Eikeplanke fra et vikingskip, sett litt ovenfra: mørk, værbitt eik med klinknagler i jern langs kanten og en ny,
 * lys kutt der prøven er tatt. `size` er lengden. */
export const Planke = memo(function Planke({ x, y, size }: { x: number; y: number; size: number }) {
  const L = size;
  const ss = useStrokeScale();
  const idTop = useSvgId('c14-planke-top');
  const idFront = useSvgId('c14-planke-front');
  const th = 0.075 * L;
  const dep = 0.13 * L;
  const left = x - L / 2;
  const right = x + L / 2;
  const topY = y - th;
  const backY = topY - dep;
  // Brukket ende til høyre: taggete kant gjennom toppflaten og forsiden.
  const jag: [number, number][] = [
    [right - 0.02 * L, backY],
    [right + 0.01 * L, backY + 0.25 * dep],
    [right - 0.015 * L, backY + 0.45 * dep],
    [right + 0.02 * L, backY + 0.7 * dep],
    [right, topY],
  ];
  const top: [number, number][] = [[left + 0.015 * L, backY], ...jag, [left, topY]];
  const front: [number, number][] = [
    [left, topY],
    [right, topY],
    [right + 0.012 * L, topY + 0.5 * th],
    [right - 0.004 * L, y],
    [left, y],
  ];
  const wood = shade(SCENE.wood, 0.32);
  const grain = Array.from({ length: 5 }, (_, i) => {
    const gy = backY + ((i + 0.7) / 5.6) * dep;
    const w = 0.012 * L * (i % 2 === 0 ? 1 : -1);
    return `M${r1(left + 0.03 * L)},${r1(gy)} C${r1(x - 0.2 * L)},${r1(gy + w)} ${r1(x + 0.15 * L)},${r1(gy - w)} ${r1(right - 0.04 * L)},${r1(gy + w * 0.4)}`;
  });
  const rivets = [0.12, 0.31, 0.5, 0.69].map((t) => left + t * L);
  const rv = 0.022 * L;
  // Nytt kutt der prøven er tatt: lys eik i hjørnet foran til venstre.
  const cut = { x: left + 0.06 * L, w: 0.07 * L };
  return (
    <g>
      <ContactShadow cx={x} cy={y} rx={L * 0.55} ry={0.05 * L} />
      <LinearGradient id={idTop} stops={materialStops(tint(wood, 0.08), 0.8)} />
      <LinearGradient id={idFront} stops={[[0, shade(wood, 0.18)], [1, shade(wood, 0.42)]]} />
      <polygon points={pts(top)} fill={`url(#${idTop})`} stroke={SCENE.outline} strokeWidth={1 * ss} strokeLinejoin="round" />
      {/* Overlappet («landet») langs bakkanten, der neste bordgang lå */}
      <path
        d={`M${r1(left + 0.015 * L)},${r1(backY)} L${r1(right - 0.02 * L)},${r1(backY)} L${r1(right - 0.01 * L)},${r1(backY + 0.3 * dep)} L${r1(left + 0.008 * L)},${r1(backY + 0.3 * dep)} Z`}
        fill={shade(wood, 0.25)}
        opacity={0.55}
      />
      {grain.map((d, i) => (
        <path key={i} d={d} fill="none" stroke={shade(wood, 0.45)} strokeWidth={0.9 * ss} opacity={0.55} />
      ))}
      <polygon points={pts(front)} fill={`url(#${idFront})`} stroke={SCENE.outline} strokeWidth={1 * ss} strokeLinejoin="round" />
      {/* Kuttet der prøven er tatt */}
      <polygon
        points={pts([
          [cut.x, topY],
          [cut.x + cut.w, topY],
          [cut.x + cut.w, y - 0.25 * th],
          [cut.x, y - 0.25 * th],
        ])}
        fill={tint(SCENE.wood, 0.25)}
        stroke={shade(wood, 0.3)}
        strokeWidth={0.8 * ss}
      />
      {/* Klinknagler i jern: rusten, rund topp med høylys */}
      {rivets.map((rx, i) => (
        <g key={i}>
          <circle cx={rx} cy={backY + 0.17 * dep} r={rv * 1.25} fill={alpha(mix(SCENE.metalDark, SCENE.brick, 0.45), 0.35)} />
          <circle cx={rx} cy={backY + 0.15 * dep} r={rv} fill={mix(SCENE.metalDark, SCENE.brick, 0.4)} stroke={SCENE.outline} strokeWidth={0.8 * ss} />
          <circle cx={rx - rv * 0.3} cy={backY + 0.15 * dep - rv * 0.3} r={rv * 0.35} fill={tint(SCENE.metal, 0.3)} opacity={0.7} />
        </g>
      ))}
    </g>
  );
});

export function plankeSpot(size: number): ZoomSpot {
  return { dx: -0.5 * size + 0.095 * size, dy: -0.04 * size, r: 0.05 * size };
}

/* ---------------------------------------------------------------- Petriskål med bein eller trekull */

/** Petriskål i glass sett litt ovenfra, med innholdet (`children`) tegnet mellom bakveggen og forveggen.
 * `size` er bredden. */
function Petriskal({ x, y, size, children }: { x: number; y: number; size: number; children: React.ReactNode }) {
  const ss = useStrokeScale();
  const idGlass = useSvgId('c14-petri');
  const rx = size / 2;
  const ry = 0.15 * size;
  const wall = 0.09 * size;
  const cy = y - ry; // midten av bunnen
  const top = cy - wall;
  return (
    <g>
      <ContactShadow cx={x} cy={y - ry * 0.4} rx={rx * 1.05} ry={ry * 0.9} />
      <LinearGradient
        id={idGlass}
        x2={1}
        y2={0}
        stops={[
          [0, alpha(SCENE.glass, 0.55)],
          [0.25, alpha(tint(SCENE.glass, 0.6), 0.35)],
          [0.6, alpha(SCENE.glass, 0.25)],
          [1, alpha(SCENE.glass, 0.6)],
        ]}
      />
      {/* Bunnen og bakveggen */}
      <ellipse cx={x} cy={cy} rx={rx} ry={ry} fill={alpha(SCENE.glass, 0.35)} stroke={SCENE.glassEdge} strokeWidth={1 * ss} />
      <ellipse cx={x} cy={top} rx={rx} ry={ry} fill="none" stroke={SCENE.glassEdge} strokeWidth={1.2 * ss} opacity={0.7} />
      {children}
      {/* Forveggen: glass med høylys */}
      <path
        d={`M${r1(x - rx)},${r1(top)} A${r1(rx)},${r1(ry)} 0 0 0 ${r1(x + rx)},${r1(top)} L${r1(x + rx)},${r1(cy)} A${r1(rx)},${r1(ry)} 0 0 1 ${r1(x - rx)},${r1(cy)} Z`}
        fill={`url(#${idGlass})`}
        stroke={SCENE.glassEdge}
        strokeWidth={1.1 * ss}
      />
      <path
        d={`M${r1(x - rx * 0.75)},${r1(top + ry * 0.62)} A${r1(rx)},${r1(ry)} 0 0 0 ${r1(x - rx * 0.2)},${r1(top + ry * 0.98)}`}
        fill="none"
        stroke={SCENE.highlight}
        strokeWidth={2 * ss}
        strokeLinecap="round"
        opacity={0.7}
      />
    </g>
  );
}

/** Beinbit i en petriskål (prøven fra Ötzi). */
export const BeinIPetriskal = memo(function BeinIPetriskal({ x, y, size }: { x: number; y: number; size: number }) {
  const ss = useStrokeScale();
  const id = useSvgId('c14-bein');
  const L = size * 0.62;
  const cy = y - 0.15 * size - 0.02 * size;
  const bone = mix(SCENE.woodLight, SCENE.snow, 0.45);
  const h = 0.055 * size;
  const x0 = x - L / 2;
  // Beinbit: knoke til venstre, skaft og brukket ende til høyre.
  const d =
    `M${r1(x0 + 0.1 * L)},${r1(cy - h)} ` +
    `C${r1(x0 - 0.02 * L)},${r1(cy - 2.3 * h)} ${r1(x0 - 0.1 * L)},${r1(cy - 0.6 * h)} ${r1(x0 + 0.02 * L)},${r1(cy)} ` +
    `C${r1(x0 - 0.1 * L)},${r1(cy + 0.8 * h)} ${r1(x0 - 0.01 * L)},${r1(cy + 2.4 * h)} ${r1(x0 + 0.12 * L)},${r1(cy + h)} ` +
    `C${r1(x0 + 0.4 * L)},${r1(cy + 0.75 * h)} ${r1(x0 + 0.7 * L)},${r1(cy + 0.8 * h)} ${r1(x0 + 0.97 * L)},${r1(cy + 0.9 * h)} ` +
    `L${r1(x0 + 1.02 * L)},${r1(cy + 0.2 * h)} L${r1(x0 + 0.95 * L)},${r1(cy - 0.3 * h)} L${r1(x0 + 1.0 * L)},${r1(cy - 0.95 * h)} ` +
    `C${r1(x0 + 0.7 * L)},${r1(cy - 0.8 * h)} ${r1(x0 + 0.4 * L)},${r1(cy - 0.75 * h)} ${r1(x0 + 0.1 * L)},${r1(cy - h)} Z`;
  return (
    <Petriskal x={x} y={y} size={size}>
      <ellipse cx={x + 0.02 * size} cy={cy + h * 1.1} rx={L * 0.5} ry={h * 0.6} fill={SCENE.shadow} opacity={0.35} />
      <LinearGradient id={id} stops={materialStops(bone, 1.1)} />
      <path d={d} fill={`url(#${id})`} stroke={shade(bone, 0.45)} strokeWidth={1 * ss} strokeLinejoin="round" />
      {/* Porøs bruddflate og noen flekker */}
      <ellipse cx={x0 + 0.98 * L} cy={cy} rx={0.025 * L} ry={0.8 * h} fill={shade(bone, 0.2)} />
      <path
        d={`M${r1(x0 + 0.25 * L)},${r1(cy - 0.35 * h)} C${r1(x0 + 0.45 * L)},${r1(cy - 0.5 * h)} ${r1(x0 + 0.65 * L)},${r1(cy - 0.45 * h)} ${r1(x0 + 0.85 * L)},${r1(cy - 0.5 * h)}`}
        fill="none"
        stroke={SCENE.highlight}
        strokeWidth={1.5 * ss}
        opacity={0.5}
        strokeLinecap="round"
      />
      <circle cx={x0 + 0.55 * L} cy={cy + 0.25 * h} r={0.2 * h} fill={shade(bone, 0.25)} opacity={0.6} />
      <circle cx={x0 + 0.08 * L} cy={cy - 0.2 * h} r={0.25 * h} fill={shade(bone, 0.2)} opacity={0.5} />
    </Petriskal>
  );
});

export function beinSpot(size: number): ZoomSpot {
  return { dx: 0.12 * size, dy: -0.17 * size, r: 0.06 * size };
}

/** Biter av trekull i en petriskål (prøven fra ildstedet). */
export const TrekullIPetriskal = memo(function TrekullIPetriskal({ x, y, size }: { x: number; y: number; size: number }) {
  const ss = useStrokeScale();
  const cy = y - 0.17 * size;
  const coal = shade(SCENE.asphaltDark, 0.45);
  const chunks = useMemo(() => {
    const rnd = sceneRandom(8);
    const spots: [number, number, number][] = [
      [-0.24, 0.01, 0.1],
      [-0.06, -0.03, 0.12],
      [0.13, 0.0, 0.1],
      [0.27, 0.03, 0.07],
      [0.02, 0.05, 0.08],
      [-0.33, 0.05, 0.06],
    ];
    return spots.map(([dx, dy, r]) => {
      const n = 6;
      const corners = Array.from({ length: n }, (_, i) => {
        const a = (i / n) * Math.PI * 2 + rnd() * 0.5;
        const rr = r * (0.75 + rnd() * 0.45);
        return [Math.cos(a) * rr, Math.sin(a) * rr * 0.62] as [number, number];
      });
      return { dx, dy, r, corners };
    });
  }, []);
  return (
    <Petriskal x={x} y={y} size={size}>
      {chunks.map((c, i) => {
        const cx = x + c.dx * size;
        const ccy = cy + c.dy * size;
        const poly = c.corners.map(([a, b]) => [cx + a * size, ccy + b * size] as [number, number]);
        const lit = poly.slice(3).concat([[cx, ccy - c.r * 0.1 * size]]);
        return (
          <g key={i}>
            <ellipse cx={cx + 0.01 * size} cy={ccy + c.r * 0.45 * size} rx={c.r * 0.9 * size} ry={c.r * 0.25 * size} fill={SCENE.shadow} opacity={0.4} />
            <polygon points={pts(poly)} fill={coal} stroke={shade(coal, 0.5)} strokeWidth={0.8 * ss} strokeLinejoin="round" />
            <polygon points={pts(lit)} fill={tint(coal, 0.3)} opacity={0.7} />
            {/* Sprekker på tvers av årringene og sølvaktig glans */}
            <path
              d={`M${r1(cx - c.r * 0.4 * size)},${r1(ccy - c.r * 0.1 * size)} L${r1(cx + c.r * 0.35 * size)},${r1(ccy + c.r * 0.12 * size)}`}
              stroke={shade(coal, 0.6)}
              strokeWidth={0.9 * ss}
            />
            <path
              d={`M${r1(cx - c.r * 0.3 * size)},${r1(ccy - c.r * 0.35 * size)} L${r1(cx + c.r * 0.1 * size)},${r1(ccy - c.r * 0.42 * size)}`}
              stroke={tint(SCENE.metal, 0.2)}
              strokeWidth={1.2 * ss}
              strokeLinecap="round"
              opacity={0.55}
            />
          </g>
        );
      })}
    </Petriskal>
  );
});

export function trekullSpot(size: number): ZoomSpot {
  return { dx: -0.06 * size, dy: -0.21 * size, r: 0.06 * size };
}

/* ---------------------------------------------------------------- Støttann fra en mammut */

/** Kvadratisk Bézier-punkt og tangent. */
function quad(p0: [number, number], c: [number, number], p1: [number, number], t: number) {
  const u = 1 - t;
  const x = u * u * p0[0] + 2 * u * t * c[0] + t * t * p1[0];
  const y = u * u * p0[1] + 2 * u * t * c[1] + t * t * p1[1];
  const tx = 2 * u * (c[0] - p0[0]) + 2 * t * (p1[0] - c[0]);
  const ty = 2 * u * (c[1] - p0[1]) + 2 * t * (p1[1] - c[1]);
  const l = Math.hypot(tx, ty) || 1;
  return { x, y, nx: -ty / l, ny: tx / l };
}

/** Støttann fra en mammut liggende på benken: krum elfenbein som smalner mot spissen, med brune flekker,
 * lengdesprekker og et brudd i den tykke enden der vekstringene synes. `size` er lengden. */
export const Stottann = memo(function Stottann({ x, y, size }: { x: number; y: number; size: number }) {
  const ss = useStrokeScale();
  const id = useSvgId('c14-tann');
  const L = size;
  const geo = useMemo(() => {
    const p0: [number, number] = [-0.5 * L, -0.11 * L];
    const c: [number, number] = [0.12 * L, 0.06 * L];
    const p1: [number, number] = [0.5 * L, -0.34 * L];
    const n = 40;
    const upper: [number, number][] = [];
    const lower: [number, number][] = [];
    const mid: { x: number; y: number; nx: number; ny: number; h: number }[] = [];
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const q = quad(p0, c, p1, t);
      const h = 0.075 * L * (1 - 0.88 * t ** 1.3);
      upper.push([q.x - q.nx * h, q.y - q.ny * h]);
      lower.push([q.x + q.nx * h, q.y + q.ny * h]);
      mid.push({ ...q, h });
    }
    const maxY = Math.max(...upper.map((p) => p[1]), ...lower.map((p) => p[1]));
    return { upper, lower, mid, lift: -maxY };
  }, [L]);
  const ivory = mix(SCENE.woodLight, SCENE.snow, 0.35);
  const dy = geo.lift;
  const outline = [...geo.upper, ...[...geo.lower].reverse()].map(([a, b]) => [x + a, y + b + dy] as [number, number]);
  const m0 = geo.mid[0]!;
  const crack = (off: number, from: number, to: number) =>
    geo.mid
      .slice(from, to)
      .map((q, i) => `${i === 0 ? 'M' : 'L'}${r1(x + q.x + q.nx * q.h * off)},${r1(y + dy + q.y + q.ny * q.h * off)}`)
      .join(' ');
  const stains = [
    { i: 8, off: 0.3, r: 0.035 },
    { i: 17, off: -0.2, r: 0.028 },
    { i: 25, off: 0.4, r: 0.02 },
  ];
  return (
    <g>
      <ContactShadow cx={x + 0.02 * L} cy={y} rx={L * 0.36} ry={0.035 * L} />
      <LinearGradient id={id} stops={[[0, tint(ivory, 0.3)], [0.45, ivory], [1, shade(mix(ivory, SCENE.soil, 0.4), 0.15)]]} />
      <polygon points={pts(outline)} fill={`url(#${id})`} stroke={shade(ivory, 0.5)} strokeWidth={1.1 * ss} strokeLinejoin="round" />
      {stains.map((s, i) => {
        const q = geo.mid[s.i]!;
        return (
          <ellipse
            key={i}
            cx={x + q.x + q.nx * q.h * s.off}
            cy={y + dy + q.y + q.ny * q.h * s.off}
            rx={s.r * L}
            ry={s.r * L * 0.45}
            fill={mix(SCENE.soil, SCENE.woodDark, 0.4)}
            opacity={0.4}
            transform={`rotate(${r1((Math.atan2(-q.nx, q.ny) * 180) / Math.PI)} ${r1(x + q.x)} ${r1(y + dy + q.y)})`}
          />
        );
      })}
      <path d={crack(-0.45, 2, 30)} fill="none" stroke={shade(ivory, 0.35)} strokeWidth={0.9 * ss} opacity={0.6} />
      <path d={crack(0.2, 4, 22)} fill="none" stroke={shade(ivory, 0.35)} strokeWidth={0.8 * ss} opacity={0.5} />
      <path d={crack(-0.15, 1, 34)} fill="none" stroke={SCENE.highlight} strokeWidth={1.6 * ss} opacity={0.45} strokeLinecap="round" />
      {/* Bruddflaten i den tykke enden med vekstringer */}
      <g transform={`translate(${r1(x + m0.x)} ${r1(y + dy + m0.y)}) rotate(${r1((Math.atan2(m0.ny, m0.nx) * 180) / Math.PI - 90)})`}>
        <ellipse cx={0} cy={0} rx={0.028 * L} ry={m0.h} fill={tint(ivory, 0.15)} stroke={shade(ivory, 0.45)} strokeWidth={1 * ss} />
        {[0.72, 0.46, 0.22].map((k) => (
          <ellipse key={k} cx={0.003 * L} cy={0} rx={0.028 * L * k} ry={m0.h * k} fill="none" stroke={shade(ivory, 0.28)} strokeWidth={0.8 * ss} />
        ))}
      </g>
    </g>
  );
});

export function stottannSpot(size: number): ZoomSpot {
  return { dx: -0.36 * size, dy: -0.12 * size, r: 0.035 * size };
}

/* ---------------------------------------------------------------- Fossilt dinosaurbein */

/** Fossilt lårbein fra en dinosaur: bein som er blitt til stein, i grå og brune toner med prikker og sprekker.
 * `size` er lengden. */
export const FossiltBein = memo(function FossiltBein({ x, y, size }: { x: number; y: number; size: number }) {
  const ss = useStrokeScale();
  const id = useSvgId('c14-fossil');
  const L = size;
  const rock = mix(SCENE.stone, SCENE.soil, 0.45);
  const cy = y - 0.075 * L;
  const parts = (
    <>
      <path
        d={`M${r1(x - 0.38 * L)},${r1(cy - 0.06 * L)} C${r1(x - 0.1 * L)},${r1(cy - 0.035 * L)} ${r1(x + 0.1 * L)},${r1(cy - 0.035 * L)} ${r1(x + 0.38 * L)},${r1(cy - 0.06 * L)} L${r1(x + 0.38 * L)},${r1(cy + 0.06 * L)} C${r1(x + 0.1 * L)},${r1(cy + 0.04 * L)} ${r1(x - 0.1 * L)},${r1(cy + 0.04 * L)} ${r1(x - 0.38 * L)},${r1(cy + 0.06 * L)} Z`}
      />
      <ellipse cx={x - 0.41 * L} cy={cy - 0.005 * L} rx={0.085 * L} ry={0.075 * L} />
      <circle cx={x - 0.47 * L} cy={cy - 0.05 * L} r={0.055 * L} />
      <ellipse cx={x + 0.42 * L} cy={cy + 0.02 * L} rx={0.08 * L} ry={0.055 * L} />
      <ellipse cx={x + 0.44 * L} cy={cy - 0.045 * L} rx={0.065 * L} ry={0.045 * L} />
    </>
  );
  const speckles = useMemo(() => {
    const rnd = sceneRandom(66);
    return Array.from({ length: 34 }, () => ({
      x: -0.44 + rnd() * 0.88,
      y: -0.04 + rnd() * 0.08,
      r: 0.004 + rnd() * 0.008,
      dark: rnd() < 0.6,
    }));
  }, []);
  return (
    <g>
      <ContactShadow cx={x} cy={y} rx={L * 0.52} ry={0.04 * L} />
      <LinearGradient id={id} stops={materialStops(rock, 1.3)} />
      {/* Kontur under, fyll over: ser ut som ett stykke */}
      <g fill="none" stroke={shade(rock, 0.55)} strokeWidth={2.4 * ss}>
        {parts}
      </g>
      <g fill={`url(#${id})`} stroke="none">
        {parts}
      </g>
      {speckles.map((s, i) => (
        <circle key={i} cx={x + s.x * L} cy={cy + s.y * L} r={s.r * L} fill={s.dark ? shade(rock, 0.35) : tint(rock, 0.3)} opacity={0.55} />
      ))}
      {[-0.2, 0.05, 0.27].map((k, i) => (
        <path
          key={i}
          d={`M${r1(x + k * L)},${r1(cy - 0.045 * L)} l${r1(0.01 * L)},${r1(0.03 * L)} l${r1(-0.012 * L)},${r1(0.025 * L)} l${r1(0.008 * L)},${r1(0.03 * L)}`}
          fill="none"
          stroke={shade(rock, 0.55)}
          strokeWidth={1 * ss}
          strokeLinejoin="round"
        />
      ))}
      <path
        d={`M${r1(x - 0.33 * L)},${r1(cy - 0.035 * L)} C${r1(x - 0.1 * L)},${r1(cy - 0.02 * L)} ${r1(x + 0.1 * L)},${r1(cy - 0.02 * L)} ${r1(x + 0.33 * L)},${r1(cy - 0.035 * L)}`}
        fill="none"
        stroke={SCENE.highlight}
        strokeWidth={1.8 * ss}
        opacity={0.35}
        strokeLinecap="round"
      />
    </g>
  );
});

export function fossilSpot(size: number): ZoomSpot {
  return { dx: 0.0, dy: -0.075 * size, r: 0.04 * size };
}

/* ---------------------------------------------------------------- Prøveglass */

/** Lite prøveglass med skrukork og svart grafittpulver (prøven etter at karbonet er renset ut). `size` er høyden. */
export const Proveglass = memo(function Proveglass({ x, y, size }: { x: number; y: number; size: number }) {
  const ss = useStrokeScale();
  const idG = useSvgId('c14-glass');
  const idC = useSvgId('c14-kork');
  const h = size;
  const w = 0.42 * h;
  const capH = 0.22 * h;
  const left = x - w / 2;
  const top = y - h;
  const powder = 0.3 * h;
  return (
    <g>
      <ContactShadow cx={x} cy={y} rx={w * 0.7} />
      <LinearGradient
        id={idG}
        x2={1}
        y2={0}
        stops={[
          [0, alpha(SCENE.glass, 0.65)],
          [0.3, alpha(tint(SCENE.glass, 0.7), 0.4)],
          [1, alpha(SCENE.glass, 0.7)],
        ]}
      />
      <LinearGradient id={idC} x2={1} y2={0} stops={materialStops(PAINTS.blaa, 1.2).map(([o, c]) => [o, c] as [number, string])} />
      <rect x={left + 2} y={y - powder} width={w - 4} height={powder - 2} rx={3} fill={shade(SCENE.asphaltDark, 0.5)} />
      <rect x={left} y={top + capH} width={w} height={h - capH} rx={w * 0.12} fill={`url(#${idG})`} stroke={SCENE.glassEdge} strokeWidth={1.1 * ss} />
      <rect x={left + 3} y={top + capH + 0.18 * h} width={w - 6} height={0.22 * h} fill={tint(SCENE.plastic, 0.4)} stroke={SCENE.outline} strokeWidth={0.6 * ss} />
      <line x1={left + 7} y1={top + capH + 0.26 * h} x2={left + w - 7} y2={top + capH + 0.26 * h} stroke={VIZ.muted} strokeWidth={1.2 * ss} />
      <line x1={left + 7} y1={top + capH + 0.33 * h} x2={left + w * 0.6} y2={top + capH + 0.33 * h} stroke={VIZ.muted} strokeWidth={1.2 * ss} />
      <rect x={left - 2} y={top} width={w + 4} height={capH} rx={3} fill={`url(#${idC})`} stroke={SCENE.outline} strokeWidth={1 * ss} />
      {[0.25, 0.45, 0.65, 0.85].map((k) => (
        <line key={k} x1={left - 2 + k * (w + 4) - 2} y1={top + 3} x2={left - 2 + k * (w + 4) - 2} y2={top + capH - 3} stroke={shade(PAINTS.blaa, 0.3)} strokeWidth={1 * ss} opacity={0.6} />
      ))}
      <line x1={left + w * 0.2} y1={top + capH + 6} x2={left + w * 0.2} y2={y - powder - 6} stroke={SCENE.highlight} strokeWidth={2.2 * ss} strokeLinecap="round" opacity={0.6} />
    </g>
  );
});

export function proveglassSpot(size: number): ZoomSpot {
  return { dx: 0, dy: -0.15 * size, r: 0.12 * size };
}

/* ---------------------------------------------------------------- C-14-måleren */

/** Bordmodell av en C-14-måler: kabinett i lys plast, skuff til prøven, display med andelen som er igjen, knapper og
 * en lampe som lyser grønt når den måler. (x, y) er midt under, `w` bredden. */
export const C14Maaler = memo(function C14Maaler({
  x,
  y,
  w,
  label,
  value,
  measuring,
}: {
  x: number;
  y: number;
  w: number;
  label: string;
  value: string;
  measuring: boolean;
}) {
  const ss = useStrokeScale();
  const idBody = useSvgId('c14-maaler');
  const idTop = useSvgId('c14-maaler-topp');
  const idLamp = useSvgId('c14-lampe');
  const h = 0.62 * w;
  const topD = 0.09 * w;
  const left = x - w / 2;
  const top = y - h;
  const disp = { x: left + 0.08 * w, y: top + 0.12 * h, w: 0.6 * w, h: 0.4 * h };
  const drawer = { x: left + 0.08 * w, y: top + 0.66 * h, w: 0.6 * w, h: 0.18 * h };
  const lampColor = measuring ? PAINTS.gronn : shade(SCENE.plasticShade, 0.2);
  return (
    <g>
      <ContactShadow cx={x} cy={y} rx={w * 0.58} ry={0.06 * w} />
      <LinearGradient id={idBody} stops={materialStops(SCENE.plastic, 1.2)} />
      <LinearGradient id={idTop} stops={[[0, tint(SCENE.plastic, 0.4)], [1, SCENE.plastic]]} />
      <RadialGradient id={idLamp} fx={0.35} fy={0.35} stops={sphereStops(lampColor)} />
      {/* Toppflaten i svakt perspektiv */}
      <polygon
        points={pts([
          [left + 0.04 * w, top - topD],
          [left + w - 0.04 * w, top - topD],
          [left + w, top],
          [left, top],
        ])}
        fill={`url(#${idTop})`}
        stroke={SCENE.outline}
        strokeWidth={1 * ss}
        strokeLinejoin="round"
      />
      <rect x={left} y={top} width={w} height={h} rx={0.03 * w} fill={`url(#${idBody})`} stroke={SCENE.outline} strokeWidth={1 * ss} />
      {/* Føtter */}
      <rect x={left + 0.06 * w} y={y - 2} width={0.1 * w} height={4} rx={2} fill={SCENE.rubber} />
      <rect x={left + w - 0.16 * w} y={y - 2} width={0.1 * w} height={4} rx={2} fill={SCENE.rubber} />
      {/* Display */}
      <rect x={disp.x - 3} y={disp.y - 3} width={disp.w + 6} height={disp.h + 6} rx={5} fill={SCENE.plasticShade} stroke={SCENE.outline} strokeWidth={0.8 * ss} />
      <rect x={disp.x} y={disp.y} width={disp.w} height={disp.h} rx={3} fill={SCENE.display} />
      <text
        x={disp.x + 0.07 * disp.w}
        y={disp.y + 0.36 * disp.h}
        style={{ fill: SCENE.displayText, fontSize: 0.24 * disp.h, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}
      >
        {label}
      </text>
      <text
        x={disp.x + disp.w * 0.93}
        y={disp.y + 0.84 * disp.h}
        textAnchor="end"
        style={{ fill: SCENE.displayText, fontSize: 0.42 * disp.h, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}
      >
        {value}
      </text>
      <line x1={disp.x + 4} y1={disp.y + 3} x2={disp.x + disp.w * 0.5} y2={disp.y + 3} stroke={SCENE.highlight} strokeWidth={1.2 * ss} opacity={0.25} />
      {/* Prøveskuffen */}
      <rect x={drawer.x} y={drawer.y} width={drawer.w} height={drawer.h} rx={3} fill={SCENE.plasticShade} stroke={SCENE.outline} strokeWidth={0.8 * ss} />
      <rect x={drawer.x + drawer.w * 0.35} y={drawer.y + drawer.h * 0.35} width={drawer.w * 0.3} height={drawer.h * 0.3} rx={2} fill={shade(SCENE.plasticShade, 0.3)} />
      {/* Knapper og lampe */}
      {[0.3, 0.52].map((k) => (
        <circle key={k} cx={left + 0.84 * w} cy={top + k * h} r={0.045 * w} fill={tint(SCENE.plasticShade, 0.2)} stroke={SCENE.outline} strokeWidth={0.8 * ss} />
      ))}
      <circle cx={left + 0.84 * w} cy={top + 0.76 * h} r={0.035 * w} fill={`url(#${idLamp})`} stroke={SCENE.outline} strokeWidth={0.7 * ss} />
      {measuring && <circle cx={left + 0.84 * w} cy={top + 0.76 * h} r={0.07 * w} fill={PAINTS.gronn} opacity={0.18} />}
    </g>
  );
});

/* ---------------------------------------------------------------- Lupa */

export interface LupeAtom {
  x: number;
  y: number;
  c14: boolean;
}

/**
 * Forstørrelsen: en rund lupe med tynn metallring, en lys kjegle fra ringen på prøven og C-14-atomene inni
 * (henfalte atomer er blitt N-14 og er grå). `atoms` har posisjoner i enhetssirkelen.
 */
export function Lupe({
  cx,
  cy,
  R,
  spot,
  atoms,
  atomR,
}: {
  cx: number;
  cy: number;
  R: number;
  /** Ringen på prøven (figurens enheter). */
  spot: { x: number; y: number; r: number };
  atoms: LupeAtom[];
  atomR: number;
}) {
  const ss = useStrokeScale();
  const idC = useSvgId('c14-atom');
  const idN = useSvgId('n14-atom');
  const idBg = useSvgId('c14-lupe-bunn');
  const idRim = useSvgId('c14-lupe-ring');
  // Ytre tangenter mellom den lille ringen og lupa.
  const dx = cx - spot.x;
  const dy = cy - spot.y;
  const d = Math.hypot(dx, dy) || 1;
  const th = Math.atan2(dy, dx);
  const a = Math.acos(Math.max(-1, Math.min(1, (spot.r - R) / d)));
  const t1 = th + a;
  const t2 = th - a;
  const p = (c: { x: number; y: number }, r: number, ang: number) => [c.x + r * Math.cos(ang), c.y + r * Math.sin(ang)] as [number, number];
  const s1 = p(spot, spot.r, t1);
  const s2 = p(spot, spot.r, t2);
  const l1 = p({ x: cx, y: cy }, R, t1);
  const l2 = p({ x: cx, y: cy }, R, t2);
  const inner = R - atomR * 1.6;
  return (
    <g>
      <RadialGradient id={idC} fx={0.35} fy={0.35} stops={sphereStops(VIZ.series[1]!)} />
      <RadialGradient id={idN} fx={0.35} fy={0.35} stops={sphereStops(VIZ.muted)} />
      <RadialGradient
        id={idBg}
        fx={0.4}
        fy={0.35}
        stops={[
          [0, VIZ.surface],
          [1, mix(VIZ.surface, VIZ.muted, 0.12)],
        ]}
      />
      <LinearGradient id={idRim} x2={1} y2={1} stops={[[0, tint(SCENE.metal, 0.4)], [0.5, SCENE.metal], [1, shade(SCENE.metal, 0.35)]]} />
      {/* Kjeglen fra prøven til lupa */}
      <polygon points={pts([s1, l1, l2, s2])} fill={alpha(VIZ.surface, 0.32)} />
      <line x1={s1[0]} y1={s1[1]} x2={l1[0]} y2={l1[1]} stroke={VIZ.muted} strokeWidth={1.2 * ss} strokeDasharray="5 4" />
      <line x1={s2[0]} y1={s2[1]} x2={l2[0]} y2={l2[1]} stroke={VIZ.muted} strokeWidth={1.2 * ss} strokeDasharray="5 4" />
      <circle cx={spot.x} cy={spot.y} r={spot.r} fill={alpha(VIZ.surface, 0.25)} stroke={VIZ.ink} strokeWidth={1.6 * ss} />
      {/* Lupa */}
      <circle cx={cx + 3} cy={cy + 5} r={R + 4} fill={SCENE.shadow} opacity={0.25} />
      <circle cx={cx} cy={cy} r={R} fill={`url(#${idBg})`} />
      {atoms.map((at, i) => (
        <circle
          key={i}
          cx={cx + at.x * inner}
          cy={cy + at.y * inner}
          r={atomR}
          fill={`url(#${at.c14 ? idC : idN})`}
          stroke={at.c14 ? shade(VIZ.series[1]!, 0.35) : shade(VIZ.muted, 0.3)}
          strokeWidth={0.8 * ss}
          opacity={at.c14 ? 1 : 0.55}
        />
      ))}
      <circle cx={cx} cy={cy} r={R} fill="none" stroke={`url(#${idRim})`} strokeWidth={7 * ss} />
      <circle cx={cx} cy={cy} r={R + 3.5 * ss} fill="none" stroke={SCENE.outline} strokeWidth={0.8 * ss} />
      <circle cx={cx} cy={cy} r={R - 3.5 * ss} fill="none" stroke={SCENE.outline} strokeWidth={0.6 * ss} />
      <path
        d={`M${r1(cx - R * 0.72)},${r1(cy - R * 0.42)} A${r1(R * 0.84)},${r1(R * 0.84)} 0 0 1 ${r1(cx - R * 0.3)},${r1(cy - R * 0.78)}`}
        fill="none"
        stroke={SCENE.highlight}
        strokeWidth={3 * ss}
        strokeLinecap="round"
        opacity={0.35}
      />
    </g>
  );
}
